package httpapi

import (
	"log/slog"
	"net/http"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/catalog"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
)

// CatalogHandler serves the catalog: public browse endpoints, and admin-only management.
type CatalogHandler struct {
	catalog *catalog.Catalog
	signer  *auth.Signer
	log     *slog.Logger
}

func NewCatalogHandler(c *catalog.Catalog, signer *auth.Signer, log *slog.Logger) *CatalogHandler {
	return &CatalogHandler{catalog: c, signer: signer, log: log}
}

func (handler *CatalogHandler) Register(mux *http.ServeMux) {
	// Public browse — a customer looks at services before logging in.
	mux.HandleFunc("GET /categories", handler.listCategories)
	mux.HandleFunc("GET /services", handler.listServices)
	mux.HandleFunc("GET /services/{id}", handler.getService)

	// Admin management. RequireRole(ADMIN) is what finally exercises role-based
	// authorization end to end.
	admin := func(fn http.HandlerFunc) http.Handler {
		return handler.signer.RequireAuth(auth.RequireRole(identity.RoleAdmin, fn))
	}
	mux.Handle("POST /categories", admin(handler.createCategory))
	mux.Handle("POST /services", admin(handler.createService))
	mux.Handle("POST /services/{id}/variants", admin(handler.createVariant))
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

// ---- read handlers ---------------------------------------------------------

func (handler *CatalogHandler) listCategories(writer http.ResponseWriter, request *http.Request) {
	cats, err := handler.catalog.ListCategories(request.Context())
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	payload := make([]categoryResponse, len(cats))
	for index, category := range cats {
		payload[index] = categoryResponse{ID: category.ID.String(), Name: category.Name, Slug: category.Slug, SortOrder: category.SortOrder}
	}
	writeJSON(writer, http.StatusOK, map[string]any{"categories": payload})
}

func (handler *CatalogHandler) listServices(writer http.ResponseWriter, request *http.Request) {
	services, err := handler.catalog.ListServices(request.Context())
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	payload := make([]serviceResponse, len(services))
	for index, service := range services {
		payload[index] = toService(service)
	}
	writeJSON(writer, http.StatusOK, map[string]any{"services": payload})
}

func (handler *CatalogHandler) getService(writer http.ResponseWriter, request *http.Request) {
	id, err := pathUUID(request, "id")
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	s, err := handler.catalog.GetService(request.Context(), id)
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	writeJSON(writer, http.StatusOK, toService(s))
}

// ---- admin write handlers --------------------------------------------------

type createCategoryRequest struct {
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	SortOrder int32  `json:"sort_order"`
}

func (handler *CatalogHandler) createCategory(writer http.ResponseWriter, request *http.Request) {
	var req createCategoryRequest
	if err := decodeJSON(writer, request, &req); err != nil {
		writeError(writer, handler.log, err)
		return
	}
	if req.Name == "" || req.Slug == "" {
		writeError(writer, handler.log, &badRequestError{msg: "name and slug are required"})
		return
	}
	cat, err := handler.catalog.CreateCategory(request.Context(), catalog.NewCategory{Name: req.Name, Slug: req.Slug, SortOrder: req.SortOrder})
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	writeJSON(writer, http.StatusCreated, categoryResponse{ID: cat.ID.String(), Name: cat.Name, Slug: cat.Slug, SortOrder: cat.SortOrder})
}

type createServiceRequest struct {
	CategoryID       string `json:"category_id"`
	Name             string `json:"name"`
	Slug             string `json:"slug"`
	Description      string `json:"description"`
	AssignmentMode   string `json:"assignment_mode"`
	EstimatedMinutes int32  `json:"estimated_minutes"`
}

func (handler *CatalogHandler) createService(writer http.ResponseWriter, request *http.Request) {
	var req createServiceRequest
	if err := decodeJSON(writer, request, &req); err != nil {
		writeError(writer, handler.log, err)
		return
	}
	categoryID, err := parseUUID(req.CategoryID, "category_id")
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	mode := catalog.AssignmentMode(req.AssignmentMode)
	if req.AssignmentMode == "" {
		mode = catalog.AssignmentAuto
	}
	if req.EstimatedMinutes <= 0 {
		req.EstimatedMinutes = 60
	}
	svc, err := handler.catalog.CreateService(request.Context(), catalog.NewService{
		CategoryID: categoryID, Name: req.Name, Slug: req.Slug, Description: req.Description,
		AssignmentMode: mode, EstimatedMinutes: req.EstimatedMinutes,
	})
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	writeJSON(writer, http.StatusCreated, toService(svc))
}

type createVariantRequest struct {
	Name  string `json:"name"`
	Price string `json:"price"` // rupees, e.g. "599" or "499.99"
}

func (handler *CatalogHandler) createVariant(writer http.ResponseWriter, request *http.Request) {
	serviceID, err := pathUUID(request, "id")
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	var req createVariantRequest
	if err := decodeJSON(writer, request, &req); err != nil {
		writeError(writer, handler.log, err)
		return
	}
	price, err := money.FromRupees(req.Price)
	if err != nil {
		writeError(writer, handler.log, &badRequestError{msg: "price must be rupees like \"599\" or \"499.99\""})
		return
	}
	v, err := handler.catalog.CreateVariant(request.Context(), catalog.NewVariant{ServiceID: serviceID, Name: req.Name, Price: price})
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	writeJSON(writer, http.StatusCreated, toVariant(v))
}
