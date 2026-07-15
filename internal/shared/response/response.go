// Package response holds the tiny helpers for writing JSON HTTP responses, shared by the
// transport layer and the health endpoint so there is exactly one place that sets the
// content type and encodes the body.
package response

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// JSON writes payload as a JSON body with the given status code. A failed encode is logged,
// not returned — the status line is already on the wire by then, so there is nothing a
// caller could do with the error.
func JSON(writer http.ResponseWriter, statusCode int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(statusCode)
	if err := json.NewEncoder(writer).Encode(payload); err != nil {
		slog.Default().Error("writing json response", "err", err)
	}
}

// Error writes a single-field JSON error body: {"error": "..."}.
func Error(writer http.ResponseWriter, statusCode int, message string) {
	JSON(writer, statusCode, map[string]string{"error": message})
}
