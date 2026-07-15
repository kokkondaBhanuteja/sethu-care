package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
)

// CashHandler serves the cash-reconciliation surfaces: a technician deposits cash they hold,
// and an admin sees who still owes.
type CashHandler struct {
	ledger *ledger.Service
	log    *slog.Logger
}

func NewCashHandler(ledgerService *ledger.Service, log *slog.Logger) *CashHandler {
	return &CashHandler{ledger: ledgerService, log: log}
}

func (handler *CashHandler) RegisterHuma(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "depositCash", Method: http.MethodPost, Path: "/me/cash/deposit",
		Summary: "Deposit collected cash", Tags: []string{"Cash"}, DefaultStatus: http.StatusCreated,
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleTechnician),
	}, handler.deposit)
	huma.Register(api, huma.Operation{
		OperationID: "cashReconciliation", Method: http.MethodGet, Path: "/ops/cash-reconciliation",
		Summary: "Cash reconciliation across technicians", Tags: []string{"Cash"},
		Security: bearerSecurity(), Metadata: roleMetadata(identity.RoleAdmin),
	}, handler.reconciliation)
}

type depositRequest struct {
	BookingID uuid.UUID `json:"booking_id"`
}

type depositInput struct {
	Body depositRequest
}

type depositOutput struct {
	Body struct {
		Status string `json:"status"`
	}
}

func (handler *CashHandler) deposit(ctx context.Context, input *depositInput) (*depositOutput, error) {
	caller, ok := userFromContext(ctx)
	if !ok {
		return nil, toHumaError(handler.log, &badRequestError{msg: "authentication required"})
	}
	if err := handler.ledger.RecordDeposit(ctx, input.Body.BookingID, caller.ID); err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &depositOutput{}
	out.Body.Status = "deposited"
	return out, nil
}

type cashPositionResponse struct {
	TechnicianID       string     `json:"technician_id"`
	Name               string     `json:"name"`
	Collected          string     `json:"collected"`
	Deposited          string     `json:"deposited"`
	Outstanding        string     `json:"outstanding"`
	OldestCollectionAt *time.Time `json:"oldest_collection_at,omitempty"`
}

type reconciliationOutput struct {
	Body struct {
		Reconciliation []cashPositionResponse `json:"reconciliation"`
	}
}

func (handler *CashHandler) reconciliation(ctx context.Context, _ *struct{}) (*reconciliationOutput, error) {
	positions, err := handler.ledger.Reconciliation(ctx)
	if err != nil {
		return nil, toHumaError(handler.log, err)
	}
	out := &reconciliationOutput{}
	out.Body.Reconciliation = make([]cashPositionResponse, len(positions))
	for index, position := range positions {
		out.Body.Reconciliation[index] = cashPositionResponse{
			TechnicianID:       position.TechnicianID.String(),
			Name:               position.Name,
			Collected:          position.CollectedPaise.Rupees(),
			Deposited:          position.DepositedPaise.Rupees(),
			Outstanding:        position.OutstandingPaise.Rupees(),
			OldestCollectionAt: position.OldestCollectionAt,
		}
	}
	return out, nil
}
