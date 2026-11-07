const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");

let mainWindow;

function resolveAddress(input) {
  const value = String(input || "").trim();
  if (!value) throw new Error("Введи запрос или адрес сайта.");
  const shortcuts = {
    google: "https://www.google.com",
    youtube: "https://www.youtube.com",
    yt: "https://www.youtube.com",
    gmail: "https://mail.google.com",
    drive: "https://drive.google.com",
    maps: "https://maps.google.com",
    wikipedia: "https://ru.wikipedia.org",
    telegram: "https://web.telegram.org",
    "x.com": "https://x.com",
  };
  if (shortcuts[value.toLowerCase()]) return shortcuts[value.toLowerCase()];
  let url;
  if (/^https?:\/\//i.test(value)) url = new URL(value);
  else if (/^[\w-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value)) url = new URL(`https://${value}`);
  else url = new URL(`https://www.google.com/search?q=${encodeURIComponent(value)}`);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Разрешены только сайты HTTP и HTTPS.");
  return url.toString();
}

function isWebUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 360,
    minHeight: 560,
    title: "X Browser",
    frame: false,
    backgroundColor: "#08090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "browser.html"));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.on("web-contents-created", (_event, contents) => {
  if (contents.getType() !== "webview") return;
  contents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) mainWindow?.webContents.send("browser:open-popup", url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, destination) => {
    if (!isWebUrl(destination)) event.preventDefault();
  });
});

ipcMain.handle("browser:resolve", (_event, value) => {
  try { return { ok: true, url: resolveAddress(value) }; }
  catch (error) { return { ok: false, error: error.message || "Не удалось разобрать адрес." }; }
});
ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:maximize", () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.handle("window:close", () => mainWindow?.close());

app.whenReady().then(createWindow);
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
