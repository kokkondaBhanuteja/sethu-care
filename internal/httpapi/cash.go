package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
)

// CashHandler serves the cash-reconciliation surfaces: a technician deposits cash they hold,
// and an admin sees who still owes.
type CashHandler struct {
	ledger *ledger.Service
	signer *auth.Signer
	log    *slog.Logger
}

func NewCashHandler(ledgerService *ledger.Service, signer *auth.Signer, log *slog.Logger) *CashHandler {
	return &CashHandler{ledger: ledgerService, signer: signer, log: log}
}

func (handler *CashHandler) Register(mux *http.ServeMux) {
	mux.Handle("POST /me/cash/deposit",
		handler.signer.RequireAuth(auth.RequireRole(identity.RoleTechnician, http.HandlerFunc(handler.deposit))))
	mux.Handle("GET /ops/cash-reconciliation",
		handler.signer.RequireAuth(auth.RequireRole(identity.RoleAdmin, http.HandlerFunc(handler.reconciliation))))
}

type depositRequest struct {
	BookingID uuid.UUID `json:"booking_id"`
}

func (handler *CashHandler) deposit(writer http.ResponseWriter, request *http.Request) {
	caller, ok := auth.UserFrom(request.Context())
	if !ok {
		writeError(writer, handler.log, &badRequestError{msg: "authentication required"})
		return
	}
	var req depositRequest
	if err := decodeJSON(writer, request, &req); err != nil {
		writeError(writer, handler.log, err)
		return
	}
	if err := handler.ledger.RecordDeposit(request.Context(), req.BookingID, caller.ID); err != nil {
		writeError(writer, handler.log, err)
		return
	}
	writeJSON(writer, http.StatusCreated, map[string]any{"status": "deposited"})
}

type cashPositionResponse struct {
	TechnicianID       string     `json:"technician_id"`
	Name               string     `json:"name"`
	Collected          string     `json:"collected"`
	Deposited          string     `json:"deposited"`
	Outstanding        string     `json:"outstanding"`
	OldestCollectionAt *time.Time `json:"oldest_collection_at,omitempty"`
}

func (handler *CashHandler) reconciliation(writer http.ResponseWriter, request *http.Request) {
	positions, err := handler.ledger.Reconciliation(request.Context())
	if err != nil {
		writeError(writer, handler.log, err)
		return
	}
	payload := make([]cashPositionResponse, len(positions))
	for index, position := range positions {
		payload[index] = cashPositionResponse{
			TechnicianID:       position.TechnicianID.String(),
			Name:               position.Name,
			Collected:          position.CollectedPaise.Rupees(),
			Deposited:          position.DepositedPaise.Rupees(),
			Outstanding:        position.OutstandingPaise.Rupees(),
			OldestCollectionAt: position.OldestCollectionAt,
		}
	}
	writeJSON(writer, http.StatusOK, map[string]any{"reconciliation": payload})
}
