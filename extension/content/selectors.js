/* =============================================================================
 * Threadline — content/selectors.js
 *
 * THE single source of truth for every Reddit DOM assumption made in JS.
 * (styles/early.css holds the CSS-only equivalents — those two files are the
 * ONLY places allowed to reference Reddit's own markup.)
 *
 * Each group is an ordered list of candidate selectors: most-specific /
 * most-current first, most-generic fallback last. resolve() walks the list,
 * uses the first candidate that matches anything, and records which one won
 * so the popup can show selector health ("Layout check" diagnostics).
 *
 * WHEN REDDIT SHIPS A REDESIGN:
 *   1. Open the Threadline popup on a broken page → "Layout check" shows
 *      which groups went red.
 *   2. Inspect the new DOM, PREPEND a new candidate selector to that group.
 *      (Keep the old ones — Reddit A/B tests markup per user.)
 *   3. Mirror the change in styles/early.css if it affects pure-CSS hiding.
 *   4. Nothing else in the codebase should need to change.
 * =========================================================================== */
"use strict";

TL.selectors = (() => {
  const GROUPS = {
    /* One feed unit. <shreddit-post> carries its data as element attributes
       (permalink, post-title, score, comment-count, author, domain,
       post-type, content-href…) which extractors.js reads attribute-first.
       <shreddit-ad-post> is the promoted variant. */
    post: [
      "shreddit-post, shreddit-ad-post",
      "[data-testid='post-container']",
      "div[data-fullname^='t3_']",
      "article:has(a[href*='/comments/'])"
    ],

    /* One comment. <shreddit-comment> exposes thingid/author/depth attrs. */
    comment: [
      "shreddit-comment",
      "[data-testid='comment']",
      "div[data-fullname^='t1_']"
    ],

    commentTree: [
      "shreddit-comment-tree",
      "#comment-tree",
      "[data-testid='comments-list']"
    ],

    /* Scroll/content roots — used to scope queries and sanity-check pages. */
    mainContent: [
      "#main-content",
      "shreddit-feed",
      "main"
    ],

    feedContainer: [
      "shreddit-feed",
      "#main-content",
      "main"
    ],

    leftSidebar: [
      "#left-sidebar-container",
      "#left-sidebar",
      "flex-left-nav-container",
      "nav[aria-label*='primary' i]"
    ],

    rightSidebar: [
      "#right-sidebar-container",
      "#right-sidebar",
      "[data-testid='subreddit-sidebar']",
      "[data-testid='frontpage-sidebar']"
    ],

    subredditHeader: [
      "shreddit-subreddit-header",
      "[data-testid='subreddit-header']"
    ],

    /* The big subreddit block above the feed (banner strip + icon + h1 +
       join/create buttons). Verified live 2026-07. */
    masthead: [
      "#subgrid-container > .masthead",
      ".masthead",
      "shreddit-subreddit-header-buttons"
    ],

    /* Post flair pill inside a feed unit (queried relative to a post node). */
    postFlair: [
      "shreddit-post-flair",
      "[slot='post-flair']",
      "[data-testid='post-flair']",
      "a[href*='?f=flair']"
    ],

    /* Title link inside a feed unit (relative). Used for native SPA nav. */
    postTitleLink: [
      "a[slot='full-post-link']",
      "[slot='title'] a",
      "a[slot='title']",
      "a[href*='/comments/']"
    ],

    /* Moderator badge inside a comment (relative). UNVERIFIED — added for
       highlightMods without a confirmed live selector (unlike every other
       group in this file, which was checked against real DOM). A miss here
       just means the highlight silently never fires; if you can identify
       the real markup, prepend the correct candidate here, same contract
       as everywhere else. */
    commentModBadge: [
      "[data-testid='moderator-badge']",
      "shreddit-comment-badges [title*='moderator' i]",
      "shreddit-comment-badges .moderator",
      "[class*='moderator' i]"
    ],

    /* Native search input for the `/` shortcut. */
    searchInput: [
      "reddit-search-large",
      "faceplate-search-input input",
      "input[type='search']",
      "input[name='q']"
    ]
  };

  /* Reddit's native per-post renderer switch (verified live 2026-07):
     <shreddit-post view-type="cardView" | "compactView">. Flipping a post to
     compactView makes Reddit's own component render its dense layout
     (~50px link rows) — the compactor leans on this in compact-reader mode
     and restores the saved original on toggle/peek/native-clean. */
  const NATIVE_VIEW = {
    viewTypeAttr: "view-type",
    compactValue: "compactView",
    saveAttr: "data-tl-viewtype",   // original value parked here while flipped
    tags: ["SHREDDIT-POST", "SHREDDIT-AD-POST"]
  };

  /* Native vote/save controls (native action forwarding, spec §31 fallback
     table). Reddit renders these INSIDE each post/comment's own shadow root
     — not slotted content — so a plain light-DOM selector can never reach
     them; JS has to cross the shadow boundary explicitly. Verified live
     2026-07 (logged out, r/programming feed + a comment thread):
       • <shreddit-post> has an OPEN shadow root with the action row
         directly inside it: button[data-action-bar-action="upvote"|
         "downvote"]. Confirmed stable across the compactView flip
         (applyNativeView in compactor.js) — same buttons, same root.
       • <shreddit-comment> itself has a CLOSED shadow root (unreachable
         from a content script), but its light-DOM child
         <shreddit-comment-action-row slot="actionRow"> has its OWN open
         shadow root with the identical button[upvote]/[downvote] pattern.
       • No "save" control was observed while logged out — Reddit appears to
         omit it entirely without an account, so it could not be verified
         live. Save forwarding is therefore best-effort: try the
         data-action-bar-action="save" naming convention the other actions
         use, then fall back to the overflow ("more") menu. If Reddit's
         markup differs, prepend a working candidate here — same contract
         as every other group in this file. */
  const NATIVE_ACTIONS = {
    post: {
      shadowRoot: (el) => el.shadowRoot,
      upvote: ["button[data-action-bar-action='upvote']", "button[upvote]"],
      downvote: ["button[data-action-bar-action='downvote']", "button[downvote]"],
      save: ["button[data-action-bar-action='save']", "[data-post-click-location='save']"],
      overflowTrigger: ["shreddit-overflow-menu button", "[aria-haspopup='menu']"]
    },
    comment: {
      shadowRoot: (el) => el.querySelector("shreddit-comment-action-row")?.shadowRoot,
      upvote: ["button[upvote]", "button[data-action-bar-action='upvote']"],
      downvote: ["button[downvote]", "button[data-action-bar-action='downvote']"],
      save: ["button[data-action-bar-action='save']"],
      overflowTrigger: ["shreddit-overflow-menu button", "[aria-haspopup='menu']"]
    }
  };

  /** Find a native vote/save button for a post or comment element.
   *  kind: "post" | "comment". Returns the button or null — misses are
   *  expected (e.g. save while logged out) so this never touches `health`. */
  function findNativeAction(kind, el, action) {
    const cfg = NATIVE_ACTIONS[kind];
    const root = cfg?.shadowRoot(el);
    if (!root) return null;
    for (const sel of cfg[action] || []) {
      try {
        const found = root.querySelector(sel);
        if (found) return found;
      } catch { /* skip unsupported candidate */ }
    }
    return null;
  }

  /** Overflow ("more") menu trigger — last resort for actions (like Save)
   *  that aren't always a direct action-bar button. */
  function findOverflowTrigger(kind, el) {
    const cfg = NATIVE_ACTIONS[kind];
    const root = cfg?.shadowRoot(el);
    if (!root) return null;
    for (const sel of cfg.overflowTrigger) {
      try {
        const found = root.querySelector(sel);
        if (found) return found;
      } catch { /* skip unsupported candidate */ }
    }
    return null;
  }

  /* Which groups are EXPECTED to match on which route (for diagnostics —
     a missing rightSidebar on a comments page is not a failure). */
  const EXPECTED = {
    home: ["post", "feedContainer", "mainContent"],
    subreddit: ["post", "feedContainer", "mainContent", "masthead"],
    comments: ["comment", "commentTree", "mainContent"],
    search: ["mainContent"],
    user: ["mainContent"],
    other: []
  };

  /* group -> { selector: string|null, count: number, at: epoch-ms } */
  const health = {};

  function resolveAll(group, root) {
    const scope = root || document;
    for (const sel of GROUPS[group] || []) {
      let nodes;
      try {
        nodes = scope.querySelectorAll(sel);
      } catch {
        continue; // selector not supported in this Chrome — skip candidate
      }
      if (nodes.length) {
        health[group] = { selector: sel, count: nodes.length, at: Date.now() };
        return Array.from(nodes);
      }
    }
    health[group] = { selector: null, count: 0, at: Date.now() };
    return [];
  }

  function resolveFirst(group, root) {
    return resolveAll(group, root)[0] || null;
  }

  /** Relative query inside a node, walking candidates. Does NOT touch health
   *  (per-node misses are normal — e.g. posts without flair). */
  function within(node, group) {
    for (const sel of GROUPS[group] || []) {
      try {
        const found = node.querySelector(sel);
        if (found) return found;
      } catch { /* skip unsupported candidate */ }
    }
    return null;
  }

  /** Diagnostics for the popup: per-group status + whether it matters here. */
  function report(routeType) {
    const expected = EXPECTED[routeType] || [];
    const out = {};
    for (const group of Object.keys(GROUPS)) {
      // Refresh page-level groups so the report reflects the DOM right now.
      if (!["postFlair", "postTitleLink"].includes(group)) resolveAll(group);
      const h = health[group] || { selector: null, count: 0 };
      out[group] = {
        matched: h.count > 0,
        selector: h.selector,
        count: h.count,
        expectedHere: expected.includes(group)
      };
    }
    return out;
  }

  return {
    GROUPS, EXPECTED, NATIVE_VIEW, resolveAll, resolveFirst, within, report, health,
    NATIVE_ACTIONS, findNativeAction, findOverflowTrigger
  };
})();
