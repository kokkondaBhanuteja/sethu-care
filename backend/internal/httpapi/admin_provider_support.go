package httpapi

// Support for the provider/application admin mutations: the Idempotency-Key replay path and
// the two designed-conflict bodies the frozen contract declares (VERSION_CONFLICT and
// ALREADY_DECIDED). Everything here is scoped to the provider family — the helpers carry a
// provider* prefix so a sibling operation family can grow its own without colliding.

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/kokkondaBhanuteja/sethu-care/internal/providerops"
)

// providerVersionConflictBody is the 409 body for a stale version. Embedding the declared
// staleVersionError shape keeps the runtime JSON exactly what the contract documents; the
// two methods make it a huma.StatusError, so returning it from a handler writes the struct
// itself as the response body.
type providerVersionConflictBody struct {
	staleVersionError
}

func (conflict *providerVersionConflictBody) Error() string  { return conflict.Message }
func (conflict *providerVersionConflictBody) GetStatus() int { return http.StatusConflict }

// providerDecidedConflictBody is the 409 body when another admin decided first.
type providerDecidedConflictBody struct {
	applicationDecidedError
}

func (conflict *providerDecidedConflictBody) Error() string  { return conflict.Message }
func (conflict *providerDecidedConflictBody) GetStatus() int { return http.StatusConflict }

// providerWriteError maps a provider/application mutation failure: the two designed
// conflicts get their declared bodies; everything else flows through the one classify()
// mapping like every other handler.
func (handler *AdminHandler) providerWriteError(err error) error {
	var stale *providerops.StaleVersionError
	if errors.As(err, &stale) {
		return &providerVersionConflictBody{staleVersionError{
			Code:           "VERSION_CONFLICT",
			CurrentVersion: stale.CurrentVersion,
			Message:        "the record moved since it was read",
		}}
	}
	var decided *providerops.AlreadyDecidedError
	if errors.As(err, &decided) {
		return &providerDecidedConflictBody{applicationDecidedError{
			Code:    "ALREADY_DECIDED",
			Message: "another admin decided first",
			Decision: applicationDecision{
				At:      decided.At,
				ByName:  decided.ByName,
				Outcome: applicationDecisionOutcome(decided.Outcome),
			},
		}}
	}
	return toHumaError(handler.log, err)
}

// providerIdempotencyTTL is how long a replayed Idempotency-Key returns its first result.
const providerIdempotencyTTL = 10 * time.Minute

// providerIdempotent replays a mutation's FIRST result for a repeated Idempotency-Key. The
// cache is the flow layer, so it is deliberately best-effort (absent Redis it does
// nothing): true double-action protection comes from the version CAS and the terminal
// decision guards, which turn a raw retry into the designed 409 rather than a second act.
func providerIdempotent[Result any](ctx context.Context, handler *AdminHandler, operationID, key string, work func() (*Result, error)) (*Result, error) {
	if handler.flow == nil || key == "" {
		return work()
	}
	cacheKey := "admin:" + operationID + ":" + key

	if cached, found, err := handler.flow.Recall(ctx, cacheKey); err == nil && found {
		replayed := new(Result)
		if unmarshalErr := json.Unmarshal([]byte(cached), replayed); unmarshalErr == nil {
			return replayed, nil
		}
	}

	result, err := work()
	if err != nil {
		return nil, err
	}
	if encoded, marshalErr := json.Marshal(result); marshalErr == nil {
		// Best effort: a failed Remember only means a retry re-runs the work and meets the
		// CAS guard instead of the cache.
		if rememberErr := handler.flow.Remember(ctx, cacheKey, string(encoded), providerIdempotencyTTL); rememberErr != nil {
			handler.log.Warn("remembering admin idempotency result", "err", rememberErr)
		}
	}
	return result, nil
}
