/* =============================================================================
 * Threadline — content/minimap.js
 * Comment mini-map (spec §4 should-have): a slim fixed strip on the right
 * edge of comments pages. One tick per top-level comment, a translucent
 * block for the current viewport; click a tick to jump to that comment,
 * click anywhere else to scroll proportionally. Hidden for short threads.
 *
 * Reads only extension-owned [data-tl='comment'] hooks (depth comes from the
 * --tl-depth custom property the compactor stamps) — no Reddit selectors.
 * =========================================================================== */
"use strict";

TL.minimap = (() => {
  const MIN_TOPLEVEL = 5;

  let host = null;
  let root = null;
  let stripEl = null;
  let marksEl = null;
  let viewEl = null;
  let shown = false;

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    ${TL.themeTokensCSS}
    #strip {
      position: fixed; right: 4px; top: 72px; bottom: 16px; width: 14px;
      z-index: 2147483000; border-radius: 7px;
      background: color-mix(in srgb, var(--tl-ui-fg) 12%, transparent); cursor: pointer;
    }
    #view {
      position: absolute; left: 0; right: 0;
      background: color-mix(in srgb, var(--tl-ui-accent) 28%, transparent);
      border-radius: 7px;
      pointer-events: none; min-height: 8px;
    }
    .mark {
      position: absolute; left: 3px; right: 3px; height: 3px;
      border-radius: 1.5px; background: var(--tl-ui-muted); opacity: .85;
    }
    .mark:hover { background: var(--tl-ui-accent); opacity: 1; }
  `;

  function ensureHost() {
    if (root && host?.isConnected) return;
    host = document.createElement("tl-minimap");
    root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    stripEl = document.createElement("div");
    stripEl.id = "strip";
    viewEl = document.createElement("div");
    viewEl.id = "view";
    marksEl = document.createElement("div");
    stripEl.append(viewEl, marksEl);
    stripEl.addEventListener("click", (e) => {
      // Marker clicks are handled on the marker itself (stopPropagation).
      const r = stripEl.getBoundingClientRect();
      const frac = (e.clientY - r.top) / Math.max(1, r.height);
      const docH = document.documentElement.scrollHeight;
      scrollTo({
        top: frac * docH - innerHeight / 2,
        behavior: TL.dom.prefersReducedMotion() ? "auto" : "smooth"
      });
    });
    root.append(style, stripEl);
    (document.body || document.documentElement).appendChild(host);
  }

  function setShown(on) {
    if (on) ensureHost();
    if (on === shown && host?.isConnected === on) return;
    shown = on;
    if (host) host.style.display = on ? "" : "none";
  }

  function depthOf(el) {
    return parseInt(el.style.getPropertyValue("--tl-depth") || "0", 10) || 0;
  }

  function updateViewport() {
    if (!shown || !viewEl) return;
    const docH = Math.max(1, document.documentElement.scrollHeight);
    viewEl.style.top = (scrollY / docH * 100) + "%";
    viewEl.style.height = (innerHeight / docH * 100) + "%";
  }

  function update() {
    const route = TL.router.route;
    const s = TL.settings.forSubreddit(route.subreddit);
    if (route.type !== "comments" || !s.enabled || !s.comments.minimap) {
      setShown(false);
      return;
    }

    const topLevel = Array.from(document.querySelectorAll("[data-tl='comment']"))
      .filter((el) => depthOf(el) === 0 && TL.dom.visible(el));
    if (topLevel.length < MIN_TOPLEVEL) {
      setShown(false);
      return;
    }

    setShown(true);
    const docH = Math.max(1, document.documentElement.scrollHeight);
    marksEl.textContent = "";
    for (const el of topLevel) {
      const frac = (el.getBoundingClientRect().top + scrollY) / docH;
      const mark = document.createElement("div");
      mark.className = "mark";
      mark.style.top = (frac * 100) + "%";
      const author = TL.extract.comment(el).author;
      if (author) mark.title = `u/${author}`;
      mark.addEventListener("click", (e) => {
        e.stopPropagation();
        el.scrollIntoView({
          block: "center",
          behavior: TL.dom.prefersReducedMotion() ? "auto" : "smooth"
        });
      });
      marksEl.appendChild(mark);
    }
    updateViewport();
  }

  let scrollScheduled = false;
  function onScroll() {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(() => {
      scrollScheduled = false;
      updateViewport();
    });
  }

  function init() {
    TL.bus.addEventListener("tl:pass", update);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
  }

  return { init, update };
})();
