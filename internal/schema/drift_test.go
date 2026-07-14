// Package schema_test holds the guard that keeps Go's constants and Postgres's CHECK
// constraints from drifting apart.
//
// WHY THIS EXISTS. Our enum policy is "TEXT column + CHECK constraint, with the Go
// constants as the source of truth". That gives two lines of defence: the compiler stops
// Go writing a bad value, and the database stops ANYTHING ELSE writing one — a seed
// script, an ops engineer in psql, an import job, a future service.
//
// But the classic failure of that pattern is silent divergence. Someone adds a Role in Go
// and forgets the migration; or writes a migration and forgets the constant. Nothing fails
// — until a value that is legal in one half of the system is rejected by the other, at
// runtime, in production, on a booking.
//
// So this test reads the CHECK constraints straight out of pg_constraint on a REAL
// Postgres, and asserts each one lists exactly the values its Go enum declares. Add a
// constant without a migration and the build goes red.
package schema_test

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"sort"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/kokkondaBhanuteja/sethu-care/internal/catalog"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/order"
	"github.com/kokkondaBhanuteja/sethu-care/internal/verification"
)

func TestEveryEnumColumnMatchesItsGoConstants(t *testing.T) {
	db := migratedDB(t)

	cases := []struct {
		table  string
		column string
		want   []string
	}{
		{"users", "role", toStrings(identity.AllRoles())},
		{"services", "assignment_mode", toStrings(catalog.AllAssignmentModes())},
		{"question_defs", "kind", toStrings(catalog.AllQuestionKinds())},
		{"orders", "status", toStrings(order.AllStatuses())},
		{"ledger_entries", "kind", toStrings(ledger.AllEntryKinds())},
		{"ledger_entries", "method", toStrings(ledger.AllPaymentMethods())},
		{"otp_challenges", "purpose", toStrings(verification.AllPurposes())},
	}

	for _, tc := range cases {
		t.Run(tc.table+"."+tc.column, func(t *testing.T) {
			got := checkConstraintValues(t, db, tc.table, tc.column)
			if len(got) == 0 {
				t.Fatalf("%s.%s has NO CHECK constraint — the database will accept any string in it",
					tc.table, tc.column)
			}
			assertSameSet(t, fmt.Sprintf("%s.%s", tc.table, tc.column), got, tc.want)
		})
	}
}

// bookings.state is the ONE enum column with no CHECK, and that is deliberate (ROADMAP
// §7a). The state machine is its sole authority, and it enforces far more than a CHECK
// could: not merely "is this a real state" but "is this a LEGAL state to arrive at, from
// where you were, by the action you took". A CHECK would be a second, dumber authority
// saying less — and the two would drift.
//
// This test pins that decision down, so nobody "helpfully" adds the constraint later
// without understanding why it was left out.
func TestBookingStateDeliberatelyHasNoCheckConstraint(t *testing.T) {
	db := migratedDB(t)

	if values := checkConstraintValues(t, db, "bookings", "state"); len(values) > 0 {
		t.Errorf("bookings.state has acquired a CHECK constraint listing %v.\n"+
			"This is deliberate: the state machine is the sole authority (ROADMAP §7a).\n"+
			"A CHECK here enforces less than the machine already does, and the two WILL drift.", values)
	}
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// inArrayValues pulls the quoted literals out of a constraint definition. Postgres
// normalises `col IN ('A','B')` into `col = ANY (ARRAY['A'::text, 'B'::text])`, so we read
// what it actually STORED rather than what we wrote.
var inArrayValues = regexp.MustCompile(`'([^']+)'::text`)

func checkConstraintValues(t *testing.T, db *sql.DB, table, column string) []string {
	t.Helper()

	rows, err := db.Query(`
		SELECT pg_get_constraintdef(c.oid)
		  FROM pg_constraint c
		  JOIN pg_attribute a
		    ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
		 WHERE c.conrelid = $1::regclass
		   AND c.contype  = 'c'
		   AND a.attname  = $2`, table, column)
	if err != nil {
		t.Fatalf("querying constraints for %s.%s: %v", table, column, err)
	}
	// errcheck runs with check-blank: true, so `defer rows.Close()` and even
	// `_ = rows.Close()` are refused. That strictness is deliberate — an ignored error on a
	// money path is a rupee that vanishes — so we handle it rather than relax the rule.
	defer func() {
		if err := rows.Close(); err != nil {
			t.Logf("closing rows: %v", err)
		}
	}()

	var values []string
	for rows.Next() {
		var def string
		if err := rows.Scan(&def); err != nil {
			t.Fatalf("scanning constraint def: %v", err)
		}
		// A column can carry several CHECKs — otp_challenges.purpose has both its value
		// list AND the purpose-matches-booking rule. Only the value list interests us.
		if !regexp.MustCompile(`ANY \(ARRAY\[`).MatchString(def) {
			continue
		}
		for _, m := range inArrayValues.FindAllStringSubmatch(def, -1) {
			values = append(values, m[1])
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterating constraints: %v", err)
	}
	return values
}

func assertSameSet(t *testing.T, what string, got, want []string) {
	t.Helper()

	gotSet, wantSet := map[string]bool{}, map[string]bool{}
	for _, v := range got {
		gotSet[v] = true
	}
	for _, v := range want {
		wantSet[v] = true
	}

	for _, v := range want {
		if !gotSet[v] {
			t.Errorf("%s: Go declares %q but the DB CHECK does NOT allow it — "+
				"you added a constant without a migration. The database will reject this value.", what, v)
		}
	}
	for _, v := range got {
		if !wantSet[v] {
			t.Errorf("%s: the DB CHECK allows %q but Go has no such constant — "+
				"you wrote a migration without adding the constant. Nothing in the code can produce "+
				"or handle this value.", what, v)
		}
	}

	if t.Failed() {
		sort.Strings(got)
		sort.Strings(want)
		t.Logf("  db:  %v", got)
		t.Logf("  go:  %v", want)
	}
}

func toStrings[T ~string](values []T) []string {
	out := make([]string, 0, len(values))
	for _, v := range values {
		out = append(out, string(v))
	}
	return out
}

// migratedDB spins up a REAL PostGIS database and runs every goose migration against it.
// Not a mock, not H2 — the schema under test is the schema that runs in production.
func migratedDB(t *testing.T) *sql.DB {
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

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("opening db: %v", err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Logf("closing db: %v", err)
		}
	})

	goose.SetLogger(goose.NopLogger())
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(db, "../../db/migrations"); err != nil {
		t.Fatalf("running migrations: %v", err)
	}

	return db
}
