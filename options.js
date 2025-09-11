const DEFAULTS = {
  excludeHosts: [
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
  ],
  enabled: { notion: true, jira: true, sheets: true },
  bullet:  { notion: false, jira: false, sheets: false },
  preloadTabs: false,
};

const $ = sel => document.querySelector(sel);

async function load() {
  const obj = await chrome.storage.sync.get(DEFAULTS);

  const exclude = Array.isArray(obj.excludeHosts) ? obj.excludeHosts : DEFAULTS.excludeHosts;
  $("#excludeHosts").value = exclude.join("\n");

  const enabled = Object.assign({}, DEFAULTS.enabled, obj.enabled || {});
  $("#enableNotion").checked = !!enabled.notion;
  $("#enableJira").checked   = !!enabled.jira;
  $("#enableSheets").checked = !!enabled.sheets;

  const bullet = Object.assign({}, DEFAULTS.bullet, obj.bullet || {});
  $("#bulletNotion").checked = !!bullet.notion;
  $("#bulletJira").checked   = !!bullet.jira;
  $("#bulletSheets").checked = !!bullet.sheets;

  $("#preloadTabs").checked  = !!obj.preloadTabs;
}

async function save() {
  const excludeRaw = $("#excludeHosts").value || "";
  const excludeHosts = excludeRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  const enabled = {
    notion: $("#enableNotion").checked,
    jira:   $("#enableJira").checked,
    sheets: $("#enableSheets").checked,
  };

  const bullet = {
    notion: $("#bulletNotion").checked,
    jira:   $("#bulletJira").checked,
    sheets: $("#bulletSheets").checked,
  };

  const preloadTabs = $("#preloadTabs").checked;

  await chrome.storage.sync.set({ excludeHosts, enabled, bullet, preloadTabs });

  const status = $("#status");
  status.textContent = "Saved!";
  setTimeout(() => (status.textContent = ""), 1200);
}

$("#saveBtn").addEventListener("click", save);
document.addEventListener("DOMContentLoaded", load);