package flow

import (
	"context"
	"testing"
	"time"
)

// newTestController connects to a throwaway Redis DB (15). Skips if Redis isn't running, so the
// suite stays green in environments without it.
func newTestController(t *testing.T) *Controller {
	t.Helper()
	control, err := New(context.Background(), "redis://127.0.0.1:6379/15")
	if err != nil {
		t.Skipf("redis not available: %v", err)
	}
	t.Cleanup(func() {
		if err := control.Close(); err != nil {
			t.Errorf("closing controller: %v", err)
		}
	})
	return control
}

func TestLockIsMutuallyExclusive(t *testing.T) {
	control := newTestController(t)
	ctx := context.Background()
	key := "test:lock:" + randomToken()

	release, ok, err := control.Lock(ctx, key, 5*time.Second)
	if err != nil || !ok {
		t.Fatalf("first lock: ok=%v err=%v", ok, err)
	}
	if _, held, err := control.Lock(ctx, key, 5*time.Second); err != nil || held {
		t.Fatalf("second lock while held: held=%v err=%v (want held=false)", held, err)
	}
	release()
	release2, ok2, err := control.Lock(ctx, key, 5*time.Second)
	if err != nil || !ok2 {
		t.Fatalf("re-lock after release: ok=%v err=%v", ok2, err)
	}
	release2()
}

func TestAllowEnforcesLimit(t *testing.T) {
	control := newTestController(t)
	ctx := context.Background()
	key := "test:rl:" + randomToken()

	for hit := 1; hit <= 3; hit++ {
		ok, err := control.Allow(ctx, key, 3, time.Minute)
		if err != nil {
			t.Fatalf("hit %d: %v", hit, err)
		}
		if !ok {
			t.Fatalf("hit %d should be allowed", hit)
		}
	}
	over, err := control.Allow(ctx, key, 3, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if over {
		t.Fatal("4th hit over the limit should be denied")
	}
}

func TestReserveHoldsSlot(t *testing.T) {
	control := newTestController(t)
	ctx := context.Background()
	key := "test:hold:" + randomToken()

	if ok, err := control.Reserve(ctx, key, "b1", 5*time.Second); err != nil || !ok {
		t.Fatalf("first reserve: ok=%v err=%v", ok, err)
	}
	if ok, err := control.Reserve(ctx, key, "b2", 5*time.Second); err != nil || ok {
		t.Fatalf("second reserve while held: ok=%v err=%v (want ok=false)", ok, err)
	}
	if err := control.Release(ctx, key); err != nil {
		t.Fatalf("release: %v", err)
	}
	if ok, err := control.Reserve(ctx, key, "b3", 5*time.Second); err != nil || !ok {
		t.Fatalf("reserve after release: ok=%v err=%v", ok, err)
	}
	if err := control.Release(ctx, key); err != nil {
		t.Fatalf("final release: %v", err)
	}
}

func TestDisabledControllerIsPermissive(t *testing.T) {
	control, err := New(context.Background(), "")
	if err != nil {
		t.Fatalf("New(\"\"): %v", err)
	}
	ctx := context.Background()
	if control.Enabled() {
		t.Fatal("empty url should yield a disabled controller")
	}
	if _, ok, err := control.Lock(ctx, "k", time.Second); err != nil || !ok {
		t.Fatalf("disabled lock should always acquire: ok=%v err=%v", ok, err)
	}
	if ok, err := control.Allow(ctx, "k", 0, time.Second); err != nil || !ok {
		t.Fatalf("disabled rate limit should always allow: ok=%v err=%v", ok, err)
	}
	if ok, err := control.Reserve(ctx, "k", "v", time.Second); err != nil || !ok {
		t.Fatalf("disabled reserve should always reserve: ok=%v err=%v", ok, err)
	}
}
