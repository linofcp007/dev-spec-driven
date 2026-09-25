// Phase 4 (+tdd): written before the code, red for the right reason (the service throws NotImplemented).
// Illustrative — the demo ships no test runner; the T-ID in each test name is what `trace --code` matches.
import { describe, it, expect } from "vitest";
import { createKey, rotateKey, verifyKey } from "../../src/api-keys/service.js";
import { seedTenants, clock } from "./helpers.js";

describe("api-keys: rotate (US-2.AC-1)", () => {
  it("T-05 rotate issues a new key; the old key works for the 24h grace window, then auto-revokes", async () => {
    const { a } = await seedTenants();
    const old = await createKey(a.id, "ci");
    const next = await rotateKey(old.id);
    await expect(verifyKey(`Bearer ${next.token}`)).resolves.toMatchObject({ tenantId: a.id });
    await expect(verifyKey(`Bearer ${old.token}`)).resolves.toMatchObject({ tenantId: a.id });
    clock.advance({ hours: 24, seconds: 1 });
    await expect(verifyKey(`Bearer ${old.token}`)).rejects.toMatchObject({ status: 401 });
  });
});
