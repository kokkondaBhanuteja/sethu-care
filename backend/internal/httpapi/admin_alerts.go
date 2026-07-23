package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/alert"
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

func (handler *AdminHandler) listAlerts(ctx context.Context, input *opsListAlertsInput) (*alertsPageOutput, error) {
	filter := alert.Filter{Limit: input.Limit, Cursor: input.Cursor}
	if input.Severity != "" {
		severity, err := domainSeverityOf(input.Severity)
		if err != nil {
			return nil, toHumaError(handler.log, err)
		}
		filter.Severity = &severity
	}
	// CONTRACT QUIRK, decided here: `acknowledged` is a plain boolean, so an omitted flag and
	// an explicit false are the same request. False/omitted returns the WHOLE feed (which is
	// what the console fetches — it splits tiers client-side); only acknowledged=true narrows.
	if input.Acknowledged {
		acknowledged := true
		filter.Acknowledged = &acknowledged
	}

	page, err := handler.alerts.List(ctx, filter)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	body := alertsPage{Items: make([]Alert, len(page.Alerts)), Total: page.Total}
	for index, listed := range page.Alerts {
		body.Items[index] = toAlertDTO(listed)
	}
	if page.NextCursor != "" {
		nextCursor := page.NextCursor
		body.NextCursor = &nextCursor
	}
	return &alertsPageOutput{Body: body}, nil
}

// ------------------------------------------------------- vocabulary mapping

// wireAlertTypeOf maps the persisted UPPER_SNAKE kind to the contract's camelCase type.
func wireAlertTypeOf(kind alert.Kind) alertType {
	switch kind {
	case alert.KindBookingEscalated:
		return alertTypeBookingEscalated
	case alert.KindAssignmentFailed:
		return alertTypeAssignmentFailed
	case alert.KindSLAAtRisk:
		return alertTypeSLAAtRisk
	case alert.KindSLABreached:
		return alertTypeSLABreached
	case alert.KindNewApplication:
		return alertTypeNewApplication
	case alert.KindProviderAutoSuspended:
		return alertTypeProviderAutoSuspended
	case alert.KindLowRating:
		return alertTypeLowRating
	case alert.KindPaymentFailed:
		return alertTypePaymentFailed
	case alert.KindDailySummary:
		return alertTypeDailySummary
	}
	return alertTypeDailySummary // unreachable: the domain vocabulary is closed
}

func wireSeverityOf(severity alert.Severity) alertSeverity {
	switch severity {
	case alert.SeverityCritical:
		return alertSeverityCritical
	case alert.SeverityWarning:
		return alertSeverityWarning
	case alert.SeverityInformational:
		return alertSeverityInformational
	}
	return alertSeverityInformational // unreachable: the domain vocabulary is closed
}

func domainSeverityOf(severity alertSeverity) (alert.Severity, error) {
	switch severity {
	case alertSeverityCritical:
		return alert.SeverityCritical, nil
	case alertSeverityWarning:
		return alert.SeverityWarning, nil
	case alertSeverityInformational:
		return alert.SeverityInformational, nil
	}
	return "", &badRequestError{msg: "unknown severity"}
}

// alertSubjectReference derives the operator-facing reference for an alert subject. Bookings
// reuse the console-wide #B- projection; providers get the parallel #P- one.
func alertSubjectReference(kind alert.SubjectKind, subjectID uuid.UUID) string {
	if kind == alert.SubjectProvider {
		return "#P-" + adminBookingReference(subjectID)[3:]
	}
	return adminBookingReference(subjectID)
}

// toAlertDTO shapes one feed row for the wire. Interpolation params carry only the nouns the
// row can truthfully name — a missing service or zone is an absent key, never a guess.
func toAlertDTO(listed alert.ListedAlert) Alert {
	dto := Alert{
		CreatedAt:               listed.CreatedAt,
		ID:                      listed.ID.String(),
		RequiresAcknowledgement: listed.RequiresAcknowledgement,
		Severity:                wireSeverityOf(listed.Severity),
		Type:                    wireAlertTypeOf(listed.Kind),
	}
	if listed.Acknowledgement != nil {
		dto.Acknowledgement = nullable[alertAcknowledgement]{Value: &alertAcknowledgement{
			AcknowledgedAt: listed.Acknowledgement.At,
			AdminID:        listed.Acknowledgement.AdminID.String(),
			AdminName:      listed.Acknowledgement.AdminName,
		}}
	}
	if listed.SubjectKind != nil && listed.SubjectID != nil {
		subjectKind := alertSubjectKindBooking
		if *listed.SubjectKind == alert.SubjectProvider {
			subjectKind = alertSubjectKindProvider
		}
		reference := alertSubjectReference(*listed.SubjectKind, *listed.SubjectID)
		dto.Subject = nullable[alertSubject]{Value: &alertSubject{
			ID:        listed.SubjectID.String(),
			Kind:      subjectKind,
			Reference: reference,
		}}
		dto.TitleParams.Reference = reference
		dto.SummaryParams.Reference = reference
	}
	dto.SummaryParams.Service = listed.ServiceName
	dto.SummaryParams.Zone = listed.City
	return dto
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

func (handler *AdminHandler) getAlert(ctx context.Context, input *opsGetAlertInput) (*alertDetailOutput, error) {
	alertID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	detail, err := handler.alerts.Get(ctx, alertID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &alertDetailOutput{Body: toAlertDetailDTO(detail)}, nil
}

// toAlertDetailDTO shapes one alert's full screen. The trigger cites the rule as the domain
// EVENT that fired and the actual reading as state codes — the one place the contract carries
// server-composed description text is the description line itself.
func toAlertDetailDTO(detail alert.Detail) alertDetail {
	dto := alertDetail{
		Alert: toAlertDTO(detail.ListedAlert),
		// Critical types cannot be muted, and the ceiling is shown up front.
		CanMute:       detail.Severity != alert.SeverityCritical,
		Description:   alertDescriptionOf(detail.Kind),
		History:       make([]alertHistoryEntry, len(detail.History)),
		Notes:         make([]alertNote, len(detail.Notes)),
		RelatedAlerts: make([]relatedAlertLink, len(detail.RelatedAlerts)),
		Trigger:       alertTriggerOf(detail),
	}
	for index, entry := range detail.History {
		dto.History[index] = alertHistoryEntry{
			At: entry.At,
			// State codes, not prose: "ESCALATE: SEARCHING → ESCALATED" reads in any locale.
			Body: entry.Action + ": " + entry.FromState + " → " + entry.ToState,
			ID:   entry.ID.String(),
			Tone: historyToneOf(entry.Action),
		}
	}
	for index, note := range detail.Notes {
		dto.Notes[index] = alertNote{
			AuthorName: note.AuthorName,
			Body:       note.Body,
			CreatedAt:  note.CreatedAt,
			ID:         note.ID.String(),
		}
	}
	for index, related := range detail.RelatedAlerts {
		link := relatedAlertLink{
			CreatedAt: related.CreatedAt,
			ID:        related.ID.String(),
			Severity:  wireSeverityOf(related.Severity),
			Type:      wireAlertTypeOf(related.Kind),
		}
		if detail.SubjectKind != nil && detail.SubjectID != nil {
			link.TitleParams.Reference = alertSubjectReference(*detail.SubjectKind, *detail.SubjectID)
		}
		dto.RelatedAlerts[index] = link
	}
	if detail.SubjectKind != nil && detail.SubjectID != nil && *detail.SubjectKind == alert.SubjectBooking && detail.BookingState != "" {
		amountPaise := detail.BookingAmount.Paise()
		state := bookingState(detail.BookingState)
		dto.RelatedRecord = nullable[relatedRecord]{Value: &relatedRecord{
			AmountPaise:  &amountPaise,
			BookingState: nullable[bookingState]{Value: &state},
			CreatedAt:    detail.BookingCreatedAt,
			ID:           detail.SubjectID.String(),
			Kind:         alertSubjectKindBooking,
			Reference:    adminBookingReference(*detail.SubjectID),
			Subtitle:     detail.CustomerName,
			Title:        detail.ServiceName,
		}}
	}
	return dto
}

// alertDescriptionOf is the detail's description line per kind. Only the kinds an engine
// produces today carry one; the rest fall back to naming the kind itself.
func alertDescriptionOf(kind alert.Kind) string {
	if kind == alert.KindBookingEscalated {
		return "Dispatch handed this booking to a human operator. It stays in the needs-action tier until an admin acknowledges ownership."
	}
	return kind.String()
}

// alertTriggerOf is the why-it-fired audit: the rule that fired, the line it holds, and the
// reading that crossed it — state codes and event names, stable across locales.
func alertTriggerOf(detail alert.Detail) alertTrigger {
	if detail.Kind == alert.KindBookingEscalated {
		actual := "→ ESCALATED"
		if detail.EscalatedFrom != "" {
			actual = detail.EscalatedFrom + " → ESCALATED"
		}
		return alertTrigger{
			Actual:    actual,
			Rule:      "booking.escalated",
			Threshold: "state = ESCALATED",
		}
	}
	return alertTrigger{Actual: "", Rule: detail.Kind.String(), Threshold: ""}
}

func historyToneOf(action string) alertHistoryTone {
	switch action {
	case "ESCALATE", "CANCEL", "FAIL":
		return alertHistoryToneDanger
	case "ASSIGN", "SEARCH", "RESUME", "CONFIRM", "DEPART", "ARRIVE",
		"VERIFY_START", "REQUEST_COMPLETION", "VERIFY_COMPLETION":
		return alertHistoryToneInfo
	}
	return alertHistoryToneNeutral
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

// acknowledgeAlert honours the Idempotency-Key header by construction: acknowledging is
// first-writer-wins in the database and a replay (any number of times, with or without the
// same key) returns the winning acknowledgement rather than acting twice, which is exactly
// the replay contract the header promises.
func (handler *AdminHandler) acknowledgeAlert(ctx context.Context, input *opsAcknowledgeAlertInput) (*acknowledgeAlertOutput, error) {
	admin, ok := userFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("authentication required")
	}
	alertID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	acknowledged, wonRace, err := handler.alerts.Acknowledge(ctx, alertID, admin.ID)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &acknowledgeAlertOutput{Body: acknowledgeAlertResult{
		Alert:   toAlertDTO(acknowledged),
		WonRace: wonRace,
	}}, nil
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

// readAllAlerts is naturally idempotent — a replay finds nothing left unread and honestly
// reports zero — which is how it honours the Idempotency-Key header.
func (handler *AdminHandler) readAllAlerts(ctx context.Context, _ *opsReadAllAlertsInput) (*readAllAlertsOutput, error) {
	marked, err := handler.alerts.ReadAll(ctx)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &readAllAlertsOutput{Body: readAllAlertsResult{MarkedRead: marked}}, nil
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

// createAlertNote honours the Idempotency-Key header with storage: the key is unique per
// (alert, author), so a replayed request returns the first attempt's note, never a second row.
func (handler *AdminHandler) createAlertNote(ctx context.Context, input *opsCreateAlertNoteInput) (*alertNoteOutput, error) {
	author, ok := userFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("authentication required")
	}
	alertID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	if input.Body.Body == "" {
		return nil, toHumaError(handler.log, &badRequestError{msg: "note body must not be empty"})
	}
	note, err := handler.alerts.AddNote(ctx, alertID, author.ID, input.IdempotencyKey, input.Body.Body)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &alertNoteOutput{Body: alertNote{
		AuthorName: note.AuthorName,
		Body:       note.Body,
		CreatedAt:  note.CreatedAt,
		ID:         note.ID.String(),
	}}, nil
}
