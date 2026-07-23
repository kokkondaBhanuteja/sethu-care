package httpapi_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// End-to-end coverage for the admin booking-action operations (the rescue console's write
// side), over the same server the other transport tests use: the frozen contract's designed
// failures arrive with their declared bodies, mutations honour the Idempotency-Key, and
// every action lands as a real transition/ledger/audit record.

// doAction issues a request with the Idempotency-Key header every admin mutation carries.
func doAction(t *testing.T, env *testEnv, method, path, body, token, idempotencyKey string) result {
	t.Helper()
	request, err := http.NewRequest(method, env.srv.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	request.Header.Set("Authorization", "Bearer "+token)
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
	response, err := env.srv.Client().Do(request)
	if err != nil {
		t.Fatalf("doing request: %v", err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			t.Logf("closing body: %v", err)
		}
	}()
	raw, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("reading body: %v", err)
	}
	out := result{code: response.StatusCode, body: string(raw)}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &out.json); err != nil {
			t.Logf("response body was not json (%v): %s", err, out.body)
		}
	}
	return out
}

// seedEscalatedBooking drives a booking to ESCALATED through the public API — the state
// the rescue console exists for.
func seedEscalatedBooking(t *testing.T, env *testEnv) (bookingID, adminToken string) {
	t.Helper()
	bookingID, _, adminToken = seedSearchingBooking(t, env)
	if resp := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"ESCALATE"}`, adminToken); resp.code != http.StatusOK {
		t.Fatalf("ESCALATE = %d: %s", resp.code, resp.body)
	}
	return bookingID, adminToken
}

// detailVersion reads the record's current optimistic-concurrency token, as the console
// would before mutating.
func detailVersion(t *testing.T, env *testEnv, bookingID, adminToken string) int {
	t.Helper()
	detail := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID, "", adminToken)
	if detail.code != http.StatusOK {
		t.Fatalf("detail = %d: %s", detail.code, detail.body)
	}
	version, isNumber := detail.json["version"].(float64)
	if !isNumber {
		t.Fatalf("version missing in %v", detail.json)
	}
	return int(version)
}

// backdateBookingEvents ages a booking's events for one action — how the tests cross the
// undo windows and the 30-minute lock without waiting them out.
func backdateBookingEvents(t *testing.T, env *testEnv, bookingID, action string, bySeconds int) {
	t.Helper()
	env.exec(t, "ALTER TABLE booking_events DISABLE TRIGGER booking_events_are_append_only")
	env.exec(t, `UPDATE booking_events SET created_at = created_at - ($3::bigint * interval '1 second')
		WHERE booking_id = $1 AND action = $2`, uuid.MustParse(bookingID), action, bySeconds)
	env.exec(t, "ALTER TABLE booking_events ENABLE TRIGGER booking_events_are_append_only")
}

// The assign context serves ranked real candidates and the server-stated ranking weights.
func TestAdminAssignContextServesRankedCandidates(t *testing.T) {
	env := newServer(t)
	bookingID, adminToken := seedEscalatedBooking(t, env)
	near := seedOnlineTechnician(t, env, "Near Tech")
	env.exec(t, "UPDATE technicians SET last_lat = 12.975, last_lng = 77.595, last_location_at = now() WHERE user_id = $1", near)
	seedOnlineTechnician(t, env, "Unlocated Tech")

	resp := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID+"/assign-context", "", adminToken)
	if resp.code != http.StatusOK {
		t.Fatalf("assign-context = %d: %s", resp.code, resp.body)
	}
	subject := asObject(t, resp.json["booking"])
	if subject["bookingId"] != bookingID || subject["escalatedMinutes"] == nil {
		t.Errorf("subject = %v, want the escalated booking", subject)
	}
	if reference, isString := subject["reference"].(string); !isString || !strings.HasPrefix(reference, "#B-") {
		t.Errorf("reference = %v, want the #B- shape", subject["reference"])
	}
	candidates := asArray(t, resp.json["candidates"])
	if len(candidates) != 2 {
		t.Fatalf("candidates = %v, want both online technicians", candidates)
	}
	best := asObject(t, candidates[0])
	if best["name"] != "Near Tech" || best["isBestMatch"] != true {
		t.Errorf("best candidate = %v, want the located technician first", best)
	}
	if distance, isNumber := best["distanceKm"].(float64); !isNumber || distance <= 0 {
		t.Errorf("distanceKm = %v, want a real distance", best["distanceKm"])
	}
	second := asObject(t, candidates[1])
	if second["distanceKm"] != float64(0) || second["etaMinutes"] != float64(0) {
		t.Errorf("unlocated candidate = %v, want honest zero distance/eta", second)
	}
	if len(asArray(t, resp.json["rankingWeights"])) == 0 {
		t.Error("rankingWeights missing")
	}
	if resp.json["isBlockedOffline"] != false {
		t.Errorf("isBlockedOffline = %v", resp.json["isBlockedOffline"])
	}
}

// Cancel over HTTP: the missing header is refused, the receipt carries the bumped version,
// a replay returns the first receipt, a stale version is the declared 409 body, and the
// undo compensates within its window.
func TestAdminCancelUndoAndIdempotencyOverHTTP(t *testing.T) {
	env := newServer(t)
	bookingID, adminToken := seedEscalatedBooking(t, env)
	version := detailVersion(t, env, bookingID, adminToken)

	cancelBody := fmt.Sprintf(`{"reasonCode":"customer_unreachable","note":"no answer",
		"refund":{"amountPaise":0,"isPolicyAmount":true,"overrideJustification":"","waiveFee":false},
		"version":%d}`, version)

	if noKey := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/cancel", cancelBody, adminToken, ""); noKey.code != http.StatusUnprocessableEntity {
		t.Errorf("cancel without Idempotency-Key = %d, want 422", noKey.code)
	}

	first := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/cancel", cancelBody, adminToken, "cancel-http-1")
	if first.code != http.StatusOK {
		t.Fatalf("cancel = %d: %s", first.code, first.body)
	}
	if first.json["bookingId"] != bookingID || first.json["version"] != float64(version+1) {
		t.Errorf("receipt = %v, want version %d", first.json, version+1)
	}

	replay := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/cancel", cancelBody, adminToken, "cancel-http-1")
	if replay.code != http.StatusOK || replay.json["version"] != first.json["version"] {
		t.Errorf("replay = %d %v, want the first receipt", replay.code, replay.json)
	}

	// A NEW key with the now-stale version is the declared conflict body.
	stale := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/cancel", cancelBody, adminToken, "cancel-http-2")
	if stale.code != http.StatusConflict {
		t.Fatalf("stale cancel = %d: %s", stale.code, stale.body)
	}
	if stale.json["code"] != "VERSION_CONFLICT" || stale.json["currentVersion"] != float64(version+1) {
		t.Errorf("conflict body = %v, want VERSION_CONFLICT with currentVersion", stale.json)
	}

	undoBody := fmt.Sprintf(`{"undoes":"cancel","version":%d}`, version+1)
	if wrong := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/assign/undo", undoBody, adminToken, "undo-http-0"); wrong.code != http.StatusBadRequest {
		t.Errorf("cancel-undo on the assign endpoint = %d, want 400", wrong.code)
	}
	undone := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/cancel/undo", undoBody, adminToken, "undo-http-1")
	if undone.code != http.StatusOK {
		t.Fatalf("undo = %d: %s", undone.code, undone.body)
	}
	if undone.json["refundReversed"] != false || undone.json["refundReversalFailureReason"] != nil {
		t.Errorf("undo receipt = %v, want no refund to reverse and no failure", undone.json)
	}
	detail := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID, "", adminToken)
	if detail.json["state"] != "ESCALATED" {
		t.Errorf("state after undo = %v, want ESCALATED", detail.json["state"])
	}

	// Cancel again and age it past the window: the undo is refused as a conflict.
	version = detailVersion(t, env, bookingID, adminToken)
	lateCancel := fmt.Sprintf(`{"reasonCode":"duplicate_booking","note":"",
		"refund":{"amountPaise":0,"isPolicyAmount":true,"overrideJustification":"","waiveFee":false},
		"version":%d}`, version)
	if again := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/cancel", lateCancel, adminToken, "cancel-http-3"); again.code != http.StatusOK {
		t.Fatalf("re-cancel = %d: %s", again.code, again.body)
	}
	backdateBookingEvents(t, env, bookingID, "CANCEL", 11)
	lateUndo := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/cancel/undo",
		fmt.Sprintf(`{"undoes":"cancel","version":%d}`, version+1), adminToken, "undo-http-2")
	if lateUndo.code != http.StatusConflict {
		t.Errorf("late undo = %d, want 409", lateUndo.code)
	}
}

// Redispatch over HTTP: the incentive cap is the declared 422, a legal redispatch RESUMEs
// the search and records the round the next context reports.
func TestAdminRedispatchOverHTTP(t *testing.T) {
	env := newServer(t)
	bookingID, adminToken := seedEscalatedBooking(t, env)
	version := detailVersion(t, env, bookingID, adminToken)

	contextBefore := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID+"/redispatch-context", "", adminToken)
	if contextBefore.code != http.StatusOK {
		t.Fatalf("redispatch-context = %d: %s", contextBefore.code, contextBefore.body)
	}
	if contextBefore.json["defaultRadiusId"] != "plus_50" || contextBefore.json["failedCycles"] != float64(1) {
		t.Errorf("context = %v, want plus_50 suggested after one failed cycle", contextBefore.json)
	}
	capPaise, isNumber := contextBefore.json["incentiveCapPaise"].(float64)
	if !isNumber {
		t.Fatalf("incentiveCapPaise missing in %v", contextBefore.json)
	}

	overCap := fmt.Sprintf(`{"radiusId":"plus_50","incentivePaise":%d,"relaxSkillMatch":false,
		"includeDecliners":false,"priorityBoost":false,"version":%d}`, int(capPaise)+1, version)
	rejected := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/redispatch", overCap, adminToken, "redispatch-1")
	if rejected.code != http.StatusUnprocessableEntity || rejected.json["code"] != "EXCEEDS_CAP" {
		t.Errorf("over-cap redispatch = %d %v, want the declared 422", rejected.code, rejected.json)
	}

	valid := fmt.Sprintf(`{"radiusId":"plus_50","incentivePaise":15000,"relaxSkillMatch":true,
		"includeDecliners":true,"priorityBoost":true,"version":%d}`, version)
	accepted := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/redispatch", valid, adminToken, "redispatch-1")
	if accepted.code != http.StatusOK {
		t.Fatalf("redispatch = %d: %s", accepted.code, accepted.body)
	}
	detail := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID, "", adminToken)
	if detail.json["state"] != "SEARCHING" {
		t.Errorf("state = %v, want SEARCHING", detail.json["state"])
	}

	env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"ESCALATE"}`, adminToken)
	contextAfter := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID+"/redispatch-context", "", adminToken)
	rounds := asArray(t, contextAfter.json["rounds"])
	if len(rounds) != 1 {
		t.Fatalf("rounds = %v, want the recorded redispatch", rounds)
	}
	round := asObject(t, rounds[0])
	if round["round"] != float64(1) || round["radiusKm"] != float64(15) {
		t.Errorf("round = %v, want round 1 at 15km", round)
	}
	if contextAfter.json["defaultRadiusId"] != "plus_100" {
		t.Errorf("next default radius = %v, want plus_100", contextAfter.json["defaultRadiusId"])
	}
}

// Manual completion over HTTP: the 30-minute lock is the declared TOO_EARLY body, the
// evidence gate the declared 422, and success completes the booking with the
// admin-verified marker on the record.
func TestAdminManualCompletionOverHTTP(t *testing.T) {
	env := newServer(t)
	bookingID, _, adminToken := seedSearchingBooking(t, env)
	technicianID := seedOnlineTechnician(t, env, "Tessa Tech")
	assignBody := fmt.Sprintf(`{"technician_id":%q}`, technicianID)
	if assign := env.do(t, http.MethodPost, "/ops/bookings/"+bookingID+"/assign", assignBody, adminToken); assign.code != http.StatusOK {
		t.Fatalf("assign = %d: %s", assign.code, assign.body)
	}
	for _, action := range []string{"DEPART", "ARRIVE"} {
		if resp := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions",
			fmt.Sprintf(`{"action":%q}`, action), adminToken); resp.code != http.StatusOK {
			t.Fatalf("%s = %d: %s", action, resp.code, resp.body)
		}
	}
	// VERIFY_START demands the start OTP at the transport layer; the work-reported state is
	// seeded through the booking service instead (the same path the technician app drives).
	adminID := adminIDFromToken(t, env, adminToken)
	bookingService := booking.NewService(env.pool)
	for _, action := range []booking.Action{booking.ActionVerifyStart, booking.ActionRequestCompletion} {
		if _, err := bookingService.Apply(context.Background(), uuid.MustParse(bookingID), action, booking.TransitionInput{
			Actor: &adminID, ActorRole: identity.RoleAdmin,
		}); err != nil {
			t.Fatalf("%s: %v", action, err)
		}
	}
	version := detailVersion(t, env, bookingID, adminToken)

	contextResp := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID+"/manual-complete-context", "", adminToken)
	if contextResp.code != http.StatusOK {
		t.Fatalf("manual-complete-context = %d: %s", contextResp.code, contextResp.body)
	}
	if contextResp.json["availableInMinutes"] == nil || contextResp.json["providerName"] != "Tessa Tech" {
		t.Errorf("context = %v, want the live lock and the provider named", contextResp.json)
	}

	completeBody := func(callAttempts, note string) string {
		return fmt.Sprintf(`{"attestations":{"attemptedCustomer":true,"believesWorkDone":true,"spokeToProvider":true},
			"evidence":{"callAttemptIds":%s,"completionReportId":null,"workPhotoIds":[]},
			"note":%q,"reasonCode":"customer_phone_unreachable","version":%d}`, callAttempts, note, version)
	}
	goodNote := "customer unreachable after three calls; provider confirmed"

	early := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/manual-complete",
		completeBody(`["call-1"]`, goodNote), adminToken, "mc-http-1")
	if early.code != http.StatusConflict || early.json["code"] != "TOO_EARLY" || early.json["availableAt"] == nil {
		t.Fatalf("early manual complete = %d %v, want the declared TOO_EARLY body", early.code, early.json)
	}

	backdateBookingEvents(t, env, bookingID, "REQUEST_COMPLETION", 31*60)

	noEvidence := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/manual-complete",
		completeBody(`[]`, goodNote), adminToken, "mc-http-2")
	if noEvidence.code != http.StatusUnprocessableEntity || noEvidence.json["code"] != "EVIDENCE_INSUFFICIENT" {
		t.Fatalf("no-evidence complete = %d %v, want EVIDENCE_INSUFFICIENT", noEvidence.code, noEvidence.json)
	}
	if missing := asArray(t, noEvidence.json["missing"]); len(missing) == 0 || missing[0] != "callAttempts" {
		t.Errorf("missing = %v, want callAttempts named", noEvidence.json["missing"])
	}

	done := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/manual-complete",
		completeBody(`["call-1"]`, goodNote), adminToken, "mc-http-3")
	if done.code != http.StatusOK {
		t.Fatalf("manual complete = %d: %s", done.code, done.body)
	}
	detail := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID, "", adminToken)
	if detail.json["state"] != "COMPLETED" || detail.json["isAdminVerified"] != true {
		t.Errorf("detail = state %v verified %v, want an admin-verified COMPLETED",
			detail.json["state"], detail.json["isAdminVerified"])
	}
	verification := asObject(t, detail.json["verification"])
	if verification["verifiedByName"] != "Staff" || verification["disputeWindowClosesAt"] == nil {
		t.Errorf("verification = %v, want the asserting admin and the dispute window", verification)
	}
	timeline := asArray(t, detail.json["timeline"])
	lastEvent := asObject(t, timeline[len(timeline)-1])
	if lastEvent["kind"] != "completedByAdmin" {
		t.Errorf("last timeline kind = %v, want completedByAdmin", lastEvent["kind"])
	}
}

// Refund over HTTP: the declared cap and rate-limit bodies, the immediate (never pending)
// receipt, and the replay that cannot move money twice.
func TestAdminRefundOverHTTP(t *testing.T) {
	env := newServer(t)
	bookingID, adminToken := seedEscalatedBooking(t, env)
	env.exec(t, `INSERT INTO ledger_entries (kind, amount_paise, order_id, customer_id, method, memo)
		SELECT 'REVENUE', 59900, order_id, customer_id, 'UPI', 'test revenue' FROM bookings WHERE id = $1`,
		uuid.MustParse(bookingID))
	version := detailVersion(t, env, bookingID, adminToken)

	contextResp := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID+"/refund-context", "", adminToken)
	if contextResp.code != http.StatusOK {
		t.Fatalf("refund-context = %d: %s", contextResp.code, contextResp.body)
	}
	if contextResp.json["refundablePaise"] != float64(59900) || contextResp.json["goodwillCapPaise"] != float64(50000) {
		t.Errorf("context = %v", contextResp.json)
	}

	refundBody := func(amountPaise int, refundType string) string {
		return fmt.Sprintf(`{"amountPaise":%d,"note":"visible damage","payoutImpact":"withhold",
			"reasonCode":"poor_service_quality","refundType":%q,"version":%d}`, amountPaise, refundType, version)
	}

	overCap := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/refund",
		refundBody(50001, "goodwill_credit"), adminToken, "refund-http-cap")
	if overCap.code != http.StatusUnprocessableEntity || overCap.json["code"] != "EXCEEDS_CAP" {
		t.Fatalf("over-cap refund = %d %v", overCap.code, overCap.json)
	}
	if fields := asObject(t, overCap.json["fields"]); fields["amountPaise"] == nil {
		t.Errorf("cap error fields = %v, want a field error on amountPaise", overCap.json["fields"])
	}
	if overCap.json["capPaise"] != float64(50000) {
		t.Errorf("capPaise = %v, want 50000", overCap.json["capPaise"])
	}

	first := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/refund",
		refundBody(10000, "partial"), adminToken, "refund-http-1")
	if first.code != http.StatusOK {
		t.Fatalf("refund = %d: %s", first.code, first.body)
	}
	if first.json["isPending"] != false || first.json["refundId"] == nil {
		t.Errorf("receipt = %v, want an immediate refund with its id", first.json)
	}

	replay := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/refund",
		refundBody(10000, "partial"), adminToken, "refund-http-1")
	if replay.code != http.StatusOK || replay.json["refundId"] != first.json["refundId"] {
		t.Errorf("replay = %d %v, want the first refund's receipt", replay.code, replay.json)
	}

	// Exhaust the hourly budget with recorded trail rows, then the declared 429.
	adminID := adminIDFromToken(t, env, adminToken)
	for seeded := 0; seeded < 9; seeded++ {
		env.exec(t, `INSERT INTO audit_logs (actor_user_id, actor_kind, action, entity_type, entity_id)
			VALUES ($1, 'user', 'REFUND', 'booking', $2)`, adminID, uuid.MustParse(bookingID))
	}
	limited := doAction(t, env, http.MethodPost, "/ops/bookings/"+bookingID+"/refund",
		refundBody(100, "partial"), adminToken, "refund-http-2")
	if limited.code != http.StatusTooManyRequests || limited.json["resetAt"] == nil {
		t.Fatalf("rate-limited refund = %d %v, want the declared 429 with resetAt", limited.code, limited.json)
	}
}

// adminIDFromToken resolves the seeded staff admin's id (staffToken provisions the user).
func adminIDFromToken(t *testing.T, env *testEnv, _ string) uuid.UUID {
	t.Helper()
	var adminID uuid.UUID
	if err := env.pool.QueryRow(context.Background(),
		"SELECT id FROM users WHERE role = 'ADMIN' ORDER BY created_at LIMIT 1").Scan(&adminID); err != nil {
		t.Fatalf("resolving admin id: %v", err)
	}
	return adminID
}
