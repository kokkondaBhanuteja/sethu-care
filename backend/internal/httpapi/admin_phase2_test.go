package httpapi_test

// End-to-end coverage for the phase-2 admin operations: alerts (fed by the real outbox
// pipeline), the dashboard band, the live map and the audit detail/admins endpoints — over
// the same server harness the other transport tests use.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/kokkondaBhanuteja/sethu-care/internal/alert"
	"github.com/kokkondaBhanuteja/sethu-care/internal/outbox"
	"github.com/kokkondaBhanuteja/sethu-care/internal/topics"
)

// drainOutbox delivers every pending outbox event through the SAME consumer wiring
// production uses for the alert engine: booking.escalated → RecordBookingEscalation.
func drainOutbox(t *testing.T, env *testEnv) {
	t.Helper()
	dispatcher := outbox.NewDispatcher()
	alertService := alert.NewService(env.pool)
	dispatcher.Subscribe(topics.BookingEscalated.String(), func(ctx context.Context, event outbox.Event) error {
		return alertService.RecordBookingEscalation(ctx, event.ID, event.AggregateID)
	})
	worker := outbox.NewWorker(env.pool, dispatcher, outbox.WithBatchSize(10))
	for {
		delivered, err := worker.Poll(context.Background())
		if err != nil {
			t.Fatalf("outbox poll: %v", err)
		}
		if delivered < 10 {
			return
		}
	}
}

// doWithIdempotency issues a request carrying the Idempotency-Key header env.do cannot set.
func doWithIdempotency(t *testing.T, env *testEnv, method, path, body, token, key string) result {
	t.Helper()
	request, err := http.NewRequest(method, env.srv.URL+path, bytes.NewReader([]byte(body)))
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Idempotency-Key", key)
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	resp, err := env.srv.Client().Do(request)
	if err != nil {
		t.Fatalf("doing request: %v", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			t.Logf("closing response body: %v", err)
		}
	}()
	buffer := new(bytes.Buffer)
	if _, err := buffer.ReadFrom(resp.Body); err != nil {
		t.Fatalf("reading body: %v", err)
	}
	out := result{code: resp.StatusCode, body: buffer.String()}
	if buffer.Len() > 0 {
		if err := json.Unmarshal(buffer.Bytes(), &out.json); err != nil {
			t.Logf("response body was not json (%v): %s", err, out.body)
		}
	}
	return out
}

// seedEscalatedViaAPI drives a booking to ESCALATED through the public API and delivers the
// outbox, so the alert exists the way production creates it.
func seedEscalatedViaAPI(t *testing.T, env *testEnv) (bookingID, adminToken string) {
	t.Helper()
	bookingID, _, adminToken = seedSearchingBooking(t, env)
	if resp := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"ESCALATE"}`, adminToken); resp.code != http.StatusOK {
		t.Fatalf("escalate = %d: %s", resp.code, resp.body)
	}
	drainOutbox(t, env)
	return bookingID, adminToken
}

// The full alert lifecycle: the escalation event becomes a critical alert visible in the
// feed, the band and the shell counter; acknowledging it (idempotently) moves it out of the
// needs-action tier and writes exactly one audit entry; notes replay safely.
func TestAdminAlertLifecycle(t *testing.T) {
	env := newServer(t)
	bookingID, adminToken := seedEscalatedViaAPI(t, env)

	feed := env.do(t, http.MethodGet, "/ops/alerts", "", adminToken)
	if feed.code != http.StatusOK {
		t.Fatalf("GET /ops/alerts = %d: %s", feed.code, feed.body)
	}
	items := asArray(t, feed.json["items"])
	if len(items) != 1 {
		t.Fatalf("alerts = %v, want exactly the escalation", items)
	}
	alertItem := asObject(t, items[0])
	if alertItem["type"] != "bookingEscalated" || alertItem["severity"] != "critical" {
		t.Errorf("alert = %v/%v, want bookingEscalated/critical", alertItem["type"], alertItem["severity"])
	}
	if alertItem["requiresAcknowledgement"] != true || alertItem["acknowledgement"] != nil {
		t.Errorf("ownership state = %v/%v, want required and unclaimed",
			alertItem["requiresAcknowledgement"], alertItem["acknowledgement"])
	}
	subject := asObject(t, alertItem["subject"])
	if subject["kind"] != "booking" || subject["id"] != bookingID {
		t.Errorf("subject = %v, want the escalated booking", subject)
	}
	alertID := mustString(t, alertItem, "id")

	band := env.do(t, http.MethodGet, "/ops/dashboard/band", "", adminToken)
	if band.code != http.StatusOK {
		t.Fatalf("GET /ops/dashboard/band = %d: %s", band.code, band.body)
	}
	if band.json["criticalCount"] != float64(1) {
		t.Errorf("band criticalCount = %v, want 1", band.json["criticalCount"])
	}
	bandExamples := asArray(t, band.json["examples"])
	if len(bandExamples) != 1 {
		t.Fatalf("band examples = %v, want 1", bandExamples)
	}
	if example := asObject(t, bandExamples[0]); example["priority"] != "escalated" {
		t.Errorf("band example priority = %v, want escalated", example["priority"])
	}

	counters := env.do(t, http.MethodGet, "/ops/shell-counters", "", adminToken)
	if counters.json["criticalAlerts"] != float64(1) {
		t.Errorf("shell criticalAlerts = %v, want the real 1", counters.json["criticalAlerts"])
	}

	// The phase-1 id convention: the booking id deep-links to the same alert.
	detail := env.do(t, http.MethodGet, "/ops/alerts/"+bookingID, "", adminToken)
	if detail.code != http.StatusOK {
		t.Fatalf("GET /ops/alerts/{bookingId} = %d: %s", detail.code, detail.body)
	}
	if detail.json["id"] != alertID {
		t.Errorf("detail id = %v, want %v (the booking id resolved to its alert)", detail.json["id"], alertID)
	}
	trigger := asObject(t, detail.json["trigger"])
	if trigger["rule"] != "booking.escalated" || trigger["actual"] != "SEARCHING → ESCALATED" {
		t.Errorf("trigger = %v", trigger)
	}
	if detail.json["canMute"] != false {
		t.Errorf("canMute = %v, want false for a critical", detail.json["canMute"])
	}
	if history := asArray(t, detail.json["history"]); len(history) == 0 {
		t.Error("detail history is empty, want the booking's transitions")
	}
	relatedRecord := asObject(t, detail.json["relatedRecord"])
	if relatedRecord["kind"] != "booking" || relatedRecord["bookingState"] != "ESCALATED" {
		t.Errorf("relatedRecord = %v", relatedRecord)
	}

	// An unknown id renders the designed 404, not an empty page.
	if missing := env.do(t, http.MethodGet, "/ops/alerts/00000000-0000-0000-0000-00000000dead", "", adminToken); missing.code != http.StatusNotFound {
		t.Errorf("GET unknown alert = %d, want 404", missing.code)
	}

	// Acknowledge, then replay the SAME intent: both 200, both a win, ONE audit entry.
	acknowledge := doWithIdempotency(t, env, http.MethodPost, "/ops/alerts/"+alertID+"/acknowledge", "", adminToken, "ack-1")
	if acknowledge.code != http.StatusOK {
		t.Fatalf("acknowledge = %d: %s", acknowledge.code, acknowledge.body)
	}
	if acknowledge.json["wonRace"] != true {
		t.Errorf("wonRace = %v, want true", acknowledge.json["wonRace"])
	}
	replay := doWithIdempotency(t, env, http.MethodPost, "/ops/alerts/"+alertID+"/acknowledge", "", adminToken, "ack-1")
	if replay.code != http.StatusOK || replay.json["wonRace"] != true {
		t.Errorf("replayed acknowledge = %d wonRace=%v, want 200/true", replay.code, replay.json["wonRace"])
	}
	acknowledged := asObject(t, replay.json["alert"])
	if acknowledged["acknowledgement"] == nil {
		t.Error("replayed acknowledge lost the winning acknowledgement")
	}
	var auditRows int
	if err := env.pool.QueryRow(context.Background(),
		"SELECT count(*) FROM audit_logs WHERE action = 'ALERT_ACKNOWLEDGE'").Scan(&auditRows); err != nil {
		t.Fatalf("counting audit rows: %v", err)
	}
	if auditRows != 1 {
		t.Errorf("ALERT_ACKNOWLEDGE audit rows = %d, want exactly 1", auditRows)
	}

	// Acknowledged means out of needs-action: the band and the badge return to zero.
	if after := env.do(t, http.MethodGet, "/ops/dashboard/band", "", adminToken); after.json["criticalCount"] != float64(0) {
		t.Errorf("band after acknowledge = %v, want 0", after.json["criticalCount"])
	}
	if after := env.do(t, http.MethodGet, "/ops/shell-counters", "", adminToken); after.json["criticalAlerts"] != float64(0) {
		t.Errorf("shell criticalAlerts after acknowledge = %v, want 0", after.json["criticalAlerts"])
	}

	// Notes: a replayed Idempotency-Key returns the first note, never a second row.
	noteBody := `{"body":"Customer called back."}`
	firstNote := doWithIdempotency(t, env, http.MethodPost, "/ops/alerts/"+alertID+"/notes", noteBody, adminToken, "note-1")
	if firstNote.code != http.StatusCreated {
		t.Fatalf("create note = %d: %s", firstNote.code, firstNote.body)
	}
	replayedNote := doWithIdempotency(t, env, http.MethodPost, "/ops/alerts/"+alertID+"/notes", noteBody, adminToken, "note-1")
	if mustString(t, replayedNote.json, "id") != mustString(t, firstNote.json, "id") {
		t.Error("replayed note minted a second row")
	}

	// Read-all touches nothing here — there is no informational tier yet — and says so.
	readAll := doWithIdempotency(t, env, http.MethodPost, "/ops/alerts/read-all", "", adminToken, "read-1")
	if readAll.code != http.StatusOK || readAll.json["markedRead"] != float64(0) {
		t.Errorf("read-all = %d %v, want 200 with the honest 0", readAll.code, readAll.json)
	}
}

// The live map serves real technician positions (freshness-filtered) and real job pins, and
// its zone surfaces are honestly empty (no zones table exists).
func TestAdminLiveMap(t *testing.T) {
	env := newServer(t)
	bookingID, adminToken := seedEscalatedViaAPI(t, env)

	freshTechnician := seedOnlineTechnician(t, env, "Fresh Finder")
	env.exec(t, "UPDATE technicians SET last_lat = 12.97, last_lng = 77.59, last_location_at = now() WHERE user_id = $1",
		freshTechnician)
	staleTechnician := seedOnlineTechnician(t, env, "Stale Wanderer")
	env.exec(t, "UPDATE technicians SET last_lat = 12.95, last_lng = 77.60, last_location_at = $2 WHERE user_id = $1",
		staleTechnician, time.Now().Add(-time.Hour))

	resp := env.do(t, http.MethodGet, "/ops/live-map?zoom=1", "", adminToken)
	if resp.code != http.StatusOK {
		t.Fatalf("GET /ops/live-map = %d: %s", resp.code, resp.body)
	}

	providers := asArray(t, resp.json["providers"])
	if len(providers) != 1 {
		t.Fatalf("providers = %v, want only the fresh position", providers)
	}
	provider := asObject(t, providers[0])
	if provider["name"] != "Fresh Finder" || provider["status"] != "online" {
		t.Errorf("provider = %v", provider)
	}

	jobs := asArray(t, resp.json["jobs"])
	if len(jobs) != 1 {
		t.Fatalf("jobs = %v, want the escalated booking's pin", jobs)
	}
	jobPin := asObject(t, jobs[0])
	if jobPin["id"] != bookingID || jobPin["state"] != "escalated" {
		t.Errorf("job pin = %v", jobPin)
	}

	attention := asArray(t, resp.json["attention"])
	if len(attention) != 1 || asObject(t, attention[0])["reason"] != "escalated" {
		t.Errorf("attention = %v, want the escalation", attention)
	}

	// Honest empties: no zones table exists yet.
	for _, emptySurface := range []string{"zones", "clusters", "zeroSupplyZoneIds"} {
		if surface := asArray(t, resp.json[emptySurface]); len(surface) != 0 {
			t.Errorf("%s = %v, want honestly empty (no zones model)", emptySurface, surface)
		}
	}
	if resp.json["onlineProviderCount"] != float64(2) {
		t.Errorf("onlineProviderCount = %v, want the CITY total of 2", resp.json["onlineProviderCount"])
	}
}

// The audit detail is the deep-linked twin of the list row, and the admins endpoint derives
// the filter dropdown server-side.
func TestAdminAuditEntryAndAdmins(t *testing.T) {
	env := newServer(t)
	bookingID, _, adminToken := seedSearchingBooking(t, env)
	technicianID := seedOnlineTechnician(t, env, "Audit Tech")
	assignBody := fmt.Sprintf(`{"technician_id":%q}`, technicianID)
	if assign := env.do(t, http.MethodPost, "/ops/bookings/"+bookingID+"/assign", assignBody, adminToken); assign.code != http.StatusOK {
		t.Fatalf("assign = %d: %s", assign.code, assign.body)
	}

	list := env.do(t, http.MethodGet, "/ops/audit", "", adminToken)
	if list.code != http.StatusOK {
		t.Fatalf("GET /ops/audit = %d: %s", list.code, list.body)
	}
	listItems := asArray(t, list.json["items"])
	if len(listItems) == 0 {
		t.Fatal("audit list is empty after an admin assignment")
	}
	listed := asObject(t, listItems[0])
	entryID := mustString(t, listed, "id")

	detail := env.do(t, http.MethodGet, "/ops/audit/"+entryID, "", adminToken)
	if detail.code != http.StatusOK {
		t.Fatalf("GET /ops/audit/{id} = %d: %s", detail.code, detail.body)
	}
	if detail.json["action"] != "BOOKING_ASSIGN" || detail.json["immutable"] != true {
		t.Errorf("entry = %v/%v", detail.json["action"], detail.json["immutable"])
	}
	target := asObject(t, detail.json["target"])
	if target["id"] != bookingID || target["type"] != "booking" {
		t.Errorf("target = %v", target)
	}
	after := asObject(t, detail.json["after"])
	if len(after) == 0 {
		t.Error("after snapshot is empty, want the recorded state")
	}
	// The compensating cross-links are honestly null: nothing records compensations yet.
	if detail.json["compensatesEntryId"] != nil || detail.json["compensatedByEntryId"] != nil {
		t.Errorf("compensating links = %v/%v, want null",
			detail.json["compensatesEntryId"], detail.json["compensatedByEntryId"])
	}

	if missing := env.do(t, http.MethodGet, "/ops/audit/00000000-0000-0000-0000-00000000dead", "", adminToken); missing.code != http.StatusNotFound {
		t.Errorf("GET unknown audit entry = %d, want 404", missing.code)
	}

	admins := env.do(t, http.MethodGet, "/ops/audit/admins", "", adminToken)
	if admins.code != http.StatusOK {
		t.Fatalf("GET /ops/audit/admins = %d: %s", admins.code, admins.body)
	}
	adminItems := asArray(t, admins.json["items"])
	if len(adminItems) != 1 {
		t.Fatalf("audit admins = %v, want the one assigning admin", adminItems)
	}
	if actor := asObject(t, adminItems[0]); actor["name"] != "Staff" {
		t.Errorf("audit admin = %v", actor)
	}
}
