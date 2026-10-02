---
description: Track-aware local pre-merge review against the full spec chain, each finding verified before it is reported (no PR or CI needed). PT - revisão local antes do merge. ES - revisión local antes del merge.
argument-hint: "[feature name or diff scope]"
---

Use the **dev-spec-driven** skill code-review workflow.

Scope: $ARGUMENTS

Review the given scope — by default the branch, `git diff <merge-base>..HEAD` with `<merge-base>` = `git merge-base
<base-branch> HEAD` — against the full chain, gating checks by the feature's active tracks:
- **Spec compliance** — does the code match the design?
- **Constitution** — the code honours every principle in `.specs/steering/constitution.md`; anything that
  breaks one is justified in the design's Complexity Tracking table, or it is sent back.
- **+tdd** — red-first evidence in git history (test commits before impl); every AC has a test.
- **+saas** — scale sections filled; every new query has `WHERE tenant_id = ?`; observability points
  added; new hot paths hit cache (cost).
- **+ai** — eval delta present in the merge summary / commit; prompt changes live in versioned files (not inline
  strings); PII-to-model reviewed; cost tracking on new model calls.
- **+sec** — the threat model's mitigations are in the code; authn + object-level authz on every new endpoint (deny
  by default); no secret, token or stack trace in responses or logs; the abuse-case tests exist and the scans ran.
- **+privacy** — only the fields the data inventory lists are collected; retention / deletion implemented; export and
  erasure reach every store the inventory names; no personal data in logs or sent to an unlisted processor.
- **+dist** — no database commit followed by a direct publish / cache / API write (outbox, inbox or saga as the design
  says); consumers idempotent; retries with timeouts, backoff + jitter and a DLQ; the concurrency control the design names.
- **+api** — the contract file matches the handlers (every status code, error code and header); no breaking change inside
  a version (the diff against the published contract is clean); errors are problem+json; creates honour Idempotency-Key.
- **+ui** — built from design-system components and tokens (no one-off styles); every state of the design's state matrix
  handled; keyboard operable, labelled, sufficient contrast (the automated accessibility check clean); strings in the catalogue.
- **+obs** — the metrics / logs / traces the design names are emitted (correlation ID, no personal data); each alert has a
  runbook; the flag, the rollout steps and the rollback criteria as the design says; liveness never checks a dependency.
- **+data** — every dataset written matches its contract (schema, owner, compatibility rule); the data-quality checks run where the
  design says and quarantine bad rows; loads are idempotent per partition (no blind append); retention and partitioning applied.
- **Security** — injection, authz, data exposure — always.
- **Written rules** — the constitution, the `CLAUDE.md` / `AGENTS.md` at the root and in each directory the diff
  touches, and the comments around the changed code ("never…", "keep in sync with…"): a break quotes the rule with its
  file:line (a rule you can't quote is not one; how-to-work instructions for an agent are no review rule).
- **History** — the lines the branch rewrites or deletes (not lines it added): `git log --oneline -L <start>,<end>:<file>
  <merge-base>` / `git blame`; a fix made there must survive, and a finished bugfix in `.specs/` (or `.specs/_archive/`)
  whose tasks implement the file keeps its Root Cause away and its regression test unchanged — a fixed bug brought back
  is Critical.

**Verify before you report.** Each Critical / Important finding is a claim until checked: does it exist at HEAD (the
input or call path that breaks it), did this branch introduce it, make it reachable or break unchanged lines with it (a
caller of a contract it changed) — not pre-existing —, is it what an AC, the design or `decisions.md` asks for, does a
green check or a documented exception already answer it? An AC with no code is never pre-existing: it is confirmed, or
refuted with the file:line that satisfies it. Rate each 0–100: **0** not real (or pre-existing) · **25** might be real,
unverified · **50** verified but minor or rare in practice · **75** verified and likely hit (or a spec / written rule
names it) · **100** direct evidence (a failing input, a run, the line that does it).
With a subagent tool, write the branch diff to a file first (`git diff -U10 <merge-base>..HEAD` into
`.specs/<feature>/.execution/review.diff` — a missing `.execution/` gets a `.gitignore` holding `*` — or a temp file),
then dispatch one `dev-spec-driven:spec-reviewer` in **verify** mode per finding — the finding, that file, the merge
base and HEAD, the feature folder — in parallel, cheapest tier (standard for a security, concurrency or data-loss
finding); without one, check each yourself and say the findings are self-verified.
Report the findings rated **80 or more** by severity; list the rest in one line each under "Unconfirmed (below 80)" —
never dropped silently. An AC with no code goes by its verdict, not a rating: confirmed → reported as a finding; refuted
→ dropped only with the file:line that satisfies the AC.

Run `trace_check` to confirm coverage. Report findings grouped by severity.
For an audit trail, `trace_check {name, matrix: true}` (CLI `dev-spec trace <feature> --matrix`; `--csv` for a
spreadsheet, `spec_export {format: "csv"}` to write `.specs/exports/<feature>.rtm.csv`) gives the requirements
traceability matrix — one row per AC / EC / NFR / SC with its status, tasks, tests, evidence, decisions and approval.
