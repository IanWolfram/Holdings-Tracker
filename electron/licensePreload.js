/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pulseLicense", {
  submitKey: (key) => ipcRenderer.send("pulse-license:submit", key),
  continueTrial: () => ipcRenderer.send("pulse-license:continue-trial"),
  quitApp: () => ipcRenderer.send("pulse-license:quit"),
});
