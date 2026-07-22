package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// The open settlement cycle. The totals cover the WHOLE cycle, not the returned page — a page of
// rows whose totals only add up to that page would be read as the payout run itself.

func (handler *AdminHandler) registerAdminPayouts(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "opsCurrentPayoutCycle", Method: http.MethodGet, Path: "/ops/payouts/current",
		Summary: "The open settlement cycle", Tags: []string{"Ops Payouts"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.currentPayoutCycle)
}

type payoutStatus string

const (
	payoutStatusReady   payoutStatus = "ready"
	payoutStatusOnHold  payoutStatus = "onHold"
	payoutStatusBlocked payoutStatus = "blocked"
)

// Schema names the payout-status vocabulary in the generated document.
func (payoutStatus) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "PayoutStatus", "",
		string(payoutStatusReady), string(payoutStatusOnHold), string(payoutStatusBlocked))
}

type payoutRow struct {
	AdjustmentsPaise int64        `json:"adjustmentsPaise" required:"true" doc:"Negative where a refund or a penalty is deducted from this cycle."`
	CommissionPaise  int64        `json:"commissionPaise" required:"true"`
	GrossPaise       int64        `json:"grossPaise" required:"true"`
	Jobs             int32        `json:"jobs" required:"true"`
	NetPaise         int64        `json:"netPaise" required:"true"`
	ProviderID       string       `json:"providerId" required:"true"`
	ProviderName     string       `json:"providerName" required:"true"`
	Status           payoutStatus `json:"status" required:"true"`
}

// payoutTotals cover the whole cycle, not the returned page.
type payoutTotals struct {
	AdjustmentsPaise int64 `json:"adjustmentsPaise" required:"true"`
	CommissionPaise  int64 `json:"commissionPaise" required:"true"`
	GrossPaise       int64 `json:"grossPaise" required:"true"`
	Jobs             int32 `json:"jobs" required:"true"`
	NetPaise         int64 `json:"netPaise" required:"true"`
}

type payoutCycle struct {
	CycleClosesIso    time.Time    `json:"cycleClosesIso" required:"true"`
	LastRunIso        time.Time    `json:"lastRunIso" required:"true"`
	LastRunPaise      int64        `json:"lastRunPaise" required:"true"`
	LastRunProviders  int32        `json:"lastRunProviders" required:"true"`
	NextCursor        *string      `json:"nextCursor"`
	NextRunIso        time.Time    `json:"nextRunIso" required:"true"`
	NextRunTime       clockTime    `json:"nextRunTime" required:"true"`
	PendingPaise      int64        `json:"pendingPaise" required:"true"`
	ProvidersAwaiting int32        `json:"providersAwaiting" required:"true"`
	Rows              []payoutRow  `json:"rows" required:"true" nullable:"false"`
	Totals            payoutTotals `json:"totals" required:"true"`
	Zones             int32        `json:"zones" required:"true"`
}

type opsCurrentPayoutCycleInput struct {
	AdminPagination
}

type payoutCycleOutput struct {
	Body payoutCycle
}

func (handler *AdminHandler) currentPayoutCycle(_ context.Context, _ *opsCurrentPayoutCycleInput) (*payoutCycleOutput, error) {
	return nil, notImplemented("opsCurrentPayoutCycle")
}
