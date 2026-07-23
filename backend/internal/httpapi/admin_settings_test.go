package httpapi_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)

// End-to-end coverage for the admin settings family: profile and preferences, notification
// channels, security state, version, queued actions, and diagnostics — over the same demo
// sign-in the dev recipe uses.

// The profile serves the seeded identity with a masked phone, and preferences round-trip
// through PUT with the whole updated object coming back.
func TestAdminProfileRoundTrip(t *testing.T) {
	env := newAdminAccountServer(t)
	seedDemoAdmin(t, env)
	token := signInAdmin(t, env, "dev_p", "iPhone 14", false)

	profile := doAdmin(t, env, http.MethodGet, "/admin/profile", "", token, nil)
	if profile.code != http.StatusOK {
		t.Fatalf("GET profile = %d: %s", profile.code, profile.body)
	}
	if profile.json["email"] != demoAdminEmail || profile.json["name"] != "Demo Admin" || profile.json["role"] != "ADMIN" {
		t.Errorf("profile identity = %s", profile.body)
	}
	if masked := mustString(t, profile.json, "maskedPhone"); strings.Contains(masked, "90000000") || masked == "" {
		t.Errorf("maskedPhone = %q, want a masked number", masked)
	}
	preferences := asObject(t, profile.json["preferences"])
	if preferences["appearance"] != "system" || preferences["haptics"] != true || preferences["defaultLandingRoute"] != "/live" {
		t.Errorf("default preferences = %v", preferences)
	}
	activity := asObject(t, profile.json["activity"])
	if activity["escalationsAcknowledged"] != float64(0) || activity["bookingsRescued"] != float64(0) {
		t.Errorf("activity = %v, want honest zeros for engines that do not exist", activity)
	}

	update := doAdmin(t, env, http.MethodPut, "/admin/profile",
		`{"preferences":{"appearance":"dark","haptics":false,"defaultLandingRoute":"/bookings"}}`,
		token, map[string]string{"Idempotency-Key": "prefs-1"})
	if update.code != http.StatusOK {
		t.Fatalf("PUT profile = %d: %s", update.code, update.body)
	}
	updated := asObject(t, update.json["preferences"])
	if updated["appearance"] != "dark" || updated["haptics"] != false || updated["defaultLandingRoute"] != "/bookings" {
		t.Errorf("updated preferences = %v", updated)
	}

	again := doAdmin(t, env, http.MethodGet, "/admin/profile", "", token, nil)
	if asObject(t, again.json["preferences"])["appearance"] != "dark" {
		t.Errorf("preferences did not persist: %s", again.body)
	}
}

// Notification settings default sensibly, round-trip whole, and reject malformed clock
// times and smuggled critical channels.
func TestAdminNotificationSettingsRoundTrip(t *testing.T) {
	env := newAdminAccountServer(t)
	seedDemoAdmin(t, env)
	token := signInAdmin(t, env, "dev_n", "Pixel 8", false)

	defaults := doAdmin(t, env, http.MethodGet, "/admin/settings/notifications", "", token, nil)
	if defaults.code != http.StatusOK {
		t.Fatalf("GET notifications = %d: %s", defaults.code, defaults.body)
	}
	channels := asObject(t, defaults.json["channels"])
	if channels["slaAtRisk"] != true || channels["dailySummary"] != true || len(channels) != 8 {
		t.Errorf("default channels = %v, want the 8 configurable ones on", channels)
	}
	if defaults.json["queuedDuringQuietHours"] != float64(0) {
		t.Errorf("queuedDuringQuietHours = %v, want the honest 0", defaults.json["queuedDuringQuietHours"])
	}

	updateBody := `{"channels":{"slaAtRisk":false,"providerNoShow":true,"zoneSupplyCritical":true,` +
		`"paymentFailure":true,"newApplications":false,"autoSuspensions":true,"documentExpiring":true,` +
		`"dailySummary":false},"criticalSound":"chime","digestTime":"09:30",` +
		`"quietHours":{"enabled":true,"from":"23:00","to":"06:30"},"vibrate":false}`
	update := doAdmin(t, env, http.MethodPut, "/admin/settings/notifications", updateBody, token,
		map[string]string{"Idempotency-Key": "notif-1"})
	if update.code != http.StatusOK {
		t.Fatalf("PUT notifications = %d: %s", update.code, update.body)
	}
	if asObject(t, update.json["channels"])["slaAtRisk"] != false || update.json["digestTime"] != "09:30" {
		t.Errorf("updated settings = %s", update.body)
	}
	quiet := asObject(t, update.json["quietHours"])
	if quiet["enabled"] != true || quiet["from"] != "23:00" {
		t.Errorf("quietHours = %v", quiet)
	}

	persisted := doAdmin(t, env, http.MethodGet, "/admin/settings/notifications", "", token, nil)
	if persisted.json["criticalSound"] != "chime" || persisted.json["vibrate"] != false {
		t.Errorf("settings did not persist: %s", persisted.body)
	}

	badClock := strings.Replace(updateBody, `"digestTime":"09:30"`, `"digestTime":"25:99"`, 1)
	if rejected := doAdmin(t, env, http.MethodPut, "/admin/settings/notifications", badClock, token,
		map[string]string{"Idempotency-Key": "notif-2"}); rejected.code != http.StatusUnprocessableEntity {
		t.Errorf("malformed clock time = %d, want 422", rejected.code)
	}

	// A critical channel is not a preference; a body that smuggles one in is refused.
	smuggled := strings.Replace(updateBody, `"slaAtRisk":false`, `"slaAtRisk":false,"bookingEscalated":false`, 1)
	if rejected := doAdmin(t, env, http.MethodPut, "/admin/settings/notifications", smuggled, token,
		map[string]string{"Idempotency-Key": "notif-3"}); rejected.code != http.StatusUnprocessableEntity {
		t.Errorf("smuggled critical channel = %d, want 422", rejected.code)
	}
}

// The security screen reflects the trusted device, the open session, the sign-in events
// the flows audited, and the biometric toggle round-trips.
func TestAdminSecuritySettings(t *testing.T) {
	env := newAdminAccountServer(t)
	seedDemoAdmin(t, env)
	token := signInAdmin(t, env, "dev_s", "iPhone 14", true)

	security := doAdmin(t, env, http.MethodGet, "/admin/settings/security", "", token, nil)
	if security.code != http.StatusOK {
		t.Fatalf("GET security = %d: %s", security.code, security.body)
	}
	if security.json["biometricUnlock"] != false || security.json["deviceLimit"] != float64(3) {
		t.Errorf("security defaults = %s", security.body)
	}
	if security.json["activeSessions"] != float64(1) {
		t.Errorf("activeSessions = %v, want the one open session", security.json["activeSessions"])
	}
	devices := asArray(t, security.json["devices"])
	if len(devices) != 1 {
		t.Fatalf("devices = %v, want the one signed-in device", devices)
	}
	device := asObject(t, devices[0])
	if device["name"] != "iPhone 14" || device["kind"] != "phone" || device["isCurrent"] != true {
		t.Errorf("device row = %v", device)
	}
	events := asArray(t, security.json["events"])
	if len(events) < 2 {
		t.Fatalf("events = %v, want at least signedIn + deviceTrusted", events)
	}
	kinds := map[string]bool{}
	for _, entry := range events {
		if kind, isString := asObject(t, entry)["kind"].(string); isString {
			kinds[kind] = true
		}
	}
	if !kinds["signedIn"] || !kinds["deviceTrusted"] {
		t.Errorf("event kinds = %v", kinds)
	}

	toggled := doAdmin(t, env, http.MethodPatch, "/admin/settings/security", `{"biometricUnlock":true}`, token,
		map[string]string{"Idempotency-Key": "sec-1"})
	if toggled.code != http.StatusOK || toggled.json["biometricUnlock"] != true {
		t.Fatalf("PATCH security = %d %s", toggled.code, toggled.body)
	}

	// A failed sign-in shows up in the events feed.
	wrongBody := strings.Replace(adminLoginBody("dev_s", "iPhone 14"), demoAdminPassword, "wrongpass99", 1)
	doAdmin(t, env, http.MethodPost, "/admin/auth/login", wrongBody, "", nil)
	after := doAdmin(t, env, http.MethodGet, "/admin/settings/security", "", token, nil)
	found := false
	for _, entry := range asArray(t, after.json["events"]) {
		if asObject(t, entry)["kind"] == "failedSignIn" {
			found = true
		}
	}
	if !found {
		t.Errorf("failed sign-in missing from events: %s", after.body)
	}
}

// Version, queued actions, logout and refresh: the small honest endpoints.
func TestAdminSessionAndSupportEndpoints(t *testing.T) {
	env := newAdminAccountServer(t)
	seedDemoAdmin(t, env)
	token := signInAdmin(t, env, "dev_v", "MacBook Pro", true)

	version := doAdmin(t, env, http.MethodGet, "/admin/version", "", token, nil)
	if version.code != http.StatusOK || version.json["environment"] != "development" {
		t.Errorf("version = %d %s", version.code, version.body)
	}

	queued := doAdmin(t, env, http.MethodGet, "/admin/queued-actions/count", "", token, nil)
	if queued.code != http.StatusOK || queued.json["count"] != float64(0) {
		t.Errorf("queued actions = %d %s, want the honest 0", queued.code, queued.body)
	}

	refreshed := doAdmin(t, env, http.MethodPost, "/admin/auth/refresh", "", token, nil)
	if refreshed.code != http.StatusOK || mustString(t, refreshed.json, "token") == "" {
		t.Fatalf("refresh = %d: %s", refreshed.code, refreshed.body)
	}
	if asObject(t, refreshed.json["user"])["email"] != demoAdminEmail {
		t.Errorf("refreshed session user = %s", refreshed.body)
	}

	logout := doAdmin(t, env, http.MethodPost, "/admin/auth/logout", "", token,
		map[string]string{"Idempotency-Key": "logout-1"})
	if logout.code != http.StatusNoContent && logout.code != http.StatusOK {
		t.Fatalf("logout = %d: %s", logout.code, logout.body)
	}
	security := doAdmin(t, env, http.MethodGet, "/admin/settings/security", "", token, nil)
	if security.json["activeSessions"] != float64(0) {
		t.Errorf("activeSessions after logout = %v, want 0", security.json["activeSessions"])
	}
}

// Diagnostics: a clean payload stores once per Idempotency-Key; customer PII is refused.
func TestAdminDiagnostics(t *testing.T) {
	env := newAdminAccountServer(t)
	seedDemoAdmin(t, env)
	token := signInAdmin(t, env, "dev_d", "iPhone 14", false)

	cleanBody := `{"appVersion":"1.4.0","deviceModel":"iPhone 14","osVersion":"iOS 19.2",` +
		`"logs":["boot ok","sync ok"],"networkEvents":["GET /ops/shell-counters 200"]}`
	first := doAdmin(t, env, http.MethodPost, "/admin/diagnostics", cleanBody, token,
		map[string]string{"Idempotency-Key": "diag-1"})
	if first.code != http.StatusAccepted {
		t.Fatalf("diagnostics = %d: %s", first.code, first.body)
	}
	reference := mustString(t, first.json, "reference")
	if !strings.HasPrefix(reference, "diag_") {
		t.Errorf("reference = %q", reference)
	}

	replay := doAdmin(t, env, http.MethodPost, "/admin/diagnostics", cleanBody, token,
		map[string]string{"Idempotency-Key": "diag-1"})
	if replay.code != http.StatusAccepted || mustString(t, replay.json, "reference") != reference {
		t.Errorf("replayed key = %d %s, want the first receipt %q", replay.code, replay.body, reference)
	}

	piiBody := fmt.Sprintf(`{"appVersion":"1.4.0","deviceModel":"iPhone 14","osVersion":"iOS 19.2",`+
		`"logs":[%q],"networkEvents":[]}`, "customer 9876543210 called about a refund")
	if rejected := doAdmin(t, env, http.MethodPost, "/admin/diagnostics", piiBody, token,
		map[string]string{"Idempotency-Key": "diag-2"}); rejected.code != http.StatusUnprocessableEntity {
		t.Errorf("PII payload = %d, want the declared 422", rejected.code)
	}
}
