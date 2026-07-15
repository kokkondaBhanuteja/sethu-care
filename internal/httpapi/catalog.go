package httpapi

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/catalog"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
)

// CatalogHandler serves the catalog: public browse operations, and admin-only management.
type CatalogHandler struct {
	catalog *catalog.Catalog
	log     *slog.Logger
}

func NewCatalogHandler(catalogService *catalog.Catalog, log *slog.Logger) *CatalogHandler {
	return &CatalogHandler{catalog: catalogService, log: log}
}

// RegisterHuma registers the catalog operations on the huma API. Public browse needs no auth; the
// management operations declare the bearer scheme and the ADMIN role right here at the route.
func (handler *CatalogHandler) RegisterHuma(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "listCategories", Method: http.MethodGet, Path: "/categories",
		Summary: "List service categories", Tags: []string{"Catalog"},
	}, handler.listCategories)
	huma.Register(api, huma.Operation{
		OperationID: "listServices", Method: http.MethodGet, Path: "/services",
		Summary: "List services", Tags: []string{"Catalog"},
	}, handler.listServices)
	huma.Register(api, huma.Operation{
		OperationID: "getService", Method: http.MethodGet, Path: "/services/{id}",
		Summary: "Get a service", Tags: []string{"Catalog"},
	}, handler.getService)

	huma.Register(api, huma.Operation{
		OperationID: "createCategory", Method: http.MethodPost, Path: "/categories",
		Summary: "Create a category", Tags: []string{"Catalog"}, DefaultStatus: http.StatusCreated,
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
	}, handler.createCategory)
	huma.Register(api, huma.Operation{
		OperationID: "createService", Method: http.MethodPost, Path: "/services",
		Summary: "Create a service", Tags: []string{"Catalog"}, DefaultStatus: http.StatusCreated,
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
	}, handler.createService)
	huma.Register(api, huma.Operation{
		OperationID: "createVariant", Method: http.MethodPost, Path: "/services/{id}/variants",
		Summary: "Create a service variant", Tags: []string{"Catalog"}, DefaultStatus: http.StatusCreated,
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
	}, handler.createVariant)
}

// ---- DTOs ------------------------------------------------------------------

type categoryResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	SortOrder int32  `json:"sort_order"`
}

type variantResponse struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	PricePaise int64  `json:"price_paise"`
	PriceRupee string `json:"price"`
}

type questionResponse struct {
	ID       string   `json:"id"`
	Prompt   string   `json:"prompt"`
	Kind     string   `json:"kind"`
	Options  []string `json:"options"`
	Required bool     `json:"required"`
}

type serviceResponse struct {
	ID               string             `json:"id"`
	CategoryID       string             `json:"category_id"`
	Name             string             `json:"name"`
	Slug             string             `json:"slug"`
	Description      string             `json:"description"`
	AssignmentMode   string             `json:"assignment_mode"`
	EstimatedMinutes int32              `json:"estimated_minutes"`
	Variants         []variantResponse  `json:"variants"`
	Questions        []questionResponse `json:"questions,omitempty"`
}

func toVariant(variant catalog.Variant) variantResponse {
	return variantResponse{ID: variant.ID.String(), Name: variant.Name, PricePaise: variant.Price.Paise(), PriceRupee: variant.Price.Rupees()}
}

func toService(service catalog.Service) serviceResponse {
	variants := make([]variantResponse, len(service.Variants))
	for index, variant := range service.Variants {
		variants[index] = toVariant(variant)
	}
	questions := make([]questionResponse, len(service.Questions))
	for index, question := range service.Questions {
		questions[index] = questionResponse{ID: question.ID.String(), Prompt: question.Prompt, Kind: question.Kind.String(), Options: question.Options, Required: question.Required}
	}
	return serviceResponse{
		ID: service.ID.String(), CategoryID: service.CategoryID.String(), Name: service.Name, Slug: service.Slug,
		Description: service.Description, AssignmentMode: service.AssignmentMode.String(),
		EstimatedMinutes: service.EstimatedMinutes, Variants: variants, Questions: questions,
	}
}

// ---- read operations -------------------------------------------------------

type listCategoriesOutput struct {
	Body struct {
		Categories []categoryResponse `json:"categories"`
	}
}

func (handler *CatalogHandler) listCategories(ctx context.Context, _ *struct{}) (*listCategoriesOutput, error) {
	categories, err := handler.catalog.ListCategories(ctx)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &listCategoriesOutput{}
	out.Body.Categories = make([]categoryResponse, len(categories))
	for index, category := range categories {
		out.Body.Categories[index] = categoryResponse{ID: category.ID.String(), Name: category.Name, Slug: category.Slug, SortOrder: category.SortOrder}
	}
	return out, nil
}

type listServicesOutput struct {
	Body struct {
		Services []serviceResponse `json:"services"`
	}
}

func (handler *CatalogHandler) listServices(ctx context.Context, _ *struct{}) (*listServicesOutput, error) {
	services, err := handler.catalog.ListServices(ctx)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &listServicesOutput{}
	out.Body.Services = make([]serviceResponse, len(services))
	for index, service := range services {
		out.Body.Services[index] = toService(service)
	}
	return out, nil
}

type serviceIDInput struct {
	ID string `path:"id" format:"uuid" doc:"Service id"`
}

type serviceOutput struct {
	Body serviceResponse
}

func (handler *CatalogHandler) getService(ctx context.Context, input *serviceIDInput) (*serviceOutput, error) {
	id, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	service, err := handler.catalog.GetService(ctx, id)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &serviceOutput{Body: toService(service)}, nil
}

// ---- admin write operations ------------------------------------------------

type createCategoryRequest struct {
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	SortOrder int32  `json:"sort_order"`
}

type createCategoryInput struct {
	Body createCategoryRequest
}

type categoryOutput struct {
	Body categoryResponse
}

func (handler *CatalogHandler) createCategory(ctx context.Context, input *createCategoryInput) (*categoryOutput, error) {
	if input.Body.Name == "" || input.Body.Slug == "" {
		return nil, toHumaError(handler.log, &badRequestError{msg: "name and slug are required"})
	}
	category, err := handler.catalog.CreateCategory(ctx, catalog.NewCategory{Name: input.Body.Name, Slug: input.Body.Slug, SortOrder: input.Body.SortOrder})
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &categoryOutput{Body: categoryResponse{ID: category.ID.String(), Name: category.Name, Slug: category.Slug, SortOrder: category.SortOrder}}, nil
}

type createServiceRequest struct {
	CategoryID       string `json:"category_id"`
	Name             string `json:"name"`
	Slug             string `json:"slug"`
	Description      string `json:"description"`
	AssignmentMode   string `json:"assignment_mode"`
	EstimatedMinutes int32  `json:"estimated_minutes"`
}

type createServiceInput struct {
	Body createServiceRequest
}

func (handler *CatalogHandler) createService(ctx context.Context, input *createServiceInput) (*serviceOutput, error) {
	categoryID, err := parseUUID(input.Body.CategoryID, "category_id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	mode := catalog.AssignmentMode(input.Body.AssignmentMode)
	if input.Body.AssignmentMode == "" {
		mode = catalog.AssignmentAuto
	}
	estimatedMinutes := input.Body.EstimatedMinutes
	if estimatedMinutes <= 0 {
		estimatedMinutes = 60
	}
	service, err := handler.catalog.CreateService(ctx, catalog.NewService{
		CategoryID: categoryID, Name: input.Body.Name, Slug: input.Body.Slug, Description: input.Body.Description,
		AssignmentMode: mode, EstimatedMinutes: estimatedMinutes,
	})
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &serviceOutput{Body: toService(service)}, nil
}

type createVariantRequest struct {
	Name  string `json:"name"`
	Price string `json:"price" doc:"Rupees, e.g. \"599\" or \"499.99\""`
}

type createVariantInput struct {
	ID   string `path:"id" format:"uuid" doc:"Service id"`
	Body createVariantRequest
}

type variantOutput struct {
	Body variantResponse
}

func (handler *CatalogHandler) createVariant(ctx context.Context, input *createVariantInput) (*variantOutput, error) {
	serviceID, err := parseUUID(input.ID, "id")
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	price, err := money.FromRupees(input.Body.Price)
	if err != nil {
		return nil, toHumaError(handler.log, &badRequestError{msg: "price must be rupees like \"599\" or \"499.99\""})
	}
	variant, err := handler.catalog.CreateVariant(ctx, catalog.NewVariant{ServiceID: serviceID, Name: input.Body.Name, Price: price})
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	return &variantOutput{Body: toVariant(variant)}, nil
}
