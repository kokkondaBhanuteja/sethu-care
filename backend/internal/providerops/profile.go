package providerops

// The provider profile read model — identity, standing, and performance aggregates computed
// from real bookings and reviews — plus the live-jobs list that is step 3 of the suspend
// flow.
//
// Honest gaps, stated here because the profile declares the fields:
//   - Documents: no provider-documents table exists yet, so the list is always empty (the
//     application pipeline holds documents, but they are not carried over on approval yet).
//   - Flags: no behavioural-flag engine exists, so the list is always empty.
//   - Skills: real skill names from technician_skills; certification data does not exist,
//     so CertifiedTo is always nil and IsPending always false.
//   - PayoutCyclePaise: technicians are salaried (no payouts); the figure is the revenue
//     their completed jobs earned this calendar month — the only cycle money figure that
//     exists.

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// trendPoints is the number of buckets every profile trend carries, per the admin contract.
const trendPoints = 8

// performanceWindow is the window the profile's metrics describe.
const performanceWindow = 90 * 24 * time.Hour

// jobs30Window is the window of the jobs30 metric's headline value.
const jobs30Window = 30 * 24 * time.Hour

// MetricID names a profile metric in the console's vocabulary. onTime is deliberately
// absent: no promised-arrival data exists, so an on-time metric would be invented.
type MetricID string

const (
	MetricCompletion   MetricID = "completion"
	MetricEscalation   MetricID = "escalation"
	MetricCancellation MetricID = "cancellation"
	MetricRating       MetricID = "rating"
	MetricJobs30       MetricID = "jobs30"
)

// MetricUnit is how a metric's value reads.
type MetricUnit string

const (
	UnitPercent MetricUnit = "percent"
	UnitRating  MetricUnit = "rating"
	UnitCount   MetricUnit = "count"
)

// MetricBand is where a metric sits against its target.
type MetricBand string

const (
	BandGood  MetricBand = "good"
	BandWatch MetricBand = "watch"
	BandPoor  MetricBand = "poor"
)

// Metric is one profile performance tile: headline value, band, and an 8-point trend.
type Metric struct {
	ID    MetricID
	Value float64
	Unit  MetricUnit
	Band  MetricBand
	Trend []float64
}

// Skill is one certified capability. Certification data does not exist yet, so CertifiedTo
// is nil and IsPending false for every row.
type Skill struct {
	Name        string
	IsPending   bool
	CertifiedTo *time.Time
}

// Feedback is one written customer review.
type Feedback struct {
	ID      uuid.UUID
	Rating  float64
	Comment string
	Author  string
	At      time.Time
}

// RecentJob is one finished booking on the profile's history table.
type RecentJob struct {
	BookingID   uuid.UUID
	Service     string
	At          time.Time
	IsCancelled bool
	Rating      *float64
	AmountPaise int64
}

// Suspension is the live suspension on a profile, when one stands.
type Suspension struct {
	Until  time.Time
	Reason SuspendReason
	ByName string
}

// Profile is the full provider record behind the console's profile screen.
type Profile struct {
	ID                 uuid.UUID
	Name               string
	Phone              string
	Status             ProviderStatus
	IsVerified         bool
	Rating             float64
	JobsTotal          int32
	JoinedAt           time.Time
	Zone               string
	Zones              []string
	JobsToday          int32
	EarningsTodayPaise int64
	PayoutCyclePaise   int64
	Skills             []Skill
	Metrics            []Metric
	RecentJobs         []RecentJob
	Feedback           []Feedback
	Suspension         *Suspension
	OffboardedAt       *time.Time
	// Version is the standing row's optimistic-concurrency token (0 when the provider has
	// never been acted on); every provider mutation echoes it.
	Version int32
}

const profileRecentJobsLimit = 10
const profileFeedbackLimit = 5

// Profile reads the full provider record. ErrProviderNotFound when the id is not a
// (non-deleted) technician.
func (service *Service) Profile(ctx context.Context, technicianID uuid.UUID) (Profile, error) {
	queries := sqlcgen.New(service.pool)
	now := time.Now()

	core, err := queries.AdminGetProvider(ctx, sqlcgen.AdminGetProviderParams{
		StaleAfterSeconds: staleAfterSeconds,
		TechnicianID:      technicianID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Profile{}, ErrProviderNotFound
	}
	if err != nil {
		return Profile{}, fmt.Errorf("reading provider: %w", err)
	}

	stats, err := queries.AdminProviderJobStats(ctx, sqlcgen.AdminProviderJobStatsParams{
		TechnicianID: &technicianID,
		TodayStart:   pgtype.Timestamptz{Time: istDayStart(now), Valid: true},
		CycleStart:   pgtype.Timestamptz{Time: istCycleStart(now), Valid: true},
	})
	if err != nil {
		return Profile{}, fmt.Errorf("reading provider stats: %w", err)
	}

	skillNames, err := queries.AdminProviderSkills(ctx, technicianID)
	if err != nil {
		return Profile{}, fmt.Errorf("reading provider skills: %w", err)
	}

	metrics, err := service.performanceMetrics(ctx, queries, technicianID, numericToFloat(core.Rating), now)
	if err != nil {
		return Profile{}, err
	}

	jobRows, err := queries.AdminProviderRecentJobs(ctx, sqlcgen.AdminProviderRecentJobsParams{
		TechnicianID: &technicianID,
		RowLimit:     profileRecentJobsLimit,
	})
	if err != nil {
		return Profile{}, fmt.Errorf("reading recent jobs: %w", err)
	}

	feedbackRows, err := queries.AdminProviderFeedback(ctx, sqlcgen.AdminProviderFeedbackParams{
		TechnicianID: technicianID,
		RowLimit:     profileFeedbackLimit,
	})
	if err != nil {
		return Profile{}, fmt.Errorf("reading feedback: %w", err)
	}

	profile := Profile{
		ID:     core.UserID,
		Name:   core.Name,
		Phone:  core.Phone,
		Status: ProviderStatus(core.Status),
		// Technicians are pre-provisioned salaried staff; existing on the roster IS the
		// verification until a provider-documents model arrives.
		IsVerified:         true,
		Rating:             numericToFloat(core.Rating),
		JobsTotal:          stats.JobsTotal,
		JoinedAt:           core.JoinedAt.Time,
		Zone:               core.Zone,
		Zones:              []string{core.Zone},
		JobsToday:          stats.CompletedToday + stats.ActiveNow,
		EarningsTodayPaise: stats.EarningsToday,
		PayoutCyclePaise:   stats.CycleRevenue,
		Skills:             make([]Skill, len(skillNames)),
		Metrics:            metrics,
		RecentJobs:         make([]RecentJob, len(jobRows)),
		Feedback:           make([]Feedback, len(feedbackRows)),
		Version:            int32(core.StandingVersion),
	}
	for index, name := range skillNames {
		profile.Skills[index] = Skill{Name: name}
	}
	for index, jobRow := range jobRows {
		job := RecentJob{
			BookingID:   jobRow.ID,
			Service:     jobRow.ServiceName,
			At:          jobRow.StateAt.Time,
			IsCancelled: jobRow.State != "COMPLETED",
			AmountPaise: int64(jobRow.QuotedTotalPaise),
		}
		if jobRow.ReviewRating != nil {
			rating := float64(*jobRow.ReviewRating)
			job.Rating = &rating
		}
		profile.RecentJobs[index] = job
	}
	for index, feedbackRow := range feedbackRows {
		profile.Feedback[index] = Feedback{
			ID:      feedbackRow.ID,
			Rating:  float64(feedbackRow.Rating),
			Comment: feedbackRow.Comment,
			Author:  feedbackRow.Author,
			At:      feedbackRow.CreatedAt.Time,
		}
	}

	if core.Standing != nil {
		standing, err := ParseStanding(*core.Standing)
		if err != nil {
			return Profile{}, err
		}
		switch standing {
		case StandingSuspended:
			if profile.Status == ProviderSuspended && core.SuspendedUntil.Valid {
				suspension := Suspension{Until: core.SuspendedUntil.Time}
				if core.ReasonCode != nil {
					suspension.Reason = SuspendReason(*core.ReasonCode)
				}
				if core.DecidedByName != nil {
					suspension.ByName = *core.DecidedByName
				}
				profile.Suspension = &suspension
			}
		case StandingBlocked:
			if core.DecidedAt.Valid {
				offboardedAt := core.DecidedAt.Time
				profile.OffboardedAt = &offboardedAt
			}
		case StandingActive:
			// Nothing standing against the provider.
		}
	}

	return profile, nil
}

// performanceMetrics computes the profile's tiles from real bookings and reviews: a 90-day
// window in 8 buckets for the trends, a 30-day window for the jobs30 headline.
func (service *Service) performanceMetrics(ctx context.Context, queries *sqlcgen.Queries, technicianID uuid.UUID, currentRating float64, now time.Time) ([]Metric, error) {
	windowFrom := now.Add(-performanceWindow)
	buckets, err := queries.AdminProviderPerformanceBuckets(ctx, sqlcgen.AdminProviderPerformanceBucketsParams{
		TechnicianID: &technicianID,
		FromTime:     pgtype.Timestamptz{Time: windowFrom, Valid: true},
		ToTime:       pgtype.Timestamptz{Time: now, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("bucketing provider performance: %w", err)
	}
	ratingBuckets, err := queries.AdminProviderRatingBuckets(ctx, sqlcgen.AdminProviderRatingBucketsParams{
		TechnicianID: technicianID,
		FromTime:     pgtype.Timestamptz{Time: windowFrom, Valid: true},
		ToTime:       pgtype.Timestamptz{Time: now, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("bucketing provider ratings: %w", err)
	}
	recentBuckets, err := queries.AdminProviderPerformanceBuckets(ctx, sqlcgen.AdminProviderPerformanceBucketsParams{
		TechnicianID: &technicianID,
		FromTime:     pgtype.Timestamptz{Time: now.Add(-jobs30Window), Valid: true},
		ToTime:       pgtype.Timestamptz{Time: now, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("counting recent jobs: %w", err)
	}

	completionTrend := make([]float64, trendPoints)
	cancellationTrend := make([]float64, trendPoints)
	escalationTrend := make([]float64, trendPoints)
	jobsTrend := make([]float64, trendPoints)
	ratingTrend := make([]float64, trendPoints)

	var assigned, completed, cancelled, terminal, escalated int32
	for _, bucket := range buckets {
		index, inRange := trendIndex(bucket.Bucket)
		if inRange {
			jobsTrend[index] = float64(bucket.Assigned)
			if bucket.Terminal > 0 {
				completionTrend[index] = float64(bucket.Completed) / float64(bucket.Terminal)
				cancellationTrend[index] = float64(bucket.Cancelled) / float64(bucket.Terminal)
			}
			if bucket.Assigned > 0 {
				escalationTrend[index] = float64(bucket.Escalated) / float64(bucket.Assigned)
			}
		}
		assigned += bucket.Assigned
		completed += bucket.Completed
		cancelled += bucket.Cancelled
		terminal += bucket.Terminal
		escalated += bucket.Escalated
	}
	for _, bucket := range ratingBuckets {
		if index, inRange := trendIndex(bucket.Bucket); inRange {
			ratingTrend[index] = bucket.AvgRating
		}
	}
	var jobs30 int32
	for _, bucket := range recentBuckets {
		jobs30 += bucket.Assigned
	}

	completionRate := ratio(completed, terminal)
	cancellationRate := ratio(cancelled, terminal)
	escalationRate := ratio(escalated, assigned)

	return []Metric{
		{ID: MetricCompletion, Value: completionRate, Unit: UnitPercent,
			Band: bandHighGood(completionRate, 0.95, 0.85), Trend: completionTrend},
		{ID: MetricEscalation, Value: escalationRate, Unit: UnitPercent,
			Band: bandLowGood(escalationRate, 0.05, 0.15), Trend: escalationTrend},
		{ID: MetricCancellation, Value: cancellationRate, Unit: UnitPercent,
			Band: bandLowGood(cancellationRate, 0.05, 0.15), Trend: cancellationTrend},
		{ID: MetricRating, Value: currentRating, Unit: UnitRating,
			Band: bandHighGood(currentRating, 4.5, 4.0), Trend: ratingTrend},
		{ID: MetricJobs30, Value: float64(jobs30), Unit: UnitCount,
			Band: bandHighGood(float64(jobs30), 20, 8), Trend: jobsTrend},
	}, nil
}

func ratio(numerator, denominator int32) float64 {
	if denominator == 0 {
		return 0
	}
	return float64(numerator) / float64(denominator)
}

// bandHighGood bands a metric where MORE is better (completion, rating, volume).
func bandHighGood(value, goodAtLeast, watchAtLeast float64) MetricBand {
	switch {
	case value >= goodAtLeast:
		return BandGood
	case value >= watchAtLeast:
		return BandWatch
	default:
		return BandPoor
	}
}

// bandLowGood bands a metric where LESS is better (escalation, cancellation).
func bandLowGood(value, goodAtMost, watchAtMost float64) MetricBand {
	switch {
	case value <= goodAtMost:
		return BandGood
	case value <= watchAtMost:
		return BandWatch
	default:
		return BandPoor
	}
}

// trendIndex maps width_bucket's 1-based bucket to a trend index.
func trendIndex(bucket int32) (int, bool) {
	if bucket < 1 || bucket > trendPoints {
		return 0, false
	}
	return int(bucket - 1), true
}

// ---------------------------------------------------------------------------
// Active jobs (step 3 of the suspend flow)

// ActiveJob is one live job a suspension would strand.
type ActiveJob struct {
	BookingID    uuid.UUID
	CustomerName string
	Service      string
	Zone         string
	Stage        JobStage
	// EtaMinutes is always nil: no ETA engine exists yet, and inventing one here would put
	// a made-up number in front of an operator deciding whether to strand a customer.
	EtaMinutes  *int32
	StartedAt   *time.Time
	AmountPaise int64
	// SuggestedProviderName is who the assignment engine would hand this booking to next —
	// the same candidate ranking dispatch uses, minus the provider being suspended. Empty
	// when no eligible candidate exists.
	SuggestedProviderName string
}

// ActiveJobs lists the provider's live jobs with a reassignment suggestion per job.
// ErrProviderNotFound when the id is not a technician.
func (service *Service) ActiveJobs(ctx context.Context, technicianID uuid.UUID) ([]ActiveJob, error) {
	queries := sqlcgen.New(service.pool)
	if _, err := queries.AdminGetProvider(ctx, sqlcgen.AdminGetProviderParams{
		StaleAfterSeconds: staleAfterSeconds,
		TechnicianID:      technicianID,
	}); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrProviderNotFound
	} else if err != nil {
		return nil, fmt.Errorf("reading provider: %w", err)
	}

	rows, err := queries.AdminProviderActiveJobs(ctx, &technicianID)
	if err != nil {
		return nil, fmt.Errorf("reading active jobs: %w", err)
	}

	jobs := make([]ActiveJob, len(rows))
	for index, row := range rows {
		job := ActiveJob{
			BookingID:    row.ID,
			CustomerName: row.CustomerName,
			Service:      row.ServiceName,
			Zone:         row.City,
			Stage:        stageOfState(row.State),
			AmountPaise:  int64(row.QuotedTotalPaise),
		}
		if row.StartedAt.Valid {
			startedAt := row.StartedAt.Time
			job.StartedAt = &startedAt
		}
		job.SuggestedProviderName = service.suggestedCandidate(ctx, row.ID, technicianID)
		jobs[index] = job
	}
	return jobs, nil
}

// suggestedCandidate runs the real dispatch ranking for the booking and returns the best
// candidate who is not the provider being suspended. Best effort: an error here must not
// sink the suspend flow, so it degrades to no suggestion.
func (service *Service) suggestedCandidate(ctx context.Context, bookingID, excludeTechnicianID uuid.UUID) string {
	candidates, err := service.ops.Candidates(ctx, bookingID)
	if err != nil {
		return ""
	}
	for _, candidate := range candidates {
		if candidate.TechnicianID != excludeTechnicianID {
			return candidate.Name
		}
	}
	return ""
}
