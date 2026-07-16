// Package config loads and validates every environment-driven setting once, at startup, so
// the rest of the program receives a typed, checked Config instead of reaching into
// os.Getenv from scattered places. A bad setting fails the boot here, loudly, rather than
// surfacing as a confusing error deep in a request later.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// defaultDevJWTSecret is used only when JWT_SECRET is unset, to let a developer run with zero
// setup. UsingDevJWTSecret is set so the caller can warn; it is deliberately long enough to
// satisfy the signer's minimum length.
const defaultDevJWTSecret = "sethu-care-insecure-dev-secret-change-me"

// Config is the fully resolved configuration for one run of the API.
type Config struct {
	DatabaseURL string
	ListenAddr  string

	JWTSecret         string
	JWTTTL            time.Duration
	UsingDevJWTSecret bool

	// DevEchoOTP returns OTP codes in the HTTP response (dev only — there is no SMS provider
	// yet). Off unless SETHU_DEV_OTP=true, so it cannot leak by default.
	DevEchoOTP bool

	// FailedBookingCreditPaise is the goodwill credit issued when a booking FAILS (nobody
	// could be found). Default ₹100.
	FailedBookingCreditPaise int64

	// UPIVirtualAddress and UPIPayeeName build the customer-facing UPI QR/intent for a
	// collection (upi://pay?pa=<vpa>&pn=<name>...). The money lands in the company account.
	UPIVirtualAddress string
	UPIPayeeName      string

	// Cloudinary credentials for signed direct uploads of work photos. The backend signs the
	// upload and verifies the result; the file bytes never pass through us.
	CloudinaryCloudName string
	CloudinaryAPIKey    string
	CloudinaryAPISecret string

	// DemoPhone / DemoOTP enable a fixed bypass code for one reserved number, so App Store review
	// can log in without a real SMS. Both empty = disabled. Never point at a real user's phone.
	DemoPhone string
	DemoOTP   string

	// MSG91 credentials for delivering OTP SMS via a DLT-approved template. When AuthKey and
	// TemplateID are set, real SMS is sent; otherwise codes are only logged (dev).
	MSG91AuthKey    string
	MSG91SenderID   string
	MSG91TemplateID string

	// Razorpay credentials for hosted payment links + webhook capture. When KeyID/KeySecret are
	// set, a real payment link is created; otherwise the customer gets a upi:// intent and an admin
	// captures by hand. WebhookSecret authenticates the capture callback.
	RazorpayKeyID         string
	RazorpayKeySecret     string
	RazorpayWebhookSecret string
}

// Load reads the environment, applies defaults, validates, and returns a Config. The only
// error it returns is for a value that is present but malformed (e.g. an unparseable
// duration); missing values fall back to defaults.
func Load() (Config, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	usingDevSecret := false
	if jwtSecret == "" {
		jwtSecret = defaultDevJWTSecret
		usingDevSecret = true
	}

	jwtTTL, err := durationEnv("JWT_TTL", 24*time.Hour)
	if err != nil {
		return Config{}, err
	}

	configuration := Config{
		DatabaseURL:              stringEnv("DATABASE_URL", "postgres://sethu:sethu@127.0.0.1:5434/sethu?sslmode=disable"),
		ListenAddr:               stringEnv("ADDR", ":8080"),
		JWTSecret:                jwtSecret,
		JWTTTL:                   jwtTTL,
		UsingDevJWTSecret:        usingDevSecret,
		DevEchoOTP:               os.Getenv("SETHU_DEV_OTP") == "true",
		FailedBookingCreditPaise: intEnv("SETHU_FAILED_CREDIT_PAISE", 10000),
		UPIVirtualAddress:        stringEnv("SETHU_UPI_VPA", "sethucare@upi"),
		UPIPayeeName:             stringEnv("SETHU_UPI_PAYEE", "SETHU-CARE"),
		CloudinaryCloudName:      os.Getenv("CLOUDINARY_CLOUD_NAME"),
		CloudinaryAPIKey:         os.Getenv("CLOUDINARY_API_KEY"),
		CloudinaryAPISecret:      os.Getenv("CLOUDINARY_API_SECRET"),
		DemoPhone:                os.Getenv("SETHU_DEMO_PHONE"),
		DemoOTP:                  os.Getenv("SETHU_DEMO_OTP"),
		MSG91AuthKey:             os.Getenv("MSG91_AUTH_KEY"),
		MSG91SenderID:            os.Getenv("MSG91_SENDER_ID"),
		MSG91TemplateID:          os.Getenv("MSG91_OTP_TEMPLATE_ID"),
		RazorpayKeyID:            os.Getenv("RAZORPAY_KEY_ID"),
		RazorpayKeySecret:        os.Getenv("RAZORPAY_KEY_SECRET"),
		RazorpayWebhookSecret:    os.Getenv("RAZORPAY_WEBHOOK_SECRET"),
	}
	return configuration, nil
}

func intEnv(key string, fallback int64) int64 {
	if raw := os.Getenv(key); raw != "" {
		if parsed, err := strconv.ParseInt(raw, 10, 64); err == nil {
			return parsed
		}
	}
	return fallback
}

func stringEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func durationEnv(key string, fallback time.Duration) (time.Duration, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	// Accept either a Go duration ("24h") or a plain number of seconds.
	if parsed, err := time.ParseDuration(raw); err == nil {
		return parsed, nil
	}
	if seconds, err := strconv.Atoi(raw); err == nil {
		return time.Duration(seconds) * time.Second, nil
	}
	return 0, fmt.Errorf("config: %s=%q is not a valid duration (want e.g. \"24h\" or a number of seconds)", key, raw)
}
