# dev-spec-driven

[English](./README.md) · [Português](./README.pt.md) · **Español**

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node: >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![dependencies: 0](https://img.shields.io/badge/dependencies-0-success.svg)](./package.json)
[![tests: local suites](https://img.shields.io/badge/tests-local%20suites-success.svg)](./CONTRIBUTING.md#developing)
[![CI: none (local only)](https://img.shields.io/badge/CI-none%20·%20local%20only-informational.svg)](#por-qué-no-hay-github-actions)

**Desarrollo guiado por specs, con el rigor a la medida del cambio.** Describes un cambio; el plugin lo clasifica, escribe
la spec contigo — requisitos EARS con IDs estables, un diseño, tareas trazables —, espera tu aprobación en cada gate y
solo da una tarea por terminada con una ejecución registrada de su verificación. Un solo flujo, más **tracks** que se
combinan para lo que necesita cada función (+tdd, +saas, +ai, +sec, +privacy, +dist, +api, +ui, +obs, +data, o los
tuyos), servido por un **servidor MCP local y sin dependencias**: sin `npm install`, sin red, sin nube, sin GitHub
Actions, sin coste por ejecución. Un plugin de Claude Code que también funciona en cualquier cliente MCP y en una CLI
sencilla — en inglés, portugués (PT-PT y PT-BR) y español.

## Requisitos

- **Claude Code 2.1.139 o posterior** (`claude --version`) — los hooks se ejecutan en exec form (`node` arranca
  directamente, sin shell en cada llamada), que las versiones anteriores no ejecutan. O cualquier cliente MCP: Claude
  Desktop, Cursor, Windsurf, VS Code / Copilot, Gemini CLI, Codex CLI… ([INTEGRATIONS.md](./INTEGRATIONS.md)).
- **Node.js ≥ 18** en el PATH (`node --version`). Node 18 ya llegó al final de su vida útil: se recomienda la 20 o
  posterior (las suites pasan en la 18, la 22 y la 24).
- git — opcional: una rama por función, el commit sobre el que se hizo una ejecución, el merge driver del estado de las
  specs.

## Instalación

En Claude Code:

```text
/plugin marketplace add linofcp007/dev-spec-driven
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

Después, `/help` lista los comandos `/dev-spec-driven:*` y `/mcp` el servidor `spec-driven`. Para probarlo solo en una
sesión: `git clone https://github.com/linofcp007/dev-spec-driven.git` y `claude --plugin-dir ./dev-spec-driven`.

Otras herramientas: [INTEGRATIONS.md](./INTEGRATIONS.md) tiene la configuración MCP de cada una (o ejecuta
`node cli/dev-spec.js mcp-config all`) y los ficheros de reglas que llevan el flujo. Siempre activo desde un clon, los
hooks, las guardias, la línea de estado, tus valores por defecto y el autocompletado de la shell:
[INSTALL.md](./INSTALL.md).

## Inicio rápido en 5 minutos

Elige un cambio pequeño y real en tu propio repositorio — un comportamiento, uno o dos ficheros, comprobable con tu propio
comando de pruebas. Aquí: `greet()` debe rechazar un nombre vacío.

**1. Descríbelo.**

```text
/dev-spec-driven:spec Mensaje de error más claro cuando greet() recibe un nombre vacío
```

Fase 0: el clasificador local (`spec_classify` — señales por palabras clave, sin modelo) no encuentra señales de ningún
track, así que queda solo el core, y sugiere el tamaño **xs**: un *cambio*. Claude te muestra el modo, los tracks y el
tamaño; tú confirmas. (En un proyecto sin `.specs/`, primero crea los ficheros de steering.)

**2. El plan es un solo fichero.** Un cambio es un único `.specs/<feature>/change.md` — resumen, 1–3 criterios EARS, el
enfoque, 1–3 tareas. Claude escribe el borrador; tú lo lees:

```markdown
## Criterios de Aceptación (EARS)
1. **US-1.AC-1** — SI greet se llama con un nombre vacío o en blanco ENTONCES EL SISTEMA DEBE lanzar un TypeError
   con el mensaje "name is required".

## Tareas
- [ ] 1. [US1] Proteger greet frente a un nombre vacío, con su prueba
  - _Requirements: US-1.AC-1_
  - _Implements: src/greet.js, test/greet.test.js_
  - _Verify: node --test test/greet.test.js_
```

Cada tarea indica el criterio que demuestra (`_Requirements:_`) y el comando que lo demuestra (`_Verify:_`).

**3. Una aprobación.** Dices que sí; Claude la registra (`spec_approve {through: "tasks"}` — o escribes tú
`/approve <feature> --through tasks`). Primero se ejecuta el gate, que rechaza un placeholder de la plantilla, un criterio
sin DEBE o uno que ninguna tarea cubra; la aprobación guarda una instantánea, así que una edición posterior aparece como
cambiada.

**4. Ejecuta.** `/executeTask` — Claude implementa la tarea 1, ejecuta su `_Verify:_` y registra la ejecución (comando,
código de salida, resumen). Una ejecución que falla rechaza la marca; sin ejecución, no hay marca. Cuando Claude no puede
ejecutarla, te pide la salida — o te da la línea
`dev-spec done <feature> 1 --run` para que la ejecutes tú.

**5. Cierra.** `/spec-finish` comprueba toda la cadena (tareas abiertas o sin verificar, ediciones después de una
aprobación, placeholders), pide una ejecución nueva de tu suite completa, redacta el resumen del merge a partir de la spec
y pide tu aprobación final. Después eliges: hacer el merge en local o mantener la rama. No se envía nada sin ti.

¿Te has perdido? `/spec <feature>` retoma en el único paso siguiente. ¿Prefieres una versión guiada en tu repositorio?
`/dev-spec-driven:spec-tour` lleva un cambio pequeño y real por todos los gates y explica cada uno a medida que ocurre.

### Funciones más grandes

La Fase 0 sugiere un tamaño; lo confirmas o eliges otro:

- **xs** — un cambio: un `change.md`, una aprobación del plan (arriba).
- **s** — una historia: requisitos, diseño y tareas (con +tdd / +ai hasta el plan de pruebas / de evaluación) aprobados
  en una sola llamada, solo con las secciones core de cada track.
- **m / l** — la cadena completa, cada fase aprobada: clasificación → requisitos → diseño → plan de pruebas / de
  evaluación → las pruebas que fallan (+tdd / +ai, antes de cualquier código) → tareas.

En todos los tamaños: EARS en cada criterio, trazabilidad, el gate de evidencia (el `doctor`, `spec_finish` y la línea
"Necesita atención" del `ROADMAP.md` listan cada tarea sin verificar con su motivo) y el gate de cierre. Los tracks se
combinan — un webhook de Stripe en un SaaS multiinquilino que resume facturas con un LLM es `core +tdd +saas +ai`:

| Track | Añade |
|---|---|
| **core** *(siempre)* | Requisitos EARS → diseño → tareas → ejecución, cada fase aprobada |
| **+tdd** | Un plan de pruebas, las pruebas que fallan primero, red → green → refactor dentro de cada tarea |
| **+saas** | Rendimiento, escala, multiinquilino, observabilidad, coste; pruebas de carga |
| **+ai** | Conjuntos de evals y umbrales, prompts como código, coste de tokens, seguridad, migraciones de modelo |
| **+sec** | Modelo de amenazas (STRIDE), autenticación y autorización, secretos y claves, pruebas de seguridad |
| **+privacy** | RGPD: inventario de datos personales, base de legitimación, conservación y supresión, derechos de los interesados, EIPD |
| **+dist** | Modelo de consistencia, escrituras duales → outbox transaccional / saga, entrega e idempotencia, modos de fallo |
| **+api** | El fichero del contrato, versionado y compatibilidad, errores problem+json, paginación / idempotencia, límites de tasa |
| **+ui** | Design system, los estados de la interfaz, accesibilidad (WCAG 2.2 AA), diseño adaptable e i18n, un presupuesto de rendimiento |
| **+obs** | SLOs y presupuestos de errores, telemetría, alertas y runbooks, despliegue y reversión |
| **+data** | Contratos de datos, calidad de datos, reejecuciones y backfills idempotentes, linaje, retención |

Un track se puede añadir o desactivar más adelante (`/spec-change <feature> track +sec`). Los tracks de tu equipo:
`/spec-setup tracks` — un pack de ejemplo para copiar es `examples/track-packs/mobile`. Un bug pasa por `/spec-bugfix`
(reproducir → la causa raíz con evidencia → tu aprobación → una prueba de regresión que falla → la corrección); una
pregunta abierta por `/spec-spike` (una investigación con plazo que termina en una decisión). En una función con muchas
tareas independientes, `/executeTask --subagents` pone un implementador y un revisor en cada tarea y verifica cada
hallazgo antes de que cueste una ronda de correcciones (unas 2–3× los tokens; adaptado de
[obra/superpowers](https://github.com/obra/superpowers), MIT).

## Comandos por actividad

22 comandos de barra. Solo `/spec` y `/spec-bugfix` se ofrecen al modelo (puede iniciarlos por su cuenta); los demás los
escribes tú, así que sus descripciones quedan fuera de su contexto. Como plugin tienen namespace (`/dev-spec-driven:spec`);
en otros clientes MCP son los prompts del servidor.

| Actividad | Comando | Qué hace |
|---|---|---|
| planificar | `/spec [feature \| idea] [fase]` | Inicia una función (Fase 0: modo, tracks, tamaño) o retoma una en su paso siguiente; el nombre de una fase ejecuta esa fase |
| | `/spec-bugfix` | Reproducir → causa raíz con evidencia → aprobación → prueba de regresión que falla → corrección |
| | `/spec-spike` | Una investigación con plazo que termina en una decisión (go / no-go / pivot) |
| | `/clarify [--grill]` | Los huecos de los requisitos antes del diseño; `--grill` pone a prueba tu comprensión |
| | `/spec-tour` | Una visita guiada de 10 minutos: un cambio pequeño y real por todos los gates |
| aprobar | `/approve [fase \| --through f]` | Registra tu aprobación de una fase (`--role`, `--force`, `--revoke`) |
| | `/spec-doctor [--deep]` | ¿Lista para avanzar? `--deep` añade la revisión semántica del crítico de la spec |
| | `/spec-change [impact \| decide \| track ±x]` | Después de una aprobación: lo que toca una edición, una entrada en el registro de decisiones, un track activado o desactivado |
| ejecutar | `/executeTask [--subagents] \| commit` | La tarea siguiente (o la tarea N) con evidencia; `commit` redacta un commit que cita la spec |
| | `/eval [run \| baseline \| migrate]` | (+ai) El harness de evals local con tu propia clave de API; una migración de modelo condicionada a él |
| revisar | `/spec-review [branch \| converge \| simplify \| feedback \| prompt]` | Revisión frente a la spec — la rama, una pasada de convergencia o de simplificación, comentarios de revisión, un cambio de prompt |
| cerrar | `/spec-finish` | Comprueba que está realmente terminada, redacta el resumen del merge y después hace el merge en local o mantiene la rama |
| | `/feature [archive \| restore \| rename \| remove \| flow]` | El ciclo de vida de una función; `flow design-first` para el trabajo que parte de una arquitectura |
| adoptar | `/spec-adopt [scan \| reverse \| coverage \| import]` | Código existente: inventariarlo, generar specs a partir de él, medir la cobertura, importar Kiro / spec-kit / OpenSpec / planes / BMAD |
| informes | `/spec-status` | Tracks, fase, tareas, verificación — de una función o de todas |
| | `/roadmap [depend \| backlog \| milestone]` | Progreso, dependencias, ETAs, hitos → `.specs/ROADMAP.md` (`--html`) |
| | `/spec-report [catalog \| drift \| metrics \| changelog \| export]` | El catálogo vivo, el drift desde el cierre, métricas y una retrospectiva, notas de versión, exportaciones para stakeholders |
| configurar | `/spec-setup [init \| guard \| statusline \| superpowers \| templates \| tracks]` | `.specs/` y steering, modo guardia, la línea de estado, la precedencia sobre superpowers, tus plantillas y tracks |
| | `/spec-upgrade` | Después de actualizar el plugin: audita `.specs/` frente a las reglas actuales y luego aplica las migraciones seguras |
| atajos | `/ds` · `/dss` · `/dsx` | `/spec` · `/spec-status` · `/executeTask` |

**Las aprobaciones son tuyas.** Con la guardia de aprobaciones activada (`/spec-setup init`, `approvalGuard` ask / deny),
la aprobación de un agente, la eliminación de una función o una escritura del estado de las specs te pregunta primero o se
rechaza. Frena accidentes y atajos casuales, no a un agente decidido con una shell — una barrera, no una sandbox
([INSTALL.md](./INSTALL.md)). ¿Usas también superpowers? dev-spec-driven cubre sus skills de planificación, TDD,
depuración, verificación, revisión y cierre en el trabajo de funciones; `/spec-setup superpowers` escribe esa precedencia
en tu `CLAUDE.md`.

## El servidor MCP — 32 herramientas

`spec-driven` es Node puro (stdio, sin dependencias, sin red). Todas las superficies — los comandos, la CLI, cualquier
cliente MCP — llaman al mismo motor:

| Herramienta | Qué hace |
|---|---|
| `spec_classify` | Fase 0: los tracks y un tamaño sugerido a partir de una descripción (señales locales por palabras clave, EN / PT / ES — sin modelo) |
| `spec_init` | `.specs/` y el steering de los tracks; ajustes del proyecto: `lang`, `guard`, `stopCheck`, `checks`, `approvalRoles`, `evidence`, `approvalGuard` |
| `spec_create` | Una función para sus tracks y su `size` (`xs` = un `change.md`); `kind` bugfix · spike, `brownfield`, `flow: "design-first"`, `branch` |
| `spec_import` | Una spec de Kiro, spec-kit u OpenSpec, un plan (Claude Code, Cursor, ExecPlan de Codex, fluidplan) o documentos BMAD como función — o el steering de Kiro / las reglas de Cursor como steering; `dryRun` |
| `spec_status` | El tipo, el flujo, los tracks, la fase, las tareas y las secciones del diseño de una función; sin `name`, todas |
| `spec_next_action` | "Estás aquí → haz esto ahora": revisar → rellenar → corregir → aprobar → implementar → verificar → cerrar |
| `spec_next_task` | La siguiente tarea abierta cuyas `_Depends:_` están hechas; `batch` para tareas paralelas `[P]`, `waves` para las oleadas de ejecución |
| `spec_task_brief` | Un brief autocontenido de una tarea — sus ACs y pruebas completos, el contexto del diseño, el steering con ámbito, la definición de terminado |
| `spec_complete_task` | Marca una tarea con la ejecución de su `_Verify:_` (comando, código de salida, resumen) — una ejecución fallida la rechaza; `undo` la desmarca |
| `spec_append_tasks` | Convergencia: añade tareas de seguimiento en `Fase: Convergencia`, sin tocar las existentes |
| `spec_approve` | Registra la aprobación de una fase por el usuario — rechazada mientras fallan sus comprobaciones; `through`, `role`, `force` (+ `reason`, `expires`), `revoke` |
| `spec_impact` | Lo que toca una edición después de una aprobación (ACs, secciones, pruebas, tareas); `reopen` desmarca las tareas hechas afectadas (nunca las de un criterio eliminado: `retire` las lista) |
| `spec_add_track` | Activa un track en una función existente (aditivo) — `remove: true` desactiva uno, sin borrar ficheros |
| `spec_feature` | Archiva · restaura · renombra · elimina una función (eliminar exige `confirm: true`), o fija su `flow` |
| `spec_decide` | Añade una decisión o un descubrimiento (`D-n`) a `decisions.md`, con lo que afecta (comprobado) |
| `ears_validate` | Valida criterios EARS — SHALL / DEVE / DEBE, IDs estables, palabras vagas, placeholders (EN / PT / ES) |
| `trace_check` | Cada AC cubierto por una tarea (y por una prueba en +tdd), referencias fantasma; `code` busca T-IDs en los ficheros de prueba, `matrix` la matriz de trazabilidad |
| `spec_doctor` | Una revisión de salud → "¿lista para avanzar?" (EARS, placeholders, traza, secciones, evidencia, gates, steering) |
| `spec_clarify` | Las ambigüedades y los huecos de los requisitos, como preguntas, antes del diseño |
| `spec_finish` | Cierra una función: bloqueos, avisos, las comprobaciones que hay que volver a ejecutar, un resumen del merge a partir de la spec; `write` registra la línea base del drift |
| `spec_drift` | Los ficheros de funciones cerradas cambiados, ausentes o nuevos desde `spec_finish` |
| `spec_stop_check` | El gate de evidencia del final del turno para clientes solo MCP: ¿se devolvería este mensaje de "hecho"? |
| `spec_log` | Los commits que citan cada tarea (+ la comprobación red-first de +tdd) a partir del texto de `git log` que le pasas — el servidor nunca ejecuta git |
| `spec_metrics` | Lead times, retrabajo, aprobaciones forzadas, solicitudes de cambio, tasa de éxito de la evidencia; `write` un `retro.md` prerrellenado |
| `spec_roadmap` | Progreso, dependencias, ETAs a partir de la velocidad de las tareas marcadas, hitos, funciones que se solapan; `write` → `.specs/ROADMAP.md` (+ `html`) |
| `spec_roadmap_edit` | `kind`: `depend` (detecta ciclos) · `backlog` (planificadas, aún sin spec) · `milestone` (una fecha objetivo para un conjunto de funciones) |
| `spec_export` | `format`: html / md para stakeholders, csv (matriz de trazabilidad), gherkin, jira / linear, adr, `catalog` (`.specs/SPECS.md`), `changelog` (notas de versión) |
| `spec_scan` | Inventario brownfield — stack, rutas, pruebas, puntos de entrada, nombres de variables de entorno, migraciones; `coverage: true` — la parte del código que nombran las specs |
| `spec_upgrade` | Después de actualizar el plugin: audita `.specs/` frente a las reglas actuales; `apply` aplica las migraciones seguras (nunca edita una spec) |
| `spec_templates` | Las plantillas propias del equipo en `.specs/templates/`: list · init · check |
| `spec_tracks` | Los tracks propios del equipo, packs en `.specs/tracks/<nombre>/`: list · init · check |
| `steering_scaffold` | Un fichero de steering a partir de su plantilla (constitution, glossary, …) o uno personalizado con ámbito |

En Claude Code, `/mcp` lista todas menos `spec_stop_check` y `spec_log` — el hook Stop y la CLI del plugin hacen ese
trabajo; ambas siguen respondiendo por su nombre. El servidor también sirve un prompt MCP por comando y las specs del
proyecto como recursos `specs://` de solo lectura ([INTEGRATIONS.md](./INTEGRATIONS.md)).

## La CLI `dev-spec`

El mismo motor desde cualquier terminal: `node cli/dev-spec.js <comando>` (o `dev-spec`, si la pones en el PATH);
`--json` muestra lo que devuelve la herramienta MCP, `dev-spec <comando> --help` las opciones de un comando. Una
instalación como plugin no pone `dev-spec` en el PATH, así que cada mensaje que te pide ejecutarla muestra la línea
ejecutable, `node "<plugin>/cli/dev-spec.js" …`; el autocompletado para PowerShell, bash, zsh y fish está en
[INSTALL.md](./INSTALL.md).

```text
planificar  classify · signals · init · steering · templates · tracks · create · bugfix · spike · import · clarify · ears
progreso    list · status · next-action · next · brief · done · undone · append-tasks · approve · impact · decide · add-track · feature
comprobar   doctor · trace · finish · drift · stop-check · log · evals · upgrade
informes    roadmap · depend · backlog · milestone · catalog · export · changelog · metrics · scan · coverage
configurar  mcp-config · rules · prompts · statusline · merge-state · completion · bundle · version
```

## Idiomas

La skill responde en tu idioma y escribe los artefactos en él: inglés, portugués europeo, portugués de Brasil o español
(`lang`: `en` · `pt` · `pt-BR` · `es`). Fíjalo para un proyecto (`/spec-setup init --lang es`), para todos los proyectos
nuevos (`DEV_SPEC_DEFAULT_LANG`) o para una función. Las palabras clave EARS funcionan en todos — `SHALL` / `DEVE` /
`DEBE`, `WHEN` / `QUANDO` / `CUANDO`, … —, mientras que los IDs, los marcadores y las etiquetas (`US-1.AC-1`, `_Verify:_`,
`[P]`) son los mismos en todos. Los mensajes de las herramientas y de la CLI siguen el idioma de la función; las
descripciones de los comandos y la ayuda de la CLI están en inglés. Este README: [English](./README.md) ·
[Português](./README.pt.md).

## Actualizar desde la 1.25 o anterior

1. **Actualiza el plugin:** `/plugin marketplace update dev-spec-driven-marketplace` y después reinicia Claude Code (un
   clon: `git pull` y después reinicia). La 1.26 necesita Claude Code 2.1.139 o posterior.
2. **Ejecuta `/spec-upgrade`** en cada proyecto que tenga un `.specs/` — primero una auditoría de solo lectura, las
   migraciones seguras (`--apply`) después de tu OK; nunca edita una spec. Vuelve a configurar lo que apunta a la carpeta
   del plugin (el merge driver, el hook de pre-commit — [INSTALL.md](./INSTALL.md) → Your plugin folder).

Tus specs no necesitan cambios: la 1.26 renombró los comandos, no los ficheros. Los nombres antiguos dejaron de existir —
no hay atajos para ellos:

| Antes de la 1.26 | Ahora |
|---|---|
| `/classify`, `/createSpec`, `/design`, `/testPlan`, `/evalPlan`, `/writeTests`, `/createTask`, `/next-action` | `/spec <feature> [fase]` — retoma en el paso siguiente, o ejecuta la fase indicada |
| `/grill` | `/clarify <feature> --grill` |
| `/spec-ff` | `/approve <feature> --through <fase>` |
| `/spec-commit` | `/executeTask commit` |
| `/depend`, `/backlog`, `/spec-milestone` | `/roadmap depend` · `backlog` · `milestone` |
| `/prReview`, `/spec-converge`, `/spec-simplify`, `/spec-review-feedback`, `/promptReview` | `/spec-review <feature> branch` · `converge` · `simplify` · `feedback` · `prompt` |
| `/spec-impact`, `/spec-decide`, `/add-track` | `/spec-change <feature> impact` · `decide` · `track +x` / `track -x` |
| `/spec-catalog`, `/spec-drift`, `/spec-metrics`, `/spec-changelog`, `/spec-export` | `/spec-report catalog` · `drift` · `metrics` · `changelog` · `export` |
| `/scan`, `/reverse`, `/coverage`, `/spec-import` | `/spec-adopt scan` · `reverse` · `coverage` · `import` |
| `/spec-init`, `/spec-guard`, `/spec-statusline`, `/spec-superpowers`, `/spec-templates`, `/spec-tracks` | `/spec-setup init` · `guard` · `statusline` · `superpowers` · `templates` · `tracks` |
| `/migrateModel` | `/eval <feature> migrate <modelo>` |

Siete herramientas MCP pasaron a ser modos de otras: `spec_list` → `spec_status` sin `name`; `spec_backlog`,
`spec_depend`, `spec_milestone` → `spec_roadmap_edit {kind}`; `spec_catalog`, `spec_changelog` → `spec_export {format}`;
`spec_coverage` → `spec_scan {coverage: true}`. Una llamada por un nombre antiguo sigue funcionando (un alias oculto); la
CLI mantiene todos sus comandos. Lo que cambió en cada versión: [CHANGELOG.md](./CHANGELOG.md).

## Por qué no hay GitHub Actions

A propósito. Todos los gates — EARS, trazabilidad, aprobaciones, el gate de evidencia — se ejecutan **localmente**,
mediante el servidor MCP incluido, los hooks y el modelo; tus pruebas, pruebas de carga y evals se ejecutan en tu entorno
cuando quieras, no en un runner de CI de pago. Las suites del propio plugin también: `node mcp/test.js` y
`node cli/test-cli.js` (ambas deben terminar en `0 failed`).

## Más

- [CHANGELOG.md](./CHANGELOG.md) — cada versión y lo que cambió
- [INSTALL.md](./INSTALL.md) — opciones de instalación, hooks, guardias, la línea de estado, tus valores por defecto, autocompletado, desinstalar
- [INTEGRATIONS.md](./INTEGRATIONS.md) — Claude Desktop, Cursor, Windsurf, Copilot, Gemini CLI, Codex CLI, cualquier cliente MCP
- [CONTRIBUTING.md](./CONTRIBUTING.md) — desarrollar el plugin y ejecutar sus suites
- [docs/maintainers/](./docs/maintainers/) — las notas de los maintainers por tema ([CLAUDE.md](./CLAUDE.md) es su índice)
- [examples/README.md](./examples/README.md) — una spec trabajada por completo que pasa `doctor` y `trace`
- `skills/dev-spec-driven/references/` — las guías en profundidad (EARS, cada track, ejecución con subagentes, verificación, …)

Sustituye cuatro skills anteriores, cuyo contenido sigue aquí como tracks (las originales están en el historial de git y en
la release v1.8.0). Licencia MIT.

## Estructura

```
dev-spec-driven/                      ← raíz del plugin
├── .claude-plugin/                   ← plugin.json + marketplace.json
├── skills/dev-spec-driven/
│   ├── SKILL.md                      ← el flujo por tracks (escrito en inglés; funciona en EN / PT / ES)
│   └── references/                   ← la biblioteca en profundidad, leída cuando hace falta (EARS, fases, tracks, evals, seguridad, …)
├── commands/                         ← 22 comandos de barra (también los prompts MCP)
├── agents/                           ← spec-implementer + spec-reviewer + spec-verifier + spec-critic + spec-simplifier
├── evals/                            ← evals del plugin para `claude plugin eval` (activación EN/PT/ES + comportamiento, con fixtures)
├── cli/dev-spec.js                   ← CLI universal (funciona en cualquier herramienta / shell)
├── mcp/
│   ├── server.js                     ← servidor MCP local por stdio (32 herramientas + prompts + recursos, sin dependencias)
│   ├── servers.json                  ← registro MCP del plugin (plugin.json → mcpServers)
│   ├── lib/spec.js                   ← la fachada del motor (el único objeto que cargan el servidor, la CLI y los hooks)
│   ├── lib/engine/                   ← el motor: 22 módulos, uno por asunto (core, files, state, markdown, tracks, classify, scaffold, tasks, evidence, trace, gates, doctor, finish, scan, …) + un importador por herramienta de origen (import/)
│   ├── lib/i18n.js · lib/i18n/       ← contenido localizado (en · pt · es) + la derivación pt-BR
│   ├── lib/prompts-resources.js      ← prompts MCP (uno por comando) + recursos specs://
│   ├── evals/run-evals.js            ← harness de evals local (tu clave de API; --dry-run sin conexión)
│   └── test.js · tests/              ← la suite MCP, un fichero por área (cli/test-cli.js + cli/tests/: la suite de la CLI)
├── scripts/                          ← build.js · test-runner.js (el runner de las dos suites) · test-docker.js (contenedores Linux)
├── hooks/                            ← comprobaciones al guardar, estado en SessionStart, gate de evidencia Stop / SubagentStop, registro de la evidencia observada, guardias opcionales, pre-commit
├── AGENTS.md                         ← flujo portable (Codex / Gemini / Cursor / Windsurf / …)
├── .cursor/ · .windsurf/ · .github/copilot-instructions.md · GEMINI.md   ← reglas por herramienta
├── integrations/                     ← plantillas de configuración MCP por herramienta (`mcp-config` rellena la ruta)
├── examples/demo-project/            ← una función trabajada en el formato actual (examples/README.md) que pasa doctor + trace
├── docs/maintainers/                 ← notas de los maintainers por tema (CLAUDE.md es su índice corto)
└── INSTALL.md · INTEGRATIONS.md · CONTRIBUTING.md · CHANGELOG.md · package.json · LICENSE
```
