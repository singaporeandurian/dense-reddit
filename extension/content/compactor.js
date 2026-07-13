/* =============================================================================
 * Threadline — content/compactor.js
 * The per-frame pass: reflect settings onto <html> attributes (which drive
 * ALL the CSS), stamp content nodes with data-tl hooks, apply filters, seen
 * state and promoted handling, and track viewport visits for read history.
 *
 * Passes are cheap and idempotent: node discovery/stamping happens once per
 * node (WeakSet), while filter/seen re-evaluation runs on every pass so
 * settings changes apply live.
 * =========================================================================== */
"use strict";

TL.compactor = (() => {
  const stampedPosts = new WeakSet();
  const stampedComments = new WeakSet();
  let io = null;
  let densityToastShown = false;
  let peeking = false;
  const counts = { posts: 0, comments: 0, filtered: 0 };

  /* ---- Native compact view (see NATIVE_VIEW in selectors.js) -------------
   * Reddit's own component renders a ~50px dense row when view-type is
   * "compactView". We flip it per feed post and park the original value in a
   * data attribute so toggle/peek/native-clean can restore it exactly.
   *
   * SELF-HEAL: Reddit's hydration is inconsistent — SSR'd posts re-render
   * compact correctly, but some client-hydrated posts collapse their light
   * DOM and lose the title. After each flip we verify a title is still
   * visible (light slot OR shadow-rendered from the post-title attribute);
   * if not, that post is reverted to its original view for good and the
   * plain CSS compaction covers it instead. */
  const NV = TL.selectors.NATIVE_VIEW;
  const nativeViewPending = new WeakMap(); // el -> flip timestamp
  const nativeViewReverted = new WeakSet(); // never re-flip these
  let verifyTimer = null;

  function applyNativeView(el, wantCompact) {
    if (!NV.tags.includes(el.tagName)) return;
    if (!wantCompact) { restoreNativeView(el); return; }
    if (nativeViewReverted.has(el)) return;
    if (el.getAttribute(NV.viewTypeAttr) !== NV.compactValue) {
      if (!el.hasAttribute(NV.saveAttr)) {
        el.setAttribute(NV.saveAttr, el.getAttribute(NV.viewTypeAttr) || "cardView");
      }
      el.setAttribute(NV.viewTypeAttr, NV.compactValue);
      nativeViewPending.set(el, Date.now());
      clearTimeout(verifyTimer); // make sure a verify pass runs even if the DOM goes quiet
      verifyTimer = setTimeout(() => TL.dom.schedulePass("native-view-verify"), 900);
    } else {
      verifyNativeView(el);
    }
  }

  function verifyNativeView(el) {
    const flippedAt = nativeViewPending.get(el);
    if (flippedAt === undefined) return;
    if (Date.now() - flippedAt < 600) return; // give lit time to re-render
    if (el.getBoundingClientRect().height === 0) return; // hidden — judge later

    const title = el.querySelector("[slot='title']");
    const lightTitleVisible = !!title && title.getBoundingClientRect().height > 0;
    const titleText = (el.getAttribute("post-title") || "").trim().slice(0, 24);
    const shadowTitleVisible = !!titleText && !!el.shadowRoot &&
      el.shadowRoot.textContent.includes(titleText);

    nativeViewPending.delete(el);
    if (!lightTitleVisible && !shadowTitleVisible) {
      restoreNativeView(el);
      nativeViewReverted.add(el);
    }
  }

  function restoreNativeView(el) {
    const original = el.getAttribute(NV.saveAttr);
    if (original !== null) {
      el.setAttribute(NV.viewTypeAttr, original);
      el.removeAttribute(NV.saveAttr);
    }
  }

  function restoreAllNativeViews() {
    document.querySelectorAll(`[${NV.saveAttr}]`).forEach(restoreNativeView);
  }

  /** Hold-Alt peek: show untouched native Reddit while held. Passes are
   *  suspended so a mid-peek mutation can't re-apply compaction. */
  function setPeek(on) {
    if (on === peeking) return;
    peeking = on;
    if (on) {
      document.documentElement.classList.remove("tl-on");
      restoreAllNativeViews();
    } else {
      applyRootState();
      TL.dom.schedulePass("peek-end");
    }
  }

  function ensureIO() {
    if (io) return io;
    io = new IntersectionObserver((entries) => {
      const s = effectiveSettings();
      if (!s.enabled || !s.privacy.storeReadHistory) return;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const m = TL.extract.post(entry.target);
        if (m?.id) TL.readstate.markSeen(m.id);
      }
    }, { threshold: 0.4 });
    return io;
  }

  function effectiveSettings() {
    return TL.settings.forSubreddit(TL.router.route.subreddit);
  }

  /** Mirror settings onto <html> — the single hand-off point from JS to CSS. */
  function applyRootState() {
    const s = effectiveSettings();
    const html = document.documentElement;
    html.classList.toggle("tl-on", !!s.enabled);
    // Set regardless of enabled — purely cosmetic, no functional gating,
    // and keeps our own overlay UI theme-correct even if it's ever shown
    // while compaction itself is off.
    if (html.getAttribute("data-tl-theme") !== s.theme) html.setAttribute("data-tl-theme", s.theme);
    if (!s.enabled) return s;

    const attrs = {
      "data-tl-density": s.density.preset,
      "data-tl-mode": s.mode,
      "data-tl-compact": s.mode === "native-clean" ? "0" : "1",
      "data-tl-thumbs": s.feed.thumbnails,
      "data-tl-avatars": s.comments.hideAvatars ? "off" : "on",
      "data-tl-hover-actions": s.comments.hideActionsUntilHover ? "1" : "0",
      "data-tl-ads": s.feed.hidePromoted ? "hide" : "show",
      "data-tl-dim-seen": s.feed.dimSeenPosts ? "1" : "0",
      "data-tl-hide-left": s.layout.hideLeftSidebar ? "1" : "0",
      "data-tl-hide-right": s.layout.hideRightSidebar ? "1" : "0",
      "data-tl-hide-banners": s.layout.hideBanners ? "1" : "0",
      "data-tl-hide-highlights": s.layout.hideCommunityHighlights ? "1" : "0",
      "data-tl-hide-prompts": s.layout.hidePrompts ? "1" : "0",
      "data-tl-route": TL.router.route.type
    };
    for (const [name, value] of Object.entries(attrs)) {
      if (html.getAttribute(name) !== value) html.setAttribute(name, value);
    }
    const width = Math.max(600, Number(s.layout.maxContentWidth) || 1040);
    html.style.setProperty("--tl-content-max-width", width + "px");
    return s;
  }

  /** Attribute + ARIA reset for a post that no rule currently matches. */
  function clearRuleAttrs(el) {
    el.removeAttribute("data-tl-filtered");
    el.removeAttribute("data-tl-rule-collapse");
    el.removeAttribute("data-tl-rule-dim");
    el.removeAttribute("data-tl-rule-highlight");
  }

  function applyRuleAction(el, action) {
    if (action === "hide") el.setAttribute("data-tl-filtered", "hide");
    else el.removeAttribute("data-tl-filtered");
    el.toggleAttribute("data-tl-rule-collapse", action === "collapse");
    el.toggleAttribute("data-tl-rule-dim", action === "dim");
    el.toggleAttribute("data-tl-rule-highlight", action === "highlight");
  }

  function passFeed(s, { nativeCompact }) {
    const posts = TL.selectors.resolveAll("post");
    counts.posts = posts.length;
    let filtered = 0;
    const rules = s.filters?.rules || [];
    const needFlair = s.feed.showFlair || rules.some((r) => r.enabled !== false && r.type === "flair");
    const needScore = rules.some((r) => r.enabled !== false && r.type === "score");
    const needCommentCount = rules.some((r) => r.enabled !== false && r.type === "commentCount");

    for (const el of posts) {
      const m = TL.extract.post(el);

      if (!stampedPosts.has(el)) {
        stampedPosts.add(el);
        el.setAttribute("data-tl", "post");
        el.setAttribute("role", "option"); // spec §23 — feed rows as a list
        if (m.isPromoted) el.setAttribute("data-tl-promoted", "");
        ensureIO().observe(el);
      }

      // Enforced every pass — Reddit hydration may reset the attribute.
      applyNativeView(el, nativeCompact && s.mode !== "native-clean");

      // Re-evaluated every pass so settings/rule changes apply live:
      const ctx = {
        flair: needFlair ? TL.extract.flairText(el) : undefined,
        score: needScore ? TL.extract.postScore(el) : undefined,
        commentCount: needCommentCount ? TL.extract.postCommentCount(el) : undefined
      };
      const rule = m.isPromoted ? null
        : TL.filters.matchPost(rules, m, ctx, TL.router.route.subreddit);
      if (rule) {
        applyRuleAction(el, rule.action);
        filtered++;
      } else {
        clearRuleAttrs(el);
      }

      const isSelected = el.hasAttribute("data-tl-selected");
      el.setAttribute("aria-selected", isSelected ? "true" : "false");

      if (m.id && TL.readstate.isHidden(m.id)) el.setAttribute("data-tl-hidden", "");
      else el.removeAttribute("data-tl-hidden");

      if (m.id && TL.queue?.has(m.id)) el.setAttribute("data-tl-queued", "");
      else el.removeAttribute("data-tl-queued");

      if (m.id && s.feed.dimSeenPosts && TL.readstate.wasSeenBefore(m.id)) {
        el.setAttribute("data-tl-seen", "");
      } else {
        el.removeAttribute("data-tl-seen");
      }
    }
    counts.filtered = filtered;

    // One-time density/viral meter (spec §27.1) — the shareable moment.
    if (!densityToastShown && posts.length && s.mode !== "native-clean") {
      densityToastShown = true;
      setTimeout(() => measureDensity(posts), 700);
    }
  }

  /** Real before/after comparison: toggle html.tl-on off, measure how many
   *  posts are in-viewport in NATIVE layout, toggle back on, measure again.
   *  Both toggles + reads happen synchronously (forced reflow via
   *  getBoundingClientRect, no yield to the event loop between them) so the
   *  browser never paints the native state — no visible flash. Same
   *  technique test/e2e.mjs already uses to measure this from the outside. */
  function measureDensity(posts) {
    try {
      const html = document.documentElement;
      const after = posts.filter((p) => TL.dom.inViewport(p)).length;
      html.classList.remove("tl-on");
      const before = posts.filter((p) => TL.dom.inViewport(p)).length;
      html.classList.add("tl-on");

      const pct = before > 0 ? Math.round(((after - before) / before) * 100) : null;
      const pctText = pct !== null && pct > 0 ? ` (+${pct}%)` : "";
      TL.overlay.toast(
        `Before: ${before} posts visible → After: ${after}${pctText}. Hold Alt to compare · ? for keys`
      );
      if (globalThis.chrome?.storage?.local) {
        chrome.storage.local.set({
          tl_density_v1: { before, after, pct, at: Date.now() }
        }).catch(() => {});
      }
    } catch { /* cosmetic only — never let the meter break a pass */ }
  }

  function passComments(s) {
    const comments = TL.selectors.resolveAll("comment");
    counts.comments = comments.length;
    const treeEl = TL.selectors.resolveFirst("commentTree");
    if (treeEl && treeEl.getAttribute("role") !== "tree") treeEl.setAttribute("role", "tree");
    const rules = s.filters?.rules || [];
    const opPostEl = s.comments.highlightOP ? TL.selectors.resolveFirst("post") : null;
    const opAuthor = opPostEl ? TL.extract.post(opPostEl).author : undefined;

    for (const el of comments) {
      const m = TL.extract.comment(el);

      if (!stampedComments.has(el)) {
        stampedComments.add(el);
        el.setAttribute("data-tl", "comment");
        el.setAttribute("role", "treeitem");
      }
      el.style.setProperty("--tl-depth", String(m.depth));
      el.setAttribute("aria-level", String(m.depth + 1));

      const rule = TL.filters.matchComment(rules, m, TL.router.route.subreddit);
      const isAutoMod = s.comments.collapseAutoModerator && m.author === "AutoModerator" && m.depth === 0;
      const score = s.comments.collapseLowScore ? TL.extract.commentScore(el) : undefined;
      const isLowScore = score !== undefined && score < (s.comments.lowScoreThreshold || 0);
      const collapse = isAutoMod || isLowScore || rule?.action === "collapse";

      if (collapse) { try { el.setAttribute("collapsed", ""); } catch { /* best effort */ } }
      el.setAttribute("aria-expanded", collapse ? "false" : "true");

      el.toggleAttribute("data-tl-rule-dim", rule?.action === "dim");
      el.toggleAttribute("data-tl-rule-highlight", rule?.action === "highlight");
      el.toggleAttribute("data-tl-op", s.comments.highlightOP && !!opAuthor && m.author === opAuthor);
      el.toggleAttribute("data-tl-mod",
        s.comments.highlightMods && !!TL.selectors.within(el, "commentModBadge"));
    }
  }

  function pass(reason) {
    if (peeking) return; // user is holding Alt to see native Reddit
    TL.router.check(); // detect SPA navigations (fires tl:route when changed)
    const s = applyRootState();
    if (!s.enabled) { restoreAllNativeViews(); return; }

    const route = TL.router.route.type;
    if (route === "comments") {
      passComments(s);
      // The post being read gets its full card layout, not the dense row.
      passFeed(s, { nativeCompact: false });
    } else if (["home", "subreddit", "search", "user"].includes(route)) {
      passFeed(s, { nativeCompact: true });
    }
    TL.bus.dispatchEvent(new CustomEvent("tl:pass", { detail: { reason, route } }));
  }

  return { pass, applyRootState, setPeek, counts: () => ({ ...counts }) };
})();
