package rescue

// The *-context reads. Every action screen is built from one of these: the console never
// computes a policy amount, a cap or a lock for itself — the server states them first.

import (
	"context"
	"encoding/json"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// ---------------------------------------------------------------------------- assign

// CandidateAvailability is where a candidate stands right now.
type CandidateAvailability string

const (
	CandidateAvailable CandidateAvailability = "available"
	CandidateOnJob     CandidateAvailability = "onJob"
	// CandidateDeclined exists in the vocabulary but is never produced: no offer engine
	// records declines yet, and claiming one would lie.
	CandidateDeclined CandidateAvailability = "declined"
)

// Candidate is one ranked technician on the rescue assign screen.
type Candidate struct {
	ProviderID     uuid.UUID
	Name           string
	Rating         float64
	DistanceKm     float64
	EtaMinutes     int32
	Skill          *string
	JobsToday      int32
	CompletionRate float64
	Availability   CandidateAvailability
	FreeAt         *time.Time
	DeclinedAt     *time.Time
	IsBestMatch    bool
}

// RankingWeight is one factor of the candidate ordering, stated so an override is made
// with the ranking visible.
type RankingWeight struct {
	FactorID string
	Weight   float64
}

// rankingWeights is the server-stated weighting behind the candidate order: location first
// (Booking-Workflow-Decisions §3.2), then skill, acceptance, rating.
func rankingWeights() []RankingWeight {
	return []RankingWeight{
		{FactorID: "distance", Weight: 0.5},
		{FactorID: "skillMatch", Weight: 0.2},
		{FactorID: "acceptanceRate", Weight: 0.2},
		{FactorID: "rating", Weight: 0.1},
	}
}

// DispatchRound is one recorded search round — the "why did this fail" diagnostic.
type DispatchRound struct {
	Round     int32
	RadiusKm  float64
	Contacted int32
	Declined  int32
}

// AssignContext is everything behind the rescue assign screen.
type AssignContext struct {
	Subject        Subject
	Candidates     []Candidate
	Rounds         []DispatchRound
	DeclinedCount  int32
	RankingWeights []RankingWeight
}

// AssignContext reads the ranked candidate list for a booking, from real technician data:
// city-matched, online, not on leave; ordered skill-match first, then PostGIS distance
// (technician's last known location vs the booking address), then acceptance and rating.
func (service *Service) AssignContext(ctx context.Context, bookingID uuid.UUID) (AssignContext, error) {
	rec, err := service.loadRecord(ctx, bookingID)
	if err != nil {
		return AssignContext{}, err
	}
	rows, err := sqlcgen.New(service.pool).AdminAssignCandidates(ctx, bookingID)
	if err != nil {
		return AssignContext{}, err
	}
	rounds, err := service.dispatchRounds(ctx, bookingID)
	if err != nil {
		return AssignContext{}, err
	}

	candidates := make([]Candidate, len(rows))
	for index, row := range rows {
		candidates[index] = candidateOf(row, index == 0)
	}
	return AssignContext{
		Subject:        rec.subject,
		Candidates:     candidates,
		Rounds:         rounds,
		DeclinedCount:  0, // no offer engine records declines yet — the zero is the truth
		RankingWeights: rankingWeights(),
	}, nil
}

func candidateOf(row sqlcgen.AdminAssignCandidatesRow, isFirst bool) Candidate {
	candidate := Candidate{
		ProviderID:     row.UserID,
		Name:           row.Name,
		Rating:         numericToFloat(row.Rating),
		JobsToday:      row.JobsToday,
		CompletionRate: completionRate(row.CompletedJobs, row.TerminalJobs),
		Availability:   CandidateAvailable,
		IsBestMatch:    isFirst,
	}
	if row.ActiveJobs >= row.MaxConcurrentJobs {
		candidate.Availability = CandidateOnJob
	}
	// -1 is the query's "location unknown" sentinel: distance and ETA stay honest zeros.
	if row.DistanceMetres >= 0 {
		candidate.DistanceKm = row.DistanceMetres / 1000
		candidate.EtaMinutes = etaMinutes(candidate.DistanceKm)
	}
	if row.MatchedSkill != "" {
		skill := row.MatchedSkill
		candidate.Skill = &skill
	}
	return candidate
}

// completionRate is completed ÷ terminal outcomes; a technician with no history reads as
// 1.0, matching the acceptance-rate default the capacity model starts everyone on.
func completionRate(completed, terminal int32) float64 {
	if terminal <= 0 {
		return 1
	}
	return float64(completed) / float64(terminal)
}

// etaMinutes derives an ETA from distance at a nominal 24 km/h of city driving, plus five
// minutes to wrap up and depart. Presentation-only — there is no live routing.
func etaMinutes(distanceKm float64) int32 {
	if distanceKm <= 0 {
		return 0
	}
	return int32(math.Round(distanceKm*2.5)) + 5
}

// ------------------------------------------------------------------------ redispatch

// RedispatchContext is everything behind the redispatch screen.
type RedispatchContext struct {
	Subject          Subject
	Rounds           []DispatchRound
	DeclinedCount    int32
	FailedCycles     int32
	IncentiveCap     int64
	DefaultIncentive int64
	DefaultRadius    Radius
}

// RedispatchContext reports the previous attempts (from booking_events) and the
// server-stated caps and suggestions behind a redispatch.
func (service *Service) RedispatchContext(ctx context.Context, bookingID uuid.UUID) (RedispatchContext, error) {
	rec, err := service.loadRecord(ctx, bookingID)
	if err != nil {
		return RedispatchContext{}, err
	}
	rounds, err := service.dispatchRounds(ctx, bookingID)
	if err != nil {
		return RedispatchContext{}, err
	}

	// The suggested pre-selection is one step beyond the last attempted radius — never a
	// radius that already failed. A booking escalates only after its base search failed,
	// so with no recorded rounds the first widening is plus_50.
	defaultRadius := RadiusPlus50
	if len(rounds) > 0 {
		defaultRadius = radiusForKm(rounds[len(rounds)-1].RadiusKm).nextRadius()
	}
	return RedispatchContext{
		Subject:          rec.subject,
		Rounds:           rounds,
		DeclinedCount:    0, // no offer engine records declines yet
		FailedCycles:     countAction(rec.detail.Timeline, booking.ActionEscalate),
		IncentiveCap:     IncentiveCapPaise,
		DefaultIncentive: DefaultIncentivePaise,
		DefaultRadius:    defaultRadius,
	}, nil
}

// radiusForKm maps a recorded round radius back onto the widening step that produced it.
func radiusForKm(radiusKm float64) Radius {
	switch {
	case radiusKm >= RadiusCityWide.KmOf():
		return RadiusCityWide
	case radiusKm >= RadiusPlus100.KmOf():
		return RadiusPlus100
	case radiusKm >= RadiusPlus50.KmOf():
		return RadiusPlus50
	}
	return RadiusBase
}

// redispatchEventMeta is the booking_events meta object a redispatch records.
type redispatchEventMeta struct {
	Redispatch redispatchMetaBody `json:"redispatch"`
}

type redispatchMetaBody struct {
	Round            int32   `json:"round"`
	RadiusID         string  `json:"radius_id"`
	RadiusKm         float64 `json:"radius_km"`
	IncentivePaise   int64   `json:"incentive_paise"`
	RelaxSkillMatch  bool    `json:"relax_skill_match"`
	IncludeDecliners bool    `json:"include_decliners"`
	PriorityBoost    bool    `json:"priority_boost"`
}

// dispatchRounds reads the recorded redispatch parameter sets — the console's rounds until
// an automated engine records rounds of its own.
func (service *Service) dispatchRounds(ctx context.Context, bookingID uuid.UUID) ([]DispatchRound, error) {
	rows, err := sqlcgen.New(service.pool).AdminListRedispatchEvents(ctx, bookingID)
	if err != nil {
		return nil, err
	}
	rounds := make([]DispatchRound, 0, len(rows))
	for _, row := range rows {
		var meta redispatchEventMeta
		if err := json.Unmarshal(row.Meta, &meta); err != nil {
			continue // an unreadable meta object is skipped, never fatal to the screen
		}
		rounds = append(rounds, DispatchRound{
			Round:    meta.Redispatch.Round,
			RadiusKm: meta.Redispatch.RadiusKm,
			// Contacted/Declined honest zeros: no offer engine contacts anyone yet.
		})
	}
	return rounds, nil
}

// ---------------------------------------------------------------------------- cancel

// CancelContext is everything behind the emergency-cancel screen.
type CancelContext struct {
	Subject            Subject
	PolicyRefundPaise  int64
	IsPolicyRefundFull bool
	CancellationFee    int64
	TechnicianOnSite   bool
}

// CancelContext states the refund policy and the on-site danger before a cancellation: the
// policy amount is what was actually paid and not yet credited back; the fee is zero — the
// platform charges no cancellation fee (Booking-Workflow-Decisions D2).
func (service *Service) CancelContext(ctx context.Context, bookingID uuid.UUID) (CancelContext, error) {
	rec, err := service.loadRecord(ctx, bookingID)
	if err != nil {
		return CancelContext{}, err
	}
	refundable, _, err := service.refundableFor(ctx, rec)
	if err != nil {
		return CancelContext{}, err
	}
	paid := paidAmount(rec.facts)
	return CancelContext{
		Subject:            rec.subject,
		PolicyRefundPaise:  refundable.Paise(),
		IsPolicyRefundFull: paid.Paise() > 0 && refundable.Paise() == paid.Paise(),
		CancellationFee:    0,
		TechnicianOnSite:   technicianOnSite(rec.detail.State),
	}, nil
}

// technicianOnSite: cancelling mid-visit strands two people — the console shows the escape
// hatch from ARRIVED onwards.
func technicianOnSite(state booking.State) bool {
	switch state {
	case booking.StateArrived, booking.StateInProgress, booking.StateAwaitingCompletion:
		return true
	case booking.StateDraft, booking.StateConfirmed, booking.StateSearching, booking.StateAssigned,
		booking.StateEnRoute, booking.StateCompleted, booking.StateEscalated,
		booking.StateRescheduled, booking.StateCancelled, booking.StateFailed:
		return false
	}
	return false
}

// ------------------------------------------------------------------- manual completion

// CallAttempt is one logged call to the customer. The platform has no call log yet, so no
// attempts are ever listed — the operator's own attempt ids arrive with the request.
type CallAttempt struct {
	ID       string
	At       time.Time
	Outcome  string
	Duration int32
}

// ManualCompletionEvidence is the recorded evidence behind a manual completion.
type ManualCompletionEvidence struct {
	WorkPhotoIDs       []uuid.UUID
	CompletionReportID *string
	CompletionReportAt *time.Time
	CallAttempts       []CallAttempt
}

// ManualCompletionContext is everything behind the manual-completion screen.
type ManualCompletionContext struct {
	Subject                        Subject
	ProviderName                   string
	WorkReportedAt                 time.Time
	MinutesSinceWorkReported       int32
	AvailableInMinutes             *int32
	Evidence                       ManualCompletionEvidence
	OtpArrivedAt                   *time.Time
	AdminCompletionsThisWeek       int32
	ProviderCompletionsInSevenDays int32
}

// ManualCompletionContext states the 30-minute lock, the recorded evidence and the
// frequency counters. adminID is the requesting operator — the completions counter is
// theirs, so the screen holds the right person to account.
func (service *Service) ManualCompletionContext(ctx context.Context, bookingID, adminID uuid.UUID) (ManualCompletionContext, error) {
	rec, err := service.loadRecord(ctx, bookingID)
	if err != nil {
		return ManualCompletionContext{}, err
	}
	workReportedAt := lastActionAt(rec.detail.Timeline, booking.ActionRequestCompletion)
	if workReportedAt == nil {
		return ManualCompletionContext{}, &NotEligibleError{Reason: "no completion has been reported for this booking"}
	}

	queries := sqlcgen.New(service.pool)
	weekAgo := pgtype.Timestamptz{Time: time.Now().Add(-7 * 24 * time.Hour), Valid: true}
	actorID := adminID
	adminCompletions, err := queries.AdminCountAdminCompletionsSince(ctx, sqlcgen.AdminCountAdminCompletionsSinceParams{
		ActorUserID: &actorID,
		CreatedAt:   weekAgo,
	})
	if err != nil {
		return ManualCompletionContext{}, err
	}
	var providerCompletions int32
	if rec.detail.TechnicianID != nil {
		providerCompletions, err = queries.AdminCountTechnicianCompletionsSince(ctx, sqlcgen.AdminCountTechnicianCompletionsSinceParams{
			TechnicianID: rec.detail.TechnicianID,
			CreatedAt:    weekAgo,
		})
		if err != nil {
			return ManualCompletionContext{}, err
		}
	}
	photoIDs, err := queries.AdminListWorkPhotoIDs(ctx, bookingID)
	if err != nil {
		return ManualCompletionContext{}, err
	}

	built := ManualCompletionContext{
		Subject:                  rec.subject,
		WorkReportedAt:           *workReportedAt,
		MinutesSinceWorkReported: minutesSince(*workReportedAt),
		Evidence: ManualCompletionEvidence{
			WorkPhotoIDs: photoIDs,
			CallAttempts: []CallAttempt{}, // no call log exists — an honest empty list
		},
		AdminCompletionsThisWeek:       adminCompletions,
		ProviderCompletionsInSevenDays: providerCompletions,
	}
	if rec.detail.TechnicianName != nil {
		built.ProviderName = *rec.detail.TechnicianName
	}
	if remaining := time.Until(workReportedAt.Add(ManualCompletionLock)); remaining > 0 {
		minutes := int32(math.Ceil(remaining.Minutes()))
		built.AvailableInMinutes = &minutes
	}
	// The customer's OTP landed mid-flow: the booking completed on the normal path, and the
	// manual path yields. An ADMIN-verified completion is not that — no OTP ever arrived.
	if rec.detail.State == booking.StateCompleted {
		if verifiedAt, verifiedByAdmin := completionVerification(rec.detail.Timeline); !verifiedByAdmin {
			built.OtpArrivedAt = verifiedAt
		}
	}
	return built, nil
}

// completionVerification finds the completion transition and whether an admin drove it.
func completionVerification(timeline []booking.AdminTimelineEntry) (*time.Time, bool) {
	for index := len(timeline) - 1; index >= 0; index-- {
		if timeline[index].Action != booking.ActionVerifyCompletion {
			continue
		}
		at := timeline[index].At
		verifiedByAdmin := timeline[index].ActorRole != nil && *timeline[index].ActorRole == "ADMIN"
		return &at, verifiedByAdmin
	}
	return nil, false
}

// ---------------------------------------------------------------------------- refund

// RefundContext is everything behind the refund screen.
type RefundContext struct {
	Subject               Subject
	BookingValuePaise     int64
	AlreadyRefundedPaise  int64
	RefundablePaise       int64
	GoodwillCapPaise      int64
	RefundsUsedThisHour   int32
	RefundsAllowedPerHour int32
	RateLimitResetsAt     *time.Time
	ProviderPayoutPaise   int64
	OriginalMethod        string
	PaidAt                time.Time
	DefaultPayoutImpact   string
}

// RefundContext states the refundable amount, the goodwill cap and this admin's rate-limit
// standing. providerPayoutPaise is an honest zero: technicians are salaried — no per-job
// payout exists to withhold.
func (service *Service) RefundContext(ctx context.Context, bookingID, adminID uuid.UUID) (RefundContext, error) {
	rec, err := service.loadRecord(ctx, bookingID)
	if err != nil {
		return RefundContext{}, err
	}
	refundable, alreadyRefunded, err := service.refundableFor(ctx, rec)
	if err != nil {
		return RefundContext{}, err
	}
	used, oldest, err := service.trail.CountAdminActionsSince(ctx, adminID, refundAuditAction, time.Now().Add(-time.Hour))
	if err != nil {
		return RefundContext{}, err
	}

	built := RefundContext{
		Subject:               rec.subject,
		BookingValuePaise:     rec.detail.Amount.Paise(),
		AlreadyRefundedPaise:  alreadyRefunded.Paise(),
		RefundablePaise:       refundable.Paise(),
		GoodwillCapPaise:      GoodwillCapPaise,
		RefundsUsedThisHour:   used,
		RefundsAllowedPerHour: RefundsAllowedPerHour,
		ProviderPayoutPaise:   0,
		OriginalMethod:        rec.subject.PaymentMethod,
		// pay_anyway is the honest default: with salaried technicians there is no payout to
		// withhold. The console applies its reason-based recommendation on top.
		DefaultPayoutImpact: "pay_anyway",
	}
	if rec.facts.PaidAt != nil {
		built.PaidAt = *rec.facts.PaidAt
	}
	if used > 0 && oldest != nil {
		resetsAt := oldest.Add(time.Hour)
		built.RateLimitResetsAt = &resetsAt
	}
	return built, nil
}

func numericToFloat(numeric pgtype.Numeric) float64 {
	value, err := numeric.Float64Value()
	if err != nil || !value.Valid {
		return 0
	}
	return value.Float64
}
