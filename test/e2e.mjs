/* =============================================================================
 * Threadline — test/e2e.mjs
 * Drives real Chrome against live reddit.com with the extension installed.
 * Chrome ≥137 ignores --load-extension, so this uses Puppeteer's
 * installExtension() (CDP) which works on stable Chrome.
 *
 *   node e2e.mjs [--keep] [--shots <dir>]
 *
 * Verifies: activation, sidebar hiding, post stamping, selector health,
 * compact-vs-native density, j/k keyboard selection, comments compaction.
 * Writes screenshots + a JSON report to the shots dir.
 * =========================================================================== */
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(HERE, "..", "extension");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const KEEP = process.argv.includes("--keep");
const shotsIdx = process.argv.indexOf("--shots");
const SHOTS = shotsIdx !== -1 ? process.argv[shotsIdx + 1] : join(HERE, "shots");
mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { steps: [], problems: [] };
const log = (msg) => { console.log(msg); report.steps.push(msg); };
const problem = (msg) => { console.log("PROBLEM: " + msg); report.problems.push(msg); };

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  pipe: true,
  enableExtensions: true,
  userDataDir: mkdtempSync(join(tmpdir(), "tl-e2e-")),
  defaultViewport: null,
  ignoreDefaultArgs: ["--enable-automation"],
  args: [
    "--window-size=1440,900",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-blink-features=AutomationControlled"
  ]
});

try {
  const extId = await browser.installExtension(EXT);
  log(`extension installed: ${extId}`);

  const page = (await browser.pages())[0] || (await browser.newPage());
  const consoleErrors = [];
  page.on("console", (m) => {
    const text = m.text();
    if (m.type() === "error" || /Threadline/i.test(text)) {
      consoleErrors.push(`[${m.type()}] ${text}`);
    }
  });
  page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

  log("navigating to r/programming …");
  await page.goto("https://www.reddit.com/r/programming/", {
    waitUntil: "domcontentloaded", timeout: 60000
  }).catch((e) => problem("goto: " + e.message));

  // Reddit may interpose a JS verification page that auto-submits — wait it
  // out. Evaluations can die mid-navigation, so tolerate context destruction.
  let havePosts = false;
  for (let i = 0; i < 15; i++) {
    havePosts = await page.evaluate(() =>
      document.querySelectorAll("shreddit-post").length > 0).catch(() => false);
    if (havePosts) break;
    await sleep(2000);
  }
  if (!havePosts) {
    problem("no shreddit-post appeared after 30s — title: " + (await page.title()));
  }
  await sleep(2500); // let the first compaction pass + toast settle

  // ---- Feed probe -----------------------------------------------------------
  const feed = await page.evaluate(() => {
    const html = document.documentElement;
    const posts = [...document.querySelectorAll("shreddit-post, shreddit-ad-post")];
    const inView = (els) => els.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.height > 0;
    }).length;
    const disp = (sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).display : "absent";
    };

    const compact = inView(posts);
    html.classList.remove("tl-on");           // peek native (forces reflow)
    const native = inView(posts);
    html.classList.add("tl-on");

    return {
      tlOn: html.classList.contains("tl-on"),
      tlAttrs: html.getAttributeNames().filter((n) => n.startsWith("data-tl")),
      totalPosts: posts.length,
      stampedPosts: document.querySelectorAll("[data-tl='post']").length,
      postsInViewCompact: compact,
      postsInViewNative: native,
      leftSidebar: disp("#left-sidebar-container"),
      rightSidebar: disp("#right-sidebar-container"),
      probe: Object.fromEntries([
        "shreddit-app", "shreddit-feed", "shreddit-post", "shreddit-ad-post",
        "#left-sidebar-container", "#right-sidebar-container",
        "shreddit-subreddit-header", "reddit-header-large",
        "shreddit-post [slot='title']", "shreddit-post [slot='thumbnail']",
        "shreddit-post [slot='post-media-container']", "shreddit-post [slot='text-body']",
        "community-highlight-carousel", "shreddit-gallery-carousel"
      ].map((sel) => {
        let n = 0;
        try { n = document.querySelectorAll(sel).length; } catch {}
        return [sel, n];
      })),
      overlayHost: !!document.querySelector("tl-overlay"),
      firstPermalink: posts.find((p) => p.getAttribute("permalink"))
        ?.getAttribute("permalink") || null
    };
  });
  report.feed = feed;
  log(`tl-on=${feed.tlOn} posts=${feed.totalPosts} stamped=${feed.stampedPosts} ` +
      `inView compact=${feed.postsInViewCompact} native=${feed.postsInViewNative} ` +
      `leftSidebar=${feed.leftSidebar} rightSidebar=${feed.rightSidebar}`);
  if (!feed.tlOn) problem("html.tl-on missing");
  if (feed.totalPosts && !feed.stampedPosts) problem("posts not stamped — JS pass failing");
  if (feed.leftSidebar !== "none" && feed.leftSidebar !== "absent") {
    problem("left sidebar still visible: " + feed.leftSidebar);
  }
  if (feed.rightSidebar !== "none" && feed.rightSidebar !== "absent") {
    problem("right sidebar still visible: " + feed.rightSidebar);
  }
  await page.screenshot({ path: join(SHOTS, "feed-compact.png") });

  // Native comparison screenshot (peek)
  await page.evaluate(() => document.documentElement.classList.remove("tl-on"));
  await sleep(400);
  await page.screenshot({ path: join(SHOTS, "feed-native.png") });
  await page.evaluate(() => document.documentElement.classList.add("tl-on"));

  // ---- Self-heal: no compactView post may be left without a visible title --
  await sleep(2500); // let the verify-and-revert cycle run
  const broken = await page.evaluate(() => {
    return [...document.querySelectorAll("shreddit-post[view-type='compactView']")]
      .filter((p) => {
        if (p.getBoundingClientRect().height === 0) return false;
        const t = p.querySelector("[slot='title']");
        if (t && t.getBoundingClientRect().height > 0) return false;
        const txt = (p.getAttribute("post-title") || "").trim().slice(0, 24);
        return !(txt && p.shadowRoot && p.shadowRoot.textContent.includes(txt));
      }).length;
  });
  report.brokenCompactRows = broken;
  if (broken > 0) problem(`${broken} compactView rows have no visible title (self-heal failed)`);
  else log("self-heal ok — every compact row shows a title");

  // ---- Keyboard: j/j/k should land selection on the first post -------------
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.click(60, 400); // empty left margin — focus without navigating
  await sleep(300);
  await page.keyboard.press("j");
  await sleep(350);
  await page.keyboard.press("j");
  await sleep(350);
  await page.keyboard.press("k");
  await sleep(500);
  const kb = await page.evaluate(() => {
    const sel = document.querySelectorAll("[data-tl-selected]");
    return {
      selectedCount: sel.length,
      selectedIsPost: sel.length === 1 && sel[0].getAttribute("data-tl") === "post"
    };
  });
  report.keyboard = kb;
  if (kb.selectedCount !== 1 || !kb.selectedIsPost) {
    problem(`keyboard selection wrong: count=${kb.selectedCount} isPost=${kb.selectedIsPost}`);
  } else {
    log("keyboard j/k selection works");
  }
  await page.screenshot({ path: join(SHOTS, "feed-selected.png") });

  // ---- Comments page --------------------------------------------------------
  if (feed.firstPermalink) {
    log("opening comments: " + feed.firstPermalink);
    await page.goto(new URL(feed.firstPermalink, "https://www.reddit.com").href, {
      waitUntil: "domcontentloaded", timeout: 60000
    }).catch((e) => problem("comments goto: " + e.message));
    for (let i = 0; i < 10; i++) {
      const ok = await page.evaluate(() =>
        document.querySelectorAll("shreddit-comment").length > 0).catch(() => false);
      if (ok) break;
      await sleep(2000);
    }
    await sleep(2500);
    const comments = await page.evaluate(() => {
      const all = [...document.querySelectorAll("shreddit-comment")];
      const first = all[0];
      return {
        route: document.documentElement.getAttribute("data-tl-route"),
        total: all.length,
        stamped: document.querySelectorAll("[data-tl='comment']").length,
        withDepthAttr: all.filter((c) => c.hasAttribute("depth")).length,
        sampleSlots: first
          ? [...first.querySelectorAll("[slot]")].slice(0, 12)
              .map((e) => `${e.tagName.toLowerCase()}[slot=${e.getAttribute("slot")}]`)
          : [],
        avatarVisible: (() => {
          const av = first?.querySelector("[slot='commentAvatar'], [slot='avatar']");
          return av ? getComputedStyle(av).display !== "none" : "absent";
        })()
      };
    });
    report.comments = comments;
    log(`comments route=${comments.route} total=${comments.total} ` +
        `stamped=${comments.stamped} depthAttr=${comments.withDepthAttr} ` +
        `avatarVisible=${comments.avatarVisible}`);
    if (comments.total && !comments.stamped) problem("comments not stamped");
    if (comments.route !== "comments") problem("route not detected as comments (SPA nav?)");
    await page.screenshot({ path: join(SHOTS, "comments-compact.png") });
  }

  report.consoleErrors = consoleErrors.slice(0, 30);
  writeFileSync(join(SHOTS, "report.json"), JSON.stringify(report, null, 2));
  console.log("\n==== RESULT ====");
  console.log(report.problems.length
    ? `${report.problems.length} problem(s):\n- ` + report.problems.join("\n- ")
    : "all checks passed");
  console.log("shots + report.json in: " + SHOTS);
} finally {
  if (!KEEP) await browser.close();
}
