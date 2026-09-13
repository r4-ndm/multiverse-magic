#!/usr/bin/env bash
set -e

# ========================================================================
# Multiverse Magic — Agent Auto-Join Script
# This script starts the services if needed and opens the browser for the user.
# ========================================================================

HOST_URL="${1:-http://localhost:3000}"

echo "🌌 [Multiverse Magic Agent Launcher]"
echo "📡 Target Universe: $HOST_URL"

# 1. If pointing to localhost, check if server & client are running
if [[ "$HOST_URL" == *"localhost"* || "$HOST_URL" == *"127.0.0.1"* ]]; then
  if ! curl -s http://localhost:2567/health > /dev/null 2>&1; then
    echo "⚡ Starting background universe server & client..."
    nohup npm run dev > dev.log 2>&1 &
    sleep 3
  else
    echo "✓ Universe server is already live on port 2567."
  fi
fi

# 2. Open the user's browser automatically
echo "🚀 Launching cockpit browser..."

if command -v xdg-open > /dev/null 2>&1; then
  xdg-open "$HOST_URL" > /dev/null 2>&1 &
elif command -v open > /dev/null 2>&1; then
  open "$HOST_URL"
elif command -v sensible-browser > /dev/null 2>&1; then
  sensible-browser "$HOST_URL" > /dev/null 2>&1 &
elif command -v brave-browser > /dev/null 2>&1; then
  brave-browser "$HOST_URL" > /dev/null 2>&1 &
elif command -v google-chrome > /dev/null 2>&1; then
  google-chrome "$HOST_URL" > /dev/null 2>&1 &
else
  echo "⚠️ Could not auto-launch browser. Please open: $HOST_URL"
fi

echo "=========================================================="
echo "🎉 Cockpit launched! Click 'CLICK TO ENTER SPACE' & grant mic."
echo "=========================================================="
