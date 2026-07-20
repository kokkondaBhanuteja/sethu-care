# internal/media — CLAUDE.md

## Purpose
ADAPTER. Cloudinary signed-upload signer for work-photo evidence. It NEVER touches the file bytes: the client uploads directly to Cloudinary using a signature this package mints, and it verifies the signed result Cloudinary hands back. Authorize + authenticate here; the CDN stores. No SDK — just `crypto/sha1`.

## Responsibilities
- Report whether credentials are configured.
- Sign upload parameters (Cloudinary's exact SHA-1 scheme).
- Verify the signature Cloudinary returns for an upload result.

## Owns
none.

## Allowed Dependencies
stdlib crypto/`sort`/`strings` only.

## Forbidden Dependencies
- No domain module, no `storage`, no `httpapi`. It is an outbound adapter chosen in the composition root.

## Contains
- `Cloudinary` struct (holds `cloudName`, `apiKey`, `apiSecret` — the secret never leaves the type).
- `NewCloudinary(cloudName, apiKey, apiSecret)`.
- `Configured()` — all three credentials present.
- `CloudName()`, `APIKey()` (the public bits handlers need to build the upload form).
- `Sign(params map[string]string)` — sorts keys, joins `k=v` with `&`, appends the api secret, SHA-1, hex — exactly Cloudinary's scheme.
- `VerifyUpload(publicID, version, signature)` — recomputes the signature over `public_id`+`version` and compares; proves the pair really came from an upload to our account.

## Examples
```go
cloud := media.NewCloudinary(cfg.CloudinaryCloudName, cfg.CloudinaryAPIKey, cfg.CloudinaryAPISecret)
if !cloud.Configured() { /* photo endpoint unavailable */ }
sig := cloud.Sign(map[string]string{"timestamp": ts, "public_id": id})   // handed to the client
ok := cloud.VerifyUpload(returnedPublicID, returnedVersion, returnedSig)  // verify the callback
```

## Best Practices
- Verify BOTH the returned signature AND that the URL/public_id belongs to our account before accepting a photo — a technician must not be able to hand us an arbitrary URL.
- Sign only the fields Cloudinary expects; a mismatched param set produces an unusable signature.
- Report `Configured() == false` as "unavailable" rather than minting useless signatures.

## Common Mistakes
- Letting the api secret escape the type (return signatures, never the key).
- Trusting an uploaded URL without `VerifyUpload`.
- Reaching for the Cloudinary SDK — this is deliberately two crypto calls with no dependency.
