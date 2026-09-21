// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "vite";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page, Request } from "playwright";
import type { ViteDevServer } from "vite";

/**
 * Two browsers, not two tabs.
 *
 * Each page gets its own browser context, so nothing same-origin can carry the
 * game between them: no BroadcastChannel, no shared storage. What is left is
 * the room in the database and the peer connection it introduces, which is the
 * whole claim of this milestone.
 */
describe("two browsers on one game", () => {
  let server: ViteDevServer;
  let browser: Browser;
  let url: string;
  let hosting: { context: BrowserContext; page: Page };
  let joining: { context: BrowserContext; page: Page };
  const databaseCalls: Request[] = [];
  let watchingCalls = false;

  const openOne = async (): Promise<{ context: BrowserContext; page: Page }> => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("request", (request) => {
      if (watchingCalls && /firebasedatabase|:9000\//.test(request.url())) databaseCalls.push(request);
    });
    await page.goto(url);
    // Vite discovers and pre-bundles the Firebase modules on first load, which
    // reloads the page. Waiting for the door means that is over before
    // anything is clicked, whatever order the files happen to run in.
    await page.waitForSelector('[data-role="play-online"]', { timeout: 60_000 });
    return { context, page };
  };

  const turn = (page: Page): Promise<string | null> => page.textContent('[data-role="turn"]');

  beforeAll(async () => {
    process.env["VITE_FIREBASE_EMULATOR"] = "1";
    server = await createServer({ server: { port: 0 } });
    await server.listen();
    url = server.resolvedUrls!.local[0]!;
    // Chromium hides a machine's local addresses behind mDNS hostnames, and a
    // CI runner has nothing to resolve them with, so the two contexts gather
    // candidates they cannot use and the channel never opens. Off, the host
    // candidates are plain addresses and the two browsers find each other on
    // the machine they are both running on. This is how the test reaches a
    // connection, not how the game does: a player's browser keeps mDNS and
    // reaches the other side through the STUN server in src/net/peer.ts.
    browser = await chromium.launch({
      args: ["--disable-features=WebRtcHideLocalIpsWithMdns"],
    });
    hosting = await openOne();
    joining = await openOne();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it("introduces two browsers by a code and opens a channel between them", async () => {
    await hosting.page.click('[data-role="play-online"]');
    const code = ((await hosting.page.textContent('[data-role="join-code"]')) ?? "").replace(
      /\s/g,
      "",
    );
    expect(code).toMatch(/^\d{6}$/);

    await joining.page.click('[data-role="play-online"]');
    await joining.page.click('[data-role="join-instead"]');
    await joining.page.fill('[data-role="code-field"]', code);
    await joining.page.click('[data-role="join"]');

    // The screen says so, because a player waiting on a connection has to be
    // told whether it happened.
    for (const page of [hosting.page, joining.page]) {
      await expect
        .poll(() => page.textContent('[data-role="link-state"]'), { timeout: 30_000 })
        .toMatch(/connected/i);
      await page.waitForSelector('[data-role="turn"]', { timeout: 30_000 });
    }
  }, 120_000);

  it("carries the game on the channel, not through the database", async () => {
    watchingCalls = true;
    databaseCalls.length = 0;

    const inHand = Number(/(\d+) to place/.exec((await turn(joining.page)) ?? "")?.[1]);
    expect(inHand).toBeGreaterThan(0);

    await hosting.page.locator('[data-territory][data-player="1"]').first().click();

    await expect
      .poll(() => turn(joining.page), { timeout: 30_000 })
      .toContain(`${inHand - 1} to place`);

    // Firebase introduced the two browsers and then got out of the way.
    expect(databaseCalls.map((call) => call.url())).toEqual([]);
  }, 120_000);

  it("refuses a code no room is waiting on", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(url);
      await page.waitForSelector('[data-role="play-online"]', { timeout: 60_000 });
      await page.click('[data-role="play-online"]');
      await page.click('[data-role="join-instead"]');
      await page.fill('[data-role="code-field"]', "000000");
      await page.click('[data-role="join"]');

      await expect
        .poll(() => page.textContent('[data-role="door-status"]'), { timeout: 30_000 })
        .toMatch(/no game is waiting/i);
      expect(await page.$('[data-role="turn"]')).toBeNull();
    } finally {
      await context.close();
    }
  }, 120_000);
});
