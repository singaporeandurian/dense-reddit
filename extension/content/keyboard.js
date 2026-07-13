/* =============================================================================
 * Threadline — content/keyboard.js
 * Keyboard navigation (spec §16). Listens in the capture phase so we run
 * ahead of Reddit's own handlers, but ONLY consumes keys we handle, and never
 * while the user is typing (checked via composedPath so focus inside Reddit's
 * open shadow roots is detected too).
 * =========================================================================== */
"use strict";

TL.keyboard = (() => {
  let items = [];
  let index = -1;
  let gPressedAt = 0;
  let lastHiddenId = null;
  let peeking = false;

  const TYPING_SELECTOR = [
    "input", "textarea", "select",
    "[contenteditable='']", "[contenteditable='true']", "[contenteditable='plaintext-only']",
    "shreddit-composer", "comment-composer-host", "faceplate-search-input",
    "shreddit-markdown-composer", "[role='textbox']"
  ].join(", ");

  function isTyping(ev) {
    const target = ev.composedPath?.()[0] || ev.target;
    if (!(target instanceof Element)) return false;
    return !!target.closest(TYPING_SELECTOR);
  }

  function settingsNow() {
    return TL.settings.forSubreddit(TL.router.route.subreddit);
  }

  function isCommentsRoute() {
    return TL.router.route.type === "comments";
  }

  function collect() {
    const sel = isCommentsRoute() ? "[data-tl='comment']" : "[data-tl='post']";
    items = Array.from(document.querySelectorAll(sel)).filter((el) =>
      !el.hasAttribute("data-tl-hidden") &&
      el.getAttribute("data-tl-filtered") !== "hide" &&
      TL.dom.visible(el)
    );
    if (index >= items.length) index = items.length - 1;
  }

  function select(i, { scroll = true } = {}) {
    if (!items.length) return;
    index = Math.max(0, Math.min(items.length - 1, i));
    document.querySelectorAll("[data-tl-selected]")
      .forEach((el) => el.removeAttribute("data-tl-selected"));
    const el = items[index];
    el.setAttribute("data-tl-selected", "");
    if (scroll) {
      el.scrollIntoView({
        block: "center",
        behavior: TL.dom.prefersReducedMotion() ? "auto" : "smooth"
      });
    }
    if (!isCommentsRoute()) {
      const m = TL.extract.post(el);
      if (m?.id && settingsNow().privacy.storeReadHistory) TL.readstate.markSeen(m.id);
    }
  }

  function selected() {
    return index >= 0 ? items[index] : null;
  }

  function selectedModel() {
    const el = selected();
    if (!el) return null;
    return isCommentsRoute() ? TL.extract.comment(el) : TL.extract.post(el);
  }

  function firstOnScreen() {
    const i = items.findIndex((el) => TL.dom.inViewport(el));
    return i === -1 ? 0 : i;
  }

  function move(delta) {
    collect();
    if (!items.length) return;
    if (index === -1 || !selected()?.isConnected) select(firstOnScreen());
    else select(index + delta);
  }

  function depthOf(el) {
    return parseInt(el.style.getPropertyValue("--tl-depth") || "0", 10) || 0;
  }

  function moveTopLevel(dir) {
    collect();
    if (!items.length) return;
    let i = index === -1 ? firstOnScreen() : index;
    while (true) {
      i += dir;
      if (i < 0 || i >= items.length) return;
      if (depthOf(items[i]) === 0) { select(i); return; }
    }
  }

  function jumpToParent() {
    collect();
    const el = selected();
    if (!el) return;
    const d = depthOf(el);
    for (let i = index - 1; i >= 0; i--) {
      if (depthOf(items[i]) < d) { select(i); return; }
    }
  }

  function openSelected(kind) {
    const el = selected();
    if (!el) return;

    if (isCommentsRoute()) {
      const c = TL.extract.comment(el);
      if (c.permalink) location.assign(c.permalink);
      return;
    }

    const m = TL.extract.post(el);
    if (kind === "outbound" && m.contentHref &&
        !/^https?:\/\/(www\.)?reddit\.com\//i.test(m.contentHref)) {
      window.open(m.contentHref, "_blank", "noopener");
      if (m.id) TL.readstate.markSeen(m.id);
      return;
    }
    // Prefer Reddit's own SPA navigation via the real title link.
    const link = TL.selectors.within(el, "postTitleLink");
    if (m.id) TL.readstate.markSeen(m.id);
    if (link) link.click();
    else if (m.permalink) location.assign(m.permalink);
  }

  function hideSelectedPost() {
    const el = selected();
    if (!el) return;
    const m = TL.extract.post(el);
    if (!m.id) { TL.overlay.toast("Can't hide — no stable post id found"); return; }
    TL.readstate.hide(m.id);
    lastHiddenId = m.id;
    el.setAttribute("data-tl-hidden", "");
    TL.overlay.toast("Hidden locally — press z to undo");
    collect();
    if (items.length) select(Math.min(index === -1 ? 0 : index, items.length - 1), { scroll: false });
  }

  function undoHide() {
    if (!lastHiddenId) return;
    TL.readstate.unhide(lastHiddenId);
    lastHiddenId = null;
    TL.dom.schedulePass("undo-hide");
    TL.overlay.toast("Restored");
  }

  function setCollapsed(el, collapsed) {
    try {
      if (collapsed) el.setAttribute("collapsed", "");
      else el.removeAttribute("collapsed");
    } catch { /* non-shreddit markup — no reliable collapse hook */ }
  }

  /** q — toggle the reading queue for the relevant post: the selected feed
   *  post, or (on a comments page) the post being read. */
  function queueRelevantPost() {
    let el = null;
    if (isCommentsRoute()) el = TL.selectors.resolveFirst("post");
    else el = selected();
    if (!el) { TL.overlay.toast("Select a post first (j/k), then press q"); return; }
    const result = TL.queue.toggle(TL.extract.post(el));
    const n = TL.queue.list().length;
    if (result === "added") TL.overlay.toast(`Queued — ${n} in queue (Q to open)`);
    else if (result === "removed") TL.overlay.toast(`Removed from queue — ${n} left`);
    else TL.overlay.toast("Can't queue — no stable post link found");
  }

  /** a/d — forward to Reddit's native upvote/downvote for the selected post
   *  or comment. direction: "upvote" | "downvote". Native action forwarding
   *  (spec §31): if the control can't be found, tell the user rather than
   *  fail silently — voting can't fall back to a native page open like save
   *  can, since there's no single control to land on. */
  function forwardVote(direction) {
    const el = selected();
    if (!el) { TL.overlay.toast("Select a post first (j/k)"); return; }
    const kind = isCommentsRoute() ? "comment" : "post";
    const btn = TL.selectors.findNativeAction(kind, el, direction);
    if (!btn) { TL.overlay.toast("Vote control not found here"); return; }
    btn.click();
  }

  /** s — forward to Reddit's native Save for the selected feed post. Save
   *  isn't always a direct action-bar button (and couldn't be verified
   *  logged-out at all — Reddit appears to omit it without an account), so
   *  this tries the overflow menu next, then falls back to opening the post
   *  natively per spec §31 ("Native action forwarding fails -> open native
   *  post page instead of simulating click"). */
  function forwardSave() {
    const el = selected();
    if (!el) { TL.overlay.toast("Select a post first (j/k)"); return; }

    const direct = TL.selectors.findNativeAction("post", el, "save");
    if (direct) { direct.click(); TL.overlay.toast("Saved (native)"); return; }

    const trigger = TL.selectors.findOverflowTrigger("post", el);
    if (!trigger) { openPostForSave(el); return; }

    trigger.click();
    setTimeout(() => {
      const item = Array.from(document.querySelectorAll("[role='menuitem'], [role='menuitemradio']"))
        .find((mi) => /^save$/i.test((mi.textContent || "").trim()));
      if (item) { item.click(); TL.overlay.toast("Saved (native)"); }
      else { trigger.click(); openPostForSave(el); } // close the menu we opened, then fall back
    }, 250);
  }

  function openPostForSave(el) {
    const m = TL.extract.post(el);
    if (!m.permalink) { TL.overlay.toast("Save control not found here"); return; }
    TL.overlay.toast("Save control not found — opening the post to save there");
    window.open(m.permalink, "_blank", "noopener");
  }

  function cycleThumbnails() {
    const order = ["off", "small", "large"];
    const cur = TL.settings.get().feed.thumbnails;
    const next = order[(order.indexOf(cur) + 1) % order.length];
    TL.settings.update({ feed: { thumbnails: next } });
    TL.overlay.toast(`Thumbnails: ${next}`);
  }

  function focusSearch() {
    const el = TL.selectors.resolveFirst("searchInput");
    if (!el) return false;
    const input = el.matches?.("input") ? el
      : el.shadowRoot?.querySelector("input") || el.querySelector?.("input");
    (input || el).focus?.();
    return true;
  }

  /** Hold-Alt peek (spec §27.2): reveal native Reddit while Alt is down. */
  function peek(on) {
    if (on === peeking) return;
    peeking = on;
    TL.compactor.setPeek(on);
  }

  function handleGSequence(key) {
    const route = TL.router.route;
    if (key === "h") { location.assign("/"); return true; }
    if (key === "n" && route.subreddit) {
      location.assign(`/r/${route.subreddit}/new/`);
      return true;
    }
    if (key === "s" && route.subreddit) {
      location.assign(`/r/${route.subreddit}/top/?t=week`);
      return true;
    }
    return false;
  }

  function onKeydown(ev) {
    const s = settingsNow();
    if (!s.keyboard?.enabled) return;

    // Bare-Alt peek works even while typing is focused elsewhere.
    if (ev.key === "Alt" && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
      if (!ev.repeat && s.enabled) peek(true);
      return;
    }
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (isTyping(ev)) return;
    if (TL.palette?.isOpen()) return; // palette owns its keys

    if (ev.key === "Escape") { TL.overlay.hideAll(); return; }
    if (!s.enabled) return;

    // g-prefix sequences (g h, g n, g s)
    if (gPressedAt && Date.now() - gPressedAt < 900) {
      gPressedAt = 0;
      if (handleGSequence(ev.key)) { ev.preventDefault(); ev.stopPropagation(); return; }
    }

    const comments = isCommentsRoute();
    // spec §17 keyboard.vimNavigation: turning this off disables the
    // movement keys (j/k/J/K/p/u/[/]/g-sequences) while action keys
    // (hide/vote/save/queue/etc.) and non-letter shortcuts stay available —
    // "navigation" is the part that's vim-specific here, not the whole
    // keyboard scheme.
    const vimNav = s.keyboard.vimNavigation !== false;
    let handled = true;

    switch (ev.key) {
      case "j": if (vimNav) move(1); else handled = false; break;
      case "k": if (vimNav) move(-1); else handled = false; break;
      case "J": if (!vimNav) handled = false; else if (comments) moveTopLevel(1); else move(1); break;
      case "K": if (!vimNav) handled = false; else if (comments) moveTopLevel(-1); else move(-1); break;
      case "Enter": openSelected("comments"); break;
      case "c": openSelected("comments"); break;
      case "o": openSelected("outbound"); break;
      case "h":
        if (comments) { const el = selected(); if (el) setCollapsed(el, true); }
        else hideSelectedPost();
        break;
      case "l":
        if (comments) { const el = selected(); if (el) setCollapsed(el, false); }
        else handled = false;
        break;
      case "p": if (vimNav && comments) jumpToParent(); else handled = false; break;
      case "z": undoHide(); break;
      case "a": forwardVote("upvote"); break;
      case "d": forwardVote("downvote"); break;
      case "s": if (comments) handled = false; else forwardSave(); break;
      case "q": queueRelevantPost(); break;
      case "Q": TL.queue.openPanel(!TL.queue.isPanelOpen()); break;
      case "m": cycleThumbnails(); break;
      case "u":
        if (vimNav && comments && TL.router.route.subreddit) {
          location.assign(`/r/${TL.router.route.subreddit}/`);
        } else handled = false;
        break;
      case "[": handled = vimNav && TL.splitpane.openRelative(-1); break;
      case "]": handled = vimNav && TL.splitpane.openRelative(1); break;
      case "?": TL.overlay.helpVisible(!TL.overlay.isHelpOpen()); break;
      case ".": TL.palette.open(); break;
      case "/": handled = focusSearch(); break;
      case "g": if (vimNav) gPressedAt = Date.now(); else handled = false; break;
      default: handled = false;
    }

    if (handled) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  function init() {
    addEventListener("keydown", onKeydown, true);
    addEventListener("keyup", (ev) => { if (ev.key === "Alt") peek(false); }, true);
    addEventListener("blur", () => peek(false));
  }

  return { init, selectedModel, collect };
})();
