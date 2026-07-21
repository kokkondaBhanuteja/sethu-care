package httpapi_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// The manual-assignment flow, end to end over HTTP: a booking reaches SEARCHING, appears in
// the admin queue, an eligible technician is a candidate, and assigning them moves the
// booking to ASSIGNED.
func TestManualAssignmentFlow(t *testing.T) {
	env := newServer(t)
	adminToken := env.staffToken(t, identity.RoleAdmin)

	// A skill, a service that requires it, a variant.
	skillID := uuid.New()
	env.exec(t, "INSERT INTO skills (id, code, name) VALUES ($1, 'AC_REPAIR', 'AC Repair')", skillID)
	catID, svcID, variantID := uuid.New(), uuid.New(), uuid.New()
	env.exec(t, "INSERT INTO categories (id, name, slug) VALUES ($1, 'AC', 'ac')", catID)
	env.exec(t, "INSERT INTO services (id, category_id, name, slug) VALUES ($1, $2, 'AC Service', 'ac-svc')", svcID, catID)
	env.exec(t, "INSERT INTO service_required_skills (service_id, skill_id) VALUES ($1, $2)", svcID, skillID)
	env.exec(t, "INSERT INTO service_variants (id, service_id, name, base_price_paise) VALUES ($1, $2, 'Standard', 59900)", variantID, svcID)

	// A customer in Bengaluru with an address there.
	customerID := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ravi', 'CUSTOMER')", customerID, "+9190"+customerID.String()[:8])
	addressID := uuid.New()
	env.exec(t, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '12 MG Rd', 'Bengaluru', '560001', ST_MakePoint(77.59,12.97)::geography)`, addressID, customerID)
	customerToken := env.token(t, customerID.String(), identity.RoleCustomer)

	// An eligible technician: Bengaluru, online, holds AC_REPAIR.
	techID := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Asha', 'TECHNICIAN')", techID, "+9191"+techID.String()[:8])
	env.exec(t, "INSERT INTO technicians (user_id, city, is_online, shift_start_minute, shift_end_minute) VALUES ($1, 'Bengaluru', true, 0, 1439)", techID)
	env.exec(t, "INSERT INTO technician_skills (technician_id, skill_id) VALUES ($1, $2)", techID, skillID)

	// An INELIGIBLE technician: right city and skill but OFFLINE — must not be a candidate.
	offlineID := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Off', 'TECHNICIAN')", offlineID, "+9192"+offlineID.String()[:8])
	env.exec(t, "INSERT INTO technicians (user_id, city, is_online) VALUES ($1, 'Bengaluru', false)", offlineID)
	env.exec(t, "INSERT INTO technician_skills (technician_id, skill_id) VALUES ($1, $2)", offlineID, skillID)

	// Customer books; admin drives it to SEARCHING (CONFIRM then SEARCH).
	body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, addressID, variantID)
	bookingID := mustString(t, env.do(t, http.MethodPost, "/bookings", body, customerToken).json, "booking_id")
	env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"CONFIRM"}`, customerToken)
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"SEARCH"}`, adminToken); r.code != http.StatusOK {
		t.Fatalf("admin SEARCH = %d; body=%s", r.code, r.body)
	}

	// It shows up in the assignment queue.
	queueResp := env.do(t, http.MethodGet, "/ops/assignment-queue", "", adminToken)
	if queueResp.code != http.StatusOK {
		t.Fatalf("GET queue = %d, want 200", queueResp.code)
	}
	queue := asArray(t, queueResp.json["queue"])
	if len(queue) != 1 || asObject(t, queue[0])["booking_id"] != bookingID {
		t.Fatalf("queue = %v, want the one searching booking", queue)
	}

	// The eligible technician is a candidate; the offline one is not.
	candResp := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID+"/candidates", "", adminToken)
	candidates := asArray(t, candResp.json["candidates"])
	if len(candidates) != 1 {
		t.Fatalf("candidates = %v, want exactly the one eligible technician", candidates)
	}
	if asObject(t, candidates[0])["technician_id"] != techID.String() {
		t.Errorf("candidate = %v, want the online tech %s", candidates[0], techID)
	}

	// A customer may not view the ops queue.
	if r := env.do(t, http.MethodGet, "/ops/assignment-queue", "", customerToken); r.code != http.StatusForbidden {
		t.Errorf("customer GET queue = %d, want 403", r.code)
	}

	// Admin assigns the technician; the booking moves to ASSIGNED.
	assignResp := env.do(t, http.MethodPost, "/ops/bookings/"+bookingID+"/assign",
		fmt.Sprintf(`{"technician_id":%q}`, techID), adminToken)
	if assignResp.code != http.StatusOK {
		t.Fatalf("assign = %d, want 200; body=%s", assignResp.code, assignResp.body)
	}
	if assignResp.json["state"] != "ASSIGNED" {
		t.Errorf("state after assign = %v, want ASSIGNED", assignResp.json["state"])
	}

	// The booking has left the queue.
	queueResp = env.do(t, http.MethodGet, "/ops/assignment-queue", "", adminToken)
	if queue := asArray(t, queueResp.json["queue"]); len(queue) != 0 {
		t.Errorf("queue after assign = %v, want empty", queue)
	}

	// Assigning a nonexistent technician -> 404.
	_ = context.Background()
	newBooking := mustString(t, env.do(t, http.MethodPost, "/bookings", body, customerToken).json, "booking_id")
	env.do(t, http.MethodPost, "/bookings/"+newBooking+"/transitions", `{"action":"CONFIRM"}`, customerToken)
	env.do(t, http.MethodPost, "/bookings/"+newBooking+"/transitions", `{"action":"SEARCH"}`, adminToken)
	if r := env.do(t, http.MethodPost, "/ops/bookings/"+newBooking+"/assign",
		fmt.Sprintf(`{"technician_id":%q}`, uuid.New()), adminToken); r.code != http.StatusNotFound {
		t.Errorf("assign to nonexistent technician = %d, want 404", r.code)
	}
}
