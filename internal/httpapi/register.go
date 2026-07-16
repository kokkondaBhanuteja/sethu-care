package httpapi

import (
	"log/slog"

	"github.com/danielgtaylor/huma/v2"

	"github.com/kokkondaBhanuteja/sethu-care/internal/address"
	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
	"github.com/kokkondaBhanuteja/sethu-care/internal/catalog"
	"github.com/kokkondaBhanuteja/sethu-care/internal/identity"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ledger"
	"github.com/kokkondaBhanuteja/sethu-care/internal/media"
	"github.com/kokkondaBhanuteja/sethu-care/internal/ops"
	"github.com/kokkondaBhanuteja/sethu-care/internal/reviews"
	"github.com/kokkondaBhanuteja/sethu-care/internal/sms"
	"github.com/kokkondaBhanuteja/sethu-care/internal/verification"
)

// Dependencies is everything the HTTP layer needs to serve its operations. Collecting it in one
// struct lets RegisterAll be the single list of operations — so the production server, the tests,
// and the OpenAPI generator all register exactly the same surface and cannot drift.
type Dependencies struct {
	Identity     *identity.Service
	Catalog      *catalog.Catalog
	Address      *address.Service
	Ops          *ops.Service
	Ledger       *ledger.Service
	Verification *verification.Service
	Booking      *booking.Service
	Reviews      *reviews.Service
	Cloudinary   *media.Cloudinary
	Signer       *auth.Signer
	OTPSender    sms.Sender
	UPIVPA       string
	UPIPayee     string
	DevEchoOTP   bool
	Logger       *slog.Logger
}

// RegisterAll registers every HTTP operation on the huma API. This is THE list of the API's
// surface; adding an endpoint means adding it here, once, and it appears in the served router,
// the tests, and the generated OpenAPI contract together.
//
// The OpenAPI generator (cmd/genopenapi) calls this with nil services: registration only reads
// each operation's input/output TYPES to build the schema and never invokes a handler, so the
// services are not needed to produce the spec.
func RegisterAll(api huma.API, deps Dependencies) {
	NewAuthHandler(deps.Identity, deps.Signer, deps.OTPSender, deps.Logger, deps.DevEchoOTP).RegisterHuma(api)
	NewCatalogHandler(deps.Catalog, deps.Logger).RegisterHuma(api)
	NewAddressHandler(deps.Address, deps.Logger).RegisterHuma(api)
	NewOpsHandler(deps.Ops, deps.Logger).RegisterHuma(api)
	NewCashHandler(deps.Ledger, deps.Logger).RegisterHuma(api)
	NewPaymentHandler(deps.Ledger, deps.UPIVPA, deps.UPIPayee, deps.Logger).RegisterHuma(api)
	NewPhotoHandler(deps.Verification, deps.Cloudinary, deps.Logger).RegisterHuma(api)
	New(deps.Booking, deps.Verification, deps.Reviews, deps.Logger).RegisterHuma(api)
}
