"""
Prometheus AI Models Package

Contains the core prediction and detection models:
- EarningsPredictor: LSTM-based earnings prediction
- DifficultyPredictionModel: NeuralProphet-based difficulty forecasting
- SentinelAI: Ensemble anomaly detection
- WorkerOptimizer: Mining hardware optimization
"""

from prometheus.models.difficulty import DifficultyPredictionModel
from prometheus.models.earnings import EarningsPredictor, EarningsPredictionModel
from prometheus.models.optimizer import WorkerOptimizer
from prometheus.models.sentinel import CircuitBreaker, SentinelAI

__all__ = [
    "EarningsPredictor",
    "EarningsPredictionModel",
    "DifficultyPredictionModel",
    "SentinelAI",
    "CircuitBreaker",
    "WorkerOptimizer",
]
