"""
Sentinel AI - Anomaly Detection and Security Monitoring.

This module provides ensemble-based anomaly detection for identifying
threats, unusual patterns, and security issues in mining operations.
Uses a combination of Isolation Forest, Local Outlier Factor, and
K-Nearest Neighbors for robust detection.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from threading import Lock
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class ThreatType(Enum):
    """Types of detected threats."""

    NONE = "none"
    HASHRATE_ANOMALY = "hashrate_anomaly"
    EARNINGS_ANOMALY = "earnings_anomaly"
    WORKER_BEHAVIOR = "worker_behavior"
    NETWORK_ATTACK = "network_attack"
    POOL_HOPPING = "pool_hopping"
    SHARE_MANIPULATION = "share_manipulation"
    DDOS_ATTEMPT = "ddos_attempt"
    UNKNOWN = "unknown"


class Severity(Enum):
    """Severity levels for detected anomalies."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class AnomalyDetectionResult:
    """Container for anomaly detection results."""

    is_anomaly: bool
    threat_type: ThreatType
    severity: Severity
    confidence: float
    anomaly_score: float
    contributing_factors: list[str]
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CircuitBreakerState:
    """State of the circuit breaker."""

    is_open: bool
    failures: int
    last_failure: datetime | None
    recovery_time: datetime | None
    reason: str | None


class SentinelAI:
    """
    Ensemble-based anomaly detection system.

    Combines multiple anomaly detection algorithms to provide
    robust detection of suspicious activities in mining operations.

    Args:
        contamination: Expected proportion of anomalies in the data
        ensemble_weights: Weights for [IsolationForest, LOF, KNN] detectors
        config: Additional configuration parameters
    """

    def __init__(
        self,
        contamination: float = 0.1,
        ensemble_weights: list[float] | None = None,
        config: dict[str, Any] | None = None,
    ) -> None:
        self.contamination = contamination
        self.ensemble_weights = ensemble_weights or [0.4, 0.3, 0.3]
        self.config = config or {}

        # Validate weights
        if abs(sum(self.ensemble_weights) - 1.0) > 0.001:
            raise ValueError("Ensemble weights must sum to 1.0")

        # Initialize detectors
        self._iforest = None
        self._lof = None
        self._knn = None
        self._is_fitted = False

        # Feature statistics for normalization
        self._feature_mean: np.ndarray | None = None
        self._feature_std: np.ndarray | None = None

        # Threat classification thresholds
        self.severity_thresholds = {
            Severity.LOW: 0.3,
            Severity.MEDIUM: 0.5,
            Severity.HIGH: 0.7,
            Severity.CRITICAL: 0.9,
        }

        # Detection history for pattern analysis
        self._detection_history: list[AnomalyDetectionResult] = []
        self._max_history = self.config.get("max_history", 1000)

    def _build_detectors(self) -> None:
        """Initialize the ensemble detectors."""
        try:
            from pyod.models.iforest import IForest
            from pyod.models.knn import KNN
            from pyod.models.lof import LOF
        except ImportError as e:
            raise ImportError(
                "PyOD is required for anomaly detection. "
                "Install with: pip install pyod"
            ) from e

        # Isolation Forest - good for high-dimensional data
        self._iforest = IForest(
            contamination=self.contamination,
            n_estimators=self.config.get("iforest_n_estimators", 100),
            max_samples="auto",
            random_state=42,
        )

        # Local Outlier Factor - density-based detection
        self._lof = LOF(
            contamination=self.contamination,
            n_neighbors=self.config.get("lof_n_neighbors", 20),
            algorithm="auto",
        )

        # K-Nearest Neighbors - distance-based detection
        self._knn = KNN(
            contamination=self.contamination,
            n_neighbors=self.config.get("knn_n_neighbors", 5),
            method="mean",
        )

    def fit(self, data: np.ndarray) -> SentinelAI:
        """
        Fit the ensemble detectors on training data.

        Args:
            data: Training data array of shape (n_samples, n_features)

        Returns:
            Self for method chaining
        """
        logger.info(f"Training Sentinel AI on {len(data)} samples...")

        # Store normalization statistics
        self._feature_mean = np.mean(data, axis=0)
        self._feature_std = np.std(data, axis=0)

        # Normalize data
        normalized_data = self._normalize(data)

        # Build and train detectors
        self._build_detectors()

        self._iforest.fit(normalized_data)
        self._lof.fit(normalized_data)
        self._knn.fit(normalized_data)

        self._is_fitted = True
        logger.info("Sentinel AI training completed")

        return self

    def _normalize(self, data: np.ndarray) -> np.ndarray:
        """Normalize data using stored statistics."""
        if self._feature_mean is None or self._feature_std is None:
            return data
        return (data - self._feature_mean) / (self._feature_std + 1e-8)

    def _get_ensemble_score(self, data: np.ndarray) -> np.ndarray:
        """
        Calculate weighted ensemble anomaly scores.

        Args:
            data: Input data array

        Returns:
            Array of anomaly scores (higher = more anomalous)
        """
        normalized = self._normalize(data)

        # Get scores from each detector (normalized to [0, 1])
        iforest_scores = self._iforest.decision_function(normalized)
        lof_scores = self._lof.decision_function(normalized)
        knn_scores = self._knn.decision_function(normalized)

        # Normalize scores to [0, 1] range
        def normalize_scores(scores: np.ndarray) -> np.ndarray:
            min_s, max_s = scores.min(), scores.max()
            if max_s - min_s < 1e-8:
                return np.zeros_like(scores)
            return (scores - min_s) / (max_s - min_s)

        iforest_norm = normalize_scores(iforest_scores)
        lof_norm = normalize_scores(lof_scores)
        knn_norm = normalize_scores(knn_scores)

        # Weighted combination
        ensemble_scores = (
            self.ensemble_weights[0] * iforest_norm
            + self.ensemble_weights[1] * lof_norm
            + self.ensemble_weights[2] * knn_norm
        )

        return ensemble_scores

    def _classify_threat(
        self,
        features: np.ndarray,
        anomaly_score: float,
    ) -> tuple[ThreatType, list[str]]:
        """
        Classify the type of threat based on feature analysis.

        Args:
            features: Input feature vector
            anomaly_score: The computed anomaly score

        Returns:
            Tuple of (ThreatType, list of contributing factors)
        """
        contributing_factors = []

        # Feature indices (these would be defined by your feature engineering)
        HASHRATE_IDX = 0
        EARNINGS_IDX = 1
        SHARE_RATE_IDX = 2
        REJECT_RATE_IDX = 3
        LATENCY_IDX = 4

        # Analyze which features contributed to the anomaly
        if len(features) > HASHRATE_IDX:
            z_score = abs(features[HASHRATE_IDX] - self._feature_mean[HASHRATE_IDX]) / (
                self._feature_std[HASHRATE_IDX] + 1e-8
            )
            if z_score > 3:
                contributing_factors.append(f"hashrate_deviation: {z_score:.2f}σ")

        if len(features) > EARNINGS_IDX:
            z_score = abs(features[EARNINGS_IDX] - self._feature_mean[EARNINGS_IDX]) / (
                self._feature_std[EARNINGS_IDX] + 1e-8
            )
            if z_score > 3:
                contributing_factors.append(f"earnings_deviation: {z_score:.2f}σ")

        if len(features) > REJECT_RATE_IDX:
            z_score = abs(features[REJECT_RATE_IDX] - self._feature_mean[REJECT_RATE_IDX]) / (
                self._feature_std[REJECT_RATE_IDX] + 1e-8
            )
            if z_score > 2:
                contributing_factors.append(f"high_reject_rate: {z_score:.2f}σ")

        # Classify threat type based on contributing factors
        if "hashrate_deviation" in str(contributing_factors):
            if "earnings_deviation" in str(contributing_factors):
                return ThreatType.SHARE_MANIPULATION, contributing_factors
            return ThreatType.HASHRATE_ANOMALY, contributing_factors

        if "earnings_deviation" in str(contributing_factors):
            return ThreatType.EARNINGS_ANOMALY, contributing_factors

        if "high_reject_rate" in str(contributing_factors):
            return ThreatType.NETWORK_ATTACK, contributing_factors

        if anomaly_score > 0.8:
            return ThreatType.UNKNOWN, contributing_factors

        return ThreatType.NONE, contributing_factors

    def _determine_severity(self, anomaly_score: float) -> Severity:
        """Determine severity level based on anomaly score."""
        if anomaly_score >= self.severity_thresholds[Severity.CRITICAL]:
            return Severity.CRITICAL
        elif anomaly_score >= self.severity_thresholds[Severity.HIGH]:
            return Severity.HIGH
        elif anomaly_score >= self.severity_thresholds[Severity.MEDIUM]:
            return Severity.MEDIUM
        elif anomaly_score >= self.severity_thresholds[Severity.LOW]:
            return Severity.LOW
        return Severity.LOW

    def detect(
        self,
        features: np.ndarray,
        threshold: float | None = None,
    ) -> AnomalyDetectionResult:
        """
        Detect anomalies in the input features.

        Args:
            features: Input feature vector or batch of shape (n_features,) or (n_samples, n_features)
            threshold: Custom anomaly threshold (default uses contamination-based threshold)

        Returns:
            AnomalyDetectionResult with detection details
        """
        if not self._is_fitted:
            raise ValueError("Model must be fitted before detection. Call fit() first.")

        # Ensure 2D input
        if features.ndim == 1:
            features = features.reshape(1, -1)

        # Get ensemble anomaly scores
        anomaly_scores = self._get_ensemble_score(features)

        # Use the first sample for single detection
        anomaly_score = float(anomaly_scores[0])
        feature_vector = features[0]

        # Determine if anomaly based on threshold
        threshold = threshold or (1 - self.contamination)
        is_anomaly = anomaly_score > threshold

        # Classify threat and severity
        threat_type, contributing_factors = self._classify_threat(feature_vector, anomaly_score)
        severity = self._determine_severity(anomaly_score)

        # Calculate confidence based on margin from threshold
        margin = abs(anomaly_score - threshold)
        confidence = min(1.0, 0.5 + margin)

        result = AnomalyDetectionResult(
            is_anomaly=is_anomaly,
            threat_type=threat_type if is_anomaly else ThreatType.NONE,
            severity=severity if is_anomaly else Severity.LOW,
            confidence=confidence,
            anomaly_score=anomaly_score,
            contributing_factors=contributing_factors,
        )

        # Store in history
        self._detection_history.append(result)
        if len(self._detection_history) > self._max_history:
            self._detection_history.pop(0)

        return result

    def detect_batch(
        self,
        features: np.ndarray,
        threshold: float | None = None,
    ) -> list[AnomalyDetectionResult]:
        """
        Detect anomalies in a batch of samples.

        Args:
            features: Input features of shape (n_samples, n_features)
            threshold: Custom anomaly threshold

        Returns:
            List of AnomalyDetectionResult for each sample
        """
        results = []
        for i in range(len(features)):
            result = self.detect(features[i], threshold)
            results.append(result)
        return results

    def get_statistics(self) -> dict[str, Any]:
        """Get detection statistics from history."""
        if not self._detection_history:
            return {"total_detections": 0}

        anomalies = [r for r in self._detection_history if r.is_anomaly]

        threat_counts: dict[str, int] = {}
        severity_counts: dict[str, int] = {}

        for result in anomalies:
            threat_type = result.threat_type.value
            threat_counts[threat_type] = threat_counts.get(threat_type, 0) + 1

            severity = result.severity.value
            severity_counts[severity] = severity_counts.get(severity, 0) + 1

        return {
            "total_detections": len(self._detection_history),
            "total_anomalies": len(anomalies),
            "anomaly_rate": len(anomalies) / len(self._detection_history),
            "threat_distribution": threat_counts,
            "severity_distribution": severity_counts,
            "avg_anomaly_score": np.mean([r.anomaly_score for r in self._detection_history]),
        }


class CircuitBreaker:
    """
    Circuit breaker for automatic response to detected anomalies.

    Implements the circuit breaker pattern to protect mining operations
    from cascading failures and persistent attacks.

    Args:
        failure_threshold: Number of failures before opening circuit
        recovery_timeout: Seconds before attempting recovery
        half_open_max_calls: Maximum calls in half-open state
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        half_open_max_calls: int = 3,
    ) -> None:
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls

        self._failures = 0
        self._successes_in_half_open = 0
        self._state = "closed"
        self._last_failure_time: datetime | None = None
        self._last_failure_reason: str | None = None
        self._lock = Lock()

        # Callbacks for state changes
        self._on_open_callbacks: list[callable] = []
        self._on_close_callbacks: list[callable] = []
        self._on_half_open_callbacks: list[callable] = []

    @property
    def is_open(self) -> bool:
        """Check if circuit is open (blocking calls)."""
        with self._lock:
            self._check_state_transition()
            return self._state == "open"

    @property
    def state(self) -> str:
        """Get current circuit state."""
        with self._lock:
            self._check_state_transition()
            return self._state

    def _check_state_transition(self) -> None:
        """Check and perform state transitions based on timeout."""
        if self._state == "open" and self._last_failure_time:
            elapsed = (datetime.now() - self._last_failure_time).total_seconds()
            if elapsed >= self.recovery_timeout:
                self._transition_to_half_open()

    def _transition_to_open(self, reason: str) -> None:
        """Transition to open state."""
        self._state = "open"
        self._last_failure_reason = reason
        logger.warning(f"Circuit breaker OPENED: {reason}")
        for callback in self._on_open_callbacks:
            try:
                callback(reason)
            except Exception as e:
                logger.error(f"Error in on_open callback: {e}")

    def _transition_to_half_open(self) -> None:
        """Transition to half-open state."""
        self._state = "half_open"
        self._successes_in_half_open = 0
        logger.info("Circuit breaker entering HALF-OPEN state")
        for callback in self._on_half_open_callbacks:
            try:
                callback()
            except Exception as e:
                logger.error(f"Error in on_half_open callback: {e}")

    def _transition_to_closed(self) -> None:
        """Transition to closed state."""
        self._state = "closed"
        self._failures = 0
        self._successes_in_half_open = 0
        self._last_failure_reason = None
        logger.info("Circuit breaker CLOSED")
        for callback in self._on_close_callbacks:
            try:
                callback()
            except Exception as e:
                logger.error(f"Error in on_close callback: {e}")

    def record_failure(self, reason: str = "Unknown failure") -> None:
        """
        Record a failure and potentially open the circuit.

        Args:
            reason: Description of the failure
        """
        with self._lock:
            self._failures += 1
            self._last_failure_time = datetime.now()

            if self._state == "half_open":
                self._transition_to_open(reason)
            elif self._failures >= self.failure_threshold:
                self._transition_to_open(reason)

    def record_success(self) -> None:
        """Record a successful call."""
        with self._lock:
            if self._state == "half_open":
                self._successes_in_half_open += 1
                if self._successes_in_half_open >= self.half_open_max_calls:
                    self._transition_to_closed()
            elif self._state == "closed":
                self._failures = max(0, self._failures - 1)

    def can_execute(self) -> bool:
        """
        Check if a call can be executed.

        Returns:
            True if call is allowed, False if circuit is open
        """
        with self._lock:
            self._check_state_transition()
            return self._state != "open"

    def get_state(self) -> CircuitBreakerState:
        """Get the current circuit breaker state."""
        with self._lock:
            self._check_state_transition()
            recovery_time = None
            if self._state == "open" and self._last_failure_time:
                recovery_time = self._last_failure_time + timedelta(seconds=self.recovery_timeout)

            return CircuitBreakerState(
                is_open=self._state == "open",
                failures=self._failures,
                last_failure=self._last_failure_time,
                recovery_time=recovery_time,
                reason=self._last_failure_reason,
            )

    def reset(self) -> None:
        """Force reset the circuit breaker to closed state."""
        with self._lock:
            self._transition_to_closed()

    def on_open(self, callback: callable) -> None:
        """Register callback for when circuit opens."""
        self._on_open_callbacks.append(callback)

    def on_close(self, callback: callable) -> None:
        """Register callback for when circuit closes."""
        self._on_close_callbacks.append(callback)

    def on_half_open(self, callback: callable) -> None:
        """Register callback for when circuit enters half-open state."""
        self._on_half_open_callbacks.append(callback)

    def process_detection(self, result: AnomalyDetectionResult) -> None:
        """
        Process an anomaly detection result and update circuit state.

        Args:
            result: The anomaly detection result to process
        """
        if result.is_anomaly:
            severity_weight = {
                Severity.LOW: 0.5,
                Severity.MEDIUM: 1.0,
                Severity.HIGH: 2.0,
                Severity.CRITICAL: 3.0,
            }
            weight = severity_weight.get(result.severity, 1.0)

            # Record weighted failures for severe anomalies
            for _ in range(int(weight)):
                self.record_failure(
                    f"{result.threat_type.value} - {result.severity.value} "
                    f"(score: {result.anomaly_score:.3f})"
                )
        else:
            self.record_success()
