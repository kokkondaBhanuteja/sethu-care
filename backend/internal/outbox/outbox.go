// Package outbox delivers the domain events that booking.Service (and later others) write
// transactionally into the `outbox` table. It is the other half of the transactional-outbox
// pattern: the writer guarantees the event was SAVED atomically with the state change; this
// worker guarantees it is eventually DELIVERED.
//
// Delivery is AT-LEAST-ONCE, and that is not a limitation to be fixed — it is the contract.
// The worker dispatches an event, then marks it published. If it crashes in between, the row
// is still unpublished and goes out again on restart. Therefore every handler MUST be
// idempotent: seeing the same event twice must be harmless.
package outbox

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// Event is one row of the outbox, handed to a subscriber.
type Event struct {
	ID            uuid.UUID
	AggregateType string
	AggregateID   uuid.UUID
	EventType     string // the ROADMAP §8 name, e.g. "booking.completed"
	Payload       json.RawMessage
	Attempts      int32 // how many times delivery has already been tried and failed
}

// Handler reacts to an event. Returning an error leaves the event unpublished for retry.
//
// GO LESSON — a function type as the unit of behaviour, rather than an interface with one
// method. When the abstraction is "a thing you call", a func type is lighter than an
// interface and any matching function or closure satisfies it for free.
type Handler func(context.Context, Event) error

// Dispatcher routes an event to the handlers subscribed to it. Safe for concurrent use:
// subscriptions are set up once at startup, then read by the worker goroutine.
type Dispatcher struct {
	mu     sync.RWMutex
	byType map[string][]Handler
	all    []Handler
}

func NewDispatcher() *Dispatcher {
	return &Dispatcher{byType: make(map[string][]Handler)}
}

// Subscribe registers a handler for one event type — e.g. Ledger for "booking.completed".
func (dispatcher *Dispatcher) Subscribe(eventType string, handler Handler) {
	dispatcher.mu.Lock()
	defer dispatcher.mu.Unlock()
	dispatcher.byType[eventType] = append(dispatcher.byType[eventType], handler)
}

// SubscribeAll registers a handler for EVERY event — for cross-cutting consumers like
// logging and, later, analytics, which do not care about the specific type.
func (dispatcher *Dispatcher) SubscribeAll(handler Handler) {
	dispatcher.mu.Lock()
	defer dispatcher.mu.Unlock()
	dispatcher.all = append(dispatcher.all, handler)
}

// dispatch delivers to every matching handler. If any fails, the event is considered
// undelivered and will be retried in full — so, again, handlers must be idempotent.
//
// errors.Join collects every handler's failure rather than stopping at the first: one
// broken consumer should not hide that a second one also broke.
func (dispatcher *Dispatcher) dispatch(ctx context.Context, event Event) error {
	dispatcher.mu.RLock()
	handlers := make([]Handler, 0, len(dispatcher.all)+len(dispatcher.byType[event.EventType]))
	handlers = append(handlers, dispatcher.all...)
	handlers = append(handlers, dispatcher.byType[event.EventType]...)
	dispatcher.mu.RUnlock()

	var errs []error
	for _, handler := range handlers {
		if err := handler(ctx, event); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

// Worker polls the outbox and drives delivery.
type Worker struct {
	pool       *pgxpool.Pool
	dispatcher *Dispatcher
	batchSize  int32
	interval   time.Duration
	log        *slog.Logger
}

// NewWorker builds a worker with sensible defaults; the Option functions tune it.
func NewWorker(pool *pgxpool.Pool, dispatcher *Dispatcher, opts ...Option) *Worker {
	worker := &Worker{
		pool:       pool,
		dispatcher: dispatcher,
		batchSize:  100,
		interval:   time.Second,
		log:        slog.Default(),
	}
	for _, applyOption := range opts {
		applyOption(worker)
	}
	return worker
}

// Option tunes a Worker. This is the functional-options pattern — Go's idiom for optional
// constructor parameters, since it has no keyword or default arguments.
type Option func(*Worker)

func WithInterval(interval time.Duration) Option {
	return func(worker *Worker) { worker.interval = interval }
}
func WithBatchSize(size int32) Option       { return func(worker *Worker) { worker.batchSize = size } }
func WithLogger(logger *slog.Logger) Option { return func(worker *Worker) { worker.log = logger } }

// Poll processes at most one batch and returns how many events it delivered.
//
// The whole batch runs in ONE transaction. ClaimUnpublishedOutbox takes FOR UPDATE SKIP
// LOCKED, so the rows are locked to this worker for the duration; a concurrent worker skips
// them. Each row is dispatched and then marked published (success) or has its failure
// recorded (leaving it unpublished for the next poll). The lock releases on commit.
func (worker *Worker) Poll(ctx context.Context) (int, error) {
	var delivered int

	err := storage.InTx(ctx, worker.pool, func(tx pgx.Tx) error {
		queries := sqlcgen.New(tx)

		rows, err := queries.ClaimUnpublishedOutbox(ctx, worker.batchSize)
		if err != nil {
			return err
		}

		for _, row := range rows {
			event := Event{
				ID:            row.ID,
				AggregateType: row.AggregateType,
				AggregateID:   row.AggregateID,
				EventType:     row.EventType,
				Payload:       row.Payload,
				Attempts:      row.Attempts,
			}

			if dispatchErr := worker.dispatcher.dispatch(ctx, event); dispatchErr != nil {
				// A handler refused. Record the failure and MOVE ON — leaving the row
				// unpublished so the next poll retries it. We do not return the error,
				// because that would roll back the whole batch and lose the successful
				// deliveries alongside it.
				message := dispatchErr.Error()
				if failureErr := queries.RecordOutboxFailure(ctx, sqlcgen.RecordOutboxFailureParams{
					ID:        row.ID,
					LastError: &message,
				}); failureErr != nil {
					return failureErr // a DB failure IS fatal to the batch
				}
				worker.log.Warn("outbox delivery failed; will retry",
					"event_type", event.EventType, "event_id", event.ID,
					"attempts", event.Attempts+1, "err", message)
				continue
			}

			if publishErr := queries.MarkOutboxPublished(ctx, row.ID); publishErr != nil {
				return publishErr
			}
			delivered++
		}
		return nil
	})

	return delivered, err
}

// Run polls on a ticker until ctx is cancelled. On each tick it drains fully — polling
// repeatedly until a batch comes back short — so a burst of events does not sit waiting a
// whole interval per batch.
//
// GO LESSON — the select-on-ctx.Done() loop is the standard shape of a long-running Go
// worker. ctx is wired to SIGTERM in main, so a deploy stops this cleanly between batches.
func (worker *Worker) Run(ctx context.Context) error {
	worker.log.Info("outbox worker started", "interval", worker.interval, "batch_size", worker.batchSize)

	ticker := time.NewTicker(worker.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			worker.log.Info("outbox worker stopping")
			return ctx.Err()
		case <-ticker.C:
			worker.drain(ctx)
		}
	}
}

func (worker *Worker) drain(ctx context.Context) {
	for {
		delivered, err := worker.Poll(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return // shutting down; not an error worth logging
			}
			worker.log.Error("outbox poll failed", "err", err)
			return
		}
		if delivered < int(worker.batchSize) {
			return // a short batch means the backlog is drained
		}
	}
}

// LoggingHandler returns a SubscribeAll handler that logs every event. In P0 the real
// consumers (Notifications, Ledger, Assignment) do not exist yet, so this gives the worker
// something visible to do and proves the pipeline end to end.
func LoggingHandler(log *slog.Logger) Handler {
	return func(_ context.Context, event Event) error {
		log.Info("domain event",
			"event_type", event.EventType,
			"aggregate", event.AggregateType,
			"aggregate_id", event.AggregateID,
			"payload", string(event.Payload))
		return nil
	}
}
