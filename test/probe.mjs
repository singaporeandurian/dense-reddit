/* Threadline — test/probe.mjs
 * One-off DOM inspector for selector tuning. Edit the evaluate() block for
 * whatever question you have, then: node probe.mjs [url] */
import puppeteer from "puppeteer-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.argv[2] || "https://www.reddit.com/r/programming/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  pipe: true,
  userDataDir: mkdtempSync(join(tmpdir(), "tl-probe-")),
  defaultViewport: null,
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--window-size=1440,900", "--no-first-run", "--no-default-browser-check",
    "--disable-blink-features=AutomationControlled"]
});

try {
  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  for (let i = 0; i < 15; i++) {
    const ok = await page.evaluate(() =>
      document.querySelectorAll("shreddit-post").length > 0).catch(() => false);
    if (ok) break;
    await sleep(2000);
  }
  await sleep(2000);

  const info = await page.evaluate(() => {
    const trim = (s, n) => (s || "").replace(/\s+/g, " ").slice(0, n);
    const rectH = (el) => el ? Math.round(el.getBoundingClientRect().height) : null;
    const post = document.querySelectorAll("shreddit-post")[1] || document.querySelector("shreddit-post");

    // 1. All attributes on a post — looking for view/layout hooks.
    const postAttrs = post ? post.getAttributeNames()
      .map((n) => `${n}=${trim(post.getAttribute(n), 60)}`) : [];

    // 2. Shadow root structure + any exposed ::part hooks.
    const shadowHTML = post?.shadowRoot ? trim(post.shadowRoot.innerHTML, 2500) : "closed/none";
    const parts = post?.shadowRoot
      ? [...post.shadowRoot.querySelectorAll("[part]")].map((e) => e.getAttribute("part"))
      : [];

    // 3. Does Reddit's native compact view flip via attribute? Try it live.
    const before = rectH(post);
    let after = null, attrTried = null;
    if (post?.getAttribute("view-context") || post?.hasAttribute("view-type")) {
      attrTried = post.getAttribute("view-type") || post.getAttribute("view-context");
    }
    try {
      post.setAttribute("view-type", "compactView");
      after = rectH(post);
      post.removeAttribute("view-type");
    } catch {}

    // 4. Which --rem custom properties exist (shadow styles consume them)?
    const rootStyle = getComputedStyle(document.documentElement);
    const rems = {};
    for (const name of ["--rem6", "--rem8", "--rem10", "--rem12", "--rem14",
      "--rem16", "--rem18", "--rem20", "--rem24", "--button-height",
      "--spacer-2xs", "--spacer-xs", "--spacer-sm", "--spacer-md", "--spacer-lg"]) {
      const v = rootStyle.getPropertyValue(name);
      if (v) rems[name] = v.trim();
    }

    // 5. The feed layout switcher (Card/Compact dropdown) near the sort menu.
    const switcher = ["shreddit-layout-select", "shreddit-sort-dropdown",
      "#layout-switch-button", "[aria-label*='layout' i]", "[icon-name*='view' i]"]
      .map((sel) => {
        try {
          const el = document.querySelector(sel);
          return el ? `${sel} -> ${el.tagName.toLowerCase()} ${trim(el.outerHTML, 160)}` : null;
        } catch { return null; }
      }).filter(Boolean);

    // 6. Thumbnail slot sizing
    const thumb = document.querySelector("shreddit-post [slot='thumbnail']");

    return {
      postAttrs, parts,
      viewTypeExperiment: { attrTried, before, after },
      rems, switcher,
      thumb: thumb ? { tag: thumb.tagName.toLowerCase(),
        cls: trim(thumb.className?.toString?.(), 100), h: rectH(thumb) } : null,
      shadowHTML
    };
  });
  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}
