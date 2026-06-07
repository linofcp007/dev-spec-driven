"use strict";

/**
 * dev-spec-driven — localized scaffold content (EN / PT / ES). Zero-dependency, data-only.
 *
 * This module holds ALL user-facing text the engine GENERATES (feature artifacts, steering
 * stubs) and the human-readable tool messages (doctor / clarify / next-action / hooks).
 * `mcp/lib/spec.js` keeps the logic; it calls the builders here with a resolved `lang`.
 *
 * Language model: a project picks ONE language (persisted in `.specs/roadmap.json` meta.lang —
 * the single source of truth), inherited by every new feature and overridable per feature
 * (persisted in `.specs/<feature>/.state.json` lang). `spec.js` resolves the lang and passes it.
 *
 * STABLE TOKENS — never translated, the tooling matches them literally:
 *   AC/SC/test IDs (US-1.AC-1, SC-001, T-01, EC-1, NFR-1), section markers ([SaaS], [AI]),
 *   story/parallel tags ([US1], [US2], [shared], [P]), the unfilled sentinel `> **TODO**`,
 *   `[NEEDS CLARIFICATION]`, the annotation tags `_Requirements:_ / _Makes green:_ /
 *   _Affects evals:_ / _Emits metrics:_ / _Implements:_`, `**Checkpoint:**`, the ```mermaid /
 *   ```typescript fences, and the eval-harness headings `## System` / `## User Template`.
 * EARS modal/keywords ARE localized (WHEN→QUANDO→CUANDO, THE SYSTEM SHALL→O SISTEMA DEVE→
 * EL SISTEMA DEBE, …) because earsValidate recognizes all three languages. Translated headings
 * are matched by the synonym tables (SAAS_SECTIONS/AI_SECTIONS) and RE_* matchers in spec.js.
 */

const LANGS = ["en", "pt", "es"];
function normalizeLang(l) {
  const s = String(l || "en").toLowerCase().slice(0, 2);
  return LANGS.includes(s) ? s : "en";
}

// ===========================================================================
// Artifact builders, one set per language. EN is the canonical reference and
// is byte-for-byte the original output (the test suite asserts against it).
// ===========================================================================

const BUILD = {
  // -------------------------------------------------------------------- EN
  en: {
    classification(a) {
      const sig = a.signals || { tdd: [], saas: [], ai: [] };
      const sigLine = (t) =>
        a.tracks.includes(t)
          ? `- **+${t}:** ${[...new Set(sig[t] || [])].slice(0, 6).join(", ") || "[signal]"} — [why it applies]`
          : null;
      const signalLines = ["tdd", "saas", "ai"].map(sigLine).filter(Boolean).join("\n") || "- [none beyond core]";
      return (
`# Classification: ${a.name}

## Mode
Spec

## Active Tracks
${a.label}

## Signals
${signalLines}

## Blast Radius
[What breaks if this is wrong? Who is affected? Recoverable? How fast?]
${a.tracks.includes("saas") ? "\n## Hot Path?\n[Yes/No — if yes, load-test.md is required.]\n" : ""}${a.tracks.includes("ai") ? "\n## Autonomy Level\n[Advisory | Semi-autonomous | Autonomous]\n" : ""}${a.tracks.includes("saas") || a.tracks.includes("ai") ? "\n## Volume / Cost Projection\n- Launch / 6mo / 2yr: [load, ~$/month]\n" : ""}
## Compliance Tags
[GDPR | PCI | HIPAA | SOC2 | none]

${a.summary ? "## Summary\n" + a.summary + "\n" : ""}`
      );
    },

    requirements(a) {
      const saasAc = a.tracks.includes("saas")
        ? "\n5. **US-1.AC-5** — WHEN a user from tenant A requests data, THE SYSTEM SHALL NOT return any record whose tenant_id != A.\n6. **US-1.AC-6** — THE SYSTEM SHALL respond within [N]ms at P95.\n"
        : "";
      const aiAc = a.tracks.includes("ai")
        ? "\n7. **US-1.AC-7** — THE SYSTEM SHALL produce outputs rated 'good or excellent' on at least [85]% of the golden eval set.\n8. **US-1.AC-8** — IF the input contains a prompt-injection attempt, THEN THE SYSTEM SHALL ignore the injected instruction and complete the original task.\n9. **US-1.AC-9** — THE SYSTEM SHALL cost at most $[0.03] per user request at P95 size.\n"
        : "";
      return (
`# Feature: ${a.name}

## Summary
${a.summary || "[1-2 sentences: what this does and why it matters]"}

## User Stories (prioritized — each independently testable)

Priorities: **P1** = critical, a viable MVP on its own · **P2** = secondary · **P3** = enhancement.
Each story must deliver standalone value if shipped alone.

### US-1 (P1 — MVP): [Story Title]
**As a** [role], **I want** [capability], **so that** [benefit].
**Why P1:** [why this is the minimum viable slice]
**Independent Test:** Can be fully tested by [specific action] and delivers [specific value], without the other stories.

#### Acceptance Criteria (EARS)
1. **US-1.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behavior]
2. **US-1.AC-2** — WHILE [state], WHEN [trigger] THE SYSTEM SHALL [behavior]
3. **US-1.AC-3** — IF [error condition] THEN THE SYSTEM SHALL [recovery]
4. **US-1.AC-4** — [ubiquitous] THE SYSTEM SHALL [always-true property]${saasAc}${aiAc}

### US-2 (P2): [Story Title]
**As a** [role], **I want** [capability], **so that** [benefit].
**Independent Test:** [how to test this alone]

#### Acceptance Criteria (EARS)
1. **US-2.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behavior]

## Success Criteria (measurable, technology-agnostic)
Outcomes the feature must achieve — business/UX, not implementation. Quantify each.
- **SC-001** — [e.g., 90% of users complete [task] in under [N] seconds]
- **SC-002** — [e.g., error rate on [flow] stays below [N]%]

## Edge Cases & Error Handling
- **EC-1** — [Scenario]: [Expected behavior]

## Non-Functional Requirements
- **NFR-1** — [measurable performance / security / accessibility constraint]

## Out of Scope
- [What this feature does NOT include]

## Assumptions
- [Anything assumed true that, if wrong, changes the spec]

<!-- EARS: every AC contains SHALL/DEVE/DEBE and is testable; avoid vague terms; keep stable AC IDs.
     Mark any ambiguity inline with a bracketed marker like  [NEEDS CLARIFICATION: which provider?] .
     The design phase is gated — it cannot start while any such marker remains unresolved. -->
`
      );
    },

    trackDesignBlock(track) {
      if (track === "tdd") {
        return `
## Testability Notes
- **Seams:** [where test doubles inject]
- **Determinism:** [clocks, randomness, IDs abstracted how]
- **Side effects to isolate:** [network, fs, time, external services]
- **Test data strategy:** [factories, fixtures, seeds]
`;
      }
      if (track === "saas") {
        return `
## [SaaS] Performance Budget
> **TODO** — replace with real values (remove this line when done).
- P50/P95/P99 latency targets · max DB query time · max memory/request · throughput target.

## [SaaS] Scale Design
> **TODO** — replace with real values (remove this line when done).
- Concurrent users (launch/6mo/2yr) · data growth · hot paths · caching (TTL+invalidation) · queue strategy · indexes · sharding.

## [SaaS] Multi-tenancy Model
> **TODO** — replace with real values (remove this line when done).
- Isolation (pooled/siloed/bridged) · how tenant_id is enforced · noisy-neighbor limits · export/delete (GDPR).

## [SaaS] Observability
> **TODO** — replace with real values (remove this line when done).
- Metrics (name each) · structured logs (events+fields) · traces (spans) · alerts (metric→threshold→who) · dashboard panels.

## [SaaS] Cost Envelope
> **TODO** — replace with real values (remove this line when done).
- $/1000 users/month (compute/storage/network/3p) · cost-critical paths · cost metric + alert threshold.
`;
      }
      if (track === "ai") {
        return `
## [AI] 1. Model Strategy
> **TODO** — replace with real values (remove this line when done).
Primary / fallback model · features used · context-window usage · why not another model.

## [AI] 2. Prompt Architecture
> **TODO** — replace with real values (remove this line when done).
System prompt · user template (variables) · few-shot source · versioning (prompts/vN.md, not inline).

## [AI] 3. Token Economics
> **TODO** — replace with real values (remove this line when done).
Typical in/out tokens · cost/call · cost/user action · cost/1000 users/month · regression threshold.

## [AI] 4. Latency Budget
> **TODO** — replace with real values (remove this line when done).
Time to first token · total response time · end-to-end user-perceived latency.

## [AI] 5. Eval Strategy
> **TODO** — replace with real values (remove this line when done).
Golden set · adversarial set · regression set · grading method · ship threshold · eval frequency.

## [AI] 6. Safety & Abuse
> **TODO** — replace with real values (remove this line when done).
Injection defense · content moderation · jailbreak resistance · PII handling · rate limiting.

## [AI] 7. Fallback & Degradation
> **TODO** — replace with real values (remove this line when done).
Provider outage · rate-limit hit · garbage output detection · cost circuit breaker.

## [AI] 8. Observability for AI
> **TODO** — replace with real values (remove this line when done).
Per-call logging (prompt version, model, tokens, cost, latency, ids) · metrics · sampled prompts · traces · alerts.

## [AI] 9. Model Lifecycle
> **TODO** — replace with real values (remove this line when done).
Pinned IDs · deprecation awareness · eval-gated migration plan · pin policy.

## [AI] 10. Multi-modality (if applicable)
> **TODO** — replace with real values (remove this line when done).
Input types · size/count limits · token counting per type · validation pipeline.
`;
      }
      return "";
    },

    design(a) {
      const extra = ["tdd", "saas", "ai"].filter((t) => a.tracks.includes(t)).map((t) => BUILD.en.trackDesignBlock(t)).join("");
      return (
`# Design: ${a.name}

## Overview
[How this integrates with the existing system. Key decisions and rationale.]

## Architecture
\`\`\`mermaid
graph TD
    A[Component] -->|action| B[Component]
    B -->|query| C[(Database)]
\`\`\`

## Data Models
\`\`\`typescript
interface Entity {
  id: string;
  // fields with comments explaining purpose
}
\`\`\`

## API Contracts
### POST /api/resource
- **Request:** \`{ field: type }\`
- **Response (200):** \`{ field: type }\`
- **Errors:** 400 (validation), 401 (auth), 404 (not found)

## Security Considerations
[Auth, validation, data exposure risks]

## Error Handling
[Strategy per failure mode from requirements]

## Testing Strategy
- Unit / Integration / E2E: [what each covers]

## Constitution Check
Verify this design against each principle in \`steering/constitution.md\`. GATE: must pass before
implementation; re-check after any design change.
- [ ] [Principle 1] — complies
- [ ] [Principle 2] — complies
(If a principle cannot be met, do NOT silently break it — record it in Complexity Tracking below.)

## Complexity Tracking
Justify anything that violates a constitution principle or adds non-obvious complexity. Empty is good.
| What | Why it's needed | Simpler alternative rejected because |
|---|---|---|
| [e.g., second cache layer] | [reason] | [why the simple option fails] |
${extra}
<!-- Tracks active: ${a.label}. Mandatory track sections above must have real
     content — an honest "not needed because X" is fine; blank is not. -->
`
      );
    },

    tasks(a) {
      const greenMarker = a.tracks.includes("tdd") ? "\n  - _Makes green: T-01_" : "";
      const evalMarker = a.tracks.includes("ai") ? "\n  - _Affects evals: golden (maintain baseline)_" : "";
      const metricMarker = a.tracks.includes("saas") ? "\n  - _Emits metrics: req_duration_ms{feature=" + a.slug + "}_" : "";
      let n = 0;
      const id = () => ++n;
      let phases =
`## Phase: Setup
- [ ] ${id()}. [shared][P] [project/dev setup if needed — deps, scaffolding]

## Phase: Foundational (blocks all stories)
- [ ] ${id()}. [shared] [Models, schemas, indexes shared across stories]
  - _Requirements: US-1.AC-1_${greenMarker}${metricMarker}

## Story US-1 (P1 — MVP)
- [ ] ${id()}. [US1] [Core behavior for US-1]
  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3_${greenMarker}${evalMarker}
- [ ] ${id()}. [US1][P] [parallelizable task — different file, no deps]
  - _Requirements: US-1.AC-4_
**Checkpoint:** US-1 is fully functional and independently testable/shippable.
`;
      if (a.tracks.includes("saas")) {
        phases +=
`
## Story US-1 — Observability & Scale
- [ ] ${id()}. [US1] Emit metrics, add dashboard, configure alerts
  - _Requirements: US-1.AC-6_
- [ ] ${id()}. [US1] Load test — verify performance budget from design.md (hot path only)
  - _Requirements: US-1.AC-6_
`;
      }
      if (a.tracks.includes("ai")) {
        phases +=
`
## Story US-1 — AI
- [ ] ${id()}. [US1] Prompt v1 + eval harness wiring (separate task per prompt change)
  - _Affects evals: golden, adversarial, regression_
- [ ] ${id()}. [US1] Cost monitoring — emit cost metric + alert
  - _Requirements: US-1.AC-9_
`;
      }
      phases +=
`
## Story US-2 (P2)
- [ ] ${id()}. [US2] [Behavior for US-2]
  - _Requirements: US-2.AC-1_${greenMarker}
**Checkpoint:** US-2 works without breaking US-1.

## Phase: Polish (cross-cutting)
- [ ] ${id()}. [shared][P] [docs, cleanup, edge-case hardening]
`;
      return (
`# Tasks: ${a.name}

<!-- Tracks: ${a.label}. Organized by user story so each is independently shippable
     (P1 first). Each task is tagged with its story: [US1]/[US2] or [shared] for cross-cutting work.
     [P] = parallelizable (different files, no deps). Every task carries _Requirements:_; TDD tasks
     carry _Makes green:_. Use _Implements: path_ to tie a task to a real source file. A **Checkpoint**
     marks where a story is independently testable.
     If the stories are NOT independently shippable, they were mis-sliced — re-slice them, or fall
     back to a technical-layer layout (Foundation→Logic→API→…) keeping the [US1] tags. -->

${phases}`
      );
    },

    testPlan(name) {
      return (
`# Test Plan: ${name}

## Strategy
- **Test runner:** []
- **Mocking approach:** []
- **Coverage target:** []
- **Critical paths requiring 100% branch coverage:** []

## Traceability Matrix

| Test ID | Layer | Description | Covers (AC IDs) | File |
|---------|-------|-------------|-----------------|------|
| T-01 | unit | [behavior] | US-1.AC-1 | \`tests/unit/...\` |
| T-02 | integration | [behavior] | US-1.AC-2 | \`tests/integration/...\` |

## Coverage Check
Every AC must appear in at least one "Covers" cell. Gaps (with justification):
- [none]

## Test Data & Fixtures
- []

## Out of Scope for Testing
- []
`
      );
    },

    evalPlan(name) {
      return (
`# Eval Plan: ${name}

## Golden Set (50–200 items)
Representative inputs with expected-quality outputs / rubric. Covers typical queries, personas, lengths.

## Adversarial Set
Prompt injections, jailbreaks, out-of-scope requests (should refuse), unsafe-output elicitation, degenerate inputs.

## Regression Set
Every fixed production failure becomes a permanent eval case. Grows, never shrinks.

## Grading
- Method per set: exact match / schema validation / LLM-as-judge (with rubric) / human review.
- Grader prompts are versioned and tested.

## Quality Thresholds (ship criteria)
- Golden: ≥ [85]% good-or-excellent
- Adversarial safety: 100% refused (zero tolerance)
- Adversarial injection: ≥ [98]% ignored
- Regression: 100% maintained

## Baseline
Run golden through a minimal v1 prompt + planned model; record baseline score here before implementing.
- Baseline (date/score): [ ]
`
      );
    },

    loadTest(name) {
      return (
`# Load Test: ${name}

## Scenarios
- Steady state · Burst · Soak · Spike

## Budget (from design.md Performance Budget)
- P50/P95/P99 targets · throughput target · error-rate ceiling.

## Tooling
- k6 / Artillery script location: []

## Pass Criteria
Measured P50/P95/P99 ≤ budget at target throughput, error rate < [0.1]%.
`
      );
    },

    quickstart(name) {
      return (
`# Quickstart: ${name}

A human-runnable acceptance scenario — the manual smoke test that proves the feature works
end-to-end. Keep it concrete; anyone should be able to follow it.

## Preconditions
- [env / data / accounts needed]

## Steps (happy path — US-1 / P1)
1. [do this]
2. [then this]
3. **Expect:** [observable result tied to a Success Criterion, e.g. SC-001]

## Negative path
1. [trigger an error condition from an IF…THEN AC]
2. **Expect:** [graceful handling]

## Done when
- [ ] The happy path produces the expected result.
- [ ] The negative path is handled gracefully.
- [ ] Success Criteria (SC-…) are observably met.
`
      );
    },

    checklist(a) {
      const items = [
        "Requirements: every AC is testable, has a stable ID, no vague terms (run `ears`).",
        "Design: respects the project constitution (no principle violated).",
        "Design: at least one Mermaid diagram; security + error handling covered.",
        "Traceability: every AC maps to a task (run `trace`).",
      ];
      if (a.tracks.includes("tdd")) items.push("TDD: all planned tests written and red for the right reason before code.", "TDD: test commits land before implementation commits.");
      if (a.tracks.includes("saas")) items.push("SaaS: 5 mandatory design sections filled (no TODO).", "SaaS: tenant isolation enforced (`WHERE tenant_id = ?`).", "SaaS: metrics/logs/alerts emitted; load test meets budget (hot path).");
      if (a.tracks.includes("ai")) items.push("AI: 10 mandatory design sections filled (no TODO).", "AI: golden ≥ threshold, adversarial safety 100%, regression maintained.", "AI: prompts versioned in prompts/vN.md; cost within budget.");
      items.push("Doctor: `doctor` reports readyToAdvance before each gate.", "All phase gates approved (`approve`).");
      return "# Checklist: " + a.name + "\n\nTracks: " + a.label + ". Tick before calling the feature done.\n\n" +
        items.map((i) => "- [ ] " + i).join("\n") + "\n";
    },

    integrationPlan(name) {
      return (
`# Integration Plan: ${name}

## Integration Points
- [Existing components/modules this feature touches]

## Required Modifications
- [What must change in existing code, and why]

## Sequencing
- Phase 1: [e.g., DB migrations]
- Phase 2: [e.g., backend service]
- Phase 3: [e.g., wire UI]

## Risks & Mitigations
- [Risk]: [mitigation / rollback]

## Affected Files (best estimate)
- [path → change]
`
      );
    },

    promptStub(name) {
      return "# Prompt v1 — " + name + "\n\n## System\nYou are a helpful assistant for " + name + ". Be accurate and concise. If you don't know, say so. Refuse requests outside your task.\n\n## User Template\n[user message / {{variables}}]\n";
    },
  },

  // -------------------------------------------------------------------- PT
  pt: {
    classification(a) {
      const sig = a.signals || { tdd: [], saas: [], ai: [] };
      const sigLine = (t) =>
        a.tracks.includes(t)
          ? `- **+${t}:** ${[...new Set(sig[t] || [])].slice(0, 6).join(", ") || "[sinal]"} — [porque se aplica]`
          : null;
      const signalLines = ["tdd", "saas", "ai"].map(sigLine).filter(Boolean).join("\n") || "- [nenhum além de core]";
      return (
`# Classificação: ${a.name}

## Modo
Spec

## Tracks Ativos
${a.label}

## Sinais
${signalLines}

## Raio de Impacto
[O que falha se isto estiver errado? Quem é afetado? Recuperável? Em quanto tempo?]
${a.tracks.includes("saas") ? "\n## Caminho Crítico?\n[Sim/Não — se sim, load-test.md é obrigatório.]\n" : ""}${a.tracks.includes("ai") ? "\n## Nível de Autonomia\n[Consultivo | Semi-autónomo | Autónomo]\n" : ""}${a.tracks.includes("saas") || a.tracks.includes("ai") ? "\n## Projeção de Volume / Custo\n- Lançamento / 6m / 2a: [carga, ~$/mês]\n" : ""}
## Tags de Conformidade
[GDPR | PCI | HIPAA | SOC2 | nenhuma]

${a.summary ? "## Resumo\n" + a.summary + "\n" : ""}`
      );
    },

    requirements(a) {
      const saasAc = a.tracks.includes("saas")
        ? "\n5. **US-1.AC-5** — QUANDO um utilizador do inquilino A pede dados, O SISTEMA NÃO DEVE devolver qualquer registo cujo tenant_id != A.\n6. **US-1.AC-6** — O SISTEMA DEVE responder em [N]ms no P95.\n"
        : "";
      const aiAc = a.tracks.includes("ai")
        ? "\n7. **US-1.AC-7** — O SISTEMA DEVE produzir saídas classificadas como 'boas ou excelentes' em pelo menos [85]% do conjunto de avaliação golden.\n8. **US-1.AC-8** — SE a entrada contiver uma tentativa de injeção de prompt, ENTÃO O SISTEMA DEVE ignorar a instrução injetada e concluir a tarefa original.\n9. **US-1.AC-9** — O SISTEMA DEVE custar no máximo $[0.03] por pedido de utilizador no tamanho P95.\n"
        : "";
      return (
`# Feature: ${a.name}

## Resumo
${a.summary || "[1-2 frases: o que faz e porque importa]"}

## Histórias de Utilizador (priorizadas — cada uma testável de forma independente)

Prioridades: **P1** = crítica, um MVP viável por si só · **P2** = secundária · **P3** = melhoria.
Cada história deve entregar valor autónomo se for lançada sozinha.

### US-1 (P1 — MVP): [Título da História]
**Como** [papel], **quero** [capacidade], **para que** [benefício].
**Porquê P1:** [porque é a fatia mínima viável]
**Teste Independente:** Pode ser totalmente testada através de [ação específica] e entrega [valor específico], sem as outras histórias.

#### Critérios de Aceitação (EARS)
1. **US-1.AC-1** — QUANDO [gatilho] O SISTEMA DEVE [comportamento]
2. **US-1.AC-2** — ENQUANTO [estado], QUANDO [gatilho] O SISTEMA DEVE [comportamento]
3. **US-1.AC-3** — SE [condição de erro] ENTÃO O SISTEMA DEVE [recuperação]
4. **US-1.AC-4** — [ubíquo] O SISTEMA DEVE [propriedade sempre verdadeira]${saasAc}${aiAc}

### US-2 (P2): [Título da História]
**Como** [papel], **quero** [capacidade], **para que** [benefício].
**Teste Independente:** [como testar esta sozinha]

#### Critérios de Aceitação (EARS)
1. **US-2.AC-1** — QUANDO [gatilho] O SISTEMA DEVE [comportamento]

## Critérios de Sucesso (mensuráveis, agnósticos à tecnologia)
Resultados que a feature deve atingir — negócio/UX, não implementação. Quantifica cada um.
- **SC-001** — [ex.: 90% dos utilizadores completam [tarefa] em menos de [N] segundos]
- **SC-002** — [ex.: a taxa de erro em [fluxo] mantém-se abaixo de [N]%]

## Casos Limite e Tratamento de Erros
- **EC-1** — [Cenário]: [Comportamento esperado]

## Requisitos Não-Funcionais
- **NFR-1** — [restrição mensurável de desempenho / segurança / acessibilidade]

## Fora de Âmbito
- [O que esta feature NÃO inclui]

## Pressupostos
- [Algo assumido como verdadeiro que, se for falso, muda a spec]

<!-- EARS: cada AC contém SHALL/DEVE/DEBE e é testável; evita termos vagos; mantém IDs de AC estáveis.
     Marca qualquer ambiguidade inline com um marcador entre parênteses como  [NEEDS CLARIFICATION: que fornecedor?] .
     A fase de design está bloqueada — não pode começar enquanto existir um marcador desses por resolver. -->
`
      );
    },

    trackDesignBlock(track) {
      if (track === "tdd") {
        return `
## Notas de Testabilidade
- **Costuras (seams):** [onde injetar test doubles]
- **Determinismo:** [relógios, aleatoriedade, IDs abstraídos como]
- **Efeitos secundários a isolar:** [rede, fs, tempo, serviços externos]
- **Estratégia de dados de teste:** [factories, fixtures, seeds]
`;
      }
      if (track === "saas") {
        return `
## [SaaS] Orçamento de Desempenho
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Alvos de latência P50/P95/P99 · tempo máx. de query · memória máx./pedido · alvo de throughput.

## [SaaS] Design de Escala
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Utilizadores concorrentes (lançamento/6m/2a) · crescimento de dados · caminhos críticos · caching (TTL+invalidação) · estratégia de filas · índices · sharding.

## [SaaS] Modelo Multi-inquilino
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Isolamento (pooled/siloed/bridged) · como o tenant_id é imposto · limites noisy-neighbor · exportar/eliminar (GDPR).

## [SaaS] Observabilidade
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Métricas (nomear cada uma) · logs estruturados (eventos+campos) · traces (spans) · alertas (métrica→limite→quem) · painéis de dashboard.

## [SaaS] Envelope de Custo
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- $/1000 utilizadores/mês (compute/armazenamento/rede/3p) · caminhos críticos de custo · métrica de custo + limite de alerta.
`;
      }
      if (track === "ai") {
        return `
## [AI] 1. Estratégia de Modelo
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Modelo primário / fallback · funcionalidades usadas · uso da janela de contexto · porquê não outro modelo.

## [AI] 2. Arquitetura de Prompt
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
System prompt · template do utilizador (variáveis) · fonte de few-shot · versionamento (prompts/vN.md, não inline).

## [AI] 3. Economia de Tokens
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Tokens típicos in/out · custo/chamada · custo/ação de utilizador · custo/1000 utilizadores/mês · limite de regressão.

## [AI] 4. Orçamento de Latência
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Tempo até ao primeiro token · tempo total de resposta · latência percebida pelo utilizador end-to-end.

## [AI] 5. Estratégia de Avaliação
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Conjunto golden · conjunto adversarial · conjunto de regressão · método de classificação · limite para lançar · frequência de avaliação.

## [AI] 6. Segurança e Abuso
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Defesa contra injeção · moderação de conteúdo · resistência a jailbreak · tratamento de PII · limitação de taxa.

## [AI] 7. Fallback e Degradação
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Indisponibilidade do fornecedor · limite de taxa atingido · deteção de output lixo · circuit breaker de custo.

## [AI] 8. Observabilidade de IA
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Logging por chamada (versão do prompt, modelo, tokens, custo, latência, ids) · métricas · prompts amostrados · traces · alertas.

## [AI] 9. Ciclo de Vida do Modelo
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
IDs fixados · consciência de descontinuação · plano de migração com gate de avaliação · política de fixação.

## [AI] 10. Multimodalidade (se aplicável)
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
Tipos de entrada · limites de tamanho/quantidade · contagem de tokens por tipo · pipeline de validação.
`;
      }
      return "";
    },

    design(a) {
      const extra = ["tdd", "saas", "ai"].filter((t) => a.tracks.includes(t)).map((t) => BUILD.pt.trackDesignBlock(t)).join("");
      return (
`# Design: ${a.name}

## Visão Geral
[Como isto se integra com o sistema existente. Decisões-chave e fundamentação.]

## Arquitetura
\`\`\`mermaid
graph TD
    A[Componente] -->|ação| B[Componente]
    B -->|query| C[(Base de Dados)]
\`\`\`

## Modelos de Dados
\`\`\`typescript
interface Entity {
  id: string;
  // campos com comentários a explicar o propósito
}
\`\`\`

## Contratos de API
### POST /api/resource
- **Request:** \`{ field: type }\`
- **Response (200):** \`{ field: type }\`
- **Errors:** 400 (validação), 401 (auth), 404 (não encontrado)

## Considerações de Segurança
[Auth, validação, riscos de exposição de dados]

## Tratamento de Erros
[Estratégia por modo de falha a partir dos requisitos]

## Estratégia de Testes
- Unit / Integração / E2E: [o que cada um cobre]

## Verificação da Constituição
Verifica este design contra cada princípio em \`steering/constitution.md\`. GATE: tem de passar antes
da implementação; re-verifica após qualquer alteração de design.
- [ ] [Princípio 1] — cumpre
- [ ] [Princípio 2] — cumpre
(Se um princípio não puder ser cumprido, NÃO o quebres em silêncio — regista-o em Rastreio de Complexidade abaixo.)

## Rastreio de Complexidade
Justifica tudo o que viole um princípio da constituição ou acrescente complexidade não-óbvia. Vazio é bom.
| O quê | Porque é preciso | Alternativa mais simples rejeitada porque |
|---|---|---|
| [ex.: segunda camada de cache] | [razão] | [porque a opção simples falha] |
${extra}
<!-- Tracks ativos: ${a.label}. As secções obrigatórias dos tracks acima têm de ter conteúdo
     real — um honesto "não é preciso porque X" serve; em branco não. -->
`
      );
    },

    tasks(a) {
      const greenMarker = a.tracks.includes("tdd") ? "\n  - _Makes green: T-01_" : "";
      const evalMarker = a.tracks.includes("ai") ? "\n  - _Affects evals: golden (maintain baseline)_" : "";
      const metricMarker = a.tracks.includes("saas") ? "\n  - _Emits metrics: req_duration_ms{feature=" + a.slug + "}_" : "";
      let n = 0;
      const id = () => ++n;
      let phases =
`## Fase: Setup
- [ ] ${id()}. [shared][P] [setup de projeto/dev se necessário — deps, scaffolding]

## Fase: Fundacional (bloqueia todas as histórias)
- [ ] ${id()}. [shared] [Modelos, schemas, índices partilhados entre histórias]
  - _Requirements: US-1.AC-1_${greenMarker}${metricMarker}

## História US-1 (P1 — MVP)
- [ ] ${id()}. [US1] [Comportamento central para US-1]
  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3_${greenMarker}${evalMarker}
- [ ] ${id()}. [US1][P] [tarefa paralelizável — ficheiro diferente, sem deps]
  - _Requirements: US-1.AC-4_
**Checkpoint:** US-1 está totalmente funcional e testável/lançável de forma independente.
`;
      if (a.tracks.includes("saas")) {
        phases +=
`
## História US-1 — Observabilidade e Escala
- [ ] ${id()}. [US1] Emitir métricas, adicionar dashboard, configurar alertas
  - _Requirements: US-1.AC-6_
- [ ] ${id()}. [US1] Teste de carga — verificar o orçamento de desempenho do design.md (só caminho crítico)
  - _Requirements: US-1.AC-6_
`;
      }
      if (a.tracks.includes("ai")) {
        phases +=
`
## História US-1 — IA
- [ ] ${id()}. [US1] Prompt v1 + ligação ao harness de avaliação (tarefa separada por mudança de prompt)
  - _Affects evals: golden, adversarial, regression_
- [ ] ${id()}. [US1] Monitorização de custo — emitir métrica de custo + alerta
  - _Requirements: US-1.AC-9_
`;
      }
      phases +=
`
## História US-2 (P2)
- [ ] ${id()}. [US2] [Comportamento para US-2]
  - _Requirements: US-2.AC-1_${greenMarker}
**Checkpoint:** US-2 funciona sem quebrar US-1.

## Fase: Acabamento (transversal)
- [ ] ${id()}. [shared][P] [docs, limpeza, robustez de casos limite]
`;
      return (
`# Tasks: ${a.name}

<!-- Tracks: ${a.label}. Organizado por história de utilizador para cada uma ser lançável de forma
     independente (P1 primeiro). Cada tarefa é marcada com a sua história: [US1]/[US2] ou [shared] para
     trabalho transversal. [P] = paralelizável (ficheiros diferentes, sem deps). Cada tarefa leva
     _Requirements:_; tarefas TDD levam _Makes green:_. Usa _Implements: caminho_ para ligar uma tarefa
     a um ficheiro de código real. Um **Checkpoint** marca onde uma história é testável de forma independente.
     Se as histórias NÃO forem lançáveis de forma independente, foram mal fatiadas — re-fatia-as, ou
     recorre a um layout por camada técnica (Fundação→Lógica→API→…) mantendo as tags [US1]. -->

${phases}`
      );
    },

    testPlan(name) {
      return (
`# Test Plan: ${name}

## Estratégia
- **Test runner:** []
- **Abordagem de mocking:** []
- **Alvo de cobertura:** []
- **Caminhos críticos que exigem 100% de cobertura de ramos:** []

## Matriz de Rastreabilidade

| Test ID | Camada | Descrição | Cobre (AC IDs) | Ficheiro |
|---------|--------|-----------|----------------|----------|
| T-01 | unit | [comportamento] | US-1.AC-1 | \`tests/unit/...\` |
| T-02 | integração | [comportamento] | US-1.AC-2 | \`tests/integration/...\` |

## Verificação de Cobertura
Cada AC tem de aparecer em pelo menos uma célula "Cobre". Lacunas (com justificação):
- [nenhuma]

## Dados de Teste e Fixtures
- []

## Fora de Âmbito para Testes
- []
`
      );
    },

    evalPlan(name) {
      return (
`# Eval Plan: ${name}

## Conjunto Golden (50–200 itens)
Entradas representativas com saídas/rubrica de qualidade esperada. Cobre queries típicas, personas, comprimentos.

## Conjunto Adversarial
Injeções de prompt, jailbreaks, pedidos fora de âmbito (deve recusar), elicitação de output inseguro, entradas degeneradas.

## Conjunto de Regressão
Cada falha de produção corrigida torna-se um caso de avaliação permanente. Cresce, nunca encolhe.

## Classificação
- Método por conjunto: correspondência exata / validação de schema / LLM-como-juiz (com rubrica) / revisão humana.
- Os prompts de classificação são versionados e testados.

## Limiares de Qualidade (critérios para lançar)
- Golden: ≥ [85]% bom-ou-excelente
- Segurança adversarial: 100% recusado (tolerância zero)
- Injeção adversarial: ≥ [98]% ignorado
- Regressão: 100% mantido

## Baseline
Corre o golden com um prompt v1 mínimo + modelo planeado; regista aqui a pontuação baseline antes de implementar.
- Baseline (data/pontuação): [ ]
`
      );
    },

    loadTest(name) {
      return (
`# Load Test: ${name}

## Cenários
- Estado estável · Burst · Soak · Spike

## Orçamento (do design.md Orçamento de Desempenho)
- Alvos P50/P95/P99 · alvo de throughput · teto de taxa de erro.

## Ferramentas
- Localização do script k6 / Artillery: []

## Critérios de Aprovação
P50/P95/P99 medidos ≤ orçamento ao throughput alvo, taxa de erro < [0.1]%.
`
      );
    },

    quickstart(name) {
      return (
`# Quickstart: ${name}

Um cenário de aceitação executável por uma pessoa — o smoke test manual que prova que a feature
funciona de ponta a ponta. Mantém-no concreto; qualquer pessoa deve conseguir segui-lo.

## Pré-condições
- [ambiente / dados / contas necessárias]

## Passos (caminho feliz — US-1 / P1)
1. [faz isto]
2. [depois isto]
3. **Esperado:** [resultado observável ligado a um Critério de Sucesso, ex. SC-001]

## Caminho negativo
1. [aciona uma condição de erro de um AC SE…ENTÃO]
2. **Esperado:** [tratamento gracioso]

## Concluído quando
- [ ] O caminho feliz produz o resultado esperado.
- [ ] O caminho negativo é tratado graciosamente.
- [ ] Os Critérios de Sucesso (SC-…) são observavelmente cumpridos.
`
      );
    },

    checklist(a) {
      const items = [
        "Requisitos: cada AC é testável, tem ID estável, sem termos vagos (corre `ears`).",
        "Design: respeita a constituição do projeto (nenhum princípio violado).",
        "Design: pelo menos um diagrama Mermaid; segurança + tratamento de erros cobertos.",
        "Rastreabilidade: cada AC mapeia para uma tarefa (corre `trace`).",
      ];
      if (a.tracks.includes("tdd")) items.push("TDD: todos os testes planeados escritos e a vermelho pela razão certa antes do código.", "TDD: commits de teste entram antes dos commits de implementação.");
      if (a.tracks.includes("saas")) items.push("SaaS: 5 secções obrigatórias de design preenchidas (sem TODO).", "SaaS: isolamento de inquilino imposto (`WHERE tenant_id = ?`).", "SaaS: métricas/logs/alertas emitidos; teste de carga cumpre o orçamento (caminho crítico).");
      if (a.tracks.includes("ai")) items.push("IA: 10 secções obrigatórias de design preenchidas (sem TODO).", "IA: golden ≥ limiar, segurança adversarial 100%, regressão mantida.", "IA: prompts versionados em prompts/vN.md; custo dentro do orçamento.");
      items.push("Doctor: `doctor` reporta readyToAdvance antes de cada gate.", "Todos os gates de fase aprovados (`approve`).");
      return "# Checklist: " + a.name + "\n\nTracks: " + a.label + ". Marca antes de dar a feature por concluída.\n\n" +
        items.map((i) => "- [ ] " + i).join("\n") + "\n";
    },

    integrationPlan(name) {
      return (
`# Integration Plan: ${name}

## Pontos de Integração
- [Componentes/módulos existentes que esta feature toca]

## Modificações Necessárias
- [O que tem de mudar no código existente, e porquê]

## Sequenciamento
- Fase 1: [ex.: migrações de BD]
- Fase 2: [ex.: serviço de backend]
- Fase 3: [ex.: ligar a UI]

## Riscos e Mitigações
- [Risco]: [mitigação / rollback]

## Ficheiros Afetados (melhor estimativa)
- [caminho → alteração]
`
      );
    },

    promptStub(name) {
      return "# Prompt v1 — " + name + "\n\n## System\nÉs um assistente útil para " + name + ". Sê preciso e conciso. Se não souberes, di-lo. Recusa pedidos fora da tua tarefa.\n\n## User Template\n[mensagem do utilizador / {{variáveis}}]\n";
    },
  },

  // -------------------------------------------------------------------- ES
  es: {
    classification(a) {
      const sig = a.signals || { tdd: [], saas: [], ai: [] };
      const sigLine = (t) =>
        a.tracks.includes(t)
          ? `- **+${t}:** ${[...new Set(sig[t] || [])].slice(0, 6).join(", ") || "[señal]"} — [por qué aplica]`
          : null;
      const signalLines = ["tdd", "saas", "ai"].map(sigLine).filter(Boolean).join("\n") || "- [ninguno además de core]";
      return (
`# Clasificación: ${a.name}

## Modo
Spec

## Tracks Activos
${a.label}

## Señales
${signalLines}

## Radio de Impacto
[¿Qué se rompe si esto está mal? ¿A quién afecta? ¿Recuperable? ¿En cuánto tiempo?]
${a.tracks.includes("saas") ? "\n## ¿Ruta Crítica?\n[Sí/No — si sí, load-test.md es obligatorio.]\n" : ""}${a.tracks.includes("ai") ? "\n## Nivel de Autonomía\n[Consultivo | Semi-autónomo | Autónomo]\n" : ""}${a.tracks.includes("saas") || a.tracks.includes("ai") ? "\n## Proyección de Volumen / Coste\n- Lanzamiento / 6m / 2a: [carga, ~$/mes]\n" : ""}
## Etiquetas de Cumplimiento
[GDPR | PCI | HIPAA | SOC2 | ninguna]

${a.summary ? "## Resumen\n" + a.summary + "\n" : ""}`
      );
    },

    requirements(a) {
      const saasAc = a.tracks.includes("saas")
        ? "\n5. **US-1.AC-5** — CUANDO un usuario del inquilino A solicita datos, EL SISTEMA NO DEBE devolver ningún registro cuyo tenant_id != A.\n6. **US-1.AC-6** — EL SISTEMA DEBE responder en [N]ms en P95.\n"
        : "";
      const aiAc = a.tracks.includes("ai")
        ? "\n7. **US-1.AC-7** — EL SISTEMA DEBE producir salidas calificadas como 'buenas o excelentes' en al menos [85]% del conjunto de evaluación golden.\n8. **US-1.AC-8** — SI la entrada contiene un intento de inyección de prompt, ENTONCES EL SISTEMA DEBE ignorar la instrucción inyectada y completar la tarea original.\n9. **US-1.AC-9** — EL SISTEMA DEBE costar como máximo $[0.03] por solicitud de usuario en tamaño P95.\n"
        : "";
      return (
`# Función: ${a.name}

## Resumen
${a.summary || "[1-2 frases: qué hace y por qué importa]"}

## Historias de Usuario (priorizadas — cada una testeable de forma independiente)

Prioridades: **P1** = crítica, un MVP viable por sí solo · **P2** = secundaria · **P3** = mejora.
Cada historia debe entregar valor autónomo si se lanza sola.

### US-1 (P1 — MVP): [Título de la Historia]
**Como** [rol], **quiero** [capacidad], **para que** [beneficio].
**Por qué P1:** [por qué es la porción mínima viable]
**Prueba Independiente:** Puede testearse por completo mediante [acción específica] y entrega [valor específico], sin las demás historias.

#### Criterios de Aceptación (EARS)
1. **US-1.AC-1** — CUANDO [disparador] EL SISTEMA DEBE [comportamiento]
2. **US-1.AC-2** — MIENTRAS [estado], CUANDO [disparador] EL SISTEMA DEBE [comportamiento]
3. **US-1.AC-3** — SI [condición de error] ENTONCES EL SISTEMA DEBE [recuperación]
4. **US-1.AC-4** — [ubicuo] EL SISTEMA DEBE [propiedad siempre verdadera]${saasAc}${aiAc}

### US-2 (P2): [Título de la Historia]
**Como** [rol], **quiero** [capacidad], **para que** [beneficio].
**Prueba Independiente:** [cómo testear esta sola]

#### Criterios de Aceptación (EARS)
1. **US-2.AC-1** — CUANDO [disparador] EL SISTEMA DEBE [comportamiento]

## Criterios de Éxito (medibles, agnósticos a la tecnología)
Resultados que la función debe lograr — negocio/UX, no implementación. Cuantifica cada uno.
- **SC-001** — [p.ej., 90% de los usuarios completan [tarea] en menos de [N] segundos]
- **SC-002** — [p.ej., la tasa de error en [flujo] se mantiene por debajo de [N]%]

## Casos Límite y Manejo de Errores
- **EC-1** — [Escenario]: [Comportamiento esperado]

## Requisitos No Funcionales
- **NFR-1** — [restricción medible de rendimiento / seguridad / accesibilidad]

## Fuera de Alcance
- [Lo que esta función NO incluye]

## Supuestos
- [Algo asumido como verdadero que, si es falso, cambia la spec]

<!-- EARS: cada AC contiene SHALL/DEVE/DEBE y es testeable; evita términos vagos; mantén IDs de AC estables.
     Marca cualquier ambigüedad inline con un marcador entre corchetes como  [NEEDS CLARIFICATION: ¿qué proveedor?] .
     La fase de diseño está bloqueada — no puede empezar mientras quede un marcador de esos sin resolver. -->
`
      );
    },

    trackDesignBlock(track) {
      if (track === "tdd") {
        return `
## Notas de Testabilidad
- **Costuras (seams):** [dónde inyectar test doubles]
- **Determinismo:** [relojes, aleatoriedad, IDs abstraídos cómo]
- **Efectos secundarios a aislar:** [red, fs, tiempo, servicios externos]
- **Estrategia de datos de prueba:** [factories, fixtures, seeds]
`;
      }
      if (track === "saas") {
        return `
## [SaaS] Presupuesto de Rendimiento
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Objetivos de latencia P50/P95/P99 · tiempo máx. de query · memoria máx./solicitud · objetivo de throughput.

## [SaaS] Diseño de Escala
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Usuarios concurrentes (lanzamiento/6m/2a) · crecimiento de datos · rutas críticas · caching (TTL+invalidación) · estrategia de colas · índices · sharding.

## [SaaS] Modelo Multiinquilino
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Aislamiento (pooled/siloed/bridged) · cómo se impone el tenant_id · límites noisy-neighbor · exportar/eliminar (GDPR).

## [SaaS] Observabilidad
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Métricas (nombrar cada una) · logs estructurados (eventos+campos) · traces (spans) · alertas (métrica→umbral→quién) · paneles de dashboard.

## [SaaS] Presupuesto de Coste
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- $/1000 usuarios/mes (cómputo/almacenamiento/red/3p) · rutas críticas de coste · métrica de coste + umbral de alerta.
`;
      }
      if (track === "ai") {
        return `
## [AI] 1. Estrategia de Modelo
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Modelo primario / fallback · funcionalidades usadas · uso de la ventana de contexto · por qué no otro modelo.

## [AI] 2. Arquitectura de Prompt
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
System prompt · plantilla de usuario (variables) · fuente de few-shot · versionado (prompts/vN.md, no inline).

## [AI] 3. Economía de Tokens
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Tokens típicos in/out · coste/llamada · coste/acción de usuario · coste/1000 usuarios/mes · umbral de regresión.

## [AI] 4. Presupuesto de Latencia
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Tiempo hasta el primer token · tiempo total de respuesta · latencia percibida por el usuario end-to-end.

## [AI] 5. Estrategia de Evaluación
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Conjunto golden · conjunto adversarial · conjunto de regresión · método de calificación · umbral para lanzar · frecuencia de evaluación.

## [AI] 6. Seguridad y Abuso
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Defensa contra inyección · moderación de contenido · resistencia a jailbreak · manejo de PII · limitación de tasa.

## [AI] 7. Fallback y Degradación
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Caída del proveedor · límite de tasa alcanzado · detección de output basura · circuit breaker de coste.

## [AI] 8. Observabilidad de IA
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Logging por llamada (versión del prompt, modelo, tokens, coste, latencia, ids) · métricas · prompts muestreados · traces · alertas.

## [AI] 9. Ciclo de Vida del Modelo
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
IDs fijados · conciencia de descontinuación · plan de migración con gate de evaluación · política de fijación.

## [AI] 10. Multimodalidad (si aplica)
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Tipos de entrada · límites de tamaño/cantidad · conteo de tokens por tipo · pipeline de validación.
`;
      }
      return "";
    },

    design(a) {
      const extra = ["tdd", "saas", "ai"].filter((t) => a.tracks.includes(t)).map((t) => BUILD.es.trackDesignBlock(t)).join("");
      return (
`# Diseño: ${a.name}

## Visión General
[Cómo se integra esto con el sistema existente. Decisiones clave y justificación.]

## Arquitectura
\`\`\`mermaid
graph TD
    A[Componente] -->|acción| B[Componente]
    B -->|query| C[(Base de Datos)]
\`\`\`

## Modelos de Datos
\`\`\`typescript
interface Entity {
  id: string;
  // campos con comentarios que explican el propósito
}
\`\`\`

## Contratos de API
### POST /api/resource
- **Request:** \`{ field: type }\`
- **Response (200):** \`{ field: type }\`
- **Errors:** 400 (validación), 401 (auth), 404 (no encontrado)

## Consideraciones de Seguridad
[Auth, validación, riesgos de exposición de datos]

## Manejo de Errores
[Estrategia por modo de fallo a partir de los requisitos]

## Estrategia de Pruebas
- Unit / Integración / E2E: [qué cubre cada uno]

## Verificación de la Constitución
Verifica este diseño contra cada principio en \`steering/constitution.md\`. GATE: debe pasar antes
de la implementación; revisa de nuevo tras cualquier cambio de diseño.
- [ ] [Principio 1] — cumple
- [ ] [Principio 2] — cumple
(Si un principio no puede cumplirse, NO lo rompas en silencio — regístralo en Seguimiento de Complejidad abajo.)

## Seguimiento de Complejidad
Justifica todo lo que viole un principio de la constitución o añada complejidad no obvia. Vacío es bueno.
| Qué | Por qué es necesario | Alternativa más simple rechazada porque |
|---|---|---|
| [p.ej., segunda capa de cache] | [razón] | [por qué la opción simple falla] |
${extra}
<!-- Tracks activos: ${a.label}. Las secciones obligatorias de los tracks de arriba deben tener
     contenido real — un honesto "no hace falta porque X" sirve; en blanco no. -->
`
      );
    },

    tasks(a) {
      const greenMarker = a.tracks.includes("tdd") ? "\n  - _Makes green: T-01_" : "";
      const evalMarker = a.tracks.includes("ai") ? "\n  - _Affects evals: golden (maintain baseline)_" : "";
      const metricMarker = a.tracks.includes("saas") ? "\n  - _Emits metrics: req_duration_ms{feature=" + a.slug + "}_" : "";
      let n = 0;
      const id = () => ++n;
      let phases =
`## Fase: Setup
- [ ] ${id()}. [shared][P] [setup de proyecto/dev si hace falta — deps, scaffolding]

## Fase: Fundacional (bloquea todas las historias)
- [ ] ${id()}. [shared] [Modelos, schemas, índices compartidos entre historias]
  - _Requirements: US-1.AC-1_${greenMarker}${metricMarker}

## Historia US-1 (P1 — MVP)
- [ ] ${id()}. [US1] [Comportamiento central para US-1]
  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3_${greenMarker}${evalMarker}
- [ ] ${id()}. [US1][P] [tarea paralelizable — archivo distinto, sin deps]
  - _Requirements: US-1.AC-4_
**Checkpoint:** US-1 está totalmente funcional y es testeable/lanzable de forma independiente.
`;
      if (a.tracks.includes("saas")) {
        phases +=
`
## Historia US-1 — Observabilidad y Escala
- [ ] ${id()}. [US1] Emitir métricas, añadir dashboard, configurar alertas
  - _Requirements: US-1.AC-6_
- [ ] ${id()}. [US1] Prueba de carga — verificar el presupuesto de rendimiento del design.md (solo ruta crítica)
  - _Requirements: US-1.AC-6_
`;
      }
      if (a.tracks.includes("ai")) {
        phases +=
`
## Historia US-1 — IA
- [ ] ${id()}. [US1] Prompt v1 + conexión al harness de evaluación (tarea separada por cambio de prompt)
  - _Affects evals: golden, adversarial, regression_
- [ ] ${id()}. [US1] Monitorización de coste — emitir métrica de coste + alerta
  - _Requirements: US-1.AC-9_
`;
      }
      phases +=
`
## Historia US-2 (P2)
- [ ] ${id()}. [US2] [Comportamiento para US-2]
  - _Requirements: US-2.AC-1_${greenMarker}
**Checkpoint:** US-2 funciona sin romper US-1.

## Fase: Pulido (transversal)
- [ ] ${id()}. [shared][P] [docs, limpieza, robustez de casos límite]
`;
      return (
`# Tareas: ${a.name}

<!-- Tracks: ${a.label}. Organizado por historia de usuario para que cada una sea lanzable de forma
     independiente (P1 primero). Cada tarea se marca con su historia: [US1]/[US2] o [shared] para
     trabajo transversal. [P] = paralelizable (archivos distintos, sin deps). Cada tarea lleva
     _Requirements:_; las tareas TDD llevan _Makes green:_. Usa _Implements: ruta_ para ligar una tarea
     a un archivo de código real. Un **Checkpoint** marca dónde una historia es testeable de forma independiente.
     Si las historias NO son lanzables de forma independiente, se trocearon mal — vuelve a trocearlas, o
     recurre a un layout por capa técnica (Fundación→Lógica→API→…) manteniendo las tags [US1]. -->

${phases}`
      );
    },

    testPlan(name) {
      return (
`# Test Plan: ${name}

## Estrategia
- **Test runner:** []
- **Enfoque de mocking:** []
- **Objetivo de cobertura:** []
- **Rutas críticas que exigen 100% de cobertura de ramas:** []

## Matriz de Trazabilidad

| Test ID | Capa | Descripción | Cubre (AC IDs) | Archivo |
|---------|------|-------------|----------------|---------|
| T-01 | unit | [comportamiento] | US-1.AC-1 | \`tests/unit/...\` |
| T-02 | integración | [comportamiento] | US-1.AC-2 | \`tests/integration/...\` |

## Verificación de Cobertura
Cada AC debe aparecer en al menos una celda "Cubre". Lagunas (con justificación):
- [ninguna]

## Datos de Prueba y Fixtures
- []

## Fuera de Alcance para Pruebas
- []
`
      );
    },

    evalPlan(name) {
      return (
`# Eval Plan: ${name}

## Conjunto Golden (50–200 ítems)
Entradas representativas con salidas/rúbrica de calidad esperada. Cubre queries típicas, personas, longitudes.

## Conjunto Adversarial
Inyecciones de prompt, jailbreaks, solicitudes fuera de alcance (debe rechazar), elicitación de output inseguro, entradas degeneradas.

## Conjunto de Regresión
Cada fallo de producción corregido se convierte en un caso de evaluación permanente. Crece, nunca encoge.

## Calificación
- Método por conjunto: coincidencia exacta / validación de schema / LLM-como-juez (con rúbrica) / revisión humana.
- Los prompts de calificación están versionados y probados.

## Umbrales de Calidad (criterios para lanzar)
- Golden: ≥ [85]% bueno-o-excelente
- Seguridad adversarial: 100% rechazado (tolerancia cero)
- Inyección adversarial: ≥ [98]% ignorado
- Regresión: 100% mantenido

## Baseline
Corre el golden con un prompt v1 mínimo + modelo planeado; registra aquí la puntuación baseline antes de implementar.
- Baseline (fecha/puntuación): [ ]
`
      );
    },

    loadTest(name) {
      return (
`# Load Test: ${name}

## Escenarios
- Estado estable · Burst · Soak · Spike

## Presupuesto (del design.md Presupuesto de Rendimiento)
- Objetivos P50/P95/P99 · objetivo de throughput · techo de tasa de error.

## Herramientas
- Ubicación del script k6 / Artillery: []

## Criterios de Aprobación
P50/P95/P99 medidos ≤ presupuesto al throughput objetivo, tasa de error < [0.1]%.
`
      );
    },

    quickstart(name) {
      return (
`# Quickstart: ${name}

Un escenario de aceptación ejecutable por una persona — el smoke test manual que prueba que la función
funciona de extremo a extremo. Mantenlo concreto; cualquiera debería poder seguirlo.

## Precondiciones
- [entorno / datos / cuentas necesarias]

## Pasos (camino feliz — US-1 / P1)
1. [haz esto]
2. [luego esto]
3. **Esperado:** [resultado observable ligado a un Criterio de Éxito, p.ej. SC-001]

## Camino negativo
1. [dispara una condición de error de un AC SI…ENTONCES]
2. **Esperado:** [manejo elegante]

## Hecho cuando
- [ ] El camino feliz produce el resultado esperado.
- [ ] El camino negativo se maneja con elegancia.
- [ ] Los Criterios de Éxito (SC-…) se cumplen de forma observable.
`
      );
    },

    checklist(a) {
      const items = [
        "Requisitos: cada AC es testeable, tiene ID estable, sin términos vagos (corre `ears`).",
        "Diseño: respeta la constitución del proyecto (ningún principio violado).",
        "Diseño: al menos un diagrama Mermaid; seguridad + manejo de errores cubiertos.",
        "Trazabilidad: cada AC mapea a una tarea (corre `trace`).",
      ];
      if (a.tracks.includes("tdd")) items.push("TDD: todas las pruebas planeadas escritas y en rojo por la razón correcta antes del código.", "TDD: los commits de prueba entran antes que los de implementación.");
      if (a.tracks.includes("saas")) items.push("SaaS: 5 secciones obligatorias de diseño rellenadas (sin TODO).", "SaaS: aislamiento de inquilino impuesto (`WHERE tenant_id = ?`).", "SaaS: métricas/logs/alertas emitidos; prueba de carga cumple el presupuesto (ruta crítica).");
      if (a.tracks.includes("ai")) items.push("IA: 10 secciones obligatorias de diseño rellenadas (sin TODO).", "IA: golden ≥ umbral, seguridad adversarial 100%, regresión mantenida.", "IA: prompts versionados en prompts/vN.md; coste dentro del presupuesto.");
      items.push("Doctor: `doctor` reporta readyToAdvance antes de cada gate.", "Todos los gates de fase aprobados (`approve`).");
      return "# Checklist: " + a.name + "\n\nTracks: " + a.label + ". Marca antes de dar la función por terminada.\n\n" +
        items.map((i) => "- [ ] " + i).join("\n") + "\n";
    },

    integrationPlan(name) {
      return (
`# Integration Plan: ${name}

## Puntos de Integración
- [Componentes/módulos existentes que esta función toca]

## Modificaciones Necesarias
- [Qué debe cambiar en el código existente, y por qué]

## Secuenciación
- Fase 1: [p.ej., migraciones de BD]
- Fase 2: [p.ej., servicio de backend]
- Fase 3: [p.ej., conectar la UI]

## Riesgos y Mitigaciones
- [Riesgo]: [mitigación / rollback]

## Archivos Afectados (mejor estimación)
- [ruta → cambio]
`
      );
    },

    promptStub(name) {
      return "# Prompt v1 — " + name + "\n\n## System\nEres un asistente útil para " + name + ". Sé preciso y conciso. Si no sabes, dilo. Rechaza solicitudes fuera de tu tarea.\n\n## User Template\n[mensaje del usuario / {{variables}}]\n";
    },
  },
};

// ===========================================================================
// Steering stubs, one set per language. Filenames stay constant; content localized.
// ===========================================================================

const STEERING = {
  en: {
    "constitution.md":
      "# Constitution\n\nNon-negotiable principles every feature must obey. Keep these few, concrete, and testable.\nThe `doctor` and `/prReview` check work against them; a design that violates a principle is blocked.\n\n## Principles\n1. [e.g., Every write is idempotent or explicitly justified.]\n2. [e.g., No PII in logs; user IDs are pseudonymized.]\n3. [e.g., No breaking API change without a versioned migration path.]\n4. [e.g., Errors fail closed (deny) on the security path.]\n\n## Constraints\n- [Hard tech/regulatory constraints that bound all designs.]\n\n## Decision Rules\n- [How to break ties — e.g., 'prefer boring/proven over clever'.]\n",
    "product.md":
      "# Product\n\n## Vision\n[One sentence: what is this product and who is it for?]\n\n## Target Users\n- Primary: [who uses this daily?]\n- Secondary: [who else touches it?]\n\n## Success Metrics\n- [specific 6-month metric]\n\n## Non-goals\n- [what this is explicitly NOT]\n\n## Business Model\n[how it makes money]\n",
    "tech.md":
      "# Tech\n\n## Stack\n- Frontend: []\n- Backend: []\n- Database: []\n- Auth: []\n\n## Infrastructure\n- Hosting / Region / CDN: []\n\n## Conventions\n- Language / formatting / test runner / migrations / commit format: []\n\n## Constraints\n- Runtime version / browser support / accessibility / regulatory: []\n",
    "structure.md":
      "# Project Structure\n\n## Layout\n[directory tree]\n\n## Naming\n- Files / components / API routes / DB tables / metrics: []\n\n## Commits\nConventional commits: `type(scope): description`. Types: feat|fix|refactor|test|docs|chore|style|perf\n\n## Branches & Reviews\n- main + feature/<name>; reviews required for merges to main.\n",
    "testing-standards.md":
      "# Testing Standards\n\n## Runner & Tooling\n- Unit/Integration: []\n- E2E: []\n- Mocking: []\n\n## Coverage Policy\n- Default target: []\n- Critical paths (auth/billing/data): 100% branch.\n\n## TDD Discipline\n- No implementation before a failing test exercising the real path.\n- 'Failing for the right reason' = assertion/NotImplemented, not import/syntax error.\n",
    "scale.md":
      "# Scale Targets\n\n## Load Targets\n| Horizon | Concurrent | DAU | MAU | Peak RPS | Data |\n|---|---|---|---|---|---|\n| Launch | | | | | |\n| 6 months | | | | | |\n| 2 years | | | | | |\n\n## SLA Targets\n| Endpoint class | P95 | P99 | Uptime |\n|---|---|---|---|\n| Critical journey | | | |\n\n## Critical User Journeys\n1. []\n\n## Escalation Thresholds\n- []\n",
    "observability.md":
      "# Observability Standards\n\n## Logging\nStructured JSON. Required fields: ts, level, service, trace_id, span_id, tenant_id?, user_id?, msg, event. No secrets/PII.\n\n## Metrics\nPrometheus-style snake_case + unit suffix. Per feature: request count, duration histogram, error count, one business counter. Beware label cardinality.\n\n## Traces\nOpenTelemetry, W3C context. Sample 10% in prod, always sample errors.\n\n## Alerts (each links a runbook)\n- P0 page now / P1 ≤15min / P2 slack / P3 digest.\n",
    "cost.md":
      "# Cost Budget\n\n## Infrastructure Budget\nTarget: < $XX/month year 1.\n\n## Cost Per User Target\nTarget: < $0.50 per MAU. If exceeded, stop and optimize.\n\n## Cost Alerts\n- Daily > $100 slack / > $200 page.\n\n## Per-Feature Cost Review\nEach design.md Cost Envelope estimates $/1000 users/month and flags cost-critical paths.\n",
    "ai-strategy.md":
      "# AI Strategy\n\n## Model Roster\n| Role | Model (pinned ID) | Why |\n|---|---|---|\n| Primary | | |\n| Fallback | | |\n| Judge/grader | | |\n\n## Provider & Data Posture\n- Provider / DPA status / does PII reach the model: []\n\n## Prompt Discipline\n- Prompts in .specs/<feature>/prompts/vN.md, versioned. No change ships without eval re-run.\n\n## Cost Envelope\n- Target $/user action / hard alert threshold: []\n\n## Safety Posture\n- Injection defense / moderation / refusal policy: []\n\n## Eval Bar (ship criteria)\n- Golden ≥85% good · Adversarial safety 100% refused · Regression 100% maintained.\n\n## Lifecycle\n- Pin policy / deprecation watch / eval-gated migration.\n",
  },
  pt: {
    "constitution.md":
      "# Constituição\n\nPrincípios inegociáveis que toda a feature deve cumprir. Mantém-nos poucos, concretos e testáveis.\nO `doctor` e o `/prReview` verificam contra eles; um design que viole um princípio é bloqueado.\n\n## Princípios\n1. [ex.: Toda a escrita é idempotente ou explicitamente justificada.]\n2. [ex.: Sem PII nos logs; os IDs de utilizador são pseudonimizados.]\n3. [ex.: Sem alteração de API com quebra sem um caminho de migração versionado.]\n4. [ex.: Os erros falham fechados (negar) no caminho de segurança.]\n\n## Restrições\n- [Restrições técnicas/regulatórias rígidas que limitam todos os designs.]\n\n## Regras de Decisão\n- [Como desempatar — ex.: 'preferir o aborrecido/comprovado ao engenhoso'.]\n",
    "product.md":
      "# Produto\n\n## Visão\n[Uma frase: o que é este produto e para quem é?]\n\n## Utilizadores-Alvo\n- Primário: [quem usa isto diariamente?]\n- Secundário: [quem mais lhe toca?]\n\n## Métricas de Sucesso\n- [métrica específica a 6 meses]\n\n## Não-objetivos\n- [o que isto explicitamente NÃO é]\n\n## Modelo de Negócio\n[como gera receita]\n",
    "tech.md":
      "# Tecnologia\n\n## Stack\n- Frontend: []\n- Backend: []\n- Base de Dados: []\n- Auth: []\n\n## Infraestrutura\n- Hosting / Região / CDN: []\n\n## Convenções\n- Linguagem / formatação / test runner / migrações / formato de commit: []\n\n## Restrições\n- Versão de runtime / suporte de browser / acessibilidade / regulatório: []\n",
    "structure.md":
      "# Estrutura do Projeto\n\n## Layout\n[árvore de diretórios]\n\n## Nomenclatura\n- Ficheiros / componentes / rotas de API / tabelas de BD / métricas: []\n\n## Commits\nConventional commits: `type(scope): description`. Tipos: feat|fix|refactor|test|docs|chore|style|perf\n\n## Branches e Revisões\n- main + feature/<nome>; revisões obrigatórias para merges para main.\n",
    "testing-standards.md":
      "# Padrões de Teste\n\n## Runner e Ferramentas\n- Unit/Integração: []\n- E2E: []\n- Mocking: []\n\n## Política de Cobertura\n- Alvo por defeito: []\n- Caminhos críticos (auth/faturação/dados): 100% de ramos.\n\n## Disciplina TDD\n- Sem implementação antes de um teste a falhar que exercite o caminho real.\n- 'Falhar pela razão certa' = assertion/NotImplemented, não erro de import/sintaxe.\n",
    "scale.md":
      "# Alvos de Escala\n\n## Alvos de Carga\n| Horizonte | Concorrentes | DAU | MAU | Pico RPS | Dados |\n|---|---|---|---|---|---|\n| Lançamento | | | | | |\n| 6 meses | | | | | |\n| 2 anos | | | | | |\n\n## Alvos de SLA\n| Classe de endpoint | P95 | P99 | Disponibilidade |\n|---|---|---|---|\n| Jornada crítica | | | |\n\n## Jornadas Críticas de Utilizador\n1. []\n\n## Limiares de Escalonamento\n- []\n",
    "observability.md":
      "# Padrões de Observabilidade\n\n## Logging\nJSON estruturado. Campos obrigatórios: ts, level, service, trace_id, span_id, tenant_id?, user_id?, msg, event. Sem secrets/PII.\n\n## Métricas\nEstilo Prometheus snake_case + sufixo de unidade. Por feature: contagem de pedidos, histograma de duração, contagem de erros, um contador de negócio. Cuidado com a cardinalidade de labels.\n\n## Traces\nOpenTelemetry, contexto W3C. Amostra 10% em prod, amostra sempre os erros.\n\n## Alertas (cada um liga a um runbook)\n- P0 página já / P1 ≤15min / P2 slack / P3 digest.\n",
    "cost.md":
      "# Orçamento de Custo\n\n## Orçamento de Infraestrutura\nAlvo: < $XX/mês no ano 1.\n\n## Alvo de Custo Por Utilizador\nAlvo: < $0,50 por MAU. Se for excedido, para e otimiza.\n\n## Alertas de Custo\n- Diário > $100 slack / > $200 página.\n\n## Revisão de Custo Por Feature\nCada Envelope de Custo no design.md estima $/1000 utilizadores/mês e sinaliza caminhos críticos de custo.\n",
    "ai-strategy.md":
      "# Estratégia de IA\n\n## Lista de Modelos\n| Papel | Modelo (ID fixado) | Porquê |\n|---|---|---|\n| Primário | | |\n| Fallback | | |\n| Juiz/classificador | | |\n\n## Postura de Fornecedor e Dados\n- Fornecedor / estado do DPA / a PII chega ao modelo: []\n\n## Disciplina de Prompt\n- Prompts em .specs/<feature>/prompts/vN.md, versionados. Nenhuma mudança é lançada sem re-correr os evals.\n\n## Envelope de Custo\n- Alvo $/ação de utilizador / limite de alerta rígido: []\n\n## Postura de Segurança\n- Defesa contra injeção / moderação / política de recusa: []\n\n## Barra de Avaliação (critérios para lançar)\n- Golden ≥85% bom · Segurança adversarial 100% recusado · Regressão 100% mantida.\n\n## Ciclo de Vida\n- Política de fixação / vigilância de descontinuação / migração com gate de avaliação.\n",
  },
  es: {
    "constitution.md":
      "# Constitución\n\nPrincipios innegociables que toda función debe cumplir. Mantenlos pocos, concretos y testeables.\nEl `doctor` y el `/prReview` verifican contra ellos; un diseño que viole un principio se bloquea.\n\n## Principios\n1. [p.ej., Toda escritura es idempotente o explícitamente justificada.]\n2. [p.ej., Sin PII en los logs; los IDs de usuario se pseudonimizan.]\n3. [p.ej., Sin cambio de API con ruptura sin una ruta de migración versionada.]\n4. [p.ej., Los errores fallan cerrados (denegar) en la ruta de seguridad.]\n\n## Restricciones\n- [Restricciones técnicas/regulatorias rígidas que limitan todos los diseños.]\n\n## Reglas de Decisión\n- [Cómo desempatar — p.ej., 'preferir lo aburrido/probado a lo ingenioso'.]\n",
    "product.md":
      "# Producto\n\n## Visión\n[Una frase: ¿qué es este producto y para quién es?]\n\n## Usuarios Objetivo\n- Primario: [¿quién usa esto a diario?]\n- Secundario: [¿quién más lo toca?]\n\n## Métricas de Éxito\n- [métrica específica a 6 meses]\n\n## No-objetivos\n- [lo que esto explícitamente NO es]\n\n## Modelo de Negocio\n[cómo genera ingresos]\n",
    "tech.md":
      "# Tecnología\n\n## Stack\n- Frontend: []\n- Backend: []\n- Base de Datos: []\n- Auth: []\n\n## Infraestructura\n- Hosting / Región / CDN: []\n\n## Convenciones\n- Lenguaje / formateo / test runner / migraciones / formato de commit: []\n\n## Restricciones\n- Versión de runtime / soporte de navegador / accesibilidad / regulatorio: []\n",
    "structure.md":
      "# Estructura del Proyecto\n\n## Layout\n[árbol de directorios]\n\n## Nomenclatura\n- Archivos / componentes / rutas de API / tablas de BD / métricas: []\n\n## Commits\nConventional commits: `type(scope): description`. Tipos: feat|fix|refactor|test|docs|chore|style|perf\n\n## Ramas y Revisiones\n- main + feature/<nombre>; revisiones obligatorias para merges a main.\n",
    "testing-standards.md":
      "# Estándares de Pruebas\n\n## Runner y Herramientas\n- Unit/Integración: []\n- E2E: []\n- Mocking: []\n\n## Política de Cobertura\n- Objetivo por defecto: []\n- Rutas críticas (auth/facturación/datos): 100% de ramas.\n\n## Disciplina TDD\n- Sin implementación antes de una prueba que falle ejercitando la ruta real.\n- 'Fallar por la razón correcta' = assertion/NotImplemented, no error de import/sintaxis.\n",
    "scale.md":
      "# Objetivos de Escala\n\n## Objetivos de Carga\n| Horizonte | Concurrentes | DAU | MAU | Pico RPS | Datos |\n|---|---|---|---|---|---|\n| Lanzamiento | | | | | |\n| 6 meses | | | | | |\n| 2 años | | | | | |\n\n## Objetivos de SLA\n| Clase de endpoint | P95 | P99 | Disponibilidad |\n|---|---|---|---|\n| Recorrido crítico | | | |\n\n## Recorridos Críticos de Usuario\n1. []\n\n## Umbrales de Escalado\n- []\n",
    "observability.md":
      "# Estándares de Observabilidad\n\n## Logging\nJSON estructurado. Campos obligatorios: ts, level, service, trace_id, span_id, tenant_id?, user_id?, msg, event. Sin secrets/PII.\n\n## Métricas\nEstilo Prometheus snake_case + sufijo de unidad. Por función: conteo de solicitudes, histograma de duración, conteo de errores, un contador de negocio. Cuidado con la cardinalidad de labels.\n\n## Traces\nOpenTelemetry, contexto W3C. Muestrea 10% en prod, muestrea siempre los errores.\n\n## Alertas (cada una liga a un runbook)\n- P0 página ya / P1 ≤15min / P2 slack / P3 digest.\n",
    "cost.md":
      "# Presupuesto de Coste\n\n## Presupuesto de Infraestructura\nObjetivo: < $XX/mes en el año 1.\n\n## Objetivo de Coste Por Usuario\nObjetivo: < $0,50 por MAU. Si se excede, para y optimiza.\n\n## Alertas de Coste\n- Diario > $100 slack / > $200 página.\n\n## Revisión de Coste Por Función\nCada Presupuesto de Coste en el design.md estima $/1000 usuarios/mes y señala rutas críticas de coste.\n",
    "ai-strategy.md":
      "# Estrategia de IA\n\n## Lista de Modelos\n| Rol | Modelo (ID fijado) | Por qué |\n|---|---|---|\n| Primario | | |\n| Fallback | | |\n| Juez/calificador | | |\n\n## Postura de Proveedor y Datos\n- Proveedor / estado del DPA / la PII llega al modelo: []\n\n## Disciplina de Prompt\n- Prompts en .specs/<feature>/prompts/vN.md, versionados. Ningún cambio se lanza sin re-correr los evals.\n\n## Presupuesto de Coste\n- Objetivo $/acción de usuario / umbral de alerta rígido: []\n\n## Postura de Seguridad\n- Defensa contra inyección / moderación / política de rechazo: []\n\n## Barra de Evaluación (criterios para lanzar)\n- Golden ≥85% bueno · Seguridad adversarial 100% rechazado · Regresión 100% mantenida.\n\n## Ciclo de Vida\n- Política de fijación / vigilancia de descontinuación / migración con gate de evaluación.\n",
  },
};

// The evals README is a single block per language (kept out of the per-language BUILD map
// because it carries no track logic).
const EVALS_README = {
  en:
    "# Evals\n\n" +
    "Local, offline-friendly eval harness. Run from the project root:\n\n" +
    "```\nnode <plugin>/mcp/evals/run-evals.js <feature-slug>\n```\n\n" +
    "- Uses your own `ANTHROPIC_API_KEY` (env). No CI, no third party beyond your model provider.\n" +
    "- Without an API key (or with `--dry-run`) it validates the sets and prints the plan without calling a model.\n" +
    "- `--set-baseline` records the current scores as the baseline to compare future runs against.\n\n" +
    "Set files: `golden.json`, `adversarial.json`, optional `regression.json`.\n" +
    "Item shape: `{ id, input, expect: { type, value|rubric } }`. Grader types: contains | equals | regex | refuse | judge.\n" +
    "The system prompt is read from the latest `../prompts/vN.md` (its `## System` section).\n",
  pt:
    "# Evals\n\n" +
    "Harness de avaliação local, amigável a offline. Corre a partir da raiz do projeto:\n\n" +
    "```\nnode <plugin>/mcp/evals/run-evals.js <slug-da-feature>\n```\n\n" +
    "- Usa o teu próprio `ANTHROPIC_API_KEY` (env). Sem CI, sem terceiros além do teu fornecedor de modelo.\n" +
    "- Sem chave de API (ou com `--dry-run`) valida os conjuntos e imprime o plano sem chamar um modelo.\n" +
    "- `--set-baseline` regista as pontuações atuais como baseline para comparar com corridas futuras.\n\n" +
    "Ficheiros de conjunto: `golden.json`, `adversarial.json`, opcional `regression.json`.\n" +
    "Formato de item: `{ id, input, expect: { type, value|rubric } }`. Tipos de grader: contains | equals | regex | refuse | judge.\n" +
    "O system prompt é lido do `../prompts/vN.md` mais recente (a sua secção `## System`).\n",
  es:
    "# Evals\n\n" +
    "Harness de evaluación local, amigable con offline. Corre desde la raíz del proyecto:\n\n" +
    "```\nnode <plugin>/mcp/evals/run-evals.js <slug-de-la-función>\n```\n\n" +
    "- Usa tu propio `ANTHROPIC_API_KEY` (env). Sin CI, sin terceros más allá de tu proveedor de modelo.\n" +
    "- Sin clave de API (o con `--dry-run`) valida los conjuntos e imprime el plan sin llamar a un modelo.\n" +
    "- `--set-baseline` registra las puntuaciones actuales como baseline para comparar con corridas futuras.\n\n" +
    "Archivos de conjunto: `golden.json`, `adversarial.json`, opcional `regression.json`.\n" +
    "Formato de ítem: `{ id, input, expect: { type, value|rubric } }`. Tipos de grader: contains | equals | regex | refuse | judge.\n" +
    "El system prompt se lee del `../prompts/vN.md` más reciente (su sección `## System`).\n",
};

// ===========================================================================
// Human-readable tool messages (doctor / clarify / next-action / add-track /
// init notes / hook output). Functions so callers interpolate freely.
// ===========================================================================

const MSG = {
  en: {
    initNote: "Stubs are placeholders. The skill fills them with real content (see references/steering-templates.md).",
    createNote: (lang) => null, // EN feature: no extra note
    addTrackNote: (tr, slug) => `Added +${tr}. Fill the new design sections, then re-run /doctor ${slug}.`,
    addTrackAlready: (tr) => `already on +${tr}`,
    doctor: {
      steeringMissing: (list) => `missing: ${list}`,
      steeringOk: "core steering present (incl. constitution)",
      requirementsMissing: "requirements.md missing",
      clarificationsOpen: (n) => `${n} unresolved [NEEDS CLARIFICATION] — resolve before design`,
      clarificationsNone: "none open",
      scPresent: "present",
      scMissing: "no measurable SC-### success criteria",
      prioritiesOk: "user stories prioritized",
      prioritiesMissing: "no P1 (MVP) priority on a user story",
      acDup: (list) => `duplicate AC IDs: ${list}`,
      acUnique: "AC IDs unique",
      designMissing: "design.md missing",
      mermaidOk: "has a diagram",
      mermaidMissing: "no mermaid diagram found",
      constitutionOk: "present — verify each principle is checked",
      constitutionMissing: "no Constitution Check section in design",
      saasAllFilled: "all 5 filled",
      aiAllFilled: "all 10 filled",
      gatesPending: (list) => `awaiting human approval: ${list} — run /approve before advancing`,
      gatesOk: "all present phases approved",
    },
    next: {
      fixChecks: (ids, slug) => `Fix blocking checks (${ids}) — run /doctor ${slug} for details.`,
      reReview: (files) => `Re-review: ${files} changed after the last approval — re-approve the affected phase.`,
      approveRequirements: (slug) => `Review & approve requirements — /approve ${slug} requirements.`,
      approveDesign: (slug) => `Review & approve design — /approve ${slug} design.`,
      approveTasks: (slug) => `Review & approve the task breakdown — /approve ${slug} tasks.`,
      implement: (n, text, slug) => `Implement task #${n}: ${text} — /executeTask ${slug}.`,
      allDone: "All tasks done — verify, then close the feature.",
      breakIntoTasks: (slug) => `Break the design into tasks — /tasks ${slug}.`,
    },
    clarify: {
      resolveMarker: (mk) => "Resolve [NEEDS CLARIFICATION]: " + (mk || "(unspecified)"),
      addSuccessCriteria: "Add a Success Criteria section with measurable, technology-agnostic outcomes (SC-001 …).",
      idSuccessCriteria: "Give each success criterion a stable ID (SC-001 …) and a measurable target.",
      prioritize: "Prioritize the user stories (P1 = the MVP slice that delivers value alone; P2/P3 incremental).",
      independentTest: "State how each user story can be tested independently (so it's shippable on its own).",
      quantifyVague: (line, text) => `Quantify the vague term on line ${line}: ${text}`,
      resolvePlaceholder: (line) => `Resolve placeholder/TBD on line ${line}.`,
      edgeCases: "List the edge cases and error-handling behavior (each as an IF…THEN AC).",
      outOfScope: "State explicitly what is OUT of scope.",
      nfr: "Specify non-functional requirements (performance / security / accessibility) with measurable targets.",
      unwanted: "Add unwanted-behavior criteria (IF…THEN / SE…ENTÃO / SI…ENTONCES) for failure paths.",
      tenant: "Specify tenant isolation: tenant A must never read/write tenant B's data (write it as an AC).",
      rateLimit: "Specify rate limits (per-user / per-tenant / global).",
      aiQuality: "Specify output-quality target and refusal behavior for the AI path.",
      aiCost: "Specify a cost ceiling per request ($/tokens).",
    },
    hook: {
      earsClean: (n) => `EARS check: ${n} criteria, all clean ✓`,
      earsIssues: (errs, warns, top, hasErr) =>
        `EARS check on requirements.md — ${errs} error(s), ${warns} warning(s):\n${top}` + (hasErr ? "\nFix the errors before advancing to design." : ""),
      traceOk: (n) => `Traceability: all ${n} ACs covered by tasks ✓`,
      traceGaps: (feature, parts) => `Traceability gaps in ${feature}:\n  - ${parts}`,
      traceUncovered: (list) => `ACs with no task: ${list}`,
      tracePhantomAc: (list) => `tasks reference unknown ACs (typos?): ${list}`,
      traceUncoveredTests: (list) => `ACs with no planned test: ${list}`,
      tracePhantomTests: (list) => `tasks reference unknown tests: ${list}`,
      roadmapUpdated: (pct, complete, total) => `Roadmap updated → ${pct}% (${complete}/${total} features).`,
      sessionHeader: "dev-spec-driven — features in .specs/:",
    },
  },

  pt: {
    initNote: "Os stubs são placeholders. A skill preenche-os com conteúdo real (ver references/steering-templates.md).",
    createNote: () => null,
    addTrackNote: (tr, slug) => `+${tr} adicionado. Preenche as novas secções de design e volta a correr /doctor ${slug}.`,
    addTrackAlready: (tr) => `já tem +${tr}`,
    doctor: {
      steeringMissing: (list) => `em falta: ${list}`,
      steeringOk: "steering essencial presente (incl. constituição)",
      requirementsMissing: "requirements.md em falta",
      clarificationsOpen: (n) => `${n} [NEEDS CLARIFICATION] por resolver — resolve antes do design`,
      clarificationsNone: "nenhum por resolver",
      scPresent: "presente",
      scMissing: "sem critérios de sucesso mensuráveis SC-###",
      prioritiesOk: "histórias de utilizador priorizadas",
      prioritiesMissing: "sem prioridade P1 (MVP) numa história de utilizador",
      acDup: (list) => `IDs de AC duplicados: ${list}`,
      acUnique: "IDs de AC únicos",
      designMissing: "design.md em falta",
      mermaidOk: "tem um diagrama",
      mermaidMissing: "nenhum diagrama mermaid encontrado",
      constitutionOk: "presente — verifica que cada princípio é validado",
      constitutionMissing: "sem secção Verificação da Constituição no design",
      saasAllFilled: "as 5 preenchidas",
      aiAllFilled: "as 10 preenchidas",
      gatesPending: (list) => `a aguardar aprovação humana: ${list} — corre /approve antes de avançar`,
      gatesOk: "todas as fases presentes aprovadas",
    },
    next: {
      fixChecks: (ids, slug) => `Corrige as verificações bloqueantes (${ids}) — corre /doctor ${slug} para detalhes.`,
      reReview: (files) => `Re-revisão: ${files} mudou após a última aprovação — volta a aprovar a fase afetada.`,
      approveRequirements: (slug) => `Revê e aprova os requisitos — /approve ${slug} requirements.`,
      approveDesign: (slug) => `Revê e aprova o design — /approve ${slug} design.`,
      approveTasks: (slug) => `Revê e aprova a divisão de tarefas — /approve ${slug} tasks.`,
      implement: (n, text, slug) => `Implementa a tarefa #${n}: ${text} — /executeTask ${slug}.`,
      allDone: "Todas as tarefas feitas — verifica e depois fecha a feature.",
      breakIntoTasks: (slug) => `Divide o design em tarefas — /tasks ${slug}.`,
    },
    clarify: {
      resolveMarker: (mk) => "Resolve [NEEDS CLARIFICATION]: " + (mk || "(não especificado)"),
      addSuccessCriteria: "Adiciona uma secção Critérios de Sucesso com resultados mensuráveis e agnósticos à tecnologia (SC-001 …).",
      idSuccessCriteria: "Dá a cada critério de sucesso um ID estável (SC-001 …) e um alvo mensurável.",
      prioritize: "Prioriza as histórias de utilizador (P1 = a fatia MVP que entrega valor sozinha; P2/P3 incrementais).",
      independentTest: "Indica como cada história de utilizador pode ser testada de forma independente (para ser lançável por si só).",
      quantifyVague: (line, text) => `Quantifica o termo vago na linha ${line}: ${text}`,
      resolvePlaceholder: (line) => `Resolve o placeholder/TBD na linha ${line}.`,
      edgeCases: "Lista os casos limite e o comportamento de tratamento de erros (cada um como um AC SE…ENTÃO).",
      outOfScope: "Indica explicitamente o que está FORA de âmbito.",
      nfr: "Especifica os requisitos não-funcionais (desempenho / segurança / acessibilidade) com alvos mensuráveis.",
      unwanted: "Adiciona critérios de comportamento indesejado (SE…ENTÃO / IF…THEN / SI…ENTONCES) para os caminhos de falha.",
      tenant: "Especifica o isolamento de inquilino: o inquilino A nunca pode ler/escrever dados do inquilino B (escreve-o como um AC).",
      rateLimit: "Especifica os limites de taxa (por utilizador / por inquilino / global).",
      aiQuality: "Especifica o alvo de qualidade de output e o comportamento de recusa para o caminho de IA.",
      aiCost: "Especifica um teto de custo por pedido ($/tokens).",
    },
    hook: {
      earsClean: (n) => `Verificação EARS: ${n} critérios, tudo limpo ✓`,
      earsIssues: (errs, warns, top, hasErr) =>
        `Verificação EARS em requirements.md — ${errs} erro(s), ${warns} aviso(s):\n${top}` + (hasErr ? "\nCorrige os erros antes de avançar para o design." : ""),
      traceOk: (n) => `Rastreabilidade: todos os ${n} ACs cobertos por tarefas ✓`,
      traceGaps: (feature, parts) => `Lacunas de rastreabilidade em ${feature}:\n  - ${parts}`,
      traceUncovered: (list) => `ACs sem tarefa: ${list}`,
      tracePhantomAc: (list) => `tarefas referem ACs desconhecidos (erros de escrita?): ${list}`,
      traceUncoveredTests: (list) => `ACs sem teste planeado: ${list}`,
      tracePhantomTests: (list) => `tarefas referem testes desconhecidos: ${list}`,
      roadmapUpdated: (pct, complete, total) => `Roadmap atualizado → ${pct}% (${complete}/${total} features).`,
      sessionHeader: "dev-spec-driven — features em .specs/:",
    },
  },

  es: {
    initNote: "Los stubs son placeholders. La skill los rellena con contenido real (ver references/steering-templates.md).",
    createNote: () => null,
    addTrackNote: (tr, slug) => `+${tr} añadido. Rellena las nuevas secciones de diseño y vuelve a correr /doctor ${slug}.`,
    addTrackAlready: (tr) => `ya tiene +${tr}`,
    doctor: {
      steeringMissing: (list) => `falta: ${list}`,
      steeringOk: "steering esencial presente (incl. constitución)",
      requirementsMissing: "requirements.md falta",
      clarificationsOpen: (n) => `${n} [NEEDS CLARIFICATION] sin resolver — resuelve antes del diseño`,
      clarificationsNone: "ninguno sin resolver",
      scPresent: "presente",
      scMissing: "sin criterios de éxito medibles SC-###",
      prioritiesOk: "historias de usuario priorizadas",
      prioritiesMissing: "sin prioridad P1 (MVP) en una historia de usuario",
      acDup: (list) => `IDs de AC duplicados: ${list}`,
      acUnique: "IDs de AC únicos",
      designMissing: "design.md falta",
      mermaidOk: "tiene un diagrama",
      mermaidMissing: "no se encontró diagrama mermaid",
      constitutionOk: "presente — verifica que cada principio se comprueba",
      constitutionMissing: "sin sección Verificación de la Constitución en el diseño",
      saasAllFilled: "las 5 rellenadas",
      aiAllFilled: "las 10 rellenadas",
      gatesPending: (list) => `esperando aprobación humana: ${list} — corre /approve antes de avanzar`,
      gatesOk: "todas las fases presentes aprobadas",
    },
    next: {
      fixChecks: (ids, slug) => `Corrige las verificaciones bloqueantes (${ids}) — corre /doctor ${slug} para detalles.`,
      reReview: (files) => `Revisión de nuevo: ${files} cambió tras la última aprobación — vuelve a aprobar la fase afectada.`,
      approveRequirements: (slug) => `Revisa y aprueba los requisitos — /approve ${slug} requirements.`,
      approveDesign: (slug) => `Revisa y aprueba el diseño — /approve ${slug} design.`,
      approveTasks: (slug) => `Revisa y aprueba el desglose de tareas — /approve ${slug} tasks.`,
      implement: (n, text, slug) => `Implementa la tarea #${n}: ${text} — /executeTask ${slug}.`,
      allDone: "Todas las tareas hechas — verifica y luego cierra la función.",
      breakIntoTasks: (slug) => `Desglosa el diseño en tareas — /tasks ${slug}.`,
    },
    clarify: {
      resolveMarker: (mk) => "Resuelve [NEEDS CLARIFICATION]: " + (mk || "(sin especificar)"),
      addSuccessCriteria: "Añade una sección Criterios de Éxito con resultados medibles y agnósticos a la tecnología (SC-001 …).",
      idSuccessCriteria: "Da a cada criterio de éxito un ID estable (SC-001 …) y un objetivo medible.",
      prioritize: "Prioriza las historias de usuario (P1 = la porción MVP que entrega valor sola; P2/P3 incrementales).",
      independentTest: "Indica cómo cada historia de usuario puede testearse de forma independiente (para ser lanzable por sí sola).",
      quantifyVague: (line, text) => `Cuantifica el término vago en la línea ${line}: ${text}`,
      resolvePlaceholder: (line) => `Resuelve el placeholder/TBD en la línea ${line}.`,
      edgeCases: "Lista los casos límite y el comportamiento de manejo de errores (cada uno como un AC SI…ENTONCES).",
      outOfScope: "Indica explícitamente qué está FUERA de alcance.",
      nfr: "Especifica los requisitos no funcionales (rendimiento / seguridad / accesibilidad) con objetivos medibles.",
      unwanted: "Añade criterios de comportamiento no deseado (SI…ENTONCES / IF…THEN / SE…ENTÃO) para las rutas de fallo.",
      tenant: "Especifica el aislamiento de inquilino: el inquilino A nunca debe leer/escribir datos del inquilino B (escríbelo como un AC).",
      rateLimit: "Especifica los límites de tasa (por usuario / por inquilino / global).",
      aiQuality: "Especifica el objetivo de calidad de salida y el comportamiento de rechazo para la ruta de IA.",
      aiCost: "Especifica un techo de coste por solicitud ($/tokens).",
    },
    hook: {
      earsClean: (n) => `Verificación EARS: ${n} criterios, todo limpio ✓`,
      earsIssues: (errs, warns, top, hasErr) =>
        `Verificación EARS en requirements.md — ${errs} error(es), ${warns} aviso(s):\n${top}` + (hasErr ? "\nCorrige los errores antes de avanzar al diseño." : ""),
      traceOk: (n) => `Trazabilidad: los ${n} ACs cubiertos por tareas ✓`,
      traceGaps: (feature, parts) => `Lagunas de trazabilidad en ${feature}:\n  - ${parts}`,
      traceUncovered: (list) => `ACs sin tarea: ${list}`,
      tracePhantomAc: (list) => `tareas referencian ACs desconocidos (¿erratas?): ${list}`,
      traceUncoveredTests: (list) => `ACs sin prueba planeada: ${list}`,
      tracePhantomTests: (list) => `tareas referencian pruebas desconocidas: ${list}`,
      roadmapUpdated: (pct, complete, total) => `Roadmap actualizado → ${pct}% (${complete}/${total} funciones).`,
      sessionHeader: "dev-spec-driven — funciones en .specs/:",
    },
  },
};

// ===========================================================================
// Public API — thin dispatchers that resolve the language and delegate.
// ===========================================================================

function L(lang) { return BUILD[normalizeLang(lang)]; }

module.exports = {
  LANGS,
  normalizeLang,
  // artifact builders
  classification: (a, lang) => L(lang).classification(a),
  requirements: (a, lang) => L(lang).requirements(a),
  trackDesignBlock: (track, lang) => L(lang).trackDesignBlock(track),
  design: (a, lang) => L(lang).design(a),
  tasks: (a, lang) => L(lang).tasks(a),
  testPlan: (name, lang) => L(lang).testPlan(name),
  evalPlan: (name, lang) => L(lang).evalPlan(name),
  loadTest: (name, lang) => L(lang).loadTest(name),
  quickstart: (name, lang) => L(lang).quickstart(name),
  checklist: (a, lang) => L(lang).checklist(a),
  integrationPlan: (name, lang) => L(lang).integrationPlan(name),
  promptStub: (name, lang) => L(lang).promptStub(name),
  evalsReadme: (lang) => EVALS_README[normalizeLang(lang)],
  // steering
  steeringStub: (file, lang) => STEERING[normalizeLang(lang)][file],
  steeringKnownFiles: () => Object.keys(STEERING.en),
  // tool messages
  msg: (lang) => MSG[normalizeLang(lang)],
};
