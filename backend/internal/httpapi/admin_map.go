package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
)

// One snapshot of the live operations map. Positions are PROJECTED by the server into percentages
// of the service-city bounding box: the client never geocodes, and when a real tile layer lands,
// mapPoint becomes { lat, lng } and nothing above the map surface changes.

func (handler *AdminHandler) registerAdminMap(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "opsLiveMap", Method: http.MethodGet, Path: "/ops/live-map",
		Summary: "One snapshot of the live operations map", Tags: []string{"Ops Map"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.liveMap)
}

type jobMapState string

const (
	jobMapStateEnRoute   jobMapState = "enRoute"
	jobMapStateOnSite    jobMapState = "onSite"
	jobMapStateDelayed   jobMapState = "delayed"
	jobMapStateEscalated jobMapState = "escalated"
)

// Schema names the job-marker vocabulary in the generated document.
func (jobMapState) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "JobMapState", "",
		string(jobMapStateEnRoute), string(jobMapStateOnSite),
		string(jobMapStateDelayed), string(jobMapStateEscalated))
}

type providerMapStatus string

const (
	providerMapStatusOnline  providerMapStatus = "online"
	providerMapStatusBusy    providerMapStatus = "busy"
	providerMapStatusOffline providerMapStatus = "offline"
)

// Schema names the provider-marker vocabulary in the generated document.
func (providerMapStatus) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "ProviderMapStatus", "",
		string(providerMapStatusOnline), string(providerMapStatusBusy), string(providerMapStatusOffline))
}

type attentionReason string

const (
	attentionReasonEscalated  attentionReason = "escalated"
	attentionReasonNoProvider attentionReason = "noProvider"
)

// Schema names the map attention vocabulary in the generated document.
func (attentionReason) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AttentionReason", "",
		string(attentionReasonEscalated), string(attentionReasonNoProvider))
}

// mapPoint is a position as a percentage of the service-city bounding box, not lat/lng. The
// server projects; the client never geocodes.
type mapPoint struct {
	XPercent float64 `json:"xPercent" required:"true"`
	YPercent float64 `json:"yPercent" required:"true"`
}

type mapZone struct {
	ID      string   `json:"id" required:"true"`
	LabelAt mapPoint `json:"labelAt" required:"true"`
	Name    string   `json:"name" required:"true"`
}

// mapCluster is server-side clustering above 50 markers; each cluster carries the zone it
// collapses.
type mapCluster struct {
	ID          string   `json:"id" required:"true"`
	MarkerCount int32    `json:"markerCount" required:"true"`
	Position    mapPoint `json:"position" required:"true"`
	ZoneID      string   `json:"zoneId" required:"true"`
}

type mapJob struct {
	BookingRef  string      `json:"bookingRef" required:"true"`
	ID          string      `json:"id" required:"true"`
	Position    mapPoint    `json:"position" required:"true"`
	ServiceName string      `json:"serviceName" required:"true"`
	State       jobMapState `json:"state" required:"true"`
	ZoneID      string      `json:"zoneId" required:"true"`
}

type mapProvider struct {
	ID           string            `json:"id" required:"true"`
	LocatedAt    time.Time         `json:"locatedAt" required:"true" doc:"An offline provider's position is its last known one, so the age travels with it. Positions are throttled to 10s."`
	Name         string            `json:"name" required:"true"`
	OnBookingRef string            `json:"onBookingRef,omitempty" doc:"Set while status is busy."`
	Position     mapPoint          `json:"position" required:"true"`
	Status       providerMapStatus `json:"status" required:"true"`
	ZoneID       string            `json:"zoneId" required:"true"`
}

type mapAttentionItem struct {
	BookingRef   string          `json:"bookingRef" required:"true"`
	ID           string          `json:"id" required:"true"`
	Reason       attentionReason `json:"reason" required:"true"`
	WaitingSince time.Time       `json:"waitingSince" required:"true"`
	ZoneID       string          `json:"zoneId" required:"true"`
}

type liveMapSnapshot struct {
	ActiveJobCount      int32              `json:"activeJobCount" required:"true" doc:"A CITY total, not a count of the markers in this response."`
	Attention           []mapAttentionItem `json:"attention" required:"true" nullable:"false"`
	Clusters            []mapCluster       `json:"clusters" required:"true" nullable:"false"`
	Jobs                []mapJob           `json:"jobs" required:"true" nullable:"false"`
	ObservedAt          time.Time          `json:"observedAt" required:"true" doc:"When the server observed these positions — the input to the staleness chip."`
	OnlineProviderCount int32              `json:"onlineProviderCount" required:"true" doc:"A CITY total, not a count of the markers in this response."`
	Providers           []mapProvider      `json:"providers" required:"true" nullable:"false"`
	ZeroSupplyZoneIDs   []string           `json:"zeroSupplyZoneIds" required:"true" nullable:"false" doc:"Zones with nobody online at all. The same zones' providers must be absent from providers — a banner over a zone still showing free technicians is worse than no banner."`
	Zones               []mapZone          `json:"zones" required:"true" nullable:"false"`
}

type opsLiveMapInput struct {
	CentreXPercent float64 `query:"centreXPercent" doc:"Viewport centre, as a percentage of the city bounding box."`
	CentreYPercent float64 `query:"centreYPercent" doc:"Viewport centre, as a percentage of the city bounding box."`
	Zoom           float64 `query:"zoom" doc:"1 = the whole service city."`
	Limit          int32   `query:"limit" doc:"Marker cap. The console renders at most 200."`
}

type liveMapOutput struct {
	Body liveMapSnapshot
}

// liveMap serves one snapshot from real data: technician positions inside the freshness
// window (ops.PositionFreshnessWindow), job pins on active bookings' addresses, and the
// SEARCHING/ESCALATED attention rail. Honest gaps, stated rather than faked:
//   - No zones table exists, so zones, clusters and zeroSupplyZoneIds are EMPTY and every
//     marker's zoneId is the empty string.
//   - The viewport parameters (centre, zoom) are accepted but the whole service city is
//     returned; there is no tile model to window by yet.
//   - No delay tracking exists, so no job pin ever reports the delayed state.
func (handler *AdminHandler) liveMap(ctx context.Context, input *opsLiveMapInput) (*liveMapOutput, error) {
	snapshot, err := handler.ops.LiveMap(ctx, input.Limit)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}

	body := liveMapSnapshot{
		ActiveJobCount:      snapshot.ActiveJobCount,
		Attention:           make([]mapAttentionItem, len(snapshot.Attention)),
		Clusters:            []mapCluster{},
		Jobs:                make([]mapJob, len(snapshot.Jobs)),
		ObservedAt:          snapshot.ObservedAt,
		OnlineProviderCount: snapshot.OnlineProviderCount,
		Providers:           make([]mapProvider, len(snapshot.Providers)),
		ZeroSupplyZoneIDs:   []string{},
		Zones:               []mapZone{},
	}
	for index, job := range snapshot.Jobs {
		body.Jobs[index] = mapJob{
			BookingRef:  adminBookingReference(job.BookingID),
			ID:          job.BookingID.String(),
			Position:    mapPoint{XPercent: job.Position.XPercent, YPercent: job.Position.YPercent},
			ServiceName: job.ServiceName,
			State:       jobMapStateDTOOf(job.State),
			ZoneID:      "",
		}
	}
	for index, provider := range snapshot.Providers {
		dto := mapProvider{
			ID:        provider.TechnicianID.String(),
			LocatedAt: provider.LocatedAt,
			Name:      provider.Name,
			Position:  mapPoint{XPercent: provider.Position.XPercent, YPercent: provider.Position.YPercent},
			Status:    providerMapStatusDTOOf(provider.Status),
			ZoneID:    "",
		}
		if provider.OnBookingID != nil {
			dto.OnBookingRef = adminBookingReference(*provider.OnBookingID)
		}
		body.Providers[index] = dto
	}
	for index, item := range snapshot.Attention {
		reason := attentionReasonNoProvider
		if item.Reason == ops.MapAttentionEscalated {
			reason = attentionReasonEscalated
		}
		body.Attention[index] = mapAttentionItem{
			BookingRef:   adminBookingReference(item.BookingID),
			ID:           item.BookingID.String(),
			Reason:       reason,
			WaitingSince: item.WaitingSince,
			ZoneID:       "",
		}
	}
	return &liveMapOutput{Body: body}, nil
}

func jobMapStateDTOOf(state ops.MapJobState) jobMapState {
	switch state {
	case ops.MapJobEnRoute:
		return jobMapStateEnRoute
	case ops.MapJobEscalated:
		return jobMapStateEscalated
	case ops.MapJobOnSite:
		return jobMapStateOnSite
	}
	return jobMapStateOnSite // unreachable: the domain vocabulary is closed
}

func providerMapStatusDTOOf(status ops.MapProviderStatus) providerMapStatus {
	switch status {
	case ops.MapProviderOnline:
		return providerMapStatusOnline
	case ops.MapProviderBusy:
		return providerMapStatusBusy
	case ops.MapProviderOffline:
		return providerMapStatusOffline
	}
	return providerMapStatusOffline // unreachable: the domain vocabulary is closed
}
