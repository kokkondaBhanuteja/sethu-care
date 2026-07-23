package ops

// The live operations map: one snapshot of technician positions, active-job pins and the
// bookings needing attention — a read-only cross-module view like the dashboard's. The
// SERVER projects every position into percentages of a bounding box so the console never
// geocodes; when a real tile layer lands, only the projection here changes.
//
// Honest gaps, stated rather than faked:
//   - There is NO zones table. Zones, clusters and zero-supply banners are empty, and every
//     marker's ZoneID is the empty string.
//   - The viewport arguments (centre, zoom) are accepted but the whole service city is
//     returned; there is no tile model to window by yet.
//   - No delay tracking exists, so no job pin ever reports the delayed state.

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// PositionFreshnessWindow is how recent a technician's last-known position must be to earn a
// pin. An older position is dropped entirely — a pin the platform cannot vouch for is worse
// than no pin.
const PositionFreshnessWindow = 15 * time.Minute

// MapProviderStatus is a technician marker's colour.
type MapProviderStatus string

const (
	MapProviderOnline  MapProviderStatus = "ONLINE"
	MapProviderBusy    MapProviderStatus = "BUSY"
	MapProviderOffline MapProviderStatus = "OFFLINE"
)

// MapJobState is a job marker's colour. Delayed is declared for the contract but never
// produced: no delay tracking exists yet.
type MapJobState string

const (
	MapJobEnRoute   MapJobState = "EN_ROUTE"
	MapJobOnSite    MapJobState = "ON_SITE"
	MapJobEscalated MapJobState = "ESCALATED"
)

// MapAttentionReason mirrors the queue's two live diagnoses.
type MapAttentionReason string

const (
	MapAttentionEscalated  MapAttentionReason = "ESCALATED"
	MapAttentionNoProvider MapAttentionReason = "NO_PROVIDER"
)

// MapPoint is a projected position: percentages of the snapshot's bounding box.
type MapPoint struct {
	XPercent float64
	YPercent float64
}

// MapProvider is one technician marker.
type MapProvider struct {
	TechnicianID uuid.UUID
	Name         string
	Position     MapPoint
	LocatedAt    time.Time
	Status       MapProviderStatus
	// OnBookingID is set while the technician is working a job (status BUSY).
	OnBookingID *uuid.UUID
}

// MapJob is one active-job marker, pinned on the booking's address.
type MapJob struct {
	BookingID   uuid.UUID
	ServiceName string
	Position    MapPoint
	State       MapJobState
}

// MapAttentionItem is one row of the map's attention rail.
type MapAttentionItem struct {
	BookingID    uuid.UUID
	Reason       MapAttentionReason
	WaitingSince time.Time
}

// LiveMapSnapshot is everything one poll of the map renders.
type LiveMapSnapshot struct {
	Providers []MapProvider
	Jobs      []MapJob
	Attention []MapAttentionItem
	// ActiveJobCount and OnlineProviderCount are CITY totals, not marker counts.
	ActiveJobCount      int32
	OnlineProviderCount int32
	ObservedAt          time.Time
}

const defaultMapMarkerLimit = 200

// LiveMap reads one snapshot. markerLimit caps providers + jobs combined (the console
// renders at most 200); job pins keep priority when the cap bites.
func (service *Service) LiveMap(ctx context.Context, markerLimit int32) (LiveMapSnapshot, error) {
	if markerLimit <= 0 || markerLimit > defaultMapMarkerLimit {
		markerLimit = defaultMapMarkerLimit
	}
	queries := sqlcgen.New(service.pool)
	now := time.Now().UTC()

	freshAfter := pgtype.Timestamptz{Time: now.Add(-PositionFreshnessWindow), Valid: true}
	technicianRows, err := queries.MapTechnicianPositions(ctx, freshAfter)
	if err != nil {
		return LiveMapSnapshot{}, fmt.Errorf("reading technician positions: %w", err)
	}
	jobRows, err := queries.MapActiveJobs(ctx)
	if err != nil {
		return LiveMapSnapshot{}, fmt.Errorf("reading active jobs: %w", err)
	}
	attentionRows, err := queries.MapAttentionItems(ctx)
	if err != nil {
		return LiveMapSnapshot{}, fmt.Errorf("reading map attention: %w", err)
	}
	totals, err := queries.MapCityTotals(ctx)
	if err != nil {
		return LiveMapSnapshot{}, fmt.Errorf("reading map totals: %w", err)
	}

	// The bounding box covers every marker in the snapshot, padded so nothing sits on an
	// edge. The projection is deterministic for a given data set — the honest stand-in for
	// a real city bounding box until a zone/tile model exists.
	box := boundingBoxOf(technicianRows, jobRows)

	snapshot := LiveMapSnapshot{
		Providers:           []MapProvider{},
		Jobs:                []MapJob{},
		Attention:           make([]MapAttentionItem, len(attentionRows)),
		ActiveJobCount:      totals.ActiveJobs,
		OnlineProviderCount: totals.OnlineProviders,
		ObservedAt:          now,
	}

	for _, row := range jobRows {
		if int32(len(snapshot.Jobs)) >= markerLimit {
			break
		}
		snapshot.Jobs = append(snapshot.Jobs, MapJob{
			BookingID:   row.ID,
			ServiceName: row.ServiceName,
			Position:    box.project(row.Lat, row.Lng),
			State:       jobMapStateOf(row.State),
		})
	}

	for _, row := range technicianRows {
		if int32(len(snapshot.Jobs)+len(snapshot.Providers)) >= markerLimit {
			break
		}
		provider := MapProvider{
			TechnicianID: row.UserID,
			Name:         row.Name,
			Position:     box.project(row.Lat, row.Lng),
			LocatedAt:    row.LastLocationAt.Time,
			Status:       MapProviderOffline,
		}
		if row.ActiveBookingID != uuid.Nil {
			activeBookingID := row.ActiveBookingID
			provider.Status = MapProviderBusy
			provider.OnBookingID = &activeBookingID
		} else if row.IsOnline {
			provider.Status = MapProviderOnline
		}
		snapshot.Providers = append(snapshot.Providers, provider)
	}

	for index, row := range attentionRows {
		reason := MapAttentionNoProvider
		if row.State == "ESCALATED" {
			reason = MapAttentionEscalated
		}
		snapshot.Attention[index] = MapAttentionItem{
			BookingID:    row.ID,
			Reason:       reason,
			WaitingSince: row.WaitingSince.Time,
		}
	}
	return snapshot, nil
}

func jobMapStateOf(bookingState string) MapJobState {
	switch bookingState {
	case "EN_ROUTE":
		return MapJobEnRoute
	case "ESCALATED":
		return MapJobEscalated
	}
	return MapJobOnSite // ARRIVED and IN_PROGRESS: the technician is at the address
}

// ---------------------------------------------------------------------------
// Projection

type boundingBox struct {
	minLat, maxLat float64
	minLng, maxLng float64
}

// boundingBoxPadding keeps every marker off the exact edge of the map surface.
const boundingBoxPadding = 0.1

func boundingBoxOf(technicians []sqlcgen.MapTechnicianPositionsRow, jobs []sqlcgen.MapActiveJobsRow) boundingBox {
	box := boundingBox{}
	first := true
	grow := func(lat, lng float64) {
		if first {
			box = boundingBox{minLat: lat, maxLat: lat, minLng: lng, maxLng: lng}
			first = false
			return
		}
		box.minLat = min(box.minLat, lat)
		box.maxLat = max(box.maxLat, lat)
		box.minLng = min(box.minLng, lng)
		box.maxLng = max(box.maxLng, lng)
	}
	for _, technician := range technicians {
		grow(technician.Lat, technician.Lng)
	}
	for _, job := range jobs {
		grow(job.Lat, job.Lng)
	}

	latPad := (box.maxLat - box.minLat) * boundingBoxPadding
	lngPad := (box.maxLng - box.minLng) * boundingBoxPadding
	box.minLat -= latPad
	box.maxLat += latPad
	box.minLng -= lngPad
	box.maxLng += lngPad
	return box
}

// project maps lat/lng into percentages of the box. North is the top of the map, so a HIGHER
// latitude is a SMALLER yPercent. A degenerate box (one marker, or none) centres the point.
func (box boundingBox) project(lat, lng float64) MapPoint {
	point := MapPoint{XPercent: 50, YPercent: 50}
	if box.maxLng > box.minLng {
		point.XPercent = (lng - box.minLng) / (box.maxLng - box.minLng) * 100
	}
	if box.maxLat > box.minLat {
		point.YPercent = (box.maxLat - lat) / (box.maxLat - box.minLat) * 100
	}
	return point
}
