"""
Difficulty Prediction Model using NeuralProphet.

This module provides time series forecasting for mining difficulty
using NeuralProphet, which combines neural networks with interpretable
time series components.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class DifficultyPrediction:
    """Container for difficulty prediction results."""

    timestamp: datetime
    predicted_difficulty: float
    lower_bound: float
    upper_bound: float
    trend_direction: str  # "increasing", "decreasing", "stable"
    confidence: float
    components: dict[str, float] | None = None


@dataclass
class DifficultyAdjustment:
    """Information about the next difficulty adjustment."""

    estimated_time: datetime
    blocks_remaining: int
    predicted_change_percent: float
    current_difficulty: float
    predicted_difficulty: float
    confidence: float


class DifficultyPredictionModel:
    """
    NeuralProphet-based difficulty prediction model.

    Uses neural network-enhanced time series decomposition to predict
    mining difficulty, accounting for trends, seasonality, and
    special events like halvings.

    Args:
        config: Model configuration dictionary
    """

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self.config = config or {}
        self.model = None
        self._is_fitted = False

        # Model configuration
        self.changepoint_range = self.config.get("changepoint_range", 0.8)
        self.seasonality_mode = self.config.get("seasonality_mode", "multiplicative")
        self.yearly_seasonality = self.config.get("yearly_seasonality", True)
        self.weekly_seasonality = self.config.get("weekly_seasonality", True)
        self.daily_seasonality = self.config.get("daily_seasonality", False)
        self.n_changepoints = self.config.get("n_changepoints", 25)
        self.epochs = self.config.get("epochs", 100)
        self.learning_rate = self.config.get("learning_rate", 0.1)

        # Difficulty adjustment settings (Bitcoin-style)
        self.adjustment_interval_blocks = self.config.get("adjustment_interval", 2016)
        self.target_block_time_seconds = self.config.get("target_block_time", 600)

        # Training history
        self.training_history: dict[str, Any] = {}
        self.last_trained: datetime | None = None

    def _build_model(self) -> Any:
        """Build and configure the NeuralProphet model."""
        try:
            from neuralprophet import NeuralProphet
        except ImportError as e:
            raise ImportError(
                "NeuralProphet is required for difficulty prediction. "
                "Install with: pip install neuralprophet"
            ) from e

        model = NeuralProphet(
            growth="linear",
            changepoints_range=self.changepoint_range,
            n_changepoints=self.n_changepoints,
            yearly_seasonality=self.yearly_seasonality,
            weekly_seasonality=self.weekly_seasonality,
            daily_seasonality=self.daily_seasonality,
            seasonality_mode=self.seasonality_mode,
            epochs=self.epochs,
            learning_rate=self.learning_rate,
            batch_size=64,
            loss_func="MSE",
            normalize="auto",
        )

        return model

    def _prepare_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Prepare data for NeuralProphet training.

        Args:
            df: DataFrame with 'timestamp' and 'difficulty' columns

        Returns:
            Prepared DataFrame with 'ds' and 'y' columns
        """
        prepared = df.copy()

        # Ensure proper column names for NeuralProphet
        if "timestamp" in prepared.columns:
            prepared = prepared.rename(columns={"timestamp": "ds"})
        if "difficulty" in prepared.columns:
            prepared = prepared.rename(columns={"difficulty": "y"})

        # Ensure datetime type
        prepared["ds"] = pd.to_datetime(prepared["ds"])

        # Sort by date
        prepared = prepared.sort_values("ds").reset_index(drop=True)

        # Apply log transform for better scaling (difficulty values are large)
        prepared["y"] = np.log1p(prepared["y"])

        return prepared[["ds", "y"]]

    def train(
        self,
        data: pd.DataFrame,
        validation_split: float = 0.2,
    ) -> dict[str, Any]:
        """
        Train the difficulty prediction model.

        Args:
            data: DataFrame with 'timestamp' and 'difficulty' columns
            validation_split: Fraction of data to use for validation

        Returns:
            Dictionary containing training metrics
        """
        logger.info("Starting difficulty model training...")

        # Prepare data
        df = self._prepare_data(data)

        # Split data
        split_idx = int(len(df) * (1 - validation_split))
        train_df = df[:split_idx]
        val_df = df[split_idx:]

        # Build and train model
        self.model = self._build_model()

        # Train with validation
        metrics = self.model.fit(
            train_df,
            validation_df=val_df if len(val_df) > 0 else None,
            freq="D",  # Daily frequency
        )

        self._is_fitted = True
        self.last_trained = datetime.now()

        # Store training history
        self.training_history = {
            "train_size": len(train_df),
            "val_size": len(val_df),
            "epochs": self.epochs,
            "final_loss": float(metrics["Loss"].iloc[-1]) if metrics is not None else None,
            "trained_at": self.last_trained.isoformat(),
        }

        logger.info(f"Training completed. Final loss: {self.training_history.get('final_loss')}")

        return self.training_history

    def predict(
        self,
        periods: int = 14,
        include_history: bool = False,
    ) -> list[DifficultyPrediction]:
        """
        Predict future difficulty values.

        Args:
            periods: Number of periods (days) to predict
            include_history: Whether to include historical fitted values

        Returns:
            List of DifficultyPrediction objects
        """
        if not self._is_fitted or self.model is None:
            raise ValueError("Model must be trained before prediction. Call train() first.")

        # Create future dataframe
        future = self.model.make_future_dataframe(
            df=None,
            periods=periods,
            n_historic_predictions=include_history,
        )

        # Generate predictions
        forecast = self.model.predict(future)

        predictions = []
        for _, row in forecast.iterrows():
            # Reverse log transform
            predicted = np.expm1(row["yhat1"])
            lower = np.expm1(row.get("yhat1_lower", row["yhat1"] * 0.95))
            upper = np.expm1(row.get("yhat1_upper", row["yhat1"] * 1.05))

            # Determine trend direction
            if len(predictions) > 0:
                prev_pred = predictions[-1].predicted_difficulty
                if predicted > prev_pred * 1.01:
                    trend = "increasing"
                elif predicted < prev_pred * 0.99:
                    trend = "decreasing"
                else:
                    trend = "stable"
            else:
                trend = "stable"

            # Calculate confidence based on prediction interval width
            interval_width = (upper - lower) / predicted if predicted > 0 else 1.0
            confidence = max(0.0, min(1.0, 1.0 - interval_width))

            # Extract components if available
            components = {}
            if "trend" in row:
                components["trend"] = float(np.expm1(row["trend"]))
            if "season_yearly" in row:
                components["yearly_seasonality"] = float(row["season_yearly"])
            if "season_weekly" in row:
                components["weekly_seasonality"] = float(row["season_weekly"])

            predictions.append(
                DifficultyPrediction(
                    timestamp=row["ds"].to_pydatetime(),
                    predicted_difficulty=float(predicted),
                    lower_bound=float(lower),
                    upper_bound=float(upper),
                    trend_direction=trend,
                    confidence=confidence,
                    components=components if components else None,
                )
            )

        return predictions

    def get_next_adjustment(
        self,
        current_block_height: int,
        current_difficulty: float,
        current_block_time_avg: float,
    ) -> DifficultyAdjustment:
        """
        Predict the next difficulty adjustment.

        Args:
            current_block_height: Current blockchain height
            current_difficulty: Current mining difficulty
            current_block_time_avg: Average block time over recent blocks (seconds)

        Returns:
            DifficultyAdjustment with prediction details
        """
        # Calculate blocks until next adjustment
        blocks_since_adjustment = current_block_height % self.adjustment_interval_blocks
        blocks_remaining = self.adjustment_interval_blocks - blocks_since_adjustment

        # Estimate time until adjustment
        time_remaining_seconds = blocks_remaining * current_block_time_avg
        estimated_time = datetime.now() + timedelta(seconds=time_remaining_seconds)

        # Calculate expected difficulty change based on block time
        # If blocks are coming faster than target, difficulty increases
        time_ratio = self.target_block_time_seconds / current_block_time_avg

        # Apply dampening (most implementations limit adjustment to 4x)
        max_adjustment = 4.0
        min_adjustment = 0.25
        adjustment_factor = max(min_adjustment, min(max_adjustment, time_ratio))

        predicted_difficulty = current_difficulty * adjustment_factor
        change_percent = (adjustment_factor - 1.0) * 100

        # Get model-based prediction if available
        confidence = 0.5
        if self._is_fitted:
            try:
                future_predictions = self.predict(periods=int(blocks_remaining / 144) + 1)
                if future_predictions:
                    model_prediction = future_predictions[-1]
                    # Blend formula-based and model-based predictions
                    predicted_difficulty = (predicted_difficulty + model_prediction.predicted_difficulty) / 2
                    confidence = model_prediction.confidence
            except Exception as e:
                logger.warning(f"Could not get model prediction: {e}")

        return DifficultyAdjustment(
            estimated_time=estimated_time,
            blocks_remaining=blocks_remaining,
            predicted_change_percent=change_percent,
            current_difficulty=current_difficulty,
            predicted_difficulty=predicted_difficulty,
            confidence=confidence,
        )

    def save(self, path: str | Path) -> None:
        """
        Save the trained model.

        Args:
            path: Path to save the model
        """
        if not self._is_fitted or self.model is None:
            raise ValueError("Cannot save untrained model")

        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        # Save NeuralProphet model
        import pickle

        with open(path, "wb") as f:
            pickle.dump(
                {
                    "model": self.model,
                    "config": self.config,
                    "training_history": self.training_history,
                    "last_trained": self.last_trained,
                },
                f,
            )

        logger.info(f"Model saved to {path}")

    def load(self, path: str | Path) -> None:
        """
        Load a trained model.

        Args:
            path: Path to the saved model
        """
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Model file not found: {path}")

        import pickle

        with open(path, "rb") as f:
            data = pickle.load(f)

        self.model = data["model"]
        self.config = data.get("config", {})
        self.training_history = data.get("training_history", {})
        self.last_trained = data.get("last_trained")
        self._is_fitted = True

        logger.info(f"Model loaded from {path}")

    def get_model_info(self) -> dict[str, Any]:
        """Get model information and training status."""
        return {
            "is_fitted": self._is_fitted,
            "last_trained": self.last_trained.isoformat() if self.last_trained else None,
            "config": self.config,
            "training_history": self.training_history,
        }
