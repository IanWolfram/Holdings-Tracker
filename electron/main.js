/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const waitOn = require("wait-on");
const { ensureLicensedOrTrial } = require("./license");
const { ensureModeChosen } = require("./mode");

const APP_TITLE = "Pulse";
app.name = APP_TITLE;
const PORT = 3571;
let nextProcess = null;

function appRootPath() {
  return path.resolve(__dirname, "..");
}

function userDataPath() {
  return app.getPath("userData");
}

function iconPath() {
  return path.join(appRootPath(), "public", "icon.png");
}

function parseEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.split(/\r?\n/);
    const values = {};
    for (const line of lines) {
      if (!line || line.trim().startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index <= 0) continue;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      if (!key) continue;
      values[key] = value;
    }
    return values;
  } catch {
    return {};
  }
}

function ensureUserDataConfigFiles() {
  const root = appRootPath();
  const userData = userDataPath();
  const files = [".env.local", ".ai-config.json"];

  for (const name of files) {
    const source = path.join(root, name);
    const target = path.join(userData, name);

    if (!fs.existsSync(target) && fs.existsSync(source)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
  }

  return {
    envPath: path.join(userData, ".env.local"),
  };
}

async function startNextServer(mode) {
  const root = appRootPath();
  const userData = userDataPath();
  const { envPath } = ensureUserDataConfigFiles();
  const fileEnv = parseEnvFile(envPath);

  const nextBin = require.resolve("next/dist/bin/next");
  const env = {
    ...process.env,
    ...fileEnv,
    NODE_ENV: process.env.NODE_ENV || "production",
    PULSE_DESKTOP: "1",
    PULSE_USER_DATA_PATH: userData,
    // Personal Mode: single-user, no auth. Cloud Mode: full auth.
    PULSE_SINGLE_USER_MODE: mode === "personal" ? "1" : "0",
  };

  process.env = env;

  nextProcess = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    cwd: root,
    env,
    stdio: "pipe",
  });

  nextProcess.stdout.on("data", (chunk) => {
    process.stdout.write(`[next] ${chunk}`);
  });

  nextProcess.stderr.on("data", (chunk) => {
    process.stderr.write(`[next] ${chunk}`);
  });

  nextProcess.on("exit", (code, signal) => {
    nextProcess = null;
    console.info(`[electron] Next.js exited (code=${code}, signal=${signal})`);
  });

  await waitOn({
    resources: [`http://localhost:${PORT}`],
    timeout: 120000,
  });
}

function createMainWindow(mode) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 800,
    title: APP_TITLE,
    icon: fs.existsSync(iconPath()) ? iconPath() : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Personal Mode goes straight to /world. Cloud Mode starts at /login.
  const startPath = mode === "personal" ? "/world" : "/login";
  win.loadURL(`http://localhost:${PORT}${startPath}`);
}

function stopNextServer() {
  if (!nextProcess || nextProcess.killed) return;
  nextProcess.kill("SIGTERM");
}

app.on("before-quit", () => {
  stopNextServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const mode = ensureModeChosen(userDataPath());
    // In practice, the mode is already chosen at this point since
    // it was persisted. This is a fallback for macOS dock click.
    createMainWindow(typeof mode === "string" ? mode : "personal");
  }
});

app.whenReady().then(async () => {
  if (process.platform === "darwin" && app.dock) {
    app.dock.setTitle(APP_TITLE);
  }

  try {
    const allowed = await ensureLicensedOrTrial(userDataPath());
    if (!allowed) {
      app.quit();
      return;
    }

    const mode = await ensureModeChosen(userDataPath());
    if (!mode) {
      app.quit();
      return;
    }

    await startNextServer(mode);
    createMainWindow(mode);
  } catch (err) {
    console.error("[electron] Startup failed:", err);
    app.quit();
  }
});