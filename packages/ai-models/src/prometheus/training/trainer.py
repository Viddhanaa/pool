"""
Model Training Module.

Provides training logic with early stopping, checkpointing,
and MLflow integration for experiment tracking.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import numpy as np
import torch
import torch.nn as nn
from torch.optim import Adam, AdamW
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader

logger = logging.getLogger(__name__)


@dataclass
class TrainingConfig:
    """Training configuration."""

    epochs: int = 100
    learning_rate: float = 0.001
    batch_size: int = 32
    early_stopping_patience: int = 10
    early_stopping_min_delta: float = 0.0001
    weight_decay: float = 0.01
    gradient_clip: float = 1.0
    scheduler_patience: int = 5
    scheduler_factor: float = 0.5
    checkpoint_dir: Path = field(default_factory=lambda: Path("./checkpoints"))
    save_best_only: bool = True
    log_interval: int = 10


@dataclass
class TrainingResult:
    """Container for training results."""

    best_epoch: int
    best_val_loss: float
    final_train_loss: float
    training_time_seconds: float
    epochs_trained: int
    early_stopped: bool
    history: dict[str, list[float]]
    model_path: Path | None = None


class EarlyStopping:
    """Early stopping handler."""

    def __init__(
        self,
        patience: int = 10,
        min_delta: float = 0.0001,
        mode: str = "min",
    ) -> None:
        self.patience = patience
        self.min_delta = min_delta
        self.mode = mode
        self.counter = 0
        self.best_score: float | None = None
        self.early_stop = False

    def __call__(self, score: float) -> bool:
        """
        Check if training should stop.

        Args:
            score: Current validation score

        Returns:
            True if training should stop
        """
        if self.best_score is None:
            self.best_score = score
            return False

        if self.mode == "min":
            improved = score < self.best_score - self.min_delta
        else:
            improved = score > self.best_score + self.min_delta

        if improved:
            self.best_score = score
            self.counter = 0
        else:
            self.counter += 1

        self.early_stop = self.counter >= self.patience
        return self.early_stop


class Trainer:
    """
    Model trainer with early stopping and experiment tracking.

    Args:
        model: PyTorch model to train
        config: Training configuration
        device: Device to train on
    """

    def __init__(
        self,
        model: nn.Module,
        config: TrainingConfig | None = None,
        device: str | None = None,
    ) -> None:
        self.model = model
        self.config = config or TrainingConfig()
        self.device = torch.device(
            device or ("cuda" if torch.cuda.is_available() else "cpu")
        )

        self.model.to(self.device)

        # Training components
        self.optimizer = AdamW(
            self.model.parameters(),
            lr=self.config.learning_rate,
            weight_decay=self.config.weight_decay,
        )

        self.scheduler = ReduceLROnPlateau(
            self.optimizer,
            mode="min",
            patience=self.config.scheduler_patience,
            factor=self.config.scheduler_factor,
        )

        self.criterion = nn.MSELoss()
        self.early_stopping = EarlyStopping(
            patience=self.config.early_stopping_patience,
            min_delta=self.config.early_stopping_min_delta,
        )

        # Training state
        self.history: dict[str, list[float]] = {
            "train_loss": [],
            "val_loss": [],
            "learning_rate": [],
        }
        self.best_val_loss = float("inf")
        self.best_epoch = 0
        self.current_epoch = 0

        # MLflow tracking
        self._mlflow_run = None
        self._use_mlflow = False

    def _init_mlflow(self, experiment_name: str = "prometheus") -> None:
        """Initialize MLflow tracking."""
        try:
            import mlflow

            mlflow.set_experiment(experiment_name)
            self._mlflow_run = mlflow.start_run()
            self._use_mlflow = True

            # Log parameters
            mlflow.log_params({
                "epochs": self.config.epochs,
                "learning_rate": self.config.learning_rate,
                "batch_size": self.config.batch_size,
                "weight_decay": self.config.weight_decay,
                "early_stopping_patience": self.config.early_stopping_patience,
            })

            logger.info("MLflow tracking initialized")

        except ImportError:
            logger.warning("MLflow not available, skipping experiment tracking")
        except Exception as e:
            logger.warning(f"Failed to initialize MLflow: {e}")

    def _log_metrics(self, metrics: dict[str, float], step: int) -> None:
        """Log metrics to MLflow if available."""
        if self._use_mlflow:
            try:
                import mlflow
                mlflow.log_metrics(metrics, step=step)
            except Exception as e:
                logger.debug(f"Failed to log metrics: {e}")

    def _train_epoch(
        self,
        train_loader: DataLoader,
        epoch: int,
    ) -> float:
        """
        Train for one epoch.

        Args:
            train_loader: Training data loader
            epoch: Current epoch number

        Returns:
            Average training loss
        """
        self.model.train()
        total_loss = 0.0
        num_batches = 0

        for batch_idx, (inputs, targets) in enumerate(train_loader):
            inputs = inputs.to(self.device)
            targets = targets.to(self.device)

            # Forward pass
            self.optimizer.zero_grad()
            outputs = self.model(inputs)

            # Handle dict output
            if isinstance(outputs, dict):
                predictions = outputs.get("mean", outputs.get("predictions"))
            else:
                predictions = outputs

            loss = self.criterion(predictions, targets)

            # Backward pass
            loss.backward()

            # Gradient clipping
            if self.config.gradient_clip > 0:
                torch.nn.utils.clip_grad_norm_(
                    self.model.parameters(),
                    self.config.gradient_clip,
                )

            self.optimizer.step()

            total_loss += loss.item()
            num_batches += 1

            # Log progress
            if batch_idx % self.config.log_interval == 0:
                logger.debug(
                    f"Epoch {epoch} [{batch_idx}/{len(train_loader)}] "
                    f"Loss: {loss.item():.6f}"
                )

        return total_loss / num_batches

    def _validate(self, val_loader: DataLoader) -> float:
        """
        Validate the model.

        Args:
            val_loader: Validation data loader

        Returns:
            Average validation loss
        """
        self.model.eval()
        total_loss = 0.0
        num_batches = 0

        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs = inputs.to(self.device)
                targets = targets.to(self.device)

                outputs = self.model(inputs)

                if isinstance(outputs, dict):
                    predictions = outputs.get("mean", outputs.get("predictions"))
                else:
                    predictions = outputs

                loss = self.criterion(predictions, targets)
                total_loss += loss.item()
                num_batches += 1

        return total_loss / num_batches

    def _save_checkpoint(
        self,
        epoch: int,
        val_loss: float,
        is_best: bool = False,
    ) -> Path | None:
        """Save model checkpoint."""
        self.config.checkpoint_dir.mkdir(parents=True, exist_ok=True)

        checkpoint = {
            "epoch": epoch,
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "scheduler_state_dict": self.scheduler.state_dict(),
            "val_loss": val_loss,
            "history": self.history,
            "config": {
                "epochs": self.config.epochs,
                "learning_rate": self.config.learning_rate,
                "batch_size": self.config.batch_size,
            },
        }

        if is_best or not self.config.save_best_only:
            path = self.config.checkpoint_dir / f"checkpoint_epoch_{epoch}.pt"
            torch.save(checkpoint, path)
            logger.info(f"Checkpoint saved: {path}")

        if is_best:
            best_path = self.config.checkpoint_dir / "best_model.pt"
            torch.save(checkpoint, best_path)
            logger.info(f"Best model saved: {best_path}")
            return best_path

        return None

    def train(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader | None = None,
        experiment_name: str = "prometheus",
    ) -> TrainingResult:
        """
        Train the model.

        Args:
            train_loader: Training data loader
            val_loader: Validation data loader (optional)
            experiment_name: MLflow experiment name

        Returns:
            TrainingResult with training metrics
        """
        logger.info(f"Starting training for {self.config.epochs} epochs")
        logger.info(f"Device: {self.device}")

        # Initialize tracking
        self._init_mlflow(experiment_name)

        start_time = time.time()
        best_model_path = None

        for epoch in range(1, self.config.epochs + 1):
            self.current_epoch = epoch

            # Training
            train_loss = self._train_epoch(train_loader, epoch)
            self.history["train_loss"].append(train_loss)

            # Validation
            if val_loader:
                val_loss = self._validate(val_loader)
                self.history["val_loss"].append(val_loss)
            else:
                val_loss = train_loss

            # Learning rate
            current_lr = self.optimizer.param_groups[0]["lr"]
            self.history["learning_rate"].append(current_lr)

            # Update scheduler
            self.scheduler.step(val_loss)

            # Log metrics
            self._log_metrics({
                "train_loss": train_loss,
                "val_loss": val_loss,
                "learning_rate": current_lr,
            }, step=epoch)

            # Check for best model
            is_best = val_loss < self.best_val_loss
            if is_best:
                self.best_val_loss = val_loss
                self.best_epoch = epoch
                model_path = self._save_checkpoint(epoch, val_loss, is_best=True)
                if model_path:
                    best_model_path = model_path

            # Log epoch summary
            logger.info(
                f"Epoch {epoch}/{self.config.epochs} - "
                f"Train Loss: {train_loss:.6f} - "
                f"Val Loss: {val_loss:.6f} - "
                f"LR: {current_lr:.6f}"
                + (" - Best" if is_best else "")
            )

            # Early stopping
            if self.early_stopping(val_loss):
                logger.info(f"Early stopping triggered at epoch {epoch}")
                break

        training_time = time.time() - start_time

        # Close MLflow run
        if self._use_mlflow:
            try:
                import mlflow
                mlflow.end_run()
            except Exception:
                pass

        return TrainingResult(
            best_epoch=self.best_epoch,
            best_val_loss=self.best_val_loss,
            final_train_loss=self.history["train_loss"][-1],
            training_time_seconds=training_time,
            epochs_trained=self.current_epoch,
            early_stopped=self.early_stopping.early_stop,
            history=self.history,
            model_path=best_model_path,
        )

    def evaluate(
        self,
        test_loader: DataLoader,
        metrics: list[Callable] | None = None,
    ) -> dict[str, float]:
        """
        Evaluate the model on test data.

        Args:
            test_loader: Test data loader
            metrics: List of metric functions (callable(y_true, y_pred) -> float)

        Returns:
            Dictionary of metric names to values
        """
        self.model.eval()

        all_predictions = []
        all_targets = []

        with torch.no_grad():
            for inputs, targets in test_loader:
                inputs = inputs.to(self.device)

                outputs = self.model(inputs)

                if isinstance(outputs, dict):
                    predictions = outputs.get("mean", outputs.get("predictions"))
                else:
                    predictions = outputs

                all_predictions.append(predictions.cpu().numpy())
                all_targets.append(targets.numpy())

        y_pred = np.concatenate(all_predictions)
        y_true = np.concatenate(all_targets)

        # Calculate metrics
        results = {
            "mse": float(np.mean((y_true - y_pred) ** 2)),
            "rmse": float(np.sqrt(np.mean((y_true - y_pred) ** 2))),
            "mae": float(np.mean(np.abs(y_true - y_pred))),
        }

        # R-squared
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        results["r2"] = float(1 - ss_res / (ss_tot + 1e-8))

        # Custom metrics
        if metrics:
            for metric_fn in metrics:
                try:
                    name = metric_fn.__name__
                    results[name] = float(metric_fn(y_true, y_pred))
                except Exception as e:
                    logger.warning(f"Failed to compute metric {metric_fn}: {e}")

        logger.info(f"Evaluation results: {results}")
        return results

    def load_checkpoint(self, path: Path | str) -> None:
        """Load model from checkpoint."""
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Checkpoint not found: {path}")

        checkpoint = torch.load(path, map_location=self.device)

        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        self.scheduler.load_state_dict(checkpoint["scheduler_state_dict"])
        self.history = checkpoint.get("history", self.history)

        logger.info(f"Loaded checkpoint from {path}")


def main() -> None:
    """CLI entry point for training."""
    import argparse

    parser = argparse.ArgumentParser(description="Train Prometheus models")
    parser.add_argument("--model", type=str, required=True, help="Model type")
    parser.add_argument("--data", type=str, required=True, help="Training data path")
    parser.add_argument("--epochs", type=int, default=100, help="Number of epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--output", type=str, default="./models", help="Output directory")

    args = parser.parse_args()

    logger.info(f"Training {args.model} model with data from {args.data}")
    # Training logic would go here


if __name__ == "__main__":
    main()
