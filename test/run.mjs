/* =============================================================================
 * Threadline — test/run.mjs
 * Node smoke tests for the pure logic: route classification and settings
 * merge. The content files attach to globalThis, so we eval them in order
 * (same as the browser load order). Run:  node test/run.mjs
 * =========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (rel) =>
  (0, eval)(readFileSync(join(root, rel), "utf8") + `\n//# sourceURL=${rel}`);

load("extension/shared/schema.js");
load("extension/content/namespace.js");
load("extension/content/router.js");
load("extension/content/queue.js");
load("extension/content/filters.js");

const { TLSchema, TL } = globalThis;
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

console.log("router.classify");
const c = TL.router.classify;
test("home root", () => assert.equal(c("https://www.reddit.com/").type, "home"));
test("home sort", () => assert.equal(c("https://www.reddit.com/hot/").type, "home"));
test("r/all is home-like", () => assert.equal(c("https://www.reddit.com/r/all").type, "home"));
test("subreddit", () => {
  const r = c("https://www.reddit.com/r/ClaudeCode/");
  assert.equal(r.type, "subreddit");
  assert.equal(r.subreddit, "ClaudeCode");
});
test("subreddit sort", () => {
  const r = c("https://www.reddit.com/r/programming/top");
  assert.equal(r.type, "subreddit");
  assert.equal(r.sort, "top");
});
test("comments", () => {
  const r = c("https://www.reddit.com/r/ClaudeCode/comments/abc123/some_title/");
  assert.equal(r.type, "comments");
  assert.equal(r.subreddit, "ClaudeCode");
  assert.equal(r.postId, "abc123");
});
test("comments with query", () => {
  const r = c("https://www.reddit.com/r/x/comments/zzz9/t/?sort=top");
  assert.equal(r.type, "comments");
  assert.equal(r.postId, "zzz9");
});
test("global search", () => assert.equal(c("https://www.reddit.com/search?q=x").type, "search"));
test("subreddit search", () => {
  const r = c("https://www.reddit.com/r/pics/search/?q=cat");
  assert.equal(r.type, "search");
  assert.equal(r.subreddit, "pics");
});
test("user", () => {
  const r = c("https://www.reddit.com/user/spez/");
  assert.equal(r.type, "user");
  assert.equal(r.user, "spez");
});
test("u/ alias", () => assert.equal(c("https://www.reddit.com/u/spez").type, "user"));
test("settings page is other", () =>
  assert.equal(c("https://www.reddit.com/settings/").type, "other"));
test("garbage is other", () => assert.equal(c("not a url").type, "other"));

console.log("TLSchema.deepMerge");
const { deepMerge, DEFAULTS } = TLSchema;
test("empty patch keeps defaults", () => {
  const out = deepMerge(DEFAULTS, {});
  assert.deepEqual(out, DEFAULTS);
  assert.notEqual(out, DEFAULTS); // must be a copy
});
test("nested patch merges, siblings survive", () => {
  const out = deepMerge(DEFAULTS, { feed: { thumbnails: "off" } });
  assert.equal(out.feed.thumbnails, "off");
  assert.equal(out.feed.dimSeenPosts, DEFAULTS.feed.dimSeenPosts);
});
test("arrays replace, not concat", () => {
  const a = deepMerge(DEFAULTS, { filters: { rules: [{ id: "a" }] } });
  const b = deepMerge(a, { filters: { rules: [{ id: "b" }] } });
  assert.deepEqual(b.filters.rules, [{ id: "b" }]);
});
test("does not mutate inputs", () => {
  const base = { a: { b: 1 } };
  deepMerge(base, { a: { b: 2 } });
  assert.equal(base.a.b, 1);
});
test("partial stored blob gets full shape", () => {
  const out = deepMerge(DEFAULTS, { enabled: false });
  assert.equal(out.enabled, false);
  assert.equal(out.density.preset, "balanced");
  assert.equal(typeof out.privacy.readHistoryTtlDays, "number");
});
test("subreddit override merge", () => {
  const withOverride = deepMerge(DEFAULTS, {
    subredditOverrides: { claudecode: { density: { preset: "ultra" } } }
  });
  const effective = deepMerge(withOverride, withOverride.subredditOverrides.claudecode);
  assert.equal(effective.density.preset, "ultra");
  assert.equal(effective.feed.thumbnails, DEFAULTS.feed.thumbnails);
});

console.log("\nTLSchema presets");
const { makePreset, isPreset, presetPatch } = TLSchema;
test("makePreset excludes filters/overrides/privacy", () => {
  const withUserData = deepMerge(DEFAULTS, {
    filters: { keywords: ["drama"] },
    subredditOverrides: { foo: { density: { preset: "ultra" } } },
    privacy: { storeReadHistory: false }
  });
  const preset = makePreset(withUserData);
  assert.equal(preset.filters, undefined);
  assert.equal(preset.subredditOverrides, undefined);
  assert.equal(preset.privacy, undefined);
  assert.equal(preset.kind, "threadline-preset");
});
test("makePreset carries look-and-feel fields", () => {
  const preset = makePreset(deepMerge(DEFAULTS, { mode: "split-pane", density: { preset: "ultra" } }));
  assert.equal(preset.mode, "split-pane");
  assert.equal(preset.density.preset, "ultra");
  assert.equal(preset.feed.thumbnails, DEFAULTS.feed.thumbnails);
});
test("isPreset rejects arbitrary objects", () => {
  assert.equal(isPreset(makePreset(DEFAULTS)), true);
  assert.equal(isPreset({ mode: "compact-reader" }), false);
  assert.equal(isPreset(null), false);
});
test("presetPatch round-trips into deepMerge", () => {
  const preset = makePreset(deepMerge(DEFAULTS, { density: { preset: "dense" } }));
  const applied = deepMerge(DEFAULTS, presetPatch(preset));
  assert.equal(applied.density.preset, "dense");
  assert.deepEqual(applied.filters, DEFAULTS.filters); // untouched by the preset
});

console.log("\nTL.queue pure list ops");
const { addItem, removeItem } = TL.queue._pure;
const post = (id) => ({ id, permalink: `https://www.reddit.com/comments/${id}/`, title: `Post ${id}` });
test("addItem appends new items", () => {
  const out = addItem([], post("a"));
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "a");
});
test("addItem is a no-op for a duplicate id", () => {
  const one = addItem([], post("a"));
  const two = addItem(one, post("a"));
  assert.equal(two, one); // same reference — genuinely unchanged
});
test("addItem does not mutate its input", () => {
  const empty = [];
  addItem(empty, post("a"));
  assert.equal(empty.length, 0);
});
test("addItem enforces the cap by dropping the oldest", () => {
  let list = [];
  for (const id of ["a", "b", "c"]) list = addItem(list, post(id), 2);
  assert.deepEqual(list.map((x) => x.id), ["b", "c"]);
});
test("removeItem drops only the matching id", () => {
  const list = addItem(addItem([], post("a")), post("b"));
  const out = removeItem(list, "a");
  assert.deepEqual(out.map((x) => x.id), ["b"]);
});

console.log("\nTLSchema.migrateLegacyFilters / normalizeSettings");
const { migrateLegacyFilters, normalizeSettings, makeRule } = TLSchema;
test("legacy keywords/domains/users/flairs become rules", () => {
  const migrated = migrateLegacyFilters({
    keywords: ["drama"], domains: ["x.com"], users: ["AutoModerator"], flairs: ["Meme"]
  });
  assert.equal(migrated.rules.length, 4);
  const byType = Object.fromEntries(migrated.rules.map((r) => [r.type, r]));
  assert.equal(byType.keyword.operator, "contains");
  assert.equal(byType.keyword.value, "drama");
  assert.equal(byType.domain.operator, "equals");
  assert.equal(byType.user.value, "AutoModerator");
  assert.equal(byType.flair.value, "Meme");
  for (const r of migrated.rules) {
    assert.equal(r.enabled, true);
    assert.equal(r.scope, "global");
    assert.equal(r.action, "hide");
    assert.equal(typeof r.id, "string");
  }
});
test("already-new-style filters pass through untouched", () => {
  const input = { rules: [makeRule({ type: "user", value: "spez" })] };
  assert.equal(migrateLegacyFilters(input), input);
});
test("empty/missing filters migrate to an empty rule list", () => {
  assert.deepEqual(migrateLegacyFilters(undefined), { rules: [] });
  assert.deepEqual(migrateLegacyFilters({}), { rules: [] });
});
test("normalizeSettings migrates a legacy stored blob end to end", () => {
  const out = normalizeSettings({ filters: { keywords: ["nsfw"] } });
  assert.equal(out.filters.rules.length, 1);
  assert.equal(out.filters.rules[0].type, "keyword");
  assert.equal(out.filters.rules[0].value, "nsfw");
});
test("normalizeSettings leaves a fresh install with zero rules", () => {
  const out = normalizeSettings({});
  assert.deepEqual(out.filters.rules, []);
});

console.log("\nTL.filters rule engine");
const rulePost = (over) => ({
  title: "Big drama today", domain: "x.com", author: "spez", postType: "text", ...over
});
test("keyword contains (default operator)", () => {
  const rule = makeRule({ type: "keyword", value: "drama" });
  assert.ok(TL.filters.matchPost([rule], rulePost(), {}, null));
  assert.equal(TL.filters.matchPost([rule], rulePost({ title: "quiet post" }), {}, null), null);
});
test("keyword equals is exact, not substring", () => {
  const rule = makeRule({ type: "keyword", operator: "equals", value: "drama" });
  assert.equal(TL.filters.matchPost([rule], rulePost(), {}, null), null); // "Big drama today" != "drama"
  assert.ok(TL.filters.matchPost([rule], rulePost({ title: "drama" }), {}, null));
});
test("domain equals also matches subdomains", () => {
  const rule = makeRule({ type: "domain", operator: "equals", value: "x.com" });
  assert.ok(TL.filters.matchPost([rule], rulePost({ domain: "blog.x.com" }), {}, null));
  assert.equal(TL.filters.matchPost([rule], rulePost({ domain: "notx.com" }), {}, null), null);
});
test("regex operator", () => {
  const rule = makeRule({ type: "keyword", operator: "regex", value: "^Big \\w+" });
  assert.ok(TL.filters.matchPost([rule], rulePost(), {}, null));
});
test("invalid regex fails closed (no match), not a throw", () => {
  const rule = makeRule({ type: "keyword", operator: "regex", value: "(unterminated" });
  assert.doesNotThrow(() => TL.filters.matchPost([rule], rulePost(), {}, null));
  assert.equal(TL.filters.matchPost([rule], rulePost(), {}, null), null);
});
test("score lt/gt against ctx, not the post model", () => {
  const low = makeRule({ type: "score", operator: "lt", value: 5 });
  const high = makeRule({ type: "score", operator: "gt", value: 100 });
  assert.ok(TL.filters.matchPost([low], rulePost(), { score: 1 }, null));
  assert.equal(TL.filters.matchPost([low], rulePost(), { score: 10 }, null), null);
  assert.ok(TL.filters.matchPost([high], rulePost(), { score: 500 }, null));
});
test("disabled rules never match", () => {
  const rule = makeRule({ type: "keyword", value: "drama", enabled: false });
  assert.equal(TL.filters.matchPost([rule], rulePost(), {}, null), null);
});
test("subreddit-scoped rule only applies on that subreddit", () => {
  const rule = makeRule({ type: "keyword", value: "drama", scope: "subreddit", subreddit: "news" });
  assert.equal(TL.filters.matchPost([rule], rulePost(), {}, "pics"), null);
  assert.ok(TL.filters.matchPost([rule], rulePost(), {}, "news"));
  assert.ok(TL.filters.matchPost([rule], rulePost(), {}, "News")); // case-insensitive
});
test("first matching rule wins, in list order", () => {
  const rules = [
    makeRule({ type: "user", value: "spez", action: "dim" }),
    makeRule({ type: "keyword", value: "drama", action: "hide" })
  ];
  assert.equal(TL.filters.matchPost(rules, rulePost(), {}, null).action, "dim");
});
test("matchComment only supports type:user", () => {
  const rules = [makeRule({ type: "keyword", value: "spam" }), makeRule({ type: "user", value: "spez" })];
  const match = TL.filters.matchComment(rules, { author: "spez" }, null);
  assert.equal(match?.type, "user");
  assert.equal(TL.filters.matchComment(rules, { author: "someoneelse" }, null), null);
});

console.log(`\n${passed} tests passed${process.exitCode ? " (with failures)" : ""}`);
