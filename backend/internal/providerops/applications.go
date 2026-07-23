package providerops

// The provider-application pipeline: the queue, the review (with SERVER-computed approval
// blockers — the console mirrors them, it never decides), and the three decisions. Approval
// provisions a real TECHNICIAN identity through the identity service in the same
// transaction as the status change; rejection is terminal.
//
// Honest gap: the contract promises the applicant an SMS on rejection and on a documents
// request. The only SMS path today is the OTP-template-bound sender (DLT rules — the
// message text lives in the approved template), so no applicant SMS is sent yet; the
// decision is recorded and audited, and the notification intent lives in the audit entry.

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/kokkondaBhanuteja/sethu-care/internal/audit"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// ApplicationSegment is the console's three-way slice of the queue.
type ApplicationSegment string

const (
	SegmentPending      ApplicationSegment = "pending"
	SegmentAwaitingDocs ApplicationSegment = "awaitingDocs"
	SegmentDecided      ApplicationSegment = "decided"
)

func applicationStatusesOfSegment(segment ApplicationSegment) ([]string, error) {
	switch segment {
	case SegmentPending, "":
		return []string{string(ApplicationPending)}, nil
	case SegmentAwaitingDocs:
		return []string{string(ApplicationAwaitingDocs)}, nil
	case SegmentDecided:
		return []string{string(ApplicationApproved), string(ApplicationRejected)}, nil
	}
	return nil, fmt.Errorf("providerops: unknown application segment %q", segment)
}

// ApplicationListInput is the console's queue request.
type ApplicationListInput struct {
	Segment ApplicationSegment
	Limit   int32
	Cursor  string
}

// ApplicationRow is one queue row.
type ApplicationRow struct {
	ID            uuid.UUID
	ApplicantName string
	Categories    []string
	Zone          string
	AppliedAt     time.Time
	// DaysWaiting is nil once decided — the 48-hour clock stops with the decision.
	DaysWaiting          *int32
	DocumentsPresent     int32
	DocumentsRequired    int32
	Status               ApplicationStatus
	AwaitingDocumentType *DocumentType
	DecidedAt            *time.Time
}

// ApplicationCounts is the queue's chip row, across the whole queue.
type ApplicationCounts struct {
	Pending      int32
	AwaitingDocs int32
	Decided      int32
}

// ApplicationQueuePage is one page of the queue plus the whole-queue context.
type ApplicationQueuePage struct {
	Rows   []ApplicationRow
	Counts ApplicationCounts
	// OldestDays ages the oldest undecided application against the 48-hour SLA.
	OldestDays int32
	// Total counts every row the current segment matches, not this page.
	Total      int32
	NextCursor string
}

const defaultApplicationLimit = 20
const maxApplicationLimit = 100

// Applications returns the queue, oldest first, keyset-paginated on (appliedAt, id).
func (service *Service) Applications(ctx context.Context, in ApplicationListInput) (ApplicationQueuePage, error) {
	limit := in.Limit
	if limit <= 0 {
		limit = defaultApplicationLimit
	}
	if limit > maxApplicationLimit {
		limit = maxApplicationLimit
	}
	statuses, err := applicationStatusesOfSegment(in.Segment)
	if err != nil {
		return ApplicationQueuePage{}, err
	}

	params := sqlcgen.AdminListApplicationsParams{
		Statuses: statuses,
		RowLimit: limit + 1, // the one-beyond peek, as everywhere
	}
	if in.Cursor != "" {
		cursorAppliedAt, cursorID, err := decodeApplicationCursor(in.Cursor)
		if err != nil {
			return ApplicationQueuePage{}, err
		}
		params.CursorAppliedAt = pgtype.Timestamptz{Time: cursorAppliedAt, Valid: true}
		params.CursorID = &cursorID
	}

	queries := sqlcgen.New(service.pool)
	rows, err := queries.AdminListApplications(ctx, params)
	if err != nil {
		return ApplicationQueuePage{}, fmt.Errorf("listing applications: %w", err)
	}
	hasMore := len(rows) > int(limit)
	if hasMore {
		rows = rows[:limit]
	}

	pageIDs := make([]uuid.UUID, len(rows))
	for index, row := range rows {
		pageIDs[index] = row.ID
	}
	awaitingRows, err := queries.AdminApplicationsAwaitingTypes(ctx, pageIDs)
	if err != nil {
		return ApplicationQueuePage{}, fmt.Errorf("reading awaited documents: %w", err)
	}
	awaitingByID := make(map[uuid.UUID]DocumentType, len(awaitingRows))
	for _, awaitingRow := range awaitingRows {
		awaitingByID[awaitingRow.ApplicationID] = DocumentType(awaitingRow.DocumentType)
	}

	now := time.Now()
	page := ApplicationQueuePage{Rows: make([]ApplicationRow, len(rows))}
	for index, row := range rows {
		status, err := ParseApplicationStatus(row.Status)
		if err != nil {
			return ApplicationQueuePage{}, err
		}
		applicationRow := ApplicationRow{
			ID:                row.ID,
			ApplicantName:     row.ApplicantName,
			Categories:        row.Categories,
			Zone:              row.Zone,
			AppliedAt:         row.AppliedAt.Time,
			DocumentsPresent:  row.DocumentsPresent,
			DocumentsRequired: row.DocumentsRequired,
			Status:            status,
		}
		if status.Decided() {
			if row.DecidedAt.Valid {
				decidedAt := row.DecidedAt.Time
				applicationRow.DecidedAt = &decidedAt
			}
		} else {
			daysWaiting := int32(now.Sub(row.AppliedAt.Time).Hours() / 24)
			applicationRow.DaysWaiting = &daysWaiting
			if awaited, hasAwaited := awaitingByID[row.ID]; hasAwaited {
				applicationRow.AwaitingDocumentType = &awaited
			}
		}
		page.Rows[index] = applicationRow
	}
	if hasMore {
		last := rows[len(rows)-1]
		page.NextCursor = encodeApplicationCursor(last.AppliedAt.Time, last.ID)
	}

	summary, err := queries.AdminApplicationsSummary(ctx)
	if err != nil {
		return ApplicationQueuePage{}, fmt.Errorf("reading applications summary: %w", err)
	}
	page.Counts = ApplicationCounts{
		Pending:      summary.Pending,
		AwaitingDocs: summary.AwaitingDocs,
		Decided:      summary.Decided,
	}
	if summary.OldestUndecidedAt.Valid {
		page.OldestDays = int32(now.Sub(summary.OldestUndecidedAt.Time).Hours() / 24)
	}
	for _, status := range statuses {
		switch ApplicationStatus(status) {
		case ApplicationPending:
			page.Total += summary.Pending
		case ApplicationAwaitingDocs:
			page.Total += summary.AwaitingDocs
		case ApplicationApproved, ApplicationRejected:
			// The decided segment carries both; adding once per member keeps the sum right
			// because Decided counts approved and rejected together.
		}
	}
	if in.Segment == SegmentDecided {
		page.Total = summary.Decided
	}
	return page, nil
}

// ---------------------------------------------------------------------------
// Review

// ApplicationCategory is one claimed capability.
type ApplicationCategory struct {
	Name         string
	YearsClaimed int32
}

// ApplicationDocument is one checklist row.
type ApplicationDocument struct {
	ID          uuid.UUID
	Type        DocumentType
	Validation  DocumentValidation
	UploadedAt  *time.Time
	ExpiresAt   *time.Time
	Detail      string
	OcrRead     string
	OcrExpected string
	SizeBytes   int64
	URL         string
}

// AutoCheck is one automated check that actually ran. Only checks backed by real data
// exist: EXPIRY when a document carries an expiry, OCR when an expected value was recorded.
// There is no blur detection, so no BLUR checks are ever claimed.
type AutoCheck struct {
	ID     string
	Code   AutoCheckCode
	Passed bool
	Detail string
}

// ApprovalBlocker is one server-computed reason approval is refused.
type ApprovalBlocker struct {
	ID           string
	Code         BlockerCode
	DocumentType *DocumentType
}

// Decision is the terminal outcome an application reached.
type Decision struct {
	Outcome ApplicationStatus
	ByName  string
	At      time.Time
}

// ApplicationReview is the full record behind the review screen.
type ApplicationReview struct {
	ID                  uuid.UUID
	Status              ApplicationStatus
	ApplicantName       string
	Phone               string
	Email               string
	Address             string
	AppliedAt           time.Time
	DaysWaiting         *int32
	Categories          []ApplicationCategory
	Documents           []ApplicationDocument
	DocumentsRequired   int32
	BackgroundClearedAt *time.Time
	PriorApplications   int32
	AutoValidation      []AutoCheck
	ApprovalBlockers    []ApprovalBlocker
	Decision            *Decision
	Version             int32
}

// Application reads the full review record. ErrApplicationNotFound when the id is unknown.
func (service *Service) Application(ctx context.Context, applicationID uuid.UUID) (ApplicationReview, error) {
	queries := sqlcgen.New(service.pool)
	row, err := queries.AdminGetApplication(ctx, applicationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ApplicationReview{}, ErrApplicationNotFound
	}
	if err != nil {
		return ApplicationReview{}, fmt.Errorf("reading application: %w", err)
	}

	status, err := ParseApplicationStatus(row.Status)
	if err != nil {
		return ApplicationReview{}, err
	}

	categoryRows, err := queries.AdminApplicationCategories(ctx, applicationID)
	if err != nil {
		return ApplicationReview{}, fmt.Errorf("reading application categories: %w", err)
	}
	documentRows, err := queries.AdminApplicationDocuments(ctx, applicationID)
	if err != nil {
		return ApplicationReview{}, fmt.Errorf("reading application documents: %w", err)
	}
	priorCount, err := queries.AdminCountPriorApplications(ctx, sqlcgen.AdminCountPriorApplicationsParams{
		Phone:         row.Phone,
		ApplicationID: applicationID,
	})
	if err != nil {
		return ApplicationReview{}, fmt.Errorf("counting prior applications: %w", err)
	}

	review := ApplicationReview{
		ID:                row.ID,
		Status:            status,
		ApplicantName:     row.ApplicantName,
		Phone:             row.Phone,
		Email:             row.Email,
		Address:           row.Address,
		AppliedAt:         row.AppliedAt.Time,
		Categories:        make([]ApplicationCategory, len(categoryRows)),
		Documents:         make([]ApplicationDocument, len(documentRows)),
		DocumentsRequired: row.DocumentsRequired,
		PriorApplications: priorCount,
		Version:           int32(row.Version),
	}
	if row.BackgroundClearedAt.Valid {
		clearedAt := row.BackgroundClearedAt.Time
		review.BackgroundClearedAt = &clearedAt
	}
	if status.Decided() {
		decision := Decision{Outcome: status, At: row.DecidedAt.Time}
		if row.DecidedByName != nil {
			decision.ByName = *row.DecidedByName
		}
		review.Decision = &decision
	} else {
		daysWaiting := int32(time.Since(row.AppliedAt.Time).Hours() / 24)
		review.DaysWaiting = &daysWaiting
	}

	for index, categoryRow := range categoryRows {
		review.Categories[index] = ApplicationCategory{
			Name:         categoryRow.Name,
			YearsClaimed: categoryRow.YearsClaimed,
		}
	}
	now := time.Now()
	for index, documentRow := range documentRows {
		document := ApplicationDocument{
			ID:          documentRow.ID,
			Type:        DocumentType(documentRow.DocumentType),
			Validation:  DocumentValidation(documentRow.Validation),
			Detail:      documentRow.Detail,
			OcrRead:     documentRow.OcrRead,
			OcrExpected: documentRow.OcrExpected,
			SizeBytes:   documentRow.SizeBytes,
			URL:         documentRow.Url,
		}
		if documentRow.UploadedAt.Valid {
			uploadedAt := documentRow.UploadedAt.Time
			document.UploadedAt = &uploadedAt
		}
		if documentRow.ExpiresAt.Valid {
			expiresAt := documentRow.ExpiresAt.Time
			document.ExpiresAt = &expiresAt
		}
		review.Documents[index] = document
	}
	review.AutoValidation = autoChecksOf(review.Documents, now)
	review.ApprovalBlockers = approvalBlockersOf(review.Documents, review.BackgroundClearedAt, now)
	return review, nil
}

// autoChecksOf derives the automated checks from the data each document actually carries.
func autoChecksOf(documents []ApplicationDocument, now time.Time) []AutoCheck {
	checks := make([]AutoCheck, 0, len(documents))
	for _, document := range documents {
		typeSlug := strings.ToLower(string(document.Type))
		if document.ExpiresAt != nil {
			checks = append(checks, AutoCheck{
				ID:     typeSlug + "-expiry",
				Code:   AutoCheckExpiry,
				Passed: document.ExpiresAt.After(now),
				Detail: document.ExpiresAt.Format(time.DateOnly),
			})
		}
		if document.OcrExpected != "" {
			checks = append(checks, AutoCheck{
				ID:     typeSlug + "-ocr",
				Code:   AutoCheckOCR,
				Passed: document.OcrRead == document.OcrExpected,
				Detail: document.OcrRead,
			})
		}
	}
	return checks
}

// approvalBlockersOf is THE approval gate, computed on the server: a missing police
// verification (or uncleared background) blocks as POLICE_VERIFICATION_PENDING, any other
// missing document as MISSING_DOCUMENT, and an expired document as EXPIRED_DOCUMENT.
func approvalBlockersOf(documents []ApplicationDocument, backgroundClearedAt *time.Time, now time.Time) []ApprovalBlocker {
	blockers := []ApprovalBlocker{}
	policeBlocked := false
	for _, document := range documents {
		documentType := document.Type
		typeSlug := strings.ToLower(string(documentType))
		switch {
		case document.Validation == DocumentMissing && documentType == DocumentPoliceVerification:
			blockers = append(blockers, ApprovalBlocker{
				ID: "police-verification", Code: BlockerPoliceVerificationPending, DocumentType: &documentType,
			})
			policeBlocked = true
		case document.Validation == DocumentMissing:
			blockers = append(blockers, ApprovalBlocker{
				ID: "missing-" + typeSlug, Code: BlockerMissingDocument, DocumentType: &documentType,
			})
		case document.ExpiresAt != nil && !document.ExpiresAt.After(now):
			blockers = append(blockers, ApprovalBlocker{
				ID: "expired-" + typeSlug, Code: BlockerExpiredDocument, DocumentType: &documentType,
			})
		}
	}
	if backgroundClearedAt == nil && !policeBlocked {
		blockers = append(blockers, ApprovalBlocker{
			ID: "background-check", Code: BlockerPoliceVerificationPending,
		})
	}
	return blockers
}

// ---------------------------------------------------------------------------
// Decisions

// DecisionInput identifies the application, the acting admin and the version they read.
type DecisionInput struct {
	ApplicationID   uuid.UUID
	ActorID         uuid.UUID
	ExpectedVersion int32
}

// DecisionResult names what was decided, for the console's confirmation line.
type DecisionResult struct {
	ApplicationID uuid.UUID
	ApplicantName string
	Version       int32
}

// Approve approves an application: blockers must be clear, and a TECHNICIAN identity is
// provisioned in the same transaction as the status change — the applicant can authenticate
// through the provider app's OTP flow the moment this returns.
func (service *Service) Approve(ctx context.Context, in DecisionInput) (DecisionResult, error) {
	review, err := service.Application(ctx, in.ApplicationID)
	if err != nil {
		return DecisionResult{}, err
	}
	if review.Decision != nil {
		return DecisionResult{}, alreadyDecided(review)
	}
	if review.Version != in.ExpectedVersion {
		return DecisionResult{}, &StaleVersionError{CurrentVersion: review.Version}
	}
	if len(review.ApprovalBlockers) > 0 {
		return DecisionResult{}, &ApprovalBlockedError{Blockers: review.ApprovalBlockers}
	}

	result := DecisionResult{ApplicationID: in.ApplicationID, ApplicantName: review.ApplicantName}
	err = storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		queries := sqlcgen.New(tx)

		// The zone the applicant applied for becomes their dispatch city.
		zone, err := service.applicationZone(ctx, queries, in.ApplicationID)
		if err != nil {
			return err
		}
		technicianID, err := service.identity.ProvisionTechnician(ctx, tx, review.ApplicantName, review.Phone, zone)
		if err != nil {
			return err
		}

		version, err := queries.DecideApplication(ctx, sqlcgen.DecideApplicationParams{
			Status:               string(ApplicationApproved),
			DecidedBy:            &in.ActorID,
			ApprovedTechnicianID: &technicianID,
			ApplicationID:        in.ApplicationID,
			ExpectedVersion:      int64(in.ExpectedVersion),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			// Beaten between the pre-read and the CAS: re-read and report what happened.
			return service.decisionConflict(ctx, in.ApplicationID)
		}
		if err != nil {
			return fmt.Errorf("approving application: %w", err)
		}
		result.Version = int32(version)

		return audit.Record(ctx, tx, audit.Entry{
			ActorUserID: &in.ActorID,
			Action:      "APPLICATION_APPROVE",
			EntityType:  "application",
			EntityID:    in.ApplicationID,
			Before:      map[string]string{"status": string(review.Status)},
			After: map[string]string{
				"status":       string(ApplicationApproved),
				"technicianId": technicianID.String(),
			},
		})
	})
	if err != nil {
		return DecisionResult{}, err
	}
	return result, nil
}

// RejectInput is Approve's input plus the mandated reason and note.
type RejectInput struct {
	DecisionInput
	Reason RejectReason
	// Note must be at least 20 characters — a rejection without a substantive reason on
	// record is not reviewable later.
	Note string
}

const rejectNoteMinLength = 20

// Reject rejects an application. Terminal: the record can never be decided again.
func (service *Service) Reject(ctx context.Context, in RejectInput) (DecisionResult, error) {
	if len(strings.TrimSpace(in.Note)) < rejectNoteMinLength {
		return DecisionResult{}, ErrNoteTooShort
	}
	if !in.Reason.Valid() {
		return DecisionResult{}, fmt.Errorf("providerops: unknown reject reason %q", in.Reason)
	}

	review, err := service.Application(ctx, in.ApplicationID)
	if err != nil {
		return DecisionResult{}, err
	}
	if review.Decision != nil {
		return DecisionResult{}, alreadyDecided(review)
	}
	if review.Version != in.ExpectedVersion {
		return DecisionResult{}, &StaleVersionError{CurrentVersion: review.Version}
	}

	result := DecisionResult{ApplicationID: in.ApplicationID, ApplicantName: review.ApplicantName}
	err = storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		queries := sqlcgen.New(tx)
		reasonCode := string(in.Reason)
		version, err := queries.DecideApplication(ctx, sqlcgen.DecideApplicationParams{
			Status:             string(ApplicationRejected),
			DecidedBy:          &in.ActorID,
			DecisionReasonCode: &reasonCode,
			DecisionNote:       in.Note,
			ApplicationID:      in.ApplicationID,
			ExpectedVersion:    int64(in.ExpectedVersion),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return service.decisionConflict(ctx, in.ApplicationID)
		}
		if err != nil {
			return fmt.Errorf("rejecting application: %w", err)
		}
		result.Version = int32(version)

		return audit.Record(ctx, tx, audit.Entry{
			ActorUserID: &in.ActorID,
			Action:      "APPLICATION_REJECT",
			EntityType:  "application",
			EntityID:    in.ApplicationID,
			Before:      map[string]string{"status": string(review.Status)},
			After: map[string]string{
				"status":     string(ApplicationRejected),
				"reasonCode": reasonCode,
				"note":       in.Note,
			},
		})
	})
	if err != nil {
		return DecisionResult{}, err
	}
	return result, nil
}

// RequestDocumentsInput asks the applicant for more documents.
type RequestDocumentsInput struct {
	ApplicationID   uuid.UUID
	ActorID         uuid.UUID
	DocumentTypes   []DocumentType
	Note            string
	ExpectedVersion int32
}

// RequestDocumentsResult echoes what was requested and when.
type RequestDocumentsResult struct {
	ApplicationID  uuid.UUID
	RequestedTypes []DocumentType
	SentAt         time.Time
	Version        int32
}

// RequestDocuments records the ask: the named types join the checklist as missing, the
// application moves to awaiting_docs, and the ask is audited. (No applicant SMS goes out
// yet — see the package comment.)
func (service *Service) RequestDocuments(ctx context.Context, in RequestDocumentsInput) (RequestDocumentsResult, error) {
	if len(in.DocumentTypes) == 0 {
		return RequestDocumentsResult{}, ErrNoDocumentsRequested
	}
	requested := make([]string, len(in.DocumentTypes))
	for index, documentType := range in.DocumentTypes {
		if !documentType.Valid() {
			return RequestDocumentsResult{}, fmt.Errorf("providerops: unknown document type %q", documentType)
		}
		requested[index] = string(documentType)
	}

	review, err := service.Application(ctx, in.ApplicationID)
	if err != nil {
		return RequestDocumentsResult{}, err
	}
	if review.Decision != nil {
		return RequestDocumentsResult{}, ErrApplicationDecided
	}
	if review.Version != in.ExpectedVersion {
		return RequestDocumentsResult{}, &StaleVersionError{CurrentVersion: review.Version}
	}

	result := RequestDocumentsResult{ApplicationID: in.ApplicationID, RequestedTypes: in.DocumentTypes}
	err = storage.InTx(ctx, service.pool, func(tx pgx.Tx) error {
		queries := sqlcgen.New(tx)
		marked, err := queries.MarkApplicationAwaitingDocuments(ctx, sqlcgen.MarkApplicationAwaitingDocumentsParams{
			Note:            in.Note,
			ApplicationID:   in.ApplicationID,
			ExpectedVersion: int64(in.ExpectedVersion),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return service.decisionConflict(ctx, in.ApplicationID)
		}
		if err != nil {
			return fmt.Errorf("marking application awaiting documents: %w", err)
		}
		result.Version = int32(marked.Version)
		result.SentAt = marked.DocumentsRequestedAt.Time

		for _, documentType := range in.DocumentTypes {
			if err := queries.EnsureApplicationDocumentRequested(ctx, sqlcgen.EnsureApplicationDocumentRequestedParams{
				ApplicationID: in.ApplicationID,
				DocumentType:  string(documentType),
			}); err != nil {
				return fmt.Errorf("recording requested document: %w", err)
			}
		}

		return audit.Record(ctx, tx, audit.Entry{
			ActorUserID: &in.ActorID,
			Action:      "APPLICATION_REQUEST_DOCUMENTS",
			EntityType:  "application",
			EntityID:    in.ApplicationID,
			After: map[string]any{
				"documentTypes": requested,
				"note":          in.Note,
			},
		})
	})
	if err != nil {
		return RequestDocumentsResult{}, err
	}
	return result, nil
}

// applicationZone reads the zone straight off the row (the review shape does not carry it).
func (service *Service) applicationZone(ctx context.Context, queries *sqlcgen.Queries, applicationID uuid.UUID) (string, error) {
	row, err := queries.AdminGetApplication(ctx, applicationID)
	if err != nil {
		return "", fmt.Errorf("reading application zone: %w", err)
	}
	return row.Zone, nil
}

// alreadyDecided shapes the conflict the console renders as the already-decided record.
func alreadyDecided(review ApplicationReview) error {
	return &AlreadyDecidedError{
		Outcome: review.Decision.Outcome,
		ByName:  review.Decision.ByName,
		At:      review.Decision.At,
	}
}

// decisionConflict re-reads after a zero-row CAS and reports the honest cause: decided by
// someone else, or merely a newer version.
func (service *Service) decisionConflict(ctx context.Context, applicationID uuid.UUID) error {
	review, err := service.Application(ctx, applicationID)
	if err != nil {
		return err
	}
	if review.Decision != nil {
		return alreadyDecided(review)
	}
	return &StaleVersionError{CurrentVersion: review.Version}
}

func encodeApplicationCursor(appliedAt time.Time, applicationID uuid.UUID) string {
	raw := fmt.Sprintf("%d|%s", appliedAt.UnixNano(), applicationID)
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeApplicationCursor(cursor string) (time.Time, uuid.UUID, error) {
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, uuid.Nil, ErrInvalidCursor
	}
	parts := strings.SplitN(string(raw), "|", 2)
	if len(parts) != 2 {
		return time.Time{}, uuid.Nil, ErrInvalidCursor
	}
	var nanos int64
	if _, err := fmt.Sscanf(parts[0], "%d", &nanos); err != nil {
		return time.Time{}, uuid.Nil, ErrInvalidCursor
	}
	applicationID, err := uuid.Parse(parts[1])
	if err != nil {
		return time.Time{}, uuid.Nil, ErrInvalidCursor
	}
	return time.Unix(0, nanos), applicationID, nil
}

// PendingApplicationsCount serves the shell badge: applications an admin still must decide
// (pending plus awaiting-documents — the same figure the roster's strip shows).
func (service *Service) PendingApplicationsCount(ctx context.Context) (int32, error) {
	summary, err := sqlcgen.New(service.pool).AdminApplicationsSummary(ctx)
	if err != nil {
		return 0, fmt.Errorf("reading applications summary: %w", err)
	}
	return summary.Pending + summary.AwaitingDocs, nil
}
