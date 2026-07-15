package media_test

import (
	"testing"

	"github.com/kokkondaBhanuteja/sethu-care/internal/media"
)

// Sign matches Cloudinary's scheme: sorted `k=v&...` + secret, SHA-1, hex. This pins the exact
// bytes so a change to the algorithm is caught, not silently accepted by a live upload later.
func TestSignIsSortedSha1Hex(t *testing.T) {
	cloudinary := media.NewCloudinary("demo", "key", "secret")

	// Params out of order must sign identically to sorted — the function sorts them.
	got := cloudinary.Sign(map[string]string{"timestamp": "1600000000", "folder": "sethu-care"})
	same := cloudinary.Sign(map[string]string{"folder": "sethu-care", "timestamp": "1600000000"})
	if got != same {
		t.Errorf("signing is order-dependent: %q vs %q", got, same)
	}
	// A fixed vector: sha1("folder=sethu-care&timestamp=1600000000secret"). Pins the exact
	// scheme so a drift from Cloudinary's algorithm fails here, not at a live upload.
	const want = "65687e858add16c0be4b9565c133532f14f04d1d"
	if got != want {
		t.Errorf("signature = %q, want %q", got, want)
	}
}

// VerifyUpload accepts a signature we compute over (public_id, version) and rejects any other.
func TestVerifyUpload(t *testing.T) {
	cloudinary := media.NewCloudinary("demo", "key", "secret")

	valid := cloudinary.Sign(map[string]string{"public_id": "sethu-care/bookings/abc", "version": "1700000000"})
	if !cloudinary.VerifyUpload("sethu-care/bookings/abc", "1700000000", valid) {
		t.Error("valid signature rejected")
	}
	if cloudinary.VerifyUpload("sethu-care/bookings/abc", "1700000000", "deadbeef") {
		t.Error("forged signature accepted")
	}
	if cloudinary.VerifyUpload("sethu-care/bookings/abc", "1700000000", "") {
		t.Error("empty signature accepted")
	}
	// A different public_id must not verify against a signature minted for another.
	if cloudinary.VerifyUpload("sethu-care/bookings/OTHER", "1700000000", valid) {
		t.Error("signature accepted for the wrong public_id")
	}
}

func TestConfigured(t *testing.T) {
	if media.NewCloudinary("", "", "").Configured() {
		t.Error("empty credentials reported configured")
	}
	if !media.NewCloudinary("demo", "key", "secret").Configured() {
		t.Error("full credentials reported unconfigured")
	}
}
