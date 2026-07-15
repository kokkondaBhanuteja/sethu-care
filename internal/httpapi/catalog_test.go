package httpapi_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// Admin can build the catalog; a customer cannot; the public can browse it.
func TestCatalogAdminWritesAndPublicBrowse(t *testing.T) {
	env := newServer(t)

	adminTok := env.staffToken(t, identity.RoleAdmin)
	customerTok := env.staffToken(t, identity.RoleCustomer)

	// A customer may NOT create catalog entries.
	if r := env.do(t, http.MethodPost, "/categories", `{"name":"AC","slug":"ac"}`, customerTok); r.code != http.StatusForbidden {
		t.Fatalf("customer POST /categories = %d, want 403", r.code)
	}

	// An admin can.
	r := env.do(t, http.MethodPost, "/categories", `{"name":"AC","slug":"ac"}`, adminTok)
	if r.code != http.StatusCreated {
		t.Fatalf("admin POST /categories = %d, want 201; body=%s", r.code, r.body)
	}
	catID := mustString(t, r.json, "id")

	r = env.do(t, http.MethodPost, "/services",
		fmt.Sprintf(`{"category_id":%q,"name":"AC Service","slug":"ac-service"}`, catID), adminTok)
	if r.code != http.StatusCreated {
		t.Fatalf("admin POST /services = %d, want 201; body=%s", r.code, r.body)
	}
	svcID := mustString(t, r.json, "id")
	if r.json["assignment_mode"] != "AUTO" {
		t.Errorf("default assignment_mode = %v, want AUTO", r.json["assignment_mode"])
	}

	r = env.do(t, http.MethodPost, "/services/"+svcID+"/variants", `{"name":"Standard","price":"599"}`, adminTok)
	if r.code != http.StatusCreated {
		t.Fatalf("admin POST variant = %d, want 201; body=%s", r.code, r.body)
	}
	if got := r.json["price_paise"]; got != float64(59900) {
		t.Errorf("price_paise = %v, want 59900", got)
	}
	if r.json["price"] != "599.00" {
		t.Errorf("price = %v, want 599.00", r.json["price"])
	}

	// Public browse — no token needed.
	r = env.do(t, http.MethodGet, "/services", "", "")
	if r.code != http.StatusOK {
		t.Fatalf("GET /services = %d, want 200", r.code)
	}
	services, ok := r.json["services"].([]any)
	if !ok || len(services) != 1 {
		t.Fatalf("expected 1 service, got %v", r.json["services"])
	}

	// Service detail includes the variant we created.
	r = env.do(t, http.MethodGet, "/services/"+svcID, "", "")
	if r.code != http.StatusOK {
		t.Fatalf("GET /services/{id} = %d, want 200", r.code)
	}
	variants, ok := r.json["variants"].([]any)
	if !ok || len(variants) != 1 {
		t.Fatalf("expected 1 variant, got %v", r.json["variants"])
	}
}

func TestCatalogErrorMapping(t *testing.T) {
	env := newServer(t)
	adminTok := env.staffToken(t, identity.RoleAdmin)

	t.Run("missing service -> 404", func(t *testing.T) {
		if r := env.do(t, http.MethodGet, "/services/"+uuid.NewString(), "", ""); r.code != http.StatusNotFound {
			t.Errorf("= %d, want 404", r.code)
		}
	})

	t.Run("service under nonexistent category -> 404", func(t *testing.T) {
		body := fmt.Sprintf(`{"category_id":%q,"name":"X","slug":"x"}`, uuid.NewString())
		if r := env.do(t, http.MethodPost, "/services", body, adminTok); r.code != http.StatusNotFound {
			t.Errorf("= %d, want 404; body=%s", r.code, r.body)
		}
	})

	t.Run("variant with bad price -> 400", func(t *testing.T) {
		// need a real service first
		cat := env.do(t, http.MethodPost, "/categories", `{"name":"C","slug":"c1"}`, adminTok)
		catID := mustString(t, cat.json, "id")
		svc := env.do(t, http.MethodPost, "/services", fmt.Sprintf(`{"category_id":%q,"name":"S","slug":"s1"}`, catID), adminTok)
		svcID := mustString(t, svc.json, "id")

		r := env.do(t, http.MethodPost, "/services/"+svcID+"/variants", `{"name":"X","price":"not-money"}`, adminTok)
		if r.code != http.StatusBadRequest {
			t.Errorf("bad price = %d, want 400; body=%s", r.code, r.body)
		}
	})

	t.Run("admin write with no token -> 401", func(t *testing.T) {
		if r := env.do(t, http.MethodPost, "/categories", `{"name":"X","slug":"x2"}`, ""); r.code != http.StatusUnauthorized {
			t.Errorf("= %d, want 401", r.code)
		}
	})
}
