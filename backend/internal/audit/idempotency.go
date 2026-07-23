package audit

// The admin console's idempotent-replay store. Every admin mutation carries an
// Idempotency-Key minted once per operator intent; the receipt the first execution returned
// is recorded here (an audit_logs row under entity_type 'admin_action_key'), and a replayed
// key returns that stored receipt instead of acting twice. audit_logs is the natural home:
// the replay record IS an audit fact — which operator, which operation, what was returned —
// and it lands without a new table.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// actionKeyEntityType marks the audit rows that are replay records rather than trail
// entries; the console's audit list never names it, so they stay out of the operator view.
const actionKeyEntityType = "admin_action_key"

// actionKeyNamespace is the fixed UUIDv5 namespace replay keys are derived under. Changing
// it would orphan every stored receipt, so it never changes.
var actionKeyNamespace = uuid.MustParse("6c1a5f48-9f30-47a9-b1d6-6a91d0f8f0aa")

// ActionKeyID derives the deterministic id a replay record is stored (and found) under:
// one operation, on one subject, under one operator-minted key. Deriving a UUID keeps the
// raw header out of the entity_id column while staying exactly reproducible.
func ActionKeyID(operation, subjectID, idempotencyKey string) uuid.UUID {
	return uuid.NewSHA1(actionKeyNamespace, []byte(operation+"|"+subjectID+"|"+idempotencyKey))
}

// ReplayAdminAction returns the stored receipt for a key id, if one exists. found=false
// means the key has not been seen — the caller executes and records.
func (service *Service) ReplayAdminAction(ctx context.Context, keyID uuid.UUID) (receipt []byte, found bool, err error) {
	raw, err := sqlcgen.New(service.pool).GetAdminActionReplay(ctx, keyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("reading replay record: %w", err)
	}
	return raw, true, nil
}

// RecordAdminAction stores the receipt the first execution of an admin mutation returned,
// so a replayed Idempotency-Key returns it instead of acting again. The receipt must
// marshal to JSON.
//
// The store is lookup-then-insert without a unique guard, so two SIMULTANEOUS requests
// carrying the same key can both execute; the domain's own guards (the booking version CAS)
// make the loser fail safely rather than act twice. Sequential replays — the case the
// header exists for — always find the stored receipt.
func (service *Service) RecordAdminAction(ctx context.Context, actorUserID uuid.UUID, operation string, keyID uuid.UUID, receipt any) error {
	if err := Record(ctx, service.pool, Entry{
		ActorUserID: &actorUserID,
		Action:      operation,
		EntityType:  actionKeyEntityType,
		EntityID:    keyID,
		After:       receipt,
	}); err != nil {
		return fmt.Errorf("recording replay receipt: %w", err)
	}
	return nil
}

// UnmarshalReceipt decodes a stored replay receipt into the operation's receipt type.
func UnmarshalReceipt(raw []byte, into any) error {
	if err := json.Unmarshal(raw, into); err != nil {
		return fmt.Errorf("decoding stored replay receipt: %w", err)
	}
	return nil
}

// CountAdminActionsSince reports how often an admin performed a recorded action on or after
// the given instant, and when the oldest occurrence in that window landed — the counters
// behind the refund rate limit.
func (service *Service) CountAdminActionsSince(ctx context.Context, actorUserID uuid.UUID, action string, since time.Time) (total int32, oldest *time.Time, err error) {
	row, err := sqlcgen.New(service.pool).CountAdminAuditActionsSince(ctx, sqlcgen.CountAdminAuditActionsSinceParams{
		ActorUserID: &actorUserID,
		Action:      action,
		CreatedAt:   pgtype.Timestamptz{Time: since, Valid: true},
	})
	if err != nil {
		return 0, nil, fmt.Errorf("counting admin actions: %w", err)
	}
	if row.Oldest.Valid {
		oldestAt := row.Oldest.Time
		oldest = &oldestAt
	}
	return row.Total, oldest, nil
}
