// Package config provides configuration loading and validation for the Stratum server.
package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// Config represents the complete server configuration.
type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Mining   MiningConfig   `yaml:"mining"`
	Redis    RedisConfig    `yaml:"redis"`
	Postgres PostgresConfig `yaml:"postgres"`
	Logging  LoggingConfig  `yaml:"logging"`
	Node     NodeConfig     `yaml:"node"`
}

// ServerConfig holds TCP server settings.
type ServerConfig struct {
	Host           string        `yaml:"host"`
	Port           int           `yaml:"port"`
	MaxConnections int           `yaml:"max_connections"`
	ReadTimeout    time.Duration `yaml:"read_timeout"`
	WriteTimeout   time.Duration `yaml:"write_timeout"`
	TLS            TLSConfig     `yaml:"tls"`
	Metrics        MetricsConfig `yaml:"metrics"`
}

// TLSConfig holds TLS settings.
type TLSConfig struct {
	Enabled  bool   `yaml:"enabled"`
	CertFile string `yaml:"cert_file"`
	KeyFile  string `yaml:"key_file"`
}

// MetricsConfig holds Prometheus metrics settings.
type MetricsConfig struct {
	Enabled bool `yaml:"enabled"`
	Port    int  `yaml:"port"`
}

// MiningConfig holds mining-related settings.
type MiningConfig struct {
	PoolAddress       string        `yaml:"pool_address"`
	CoinType          string        `yaml:"coin_type"`
	InitialDifficulty float64       `yaml:"initial_difficulty"`
	MinDifficulty     float64       `yaml:"min_difficulty"`
	MaxDifficulty     float64       `yaml:"max_difficulty"`
	TargetShareTime   time.Duration `yaml:"target_share_time"`
	RetargetTime      time.Duration `yaml:"retarget_time"`
	VariancePercent   float64       `yaml:"variance_percent"`
	JobTimeout        time.Duration `yaml:"job_timeout"`
	StaleJobThreshold int           `yaml:"stale_job_threshold"`
	Extranonce1Size   int           `yaml:"extranonce1_size"`
	Extranonce2Size   int           `yaml:"extranonce2_size"`
}

// RedisConfig holds Redis connection settings.
type RedisConfig struct {
	Host      string        `yaml:"host"`
	Port      int           `yaml:"port"`
	Password  string        `yaml:"password"`
	DB        int           `yaml:"db"`
	PoolSize  int           `yaml:"pool_size"`
	KeyPrefix string        `yaml:"key_prefix"`
	ShareTTL  time.Duration `yaml:"share_ttl"`
	WorkerTTL time.Duration `yaml:"worker_ttl"`
}

// PostgresConfig holds PostgreSQL connection settings.
type PostgresConfig struct {
	Host             string        `yaml:"host"`
	Port             int           `yaml:"port"`
	Database         string        `yaml:"database"`
	User             string        `yaml:"user"`
	Password         string        `yaml:"password"`
	MaxConnections   int           `yaml:"max_connections"`
	MinConnections   int           `yaml:"min_connections"`
	ConnectTimeout   time.Duration `yaml:"connect_timeout"`
	StatementTimeout time.Duration `yaml:"statement_timeout"`
}

// LoggingConfig holds logging settings.
type LoggingConfig struct {
	Level    string `yaml:"level"`
	Format   string `yaml:"format"`
	Output   string `yaml:"output"`
	FilePath string `yaml:"file_path"`
}

// NodeConfig holds cryptocurrency node RPC settings.
type NodeConfig struct {
	RPCURL       string        `yaml:"rpc_url"`
	RPCUser      string        `yaml:"rpc_user"`
	RPCPassword  string        `yaml:"rpc_password"`
	PollInterval time.Duration `yaml:"poll_interval"`
}

// Load reads and parses the configuration file.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Expand environment variables
	data = []byte(os.ExpandEnv(string(data)))

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Apply defaults
	applyDefaults(&cfg)

	// Validate configuration
	if err := validate(&cfg); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return &cfg, nil
}

// applyDefaults sets default values for unset configuration options.
func applyDefaults(cfg *Config) {
	// Server defaults
	if cfg.Server.Host == "" {
		cfg.Server.Host = "0.0.0.0"
	}
	if cfg.Server.Port == 0 {
		cfg.Server.Port = 3333
	}
	if cfg.Server.MaxConnections == 0 {
		cfg.Server.MaxConnections = 10000
	}
	if cfg.Server.ReadTimeout == 0 {
		cfg.Server.ReadTimeout = 5 * time.Minute
	}
	if cfg.Server.WriteTimeout == 0 {
		cfg.Server.WriteTimeout = time.Minute
	}
	if cfg.Server.Metrics.Port == 0 {
		cfg.Server.Metrics.Port = 9090
	}

	// Mining defaults
	if cfg.Mining.InitialDifficulty == 0 {
		cfg.Mining.InitialDifficulty = 1.0
	}
	if cfg.Mining.MinDifficulty == 0 {
		cfg.Mining.MinDifficulty = 0.001
	}
	if cfg.Mining.MaxDifficulty == 0 {
		cfg.Mining.MaxDifficulty = 1000000.0
	}
	if cfg.Mining.TargetShareTime == 0 {
		cfg.Mining.TargetShareTime = 10 * time.Second
	}
	if cfg.Mining.RetargetTime == 0 {
		cfg.Mining.RetargetTime = 90 * time.Second
	}
	if cfg.Mining.VariancePercent == 0 {
		cfg.Mining.VariancePercent = 30
	}
	if cfg.Mining.JobTimeout == 0 {
		cfg.Mining.JobTimeout = 2 * time.Minute
	}
	if cfg.Mining.StaleJobThreshold == 0 {
		cfg.Mining.StaleJobThreshold = 3
	}
	if cfg.Mining.Extranonce1Size == 0 {
		cfg.Mining.Extranonce1Size = 4
	}
	if cfg.Mining.Extranonce2Size == 0 {
		cfg.Mining.Extranonce2Size = 4
	}

	// Redis defaults
	if cfg.Redis.Host == "" {
		cfg.Redis.Host = "localhost"
	}
	if cfg.Redis.Port == 0 {
		cfg.Redis.Port = 6379
	}
	if cfg.Redis.PoolSize == 0 {
		cfg.Redis.PoolSize = 100
	}
	if cfg.Redis.KeyPrefix == "" {
		cfg.Redis.KeyPrefix = "stratum:"
	}
	if cfg.Redis.ShareTTL == 0 {
		cfg.Redis.ShareTTL = time.Hour
	}
	if cfg.Redis.WorkerTTL == 0 {
		cfg.Redis.WorkerTTL = 5 * time.Minute
	}

	// Postgres defaults
	if cfg.Postgres.Host == "" {
		cfg.Postgres.Host = "localhost"
	}
	if cfg.Postgres.Port == 0 {
		cfg.Postgres.Port = 5432
	}
	if cfg.Postgres.MaxConnections == 0 {
		cfg.Postgres.MaxConnections = 50
	}
	if cfg.Postgres.MinConnections == 0 {
		cfg.Postgres.MinConnections = 10
	}
	if cfg.Postgres.ConnectTimeout == 0 {
		cfg.Postgres.ConnectTimeout = 10 * time.Second
	}
	if cfg.Postgres.StatementTimeout == 0 {
		cfg.Postgres.StatementTimeout = 30 * time.Second
	}

	// Logging defaults
	if cfg.Logging.Level == "" {
		cfg.Logging.Level = "info"
	}
	if cfg.Logging.Format == "" {
		cfg.Logging.Format = "json"
	}
	if cfg.Logging.Output == "" {
		cfg.Logging.Output = "stdout"
	}

	// Node defaults
	if cfg.Node.PollInterval == 0 {
		cfg.Node.PollInterval = time.Second
	}
}

// validate checks the configuration for required fields and valid values.
func validate(cfg *Config) error {
	if cfg.Server.Port < 1 || cfg.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", cfg.Server.Port)
	}

	if cfg.Server.TLS.Enabled {
		if cfg.Server.TLS.CertFile == "" {
			return fmt.Errorf("TLS enabled but cert_file not specified")
		}
		if cfg.Server.TLS.KeyFile == "" {
			return fmt.Errorf("TLS enabled but key_file not specified")
		}
	}

	if cfg.Mining.MinDifficulty > cfg.Mining.MaxDifficulty {
		return fmt.Errorf("min_difficulty cannot be greater than max_difficulty")
	}

	if cfg.Mining.Extranonce1Size < 1 || cfg.Mining.Extranonce1Size > 8 {
		return fmt.Errorf("invalid extranonce1_size: %d", cfg.Mining.Extranonce1Size)
	}

	if cfg.Mining.Extranonce2Size < 1 || cfg.Mining.Extranonce2Size > 8 {
		return fmt.Errorf("invalid extranonce2_size: %d", cfg.Mining.Extranonce2Size)
	}

	return nil
}
