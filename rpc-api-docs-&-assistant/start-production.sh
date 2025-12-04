#!/bin/bash

# VIDDHANA RPC API Docs - Production Startup Script

APP_DIR="/home/realcodes/Chocochoco/rpc-api-docs-&-assistant"
PORT=3002
LOG_FILE="/tmp/rpc-docs-prod.log"

echo "Starting VIDDHANA RPC API Documentation..."

# Kill existing process
pkill -9 -f "http-server.*$PORT"
sleep 1

# Build fresh
cd "$APP_DIR"
echo "Building production..."
npm run build

# Create empty index.css if missing
if [ ! -f "$APP_DIR/dist/index.css" ]; then
    echo "/* Generated CSS */" > "$APP_DIR/dist/index.css"
fi

# Start http-server
cd "$APP_DIR/dist"
nohup npx -y http-server -p $PORT --cors -c-1 > "$LOG_FILE" 2>&1 &

sleep 2

# Check if started
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "✅ Server started successfully on port $PORT"
    echo "📍 Local: http://localhost:$PORT"
    echo "🌐 Public: https://docs.viddhana.com"
    echo "📝 Logs: tail -f $LOG_FILE"
else
    echo "❌ Failed to start server"
    exit 1
fi
