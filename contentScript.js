// contentScript.js

const IDS = {
  wrap: "tgs-wrap",
  title: "tgs-title",
  openBtn: "tgs-open-btn",
  insertBtn: "tgs-insert-btn",
};

// ---------- context ----------
const CTX = (() => {
  const h = location.hostname;
  return {
    isNotion: /notion\.so$|notion\.site$/.test(h) || h.includes("notion."),
    isJira: h.endsWith("atlassian.net"),
    isSheets: h === "docs.google.com",
  };
})();

// ---------- settings (sync) ----------
const DEFAULT_EXCLUDED_HOSTS = [
  "docs.google.com",
  "accounts.google.com",
  "www.google.com",
  "clients6.google.com",
  "*.google.com",
  "*.gstatic.com",
  "*.googleusercontent.com",
  "ssl.gstatic.com",
  "lh3.googleusercontent.com",
  "storage.googleapis.com",
  "apis.google.com",
];

const DEFAULT_SETTINGS = {
  excludeHosts: DEFAULT_EXCLUDED_HOSTS,
  enabled: { notion: true, jira: true, sheets: true },
  bullet:  { notion: false, jira: false, sheets: false },
};

let SETTINGS = structuredClone(DEFAULT_SETTINGS);

async function loadSettings() {
  try {
    const obj = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    // Merge defensively (handles older versions that don’t have new keys yet)
    SETTINGS.excludeHosts = Array.isArray(obj.excludeHosts) ? obj.excludeHosts : DEFAULT_EXCLUDED_HOSTS;
    SETTINGS.enabled = Object.assign({}, DEFAULT_SETTINGS.enabled, obj.enabled || {});
    SETTINGS.bullet  = Object.assign({}, DEFAULT_SETTINGS.bullet,  obj.bullet  || {});
  } catch {
    SETTINGS = structuredClone(DEFAULT_SETTINGS);
  }
}

// Run after settings are ready
(async function init() {
  await loadSettings();

  console.log("[TGS] content script loaded for", location.hostname, SETTINGS);

  if (CTX.isNotion && SETTINGS.enabled.notion) {
    watchNotion();
  } else if (CTX.isJira && SETTINGS.enabled.jira) {
    watchJira();
  } else if (CTX.isSheets && SETTINGS.enabled.sheets) {
    watchSheets();
  }
})();

/* ========================= Notion handling ========================= */

function watchNotion() {
  const mo = new MutationObserver(() => {
    const isPage =
      document.querySelector(".notion-page-content") &&
      (document.querySelector("h1[contenteditable]") ||
        document.querySelector(".notion-page-controls") ||
        /[a-f0-9]{32}/i.test(location.href));

    if (isPage) mountFloatingUiStacked();
    else unmountUi();
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });

  const isPage =
    document.querySelector(".notion-page-content") &&
    (document.querySelector("h1[contenteditable]") ||
      document.querySelector(".notion-page-controls") ||
      /[a-f0-9]{32}/i.test(location.href));
  if (isPage) mountFloatingUiStacked();
}

/* ========================= Jira handling ========================= */

function watchJira() {
  const mo = new MutationObserver(() => ensureJiraUi());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  let lastHref = location.href;
  setInterval(() => {
    if (lastHref !== location.href) {
      lastHref = location.href;
      ensureJiraUi();
    }
  }, 500);

  ensureJiraUi();
}

function ensureJiraUi() {
  if (!SETTINGS.enabled.jira) { unmountUi(); return; }

  const onIssue =
    /\/browse\//.test(location.pathname) ||
    !!document.querySelector('[data-testid^="issue-view-"], [data-test-id^="issue-view-"]');

  if (!onIssue) {
    unmountUi();
    return;
  }

  const bar = getJiraQuickBarContainer();
  if (bar) {
    mountInlineJiraUiAtEnd(bar);
  } else {
    mountFloatingUiStacked(); // fallback
  }
}

function getJiraQuickBarContainer() {
  const triggers = [
    '[data-testid$="apps-button-dropdown--trigger"]',
    '[data-testid$="add-button-dropdown--trigger"]',
    '[data-test-id$="apps-button-dropdown--trigger"]',
    '[data-test-id$="add-button-dropdown--trigger"]',
  ];
  const trigger = document.querySelector(triggers.join(", "));
  if (!trigger) return null;

  let el = trigger.parentElement;
  for (let i = 0; i < 8 && el; i++) {
    const style = getComputedStyle(el);
    if (style.display === "flex" && el.children.length <= 20) return el;
    el = el.parentElement;
  }
  return null;
}

/* ========================= Google Sheets handling ========================= */

function watchSheets() {
  const mo = new MutationObserver(() => ensureSheetsUi());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  let lastHref = location.href;
  setInterval(() => {
    if (lastHref !== location.href) {
      lastHref = location.href;
      ensureSheetsUi();
    }
  }, 500);

  ensureSheetsUi();
}

function ensureSheetsUi() {
  if (!SETTINGS.enabled.sheets) { unmountUi(); return; }

  const hasMenubar = document.querySelector("#docs-menubar");
  if (!hasMenubar) {
    unmountUi();
    return;
  }

  const container = getSheetsMenuContainer();
  if (container) {
    mountInlineSheetsUi(container);
  } else {
    unmountUi();
  }
}

function getSheetsMenuContainer() {
  const menubar = document.querySelector("#docs-menubar");
  if (!menubar) return null;

  const help = document.querySelector("#docs-help-menu");
  if (help && help.parentElement === menubar) return menubar;

  const items = menubar.querySelectorAll('.menu-button.goog-control:not([style*="display: none"])');
  if (items.length) return menubar;

  return null;
}

/* ========================= UI (floating / inline) ========================= */

function mountFloatingUiStacked() {
  const existing = document.getElementById(IDS.wrap);
  if (existing && existing.dataset.mode === "floating-stacked") {
    applyThemeFloating(existing);
    return;
  }
  unmountUi();

  const wrap = document.createElement("div");
  wrap.id = IDS.wrap;
  wrap.dataset.mode = "floating-stacked";
  Object.assign(wrap.style, {
    position: "fixed",
    top: "180px",
    right: "16px",
    zIndex: "2147483646",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    alignItems: "stretch",
    background: "transparent",
  });

  const title = document.createElement("div");
  title.id = IDS.title;
  title.textContent = "Tab Group Sync";
  Object.assign(title.style, {
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: ".02em",
    textAlign: "center",
    color: "#555",
  });

  const openBtn = mkBtn(IDS.openBtn, "👉 Open all URLs", palette().cyan);
  const copyBtn = mkBtn(IDS.insertBtn, "🔗 Copy new URLs", palette().pink);

  wrap.append(title, openBtn, copyBtn);
  document.body.appendChild(wrap);

  hookHandlers();
  console.log("[TGS] UI mounted (floating stacked)");
}

function mountInlineJiraUiAtEnd(container) {
  const existing = document.getElementById(IDS.wrap);
  if (existing && existing.dataset.mode === "inline-jira") return;
  unmountUi();

  const wrap = document.createElement("div");
  wrap.id = IDS.wrap;
  wrap.dataset.mode = "inline-jira";
  Object.assign(wrap.style, {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginLeft: "8px",
  });

  const sampleBtn =
    container.querySelector('button[data-testid$="apps-button-dropdown--trigger"]') ||
    container.querySelector('button[data-testid$="add-button-dropdown--trigger"]') ||
    container.querySelector("button");

  const { heightPx, fontSizePx, padV, padH, borderRadius } = readNativeButtonMetrics(sampleBtn);

  const openBtn = mkBtnCompact(IDS.openBtn, "👉 Open all URLs", palette().cyan, {
    heightPx, fontSizePx, padV, padH, borderRadius,
  });
  const copyBtn = mkBtnCompact(IDS.insertBtn, "🔗 Copy new URLs", palette().pink, {
    heightPx, fontSizePx, padV, padH, borderRadius,
  });

  wrap.append(openBtn, copyBtn);
  container.appendChild(wrap);

  hookHandlers();
  console.log("[TGS] UI mounted (inline Jira)");
}

function mountInlineSheetsUi(menubar) {
  const existing = document.getElementById(IDS.wrap);
  if (existing && existing.dataset.mode === "inline-sheets") return;
  unmountUi();

  const wrap = document.createElement("div");
  wrap.id = IDS.wrap;
  wrap.dataset.mode = "inline-sheets";
  Object.assign(wrap.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    marginLeft: "12px",
    verticalAlign: "middle",
  });

  const helpItem = menubar.querySelector("#docs-help-menu") ||
                   menubar.querySelector('.menu-button.goog-control');
  const cs = helpItem ? getComputedStyle(helpItem) : null;
  const menubarHeight = cs ? parseInt(cs.height) : 28;
  const fontSizePx = cs ? parseInt(cs.fontSize) : 12;
  const padV = Math.max(2, Math.floor((menubarHeight - 20) / 2));
  const padH = 10;
  const borderRadius = "14px";

  const openBtn = mkBtnCompact(IDS.openBtn, "👉 Open all URLs", palette().cyan, {
    heightPx: menubarHeight, fontSizePx, padV, padH, borderRadius,
  });
  const copyBtn = mkBtnCompact(IDS.insertBtn, "🔗 Copy new URLs", palette().pink, {
    heightPx: menubarHeight, fontSizePx, padV, padH, borderRadius,
  });

  wrap.append(openBtn, copyBtn);

  const helpMenu = menubar.querySelector("#docs-help-menu");
  if (helpMenu && helpMenu.nextSibling) {
    helpMenu.parentElement.insertBefore(wrap, helpMenu.nextSibling);
  } else {
    menubar.appendChild(wrap);
  }

  hookHandlers();
  console.log("[TGS] UI mounted (inline Sheets menubar)");
}

function unmountUi() {
  const el = document.getElementById(IDS.wrap);
  if (el) el.remove();
}

function hookHandlers() {
  const openBtn = document.getElementById(IDS.openBtn);
  const insBtn = document.getElementById(IDS.insertBtn);
  if (openBtn) openBtn.addEventListener("click", onOpenUrls, { once: false });
  if (insBtn) insBtn.addEventListener("click", onCopyNew, { once: false });
}

/* ========================= Styles / Theming ========================= */

function mkBtn(id, text, color) {
  const btn = document.createElement("button");
  btn.id = id;
  btn.textContent = text;
  Object.assign(btn.style, {
    border: `2px solid ${color}`,
    borderRadius: "999px",
    padding: "6px 14px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    background: "transparent",
    color: color,
    transition: "background-color 0.15s ease, color 0.15s ease, transform 0.08s ease",
    lineHeight: "1.2",
    whiteSpace: "nowrap",
  });
  btn.onmouseenter = () => { btn.style.background = color; btn.style.color = "#fff"; };
  btn.onmouseleave = () => { btn.style.background = "transparent"; btn.style.color = color; };
  btn.onmousedown = () => (btn.style.transform = "translateY(1px)");
  btn.onmouseup = () => (btn.style.transform = "none");
  return btn;
}

function mkBtnCompact(id, text, color, metrics) {
  const btn = mkBtn(id, text, color);
  btn.style.padding = "4px 10px";
  btn.style.fontSize = "12px";
  btn.style.borderWidth = "2px";
  if (metrics) {
    const { heightPx, fontSizePx, padV, padH, borderRadius } = metrics;
    if (fontSizePx) btn.style.fontSize = fontSizePx + "px";
    if (borderRadius) btn.style.borderRadius = borderRadius;
    if (padV != null) { btn.style.paddingTop = padV + "px"; btn.style.paddingBottom = padV + "px"; }
    if (padH != null) { btn.style.paddingLeft = padH + "px"; btn.style.paddingRight = padH + "px"; }
    if (heightPx) btn.style.minHeight = heightPx + "px";
  }
  return btn;
}

function readNativeButtonMetrics(nativeBtn) {
  if (!nativeBtn) return { heightPx: 30, fontSizePx: 12, padV: 4, padH: 10, borderRadius: "3px" };
  const cs = getComputedStyle(nativeBtn);
  const heightPx = parseInt(cs.height) || 30;
  const fontSizePx = parseInt(cs.fontSize) || 12;
  const padV = Math.max(2, parseInt(cs.paddingTop) || 4);
  const padH = Math.max(6, parseInt(cs.paddingLeft) || 10);
  const borderRadius = cs.borderRadius || "3px";
  return { heightPx, fontSizePx, padV, padH, borderRadius };
}

function applyThemeFloating(wrap) {
  const title = wrap.querySelector(`#${IDS.title}`);
  if (title) title.style.color = "#555";
  const openBtn = document.getElementById(IDS.openBtn);
  const insBtn = document.getElementById(IDS.insertBtn);
  if (openBtn) { openBtn.style.borderColor = palette().cyan; openBtn.style.color = palette().cyan; }
  if (insBtn) { insBtn.style.borderColor = palette().pink; insBtn.style.color = palette().pink; }
}

function palette() {
  const cyan = "#2fa7d9"; // darker cyan/blue
  const pink = "#ff4d6d"; // brighter pink/red
  return { cyan, pink };
}

/* ========================= URL collection & filtering ========================= */

function normalize(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString();
  } catch { return null; }
}

function extractUrlsFromText(text) {
  if (!text) return [];
  const out = [];
  const re = /\bhttps?:\/\/[^\s<>"')]+/gi;
  let m;
  while ((m = re.exec(text))) out.push(m[0].replace(/[),.;:]+$/g, ""));
  return out;
}

function globToRegex(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function hostMatches(pattern, host) {
  try {
    if (!pattern) return false;
    if (pattern.includes("*")) return globToRegex(pattern).test(host);
    return pattern.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}

function isIgnorableHost(host) {
  const list = SETTINGS.excludeHosts || DEFAULT_EXCLUDED_HOSTS;
  return list.some(p => hostMatches(p, host));
}

function filterRealHttp(urls) {
  const seen = new Set();
  const out = [];
  for (const raw of urls) {
    if (!/^https?:\/\//i.test(raw)) continue;
    const n = normalize(raw);
    if (!n) continue;
    const h = new URL(n).hostname;
    if (isIgnorableHost(h)) continue;
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/* ---- Sheets-specific collectors ---- */

function getUrlsFromSheetsGrid() {
  const grid = document.querySelector(".grid4-inner-container");
  if (!grid) return [];
  const collected = [];
  const cells = grid.querySelectorAll('[role="gridcell"]');
  cells.forEach(cell => {
    cell.querySelectorAll('a[href^="http"]').forEach(a => collected.push(a.href));
    const txt = (cell.textContent || "") + " " + (cell.getAttribute("aria-label") || "");
    extractUrlsFromText(txt).forEach(u => collected.push(u));
  });
  return filterRealHttp(collected);
}

function deepScanForUrls(val, bucket) {
  if (!val) return;
  if (typeof val === "string") { extractUrlsFromText(val).forEach(u => bucket.push(u)); return; }
  if (Array.isArray(val)) { for (const v of val) deepScanForUrls(v, bucket); return; }
  if (typeof val === "object") { for (const k in val) deepScanForUrls(val[k], bucket); }
}

function getUrlsFromSheetsBootstrap() {
  const scripts = Array.from(document.scripts || []);
  for (const s of scripts) {
    const txt = s.textContent || "";
    if (!txt || !txt.includes("bootstrapData")) continue;

    const m = txt.match(/bootstrapData\s*=\s*({[\s\S]*?});/);
    if (!m) continue;

    try {
      const json = JSON.parse(m[1]);
      const buckets = [];
      if (json.changes) buckets.push(json.changes);
      if (json.topsnapshot) buckets.push(json.topsnapshot);
      if (!buckets.length) buckets.push(json);

      const urls = [];
      for (const b of buckets) deepScanForUrls(b, urls);
      return filterRealHttp(urls);
    } catch {
      const urls = extractUrlsFromText(txt);
      return filterRealHttp(urls);
    }
  }
  return [];
}

function getUrlsOnPage() {
  if (CTX.isNotion) {
    const root = document.querySelector(".notion-page-content") || document;
    const collected = [];
    root.querySelectorAll("a[href]").forEach(a => collected.push(a.href));
    return filterRealHttp(collected);
  }

  if (CTX.isJira) {
    const root = document.querySelector(".ak-renderer-document") || document;
    const collected = [];
    root.querySelectorAll("a[href]").forEach(a => collected.push(a.href));
    return filterRealHttp(collected);
  }

  if (CTX.isSheets) {
    let urls = getUrlsFromSheetsGrid();
    if (!urls.length) urls = getUrlsFromSheetsBootstrap();
    return urls;
  }

  const collected = [];
  document.querySelectorAll("a[href]").forEach(a => collected.push(a.href));
  return filterRealHttp(collected);
}

/* ========================= Clipboard building ========================= */

function buildClipboardPayload(urls) {
  // Decide formatting per-site + bullets
  const isNotion = CTX.isNotion, isJira = CTX.isJira, isSheets = CTX.isSheets;

  // Sheets: always provide plain text (one per line) so paste goes into rows/cells.
  if (isSheets) {
    const textPlain = urls.join("\n");
    return { textPlain, html: null };
  }

  const bullets =
    (isNotion && SETTINGS.bullet.notion) ||
    (isJira   && SETTINGS.bullet.jira)   ||
    (isSheets && SETTINGS.bullet.sheets); // harmless; sheets branch already returned.

  const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  let html;
  if (bullets) {
    // Use a semantic list for Notion/Jira so it pastes as bullets.
    html = `<ul>${urls.map(u => `<li><a href="${esc(u)}">${esc(u)}</a></li>`).join("")}</ul>`;
  } else {
    // Keep clean block-per-link structure (also pastes nicely).
    html = urls.map(u => `<div><a href="${esc(u)}">${esc(u)}</a></div>`).join("");
  }

  // Plain text mirrors the structure: bullets become "- url" lines
  const textPlain = bullets ? urls.map(u => `- ${u}`).join("\n") : urls.join("\n");
  return { textPlain, html };
}

async function copyToClipboardRich(urls) {
  if (!urls?.length) return;

  const { textPlain, html } = buildClipboardPayload(urls);

  try {
    const parts = { "text/plain": new Blob([textPlain], { type: "text/plain" }) };
    if (html) parts["text/html"] = new Blob([html], { type: "text/html" });
    const item = new ClipboardItem(parts);
    await navigator.clipboard.write([item]);
    toast("✅ Copied new URLs to clipboard");
  } catch {
    try {
      await navigator.clipboard.writeText(textPlain);
      toast("✅ Copied new URLs (plain) to clipboard");
    } catch {
      alert("Could not copy to clipboard. Please allow clipboard permission.");
    }
  }
}

function toast(msg) {
  try {
    const t = document.createElement("div");
    t.textContent = msg;
    Object.assign(t.style, {
      position: "fixed",
      bottom: "18px",
      right: "18px",
      background: "rgba(32,32,32,.92)",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: "10px",
      fontSize: "12px",
      zIndex: 2147483647,
      boxShadow: "0 6px 24px rgba(0,0,0,.22)",
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  } catch {}
}

/* ========================= Actions ========================= */

function onOpenUrls() {
  // If site disabled, do nothing (UI shouldn't mount, but be safe)
  if ((CTX.isNotion && !SETTINGS.enabled.notion) ||
      (CTX.isJira   && !SETTINGS.enabled.jira)   ||
      (CTX.isSheets && !SETTINGS.enabled.sheets)) {
    return;
  }
  const urls = getUrlsOnPage();
  chrome.runtime.sendMessage({
    cmd: "OPEN_URLS",
    payload: { urls, pageTitle: document.title || "" }
  });
}

async function onCopyNew() {
  const groupInfo = await chrome.runtime.sendMessage({ cmd: "GET_GROUP_URLS" });
  if (!groupInfo || groupInfo.groupId === -1) {
    alert("⚠️ Current tab is not in a Tab Group");
    return;
  }

  const pageUrls = new Set(getUrlsOnPage());
  const newOnes = (groupInfo.urls || []).filter(u => !pageUrls.has(u));
  if (!newOnes.length) {
    toast("All group URLs already listed here");
    return;
  }

  await copyToClipboardRich(newOnes);
}