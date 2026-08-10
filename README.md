# dev-spec-driven

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node: >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![dependencies: 0](https://img.shields.io/badge/dependencies-0-success.svg)](./package.json)
[![tests: 89 passing](https://img.shields.io/badge/tests-89%20passing-success.svg)](./mcp/test.js)
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
classifier** (the local `spec_classify` tool, now multilingual) picks the track set; you approve it.

### The local MCP server (`spec-driven`)

Pure Node core — **no `npm install`, no network, no cost.** Tools:

| Tool | Does |
|---|---|
| `spec_classify` | Recommend tracks from a description (multilingual keyword heuristic, weighted) |
| `spec_init` / `spec_create` | Scaffold steering + a feature folder for the active tracks |
| `spec_list` / `spec_status` | Inspect features, phases, task progress, section completeness |
| `spec_next_task` / `spec_complete_task` | Drive execution and tick off tasks |
| `ears_validate` | Lint requirements (SHALL/DEVE/DEBE, stable IDs, vague words EN/PT/ES) |
| `trace_check` | Every AC covered by a task (and a test on +tdd); flags phantom refs (typos) |
| `spec_doctor` | One health-check → "ready to advance?" (EARS + trace + sections + steering) |
| `spec_approve` | Record a phase approval to `.specs/<feature>/.state.json` (auditable gates) |
| `spec_clarify` | Surface requirement ambiguities/gaps before design |
| `spec_roadmap` / `spec_depend` | Roadmap + dependencies (cycle-checked); `write:true` → `.specs/ROADMAP.md` (+ `html:true` for a brand-styled offline `.html`, `lang`) |
| `spec_backlog` | Track planned-but-unspecced features (shown in ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventory an existing codebase + spec coverage % |
| `steering_scaffold` | Create one steering file from template (incl. `constitution.md`) |

### Local automation, not CI

- **Hooks** (`hooks/hooks.json`): on saving `requirements.md` → EARS lint; on saving `tasks.md` →
  traceability check; at session start → feature status. Plus an optional git `pre-commit` validator.
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

### Commands

`/spec` · `/init` · `/classify` · `/createSpec` · `/clarify` · `/design` · `/testPlan` ·
`/evalPlan` · `/writeTests` · `/createTask` · `/executeTask` · `/doctor` · `/approve` ·
`/next-action` · `/add-track` · `/feature` · `/eval` · `/roadmap` · `/depend` · `/backlog` ·
`/scan` · `/reverse` · `/coverage` · `/status` · `/commit` · `/prReview` · `/promptReview` ·
`/migrateModel` — aliases `/ds` `/dsx` `/dss`.
(As a plugin they are namespaced, e.g. `/dev-spec-driven:design`.)

### Why no GitHub Actions

By design. Every gate — EARS linting, traceability, classification, status, task tracking — runs
**locally** through the bundled MCP server and the model. Your tests, load tests, and eval harnesses
run in your own environment when you choose, not on a paid CI runner.

### Develop / test

```bash
node mcp/test.js          # smoke-test the MCP server end-to-end (66 assertions)
node cli/test-cli.js      # smoke-test the universal CLI (38 assertions)
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
**classificador de Fase 0** (a ferramenta local `spec_classify`, agora multilíngue) escolhe os
tracks; tu aprovas.

### O servidor MCP local (`spec-driven`)

Apenas Node nativo — **sem `npm install`, sem rede, sem custo.** Ferramentas:

| Ferramenta | O que faz |
|---|---|
| `spec_classify` | Recomenda tracks a partir de uma descrição (heurística multilíngue, com peso) |
| `spec_init` / `spec_create` | Cria o steering + a pasta da funcionalidade para os tracks ativos |
| `spec_list` / `spec_status` | Inspeciona funcionalidades, fases, progresso, secções preenchidas |
| `spec_next_task` / `spec_complete_task` | Conduz a execução e marca tarefas como feitas |
| `ears_validate` | Valida requisitos (SHALL/DEVE/DEBE, IDs estáveis, palavras vagas EN/PT/ES) |
| `trace_check` | Cada AC coberto por uma tarefa (e um teste em +tdd); deteta referências fantasma |
| `spec_doctor` | Um health-check → "pronto para avançar?" (EARS + trace + secções + steering) |
| `spec_approve` | Regista a aprovação de uma fase em `.specs/<feature>/.state.json` |
| `spec_clarify` | Expõe ambiguidades/lacunas dos requisitos antes do design |
| `spec_roadmap` / `spec_depend` | Roadmap + dependências (deteta ciclos); `write:true` → `.specs/ROADMAP.md` (+ `html:true` para o `.html` com a marca, offline, claro/escuro; `lang`) |
| `spec_backlog` | Regista funcionalidades planeadas mas ainda sem spec (aparecem no ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventário de código existente + % de cobertura de specs |
| `steering_scaffold` | Cria um ficheiro de steering a partir do template (incl. `constitution.md`) |

### Automação local, não CI

- **Hooks** (`hooks/hooks.json`): ao gravar `requirements.md` → valida EARS; ao gravar `tasks.md` →
  verifica a rastreabilidade; no arranque da sessão → estado das funcionalidades. Mais um validador
  `pre-commit` opcional do git.
- **Harness de evals** (`mcp/evals/run-evals.js`): corre os conjuntos golden/adversarial/regression
  com a **tua própria `ANTHROPIC_API_KEY`**; `--dry-run` valida offline, `--set-baseline` grava uma
  baseline.

### Começar rápido

```bash
# point --plugin-dir at your local clone of this repo (any path):
claude --plugin-dir ./dev-spec-driven
```

Depois descreve uma funcionalidade (a skill ativa-se na tua língua) ou conduz explicitamente:

```
/dev-spec-driven:spec  Adicionar chaves de API por inquilino com rotação e uso medido pelo Stripe
```

### Comandos

`/spec` · `/init` · `/classify` · `/createSpec` · `/clarify` · `/design` · `/testPlan` ·
`/evalPlan` · `/writeTests` · `/createTask` · `/executeTask` · `/doctor` · `/approve` ·
`/next-action` · `/add-track` · `/feature` · `/eval` · `/roadmap` · `/depend` · `/backlog` ·
`/scan` · `/reverse` · `/coverage` · `/status` · `/commit` · `/prReview` · `/promptReview` ·
`/migrateModel` — atalhos `/ds` `/dsx` `/dss`.
(Como plugin, têm namespace, ex.: `/dev-spec-driven:design`.)

### Porque não há GitHub Actions

De propósito. Todos os gates — validação EARS, rastreabilidade, classificação, estado, tarefas —
correm **localmente** através do servidor MCP e do modelo. Os testes, testes de carga e evals correm
no teu ambiente quando quiseres, não num runner de CI pago.

### Desenvolver / testar

```bash
node mcp/test.js          # testa o servidor MCP de ponta a ponta (27 asserções)
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
**clasificador de Fase 0** (la herramienta local `spec_classify`, ahora multilingüe) elige los
tracks; tú apruebas.

### El servidor MCP local (`spec-driven`)

Solo Node nativo — **sin `npm install`, sin red, sin coste.** Herramientas:

| Herramienta | Qué hace |
|---|---|
| `spec_classify` | Recomienda tracks desde una descripción (heurística multilingüe, ponderada) |
| `spec_init` / `spec_create` | Crea el steering + la carpeta de la función para los tracks activos |
| `spec_list` / `spec_status` | Inspecciona funciones, fases, progreso, secciones completadas |
| `spec_next_task` / `spec_complete_task` | Conduce la ejecución y marca tareas como hechas |
| `ears_validate` | Valida requisitos (SHALL/DEVE/DEBE, IDs estables, palabras vagas EN/PT/ES) |
| `trace_check` | Cada AC cubierto por una tarea (y una prueba en +tdd); detecta referencias fantasma |
| `spec_doctor` | Un health-check → "¿listo para avanzar?" (EARS + trace + secciones + steering) |
| `spec_approve` | Registra la aprobación de una fase en `.specs/<feature>/.state.json` |
| `spec_clarify` | Expone ambigüedades/lagunas de los requisitos antes del diseño |
| `spec_roadmap` / `spec_depend` | Hoja de ruta + dependencias (detecta ciclos); `write:true` → `.specs/ROADMAP.md` (+ `html:true` para el `.html` con la marca, offline, claro/oscuro; `lang`) |
| `spec_backlog` | Registra funciones planificadas pero aún sin spec (aparecen en ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventario de código existente + % de cobertura de specs |
| `steering_scaffold` | Crea un archivo de steering desde la plantilla (incl. `constitution.md`) |

### Automatización local, no CI

- **Hooks** (`hooks/hooks.json`): al guardar `requirements.md` → valida EARS; al guardar `tasks.md`
  → comprueba la trazabilidad; al iniciar la sesión → estado de las funciones. Más un validador
  `pre-commit` opcional de git.
- **Harness de evals** (`mcp/evals/run-evals.js`): ejecuta los conjuntos
  golden/adversarial/regression con **tu propia `ANTHROPIC_API_KEY`**; `--dry-run` valida sin
  conexión, `--set-baseline` registra una baseline.

### Inicio rápido

```bash
# point --plugin-dir at your local clone of this repo (any path):
claude --plugin-dir ./dev-spec-driven
```

Luego describe una función (la skill se activa en tu idioma) o condúcela explícitamente:

```
/dev-spec-driven:spec  Añadir claves de API por inquilino con rotación y uso medido por Stripe
```

### Comandos

`/spec` · `/init` · `/classify` · `/createSpec` · `/clarify` · `/design` · `/testPlan` ·
`/evalPlan` · `/writeTests` · `/createTask` · `/executeTask` · `/doctor` · `/approve` ·
`/next-action` · `/add-track` · `/feature` · `/eval` · `/roadmap` · `/depend` · `/backlog` ·
`/scan` · `/reverse` · `/coverage` · `/status` · `/commit` · `/prReview` · `/promptReview` ·
`/migrateModel` — atajos `/ds` `/dsx` `/dss`.
(Como plugin, tienen namespace, p. ej. `/dev-spec-driven:design`.)

### Por qué no hay GitHub Actions

A propósito. Todos los gates — validación EARS, trazabilidad, clasificación, estado, tareas —
se ejecutan **localmente** mediante el servidor MCP y el modelo. Tus pruebas, pruebas de carga y
evals se ejecutan en tu entorno cuando quieras, no en un runner de CI de pago.

### Desarrollar / probar

```bash
node mcp/test.js          # prueba el servidor MCP de extremo a extremo (27 aserciones)
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
├── commands/                         ← 31 slash commands (trilingual descriptions)
├── cli/dev-spec.js                   ← universal CLI (works in any tool / shell)
├── mcp/
│   ├── server.js                     ← local stdio MCP server (21 tools, zero-dependency)
│   ├── lib/spec.js                   ← the spec engine (classify, scaffold, lint, trace, doctor, roadmap, scan)
│   ├── lib/i18n.js                   ← localized content EN/PT/ES (artifact + steering builders, messages)
│   ├── evals/run-evals.js            ← local eval harness (your API key; --dry-run offline)
│   └── test.js                       ← smoke test (node mcp/test.js — 66 assertions)
├── hooks/                            ← local automation (PostToolUse, SessionStart, pre-commit)
├── AGENTS.md                         ← portable workflow (Codex/Gemini/Cursor/Windsurf/…)
├── .cursor/ · .windsurf/ · .github/copilot-instructions.md · GEMINI.md   ← per-tool rules
├── integrations/                     ← ready-made, path-filled MCP configs per tool
├── examples/demo-project/            ← a worked feature (v1.5 shape) that passes doctor + trace
├── INTEGRATIONS.md                   ← how to use it in every tool (+ MCP configs)
├── .mcp.json
├── package.json · LICENSE · CHANGELOG.md · CLAUDE.md
└── INSTALL.md
```

See [INSTALL.md](./INSTALL.md) for persistent installation, hooks, the git pre-commit validator,
and the eval harness.
