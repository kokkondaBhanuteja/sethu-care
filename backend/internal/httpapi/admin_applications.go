package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// The provider-application queue and its three decisions. Approval blockers are computed by the
// SERVER and mirrored next to the dead control; the console never decides on its own that an
// approval is allowed. Rejection has no undo — the applicant is notified by SMS immediately.

func (handler *AdminHandler) registerAdminApplications(api huma.API) {
	notFound := adminResponse{"404", "Not Found", adminError{}}
	decided := adminResponse{"409", "Another admin decided first", applicationDecidedError{}}

	huma.Register(api, huma.Operation{
		OperationID: "opsListApplications", Method: http.MethodGet, Path: "/ops/applications",
		Summary: "The provider-application queue", Tags: []string{"Ops Applications"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.listApplications)

	huma.Register(api, huma.Operation{
		OperationID: "opsGetApplication", Method: http.MethodGet, Path: "/ops/applications/{id}",
		Summary: "Application review, with documents and approval blockers", Tags: []string{"Ops Applications"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound),
	}, handler.getApplication)

	huma.Register(api, huma.Operation{
		OperationID: "opsApproveApplication", Method: http.MethodPost, Path: "/ops/applications/{id}/approve",
		Summary: "Approve an application", Tags: []string{"Ops Applications"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound, decided,
			adminResponse{"422", "Approval is blocked; see approvalBlockers on the review", adminError{}},
		),
	}, handler.approveApplication)

	huma.Register(api, huma.Operation{
		OperationID: "opsRejectApplication", Method: http.MethodPost, Path: "/ops/applications/{id}/reject",
		Summary: "Reject an application", Tags: []string{"Ops Applications"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound, decided,
			adminResponse{"422", "Validation — the note is shorter than 20 characters", adminError{}},
		),
	}, handler.rejectApplication)

	huma.Register(api, huma.Operation{
		OperationID: "opsRequestApplicationDocuments", Method: http.MethodPost, Path: "/ops/applications/{id}/request-documents",
		Summary: "Ask an applicant for more documents", Tags: []string{"Ops Applications"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound,
			adminResponse{"409", "Conflict — the record moved since it was read", staleVersionError{}},
		),
	}, handler.requestApplicationDocuments)
}

// ------------------------------------------------------------- vocabularies

type applicationSegment string

const (
	applicationSegmentPending      applicationSegment = "pending"
	applicationSegmentAwaitingDocs applicationSegment = "awaitingDocs"
	applicationSegmentDecided      applicationSegment = "decided"
)

// Schema names the application-segment vocabulary in the generated document.
func (applicationSegment) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "ApplicationSegment", "",
		string(applicationSegmentPending), string(applicationSegmentAwaitingDocs), string(applicationSegmentDecided))
}

type applicationStatus string

const (
	applicationStatusPending      applicationStatus = "pending"
	applicationStatusAwaitingDocs applicationStatus = "awaiting_docs"
	applicationStatusApproved     applicationStatus = "approved"
	applicationStatusRejected     applicationStatus = "rejected"
)

// Schema names the application-status vocabulary in the generated document.
func (applicationStatus) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "ApplicationStatus", "",
		string(applicationStatusPending), string(applicationStatusAwaitingDocs),
		string(applicationStatusApproved), string(applicationStatusRejected))
}

type applicationDecisionOutcome string

const (
	applicationDecisionOutcomeApproved applicationDecisionOutcome = "approved"
	applicationDecisionOutcomeRejected applicationDecisionOutcome = "rejected"
)

// Schema names the decision vocabulary in the generated document.
func (applicationDecisionOutcome) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "ApplicationDecisionOutcome", "",
		string(applicationDecisionOutcomeApproved), string(applicationDecisionOutcomeRejected))
}

type documentValidation string

const (
	documentValidationValidated documentValidation = "validated"
	documentValidationFailed    documentValidation = "failed"
	documentValidationMissing   documentValidation = "missing"
)

// Schema names the document-validation vocabulary in the generated document.
func (documentValidation) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "DocumentValidation", "",
		string(documentValidationValidated), string(documentValidationFailed), string(documentValidationMissing))
}

// autoCheckCode is WHICH automated check ran on a document. It is a code, not the console's i18n
// key: what the operator reads is the console's business.
type autoCheckCode string

const (
	autoCheckCodeExpiry autoCheckCode = "EXPIRY"
	autoCheckCodeBlur   autoCheckCode = "BLUR"
	autoCheckCodeOCR    autoCheckCode = "OCR"
)

// Schema names the automated-check vocabulary in the generated document.
func (autoCheckCode) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AutoCheckCode", "Which automated check ran, as a code.",
		string(autoCheckCodeExpiry), string(autoCheckCodeBlur), string(autoCheckCodeOCR))
}

// approvalBlockerCode is WHY approval is blocked, as a code the console words for the operator.
type approvalBlockerCode string

const (
	approvalBlockerCodePoliceVerificationPending approvalBlockerCode = "POLICE_VERIFICATION_PENDING"
	approvalBlockerCodeMissingDocument           approvalBlockerCode = "MISSING_DOCUMENT"
	approvalBlockerCodeExpiredDocument           approvalBlockerCode = "EXPIRED_DOCUMENT"
)

// Schema names the blocker vocabulary in the generated document.
func (approvalBlockerCode) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "ApprovalBlockerCode", "Why approval is blocked, as a code.",
		string(approvalBlockerCodePoliceVerificationPending), string(approvalBlockerCodeMissingDocument),
		string(approvalBlockerCodeExpiredDocument))
}

type rejectReasonCode string

const (
	rejectReasonCodeIncompleteDocumentation rejectReasonCode = "incomplete_documentation"
	rejectReasonCodeFailedBackgroundCheck   rejectReasonCode = "failed_background_check"
	rejectReasonCodeInsufficientExperience  rejectReasonCode = "insufficient_experience"
	rejectReasonCodeOutsideServiceArea      rejectReasonCode = "outside_service_area"
	rejectReasonCodeDuplicateApplication    rejectReasonCode = "duplicate_application"
	rejectReasonCodeAuthenticityConcern     rejectReasonCode = "authenticity_concern"
	rejectReasonCodeCapacityFull            rejectReasonCode = "capacity_full"
	rejectReasonCodeOther                   rejectReasonCode = "other"
)

// Schema names the rejection-reason vocabulary in the generated document.
func (rejectReasonCode) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "RejectReasonCode", "",
		string(rejectReasonCodeIncompleteDocumentation), string(rejectReasonCodeFailedBackgroundCheck),
		string(rejectReasonCodeInsufficientExperience), string(rejectReasonCodeOutsideServiceArea),
		string(rejectReasonCodeDuplicateApplication), string(rejectReasonCodeAuthenticityConcern),
		string(rejectReasonCodeCapacityFull), string(rejectReasonCodeOther))
}

// ------------------------------------------------------------------- queue

type applicationCounts struct {
	AwaitingDocs int32 `json:"awaitingDocs" required:"true"`
	Decided      int32 `json:"decided" required:"true"`
	Pending      int32 `json:"pending" required:"true"`
}

type applicationRow struct {
	ApplicantName        string            `json:"applicantName" required:"true"`
	AppliedAt            time.Time         `json:"appliedAt" required:"true"`
	AwaitingDocumentType *documentType     `json:"awaitingDocumentType,omitempty"`
	Categories           []string          `json:"categories" required:"true" nullable:"false"`
	DaysWaiting          *int32            `json:"daysWaiting" required:"true" doc:"Null once decided — the 48-hour clock stops with the decision."`
	DecidedAt            *time.Time        `json:"decidedAt,omitempty"`
	DocumentsPresent     int32             `json:"documentsPresent" required:"true"`
	DocumentsRequired    int32             `json:"documentsRequired" required:"true"`
	ID                   string            `json:"id" required:"true"`
	Status               applicationStatus `json:"status" required:"true"`
	Zone                 string            `json:"zone" required:"true"`
}

type applicationQueue struct {
	Counts     applicationCounts `json:"counts" required:"true"`
	NextCursor *string           `json:"nextCursor"`
	OldestDays int32             `json:"oldestDays" required:"true" doc:"Age of the oldest undecided application, against the 48-hour SLA."`
	Rows       []applicationRow  `json:"rows" required:"true" nullable:"false"`
	Total      int32             `json:"total,omitempty"`
}

type opsListApplicationsInput struct {
	Segment applicationSegment `query:"segment" doc:"Defaults to pending."`
	AdminPagination
}

type applicationQueueOutput struct {
	Body applicationQueue
}

func (handler *AdminHandler) listApplications(_ context.Context, _ *opsListApplicationsInput) (*applicationQueueOutput, error) {
	return nil, notImplemented("opsListApplications")
}

// ------------------------------------------------------------------ review

type applicationCategory struct {
	Name         string `json:"name" required:"true"`
	YearsClaimed int32  `json:"yearsClaimed" required:"true"`
}

type autoValidationCheck struct {
	Code   autoCheckCode `json:"code" required:"true"`
	Detail string        `json:"detail,omitempty"`
	ID     string        `json:"id" required:"true"`
	Passed bool          `json:"passed" required:"true"`
}

// approvalBlocker is a blocker the SERVER computed. The console mirrors it next to the dead
// control; it never decides on its own that approval is allowed.
type approvalBlocker struct {
	Code         approvalBlockerCode `json:"code" required:"true"`
	DocumentType *documentType       `json:"documentType,omitempty"`
	ID           string              `json:"id" required:"true"`
}

type applicationDocument struct {
	Detail         string             `json:"detail,omitempty" doc:"Account tail, certificate number — whatever the row shows instead of an expiry."`
	ExpiresAt      *time.Time         `json:"expiresAt,omitempty"`
	ID             string             `json:"id" required:"true"`
	OcrExpected    string             `json:"ocrExpected,omitempty"`
	OcrRead        string             `json:"ocrRead,omitempty" doc:"OCR verdict shown under a failed row."`
	PageHeading    string             `json:"pageHeading,omitempty"`
	PageLineWidths []float64          `json:"pageLineWidths,omitempty" nullable:"false" doc:"Placeholder geometry the desktop viewer draws with zero network."`
	PageNameLine   string             `json:"pageNameLine,omitempty"`
	SizeBytes      int64              `json:"sizeBytes,omitempty" doc:"The scan's size. The console formats it."`
	Type           documentType       `json:"type" required:"true"`
	UploadedAt     *time.Time         `json:"uploadedAt,omitempty"`
	URL            string             `json:"url,omitempty" doc:"The scan itself, for the document viewer."`
	Validation     documentValidation `json:"validation" required:"true"`
}

type applicationDecision struct {
	At      time.Time                  `json:"at" required:"true"`
	ByName  string                     `json:"byName" required:"true"`
	Outcome applicationDecisionOutcome `json:"outcome" required:"true"`
}

type applicationReview struct {
	Address             string                `json:"address" required:"true"`
	ApplicantName       string                `json:"applicantName" required:"true"`
	AppliedAt           time.Time             `json:"appliedAt" required:"true"`
	ApprovalBlockers    []approvalBlocker     `json:"approvalBlockers" required:"true" nullable:"false"`
	AutoValidation      []autoValidationCheck `json:"autoValidation" required:"true" nullable:"false"`
	BackgroundClearedAt *time.Time            `json:"backgroundClearedAt" required:"true"`
	Categories          []applicationCategory `json:"categories" required:"true" nullable:"false"`
	DaysWaiting         *int32                `json:"daysWaiting" required:"true"`
	Decision            *applicationDecision  `json:"decision,omitempty"`
	Documents           []applicationDocument `json:"documents" required:"true" nullable:"false"`
	DocumentsRequired   int32                 `json:"documentsRequired" required:"true"`
	Email               string                `json:"email" required:"true"`
	ID                  string                `json:"id" required:"true"`
	Phone               string                `json:"phone" required:"true"`
	PriorApplications   int32                 `json:"priorApplications" required:"true"`
	Version             int32                 `json:"version" required:"true"`
}

type opsApplicationPath struct {
	ID string `path:"id" doc:"Application id"`
}

type applicationReviewOutput struct {
	Body applicationReview
}

func (handler *AdminHandler) getApplication(_ context.Context, _ *opsApplicationPath) (*applicationReviewOutput, error) {
	return nil, notImplemented("opsGetApplication")
}

// ---------------------------------------------------------------- decisions

type approveApplicationRequest struct {
	Version int32 `json:"version" required:"true"`
}

// rejectApplicationRequest is critical risk. No undo: the applicant is notified by SMS
// immediately.
type rejectApplicationRequest struct {
	Note       string           `json:"note" required:"true" doc:"At least 20 characters — server-enforced."`
	ReasonCode rejectReasonCode `json:"reasonCode" required:"true"`
	Version    int32            `json:"version" required:"true"`
}

type applicationDecisionResult struct {
	ApplicantName string `json:"applicantName" required:"true"`
	ApplicationID string `json:"applicationId" required:"true"`
	Version       int32  `json:"version,omitempty"`
}

type applicationDecidedError struct {
	Code     string              `json:"code" required:"true" doc:"Always ALREADY_DECIDED."`
	Decision applicationDecision `json:"decision" required:"true" doc:"The decision, decider and timestamp, so the console can render the already-decided record."`
	Message  string              `json:"message" required:"true"`
}

type opsApproveApplicationInput struct {
	ID string `path:"id" doc:"Application id"`
	AdminIdempotency
	Body approveApplicationRequest
}

type applicationDecisionOutput struct {
	Body applicationDecisionResult
}

func (handler *AdminHandler) approveApplication(_ context.Context, _ *opsApproveApplicationInput) (*applicationDecisionOutput, error) {
	return nil, notImplemented("opsApproveApplication")
}

type opsRejectApplicationInput struct {
	ID string `path:"id" doc:"Application id"`
	AdminIdempotency
	Body rejectApplicationRequest
}

func (handler *AdminHandler) rejectApplication(_ context.Context, _ *opsRejectApplicationInput) (*applicationDecisionOutput, error) {
	return nil, notImplemented("opsRejectApplication")
}

type requestDocumentsRequest struct {
	DocumentTypes []documentType `json:"documentTypes" required:"true" nullable:"false"`
	Note          string         `json:"note,omitempty"`
	Version       int32          `json:"version" required:"true"`
}

type requestDocumentsResult struct {
	ApplicationID          string         `json:"applicationId" required:"true"`
	RequestedDocumentTypes []documentType `json:"requestedDocumentTypes" required:"true" nullable:"false"`
	SentAt                 time.Time      `json:"sentAt" required:"true"`
	Version                int32          `json:"version" required:"true"`
}

type opsRequestDocumentsInput struct {
	ID string `path:"id" doc:"Application id"`
	AdminIdempotency
	Body requestDocumentsRequest
}

type requestDocumentsOutput struct {
	Body requestDocumentsResult
}

func (handler *AdminHandler) requestApplicationDocuments(_ context.Context, _ *opsRequestDocumentsInput) (*requestDocumentsOutput, error) {
	return nil, notImplemented("opsRequestApplicationDocuments")
}
