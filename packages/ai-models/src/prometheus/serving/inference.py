"""
Inference Engine for Prometheus AI.

Manages model loading, inference batching, and predictions
across all Prometheus AI models.
"""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import numpy as np

from prometheus.config import PrometheusConfig
from prometheus.models.difficulty import DifficultyPrediction, DifficultyPredictionModel
from prometheus.models.earnings import EarningsPredictor, EarningsPrediction
from prometheus.models.optimizer import (
    HardwareProfile,
    OptimizationResult,
    OptimizationTarget,
    WorkerOptimizer,
)
from prometheus.models.sentinel import AnomalyDetectionResult, SentinelAI

logger = logging.getLogger(__name__)


class InferenceEngine:
    """
    Central inference engine for all Prometheus AI models.

    Handles model loading, inference batching, and provides
    a unified interface for predictions.

    Args:
        config: Prometheus configuration
        max_workers: Maximum number of inference workers
    """

    def __init__(
        self,
        config: PrometheusConfig,
        max_workers: int = 4,
    ) -> None:
        self.config = config
        self.max_workers = max_workers

        # Models
        self._earnings_model: EarningsPredictor | None = None
        self._difficulty_model: DifficultyPredictionModel | None = None
        self._sentinel: SentinelAI | None = None
        self._optimizer: WorkerOptimizer | None = None

        # Thread pool for CPU-bound inference
        self._executor = ThreadPoolExecutor(max_workers=max_workers)

        # Status flags
        self._initialized = False
        self._models_loaded: dict[str, bool] = {
            "earnings": False,
            "difficulty": False,
            "sentinel": False,
            "optimizer": False,
        }

    async def initialize(self) -> None:
        """Initialize and load all models."""
        logger.info("Initializing inference engine...")

        # Load models in parallel
        await asyncio.gather(
            self._load_earnings_model(),
            self._load_difficulty_model(),
            self._load_sentinel_model(),
            self._load_optimizer(),
            return_exceptions=True,
        )

        self._initialized = True
        logger.info(f"Inference engine initialized. Models loaded: {self._models_loaded}")

    async def _load_earnings_model(self) -> None:
        """Load earnings prediction model."""
        try:
            model_path = self.config.get_model_path("earnings_model.pt")

            self._earnings_model = EarningsPredictor(
                config={
                    "input_size": self.config.model.earnings_hidden_size,
                    "hidden_size": self.config.model.earnings_hidden_size,
                    "num_layers": self.config.model.earnings_num_layers,
                    "dropout": self.config.model.earnings_dropout,
                    "num_heads": self.config.model.earnings_attention_heads,
                }
            )

            if model_path.exists():
                self._earnings_model.load(model_path)
                logger.info("Earnings model loaded from checkpoint")
            else:
                logger.warning("No earnings model checkpoint found, using untrained model")

            self._models_loaded["earnings"] = True

        except Exception as e:
            logger.error(f"Failed to load earnings model: {e}")
            self._models_loaded["earnings"] = False

    async def _load_difficulty_model(self) -> None:
        """Load difficulty prediction model."""
        try:
            model_path = self.config.get_model_path("difficulty_model.pkl")

            self._difficulty_model = DifficultyPredictionModel(
                config={
                    "changepoint_range": self.config.model.difficulty_changepoint_range,
                    "seasonality_mode": self.config.model.difficulty_seasonality_mode,
                }
            )

            if model_path.exists():
                self._difficulty_model.load(model_path)
                logger.info("Difficulty model loaded from checkpoint")
            else:
                logger.warning("No difficulty model checkpoint found, using untrained model")

            self._models_loaded["difficulty"] = True

        except Exception as e:
            logger.error(f"Failed to load difficulty model: {e}")
            self._models_loaded["difficulty"] = False

    async def _load_sentinel_model(self) -> None:
        """Load Sentinel anomaly detection model."""
        try:
            self._sentinel = SentinelAI(
                contamination=self.config.model.sentinel_contamination,
                ensemble_weights=self.config.model.sentinel_ensemble_weights,
            )

            # Sentinel requires training data - load pre-trained state if available
            model_path = self.config.get_model_path("sentinel_model.pkl")
            if model_path.exists():
                import pickle
                with open(model_path, "rb") as f:
                    state = pickle.load(f)
                    self._sentinel._iforest = state.get("iforest")
                    self._sentinel._lof = state.get("lof")
                    self._sentinel._knn = state.get("knn")
                    self._sentinel._feature_mean = state.get("feature_mean")
                    self._sentinel._feature_std = state.get("feature_std")
                    self._sentinel._is_fitted = True
                logger.info("Sentinel model loaded from checkpoint")
            else:
                logger.warning("No Sentinel model checkpoint found")

            self._models_loaded["sentinel"] = True

        except Exception as e:
            logger.error(f"Failed to load Sentinel model: {e}")
            self._models_loaded["sentinel"] = False

    async def _load_optimizer(self) -> None:
        """Load worker optimizer."""
        try:
            self._optimizer = WorkerOptimizer()
            self._models_loaded["optimizer"] = True
            logger.info("Worker optimizer initialized")

        except Exception as e:
            logger.error(f"Failed to initialize optimizer: {e}")
            self._models_loaded["optimizer"] = False

    def is_ready(self) -> bool:
        """Check if engine is ready for inference."""
        return self._initialized and any(self._models_loaded.values())

    def get_model_status(self) -> dict[str, bool]:
        """Get status of all models."""
        return self._models_loaded.copy()

    async def predict_earnings(
        self,
        features: np.ndarray,
        confidence_level: float = 0.95,
    ) -> EarningsPrediction:
        """
        Predict earnings using the LSTM model.

        Args:
            features: Feature array of shape (seq_len, num_features)
            confidence_level: Confidence level for prediction intervals

        Returns:
            EarningsPrediction with results
        """
        if self._earnings_model is None:
            raise RuntimeError("Earnings model not loaded")

        # Run inference in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self._executor,
            lambda: self._earnings_model.predict(features, confidence_level),
        )

        return result

    async def predict_difficulty(
        self,
        periods: int = 14,
        include_components: bool = False,
    ) -> list[dict[str, Any]]:
        """
        Predict future difficulty.

        Args:
            periods: Number of days to predict
            include_components: Include trend components in response

        Returns:
            List of prediction dictionaries
        """
        if self._difficulty_model is None:
            raise RuntimeError("Difficulty model not loaded")

        if not self._difficulty_model._is_fitted:
            raise RuntimeError("Difficulty model not trained")

        loop = asyncio.get_event_loop()
        predictions = await loop.run_in_executor(
            self._executor,
            lambda: self._difficulty_model.predict(periods, include_history=False),
        )

        return [
            {
                "timestamp": p.timestamp.isoformat(),
                "predicted_difficulty": p.predicted_difficulty,
                "lower_bound": p.lower_bound,
                "upper_bound": p.upper_bound,
                "trend_direction": p.trend_direction,
                "confidence": p.confidence,
                "components": p.components if include_components else None,
            }
            for p in predictions
        ]

    async def detect_anomaly(
        self,
        features: np.ndarray,
        threshold: float | None = None,
    ) -> AnomalyDetectionResult:
        """
        Detect anomalies using Sentinel AI.

        Args:
            features: Feature vector
            threshold: Custom detection threshold

        Returns:
            AnomalyDetectionResult with detection details
        """
        if self._sentinel is None:
            raise RuntimeError("Sentinel model not loaded")

        if not self._sentinel._is_fitted:
            raise RuntimeError("Sentinel model not trained")

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self._executor,
            lambda: self._sentinel.detect(features, threshold),
        )

        return result

    async def optimize_worker(
        self,
        hardware_profile: dict[str, Any],
        optimization_target: str = "balanced",
    ) -> OptimizationResult:
        """
        Get optimization suggestions for a worker.

        Args:
            hardware_profile: Worker hardware configuration
            optimization_target: Optimization objective

        Returns:
            OptimizationResult with suggestions
        """
        if self._optimizer is None:
            raise RuntimeError("Optimizer not loaded")

        # Convert to HardwareProfile
        profile = HardwareProfile(
            device_id=hardware_profile["device_id"],
            device_name=hardware_profile["device_name"],
            gpu_model=hardware_profile["gpu_model"],
            base_hashrate=hardware_profile["base_hashrate"],
            base_power=hardware_profile["base_power"],
            memory_size_gb=hardware_profile["memory_size_gb"],
            core_clock=hardware_profile["core_clock"],
            memory_clock=hardware_profile["memory_clock"],
            power_limit=hardware_profile["power_limit"],
            fan_speed=hardware_profile["fan_speed"],
            temperature=hardware_profile["temperature"],
            vram_temperature=hardware_profile.get("vram_temperature"),
        )

        # Get optimization target enum
        target = OptimizationTarget(optimization_target.lower())

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self._executor,
            lambda: self._optimizer.optimize(profile, target),
        )

        return result

    async def predict_batch(
        self,
        model_type: str,
        inputs: list[np.ndarray],
        **kwargs: Any,
    ) -> list[Any]:
        """
        Run batch prediction for efficiency.

        Args:
            model_type: Type of model (earnings, difficulty, sentinel)
            inputs: List of input arrays
            **kwargs: Additional arguments

        Returns:
            List of predictions
        """
        if model_type == "earnings":
            # Batch earnings predictions
            features_batch = np.stack(inputs)
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                self._executor,
                lambda: self._earnings_model.predict_batch(
                    features_batch,
                    confidence_level=kwargs.get("confidence_level", 0.95),
                ),
            )
            return results

        elif model_type == "sentinel":
            # Batch anomaly detection
            features_batch = np.stack(inputs)
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                self._executor,
                lambda: self._sentinel.detect_batch(
                    features_batch,
                    threshold=kwargs.get("threshold"),
                ),
            )
            return results

        else:
            raise ValueError(f"Batch prediction not supported for model type: {model_type}")

    async def shutdown(self) -> None:
        """Shutdown inference engine and release resources."""
        logger.info("Shutting down inference engine...")
        self._executor.shutdown(wait=True)
        self._initialized = False
