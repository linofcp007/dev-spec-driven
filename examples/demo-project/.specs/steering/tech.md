# Tech

## Stack
- Frontend: none (API only; an admin UI is out of scope for now)
- Backend: Node.js 20 + TypeScript
- Database: Postgres 16 (row-level security on tenant tables)
- Auth: per-tenant API keys (this project's `api-keys` feature)

## Infrastructure
- Hosting / Region / CDN: containers in one EU region (eu-west), Redis for hot caches, no CDN.

## Conventions
- Language / formatting / test runner / migrations / commit format: TypeScript strict, Prettier, Vitest, SQL migrations in `migrations/`, conventional commits.

## Constraints
- Runtime version / browser support / accessibility / regulatory: Node 20 LTS; no browser surface; EU data residency (GDPR).
