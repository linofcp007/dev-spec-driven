# dev-spec-driven

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node: >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![dependencies: 0](https://img.shields.io/badge/dependencies-0-success.svg)](./package.json)
[![tests: local suites](https://img.shields.io/badge/tests-local%20suites-success.svg)](./CONTRIBUTING.md#developing)
[![CI: none (local only)](https://img.shields.io/badge/CI-none%20·%20local%20only-informational.svg)](#why-no-github-actions)

**One spec-driven development skill that adapts to the project — trilingual (EN · PT · ES).**
A Claude Code **plugin** that unifies four spec-driven skills into a single track-based workflow,
bundled with its own **local, zero-dependency MCP server**. No cloud, no GitHub Actions, no
per-run cost — everything runs on your machine.

> 🌍 **Language / Idioma / Idioma:** the skill detects and mirrors the user's language (English,
> Português, Español) in the conversation **and** in the generated artifacts. EARS keywords work in
> all three (`SHALL` / `DEVE` / `DEBE`, `WHEN` / `QUANDO` / `CUANDO`, …).

**Jump to / Ir para / Ir a:** [🇬🇧 English](#english) · [🇵🇹 Português](#português) · [🇪🇸 Español](#español)

> 🧩 **Works in / Funciona em / Funciona en:** Claude Code · Claude Desktop · Claude CoWork ·
> Cursor · Windsurf · GitHub Copilot (VS Code) · Gemini CLI · OpenAI Codex CLI · any MCP client ·
> plain CLI. Three portable layers carry the workflow everywhere — a standard **MCP server**, a
> **universal `dev-spec` CLI**, and **`AGENTS.md`** instructions. See **[INTEGRATIONS.md](./INTEGRATIONS.md)**
> or run `node cli/dev-spec.js mcp-config all`. No GitHub Actions, no cost.

---

## English

### One skill, composable tracks

Instead of choosing between four overlapping skills, you get **one** skill that classifies each
feature and composes exactly the rigor it needs:

| Track | Adds |
|---|---|
| **core** *(always)* | EARS requirements → design → tasks → execute, approval-gated |
| **+tdd** | Test plan + failing-tests-first + red→green→refactor |
| **+saas** | Performance/scale/multi-tenancy/observability/cost + load testing |
| **+ai** | Eval-driven dev, prompts-as-code, token economics, safety, model lifecycle |

Tracks **combine**. A Stripe webhook in a multi-tenant SaaS that also summarizes invoices with an
LLM is `core +tdd +saas +ai`. A copy tweak is Vibe mode: no ceremony at all. A **Phase 0
classifier** (the local `spec_classify` tool, multilingual) picks the track set; you approve it. The
chosen tracks are stored with the feature, and a track can be added or turned off later.

### The local MCP server (`spec-driven`) — 29 tools

Pure Node core — **no `npm install`, no network, no cost.** Tools:

| Tool | Does |
|---|---|
| `spec_classify` | Recommend tracks from a description (multilingual keyword heuristic, weighted) |
| `spec_init` | Scaffold `.specs/steering/` for the tracks; `lang` sets the project language, `guard` turns guard mode on/off |
| `spec_create` | Scaffold a feature folder for the active tracks (`kind: "bugfix"` for the bugfix flow, `brownfield: true` adds `integration-plan.md`) |
| `spec_import` | Import a Kiro, spec-kit or OpenSpec spec as a new feature (IDs remapped to `US-N.AC-M`, tasks renumbered) |
| `spec_list` / `spec_status` | Inspect features, phases, task progress, sections filled vs. present |
| `spec_next_task` / `spec_complete_task` | Drive execution and tick tasks — with recorded **verification evidence** (a failed run refuses the tick and is recorded); `batch` for parallel `[P]` tasks |
| `spec_task_brief` | Self-contained brief for one task — ACs and tests resolved to their spec text, design context, scoped steering, definition of done (the basis of subagent execution) |
| `spec_append_tasks` | Converge: append follow-up tasks under `Phase: Convergence` without renumbering the existing ones |
| `spec_finish` | Close a feature: blockers, warnings, fresh checks to run, and a merge summary generated from the spec chain; `write` also records the drift baseline |
| `spec_next_action` | "You are here → do this next", phase by phase: re-review → fill → fix → approve (the next phase only after that approval) → implement → verify → finish (then finished / drift) |
| `spec_approve` | Approve a phase gate — refused while that phase's checks fail (`force` records a flagged, forced approval); every approval is kept in a history with a snapshot |
| `spec_impact` | What an edit after approval touches (changed ACs, sections, tasks → tasks, tests, design); `reopen` unticks the affected done tasks (never a removed criterion's — `retire` lists those) |
| `spec_add_track` / `spec_feature` | Add a track (additive; `remove:true` turns one off, files kept) / archive · restore · rename · remove a feature (remove needs `confirm:true`) |
| `ears_validate` | Lint requirements (SHALL/DEVE/DEBE, stable IDs, vague words, template placeholders — EN/PT/ES) |
| `trace_check` | Every AC covered by a task (and a test on +tdd); phantom refs; EC/NFR/SC warnings; `code:true` finds T-IDs in test files |
| `spec_doctor` | One health-check → "ready to advance?" (EARS, placeholders, trace, sections, evidence, gates, steering) |
| `spec_clarify` | Surface requirement ambiguities/gaps before design |
| `spec_metrics` | Lead times, rework, forced approvals, change requests, evidence pass rate; `write` creates a pre-filled `retro.md` |
| `spec_catalog` | Living catalog of every feature's ACs, superseded ones marked (`_Supersedes:_`); `write` → `.specs/SPECS.md` |
| `spec_drift` | Implementing files changed, missing or new since `spec_finish` recorded its baseline |
| `spec_roadmap` / `spec_depend` | Roadmap + dependencies (cycle-checked; `add` / `remove` edit the list); `write:true` → `.specs/ROADMAP.md` (+ `html:true` for a brand-styled offline `.html`, `lang`) |
| `spec_backlog` | Track planned-but-unspecced features (shown in ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventory an existing codebase (routes, tests, entrypoints, env var names, migrations) + the share of code files named in `_Implements:_` |
| `steering_scaffold` | Create one steering file from its template (incl. `constitution.md`), or a custom scoped one |

### Subagent-driven execution (opt-in)

`/executeTask <feature> --subagents` keeps the main session's context for coordination: per task it
writes a brief (`spec_task_brief`), dispatches the plugin's **`dev-spec-driven:spec-implementer`** agent, sends the diff
to the **`dev-spec-driven:spec-reviewer`** agent (verdict per AC ID + quality + track checks), runs a fix loop of at most
5 rounds, and only then ticks the task. It runs on its own within a story, stops at every
`**Checkpoint:**` for your review, and never changes an AC, the design or a test without going back to
that phase. It uses about 2–3× the tokens of inline execution, so it is worth it on features with ~6+
independent tasks. Protocol: `skills/dev-spec-driven/references/subagent-execution.md`. Adapted from the
`subagent-driven-development` skill of [obra/superpowers](https://github.com/obra/superpowers) (MIT).

### Gates and evidence

- **An approval is a gate, not a stamp.** `spec_approve` runs that phase's checks first (EARS errors,
  template placeholders, open `[NEEDS CLARIFICATION]`, missing sections, uncovered ACs, …; Phase 4 `tests`: every
  planned T-ID in a test file / an eval set of the feature's own; `execution`: `spec_finish`'s blockers) and refuses
  while any fails. `force: true` (CLI `--force`) records it anyway as a **forced** approval with the
  failing checks, and `doctor` and the roadmap keep flagging it.
- **A template is not content.** `doctor` has a `placeholders` check (it fails for the current and
  earlier phases), a fresh feature starts at phase `requirements`, and `ears_validate` reports a
  `placeholder` code. A bracket counts only when its text is one the templates write (or TODO / TBD / FIXME / `…`):
  real values such as `[free: 60, pro: 600]` or `[admin, billing-manager]` are your content.
- **`next_action` goes phase by phase:** re-review → for the first phase not approved yet, fill → fix → approve (the
  next phase only after that approval — the design is never asked for before the requirements are approved, and
  `approve` refuses a phase while an earlier one is unapproved) → implement → verify → finish. It never
  recommends an approval the gate would refuse; it names what the gate fails on instead — nor `spec_finish` while a
  ticked task is unverified (`verify` names it and its `dev-spec done <f> <n> --run`). On +tdd / +ai, Phase 4
  (failing tests / eval harness, `approve <f> tests`) is a gate it asks for before any task is implemented.
- **Evidence before claims.** Tasks declare `_Verify: <command>_`; `spec_complete_task` records the
  command, exit code and output summary, and refuses the tick on a failure. A task with a runnable
  `_Verify:_` counts as verified only with the command and exit code 0 — a text note ticks it but leaves
  it unverified. Failed runs are kept in a short history, and a task reopened after a spec change has
  **stale** evidence until it is re-run. `spec_complete_task` returns a stable reason code
  (`unverifiedReason`: `failed-run`, `manual-note-on-runnable-verify`, `duplicate-number`,
  `stale-evidence`, `no-evidence`); `doctor`, `spec_finish` and the `ROADMAP.md` "Needs attention" line
  list each unverified task with a localized reason. CLI: `dev-spec done <feature> <n> --run`.
- **`/spec-bugfix`** — a light spec for a defect: reproduce → **root cause with evidence** → failing
  regression test → fix → verify. `doctor` fails until the root cause is written, and the tasks after the
  root-cause task can't be completed before that.
- **`/spec-finish`** — blocks on doctor failures, an artifact changed since its approval, placeholders
  anywhere in the chain, open or unverified tasks and pending gates; lists the checks to run fresh and
  builds a merge summary from the spec (ACs, tasks with their evidence, root cause/fix). Then merge
  locally or keep the branch — no pull requests, no CI.
- **`/spec-review-feedback`** — review comments classified against the spec: fix AC violations, route
  spec changes back to their phase, push back on out-of-scope asks.
- **`/spec-doctor --deep`** — a `spec-critic` agent reviews the *meaning* of a spec at its gate.
- **Bounded mode** between Vibe and Spec (short design in chat + an explicit yes), **Global
  Constraints** inlined into every task brief, **parallel `[P]` tasks** in separate worktrees, and
  **plugin evals** (`evals/`, `claude plugin eval`) that check the skill triggers in EN/PT/ES.
  These ideas are adapted from [obra/superpowers](https://github.com/obra/superpowers) (MIT).

### Change management

- **Approval history.** Every approval is appended to `.state.json` (`approvalHistory`) and saves a
  snapshot of what it signed off to `.specs/<feature>/.history/<phase>@<n>.md` — commit it with the spec.
- **`/spec-impact`** (`spec_impact`) — after an approved artifact changes, it diffs the edit against
  that snapshot: added / modified / removed ACs (and SC/EC/NFR IDs), design sections or tasks, and for
  each one the tasks that cite it (done or open, with their evidence), the tests covering it and the
  design sections that mention it. `reopen` unticks the affected done tasks, marks their evidence stale
  and records the change request — never the tasks of a removed criterion: `retire` lists them (and their
  test rows) to delete or point at the criterion that replaces it. It never edits your requirements or design.
- **`/spec-converge`** (`spec_append_tasks`) — when implementation drifted from the plan or a review
  found follow-up work, append new tasks (numbered after the last, under `Phase: Convergence`) with
  their `_Requirements:_`, `_Implements:_` and `_Verify:_`. Unknown AC IDs are refused, existing tasks are
  never touched, and an approved task list asks for re-approval.

### Living catalog, drift and restore

- **`/spec-catalog`** (`spec_catalog`) — "what the system does today": every feature (active,
  finished, archived) with each AC as one EARS line. A criterion replaced by a later feature declares it
  with `_Supersedes: <feature>/US-n.AC-m_` and the old one is shown as superseded. `write` generates
  `.specs/SPECS.md` (never over a hand-written file), refreshed with the roadmap from then on.
- **`/spec-drift`** (`spec_drift`) — `spec_finish` with `write` on a ready feature records a hash of every
  file its `_Implements:_` markers name; drift reports the files changed, missing or new since then. The
  SessionStart hook adds one line per drifted feature.
- **Restore** — `spec_feature archive` records the dependencies it prunes, and `restore` brings the
  feature back with its roadmap entry and those dependencies.

### Guard mode and scoped steering

- **`/spec-guard`** — opt-in guard mode (`spec_init {guard: true}` / `dev-spec init --guard on|off`).
  While it is on, a Claude Code PreToolUse hook **asks before** a Write/Edit on a code file outside
  `.specs/` when no feature has approved, unfinished tasks. It is silent when off and never blocks on its
  own errors. Other tools don't run Claude Code hooks, so there the guard does nothing.
- **Scoped steering** — steering files take Kiro-compatible front matter: `inclusion: always`,
  `fileMatch` (with `fileMatchPattern: "src/api/**"`) or `manual`. `steering_scaffold` creates custom
  files such as `api-conventions.md`, and each task brief includes the files whose pattern matches the
  task's `_Implements:_` paths.

### Brownfield, import and metrics

- **Deeper scan** — `spec_scan` lists HTTP routes with method, path and `file:line` (Express, NestJS,
  Next.js, FastAPI, Flask, Django, Spring, ASP.NET, Rails, Laravel, Go …), test frameworks, entrypoints,
  environment variable **names** (never values) and migration files. `spec_coverage` measures the share of
  code files named in any `_Implements:_` marker, per folder. `create --brownfield` adds an
  `integration-plan.md`.
- **`/spec-import`** (`spec_import`) — bring a Kiro (`.kiro/specs/<name>/`), spec-kit
  (`specs/<nnn-name>/`) or OpenSpec (`openspec/specs/<capability>/` or a change folder) spec in as a new
  feature: criteria become `US-N.AC-M` EARS lines (or keep their text with `[NEEDS CLARIFICATION]`),
  tasks are renumbered with their checkbox state. The source must be inside the project and is only read.
- **Deeper traceability** — `trace_check` warns about edge cases (EC-n), NFRs and success criteria
  (SC-nnn) nothing covers; `--code` looks for T-IDs in test names (`test("T-01 …")`, `def test_T01_…`).
  Test plans have a **Kind** column (`example` | `property`) with property-based testing guidance.
- **`/spec-metrics`** (`spec_metrics`) — lead time per phase, rework, forced approvals, change requests
  and evidence pass rate, per feature or for the project; `write` creates a pre-filled `retro.md`.

### Local automation, not CI

- **Hooks** (`hooks/hooks.json`): on saving `requirements.md` → EARS lint + placeholders; on saving
  `tasks.md` → traceability check; on saving `design.md` → the active tracks' mandatory sections; at
  session start → feature status + drift. The opt-in guard runs before code edits. Plus an optional git
  `pre-commit` validator.
- **Eval harness** (`mcp/evals/run-evals.js`): runs golden/adversarial/regression sets with **your
  own `ANTHROPIC_API_KEY`**; `--dry-run` validates offline, `--set-baseline` records a baseline.

### Quick start

Install from GitHub (recommended — works on any machine, no paths to edit):

```text
/plugin marketplace add linofcp007/dev-spec-driven
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

Or clone and load it for one session:

```bash
git clone https://github.com/linofcp007/dev-spec-driven.git
claude --plugin-dir ./dev-spec-driven
```

Then describe a feature (the skill auto-triggers in your language) or drive it explicitly:

```
/dev-spec-driven:spec  Add per-tenant API keys with rotation and Stripe-metered usage
```

### Commands (42)

`/spec` · `/spec-init` · `/classify` · `/createSpec` · `/clarify` · `/design` · `/testPlan` ·
`/evalPlan` · `/grill` · `/writeTests` · `/createTask` · `/executeTask [--subagents]` · `/spec-doctor` · `/approve` ·
`/next-action` · `/add-track` · `/feature` · `/eval` · `/roadmap` · `/depend` · `/backlog` ·
`/scan` · `/reverse` · `/coverage` · `/spec-status` · `/spec-commit` · `/spec-bugfix` · `/spec-finish` · `/spec-review-feedback` · `/prReview` · `/promptReview` ·
`/migrateModel` — aliases `/ds` `/dsx` `/dss`.
New in 1.13: `/spec-impact` · `/spec-metrics` · `/spec-converge` · `/spec-import` · `/spec-catalog` ·
`/spec-drift` · `/spec-guard`.
(As a plugin they are namespaced, e.g. `/dev-spec-driven:design`.)

### The `dev-spec` CLI

The same engine from any terminal (`node cli/dev-spec.js <command>`, or `dev-spec` on PATH); `--json`
prints the raw result, and `help` lists every flag:

```text
classify · init [--guard on|off] · steering · create [--brownfield] · bugfix · import · list · status
doctor · trace [--code] · clarify · ears · next [--batch] · next-action · brief · done [--run]
append-tasks · approve [--force] · impact [--reopen] · metrics [--write] · finish [--write]
add-track [--remove] · feature <remove|archive|rename|restore> · catalog [--write] · drift
roadmap · depend · backlog · scan · coverage · evals · mcp-config <client> · rules <tool>
```

### Why no GitHub Actions

By design. Every gate — EARS linting, traceability, classification, status, task tracking — runs
**locally** through the bundled MCP server and the model. Your tests, load tests, and eval harnesses
run in your own environment when you choose, not on a paid CI runner.

### Develop / test

```bash
node mcp/test.js          # smoke-test the MCP server end-to-end (must end `0 failed`)
node cli/test-cli.js      # smoke-test the universal CLI (must end `0 failed`)
```

> Replaces four predecessor skills; their content lives here as composable tracks (the originals
> remain in git history and the v1.8.0 release if you ever need them).
> MIT licensed.

---

## Português

### Uma skill, tracks que se combinam

Em vez de escolher entre quatro skills sobrepostas, tens **uma** skill que classifica cada
funcionalidade e compõe exatamente o rigor necessário:

| Track | Acrescenta |
|---|---|
| **core** *(sempre)* | Requisitos EARS → design → tarefas → execução, com gates de aprovação |
| **+tdd** | Plano de testes + testes-a-falhar-primeiro + red→green→refactor |
| **+saas** | Desempenho/escala/multi-inquilino/observabilidade/custo + testes de carga |
| **+ai** | Desenvolvimento guiado por evals, prompts como código, economia de tokens, segurança, ciclo de vida do modelo |

Os tracks **combinam-se**. Um webhook do Stripe num SaaS multi-inquilino que também resume faturas
com um LLM é `core +tdd +saas +ai`. Uma alteração de texto é modo Vibe: sem cerimónia. Um
**classificador de Fase 0** (a ferramenta local `spec_classify`, multilíngue) escolhe os tracks; tu
aprovas. Os tracks escolhidos ficam guardados com a funcionalidade, e é possível acrescentar ou desligar
um track mais tarde.

### O servidor MCP local (`spec-driven`) — 29 ferramentas

Apenas Node nativo — **sem `npm install`, sem rede, sem custo.** Ferramentas:

| Ferramenta | O que faz |
|---|---|
| `spec_classify` | Recomenda tracks a partir de uma descrição (heurística multilíngue, com peso) |
| `spec_init` | Cria `.specs/steering/` para os tracks; `lang` define a língua do projeto, `guard` liga/desliga o modo guarda |
| `spec_create` | Cria a pasta da funcionalidade para os tracks ativos (`kind: "bugfix"` para o fluxo de bugfix, `brownfield: true` acrescenta `integration-plan.md`) |
| `spec_import` | Importa uma spec do Kiro, spec-kit ou OpenSpec como nova funcionalidade (IDs convertidos para `US-N.AC-M`, tarefas renumeradas) |
| `spec_list` / `spec_status` | Inspeciona funcionalidades, fases, progresso, secções preenchidas vs. presentes |
| `spec_next_task` / `spec_complete_task` | Conduz a execução e marca tarefas — com **evidência de verificação** registada (uma execução falhada recusa a marcação e fica registada); `batch` para tarefas paralelas `[P]` |
| `spec_task_brief` | Brief autocontido de uma tarefa — ACs e testes resolvidos para o texto da spec, contexto do design, steering com âmbito, definição de concluído (a base da execução com subagentes) |
| `spec_append_tasks` | Convergência: acrescenta tarefas de seguimento em `Fase: Convergência` sem renumerar as existentes |
| `spec_finish` | Fecha uma funcionalidade: bloqueios, avisos, verificações a correr de novo e um resumo de merge gerado a partir da cadeia da spec; `write` regista também a baseline de drift |
| `spec_next_action` | "Estás aqui → faz isto a seguir", fase a fase: rever → preencher → corrigir → aprovar (a fase seguinte só depois dessa aprovação) → implementar → verificar → fechar (depois fechada / deriva) |
| `spec_approve` | Aprova um gate de fase — recusado enquanto as verificações dessa fase falham (`force` regista uma aprovação forçada e assinalada); cada aprovação fica num histórico com snapshot |
| `spec_impact` | O que uma edição depois da aprovação afeta (ACs, secções, tarefas alteradas → tarefas, testes, design); `reopen` desmarca as tarefas feitas afetadas (nunca as de um critério removido — `retire` lista-as) |
| `spec_add_track` / `spec_feature` | Acrescenta um track (aditivo; `remove:true` desliga um, sem apagar ficheiros) / arquiva · restaura · renomeia · remove uma funcionalidade (remover exige `confirm:true`) |
| `ears_validate` | Valida requisitos (SHALL/DEVE/DEBE, IDs estáveis, palavras vagas, placeholders do template — EN/PT/ES) |
| `trace_check` | Cada AC coberto por uma tarefa (e um teste em +tdd); referências fantasma; avisos de EC/NFR/SC; `code:true` procura T-IDs nos ficheiros de teste |
| `spec_doctor` | Um health-check → "pronto para avançar?" (EARS, placeholders, trace, secções, evidência, gates, steering) |
| `spec_clarify` | Expõe ambiguidades/lacunas dos requisitos antes do design |
| `spec_metrics` | Lead times, retrabalho, aprovações forçadas, pedidos de alteração, taxa de sucesso da evidência; `write` cria um `retro.md` pré-preenchido |
| `spec_catalog` | Catálogo vivo dos ACs de todas as funcionalidades, com os substituídos assinalados (`_Supersedes:_`); `write` → `.specs/SPECS.md` |
| `spec_drift` | Ficheiros de implementação alterados, em falta ou novos desde que o `spec_finish` registou a baseline |
| `spec_roadmap` / `spec_depend` | Roadmap + dependências (deteta ciclos; `add` / `remove` editam a lista); `write:true` → `.specs/ROADMAP.md` (+ `html:true` para o `.html` com a marca, offline, claro/escuro; `lang`) |
| `spec_backlog` | Regista funcionalidades planeadas mas ainda sem spec (aparecem no ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventário de código existente (rotas, testes, pontos de entrada, nomes de variáveis de ambiente, migrações) + a parte dos ficheiros de código indicados em `_Implements:_` |
| `steering_scaffold` | Cria um ficheiro de steering a partir do template (incl. `constitution.md`), ou um ficheiro personalizado com âmbito |

### Execução com subagentes (opcional)

`/executeTask <feature> --subagents` guarda o contexto da sessão principal para a coordenação: por tarefa
escreve um brief (`spec_task_brief`), despacha o agente **`dev-spec-driven:spec-implementer`** do plugin,
envia o diff ao agente **`dev-spec-driven:spec-reviewer`** (veredicto por AC ID + qualidade + verificações do
track), faz um ciclo de correções de no máximo 5 rondas e só depois marca a tarefa. Avança sozinho dentro de
uma história, para em cada `**Checkpoint:**` para a tua revisão e nunca muda um AC, o design ou um teste sem
voltar a essa fase. Gasta cerca de 2–3× os tokens da execução inline, por isso compensa em funcionalidades
com ~6+ tarefas independentes. Protocolo: `skills/dev-spec-driven/references/subagent-execution.md`.

### Gates e evidência

- **Uma aprovação é um gate, não um carimbo.** `spec_approve` corre primeiro as verificações da fase (erros
  EARS, placeholders do template, `[NEEDS CLARIFICATION]` por resolver, secções em falta, ACs sem cobertura,
  …; a Fase 4 `tests`: cada T-ID planeado num ficheiro de teste / um conjunto de evals próprio; `execution`: os
  bloqueios do `spec_finish`) e recusa enquanto alguma falhar. `force: true` (CLI `--force`) regista-a na mesma como aprovação
  **forçada**, com as verificações que falharam, e o `doctor` e o roadmap continuam a assinalá-la.
- **Um template não é conteúdo.** O `doctor` tem a verificação `placeholders` (falha na fase atual e nas
  anteriores), uma funcionalidade nova começa na fase `requirements` e o `ears_validate` reporta o código
  `placeholder`. Um parêntese reto só conta quando o texto é um dos que os templates escrevem (ou TODO / TBD / FIXME /
  `…`): valores reais como `[free: 60, pro: 600]` ou `[admin, billing-manager]` são conteúdo teu.
- **O `next_action` avança fase a fase:** rever → na primeira fase ainda por aprovar, preencher → corrigir → aprovar (a
  fase seguinte só depois dessa aprovação — nunca pede o design antes de os requisitos estarem aprovados, e o `approve`
  recusa uma fase enquanto uma anterior estiver por aprovar) → implementar → verificar → fechar. Nunca
  recomenda uma aprovação que o gate recusaria; em vez disso, diz em que falha — nem o `spec_finish` enquanto houver
  uma tarefa marcada por verificar (o passo `verify` nomeia-a com o seu `dev-spec done <f> <n> --run`). Em +tdd / +ai, a Fase 4
  (testes a falhar / harness de evals, `approve <f> tests`) é um gate que pede antes de implementar qualquer tarefa.
- **Evidência antes de afirmações.** As tarefas declaram `_Verify: <comando>_`; `spec_complete_task` regista
  o comando, o código de saída e um resumo, e recusa a marcação quando falha. Uma tarefa com um `_Verify:_`
  executável só fica verificada com o comando e o código de saída 0 — uma nota de texto marca-a, mas deixa-a
  por verificar. As execuções falhadas ficam num histórico curto, e uma tarefa reaberta depois de uma
  alteração à spec fica com evidência **desatualizada** até voltar a correr. O `spec_complete_task` devolve um
  código de motivo estável (`unverifiedReason`: `failed-run`, `manual-note-on-runnable-verify`,
  `duplicate-number`, `stale-evidence`, `no-evidence`); o `doctor`, o `spec_finish` e a linha "Precisa de
  atenção" do `ROADMAP.md` listam cada tarefa por verificar com o motivo. CLI:
  `dev-spec done <feature> <n> --run`.
- **`/spec-bugfix`** — uma spec leve para um defeito: reproduzir → **causa raiz com evidência** → teste de
  regressão a falhar → correção → verificação. O `doctor` falha até a causa raiz estar escrita, e as tarefas
  depois da tarefa da causa raiz não podem ser concluídas antes disso.
- **`/spec-finish`** — bloqueia com falhas do doctor, um artefacto alterado depois da aprovação, placeholders
  em qualquer ponto da cadeia, tarefas abertas ou por verificar e gates pendentes; lista as verificações a
  correr de novo e constrói um resumo de merge a partir da spec. Depois fazes o merge localmente ou manténs o
  branch — sem pull requests, sem CI.
- **`/spec-review-feedback`** — comentários de revisão avaliados contra a spec. **`/spec-doctor --deep`** —
  o agente `spec-critic` revê o *significado* da spec no respetivo gate.

### Gestão de alterações

- **Histórico de aprovações.** Cada aprovação é acrescentada ao `.state.json` (`approvalHistory`) e guarda um
  snapshot do que aprovou em `.specs/<feature>/.history/<fase>@<n>.md` — faz commit dele com a spec.
- **`/spec-impact`** (`spec_impact`) — depois de um artefacto aprovado mudar, compara a edição com esse
  snapshot: ACs (e IDs SC/EC/NFR), secções do design ou tarefas acrescentados, alterados ou removidos e, para
  cada um, as tarefas que o citam (feitas ou abertas, com a evidência), os testes que o cobrem e as secções do
  design que o mencionam. `reopen` desmarca as tarefas feitas afetadas, marca a evidência como desatualizada
  e regista o pedido de alteração — nunca as tarefas de um critério removido: o `retire` lista-as (e as linhas
  de teste) para apagar ou apontar para o critério que o substitui. Nunca edita os teus requisitos nem o design.
- **`/spec-converge`** (`spec_append_tasks`) — quando a implementação se afastou do plano ou uma revisão
  encontrou trabalho de seguimento, acrescenta tarefas novas (numeradas depois da última, em
  `Fase: Convergência`) com `_Requirements:_`, `_Implements:_` e `_Verify:_`. IDs de AC desconhecidos são
  recusados, as tarefas existentes nunca mudam e uma lista de tarefas já aprovada pede nova aprovação.

### Catálogo vivo, drift e restauro

- **`/spec-catalog`** (`spec_catalog`) — "o que o sistema faz hoje": todas as funcionalidades (ativas,
  terminadas, arquivadas) com cada AC numa linha EARS. Um critério substituído por uma funcionalidade
  posterior é declarado com `_Supersedes: <feature>/US-n.AC-m_` e o antigo aparece como substituído. `write`
  gera `.specs/SPECS.md` (nunca por cima de um ficheiro escrito à mão), atualizado com o roadmap a partir daí.
- **`/spec-drift`** (`spec_drift`) — o `spec_finish` com `write` numa funcionalidade pronta regista um hash de
  cada ficheiro indicado nos marcadores `_Implements:_`; o drift reporta os ficheiros alterados, em falta ou
  novos desde então. O hook de SessionStart acrescenta uma linha por cada funcionalidade com drift.
- **Restauro** — `spec_feature archive` regista as dependências que remove, e `restore` traz a
  funcionalidade de volta com a entrada no roadmap e essas dependências.

### Modo guarda e steering com âmbito

- **`/spec-guard`** — modo guarda opcional (`spec_init {guard: true}` / `dev-spec init --guard on|off`).
  Enquanto está ligado, um hook PreToolUse do Claude Code **pergunta antes** de um Write/Edit num ficheiro de
  código fora de `.specs/` quando nenhuma funcionalidade tem tarefas aprovadas por terminar. Fica em silêncio
  quando desligado e nunca bloqueia por erros próprios. As outras ferramentas não correm hooks do Claude
  Code, por isso aí o modo guarda não faz nada.
- **Steering com âmbito** — os ficheiros de steering aceitam front matter compatível com o Kiro:
  `inclusion: always`, `fileMatch` (com `fileMatchPattern: "src/api/**"`) ou `manual`. O `steering_scaffold`
  cria ficheiros personalizados como `api-conventions.md`, e cada brief de tarefa inclui os ficheiros cujo
  padrão corresponde aos caminhos `_Implements:_` da tarefa.

### Brownfield, importação e métricas

- **Análise mais funda** — o `spec_scan` lista rotas HTTP com método, caminho e `ficheiro:linha` (Express,
  NestJS, Next.js, FastAPI, Flask, Django, Spring, ASP.NET, Rails, Laravel, Go …), frameworks de teste,
  pontos de entrada, **nomes** de variáveis de ambiente (nunca os valores) e ficheiros de migração. O
  `spec_coverage` mede a parte dos ficheiros de código indicados num marcador `_Implements:_`, por pasta.
  `create --brownfield` acrescenta um `integration-plan.md`.
- **`/spec-import`** (`spec_import`) — traz uma spec do Kiro (`.kiro/specs/<name>/`), do spec-kit
  (`specs/<nnn-name>/`) ou do OpenSpec (`openspec/specs/<capability>/` ou uma pasta de change) como nova
  funcionalidade: os critérios passam a linhas EARS `US-N.AC-M` (ou mantêm o texto com
  `[NEEDS CLARIFICATION]`) e as tarefas são renumeradas com o estado das checkboxes. A origem tem de estar
  dentro do projeto e só é lida.
- **Rastreabilidade mais funda** — o `trace_check` avisa sobre casos-limite (EC-n), NFRs e critérios de
  sucesso (SC-nnn) sem cobertura; `--code` procura T-IDs nos nomes dos testes (`test("T-01 …")`,
  `def test_T01_…`). Os planos de testes têm uma coluna **Tipo** (Kind: `example` | `property`) com orientação
  para testes baseados em propriedades.
- **`/spec-metrics`** (`spec_metrics`) — lead time por fase, retrabalho, aprovações forçadas, pedidos de
  alteração e taxa de sucesso da evidência, por funcionalidade ou para o projeto; `write` cria um `retro.md`
  pré-preenchido.

### Automação local, sem CI

- **Hooks** (`hooks/hooks.json`): ao gravar `requirements.md` → valida EARS + placeholders; ao gravar
  `tasks.md` → verifica a rastreabilidade; ao gravar `design.md` → as secções obrigatórias dos tracks ativos;
  no arranque da sessão → estado das funcionalidades + drift. O modo guarda opcional corre antes das edições
  de código. Mais um validador `pre-commit` opcional do git.
- **Harness de evals** (`mcp/evals/run-evals.js`): corre os conjuntos golden/adversarial/regression
  com a **tua própria `ANTHROPIC_API_KEY`**; `--dry-run` valida offline, `--set-baseline` grava uma
  baseline.

### Começar rápido

Instala a partir do GitHub (recomendado — funciona em qualquer máquina, sem caminhos para editar):

```text
/plugin marketplace add linofcp007/dev-spec-driven
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

Ou clona e carrega-o só para uma sessão:

```bash
git clone https://github.com/linofcp007/dev-spec-driven.git
claude --plugin-dir ./dev-spec-driven
```

Depois descreve uma funcionalidade (a skill ativa-se na tua língua) ou conduz explicitamente:

```
/dev-spec-driven:spec  Adicionar chaves de API por inquilino com rotação e uso medido pelo Stripe
```

### Comandos (42)

`/spec` · `/spec-init` · `/classify` · `/createSpec` · `/clarify` · `/design` · `/testPlan` ·
`/evalPlan` · `/grill` · `/writeTests` · `/createTask` · `/executeTask [--subagents]` · `/spec-doctor` · `/approve` ·
`/next-action` · `/add-track` · `/feature` · `/eval` · `/roadmap` · `/depend` · `/backlog` ·
`/scan` · `/reverse` · `/coverage` · `/spec-status` · `/spec-commit` · `/spec-bugfix` · `/spec-finish` · `/spec-review-feedback` · `/prReview` · `/promptReview` ·
`/migrateModel` — atalhos `/ds` `/dsx` `/dss`.
Novos na 1.13: `/spec-impact` · `/spec-metrics` · `/spec-converge` · `/spec-import` · `/spec-catalog` ·
`/spec-drift` · `/spec-guard`.
(Como plugin, têm namespace, ex.: `/dev-spec-driven:design`.)

### A CLI `dev-spec`

O mesmo motor em qualquer terminal (`node cli/dev-spec.js <comando>`, ou `dev-spec` no PATH); `--json`
mostra o resultado em bruto e `help` lista todas as opções:

```text
classify · init [--guard on|off] · steering · create [--brownfield] · bugfix · import · list · status
doctor · trace [--code] · clarify · ears · next [--batch] · next-action · brief · done [--run]
append-tasks · approve [--force] · impact [--reopen] · metrics [--write] · finish [--write]
add-track [--remove] · feature <remove|archive|rename|restore> · catalog [--write] · drift
roadmap · depend · backlog · scan · coverage · evals · mcp-config <client> · rules <tool>
```

### Porque não há GitHub Actions

De propósito. Todos os gates — validação EARS, rastreabilidade, classificação, estado, tarefas —
correm **localmente** através do servidor MCP e do modelo. Os testes, testes de carga e evals correm
no teu ambiente quando quiseres, não num runner de CI pago.

### Desenvolver / testar

```bash
node mcp/test.js          # testa o servidor MCP de ponta a ponta (tem de terminar em `0 failed`)
node cli/test-cli.js      # testa a CLI universal (tem de terminar em `0 failed`)
```

> Substitui quatro skills antecessoras; o conteúdo vive aqui como tracks componíveis (os originais
> ficam no histórico git e na release v1.8.0, se algum dia precisares).
> Licença MIT.

---

## Español

### Una skill, tracks que se combinan

En lugar de elegir entre cuatro skills solapadas, tienes **una** skill que clasifica cada función y
compone exactamente el rigor necesario:

| Track | Añade |
|---|---|
| **core** *(siempre)* | Requisitos EARS → diseño → tareas → ejecución, con gates de aprobación |
| **+tdd** | Plan de pruebas + pruebas-en-rojo-primero + red→green→refactor |
| **+saas** | Rendimiento/escala/multiinquilino/observabilidad/coste + pruebas de carga |
| **+ai** | Desarrollo guiado por evals, prompts como código, economía de tokens, seguridad, ciclo de vida del modelo |

Los tracks **se combinan**. Un webhook de Stripe en un SaaS multiinquilino que además resume
facturas con un LLM es `core +tdd +saas +ai`. Un cambio de texto es modo Vibe: sin ceremonia. Un
**clasificador de Fase 0** (la herramienta local `spec_classify`, multilingüe) elige los tracks; tú
apruebas. Los tracks elegidos se guardan con la función, y se puede añadir o desactivar un track más
adelante.

### El servidor MCP local (`spec-driven`) — 29 herramientas

Solo Node nativo — **sin `npm install`, sin red, sin coste.** Herramientas:

| Herramienta | Qué hace |
|---|---|
| `spec_classify` | Recomienda tracks desde una descripción (heurística multilingüe, ponderada) |
| `spec_init` | Crea `.specs/steering/` para los tracks; `lang` fija el idioma del proyecto, `guard` activa/desactiva el modo guardia |
| `spec_create` | Crea la carpeta de la función para los tracks activos (`kind: "bugfix"` para el flujo de bugfix, `brownfield: true` añade `integration-plan.md`) |
| `spec_import` | Importa una spec de Kiro, spec-kit u OpenSpec como función nueva (IDs convertidos a `US-N.AC-M`, tareas renumeradas) |
| `spec_list` / `spec_status` | Inspecciona funciones, fases, progreso, secciones completadas vs. presentes |
| `spec_next_task` / `spec_complete_task` | Conduce la ejecución y marca tareas — con **evidencia de verificación** registrada (una ejecución fallida rechaza la marca y queda registrada); `batch` para tareas paralelas `[P]` |
| `spec_task_brief` | Brief autocontenido de una tarea — ACs y pruebas resueltos al texto de la spec, contexto del diseño, steering con ámbito, definición de terminado (la base de la ejecución con subagentes) |
| `spec_append_tasks` | Convergencia: añade tareas de seguimiento en `Fase: Convergencia` sin renumerar las existentes |
| `spec_finish` | Cierra una función: bloqueos, avisos, comprobaciones a repetir y un resumen de merge generado desde la cadena de la spec; `write` registra también la línea base de drift |
| `spec_next_action` | "Estás aquí → haz esto a continuación", fase a fase: revisar → completar → corregir → aprobar (la fase siguiente solo tras esa aprobación) → implementar → verificar → cerrar (después cerrada / deriva) |
| `spec_approve` | Aprueba un gate de fase — rechazado mientras fallen las comprobaciones de esa fase (`force` registra una aprobación forzada y señalada); cada aprobación queda en un historial con snapshot |
| `spec_impact` | Qué afecta una edición posterior a la aprobación (ACs, secciones, tareas cambiadas → tareas, pruebas, diseño); `reopen` desmarca las tareas hechas afectadas (nunca las de un criterio eliminado — `retire` las lista) |
| `spec_add_track` / `spec_feature` | Añade un track (aditivo; `remove:true` desactiva uno sin borrar archivos) / archiva · restaura · renombra · elimina una función (eliminar exige `confirm:true`) |
| `ears_validate` | Valida requisitos (SHALL/DEVE/DEBE, IDs estables, palabras vagas, placeholders de la plantilla — EN/PT/ES) |
| `trace_check` | Cada AC cubierto por una tarea (y una prueba en +tdd); referencias fantasma; avisos de EC/NFR/SC; `code:true` busca T-IDs en los archivos de prueba |
| `spec_doctor` | Un health-check → "¿listo para avanzar?" (EARS, placeholders, trace, secciones, evidencia, gates, steering) |
| `spec_clarify` | Expone ambigüedades/lagunas de los requisitos antes del diseño |
| `spec_metrics` | Lead times, retrabajo, aprobaciones forzadas, solicitudes de cambio, tasa de éxito de la evidencia; `write` crea un `retro.md` prerrellenado |
| `spec_catalog` | Catálogo vivo de los ACs de todas las funciones, con los sustituidos señalados (`_Supersedes:_`); `write` → `.specs/SPECS.md` |
| `spec_drift` | Archivos de implementación cambiados, ausentes o nuevos desde que `spec_finish` registró la línea base |
| `spec_roadmap` / `spec_depend` | Hoja de ruta + dependencias (detecta ciclos; `add` / `remove` editan la lista); `write:true` → `.specs/ROADMAP.md` (+ `html:true` para el `.html` con la marca, offline, claro/oscuro; `lang`) |
| `spec_backlog` | Registra funciones planificadas pero aún sin spec (aparecen en ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventario de código existente (rutas, pruebas, puntos de entrada, nombres de variables de entorno, migraciones) + la parte de los archivos de código nombrados en `_Implements:_` |
| `steering_scaffold` | Crea un archivo de steering desde la plantilla (incl. `constitution.md`), o uno personalizado con ámbito |

### Ejecución con subagentes (opcional)

`/executeTask <feature> --subagents` reserva el contexto de la sesión principal para la coordinación: por
tarea escribe un brief (`spec_task_brief`), despacha el agente **`dev-spec-driven:spec-implementer`** del
plugin, envía el diff al agente **`dev-spec-driven:spec-reviewer`** (veredicto por AC ID + calidad +
comprobaciones del track), hace un ciclo de correcciones de como máximo 5 rondas y solo entonces marca la
tarea. Avanza solo dentro de una historia, se detiene en cada `**Checkpoint:**` para tu revisión y nunca
cambia un AC, el diseño o una prueba sin volver a esa fase. Usa unas 2–3× los tokens de la ejecución inline,
así que compensa en funciones con ~6+ tareas independientes. Protocolo:
`skills/dev-spec-driven/references/subagent-execution.md`.

### Gates y evidencia

- **Una aprobación es un gate, no un sello.** `spec_approve` ejecuta primero las comprobaciones de la fase
  (errores EARS, placeholders de la plantilla, `[NEEDS CLARIFICATION]` sin resolver, secciones ausentes, ACs
  sin cobertura, …; la Fase 4 `tests`: cada T-ID planeado en un archivo de prueba / un conjunto de evals propio;
  `execution`: los bloqueos de `spec_finish`) y la rechaza mientras alguna falle. `force: true` (CLI `--force`) la registra igualmente
  como aprobación **forzada**, con las comprobaciones que fallaron, y el `doctor` y la hoja de ruta siguen
  señalándola.
- **Una plantilla no es contenido.** El `doctor` tiene la comprobación `placeholders` (falla en la fase
  actual y en las anteriores), una función nueva empieza en la fase `requirements` y `ears_validate` informa
  del código `placeholder`. Un corchete solo cuenta cuando su texto es uno de los que escriben las plantillas (o TODO /
  TBD / FIXME / `…`): valores reales como `[free: 60, pro: 600]` o `[admin, billing-manager]` son tu contenido.
- **`next_action` avanza fase a fase:** revisar → en la primera fase aún sin aprobar, completar → corregir → aprobar
  (la fase siguiente solo tras esa aprobación — nunca pide el diseño antes de que los requisitos estén aprobados, y
  `approve` rechaza una fase mientras una anterior siga sin aprobar) → implementar → verificar → cerrar. Nunca
  recomienda una aprobación que el gate rechazaría; en su lugar, dice en qué falla — ni `spec_finish` mientras haya
  una tarea marcada sin verificar (el paso `verify` la nombra con su `dev-spec done <f> <n> --run`). En +tdd / +ai, la Fase 4
  (pruebas en rojo / harness de evals, `approve <f> tests`) es un gate que pide antes de implementar ninguna tarea.
- **Evidencia antes que afirmaciones.** Las tareas declaran `_Verify: <comando>_`; `spec_complete_task`
  registra el comando, el código de salida y un resumen, y rechaza la marca si falla. Una tarea con un
  `_Verify:_` ejecutable solo queda verificada con el comando y el código de salida 0 — una nota de texto la
  marca, pero la deja sin verificar. Las ejecuciones fallidas quedan en un historial corto, y una tarea
  reabierta tras un cambio en la spec tiene evidencia **obsoleta** hasta volver a ejecutarse.
  `spec_complete_task` devuelve un código de motivo estable (`unverifiedReason`: `failed-run`,
  `manual-note-on-runnable-verify`, `duplicate-number`, `stale-evidence`, `no-evidence`); el `doctor`,
  `spec_finish` y la línea "Necesita atención" del `ROADMAP.md` listan cada tarea sin verificar con su
  motivo. CLI: `dev-spec done <feature> <n> --run`.
- **`/spec-bugfix`** — una spec ligera para un defecto: reproducir → **causa raíz con evidencia** → prueba de
  regresión en rojo → corrección → verificación. El `doctor` falla hasta que la causa raíz esté escrita, y
  las tareas posteriores a la de la causa raíz no se pueden completar antes.
- **`/spec-finish`** — bloquea con fallos del doctor, un artefacto cambiado tras su aprobación, placeholders en
  cualquier punto de la cadena, tareas abiertas o sin verificar y gates pendientes; lista las comprobaciones a
  repetir y construye un resumen de merge desde la spec. Después haces el merge en local o conservas la rama —
  sin pull requests, sin CI.
- **`/spec-review-feedback`** — comentarios de revisión evaluados contra la spec. **`/spec-doctor --deep`** —
  el agente `spec-critic` revisa el *significado* de la spec en su gate.

### Gestión de cambios

- **Historial de aprobaciones.** Cada aprobación se añade al `.state.json` (`approvalHistory`) y guarda un
  snapshot de lo aprobado en `.specs/<feature>/.history/<fase>@<n>.md` — haz commit de él con la spec.
- **`/spec-impact`** (`spec_impact`) — cuando cambia un artefacto aprobado, compara la edición con ese
  snapshot: ACs (e IDs SC/EC/NFR), secciones del diseño o tareas añadidos, modificados o eliminados y, para
  cada uno, las tareas que lo citan (hechas o abiertas, con su evidencia), las pruebas que lo cubren y las
  secciones del diseño que lo mencionan. `reopen` desmarca las tareas hechas afectadas, marca su evidencia
  como obsoleta y registra la solicitud de cambio — nunca las tareas de un criterio eliminado: `retire` las
  lista (con sus filas de prueba) para eliminarlas o apuntarlas al criterio que lo sustituye. Nunca edita tus
  requisitos ni el diseño.
- **`/spec-converge`** (`spec_append_tasks`) — cuando la implementación se ha desviado del plan o una revisión
  ha encontrado trabajo de seguimiento, añade tareas nuevas (numeradas tras la última, en
  `Fase: Convergencia`) con `_Requirements:_`, `_Implements:_` y `_Verify:_`. Los IDs de AC desconocidos se
  rechazan, las tareas existentes nunca cambian y una lista de tareas ya aprobada pide una nueva aprobación.

### Catálogo vivo, drift y restauración

- **`/spec-catalog`** (`spec_catalog`) — "lo que el sistema hace hoy": todas las funciones (activas,
  terminadas, archivadas) con cada AC en una línea EARS. Un criterio sustituido por una función posterior se
  declara con `_Supersedes: <feature>/US-n.AC-m_` y el antiguo aparece como sustituido. `write` genera
  `.specs/SPECS.md` (nunca encima de un archivo escrito a mano), que se actualiza con la hoja de ruta desde
  entonces.
- **`/spec-drift`** (`spec_drift`) — `spec_finish` con `write` en una función lista registra un hash de cada
  archivo nombrado en sus marcadores `_Implements:_`; el drift informa de los archivos cambiados, ausentes o
  nuevos desde entonces. El hook de SessionStart añade una línea por cada función con drift.
- **Restauración** — `spec_feature archive` registra las dependencias que elimina, y `restore` devuelve la
  función con su entrada en la hoja de ruta y esas dependencias.

### Modo guardia y steering con ámbito

- **`/spec-guard`** — modo guardia opcional (`spec_init {guard: true}` / `dev-spec init --guard on|off`).
  Mientras está activo, un hook PreToolUse de Claude Code **pregunta antes** de un Write/Edit en un archivo de
  código fuera de `.specs/` cuando ninguna función tiene tareas aprobadas sin terminar. No dice nada cuando
  está desactivado y nunca bloquea por sus propios errores. Las demás herramientas no ejecutan hooks de
  Claude Code, así que allí el modo guardia no hace nada.
- **Steering con ámbito** — los archivos de steering aceptan front matter compatible con Kiro:
  `inclusion: always`, `fileMatch` (con `fileMatchPattern: "src/api/**"`) o `manual`. `steering_scaffold`
  crea archivos personalizados como `api-conventions.md`, y cada brief de tarea incluye los archivos cuyo
  patrón coincide con las rutas `_Implements:_` de la tarea.

### Brownfield, importación y métricas

- **Análisis más profundo** — `spec_scan` lista rutas HTTP con método, ruta y `archivo:línea` (Express,
  NestJS, Next.js, FastAPI, Flask, Django, Spring, ASP.NET, Rails, Laravel, Go …), frameworks de pruebas,
  puntos de entrada, **nombres** de variables de entorno (nunca los valores) y archivos de migración.
  `spec_coverage` mide la parte de los archivos de código nombrados en algún marcador `_Implements:_`, por
  carpeta. `create --brownfield` añade un `integration-plan.md`.
- **`/spec-import`** (`spec_import`) — trae una spec de Kiro (`.kiro/specs/<name>/`), spec-kit
  (`specs/<nnn-name>/`) u OpenSpec (`openspec/specs/<capability>/` o una carpeta de change) como función
  nueva: los criterios pasan a líneas EARS `US-N.AC-M` (o conservan su texto con `[NEEDS CLARIFICATION]`) y
  las tareas se renumeran con el estado de sus casillas. El origen debe estar dentro del proyecto y solo se
  lee.
- **Trazabilidad más profunda** — `trace_check` avisa de casos límite (EC-n), NFRs y criterios de éxito
  (SC-nnn) sin cobertura; `--code` busca T-IDs en los nombres de las pruebas (`test("T-01 …")`,
  `def test_T01_…`). Los planes de pruebas tienen una columna **Tipo** (Kind: `example` | `property`) con
  orientación para pruebas basadas en propiedades.
- **`/spec-metrics`** (`spec_metrics`) — lead time por fase, retrabajo, aprobaciones forzadas, solicitudes de
  cambio y tasa de éxito de la evidencia, por función o para el proyecto; `write` crea un `retro.md`
  prerrellenado.

### Automatización local, no CI

- **Hooks** (`hooks/hooks.json`): al guardar `requirements.md` → valida EARS + placeholders; al guardar
  `tasks.md` → comprueba la trazabilidad; al guardar `design.md` → las secciones obligatorias de los tracks
  activos; al iniciar la sesión → estado de las funciones + drift. El modo guardia opcional se ejecuta antes
  de las ediciones de código. Más un validador `pre-commit` opcional de git.
- **Harness de evals** (`mcp/evals/run-evals.js`): ejecuta los conjuntos
  golden/adversarial/regression con **tu propia `ANTHROPIC_API_KEY`**; `--dry-run` valida sin
  conexión, `--set-baseline` registra una baseline.

### Inicio rápido

Instala desde GitHub (recomendado — funciona en cualquier máquina, sin rutas que editar):

```text
/plugin marketplace add linofcp007/dev-spec-driven
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

O clona y cárgalo solo para una sesión:

```bash
git clone https://github.com/linofcp007/dev-spec-driven.git
claude --plugin-dir ./dev-spec-driven
```

Luego describe una función (la skill se activa en tu idioma) o condúcela explícitamente:

```
/dev-spec-driven:spec  Añadir claves de API por inquilino con rotación y uso medido por Stripe
```

### Comandos (42)

`/spec` · `/spec-init` · `/classify` · `/createSpec` · `/clarify` · `/design` · `/testPlan` ·
`/evalPlan` · `/grill` · `/writeTests` · `/createTask` · `/executeTask [--subagents]` · `/spec-doctor` · `/approve` ·
`/next-action` · `/add-track` · `/feature` · `/eval` · `/roadmap` · `/depend` · `/backlog` ·
`/scan` · `/reverse` · `/coverage` · `/spec-status` · `/spec-commit` · `/spec-bugfix` · `/spec-finish` · `/spec-review-feedback` · `/prReview` · `/promptReview` ·
`/migrateModel` — atajos `/ds` `/dsx` `/dss`.
Nuevos en la 1.13: `/spec-impact` · `/spec-metrics` · `/spec-converge` · `/spec-import` · `/spec-catalog` ·
`/spec-drift` · `/spec-guard`.
(Como plugin, tienen namespace, p. ej. `/dev-spec-driven:design`.)

### La CLI `dev-spec`

El mismo motor desde cualquier terminal (`node cli/dev-spec.js <comando>`, o `dev-spec` en el PATH);
`--json` muestra el resultado en bruto y `help` lista todas las opciones:

```text
classify · init [--guard on|off] · steering · create [--brownfield] · bugfix · import · list · status
doctor · trace [--code] · clarify · ears · next [--batch] · next-action · brief · done [--run]
append-tasks · approve [--force] · impact [--reopen] · metrics [--write] · finish [--write]
add-track [--remove] · feature <remove|archive|rename|restore> · catalog [--write] · drift
roadmap · depend · backlog · scan · coverage · evals · mcp-config <client> · rules <tool>
```

### Por qué no hay GitHub Actions

A propósito. Todos los gates — validación EARS, trazabilidad, clasificación, estado, tareas —
se ejecutan **localmente** mediante el servidor MCP y el modelo. Tus pruebas, pruebas de carga y
evals se ejecutan en tu entorno cuando quieras, no en un runner de CI de pago.

### Desarrollar / probar

```bash
node mcp/test.js          # prueba el servidor MCP de extremo a extremo (debe terminar en `0 failed`)
node cli/test-cli.js      # prueba la CLI universal (debe terminar en `0 failed`)
```

> Sustituye cuatro skills predecesoras; el contenido vive aquí como tracks componibles (los
> originales quedan en el historial git y en la release v1.8.0, por si alguna vez los necesitas).
> Licencia MIT.

---

## What's in the box / Estrutura / Estructura

```
dev-spec-driven/                      ← plugin root
├── .claude-plugin/                   ← plugin.json + marketplace.json
├── skills/dev-spec-driven/
│   ├── SKILL.md                      ← trilingual track-based workflow
│   └── references/                   ← deep library (EARS, scale, eval, safety, …)
├── commands/                         ← 42 slash commands (trilingual descriptions)
├── agents/                           ← spec-implementer + spec-reviewer + spec-critic
├── evals/                            ← plugin evals for `claude plugin eval` (triggering EN/PT/ES)
├── cli/dev-spec.js                   ← universal CLI (works in any tool / shell)
├── mcp/
│   ├── server.js                     ← local stdio MCP server (29 tools, zero-dependency)
│   ├── servers.json                  ← plugin MCP registration (plugin.json → mcpServers)
│   ├── lib/spec.js                   ← the spec engine (classify, scaffold, lint, trace, doctor, gates, impact, roadmap, scan, import)
│   ├── lib/i18n.js                   ← localized content EN/PT/ES (artifact + steering builders, messages)
│   ├── evals/run-evals.js            ← local eval harness (your API key; --dry-run offline)
│   └── test.js                       ← smoke test (node mcp/test.js — must end `0 failed`)
├── hooks/                            ← local automation (PostToolUse, SessionStart, opt-in PreToolUse guard, pre-commit)
├── AGENTS.md                         ← portable workflow (Codex/Gemini/Cursor/Windsurf/…)
├── .cursor/ · .windsurf/ · .github/copilot-instructions.md · GEMINI.md   ← per-tool rules
├── integrations/                     ← MCP config templates per tool (placeholder path; `mcp-config` fills it)
├── examples/demo-project/            ← a worked feature (1.13 shape) that passes doctor + trace
├── INTEGRATIONS.md                   ← how to use it in every tool (+ MCP configs)
├── package.json · LICENSE · CHANGELOG.md · CLAUDE.md
└── INSTALL.md
```

See [INSTALL.md](./INSTALL.md) for persistent installation, hooks, the git pre-commit validator,
and the eval harness.
