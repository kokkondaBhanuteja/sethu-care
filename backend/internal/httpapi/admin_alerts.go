package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// The alert feed and one alert's detail. Only the CRITICAL tier claims ownership by requiring an
// acknowledgement; everything else is a notification, which is what keeps the badge meaningful.

func (handler *AdminHandler) registerAdminAlerts(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "opsListAlerts", Method: http.MethodGet, Path: "/ops/alerts",
		Summary: "The alert feed", Tags: []string{"Ops Alerts"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.listAlerts)

	huma.Register(api, huma.Operation{
		OperationID: "opsReadAllAlerts", Method: http.MethodPost, Path: "/ops/alerts/read-all",
		Summary: "Mark the informational tier read", Tags: []string{"Ops Alerts"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.readAllAlerts)

	huma.Register(api, huma.Operation{
		OperationID: "opsGetAlert", Method: http.MethodGet, Path: "/ops/alerts/{id}",
		Summary: "Alert detail", Tags: []string{"Ops Alerts"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"404", "Not Found — /alerts/:id is a push-notification target and renders NotFoundState", adminError{}},
		),
	}, handler.getAlert)

	huma.Register(api, huma.Operation{
		OperationID: "opsAcknowledgeAlert", Method: http.MethodPost, Path: "/ops/alerts/{id}/acknowledge",
		Summary: "Acknowledge an alert", Tags: []string{"Ops Alerts"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"200", "OK — first writer wins; a later writer still gets 200 with the winning acknowledgement", acknowledgeAlertResult{}},
			adminResponse{"404", "Not Found", adminError{}},
		),
	}, handler.acknowledgeAlert)

	huma.Register(api, huma.Operation{
		OperationID: "opsCreateAlertNote", Method: http.MethodPost, Path: "/ops/alerts/{id}/notes",
		Summary: "Add a handover note to an alert", Tags: []string{"Ops Alerts"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		DefaultStatus: http.StatusCreated,
		Responses: adminResponses(api,
			adminResponse{"404", "Not Found", adminError{}},
		),
	}, handler.createAlertNote)
}

// ------------------------------------------------------------- vocabularies

// alertSeverity is three values, not the spec's five labels: the design only ever draws three
// visual tiers, and High and Medium triggers both land on `warning`.
type alertSeverity string

const (
	alertSeverityCritical      alertSeverity = "critical"
	alertSeverityWarning       alertSeverity = "warning"
	alertSeverityInformational alertSeverity = "informational"
)

// Schema names the severity vocabulary in the generated document.
func (alertSeverity) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AlertSeverity",
		"Three values, not five labels: the design only ever draws three visual tiers. High and Medium triggers both land on `warning`.",
		string(alertSeverityCritical), string(alertSeverityWarning), string(alertSeverityInformational))
}

type alertType string

const (
	alertTypeBookingEscalated      alertType = "bookingEscalated"
	alertTypeAssignmentFailed      alertType = "assignmentFailed"
	alertTypeSLAAtRisk             alertType = "slaAtRisk"
	alertTypeSLABreached           alertType = "slaBreached"
	alertTypeNewApplication        alertType = "newApplication"
	alertTypeProviderAutoSuspended alertType = "providerAutoSuspended"
	alertTypeLowRating             alertType = "lowRating"
	alertTypePaymentFailed         alertType = "paymentFailed"
	alertTypeDailySummary          alertType = "dailySummary"
)

// Schema names the alert-type vocabulary in the generated document.
func (alertType) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AlertType", "",
		string(alertTypeBookingEscalated), string(alertTypeAssignmentFailed), string(alertTypeSLAAtRisk),
		string(alertTypeSLABreached), string(alertTypeNewApplication), string(alertTypeProviderAutoSuspended),
		string(alertTypeLowRating), string(alertTypePaymentFailed), string(alertTypeDailySummary))
}

type alertSubjectKind string

const (
	alertSubjectKindBooking  alertSubjectKind = "booking"
	alertSubjectKindProvider alertSubjectKind = "provider"
)

// Schema names the alert-subject vocabulary in the generated document.
func (alertSubjectKind) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AlertSubjectKind", "",
		string(alertSubjectKindBooking), string(alertSubjectKindProvider))
}

type alertHistoryTone string

const (
	alertHistoryToneInfo    alertHistoryTone = "info"
	alertHistoryToneDanger  alertHistoryTone = "danger"
	alertHistoryToneNeutral alertHistoryTone = "neutral"
)

// Schema names the history-tone vocabulary in the generated document.
func (alertHistoryTone) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AlertHistoryTone", "",
		string(alertHistoryToneInfo), string(alertHistoryToneDanger), string(alertHistoryToneNeutral))
}

// ------------------------------------------------------------------- alert

type alertSubject struct {
	ID        string           `json:"id" required:"true"`
	Kind      alertSubjectKind `json:"kind" required:"true"`
	Reference string           `json:"reference" required:"true" doc:"The human reference the design prints in mono, e.g. #B-8823."`
}

// alertTitleParams are the interpolation values for the alert's headline. The type supplies the
// sentence and the server supplies the nouns, so 'New application — Ajay Verma' translates
// without the server knowing a word of Telugu.
type alertTitleParams struct {
	_         struct{} `json:"-" additionalProperties:"true"`
	Date      string   `json:"date,omitempty"`
	Name      string   `json:"name,omitempty"`
	Rating    string   `json:"rating,omitempty"`
	Reference string   `json:"reference,omitempty"`
}

// alertSummaryParams are the interpolation values for the alert's SUPPORTING line — the ids,
// services and zones the client cannot assemble on its own. They travel as values rather than as
// a composed English sentence for the same reason titleParams do.
type alertSummaryParams struct {
	_         struct{} `json:"-" additionalProperties:"true"`
	Reference string   `json:"reference,omitempty"`
	Service   string   `json:"service,omitempty"`
	Zone      string   `json:"zone,omitempty"`
}

type alertAcknowledgement struct {
	AcknowledgedAt time.Time `json:"acknowledgedAt" required:"true"`
	AdminID        string    `json:"adminId" required:"true"`
	AdminName      string    `json:"adminName" required:"true"`
}

// Alert is one row of the feed. Exported because alertDetail embeds it — Go's embedding, and
// therefore huma's schema walk, only sees exported fields.
type Alert struct {
	Acknowledgement         nullable[alertAcknowledgement] `json:"acknowledgement" required:"true"`
	CreatedAt               time.Time                      `json:"createdAt" required:"true"`
	ID                      string                         `json:"id" required:"true"`
	RequiresAcknowledgement bool                           `json:"requiresAcknowledgement" required:"true" doc:"Only the critical tier claims ownership. Everything else is a notification."`
	Severity                alertSeverity                  `json:"severity" required:"true"`
	Subject                 nullable[alertSubject]         `json:"subject" required:"true"`
	SummaryParams           alertSummaryParams             `json:"summaryParams" required:"true" doc:"Values for the supporting line, composed by the console."`
	TitleParams             alertTitleParams               `json:"titleParams" required:"true"`
	Type                    alertType                      `json:"type" required:"true"`
}

type alertsPage struct {
	Items      []Alert `json:"items" required:"true" nullable:"false"`
	NextCursor *string `json:"nextCursor"`
	Total      int32   `json:"total" required:"true"`
}

type opsListAlertsInput struct {
	Severity     alertSeverity `query:"severity" doc:"Omitted returns every tier."`
	Acknowledged bool          `query:"acknowledged" doc:"Filter by acknowledgement state."`
	AdminPagination
}

type alertsPageOutput struct {
	Body alertsPage
}

func (handler *AdminHandler) listAlerts(_ context.Context, _ *opsListAlertsInput) (*alertsPageOutput, error) {
	return nil, notImplemented("opsListAlerts")
}

// ------------------------------------------------------------ alert detail

type alertHistoryEntry struct {
	At   time.Time        `json:"at" required:"true"`
	Body string           `json:"body" required:"true"`
	ID   string           `json:"id" required:"true"`
	Tone alertHistoryTone `json:"tone" required:"true"`
}

// alertNote is the handover record between admins on one alert.
type alertNote struct {
	AuthorName string    `json:"authorName" required:"true"`
	Body       string    `json:"body" required:"true"`
	CreatedAt  time.Time `json:"createdAt" required:"true"`
	ID         string    `json:"id" required:"true"`
}

// alertTrigger is the rule audit: what fired, what the line was, and what the reading actually was.
type alertTrigger struct {
	Actual    string `json:"actual" required:"true"`
	Rule      string `json:"rule" required:"true"`
	Threshold string `json:"threshold" required:"true"`
}

type relatedAlertLink struct {
	CreatedAt   time.Time        `json:"createdAt" required:"true"`
	ID          string           `json:"id" required:"true"`
	Severity    alertSeverity    `json:"severity" required:"true"`
	TitleParams alertTitleParams `json:"titleParams" required:"true"`
	Type        alertType        `json:"type" required:"true"`
}

// relatedRecord is the booking or provider the alert points at. Its status travels as the
// record's own state enum rather than as a label plus a colour name: the console already maps
// every booking state and provider status to a word and a tone, and it must do so in the
// operator's language.
type relatedRecord struct {
	AmountPaise    *int64                   `json:"amountPaise" required:"true"`
	BookingState   nullable[bookingState]   `json:"bookingState" required:"true" doc:"Set when kind is booking."`
	CreatedAt      time.Time                `json:"createdAt" required:"true"`
	ID             string                   `json:"id" required:"true"`
	Kind           alertSubjectKind         `json:"kind" required:"true"`
	ProviderStatus nullable[providerStatus] `json:"providerStatus" required:"true" doc:"Set when kind is provider."`
	Reference      string                   `json:"reference" required:"true"`
	Subtitle       string                   `json:"subtitle" required:"true"`
	Title          string                   `json:"title" required:"true"`
}

type alertDetail struct {
	Alert
	CanMute       bool                    `json:"canMute" required:"true" doc:"Critical types cannot be muted, and the ceiling is shown up front."`
	Description   string                  `json:"description" required:"true"`
	History       []alertHistoryEntry     `json:"history" required:"true" nullable:"false"`
	Notes         []alertNote             `json:"notes" required:"true" nullable:"false"`
	RelatedAlerts []relatedAlertLink      `json:"relatedAlerts" required:"true" nullable:"false"`
	RelatedRecord nullable[relatedRecord] `json:"relatedRecord" required:"true"`
	Trigger       alertTrigger            `json:"trigger" required:"true"`
}

type opsGetAlertInput struct {
	ID string `path:"id" doc:"Alert id"`
}

type alertDetailOutput struct {
	Body alertDetail
}

func (handler *AdminHandler) getAlert(_ context.Context, _ *opsGetAlertInput) (*alertDetailOutput, error) {
	return nil, notImplemented("opsGetAlert")
}

// ------------------------------------------------------------ acknowledging

// acknowledgeAlertResult is idempotent and concurrency-safe. A replay of an acknowledgement this
// admin already won must also succeed, because acknowledgements are replayed after an offline
// period.
type acknowledgeAlertResult struct {
	Alert   Alert `json:"alert" required:"true"`
	WonRace bool  `json:"wonRace" required:"true" doc:"False when another admin acknowledged first. Not an error: the console shows 'acknowledged by someone else' rather than a failure toast."`
}

type opsAcknowledgeAlertInput struct {
	ID string `path:"id" doc:"Alert id"`
	AdminIdempotency
}

type acknowledgeAlertOutput struct {
	Body acknowledgeAlertResult
}

func (handler *AdminHandler) acknowledgeAlert(_ context.Context, _ *opsAcknowledgeAlertInput) (*acknowledgeAlertOutput, error) {
	return nil, notImplemented("opsAcknowledgeAlert")
}

// readAllAlertsResult marks the INFORMATIONAL tier only. It must never bulk-acknowledge a
// critical alert — that would defeat the badge-discipline mechanism.
type readAllAlertsResult struct {
	MarkedRead int32 `json:"markedRead" required:"true"`
}

type opsReadAllAlertsInput struct {
	AdminIdempotency
}

type readAllAlertsOutput struct {
	Body readAllAlertsResult
}

func (handler *AdminHandler) readAllAlerts(_ context.Context, _ *opsReadAllAlertsInput) (*readAllAlertsOutput, error) {
	return nil, notImplemented("opsReadAllAlerts")
}

type createAlertNoteRequest struct {
	Body string `json:"body" required:"true"`
}

type opsCreateAlertNoteInput struct {
	ID string `path:"id" doc:"Alert id"`
	AdminIdempotency
	Body createAlertNoteRequest
}

type alertNoteOutput struct {
	Body alertNote
}

func (handler *AdminHandler) createAlertNote(_ context.Context, _ *opsCreateAlertNoteInput) (*alertNoteOutput, error) {
	return nil, notImplemented("opsCreateAlertNote")
}
