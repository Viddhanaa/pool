"""
LSTM-based Earnings Prediction Model with Attention Mechanism.

This module provides a sophisticated earnings prediction system using
LSTM networks enhanced with multi-head attention for capturing
long-range dependencies in mining earnings data.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch import Tensor

logger = logging.getLogger(__name__)


@dataclass
class EarningsPrediction:
    """Container for earnings prediction results."""

    predicted_earnings: float
    confidence_score: float
    prediction_interval_lower: float
    prediction_interval_upper: float
    hourly_breakdown: list[float] | None = None
    feature_importance: dict[str, float] | None = None


class AttentionLayer(nn.Module):
    """
    Multi-head attention layer for sequence processing.

    Implements scaled dot-product attention with multiple heads
    to capture different aspects of temporal dependencies.

    Args:
        hidden_size: Size of the hidden representations
        num_heads: Number of attention heads
        dropout: Dropout probability
    """

    def __init__(
        self,
        hidden_size: int,
        num_heads: int = 4,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()
        assert hidden_size % num_heads == 0, "hidden_size must be divisible by num_heads"

        self.hidden_size = hidden_size
        self.num_heads = num_heads
        self.head_dim = hidden_size // num_heads
        self.scale = self.head_dim ** -0.5

        # Linear projections for Q, K, V
        self.query_proj = nn.Linear(hidden_size, hidden_size)
        self.key_proj = nn.Linear(hidden_size, hidden_size)
        self.value_proj = nn.Linear(hidden_size, hidden_size)
        self.output_proj = nn.Linear(hidden_size, hidden_size)

        self.dropout = nn.Dropout(dropout)
        self.layer_norm = nn.LayerNorm(hidden_size)

    def forward(
        self,
        query: Tensor,
        key: Tensor,
        value: Tensor,
        mask: Tensor | None = None,
    ) -> tuple[Tensor, Tensor]:
        """
        Forward pass of multi-head attention.

        Args:
            query: Query tensor of shape (batch, seq_len, hidden_size)
            key: Key tensor of shape (batch, seq_len, hidden_size)
            value: Value tensor of shape (batch, seq_len, hidden_size)
            mask: Optional attention mask

        Returns:
            Tuple of (output tensor, attention weights)
        """
        batch_size, seq_len, _ = query.shape
        residual = query

        # Project and reshape for multi-head attention
        q = self.query_proj(query).view(batch_size, seq_len, self.num_heads, self.head_dim)
        k = self.key_proj(key).view(batch_size, seq_len, self.num_heads, self.head_dim)
        v = self.value_proj(value).view(batch_size, seq_len, self.num_heads, self.head_dim)

        # Transpose for attention: (batch, heads, seq_len, head_dim)
        q = q.transpose(1, 2)
        k = k.transpose(1, 2)
        v = v.transpose(1, 2)

        # Scaled dot-product attention
        attention_scores = torch.matmul(q, k.transpose(-2, -1)) * self.scale

        if mask is not None:
            attention_scores = attention_scores.masked_fill(mask == 0, float("-inf"))

        attention_weights = F.softmax(attention_scores, dim=-1)
        attention_weights = self.dropout(attention_weights)

        # Apply attention to values
        context = torch.matmul(attention_weights, v)

        # Reshape and project output
        context = context.transpose(1, 2).contiguous().view(batch_size, seq_len, self.hidden_size)
        output = self.output_proj(context)

        # Residual connection and layer normalization
        output = self.layer_norm(residual + self.dropout(output))

        return output, attention_weights


class EarningsPredictionModel(nn.Module):
    """
    LSTM-based earnings prediction model with attention mechanism.

    This model combines LSTM layers for sequential processing with
    multi-head attention to capture both local and global patterns
    in mining earnings data.

    Args:
        input_size: Number of input features
        hidden_size: Size of LSTM hidden state
        num_layers: Number of LSTM layers
        num_heads: Number of attention heads
        dropout: Dropout probability
        output_size: Number of output predictions (hours ahead)
    """

    def __init__(
        self,
        input_size: int = 10,
        hidden_size: int = 128,
        num_layers: int = 2,
        num_heads: int = 4,
        dropout: float = 0.2,
        output_size: int = 24,
    ) -> None:
        super().__init__()

        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.output_size = output_size

        # Input projection
        self.input_projection = nn.Linear(input_size, hidden_size)

        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=hidden_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=False,
        )

        # Attention layer
        self.attention = AttentionLayer(
            hidden_size=hidden_size,
            num_heads=num_heads,
            dropout=dropout,
        )

        # Output layers
        self.fc_mean = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, output_size),
        )

        # Uncertainty estimation (variance prediction)
        self.fc_var = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, output_size),
            nn.Softplus(),  # Ensure positive variance
        )

        self._init_weights()

    def _init_weights(self) -> None:
        """Initialize model weights using Xavier/Glorot initialization."""
        for name, param in self.named_parameters():
            if "weight" in name and param.dim() >= 2:
                nn.init.xavier_uniform_(param)
            elif "bias" in name:
                nn.init.zeros_(param)

    def forward(
        self,
        x: Tensor,
        return_attention: bool = False,
    ) -> dict[str, Tensor]:
        """
        Forward pass of the earnings prediction model.

        Args:
            x: Input tensor of shape (batch, seq_len, input_size)
            return_attention: Whether to return attention weights

        Returns:
            Dictionary containing predictions, variance, and optionally attention weights
        """
        batch_size, seq_len, _ = x.shape

        # Project input
        x = self.input_projection(x)

        # LSTM processing
        lstm_out, (hidden, cell) = self.lstm(x)

        # Apply attention
        attended, attention_weights = self.attention(
            query=lstm_out,
            key=lstm_out,
            value=lstm_out,
        )

        # Use the last attended output for prediction
        final_repr = attended[:, -1, :]

        # Generate predictions
        mean = self.fc_mean(final_repr)
        variance = self.fc_var(final_repr)

        result = {
            "mean": mean,
            "variance": variance,
        }

        if return_attention:
            result["attention_weights"] = attention_weights

        return result

    def predict_with_confidence(
        self,
        x: Tensor,
        confidence_level: float = 0.95,
    ) -> dict[str, Tensor]:
        """
        Generate predictions with confidence intervals.

        Args:
            x: Input tensor
            confidence_level: Confidence level for intervals (default 95%)

        Returns:
            Dictionary with predictions and confidence bounds
        """
        self.eval()
        with torch.no_grad():
            output = self.forward(x)

            mean = output["mean"]
            variance = output["variance"]
            std = torch.sqrt(variance)

            # Calculate z-score for confidence level
            from scipy import stats
            z_score = stats.norm.ppf((1 + confidence_level) / 2)

            lower_bound = mean - z_score * std
            upper_bound = mean + z_score * std

            # Calculate confidence score (inverse of normalized uncertainty)
            relative_uncertainty = std / (torch.abs(mean) + 1e-8)
            confidence_score = 1 / (1 + relative_uncertainty.mean(dim=-1))

            return {
                "predictions": mean,
                "lower_bound": lower_bound,
                "upper_bound": upper_bound,
                "confidence_score": confidence_score,
                "variance": variance,
            }


class EarningsPredictor:
    """
    High-level API for earnings prediction.

    This class provides a simple interface for training, loading,
    and using the earnings prediction model.

    Args:
        model_path: Path to saved model weights (optional)
        config: Model configuration dictionary
        device: Torch device to use
    """

    def __init__(
        self,
        model_path: str | Path | None = None,
        config: dict[str, Any] | None = None,
        device: str | None = None,
    ) -> None:
        self.device = torch.device(
            device or ("cuda" if torch.cuda.is_available() else "cpu")
        )
        self.config = config or {}

        # Model hyperparameters
        self.input_size = self.config.get("input_size", 10)
        self.hidden_size = self.config.get("hidden_size", 128)
        self.num_layers = self.config.get("num_layers", 2)
        self.num_heads = self.config.get("num_heads", 4)
        self.dropout = self.config.get("dropout", 0.2)
        self.output_size = self.config.get("output_size", 24)
        self.sequence_length = self.config.get("sequence_length", 168)

        # Feature statistics for normalization
        self.feature_mean: np.ndarray | None = None
        self.feature_std: np.ndarray | None = None

        # Initialize model
        self.model = self._build_model()

        if model_path:
            self.load(model_path)

    def _build_model(self) -> EarningsPredictionModel:
        """Build and return the prediction model."""
        model = EarningsPredictionModel(
            input_size=self.input_size,
            hidden_size=self.hidden_size,
            num_layers=self.num_layers,
            num_heads=self.num_heads,
            dropout=self.dropout,
            output_size=self.output_size,
        )
        return model.to(self.device)

    def _normalize_features(self, features: np.ndarray) -> np.ndarray:
        """Normalize input features using stored statistics."""
        if self.feature_mean is None or self.feature_std is None:
            raise ValueError("Feature statistics not set. Train the model first.")
        return (features - self.feature_mean) / (self.feature_std + 1e-8)

    def _prepare_input(self, features: np.ndarray) -> Tensor:
        """Prepare input features for model inference."""
        # Ensure 3D shape: (batch, seq_len, features)
        if features.ndim == 2:
            features = features[np.newaxis, ...]

        # Normalize
        if self.feature_mean is not None:
            features = self._normalize_features(features)

        # Convert to tensor
        return torch.FloatTensor(features).to(self.device)

    def fit_normalization(self, features: np.ndarray) -> None:
        """
        Fit normalization statistics on training data.

        Args:
            features: Training features array
        """
        self.feature_mean = np.mean(features, axis=(0, 1) if features.ndim == 3 else 0)
        self.feature_std = np.std(features, axis=(0, 1) if features.ndim == 3 else 0)

    def predict(
        self,
        features: np.ndarray,
        confidence_level: float = 0.95,
    ) -> EarningsPrediction:
        """
        Predict future earnings with confidence scores.

        Args:
            features: Input features array of shape (seq_len, num_features)
                     or (batch, seq_len, num_features)
            confidence_level: Confidence level for prediction intervals

        Returns:
            EarningsPrediction object with predictions and confidence metrics
        """
        self.model.eval()

        # Prepare input
        x = self._prepare_input(features)

        # Get predictions
        with torch.no_grad():
            output = self.model.predict_with_confidence(x, confidence_level)

        # Extract results (use first batch item if single prediction)
        predictions = output["predictions"][0].cpu().numpy()
        lower_bound = output["lower_bound"][0].cpu().numpy()
        upper_bound = output["upper_bound"][0].cpu().numpy()
        confidence_score = output["confidence_score"][0].cpu().item()

        # Aggregate predictions
        total_earnings = float(np.sum(predictions))
        total_lower = float(np.sum(lower_bound))
        total_upper = float(np.sum(upper_bound))

        return EarningsPrediction(
            predicted_earnings=total_earnings,
            confidence_score=confidence_score,
            prediction_interval_lower=total_lower,
            prediction_interval_upper=total_upper,
            hourly_breakdown=predictions.tolist(),
        )

    def predict_batch(
        self,
        features_batch: np.ndarray,
        confidence_level: float = 0.95,
    ) -> list[EarningsPrediction]:
        """
        Predict earnings for a batch of inputs.

        Args:
            features_batch: Batch of input features (batch, seq_len, features)
            confidence_level: Confidence level for prediction intervals

        Returns:
            List of EarningsPrediction objects
        """
        self.model.eval()

        x = self._prepare_input(features_batch)

        with torch.no_grad():
            output = self.model.predict_with_confidence(x, confidence_level)

        predictions = output["predictions"].cpu().numpy()
        lower_bounds = output["lower_bound"].cpu().numpy()
        upper_bounds = output["upper_bound"].cpu().numpy()
        confidence_scores = output["confidence_score"].cpu().numpy()

        results = []
        for i in range(len(predictions)):
            results.append(
                EarningsPrediction(
                    predicted_earnings=float(np.sum(predictions[i])),
                    confidence_score=float(confidence_scores[i]),
                    prediction_interval_lower=float(np.sum(lower_bounds[i])),
                    prediction_interval_upper=float(np.sum(upper_bounds[i])),
                    hourly_breakdown=predictions[i].tolist(),
                )
            )

        return results

    def save(self, path: str | Path) -> None:
        """
        Save model weights and configuration.

        Args:
            path: Path to save the model
        """
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        checkpoint = {
            "model_state_dict": self.model.state_dict(),
            "config": self.config,
            "feature_mean": self.feature_mean,
            "feature_std": self.feature_std,
            "input_size": self.input_size,
            "hidden_size": self.hidden_size,
            "num_layers": self.num_layers,
            "num_heads": self.num_heads,
            "dropout": self.dropout,
            "output_size": self.output_size,
        }

        torch.save(checkpoint, path)
        logger.info(f"Model saved to {path}")

    def load(self, path: str | Path) -> None:
        """
        Load model weights and configuration.

        Args:
            path: Path to the saved model
        """
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Model file not found: {path}")

        checkpoint = torch.load(path, map_location=self.device)

        # Restore configuration
        self.config = checkpoint.get("config", {})
        self.input_size = checkpoint.get("input_size", self.input_size)
        self.hidden_size = checkpoint.get("hidden_size", self.hidden_size)
        self.num_layers = checkpoint.get("num_layers", self.num_layers)
        self.num_heads = checkpoint.get("num_heads", self.num_heads)
        self.dropout = checkpoint.get("dropout", self.dropout)
        self.output_size = checkpoint.get("output_size", self.output_size)

        # Rebuild model with loaded config
        self.model = self._build_model()
        self.model.load_state_dict(checkpoint["model_state_dict"])

        # Restore normalization statistics
        self.feature_mean = checkpoint.get("feature_mean")
        self.feature_std = checkpoint.get("feature_std")

        logger.info(f"Model loaded from {path}")

    def get_model_summary(self) -> dict[str, Any]:
        """Get a summary of the model architecture."""
        total_params = sum(p.numel() for p in self.model.parameters())
        trainable_params = sum(p.numel() for p in self.model.parameters() if p.requires_grad)

        return {
            "input_size": self.input_size,
            "hidden_size": self.hidden_size,
            "num_layers": self.num_layers,
            "num_heads": self.num_heads,
            "output_size": self.output_size,
            "total_parameters": total_params,
            "trainable_parameters": trainable_params,
            "device": str(self.device),
        }
