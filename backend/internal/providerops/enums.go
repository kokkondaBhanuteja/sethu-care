package providerops

import "fmt"

// The persisted vocabularies of the provider-admin aggregates. Standing follows the repo's
// UPPER_SNAKE convention; every other value set is spelled EXACTLY as the frozen admin API
// contract spells it (lowercase statuses and reason codes, UPPER document codes), stored
// verbatim so no mapping layer can drift from the wire. Each one is pinned to its DB CHECK
// by internal/schema/drift_test.go.

// Standing is the admin-imposed standing of a provider. Absence of a provider_admin_states
// row means StandingActive at version 0.
type Standing string

const (
	StandingActive    Standing = "ACTIVE"
	StandingSuspended Standing = "SUSPENDED"
	StandingBlocked   Standing = "BLOCKED"
)

// AllStandings lists every standing, in declaration order; the drift test asserts this set
// equals the provider_admin_states.standing CHECK.
func AllStandings() []Standing {
	return []Standing{StandingActive, StandingSuspended, StandingBlocked}
}

func (standing Standing) Valid() bool {
	switch standing {
	case StandingActive, StandingSuspended, StandingBlocked:
		return true
	}
	return false
}

func (standing Standing) String() string { return string(standing) }

// ParseStanding validates a raw string read back from storage.
func ParseStanding(raw string) (Standing, error) {
	standing := Standing(raw)
	if !standing.Valid() {
		return "", fmt.Errorf("providerops: unknown standing %q", raw)
	}
	return standing, nil
}

// SuspendReason is why a provider was taken out of circulation — the frozen admin-contract
// codes, lowercase on purpose.
type SuspendReason string

const (
	SuspendReasonSafetyComplaint       SuspendReason = "safety_complaint"
	SuspendReasonRepeatedCancellations SuspendReason = "repeated_cancellations"
	SuspendReasonPoorQuality           SuspendReason = "poor_quality"
	SuspendReasonFraudSuspected        SuspendReason = "fraud_suspected"
	SuspendReasonDocumentExpired       SuspendReason = "document_expired"
	SuspendReasonUnprofessional        SuspendReason = "unprofessional"
	SuspendReasonNoShowPattern         SuspendReason = "no_show_pattern"
	SuspendReasonPolicyViolation       SuspendReason = "policy_violation"
	SuspendReasonOther                 SuspendReason = "other"
)

// AllSuspendReasons lists every reason; the drift test asserts this set equals the
// provider_admin_states.reason_code CHECK.
func AllSuspendReasons() []SuspendReason {
	return []SuspendReason{
		SuspendReasonSafetyComplaint, SuspendReasonRepeatedCancellations, SuspendReasonPoorQuality,
		SuspendReasonFraudSuspected, SuspendReasonDocumentExpired, SuspendReasonUnprofessional,
		SuspendReasonNoShowPattern, SuspendReasonPolicyViolation, SuspendReasonOther,
	}
}

func (reason SuspendReason) Valid() bool {
	switch reason {
	case SuspendReasonSafetyComplaint, SuspendReasonRepeatedCancellations, SuspendReasonPoorQuality,
		SuspendReasonFraudSuspected, SuspendReasonDocumentExpired, SuspendReasonUnprofessional,
		SuspendReasonNoShowPattern, SuspendReasonPolicyViolation, SuspendReasonOther:
		return true
	}
	return false
}

func (reason SuspendReason) String() string { return string(reason) }

// ParseSuspendReason validates a raw code at the API boundary.
func ParseSuspendReason(raw string) (SuspendReason, error) {
	reason := SuspendReason(raw)
	if !reason.Valid() {
		return "", fmt.Errorf("providerops: unknown suspend reason %q", raw)
	}
	return reason, nil
}

// ApplicationStatus is where an application sits in the pipeline. Terminal statuses
// (approved/rejected) are never left.
type ApplicationStatus string

const (
	ApplicationPending      ApplicationStatus = "pending"
	ApplicationAwaitingDocs ApplicationStatus = "awaiting_docs"
	ApplicationApproved     ApplicationStatus = "approved"
	ApplicationRejected     ApplicationStatus = "rejected"
)

// AllApplicationStatuses lists every status; the drift test asserts this set equals the
// provider_applications.status CHECK.
func AllApplicationStatuses() []ApplicationStatus {
	return []ApplicationStatus{
		ApplicationPending, ApplicationAwaitingDocs, ApplicationApproved, ApplicationRejected,
	}
}

func (status ApplicationStatus) Valid() bool {
	switch status {
	case ApplicationPending, ApplicationAwaitingDocs, ApplicationApproved, ApplicationRejected:
		return true
	}
	return false
}

// Decided reports whether the status is terminal.
func (status ApplicationStatus) Decided() bool {
	return status == ApplicationApproved || status == ApplicationRejected
}

func (status ApplicationStatus) String() string { return string(status) }

// ParseApplicationStatus validates a raw string read back from storage.
func ParseApplicationStatus(raw string) (ApplicationStatus, error) {
	status := ApplicationStatus(raw)
	if !status.Valid() {
		return "", fmt.Errorf("providerops: unknown application status %q", raw)
	}
	return status, nil
}

// RejectReason is why an application was rejected — the frozen admin-contract codes.
type RejectReason string

const (
	RejectReasonIncompleteDocumentation RejectReason = "incomplete_documentation"
	RejectReasonFailedBackgroundCheck   RejectReason = "failed_background_check"
	RejectReasonInsufficientExperience  RejectReason = "insufficient_experience"
	RejectReasonOutsideServiceArea      RejectReason = "outside_service_area"
	RejectReasonDuplicateApplication    RejectReason = "duplicate_application"
	RejectReasonAuthenticityConcern     RejectReason = "authenticity_concern"
	RejectReasonCapacityFull            RejectReason = "capacity_full"
	RejectReasonOther                   RejectReason = "other"
)

// AllRejectReasons lists every reason; the drift test asserts this set equals the
// provider_applications.decision_reason_code CHECK.
func AllRejectReasons() []RejectReason {
	return []RejectReason{
		RejectReasonIncompleteDocumentation, RejectReasonFailedBackgroundCheck,
		RejectReasonInsufficientExperience, RejectReasonOutsideServiceArea,
		RejectReasonDuplicateApplication, RejectReasonAuthenticityConcern,
		RejectReasonCapacityFull, RejectReasonOther,
	}
}

func (reason RejectReason) Valid() bool {
	switch reason {
	case RejectReasonIncompleteDocumentation, RejectReasonFailedBackgroundCheck,
		RejectReasonInsufficientExperience, RejectReasonOutsideServiceArea,
		RejectReasonDuplicateApplication, RejectReasonAuthenticityConcern,
		RejectReasonCapacityFull, RejectReasonOther:
		return true
	}
	return false
}

func (reason RejectReason) String() string { return string(reason) }

// ParseRejectReason validates a raw code at the API boundary.
func ParseRejectReason(raw string) (RejectReason, error) {
	reason := RejectReason(raw)
	if !reason.Valid() {
		return "", fmt.Errorf("providerops: unknown reject reason %q", raw)
	}
	return reason, nil
}

// DocumentType is the fixed platform vocabulary of documents a provider files — the
// contract's CODES, stored verbatim.
type DocumentType string

const (
	DocumentAadhaar               DocumentType = "AADHAAR"
	DocumentAadhaarCard           DocumentType = "AADHAAR_CARD"
	DocumentPAN                   DocumentType = "PAN"
	DocumentDrivingLicence        DocumentType = "DRIVING_LICENCE"
	DocumentSkillCertificate      DocumentType = "SKILL_CERTIFICATE"
	DocumentElectricalCertificate DocumentType = "ELECTRICAL_CERTIFICATE"
	DocumentPoliceVerification    DocumentType = "POLICE_VERIFICATION"
	DocumentBankPassbook          DocumentType = "BANK_PASSBOOK"
	DocumentBankDetails           DocumentType = "BANK_DETAILS"
)

// AllDocumentTypes lists every document type; the drift test asserts this set equals the
// provider_application_documents.document_type CHECK.
func AllDocumentTypes() []DocumentType {
	return []DocumentType{
		DocumentAadhaar, DocumentAadhaarCard, DocumentPAN, DocumentDrivingLicence,
		DocumentSkillCertificate, DocumentElectricalCertificate, DocumentPoliceVerification,
		DocumentBankPassbook, DocumentBankDetails,
	}
}

func (documentType DocumentType) Valid() bool {
	switch documentType {
	case DocumentAadhaar, DocumentAadhaarCard, DocumentPAN, DocumentDrivingLicence,
		DocumentSkillCertificate, DocumentElectricalCertificate, DocumentPoliceVerification,
		DocumentBankPassbook, DocumentBankDetails:
		return true
	}
	return false
}

func (documentType DocumentType) String() string { return string(documentType) }

// ParseDocumentType validates a raw code at the API boundary.
func ParseDocumentType(raw string) (DocumentType, error) {
	documentType := DocumentType(raw)
	if !documentType.Valid() {
		return "", fmt.Errorf("providerops: unknown document type %q", raw)
	}
	return documentType, nil
}

// DocumentValidation is what the automated checks concluded about a filed document (or
// 'missing' when it was requested but never filed).
type DocumentValidation string

const (
	DocumentValidated DocumentValidation = "validated"
	DocumentFailed    DocumentValidation = "failed"
	DocumentMissing   DocumentValidation = "missing"
)

// AllDocumentValidations lists every validation state; the drift test asserts this set
// equals the provider_application_documents.validation CHECK.
func AllDocumentValidations() []DocumentValidation {
	return []DocumentValidation{DocumentValidated, DocumentFailed, DocumentMissing}
}

func (validation DocumentValidation) Valid() bool {
	switch validation {
	case DocumentValidated, DocumentFailed, DocumentMissing:
		return true
	}
	return false
}

func (validation DocumentValidation) String() string { return string(validation) }

// ParseDocumentValidation validates a raw string read back from storage.
func ParseDocumentValidation(raw string) (DocumentValidation, error) {
	validation := DocumentValidation(raw)
	if !validation.Valid() {
		return "", fmt.Errorf("providerops: unknown document validation %q", raw)
	}
	return validation, nil
}

// ---------------------------------------------------------------------------
// Derived (non-persisted) vocabularies: computed by reads, never stored, so they carry no
// DB CHECK or drift entry. Their values are the admin contract's wire codes.

// ProviderStatus is the roster's derived dispatchability of a provider.
type ProviderStatus string

const (
	ProviderFree       ProviderStatus = "free"
	ProviderOnJob      ProviderStatus = "on_job"
	ProviderOffline    ProviderStatus = "offline"
	ProviderSuspended  ProviderStatus = "suspended"
	ProviderOffboarded ProviderStatus = "offboarded"
)

func (status ProviderStatus) String() string { return string(status) }

// JobStage is where a live job has got to, in the console's two-word vocabulary.
type JobStage string

const (
	JobStageEnRoute    JobStage = "en_route"
	JobStageInProgress JobStage = "in_progress"
)

func (stage JobStage) String() string { return string(stage) }

// JobResolution is how the operator chose to handle a job a suspension would strand.
type JobResolution string

const (
	JobResolutionReassign  JobResolution = "reassign"
	JobResolutionLetFinish JobResolution = "let_finish"
)

func (resolution JobResolution) Valid() bool {
	switch resolution {
	case JobResolutionReassign, JobResolutionLetFinish:
		return true
	}
	return false
}

func (resolution JobResolution) String() string { return string(resolution) }

// ParseJobResolution validates a raw value at the API boundary.
func ParseJobResolution(raw string) (JobResolution, error) {
	resolution := JobResolution(raw)
	if !resolution.Valid() {
		return "", fmt.Errorf("providerops: unknown job resolution %q", raw)
	}
	return resolution, nil
}

// BlockerCode is why an approval is blocked, as the contract's codes.
type BlockerCode string

const (
	BlockerPoliceVerificationPending BlockerCode = "POLICE_VERIFICATION_PENDING"
	BlockerMissingDocument           BlockerCode = "MISSING_DOCUMENT"
	BlockerExpiredDocument           BlockerCode = "EXPIRED_DOCUMENT"
)

// AutoCheckCode is which automated check ran on a document.
type AutoCheckCode string

const (
	AutoCheckExpiry AutoCheckCode = "EXPIRY"
	AutoCheckOCR    AutoCheckCode = "OCR"
)
