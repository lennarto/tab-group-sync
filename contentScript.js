// contentScript.js

const IDS = {
  wrap: "tgs-wrap",
  title: "tgs-title",
  openBtn: "tgs-open-btn",
  insertBtn: "tgs-insert-btn",
};

const CTX = {
  isNotion: location.hostname.includes("notion.so"),
  isJira: location.hostname.includes("atlassian.net"),
  isSheets: location.hostname.includes("docs.google.com"),
};

(function init() {
  console.log("[TGS] content script loaded for", location.hostname);

  if (CTX.isNotion) {
    watchNotion();
  } else if (CTX.isJira || CTX.isSheets) {
    mountUi();
  }
})();

// ----------------- Notion handling -----------------
function watchNotion() {
  const observer = new MutationObserver(() => {
    const isPage =
      document.querySelector(".notion-page-content") &&
      (document.querySelector("h1[contenteditable]") ||
        document.querySelector(".notion-page-controls") ||
        /[a-f0-9]{32}/.test(location.pathname));

    if (isPage) {
      mountUi();
    } else {
      unmountUi();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ----------------- UI -----------------
function mountUi() {
  if (document.getElementById(IDS.wrap)) {
    applyTheme();
    return;
  }

  const wrap = document.createElement("div");
  wrap.id = IDS.wrap;
  Object.assign(wrap.style, {
    position: "fixed",
    top: "180px", // ⬅️ moved lower
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
    color: "#555", // neutral dark grey
  });

  const openBtn = mkBtn(IDS.openBtn, "👉 Open all URLs", palette().cyan);
  const insertBtn = mkBtn(IDS.insertBtn, "🔗 Copy all URLs", palette().pink);

  wrap.append(title, openBtn, insertBtn);
  document.body.appendChild(wrap);

  openBtn.addEventListener("click", onOpenUrls);
  insertBtn.addEventListener("click", onInsertOrCopy);

  console.log("[TGS] UI mounted for", CTX);
}

function unmountUi() {
  const el = document.getElementById(IDS.wrap);
  if (el) el.remove();
}

function applyTheme() {
  const title = document.getElementById(IDS.title);
  if (title) title.style.color = "#555"; // keep dark grey

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

// ----------------- Helpers -----------------
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
    transition: "all 0.2s ease",
  });
  btn.onmouseenter = () => {
    btn.style.background = color;
    btn.style.color = "#fff";
  };
  btn.onmouseleave = () => {
    btn.style.background = "transparent";
    btn.style.color = color;
  };
  return btn;
}

function palette() {
  const cyan = "#2fa7d9"; // darker blue
  const pink = "#ff4d6d"; // brighter red
  return { cyan, pink };
}

// ----------------- Actions -----------------
function onOpenUrls() {
  chrome.runtime.sendMessage({ type: "OPEN_URLS" });
}

function onInsertOrCopy() {
  chrome.runtime.sendMessage({ type: "INSERT_OR_COPY_URLS" });
}
