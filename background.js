// Tab Group Sync – background.js (service worker)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const { cmd, payload } = msg || {};
  if (cmd === "OPEN_URLS") {
    handleOpenUrls(sender, payload).then(sendResponse);
    return true; // async
  }
  if (cmd === "GET_GROUP_URLS") {
    handleGetGroupUrls(sender).then(sendResponse);
    return true;
  }
});

/* ----------------------------- Settings ----------------------------- */

const DEFAULT_SETTINGS_BG = {
  preloadTabs: false, // when true, force-load tabs in background
};

async function getSettingsBg() {
  try {
    const obj = await chrome.storage.sync.get(DEFAULT_SETTINGS_BG);
    return {
      preloadTabs: !!obj.preloadTabs,
    };
  } catch {
    return { ...DEFAULT_SETTINGS_BG };
  }
}

/* ----------------------------- Helpers ------------------------------ */

function normalize(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString();
  } catch (e) {
    return null;
  }
}

async function handleGetGroupUrls(sender) {
  const tab = sender?.tab;
  if (!tab) return { groupId: -1, urls: [] };
  if (tab.groupId === -1) return { groupId: -1, urls: [] };
  const tabs = await chrome.tabs.query({ groupId: tab.groupId });
  const urls = [...new Set(tabs.map(t => normalize(t.url)).filter(Boolean))];
  return { groupId: tab.groupId, urls };
}

/* --------------------------- Preloading ----------------------------- */

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Force-load tabs in background (don’t focus them).
 * - Sets autoDiscardable=false to reduce immediate discards.
 * - Calls reload() to ensure network load starts even if tab is backgrounded.
 * Staggers reloads slightly to avoid a “thundering herd”.
 */
async function preloadTabsInBackground(tabIds) {
  // Limit concurrency a little
  const batchSize = 6;
  for (let i = 0; i < tabIds.length; i += batchSize) {
    const batch = tabIds.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (id) => {
        try {
          // Keep inactive and prevent auto-discard if possible
          await chrome.tabs.update(id, { active: false, autoDiscardable: false });
        } catch {}
        try {
          await chrome.tabs.reload(id);
        } catch {}
      })
    );
    // brief pause between batches
    await sleep(200);
  }
}

/* ------------------------------ OPEN ------------------------------- */

async function handleOpenUrls(sender, payload) {
  const tab = sender?.tab;
  if (!tab) return { openedCount: 0 };

  const urls = (payload?.urls || []).map(normalize).filter(Boolean);
  if (!urls.length) return { openedCount: 0 };

  const { preloadTabs } = await getSettingsBg();

  let groupId = tab.groupId;
  if (groupId === -1) {
    groupId = await chrome.tabs.group({ tabIds: [tab.id] });
    await chrome.tabGroups.update(groupId, { title: payload?.pageTitle || tab.title });
  }

  // Map existing tabs by normalized URL
  const allTabs = await chrome.tabs.query({});
  const byUrl = new Map();
  for (const t of allTabs) {
    const n = normalize(t.url);
    if (n) byUrl.set(n, t);
  }

  let opened = 0;
  const tabsToPreload = [];

  for (const u of urls) {
    let t = byUrl.get(u);

    if (!t) {
      // Create as background tab
      t = await chrome.tabs.create({ url: u, active: false, windowId: tab.windowId });
      opened++;
      byUrl.set(u, t); // keep map in sync
    } else {
      // If the tab exists in another window, move it next to current
      if (t.windowId !== tab.windowId) {
        await chrome.tabs.move(t.id, { windowId: tab.windowId, index: -1 });
        // Refresh reference after move
        t = await chrome.tabs.get(t.id);
      }
      // Keep it inactive
      try { await chrome.tabs.update(t.id, { active: false }); } catch {}
    }

    // Group it
    try {
      await chrome.tabs.group({ groupId, tabIds: [t.id] });
    } catch {}

    tabsToPreload.push(t.id);
  }

  if (preloadTabs && tabsToPreload.length) {
    // Fire and forget; no need to block return
    preloadTabsInBackground(tabsToPreload);
  }

  return { openedCount: opened, groupId };
}