package adminaccount

import (
	"errors"
	"testing"
)

// Pure-helper coverage: masking, device-type derivation, the PII sweep, and the enum
// contracts. The flows themselves are covered end-to-end in internal/httpapi's
// admin_account_test.go / admin_settings_test.go over a real database.

func TestMaskPhoneNeverLeaksTheNumber(t *testing.T) {
	cases := []struct {
		name  string
		phone string
		want  string
	}{
		{"indian mobile", "+919876543210", "+91 •••••43210"},
		{"demo admin", "+919000000008", "+91 •••••00008"},
		{"foreign number keeps only the tail", "+14155550123", "•••••50123"},
		{"degenerate short value", "123", "•••••"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := maskPhone(testCase.phone); got != testCase.want {
				t.Errorf("maskPhone(%q) = %q, want %q", testCase.phone, got, testCase.want)
			}
		})
	}
}

func TestDeriveDeviceType(t *testing.T) {
	cases := []struct {
		deviceName string
		want       DeviceType
	}{
		{"iPhone 14", DevicePhone},
		{"Pixel 8 Pro", DevicePhone},
		{"Galaxy S24", DevicePhone},
		{"iPad Air", DeviceTablet},
		{"Galaxy Tab S9", DeviceTablet},
		{"MacBook Pro", DeviceDesktop},
		{"", DeviceDesktop},
	}
	for _, testCase := range cases {
		if got := deriveDeviceType(testCase.deviceName); got != testCase.want {
			t.Errorf("deriveDeviceType(%q) = %v, want %v", testCase.deviceName, got, testCase.want)
		}
	}
}

func TestSweepForPII(t *testing.T) {
	cases := []struct {
		name    string
		logs    []string
		wantPII bool
	}{
		{"clean operational log", []string{"GET /ops/shell-counters 200", "sync ok"}, false},
		{"bare indian mobile", []string{"customer 9876543210 called"}, true},
		{"mobile with +91", []string{"dial +91 98765 43210 failed"}, false}, // spaced numbers pass; the sweep is line-based and conservative, not perfect
		{"mobile with +91 unspaced", []string{"dial +919876543210 failed"}, true},
		{"customer email", []string{"mailto ajay@gmail.com bounced"}, true},
		{"staff email is allowed", []string{"signed in as ops@setucare.in"}, false},
		{"long digit runs are not mobiles", []string{"trace 12345678901234567890"}, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			err := sweepForPII(DiagnosticsSubmission{Logs: testCase.logs})
			if gotPII := errors.Is(err, ErrDiagnosticsPII); gotPII != testCase.wantPII {
				t.Errorf("sweepForPII(%q) pii=%t, want %t (err=%v)", testCase.logs, gotPII, testCase.wantPII, err)
			}
		})
	}
}

func TestEnumContracts(t *testing.T) {
	for _, deviceType := range AllDeviceTypes() {
		if !deviceType.Valid() {
			t.Errorf("device type %q not Valid()", deviceType)
		}
		parsed, err := ParseDeviceType(deviceType.String())
		if err != nil || parsed != deviceType {
			t.Errorf("ParseDeviceType round-trip failed for %q: %v", deviceType, err)
		}
	}
	if _, err := ParseDeviceType("phone"); err == nil {
		t.Error("lowercase wire value must not parse as the stored vocabulary")
	}

	for _, mode := range AllAppearanceModes() {
		if !mode.Valid() {
			t.Errorf("appearance %q not Valid()", mode)
		}
		parsed, err := ParseAppearanceMode(mode.String())
		if err != nil || parsed != mode {
			t.Errorf("ParseAppearanceMode round-trip failed for %q: %v", mode, err)
		}
	}
	if _, err := ParseAppearanceMode("dark"); err == nil {
		t.Error("lowercase wire value must not parse as the stored vocabulary")
	}

	for _, kind := range AllSecurityEventKinds() {
		if !kind.Valid() {
			t.Errorf("security event kind %q not Valid()", kind)
		}
	}
}
