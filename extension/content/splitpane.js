/* =============================================================================
 * Threadline — content/splitpane.js
 * Mode C — Split Pane (spec §5.1/§14.3). Reddit stays the navigator (no
 * iframes, no fetch): while you browse a feed we snapshot the ordered post
 * list into sessionStorage (per-tab, survives SPA nav and reloads); on a
 * comments page in split-pane mode that list renders as a fixed left rail —
 * feed on the left, thread on the right, like an inbox. Click a row or press
 * [ / ] to move to the previous/next post without returning to the feed.
 *
 * Reads only extension-owned [data-tl='post'] hooks — no Reddit selectors.
 * =========================================================================== */
"use strict";

TL.splitpane = (() => {
  const KEY = "tl_feedlist_v1";
  const CAP = 200;
  const MIN_WIDTH = 1100; // px — below this the rail would crush the thread

  let host = null;
  let root = null;
  let listEl = null;
  let lastIds = "";
  let railShown = false;

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    ${TL.themeTokensCSS}
    #rail {
      position: fixed; left: 0; top: 56px; bottom: 0;
      width: var(--w, 304px); z-index: 1000;
      display: flex; flex-direction: column;
      font: 12.5px/1.35 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      background: var(--tl-ui-bg); color: var(--tl-ui-fg);
      border-right: 1px solid var(--tl-ui-border);
    }
    header {
      padding: 8px 12px; font-weight: 600; font-size: 11px;
      text-transform: uppercase; letter-spacing: .06em; color: var(--tl-ui-muted);
      flex: none;
    }
    ul { list-style: none; margin: 0; padding: 0 6px 12px; overflow-y: auto; flex: 1; }
    li {
      padding: 6px 8px; border-radius: 6px; cursor: pointer;
      border-left: 3px solid transparent; margin-bottom: 1px;
    }
    li:hover { background: color-mix(in srgb, var(--tl-ui-fg) 8%, transparent); }
    li.current {
      border-left-color: var(--tl-ui-accent);
      background: color-mix(in srgb, var(--tl-ui-accent) 8%, transparent);
    }
    li .t {
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    li .m { color: var(--tl-ui-muted); font-size: 11px; margin-top: 1px; }
  `;

  /* ---- Capture: feed pages → sessionStorage -------------------------------- */
  function snapshotFeed() {
    const posts = Array.from(document.querySelectorAll("[data-tl='post']"))
      .filter((el) =>
        !el.hasAttribute("data-tl-hidden") &&
        el.getAttribute("data-tl-filtered") !== "hide" &&
        !el.hasAttribute("data-tl-promoted"));
    if (!posts.length) return;

    const items = [];
    for (const el of posts) {
      const m = TL.extract.post(el);
      if (!m?.id || !m?.permalink || !m.title) continue;
      items.push({
        id: m.id,
        title: m.title,
        permalink: m.permalink,
        subreddit: m.subreddit || null
      });
      if (items.length >= CAP) break;
    }
    if (!items.length) return;

    const ids = items.map((x) => x.id).join(",");
    if (ids === lastIds) return; // unchanged since last pass — skip the write
    lastIds = ids;
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), items }));
    } catch { /* storage full/blocked — rail simply won't show */ }
  }

  function storedList() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || "null")?.items || [];
    } catch {
      return [];
    }
  }

  /** "t3_abc123" matches route postId "abc123". */
  function isCurrent(item, postId) {
    return !!postId && (item.id === `t3_${postId}` || item.id === postId);
  }

  /* ---- Rail rendering -------------------------------------------------------- */
  function ensureHost() {
    if (root && host?.isConnected) return;
    host = document.createElement("tl-rail");
    root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    const rail = document.createElement("div");
    rail.id = "rail";
    const header = document.createElement("header");
    header.textContent = "Feed — [ and ] to move";
    listEl = document.createElement("ul");
    listEl.setAttribute("role", "listbox");
    listEl.setAttribute("aria-label", "Your feed");
    rail.append(header, listEl);
    root.append(style, rail);
    (document.body || document.documentElement).appendChild(host);
  }

  function setRailShown(on) {
    if (on === railShown && host?.isConnected === on) return;
    railShown = on;
    const html = document.documentElement;
    if (on) {
      ensureHost();
      host.style.display = "";
      html.setAttribute("data-tl-rail", "1");
    } else {
      if (host) host.style.display = "none";
      html.removeAttribute("data-tl-rail");
    }
  }

  function renderRail(items, postId) {
    ensureHost();
    listEl.textContent = "";
    let currentLi = null;
    for (const item of items) {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      const current = isCurrent(item, postId);
      li.setAttribute("aria-selected", current ? "true" : "false");
      if (current) { li.classList.add("current"); currentLi = li; }
      const t = document.createElement("div");
      t.className = "t";
      t.textContent = item.title;
      const m = document.createElement("div");
      m.className = "m";
      m.textContent = item.subreddit ? `r/${item.subreddit}` : "";
      li.append(t, m);
      li.addEventListener("click", () => location.assign(item.permalink));
      listEl.appendChild(li);
    }
    currentLi?.scrollIntoView({ block: "center" });
  }

  /* ---- Orchestration ---------------------------------------------------------- */
  function update() {
    const route = TL.router.route;
    const s = TL.settings.forSubreddit(route.subreddit);

    if (["home", "subreddit", "search", "user"].includes(route.type)) {
      if (s.enabled) snapshotFeed();
      setRailShown(false);
      return;
    }

    if (route.type !== "comments" || !s.enabled || s.mode !== "split-pane" ||
        innerWidth < MIN_WIDTH) {
      setRailShown(false);
      return;
    }

    const items = storedList();
    if (!items.length) { setRailShown(false); return; }
    setRailShown(true);
    renderRail(items, route.postId);
  }

  /** [ / ] — open the previous/next post from the captured feed list.
   *  Returns false when there is nothing to navigate (key falls through). */
  function openRelative(delta) {
    if (TL.router.route.type !== "comments") return false;
    const items = storedList();
    if (!items.length) return false;

    const postId = TL.router.route.postId;
    const idx = items.findIndex((item) => isCurrent(item, postId));
    let target;
    if (idx === -1) {
      target = delta > 0 ? items[0] : items[items.length - 1];
    } else {
      const next = idx + delta;
      if (next < 0 || next >= items.length) {
        TL.overlay.toast(next < 0 ? "Start of your feed list" : "End of your feed list");
        return true;
      }
      target = items[next];
    }
    location.assign(target.permalink);
    return true;
  }

  let resizeTimer = null;
  function init() {
    TL.bus.addEventListener("tl:pass", update);
    addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(update, 200);
    });
  }

  return { init, update, openRelative, KEY };
})();
