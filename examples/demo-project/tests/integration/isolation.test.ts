// Phase 4 (+tdd): written before the code, red for the right reason (the service throws NotImplemented).
// Illustrative — the demo ships no test runner; the T-ID in each test name is what `trace --code` matches.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createKey, verifyKey } from "../../src/api-keys/service.js";
import { seedTenant, readAs } from "./helpers.js";

describe("api-keys: tenant isolation (US-1.AC-4)", () => {
  it("T-04 for any two tenants, a key of A never reads tenant B data", async () => {
    await fc.assert(fc.asyncProperty(fc.uuid(), fc.uuid(), async (idA, idB) => {
      fc.pre(idA !== idB);
      const [a, b] = await Promise.all([seedTenant(idA), seedTenant(idB)]);
      const { token } = await createKey(a.id, "probe");
      const ctx = await verifyKey(`Bearer ${token}`);
      expect(await readAs(ctx, b.resourceId)).toBeNull();
    }), { numRuns: 200 });
  });
});
