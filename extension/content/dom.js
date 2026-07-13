/* =============================================================================
 * Threadline — content/dom.js
 * Frame-batched pass scheduling + small DOM helpers.
 * MutationObserver callbacks funnel through schedulePass(), which coalesces
 * any number of triggers into at most one compactor pass per animation frame.
 * =========================================================================== */
"use strict";

TL.dom = (() => {
  let scheduled = false;
  const reasons = new Set();

  function schedulePass(reason) {
    reasons.add(reason || "unknown");
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const why = Array.from(reasons).join("+");
      reasons.clear();
      try {
        TL.compactor?.pass(why);
      } catch (e) {
        // Never let a pass failure break Reddit — CSS-only mode keeps working.
        console.warn("[Threadline] pass failed (CSS-only fallback active):", e);
      }
    });
  }

  function text(el) {
    return (el?.textContent || "").trim();
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function inViewport(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.height > 0;
  }

  function prefersReducedMotion() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  return { schedulePass, text, visible, inViewport, prefersReducedMotion };
})();
