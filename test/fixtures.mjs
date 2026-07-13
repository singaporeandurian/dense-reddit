/* =============================================================================
 * Threadline — test/fixtures.mjs
 * Fixture tests (spec §30.2): exercise content/extractors.js's post/comment
 * models and content/selectors.js's within() against small hand-built DOM
 * stand-ins, instead of live reddit.com. Catches extraction regressions
 * without the flakiness/rate-limit cost of a real browser (see test/visreg.mjs
 * for what that cost looks like) and without adding a jsdom-class dependency
 * (spec §22: keep dependency count low) — a purpose-built fake element with
 * just enough querySelector support for THIS codebase's actual candidate
 * selectors, not a general CSS engine.
 *
 * Run: node fixtures.mjs
 * =========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (rel) =>
  (0, eval)(readFileSync(join(root, rel), "utf8") + `\n//# sourceURL=${rel}`);

// extractors.js resolves relative permalinks via `location.origin` — content
// scripts always have a real `location`; a plain Node script doesn't.
globalThis.location = { origin: "https://www.reddit.com", href: "https://www.reddit.com/r/test/" };

load("extension/shared/schema.js");
load("extension/content/namespace.js");
load("extension/content/selectors.js");
load("extension/content/dom.js");
load("extension/content/extractors.js");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
}

/* ---- A minimal element stand-in — just enough of the DOM element surface
 *      extractors.js/selectors.js actually touch (getAttribute/hasAttribute/
 *      tagName/id/textContent/querySelector) to exercise real extraction
 *      logic against realistic attribute combinations. ------------------- */
class FakeElement {
  constructor(tag, attrs = {}, children = [], text = "") {
    this.tagName = tag.toUpperCase();
    this._tag = tag.toLowerCase();
    this._attrs = attrs;
    this.id = attrs.id || "";
    this.children = children;
    this.textContent = text;
  }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this._attrs, name) ? String(this._attrs[name]) : null;
  }
  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this._attrs, name);
  }
  querySelector(selector) {
    for (const alt of selector.split(",").map((s) => s.trim())) {
      const found = matchAlternative(this.children, alt);
      if (found) return found;
    }
    return null;
  }
}

/** Parses ONE comma-free selector alternative into an optional tag name plus
 *  zero or more [attr], [attr='v'], [attr*='v'], [attr^='v'], [attr$='v']
 *  clauses, then depth-first searches `children` for the first match. Covers
 *  every pattern actually used in selectors.js's GROUPS — not a CSS engine. */
function matchAlternative(children, alt) {
  const m = alt.match(/^([a-z0-9-]*)((?:\[[^\]]+\])*)$/i);
  if (!m) return null;
  const tag = m[1] ? m[1].toLowerCase() : null;
  const clauses = [...m[2].matchAll(/\[([a-z0-9-]+)(?:([*^$]?=)'([^']*)')?\]/gi)]
    .map(([, attr, op, val]) => ({ attr, op, val }));

  function matches(el) {
    if (tag && el._tag !== tag) return false;
    for (const c of clauses) {
      const actual = el.getAttribute(c.attr);
      if (actual === null) return false;
      if (!c.op) continue;
      if (c.op === "=" && actual !== c.val) return false;
      if (c.op === "*=" && !actual.includes(c.val)) return false;
      if (c.op === "^=" && !actual.startsWith(c.val)) return false;
      if (c.op === "$=" && !actual.endsWith(c.val)) return false;
    }
    return true;
  }
  function walk(list) {
    for (const el of list) {
      if (matches(el)) return el;
      const found = walk(el.children || []);
      if (found) return found;
    }
    return null;
  }
  return walk(children);
}

console.log("extractors.post — attribute-first path");
test("full shreddit-post reads every attribute-first field", () => {
  const el = new FakeElement("shreddit-post", {
    id: "t3_abc123",
    permalink: "/r/test/comments/abc123/hello_world/",
    "post-title": "Hello World",
    "subreddit-prefixed-name": "r/test",
    author: "someuser",
    domain: "self.test",
    "post-type": "text",
    "content-href": "/r/test/comments/abc123/hello_world/"
  });
  const m = TL.extract.post(el);
  assert.equal(m.id, "t3_abc123");
  assert.equal(m.permalink, "https://www.reddit.com/r/test/comments/abc123/hello_world/");
  assert.equal(m.title, "Hello World");
  assert.equal(m.subreddit, "test");
  assert.equal(m.author, "someuser");
  assert.equal(m.domain, "self.test");
  assert.equal(m.postType, "text");
  assert.equal(m.isPromoted, false);
});
test("shreddit-ad-post is always promoted, even without a promoted attribute", () => {
  const el = new FakeElement("shreddit-ad-post", { id: "t3_ad1", "post-title": "Buy now" });
  assert.equal(TL.extract.post(el).isPromoted, true);
});
test("shreddit-post with an explicit promoted attribute is also promoted", () => {
  const el = new FakeElement("shreddit-post", { id: "t3_p1", "post-title": "x", promoted: "" });
  assert.equal(TL.extract.post(el).isPromoted, true);
});
test("missing post-title falls back to the title-link selector's text", () => {
  const link = new FakeElement("a", { slot: "full-post-link" }, [], "Fallback Title");
  const el = new FakeElement("shreddit-post", { id: "t3_x", permalink: "/r/test/comments/x/" }, [link]);
  assert.equal(TL.extract.post(el).title, "Fallback Title");
});
test("subreddit-name attribute is used when subreddit-prefixed-name is absent", () => {
  const el = new FakeElement("shreddit-post", { id: "t3_y", "post-title": "y", "subreddit-name": "news" });
  assert.equal(TL.extract.post(el).subreddit, "news");
});
test("post model is cached per node — same object on repeat extraction", () => {
  const el = new FakeElement("shreddit-post", { id: "t3_z", "post-title": "z" });
  assert.equal(TL.extract.post(el), TL.extract.post(el));
});

console.log("\nextractors.post — generic fallback path (unknown markup)");
test("infers id/permalink/title from a bare comments link when not a shreddit-post", () => {
  const link = new FakeElement("a", { href: "/r/pics/comments/xyz789/a_title/" }, [], "A Title");
  const el = new FakeElement("article", {}, [link]);
  const m = TL.extract.post(el);
  assert.equal(m.id, "t3_xyz789");
  assert.equal(m.permalink, "https://www.reddit.com/r/pics/comments/xyz789/a_title/");
  assert.equal(m.title, "A Title");
  assert.equal(m.subreddit, "pics");
  assert.equal(m.isPromoted, false);
});
test("fallback with no comments link at all still returns a safe, id-less model", () => {
  const el = new FakeElement("div", {});
  const m = TL.extract.post(el);
  assert.equal(m.id, undefined);
  assert.equal(m.permalink, undefined);
});

console.log("\nextractors.flairText / postScore / postCommentCount");
test("flairText finds the current shreddit-post-flair candidate", () => {
  const flair = new FakeElement("shreddit-post-flair", {}, [], "Discussion");
  const el = new FakeElement("shreddit-post", { id: "t3_f" }, [flair]);
  assert.equal(TL.extract.flairText(el), "Discussion");
});
test("flairText is undefined (not a crash) when no flair candidate matches", () => {
  const el = new FakeElement("shreddit-post", { id: "t3_nf" });
  assert.equal(TL.extract.flairText(el), undefined);
});
test("postScore/postCommentCount parse plain integers and k/m suffixes", () => {
  const el = new FakeElement("shreddit-post", { score: "1234", "comment-count": "2.5k" });
  assert.equal(TL.extract.postScore(el), 1234);
  assert.equal(TL.extract.postCommentCount(el), 2500);
});
test("postScore is undefined for a post with no score attribute", () => {
  const el = new FakeElement("shreddit-post", { id: "t3_ns" });
  assert.equal(TL.extract.postScore(el), undefined);
});
test("score/commentCount are read live, not cached — reflect the current attribute", () => {
  const el = new FakeElement("shreddit-post", { score: "10" });
  assert.equal(TL.extract.postScore(el), 10);
  el._attrs.score = "20"; // simulates a live vote-count change between passes
  assert.equal(TL.extract.postScore(el), 20);
});

console.log("\nextractors.comment");
test("shreddit-comment reads id/author/depth/permalink", () => {
  const el = new FakeElement("shreddit-comment", {
    thingid: "t1_c1", author: "spez", depth: "2", permalink: "/r/test/comments/x/y/c1/"
  });
  const m = TL.extract.comment(el);
  assert.equal(m.id, "t1_c1");
  assert.equal(m.author, "spez");
  assert.equal(m.depth, 2);
  assert.equal(m.permalink, "https://www.reddit.com/r/test/comments/x/y/c1/");
});
test("missing depth attribute defaults to 0, not NaN", () => {
  const el = new FakeElement("shreddit-comment", { thingid: "t1_c2", author: "x" });
  assert.equal(TL.extract.comment(el).depth, 0);
});
test("commentScore reads the score from the nested action-row child", () => {
  const row = new FakeElement("shreddit-comment-action-row", { score: "150" });
  const el = new FakeElement("shreddit-comment", { thingid: "t1_c3" }, [row]);
  assert.equal(TL.extract.commentScore(el), 150);
});
test("commentScore is undefined when there's no action-row child", () => {
  const el = new FakeElement("shreddit-comment", { thingid: "t1_c4" });
  assert.equal(TL.extract.commentScore(el), undefined);
});
test("non-shreddit-comment markup infers a t1_ id from data-fullname", () => {
  const el = new FakeElement("div", { "data-fullname": "t1_legacy99" });
  assert.equal(TL.extract.comment(el).id, "t1_legacy99");
});

console.log(`\n${passed} tests passed${process.exitCode ? " (with failures)" : ""}`);
