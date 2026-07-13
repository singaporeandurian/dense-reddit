/* =============================================================================
 * Threadline — content/settings.js
 * Settings store for the content script. Reads/writes chrome.storage.sync
 * (partial blobs merged over TLSchema.DEFAULTS) and re-emits changes on the
 * TL bus so the compactor restyles live — including changes made from the
 * popup, options page, side panel, other tabs, or the Alt+R command handled
 * in the service worker.
 * =========================================================================== */
"use strict";

TL.settings = (() => {
  const { KEY, DEFAULTS, deepMerge, deepClone, normalizeSettings } = globalThis.TLSchema;

  let current = deepClone(DEFAULTS);
  let ready = false;

  async function load() {
    if (!globalThis.chrome?.storage?.sync) { ready = true; return current; }
    try {
      const got = await chrome.storage.sync.get(KEY);
      current = normalizeSettings(got[KEY]);
    } catch (e) {
      console.warn("[Threadline] settings load failed, using defaults:", e);
    }
    ready = true;
    return current;
  }

  /** Global settings (no subreddit override applied). */
  function get() {
    return current;
  }

  /** Settings effective for a subreddit (per-subreddit override applied). */
  function forSubreddit(subreddit) {
    if (!subreddit) return current;
    const key = String(subreddit).toLowerCase();
    const override = current.subredditOverrides?.[key];
    return override ? deepMerge(current, override) : current;
  }

  /** Deep-merge a patch into settings and persist. Triggers tl:settings
   *  everywhere via the storage.onChanged listener below. */
  async function update(patch) {
    current = deepMerge(current, patch);
    try {
      await chrome.storage.sync.set({ [KEY]: current });
    } catch (e) {
      console.warn("[Threadline] settings save failed:", e);
      TL.bus.dispatchEvent(new CustomEvent("tl:settings")); // restyle locally anyway
    }
  }

  async function setSubredditOverride(subreddit, partial) {
    const key = String(subreddit).toLowerCase();
    return update({ subredditOverrides: { [key]: partial } });
  }

  async function clearSubredditOverride(subreddit) {
    const key = String(subreddit).toLowerCase();
    const overrides = deepClone(current.subredditOverrides || {});
    delete overrides[key];
    current.subredditOverrides = overrides;
    await chrome.storage.sync.set({ [KEY]: current });
  }

  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !changes[KEY]) return;
      current = normalizeSettings(changes[KEY].newValue);
      TL.bus.dispatchEvent(new CustomEvent("tl:settings"));
    });
  }

  return {
    load, get, forSubreddit, update,
    setSubredditOverride, clearSubredditOverride,
    isReady: () => ready
  };
})();
