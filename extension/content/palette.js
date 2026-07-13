/* =============================================================================
 * Threadline — content/palette.js
 * Command palette (spec §25). Context-aware command list rebuilt on open;
 * substring + subsequence fuzzy matching, boosted by recency (spec §25.3).
 * Lives inside the overlay's shadow root. All rows rendered with textContent.
 * =========================================================================== */
"use strict";

TL.palette = (() => {
  const RECENT_KEY = "tl_recent_cmds_v1";
  const RECENT_CAP = 20;

  let open_ = false;
  let commands = [];
  let filtered = [];
  let active = 0;
  let input = null;
  let list = null;
  let recentIds = [];

  function buildCommands() {
    const s = TL.settings.get();
    const route = TL.router.route;
    const sel = TL.keyboard.selectedModel();
    const cmds = [];

    cmds.push({
      id: "toggle-enabled",
      name: s.enabled ? "Disable Dense (restore native Reddit)" : "Enable Dense",
      run: () => TL.settings.update({ enabled: !s.enabled })
    });
    cmds.push({ id: "mode-compact-reader", name: "Mode: Compact Reader", run: () => TL.settings.update({ mode: "compact-reader" }) });
    cmds.push({ id: "mode-split-pane", name: "Mode: Split Pane (feed rail on comments pages)", run: () => TL.settings.update({ mode: "split-pane" }) });
    cmds.push({ id: "mode-native-clean", name: "Mode: Native Clean (hide clutter only)", run: () => TL.settings.update({ mode: "native-clean" }) });

    for (const preset of ["comfortable", "balanced", "dense", "ultra"]) {
      cmds.push({
        id: `density-${preset}`,
        name: `Density: ${preset[0].toUpperCase()}${preset.slice(1)}`,
        run: () => TL.settings.update({
          density: { preset },
          feed: { thumbnails: TLSchema.PRESET_THUMBS[preset] }
        })
      });
    }
    for (const t of ["off", "small", "large"]) {
      cmds.push({ id: `thumbs-${t}`, name: `Thumbnails: ${t}`, run: () => TL.settings.update({ feed: { thumbnails: t } }) });
    }
    cmds.push({
      id: "toggle-dim-seen",
      name: `${s.feed.dimSeenPosts ? "Disable" : "Enable"} seen-post dimming`,
      run: () => TL.settings.update({ feed: { dimSeenPosts: !s.feed.dimSeenPosts } })
    });
    cmds.push({
      id: "toggle-hide-promoted",
      name: `${s.feed.hidePromoted ? "Show" : "Hide"} promoted posts`,
      run: () => TL.settings.update({ feed: { hidePromoted: !s.feed.hidePromoted } })
    });

    if (route.subreddit) {
      cmds.push({
        id: "go-new",
        name: `Go: r/${route.subreddit} — New`,
        run: () => location.assign(`/r/${route.subreddit}/new/`)
      });
      cmds.push({
        id: "go-top-week",
        name: `Go: r/${route.subreddit} — Top this week`,
        run: () => location.assign(`/r/${route.subreddit}/top/?t=week`)
      });
      cmds.push({
        id: "save-override",
        name: `Save current density/thumbnails as r/${route.subreddit} override`,
        run: () => TL.settings.setSubredditOverride(route.subreddit, {
          density: { preset: s.density.preset },
          feed: { thumbnails: s.feed.thumbnails }
        }).then(() => TL.overlay.toast(`Saved override for r/${route.subreddit}`))
      });
      if (s.subredditOverrides?.[route.subreddit.toLowerCase()]) {
        cmds.push({
          id: "clear-override",
          name: `Clear r/${route.subreddit} override`,
          run: () => TL.settings.clearSubredditOverride(route.subreddit)
        });
      }
    }

    if (sel?.domain) {
      cmds.push({
        id: "filter-domain",
        name: `Filter out domain: ${sel.domain}`,
        run: () => addFilterRule({ type: "domain", operator: "equals", value: sel.domain })
      });
    }
    if (sel?.author) {
      cmds.push({
        id: "mute-user",
        name: `Mute posts by u/${sel.author}`,
        run: () => addFilterRule({ type: "user", operator: "equals", value: sel.author })
      });
    }

    cmds.push({
      id: "open-queue",
      name: `Open reading queue (${TL.queue.list().length})`,
      run: () => TL.queue.openPanel(true)
    });
    if (route.type !== "comments" && sel?.permalink) {
      cmds.push({
        id: "toggle-queue-item",
        name: TL.queue.has(sel.id)
          ? "Remove selected post from reading queue"
          : "Add selected post to reading queue",
        run: () => TL.queue.toggle(sel)
      });
    }
    cmds.push({
      id: "toggle-minimap",
      name: `${s.comments.minimap ? "Disable" : "Enable"} comment mini-map`,
      run: () => TL.settings.update({ comments: { minimap: !s.comments.minimap } })
    });
    cmds.push({
      id: "copy-preset",
      name: "Copy current look as shareable preset",
      run: () => {
        const blob = JSON.stringify(TLSchema.makePreset(TL.settings.get()));
        navigator.clipboard.writeText(blob)
          .then(() => TL.overlay.toast("Preset copied — import it via Dense settings on any machine"))
          .catch(() => TL.overlay.toast("Clipboard unavailable — use Settings → Copy preset"));
      }
    });

    cmds.push({ id: "show-help", name: "Show keyboard help", run: () => TL.overlay.helpVisible(true) });
    cmds.push({
      id: "open-settings",
      name: "Open Dense settings",
      run: () => chrome.runtime.sendMessage({ type: "TL_OPEN_OPTIONS" }).catch(() => {})
    });
    cmds.push({
      id: "clear-history",
      name: "Clear read/seen history",
      run: () => TL.readstate.clearAll().then(() => TL.overlay.toast("Read history cleared"))
    });

    return cmds;
  }

  /** Palette-driven quick filters add a global "hide" rule via the same
   *  engine the Filters settings page manages (spec §26) — kept out of
   *  buildCommands() above just to keep that function's job to one thing. */
  function addFilterRule(patch) {
    const s = TL.settings.get();
    const rules = s.filters?.rules || [];
    TL.settings.update({
      filters: { rules: [...rules, TLSchema.makeRule(patch)] }
    });
  }

  async function loadRecent() {
    if (!globalThis.chrome?.storage?.local) return;
    try {
      const got = await chrome.storage.local.get(RECENT_KEY);
      recentIds = Array.isArray(got[RECENT_KEY]) ? got[RECENT_KEY] : [];
    } catch { recentIds = []; }
  }

  function markRecent(id) {
    if (!id) return;
    recentIds = [id, ...recentIds.filter((x) => x !== id)].slice(0, RECENT_CAP);
    if (globalThis.chrome?.storage?.local) {
      chrome.storage.local.set({ [RECENT_KEY]: recentIds }).catch(() => {});
    }
  }

  /** Recency contributes a small, decaying boost — enough to order an
   *  otherwise-tied list (most valuable: an empty query, where every command
   *  ties on the base score) without letting a stale recent command outrank
   *  a strong live text match. */
  function recencyBoost(id) {
    const i = recentIds.indexOf(id);
    return i === -1 ? 0 : (RECENT_CAP - i) * 2;
  }

  function score(cmd, query) {
    const n = cmd.name.toLowerCase();
    const q = query.toLowerCase().trim();
    let base;
    if (!q) {
      base = 1;
    } else {
      const idx = n.indexOf(q);
      if (idx !== -1) {
        base = 1000 - idx;
      } else {
        let qi = 0;
        for (let i = 0; i < n.length && qi < q.length; i++) {
          if (n[i] === q[qi]) qi++;
        }
        base = qi === q.length ? 100 : -1;
      }
    }
    return base < 0 ? base : base + recencyBoost(cmd.id);
  }

  function render() {
    list.textContent = "";
    filtered.forEach((cmd, i) => {
      const li = document.createElement("li");
      li.id = `tl-cmd-${i}`;
      li.setAttribute("role", "option");
      li.textContent = cmd.name;
      const isActive = i === active;
      li.classList.toggle("active", isActive);
      li.setAttribute("aria-selected", isActive ? "true" : "false");
      li.addEventListener("mousedown", (e) => { e.preventDefault(); execute(i); });
      list.appendChild(li);
    });
    input.setAttribute("aria-activedescendant", filtered.length ? `tl-cmd-${active}` : "");
  }

  function refilter() {
    const q = input.value;
    filtered = commands
      .map((c) => ({ c, s: score(c, q) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.c);
    active = 0;
    render();
  }

  function execute(i) {
    const cmd = filtered[i];
    close();
    if (cmd) {
      markRecent(cmd.id);
      try { cmd.run(); } catch (e) { console.warn("[Threadline] command failed:", e); }
    }
  }

  function onKey(ev) {
    if (ev.key === "ArrowDown") { active = Math.min(filtered.length - 1, active + 1); render(); }
    else if (ev.key === "ArrowUp") { active = Math.max(0, active - 1); render(); }
    else if (ev.key === "Enter") execute(active);
    else if (ev.key === "Escape") close();
    // spec §23: the palette is the one place focus SHOULD be trapped — Tab
    // has nowhere else useful to go here (arrow keys already move through
    // the list), so just keep focus on the input rather than letting it
    // escape to the underlying Reddit page.
    else if (ev.key === "Tab") { /* fall through to preventDefault below */ }
    else return;
    ev.preventDefault();
    ev.stopPropagation();
  }

  function open() {
    const el = TL.overlay.paletteEl();
    if (!input) {
      input = document.createElement("input");
      input.placeholder = "Type a command…";
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-expanded", "true");
      input.setAttribute("aria-controls", "tl-cmd-list");
      input.setAttribute("aria-autocomplete", "list");
      input.addEventListener("input", refilter);
      input.addEventListener("keydown", onKey);
      input.addEventListener("blur", () => setTimeout(close, 120));
      list = document.createElement("ul");
      list.id = "tl-cmd-list";
      list.setAttribute("role", "listbox");
      el.append(input, list);
    }
    commands = buildCommands();
    input.value = "";
    el.hidden = false;
    open_ = true;
    loadRecent().then(refilter); // refilter again once recency data lands
    refilter();
    input.focus();
  }

  function close() {
    if (!open_) return;
    open_ = false;
    const el = TL.overlay.paletteEl();
    el.hidden = true;
    input?.blur();
  }

  return { open, close, isOpen: () => open_ };
})();
