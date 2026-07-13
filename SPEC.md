# Design + Technical Specification: **Threadline**

*A minimal, ultra-compact Chrome extension for browsing Reddit without the modern UI bloat.*

## 1. Product thesis

The extension should not merely "hide sidebars." A world-class version should make Reddit feel like a fast power-user reader: closer to Gmail, Linear, Hacker News, or a Bloomberg terminal for threads.

The goal:

**Turn Reddit from a scrolling-heavy social app into a dense, keyboard-driven reading surface where posts, comments, filters, and navigation are always one action away.**

The main friction on modern Reddit: giant subreddit banners, persistent left navigation, right community panels, community-highlight blocks, oversized cards, large comment spacing, repeated action rows, avatars, awards, join/apply prompts, and too much vertical padding. The extension should remove the chrome, preserve the content, and make the page feel instantly "lighter."

Build it as a Manifest V3 Chrome extension, since MV3 is Chrome's current extension platform and is explicitly oriented around better privacy, security, and performance.

---

# 2. Product name and positioning

## Working name

**Threadline**

Other possible names:

| Name                   | Positioning                |
| ---------------------- | -------------------------- |
| **Threadline**         | Clean, premium, focused    |
| **Dense**              | Direct, power-user         |
| **Reduct**             | Minimalist, memorable      |
| **Lessit**             | Playful but maybe too cute |
| **Postline**           | Feed-oriented              |
| **Compact for Reddit** | Clear, but more generic    |

Avoid naming that implies official Reddit affiliation. Use language like "for reddit.com" or "minimal reader mode for Reddit" only after checking store/trademark constraints.

## One-line pitch

**A fast, compact Reddit reader that removes the noise, compresses posts and comments, and lets you browse with the keyboard.**

## Viral hook

The extension should show users an immediate before/after transformation:

> "You were seeing 4 posts per screen. Now you see 14."

That density delta is the product's shareable moment.

---

# 3. Core user promise

Threadline should deliver five feelings within the first 10 seconds:

1. **Relief** — the sidebars, banners, and bulky blocks disappear.
2. **Density** — posts and comments become scannable rows.
3. **Control** — the user can tune density, media, filters, and keyboard behavior.
4. **Safety** — one click restores native Reddit.
5. **Speed** — no new account, no setup, no data leaving the browser.

---

# 4. Primary product requirements

## Must-have

| Requirement               | Specification                                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One-click minimal mode    | Toolbar button and keyboard shortcut toggle compact mode instantly.                                                                                                                 |
| Compact feed              | Convert Reddit feed cards into dense rows with score, comments, title, flair, domain, age, and optional thumbnail.                                                                  |
| Compact comments          | Reduce comment padding, hide avatars by default, preserve nesting, collapse action clutter.                                                                                         |
| Hide layout noise         | Hide left nav, right sidebar, banners, community boxes, "games," join/apply prompts, community highlights, and promotional clutter.                                                 |
| Keyboard navigation       | `j/k` next/previous post or comment, `Enter` open/expand, `c` comments, `o` open link, `s` save, `h` hide/read, `/` search within page.                                             |
| Per-subreddit preferences | Example: thumbnails enabled for r/pics, disabled for r/ClaudeCode.                                                                                                                  |
| Fast fallback             | If Reddit changes its DOM, fall back to CSS-only cleanup rather than breaking the page.                                                                                             |
| Zero-account operation    | No separate login or cloud service required.                                                                                                                                        |
| Local-first privacy       | Store settings and read state in Chrome storage, not on a remote server. Chrome's extension storage API is designed for extension state and can be accessed by extension contexts. |

## Should-have

| Requirement               | Specification                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| Command palette           | `Cmd/Ctrl+K` opens actions: switch subreddit, toggle media, show hidden, filter flair, open queue. |
| Split-pane mode           | Feed on the left, comments or preview on the right, like an email client.                          |
| Reading queue             | Press `q` to save a post into a local "read later" queue.                                          |
| Seen-post dimming         | Visited posts automatically dim or compress further.                                               |
| Flair and keyword filters | Hide posts by flair, keyword, domain, media type, or minimum comment count.                        |
| Compact search            | Search results become rows with subreddit, score, comments, age, and title.                        |
| Mini-map for comments     | Shows where top-level comments begin and lets users jump quickly.                                  |
| Presets                   | "Ultra Dense," "Balanced," "Media Browse," "Comment Reader," "Moderator Scan."                     |

## Nice-to-have

| Requirement            | Specification                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| Local summarization    | Optional local-only thread outline if browser/device supports it. No server requirement. |
| Export/import settings | Copyable JSON preset for sharing configuration.                                          |
| Cross-browser build    | Firefox/Edge later, once Chrome MVP is stable.                                           |
| Moderator mode         | Highlight mod comments, reports, removed content markers, locked threads.                |

---

# 5. UX design specification

## 5.1 Global layout modes

### Mode A — Native Clean

The safest initial mode. It keeps Reddit's DOM visible but hides and compresses elements with CSS.

Use for:

* First install.
* Pages where full overlay extraction fails.
* Users who want "Reddit, but less annoying."

### Mode B — Compact Reader

The default mode.

Transform the feed into a single-column dense list. Original Reddit elements remain in the DOM, but most are hidden or restyled.

Target:

* 10–16 posts visible on a 1440×900 display.
* Row height: 42–56 px.
* Optional thumbnail: 40–64 px.
* No left sidebar.
* No right sidebar.
* No giant subreddit banner.

### Mode C — Split Pane

Power-user mode.

Left pane: post list.
Right pane: selected post preview or comments.

Target:

* Avoid leaving the feed.
* Make Reddit feel like an inbox.
* Perfect for technical subreddits, news, research, and communities like r/ClaudeCode.

### Mode D — Ultra Dense

For users who want maximum information per screen.

Target:

* 18–30 posts visible.
* No thumbnails.
* Single-line titles.
* Inline metadata.
* Hover-only actions.

---

# 6. Feed page design

## 6.1 Current problem

The user's actual feed content competes with:

* Reddit's global header.
* Large community banner.
* Subreddit icon and title block.
* Create/join controls.
* Left nav.
* Right community card.
* Moderator prompt.
* Community resources.
* Rules panel.
* Community highlights.
* Large post cards with repeated actions.

The extension should treat everything except the post stream as secondary.

## 6.2 Target feed layout

```
┌─────────────────────────────────────────────────────────────┐
│ r/ClaudeCode  Top ▾  This Week ▾   Search…          Density │
├──────┬──────┬────────────────────────────────────────┬──────┤
│ 2.7k │ 500  │ This is a message for Anthropic…       │ 7d   │
│ 2.2k │ 730  │ Ok I'll admit it. Fable is good…       │ 4d   │
│ 2.2k │ 41   │ Claude examining it's own work…        │ 1d   │
│ 2.1k │ 311  │ Fable Came Back Nerfed                 │ 4d   │
└──────┴──────┴────────────────────────────────────────┴──────┘
```

## 6.3 Feed row anatomy

Each post row should contain:

| Element           | Behavior                                                            |
| ----------------- | ------------------------------------------------------------------- |
| Score             | Compact number, fixed width.                                        |
| Comment count     | Fixed width, clickable.                                             |
| Flair             | Small pill, hidden in ultra-dense mode unless important.            |
| Title             | Main visual focus. One or two lines depending on density.           |
| Domain/media type | Small muted metadata: `github.com`, `i.redd.it`, `self.ClaudeCode`. |
| Author + age      | Muted, compact.                                                     |
| Thumbnail         | Optional. Off by default in technical/text-heavy subreddits.        |
| Actions           | Hidden until hover or keyboard focus.                               |

## 6.4 Feed row states

| State        | Visual                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Unread       | Normal title weight.                                                                                                     |
| Seen         | Dimmed title, reduced opacity.                                                                                           |
| Selected     | Thin left border or subtle row highlight.                                                                                |
| Hidden/read  | Removed or collapsed into "show hidden" bucket.                                                                          |
| Pinned/mod   | Small pin marker, not a giant block.                                                                                     |
| NSFW/spoiler | Preserve label and blur media unless user disables.                                                                      |
| Promoted/ad  | Hidden by default only if allowed by store policy and implementation approach; otherwise compressed and clearly labeled. |

---

# 7. Comments page design

## 7.1 Current problem

Comments pages ship with:

* Large empty margins.
* Big reply box.
* Large comment cards.
* Avatars taking horizontal and vertical space.
* Nested comments with too much indentation.
* Action buttons under every comment.
* Sidebar occupying a large amount of screen.

## 7.2 Target comments layout

```
┌─────────────────────────────────────────────────────────────┐
│ Community Feedback                 51 ▲   321 comments      │
│ Megathread · r/ClaudeCode · 8mo · sort: best                │
├─────────────────────────────────────────────────────────────┤
│ asurah        Actually the last few weeks have been...      │
│   aviboy2006  100 cents on this. I am able to see...        │
│ snow_schwartz My reddit wishlist: Helpful posts that...     │
│   Bertintentic I have heard that the dev even didn't...     │
└─────────────────────────────────────────────────────────────┘
```

## 7.3 Comment compaction rules

| Item                     | Default behavior                                                |
| ------------------------ | ---------------------------------------------------------------- |
| Avatars                  | Hidden. Show on hover or optional setting.                      |
| Awards/reactions         | Hidden unless post has unusually high award count.              |
| Reply/share/more row     | Hidden until hover/focus.                                       |
| Indentation              | 12 px per level, max visible indent after level 6.              |
| Collapse controls        | Always visible as small chevron or vertical guide click target. |
| Top-level comments       | Slightly stronger left guide.                                   |
| OP/mod/admin comments    | Keep visible badges.                                            |
| Deleted/removed comments | Keep visible but compressed.                                    |
| Reply box                | Hidden behind "Reply" button until needed.                      |

## 7.4 Comment navigation

Keyboard:

| Key     | Action                                           |
| ------- | ------------------------------------------------ |
| `j`     | Next comment                                     |
| `k`     | Previous comment                                 |
| `J`     | Next top-level comment                           |
| `K`     | Previous top-level comment                       |
| `l`     | Expand selected comment                          |
| `h`     | Collapse selected comment                        |
| `Enter` | Open focused comment permalink or expand actions |
| `p`     | Jump to parent                                   |
| `n`     | Next new/unread comment                          |
| `/`     | Search comments                                  |
| `u`     | Back to subreddit/feed                           |
| `.`     | Open command palette                             |

---

# 8. Extension UI

## 8.1 Toolbar popup

Small, fast, no clutter.

```
Threadline
━━━━━━━━━━━━━━━━
Mode          Compact Reader ▾
Density       [────●────] 72%
Media         Off / Thumb / Inline
Sidebars      Hidden
Comments      Compact
Keyboard      On

[Open settings] [Reset Reddit]
```

## 8.2 In-page mini control

A small floating control should appear only on hover or after pressing a shortcut.

Location:

* Bottom-right by default.
* Moveable if user drags it.
* Hidden while typing.

Controls:

* Toggle native/compact.
* Density slider.
* Media toggle.
* Open command palette.
* Report broken page.

## 8.3 Side panel

Use the Chrome side panel for advanced settings, presets, filter management, and debugging. Chrome's Side Panel API is designed for extension UI alongside the current webpage.

Side panel sections:

1. **Preset** — Balanced, Ultra Dense, Media, Comments, Moderator
2. **Layout** — Hide left nav, hide right nav, hide banners, hide community highlights, center content, max width, sticky compact header
3. **Feed** — Row height, thumbnails, author, subreddit, domain, flair, score, comment count, dim seen posts
4. **Comments** — Hide avatars, compact actions, max nesting width, highlight OP/mod, collapse AutoModerator, collapse low-score comments
5. **Filters** — Keyword, flair, domain, media filters, per-subreddit overrides
6. **Keyboard** — Enable Vim navigation, remap keys, disable shortcuts while typing
7. **Privacy** — Local-only mode, clear local read history, export/import settings

---

# 9. Information architecture

## 9.1 Page types to support

| Page type             | URL pattern                    | Required behavior                         |
| --------------------- | ------------------------------ | ------------------------------------------ |
| Home feed             | `/`, `/hot`, `/new`, etc.      | Compact feed rows.                        |
| Subreddit feed        | `/r/{subreddit}`               | Compact feed, compact subreddit header.   |
| Post comments         | `/r/{subreddit}/comments/{id}` | Compact post header and comments.         |
| User profile          | `/user/{name}`                 | Compact user posts/comments.              |
| Search                | `/search` or subreddit search  | Compact result rows.                      |
| Saved/upvoted/history | User-specific lists            | Compact rows; preserve privacy.           |
| Old Reddit            | `old.reddit.com`               | Optional support later; not MVP priority. |

## 9.2 Route detection

Use a client-side router because Reddit behaves like a single-page app.

Events to detect:

* Initial page load.
* `history.pushState`.
* `history.replaceState`.
* `popstate`.
* Major DOM root changes.
* URL path changes without full reload.

---

# 10. Technical architecture

## 10.1 Recommended architecture

```
Chrome Extension
│
├─ manifest.json
├─ service-worker.js
│  ├─ keyboard command handling
│  ├─ settings sync/local routing
│  ├─ side panel enablement
│  └─ message broker
│
├─ content/
│  ├─ boot/namespace
│  ├─ router
│  ├─ mutation observer
│  ├─ selector registry (single source of truth)
│  ├─ extractors (post, comment, page context)
│  ├─ compactor / renderers
│  ├─ keyboard + command palette
│  └─ state (settings, read state, subreddit prefs)
│
├─ styles/ (early.css injected at document_start)
├─ popup/
├─ sidepanel/
└─ options/
```

## 10.2 Chrome extension components

| Component         | Responsibility                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Manifest V3       | Declares permissions, host access, content scripts, service worker, commands, side panel.   |
| Content script    | Reads and modifies Reddit DOM. Runs in an isolated world.                                   |
| Service worker    | Stateless event hub for commands, install/update logic, settings messages, side panel.      |
| Popup             | Quick controls.                                                                             |
| Side panel        | Full settings and filter management.                                                        |
| Storage           | Local settings, syncable preferences, seen/read state, filters.                             |
| Mutation observer | Handles Reddit's dynamic DOM changes.                                                       |
| CSS layer         | First-line compaction and no-flash hiding.                                                  |
| Renderer layer    | Optional custom compact rows and split-pane UI.                                             |

---

# 11. Permissions

Use the smallest practical permission set.

## 11.1 MVP permissions

```json
{
  "permissions": ["storage", "sidePanel"],
  "host_permissions": [
    "https://www.reddit.com/*",
    "https://new.reddit.com/*"
  ]
}
```

## 11.2 Optional permissions

| Permission              | Use only if needed                                                        |
| ----------------------- | -------------------------------------------------------------------------- |
| `scripting`             | If dynamically injecting scripts after user grants access.               |
| `activeTab`             | If offering one-time page activation without broad host permission.      |
| `declarativeNetRequest` | Only if adding an optional performance/blocking module.                  |
| `tabs`                  | Avoid unless truly needed.                                                |
| `commands`              | Manifest key (not a permission) for keyboard shortcuts.                  |

---

# 12. Manifest requirements

* Manifest V3, minimum Chrome 116.
* `storage` + `sidePanel` permissions only.
* Host permissions restricted to Reddit domains.
* Content scripts (CSS + JS) at `document_start`.
* Commands: toggle compact mode (`Alt+R`), open command palette (`Ctrl/Cmd+Shift+K`).
* Options page + side panel + popup.

---

# 13. DOM strategy

## 13.1 Principle

Do **not** depend on one fragile selector.

Reddit changes its UI often. The extension should use a layered adapter system:

1. Semantic custom elements where available (`shreddit-post`, `shreddit-comment`).
2. Stable attributes where available (`permalink`, `post-title`, `score`, `comment-count`, `depth`…).
3. ARIA labels and link patterns.
4. URL and permalink inference.
5. Text extraction fallback.
6. CSS-only fallback.

## 13.2 Selector resolver

Every Reddit DOM assumption lives in exactly one JS registry (ordered candidate lists per group: post, comment, sidebars, header, banner…) and one CSS file. The resolver walks candidates in order, records which one matched, and exposes a health report for diagnostics ("Layout broken?" panel).

## 13.3 Extracted post model

```ts
type RedditPost = {
  id: string;
  permalink: string;
  title: string;
  subreddit?: string;
  author?: string;
  ageText?: string;
  scoreText?: string;
  commentCountText?: string;
  flairText?: string;
  domain?: string;
  postType: "text" | "link" | "image" | "video" | "gallery" | "poll" | "unknown";
  thumbnailUrl?: string;
  isPinned?: boolean;
  isPromoted?: boolean;
  isNSFW?: boolean;
  isSpoiler?: boolean;
  originalNode: HTMLElement;
};
```

## 13.4 Extracted comment model

```ts
type RedditComment = {
  id: string;
  permalink?: string;
  author?: string;
  bodyText: string;
  scoreText?: string;
  ageText?: string;
  depth: number;
  isOP?: boolean;
  isMod?: boolean;
  isAdmin?: boolean;
  isCollapsed?: boolean;
  isDeleted?: boolean;
  originalNode: HTMLElement;
};
```

---

# 14. Rendering strategy

## 14.1 MVP: CSS-native compaction

Fastest and least risky.

* Add activation class to `document.documentElement`.
* Inject CSS at `document_start`.
* Hide major non-content regions.
* Compress existing post cards and comments.
* Preserve native Reddit event handlers.

Pros: stable, simple, voting/saving/commenting keep working.
Cons: less visually perfect; constrained by Reddit DOM.

## 14.2 V1: Hybrid row renderer

Extract post data from Reddit DOM and render compact rows in a Shadow DOM overlay. Original Reddit DOM remains hidden but present. Forward interactions to native controls where reliable.

## 14.3 V2: Split-pane renderer

Feed on left, selected preview/comments on right. Use current Reddit navigation and preserve local list state (recommended over iframes/fetch).

---

# 15. CSS design system

## 15.1 Design tokens

```css
:root.threadline-enabled {
  --tl-font-size: 13px;
  --tl-line-height: 1.28;
  --tl-row-height: 46px;
  --tl-comment-indent: 12px;
  --tl-content-max-width: 1040px;
  --tl-muted-opacity: 0.62;
  --tl-border-opacity: 0.12;
  --tl-radius: 6px;
}
```

## 15.2 Density presets

| Preset      |    Font | Row height | Thumbnail | Title lines |
| ----------- | ------: | ---------: | --------: | ----------: |
| Comfortable |   14 px |      64 px |     56 px |           2 |
| Balanced    |   13 px |      50 px |     44 px |           2 |
| Dense       | 12.5 px |      42 px |     36 px |           1 |
| Ultra       |   12 px |      32 px |       Off |           1 |

## 15.3 Core CSS behavior

All rules gated on the activation class. Hide sidebars/banners/highlight blocks, center and constrain main content, compress post cards and comments (padding, margins, font-size, line-height).

---

# 16. Keyboard interaction specification

## 16.1 Global shortcuts

| Shortcut           | Action                         |
| ------------------ | ------------------------------ |
| `Alt/Option+R`     | Toggle Threadline.             |
| `Cmd/Ctrl+Shift+K` | Open command palette.          |
| `Esc`              | Close overlay/palette/preview. |
| `?`                | Show keyboard help.            |

## 16.2 Feed shortcuts

| Key     | Action                                        |
| ------- | --------------------------------------------- |
| `j`     | Next post.                                    |
| `k`     | Previous post.                                |
| `Enter` | Open selected post/comments.                  |
| `o`     | Open outbound link.                           |
| `c`     | Open comments.                                |
| `p`     | Preview inline.                               |
| `s`     | Save via native Reddit action when available. |
| `q`     | Add to local queue.                           |
| `h`     | Hide locally / mark read.                     |
| `m`     | Toggle media.                                 |
| `f`     | Filter this flair/domain/user.                |
| `g h`   | Home feed.                                    |
| `g s`   | Current subreddit top.                        |
| `g n`   | Current subreddit new.                        |

## 16.3 Typing safety

Shortcuts must disable when focus is inside: textarea, input, search field, comment editor, contenteditable region, Reddit's rich text editor.

---

# 17. Settings data model

```ts
type ThreadlineSettings = {
  enabled: boolean;
  mode: "native-clean" | "compact-reader" | "split-pane" | "ultra-dense";

  density: {
    preset: "comfortable" | "balanced" | "dense" | "ultra";
    rowHeight: number;
    fontSize: number;
    commentIndent: number;
  };

  layout: {
    hideLeftSidebar: boolean;
    hideRightSidebar: boolean;
    hideBanners: boolean;
    hideCommunityHighlights: boolean;
    hidePrompts: boolean;
    centerContent: boolean;
    maxContentWidth: number;
    stickyCompactHeader: boolean;
  };

  feed: {
    thumbnails: "off" | "small" | "large" | "inline";
    showAuthor: boolean;
    showSubreddit: boolean;
    showDomain: boolean;
    showFlair: boolean;
    showScore: boolean;
    showCommentCount: boolean;
    dimSeenPosts: boolean;
    collapsePinned: boolean;
  };

  comments: {
    compact: boolean;
    hideAvatars: boolean;
    hideActionsUntilHover: boolean;
    collapseAutoModerator: boolean;
    collapseLowScore: boolean;
    maxIndentLevel: number;
    highlightOP: boolean;
    highlightMods: boolean;
  };

  keyboard: {
    enabled: boolean;
    vimNavigation: boolean;
    customBindings: Record<string, string>;
  };

  filters: {
    keywords: string[];
    flairs: string[];
    domains: string[];
    users: string[];
    hideNSFW: boolean;
    hideSpoilers: boolean;
  };

  subredditOverrides: Record<string, Partial<ThreadlineSettings>>;

  privacy: {
    localOnly: boolean;
    syncSettings: boolean;
    storeReadHistory: boolean;
    readHistoryTtlDays: number;
  };
};
```

---

# 18. Storage strategy

## 18.1 Storage areas

| Data                   | Storage                                                  |
| ---------------------- | --------------------------------------------------------- |
| Global settings        | `chrome.storage.sync` if small and sync enabled.         |
| Per-subreddit settings | `chrome.storage.sync` until size limits become an issue. |
| Read/seen history      | `chrome.storage.local` or IndexedDB.                     |
| Large queues/history   | IndexedDB.                                               |
| Temporary DOM state    | In-memory only.                                          |

## 18.2 Read-state model

```ts
type ReadState = {
  postId: string;
  permalink: string;
  subreddit?: string;
  titleHash: string;
  firstSeenAt: number;
  lastSeenAt: number;
  status: "seen" | "read" | "hidden" | "queued";
};
```

## 18.3 Data retention

* Seen post history: 30 days.
* Hidden posts: 90 days.
* Queue: until user removes.
* Filters/settings: indefinite.
* No remote analytics.

---

# 19. Mutation observer strategy

Reddit pages update dynamically. The extension needs a resilient DOM pipeline:

* Boot: add root class immediately, load settings, install route observer, install mutation observer, schedule initial pass.
* Batch DOM work with `requestAnimationFrame`; coalesce passes.
* Observe only major content roots when avoidable.
* Use `WeakSet<HTMLElement>` for processed nodes.
* Reprocess on route change.
* Never run expensive extraction on every tiny mutation.
* Debounce aggressive Reddit re-renders.

---

# 20. Performance requirements

| Metric                        |                                 Target |
| ----------------------------- | --------------------------------------: |
| Initial CSS activation        | Under 50 ms after content script load. |
| First compaction pass         |          Under 150 ms on typical feed. |
| Route-change recompact        |                          Under 100 ms. |
| Mutation processing           |           Under 16 ms per frame chunk. |
| Long tasks                    |                Avoid tasks over 50 ms. |
| Memory overhead               |                   Under 30 MB typical. |
| Read-history lookup           |                  O(1) by post ID/hash. |
| Max processed nodes per frame |              Configurable, default 40. |

Performance principle: **CSS first. JS enhancement second. Full custom rendering only when it clearly improves UX.**

---

# 21. Privacy and compliance specification

## 21.1 Privacy principles

* No remote server required.
* No Reddit credentials collected.
* No password fields touched.
* No content uploaded.
* No behavioral analytics by default.
* No hidden tracking pixels.
* No affiliate injection.
* No modifying outbound links.
* No vote automation.
* No spam automation.
* No scraping or storing Reddit content beyond local user-facing features like read state or queue.

## 21.2 Reddit API stance

MVP avoids the Reddit API entirely. It operates as a user-side DOM customization layer. If an API-backed version is ever added, it must follow Reddit's Data API terms.

## 21.3 Store listing disclosure

* The extension changes the appearance and layout of reddit.com.
* Settings are stored locally or in Chrome sync if the user enables sync.
* The extension does not sell data.
* The extension does not collect Reddit login credentials.
* The extension is not affiliated with Reddit.

---

# 22. Security requirements

| Area            | Requirement                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Rendering       | Never inject unsanitized HTML from Reddit into extension UI. Use `textContent` for titles/comment text. |
| Shadow DOM      | Use Shadow DOM for extension overlays to avoid CSS leakage.                                             |
| CSP             | No remote code, no `eval`, no inline scripts.                                                           |
| Dependencies    | Keep dependency count low; audit packages.                                                              |
| Message passing | Validate all message types and payloads.                                                                |
| Storage         | Never store auth tokens, cookies, or private messages.                                                  |
| Links           | Preserve destination URLs; do not rewrite monetized links.                                              |
| Host access     | Restrict to Reddit domains.                                                                             |
| Failure mode    | If extraction fails, disable custom rendering and keep Reddit usable.                                   |

---

# 23. Accessibility specification

* Preserve native page scroll.
* Support keyboard-only browsing.
* Respect `prefers-reduced-motion`.
* Respect light/dark mode.
* Maintain visible focus states.
* Do not trap focus except inside modal command palette.
* Use ARIA roles for custom list rows (role=listbox/option) and comment trees (role=tree/treeitem).

---

# 24. Visual design direction

## 24.1 Aesthetic

Quiet. Fast. Technical. Trustworthy. Native to the browser.

Avoid: neon themes, heavy animations, big onboarding modals, overdesigned cards, gamified UI, "AI everywhere" positioning.

## 24.2 Typography

System font stack: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

## 24.3 Themes

Auto, Light, Dark, OLED dark, High contrast, Sepia/reading mode.

## 24.4 Spacing

| Element                     |     Default |
| --------------------------- | -----------: |
| Feed row vertical padding   |      4–7 px |
| Feed row horizontal padding |     8–12 px |
| Comment vertical padding    |      2–5 px |
| Comment indent              |       12 px |
| Header height               |    32–40 px |
| Right/left sidebars         |      Hidden |
| Content max width           | 960–1180 px |

---

# 25. Command palette specification

## 25.1 Invocation

`Cmd/Ctrl+Shift+K`, mini-control button, popup button, `.` key.

## 25.2 Commands

Toggle compact mode; switch density; show/hide thumbnails; hide posts with this flair/domain; clear filters; open current subreddit in New/Top:Week; jump to next unread; open queue; export settings; reset page.

## 25.3 Command search

Fuzzy match; recent commands ranked higher; context-aware commands based on feed/comment page.

---

# 26. Filter engine

## 26.1 Rule model

```ts
type FilterRule = {
  id: string;
  enabled: boolean;
  scope: "global" | "subreddit";
  subreddit?: string;
  type: "keyword" | "flair" | "domain" | "user" | "postType" | "score" | "commentCount";
  operator: "contains" | "equals" | "regex" | "lt" | "gt";
  value: string | number;
  action: "hide" | "collapse" | "dim" | "highlight";
};
```

## 26.2 Examples

| Rule                          | Action                   |
| ----------------------------- | ------------------------- |
| Flair equals `Meme`           | Collapse                 |
| Domain equals `x.com`         | Hide                     |
| Title contains `drama`        | Dim                      |
| Comment count less than `5`   | Hide on high-volume subs |
| Post type equals `image`      | Hide in work mode        |
| Author equals `AutoModerator` | Collapse in comments     |

---

# 27. "Viral quality" features

## 27.1 Density meter

Show a tiny metric after activation: "Before: 4 posts visible → After: 15 posts visible (+275%)". Once, then a small stat in the popup.

## 27.2 Before/after hold key

Holding `Alt/Option` temporarily reveals native Reddit. Releasing returns to Threadline.

## 27.3 Preset sharing

Export a preset as a short JSON blob (settings only, no user data).

## 27.4 Subreddit auto-profiles

Suggest layout modes locally: text-heavy → ultra dense/thumbs off; image-heavy → media browse; news → balanced + domain visible; comments-heavy → comment reader.

## 27.5 Reader queue

Local, private queue: `q` adds selected post; side panel shows queue; survives restart; no Reddit API.

## 27.6 Broken-page reporter

"Layout broken?" opens a local diagnostic panel showing selector health. Optional opt-in report sends only selector failure metadata, never Reddit content.

---

# 28. Build plan

## Phase 0 — Prototype (2–4 days)

MV3 scaffold; toggle compact mode; hide sidebars/banners/prompts; compress feed cards and comments; popup with density control; local settings.

Acceptance: page visually transforms into a clean single-column layout; instant native/compact toggle; no major Reddit interactions break.

## Phase 1 — MVP (2–3 weeks)

Per-subreddit settings; keyboard navigation; seen/read dimming; comment compaction; filter rules; command palette; side panel settings; robust route detection; selector fallback + health.

Acceptance: works on home, subreddit, comments, search, user pages; 10+ posts visible in balanced, 16+ in ultra-dense; comments require materially less scrolling; store-ready privacy policy.

## Phase 2 — Power-user release (4–6 weeks)

Split-pane mode; reading queue; preset sharing; filter import/export; comment mini-map; native action forwarding; visual regression testing.

## Phase 3 — Premium polish

Cross-browser build; advanced themes; moderator preset; optional local-only summarization; better media preview; selector health diagnostics; public issue templates + preset gallery.

---

# 29. Engineering stack

| Area                | Choice                                            |
| ------------------- | -------------------------------------------------- |
| Language            | Plain modern JavaScript (zero build step) or TS   |
| Extension framework | Plain MV3                                         |
| UI                  | Vanilla DOM + Shadow DOM overlays                 |
| Styling             | Plain CSS with `tl-` prefix                       |
| Storage             | `chrome.storage`; IndexedDB for larger local data |
| Testing             | Node smoke tests, Puppeteer E2E, DOM fixtures     |
| Release             | Zip MV3 dist                                      |

Avoid initially: heavy frameworks inside Reddit pages, server accounts, analytics SDKs, remote config, Reddit API dependency, full custom Reddit clone, overly broad permissions.

---

# 30. Testing specification

## 30.1 Unit tests

URL route classification; post extraction; comment extraction; filter rules; settings merge logic; keyboard shortcut handling; read-state storage.

## 30.2 Fixture tests

Representative anonymized HTML fixtures: subreddit feed, home feed, search, comments (nested/deleted), media posts, text posts, promoted posts, logged-out/in, dark/light mode.

## 30.3 E2E tests (Puppeteer)

Extension loads; compact mode toggles; sidebars disappear; feed scrollable; clicking posts works; keyboard navigation works; typing doesn't trigger shortcuts; route changes reapply compaction; native restore works.

## 30.4 Visual regression

Screenshots at 1366×768, 1440×900, 1920×1080, 2560×1440 across native/balanced/ultra/comments modes.

---

# 31. Failure and fallback behavior

| Failure                        | Expected behavior                                                      |
| ------------------------------ | ----------------------------------------------------------------------- |
| Reddit changes post DOM        | Use CSS-only mode; show "reduced compatibility" notice in popup.       |
| Settings fail to load          | Use default balanced preset.                                           |
| Storage quota issue            | Disable read-history storage, keep visual compaction.                  |
| Mutation observer overload     | Temporarily pause custom rendering and keep CSS compaction.            |
| User enters editor             | Suspend keyboard shortcuts.                                            |
| Page unsupported               | Show "Threadline not active on this page" in popup.                    |
| Native action forwarding fails | Open native post page instead of simulating click.                     |

---

# 32. Acceptance criteria for "world-class"

1. **One-click transformation**: Reddit visibly becomes compact in under one second.
2. **Native escape hatch**: User can return to normal Reddit instantly.
3. **No broken browsing**: Posts, comments, links, search, sorting still work.
4. **High density**: At least 2.5× more posts visible.
5. **Low scroll**: Comment pages reduce vertical distance by at least 40%.
6. **Keyboard useful**: Browse a subreddit without touching the mouse.
7. **No account required**.
8. **Local-first**: No Reddit content sent to a server.
9. **Store-safe**: Minimal permissions, clear disclosure, no surprise behavior.
10. **Resilient**: If Reddit changes the UI, the extension degrades gracefully.

---

# 33. Store listing concept

## Title

**Threadline — Compact Reader Mode**

## Subtitle

**Browse reddit.com faster with dense feeds, compact comments, filters, and keyboard navigation.**

## Description

Threadline removes visual clutter from reddit.com and turns feeds and comment threads into a compact, keyboard-friendly reading interface. Hide sidebars, banners, oversized cards, community boxes, and repeated action clutter while preserving the Reddit content you came to read.

## Key bullets

Compact feed rows · Compact comment trees · Hide sidebars and banners · Keyboard navigation · Per-subreddit presets · Local reading queue · Local-first settings · One-click restore to native Reddit · Not affiliated with Reddit.

---

# 34. Final product principle

> "I didn't realize how much Reddit was making me work until it stopped."

That is what makes it viral: not novelty, not AI, not extra features — but the immediate sensation that the web page is finally respecting the user's attention.
