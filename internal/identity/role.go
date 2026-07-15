// Package identity owns users and the salaried technicians among them.
package identity

import "fmt"

// Role is who someone is. Persisted as TEXT with a CHECK constraint on users.role; the
// drift test in internal/schema proves the two agree.
type Role string

const (
	RoleCustomer   Role = "CUSTOMER"
	RoleTechnician Role = "TECHNICIAN"
	RoleAdmin      Role = "ADMIN"
)

// AllRoles is the closed set. The DB CHECK constraint is verified against this.
func AllRoles() []Role { return []Role{RoleCustomer, RoleTechnician, RoleAdmin} }

// Valid — the switch the `exhaustive` linter watches.
func (role Role) Valid() bool {
	switch role {
	case RoleCustomer, RoleTechnician, RoleAdmin:
		return true
	}
	return false
}

func (role Role) String() string { return string(role) }

// ParseRole is the only place a raw string may become a Role.
func ParseRole(s string) (Role, error) {
	role := Role(s)
	if !role.Valid() {
		return "", fmt.Errorf("identity: unknown role %q", s)
	}
	return role, nil
}
