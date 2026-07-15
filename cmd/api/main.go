// Command api is the SETHU-CARE backend: one deployable, one database.
//
// GO LESSON — compare this to Spring. There is no @SpringBootApplication scanning the
// classpath, no autoconfiguration, no dependency-injection container. Everything that
// happens at startup is written below, in order, and you can read all of it. That is
// the trade Go makes: more lines here, but zero magic to debug at 3am.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/httpapi"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/outbox"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
)

func main() {
	// GO LESSON — main() does almost nothing but call run() and handle its error.
	// This is a well-known Go pattern: main can only os.Exit, which skips deferred
	// cleanup. Keeping the real work in a function that RETURNS AN ERROR means every
	// `defer` (closing the DB pool, draining the server) actually gets to run.
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	// GO LESSON — context.Context is Go's answer to "how do I cancel things?". It is
	// threaded explicitly through every call that might block. Here it is wired to
	// SIGINT/SIGTERM, so Ctrl-C cancels every in-flight query rather than killing the
	// process mid-transaction.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	dsn := env("DATABASE_URL", "postgres://sethu:sethu@127.0.0.1:5434/sethu?sslmode=disable")

	// storage.NewPool (not raw pgxpool.New) because it registers the google/uuid codec and
	// pings — the same pool the outbox worker and every repository rely on.
	pool, err := storage.NewPool(ctx, dsn)
	if err != nil {
		return fmt.Errorf("connecting to postgres: %w", err)
	}
	defer pool.Close()
	slog.Info("connected to postgres")

	// The outbox worker. In P0 the only subscriber is a logging handler — the real
	// consumers (Notifications, Ledger, Assignment) do not exist yet — so starting the API
	// visibly drains every domain event to the log, proving the pipeline end to end.
	dispatcher := outbox.NewDispatcher()
	dispatcher.SubscribeAll(outbox.LoggingHandler(logger))
	worker := outbox.NewWorker(pool, dispatcher, outbox.WithLogger(logger))

	var workerDone sync.WaitGroup
	workerDone.Add(1)
	go func() {
		defer workerDone.Done()
		// Run only ever returns because ctx was cancelled (a normal shutdown). Any other
		// return would be a surprise worth logging.
		if err := worker.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
			slog.Error("outbox worker exited unexpectedly", "err", err)
		}
	}()

	signer, err := auth.NewSigner(jwtSecret(logger), 24*time.Hour)
	if err != nil {
		return fmt.Errorf("configuring jwt: %w", err)
	}
	bookingSvc := booking.NewService(pool)
	identitySvc := identity.NewService(pool)
	// devEcho returns OTP codes in the response since there is no SMS provider yet. OFF unless
	// SETHU_DEV_OTP=true, so it can never leak in an environment that forgot to disable it.
	devEcho := env("SETHU_DEV_OTP", "") == "true"

	srv := &http.Server{
		Addr:              env("ADDR", ":8080"),
		Handler:           routes(pool, bookingSvc, identitySvc, signer, devEcho, logger),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// GO LESSON — goroutines and channels. `go func()` starts a concurrent lightweight
	// thread. We run the server in one so that main can sit and wait for EITHER the
	// server to die OR a shutdown signal, whichever comes first. errCh carries the
	// server's error back across that boundary; a channel is how goroutines talk.
	errCh := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	// `select` blocks until one of its cases can proceed.
	select {
	case err := <-errCh:
		return fmt.Errorf("http server: %w", err)
	case <-ctx.Done():
		slog.Info("shutdown signal received, draining")
	}

	// Graceful shutdown on a FRESH context — ctx is already cancelled, so reusing it
	// would abort in-flight requests instantly, which is the opposite of draining.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("draining http server: %w", err)
	}

	// ctx is already cancelled, so the worker is on its way out; wait for its current batch
	// to finish before we close the pool under it.
	workerDone.Wait()

	slog.Info("stopped cleanly")
	return nil
}

func routes(pool *pgxpool.Pool, bookings *booking.Service, ids *identity.Service, signer *auth.Signer, devEcho bool, log *slog.Logger) http.Handler {
	// Go 1.22+ ServeMux understands method and path patterns natively — no router
	// library needed yet. We add one only when we actually need middleware chains.
	mux := http.NewServeMux()

	// Auth endpoints are public — this is where a caller gets a token.
	httpapi.NewAuthHandler(ids, signer, log, devEcho).Register(mux)

	// Booking endpoints, each guarded by the auth it declares (see Handler.Register).
	httpapi.New(bookings, signer, log).Register(mux)

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		status := map[string]string{"status": "UP", "db": "UP"}
		code := http.StatusOK

		if err := pool.Ping(ctx); err != nil {
			// A health check that reports UP while the database is unreachable is worse
			// than no health check — it tells the load balancer to keep sending traffic.
			slog.Error("health: database unreachable", "err", err)
			status["status"], status["db"] = "DOWN", "DOWN"
			code = http.StatusServiceUnavailable
		}

		writeJSON(w, code, status)
	})

	return mux
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("writing json response", "err", err)
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// jwtSecret reads JWT_SECRET, or falls back to a FIXED dev secret with a loud warning. The
// fallback lets a developer run the app with zero setup, while making it impossible to ship
// to production by accident without noticing the log line — and NewSigner still rejects it
// if it were ever shortened below 32 bytes.
func jwtSecret(log *slog.Logger) string {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return s
	}
	log.Warn("JWT_SECRET is not set — using an INSECURE built-in dev secret. Do not run this in production.")
	return "sethu-care-insecure-dev-secret-change-me"
}
