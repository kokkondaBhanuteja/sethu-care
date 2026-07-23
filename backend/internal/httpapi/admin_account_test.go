package httpapi_test

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/kokkondaBhanuteja/sethu-care/internal/address"
	"github.com/kokkondaBhanuteja/sethu-care/internal/adminaccount"
	"github.com/kokkondaBhanuteja/sethu-care/internal/audit"
	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/catalog"
	"github.com/kokkondaBhanuteja/sethu-care/internal/httpapi"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/media"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
	"github.com/kokkondaBhanuteja/sethu-care/internal/reviews"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
	"github.com/kokkondaBhanuteja/sethu-care/internal/verification"
)

// End-to-end coverage for the admin console's sign-in and settings families. The server
// here mirrors the DEV RECIPE exactly: identity carries the demo account (the reserved
// phone + static code), so the second factor is passable the same way the console passes
// it in development — never by echoing a code in a response.

const (
	demoAdminPhone    = "+919000000008"
	demoAdminCode     = "123456"
	demoAdminEmail    = "ops@setucare.in"
	demoAdminPassword = "password123"
)

// newAdminAccountServer is newServer with the demo second factor wired, as .env wires it.
func newAdminAccountServer(t *testing.T) *testEnv {
	t.Helper()
	pool := storagetest.NewPool(t, migrationsDir)
	signer, err := auth.NewSigner(testSecret, time.Hour)
	if err != nil {
		t.Fatalf("signer: %v", err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	bookingService := booking.NewService(pool)
	verifier := verification.NewService(pool)
	identityService := identity.NewService(pool, identity.WithDemoAccount(demoAdminPhone, demoAdminCode))
	mux := http.NewServeMux()
	api := httpapi.NewHumaAPI(mux, signer)
	httpapi.RegisterAll(api, httpapi.Dependencies{
		Identity:      identityService,
		Catalog:       catalog.New(pool),
		Address:       address.New(pool),
		Ops:           ops.New(pool, bookingService),
		Ledger:        ledger.NewService(pool),
		Audit:         audit.NewService(pool),
		Verification:  verifier,
		Booking:       bookingService,
		Reviews:       reviews.NewService(pool),
		Cloudinary:    media.NewCloudinary("democloud", "demokey", "demosecret"),
		Signer:        signer,
		DevEchoOTP:    true,
		Logger:        log,
		AdminAccounts: adminaccount.NewService(pool, identityService),
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return &testEnv{srv: srv, pool: pool, signer: signer, verifier: verifier}
}

// seedDemoAdmin provisions the same account db/seed.sql provisions for the console.
func seedDemoAdmin(t *testing.T, env *testEnv) uuid.UUID {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(demoAdminPassword), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hashing seed password: %v", err)
	}
	userID := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Demo Admin', 'ADMIN')", userID, demoAdminPhone)
	env.exec(t, "INSERT INTO admin_accounts (user_id, email, password_hash, display_name) VALUES ($1, $2, $3, 'Demo Admin')",
		userID, demoAdminEmail, string(hash))
	return userID
}

// doAdmin issues a request with a body, a bearer, and any extra headers (Idempotency-Key).
func doAdmin(t *testing.T, env *testEnv, method, path, body, token string, headers map[string]string) result {
	t.Helper()
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	request, err := http.NewRequest(method, env.srv.URL+path, reader)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	for name, value := range headers {
		request.Header.Set(name, value)
	}
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
		out.json = map[string]any{}
		if err := json.Unmarshal(raw, &out.json); err != nil {
			t.Logf("response body was not json (%v): %s", err, out.body)
			out.json = nil
		}
	}
	return out
}

func adminLoginBody(deviceID, deviceName string) string {
	return fmt.Sprintf(`{"email":%q,"password":%q,"deviceId":%q,"deviceName":%q}`,
		demoAdminEmail, demoAdminPassword, deviceID, deviceName)
}

// signInAdmin walks login → 2fa and returns the bearer token.
func signInAdmin(t *testing.T, env *testEnv, deviceID, deviceName string, trust bool) string {
	t.Helper()
	login := doAdmin(t, env, http.MethodPost, "/admin/auth/login", adminLoginBody(deviceID, deviceName), "", nil)
	if login.code != http.StatusOK {
		t.Fatalf("login = %d: %s", login.code, login.body)
	}
	if login.json["status"] == "authenticated" {
		session := asObject(t, login.json["session"])
		return mustString(t, session, "token")
	}
	challenge := asObject(t, login.json["challenge"])
	verifyBody := fmt.Sprintf(`{"challengeId":%q,"code":%q,"deviceId":%q,"trustDevice":%t}`,
		mustString(t, challenge, "challengeId"), demoAdminCode, deviceID, trust)
	verify := doAdmin(t, env, http.MethodPost, "/admin/auth/2fa", verifyBody, "", nil)
	if verify.code != http.StatusOK {
		t.Fatalf("2fa = %d: %s", verify.code, verify.body)
	}
	return mustString(t, verify.json, "token")
}

// The full designed sign-in: wrong password 401, first factor to a masked challenge, a
// wrong code spending the budget, the demo code opening a session whose bearer passes the
// ops middleware as ADMIN.
func TestAdminLoginFullFlow(t *testing.T) {
	env := newAdminAccountServer(t)
	seedDemoAdmin(t, env)

	wrong := doAdmin(t, env, http.MethodPost, "/admin/auth/login",
		strings.Replace(adminLoginBody("dev_1", "iPhone 14"), demoAdminPassword, "wrongpass99", 1), "", nil)
	if wrong.code != http.StatusUnauthorized || wrong.json["error"] != "INVALID_CREDENTIALS" {
		t.Fatalf("wrong password = %d %s, want the declared 401", wrong.code, wrong.body)
	}

	login := doAdmin(t, env, http.MethodPost, "/admin/auth/login", adminLoginBody("dev_1", "iPhone 14"), "", nil)
	if login.code != http.StatusOK || login.json["status"] != "otp_required" {
		t.Fatalf("login = %d %s, want otp_required", login.code, login.body)
	}
	challenge := asObject(t, login.json["challenge"])
	if masked := mustString(t, challenge, "maskedMobile"); strings.Contains(masked, "90000000") || !strings.Contains(masked, "•") {
		t.Errorf("maskedMobile = %q leaks the number", masked)
	}
	if challenge["attemptsRemaining"] != float64(3) {
		t.Errorf("attemptsRemaining = %v, want the 3-guess budget", challenge["attemptsRemaining"])
	}
	challengeID := mustString(t, challenge, "challengeId")

	badCode := doAdmin(t, env, http.MethodPost, "/admin/auth/2fa",
		fmt.Sprintf(`{"challengeId":%q,"code":"000000","deviceId":"dev_1","trustDevice":false}`, challengeID), "", nil)
	if badCode.code != http.StatusBadRequest || badCode.json["error"] != "INVALID_OTP" || badCode.json["attemptsRemaining"] != float64(2) {
		t.Fatalf("wrong code = %d %s, want INVALID_OTP with 2 left", badCode.code, badCode.body)
	}

	verify := doAdmin(t, env, http.MethodPost, "/admin/auth/2fa",
		fmt.Sprintf(`{"challengeId":%q,"code":%q,"deviceId":"dev_1","trustDevice":true}`, challengeID, demoAdminCode), "", nil)
	if verify.code != http.StatusOK {
		t.Fatalf("2fa = %d: %s", verify.code, verify.body)
	}
	token := mustString(t, verify.json, "token")
	if verify.json["permissions"] != nil {
		t.Errorf("permissions = %v, want null (full access)", verify.json["permissions"])
	}
	user := asObject(t, verify.json["user"])
	if user["email"] != demoAdminEmail || user["role"] != "ADMIN" {
		t.Errorf("session user = %v", user)
	}

	// The bearer is a plain Signer token with RoleAdmin: the ops middleware must accept it.
	counters := doAdmin(t, env, http.MethodGet, "/ops/shell-counters", "", token, nil)
	if counters.code != http.StatusOK {
		t.Fatalf("ops call with admin session token = %d: %s", counters.code, counters.body)
	}

	// A replayed challenge is dead: the envelope was consumed by the successful sign-in.
	replay := doAdmin(t, env, http.MethodPost, "/admin/auth/2fa",
		fmt.Sprintf(`{"challengeId":%q,"code":%q,"deviceId":"dev_1","trustDevice":false}`, challengeID, demoAdminCode), "", nil)
	if replay.code != http.StatusGone || replay.json["error"] != "OTP_EXPIRED" {
		t.Errorf("replayed challenge = %d %s, want 410 OTP_EXPIRED", replay.code, replay.body)
	}
}

// A trusted device skips the second factor on its next login.
func TestAdminTrustedDeviceSkipsSecondFactor(t *testing.T) {
	env := newAdminAccountServer(t)
	seedDemoAdmin(t, env)

	signInAdmin(t, env, "dev_trusted", "iPhone 14", true)

	again := doAdmin(t, env, http.MethodPost, "/admin/auth/login", adminLoginBody("dev_trusted", "iPhone 14"), "", nil)
	if again.code != http.StatusOK || again.json["status"] != "authenticated" {
		t.Fatalf("trusted login = %d %s, want authenticated", again.code, again.body)
	}
	session := asObject(t, again.json["session"])
	if mustString(t, session, "token") == "" {
		t.Errorf("trusted login carried no token")
	}

	// An untrusted sign-in (trustDevice=false) earns no skip.
	signInAdmin(t, env, "dev_untrusted", "Pixel 8", false)
	untrusted := doAdmin(t, env, http.MethodPost, "/admin/auth/login", adminLoginBody("dev_untrusted", "Pixel 8"), "", nil)
	if untrusted.code != http.StatusOK || untrusted.json["status"] != "otp_required" {
		t.Errorf("untrusted device login = %d %v, want otp_required again", untrusted.code, untrusted.json["status"])
	}
}

// Five wrong passwords lock the account (423 + countdown); a correct password stays locked
// out; unlock with the password clears the lock.
func TestAdminLockoutThenUnlock(t *testing.T) {
	env := newAdminAccountServer(t)
	seedDemoAdmin(t, env)
	token := signInAdmin(t, env, "dev_lock", "MacBook Pro", false)

	wrongBody := strings.Replace(adminLoginBody("dev_lock", "MacBook Pro"), demoAdminPassword, "wrongpass99", 1)
	for attempt := 1; attempt <= 4; attempt++ {
		if got := doAdmin(t, env, http.MethodPost, "/admin/auth/login", wrongBody, "", nil); got.code != http.StatusUnauthorized {
			t.Fatalf("failure %d = %d, want 401", attempt, got.code)
		}
	}
	locked := doAdmin(t, env, http.MethodPost, "/admin/auth/login", wrongBody, "", nil)
	if locked.code != http.StatusLocked || locked.json["error"] != "ACCOUNT_LOCKED" {
		t.Fatalf("fifth failure = %d %s, want the declared 423", locked.code, locked.body)
	}
	if retryAfter, ok := locked.json["retryAfter"].(float64); !ok || retryAfter <= 0 || retryAfter > 15*60 {
		t.Errorf("retryAfter = %v, want a live countdown within 15 minutes", locked.json["retryAfter"])
	}

	// Even the correct password bounces off a locked account.
	still := doAdmin(t, env, http.MethodPost, "/admin/auth/login", adminLoginBody("dev_lock", "MacBook Pro"), "", nil)
	if still.code != http.StatusLocked {
		t.Fatalf("correct password while locked = %d, want 423", still.code)
	}

	wrongUnlock := doAdmin(t, env, http.MethodPost, "/admin/auth/unlock", `{"password":"wrongpass99"}`, token, nil)
	if wrongUnlock.code != http.StatusUnauthorized {
		t.Fatalf("wrong unlock password = %d, want 401", wrongUnlock.code)
	}
	unlock := doAdmin(t, env, http.MethodPost, "/admin/auth/unlock", fmt.Sprintf(`{"password":%q}`, demoAdminPassword), token, nil)
	if unlock.code != http.StatusNoContent && unlock.code != http.StatusOK {
		t.Fatalf("unlock = %d: %s", unlock.code, unlock.body)
	}
	cleared := doAdmin(t, env, http.MethodPost, "/admin/auth/login", adminLoginBody("dev_lock", "MacBook Pro"), "", nil)
	if cleared.code != http.StatusOK {
		t.Fatalf("login after unlock = %d: %s", cleared.code, cleared.body)
	}
}

// The fourth trust request hits the 3-slot cap with the occupied slots in the body;
// revoking one (including the current device's own sign-out semantics) frees the retry.
func TestAdminDeviceLimitAndRevoke(t *testing.T) {
	env := newAdminAccountServer(t)
	seedDemoAdmin(t, env)

	var token string
	for slot := 1; slot <= 3; slot++ {
		token = signInAdmin(t, env, fmt.Sprintf("dev_%d", slot), fmt.Sprintf("iPhone %d", slot), true)
	}

	login := doAdmin(t, env, http.MethodPost, "/admin/auth/login", adminLoginBody("dev_4", "iPad Air"), "", nil)
	challenge := asObject(t, login.json["challenge"])
	challengeID := mustString(t, challenge, "challengeId")
	verifyBody := fmt.Sprintf(`{"challengeId":%q,"code":%q,"deviceId":"dev_4","trustDevice":true}`, challengeID, demoAdminCode)

	limited := doAdmin(t, env, http.MethodPost, "/admin/auth/2fa", verifyBody, "", nil)
	if limited.code != http.StatusConflict || limited.json["error"] != "DEVICE_LIMIT_REACHED" {
		t.Fatalf("fourth trust = %d %s, want the declared 409", limited.code, limited.body)
	}
	slots := asArray(t, limited.json["devices"])
	if len(slots) != 3 {
		t.Fatalf("devices = %v, want the 3 occupied slots", slots)
	}
	evicted := asObject(t, slots[len(slots)-1])
	evictedID := mustString(t, evicted, "id")

	revoke := doAdmin(t, env, http.MethodDelete, "/admin/auth/devices/"+evictedID, "", token,
		map[string]string{"Idempotency-Key": "revoke-1"})
	if revoke.code != http.StatusOK {
		t.Fatalf("revoke = %d: %s", revoke.code, revoke.body)
	}
	// Replaying the revoke returns the first outcome's device rather than a 404.
	replay := doAdmin(t, env, http.MethodDelete, "/admin/auth/devices/"+evictedID, "", token,
		map[string]string{"Idempotency-Key": "revoke-1"})
	if replay.code != http.StatusOK || replay.json["sessionInvalidated"] != false {
		t.Errorf("revoke replay = %d %s, want the idempotent 200", replay.code, replay.body)
	}

	// The slot freed, the SAME code retries successfully — the 409 must not have spent it.
	retried := doAdmin(t, env, http.MethodPost, "/admin/auth/2fa", verifyBody, "", nil)
	if retried.code != http.StatusOK {
		t.Fatalf("retry after revoke = %d: %s", retried.code, retried.body)
	}

	devices := doAdmin(t, env, http.MethodGet, "/admin/auth/devices", "", token, nil)
	if devices.code != http.StatusOK || len(asArray(t, devices.json["items"])) != 3 {
		t.Errorf("device list = %d %s, want the 3 current slots", devices.code, devices.body)
	}

	if missing := doAdmin(t, env, http.MethodDelete, "/admin/auth/devices/"+uuid.NewString(), "", token,
		map[string]string{"Idempotency-Key": "revoke-2"}); missing.code != http.StatusNotFound {
		t.Errorf("unknown device revoke = %d, want 404", missing.code)
	}
}

// Resends are budgeted 3 per 10 minutes, only the newest challenge stays valid, and the
// breach carries the declared resetAt.
func TestAdminResendBudget(t *testing.T) {
	env := newAdminAccountServer(t)
	seedDemoAdmin(t, env)

	login := doAdmin(t, env, http.MethodPost, "/admin/auth/login", adminLoginBody("dev_r", "iPhone 14"), "", nil)
	firstChallengeID := mustString(t, asObject(t, login.json["challenge"]), "challengeId")

	currentID := firstChallengeID
	for resend := 1; resend <= 2; resend++ {
		fresh := doAdmin(t, env, http.MethodPost, "/admin/auth/2fa/resend",
			fmt.Sprintf(`{"challengeId":%q}`, currentID), "", nil)
		if fresh.code != http.StatusOK {
			t.Fatalf("resend %d = %d: %s", resend, fresh.code, fresh.body)
		}
		currentID = mustString(t, fresh.json, "challengeId")
	}

	breached := doAdmin(t, env, http.MethodPost, "/admin/auth/2fa/resend",
		fmt.Sprintf(`{"challengeId":%q}`, currentID), "", nil)
	if breached.code != http.StatusTooManyRequests {
		t.Fatalf("fourth code in the window = %d %s, want 429", breached.code, breached.body)
	}
	if _, ok := breached.json["resetAt"].(string); !ok {
		t.Errorf("429 body = %s, want a resetAt instant", breached.body)
	}

	// Only the latest challenge is valid; the superseded one answers 410.
	stale := doAdmin(t, env, http.MethodPost, "/admin/auth/2fa",
		fmt.Sprintf(`{"challengeId":%q,"code":%q,"deviceId":"dev_r","trustDevice":false}`, firstChallengeID, demoAdminCode), "", nil)
	if stale.code != http.StatusGone {
		t.Errorf("superseded challenge = %d, want 410", stale.code)
	}
}

// Bootstrap is unauthenticated and serves the honest static answers.
func TestAdminBootstrapAnswers(t *testing.T) {
	env := newAdminAccountServer(t)
	boot := doAdmin(t, env, http.MethodGet, "/admin/auth/bootstrap", "", "", nil)
	if boot.code != http.StatusOK {
		t.Fatalf("bootstrap = %d: %s", boot.code, boot.body)
	}
	if boot.json["hasSession"] != false || boot.json["isVersionSupported"] != true {
		t.Errorf("bootstrap = %s, want hasSession false / isVersionSupported true", boot.body)
	}
}
