/* =============================================================================
 * Threadline — content/main.js
 * Boot sequence (loaded last). Runs at document_start:
 *   1. Optimistically activate CSS-only compaction before first paint
 *      (Threadline defaults to enabled; settings load may retract it).
 *   2. Load settings + read history, then run the first full pass.
 *   3. Install mutation observer (rAF-coalesced) — also our SPA route probe.
 *   4. Wire messages from the service worker / popup.
 * If anything in boot throws, the optimistic CSS layer stays on and Reddit
 * remains fully usable (spec §31 fail-safe).
 * =========================================================================== */
"use strict";

(() => {
  if (window.top !== window) return; // never run in embedded frames

  // --- Step 1: pre-paint optimistic activation (pure CSS layer) ------------
  const html = document.documentElement;
  html.classList.add("tl-on");
  const OPTIMISTIC = {
    "data-tl-density": "balanced",
    "data-tl-compact": "1",
    "data-tl-thumbs": "small",
    "data-tl-avatars": "off",
    "data-tl-hover-actions": "1",
    "data-tl-ads": "show",
    "data-tl-dim-seen": "1",
    "data-tl-hide-left": "1",
    "data-tl-hide-right": "1",
    "data-tl-hide-banners": "1",
    "data-tl-hide-highlights": "1",
    "data-tl-hide-prompts": "1"
  };
  for (const [k, v] of Object.entries(OPTIMISTIC)) html.setAttribute(k, v);

  async function boot() {
    TL.router.init();
    await TL.settings.load();
    await TL.readstate.load(TL.settings.get().privacy.readHistoryTtlDays);
    await TL.queue.load();

    TL.splitpane.init();
    TL.minimap.init();
    TL.compactor.pass("boot");
    TL.keyboard.init();

    const observer = new MutationObserver(() => TL.dom.schedulePass("mutation"));
    observer.observe(document.documentElement, { childList: true, subtree: true });

    TL.bus.addEventListener("tl:settings", () => TL.dom.schedulePass("settings"));
    TL.bus.addEventListener("tl:route", () => TL.dom.schedulePass("route"));

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "TL_HEALTH") {
        sendResponse({
          version: TL.version,
          enabled: TL.settings.get().enabled,
          route: TL.router.route,
          counts: TL.compactor.counts(),
          health: TL.selectors.report(TL.router.route.type)
        });
      } else if (msg?.type === "TL_OPEN_PALETTE") {
        TL.palette.open();
      } else if (msg?.type === "TL_TOGGLE") {
        TL.settings.update({ enabled: !TL.settings.get().enabled });
      }
      return false; // all responses are synchronous
    });
  }

  boot().catch((e) => {
    console.warn("[Threadline] boot failed — running in CSS-only fallback mode:", e);
  });
})();
