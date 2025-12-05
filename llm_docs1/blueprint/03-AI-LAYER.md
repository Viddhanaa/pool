# VIDDHANA POOL - Prometheus AI Implementation Guide

> **Document ID:** 03-AI-LAYER  
> **Priority:** P1 - High  
> **Dependencies:** 01-INFRASTRUCTURE (Data pipeline), 06-API-SPECIFICATION

---

## Table of Contents
1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Earnings Prediction Model](#4-earnings-prediction-model)
5. [Difficulty Prediction](#5-difficulty-prediction)
6. [Sentinel AI (Anomaly Detection)](#6-sentinel-ai-anomaly-detection)
7. [Worker Optimization](#7-worker-optimization)
8. [API Integration](#8-api-integration)
9. [Model Training Pipeline](#9-model-training-pipeline)
10. [Deployment](#10-deployment)

---

## 1. Overview

**Prometheus AI** is the intelligence layer of VIDDHANA POOL, providing:
- **Earnings Prediction**: Forecast 24h/monthly earnings based on current conditions
- **Difficulty Prediction**: Predict network difficulty adjustments
- **Sentinel AI**: Real-time anomaly detection for DDoS, hashrate hijacking
- **Worker Optimization**: Suggest optimal overclock settings per hardware

---

## 2. Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| ML Framework | **PyTorch 2.x** | Deep learning models |
| Time Series | **Prophet / NeuralProphet** | Earnings & difficulty forecasting |
| Anomaly Detection | **PyOD / Isolation Forest** | Sentinel AI |
| API Framework | **FastAPI** | Model serving |
| Feature Store | **Redis + PostgreSQL** | Real-time features |
| Model Registry | **MLflow** | Model versioning |
| Orchestration | **Airflow / Prefect** | Training pipelines |
| Serving | **TorchServe / ONNX Runtime** | Production inference |

---

## 3. Project Structure

```
packages/ai-models/
├── src/
│   ├── prometheus/
│   │   ├── __init__.py
│   │   ├── config.py              # Configuration management
│   │   ├── features/
│   │   │   ├── __init__.py
│   │   │   ├── extractor.py       # Feature extraction
│   │   │   ├── store.py           # Feature store interface
│   │   │   └── pipeline.py        # Feature pipeline
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── earnings.py        # Earnings prediction
│   │   │   ├── difficulty.py      # Difficulty prediction
│   │   │   ├── sentinel.py        # Anomaly detection
│   │   │   └── optimizer.py       # Worker optimization
│   │   ├── training/
│   │   │   ├── __init__.py
│   │   │   ├── trainer.py         # Model training
│   │   │   ├── dataset.py         # Data loading
│   │   │   └── evaluation.py      # Model evaluation
│   │   ├── serving/
│   │   │   ├── __init__.py
│   │   │   ├── api.py             # FastAPI endpoints
│   │   │   ├── inference.py       # Inference engine
│   │   │   └── cache.py           # Prediction caching
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── metrics.py         # Custom metrics
│   │       └── preprocessing.py   # Data preprocessing
│   └── scripts/
│       ├── train_earnings.py
│       ├── train_difficulty.py
│       ├── train_sentinel.py
│       └── evaluate.py
├── notebooks/
│   ├── 01_data_exploration.ipynb
│   ├── 02_feature_engineering.ipynb
│   ├── 03_model_experiments.ipynb
│   └── 04_evaluation.ipynb
├── tests/
│   ├── test_features.py
│   ├── test_models.py
│   └── test_api.py
├── configs/
│   ├── earnings_config.yaml
│   ├── difficulty_config.yaml
│   └── sentinel_config.yaml
├── Dockerfile
├── requirements.txt
└── pyproject.toml
```

---

## 4. Earnings Prediction Model

### 4.1 Model Architecture

Using LSTM (Long Short-Term Memory) for time-series prediction with attention mechanism.

**File: `src/prometheus/models/earnings.py`**

```python
import torch
import torch.nn as nn
from typing import Tuple, Optional

class AttentionLayer(nn.Module):
    """Attention mechanism for sequence weighting."""
    
    def __init__(self, hidden_size: int):
        super().__init__()
        self.attention = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.Tanh(),
            nn.Linear(hidden_size // 2, 1),
        )
    
    def forward(self, lstm_output: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        # lstm_output: (batch, seq_len, hidden_size)
        attention_weights = torch.softmax(self.attention(lstm_output), dim=1)
        context = torch.sum(attention_weights * lstm_output, dim=1)
        return context, attention_weights.squeeze(-1)


class EarningsPredictionModel(nn.Module):
    """
    LSTM-based earnings prediction model.
    
    Predicts:
    - Estimated earnings for next 24 hours
    - Estimated earnings for next 30 days
    - Confidence interval (lower, upper bounds)
    """
    
    def __init__(
        self,
        input_size: int = 12,      # Number of input features
        hidden_size: int = 128,
        num_layers: int = 2,
        dropout: float = 0.2,
        output_size: int = 4,      # [24h_earnings, 30d_earnings, lower_bound, upper_bound]
    ):
        super().__init__()
        
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        # LSTM encoder
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=True,
        )
        
        # Attention layer
        self.attention = AttentionLayer(hidden_size * 2)  # *2 for bidirectional
        
        # Prediction head
        self.fc = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Linear(hidden_size // 2, output_size),
        )
        
        # Separate head for confidence
        self.confidence_head = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size // 2),
            nn.ReLU(),
            nn.Linear(hidden_size // 2, 1),
            nn.Sigmoid(),  # Output confidence 0-1
        )
    
    def forward(
        self,
        x: torch.Tensor,
        return_attention: bool = False,
    ) -> Tuple[torch.Tensor, Optional[torch.Tensor], torch.Tensor]:
        """
        Args:
            x: Input tensor of shape (batch, seq_len, input_size)
            return_attention: Whether to return attention weights
        
        Returns:
            predictions: (batch, output_size)
            attention_weights: (batch, seq_len) if return_attention else None
            confidence: (batch, 1)
        """
        # LSTM forward pass
        lstm_out, _ = self.lstm(x)  # (batch, seq_len, hidden_size * 2)
        
        # Apply attention
        context, attention_weights = self.attention(lstm_out)
        
        # Generate predictions
        predictions = self.fc(context)
        
        # Generate confidence score
        confidence = self.confidence_head(context)
        
        if return_attention:
            return predictions, attention_weights, confidence
        return predictions, None, confidence


class EarningsPredictor:
    """High-level API for earnings prediction."""
    
    def __init__(
        self,
        model_path: str,
        device: str = "cuda" if torch.cuda.is_available() else "cpu",
    ):
        self.device = device
        self.model = EarningsPredictionModel()
        self.model.load_state_dict(torch.load(model_path, map_location=device))
        self.model.to(device)
        self.model.eval()
        
        # Feature scaler (loaded from training)
        self.scaler = None  # Load from checkpoint
    
    def predict(
        self,
        hashrate_history: list,
        difficulty_history: list,
        price_history: list,
        block_reward: float,
        pool_fee: float,
    ) -> dict:
        """
        Generate earnings prediction.
        
        Args:
            hashrate_history: List of hashrate values (last 24h, hourly)
            difficulty_history: List of network difficulty values
            price_history: List of token prices
            block_reward: Current block reward
            pool_fee: Pool fee percentage
        
        Returns:
            dict with predictions and confidence
        """
        # Prepare features
        features = self._prepare_features(
            hashrate_history,
            difficulty_history,
            price_history,
            block_reward,
            pool_fee,
        )
        
        # Convert to tensor
        x = torch.tensor(features, dtype=torch.float32).unsqueeze(0).to(self.device)
        
        # Run inference
        with torch.no_grad():
            predictions, attention, confidence = self.model(x, return_attention=True)
        
        predictions = predictions.cpu().numpy()[0]
        confidence = confidence.cpu().numpy()[0][0]
        
        return {
            "estimated_24h": float(predictions[0]),
            "estimated_30d": float(predictions[1]),
            "lower_bound_24h": float(predictions[2]),
            "upper_bound_24h": float(predictions[3]),
            "confidence": float(confidence),
            "attention_weights": attention.cpu().numpy()[0].tolist() if attention is not None else None,
        }
    
    def _prepare_features(
        self,
        hashrate_history: list,
        difficulty_history: list,
        price_history: list,
        block_reward: float,
        pool_fee: float,
    ) -> list:
        """Prepare feature matrix for model input."""
        features = []
        
        for i in range(len(hashrate_history)):
            feature_vector = [
                hashrate_history[i],
                difficulty_history[i] if i < len(difficulty_history) else difficulty_history[-1],
                price_history[i] if i < len(price_history) else price_history[-1],
                block_reward,
                pool_fee,
                # Derived features
                hashrate_history[i] / (difficulty_history[i] + 1e-10),  # Hash/diff ratio
                i / len(hashrate_history),  # Time position
                # Rolling statistics
                sum(hashrate_history[max(0, i-6):i+1]) / min(i+1, 7),  # 6h rolling avg
            ]
            features.append(feature_vector)
        
        return features
```

### 4.2 Feature Engineering

**File: `src/prometheus/features/extractor.py`**

```python
import numpy as np
import pandas as pd
from typing import Dict, List, Any
from datetime import datetime, timedelta

class EarningsFeatureExtractor:
    """Extract features for earnings prediction."""
    
    FEATURE_COLUMNS = [
        "hashrate",
        "hashrate_1h_avg",
        "hashrate_6h_avg",
        "hashrate_24h_avg",
        "hashrate_trend",
        "difficulty",
        "difficulty_change_pct",
        "token_price",
        "price_volatility",
        "block_reward",
        "pool_fee",
        "pool_hashrate_share",
        "estimated_blocks_24h",
        "hour_of_day",
        "day_of_week",
        "is_weekend",
    ]
    
    def __init__(self, redis_client, db_client):
        self.redis = redis_client
        self.db = db_client
    
    async def extract_features(
        self,
        user_id: str,
        lookback_hours: int = 24,
    ) -> Dict[str, Any]:
        """Extract features for a user."""
        
        # Get hashrate history
        hashrate_data = await self._get_hashrate_history(user_id, lookback_hours)
        
        # Get network data
        network_data = await self._get_network_data(lookback_hours)
        
        # Get price data
        price_data = await self._get_price_history(lookback_hours)
        
        # Get pool stats
        pool_stats = await self._get_pool_stats()
        
        # Build feature matrix
        features = self._build_feature_matrix(
            hashrate_data,
            network_data,
            price_data,
            pool_stats,
        )
        
        return {
            "features": features,
            "metadata": {
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat(),
                "lookback_hours": lookback_hours,
            }
        }
    
    def _build_feature_matrix(
        self,
        hashrate_data: pd.DataFrame,
        network_data: pd.DataFrame,
        price_data: pd.DataFrame,
        pool_stats: Dict,
    ) -> np.ndarray:
        """Build feature matrix from raw data."""
        
        # Merge dataframes on timestamp
        df = hashrate_data.merge(network_data, on="timestamp", how="left")
        df = df.merge(price_data, on="timestamp", how="left")
        
        # Fill missing values
        df = df.ffill().bfill()
        
        # Calculate derived features
        df["hashrate_1h_avg"] = df["hashrate"].rolling(window=1, min_periods=1).mean()
        df["hashrate_6h_avg"] = df["hashrate"].rolling(window=6, min_periods=1).mean()
        df["hashrate_24h_avg"] = df["hashrate"].rolling(window=24, min_periods=1).mean()
        
        # Hashrate trend (slope of linear regression)
        df["hashrate_trend"] = self._calculate_trend(df["hashrate"].values)
        
        # Difficulty change percentage
        df["difficulty_change_pct"] = df["difficulty"].pct_change().fillna(0)
        
        # Price volatility (rolling std)
        df["price_volatility"] = df["token_price"].rolling(window=6, min_periods=1).std()
        
        # Pool share of network hashrate
        df["pool_hashrate_share"] = pool_stats["pool_hashrate"] / (df["network_hashrate"] + 1e-10)
        
        # Estimated blocks per 24h
        block_time = pool_stats.get("avg_block_time", 600)  # Default 10 min
        df["estimated_blocks_24h"] = (86400 / block_time) * df["pool_hashrate_share"]
        
        # Time features
        df["hour_of_day"] = pd.to_datetime(df["timestamp"]).dt.hour / 24
        df["day_of_week"] = pd.to_datetime(df["timestamp"]).dt.dayofweek / 7
        df["is_weekend"] = (pd.to_datetime(df["timestamp"]).dt.dayofweek >= 5).astype(int)
        
        # Add constants
        df["block_reward"] = pool_stats["block_reward"]
        df["pool_fee"] = pool_stats["pool_fee"]
        
        # Select and order columns
        features = df[self.FEATURE_COLUMNS].values
        
        return features
    
    def _calculate_trend(self, values: np.ndarray, window: int = 6) -> np.ndarray:
        """Calculate trend using linear regression slope."""
        trends = np.zeros(len(values))
        
        for i in range(len(values)):
            start = max(0, i - window + 1)
            window_values = values[start:i+1]
            
            if len(window_values) > 1:
                x = np.arange(len(window_values))
                slope, _ = np.polyfit(x, window_values, 1)
                trends[i] = slope
        
        return trends
```

---

## 5. Difficulty Prediction

### 5.1 Model Implementation

**File: `src/prometheus/models/difficulty.py`**

```python
import torch
import torch.nn as nn
from neuralprophet import NeuralProphet
import pandas as pd
from typing import Dict, Any

class DifficultyPredictionModel:
    """
    Hybrid model for network difficulty prediction.
    Uses NeuralProphet for trend/seasonality + custom network for short-term.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        
        # NeuralProphet for trend prediction
        self.prophet_model = NeuralProphet(
            growth="linear",
            changepoints_range=0.9,
            n_changepoints=20,
            seasonality_mode="multiplicative",
            yearly_seasonality=False,
            weekly_seasonality=True,
            daily_seasonality=True,
            n_lags=24,  # 24 hours of autoregression
            ar_layers=[64, 32],
            learning_rate=0.01,
            epochs=100,
            batch_size=64,
        )
        
        self.is_fitted = False
    
    def train(self, difficulty_history: pd.DataFrame) -> Dict[str, float]:
        """
        Train the difficulty prediction model.
        
        Args:
            difficulty_history: DataFrame with columns ['ds', 'y']
                               ds: timestamp, y: difficulty value
        
        Returns:
            Training metrics
        """
        # Add regressors if available
        if "hashrate" in difficulty_history.columns:
            self.prophet_model = self.prophet_model.add_lagged_regressor(
                "hashrate", n_lags=12
            )
        
        # Fit model
        metrics = self.prophet_model.fit(
            difficulty_history,
            freq="H",  # Hourly frequency
            validation_fraction=0.2,
        )
        
        self.is_fitted = True
        
        return {
            "mae": float(metrics["MAE"].iloc[-1]),
            "rmse": float(metrics["RMSE"].iloc[-1]),
        }
    
    def predict(
        self,
        future_periods: int = 24,
        include_history: bool = False,
    ) -> pd.DataFrame:
        """
        Predict future difficulty values.
        
        Args:
            future_periods: Number of hours to predict
            include_history: Include historical fitted values
        
        Returns:
            DataFrame with predictions
        """
        if not self.is_fitted:
            raise ValueError("Model not fitted. Call train() first.")
        
        # Create future dataframe
        future = self.prophet_model.make_future_dataframe(
            self.prophet_model.data_params["df"],
            periods=future_periods,
        )
        
        # Generate predictions
        forecast = self.prophet_model.predict(future)
        
        if not include_history:
            forecast = forecast.tail(future_periods)
        
        return forecast[["ds", "yhat1", "yhat1_lower", "yhat1_upper"]]
    
    def get_next_adjustment(self) -> Dict[str, Any]:
        """
        Predict the next difficulty adjustment.
        
        Returns:
            Dict with adjustment prediction and confidence
        """
        # Predict next retarget period (typically 2016 blocks for BTC-like)
        predictions = self.predict(future_periods=48)
        
        current_diff = predictions.iloc[0]["yhat1"]
        predicted_diff = predictions.iloc[-1]["yhat1"]
        
        change_pct = ((predicted_diff - current_diff) / current_diff) * 100
        
        return {
            "current_difficulty": float(current_diff),
            "predicted_difficulty": float(predicted_diff),
            "change_percentage": float(change_pct),
            "direction": "up" if change_pct > 0 else "down",
            "confidence": self._calculate_confidence(predictions),
            "eta_hours": 48,
        }
    
    def _calculate_confidence(self, predictions: pd.DataFrame) -> float:
        """Calculate confidence based on prediction intervals."""
        avg_range = (predictions["yhat1_upper"] - predictions["yhat1_lower"]).mean()
        avg_value = predictions["yhat1"].mean()
        
        # Narrower range = higher confidence
        relative_range = avg_range / avg_value
        confidence = max(0, 1 - relative_range)
        
        return float(confidence)
```

---

## 6. Sentinel AI (Anomaly Detection)

### 6.1 Model Implementation

**File: `src/prometheus/models/sentinel.py`**

```python
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from pyod.models.iforest import IForest
from pyod.models.lof import LOF
from pyod.models.knn import KNN
from typing import Dict, List, Tuple, Any
import redis
from datetime import datetime, timedelta

class SentinelAI:
    """
    Real-time anomaly detection for mining pool security.
    
    Detects:
    - DDoS attacks (sudden connection spikes)
    - Hashrate hijacking (unusual patterns)
    - Share manipulation (invalid share floods)
    - Suspicious payout patterns
    """
    
    def __init__(
        self,
        redis_client: redis.Redis,
        contamination: float = 0.01,  # Expected anomaly rate
    ):
        self.redis = redis_client
        self.contamination = contamination
        
        # Ensemble of anomaly detectors
        self.detectors = {
            "isolation_forest": IForest(
                n_estimators=100,
                contamination=contamination,
                random_state=42,
            ),
            "local_outlier_factor": LOF(
                n_neighbors=20,
                contamination=contamination,
            ),
            "knn": KNN(
                n_neighbors=10,
                contamination=contamination,
            ),
        }
        
        self.scaler = StandardScaler()
        self.is_fitted = False
        
        # Thresholds for circuit breaker
        self.thresholds = {
            "connection_spike": 5.0,      # 5x normal rate
            "hashrate_drop": 0.3,         # 70% drop
            "invalid_share_rate": 0.1,    # 10% invalid
            "payout_anomaly_score": 0.8,  # 80% confidence
        }
    
    def fit(self, historical_data: np.ndarray) -> Dict[str, float]:
        """
        Fit anomaly detectors on historical normal data.
        
        Args:
            historical_data: Shape (n_samples, n_features)
                Features: [connections, hashrate, valid_shares, invalid_shares,
                          payout_amount, time_since_last_payout, ...]
        
        Returns:
            Training metrics
        """
        # Scale features
        scaled_data = self.scaler.fit_transform(historical_data)
        
        # Fit each detector
        for name, detector in self.detectors.items():
            detector.fit(scaled_data)
        
        self.is_fitted = True
        
        return {"status": "fitted", "samples": len(historical_data)}
    
    def detect(
        self,
        current_metrics: Dict[str, float],
    ) -> Dict[str, Any]:
        """
        Detect anomalies in current metrics.
        
        Args:
            current_metrics: Dict with current metric values
        
        Returns:
            Anomaly detection results
        """
        if not self.is_fitted:
            raise ValueError("Model not fitted. Call fit() first.")
        
        # Extract features
        features = self._extract_features(current_metrics)
        scaled_features = self.scaler.transform([features])
        
        # Get predictions from each detector
        predictions = {}
        scores = []
        
        for name, detector in self.detectors.items():
            pred = detector.predict(scaled_features)[0]
            score = detector.decision_function(scaled_features)[0]
            predictions[name] = {"is_anomaly": bool(pred), "score": float(score)}
            scores.append(score)
        
        # Ensemble decision (majority voting + score aggregation)
        anomaly_votes = sum(1 for p in predictions.values() if p["is_anomaly"])
        is_anomaly = anomaly_votes >= len(self.detectors) // 2 + 1
        ensemble_score = np.mean(scores)
        
        # Identify specific threat type
        threat_type = self._identify_threat_type(current_metrics) if is_anomaly else None
        
        # Determine severity
        severity = self._calculate_severity(ensemble_score, threat_type)
        
        return {
            "is_anomaly": is_anomaly,
            "ensemble_score": float(ensemble_score),
            "individual_predictions": predictions,
            "threat_type": threat_type,
            "severity": severity,
            "timestamp": datetime.utcnow().isoformat(),
            "recommended_action": self._get_recommended_action(severity, threat_type),
        }
    
    def _extract_features(self, metrics: Dict[str, float]) -> List[float]:
        """Extract feature vector from metrics dict."""
        return [
            metrics.get("connections_per_second", 0),
            metrics.get("hashrate", 0),
            metrics.get("valid_shares_rate", 0),
            metrics.get("invalid_shares_rate", 0),
            metrics.get("stale_shares_rate", 0),
            metrics.get("avg_share_difficulty", 0),
            metrics.get("unique_workers", 0),
            metrics.get("payout_amount", 0),
            metrics.get("time_since_last_payout", 0),
            metrics.get("connection_duration_avg", 0),
            metrics.get("hashrate_variance", 0),
            metrics.get("geographic_entropy", 0),  # Distribution of IPs
        ]
    
    def _identify_threat_type(self, metrics: Dict[str, float]) -> str:
        """Identify specific type of threat."""
        
        # Check for DDoS
        if metrics.get("connections_per_second", 0) > self.thresholds["connection_spike"]:
            return "ddos_attack"
        
        # Check for hashrate hijacking
        hashrate_change = metrics.get("hashrate_change_pct", 0)
        if hashrate_change < -self.thresholds["hashrate_drop"]:
            return "hashrate_hijacking"
        
        # Check for share manipulation
        invalid_rate = metrics.get("invalid_shares_rate", 0)
        if invalid_rate > self.thresholds["invalid_share_rate"]:
            return "share_manipulation"
        
        # Check for suspicious payouts
        if metrics.get("payout_anomaly", False):
            return "suspicious_payout"
        
        return "unknown"
    
    def _calculate_severity(self, score: float, threat_type: str) -> str:
        """Calculate threat severity level."""
        if score > 0.9:
            return "critical"
        elif score > 0.7:
            return "high"
        elif score > 0.5:
            return "medium"
        else:
            return "low"
    
    def _get_recommended_action(self, severity: str, threat_type: str) -> Dict[str, Any]:
        """Get recommended action based on threat."""
        actions = {
            "critical": {
                "action": "circuit_breaker",
                "description": "Immediately freeze affected operations",
                "auto_execute": True,
            },
            "high": {
                "action": "rate_limit",
                "description": "Apply aggressive rate limiting",
                "auto_execute": True,
            },
            "medium": {
                "action": "alert",
                "description": "Alert security team for investigation",
                "auto_execute": False,
            },
            "low": {
                "action": "log",
                "description": "Log for later analysis",
                "auto_execute": False,
            },
        }
        
        return actions.get(severity, actions["low"])


class CircuitBreaker:
    """
    Circuit breaker for automatic threat response.
    """
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.prefix = "circuit_breaker:"
    
    async def trigger(
        self,
        threat_type: str,
        affected_entities: List[str],
        duration_seconds: int = 300,
    ) -> Dict[str, Any]:
        """
        Trigger circuit breaker for specific threat.
        
        Args:
            threat_type: Type of threat detected
            affected_entities: List of affected user/worker IDs
            duration_seconds: How long to keep breaker active
        
        Returns:
            Circuit breaker status
        """
        breaker_id = f"{threat_type}:{datetime.utcnow().timestamp()}"
        
        # Store breaker state
        breaker_data = {
            "id": breaker_id,
            "threat_type": threat_type,
            "affected_entities": affected_entities,
            "triggered_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(seconds=duration_seconds)).isoformat(),
        }
        
        # Set in Redis with expiry
        await self.redis.setex(
            f"{self.prefix}{breaker_id}",
            duration_seconds,
            str(breaker_data),
        )
        
        # Add affected entities to blocked set
        for entity in affected_entities:
            await self.redis.setex(
                f"{self.prefix}blocked:{entity}",
                duration_seconds,
                threat_type,
            )
        
        return {
            "status": "triggered",
            "breaker_id": breaker_id,
            "affected_count": len(affected_entities),
            "expires_in_seconds": duration_seconds,
        }
    
    async def is_blocked(self, entity_id: str) -> bool:
        """Check if entity is currently blocked."""
        return await self.redis.exists(f"{self.prefix}blocked:{entity_id}")
    
    async def release(self, breaker_id: str) -> Dict[str, Any]:
        """Manually release a circuit breaker."""
        key = f"{self.prefix}{breaker_id}"
        
        if await self.redis.exists(key):
            await self.redis.delete(key)
            return {"status": "released", "breaker_id": breaker_id}
        
        return {"status": "not_found", "breaker_id": breaker_id}
```

---

## 7. Worker Optimization

### 7.1 Model Implementation

**File: `src/prometheus/models/optimizer.py`**

```python
import numpy as np
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import torch
import torch.nn as nn

@dataclass
class HardwareProfile:
    """Hardware specifications for a mining rig."""
    gpu_model: str
    gpu_count: int
    memory_gb: float
    power_limit_w: float
    core_clock_mhz: int
    memory_clock_mhz: int
    current_hashrate: float
    current_power_w: float
    current_temp_c: float
    efficiency: float  # Hash/Watt

@dataclass
class OptimizationResult:
    """Optimization suggestions for a worker."""
    worker_id: str
    current_efficiency: float
    optimized_efficiency: float
    improvement_pct: float
    suggestions: List[Dict[str, Any]]
    risk_level: str
    estimated_hashrate_gain: float
    estimated_power_savings_w: float


class WorkerOptimizer:
    """
    AI-powered worker optimization using historical efficiency data.
    
    Suggests optimal overclock settings based on:
    - Hardware model
    - Historical performance data
    - Power efficiency targets
    - Temperature constraints
    """
    
    # Known GPU profiles with baseline settings
    GPU_PROFILES = {
        "RTX 3080": {
            "base_hashrate": 95.0,  # MH/s for ETH-like algo
            "base_power": 220,
            "safe_core_offset": (-200, 200),
            "safe_mem_offset": (0, 1200),
            "safe_power_limit": (60, 100),  # percentage
            "max_temp": 85,
        },
        "RTX 3090": {
            "base_hashrate": 120.0,
            "base_power": 300,
            "safe_core_offset": (-200, 200),
            "safe_mem_offset": (0, 1500),
            "safe_power_limit": (60, 100),
            "max_temp": 83,
        },
        "RTX 4090": {
            "base_hashrate": 130.0,
            "base_power": 350,
            "safe_core_offset": (-200, 200),
            "safe_mem_offset": (0, 1500),
            "safe_power_limit": (60, 100),
            "max_temp": 80,
        },
        # Add more GPU profiles...
    }
    
    def __init__(self, efficiency_model_path: Optional[str] = None):
        self.efficiency_model = None
        
        if efficiency_model_path:
            self.efficiency_model = self._load_efficiency_model(efficiency_model_path)
    
    def optimize(
        self,
        worker_id: str,
        hardware: HardwareProfile,
        historical_data: Optional[List[Dict]] = None,
        target: str = "efficiency",  # efficiency, hashrate, power
    ) -> OptimizationResult:
        """
        Generate optimization suggestions for a worker.
        
        Args:
            worker_id: Worker identifier
            hardware: Current hardware specifications
            historical_data: Historical performance data
            target: Optimization target
        
        Returns:
            OptimizationResult with suggestions
        """
        # Get GPU profile
        profile = self.GPU_PROFILES.get(hardware.gpu_model)
        
        if not profile:
            return self._create_generic_result(worker_id, hardware)
        
        # Analyze current state
        current_efficiency = hardware.current_hashrate / hardware.current_power_w
        baseline_efficiency = profile["base_hashrate"] / profile["base_power"]
        
        suggestions = []
        
        # Power limit optimization
        power_suggestion = self._optimize_power_limit(hardware, profile)
        if power_suggestion:
            suggestions.append(power_suggestion)
        
        # Memory clock optimization
        mem_suggestion = self._optimize_memory_clock(hardware, profile, historical_data)
        if mem_suggestion:
            suggestions.append(mem_suggestion)
        
        # Core clock optimization
        core_suggestion = self._optimize_core_clock(hardware, profile)
        if core_suggestion:
            suggestions.append(core_suggestion)
        
        # Calculate expected improvements
        expected_efficiency = self._calculate_expected_efficiency(
            hardware, suggestions, profile
        )
        
        improvement_pct = ((expected_efficiency - current_efficiency) / current_efficiency) * 100
        
        # Determine risk level
        risk_level = self._assess_risk(suggestions, hardware, profile)
        
        return OptimizationResult(
            worker_id=worker_id,
            current_efficiency=current_efficiency,
            optimized_efficiency=expected_efficiency,
            improvement_pct=improvement_pct,
            suggestions=suggestions,
            risk_level=risk_level,
            estimated_hashrate_gain=self._estimate_hashrate_gain(suggestions, hardware),
            estimated_power_savings_w=self._estimate_power_savings(suggestions, hardware),
        )
    
    def _optimize_power_limit(
        self,
        hardware: HardwareProfile,
        profile: Dict,
    ) -> Optional[Dict]:
        """Optimize power limit setting."""
        current_pct = (hardware.power_limit_w / profile["base_power"]) * 100
        
        # Most efficient is usually 70-80% power limit
        optimal_pct = 75
        
        if abs(current_pct - optimal_pct) > 5:
            return {
                "type": "power_limit",
                "current_value": f"{current_pct:.0f}%",
                "suggested_value": f"{optimal_pct}%",
                "expected_impact": "Improved efficiency with minimal hashrate loss",
                "priority": "high",
            }
        
        return None
    
    def _optimize_memory_clock(
        self,
        hardware: HardwareProfile,
        profile: Dict,
        historical_data: Optional[List[Dict]],
    ) -> Optional[Dict]:
        """Optimize memory clock offset."""
        safe_range = profile["safe_mem_offset"]
        
        # If we have historical data, use it to find optimal
        if historical_data and len(historical_data) > 10:
            optimal_offset = self._find_optimal_from_history(
                historical_data, "memory_clock_offset"
            )
        else:
            # Conservative suggestion based on GPU model
            optimal_offset = int(safe_range[1] * 0.7)  # 70% of max safe
        
        current_offset = hardware.memory_clock_mhz - 8000  # Assume base ~8000MHz
        
        if abs(current_offset - optimal_offset) > 100:
            return {
                "type": "memory_clock",
                "current_value": f"+{current_offset}MHz",
                "suggested_value": f"+{optimal_offset}MHz",
                "expected_impact": "Memory-intensive algorithms benefit most",
                "priority": "medium",
            }
        
        return None
    
    def _optimize_core_clock(
        self,
        hardware: HardwareProfile,
        profile: Dict,
    ) -> Optional[Dict]:
        """Optimize core clock offset."""
        # For most mining, lower core = more efficient
        suggested_offset = -100
        
        return {
            "type": "core_clock",
            "current_value": f"{hardware.core_clock_mhz}MHz",
            "suggested_value": f"-100MHz offset",
            "expected_impact": "Reduced power consumption",
            "priority": "low",
        }
    
    def _assess_risk(
        self,
        suggestions: List[Dict],
        hardware: HardwareProfile,
        profile: Dict,
    ) -> str:
        """Assess risk level of suggested changes."""
        risk_score = 0
        
        for suggestion in suggestions:
            if suggestion["type"] == "memory_clock":
                # Higher memory OC = higher risk
                offset = int(suggestion["suggested_value"].replace("+", "").replace("MHz", ""))
                max_safe = profile["safe_mem_offset"][1]
                risk_score += (offset / max_safe) * 2
        
        # Temperature consideration
        if hardware.current_temp_c > profile["max_temp"] - 10:
            risk_score += 1
        
        if risk_score > 2:
            return "high"
        elif risk_score > 1:
            return "medium"
        else:
            return "low"
    
    def _calculate_expected_efficiency(
        self,
        hardware: HardwareProfile,
        suggestions: List[Dict],
        profile: Dict,
    ) -> float:
        """Calculate expected efficiency after applying suggestions."""
        # Base improvement estimate
        improvement_factor = 1.0
        
        for suggestion in suggestions:
            if suggestion["type"] == "power_limit":
                improvement_factor *= 1.05
            elif suggestion["type"] == "memory_clock":
                improvement_factor *= 1.03
            elif suggestion["type"] == "core_clock":
                improvement_factor *= 1.02
        
        return hardware.efficiency * improvement_factor
    
    def _estimate_hashrate_gain(
        self,
        suggestions: List[Dict],
        hardware: HardwareProfile,
    ) -> float:
        """Estimate hashrate gain from suggestions."""
        gain = 0.0
        
        for suggestion in suggestions:
            if suggestion["type"] == "memory_clock":
                # ~0.5 MH/s per 100MHz memory for ETH-like
                offset_diff = 200  # Simplified
                gain += (offset_diff / 100) * 0.5
        
        return gain
    
    def _estimate_power_savings(
        self,
        suggestions: List[Dict],
        hardware: HardwareProfile,
    ) -> float:
        """Estimate power savings from suggestions."""
        savings = 0.0
        
        for suggestion in suggestions:
            if suggestion["type"] == "power_limit":
                # Simplified calculation
                savings += hardware.current_power_w * 0.1
            elif suggestion["type"] == "core_clock":
                savings += 10  # ~10W for core underclock
        
        return savings
```

---

## 8. API Integration

### 8.1 FastAPI Server

**File: `src/prometheus/serving/api.py`**

```python
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import redis.asyncio as redis
from datetime import datetime

from prometheus.models.earnings import EarningsPredictor
from prometheus.models.difficulty import DifficultyPredictionModel
from prometheus.models.sentinel import SentinelAI, CircuitBreaker
from prometheus.models.optimizer import WorkerOptimizer, HardwareProfile
from prometheus.features.extractor import EarningsFeatureExtractor

app = FastAPI(
    title="Prometheus AI API",
    description="AI services for VIDDHANA Pool",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize models (in production, use dependency injection)
earnings_predictor = None
difficulty_model = None
sentinel_ai = None
worker_optimizer = None
redis_client = None


@app.on_event("startup")
async def startup():
    global earnings_predictor, difficulty_model, sentinel_ai, worker_optimizer, redis_client
    
    redis_client = await redis.from_url("redis://localhost:6379")
    
    earnings_predictor = EarningsPredictor("models/earnings_v1.pt")
    difficulty_model = DifficultyPredictionModel({})
    sentinel_ai = SentinelAI(redis_client)
    worker_optimizer = WorkerOptimizer("models/efficiency_v1.pt")


# --- Request/Response Models ---

class EarningsPredictionRequest(BaseModel):
    user_id: str
    hashrate_history: List[float]  # Last 24 hourly values
    
class EarningsPredictionResponse(BaseModel):
    estimated_24h: float
    estimated_30d: float
    lower_bound_24h: float
    upper_bound_24h: float
    confidence: float
    generated_at: str

class DifficultyPredictionResponse(BaseModel):
    current_difficulty: float
    predicted_difficulty: float
    change_percentage: float
    direction: str
    confidence: float
    eta_hours: int

class AnomalyDetectionRequest(BaseModel):
    connections_per_second: float
    hashrate: float
    valid_shares_rate: float
    invalid_shares_rate: float
    stale_shares_rate: float
    avg_share_difficulty: float
    unique_workers: int
    payout_amount: float = 0
    time_since_last_payout: float = 0

class AnomalyDetectionResponse(BaseModel):
    is_anomaly: bool
    ensemble_score: float
    threat_type: Optional[str]
    severity: str
    recommended_action: Dict[str, Any]

class OptimizationRequest(BaseModel):
    worker_id: str
    gpu_model: str
    gpu_count: int
    memory_gb: float
    power_limit_w: float
    core_clock_mhz: int
    memory_clock_mhz: int
    current_hashrate: float
    current_power_w: float
    current_temp_c: float

class OptimizationResponse(BaseModel):
    worker_id: str
    current_efficiency: float
    optimized_efficiency: float
    improvement_pct: float
    suggestions: List[Dict[str, Any]]
    risk_level: str
    estimated_hashrate_gain: float
    estimated_power_savings_w: float


# --- Endpoints ---

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/v1/predict/earnings", response_model=EarningsPredictionResponse)
async def predict_earnings(request: EarningsPredictionRequest):
    """Predict earnings for a user based on hashrate history."""
    try:
        # Get additional data (simplified - in production, fetch from DB)
        difficulty_history = [1e15] * 24  # Placeholder
        price_history = [50000.0] * 24  # Placeholder
        
        result = earnings_predictor.predict(
            hashrate_history=request.hashrate_history,
            difficulty_history=difficulty_history,
            price_history=price_history,
            block_reward=6.25,
            pool_fee=0.01,
        )
        
        return EarningsPredictionResponse(
            estimated_24h=result["estimated_24h"],
            estimated_30d=result["estimated_30d"],
            lower_bound_24h=result["lower_bound_24h"],
            upper_bound_24h=result["upper_bound_24h"],
            confidence=result["confidence"],
            generated_at=datetime.utcnow().isoformat(),
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/predict/difficulty", response_model=DifficultyPredictionResponse)
async def predict_difficulty():
    """Predict next network difficulty adjustment."""
    try:
        result = difficulty_model.get_next_adjustment()
        return DifficultyPredictionResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/sentinel/detect", response_model=AnomalyDetectionResponse)
async def detect_anomaly(
    request: AnomalyDetectionRequest,
    background_tasks: BackgroundTasks,
):
    """Detect anomalies in pool metrics."""
    try:
        result = sentinel_ai.detect(request.dict())
        
        # If critical anomaly, trigger circuit breaker in background
        if result["severity"] == "critical":
            background_tasks.add_task(
                trigger_circuit_breaker,
                result["threat_type"],
            )
        
        return AnomalyDetectionResponse(
            is_anomaly=result["is_anomaly"],
            ensemble_score=result["ensemble_score"],
            threat_type=result["threat_type"],
            severity=result["severity"],
            recommended_action=result["recommended_action"],
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/optimize/worker", response_model=OptimizationResponse)
async def optimize_worker(request: OptimizationRequest):
    """Get optimization suggestions for a worker."""
    try:
        hardware = HardwareProfile(
            gpu_model=request.gpu_model,
            gpu_count=request.gpu_count,
            memory_gb=request.memory_gb,
            power_limit_w=request.power_limit_w,
            core_clock_mhz=request.core_clock_mhz,
            memory_clock_mhz=request.memory_clock_mhz,
            current_hashrate=request.current_hashrate,
            current_power_w=request.current_power_w,
            current_temp_c=request.current_temp_c,
            efficiency=request.current_hashrate / request.current_power_w,
        )
        
        result = worker_optimizer.optimize(
            worker_id=request.worker_id,
            hardware=hardware,
        )
        
        return OptimizationResponse(
            worker_id=result.worker_id,
            current_efficiency=result.current_efficiency,
            optimized_efficiency=result.optimized_efficiency,
            improvement_pct=result.improvement_pct,
            suggestions=result.suggestions,
            risk_level=result.risk_level,
            estimated_hashrate_gain=result.estimated_hashrate_gain,
            estimated_power_savings_w=result.estimated_power_savings_w,
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/optimize/batch")
async def optimize_workers_batch(worker_ids: List[str]):
    """Batch optimization for multiple workers."""
    # Implementation for batch optimization
    pass


async def trigger_circuit_breaker(threat_type: str):
    """Background task to trigger circuit breaker."""
    breaker = CircuitBreaker(redis_client)
    await breaker.trigger(threat_type, [], duration_seconds=300)
```

---

## 9. Model Training Pipeline

### 9.1 Training Script

**File: `src/scripts/train_earnings.py`**

```python
import argparse
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
import mlflow
import mlflow.pytorch
from pathlib import Path
import yaml

from prometheus.models.earnings import EarningsPredictionModel
from prometheus.training.dataset import EarningsDataset
from prometheus.training.trainer import Trainer


def main(config_path: str):
    # Load config
    with open(config_path) as f:
        config = yaml.safe_load(f)
    
    # Setup MLflow
    mlflow.set_tracking_uri(config["mlflow"]["tracking_uri"])
    mlflow.set_experiment(config["mlflow"]["experiment_name"])
    
    with mlflow.start_run():
        # Log config
        mlflow.log_params(config["model"])
        mlflow.log_params(config["training"])
        
        # Load data
        train_dataset = EarningsDataset(
            data_path=config["data"]["train_path"],
            seq_length=config["data"]["seq_length"],
        )
        val_dataset = EarningsDataset(
            data_path=config["data"]["val_path"],
            seq_length=config["data"]["seq_length"],
        )
        
        train_loader = DataLoader(
            train_dataset,
            batch_size=config["training"]["batch_size"],
            shuffle=True,
            num_workers=4,
        )
        val_loader = DataLoader(
            val_dataset,
            batch_size=config["training"]["batch_size"],
            shuffle=False,
            num_workers=4,
        )
        
        # Initialize model
        model = EarningsPredictionModel(
            input_size=config["model"]["input_size"],
            hidden_size=config["model"]["hidden_size"],
            num_layers=config["model"]["num_layers"],
            dropout=config["model"]["dropout"],
        )
        
        # Initialize trainer
        trainer = Trainer(
            model=model,
            train_loader=train_loader,
            val_loader=val_loader,
            config=config["training"],
        )
        
        # Train
        best_model, metrics = trainer.train()
        
        # Log metrics
        mlflow.log_metrics(metrics)
        
        # Save model
        model_path = Path(config["output"]["model_path"])
        model_path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(best_model.state_dict(), model_path)
        
        # Log model to MLflow
        mlflow.pytorch.log_model(best_model, "model")
        
        print(f"Training complete. Model saved to {model_path}")
        print(f"Metrics: {metrics}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="configs/earnings_config.yaml")
    args = parser.parse_args()
    
    main(args.config)
```

---

## 10. Deployment

### 10.1 Dockerfile

**File: `packages/ai-models/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/
COPY configs/ ./configs/
COPY models/ ./models/

# Set environment variables
ENV PYTHONPATH=/app/src
ENV MODEL_PATH=/app/models

# Expose port
EXPOSE 8000

# Run API server
CMD ["uvicorn", "prometheus.serving.api:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 10.2 Kubernetes Deployment

**File: `infrastructure/k8s/prometheus-ai-deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus-ai
  labels:
    app: prometheus-ai
spec:
  replicas: 2
  selector:
    matchLabels:
      app: prometheus-ai
  template:
    metadata:
      labels:
        app: prometheus-ai
    spec:
      containers:
      - name: prometheus-ai
        image: viddhana/prometheus-ai:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
            nvidia.com/gpu: 1
          limits:
            memory: "4Gi"
            cpu: "2000m"
            nvidia.com/gpu: 1
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: viddhana-secrets
              key: redis-url
        - name: MLFLOW_TRACKING_URI
          value: "http://mlflow:5000"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: prometheus-ai-service
spec:
  selector:
    app: prometheus-ai
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Setup Python project structure
- [ ] Implement feature extraction pipeline
- [ ] Create earnings prediction model (LSTM)
- [ ] Build basic training pipeline
- [ ] Setup MLflow for experiment tracking

### Phase 2: Core Models
- [ ] Train earnings prediction model on historical data
- [ ] Implement difficulty prediction with NeuralProphet
- [ ] Build Sentinel AI anomaly detection
- [ ] Create circuit breaker system
- [ ] Implement worker optimizer

### Phase 3: API & Integration
- [ ] Build FastAPI serving layer
- [ ] Add prediction caching
- [ ] Integrate with main API
- [ ] Setup real-time feature pipeline
- [ ] Deploy to Kubernetes with GPU support

### Phase 4: Optimization
- [ ] A/B testing framework
- [ ] Model retraining pipeline
- [ ] Performance monitoring
- [ ] Feature importance analysis
- [ ] Model explainability (SHAP values)

---

## References

- [PyTorch Documentation](https://pytorch.org/docs/)
- [NeuralProphet](https://neuralprophet.com/)
- [PyOD Library](https://pyod.readthedocs.io/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [MLflow](https://mlflow.org/docs/latest/)
