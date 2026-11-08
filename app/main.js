const { app, BrowserWindow, ipcMain, net } = require("electron");
const path = require("node:path");

let mainWindow;
const AI_WORKER_URL = "https://wild-meadow-76d1.phujna56.workers.dev";

function resolveAddress(input) {
  const value = String(input || "").trim();
  if (!value) throw new Error("Введи запрос или адрес сайта.");
  const shortcuts = {
    youtube: "https://www.youtube.com",
    yt: "https://www.youtube.com",
    gmail: "https://mail.google.com",
    drive: "https://drive.google.com",
    maps: "https://maps.google.com",
    wikipedia: "https://ru.wikipedia.org",
    telegram: "https://web.telegram.org",
    "x.com": "https://x.com",
  };
  if (shortcuts[value.toLowerCase()]) return { kind: "web", url: shortcuts[value.toLowerCase()] };
  let url;
  if (/^https?:\/\//i.test(value)) url = new URL(value);
  else if (/^[\w-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value)) url = new URL(`https://${value}`);
  else return { kind: "search", query: value };
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Разрешены только сайты HTTP и HTTPS.");
  return { kind: "web", url: url.toString() };
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
  try { return { ok: true, ...resolveAddress(value) }; }
  catch (error) { return { ok: false, error: error.message || "Не удалось разобрать адрес." }; }
});
ipcMain.handle("browser:search", async (_event, query) => {
  const value = String(query || "").trim().slice(0, 400);
  if (!value) return { ok: false, error: "Введите запрос для поиска." };
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(value)}`;
    const response = await net.fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 XBrowser/1.0", "Accept": "text/html" },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Поиск вернул ошибку ${response.status}.`);
    return { ok: true, html: await response.text() };
  } catch (error) {
    return { ok: false, error: error?.name === "TimeoutError" ? "Поиск занял слишком много времени." : "Сейчас не удалось получить результаты поиска." };
  }
});
ipcMain.handle("browser:ai-overview", async (_event, payload) => {
  const value = String(typeof payload === "string" ? payload : payload?.query || "").trim().slice(0, 400);
  if (!value) return { ok: false, error: "Введите запрос для ИИ-обзора." };
  const sources = Array.isArray(payload?.sources) ? payload.sources.slice(0, 3).map(item => {
    if (!item || typeof item !== "object") return null;
    let url = "";
    try { const parsed = new URL(String(item.url || "")); if (["http:", "https:"].includes(parsed.protocol)) url = parsed.href.slice(0, 300); } catch { }
    return url ? `- ${String(item.title || "Источник").slice(0, 110)} (${url}): ${String(item.snippet || "").slice(0, 360)}` : null;
  }).filter(Boolean) : [];
  const sourceContext = sources.length
    ? `\n\nНиже выдержки из результатов веб-поиска. Для актуальных фактов опирайся только на них, не придумывай детали. Если выдержек недостаточно, прямо скажи об этом. Укажи названия использованных источников в конце ответа.\n${sources.join("\n")}`
    : "";
  try {
    const response = await net.fetch(AI_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ message: `Кратко ответь на запрос: «${value}». Используй 3–5 предложений или до 4 коротких пунктов. Если вопрос зависит от актуальных фактов, опирайся только на выдержки ниже; укажи названия использованных источников. Не выдумывай источники и факты.${sourceContext}` }),
      signal: AbortSignal.timeout(45000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.error || `ИИ-сервис ответил с ошибкой ${response.status}.` };
    if (typeof data.reply !== "string" || !data.reply.trim()) return { ok: false, error: "ИИ-сервис вернул пустой ответ." };
    return { ok: true, reply: data.reply.trim() };
  } catch (error) {
    return { ok: false, error: error?.name === "TimeoutError" ? "ИИ-обзор отвечает слишком долго. Попробуйте ещё раз." : "Не удалось связаться с ИИ-сервисом X.ai." };
  }
});
ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:maximize", () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.handle("window:close", () => mainWindow?.close());

app.whenReady().then(createWindow);
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
