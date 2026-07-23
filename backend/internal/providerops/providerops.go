// Package providerops is the admin console's supply side: the provider roster and profile
// read models, the standing writes (suspend / block / force-offline / restore), and the
// provider-application pipeline (approve / reject / request documents).
//
// It owns provider_admin_states and the provider_applications tables. Everything else it
// shows is a cross-module READ (technicians, users, bookings, reviews, skills — the same
// pattern as internal/ops), and everything it CHANGES outside its own tables goes through
// the owning service: technician identities are provisioned and forced offline via
// identity, and a reassigned job is escalated via booking.Apply. Suspending or blocking a
// provider excludes them from dispatch because the assignment engine's eligibility query
// (ops.sql ListCandidateTechnicians) checks provider_admin_states.
package providerops

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
)

// Service serves the admin console's provider and application operations.
type Service struct {
	pool *pgxpool.Pool
	// identity owns users/technicians: approval provisions a TECHNICIAN through it, and
	// force-offline flips availability through it — providerops never writes those tables.
	identity *identity.Service
	// ops supplies the assignment engine's candidate ranking, reused verbatim for the
	// suspend flow's "reassign to <name>" suggestion so the console never suggests someone
	// dispatch would refuse.
	ops *ops.Service
	// booking is the command surface a reassignment goes through (ESCALATE — into the
	// rescue queue the admin already works).
	booking *booking.Service
}

// NewService builds the provider-admin service. All three collaborators are required: they
// are the owning services for every write that leaves this package's own tables.
func NewService(pool *pgxpool.Pool, identityService *identity.Service, opsService *ops.Service, bookingService *booking.Service) *Service {
	return &Service{pool: pool, identity: identityService, ops: opsService, booking: bookingService}
}

// ---------------------------------------------------------------------------
// Errors

var (
	// ErrProviderNotFound — the id is not a (non-deleted) technician. A 404.
	ErrProviderNotFound = errors.New("providerops: provider not found")
	// ErrApplicationNotFound — the id is not an application. A 404.
	ErrApplicationNotFound = errors.New("providerops: application not found")
	// ErrInvalidCursor — a pagination cursor this service did not mint. A 400.
	ErrInvalidCursor = errors.New("providerops: invalid pagination cursor")
	// ErrDurationRequired — a suspension without a duration. A 422.
	ErrDurationRequired = errors.New("providerops: a suspension requires durationDays")
	// ErrNotRestricted — restoring a provider who is not suspended or blocked. A 422.
	ErrNotRestricted = errors.New("providerops: provider is not suspended or blocked")
	// ErrNoteTooShort — a rejection note under the 20-character floor. A 422.
	ErrNoteTooShort = errors.New("providerops: rejection note must be at least 20 characters")
	// ErrNoDocumentsRequested — a request-documents call naming no documents. A 422.
	ErrNoDocumentsRequested = errors.New("providerops: at least one document type must be requested")
	// ErrApplicationDecided — a non-decision mutation (request documents) on an application
	// that has already been decided. A 409.
	ErrApplicationDecided = errors.New("providerops: application is already decided")
)

// StaleVersionError is the optimistic-concurrency failure: the submitted version is not the
// record's current one. Transport renders the console's VERSION_CONFLICT body from it.
type StaleVersionError struct {
	CurrentVersion int32
}

func (stale *StaleVersionError) Error() string {
	return fmt.Sprintf("providerops: the record moved since it was read (current version %d)", stale.CurrentVersion)
}

// AlreadyDecidedError carries the decision that beat this admin to an application, so the
// console can render the already-decided record rather than a bare conflict.
type AlreadyDecidedError struct {
	Outcome ApplicationStatus // ApplicationApproved or ApplicationRejected
	ByName  string
	At      time.Time
}

func (decided *AlreadyDecidedError) Error() string {
	return fmt.Sprintf("providerops: application already %s by %s", decided.Outcome, decided.ByName)
}

// UnresolvedJobsError — a suspension or block that would strand live jobs the operator has
// not resolved. A 422; the ids name exactly which jobs were left dangling.
type UnresolvedJobsError struct {
	BookingIDs []uuid.UUID
}

func (unresolved *UnresolvedJobsError) Error() string {
	ids := make([]string, len(unresolved.BookingIDs))
	for index, bookingID := range unresolved.BookingIDs {
		ids[index] = bookingID.String()
	}
	return "providerops: active jobs left unresolved: " + strings.Join(ids, ", ")
}

// ApprovalBlockedError — the server-computed blockers stand; approval is refused. A 422.
type ApprovalBlockedError struct {
	Blockers []ApprovalBlocker
}

func (blocked *ApprovalBlockedError) Error() string {
	codes := make([]string, len(blocked.Blockers))
	for index, blocker := range blocked.Blockers {
		codes[index] = string(blocker.Code)
	}
	return "providerops: approval is blocked: " + strings.Join(codes, ", ")
}
