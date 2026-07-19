// Package audit records who did what to which entity, with a before/after snapshot. Every entry is
// written inside the caller's transaction (Record takes the tx), so the audit row commits atomically
// with the change it describes — the log can never disagree with what actually happened. This is the
// who/before/after dimension the append-only ledger (which records money) does not carry.
package audit

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// ActorKind separates a human from a background job from a payment gateway.
type ActorKind string

const (
	ActorUser    ActorKind = "user"
	ActorSystem  ActorKind = "system"
	ActorGateway ActorKind = "gateway"
)

// Entry is one audited change. Before/After are marshalled to JSONB (nil → SQL null).
type Entry struct {
	ActorUserID   *uuid.UUID
	ActorKind     ActorKind // empty → inferred: user if ActorUserID set, else system
	Action        string
	EntityType    string
	EntityID      uuid.UUID
	Before        any
	After         any
	CorrelationID *uuid.UUID
}

// Record writes the entry using the caller's transaction (pass the same tx as the business write).
func Record(ctx context.Context, tx sqlcgen.DBTX, entry Entry) error {
	before, err := marshal(entry.Before)
	if err != nil {
		return err
	}
	after, err := marshal(entry.After)
	if err != nil {
		return err
	}

	kind := entry.ActorKind
	if kind == "" {
		if entry.ActorUserID != nil {
			kind = ActorUser
		} else {
			kind = ActorSystem
		}
	}

	return sqlcgen.New(tx).InsertAuditLog(ctx, sqlcgen.InsertAuditLogParams{
		ActorUserID:   entry.ActorUserID,
		ActorKind:     string(kind),
		Action:        entry.Action,
		EntityType:    entry.EntityType,
		EntityID:      entry.EntityID,
		Before:        before,
		After:         after,
		CorrelationID: entry.CorrelationID,
	})
}

func marshal(value any) ([]byte, error) {
	if value == nil {
		return nil, nil
	}
	return json.Marshal(value)
}
