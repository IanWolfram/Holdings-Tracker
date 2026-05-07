/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pulseMode", {
  choose: (mode) => ipcRenderer.send("pulse-mode:choose", mode),
  quit: () => ipcRenderer.send("pulse-mode:quit"),
});