"""
Configuration management for Prometheus AI.

Provides centralized configuration handling with environment variable support,
YAML config file loading, and type-safe settings using Pydantic.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseConfig(BaseSettings):
    """Database connection configuration."""

    model_config = SettingsConfigDict(env_prefix="PROMETHEUS_DB_")

    host: str = Field(default="localhost", description="Database host")
    port: int = Field(default=5432, description="Database port")
    name: str = Field(default="prometheus", description="Database name")
    user: str = Field(default="prometheus", description="Database user")
    password: str = Field(default="", description="Database password")
    pool_size: int = Field(default=10, description="Connection pool size")
    pool_max_overflow: int = Field(default=20, description="Max pool overflow")

    @property
    def connection_string(self) -> str:
        """Generate PostgreSQL connection string."""
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"

    @property
    def async_connection_string(self) -> str:
        """Generate async PostgreSQL connection string."""
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"


class RedisConfig(BaseSettings):
    """Redis connection configuration."""

    model_config = SettingsConfigDict(env_prefix="PROMETHEUS_REDIS_")

    host: str = Field(default="localhost", description="Redis host")
    port: int = Field(default=6379, description="Redis port")
    db: int = Field(default=0, description="Redis database number")
    password: str | None = Field(default=None, description="Redis password")
    ssl: bool = Field(default=False, description="Use SSL for connection")
    cache_ttl: int = Field(default=3600, description="Default cache TTL in seconds")

    @property
    def connection_string(self) -> str:
        """Generate Redis connection string."""
        protocol = "rediss" if self.ssl else "redis"
        auth = f":{self.password}@" if self.password else ""
        return f"{protocol}://{auth}{self.host}:{self.port}/{self.db}"


class ModelConfig(BaseSettings):
    """Model training and serving configuration."""

    model_config = SettingsConfigDict(env_prefix="PROMETHEUS_MODEL_")

    # Earnings model
    earnings_hidden_size: int = Field(default=128, description="LSTM hidden size")
    earnings_num_layers: int = Field(default=2, description="Number of LSTM layers")
    earnings_dropout: float = Field(default=0.2, description="Dropout rate")
    earnings_sequence_length: int = Field(default=168, description="Input sequence length (hours)")
    earnings_attention_heads: int = Field(default=4, description="Number of attention heads")

    # Difficulty model
    difficulty_changepoint_range: float = Field(default=0.8, description="Changepoint range")
    difficulty_seasonality_mode: str = Field(default="multiplicative", description="Seasonality mode")

    # Sentinel (anomaly detection)
    sentinel_contamination: float = Field(default=0.1, description="Expected anomaly rate")
    sentinel_ensemble_weights: list[float] = Field(
        default=[0.4, 0.3, 0.3],
        description="Weights for [IsolationForest, LOF, KNN]"
    )

    # Training
    batch_size: int = Field(default=32, description="Training batch size")
    learning_rate: float = Field(default=0.001, description="Learning rate")
    epochs: int = Field(default=100, description="Maximum training epochs")
    early_stopping_patience: int = Field(default=10, description="Early stopping patience")

    @field_validator("sentinel_ensemble_weights")
    @classmethod
    def validate_weights(cls, v: list[float]) -> list[float]:
        """Ensure ensemble weights sum to 1.0."""
        if abs(sum(v) - 1.0) > 0.001:
            raise ValueError("Ensemble weights must sum to 1.0")
        return v


class ServingConfig(BaseSettings):
    """API serving configuration."""

    model_config = SettingsConfigDict(env_prefix="PROMETHEUS_SERVING_")

    host: str = Field(default="0.0.0.0", description="API host")
    port: int = Field(default=8000, description="API port")
    workers: int = Field(default=4, description="Number of workers")
    reload: bool = Field(default=False, description="Enable auto-reload")
    log_level: str = Field(default="info", description="Log level")
    cors_origins: list[str] = Field(default=["*"], description="CORS allowed origins")
    rate_limit: int = Field(default=100, description="Rate limit per minute")

    # Inference
    max_batch_size: int = Field(default=64, description="Maximum batch size for inference")
    inference_timeout: float = Field(default=30.0, description="Inference timeout in seconds")
    enable_caching: bool = Field(default=True, description="Enable prediction caching")


class MLflowConfig(BaseSettings):
    """MLflow tracking configuration."""

    model_config = SettingsConfigDict(env_prefix="PROMETHEUS_MLFLOW_")

    tracking_uri: str = Field(default="sqlite:///mlflow.db", description="MLflow tracking URI")
    experiment_name: str = Field(default="prometheus", description="Experiment name")
    artifact_location: str | None = Field(default=None, description="Artifact storage location")
    enable_tracking: bool = Field(default=True, description="Enable MLflow tracking")


class PrometheusConfig(BaseSettings):
    """Main Prometheus AI configuration."""

    model_config = SettingsConfigDict(
        env_prefix="PROMETHEUS_",
        env_nested_delimiter="__",
        case_sensitive=False,
    )

    # Environment
    environment: Literal["development", "staging", "production"] = Field(
        default="development",
        description="Deployment environment"
    )
    debug: bool = Field(default=False, description="Enable debug mode")
    log_level: str = Field(default="INFO", description="Logging level")

    # Paths
    models_dir: Path = Field(
        default=Path("./models"),
        description="Directory for saved models"
    )
    data_dir: Path = Field(
        default=Path("./data"),
        description="Directory for data files"
    )
    configs_dir: Path = Field(
        default=Path("./configs"),
        description="Directory for config files"
    )

    # Sub-configurations
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    redis: RedisConfig = Field(default_factory=RedisConfig)
    model: ModelConfig = Field(default_factory=ModelConfig)
    serving: ServingConfig = Field(default_factory=ServingConfig)
    mlflow: MLflowConfig = Field(default_factory=MLflowConfig)

    def __init__(self, **kwargs: Any) -> None:
        """Initialize configuration with optional config file loading."""
        super().__init__(**kwargs)
        self._ensure_directories()

    def _ensure_directories(self) -> None:
        """Ensure required directories exist."""
        for dir_path in [self.models_dir, self.data_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)

    @classmethod
    def from_yaml(cls, config_path: str | Path) -> PrometheusConfig:
        """Load configuration from YAML file."""
        config_path = Path(config_path)
        if not config_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")

        with open(config_path) as f:
            config_data = yaml.safe_load(f)

        return cls(**config_data)

    def get_model_path(self, model_name: str) -> Path:
        """Get the path for a specific model."""
        return self.models_dir / model_name

    def to_dict(self) -> dict[str, Any]:
        """Convert configuration to dictionary."""
        return self.model_dump()


@lru_cache()
def get_config() -> PrometheusConfig:
    """
    Get the cached Prometheus configuration.

    Configuration is loaded from environment variables and optionally
    from a YAML file specified by PROMETHEUS_CONFIG_FILE.

    Returns:
        PrometheusConfig: The application configuration
    """
    config_file = os.getenv("PROMETHEUS_CONFIG_FILE")
    if config_file and Path(config_file).exists():
        return PrometheusConfig.from_yaml(config_file)
    return PrometheusConfig()


def reload_config() -> PrometheusConfig:
    """
    Reload the configuration, clearing the cache.

    Returns:
        PrometheusConfig: The newly loaded configuration
    """
    get_config.cache_clear()
    return get_config()
