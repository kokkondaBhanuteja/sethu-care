package adminaccount

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// The settings half of the aggregate: profile preferences, notification channels, security
// state, and diagnostics uploads. Reads tolerate a missing settings row (the declared
// defaults) and — for GETs only — a token whose user has no admin account at all, so a
// legacy staff ADMIN token still gets an honest, empty answer instead of a 404.

var (
	// ErrInvalidSetting — a settings value outside its declared shape (a malformed HH:mm,
	// an unknown appearance). The request parsed but cannot be applied: a 422.
	ErrInvalidSetting = errors.New("adminaccount: invalid settings value")
	// ErrDiagnosticsPII — the diagnostics payload carried what looks like customer PII
	// (a phone number or a non-staff email). Rejected outright, per the consent notice.
	ErrDiagnosticsPII = errors.New("adminaccount: diagnostics payload carries personal data")
)

// clockTimePattern pins the HH:mm wall-clock format the contract declares.
var clockTimePattern = regexp.MustCompile(`^([01][0-9]|2[0-3]):[0-5][0-9]$`)

// The PII sweep over diagnostics payloads. Deliberately conservative: an Indian mobile
// (with or without +91) or any email that is not a @setucare.in staff address rejects the
// upload — a false positive costs a re-submission, a false negative leaks customer data.
var (
	mobilePIIPattern = regexp.MustCompile(`(^|[^0-9])(\+?91[\-\s]?)?[6-9][0-9]{9}([^0-9]|$)`)
	emailPIIPattern  = regexp.MustCompile(`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`)
	staffEmailSuffix = "@setucare.in"
)

// Preferences is the profile screen's editable slice.
type Preferences struct {
	Appearance          AppearanceMode
	Haptics             bool
	DefaultLandingRoute string
}

// Activity is the operator's profile scoreboard. Actions and BookingsRescued are real
// audit-log counts; the acknowledge metrics have no engine yet and stay honest zeros.
type Activity struct {
	Actions                 int32
	EscalationsAcknowledged int32
	AverageAcknowledgeMs    int64
	BookingsRescued         int32
}

// Profile is the signed-in admin's own record. Provisioned is false when the bearer token
// names a user without an admin_accounts row — identity fields are then honest empties.
type Profile struct {
	Account     Account
	Preferences Preferences
	Activity    Activity
	Provisioned bool
}

// ChannelSettings is the configurable notification tier — one field per channel, so a
// critical channel cannot even be represented here.
type ChannelSettings struct {
	SLAAtRisk          bool
	ProviderNoShow     bool
	ZoneSupplyCritical bool
	PaymentFailure     bool
	NewApplications    bool
	AutoSuspensions    bool
	DocumentExpiring   bool
	DailySummary       bool
}

// QuietHours is the IST wall-clock window informational alerts wait out.
type QuietHours struct {
	Enabled bool
	From    string
	To      string
}

// NotificationSettings is the whole stored object the console round-trips.
// QueuedDuringQuietHours is served as an honest 0 — no queueing engine exists yet.
type NotificationSettings struct {
	Channels               ChannelSettings
	CriticalSound          string
	DigestTime             string
	QuietHours             QuietHours
	Vibrate                bool
	QueuedDuringQuietHours int32
}

// SecurityEvent is one row of the security screen's recent-events feed, derived from the
// audit entries the sign-in flows record. Device is nil when the event named no device;
// Location is nil always — there is no geo-IP lookup yet.
type SecurityEvent struct {
	ID       uuid.UUID
	Kind     SecurityEventKind
	Device   *string
	Location *string
	At       time.Time
}

// SecuritySnapshot is the security screen in one read.
type SecuritySnapshot struct {
	BiometricUnlock   bool
	Devices           []Device
	DeviceLimit       int32
	ActiveSessions    int32
	PasswordChangedAt time.Time
	Events            []SecurityEvent
}

// DiagnosticsSubmission is a support upload as received.
type DiagnosticsSubmission struct {
	AppVersion    string
	DeviceModel   string
	OsVersion     string
	OtaBundle     string
	Logs          []string
	NetworkEvents []string
}

// DiagnosticsReceipt is what support quotes back.
type DiagnosticsReceipt struct {
	Reference   string
	SubmittedAt time.Time
}

func defaultPreferences() Preferences {
	return Preferences{Appearance: AppearanceSystem, Haptics: true, DefaultLandingRoute: "/live"}
}

func defaultNotificationSettings() NotificationSettings {
	return NotificationSettings{
		Channels: ChannelSettings{
			SLAAtRisk: true, ProviderNoShow: true, ZoneSupplyCritical: true, PaymentFailure: true,
			NewApplications: true, AutoSuspensions: true, DocumentExpiring: true, DailySummary: true,
		},
		CriticalSound: "default",
		DigestTime:    "08:00",
		QuietHours:    QuietHours{Enabled: false, From: "22:00", To: "07:00"},
		Vibrate:       true,
	}
}

// Profile returns the caller's profile. A missing settings row reads as the defaults; a
// missing account row reads as an unprovisioned profile rather than an error, so the
// operation stays serveable for any ADMIN bearer.
func (service *Service) Profile(ctx context.Context, userID uuid.UUID) (Profile, error) {
	profile := Profile{Preferences: defaultPreferences()}

	accountRow, err := service.accountByUserID(ctx, userID)
	switch {
	case err == nil:
		profile.Account = accountOf(accountRow)
		profile.Provisioned = true
		preferences, err := service.storedPreferences(ctx, accountRow.ID)
		if err != nil {
			return Profile{}, err
		}
		profile.Preferences = preferences
	case errors.Is(err, ErrAccountNotFound):
		profile.Account = Account{UserID: userID}
	default:
		return Profile{}, err
	}

	activityRow, err := sqlcgen.New(service.pool).CountAdminActivity(ctx, &userID)
	if err != nil {
		return Profile{}, fmt.Errorf("counting activity: %w", err)
	}
	profile.Activity = Activity{
		Actions:         int32(activityRow.Actions),
		BookingsRescued: int32(activityRow.BookingsRescued),
	}
	return profile, nil
}

// UpdatePreferences stores the profile preferences and returns the whole updated profile.
func (service *Service) UpdatePreferences(ctx context.Context, userID uuid.UUID, preferences Preferences) (Profile, error) {
	if !preferences.Appearance.Valid() {
		return Profile{}, fmt.Errorf("%w: unknown appearance %q", ErrInvalidSetting, preferences.Appearance)
	}
	if preferences.DefaultLandingRoute == "" || !strings.HasPrefix(preferences.DefaultLandingRoute, "/") {
		return Profile{}, fmt.Errorf("%w: defaultLandingRoute must be an absolute route", ErrInvalidSetting)
	}
	accountRow, err := service.accountByUserID(ctx, userID)
	if err != nil {
		return Profile{}, err
	}
	if err := sqlcgen.New(service.pool).UpsertAdminPreferences(ctx, sqlcgen.UpsertAdminPreferencesParams{
		AdminAccountID:      accountRow.ID,
		Appearance:          string(preferences.Appearance),
		Haptics:             preferences.Haptics,
		DefaultLandingRoute: preferences.DefaultLandingRoute,
	}); err != nil {
		return Profile{}, fmt.Errorf("storing preferences: %w", err)
	}
	return service.Profile(ctx, userID)
}

// NotificationSettings returns the stored object, or the declared defaults where no row
// (or no account) exists yet.
func (service *Service) NotificationSettings(ctx context.Context, userID uuid.UUID) (NotificationSettings, error) {
	accountRow, err := service.accountByUserID(ctx, userID)
	if errors.Is(err, ErrAccountNotFound) {
		return defaultNotificationSettings(), nil
	}
	if err != nil {
		return NotificationSettings{}, err
	}
	settingsRow, err := sqlcgen.New(service.pool).GetAdminSettings(ctx, accountRow.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return defaultNotificationSettings(), nil
	}
	if err != nil {
		return NotificationSettings{}, fmt.Errorf("reading settings: %w", err)
	}
	return notificationSettingsOf(settingsRow), nil
}

// UpdateNotificationSettings stores the whole configurable object and returns the stored
// copy, so the console's optimistic update settles on the server's answer.
func (service *Service) UpdateNotificationSettings(ctx context.Context, userID uuid.UUID, settings NotificationSettings) (NotificationSettings, error) {
	for field, value := range map[string]string{
		"digestTime":      settings.DigestTime,
		"quietHours.from": settings.QuietHours.From,
		"quietHours.to":   settings.QuietHours.To,
	} {
		if !clockTimePattern.MatchString(value) {
			return NotificationSettings{}, fmt.Errorf("%w: %s must be HH:mm, got %q", ErrInvalidSetting, field, value)
		}
	}
	if settings.CriticalSound == "" {
		return NotificationSettings{}, fmt.Errorf("%w: criticalSound must not be empty", ErrInvalidSetting)
	}
	accountRow, err := service.accountByUserID(ctx, userID)
	if err != nil {
		return NotificationSettings{}, err
	}
	if err := sqlcgen.New(service.pool).UpsertAdminNotificationSettings(ctx, sqlcgen.UpsertAdminNotificationSettingsParams{
		AdminAccountID:            accountRow.ID,
		ChannelSlaAtRisk:          settings.Channels.SLAAtRisk,
		ChannelProviderNoShow:     settings.Channels.ProviderNoShow,
		ChannelZoneSupplyCritical: settings.Channels.ZoneSupplyCritical,
		ChannelPaymentFailure:     settings.Channels.PaymentFailure,
		ChannelNewApplications:    settings.Channels.NewApplications,
		ChannelAutoSuspensions:    settings.Channels.AutoSuspensions,
		ChannelDocumentExpiring:   settings.Channels.DocumentExpiring,
		ChannelDailySummary:       settings.Channels.DailySummary,
		CriticalSound:             settings.CriticalSound,
		DigestTime:                settings.DigestTime,
		QuietHoursFrom:            settings.QuietHours.From,
		QuietHoursTo:              settings.QuietHours.To,
		QuietHoursEnabled:         settings.QuietHours.Enabled,
		Vibrate:                   settings.Vibrate,
	}); err != nil {
		return NotificationSettings{}, fmt.Errorf("storing notification settings: %w", err)
	}
	return service.NotificationSettings(ctx, userID)
}

// SecuritySnapshot assembles the security screen: the stored biometric flag, the device
// rows, session bookkeeping, and the recent events read back from the audit log.
func (service *Service) SecuritySnapshot(ctx context.Context, userID uuid.UUID) (SecuritySnapshot, error) {
	snapshot := SecuritySnapshot{
		DeviceLimit: MaxTrustedDevices,
		Devices:     []Device{},
		Events:      []SecurityEvent{},
	}
	accountRow, err := service.accountByUserID(ctx, userID)
	if errors.Is(err, ErrAccountNotFound) {
		return snapshot, nil
	}
	if err != nil {
		return SecuritySnapshot{}, err
	}
	snapshot.PasswordChangedAt = timeOf(accountRow.PasswordChangedAt)

	queries := sqlcgen.New(service.pool)
	settingsRow, err := queries.GetAdminSettings(ctx, accountRow.ID)
	if err == nil {
		snapshot.BiometricUnlock = settingsRow.BiometricUnlock
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return SecuritySnapshot{}, fmt.Errorf("reading settings: %w", err)
	}

	deviceRows, err := queries.ListAdminSecurityDevices(ctx, accountRow.ID)
	if err != nil {
		return SecuritySnapshot{}, fmt.Errorf("listing devices: %w", err)
	}
	snapshot.Devices = securityDevicesOf(deviceRows)

	signedIn, err := queries.CountSignedInAdminDevices(ctx, accountRow.ID)
	if err != nil {
		return SecuritySnapshot{}, fmt.Errorf("counting sessions: %w", err)
	}
	snapshot.ActiveSessions = int32(signedIn)

	eventRows, err := queries.ListAdminSecurityEvents(ctx, sqlcgen.ListAdminSecurityEventsParams{
		EntityID: accountRow.ID,
		Actions: []string{
			auditActionSignedIn, auditActionSignInFailed,
			auditActionDeviceTrusted, auditActionPasswordChanged,
		},
		RowLimit: securityEventLimit,
	})
	if err != nil {
		return SecuritySnapshot{}, fmt.Errorf("listing security events: %w", err)
	}
	snapshot.Events = securityEventsOf(eventRows)
	return snapshot, nil
}

// SetBiometricUnlock flips the one editable security flag and returns the fresh snapshot.
// The tightened idle lock the spec attaches to opting out is a client-enforced timer today;
// the server stores the flag it derives from — an honest, documented seam.
func (service *Service) SetBiometricUnlock(ctx context.Context, userID uuid.UUID, enabled bool) (SecuritySnapshot, error) {
	accountRow, err := service.accountByUserID(ctx, userID)
	if err != nil {
		return SecuritySnapshot{}, err
	}
	if err := sqlcgen.New(service.pool).SetAdminBiometricUnlock(ctx, sqlcgen.SetAdminBiometricUnlockParams{
		AdminAccountID:  accountRow.ID,
		BiometricUnlock: enabled,
	}); err != nil {
		return SecuritySnapshot{}, fmt.Errorf("storing biometric flag: %w", err)
	}
	return service.SecuritySnapshot(ctx, userID)
}

// SubmitDiagnostics stores a support upload after the PII sweep. The unique
// (account, Idempotency-Key) index makes replays return the first receipt.
func (service *Service) SubmitDiagnostics(ctx context.Context, userID uuid.UUID, idempotencyKey string, submission DiagnosticsSubmission) (DiagnosticsReceipt, error) {
	accountRow, err := service.accountByUserID(ctx, userID)
	if err != nil {
		return DiagnosticsReceipt{}, err
	}
	if err := sweepForPII(submission); err != nil {
		return DiagnosticsReceipt{}, err
	}

	queries := sqlcgen.New(service.pool)
	if existing, err := queries.GetAdminDiagnosticsByKey(ctx, sqlcgen.GetAdminDiagnosticsByKeyParams{
		AdminAccountID: accountRow.ID,
		IdempotencyKey: idempotencyKey,
	}); err == nil {
		return receiptOf(existing.ID, existing.SubmittedAt), nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return DiagnosticsReceipt{}, fmt.Errorf("checking idempotency key: %w", err)
	}

	logsJSON, err := json.Marshal(submission.Logs)
	if err != nil {
		return DiagnosticsReceipt{}, fmt.Errorf("encoding logs: %w", err)
	}
	eventsJSON, err := json.Marshal(submission.NetworkEvents)
	if err != nil {
		return DiagnosticsReceipt{}, fmt.Errorf("encoding network events: %w", err)
	}

	inserted, err := queries.InsertAdminDiagnostics(ctx, sqlcgen.InsertAdminDiagnosticsParams{
		AdminAccountID: accountRow.ID,
		IdempotencyKey: idempotencyKey,
		AppVersion:     submission.AppVersion,
		DeviceModel:    submission.DeviceModel,
		OsVersion:      submission.OsVersion,
		OtaBundle:      submission.OtaBundle,
		Logs:           logsJSON,
		NetworkEvents:  eventsJSON,
	})
	if storage.IsSQLState(err, storage.SQLStateUniqueViolation) {
		// Lost the race with our own retry: the first insert's receipt is the answer.
		existing, readErr := queries.GetAdminDiagnosticsByKey(ctx, sqlcgen.GetAdminDiagnosticsByKeyParams{
			AdminAccountID: accountRow.ID,
			IdempotencyKey: idempotencyKey,
		})
		if readErr != nil {
			return DiagnosticsReceipt{}, fmt.Errorf("re-reading diagnostics receipt: %w", readErr)
		}
		return receiptOf(existing.ID, existing.SubmittedAt), nil
	}
	if err != nil {
		return DiagnosticsReceipt{}, fmt.Errorf("storing diagnostics: %w", err)
	}
	return receiptOf(inserted.ID, inserted.SubmittedAt), nil
}

// ---------------------------------------------------------------------- helpers

func (service *Service) storedPreferences(ctx context.Context, accountID uuid.UUID) (Preferences, error) {
	settingsRow, err := sqlcgen.New(service.pool).GetAdminSettings(ctx, accountID)
	if errors.Is(err, pgx.ErrNoRows) {
		return defaultPreferences(), nil
	}
	if err != nil {
		return Preferences{}, fmt.Errorf("reading settings: %w", err)
	}
	appearance, parseErr := ParseAppearanceMode(settingsRow.Appearance)
	if parseErr != nil {
		appearance = AppearanceSystem // CHECK-guarded; belt and braces
	}
	return Preferences{
		Appearance:          appearance,
		Haptics:             settingsRow.Haptics,
		DefaultLandingRoute: settingsRow.DefaultLandingRoute,
	}, nil
}

func notificationSettingsOf(row sqlcgen.GetAdminSettingsRow) NotificationSettings {
	return NotificationSettings{
		Channels: ChannelSettings{
			SLAAtRisk:          row.ChannelSlaAtRisk,
			ProviderNoShow:     row.ChannelProviderNoShow,
			ZoneSupplyCritical: row.ChannelZoneSupplyCritical,
			PaymentFailure:     row.ChannelPaymentFailure,
			NewApplications:    row.ChannelNewApplications,
			AutoSuspensions:    row.ChannelAutoSuspensions,
			DocumentExpiring:   row.ChannelDocumentExpiring,
			DailySummary:       row.ChannelDailySummary,
		},
		CriticalSound: row.CriticalSound,
		DigestTime:    row.DigestTime,
		QuietHours: QuietHours{
			Enabled: row.QuietHoursEnabled,
			From:    row.QuietHoursFrom,
			To:      row.QuietHoursTo,
		},
		Vibrate: row.Vibrate,
	}
}

func securityDevicesOf(rows []sqlcgen.ListAdminSecurityDevicesRow) []Device {
	devices := make([]Device, 0, len(rows))
	currentMarked := false
	for _, row := range rows {
		deviceType, err := ParseDeviceType(row.DeviceType)
		if err != nil {
			deviceType = DeviceDesktop
		}
		device := Device{
			ID:         row.ID,
			DeviceID:   row.DeviceID,
			Name:       row.Name,
			Type:       deviceType,
			Location:   row.Location,
			LastUsedAt: timeOf(row.LastUsedAt),
			SignedIn:   row.SignedIn,
		}
		// Rows arrive most-recently-used first; the first open session is the heuristic
		// current device (tokens are not device-bound — see TouchCurrentAdminDevice).
		if !currentMarked && row.SignedIn {
			device.IsCurrent = true
			currentMarked = true
		}
		devices = append(devices, device)
	}
	return devices
}

func securityEventsOf(rows []sqlcgen.ListAdminSecurityEventsRow) []SecurityEvent {
	kindByAction := map[string]SecurityEventKind{
		auditActionSignedIn:        EventSignedIn,
		auditActionSignInFailed:    EventFailedSignIn,
		auditActionDeviceTrusted:   EventDeviceTrusted,
		auditActionPasswordChanged: EventPasswordChanged,
	}
	events := make([]SecurityEvent, 0, len(rows))
	for _, row := range rows {
		kind, known := kindByAction[row.Action]
		if !known {
			continue // the query filters to the known set; belt and braces
		}
		event := SecurityEvent{ID: row.ID, Kind: kind, At: timeOf(row.CreatedAt)}
		if len(row.After) > 0 {
			var payload struct {
				DeviceName string `json:"deviceName"`
			}
			if json.Unmarshal(row.After, &payload) == nil && payload.DeviceName != "" {
				deviceName := payload.DeviceName
				event.Device = &deviceName
			}
		}
		events = append(events, event)
	}
	return events
}

func sweepForPII(submission DiagnosticsSubmission) error {
	lines := make([]string, 0, len(submission.Logs)+len(submission.NetworkEvents))
	lines = append(lines, submission.Logs...)
	lines = append(lines, submission.NetworkEvents...)
	for _, line := range lines {
		if mobilePIIPattern.MatchString(line) {
			return fmt.Errorf("%w: a line carries a mobile number", ErrDiagnosticsPII)
		}
		for _, match := range emailPIIPattern.FindAllString(line, -1) {
			if !strings.HasSuffix(strings.ToLower(match), staffEmailSuffix) {
				return fmt.Errorf("%w: a line carries an email address", ErrDiagnosticsPII)
			}
		}
	}
	return nil
}

func receiptOf(id uuid.UUID, submittedAt pgtype.Timestamptz) DiagnosticsReceipt {
	return DiagnosticsReceipt{
		Reference:   "diag_" + strings.ToUpper(strings.ReplaceAll(id.String(), "-", "")[:8]),
		SubmittedAt: timeOf(submittedAt),
	}
}
