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
	"fmt"
	"regexp"
	"sort"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/adminaccount"
	"github.com/kokkondaBhanuteja/sethu-care/internal/alert"
	"github.com/kokkondaBhanuteja/sethu-care/internal/audit"
	"github.com/kokkondaBhanuteja/sethu-care/internal/catalog"
	"github.com/kokkondaBhanuteja/sethu-care/internal/gateway"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/notifications"
	"github.com/kokkondaBhanuteja/sethu-care/internal/order"
	"github.com/kokkondaBhanuteja/sethu-care/internal/providerops"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
	"github.com/kokkondaBhanuteja/sethu-care/internal/verification"
)

func TestEveryEnumColumnMatchesItsGoConstants(t *testing.T) {
	pool := storagetest.NewPool(t, "../../db/migrations")

	cases := []struct {
		table  string
		column string
		want   []string
	}{
		{"users", "role", toStrings(identity.AllRoles())},
		{"admin_devices", "device_type", toStrings(adminaccount.AllDeviceTypes())},
		{"admin_settings", "appearance", toStrings(adminaccount.AllAppearanceModes())},
		{"services", "assignment_mode", toStrings(catalog.AllAssignmentModes())},
		{"question_defs", "kind", toStrings(catalog.AllQuestionKinds())},
		{"orders", "status", toStrings(order.AllStatuses())},
		{"ledger_entries", "kind", toStrings(ledger.AllEntryKinds())},
		{"ledger_entries", "method", toStrings(ledger.AllPaymentMethods())},
		{"payments", "status", toStrings(ledger.AllPaymentStatuses())},
		{"otp_challenges", "purpose", toStrings(verification.AllPurposes())},
		{"work_photos", "kind", toStrings(verification.AllWorkPhotoKinds())},
		{"notification_log", "channel", toStrings(notifications.AllChannels())},
		{"audit_logs", "actor_kind", toStrings(audit.AllActorKinds())},
		{"payment_gateway_events", "status", toStrings(gateway.AllStatuses())},
		{"alerts", "kind", toStrings(alert.AllKinds())},
		{"alerts", "severity", toStrings(alert.AllSeverities())},
		{"alerts", "subject_kind", toStrings(alert.AllSubjectKinds())},
		{"provider_admin_states", "standing", toStrings(providerops.AllStandings())},
		{"provider_admin_states", "reason_code", toStrings(providerops.AllSuspendReasons())},
		{"provider_applications", "status", toStrings(providerops.AllApplicationStatuses())},
		{"provider_applications", "decision_reason_code", toStrings(providerops.AllRejectReasons())},
		{"provider_application_documents", "document_type", toStrings(providerops.AllDocumentTypes())},
		{"provider_application_documents", "validation", toStrings(providerops.AllDocumentValidations())},
	}

	for _, tc := range cases {
		t.Run(tc.table+"."+tc.column, func(t *testing.T) {
			got := checkConstraintValues(t, pool, tc.table, tc.column)
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
	pool := storagetest.NewPool(t, "../../db/migrations")

	if values := checkConstraintValues(t, pool, "bookings", "state"); len(values) > 0 {
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

func checkConstraintValues(t *testing.T, pool *pgxpool.Pool, table, column string) []string {
	t.Helper()

	rows, err := pool.Query(context.Background(), `
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
	defer rows.Close() // pgx.Rows.Close() returns nothing, so errcheck is satisfied

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
		for _, match := range inArrayValues.FindAllStringSubmatch(def, -1) {
			values = append(values, match[1])
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
	for _, value := range got {
		gotSet[value] = true
	}
	for _, value := range want {
		wantSet[value] = true
	}

	for _, value := range want {
		if !gotSet[value] {
			t.Errorf("%s: Go declares %q but the DB CHECK does NOT allow it — "+
				"you added a constant without a migration. The database will reject this value.", what, value)
		}
	}
	for _, value := range got {
		if !wantSet[value] {
			t.Errorf("%s: the DB CHECK allows %q but Go has no such constant — "+
				"you wrote a migration without adding the constant. Nothing in the code can produce "+
				"or handle this value.", what, value)
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
	for _, value := range values {
		out = append(out, string(value))
	}
	return out
}
