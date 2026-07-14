# Privacy Policy — Dense

**Last updated: July 2026**

Dense is a Chrome extension that changes how reddit.com looks and behaves
in your own browser. This policy explains, plainly, what data it touches
and where that data goes.

## The short version

Dense doesn't have a server. It has never sent a network request of its
own, anywhere, for any reason — you can verify this yourself; the source
is public at [github.com/singaporeandurian/dense-reddit](https://github.com/singaporeandurian/dense-reddit).
Everything it stores lives in your own browser. Nothing is sold, shared,
or transmitted to the developer or to any third party.

## What Dense stores, and where

All of it lives in Chrome's built-in `chrome.storage` API, scoped to the
extension, on your device:

| Data | Storage | What's in it |
| --- | --- | --- |
| Settings | `chrome.storage.sync` | Display mode, density, theme, layout options, your filter rules, per-subreddit overrides, keyboard preferences |
| Seen/hidden post history | `chrome.storage.local` | Reddit post IDs and timestamps only — not post content |
| Reading queue | `chrome.storage.local` | Titles and links of posts you explicitly queued with the `q` key |
| A one-time density measurement | `chrome.storage.local` | Two numbers (posts visible before/after compaction), shown once in the toolbar popup |

None of this is Reddit account data, browsing history outside reddit.com,
or anything Dense reads without you having explicitly interacted with it
through its own features (filters you wrote, posts you queued, settings
you changed).

## The one nuance worth being explicit about: Chrome Sync

Settings are stored in `chrome.storage.sync` rather than
`chrome.storage.local` so they follow you across your own devices if you
use Chrome's built-in sync. If you have Chrome Sync turned on, that data
syncs through **Google's** infrastructure, tied to your own Google
account — the same mechanism used for your bookmarks or other extensions'
synced settings. Dense doesn't operate that infrastructure and never sees
that data; it's exactly as private (or not) as anything else you already
sync through your Google account. If you'd rather your Dense settings
never leave this device, turn off Chrome Sync for this browser profile, or
just don't enable sync in the first place — Dense works identically either
way.

## What Dense does NOT do

- No analytics, telemetry, or crash reporting of any kind.
- No cookies, fingerprinting, or tracking pixels.
- No ads, no affiliate links, no link rewriting.
- No remote code execution — every line of code that runs is in the
  extension package you installed; nothing is fetched or `eval`'d at
  runtime.
- No access to your Reddit account, password, or session — Dense reads
  only what's already visible on the page and forwards clicks to Reddit's
  own vote/save buttons; it never authenticates as you or acts on your
  behalf anywhere Reddit itself doesn't already show a click happened.
- No access to any site other than reddit.com and new.reddit.com — that's
  the entirety of the extension's host permissions.

## Permissions, and why

Chrome extensions have to declare what they can access. Here's what Dense
declares and why:

- **`storage`** — to save your settings, filters, reading queue, and local
  seen-post history, all on-device as described above.
- **`sidePanel`** — to show the settings UI in Chrome's side panel as an
  alternative to the full options page.
- **Host access to `reddit.com` and `new.reddit.com` only** — Dense is a
  content script that runs on Reddit's own pages to restyle and compact
  them. It has no access to any other website.

## Data deletion

Everything is stored locally. Uninstalling the extension removes all of
it. You can also clear seen/hidden history and the reading queue directly
from Dense's own Settings page at any time, without uninstalling.

## Changes to this policy

If this policy changes, the "Last updated" date above will change with
it, and the current version will always be visible at this same URL and
in the extension's GitHub repository's commit history.

## Contact

Questions about this policy or how Dense handles data: open an issue at
[github.com/singaporeandurian/dense-reddit/issues](https://github.com/singaporeandurian/dense-reddit/issues).

---

*Dense is not affiliated with, endorsed by, or sponsored by Reddit, Inc.*
