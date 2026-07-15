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

func (h *CatalogHandler) Register(mux *http.ServeMux) {
	// Public browse — a customer looks at services before logging in.
	mux.HandleFunc("GET /categories", h.listCategories)
	mux.HandleFunc("GET /services", h.listServices)
	mux.HandleFunc("GET /services/{id}", h.getService)

	// Admin management. RequireRole(ADMIN) is what finally exercises role-based
	// authorization end to end.
	admin := func(fn http.HandlerFunc) http.Handler {
		return h.signer.RequireAuth(auth.RequireRole(identity.RoleAdmin, fn))
	}
	mux.Handle("POST /categories", admin(h.createCategory))
	mux.Handle("POST /services", admin(h.createService))
	mux.Handle("POST /services/{id}/variants", admin(h.createVariant))
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

func toVariant(v catalog.Variant) variantResponse {
	return variantResponse{ID: v.ID.String(), Name: v.Name, PricePaise: v.Price.Paise(), PriceRupee: v.Price.Rupees()}
}

func toService(s catalog.Service) serviceResponse {
	variants := make([]variantResponse, len(s.Variants))
	for i, v := range s.Variants {
		variants[i] = toVariant(v)
	}
	questions := make([]questionResponse, len(s.Questions))
	for i, q := range s.Questions {
		questions[i] = questionResponse{ID: q.ID.String(), Prompt: q.Prompt, Kind: q.Kind.String(), Options: q.Options, Required: q.Required}
	}
	return serviceResponse{
		ID: s.ID.String(), CategoryID: s.CategoryID.String(), Name: s.Name, Slug: s.Slug,
		Description: s.Description, AssignmentMode: s.AssignmentMode.String(),
		EstimatedMinutes: s.EstimatedMinutes, Variants: variants, Questions: questions,
	}
}

// ---- read handlers ---------------------------------------------------------

func (h *CatalogHandler) listCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.catalog.ListCategories(r.Context())
	if err != nil {
		writeError(w, h.log, err)
		return
	}
	out := make([]categoryResponse, len(cats))
	for i, c := range cats {
		out[i] = categoryResponse{ID: c.ID.String(), Name: c.Name, Slug: c.Slug, SortOrder: c.SortOrder}
	}
	writeJSON(w, http.StatusOK, map[string]any{"categories": out})
}

func (h *CatalogHandler) listServices(w http.ResponseWriter, r *http.Request) {
	services, err := h.catalog.ListServices(r.Context())
	if err != nil {
		writeError(w, h.log, err)
		return
	}
	out := make([]serviceResponse, len(services))
	for i, s := range services {
		out[i] = toService(s)
	}
	writeJSON(w, http.StatusOK, map[string]any{"services": out})
}

func (h *CatalogHandler) getService(w http.ResponseWriter, r *http.Request) {
	id, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, h.log, err)
		return
	}
	s, err := h.catalog.GetService(r.Context(), id)
	if err != nil {
		writeError(w, h.log, err)
		return
	}
	writeJSON(w, http.StatusOK, toService(s))
}

// ---- admin write handlers --------------------------------------------------

type createCategoryRequest struct {
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	SortOrder int32  `json:"sort_order"`
}

func (h *CatalogHandler) createCategory(w http.ResponseWriter, r *http.Request) {
	var req createCategoryRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, h.log, err)
		return
	}
	if req.Name == "" || req.Slug == "" {
		writeError(w, h.log, &badRequestError{msg: "name and slug are required"})
		return
	}
	cat, err := h.catalog.CreateCategory(r.Context(), catalog.NewCategory{Name: req.Name, Slug: req.Slug, SortOrder: req.SortOrder})
	if err != nil {
		writeError(w, h.log, err)
		return
	}
	writeJSON(w, http.StatusCreated, categoryResponse{ID: cat.ID.String(), Name: cat.Name, Slug: cat.Slug, SortOrder: cat.SortOrder})
}

type createServiceRequest struct {
	CategoryID       string `json:"category_id"`
	Name             string `json:"name"`
	Slug             string `json:"slug"`
	Description      string `json:"description"`
	AssignmentMode   string `json:"assignment_mode"`
	EstimatedMinutes int32  `json:"estimated_minutes"`
}

func (h *CatalogHandler) createService(w http.ResponseWriter, r *http.Request) {
	var req createServiceRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, h.log, err)
		return
	}
	categoryID, err := parseUUID(req.CategoryID, "category_id")
	if err != nil {
		writeError(w, h.log, err)
		return
	}
	mode := catalog.AssignmentMode(req.AssignmentMode)
	if req.AssignmentMode == "" {
		mode = catalog.AssignmentAuto
	}
	if req.EstimatedMinutes <= 0 {
		req.EstimatedMinutes = 60
	}
	svc, err := h.catalog.CreateService(r.Context(), catalog.NewService{
		CategoryID: categoryID, Name: req.Name, Slug: req.Slug, Description: req.Description,
		AssignmentMode: mode, EstimatedMinutes: req.EstimatedMinutes,
	})
	if err != nil {
		writeError(w, h.log, err)
		return
	}
	writeJSON(w, http.StatusCreated, toService(svc))
}

type createVariantRequest struct {
	Name  string `json:"name"`
	Price string `json:"price"` // rupees, e.g. "599" or "499.99"
}

func (h *CatalogHandler) createVariant(w http.ResponseWriter, r *http.Request) {
	serviceID, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, h.log, err)
		return
	}
	var req createVariantRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, h.log, err)
		return
	}
	price, err := money.FromRupees(req.Price)
	if err != nil {
		writeError(w, h.log, &badRequestError{msg: "price must be rupees like \"599\" or \"499.99\""})
		return
	}
	v, err := h.catalog.CreateVariant(r.Context(), catalog.NewVariant{ServiceID: serviceID, Name: req.Name, Price: price})
	if err != nil {
		writeError(w, h.log, err)
		return
	}
	writeJSON(w, http.StatusCreated, toVariant(v))
}
