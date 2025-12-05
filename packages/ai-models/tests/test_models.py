"""
Unit Tests for Prometheus AI Models.

Tests for earnings prediction, difficulty forecasting,
anomaly detection, and worker optimization.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pytest

# Test configuration
pytestmark = pytest.mark.asyncio


class TestEarningsModel:
    """Tests for the earnings prediction model."""

    def test_attention_layer_initialization(self) -> None:
        """Test attention layer can be initialized."""
        from prometheus.models.earnings import AttentionLayer

        layer = AttentionLayer(hidden_size=128, num_heads=4, dropout=0.1)

        assert layer.hidden_size == 128
        assert layer.num_heads == 4
        assert layer.head_dim == 32

    def test_attention_layer_forward(self) -> None:
        """Test attention layer forward pass."""
        import torch
        from prometheus.models.earnings import AttentionLayer

        layer = AttentionLayer(hidden_size=64, num_heads=4)
        x = torch.randn(2, 10, 64)  # batch=2, seq_len=10, hidden=64

        output, attention_weights = layer(x, x, x)

        assert output.shape == x.shape
        assert attention_weights.shape == (2, 4, 10, 10)

    def test_earnings_model_initialization(self) -> None:
        """Test earnings prediction model initialization."""
        from prometheus.models.earnings import EarningsPredictionModel

        model = EarningsPredictionModel(
            input_size=10,
            hidden_size=64,
            num_layers=2,
            output_size=24,
        )

        assert model.input_size == 10
        assert model.hidden_size == 64
        assert model.output_size == 24

    def test_earnings_model_forward(self) -> None:
        """Test earnings model forward pass."""
        import torch
        from prometheus.models.earnings import EarningsPredictionModel

        model = EarningsPredictionModel(
            input_size=10,
            hidden_size=64,
            num_layers=2,
            output_size=24,
        )

        x = torch.randn(4, 168, 10)  # batch=4, seq_len=168, features=10
        output = model(x)

        assert "mean" in output
        assert "variance" in output
        assert output["mean"].shape == (4, 24)
        assert output["variance"].shape == (4, 24)

    def test_earnings_predictor_predict(self) -> None:
        """Test high-level earnings predictor."""
        from prometheus.models.earnings import EarningsPredictor

        predictor = EarningsPredictor(
            config={
                "input_size": 10,
                "hidden_size": 32,
                "num_layers": 1,
                "output_size": 24,
            }
        )

        # Set dummy normalization stats
        predictor.feature_mean = np.zeros(10)
        predictor.feature_std = np.ones(10)

        features = np.random.randn(168, 10).astype(np.float32)
        result = predictor.predict(features)

        assert result.predicted_earnings is not None
        assert 0 <= result.confidence_score <= 1
        assert result.hourly_breakdown is not None
        assert len(result.hourly_breakdown) == 24

    def test_earnings_predictor_save_load(self, tmp_path) -> None:
        """Test model saving and loading."""
        from prometheus.models.earnings import EarningsPredictor

        predictor = EarningsPredictor(config={"hidden_size": 32})
        predictor.feature_mean = np.zeros(10)
        predictor.feature_std = np.ones(10)

        model_path = tmp_path / "test_model.pt"
        predictor.save(model_path)

        # Load into new predictor
        new_predictor = EarningsPredictor()
        new_predictor.load(model_path)

        assert new_predictor.hidden_size == 32
        assert new_predictor.feature_mean is not None


class TestDifficultyModel:
    """Tests for the difficulty prediction model."""

    def test_model_initialization(self) -> None:
        """Test difficulty model initialization."""
        from prometheus.models.difficulty import DifficultyPredictionModel

        model = DifficultyPredictionModel(
            config={
                "changepoint_range": 0.8,
                "seasonality_mode": "multiplicative",
            }
        )

        assert model.changepoint_range == 0.8
        assert model.seasonality_mode == "multiplicative"
        assert not model._is_fitted

    def test_next_adjustment_calculation(self) -> None:
        """Test difficulty adjustment prediction."""
        from prometheus.models.difficulty import DifficultyPredictionModel

        model = DifficultyPredictionModel()

        adjustment = model.get_next_adjustment(
            current_block_height=700000,
            current_difficulty=25_000_000_000_000,
            current_block_time_avg=550,  # Faster than target
        )

        # Blocks should come faster -> difficulty should increase
        assert adjustment.predicted_change_percent > 0
        assert adjustment.blocks_remaining > 0
        assert adjustment.estimated_time > datetime.now()


class TestSentinelAI:
    """Tests for the Sentinel anomaly detection model."""

    def test_initialization(self) -> None:
        """Test Sentinel initialization."""
        from prometheus.models.sentinel import SentinelAI

        sentinel = SentinelAI(
            contamination=0.1,
            ensemble_weights=[0.4, 0.3, 0.3],
        )

        assert sentinel.contamination == 0.1
        assert sentinel.ensemble_weights == [0.4, 0.3, 0.3]

    def test_invalid_weights_raises_error(self) -> None:
        """Test that invalid ensemble weights raise an error."""
        from prometheus.models.sentinel import SentinelAI

        with pytest.raises(ValueError, match="sum to 1.0"):
            SentinelAI(ensemble_weights=[0.5, 0.5, 0.5])

    def test_fit_and_detect(self) -> None:
        """Test fitting and detection."""
        from prometheus.models.sentinel import SentinelAI, ThreatType

        sentinel = SentinelAI(contamination=0.1)

        # Generate training data
        np.random.seed(42)
        normal_data = np.random.randn(100, 5)
        sentinel.fit(normal_data)

        # Test normal point
        normal_point = np.random.randn(5)
        result = sentinel.detect(normal_point)

        assert hasattr(result, "is_anomaly")
        assert hasattr(result, "threat_type")
        assert hasattr(result, "severity")
        assert hasattr(result, "anomaly_score")

    def test_batch_detection(self) -> None:
        """Test batch anomaly detection."""
        from prometheus.models.sentinel import SentinelAI

        sentinel = SentinelAI()

        # Fit on normal data
        normal_data = np.random.randn(100, 5)
        sentinel.fit(normal_data)

        # Batch detect
        test_data = np.random.randn(10, 5)
        results = sentinel.detect_batch(test_data)

        assert len(results) == 10

    def test_statistics(self) -> None:
        """Test detection statistics."""
        from prometheus.models.sentinel import SentinelAI

        sentinel = SentinelAI()
        normal_data = np.random.randn(100, 5)
        sentinel.fit(normal_data)

        # Run some detections
        for _ in range(10):
            sentinel.detect(np.random.randn(5))

        stats = sentinel.get_statistics()

        assert "total_detections" in stats
        assert "anomaly_rate" in stats


class TestCircuitBreaker:
    """Tests for the circuit breaker."""

    def test_initialization(self) -> None:
        """Test circuit breaker initialization."""
        from prometheus.models.sentinel import CircuitBreaker

        cb = CircuitBreaker(failure_threshold=5, recovery_timeout=60)

        assert cb.failure_threshold == 5
        assert cb.recovery_timeout == 60
        assert cb.state == "closed"

    def test_opens_on_failures(self) -> None:
        """Test circuit opens after threshold failures."""
        from prometheus.models.sentinel import CircuitBreaker

        cb = CircuitBreaker(failure_threshold=3)

        cb.record_failure("test1")
        cb.record_failure("test2")
        assert not cb.is_open

        cb.record_failure("test3")
        assert cb.is_open

    def test_half_open_after_timeout(self) -> None:
        """Test circuit enters half-open state after timeout."""
        from prometheus.models.sentinel import CircuitBreaker
        import time

        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=1)
        cb.record_failure("test")

        assert cb.is_open

        # Wait for recovery timeout
        time.sleep(1.1)

        assert cb.state == "half_open"

    def test_closes_on_success(self) -> None:
        """Test circuit closes after successful calls in half-open."""
        from prometheus.models.sentinel import CircuitBreaker

        cb = CircuitBreaker(
            failure_threshold=1,
            recovery_timeout=0,
            half_open_max_calls=2,
        )

        cb.record_failure("test")
        cb._transition_to_half_open()

        cb.record_success()
        cb.record_success()

        assert cb.state == "closed"


class TestWorkerOptimizer:
    """Tests for the worker optimizer."""

    def test_initialization(self) -> None:
        """Test optimizer initialization."""
        from prometheus.models.optimizer import WorkerOptimizer

        optimizer = WorkerOptimizer()
        assert len(optimizer.gpu_profiles) > 0

    def test_get_gpu_profile(self) -> None:
        """Test GPU profile lookup."""
        from prometheus.models.optimizer import WorkerOptimizer

        optimizer = WorkerOptimizer()

        profile = optimizer._get_gpu_profile("RTX 3080")
        assert profile["expected_hashrate"] == 100.0

        # Unknown GPU should return default
        default_profile = optimizer._get_gpu_profile("Unknown GPU")
        assert default_profile is not None

    def test_optimize(self) -> None:
        """Test worker optimization."""
        from prometheus.models.optimizer import (
            HardwareProfile,
            OptimizationTarget,
            WorkerOptimizer,
        )

        optimizer = WorkerOptimizer()

        hardware = HardwareProfile(
            device_id="gpu-0",
            device_name="Mining Rig 1",
            gpu_model="RTX 3080",
            base_hashrate=95.0,
            base_power=250.0,
            memory_size_gb=10.0,
            core_clock=1800,
            memory_clock=9500,
            power_limit=100,  # At 100%, room for optimization
            fan_speed=70,
            temperature=85,  # Hot!
        )

        result = optimizer.optimize(hardware, OptimizationTarget.EFFICIENCY)

        assert result.worker_id == "gpu-0"
        assert len(result.suggestions) > 0
        assert len(result.warnings) > 0  # Should warn about high temp

    def test_get_optimal_settings(self) -> None:
        """Test getting optimal settings for a GPU."""
        from prometheus.models.optimizer import OptimizationTarget, WorkerOptimizer

        optimizer = WorkerOptimizer()

        settings = optimizer.get_optimal_settings(
            "RTX 3090",
            OptimizationTarget.BALANCED,
        )

        assert "core_clock_offset" in settings
        assert "memory_clock_offset" in settings
        assert "power_limit" in settings


class TestFeatureExtractor:
    """Tests for the feature extractor."""

    async def test_extract_features(self) -> None:
        """Test feature extraction."""
        import pandas as pd
        from prometheus.features.extractor import EarningsFeatureExtractor

        extractor = EarningsFeatureExtractor(
            config={
                "rolling_windows": [6, 12, 24],
                "lag_periods": [1, 6, 12],
            }
        )

        # Create sample data
        dates = pd.date_range(start="2024-01-01", periods=500, freq="h")
        data = pd.DataFrame({
            "timestamp": dates,
            "earnings": np.random.rand(500) * 100,
            "hashrate": np.random.rand(500) * 1000,
            "difficulty": np.random.rand(500) * 1e12,
        })

        result = await extractor.extract_features(data, target_column="earnings")

        assert result.features.shape[0] > 0
        assert len(result.feature_names) > 0
        assert "num_features" in result.metadata


class TestFeatureStore:
    """Tests for the feature store."""

    async def test_in_memory_store(self) -> None:
        """Test in-memory feature store operations."""
        from prometheus.features.store import InMemoryFeatureStore

        store = InMemoryFeatureStore()

        # Store a feature
        await store.store_feature(
            entity_id="worker-1",
            feature_name="hashrate",
            value=100.5,
        )

        # Retrieve it
        feature = await store.get_feature("worker-1", "hashrate")

        assert feature is not None
        assert feature.value == 100.5

    async def test_feature_history(self) -> None:
        """Test feature history retrieval."""
        from prometheus.features.store import InMemoryFeatureStore

        store = InMemoryFeatureStore()

        base_time = datetime.now()
        for i in range(5):
            await store.store_feature(
                entity_id="worker-1",
                feature_name="hashrate",
                value=100.0 + i,
                timestamp=base_time + timedelta(hours=i),
            )

        history = await store.get_feature_history(
            entity_id="worker-1",
            feature_name="hashrate",
            start_time=base_time,
            end_time=base_time + timedelta(hours=10),
        )

        assert len(history) == 5


class TestDataset:
    """Tests for dataset classes."""

    def test_mining_dataset(self) -> None:
        """Test mining dataset creation."""
        from prometheus.training.dataset import MiningDataset

        features = np.random.randn(1000, 10).astype(np.float32)
        targets = np.random.randn(1000, 1).astype(np.float32)

        dataset = MiningDataset(
            features=features,
            targets=targets,
            sequence_length=168,
            prediction_horizon=24,
        )

        assert len(dataset) > 0

        x, y = dataset[0]
        assert x.shape == (168, 10)
        assert y.shape == (24,)

    def test_create_data_loaders(self) -> None:
        """Test data loader creation."""
        from prometheus.training.dataset import create_data_loaders

        features = np.random.randn(1000, 10).astype(np.float32)
        targets = np.random.randn(1000, 1).astype(np.float32)

        train_loader, val_loader, test_loader = create_data_loaders(
            features=features,
            targets=targets,
            sequence_length=100,
            prediction_horizon=10,
            batch_size=16,
        )

        assert len(train_loader) > 0
        assert len(val_loader) > 0
        assert len(test_loader) > 0


class TestTrainer:
    """Tests for the trainer."""

    def test_early_stopping(self) -> None:
        """Test early stopping logic."""
        from prometheus.training.trainer import EarlyStopping

        es = EarlyStopping(patience=3, min_delta=0.01)

        # Improving scores
        assert not es(1.0)
        assert not es(0.9)
        assert not es(0.8)

        # Stagnant scores
        assert not es(0.79)
        assert not es(0.79)
        assert es(0.79)  # Should trigger


class TestCache:
    """Tests for prediction caching."""

    async def test_in_memory_cache(self) -> None:
        """Test in-memory cache operations."""
        from prometheus.serving.cache import InMemoryCache

        cache = InMemoryCache(max_size=10, default_ttl=60)

        # Set prediction
        await cache.set_prediction(
            model_type="earnings",
            key="worker-1",
            value={"predicted_earnings": 100.0},
        )

        # Get prediction
        result = await cache.get_prediction("earnings", "worker-1")

        assert result is not None
        assert result["predicted_earnings"] == 100.0

    async def test_cache_invalidation(self) -> None:
        """Test cache invalidation."""
        from prometheus.serving.cache import InMemoryCache

        cache = InMemoryCache()

        await cache.set_prediction("earnings", "worker-1", {"value": 1})
        await cache.invalidate("earnings", "worker-1")

        result = await cache.get_prediction("earnings", "worker-1")
        assert result is None


# Integration tests would go here
class TestIntegration:
    """Integration tests for end-to-end flows."""

    async def test_earnings_prediction_flow(self) -> None:
        """Test complete earnings prediction flow."""
        import pandas as pd
        from prometheus.features.extractor import EarningsFeatureExtractor
        from prometheus.models.earnings import EarningsPredictor

        # Generate sample data
        dates = pd.date_range(start="2024-01-01", periods=500, freq="h")
        data = pd.DataFrame({
            "timestamp": dates,
            "earnings": np.random.rand(500) * 100,
            "hashrate": np.random.rand(500) * 1000,
        })

        # Extract features
        extractor = EarningsFeatureExtractor()
        feature_set = await extractor.extract_features(data)

        # Create predictor
        predictor = EarningsPredictor(
            config={"input_size": feature_set.features.shape[1]}
        )

        # Fit normalization
        predictor.fit_normalization(feature_set.features)

        # Make prediction
        input_features = feature_set.features[-168:]
        result = predictor.predict(input_features)

        assert result.predicted_earnings is not None
        assert result.hourly_breakdown is not None
