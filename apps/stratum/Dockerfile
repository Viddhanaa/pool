# Build stage
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /build

# Copy go mod files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.version=$(git describe --tags --always --dirty 2>/dev/null || echo 'dev')" \
    -o stratum-server \
    ./cmd/stratum

# Runtime stage
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 stratum && \
    adduser -u 1000 -G stratum -s /bin/sh -D stratum

# Create necessary directories
RUN mkdir -p /app/configs /var/log/stratum && \
    chown -R stratum:stratum /app /var/log/stratum

# Copy binary from builder
COPY --from=builder /build/stratum-server /app/stratum-server

# Copy default config
COPY --from=builder /build/configs/config.yaml /app/configs/config.yaml

# Set working directory
WORKDIR /app

# Switch to non-root user
USER stratum

# Expose ports
# 3333 - Stratum mining port
# 9090 - Prometheus metrics
EXPOSE 3333 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9090/health || exit 1

# Set entrypoint
ENTRYPOINT ["/app/stratum-server"]

# Default command arguments
CMD ["-config", "/app/configs/config.yaml"]
