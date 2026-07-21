// Package storagetest spins up a real PostGIS database for integration tests and runs every
// migration against it. No H2, no mocks — the schema under test is the schema that runs in
// production, and the google/uuid codec is registered exactly as it is in production.
//
// It lives in its own package (not a _test.go file) so any module's tests can import it.
package storagetest

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver goose needs
	"github.com/pressly/goose/v3"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
)

// NewPool starts a PostGIS container, migrates it, and returns a ready pool. Everything is
// registered for cleanup via t.Cleanup, so callers write no teardown.
func NewPool(t *testing.T, migrationsDir string) *pgxpool.Pool {
	t.Helper()

	ctx := context.Background()

	container, err := postgres.Run(ctx,
		"postgis/postgis:16-3.4",
		postgres.WithDatabase("sethu"),
		postgres.WithUsername("sethu"),
		postgres.WithPassword("sethu"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("starting postgis container (is Docker running?): %v", err)
	}
	t.Cleanup(func() {
		if err := testcontainers.TerminateContainer(container); err != nil {
			t.Logf("terminating container: %v", err)
		}
	})

	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("connection string: %v", err)
	}

	runMigrations(t, dsn, migrationsDir)

	pool, err := storage.NewPool(ctx, dsn)
	if err != nil {
		t.Fatalf("creating pool: %v", err)
	}
	t.Cleanup(pool.Close)

	return pool
}

func runMigrations(t *testing.T, dsn, dir string) {
	t.Helper()

	db, err := goose.OpenDBWithDriver("pgx", dsn)
	if err != nil {
		t.Fatalf("opening db for migrations: %v", err)
	}
	defer func() {
		if err := db.Close(); err != nil {
			t.Logf("closing migration db: %v", err)
		}
	}()

	goose.SetLogger(goose.NopLogger())
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(db, dir); err != nil {
		t.Fatalf("running migrations: %v", err)
	}
}
