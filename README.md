# Dense — Compact Reader Mode for reddit.com

A Manifest V3 Chrome extension that removes Reddit's UI bloat (sidebars, banners,
community boxes, oversized cards) and turns feeds + comment threads into a dense,
keyboard-driven reading surface. Local-first: no servers, no analytics, no Reddit
API, no credentials. Not affiliated with Reddit.

Phase 2 added power-user features on top of the Phase 0/1 compact reader: a
**Split Pane** inbox mode (feed rail alongside comments), a local **reading
queue**, a **comment mini-map**, **native vote/save forwarding** (`a`/`d`/`s`
click Reddit's own controls — Dense never simulates a vote count), and
**shareable presets** + filter import/export in Settings.

v0.3.0 adds: a real **rule-based filter engine** (spec §26 — keyword/flair/
domain/user/post-type/score/comment-count rules with contains/equals/regex/
lt/gt operators and hide/collapse/dim/highlight actions, built in Settings →
Filters), a real **density/viral meter** (measures actual before/after
posts-in-viewport, not just a static number), a **theme system** (Auto/
Light/Dark/OLED/High-contrast/Sepia — Dense's own UI only, see
[Known limitations](#known-limitations)), **ARIA roles** on feed rows/comment
trees/the command palette, and **command palette recency ranking**.

Full product/technical spec: [SPEC.md](SPEC.md).

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` folder in this repo.
4. Open any reddit.com page. It compacts immediately.

Quick tour: press `?` on Reddit for the shortcut list, hold `Alt` to peek at
native Reddit, press `Alt+R` to toggle, `.` for the command palette, and use the
toolbar popup for density/mode/media plus the **Layout check** diagnostics.

## Keyboard

| Key | Feed | Comments |
| --- | --- | --- |
| `j` / `k` | next / prev post | next / prev comment |
| `J` / `K` | — | next / prev top-level comment |
| `Enter` / `c` | open comments | open comment permalink |
| `o` | open outbound link | — |
| `h` | hide post locally (`z` undo) | collapse comment |
| `l` | — | expand comment |
| `p` | — | jump to parent |
| `u` | — | back to subreddit |
| `a` / `d` | upvote / downvote (native) | upvote / downvote (native) |
| `s` | save post (native) | — |
| `q` / `Q` | queue / unqueue selected post | open reading queue |
| `[` / `]` | — | prev / next post from your feed list (Split Pane) |
| `m` | cycle thumbnails | — |
| `/` | focus search | focus search |
| `g h` / `g n` / `g s` | home / sub-new / sub-top-week | same |
| `?` `.` `Esc` `Alt`(hold) `Alt+R` | help / palette / close / peek native / toggle | same |

Native vote/save forwarding clicks Reddit's own buttons inside their shadow
DOM (verified live — see the comment block above `NATIVE_ACTIONS` in
`content/selectors.js`); it never fabricates a vote. Save couldn't be
verified logged-out (Reddit omits the control entirely without an account),
so it degrades per spec §31: try the action-bar button, then the overflow
menu, then open the post natively so you can save it there.

Shortcuts automatically suspend while typing in any input, textarea,
contenteditable, or Reddit composer (checked via `composedPath`, so shadow-DOM
editors are covered). Settings → Keyboard → "Vim-style navigation" toggles the
movement keys (`j`/`k`/`J`/`K`/`p`/`u`/`[`/`]`/`g`-sequences) off if you only
want the action keys (hide/vote/save/queue/etc.) and non-letter shortcuts.

## Filters

Settings → Filters is a rule engine (spec §26): each rule matches on
**keyword / flair / domain / user / post type / score / comment count**, with
an operator (**contains / equals / regex / less-than / greater-than**) and an
action (**hide / collapse / dim / highlight**), scoped globally or to one
subreddit. Rules run top to bottom; the first match wins. Export/import a
rule list as JSON from the same page (distinct from **Copy/Import preset**,
which is look-and-feel only — no filters or personal data, spec §27.3).

## Architecture — built for Reddit's frequent redesigns

```
extension/
├─ manifest.json            MV3; storage + sidePanel permissions only
├─ service-worker.js        Alt+R command, install seeding, side panel, msg hub
├─ shared/schema.js         settings shape + DEFAULTS + deepMerge + preset helpers
├─ styles/early.css         ← Reddit DOM knowledge, CSS half
├─ content/
│  ├─ selectors.js          ← Reddit DOM knowledge, JS half (ONLY these 2 files)
│  │                          also NATIVE_ACTIONS: shadow-aware vote/save lookup
│  ├─ namespace.js          TL global + event bus
│  ├─ settings.js           sync-storage store, per-subreddit override merge
│  ├─ router.js             pure URL classifier + SPA navigation detection
│  ├─ dom.js                rAF-coalesced pass scheduler
│  ├─ readstate.js          local seen/hidden history (TTL-pruned, debounced)
│  ├─ extractors.js         attribute-first post/comment models
│  ├─ filters.js            filter rule engine (spec §26) — pure, unit-tested
│  ├─ overlay.js            shadow-DOM toast/help/palette/queue-panel host
│  ├─ queue.js              local reading queue (chrome.storage.local)
│  ├─ compactor.js          the pass: html attrs → CSS; stamp data-tl hooks
│  ├─ splitpane.js          Split Pane mode: feed-list capture + left rail
│  ├─ minimap.js            comment mini-map (top-level comment ticks)
│  ├─ keyboard.js           capture-phase keys, typing-safe
│  ├─ palette.js            context-aware command palette
│  └─ main.js               boot; optimistic pre-paint activation
├─ popup/  options/  sidepanel/  icons/
```

### The maintenance contract

**Every Reddit DOM assumption lives in exactly two files:**
`content/selectors.js` (JS) and `styles/early.css` (CSS). Everything else keys
off extension-owned hooks that our JS stamps (`html.tl-on`,
`html[data-tl-density]`, `[data-tl="post"]`, `[data-tl-seen]`, …).

Resilience layers, in order:

1. **Attribute-first extraction** — `<shreddit-post>` / `<shreddit-comment>`
   expose `permalink`, `post-title`, `score`, `comment-count`, `author`,
   `domain`, `depth`… as element attributes that Reddit's own components
   consume, so they survive styling redesigns.
2. **Ranked selector fallbacks** — each selector group is an ordered candidate
   list (current markup first, older/testid/generic last). The resolver records
   which candidate matched.
3. **Selector health diagnostics** — popup → **Layout check** shows per-group
   ✓/✗ against what the current route *should* have. A red group tells you
   exactly which list needs a new candidate.
4. **CSS-only fail-safe** — `main.js` activates the CSS layer optimistically
   before paint; if all JS throws, the page still gets the pure-CSS cleanup and
   Reddit remains fully usable. Passes never throw outward.

### When Reddit ships a redesign

1. Open the popup on the broken page → **Layout check** → note red groups.
2. Inspect the new DOM; **prepend** a candidate selector to that group in
   `content/selectors.js` (keep old candidates — Reddit A/B tests markup).
3. Mirror in the marked `GROUP` block in `styles/early.css` if it's a hide rule.
4. `node test/run.mjs`, reload the extension, done. No other file changes.

### Other design decisions that keep it maintainable

- **Zero build step.** Plain JS content scripts loaded in manifest order onto a
  `TL` namespace. Load-unpacked friendly; nothing to compile, nothing to break.
- **Settings changes flow one way:** any surface writes a partial patch to
  `chrome.storage.sync` → `storage.onChanged` → `tl:settings` → one rAF pass →
  html attributes → CSS. Alt+R is handled in the service worker by flipping the
  stored value, so all tabs and windows stay consistent for free.
- **Stored settings are partial blobs** merged over `TLSchema.DEFAULTS` on
  read — adding a new setting never migrates or breaks old data.
- **Passes are idempotent and frame-batched**; per-node work happens once
  (WeakSet/WeakMap), filter/seen state re-evaluates on every pass so settings
  apply live.
- **Isolated worlds + shadow DOM** — no style or JS collisions with Reddit in
  either direction. Extension UI text is set via `textContent` only.

## Testing

- `node test/run.mjs` — pure-logic smoke tests (routing, settings merge,
  preset helpers, reading-queue list ops, filter-rule migration, and the
  rule engine's matching logic).
- `node test/fixtures.mjs` — fixture tests (spec §30.2): exercises
  `extractors.js`'s post/comment extraction against small hand-built DOM
  stand-ins (attribute-first path, generic fallback, flair/score lookups) —
  no live reddit.com, no browser, no new dependency (a purpose-built fake
  element, not a jsdom-class library).
- `test/e2e.mjs` — Puppeteer drive of real Chrome against live reddit.com:
  loads the extension, verifies activation/sidebar hiding/post stamping,
  measures compact vs native posts-in-view density, exercises `j`/`k`
  selection, screenshots feed + comments. Run: `cd test && npm install && node e2e.mjs`.
- `test/visreg.mjs` — visual regression (spec §30.4): screenshots + layout
  metrics (sidebar visibility, content width, no horizontal scroll, post/
  comment density) at 1366×768 / 1440×900 / 1920×1080 / 2560×1440 across
  native/balanced/ultra/comments modes — every viewport is screenshotted, but
  the first sample after each mode switch is a warm-up only (cross-context
  storage propagation to an already-open tab has no latency guarantee) and
  isn't compared; the other 3 diff against `test/visreg-baseline.json` with
  tolerances (live Reddit content varies run to run). Seed or refresh the
  baseline with `node visreg.mjs --update`; run `node visreg.mjs` to check for
  drift. One browser session, two real page loads total — reruns don't hammer
  Reddit.
- Manual checklist in [SPEC.md §30](SPEC.md).

## Known limitations

Confirmed via live DOM probing, not guessed — documented here instead of
shipping a setting that would silently do nothing:

- **No per-field show/hide for score, comment count, author, subreddit, or
  domain on feed rows.** Score and comment-count render entirely inside
  `<shreddit-post>`'s own shadow root with no exposed `::part()` hook, so
  light-DOM CSS can never reach them — not solvable without Reddit exposing
  new hooks. Author/subreddit/domain toggles would need further live
  selector verification this project hasn't done yet.
- **No comment nesting-width cap.** Nested-comment indentation is generated
  entirely inside each ancestor `<shreddit-comment>`'s *closed* shadow root
  (confirmed live — no exposed padding/margin/custom property), so it can't
  be overridden from outside.
- **Themes only restyle Dense's own UI** (overlay/palette/queue/rail/
  mini-map/selection accents) — not Reddit's own page background/text
  colors, which are Reddit's own theme system. Forcing those to match would
  mean fighting a system this project doesn't control; Reddit's native
  light/dark toggle already covers that.
- **`highlightMods`** relies on an unverified selector (`commentModBadge` in
  `content/selectors.js`, explicitly commented as such) — every other
  selector in this file was checked against live markup; this one wasn't. It
  degrades gracefully (never highlights) rather than breaking anything.
- **No old.reddit.com support.** Everything here is built on `shreddit-*`
  web components; old.reddit.com's classic HTML gets nothing from this
  extension.
- **Native "save" forwarding was never verified against a real click** — it
  requires a logged-in Reddit account, which this project didn't do. Vote
  forwarding (`a`/`d`) was fully verified live.

## Privacy

Settings live in `chrome.storage.sync`; seen/hidden history in
`chrome.storage.local` (30-day TTL, clearable in Settings). Nothing leaves the
browser. Permissions: `storage`, `sidePanel`, host access to reddit.com only.
