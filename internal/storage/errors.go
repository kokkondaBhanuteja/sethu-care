package storage

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// SQLState constants we act on. The full list is in the Postgres docs; these are the ones a
// service turns into a domain error rather than a 500.
const (
	SQLStateForeignKeyViolation = "23503"
	SQLStateUniqueViolation     = "23505"
	SQLStateCheckViolation      = "23514"
)

// IsSQLState reports whether err is (or wraps) a Postgres error with the given SQLSTATE code.
//
// GO LESSON — errors.As walks the wrapped chain to find a *pgconn.PgError, so this works even
// when a repository has wrapped the driver error with fmt.Errorf("...: %w", err). It lets a
// service translate "you referenced a category that does not exist" (a 23503) into a clean
// 404 instead of leaking a database error as a 500.
func IsSQLState(err error, code string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == code
}
