package httpapi

import (
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/kokkondaBhanuteja/sethu-care/internal/flow"
)

// RateLimit sheds per-IP request floods (429 Too Many Requests) using the flow layer's fixed-window
// counter. Health checks and the signature-authenticated Razorpay webhook are exempt — those must
// never be throttled. A disabled or erroring flow layer allows everything (fail open), so a Redis
// outage never takes the API down.
func RateLimit(control *flow.Controller, limit int, window time.Duration, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if !control.Enabled() || exemptFromRateLimit(request.URL.Path) {
			next.ServeHTTP(writer, request)
			return
		}
		allowed, _ := control.Allow(request.Context(), "ip:"+clientIP(request), limit, window)
		if !allowed {
			writer.Header().Set("Retry-After", "1")
			writer.WriteHeader(http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(writer, request)
	})
}

func exemptFromRateLimit(path string) bool {
	return path == "/health" || strings.HasPrefix(path, "/webhooks/")
}

// clientIP prefers the first X-Forwarded-For hop (behind a proxy/load balancer), else the socket peer.
func clientIP(request *http.Request) string {
	if forwarded := request.Header.Get("X-Forwarded-For"); forwarded != "" {
		if comma := strings.IndexByte(forwarded, ','); comma >= 0 {
			return strings.TrimSpace(forwarded[:comma])
		}
		return strings.TrimSpace(forwarded)
	}
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		return request.RemoteAddr
	}
	return host
}
