package httpapi_test

import (
	"bytes"
	"context"
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
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/address"
	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/catalog"
	"github.com/kokkondaBhanuteja/sethu-care/internal/httpapi"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

const (
	migrationsDir = "../../db/migrations"
	testSecret    = "test-secret-at-least-thirty-two-bytes-long!!"
)

// The happy path, driven entirely over HTTP as an authenticated customer: create a booking,
// read it, then walk it through the first few transitions.
func TestBookingLifecycleOverHTTP(t *testing.T) {
	env := newServer(t)

	customer, address := env.seedCustomerAndAddress(t)
	variant := env.seedService(t, "599")
	tok := env.token(t, customer, identity.RoleCustomer)

	// POST /bookings -> 201. No customer_id in the body — it comes from the token.
	body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, variant)
	resp := env.do(t, http.MethodPost, "/bookings", body, tok)
	if resp.code != http.StatusCreated {
		t.Fatalf("POST /bookings = %d, want 201; body=%s", resp.code, resp.body)
	}
	if resp.json["state"] != "DRAFT" {
		t.Errorf("created state = %v, want DRAFT", resp.json["state"])
	}
	if got := resp.json["quoted_total_paise"]; got != float64(59900) {
		t.Errorf("quoted_total_paise = %v, want 59900", got)
	}
	bookingID := mustString(t, resp.json, "booking_id")

	resp = env.do(t, http.MethodGet, "/bookings/"+bookingID, "", tok)
	if resp.code != http.StatusOK {
		t.Fatalf("GET = %d, want 200", resp.code)
	}
	assertAllowed(t, resp.json, "CONFIRM", "CANCEL")

	resp = env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"CONFIRM"}`, tok)
	if resp.code != http.StatusOK {
		t.Fatalf("CONFIRM = %d, want 200; body=%s", resp.code, resp.body)
	}
	if resp.json["state"] != "CONFIRMED" {
		t.Errorf("state after CONFIRM = %v, want CONFIRMED", resp.json["state"])
	}
	assertAllowed(t, resp.json, "SEARCH", "ESCALATE", "RESCHEDULE", "CANCEL")
}

// The transition actor is the authenticated user — written to booking_events, taken from the
// token, not any client-supplied value.
func TestActorIsRecordedFromTheToken(t *testing.T) {
	env := newServer(t)
	customer, address := env.seedCustomerAndAddress(t)
	variant := env.seedService(t, "599")
	tok := env.token(t, customer, identity.RoleCustomer)

	body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, variant)
	id := mustString(t, env.do(t, http.MethodPost, "/bookings", body, tok).json, "booking_id")
	env.do(t, http.MethodPost, "/bookings/"+id+"/transitions", `{"action":"CONFIRM"}`, tok)

	var actor uuid.UUID
	if err := env.pool.QueryRow(context.Background(),
		"SELECT actor_user_id FROM booking_events WHERE booking_id=$1 AND action='CONFIRM'", id).
		Scan(&actor); err != nil {
		t.Fatal(err)
	}
	if actor.String() != customer {
		t.Errorf("actor_user_id = %s, want the authenticated customer %s", actor, customer)
	}
}

// Auth gate: no token, or a bad one, is 401; the right token but the wrong role is 403.
func TestAuthGuards(t *testing.T) {
	env := newServer(t)
	_, address := env.seedCustomerAndAddress(t)
	variant := env.seedService(t, "599")
	body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, variant)

	t.Run("no token -> 401", func(t *testing.T) {
		if r := env.do(t, http.MethodPost, "/bookings", body, ""); r.code != http.StatusUnauthorized {
			t.Errorf("no token = %d, want 401", r.code)
		}
	})

	t.Run("garbage token -> 401", func(t *testing.T) {
		if r := env.do(t, http.MethodPost, "/bookings", body, "not.a.jwt"); r.code != http.StatusUnauthorized {
			t.Errorf("garbage token = %d, want 401", r.code)
		}
	})

	t.Run("admin creating a booking -> 403 (only customers book)", func(t *testing.T) {
		// A real admin user, correctly authenticated, but the wrong role for this route.
		admin := uuid.New()
		env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Ops', 'ADMIN')", admin, "+9198"+admin.String()[:8])
		tok := env.token(t, admin.String(), identity.RoleAdmin)
		if r := env.do(t, http.MethodPost, "/bookings", body, tok); r.code != http.StatusForbidden {
			t.Errorf("admin create = %d, want 403; body=%s", r.code, r.body)
		}
	})
}

// The error mapping — each domain failure to its status code — now behind auth.
func TestErrorMapping(t *testing.T) {
	env := newServer(t)
	customer, address := env.seedCustomerAndAddress(t)
	variant := env.seedService(t, "599")
	tok := env.token(t, customer, identity.RoleCustomer)

	create := func() string {
		body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, variant)
		return mustString(t, env.do(t, http.MethodPost, "/bookings", body, tok).json, "booking_id")
	}

	t.Run("illegal transition -> 422", func(t *testing.T) {
		id := create()
		r := env.do(t, http.MethodPost, "/bookings/"+id+"/transitions", `{"action":"ARRIVE"}`, tok)
		if r.code != http.StatusUnprocessableEntity {
			t.Errorf("illegal transition = %d, want 422; body=%s", r.code, r.body)
		}
	})

	t.Run("missing booking -> 404", func(t *testing.T) {
		r := env.do(t, http.MethodGet, "/bookings/"+uuid.NewString(), "", tok)
		if r.code != http.StatusNotFound {
			t.Errorf("missing booking = %d, want 404", r.code)
		}
	})

	t.Run("unknown action -> 400", func(t *testing.T) {
		id := create()
		r := env.do(t, http.MethodPost, "/bookings/"+id+"/transitions", `{"action":"TELEPORT"}`, tok)
		if r.code != http.StatusBadRequest {
			t.Errorf("unknown action = %d, want 400; body=%s", r.code, r.body)
		}
	})

	t.Run("non-uuid path -> 400", func(t *testing.T) {
		r := env.do(t, http.MethodGet, "/bookings/not-a-uuid", "", tok)
		if r.code != http.StatusBadRequest {
			t.Errorf("non-uuid path = %d, want 400", r.code)
		}
	})

	t.Run("unknown json field -> 400", func(t *testing.T) {
		body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1,"surprise":true}`, address, variant)
		r := env.do(t, http.MethodPost, "/bookings", body, tok)
		if r.code != http.StatusBadRequest {
			t.Errorf("unknown field = %d, want 400; body=%s", r.code, r.body)
		}
	})

	t.Run("nonexistent variant -> 404", func(t *testing.T) {
		body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, uuid.NewString())
		r := env.do(t, http.MethodPost, "/bookings", body, tok)
		if r.code != http.StatusNotFound {
			t.Errorf("nonexistent variant = %d, want 404; body=%s", r.code, r.body)
		}
	})

	t.Run("zero quantity -> 400", func(t *testing.T) {
		body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":0}`, address, variant)
		r := env.do(t, http.MethodPost, "/bookings", body, tok)
		if r.code != http.StatusBadRequest {
			t.Errorf("zero quantity = %d, want 400", r.code)
		}
	})
}

// Concurrent double-CONFIRM over HTTP: exactly one 200, the other 409-or-422 — never two 200s.
func TestConcurrentTransitionSurfacesAsConflictOr422(t *testing.T) {
	env := newServer(t)
	customer, address := env.seedCustomerAndAddress(t)
	variant := env.seedService(t, "599")
	tok := env.token(t, customer, identity.RoleCustomer)

	body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, variant)
	id := mustString(t, env.do(t, http.MethodPost, "/bookings", body, tok).json, "booking_id")

	codes := make(chan int, 2)
	for range 2 {
		go func() {
			codes <- env.do(t, http.MethodPost, "/bookings/"+id+"/transitions", `{"action":"CONFIRM"}`, tok).code
		}()
	}
	codeA, codeB := <-codes, <-codes

	ok, lost := 0, 0
	for _, code := range []int{codeA, codeB} {
		switch code {
		case http.StatusOK:
			ok++
		case http.StatusConflict, http.StatusUnprocessableEntity:
			lost++
		default:
			t.Errorf("unexpected status %d", code)
		}
	}
	if ok != 1 || lost != 1 {
		t.Errorf("got %d OK and %d lost, want exactly 1 and 1", ok, lost)
	}
}

// ---------------------------------------------------------------------------

type testEnv struct {
	srv    *httptest.Server
	pool   *pgxpool.Pool
	signer *auth.Signer
}

func newServer(t *testing.T) *testEnv {
	t.Helper()
	pool := storagetest.NewPool(t, migrationsDir)
	signer, err := auth.NewSigner(testSecret, time.Hour)
	if err != nil {
		t.Fatalf("signer: %v", err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	mux := http.NewServeMux()
	httpapi.New(booking.NewService(pool), signer, log).Register(mux)
	httpapi.NewCatalogHandler(catalog.New(pool), signer, log).Register(mux)
	httpapi.NewAddressHandler(address.New(pool), signer, log).Register(mux)

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return &testEnv{srv: srv, pool: pool, signer: signer}
}

// staffToken provisions a user of the given role and returns a token for them — for testing
// routes that need a specific role (e.g. admin-only catalog writes).
func (env *testEnv) staffToken(t *testing.T, role identity.Role) string {
	t.Helper()
	id := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Staff', $3)",
		id, "+9199"+id.String()[:8], string(role))
	return env.token(t, id.String(), role)
}

// token mints a Bearer token for a user id and role.
func (env *testEnv) token(t *testing.T, id string, role identity.Role) string {
	t.Helper()
	uid, err := uuid.Parse(id)
	if err != nil {
		t.Fatalf("bad uuid %q: %v", id, err)
	}
	tok, err := env.signer.Issue(auth.AuthedUser{ID: uid, Role: role})
	if err != nil {
		t.Fatalf("issuing token: %v", err)
	}
	return tok
}

type result struct {
	code int
	body string
	json map[string]any
}

// do issues a request; a non-empty token is sent as a Bearer Authorization header.
func (env *testEnv) do(t *testing.T, method, path, body, token string) result {
	t.Helper()

	var request *http.Request
	var err error
	if body == "" {
		request, err = http.NewRequest(method, env.srv.URL+path, nil)
	} else {
		request, err = http.NewRequest(method, env.srv.URL+path, strings.NewReader(body))
	}
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
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

	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		t.Fatalf("reading body: %v", err)
	}

	out := result{code: resp.StatusCode, body: buf.String()}
	if buf.Len() > 0 {
		if err := json.Unmarshal(buf.Bytes(), &out.json); err != nil {
			t.Logf("response body was not json (%v): %s", err, out.body)
		}
	}
	return out
}

func mustString(t *testing.T, m map[string]any, key string) string {
	t.Helper()
	v, ok := m[key].(string)
	if !ok {
		t.Fatalf("response field %q missing or not a string in %v", key, m)
	}
	return v
}

func asArray(t *testing.T, v any) []any {
	t.Helper()
	a, ok := v.([]any)
	if !ok {
		t.Fatalf("expected a json array, got %T: %v", v, v)
	}
	return a
}

func asObject(t *testing.T, v any) map[string]any {
	t.Helper()
	m, ok := v.(map[string]any)
	if !ok {
		t.Fatalf("expected a json object, got %T: %v", v, v)
	}
	return m
}

func assertAllowed(t *testing.T, body map[string]any, want ...string) {
	t.Helper()
	raw, ok := body["allowed_actions"].([]any)
	if !ok {
		t.Fatalf("allowed_actions missing or not an array: %v", body["allowed_actions"])
	}
	got := map[string]bool{}
	for _, entry := range raw {
		if actionName, ok := entry.(string); ok {
			got[actionName] = true
		}
	}
	if len(got) != len(want) {
		t.Errorf("allowed_actions = %v, want exactly %v", raw, want)
	}
	for _, wantedAction := range want {
		if !got[wantedAction] {
			t.Errorf("allowed_actions %v missing %q", raw, wantedAction)
		}
	}
}

func (env *testEnv) seedCustomerAndAddress(t *testing.T) (customer, address string) {
	t.Helper()
	c := uuid.New()
	a := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'C', 'CUSTOMER')", c, "+9190"+c.String()[:8])
	env.exec(t, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '1 Rd', 'Bengaluru', '560001', ST_MakePoint(77.59,12.97)::geography)`, a, c)
	return c.String(), a.String()
}

func (env *testEnv) seedService(t *testing.T, rupees string) string {
	t.Helper()
	cat, svc, variant := uuid.New(), uuid.New(), uuid.New()
	env.exec(t, "INSERT INTO categories (id, name, slug) VALUES ($1, 'AC', $2)", cat, "ac-"+cat.String()[:8])
	env.exec(t, "INSERT INTO services (id, category_id, name, slug) VALUES ($1, $2, 'AC Service', $3)", svc, cat, "svc-"+svc.String()[:8])
	price, err := money.FromRupees(rupees)
	if err != nil {
		t.Fatalf("bad seed price %q: %v", rupees, err)
	}
	env.exec(t, "INSERT INTO service_variants (id, service_id, name, base_price_paise) VALUES ($1, $2, 'Standard', $3)", variant, svc, price.Paise())
	return variant.String()
}

func (env *testEnv) exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	if _, err := env.pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("seed exec: %v\n  %s", err, sql)
	}
}
