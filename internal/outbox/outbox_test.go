package outbox_test

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/outbox"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

const migrationsDir = "../../db/migrations"

// A subscribed handler receives the event, and the row is then marked published so it never
// comes back.
func TestPollDeliversAndMarksPublished(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	ctx := context.Background()

	id := seedEvent(t, pool, "booking.confirmed", `{"hello":"world"}`)

	var got []outbox.Event
	dispatcher := outbox.NewDispatcher()
	dispatcher.Subscribe("booking.confirmed", func(_ context.Context, event outbox.Event) error {
		got = append(got, event)
		return nil
	})

	worker := outbox.NewWorker(pool, dispatcher)
	delivered, err := worker.Poll(ctx)
	if err != nil {
		t.Fatalf("Poll: %v", err)
	}
	if delivered != 1 {
		t.Fatalf("delivered %d, want 1", delivered)
	}
	if len(got) != 1 || got[0].EventType != "booking.confirmed" {
		t.Fatalf("handler got %+v, want one booking.confirmed event", got)
	}
	// jsonb does NOT preserve byte formatting — it stores a normalised representation and
	// gives it back with its own spacing ({"hello": "world"}, note the space). So compare
	// the parsed value, never the raw bytes.
	var payload map[string]string
	if err := json.Unmarshal(got[0].Payload, &payload); err != nil {
		t.Fatalf("payload is not valid json: %v", err)
	}
	if payload["hello"] != "world" {
		t.Errorf("payload = %v, want hello=world", payload)
	}
	assertPublished(t, pool, id, true)

	// A second poll must find nothing — published rows are gone from the queue.
	got = nil
	delivered, err = worker.Poll(ctx)
	if err != nil || delivered != 0 || len(got) != 0 {
		t.Fatalf("second poll delivered %d (err %v); want 0 — a published event must not redeliver", delivered, err)
	}
}

// A failing handler must leave the row unpublished, count the attempt, and record the error
// — so it retries — while NOT blocking other events in the same batch.
func TestFailingHandlerRetriesAndDoesNotBlockTheBatch(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	ctx := context.Background()

	poison := seedEvent(t, pool, "booking.failed", `{}`)
	healthy := seedEvent(t, pool, "booking.confirmed", `{}`)

	dispatcher := outbox.NewDispatcher()
	dispatcher.Subscribe("booking.failed", func(_ context.Context, _ outbox.Event) error {
		return errors.New("consumer is down")
	})
	var healthyDelivered int
	dispatcher.Subscribe("booking.confirmed", func(_ context.Context, _ outbox.Event) error {
		healthyDelivered++
		return nil
	})

	worker := outbox.NewWorker(pool, dispatcher)
	delivered, err := worker.Poll(ctx)
	if err != nil {
		t.Fatalf("Poll: %v", err)
	}

	// The healthy event was delivered and published despite its batch-mate failing.
	if delivered != 1 || healthyDelivered != 1 {
		t.Errorf("delivered=%d healthyDelivered=%d, want 1 and 1", delivered, healthyDelivered)
	}
	assertPublished(t, pool, healthy, true)

	// The poison event stayed unpublished, with attempts bumped and the error recorded.
	assertPublished(t, pool, poison, false)
	var attempts int32
	var lastError *string
	if err := pool.QueryRow(ctx, "SELECT attempts, last_error FROM outbox WHERE id=$1", poison).
		Scan(&attempts, &lastError); err != nil {
		t.Fatal(err)
	}
	if attempts != 1 {
		t.Errorf("attempts = %d, want 1", attempts)
	}
	if lastError == nil || *lastError != "consumer is down" {
		t.Errorf("last_error = %v, want \"consumer is down\"", lastError)
	}
}

// SubscribeAll handlers see every event regardless of type — this is how logging and
// analytics attach.
func TestSubscribeAllReceivesEveryEvent(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	ctx := context.Background()

	seedEvent(t, pool, "booking.confirmed", `{}`)
	seedEvent(t, pool, "booking.completed", `{}`)

	var seen int32
	dispatcher := outbox.NewDispatcher()
	dispatcher.SubscribeAll(func(_ context.Context, _ outbox.Event) error {
		atomic.AddInt32(&seen, 1)
		return nil
	})

	worker := outbox.NewWorker(pool, dispatcher)
	if _, err := worker.Poll(ctx); err != nil {
		t.Fatal(err)
	}
	if seen != 2 {
		t.Errorf("SubscribeAll saw %d events, want 2", seen)
	}
}

// THE CONCURRENCY GUARANTEE. Two workers poll the SAME backlog at the SAME time. FOR UPDATE
// SKIP LOCKED must ensure every event is delivered EXACTLY once across both — never twice,
// never zero. Without SKIP LOCKED, both workers would grab the same rows and every consumer
// would fire twice.
func TestSkipLockedPreventsDoubleDelivery(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	ctx := context.Background()

	const total = 50
	for index := range total {
		seedEvent(t, pool, "booking.confirmed", `{}`)
		_ = index
	}

	// One shared counter, incremented atomically by whichever worker delivers each event.
	var deliveries int32
	handler := func(_ context.Context, _ outbox.Event) error {
		atomic.AddInt32(&deliveries, 1)
		return nil
	}

	newWorker := func() *outbox.Worker {
		dispatcher := outbox.NewDispatcher()
		dispatcher.Subscribe("booking.confirmed", handler)
		return outbox.NewWorker(pool, dispatcher, outbox.WithBatchSize(7)) // small batches => real contention
	}
	workerA, workerB := newWorker(), newWorker()

	var wg sync.WaitGroup
	start := make(chan struct{})
	drain := func(worker *outbox.Worker) {
		defer wg.Done()
		<-start
		for {
			delivered, err := worker.Poll(ctx)
			if err != nil {
				t.Errorf("poll: %v", err)
				return
			}
			if delivered == 0 {
				return
			}
		}
	}
	wg.Add(2)
	go drain(workerA)
	go drain(workerB)
	close(start)
	wg.Wait()

	if deliveries != total {
		t.Errorf("delivered %d events across two workers, want exactly %d "+
			"(double delivery => SKIP LOCKED is not doing its job)", deliveries, total)
	}
	var unpublished int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM outbox WHERE published_at IS NULL").Scan(&unpublished); err != nil {
		t.Fatal(err)
	}
	if unpublished != 0 {
		t.Errorf("%d events left unpublished, want 0", unpublished)
	}
}

// The at-least-once contract, made concrete: a handler that fails once then succeeds must
// end up delivering, because the row survives the failure and is retried.
func TestEventSurvivesUntilAHandlerFinallySucceeds(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)
	ctx := context.Background()

	seedEvent(t, pool, "booking.assigned", `{}`)

	var calls int32
	dispatcher := outbox.NewDispatcher()
	dispatcher.Subscribe("booking.assigned", func(_ context.Context, _ outbox.Event) error {
		if atomic.AddInt32(&calls, 1) == 1 {
			return errors.New("transient blip")
		}
		return nil
	})

	worker := outbox.NewWorker(pool, dispatcher)

	delivered, err := worker.Poll(ctx) // first attempt fails
	if err != nil || delivered != 0 {
		t.Fatalf("first poll: delivered %d, err %v; want 0, nil", delivered, err)
	}
	delivered, err = worker.Poll(ctx) // retry succeeds
	if err != nil || delivered != 1 {
		t.Fatalf("second poll: delivered %d, err %v; want 1, nil", delivered, err)
	}
	if calls != 2 {
		t.Errorf("handler called %d times, want 2 (one failure, one success)", calls)
	}
}

// Run stops promptly when its context is cancelled — the graceful-shutdown path.
func TestRunStopsOnContextCancel(t *testing.T) {
	pool := storagetest.NewPool(t, migrationsDir)

	worker := outbox.NewWorker(pool, outbox.NewDispatcher(), outbox.WithInterval(10*time.Millisecond))

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- worker.Run(ctx) }()

	cancel()
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Errorf("Run returned %v, want context.Canceled", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not stop within 2s of cancellation")
	}
}

// ---------------------------------------------------------------------------

func seedEvent(t *testing.T, pool *pgxpool.Pool, eventType, payload string) uuid.UUID {
	t.Helper()
	id := uuid.New()
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO outbox (id, aggregate_type, aggregate_id, event_type, payload)
		 VALUES ($1, 'booking', $2, $3, $4)`,
		id, uuid.New(), eventType, payload); err != nil {
		t.Fatalf("seeding event: %v", err)
	}
	return id
}

func assertPublished(t *testing.T, pool *pgxpool.Pool, id uuid.UUID, want bool) {
	t.Helper()
	var publishedAt *time.Time
	if err := pool.QueryRow(context.Background(), "SELECT published_at FROM outbox WHERE id=$1", id).
		Scan(&publishedAt); err != nil {
		t.Fatal(err)
	}
	if got := publishedAt != nil; got != want {
		t.Errorf("published=%v, want %v", got, want)
	}
}
