// Package protocol implements the Stratum V1 protocol messages and handlers.
package protocol

import (
	"encoding/json"
)

// JSON-RPC error codes for Stratum
const (
	ErrParseError         = -32700
	ErrInvalidRequest     = -32600
	ErrMethodNotFound     = -32601
	ErrInvalidParams      = -32602
	ErrInternalError      = -32603
	ErrUnauthorized       = 24
	ErrNotSubscribed      = 25
	ErrDuplicateShare     = 22
	ErrLowDifficultyShare = 23
	ErrJobNotFound        = 21
	ErrStaleShare         = 20
)

// Request represents a JSON-RPC request from the client.
type Request struct {
	ID     interface{}     `json:"id"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}

// Response represents a JSON-RPC response to the client.
type Response struct {
	ID     interface{} `json:"id"`
	Result interface{} `json:"result"`
	Error  interface{} `json:"error"`
}

// Notification represents a JSON-RPC notification (no id).
type Notification struct {
	ID     interface{} `json:"id"`
	Method string      `json:"method"`
	Params interface{} `json:"params"`
}

// SubscribeParams represents mining.subscribe parameters.
type SubscribeParams struct {
	UserAgent   string `json:"user_agent,omitempty"`
	SessionID   string `json:"session_id,omitempty"`
	Host        string `json:"host,omitempty"`
	Port        int    `json:"port,omitempty"`
}

// SubscribeResult represents the mining.subscribe response.
type SubscribeResult struct {
	Subscriptions   [][]interface{} `json:"subscriptions"`
	Extranonce1     string          `json:"extranonce1"`
	Extranonce2Size int             `json:"extranonce2_size"`
}

// AuthorizeParams represents mining.authorize parameters.
type AuthorizeParams struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// SubmitParams represents mining.submit parameters.
type SubmitParams struct {
	WorkerName  string `json:"worker_name"`
	JobID       string `json:"job_id"`
	Extranonce2 string `json:"extranonce2"`
	NTime       string `json:"ntime"`
	Nonce       string `json:"nonce"`
	VersionBits string `json:"version_bits,omitempty"` // For version rolling
}

// NotifyParams represents mining.notify parameters.
type NotifyParams struct {
	JobID          string   `json:"job_id"`
	PrevBlockHash  string   `json:"prevhash"`
	Coinbase1      string   `json:"coinbase1"`
	Coinbase2      string   `json:"coinbase2"`
	MerkleBranches []string `json:"merkle_branch"`
	Version        string   `json:"version"`
	NBits          string   `json:"nbits"`
	NTime          string   `json:"ntime"`
	CleanJobs      bool     `json:"clean_jobs"`
}

// SetDifficultyParams represents mining.set_difficulty parameters.
type SetDifficultyParams struct {
	Difficulty float64 `json:"difficulty"`
}

// SetExtranonceParams represents mining.set_extranonce parameters.
type SetExtranonceParams struct {
	Extranonce1     string `json:"extranonce1"`
	Extranonce2Size int    `json:"extranonce2_size"`
}

// ClientCapabilities represents advertised client capabilities.
type ClientCapabilities struct {
	VersionRolling *VersionRollingCapability `json:"version-rolling,omitempty"`
	MinDiff        *MinDiffCapability        `json:"minimum-difficulty,omitempty"`
	SubscribeExtraNonce bool                 `json:"subscribe-extranonce,omitempty"`
}

// VersionRollingCapability represents version rolling capability.
type VersionRollingCapability struct {
	Mask    string `json:"mask"`
	MinBits int    `json:"min-bit-count"`
}

// MinDiffCapability represents minimum difficulty capability.
type MinDiffCapability struct {
	Value float64 `json:"value"`
}

// ParseSubscribeParams parses mining.subscribe parameters.
func ParseSubscribeParams(data json.RawMessage) (*SubscribeParams, error) {
	var params []interface{}
	if err := json.Unmarshal(data, &params); err != nil {
		// Empty params is valid
		return &SubscribeParams{}, nil
	}

	result := &SubscribeParams{}
	if len(params) > 0 {
		if ua, ok := params[0].(string); ok {
			result.UserAgent = ua
		}
	}
	if len(params) > 1 {
		if sid, ok := params[1].(string); ok {
			result.SessionID = sid
		}
	}
	if len(params) > 2 {
		if host, ok := params[2].(string); ok {
			result.Host = host
		}
	}
	if len(params) > 3 {
		if port, ok := params[3].(float64); ok {
			result.Port = int(port)
		}
	}

	return result, nil
}

// ParseAuthorizeParams parses mining.authorize parameters.
func ParseAuthorizeParams(data json.RawMessage) (*AuthorizeParams, error) {
	var params []interface{}
	if err := json.Unmarshal(data, &params); err != nil {
		return nil, err
	}

	result := &AuthorizeParams{}
	if len(params) > 0 {
		if u, ok := params[0].(string); ok {
			result.Username = u
		}
	}
	if len(params) > 1 {
		if p, ok := params[1].(string); ok {
			result.Password = p
		}
	}

	return result, nil
}

// ParseSubmitParams parses mining.submit parameters.
func ParseSubmitParams(data json.RawMessage) (*SubmitParams, error) {
	var params []interface{}
	if err := json.Unmarshal(data, &params); err != nil {
		return nil, err
	}

	if len(params) < 5 {
		return nil, ErrInvalidParamsError
	}

	result := &SubmitParams{}
	if wn, ok := params[0].(string); ok {
		result.WorkerName = wn
	}
	if jid, ok := params[1].(string); ok {
		result.JobID = jid
	}
	if en2, ok := params[2].(string); ok {
		result.Extranonce2 = en2
	}
	if nt, ok := params[3].(string); ok {
		result.NTime = nt
	}
	if n, ok := params[4].(string); ok {
		result.Nonce = n
	}
	if len(params) > 5 {
		if vb, ok := params[5].(string); ok {
			result.VersionBits = vb
		}
	}

	return result, nil
}

// Error type for parameter parsing
type StratumError struct {
	Code    int
	Message string
}

func (e *StratumError) Error() string {
	return e.Message
}

// Common errors
var (
	ErrInvalidParamsError = &StratumError{Code: ErrInvalidParams, Message: "Invalid parameters"}
)

// NewError creates a new Stratum error.
func NewError(code int, message string) *StratumError {
	return &StratumError{Code: code, Message: message}
}

// ToJSON converts the error to JSON-RPC error format.
func (e *StratumError) ToJSON() []interface{} {
	return []interface{}{e.Code, e.Message, nil}
}
