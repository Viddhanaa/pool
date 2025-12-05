"""
PyTorch Datasets for Mining Data.

Provides dataset classes for training earnings prediction models.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader, random_split

logger = logging.getLogger(__name__)


class MiningDataset(Dataset):
    """
    PyTorch dataset for mining time series data.

    Args:
        features: Feature array of shape (n_samples, n_features)
        targets: Target array of shape (n_samples, n_outputs)
        sequence_length: Length of input sequences
        prediction_horizon: Number of steps to predict
        stride: Stride for sliding window (default 1)
    """

    def __init__(
        self,
        features: np.ndarray,
        targets: np.ndarray,
        sequence_length: int = 168,
        prediction_horizon: int = 24,
        stride: int = 1,
    ) -> None:
        self.features = torch.FloatTensor(features)
        self.targets = torch.FloatTensor(targets)
        self.sequence_length = sequence_length
        self.prediction_horizon = prediction_horizon
        self.stride = stride

        # Calculate valid indices
        self.indices = list(range(
            0,
            len(features) - sequence_length - prediction_horizon + 1,
            stride,
        ))

        logger.info(
            f"Created dataset with {len(self.indices)} samples "
            f"(seq_len={sequence_length}, horizon={prediction_horizon})"
        )

    def __len__(self) -> int:
        return len(self.indices)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        start_idx = self.indices[idx]
        end_idx = start_idx + self.sequence_length

        # Input sequence
        x = self.features[start_idx:end_idx]

        # Target: next prediction_horizon values
        target_start = end_idx
        target_end = target_start + self.prediction_horizon
        y = self.targets[target_start:target_end]

        return x, y


class TimeSeriesDataset(Dataset):
    """
    Generic time series dataset with flexible target handling.

    Args:
        data: DataFrame with features and target columns
        feature_columns: List of feature column names
        target_column: Name of target column
        sequence_length: Input sequence length
        prediction_horizon: Number of steps to predict
        transform: Optional transform function for data augmentation
    """

    def __init__(
        self,
        data: pd.DataFrame,
        feature_columns: list[str],
        target_column: str,
        sequence_length: int = 168,
        prediction_horizon: int = 24,
        transform: callable | None = None,
    ) -> None:
        self.data = data
        self.feature_columns = feature_columns
        self.target_column = target_column
        self.sequence_length = sequence_length
        self.prediction_horizon = prediction_horizon
        self.transform = transform

        # Convert to tensors
        self.features = torch.FloatTensor(
            data[feature_columns].values.astype(np.float32)
        )
        self.targets = torch.FloatTensor(
            data[target_column].values.astype(np.float32)
        )

        # Valid indices
        self.n_samples = len(data) - sequence_length - prediction_horizon + 1
        if self.n_samples <= 0:
            raise ValueError(
                f"Not enough data for sequence_length={sequence_length} "
                f"and prediction_horizon={prediction_horizon}"
            )

    def __len__(self) -> int:
        return self.n_samples

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        # Input sequence
        x = self.features[idx : idx + self.sequence_length]

        # Target sequence
        target_start = idx + self.sequence_length
        target_end = target_start + self.prediction_horizon
        y = self.targets[target_start:target_end]

        # Apply transform if provided
        if self.transform:
            x, y = self.transform(x, y)

        return x, y

    @classmethod
    def from_csv(
        cls,
        path: str | Path,
        feature_columns: list[str],
        target_column: str,
        **kwargs: Any,
    ) -> TimeSeriesDataset:
        """
        Create dataset from CSV file.

        Args:
            path: Path to CSV file
            feature_columns: Feature column names
            target_column: Target column name
            **kwargs: Additional arguments for __init__

        Returns:
            TimeSeriesDataset instance
        """
        data = pd.read_csv(path)
        return cls(data, feature_columns, target_column, **kwargs)


class WindowedDataset(Dataset):
    """
    Sliding window dataset for multivariate time series.

    Args:
        data: Input data array of shape (n_samples, n_features)
        window_size: Size of the sliding window
        forecast_size: Number of steps to forecast
        step: Step size between windows
    """

    def __init__(
        self,
        data: np.ndarray,
        window_size: int = 168,
        forecast_size: int = 24,
        step: int = 1,
    ) -> None:
        self.data = torch.FloatTensor(data)
        self.window_size = window_size
        self.forecast_size = forecast_size
        self.step = step

        # Generate window indices
        self.windows = []
        for i in range(0, len(data) - window_size - forecast_size + 1, step):
            self.windows.append(i)

    def __len__(self) -> int:
        return len(self.windows)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        start = self.windows[idx]
        end = start + self.window_size

        x = self.data[start:end]
        y = self.data[end : end + self.forecast_size, 0]  # Assuming first column is target

        return x, y


def create_data_loaders(
    features: np.ndarray,
    targets: np.ndarray,
    sequence_length: int = 168,
    prediction_horizon: int = 24,
    batch_size: int = 32,
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
    shuffle: bool = True,
    num_workers: int = 0,
) -> tuple[DataLoader, DataLoader, DataLoader]:
    """
    Create train, validation, and test data loaders.

    Args:
        features: Feature array
        targets: Target array
        sequence_length: Input sequence length
        prediction_horizon: Prediction horizon
        batch_size: Batch size
        train_ratio: Ratio of data for training
        val_ratio: Ratio of data for validation
        shuffle: Whether to shuffle training data
        num_workers: Number of data loading workers

    Returns:
        Tuple of (train_loader, val_loader, test_loader)
    """
    # Create full dataset
    dataset = MiningDataset(
        features=features,
        targets=targets,
        sequence_length=sequence_length,
        prediction_horizon=prediction_horizon,
    )

    # Calculate split sizes
    total_size = len(dataset)
    train_size = int(total_size * train_ratio)
    val_size = int(total_size * val_ratio)
    test_size = total_size - train_size - val_size

    # For time series, we typically use sequential splits rather than random
    # to avoid data leakage
    train_dataset = torch.utils.data.Subset(
        dataset, range(train_size)
    )
    val_dataset = torch.utils.data.Subset(
        dataset, range(train_size, train_size + val_size)
    )
    test_dataset = torch.utils.data.Subset(
        dataset, range(train_size + val_size, total_size)
    )

    # Create loaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=True,
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
    )

    logger.info(
        f"Created data loaders: "
        f"train={len(train_dataset)}, "
        f"val={len(val_dataset)}, "
        f"test={len(test_dataset)}"
    )

    return train_loader, val_loader, test_loader


class DataAugmentation:
    """Data augmentation transforms for time series."""

    @staticmethod
    def add_noise(
        x: torch.Tensor,
        noise_level: float = 0.01,
    ) -> torch.Tensor:
        """Add Gaussian noise to input."""
        noise = torch.randn_like(x) * noise_level
        return x + noise

    @staticmethod
    def time_shift(
        x: torch.Tensor,
        max_shift: int = 5,
    ) -> torch.Tensor:
        """Randomly shift time series."""
        shift = np.random.randint(-max_shift, max_shift + 1)
        if shift == 0:
            return x
        return torch.roll(x, shifts=shift, dims=0)

    @staticmethod
    def scale(
        x: torch.Tensor,
        scale_range: tuple[float, float] = (0.9, 1.1),
    ) -> torch.Tensor:
        """Randomly scale values."""
        scale = np.random.uniform(*scale_range)
        return x * scale

    @staticmethod
    def dropout(
        x: torch.Tensor,
        dropout_rate: float = 0.1,
    ) -> torch.Tensor:
        """Randomly dropout values (set to 0)."""
        mask = torch.rand_like(x) > dropout_rate
        return x * mask


def create_augmented_transform(
    noise_level: float = 0.01,
    scale_range: tuple[float, float] = (0.95, 1.05),
    dropout_rate: float = 0.05,
) -> callable:
    """
    Create a composed augmentation transform.

    Args:
        noise_level: Standard deviation of Gaussian noise
        scale_range: Range for random scaling
        dropout_rate: Probability of dropping values

    Returns:
        Transform function
    """
    def transform(
        x: torch.Tensor,
        y: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        # Apply augmentations with probability
        if np.random.random() < 0.3:
            x = DataAugmentation.add_noise(x, noise_level)
        if np.random.random() < 0.2:
            x = DataAugmentation.scale(x, scale_range)
        if np.random.random() < 0.1:
            x = DataAugmentation.dropout(x, dropout_rate)
        return x, y

    return transform
