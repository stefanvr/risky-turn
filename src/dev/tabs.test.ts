// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "vite";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import type { ViteDevServer } from "vite";

/**
 * The seam at the only boundary that matters: two independent page contexts,
 * with every message serialised on the way across.
 *
 * jsdom cannot show this and the loopback transport cannot either — it lives
 * inside one page, so two tabs driven by it would be two separate matches. A
 * real browser with two real tabs is the cheapest thing that can tell the
 * difference.
 */
describe("two tabs on one match", () => {
  const ROOM = "checking";
  let server: ViteDevServer;
  let browser: Browser;
  let url: string;
  let hosting: Page;
  let joining: Page;

  const turnBar = (page: Page): Promise<string> =>
    page.locator('[data-role="turn"]').innerText();
  const lineOn = (page: Page, territory: string): Promise<string | null> =>
    page.getAttribute(`[data-line-for="${territory}"]`, "data-line");

  beforeAll(async () => {
    server = await createServer({ server: { port: 0 } });
    await server.listen();
    url = server.resolvedUrls!.local[0]!;
    browser = await chromium.launch();
    const context = await browser.newContext();

    const at = `?fixture=secret-line&seed=42&room=${ROOM}`;
    hosting = await context.newPage();
    await hosting.goto(`${url}${at}&seat=Red&host`);
    await hosting.waitForSelector('[data-role="turn"]');

    joining = await context.newPage();
    await joining.goto(`${url}${at}&seat=Blue`);
    await joining.waitForSelector('[data-role="turn"]');
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it("carries a move made in one tab to the other", async () => {
    expect(await turnBar(joining)).toContain("Attack");

    await hosting.click('[data-role="end-phase"]');

    // Nothing is done to the joining page: it moves because the host told it.
    await joining.waitForFunction(
      () => document.querySelector('[data-role="turn"]')?.textContent?.includes("Fortify") ?? false,
      undefined,
      { timeout: 10_000 },
    );
    expect(await turnBar(joining)).toContain("Fortify");
  }, 60_000);

  it("tells each tab only what its own player may know", async () => {
    // Blue is dug in on Calder. Blue's own tab draws the line; Red's tab is
    // never sent it, so there is nothing there for Red's page to draw.
    expect(await lineOn(joining, "calder")).toMatch(/building|holding/);
    expect(await lineOn(hosting, "calder")).toBe("none");
  }, 60_000);

  it("lets two tabs reach one match through the screens", async () => {
    const context = browser.contexts()[0]!;
    const hosting = await context.newPage();
    const joining = await context.newPage();
    try {
      await hosting.goto(url);
      await hosting.click('[data-role="play-online"]');
      const code = ((await hosting.textContent('[data-role="join-code"]')) ?? "").replace(
        /\s/g,
        "",
      );
      expect(code).toMatch(/^\d{6}$/);

      await joining.goto(url);
      await joining.click('[data-role="play-online"]');
      await joining.click('[data-role="join-instead"]');
      await joining.fill('[data-role="code-field"]', code);
      await joining.click('[data-role="join"]');

      // Both are on the board now, because the second player arrived.
      await hosting.waitForSelector('[data-role="turn"]', { timeout: 10_000 });
      await joining.waitForSelector('[data-role="turn"]', { timeout: 10_000 });

      // A dealt game opens in deploy with armies still in hand, so the move to
      // make is placing one. How many depends on the deal, so it is read from
      // the joining tab rather than assumed, and then watched to fall by one.
      const inHand = Number(
        /(\d+) to place/.exec((await joining.textContent('[data-role="turn"]')) ?? "")?.[1],
      );
      expect(inHand).toBeGreaterThan(0);

      await hosting.locator('[data-territory][data-player="1"]').first().click();

      await expect
        .poll(() => joining.textContent('[data-role="turn"]'), { timeout: 10_000 })
        .toContain(`${inHand - 1} to place`);
    } finally {
      await hosting.close();
      await joining.close();
    }
  }, 90_000);
});
