package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/audit"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// The append-only audit log. An entry is never modified: a correction is a NEW compensating entry
// that names the one it corrects, and the backend derives the link back.

func (handler *AdminHandler) registerAdminAudit(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "opsListAuditEntries", Method: http.MethodGet, Path: "/ops/audit",
		Summary: "The append-only audit log", Tags: []string{"Ops Audit"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.listAuditEntries)

	huma.Register(api, huma.Operation{
		OperationID: "opsListAuditAdmins", Method: http.MethodGet, Path: "/ops/audit/admins",
		Summary: "The distinct admins in the audit log, for the filter", Tags: []string{"Ops Audit"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.listAuditAdmins)

	huma.Register(api, huma.Operation{
		OperationID: "opsGetAuditEntry", Method: http.MethodGet, Path: "/ops/audit/{id}",
		Summary: "One audit entry, with before/after and the compensating link", Tags: []string{"Ops Audit"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"404", "Not Found — the entry screen is a deep-link target", adminError{}},
		),
	}, handler.getAuditEntry)
}

// ------------------------------------------------------------- vocabularies

// auditAction is the SCREAMING_SNAKE audit vocabulary, not the dotted permission-registry id.
// PAYMENT_REFUND_REVERSE is a compensating action and is itself audited.
type auditAction string

const (
	auditActionBookingAssign         auditAction = "BOOKING_ASSIGN"
	auditActionBookingRedispatch     auditAction = "BOOKING_REDISPATCH"
	auditActionBookingCancel         auditAction = "BOOKING_CANCEL"
	auditActionBookingManualComplete auditAction = "BOOKING_MANUAL_COMPLETE"
	auditActionPaymentRefund         auditAction = "PAYMENT_REFUND"
	auditActionPaymentRefundReverse  auditAction = "PAYMENT_REFUND_REVERSE"
	auditActionPaymentGoodwill       auditAction = "PAYMENT_GOODWILL"
	auditActionProviderSuspend       auditAction = "PROVIDER_SUSPEND"
	auditActionProviderBlock         auditAction = "PROVIDER_BLOCK"
	auditActionProviderForceOffline  auditAction = "PROVIDER_FORCE_OFFLINE"
	auditActionApplicationApprove    auditAction = "APPLICATION_APPROVE"
	auditActionApplicationReject     auditAction = "APPLICATION_REJECT"
	auditActionCustomerBlock         auditAction = "CUSTOMER_BLOCK"
	auditActionDeviceRevoke          auditAction = "DEVICE_REVOKE"
	auditActionAlertAcknowledge      auditAction = "ALERT_ACKNOWLEDGE"
	auditActionNoteAdd               auditAction = "NOTE_ADD"
)

// Schema names the audit-action vocabulary in the generated document.
func (auditAction) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AuditAction",
		"The SCREAMING_SNAKE audit vocabulary, not the dotted permission-registry id. PAYMENT_REFUND_REVERSE is a compensating action and is itself audited.",
		string(auditActionBookingAssign), string(auditActionBookingRedispatch), string(auditActionBookingCancel),
		string(auditActionBookingManualComplete), string(auditActionPaymentRefund), string(auditActionPaymentRefundReverse),
		string(auditActionPaymentGoodwill), string(auditActionProviderSuspend), string(auditActionProviderBlock),
		string(auditActionProviderForceOffline), string(auditActionApplicationApprove), string(auditActionApplicationReject),
		string(auditActionCustomerBlock), string(auditActionDeviceRevoke), string(auditActionAlertAcknowledge),
		string(auditActionNoteAdd))
}

type auditTargetType string

const (
	auditTargetTypeBooking     auditTargetType = "booking"
	auditTargetTypeProvider    auditTargetType = "provider"
	auditTargetTypeCustomer    auditTargetType = "customer"
	auditTargetTypeApplication auditTargetType = "application"
	auditTargetTypePayment     auditTargetType = "payment"
	auditTargetTypeDevice      auditTargetType = "device"
	auditTargetTypeAlert       auditTargetType = "alert"
)

// Schema names the audit-target vocabulary in the generated document.
func (auditTargetType) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AuditTargetType", "",
		string(auditTargetTypeBooking), string(auditTargetTypeProvider), string(auditTargetTypeCustomer),
		string(auditTargetTypeApplication), string(auditTargetTypePayment), string(auditTargetTypeDevice),
		string(auditTargetTypeAlert))
}

type auditSurface string

const (
	auditSurfaceMobile  auditSurface = "mobile"
	auditSurfaceDesktop auditSurface = "desktop"
)

// Schema names the audit-surface vocabulary in the generated document.
func (auditSurface) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AuditSurface", "",
		string(auditSurfaceMobile), string(auditSurfaceDesktop))
}

// riskLevel is the risk register's classification, carried on every audit entry.
type riskLevel string

const (
	riskLevelNone     riskLevel = "none"
	riskLevelLow      riskLevel = "low"
	riskLevelMedium   riskLevel = "medium"
	riskLevelHigh     riskLevel = "high"
	riskLevelCritical riskLevel = "critical"
)

// Schema names the risk vocabulary in the generated document.
func (riskLevel) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "RiskLevel", "The risk register's classification, carried on every audit entry.",
		string(riskLevelNone), string(riskLevelLow), string(riskLevelMedium),
		string(riskLevelHigh), string(riskLevelCritical))
}

// auditStateSnapshot maps a field name to the DISPLAY VALUE the operator was shown at the time.
//
// This is the one place the contract deliberately carries pre-formatted text ('₹1,499', 'Waiting
// Completion OTP'): an audit entry records what an operator was told, not a re-render of today's
// vocabulary, so re-localising it later would falsify the record.
type auditStateSnapshot map[string]string

// Schema names the snapshot shape in the generated document.
func (auditStateSnapshot) Schema(registry huma.Registry) *huma.Schema {
	return adminNamedSchema(registry, "AuditStateSnapshot", func() *huma.Schema {
		return &huma.Schema{
			Type:                 huma.TypeObject,
			Description:          "Field name -> display value. Values arrive display-ready ('₹1,499', 'Waiting Completion OTP') because the audit log records what an operator was told at the time, not a re-render of today's vocabulary.",
			AdditionalProperties: &huma.Schema{Type: huma.TypeString},
		}
	})
}

// ------------------------------------------------------------------ entries

type auditAdmin struct {
	Email string `json:"email" required:"true"`
	ID    string `json:"id" required:"true"`
	Name  string `json:"name" required:"true"`
}

// auditAdmins is derived server-side: the console must not page the whole ledger to build a filter.
type auditAdmins struct {
	Items []auditAdmin `json:"items" required:"true" nullable:"false"`
}

type auditContext struct {
	AppVersion          string       `json:"appVersion" required:"true"`
	ApproximateLocation string       `json:"approximateLocation" required:"true" doc:"City-level only, captured for mutations alone."`
	DeviceID            string       `json:"deviceId" required:"true"`
	DeviceName          string       `json:"deviceName" required:"true"`
	IPAddress           string       `json:"ipAddress" required:"true" doc:"Sensitive — detail view only, never the list."`
	OtaBundle           string       `json:"otaBundle" required:"true"`
	StepUpVerified      bool         `json:"stepUpVerified" required:"true"`
	Surface             auditSurface `json:"surface" required:"true"`
}

type auditEvidence struct {
	CallLogIDs []string `json:"callLogIds" required:"true" nullable:"false"`
	PhotoIDs   []string `json:"photoIds" required:"true" nullable:"false"`
	ReportIDs  []string `json:"reportIds" required:"true" nullable:"false"`
}

type auditReason struct {
	Code string `json:"code" required:"true"`
	Note string `json:"note" required:"true"`
}

type auditTarget struct {
	ID        string          `json:"id" required:"true" doc:"The record's primary key, e.g. bkg_8823."`
	Reference string          `json:"reference" required:"true" doc:"The human reference an operator recognises, e.g. #B-8823."`
	Type      auditTargetType `json:"type" required:"true"`
}

type auditEntry struct {
	Action               auditAction           `json:"action" required:"true"`
	Admin                auditAdmin            `json:"admin" required:"true"`
	After                auditStateSnapshot    `json:"after" required:"true"`
	Before               auditStateSnapshot    `json:"before" required:"true"`
	CompensatedByEntryID *string               `json:"compensatedByEntryId" required:"true" doc:"Set on the corrected entry. The original is NOT modified — the backend derives this link."`
	CompensatesEntryID   *string               `json:"compensatesEntryId" required:"true" doc:"Set on a compensating entry: the earlier entry this one corrects."`
	Context              auditContext          `json:"context" required:"true"`
	Evidence             auditEvidence         `json:"evidence" required:"true"`
	ID                   string                `json:"id" required:"true"`
	Immutable            bool                  `json:"immutable" required:"true" enum:"true" doc:"Always true. Present in the payload so the guarantee travels with the record."`
	Reason               nullable[auditReason] `json:"reason" required:"true" doc:"Null for actions the risk register does not require a reason for."`
	RiskLevel            riskLevel             `json:"riskLevel" required:"true"`
	Target               auditTarget           `json:"target" required:"true"`
	Timestamp            time.Time             `json:"timestamp" required:"true"`
}

type auditPage struct {
	Items      []auditEntry `json:"items" required:"true" nullable:"false"`
	NextCursor *string      `json:"nextCursor" required:"true"`
	RangeFrom  *time.Time   `json:"rangeFrom" required:"true" doc:"Oldest timestamp actually present, for the '4 entries · 20 Jul – 20 Jul' line."`
	RangeTo    *time.Time   `json:"rangeTo" required:"true"`
	Total      int32        `json:"total" required:"true"`
}

type opsListAuditEntriesInput struct {
	AdminID    string          `query:"adminId" doc:"Filter to one admin."`
	Action     auditAction     `query:"action" doc:"Filter to one audited action."`
	TargetType auditTargetType `query:"targetType" doc:"Filter to one kind of record."`
	TargetID   string          `query:"targetId" doc:"Filter to one record."`
	From       time.Time       `query:"from" doc:"Inclusive lower bound."`
	To         time.Time       `query:"to" doc:"Exclusive upper bound."`
	AdminPagination
}

type auditPageOutput struct {
	Body auditPage
}

// recordedActionOf maps the wire vocabulary to the action string the audit log actually
// records today: booking transitions driven by an admin. Wire actions nothing records yet
// (refunds, provider suspensions, …) map to nothing — a filter on them is honestly empty.
func recordedActionOf(action auditAction) (string, bool) {
	recorded, ok := map[auditAction]string{
		auditActionBookingAssign:         "ASSIGN",
		auditActionBookingRedispatch:     "SEARCH",
		auditActionBookingCancel:         "CANCEL",
		auditActionBookingManualComplete: "VERIFY_COMPLETION",
	}[action]
	return recorded, ok
}

// wireActionOf is the reverse of recordedActionOf, for rows coming back out.
func wireActionOf(recorded string) auditAction {
	action := map[string]auditAction{
		"ASSIGN":            auditActionBookingAssign,
		"SEARCH":            auditActionBookingRedispatch,
		"CANCEL":            auditActionBookingCancel,
		"VERIFY_COMPLETION": auditActionBookingManualComplete,
	}[recorded]
	return action
}

// auditRiskOf is the risk classification per audited action, mirroring the console's action
// registry: assignment and redispatch are medium-risk dispatch moves; cancelling and
// admin-asserted completion are high-risk (step-up + reason in the registry).
func auditRiskOf(action auditAction) riskLevel {
	risk, ok := map[auditAction]riskLevel{
		auditActionBookingAssign:         riskLevelMedium,
		auditActionBookingRedispatch:     riskLevelMedium,
		auditActionBookingCancel:         riskLevelHigh,
		auditActionBookingManualComplete: riskLevelHigh,
	}[action]
	if !ok {
		return riskLevelNone
	}
	return risk
}

func (handler *AdminHandler) listAuditEntries(ctx context.Context, input *opsListAuditEntriesInput) (*auditPageOutput, error) {
	emptyPage := &auditPageOutput{Body: auditPage{Items: []auditEntry{}, Total: 0}}

	// Only booking records carry audit entries today; a filter on any other target type (or
	// on a wire action nothing records yet) truthfully matches nothing.
	if input.TargetType != "" && input.TargetType != auditTargetTypeBooking {
		return emptyPage, nil
	}
	filter := audit.ListFilter{Limit: input.Limit, Cursor: input.Cursor}
	if input.Action != "" {
		recorded, known := recordedActionOf(input.Action)
		if !known {
			return emptyPage, nil
		}
		filter.Action = recorded
	}
	if input.AdminID != "" {
		adminID, err := parseUUID(input.AdminID, "adminId")
		if err != nil {
			return nil, toHumaError(handler.log, err)
		}
		filter.AdminID = &adminID
	}
	if input.TargetID != "" {
		targetID, err := parseUUID(input.TargetID, "targetId")
		if err != nil {
			return nil, toHumaError(handler.log, err)
		}
		filter.TargetID = &targetID
	}
	if !input.From.IsZero() {
		from := input.From
		filter.From = &from
	}
	if !input.To.IsZero() {
		to := input.To
		filter.To = &to
	}

	page, err := handler.audit.List(ctx, filter)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}

	body := auditPage{
		Items:     make([]auditEntry, len(page.Entries)),
		RangeFrom: page.RangeFrom,
		RangeTo:   page.RangeTo,
		Total:     page.Total,
	}
	for index, entry := range page.Entries {
		body.Items[index] = toAuditEntryDTO(entry)
	}
	if page.NextCursor != "" {
		nextCursor := page.NextCursor
		body.NextCursor = &nextCursor
	}
	return &auditPageOutput{Body: body}, nil
}

// toAuditEntryDTO shapes one recorded entry for the wire. Honesty notes:
//   - admin.email is empty — identity has no email; admins are phone-provisioned.
//   - context is zeroed (surface defaults to desktop): capture context (device, IP, OTA
//     bundle, step-up) is not recorded yet.
//   - evidence is empty and reason null: neither has storage yet.
//   - the compensating links are null: no compensating actions exist yet.
func toAuditEntryDTO(entry audit.ListedEntry) auditEntry {
	action := wireActionOf(entry.Action)
	return auditEntry{
		Action: action,
		Admin:  auditAdmin{Email: "", ID: entry.AdminID.String(), Name: entry.AdminName},
		After:  auditStateSnapshot(entry.After),
		Before: auditStateSnapshot(entry.Before),
		Context: auditContext{
			Surface: auditSurfaceDesktop,
		},
		Evidence: auditEvidence{
			CallLogIDs: []string{},
			PhotoIDs:   []string{},
			ReportIDs:  []string{},
		},
		ID:        entry.ID.String(),
		Immutable: true,
		RiskLevel: auditRiskOf(action),
		Target: auditTarget{
			ID:        entry.EntityID.String(),
			Reference: adminBookingReference(entry.EntityID),
			Type:      auditTargetTypeBooking,
		},
		Timestamp: entry.At,
	}
}

type auditAdminsOutput struct {
	Body auditAdmins
}

func (handler *AdminHandler) listAuditAdmins(_ context.Context, _ *struct{}) (*auditAdminsOutput, error) {
	return nil, notImplemented("opsListAuditAdmins")
}

type opsGetAuditEntryInput struct {
	ID string `path:"id" doc:"Audit entry id"`
}

type auditEntryOutput struct {
	Body auditEntry
}

func (handler *AdminHandler) getAuditEntry(_ context.Context, _ *opsGetAuditEntryInput) (*auditEntryOutput, error) {
	return nil, notImplemented("opsGetAuditEntry")
}
