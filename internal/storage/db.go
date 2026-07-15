// Package storage owns the database connection and the transaction helper.
//
// This is infrastructure, NOT a domain module. sqlcgen underneath it is the generated
// data-access layer — the modern equivalent of a driver, owned by nobody in particular.
// Each domain module (booking, ledger, …) wraps it with its own service exposing domain
// types, so the module walls of ROADMAP §4.2 still hold: nothing outside a module writes
// that module's aggregate, even though the SQL all lives in one generated package.
package storage

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	pgxuuid "github.com/vgarvardt/pgx-google-uuid/v5"
)

// NewPool opens the connection pool and registers the google/uuid codec on every
// connection.
//
// GO LESSON — why AfterConnect. pgx does not natively know google/uuid; without this hook
// every query passing a uuid.UUID would fail at runtime with "cannot encode". Registering
// the codec per-connection (connections come and go in a pool) is the standard fix, and it
// is why sqlc.yaml can safely map every uuid column to google/uuid.UUID.
func NewPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parsing dsn: %w", err)
	}

	config.AfterConnect = func(_ context.Context, conn *pgx.Conn) error {
		pgxuuid.Register(conn.TypeMap())
		return nil
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("creating pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pinging postgres: %w", err)
	}
	return pool, nil
}

// InTx runs fn inside a single transaction, committing on success and rolling back on any
// error or panic.
//
// GO LESSON — this closure-based helper is the idiomatic Go answer to Spring's
// @Transactional. There is no annotation and no proxy magic: the transaction boundary is
// visible, right here, and fn either sees a committed world or none of its writes survive.
// That is exactly what the booking transition needs — the CAS update, the booking_events
// row, and the outbox row must land together or not at all.
//
// The `defer` with a recover re-panics after rolling back, so a panic mid-transaction
// cannot leave a connection with an open transaction leaking back into the pool.
func InTx(ctx context.Context, pool *pgxpool.Pool, fn func(pgx.Tx) error) (err error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}

	defer func() {
		if p := recover(); p != nil {
			// Best-effort rollback before re-panicking; the panic is the real signal, so a
			// rollback error here has nowhere useful to go.
			if rbErr := tx.Rollback(ctx); rbErr != nil && !isTxClosed(rbErr) {
				_ = rbErr // intentionally discarded: we are already unwinding a panic
			}
			panic(p)
		}
		if err != nil {
			if rbErr := tx.Rollback(ctx); rbErr != nil && !isTxClosed(rbErr) {
				err = fmt.Errorf("%w (rollback also failed: %w)", err, rbErr)
			}
		}
	}()

	if err = fn(tx); err != nil {
		return err
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

func isTxClosed(err error) bool {
	return err != nil && err.Error() == pgx.ErrTxClosed.Error()
}
