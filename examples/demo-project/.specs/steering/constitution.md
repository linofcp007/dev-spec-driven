# Constitution

Non-negotiable principles every feature must obey.

## Principles
1. **Tenant isolation is absolute.** Every data access is scoped by `tenant_id`; a query without it is a bug.
2. **Secrets are never stored or logged in plaintext.** API keys are stored hashed; only a short prefix is logged.
3. **Auth fails closed.** On any ambiguity in authentication/authorization, deny.
4. **Idempotent writes.** Mutating endpoints accept an idempotency key or are naturally idempotent.

## Constraints
- EU data residency (GDPR). No PII to third parties without a DPA.

## Decision Rules
- Prefer boring, proven mechanisms over clever ones. A system nobody can debug at 3AM is a liability.
