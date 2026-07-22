package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// The admin's own account: profile and preferences, notification channels, device and session
// security, the build it is running, and the diagnostics upload support asks for.

func (handler *AdminHandler) registerAdminSettings(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "adminSubmitDiagnostics", Method: http.MethodPost, Path: "/admin/diagnostics",
		Summary: "Upload diagnostics for support", Tags: []string{"Admin Settings"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		DefaultStatus: http.StatusAccepted,
		Responses: adminResponses(api,
			adminResponse{"422", "Rejected — the payload carried customer PII", adminError{}},
		),
	}, handler.submitDiagnostics)

	huma.Register(api, huma.Operation{
		OperationID: "adminGetProfile", Method: http.MethodGet, Path: "/admin/profile",
		Summary: "Get the signed-in admin's profile", Tags: []string{"Admin Settings"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.getProfile)

	huma.Register(api, huma.Operation{
		OperationID: "adminUpdateProfile", Method: http.MethodPut, Path: "/admin/profile",
		Summary: "Update the admin's preferences", Tags: []string{"Admin Settings"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"200", "OK — the whole updated object", adminProfile{}},
		),
	}, handler.updateProfile)

	huma.Register(api, huma.Operation{
		OperationID: "adminQueuedActionsCount", Method: http.MethodGet, Path: "/admin/queued-actions/count",
		Summary: "Count unsynced offline actions", Tags: []string{"Admin Settings"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.queuedActionsCount)

	huma.Register(api, huma.Operation{
		OperationID: "adminGetNotificationSettings", Method: http.MethodGet, Path: "/admin/settings/notifications",
		Summary: "Get notification channels and quiet hours", Tags: []string{"Admin Settings"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.getNotificationSettings)

	huma.Register(api, huma.Operation{
		OperationID: "adminUpdateNotificationSettings", Method: http.MethodPut, Path: "/admin/settings/notifications",
		Summary: "Update the configurable notification channels", Tags: []string{"Admin Settings"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"200", "OK — the whole updated object, so the optimistic update settles on the server's copy", notificationSettings{}},
			adminResponse{"422", "A critical channel was sent; those are not preferences", adminError{}},
		),
	}, handler.updateNotificationSettings)

	huma.Register(api, huma.Operation{
		OperationID: "adminGetSecuritySettings", Method: http.MethodGet, Path: "/admin/settings/security",
		Summary: "Get biometric, device and session security state", Tags: []string{"Admin Settings"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.getSecuritySettings)

	huma.Register(api, huma.Operation{
		OperationID: "adminUpdateSecuritySettings", Method: http.MethodPatch, Path: "/admin/settings/security",
		Summary: "Toggle biometric unlock", Tags: []string{"Admin Settings"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api,
			adminResponse{"200", "OK — the whole updated object", securitySettings{}},
		),
	}, handler.updateSecuritySettings)

	huma.Register(api, huma.Operation{
		OperationID: "adminAppVersion", Method: http.MethodGet, Path: "/admin/version",
		Summary: "App, build, environment and OTA bundle", Tags: []string{"Admin Settings"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.version)

	// The two alert tiers the settings screen reasons about are vocabularies rather than fields:
	// the stored channel map is keyed by name, and the critical four are never stored at all.
	// Register them so the contract still names the closed sets.
	registerAdminEnums(api, configurableChannel(""), criticalChannel(""))
}

// registerAdminEnums puts vocabularies that no payload field references into the component list.
func registerAdminEnums(api huma.API, enums ...huma.SchemaProvider) {
	registry := api.OpenAPI().Components.Schemas
	for _, enum := range enums {
		enum.Schema(registry)
	}
}

// ------------------------------------------------------------------ profile

// appearanceMode is the console's theme preference.
type appearanceMode string

const (
	appearanceModeLight  appearanceMode = "light"
	appearanceModeDark   appearanceMode = "dark"
	appearanceModeSystem appearanceMode = "system"
)

// Schema names the appearance vocabulary in the generated document.
func (appearanceMode) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "AppearanceMode", "",
		string(appearanceModeLight), string(appearanceModeDark), string(appearanceModeSystem))
}

type adminPreferences struct {
	Appearance          appearanceMode `json:"appearance" required:"true"`
	DefaultLandingRoute string         `json:"defaultLandingRoute" required:"true"`
	Haptics             bool           `json:"haptics" required:"true"`
}

// adminActivitySummary is the operator's own scoreboard on the profile screen.
type adminActivitySummary struct {
	Actions                 int32 `json:"actions" required:"true"`
	AverageAcknowledgeMs    int64 `json:"averageAcknowledgeMs" required:"true"`
	BookingsRescued         int32 `json:"bookingsRescued" required:"true"`
	EscalationsAcknowledged int32 `json:"escalationsAcknowledged" required:"true"`
}

type adminProfile struct {
	Activity    adminActivitySummary `json:"activity" required:"true"`
	AdminID     string               `json:"adminId" required:"true"`
	Email       string               `json:"email" required:"true"`
	JoinedIso   time.Time            `json:"joinedIso" required:"true"`
	MaskedPhone string               `json:"maskedPhone" required:"true" doc:"Masked at the source. The full number is never sent to this client."`
	Name        string               `json:"name" required:"true"`
	Preferences adminPreferences     `json:"preferences" required:"true"`
	Role        string               `json:"role" required:"true"`
}

// updateAdminProfileRequest round-trips the preferences. Name, email, phone and role are not
// editable here.
type updateAdminProfileRequest struct {
	Preferences adminPreferences `json:"preferences" required:"true"`
}

type adminProfileOutput struct {
	Body adminProfile
}

func (handler *AdminHandler) getProfile(_ context.Context, _ *struct{}) (*adminProfileOutput, error) {
	return nil, notImplemented("adminGetProfile")
}

type adminUpdateProfileInput struct {
	AdminIdempotency
	Body updateAdminProfileRequest
}

func (handler *AdminHandler) updateProfile(_ context.Context, _ *adminUpdateProfileInput) (*adminProfileOutput, error) {
	return nil, notImplemented("adminUpdateProfile")
}

// queuedActionsCount is the unsynced offline actions, so the sign-out confirm can name how many
// will be discarded.
type queuedActionsCount struct {
	Count int32 `json:"count" required:"true"`
}

type queuedActionsCountOutput struct {
	Body queuedActionsCount
}

func (handler *AdminHandler) queuedActionsCount(_ context.Context, _ *struct{}) (*queuedActionsCountOutput, error) {
	return nil, notImplemented("adminQueuedActionsCount")
}

// ------------------------------------------------------------ notifications

// clockTime is a wall-clock time of day, HH:mm in IST. Quiet hours and the digest are not tied to
// a date, so they are not instants.
type clockTime string

// Schema names the wall-clock format in the generated document.
func (clockTime) Schema(registry huma.Registry) *huma.Schema {
	return adminNamedSchema(registry, "ClockTime", func() *huma.Schema {
		return &huma.Schema{
			Type:        huma.TypeString,
			Description: "A wall-clock time of day, HH:mm in IST. Quiet hours and the digest are not tied to a date, so they are not instants.",
			Pattern:     `^([01][0-9]|2[0-3]):[0-5][0-9]$`,
		}
	})
}

// configurableChannel is the tier of alerts an operator may silence.
type configurableChannel string

const (
	configurableChannelSLAAtRisk          configurableChannel = "slaAtRisk"
	configurableChannelProviderNoShow     configurableChannel = "providerNoShow"
	configurableChannelZoneSupplyCritical configurableChannel = "zoneSupplyCritical"
	configurableChannelPaymentFailure     configurableChannel = "paymentFailure"
	configurableChannelNewApplications    configurableChannel = "newApplications"
	configurableChannelAutoSuspensions    configurableChannel = "autoSuspensions"
	configurableChannelDocumentExpiring   configurableChannel = "documentExpiring"
	configurableChannelDailySummary       configurableChannel = "dailySummary"
)

// Schema names the configurable-channel vocabulary in the generated document.
func (configurableChannel) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "ConfigurableChannel", "",
		string(configurableChannelSLAAtRisk), string(configurableChannelProviderNoShow),
		string(configurableChannelZoneSupplyCritical), string(configurableChannelPaymentFailure),
		string(configurableChannelNewApplications), string(configurableChannelAutoSuspensions),
		string(configurableChannelDocumentExpiring), string(configurableChannelDailySummary))
}

// criticalChannel is the four alert types that cannot be silenced. They are NOT preferences: they
// carry no stored value and must be rejected if sent in an update.
type criticalChannel string

const (
	criticalChannelBookingEscalated criticalChannel = "bookingEscalated"
	criticalChannelAssignmentFailed criticalChannel = "assignmentFailed"
	criticalChannelSLABreached      criticalChannel = "slaBreached"
	criticalChannelBookingDisputed  criticalChannel = "bookingDisputed"
)

// Schema names the critical-channel vocabulary in the generated document.
func (criticalChannel) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "CriticalChannel",
		"The four alert types that cannot be silenced. They are NOT preferences: they carry no stored value and must be rejected if sent in an update.",
		string(criticalChannelBookingEscalated), string(criticalChannelAssignmentFailed),
		string(criticalChannelSLABreached), string(criticalChannelBookingDisputed))
}

// notificationChannelSettings stores only the CONFIGURABLE tier — one key per ConfigurableChannel.
type notificationChannelSettings struct {
	AutoSuspensions    bool `json:"autoSuspensions" required:"true"`
	DailySummary       bool `json:"dailySummary" required:"true"`
	DocumentExpiring   bool `json:"documentExpiring" required:"true"`
	NewApplications    bool `json:"newApplications" required:"true"`
	PaymentFailure     bool `json:"paymentFailure" required:"true"`
	ProviderNoShow     bool `json:"providerNoShow" required:"true"`
	SLAAtRisk          bool `json:"slaAtRisk" required:"true"`
	ZoneSupplyCritical bool `json:"zoneSupplyCritical" required:"true"`
}

type quietHours struct {
	Enabled bool      `json:"enabled" required:"true"`
	From    clockTime `json:"from" required:"true"`
	To      clockTime `json:"to" required:"true"`
}

type notificationSettings struct {
	Channels               notificationChannelSettings `json:"channels" required:"true"`
	CriticalSound          string                      `json:"criticalSound" required:"true"`
	DigestTime             clockTime                   `json:"digestTime" required:"true"`
	QueuedDuringQuietHours int32                       `json:"queuedDuringQuietHours" required:"true" doc:"Informational and operational alerts held back by quiet hours, waiting to be batched."`
	QuietHours             quietHours                  `json:"quietHours" required:"true"`
	Vibrate                bool                        `json:"vibrate" required:"true"`
}

// updateNotificationSettingsRequest carries the whole configurable object. The four critical
// channels are not accepted here; sending them is a 422.
type updateNotificationSettingsRequest struct {
	Channels      notificationChannelSettings `json:"channels" required:"true"`
	CriticalSound string                      `json:"criticalSound" required:"true"`
	DigestTime    clockTime                   `json:"digestTime" required:"true"`
	QuietHours    quietHours                  `json:"quietHours" required:"true"`
	Vibrate       bool                        `json:"vibrate" required:"true"`
}

type notificationSettingsOutput struct {
	Body notificationSettings
}

func (handler *AdminHandler) getNotificationSettings(_ context.Context, _ *struct{}) (*notificationSettingsOutput, error) {
	return nil, notImplemented("adminGetNotificationSettings")
}

type adminUpdateNotificationSettingsInput struct {
	AdminIdempotency
	Body updateNotificationSettingsRequest
}

func (handler *AdminHandler) updateNotificationSettings(_ context.Context, _ *adminUpdateNotificationSettingsInput) (*notificationSettingsOutput, error) {
	return nil, notImplemented("adminUpdateNotificationSettings")
}

// ---------------------------------------------------------------- security

// deviceKind is the glyph the security screen's device row draws.
type deviceKind string

const (
	deviceKindPhone  deviceKind = "phone"
	deviceKindTablet deviceKind = "tablet"
)

// Schema names the device-kind vocabulary in the generated document.
func (deviceKind) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "DeviceKind", "",
		string(deviceKindPhone), string(deviceKindTablet))
}

// trustedDevice is the security screen's device row. Distinct from authTrustedDevice, which is
// what the sign-in flows render.
type trustedDevice struct {
	ID          string     `json:"id" required:"true"`
	IsCurrent   bool       `json:"isCurrent" required:"true"`
	Kind        deviceKind `json:"kind" required:"true"`
	LastUsedIso time.Time  `json:"lastUsedIso" required:"true"`
	Location    string     `json:"location" required:"true"`
	Name        string     `json:"name" required:"true"`
}

type securityEventKind string

const (
	securityEventKindSignedIn        securityEventKind = "signedIn"
	securityEventKindFailedSignIn    securityEventKind = "failedSignIn"
	securityEventKindDeviceTrusted   securityEventKind = "deviceTrusted"
	securityEventKindPasswordChanged securityEventKind = "passwordChanged"
)

// Schema names the security-event vocabulary in the generated document.
func (securityEventKind) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "SecurityEventKind", "",
		string(securityEventKindSignedIn), string(securityEventKindFailedSignIn),
		string(securityEventKindDeviceTrusted), string(securityEventKindPasswordChanged))
}

type securityEvent struct {
	AtIso    time.Time         `json:"atIso" required:"true"`
	Device   *string           `json:"device" required:"true" doc:"Null where the event came from a device the account does not recognise. The console renders 'unknown' itself — never a server-supplied placeholder string."`
	ID       string            `json:"id" required:"true"`
	Kind     securityEventKind `json:"kind" required:"true"`
	Location *string           `json:"location" required:"true"`
}

type securitySettings struct {
	ActiveSessions       int32           `json:"activeSessions" required:"true"`
	BiometricUnlock      bool            `json:"biometricUnlock" required:"true"`
	DeviceLimit          int32           `json:"deviceLimit" required:"true"`
	Devices              []trustedDevice `json:"devices" required:"true" nullable:"false"`
	Events               []securityEvent `json:"events" required:"true" nullable:"false"`
	PasswordChangedAtIso time.Time       `json:"passwordChangedAtIso" required:"true"`
}

// updateSecuritySettingsRequest toggles biometric unlock only. Disabling it tightens the idle lock
// to 10 minutes — server-enforced policy, not a client default.
type updateSecuritySettingsRequest struct {
	BiometricUnlock bool `json:"biometricUnlock" required:"true"`
}

type securitySettingsOutput struct {
	Body securitySettings
}

func (handler *AdminHandler) getSecuritySettings(_ context.Context, _ *struct{}) (*securitySettingsOutput, error) {
	return nil, notImplemented("adminGetSecuritySettings")
}

type adminUpdateSecuritySettingsInput struct {
	AdminIdempotency
	Body updateSecuritySettingsRequest
}

func (handler *AdminHandler) updateSecuritySettings(_ context.Context, _ *adminUpdateSecuritySettingsInput) (*securitySettingsOutput, error) {
	return nil, notImplemented("adminUpdateSecuritySettings")
}

// ------------------------------------------------- diagnostics and versions

// diagnosticsRequest must be rejected by the server if it carries customer PII; the consent
// notice in the UI states exactly this.
type diagnosticsRequest struct {
	AppVersion    string   `json:"appVersion" required:"true"`
	DeviceModel   string   `json:"deviceModel" required:"true"`
	Logs          []string `json:"logs" required:"true" nullable:"false"`
	NetworkEvents []string `json:"networkEvents" required:"true" nullable:"false" doc:"The last 200 network events, redacted."`
	OsVersion     string   `json:"osVersion" required:"true"`
	OtaBundle     string   `json:"otaBundle,omitempty"`
}

type diagnosticsReceipt struct {
	Reference   string    `json:"reference" required:"true"`
	SubmittedAt time.Time `json:"submittedAt" required:"true"`
}

type adminSubmitDiagnosticsInput struct {
	AdminIdempotency
	Body diagnosticsRequest
}

type diagnosticsReceiptOutput struct {
	Body diagnosticsReceipt
}

func (handler *AdminHandler) submitDiagnostics(_ context.Context, _ *adminSubmitDiagnosticsInput) (*diagnosticsReceiptOutput, error) {
	return nil, notImplemented("adminSubmitDiagnostics")
}

type appVersion struct {
	App         string `json:"app" required:"true"`
	Build       string `json:"build" required:"true"`
	Bundle      string `json:"bundle" required:"true" doc:"OTA bundle id."`
	Environment string `json:"environment" required:"true"`
}

type appVersionOutput struct {
	Body appVersion
}

func (handler *AdminHandler) version(_ context.Context, _ *struct{}) (*appVersionOutput, error) {
	return nil, notImplemented("adminAppVersion")
}
