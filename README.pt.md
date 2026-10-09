# dev-spec-driven

[English](./README.md) · **Português** · [Español](./README.es.md)

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node: >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![dependencies: 0](https://img.shields.io/badge/dependencies-0-success.svg)](./package.json)
[![tests: local suites](https://img.shields.io/badge/tests-local%20suites-success.svg)](./CONTRIBUTING.md#developing)
[![CI: none (local only)](https://img.shields.io/badge/CI-none%20·%20local%20only-informational.svg)](#porque-não-há-github-actions)

**Desenvolvimento guiado por specs, com o rigor à medida da alteração.** Descreves uma alteração; o plugin classifica-a,
escreve a spec contigo — requisitos EARS com IDs estáveis, um design, tarefas rastreáveis —, espera pela tua aprovação em
cada gate e só dá uma tarefa por concluída com uma execução registada da sua verificação. Um só fluxo, mais **tracks**
que se combinam para o que cada funcionalidade precisa (+tdd, +saas, +ai, +sec, +privacy, +dist, +api, +ui, +obs, +data,
ou os teus), servido por um **servidor MCP local e sem dependências**: sem `npm install`, sem rede, sem cloud, sem GitHub
Actions, sem custo por execução. Um plugin do Claude Code que também funciona em qualquer cliente MCP e numa CLI simples —
em inglês, português (PT-PT e PT-BR) e espanhol.

## Requisitos

- **Claude Code 2.1.139 ou posterior** (`claude --version`) — os hooks correm em exec form (o `node` arranca
  diretamente, sem shell em cada chamada), que as versões anteriores não correm. Ou qualquer cliente MCP: Claude
  Desktop, Cursor, Windsurf, VS Code / Copilot, Gemini CLI, Codex CLI… ([INTEGRATIONS.md](./INTEGRATIONS.md)).
- **Node.js ≥ 18** no PATH (`node --version`). O Node 18 já chegou ao fim de vida: recomenda-se o 20 ou posterior (as
  suites passam no 18, no 22 e no 24).
- git — opcional: um branch por funcionalidade, o commit em que uma execução foi feita, o merge driver do estado das specs.

## Instalação

No Claude Code:

```text
/plugin marketplace add linofcp007/dev-spec-driven
/plugin install dev-spec-driven@dev-spec-driven-marketplace
```

O `/help` passa a listar os comandos `/dev-spec-driven:*` e o `/mcp` o servidor `spec-driven`. Para o experimentar só
numa sessão: `git clone https://github.com/linofcp007/dev-spec-driven.git` e `claude --plugin-dir ./dev-spec-driven`.

Outras ferramentas: o [INTEGRATIONS.md](./INTEGRATIONS.md) tem a configuração MCP de cada uma (ou corre
`node cli/dev-spec.js mcp-config all`) e os ficheiros de regras que levam o fluxo. Sempre ativo a partir de um clone, os
hooks, as guardas, a linha de estado, as tuas predefinições e o autocompletar da shell: [INSTALL.md](./INSTALL.md).

## Começar em 5 minutos

Escolhe uma alteração pequena e real no teu próprio repositório — um comportamento, um ou dois ficheiros, testável com o
teu comando de testes. Aqui: o `greet()` deve recusar um nome vazio.

**1. Descreve-a.**

```text
/dev-spec-driven:spec Mensagem de erro mais clara quando greet() recebe um nome vazio
```

Fase 0: o classificador local (`spec_classify` — sinais por palavras-chave, sem modelo) não encontra sinais de nenhum
track, por isso fica só o core, e sugere o tamanho **xs**: uma *alteração*. O Claude mostra-te o modo, os tracks e o
tamanho; tu confirmas. (Num projeto sem `.specs/`, cria primeiro os ficheiros de steering.)

**2. O plano é um só ficheiro.** Uma alteração é um único `.specs/<feature>/change.md` — resumo, 1–3 critérios EARS, a
abordagem, 1–3 tarefas. O Claude escreve o rascunho; tu lês:

```markdown
## Critérios de Aceitação (EARS)
1. **US-1.AC-1** — SE greet for chamado com um nome vazio ou em branco ENTÃO O SISTEMA DEVE lançar um TypeError
   com a mensagem "name is required".

## Tarefas
- [ ] 1. [US1] Proteger o greet contra um nome vazio, com o seu teste
  - _Requirements: US-1.AC-1_
  - _Implements: src/greet.js, test/greet.test.js_
  - _Verify: node --test test/greet.test.js_
```

Cada tarefa indica o critério que prova (`_Requirements:_`) e o comando que o prova (`_Verify:_`).

**3. Uma aprovação.** Dizes que sim; o Claude regista-a (`spec_approve {through: "tasks"}` — ou escreves tu
`/approve <feature> --through tasks`). Primeiro corre o gate, que recusa um placeholder do template, um critério sem
DEVE ou um que nenhuma tarefa cubra; a aprovação guarda um snapshot, por isso uma edição posterior aparece como alterada.

**4. Executa.** `/executeTask` — o Claude implementa a tarefa 1, corre o seu `_Verify:_` e regista a execução (comando,
código de saída, resumo). Uma execução que falha recusa a marcação; sem execução, não há marcação. Quando o Claude não a
consegue correr, pede-te o output — ou dá-te a linha
`dev-spec done <feature> 1 --run` para a correres tu.

**5. Fecha.** O `/spec-finish` verifica a cadeia inteira (tarefas abertas ou por verificar, edições depois de uma
aprovação, placeholders), pede uma execução nova da tua suite completa, escreve o resumo de merge a partir da spec e pede
a tua aprovação final. Depois escolhes: fazer o merge localmente ou manter o branch. Nada é enviado sem ti.

Perdeste-te? O `/spec <feature>` retoma no único passo seguinte. Preferes uma versão guiada no teu repositório? O
`/dev-spec-driven:spec-tour` leva uma alteração pequena e real por todos os gates e explica cada um à medida que acontece.

### Funcionalidades maiores

A Fase 0 sugere um tamanho; confirmas ou escolhes outro:

- **xs** — uma alteração: um `change.md`, uma aprovação do plano (acima).
- **s** — uma história: requisitos, design e tarefas (com +tdd / +ai até ao plano de testes / de avaliação) aprovados
  numa só chamada, só com as secções core de cada track.
- **m / l** — a cadeia completa, cada fase aprovada: classificação → requisitos → design → plano de testes / de
  avaliação → os testes que falham (+tdd / +ai, antes de qualquer código) → tarefas.

Em todos os tamanhos: EARS em cada critério, rastreabilidade, o gate de evidência (o `doctor`, o `spec_finish` e a linha
"Precisa de atenção" do `ROADMAP.md` listam cada tarefa por verificar com o motivo) e o gate de fecho. Os tracks
combinam-se — um webhook do Stripe num SaaS multi-inquilino que resume faturas com um LLM é `core +tdd +saas +ai`:

| Track | Acrescenta |
|---|---|
| **core** *(sempre)* | Requisitos EARS → design → tarefas → execução, cada fase aprovada |
| **+tdd** | Um plano de testes, os testes que falham primeiro, red → green → refactor dentro de cada tarefa |
| **+saas** | Desempenho, escala, multi-inquilino, observabilidade, custo; testes de carga |
| **+ai** | Conjuntos de evals e limiares, prompts como código, custo de tokens, segurança, migrações de modelo |
| **+sec** | Modelo de ameaças (STRIDE), autenticação e autorização, segredos e chaves, testes de segurança |
| **+privacy** | RGPD: inventário de dados pessoais, fundamento de licitude, conservação e eliminação, direitos dos titulares, AIPD |
| **+dist** | Modelo de consistência, escritas duplas → outbox transacional / saga, entrega e idempotência, modos de falha |
| **+api** | O ficheiro do contrato, versionamento e compatibilidade, erros problem+json, paginação / idempotência, limites de taxa |
| **+ui** | Design system, os estados da interface, acessibilidade (WCAG 2.2 AA), design responsivo e i18n, um orçamento de desempenho |
| **+obs** | SLOs e orçamentos de erro, telemetria, alertas e runbooks, lançamento e reversão |
| **+data** | Contratos de dados, qualidade de dados, reexecuções e backfills idempotentes, linhagem, retenção |

Um track pode ser acrescentado ou desligado mais tarde (`/spec-change <feature> track +sec`). Os tracks da tua equipa:
`/spec-setup tracks` — um pack de exemplo para copiar é o `examples/track-packs/mobile`. Um bug segue pelo `/spec-bugfix`
(reproduzir → a causa raiz com evidência → a tua aprovação → um teste de regressão que falha → a correção); uma questão em
aberto pelo `/spec-spike` (uma investigação com prazo que termina numa decisão). Numa funcionalidade com muitas tarefas
independentes, o `/executeTask --subagents` põe um implementador e um revisor em cada tarefa e verifica cada problema
apontado antes de ele custar uma ronda de correções (cerca de 2–3× os tokens; adaptado do
[obra/superpowers](https://github.com/obra/superpowers), MIT).

## Comandos por atividade

22 comandos de barra. Só o `/spec` e o `/spec-bugfix` são oferecidos ao modelo (pode iniciá-los por iniciativa
própria); os outros escreves tu, por isso as descrições deles ficam fora do contexto do modelo. Como plugin têm
namespace (`/dev-spec-driven:spec`); noutros clientes MCP são os prompts do servidor.

| Atividade | Comando | O que faz |
|---|---|---|
| planear | `/spec [feature \| ideia] [fase]` | Inicia uma funcionalidade (Fase 0: modo, tracks, tamanho) ou retoma uma no passo seguinte; o nome de uma fase corre essa fase |
| | `/spec-bugfix` | Reproduzir → causa raiz com evidência → aprovação → teste de regressão que falha → correção |
| | `/spec-spike` | Uma investigação com prazo que termina numa decisão (go / no-go / pivot) |
| | `/clarify [--grill]` | As lacunas dos requisitos antes do design; `--grill` interroga a tua compreensão |
| | `/spec-tour` | Uma visita guiada de 10 minutos: uma alteração pequena e real por todos os gates |
| aprovar | `/approve [fase \| --through f]` | Regista a tua aprovação de uma fase (`--role`, `--force`, `--revoke`) |
| | `/spec-doctor [--deep]` | Pronta para avançar? `--deep` junta a revisão semântica do crítico da spec |
| | `/spec-change [impact \| decide \| track ±x]` | Depois de uma aprovação: o que uma edição afeta, uma entrada no registo de decisões, um track ligado ou desligado |
| executar | `/executeTask [--subagents] \| commit` | A tarefa seguinte (ou a tarefa N) com evidência; `commit` escreve um commit que cita a spec |
| | `/eval [run \| baseline \| migrate]` | (+ai) O harness de evals local com a tua chave de API; uma migração de modelo condicionada por ele |
| rever | `/spec-review [branch \| converge \| simplify \| feedback \| prompt]` | Revisão face à spec — o branch, uma passagem de convergência ou de simplificação, comentários de revisão, uma alteração de prompt |
| fechar | `/spec-finish` | Verifica que está mesmo feito, escreve o resumo de merge e depois faz o merge localmente ou mantém o branch |
| | `/feature [archive \| restore \| rename \| remove \| flow]` | O ciclo de vida de uma funcionalidade; `flow design-first` para trabalho que parte de uma arquitetura |
| adotar | `/spec-adopt [scan \| reverse \| coverage \| import]` | Código existente: inventariá-lo, gerar specs a partir dele, medir a cobertura, importar Kiro / spec-kit / OpenSpec / planos / BMAD |
| relatórios | `/spec-status` | Tracks, fase, tarefas, verificação — de uma funcionalidade ou de todas |
| | `/roadmap [depend \| backlog \| milestone]` | Progresso, dependências, ETAs, marcos → `.specs/ROADMAP.md` (`--html`) |
| | `/spec-report [catalog \| drift \| metrics \| changelog \| export]` | O catálogo vivo, o drift desde o fecho, métricas e uma retrospetiva, notas de versão, exportações para stakeholders |
| configurar | `/spec-setup [init \| guard \| statusline \| superpowers \| templates \| tracks]` | `.specs/` e steering, modo guarda, a linha de estado, a precedência sobre o superpowers, os teus templates e tracks |
| | `/spec-upgrade` | Depois de atualizar o plugin: audita o `.specs/` face às regras atuais e depois aplica as migrações seguras |
| atalhos | `/ds` · `/dss` · `/dsx` | `/spec` · `/spec-status` · `/executeTask` |

**As aprovações são tuas.** Com a guarda de aprovações ligada (`/spec-setup init`, `approvalGuard` ask / deny), a
aprovação de um agente, a remoção de uma funcionalidade ou uma escrita do estado das specs pergunta-te primeiro ou é
recusada. Trava acidentes e atalhos casuais, não um agente determinado com uma shell — uma proteção, não uma sandbox
([INSTALL.md](./INSTALL.md)). Também usas o superpowers? O dev-spec-driven cobre as skills dele de planeamento, TDD,
depuração, verificação, revisão e fecho no trabalho de funcionalidades; o `/spec-setup superpowers` escreve essa
precedência no teu `CLAUDE.md`.

## O servidor MCP — 32 ferramentas

O `spec-driven` é Node simples (stdio, sem dependências, sem rede). Todas as superfícies — os comandos, a CLI, qualquer
cliente MCP — chamam o mesmo motor:

| Ferramenta | O que faz |
|---|---|
| `spec_classify` | Fase 0: os tracks e um tamanho sugerido a partir de uma descrição (sinais locais por palavras-chave, EN / PT / ES — sem modelo) |
| `spec_init` | O `.specs/` e o steering dos tracks; definições do projeto: `lang`, `guard`, `stopCheck`, `checks`, `approvalRoles`, `evidence`, `approvalGuard` |
| `spec_create` | Uma funcionalidade para os seus tracks e `size` (`xs` = um `change.md`); `kind` bugfix · spike, `brownfield`, `flow: "design-first"`, `branch` |
| `spec_import` | Uma spec do Kiro, spec-kit ou OpenSpec, um plano (Claude Code, Cursor, ExecPlan do Codex, fluidplan) ou documentos BMAD como funcionalidade — ou o steering do Kiro / as regras do Cursor como steering; `dryRun` |
| `spec_status` | O tipo, o fluxo, os tracks, a fase, as tarefas e as secções do design de uma funcionalidade; sem `name`, todas |
| `spec_next_action` | "Estás aqui → faz isto a seguir": rever → preencher → corrigir → aprovar → implementar → verificar → fechar |
| `spec_next_task` | A próxima tarefa aberta cujas `_Depends:_` estão feitas; `batch` para tarefas paralelas `[P]`, `waves` para as vagas de execução |
| `spec_task_brief` | Um brief autocontido de uma tarefa — os ACs e os testes por extenso, o contexto do design, o steering com âmbito, a definição de concluído |
| `spec_complete_task` | Marca uma tarefa com a execução do seu `_Verify:_` (comando, código de saída, resumo) — uma execução falhada recusa-a; `undo` desmarca |
| `spec_append_tasks` | Convergência: acrescenta tarefas de seguimento em `Fase: Convergência`, sem tocar nas existentes |
| `spec_approve` | Regista a aprovação de uma fase pelo utilizador — recusada enquanto as verificações dela falham; `through`, `role`, `force` (+ `reason`, `expires`), `revoke` |
| `spec_impact` | O que uma edição depois de uma aprovação afeta (ACs, secções, testes, tarefas); `reopen` desmarca as tarefas feitas afetadas (nunca as de um critério removido: o `retire` lista-as) |
| `spec_add_track` | Liga um track numa funcionalidade existente (aditivo) — `remove: true` desliga um, sem apagar ficheiros |
| `spec_feature` | Arquiva · restaura · renomeia · remove uma funcionalidade (remover exige `confirm: true`), ou define o seu `flow` |
| `spec_decide` | Acrescenta uma decisão ou uma descoberta (`D-n`) ao `decisions.md`, com o que afeta (verificado) |
| `ears_validate` | Valida critérios EARS — SHALL / DEVE / DEBE, IDs estáveis, palavras vagas, placeholders (EN / PT / ES) |
| `trace_check` | Cada AC coberto por uma tarefa (e por um teste em +tdd), referências fantasma; `code` procura T-IDs nos ficheiros de teste, `matrix` a matriz de rastreabilidade |
| `spec_doctor` | Um health-check → "pronta para avançar?" (EARS, placeholders, trace, secções, evidência, gates, steering) |
| `spec_clarify` | As ambiguidades e lacunas dos requisitos, como perguntas, antes do design |
| `spec_finish` | Fecha uma funcionalidade: bloqueios, avisos, as verificações a correr de novo, um resumo de merge a partir da spec; `write` regista a baseline de drift |
| `spec_drift` | Os ficheiros de funcionalidades fechadas alterados, em falta ou novos desde o `spec_finish` |
| `spec_stop_check` | O gate de evidência do fim do turno para clientes só MCP: esta mensagem de "feito" seria devolvida? |
| `spec_log` | Os commits que citam cada tarefa (+ a verificação red-first do +tdd) a partir do texto de `git log` que passas — o servidor nunca corre o git |
| `spec_metrics` | Lead times, retrabalho, aprovações forçadas, pedidos de alteração, taxa de sucesso da evidência; `write` um `retro.md` pré-preenchido |
| `spec_roadmap` | Progresso, dependências, ETAs a partir da velocidade das tarefas marcadas, marcos, funcionalidades que se sobrepõem; `write` → `.specs/ROADMAP.md` (+ `html`) |
| `spec_roadmap_edit` | `kind`: `depend` (deteta ciclos) · `backlog` (planeadas, ainda sem spec) · `milestone` (uma data-alvo para um conjunto de funcionalidades) |
| `spec_export` | `format`: html / md para stakeholders, csv (matriz de rastreabilidade), gherkin, jira / linear, adr, `catalog` (`.specs/SPECS.md`), `changelog` (notas de versão) |
| `spec_scan` | Inventário brownfield — stack, rotas, testes, pontos de entrada, nomes de variáveis de ambiente, migrações; `coverage: true` — a parte do código que as specs indicam |
| `spec_upgrade` | Depois de atualizar o plugin: audita o `.specs/` face às regras atuais; `apply` aplica as migrações seguras (nunca edita uma spec) |
| `spec_templates` | Os scaffolds da equipa em `.specs/templates/`: list · init · check |
| `spec_tracks` | Os tracks da equipa, packs em `.specs/tracks/<nome>/`: list · init · check |
| `steering_scaffold` | Um ficheiro de steering a partir do template (constitution, glossary, …) ou um personalizado com âmbito |

No Claude Code, o `/mcp` lista todas menos `spec_stop_check` e `spec_log` — o hook Stop e a CLI do plugin fazem esse
trabalho; ambas continuam a responder pelo nome. O servidor serve também um prompt MCP por comando e as specs do projeto
como recursos `specs://` só de leitura ([INTEGRATIONS.md](./INTEGRATIONS.md)).

## A CLI `dev-spec`

O mesmo motor em qualquer terminal: `node cli/dev-spec.js <comando>` (ou `dev-spec`, se a puseres no PATH); `--json`
mostra o que a ferramenta MCP devolve, `dev-spec <comando> --help` as opções de um comando. Uma instalação como plugin não
põe `dev-spec` no PATH, por isso cada mensagem que te pede para a correr mostra a linha executável,
`node "<plugin>/cli/dev-spec.js" …`; o autocompletar para PowerShell, bash, zsh e fish está no [INSTALL.md](./INSTALL.md).

```text
planear     classify · signals · init · steering · templates · tracks · create · bugfix · spike · import · clarify · ears
progresso   list · status · next-action · next · brief · done · undone · append-tasks · approve · impact · decide · add-track · feature
verificar   doctor · trace · finish · drift · stop-check · log · evals · upgrade
relatórios  roadmap · depend · backlog · milestone · catalog · export · changelog · metrics · scan · coverage
configurar  mcp-config · rules · prompts · statusline · merge-state · completion · bundle · version
```

## Línguas

A skill responde na tua língua e escreve os artefactos nela: inglês, português europeu, português do Brasil ou espanhol
(`lang`: `en` · `pt` · `pt-BR` · `es`). Define-a para um projeto (`/spec-setup init --lang pt`), para todos os projetos
novos (`DEV_SPEC_DEFAULT_LANG`) ou para uma funcionalidade. As palavras-chave EARS funcionam em todas — `SHALL` / `DEVE` /
`DEBE`, `WHEN` / `QUANDO` / `CUANDO`, … —, enquanto os IDs, os marcadores e as etiquetas (`US-1.AC-1`, `_Verify:_`, `[P]`)
são os mesmos em todas. As mensagens das ferramentas e da CLI seguem a língua da funcionalidade; as descrições dos
comandos e a ajuda da CLI estão em inglês. Este README: [English](./README.md) · [Español](./README.es.md).

## Atualizar a partir da 1.25 ou anterior

1. **Atualiza o plugin:** `/plugin marketplace update dev-spec-driven-marketplace` e depois reinicia o Claude Code (um
   clone: `git pull` e depois reinicia). A 1.26 precisa do Claude Code 2.1.139 ou posterior.
2. **Corre o `/spec-upgrade`** em cada projeto que tenha um `.specs/` — primeiro uma auditoria só de leitura, as
   migrações seguras (`--apply`) depois do teu OK; nunca edita uma spec. Volta a configurar o que aponta para a pasta do
   plugin (o merge driver, o hook de pre-commit — [INSTALL.md](./INSTALL.md) → Your plugin folder).

As tuas specs não precisam de alterações: a 1.26 mudou o nome dos comandos, não os ficheiros. Os nomes antigos deixaram
de existir — não há atalhos para eles:

| Antes da 1.26 | Agora |
|---|---|
| `/classify`, `/createSpec`, `/design`, `/testPlan`, `/evalPlan`, `/writeTests`, `/createTask`, `/next-action` | `/spec <feature> [fase]` — retoma no passo seguinte, ou corre a fase indicada |
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

Sete ferramentas MCP passaram a modos de outras: `spec_list` → `spec_status` sem `name`; `spec_backlog`, `spec_depend`,
`spec_milestone` → `spec_roadmap_edit {kind}`; `spec_catalog`, `spec_changelog` → `spec_export {format}`;
`spec_coverage` → `spec_scan {coverage: true}`. Uma chamada por um nome antigo continua a funcionar (um alias oculto); a
CLI mantém todos os seus comandos. O que mudou em cada versão: [CHANGELOG.md](./CHANGELOG.md).

## Porque não há GitHub Actions

De propósito. Todos os gates — EARS, rastreabilidade, aprovações, o gate de evidência — correm **localmente**, através do
servidor MCP incluído, dos hooks e do modelo; os teus testes, testes de carga e evals correm no teu ambiente quando
quiseres, não num runner de CI pago. As suites do próprio plugin também: `node mcp/test.js` e `node cli/test-cli.js`
(ambas têm de terminar em `0 failed`).

## Mais

- [CHANGELOG.md](./CHANGELOG.md) — cada versão e o que mudou
- [INSTALL.md](./INSTALL.md) — opções de instalação, hooks, guardas, a linha de estado, as tuas predefinições, autocompletar, desinstalar
- [INTEGRATIONS.md](./INTEGRATIONS.md) — Claude Desktop, Cursor, Windsurf, Copilot, Gemini CLI, Codex CLI, qualquer cliente MCP
- [CONTRIBUTING.md](./CONTRIBUTING.md) — desenvolver o plugin e correr as suas suites
- [docs/maintainers/](./docs/maintainers/) — as notas dos maintainers por tema (o [CLAUDE.md](./CLAUDE.md) é o índice)
- [examples/README.md](./examples/README.md) — uma spec trabalhada por inteiro que passa o `doctor` e o `trace`
- `skills/dev-spec-driven/references/` — os guias aprofundados (EARS, cada track, execução com subagentes, verificação, …)

Substitui quatro skills anteriores, cujo conteúdo continua aqui como tracks (as originais estão no histórico do git e na
release v1.8.0). Licença MIT.

## Estrutura

```
dev-spec-driven/                      ← raiz do plugin
├── .claude-plugin/                   ← plugin.json + marketplace.json
├── skills/dev-spec-driven/
│   ├── SKILL.md                      ← o fluxo por tracks (escrito em inglês; funciona em EN / PT / ES)
│   └── references/                   ← a biblioteca aprofundada, lida quando preciso (EARS, fases, tracks, evals, segurança, …)
├── commands/                         ← 22 comandos de barra (também os prompts MCP)
├── agents/                           ← spec-implementer + spec-reviewer + spec-verifier + spec-critic + spec-simplifier
├── evals/                            ← evals do plugin para `claude plugin eval` (ativação EN/PT/ES + comportamento, com fixtures)
├── cli/dev-spec.js                   ← CLI universal (funciona em qualquer ferramenta / shell)
├── mcp/
│   ├── server.js                     ← servidor MCP local por stdio (32 ferramentas + prompts + recursos, sem dependências)
│   ├── servers.json                  ← registo MCP do plugin (plugin.json → mcpServers)
│   ├── lib/spec.js                   ← a fachada do motor (o único objeto que o servidor, a CLI e os hooks carregam)
│   ├── lib/engine/                   ← o motor: 22 módulos, um por assunto (core, files, state, markdown, tracks, classify, scaffold, tasks, evidence, trace, gates, doctor, finish, scan, …) + um importador por ferramenta de origem (import/)
│   ├── lib/i18n.js · lib/i18n/       ← conteúdo localizado (en · pt · es) + a derivação pt-BR
│   ├── lib/prompts-resources.js      ← prompts MCP (um por comando) + recursos specs://
│   ├── evals/run-evals.js            ← harness de evals local (a tua chave de API; --dry-run offline)
│   └── test.js · tests/              ← a suite MCP, um ficheiro por área (cli/test-cli.js + cli/tests/: a suite da CLI)
├── scripts/                          ← build.js · test-runner.js (o runner das duas suites) · test-docker.js (contentores Linux)
├── hooks/                            ← verificações ao gravar, estado no SessionStart, gate de evidência Stop / SubagentStop, registo da evidência observada, guardas opcionais, pre-commit
├── AGENTS.md                         ← fluxo portável (Codex / Gemini / Cursor / Windsurf / …)
├── .cursor/ · .windsurf/ · .github/copilot-instructions.md · GEMINI.md   ← regras por ferramenta
├── integrations/                     ← templates de configuração MCP por ferramenta (o `mcp-config` preenche o caminho)
├── examples/demo-project/            ← uma funcionalidade trabalhada no formato atual (examples/README.md) que passa o doctor + trace
├── docs/maintainers/                 ← notas dos maintainers por tema (o CLAUDE.md é o índice curto)
└── INSTALL.md · INTEGRATIONS.md · CONTRIBUTING.md · CHANGELOG.md · package.json · LICENSE
```
