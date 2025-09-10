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

async function handleOpenUrls(sender, payload) {
  const tab = sender?.tab;
  if (!tab) return { openedCount: 0 };
  const urls = (payload?.urls || []).map(normalize).filter(Boolean);
  if (!urls.length) return { openedCount: 0 };

  let groupId = tab.groupId;
  if (groupId === -1) {
    groupId = await chrome.tabs.group({ tabIds: [tab.id] });
    await chrome.tabGroups.update(groupId, { title: payload?.pageTitle || tab.title });
  }

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
      t = await chrome.tabs.create({ url: u, active: false, windowId: tab.windowId });
      opened++;
    }
    if (t.windowId !== tab.windowId) {
      await chrome.tabs.move(t.id, { windowId: tab.windowId, index: -1 });
    }
    await chrome.tabs.group({ groupId, tabIds: [t.id] });
  }

  return { openedCount: opened, groupId };
}
