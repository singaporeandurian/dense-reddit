/* =============================================================================
 * Threadline — popup/popup.js
 * Quick controls. Reads the merged settings, writes partial patches back to
 * chrome.storage.sync; content scripts restyle live via storage.onChanged.
 * =========================================================================== */
"use strict";

const { KEY, deepMerge, PRESET_THUMBS, normalizeSettings } = globalThis.TLSchema;

let settings = null;
let activeTab = null;
let tabSubreddit = null;

const $ = (id) => document.getElementById(id);

async function loadSettings() {
  const got = await chrome.storage.sync.get(KEY);
  settings = normalizeSettings(got[KEY]);
}

/** Density/viral meter (spec §27.1) — written by compactor.js's one-time
 *  measurement, shown here as a persistent stat since the in-page toast
 *  disappears after a few seconds. */
async function renderDensityStat() {
  const got = await chrome.storage.local.get("tl_density_v1");
  const stat = got.tl_density_v1;
  const el = $("densityStat");
  if (!stat || !Number.isFinite(stat.before) || !Number.isFinite(stat.after)) {
    el.hidden = true;
    return;
  }
  const pctText = stat.pct !== null && stat.pct > 0 ? ` (+${stat.pct}%)` : "";
  el.textContent = `Last measured: ${stat.before} → ${stat.after} posts visible${pctText}`;
  el.hidden = false;
}

async function save(patch) {
  settings = deepMerge(settings, patch);
  await chrome.storage.sync.set({ [KEY]: settings });
  render();
}

function render() {
  $("enabled").checked = settings.enabled;
  $("mode").value = ["native-clean", "split-pane"].includes(settings.mode)
    ? settings.mode : "compact-reader";
  $("thumbnails").value = settings.feed.thumbnails;
  $("hideSidebars").checked = settings.layout.hideLeftSidebar && settings.layout.hideRightSidebar;
  $("dimSeen").checked = settings.feed.dimSeenPosts;
  $("hidePromoted").checked = settings.feed.hidePromoted;
  $("keyboard").checked = settings.keyboard.enabled;

  document.querySelectorAll("#density button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.preset === settings.density.preset);
  });

  if (tabSubreddit) {
    $("subredditSection").hidden = false;
    $("saveOverride").textContent =
      `Use current density on r/${tabSubreddit} only`;
    const hasOverride = !!settings.subredditOverrides?.[tabSubreddit.toLowerCase()];
    $("clearOverride").hidden = !hasOverride;
    $("clearOverride").textContent = `Clear r/${tabSubreddit} override`;
  }
}

function subredditFromUrl(url) {
  const m = (url || "").match(/^https:\/\/(?:www|new)\.reddit\.com\/r\/([^/]+)/i);
  return m ? m[1] : null;
}

function wire() {
  $("enabled").addEventListener("change", (e) => save({ enabled: e.target.checked }));
  $("mode").addEventListener("change", (e) => save({ mode: e.target.value }));
  $("thumbnails").addEventListener("change", (e) => save({ feed: { thumbnails: e.target.value } }));
  $("dimSeen").addEventListener("change", (e) => save({ feed: { dimSeenPosts: e.target.checked } }));
  $("hidePromoted").addEventListener("change", (e) => save({ feed: { hidePromoted: e.target.checked } }));
  $("keyboard").addEventListener("change", (e) => save({ keyboard: { enabled: e.target.checked } }));
  $("hideSidebars").addEventListener("change", (e) => save({
    layout: { hideLeftSidebar: e.target.checked, hideRightSidebar: e.target.checked }
  }));

  document.querySelectorAll("#density button").forEach((btn) => {
    btn.addEventListener("click", () => save({
      density: { preset: btn.dataset.preset },
      feed: { thumbnails: PRESET_THUMBS[btn.dataset.preset] }
    }));
  });

  $("saveOverride").addEventListener("click", () => {
    if (!tabSubreddit) return;
    save({
      subredditOverrides: {
        [tabSubreddit.toLowerCase()]: {
          density: { preset: settings.density.preset },
          feed: { thumbnails: settings.feed.thumbnails }
        }
      }
    });
  });

  $("clearOverride").addEventListener("click", async () => {
    if (!tabSubreddit) return;
    delete settings.subredditOverrides[tabSubreddit.toLowerCase()];
    await chrome.storage.sync.set({ [KEY]: settings });
    render();
  });

  $("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("openSidePanel").addEventListener("click", async () => {
    if (activeTab?.windowId !== undefined) {
      await chrome.sidePanel.open({ windowId: activeTab.windowId }).catch(() => {});
      window.close();
    }
  });
  $("resetReddit").addEventListener("click", () => save({ enabled: false }));

  $("layoutCheck").addEventListener("click", async () => {
    const report = $("healthReport");
    report.hidden = false;
    report.textContent = "Checking…";
    if (!activeTab?.id) { report.textContent = "No active tab."; return; }
    try {
      const res = await chrome.tabs.sendMessage(activeTab.id, { type: "TL_HEALTH" });
      report.textContent = "";
      const routeLine = document.createElement("div");
      routeLine.textContent =
        `Page: ${res.route.type}` +
        ` · ${res.counts.posts} posts · ${res.counts.comments} comments` +
        (res.counts.filtered ? ` · ${res.counts.filtered} filtered` : "");
      report.appendChild(routeLine);
      for (const [group, h] of Object.entries(res.health)) {
        const div = document.createElement("div");
        if (h.matched) {
          div.className = "ok";
          div.textContent = `✓ ${group} (${h.count})`;
        } else if (h.expectedHere) {
          div.className = "bad";
          div.textContent = `✗ ${group} — selector needs updating`;
        } else {
          div.className = "na";
          div.textContent = `– ${group} (not expected here)`;
        }
        report.appendChild(div);
      }
    } catch {
      report.textContent =
        "Dense is not active on this page. Open a reddit.com tab and try again.";
    }
  });
}

(async function init() {
  await loadSettings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab || null;
  tabSubreddit = subredditFromUrl(tab?.url);
  wire();
  render();
  await renderDensityStat();
})();
