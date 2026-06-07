# dev-spec-driven — agent instructions (tool-agnostic)

This file is the portable version of the dev-spec-driven workflow. Any agent tool that reads an
instructions file — **Codex CLI, Gemini CLI, Cursor, Windsurf, Copilot, Claude, Zed, Cline, …** —
can follow it. The full reference lives in `skills/dev-spec-driven/SKILL.md` and `references/`.

> **Language:** detect the user's language and respond in it (English, Português, Español),
> including the prose inside generated artifacts. Pass `--lang en|pt|es` to `dev-spec init`
> (sets the project default) and `dev-spec create` (per feature; inherits the project default) so
> the scaffolds, steering and tool messages come out already localized — you only fill the
> placeholders. Keep structural tokens stable (AC IDs like `US-1.AC-1`, task markers
> `_Requirements:_`, track names `core/+tdd/+saas/+ai`). EARS keywords work in all three:
> `SHALL`/`DEVE`/`DEBE`, `WHEN`/`QUANDO`/`CUANDO`, etc.

## What this is

Spec-driven development that scales rigor to the feature. You classify each feature into composable
**tracks**, then run an approval-gated pipeline producing traceable artifacts in `.specs/`.

| Track | Adds | Turn on when |
|---|---|---|
| **core** *(always)* | EARS requirements → design → tasks → execute | every Spec-mode feature |
| **+tdd** | test plan + failing-tests-first + red→green→refactor | correctness matters / hard to undo |
| **+saas** | performance/scale/multi-tenancy/observability/cost + load test | multi-tenant, hot path, prod scale |
| **+ai** | eval-driven dev, prompts-as-code, token economics, safety | quality depends on LLM/agent output |

Tracks combine (e.g. a billing webhook in a multi-tenant SaaS that calls an LLM = `core +tdd +saas +ai`).

## The engine: CLI and/or MCP (both local, zero-cost, no CI)

Do the mechanical steps with the bundled engine instead of hand-editing files. Two equivalent ways:

- **CLI (works anywhere):** `node bin/dev-spec.js <command>` (or `dev-spec <command>` if on PATH).
- **MCP (if your tool speaks MCP):** the `spec-driven` server exposes the same operations as tools.

Key operations (CLI form):

```
dev-spec classify "<feature description>"     # recommend tracks (multilingual, weighted)
dev-spec init [tracks...] [--lang en|pt|es]    # scaffold .specs/steering (incl. constitution.md); --lang sets the project default
dev-spec create "<name>" [tracks...] [--lang]  # scaffold the feature's artifact skeleton (inherits project lang)
dev-spec status [feature] | list               # progress, phase, tracks
dev-spec clarify <feature>                      # surface requirement gaps before design
dev-spec doctor <feature>                      # health-check → ready to advance?
dev-spec ears <feature|file.md>                # lint EARS (SHALL/DEVE/DEBE, IDs, vague words)
dev-spec trace <feature>                       # AC ↔ task ↔ test ↔ code (_Implements:_, phantom refs)
dev-spec next/done <feature> [n]               # drive execution
dev-spec approve <feature> <phase>             # record an approval gate
dev-spec roadmap                               # multi-feature roadmap: %, dependencies, cycles
dev-spec depend <feature> [deps...]            # declare dependencies / order (rejects cycles)
dev-spec scan [path]  /  dev-spec coverage     # brownfield: inventory existing code + spec coverage
dev-spec evals <feature> [--dry-run]           # run local eval harness (+ai; your API key)
dev-spec mcp-config [client]                   # print MCP config for your tool
```

## The pipeline (Spec mode)

For anything beyond a quick fix (Vibe mode = just do it, no artifacts):

0. **Classify** — `dev-spec classify` to seed tracks; confirm against `references/classification-matrix.md`; write `.specs/<feature>/classification.md`. Get user approval of the track set.
1. **Requirements** — `dev-spec create` scaffolds; write EARS criteria with stable AC IDs; run `dev-spec ears` to lint. Add track-specific ACs (tenant isolation for +saas; quality/safety/cost for +ai). Approve.
2. **Design** — base sections + the mandatory sections of the active tracks (5 for +saas, 10 for +ai). The scaffold marks each with a `> **TODO**` sentinel; replace it with real content. No blank mandatory sections. Approve.
3. **Test/Eval plan** — +tdd: enumerate tests mapped to AC IDs. +ai: golden/adversarial/regression sets + thresholds + baseline. Approve.
4. **Failing tests / eval harness** — +tdd: write tests, all red for the right reason (hard gate). +ai: deterministic tests + runnable eval harness + baseline. No implementation before this passes.
5. **Tasks** — ordered, traceable; markers `_Requirements:_` always, `_Makes green:_` (+tdd), `_Emits metrics:_` (+saas), `_Affects evals:_` (+ai). Run `dev-spec trace` — every AC must map to a task.
6. **Execute** — per task: implement-and-test (core) / red→green→refactor (+tdd) / prompt-iteration gated on eval delta (+ai). Mark done with `dev-spec done`. Before "done": load test + observability (+saas), cost + safety validation (+ai).

At each phase boundary, run `dev-spec doctor <feature>`; only advance when it reports
`readyToAdvance`. Record sign-off with `dev-spec approve <feature> <phase>`.

## Non-negotiables

- **No implementation without approval** at each gate.
- **Traceability end-to-end**: code → tasks → (tests/evals) → design → requirements → need.
- **Mandatory track sections are mandatory** — an honest "not needed because X" is fine; blank is not.
- **Everything is local. No GitHub Actions, no paid CI.** Tests/load/evals run in the user's own env.

See `skills/dev-spec-driven/references/` for EARS, scale, eval, safety, and prompt-engineering guides.
