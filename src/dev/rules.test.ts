// @vitest-environment node
import { describe, expect, it } from "vitest";

/**
 * The rules are the only boundary between one match and another: a join code
 * is short enough to guess, so what a guess can reach has to be nothing.
 * Checked against the database emulator, because rules cannot be checked by
 * reading them.
 */
describe("what a browser may reach in the database", () => {
  it("refuses a room it is not a party to", async () => {
    const { readUnrelatedRoom } = await import("./rulesHarness");
    await expect(readUnrelatedRoom()).rejects.toThrow(/permission|denied/i);
  });

  it("lets the two players of a room exchange what they need", async () => {
    const { exchangeInOwnRoom } = await import("./rulesHarness");
    await expect(exchangeInOwnRoom()).resolves.toBe(true);
  });

  it("lets the host clear the room it made", async () => {
    const { hostClearsOwnRoom } = await import("./rulesHarness");
    await expect(hostClearsOwnRoom()).resolves.toBe(true);
  });

  it("does not let the guest clear the room", async () => {
    const { guestClearsTheRoom } = await import("./rulesHarness");
    await expect(guestClearsTheRoom()).rejects.toThrow(/permission|denied/i);
  });
});
