// contentScript.js

const IDS = {
  wrap: "tgs-wrap",
  title: "tgs-title",
  openBtn: "tgs-open-btn",
  insertBtn: "tgs-insert-btn",
};

const CTX = (() => {
  const h = location.hostname;
  return {
    isNotion: /notion\.so$|notion\.site$/.test(h) || h.includes("notion."),
    isJira: h.endsWith("atlassian.net"),
    isSheets: h === "docs.google.com",
  };
})();

(function init() {
  console.log("[TGS] content script loaded for", location.hostname);
  if (CTX.isNotion) {
    watchNotion();
  } else if (CTX.isJira) {
    watchJira();
  } else if (CTX.isSheets) {
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

    if (isPage) mountFloatingUiStacked(); // stacked (one below the other)
    else unmountUi();
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });

  // first tick
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

  // SPA URL changes
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
  // We only show on actual spreadsheet editor URLs
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
  // Insert after the Help/Hilfe menu item in the top menubar
  const menubar = document.querySelector("#docs-menubar");
  if (!menubar) return null;

  // Help can be localized; prefer the explicit id when present
  const help = document.querySelector("#docs-help-menu");
  if (help && help.parentElement === menubar) return menubar;

  // Fallback: last visible menu button
  const items = menubar.querySelectorAll('.menu-button.goog-control:not([style*="display: none"])');
  if (items.length) return menubar;

  return null;
}

/* ========================= UI (floating / inline containers) ========================= */

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

  // Build a compact inline row that looks at home in the menubar
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

  // Read a menubar item to match height/typography
  const helpItem = menubar.querySelector("#docs-help-menu") ||
                   menubar.querySelector('.menu-button.goog-control');
  const cs = helpItem ? getComputedStyle(helpItem) : null;
  const menubarHeight = cs ? parseInt(cs.height) : 28;
  const fontSizePx = cs ? parseInt(cs.fontSize) : 12;
  const padV = Math.max(2, Math.floor((menubarHeight - 20) / 2)); // heuristic
  const padH = 10;
  const borderRadius = "14px";

  const openBtn = mkBtnCompact(IDS.openBtn, "👉 Open all URLs", palette().cyan, {
    heightPx: menubarHeight,
    fontSizePx,
    padV,
    padH,
    borderRadius,
  });

  const copyBtn = mkBtnCompact(IDS.insertBtn, "🔗 Copy new URLs", palette().pink, {
    heightPx: menubarHeight,
    fontSizePx,
    padV,
    padH,
    borderRadius,
  });

  wrap.append(openBtn, copyBtn);

  // Insert *after* the Help/Hilfe item
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
  btn.onmouseenter = () => {
    btn.style.background = color;
    btn.style.color = "#fff";
  };
  btn.onmouseleave = () => {
    btn.style.background = "transparent";
    btn.style.color = color;
  };
  btn.onmousedown = () => (btn.style.transform = "translateY(1px)");
  btn.onmouseup = () => (btn.style.transform = "none");
  return btn;
}

/**
 * Compact variant with optional metrics to match host toolbar height.
 * metrics: { heightPx, fontSizePx, padV, padH, borderRadius }
 */
function mkBtnCompact(id, text, color, metrics) {
  const btn = mkBtn(id, text, color);
  btn.style.padding = "4px 10px";
  btn.style.fontSize = "12px";
  btn.style.borderWidth = "2px";

  if (metrics) {
    const { heightPx, fontSizePx, padV, padH, borderRadius } = metrics;
    if (fontSizePx) btn.style.fontSize = fontSizePx + "px";
    if (borderRadius) btn.style.borderRadius = borderRadius;
    if (padV != null) {
      btn.style.paddingTop = padV + "px";
      btn.style.paddingBottom = padV + "px";
    }
    if (padH != null) {
      btn.style.paddingLeft = padH + "px";
      btn.style.paddingRight = padH + "px";
    }
    if (heightPx) btn.style.minHeight = heightPx + "px";
  }
  return btn;
}

function readNativeButtonMetrics(nativeBtn) {
  if (!nativeBtn) {
    return { heightPx: 30, fontSizePx: 12, padV: 4, padH: 10, borderRadius: "3px" };
  }
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
  if (openBtn) {
    openBtn.style.borderColor = palette().cyan;
    openBtn.style.color = palette().cyan;
  }
  if (insBtn) {
    insBtn.style.borderColor = palette().pink;
    insBtn.style.color = palette().pink;
  }
}

function palette() {
  const cyan = "#2fa7d9"; // darker cyan/blue
  const pink = "#ff4d6d"; // brighter pink/red
  return { cyan, pink };
}

/* ========================= Helpers: URL collection & clipboard ========================= */

function normalize(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}

function getUrlsOnPage() {
  const sel = [];
  if (CTX.isNotion) {
    const root = document.querySelector(".notion-page-content") || document;
    root.querySelectorAll("a[href]").forEach(a => sel.push(a.href));
  } else if (CTX.isJira) {
    const root = document.querySelector(".ak-renderer-document") || document;
    root.querySelectorAll("a[href]").forEach(a => sel.push(a.href));
  } else if (CTX.isSheets) {
    // Best-effort: grab any anchor in the grid area / doc
    document.querySelectorAll(".grid4-inner-container a[href], .waffle a[href], a[href]").forEach(a => sel.push(a.href));
  } else {
    document.querySelectorAll("a[href]").forEach(a => sel.push(a.href));
  }
  // De-dup + normalize
  const out = [];
  const seen = new Set();
  for (const u of sel.map(normalize).filter(Boolean)) {
    if (!seen.has(u)) { seen.add(u); out.push(u); }
  }
  return out;
}

async function copyToClipboardRich(urls) {
  if (!urls?.length) return;

  // Plain text (one per line)
  const textPlain = urls.join("\n");

  // HTML: one <div><a href="...">...</a></div> per URL to paste as separate rows in Notion/Jira
  const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const html = urls.map(u => `<div><a href="${esc(u)}">${esc(u)}</a></div>`).join("");

  // Try the async ClipboardItem path first
  try {
    const item = new ClipboardItem({
      "text/plain": new Blob([textPlain], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    });
    await navigator.clipboard.write([item]);
    toast("✅ Copied new URLs to clipboard");
    return;
  } catch (e) {
    // Fallback: writeText (plain only)
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
  const urls = getUrlsOnPage();
  chrome.runtime.sendMessage({
    cmd: "OPEN_URLS",
    payload: { urls, pageTitle: document.title || "" }
  });
}

async function onCopyNew() {
  // Must be inside a tab group
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