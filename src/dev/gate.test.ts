import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureNames } from "./fixtures";

const ASSETS = join(process.cwd(), "dist", "assets");

function productionBundle(): string {
  const scripts = readdirSync(ASSETS).filter((name) => name.endsWith(".js"));
  return scripts.map((name) => readFileSync(join(ASSETS, name), "utf8")).join("\n");
}

/**
 * A developer affordance that ships enabled is not an affordance, it is a
 * cheat. This reads the artifact rather than trusting the gate, because the
 * gate is a build-time constant and nothing else would notice it breaking.
 */
describe("the production build", () => {
  it("carries no fixture code at all", () => {
    const bundle = productionBundle();
    expect(bundle).not.toContain("no fixture named");
    for (const name of fixtureNames()) {
      expect(bundle).not.toContain(name);
    }
  });

  it("was actually read, so the check above cannot pass on an empty file", () => {
    expect(productionBundle().length).toBeGreaterThan(1000);
  });
});
