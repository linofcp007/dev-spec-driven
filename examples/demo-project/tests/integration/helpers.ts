// Integration fixtures (illustrative stubs, like src/api-keys/service.js): two seeded tenants on a real
// Postgres + Redis, an injected clock and a captured log — see test-plan.md "Test Data & Fixtures".
const todo = (what: string) => (..._args: unknown[]): never => { throw new Error(`NotImplemented: ${what}`); };

export const seedTenants = todo("seedTenants") as () => Promise<{ a: { id: string }; b: { id: string } }>;
export const seedTenant = todo("seedTenant") as (id: string) => Promise<{ id: string; resourceId: string }>;
export const readAs = todo("readAs") as (ctx: unknown, resourceId: string) => Promise<unknown>;
export const revoke = todo("revoke") as (keyId: string) => Promise<void>;
export const deleteTenant = todo("deleteTenant") as (tenantId: string) => Promise<void>;
export const logs = todo("logs") as () => string;
export const clock = { advance: todo("clock.advance") as (by: { hours?: number; seconds?: number }) => void };
