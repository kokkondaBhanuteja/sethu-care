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
		DatabaseURL:       stringEnv("DATABASE_URL", "postgres://sethu:sethu@127.0.0.1:5434/sethu?sslmode=disable"),
		ListenAddr:        stringEnv("ADDR", ":8080"),
		JWTSecret:         jwtSecret,
		JWTTTL:            jwtTTL,
		UsingDevJWTSecret: usingDevSecret,
		DevEchoOTP:        os.Getenv("SETHU_DEV_OTP") == "true",
	}
	return configuration, nil
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
