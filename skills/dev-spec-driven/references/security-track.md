# The +sec Track — Security by Design

`+sec` is for a feature where a mistake is a **breach**, not just a bug: it handles credentials, money,
personal or confidential data, crosses a trust boundary (public endpoint, webhook, file upload, a
third-party callback), or changes who may do what. It composes with every other track — a login
feature is usually `core +tdd +sec`, a multi-tenant admin API `core +tdd +saas +sec`, an LLM agent that
calls tools `core +ai +sec`.

This reference covers: what the track adds, how to fill each mandatory section (STRIDE, ASVS levels,
the OWASP Top 10), abuse cases, and security testing you can run locally before a merge.

---

## When to turn it on

`spec_classify` proposes `+sec` from its signals (EN/PT/ES), and the human confirms in Phase 0.

| Signal strength | Examples |
|---|---|
| **Strong** (one is enough) | threat model, OWASP, XSS, CSRF, SQL injection, pentest, vulnerability, CVE, ASVS, secrets management, encryption at rest, security audit / review, SAST / DAST, attack surface, privilege escalation, SSRF · *modelo de ameaças, teste de intrusão, gestão de segredos* · *modelo de amenazas, prueba de penetración, gestión de secretos* |
| **Weak** (needs a second one) | authentication, authorization, RBAC, access token, API key, credentials, encryption, audit log, input validation, security, brute force, `STRIDE` (upper case only — a lower-case "stride" is an array stride) · *autenticação, autorização, segurança* · *autenticación, autorización, seguridad* |
| **Corroborating only** | permission · *permissão* · *permiso* — evidence only beside another `+sec` signal ("RBAC permissions"); alone it is no hint (file permission bits, a leave of absence) |

Auth words are **weak** on purpose — they are `+tdd`'s strong signals. "Login with a password" is
`core +tdd` with a *possible* `+sec` note; "login with a password, RBAC and an audit log" turns `+sec` on
(from weak signals only — the note asks you to double-check). A negated signal ("no authentication
needed") keeps the track off and says so. Rules for every track: `classification-matrix.md`.

Turn it on later with `spec_add_track {name, track: "sec"}` (`dev-spec add-track <feature> sec`);
turn it off with `remove: true` — non-destructive, the `[SEC]` sections and tasks stay on disk, inactive.

---

## What the track adds

| Artifact | What `+sec` puts there |
|---|---|
| `requirements.md` | `#### [SEC] Acceptance Criteria (EARS)` — **US-1.AC-10** unauthenticated → 401, no data; **US-1.AC-11** unauthorized → 403 + audit event; **US-1.AC-12** no secret / token / stack trace in any response or log |
| `design.md` | 5 mandatory sections, each seeded with the `> **TODO**` sentinel: `[SEC] Threat Model` · `[SEC] Security Requirements` · `[SEC] Authentication & Authorization` · `[SEC] Secrets & Key Management` · `[SEC] Security Testing` |
| `tasks.md` | `## Story US-1 — Security`: threat model, authn + object-level authz, secrets out of code/logs, security testing |
| `test-plan.md` (with `+tdd`) | one abuse-case row per criterion — AC-11 and AC-12 are `property` rows (a "never" rule) |
| `steering/security.md` | ASVS level, threat-modeling method, auth model, secret store, secure coding rules, local security tests, vulnerability deadlines |
| `checklist.md` / `spec_finish` | the sec items only a fresh run or a human can confirm (scans clean, threat model re-checked) |

`spec_doctor` runs **`sec-sections`** — FAIL while a `[SEC]` section is missing, empty or still holds
the TODO line; the **design approval is refused** for the same reason. `spec_clarify` asks for an
access-denied criterion and for the secrets the feature handles when `requirements.md` says nothing
about them. Headings are matched in EN/PT/ES (`Modelo de Ameaças`, `Modelo de Amenazas`…); the
`[SEC]` marker stays English in every language.

An honest "not applicable because X" fills a section — blank does not.

---

## [SEC] Threat Model — STRIDE, step by step

1. **Draw the data flow.** One Mermaid diagram: actors, processes, data stores, external systems —
   and the **trust boundaries** between them (internet ↔ API, API ↔ database, your service ↔ a
   third party, user ↔ admin).
2. **List the assets.** What an attacker wants: credentials, sessions, personal data, money movements,
   admin capability, availability.
3. **Walk every element that crosses a boundary through STRIDE:**

| Threat | Property it breaks | Typical question | Typical mitigation |
|---|---|---|---|
| **S**poofing | authenticity | Can someone act as another user / service? | strong authn, MFA, signed webhooks, mTLS |
| **T**ampering | integrity | Can a request, file or record be altered? | server-side validation, signatures, MACs, least-privileged DB user |
| **R**epudiation | non-repudiation | Can someone deny doing it? | append-only audit log with actor, action, target, time |
| **I**nformation disclosure | confidentiality | Can data leak (responses, logs, errors, URLs)? | object-level authz, field filtering, redaction, encryption |
| **D**enial of service | availability | Can one caller exhaust it? | rate limits, quotas, timeouts, size limits, queues |
| **E**levation of privilege | authorization | Can a user gain a role or reach another tenant? | deny by default, role checks on every call, no client-trusted roles |

4. **Record each threat → mitigation → residual risk** in the section (a table is fine), and turn
   every *material* threat into an **abuse case** (below) and, when it is a behaviour, an EARS criterion.
5. **Re-run it when the design changes** — a new endpoint, a new store or a new third party is a new
   boundary.

---

## [SEC] Security Requirements — pick an ASVS level

The OWASP Application Security Verification Standard (ASVS) defines three levels:

| Level | For | In practice |
|---|---|---|
| **L1** | low-risk apps, a first baseline | the controls you can verify from outside (black-box testable) |
| **L2** | most apps that handle personal or business data — **the sensible default** | L1 + the controls that need design and code access |
| **L3** | high-value targets: health, finance, critical infrastructure, high-trust admin | L2 + the strictest requirements, in-depth review |

In the section: the target level and **why**, then the requirement families in scope for this feature
(authentication, session management, access control, validation and encoding, cryptography, error
handling and logging, data protection, API, configuration) and **how the design meets each**. Cite the
requirement IDs of the ASVS version you pin — they changed between v4.0.3 and v5.0.

### OWASP Top 10 → where the track covers it

Numbers are the 2021 edition. The 2025 edition reorders and merges some categories and adds
supply-chain and exceptional-condition risks — map by risk **name**, not number.

| OWASP Top 10 risk | Where it lands in the spec |
|---|---|
| A01 Broken Access Control | `[SEC] Authentication & Authorization`; US-1.AC-11 (403 on someone else's resource) |
| A02 Cryptographic Failures | `[SEC] Secrets & Key Management` (encryption at rest / in transit, key ownership) |
| A03 Injection (SQL, command, XSS) | Threat Model (Tampering); steering "parameterized queries only, encode output"; SAST |
| A04 Insecure Design | the Threat Model itself — threats found before code |
| A05 Security Misconfiguration | steering `security.md`; Security Testing (DAST, config review) |
| A06 Vulnerable and Outdated Components | Security Testing (dependency audit) |
| A07 Identification and Authentication Failures | US-1.AC-10; `[SEC] Authentication & Authorization` (MFA, session lifetime, revocation) |
| A08 Software and Data Integrity Failures | Threat Model (Tampering: signed updates, webhook signatures, trusted pipelines) |
| A09 Security Logging and Monitoring Failures | US-1.AC-11 (audit event); US-1.AC-12 (no secrets in logs) |
| A10 Server-Side Request Forgery | Threat Model (outbound calls: allow-list destinations, block internal ranges) |

---

## [SEC] Authentication & Authorization

- **Who may do what** — a role / permission matrix (rows: roles, columns: actions on resources).
- **Authentication** — mechanism (session cookie, token, OAuth/OIDC), MFA where it matters,
  credential storage (a slow password hash — argon2id, scrypt or bcrypt), lockout / throttling.
- **Object-level authorization** — every request checks that *this* user may touch *this* record
  (the #1 API flaw is an ID in the URL that nobody checks). Deny by default.
- **Session lifetime and revocation** — idle and absolute timeouts; logout and password change revoke.

## [SEC] Secrets & Key Management

- Every secret the feature needs (API keys, DB credentials, signing keys, webhook secrets).
- Where they live: a secret store or the platform's secret manager — **never** in code, committed
  config, logs, error messages, URLs or tickets. Local development uses a git-ignored `.env`.
- Rotation (who, how often, how without downtime) and what happens on a leak.
- Encryption at rest and in transit (TLS version) and who owns the keys.

---

## Abuse cases

An abuse case is a test written from the attacker's side: *"as an attacker I …"*. Write one per
material threat; with `+tdd` they are ordinary test-plan rows traced to the `[SEC]` criteria.

| Threat | Abuse case (test) | Criterion |
|---|---|---|
| Spoofing | call the endpoint with no token / an expired token → 401, body carries no data | US-1.AC-10 |
| Elevation / disclosure | user B requests user A's record by ID → 403 and an audit event | US-1.AC-11 |
| Disclosure | force an error → the response and the log hold no stack trace, token or secret | US-1.AC-12 |
| Tampering | send a field the client must not set (`role`, `tenant_id`, `price`) → ignored or 400 | your own AC |
| Denial of service | exceed the rate limit / upload an oversized file → 429 / 413, service stays up | your own AC |

Property-based tests fit the "never" rules: generate many (user, resource) pairs and assert that no
cross-owner access ever succeeds.

---

## Security testing in a local pipeline

Everything runs on the developer's machine or a local hook — no external service is required.

| Check | Examples (open source) | When |
|---|---|---|
| SAST | Semgrep, CodeQL CLI, Bandit (Python), gosec (Go) | pre-commit on changed files; full run before the merge |
| Dependency audit | `npm audit`, `pip-audit`, OSV-Scanner, `cargo audit` | on every dependency change; before the merge |
| Secret scan | gitleaks, trufflehog | pre-commit (block the commit) |
| DAST | OWASP ZAP baseline scan against a local instance | features with an exposed HTTP surface |
| Abuse-case tests | your test runner | with the rest of the suite (`_Verify:_` on the task) |

Give the security-testing task a `_Verify:_` command that runs them, so `spec_complete_task` records a
passing run as evidence and `spec_finish` can see it. The plugin's optional `hooks/precommit-check.js`
validates the spec files; chain your scanners in the same local pre-commit hook.

---

## Filled example (short)

```markdown
## [SEC] Threat Model
| Boundary / element | STRIDE | Threat | Mitigation | Residual |
|---|---|---|---|---|
| Internet → POST /api/export | S | replayed session cookie | HttpOnly+Secure+SameSite, 30 min idle timeout | low |
| API → exports bucket | I | export URL guessable | signed URL, 15 min expiry, per-user prefix | low |
| API → exports table | E | user requests another user's export ID | owner check in the query, deny by default | low |

## [SEC] Security Requirements
ASVS L2 (personal data). In scope: access control, session management, data protection, logging —
met by the owner check, signed URLs, audit events without payloads.
```

See also: `test-patterns.md` (abuse cases as tests), `privacy-track.md` (personal data), `red-flags.md`.
