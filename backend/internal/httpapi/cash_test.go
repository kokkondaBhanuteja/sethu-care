package httpapi_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// A technician deposits the cash they collected for a booking; the admin reconciliation then
// shows the debt cleared. Guards: only the holding technician, only once, only real custody.
func TestCashDepositAndReconciliation(t *testing.T) {
	env := newServer(t)
	adminToken := env.staffToken(t, identity.RoleAdmin)

	customer, address := env.seedCustomerAndAddress(t)
	orderID := uuid.New()
	env.exec(t, "INSERT INTO orders (id, customer_id) VALUES ($1, $2)", orderID, uuid.MustParse(customer))
	bookingID := uuid.New()
	env.exec(t, "INSERT INTO bookings (id, order_id, customer_id, address_id, state, quoted_total_paise) VALUES ($1, $2, $3, $4, 'COMPLETED', 80000)",
		bookingID, orderID, uuid.MustParse(customer), uuid.MustParse(address))

	technicianID := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Asha', 'TECHNICIAN')", technicianID, "+9191"+technicianID.String()[:8])
	env.exec(t, "INSERT INTO technicians (user_id, city) VALUES ($1, 'Bengaluru')", technicianID)
	technicianToken := env.token(t, technicianID.String(), identity.RoleTechnician)

	// The technician collected ₹800 cash for the booking (a CASH_CUSTODY entry).
	env.exec(t, `INSERT INTO ledger_entries (kind, amount_paise, booking_id, technician_id, method, memo)
		VALUES ('CASH_CUSTODY', 80000, $1, $2, 'CASH', 'collected')`, bookingID, technicianID)

	// A different technician cannot deposit this cash -> 403.
	otherTech := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Bhanu', 'TECHNICIAN')", otherTech, "+9192"+otherTech.String()[:8])
	env.exec(t, "INSERT INTO technicians (user_id, city) VALUES ($1, 'Bengaluru')", otherTech)
	otherToken := env.token(t, otherTech.String(), identity.RoleTechnician)
	if r := env.do(t, http.MethodPost, "/me/cash/deposit", fmt.Sprintf(`{"booking_id":%q}`, bookingID), otherToken); r.code != http.StatusForbidden {
		t.Errorf("other technician deposit = %d, want 403", r.code)
	}

	// Before the deposit, the holder owes ₹800 in the reconciliation.
	recon := env.do(t, http.MethodGet, "/ops/cash-reconciliation", "", adminToken)
	if recon.code != http.StatusOK {
		t.Fatalf("GET reconciliation = %d, want 200", recon.code)
	}
	if outstanding := outstandingFor(t, recon, technicianID.String()); outstanding != "800.00" {
		t.Errorf("outstanding before deposit = %q, want 800.00", outstanding)
	}

	// The holding technician deposits -> 201.
	if r := env.do(t, http.MethodPost, "/me/cash/deposit", fmt.Sprintf(`{"booking_id":%q}`, bookingID), technicianToken); r.code != http.StatusCreated {
		t.Fatalf("deposit = %d, want 201; body=%s", r.code, r.body)
	}
	// Depositing again -> 409.
	if r := env.do(t, http.MethodPost, "/me/cash/deposit", fmt.Sprintf(`{"booking_id":%q}`, bookingID), technicianToken); r.code != http.StatusConflict {
		t.Errorf("second deposit = %d, want 409", r.code)
	}

	// After the deposit the technician has cleared their debt — no longer in reconciliation.
	recon = env.do(t, http.MethodGet, "/ops/cash-reconciliation", "", adminToken)
	if outstanding := outstandingFor(t, recon, technicianID.String()); outstanding != "" {
		t.Errorf("outstanding after deposit = %q, want gone (debt cleared)", outstanding)
	}

	// Depositing for a booking with no cash custody -> 422.
	otherOrderID := uuid.New()
	env.exec(t, "INSERT INTO orders (id, customer_id) VALUES ($1, $2)", otherOrderID, uuid.MustParse(customer))
	noCustody := uuid.New()
	env.exec(t, "INSERT INTO bookings (id, order_id, customer_id, address_id, state) VALUES ($1, $2, $3, $4, 'COMPLETED')",
		noCustody, otherOrderID, uuid.MustParse(customer), uuid.MustParse(address))
	if r := env.do(t, http.MethodPost, "/me/cash/deposit", fmt.Sprintf(`{"booking_id":%q}`, noCustody), technicianToken); r.code != http.StatusUnprocessableEntity {
		t.Errorf("deposit with no custody = %d, want 422", r.code)
	}
}

// outstandingFor returns the outstanding amount for a technician in the reconciliation list,
// or "" if they are not present (debt cleared).
func outstandingFor(t *testing.T, resp result, technicianID string) string {
	t.Helper()
	for _, entry := range asArray(t, resp.json["reconciliation"]) {
		row := asObject(t, entry)
		if row["technician_id"] == technicianID {
			if amount, ok := row["outstanding"].(string); ok {
				return amount
			}
		}
	}
	return ""
}
