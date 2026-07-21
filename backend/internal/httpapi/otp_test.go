package httpapi_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/verification"
)

// The dual-OTP gate: VERIFY_START moves ARRIVED -> IN_PROGRESS only with the correct code.
// A wrong code changes nothing (the check and the transition are one transaction), and the
// same code cannot be replayed.
func TestVerifyStartRequiresCorrectOTP(t *testing.T) {
	env := newServer(t)
	ctx := context.Background()
	adminToken := env.staffToken(t, identity.RoleAdmin)

	customer, address := env.seedCustomerAndAddress(t)
	variant := env.seedService(t, "599")
	customerToken := env.token(t, customer, identity.RoleCustomer)

	technicianID := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Asha', 'TECHNICIAN')", technicianID, "+9191"+technicianID.String()[:8])
	env.exec(t, "INSERT INTO technicians (user_id, city, is_online) VALUES ($1, 'Bengaluru', true)", technicianID)
	technicianToken := env.token(t, technicianID.String(), identity.RoleTechnician)

	// Drive the booking to ARRIVED.
	body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, variant)
	bookingID := mustString(t, env.do(t, http.MethodPost, "/bookings", body, customerToken).json, "booking_id")
	env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"CONFIRM"}`, customerToken)
	env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"SEARCH"}`, adminToken)
	env.do(t, http.MethodPost, "/ops/bookings/"+bookingID+"/assign", fmt.Sprintf(`{"technician_id":%q}`, technicianID), adminToken)
	env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"DEPART"}`, technicianToken)
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"ARRIVE"}`, technicianToken); r.code != http.StatusOK {
		t.Fatalf("ARRIVE = %d; body=%s", r.code, r.body)
	}

	// VERIFY_START with no code -> 400.
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions", `{"action":"VERIFY_START"}`, technicianToken); r.code != http.StatusBadRequest {
		t.Errorf("VERIFY_START without code = %d, want 400", r.code)
	}

	// Issue the START OTP (main does this via the technician.arrived consumer; we call it
	// directly to get the plaintext for the test).
	bookingUUID := uuid.MustParse(bookingID)
	code, issued, err := env.verifier.IssueOTP(ctx, bookingUUID, verification.PurposeStart)
	if err != nil || !issued {
		t.Fatalf("IssueOTP: code=%q issued=%v err=%v", code, issued, err)
	}

	// A WRONG code -> 401, and the booking must NOT advance.
	wrong := "000000"
	if wrong == code {
		wrong = "111111"
	}
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions",
		fmt.Sprintf(`{"action":"VERIFY_START","code":%q}`, wrong), technicianToken); r.code != http.StatusUnauthorized {
		t.Errorf("wrong code = %d, want 401; body=%s", r.code, r.body)
	}
	assertBookingState(t, env, bookingID, "ARRIVED") // unchanged — atomic

	// The RIGHT code -> 200 and IN_PROGRESS.
	r := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions",
		fmt.Sprintf(`{"action":"VERIFY_START","code":%q}`, code), technicianToken)
	if r.code != http.StatusOK || r.json["state"] != "IN_PROGRESS" {
		t.Fatalf("correct code = %d state=%v, want 200 IN_PROGRESS; body=%s", r.code, r.json["state"], r.body)
	}

	// Replay of the now-consumed code -> the booking is already IN_PROGRESS, so VERIFY_START is
	// illegal from there (422). Either way it does not advance again.
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/transitions",
		fmt.Sprintf(`{"action":"VERIFY_START","code":%q}`, code), technicianToken); r.code == http.StatusOK {
		t.Errorf("replayed VERIFY_START succeeded (%d); a consumed code + advanced state must not", r.code)
	}
}

// ARRIVE publishes technician.arrived; the issuance is idempotent, so calling IssueOTP twice
// (a redelivery) does not mint a second code.
func TestOTPIssuanceIsIdempotent(t *testing.T) {
	env := newServer(t)
	ctx := context.Background()

	customer, address := env.seedCustomerAndAddress(t)
	variant := env.seedService(t, "599")
	body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, variant)
	customerToken := env.token(t, customer, identity.RoleCustomer)
	bookingID := mustString(t, env.do(t, http.MethodPost, "/bookings", body, customerToken).json, "booking_id")
	bookingUUID := uuid.MustParse(bookingID)

	_, issuedFirst, err := env.verifier.IssueOTP(ctx, bookingUUID, verification.PurposeStart)
	if err != nil || !issuedFirst {
		t.Fatalf("first issue: issued=%v err=%v", issuedFirst, err)
	}
	_, issuedSecond, err := env.verifier.IssueOTP(ctx, bookingUUID, verification.PurposeStart)
	if err != nil {
		t.Fatalf("second issue err: %v", err)
	}
	if issuedSecond {
		t.Error("second IssueOTP minted a new code; redelivery must be a no-op (it would invalidate the customer's code)")
	}

	var liveCount int
	if err := env.pool.QueryRow(ctx,
		"SELECT count(*) FROM otp_challenges WHERE booking_id=$1 AND purpose='START' AND consumed_at IS NULL", bookingUUID).
		Scan(&liveCount); err != nil {
		t.Fatal(err)
	}
	if liveCount != 1 {
		t.Errorf("live START challenges = %d, want 1", liveCount)
	}
}

func assertBookingState(t *testing.T, env *testEnv, bookingID, want string) {
	t.Helper()
	var state string
	if err := env.pool.QueryRow(context.Background(), "SELECT state FROM bookings WHERE id=$1", bookingID).Scan(&state); err != nil {
		t.Fatal(err)
	}
	if state != want {
		t.Errorf("booking state = %s, want %s", state, want)
	}
}
