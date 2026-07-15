package httpapi_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/media"
)

// The full work-photo flow over HTTP: the assigned technician mints a Cloudinary signature,
// records a verified upload, and the customer can then see it. Guards: a stranger technician is
// refused, a forged upload signature is rejected, and a foreign URL is refused.
func TestWorkPhotoSignAndRecord(t *testing.T) {
	env := newServer(t)
	// Must match the credentials the test harness wires into the PhotoHandler.
	cloudinary := media.NewCloudinary("democloud", "demokey", "demosecret")

	customer, address := env.seedCustomerAndAddress(t)
	orderID := uuid.New()
	env.exec(t, "INSERT INTO orders (id, customer_id) VALUES ($1, $2)", orderID, uuid.MustParse(customer))

	technicianID := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Asha', 'TECHNICIAN')", technicianID, "+9191"+technicianID.String()[:8])
	env.exec(t, "INSERT INTO technicians (user_id, city) VALUES ($1, 'Bengaluru')", technicianID)
	technicianToken := env.token(t, technicianID.String(), identity.RoleTechnician)

	bookingID := uuid.New()
	env.exec(t, "INSERT INTO bookings (id, order_id, customer_id, address_id, state, technician_id) VALUES ($1, $2, $3, $4, 'IN_PROGRESS', $5)",
		bookingID, orderID, uuid.MustParse(customer), uuid.MustParse(address), technicianID)

	// The assigned technician mints an upload signature.
	sig := env.do(t, http.MethodPost, "/bookings/"+bookingID.String()+"/photos/signature", "", technicianToken)
	if sig.code != http.StatusOK {
		t.Fatalf("signature = %d, want 200; body=%s", sig.code, sig.body)
	}
	if sig.json["cloud_name"] != "democloud" || sig.json["signature"] == "" {
		t.Errorf("signature response missing fields: %v", sig.json)
	}

	// A technician who is NOT assigned cannot mint a signature.
	stranger := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Bhanu', 'TECHNICIAN')", stranger, "+9192"+stranger.String()[:8])
	env.exec(t, "INSERT INTO technicians (user_id, city) VALUES ($1, 'Bengaluru')", stranger)
	strangerToken := env.token(t, stranger.String(), identity.RoleTechnician)
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID.String()+"/photos/signature", "", strangerToken); r.code != http.StatusForbidden {
		t.Errorf("stranger signature = %d, want 403", r.code)
	}

	// Record a verified upload: a real Cloudinary result signature over (public_id, version).
	publicID := "sethu-care/bookings/" + bookingID.String() + "/before1"
	version := "1700000000"
	uploadSig := cloudinary.Sign(map[string]string{"public_id": publicID, "version": version})
	secureURL := "https://res.cloudinary.com/democloud/image/upload/v" + version + "/" + publicID + ".jpg"
	body := fmt.Sprintf(`{"kind":"BEFORE","public_id":%q,"version":%q,"signature":%q,"secure_url":%q}`,
		publicID, version, uploadSig, secureURL)
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID.String()+"/photos", body, technicianToken); r.code != http.StatusCreated {
		t.Fatalf("record = %d, want 201; body=%s", r.code, r.body)
	}

	// A forged upload signature is rejected.
	forged := fmt.Sprintf(`{"kind":"AFTER","public_id":%q,"version":%q,"signature":"deadbeef","secure_url":%q}`,
		publicID, version, secureURL)
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID.String()+"/photos", forged, technicianToken); r.code != http.StatusBadRequest {
		t.Errorf("forged signature = %d, want 400", r.code)
	}

	// A correctly-signed but FOREIGN url (not our cloud) is refused.
	foreignURL := "https://evil.example.com/" + publicID + ".jpg"
	foreign := fmt.Sprintf(`{"kind":"AFTER","public_id":%q,"version":%q,"signature":%q,"secure_url":%q}`,
		publicID, version, uploadSig, foreignURL)
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID.String()+"/photos", foreign, technicianToken); r.code != http.StatusBadRequest {
		t.Errorf("foreign url = %d, want 400", r.code)
	}

	// The customer sees exactly the one recorded photo.
	customerToken := env.token(t, customer, identity.RoleCustomer)
	list := env.do(t, http.MethodGet, "/bookings/"+bookingID.String()+"/photos", "", customerToken)
	if list.code != http.StatusOK {
		t.Fatalf("list = %d, want 200; body=%s", list.code, list.body)
	}
	photos := asArray(t, list.json["photos"])
	if len(photos) != 1 {
		t.Fatalf("photos = %d, want 1", len(photos))
	}
	if row := asObject(t, photos[0]); row["kind"] != "BEFORE" || row["url"] != secureURL {
		t.Errorf("photo = %v, want BEFORE with the stored url", row)
	}

	// A different customer may not view the evidence.
	otherCustomer := env.staffToken(t, identity.RoleCustomer)
	if r := env.do(t, http.MethodGet, "/bookings/"+bookingID.String()+"/photos", "", otherCustomer); r.code != http.StatusForbidden {
		t.Errorf("other customer list = %d, want 403", r.code)
	}
}
