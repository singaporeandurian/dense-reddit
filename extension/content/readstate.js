/* =============================================================================
 * Threadline — content/readstate.js
 * Local-only seen/hidden history in chrome.storage.local (spec §18).
 * A post dims as "seen" only if it was first seen BEFORE this pageview —
 * otherwise everything would dim while you scroll.
 * Writes are debounced; entries expire (seen: settings TTL, hidden: 90 days).
 * =========================================================================== */
"use strict";

TL.readstate = (() => {
  const KEY = "tl_read_v1";
  const DAY = 86400000;
  const HIDDEN_TTL = 90 * DAY;

  let map = {};            // id -> { f: firstSeenAt, l: lastSeenAt, st: "seen"|"hidden" }
  let dirty = false;
  let timer = null;
  const sessionStart = Date.now();

  async function load(ttlDays) {
    if (!globalThis.chrome?.storage?.local) return;
    try {
      const got = await chrome.storage.local.get(KEY);
      map = got[KEY]?.posts || {};
      const ttl = Math.max(1, ttlDays || 30) * DAY;
      const now = Date.now();
      let pruned = false;
      for (const [id, r] of Object.entries(map)) {
        const limit = r.st === "hidden" ? HIDDEN_TTL : ttl;
        if (now - (r.l || 0) > limit) { delete map[id]; pruned = true; }
      }
      if (pruned) persistSoon();
    } catch (e) {
      console.warn("[Threadline] read-state load failed (dimming disabled):", e);
      map = {};
    }
  }

  function flushNow() {
    if (!dirty || !globalThis.chrome?.storage?.local) return;
    dirty = false;
    chrome.storage.local.set({ [KEY]: { v: 1, posts: map } }).catch(() => { dirty = true; });
  }

  function persistSoon() {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flushNow, 3000);
  }

  function markSeen(id) {
    if (!id) return;
    const now = Date.now();
    const r = map[id] || (map[id] = { f: now, st: "seen" });
    r.l = now;
    persistSoon();
  }

  function hide(id) {
    if (!id) return;
    const now = Date.now();
    const r = map[id] || (map[id] = { f: now });
    r.l = now;
    r.st = "hidden";
    persistSoon();
  }

  function unhide(id) {
    if (map[id]?.st === "hidden") {
      map[id].st = "seen";
      persistSoon();
    }
  }

  function isHidden(id) {
    return map[id]?.st === "hidden";
  }

  /** True only when the post was already known before this pageview. */
  function wasSeenBefore(id) {
    const r = map[id];
    return !!r && r.f < sessionStart - 3000;
  }

  async function clearAll() {
    map = {};
    dirty = false;
    if (globalThis.chrome?.storage?.local) await chrome.storage.local.remove(KEY);
  }

  // Flush pending writes when the tab is backgrounded/closed.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });

  return { load, markSeen, hide, unhide, isHidden, wasSeenBefore, clearAll, KEY };
})();
