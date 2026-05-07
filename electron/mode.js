/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { BrowserWindow, ipcMain } = require("electron");

function getModePath(userDataPath) {
  return path.join(userDataPath, "pulse-mode.json");
}

function readMode(userDataPath) {
  try {
    const raw = fs.readFileSync(getModePath(userDataPath), "utf-8");
    const data = JSON.parse(raw);
    if (data.mode === "personal" || data.mode === "cloud") return data.mode;
  } catch {
    // File doesn't exist or is invalid — first launch
  }
  return null;
}

function writeMode(userDataPath, mode) {
  const modePath = getModePath(userDataPath);
  fs.mkdirSync(path.dirname(modePath), { recursive: true });
  fs.writeFileSync(modePath, JSON.stringify({ mode, chosenAt: new Date().toISOString() }, null, 2), "utf-8");
}

/**
 * Show a one-time mode chooser if the user hasn't picked one yet.
 * Returns "personal" or "cloud". Returns false if the user quit.
 */
async function promptForMode(userDataPath) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 580,
      height: 420,
      title: "Pulse",
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "modePreload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const cleanup = () => {
      ipcMain.removeListener("pulse-mode:choose", onChoose);
      ipcMain.removeListener("pulse-mode:quit", onQuit);
      if (!win.isDestroyed()) win.close();
    };

    const onChoose = (_event, mode) => {
      if (mode !== "personal" && mode !== "cloud") return;
      writeMode(userDataPath, mode);
      cleanup();
      resolve(mode);
    };

    const onQuit = () => {
      cleanup();
      resolve(false);
    };

    ipcMain.on("pulse-mode:choose", onChoose);
    ipcMain.on("pulse-mode:quit", onQuit);

    win.on("closed", () => resolve(false));
    win.loadFile(path.join(__dirname, "modePrompt.html"));
  });
}

/**
 * Returns the stored mode, or prompts the user if none is set.
 * Returns "personal", "cloud", or false (user quit).
 */
async function ensureModeChosen(userDataPath) {
  const stored = readMode(userDataPath);
  if (stored) return stored;
  return promptForMode(userDataPath);
}

module.exports = { ensureModeChosen, readMode, writeMode };