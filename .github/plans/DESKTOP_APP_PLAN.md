# Pulse — Desktop App Build Plan

Convert the Next.js app into a signed, distributable desktop app using **Electron** + **electron-builder**.

## Platform targets

| Platform | Installer | AI support |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` | Local MLX + API models |
| macOS (Intel) | `.dmg` | API models only |
| Windows 10/11 | `.exe` NSIS installer | API models only |
| Linux (Ubuntu/Debian) | `.AppImage` | API models only |

---

## Phase 1 — Electron shell

**Goal:** wrap the running Next.js server in an Electron window.

1. Install dependencies:
   ```
   npm install --save-dev electron electron-builder concurrently wait-on
   ```

2. Create `electron/main.ts` — the Electron main process:
   - On `app.ready`, spawn `next start` as a child process on a fixed port (e.g. `3571`)
   - Wait for the server to be healthy (`wait-on http://localhost:3571`), then open a `BrowserWindow` loading `http://localhost:3571`
   - On `app.quit`, kill the Next.js child process cleanly
   - Set a sensible window size (1280×800 min), title "Pulse", and app icon

3. Update `package.json`:
   - Add `"main": "electron/main.js"` field
   - Add scripts:
     ```
     "electron:dev":   "concurrently \"next dev -p 3571\" \"wait-on http://localhost:3571 && electron .\"",
     "electron:build": "next build && electron-builder"
     ```

4. Move `.env.local` paths to Electron `app.getPath('userData')` so config survives app updates:
   - At startup, copy `.env.local` / `.ai-config.json` to `userData` if not already present
   - Point `lib/ai-config.ts` config paths to `userData` when running inside Electron (detect via `process.versions.electron`)

---

## Phase 2 — electron-builder config

Create `electron-builder.config.js` at project root:

```js
module.exports = {
  appId: "com.pulse.holdings",
  productName: "Pulse",
  directories: { output: "dist-electron" },
  files: [
    ".next/**/*",
    "public/**/*",
    "world-brain/**/*",
    "electron/**/*",
    "package.json",
    "next.config.*"
  ],
  extraResources: [
    { from: "scripts/mlx-server.sh", to: "scripts/mlx-server.sh" }
  ],
  mac: {
    target: [{ target: "dmg", arch: ["arm64", "x64"] }],
    category: "public.app-category.finance",
    icon: "public/icon.icns",
    hardenedRuntime: true,
    entitlements: "build/entitlements.mac.plist"
  },
  win: {
    target: "nsis",
    icon: "public/icon.ico"
  },
  linux: {
    target: "AppImage",
    icon: "public/icon.png"
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  }
};
```

---

## Phase 3 — License key gating (monetization)

1. Add `electron/license.ts`:
   - On first launch, show a license key prompt before the main window
   - Validate key format locally (checksum) + optionally ping a validation endpoint
   - Store validated key in `app.getPath('userData')/license.json`
   - 30-day trial: store first-launch timestamp, allow full access until expiry

2. Gate premium features server-side (inside the Next.js API routes) by reading the license file — this prevents bypassing the gate by pointing a browser at localhost.

---

## Phase 4 — Icons and assets

Required before building:
- `public/icon.icns` — macOS (1024×1024, use `iconutil` or `electron-icon-builder`)
- `public/icon.ico` — Windows (256×256 multi-res)
- `public/icon.png` — Linux (512×512)
- `build/entitlements.mac.plist` — required for macOS hardened runtime + notarization

---

## Phase 5 — Code signing & notarization

### macOS
- Requires Apple Developer account ($99/yr)
- Set env vars: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- electron-builder handles notarization automatically when these are set
- Without signing: users see "unidentified developer" warning (Gatekeeper)

### Windows
- Optional but recommended: EV code signing cert (~$300/yr) eliminates SmartScreen warning
- Without signing: Windows shows "Unknown publisher" warning on first run

---

## Phase 6 — Distribution

Options (cheapest first):

| Option | Cost | Notes |
|---|---|---|
| **Gumroad** | 10% fee | Simplest. Upload `.dmg` + `.exe` + `.AppImage` as separate files per purchase |
| **Paddle** | ~5% fee | Better for SaaS/subscriptions, handles VAT automatically |
| **GitHub Releases** | Free | Open source or manual gating. CI uploads artifacts via `gh release create` |
| **Self-hosted S3 + CloudFront** | ~$5/mo | Full control, add auto-update feed |

For auto-updates, electron-builder supports `electron-updater` — point it at a GitHub Release or S3 bucket for delta updates.

---

## Execution order

```
Phase 1 → Phase 2 → Phase 4 → Phase 3 → Phase 5 → Phase 6
```

Phase 3 (licensing) can be skipped for a free/open release.
Phase 5 (signing) can be skipped for early beta — just warn users about the security prompt.

---

## Notes for the agent

- The Next.js server **must** run as a spawned process inside Electron — do not attempt a static export (`next export`) as the app uses API routes.
- The MLX server script (`scripts/mlx-server.sh`) is Mac-only. On Windows/Linux, hide the "Local MLX" option in `AIEngineSelector.tsx` if `process.platform !== 'darwin'` or no Apple Silicon detected.
- All file system paths that currently use `process.cwd()` (`.ai-config.json`, `.env.local`, vault path) must be migrated to `app.getPath('userData')` so they survive app updates and work on Windows.
- The `world-vault/` Obsidian directory should remain user-configurable via a folder picker, not bundled.
