// Tab Group Sync – contentScript.js (Only show on real pages)
// Debug tip: watch console logs with prefix [TGS]

console.log("[TGS] content script injected:", location.href);

const CTX = (() => {
  const u = location.href;
  if (u.includes("notion.so") || u.includes("notion.site")) return "notion";
  if (u.includes(".atlassian.net")) return "jira";
  if (u.includes("docs.google.com")) return "sheets";
  return "unknown";
})();

const IDS = { wrap: "tgs-wrap", openBtn: "tgs-open-btn", insertBtn: "tgs-insert-btn" };

/* ------------------------- Host-specific gating ------------------------- */

const NOTION_PAGE_ID_RE = /[0-9a-f]{32}/i;              // ...abcd1234abcd1234abcd1234abcd1234
const NOTION_GUID_RE    = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function isNotionPageView() {
  // Signal 1: URL contains a Notion page id (robust for most internal+public links)
  const hasIdInUrl = NOTION_PAGE_ID_RE.test(location.href) || NOTION_GUID_RE.test(location.href);

  // Signal 2: The page DOM exists: a page content root with at least one page block
  const pageRoot = document.querySelector(".notion-page-content");
  const hasBlocks = !!document.querySelector(".notion-page-content [data-block-id]");

  // Signal 3: A page title is mounted (Notion uses contenteditable)
  const hasEditableTitle = !!document.querySelector(
    '.notion-page-content h1[contenteditable], .notion-page-content [contenteditable][data-content-editable-leaf]'
  );

  // We only show if the page *really* looks like a document, not DB/gallery/home.
  // Keep this permissive: any two signals are enough.
  const score = [hasIdInUrl, !!pageRoot, hasBlocks, hasEditableTitle].filter(Boolean).length;
  return score >= 2;
}

function isJiraIssueView() {
  // Works for new & classic UIs
  return /\/browse\//.test(location.pathname) ||
         !!document.querySelector('[data-testid^="issue-view-"], [data-test-id^="issue-view-"]');
}

function isSheetsDoc() {
  // Only spreadsheet docs, not Drive or other Google editors
  return /\/spreadsheets\//.test(location.pathname);
}

function shouldShowUi() {
  if (CTX === "notion") return isNotionPageView();
  if (CTX === "jira")   return isJiraIssueView();
  if (CTX === "sheets") return isSheetsDoc();
  return false;
}

/* --------------------------- UI mount/unmount --------------------------- */

function mkBtn(id, label) {
  const b = document.createElement("button");
  b.id = id;
  b.textContent = label;
  Object.assign(b.style, {
    padding: "8px 12px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    boxShadow: "0 2px 8px rgba(0,0,0,.2)",
    background: "#1f6feb",
    color: "#fff",
  });
  return b;
}

function mountUi() {
  if (document.getElementById(IDS.wrap)) return;

  const wrap = document.createElement("div");
  wrap.id = IDS.wrap;
  Object.assign(wrap.style, {
    position: "fixed",
    top: "64px",
    right: "16px",
    zIndex: "2147483646",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  });

  const openBtn   = mkBtn(IDS.openBtn,   "Open URLs");
  const insertBtn = mkBtn(IDS.insertBtn, "Insert / Copy URLs");

  wrap.append(openBtn, insertBtn);
  document.body.appendChild(wrap);

  openBtn.addEventListener("click", onOpenUrls);
  insertBtn.addEventListener("click", onInsertOrCopy);

  console.log("[TGS] UI mounted for", CTX);
}

function unmountUi() {
  const wrap = document.getElementById(IDS.wrap);
  if (wrap) {
    wrap.remove();
    console.log("[TGS] UI unmounted for", CTX);
  }
}

// Debounced ensure (avoid thrashing on heavy DOM updates)
let ensureTimer = null;
function ensureUiDebounced() {
  if (ensureTimer) cancelAnimationFrame(ensureTimer);
  ensureTimer = requestAnimationFrame(() => {
    if (shouldShowUi()) mountUi();
    else unmountUi();
  });
}

/* --------------------------- URL extraction ---------------------------- */

function normalizeUrls(urls) {
  return [...new Set(
    urls.filter(Boolean)
      .map(s => s.trim())
      .filter(s => /^https?:\/\//i.test(s))
      .map(s => s.split("?")[0].replace(/#.+$/, ""))
  )];
}

function extractUrlsFromPage() {
  // Simple and reliable: grab anchors
  const urls = Array.from(document.querySelectorAll("a[href]"), a => a.href);
  return normalizeUrls(urls);
}

/* ----------------------- Background communication ---------------------- */

function sendToBG(cmd, payload = {}) {
  return new Promise(resolve => chrome.runtime.sendMessage({ cmd, payload }, resolve));
}

async function onOpenUrls() {
  const pageUrls = extractUrlsFromPage();
  if (!pageUrls.length) {
    alert("No URLs detected on this page.");
    return;
  }
  const res = await sendToBG("OPEN_URLS", { urls: pageUrls, pageTitle: document.title });
  console.log("[TGS] OPEN_URLS result:", res);
}

async function onInsertOrCopy() {
  const groupInfo = await sendToBG("GET_GROUP_URLS");
  if (!groupInfo || groupInfo.groupId === -1) {
    return copyListWithToast(extractUrlsFromPage(), "Copied page URLs to clipboard.");
  }

  const groupUrls = groupInfo.urls || [];
  const pageUrls = extractUrlsFromPage();
  const missing = normalizeUrls(groupUrls.filter(u => !pageUrls.includes(u)));

  if (!missing.length) {
    alert("Nothing to add.");
    return;
  }
  const inserted = tryInsertIntoHost(missing);
  if (!inserted) copyListWithToast(missing, "Copied URLs to clipboard.");
}

/* ------------------------- Host-specific insert ------------------------ */

function tryInsertIntoHost(lines) {
  const text = lines.join("\n");

  if (CTX === "notion" || CTX === "jira") {
    const target =
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector("[contenteditable='true']") ||
      document.querySelector("textarea");
    if (target) {
      target.focus();
      if (target.tagName === "TEXTAREA") {
        target.value += (target.value ? "\n" : "") + text + "\n";
      } else {
        document.execCommand("insertText", false, text + "\n");
      }
      toast(`Inserted URLs into ${CTX}.`);
      return true;
    }
  }

  // Sheets: canvas UI → copy fallback
  return false;
}

/* ------------------------------ Utilities ------------------------------ */

async function copyText(s) {
  try {
    await navigator.clipboard.writeText(s);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = s;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

function copyListWithToast(list, msg) {
  copyText(list.join("\n")).then(() => toast(msg));
}

function toast(msg) {
  const d = document.createElement("div");
  d.textContent = msg;
  Object.assign(d.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    padding: "10px 12px",
    background: "rgba(0,0,0,.85)",
    color: "#fff",
    borderRadius: "6px",
    zIndex: "2147483647",
  });
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1800);
}

/* --------------------------- Init & listeners -------------------------- */

function init() {
  // First pass after initial Notion mount (it renders progressively)
  ensureUiDebounced();

  // Watch DOM for SPA re-renders (Notion/Jira update the tree a lot)
  const mo = new MutationObserver(() => ensureUiDebounced());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Watch URL changes (SPA route transitions without reload)
  let lastHref = location.href;
  setInterval(() => {
    if (lastHref !== location.href) {
      lastHref = location.href;
      ensureUiDebounced();
    }
  }, 500);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
