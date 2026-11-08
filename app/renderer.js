const $ = selector => document.querySelector(selector);
const quickSites = [
  ["Поиск X Browser", "", "⌕", "Интернет-поиск"],
  ["YouTube", "https://www.youtube.com", "▶", "Видео"],
  ["Gmail", "https://mail.google.com", "✉", "Почта"],
  ["Google Drive", "https://drive.google.com", "△", "Файлы"],
  ["Карты", "https://maps.google.com", "⌖", "Места"],
  ["Wikipedia", "https://ru.wikipedia.org", "W", "Знания"],
  ["Telegram Web", "https://web.telegram.org", "➤", "Сообщения"],
];
let tabs = [];
let activeId = "";
let overviewOpen = false;
let homeSearchMode = "web";
let historyItems = JSON.parse(localStorage.getItem("xb-history") || "[]");
let bookmarks = JSON.parse(localStorage.getItem("xb-bookmarks") || "[]");
let preferences = {
  toolbar: localStorage.getItem("xb-toolbar") || "top",
  tabLayout: localStorage.getItem("xb-tab-layout") || "horizontal",
  theme: localStorage.getItem("xb-theme") || "dark",
  showQuick: localStorage.getItem("xb-show-quick") !== "false",
};

function showToast(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function saveHistory() { localStorage.setItem("xb-history", JSON.stringify(historyItems)); }
function persistBookmarks() { localStorage.setItem("xb-bookmarks", JSON.stringify(bookmarks)); }

function displayTitle(title, url) {
  return title || pageName(url);
}

function updateRecent() {
  $("#recent").textContent = historyItems.length
    ? `Недавно открывали: ${historyItems.slice(0, 3).map(item => item.title).join(" · ")}`
    : "Личная история хранится на этом устройстве";
}

function makeTabButton(tab, vertical = false) {
  const button = document.createElement("button");
  button.className = `tab${tab.id === activeId ? " active" : ""}`;
  button.title = tab.title;
  const icon = document.createElement("span");
  icon.className = "tab-icon";
  icon.textContent = tab.url ? "↗" : "X";
  const name = document.createElement("span");
  name.className = "tab-title";
  name.textContent = tab.title;
  const close = document.createElement("span");
  close.className = "tab-close";
  close.textContent = "×";
  close.title = "Закрыть вкладку";
  close.onclick = event => { event.stopPropagation(); closeTab(tab.id); };
  button.append(icon, name, close);
  button.onclick = () => activateTab(tab.id);
  if (vertical) button.classList.add("vertical-tab");
  return button;
}

function renderTabs() {
  const horizontal = $("#tablist");
  const vertical = $("#verticalList");
  horizontal.replaceChildren();
  vertical.replaceChildren();
  for (const tab of tabs) {
    horizontal.append(makeTabButton(tab));
    vertical.append(makeTabButton(tab, true));
  }
  try {
    localStorage.setItem("xb-tabs-session", JSON.stringify(tabs.slice(-20).map(({ id, title, url, kind, query, searchMode }) => ({ id, title, url, kind, query, searchMode }))));
    localStorage.setItem("xb-active-tab", activeId);
  } catch { /* Keep browsing if local storage is unavailable. */ }
}

function createTab() {
  const tab = { id: crypto.randomUUID(), title: "Новая вкладка", url: "", kind: "home", query: "", view: null };
  tabs.push(tab);
  activateTab(tab.id);
  return tab;
}

function destroyView(tab) {
  if (!tab.view) return;
  tab.view.remove();
  tab.view = null;
}

function closeTab(id) {
  const index = tabs.findIndex(tab => tab.id === id);
  if (index < 0) return;
  const wasActive = id === activeId;
  destroyView(tabs[index]);
  tabs.splice(index, 1);
  if (!tabs.length) createTab();
  else if (wasActive) activateTab(tabs[Math.max(0, index - 1)].id);
  else renderTabs();
}

function activateTab(id) {
  const tab = tabs.find(item => item.id === id);
  if (!tab) return;
  activeId = id;
  if (tab.kind === "web" && tab.url && !tab.view) createWebview(tab, tab.url);
  overviewOpen = false;
  $("#tabOverview").classList.remove("visible");
  $("#homeView").hidden = Boolean(tab.url);
  $("#searchResultsView").hidden = tab.kind !== "search";
  if (tab.kind === "search") {
    updateSearchMode(tab);
    if (tab.searchMode === "ai") loadAiOverview(tab);
    else loadSearchResults(tab);
  }
  for (const item of tabs) if (item.view) item.view.style.display = item.id === id && item.url ? "flex" : "none";
  $("#address").value = tab.url;
  renderTabs();
}

function createWebview(tab, initialUrl) {
  const view = document.createElement("webview");
  view.className = "page-view";
  view.setAttribute("partition", "persist:x-browser-pages");
  view.setAttribute("webpreferences", "contextIsolation=yes, nodeIntegration=no, sandbox=yes");
  view.setAttribute("allowpopups", "");
  view.setAttribute("src", initialUrl);
  view.style.display = "none";
  // A webview without an initial src does not create its guest contents, so
  // loadURL() rejects and leaves a white about:blank surface. Set src before
  // appending, then wait for the guest to attach before future API calls.
  tab.viewReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Встроенная вкладка не запустилась.")), 15000);
    view.addEventListener("did-attach", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    view.addEventListener("destroyed", () => {
      clearTimeout(timeout);
      reject(new Error("Вкладка была закрыта во время запуска."));
    }, { once: true });
  });
  view.addEventListener("did-navigate", event => onPageChanged(tab, event.url));
  view.addEventListener("did-navigate-in-page", event => onPageChanged(tab, event.url));
  view.addEventListener("page-title-updated", event => {
    tab.title = displayTitle(event.title, tab.url);
    renderTabs();
    renderOverview();
  });
  view.addEventListener("did-start-loading", () => {
    if (tab.id === activeId) { $("#busy").classList.add("on"); $("#busy").textContent = ""; }
  });
  view.addEventListener("did-stop-loading", () => {
    if (tab.id === activeId) { $("#busy").classList.remove("on"); $("#busy").textContent = ""; }
  });
  view.addEventListener("did-fail-load", event => {
    if (event.errorCode !== -3 && tab.id === activeId) showToast("Страница не загрузилась. Проверь адрес и интернет.");
  });
  $("#webviewHost").append(view);
  tab.view = view;
  return view;
}

function pageName(value) {
  try { return new URL(value).hostname.replace(/^www\./, ""); }
  catch { return value || "Новая вкладка"; }
}

function onPageChanged(tab, url) {
  tab.url = url;
  tab.kind = "web";
  if (!tab.title || tab.title === "Новая вкладка") tab.title = displayTitle(pageName(url), url);
  historyItems = [{ url, title: tab.title, time: Date.now() }, ...historyItems.filter(item => item.url !== url)].slice(0, 30);
  saveHistory();
  updateRecent();
  if (tab.id === activeId) {
    $("#homeView").hidden = true;
    $("#address").value = url;
    $("#tabOverview").classList.remove("visible");
  }
  renderTabs();
}

async function openAddress(value, targetTab = tabs.find(tab => tab.id === activeId)) {
  const result = await window.xBrowser.resolveAddress(value);
  if (!result.ok) { showToast(result.error); return; }
  const tab = targetTab || createTab();
  if (result.kind === "search") return openSearch(result.query, tab);
  tab.kind = "web";
  tab.query = "";
  tab.url = result.url;
  tab.title = pageName(result.url);
  if (tab.view) tab.view.style.display = "none";
  const isNewView = !tab.view;
  const view = tab.view || createWebview(tab, result.url);
  activateTab(tab.id);
  $("#homeView").hidden = true;
  view.style.display = "flex";
  $("#address").value = result.url;
  $("#address").blur();
  try {
    await tab.viewReady;
    if (!isNewView) await view.loadURL(result.url);
  } catch (error) {
    if (tab.id === activeId) {
      const detail = error?.message ? ` (${error.message})` : "";
      showToast(`Не удалось открыть страницу${detail}`);
    }
  }
  renderTabs();
}

function openSearch(query, targetTab, mode = "web") {
  const tab = targetTab || createTab();
  destroyView(tab);
  tab.kind = "search";
  tab.query = query;
  tab.url = `x-browser://search/?q=${encodeURIComponent(query)}`;
  tab.title = `${query} · X Browser`;
  tab.searchLoadedFor = "";
  tab.searchLoading = false;
  tab.searchMode = mode;
  tab.aiLoadedFor = "";
  tab.aiLoading = false;
  activateTab(tab.id);
  $("#address").value = query;
  $("#address").blur();
  renderTabs();
}

function updateSearchMode(tab) {
  const isAi = tab.searchMode === "ai";
  $("#resultsWebMode").classList.toggle("active", !isAi);
  $("#resultsAiMode").classList.toggle("active", isAi);
  $("#resultsCaption").textContent = isAi
    ? "Краткий обзор X Browser по вашему запросу"
    : "Результаты поиска X Browser";
}

function shouldShowAutomaticOverview(query) {
  const value = query.trim().toLocaleLowerCase();
  if (value.length < 9 || /^[\w.-]+\.[a-z]{2,}$/i.test(value)) return false;
  const words = value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const informationTerms = new Set(["что", "как", "почему", "когда", "кто", "где", "сколько", "зачем", "какой", "какая", "какие", "объясни", "расскажи", "сравни", "помоги", "погода", "новости", "события", "итоги", "причины", "история", "обзор", "цена", "курс", "результат", "столица", "значение", "определение", "what", "how", "why", "when", "who", "where", "explain", "compare", "guide", "news", "weather", "latest"]);
  return value.includes("?") || words.some(word => informationTerms.has(word)) || words.length >= 5;
}

function addAutomaticOverview(tab, sources) {
  if (!shouldShowAutomaticOverview(tab.query)) return;
  const card = document.createElement("article"); card.className = "auto-ai-card";
  const heading = document.createElement("div"); heading.className = "ai-meta";
  const orb = document.createElement("span"); orb.className = "ai-orb"; orb.textContent = "✦";
  const label = document.createElement("div"); label.innerHTML = "<strong>Краткий ИИ-обзор</strong><small>По найденным страницам</small>";
  heading.append(orb, label);
  const body = document.createElement("div"); body.className = "ai-answer";
  body.innerHTML = '<span class="results-spinner"></span> <span>Сверяю вопрос с результатами поиска…</span>';
  card.append(heading, body);
  const firstResult = $("#searchResultsList .result-card");
  firstResult ? firstResult.before(card) : $("#searchResultsList").prepend(card);
  window.xBrowser.aiOverview(tab.query, sources.slice(0, 6)).then(response => {
    if (!card.isConnected || tab.id !== activeId || tab.searchMode !== "web") return;
    body.textContent = response.ok ? response.reply : "ИИ-обзор сейчас недоступен. Ниже остаются обычные результаты поиска.";
  }).catch(() => {
    if (card.isConnected) body.textContent = "ИИ-обзор сейчас недоступен. Ниже остаются обычные результаты поиска.";
  });
}

async function loadSearchResults(tab) {
  if (tab.searchMode === "ai") return;
  const list = $("#searchResultsList");
  $("#resultsQuery").textContent = tab.query;
  if (tab.searchLoadedFor === tab.query || tab.searchLoading) return;
  tab.searchLoading = true;
  list.replaceChildren();
  const loading = document.createElement("div");
  loading.className = "results-state";
  loading.innerHTML = '<span class="results-spinner"></span><strong>Ищем в интернете…</strong><small>Результаты оформлены X Browser</small>';
  list.append(loading);
  const response = await window.xBrowser.search(tab.query);
  tab.searchLoading = false;
  if (tab.id !== activeId || tab.kind !== "search" || tab.searchMode !== "web") return;
  list.replaceChildren();
  if (!response.ok) {
    const state = document.createElement("div"); state.className = "results-state";
    const title = document.createElement("strong"); title.textContent = response.error || "Не удалось загрузить результаты";
    const fallback = document.createElement("button"); fallback.className = "results-fallback"; fallback.textContent = "Повторить поиск";
    fallback.onclick = () => openSearch(tab.query, tab);
    state.append(title, fallback); list.append(state); return;
  }
  const doc = new DOMParser().parseFromString(response.html, "text/html");
  const rows = [...doc.querySelectorAll(".result")].map(row => {
    const link = row.querySelector("a.result__a");
    const raw = link?.getAttribute("href") || "";
    let href = raw;
    try {
      const parsed = new URL(raw, "https://html.duckduckgo.com");
      const redirect = parsed.searchParams.get("uddg");
      href = redirect || parsed.href;
    } catch { return null; }
    if (!/^https?:/i.test(href)) return null;
    return { href, title: link?.textContent?.trim(), snippet: row.querySelector(".result__snippet")?.textContent?.trim() || "" };
  }).filter(item => item?.title && item.href).slice(0, 20);
  if (!rows.length) {
    const state = document.createElement("div"); state.className = "results-state";
    const title = document.createElement("strong"); title.textContent = "Пока нет результатов для этого запроса.";
    const fallback = document.createElement("button"); fallback.className = "results-fallback"; fallback.textContent = "Повторить поиск";
    fallback.onclick = () => openSearch(tab.query, tab);
    state.append(title, fallback); list.append(state); tab.searchLoadedFor = tab.query; return;
  }
  for (const item of rows) {
    const card = document.createElement("article"); card.className = "result-card";
    const host = document.createElement("div"); host.className = "result-host";
    try { host.textContent = new URL(item.href).hostname.replace(/^www\./, ""); } catch { host.textContent = "Сайт"; }
    const link = document.createElement("button"); link.className = "result-link"; link.textContent = item.title;
    link.onclick = () => openAddress(item.href, tab);
    const snippet = document.createElement("p"); snippet.textContent = item.snippet;
    card.append(host, link, snippet); list.append(card);
  }
  addAutomaticOverview(tab, rows.map(item => ({ url: item.href, title: item.title, snippet: item.snippet })));
  tab.searchLoadedFor = tab.query;
}

async function loadAiOverview(tab) {
  if (tab.searchMode !== "ai" || tab.aiLoading || tab.aiLoadedFor === tab.query) return;
  const list = $("#searchResultsList");
  list.replaceChildren();
  const loading = document.createElement("div"); loading.className = "results-state";
  loading.innerHTML = '<span class="results-spinner"></span><strong>Готовим ИИ-обзор…</strong><small>Ответ формирует X.ai</small>';
  list.append(loading);
  tab.aiLoading = true;
  const response = await window.xBrowser.aiOverview(tab.query);
  tab.aiLoading = false;
  if (tab.id !== activeId || tab.kind !== "search" || tab.searchMode !== "ai") return;
  list.replaceChildren();
  if (!response.ok) {
    const state = document.createElement("div"); state.className = "results-state";
    const title = document.createElement("strong"); title.textContent = response.error || "ИИ-обзор сейчас недоступен";
    const retry = document.createElement("button"); retry.className = "results-fallback"; retry.textContent = "Повторить";
    retry.onclick = () => { tab.aiLoadedFor = ""; loadAiOverview(tab); };
    state.append(title, retry); list.append(state); return;
  }
  const meta = document.createElement("div"); meta.className = "ai-meta";
  const orb = document.createElement("span"); orb.className = "ai-orb"; orb.textContent = "✦";
  const label = document.createElement("div"); label.innerHTML = "<strong>ИИ-обзор</strong><small>Ответ помощника X.ai</small>";
  meta.append(orb, label);
  const answer = document.createElement("div"); answer.className = "ai-answer"; answer.textContent = response.reply;
  const note = document.createElement("small"); note.className = "ai-note"; note.textContent = "ИИ может ошибаться. Проверяйте важные факты.";
  list.append(meta, answer, note);
  tab.aiLoadedFor = tab.query;
}

function renderSites() {
  const holder = $("#tiles");
  holder.replaceChildren();
  const sites = [...quickSites, ...bookmarks.map(item => [item.title || pageName(item.url), item.url, "★", "Закладка"])];
  sites.forEach(([name, url, icon, detail]) => {
    const button = document.createElement("button");
    button.className = "tile";
    const mark = document.createElement("span");
    mark.className = "tile-icon";
    mark.textContent = icon;
    const label = document.createElement("span");
    label.innerHTML = "<b></b><small></small>";
    label.querySelector("b").textContent = name;
    label.querySelector("small").textContent = detail;
    button.append(mark, label);
    button.onclick = () => url ? openAddress(url) : $("#searchInput").focus();
    holder.append(button);
  });
  const add = document.createElement("button");
  add.className = "tile";
  add.innerHTML = '<span class="tile-icon">+</span><span><b>Добавить сайт</b><small>Своя ссылка</small></span>';
  add.onclick = () => {
    const value = prompt("Введи адрес сайта, например example.com");
    if (value) openAddress(value);
  };
  holder.append(add);
}

function renderOverview() {
  const overview = $("#tabOverview");
  overview.replaceChildren();
  for (const tab of tabs) {
    const card = document.createElement("article");
    card.className = "overview-card";
    const title = document.createElement("strong");
    title.textContent = tab.title;
    const url = document.createElement("small");
    url.textContent = tab.url || "Новая вкладка";
    const close = document.createElement("button");
    close.textContent = "×";
    close.title = "Закрыть вкладку";
    close.onclick = event => { event.stopPropagation(); closeTab(tab.id); if (overviewOpen) renderOverview(); };
    card.append(title, url, close);
    card.onclick = () => activateTab(tab.id);
    overview.append(card);
  }
  const add = document.createElement("button");
  add.className = "overview-card overview-new";
  add.textContent = "+";
  add.title = "Новая вкладка";
  add.onclick = () => createTab();
  overview.append(add);
}

function toggleOverview(force) {
  overviewOpen = force ?? !overviewOpen;
  if (overviewOpen) {
    $("#homeView").hidden = true;
    $("#searchResultsView").hidden = true;
    for (const tab of tabs) if (tab.view) tab.view.style.display = "none";
    renderOverview();
    $("#tabOverview").classList.add("visible");
  } else activateTab(activeId);
}

function applyPreferences() {
  document.body.dataset.toolbarPosition = preferences.toolbar;
  document.body.dataset.tabLayout = preferences.tabLayout;
  document.body.classList.toggle("light", preferences.theme === "light");
  $("#tiles").closest(".section").hidden = !preferences.showQuick;
  $("#toolbarMode").value = preferences.toolbar;
  $("#tabMode").value = preferences.tabLayout;
  $("#themeMode").value = preferences.theme;
  $("#showQuick").checked = preferences.showQuick;
  localStorage.setItem("xb-toolbar", preferences.toolbar);
  localStorage.setItem("xb-tab-layout", preferences.tabLayout);
  localStorage.setItem("xb-theme", preferences.theme);
  localStorage.setItem("xb-show-quick", String(preferences.showQuick));
}

$("#searchForm").addEventListener("submit", event => {
  event.preventDefault();
  const value = $("#searchInput").value.trim();
  if (value) homeSearchMode === "ai" ? openSearch(value, undefined, "ai") : openAddress(value);
  $("#searchInput").value = "";
});
$("#addressForm").addEventListener("submit", event => {
  event.preventDefault();
  openAddress($("#address").value);
});
$("#resultsSearchForm").addEventListener("submit", event => {
  event.preventDefault();
  const value = $("#resultsQuery").value.trim();
  if (value) openSearch(value, undefined, tabs.find(tab => tab.id === activeId)?.searchMode || "web");
});
$("#homeWebMode").onclick = () => {
  homeSearchMode = "web";
  $("#homeWebMode").classList.add("active"); $("#homeAiMode").classList.remove("active");
};
$("#homeAiMode").onclick = () => {
  homeSearchMode = "ai";
  $("#homeAiMode").classList.add("active"); $("#homeWebMode").classList.remove("active");
};
$("#resultsWebMode").onclick = () => {
  const tab = tabs.find(item => item.id === activeId); if (!tab) return;
  tab.searchMode = "web"; tab.searchLoadedFor = ""; updateSearchMode(tab); loadSearchResults(tab);
};
$("#resultsAiMode").onclick = () => {
  const tab = tabs.find(item => item.id === activeId); if (!tab) return;
  tab.searchMode = "ai"; tab.aiLoadedFor = ""; updateSearchMode(tab); loadAiOverview(tab);
};
$("#address").addEventListener("focus", event => event.target.select());
$("#addTab").onclick = () => createTab();
$("#home").onclick = () => {
  const tab = tabs.find(item => item.id === activeId);
  if (!tab) return;
  destroyView(tab);
  tab.url = "";
  tab.kind = "home";
  tab.query = "";
  tab.title = "Новая вкладка";
  activateTab(tab.id);
  $("#searchInput").focus();
};
$("#back").onclick = () => { const tab = tabs.find(item => item.id === activeId); if (tab?.view?.canGoBack()) tab.view.goBack(); };
$("#forward").onclick = () => { const tab = tabs.find(item => item.id === activeId); if (tab?.view?.canGoForward()) tab.view.goForward(); };
$("#reload").onclick = () => {
  const tab = tabs.find(item => item.id === activeId);
  if (tab?.view) tab.view.reload();
  else if (tab?.kind === "search") {
    if (tab.searchMode === "ai") { tab.aiLoadedFor = ""; tab.aiLoading = false; loadAiOverview(tab); }
    else { tab.searchLoadedFor = ""; tab.searchLoading = false; loadSearchResults(tab); }
  } else showToast("Это новая вкладка");
};
$("#overviewBtn").onclick = () => toggleOverview();
$("#minimize").onclick = () => window.xBrowser.minimize();
$("#maximize").onclick = () => window.xBrowser.maximize();
$("#closeWindow").onclick = () => window.xBrowser.close();
$("#bookmark").onclick = () => {
  const tab = tabs.find(item => item.id === activeId);
  if (!tab?.url) return showToast("Сначала открой сайт");
  if (!bookmarks.some(item => item.url === tab.url)) {
    bookmarks.unshift({ url: tab.url, title: tab.title });
    persistBookmarks();
    renderSites();
    showToast("Добавлено в закладки");
  } else showToast("Уже в закладках");
};

const settingsDialog = $("#settingsDialog");
$("#settingsBtn").onclick = () => settingsDialog.showModal();
$("#closeSettings").onclick = $("#doneSettings").onclick = () => settingsDialog.close();
$("#toolbarMode").onchange = event => { preferences.toolbar = event.target.value; applyPreferences(); };
$("#tabMode").onchange = event => { preferences.tabLayout = event.target.value; applyPreferences(); };
$("#themeMode").onchange = event => { preferences.theme = event.target.value; applyPreferences(); };
$("#showQuick").onchange = event => { preferences.showQuick = event.target.checked; applyPreferences(); };
settingsDialog.addEventListener("click", event => { if (event.target === settingsDialog) settingsDialog.close(); });
window.xBrowser.onOpenPopup(url => { const tab = createTab(); openAddress(url, tab); });

function restoreSession() {
  try {
    const saved = JSON.parse(localStorage.getItem("xb-tabs-session") || "[]");
    if (Array.isArray(saved)) {
      tabs = saved.slice(-20).map(item => ({
        id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
        title: typeof item.title === "string" ? item.title : "Новая вкладка",
        url: typeof item.url === "string" && (/^https?:\/\//i.test(item.url) || item.url.startsWith("x-browser://search/")) ? item.url : "",
        kind: item.kind === "search" || item.url?.startsWith("x-browser://search/") ? "search" : item.url ? "web" : "home",
        searchMode: item.searchMode === "ai" ? "ai" : "web",
        query: typeof item.query === "string" ? item.query : item.url?.startsWith("x-browser://search/") ? new URL(item.url).searchParams.get("q") || "" : "",
        view: null,
      }));
    }
  } catch { tabs = []; }
  if (!tabs.length) return createTab();
  const active = tabs.find(item => item.id === localStorage.getItem("xb-active-tab")) || tabs[0];
  activateTab(active.id);
}

const hour = new Date().getHours();
$("#greeting").textContent = hour < 5 ? "Доброй ночи. Куда отправимся?" : hour < 12 ? "Доброе утро. Куда отправимся?" : hour < 18 ? "Куда отправимся?" : "Добрый вечер. Куда отправимся?";
renderSites();
updateRecent();
applyPreferences();
restoreSession();
