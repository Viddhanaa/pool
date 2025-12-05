# Prometheus AI - Model Serving Dockerfile
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1000 prometheus \
    && useradd --uid 1000 --gid prometheus --shell /bin/bash --create-home prometheus

# Install Python dependencies
FROM base as builder

COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# Production image
FROM base as production

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY --chown=prometheus:prometheus . /app

# Create directories for models and data
RUN mkdir -p /app/models /app/data /app/logs \
    && chown -R prometheus:prometheus /app

# Switch to non-root user
USER prometheus

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Default command
CMD ["python", "-m", "prometheus.serving.api"]

# Alternative: run with uvicorn directly
# CMD ["uvicorn", "prometheus.serving.api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
