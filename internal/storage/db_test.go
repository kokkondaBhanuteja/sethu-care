package storage_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

// This is the guarantee the whole booking transition rests on: everything inside one InTx
// lands together or not at all. booking.Apply does its CAS, its booking_events insert and
// its outbox insert in a single InTx — so proving InTx rolls back multi-statement work
// proves that a failure at the last step cannot leave a half-applied transition (a bumped
// booking with no event, or an event with no outbox row).

func TestInTxRollsBackEveryWriteWhenFnErrorsLate(t *testing.T) {
	pool := storagetest.NewPool(t, "../../db/migrations")
	ctx := context.Background()

	id := uuid.New()
	sentinel := errors.New("boom, after the writes")

	err := storage.InTx(ctx, pool, func(tx pgx.Tx) error {
		// Two successful writes to two different tables...
		if _, execErr := tx.Exec(ctx,
			`INSERT INTO outbox (id, aggregate_type, aggregate_id, event_type, payload)
			 VALUES ($1, 'booking', $1, 'booking.confirmed', '{}')`, id); execErr != nil {
			return execErr
		}
		if _, execErr := tx.Exec(ctx,
			`INSERT INTO categories (name, slug) VALUES ('X', $1)`, id.String()); execErr != nil {
			return execErr
		}
		// ...then fail. Both writes must vanish.
		return sentinel
	})

	if !errors.Is(err, sentinel) {
		t.Fatalf("InTx error = %v, want the sentinel", err)
	}

	assertRowCount(t, pool, "SELECT count(*) FROM outbox WHERE aggregate_id=$1", id, 0)
	assertRowCount(t, pool, "SELECT count(*) FROM categories WHERE slug=$1", id.String(), 0)
}

func TestInTxCommitsEveryWriteOnSuccess(t *testing.T) {
	pool := storagetest.NewPool(t, "../../db/migrations")
	ctx := context.Background()

	id := uuid.New()
	err := storage.InTx(ctx, pool, func(tx pgx.Tx) error {
		_, execErr := tx.Exec(ctx,
			`INSERT INTO outbox (id, aggregate_type, aggregate_id, event_type, payload)
			 VALUES ($1, 'booking', $1, 'booking.confirmed', '{}')`, id)
		return execErr
	})
	if err != nil {
		t.Fatalf("InTx returned error on success path: %v", err)
	}
	assertRowCount(t, pool, "SELECT count(*) FROM outbox WHERE aggregate_id=$1", id, 1)
}

// A panic inside the transaction must roll back AND re-panic — a swallowed panic that
// committed would be far worse than a crash.
func TestInTxRollsBackAndRepanicsOnPanic(t *testing.T) {
	pool := storagetest.NewPool(t, "../../db/migrations")
	ctx := context.Background()
	id := uuid.New()

	func() {
		defer func() {
			if r := recover(); r == nil {
				t.Error("expected InTx to re-panic; it swallowed the panic")
			}
		}()
		//nolint:errcheck // InTx re-panics below, so its error return is never reached
		storage.InTx(ctx, pool, func(tx pgx.Tx) error {
			if _, execErr := tx.Exec(ctx,
				`INSERT INTO outbox (id, aggregate_type, aggregate_id, event_type, payload)
				 VALUES ($1, 'booking', $1, 'x', '{}')`, id); execErr != nil {
				t.Logf("insert before panic: %v", execErr)
			}
			panic("mid-transaction panic")
		})
	}()

	assertRowCount(t, pool, "SELECT count(*) FROM outbox WHERE aggregate_id=$1", id, 0)
}

func assertRowCount(t *testing.T, pool interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, sql string, arg any, want int) {
	t.Helper()
	var got int
	if err := pool.QueryRow(context.Background(), sql, arg).Scan(&got); err != nil {
		t.Fatalf("counting rows: %v", err)
	}
	if got != want {
		t.Errorf("row count = %d, want %d", got, want)
	}
}
