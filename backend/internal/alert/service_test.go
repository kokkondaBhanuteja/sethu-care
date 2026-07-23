package alert_test

// The alert model against real PostGIS: the engine's idempotency, the acknowledgement race
// and its audit row, the read-all sweep's badge discipline, the phase-1 subject-id
// resolution, and replay-safe notes.

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/alert"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

type fixture struct {
	pool    *pgxpool.Pool
	service *alert.Service
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	pool := storagetest.NewPool(t, "../../db/migrations")
	return &fixture{pool: pool, service: alert.NewService(pool)}
}

func (fix *fixture) exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	if _, err := fix.pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("seed exec: %v\n  %s", err, sql)
	}
}

func (fix *fixture) count(t *testing.T, sql string, args ...any) int {
	t.Helper()
	var counted int
	if err := fix.pool.QueryRow(context.Background(), sql, args...).Scan(&counted); err != nil {
		t.Fatalf("count query: %v\n  %s", err, sql)
	}
	return counted
}

func (fix *fixture) seedAdmin(t *testing.T, name string) uuid.UUID {
	t.Helper()
	adminID := uuid.New()
	fix.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, $3, 'ADMIN')",
		adminID, "+9198"+adminID.String()[:8], name)
	return adminID
}

// seedEscalatedBooking builds the full spine an escalated booking needs — customer, address,
// catalog row, order, booking, item — plus the CONFIRM/SEARCH/ESCALATE event trail the alert
// detail's history and trigger read.
func (fix *fixture) seedEscalatedBooking(t *testing.T) uuid.UUID {
	t.Helper()
	customerID, addressID := uuid.New(), uuid.New()
	categoryID, serviceID, variantID := uuid.New(), uuid.New(), uuid.New()
	orderID, bookingID := uuid.New(), uuid.New()

	fix.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Asha Customer', 'CUSTOMER')",
		customerID, "+9190"+customerID.String()[:8])
	fix.exec(t, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '1 Test Rd', 'Bengaluru', '560001', ST_MakePoint(77.59, 12.97)::geography)`,
		addressID, customerID)
	fix.exec(t, "INSERT INTO categories (id, name, slug) VALUES ($1, 'AC', $2)", categoryID, "cat-"+categoryID.String()[:8])
	fix.exec(t, "INSERT INTO services (id, category_id, name, slug) VALUES ($1, $2, 'AC Service', $3)",
		serviceID, categoryID, "svc-"+serviceID.String()[:8])
	fix.exec(t, "INSERT INTO service_variants (id, service_id, name, base_price_paise) VALUES ($1, $2, 'Standard', 59900)",
		variantID, serviceID)
	fix.exec(t, "INSERT INTO orders (id, customer_id, status, total_paise) VALUES ($1, $2, 'PENDING', 59900)",
		orderID, customerID)
	fix.exec(t, `INSERT INTO bookings (id, order_id, customer_id, address_id, state, quoted_total_paise)
		VALUES ($1, $2, $3, $4, 'ESCALATED', 59900)`, bookingID, orderID, customerID, addressID)
	fix.exec(t, `INSERT INTO booking_items (booking_id, service_id, variant_id, quantity, line_total_paise)
		VALUES ($1, $2, $3, 1, 59900)`, bookingID, serviceID, variantID)
	for _, transition := range []struct{ from, action, to string }{
		{"DRAFT", "CONFIRM", "CONFIRMED"},
		{"CONFIRMED", "SEARCH", "SEARCHING"},
		{"SEARCHING", "ESCALATE", "ESCALATED"},
	} {
		fix.exec(t, `INSERT INTO booking_events (booking_id, from_state, action, to_state)
			VALUES ($1, $2, $3, $4)`, bookingID, transition.from, transition.action, transition.to)
	}
	return bookingID
}

func TestEscalationEngineIsIdempotent(t *testing.T) {
	fix := newFixture(t)
	ctx := context.Background()
	bookingID := fix.seedEscalatedBooking(t)
	eventID := uuid.New()

	// The same outbox event redelivered, then a DIFFERENT event while the alert is open:
	// neither may produce a second row.
	for _, sourceEventID := range []uuid.UUID{eventID, eventID, uuid.New()} {
		if err := fix.service.RecordBookingEscalation(ctx, sourceEventID, bookingID); err != nil {
			t.Fatalf("RecordBookingEscalation: %v", err)
		}
	}

	page, err := fix.service.List(ctx, alert.Filter{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(page.Alerts) != 1 || page.Total != 1 {
		t.Fatalf("alerts = %d (total %d), want exactly 1", len(page.Alerts), page.Total)
	}
	listed := page.Alerts[0]
	if listed.Kind != alert.KindBookingEscalated || listed.Severity != alert.SeverityCritical {
		t.Errorf("alert = %s/%s, want BOOKING_ESCALATED/CRITICAL", listed.Kind, listed.Severity)
	}
	if !listed.RequiresAcknowledgement || listed.Acknowledgement != nil {
		t.Errorf("acknowledgement state = %v/%v, want required and unclaimed",
			listed.RequiresAcknowledgement, listed.Acknowledgement)
	}
	if listed.SubjectID == nil || *listed.SubjectID != bookingID {
		t.Errorf("subject = %v, want the escalated booking", listed.SubjectID)
	}
	if listed.ServiceName != "AC Service" || listed.City != "Bengaluru" {
		t.Errorf("joined context = %q/%q, want AC Service/Bengaluru", listed.ServiceName, listed.City)
	}

	band, err := fix.service.Band(ctx)
	if err != nil {
		t.Fatalf("Band: %v", err)
	}
	if band.OpenCritical != 1 || len(band.Examples) != 1 {
		t.Fatalf("band = %d criticals, %d examples; want 1 and 1", band.OpenCritical, len(band.Examples))
	}
	if band.Examples[0].SubjectID == nil || *band.Examples[0].SubjectID != bookingID {
		t.Errorf("band example subject = %v, want the booking", band.Examples[0].SubjectID)
	}
}

func TestAcknowledgeRaceReplayAndAudit(t *testing.T) {
	fix := newFixture(t)
	ctx := context.Background()
	bookingID := fix.seedEscalatedBooking(t)
	firstAdmin := fix.seedAdmin(t, "First Admin")
	secondAdmin := fix.seedAdmin(t, "Second Admin")
	if err := fix.service.RecordBookingEscalation(ctx, uuid.New(), bookingID); err != nil {
		t.Fatalf("RecordBookingEscalation: %v", err)
	}
	page, err := fix.service.List(ctx, alert.Filter{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	alertID := page.Alerts[0].ID

	won, wonRace, err := fix.service.Acknowledge(ctx, alertID, firstAdmin)
	if err != nil || !wonRace {
		t.Fatalf("first acknowledge = (%v, %v), want a win", wonRace, err)
	}
	if won.Acknowledgement == nil || won.Acknowledgement.AdminID != firstAdmin || won.Acknowledgement.AdminName != "First Admin" {
		t.Fatalf("acknowledgement = %+v, want First Admin's", won.Acknowledgement)
	}

	auditRows := "SELECT count(*) FROM audit_logs WHERE action = 'ALERT_ACKNOWLEDGE' AND entity_id = $1"
	if counted := fix.count(t, auditRows, alertID); counted != 1 {
		t.Fatalf("audit rows after first acknowledge = %d, want 1", counted)
	}

	// The winner replays after an offline period: still a win, and no second audit row.
	_, replayWon, err := fix.service.Acknowledge(ctx, alertID, firstAdmin)
	if err != nil || !replayWon {
		t.Errorf("replay acknowledge = (%v, %v), want a win", replayWon, err)
	}
	if counted := fix.count(t, auditRows, alertID); counted != 1 {
		t.Errorf("audit rows after replay = %d, want still 1", counted)
	}

	// A second admin arrives late: 200, wonRace false, the first admin's claim stands.
	late, lateWon, err := fix.service.Acknowledge(ctx, alertID, secondAdmin)
	if err != nil || lateWon {
		t.Errorf("late acknowledge = (%v, %v), want a loss without error", lateWon, err)
	}
	if late.Acknowledgement == nil || late.Acknowledgement.AdminID != firstAdmin {
		t.Errorf("late acknowledgement owner = %+v, want First Admin", late.Acknowledgement)
	}

	// Acknowledged alerts leave the needs-action tier...
	unacknowledged := false
	open, err := fix.service.List(ctx, alert.Filter{Acknowledged: &unacknowledged})
	if err != nil {
		t.Fatalf("List unacknowledged: %v", err)
	}
	if len(open.Alerts) != 0 {
		t.Errorf("unacknowledged alerts = %d, want 0 after acknowledgement", len(open.Alerts))
	}
	if count, err := fix.service.CountOpenCritical(ctx); err != nil || count != 0 {
		t.Errorf("open criticals = (%d, %v), want 0", count, err)
	}

	// ...and once closed, the same booking may honestly alert again.
	if err := fix.service.RecordBookingEscalation(ctx, uuid.New(), bookingID); err != nil {
		t.Fatalf("re-escalation: %v", err)
	}
	if count, err := fix.service.CountOpenCritical(ctx); err != nil || count != 1 {
		t.Errorf("open criticals after re-escalation = (%d, %v), want 1", count, err)
	}
}

func TestReadAllSparesTheCriticalTier(t *testing.T) {
	fix := newFixture(t)
	ctx := context.Background()
	bookingID := fix.seedEscalatedBooking(t)
	if err := fix.service.RecordBookingEscalation(ctx, uuid.New(), bookingID); err != nil {
		t.Fatalf("RecordBookingEscalation: %v", err)
	}
	// An informational, subjectless alert (the shape a daily summary would take).
	fix.exec(t, `INSERT INTO alerts (kind, severity, requires_acknowledgement)
		VALUES ('DAILY_SUMMARY', 'INFORMATIONAL', false)`)

	marked, err := fix.service.ReadAll(ctx)
	if err != nil || marked != 1 {
		t.Fatalf("ReadAll = (%d, %v), want exactly the informational row", marked, err)
	}
	// Idempotent: nothing left unread.
	if replayed, err := fix.service.ReadAll(ctx); err != nil || replayed != 0 {
		t.Errorf("ReadAll replay = (%d, %v), want 0", replayed, err)
	}
	// The critical is untouched: still unacknowledged, still unread.
	if counted := fix.count(t,
		"SELECT count(*) FROM alerts WHERE requires_acknowledgement AND acknowledged_at IS NULL AND read_at IS NULL"); counted != 1 {
		t.Errorf("open unread criticals = %d, want 1 — read-all must never silence a critical", counted)
	}
}

func TestGetResolvesTheSubjectIDConvention(t *testing.T) {
	fix := newFixture(t)
	ctx := context.Background()
	bookingID := fix.seedEscalatedBooking(t)
	if err := fix.service.RecordBookingEscalation(ctx, uuid.New(), bookingID); err != nil {
		t.Fatalf("RecordBookingEscalation: %v", err)
	}

	// The phase-1 convention: the booking id resolves to its newest alert.
	detail, err := fix.service.Get(ctx, bookingID)
	if err != nil {
		t.Fatalf("Get by subject id: %v", err)
	}
	if detail.SubjectID == nil || *detail.SubjectID != bookingID {
		t.Fatalf("resolved subject = %v, want the booking", detail.SubjectID)
	}
	if detail.EscalatedFrom != "SEARCHING" {
		t.Errorf("EscalatedFrom = %q, want SEARCHING", detail.EscalatedFrom)
	}
	if len(detail.History) != 3 {
		t.Errorf("history = %d entries, want the 3 booking transitions", len(detail.History))
	}
	if detail.CustomerName != "Asha Customer" || detail.BookingState != "ESCALATED" {
		t.Errorf("related record = %q/%q", detail.CustomerName, detail.BookingState)
	}
	if detail.BookingAmount.Paise() != 59900 {
		t.Errorf("amount = %d paise, want 59900", detail.BookingAmount.Paise())
	}

	// Its own id resolves too, and an unknown id is a clean not-found.
	if _, err := fix.service.Get(ctx, detail.ID); err != nil {
		t.Errorf("Get by alert id: %v", err)
	}
	if _, err := fix.service.Get(ctx, uuid.New()); !errors.Is(err, alert.ErrAlertNotFound) {
		t.Errorf("Get unknown id = %v, want ErrAlertNotFound", err)
	}
}

func TestNotesAreReplaySafe(t *testing.T) {
	fix := newFixture(t)
	ctx := context.Background()
	bookingID := fix.seedEscalatedBooking(t)
	adminID := fix.seedAdmin(t, "Note Taker")
	if err := fix.service.RecordBookingEscalation(ctx, uuid.New(), bookingID); err != nil {
		t.Fatalf("RecordBookingEscalation: %v", err)
	}

	first, err := fix.service.AddNote(ctx, bookingID, adminID, "key-1", "Called the customer.")
	if err != nil {
		t.Fatalf("AddNote: %v", err)
	}
	if first.AuthorName != "Note Taker" || first.Body != "Called the customer." {
		t.Errorf("note = %+v", first)
	}
	replayed, err := fix.service.AddNote(ctx, bookingID, adminID, "key-1", "Called the customer.")
	if err != nil {
		t.Fatalf("AddNote replay: %v", err)
	}
	if replayed.ID != first.ID {
		t.Errorf("replayed note id = %s, want the first attempt's %s", replayed.ID, first.ID)
	}
	second, err := fix.service.AddNote(ctx, bookingID, adminID, "key-2", "Left a voicemail.")
	if err != nil {
		t.Fatalf("AddNote second: %v", err)
	}
	if second.ID == first.ID {
		t.Error("a fresh idempotency key must write a fresh note")
	}
	detail, err := fix.service.Get(ctx, bookingID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if len(detail.Notes) != 2 {
		t.Errorf("notes = %d, want 2", len(detail.Notes))
	}
}

func TestListOrdersNewestFirstAndPaginates(t *testing.T) {
	fix := newFixture(t)
	ctx := context.Background()

	// Three informational alerts a minute apart — the notices tier's ordering.
	base := time.Now().Add(-time.Hour).UTC()
	ids := make([]uuid.UUID, 3)
	for index := range ids {
		ids[index] = uuid.New()
		fix.exec(t, `INSERT INTO alerts (id, kind, severity, requires_acknowledgement, created_at)
			VALUES ($1, 'DAILY_SUMMARY', 'INFORMATIONAL', false, $2)`,
			ids[index], base.Add(time.Duration(index)*time.Minute))
	}

	firstPage, err := fix.service.List(ctx, alert.Filter{Limit: 2})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(firstPage.Alerts) != 2 || firstPage.Total != 3 || firstPage.NextCursor == "" {
		t.Fatalf("first page = %d alerts, total %d, cursor %q", len(firstPage.Alerts), firstPage.Total, firstPage.NextCursor)
	}
	if firstPage.Alerts[0].ID != ids[2] || firstPage.Alerts[1].ID != ids[1] {
		t.Errorf("order = %v then %v, want newest first", firstPage.Alerts[0].ID, firstPage.Alerts[1].ID)
	}
	secondPage, err := fix.service.List(ctx, alert.Filter{Limit: 2, Cursor: firstPage.NextCursor})
	if err != nil {
		t.Fatalf("List page 2: %v", err)
	}
	if len(secondPage.Alerts) != 1 || secondPage.Alerts[0].ID != ids[0] || secondPage.NextCursor != "" {
		t.Errorf("second page = %+v", secondPage)
	}

	if _, err := fix.service.List(ctx, alert.Filter{Cursor: "not-a-cursor"}); !errors.Is(err, alert.ErrInvalidCursor) {
		t.Errorf("bad cursor = %v, want ErrInvalidCursor", err)
	}

	severity := alert.SeverityCritical
	criticalOnly, err := fix.service.List(ctx, alert.Filter{Severity: &severity})
	if err != nil {
		t.Fatalf("List critical: %v", err)
	}
	if len(criticalOnly.Alerts) != 0 || criticalOnly.Total != 0 {
		t.Errorf("critical filter over informationals = %d/%d, want empty", len(criticalOnly.Alerts), criticalOnly.Total)
	}
}
