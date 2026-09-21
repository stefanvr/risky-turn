// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "vite";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";
import type { ViteDevServer } from "vite";

/**
 * Two browsers, not two tabs.
 *
 * Each page gets its own browser context, so nothing same-origin can carry the
 * game between them: no BroadcastChannel, no shared storage. What is left is
 * the backend, which carries the whole match — so the check watches the
 * database socket while a move is made, and watches for a peer connection
 * that must never be built.
 */
describe("two browsers on one game", () => {
  let server: ViteDevServer;
  let browser: Browser;
  let url: string;
  let hosting: { context: BrowserContext; page: Page };
  let joining: { context: BrowserContext; page: Page };
  const databaseFrames: string[] = [];
  let watchingFrames = false;

  const openOne = async (): Promise<{ context: BrowserContext; page: Page }> => {
    const context = await browser.newContext();
    // Counted rather than refused, so a failure says how many were built.
    await context.addInitScript(() => {
      const made = { count: 0 };
      (window as unknown as { peersBuilt: { count: number } }).peersBuilt = made;
      const original = window.RTCPeerConnection;
      if (original === undefined) return;
      window.RTCPeerConnection = new Proxy(original, {
        construct(target, args: unknown[]) {
          made.count += 1;
          return Reflect.construct(target, args) as RTCPeerConnection;
        },
      });
    });
    const page = await context.newPage();
    // Realtime Database talks over a WebSocket, so the traffic is frames on a
    // socket, not requests. Counting requests would prove nothing either way.
    page.on("websocket", (socket) => {
      if (!/firebasedatabase|:9000\//.test(socket.url())) return;
      socket.on("framesent", (frame) => {
        if (watchingFrames) databaseFrames.push(String(frame.payload));
      });
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
    browser = await chromium.launch();
    hosting = await openOne();
    joining = await openOne();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it("introduces two browsers by a code and seats them in one match", async () => {
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

  it("carries the game through the database, which is the transport", async () => {
    watchingFrames = true;
    databaseFrames.length = 0;

    const inHand = Number(/(\d+) to place/.exec((await turn(joining.page)) ?? "")?.[1]);
    expect(inHand).toBeGreaterThan(0);

    await hosting.page.locator('[data-territory][data-player="1"]').first().click();

    await expect
      .poll(() => turn(joining.page), { timeout: 30_000 })
      .toContain(`${inHand - 1} to place`);

    // The move crossed, and it crossed here: the backend is the carrier, not
    // an introduction service that steps aside.
    expect(databaseFrames.length).toBeGreaterThan(0);
  }, 120_000);

  it("builds no peer connection at all", async () => {
    for (const page of [hosting.page, joining.page]) {
      const built = await page.evaluate(
        () => (window as unknown as { peersBuilt: { count: number } }).peersBuilt.count,
      );
      expect(built).toBe(0);
    }
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
