package booking

import "fmt"

// IllegalTransitionError is returned when an action is not legal from a given state.
//
// GO LESSON — a custom error TYPE (not just a sentinel value) because callers need the
// data: the HTTP layer turns this into a 409 and tells the user *what* was refused. The
// pointer receiver on Error() means you compare with errors.As, not errors.Is.
type IllegalTransitionError struct {
	From   State
	Action Action
}

func (illegal *IllegalTransitionError) Error() string {
	return fmt.Sprintf("cannot %s a booking in state %s", illegal.Action, illegal.From)
}

// UnknownStateError guards the boundary where a string from the database becomes a State.
// If this ever fires, the database holds a value Go does not know about — which the CHECK
// constraint and the drift test exist to prevent. It is a last line of defence.
type UnknownStateError struct{ Value string }

func (unknown *UnknownStateError) Error() string {
	return fmt.Sprintf("unknown booking state %q", unknown.Value)
}

// transition is the map key: a state and the thing you are trying to do to it.
//
// GO LESSON — a struct as a map key. Go allows this for any comparable struct, and it is
// the idiomatic way to key on a pair. In Java this needed a nested EnumMap or a composite
// key class with equals/hashCode. Here it just works.
type transition struct {
	from   State
	action Action
}

// transitions IS the state machine. Every legal move in the system, in one table you can
// read top to bottom. If a (state, action) pair is not in here, it is illegal — there is
// no default, no fallthrough, and no clever inference.
//
// Every transition writes an immutable row to booking_events, in the SAME transaction as
// the booking update (ROADMAP §7). That log is our debugger, our dispute evidence, and
// P5's analytics source.
var transitions = map[transition]State{
	// ---- the happy path ------------------------------------------------------------
	{StateDraft, ActionConfirm}:                       StateConfirmed,
	{StateConfirmed, ActionSearch}:                    StateSearching,
	{StateSearching, ActionAssign}:                    StateAssigned,
	{StateAssigned, ActionDepart}:                     StateEnRoute,
	{StateEnRoute, ActionArrive}:                      StateArrived,
	{StateArrived, ActionVerifyStart}:                 StateInProgress,
	{StateInProgress, ActionRequestCompletion}:        StateAwaitingCompletion,
	{StateAwaitingCompletion, ActionVerifyCompletion}: StateCompleted,

	// ---- escalation: the human escape hatch (ROADMAP §5.2 Tier 4) -------------------
	// Every state where reality can go wrong can hand the job to a human. This is the
	// path that makes dispatch survive contact with the world: the 11pm booking nobody
	// takes, the technician whose phone is dead, the address that geocodes to a lake.
	{StateConfirmed, ActionEscalate}:          StateEscalated, // ops places a job by hand before search even starts
	{StateSearching, ActionEscalate}:          StateEscalated, // the auto ladder is exhausted
	{StateAssigned, ActionEscalate}:           StateEscalated, // assigned tech went dark
	{StateEnRoute, ActionEscalate}:            StateEscalated, // tech cannot reach the address
	{StateArrived, ActionEscalate}:            StateEscalated, // customer not home / start OTP fails
	{StateInProgress, ActionEscalate}:         StateEscalated, // job cannot be done — part missing
	{StateAwaitingCompletion, ActionEscalate}: StateEscalated, // completion OTP disputed

	// ---- out of the human queue ----------------------------------------------------
	{StateEscalated, ActionAssign}: StateAssigned,  // ops places it by hand
	{StateEscalated, ActionResume}: StateSearching, // ops retries the automated ladder

	// ---- rescheduling (ROADMAP §5.2 Tier 5) ----------------------------------------
	// "A booking that sits in searching for six hours is worse than an early, honest
	// 'we can't do 2pm — can we do 6pm?'. Customers forgive limits. They do not forgive
	// being strung along."
	{StateConfirmed, ActionReschedule}: StateRescheduled,
	{StateSearching, ActionReschedule}: StateRescheduled,
	{StateAssigned, ActionReschedule}:  StateRescheduled,
	{StateEscalated, ActionReschedule}: StateRescheduled,
	{StateRescheduled, ActionResume}:   StateConfirmed, // new slot accepted; re-enter the flow
	{StateRescheduled, ActionCancel}:   StateCancelled,

	// ---- cancellation --------------------------------------------------------------
	// DELIBERATELY NOT ALLOWED once work has started (IN_PROGRESS onwards).
	//
	// A technician is in someone's kitchen with the appliance open. "Cancel" is not a
	// button at that point — it is a negotiation, and it must go through ESCALATE so a
	// human decides what is owed and to whom. Allowing a silent cancel here would let a
	// customer (or a bug) abandon a half-finished job with no record of why, and no
	// decision about the money.
	{StateDraft, ActionCancel}:     StateCancelled,
	{StateConfirmed, ActionCancel}: StateCancelled,
	{StateSearching, ActionCancel}: StateCancelled,
	{StateAssigned, ActionCancel}:  StateCancelled,
	{StateEnRoute, ActionCancel}:   StateCancelled,
	{StateArrived, ActionCancel}:   StateCancelled,
	{StateEscalated, ActionCancel}: StateCancelled, // Tier 5: cancel with apology + credit

	// THE CANCEL COMPENSATION (admin console §10.3: cancel carries a 10-second undo).
	// An ops emergency cancel undone inside its window ESCALATEs the booking back into the
	// human queue — a real, audited transition, not a client-side rollback. The 10-second
	// clock is a time guard in the rescue service (like the 60-second customer-cancel
	// window, Booking-Workflow-Decisions §8.2): the machine states legality, not timing.
	// CANCELLED therefore stopped being terminal (see IsTerminal); COMPLETED and FAILED
	// still are — a booking that has been billed or credited can never come back to life.
	{StateCancelled, ActionEscalate}: StateEscalated,

	// ---- terminal failure ----------------------------------------------------------
	// Nobody could be found. Ledger issues an automatic credit (ROADMAP §8).
	{StateSearching, ActionFail}: StateFailed,
	{StateEscalated, ActionFail}: StateFailed,
}

// Apply is the whole state machine: given where a booking is and what you want to do,
// return where it lands — or refuse.
//
// PURE. No database, no clock, no network, no context. Same inputs, same output, every
// time. That is what lets us test all 169 (state × action) combinations in milliseconds
// and claim the machine is *provably* correct rather than *probably* correct.
func Apply(from State, action Action) (State, error) {
	if !from.Valid() {
		return "", &UnknownStateError{Value: string(from)}
	}
	if !action.Valid() {
		return "", &IllegalTransitionError{From: from, Action: action}
	}

	// GO LESSON — the "comma ok" idiom. A map lookup returns two values: the value, and
	// whether the key was present. Without checking `ok`, a missing key silently yields
	// the zero value — here, the empty string "" — and we would happily write a booking
	// with no state at all. This idiom is Go's answer to the null pointer.
	to, ok := transitions[transition{from: from, action: action}]
	if !ok {
		return "", &IllegalTransitionError{From: from, Action: action}
	}
	return to, nil
}

// AllowedActions returns every action legal from this state, so the API can tell an app
// which buttons to render — rather than each client re-deriving the rules and drifting.
//
// Returns an empty (non-nil) slice for terminal states.
func AllowedActions(from State) []Action {
	allowed := make([]Action, 0, 4)
	// Iterate AllActions rather than the map, so the result is deterministically ordered.
	// Go map iteration order is RANDOMISED on purpose — ranging over `transitions` here
	// would return the same actions in a different order on every call, which would make
	// API responses non-deterministic and tests flaky.
	for _, action := range AllActions() {
		if _, ok := transitions[transition{from: from, action: action}]; ok {
			allowed = append(allowed, action)
		}
	}
	return allowed
}

// ParseState converts a string from the database into a State, refusing anything unknown.
// This is the ONLY place a raw string is allowed to become a State.
func ParseState(raw string) (State, error) {
	state := State(raw)
	if !state.Valid() {
		return "", &UnknownStateError{Value: raw}
	}
	return state, nil
}
