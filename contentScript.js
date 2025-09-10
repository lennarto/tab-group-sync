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
    mountFloatingUiStacked(); // sheets uses floating; stacked for consistency
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

    if (isPage) mountFloatingUiStacked(); // stacked buttons (one below the other)
    else unmountUi();
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });

  // First tick
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

  // also re-check on SPA URL changes
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
  // Only on actual issue views
  const onIssue =
    /\/browse\//.test(location.pathname) ||
    !!document.querySelector('[data-testid^="issue-view-"], [data-test-id^="issue-view-"]');

  if (!onIssue) {
    unmountUi();
    return;
  }

  // Try to mount inside the quick-add/apps bar; fallback to floating
  const bar = getJiraQuickBarContainer();
  if (bar) {
    mountInlineJiraUiAtEnd(bar);
  } else {
    mountFloatingUiStacked(); // fallback
  }
}

/**
 * Find the flex row container that holds the quick-add/apps buttons
 * by locating one of the known triggers and walking up to a sane flex row.
 */
function getJiraQuickBarContainer() {
  const triggers = [
    '[data-testid$="apps-button-dropdown--trigger"]', // "Add Apps" / "View app actions"
    '[data-testid$="add-button-dropdown--trigger"]',  // "+ Add or create..."
    '[data-test-id$="apps-button-dropdown--trigger"]',
    '[data-test-id$="add-button-dropdown--trigger"]',
  ];
  const trigger = document.querySelector(triggers.join(", "));
  if (!trigger) return null;

  // Prefer the trigger's parent row; Jira uses nested flex wrappers.
  let el = trigger.parentElement;
  for (let i = 0; i < 8 && el; i++) {
    const style = getComputedStyle(el);
    const isFlexRow = style.display === "flex";
    if (isFlexRow) {
      // sanity: avoid huge containers; prefer rows with reasonable child count
      if (el.children.length <= 20) return el;
    }
    el = el.parentElement;
  }
  return null;
}

/* ========================= UI (floating & inline) ========================= */

/**
 * Floating widget (Notion/Sheets; stacked buttons with title).
 */
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
    top: "180px",     // requested vertical offset
    right: "16px",
    zIndex: "2147483646",
    display: "flex",
    flexDirection: "column", // stacked
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
  const copyBtn = mkBtn(IDS.insertBtn, "🔗 Copy all URLs", palette().pink);

  wrap.append(title, openBtn, copyBtn); // stacked under title
  document.body.appendChild(wrap);

  hookHandlers();
  console.log("[TGS] UI mounted (floating stacked)");
}

/**
 * Inline Jira UI: append our buttons at the END of the quick bar,
 * after the "Add Apps" button. Match height to native buttons.
 */
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
    marginLeft: "8px", // small spacing from last native button
  });

  // Determine native button height/padding to blend in
  const sampleBtn =
    container.querySelector('button[data-testid$="apps-button-dropdown--trigger"]') ||
    container.querySelector('button[data-testid$="add-button-dropdown--trigger"]') ||
    container.querySelector("button");

  const { heightPx, fontSizePx, padV, padH, borderRadius } = readNativeButtonMetrics(sampleBtn);

  const openBtn = mkBtnCompact(IDS.openBtn, "👉 Open all URLs", palette().cyan, {
    heightPx, fontSizePx, padV, padH, borderRadius,
  });
  const copyBtn = mkBtnCompact(IDS.insertBtn, "🔗 Copy all URLs", palette().pink, {
    heightPx, fontSizePx, padV, padH, borderRadius,
  });

  wrap.append(openBtn, copyBtn);
  container.appendChild(wrap); // append at the end

  hookHandlers();
  console.log("[TGS] UI mounted (inline in Jira quick bar)");
}

function unmountUi() {
  const el = document.getElementById(IDS.wrap);
  if (el) el.remove();
}

function hookHandlers() {
  const openBtn = document.getElementById(IDS.openBtn);
  const insBtn = document.getElementById(IDS.insertBtn);
  if (openBtn) openBtn.addEventListener("click", onOpenUrls, { once: false });
  if (insBtn) insBtn.addEventListener("click", onInsertOrCopy, { once: false });
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
 * Compact button that tries to match Jira toolbar button height.
 * metrics: { heightPx, fontSizePx, padV, padH, borderRadius }
 */
function mkBtnCompact(id, text, color, metrics) {
  const btn = mkBtn(id, text, color);

  // Apply metrics to visually match Jira's buttons
  if (metrics) {
    const { heightPx, fontSizePx, padV, padH, borderRadius } = metrics;
    if (fontSizePx) btn.style.fontSize = fontSizePx + "px";
    if (borderRadius) btn.style.borderRadius = borderRadius;
    // Prefer using padding to hit the height; outline keeps 2px border
    if (padV != null) btn.style.paddingTop = padV + "px", btn.style.paddingBottom = padV + "px";
    if (padH != null) btn.style.paddingLeft = padH + "px", btn.style.paddingRight = padH + "px";
    if (heightPx) btn.style.minHeight = heightPx + "px";
  }

  return btn;
}

/**
 * Reads a Jira native button's visual metrics so our buttons match.
 */
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
  const cyan = "#2fa7d9"; // darker blue (your request)
  const pink = "#ff4d6d"; // brighter red (your request)
  return { cyan, pink };
}

/* ========================= Actions ========================= */

function onOpenUrls() {
  chrome.runtime.sendMessage({ type: "OPEN_URLS" });
}

function onInsertOrCopy() {
  chrome.runtime.sendMessage({ type: "INSERT_OR_COPY_URLS" });
}