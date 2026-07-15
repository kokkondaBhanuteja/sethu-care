package httpapi_test

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// A UPI collection is fetched as a QR by its owner, refused to a stranger, captured by the
// provider (admin), and — once captured — booked as REVENUE with no QR to pay anymore.
func TestUPIPaymentCollectionAndCapture(t *testing.T) {
	env := newServer(t)
	adminToken := env.staffToken(t, identity.RoleAdmin)

	customer, address := env.seedCustomerAndAddress(t)
	orderID := uuid.New()
	env.exec(t, "INSERT INTO orders (id, customer_id) VALUES ($1, $2)", orderID, uuid.MustParse(customer))
	bookingID := uuid.New()
	env.exec(t, "INSERT INTO bookings (id, order_id, customer_id, address_id, state, quoted_total_paise) VALUES ($1, $2, $3, $4, 'COMPLETED', 59900)",
		bookingID, orderID, uuid.MustParse(customer), uuid.MustParse(address))

	reference := "SC" + strings.ReplaceAll(bookingID.String(), "-", "")
	env.exec(t, "INSERT INTO payments (booking_id, order_id, amount_paise, reference) VALUES ($1, $2, 59900, $3)",
		bookingID, orderID, reference)

	customerToken := env.token(t, customer, identity.RoleCustomer)

	// The owner fetches the QR: PENDING, with a upi:// link carrying the amount and reference.
	got := env.do(t, http.MethodGet, "/bookings/"+bookingID.String()+"/payment", "", customerToken)
	if got.code != http.StatusOK {
		t.Fatalf("GET payment = %d, want 200; body=%s", got.code, got.body)
	}
	if got.json["status"] != "PENDING" {
		t.Errorf("status = %v, want PENDING", got.json["status"])
	}
	if got.json["amount"] != "599.00" {
		t.Errorf("amount = %v, want 599.00", got.json["amount"])
	}
	link, ok := got.json["upi_link"].(string)
	if !ok || !strings.HasPrefix(link, "upi://pay?") || !strings.Contains(link, "tr="+reference) || !strings.Contains(link, "am=599.00") {
		t.Errorf("upi_link = %q, want a upi://pay intent with the reference and amount", link)
	}

	// A different customer may not see this collection.
	stranger := env.staffToken(t, identity.RoleCustomer)
	if r := env.do(t, http.MethodGet, "/bookings/"+bookingID.String()+"/payment", "", stranger); r.code != http.StatusForbidden {
		t.Errorf("stranger GET = %d, want 403", r.code)
	}

	// Capturing an unknown reference -> 404.
	if r := env.do(t, http.MethodPost, "/payments/SCdoesnotexist/capture", "", adminToken); r.code != http.StatusNotFound {
		t.Errorf("capture unknown = %d, want 404", r.code)
	}

	// The provider confirms the money landed -> 200, and REVENUE is booked once.
	if r := env.do(t, http.MethodPost, "/payments/"+reference+"/capture", `{"provider_ref":"UPIRRN123"}`, adminToken); r.code != http.StatusOK {
		t.Fatalf("capture = %d, want 200; body=%s", r.code, r.body)
	}
	var revenue int
	if err := env.pool.QueryRow(context.Background(),
		"SELECT count(*) FROM ledger_entries WHERE order_id=$1 AND kind='REVENUE' AND amount_paise=59900", orderID).
		Scan(&revenue); err != nil {
		t.Fatal(err)
	}
	if revenue != 1 {
		t.Errorf("REVENUE entries after capture = %d, want 1", revenue)
	}

	// After capture the QR is gone: status CAPTURED, no upi_link.
	after := env.do(t, http.MethodGet, "/bookings/"+bookingID.String()+"/payment", "", customerToken)
	if after.json["status"] != "CAPTURED" {
		t.Errorf("status after capture = %v, want CAPTURED", after.json["status"])
	}
	if _, present := after.json["upi_link"]; present {
		t.Errorf("upi_link still present after capture: %v", after.json["upi_link"])
	}
}

// A booking with no collection (cash, warranty, or not yet completed) returns 404 for its
// payment.
func TestPaymentNotFoundForBookingWithoutCollection(t *testing.T) {
	env := newServer(t)
	customer, address := env.seedCustomerAndAddress(t)
	orderID := uuid.New()
	env.exec(t, "INSERT INTO orders (id, customer_id) VALUES ($1, $2)", orderID, uuid.MustParse(customer))
	bookingID := uuid.New()
	env.exec(t, "INSERT INTO bookings (id, order_id, customer_id, address_id, state) VALUES ($1, $2, $3, $4, 'COMPLETED')",
		bookingID, orderID, uuid.MustParse(customer), uuid.MustParse(address))

	token := env.token(t, customer, identity.RoleCustomer)
	if r := env.do(t, http.MethodGet, fmt.Sprintf("/bookings/%s/payment", bookingID), "", token); r.code != http.StatusNotFound {
		t.Errorf("GET payment without collection = %d, want 404", r.code)
	}
}
