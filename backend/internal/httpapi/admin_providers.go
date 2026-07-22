package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// The provider roster, one provider's profile, and the three ways an operator can take a provider
// out of circulation — force offline (medium risk, 30s undo), suspend (high) and block (critical).
// All three share one payload; `type` decides which, and the active jobs must be resolved first
// because a suspension that strands a customer mid-job is the failure the flow exists to prevent.

func (handler *AdminHandler) registerAdminProviders(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "opsListProviders", Method: http.MethodGet, Path: "/ops/providers",
		Summary: "The provider roster", Tags: []string{"Ops Providers"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.listProviders)

	huma.Register(api, huma.Operation{
		OperationID: "opsGetProvider", Method: http.MethodGet, Path: "/ops/providers/{id}",
		Summary: "Provider profile with metrics, documents and history", Tags: []string{"Ops Providers"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"404", "Not Found", adminError{}},
		),
	}, handler.getProvider)

	huma.Register(api, huma.Operation{
		OperationID: "opsProviderActiveJobs", Method: http.MethodGet, Path: "/ops/providers/{id}/active-jobs",
		Summary: "The provider's live jobs, for step 3 of the suspend flow", Tags: []string{"Ops Providers"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"404", "Not Found", adminError{}},
		),
	}, handler.providerActiveJobs)

	huma.Register(api, huma.Operation{
		OperationID: "opsSuspendProvider", Method: http.MethodPost, Path: "/ops/providers/{id}/suspend",
		Summary: "Suspend a provider, with its active jobs resolved", Tags: []string{"Ops Providers"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"404", "Not Found", adminError{}},
			adminResponse{"409", "Conflict — the record moved since it was read", staleVersionError{}},
			adminResponse{"422", "Validation — an active job was left unresolved", adminError{}},
		),
	}, handler.suspendProvider)

	huma.Register(api, huma.Operation{
		OperationID: "opsBlockProvider", Method: http.MethodPost, Path: "/ops/providers/{id}/block",
		Summary: "Block a provider permanently", Tags: []string{"Ops Providers"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"404", "Not Found", adminError{}},
			adminResponse{"409", "Conflict — the record moved since it was read", staleVersionError{}},
		),
	}, handler.blockProvider)

	huma.Register(api, huma.Operation{
		OperationID: "opsForceProviderOffline", Method: http.MethodPost, Path: "/ops/providers/{id}/force-offline",
		Summary: "Force a provider offline", Tags: []string{"Ops Providers"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"404", "Not Found", adminError{}},
			adminResponse{"409", "Conflict — the record moved since it was read", staleVersionError{}},
		),
	}, handler.forceProviderOffline)

	huma.Register(api, huma.Operation{
		OperationID: "opsRestoreProvider", Method: http.MethodPost, Path: "/ops/providers/{id}/restore",
		Summary: "Reverse a suspension or a block", Tags: []string{"Ops Providers"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"404", "Not Found", adminError{}},
			adminResponse{"409", "Conflict — the record moved since it was read", staleVersionError{}},
		),
	}, handler.restoreProvider)
}

// ------------------------------------------------------------- vocabularies

type rosterSegment string

const (
	rosterSegmentOnline rosterSegment = "online"
	rosterSegmentOnJob  rosterSegment = "onJob"
	rosterSegmentAll    rosterSegment = "all"
)

// Schema names the roster-segment vocabulary in the generated document.
func (rosterSegment) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "RosterSegment", "",
		string(rosterSegmentOnline), string(rosterSegmentOnJob), string(rosterSegmentAll))
}

type providerStatus string

const (
	providerStatusFree       providerStatus = "free"
	providerStatusOnJob      providerStatus = "on_job"
	providerStatusOffline    providerStatus = "offline"
	providerStatusSuspended  providerStatus = "suspended"
	providerStatusOffboarded providerStatus = "offboarded"
)

// Schema names the provider-status vocabulary in the generated document.
func (providerStatus) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "ProviderStatus", "",
		string(providerStatusFree), string(providerStatusOnJob), string(providerStatusOffline),
		string(providerStatusSuspended), string(providerStatusOffboarded))
}

// activeJobStage is where a live job has got to. It replaces the pre-composed stage line the
// roster used to receive.
type activeJobStage string

const (
	activeJobStageEnRoute    activeJobStage = "en_route"
	activeJobStageInProgress activeJobStage = "in_progress"
)

// Schema names the active-job stage vocabulary in the generated document.
func (activeJobStage) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "ActiveJobStage", "",
		string(activeJobStageEnRoute), string(activeJobStageInProgress))
}

type documentState string

const (
	documentStateVerified documentState = "verified"
	documentStateExpiring documentState = "expiring"
	documentStateExpired  documentState = "expired"
)

// Schema names the document-state vocabulary in the generated document.
func (documentState) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "DocumentState", "",
		string(documentStateVerified), string(documentStateExpiring), string(documentStateExpired))
}

// documentType is the fixed platform vocabulary of documents a provider files. The values are
// CODES: mapping a code to a word the operator reads is the console's job, not the server's.
type documentType string

const (
	documentTypeAadhaar               documentType = "AADHAAR"
	documentTypeAadhaarCard           documentType = "AADHAAR_CARD"
	documentTypePAN                   documentType = "PAN"
	documentTypeDrivingLicence        documentType = "DRIVING_LICENCE"
	documentTypeSkillCertificate      documentType = "SKILL_CERTIFICATE"
	documentTypeElectricalCertificate documentType = "ELECTRICAL_CERTIFICATE"
	documentTypePoliceVerification    documentType = "POLICE_VERIFICATION"
	documentTypeBankPassbook          documentType = "BANK_PASSBOOK"
	documentTypeBankDetails           documentType = "BANK_DETAILS"
)

// Schema names the document vocabulary in the generated document.
func (documentType) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "DocumentType",
		"A fixed platform vocabulary, as codes. The console owns the operator-facing wording.",
		string(documentTypeAadhaar), string(documentTypeAadhaarCard), string(documentTypePAN),
		string(documentTypeDrivingLicence), string(documentTypeSkillCertificate),
		string(documentTypeElectricalCertificate), string(documentTypePoliceVerification),
		string(documentTypeBankPassbook), string(documentTypeBankDetails))
}

type metricBand string

const (
	metricBandGood  metricBand = "good"
	metricBandWatch metricBand = "watch"
	metricBandPoor  metricBand = "poor"
)

// Schema names the metric-band vocabulary in the generated document.
func (metricBand) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "MetricBand", "Where a metric sits against its target.",
		string(metricBandGood), string(metricBandWatch), string(metricBandPoor))
}

type metricUnit string

const (
	metricUnitPercent metricUnit = "percent"
	metricUnitRating  metricUnit = "rating"
	metricUnitCount   metricUnit = "count"
)

// Schema names the metric-unit vocabulary in the generated document.
func (metricUnit) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "MetricUnit", "",
		string(metricUnitPercent), string(metricUnitRating), string(metricUnitCount))
}

type providerMetricID string

const (
	providerMetricIDCompletion   providerMetricID = "completion"
	providerMetricIDEscalation   providerMetricID = "escalation"
	providerMetricIDCancellation providerMetricID = "cancellation"
	providerMetricIDRating       providerMetricID = "rating"
	providerMetricIDOnTime       providerMetricID = "onTime"
	providerMetricIDJobs30       providerMetricID = "jobs30"
)

// Schema names the provider-metric vocabulary in the generated document.
func (providerMetricID) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "ProviderMetricId", "",
		string(providerMetricIDCompletion), string(providerMetricIDEscalation), string(providerMetricIDCancellation),
		string(providerMetricIDRating), string(providerMetricIDOnTime), string(providerMetricIDJobs30))
}

// providerFlagCode is what a behavioural flag on a profile MEANS. It replaces the pre-composed
// flag line ("2 late arrivals in 30 days"), which could only ever be English.
type providerFlagCode string

const (
	providerFlagCodeLateArrival       providerFlagCode = "late_arrival"
	providerFlagCodeCancellation      providerFlagCode = "cancellation"
	providerFlagCodeCustomerComplaint providerFlagCode = "customer_complaint"
	providerFlagCodeLowRating         providerFlagCode = "low_rating"
	providerFlagCodeNoShow            providerFlagCode = "no_show"
	providerFlagCodeDocumentExpiring  providerFlagCode = "document_expiring"
)

// Schema names the provider-flag vocabulary in the generated document.
func (providerFlagCode) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "ProviderFlagCode", "",
		string(providerFlagCodeLateArrival), string(providerFlagCodeCancellation),
		string(providerFlagCodeCustomerComplaint), string(providerFlagCodeLowRating),
		string(providerFlagCodeNoShow), string(providerFlagCodeDocumentExpiring))
}

type suspendReasonCode string

const (
	suspendReasonCodeSafetyComplaint       suspendReasonCode = "safety_complaint"
	suspendReasonCodeRepeatedCancellations suspendReasonCode = "repeated_cancellations"
	suspendReasonCodePoorQuality           suspendReasonCode = "poor_quality"
	suspendReasonCodeFraudSuspected        suspendReasonCode = "fraud_suspected"
	suspendReasonCodeDocumentExpired       suspendReasonCode = "document_expired"
	suspendReasonCodeUnprofessional        suspendReasonCode = "unprofessional"
	suspendReasonCodeNoShowPattern         suspendReasonCode = "no_show_pattern"
	suspendReasonCodePolicyViolation       suspendReasonCode = "policy_violation"
	suspendReasonCodeOther                 suspendReasonCode = "other"
)

// Schema names the suspension-reason vocabulary in the generated document.
func (suspendReasonCode) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "SuspendReasonCode", "",
		string(suspendReasonCodeSafetyComplaint), string(suspendReasonCodeRepeatedCancellations),
		string(suspendReasonCodePoorQuality), string(suspendReasonCodeFraudSuspected),
		string(suspendReasonCodeDocumentExpired), string(suspendReasonCodeUnprofessional),
		string(suspendReasonCodeNoShowPattern), string(suspendReasonCodePolicyViolation),
		string(suspendReasonCodeOther))
}

// suspendActionType — one payload serves all three outcomes; `type` decides which. force_offline
// is medium risk with a 30s undo, suspend high, block critical.
type suspendActionType string

const (
	suspendActionTypeForceOffline suspendActionType = "force_offline"
	suspendActionTypeSuspend      suspendActionType = "suspend"
	suspendActionTypeBlock        suspendActionType = "block"
)

// Schema names the suspend-action vocabulary in the generated document.
func (suspendActionType) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "SuspendActionType",
		"One payload serves all three outcomes; `type` decides which. force_offline is medium risk with a 30s undo, suspend high, block critical.",
		string(suspendActionTypeForceOffline), string(suspendActionTypeSuspend), string(suspendActionTypeBlock))
}

// jobResolution is how the operator chose to handle a job the suspension would strand.
type jobResolution string

const (
	jobResolutionReassign  jobResolution = "reassign"
	jobResolutionLetFinish jobResolution = "let_finish"
)

// Schema names the job-resolution vocabulary in the generated document.
func (jobResolution) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "JobResolution", "",
		string(jobResolutionReassign), string(jobResolutionLetFinish))
}

// ------------------------------------------------------------------ roster

// providerCurrentJob is the roster row's stage cell. It carries the STAGE and the ETA rather than
// a composed line, so the row reads the same in Hindi and Telugu.
type providerCurrentJob struct {
	BookingID  string         `json:"bookingId" required:"true"`
	EtaMinutes *int32         `json:"etaMinutes" required:"true" doc:"Null once the provider is on site."`
	Stage      activeJobStage `json:"stage" required:"true"`
}

type providerRosterRow struct {
	CompletionRate     float64             `json:"completionRate" required:"true" doc:"0–1. Coloured against the bands — the table's only coloured number."`
	CurrentJob         *providerCurrentJob `json:"currentJob,omitempty"`
	EarningsTodayPaise int64               `json:"earningsTodayPaise" required:"true"`
	ID                 string              `json:"id" required:"true"`
	JobsToday          int32               `json:"jobsToday" required:"true"`
	LastSeenAt         *time.Time          `json:"lastSeenAt" required:"true" doc:"Null means 'reporting right now'."`
	Name               string              `json:"name" required:"true"`
	Rating             float64             `json:"rating" required:"true"`
	Skills             []string            `json:"skills" required:"true" nullable:"false"`
	Status             providerStatus      `json:"status" required:"true"`
	SuspendedUntil     *time.Time          `json:"suspendedUntil,omitempty"`
	Zone               string              `json:"zone" required:"true"`
}

type rosterCounts struct {
	OnJob     int32 `json:"onJob" required:"true"`
	Online    int32 `json:"online" required:"true"`
	Suspended int32 `json:"suspended" required:"true"`
	Total     int32 `json:"total" required:"true"`
}

type zoneSupply struct {
	OnlineCount int32  `json:"onlineCount" required:"true"`
	Threshold   int32  `json:"threshold" required:"true"`
	Zone        string `json:"zone" required:"true"`
}

type providerRoster struct {
	Counts                rosterCounts         `json:"counts" required:"true"`
	NextCursor            *string              `json:"nextCursor"`
	OldestApplicationDays int32                `json:"oldestApplicationDays" required:"true"`
	PendingApplications   int32                `json:"pendingApplications" required:"true"`
	Rows                  []providerRosterRow  `json:"rows" required:"true" nullable:"false"`
	Shortfall             nullable[zoneSupply] `json:"shortfall" required:"true" doc:"The worst zone below threshold, or null when every zone is at or above it."`
	StatusesAsOf          time.Time            `json:"statusesAsOf" required:"true" doc:"When the live statuses were last confirmed — the offline state ages them."`
	Total                 int32                `json:"total,omitempty"`
}

type opsListProvidersInput struct {
	Segment rosterSegment `query:"segment" doc:"Defaults to online."`
	Search  string        `query:"search" doc:"Free-text search over name, phone and zone."`
	AdminPagination
}

type providerRosterOutput struct {
	Body providerRoster
}

func (handler *AdminHandler) listProviders(_ context.Context, _ *opsListProvidersInput) (*providerRosterOutput, error) {
	return nil, notImplemented("opsListProviders")
}

// ----------------------------------------------------------------- profile

type providerDocument struct {
	DaysToExpiry *int32        `json:"daysToExpiry,omitempty"`
	ExpiresAt    *time.Time    `json:"expiresAt,omitempty"`
	ID           string        `json:"id" required:"true"`
	State        documentState `json:"state" required:"true"`
	Type         documentType  `json:"type" required:"true"`
}

type providerFeedback struct {
	At      time.Time `json:"at" required:"true"`
	Author  string    `json:"author" required:"true"`
	Comment string    `json:"comment" required:"true"`
	ID      string    `json:"id" required:"true"`
	Rating  float64   `json:"rating" required:"true"`
}

// providerFlag is a behavioural flag as DATA: what it is, how often, over how long. The console
// writes "2 late arrivals in 30 days" from it, in the operator's language.
type providerFlag struct {
	Code       providerFlagCode `json:"code" required:"true"`
	Count      int32            `json:"count" required:"true"`
	WindowDays int32            `json:"windowDays" required:"true"`
}

type providerJob struct {
	AmountPaise int64     `json:"amountPaise" required:"true"`
	At          time.Time `json:"at" required:"true"`
	BookingID   string    `json:"bookingId" required:"true"`
	IsCancelled bool      `json:"isCancelled" required:"true"`
	Rating      *float64  `json:"rating" required:"true"`
	Service     string    `json:"service" required:"true"`
}

type providerMetric struct {
	Band  metricBand       `json:"band" required:"true"`
	ID    providerMetricID `json:"id" required:"true"`
	Trend []float64        `json:"trend" required:"true" nullable:"false" doc:"Eight points describing the 90-day trend."`
	Unit  metricUnit       `json:"unit" required:"true"`
	Value float64          `json:"value" required:"true" doc:"Percent metrics arrive as a fraction."`
}

type providerSkill struct {
	CertifiedTo *time.Time `json:"certifiedTo,omitempty"`
	IsPending   bool       `json:"isPending" required:"true"`
	Name        string     `json:"name" required:"true"`
}

type providerSuspension struct {
	ByName     string            `json:"byName" required:"true"`
	ReasonCode suspendReasonCode `json:"reasonCode" required:"true"`
	Until      time.Time         `json:"until" required:"true"`
}

type providerProfile struct {
	Documents          []providerDocument  `json:"documents" required:"true" nullable:"false"`
	EarningsTodayPaise int64               `json:"earningsTodayPaise" required:"true"`
	Feedback           []providerFeedback  `json:"feedback" required:"true" nullable:"false"`
	Flags              []providerFlag      `json:"flags" required:"true" nullable:"false"`
	ID                 string              `json:"id" required:"true"`
	IsVerified         bool                `json:"isVerified" required:"true"`
	JobsToday          int32               `json:"jobsToday" required:"true"`
	JobsTotal          int32               `json:"jobsTotal" required:"true"`
	JoinedAt           time.Time           `json:"joinedAt" required:"true"`
	Metrics            []providerMetric    `json:"metrics" required:"true" nullable:"false"`
	Name               string              `json:"name" required:"true"`
	OffboardedAt       *time.Time          `json:"offboardedAt,omitempty"`
	PayoutCyclePaise   int64               `json:"payoutCyclePaise" required:"true"`
	Phone              string              `json:"phone" required:"true"`
	Rating             float64             `json:"rating" required:"true"`
	RecentJobs         []providerJob       `json:"recentJobs" required:"true" nullable:"false"`
	Skills             []providerSkill     `json:"skills" required:"true" nullable:"false"`
	Status             providerStatus      `json:"status" required:"true"`
	Suspension         *providerSuspension `json:"suspension,omitempty"`
	Version            int32               `json:"version" required:"true"`
	Zone               string              `json:"zone" required:"true"`
	Zones              []string            `json:"zones" required:"true" nullable:"false"`
}

type opsProviderInput struct {
	ID string `path:"id" doc:"Provider id"`
}

type providerProfileOutput struct {
	Body providerProfile
}

func (handler *AdminHandler) getProvider(_ context.Context, _ *opsProviderInput) (*providerProfileOutput, error) {
	return nil, notImplemented("opsGetProvider")
}

// ------------------------------------------------------------- active jobs

type providerActiveJob struct {
	AmountPaise           int64          `json:"amountPaise" required:"true"`
	BookingID             string         `json:"bookingId" required:"true"`
	CustomerName          string         `json:"customerName" required:"true"`
	EtaMinutes            *int32         `json:"etaMinutes,omitempty"`
	Service               string         `json:"service" required:"true"`
	Stage                 activeJobStage `json:"stage" required:"true"`
	StartedAt             *time.Time     `json:"startedAt,omitempty"`
	SuggestedProviderName string         `json:"suggestedProviderName" required:"true" doc:"Who the server would hand this booking to, shown once the operator picks Reassign."`
	Zone                  string         `json:"zone" required:"true"`
}

// providerActiveJobs is step 3 of the suspend flow.
type providerActiveJobs struct {
	Items []providerActiveJob `json:"items" required:"true" nullable:"false"`
}

type providerActiveJobsOutput struct {
	Body providerActiveJobs
}

func (handler *AdminHandler) providerActiveJobs(_ context.Context, _ *opsProviderInput) (*providerActiveJobsOutput, error) {
	return nil, notImplemented("opsProviderActiveJobs")
}

// ------------------------------------------------- suspend, block, restore

type suspendProviderRequest struct {
	DurationDays      *int32                   `json:"durationDays" required:"true" doc:"Null for force_offline and block."`
	JobResolutions    map[string]jobResolution `json:"jobResolutions" required:"true" doc:"bookingId -> how the operator chose to handle it."`
	Note              string                   `json:"note" required:"true"`
	NotifyImmediately bool                     `json:"notifyImmediately" required:"true"`
	ReasonCode        suspendReasonCode        `json:"reasonCode" required:"true"`
	Type              suspendActionType        `json:"type" required:"true"`
	Version           int32                    `json:"version" required:"true"`
}

type suspendProviderResult struct {
	DurationDays   *int32            `json:"durationDays" required:"true"`
	EffectiveUntil *time.Time        `json:"effectiveUntil" required:"true"`
	ProviderID     string            `json:"providerId" required:"true"`
	Type           suspendActionType `json:"type" required:"true"`
	Version        int32             `json:"version,omitempty"`
}

type opsSuspendProviderInput struct {
	ID string `path:"id" doc:"Provider id"`
	AdminIdempotency
	Body suspendProviderRequest
}

type suspendProviderOutput struct {
	Body suspendProviderResult
}

func (handler *AdminHandler) suspendProvider(_ context.Context, _ *opsSuspendProviderInput) (*suspendProviderOutput, error) {
	return nil, notImplemented("opsSuspendProvider")
}

func (handler *AdminHandler) blockProvider(_ context.Context, _ *opsSuspendProviderInput) (*suspendProviderOutput, error) {
	return nil, notImplemented("opsBlockProvider")
}

func (handler *AdminHandler) forceProviderOffline(_ context.Context, _ *opsSuspendProviderInput) (*suspendProviderOutput, error) {
	return nil, notImplemented("opsForceProviderOffline")
}

// restoreProviderRequest reverses a suspension or a block; it is also the undo target inside the
// 10s window.
type restoreProviderRequest struct {
	Note    string `json:"note,omitempty"`
	Version int32  `json:"version" required:"true"`
}

type restoreProviderResult struct {
	ProviderID string         `json:"providerId" required:"true"`
	Status     providerStatus `json:"status" required:"true"`
	Version    int32          `json:"version" required:"true"`
}

type opsRestoreProviderInput struct {
	ID string `path:"id" doc:"Provider id"`
	AdminIdempotency
	Body restoreProviderRequest
}

type restoreProviderOutput struct {
	Body restoreProviderResult
}

func (handler *AdminHandler) restoreProvider(_ context.Context, _ *opsRestoreProviderInput) (*restoreProviderOutput, error) {
	return nil, notImplemented("opsRestoreProvider")
}
