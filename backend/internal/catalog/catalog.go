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
	categories := make([]Category, len(rows))
	for index, row := range rows {
		categories[index] = Category{ID: row.ID, Name: row.Name, Slug: row.Slug, SortOrder: row.SortOrder}
	}
	return categories, nil
}

// ListServices returns every active service with its active variants, assembled from two
// queries (services + all variants) rather than one query per service.
func (catalog *Catalog) ListServices(ctx context.Context) ([]Service, error) {
	queries := sqlcgen.New(catalog.pool)

	serviceRows, err := queries.ListActiveServices(ctx)
	if err != nil {
		return nil, fmt.Errorf("listing services: %w", err)
	}
	variantRows, err := queries.ListActiveVariants(ctx)
	if err != nil {
		return nil, fmt.Errorf("listing variants: %w", err)
	}

	variantsByService := make(map[uuid.UUID][]Variant, len(serviceRows))
	for _, variantRow := range variantRows {
		variantsByService[variantRow.ServiceID] = append(variantsByService[variantRow.ServiceID], Variant{
			ID: variantRow.ID, Name: variantRow.Name, Price: variantRow.BasePricePaise,
		})
	}

	services := make([]Service, len(serviceRows))
	for index, serviceRow := range serviceRows {
		mode, err := ParseAssignmentMode(serviceRow.AssignmentMode)
		if err != nil {
			return nil, err
		}
		services[index] = Service{
			ID: serviceRow.ID, CategoryID: serviceRow.CategoryID, Name: serviceRow.Name, Slug: serviceRow.Slug,
			Description: serviceRow.Description, AssignmentMode: mode, EstimatedMinutes: serviceRow.EstimatedMinutes,
			Variants: variantsByService[serviceRow.ID],
		}
	}
	return services, nil
}

// GetService returns one service with its variants and its booking-time questions.
func (catalog *Catalog) GetService(ctx context.Context, id uuid.UUID) (Service, error) {
	queries := sqlcgen.New(catalog.pool)

	serviceRow, err := queries.GetService(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Service{}, ErrServiceNotFound
	}
	if err != nil {
		return Service{}, fmt.Errorf("reading service: %w", err)
	}
	mode, err := ParseAssignmentMode(serviceRow.AssignmentMode)
	if err != nil {
		return Service{}, err
	}

	variantRows, err := queries.ListVariantsByService(ctx, id)
	if err != nil {
		return Service{}, fmt.Errorf("reading variants: %w", err)
	}
	variants := make([]Variant, len(variantRows))
	for index, variantRow := range variantRows {
		variants[index] = Variant{ID: variantRow.ID, Name: variantRow.Name, Price: variantRow.BasePricePaise}
	}

	questionRows, err := queries.ListQuestionsByService(ctx, id)
	if err != nil {
		return Service{}, fmt.Errorf("reading questions: %w", err)
	}
	questions := make([]Question, len(questionRows))
	for index, questionRow := range questionRows {
		kind, err := ParseQuestionKind(questionRow.Kind)
		if err != nil {
			return Service{}, err
		}
		questions[index] = Question{ID: questionRow.ID, Prompt: questionRow.Prompt, Kind: kind, Options: questionRow.Options, Required: questionRow.IsRequired}
	}

	return Service{
		ID: serviceRow.ID, CategoryID: serviceRow.CategoryID, Name: serviceRow.Name, Slug: serviceRow.Slug,
		Description: serviceRow.Description, AssignmentMode: mode, EstimatedMinutes: serviceRow.EstimatedMinutes,
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
