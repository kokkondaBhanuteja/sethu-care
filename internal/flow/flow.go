// Package flow is the Redis-backed request-flow layer: distributed locks, slot holds, and rate
// limiting. It is deliberately a FLOW layer, not a correctness layer — the database (the EXCLUDE
// constraint, the version compare-and-swap, the idempotent capture) is what actually guarantees no
// double-booking and no double-charge. So every primitive here DEGRADES PERMISSIVELY when Redis is
// absent or blips: a lock is "acquired", a request is "allowed", a slot is "reserved". The service
// runs, correctly, with Redis down — just with less smoothing under contention.
package flow

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

// Redis key prefixes — one namespace per primitive, so the keyspace is greppable and can't collide.
const (
	keyPrefixLock = "lock:" // distributed locks (Lock/LockWait)
	keyPrefixRate = "rl:"   // fixed-window rate-limit counters (Allow)
	keyPrefixIdem = "idem:" // idempotency result cache (Remember/Recall)
	keyPrefixHold = "hold:" // slot-reservation holds (Reserve/Release)
)

// Controller wraps a Redis client. A nil client (New called with an empty URL, or a connect failure
// the caller chose to tolerate) means "disabled" — every method returns the permissive answer.
type Controller struct{ rdb *redis.Client }

// New connects and pings Redis. An empty url returns a disabled controller (no error). A connect
// error is returned so the caller can decide whether to fail boot or run degraded.
func New(ctx context.Context, url string) (*Controller, error) {
	if url == "" {
		return &Controller{}, nil
	}
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	rdb := redis.NewClient(opt)
	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := rdb.Ping(pingCtx).Err(); err != nil {
		return nil, errors.Join(err, rdb.Close())
	}
	return &Controller{rdb: rdb}, nil
}

// Disabled returns a controller with no Redis backing — every primitive answers permissively. Used
// as the fallback when a connect attempt fails but the caller wants to run degraded rather than crash.
func Disabled() *Controller { return &Controller{} }

// Enabled reports whether a live Redis backs this controller.
func (controller *Controller) Enabled() bool { return controller != nil && controller.rdb != nil }

// Close releases the Redis connection pool.
func (controller *Controller) Close() error {
	if controller.Enabled() {
		return controller.rdb.Close()
	}
	return nil
}

// releaseScript frees a lock only if we still own it (compare-and-delete), so a lock that already
// expired and was re-taken by someone else is never stolen back.
var releaseScript = redis.NewScript(
	`if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`)

// Lock takes a short-lived distributed lock. release() frees it (a no-op if we already lost it);
// acquired=false means someone else holds it. Disabled Redis always acquires — the DB constraint is
// the real guard, so this only cuts contention on the hot path.
func (controller *Controller) Lock(ctx context.Context, key string, ttl time.Duration) (release func(), acquired bool, err error) {
	if !controller.Enabled() {
		return func() {}, true, nil
	}
	token := randomToken()
	ok, err := controller.rdb.SetNX(ctx, keyPrefixLock+key, token, ttl).Result()
	if err != nil || !ok {
		return func() {}, ok, err
	}
	return func() {
		relCtx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		if err := releaseScript.Run(relCtx, controller.rdb, []string{keyPrefixLock + key}, token).Err(); err != nil {
			return // best effort — the lock expires on its own TTL regardless
		}
	}, true, nil
}

// LockWait is Lock with a bounded wait: it retries acquisition until it succeeds or maxWait elapses.
// On timeout it returns acquired=false with NO error — the caller should proceed anyway, because the
// database (the EXCLUDE constraint) is the real guard; the lock only serialises the common path to
// cut wasted work. Disabled Redis returns acquired=true immediately.
func (controller *Controller) LockWait(ctx context.Context, key string, ttl, maxWait time.Duration) (release func(), acquired bool, err error) {
	if !controller.Enabled() {
		return func() {}, true, nil
	}
	deadline := time.Now().Add(maxWait)
	for {
		release, ok, err := controller.Lock(ctx, key, ttl)
		if err != nil || ok {
			return release, ok, err
		}
		if time.Now().After(deadline) {
			return func() {}, false, nil
		}
		select {
		case <-ctx.Done():
			return func() {}, false, ctx.Err()
		case <-time.After(15 * time.Millisecond):
		}
	}
}

// Allow reports whether key is within limit hits per window (fixed-window counter via INCR+EXPIRE).
// It FAILS OPEN: a Redis error allows the request, so a Redis blip never takes the API down.
func (controller *Controller) Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	if !controller.Enabled() {
		return true, nil
	}
	rkey := keyPrefixRate + key
	count, err := controller.rdb.Incr(ctx, rkey).Result()
	if err != nil {
		return true, err
	}
	if count == 1 {
		// Surface a failed TTL set as an error; the caller fails open on it (never blocks a request).
		if err := controller.rdb.Expire(ctx, rkey, window).Err(); err != nil {
			return count <= int64(limit), err
		}
	}
	return count <= int64(limit), nil
}

// Remember stores an idempotency result (e.g. a created booking's JSON) under key for ttl.
func (controller *Controller) Remember(ctx context.Context, key, value string, ttl time.Duration) error {
	if !controller.Enabled() {
		return nil
	}
	return controller.rdb.Set(ctx, keyPrefixIdem+key, value, ttl).Err()
}

// Recall returns a previously Remembered result. ok=false means nothing was stored (or Redis is off).
func (controller *Controller) Recall(ctx context.Context, key string) (value string, ok bool, err error) {
	if !controller.Enabled() {
		return "", false, nil
	}
	value, err = controller.rdb.Get(ctx, keyPrefixIdem+key).Result()
	if errors.Is(err, redis.Nil) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return value, true, nil
}

// Reserve holds key for ttl if it is free (SET NX). false means it is already held. Disabled Redis
// always reserves. Use for the slot-hold during checkout.
func (controller *Controller) Reserve(ctx context.Context, key, value string, ttl time.Duration) (bool, error) {
	if !controller.Enabled() {
		return true, nil
	}
	return controller.rdb.SetNX(ctx, keyPrefixHold+key, value, ttl).Result()
}

// Release frees a hold early (otherwise it expires on its TTL).
func (controller *Controller) Release(ctx context.Context, key string) error {
	if !controller.Enabled() {
		return nil
	}
	return controller.rdb.Del(ctx, keyPrefixHold+key).Err()
}

func randomToken() string {
	buffer := make([]byte, 16)
	_, _ = rand.Read(buffer)
	return hex.EncodeToString(buffer)
}
