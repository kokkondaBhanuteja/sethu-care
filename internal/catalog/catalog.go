package catalog

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/sqlcgen"
)

// Naming: the domain noun here is "Service" (a bookable service), so the application layer is
// Catalog, not catalog.Service — otherwise the two would collide.

var (
	ErrServiceNotFound  = errors.New("catalog: service not found")
	ErrCategoryNotFound = errors.New("catalog: category not found")
)

// Category groups services (AC, Plumbing, ...).
type Category struct {
	ID        uuid.UUID
	Name      string
	Slug      string
	SortOrder int32
}

// Variant is a priced option of a service ("Standard", "Deep clean").
type Variant struct {
	ID    uuid.UUID
	Name  string
	Price money.Money
}

// Service is a bookable service, with its variants when read in detail.
type Service struct {
	ID               uuid.UUID
	CategoryID       uuid.UUID
	Name             string
	Slug             string
	Description      string
	AssignmentMode   AssignmentMode
	EstimatedMinutes int32
	Variants         []Variant
	Questions        []Question
}

// Question is a dynamic question asked at booking time.
type Question struct {
	ID       uuid.UUID
	Prompt   string
	Kind     QuestionKind
	Options  []string
	Required bool
}

// Catalog is the read/write application service for the catalog module.
type Catalog struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Catalog {
	return &Catalog{pool: pool}
}

// ---- reads (public browse) -------------------------------------------------

func (catalog *Catalog) ListCategories(ctx context.Context) ([]Category, error) {
	rows, err := sqlcgen.New(catalog.pool).ListActiveCategories(ctx)
	if err != nil {
		return nil, fmt.Errorf("listing categories: %w", err)
	}
	out := make([]Category, len(rows))
	for i, r := range rows {
		out[i] = Category{ID: r.ID, Name: r.Name, Slug: r.Slug, SortOrder: r.SortOrder}
	}
	return out, nil
}

// ListServices returns every active service with its active variants, assembled from two
// queries (services + all variants) rather than one query per service.
func (catalog *Catalog) ListServices(ctx context.Context) ([]Service, error) {
	q := sqlcgen.New(catalog.pool)

	serviceRows, err := q.ListActiveServices(ctx)
	if err != nil {
		return nil, fmt.Errorf("listing services: %w", err)
	}
	variantRows, err := q.ListActiveVariants(ctx)
	if err != nil {
		return nil, fmt.Errorf("listing variants: %w", err)
	}

	byService := make(map[uuid.UUID][]Variant, len(serviceRows))
	for _, v := range variantRows {
		byService[v.ServiceID] = append(byService[v.ServiceID], Variant{
			ID: v.ID, Name: v.Name, Price: v.BasePricePaise,
		})
	}

	out := make([]Service, len(serviceRows))
	for i, s := range serviceRows {
		mode, err := ParseAssignmentMode(s.AssignmentMode)
		if err != nil {
			return nil, err
		}
		out[i] = Service{
			ID: s.ID, CategoryID: s.CategoryID, Name: s.Name, Slug: s.Slug,
			Description: s.Description, AssignmentMode: mode, EstimatedMinutes: s.EstimatedMinutes,
			Variants: byService[s.ID],
		}
	}
	return out, nil
}

// GetService returns one service with its variants and its booking-time questions.
func (catalog *Catalog) GetService(ctx context.Context, id uuid.UUID) (Service, error) {
	q := sqlcgen.New(catalog.pool)

	s, err := q.GetService(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Service{}, ErrServiceNotFound
	}
	if err != nil {
		return Service{}, fmt.Errorf("reading service: %w", err)
	}
	mode, err := ParseAssignmentMode(s.AssignmentMode)
	if err != nil {
		return Service{}, err
	}

	variantRows, err := q.ListVariantsByService(ctx, id)
	if err != nil {
		return Service{}, fmt.Errorf("reading variants: %w", err)
	}
	variants := make([]Variant, len(variantRows))
	for i, v := range variantRows {
		variants[i] = Variant{ID: v.ID, Name: v.Name, Price: v.BasePricePaise}
	}

	questionRows, err := q.ListQuestionsByService(ctx, id)
	if err != nil {
		return Service{}, fmt.Errorf("reading questions: %w", err)
	}
	questions := make([]Question, len(questionRows))
	for i, qq := range questionRows {
		kind, err := ParseQuestionKind(qq.Kind)
		if err != nil {
			return Service{}, err
		}
		questions[i] = Question{ID: qq.ID, Prompt: qq.Prompt, Kind: kind, Options: qq.Options, Required: qq.IsRequired}
	}

	return Service{
		ID: s.ID, CategoryID: s.CategoryID, Name: s.Name, Slug: s.Slug,
		Description: s.Description, AssignmentMode: mode, EstimatedMinutes: s.EstimatedMinutes,
		Variants: variants, Questions: questions,
	}, nil
}

// ---- writes (admin) --------------------------------------------------------

type NewCategory struct {
	Name      string
	Slug      string
	SortOrder int32
}

func (catalog *Catalog) CreateCategory(ctx context.Context, in NewCategory) (Category, error) {
	row, err := sqlcgen.New(catalog.pool).CreateCategory(ctx, sqlcgen.CreateCategoryParams{
		Name: in.Name, Slug: in.Slug, SortOrder: in.SortOrder,
	})
	if err != nil {
		return Category{}, fmt.Errorf("creating category: %w", err)
	}
	return Category{ID: row.ID, Name: row.Name, Slug: row.Slug, SortOrder: row.SortOrder}, nil
}

type NewService struct {
	CategoryID       uuid.UUID
	Name             string
	Slug             string
	Description      string
	AssignmentMode   AssignmentMode
	EstimatedMinutes int32
}

func (catalog *Catalog) CreateService(ctx context.Context, in NewService) (Service, error) {
	if !in.AssignmentMode.Valid() {
		return Service{}, fmt.Errorf("catalog: invalid assignment mode %q", in.AssignmentMode)
	}
	row, err := sqlcgen.New(catalog.pool).CreateService(ctx, sqlcgen.CreateServiceParams{
		CategoryID:       in.CategoryID,
		Name:             in.Name,
		Slug:             in.Slug,
		Description:      in.Description,
		AssignmentMode:   string(in.AssignmentMode),
		EstimatedMinutes: in.EstimatedMinutes,
	})
	if isForeignKeyViolation(err) {
		return Service{}, ErrCategoryNotFound
	}
	if err != nil {
		return Service{}, fmt.Errorf("creating service: %w", err)
	}
	// The mode round-trips through the DB we just wrote, so it is known-valid; still, do not
	// silently discard the error — check-blank is on for exactly this reason.
	mode, err := ParseAssignmentMode(row.AssignmentMode)
	if err != nil {
		return Service{}, err
	}
	return Service{
		ID: row.ID, CategoryID: row.CategoryID, Name: row.Name, Slug: row.Slug,
		Description: row.Description, AssignmentMode: mode, EstimatedMinutes: row.EstimatedMinutes,
	}, nil
}

type NewVariant struct {
	ServiceID uuid.UUID
	Name      string
	Price     money.Money
}

func (catalog *Catalog) CreateVariant(ctx context.Context, in NewVariant) (Variant, error) {
	if err := in.Price.RequireNonNegative(); err != nil {
		return Variant{}, err
	}
	row, err := sqlcgen.New(catalog.pool).CreateVariant(ctx, sqlcgen.CreateVariantParams{
		ServiceID: in.ServiceID, Name: in.Name, BasePricePaise: in.Price,
	})
	if isForeignKeyViolation(err) {
		return Variant{}, ErrServiceNotFound
	}
	if err != nil {
		return Variant{}, fmt.Errorf("creating variant: %w", err)
	}
	return Variant{ID: row.ID, Name: row.Name, Price: row.BasePricePaise}, nil
}

// isForeignKeyViolation reports whether err is a Postgres FK violation (SQLSTATE 23503) —
// e.g. creating a service under a category id that does not exist.
func isForeignKeyViolation(err error) bool {
	return storage.IsSQLState(err, "23503")
}
