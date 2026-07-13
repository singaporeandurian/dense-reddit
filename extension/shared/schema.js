/* =============================================================================
 * Threadline — shared/schema.js
 *
 * Single definition of the settings shape, defaults, storage key, and merge
 * logic. Loaded by the content scripts, the service worker (importScripts),
 * the popup, and the options page, so every surface agrees on defaults.
 *
 * Stored values may be PARTIAL — every reader deep-merges over DEFAULTS.
 * That keeps old stored blobs forward-compatible when new settings are added.
 * =========================================================================== */
"use strict";

(function attach(g) {
  const KEY = "tl_settings_v1";

  const DEFAULTS = {
    enabled: true,
    // "compact-reader" = full compaction. "native-clean" = hide clutter only.
    // "split-pane" = compact-reader + feed rail on comments pages (spec Mode C).
    mode: "compact-reader",

    // auto | light | dark | oled | high-contrast | sepia (spec §24.3)
    theme: "auto",

    density: {
      preset: "balanced" // comfortable | balanced | dense | ultra
    },

    layout: {
      hideLeftSidebar: true,
      hideRightSidebar: true,
      hideBanners: true,
      hideCommunityHighlights: true,
      hidePrompts: true,
      centerContent: true,
      maxContentWidth: 1040
    },

    feed: {
      thumbnails: "small", // off | small | large
      showFlair: true,
      dimSeenPosts: true,
      hidePromoted: false
      // Note: spec §17 also lists showAuthor/showSubreddit/showDomain/
      // showScore/showCommentCount/collapsePinned. Deliberately NOT added —
      // score/comment-count render entirely inside shreddit-post's shadow
      // root with no exposed ::part() hook, so light-DOM CSS can never reach
      // them (confirmed via live probing); author/subreddit/pinned would
      // need further live selector verification this session didn't do. A
      // fake toggle that silently does nothing is worse than no toggle.
    },

    comments: {
      compact: true,
      hideAvatars: true,
      hideActionsUntilHover: true,
      collapseAutoModerator: false,
      collapseLowScore: false,
      lowScoreThreshold: 0,
      highlightOP: true,
      highlightMods: true,
      minimap: true
      // Note: spec also lists comments.maxIndentLevel ("max nesting width").
      // Deliberately NOT added — confirmed via live probing that nested-
      // comment indentation is generated entirely inside each ancestor
      // <shreddit-comment>'s CLOSED shadow root (no exposed padding/margin/
      // custom property to override), so it can't be capped from outside.
    },

    keyboard: {
      enabled: true,
      vimNavigation: true
    },

    // Rule model per spec §26.1. FilterRule = {
    //   id, enabled, scope: "global"|"subreddit", subreddit?,
    //   type: "keyword"|"flair"|"domain"|"user"|"postType"|"score"|"commentCount",
    //   operator: "contains"|"equals"|"regex"|"lt"|"gt",
    //   value: string|number, action: "hide"|"collapse"|"dim"|"highlight"
    // }. Comment matching only supports type:"user" (no per-pass comment-body
    // extraction elsewhere in the codebase to key other types off of).
    filters: {
      rules: []
    },

    // subreddit (lowercase, no "r/") -> partial settings merged over globals
    subredditOverrides: {},

    privacy: {
      storeReadHistory: true,
      readHistoryTtlDays: 30
    }
  };

  function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }

  function deepClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  /** Merge `patch` into a clone of `base`. Objects merge recursively;
   *  arrays and scalars replace. Never mutates its inputs. */
  function deepMerge(base, patch) {
    const out = isPlainObject(base) ? { ...base } : {};
    if (!isPlainObject(patch)) return deepClone(patch);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      out[k] = isPlainObject(v) && isPlainObject(out[k])
        ? deepMerge(out[k], v)
        : deepClone(v);
    }
    return out;
  }

  /** Density preset -> matching thumbnail size (spec §15.2). */
  const PRESET_THUMBS = {
    comfortable: "large",
    balanced: "small",
    dense: "small",
    ultra: "off"
  };

  /* ---- Shareable presets (spec §27.3) --------------------------------------
   * A preset is look-and-feel ONLY: mode/density/layout/feed/comments.
   * Never filters, subreddit overrides, or privacy/history settings — those
   * are the user's own data and must not travel in a shared blob. */
  const PRESET_KIND = "threadline-preset";

  function makePreset(settings) {
    const s = deepMerge(DEFAULTS, settings || {});
    return {
      kind: PRESET_KIND,
      v: 1,
      mode: s.mode,
      density: s.density,
      layout: s.layout,
      feed: s.feed,
      comments: s.comments
    };
  }

  function isPreset(obj) {
    return isPlainObject(obj) && obj.kind === PRESET_KIND;
  }

  /** The settings patch a preset blob applies (drops kind/v envelope). */
  function presetPatch(preset) {
    const { mode, density, layout, feed, comments } = preset || {};
    const patch = { mode, density, layout, feed, comments };
    for (const k of Object.keys(patch)) {
      if (patch[k] === undefined) delete patch[k];
    }
    return patch;
  }

  let ruleSeq = 0;
  /** Stable-enough id for a filter rule — not persisted across storage in any
   *  order-sensitive way, just needs to be unique within one render. */
  function newRuleId() {
    return `rule-${Date.now().toString(36)}-${(ruleSeq++).toString(36)}`;
  }

  function makeRule(patch) {
    return {
      id: newRuleId(),
      enabled: true,
      scope: "global",
      type: "keyword",
      operator: "contains",
      value: "",
      action: "hide",
      ...patch
    };
  }

  /** Pre-rule-engine stored blobs had filters.{keywords,domains,users,flairs}
   *  as flat string arrays (always "contains"/"hide" except users/domains
   *  which were "equals"). Convert them into equivalent rules once so
   *  existing local data isn't silently dropped when this shape changed. */
  function migrateLegacyFilters(filters) {
    if (!isPlainObject(filters)) return { rules: [] };
    if (Array.isArray(filters.rules)) return filters;
    const legacy = [
      ...(filters.keywords || []).map((value) => ({ type: "keyword", operator: "contains", value })),
      ...(filters.domains || []).map((value) => ({ type: "domain", operator: "equals", value })),
      ...(filters.users || []).map((value) => ({ type: "user", operator: "equals", value })),
      ...(filters.flairs || []).map((value) => ({ type: "flair", operator: "contains", value }))
    ].filter((r) => r.value);
    return { rules: legacy.map((r) => makeRule(r)) };
  }

  /** Deep-merge a stored/partial blob over DEFAULTS AND run one-time shape
   *  migrations (currently just filters). Every surface should read settings
   *  through this instead of calling deepMerge(DEFAULTS, raw) directly.
   *  Migration must run on the RAW value before merging — an already-merged
   *  object always has a (possibly empty) `rules` array from DEFAULTS, which
   *  would be indistinguishable from "genuinely zero rules". */
  function normalizeSettings(raw) {
    const patch = isPlainObject(raw) ? { ...raw } : {};
    if (isPlainObject(patch.filters) && !Array.isArray(patch.filters.rules)) {
      patch.filters = migrateLegacyFilters(patch.filters);
    }
    return deepMerge(DEFAULTS, patch);
  }

  g.TLSchema = {
    KEY, DEFAULTS, deepMerge, deepClone, isPlainObject, PRESET_THUMBS,
    PRESET_KIND, makePreset, isPreset, presetPatch,
    makeRule, migrateLegacyFilters, normalizeSettings
  };
})(globalThis);
