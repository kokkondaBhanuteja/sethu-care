// Command api is the SETHU-CARE backend: one deployable, one database.
//
// GO LESSON — compare this to Spring. There is no @SpringBootApplication scanning the
// classpath, no autoconfiguration, no dependency-injection container. Everything that
// happens at startup is written below, in order, and you can read all of it. That is
// the trade Go makes: more lines here, but zero magic to debug at 3am.
package main

import (
	"context"
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
	"github.com/joho/godotenv"

	"github.com/kokkondaBhanuteja/sethu-care/internal/address"
	"github.com/kokkondaBhanuteja/sethu-care/internal/app"
	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/catalog"
	"github.com/kokkondaBhanuteja/sethu-care/internal/config"
	"github.com/kokkondaBhanuteja/sethu-care/internal/httpapi"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/media"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/notifications"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
	"github.com/kokkondaBhanuteja/sethu-care/internal/outbox"
	"github.com/kokkondaBhanuteja/sethu-care/internal/reviews"
	"github.com/kokkondaBhanuteja/sethu-care/internal/shared/response"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/verification"
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

	// Load .env for local development. This is 12-factor-safe: godotenv.Load NEVER overrides a
	// variable already set in the process environment, so in production (where the platform injects
	// real secrets) it is a harmless no-op, and a missing file is fine. Secrets live in .env
	// (gitignored); .env.example documents every key.
	if err := godotenv.Load(); err == nil {
		logger.Info("loaded .env")
	}

	settings, err := config.Load()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}
	if settings.UsingDevJWTSecret {
		logger.Warn("JWT_SECRET is not set — using an INSECURE built-in dev secret. Do not run this in production.")
	}

	// GO LESSON — context.Context is Go's answer to "how do I cancel things?". It is
	// threaded explicitly through every call that might block. Here it is wired to
	// SIGINT/SIGTERM, so Ctrl-C cancels every in-flight query rather than killing the
	// process mid-transaction.
	rootContext, stopSignals := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stopSignals()

	// storage.NewPool (not raw pgxpool.New) because it registers the google/uuid codec and
	// pings — the same pool the outbox worker and every repository rely on.
	pool, err := storage.NewPool(rootContext, settings.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connecting to postgres: %w", err)
	}
	defer pool.Close()
	logger.Info("connected to postgres")

	// The domain services, and the outbox consumers that react to their events: auto-search
	// (ops), OTP issuance (verification), billing (ledger), and customer notifications. The
	// worker drives them all off the one event stream.
	bookingService := booking.NewService(pool)
	var identityOptions []identity.Option
	if settings.DemoPhone != "" && settings.DemoOTP != "" {
		identityOptions = append(identityOptions, identity.WithDemoAccount(settings.DemoPhone, settings.DemoOTP))
	}
	identityService := identity.NewService(pool, identityOptions...)
	opsService := ops.New(pool, bookingService)
	verificationService := verification.NewService(pool)
	ledgerService := ledger.NewService(pool)
	reviewService := reviews.NewService(pool)
	notificationService := notifications.NewService(pool, notifications.NewLogSender(logger), logger)

	// The outbox consumers (auto-search, dual-OTP, billing, credits, notifications, ratings) are
	// wired in one place — internal/app — so this composition root stays thin as they multiply.
	dispatcher := outbox.NewDispatcher()
	app.RegisterConsumers(dispatcher, app.ConsumerDeps{
		Notifications: notificationService,
		Ops:           opsService,
		Verification:  verificationService,
		Ledger:        ledgerService,
		Identity:      identityService,
		FailedCredit:  money.FromPaise(settings.FailedBookingCreditPaise),
		DevEchoOTP:    settings.DevEchoOTP,
		Logger:        logger,
	})
	worker := outbox.NewWorker(pool, dispatcher, outbox.WithLogger(logger))

	var workerDone sync.WaitGroup
	workerDone.Add(1)
	go func() {
		defer workerDone.Done()
		// Run only ever returns because rootContext was cancelled (a normal shutdown). Any
		// other return would be a surprise worth logging.
		if err := worker.Run(rootContext); err != nil && !errors.Is(err, context.Canceled) {
			logger.Error("outbox worker exited unexpectedly", "err", err)
		}
	}()

	signer, err := auth.NewSigner(settings.JWTSecret, settings.JWTTTL)
	if err != nil {
		return fmt.Errorf("configuring jwt: %w", err)
	}

	catalogService := catalog.New(pool)
	addressService := address.New(pool)

	server := &http.Server{
		Addr: settings.ListenAddr,
		Handler: buildRouter(routerDependencies{
			pool:                pool,
			bookingService:      bookingService,
			verificationService: verificationService,
			reviewService:       reviewService,
			ledgerService:       ledgerService,
			identityService:     identityService,
			catalogService:      catalogService,
			addressService:      addressService,
			opsService:          opsService,
			signer:              signer,
			devEchoOTP:          settings.DevEchoOTP,
			upiVPA:              settings.UPIVirtualAddress,
			upiPayee:            settings.UPIPayeeName,
			cloudinary:          media.NewCloudinary(settings.CloudinaryCloudName, settings.CloudinaryAPIKey, settings.CloudinaryAPISecret),
			logger:              logger,
		}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// GO LESSON — goroutines and channels. `go func()` starts a concurrent lightweight
	// thread. We run the server in one so that main can sit and wait for EITHER the
	// server to die OR a shutdown signal, whichever comes first. serverErrors carries the
	// server's error back across that boundary; a channel is how goroutines talk.
	serverErrors := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrors <- err
		}
	}()

	// `select` blocks until one of its cases can proceed.
	select {
	case err := <-serverErrors:
		return fmt.Errorf("http server: %w", err)
	case <-rootContext.Done():
		logger.Info("shutdown signal received, draining")
	}

	// Graceful shutdown on a FRESH context — rootContext is already cancelled, so reusing it
	// would abort in-flight requests instantly, which is the opposite of draining.
	shutdownContext, cancelShutdown := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancelShutdown()

	logger.Info("draining http server")
	if err := server.Shutdown(shutdownContext); err != nil {
		return fmt.Errorf("draining http server: %w", err)
	}

	// rootContext is already cancelled, so the worker is on its way out; wait for its current
	// batch to finish before we close the pool under it.
	workerDone.Wait()
	//GO LESSON — Wait() blocks until the WaitGroup counter is zero. It's a simple way to
	logger.Info("stopped cleanly")
	return nil
}

// routerDependencies collects everything the router needs, so buildRouter takes one
// parameter instead of many positional ones.
type routerDependencies struct {
	pool                *pgxpool.Pool
	bookingService      *booking.Service
	verificationService *verification.Service
	reviewService       *reviews.Service
	ledgerService       *ledger.Service
	identityService     *identity.Service
	catalogService      *catalog.Catalog
	addressService      *address.Service
	opsService          *ops.Service
	signer              *auth.Signer
	devEchoOTP          bool
	upiVPA              string
	upiPayee            string
	cloudinary          *media.Cloudinary
	logger              *slog.Logger
}

func buildRouter(dependencies routerDependencies) http.Handler {
	// Go 1.22+ ServeMux understands method and path patterns natively — no router
	// library needed yet. We add one only when we actually need middleware chains.
	mux := http.NewServeMux()

	// The huma API wraps the mux: every operation is registered through it, producing the OpenAPI
	// contract the mobile client is generated from, and sharing one router. RegisterAll is the
	// single operation list, shared with the tests and the OpenAPI generator.
	humaAPI := httpapi.NewHumaAPI(mux, dependencies.signer)
	httpapi.RegisterAll(humaAPI, httpapi.Dependencies{
		Identity:     dependencies.identityService,
		Catalog:      dependencies.catalogService,
		Address:      dependencies.addressService,
		Ops:          dependencies.opsService,
		Ledger:       dependencies.ledgerService,
		Verification: dependencies.verificationService,
		Booking:      dependencies.bookingService,
		Reviews:      dependencies.reviewService,
		Cloudinary:   dependencies.cloudinary,
		Signer:       dependencies.signer,
		UPIVPA:       dependencies.upiVPA,
		UPIPayee:     dependencies.upiPayee,
		DevEchoOTP:   dependencies.devEchoOTP,
		Logger:       dependencies.logger,
	})

	mux.HandleFunc("GET /health", func(writer http.ResponseWriter, request *http.Request) {
		pingContext, cancelPing := context.WithTimeout(request.Context(), 2*time.Second)
		defer cancelPing()

		status := map[string]string{"status": "UP", "db": "UP"}
		statusCode := http.StatusOK

		if err := dependencies.pool.Ping(pingContext); err != nil {
			// A health check that reports UP while the database is unreachable is worse
			// than no health check — it tells the load balancer to keep sending traffic.
			dependencies.logger.Error("health: database unreachable", "err", err)
			status["status"], status["db"] = "DOWN", "DOWN"
			statusCode = http.StatusServiceUnavailable
		}

		response.JSON(writer, statusCode, status)
	})

	// CORS so the web surfaces (admin dashboard, local web previews) can call the API from a
	// different origin. The API is Bearer-token (no cookies), so a wildcard origin is safe; a
	// production deployment should restrict it to known origins via config.
	return withCORS(mux)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Access-Control-Allow-Origin", "*")
		writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(writer, request)
	})
}
