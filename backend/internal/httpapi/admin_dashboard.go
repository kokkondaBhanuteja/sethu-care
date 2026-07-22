package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// The operations dashboard: the headline KPIs, the critical-alert band, the needs-attention queue
// and the raw activity feed — plus the counters behind every navigation badge in both shells.

func (handler *AdminHandler) registerAdminDashboard(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "opsDashboardSummary", Method: http.MethodGet, Path: "/ops/dashboard/summary",
		Summary: "Headline KPIs with deltas and sparklines", Tags: []string{"Ops Dashboard"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.dashboardSummary)

	huma.Register(api, huma.Operation{
		OperationID: "opsDashboardBand", Method: http.MethodGet, Path: "/ops/dashboard/band",
		Summary: "The critical-alert band", Tags: []string{"Ops Dashboard"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.dashboardBand)

	huma.Register(api, huma.Operation{
		OperationID: "opsDashboardAttention", Method: http.MethodGet, Path: "/ops/dashboard/attention",
		Summary: "The needs-attention queue, in the server's priority order", Tags: []string{"Ops Dashboard"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.dashboardAttention)

	huma.Register(api, huma.Operation{
		OperationID: "opsActivityFeed", Method: http.MethodGet, Path: "/ops/activity",
		Summary: "The last N booking-state transitions", Tags: []string{"Ops Dashboard"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.activityFeed)

	huma.Register(api, huma.Operation{
		OperationID: "shellCounters", Method: http.MethodGet, Path: "/ops/shell-counters",
		Summary: "Counters for every navigation badge", Tags: []string{"Admin Shell"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.shellCounters)
}

// ------------------------------------------------------------------ summary

// dashboardPeriod is the window the summary covers.
type dashboardPeriod string

const (
	dashboardPeriodToday   dashboardPeriod = "today"
	dashboardPeriodLiveNow dashboardPeriod = "live_now"
)

// Schema names the dashboard-period vocabulary in the generated document.
func (dashboardPeriod) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "DashboardPeriod", "",
		string(dashboardPeriodToday), string(dashboardPeriodLiveNow))
}

// kpiDelta carries isGood alongside the sign because trend colour is SEMANTIC, not directional:
// a rising assign time is not good news.
type kpiDelta struct {
	IsGood bool  `json:"isGood" required:"true" doc:"Whether the movement is good news — a rising assign time is not."`
	Value  int64 `json:"value" required:"true" doc:"Signed change against the same period yesterday, in the metric's own whole unit (count, paise, milliseconds)."`
}

// kpiRateDelta is the rate-valued sibling of kpiDelta, for metrics that are not whole numbers.
type kpiRateDelta struct {
	IsGood bool    `json:"isGood" required:"true"`
	Value  float64 `json:"value" required:"true" doc:"Signed change as a 0–1 fraction."`
}

// dashboardSparklines carries eight points per metric.
type dashboardSparklines struct {
	AvgAssign  []int64   `json:"avgAssign" required:"true" nullable:"false"`
	Bookings   []int32   `json:"bookings" required:"true" nullable:"false"`
	Completion []float64 `json:"completion" required:"true" nullable:"false"`
	Revenue    []int64   `json:"revenue" required:"true" nullable:"false"`
}

type dashboardSummary struct {
	AvgAssignDelta  kpiDelta            `json:"avgAssignDelta" required:"true"`
	AvgAssignMs     int64               `json:"avgAssignMs" required:"true" doc:"Mean SEARCHING -> ASSIGNED. Measures the automation now that dispatch is automatic."`
	Bookings        int32               `json:"bookings" required:"true"`
	BookingsDelta   kpiDelta            `json:"bookingsDelta" required:"true"`
	CompletionDelta kpiRateDelta        `json:"completionDelta" required:"true"`
	CompletionRate  float64             `json:"completionRate" required:"true" doc:"0–1."`
	RevenueDelta    kpiDelta            `json:"revenueDelta" required:"true"`
	RevenuePaise    int64               `json:"revenuePaise" required:"true"`
	Sparklines      dashboardSparklines `json:"sparklines" required:"true"`
	UpdatedAt       time.Time           `json:"updatedAt" required:"true"`
}

type opsDashboardSummaryInput struct {
	Period dashboardPeriod `query:"period" doc:"Defaults to today."`
}

type dashboardSummaryOutput struct {
	Body dashboardSummary
}

func (handler *AdminHandler) dashboardSummary(_ context.Context, _ *opsDashboardSummaryInput) (*dashboardSummaryOutput, error) {
	return nil, notImplemented("opsDashboardSummary")
}

// --------------------------------------------------------------- alert band

type alertBandExample struct {
	BookingRef string            `json:"bookingRef" required:"true"`
	Priority   attentionPriority `json:"priority" required:"true"`
	SurfacedAt time.Time         `json:"surfacedAt" required:"true"`
}

// alertBandState is separate from the summary on purpose: alerts arrive on their own channel and
// must not wait for a slow metrics query.
type alertBandState struct {
	CriticalCount int32              `json:"criticalCount" required:"true" doc:"Unacknowledged criticals. Above 9 the band renders '9+'."`
	Examples      []alertBandExample `json:"examples" required:"true" nullable:"false" doc:"At most two, by design: the band is a pointer into the queue, not the queue."`
}

type alertBandStateOutput struct {
	Body alertBandState
}

func (handler *AdminHandler) dashboardBand(_ context.Context, _ *struct{}) (*alertBandStateOutput, error) {
	return nil, notImplemented("opsDashboardBand")
}

// ---------------------------------------------------------- attention queue

// attentionFilter is the chip row above the queue.
type attentionFilter string

const (
	attentionFilterAll        attentionFilter = "all"
	attentionFilterEscalated  attentionFilter = "escalated"
	attentionFilterUnassigned attentionFilter = "unassigned"
	attentionFilterSLA        attentionFilter = "sla"
	attentionFilterDelayed    attentionFilter = "delayed"
)

// Schema names the attention-filter vocabulary in the generated document.
func (attentionFilter) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AttentionFilter", "",
		string(attentionFilterAll), string(attentionFilterEscalated), string(attentionFilterUnassigned),
		string(attentionFilterSLA), string(attentionFilterDelayed))
}

// attentionPriority is declared worst-first. The SERVER owns the feed's order (tiers, oldest
// first within a tier); the client never re-sorts. It doubles as the DIAGNOSIS: it says what is
// wrong with the booking, which is why the queue carries no composed English reason line.
type attentionPriority string

const (
	attentionPriorityEscalated             attentionPriority = "escalated"
	attentionPrioritySLABreached           attentionPriority = "sla_breached"
	attentionPriorityFailedAssignment      attentionPriority = "failed_assignment"
	attentionPrioritySLARisk               attentionPriority = "sla_risk"
	attentionPriorityNoResponse            attentionPriority = "no_response"
	attentionPriorityEscalatedAcknowledged attentionPriority = "escalated_acknowledged"
)

// Schema names the attention-priority vocabulary in the generated document.
func (attentionPriority) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AttentionPriority",
		"Declared worst-first. The SERVER owns the feed's order (tiers, oldest first within a tier); the client never re-sorts. It also names the diagnosis the console renders.",
		string(attentionPriorityEscalated), string(attentionPrioritySLABreached),
		string(attentionPriorityFailedAssignment), string(attentionPrioritySLARisk),
		string(attentionPriorityNoResponse), string(attentionPriorityEscalatedAcknowledged))
}

// attentionProviderState is the provider-column word shown when there is no name. Null renders
// the em dash.
type attentionProviderState string

const (
	attentionProviderStateUnassigned  attentionProviderState = "unassigned"
	attentionProviderStateUnreachable attentionProviderState = "unreachable"
)

// Schema names the attention provider-state vocabulary in the generated document.
func (attentionProviderState) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AttentionProviderState",
		"The provider-column word shown when there is no name. Null renders the em dash.",
		string(attentionProviderStateUnassigned), string(attentionProviderStateUnreachable))
}

// attentionDiagnosis is the NUMBERS behind the queue row's coloured line. `priority` says what is
// wrong; these say by how much, so the console writes the sentence in its own language.
type attentionDiagnosis struct {
	DeclinedCount  *int32 `json:"declinedCount" required:"true" doc:"Providers that declined, where the diagnosis is a failed assignment."`
	DispatchRounds *int32 `json:"dispatchRounds" required:"true" doc:"Auto-dispatch rounds attempted, where the diagnosis is a failed assignment."`
	MinutesOverdue *int32 `json:"minutesOverdue" required:"true" doc:"Minutes past the SLA or the promised slot, where the diagnosis is a breach or a risk."`
}

type attentionItem struct {
	Acknowledged  bool                             `json:"acknowledged" required:"true"`
	AlertID       string                           `json:"alertId" required:"true" doc:"What acknowledgeAlert acts on. Distinct from the booking it points at."`
	AmountPaise   int64                            `json:"amountPaise" required:"true"`
	Area          string                           `json:"area" required:"true"`
	BookingID     string                           `json:"bookingId" required:"true"`
	BookingRef    string                           `json:"bookingRef" required:"true"`
	CustomerName  string                           `json:"customerName" required:"true"`
	Diagnosis     attentionDiagnosis               `json:"diagnosis" required:"true" doc:"The numbers behind the row's coloured line. Composed into a sentence by the console, alongside priority."`
	Priority      attentionPriority                `json:"priority" required:"true"`
	ProviderName  *string                          `json:"providerName" required:"true"`
	ProviderState nullable[attentionProviderState] `json:"providerState" required:"true"`
	Service       string                           `json:"service" required:"true"`
	SlotAt        time.Time                        `json:"slotAt" required:"true"`
	SurfacedAt    time.Time                        `json:"surfacedAt" required:"true" doc:"When the problem surfaced. The age column is derived, never sent pre-formatted."`
}

type attentionCounts struct {
	All        int32 `json:"all" required:"true"`
	Delayed    int32 `json:"delayed" required:"true"`
	Escalated  int32 `json:"escalated" required:"true"`
	SLA        int32 `json:"sla" required:"true"`
	Unassigned int32 `json:"unassigned" required:"true"`
}

type attentionLastCleared struct {
	AdminName  string    `json:"adminName" required:"true"`
	At         time.Time `json:"at" required:"true"`
	BookingRef string    `json:"bookingRef" required:"true"`
}

type attentionQueue struct {
	Counts      attentionCounts                `json:"counts" required:"true"`
	HealthyJobs int32                          `json:"healthyJobs" required:"true" doc:"Jobs running normally right now. The all-clear state counts them instead of the zero."`
	Items       []attentionItem                `json:"items" required:"true" nullable:"false"`
	LastCleared nullable[attentionLastCleared] `json:"lastCleared" required:"true" doc:"Populated only when the queue is empty — the all-clear state cites the last resolution."`
	NextCursor  *string                        `json:"nextCursor"`
	Total       int32                          `json:"total" required:"true" doc:"Total across every filter, so 'Showing 5 of 7' is honest under a filter."`
	UpdatedAt   time.Time                      `json:"updatedAt" required:"true"`
}

type opsDashboardAttentionInput struct {
	Filter attentionFilter `query:"filter" doc:"Chip filter. Defaults to all."`
	AdminPagination
}

type attentionQueueOutput struct {
	Body attentionQueue
}

func (handler *AdminHandler) dashboardAttention(_ context.Context, _ *opsDashboardAttentionInput) (*attentionQueueOutput, error) {
	return nil, notImplemented("opsDashboardAttention")
}

// ------------------------------------------------------------ activity feed

// activityKind is an enum, not a prose sentence: the console localises it.
type activityKind string

const (
	activityKindCompleted           activityKind = "completed"
	activityKindStarted             activityKind = "started"
	activityKindEnRoute             activityKind = "en_route"
	activityKindAssigned            activityKind = "assigned"
	activityKindAwaitingOTP         activityKind = "awaiting_otp"
	activityKindCancelledByCustomer activityKind = "cancelled_by_customer"
)

// Schema names the activity vocabulary in the generated document.
func (activityKind) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "ActivityKind", "An enum, not a prose sentence: the console localises it.",
		string(activityKindCompleted), string(activityKindStarted), string(activityKindEnRoute),
		string(activityKindAssigned), string(activityKindAwaitingOTP), string(activityKindCancelledByCustomer))
}

type activityEntry struct {
	At           time.Time    `json:"at" required:"true"`
	BookingRef   string       `json:"bookingRef" required:"true"`
	ID           string       `json:"id" required:"true"`
	Kind         activityKind `json:"kind" required:"true"`
	ProviderName *string      `json:"providerName" required:"true" doc:"Only the assigned kind carries one."`
}

type activityFeed struct {
	Items []activityEntry `json:"items" required:"true" nullable:"false"`
}

type opsActivityFeedInput struct {
	Limit int32 `query:"limit" doc:"Page size. Omitted takes the server default."`
}

type activityFeedOutput struct {
	Body activityFeed
}

func (handler *AdminHandler) activityFeed(_ context.Context, _ *opsActivityFeedInput) (*activityFeedOutput, error) {
	return nil, notImplemented("opsActivityFeed")
}

// ----------------------------------------------------------- shell counters

// shellCounters drives every navigation badge in both shells.
type shellCounters struct {
	CriticalAlerts      int32 `json:"criticalAlerts" required:"true" doc:"Unacknowledged CRITICAL alerts only. The badge must mean 'a human must act'."`
	NeedsAttention      int32 `json:"needsAttention" required:"true"`
	OpenTickets         int32 `json:"openTickets" required:"true"`
	PendingApplications int32 `json:"pendingApplications" required:"true"`
}

type shellCountersOutput struct {
	Body shellCounters
}

func (handler *AdminHandler) shellCounters(_ context.Context, _ *struct{}) (*shellCountersOutput, error) {
	return nil, notImplemented("shellCounters")
}
