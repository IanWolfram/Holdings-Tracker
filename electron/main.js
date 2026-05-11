/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const waitOn = require("wait-on");
const { ensureLicensedOrTrial } = require("./license");

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

async function startNextServer() {
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

function createMainWindow() {
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

  // Always start at /login — auth is required
  win.loadURL(`http://localhost:${PORT}/login`);
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
    createMainWindow();
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

    await startNextServer();
    createMainWindow();
  } catch (err) {
    console.error("[electron] Startup failed:", err);
    app.quit();
  }
});