/* =============================================================================
 * Threadline — content/extractors.js
 * Post/comment model extraction (spec §13.3/§13.4).
 *
 * Strategy, most-stable first:
 *   1. ATTRIBUTES on Reddit's custom elements — <shreddit-post permalink=…
 *      post-title=… score=… comment-count=… author=… domain=… post-type=…>
 *      and <shreddit-comment thingid=… author=… depth=…>. These survive
 *      styling redesigns because Reddit's own components consume them.
 *   2. Relative DOM queries (via the selector registry).
 *   3. Link-pattern inference (any anchor to /comments/{id}).
 * Models are cached per-node in a WeakMap.
 * =========================================================================== */
"use strict";

TL.extract = (() => {
  const postCache = new WeakMap();
  const commentCache = new WeakMap();

  function attrReader(el) {
    return (name) => {
      const v = el.getAttribute?.(name);
      return v === null || v === undefined || v === "" ? undefined : v;
    };
  }

  function absolutize(href) {
    if (!href) return undefined;
    try { return new URL(href, location.origin).href; } catch { return undefined; }
  }

  /** "1,234" / "1.2k" / "3m" -> number. Reddit's score/comment-count
   *  attributes are usually plain integers, but parse leniently since the
   *  filter engine's score/commentCount rules need real numbers. */
  function parseCount(text) {
    if (text === undefined || text === null) return undefined;
    const s = String(text).trim().toLowerCase().replace(/,/g, "");
    const m = s.match(/^(-?[\d.]+)\s*(k|m)?$/);
    if (!m) return undefined;
    let n = parseFloat(m[1]);
    if (!Number.isFinite(n)) return undefined;
    if (m[2] === "k") n *= 1000;
    else if (m[2] === "m") n *= 1000000;
    return Math.round(n);
  }

  function post(el) {
    if (postCache.has(el)) return postCache.get(el);
    const attr = attrReader(el);
    const tag = (el.tagName || "").toLowerCase();
    let m;

    if (tag === "shreddit-post" || tag === "shreddit-ad-post") {
      m = {
        id: el.id || attr("id") || attr("post-id"),
        permalink: absolutize(attr("permalink")),
        title: attr("post-title") ||
          TL.dom.text(TL.selectors.within(el, "postTitleLink")),
        subreddit: (attr("subreddit-prefixed-name") || "").replace(/^r\//i, "") ||
          attr("subreddit-name"),
        author: attr("author"),
        domain: attr("domain"),
        postType: attr("post-type") || "unknown",
        contentHref: absolutize(attr("content-href")),
        isPromoted: tag === "shreddit-ad-post" || el.hasAttribute("promoted"),
        node: el
      };
    } else {
      // Generic fallback for unknown markup: infer from a /comments/ link.
      const link = el.querySelector?.("a[href*='/comments/']");
      const href = link?.getAttribute("href") || "";
      const idMatch = href.match(/\/comments\/([a-z0-9]+)/i);
      m = {
        id: idMatch ? "t3_" + idMatch[1] : undefined,
        permalink: absolutize(href),
        title: TL.dom.text(
          el.querySelector?.("h1, h2, h3, [data-testid='post-title']") || link
        ),
        subreddit: (href.match(/\/r\/([^/]+)\//) || [])[1],
        postType: "unknown",
        isPromoted: false,
        node: el
      };
    }

    postCache.set(el, m);
    return m;
  }

  /** Flair is styled/renamed often — read it lazily and never cache empty. */
  function flairText(el) {
    const flairEl = TL.selectors.within(el, "postFlair");
    return flairEl ? TL.dom.text(flairEl) : undefined;
  }

  /** Score/comment-count change live (voting, new replies) — read fresh on
   *  every call rather than baking into the WeakMap-cached model above. */
  function postScore(el) {
    return parseCount(el.getAttribute?.("score"));
  }
  function postCommentCount(el) {
    return parseCount(el.getAttribute?.("comment-count"));
  }
  /** Comment score lives on the <shreddit-comment-action-row> child, not on
   *  <shreddit-comment> itself (verified live 2026-07). */
  function commentScore(el) {
    const row = el.querySelector?.("shreddit-comment-action-row");
    return parseCount(row?.getAttribute("score"));
  }

  function comment(el) {
    if (commentCache.has(el)) return commentCache.get(el);
    const attr = attrReader(el);
    const tag = (el.tagName || "").toLowerCase();
    let m;

    if (tag === "shreddit-comment") {
      m = {
        id: attr("thingid"),
        author: attr("author"),
        depth: parseInt(attr("depth") || "0", 10) || 0,
        permalink: absolutize(attr("permalink")),
        node: el
      };
    } else {
      const raw = el.id || el.getAttribute?.("data-fullname") || "";
      const idMatch = raw.match(/t1_[a-z0-9]+/i);
      m = { id: idMatch?.[0], author: undefined, depth: 0, node: el };
    }

    commentCache.set(el, m);
    return m;
  }

  return { post, comment, flairText, postScore, postCommentCount, commentScore };
})();
