package alert

import "fmt"

// The alert vocabularies, persisted as TEXT + CHECK on the alerts table and pinned to those
// CHECKs by internal/schema/drift_test.go. Values are UPPER_SNAKE per the repo's enum policy;
// the admin wire's camelCase spellings live in httpapi, mapped at the boundary.

// Kind names what fired. Only KindBookingEscalated is PRODUCED today (by the outbox consumer
// on booking.escalated); the rest are declared so the wire contract's closed set and the
// storage vocabulary agree from day one, and each arrives with its engine.
type Kind string

const (
	KindBookingEscalated      Kind = "BOOKING_ESCALATED"
	KindAssignmentFailed      Kind = "ASSIGNMENT_FAILED"
	KindSLAAtRisk             Kind = "SLA_AT_RISK"
	KindSLABreached           Kind = "SLA_BREACHED"
	KindNewApplication        Kind = "NEW_APPLICATION"
	KindProviderAutoSuspended Kind = "PROVIDER_AUTO_SUSPENDED"
	KindLowRating             Kind = "LOW_RATING"
	KindPaymentFailed         Kind = "PAYMENT_FAILED"
	KindDailySummary          Kind = "DAILY_SUMMARY"
)

// AllKinds lists every alert kind, in declaration order. The drift test asserts this set
// equals the alerts.kind CHECK constraint.
func AllKinds() []Kind {
	return []Kind{
		KindBookingEscalated, KindAssignmentFailed, KindSLAAtRisk, KindSLABreached,
		KindNewApplication, KindProviderAutoSuspended, KindLowRating, KindPaymentFailed,
		KindDailySummary,
	}
}

func (kind Kind) Valid() bool {
	switch kind {
	case KindBookingEscalated, KindAssignmentFailed, KindSLAAtRisk, KindSLABreached,
		KindNewApplication, KindProviderAutoSuspended, KindLowRating, KindPaymentFailed,
		KindDailySummary:
		return true
	}
	return false
}

func (kind Kind) String() string { return string(kind) }

// ParseKind validates a raw string at a trust boundary (a value read back from storage).
func ParseKind(raw string) (Kind, error) {
	kind := Kind(raw)
	if !kind.Valid() {
		return "", fmt.Errorf("alert: unknown alert kind %q", raw)
	}
	return kind, nil
}

// Severity is the visual tier. Three values, not the spec's five labels: the console only
// ever draws three tiers, and High/Medium triggers both land on WARNING.
type Severity string

const (
	SeverityCritical      Severity = "CRITICAL"
	SeverityWarning       Severity = "WARNING"
	SeverityInformational Severity = "INFORMATIONAL"
)

// AllSeverities lists every severity, in declaration order. The drift test asserts this set
// equals the alerts.severity CHECK constraint.
func AllSeverities() []Severity {
	return []Severity{SeverityCritical, SeverityWarning, SeverityInformational}
}

func (severity Severity) Valid() bool {
	switch severity {
	case SeverityCritical, SeverityWarning, SeverityInformational:
		return true
	}
	return false
}

func (severity Severity) String() string { return string(severity) }

// ParseSeverity validates a raw string at a trust boundary.
func ParseSeverity(raw string) (Severity, error) {
	severity := Severity(raw)
	if !severity.Valid() {
		return "", fmt.Errorf("alert: unknown alert severity %q", raw)
	}
	return severity, nil
}

// SubjectKind names the record an alert points at.
type SubjectKind string

const (
	SubjectBooking  SubjectKind = "BOOKING"
	SubjectProvider SubjectKind = "PROVIDER"
)

// AllSubjectKinds lists every subject kind, in declaration order. The drift test asserts
// this set equals the alerts.subject_kind CHECK constraint.
func AllSubjectKinds() []SubjectKind {
	return []SubjectKind{SubjectBooking, SubjectProvider}
}

func (kind SubjectKind) Valid() bool {
	switch kind {
	case SubjectBooking, SubjectProvider:
		return true
	}
	return false
}

func (kind SubjectKind) String() string { return string(kind) }

// ParseSubjectKind validates a raw string at a trust boundary.
func ParseSubjectKind(raw string) (SubjectKind, error) {
	kind := SubjectKind(raw)
	if !kind.Valid() {
		return "", fmt.Errorf("alert: unknown alert subject kind %q", raw)
	}
	return kind, nil
}
