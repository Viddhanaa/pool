"""
Feature Extraction for Earnings Prediction.

This module provides feature engineering logic for mining earnings prediction,
including time-based features, statistical aggregations, and lag features.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class FeatureSet:
    """Container for extracted features."""

    features: np.ndarray
    feature_names: list[str]
    timestamps: list[datetime]
    metadata: dict[str, Any]


class EarningsFeatureExtractor:
    """
    Feature extractor for earnings prediction.

    Extracts and engineers features from raw mining data including:
    - Time-based features (hour, day, month)
    - Rolling statistics (mean, std, min, max)
    - Lag features
    - Trend indicators
    - Network features (difficulty, hashrate)

    Args:
        config: Configuration dictionary
    """

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self.config = config or {}

        # Feature extraction parameters
        self.rolling_windows = self.config.get("rolling_windows", [6, 12, 24, 48, 168])
        self.lag_periods = self.config.get("lag_periods", [1, 6, 12, 24, 48, 168])
        self.include_time_features = self.config.get("include_time_features", True)
        self.include_network_features = self.config.get("include_network_features", True)

        # Feature statistics for normalization
        self._feature_stats: dict[str, dict[str, float]] = {}

    def _extract_time_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Extract time-based features from timestamp column.

        Args:
            df: DataFrame with 'timestamp' column

        Returns:
            DataFrame with time features added
        """
        df = df.copy()

        if "timestamp" not in df.columns:
            return df

        ts = pd.to_datetime(df["timestamp"])

        # Basic time features
        df["hour"] = ts.dt.hour
        df["day_of_week"] = ts.dt.dayofweek
        df["day_of_month"] = ts.dt.day
        df["month"] = ts.dt.month
        df["is_weekend"] = (ts.dt.dayofweek >= 5).astype(int)

        # Cyclical encoding for hour (to capture periodicity)
        df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
        df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)

        # Cyclical encoding for day of week
        df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
        df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)

        return df

    def _extract_rolling_features(
        self,
        df: pd.DataFrame,
        columns: list[str],
    ) -> pd.DataFrame:
        """
        Extract rolling statistics for specified columns.

        Args:
            df: Input DataFrame
            columns: Columns to compute rolling stats for

        Returns:
            DataFrame with rolling features added
        """
        df = df.copy()

        for col in columns:
            if col not in df.columns:
                continue

            for window in self.rolling_windows:
                # Rolling mean
                df[f"{col}_rolling_mean_{window}"] = (
                    df[col].rolling(window=window, min_periods=1).mean()
                )

                # Rolling std
                df[f"{col}_rolling_std_{window}"] = (
                    df[col].rolling(window=window, min_periods=1).std().fillna(0)
                )

                # Rolling min/max
                df[f"{col}_rolling_min_{window}"] = (
                    df[col].rolling(window=window, min_periods=1).min()
                )
                df[f"{col}_rolling_max_{window}"] = (
                    df[col].rolling(window=window, min_periods=1).max()
                )

                # Rolling rate of change
                df[f"{col}_roc_{window}"] = df[col].pct_change(periods=window).fillna(0)

        return df

    def _extract_lag_features(
        self,
        df: pd.DataFrame,
        columns: list[str],
    ) -> pd.DataFrame:
        """
        Extract lag features for specified columns.

        Args:
            df: Input DataFrame
            columns: Columns to create lag features for

        Returns:
            DataFrame with lag features added
        """
        df = df.copy()

        for col in columns:
            if col not in df.columns:
                continue

            for lag in self.lag_periods:
                df[f"{col}_lag_{lag}"] = df[col].shift(lag)

        return df

    def _extract_trend_features(
        self,
        df: pd.DataFrame,
        columns: list[str],
    ) -> pd.DataFrame:
        """
        Extract trend indicators for specified columns.

        Args:
            df: Input DataFrame
            columns: Columns to compute trends for

        Returns:
            DataFrame with trend features added
        """
        df = df.copy()

        for col in columns:
            if col not in df.columns:
                continue

            # Simple moving average crossover signals
            if f"{col}_rolling_mean_12" in df.columns and f"{col}_rolling_mean_24" in df.columns:
                df[f"{col}_sma_cross"] = (
                    df[f"{col}_rolling_mean_12"] > df[f"{col}_rolling_mean_24"]
                ).astype(int)

            # Trend direction (positive/negative/neutral)
            df[f"{col}_trend"] = np.sign(df[col].diff()).fillna(0)

            # Momentum (rate of change)
            df[f"{col}_momentum"] = df[col].diff(periods=12).fillna(0)

            # Volatility (rolling std / rolling mean)
            if f"{col}_rolling_mean_24" in df.columns and f"{col}_rolling_std_24" in df.columns:
                df[f"{col}_volatility"] = (
                    df[f"{col}_rolling_std_24"]
                    / (df[f"{col}_rolling_mean_24"] + 1e-8)
                )

        return df

    def _extract_network_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Extract network-related features.

        Args:
            df: DataFrame with network data columns

        Returns:
            DataFrame with network features added
        """
        df = df.copy()

        # Difficulty features
        if "difficulty" in df.columns:
            df["difficulty_normalized"] = (
                df["difficulty"] / df["difficulty"].rolling(168).mean()
            ).fillna(1.0)

            df["difficulty_change"] = df["difficulty"].pct_change().fillna(0)

        # Network hashrate features
        if "network_hashrate" in df.columns:
            df["hashrate_share"] = df.get("hashrate", 0) / (
                df["network_hashrate"] + 1e-8
            )

        # Block time features
        if "block_time" in df.columns:
            df["block_time_normalized"] = df["block_time"] / df["block_time"].mean()

        return df

    async def extract_features(
        self,
        data: pd.DataFrame,
        target_column: str = "earnings",
        timestamp_column: str = "timestamp",
    ) -> FeatureSet:
        """
        Extract all features from raw mining data.

        Args:
            data: Raw mining data DataFrame
            target_column: Name of the target column
            timestamp_column: Name of the timestamp column

        Returns:
            FeatureSet containing extracted features
        """
        logger.info(f"Extracting features from {len(data)} records...")

        df = data.copy()

        # Ensure timestamp column
        if timestamp_column in df.columns:
            df["timestamp"] = pd.to_datetime(df[timestamp_column])
            df = df.sort_values("timestamp").reset_index(drop=True)

        # Columns to compute statistics for
        numeric_columns = [
            col for col in df.select_dtypes(include=[np.number]).columns
            if col not in ["timestamp", "hour", "day_of_week", "month"]
        ]

        # Extract different feature types
        if self.include_time_features:
            df = self._extract_time_features(df)

        df = self._extract_rolling_features(df, numeric_columns)
        df = self._extract_lag_features(df, [target_column] + numeric_columns[:3])
        df = self._extract_trend_features(df, [target_column])

        if self.include_network_features:
            df = self._extract_network_features(df)

        # Remove rows with NaN from lag features
        max_lag = max(self.lag_periods + self.rolling_windows)
        df = df.iloc[max_lag:].reset_index(drop=True)

        # Get feature columns (exclude target and timestamp)
        feature_columns = [
            col for col in df.columns
            if col not in [target_column, "timestamp", timestamp_column]
            and df[col].dtype in [np.float64, np.int64, np.float32, np.int32]
        ]

        # Fill any remaining NaN values
        df[feature_columns] = df[feature_columns].fillna(0)

        # Store feature statistics for later normalization
        for col in feature_columns:
            self._feature_stats[col] = {
                "mean": float(df[col].mean()),
                "std": float(df[col].std()),
                "min": float(df[col].min()),
                "max": float(df[col].max()),
            }

        # Extract timestamps
        timestamps = []
        if "timestamp" in df.columns:
            timestamps = df["timestamp"].tolist()
        else:
            timestamps = [datetime.now() + timedelta(hours=i) for i in range(len(df))]

        feature_array = df[feature_columns].values.astype(np.float32)

        logger.info(f"Extracted {len(feature_columns)} features from {len(df)} samples")

        return FeatureSet(
            features=feature_array,
            feature_names=feature_columns,
            timestamps=timestamps,
            metadata={
                "original_rows": len(data),
                "final_rows": len(df),
                "num_features": len(feature_columns),
                "feature_stats": self._feature_stats,
            },
        )

    def get_feature_importance(self, feature_names: list[str]) -> dict[str, float]:
        """
        Get feature importance based on statistics.

        This is a simple heuristic; for true importance, use model-based methods.

        Args:
            feature_names: List of feature names

        Returns:
            Dictionary mapping feature names to importance scores
        """
        importance = {}
        for name in feature_names:
            stats = self._feature_stats.get(name, {})
            # Simple heuristic: features with higher variance are more informative
            std = stats.get("std", 0)
            mean = abs(stats.get("mean", 0)) + 1e-8
            importance[name] = std / mean

        # Normalize to sum to 1
        total = sum(importance.values()) or 1
        return {k: v / total for k, v in importance.items()}

    def normalize_features(
        self,
        features: np.ndarray,
        feature_names: list[str],
        method: str = "zscore",
    ) -> np.ndarray:
        """
        Normalize features using stored statistics.

        Args:
            features: Feature array to normalize
            feature_names: Names of features in the array
            method: Normalization method ('zscore' or 'minmax')

        Returns:
            Normalized feature array
        """
        normalized = features.copy()

        for i, name in enumerate(feature_names):
            stats = self._feature_stats.get(name, {})

            if method == "zscore":
                mean = stats.get("mean", 0)
                std = stats.get("std", 1) or 1
                normalized[:, i] = (features[:, i] - mean) / std

            elif method == "minmax":
                min_val = stats.get("min", 0)
                max_val = stats.get("max", 1)
                range_val = (max_val - min_val) or 1
                normalized[:, i] = (features[:, i] - min_val) / range_val

        return normalized
