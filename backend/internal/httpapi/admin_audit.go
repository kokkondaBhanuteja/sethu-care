package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

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

func (handler *AdminHandler) listAuditEntries(_ context.Context, _ *opsListAuditEntriesInput) (*auditPageOutput, error) {
	return nil, notImplemented("opsListAuditEntries")
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
