/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { BrowserWindow, dialog, ipcMain } = require("electron");

const TRIAL_DAYS = 30;

function checksumSeed(input) {
  const sum = [...input].reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 17), 0);
  return (sum % 1679616).toString(36).toUpperCase().padStart(4, "0").slice(-4);
}

function validateLicenseKeyFormat(key) {
  const normalized = String(key || "").trim().toUpperCase();
  const parts = normalized.split("-");
  if (parts.length !== 4 || parts[0] !== "PULSE") return false;
  if (!parts.slice(1).every((part) => /^[A-Z0-9]{4}$/.test(part))) return false;
  const expected = checksumSeed(`${parts[0]}-${parts[1]}-${parts[2]}`);
  return expected === parts[3];
}

function getLicensePath(userDataPath) {
  return path.join(userDataPath, "license.json");
}

function readLicenseState(userDataPath) {
  const licensePath = getLicensePath(userDataPath);
  try {
    const raw = fs.readFileSync(licensePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeLicenseState(userDataPath, state) {
  const licensePath = getLicensePath(userDataPath);
  fs.mkdirSync(path.dirname(licensePath), { recursive: true });
  fs.writeFileSync(licensePath, JSON.stringify(state, null, 2), "utf-8");
}

function getLicenseStatus(userDataPath) {
  const state = readLicenseState(userDataPath);
  const firstLaunchAt = state.firstLaunchAt || new Date().toISOString();

  if (!state.firstLaunchAt) {
    state.firstLaunchAt = firstLaunchAt;
    writeLicenseState(userDataPath, state);
  }

  const isLicensed = Boolean(state.licenseKey && validateLicenseKeyFormat(state.licenseKey));
  const elapsedMs = Math.max(0, Date.now() - Date.parse(firstLaunchAt));
  const trialDaysUsed = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.max(0, TRIAL_DAYS - trialDaysUsed);
  const trialExpired = daysRemaining <= 0;

  return {
    isLicensed,
    trialExpired,
    daysRemaining,
    state,
  };
}

async function validateWithEndpoint(key) {
  const endpoint = process.env.PULSE_LICENSE_ENDPOINT;
  if (!endpoint) return true;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return body.valid === true;
  } catch {
    return false;
  }
}

async function showLicensePrompt(userDataPath, status) {
  return new Promise((resolve) => {
    const query = new URLSearchParams({
      daysRemaining: String(status.daysRemaining),
      trialExpired: status.trialExpired ? "1" : "0",
    });

    const win = new BrowserWindow({
      width: 560,
      height: 440,
      title: "Pulse License",
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "licensePreload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const cleanup = () => {
      ipcMain.removeListener("pulse-license:submit", onSubmit);
      ipcMain.removeListener("pulse-license:continue-trial", onContinue);
      ipcMain.removeListener("pulse-license:quit", onQuit);
      if (!win.isDestroyed()) win.close();
    };

    const fail = async (message) => {
      await dialog.showMessageBox(win, {
        type: "error",
        title: "Invalid License",
        message,
      });
    };

    const onSubmit = async (_event, rawKey) => {
      const key = String(rawKey || "").trim().toUpperCase();
      if (!validateLicenseKeyFormat(key)) {
        await fail("License key format is invalid.");
        return;
      }

      const remoteValid = await validateWithEndpoint(key);
      if (!remoteValid) {
        await fail("License validation failed.");
        return;
      }

      const next = {
        ...status.state,
        licenseKey: key,
        validatedAt: new Date().toISOString(),
      };
      writeLicenseState(userDataPath, next);
      cleanup();
      resolve(true);
    };

    const onContinue = () => {
      if (status.trialExpired) return;
      cleanup();
      resolve(true);
    };

    const onQuit = () => {
      cleanup();
      resolve(false);
    };

    ipcMain.on("pulse-license:submit", onSubmit);
    ipcMain.on("pulse-license:continue-trial", onContinue);
    ipcMain.on("pulse-license:quit", onQuit);

    win.on("closed", () => resolve(false));
    win.loadFile(path.join(__dirname, "licensePrompt.html"), { query: Object.fromEntries(query) });
  });
}

async function ensureLicensedOrTrial(userDataPath) {
  const status = getLicenseStatus(userDataPath);
  if (status.isLicensed) return true;
  return showLicensePrompt(userDataPath, status);
}

module.exports = {
  ensureLicensedOrTrial,
  getLicenseStatus,
  validateLicenseKeyFormat,
};
