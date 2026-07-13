/* =============================================================================
 * Threadline — content/overlay.js
 * Shadow-DOM host for all in-page extension UI (toast, keyboard help,
 * command palette container). Shadow DOM keeps our styles and Reddit's fully
 * isolated in both directions. All text is set via textContent — never
 * innerHTML with page-derived strings.
 * =========================================================================== */
"use strict";

TL.overlay = (() => {
  let host = null;
  let root = null;

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    ${TL.themeTokensCSS}
    .tl-ui {
      font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
        "Segoe UI", sans-serif;
      color: var(--tl-ui-fg);
    }
    #toast {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;
      background: var(--tl-ui-bg); border: 1px solid var(--tl-ui-border);
      border-radius: 8px; padding: 9px 13px; max-width: 380px;
      box-shadow: 0 6px 24px var(--tl-ui-shadow);
    }
    #help {
      position: fixed; inset: 0; z-index: 2147483646;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,.45);
    }
    #help .card {
      background: var(--tl-ui-bg); border: 1px solid var(--tl-ui-border);
      border-radius: 10px; padding: 18px 22px; max-height: 80vh; overflow: auto;
      min-width: 460px; box-shadow: 0 12px 40px var(--tl-ui-shadow);
    }
    #help h1 { font-size: 14px; margin: 0 0 10px; color: var(--tl-ui-fg); }
    #help h2 { font-size: 11px; margin: 12px 0 4px; color: var(--tl-ui-muted);
      text-transform: uppercase; letter-spacing: .06em; }
    #help table { border-collapse: collapse; width: 100%; }
    #help td { padding: 2px 8px 2px 0; font-size: 12.5px; }
    #help td.k { width: 90px; }
    #help kbd {
      background: color-mix(in srgb, var(--tl-ui-fg) 12%, var(--tl-ui-bg));
      border: 1px solid var(--tl-ui-border);
      border-bottom-width: 2px; border-radius: 4px; padding: 1px 6px;
      font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    #palette {
      position: fixed; left: 50%; top: 18vh; transform: translateX(-50%);
      z-index: 2147483647; width: 520px; max-width: 92vw;
      background: var(--tl-ui-bg); border: 1px solid var(--tl-ui-border);
      border-radius: 10px; overflow: hidden;
      box-shadow: 0 12px 40px var(--tl-ui-shadow);
    }
    #palette input {
      width: 100%; border: 0; outline: 0; background: transparent;
      color: var(--tl-ui-fg); font: 14px ui-sans-serif, system-ui, sans-serif;
      padding: 12px 14px; border-bottom: 1px solid var(--tl-ui-border);
    }
    #palette ul { list-style: none; margin: 0; padding: 4px; max-height: 46vh; overflow: auto; }
    #palette li {
      padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 13px;
    }
    #palette li.active { background: var(--tl-ui-accent); color: #fff; }
    /* high-contrast's accent is bright yellow — dark text stays readable
       there, unlike every other theme's darker accent color. */
    :host-context(html[data-tl-theme="high-contrast"]) #palette li.active { color: #000; }
    #queue {
      position: fixed; right: 16px; top: 64px; z-index: 2147483646;
      width: 380px; max-width: 92vw; max-height: 70vh;
      display: flex; flex-direction: column;
      background: var(--tl-ui-bg); border: 1px solid var(--tl-ui-border);
      border-radius: 10px; box-shadow: 0 12px 40px var(--tl-ui-shadow);
    }
    #queue header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; font-weight: 600; color: var(--tl-ui-fg);
      border-bottom: 1px solid var(--tl-ui-border);
    }
    #queue ul { list-style: none; margin: 0; padding: 4px; overflow: auto; }
    #queue li {
      display: flex; gap: 8px; align-items: flex-start;
      padding: 6px 8px; border-radius: 6px;
    }
    #queue li:hover { background: color-mix(in srgb, var(--tl-ui-fg) 8%, transparent); }
    #queue .t { flex: 1; cursor: pointer; min-width: 0; }
    #queue .meta { color: var(--tl-ui-muted); font-size: 11px; margin-top: 2px; }
    #queue .empty { padding: 14px; color: var(--tl-ui-muted); }
    #queue button {
      background: transparent; border: 0; color: var(--tl-ui-muted);
      cursor: pointer; font: inherit; padding: 0 2px;
    }
    #queue button:hover { color: var(--tl-ui-fg); }
    #queue footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-top: 1px solid var(--tl-ui-border);
    }
    [hidden] { display: none !important; }
  `;

  const HELP = {
    "Global": [
      ["Alt+R", "Toggle Dense on/off"],
      ["Alt (hold)", "Peek at native Reddit"],
      ["? ", "This help"],
      [". or Cmd/Ctrl+Shift+K", "Command palette"],
      ["Esc", "Close overlays"]
    ],
    "Feed": [
      ["j / k", "Next / previous post"],
      ["Enter or c", "Open comments"],
      ["o", "Open outbound link"],
      ["h", "Hide post locally (z = undo)"],
      ["q", "Queue / unqueue post (Q = open queue)"],
      ["a / d", "Upvote / downvote (native)"],
      ["s", "Save post (native)"],
      ["m", "Cycle thumbnails off/small/large"],
      ["/", "Focus search"],
      ["g h", "Go home"],
      ["g n / g s", "Subreddit: new / top this week"]
    ],
    "Comments": [
      ["j / k", "Next / previous comment"],
      ["J / K", "Next / previous top-level comment"],
      ["h / l", "Collapse / expand comment"],
      ["a / d", "Upvote / downvote comment (native)"],
      ["p", "Jump to parent"],
      ["Enter", "Open comment permalink"],
      ["[ / ]", "Previous / next post from feed list (split-pane)"],
      ["u", "Back to subreddit"]
    ]
  };

  function ensure() {
    if (root && host?.isConnected) return root;
    host = document.createElement("tl-overlay");
    root = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);

    const toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "tl-ui";
    toast.hidden = true;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    root.appendChild(toast);

    const help = document.createElement("div");
    help.id = "help";
    help.className = "tl-ui";
    help.hidden = true;
    help.setAttribute("role", "dialog");
    help.setAttribute("aria-label", "Keyboard shortcuts");
    const card = document.createElement("div");
    card.className = "card";
    const h1 = document.createElement("h1");
    h1.textContent = "Dense — keyboard shortcuts";
    card.appendChild(h1);
    for (const [section, rows] of Object.entries(HELP)) {
      const h2 = document.createElement("h2");
      h2.textContent = section;
      card.appendChild(h2);
      const table = document.createElement("table");
      for (const [key, desc] of rows) {
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        td1.className = "k";
        const kbd = document.createElement("kbd");
        kbd.textContent = key;
        td1.appendChild(kbd);
        const td2 = document.createElement("td");
        td2.textContent = desc;
        tr.append(td1, td2);
        table.appendChild(tr);
      }
      card.appendChild(table);
    }
    help.appendChild(card);
    help.addEventListener("click", (e) => { if (e.target === help) helpVisible(false); });
    root.appendChild(help);

    const palette = document.createElement("div");
    palette.id = "palette";
    palette.className = "tl-ui";
    palette.hidden = true;
    palette.setAttribute("role", "dialog");
    palette.setAttribute("aria-modal", "true");
    palette.setAttribute("aria-label", "Command palette");
    root.appendChild(palette);

    const queue = document.createElement("div");
    queue.id = "queue";
    queue.className = "tl-ui";
    queue.hidden = true;
    queue.setAttribute("role", "dialog");
    queue.setAttribute("aria-label", "Reading queue");
    root.appendChild(queue);

    (document.body || document.documentElement).appendChild(host);
    return root;
  }

  let toastTimer = null;
  function toast(message, ms = 3500) {
    const r = ensure();
    const el = r.getElementById("toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  function helpVisible(show) {
    const r = ensure();
    r.getElementById("help").hidden = !show;
  }

  function isHelpOpen() {
    return !!root && !root.getElementById("help").hidden;
  }

  function hideAll() {
    if (!root) return;
    root.getElementById("help").hidden = true;
    root.getElementById("toast").hidden = true;
    TL.palette?.close();
    TL.queue?.openPanel(false);
  }

  function paletteEl() {
    return ensure().getElementById("palette");
  }

  function queueEl() {
    return ensure().getElementById("queue");
  }

  return { ensure, toast, helpVisible, isHelpOpen, hideAll, paletteEl, queueEl };
})();
