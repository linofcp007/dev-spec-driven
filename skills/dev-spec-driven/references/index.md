# Reference index — which file when

Read on demand — never preload everything. `SKILL.md` names the file a phase needs at the point it needs it; this is
the whole library.

**Workflow and tooling**
- `references/tool-catalog.md` — which MCP tool when (start · gates · execute · change · project), the runnable CLI line
- `references/tooling-reference.md` — the MCP tools, prompts + resources, the CLI, the hooks, doctor checks, command
  table, annotated `.specs/` tree, roadmap, commit format
- `references/workflows.md` — the supporting commands (bugfix, spike, finish, impact, upgrade, import, templates,
  guard, review, commit, roadmap…), after-approval work (change requests, decisions, superseding, drift, metrics,
  exports) and the local automation
- `references/track-checklists.md` — per active track: the acceptance criteria to consider, the mandatory design
  sections, the test / eval plan additions, the task markers and the "done" checks before finishing
- `references/classification-matrix.md` — track-routing brain (the decision procedure, every track's signals); worked
  examples: `references/classification-examples-saas.md` / `references/classification-examples-ai.md`
- `references/project-tracks.md` — a team's own track pack in `.specs/tracks/<name>/`

**Modes and flows**
- `references/brownfield.md` — adopting SDD in an existing codebase (scan → constitution → reverse-specs → integration)
  + importing Kiro / spec-kit / OpenSpec specs, plans, Codex ExecPlans and BMAD docs
- `references/design-first.md` — the design-first phase order and spikes (investigate → decide)
- `references/bugfix.md` — systematic debugging as a light spec (reproduce → root cause → approval → red regression
  test → fix), the prefill of `spec_create {kind: "bugfix"}`
- `references/improvement-specs.md` — internal-improvement work (the metric delta is the acceptance criterion)
- `references/change-management.md` — after approval: snapshots + approval history, `spec_impact` + reopen, decisions,
  `_Supersedes:_`, the catalog, drift, archive/restore, metrics, roles + fast-forward, export + release notes, upgrading

**Writing the spec**
- `references/ears-guide.md` — full EARS syntax, all 5 patterns
- `references/steering-templates.md` — all 16 steering-file templates (incl. `distributed.md`, `api.md`, `ui.md`, `data.md` and
  the optional `glossary.md`), scoped steering (front matter inclusion modes), project templates in `.specs/templates/`
- `references/example-spec.md` — end-to-end example, `core +tdd` auth · `references/example-spec-combined.md` —
  `core +tdd +saas +ai`

**Executing and verifying**
- `references/verification.md` — evidence before claims: the gate, `_Verify:_`, `_Expect: fail_`, reason codes, pipes,
  project checks, the Stop gate, what to do without a shell
- `references/subagent-execution.md` — Phase 6 with subagents: brief → implementer → reviewer → verify the findings →
  fix loop, ledger, checkpoints, the SubagentStop gate, the simplification pass, model selection, converge mode
- `references/test-patterns.md` — naming, T-IDs in test names, `_Expect: fail_`, AAA, table-driven and property-based
  tests, the micro-cycle, anti-patterns
- `references/code-reuse-and-quality.md` — search before you write, reuse / extend / create, module boundaries, code
  smells, the simplification pass, the refactor backlog
- `references/review-feedback.md` — handling review comments against the spec · `references/red-flags.md` — the
  rationalizations that precede skipping each phase

**Per track**
- +saas: `references/scale-design-template.md` (the 5 sections, filled) · `references/saas-patterns.md` (caching,
  queues, rate limiting, idempotency, multi-tenancy) · `references/load-testing-patterns.md` (k6/Artillery)
- +ai: `references/mandatory-ai-design-sections.md` (the 10 sections, filled) · `references/eval-suite-patterns.md` ·
  `references/prompt-engineering-patterns.md` · `references/ai-cost-modeling.md` · `references/ai-safety-patterns.md` ·
  `references/model-provider-guide.md`
- +sec: `references/security-track.md` (STRIDE, ASVS, OWASP Top 10, abuse cases, local security testing)
- +privacy: `references/privacy-track.md` (GDPR / RGPD sections, data subject rights, retention, DPIA — not legal advice)
- +dist: `references/distributed-data-patterns.md` (dual writes, outbox / inbox, sagas, retries, idempotency, isolation
  levels, locking, CAP / PACELC)
- +api: `references/api-design-patterns.md` (versioning, breaking changes, problem+json, pagination, idempotency, ETag,
  rate limits, contract tests)
- +ui: `references/ui-design-patterns.md` (design system first, UI states, WCAG 2.2 AA and how to test it, i18n,
  performance budgets)
- +obs: `references/observability-patterns.md` (SLOs and burn-rate alerts, telemetry, runbooks, feature flags,
  progressive delivery, operability tests)
- +data: `references/data-pipeline-patterns.md` (data contracts and schema evolution, quality checks and quarantine,
  idempotent loads, backfills, late-arriving data, partitioning, facts / dimensions / SCD types, lineage, freshness SLAs,
  retention and cost, testing pipelines)
