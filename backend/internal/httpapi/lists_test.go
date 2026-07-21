package httpapi_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// A customer sees their own bookings and no one else's.
func TestCustomerBookingList(t *testing.T) {
	env := newServer(t)
	alice, address := env.seedCustomerAndAddress(t)
	variant := env.seedService(t, "599")
	aliceToken := env.token(t, alice, identity.RoleCustomer)

	body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, variant)
	env.do(t, http.MethodPost, "/bookings", body, aliceToken)
	env.do(t, http.MethodPost, "/bookings", body, aliceToken)

	resp := env.do(t, http.MethodGet, "/me/bookings", "", aliceToken)
	if resp.code != http.StatusOK {
		t.Fatalf("GET /me/bookings = %d, want 200", resp.code)
	}
	if list := asArray(t, resp.json["bookings"]); len(list) != 2 {
		t.Errorf("alice sees %v bookings, want 2", list)
	}

	bobToken := env.staffToken(t, identity.RoleCustomer)
	resp = env.do(t, http.MethodGet, "/me/bookings", "", bobToken)
	if list := asArray(t, resp.json["bookings"]); len(list) != 0 {
		t.Errorf("bob sees %v bookings, want 0", list)
	}
}

// A technician whose shift does not cover the job's scheduled time is not a candidate. Made
// deterministic with a fixed scheduled_for (2am IST) rather than depending on wall-clock now.
func TestShiftHoursExcludeOffShiftTechnician(t *testing.T) {
	env := newServer(t)
	adminToken := env.staffToken(t, identity.RoleAdmin)

	skillID := uuid.New()
	env.exec(t, "INSERT INTO skills (id, code, name) VALUES ($1, 'AC_REPAIR', 'AC Repair')", skillID)
	catID, svcID, variantID := uuid.New(), uuid.New(), uuid.New()
	env.exec(t, "INSERT INTO categories (id, name, slug) VALUES ($1, 'AC', 'ac')", catID)
	env.exec(t, "INSERT INTO services (id, category_id, name, slug) VALUES ($1, $2, 'AC Service', 'ac-svc')", svcID, catID)
	env.exec(t, "INSERT INTO service_required_skills (service_id, skill_id) VALUES ($1, $2)", svcID, skillID)
	env.exec(t, "INSERT INTO service_variants (id, service_id, name, base_price_paise) VALUES ($1, $2, 'Standard', 59900)", variantID, svcID)

	customer, address := env.seedCustomerAndAddress(t)
	customerToken := env.token(t, customer, identity.RoleCustomer)

	// On-shift: covers all day. Off-shift: 9am–6pm only (540–1080), so it excludes 2am.
	onShift, offShift := uuid.New(), uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'On', 'TECHNICIAN')", onShift, "+9191"+onShift.String()[:8])
	env.exec(t, "INSERT INTO technicians (user_id, city, is_online, shift_start_minute, shift_end_minute) VALUES ($1, 'Bengaluru', true, 0, 1439)", onShift)
	env.exec(t, "INSERT INTO technician_skills (technician_id, skill_id) VALUES ($1, $2)", onShift, skillID)
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Off', 'TECHNICIAN')", offShift, "+9192"+offShift.String()[:8])
	env.exec(t, "INSERT INTO technicians (user_id, city, is_online, shift_start_minute, shift_end_minute) VALUES ($1, 'Bengaluru', true, 540, 1080)", offShift)
	env.exec(t, "INSERT INTO technician_skills (technician_id, skill_id) VALUES ($1, $2)", offShift, skillID)

	body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, variantID)
	bookingID := mustString(t, env.do(t, http.MethodPost, "/bookings", body, customerToken).json, "booking_id")
	env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"CONFIRM"}`, customerToken)
	env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"SEARCH"}`, adminToken)
	// Schedule the job for 2am IST — inside the on-shift window, outside the 9–6 window.
	env.exec(t, "UPDATE bookings SET scheduled_for = '2024-06-01 02:00:00+05:30' WHERE id=$1", uuid.MustParse(bookingID))

	candResp := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID+"/candidates", "", adminToken)
	candidates := asArray(t, candResp.json["candidates"])
	if len(candidates) != 1 {
		t.Fatalf("candidates = %v, want exactly the on-shift technician", candidates)
	}
	if asObject(t, candidates[0])["technician_id"] != onShift.String() {
		t.Errorf("candidate = %v, want the on-shift tech %s", candidates[0], onShift)
	}
}
