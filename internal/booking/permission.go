package booking

import "github.com/kokkondaBhanuteja/sethu-care/internal/identity"

// CanPerform reports whether a role is permitted to perform an action at all. This is the
// ROLE half of authorization; OWNERSHIP (acting only on your own booking, or a job assigned
// to you) is enforced separately in Apply, because it depends on the booking row.
//
// ADMIN may perform any action — ops runs the business and needs to drive every transition
// by hand. Everyone else is restricted to the actions their part of the flow owns:
//   - CUSTOMER confirms, cancels, or reschedules their booking.
//   - TECHNICIAN moves the job through the field: departs, arrives, the OTP steps, and may
//     escalate when something on site blocks them.
//   - SEARCH, ASSIGN, FAIL and RESUME are ops-only (dispatch and recovery).
//
// GO LESSON — the switch is watched by the `exhaustive` linter. Add a 14th Action and the
// build fails here until you decide, explicitly, which roles may perform it. Authorization
// can never silently default-open for a new action.
func CanPerform(role identity.Role, action Action) bool {
	if role == identity.RoleAdmin {
		return true
	}
	switch action {
	case ActionConfirm, ActionCancel, ActionReschedule:
		return role == identity.RoleCustomer
	case ActionDepart, ActionArrive, ActionVerifyStart, ActionRequestCompletion, ActionVerifyCompletion, ActionEscalate:
		return role == identity.RoleTechnician
	case ActionSearch, ActionAssign, ActionFail, ActionResume:
		return false // admin-only; admin already returned true above
	}
	return false
}
