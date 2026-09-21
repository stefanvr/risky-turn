/**
 * Take a picture of the real page in a real browser, at phone size.
 *
 *   pnpm shot /tmp/board.png
 *   pnpm shot /tmp/legend.png --at "?fixture=found-line&seed=4" \
 *             --tap '[data-role="legend-open"]'
 *
 * It starts the development server itself, so fixtures and seeds work exactly
 * as they do in `pnpm dev`, and it taps through the page with real clicks, so
 * a state that takes a tap to reach can be looked at. Everything outside the
 * map — the turn bar, the status line, the controls — is in the picture,
 * which is what the SVG rasteriser in `board-picture.py` cannot show.
 */
import { createServer } from "vite";
import { chromium } from "playwright";

const PHONE = { width: 390, height: 844 };

const [out, ...rest] = process.argv.slice(2);
if (!out) {
  console.error("usage: pnpm shot <out.png> [--at <query>] [--tap <selector>]...");
  process.exit(1);
}

let at = "";
const taps = [];
for (let i = 0; i < rest.length; i += 2) {
  const value = rest[i + 1];
  if (rest[i] === "--at") at = value;
  else if (rest[i] === "--tap") taps.push(value);
  else {
    console.error(`unknown argument: ${rest[i]}`);
    process.exit(1);
  }
}

const server = await createServer({ server: { port: 0 } });
await server.listen();
const url = server.resolvedUrls.local[0];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: PHONE,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

try {
  await page.goto(url + at.replace(/^\?/, "?"));
  // Everything is mounted from a module, so the page is empty until it is.
  // The door and the board both fill the same element, so this waits for
  // whichever of them this address asks for.
  await page.waitForSelector("#game > *");
  for (const selector of taps) await page.click(selector);
  await page.screenshot({ path: out });
  console.log(`wrote ${out} at ${PHONE.width}x${PHONE.height}`);
} finally {
  await browser.close();
  await server.close();
}
