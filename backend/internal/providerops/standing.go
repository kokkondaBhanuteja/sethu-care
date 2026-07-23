package providerops

// The standing writes: suspend, block, force-offline and restore. Every one runs in a
// single transaction with version CAS on provider_admin_states and an audit entry, so the
// change and its record commit together. A suspension or block refuses to land while a live
// job is unresolved — stranding a customer silently is the failure the whole flow exists to
// prevent — and a job the operator marked "reassign" is escalated through booking.Apply
// AFTER the standing commits (each escalation is its own atomic, audited transition; the
// suspended provider is already out of dispatch when the rescue queue picks it up).

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kokkondaBhanuteja/sethu-care/internal/audit"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// StandingChangeInput is one operator decision to take a provider out of circulation.
type StandingChangeInput struct {
	TechnicianID uuid.UUID
	// ActorID is the admin acting, from the token — never from the request body.
	ActorID uuid.UUID
	Reason  SuspendReason
	Note    string
	// DurationDays is required for a suspension, nil for a block or force-offline.
	DurationDays *int32
	// NotifyImmediately is the operator's intent, recorded in the audit entry. No provider
	// notification channel exists yet (SMS is OTP-template-bound), so recording it honestly
	// is all that can happen today.
	NotifyImmediately bool
	// JobResolutions maps each live booking to the operator's decision for it. Every live
	// job must be resolved before a suspension or block lands.
	JobResolutions map[uuid.UUID]JobResolution
	// ExpectedVersion is the standing version the operator read (0 for a provider never
	// acted on before).
	ExpectedVersion int32
}

// StandingChangeResult echoes what took effect.
type StandingChangeResult struct {
	DurationDays   *int32
	EffectiveUntil *time.Time
	Version        int32
}

// standingSnapshot is the before/after image an audit entry carries.
type standingSnapshot struct {
	Standing       Standing   `json:"standing"`
	ReasonCode     *string    `json:"reasonCode,omitempty"`
	SuspendedUntil *time.Time `json:"suspendedUntil,omitempty"`
	Note           string     `json:"note,omitempty"`
	Notify         bool       `json:"notifyImmediately,omitempty"`
}

// Suspend takes a provider out of dispatch until now + DurationDays. Every live job must
// carry a resolution; "reassign" jobs are escalated into the rescue queue after the
// suspension commits.
func (service *Service) Suspend(ctx context.Context, in StandingChangeInput) (StandingChangeResult, error) {
	if in.DurationDays == nil || *in.DurationDays <= 0 {
		return StandingChangeResult{}, ErrDurationRequired
	}
	until := time.Now().Add(time.Duration(*in.DurationDays) * 24 * time.Hour)
	newVersion, reassign, err := service.imposeStanding(ctx, in, StandingSuspended, &until)
	if err != nil {
		return StandingChangeResult{}, err
	}
	service.escalateReassigned(ctx, in.ActorID, reassign)
	return StandingChangeResult{DurationDays: in.DurationDays, EffectiveUntil: &until, Version: newVersion}, nil
}

// Block takes a provider out of dispatch permanently. Live jobs must be resolved exactly as
// for a suspension — a permanent removal strands a customer just as silently as a temporary
// one.
func (service *Service) Block(ctx context.Context, in StandingChangeInput) (StandingChangeResult, error) {
	newVersion, reassign, err := service.imposeStanding(ctx, in, StandingBlocked, nil)
	if err != nil {
		return StandingChangeResult{}, err
	}
	service.escalateReassigned(ctx, in.ActorID, reassign)
	return StandingChangeResult{Version: newVersion}, nil
}

// imposeStanding is the shared transactional core of Suspend and Block: existence check,
// version CAS, unresolved-job gate, the standing upsert and the audit entry. It returns the
// bookings the operator chose to reassign, for escalation after commit.
func (service *Service) imposeStanding(ctx context.Context, in StandingChangeInput, standing Standing, until *time.Time) (int32, []uuid.UUID, error) {
	if !in.Reason.Valid() {
		return 0, nil, fmt.Errorf("providerops: unknown suspend reason %q", in.Reason)
	}

	var newVersion int32
	var reassign []uuid.UUID
	err := storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		queries := sqlcgen.New(tx)

		before, err := service.standingForUpdate(ctx, queries, in.TechnicianID, in.ExpectedVersion)
		if err != nil {
			return err
		}

		liveJobs, err := queries.AdminProviderActiveJobs(ctx, &in.TechnicianID)
		if err != nil {
			return fmt.Errorf("reading active jobs: %w", err)
		}
		var unresolved []uuid.UUID
		for _, job := range liveJobs {
			resolution, resolved := in.JobResolutions[job.ID]
			switch {
			case !resolved:
				unresolved = append(unresolved, job.ID)
			case resolution == JobResolutionReassign:
				reassign = append(reassign, job.ID)
			}
		}
		if len(unresolved) > 0 {
			return &UnresolvedJobsError{BookingIDs: unresolved}
		}

		reasonCode := string(in.Reason)
		params := sqlcgen.UpsertProviderStandingParams{
			TechnicianID:    in.TechnicianID,
			Standing:        string(standing),
			ReasonCode:      &reasonCode,
			Note:            in.Note,
			DecidedBy:       &in.ActorID,
			ExpectedVersion: int64(in.ExpectedVersion),
		}
		if until != nil {
			params.SuspendedUntil = pgtype.Timestamptz{Time: *until, Valid: true}
		}
		version, err := queries.UpsertProviderStanding(ctx, params)
		if errors.Is(err, pgx.ErrNoRows) {
			return service.staleStanding(ctx, queries, in.TechnicianID)
		}
		if err != nil {
			return fmt.Errorf("writing provider standing: %w", err)
		}
		newVersion = int32(version)

		after := standingSnapshot{
			Standing:       standing,
			ReasonCode:     &reasonCode,
			SuspendedUntil: until,
			Note:           in.Note,
			Notify:         in.NotifyImmediately,
		}
		return audit.Record(ctx, tx, audit.Entry{
			ActorUserID: &in.ActorID,
			Action:      auditActionForStanding(standing),
			EntityType:  "provider",
			EntityID:    in.TechnicianID,
			Before:      before,
			After:       after,
		})
	})
	if err != nil {
		return 0, nil, err
	}
	return newVersion, reassign, nil
}

func auditActionForStanding(standing Standing) string {
	if standing == StandingBlocked {
		return "PROVIDER_BLOCK"
	}
	return "PROVIDER_SUSPEND"
}

// escalateReassigned hands each reassign-resolved booking to the rescue queue as the acting
// admin. Best effort per booking: one that already moved on (completed, cancelled, already
// escalated) is left alone — the point was to not strand it, and it is not stranded.
func (service *Service) escalateReassigned(ctx context.Context, actorID uuid.UUID, bookingIDs []uuid.UUID) {
	for _, bookingID := range bookingIDs {
		_, err := service.booking.Apply(ctx, bookingID, booking.ActionEscalate, booking.TransitionInput{
			Actor:     &actorID,
			ActorRole: identity.RoleAdmin,
		})
		var illegal *booking.IllegalTransitionError
		var conflict *booking.ConflictError
		if err == nil || errors.As(err, &illegal) || errors.As(err, &conflict) ||
			errors.Is(err, booking.ErrBookingNotFound) {
			continue
		}
		// Any other failure has nothing to surface to the operator — the suspension itself
		// already committed, and the booking stays visible in the console's live views.
	}
}

// ForceOfflineInput is the medium-risk act: flip availability off, standing untouched.
type ForceOfflineInput struct {
	TechnicianID      uuid.UUID
	ActorID           uuid.UUID
	Reason            SuspendReason
	Note              string
	NotifyImmediately bool
	ExpectedVersion   int32
}

// ForceOffline flips the provider's availability off through identity, inside one
// transaction with the version bump and the audit entry. The provider can simply go online
// again — that is what makes it medium-risk.
func (service *Service) ForceOffline(ctx context.Context, in ForceOfflineInput) (StandingChangeResult, error) {
	if !in.Reason.Valid() {
		return StandingChangeResult{}, fmt.Errorf("providerops: unknown suspend reason %q", in.Reason)
	}
	var newVersion int32
	err := storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		queries := sqlcgen.New(tx)

		if _, err := service.standingForUpdate(ctx, queries, in.TechnicianID, in.ExpectedVersion); err != nil {
			return err
		}
		version, err := queries.BumpProviderStandingVersion(ctx, sqlcgen.BumpProviderStandingVersionParams{
			TechnicianID:    in.TechnicianID,
			ExpectedVersion: int64(in.ExpectedVersion),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return service.staleStanding(ctx, queries, in.TechnicianID)
		}
		if err != nil {
			return fmt.Errorf("bumping provider version: %w", err)
		}
		newVersion = int32(version)

		if err := service.identity.SetAvailabilityIn(ctx, tx, in.TechnicianID, false); err != nil {
			return err
		}

		reasonCode := string(in.Reason)
		return audit.Record(ctx, tx, audit.Entry{
			ActorUserID: &in.ActorID,
			Action:      "PROVIDER_FORCE_OFFLINE",
			EntityType:  "provider",
			EntityID:    in.TechnicianID,
			After: standingSnapshot{
				Standing:   StandingActive,
				ReasonCode: &reasonCode,
				Note:       in.Note,
				Notify:     in.NotifyImmediately,
			},
		})
	})
	if err != nil {
		return StandingChangeResult{}, err
	}
	return StandingChangeResult{Version: newVersion}, nil
}

// RestoreInput reverses a suspension or a block.
type RestoreInput struct {
	TechnicianID    uuid.UUID
	ActorID         uuid.UUID
	Note            string
	ExpectedVersion int32
}

// RestoreResult reports the provider's derived status once nothing stands against them.
type RestoreResult struct {
	Status  ProviderStatus
	Version int32
}

// Restore lifts the standing back to ACTIVE. ErrNotRestricted when nothing stands against
// the provider — restoring an active provider is a stale console, not a no-op to swallow.
func (service *Service) Restore(ctx context.Context, in RestoreInput) (RestoreResult, error) {
	var result RestoreResult
	err := storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		queries := sqlcgen.New(tx)

		before, err := service.standingForUpdate(ctx, queries, in.TechnicianID, in.ExpectedVersion)
		if err != nil {
			return err
		}
		if before.Standing == StandingActive {
			return ErrNotRestricted
		}

		version, err := queries.UpsertProviderStanding(ctx, sqlcgen.UpsertProviderStandingParams{
			TechnicianID:    in.TechnicianID,
			Standing:        string(StandingActive),
			Note:            in.Note,
			DecidedBy:       &in.ActorID,
			ExpectedVersion: int64(in.ExpectedVersion),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return service.staleStanding(ctx, queries, in.TechnicianID)
		}
		if err != nil {
			return fmt.Errorf("writing provider standing: %w", err)
		}
		result.Version = int32(version)

		if err := audit.Record(ctx, tx, audit.Entry{
			ActorUserID: &in.ActorID,
			Action:      "PROVIDER_RESTORE",
			EntityType:  "provider",
			EntityID:    in.TechnicianID,
			Before:      before,
			After:       standingSnapshot{Standing: StandingActive, Note: in.Note},
		}); err != nil {
			return err
		}

		// The status the console shows next is derived the same way the roster derives it.
		core, err := queries.AdminGetProvider(ctx, sqlcgen.AdminGetProviderParams{
			StaleAfterSeconds: staleAfterSeconds,
			TechnicianID:      in.TechnicianID,
		})
		if err != nil {
			return fmt.Errorf("re-reading provider: %w", err)
		}
		result.Status = ProviderStatus(core.Status)
		return nil
	})
	if err != nil {
		return RestoreResult{}, err
	}
	return result, nil
}

// standingForUpdate verifies the technician exists (404), reads the current standing (a
// missing row is ACTIVE at version 0) and enforces the optimistic-concurrency check.
func (service *Service) standingForUpdate(ctx context.Context, queries *sqlcgen.Queries, technicianID uuid.UUID, expectedVersion int32) (standingSnapshot, error) {
	exists, err := queries.TechnicianExists(ctx, technicianID)
	if err != nil {
		return standingSnapshot{}, fmt.Errorf("checking technician: %w", err)
	}
	if !exists {
		return standingSnapshot{}, ErrProviderNotFound
	}

	before := standingSnapshot{Standing: StandingActive}
	currentVersion := int32(0)
	row, err := queries.GetProviderStandingVersion(ctx, technicianID)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		// Never acted on: ACTIVE at version 0.
	case err != nil:
		return standingSnapshot{}, fmt.Errorf("reading provider standing: %w", err)
	default:
		standing, parseErr := ParseStanding(row.Standing)
		if parseErr != nil {
			return standingSnapshot{}, parseErr
		}
		before.Standing = standing
		currentVersion = int32(row.Version)
	}
	if currentVersion != expectedVersion {
		return standingSnapshot{}, &StaleVersionError{CurrentVersion: currentVersion}
	}
	return before, nil
}

// staleStanding turns a zero-row CAS into the 409 the console renders, citing the version
// the record actually carries now.
func (service *Service) staleStanding(ctx context.Context, queries *sqlcgen.Queries, technicianID uuid.UUID) error {
	current := int32(0)
	if row, err := queries.GetProviderStandingVersion(ctx, technicianID); err == nil {
		current = int32(row.Version)
	}
	return &StaleVersionError{CurrentVersion: current}
}
