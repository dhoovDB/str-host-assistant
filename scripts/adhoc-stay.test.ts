import { spawnSync } from "node:child_process";
import { describe, it, expect } from "vitest";

// Runs the script the way /adhocstay does, under plain Node. tsc and Vitest both
// resolve imports that plain Node can't, such as an extensionless value import in
// gcal.ts, calendar.ts or supabase.ts, so only a real run catches that. The env
// carries no Supabase credentials, so these can't reach a database.
function run(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ["scripts/adhoc-stay.ts", ...args], {
    encoding: "utf8",
    env: { SystemRoot: process.env.SystemRoot ?? "", ...env },
  });
}

describe("adhoc-stay script", () => {
  it("loads under plain Node and asks for PROPERTY_ID", () => {
    const { status, stderr } = run(["list"]);
    expect(stderr).toContain("ERROR: PROPERTY_ID is missing");
    expect(status).toBe(1);
  });

  it("rejects bad input before touching the database", () => {
    const { status, stderr } = run(
      ["add", "--check-in", "2026-02-30", "--check-out", "2026-03-02", "--label", "Test"],
      { PROPERTY_ID: "test" },
    );
    expect(stderr).toContain('Check-in "2026-02-30" is not a real YYYY-MM-DD date.');
    expect(status).toBe(1);
  });

  it("prints usage for an unknown command", () => {
    const { status, stderr } = run(["nonsense"], { PROPERTY_ID: "test" });
    expect(stderr).toContain("Usage:");
    expect(status).toBe(1);
  });
});
