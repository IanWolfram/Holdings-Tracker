#!/bin/bash
# SwiftBar plugin: toggle the Pulse pm2 processes from the macOS menu bar.
# Symlinked into ~/.swiftbar/plugins; the ".15s" in the filename is the refresh
# interval. Docs: https://github.com/swiftbar/SwiftBar
#
# <xbar.title>Pulse Worker</xbar.title>
# <xbar.desc>Start/stop the Pulse headless worker and UI (pm2), toggle UI dev/prod</xbar.desc>

# SwiftBar runs plugins without a login shell, so PATH must be explicit
# (pm2/node live under nvm).
export PATH="/Users/ianwolf/.nvm/versions/node/v24.14.1/bin:/usr/local/bin:/usr/bin:/bin"
APP_DIR="/Users/ianwolf/Holdings-Tracker"
SELF="$0"

# ── Click actions (invoked as: pulse.15s.sh <action>) ──
case "$1" in
  start-worker)  cd "$APP_DIR" && pm2 start ecosystem.config.cjs --only pulse-worker; exit ;;
  stop-worker)   pm2 stop pulse-worker; exit ;;
  restart-worker) pm2 restart pulse-worker; exit ;;
  stop-ui)       pm2 stop pulse 2>/dev/null; pm2 stop pulse-dev 2>/dev/null; exit ;;
  # Prod switch builds FIRST — if the build fails, whatever is running stays up.
  ui-prod)
    cd "$APP_DIR" || exit 1
    npm run build && { pm2 delete pulse-dev 2>/dev/null; pm2 start ecosystem.config.cjs --only pulse; }
    echo; echo "Done — you can close this window."
    exit ;;
  ui-dev)
    cd "$APP_DIR" || exit 1
    pm2 delete pulse 2>/dev/null
    pm2 start ecosystem.config.cjs --only pulse-dev
    exit ;;
  # Ship code changes to the running prod UI: rebuild, then restart in place.
  deploy)
    cd "$APP_DIR" || exit 1
    npm run build && pm2 restart pulse
    echo; echo "Done — you can close this window."
    exit ;;
esac

# ── Status ──
# pm2 jlist can prefix JSON with daemon-boot noise; slice from the first "[".
statuses=$(pm2 jlist 2>/dev/null | node -e '
let d = "";
process.stdin.on("data", (c) => (d += c)).on("end", () => {
  let worker = "absent", prod = "absent", dev = "absent";
  try {
    const arr = JSON.parse(d.slice(d.indexOf("[")));
    for (const p of arr) {
      if (p.name === "pulse-worker") worker = p.pm2_env.status;
      if (p.name === "pulse") prod = p.pm2_env.status;
      if (p.name === "pulse-dev") dev = p.pm2_env.status;
    }
  } catch {}
  console.log(worker + " " + prod + " " + dev);
})' 2>/dev/null)
read -r WORKER PROD DEV <<< "$statuses"
[ -z "$WORKER" ] && WORKER="unknown"
[ -z "$PROD" ] && PROD="unknown"
[ -z "$DEV" ] && DEV="unknown"

# ── Menu bar icon: green pulse when digesting, gray when idle ──
if [ "$WORKER" = "online" ]; then
  echo "| sfimage=waveform.path.ecg sfcolor=#34c759"
else
  echo "| sfimage=waveform.path.ecg sfcolor=#8e8e93"
fi

echo "---"
if [ "$WORKER" = "online" ]; then
  echo "Worker: digesting news | color=#34c759"
  echo "Stop Worker | bash='$SELF' param1=stop-worker terminal=false refresh=true"
  echo "Restart Worker | bash='$SELF' param1=restart-worker terminal=false refresh=true"
else
  echo "Worker: $WORKER | color=#8e8e93"
  echo "Start Worker | bash='$SELF' param1=start-worker terminal=false refresh=true"
fi

echo "---"
if [ "$PROD" = "online" ]; then
  echo "UI: running (prod) | color=#34c759"
  echo "Open Dashboard | href=http://localhost:3000/terminal"
  echo "Rebuild + Restart (ship changes) | bash='$SELF' param1=deploy terminal=true refresh=true"
  echo "Switch to Dev Mode | bash='$SELF' param1=ui-dev terminal=false refresh=true"
  echo "Stop UI | bash='$SELF' param1=stop-ui terminal=false refresh=true"
elif [ "$DEV" = "online" ]; then
  echo "UI: running (dev, hot reload) | color=#ff9f0a"
  echo "Open Dashboard | href=http://localhost:3000/terminal"
  echo "Switch to Prod Mode (builds first, ~2 min) | bash='$SELF' param1=ui-prod terminal=true refresh=true"
  echo "Stop UI | bash='$SELF' param1=stop-ui terminal=false refresh=true"
else
  echo "UI: stopped | color=#8e8e93"
  echo "Start UI — Prod (builds first, ~2 min) | bash='$SELF' param1=ui-prod terminal=true refresh=true"
  echo "Start UI — Dev (hot reload) | bash='$SELF' param1=ui-dev terminal=false refresh=true"
fi

echo "---"
echo "View Logs (Terminal) | bash=/Users/ianwolf/.nvm/versions/node/v24.14.1/bin/pm2 param1=logs terminal=true"
