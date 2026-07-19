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
	t.Cleanup(func() { _ = control.Close() })
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
		if ok, _ := control.Allow(ctx, key, 3, time.Minute); !ok {
			t.Fatalf("hit %d should be allowed", hit)
		}
	}
	if ok, _ := control.Allow(ctx, key, 3, time.Minute); ok {
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
	if ok, _ := control.Reserve(ctx, key, "b2", 5*time.Second); ok {
		t.Fatal("second reserve while held should fail")
	}
	_ = control.Release(ctx, key)
	if ok, _ := control.Reserve(ctx, key, "b3", 5*time.Second); !ok {
		t.Fatal("reserve after release should succeed")
	}
	_ = control.Release(ctx, key)
}

func TestDisabledControllerIsPermissive(t *testing.T) {
	control, _ := New(context.Background(), "")
	ctx := context.Background()
	if control.Enabled() {
		t.Fatal("empty url should yield a disabled controller")
	}
	if _, ok, _ := control.Lock(ctx, "k", time.Second); !ok {
		t.Fatal("disabled lock should always acquire")
	}
	if ok, _ := control.Allow(ctx, "k", 0, time.Second); !ok {
		t.Fatal("disabled rate limit should always allow")
	}
	if ok, _ := control.Reserve(ctx, "k", "v", time.Second); !ok {
		t.Fatal("disabled reserve should always reserve")
	}
}
