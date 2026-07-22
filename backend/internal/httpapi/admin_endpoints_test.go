package httpapi_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// End-to-end coverage for the Phase-1 admin console operations, over the same server the
// other transport tests use. The still-501 admin operations are covered by admin_test.go.

// seedSearchingBooking drives a fresh booking to SEARCHING through the public API and
// returns its id plus the tokens used.
func seedSearchingBooking(t *testing.T, env *testEnv) (bookingID, customerToken, adminToken string) {
	t.Helper()
	customer, address := env.seedCustomerAndAddress(t)
	variant := env.seedService(t, "599")
	customerToken = env.token(t, customer, identity.RoleCustomer)
	adminToken = env.staffToken(t, identity.RoleAdmin)

	body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, variant)
	bookingID = mustString(t, env.do(t, http.MethodPost, "/bookings", body, customerToken).json, "booking_id")
	env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"CONFIRM"}`, customerToken)
	env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"SEARCH"}`, adminToken)
	return bookingID, customerToken, adminToken
}

func seedOnlineTechnician(t *testing.T, env *testEnv, name string) uuid.UUID {
	t.Helper()
	technicianID := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, $3, 'TECHNICIAN')",
		technicianID, "+9191"+technicianID.String()[:8], name)
	env.exec(t, "INSERT INTO technicians (user_id, city, is_online) VALUES ($1, 'Bengaluru', true)", technicianID)
	return technicianID
}

// The navigation badges: needsAttention counts the real ops queue; the counters no engine
// backs yet are real zeros.
func TestAdminShellCounters(t *testing.T) {
	env := newServer(t)
	_, _, adminToken := seedSearchingBooking(t, env)

	resp := env.do(t, http.MethodGet, "/ops/shell-counters", "", adminToken)
	if resp.code != http.StatusOK {
		t.Fatalf("GET /ops/shell-counters = %d: %s", resp.code, resp.body)
	}
	if got := resp.json["needsAttention"]; got != float64(1) {
		t.Errorf("needsAttention = %v, want 1", got)
	}
	for _, zeroed := range []string{"criticalAlerts", "pendingApplications", "openTickets"} {
		if got := resp.json[zeroed]; got != float64(0) {
			t.Errorf("%s = %v, want the honest 0", zeroed, got)
		}
	}
}

// The attention queue names the diagnosis and the reference; the activity feed names the
// transition after an assignment.
func TestAdminAttentionQueueAndActivityFeed(t *testing.T) {
	env := newServer(t)
	bookingID, _, adminToken := seedSearchingBooking(t, env)

	resp := env.do(t, http.MethodGet, "/ops/dashboard/attention", "", adminToken)
	if resp.code != http.StatusOK {
		t.Fatalf("GET /ops/dashboard/attention = %d: %s", resp.code, resp.body)
	}
	items := asArray(t, resp.json["items"])
	if len(items) != 1 {
		t.Fatalf("attention items = %v, want exactly the searching booking", items)
	}
	item := asObject(t, items[0])
	if item["bookingId"] != bookingID {
		t.Errorf("bookingId = %v, want %v", item["bookingId"], bookingID)
	}
	if item["priority"] != "failed_assignment" {
		t.Errorf("priority = %v, want failed_assignment", item["priority"])
	}
	if item["providerState"] != "unassigned" || item["providerName"] != nil {
		t.Errorf("provider column = %v/%v, want unassigned/null", item["providerState"], item["providerName"])
	}
	// The reference is the id's first 8 hex digits uppercased, decorated "#B-XXXXXXXX".
	if gotRef, isString := item["bookingRef"].(string); !isString || len(gotRef) != 11 || gotRef[:3] != "#B-" {
		t.Errorf("bookingRef = %v, want the #B-XXXXXXXX shape", item["bookingRef"])
	}
	counts := asObject(t, resp.json["counts"])
	if counts["all"] != float64(1) || counts["unassigned"] != float64(1) || counts["sla"] != float64(0) {
		t.Errorf("counts = %v", counts)
	}

	technicianID := seedOnlineTechnician(t, env, "Tessa Tech")
	assignBody := fmt.Sprintf(`{"technician_id":%q}`, technicianID)
	if assign := env.do(t, http.MethodPost, "/ops/bookings/"+bookingID+"/assign", assignBody, adminToken); assign.code != http.StatusOK {
		t.Fatalf("assign = %d: %s", assign.code, assign.body)
	}

	feed := env.do(t, http.MethodGet, "/ops/activity?limit=5", "", adminToken)
	if feed.code != http.StatusOK {
		t.Fatalf("GET /ops/activity = %d: %s", feed.code, feed.body)
	}
	feedItems := asArray(t, feed.json["items"])
	if len(feedItems) != 1 {
		t.Fatalf("activity items = %v, want exactly the assignment", feedItems)
	}
	entry := asObject(t, feedItems[0])
	if entry["kind"] != "assigned" || entry["providerName"] != "Tessa Tech" {
		t.Errorf("activity entry = %v, want an assigned entry naming Tessa Tech", entry)
	}
}

// The summary serves real aggregates with eight-point sparklines.
func TestAdminDashboardSummary(t *testing.T) {
	env := newServer(t)
	_, _, adminToken := seedSearchingBooking(t, env)

	resp := env.do(t, http.MethodGet, "/ops/dashboard/summary?period=today", "", adminToken)
	if resp.code != http.StatusOK {
		t.Fatalf("GET /ops/dashboard/summary = %d: %s", resp.code, resp.body)
	}
	if got := resp.json["bookings"]; got != float64(1) {
		t.Errorf("bookings = %v, want 1", got)
	}
	if got := resp.json["revenuePaise"]; got != float64(0) {
		t.Errorf("revenuePaise = %v, want 0 (nothing captured)", got)
	}
	sparklines := asObject(t, resp.json["sparklines"])
	for _, metric := range []string{"bookings", "revenue", "completion", "avgAssign"} {
		points := asArray(t, sparklines[metric])
		if len(points) != 8 {
			t.Errorf("sparklines.%s has %d points, want 8", metric, len(points))
		}
	}
	deltas := asObject(t, resp.json["bookingsDelta"])
	if deltas["value"] != float64(1) || deltas["isGood"] != true {
		t.Errorf("bookingsDelta = %v, want +1/good", deltas)
	}
}

// The console list and record: segments, search, the derived reference, the timeline, and
// the designed 404.
func TestAdminBookingsListAndDetail(t *testing.T) {
	env := newServer(t)
	bookingID, _, adminToken := seedSearchingBooking(t, env)

	list := env.do(t, http.MethodGet, "/ops/bookings?segment=active", "", adminToken)
	if list.code != http.StatusOK {
		t.Fatalf("GET /ops/bookings = %d: %s", list.code, list.body)
	}
	items := asArray(t, list.json["items"])
	if len(items) != 1 {
		t.Fatalf("active list = %v, want the one booking", items)
	}
	row := asObject(t, items[0])
	if row["id"] != bookingID || row["state"] != "SEARCHING" {
		t.Errorf("row = %v, want the SEARCHING booking", row)
	}
	note := asObject(t, row["providerNote"])
	if note["kind"] != "unassignedFor" {
		t.Errorf("providerNote = %v, want an unassignedFor note", note)
	}
	counts := asObject(t, list.json["counts"])
	if counts["active"] != float64(1) || counts["completed"] != float64(0) {
		t.Errorf("counts = %v", counts)
	}

	// A search spans segments and finds the booking by the customer's name (seeded 'C').
	search := env.do(t, http.MethodGet, "/ops/bookings?q=C", "", adminToken)
	if search.code != http.StatusOK {
		t.Fatalf("search = %d: %s", search.code, search.body)
	}
	if search.json["isAcrossSegments"] != true || len(asArray(t, search.json["items"])) != 1 {
		t.Errorf("search result = %v", search.json)
	}

	detail := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID, "", adminToken)
	if detail.code != http.StatusOK {
		t.Fatalf("GET /ops/bookings/{id} = %d: %s", detail.code, detail.body)
	}
	if detail.json["id"] != bookingID || detail.json["state"] != "SEARCHING" {
		t.Errorf("detail = %v/%v", detail.json["id"], detail.json["state"])
	}
	timeline := asArray(t, detail.json["timeline"])
	if len(timeline) != 2 {
		t.Fatalf("timeline = %v, want [created, searching]", timeline)
	}
	if asObject(t, timeline[0])["kind"] != "created" || asObject(t, timeline[1])["kind"] != "searching" {
		t.Errorf("timeline kinds = %v", timeline)
	}
	if version := detail.json["version"]; version != float64(2) {
		t.Errorf("version = %v, want 2 (two transitions)", version)
	}
	customer := asObject(t, detail.json["customer"])
	if customer["bookingCount"] != float64(1) {
		t.Errorf("customer bookingCount = %v, want 1", customer["bookingCount"])
	}

	if missing := env.do(t, http.MethodGet, "/ops/bookings/"+uuid.NewString(), "", adminToken); missing.code != http.StatusNotFound {
		t.Errorf("unknown booking = %d, want 404", missing.code)
	}
	if junk := env.do(t, http.MethodGet, "/ops/bookings/not-a-uuid", "", adminToken); junk.code != http.StatusBadRequest {
		t.Errorf("malformed id = %d, want 400", junk.code)
	}
}

// The audit list translates recorded admin actions into the console vocabulary, and filters
// on targets nothing records yet are honestly empty.
func TestAdminAuditList(t *testing.T) {
	env := newServer(t)
	bookingID, _, adminToken := seedSearchingBooking(t, env)
	technicianID := seedOnlineTechnician(t, env, "Tessa Tech")
	assignBody := fmt.Sprintf(`{"technician_id":%q}`, technicianID)
	if assign := env.do(t, http.MethodPost, "/ops/bookings/"+bookingID+"/assign", assignBody, adminToken); assign.code != http.StatusOK {
		t.Fatalf("assign = %d: %s", assign.code, assign.body)
	}

	resp := env.do(t, http.MethodGet, "/ops/audit", "", adminToken)
	if resp.code != http.StatusOK {
		t.Fatalf("GET /ops/audit = %d: %s", resp.code, resp.body)
	}
	// The admin drove SEARCH (redispatch) and ASSIGN — newest first.
	items := asArray(t, resp.json["items"])
	if len(items) != 2 || resp.json["total"] != float64(2) {
		t.Fatalf("audit list = %v (total %v), want 2 entries", items, resp.json["total"])
	}
	newest := asObject(t, items[0])
	if newest["action"] != "BOOKING_ASSIGN" || newest["immutable"] != true {
		t.Errorf("newest entry = %v, want an immutable BOOKING_ASSIGN", newest)
	}
	if asObject(t, items[1])["action"] != "BOOKING_REDISPATCH" {
		t.Errorf("older entry = %v, want BOOKING_REDISPATCH", items[1])
	}
	target := asObject(t, newest["target"])
	if target["type"] != "booking" || target["id"] != bookingID {
		t.Errorf("target = %v, want the booking", target)
	}
	admin := asObject(t, newest["admin"])
	if admin["name"] != "Staff" {
		t.Errorf("admin = %v, want the staff admin", admin)
	}

	filtered := env.do(t, http.MethodGet, "/ops/audit?action=BOOKING_ASSIGN", "", adminToken)
	if len(asArray(t, filtered.json["items"])) != 1 {
		t.Errorf("action filter = %v", filtered.json["items"])
	}
	// A target type nothing records yet is honestly empty, not an error.
	unrecorded := env.do(t, http.MethodGet, "/ops/audit?targetType=provider", "", adminToken)
	if unrecorded.code != http.StatusOK || len(asArray(t, unrecorded.json["items"])) != 0 {
		t.Errorf("provider target filter = %d %v, want an empty 200", unrecorded.code, unrecorded.json)
	}
}
