// Package booking owns the spine: the lifecycle of a job (ROADMAP §4.3).
//
// It is the source of truth for what has happened to a booking, and the publisher of
// the events everything else reacts to. It is NOT a container: Assignment, Payment, OTP,
// Notification, Review and Invoice LISTEN to Booking, they do not live inside it.
//
// PURITY RULE — state.go and statemachine.go must import NOTHING but the standard
// library's fmt/errors. No database, no pgx, no net/http, not even context. This is
// enforced by depguard in .golangci.yml (the Go equivalent of PLAN-P0's ArchUnit rule).
// If the state machine ever "needs" a database to decide whether a transition is legal,
// the design is wrong — the decision has leaked out of the machine.
package booking

// State is one of thirteen. See ROADMAP §7 for why thirteen and not Product.md's
// eighteen: `Provider Requested`, `Provider Accepted` and `No Response` are not booking
// states at all — they are the lifecycle of an OFFER, a separate aggregate. One booking
// generates many offers across three tiers. And `Waiting Start OTP` is not distinct from
// ARRIVED: arrival IS the state of waiting for that OTP.
//
// GO LESSON — this is the closest Go has to an enum, and it is weaker than Java's.
// `type State string` is a defined type, so State and string do not mix. But the const
// block below is not closed: State("BANANA") compiles. That is why Valid() exists, why
// the database carries a CHECK constraint, and why the `exhaustive` linter is mandatory
// for us rather than optional.
type State string

const (
	// The happy path, in order.
	StateDraft              State = "DRAFT"
	StateConfirmed          State = "CONFIRMED"
	StateSearching          State = "SEARCHING"
	StateAssigned           State = "ASSIGNED"
	StateEnRoute            State = "EN_ROUTE"
	StateArrived            State = "ARRIVED"
	StateInProgress         State = "IN_PROGRESS"
	StateAwaitingCompletion State = "AWAITING_COMPLETION"
	StateCompleted          State = "COMPLETED"

	// The four that keep us honest.
	StateEscalated   State = "ESCALATED"   // the human queue (§5.2 Tier 4)
	StateRescheduled State = "RESCHEDULED" // moved to a staffable slot (§5.2 Tier 5)
	StateCancelled   State = "CANCELLED"
	StateFailed      State = "FAILED" // nobody could be found; a credit is issued
)

// Action is a thing a human or the system tries to DO to a booking. Actions are the
// only way a booking's state ever changes.
type Action string

const (
	ActionConfirm           Action = "CONFIRM"
	ActionSearch            Action = "SEARCH"
	ActionAssign            Action = "ASSIGN"
	ActionDepart            Action = "DEPART"
	ActionArrive            Action = "ARRIVE"
	ActionVerifyStart       Action = "VERIFY_START"       // the start OTP checked out
	ActionRequestCompletion Action = "REQUEST_COMPLETION" // technician says the work is done
	ActionVerifyCompletion  Action = "VERIFY_COMPLETION"  // the completion OTP checked out
	ActionResume            Action = "RESUME"             // back into the flow after escalation/reschedule
	ActionEscalate          Action = "ESCALATE"           // hand it to a human
	ActionReschedule        Action = "RESCHEDULE"
	ActionCancel            Action = "CANCEL"
	ActionFail              Action = "FAIL"
)

// AllStates is the closed set. The database CHECK constraint is generated from this, and
// a drift test asserts the two agree — so a state that exists in Go but not in Postgres
// (or vice versa) fails the build rather than failing a customer.
func AllStates() []State {
	return []State{
		StateDraft, StateConfirmed, StateSearching, StateAssigned, StateEnRoute,
		StateArrived, StateInProgress, StateAwaitingCompletion, StateCompleted,
		StateEscalated, StateRescheduled, StateCancelled, StateFailed,
	}
}

// AllActions is the closed set of actions.
func AllActions() []Action {
	return []Action{
		ActionConfirm, ActionSearch, ActionAssign, ActionDepart, ActionArrive,
		ActionVerifyStart, ActionRequestCompletion, ActionVerifyCompletion,
		ActionResume, ActionEscalate, ActionReschedule, ActionCancel, ActionFail,
	}
}

// Valid reports whether s is one of the thirteen.
//
// GO LESSON — this switch is what makes the `exhaustive` linter earn its keep. Add a
// fourteenth State constant and forget to handle it here, and the lint FAILS. It is the
// closest thing Go gives us to Java's compiler-checked enum, and it only works because
// we set default-signifies-exhaustive=false — otherwise a `default:` would silently
// excuse the missing case.
func (state State) Valid() bool {
	switch state {
	case StateDraft, StateConfirmed, StateSearching, StateAssigned, StateEnRoute,
		StateArrived, StateInProgress, StateAwaitingCompletion, StateCompleted,
		StateEscalated, StateRescheduled, StateCancelled, StateFailed:
		return true
	}
	return false
}

// IsTerminal reports whether the booking is finished forever. A terminal booking has no
// legal transitions out of it — not even CANCEL.
//
// CANCELLED is deliberately NOT terminal since the admin console's emergency cancel gained
// its 10-second undo: the compensation is a real ESCALATE transition back into the human
// queue (see statemachine.go). COMPLETED and FAILED stay terminal — both have billed or
// credited the ledger, and a booking that comes back to life after money moved would make
// the append-only ledger lie.
func (state State) IsTerminal() bool {
	switch state {
	case StateCompleted, StateFailed:
		return true
	case StateDraft, StateConfirmed, StateSearching, StateAssigned, StateEnRoute,
		StateArrived, StateInProgress, StateAwaitingCompletion, StateEscalated,
		StateRescheduled, StateCancelled:
		return false
	}
	return false
}

// Valid reports whether a is one of the thirteen actions.
func (action Action) Valid() bool {
	switch action {
	case ActionConfirm, ActionSearch, ActionAssign, ActionDepart, ActionArrive,
		ActionVerifyStart, ActionRequestCompletion, ActionVerifyCompletion,
		ActionResume, ActionEscalate, ActionReschedule, ActionCancel, ActionFail:
		return true
	}
	return false
}

func (state State) String() string   { return string(state) }
func (action Action) String() string { return string(action) }
