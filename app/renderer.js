const $ = selector => document.querySelector(selector);
const quickSites = [
  ["Google", "https://www.google.com", "G", "Поиск"],
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
}

function createTab() {
  const tab = { id: crypto.randomUUID(), title: "Новая вкладка", url: "", view: null };
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
  overviewOpen = false;
  $("#tabOverview").classList.remove("visible");
  $("#homeView").hidden = Boolean(tab.url);
  for (const item of tabs) if (item.view) item.view.style.display = item.id === id && item.url ? "flex" : "none";
  $("#address").value = tab.url;
  renderTabs();
}

function createWebview(tab) {
  const view = document.createElement("webview");
  view.className = "page-view";
  view.setAttribute("partition", "persist:x-browser-pages");
  view.setAttribute("webpreferences", "contextIsolation=yes, nodeIntegration=no, sandbox=yes");
  view.setAttribute("allowpopups", "");
  view.style.display = "none";
  view.addEventListener("did-navigate", event => onPageChanged(tab, event.url));
  view.addEventListener("did-navigate-in-page", event => onPageChanged(tab, event.url));
  view.addEventListener("page-title-updated", event => {
    tab.title = event.title || pageName(tab.url);
    renderTabs();
    renderOverview();
  });
  view.addEventListener("did-start-loading", () => { if (tab.id === activeId) $("#busy").classList.add("on"); });
  view.addEventListener("did-stop-loading", () => { if (tab.id === activeId) $("#busy").classList.remove("on"); });
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
  if (!tab.title || tab.title === "Новая вкладка") tab.title = pageName(url);
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
  tab.url = result.url;
  tab.title = pageName(result.url);
  if (tab.view) tab.view.style.display = "none";
  const view = tab.view || createWebview(tab);
  activateTab(tab.id);
  $("#homeView").hidden = true;
  view.style.display = "flex";
  $("#address").value = result.url;
  $("#address").blur();
  try { await view.loadURL(result.url); }
  catch { if (tab.id === activeId) showToast("Не удалось открыть страницу. Проверь адрес и интернет."); }
  renderTabs();
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
    button.onclick = () => openAddress(url);
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
  if (value) openAddress(value);
  $("#searchInput").value = "";
});
$("#addressForm").addEventListener("submit", event => {
  event.preventDefault();
  openAddress($("#address").value);
});
$("#address").addEventListener("focus", event => event.target.select());
$("#addTab").onclick = () => createTab();
$("#home").onclick = () => {
  const tab = tabs.find(item => item.id === activeId);
  if (!tab) return;
  destroyView(tab);
  tab.url = "";
  tab.title = "Новая вкладка";
  activateTab(tab.id);
  $("#searchInput").focus();
};
$("#back").onclick = () => { const tab = tabs.find(item => item.id === activeId); if (tab?.view?.canGoBack()) tab.view.goBack(); };
$("#forward").onclick = () => { const tab = tabs.find(item => item.id === activeId); if (tab?.view?.canGoForward()) tab.view.goForward(); };
$("#reload").onclick = () => { const tab = tabs.find(item => item.id === activeId); if (tab?.view) tab.view.reload(); else showToast("Это новая вкладка"); };
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

const hour = new Date().getHours();
$("#greeting").textContent = hour < 5 ? "Доброй ночи. Куда отправимся?" : hour < 12 ? "Доброе утро. Куда отправимся?" : hour < 18 ? "Куда отправимся?" : "Добрый вечер. Куда отправимся?";
renderSites();
updateRecent();
applyPreferences();
createTab();
