/* =============================================================================
 * Threadline — test/launch-dev.mjs
 * Opens a Chrome window with the extension installed, for interactive testing.
 * Uses a persistent dev profile (~/.threadline-dev-chrome) so logins/settings
 * survive relaunches. Keep this process running while you test; closing the
 * browser window ends it.
 *
 *   cd test && node launch-dev.mjs [start-url]
 *
 * (Needed because Chrome ≥137 ignores --load-extension on branded builds; this
 * installs via Puppeteer's CDP installExtension instead. To install into your
 * MAIN Chrome profile permanently: chrome://extensions → Developer mode →
 * Load unpacked → select the extension/ folder.)
 * =========================================================================== */
import puppeteer from "puppeteer-core";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(HERE, "..", "extension");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const START_URL = process.argv[2] || "https://www.reddit.com/r/ClaudeCode/";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  pipe: true,
  enableExtensions: true,
  userDataDir: join(homedir(), ".threadline-dev-chrome"),
  defaultViewport: null,
  ignoreDefaultArgs: ["--enable-automation"],
  args: [
    "--window-size=1440,900",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-blink-features=AutomationControlled"
  ]
});

const extId = await browser.installExtension(EXT);
console.log(`Dense installed (${extId}). Dev browser is up — close the`);
console.log(`window (or Ctrl+C here) to end. Try: ? for keys, Alt to peek,`);
console.log(`Alt+R to toggle, . for the command palette.`);

const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto(START_URL).catch(() => {});

browser.on("disconnected", () => process.exit(0));
