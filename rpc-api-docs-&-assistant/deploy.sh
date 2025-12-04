#!/bin/bash

# Deploy RPC API Documentation to production
# Domain: https://docs.viddhana.com

set -e

echo "🚀 Deploying RPC API Documentation..."
echo "Domain: https://docs.viddhana.com"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Load environment variables if .env exists
if [ -f "$SCRIPT_DIR/.env.local" ]; then
    echo "📝 Loading environment variables from .env.local"
    export $(grep -v '^#' "$SCRIPT_DIR/.env.local" | xargs)
fi

# Build and start the rpc-api-docs service
echo "🔨 Building RPC API docs container..."
docker compose build rpc-api-docs

echo "🚀 Starting RPC API docs service..."
docker compose --profile app up -d rpc-api-docs

echo ""
echo "✅ RPC API Documentation deployed successfully!"
echo ""
echo "📍 Local URL: http://localhost:3002"
echo "🌐 Public URL: https://docs.viddhana.com"
echo ""
echo "To view logs:"
echo "  docker compose logs -f rpc-api-docs"
echo ""
echo "To stop:"
echo "  docker compose stop rpc-api-docs"
echo ""
echo "To restart:"
echo "  docker compose restart rpc-api-docs"
