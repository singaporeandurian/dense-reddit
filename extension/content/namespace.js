/* =============================================================================
 * Threadline — content/namespace.js
 * Shared namespace for all content-script modules (loaded first).
 * Content scripts run in Chrome's isolated world, so `TL` never collides
 * with Reddit's own JavaScript.
 * =========================================================================== */
"use strict";

var TL = globalThis.TL || (globalThis.TL = {
  version: "0.3.0",
  /** Internal event bus. Events: tl:settings, tl:route, tl:pass */
  bus: new EventTarget()
});

/* Theme tokens (spec §24.3) shared by every shadow-DOM UI host (overlay.js,
 * splitpane.js, minimap.js). Each host is a direct light-DOM child of
 * <body>, so :host-context() can read html[data-tl-theme] — the attribute
 * compactor.js's applyRootState() mirrors from settings.theme — to pick an
 * explicit palette regardless of OS preference. "auto" sets no attribute
 * value these selectors match, so it falls through to the prefers-color-
 * scheme media query instead. Scope is deliberately Threadline's OWN UI
 * chrome only — overriding Reddit's own page colors to match would mean
 * fighting a whole separate theme system this project doesn't control. */
TL.themeTokensCSS = `
  :host {
    --tl-ui-bg: #ffffff; --tl-ui-fg: #1a1a1b; --tl-ui-border: rgba(0,0,0,.12);
    --tl-ui-muted: #6b7280; --tl-ui-accent: #d93a00; --tl-ui-shadow: rgba(0,0,0,.18);
  }
  @media (prefers-color-scheme: dark) {
    :host {
      --tl-ui-bg: #1c1e24; --tl-ui-fg: #e8e8ea; --tl-ui-border: rgba(255,255,255,.14);
      --tl-ui-muted: #9aa0ae; --tl-ui-shadow: rgba(0,0,0,.4);
    }
  }
  :host-context(html[data-tl-theme="light"]) {
    --tl-ui-bg: #ffffff; --tl-ui-fg: #1a1a1b; --tl-ui-border: rgba(0,0,0,.12);
    --tl-ui-muted: #6b7280; --tl-ui-accent: #d93a00; --tl-ui-shadow: rgba(0,0,0,.18);
  }
  :host-context(html[data-tl-theme="dark"]) {
    --tl-ui-bg: #1c1e24; --tl-ui-fg: #e8e8ea; --tl-ui-border: rgba(255,255,255,.14);
    --tl-ui-muted: #9aa0ae; --tl-ui-accent: #d93a00; --tl-ui-shadow: rgba(0,0,0,.4);
  }
  :host-context(html[data-tl-theme="oled"]) {
    --tl-ui-bg: #000000; --tl-ui-fg: #f2f2f2; --tl-ui-border: rgba(255,255,255,.16);
    --tl-ui-muted: #9aa0ae; --tl-ui-accent: #d93a00; --tl-ui-shadow: rgba(0,0,0,.6);
  }
  :host-context(html[data-tl-theme="high-contrast"]) {
    --tl-ui-bg: #000000; --tl-ui-fg: #ffffff; --tl-ui-border: #ffffff;
    --tl-ui-muted: #ffffff; --tl-ui-accent: #ffcc00; --tl-ui-shadow: rgba(0,0,0,.7);
  }
  :host-context(html[data-tl-theme="sepia"]) {
    --tl-ui-bg: #f4ecd8; --tl-ui-fg: #3b2f1e; --tl-ui-border: rgba(59,47,30,.25);
    --tl-ui-muted: #7a6a52; --tl-ui-accent: #a85d2b; --tl-ui-shadow: rgba(59,47,30,.25);
  }
`;
