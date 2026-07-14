# Store listing & launch copy — reference drafts

Copy-paste source for the Chrome Web Store developer dashboard and the
Product Hunt listing. Not shipped in the extension itself — kept here so
the copy has one source of truth and a history.

---

## Chrome Web Store — Store Listing tab

**Extension name** (45 char max — this draft is 29):
```
Dense — Compact Reddit Reader
```

**Summary** (132 char max — this draft is 122):
```
Turns reddit.com into a dense, keyboard-driven reading surface. Removes clutter, compacts feeds and comments. Local-first.
```

**Description** (16,000 char max — this draft is well under, kept scannable
rather than maxing it out):

```
Dense removes Reddit's UI bloat and turns feeds and comment threads into
a fast, dense, keyboard-driven reading surface — entirely in your browser.

WHAT IT DOES
• Compacts feed rows and comment threads so you see far more per screen
• Full keyboard navigation (j/k to move, Enter to open, and more — press
  ? on Reddit once installed for the full list)
• A command palette (.) for quick actions and settings changes
• Split Pane mode: browse your feed and read a thread side by side
• A local reading queue (q to save a post for later — never leaves your
  browser)
• A rule-based filter engine: hide, collapse, dim, or highlight posts by
  keyword, flair, domain, author, post type, score, or comment count
• Native upvote/downvote/save — clicks Reddit's own buttons, never
  simulates a vote
• Six themes for Dense's own interface: Auto, Light, Dark, OLED,
  High-contrast, Sepia
• A comment mini-map and per-subreddit settings

HOW IT WORKS
Dense runs as a content script on reddit.com. It reads the page, applies
compact styling, and stamps its own markers — it never modifies what
Reddit actually serves you, and Alt (hold) always shows you native Reddit
underneath if you want to compare or double-check anything. If Reddit
ships a redesign that breaks something, a CSS-only fallback keeps the
page usable while it gets fixed.

PRIVACY
No servers. No analytics. No accounts. No Reddit credentials. Every
setting, filter, and locally-tracked read-history entry stays in Chrome's
own storage on your device. Full privacy policy:
https://github.com/singaporeandurian/dense-reddit/blob/main/PRIVACY.md

Not affiliated with, endorsed by, or sponsored by Reddit, Inc.

Source code, issue tracker, and full technical documentation:
https://github.com/singaporeandurian/dense-reddit
```

**Category**: Productivity

**Language**: English

---

## Chrome Web Store — Privacy tab

**Single purpose description**:
```
Dense transforms reddit.com's own pages into a denser, keyboard-navigable
reading layout, entirely client-side. It hides clutter, compacts feed
rows and comment threads, and adds keyboard shortcuts and local
filtering/queueing — nothing more.
```

**Permission justifications**:

| Permission | Justification |
| --- | --- |
| `storage` | Stores the user's display settings, filter rules, per-subreddit overrides, local reading queue, and local seen/hidden post history — all on-device, nothing transmitted anywhere. |
| `sidePanel` | Shows the same settings interface in Chrome's side panel as an alternative to the full options page. No data implications beyond `storage` above. |
| Host permission: `https://www.reddit.com/*`, `https://new.reddit.com/*` | The extension is a content script that reads and restyles Reddit's own page DOM to compact it and add keyboard navigation. It has no access to, and requests no access to, any other site. |

**Remote code**: No — the extension executes no remotely hosted or
dynamically fetched code. Zero build step; every script shipped in the
package is exactly what runs.

**Data usage checkboxes**: none apply — no personally identifiable
information, no health info, no financial info, no authentication
credentials, no location, no web browsing history (beyond reading Reddit's
own already-loaded page DOM to restyle it), no user activity is collected
or transmitted anywhere. Certify "does not collect or use user data" if
that option is offered as a single checkbox; otherwise leave every
data-type checkbox unchecked.

**Privacy policy URL**:
```
https://github.com/singaporeandurian/dense-reddit/blob/main/PRIVACY.md
```

---

## Chrome Web Store — Distribution tab

- **Visibility**: Public
- **Pricing**: Free
- **Regions**: All regions (no reason to restrict)

---

## Product Hunt

**Tagline** (~60 char range):
```
A dense, keyboard-driven reading mode for Reddit
```

**Description**:
```
Dense is a Chrome extension that strips Reddit's feed and comment pages
down to something you can actually read fast — dense rows, full keyboard
navigation, a command palette, and a rule-based filter engine, all running
entirely in your browser. No servers, no accounts, no analytics.

Highlights:
→ See 3-4x more posts per screen without losing readability
→ j/k navigation, native vote/save forwarding (real clicks, not simulated)
→ Split Pane mode — browse and read side by side, like an inbox
→ Filter rules: hide/collapse/dim/highlight by keyword, flair, domain,
  author, score, or comment count
→ Six themes, a local reading queue, a comment mini-map

Open source, local-first, and built specifically to survive Reddit's
frequent redesigns (every DOM assumption lives in exactly two files).
```

**Topics/tags**: Chrome Extensions, Productivity, Developer Tools, Reddit

**Maker's first comment** (draft — personalize the "why" before posting,
this is a starting point, not final copy):
```
Hey Product Hunt 👋

I built Dense because Reddit's default feed shows maybe 4 posts per
screen and comment threads eat your whole scroll wheel. I wanted
something dense and keyboard-driven — closer to how a good RSS reader or
email client feels — without giving up any of Reddit's actual
functionality underneath.

A few things I cared about getting right:
- It never fakes anything — votes and saves click Reddit's real buttons
- Holding Alt always shows you native Reddit if you want to compare
- Everything is local — no server, no account, no analytics
- The whole thing is open source: [repo link]

Would love feedback, especially on the filter rule engine and the
command palette — those are the two features I'm most curious whether
people actually use the way I imagined.
```

---

## Notes for whoever fills these in

- Swap the CWS description's feature list order if a specific feature
  (filters? split pane?) turns out to be the thing people react to most in
  early feedback — this draft leads with the density claim since that's
  the spec's own designed "viral hook."
- The maker's comment is deliberately informal/first-person — Product
  Hunt research is consistent that the origin story matters more there
  than polished marketing copy.
- Update the privacy policy URL here (and everywhere else) if GitHub
  Pages ever gets set up as a cleaner alternative to the raw GitHub blob
  URL.
