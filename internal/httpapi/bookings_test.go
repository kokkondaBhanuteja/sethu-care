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

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/httpapi"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

const migrationsDir = "../../db/migrations"

// The happy path, driven entirely over HTTP: create a booking, read it, then walk it
// through the first few transitions — asserting the status codes and the allowed_actions
// the API hands back at each step.
func TestBookingLifecycleOverHTTP(t *testing.T) {
	srv, pool := newServer(t)

	customer, address := seedCustomerAndAddress(t, pool)
	variant := seedService(t, pool, "599")

	// POST /bookings -> 201
	body := fmt.Sprintf(`{"customer_id":%q,"address_id":%q,"variant_id":%q,"quantity":1}`,
		customer, address, variant)
	resp := do(t, srv, http.MethodPost, "/bookings", body, nil)
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

	// GET /bookings/{id} -> 200, and DRAFT allows CONFIRM + CANCEL
	resp = do(t, srv, http.MethodGet, "/bookings/"+bookingID, "", nil)
	if resp.code != http.StatusOK {
		t.Fatalf("GET = %d, want 200", resp.code)
	}
	assertAllowed(t, resp.json, "CONFIRM", "CANCEL")

	// POST transition CONFIRM -> 200, now SEARCH is offered
	resp = do(t, srv, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"CONFIRM"}`, nil)
	if resp.code != http.StatusOK {
		t.Fatalf("CONFIRM = %d, want 200; body=%s", resp.code, resp.body)
	}
	if resp.json["state"] != "CONFIRMED" {
		t.Errorf("state after CONFIRM = %v, want CONFIRMED", resp.json["state"])
	}
	assertAllowed(t, resp.json, "SEARCH", "ESCALATE", "RESCHEDULE", "CANCEL")
}

// The error mapping is the whole reason this layer exists — each domain failure must become
// the right status code.
func TestErrorMapping(t *testing.T) {
	srv, pool := newServer(t)
	customer, address := seedCustomerAndAddress(t, pool)
	variant := seedService(t, pool, "599")

	create := func() string {
		body := fmt.Sprintf(`{"customer_id":%q,"address_id":%q,"variant_id":%q,"quantity":1}`, customer, address, variant)
		r := do(t, srv, http.MethodPost, "/bookings", body, nil)
		return mustString(t, r.json, "booking_id")
	}

	t.Run("illegal transition -> 422", func(t *testing.T) {
		id := create() // DRAFT
		// ARRIVE is not legal from DRAFT.
		r := do(t, srv, http.MethodPost, "/bookings/"+id+"/transitions", `{"action":"ARRIVE"}`, nil)
		if r.code != http.StatusUnprocessableEntity {
			t.Errorf("illegal transition = %d, want 422; body=%s", r.code, r.body)
		}
	})

	t.Run("missing booking -> 404", func(t *testing.T) {
		r := do(t, srv, http.MethodGet, "/bookings/"+uuid.NewString(), "", nil)
		if r.code != http.StatusNotFound {
			t.Errorf("missing booking = %d, want 404", r.code)
		}
	})

	t.Run("unknown action -> 400", func(t *testing.T) {
		id := create()
		r := do(t, srv, http.MethodPost, "/bookings/"+id+"/transitions", `{"action":"TELEPORT"}`, nil)
		if r.code != http.StatusBadRequest {
			t.Errorf("unknown action = %d, want 400; body=%s", r.code, r.body)
		}
	})

	t.Run("non-uuid path -> 400", func(t *testing.T) {
		r := do(t, srv, http.MethodGet, "/bookings/not-a-uuid", "", nil)
		if r.code != http.StatusBadRequest {
			t.Errorf("non-uuid path = %d, want 400", r.code)
		}
	})

	t.Run("unknown json field -> 400", func(t *testing.T) {
		body := fmt.Sprintf(`{"customer_id":%q,"address_id":%q,"variant_id":%q,"quantity":1,"surprise":true}`, customer, address, variant)
		r := do(t, srv, http.MethodPost, "/bookings", body, nil)
		if r.code != http.StatusBadRequest {
			t.Errorf("unknown field = %d, want 400; body=%s", r.code, r.body)
		}
	})

	t.Run("nonexistent variant -> 404", func(t *testing.T) {
		body := fmt.Sprintf(`{"customer_id":%q,"address_id":%q,"variant_id":%q,"quantity":1}`, customer, address, uuid.NewString())
		r := do(t, srv, http.MethodPost, "/bookings", body, nil)
		if r.code != http.StatusNotFound {
			t.Errorf("nonexistent variant = %d, want 404; body=%s", r.code, r.body)
		}
	})

	t.Run("zero quantity -> 400", func(t *testing.T) {
		body := fmt.Sprintf(`{"customer_id":%q,"address_id":%q,"variant_id":%q,"quantity":0}`, customer, address, variant)
		r := do(t, srv, http.MethodPost, "/bookings", body, nil)
		if r.code != http.StatusBadRequest {
			t.Errorf("zero quantity = %d, want 400", r.code)
		}
	})
}

// A concurrent double-transition surfaces as a 409 to whichever caller loses (or a 422 if it
// read the already-moved state — both are correct "you lost" outcomes, as in the service
// test). This asserts the losing HTTP status is one of those, never a 200.
func TestConcurrentTransitionSurfacesAsConflictOr422(t *testing.T) {
	srv, pool := newServer(t)
	customer, address := seedCustomerAndAddress(t, pool)
	variant := seedService(t, pool, "599")

	body := fmt.Sprintf(`{"customer_id":%q,"address_id":%q,"variant_id":%q,"quantity":1}`, customer, address, variant)
	id := mustString(t, do(t, srv, http.MethodPost, "/bookings", body, nil).json, "booking_id")

	// Two identical CONFIRMs at once.
	codes := make(chan int, 2)
	for range 2 {
		go func() {
			codes <- do(t, srv, http.MethodPost, "/bookings/"+id+"/transitions", `{"action":"CONFIRM"}`, nil).code
		}()
	}
	a, b := <-codes, <-codes

	ok, lost := 0, 0
	for _, c := range []int{a, b} {
		switch c {
		case http.StatusOK:
			ok++
		case http.StatusConflict, http.StatusUnprocessableEntity:
			lost++
		default:
			t.Errorf("unexpected status %d", c)
		}
	}
	if ok != 1 || lost != 1 {
		t.Errorf("got %d OK and %d lost, want exactly 1 and 1", ok, lost)
	}
}

// ---------------------------------------------------------------------------

type result struct {
	code int
	body string
	json map[string]any
}

func do(t *testing.T, srv *httptest.Server, method, path, body string, headers map[string]string) result {
	t.Helper()

	var r *http.Request
	var err error
	if body == "" {
		r, err = http.NewRequest(method, srv.URL+path, nil)
	} else {
		r, err = http.NewRequest(method, srv.URL+path, strings.NewReader(body))
	}
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	for k, v := range headers {
		r.Header.Set(k, v)
	}

	resp, err := srv.Client().Do(r)
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

func assertAllowed(t *testing.T, body map[string]any, want ...string) {
	t.Helper()
	raw, ok := body["allowed_actions"].([]any)
	if !ok {
		t.Fatalf("allowed_actions missing or not an array: %v", body["allowed_actions"])
	}
	got := map[string]bool{}
	for _, a := range raw {
		if s, ok := a.(string); ok {
			got[s] = true
		}
	}
	if len(got) != len(want) {
		t.Errorf("allowed_actions = %v, want exactly %v", raw, want)
	}
	for _, w := range want {
		if !got[w] {
			t.Errorf("allowed_actions %v missing %q", raw, w)
		}
	}
}

func mustString(t *testing.T, m map[string]any, key string) string {
	t.Helper()
	v, ok := m[key].(string)
	if !ok {
		t.Fatalf("response field %q missing or not a string in %v", key, m)
	}
	return v
}

func newServer(t *testing.T) (*httptest.Server, *pgxpool.Pool) {
	t.Helper()
	pool := storagetest.NewPool(t, migrationsDir)
	mux := http.NewServeMux()
	// A discard logger keeps the expected 5xx-path noise out of test output.
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	httpapi.New(booking.NewService(pool), log).Register(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, pool
}

func seedCustomerAndAddress(t *testing.T, pool *pgxpool.Pool) (customer, address string) {
	t.Helper()
	c := uuid.New()
	a := uuid.New()
	exec(t, pool, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'C', 'CUSTOMER')", c, "+9190"+c.String()[:8])
	exec(t, pool, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '1 Rd', 'Bengaluru', '560001', ST_MakePoint(77.59,12.97)::geography)`, a, c)
	return c.String(), a.String()
}

// seedService creates a category, a service and one active variant at the given rupee price,
// returning the variant id.
func seedService(t *testing.T, pool *pgxpool.Pool, rupees string) string {
	t.Helper()
	cat, svc, variant := uuid.New(), uuid.New(), uuid.New()
	exec(t, pool, "INSERT INTO categories (id, name, slug) VALUES ($1, 'AC', $2)", cat, "ac-"+cat.String()[:8])
	exec(t, pool, "INSERT INTO services (id, category_id, name, slug) VALUES ($1, $2, 'AC Service', $3)",
		svc, cat, "svc-"+svc.String()[:8])
	// money.FromRupees mirrors how a price would be entered in the catalog admin.
	price, err := money.FromRupees(rupees)
	if err != nil {
		t.Fatalf("bad seed price %q: %v", rupees, err)
	}
	exec(t, pool, "INSERT INTO service_variants (id, service_id, name, base_price_paise) VALUES ($1, $2, 'Standard', $3)",
		variant, svc, price.Paise())
	return variant.String()
}

func exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("seed exec: %v\n  %s", err, sql)
	}
}
