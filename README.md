# dev-spec-driven

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node: >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![dependencies: 0](https://img.shields.io/badge/dependencies-0-success.svg)](./package.json)
[![tests: 234 passing](https://img.shields.io/badge/tests-234%20passing-success.svg)](./mcp/test.js)
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
| `spec_next_task` / `spec_complete_task` | Drive execution and tick off tasks — with recorded **verification evidence** (a failed run refuses the tick); `batch` for parallel `[P]` tasks |
| `spec_finish` | Close a feature: blockers, fresh checks to run, and a merge summary generated from the spec chain |
| `spec_next_action` | "You are here → do this next" + artifacts changed since their approval |
| `spec_add_track` / `spec_feature` | Add a track to a feature (additive; `remove:true` takes one off, files kept) / archive · rename · remove it (remove needs `confirm:true`) |
| `ears_validate` | Lint requirements (SHALL/DEVE/DEBE, stable IDs, vague words EN/PT/ES) |
| `trace_check` | Every AC covered by a task (and a test on +tdd); flags phantom refs (typos) |
| `spec_doctor` | One health-check → "ready to advance?" (EARS + trace + sections + steering) |
| `spec_approve` | Record a phase approval to `.specs/<feature>/.state.json` (auditable gates) |
| `spec_clarify` | Surface requirement ambiguities/gaps before design |
| `spec_roadmap` / `spec_depend` | Roadmap + dependencies (cycle-checked); `write:true` → `.specs/ROADMAP.md` (+ `html:true` for a brand-styled offline `.html`, `lang`) |
| `spec_backlog` | Track planned-but-unspecced features (shown in ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventory an existing codebase + spec coverage % |
| `steering_scaffold` | Create one steering file from template (incl. `constitution.md`) |
| `spec_task_brief` | Self-contained brief for one task — ACs and tests resolved to their spec text, design context, definition of done (the basis of subagent execution) |

### Subagent-driven execution (opt-in)

`/executeTask <feature> --subagents` keeps the main session's context for coordination: per task it
writes a brief (`spec_task_brief`), dispatches the plugin's **`dev-spec-driven:spec-implementer`** agent, sends the diff
to the **`dev-spec-driven:spec-reviewer`** agent (verdict per AC ID + quality + track checks), runs a fix loop of at most
5 rounds, and only then ticks the task. It runs on its own within a story, stops at every
`**Checkpoint:**` for your review, and never changes an AC, the design or a test without going back to
that phase. It uses about 2–3× the tokens of inline execution, so it is worth it on features with ~6+
independent tasks. Protocol: `skills/dev-spec-driven/references/subagent-execution.md`. Adapted from the
`subagent-driven-development` skill of [obra/superpowers](https://github.com/obra/superpowers) (MIT).

### Evidence, bugfixes and finishing

- **Evidence before claims.** Tasks declare `_Verify: <command>_`; `spec_complete_task` records the
  command, exit code and output summary, refuses the tick on a failure, and `doctor` / `ROADMAP.md` /
  `spec_finish` keep flagging tasks ticked without evidence. A task with a runnable `_Verify:_` counts as
  verified only with the command and exit code 0 — a text note ticks it but leaves it unverified. CLI:
  `dev-spec done <feature> <n> --run`.
- **`/spec-bugfix`** — a light spec for a defect: reproduce → **root cause with evidence** (the doctor
  blocks the fix until it's written) → failing regression test → fix → verify.
- **`/spec-finish`** — what still blocks, the checks to run fresh, and a merge summary built from the
  spec (ACs, tasks with their evidence, root cause/fix); then merge locally or keep the branch — no
  pull requests, no CI.
- **`/spec-review-feedback`** — review comments classified against the spec: fix AC violations, route
  spec changes back to their phase, push back on out-of-scope asks.
- **`/spec-doctor --deep`** — a `spec-critic` agent reviews the *meaning* of a spec at its gate.
- **Bounded mode** between Vibe and Spec (short design in chat + an explicit yes), **Global
  Constraints** inlined into every task brief, **parallel `[P]` tasks** in separate worktrees, and
  **plugin evals** (`evals/`, `claude plugin eval`) that check the skill triggers in EN/PT/ES.
  These ideas are adapted from [obra/superpowers](https://github.com/obra/superpowers) (MIT).

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

`/spec` · `/spec-init` · `/classify` · `/createSpec` · `/clarify` · `/design` · `/testPlan` ·
`/evalPlan` · `/grill` · `/writeTests` · `/createTask` · `/executeTask [--subagents]` · `/spec-doctor` · `/approve` ·
`/next-action` · `/add-track` · `/feature` · `/eval` · `/roadmap` · `/depend` · `/backlog` ·
`/scan` · `/reverse` · `/coverage` · `/spec-status` · `/spec-commit` · `/spec-bugfix` · `/spec-finish` · `/spec-review-feedback` · `/prReview` · `/promptReview` ·
`/migrateModel` — aliases `/ds` `/dsx` `/dss`.
(As a plugin they are namespaced, e.g. `/dev-spec-driven:design`.)

### Why no GitHub Actions

By design. Every gate — EARS linting, traceability, classification, status, task tracking — runs
**locally** through the bundled MCP server and the model. Your tests, load tests, and eval harnesses
run in your own environment when you choose, not on a paid CI runner.

### Develop / test

```bash
node mcp/test.js          # smoke-test the MCP server end-to-end (181 assertions)
node cli/test-cli.js      # smoke-test the universal CLI (53 assertions)
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
| `spec_next_task` / `spec_complete_task` | Conduz a execução e marca tarefas como feitas — com **evidência de verificação** registada (uma execução falhada recusa a marcação); `batch` para tarefas paralelas `[P]` |
| `spec_finish` | Fecha uma funcionalidade: bloqueios, verificações a correr de novo e um resumo de merge gerado a partir da cadeia da spec |
| `spec_next_action` | "Estás aqui → faz isto a seguir" + artefactos alterados depois da respetiva aprovação |
| `spec_add_track` / `spec_feature` | Acrescenta um track a uma funcionalidade (aditivo; `remove:true` retira um sem apagar ficheiros) / arquiva · renomeia · remove (remover exige `confirm:true`) |
| `ears_validate` | Valida requisitos (SHALL/DEVE/DEBE, IDs estáveis, palavras vagas EN/PT/ES) |
| `trace_check` | Cada AC coberto por uma tarefa (e um teste em +tdd); deteta referências fantasma |
| `spec_doctor` | Um health-check → "pronto para avançar?" (EARS + trace + secções + steering) |
| `spec_approve` | Regista a aprovação de uma fase em `.specs/<feature>/.state.json` |
| `spec_clarify` | Expõe ambiguidades/lacunas dos requisitos antes do design |
| `spec_roadmap` / `spec_depend` | Roadmap + dependências (deteta ciclos); `write:true` → `.specs/ROADMAP.md` (+ `html:true` para o `.html` com a marca, offline, claro/escuro; `lang`) |
| `spec_backlog` | Regista funcionalidades planeadas mas ainda sem spec (aparecem no ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventário de código existente + % de cobertura de specs |
| `steering_scaffold` | Cria um ficheiro de steering a partir do template (incl. `constitution.md`) |
| `spec_task_brief` | Brief autocontido de uma tarefa — ACs e testes resolvidos para o texto da spec, contexto do design, definição de concluído (a base da execução com subagentes) |

### Execução com subagentes (opcional)

`/executeTask <feature> --subagents` guarda o contexto da sessão principal para a coordenação: por tarefa
escreve um brief (`spec_task_brief`), despacha o agente **`dev-spec-driven:spec-implementer`** do plugin,
envia o diff ao agente **`dev-spec-driven:spec-reviewer`** (veredicto por AC ID + qualidade + verificações do
track), faz um ciclo de correções de no máximo 5 rondas e só depois marca a tarefa. Avança sozinho dentro de
uma história, para em cada `**Checkpoint:**` para a tua revisão e nunca muda um AC, o design ou um teste sem
voltar a essa fase. Gasta cerca de 2–3× os tokens da execução inline, por isso compensa em funcionalidades
com ~6+ tarefas independentes. Protocolo: `skills/dev-spec-driven/references/subagent-execution.md`.

### Evidência, bugfixes e fecho

- **Evidência antes de afirmações.** As tarefas declaram `_Verify: <comando>_`; `spec_complete_task` regista
  o comando, o código de saída e um resumo, recusa a marcação quando falha, e `doctor` / `ROADMAP.md` /
  `spec_finish` continuam a assinalar tarefas marcadas sem evidência. Uma tarefa com um `_Verify:_`
  executável só fica verificada com o comando e o código de saída 0 — uma nota de texto marca-a, mas deixa-a
  por verificar. CLI: `dev-spec done <feature> <n> --run`.
- **`/spec-bugfix`** — uma spec leve para um defeito: reproduzir → **causa raiz com evidência** (o doctor
  bloqueia a correção até estar escrita) → teste de regressão a falhar → correção → verificação.
- **`/spec-finish`** — o que ainda bloqueia, as verificações a correr de novo e um resumo de merge construído
  a partir da spec; depois fazes o merge localmente ou manténs o branch — sem pull requests, sem CI.
- **`/spec-review-feedback`** — comentários de revisão avaliados contra a spec. **`/spec-doctor --deep`** —
  o agente `spec-critic` revê o *significado* da spec no respetivo gate.

### Automação local, não CI

- **Hooks** (`hooks/hooks.json`): ao gravar `requirements.md` → valida EARS; ao gravar `tasks.md` →
  verifica a rastreabilidade; no arranque da sessão → estado das funcionalidades. Mais um validador
  `pre-commit` opcional do git.
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

### Comandos

`/spec` · `/spec-init` · `/classify` · `/createSpec` · `/clarify` · `/design` · `/testPlan` ·
`/evalPlan` · `/grill` · `/writeTests` · `/createTask` · `/executeTask [--subagents]` · `/spec-doctor` · `/approve` ·
`/next-action` · `/add-track` · `/feature` · `/eval` · `/roadmap` · `/depend` · `/backlog` ·
`/scan` · `/reverse` · `/coverage` · `/spec-status` · `/spec-commit` · `/spec-bugfix` · `/spec-finish` · `/spec-review-feedback` · `/prReview` · `/promptReview` ·
`/migrateModel` — atalhos `/ds` `/dsx` `/dss`.
(Como plugin, têm namespace, ex.: `/dev-spec-driven:design`.)

### Porque não há GitHub Actions

De propósito. Todos os gates — validação EARS, rastreabilidade, classificação, estado, tarefas —
correm **localmente** através do servidor MCP e do modelo. Os testes, testes de carga e evals correm
no teu ambiente quando quiseres, não num runner de CI pago.

### Desenvolver / testar

```bash
node mcp/test.js          # testa o servidor MCP de ponta a ponta (181 asserções)
node cli/test-cli.js      # testa a CLI universal (53 asserções)
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
| `spec_next_task` / `spec_complete_task` | Conduce la ejecución y marca tareas como hechas — con **evidencia de verificación** registrada (una ejecución fallida rechaza la marca); `batch` para tareas paralelas `[P]` |
| `spec_finish` | Cierra una función: bloqueos, comprobaciones a repetir y un resumen de merge generado desde la cadena de la spec |
| `spec_next_action` | "Estás aquí → haz esto a continuación" + artefactos cambiados tras su aprobación |
| `spec_add_track` / `spec_feature` | Añade un track a una función (aditivo; `remove:true` quita uno sin borrar archivos) / archiva · renombra · elimina (eliminar exige `confirm:true`) |
| `ears_validate` | Valida requisitos (SHALL/DEVE/DEBE, IDs estables, palabras vagas EN/PT/ES) |
| `trace_check` | Cada AC cubierto por una tarea (y una prueba en +tdd); detecta referencias fantasma |
| `spec_doctor` | Un health-check → "¿listo para avanzar?" (EARS + trace + secciones + steering) |
| `spec_approve` | Registra la aprobación de una fase en `.specs/<feature>/.state.json` |
| `spec_clarify` | Expone ambigüedades/lagunas de los requisitos antes del diseño |
| `spec_roadmap` / `spec_depend` | Hoja de ruta + dependencias (detecta ciclos); `write:true` → `.specs/ROADMAP.md` (+ `html:true` para el `.html` con la marca, offline, claro/oscuro; `lang`) |
| `spec_backlog` | Registra funciones planificadas pero aún sin spec (aparecen en ROADMAP.md) |
| `spec_scan` / `spec_coverage` | Brownfield: inventario de código existente + % de cobertura de specs |
| `steering_scaffold` | Crea un archivo de steering desde la plantilla (incl. `constitution.md`) |
| `spec_task_brief` | Brief autocontenido de una tarea — ACs y pruebas resueltos al texto de la spec, contexto del diseño, definición de terminado (la base de la ejecución con subagentes) |

### Ejecución con subagentes (opcional)

`/executeTask <feature> --subagents` reserva el contexto de la sesión principal para la coordinación: por
tarea escribe un brief (`spec_task_brief`), despacha el agente **`dev-spec-driven:spec-implementer`** del
plugin, envía el diff al agente **`dev-spec-driven:spec-reviewer`** (veredicto por AC ID + calidad +
comprobaciones del track), hace un ciclo de correcciones de como máximo 5 rondas y solo entonces marca la
tarea. Avanza solo dentro de una historia, se detiene en cada `**Checkpoint:**` para tu revisión y nunca
cambia un AC, el diseño o una prueba sin volver a esa fase. Usa unas 2–3× los tokens de la ejecución inline,
así que compensa en funciones con ~6+ tareas independientes. Protocolo:
`skills/dev-spec-driven/references/subagent-execution.md`.

### Evidencia, bugfixes y cierre

- **Evidencia antes que afirmaciones.** Las tareas declaran `_Verify: <comando>_`; `spec_complete_task`
  registra el comando, el código de salida y un resumen, rechaza la marca si falla, y `doctor` /
  `ROADMAP.md` / `spec_finish` siguen señalando las tareas marcadas sin evidencia. Una tarea con un
  `_Verify:_` ejecutable solo queda verificada con el comando y el código de salida 0 — una nota de texto la
  marca, pero la deja sin verificar. CLI: `dev-spec done <feature> <n> --run`.
- **`/spec-bugfix`** — una spec ligera para un defecto: reproducir → **causa raíz con evidencia** (el doctor
  bloquea la corrección hasta que esté escrita) → prueba de regresión en rojo → corrección → verificación.
- **`/spec-finish`** — lo que aún bloquea, las comprobaciones a repetir y un resumen de merge construido desde
  la spec; después haces el merge en local o conservas la rama — sin pull requests, sin CI.
- **`/spec-review-feedback`** — comentarios de revisión evaluados contra la spec. **`/spec-doctor --deep`** —
  el agente `spec-critic` revisa el *significado* de la spec en su gate.

### Automatización local, no CI

- **Hooks** (`hooks/hooks.json`): al guardar `requirements.md` → valida EARS; al guardar `tasks.md`
  → comprueba la trazabilidad; al iniciar la sesión → estado de las funciones. Más un validador
  `pre-commit` opcional de git.
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

### Comandos

`/spec` · `/spec-init` · `/classify` · `/createSpec` · `/clarify` · `/design` · `/testPlan` ·
`/evalPlan` · `/grill` · `/writeTests` · `/createTask` · `/executeTask [--subagents]` · `/spec-doctor` · `/approve` ·
`/next-action` · `/add-track` · `/feature` · `/eval` · `/roadmap` · `/depend` · `/backlog` ·
`/scan` · `/reverse` · `/coverage` · `/spec-status` · `/spec-commit` · `/spec-bugfix` · `/spec-finish` · `/spec-review-feedback` · `/prReview` · `/promptReview` ·
`/migrateModel` — atajos `/ds` `/dsx` `/dss`.
(Como plugin, tienen namespace, p. ej. `/dev-spec-driven:design`.)

### Por qué no hay GitHub Actions

A propósito. Todos los gates — validación EARS, trazabilidad, clasificación, estado, tareas —
se ejecutan **localmente** mediante el servidor MCP y el modelo. Tus pruebas, pruebas de carga y
evals se ejecutan en tu entorno cuando quieras, no en un runner de CI de pago.

### Desarrollar / probar

```bash
node mcp/test.js          # prueba el servidor MCP de extremo a extremo (181 aserciones)
node cli/test-cli.js      # prueba la CLI universal (53 aserciones)
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
├── commands/                         ← 35 slash commands (trilingual descriptions)
├── agents/                           ← spec-implementer + spec-reviewer + spec-critic
├── evals/                            ← plugin evals for `claude plugin eval` (triggering EN/PT/ES)
├── cli/dev-spec.js                   ← universal CLI (works in any tool / shell)
├── mcp/
│   ├── server.js                     ← local stdio MCP server (23 tools, zero-dependency)
│   ├── servers.json                  ← plugin MCP registration (plugin.json → mcpServers)
│   ├── lib/spec.js                   ← the spec engine (classify, scaffold, lint, trace, doctor, roadmap, scan)
│   ├── lib/i18n.js                   ← localized content EN/PT/ES (artifact + steering builders, messages)
│   ├── evals/run-evals.js            ← local eval harness (your API key; --dry-run offline)
│   └── test.js                       ← smoke test (node mcp/test.js — 181 assertions)
├── hooks/                            ← local automation (PostToolUse, SessionStart, pre-commit)
├── AGENTS.md                         ← portable workflow (Codex/Gemini/Cursor/Windsurf/…)
├── .cursor/ · .windsurf/ · .github/copilot-instructions.md · GEMINI.md   ← per-tool rules
├── integrations/                     ← MCP config templates per tool (placeholder path; `mcp-config` fills it)
├── examples/demo-project/            ← a worked feature (v1.5 shape) that passes doctor + trace
├── INTEGRATIONS.md                   ← how to use it in every tool (+ MCP configs)
├── package.json · LICENSE · CHANGELOG.md · CLAUDE.md
└── INSTALL.md
```

See [INSTALL.md](./INSTALL.md) for persistent installation, hooks, the git pre-commit validator,
and the eval harness.
