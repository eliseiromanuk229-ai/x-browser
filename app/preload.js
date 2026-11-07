const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("xBrowser", {
  resolveAddress: value => ipcRenderer.invoke("browser:resolve", value),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  onOpenPopup: callback => ipcRenderer.on("browser:open-popup", (_event, url) => callback(url)),
});
