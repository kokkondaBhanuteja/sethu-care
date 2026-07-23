package ops_test

// The live-map read model against real PostGIS: freshness filtering on technician positions,
// the status/state vocabularies, the city totals, and the percentage projection staying
// inside the map surface.

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

type liveMapFixture struct {
	pool *pgxpool.Pool
	ops  *ops.Service
}

func newLiveMapFixture(t *testing.T) *liveMapFixture {
	t.Helper()
	pool := storagetest.NewPool(t, migrationsDir)
	return &liveMapFixture{pool: pool, ops: ops.New(pool, booking.NewService(pool))}
}

func (fixture *liveMapFixture) exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	if _, err := fixture.pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("seed exec: %v\n  %s", err, sql)
	}
}

// seedTechnician creates a technician with a last-known position at the given age.
func (fixture *liveMapFixture) seedTechnician(t *testing.T, name string, online bool, lat, lng float64, positionAge time.Duration) uuid.UUID {
	t.Helper()
	technicianID := uuid.New()
	fixture.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, $3, 'TECHNICIAN')",
		technicianID, "+9191"+technicianID.String()[:8], name)
	fixture.exec(t, `INSERT INTO technicians (user_id, city, is_online, last_lat, last_lng, last_location_at)
		VALUES ($1, 'Bengaluru', $2, $3, $4, $5)`,
		technicianID, online, lat, lng, time.Now().Add(-positionAge))
	return technicianID
}

// seedBookingInState creates the minimal spine for one booking in the given state.
func (fixture *liveMapFixture) seedBookingInState(t *testing.T, state string, technicianID *uuid.UUID, lat, lng float64) uuid.UUID {
	t.Helper()
	customerID, addressID := uuid.New(), uuid.New()
	categoryID, serviceID, variantID := uuid.New(), uuid.New(), uuid.New()
	orderID, bookingID := uuid.New(), uuid.New()

	fixture.exec(t, "INSERT INTO users (id, phone, name, role) VALUES ($1, $2, 'Map Customer', 'CUSTOMER')",
		customerID, "+9190"+customerID.String()[:8])
	fixture.exec(t, `INSERT INTO addresses (id, user_id, line1, city, pincode, geog)
		VALUES ($1, $2, '1 Map Rd', 'Bengaluru', '560001', ST_MakePoint($3, $4)::geography)`,
		addressID, customerID, lng, lat)
	fixture.exec(t, "INSERT INTO categories (id, name, slug) VALUES ($1, 'Map', $2)", categoryID, "cat-"+categoryID.String()[:8])
	fixture.exec(t, "INSERT INTO services (id, category_id, name, slug) VALUES ($1, $2, 'Geyser Repair', $3)",
		serviceID, categoryID, "svc-"+serviceID.String()[:8])
	fixture.exec(t, "INSERT INTO service_variants (id, service_id, name, base_price_paise) VALUES ($1, $2, 'Standard', 49900)",
		variantID, serviceID)
	fixture.exec(t, "INSERT INTO orders (id, customer_id, status, total_paise) VALUES ($1, $2, 'PENDING', 49900)",
		orderID, customerID)
	fixture.exec(t, `INSERT INTO bookings (id, order_id, customer_id, address_id, technician_id, state, quoted_total_paise)
		VALUES ($1, $2, $3, $4, $5, $6, 49900)`, bookingID, orderID, customerID, addressID, technicianID, state)
	fixture.exec(t, `INSERT INTO booking_items (booking_id, service_id, variant_id, quantity, line_total_paise)
		VALUES ($1, $2, $3, 1, 49900)`, bookingID, serviceID, variantID)
	return bookingID
}

func TestLiveMapFiltersStalePositionsAndNamesStatuses(t *testing.T) {
	fixture := newLiveMapFixture(t)
	ctx := context.Background()

	freshOnline := fixture.seedTechnician(t, "Fresh Online", true, 12.97, 77.59, time.Minute)
	fixture.seedTechnician(t, "Stale", true, 12.95, 77.60, ops.PositionFreshnessWindow+time.Minute)
	freshOffline := fixture.seedTechnician(t, "Fresh Offline", false, 12.98, 77.61, 2*time.Minute)
	busyTechnician := fixture.seedTechnician(t, "Busy", true, 12.96, 77.58, time.Minute)

	enRouteBooking := fixture.seedBookingInState(t, "EN_ROUTE", &busyTechnician, 12.99, 77.62)
	escalatedBooking := fixture.seedBookingInState(t, "ESCALATED", nil, 12.94, 77.57)
	fixture.seedBookingInState(t, "SEARCHING", nil, 12.93, 77.56)

	snapshot, err := fixture.ops.LiveMap(ctx, 0)
	if err != nil {
		t.Fatalf("LiveMap: %v", err)
	}

	statusByID := map[uuid.UUID]ops.MapProviderStatus{}
	for _, provider := range snapshot.Providers {
		statusByID[provider.TechnicianID] = provider.Status
		if provider.Position.XPercent < 0 || provider.Position.XPercent > 100 ||
			provider.Position.YPercent < 0 || provider.Position.YPercent > 100 {
			t.Errorf("provider %s projected outside the surface: %+v", provider.Name, provider.Position)
		}
	}
	if len(snapshot.Providers) != 3 {
		t.Fatalf("providers = %d, want the 3 fresh positions (stale filtered)", len(snapshot.Providers))
	}
	if statusByID[freshOnline] != ops.MapProviderOnline {
		t.Errorf("fresh online technician status = %s", statusByID[freshOnline])
	}
	if statusByID[freshOffline] != ops.MapProviderOffline {
		t.Errorf("fresh offline technician status = %s", statusByID[freshOffline])
	}
	if statusByID[busyTechnician] != ops.MapProviderBusy {
		t.Errorf("busy technician status = %s", statusByID[busyTechnician])
	}
	for _, provider := range snapshot.Providers {
		if provider.TechnicianID == busyTechnician {
			if provider.OnBookingID == nil || *provider.OnBookingID != enRouteBooking {
				t.Errorf("busy technician OnBookingID = %v, want %s", provider.OnBookingID, enRouteBooking)
			}
		}
	}

	stateByBooking := map[uuid.UUID]ops.MapJobState{}
	for _, job := range snapshot.Jobs {
		stateByBooking[job.BookingID] = job.State
	}
	if stateByBooking[enRouteBooking] != ops.MapJobEnRoute {
		t.Errorf("en-route pin state = %s", stateByBooking[enRouteBooking])
	}
	if stateByBooking[escalatedBooking] != ops.MapJobEscalated {
		t.Errorf("escalated pin state = %s", stateByBooking[escalatedBooking])
	}
	if len(snapshot.Jobs) != 2 {
		t.Errorf("job pins = %d, want EN_ROUTE + ESCALATED only (SEARCHING has no pin)", len(snapshot.Jobs))
	}

	reasons := map[ops.MapAttentionReason]int{}
	for _, item := range snapshot.Attention {
		reasons[item.Reason]++
		if item.WaitingSince.IsZero() {
			t.Error("attention item without a waiting-since instant")
		}
	}
	if reasons[ops.MapAttentionEscalated] != 1 || reasons[ops.MapAttentionNoProvider] != 1 {
		t.Errorf("attention reasons = %v, want one escalated and one noProvider", reasons)
	}

	if snapshot.ActiveJobCount != 1 {
		t.Errorf("activeJobCount = %d, want the one EN_ROUTE booking", snapshot.ActiveJobCount)
	}
	if snapshot.OnlineProviderCount != 3 {
		t.Errorf("onlineProviderCount = %d, want the 3 online technicians (a CITY total, stale included)", snapshot.OnlineProviderCount)
	}
	if snapshot.ObservedAt.IsZero() {
		t.Error("ObservedAt must be set")
	}
}
