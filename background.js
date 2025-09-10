// Tab Group Sync – background.js (service worker)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const action = msg?.cmd || msg?.type;
  const payload = msg?.payload || {};

  if (action === "OPEN_URLS") {
    handleOpenUrls(sender, payload).then(sendResponse);
    return true; // async
  }
  if (action === "GET_GROUP_URLS") {
    handleGetGroupUrls(sender).then(sendResponse);
    return true; // async
  }
});

function normalize(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}

async function handleGetGroupUrls(sender) {
  const tab = sender?.tab;
  if (!tab) return { groupId: -1, urls: [] };
  if (tab.groupId === -1) return { groupId: -1, urls: [] };

  const tabs = await chrome.tabs.query({ groupId: tab.groupId });

  const here = normalize(tab.url);
  const urls = [...new Set(
    tabs
      .map(t => normalize(t.url))
      .filter(u => u && u !== here) // exclude current tab URL
  )];

  return { groupId: tab.groupId, urls };
}

async function handleOpenUrls(sender, payload) {
  const tab = sender?.tab;
  if (!tab) return { openedCount: 0, groupId: -1 };

  const urls = (payload?.urls || []).map(normalize).filter(Boolean);
  if (!urls.length) return { openedCount: 0, groupId: -1 };

  let groupId = tab.groupId;
  if (groupId === -1) {
    // Create a fresh group named after the current page
    groupId = await chrome.tabs.group({ tabIds: [tab.id] });
    const title = payload?.pageTitle || tab.title || "Tab Group";
    await chrome.tabGroups.update(groupId, { title });
  }

  // Build a lookup of all open tabs by normalized URL
  const allTabs = await chrome.tabs.query({});
  const byUrl = new Map();
  for (const t of allTabs) {
    const n = normalize(t.url);
    if (n) byUrl.set(n, t);
  }

  let opened = 0;
  for (const u of urls) {
    let t = byUrl.get(u);

    if (!t) {
      // Not open in any window yet → create in same window, inactive
      t = await chrome.tabs.create({ url: u, active: false, windowId: tab.windowId });
      opened++;
      byUrl.set(u, t);
    }

    // Ensure tab is in same window as current
    if (t.windowId !== tab.windowId) {
      await chrome.tabs.move(t.id, { windowId: tab.windowId, index: -1 });
    }

    // Ensure tab is in the target group
    await chrome.tabs.group({ groupId, tabIds: [t.id] });
  }

  return { openedCount: opened, groupId };
}