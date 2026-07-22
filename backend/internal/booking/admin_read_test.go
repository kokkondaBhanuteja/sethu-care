package booking_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

// adminReadFixture is the scaffolding for the console read-model tests: one admin, one
// customer, one catalog entry, bookings minted through the real service so booking_events
// carries the real timeline.
type adminReadFixture struct {
	pool     *pgxpool.Pool
	bookings *booking.Service

	adminID      uuid.UUID
	customerID   uuid.UUID
	addressID    uuid.UUID
	variantID    uuid.UUID
	technicianID uuid.UUID
}

func newAdminReadFixture(t *testing.T) *adminReadFixture {
	t.Helper()
	pool := storagetest.NewPool(t, "../../db/migrations")
	fixture := &adminReadFixture{pool: pool, bookings: booking.NewService(pool)}

	fixture.adminID = uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ops Admin', 'ADMIN')",
		fixture.adminID, "+9199"+fixture.adminID.String()[:8])
	fixture.customerID = uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Meena Kumar', 'CUSTOMER')",
		fixture.customerID, "+9190"+fixture.customerID.String()[:8])
	fixture.addressID = uuid.New()
	exec(t, pool, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '12 Lake Rd', 'Bengaluru', '560001', ST_MakePoint(77.59,12.97)::geography)`,
		fixture.addressID, fixture.customerID)

	categoryID, serviceID := uuid.New(), uuid.New()
	fixture.variantID = uuid.New()
	exec(t, pool, "INSERT INTO categories (id, name, slug) VALUES ($1, 'AC', 'ac')", categoryID)
	exec(t, pool, "INSERT INTO services (id, category_id, name, slug) VALUES ($1, $2, 'AC Service', 'ac-svc')", serviceID, categoryID)
	exec(t, pool, "INSERT INTO service_variants (id, service_id, name, base_price_paise) VALUES ($1, $2, 'Standard', 59900)",
		fixture.variantID, serviceID)

	fixture.technicianID = uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Tessa Tech', 'TECHNICIAN')",
		fixture.technicianID, "+9191"+fixture.technicianID.String()[:8])
	exec(t, pool, "INSERT INTO technicians (user_id, city, is_online) VALUES ($1, 'Bengaluru', true)", fixture.technicianID)
	return fixture
}

func (fixture *adminReadFixture) create(t *testing.T) uuid.UUID {
	t.Helper()
	created, err := fixture.bookings.Create(context.Background(), booking.CreateInput{
		CustomerID: fixture.customerID, AddressID: fixture.addressID, VariantID: fixture.variantID, Quantity: 1,
	})
	if err != nil {
		t.Fatalf("Create booking: %v", err)
	}
	return created.BookingID
}

func (fixture *adminReadFixture) apply(t *testing.T, bookingID uuid.UUID, action booking.Action) {
	t.Helper()
	input := booking.TransitionInput{Actor: &fixture.adminID, ActorRole: identity.RoleAdmin}
	if action == booking.ActionAssign {
		input.AssignTechnician = &fixture.technicianID
	}
	if _, err := fixture.bookings.Apply(context.Background(), bookingID, action, input); err != nil {
		t.Fatalf("%s on %s: %v", action, bookingID, err)
	}
}

func (fixture *adminReadFixture) drive(t *testing.T, bookingID uuid.UUID, actions ...booking.Action) {
	t.Helper()
	for _, action := range actions {
		fixture.apply(t, bookingID, action)
	}
}

// seedConsoleWorld mints one booking per segment condition and returns them:
// a SEARCHING one, an ESCALATED one, a COMPLETED one (with a 5-star review), a CANCELLED one.
func (fixture *adminReadFixture) seedConsoleWorld(t *testing.T) (searching, escalated, completed, cancelled uuid.UUID) {
	t.Helper()
	searching = fixture.create(t)
	fixture.drive(t, searching, booking.ActionConfirm, booking.ActionSearch)

	escalated = fixture.create(t)
	fixture.drive(t, escalated, booking.ActionConfirm, booking.ActionSearch, booking.ActionEscalate)

	completed = fixture.create(t)
	fixture.drive(t, completed, booking.ActionConfirm, booking.ActionSearch, booking.ActionAssign,
		booking.ActionDepart, booking.ActionArrive, booking.ActionVerifyStart,
		booking.ActionRequestCompletion, booking.ActionVerifyCompletion)
	exec(t, fixture.pool, "INSERT INTO reviews (booking_id, customer_id, technician_id, rating) VALUES ($1, $2, $3, 5)",
		completed, fixture.customerID, fixture.technicianID)

	cancelled = fixture.create(t)
	fixture.drive(t, cancelled, booking.ActionConfirm, booking.ActionCancel)
	return searching, escalated, completed, cancelled
}

func TestAdminListSegmentsCountsAndStateNarrowing(t *testing.T) {
	fixture := newAdminReadFixture(t)
	ctx := context.Background()
	searching, escalated, completed, _ := fixture.seedConsoleWorld(t)

	page, err := fixture.bookings.AdminList(ctx, booking.AdminListInput{})
	if err != nil {
		t.Fatalf("AdminList: %v", err)
	}
	if len(page.Items) != 2 {
		t.Fatalf("active segment has %d items, want 2", len(page.Items))
	}
	// Newest-created first: escalated was created after searching.
	if page.Items[0].BookingID != escalated || page.Items[1].BookingID != searching {
		t.Errorf("active order = [%s, %s], want [%s, %s]",
			page.Items[0].BookingID, page.Items[1].BookingID, escalated, searching)
	}
	if page.Counts.Active != 2 || page.Counts.Completed != 1 || page.Counts.Cancelled != 1 {
		t.Errorf("counts = %+v, want active=2 completed=1 cancelled=1", page.Counts)
	}
	if !page.Counts.ActiveHasEscalation {
		t.Error("activeHasEscalation = false with an ESCALATED booking present")
	}
	if page.Total != 2 || page.IsAcrossSegments {
		t.Errorf("total=%d isAcrossSegments=%v, want 2/false", page.Total, page.IsAcrossSegments)
	}

	completedPage, err := fixture.bookings.AdminList(ctx, booking.AdminListInput{Segment: booking.AdminSegmentCompleted})
	if err != nil {
		t.Fatalf("completed segment: %v", err)
	}
	if len(completedPage.Items) != 1 || completedPage.Items[0].BookingID != completed {
		t.Fatalf("completed segment = %v", completedPage.Items)
	}
	completedItem := completedPage.Items[0]
	if completedItem.TechnicianName == nil || *completedItem.TechnicianName != "Tessa Tech" {
		t.Errorf("completed technician = %v, want Tessa Tech", completedItem.TechnicianName)
	}
	if completedItem.ReviewRating == nil || *completedItem.ReviewRating != 5 {
		t.Errorf("completed review rating = %v, want 5", completedItem.ReviewRating)
	}
	if completedItem.Amount.Paise() != 59900 {
		t.Errorf("amount = %d, want 59900", completedItem.Amount.Paise())
	}

	narrowed, err := fixture.bookings.AdminList(ctx, booking.AdminListInput{
		Segment: booking.AdminSegmentActive,
		States:  []booking.State{booking.StateEscalated},
	})
	if err != nil {
		t.Fatalf("state narrowing: %v", err)
	}
	if len(narrowed.Items) != 1 || narrowed.Items[0].BookingID != escalated {
		t.Errorf("narrowed to ESCALATED = %v", narrowed.Items)
	}
	if narrowed.Total != 1 {
		t.Errorf("narrowed total = %d, want 1", narrowed.Total)
	}
}

func TestAdminListSearchSpansSegmentsAndMatchesReference(t *testing.T) {
	fixture := newAdminReadFixture(t)
	ctx := context.Background()
	_, _, completed, _ := fixture.seedConsoleWorld(t)

	byName, err := fixture.bookings.AdminList(ctx, booking.AdminListInput{Search: "Meena"})
	if err != nil {
		t.Fatalf("search by name: %v", err)
	}
	if !byName.IsAcrossSegments {
		t.Error("a search must span segments")
	}
	if len(byName.Items) != 4 {
		t.Errorf("search by customer name found %d, want all 4", len(byName.Items))
	}

	// The operator-facing reference is the id's first 8 hex digits, decorated "#B-XXXXXXXX".
	reference := "#B-" + strings.ToUpper(completed.String()[:8])
	byReference, err := fixture.bookings.AdminList(ctx, booking.AdminListInput{Search: reference})
	if err != nil {
		t.Fatalf("search by reference: %v", err)
	}
	if len(byReference.Items) != 1 || byReference.Items[0].BookingID != completed {
		t.Errorf("search %q = %v, want exactly %s", reference, byReference.Items, completed)
	}

	byPhone, err := fixture.bookings.AdminList(ctx, booking.AdminListInput{Search: "+9190"})
	if err != nil {
		t.Fatalf("search by phone: %v", err)
	}
	if len(byPhone.Items) != 4 {
		t.Errorf("search by phone prefix found %d, want 4", len(byPhone.Items))
	}
}

func TestAdminListCursorWalksNewestFirst(t *testing.T) {
	fixture := newAdminReadFixture(t)
	ctx := context.Background()
	searching, escalated, _, _ := fixture.seedConsoleWorld(t)

	firstPage, err := fixture.bookings.AdminList(ctx, booking.AdminListInput{Limit: 1})
	if err != nil {
		t.Fatalf("first page: %v", err)
	}
	if len(firstPage.Items) != 1 || firstPage.Items[0].BookingID != escalated {
		t.Fatalf("first page = %v, want [%s]", firstPage.Items, escalated)
	}
	if firstPage.NextCursor == "" {
		t.Fatal("first page has no next cursor")
	}
	secondPage, err := fixture.bookings.AdminList(ctx, booking.AdminListInput{Limit: 1, Cursor: firstPage.NextCursor})
	if err != nil {
		t.Fatalf("second page: %v", err)
	}
	if len(secondPage.Items) != 1 || secondPage.Items[0].BookingID != searching {
		t.Fatalf("second page = %v, want [%s]", secondPage.Items, searching)
	}

	if _, err := fixture.bookings.AdminList(ctx, booking.AdminListInput{Cursor: "garbage"}); !errors.Is(err, booking.ErrInvalidCursor) {
		t.Errorf("junk cursor error = %v, want ErrInvalidCursor", err)
	}
}

func TestAdminDetailCarriesTimelineAndJoins(t *testing.T) {
	fixture := newAdminReadFixture(t)
	ctx := context.Background()
	_, _, completed, _ := fixture.seedConsoleWorld(t)

	detail, err := fixture.bookings.AdminDetailByID(ctx, completed)
	if err != nil {
		t.Fatalf("AdminDetailByID: %v", err)
	}
	if detail.State != booking.StateCompleted {
		t.Errorf("state = %s, want COMPLETED", detail.State)
	}
	if detail.CustomerName != "Meena Kumar" || detail.CustomerBookingCount != 4 {
		t.Errorf("customer = %s with %d bookings, want Meena Kumar with 4", detail.CustomerName, detail.CustomerBookingCount)
	}
	if detail.ServiceName != "AC Service" || detail.City != "Bengaluru" || detail.AddressLine1 != "12 Lake Rd" {
		t.Errorf("display joins = %s / %s / %s", detail.ServiceName, detail.City, detail.AddressLine1)
	}
	if detail.TechnicianName == nil || *detail.TechnicianName != "Tessa Tech" {
		t.Errorf("technician = %v, want Tessa Tech", detail.TechnicianName)
	}
	if detail.TechnicianRating != 5 {
		t.Errorf("technician rating = %v, want the seeded default 5.00", detail.TechnicianRating)
	}
	if detail.Amount.Paise() != 59900 {
		t.Errorf("amount = %d, want 59900", detail.Amount.Paise())
	}

	wantActions := []booking.Action{
		booking.ActionConfirm, booking.ActionSearch, booking.ActionAssign, booking.ActionDepart,
		booking.ActionArrive, booking.ActionVerifyStart, booking.ActionRequestCompletion,
		booking.ActionVerifyCompletion,
	}
	if len(detail.Timeline) != len(wantActions) {
		t.Fatalf("timeline has %d entries, want %d", len(detail.Timeline), len(wantActions))
	}
	for index, wantAction := range wantActions {
		entry := detail.Timeline[index]
		if entry.Action != wantAction {
			t.Errorf("timeline[%d] = %s, want %s", index, entry.Action, wantAction)
		}
		if entry.ActorName == nil || *entry.ActorName != "Ops Admin" {
			t.Errorf("timeline[%d] actor = %v, want the driving admin", index, entry.ActorName)
		}
	}
	if detail.Version != int64(len(wantActions)) {
		t.Errorf("version = %d, want %d (one CAS per transition)", detail.Version, len(wantActions))
	}

	if _, err := fixture.bookings.AdminDetailByID(ctx, uuid.New()); !errors.Is(err, booking.ErrBookingNotFound) {
		t.Errorf("missing booking error = %v, want ErrBookingNotFound", err)
	}
}
