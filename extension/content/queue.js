/* =============================================================================
 * Threadline — content/queue.js
 * Local reading queue (spec §27.5). `q` toggles the selected post; the list
 * lives in chrome.storage.local so it survives restarts, syncs across open
 * reddit tabs via storage.onChanged, and never touches the Reddit API.
 * The in-page panel renders inside the overlay's shadow root; the options
 * page / side panel render the same stored list.
 * =========================================================================== */
"use strict";

TL.queue = (() => {
  const KEY = "tl_queue_v1";
  const CAP = 200;

  let items = [];       // [{ id, title, permalink, subreddit, addedAt }]
  let panelOpen = false;

  /* ---- Pure list operations (unit-tested in test/run.mjs) ---------------- */
  function normalize(model) {
    if (!model?.id || !model?.permalink) return null;
    return {
      id: model.id,
      title: model.title || model.permalink,
      permalink: model.permalink,
      subreddit: model.subreddit || null,
      addedAt: Date.now()
    };
  }

  /** Append unless already queued; newest last; enforce cap by dropping the
   *  oldest. Returns a NEW array (never mutates). */
  function addItem(list, item, cap = CAP) {
    if (!item || list.some((x) => x.id === item.id)) return list;
    const out = [...list, item];
    return out.length > cap ? out.slice(out.length - cap) : out;
  }

  function removeItem(list, id) {
    return list.filter((x) => x.id !== id);
  }

  /* ---- Storage ------------------------------------------------------------ */
  async function load() {
    if (!globalThis.chrome?.storage?.local) return;
    try {
      const got = await chrome.storage.local.get(KEY);
      items = got[KEY]?.items || [];
    } catch (e) {
      console.warn("[Threadline] queue load failed:", e);
      items = [];
    }
  }

  function persist() {
    if (!globalThis.chrome?.storage?.local) return;
    chrome.storage.local.set({ [KEY]: { v: 1, items } }).catch(() => {});
  }

  function changed() {
    TL.bus.dispatchEvent(new CustomEvent("tl:queue"));
    TL.dom.schedulePass("queue");        // restamp data-tl-queued markers
    if (panelOpen) renderPanel();
  }

  /* ---- Public API ---------------------------------------------------------- */
  function has(id) {
    return items.some((x) => x.id === id);
  }

  function list() {
    return items.slice();
  }

  /** Add/remove a post model. Returns "added" | "removed" | null (no id). */
  function toggle(model) {
    if (model?.id && has(model.id)) {
      items = removeItem(items, model.id);
      persist();
      changed();
      return "removed";
    }
    const item = normalize(model);
    if (!item) return null;
    items = addItem(items, item);
    persist();
    changed();
    return "added";
  }

  function remove(id) {
    items = removeItem(items, id);
    persist();
    changed();
  }

  async function clear() {
    items = [];
    if (globalThis.chrome?.storage?.local) {
      await chrome.storage.local.remove(KEY).catch(() => {});
    }
    changed();
  }

  /* ---- In-page panel (inside the overlay shadow root) ---------------------- */
  function renderPanel() {
    const el = TL.overlay.queueEl();
    el.textContent = "";

    const header = document.createElement("header");
    const title = document.createElement("span");
    title.textContent = `Reading queue — ${items.length}`;
    const close = document.createElement("button");
    close.textContent = "✕";
    close.title = "Close";
    close.addEventListener("click", () => openPanel(false));
    header.append(title, close);
    el.appendChild(header);

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Empty. Press q on a selected post to queue it.";
      el.appendChild(empty);
      return;
    }

    const ul = document.createElement("ul");
    ul.setAttribute("role", "list");
    for (const item of items) {
      const li = document.createElement("li");
      const t = document.createElement("div");
      t.className = "t";
      const line = document.createElement("div");
      line.textContent = item.title;
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = item.subreddit ? `r/${item.subreddit}` : "";
      t.append(line, meta);
      t.addEventListener("click", () => {
        openPanel(false);
        location.assign(item.permalink);
      });
      const rm = document.createElement("button");
      rm.textContent = "✕";
      rm.title = "Remove from queue";
      rm.addEventListener("click", () => remove(item.id));
      li.append(t, rm);
      ul.appendChild(li);
    }
    el.appendChild(ul);

    const footer = document.createElement("footer");
    const hint = document.createElement("span");
    hint.className = "meta";
    hint.textContent = "Click a row to open";
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear all";
    clearBtn.addEventListener("click", () => clear());
    footer.append(hint, clearBtn);
    el.appendChild(footer);
  }

  function openPanel(show = true) {
    const el = TL.overlay.queueEl();
    panelOpen = !!show;
    el.hidden = !show;
    if (show) renderPanel();
  }

  /* Cross-tab sync: another tab (or the options page) edited the queue. */
  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[KEY]) return;
      items = changes[KEY].newValue?.items || [];
      changed();
    });
  }

  return {
    KEY, load, has, list, toggle, remove, clear,
    openPanel, isPanelOpen: () => panelOpen,
    _pure: { addItem, removeItem }
  };
})();
