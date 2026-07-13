/* =============================================================================
 * Threadline — content/filters.js
 * Filter rule engine (spec §26). Pure matching logic, no DOM access — the
 * caller (compactor.js) extracts field values and passes them in, which
 * keeps this module unit-testable without a browser.
 *
 * Rules are evaluated in order; the first enabled, in-scope, matching rule
 * wins (its `action` decides what compactor.js does to the node).
 * =========================================================================== */
"use strict";

TL.filters = (() => {
  const NUMERIC_TYPES = new Set(["score", "commentCount"]);

  function textMatch(operator, actual, value) {
    const hay = String(actual).toLowerCase();
    const needle = String(value ?? "").trim().toLowerCase();
    if (!needle) return false;
    if (operator === "regex") {
      try { return new RegExp(String(value), "i").test(String(actual)); }
      catch { return false; } // invalid user-supplied pattern — treat as no match
    }
    if (operator === "equals") return hay === needle;
    return hay.includes(needle); // "contains" (default)
  }

  /** Domain "equals" also matches subdomains (blog.x.com equals x.com) —
   *  mirrors the pre-rule-engine behavior so existing domain filters still
   *  work the same way after migration. */
  function domainMatch(operator, actual, value) {
    const hay = String(actual).toLowerCase();
    const needle = String(value ?? "").trim().toLowerCase();
    if (!needle) return false;
    if (operator === "regex") {
      try { return new RegExp(String(value), "i").test(String(actual)); }
      catch { return false; }
    }
    if (operator === "equals") return hay === needle || hay.endsWith("." + needle);
    return hay.includes(needle);
  }

  function numberMatch(operator, actual, value) {
    const n = Number(actual);
    const v = Number(value);
    if (!Number.isFinite(n) || !Number.isFinite(v)) return false;
    if (operator === "lt") return n < v;
    if (operator === "gt") return n > v;
    return n === v; // "equals" (also the fallback for an unrecognized operator)
  }

  const POST_FIELD = {
    keyword: (m) => m.title,
    flair: (_m, ctx) => ctx.flair,
    domain: (m) => m.domain,
    user: (m) => m.author,
    postType: (m) => m.postType,
    score: (_m, ctx) => ctx.score,
    commentCount: (_m, ctx) => ctx.commentCount
  };

  function ruleInScope(rule, subreddit) {
    if (rule.scope !== "subreddit") return true;
    return !!subreddit && !!rule.subreddit &&
      String(subreddit).toLowerCase() === String(rule.subreddit).toLowerCase();
  }

  function evalMatch(rule, actual) {
    if (NUMERIC_TYPES.has(rule.type)) return numberMatch(rule.operator, actual, rule.value);
    if (rule.type === "domain") return domainMatch(rule.operator, actual, rule.value);
    return textMatch(rule.operator, actual, rule.value);
  }

  /** First matching enabled+in-scope rule for a post, or null.
   *  ctx: { flair, score, commentCount } — precomputed by the caller so this
   *  function stays pure (no DOM access, no attribute reads of its own). */
  function matchPost(rules, m, ctx, subreddit) {
    for (const rule of rules || []) {
      if (rule.enabled === false) continue;
      if (!ruleInScope(rule, subreddit)) continue;
      const field = POST_FIELD[rule.type];
      if (!field) continue;
      const actual = field(m, ctx || {});
      if (actual === undefined || actual === null || actual === "") continue;
      if (evalMatch(rule, actual)) return rule;
    }
    return null;
  }

  /** Comments only support type:"user" — nothing else in the codebase
   *  extracts per-pass comment body/flair to key other rule types off of. */
  function matchComment(rules, m, subreddit) {
    for (const rule of rules || []) {
      if (rule.enabled === false || rule.type !== "user") continue;
      if (!ruleInScope(rule, subreddit)) continue;
      if (!m.author) continue;
      if (textMatch(rule.operator, m.author, rule.value)) return rule;
    }
    return null;
  }

  return { matchPost, matchComment };
})();
