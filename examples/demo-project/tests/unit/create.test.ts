// Phase 4 (+tdd): written before the code, red for the right reason (the service throws NotImplemented).
// Illustrative — the demo ships no test runner; the T-ID in each test name is what `trace --code` matches.
import { describe, it, expect } from "vitest";
import { createKey, hashKey } from "../../src/api-keys/service.js";

describe("api-keys: create (US-1.AC-1)", () => {
  it("T-01 returns the token once and stores only its hash + prefix", async () => {
    const { token, prefix, stored } = await createKey("tenant-a", "ci");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(prefix).toBe(token.slice(0, 8));
    expect(stored.hash).toBe(hashKey(token));
    expect(JSON.stringify(stored)).not.toContain(token);
  });
});
