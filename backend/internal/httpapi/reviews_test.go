package httpapi_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/outbox"
)

// A customer reviews their completed booking; the review.submitted event, processed by the
// outbox worker, updates the technician's rating. Guards: only a completed booking, only the
// owner, one review, valid rating.
func TestReviewUpdatesTechnicianRating(t *testing.T) {
	env := newServer(t)
	ctx := context.Background()

	customer, address := env.seedCustomerAndAddress(t)
	variant := env.seedService(t, "599")
	customerToken := env.token(t, customer, identity.RoleCustomer)

	technicianID := uuid.New()
	env.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Asha', 'TECHNICIAN')", technicianID, "+9191"+technicianID.String()[:8])
	env.exec(t, "INSERT INTO technicians (user_id, city, is_online) VALUES ($1, 'Bengaluru', true)", technicianID)

	body := fmt.Sprintf(`{"address_id":%q,"variant_id":%q,"quantity":1}`, address, variant)
	bookingID := mustString(t, env.do(t, http.MethodPost, "/bookings", body, customerToken).json, "booking_id")

	// Cannot review a booking that is not completed.
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/review", `{"rating":5}`, customerToken); r.code != http.StatusUnprocessableEntity {
		t.Errorf("review before completion = %d, want 422", r.code)
	}

	// Drive the booking to COMPLETED (assign the technician, then jump the state directly —
	// the review path only needs a completed booking with a technician).
	env.exec(t, "UPDATE bookings SET technician_id=$1, state='COMPLETED' WHERE id=$2", technicianID, uuid.MustParse(bookingID))

	// Invalid rating -> 400.
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/review", `{"rating":9}`, customerToken); r.code != http.StatusBadRequest {
		t.Errorf("rating 9 = %d, want 400", r.code)
	}

	// A different customer cannot review it -> 403.
	otherToken := env.staffToken(t, identity.RoleCustomer)
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/review", `{"rating":4}`, otherToken); r.code != http.StatusForbidden {
		t.Errorf("other customer review = %d, want 403", r.code)
	}

	// The owner reviews with a 4 -> 201.
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/review", `{"rating":4,"comment":"good"}`, customerToken); r.code != http.StatusCreated {
		t.Fatalf("review = %d, want 201; body=%s", r.code, r.body)
	}

	// Reviewing again -> 409 (one per booking).
	if r := env.do(t, http.MethodPost, "/bookings/"+bookingID+"/review", `{"rating":5}`, customerToken); r.code != http.StatusConflict {
		t.Errorf("second review = %d, want 409", r.code)
	}

	// Process review.submitted, which recomputes the technician's rating to the average (4.00).
	worker := newWorkerFromEnv(env)
	if _, err := worker.Poll(ctx); err != nil {
		t.Fatalf("Poll: %v", err)
	}
	var rating float64
	if err := env.pool.QueryRow(ctx, "SELECT rating FROM technicians WHERE user_id=$1", technicianID).Scan(&rating); err != nil {
		t.Fatal(err)
	}
	if rating != 4.0 {
		t.Errorf("technician rating = %v, want 4.00 (the one review)", rating)
	}
}

// newWorkerFromEnv builds an outbox worker with the review.submitted -> rating consumer, so
// the test can drive the event the same way main does.
func newWorkerFromEnv(env *testEnv) *outbox.Worker {
	identityService := identity.NewService(env.pool)
	dispatcher := outbox.NewDispatcher()
	dispatcher.Subscribe("review.submitted", func(ctx context.Context, event outbox.Event) error {
		var payload struct {
			TechnicianID uuid.UUID `json:"technician_id"`
		}
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			return err
		}
		return identityService.RecomputeTechnicianRating(ctx, payload.TechnicianID)
	})
	return outbox.NewWorker(env.pool, dispatcher)
}
