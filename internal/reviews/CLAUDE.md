# internal/reviews — CLAUDE.md

## Purpose
Owns customer reviews of a completed job. A review publishes `review.submitted`, which `identity` consumes to recompute the technician's rating (ROADMAP §8) — so feedback flows back into dispatch ranking without reviews ever touching the technician aggregate.

## Responsibilities
- `Submit(bookingID, customerID, rating, comment)` — validate rating (1..5), confirm the booking exists, is the caller's, and is COMPLETED, then write the review row **and** the `review.submitted` outbox event in ONE transaction. A unique-violation (one review per booking) maps to `ErrAlreadyReviewed`.

## Owns
`reviews`. Writes `outbox` (`review.submitted`) in the same transaction.

## Allowed Dependencies
`storage` (+`sqlcgen`), stdlib, `pgx`, `google/uuid`.

## Forbidden Dependencies
`httpapi`/`huma`/`config` and `identity` (reviews must not reach into the technician aggregate — the rating update happens via the event consumer, not a direct call).

## Contains
- `service.go` — `Service`, `NewService(pool)`, `Submit`; errors `ErrBookingNotFound` (404), `ErrNotYourBooking` (403), `ErrNotReviewable` (not COMPLETED → 422), `ErrAlreadyReviewed` (409), `ErrInvalidRating` (400).

## Examples
```go
rev := reviews.NewService(pool)
err := rev.Submit(ctx, bookingID, customerID, 5, "Great work")
// review row + review.submitted event commit together; second submit → ErrAlreadyReviewed
```

## Best Practices
- The review and its outbox event land together or not at all (`storage.InTx`) — never write one without the other.
- Enforce the one-review-per-booking rule at the DB (unique index) and translate the SQLSTATE, rather than a read-then-write check that can race.
- Validate the rating range in Go for a clean 400 before touching the DB.

## Common Mistakes
- Calling into `identity` to bump the rating directly instead of emitting `review.submitted` (breaks the event boundary and the depguard rule).
- Inserting the review outside a transaction that also writes the outbox row (an at-least-once consumer would never fire).
