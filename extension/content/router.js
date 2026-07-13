/* =============================================================================
 * Threadline — content/router.js
 * Route classification for reddit.com. Reddit is an SPA; page code calls
 * history.pushState in the MAIN world, which an isolated-world content script
 * cannot patch. Instead we listen for popstate AND re-check location.href on
 * every (rAF-coalesced) mutation pass — SPA navigations always mutate the DOM,
 * so this catches every transition cheaply.
 * =========================================================================== */
"use strict";

TL.router = (() => {
  /** Pure function — also exercised by test/run.mjs in Node. */
  function classify(href) {
    let url;
    try { url = new URL(href); } catch { return { type: "other" }; }
    const p = url.pathname.replace(/\/+$/, "") || "/";
    let m;

    if ((m = p.match(/^\/r\/([^/]+)\/comments\/([^/]+)/i))) {
      return { type: "comments", subreddit: m[1], postId: m[2] };
    }
    if ((m = p.match(/^\/r\/([^/]+)\/search/i))) {
      return { type: "search", subreddit: m[1] };
    }
    if (p === "/search") return { type: "search" };
    if ((m = p.match(/^\/(?:user|u)\/([^/]+)/i))) {
      return { type: "user", user: m[1] };
    }
    // r/all and r/popular are aggregate feeds, not real subreddits.
    if (/^\/r\/(all|popular)(\/(hot|new|top|rising|best))?$/i.test(p)) {
      return { type: "home" };
    }
    if ((m = p.match(/^\/r\/([^/]+)(?:\/(hot|new|top|rising|best))?$/i))) {
      return { type: "subreddit", subreddit: m[1], sort: m[2] || undefined };
    }
    if (p === "/" || /^\/(hot|new|top|rising|best)$/i.test(p)) {
      return { type: "home" };
    }
    return { type: "other" };
  }

  let lastHref = null;
  let current = { type: "other" };

  /** Re-classify if the URL changed. Returns true when it did. */
  function check() {
    if (typeof location === "undefined" || location.href === lastHref) return false;
    lastHref = location.href;
    const prev = current;
    current = classify(location.href);
    if (prev.type !== current.type || prev.subreddit !== current.subreddit ||
        prev.postId !== current.postId) {
      TL.bus.dispatchEvent(new CustomEvent("tl:route", { detail: current }));
    }
    return true;
  }

  function init() {
    addEventListener("popstate", check);
    check();
  }

  return { classify, check, init, get route() { return current; } };
})();
