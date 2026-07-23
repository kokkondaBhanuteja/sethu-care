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

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// End-to-end coverage for the admin PROVIDERS and APPLICATIONS operations, over the same
// server the other transport tests use: roster status derivation, cursor pagination, the
// suspend/block/restore writes (with their dispatch-exclusion consequence), and the
// application pipeline through to a technician who can authenticate.

// seedRosterTechnician inserts a technician with a round-the-clock shift (so candidate
// eligibility never depends on the wall clock the test runs at) and full control over the
// availability signals the roster derives status from.
func seedRosterTechnician(t *testing.T, env *testEnv, name string, online bool) uuid.UUID {
	t.Helper()
	technicianID := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, $3, 'TECHNICIAN')",
		technicianID, "+9192"+technicianID.String()[:8], name)
	// max_concurrent_jobs is raised so a let-finish job does not exhaust capacity — the
	// exclusion these tests assert must be the admin restriction, nothing else.
	env.exec(t, `INSERT INTO technicians (user_id, city, is_online, shift_start_minute, shift_end_minute, max_concurrent_jobs)
		VALUES ($1, 'Bengaluru', $2, 0, 1440, 3)`, technicianID, online)
	return technicianID
}

// ageTechnicianSignals pushes every freshness signal into the past, so an is_online row
// reads as stale.
func ageTechnicianSignals(t *testing.T, env *testEnv, technicianID uuid.UUID) {
	t.Helper()
	env.exec(t, `UPDATE technicians
		SET updated_at = now() - interval '30 minutes', last_location_at = now() - interval '30 minutes'
		WHERE user_id = $1`, technicianID)
}

// adminMutate posts an admin mutation with the Idempotency-Key header the contract requires.
func adminMutate(t *testing.T, env *testEnv, path, body, token string) result {
	t.Helper()
	request, err := http.NewRequest(http.MethodPost, env.srv.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Idempotency-Key", uuid.NewString())
	response, err := env.srv.Client().Do(request)
	if err != nil {
		t.Fatalf("doing request: %v", err)
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			t.Logf("closing response body: %v", err)
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

// The roster derives every status honestly: fresh online is free, stale online is offline,
// an active booking is on_job, a standing suspension is suspended — and the segments,
// counts and search all read the same derivation.
func TestAdminProviderRosterStatusDerivation(t *testing.T) {
	env := newServer(t)
	bookingID, _, adminToken := seedSearchingBooking(t, env)

	seedRosterTechnician(t, env, "Free Fred", true)
	staleID := seedRosterTechnician(t, env, "Stale Sam", true)
	ageTechnicianSignals(t, env, staleID)
	seedRosterTechnician(t, env, "Offline Omar", false)
	busyID := seedRosterTechnician(t, env, "Busy Bella", true)
	suspendedID := seedRosterTechnician(t, env, "Suspended Sunil", true)

	assignBody := fmt.Sprintf(`{"technician_id":%q}`, busyID)
	if assign := env.do(t, http.MethodPost, "/ops/bookings/"+bookingID+"/assign", assignBody, adminToken); assign.code != http.StatusOK {
		t.Fatalf("assign = %d: %s", assign.code, assign.body)
	}
	suspendBody := `{"type":"suspend","reasonCode":"poor_quality","note":"seed","durationDays":7,"jobResolutions":{},"notifyImmediately":false,"version":0}`
	if suspend := adminMutate(t, env, "/ops/providers/"+suspendedID.String()+"/suspend", suspendBody, adminToken); suspend.code != http.StatusOK {
		t.Fatalf("suspend = %d: %s", suspend.code, suspend.body)
	}

	all := env.do(t, http.MethodGet, "/ops/providers?segment=all", "", adminToken)
	if all.code != http.StatusOK {
		t.Fatalf("GET /ops/providers = %d: %s", all.code, all.body)
	}
	statusByName := map[string]string{}
	for _, row := range asArray(t, all.json["rows"]) {
		rowObject := asObject(t, row)
		statusByName[mustString(t, rowObject, "name")] = mustString(t, rowObject, "status")
	}
	want := map[string]string{
		"Free Fred": "free", "Stale Sam": "offline", "Offline Omar": "offline",
		"Busy Bella": "on_job", "Suspended Sunil": "suspended",
	}
	for name, wantStatus := range want {
		if statusByName[name] != wantStatus {
			t.Errorf("%s status = %q, want %q", name, statusByName[name], wantStatus)
		}
	}
	counts := asObject(t, all.json["counts"])
	if counts["total"] != float64(5) || counts["online"] != float64(1) ||
		counts["onJob"] != float64(1) || counts["suspended"] != float64(1) {
		t.Errorf("counts = %v", counts)
	}

	// The default (online) segment shows only the dispatchable provider.
	online := env.do(t, http.MethodGet, "/ops/providers", "", adminToken)
	onlineRows := asArray(t, online.json["rows"])
	if len(onlineRows) != 1 || asObject(t, onlineRows[0])["name"] != "Free Fred" {
		t.Errorf("online segment = %v, want just Free Fred", onlineRows)
	}

	// The on-job row carries its stage cell.
	onJob := env.do(t, http.MethodGet, "/ops/providers?segment=onJob", "", adminToken)
	onJobRows := asArray(t, onJob.json["rows"])
	if len(onJobRows) != 1 {
		t.Fatalf("onJob segment = %v", onJobRows)
	}
	currentJob := asObject(t, asObject(t, onJobRows[0])["currentJob"])
	if currentJob["bookingId"] != bookingID || currentJob["stage"] != "en_route" {
		t.Errorf("currentJob = %v, want the assigned booking en_route", currentJob)
	}

	// Search filters within the same derivation.
	searched := env.do(t, http.MethodGet, "/ops/providers?segment=all&search=Bella", "", adminToken)
	if rows := asArray(t, searched.json["rows"]); len(rows) != 1 || asObject(t, rows[0])["name"] != "Busy Bella" {
		t.Errorf("search = %v, want just Busy Bella", rows)
	}
}

// The keyset cursor walks the whole roster without duplicates or gaps, and a full final
// page mints no cursor.
func TestAdminProviderRosterCursorWalk(t *testing.T) {
	env := newServer(t)
	adminToken := env.staffToken(t, identity.RoleAdmin)

	for index := range 5 {
		seedRosterTechnician(t, env, fmt.Sprintf("Walker %02d", index), true)
	}

	seen := map[string]bool{}
	cursor := ""
	pages := 0
	for {
		target := "/ops/providers?segment=all&limit=2"
		if cursor != "" {
			target += "&cursor=" + cursor
		}
		page := env.do(t, http.MethodGet, target, "", adminToken)
		if page.code != http.StatusOK {
			t.Fatalf("page %d = %d: %s", pages, page.code, page.body)
		}
		for _, row := range asArray(t, page.json["rows"]) {
			name := mustString(t, asObject(t, row), "name")
			if seen[name] {
				t.Errorf("cursor walk returned %q twice", name)
			}
			seen[name] = true
		}
		pages++
		next, hasNext := page.json["nextCursor"].(string)
		if !hasNext || next == "" {
			break
		}
		cursor = next
		if pages > 5 {
			t.Fatal("cursor walk did not terminate")
		}
	}
	if len(seen) != 5 || pages != 3 {
		t.Errorf("walked %d providers over %d pages, want 5 over 3", len(seen), pages)
	}

	if junk := env.do(t, http.MethodGet, "/ops/providers?cursor=not-a-cursor", "", adminToken); junk.code != http.StatusBadRequest {
		t.Errorf("junk cursor = %d, want 400", junk.code)
	}
}

// Suspension: refuses while a live job is unresolved, lands with a resolution, excludes the
// provider from the assignment engine's candidates, stamps the audit trail, and restore
// reverses all of it. Version conflicts return the designed VERSION_CONFLICT body.
func TestAdminSuspendProviderLifecycle(t *testing.T) {
	env := newServer(t)
	bookingID, _, adminToken := seedSearchingBooking(t, env)
	technicianID := seedRosterTechnician(t, env, "Prakash Verma", true)

	// Eligible while in good standing.
	if !candidateNames(t, env, adminToken, bookingID)["Prakash Verma"] {
		t.Fatalf("expected Prakash Verma to be a candidate before suspension")
	}

	assignBody := fmt.Sprintf(`{"technician_id":%q}`, technicianID)
	if assign := env.do(t, http.MethodPost, "/ops/bookings/"+bookingID+"/assign", assignBody, adminToken); assign.code != http.StatusOK {
		t.Fatalf("assign = %d: %s", assign.code, assign.body)
	}

	// Step 3 of the flow: the live job, with the honest absence of an ETA.
	jobs := env.do(t, http.MethodGet, "/ops/providers/"+technicianID.String()+"/active-jobs", "", adminToken)
	if jobs.code != http.StatusOK {
		t.Fatalf("active-jobs = %d: %s", jobs.code, jobs.body)
	}
	jobItems := asArray(t, jobs.json["items"])
	if len(jobItems) != 1 || asObject(t, jobItems[0])["bookingId"] != bookingID {
		t.Fatalf("active jobs = %v, want the assigned booking", jobItems)
	}

	// A suspension that would strand the job is refused.
	unresolved := `{"type":"suspend","reasonCode":"safety_complaint","note":"n","durationDays":3,"jobResolutions":{},"notifyImmediately":true,"version":0}`
	if refused := adminMutate(t, env, "/ops/providers/"+technicianID.String()+"/suspend", unresolved, adminToken); refused.code != http.StatusUnprocessableEntity {
		t.Errorf("unresolved suspend = %d, want 422: %s", refused.code, refused.body)
	}

	resolved := fmt.Sprintf(`{"type":"suspend","reasonCode":"safety_complaint","note":"n","durationDays":3,"jobResolutions":{%q:"let_finish"},"notifyImmediately":true,"version":0}`, bookingID)
	suspended := adminMutate(t, env, "/ops/providers/"+technicianID.String()+"/suspend", resolved, adminToken)
	if suspended.code != http.StatusOK {
		t.Fatalf("suspend = %d: %s", suspended.code, suspended.body)
	}
	if suspended.json["version"] != float64(1) || suspended.json["effectiveUntil"] == nil {
		t.Errorf("suspend result = %v, want version 1 with an effectiveUntil", suspended.json)
	}

	// The profile shows the suspension and echoes the version mutations must carry.
	profile := env.do(t, http.MethodGet, "/ops/providers/"+technicianID.String(), "", adminToken)
	if profile.code != http.StatusOK {
		t.Fatalf("profile = %d: %s", profile.code, profile.body)
	}
	if profile.json["status"] != "suspended" || profile.json["version"] != float64(1) {
		t.Errorf("profile = %v/%v, want suspended at version 1", profile.json["status"], profile.json["version"])
	}
	suspension := asObject(t, profile.json["suspension"])
	if suspension["reasonCode"] != "safety_complaint" || suspension["byName"] != "Staff" {
		t.Errorf("suspension = %v", suspension)
	}

	// The assignment engine no longer offers the suspended provider.
	otherBooking, _, _ := seedSearchingBooking(t, env)
	if candidateNames(t, env, adminToken, otherBooking)["Prakash Verma"] {
		t.Errorf("a suspended provider is still an assignment candidate")
	}

	// A stale version gets the designed conflict body, not a silent overwrite.
	stale := adminMutate(t, env, "/ops/providers/"+technicianID.String()+"/restore", `{"version":0}`, adminToken)
	if stale.code != http.StatusConflict || stale.json["code"] != "VERSION_CONFLICT" || stale.json["currentVersion"] != float64(1) {
		t.Errorf("stale restore = %d %v, want the VERSION_CONFLICT body", stale.code, stale.json)
	}

	restored := adminMutate(t, env, "/ops/providers/"+technicianID.String()+"/restore", `{"version":1}`, adminToken)
	if restored.code != http.StatusOK {
		t.Fatalf("restore = %d: %s", restored.code, restored.body)
	}
	if !candidateNames(t, env, adminToken, otherBooking)["Prakash Verma"] {
		t.Errorf("a restored provider should be an assignment candidate again")
	}

	// Both acts are on the audit trail, atomically with the writes.
	assertAuditActions(t, env, "provider", technicianID, "PROVIDER_SUSPEND", "PROVIDER_RESTORE")

	if missing := env.do(t, http.MethodGet, "/ops/providers/"+uuid.NewString(), "", adminToken); missing.code != http.StatusNotFound {
		t.Errorf("unknown provider = %d, want 404", missing.code)
	}
}

// Force-offline flips real availability; block offboards and restore brings the provider back.
func TestAdminForceOfflineAndBlock(t *testing.T) {
	env := newServer(t)
	adminToken := env.staffToken(t, identity.RoleAdmin)
	technicianID := seedRosterTechnician(t, env, "Kiran Kumar", true)

	forced := adminMutate(t, env, "/ops/providers/"+technicianID.String()+"/force-offline",
		`{"type":"force_offline","reasonCode":"other","note":"n","durationDays":null,"jobResolutions":{},"notifyImmediately":false,"version":0}`, adminToken)
	if forced.code != http.StatusOK {
		t.Fatalf("force-offline = %d: %s", forced.code, forced.body)
	}
	var isOnline bool
	if err := env.pool.QueryRow(context.Background(),
		"SELECT is_online FROM technicians WHERE user_id = $1", technicianID).Scan(&isOnline); err != nil {
		t.Fatal(err)
	}
	if isOnline {
		t.Errorf("force-offline left the technician online")
	}

	// The endpoint double-checks the payload's type discriminator.
	mismatched := adminMutate(t, env, "/ops/providers/"+technicianID.String()+"/block",
		`{"type":"suspend","reasonCode":"fraud_suspected","note":"n","durationDays":null,"jobResolutions":{},"notifyImmediately":false,"version":1}`, adminToken)
	if mismatched.code != http.StatusBadRequest {
		t.Errorf("mismatched type = %d, want 400: %s", mismatched.code, mismatched.body)
	}

	blocked := adminMutate(t, env, "/ops/providers/"+technicianID.String()+"/block",
		`{"type":"block","reasonCode":"fraud_suspected","note":"n","durationDays":null,"jobResolutions":{},"notifyImmediately":false,"version":1}`, adminToken)
	if blocked.code != http.StatusOK {
		t.Fatalf("block = %d: %s", blocked.code, blocked.body)
	}
	profile := env.do(t, http.MethodGet, "/ops/providers/"+technicianID.String(), "", adminToken)
	if profile.json["status"] != "offboarded" || profile.json["offboardedAt"] == nil {
		t.Errorf("blocked profile = %v/%v, want offboarded with a timestamp", profile.json["status"], profile.json["offboardedAt"])
	}

	restored := adminMutate(t, env, "/ops/providers/"+technicianID.String()+"/restore", `{"version":2,"note":"cleared"}`, adminToken)
	if restored.code != http.StatusOK || restored.json["status"] == "offboarded" {
		t.Errorf("restore after block = %d %v", restored.code, restored.json)
	}

	// Restoring a provider in good standing is a stale console, not a no-op.
	again := adminMutate(t, env, "/ops/providers/"+technicianID.String()+"/restore", `{"version":3}`, adminToken)
	if again.code != http.StatusUnprocessableEntity {
		t.Errorf("restore of an active provider = %d, want 422", again.code)
	}
}

// The application pipeline: queue segments and counts, the server-computed approval gate,
// approval provisioning a technician who can immediately authenticate, terminal rejection,
// and the request-documents ask.
func TestAdminApplicationPipeline(t *testing.T) {
	env := newServer(t)
	adminToken := env.staffToken(t, identity.RoleAdmin)

	applicantPhone := "+919876500011"
	applicationID := seedApplicationWithDocuments(t, env, "Anand Joshi", applicantPhone)
	otherID := seedApplicationWithDocuments(t, env, "Bhavna Rao", "+919876500022")

	// The queue: both pending, oldest-first shape, document tallies on the row.
	queue := env.do(t, http.MethodGet, "/ops/applications?segment=pending", "", adminToken)
	if queue.code != http.StatusOK {
		t.Fatalf("GET /ops/applications = %d: %s", queue.code, queue.body)
	}
	queueRows := asArray(t, queue.json["rows"])
	if len(queueRows) != 2 {
		t.Fatalf("pending queue = %v, want both applications", queueRows)
	}
	firstRow := asObject(t, queueRows[0])
	if firstRow["documentsPresent"] != float64(2) || firstRow["documentsRequired"] != float64(3) {
		t.Errorf("row documents = %v/%v, want 2 of 3", firstRow["documentsPresent"], firstRow["documentsRequired"])
	}
	if firstRow["awaitingDocumentType"] != "POLICE_VERIFICATION" {
		t.Errorf("awaitingDocumentType = %v, want POLICE_VERIFICATION", firstRow["awaitingDocumentType"])
	}
	counts := asObject(t, queue.json["counts"])
	if counts["pending"] != float64(2) || counts["decided"] != float64(0) {
		t.Errorf("counts = %v", counts)
	}

	// The review computes the blockers server-side.
	review := env.do(t, http.MethodGet, "/ops/applications/"+applicationID.String(), "", adminToken)
	if review.code != http.StatusOK {
		t.Fatalf("review = %d: %s", review.code, review.body)
	}
	blockers := asArray(t, review.json["approvalBlockers"])
	if len(blockers) != 1 || asObject(t, blockers[0])["code"] != "POLICE_VERIFICATION_PENDING" {
		t.Errorf("blockers = %v, want exactly POLICE_VERIFICATION_PENDING", blockers)
	}
	if checks := asArray(t, review.json["autoValidation"]); len(checks) != 2 {
		t.Errorf("autoValidation = %v, want the expiry and ocr checks that actually ran", checks)
	}

	// Approval is refused while the blocker stands — the console only mirrors this gate.
	refused := adminMutate(t, env, "/ops/applications/"+applicationID.String()+"/approve", `{"version":0}`, adminToken)
	if refused.code != http.StatusUnprocessableEntity {
		t.Errorf("blocked approve = %d, want 422: %s", refused.code, refused.body)
	}

	// Clear the blocker and approve: a TECHNICIAN identity exists and can log in via OTP.
	env.exec(t, `UPDATE provider_application_documents SET validation = 'validated', uploaded_at = now()
		WHERE application_id = $1 AND document_type = 'POLICE_VERIFICATION'`, applicationID)
	env.exec(t, `UPDATE provider_applications SET background_cleared_at = now() WHERE id = $1`, applicationID)
	approved := adminMutate(t, env, "/ops/applications/"+applicationID.String()+"/approve", `{"version":0}`, adminToken)
	if approved.code != http.StatusOK {
		t.Fatalf("approve = %d: %s", approved.code, approved.body)
	}
	if approved.json["applicantName"] != "Anand Joshi" {
		t.Errorf("approve result = %v", approved.json)
	}

	otpBody := fmt.Sprintf(`{"phone":%q}`, applicantPhone)
	otpResponse := env.do(t, http.MethodPost, "/auth/otp", otpBody, "")
	devCode := mustString(t, otpResponse.json, "dev_code")
	verify := env.do(t, http.MethodPost, "/auth/verify", fmt.Sprintf(`{"phone":%q,"code":%q}`, applicantPhone, devCode), "")
	if verify.code != http.StatusOK {
		t.Fatalf("approved applicant login = %d: %s", verify.code, verify.body)
	}
	if verify.json["role"] != "TECHNICIAN" {
		t.Errorf("approved applicant role = %v, want TECHNICIAN", verify.json["role"])
	}

	// Rejection: the note floor is enforced, the decision is terminal and audited.
	shortNote := adminMutate(t, env, "/ops/applications/"+otherID.String()+"/reject",
		`{"reasonCode":"insufficient_experience","note":"too short","version":0}`, adminToken)
	if shortNote.code != http.StatusUnprocessableEntity {
		t.Errorf("short note = %d, want 422", shortNote.code)
	}
	rejected := adminMutate(t, env, "/ops/applications/"+otherID.String()+"/reject",
		`{"reasonCode":"insufficient_experience","note":"claimed years of experience are not supported by any certificate","version":0}`, adminToken)
	if rejected.code != http.StatusOK {
		t.Fatalf("reject = %d: %s", rejected.code, rejected.body)
	}

	// Terminal: a later approval meets the ALREADY_DECIDED body, decision included.
	late := adminMutate(t, env, "/ops/applications/"+otherID.String()+"/approve", `{"version":1}`, adminToken)
	if late.code != http.StatusConflict || late.json["code"] != "ALREADY_DECIDED" {
		t.Fatalf("approve after reject = %d %v, want the ALREADY_DECIDED body", late.code, late.json)
	}
	decision := asObject(t, late.json["decision"])
	if decision["outcome"] != "rejected" || decision["byName"] != "Staff" {
		t.Errorf("decision = %v", decision)
	}

	// The decided segment now carries both records.
	decided := env.do(t, http.MethodGet, "/ops/applications?segment=decided", "", adminToken)
	if rows := asArray(t, decided.json["rows"]); len(rows) != 2 {
		t.Errorf("decided segment = %v, want both decisions", rows)
	}

	assertAuditActions(t, env, "application", applicationID, "APPLICATION_APPROVE")
	assertAuditActions(t, env, "application", otherID, "APPLICATION_REJECT")
}

// Request-documents moves the application to awaiting_docs and puts the asked-for types on
// the checklist as missing.
func TestAdminRequestApplicationDocuments(t *testing.T) {
	env := newServer(t)
	adminToken := env.staffToken(t, identity.RoleAdmin)
	applicationID := seedApplicationWithDocuments(t, env, "Chetan Naik", "+919876500033")

	requested := adminMutate(t, env, "/ops/applications/"+applicationID.String()+"/request-documents",
		`{"documentTypes":["BANK_PASSBOOK"],"note":"passbook photo please","version":0}`, adminToken)
	if requested.code != http.StatusOK {
		t.Fatalf("request-documents = %d: %s", requested.code, requested.body)
	}
	if requested.json["version"] != float64(1) || requested.json["sentAt"] == nil {
		t.Errorf("request result = %v", requested.json)
	}

	awaiting := env.do(t, http.MethodGet, "/ops/applications?segment=awaitingDocs", "", adminToken)
	rows := asArray(t, awaiting.json["rows"])
	if len(rows) != 1 || asObject(t, rows[0])["status"] != "awaiting_docs" {
		t.Fatalf("awaitingDocs segment = %v", rows)
	}

	review := env.do(t, http.MethodGet, "/ops/applications/"+applicationID.String(), "", adminToken)
	documents := asArray(t, review.json["documents"])
	if len(documents) != 4 {
		t.Errorf("documents = %d rows, want the 3 seeded plus the requested passbook", len(documents))
	}
}

// candidateNames reads the assignment engine's candidate list for a booking.
func candidateNames(t *testing.T, env *testEnv, adminToken, bookingID string) map[string]bool {
	t.Helper()
	response := env.do(t, http.MethodGet, "/ops/bookings/"+bookingID+"/candidates", "", adminToken)
	if response.code != http.StatusOK {
		t.Fatalf("candidates = %d: %s", response.code, response.body)
	}
	names := map[string]bool{}
	for _, candidate := range asArray(t, response.json["candidates"]) {
		names[mustString(t, asObject(t, candidate), "name")] = true
	}
	return names
}

// assertAuditActions checks that each action was recorded against the entity.
func assertAuditActions(t *testing.T, env *testEnv, entityType string, entityID uuid.UUID, actions ...string) {
	t.Helper()
	for _, action := range actions {
		var recorded bool
		if err := env.pool.QueryRow(context.Background(),
			"SELECT EXISTS (SELECT 1 FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 AND action = $3)",
			entityType, entityID, action).Scan(&recorded); err != nil {
			t.Fatal(err)
		}
		if !recorded {
			t.Errorf("no %s audit entry for %s %s", action, entityType, entityID)
		}
	}
}

// seedApplicationWithDocuments inserts a pending application with two validated documents
// (one carrying an expiry, one carrying OCR data) and a missing police verification.
func seedApplicationWithDocuments(t *testing.T, env *testEnv, name, phone string) uuid.UUID {
	t.Helper()
	applicationID := uuid.New()
	env.exec(t, `INSERT INTO provider_applications
			(id, applicant_name, phone, email, address, zone, status, documents_required)
		VALUES ($1, $2, $3, 'applicant@example.in', '12 MG Road', 'Bengaluru', 'pending', 3)`,
		applicationID, name, phone)
	env.exec(t, `INSERT INTO provider_application_categories (application_id, name, years_claimed)
		VALUES ($1, 'AC Repair', 4)`, applicationID)
	env.exec(t, `INSERT INTO provider_application_documents
			(application_id, document_type, validation, uploaded_at, expires_at)
		VALUES ($1, 'AADHAAR', 'validated', now(), now() + interval '2 years')`, applicationID)
	env.exec(t, `INSERT INTO provider_application_documents
			(application_id, document_type, validation, uploaded_at, ocr_read, ocr_expected)
		VALUES ($1, 'PAN', 'validated', now(), 'ABCDE1234F', 'ABCDE1234F')`, applicationID)
	env.exec(t, `INSERT INTO provider_application_documents (application_id, document_type, validation)
		VALUES ($1, 'POLICE_VERIFICATION', 'missing')`, applicationID)
	return applicationID
}
