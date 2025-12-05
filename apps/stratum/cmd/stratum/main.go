// Package main is the entry point for the Stratum mining server.
// It handles configuration loading, logger initialization, and graceful shutdown.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/viddhana/pool/internal/config"
	"github.com/viddhana/pool/internal/mining"
	"github.com/viddhana/pool/internal/server"
	"github.com/viddhana/pool/internal/storage"
	"github.com/viddhana/pool/internal/worker"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	configPath = flag.String("config", "configs/config.yaml", "Path to configuration file")
	version    = "1.0.0"
)

func main() {
	flag.Parse()

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load configuration: %v\n", err)
		os.Exit(1)
	}

	// Initialize logger
	logger, err := initLogger(cfg.Logging)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	logger.Info("Starting Stratum mining server",
		zap.String("version", version),
		zap.String("config", *configPath),
	)

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize Redis storage
	redisStorage, err := storage.NewRedisClient(ctx, cfg.Redis, logger)
	if err != nil {
		logger.Fatal("Failed to connect to Redis", zap.Error(err))
	}
	defer redisStorage.Close()

	// Initialize PostgreSQL storage
	pgStorage, err := storage.NewPostgresClient(ctx, cfg.Postgres, logger)
	if err != nil {
		logger.Fatal("Failed to connect to PostgreSQL", zap.Error(err))
	}
	defer pgStorage.Close()

	// Initialize worker manager
	workerManager := worker.NewManager(logger, redisStorage, pgStorage)

	// Initialize job manager
	jobManager := mining.NewJobManager(cfg.Mining, logger, redisStorage)

	// Initialize share validator
	shareValidator := mining.NewShareValidator(cfg.Mining, logger, redisStorage, pgStorage, jobManager)

	// Create and start the server
	srv, err := server.New(cfg.Server, logger, workerManager, jobManager, shareValidator)
	if err != nil {
		logger.Fatal("Failed to create server", zap.Error(err))
	}

	// Start the server in a goroutine
	go func() {
		if err := srv.Start(ctx); err != nil {
			logger.Error("Server error", zap.Error(err))
			cancel()
		}
	}()

	// Start metrics server if enabled
	if cfg.Server.Metrics.Enabled {
		go func() {
			if err := srv.StartMetricsServer(); err != nil {
				logger.Error("Metrics server error", zap.Error(err))
			}
		}()
	}

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	sig := <-sigChan
	logger.Info("Received shutdown signal", zap.String("signal", sig.String()))

	// Initiate graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("Error during shutdown", zap.Error(err))
	}

	logger.Info("Server shutdown complete")
}

// initLogger initializes the zap logger based on configuration.
func initLogger(cfg config.LoggingConfig) (*zap.Logger, error) {
	var level zapcore.Level
	if err := level.UnmarshalText([]byte(cfg.Level)); err != nil {
		level = zapcore.InfoLevel
	}

	var encoderConfig zapcore.EncoderConfig
	if cfg.Format == "console" {
		encoderConfig = zap.NewDevelopmentEncoderConfig()
	} else {
		encoderConfig = zap.NewProductionEncoderConfig()
	}
	encoderConfig.TimeKey = "timestamp"
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	var encoder zapcore.Encoder
	if cfg.Format == "console" {
		encoder = zapcore.NewConsoleEncoder(encoderConfig)
	} else {
		encoder = zapcore.NewJSONEncoder(encoderConfig)
	}

	var writeSyncer zapcore.WriteSyncer
	if cfg.Output == "file" && cfg.FilePath != "" {
		file, err := os.OpenFile(cfg.FilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			return nil, fmt.Errorf("failed to open log file: %w", err)
		}
		writeSyncer = zapcore.AddSync(file)
	} else {
		writeSyncer = zapcore.AddSync(os.Stdout)
	}

	core := zapcore.NewCore(encoder, writeSyncer, level)
	logger := zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))

	return logger, nil
}
