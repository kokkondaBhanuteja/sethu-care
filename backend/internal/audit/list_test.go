package audit_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/audit"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

// The audit rows under test are written by the REAL booking service (audit.Record runs inside
// booking.Apply's transaction), so the list is exercised against genuine entries, not
// hand-inserted ones.

type auditListFixture struct {
	pool     *pgxpool.Pool
	bookings *booking.Service
	audit    *audit.Service

	adminID    uuid.UUID
	customerID uuid.UUID
	addressID  uuid.UUID
	variantID  uuid.UUID
}

func newAuditListFixture(t *testing.T) *auditListFixture {
	t.Helper()
	pool := storagetest.NewPool(t, "../../db/migrations")
	fixture := &auditListFixture{pool: pool, bookings: booking.NewService(pool), audit: audit.NewService(pool)}

	fixture.adminID = uuid.New()
	fixture.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ops Admin', 'ADMIN')",
		fixture.adminID, "+9199"+fixture.adminID.String()[:8])
	fixture.customerID = uuid.New()
	fixture.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ravi', 'CUSTOMER')",
		fixture.customerID, "+9190"+fixture.customerID.String()[:8])
	fixture.addressID = uuid.New()
	fixture.exec(t, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '1 Rd', 'Bengaluru', '560001', ST_MakePoint(77.59,12.97)::geography)`,
		fixture.addressID, fixture.customerID)

	categoryID, serviceID := uuid.New(), uuid.New()
	fixture.variantID = uuid.New()
	fixture.exec(t, "INSERT INTO categories (id, name, slug) VALUES ($1, 'AC', 'ac')", categoryID)
	fixture.exec(t, "INSERT INTO services (id, category_id, name, slug) VALUES ($1, $2, 'AC Service', 'ac-svc')", serviceID, categoryID)
	fixture.exec(t, "INSERT INTO service_variants (id, service_id, name, base_price_paise) VALUES ($1, $2, 'Standard', 59900)",
		fixture.variantID, serviceID)
	return fixture
}

func (fixture *auditListFixture) exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	if _, err := fixture.pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("seed exec: %v\n  %s", err, sql)
	}
}

func (fixture *auditListFixture) createBooking(t *testing.T) uuid.UUID {
	t.Helper()
	created, err := fixture.bookings.Create(context.Background(), booking.CreateInput{
		CustomerID: fixture.customerID, AddressID: fixture.addressID, VariantID: fixture.variantID, Quantity: 1,
	})
	if err != nil {
		t.Fatalf("Create booking: %v", err)
	}
	return created.BookingID
}

func (fixture *auditListFixture) applyAs(t *testing.T, bookingID uuid.UUID, action booking.Action, actorID uuid.UUID, role identity.Role) {
	t.Helper()
	if _, err := fixture.bookings.Apply(context.Background(), bookingID, action, booking.TransitionInput{
		Actor: &actorID, ActorRole: role,
	}); err != nil {
		t.Fatalf("%s on %s: %v", action, bookingID, err)
	}
}

// The list carries only admin-actor entries within the console vocabulary — a customer's own
// CONFIRM or CANCEL never appears — newest first, with flattened snapshots.
func TestAuditListScopesToAdminActionsNewestFirst(t *testing.T) {
	fixture := newAuditListFixture(t)
	ctx := context.Background()

	// Customer-driven transitions: audited, but not admin actions — must not appear.
	customerCancelled := fixture.createBooking(t)
	fixture.applyAs(t, customerCancelled, booking.ActionConfirm, fixture.customerID, identity.RoleCustomer)
	fixture.applyAs(t, customerCancelled, booking.ActionCancel, fixture.customerID, identity.RoleCustomer)

	// Admin-driven: SEARCH (redispatch) then CANCEL — both in the vocabulary.
	adminWorked := fixture.createBooking(t)
	fixture.applyAs(t, adminWorked, booking.ActionConfirm, fixture.customerID, identity.RoleCustomer)
	fixture.applyAs(t, adminWorked, booking.ActionSearch, fixture.adminID, identity.RoleAdmin)
	fixture.applyAs(t, adminWorked, booking.ActionCancel, fixture.adminID, identity.RoleAdmin)

	page, err := fixture.audit.List(ctx, audit.ListFilter{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if page.Total != 2 || len(page.Entries) != 2 {
		t.Fatalf("total=%d entries=%d, want 2/2", page.Total, len(page.Entries))
	}
	if page.Entries[0].Action != "CANCEL" || page.Entries[1].Action != "SEARCH" {
		t.Errorf("order = [%s, %s], want newest-first [CANCEL, SEARCH]",
			page.Entries[0].Action, page.Entries[1].Action)
	}
	for _, entry := range page.Entries {
		if entry.AdminID != fixture.adminID || entry.AdminName != "Ops Admin" {
			t.Errorf("entry admin = %s/%s, want the driving admin", entry.AdminID, entry.AdminName)
		}
		if entry.EntityType != "booking" || entry.EntityID != adminWorked {
			t.Errorf("entry target = %s/%s, want booking %s", entry.EntityType, entry.EntityID, adminWorked)
		}
	}
	cancelEntry := page.Entries[0]
	if cancelEntry.Before["state"] != "SEARCHING" || cancelEntry.After["state"] != "CANCELLED" {
		t.Errorf("snapshots = %v -> %v, want SEARCHING -> CANCELLED", cancelEntry.Before, cancelEntry.After)
	}
	if page.RangeFrom == nil || page.RangeTo == nil || page.RangeFrom.After(*page.RangeTo) {
		t.Errorf("range = %v..%v, want an ordered pair", page.RangeFrom, page.RangeTo)
	}
}

func TestAuditListFiltersAndPagination(t *testing.T) {
	fixture := newAuditListFixture(t)
	ctx := context.Background()

	first := fixture.createBooking(t)
	fixture.applyAs(t, first, booking.ActionConfirm, fixture.customerID, identity.RoleCustomer)
	fixture.applyAs(t, first, booking.ActionSearch, fixture.adminID, identity.RoleAdmin)
	second := fixture.createBooking(t)
	fixture.applyAs(t, second, booking.ActionConfirm, fixture.customerID, identity.RoleCustomer)
	fixture.applyAs(t, second, booking.ActionSearch, fixture.adminID, identity.RoleAdmin)
	fixture.applyAs(t, second, booking.ActionCancel, fixture.adminID, identity.RoleAdmin)

	byAction, err := fixture.audit.List(ctx, audit.ListFilter{Action: "CANCEL"})
	if err != nil {
		t.Fatalf("filter by action: %v", err)
	}
	if byAction.Total != 1 || len(byAction.Entries) != 1 || byAction.Entries[0].EntityID != second {
		t.Errorf("action filter = total %d %v", byAction.Total, byAction.Entries)
	}

	byTarget, err := fixture.audit.List(ctx, audit.ListFilter{TargetID: &first})
	if err != nil {
		t.Fatalf("filter by target: %v", err)
	}
	if byTarget.Total != 1 || byTarget.Entries[0].Action != "SEARCH" {
		t.Errorf("target filter = total %d %v", byTarget.Total, byTarget.Entries)
	}

	otherAdmin := uuid.New()
	byAdmin, err := fixture.audit.List(ctx, audit.ListFilter{AdminID: &otherAdmin})
	if err != nil {
		t.Fatalf("filter by admin: %v", err)
	}
	if byAdmin.Total != 0 || len(byAdmin.Entries) != 0 {
		t.Errorf("unknown admin filter = total %d %v", byAdmin.Total, byAdmin.Entries)
	}

	// Keyset pagination: three entries, one per page, total constant, then no cursor.
	var walkedActions []string
	cursor := ""
	for range 3 {
		page, err := fixture.audit.List(ctx, audit.ListFilter{Limit: 1, Cursor: cursor})
		if err != nil {
			t.Fatalf("paged List: %v", err)
		}
		if len(page.Entries) != 1 || page.Total != 3 {
			t.Fatalf("page = %d entries total %d, want 1 of 3", len(page.Entries), page.Total)
		}
		walkedActions = append(walkedActions, page.Entries[0].Action)
		cursor = page.NextCursor
	}
	if cursor != "" {
		t.Errorf("cursor after the last page = %q, want empty", cursor)
	}
	want := []string{"CANCEL", "SEARCH", "SEARCH"}
	for index, action := range want {
		if walkedActions[index] != action {
			t.Errorf("walk[%d] = %s, want %s", index, walkedActions[index], action)
		}
	}

	if _, err := fixture.audit.List(ctx, audit.ListFilter{Cursor: "not-a-cursor"}); !errors.Is(err, audit.ErrInvalidCursor) {
		t.Errorf("junk cursor error = %v, want ErrInvalidCursor", err)
	}
}
