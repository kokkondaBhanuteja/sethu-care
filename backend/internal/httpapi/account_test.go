package httpapi_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// DELETE /me anonymises the caller in place (name scrubbed, phone freed, deleted_at set) rather
// than hard-deleting, because the append-only ledger references the user. Requires auth.
func TestDeleteAccountScrubsUser(t *testing.T) {
	env := newServer(t)
	customer, _ := env.seedCustomerAndAddress(t)
	token := env.token(t, customer, identity.RoleCustomer)

	if r := env.do(t, http.MethodDelete, "/me", "", ""); r.code != http.StatusUnauthorized {
		t.Errorf("delete without token = %d, want 401", r.code)
	}
	if r := env.do(t, http.MethodDelete, "/me", "", token); r.code != http.StatusNoContent {
		t.Fatalf("delete = %d, want 204; body=%s", r.code, r.body)
	}

	var name, phone string
	var deletedAt *time.Time
	if err := env.pool.QueryRow(context.Background(),
		"SELECT name, phone, deleted_at FROM users WHERE id=$1", uuid.MustParse(customer)).
		Scan(&name, &phone, &deletedAt); err != nil {
		t.Fatal(err)
	}
	if name != "Deleted user" || !strings.HasPrefix(phone, "deleted:") || deletedAt == nil {
		t.Errorf("after delete: name=%q phone=%q deleted_at=%v, want scrubbed + marked deleted", name, phone, deletedAt)
	}
}
