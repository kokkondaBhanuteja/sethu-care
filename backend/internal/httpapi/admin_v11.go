package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
)

// The v1.1 surface: customers, support tickets and analytics. Declared with the rest of the
// contract so the console can be built against a stable shape, even though the screens behind
// them ship after v1.

func (handler *AdminHandler) registerAdminV11(api huma.API) {
	notFound := adminResponse{"404", "Not Found", adminError{}}
	stale := adminResponse{"409", "Conflict — the record moved since it was read", staleVersionError{}}

	huma.Register(api, huma.Operation{
		OperationID: "opsListCustomers", Method: http.MethodGet, Path: "/ops/customers",
		Summary: "List customers (v1.1)", Tags: []string{"Ops Customers"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.listCustomers)

	huma.Register(api, huma.Operation{
		OperationID: "opsGetCustomer", Method: http.MethodGet, Path: "/ops/customers/{id}",
		Summary: "Customer detail (v1.1)", Tags: []string{"Ops Customers"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound),
	}, handler.getCustomer)

	huma.Register(api, huma.Operation{
		OperationID: "opsBlockCustomer", Method: http.MethodPost, Path: "/ops/customers/{id}/block",
		Summary: "Block a customer (v1.1)", Tags: []string{"Ops Customers"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound, stale),
	}, handler.blockCustomer)

	huma.Register(api, huma.Operation{
		OperationID: "opsListTickets", Method: http.MethodGet, Path: "/ops/tickets",
		Summary: "List support tickets (v1.1)", Tags: []string{"Ops Tickets"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.listTickets)

	huma.Register(api, huma.Operation{
		OperationID: "opsGetTicket", Method: http.MethodGet, Path: "/ops/tickets/{id}",
		Summary: "Ticket detail with its message thread (v1.1)", Tags: []string{"Ops Tickets"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api, notFound),
	}, handler.getTicket)

	huma.Register(api, huma.Operation{
		OperationID: "opsReplyToTicket", Method: http.MethodPost, Path: "/ops/tickets/{id}/reply",
		Summary: "Reply to a ticket (v1.1)", Tags: []string{"Ops Tickets"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		DefaultStatus: http.StatusCreated,
		Responses:     adminResponses(api, notFound, stale),
	}, handler.replyToTicket)

	huma.Register(api, huma.Operation{
		OperationID: "opsAnalyticsSummary", Method: http.MethodGet, Path: "/ops/analytics/summary",
		Summary: "Analytics headline metrics (v1.1)", Tags: []string{"Ops Analytics"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
		Responses: adminResponses(api),
	}, handler.analyticsSummary)
}

// --------------------------------------------------------------- customers

type customerStatus string

const (
	customerStatusActive  customerStatus = "active"
	customerStatusBlocked customerStatus = "blocked"
)

// Schema names the customer-status vocabulary in the generated document.
func (customerStatus) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "CustomerStatus", "",
		string(customerStatusActive), string(customerStatusBlocked))
}

type customerBlockReasonCode string

const (
	customerBlockReasonCodeAbusiveBehaviour      customerBlockReasonCode = "abusive_behaviour"
	customerBlockReasonCodeFraudSuspected        customerBlockReasonCode = "fraud_suspected"
	customerBlockReasonCodePaymentDefault        customerBlockReasonCode = "payment_default"
	customerBlockReasonCodeRepeatedCancellations customerBlockReasonCode = "repeated_cancellations"
	customerBlockReasonCodeSafetyIncident        customerBlockReasonCode = "safety_incident"
	customerBlockReasonCodeOther                 customerBlockReasonCode = "other"
)

// Schema names the customer-block vocabulary in the generated document.
func (customerBlockReasonCode) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "CustomerBlockReasonCode", "",
		string(customerBlockReasonCodeAbusiveBehaviour), string(customerBlockReasonCodeFraudSuspected),
		string(customerBlockReasonCodePaymentDefault), string(customerBlockReasonCodeRepeatedCancellations),
		string(customerBlockReasonCodeSafetyIncident), string(customerBlockReasonCodeOther))
}

// CustomerListItem is one row of the customer list. Exported because customerDetail embeds it.
type CustomerListItem struct {
	Bookings           int32          `json:"bookings" required:"true"`
	ID                 string         `json:"id" required:"true"`
	JoinedAt           time.Time      `json:"joinedAt" required:"true"`
	LastBookingAt      *time.Time     `json:"lastBookingAt,omitempty"`
	LifetimeValuePaise int64          `json:"lifetimeValuePaise" required:"true"`
	Name               string         `json:"name" required:"true"`
	Phone              string         `json:"phone" required:"true" doc:"Masked at the source."`
	Status             customerStatus `json:"status" required:"true"`
}

type customerDetail struct {
	CustomerListItem
	Address           string                   `json:"address" required:"true"`
	BlockedReasonCode *customerBlockReasonCode `json:"blockedReasonCode,omitempty"`
	Cancellations     int32                    `json:"cancellations" required:"true"`
	RecentBookings    []bookingListItem        `json:"recentBookings" required:"true" nullable:"false"`
	RefundsPaise      int64                    `json:"refundsPaise" required:"true"`
	Version           int32                    `json:"version" required:"true"`
}

type customersPage struct {
	Items      []CustomerListItem `json:"items" required:"true" nullable:"false"`
	NextCursor *string            `json:"nextCursor"`
	Total      int32              `json:"total" required:"true"`
}

type opsListCustomersInput struct {
	Query string `query:"q" doc:"Free-text search."`
	AdminPagination
}

type customersPageOutput struct {
	Body customersPage
}

func (handler *AdminHandler) listCustomers(_ context.Context, _ *opsListCustomersInput) (*customersPageOutput, error) {
	return nil, notImplemented("opsListCustomers")
}

type opsCustomerPath struct {
	ID string `path:"id" doc:"Customer id"`
}

type customerDetailOutput struct {
	Body customerDetail
}

func (handler *AdminHandler) getCustomer(_ context.Context, _ *opsCustomerPath) (*customerDetailOutput, error) {
	return nil, notImplemented("opsGetCustomer")
}

type blockCustomerRequest struct {
	Note       string                  `json:"note" required:"true"`
	ReasonCode customerBlockReasonCode `json:"reasonCode" required:"true"`
	Version    int32                   `json:"version" required:"true"`
}

type blockCustomerResult struct {
	CustomerID string         `json:"customerId" required:"true"`
	Status     customerStatus `json:"status" required:"true"`
	Version    int32          `json:"version" required:"true"`
}

type opsBlockCustomerInput struct {
	ID string `path:"id" doc:"Customer id"`
	AdminIdempotency
	Body blockCustomerRequest
}

type blockCustomerOutput struct {
	Body blockCustomerResult
}

func (handler *AdminHandler) blockCustomer(_ context.Context, _ *opsBlockCustomerInput) (*blockCustomerOutput, error) {
	return nil, notImplemented("opsBlockCustomer")
}

// ----------------------------------------------------------------- tickets

type ticketStatus string

const (
	ticketStatusOpen            ticketStatus = "open"
	ticketStatusPendingCustomer ticketStatus = "pending_customer"
	ticketStatusResolved        ticketStatus = "resolved"
	ticketStatusClosed          ticketStatus = "closed"
)

// Schema names the ticket-status vocabulary in the generated document.
func (ticketStatus) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "TicketStatus", "",
		string(ticketStatusOpen), string(ticketStatusPendingCustomer),
		string(ticketStatusResolved), string(ticketStatusClosed))
}

type ticketPriority string

const (
	ticketPriorityLow    ticketPriority = "low"
	ticketPriorityNormal ticketPriority = "normal"
	ticketPriorityHigh   ticketPriority = "high"
	ticketPriorityUrgent ticketPriority = "urgent"
)

// Schema names the ticket-priority vocabulary in the generated document.
func (ticketPriority) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "TicketPriority", "",
		string(ticketPriorityLow), string(ticketPriorityNormal),
		string(ticketPriorityHigh), string(ticketPriorityUrgent))
}

type ticketAuthorKind string

const (
	ticketAuthorKindCustomer ticketAuthorKind = "customer"
	ticketAuthorKindAdmin    ticketAuthorKind = "admin"
	ticketAuthorKindSystem   ticketAuthorKind = "system"
)

// Schema names the ticket-author vocabulary in the generated document.
func (ticketAuthorKind) Schema(registry huma.Registry) *huma.Schema {
	return adminEnumSchema(registry, "TicketAuthorKind", "",
		string(ticketAuthorKindCustomer), string(ticketAuthorKindAdmin), string(ticketAuthorKindSystem))
}

// TicketListItem is one row of the ticket list. Exported because ticketDetail embeds it.
type TicketListItem struct {
	BookingRef   *string        `json:"bookingRef"`
	CreatedAt    time.Time      `json:"createdAt" required:"true"`
	CustomerName string         `json:"customerName" required:"true"`
	ID           string         `json:"id" required:"true"`
	Priority     ticketPriority `json:"priority" required:"true"`
	Reference    string         `json:"reference" required:"true"`
	Status       ticketStatus   `json:"status" required:"true"`
	Subject      string         `json:"subject" required:"true"`
	UpdatedAt    time.Time      `json:"updatedAt" required:"true"`
}

type ticketMessage struct {
	At         time.Time        `json:"at" required:"true"`
	AuthorKind ticketAuthorKind `json:"authorKind" required:"true"`
	AuthorName string           `json:"authorName" required:"true"`
	Body       string           `json:"body" required:"true"`
	ID         string           `json:"id" required:"true"`
}

type ticketDetail struct {
	TicketListItem
	Messages []ticketMessage `json:"messages" required:"true" nullable:"false"`
	Version  int32           `json:"version" required:"true"`
}

type ticketsPage struct {
	Items      []TicketListItem `json:"items" required:"true" nullable:"false"`
	NextCursor *string          `json:"nextCursor"`
	Total      int32            `json:"total" required:"true"`
}

type opsListTicketsInput struct {
	Status ticketStatus `query:"status" doc:"Defaults to open."`
	AdminPagination
}

type ticketsPageOutput struct {
	Body ticketsPage
}

func (handler *AdminHandler) listTickets(_ context.Context, _ *opsListTicketsInput) (*ticketsPageOutput, error) {
	return nil, notImplemented("opsListTickets")
}

type opsTicketPath struct {
	ID string `path:"id" doc:"Ticket id"`
}

type ticketDetailOutput struct {
	Body ticketDetail
}

func (handler *AdminHandler) getTicket(_ context.Context, _ *opsTicketPath) (*ticketDetailOutput, error) {
	return nil, notImplemented("opsGetTicket")
}

type ticketReplyRequest struct {
	Body    string `json:"body" required:"true"`
	Version int32  `json:"version" required:"true"`
}

type opsReplyToTicketInput struct {
	ID string `path:"id" doc:"Ticket id"`
	AdminIdempotency
	Body ticketReplyRequest
}

type ticketMessageOutput struct {
	Body ticketMessage
}

func (handler *AdminHandler) replyToTicket(_ context.Context, _ *opsReplyToTicketInput) (*ticketMessageOutput, error) {
	return nil, notImplemented("opsReplyToTicket")
}

// --------------------------------------------------------------- analytics

type analyticsMetric struct {
	ID     string     `json:"id" required:"true"`
	Points []float64  `json:"points" required:"true" nullable:"false" doc:"One point per bucket in the requested period."`
	Unit   metricUnit `json:"unit" required:"true"`
	Value  float64    `json:"value" required:"true"`
}

type analyticsSummary struct {
	BucketStarts []time.Time       `json:"bucketStarts" required:"true" nullable:"false"`
	Metrics      []analyticsMetric `json:"metrics" required:"true" nullable:"false"`
	Period       string            `json:"period" required:"true"`
	UpdatedAt    time.Time         `json:"updatedAt" required:"true"`
}

type opsAnalyticsSummaryInput struct {
	Period string `query:"period" doc:"Named range, e.g. last7 or last30."`
}

type analyticsSummaryOutput struct {
	Body analyticsSummary
}

func (handler *AdminHandler) analyticsSummary(_ context.Context, _ *opsAnalyticsSummaryInput) (*analyticsSummaryOutput, error) {
	return nil, notImplemented("opsAnalyticsSummary")
}
