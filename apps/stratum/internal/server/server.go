// Package server implements the TCP server for Stratum protocol connections.
package server

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"sync"
	"sync/atomic"

	"github.com/viddhana/pool/internal/config"
	"github.com/viddhana/pool/internal/mining"
	"github.com/viddhana/pool/internal/worker"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

// Prometheus metrics
var (
	activeConnections = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "stratum_active_connections",
		Help: "Number of active connections",
	})
	totalConnections = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "stratum_total_connections",
		Help: "Total number of connections",
	})
	connectionErrors = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "stratum_connection_errors",
		Help: "Total number of connection errors",
	})
)

func init() {
	prometheus.MustRegister(activeConnections)
	prometheus.MustRegister(totalConnections)
	prometheus.MustRegister(connectionErrors)
}

// Server represents the Stratum TCP server.
type Server struct {
	cfg            config.ServerConfig
	logger         *zap.Logger
	workerManager  *worker.Manager
	jobManager     *mining.JobManager
	shareValidator *mining.ShareValidator

	listener      net.Listener
	metricsServer *http.Server
	connections   sync.Map // map[string]*Connection
	connCount     int64
	shutdown      int32
	wg            sync.WaitGroup
	mu            sync.RWMutex
}

// New creates a new Stratum server instance.
func New(cfg config.ServerConfig, logger *zap.Logger, wm *worker.Manager, jm *mining.JobManager, sv *mining.ShareValidator) (*Server, error) {
	return &Server{
		cfg:            cfg,
		logger:         logger.Named("server"),
		workerManager:  wm,
		jobManager:     jm,
		shareValidator: sv,
	}, nil
}

// Start begins listening for and accepting connections.
func (s *Server) Start(ctx context.Context) error {
	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)

	var listener net.Listener
	var err error

	if s.cfg.TLS.Enabled {
		listener, err = s.createTLSListener(addr)
	} else {
		listener, err = net.Listen("tcp", addr)
	}

	if err != nil {
		return fmt.Errorf("failed to start listener: %w", err)
	}

	s.listener = listener
	s.logger.Info("Server started",
		zap.String("address", addr),
		zap.Bool("tls", s.cfg.TLS.Enabled),
		zap.Int("max_connections", s.cfg.MaxConnections),
	)

	// Start job broadcaster
	go s.broadcastJobs(ctx)

	// Accept connections
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			conn, err := listener.Accept()
			if err != nil {
				if atomic.LoadInt32(&s.shutdown) == 1 {
					return nil
				}
				s.logger.Error("Failed to accept connection", zap.Error(err))
				connectionErrors.Inc()
				continue
			}

			// Check max connections
			if atomic.LoadInt64(&s.connCount) >= int64(s.cfg.MaxConnections) {
				s.logger.Warn("Max connections reached, rejecting connection",
					zap.String("remote_addr", conn.RemoteAddr().String()),
				)
				conn.Close()
				continue
			}

			s.wg.Add(1)
			go s.handleConnection(ctx, conn)
		}
	}
}

// createTLSListener creates a TLS-enabled listener.
func (s *Server) createTLSListener(addr string) (net.Listener, error) {
	cert, err := tls.LoadX509KeyPair(s.cfg.TLS.CertFile, s.cfg.TLS.KeyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to load TLS certificates: %w", err)
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	}

	return tls.Listen("tcp", addr, tlsConfig)
}

// handleConnection processes a single client connection.
func (s *Server) handleConnection(ctx context.Context, conn net.Conn) {
	defer s.wg.Done()

	atomic.AddInt64(&s.connCount, 1)
	activeConnections.Inc()
	totalConnections.Inc()

	defer func() {
		atomic.AddInt64(&s.connCount, -1)
		activeConnections.Dec()
	}()

	// Create connection wrapper
	stratumConn := NewConnection(conn, s.cfg, s.logger, s.workerManager, s.jobManager, s.shareValidator)

	// Store connection
	connID := stratumConn.ID()
	s.connections.Store(connID, stratumConn)
	defer s.connections.Delete(connID)

	s.logger.Debug("New connection",
		zap.String("connection_id", connID),
		zap.String("remote_addr", conn.RemoteAddr().String()),
	)

	// Handle the connection
	if err := stratumConn.Handle(ctx); err != nil {
		s.logger.Debug("Connection closed",
			zap.String("connection_id", connID),
			zap.Error(err),
		)
	}
}

// broadcastJobs sends new jobs to all connected workers.
func (s *Server) broadcastJobs(ctx context.Context) {
	jobChan := s.jobManager.Subscribe()

	for {
		select {
		case <-ctx.Done():
			return
		case job := <-jobChan:
			s.connections.Range(func(key, value interface{}) bool {
				if conn, ok := value.(*Connection); ok {
					if err := conn.SendJob(job); err != nil {
						s.logger.Debug("Failed to send job to connection",
							zap.String("connection_id", key.(string)),
							zap.Error(err),
						)
					}
				}
				return true
			})
		}
	}
}

// StartMetricsServer starts the Prometheus metrics HTTP server.
func (s *Server) StartMetricsServer() error {
	addr := fmt.Sprintf(":%d", s.cfg.Metrics.Port)

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	s.metricsServer = &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	s.logger.Info("Metrics server started", zap.String("address", addr))
	return s.metricsServer.ListenAndServe()
}

// Shutdown gracefully shuts down the server.
func (s *Server) Shutdown(ctx context.Context) error {
	atomic.StoreInt32(&s.shutdown, 1)

	// Close listener
	if s.listener != nil {
		s.listener.Close()
	}

	// Close all connections
	s.connections.Range(func(key, value interface{}) bool {
		if conn, ok := value.(*Connection); ok {
			conn.Close()
		}
		return true
	})

	// Wait for all goroutines to finish
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		s.logger.Info("All connections closed")
	case <-ctx.Done():
		s.logger.Warn("Shutdown timeout, some connections may be forcefully closed")
	}

	// Shutdown metrics server
	if s.metricsServer != nil {
		if err := s.metricsServer.Shutdown(ctx); err != nil {
			s.logger.Error("Failed to shutdown metrics server", zap.Error(err))
		}
	}

	return nil
}

// GetConnectionCount returns the current number of active connections.
func (s *Server) GetConnectionCount() int64 {
	return atomic.LoadInt64(&s.connCount)
}

// GetConnection returns a connection by ID.
func (s *Server) GetConnection(id string) (*Connection, bool) {
	if conn, ok := s.connections.Load(id); ok {
		return conn.(*Connection), true
	}
	return nil, false
}

// BroadcastDifficulty sends difficulty update to specific worker.
func (s *Server) BroadcastDifficulty(workerID string, difficulty float64) error {
	s.connections.Range(func(key, value interface{}) bool {
		if conn, ok := value.(*Connection); ok {
			if conn.GetWorkerName() == workerID {
				conn.SetDifficulty(difficulty)
			}
		}
		return true
	})
	return nil
}

// DisconnectWorker disconnects a specific worker.
func (s *Server) DisconnectWorker(workerID string) {
	s.connections.Range(func(key, value interface{}) bool {
		if conn, ok := value.(*Connection); ok {
			if conn.GetWorkerName() == workerID {
				conn.Close()
			}
		}
		return true
	})
}
