// Phase 4 (+tdd): written before the code, red for the right reason (the service throws NotImplemented).
// Illustrative — the demo ships no test runner; the T-ID in each test name is what `trace --code` matches.
import { describe, it, expect } from "vitest";
import { createKey, verifyKey } from "../../src/api-keys/service.js";
import { seedTenants, revoke, deleteTenant, logs } from "./helpers.js";

describe("api-keys: verify (US-1.AC-2, US-1.AC-3, EC-1, EC-2)", () => {
  it("T-02 a valid key authenticates as the owning tenant in under 50ms", async () => {
    const { a } = await seedTenants();
    const { token } = await createKey(a.id, "ci");
    const started = performance.now();
    const ctx = await verifyKey(`Bearer ${token}`);
    expect(ctx.tenantId).toBe(a.id);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it("T-03 a revoked or expired key returns 401 and logs the prefix only", async () => {
    const { a } = await seedTenants();
    const { id, token, prefix } = await createKey(a.id, "ci");
    await revoke(id);
    await expect(verifyKey(`Bearer ${token}`)).rejects.toMatchObject({ status: 401 });
    expect(logs()).toContain(prefix);
    expect(logs()).not.toContain(token);
  });

  it("T-06 a malformed Authorization header returns 401 with no stack trace", async () => {
    await expect(verifyKey("Bearer")).rejects.toMatchObject({ status: 401, stack: undefined });
  });

  it("T-07 a key whose tenant was deleted is treated as revoked", async () => {
    const { a } = await seedTenants();
    const { token } = await createKey(a.id, "ci");
    await deleteTenant(a.id);
    await expect(verifyKey(`Bearer ${token}`)).rejects.toMatchObject({ status: 401 });
  });
});
