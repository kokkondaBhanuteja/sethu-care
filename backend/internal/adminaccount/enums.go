package adminaccount

import "fmt"

// DeviceType is the kind of device an admin signs in from, persisted on admin_devices and
// pinned to the DB CHECK by internal/schema's drift test. The console's wire vocabulary is
// lowercase ("phone"); the transport layer maps — the stored values follow the repo's
// UPPER_SNAKE enum convention.
type DeviceType string

const (
	DevicePhone   DeviceType = "PHONE"
	DeviceTablet  DeviceType = "TABLET"
	DeviceDesktop DeviceType = "DESKTOP"
)

// AllDeviceTypes lists every device type, in declaration order. The drift test asserts this
// set equals the admin_devices.device_type CHECK constraint.
func AllDeviceTypes() []DeviceType {
	return []DeviceType{DevicePhone, DeviceTablet, DeviceDesktop}
}

func (deviceType DeviceType) Valid() bool {
	switch deviceType {
	case DevicePhone, DeviceTablet, DeviceDesktop:
		return true
	}
	return false
}

func (deviceType DeviceType) String() string { return string(deviceType) }

// ParseDeviceType validates a raw string at a trust boundary (a value read back from storage).
func ParseDeviceType(raw string) (DeviceType, error) {
	deviceType := DeviceType(raw)
	if !deviceType.Valid() {
		return "", fmt.Errorf("adminaccount: unknown device type %q", raw)
	}
	return deviceType, nil
}

// AppearanceMode is the console's stored theme preference, persisted on
// admin_settings.appearance and pinned to the DB CHECK by the drift test. As with
// DeviceType, the wire value is lowercase and the transport layer maps.
type AppearanceMode string

const (
	AppearanceLight  AppearanceMode = "LIGHT"
	AppearanceDark   AppearanceMode = "DARK"
	AppearanceSystem AppearanceMode = "SYSTEM"
)

// AllAppearanceModes lists every appearance mode, in declaration order. The drift test
// asserts this set equals the admin_settings.appearance CHECK constraint.
func AllAppearanceModes() []AppearanceMode {
	return []AppearanceMode{AppearanceLight, AppearanceDark, AppearanceSystem}
}

func (mode AppearanceMode) Valid() bool {
	switch mode {
	case AppearanceLight, AppearanceDark, AppearanceSystem:
		return true
	}
	return false
}

func (mode AppearanceMode) String() string { return string(mode) }

// ParseAppearanceMode validates a raw string at a trust boundary.
func ParseAppearanceMode(raw string) (AppearanceMode, error) {
	mode := AppearanceMode(raw)
	if !mode.Valid() {
		return "", fmt.Errorf("adminaccount: unknown appearance mode %q", raw)
	}
	return mode, nil
}

// SecurityEventKind is the closed set of events the security screen renders. These are not
// persisted as a column — they are derived from the audit-log action names the sign-in
// flows record — so there is no DB CHECK to drift from.
type SecurityEventKind string

const (
	EventSignedIn        SecurityEventKind = "SIGNED_IN"
	EventFailedSignIn    SecurityEventKind = "FAILED_SIGN_IN"
	EventDeviceTrusted   SecurityEventKind = "DEVICE_TRUSTED"
	EventPasswordChanged SecurityEventKind = "PASSWORD_CHANGED"
)

// AllSecurityEventKinds lists every security event kind, in declaration order.
func AllSecurityEventKinds() []SecurityEventKind {
	return []SecurityEventKind{EventSignedIn, EventFailedSignIn, EventDeviceTrusted, EventPasswordChanged}
}

func (kind SecurityEventKind) Valid() bool {
	switch kind {
	case EventSignedIn, EventFailedSignIn, EventDeviceTrusted, EventPasswordChanged:
		return true
	}
	return false
}

func (kind SecurityEventKind) String() string { return string(kind) }
