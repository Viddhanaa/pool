"""
FastAPI Application for Prometheus AI.

Provides REST API endpoints for model inference, health checks,
and real-time predictions.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from prometheus.config import get_config
from prometheus.serving.cache import PredictionCache
from prometheus.serving.inference import InferenceEngine

logger = logging.getLogger(__name__)


# Request/Response Models
class EarningsPredictionRequest(BaseModel):
    """Request model for earnings prediction."""

    worker_id: str = Field(..., description="Worker identifier")
    features: list[list[float]] = Field(..., description="Feature matrix (seq_len x num_features)")
    confidence_level: float = Field(default=0.95, ge=0.5, le=0.99)


class EarningsPredictionResponse(BaseModel):
    """Response model for earnings prediction."""

    worker_id: str
    predicted_earnings: float
    confidence_score: float
    prediction_interval_lower: float
    prediction_interval_upper: float
    hourly_breakdown: list[float] | None = None
    timestamp: datetime


class DifficultyPredictionRequest(BaseModel):
    """Request model for difficulty prediction."""

    periods: int = Field(default=14, ge=1, le=90, description="Days to predict")
    include_components: bool = Field(default=False)


class DifficultyPredictionResponse(BaseModel):
    """Response model for difficulty prediction."""

    predictions: list[dict[str, Any]]
    timestamp: datetime


class AnomalyDetectionRequest(BaseModel):
    """Request model for anomaly detection."""

    features: list[float] = Field(..., description="Feature vector")
    threshold: float | None = Field(default=None, ge=0.0, le=1.0)


class AnomalyDetectionResponse(BaseModel):
    """Response model for anomaly detection."""

    is_anomaly: bool
    threat_type: str
    severity: str
    confidence: float
    anomaly_score: float
    contributing_factors: list[str]
    timestamp: datetime


class OptimizationRequest(BaseModel):
    """Request model for worker optimization."""

    device_id: str
    device_name: str
    gpu_model: str
    base_hashrate: float
    base_power: float
    memory_size_gb: float
    core_clock: int
    memory_clock: int
    power_limit: float
    fan_speed: int
    temperature: float
    vram_temperature: float | None = None
    optimization_target: str = Field(default="balanced")


class OptimizationResponse(BaseModel):
    """Response model for worker optimization."""

    worker_id: str
    current_efficiency: float
    predicted_efficiency: float
    expected_improvement_percent: float
    suggestions: list[dict[str, Any]]
    warnings: list[str]
    timestamp: datetime


class HealthResponse(BaseModel):
    """Response model for health check."""

    status: str
    version: str
    timestamp: datetime
    models_loaded: dict[str, bool]
    uptime_seconds: float


# Global state
_start_time = time.time()
_inference_engine: InferenceEngine | None = None
_cache: PredictionCache | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global _inference_engine, _cache

    logger.info("Starting Prometheus AI server...")

    # Initialize inference engine
    config = get_config()
    _inference_engine = InferenceEngine(config)
    await _inference_engine.initialize()

    # Initialize cache
    _cache = PredictionCache(config.redis)
    await _cache.connect()

    logger.info("Prometheus AI server ready")

    yield

    # Cleanup
    logger.info("Shutting down Prometheus AI server...")
    if _cache:
        await _cache.close()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    config = get_config()

    app = FastAPI(
        title="Prometheus AI",
        description="Mining Pool Prediction and Optimization API",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.serving.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request timing middleware
    @app.middleware("http")
    async def add_timing_header(request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration = time.time() - start
        response.headers["X-Response-Time"] = f"{duration:.3f}s"
        return response

    # Exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )

    # Health check endpoint
    @app.get("/health", response_model=HealthResponse, tags=["Health"])
    async def health_check() -> HealthResponse:
        """Check service health and model status."""
        models_loaded = {}
        if _inference_engine:
            models_loaded = _inference_engine.get_model_status()

        return HealthResponse(
            status="healthy",
            version="0.1.0",
            timestamp=datetime.now(),
            models_loaded=models_loaded,
            uptime_seconds=time.time() - _start_time,
        )

    @app.get("/health/ready", tags=["Health"])
    async def readiness_check() -> dict[str, str]:
        """Kubernetes readiness probe."""
        if _inference_engine is None or not _inference_engine.is_ready():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service not ready",
            )
        return {"status": "ready"}

    @app.get("/health/live", tags=["Health"])
    async def liveness_check() -> dict[str, str]:
        """Kubernetes liveness probe."""
        return {"status": "alive"}

    # Earnings prediction endpoint
    @app.post(
        "/api/v1/predict/earnings",
        response_model=EarningsPredictionResponse,
        tags=["Predictions"],
    )
    async def predict_earnings(
        request: EarningsPredictionRequest,
    ) -> EarningsPredictionResponse:
        """
        Predict future earnings for a mining worker.

        Uses LSTM with attention mechanism to forecast earnings
        for the next 24 hours based on historical data.
        """
        if _inference_engine is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Inference engine not initialized",
            )

        # Check cache
        if _cache:
            cached = await _cache.get_prediction(
                model_type="earnings",
                key=request.worker_id,
            )
            if cached:
                logger.debug(f"Cache hit for earnings prediction: {request.worker_id}")
                return EarningsPredictionResponse(**cached)

        try:
            features = np.array(request.features, dtype=np.float32)
            result = await _inference_engine.predict_earnings(
                features=features,
                confidence_level=request.confidence_level,
            )

            response = EarningsPredictionResponse(
                worker_id=request.worker_id,
                predicted_earnings=result.predicted_earnings,
                confidence_score=result.confidence_score,
                prediction_interval_lower=result.prediction_interval_lower,
                prediction_interval_upper=result.prediction_interval_upper,
                hourly_breakdown=result.hourly_breakdown,
                timestamp=datetime.now(),
            )

            # Cache result
            if _cache:
                await _cache.set_prediction(
                    model_type="earnings",
                    key=request.worker_id,
                    value=response.model_dump(),
                )

            return response

        except Exception as e:
            logger.error(f"Earnings prediction failed: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Prediction failed: {str(e)}",
            )

    # Difficulty prediction endpoint
    @app.post(
        "/api/v1/predict/difficulty",
        response_model=DifficultyPredictionResponse,
        tags=["Predictions"],
    )
    async def predict_difficulty(
        request: DifficultyPredictionRequest,
    ) -> DifficultyPredictionResponse:
        """
        Predict future mining difficulty.

        Uses NeuralProphet for time series forecasting of
        network difficulty adjustments.
        """
        if _inference_engine is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Inference engine not initialized",
            )

        # Check cache
        cache_key = f"difficulty_{request.periods}"
        if _cache:
            cached = await _cache.get_prediction(
                model_type="difficulty",
                key=cache_key,
            )
            if cached:
                return DifficultyPredictionResponse(**cached)

        try:
            predictions = await _inference_engine.predict_difficulty(
                periods=request.periods,
                include_components=request.include_components,
            )

            response = DifficultyPredictionResponse(
                predictions=predictions,
                timestamp=datetime.now(),
            )

            # Cache with longer TTL for difficulty predictions
            if _cache:
                await _cache.set_prediction(
                    model_type="difficulty",
                    key=cache_key,
                    value=response.model_dump(),
                    ttl=3600,  # 1 hour
                )

            return response

        except Exception as e:
            logger.error(f"Difficulty prediction failed: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Prediction failed: {str(e)}",
            )

    # Anomaly detection endpoint
    @app.post(
        "/api/v1/sentinel/detect",
        response_model=AnomalyDetectionResponse,
        tags=["Sentinel"],
    )
    async def detect_anomaly(
        request: AnomalyDetectionRequest,
    ) -> AnomalyDetectionResponse:
        """
        Detect anomalies in mining operations.

        Uses ensemble anomaly detection (Isolation Forest, LOF, KNN)
        to identify suspicious patterns and potential threats.
        """
        if _inference_engine is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Inference engine not initialized",
            )

        try:
            features = np.array(request.features, dtype=np.float32)
            result = await _inference_engine.detect_anomaly(
                features=features,
                threshold=request.threshold,
            )

            return AnomalyDetectionResponse(
                is_anomaly=result.is_anomaly,
                threat_type=result.threat_type.value,
                severity=result.severity.value,
                confidence=result.confidence,
                anomaly_score=result.anomaly_score,
                contributing_factors=result.contributing_factors,
                timestamp=datetime.now(),
            )

        except Exception as e:
            logger.error(f"Anomaly detection failed: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Detection failed: {str(e)}",
            )

    # Worker optimization endpoint
    @app.post(
        "/api/v1/optimize/worker",
        response_model=OptimizationResponse,
        tags=["Optimization"],
    )
    async def optimize_worker(
        request: OptimizationRequest,
    ) -> OptimizationResponse:
        """
        Get optimization suggestions for a mining worker.

        Analyzes hardware profile and provides recommendations
        for improving efficiency, profitability, or longevity.
        """
        if _inference_engine is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Inference engine not initialized",
            )

        try:
            result = await _inference_engine.optimize_worker(
                hardware_profile=request.model_dump(),
                optimization_target=request.optimization_target,
            )

            return OptimizationResponse(
                worker_id=result.worker_id,
                current_efficiency=result.current_efficiency,
                predicted_efficiency=result.predicted_efficiency,
                expected_improvement_percent=result.expected_improvement_percent,
                suggestions=[
                    {
                        "parameter": s.parameter,
                        "current_value": s.current_value,
                        "suggested_value": s.suggested_value,
                        "expected_impact": s.expected_impact,
                        "confidence": s.confidence,
                        "priority": s.priority,
                        "risk_level": s.risk_level,
                    }
                    for s in result.suggestions
                ],
                warnings=result.warnings,
                timestamp=datetime.now(),
            )

        except Exception as e:
            logger.error(f"Worker optimization failed: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Optimization failed: {str(e)}",
            )

    return app


# Create default app instance
app = create_app()


def main() -> None:
    """Run the API server."""
    import uvicorn

    config = get_config()

    uvicorn.run(
        "prometheus.serving.api:app",
        host=config.serving.host,
        port=config.serving.port,
        workers=config.serving.workers,
        reload=config.serving.reload,
        log_level=config.serving.log_level,
    )


if __name__ == "__main__":
    main()
