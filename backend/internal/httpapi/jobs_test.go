package httpapi_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// A technician sees the job assigned to them (with the actions they can take), does not see
// another technician's job, and can drive it through the field steps. A customer may not use
// the technician view at all.
func TestTechnicianJobView(t *testing.T) {
	env := newServer(t)
	adminToken := env.staffToken(t, identity.RoleAdmin)

	customer, address := env.seedCustomerAndAddress(t)
	variant := env.seedService(t, "599")
	customerToken := env.token(t, customer, identity.RoleCustomer)

	// Two technicians.
	techAID, techBID := uuid.New(), uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Asha', 'TECHNICIAN')", techAID, "+9191"+techAID.String()[:8])
	env.exec(t, "INSERT INTO technicians (user_id, city, is_online) VALUES ($1, 'Bengaluru', true)", techAID)
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Bhanu', 'TECHNICIAN')", techBID, "+9192"+techBID.String()[:8])
	env.exec(t, "INSERT INTO technicians (user_id, city, is_online) VALUES ($1, 'Bengaluru', true)", techBID)
	techAToken := env.token(t, techAID.String(), identity.RoleTechnician)
	techBToken := env.token(t, techBID.String(), identity.RoleTechnician)

	// Book, confirm, search, and assign to technician A.
	body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, variant)
	bookingID := mustString(t, env.do(t, http.MethodPost, "/bookings", body, customerToken).json, "booking_id")
	env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"CONFIRM"}`, customerToken)
	env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"SEARCH"}`, adminToken)
	if r := env.do(t, http.MethodPost, "/ops/bookings/"+bookingID+"/assign",
		fmt.Sprintf(`{"technician_id":%q}`, techAID), adminToken); r.code != http.StatusOK {
		t.Fatalf("assign = %d; body=%s", r.code, r.body)
	}

	// Technician A sees exactly this job; the allowed actions from ASSIGNED are the ones a
	// technician may take: DEPART and ESCALATE (not RESCHEDULE/CANCEL — those are the
	// customer's / admin's).
	jobsA := env.do(t, http.MethodGet, "/me/jobs", "", techAToken)
	if jobsA.code != http.StatusOK {
		t.Fatalf("GET /me/jobs = %d, want 200", jobsA.code)
	}
	jobs := asArray(t, jobsA.json["jobs"])
	if len(jobs) != 1 {
		t.Fatalf("technician A sees %v jobs, want 1", jobs)
	}
	job := asObject(t, jobs[0])
	if job["booking_id"] != bookingID || job["state"] != "ASSIGNED" {
		t.Errorf("job = %v, want the assigned booking", job)
	}
	if job["customer_phone"] == "" {
		t.Error("job is missing the customer contact a technician needs on site")
	}
	assertActionSet(t, job["allowed_actions"], "DEPART", "ESCALATE")

	// Technician B sees nothing — the job is not theirs.
	jobsB := env.do(t, http.MethodGet, "/me/jobs", "", techBToken)
	if list := asArray(t, jobsB.json["jobs"]); len(list) != 0 {
		t.Errorf("technician B sees %v jobs, want 0", list)
	}

	// A customer may not use the technician view.
	if r := env.do(t, http.MethodGet, "/me/jobs", "", customerToken); r.code != http.StatusForbidden {
		t.Errorf("customer GET /me/jobs = %d, want 403", r.code)
	}

	// Technician A drives the job: DEPART -> EN_ROUTE.
	depart := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"DEPART"}`, techAToken)
	if depart.code != http.StatusOK || depart.json["state"] != "EN_ROUTE" {
		t.Fatalf("DEPART by technician = %d state=%v, want 200 EN_ROUTE; body=%s", depart.code, depart.json["state"], depart.body)
	}

	// Technician B cannot drive A's job (ownership) -> 403.
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"ARRIVE"}`, techBToken); r.code != http.StatusForbidden {
		t.Errorf("technician B ARRIVE on A's job = %d, want 403", r.code)
	}
}

func assertActionSet(t *testing.T, raw any, want ...string) {
	t.Helper()
	list := asArray(t, raw)
	got := map[string]bool{}
	for _, entry := range list {
		if name, ok := entry.(string); ok {
			got[name] = true
		}
	}
	if len(got) != len(want) {
		t.Errorf("allowed_actions = %v, want exactly %v", raw, want)
	}
	for _, wanted := range want {
		if !got[wanted] {
			t.Errorf("allowed_actions %v missing %q", raw, wanted)
		}
	}
}
