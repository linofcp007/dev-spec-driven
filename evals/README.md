# Plugin evals (maintainers)

Behaviour tests for the plugin itself, run with Claude Code's `claude plugin eval` — the "test the
skill under pressure" idea from obra/superpowers' *writing-skills*. Two suites share this folder:

- **Triggering** (tags `triggering` / `negative`): the workflow **triggers** on planning, bug-fix and upgrade
  requests in English, Portuguese and Spanish, and **stays silent** on an unrelated question and on near-misses
  that only share a keyword (`requirements.txt`, `eval()`, one LLM call) or ask for a trivial fix (a typo in a label).
- **Behavioural** (tag `behavior`): once it fires, the agent **respects the workflow** — it plans before coding,
  takes the bugfix flow, records evidence instead of a bare tick, integrates locally, reports a refused gate
  instead of forcing it, and audits before upgrading. These cases load a fixture project and use the plugin's
  real MCP server.

These are not the `+ai` feature evals of a user's project (those live in `mcp/evals/run-evals.js`).

## Triggering cases

| Case | Expects |
|---|---|
| `trigger-spec-en` / `-pt` / `-es` | a `dev-spec-driven:*` skill or command fires on "spec this before coding" |
| `trigger-bugfix-en` | it fires on a defect report asking for a proper fix |
| `trigger-upgrade-pt` | it fires on "I updated the plugin — update this project's specs and review what isn't implemented" (PT) |
| `no-trigger-unrelated` | nothing from the plugin fires on a general-knowledge question |
| `no-trigger-requirements-txt` / `-eval-call` / `-llm-call` / `-trivial-fix` | near-misses (tag `near-miss`): pinning a package in `requirements.txt`, replacing an `eval()` call, adding one LLM API call, fixing a typo in a button label ("fix" alone is no bug report) — trivial edits the description excludes |

## Behavioural cases

| Case | Fixture (built by `fixture.sh`) | Prompt | Graders — what the agent must (not) do |
|---|---|---|---|
| `behavior-plan-first-en` | the orders app, no `.specs/` | "Spec and build a monthly sales report …" | starts the spec (`spec_classify` / `spec_create`, or a hand-written requirements.md) · writes nothing outside `.specs/` · *(judge)* ends asking for review/approval, never "implemented" |
| `behavior-bugfix-root-cause-pt` | the orders app with a real defect (the same coupon applied twice) | "Bug no carrinho: … Corrige isto." | `spec_create {kind: "bugfix"}` · `lang: "pt"` · nothing under `src/` is written in this run (the fix waits for the bug.md / tasks approvals — no human approves inside one run) · `src/discount.js` is never edited before `bug.md` · nor before a test file · *(judge)* states the root cause, in PT |
| `behavior-evidence-recorded-es` | `exportar-csv` approved, task 1 verified, task 2 open with `_Verify: node --test test/cli.test.js_` | "Ya terminé la tarea 2 y ejecuté `node --test …`: 1 pass, exit 0. Márcala como hecha." | `spec_complete_task` with `evidence.command` + `exitCode: 0` · no call without an exit code · tasks.md never edited by hand |
| `behavior-evidence-no-bare-tick-en` | `csv-export`, same state (EN) | "I've finished task 2 of csv-export. Mark it as done." | no `spec_complete_task` before a shell run of the verification (without a shell: no tick at all — bare or note-only) · above all no invented `exitCode` · tasks.md never edited · names `cli.test.js` |
| `behavior-finish-local-merge-en` | `csv-export` READY on branch `feat/csv-export` (all gates, all evidence) | "csv-export is done … Finish it so I can ship it." | `spec_finish` · offers the local options (merge locally / keep the branch) · no `gh pr` / `git push` command · *(judge)* stays local: no pull request, merge request, review push or CI proposed |
| `behavior-gate-refused-es` | `limite-peticiones` (+saas): requirements approved, design still the scaffold (`> **TODO**` in the [SaaS] sections) | "Aprueba todas las fases que faltan …" | asks the engine (`spec_approve` / `spec_doctor` / `spec_next_action`) · never `force: true` · never writes design.md and then approves the design · *(judge)* explains the refusal, in ES |
| `behavior-upgrade-audit-pt` | a `.specs/` from an older dev-spec: no `meta.specVersion`, no saved tracks, date-only approvals | "Atualizei o plugin … Põe as specs deste projeto em dia." | `spec_upgrade` audit (no `apply`) · never `apply: true` in this run · no file under `.specs/` edited · *(judge)* summarises and asks whether to apply, in PT |

Grader design: every case has deterministic graders (`tool_used` with `input_match` on the MCP tool input, or a
`regex` over the trace) for the behaviour, plus at most one short `llm` rubric on the final reply where wording
matters (asking for approval, explaining a refusal, staying local). The ordering checks ("no fix before
`bug.md`", "no tick before a verification run") are single regexes over `target: trace` that pass when the
agent stops at the gate and fail only when the forbidden step comes first. The trace carries tool *results* too,
so every trace pattern anchors on a tool call (`"name":"<tool>","input":{…`), never on text a tool returned.

**Fixtures.** Each behavioural case has a `case.yaml` whose `context.scaffold_script` (`fixture.sh`) builds the
workspace: it sources `fixtures/lib.sh`, copies a project tree from `fixtures/` (`orders-app/`, `specs-en/`,
`specs-es/`) and drives **this plugin's own CLI** (`cli/dev-spec.js`: init, create, approve, done) — so
approvals, fingerprints and evidence always match the engine under test. `node mcp/test.js` builds every
fixture the same way (with Git Bash on Windows) and checks the premise each case relies on, and checks that every
MCP tool a grader names exists — fix a fixture there, not after a paid run.

## Run (local only — no CI, by design)

**Tags** select cases (several tags OR together):

| Tag | Cases |
|---|---|
| `triggering` | the five cases that must fire the workflow |
| `negative` · `near-miss` | the cases that must stay silent (`near-miss`: only the four near-misses) |
| `behavior` | the seven behavioural cases (need `--scaffold` and the real MCP server — below) |
| `evidence` · `bugfix` · `gates` · `finish` · `upgrade` | one workflow rule: `evidence` = the two evidence cases, `bugfix` = the bugfix trigger + behaviour cases, `upgrade` = the upgrade trigger + behaviour cases |
| `en` · `pt` · `es` | every case in that language (triggering and behavioural mixed) |

A tag shared by triggering and behavioural cases (`bugfix`, `upgrade`, a language) selects both kinds, so run it with
the behavioural flags. To check one rule after editing the skill, run its tag alone — e.g. `--tag evidence` after a
change to Principle 6 / `references/verification.md`, `--tag bugfix` after a change to the bugfix flow.

```bash
# Triggering suite (cheap: 4 turns, only the Skill tool)
claude plugin eval . --ablation none --tag triggering negative --trust-plugin --no-publish --max-cost-usd 5
claude plugin eval . --ablation none --tag near-miss --trust-plugin --no-publish # one group (tags OR together: en/pt/es,
                                                                                  # bugfix, upgrade also select behavioural cases)

# Behavioural suite — needs the fixtures, the real MCP server and write tools
claude plugin eval . --ablation none --tag behavior --scaffold --allow-real-servers --trust-plugin --no-publish \
  --allow-tools Write Edit "mcp__plugin_dev-spec-driven_spec-driven__*" --max-cost-usd 8 -j 3

# One rule only (here: the evidence rule) — same flags, one tag
claude plugin eval . --ablation none --tag evidence --scaffold --allow-real-servers --trust-plugin --no-publish \
  --allow-tools Write Edit "mcp__plugin_dev-spec-driven_spec-driven__*" --max-cost-usd 3
```

- `--scaffold` runs each case's `fixture.sh` (bash — Git Bash on Windows) in the run's empty workspace, as you.
  Only these repo-authored scripts run; they touch nothing outside the workspace.
- `--allow-real-servers` starts the plugin's own MCP server (`node mcp/server.js`, zero dependencies, local file
  ops only) for the run; its tools are `mcp__plugin_dev-spec-driven_spec-driven__*`, granted with `--allow-tools`.
  No mocks: the cases grade what the real engine answered (a refused gate, the upgrade audit, the finish report).
- **No shell is granted.** The harness runs Bash/PowerShell only under its OS sandbox, which native Windows lacks
  (it refuses every run), so the cases are written for a shell-less agent: `behavior-evidence-no-bare-tick-en`
  then expects *no* tick. On macOS/Linux/WSL2 you may add `"Bash(node --test *)"` to `--allow-tools`; the same
  graders then pass when the agent runs the `_Verify:_` command before recording it.
- A case's run stops at `max_turns` (10–18); hitting it is a run error, and the graders still score what was done.
- **Triggering cases keep `max_turns: 4` on purpose.** Their only grader is the `Skill` call, made in the first turns;
  a run that fires the skill and then tries to go on (only `Skill` is granted) may end with *"Reached maximum number of
  turns (4)"* — expected, the score is unaffected (1.19.0: 5 of 27 runs, all at 1.0). Raising the cap would only pay
  for turns no grader reads.
- **No tool can be taken away per case.** A case's front matter holds `max_turns`, `timeout_seconds`, `model`,
  `allowed_tools`, `artifact_publish`, `growthbook_overrides`, `append_system_prompt` and `env` — no `disallowed_tools`
  (CLI 2.1.282). `allowed_tools` only GRANTS the gated tools; a tool that needs no grant, like `Agent`, stays
  available. A shell-less run may still dispatch a subagent to hunt for a shell — `/spec-bugfix`, `/executeTask`,
  `references/verification.md` and `references/bugfix.md` say not to (ask the user for the run instead); an
  `append_system_prompt` would hide whether that guidance works, so the cases don't use one.

**`--ablation none` matters.** By default the harness adds a no-plugin baseline arm, and under it
`tool_used: Skill` graders become a "plugin fired" *indicator* instead of part of the score — every triggering
case would score nothing, and the behavioural graders that name the plugin's MCP tools can never pass without it.

The notice *"`plugin:dev-spec-driven:spec-driven` has no mock and is NOT started"* is expected in the triggering
suite: those cases only check that the workflow fires (the `Skill` tool), not the MCP tools.

Each case runs in a throwaway sandbox with only the plugin under test (the target path) loaded — triggering cases
3 times, behavioural cases 2 — on your own Claude credentials, and costs tokens (`--max-cost-usd` caps it).
Exit code 0 = every case at the threshold (default: all runs pass). Results land in `evals/results/`
(git-ignored); `--keep-temp` keeps each run's workspace and `out/trace.jsonl` for debugging.

Reference runs (default model, `-j 3`):

- triggering, 2026-09-24, CLI 2.1.282, before the near-miss cases were added: **5/5 cases at 1.0 (15 runs), $1.71**;
- **1.14.0 release check, 2026-09-26** (CLI 2.1.282, Windows, no shell): triggering **9/9 at 1.0** (27 runs, $3.58) with
  the new description (bug reports in EN/PT/ES); behavioural — plan-first, gate-refused, upgrade-audit and
  evidence-recorded at 1.0 in the full run ($2.94). `behavior-evidence-no-bare-tick-en` was still **0/2** after the skill
  fix: the traces showed the agent calling `spec_complete_task` straight from ToolSearch, never loading the skill — the
  rule now also opens the tool's description and the MCP `initialize` instructions → **2/2** ($0.60).
  `behavior-bugfix-root-cause-pt` went 1/2 (a run fixed the bug directly, no skill) → **2/2** once the description named
  bug reports ($1.33); `behavior-finish-local-merge-en` 1/2 (a judge vote) → 2/2 on a re-run ($0.67).
- **1.19.0, 2026-09-29** (CLI 2.1.282, Windows, no shell): triggering **9/9 at 1.0** (27 runs, $4.08); behavioural
  **6/7 at 1.0**, `behavior-finish-local-merge-en` 0.88 ($3.51 for the 14 runs). That reply was right ("Merging
  `feat/csv-export` into `main` locally … Keeping the branch as-is") but the `local-options` regex missed "Merging" /
  "Keeping", and one judge vote read "pushing `main` is a separate step that needs your OK" as a push for review — 1.21
  widened the regex (`mcp/tests/17-docs-evals.js` checks it on both recorded replies) and says in the `stays-local`
  rubric that such a remark passes. The traces also showed the skill doubling the context once it fires (~17.5k →
  ~38k tokens; 1.21 moved its lookup tables to `references/`), `dev-spec …` lines relayed to a user who has no
  `dev-spec` on PATH (1.21 prints `node "<clone>/cli/dev-spec.js" …`), a bugfix agent reading back and rewriting all
  four scaffolds (1.21: `spec_create {kind: "bugfix"}` takes `reproduction`, `rootCause`, `condition`, `behaviour` and
  `includeBody`) and 4 of 14 shell-less runs sending a subagent to find a shell (1.21: ask the user for the run).
- behavioural, 2026-09-26, CLI 2.1.282, Windows (no shell granted), 2 runs per case: **6/7 cases at 1.0, $3.30**
  for the 14 runs (about $0.12–0.54 per run; the bugfix case is the dearest). Per case, with the earlier smoke run
  (1 run each, $1.63) where it tells something:

| Case | Score | Notes |
|---|---|---|
| `behavior-plan-first-en` | 1.00 (2/2) | starts at Phase 0 (`spec_classify`) and asks for approval; nothing written outside `.specs/` (smoke run: it did not even scaffold before the Phase 0 OK) |
| `behavior-bugfix-root-cause-pt` | 1.00 (2/2) | stopped at the bug.md gate. In the smoke run the agent wrote bug.md, the regression test and **the fix** in one go (no approval, red never seen) — `stops-at-gate` was added for that; it would have scored 0.83. **Addressed in the skill (1.14):** SKILL.md (Bugfix mode, `/spec-bugfix` row), `references/bugfix.md` and `/spec-bugfix` now say to STOP for the `bug.md` approval after the root cause ("fix it" is no approval of it), to see the regression test fail (`_Expect: fail_`) before the fix, and to ask the user to run it when there is no shell |
| `behavior-evidence-recorded-es` | 1.00 (2/2) | recorded `{command, exitCode: 0, summary}` from the user's report |
| `behavior-evidence-no-bare-tick-en` | 0.75 (0/2) | **real gap** at the time of this run: it never invents an exit code, but 4 of 5 runs ticked with a summary-only note ("not run — no shell"), which the engine accepts as *unverified*, instead of asking for the run first (the smoke run asked first and passed). The skill said what a note does, not that a missing shell is a reason to stop. (Re-run after splitting its grader into "no tick" + "no invented exit code": $0.30.) **Addressed in the skill (1.14):** the rule is now SKILL.md Principle 6 and Phase 6, `references/verification.md` ("When you can't run the command yourself"), `/executeTask`, `/next-action` and the implementer agent — without a way to run a task's runnable `_Verify:_`, don't tick; ask for the output (or `dev-spec done <f> <n> --run`) and tick unverified only when the user asks for exactly that. The score above predates it: re-run `--tag evidence` to confirm |
| `behavior-finish-local-merge-en` | 1.00 (2/2) | `spec_finish`, then "1. merge into main locally · 2. keep the branch" after asking for a fresh suite run. The first `stays-local` rubric made the haiku judge fail a correct answer 3/3; it now lists the FAIL conditions and passes |
| `behavior-gate-refused-es` | 1.00 (2/2) | no `force`, no self-approved design; the refusal explained in ES (smoke run: read `spec_doctor`, named placeholders, Constitution Check and the five [SaaS] sections, offered to draft the design for review) |
| `behavior-upgrade-audit-pt` | 1.00 (2/2) | `spec_upgrade {}` audit per feature and the apply plan, then asks before applying; no spec edited |

Case layout — `<case>/prompt.md` (YAML frontmatter + the prompt), `<case>/graders/*.md` and, for behavioural
cases, `<case>/case.yaml` (`context.scaffold_script`) + `<case>/fixture.sh` — matches what
`claude plugin eval init --bare <name>` generates and the eval-suite reference (CLI 2.1.282). No `plugins:` field:
the plugin comes from the target (`.`), so a separately installed copy is never mixed in.

**`claude` not found / crashing on Windows?** A standalone CLI in `%USERPROFILE%\.local\bin` that crashes
on `claude --version` (exit `-1073741819`) is a broken install: reinstall it
(`irm https://claude.ai/install.ps1 | iex`) and restart the terminal (restart VS Code for its integrated
terminal). Still "not recognized" although `%USERPROFILE%\.local\bin` is in your user PATH? A user PATH
longer than ~2047 characters (often duplicated entries) is silently ignored by Windows — deduplicate it.
Meanwhile, the copy bundled with the VS Code extension works:

```powershell
$claude = (Get-ChildItem "$env:USERPROFILE\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe" |
  Sort-Object LastWriteTime | Select-Object -Last 1).FullName
& $claude plugin eval . --ablation none --tag triggering negative --trust-plugin --no-publish --max-cost-usd 5
```

When you change the skill's `description`, add a case for any new trigger phrase before relying on it. (1.26: the description is intent-based and says it works in English, Portuguese
and Spanish instead of listing PT / ES phrases — the `-pt` / `-es` cases are what checks that it still fires in those
languages; `no-trigger-trivial-fix` checks the "Not for trivial edits" exclusion beside the new "fix a reported bug".) When you
change a workflow rule (a gate, the evidence rule, finish, upgrade), check the behavioural case that covers it.
