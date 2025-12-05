// Package server implements the TCP server for Stratum protocol connections.
package server

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/viddhana/pool/internal/config"
	"github.com/viddhana/pool/internal/mining"
	"github.com/viddhana/pool/internal/protocol"
	"github.com/viddhana/pool/internal/worker"

	"go.uber.org/zap"
)

// ConnectionState represents the current state of a connection.
type ConnectionState int32

const (
	StateConnected ConnectionState = iota
	StateSubscribed
	StateAuthorized
	StateMining
	StateDisconnected
)

// Connection represents a single Stratum client connection.
type Connection struct {
	id             string
	conn           net.Conn
	cfg            config.ServerConfig
	logger         *zap.Logger
	workerManager  *worker.Manager
	jobManager     *mining.JobManager
	shareValidator *mining.ShareValidator

	state      int32
	workerName string
	extranonce string
	difficulty float64

	reader    *bufio.Reader
	writeMu   sync.Mutex
	closeChan chan struct{}
	closeOnce sync.Once
}

// NewConnection creates a new connection handler.
func NewConnection(conn net.Conn, cfg config.ServerConfig, logger *zap.Logger, wm *worker.Manager, jm *mining.JobManager, sv *mining.ShareValidator) *Connection {
	return &Connection{
		id:             uuid.New().String()[:8],
		conn:           conn,
		cfg:            cfg,
		logger:         logger.Named("connection"),
		workerManager:  wm,
		jobManager:     jm,
		shareValidator: sv,
		reader:         bufio.NewReader(conn),
		closeChan:      make(chan struct{}),
		difficulty:     1.0, // Will be set properly after subscription
	}
}

// ID returns the connection ID.
func (c *Connection) ID() string {
	return c.id
}

// GetWorkerName returns the worker name for this connection.
func (c *Connection) GetWorkerName() string {
	return c.workerName
}

// GetState returns the current connection state.
func (c *Connection) GetState() ConnectionState {
	return ConnectionState(atomic.LoadInt32(&c.state))
}

// Handle processes the connection's read/write loop.
func (c *Connection) Handle(ctx context.Context) error {
	defer c.Close()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-c.closeChan:
			return nil
		default:
			// Set read deadline
			c.conn.SetReadDeadline(time.Now().Add(c.cfg.ReadTimeout))

			// Read line
			line, err := c.reader.ReadString('\n')
			if err != nil {
				if err == io.EOF {
					return nil
				}
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					c.logger.Debug("Connection read timeout", zap.String("id", c.id))
					return nil
				}
				return fmt.Errorf("read error: %w", err)
			}

			// Parse and handle message
			if err := c.handleMessage(ctx, line); err != nil {
				c.logger.Error("Failed to handle message",
					zap.String("id", c.id),
					zap.Error(err),
				)
				// Send error response but don't close connection
			}
		}
	}
}

// handleMessage parses and routes a JSON-RPC message.
func (c *Connection) handleMessage(ctx context.Context, data string) error {
	var msg protocol.Request
	if err := json.Unmarshal([]byte(data), &msg); err != nil {
		return c.sendError(msg.ID, protocol.ErrParseError, "Parse error")
	}

	c.logger.Debug("Received message",
		zap.String("id", c.id),
		zap.String("method", msg.Method),
	)

	switch msg.Method {
	case "mining.subscribe":
		return c.handleSubscribe(ctx, msg)
	case "mining.authorize":
		return c.handleAuthorize(ctx, msg)
	case "mining.submit":
		return c.handleSubmit(ctx, msg)
	case "mining.extranonce.subscribe":
		return c.handleExtranonceSubscribe(ctx, msg)
	default:
		return c.sendError(msg.ID, protocol.ErrMethodNotFound, "Method not found")
	}
}

// handleSubscribe handles mining.subscribe requests.
func (c *Connection) handleSubscribe(ctx context.Context, req protocol.Request) error {
	// Generate extranonce for this connection
	c.extranonce = c.jobManager.GenerateExtranonce1()

	// Update state
	atomic.StoreInt32(&c.state, int32(StateSubscribed))

	// Build subscription response
	subscriptions := [][]interface{}{
		{"mining.set_difficulty", c.id},
		{"mining.notify", c.id},
	}

	result := []interface{}{
		subscriptions,
		c.extranonce,
		c.jobManager.GetExtranonce2Size(),
	}

	return c.sendResult(req.ID, result)
}

// handleAuthorize handles mining.authorize requests.
func (c *Connection) handleAuthorize(ctx context.Context, req protocol.Request) error {
	if c.GetState() < StateSubscribed {
		return c.sendError(req.ID, protocol.ErrUnauthorized, "Not subscribed")
	}

	// Parse params: [username, password]
	var params []interface{}
	if err := json.Unmarshal(req.Params, &params); err != nil || len(params) < 1 {
		return c.sendError(req.ID, protocol.ErrInvalidParams, "Invalid params")
	}

	username, ok := params[0].(string)
	if !ok {
		return c.sendError(req.ID, protocol.ErrInvalidParams, "Invalid username")
	}

	password := ""
	if len(params) > 1 {
		password, _ = params[1].(string)
	}

	// Register worker
	w, err := c.workerManager.Register(ctx, username, password, c.conn.RemoteAddr().String())
	if err != nil {
		c.logger.Error("Worker registration failed",
			zap.String("id", c.id),
			zap.String("username", username),
			zap.Error(err),
		)
		return c.sendResult(req.ID, false)
	}

	c.workerName = username
	c.difficulty = w.Difficulty

	// Update state
	atomic.StoreInt32(&c.state, int32(StateAuthorized))

	c.logger.Info("Worker authorized",
		zap.String("id", c.id),
		zap.String("worker", username),
		zap.Float64("difficulty", c.difficulty),
	)

	// Send authorization result
	if err := c.sendResult(req.ID, true); err != nil {
		return err
	}

	// Send initial difficulty
	if err := c.sendDifficulty(c.difficulty); err != nil {
		return err
	}

	// Send current job
	job := c.jobManager.GetCurrentJob()
	if job != nil {
		return c.SendJob(job)
	}

	return nil
}

// handleSubmit handles mining.submit requests.
func (c *Connection) handleSubmit(ctx context.Context, req protocol.Request) error {
	if c.GetState() < StateAuthorized {
		return c.sendError(req.ID, protocol.ErrUnauthorized, "Not authorized")
	}

	// Parse params: [worker_name, job_id, extranonce2, ntime, nonce]
	var params []interface{}
	if err := json.Unmarshal(req.Params, &params); err != nil || len(params) < 5 {
		return c.sendError(req.ID, protocol.ErrInvalidParams, "Invalid params")
	}

	workerName, _ := params[0].(string)
	jobID, _ := params[1].(string)
	extranonce2, _ := params[2].(string)
	ntime, _ := params[3].(string)
	nonce, _ := params[4].(string)

	share := &mining.Share{
		WorkerName:  workerName,
		JobID:       jobID,
		Extranonce1: c.extranonce,
		Extranonce2: extranonce2,
		Ntime:       ntime,
		Nonce:       nonce,
		Difficulty:  c.difficulty,
		SubmittedAt: time.Now(),
		IPAddress:   c.conn.RemoteAddr().String(),
	}

	// Validate share
	result, err := c.shareValidator.Validate(ctx, share)
	if err != nil {
		c.logger.Error("Share validation error",
			zap.String("id", c.id),
			zap.Error(err),
		)
		return c.sendError(req.ID, protocol.ErrInternalError, "Internal error")
	}

	// Update worker statistics
	c.workerManager.UpdateStats(ctx, c.workerName, result)

	// Check result
	if !result.Valid {
		c.logger.Debug("Invalid share",
			zap.String("id", c.id),
			zap.String("worker", workerName),
			zap.String("reason", result.RejectReason),
		)
		return c.sendError(req.ID, protocol.ErrLowDifficultyShare, result.RejectReason)
	}

	c.logger.Debug("Valid share",
		zap.String("id", c.id),
		zap.String("worker", workerName),
		zap.Float64("difficulty", share.Difficulty),
	)

	// Check for vardiff adjustment
	if newDiff := c.workerManager.CheckVarDiff(ctx, c.workerName); newDiff > 0 && newDiff != c.difficulty {
		c.difficulty = newDiff
		if err := c.sendDifficulty(newDiff); err != nil {
			c.logger.Error("Failed to send difficulty update",
				zap.String("id", c.id),
				zap.Error(err),
			)
		}
	}

	return c.sendResult(req.ID, true)
}

// handleExtranonceSubscribe handles mining.extranonce.subscribe requests.
func (c *Connection) handleExtranonceSubscribe(ctx context.Context, req protocol.Request) error {
	return c.sendResult(req.ID, true)
}

// SendJob sends a mining.notify message to the client.
func (c *Connection) SendJob(job *mining.Job) error {
	if c.GetState() < StateAuthorized {
		return nil
	}

	params := []interface{}{
		job.ID,
		job.PrevBlockHash,
		job.Coinbase1,
		job.Coinbase2,
		job.MerkleBranches,
		job.Version,
		job.NBits,
		job.NTime,
		job.CleanJobs,
	}

	return c.sendNotification("mining.notify", params)
}

// SetDifficulty sets the connection difficulty and notifies the client.
func (c *Connection) SetDifficulty(difficulty float64) error {
	c.difficulty = difficulty
	return c.sendDifficulty(difficulty)
}

// sendDifficulty sends a mining.set_difficulty notification.
func (c *Connection) sendDifficulty(difficulty float64) error {
	return c.sendNotification("mining.set_difficulty", []interface{}{difficulty})
}

// sendResult sends a JSON-RPC result response.
func (c *Connection) sendResult(id interface{}, result interface{}) error {
	response := protocol.Response{
		ID:     id,
		Result: result,
		Error:  nil,
	}
	return c.send(response)
}

// sendError sends a JSON-RPC error response.
func (c *Connection) sendError(id interface{}, code int, message string) error {
	response := protocol.Response{
		ID:     id,
		Result: nil,
		Error:  []interface{}{code, message, nil},
	}
	return c.send(response)
}

// sendNotification sends a JSON-RPC notification (no id).
func (c *Connection) sendNotification(method string, params interface{}) error {
	notification := protocol.Notification{
		ID:     nil,
		Method: method,
		Params: params,
	}
	return c.send(notification)
}

// send writes a JSON message to the connection.
func (c *Connection) send(msg interface{}) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	c.conn.SetWriteDeadline(time.Now().Add(c.cfg.WriteTimeout))

	data = append(data, '\n')
	_, err = c.conn.Write(data)
	if err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}

	return nil
}

// Close closes the connection.
func (c *Connection) Close() {
	c.closeOnce.Do(func() {
		atomic.StoreInt32(&c.state, int32(StateDisconnected))
		close(c.closeChan)
		c.conn.Close()

		// Unregister worker
		if c.workerName != "" {
			c.workerManager.Disconnect(context.Background(), c.workerName)
		}
	})
}
