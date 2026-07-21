// Package media holds the integration with the image host (Cloudinary) for work-photo evidence.
// It never touches the file bytes: the client uploads directly to Cloudinary using a signature
// we mint, and we verify the signed result Cloudinary hands back. Keeping the bytes off our
// servers is the whole point of a signed direct upload — we authorize and authenticate, the CDN
// stores.
package media

import (
	"crypto/sha1"
	"encoding/hex"
	"sort"
	"strings"
)

// Cloudinary signs direct uploads and verifies their results. The api secret never leaves this
// type — callers get signatures, not the key.
type Cloudinary struct {
	cloudName string
	apiKey    string
	apiSecret string
}

func NewCloudinary(cloudName, apiKey, apiSecret string) *Cloudinary {
	return &Cloudinary{cloudName: cloudName, apiKey: apiKey, apiSecret: apiSecret}
}

// Configured reports whether all three credentials are present. When false, the photo endpoints
// have nothing to sign with and should report themselves unavailable rather than mint useless
// signatures.
func (cloudinary *Cloudinary) Configured() bool {
	return cloudinary.cloudName != "" && cloudinary.apiKey != "" && cloudinary.apiSecret != ""
}

func (cloudinary *Cloudinary) CloudName() string { return cloudinary.cloudName }
func (cloudinary *Cloudinary) APIKey() string    { return cloudinary.apiKey }

// Sign computes a Cloudinary signature over params: the parameters are sorted by key, joined as
// `k=v` with `&`, the api secret is appended, and the whole is SHA-1'd and hex-encoded. This is
// exactly Cloudinary's own scheme, so a signature we mint is accepted by their upload API and a
// signature they return can be recomputed and checked here.
func (cloudinary *Cloudinary) Sign(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	pairs := make([]string, 0, len(keys))
	for _, key := range keys {
		pairs = append(pairs, key+"="+params[key])
	}

	digest := sha1.Sum([]byte(strings.Join(pairs, "&") + cloudinary.apiSecret))
	return hex.EncodeToString(digest[:])
}

// VerifyUpload checks the signature Cloudinary returned alongside an upload result. Cloudinary
// signs the result over `public_id` and `version`, so recomputing that signature and comparing
// proves the public_id/version pair really came from an upload to our account — a technician
// cannot hand us an arbitrary URL and have it accepted.
func (cloudinary *Cloudinary) VerifyUpload(publicID, version, signature string) bool {
	expected := cloudinary.Sign(map[string]string{
		"public_id": publicID,
		"version":   version,
	})
	// Constant-time compare is unnecessary here (the signature is not a secret we hold), but a
	// plain equality on equal-length hex is fine and clear.
	return signature != "" && expected == signature
}
