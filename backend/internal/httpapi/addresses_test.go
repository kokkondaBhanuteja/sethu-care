package httpapi_test

import (
	"net/http"
	"testing"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

func TestAddressCreateAndListIsOwnedByTheCaller(t *testing.T) {
	env := newServer(t)
	alice := env.staffToken(t, identity.RoleCustomer)
	bob := env.staffToken(t, identity.RoleCustomer)

	// Alice adds two addresses; the FIRST is her default automatically.
	resp := env.do(t, http.MethodPost, "/addresses",
		`{"label":"Home","line1":"12 MG Rd","city":"Bengaluru","pincode":"560001","lat":12.9716,"lng":77.5946}`, alice)
	if resp.code != http.StatusCreated {
		t.Fatalf("POST /addresses = %d, want 201; body=%s", resp.code, resp.body)
	}
	if resp.json["is_default"] != true {
		t.Errorf("first address is_default = %v, want true", resp.json["is_default"])
	}

	resp = env.do(t, http.MethodPost, "/addresses",
		`{"label":"Office","line1":"1 Residency Rd","city":"Bengaluru","pincode":"560025","lat":12.97,"lng":77.60}`, alice)
	if resp.json["is_default"] != false {
		t.Errorf("second address is_default = %v, want false", resp.json["is_default"])
	}

	// Alice sees both; Bob sees none — ownership isolation.
	resp = env.do(t, http.MethodGet, "/addresses", "", alice)
	if list, ok := resp.json["addresses"].([]any); !ok || len(list) != 2 {
		t.Errorf("alice sees %v addresses, want 2", resp.json["addresses"])
	}
	resp = env.do(t, http.MethodGet, "/addresses", "", bob)
	if list, ok := resp.json["addresses"].([]any); !ok || len(list) != 0 {
		t.Errorf("bob sees %v addresses, want 0 — a customer must not see another's", resp.json["addresses"])
	}
}

// Making a new address the default clears the old one — the partial unique index is never
// violated, and the round-tripped lat/lng survive.
func TestAddressDefaultSwitchesAndCoordsRoundTrip(t *testing.T) {
	env := newServer(t)
	tok := env.staffToken(t, identity.RoleCustomer)

	env.do(t, http.MethodPost, "/addresses",
		`{"label":"Home","line1":"A","city":"Bengaluru","pincode":"560001","lat":12.9716,"lng":77.5946}`, tok)
	env.do(t, http.MethodPost, "/addresses",
		`{"label":"Office","line1":"B","city":"Bengaluru","pincode":"560025","lat":13.01,"lng":77.61,"is_default":true}`, tok)

	resp := env.do(t, http.MethodGet, "/addresses", "", tok)
	list := asArray(t, resp.json["addresses"])
	if len(list) != 2 {
		t.Fatalf("want 2 addresses, got %v", list)
	}
	// Default first (query orders is_default DESC), and it is the Office.
	first := asObject(t, list[0])
	if first["label"] != "Office" || first["is_default"] != true {
		t.Errorf("default = %v, want Office/true", first)
	}
	// Exactly one default.
	defaults := 0
	for _, addr := range list {
		if asObject(t, addr)["is_default"] == true {
			defaults++
		}
	}
	if defaults != 1 {
		t.Errorf("got %d defaults, want exactly 1", defaults)
	}
	// Coordinates survived the geography round trip (~4 decimal places).
	if lat, ok := first["lat"].(float64); !ok || lat < 13.0 || lat > 13.02 {
		t.Errorf("lat round-trip = %v, want ~13.01", first["lat"])
	}
}

func TestAddressValidation(t *testing.T) {
	env := newServer(t)
	tok := env.staffToken(t, identity.RoleCustomer)

	t.Run("no token -> 401", func(t *testing.T) {
		if resp := env.do(t, http.MethodPost, "/addresses", `{"line1":"A","city":"B","lat":1,"lng":1}`, ""); resp.code != http.StatusUnauthorized {
			t.Errorf("= %d, want 401", resp.code)
		}
	})

	t.Run("out-of-range coordinates -> 400", func(t *testing.T) {
		resp := env.do(t, http.MethodPost, "/addresses",
			`{"line1":"A","city":"B","pincode":"560001","lat":999,"lng":77}`, tok)
		if resp.code != http.StatusBadRequest {
			t.Errorf("= %d, want 400; body=%s", resp.code, resp.body)
		}
	})

	t.Run("bad pincode -> 400 (DB CHECK)", func(t *testing.T) {
		resp := env.do(t, http.MethodPost, "/addresses",
			`{"line1":"A","city":"B","pincode":"12","lat":12.97,"lng":77.59}`, tok)
		if resp.code != http.StatusBadRequest {
			t.Errorf("= %d, want 400; body=%s", resp.code, resp.body)
		}
	})

	t.Run("missing line1 -> 400", func(t *testing.T) {
		resp := env.do(t, http.MethodPost, "/addresses", `{"city":"B","pincode":"560001","lat":12.97,"lng":77.59}`, tok)
		if resp.code != http.StatusBadRequest {
			t.Errorf("= %d, want 400", resp.code)
		}
	})
}
