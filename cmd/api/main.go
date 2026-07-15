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

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/address"
	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/catalog"
	"github.com/kokkondaBhanuteja/sethu-care/internal/config"
	"github.com/kokkondaBhanuteja/sethu-care/internal/httpapi"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
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
	identityService := identity.NewService(pool)
	opsService := ops.New(pool, bookingService)
	verificationService := verification.NewService(pool)
	ledgerService := ledger.NewService(pool)
	reviewService := reviews.NewService(pool)
	notificationService := notifications.NewService(pool, logger)

	dispatcher := outbox.NewDispatcher()
	dispatcher.SubscribeAll(outbox.LoggingHandler(logger))
	// NOTIFICATIONS: the customer-facing voice. It sees every event and sends a message for the
	// ones a customer should hear about (assigned, en route, arrived, started, completed,
	// escalated, failed); the rest it skips.
	dispatcher.SubscribeAll(func(ctx context.Context, event outbox.Event) error {
		if event.AggregateType != "booking" {
			return nil
		}
		return notificationService.Notify(ctx, event.EventType, event.AggregateID)
	})
	// AUTO-SEARCH: a confirmed booking moves itself into SEARCHING (and thus the assignment
	// queue) without an admin poking it. The adapter keeps ops decoupled from outbox.Event —
	// it just hands over the aggregate id.
	dispatcher.Subscribe("booking.confirmed", func(ctx context.Context, event outbox.Event) error {
		return opsService.StartSearch(ctx, event.AggregateID)
	})
	// DUAL OTP issuance: when the technician arrives, issue the START code to the customer;
	// when they say the work is done, issue the COMPLETION code. Verification happens
	// interactively on the transition endpoint.
	dispatcher.Subscribe("technician.arrived", issueOTP(verificationService, verification.PurposeStart, settings.DevEchoOTP, logger))
	dispatcher.Subscribe("booking.awaiting_completion", issueOTP(verificationService, verification.PurposeCompletion, settings.DevEchoOTP, logger))
	// BILLING: a completed booking records its ledger entry (REVENUE or CASH_CUSTODY). The
	// payment method rides the event payload from the completion request.
	dispatcher.Subscribe("booking.completed", func(ctx context.Context, event outbox.Event) error {
		var payload struct {
			PaymentMethod string `json:"payment_method"`
		}
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			return fmt.Errorf("decoding booking.completed: %w", err)
		}
		return ledgerService.RecordCompletion(ctx, event.AggregateID, ledger.PaymentMethod(payload.PaymentMethod))
	})
	// CREDITS: a booking that FAILED (nobody could be found) gets a goodwill credit.
	failedCredit := money.FromPaise(settings.FailedBookingCreditPaise)
	dispatcher.Subscribe("booking.failed", func(ctx context.Context, event outbox.Event) error {
		return ledgerService.IssueFailureCredit(ctx, event.AggregateID, failedCredit)
	})
	// RATINGS: a submitted review updates the technician's rating — the signal the assignment
	// queue ranks by. Reviews publishes; Identity (which owns technicians) recomputes.
	dispatcher.Subscribe("review.submitted", func(ctx context.Context, event outbox.Event) error {
		var payload struct {
			TechnicianID uuid.UUID `json:"technician_id"`
		}
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			return fmt.Errorf("decoding review.submitted: %w", err)
		}
		return identityService.RecomputeTechnicianRating(ctx, payload.TechnicianID)
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
			identityService:     identityService,
			catalogService:      catalogService,
			addressService:      addressService,
			opsService:          opsService,
			signer:              signer,
			devEchoOTP:          settings.DevEchoOTP,
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

	if err := server.Shutdown(shutdownContext); err != nil {
		return fmt.Errorf("draining http server: %w", err)
	}

	// rootContext is already cancelled, so the worker is on its way out; wait for its current
	// batch to finish before we close the pool under it.
	workerDone.Wait()

	logger.Info("stopped cleanly")
	return nil
}

// issueOTP returns an outbox handler that issues the START or COMPLETION code for the booking
// the event names. In dev it logs the code (there is no SMS provider yet). Idempotent: a
// redelivered event finds the code already issued and does nothing.
func issueOTP(verifier *verification.Service, purpose verification.Purpose, devEcho bool, logger *slog.Logger) outbox.Handler {
	return func(ctx context.Context, event outbox.Event) error {
		code, issued, err := verifier.IssueOTP(ctx, event.AggregateID, purpose)
		if err != nil {
			return err
		}
		if issued && devEcho {
			logger.Info("DEV job otp issued", "booking_id", event.AggregateID, "purpose", purpose, "code", code)
		}
		return nil
	}
}

// routerDependencies collects everything the router needs, so buildRouter takes one
// parameter instead of many positional ones.
type routerDependencies struct {
	pool                *pgxpool.Pool
	bookingService      *booking.Service
	verificationService *verification.Service
	reviewService       *reviews.Service
	identityService     *identity.Service
	catalogService      *catalog.Catalog
	addressService      *address.Service
	opsService          *ops.Service
	signer              *auth.Signer
	devEchoOTP          bool
	logger              *slog.Logger
}

func buildRouter(dependencies routerDependencies) http.Handler {
	// Go 1.22+ ServeMux understands method and path patterns natively — no router
	// library needed yet. We add one only when we actually need middleware chains.
	mux := http.NewServeMux()

	// Auth endpoints are public — this is where a caller gets a token.
	httpapi.NewAuthHandler(dependencies.identityService, dependencies.signer, dependencies.logger, dependencies.devEchoOTP).Register(mux)

	// Catalog: public browse + admin management. Addresses: customer-owned.
	httpapi.NewCatalogHandler(dependencies.catalogService, dependencies.signer, dependencies.logger).Register(mux)
	httpapi.NewAddressHandler(dependencies.addressService, dependencies.signer, dependencies.logger).Register(mux)

	// Ops console: the manual-assignment queue (admin-only).
	httpapi.NewOpsHandler(dependencies.opsService, dependencies.signer, dependencies.logger).Register(mux)

	// Booking endpoints, each guarded by the auth it declares (see Handler.Register).
	httpapi.New(dependencies.bookingService, dependencies.verificationService, dependencies.reviewService, dependencies.signer, dependencies.logger).Register(mux)

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

	return mux
}
