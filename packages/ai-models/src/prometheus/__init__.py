"""
Prometheus AI - Mining Pool Prediction and Optimization Engine

A comprehensive AI system for mining pool operations including:
- Earnings prediction using LSTM with attention mechanisms
- Difficulty forecasting using NeuralProphet
- Anomaly detection with ensemble methods (Sentinel)
- Worker optimization for mining hardware
"""

from prometheus.config import PrometheusConfig, get_config

__version__ = "0.1.0"
__author__ = "Viddhana Pool Team"

__all__ = [
    "PrometheusConfig",
    "get_config",
    "__version__",
]
