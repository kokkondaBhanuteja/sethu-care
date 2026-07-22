package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// The admin console's operations are declared with nil services, so this file deliberately asserts
// only what stays true once their bodies are written: that every route is MOUNTED (a request does
// not fall through to 404) and that the role gate at each route is enforced. It needs no database,
// which is why it runs where the rest of this package's tests need a container.

// adminAPI builds the same surface the server mounts, with no services behind it.
func adminAPI(t *testing.T) (*http.ServeMux, *auth.Signer) {
	t.Helper()
	signer, err := auth.NewSigner("admin-contract-test-secret-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("building signer: %v", err)
	}
	mux := http.NewServeMux()
	RegisterAll(NewHumaAPI(mux, signer), Dependencies{Signer: signer})
	return mux, signer
}

func adminToken(t *testing.T, signer *auth.Signer, role identity.Role) string {
	t.Helper()
	token, err := signer.Issue(auth.AuthedUser{ID: [16]byte{1}, Role: role})
	if err != nil {
		t.Fatalf("issuing token: %v", err)
	}
	return token
}

// adminRoutes is a sample across every admin domain — enough that a whole registerAdminX(api) call
// going missing from RegisterHuma is caught here rather than by the console at runtime.
var adminRoutes = []struct {
	method string
	target string
	body   string
}{
	{http.MethodGet, "/admin/profile", ""},
	{http.MethodGet, "/admin/settings/notifications", ""},
	{http.MethodGet, "/ops/dashboard/summary?period=today", ""},
	{http.MethodGet, "/ops/shell-counters", ""},
	{http.MethodGet, "/ops/alerts?severity=critical&acknowledged=true", ""},
	{http.MethodGet, "/ops/bookings?segment=active&state=EN_ROUTE&state=ARRIVED", ""},
	{http.MethodGet, "/ops/bookings/bkg_1/refund-context", ""},
	{http.MethodGet, "/ops/providers?segment=online", ""},
	{http.MethodGet, "/ops/applications?segment=pending", ""},
	{http.MethodGet, "/ops/audit?action=BOOKING_ASSIGN&targetType=booking", ""},
	{http.MethodGet, "/ops/live-map?zoom=1.5", ""},
	{http.MethodGet, "/ops/payouts/current", ""},
	{http.MethodGet, "/ops/customers?q=ajay", ""},
	{http.MethodGet, "/ops/tickets?status=open", ""},
	{http.MethodGet, "/ops/analytics/summary?period=last7", ""},
}

func TestAdminRoutesAreMounted(t *testing.T) {
	mux, signer := adminAPI(t)
	token := adminToken(t, signer, identity.RoleAdmin)

	for _, route := range adminRoutes {
		request := httptest.NewRequest(route.method, route.target, strings.NewReader(route.body))
		request.Header.Set("Authorization", "Bearer "+token)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, request)

		// The handler bodies are not written yet, so the useful assertion is the negative one: an
		// admin reaching this route is never turned away by routing or by authorization.
		switch recorder.Code {
		case http.StatusNotFound:
			t.Errorf("%s %s: not mounted (404)", route.method, route.target)
		case http.StatusUnauthorized, http.StatusForbidden:
			t.Errorf("%s %s: an admin was refused (%d)", route.method, route.target, recorder.Code)
		}
	}
}

func TestAdminRoutesRejectNonAdmins(t *testing.T) {
	mux, signer := adminAPI(t)
	customerToken := adminToken(t, signer, identity.RoleCustomer)

	for _, route := range adminRoutes {
		request := httptest.NewRequest(route.method, route.target, strings.NewReader(route.body))
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusUnauthorized {
			t.Errorf("%s %s without a token: want 401, got %d", route.method, route.target, recorder.Code)
		}

		request = httptest.NewRequest(route.method, route.target, strings.NewReader(route.body))
		request.Header.Set("Authorization", "Bearer "+customerToken)
		recorder = httptest.NewRecorder()
		mux.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusForbidden {
			t.Errorf("%s %s as a customer: want 403, got %d", route.method, route.target, recorder.Code)
		}
	}
}

// The sign-in flows are the exception: they cannot require a token, because they are how one is
// obtained. A missing Authorization header must not turn them into a 401.
func TestAdminSignInRoutesAreUnauthenticated(t *testing.T) {
	mux, _ := adminAPI(t)

	for _, target := range []string{"/admin/auth/bootstrap"} {
		request := httptest.NewRequest(http.MethodGet, target, nil)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, request)
		if recorder.Code == http.StatusUnauthorized || recorder.Code == http.StatusNotFound {
			t.Errorf("GET %s: want an unauthenticated route, got %d", target, recorder.Code)
		}
	}
}
