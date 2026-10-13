#!/usr/bin/env bash
# FreeAI — Antigravity Linux Desktop Launcher
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "========================================================"
echo "          Starting FreeAI (Antigravity Linux)          "
echo "========================================================"
echo "Headless Browser Engine: Active (DeepSeek, Gemini, ChatGPT)"
echo "Port: 1111"
echo "Directory: $DIR"
echo ""

# Ensure build is up to date if dist doesn't exist
if [ ! -d "dist/main" ] || [ ! -d "dist/renderer" ]; then
    echo "Dist directory not found. Building project..."
    npm run build
fi

# Launch Electron application with Linux sandbox compatibility and production mode
export ELECTRON_DISABLE_SANDBOX=1
export NODE_ENV=production
export PORT=1111
npx electron . --no-sandbox --disable-gpu "$@"
