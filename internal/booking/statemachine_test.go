package booking_test

import (
	"errors"
	"testing"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
)

// ROADMAP §7 is an architectural decision, not a detail: "Thirteen states we fully
// understand will ship; eighteen we half-understand will leak bugs into people's
// kitchens." Every state multiplies the UI cases, notification rules and transitions to
// be tested.
//
// So this test exists to FAIL when someone adds a fourteenth. It is not busywork — it is
// a tripwire that sends the next person to read §7 before they grow the machine.
func TestThereAreExactlyThirteenStatesAndThirteenActions(t *testing.T) {
	t.Parallel()

	if got := len(booking.AllStates()); got != 13 {
		t.Errorf("got %d states, want 13 — if you are adding one, read ROADMAP §7 first", got)
	}
	if got := len(booking.AllActions()); got != 13 {
		t.Errorf("got %d actions, want 13 — if you are adding one, read ROADMAP §7 first", got)
	}
}

// The whole point of a pure state machine: we can try EVERY combination, not a hopeful
// sample. 13 states × 13 actions = 169 cases, in about a millisecond.
//
// This is the test that turns "the booking spine is probably correct" into "the booking
// spine is provably correct" — every legal transition works, every illegal one is
// refused, and there is nowhere for a surprise to hide.
func TestEveryStateActionCombination(t *testing.T) {
	t.Parallel()

	// The complete set of legal moves, written out INDEPENDENTLY of the implementation.
	// If this duplicated the transitions map, it would pass even when both were wrong
	// together — a test that only proves the code equals itself.
	legal := map[booking.State]map[booking.Action]booking.State{
		booking.StateDraft: {
			booking.ActionConfirm: booking.StateConfirmed,
			booking.ActionCancel:  booking.StateCancelled,
		},
		booking.StateConfirmed: {
			booking.ActionSearch:     booking.StateSearching,
			booking.ActionEscalate:   booking.StateEscalated,
			booking.ActionReschedule: booking.StateRescheduled,
			booking.ActionCancel:     booking.StateCancelled,
		},
		booking.StateSearching: {
			booking.ActionAssign:     booking.StateAssigned,
			booking.ActionEscalate:   booking.StateEscalated,
			booking.ActionReschedule: booking.StateRescheduled,
			booking.ActionCancel:     booking.StateCancelled,
			booking.ActionFail:       booking.StateFailed,
		},
		booking.StateAssigned: {
			booking.ActionDepart:     booking.StateEnRoute,
			booking.ActionEscalate:   booking.StateEscalated,
			booking.ActionReschedule: booking.StateRescheduled,
			booking.ActionCancel:     booking.StateCancelled,
		},
		booking.StateEnRoute: {
			booking.ActionArrive:   booking.StateArrived,
			booking.ActionEscalate: booking.StateEscalated,
			booking.ActionCancel:   booking.StateCancelled,
		},
		booking.StateArrived: {
			booking.ActionVerifyStart: booking.StateInProgress,
			booking.ActionEscalate:    booking.StateEscalated,
			booking.ActionCancel:      booking.StateCancelled,
		},
		booking.StateInProgress: {
			booking.ActionRequestCompletion: booking.StateAwaitingCompletion,
			booking.ActionEscalate:          booking.StateEscalated,
			// NOTE: no CANCEL. Once a technician has opened the appliance, cancelling is
			// a negotiation, not a button — it must go through ESCALATE so a human decides
			// what is owed. See statemachine.go.
		},
		booking.StateAwaitingCompletion: {
			booking.ActionVerifyCompletion: booking.StateCompleted,
			booking.ActionEscalate:         booking.StateEscalated,
		},
		booking.StateEscalated: {
			booking.ActionAssign:     booking.StateAssigned,
			booking.ActionResume:     booking.StateSearching,
			booking.ActionReschedule: booking.StateRescheduled,
			booking.ActionCancel:     booking.StateCancelled,
			booking.ActionFail:       booking.StateFailed,
		},
		booking.StateRescheduled: {
			booking.ActionResume: booking.StateConfirmed,
			booking.ActionCancel: booking.StateCancelled,
		},
		// Terminal. No exits, not even CANCEL.
		booking.StateCompleted: {},
		booking.StateCancelled: {},
		booking.StateFailed:    {},
	}

	for _, from := range booking.AllStates() {
		for _, action := range booking.AllActions() {
			want, isLegal := legal[from][action]

			got, err := booking.Apply(from, action)

			if isLegal {
				if err != nil {
					t.Errorf("Apply(%s, %s) = error %v; want %s", from, action, err, want)
					continue
				}
				if got != want {
					t.Errorf("Apply(%s, %s) = %s; want %s", from, action, got, want)
				}
				continue
			}

			// Illegal: must be REFUSED, and refused with the right error type.
			if err == nil {
				t.Errorf("Apply(%s, %s) = %s; want refusal — this is an ILLEGAL transition", from, action, got)
				continue
			}
			var illegal *booking.IllegalTransitionError
			if !errors.As(err, &illegal) {
				t.Errorf("Apply(%s, %s) error = %T; want *IllegalTransitionError", from, action, err)
			}
		}
	}
}

// The path a real, uneventful booking walks from tap to review.
func TestHappyPath(t *testing.T) {
	t.Parallel()

	steps := []struct {
		action booking.Action
		want   booking.State
	}{
		{booking.ActionConfirm, booking.StateConfirmed},
		{booking.ActionSearch, booking.StateSearching},
		{booking.ActionAssign, booking.StateAssigned},
		{booking.ActionDepart, booking.StateEnRoute},
		{booking.ActionArrive, booking.StateArrived},
		{booking.ActionVerifyStart, booking.StateInProgress}, // start OTP
		{booking.ActionRequestCompletion, booking.StateAwaitingCompletion},
		{booking.ActionVerifyCompletion, booking.StateCompleted}, // completion OTP
	}

	state := booking.StateDraft
	for _, step := range steps {
		next, err := booking.Apply(state, step.action)
		if err != nil {
			t.Fatalf("Apply(%s, %s) failed: %v", state, step.action, err)
		}
		if next != step.want {
			t.Fatalf("Apply(%s, %s) = %s; want %s", state, step.action, next, step.want)
		}
		state = next
	}

	if !state.IsTerminal() {
		t.Errorf("a completed booking must be terminal, got %s", state)
	}
}

// Terminal means terminal. A completed job cannot be cancelled, re-escalated, or failed
// — that is what protects the ledger from a booking that comes back to life after it has
// been billed.
func TestTerminalStatesHaveNoExits(t *testing.T) {
	t.Parallel()

	for _, state := range booking.AllStates() {
		if !state.IsTerminal() {
			continue
		}
		if allowed := booking.AllowedActions(state); len(allowed) != 0 {
			t.Errorf("terminal state %s allows %v; want none", state, allowed)
		}
		for _, action := range booking.AllActions() {
			if _, err := booking.Apply(state, action); err == nil {
				t.Errorf("Apply(%s, %s) succeeded; terminal states must refuse everything", state, action)
			}
		}
	}
}

// A state nothing can reach is dead code pretending to be a requirement. This walks the
// graph from DRAFT and asserts all thirteen are actually reachable.
func TestEveryStateIsReachableFromDraft(t *testing.T) {
	t.Parallel()

	seen := map[booking.State]bool{booking.StateDraft: true}
	queue := []booking.State{booking.StateDraft}

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		for _, action := range booking.AllowedActions(current) {
			next, err := booking.Apply(current, action)
			if err != nil {
				t.Fatalf("AllowedActions said %s was legal from %s, but Apply refused: %v", action, current, err)
			}
			if !seen[next] {
				seen[next] = true
				queue = append(queue, next)
			}
		}
	}

	for _, state := range booking.AllStates() {
		if !seen[state] {
			t.Errorf("state %s is unreachable from DRAFT — it is either dead or the graph is wrong", state)
		}
	}
}

// A booking can always be got out of the human queue. If ESCALATED could trap a booking,
// ops would have no way to rescue a job — which is the one thing the escalation ladder
// exists to guarantee (ROADMAP §5.3).
func TestEscalatedIsNeverATrap(t *testing.T) {
	t.Parallel()

	allowed := booking.AllowedActions(booking.StateEscalated)
	if len(allowed) == 0 {
		t.Fatal("ESCALATED has no exits — ops can never rescue a booking")
	}

	// Every non-terminal, non-escalated state must be able to reach a human.
	for _, state := range booking.AllStates() {
		if state.IsTerminal() || state == booking.StateEscalated {
			continue
		}
		if state == booking.StateDraft || state == booking.StateRescheduled {
			continue // not yet in flight; nothing to escalate
		}
		if _, err := booking.Apply(state, booking.ActionEscalate); err != nil {
			t.Errorf("cannot escalate from %s — an in-flight booking with no human escape hatch", state)
		}
	}
}

// Work in progress cannot be silently cancelled. See statemachine.go for why.
func TestCannotCancelOnceWorkHasStarted(t *testing.T) {
	t.Parallel()

	for _, state := range []booking.State{booking.StateInProgress, booking.StateAwaitingCompletion} {
		if _, err := booking.Apply(state, booking.ActionCancel); err == nil {
			t.Errorf("Apply(%s, CANCEL) succeeded; a technician is mid-job — this must go through ESCALATE", state)
		}
	}
}

func TestAllowedActionsIsDeterministic(t *testing.T) {
	t.Parallel()

	// Go randomises map iteration order deliberately. If AllowedActions ranged over the
	// transitions map, this would flake. It ranges over AllActions() instead.
	first := booking.AllowedActions(booking.StateSearching)
	for range 50 {
		got := booking.AllowedActions(booking.StateSearching)
		if len(got) != len(first) {
			t.Fatalf("AllowedActions length changed between calls: %v vs %v", got, first)
		}
		for i := range got {
			if got[i] != first[i] {
				t.Fatalf("AllowedActions order is not deterministic: %v vs %v", got, first)
			}
		}
	}
}

func TestParseStateRefusesGarbageFromTheDatabase(t *testing.T) {
	t.Parallel()

	if _, err := booking.ParseState("CONFRMED"); err == nil {
		t.Error("ParseState accepted a typo; the database must never be able to inject an unknown state")
	}

	var unknown *booking.UnknownStateError
	_, err := booking.ParseState("BANANA")
	if !errors.As(err, &unknown) {
		t.Errorf("ParseState error = %T; want *UnknownStateError", err)
	}

	for _, state := range booking.AllStates() {
		got, err := booking.ParseState(string(state))
		if err != nil || got != state {
			t.Errorf("ParseState(%q) = (%s, %v); want (%s, nil)", state, got, err, state)
		}
	}
}
