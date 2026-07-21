// Command genopenapi writes the OpenAPI 3.1 contract for the SETHU-CARE API to stdout. It builds
// the same huma API the server does — via httpapi.RegisterAll — but with nil services, because
// generating the spec only reads each operation's input/output types and never calls a handler.
//
// The committed api/openapi.yaml is produced by `make openapi`; CI regenerates it and fails if the
// committed copy differs, so the contract can never drift from the Go handlers.
package main

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/kokkondaBhanuteja/sethu-care/internal/auth"
	"github.com/kokkondaBhanuteja/sethu-care/internal/httpapi"
)

func main() {
	// A signer is needed to construct the API (it wires the auth middleware), but no request ever
	// runs during generation, so this placeholder secret is never used to sign anything.
	signer, err := auth.NewSigner("openapi-generation-placeholder-secret-unused", time.Hour)
	if err != nil {
		fail(err)
	}

	mux := http.NewServeMux()
	api := httpapi.NewHumaAPI(mux, signer)
	httpapi.RegisterAll(api, httpapi.Dependencies{
		Signer: signer,
		Logger: slog.New(slog.NewTextHandler(os.Stderr, nil)),
	})

	spec, err := api.OpenAPI().YAML()
	if err != nil {
		fail(err)
	}
	if _, err := os.Stdout.Write(spec); err != nil {
		fail(err)
	}
}

func fail(err error) {
	slog.Error("generating openapi", "err", err)
	os.Exit(1)
}
