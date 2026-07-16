package sms

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// msg91FlowURL is MSG91's v5 Flow endpoint: send a DLT-approved template to recipients.
const msg91FlowURL = "https://control.msg91.com/api/v5/flow/"

// MSG91 sends OTP SMS through MSG91's Flow API using a DLT-approved template. Under TRAI/DLT rules
// the message TEXT lives in the approved template on MSG91's side; we supply only the one variable
// the template declares — the code, as "otp".
type MSG91 struct {
	authKey    string
	senderID   string
	templateID string
	client     *http.Client
}

func NewMSG91(authKey, senderID, templateID string) *MSG91 {
	return &MSG91{
		authKey:    authKey,
		senderID:   senderID,
		templateID: templateID,
		client:     &http.Client{Timeout: 10 * time.Second},
	}
}

type msg91Recipient struct {
	Mobiles string `json:"mobiles"`
	OTP     string `json:"otp"`
}

type msg91Request struct {
	TemplateID string           `json:"template_id"`
	Sender     string           `json:"sender"`
	Recipients []msg91Recipient `json:"recipients"`
}

type msg91Response struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// SendOTP posts the code to MSG91 for delivery. MSG91 wants the mobile in international format
// WITHOUT the leading '+', so +919000000001 becomes 919000000001. MSG91 can return a 200 with a
// body-level error, so the response type is checked too.
func (sender *MSG91) SendOTP(ctx context.Context, phone, code string) (err error) {
	payload := msg91Request{
		TemplateID: sender.templateID,
		Sender:     sender.senderID,
		Recipients: []msg91Recipient{{Mobiles: strings.TrimPrefix(phone, "+"), OTP: code}},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encoding msg91 request: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, msg91FlowURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("building msg91 request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("accept", "application/json")
	request.Header.Set("authkey", sender.authKey)

	response, err := sender.client.Do(request)
	if err != nil {
		return fmt.Errorf("calling msg91: %w", err)
	}
	// Close the body and surface a close error only if the call otherwise succeeded (a named
	// return so both bodyclose and errcheck are satisfied without discarding the error).
	defer func() {
		if closeErr := response.Body.Close(); closeErr != nil && err == nil {
			err = fmt.Errorf("closing msg91 response: %w", closeErr)
		}
	}()

	if response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("msg91 returned status %d", response.StatusCode)
	}
	var result msg91Response
	if decodeErr := json.NewDecoder(response.Body).Decode(&result); decodeErr == nil {
		if result.Type != "" && result.Type != "success" {
			return fmt.Errorf("msg91 error: %s", result.Message)
		}
	}
	return nil
}
