#!/usr/bin/env bash
set -euo pipefail
export DISPLAY=:99
Xvfb :99 -screen 0 430x860x24 -ac -nolisten tcp +extension RANDR &
XVFB_PID=$!
trap 'kill "$XVFB_PID" 2>/dev/null || true' EXIT
for n in {1..30}; do if [ -e /tmp/.X11-unix/X99 ]; then break; fi; sleep 0.2; done
x11vnc -display :99 -rfbport 5900 -listen 127.0.0.1 -nopw -forever -shared -noxdamage -quiet -nosel -noprimary &
exec node /app/server.js
