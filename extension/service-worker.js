/* =============================================================================
 * Threadline — service-worker.js
 * Stateless MV3 event hub: keyboard commands, install seeding, side panel
 * behavior, options-page opener. The Alt+R toggle flips settings in
 * chrome.storage.sync — every reddit tab reacts via storage.onChanged, so no
 * per-tab messaging is needed and all windows stay consistent.
 * =========================================================================== */
"use strict";

importScripts("shared/schema.js");

const { KEY, deepMerge } = globalThis.TLSchema;

chrome.runtime.onInstalled.addListener(async () => {
  const got = await chrome.storage.sync.get(KEY);
  if (!got[KEY]) {
    // Seed a minimal blob; all readers merge over DEFAULTS.
    await chrome.storage.sync.set({ [KEY]: { enabled: true } });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-threadline") {
    const got = await chrome.storage.sync.get(KEY);
    const stored = got[KEY] || {};
    const next = deepMerge(stored, { enabled: stored.enabled === false });
    await chrome.storage.sync.set({ [KEY]: next });
  } else if (command === "open-command-palette") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "TL_OPEN_PALETTE" }).catch(() => {
        /* not a reddit tab — nothing to do */
      });
    }
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "TL_OPEN_OPTIONS") chrome.runtime.openOptionsPage();
});

// Side panel opens from the popup's "Side panel" button, not the action click.
chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
