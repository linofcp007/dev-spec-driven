"use strict";

/**
 * dev-spec-driven i18n — European Portuguese (pt). pt-BR is DERIVED from this file (i18n/pt-br.js): when you add or edit a string, read its
 * Brazilian twin once — node -e "console.log(require('./mcp/lib/i18n.js').toPtBr('…'))".
 *
 * Every table's pt block: the artifact builders (BUILD), the steering stubs, the evals README, the tool messages (MSG
 * with its quality / designWeigh groups) and the task-brief labels. mcp/lib/i18n.js assembles the tables and is what the
 * engine requires. Blocks keep the indentation they had inside i18n.js's tables.
 */
const { DEV_SPEC, MARKER_TRACK_ORDER, greenLine, signalTracks, templateTestRows, templateTests, coreSuperseded, stopLineClaim } = require("./common.js"); // load time
// The assembled tables — call-time use only; mcp/lib/i18n.js links them once every language has loaded.
let BUILD, MSG;
function __link(T) { ({ BUILD, MSG } = T); }

// ===========================================================================
// Artifact builders, one set per language. EN is the canonical reference; since 1.13 its templates are
// internally consistent (every template AC planned and tasked) — the gates would otherwise flag the scaffold.
// ===========================================================================
const build = {
    classification(a) {
      const sig = a.signals || { tdd: [], saas: [], ai: [] };
      const sigLine = (t) =>
        a.tracks.includes(t)
          ? `- **+${t}:** ${[...new Set(sig[t] || [])].slice(0, 6).join(", ") || "[sinal]"} — [porque se aplica]`
          : null;
      const signalLines = signalTracks(a.tracks).map(sigLine).filter(Boolean).join("\n") || "- nenhum além de core";
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
        ? "\n\n#### [SaaS] Critérios de Aceitação (EARS)\n5. **US-1.AC-5** — QUANDO um utilizador do inquilino A pede dados, O SISTEMA NÃO DEVE devolver qualquer registo cujo tenant_id != A.\n6. **US-1.AC-6** — O SISTEMA DEVE responder em [N]ms no P95."
        : "";
      const aiAc = a.tracks.includes("ai")
        ? "\n\n#### [AI] Critérios de Aceitação (EARS)\n7. **US-1.AC-7** — O SISTEMA DEVE produzir saídas classificadas como 'boas ou excelentes' em pelo menos [85]% do conjunto de avaliação golden.\n8. **US-1.AC-8** — SE a entrada contiver uma tentativa de injeção de prompt, ENTÃO O SISTEMA DEVE ignorar a instrução injetada e concluir a tarefa original.\n9. **US-1.AC-9** — O SISTEMA DEVE custar no máximo $[0.03] por pedido de utilizador no tamanho P95."
        : "";
      const secAc = a.tracks.includes("sec")
        ? "\n\n#### [SEC] Critérios de Aceitação (EARS)\n10. **US-1.AC-10** — SE um pedido não autenticado chegar a um endpoint protegido, ENTÃO O SISTEMA DEVE rejeitá-lo com 401 e não devolver dados protegidos.\n11. **US-1.AC-11** — SE um utilizador autenticado pedir um recurso a que não tem autorização de acesso, ENTÃO O SISTEMA DEVE negá-lo com 403 e registar um evento de auditoria de segurança.\n12. **US-1.AC-12** — O SISTEMA NÃO DEVE incluir segredos, credenciais, tokens de sessão ou stack traces em nenhuma resposta nem entrada de log."
        : "";
      const privacyAc = a.tracks.includes("privacy")
        ? "\n\n#### [PRIVACY] Critérios de Aceitação (EARS)\n13. **US-1.AC-13** — QUANDO um titular dos dados pede uma cópia dos seus dados pessoais, O SISTEMA DEVE exportá-los num formato estruturado e de leitura automática no prazo de um mês.\n14. **US-1.AC-14** — QUANDO o pedido de apagamento de um titular dos dados é aceite, O SISTEMA DEVE apagar ou anonimizar de forma irreversível os seus dados pessoais em todos os repositórios no prazo de um mês.\n15. **US-1.AC-15** — QUANDO o prazo de conservação de um registo termina, O SISTEMA DEVE apagá-lo ou anonimizá-lo."
        : "";
      const distAc = a.tracks.includes("dist")
        ? "\n\n#### [DIST] Critérios de Aceitação (EARS)\n16. **US-1.AC-16** — SE a publicação [do evento] falhar depois do commit da transação na base de dados, ENTÃO O SISTEMA DEVE entregá-lo mais tarde, pelo menos uma vez, sem que se perca (outbox transacional).\n17. **US-1.AC-17** — QUANDO a mesma mensagem for entregue mais de uma vez, O SISTEMA DEVE aplicar o seu efeito exatamente uma vez (consumidor idempotente).\n18. **US-1.AC-18** — QUANDO dois pedidos atualizarem a mesma [entidade] em simultâneo, O SISTEMA NÃO DEVE perder nenhuma das atualizações (bloqueio otimista ou uma restrição de unicidade).\n19. **US-1.AC-19** — SE [a dependência] estiver indisponível, ENTÃO O SISTEMA DEVE [degradar / repetir com recuo exponencial e jitter] e NÃO DEVE bloquear [o caminho crítico]."
        : "";
      const apiAc = a.tracks.includes("api")
        ? "\n\n#### [API] Critérios de Aceitação (EARS)\n20. **US-1.AC-20** — SE um pedido omitir [um campo obrigatório] ou o enviar mal formado, ENTÃO O SISTEMA DEVE responder 400 com um corpo application/problem+json que indica o campo e traz um código de erro estável.\n21. **US-1.AC-21** — QUANDO um cliente repetir [um pedido de criação] com a mesma Idempotency-Key e o mesmo corpo, O SISTEMA DEVE devolver a primeira resposta sem aplicar o efeito outra vez.\n22. **US-1.AC-22** — SE uma atualização trouxer um ETag If-Match que já não corresponde ao recurso, ENTÃO O SISTEMA DEVE responder 412 e deixar o recurso inalterado.\n23. **US-1.AC-23** — SE uma alteração ao contrato puder quebrar um cliente existente, ENTÃO O SISTEMA DEVE publicá-la só numa nova [versão da API] e manter a versão atual a funcionar até à data de Sunset anunciada."
        : "";
      const uiAc = a.tracks.includes("ui")
        ? "\n\n#### [UI] Critérios de Aceitação (EARS)\n24. **US-1.AC-24** — QUANDO um utilizador opera [a vista] só com o teclado, O SISTEMA DEVE tornar cada ação alcançável e operável numa ordem de foco lógica, com um indicador de foco visível.\n25. **US-1.AC-25** — SE um formulário submetido tiver campos inválidos, ENTÃO O SISTEMA DEVE manter todos os valores introduzidos, identificar cada erro em texto junto ao seu campo e mover o foco para um resumo dos erros.\n26. **US-1.AC-26** — ENQUANTO [a lista] não tiver itens, O SISTEMA DEVE mostrar um estado vazio que explica porquê e oferece a próxima ação.\n27. **US-1.AC-27** — SE o carregamento [dos dados] falhar, ENTÃO O SISTEMA DEVE mostrar uma mensagem de erro com uma ação Tentar de novo e manter o conteúdo já mostrado."
        : "";
      const obsAc = a.tracks.includes("obs")
        ? "\n\n#### [OBS] Critérios de Aceitação (EARS)\n28. **US-1.AC-28** — O SISTEMA DEVE emitir [a métrica do pedido] com a latência, o resultado e um ID de correlação para cada [pedido], e registar cada erro com esse ID de correlação e sem dados pessoais.\n29. **US-1.AC-29** — QUANDO a taxa de consumo do orçamento de erro [do SLO] exceder [14,4]× durante [uma hora], O SISTEMA DEVE alertar a pessoa de serviço (on-call) com uma ligação para o runbook.\n30. **US-1.AC-30** — SE a taxa de erro do canário exceder [a referência] em [N] pontos percentuais, ENTÃO O SISTEMA DEVE parar o rollout e reverter automaticamente para a versão anterior.\n31. **US-1.AC-31** — ENQUANTO [uma dependência] estiver indisponível, O SISTEMA DEVE indicar que não está pronto (verificação de prontidão) sem deixar de estar vivo, e recuperar sem reinício quando ela voltar."
        : "";
      const dataAc = a.tracks.includes("data") // +data (1.21 F4)
        ? "\n\n#### [DATA] Critérios de Aceitação (EARS)\n32. **US-1.AC-32** — QUANDO um lote contiver uma linha que viole [uma regra de qualidade de dados], O SISTEMA DEVE pôr essa linha em quarentena com a regra que falhou e NÃO DEVE carregá-la em [a tabela de destino].\n33. **US-1.AC-33** — SE o job for executado de novo para uma partição já carregada, ENTÃO O SISTEMA DEVE produzir o mesmo resultado que uma única execução, sem linhas duplicadas nem perdidas (uma reexecução e um backfill idempotentes).\n34. **US-1.AC-34** — SE os dados mais recentes de [a tabela] forem mais antigos do que [o seu SLA de atualidade], ENTÃO O SISTEMA DEVE alertar [o responsável] e marcar a tabela como desatualizada para os seus consumidores.\n35. **US-1.AC-35** — QUANDO o esquema de [a origem] mudar, O SISTEMA DEVE aceitar uma alteração aditiva e retrocompatível e DEVE rejeitar uma alteração incompatível (uma coluna removida ou renomeada, um tipo mais restrito) antes de qualquer linha chegar a [os consumidores]."
        : "";
      // 1.21 F5 — tamanho S (o EN é a referência): uma história, dois critérios core (QUANDO · SE…ENTÃO), todos os das tracks.
      if (a.size === "s") {
        return (
`# Feature: ${a.name}

## Resumo
${a.summary || "[1-2 frases: o que faz e porque importa]"}

## História de Utilizador

### US-1 (P1 — MVP): [Título da História]
**Como** [papel], **quero** [capacidade], **para que** [benefício].
**Teste Independente:** Pode ser totalmente testada através de [ação específica] e entrega [valor específico].

#### Critérios de Aceitação (EARS)
1. **US-1.AC-1** — QUANDO [gatilho] O SISTEMA DEVE [comportamento]
2. **US-1.AC-2** — SE [condição de erro] ENTÃO O SISTEMA DEVE [recuperação]${saasAc}${aiAc}${secAc}${privacyAc}${distAc}${apiAc}${uiAc}${obsAc}${dataAc}

## Critérios de Sucesso (mensuráveis, agnósticos à tecnologia)
- **SC-001** — [ex.: 90% dos utilizadores completam [tarefa] em menos de [N] segundos]

## Fora de Âmbito
- [O que esta feature NÃO inclui]

<!-- Tamanho S: uma história. Cada AC contém DEVE e é testável; mantém IDs de AC estáveis. Marca qualquer ambiguidade inline
     com um marcador como  [NEEDS CLARIFICATION: que fornecedor?] . Uma segunda história, casos limite ou NFR = tamanho m. -->
`
        );
      }
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
4. **US-1.AC-4** — [ubíquo] O SISTEMA DEVE [propriedade sempre verdadeira]${saasAc}${aiAc}${secAc}${privacyAc}${distAc}${apiAc}${uiAc}${obsAc}${dataAc}

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
- Utilizadores em simultâneo (lançamento/6m/2a) · crescimento de dados · caminhos críticos · caching (TTL+invalidação) · estratégia de filas · índices · sharding.

## [SaaS] Modelo Multi-inquilino
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Isolamento (pooled/siloed/bridged) · como o tenant_id é garantido · limites noisy-neighbor · exportar/eliminar (GDPR).

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
      if (track === "sec") {
        return `
## [SEC] Modelo de Ameaças
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Ativos · atores · fronteiras de confiança · pontos de entrada · STRIDE por componente / fronteira (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) → mitigação · risco residual.

## [SEC] Requisitos de Segurança
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Nível OWASP ASVS alvo (L1 / L2 / L3) e porquê · os controlos ASVS e os riscos do OWASP Top 10 em âmbito → como o design cumpre cada um.

## [SEC] Autenticação e Autorização
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Quem pode fazer o quê (matriz de papéis / permissões) · autenticação (sessão, token, MFA) · verificação ao nível do objeto, negar por omissão · duração e revogação da sessão.

## [SEC] Gestão de Segredos e Chaves
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Segredos de que a feature precisa · onde ficam (um cofre de segredos — nunca no código, nos logs ou em tickets) · rotação · cifragem em repouso / em trânsito e quem detém as chaves.

## [SEC] Testes de Segurança
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- SAST · análise de dependências e de segredos · DAST quando exposto · um teste de caso de abuso por ameaça relevante — tudo executável localmente antes do merge.
`;
      }
      if (track === "privacy") {
        return `
## [PRIVACY] Inventário de Dados Pessoais
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Cada campo de dados pessoais · categoria (categorias especiais — art. 9.º — assinaladas) · origem · onde é guardado · quem lhe pode aceder.

## [PRIVACY] Fundamento de Licitude e Finalidade
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Finalidade por atividade de tratamento · o seu fundamento de licitude (art. 6.º: consentimento, contrato, obrigação jurídica, interesses vitais, interesse público, interesses legítimos) · como o consentimento é registado e retirado.

## [PRIVACY] Conservação e Eliminação
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Prazo de conservação por categoria de dados e porquê · o processo de eliminação / anonimização · cópias de segurança e logs · conservação por obrigação legal.

## [PRIVACY] Direitos dos Titulares dos Dados
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Acesso · retificação · apagamento · limitação · portabilidade · oposição — como cada pedido é verificado, atendido e respondido no prazo de um mês.

## [PRIVACY] Subcontratantes e Transferências Internacionais
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Subcontratantes / subcontratantes ulteriores e os respetivos contratos (art. 28.º) · onde os dados são guardados e tratados · transferências para fora do EEE e a sua garantia (decisão de adequação, cláusulas contratuais-tipo).

## [PRIVACY] AIPD (quando obrigatória — art. 35.º)
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- É obrigatória? (risco elevado: categorias especiais em grande escala, controlo sistemático, definição de perfis com efeitos jurídicos…) · se sim: riscos → medidas → risco residual; se não: porque não.
`;
      }
      if (track === "dist") {
        return `
## [DIST] Modelo de Consistência
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- O que tem de ser atómico (uma transação) · se ACID é necessário, com que nível de isolamento e porquê · onde a consistência é forte e onde é eventual · o atraso que o negócio aceita · necessidades de ler as próprias escritas.

## [DIST] Escritas entre Sistemas
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Cada escrita que toca mais de um sistema (BD + broker, BD + cache, BD + API externa) → a sua mitigação: outbox transacional (+ relay / CDC), inbox, saga com compensações — ou o risco assumido explicitamente, e por quem.

## [DIST] Entrega e Idempotência
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Garantia de entrega (pelo menos uma vez) · chaves de idempotência ou idempotência natural · deduplicação (tabela inbox, restrição de unicidade) · política de novas tentativas (recuo exponencial + jitter, máximo de tentativas, o que nunca se repete) · DLQ / mensagens venenosas · requisitos de ordem.

## [DIST] Concorrência
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Condições de corrida em cada registo partilhado · bloqueio otimista (coluna de versão) ou pessimista (SELECT … FOR UPDATE) · restrições de unicidade · anomalias de isolamento excluídas (atualização perdida, write skew) · tempos limite de bloqueio e deadlocks.

## [DIST] Modos de Falha
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Falhas parciais e tempos limite por dependência · o que acontece quando cada dependência está indisponível (degradar, pôr em fila, falhar rapidamente) · partições de rede: o compromisso CAP / PACELC escolhido · recuperação e reconciliação (reprocessamento, compensação, um processo de reconciliação).
`;
      }
      if (track === "api") {
        return `
## [API] Contrato da API
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Estilo (REST / GraphQL / gRPC) · recursos e operações (método + caminho, ou query / mutation / RPC) · esquemas de pedido e de resposta · onde está o ficheiro do contrato (documento OpenAPI, ficheiros .proto, esquema GraphQL) — escrito primeiro, revisto antes dos handlers · scopes de autorização por operação.

## [API] Versionamento e Compatibilidade
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Estratégia de versionamento (URL / cabeçalho / data) · o que é aqui uma alteração incompatível (um campo removido ou renomeado, um novo dado obrigatório, um tipo ou código de estado alterado, uma validação mais estrita) · só alterações aditivas dentro de uma versão · descontinuação: os cabeçalhos Deprecation / Sunset, o prazo de aviso, como os clientes são avisados.

## [API] Modelo de Erros
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Formato dos erros: application/problem+json (RFC 9457 — type, title, status, detail, instance) · os códigos de erro estáveis em que os clientes se podem basear · erros de validação por campo · os códigos de estado que cada operação devolve · nenhum stack trace nem detalhe interno numa resposta.

## [API] Paginação, Idempotência e Concorrência
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Paginação: um cursor opaco com ordem estável e um tamanho máximo de página (ou offset, e porquê) · Idempotency-Key nas criações não idempotentes (o seu âmbito, durante quanto tempo uma chave é guardada, uma chave reutilizada com outro corpo → 422) · ETag / If-Match nas atualizações (412 numa versão desatualizada) · operações demoradas (202 + um recurso de estado).

## [API] Limites de Taxa e Quotas
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Limites por cliente / chave / inquilino e as suas janelas · 429 com Retry-After e os cabeçalhos RateLimit · quotas e como um cliente sabe quanto ainda lhe resta · o que fica isento.
`;
      }
      if (track === "ui") {
        return `
## [UI] Uso do Design System
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Os componentes do design system usados e os tokens (cor, espaçamento, tipografia) · cada componente novo: porque os existentes não servem e como entra no sistema (documentado, revisto, na biblioteca de componentes) · nenhum estilo avulso nem cor fixa no código.

## [UI] Estados da Interface
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Por vista, uma matriz de estados: a carregar · vazio · erro (com Tentar de novo) · parcial · offline · sem permissão · sucesso — o que o utilizador vê e pode fazer em cada um; validação de formulários (no campo + um resumo, os valores mantidos).

## [UI] Acessibilidade
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- WCAG 2.2 AA: operável com o teclado e ordem de foco visível · nome / etiqueta em cada controlo · contraste (4,5:1 no texto, 3:1 na interface) · tamanho dos alvos (24×24 px) · movimento reduzido · erros identificados em texto · como é testado (uma verificação automática + uma passagem manual com teclado e leitor de ecrã).

## [UI] Design Responsivo e i18n
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Breakpoints e como o layout se adapta · expansão do texto (+30–40 %) · layouts da direita para a esquerda · formatos do locale (datas, números, moeda) · todas as strings no catálogo de traduções.

## [UI] Orçamento de Desempenho da Interface
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Core Web Vitals no percentil 75: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 · o orçamento de JS / imagens desta vista · como é medido (laboratório + utilizadores reais).
`;
      }
      if (track === "obs") {
        return `
## [OBS] SLIs e SLOs
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Os percursos de utilizador que importam → os seus SLIs (disponibilidade, latência, correção) · o SLO de cada um numa janela (ex.: 99,5 % dos pedidos válidos abaixo de 800 ms, 28 dias) · o orçamento de erro e o que acontece quando se esgota · alertas por taxa de consumo (rápida e lenta).

## [OBS] Telemetria
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Métricas (RED por endpoint / USE por recurso, um contador de negócio; cardinalidade de labels limitada) · logs estruturados com um ID de correlação / trace — sem dados pessoais · traces com o contexto propagado entre chamadas e filas (OpenTelemetry) · as métricas que cada tarefa emite.

## [OBS] Alertas e Runbooks
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Cada alerta: o sintoma (um consumo do SLO, não uma causa), o limiar, a severidade e quem é chamado · cada chamada liga a um runbook (triagem, mitigação, verificação) · o que é um ticket e não uma chamada · dashboards por percurso.

## [OBS] Lançamento e Reversão
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Feature flags (quem é dono de cada uma, quando é removida) · os passos do canário / rollout progressivo e as métricas que decidem cada passo · critérios de reversão (ex.: taxa de erro acima da referência) e quanto demora uma reversão · migrações reversíveis (expand / contract).

## [OBS] Saúde e Capacidade
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Verificações de vida vs de prontidão (o que cada uma verifica — nunca uma dependência na de vida) · os sinais de capacidade (saturação, profundidade de filas, uso de pools) e os seus limiares · a carga esperada e onde está o primeiro estrangulamento.
`;
      }
      if (track === "data") {
        return `
## [DATA] Contratos de Dados e Evolução do Esquema
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Cada conjunto de dados produzido ou consumido: o produtor, os consumidores e o responsável pelo contrato · o esquema (colunas, tipos, nulidade, chaves, unidades) e onde vive (um ficheiro de esquema, o YAML de um modelo dbt, um registo de esquemas) · a regra de compatibilidade (só alterações aditivas; uma coluna removida ou renomeada → uma nova versão com um período de descontinuação) · como uma alteração incompatível é travada antes de ser entregue.

## [DATA] Qualidade dos Dados
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- As verificações por conjunto de dados: chaves não nulas, unicidade, valores e intervalos admitidos, integridade referencial, anomalias de contagem de linhas e de volume, atualidade · onde corre cada uma (na ingestão, após cada transformação, antes de publicar) · o que faz uma falha (pôr as linhas em quarentena, parar a carga, alertar o responsável) — nenhuma linha errada chega a um consumidor em silêncio.

## [DATA] Idempotência do Pipeline e Backfills
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- A unidade de trabalho (uma partição: um dia, uma hora, um ID de lote) e como uma reexecução a substitui (sobrescrever a partição ou MERGE numa chave — nunca um append às cegas) · dados que chegam atrasados: a janela de lookback e como as linhas atrasadas são integradas · o procedimento de backfill (intervalo, paralelismo, custo, uma execução de ensaio, quem o aprova) · grandes volumes: references/distributed-data-patterns.md.

## [DATA] Linhagem e Responsáveis
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- Origens → transformações → consumidores (um diagrama de linhagem ou o DAG do dbt) · o responsável por cada conjunto de dados e quem é avisado quando falha · o SLA de atualidade de que os consumidores dependem · o histórico que cada tabela guarda (dimensões de alteração lenta: o tipo 1 sobrescreve, o tipo 2 guarda versões).

## [DATA] Retenção e Custo
> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).
- A retenção por conjunto de dados e por camada de armazenamento (a zona bruta vs a curada; quente / morna / fria) — os dados pessoais seguem references/privacy-track.md · particionamento e clustering para que uma consulta leia só o que precisa · o custo esperado de armazenamento e de consultas por mês e o alerta quando se desvia.
`;
      }
      return "";
    },

    design(a) {
      const extra = ["tdd", ...MARKER_TRACK_ORDER].filter((t) => a.tracks.includes(t)).map((t) => BUILD.pt.trackDesignBlock(t)).join("");
      if (a.size) return BUILD.pt.sizedDesign(a, extra);
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

## Reutilização e Integração
<!-- Pesquisar antes de escrever (references/code-reuse-and-quality.md): o que esta feature aproveita do código existente
     antes de acrescentar alguma coisa. Uma linha por unidade, com o caminho. Reutilizar = um módulo, componente, helper
     ou serviço existente usado tal como está; Estender = uma unidade existente que esta feature altera (quem já a usa
     continua a funcionar); Novo = nada do que existe serve — o que foi pesquisado e a razão. Num projeto novo, basta
     uma linha que o diga. -->
| Tipo | O quê | Onde (caminho) | Porquê / notas |
|---|---|---|---|
| Reutilizar | [módulo, componente, helper ou serviço existente] | [o seu caminho] | [o que já faz por esta feature] |
| Estender | [unidade existente que esta feature altera] | [o seu caminho] | [a alteração — quem já a usa continua a funcionar] |
| Novo | [nova unidade] | [onde vai ficar] | [a razão de nada do que existe servir — o que foi pesquisado] |

**Fronteiras de módulos:** [onde fica o código novo, o que expõe e o que pode importar — as features dependem do código partilhado, nunca o inverso]

## Alternativas e Compromissos
<!-- As opções ponderadas para cada decisão-chave — p.ex. consistência forte vs eventual, monólito vs serviço, síncrono
     vs assíncrono, bloqueio otimista vs pessimista. Pelo menos duas por decisão (uma opção sozinha nunca foi
     ponderada), o que custaria escolher mal, a escolhida e porquê. Uma linha por opção. -->
| Decisão | Opção | Prós | Contras | Custo se errada | Escolhida |
|---|---|---|---|---|---|
| [decisão-chave] | [opção A] | [prós] | [contras] | [custo de errar] | [✓ — porquê] |
| [decisão-chave] | [opção B] | [prós] | [contras] | [custo de errar] | [✗ — motivo da rejeição] |

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

## Riscos
<!-- O que pode tornar este design errado ou atrasar a entrega — técnico, entrega, dados, negócio. Uma linha por risco;
     um honesto "nenhum risco relevante, porque X" serve — em branco não. -->
| Risco | Probabilidade | Impacto | Mitigação | Responsável |
|---|---|---|---|---|
| [o que pode falhar] | [baixa / média / alta] | [baixo / médio / alto] | [como o evitamos ou detetamos] | [quem o acompanha] |

## Verificação da Constituição
Verifica este design contra cada princípio em \`steering/constitution.md\`. GATE: tem de passar antes
da implementação; volta a verificar após qualquer alteração de design.
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

    // 1.21 F5 — o design de uma feature COM TAMANHO (o EN é a referência: as mesmas secções e slots).
    sizedDesign(a, extra) {
      const s = a.size === "s";
      const out = [`# Design: ${a.name}`, "", "## Visão Geral", "[Como isto se integra com o sistema existente. Decisões-chave e fundamentação.]", "",
        "## Arquitetura", "```mermaid", "graph TD", "    A[Componente] -->|ação| B[Componente]", "    B -->|query| C[(Base de Dados)]", "```", ""];
      if (s) {
        out.push("## Decisões, reutilização e riscos",
          "<!-- Uma resposta curta a cada. O que isto reutiliza (com o caminho) — ou \"nada a reutilizar\"; a opção escolhida, a",
          "     rejeitada e porquê — ou \"nenhuma alternativa a ponderar\"; o que pode falhar e como se deteta — ou \"nenhum",
          "     risco relevante, porque X\". Em branco não é resposta. -->",
          "- **Reutilização:** [módulo ou helper existente reutilizado, com o caminho — ou nada a reutilizar]",
          "- **Decisão:** [a opção escolhida, a rejeitada e porquê]",
          "- **Risco:** [o que pode falhar e como se deteta — ou nenhum risco relevante, porque …]", "");
      } else {
        out.push("## Reutilização e Integração",
          "<!-- Pesquisar antes de escrever (references/code-reuse-and-quality.md): o que esta feature aproveita do código existente",
          "     antes de acrescentar alguma coisa. Uma linha por unidade, com o caminho — Reutilizar (tal como está), Estender (alterada;",
          "     quem já a usa continua a funcionar) ou Novo (nada do que existe serve — o que foi pesquisado). Num projeto novo, basta uma linha que o diga. -->",
          "| Tipo | O quê | Onde (caminho) | Porquê / notas |", "|---|---|---|---|",
          "| [Reutilizar / Estender / Novo] | [a unidade] | [o seu caminho] | [porquê — num Novo: o que foi pesquisado] |", "",
          "**Fronteiras de módulos:** [onde fica o código novo, o que expõe e o que pode importar — as features dependem do código partilhado, nunca o inverso]", "",
          "## Alternativas e Compromissos",
          "<!-- As opções ponderadas para cada decisão-chave — p.ex. consistência forte vs eventual, monólito vs serviço, síncrono",
          "     vs assíncrono, bloqueio otimista vs pessimista. Pelo menos duas por decisão (uma opção sozinha nunca foi",
          "     ponderada), o que custaria escolher mal, a escolhida e porquê. Uma linha por opção. -->",
          "| Decisão | Opção | Prós | Contras | Custo se errada | Escolhida |", "|---|---|---|---|---|---|",
          "| [decisão-chave] | [opção A] | [prós] | [contras] | [custo de errar] | [✓ — porquê] |",
          "| [decisão-chave] | [opção B] | [prós] | [contras] | [custo de errar] | [✗ — motivo da rejeição] |", "",
          "## Modelos de Dados", "```typescript", "interface Entity {", "  id: string;", "  // campos com comentários a explicar o propósito", "}", "```", "");
        if (!coreSuperseded(a, "apiContracts")) out.push("## Contratos de API", "### POST /api/resource", "- **Request:** `{ field: type }`", "- **Response (200):** `{ field: type }`",
          "- **Errors:** 400 (validação), 401 (auth), 404 (não encontrado)", "");
        if (!coreSuperseded(a, "securityConsiderations")) out.push("## Considerações de Segurança", "[Auth, validação, riscos de exposição de dados]", "");
      }
      if (!coreSuperseded(a, "errorHandling")) out.push("## Tratamento de Erros",
        "Cada critério SE…ENTÃO em requirements.md já nomeia uma falha e a sua recuperação — acrescenta aqui só o que é comum a vários (tentativas, alternativas, as mensagens que o utilizador vê), ou nada mais.", "");
      if (!s && !coreSuperseded(a, "testingStrategy")) out.push("## Estratégia de Testes", "- Unit / Integração / E2E: [o que cada um cobre]", "");
      if (!s) out.push("## Riscos",
        "<!-- O que pode tornar este design errado ou atrasar a entrega — técnico, entrega, dados, negócio. Uma linha por risco;",
        "     um honesto \"nenhum risco relevante, porque X\" serve — em branco não. -->",
        "| Risco | Probabilidade | Impacto | Mitigação | Responsável |", "|---|---|---|---|---|",
        "| [o que pode falhar] | [baixa / média / alta] | [baixo / médio / alto] | [como o evitamos ou detetamos] | [quem o acompanha] |", "");
      out.push("## Verificação da Constituição", "Verifica este design contra cada princípio em `steering/constitution.md`. GATE: tem de passar antes",
        "da implementação; volta a verificar após qualquer alteração de design.", "- [ ] [Princípio 1] — cumpre", "- [ ] [Princípio 2] — cumpre",
        "(Se um princípio não puder ser cumprido, NÃO o quebres em silêncio — regista-o em Rastreio de Complexidade abaixo.)", "",
        "## Rastreio de Complexidade", "Justifica tudo o que viole um princípio da constituição ou acrescente complexidade não-óbvia. Vazio é bom.",
        "| O quê | Porque é preciso | Alternativa mais simples rejeitada porque |", "|---|---|---|");
      return out.join("\n") + "\n" + extra + `
<!-- Tracks ativos: ${a.label} · tamanho ${a.size}. As secções obrigatórias dos tracks acima têm de ter conteúdo real — um
     honesto "n/a — <porque não se aplica>" serve; em branco, ou só a linha de orientação do modelo, não. -->
`;
    },

    tasks(a) {
      const green = a.tracks.includes("tdd") ? templateTests(a.tracks) : null;
      const evalMarker = a.tracks.includes("ai") ? "\n  - _Affects evals: golden (maintain baseline)_" : "";
      const metricMarker = a.tracks.includes("saas") ? "\n  - _Emits metrics: req_duration_ms{feature=" + a.slug + "}_" : "";
      let n = 0;
      const id = () => ++n;
      // 1.21 F5 — tamanho S (o EN é a referência): uma tarefa core (os dois critérios de US-1) e os blocos dos tracks.
      if (a.size === "s") {
        const green1 = a.tracks.includes("tdd") ? templateTests(a.tracks, "s") : null;
        let body =
`## História US-1 (P1 — MVP)
- [ ] ${id()}. [US1] [Comportamento central para US-1]
  - _Requirements: US-1.AC-1, US-1.AC-2_${greenLine(green1, "US-1.AC-1", "US-1.AC-2")}${metricMarker}${evalMarker}
  - _Verify: [comando que o prova, ex.: npm test -- caminho/ficheiro.test.js]_
**Checkpoint:** US-1 está totalmente funcional e testável/lançável de forma independente.
`;
        for (const t of MARKER_TRACK_ORDER) {
          if (!a.tracks.includes(t)) continue;
          const block = BUILD.pt.trackTasks({ track: t, start: n + 1, green: green1 });
          body += block;
          n += (block.match(/^- \[ \] \d+\./gm) || []).length;
        }
        return (
`# Tasks: ${a.name}

<!-- Tracks: ${a.label} · tamanho s. Uma história; cada tarefa leva _Requirements:_ (as TDD _Makes green:_) e um
     _Verify: <comando>_ — o spec_complete_task regista o resultado como evidência da tarefa. Usa _Implements: caminho_
     para ligar uma tarefa a um ficheiro de código real. -->

## Restrições Globais
<!-- Valores exatos que todas as tarefas têm de respeitar, copiados literalmente da spec/steering — o spec_task_brief copia
     esta secção para cada brief de tarefa. -->
- [ex.: Node >= 20 · sem dependências de runtime novas · campos da API em snake_case]

${body}`
        );
      }
      let phases =
`## Fase: Setup
- [ ] ${id()}. [shared][P] [setup de projeto/dev se necessário — deps, scaffolding]

## Fase: Fundacional (bloqueia todas as histórias)
- [ ] ${id()}. [shared] [Modelos, schemas, índices partilhados entre histórias]
  - _Requirements: US-1.AC-1_${metricMarker}

## História US-1 (P1 — MVP)
- [ ] ${id()}. [US1] [Comportamento central para US-1]
  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3_${greenLine(green, "US-1.AC-1", "US-1.AC-2", "US-1.AC-3")}${evalMarker}
  - _Verify: [comando que o prova, ex.: npm test -- caminho/ficheiro.test.js]_
- [ ] ${id()}. [US1][P] [tarefa paralelizável — ficheiro diferente, sem deps]
  - _Requirements: US-1.AC-4_${greenLine(green, "US-1.AC-4")}
**Checkpoint:** US-1 está totalmente funcional e testável/lançável de forma independente.
`;
      for (const t of MARKER_TRACK_ORDER) {
        if (!a.tracks.includes(t)) continue;
        const block = BUILD.pt.trackTasks({ track: t, start: n + 1, green });
        phases += block;
        n += (block.match(/^- \[ \] \d+\./gm) || []).length;
      }
      phases +=
`
## História US-2 (P2)
- [ ] ${id()}. [US2] [Comportamento para US-2]
  - _Requirements: US-2.AC-1_${greenLine(green, "US-2.AC-1")}
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
     Se as histórias NÃO forem lançáveis de forma independente, foram mal fatiadas — volta a fatiá-las, ou
     recorre a um layout por camada técnica (Fundação→Lógica→API→…) mantendo as tags [US1]. -->

## Restrições Globais
<!-- Valores exatos que todas as tarefas têm de respeitar, copiados tal e qual da spec/steering (versões
     mínimas, regras de nomes, limites, formatos) — o spec_task_brief copia esta secção para cada brief.
     Dá a cada tarefa um _Verify: <comando>_: o spec_complete_task regista o resultado como evidência. -->
- [ex.: Node >= 20 · sem dependências de runtime novas · campos da API em snake_case]

${phases}`
      );
    },

    trackTasks(a) {
      let n = a.start - 1;
      const id = () => ++n;
      if (a.track === "saas") {
        return `
## História US-1 — Observabilidade e Escala
- [ ] ${id()}. [US1] Emitir métricas, adicionar dashboard, configurar alertas
  - _Requirements: US-1.AC-6_
- [ ] ${id()}. [US1] Teste de carga — verificar o orçamento de desempenho do design.md (só caminho crítico)
  - _Requirements: US-1.AC-6_${greenLine(a.green, "US-1.AC-6")}
- [ ] ${id()}. [US1] Garantir o isolamento de inquilino — todas as queries filtradas por tenant_id
  - _Requirements: US-1.AC-5_${greenLine(a.green, "US-1.AC-5")}
`;
      }
      if (a.track === "ai") {
        return `
## História US-1 — IA
- [ ] ${id()}. [US1] Prompt v1 + ligação ao harness de avaliação (tarefa separada por mudança de prompt)
  - _Requirements: US-1.AC-7, US-1.AC-8_
  - _Affects evals: golden, adversarial, regression_${greenLine(a.green, "US-1.AC-7", "US-1.AC-8")}
- [ ] ${id()}. [US1] Monitorização de custo — emitir métrica de custo + alerta
  - _Requirements: US-1.AC-9_${greenLine(a.green, "US-1.AC-9")}
`;
      }
      if (a.track === "sec") {
        return `
## História US-1 — Segurança
- [ ] ${id()}. [US1] Modelar as ameaças da feature (STRIDE por fronteira de confiança); registar cada mitigação no design.md
  - _Requirements: US-1.AC-10, US-1.AC-11, US-1.AC-12_
- [ ] ${id()}. [US1] Impor autenticação e autorização ao nível do objeto em todos os endpoints (negar por omissão)
  - _Requirements: US-1.AC-10, US-1.AC-11_${greenLine(a.green, "US-1.AC-10", "US-1.AC-11")}
- [ ] ${id()}. [US1] Manter os segredos fora do código, das respostas e dos logs — cofre de segredos + ocultação nos logs
  - _Requirements: US-1.AC-12_${greenLine(a.green, "US-1.AC-12")}
- [ ] ${id()}. [US1] Testes de segurança — SAST, auditoria de dependências e os testes de casos de abuso, executáveis localmente
  - _Requirements: US-1.AC-10, US-1.AC-11, US-1.AC-12_
`;
      }
      if (a.track === "privacy") {
        return `
## História US-1 — Privacidade
- [ ] ${id()}. [US1] Inventário de dados pessoais + fundamento de licitude por finalidade no design.md; atualizar a política de privacidade
  - _Requirements: US-1.AC-13, US-1.AC-14, US-1.AC-15_
- [ ] ${id()}. [US1] Pedidos dos titulares — acesso/exportação e apagamento de ponta a ponta, em todos os repositórios e subcontratantes
  - _Requirements: US-1.AC-13, US-1.AC-14_${greenLine(a.green, "US-1.AC-13", "US-1.AC-14")}
- [ ] ${id()}. [US1] Conservação — eliminação/anonimização agendada dos registos com o prazo de conservação expirado
  - _Requirements: US-1.AC-15_${greenLine(a.green, "US-1.AC-15")}
`;
      }
      if (a.track === "dist") {
        return `
## História US-1 — Consistência de Dados
- [ ] ${id()}. [US1] Outbox transacional — escrever a linha do outbox na mesma transação que a alteração de estado; um relay (polling ou CDC) publica-a e marca-a como enviada
  - _Requirements: US-1.AC-16_${greenLine(a.green, "US-1.AC-16")}
- [ ] ${id()}. [US1] Consumidor idempotente — uma tabela inbox / de mensagens processadas com a chave no ID da mensagem, escrita na mesma transação que o efeito
  - _Requirements: US-1.AC-17_${greenLine(a.green, "US-1.AC-17")}
- [ ] ${id()}. [US1] Controlo de concorrência — uma coluna de versão (bloqueio otimista) ou uma restrição de unicidade; um conflito é um erro, nunca uma sobreposição silenciosa
  - _Requirements: US-1.AC-18_${greenLine(a.green, "US-1.AC-18")}
- [ ] ${id()}. [US1] Resiliência — tempos limite, novas tentativas com recuo exponencial + jitter (nunca uma chamada não idempotente sem chave), uma DLQ, o caminho degradado quando uma dependência está indisponível
  - _Requirements: US-1.AC-19_${greenLine(a.green, "US-1.AC-19")}
- [ ] ${id()}. [US1] Testes de injeção de falhas — falha entre o commit e a publicação, entrega duplicada, atualizações concorrentes, uma dependência indisponível — executáveis localmente
  - _Requirements: US-1.AC-16, US-1.AC-17, US-1.AC-18, US-1.AC-19_
`;
      }
      if (a.track === "api") {
        return `
## História US-1 — Contrato da API
- [ ] ${id()}. [US1] Contrato primeiro — o documento OpenAPI / os ficheiros .proto / o esquema GraphQL no repositório, revisto antes dos handlers (o ficheiro é o marcador Implements desta tarefa)
  - _Requirements: US-1.AC-20, US-1.AC-21, US-1.AC-22, US-1.AC-23_
- [ ] ${id()}. [US1] Modelo de erros — cada erro um corpo application/problem+json com um código estável; um erro de validação indica cada campo
  - _Requirements: US-1.AC-20_${greenLine(a.green, "US-1.AC-20")}
- [ ] ${id()}. [US1] Idempotência e concorrência — uma Idempotency-Key nas criações (a resposta guardada é devolvida de novo), ETag / If-Match nas atualizações (412 numa versão desatualizada)
  - _Requirements: US-1.AC-21, US-1.AC-22_${greenLine(a.green, "US-1.AC-21", "US-1.AC-22")}
- [ ] ${id()}. [US1] Barreira de compatibilidade — uma comparação do contrato com a versão publicada que deteta alterações incompatíveis, executável localmente; o que for removido é descontinuado com uma data de Sunset
  - _Requirements: US-1.AC-23_${greenLine(a.green, "US-1.AC-23")}
- [ ] ${id()}. [US1] Testes de contrato — a implementação verificada contra o contrato (cada código de estado, esquema e cabeçalho documentado), executáveis localmente
  - _Requirements: US-1.AC-20, US-1.AC-21, US-1.AC-22, US-1.AC-23_
`;
      }
      if (a.track === "ui") {
        return `
## História US-1 — Interface do Utilizador
- [ ] ${id()}. [US1] Construir a vista com componentes e tokens do design system — um componente novo só através do sistema (documentado, revisto)
  - _Requirements: US-1.AC-24, US-1.AC-25, US-1.AC-26, US-1.AC-27_
- [ ] ${id()}. [US1] Estados da interface — a carregar, vazio, erro com Tentar de novo, parcial, offline, sem permissão, sucesso — segundo a matriz de estados do design.md
  - _Requirements: US-1.AC-26, US-1.AC-27_${greenLine(a.green, "US-1.AC-26", "US-1.AC-27")}
- [ ] ${id()}. [US1] Formulários e teclado — valores mantidos num erro, erros em texto com um resumo, ordem de foco lógica, foco visível
  - _Requirements: US-1.AC-24, US-1.AC-25_${greenLine(a.green, "US-1.AC-24", "US-1.AC-25")}
- [ ] ${id()}. [US1] Verificações de acessibilidade — uma verificação automática (axe ou equivalente) executável localmente + uma passagem manual com teclado e leitor de ecrã (as conclusões no relatório)
  - _Requirements: US-1.AC-24, US-1.AC-25_
- [ ] ${id()}. [US1] Design responsivo, i18n e o orçamento de desempenho — os breakpoints, a expansão do texto, RTL, os formatos do locale; LCP / INP / CLS dentro do orçamento
  - _Requirements: US-1.AC-24, US-1.AC-26, US-1.AC-27_
`;
      }
      if (a.track === "obs") {
        return `
## História US-1 — Operabilidade
- [ ] ${id()}. [US1] SLIs, SLOs e alertas por taxa de consumo — definidos em código / configuração junto ao serviço, cada alerta ligado ao seu runbook
  - _Requirements: US-1.AC-29_${greenLine(a.green, "US-1.AC-29")}
- [ ] ${id()}. [US1] Telemetria — as métricas, os logs estruturados com o ID de correlação (sem dados pessoais) e os spans de trace que o design indica
  - _Requirements: US-1.AC-28_${greenLine(a.green, "US-1.AC-28")}
  - _Emits metrics: requests_total, request_duration_seconds, errors_total_
- [ ] ${id()}. [US1] Rollout — uma feature flag e um canário / rollout progressivo decidido pelas métricas do SLO; reversão automática segundo os critérios do design.md
  - _Requirements: US-1.AC-30_${greenLine(a.green, "US-1.AC-30")}
- [ ] ${id()}. [US1] Verificações de saúde — endpoints de vida e de prontidão (uma dependência indisponível → não pronto, ainda vivo); sinais de capacidade com limiares
  - _Requirements: US-1.AC-31_${greenLine(a.green, "US-1.AC-31")}
- [ ] ${id()}. [US1] Testes de operabilidade — injeção de falhas (uma dependência indisponível, uma dependência lenta), um alerta que dispara numa falha encenada, um ensaio de reversão — executáveis localmente ou em staging
  - _Requirements: US-1.AC-28, US-1.AC-29, US-1.AC-30, US-1.AC-31_
`;
      }
      if (a.track === "data") {
        return `
## História US-1 — Pipeline de Dados
- [ ] ${id()}. [US1] Contrato de dados primeiro — o esquema de cada conjunto de dados (colunas, tipos, nulidade, chaves), o responsável e a regra de compatibilidade no repositório, revistos antes das transformações
  - _Requirements: US-1.AC-35_${greenLine(a.green, "US-1.AC-35")}
- [ ] ${id()}. [US1] Verificações de qualidade de dados — não nulos, únicos, intervalos admitidos, contagens de linhas e atualidade na ingestão e antes de publicar; uma linha que falha fica em quarentena com a sua regra, nunca é carregada
  - _Requirements: US-1.AC-32, US-1.AC-34_${greenLine(a.green, "US-1.AC-32", "US-1.AC-34")}
- [ ] ${id()}. [US1] Cargas idempotentes — cada execução substitui a sua partição (sobrescrever ou MERGE numa chave, nunca um append às cegas); linhas atrasadas integradas dentro da janela de lookback
  - _Requirements: US-1.AC-33_${greenLine(a.green, "US-1.AC-33")}
- [ ] ${id()}. [US1] Backfill — o procedimento para um intervalo de datas (paralelismo, custo, uma execução de ensaio), ensaiado numa partição e comparado com uma execução única
  - _Requirements: US-1.AC-33_
- [ ] ${id()}. [US1] Linhagem, responsáveis e retenção — origens → transformações → consumidores documentados, um responsável por conjunto de dados, a retenção e o particionamento do design.md aplicados
  - _Requirements: US-1.AC-32, US-1.AC-33, US-1.AC-34, US-1.AC-35_
`;
      }
      return "";
    },

    bugReport(a) {
      return `# Bug: ${a.name}

<!-- Fluxo de bugfix (depuração sistemática): reproduzir → encontrar a CAUSA RAIZ com evidência → escrever o
     teste de regressão a falhar → corrigir a causa, não o sintoma → verificar. O spec_doctor falha enquanto
     a "Causa Raiz" não estiver preenchida: nenhuma correção antes de se conhecer a causa. -->

## Resumo
${a.summary || "[uma linha: o que está partido, para quem, desde quando]"}

## Reprodução
${a.reproduction || "> **TODO** — passos, input e ambiente exatos que o reproduzem sempre."}

## Esperado vs Atual
- **Esperado:** ${a.behaviour || "[comportamento correto]"}
- **Atual:** [o que acontece — mensagem de erro, output, linhas de log]

## Causa Raiz
${a.rootCause || "> **TODO** — a causa, com evidência (stack trace, log, asserção a falhar, a alteração que a introduziu). Não \"provavelmente\"."}

## Correção
[O que muda e porque é que elimina a causa raiz — uma correção, não um pacote.]

## Teste de Regressão
- **T-01** — reproduz o bug: falha antes da correção e passa depois.
`;
    },

    bugRequirements(a) {
      return `# Bugfix: ${a.name}

## Resumo
${a.summary || "[uma linha: o bug a corrigir]"}

## Histórias de Utilizador

### US-1 (P1 — correção): ${a.name}
**Teste Independente:** o teste de regressão T-01 reproduz o bug antes da correção e passa depois.

#### Critérios de Aceitação (EARS)
1. **US-1.AC-1** — SE ${a.condition || "[a condição que provoca o bug]"} ENTÃO O SISTEMA DEVE ${a.behaviour || "[o comportamento correto]"}
2. **US-1.AC-2** — O SISTEMA DEVE manter [o comportamento vizinho que já funcionava] inalterado

## Critérios de Sucesso
- **SC-001** — os passos de reprodução do bug.md deixam de reproduzir o bug.

## Casos Limite e Tratamento de Erros
- **EC-1** — [inputs próximos que têm de continuar a funcionar]

## Fora de Âmbito
- Refatorações não relacionadas — regista-as como trabalho à parte.
`;
    },

    bugTestPlan(name) {
      return `# Test Plan: ${name}

<!-- Tipo: example (uma entrada concreta → resultado esperado) ou property (uma invariante sobre entradas geradas — p. ex.
     "toda a entrada fora da condição do bug comporta-se como antes" protege bem o US-1.AC-2). Os valores ficam example / property.
     Põe o Test ID no nome do teste (test("T-01 …"), def test_T01_…) para o trace_check {code: true} o encontrar. -->

| Test ID | Camada | Tipo | Descrição | Cobre (AC IDs) | Ficheiro |
|---------|--------|------|-----------|----------------|----------|
| T-01 | [unit/integração] | example | regressão — reproduz o bug (vermelho antes da correção) | US-1.AC-1, SC-001 | \`[caminho]\` |
| T-02 | [unit/integração] | example | o comportamento vizinho continua a funcionar | US-1.AC-2 | \`[caminho]\` |
`;
    },

    bugTasks(name) {
      // Todo o bugfix, de qualquer tamanho (o EN é a referência): duas tarefas — o teste de regressão vermelho e a correção;
      // sem as tarefas "reproduzir" / "causa raiz" — os gates dos requisitos e do design já as exigem.
      return `# Tasks: ${name}

<!-- A ordem de um bugfix é fixa: reproduzir → causa raiz → teste de regressão a falhar → corrigir → verificar.
     bug.md → Reprodução e Causa Raiz são escritas e aprovadas primeiro (os gates dos requisitos e do design): nenhuma
     correção antes de a Causa Raiz estar preenchida com evidência.
     A tarefa 1 é vermelha por natureza (o teste tem de FALHAR): o _Verify:_ dela executa o T-01 e, com o _Expect: fail_,
     essa execução a falhar é a prova (uma que passe é recusada). A suite que tem de passar vai na tarefa da correção (2).
     O T-02 protege comportamento que já funciona — verde antes e depois da correção, por isso não entra no _Makes green:_
     de nenhuma tarefa. -->

## Restrições Globais
- [valores exatos que a correção tem de respeitar — versões, limites, formatos]

## Fase: Correção
- [ ] 1. [US1] Escrever o teste de regressão T-01 e vê-lo falhar pela razão certa (colar o output); acrescentar o teste de proteção T-02 (já passa)
  - _Requirements: US-1.AC-1_
  - _Verify: [comando que executa o T-01]_
  - _Expect: fail_
- [ ] 2. [US1] Corrigir a causa raiz — uma alteração, não um pacote; o teste de proteção T-02 continua verde
  - _Requirements: US-1.AC-1, US-1.AC-2_
  - _Makes green: T-01_
  - _Verify: [comando da suite de testes completa]_
**Checkpoint:** o bug deixa de se reproduzir e a suite completa está verde.
`;
    },

    testPlan(name, tracks, acs, size) {
      const rows = templateTestRows(tracks, (t, layer, kind, desc, ac, file) => `| ${t} | ${layer} | ${kind} | ${desc} | ${ac} | \`${file}\` |`,
        { integration: "integração", load: "carga", behavior: "[comportamento]", acSlot: "[os IDs de AC que este teste cobre]", recovery: "[condição de erro → recuperação]", property: "[propriedade sempre verdadeira]",
          tenant: "o inquilino A nunca lê registos do inquilino B", latency: "latência P95 dentro do orçamento de desempenho",
          golden: "conjunto golden ≥ limiar de qualidade", injection: "adversarial: instruções injetadas são ignoradas", cost: "custo por pedido dentro do orçamento",
          unauthenticated: "caso de abuso: um pedido não autenticado recebe 401 e nenhum dado", forbidden: "caso de abuso: o utilizador B nunca lê o recurso do utilizador A (403 + evento de auditoria)",
          noSecrets: "nenhum segredo, token ou stack trace em respostas ou logs", exportData: "a exportação de um titular contém todos os seus dados pessoais, em formato de leitura automática",
          erasure: "após o apagamento nenhum repositório guarda os dados pessoais do titular", retention: "os registos com o prazo de conservação expirado são apagados ou anonimizados",
          outboxCrash: "falha entre o commit na BD e a publicação: o evento é entregue mesmo assim", duplicateDelivery: "a mesma mensagem entregue duas (ou N) vezes tem exatamente um efeito",
          lostUpdate: "atualizações concorrentes do mesmo registo: nenhuma se perde em silêncio", dependencyDown: "uma dependência indisponível: degradar / repetir com recuo, o caminho crítico não fica bloqueado",
          contract: "contrato", problemJson: "teste de contrato: um pedido sem um campo obrigatório recebe 400 problem+json que o indica", idempotencyReplay: "uma criação repetida com a mesma Idempotency-Key tem um só efeito e devolve a primeira resposta", staleEtag: "uma atualização com um If-Match desatualizado recebe 412 e não altera nada", breakingDiff: "comparação de alterações incompatíveis: o contrato face à versão publicada não reporta nenhuma",
          component: "componente", visual: "visual", keyboardA11y: "percurso só com teclado + uma verificação automática de acessibilidade (axe): cada ação alcançável, foco visível, nenhuma violação", formErrors: "formulário com campos inválidos: os valores mantidos, cada erro nomeado em texto, o foco no resumo", emptyState: "regressão visual dos estados da vista: o estado vazio explica porquê e oferece a próxima ação", loadError: "carregamento falhado: um erro com Tentar de novo, o conteúdo já mostrado mantido",
          telemetry: "cada pedido emite a métrica, uma linha de log estruturada e um trace com um só ID de correlação; nenhum dado pessoal no log", burnAlert: "falha encenada que consome o orçamento de erro: o alerta por taxa de consumo dispara e chama com a ligação ao runbook", rollbackDrill: "ensaio de reversão: um canário com a taxa de erro acima do limiar para o rollout e reverte", readiness: "injeção de falhas: uma dependência indisponível → a prontidão falha, a vida passa, recuperação sem reinício",
          dataQuality: "verificações de qualidade de dados sobre lotes de teste: uma chave nula, um duplicado e uma linha fora do intervalo ficam em quarentena com a sua regra, as linhas válidas são carregadas",
          idempotentRerun: "uma partição reexecutada ou com backfill duas vezes fica com as mesmas linhas que uma execução — sem duplicados, sem lacunas",
          freshness: "uma partição mais antiga do que o SLA de atualidade: a verificação de atualidade falha e alerta o responsável",
          schemaChange: "compatibilidade de alterações de esquema: uma coluna opcional nova passa, uma coluna removida / renomeada ou um tipo mais restrito é rejeitado antes da carga" }, acs, size);
      return (
`# Test Plan: ${name}

## Estratégia
- **Test runner:** []
- **Abordagem de mocking:** []
- **Alvo de cobertura:** []
- **Caminhos críticos que exigem 100% de cobertura de ramos:** []

## Matriz de Rastreabilidade

<!-- Tipo — example: uma entrada concreta → resultado esperado; o padrão para critérios por evento (QUANDO …, SE … ENTÃO).
     property: uma invariante verificada sobre muitas entradas geradas (fast-check, Hypothesis, jqwik, gopter, FsCheck); usa-o
     em critérios ubíquos (O SISTEMA DEVE sempre …), critérios ENQUANTO (por estado) e em qualquer regra "nunca / para todo" —
     isolamento de inquilinos, um round-trip codificar → descodificar, totais que batem sempre certo. Os valores ficam example / property.
     Põe o Test ID no nome do teste (test("T-01 …"), def test_T01_…) para o trace_check {code: true} o encontrar. -->

| Test ID | Camada | Tipo | Descrição | Cobre (AC IDs) | Ficheiro |
|---------|--------|------|-----------|----------------|----------|
${rows}

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

    // 1.21 F5 — uma alteração (kind "change", tamanho xs): UM ficheiro com todo o plano (o EN é a referência).
    change(a) {
      return `# Alteração: ${a.name}

## Resumo
${a.summary || "[uma linha: o que muda e porquê]"}

## Critérios de Aceitação (EARS)
1. **US-1.AC-1** — QUANDO [gatilho] O SISTEMA DEVE [comportamento]

## Abordagem
[a alteração numa ou duas linhas — o que toca e porque é só isso]

## Tarefas
- [ ] 1. [US1] [a alteração]
  - _Requirements: US-1.AC-1_
  - _Verify: [comando que o prova, ex.: npm test -- caminho/ficheiro.test.js]_

<!-- Uma alteração (tamanho xs): 1–3 critérios de aceitação e 1–3 tarefas, só core — sem classificação, design, quickstart
     nem checklist. Duas aprovações: o plano (este ficheiro — spec_approve {through: "tasks"}) e o fecho da execução. Mais
     critérios ou tarefas, ou um track (+tdd, +sec …), fazem dela uma feature de tamanho s: spec_create {size: "s"}. -->
`;
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
2. **Esperado:** [tratamento controlado]

## Concluído quando
- [ ] O caminho feliz produz o resultado esperado.
- [ ] O caminho negativo é tratado de forma controlada.
- [ ] Os Critérios de Sucesso (SC-…) são observavelmente cumpridos.
`
      );
    },

    checklist(a) {
      // 1.21 F5 (o EN é a referência): as contagens de uma feature com tamanho (a.sectionCounts) e, com +obs, a linha +saas sem a
      // telemetria que o +obs já verifica. Sem tamanho: as contagens e as linhas de sempre.
      const cnt = (t, n) => (a.sectionCounts && a.sectionCounts[t] != null ? a.sectionCounts[t] : n);
      const items = [
        "Requisitos: cada AC é testável, tem ID estável, sem termos vagos (corre `ears`).",
        "Design: respeita a constituição do projeto (nenhum princípio violado).",
        "Design: pelo menos um diagrama Mermaid; segurança + tratamento de erros cobertos.",
        "Rastreabilidade: cada AC mapeia para uma tarefa (corre `trace`).",
      ];
      if (a.tracks.includes("tdd")) items.push("TDD: todos os testes planeados escritos e a vermelho pela razão certa antes do código.", "TDD: commits de teste entram antes dos commits de implementação.");
      if (a.tracks.includes("saas")) items.push("SaaS: " + cnt("saas", 5) + " secções obrigatórias de design preenchidas (sem TODO).", "SaaS: isolamento de inquilino garantido (`WHERE tenant_id = ?`).", a.size && a.tracks.includes("obs") ? "SaaS: teste de carga cumpre o orçamento (caminho crítico)." : "SaaS: métricas/logs/alertas emitidos; teste de carga cumpre o orçamento (caminho crítico).");
      if (a.tracks.includes("ai")) items.push("IA: " + cnt("ai", 10) + " secções obrigatórias de design preenchidas (sem TODO).", "IA: golden ≥ limiar, segurança adversarial 100%, regressão mantida.", "IA: prompts versionados em prompts/vN.md; custo dentro do orçamento.");
      if (a.tracks.includes("sec")) items.push("SEC: " + cnt("sec", 5) + " secções obrigatórias de design preenchidas (sem TODO) — modelo de ameaças revisto.", "SEC: autenticação + autorização ao nível do objeto impostas, negar por omissão; nenhum segredo no código ou nos logs.", "SEC: SAST, auditoria de dependências e testes de casos de abuso limpos numa execução local.");
      if (a.tracks.includes("privacy")) items.push("PRIVACIDADE: " + cnt("privacy", 6) + " secções obrigatórias de design preenchidas (sem TODO) — decisão sobre a AIPD registada.", "PRIVACIDADE: acesso/exportação e apagamento funcionam de ponta a ponta, em todos os repositórios e subcontratantes.", "PRIVACIDADE: processo de conservação agendado; política de privacidade e registo das atividades de tratamento atualizados.");
      if (a.tracks.includes("dist")) items.push("DIST: " + cnt("dist", 5) + " secções obrigatórias de design preenchidas (sem TODO) — cada escrita entre sistemas tem a sua mitigação (outbox / inbox / saga) ou um risco assumido.", "DIST: consumidores idempotentes (inbox ou uma chave única na transação do efeito); novas tentativas com recuo + jitter e uma DLQ; nada não idempotente repetido às cegas.", "DIST: testes de injeção de falhas (falha entre o commit e a publicação, entrega duplicada, atualizações concorrentes, dependência indisponível) a verde numa execução local.");
      if (a.tracks.includes("api")) items.push("API: " + cnt("api", 5) + " secções obrigatórias de design preenchidas (sem TODO) — o ficheiro do contrato (OpenAPI / .proto / esquema GraphQL) está no repositório e é indicado pelo marcador Implements de uma tarefa.", "API: erros em problem+json com códigos estáveis; as criações aceitam uma Idempotency-Key; as atualizações respeitam If-Match; os endpoints de listagem paginam com um cursor estável.", "API: testes de contrato e a comparação de alterações incompatíveis com a versão publicada a verde numa execução local; o que for removido é descontinuado com uma data de Sunset.");
      if (a.tracks.includes("ui")) items.push("UI: " + cnt("ui", 5) + " secções obrigatórias de design preenchidas (sem TODO) — cada estado da matriz de estados desenhado; componentes novos entram pelo design system.", "UI: WCAG 2.2 AA — a verificação automática de acessibilidade limpa numa execução local, mais uma passagem manual com teclado e leitor de ecrã com as conclusões corrigidas.", "UI: responsivo em cada breakpoint, strings no catálogo (expansão do texto, RTL verificados); LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 medidos.");
      if (a.tracks.includes("obs")) items.push("OBS: " + cnt("obs", 5) + " secções obrigatórias de design preenchidas (sem TODO) — cada SLO tem um orçamento de erro, cada alerta um runbook, os critérios de reversão são números.", "OBS: as métricas, os logs estruturados (ID de correlação, sem dados pessoais) e os traces que o design indica são emitidos — vistos, não presumidos.", "OBS: um alerta disparou numa falha encenada, um ensaio de reversão feito e as verificações de saúde confirmadas com uma dependência indisponível.");
      if (a.tracks.includes("data")) items.push("DATA: " + cnt("data", 5) + " secções obrigatórias de design preenchidas (sem TODO) — cada conjunto de dados tem um esquema, um responsável e uma regra de compatibilidade; cada verificação diz o que faz uma falha.", "DATA: as verificações de qualidade de dados são executadas na ingestão e antes de publicar — uma linha errada fica em quarentena, nunca é carregada; o alerta de atualidade chega ao responsável.", "DATA: uma reexecução de partição e um backfill ensaiados com dados de tamanho real dão as mesmas linhas que uma execução; retenção e particionamento aplicados como desenhado.");
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
  };

// ===========================================================================
// Steering stubs, one set per language. Filenames stay constant; content localized.
// ===========================================================================
const steering = {
    "constitution.md":
      "# Constituição\n\nPrincípios inegociáveis que toda a feature deve cumprir. Mantém-nos poucos, concretos e testáveis.\nO `doctor` e o `/prReview` verificam contra eles; um design que viole um princípio é bloqueado.\n\n## Princípios\n1. [ex.: Toda a escrita é idempotente ou explicitamente justificada.]\n2. [ex.: Sem PII nos logs; os IDs de utilizador são pseudonimizados.]\n3. [ex.: Sem alteração de API com quebra sem um caminho de migração versionado.]\n4. [ex.: Os erros falham fechados (negar) no caminho de segurança.]\n5. [ex.: Pesquisar antes de escrever: estender um módulo existente antes de criar um novo.]\n\n## Restrições\n- [Restrições técnicas/regulatórias rígidas que limitam todos os designs.]\n\n## Regras de Decisão\n- [Como desempatar — ex.: 'preferir o aborrecido/comprovado ao engenhoso'.]\n",
    "product.md":
      "# Produto\n\n## Visão\n[Uma frase: o que é este produto e para quem é?]\n\n## Utilizadores-Alvo\n- Primário: [quem usa isto diariamente?]\n- Secundário: [quem mais lhe toca?]\n\n## Métricas de Sucesso\n- [métrica específica a 6 meses]\n\n## Não-objetivos\n- [o que isto explicitamente NÃO é]\n\n## Modelo de Negócio\n[como gera receita]\n",
    "tech.md":
      "# Tecnologia\n\n## Stack\n- Frontend: []\n- Backend: []\n- Base de Dados: []\n- Auth: []\n\n## Infraestrutura\n- Hosting / Região / CDN: []\n\n## Convenções\n- Linguagem / formatação / test runner / migrações / formato de commit: []\n\n## Restrições\n- Versão de runtime / suporte de browser / acessibilidade / regulatório: []\n",
    "structure.md":
      "# Estrutura do Projeto\n\n## Layout\n[árvore de diretórios]\n\n## Fronteiras de Módulos\n- O que cada módulo expõe e o que pode importar: [ex.: cada feature expõe um único ponto de entrada; features/* importam lib/*, nunca umas das outras; lib/* não importa nenhuma feature; sem ciclos]\n\n## Código Partilhado\n- Onde ficam os helpers e componentes partilhados: [ex.: src/lib/ para helpers e clientes, src/components/ para a UI] — procurar aí antes de acrescentar um; o código entra lá ao segundo ou terceiro uso real.\n\n## Nomenclatura\n- Ficheiros / componentes / rotas de API / tabelas de BD / métricas: []\n\n## Commits\nConventional commits: `type(scope): description`. Tipos: feat|fix|refactor|test|docs|chore|style|perf\n\n## Branches e Revisões\n- main + feature/<nome>; revisões obrigatórias para merges para main.\n",
    "testing-standards.md":
      "# Padrões de Teste\n\n## Runner e Ferramentas\n- Unit/Integração: []\n- E2E: []\n- Mocking: []\n\n## Política de Cobertura\n- Alvo por defeito: []\n- Caminhos críticos (auth/faturação/dados): 100% de ramos.\n\n## Disciplina TDD\n- Sem implementação antes de um teste a falhar que exercite o caminho real.\n- 'Falhar pela razão certa' = assertion/NotImplemented, não erro de import/sintaxe.\n",
    "scale.md":
      "# Alvos de Escala\n\n## Alvos de Carga\n| Horizonte | Simultâneos | DAU | MAU | Pico RPS | Dados |\n|---|---|---|---|---|---|\n| Lançamento | | | | | |\n| 6 meses | | | | | |\n| 2 anos | | | | | |\n\n## Alvos de SLA\n| Classe de endpoint | P95 | P99 | Disponibilidade |\n|---|---|---|---|\n| Jornada crítica | | | |\n\n## Jornadas Críticas de Utilizador\n1. []\n\n## Limiares de Escalonamento\n- []\n",
    "observability.md":
      "# Padrões de Observabilidade\n\n## Logging\nJSON estruturado. Campos obrigatórios: ts, level, service, trace_id, span_id, tenant_id?, user_id?, msg, event. Sem secrets/PII.\n\n## Métricas\nEstilo Prometheus snake_case + sufixo de unidade. Por feature: contagem de pedidos, histograma de duração, contagem de erros, um contador de negócio. Cuidado com a cardinalidade de labels.\n\n## Traces\nOpenTelemetry, contexto W3C. Amostra 10% em prod, amostra sempre os erros.\n\n## Alertas (cada um liga a um runbook)\n- P0 alerta imediato (page) / P1 ≤15min / P2 slack / P3 digest.\n\n## SLOs e Orçamentos de Erro\n- Por percurso crítico: o SLI, a meta do SLO e a sua janela · a política do orçamento de erro (o que para quando se esgota).\n- Alertas por taxa de consumo: os rápidos chamam (ex.: 14,4× em 1 h, 6× em 6 h), o lento (ex.: 1× em 3 dias) abre um ticket.\n\n## Lançamento e Reversão\n- Feature flags: um dono e uma data de remoção cada · passos do canário / rollout progressivo e as métricas que os decidem · critérios e um tempo-alvo de reversão.\n\n## Saúde e Capacidade\n- A verificação de vida só verifica o processo, a de prontidão as dependências · sinais de capacidade (saturação, profundidade de filas, uso de pools) com limiares.\n",
    "cost.md":
      "# Orçamento de Custo\n\n## Orçamento de Infraestrutura\nAlvo: < $XX/mês no ano 1.\n\n## Alvo de Custo Por Utilizador\nAlvo: < $0,50 por MAU. Se for excedido, para e otimiza.\n\n## Alertas de Custo\n- Diário > $100 slack / > $200 alerta imediato (page).\n\n## Revisão de Custo Por Feature\nCada Envelope de Custo no design.md estima $/1000 utilizadores/mês e sinaliza caminhos críticos de custo.\n",
    "ai-strategy.md":
      "# Estratégia de IA\n\n## Lista de Modelos\n| Papel | Modelo (ID fixado) | Porquê |\n|---|---|---|\n| Primário | | |\n| Fallback | | |\n| Juiz/classificador | | |\n\n## Postura de Fornecedor e Dados\n- Fornecedor / estado do DPA / a PII chega ao modelo: []\n\n## Disciplina de Prompt\n- Prompts em .specs/<feature>/prompts/vN.md, versionados. Nenhuma mudança é lançada sem voltar a correr os evals.\n\n## Envelope de Custo\n- Alvo $/ação de utilizador / limite de alerta rígido: []\n\n## Postura de Segurança\n- Defesa contra injeção / moderação / política de recusa: []\n\n## Barra de Avaliação (critérios para lançar)\n- Golden ≥85% bom · Segurança adversarial 100% recusado · Regressão 100% mantida.\n\n## Ciclo de Vida\n- Política de fixação / vigilância de descontinuação / migração com gate de avaliação.\n",
    "security.md":
      "# Padrões de Segurança\n\n## Nível de Garantia\n- Nível OWASP ASVS alvo: [L1 | L2 | L3] — porquê: []\n\n## Modelação de Ameaças\n- Método: STRIDE por componente e fronteira de confiança, revisto a cada alteração de design.\n- Onde ficam os modelos de ameaças: no design.md de cada feature +sec → Modelo de Ameaças.\n\n## Autenticação e Autorização\n- Fornecedor de identidade / modelo de sessão: []\n- Modelo de autorização (RBAC / ABAC / verificação de titularidade), negar por omissão: []\n\n## Segredos e Criptografia\n- Cofre de segredos: [] — nunca no código, em configuração versionada, em logs ou em tickets.\n- Cifragem em repouso / em trânsito (versão de TLS, rotação de chaves): []\n\n## Regras de Código Seguro\n- Validar a entrada nas fronteiras de confiança; codificar a saída; só queries parametrizadas.\n- Nenhum segredo, token ou stack trace em respostas ou logs.\n\n## Testes de Segurança (locais)\n- SAST: [] · auditoria de dependências: [] · análise de segredos: [] · DAST (serviços expostos): []\n- Cada ameaça relevante tem um teste de caso de abuso.\n\n## Gestão de Vulnerabilidades\n- Prazos de correção por severidade (crítica / alta / média): [] · quem faz a triagem: []\n",
    "privacy.md":
      "# Padrões de Privacidade (RGPD)\n\n## Papéis\n- Responsável pelo tratamento: [] · EPD / contacto de privacidade: [] · autoridade de controlo: [ex.: CNPD]\n\n## Princípios (RGPD, art. 5.º)\n- Licitude, lealdade e transparência · limitação das finalidades · minimização dos dados · exatidão · limitação da conservação · integridade e confidencialidade · responsabilidade.\n\n## Registo das Atividades de Tratamento (art. 30.º)\n- Onde está o registo das atividades de tratamento: []\n\n## Fundamentos de Licitude em Uso (art. 6.º)\n- [atividade de tratamento → fundamento de licitude]\n\n## Prazos de Conservação\n| Categoria de dados | Prazo de conservação | Método de eliminação |\n|---|---|---|\n| | | |\n\n## Pedidos dos Titulares\n- Canal · verificação de identidade · prazo de um mês (art. 12.º, n.º 3) · responsável: []\n\n## Subcontratantes e Transferências\n- Subcontratantes aprovados (contratos do art. 28.º): [] · transferências para fora do EEE e a sua garantia: []\n\n## Proteção de Dados desde a Conceção (art. 25.º)\n- Por omissão: recolher o mínimo, pseudonimizar sempre que possível, sem dados pessoais nos logs.\n\n## Resposta a Violações de Dados\n- Notificar a autoridade de controlo no prazo de 72 horas (art. 33.º) · runbook: []\n",
    "distributed.md":
      "# Padrões de Sistemas Distribuídos e Consistência de Dados\n\n## Garantia de Entrega\n- Por omissão: pelo menos uma vez — todos os consumidores são idempotentes. \"Exatamente uma vez\" é um efeito da idempotência, nunca uma promessa do broker.\n- Ordem: por chave (partição / grupo de mensagens) só onde uma feature o pede: []\n\n## Escritas entre Sistemas\n- Uma escrita que toca mais de um sistema (BD + broker, BD + cache, BD + API externa) passa por um outbox transacional (ou CDC) — nunca \"commit e depois publicar\".\n- Transações de negócio entre serviços: uma saga com uma compensação por passo; orquestração ou coreografia: []\n\n## Idempotência\n- Origem da chave de idempotência (cabeçalho do cliente / ID da mensagem / chave natural): [] · onde ficam as chaves processadas (tabela inbox / restrição de unicidade) e durante quanto tempo: []\n\n## Política de Novas Tentativas (valores por omissão)\n- Recuo exponencial com jitter · máximo de tentativas: [] · tempo limite por chamada: []\n- Nunca repetir: uma chamada não idempotente sem chave, um erro de validação (um 4xx — mas 408 e 429 podem ser repetidos, respeitando o Retry-After) · mensagens venenosas → DLQ após [] tentativas, com alerta.\n\n## Política de Bloqueio\n- Por omissão: bloqueio otimista (uma coluna de versão); pessimista (SELECT … FOR UPDATE) só em secções curtas e muito disputadas · tempo limite de bloqueio: []\n\n## Consistência por Omissão\n- Nível de isolamento por omissão: [] · onde se aceita a consistência eventual e o atraso máximo: [] · ler as próprias escritas para o utilizador que escreveu.\n\n## Observabilidade\n- Atraso do outbox, atraso dos consumidores, profundidade da DLQ e número de novas tentativas são métricas com alertas: []\n",
    "api.md":
      "# Padrões de API\n\n## Estilo e Contrato\n- Estilo: [REST | GraphQL | gRPC] · o contrato está em: [openapi.yaml | proto/ | schema.graphql] — escrito primeiro, revisto antes dos handlers.\n- Nomes: substantivos no plural para coleções · campos em [snake_case | camelCase] · datas em ISO 8601 UTC · IDs como strings.\n\n## Versionamento e Compatibilidade\n- Estratégia: [URL /v1 | cabeçalho | data] · só alterações aditivas dentro de uma versão · uma alteração incompatível sai numa nova versão.\n- Descontinuação: os cabeçalhos Deprecation e Sunset, pelo menos [6 meses] de aviso, uma entrada no changelog, o uso acompanhado por cliente.\n\n## Erros\n- application/problem+json (RFC 9457): type, title, status, detail, instance + um `code` estável; um erro de validação lista cada campo. Nenhum stack trace numa resposta.\n\n## Paginação, Idempotência e Concorrência\n- Paginação por cursor (um cursor opaco, no máximo [100] itens por página) · uma Idempotency-Key em cada criação não idempotente, guardada durante [24 h] · ETag / If-Match nas atualizações (412 numa versão desatualizada).\n\n## Limites de Taxa\n- Por [chave de API | utilizador | IP]: [N] pedidos por [janela] · 429 com Retry-After e os cabeçalhos RateLimit.\n\n## Verificações (locais)\n- Testes de contrato: [comando] · comparação de alterações incompatíveis com o contrato publicado: [comando].\n",
    "ui.md":
      "# Padrões de Interface\n\n## Design System\n- Componentes: [biblioteca / URL do Storybook] · tokens: [cor, espaçamento, tipografia — onde estão] · um componente novo entra primeiro no sistema (documentado, revisto), nunca como peça avulsa.\n\n## Estados\n- Cada vista desenha: a carregar · vazio · erro (com Tentar de novo) · parcial · offline · sem permissão · sucesso.\n- Formulários: erros no campo + um resumo, os valores mantidos num erro, o botão de submeter nunca é o único sinal.\n\n## Acessibilidade\n- Alvo: WCAG 2.2 AA · operável com o teclado, foco visível · cada controlo com nome · contraste 4,5:1 (texto) / 3:1 (interface) · alvos ≥ 24×24 px · prefers-reduced-motion respeitado.\n- Verificações: [comando axe / Lighthouse] em cada execução local · uma passagem manual com teclado + leitor de ecrã ([NVDA / VoiceOver]) por feature.\n\n## Design Responsivo e i18n\n- Breakpoints: [360 / 768 / 1280 px] · expansão do texto +30–40 % · RTL: [sim / não] · datas, números e moeda pelo locale.\n\n## Orçamento de Desempenho\n- Core Web Vitals (p75): LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1 · JS por rota ≤ [170 KB gz] · medido por: [Lighthouse local / RUM].\n",
    // 1.21 F4 — +data
    "data.md":
      "# Padrões de Pipelines de Dados\n\n## Contratos e Esquemas\n- Onde estão os esquemas: [YAML do dbt | um registo de esquemas | schemas/] · compatibilidade: só alterações aditivas; uma alteração incompatível sai numa nova versão com [N semanas] de descontinuação.\n- Nomes: tabelas e colunas em [snake_case] · datas e horas em UTC · as camadas: [raw → staging → marts].\n\n## Qualidade dos Dados\n- Cada conjunto de dados: chaves não nulas e únicas, valores e intervalos admitidos, verificações de anomalias na contagem de linhas · executadas na ingestão e antes de publicar · uma falha: [pôr as linhas em quarentena | parar a carga] e alertar o responsável.\n- Ferramenta: [testes dbt | Great Expectations | verificações SQL] · comando: [comando].\n\n## Idempotência e Backfills\n- Cada job reexecutável para uma partição: sobrescrever a partição ou MERGE numa chave — nunca um append às cegas · dados que chegam atrasados: uma janela de lookback de [N dias].\n- Backfills: primeiro uma execução de ensaio · no máximo [N] partições em paralelo · o custo estimado e aprovado por [papel].\n\n## Linhagem e Responsáveis\n- Cada conjunto de dados tem um responsável e um SLA de atualidade · a linhagem está em: [dbt docs | o catálogo de dados] · os consumidores sabem de uma alteração incompatível com [N dias] de antecedência.\n\n## Retenção e Custo\n- Retenção por camada: bruta [N dias] · curada [N meses] — dados pessoais segundo o privacy.md · particionado por [data], agrupado por [chave] · orçamento de custo: [valor por mês], com um alerta a [N] %.\n",
    "glossary.md":
      "# Glossário\n\n<!-- A linguagem ubíqua do produto: uma entrada por termo do domínio — a palavra que as specs usam, o que significa aqui e\n     as palavras que NÃO se usam para ele. O spec_clarify pergunta por cada palavra a evitar encontrada no requirements.md /\n     design.md de uma feature, o spec_doctor avisa (verificação `glossary`) e o spec_task_brief cita as entradas que os\n     critérios de uma task usam. Uma entrada por linha (o marcador `_Avoid:_` fica em inglês), por exemplo:\n     - **Cliente** — uma pessoa ou empresa com contrato assinado. _Avoid: comprador, consumidor_ -->\n\n- **[Termo]** — [o que significa neste produto]. _Avoid: [palavra], [palavra]_\n",
  };

// The evals README is a single block per language (kept out of the per-language BUILD map
// because it carries no track logic).
const evalsReadme = "# Evals\n\n" +
    "Harness de avaliação local, funciona offline. Corre a partir da raiz do projeto:\n\n" +
    "```\nnode <plugin>/mcp/evals/run-evals.js <slug-da-feature>\n```\n\n" +
    "- Usa o teu próprio `ANTHROPIC_API_KEY` (env). Sem CI, sem terceiros além do teu fornecedor de modelo.\n" +
    "- Sem chave de API (ou com `--dry-run`) valida os conjuntos e imprime o plano sem chamar um modelo.\n" +
    "- `--set-baseline` regista as pontuações atuais como baseline para comparar com execuções futuras.\n\n" +
    "Ficheiros de conjunto: `golden.json`, `adversarial.json`, opcional `regression.json`.\n" +
    "Formato de item: `{ id, input, expect: { type, value|rubric } }`. Tipos de grader: contains | equals | regex | refuse | judge.\n" +
    "O system prompt é lido do `../prompts/vN.md` mais recente (a sua secção `## System`).\n";

// 1.25.1 — what the stop gate's claims (msg.stopGate.claims) are made of: a claim is about the WORK (a task, the feature, everything,
// the tests), never a bare verb — "Verifiquei o ficheiro…", "Concluí que o problema…", "Acabei de ler o código", "O método está
// implementado em src/pay.ts" were sent back while any recent tick was unverified. See en.js (STOP_EN_*).
const STOP_PT_DONE = String.raw`(?:feit[oa]s?|conclu[íi]d[oa]s?|terminad[oa]s?|implementad[oa]s?|verificad[oa]s?|finalizad[oa]s?|resolvid[oa]s?|complet[oa]s?|pront[oa]s?)`;
const STOP_PT_CHAIN = String.raw`(?:\s*(?:,|e|&)\s*(?:${STOP_PT_DONE}|testad[oa]s?|a\s+funcionar|funcionando))*`;
// Its clause ends right there ("A correção está concluída.") — "está implementado em src/pay.ts" describes the code.
const STOP_PT_END = String.raw`(?=[ \t]*(?:[.!,;:—–)]|$|\p{Extended_Pictographic}|\u2713|\u2714))`;
const STOP_PT_END1 = String.raw`(?=[ \t]*(?:[.!;)]|$|\p{Extended_Pictographic}|\u2713|\u2714))`;
// Not done IN / BY something ("está implementado em src/pay.ts", "foi feito pelo middleware", "pronto para começar").
const STOP_PT_NOT_WHERE = String.raw`(?!\s+(?:em|no|na|nos|nas|num|numa|por|pel[oa]s?|via|com|através|dentro|desde|para|pra)(?![\p{L}\p{N}_]))`;
// The work a first person finished: a tarefa (tarefa 3, tarefas 1-3), a feature, a correção, as alterações, tudo…
const STOP_PT_WORK = String.raw`(?:(?:(?:a|as|o|os|toda|todas|todo|todos|esta|estas|este|estes|essa|essas|esse|esses|ambas|ambos|minha|minhas|nossa|nossas|última|últimas|restantes)\s+)*(?:\d+\s+)?(?:tarefas?(?:\s+#?\d+(?:\s*(?:,|e|[-–]|a)\s*#?\d+)*)?|passos?(?:\s+#?\d+)?|features?|funcionalidades?|hist[óo]rias?|implementa[çc][ãa]o|corre[çc](?:[ãa]o|[õo]es)|altera[çc](?:[ãa]o|[õo]es)|mudan[çc]as?|trabalho|plano|bugfix)|tudo)(?![\p{L}\p{N}_])`;
// What the rest of a "Feito." line names when it claims the work (common.js stopLineClaim).
const STOP_PT_TESTED = String.raw`(?:testes?|tarefas?|suites?|verificad[oa]s?|passam|passaram|passou|passando|verdes?|implementad[oa]s?|implementei|build|lint)`;
// A first person's completion verb (singular and plural).
const STOP_PT_I = String.raw`(?:terminei|conclu[íi]|implementei|verifiquei|acabei|finalizei|testei|termin[áa]mos|conclu[íi]mos|implement[áa]mos|verific[áa]mos|acab[áa]mos|finaliz[áa]mos|test[áa]mos)`;

// ===========================================================================
// Human-readable tool messages (doctor / clarify / next-action / add-track /
// init notes / hook output). Functions so callers interpolate freely.
// ===========================================================================
const msg = {
    initNote: "Os stubs são placeholders. A skill preenche-os com conteúdo real (ver references/steering-templates.md).",
    createNote: () => null,
    addTrackNote: (tr, slug) => `+${tr} adicionado. Preenche as novas secções de design e volta a correr /spec-doctor ${slug}.`,
    addTrackAlready: (tr) => `já tem +${tr}`,
    notes: {
      scan: "Apenas um inventário heurístico — o agente interpreta-o para inferir o steering/constituição e fazer engenharia reversa das specs.",
      coverage: "Heurística a partir da intenção declarada: a parte dos ficheiros de código (sem os testes) nomeados por um marcador _Implements:_ de alguma feature, ativa ou arquivada. Um ficheiro conta como coberto quando uma tarefa o reclama — mantém os _Implements:_ atualizados.",
    },
    evidence: {
      failed: (n, code) => `Tarefa ${n}: a verificação falhou (exit ${code}) — não a marco como feita.`,
      missing: (n, slug) => `A tarefa ${n} tem um comando _Verify:_ mas não foi registada evidência — passa a evidência (comando, exit code, resumo) ou corre: ${DEV_SPEC} done ${slug} ${n} --run`,
      ran: (cmd, code) => `corrido: ${cmd} → exit ${code}`,
      failedTicked: (n, code) => `A tarefa ${n} já está marcada, mas a nova verificação falhou (exit ${code}) — ficou registado; passa a contar como não verificada até se registar uma execução com sucesso.`,
      badExit: (v) => `O exitCode tem de ser um inteiro (recebido '${v}').`,
      needsExit: "Uma evidência que indica um comando precisa do exit code — ou dá só um resumo, para uma verificação manual.",
      unknownExpect: (n, values) => `A tarefa ${n} tem ${values.map((v) => "_Expect: " + v + "_").join(", ")} — o marcador só conhece \`fail\`, por isso, tal como está escrita, a tarefa tem de PASSAR. Se a execução dela tem de falhar (um teste escrito antes da correção), escreve _Expect: fail_.`,
      noTests: (n, what) => `Tarefa ${n}: a execução passou, mas o output mostra que nenhum teste correu (${what}) — uma execução que não testa nada não prova nada (um glob, um caminho ou um filtro que não apanha nenhum teste). Nada foi registado; a tarefa continua por fazer. Corrige o comando _Verify:_ (ou o teste que ele indica) e depois regista uma execução que corra o teste.`,
    },
    finish: {
      ready: (slug) => `'${slug}' está pronta para fechar — confirma as verificações abaixo e depois faz merge local ou mantém o branch.`,
      notReady: (slug) => `'${slug}' ainda não está pronta para fechar:`,
      doctor: (ids) => `o doctor tem verificações bloqueantes: ${ids}`,
      open: (list) => `tarefas por fazer: ${list}`,
      unverified: (list) => `tarefas marcadas sem evidência de verificação: ${list}`,
      gates: (list) => `fases a aguardar aprovação: ${list}`,
      noTasks: "ainda não há tarefas — divide primeiro o design em tarefas",
      checkSuite: "A suite de testes COMPLETA está verde numa execução nova (cola o comando e o output).",
      checkLoad: "+saas: o teste de carga cumpre o orçamento de desempenho (load-test.md).",
      checkObs: "+saas: observabilidade validada — métricas a ser emitidas, logs visíveis, alertas e dashboard configurados.",
      checkCost: "+ai: o custo real em tokens está a ~20% da projeção do design.",
      checkSafety: "+ai: conjunto adversarial completo corrido, 100% nas categorias críticas de segurança, ~20 outputs revistos por um humano.",
      checkBug: "bugfix: os passos de reprodução do bug.md já não reproduzem o bug.",
      prSummary: "## Resumo",
      prAcs: "## Critérios de aceitação",
      prTasks: "## Tarefas",
      prTests: "## Testes",
      prChecks: "## Verificações antes do merge",
      prSpec: "## Spec",
      prRootCause: "## Causa raiz",
      prFix: "## Correção",
      noEvidence: "sem evidência registada",
      changedByDate: (list, slug) => `avaliado só pela data do ficheiro (aprovado antes das impressões digitais de conteúdo — um clone ou uma cópia repõe as datas, por isso pode nem ser uma edição): ${list} — revê e volta a aprovar para o seguir pelo conteúdo (/approve ${slug} <fase>)`,
      untrackedApproval: (list, slug) => `aprovado antes do registo de alterações — nada do ficheiro aprovado ficou registado, por isso uma edição não pode ser detetada: ${list} — volta a aprovar para o começar a seguir (/approve ${slug} design)`,
    },
    // 1.21 F5 — rigor à medida (o EN é a referência): tamanhos (spec_create {size}), a alteração (tamanho xs, um change.md).
    sizes: {
      spikeNoSize: "Um spike tem prazo, não tamanho — cria-se sem tamanho (o prazo limita-o).",
      changeSize: (size) => `kind "change" é tamanho xs — para o tamanho ${size} cria-se uma feature: spec_create {kind: "feature", size: "${size}"}.`,
      changeTracks: (list) => `Uma alteração (tamanho xs) é só core — um track (${list}) faz dela uma feature de tamanho s: spec_create {size: "s", tracks} (um design curto com as secções dos tracks, uma tarefa por critério).`,
      changeNoTracks: (slug) => `'${slug}' é uma alteração (tamanho xs, só core) — um track faz dela uma feature: cria-se uma de tamanho s (spec_create {size: "s", tracks}) e arquiva-se esta alteração (spec_feature {action: "archive"}).`,
      tracksIgnored: (list, slug) => `Tracks não adicionados — ${list}: '${slug}' é uma alteração (tamanho xs, só core); um track faz dela uma feature — cria-se uma de tamanho s (spec_create {size: "s", tracks}) e arquiva-se esta alteração (spec_feature {action: "archive"}).`,
      changeCreated: (slug) => `'${slug}' é uma alteração (tamanho xs): UM ficheiro, .specs/${slug}/change.md — o resumo, 1–3 critérios EARS, a abordagem e 1–3 tarefas com _Verify:_. Preenchê-lo e aprovar o plano numa só chamada (spec_approve {name: "${slug}", through: "tasks"}); depois das tarefas, spec_finish e o fecho da execução.`,
      changeCreatedCli: (slug) => `'${slug}' é uma alteração (tamanho xs): UM ficheiro, .specs/${slug}/change.md — o resumo, 1–3 critérios EARS, a abordagem e 1–3 tarefas com _Verify:_. Preenchê-lo e aprovar o plano numa só chamada: ${DEV_SPEC} approve ${slug} --through tasks; depois das tarefas, ${DEV_SPEC} finish ${slug} e o fecho da execução.`,
      sizeKept: (kept, asked) => `O tamanho desta feature é ${kept} — mantido (pedido: ${asked}): o tamanho escolhe-se uma vez, ao criar a feature.`,
      noGate: (phase, slug) => `'${slug}' é uma alteração: as únicas aprovações são o plano (fase tasks — change.md) e o fecho da execução — não há fase ${phase} para aprovar.`,
      scope: (acs, tasks, maxAcs, maxTasks, extra) => `uma alteração é XS — 1–${maxAcs} critérios de aceitação e 1–${maxTasks} tarefas, só core; o change.md tem ${acs} critérios e ${tasks} tarefa(s)${extra ? ` e o(s) track(s) ${extra}` : ""} — cria-se como feature de tamanho s (spec_create {size: "s"}) e arquiva-se esta alteração`,
      scopeOk: (acs, tasks) => `XS: ${acs} critérios, ${tasks} tarefa(s)`,
      approvePlan: (slug) => `Rever e aprovar o plano (change.md: os critérios, a abordagem e as tarefas) — spec_approve {name: "${slug}", through: "tasks"} (/spec-ff ${slug}).`,
      planFastForward: (slug, size, list) => `Tamanho ${size}: preencher primeiro o plano inteiro — ${list} — e depois aprová-lo numa só chamada: spec_approve {name: "${slug}", through: "tasks"} (/spec-ff ${slug}; CLI: ${DEV_SPEC} approve ${slug} --through tasks). O gate de cada fase continua a correr, por ordem; o primeiro que recusa para tudo e diz porquê.`,
      planFastForwardTests: (slug, size, list, through, what) => `Tamanho ${size}: preencher primeiro o plano inteiro — ${list} — e depois aprová-lo até ${through} numa só chamada: spec_approve {name: "${slug}", through: "${through}"} (/spec-ff ${slug} ${through}; CLI: ${DEV_SPEC} approve ${slug} --through ${through}). O gate de cada fase continua a correr, por ordem. Depois a Fase 4, cujo gate precisa de trabalho que vem depois do plano: ${({ tdd: "escrever os testes que falham", ai: "escrever o harness de evals e os conjuntos de avaliação da própria feature", both: "escrever os testes que falham e os conjuntos de avaliação da própria feature" })[what] || "escrever os testes que falham"} (/writeTests ${slug}), aprovar os testes (/approve ${slug} tests) e depois as tasks (/approve ${slug} tasks).`,
      templateApproved: (list) => `só a orientação do modelo em: ${list} — o design foi aprovado antes da regra mais estrita do 1.21, por isso é um aviso; a próxima aprovação pede texto próprio aí (ou uma linha "n/a — <porque não se aplica>")`,
      sectionsPassSized: (filled, covered, optional) => `preenchidas: ${filled}` + (covered ? ` · cobertas pela secção de outro track: ${covered}` : "") + (optional ? ` · opcionais neste tamanho, deixadas de fora: ${optional}` : ""),
      extendedComment: (marker, names) => `Tamanho s: as outras secções ${marker} — ${names} — são opcionais neste tamanho. Acrescenta-se uma quando se aplica (e aí tem de ficar preenchida), ou responde-se numa linha: "n/a — <porque não se aplica>".`,
      coveredComment: (label) => `Esta secção também responde a ${label} — os dois tracks estão ativos, por isso uma secção chega (uma secção ${label} própria também conta).`,
      suggest: {
        "trivial-change": "Tamanho sugerido xs — uma alteração trivial (uma gralha, um texto ou uma configuração, uma correção de uma linha): uma alteração, um change.md, duas aprovações.",
        "single-unit": "Tamanho sugerido s — uma unidade de trabalho (um endpoint, ecrã, botão, campo…) com no máximo um track com secções de design: uma história, as secções core dos tracks, o plano aprovado numa só chamada.",
        "several-tracks": "Tamanho sugerido l — três ou mais tracks com secções de design: a cadeia completa.",
        "public-api": "Tamanho sugerido l — uma API pública (consumidores externos, um contrato a manter): a cadeia completa.",
        "cross-system": "Tamanho sugerido l — atravessa sistemas (+dist com outro track, ou vários serviços): a cadeia completa.",
        default: "Tamanho sugerido m — uma feature com a cadeia completa (as secções repetidas dos tracks fundidas).",
      },
      optionalMark: "opcional neste tamanho",
      coveredMark: "coberta por outro track",
      suggestTail: "Confirmar ou escolher outro na Fase 0 — spec_create {size: xs | s | m | l}; sem tamanho fica o scaffold anterior ao 1.21.",
    },
    kindKept: (kept, asked) => `Esta feature já é do tipo '${kept}' — mantive-o (pediste '${asked}'). Cria outra para um tipo diferente.`,
    langKept: (kept, asked) => `Esta feature já está em '${kept}' — mantive-a (pediste '${asked}'). Uma feature, uma língua.`,
    // 1.23 review 5 — spec_create numa pasta que já existe (correr de novo) di-lo; uma feature nova cujo slug uma arquivada também tem é assinalada.
    createExisted: (slug) => `'${slug}' já existe — nada foi recriado (os ficheiros foram mantidos; correr de novo só acrescenta os tracks que faltam).`,
    createSummaryKept: "O resumo indicado não foi escrito: os ficheiros da feature já têm um.",
    createArchivedTwin: (slug) => `Há também uma feature arquivada chamada '${slug}' (.specs/_archive/${slug}) — para a restaurar mais tarde, renomeia primeiro uma delas.`,
    // 1.21 F3 — spec_create {kind: "bugfix"}: pré-preenchimento (reproduction · rootCause · condition · behaviour — nomes em inglês).
    bugPrefill: {
      bugOnly: (key) => `${key} é um dado de bugfix — passa kind: "bugfix" (preenche o bug.md e o critério de regressão).`,
      bugOnlyCli: (flag) => `${flag} é um dado de bugfix, que preenche o bug.md e o critério de regressão — cria-a como bugfix: ${DEV_SPEC} bugfix "<nome>" ${flag} "…" (ou --kind bugfix).`,
      oneLine: (key, max) => `${key} tem de ser uma só linha com até ${max} caracteres (vai para o critério EARS).`,
      skipped: (list) => `Não foi pré-preenchido — ${list}: o ficheiro já existia ou veio de um template do projeto (só cria); escreve esses textos nele.`,
    },
    err: {
      noUsableName: (name) => `O nome de feature '${name}' não tem caracteres utilizáveis (a-z, 0-9) para nome de pasta.`,
      reserved: (slug) => `'${slug}' é um nome reservado — escolhe outro nome para a feature.`,
      reservedWin: (slug) => `'${slug}' é um nome reservado no Windows — escolhe outro nome para a feature.`,
      notFound: (slug, root) => `Feature '${slug}' não encontrada em ${root}`,
      archivedHint: (slug) => `— está arquivada (.specs/_archive/${slug}): restaura-a primeiro (${DEV_SPEC} feature restore ${slug}).`,
      invalidJson: (rel, detail) => `${rel} não é JSON válido (${detail}) — corrige-o à mão; não o vou sobrescrever.`,
      tasksMissing: (slug) => `tasks.md não encontrado para '${slug}'`,
      requirementsMissing: (slug) => `requirements.md não encontrado para '${slug}'`,
      taskNotFound: (n, file = "tasks.md") => `Tarefa ${n} não encontrada em ${file}`,
      tasksNotText: (file = "tasks.md") => `${file} não está gravado em UTF-8 (as letras acentuadas estão noutra codificação — a página de código ANSI do Windows, a que o Set-Content e o Add-Content do Windows PowerShell 5.1 escrevem): nada foi alterado, para essas letras ficarem intactas. Grava ${file} em UTF-8 (VS Code: "Reopen with Encoding" → Windows 1252, depois "Save with Encoding" → UTF-8) e tenta de novo.`,
      featureBusy: (slug, rel) => `Outro processo dev-spec está a atualizar '${slug}' neste momento (${rel || `.specs/${slug}/.lock`}) — nada foi alterado; tenta de novo daqui a pouco. Se nenhum outro editor ou comando dev-spec estiver a correr, apaga esse ficheiro.`,
      roadmapBusy: "Outro processo dev-spec está a atualizar o .specs/roadmap.json neste momento (.specs/.roadmap.lock) — nada foi alterado; tenta de novo daqui a pouco. Se nenhum outro editor ou comando dev-spec estiver a correr, apaga esse ficheiro.",
      folderInUse: (rel) => `A pasta ${rel} está a ser usada por outro programa (um editor, um indexador ou antivírus, um terminal aberto lá dentro) — nada foi movido nem apagado; fecha-o e tenta de novo.`,
      lockStuck: (rel) => `Um lock dev-spec abandonado (${rel}) não pôde ser removido — o ficheiro (ou uma pasta com esse nome) está aberto noutro programa, é só de leitura ou não é um ficheiro. Nada foi alterado. Apaga ${rel} à mão (verifica as permissões) e tenta de novo.`,
      noText: "Nenhum texto fornecido.",
      unknownPhase: (phase, known) => `Fase desconhecida '${phase}'. Conhecidas: ${known}`,
      alreadyArchived: (slug) => `'${slug}' já está arquivada (.specs/_archive/${slug}) — renomeia primeiro esta feature (${DEV_SPEC} feature rename ${slug} "<novo nome>") e depois arquiva-a.`,
      renameNeedsName: "para renomear é preciso um nome novo.",
      sameSlug: "O nome novo dá o mesmo slug.",
      alreadyExists: (slug) => `'${slug}' já existe.`,
      renameArchived: (slug) => `'${slug}' é o nome de uma feature arquivada (.specs/_archive/${slug}) — escolhe outro nome (com o mesmo nome, nenhuma das duas poderia ser arquivada nem restaurada).`,
      slugTaken: (slug, held, name) => `'${name}' chega à pasta .specs/${slug}/, que tem outra feature ('${held}') — o nome da pasta guarda só os primeiros 64 caracteres do nome. Nada foi alterado: usa um nome mais curto que difira dentro deles (para trabalhar em '${held}', usa o nome '${slug}').`,
      badAction: "a ação tem de ser: remove | archive | rename | restore | flow",
      badTrack: "o track tem de ser: tdd | saas | ai | sec | privacy | dist | api | ui | obs | data",
      cycle: (chain) => `Dependência circular: ${chain}`,
      nameRequired: "o nome é obrigatório",
      noSpecs: (root) => `Não há .specs/ em ${root}`,
      notGenerated: (file) => `${file} existe e não foi gerado pelo dev-spec — não foi alterado.`,
      specsLinked: (rel) => `Recusado escrever em ${rel}: essa pasta é uma ligação (link simbólico, junction) ou aponta para fora de .specs/ — substitui-a por uma pasta normal e tenta de novo. Nada foi escrito.`,
      specsLinkedFile: (rel) => `Recusado escrever ${rel}: esse ficheiro é uma ligação (link simbólico) ou aponta para fora de .specs/ — substitui-o por um ficheiro normal e tenta de novo. Não foi escrito.`,
      specsNotFolder: (rel) => `${rel} é um ficheiro onde o dev-spec precisa de uma pasta — muda-lhe o nome ou move-o e tenta de novo. Nada foi escrito lá.`,
      specsNotFile: (rel) => `${rel} é uma pasta onde o dev-spec escreve um ficheiro — muda-lhe o nome ou move-a e tenta de novo. Não foi escrito.`,
      roadmapNotWritten: (file, broken) => `${broken} ${file} não foi regenerado — gerado a partir do que o roadmap.json ainda dá, perderia as dependências, o backlog e os marcos que não consegue ler. Corrige .specs/roadmap.json e corre ${DEV_SPEC} roadmap --write de novo.`,
      roadmapViewPartial: (broken) => `${broken} Esta vista deixa de fora o que não consegue ler (as dependências, o backlog e os marcos) até ser corrigido.`,
      unknownSteering: (file, known) => `Ficheiro de steering desconhecido '${file}'. Conhecidos: ${known}`,
    },
    ears: {
      needsClar: "Marcador [NEEDS CLARIFICATION] por resolver — resolve-o antes do design.",
      noModal: "O critério não tem verbo modal (SHALL / DEVE / DEBE) — não é uma frase EARS válida.",
      noId: "O critério não tem ID estável (ex.: US-1.AC-1).",
      bareAcId: (id) => `'${id}' não é um ID estável que o trace_check leia — escreve US-<história>.AC-<n> (ex.: US-1.${id}).`,
      subAcId: (id) => `'${id}' é um ID de subcritério, não um que o trace_check leia — dá a cada critério o seu próprio US-<história>.AC-<n> (um só nível: US-1.AC-1, US-1.AC-2 …).`,
      paddedAcId: (id, canon) => `'${id}' tem zeros à esquerda — o trace_check, o tasks.md e o plano de testes comparam os IDs de AC tal como estão escritos: escreve ${canon} (aqui e onde for citado).`,
      vague: (term) => `Termo vago '${term}' — substitui-o por um valor concreto e testável.`,
      noKeyword: "Sem palavra-chave EARS (WHEN/WHILE/IF/WHERE · QUANDO/ENQUANTO/SE/ONDE · CUANDO/MIENTRAS/SI/DONDE). Aceitável em requisitos ubíquos; confirma que é intencional.",
    },
    classify: {
      conf: { high: "alta", medium: "média", none: "nenhuma" },
      core: "core: sempre ativo (todas as features em modo Spec).",
      on: (t, conf, list, neg) => `+${t}: ATIVO${conf ? ` [confiança ${conf}]` : ""} — sinais encontrados: ${list}.${neg ? ` (${neg} apareceu negado.)` : ""}`,
      off: (t, neg) => `+${t}: inativo — ${neg ? `${neg} apareceu negado.` : "nenhum sinal encontrado."}`,
      offWeak: (t, list, neg) => `+${t}: inativo — só sinais fracos (${list}), insuficientes por si.${neg ? ` (${neg} apareceu negado.)` : ""}`,
      substantial: "Nenhum sinal de track encontrado, mas a descrição é substancial — considera se +tdd se aplica (correção/casos limite).",
      weakOnly: (list) => `Ativo só por sinais fracos — confirma: ${list}.`,
      possible: (t, sig) => `Possível +${t} — sinal fraco '${sig}' (precisa de corroboração; não foi ativado).`,
      genericOnly: (t, list) => `Possível +${t} — só palavras comuns de aplicação (${list}): nenhuma nomeia ${({ api: "um contrato de API (uma API pública, OpenAPI / GraphQL / gRPC, uma alteração incompatível…)",
        ui: "uma questão de interface própria (um design system, acessibilidade, um componente de UI, um estado vazio ou de carregamento…)", obs: "uma questão de operabilidade (um SLO, alertas, on-call, um runbook, um rollout…)",
        data: "uma questão de pipeline de dados (um data warehouse, um job ETL / ELT, verificações de qualidade de dados, um backfill, linhagem…)" })[t] ||
        "um segundo sistema (um broker, outro serviço, um webhook…)"}; não foi ativado.`,
      keptOff: (t, kw) => `+${t} mantido inativo — '${kw}' apareceu negado.`,
      onAlthough: (t, quoted, list) => `+${t} está ATIVO embora ${quoted} tenha aparecido negado — ativado por: ${list}. Confirma que é intencional.`,
      // 1.21 F2 — os ajustes de sinais do projeto (.specs/classifier.json) e classify --explain
      overridesApplied: (list) => `Os ajustes de sinais deste projeto mudaram a leitura (.specs/classifier.json): ${list.map((o) => `'${o.word}' para +${o.track} → ${({ off: "nenhum sinal", weak: "um sinal fraco", strong: "um sinal forte" })[o.effect]}`).join(", ")} — ${DEV_SPEC} signals list mostra todos.`,
      overridesInvalid: (code, n) => `.specs/classifier.json ${code === "invalid-entries" ? `tem ${n} entrada(s) inválida(s) (ignorada(s))` : `foi ignorado (${({ "invalid-json": "não é JSON válido", "invalid-shape": "sem lista \"signals\"", "too-big": "grande demais", "not-a-file": "não é um ficheiro normal", unreadable: "ilegível" })[code] || code})`} — ${DEV_SPEC} signals list diz o que corrigir.`,
      explainHead: "Palavras-chave encontradas (track · palavra-chave · nível da tabela → nível final):",
      explainNone: "Nenhuma palavra-chave encontrada.",
      explainMatch: (m) => `  +${m.track} '${m.keyword}'${m.text.toLowerCase() !== m.keyword.toLowerCase() ? ` ("${m.text}")` : ""} · ${m.base || "—"} → ${({ shadowed: "absorvida (dentro de uma expressão forte mais longa)", none: "nenhum sinal (uma pista de contexto)", unbacked: "contexto, sem outro sinal que o apoie" })[m.tier] || m.tier}${m.cue ? " (uma pista de contexto)" : ""}${m.override ? " (um ajuste do projeto)" : ""}${m.negated ? ` · negada (${({ before: "uma negação antes dela", after: "uma expressão depois dela", list: "uma lista negada" })[m.negation] || m.negation})` : ""}`,
      explainOverridesHead: (n, min) => `Ajustes de sinais do projeto (.specs/classifier.json — ${n}; um ajuste aprendido aplica-se após ${min} correções consistentes):`,
      explainOverride: (o, min) => `  +${o.track} '${o.word}' → ${o.effect} · ${o.origin === "set" ? "definido à mão" : `aprendido, ${o.count} correção(ões)`}${o.active ? "" : ` · pendente (${o.count} de ${min})`}${o.applied ? " · aplicado aqui" : ""}`,
      explainNoOverrides: "Ajustes de sinais do projeto: nenhum (.specs/classifier.json).",
    },
    // 1.21 F2 — spec_tracks {action: "signals"} / dev-spec signals, e o que o spec_create aprende com uma correção da Fase 0
    signals: {
      learnedPending: (t, w, e, n, min) => `Correção da Fase 0 registada: '${w}' ${e === "off" ? `sugeriu +${t} e a feature foi criada sem ele` : `era só uma pista para +${t} e a feature foi criada com ele`} (${n} de ${min} — após ${min} correções consistentes ${e === "off" ? `deixa de sugerir +${t}` : `passa a ser ${({ weak: "um sinal fraco", strong: "um sinal forte" })[e]} de +${t}`} neste projeto; ${DEV_SPEC} signals list).`,
      learnedActive: (t, w, e, n) => `Aprendido com ${n} correções consistentes da Fase 0: '${w}' ${e === "off" ? `deixa de sugerir +${t}` : `é ${({ weak: "um sinal fraco", strong: "um sinal forte" })[e]} de +${t}`} neste projeto (.specs/classifier.json — para desfazer: ${DEV_SPEC} signals forget ${t} "${w}").`,
      learnedDropped: (t, w, e) => `Esta escolha da Fase 0 contradiz o ajuste '${w}' → ${e} para +${t}: removido (.specs/classifier.json).`,
      learnFailed: (code) => `A correção da Fase 0 não foi registada — ${code === "busy" ? ".specs/ está ocupado (outro processo tem o bloqueio)" : `.specs/classifier.json não pode ser reescrito (${code}); ${DEV_SPEC} signals list diz o que corrigir`}.`,
      capped: (max) => `.specs/classifier.json está cheio (${max} ajustes, todos em vigor) — para registar mais, é preciso esquecer um (${DEV_SPEC} signals forget <track> <palavra>).`,
      badOp: (op) => `Operação de sinais desconhecida '${op}' — uma de: list, set, forget.`,
      needTrackWord: (op) => `signals ${op} precisa de um track e de uma palavra — ${DEV_SPEC} signals ${op} <track> <palavra>${op === "set" ? " off|weak|strong" : ""} (spec_tracks {action: "signals", op: "${op}", track, word${op === "set" ? ", effect" : ""}}).`,
      coreTrack: "core está sempre ativo — não tem sinais para ajustar.",
      badTrack: (t, list) => `Não há o track '${t}' neste projeto — um de: ${list}.`,
      badWord: (w) => `'${w}' não é uma palavra de sinal — letras e dígitos, com espaços, hífenes, apóstrofos ou pontos no meio, 2–60 caracteres (uma palavra literal, nunca um padrão).`,
      badEffect: (e) => `Efeito desconhecido '${e}' — um de: off (nenhum sinal), weak (uma âncora: precisa de um segundo sinal), strong (ativa o track sozinho).`,
      notFound: (t, w) => `Não há ajuste '${w}' para +${t} em .specs/classifier.json — ${DEV_SPEC} signals list mostra os ajustes.`,
      setDone: (t, w, e, prev) => `Definido: '${w}' → ${e} para +${t} (${({ off: "nenhum sinal", weak: "um sinal fraco", strong: "um sinal forte" })[e]}; aplica-se a partir de agora neste projeto)${prev ? ` — era ${prev}` : ""}.`,
      forgotten: (t, w, e) => `Esquecido: '${w}' → ${e} para +${t} — voltam a valer os sinais de origem.`,
      listHead: (rel, n, active, min) => `${rel} — ${n} ajuste(s) de sinais, ${active} em vigor (um ajuste aprendido aplica-se após ${min} correções consistentes da Fase 0):`,
      listNone: (rel) => `Nenhum ajuste de sinais (${rel}) — o spec_create aprende estes ajustes com as correções da Fase 0; ${DEV_SPEC} signals set <track> <palavra> off|weak|strong define um.`,
      listItem: (o, min) => `  +${o.track} '${o.word}' → ${o.effect} · ${o.origin === "set" ? "definido à mão" : `aprendido, ${o.count} correção(ões)`} · ${o.active ? "em vigor" : `pendente (${o.count} de ${min})`}${o.unknownTrack ? " · esse track já não existe neste projeto (sem uso)" : ""}${o.lastAt ? ` · ${o.lastAt.slice(0, 10)}` : ""}`,
      fileWarning: (rel, code, n) => `${rel} ${code === "invalid-entries" ? `tem ${n} entrada(s) inválida(s) — são ignoradas, e o ficheiro nunca é reescrito até serem corrigidas ou removidas à mão` : `é ignorado e nunca reescrito — ${({ "invalid-json": "não é JSON válido", "invalid-shape": "não tem uma lista \"signals\"", "too-big": "é grande demais (64 KB no máximo)", "not-a-file": "não é um ficheiro normal", unreadable: "não pode ser lido" })[code] || code}; é preciso corrigi-lo à mão ou apagá-lo`}.`,
      problem: (i, code) => `  entrada ${i + 1}: ${({ "invalid-entry": "inválida (track, word, effect off|weak|strong, count ≥ 1, origin learned|set)", duplicate: "repete uma entrada anterior", "too-many": "além do limite de 200 ajustes" })[code] || code}`,
    },
    sectionStatus: { missing: "em falta", unfilled: "por preencher", template: "só a orientação do modelo", "na-short": "n/a sem uma razão (4+ palavras)" },
    sectionNames: {
      "Performance Budget": "Orçamento de Desempenho", "Scale Design": "Design de Escala", "Multi-tenancy": "Modelo Multi-inquilino",
      "Observability": "Observabilidade", "Cost Envelope": "Envelope de Custo", "Model Strategy": "Estratégia de Modelo",
      "Prompt Architecture": "Arquitetura de Prompt", "Token Economics": "Economia de Tokens", "Latency Budget": "Orçamento de Latência",
      "Eval Strategy": "Estratégia de Avaliação", "Safety & Abuse": "Segurança e Abuso", "Fallback & Degradation": "Fallback e Degradação",
      "Observability for AI": "Observabilidade de IA", "Model Lifecycle": "Ciclo de Vida do Modelo", "Multi-modality": "Multimodalidade",
    },
    precommit: {
      header: "dev-spec-driven pre-commit:",
      earsErrors: (f, n) => `✗ ${f}: ${n} erro(s) EARS`,
      earsClean: (f, n) => `✓ ${f}: EARS limpo (${n} critérios)`,
      earsWarnings: (f, n, w, p) => `⚠ ${f}: sem erros EARS (${n} critérios), mas ${[w ? `${w} aviso(s)` : null, p ? `${p} placeholder(s) do template por preencher` : null].filter(Boolean).join(" e ")} — não bloqueia`,
      phantom: (f, n, list) => `✗ ${f}: ${n} referência(s) AC/teste fantasma — provavelmente erros de escrita: ${list}`,
      uncovered: (f, n, list) => `⚠ ${f}: ${n} AC(s) sem tarefa (aviso): ${list}`,
      unidentified: (f, n, list) => `⚠ ${f}: ${n} critério(s) sem ID US-<história>.AC-<n> — a rastreabilidade não conta nenhum (aviso): ${list}`,
      traceClean: (f, n) => `✓ ${f}: rastreabilidade limpa (${n} ACs)`,
      blocked: (n) => `\nCommit bloqueado: ${n} problema(s) bloqueante(s) nos ficheiros de spec em staging. Corrige-os, ou usa 'git commit --no-verify' para passar à frente.`,
    },
    doctor: {
      steeringMissing: (list) => `em falta: ${list}`,
      steeringOk: "steering essencial presente (incl. constituição)",
      requirementsMissing: "requirements.md em falta",
      clarificationsOpen: (n) => `${n} [NEEDS CLARIFICATION] por resolver — resolve antes do design`,
      clarificationsOpenPlan: (n) => `${n} [NEEDS CLARIFICATION] por resolver no change.md — resolve antes de aprovar o plano`,
      clarificationsOpenBug: (n) => `${n} [NEEDS CLARIFICATION] por resolver no bug.md — resolve-os antes de aprovar a Reprodução / Causa Raiz`,
      clarificationsNone: "nenhum por resolver",
      scPresent: "presente",
      scMissing: "sem critérios de sucesso mensuráveis SC-###",
      prioritiesOk: "histórias de utilizador priorizadas",
      prioritiesMissing: "sem prioridade P1 (MVP) numa história de utilizador",
      acDup: (list) => `IDs de AC duplicados: ${list}`,
      acUnique: "IDs de AC únicos",
      earsDetail: (n, e, w) => `critérios=${n}, erros=${e}, avisos=${w}`,
      earsNoCriteria: (ids, file = "requirements.md") => `o ${file} cita IDs de AC (${ids}) que nenhum critério validado pelo EARS contém — escreve cada AC como item de lista, título ou linha que comece pelo seu ID ('- US-1.AC-1 — QUANDO …', '- [US-1.AC-1] …'), ou como linha de tabela sob um título de Critérios de Aceitação`,
      earsNoAcIds: (list, file = "requirements.md") => `o ${file} tem critérios (${list}) sem nenhum ID de AC que o trace_check leia — numera cada um US-<história>.AC-<n> (US-1.AC-1, US-1.AC-2 …); um AC-1 sozinho não é um`,
      designMissing: "design.md em falta",
      mermaidOk: "tem um diagrama",
      mermaidMissing: "nenhum diagrama mermaid encontrado",
      mermaidTemplate: "o diagrama mermaid ainda é o do modelo (Componente → Base de Dados) — falta desenhar a arquitetura desta funcionalidade",
      constitutionOk: "presente — verifica que cada princípio é validado",
      constitutionMissing: "sem secção Verificação da Constituição no design",
      saasAllFilled: "as 5 preenchidas",
      aiAllFilled: "as 10 preenchidas",
      gatesPending: (list) => `a aguardar aprovação humana: ${list} — corre /approve antes de avançar`,
      gatesOk: "todas as fases presentes aprovadas",
      unverified: (list) => `marcadas sem evidência de verificação: ${list}`,
      verifiedOk: "todas as tarefas marcadas com comando _Verify:_ têm evidência",
      rootCauseMissing: "bug.md → Causa Raiz por preencher — nenhuma correção antes de se conhecer a causa",
      rootCauseOk: "causa raiz documentada",
      reproMissing: "bug.md → Reprodução por preencher",
      reproOk: "reprodução documentada",
    },
    next: {
      fixChecks: (ids, slug) => `Corrige as verificações bloqueantes (${ids}) — corre /spec-doctor ${slug} para detalhes.`,
      reReview: (files) => `Nova revisão: ${files} alterado(s) após a última aprovação — volta a aprovar a fase afetada.`,
      approvedMissing: (files, slug, phase) => `${files} foi aprovado mas já não existe — restaura-o (foi apagado depois da aprovação) ou, se desapareceu de vez, retira essa aprovação: /approve ${slug} ${phase} --revoke.`,
      stateInvalid: (error, slug) => `${error} Enquanto não for reparado, nada pode ser aprovado, marcado como feito nem fechado, e as aprovações, marcações e evidências que guarda não podem ser lidas — corrige-o à mão ou restaura-o do git (marcadores de conflito de um merge? resolve-os; ${DEV_SPEC} merge-state --install passa a juntá-lo pelo significado), depois /spec-doctor ${slug}.`,
      roadmapInvalid: (error, slug) => `${error} Enquanto não for reparado, nada pode ser aprovado, revogado nem fechado — os papéis de aprovação e as verificações do projeto que guarda não podem ser lidos. Corrige-o à mão ou restaura-o do git (marcadores de conflito de um merge? resolve-os; ${DEV_SPEC} merge-state --install passa a juntá-lo pelo significado), depois /spec-doctor ${slug}.`,
      approveRequirements: (slug) => `Revê e aprova os requisitos — /approve ${slug} requirements.`,
      approveDesign: (slug) => `Revê e aprova o design — /approve ${slug} design.`,
      approveTasks: (slug) => `Revê e aprova a divisão de tarefas — /approve ${slug} tasks.`,
      approveTestPlan: (slug) => `Revê e aprova o plano de testes — /approve ${slug} test-plan.`,
      approveEvalPlan: (slug) => `Revê e aprova o plano de evals — /approve ${slug} eval-plan.`,
      approveBugDesign: (slug) => `Revê e aprova o bug.md (Reprodução + Causa Raiz — o design de um bugfix) — /approve ${slug} design.`,
      signOffTests: (slug, what) => `Aprovação da Fase 4: a implementação já começou, por isso os testes já não se escrevem primeiro — ${({ tdd: "confirma que cada teste planeado existe com o seu T-ID no nome do teste (test(\"T-01 …\")) para que o tests-in-code o encontre", ai: `confirma que o conjunto de evals é o da própria feature e regista a baseline (/eval ${slug} --set-baseline)`, both: `confirma que cada teste planeado existe com o seu T-ID no nome do teste (test("T-01 …")) e que o conjunto de evals é o da própria feature, e regista a baseline (/eval ${slug} --set-baseline)` })[what]}. Depois aprova — /approve ${slug} tests.`,
      approveTests: (slug, what) => `Fase 4, o gate rígido: ${({ tdd: "escreve todos os testes planeados e confirma que cada um falha pela razão certa", ai: "escreve os testes determinísticos e o harness de evals, e regista a baseline", both: "escreve todos os testes planeados (cada um a falhar pela razão certa) e o harness de evals, e regista a baseline" })[what]} — /writeTests ${slug}; nenhum código de implementação antes disso. Depois aprova — /approve ${slug} tests.`,
      implement: (n, text, slug) => `Implementa a tarefa #${n}: ${text} — /executeTask ${slug}.`,
      allDone: (slug) => `Todas as tarefas feitas — fecha a feature com /spec-finish ${slug} (spec_finish): relatório de prontidão + resumo do merge. Opcional, antes disso: /spec-simplify ${slug} — uma limpeza do código da própria feature sem mudar o comportamento, provada pelos seus testes.`,
      breakIntoTasks: (slug) => `Divide o design em tarefas — /createTask ${slug}.`,
      drifted: (slug, day, n, total, files) => `'${slug}' foi fechada a ${day}, mas ${n} de ${total} ficheiro(s) de implementação mudaram desde então: ${files} (${DEV_SPEC} drift ${slug}). Decide: a spec está agora errada → /spec-impact ${slug} (ou uma feature nova com _Supersedes:_); o código está errado → corrige-o (/spec-bugfix); inofensivo → volta a correr /spec-finish ${slug} para uma baseline nova.`,
      finished: (slug, day, total, signOff) => `'${slug}' está fechada (${day}) — os ${total} ficheiro(s) de implementação não mudaram desde então.` +
        (!signOff ? ` Nada mais a fazer aqui — /spec-drift ${slug} verifica-a depois de alterações futuras.`
          : signOff.why ? ` A aprovação final (execution, ${signOff.at}) foi registada antes destas alterações: ${signOff.why} — volta a confirmá-la: /approve ${slug} execution${signOff.role ? " --role " + signOff.role : ""}.`
            : ` Falta a aprovação final${signOff.missing ? ` — ${signOff.missing}${signOff.signed ? ` (já validaram: ${signOff.signed})` : ""}` : ""}: /approve ${slug} execution${signOff.role ? " --role " + signOff.role : ""}.`),
      verifySuite: (slug, list) => `'${slug}' está fechada, mas as verificações do projeto não têm uma execução bem-sucedida desde a última atividade nas tarefas: ${list} — o /spec-finish recusa e o gate de fim de turno devolve um "feito" até passarem. Corre-as e regista as execuções: ${DEV_SPEC} finish ${slug} --run (ou spec_finish {evidence: [{name, command, exitCode}]}).`,
      verifyDuplicate: (slug, list, n) => `Todas as tarefas estão marcadas, mas nem todas estão verificadas: ${list} — há duas tarefas com o número ${n}, por isso uma execução registada para a #${n} só chega à primeira (${DEV_SPEC} done ${slug} ${n} responde por ela). Renumera as tarefas em .specs/${slug}/tasks.md para que cada número seja único (doctor: duplicate-tasks), volta a aprovar a fase tasks (/approve ${slug} tasks) e regista depois a execução de cada tarefa renumerada.`,
      signOffWhy: { approvals: (list) => `aprovação de ${list}`, changeRequests: (list) => `pedido de alteração ${list}`, join: "; " },
      refinish: (slug, day, why) => `'${slug}' foi fechada a ${day}, mas mudou desde então (${why}) e as tarefas estão todas feitas — volta a fechá-la: /spec-finish ${slug} (spec_finish {write: true}) renova o relatório de prontidão, o resumo do merge e a baseline de drift; depois volta a dar a aprovação final: /approve ${slug} execution.`,
      driftedStale: (why) => `Também mudou desde esse fecho (${why}): decidas o que decidires, volta a fechá-la depois — /spec-finish (spec_finish {write: true}) regista a baseline nova.`,
      verify: (slug, list, n, runnable) => `Todas as tarefas estão marcadas, mas nem todas estão verificadas: ${list} — o /spec-finish e a aprovação final recusam até cada uma ter uma execução com sucesso. ` +
        (runnable ? `Volta a correr o comando _Verify:_ da tarefa ${n} e regista o resultado: ${DEV_SPEC} done ${slug} ${n} --run` : `Regista uma execução com sucesso da tarefa ${n}: spec_complete_task {name: "${slug}", number: ${n}, evidence: {command, exitCode: 0}} (${DEV_SPEC} done ${slug} ${n} --cmd "<comando>" --exit 0)`) +
        "; uma execução que falha quer dizer que o código tem de ser corrigido primeiro.",
    },
    clarify: {
      resolveMarker: (mk) => "Resolve [NEEDS CLARIFICATION]: " + (mk || "(não especificado)"),
      addSuccessCriteria: "Adiciona uma secção Critérios de Sucesso com resultados mensuráveis e agnósticos à tecnologia (SC-001 …).",
      idSuccessCriteria: "Dá a cada critério de sucesso um ID estável (SC-001 …) e um alvo mensurável.",
      prioritize: "Prioriza as histórias de utilizador (P1 = a fatia MVP que entrega valor sozinha; P2/P3 incrementais).",
      independentTest: "Indica como cada história de utilizador pode ser testada de forma independente (para ser lançável por si só).",
      quantifyVague: (line, text) => `Quantifica o termo vago na linha ${line}: ${text}`,
      edgeCases: "Lista os casos limite e o comportamento de tratamento de erros (cada um como um AC SE…ENTÃO).",
      outOfScope: "Indica explicitamente o que está FORA de âmbito.",
      nfr: "Especifica os requisitos não-funcionais (desempenho / segurança / acessibilidade) com alvos mensuráveis.",
      unwanted: "Adiciona critérios de comportamento indesejado (SE…ENTÃO / IF…THEN / SI…ENTONCES) para os caminhos de falha.",
      tenant: "Especifica o isolamento de inquilino: o inquilino A nunca pode ler/escrever dados do inquilino B (escreve-o como um AC).",
      rateLimit: "Especifica os limites de taxa (por utilizador / por inquilino / global).",
      aiQuality: "Especifica o alvo de qualidade de output e o comportamento de recusa para o caminho de IA.",
      aiCost: "Especifica um teto de custo por pedido ($/tokens).",
      changeSummary: "Escreve o Resumo da alteração no change.md: o que muda e porquê, numa linha.",
      changeCriteria: "Escreve 1–3 critérios de aceitação EARS no change.md (1. **US-1.AC-1** — QUANDO … O SISTEMA DEVE …).",
      changeApproach: "Escreve a Abordagem no change.md: o que a alteração toca e porque é só isso.",
      changeScope: (detail) => `Mantém-na uma alteração, ou torna-a uma feature: ${detail}.`,
    },
    hook: {
      earsClean: (n) => `Verificação EARS: ${n} critérios, tudo limpo ✓`,
      earsIssues: (errs, warns, top, hasErr, file = "requirements.md") =>
        `Verificação EARS em ${file} — ${errs} erro(s), ${warns} aviso(s):\n${top}` +
        (hasErr ? (file === "change.md" ? "\nCorrige os erros antes de aprovar o plano." : "\nCorrige os erros antes de avançar para o design.") : ""),
      traceOk: (n) => `Rastreabilidade: todos os ${n} ACs cobertos por tarefas ✓`,
      traceGaps: (feature, parts) => `Lacunas de rastreabilidade em ${feature}:\n  - ${parts}`,
      roadmapUpdated: (pct, complete, total) => `Roadmap atualizado → ${pct}% (${complete}/${total} features).`,
      sessionHeader: "dev-spec-driven — features em .specs/:",
      sessionLine: (name, tracks, phase, done, total) => `  • ${name} [${tracks}] — ${phase} (${done}/${total} tarefas)`,
      sessionMore: (n) => `  … +${n} feature(s) — /spec-status (ou ${DEV_SPEC} list) mostra todas`,
    },

    evidenceGate: {
      noContent: "A evidência precisa de um comando (com o exit code) ou de um resumo — um exit code sozinho não prova nada.",
      manualOnRunnable: (n, slug) => `Tarefa ${n}: ficou registada uma nota, mas o comando _Verify:_ não foi corrido — continua não verificada até se registar uma execução com sucesso: ${DEV_SPEC} done ${slug} ${n} --run`,
      redPhaseTestWord: "o teste",
      redPhaseVerify: (n, slug, test) => `A tarefa ${n} escreve um teste que tem de FALHAR (a fase vermelha), por isso um _Verify:_ que tem de passar nunca passa nela. Marca a tarefa ${n} com _Expect: fail_ — uma execução que FALHE passa a ser a prova (${test} falha antes da correção) e uma que passe é recusada: ${DEV_SPEC} done ${slug} ${n} --run. Ou passa o comando para a tarefa que o põe a verde (a correção — o _Verify:_ dela prova então a correção).`,
      failedRun: (n, code, slug, runnable) => `Tarefa ${n}: a última execução registada falhou (exit ${code}) — uma nota não muda isso; continua não verificada até se registar uma execução com sucesso ` +
        (runnable ? `do comando _Verify:_: ${DEV_SPEC} done ${slug} ${n} --run` : "(um comando com exit code 0)."),
      duplicateNumber: (n) => `Tarefa ${n}: outra tarefa também usa o número ${n} e a evidência registada é dessa — esta continua não verificada; renumera as tarefas e depois regista a evidência desta.`,
      staleEvidence: (n, slug, runnable) => `Tarefa ${n}: a evidência registada é de outra tarefa ou de um comando _Verify:_ anterior — continua não verificada até se registar ` +
        (runnable ? `uma execução desta: ${DEV_SPEC} done ${slug} ${n} --run` : "a evidência desta."),
      reason: { "no-evidence": "sem evidência", "failed-run": "a última execução falhou", "manual-note-on-runnable-verify": "só uma nota, comando _Verify:_ por correr", "duplicate-number": "número partilhado com outra tarefa",
        "stale-evidence": "evidência de outra tarefa ou de outro comando _Verify:_",
        "unexpected-pass": "a execução passou, mas o _Expect: fail_ precisa de uma execução vermelha",
        unobserved: "execução não observada pelo harness",
        "command-mismatch": "a execução registada não é o comando _Verify:_" },
      commandMismatch: (n, slug, ran, verify, red) => `Tarefa ${n}: a execução registada (\`${ran}\`) não é uma execução do seu comando _Verify:_ (${verify}) — fica marcada, mas continua não verificada até se registar uma execução ${red ? "QUE FALHE " : ""}desse comando (tal como está escrito — com vários comandos _Verify:_, todos eles numa SÓ execução unidos com \` && \`; um \`cd <raiz do projeto> &&\`, \`set -o pipefail;\` ou VAR=valor teu à frente serve (um cd para outra pasta é outra execução), mas nunca tires um que o _Verify:_ tenha)` +
        (red ? ` — regista-a ANTES de a correção entrar, enquanto o teste ainda falha: ${DEV_SPEC} done ${slug} ${n} --run (uma execução vermelha de outro comando nunca conta; com a correção já feita, põe-na de parte — git stash push -- <os ficheiros da correção>, não um git stash simples: levaria também o tasks.md e o .state.json — para essa execução e depois repõe-na).` : `: ${DEV_SPEC} done ${slug} ${n} --run`),
      duplicateTasks: (list) => `números de tarefa repetidos: ${list} — o complete/brief escolhem a primeira por fazer; renumera-as`,
      evidenceMoved: (list, slug) => `execuções registadas sob um número de tarefa pertencem a uma tarefa que agora tem outro número (renumerada): ${list} — a evidência é guardada por número, por isso nenhuma das tarefas lê essa execução; regista a execução da tarefa movida: ${DEV_SPEC} done ${slug} <n> --run`,
    },
    observed: {
      on: "Modo de evidência OBSERVADO — uma tarefa cujo _Verify:_ tem um comando só fica verificada com uma execução com sucesso que o harness viu (no Claude Code, o hook de observação do plugin guarda cada execução Bash de um comando _Verify:_ ou de uma verificação do projeto) ou que o dev-spec done --run / finish --run fez; a execução de uma verificação do projeto também (roadmap.json meta.evidence). Um cliente só MCP não tem esse hook: regista as execuções dele com " + DEV_SPEC + " done <feature> <n> --run.",
      off: "Modo de evidência REPORTADO — as execuções que um agente reporta verificam tal como são dadas (roadmap.json meta.evidence); cada registo continua a dizer se o harness a observou.",
      badValue: (v) => `--evidence aceita reported ou observed (recebido '${v}').`,
      badInput: (v) => `evidence tem de ser "reported" ou "observed" (recebido '${v}').`,
      unobservedRedNote: (n, slug) => `A tarefa ${n} está marcada _Expect: fail_: a sua prova é a execução VERMELHA, e o harness nunca a viu — este projeto só verifica execuções observadas (roadmap.json meta.evidence: observed). Refaz a execução vermelha onde seja observada: põe a correção de lado (git stash), corre o comando _Verify:_ com a ferramenta Bash no Claude Code ou com ${DEV_SPEC} done ${slug} ${n} --run (tem de falhar), depois repõe a correção e regista a execução bem-sucedida.`,
      unobservedNote: (n, slug) => `Tarefa ${n}: a execução ficou registada, mas o harness nunca a viu — este projeto só verifica um comando _Verify:_ com uma execução observada (roadmap.json meta.evidence: observed). Corre o comando com a ferramenta Bash no Claude Code e volta a registá-lo, ou deixa a CLI corrê-lo: ${DEV_SPEC} done ${slug} ${n} --run`,
      neverObserved: "Nenhuma execução foi alguma vez observada neste projeto: só o Claude Code com o plugin dev-spec-driven as guarda (hooks/observe-hook.js) — um cliente só MCP não tem hook: regista as execuções com " + DEV_SPEC + " done <feature> <n> --run (ou volta atrás: " + DEV_SPEC + " init --evidence reported).",
      naHint: "Este projeto só verifica execuções que o harness viu (roadmap.json meta.evidence: observed): corre o comando com a ferramenta Bash no Claude Code, ou pela CLI (--run).",
    },
    taskDone: {
      done: (n, verified, done, total) => `Tarefa ${n} feita${verified ? " (verificada)" : ""}. ${done}/${total}`,
      already: (n, verified, done, total) => `A tarefa ${n} já estava feita${verified ? " (verificada)" : ""}. ${done}/${total}`,
      next: (n, text) => `  próxima → #${n} ${text}`,
      allDone: "  — tudo feito ✓",
      noRunnable: (n) => `a tarefa ${n} não tem um marcador _Verify: <comando>_ executável`,
      shellHint: "Dica: a shell por omissão do Windows (cmd.exe) não conseguiu correr esta linha de comando tal como está escrita. Se o comando _Verify:_ foi escrito para uma shell POSIX, tenta de novo com --shell bash (ou define DEV_SPEC_SHELL=bash).",
      posixOnWindows: (cmd, kinds) => `o comando _Verify:_ \`${cmd}\` usa sintaxe de shell POSIX (${kinds.map((k) => ({ "single-quotes": "plicas '…'", variable: "$VARIAVEIS" })[k] || k).join(", ")}) que o cmd.exe — a shell por omissão do --run no Windows — lê de outra forma, muitas vezes sem falhar: não tem plicas e nunca expande $VAR, por isso uma verificação partida podia ficar registada como execução bem-sucedida. Nada foi executado; a tarefa continua aberta. Corre de novo com --shell bash (Git Bash; ou define DEV_SPEC_SHELL=bash), com --shell pwsh se for um comando PowerShell (ou dá o script ao PowerShell entre aspas: pwsh -NoProfile -Command "…") — ou --shell cmd para o correr mesmo assim no cmd.exe.`,
      pwshInPosix: (cmd, kinds, shell) => `o comando _Verify:_ \`${cmd}\` passa ao PowerShell um script com ${kinds.map((k) => ({ variable: "$VARIAVEIS", backtick: "acentos graves (backticks)" })[k] || k).join(" e ")} fora de plicas, mas é uma shell POSIX (${shell}) que corre a linha e expande-os primeiro — \`exit $LASTEXITCODE\` fica um \`exit\` sem código (sai com 0), por isso uma verificação que falha podia ficar registada como bem-sucedida. Nada foi executado; a tarefa continua aberta. Põe o script entre plicas para uma shell POSIX (pwsh -NoProfile -Command '…; exit $LASTEXITCODE'), ou corre-o com --shell pwsh (ou define DEV_SPEC_SHELL=pwsh) e escreve só o PowerShell (_Verify: Invoke-Pester -Path tests -CI_).`,
    },

    tracks: {
      unknown: (items, valid) => `Track${items.length > 1 ? "s" : ""} desconhecido${items.length > 1 ? "s" : ""}: ${items.map((u) => `'${u.token}'` + (u.suggestion ? ` (querias dizer '${u.suggestion}'?)` : "")).join(", ")}. Tracks válidos: ${valid}.`,
      cannotRemoveCore: "O 'core' está sempre ativo — não pode ser removido.",
      bugfixNeedsTdd: "Um bugfix é sempre test-first — não se pode remover o +tdd.",
      notActive: (list) => `Não ativo: ${list} — nada a remover.`,
      removed: (list, slug) => `Tracks desativados: ${list}. Nenhum ficheiro foi apagado — os artefactos inativos ficam no sítio e voltam a contar se voltares a adicionar o track. Volta a correr /spec-doctor ${slug}.`,
      restoredSections: (list) => `O track removido cobria estas secções dos tracks que ficam — voltaram ao design.md, por preencher: ${list}.`,
      addedOnCreate: (slug, list) => `'${slug}' já existia — tracks adicionados: ${list} (artefactos, secções de design, steering, tarefas) — nada foi substituído.`,
      designTitle: (name) => `# Design: ${name}`,
      acPlaceholder: (tr) => `[o critério +${tr} que esta tarefa prova]`,
      designSections: (marker) => `design.md (secções ${marker})`,
      addedDesign: "design.md (+secções)",
      addedTasks: "tasks.md (+tarefas)",
      addedActiveTracks: "classification.md (Tracks Ativos)",
      taskBlock: (track, start) => BUILD.pt.trackTasks({ track, start }),
    },

    args: {
      missing: (list) => `Argumento(s) obrigatório(s) em falta: ${list}`,
      invalid: (list) => `Argumento(s) inválido(s): ${list}`,
      item: (arg, expected, got) => `${arg} tem de ser ${expected} (recebido: ${got})`,
      type: { string: "uma string", integer: "um inteiro", number: "um número", boolean: "um booleano (true/false)", array: "um array", object: "um objeto", null: "null" },
      arrayOf: (t) => `um array (cada item ${t})`,
      oneOf: (list) => `um de: ${list}`,
      atLeast: (n) => `≥ ${n}`,
      atMost: (n) => `≤ ${n}`,
      between: (lo, hi) => `entre ${lo} e ${hi}`,
      unknownArgs: (tool, items, valid) => `Argumento${items.length > 1 ? "s" : ""} desconhecido${items.length > 1 ? "s" : ""} para ${tool}: ${items.map((u) => u.argument + (u.didYouMean ? ` (será ${u.didYouMean}?)` : "")).join(", ")} — nada foi feito. ${tool} aceita: ${valid}.`,
      notObject: "arguments tem de ser um objeto JSON.",
      dotdot: "projectDir não pode conter segmentos de caminho '..'.",
      network: (dir) => `projectDir tem de ser uma pasta local — um caminho de rede ou de dispositivo (${dir}) é recusado, para que uma chamada de ferramenta nunca aponte este servidor local para outra máquina; abre o projeto localmente (ou arranca o servidor com ele como pasta de trabalho).`,
      projectMissing: (dir) => `projectDir ${dir}: essa pasta não existe — verifica o caminho (só o spec_init cria a pasta de um projeto).`,
      projectNotDir: (dir) => `projectDir ${dir} é um ficheiro, não uma pasta.`,
      projectUri: (uri) => `projectDir ${uri} não é um URI file:// local de uma pasta (file:///C:/caminho no Windows, file:///caminho nos outros sistemas).`,
      unknownTool: (name) => `Ferramenta desconhecida: ${name} — tools/list lista as ferramentas deste servidor.`,
      noTool: "tools/call precisa de params.name (o nome da ferramenta — ver tools/list).",
      toolFailed: (why) => `A ferramenta falhou: ${why}`,
      tooLarge: (n, max) => `Pedido inválido: uma mensagem de ${n}+ caracteres passa o limite deste servidor, ${max} (DEV_SPEC_MCP_MAX_MESSAGE) — foi ignorada.`,
    },
    jsonShape: {
      invalid: (rel, detail) => `${rel} tem uma estrutura inesperada (${detail}) — corrige-o à mão; não o vou sobrescrever.`,
      topLevel: "o nível de topo tem de ser um objeto",
      features: "'features' tem de ser um objeto",
      featureEntry: (k) => `features.${k} tem de ser um objeto`,
      dependsOn: (k) => `features.${k}.dependsOn tem de ser um array de nomes de features`,
      meta: "'meta' tem de ser um objeto",
      backlog: "'backlog' tem de ser um array",
      backlogEntry: "cada entrada de 'backlog' tem de ser um objeto com 'name'",
      approvals: "'approvals' tem de ser um objeto",
      evidence: "'evidence' tem de ser um objeto",
      tracks: "'tracks' tem de ser um array",
      approvalHistory: "'approvalHistory' tem de ser um array",
      changes: "'changes' tem de ser um array",
      finishChecks: "'finishChecks' tem de ser um objeto",
      signoffs: "'signoffs' tem de ser um objeto",
      unticks: "'unticks' tem de ser um array",
    },
    depend: {
      // 1.23 review 5 — "Precisa de atenção" do ROADMAP.md / .html: um dependsOn que não nomeia nenhuma feature
      roadmapStale: (feature, list, args) => `depende de ${list}, que não é nenhuma feature (uma entrada antiga ou editada à mão em .specs/roadmap.json) — define a lista de novo sem ela: ${DEV_SPEC} depend ${feature} ${args}`,
      unknown: (list) => `Cada dependência tem de ser uma feature existente — não encontrada(s): ${list}`,
    },
    evals: {
      usage: "Uso: node run-evals.js <feature> [--dry-run] [--set-baseline] [--require-live] [--model=ID] [--project=DIR] [--max-items=N]",
      noEvalsDir: (slug, dir) => `Sem pasta evals/ para '${slug}' em ${dir}`,
      requireLive: "harness de evals: a ANTHROPIC_API_KEY não está definida e foi pedido --require-live — recuso fazer um dry run em alternativa.",
      unknownFlag: (flag, suggestion) => `harness de evals: opção desconhecida ${flag}` + (suggestion ? ` — será ${suggestion}?` : "") + " Nada correu.",
      extraArg: (word) => `harness de evals: argumento inesperado '${word}' — uma feature por execução. Nada correu.`,
      header: (slug) => `dev-spec-driven evals — feature '${slug}'`,
      config: (model, prompt, mode) => `  modelo: ${model}   prompt: ${prompt}   modo: ${mode}`,
      none: "(nenhum)",
      modeDry: "DRY-RUN (sem chamadas ao modelo)",
      modeLive: "REAL",
      noKey: "  (ANTHROPIC_API_KEY não definida — a correr a seco. Define-a para uma execução real.)",
      badJson: (set, err) => `  ✗ ${set}.json — JSON inválido: ${err}`,
      badItems: (set) => `  ✗ ${set}.json — 'items' tem de ser um array`,
      emptySet: (set) => `  ✗ ${set}.json — sem itens para avaliar: um conjunto que não avalia nada não pode passar — acrescenta itens de eval (evals/README.md) ou apaga o ficheiro`,
      badItem: (set, label, why) => `  ✗ ${set}.json — item ${label}: ${why}`,
      moreBad: (n) => `      … +${n} item(s) inválido(s)`,
      itemWhy: {
        notObject: "não é um objeto",
        noId: "sem 'id' (texto não vazio)",
        noInput: "sem 'input' (texto não vazio)",
        noExpect: "sem objeto 'expect'",
        unknownType: (t, types) => `tipo de avaliador desconhecido '${t}' (usa ${types})`,
        noValue: (t) => `'${t}' precisa de um 'value'`,
        badRegex: (msg) => `a regex não compila: ${msg}`,
        noRubric: "'judge' precisa de uma 'rubric'",
      },
      badThresholds: (why) => `  ✗ thresholds.json — ${why}`,
      thresholdsShape: "tem de ser um objeto que dá a cada conjunto (golden / adversarial / regression) um número entre 0 e 1",
      capped: (set, max, total) => `  ⚠ ${set}: limitado a ${max}/${total} itens (aumenta com --max-items=N)`,
      wouldRun: (set, n, kinds) => `  • ${set}: ${n} item(ns) — correria ${kinds}`,
      score: (ok, set, pass, n, pct, thr) => `  ${ok ? "✓" : "✗"} ${set}: ${pass}/${n} = ${pct}% (limiar ${thr}%)`,
      failure: (id, detail) => `      - ${id}: ${detail}`,
      error: (msg) => `ERRO ${msg}`,
      resp: (sample) => ` | resposta: ${sample}`,
      fail: "falhou",
      judge: "juiz",
      judgeSkipped: "juiz não usado (heurística aplicada)",
      unknownGrader: (t) => `avaliador desconhecido '${t}'`,
      vsBaseline: "\n  vs baseline:",
      delta: (set, base, cur, sign, pp) => `    ${set}: ${base}% → ${cur}% (${sign}${pp}pp)`,
      baselineWritten: (rel) => `\n  baseline gravada → ${rel}`,
      tokens: (i, o) => `\n  tokens: ${i} de entrada / ${o} de saída`,
      dryInvalid: "\nO dry run encontrou conjunto(s) de evals inválido(s) — corrige-os antes de uma execução real.",
      liveInvalid: "\nConjunto(s) de evals inválido(s) — corrige-os primeiro; nenhum modelo foi chamado.",
      dryOk: "\nDry run concluído — os conjuntos são válidos. Define a ANTHROPIC_API_KEY e volta a correr para obter resultados reais.",
      verdict: (below) => `\nVeredicto: ${below ? "ABAIXO DO LIMIAR ✗" : "todos os conjuntos passam ✓"}`,
      crashed: (msg) => `erro no harness de evals: ${msg}`,
    },

    traceGapText: {
      kinds: {
        uncoveredByTasks: "ACs sem tarefa",
        phantomAcsInTasks: "tarefas referem ACs desconhecidos (erros de escrita?)",
        uncoveredByTests: "ACs sem teste planeado",
        phantomAcsInTests: "o plano de testes cobre ACs desconhecidos (erros de escrita?)",
        phantomTestsInTasks: "tarefas referem testes desconhecidos (erros de escrita?)",
        testsNotMappedToTasks: "testes planeados que nenhuma tarefa põe a verde",
        missingImplFiles: "ficheiros _Implements:_ que não existem",
        unidentifiedCriteria: "critérios sem ID US-<história>.AC-<n> (a rastreabilidade não conta nenhum)",
      },
      gap: (label, list) => `${label}: ${list}`,
      allCovered: (n) => `todos os ${n} ACs cobertos por tarefas`,
      removedKinds: {
        phantomAcsInTasks: "tarefas ainda citam ACs que um pedido de alteração removeu (apaga ou atualiza essas tarefas — não é erro de escrita)",
        phantomAcsInTests: "o plano de testes ainda cobre ACs que um pedido de alteração removeu (apaga ou atualiza essas linhas — não é erro de escrita)",
      },
      removedRef: (id, n) => `${id} (pedido de alteração #${n})`,
    },
    phaseNames: {
      complete: "concluída", executing: "em execução", "tasks-ready": "tarefas prontas", "eval-plan": "plano de evals", "test-plan": "plano de testes",
      design: "design", requirements: "requisitos", classified: "classificada", empty: "vazia",
    },
    featureOps: {
      removeNeedsConfirm: (slug, n) => `Remover '${slug}' apaga .specs/${slug}/ de vez (${n} ficheiro(s)). Nada foi apagado — passa confirm: true para a apagar, ou arquiva-a (reversível).`,
      removeNeedsConfirmLink: (slug) => `.specs/${slug}/ é uma ligação (link simbólico, junction): remover '${slug}' apaga só a ligação — a pasta para onde aponta e os seus ficheiros ficam. Nada foi apagado — passa confirm: true para remover a ligação.`,
      removeChangedSincePreview: (slug) => `Nada foi apagado: .specs/${slug}/ mudou depois de o utilizador ter sido questionado sobre a remoção (outra feature renomeada para este nome, ou ficheiros editados enquanto a pergunta esperava) — a confirmação cobria a pasta que lhe foi mostrada. Pergunta-lhe de novo.`,
      backlogNotFound: (name, known) => `'${name}' não está no backlog${known ? ` (backlog: ${known})` : " (o backlog está vazio)"}.`,
      backlogIsFeature: (name, slug) => `'${name}' já tem uma spec (.specs/${slug}/) — o backlog é para features ainda sem spec (estado: ${DEV_SPEC} status ${slug}).`,
      backlogAppended: (name) => `'${name}' já está no backlog — a nova nota foi acrescentada à sua nota.`,
      backlogKept: (name) => `'${name}' já está no backlog com essa nota — nada mudou.`,
      backlogNoteFull: (name, max) => `'${name}' já está no backlog e a sua nota passaria de ${max} caracteres — a nova nota não foi acrescentada: regista-a com outro nome.`,
      backlogNoteLong: (name, max) => `A nota de '${name}' passa de ${max} caracteres — nada foi acrescentado ao backlog: encurta a nota.`,
    },
    cliOutput: {
      words: { pass: "ok", warn: "aviso", fail: "falha", "gaps-found": "com lacunas", clear: "clara", "needs-clarification": "precisa de clarificação", error: "erro" },
      yes: "sim", no: "não",
      tracks: (label, conf) => `Tracks: ${label}   confiança: ${conf}`,
      note: (n) => `\nNota: ${n}`,
      langHint: (l) => `Idioma: redação em português do Brasil (--lang ${l} no create / init).`,
      created: (dir, lang, files, kept) => `Criado em ${dir} [${lang}]:\n  ${files}` + (kept ? `\n  (já existiam, mantidos: ${kept})` : ""),
      nothingNew: "(nada de novo)",
      steeringCreated: (f) => `Criado ${f}`,
      steeringExists: (f) => `Já existe (não foi alterado) ${f}`,
      feature: (slug, label, lang) => `Feature '${slug}' [${label}] (${lang})`,
      noFeatures: (dir) => `Não há features em ${dir}`,
      listLine: (name, tracks, phase, done, total) => `  ${name.padEnd(28)} [${tracks}]  ${phase}  (${done}/${total} tarefas)`,
      statusHead: (f, tracks, phase) => `Feature: ${f}  [${tracks}]  fase: ${phase}`,
      statusTasks: (done, total, next) => `Tarefas: ${done}/${total}` + (next ? `  próxima → ${next}` : ""),
      doctorHead: (f, tracks, verdict, ready) => `Diagnóstico: ${f}  [${tracks}]  veredicto=${verdict}  pronta para avançar: ${ready}`,
      traceHead: (f, verdict, acs, covered) => `Rastreabilidade: ${f}  veredicto=${verdict}  ACs=${acs}  cobertos por tarefas=${covered}`,
      earsHead: (n, m, verdict) => `EARS: ${n} critérios, ${m} com verbo modal, veredicto=${verdict}`,
      next: (n, text, left, total) => `Próxima → #${n} ${text}  (faltam ${left}/${total})`,
      allDone: "Todas as tarefas feitas ✓",
      batch: (list) => `  lote paralelo: ${list}`,
      mergeSummaryAt: (p) => `\nResumo do merge → ${p}`,
      briefAt: (p, inline) => `Brief → ${p}` + (inline ? "  (só inline: tarefa de prompt +ai)" : ""),
      reportAt: (p) => `  relatório → ${p}`,
      ledgerAt: (p) => `  ledger → ${p}`,
      unresolved: (list) => `  ⚠ por resolver: ${list}`,
      approved: (phase, f) => `Fase '${phase}' de ${f} aprovada ✓`,
      backlogHead: (n) => `Backlog (${n}):`,
      backlogAdded: (name) => `✓ '${name}' adicionada ao backlog`,
      backlogRemoved: (name) => `✓ '${name}' removida do backlog`,
      wrote: (file, pct, c, t) => `✎ gerado ${file}` + (pct != null ? `  (${pct}%, ${c}/${t})` : ""),
      noRoadmapFeatures: (dir) => `Ainda não há features em ${dir}`,
      roadmapHead: (pct, c, t, cycle) => `Roadmap — progresso global ${pct}%  (${c}/${t} completas)` + (cycle ? `  ⚠ CICLO: ${cycle}` : ""),
      deps: (list, unmet) => `  deps: ${list}` + (unmet ? ` (por cumprir: ${unmet})` : ""),
      scanHead: (root, truncated) => `Análise de ${root}` + (truncated ? " (truncada no limite)" : ""),
      scanFiles: (n, stack) => `  ficheiros: ${n}  | stack: ${stack || "desconhecida"}`,
      scanDirs: (list) => `  pastas de topo: ${list}`,
      scanExt: (list) => `  por extensão: ${list}`,
      scanEndpoints: (n, files) => `  endpoints: ${n} rota(s) em ${files} ficheiro(s)`,
      coverage: (pct, d, t) => `Cobertura de specs: ${pct}%  (${d}/${t} ficheiros de código nomeados em _Implements:_)`,
      undocumented: (list) => `  pastas sem cobertura: ${list}`,
      clarify: (f, tracks, verdict, n) => `Clarificar: ${f}  [${tracks}]  → ${verdict} (${n} pergunta(s))`,
      naHead: (f, tracks, phase, verdict, gatesOk) => `Feature: ${f}  [${tracks}]  fase: ${phase}  veredicto=${verdict}  gates aprovados: ${gatesOk}`,
      changed: (list) => `  ⚠ alterado desde a última aprovação: ${list}`,
      renamed: (a, b) => `'${a}' renomeada → '${b}' ✓`,
      archived: (f, dest) => `'${f}' arquivada → .specs/${dest} ✓`,
      removed: (f) => `'${f}' removida ✓`,
      wouldRemove: (slug, dir, n, entries) => `Isto apagaria '${slug}' de vez: ${dir} (${n} ficheiro(s): ${entries})`,
      confirmHint: (slug) => `Nada foi apagado. Volta a correr com --yes para confirmar — ou arquiva-a: ${DEV_SPEC} feature archive ${slug}`,
      missingValue: (flag) => `falta o valor de --${flag}`,
      unknownFlag: (flag, suggestion) => `opção desconhecida ${flag}` + (suggestion ? ` — será ${suggestion}?` : ".") + " As opções estão em `" + DEV_SPEC + " help`.",
      unknownRules: (tool, known) => `ferramenta desconhecida '${tool}'. Conhecidas: ${known}`,
      bundleWrote: (file, n, kb) => `Escrito ${file} — o motor num só ficheiro (${n} módulos, ${kb} KB).`,
      bundleUse: (custom) => `Com DEV_SPEC_BUNDLE=1${custom ? ` e DEV_SPEC_BUNDLE_PATH=${custom}` : ""} no ambiente com que o Claude Code / o teu cliente MCP arranca, o motor passa a ser carregado deste ficheiro. Após cada atualização do plugin, gera um bundle novo: um bundle desatualizado é ignorado e os módulos são carregados.`,
      scaleSections: (list) => `Secções de escala: ${list}`,
      aiSections: (list) => `Secções de IA: ${list}`,
      dependsOn: (f, deps, order, unknown) => `${f} depende de: ${deps || "(nenhuma)"}` + (order != null ? `  ordem=${order}` : "") + (unknown ? `  ⚠ dependências desconhecidas: ${unknown}` : ""),
      trackNow: (f, tracks) => `'${f}' agora [${tracks}]`,
      usage: (syntax) => `uso: ${syntax}`,
      unknownCommand: (c) => `comando desconhecido '${c}'. Corre \`${DEV_SPEC} help\`.`,
      unknownClient: (c, known) => `cliente desconhecido '${c}'. Conhecidos: ${known}`,
      noJson: (c) => `--json não está disponível para '${c}': só imprime texto. Corre-o sem --json.`,
      flagNotFor: (flag, c, list) => `${flag} não é uma opção de '${c}'` + (list ? ` (as suas opções: ${list})` : " (não tem nenhuma)") + `. Corre \`${DEV_SPEC} help\`.`,
      extraArgs: (c, extra) => `'${c}' recebeu argumento(s) inesperado(s): ${extra}. Corre \`${DEV_SPEC} help\` para ver a sintaxe.`,
      needsRun: (flag) => `${flag} só se aplica com --run (como os comandos correm) — junta --run, ou retira ${flag}.`,
      runOrEvidence: "--run regista a execução que faz; --evidence / --exit / --cmd relatam uma execução feita noutro lado — passa uma coisa ou a outra.",
      projectEmpty: "--project está vazio — indica a pasta do projeto, ou omite --project (a pasta mais próxima acima desta com uma .specs/, senão esta).",
      projectUnexpanded: (v) => `--project ${v} contém uma variável que nunca foi expandida — passa a própria pasta.`,
      projectMissing: (dir) => `--project ${dir}: essa pasta não existe — verifica o caminho (só o init cria a pasta de um projeto).`,
      projectNotDir: (dir) => `--project ${dir} é um ficheiro, não uma pasta.`,
      projectEnvMissing: (name, dir) => `${name}=${dir}: essa pasta não existe — corrige a variável ou remove-a (só o init cria a pasta de um projeto).`,
      projectEnvNotDir: (name, dir) => `${name}=${dir} é um ficheiro, não uma pasta — corrige a variável ou remove-a.`,
      projectIsSpecs: (label, parent) => `${label} é a pasta .specs do projeto ${parent} — indica a própria pasta do projeto: ${parent}`,
      version: {
        head: (v) => `dev-spec-driven ${v || "(versão desconhecida)"}`,
        cli: (f) => `  CLI:      ${f}`,
        node: (v) => `  Node.js:  ${v}`,
        engineModules: "  motor:    os seus módulos (mcp/lib/engine/)",
        engineBundle: (f) => `  motor:    o bundle num só ficheiro ${f} (DEV_SPEC_BUNDLE=1)`,
        engineSkipped: (f, why) => `  motor:    os seus módulos — DEV_SPEC_BUNDLE=1, mas o bundle ${f} foi ignorado: ${why}`,
        skip: { missing: "esse ficheiro não existe", "other-version": "foi gerado para outra versão", stale: "um módulo mudou depois de ser gerado", broken: "não foi possível carregá-lo" },
        rebuild: (cmd) => `            → ${cmd}`,
        pathIgnored: "  (DEV_SPEC_BUNDLE_PATH ignorado: não é o caminho absoluto de um ficheiro .js)",
        project: (dir, src) => `  projeto:  ${dir} — ${src}`,
        src: { flag: "indicado com --project", SPEC_PROJECT_DIR: "indicado por SPEC_PROJECT_DIR", CLAUDE_PROJECT_DIR: "indicado por CLAUDE_PROJECT_DIR", nearest: "a pasta mais próxima acima desta com uma .specs/ do dev-spec", cwd: "a pasta de trabalho" },
        state: {
          devSpec: (lang) => `            um projeto dev-spec · idioma: ${lang}`,
          noSpecs: (lang) => `            ainda sem .specs/ do dev-spec (o init cria-a) · idioma: ${lang}`,
          missing: "            a pasta não existe (o init cria-a)",
        },
      },
      cmdHelp: {
        options: (list) => `  As suas opções: ${list}`,
        none: "  Não tem opções próprias.",
        global: "  Em todos os comandos: --json · --project <pasta> · --help (-h) · --version (-V)",
        all: `  Todos os comandos e os detalhes: ${DEV_SPEC} help`,
      },
      stdinHint: "a ler do terminal — escreve ou cola o texto e depois Ctrl+D numa linha à parte (Windows: Ctrl+Z e Enter).",
      earsNoFile: (file) => `${file}: esse ficheiro não existe — o ears recebe o nome de uma feature, um ficheiro markdown, --text "…" ou - (stdin).`,
      bundleNotOurs: (file) => `${file} já existe e não é um bundle do dev-spec — nada foi escrito. Escolhe outro --out, ou junta --force para o substituir.`,
      flagTwice: (flag) => `${flag} foi indicada mais de uma vez — esta opção só aceita um valor: indica-a uma vez.`,
      atMost: (n) => `, no máximo ${n}`,
      runHeldOpen: (code) => `⚠ o comando terminou (${code}), mas um processo que ele lançou em segundo plano manteve a saída aberta — a execução ficou registada nesse fim; o que esse processo imprimir depois não está na evidência.`,
      completionGone: (cli) => `${cli} já não existe e não foi encontrada uma cópia mais recente do plugin — guarda de novo o script de completação a partir da CLI atual (o completion --help dela explica como), ou retira-o do perfil da tua shell.`,
    },

    gates: {
      empty: "sem conteúdo além dos títulos",
      more: (n) => `+${n} mais`,
      placeholdersNone: "nenhum placeholder do template na fase atual",
      placeholdersFail: (list) => `placeholders do template por preencher na fase atual (ou numa anterior): ${list}`,
      placeholdersLater: (list) => `as fases seguintes ainda são template (ainda não bloqueia): ${list}`,
      traceDeferred: (files) => `ainda não rastreado — ainda é o template de uma fase seguinte: ${files} (as referências do template não são erros de escrita nem bloqueiam esta fase); rastreado quando for escrito`,
      earsPlaceholder: (list) => `O critério ainda tem placeholder(s) do template ${list} — escreve o gatilho/comportamento real.`,
      constitutionUnfilled: "a secção Verificação da Constituição está em falta ou por preencher",
      checkLine: (id, detail) => `  ✗ ${id}${detail ? " — " + detail : ""}`,
      approveRefused: (phase, slug, ids, lines) => `Não é possível aprovar '${phase}' de '${slug}' — verificações a falhar: ${ids}.\n${lines}\nCorrige-as (detalhes: /spec-doctor ${slug}), ou passa force: true (CLI: --force) para registar a aprovação mesmo assim — fica assinalada como forçada.`,
      approveNothing: (phase, slug, file) => `Nada para aprovar: '${phase}' não tem artefacto em '${slug}' (${file} não existe, ou o track está desativado) — nem com force.`,
      approveUnreadable: (phase, slug, file) => `Nada para aprovar: ${file} em '${slug}' não pode ser lido (uma pasta com esse nome, sem permissão, ou outro programa a usá-lo) — torna-o um ficheiro legível e depois aprova '${phase}'.`,
      approveForced: (ids) => `Aprovado com force — as verificações a falhar ficam registadas com a aprovação: ${ids}.`,
      phaseOrder: (list, slug, first) => `há fases anteriores ainda por aprovar: ${list} — aprova-as primeiro, por ordem (/approve ${slug} ${first})`,
      phaseOrderChanged: (list, slug, first) => `há fases anteriores alteradas desde a sua aprovação: ${list} — revê-as (spec_impact) e volta a aprová-las primeiro, por ordem (/approve ${slug} ${first})`,
      roadmapUnreadable: (detail) => `${detail} Nada registado: os papéis de aprovação e as verificações do projeto que este ficheiro guarda não podem ser lidos — aprovações, revogações e o spec_finish recusam até ser reparado (marcadores de conflito de um merge? resolve-os; ${DEV_SPEC} merge-state --install passa a juntá-lo pelo significado).`,
      roadmapCheck: (detail) => `${detail} Os papéis de aprovação e as verificações do projeto que guarda não podem ser lidos: aprovações, revogações e o spec_finish recusam até ser reparado.`,
      forcedGates: (list) => `aprovado com force apesar de verificações a falhar: ${list}`,
      finishRootCause: "bug.md → Causa Raiz por preencher — nenhuma correção antes de se conhecer a causa",
      finishPlaceholders: (list) => `placeholders do template por preencher na cadeia da spec: ${list}`,
      finishChanged: (list) => `alterados depois da aprovação (rever e voltar a aprovar): ${list}`,
      bugGate: (n, first) => `A tarefa ${n} ainda não pode ser concluída: bug.md → Causa Raiz está por preencher. Nenhuma correção antes de a causa raiz estar escrita no bug.md — faz primeiro a tarefa ${first} (encontra a causa raiz com evidência e escreve-a lá).`,
      bugGateFirst: (n, first) => `A tarefa ${n} ainda não pode ser concluída: bug.md → Causa Raiz está por preencher e nenhuma tarefa a escreve — só a tarefa ${first} pode ser concluída até a causa raiz estar escrita no bug.md (nenhuma correção antes da causa raiz).`,
      bugGateTicked: (n, rc) => `A tarefa ${n} ainda não pode ser concluída: bug.md → Causa Raiz continua vazia — a tarefa ${rc} está marcada, mas o que ela entrega é essa secção. Escreve lá a causa raiz, com a evidência (nenhuma correção antes de a causa raiz estar escrita no bug.md).`,
      rootCauseTaskEmpty: (n) => `A tarefa ${n} está marcada, mas bug.md → Causa Raiz continua vazia — escreve lá a causa raiz, com a evidência: as tarefas seguintes (o teste de regressão, a correção) continuam recusadas até estar escrita.`,
      fill: (file, what, hint) => `Preenche ${file} — ${what}; depois ${hint}.`,
      fillMissing: "ainda não existe",
      fillEmpty: "não tem conteúdo além dos títulos",
      fillPlaceholders: (n, first) => `${n} placeholder(s) do template por preencher (primeiro: ${first})`,
      fillHint: {
        "classification.md": (slug) => `confirma os tracks e escreve o raio de impacto e as etiquetas de conformidade (/classify ${slug}), depois /approve ${slug} classification`,
        "requirements.md": (slug) => `verifica-o com /clarify ${slug} e ears_validate (${DEV_SPEC} ears ${slug})`,
        "bug.md": (slug) => `escreve a Reprodução e a Causa Raiz com evidência (/spec-doctor ${slug})`,
        "design.md": (slug) => `corre /spec-doctor ${slug} (secções obrigatórias, Verificação da Constituição)`,
        "test-plan.md": (slug) => `verifica a cobertura dos ACs com trace_check (${DEV_SPEC} trace ${slug})`,
        "eval-plan.md": (slug) => `define os limiares e a baseline, depois /spec-doctor ${slug}`,
        "tasks.md": (slug) => `divide o design em tarefas reais (/createTask ${slug}), depois trace_check`,
        "change.md": (slug) => `escrever o resumo, 1–3 critérios EARS, a abordagem e 1–3 tarefas, cada uma com um comando _Verify:_, e depois aprovar o plano numa só chamada — spec_approve {name: "${slug}", through: "tasks"} (/spec-ff ${slug})`,
        default: (slug) => `/spec-doctor ${slug}`,
      },
      approveClassification: (slug) => `Confirma e aprova a classificação — /approve ${slug} classification.`,
      fixGate: (phase, list, slug) => `Antes de aprovar '${phase}', corrige o que o gate de aprovação recusaria: ${list} — depois /approve ${slug} ${phase}.`,
      gateWouldRefuse: (phase, ids) => `aprovar '${phase}' seria recusado (${ids})`,
      noRealTasks: "só as tarefas do template — divide o design em pelo menos uma tarefa real tua",
      testsNotInCode: (list) => `testes planeados que nenhum ficheiro de teste nomeia ainda: ${list} — escreve cada teste a falhar com o seu T-ID no nome (trace_check {code: true} encontra-os)`,
      testsNotInCodeSignOff: (list) => `testes planeados que nenhum ficheiro de teste nomeia ainda: ${list} — a implementação já começou: confirma que cada um existe com o seu T-ID no nome do teste (test("T-01 …")) para que o trace_check {code: true} o encontre`,
      noPlannedTests: "o test-plan.md não lista nenhum T-ID — planeia os testes primeiro",
      evalSetsSample: "o evals/golden.json ainda é o conjunto de exemplo do scaffold — escreve os casos golden desta feature, corre o harness e regista a baseline",
      evalSetsMissing: "o evals/golden.json não existe ou não tem itens de eval ({\"items\": […]}) — escreve primeiro o conjunto golden desta feature",
      testsGateChecks: (ids) => `(o gate de aprovação verifica isto: ${ids})`,
      testsStale: (day, missing, plans) => `A aprovação da Fase 4 de ${day} já não cobre o plano (${[missing ? `planeados depois: ${missing}` : null, plans ? `aprovação alterada depois: ${plans}` : null].filter(Boolean).join("; ")}) — a fase tests tem de ser aprovada de novo.`,
      changedSincePreview: (phase, slug, grown) => (grown
        ? `Nada registado: desde que se pediu ao utilizador para confirmar '${phase}' de '${slug}', o gate falha mais verificações (${grown}) do que a pergunta indicava — volta a pedir a confirmação ao utilizador.`
        : `Nada registado: '${phase}' de '${slug}' mudou depois de se pedir ao utilizador para a confirmar — a confirmação cobria a versão que lhe foi mostrada. Volta a pedir a confirmação ao utilizador, para que confirme o que existe agora.`),
      clarifyPlaceholders: (file, n, list) => `Substitui os ${n} placeholder(s)/TBD do template em ${file}: ${list}`,
      hookPlaceholders: (n, list, file = "requirements.md") => `Placeholders do template: ${n} por preencher em ${file} (${list}) — substitui-os antes de aprovar ${file === "change.md" ? "o plano" : "os requisitos"}.`,
    },

    brownfield: {
      notFolder: (p) => `${p} não é uma pasta (não existe, ou é um ficheiro) — nada para analisar; verifica o caminho.`,
      frameworks: (list) => `  frameworks: ${list}`,
      routeLine: (method, p, loc) => `    ${method.padEnd(7)} ${p}  (${loc})`,
      moreRoutes: (n) => `    … mais ${n} (--json lista-as, até ao limite)`,
      routesTruncated: (shown, total) => `A mostrar as primeiras ${shown} de ${total} rotas — a contagem de endpoints inclui todas.`,
      readCapped: (n) => `Só foram lidos os primeiros ${n} ficheiros de código (rotas, nomes de variáveis de ambiente, pistas de testes) — essas listas podem estar incompletas.`,
      tests: (n, fws) => `  testes: ${n} ficheiro(s) · frameworks: ${fws}`,
      entrypoints: (list) => `  pontos de entrada: ${list}`,
      env: (list, more) => `  variáveis de ambiente (só nomes): ${list}` + (more ? ` … +${more}` : ""),
      migrations: (n, dirs) => `  migrações/esquema: ${n} ficheiro(s)` + (dirs ? ` — ${dirs}` : ""),
      none: "nenhum",
      coverageTests: (n) => `  ficheiros de teste (à parte, não contam): ${n}`,
      coverageFolder: (folder, covered, files, pct) => `  ${folder.padEnd(24)} ${String(covered + "/" + files).padStart(9)}  ${pct}%`,
      root: "(raiz)",
      coverageUnmatched: (list) => `  ⚠ entradas _Implements:_ que não nomeiam nada no disco: ${list}`,
      coverageNonCode: (list) => `  · entradas _Implements:_ que nomeiam testes ou ficheiros que não são código (não contam): ${list}`,
      integrationPlanPlaceholder: "integration-plan.md ainda é o template — preenche os pontos de integração, as modificações e os riscos antes de implementar",
      integrationPlanOk: "plano de integração preenchido",
    },
    importSpec: {
      note: (tool, rel, date) => `> Importado de ${tool} \`${rel}\` em ${date}.`,
      unknownTool: (tool, known) => `Formato de spec desconhecido '${tool}'. Conhecidos: ${known}.`,
      pathRequired: "falta o caminho — a pasta (ou um ficheiro) da spec a importar.",
      outside: (p) => `'${p}' está fora do projeto — o spec_import só lê dentro da pasta do projeto.`,
      notFound: (p) => `'${p}' não encontrado.`,
      nothing: (tool, p) => `Não foram encontrados ficheiros de spec ${tool} em '${p}'.`,
      exists: (slug) => `A feature '${slug}' já existe — a importação nunca a substitui. Indica outro nome.`,
      tooLarge: (rel, max) => `${rel} tem mais de ${max} caracteres — demasiado grande para importar inteiro (a parte além do limite, incluindo os passos de um plano, perder-se-ia). Divide-o ou encurta-o e importa de novo; nada foi criado.`,
      noUsableTitle: (title) => `O título do documento '${title}' não tem caracteres utilizáveis (a-z, 0-9) para nome de pasta — indica o nome da feature (name; CLI: --name "<feature>").`,
      featureTitle: (name) => `# Feature: ${name}`,
      tasksTitle: (name) => `# Tasks: ${name}`,
      summary: "## Resumo",
      summaryPlaceholder: "[1-2 frases: o que faz e porque importa]",
      stories: "## Histórias de Utilizador",
      story: (n, pri, title) => `### US-${n}${pri ? ` (${pri})` : ""}: ${title}`,
      criteria: "#### Critérios de Aceitação (EARS)",
      functional: "## Requisitos Funcionais",
      entities: "## Entidades-Chave",
      success: "## Critérios de Sucesso",
      edge: "## Casos Limite e Tratamento de Erros",
      original: (tool, text) => `<!-- ${tool}: ${text} -->`,
      notEars: "[NEEDS CLARIFICATION: ainda não é uma frase EARS — acrescenta o gatilho (QUANDO/SE) e a resposta do sistema]",
      noCriteria: "[NEEDS CLARIFICATION: esta história não tem critérios de aceitação]",
      optional: "(opcional)",
      modified: "(modificado)",
      importedNotes: "## Notas importadas",
      otherTasks: "## Outras tarefas",
      ears: { while: "ENQUANTO", when: "QUANDO", if: "SE", where: "ONDE", then: "ENTÃO", shall: "O SISTEMA DEVE", not: "NÃO", ensure: "O SISTEMA DEVE garantir que" },
      wNotEars: (ids) => `não convertidos para EARS (texto mantido, marcado [NEEDS CLARIFICATION]): ${ids}`,
      wNoCriteria: (ids) => `histórias sem critérios de aceitação: ${ids}`,
      wNoCriteriaAtAll: "a origem não tem critérios de aceitação — o requirements.md ainda não define nenhum AC: escreve-os antes de aprovar os requisitos (até lá, um plano de testes +tdd recebe uma linha genérica)",
      wUnknownRef: (task, ref) => `tarefa ${task}: a referência _Requirements:_ '${ref}' não corresponde a nenhum critério importado — mantida como estava`,
      wUnknownRefLine: (line, ref) => `tasks.md, linha ${line}: a referência _Requirements:_ '${ref}' não corresponde a nenhum critério importado — mantida como estava`,
      wCarried: (list) => `copiado tal como estava, sem correspondência com histórias ou critérios (revê-o): ${list}`,
      wNoRefs: "as tarefas importadas não têm referências _Requirements:_ — acrescenta-as para o trace_check associar cada AC a uma tarefa",
      wNoTasks: "a origem não tem tasks.md — foi mantido o tasks.md do scaffold (os _Requirements:_ / _Makes green:_ do template limitados aos critérios importados)",
      taskAcPlaceholder: "[um critério importado que esta tarefa prova]",
      taskTestPlaceholder: "[o teste planeado que esta tarefa põe a verde]",
      wNoDesign: (file) => `a origem não tem ${file} — foi mantido o design.md do scaffold`,
      wNoRequirements: (file) => `não foram encontrados requisitos em ${file}`,
      wRemoved: (name) => `o requisito REMOVED '${name}' não foi importado`,
      wRenamed: (from, to) => `requisito RENAMED '${from}' → '${to}' (importado com o nome novo)`,
      wSkipped: (files) => `não importados (ficam onde estão): ${files}`,
      skDocs: { research: "Investigação", dataModel: "Modelo de dados", contracts: "Contratos", quickstart: "Arranque rápido" },
      skFrom: (file) => `> Do spec-kit \`${file}\`.`,
      wNoPlanDocs: (file) => `não há ${file} na origem — o design.md tem os documentos de design encontrados ao lado (investigação, modelo de dados, contratos, arranque rápido) sem o plano`,
      wUnreadable: (file) => `${file} aponta para fora do projeto — ignorado`,
      done: (tool, rel, slug, label, lang) => `Importado de ${tool} ${rel} → feature '${slug}' [${label}] (${lang})`,
      mapping: (n, sample) => `  correspondência: ${n} ID(s)` + (sample ? ` — ${sample}` : ""),
    },

    importSteering: {
      note: (tool, rel, date) => `<!-- Importado de ${tool} ${rel} em ${date}. -->`,
      nothing: (tool, where) => `Não foram encontrados ficheiros ${tool} em ${where}.`,
      featureArgs: (args, tool) => `${args}: uma importação ${tool} escreve ficheiros em .specs/steering/, não uma feature — omite-o.`,
      skipped: (from, why) => `${from}: não importado — ${why}`,
      reasons: {
        exists: (file) => `.specs/steering/${file} já existe (nunca é substituído — renomeia-o ou apaga-o e importa de novo)`,
        template: (file) => `.specs/steering/${file} já existe — ainda é o modelo que o spec_init escreveu: apaga-o e importa de novo (nunca é substituído)`,
        duplicate: (file) => `outro ficheiro desta importação já deu ${file}`,
        name: () => "o nome não tem caracteres utilizáveis (a-z, 0-9) para um ficheiro de steering",
        "too-large": (file, max) => `tem mais de ${max} caracteres`,
        empty: () => "não tem conteúdo",
        outside: () => "aponta para fora do projeto",
        unreadable: () => "não é um ficheiro legível",
        own: () => "é o ficheiro de regras do próprio dev-spec (escrito por `rules cursor`), não steering do projeto",
      },
      wOthers: (list) => `não importado (não é um ficheiro de steering; uma subpasta importa-se pelo seu próprio caminho): ${list}`,
      wMode: (from, mode) => `${from}: inclusion '${mode}' não tem equivalente no dev-spec — lido como manual (o brief de uma tarefa lista-o como disponível a pedido)`,
      wGlobs: (from, list) => `${from}: glob(s) com os dois tipos de aspas deixados fora do fileMatchPattern: ${list}`,
      wLimit: (n, max) => `mais ${n} ficheiro(s) não importado(s) — uma importação aceita no máximo ${max}; importa o resto pelo caminho`,
      done: (tool, n, m) => `Importado de ${tool} → ${n} ficheiro(s) de steering em .specs/steering/` + (m ? `, ${m} ignorado(s)` : ""),
      line: (file, from, inclusion, patterns) => `  ${file} ← ${from} (${inclusion}${patterns ? ": " + patterns : ""})`,
      dryRun: "Simulação — nada foi escrito.",
      would: (tool, rel, slug, label, lang) => `Importaria de ${tool} ${rel} → feature '${slug}' [${label}] (${lang})`,
      wouldSteering: (tool, n, m) => `Importaria de ${tool} → ${n} ficheiro(s) de steering em .specs/steering/` + (m ? `, ${m} ignorado(s)` : ""),
      counts: (c) => `  ${c.stories} história(s), ${c.criteria} critério(s), ${c.tasks} tarefa(s), ${c.decisions} decisão(ões)`,
      previewFile: (file, chars, cut) => `  ${file} — ${chars} caracteres${cut ? " (pré-visualização cortada)" : ""}`,
      jsonHint: "--json mostra o conteúdo de cada ficheiro (uma pré-visualização limitada).",
    },

    appendTasks: {
      heading: "Fase: Convergência",
      checkpoint: "as tarefas de convergência estão concluídas e verificadas — a spec e o código voltam a coincidir.",
      noTasks: "Indica pelo menos uma tarefa: tasks = [{ text, requirements?, implements?, verify?, makesGreen?, expectFail?, size?, depends?, story?, parallel? }].",
      noText: (i) => `Tarefa ${i}: o texto é obrigatório.`,
      badStory: (i, v) => `Tarefa ${i}: story tem de ser US<n> (ex.: US1) ou shared (recebido '${v}').`,
      badPath: (i, p) => `Tarefa ${i}: os caminhos de _Implements:_ têm de ser relativos à raiz do projeto, sem '..' (recebido '${p}').`,
      badVerify: (i) => `Tarefa ${i}: _Verify:_ tem de ser um comando numa só linha.`,
      placeholderVerify: (i, v) => `Tarefa ${i}: '${v}' lê-se como um marcador de posição, não como um comando (um _Verify:_ entre [parênteses retos] é ignorado) — indica o comando real (para um teste de shell, 'test …' em vez de '[ … ]').`,
      unstorable: (i, marker) => `Tarefa ${i}: o seu ${marker} não seria lido de tasks.md tal como foi dado — mantém os marcadores fora do texto da tarefa, ',' e ';' fora dos caminhos, e '_ ' fora dos caminhos e dos comandos.`,
      phantom: (list, file = "requirements.md") => `Critérios de aceitação desconhecidos (não estão em ${file}): ${list}. Nada foi escrito — corrige os IDs ou acrescenta primeiro os critérios.`,
      badHeading: "o cabeçalho tem de ser uma só linha de texto.",
      constraintsHeading: (h) => `'${h}' contém as restrições que todas as tarefas respeitam, não tarefas — escolhe um cabeçalho de fase. Nada foi escrito.`,
      inactiveHeading: (h, track) => `'${h}' é a secção de tarefas do track ${track}, que está inativo — volta a adicionar o track ou escolhe outro cabeçalho. Nada foi escrito.`,
      unsafe: (n) => `Não foi possível acrescentar com segurança: ${n ? `a tarefa ${n} não seria lida tal como foi escrita` : "as tarefas existentes mudariam"} (um comentário ou bloco de código por fechar perto do fim da fase?). Nada foi escrito.`,
      reapprove: (slug, file = "tasks.md") => `O ${file} mudou depois da sua aprovação — revê as novas tarefas e volta a aprovar: /approve ${slug} tasks.`,
      appended: (heading, created, file = "tasks.md") => `Acrescentado a ${file} → '${heading}'${created ? " (nova fase)" : ""}:`,
      oneTaskPerCall: "append-tasks aceita um --task por chamada — volta a corrê-lo para a tarefa seguinte (spec_append_tasks aceita uma lista).",
      oneValue: (flag) => `append-tasks aceita --${flag} uma só vez por chamada — ${flag === "verify" ? "junta as verificações num só comando (a && b)" : "indica um único valor"}. Nada foi escrito.`,
      badSize: (i, v) => `Tarefa ${i}: size tem de ser um de XS, S, M, L, XL (recebido '${v}').`,
      badTestId: (i, v) => `Tarefa ${i}: makesGreen aceita IDs de testes planeados (T-01, T-2 …) (recebido '${v}').`,
      phantomTests: (list) => `Testes desconhecidos (não planeados em test-plan.md): ${list}. Nada foi escrito — corrige os T-IDs ou planeia primeiro os testes.`,
      noTestPlan: (slug) => `makesGreen precisa de um plano de testes: .specs/${slug}/test-plan.md não existe (adiciona primeiro o +tdd). Nada foi escrito.`,
    },

    taskDeps: {
      doctorOk: (n) => `${n} tarefa(s) declaram _Depends:_ — cada uma nomeia uma tarefa ativa, sem ciclos`,
      doctorFail: (list) => `${list} — corrige os marcadores _Depends:_ no tasks.md (números de tarefas do mesmo tasks.md: \`_Depends: 3, 5_\`)`,
      invalid: (n, tok) => `tarefa ${n}: _Depends:_ '${tok}' não é um número de tarefa`,
      phantom: (n, d) => `a tarefa ${n} depende da #${d}, que nenhuma tarefa ativa tem`,
      self: (n) => `a tarefa ${n} depende de si mesma`,
      cycle: (list) => `tarefas que esperam umas pelas outras (um ciclo): ${list}`,
      roadmapBlocked: (list) => `nenhuma tarefa aberta pode começar (dependências entre tarefas): ${list}`,
      waitLine: (n, deps) => `#${n} espera por ${deps}`,
      blocked: (list, slug) => `Nenhuma tarefa por fazer pode começar — cada uma espera por uma dependência que não está feita: ${list}. Um ciclo ou um _Depends:_ que não nomeia nenhuma tarefa nunca se resolve: corrige os marcadores _Depends:_ em .specs/${slug}/tasks.md (/spec-doctor ${slug} → task-deps).`,
      tickedEarly: (n, list) => `A tarefa ${n} foi marcada com as dependências ${list} ainda não concluídas — ficou marcada como pedido (uma marcação reflete o que aconteceu); confirma que não precisava do trabalho delas, ou conclui-as a seguir.`,
      briefHeading: "## Depende de",
      briefStatus: { done: "feita", open: "por fazer", missing: "não existe" },
      briefOpenNote: "⚠ Algumas ainda não estão concluídas — esta tarefa foi planeada para começar depois delas: responde NEEDS_CONTEXT se precisar do resultado delas.",
      badDepends: (i, v) => `Tarefa ${i}: depends aceita números de tarefa (3 ou #3) (recebido '${v}').`,
      selfDepends: (i, n) => `A tarefa ${i} tem aqui o número ${n} e dependeria de si mesma. Nada foi escrito.`,
      phantomDepends: (i, list, first, last) => `Tarefa ${i}: depends não nomeia nenhuma tarefa: ${list} — indica o número de uma tarefa ativa, ou de uma tarefa desta chamada (aqui numeradas ${first === last ? first : first + "–" + last}). Nada foi escrito.`,
      cycleDepends: (list) => `As dependências formariam um ciclo: ${list}. Nada foi escrito.`,
      cliWaves: (n) => `Ondas (${n}):`,
      cliWave: (k, list) => `  ${k}. ${list}`,
      cliNoWave: "  (nenhuma tarefa por fazer pode começar)",
      cliCycles: (list) => `  ⚠ ciclo: ${list}`,
      cliBlocked: (list) => `  ⚠ bloqueadas: ${list}`,
      cliSkipped: (list) => `  à espera: ${list}`,
    },

    impact: {
      badPhase: (p, known) => `Fase '${p}' desconhecida para spec_impact. Conhecidas: ${known}.`,
      reopenTasks: "reopen aplica-se a requirements, design, test-plan e eval-plan — uma alteração ao tasks.md revê-se e volta a aprovar-se; não reabre nada.",
      changePhase: (phase, slug) => `'${slug}' é uma alteração: os seus critérios e as suas tarefas são um só ficheiro, change.md, aprovado como o plano (fase tasks) — não há fase ${phase}. spec_impact {name: "${slug}"} (fase tasks, a predefinida) compara os dois: os critérios por ID, as tarefas por número.`,
      retireTests: {
        retireHint: (list, slug, phase, offer) => `Testes removidos que tarefas ainda põem a verde — ${list}: não refaças essas tarefas; tira o T-ID do _Makes green:_ delas ou aponta-o para o teste que o substitui.` +
          (offer ? ` --reopen regista o pedido de alteração sem as desmarcar (${DEV_SPEC} impact ${slug} --phase ${phase} --reopen).` : ""),
        retireNote: (list) => `Testes removidos não se refazem — ainda nomeados em _Makes green:_: ${list}: tira o T-ID dessas tarefas, ou aponta-o para o teste que o substitui.`,
        recordedRetire: (n, list, slug, phase) => `Pedido de alteração #${n} registado — nada desmarcado: as tarefas de um teste removido não se refazem. Ainda nomeados em _Makes green:_: ${list}: tira o T-ID dessas tarefas, ou aponta-o para o teste que o substitui; depois volta a aprovar: /approve ${slug} ${phase}.`,
      },
      missing: (file, slug) => `${file} não encontrado em '${slug}' — nada para comparar.`,
      neverApproved: (phase, slug) => `'${phase}' nunca foi aprovada em '${slug}' — não há versão aprovada com que comparar. Aprova-a primeiro: /approve ${slug} ${phase}.`,
      fingerprintOnly: (phase, slug) => `Esta aprovação é anterior ao histórico de alterações: só ficou registada a sua impressão digital, por isso não é possível listar o que mudou. Volta a aprovar para iniciar o histórico: /approve ${slug} ${phase}.`,
      noFingerprint: (phase, slug) => `Esta aprovação é anterior às impressões digitais de conteúdo: nada da versão aprovada ficou registado, por isso não é possível dizer se mudou nem o quê (a data de um ficheiro não é prova — um clone ou uma cópia repõe-na). Volta a aprovar para a começar a seguir: /approve ${slug} ${phase}.`,
      reopenNeedsSnapshot: (phase) => `Nada foi reaberto: sem um snapshot de '${phase}' aprovada não é possível determinar as tarefas afetadas.`,
      nothingNew: "Nada de novo desde a última reabertura sobre esta aprovação — nada foi alterado.",
      nothingToReopen: (changed) => (changed ? "Nada a reabrir: a edição não alterou nenhum critério nem secção (só texto fora deles) — nada foi alterado."
        : "Nada mudou desde a aprovação — nada a reabrir."),
      designFingerprintOnly: (slug) => `O design.md também mudou desde a aprovação, mas esta aprovação não guardou um snapshot dele (só a impressão digital), por isso não é possível listar o que lá mudou. Volta a aprovar para iniciar o histórico: /approve ${slug} design.`,
      reopenDesignUnknown: "Nada foi reaberto: o design.md mudou, mas sem um snapshot dele tal como foi aprovado não é possível determinar as tarefas afetadas.",
      reopened: (list, slug, phase) => `Reabertas ${list}: desmarcadas, com a evidência marcada como desatualizada — refaz-as com evidência nova e volta a aprovar: /approve ${slug} ${phase}.`,
      retireItem: (id, tasks, tests) => `${id} → ${[tasks.length ? "tarefas " + tasks.join(", ") : "", tests.length ? "testes " + tests.join(", ") : ""].filter(Boolean).join(" · ")}`,
      retireHint: (list, slug, phase, offer) => `Critérios removidos ainda citados — ${list}: não refaças essas tarefas; apaga-as (e as linhas de teste) ou aponta-as para o critério que o substitui.` +
        (offer ? ` --reopen regista o pedido de alteração sem as desmarcar (${DEV_SPEC} impact ${slug} --phase ${phase} --reopen).` : ""),
      retireNote: (list) => `Critérios removidos não se refazem — ainda citados: ${list}: apaga essas tarefas e linhas de teste, ou aponta-as para o critério que o substitui.`,
      recordedRetire: (n, list, slug, phase) => `Pedido de alteração #${n} registado — nada desmarcado: as tarefas de um critério removido não se refazem. Ainda citados: ${list}: apaga essas tarefas e linhas de teste, ou aponta-as para o critério que o substitui; depois volta a aprovar: /approve ${slug} ${phase}.`,
      recordedOnly: (n, slug, phase) => `Pedido de alteração #${n} registado — nenhuma tarefa concluída foi afetada. Revê-o e volta a aprovar: /approve ${slug} ${phase}.`,
      reopenHint: (slug, phase) => `Para desmarcar as tarefas concluídas afetadas e marcar a evidência como desatualizada: ${DEV_SPEC} impact ${slug} --phase ${phase} --reopen (spec_impact {reopen: true}).`,
      nextHint: (slug, phases) => `Vê primeiro o que a edição afeta com spec_impact (${phases.map((p) => `${DEV_SPEC} impact ${slug} --phase ${p}`).join(" · ")}).`,
      doctorChanged: (list, slug, phases) => `alterado(s) após a aprovação: ${list} — vê o que a edição afeta com spec_impact (${phases.map((p) => `${DEV_SPEC} impact ${slug} --phase ${p}`).join(" · ")}) e volta a aprovar`,
      doctorChangedPlain: (list, slug) => `alterado(s) após a aprovação: ${list} — revê e volta a aprovar (/approve ${slug} <fase>)`,
      staleNote: (n, slug, runnable) => `Tarefa ${n}: a evidência é anterior a uma alteração da spec (o spec_impact reabriu-a) — continua não verificada até se registar ` +
        (runnable ? `uma nova execução com sucesso: ${DEV_SPEC} done ${slug} ${n} --run` : "evidência nova."),
      head: (slug, phase, date, snap) => `Impacto: ${slug} · ${phase} — face à aprovação de ${date} (${snap})`,
      headFp: (slug, phase, changed) => `Impacto: ${slug} · ${phase} — só impressão digital: ${changed ? "alterado desde a aprovação" : "sem alterações desde a aprovação"}`,
      headNone: (slug, phase, changed) => `Impacto: ${slug} · ${phase} — sem impressão digital registada: ${changed ? "alterado desde a aprovação (um ficheiro criado depois dela)" : "não é possível dizer se mudou"}`,
      noChanges: "sem alterações desde a aprovação",
      noStructural: "editado, mas nenhum critério, secção ou tarefa mudou (só texto fora deles)",
      affected: "Afetado:",
      tasksLabel: "tarefas",
      testsLabel: "testes",
      designLabel: "design",
      idsLabel: "IDs",
      none: "nenhum",
      change: { added: "acrescentado", modified: "alterado", removed: "removido" },
      verified: "verificada",
      nothingToVerify: "nada a verificar (sem comando _Verify:_, nada registado)",
      staleSpec: "a spec mudou desde esta evidência; o spec_impact reabriu a tarefa",
      uncovered: (list) => `novos, ainda sem tarefa que os cite: ${list}`,
      reReview: (slug, phase, roles) => `revê a alteração e volta a aprovar: /approve ${slug} ${phase}` + (roles && roles.length ? ` --role ${roles[0]} (cada papel valida o novo conteúdo: ${roles.join(", ")})` : ""),
    },
    metrics: {
      writeNeedsName: "write precisa do nome de uma feature — a retrospetiva é por feature (spec_metrics {name, write: true} / " + DEV_SPEC + " metrics <feature> --write).",
      retroWritten: (p) => `Retrospetiva → ${p} (pré-preenchida com as métricas — o resto é contigo).`,
      retroExists: (p) => `${p} já existe — não foi alterado (uma retrospetiva nunca é substituída).`,
      unknown: "desconhecida",
      source: { approval: "aproximada: a partir da primeira aprovação", filesystem: "aproximada: a partir da data da pasta" },
      phase: { classification: "classificação", requirements: "requisitos", design: "design", "test-plan": "plano de testes", "eval-plan": "plano de evals", tests: "testes", tasks: "tarefas", execution: "execução", complete: "concluída", finished: "fechada" },
      head: (slug, tracks, created, approx) => `Métricas: ${slug} [${tracks}] — criada a ${created}${approx ? ` (${approx})` : ""}`,
      leadTimes: (list) => `  tempo desde a criação: ${list}`,
      noLeadTimes: "  tempo desde a criação: ainda nada aprovado",
      rework: (total, n, list, forced) => `  aprovações: ${total} · retrabalho: ${n}${list ? ` (${list})` : ""} · forçadas: ${forced}`,
      reworkUnknown: (forced) => `  retrabalho: desconhecido (aprovações anteriores ao histórico de alterações) · forçadas: ${forced}`,
      reworkPartial: (total, n, list, forced, legacy) => `  aprovações: ${total} · retrabalho: pelo menos ${n}${list ? ` (${list})` : ""} · forçadas: ${forced} — retrabalho desconhecido em ${legacy} (aprovações anteriores ao histórico de alterações)`,
      changes: (n, reopened) => `  pedidos de alteração: ${n} · tarefas reabertas: ${reopened}`,
      evidence: (rate, pass, runs) => `  evidência: ${rate}% das execuções com sucesso (${pass}/${runs})`,
      noRuns: "  evidência: nenhuma execução registada",
      tasks: (done, total, clar) => `  tarefas: ${done}/${total} · marcadores de clarificação por resolver: ${clar}`,
      noFeatures: (dir) => `Ainda não há features em ${dir}`,
      projectHead: (n) => `Métricas — ${n} feature(s)`,
      row: (created, complete, rework, forced, changes, pass, tasks) => [created ? `criada ${created}` : null, `concluída ${complete}`, `retrabalho ${rework}`,
        `forçadas ${forced}`, `alterações ${changes}`, `sucesso ${pass}`, tasks ? `tarefas ${tasks}` : null].filter(Boolean).join(" · "),
      avg: "média",
      median: "mediana",
      medianLeads: (list) => `  mediana do tempo desde a criação: ${list}`,
      totals: (done, total, pass, runs, changes, reopened) => `  total: tarefas ${done}/${total} · ${runs ? `evidência ${pass} de ${runs} execução(ões) com sucesso` : "nenhuma execução registada"} · pedidos de alteração ${changes} · tarefas reabertas ${reopened}`,
      retroText: {
        title: (f) => `# Retrospetiva: ${f}`,
        intro: (date) => `> Gerada pelo dev-spec a ${date} a partir de .state.json, .history/ e dos artefactos. Os números são calculados localmente; o resto é contigo. Nada aqui é aplicado automaticamente.`,
        metrics: "## Métricas",
        header: "| Métrica | Valor |",
        created: "Criada",
        approximate: "aproximado",
        unknown: "desconhecida",
        lead: (ph) => `Tempo até ${ph}`,
        rework: "Retrabalho (novas aprovações)",
        reworkUnknown: "desconhecido — as aprovações são anteriores ao histórico de alterações",
        reworkPartial: (value, legacy) => `pelo menos ${value} — desconhecido em ${legacy} (aprovações anteriores ao histórico de alterações)`,
        forced: "Aprovações forçadas",
        changes: "Pedidos de alteração",
        reopened: (n) => `${n} tarefa(s) reaberta(s)`,
        passRate: "Taxa de sucesso da evidência",
        runs: (rate, pass, runs) => `${rate}% (${pass}/${runs} execuções)`,
        noRuns: "nenhuma execução registada",
        tasks: "Tarefas",
        tasksValue: (done, total) => `${done}/${total} feitas`,
        clar: "Marcadores de clarificação por resolver",
        well: "## O que correu bem",
        hurt: "## O que custou",
        signals: (list) => `<!-- Sinais das métricas: ${list}. -->`,
        sigRework: (ph, n) => `'${ph}' aprovada ${n} vez(es)`,
        sigForced: (n) => `${n} aprovação(ões) forçada(s) com verificações a falhar`,
        sigReopened: (n) => `${n} tarefa(s) reaberta(s) por pedidos de alteração`,
        sigPass: (rate) => `só ${rate}% das execuções de verificação passaram`,
        sigClar: (n) => `${n} marcador(es) de clarificação ainda por resolver`,
        amend: "## Alterações propostas ao steering ou à constituição",
        amendNote: "<!-- Para aprovação humana — nunca aplicadas automaticamente. Indica o ficheiro (.specs/steering/constitution.md, tech.md, …), a alteração exata e o porquê. -->",
        followUps: "## Seguimento",
        followUpsNote: "<!-- Candidatos ao backlog — acrescenta os que aceitares com spec_backlog (dev-spec backlog add \"<nome>\" \"<nota>\"). -->",
      },
      retro: (m, fmt) => MSG.en.metrics.buildRetro(MSG.pt.metrics.retroText, MSG.pt.metrics.phase, m, fmt),
    },

    deepTrace: {
      kinds: {
        uncoveredEdgeCases: "casos limite (EC) sem tarefa nem teste que os cubra",
        uncoveredNfr: "requisitos não funcionais (NFR) sem tarefa nem teste que os cubra",
        uncoveredSuccessCriteria: "critérios de sucesso (SC) sem teste nem passo do quickstart que os verifique",
        phantomSecondary: "tarefas / plano de testes citam IDs EC/NFR/SC desconhecidos (gralhas?)",
        untracedCriteria: "critérios com verbo modal mas sem ID próprio (por linha) — nenhuma tarefa nem teste os pode rastrear: numera cada um US-<história>.AC-<n>",
        justifiedTestGaps: "ACs que o plano de testes só nomeia numa nota (Lacunas / Fora de Âmbito), nunca numa linha de teste — continuam sem cobertura: acrescenta uma linha, ou aprova o plano de testes com force para aceitar a lacuna",
        plannedNotInCode: "testes planeados que nenhum ficheiro de teste nomeia (põe o T-ID no nome do teste)",
        inCodeNotInPlan: "T-IDs no código de teste que nenhum plano de testes lista",
        unresolvedImplGlobs: "globs de _Implements:_ não resolvidos por completo (a leitura dos ficheiros parou no limite antes de uma correspondência — não contam como em falta)",
      },
      secondaryOk: (n) => `todos os ${n} IDs EC/NFR/SC cobertos`,
      testsInCodeOk: (n) => `cada T-ID planeado que uma tarefa feita põe a verde aparece num ficheiro de teste (${n})`,
      testsInCodeMissing: (list) => `postos a verde por tarefas feitas, mas nenhum ficheiro de teste os nomeia: ${list} — põe o T-ID no nome de um teste (test("T-01 …"), def test_T01_…) num ficheiro de teste (uma pasta tests/, *.test.*, *_test.* …), no ficheiro que a coluna Ficheiro do plano indica, se indicar um; uma verificação feita fora do código de teste (um script de carga, um conjunto de evals) indica antes o seu artefacto não-código na coluna Ficheiro (load-test.md, evals/golden.json) e não é esperada num ficheiro de teste`,
      truncated: "a pesquisa de ficheiros de teste parou no limite — alguns ficheiros não foram lidos",
      codeSummary: (found, planned, scanned, truncated, outside) => `  testes no código: ${found}/${planned} T-ID(s) planeado(s) nomeado(s) em ${scanned} ficheiro(s) de teste` + (outside ? ` · verificados fora do código de teste (a coluna Ficheiro indica um artefacto que não é código): ${outside}` : "") + (truncated ? " (pesquisa truncada no limite)" : ""),
      warningsHead: "Avisos (não bloqueiam):",
    },

    catalog: {
      title: (proj) => `Catálogo de specs — ${proj}`,
      autogen: "AUTO-GERADO por dev-spec — não editar à mão. Para regenerar: spec_catalog {write: true} (dev-spec catalog --write).",
      intro: "O que o sistema faz hoje: todos os critérios de aceitação, agrupados por feature. Um critério substituído por uma feature posterior já entregue (_Supersedes:_) aparece riscado e indica o critério que o substitui; um que uma feature ainda em curso prevê substituir aparece com \"substituição prevista\" e continua em vigor.",
      totals: (f, acs, current, sup, pending) => `**${f} feature(s) · ${acs} critérios de aceitação — ${current} em vigor${pending ? ` (${pending} com substituição prevista)` : ""}, ${sup} substituído(s)**`,
      status: { active: "em curso", complete: "completa", finished: "fechada", archived: "arquivada" },
      finishedOn: (d) => `fechada a ${d}`,
      archivedOn: (d) => `arquivada a ${d}`,
      supersededBy: (list) => `substituído por ${list}`,
      toBeSupersededBy: (list) => `substituição prevista por ${list} (ainda não entregue)`,
      supersedes: (list) => `substitui ${list}`,
      template: "template — ainda por escrever",
      noAcs: "Ainda sem critérios de aceitação.",
      noFeatures: "Ainda sem features.",
      cliWrote: (file, f, acs, sup) => `✎ gerado ${file}  (${f} feature(s), ${acs} critério(s), ${sup} substituído(s))`,
    },
    supersedes: {
      phantom: (ref, reason, by) => `_Supersedes:_ ${ref}${by ? ` (em ${by})` : ""} — ${reason}`,
      renamed: (list) => `as referências _Supersedes:_ a ela passam a usar o nome novo, em: ${list}`,
      reason: { "bad-ref": "não está no formato <feature>/US-n.AC-m", "unknown-feature": "essa feature não existe (ativa ou arquivada)", "unknown-ac": "essa feature não tem esse critério", self: "uma feature não pode substituir um critério seu", unterminated: "o marcador nunca é fechado — termina-o com um underscore: _Supersedes: <feature>/US-n.AC-m_" },
    },
    restore: {
      notArchived: (slug) => `Não há nada arquivado como '${slug}' (.specs/_archive/${slug}/ não existe).`,
      activeExists: (slug) => `'${slug}' já é uma feature ativa — renomeia-a primeiro (${DEV_SPEC} feature rename ${slug} "<novo nome>") e depois restaura a arquivada.`,
      done: (slug) => `'${slug}' restaurada de .specs/_archive/ ✓`,
      noRecord: "Foi arquivada antes de o arquivo registar a sua entrada no roadmap — volta a declarar as dependências com spec_depend, se as tinha.",
      skipDependsOn: (d, reason) => `a sua dependência '${d}' (${reason})`,
      skipDependent: (k, reason) => `'${k}', que dependia dela (${reason})`,
      skipRecord: (field, reason) => `o campo ${field} do registo de arquivo (${reason})`,
      skipped: (list) => `Não restaurado: ${list}.`,
      reason: { gone: "já não existe", archived: "também arquivada — restaurá-la repõe a ligação", cycle: "fecharia um ciclo de dependências", invalid: "formato inesperado — deixado de fora" },
      renamedRecords: (list) => `registos de arquivo atualizados para o nome novo (o restore repõe as suas dependências): ${list}`,
      prunedDependents: (list) => `as dependências das features que dependiam dela saíram do roadmap: ${list} (registado — o restore repõe-nas)`,
      prunedIncomplete: (slug, pct, list) => `'${slug}' não estava completa (${pct}%), mas ${list} dependia(m) dela: o roadmap deixa de a(s) mostrar bloqueada(s) por ela — restaura-a, ou volta a declarar a dependência com spec_depend, se ainda precisa(m) desse trabalho`,
    },
    drift: {
      none: "Nenhuma feature fechada tem ainda uma baseline de drift — spec_finish {write: true} (" + DEV_SPEC + " finish <feature> --write) regista uma quando a feature está pronta para fechar.",
      clean: (f, n, d, archived) => `  ✓ ${f}${archived ? " (arquivada)" : ""}: ${n} ficheiro(s) de implementação sem alterações desde o fecho (${d})`,
      drifted: (f, n, total, d, archived) => `  ⚠ ${f}${archived ? " (arquivada)" : ""}: ${n} de ${total} ficheiro(s) de implementação alterado(s) desde o fecho (${d})`,
      changed: (list) => `      alterados: ${list}`,
      missing: (list) => `      em falta: ${list}`,
      nowPresent: (list) => `      agora presentes (em falta no fecho): ${list}`,
      reopened: (list) => `  · reabertas depois do fecho (há tarefas por fazer — verificadas quando voltarem a fechar): ${list}`,
      unbaselined: (list) => `  · ainda sem baseline de fecho: ${list}`,
      stale: (f, d, why, archived) => `  ↻ ${f}${archived ? " (arquivada)" : ""}: mudou desde o fecho (${d}) — ${why}; a baseline já não a cobre: ${archived ? `restaura-a (${DEV_SPEC} feature restore ${f}), volta a fechá-la (${DEV_SPEC} finish ${f} --write) e arquiva-a de novo` : `volta a fechá-la (${DEV_SPEC} finish ${f} --write)`}`,
      staleWhy: {
        changeRequests: (list) => `pedido de alteração ${list}`,
        approvals: (list) => `reaprovado: ${list}`,
        newFiles: (n, list) => `${n} ficheiro(s) de implementação fora da baseline: ${list}`,
      },
      hookLine: (f, n) => `  ⚠ ${f}: ${n} ficheiro(s) de implementação alterado(s) desde o fecho — corre ${DEV_SPEC} drift ${f}`,
      baselineRecorded: (n, missing) => `Baseline de drift registada: ${n} ficheiro(s) de implementação${missing ? ` (${missing} em falta)` : ""} — ${DEV_SPEC} drift mostra o que mudar depois deste fecho.`,
      baselineReplaced: (n, day, list) => `Substituída a baseline de ${day}, na qual ${n} ficheiro(s) tinham mudado: ${list} — a nova baseline aceita-os tal como estão agora.`,
    },

    guardMode: {
      ask: (pending, stale) => "dev-spec guard: nenhuma tarefa aprovada cobre alterações de código neste momento — aprova as tarefas de uma feature (spec_approve) ou confirma para continuar." +
        (pending ? ` Features com tarefas por aprovar: ${pending}.` : "") +
        (stale ? ` Tarefas alteradas depois da aprovação (revê e volta a aprovar a fase tasks): ${stale}.` : "") + " (O modo guarda está ligado — " + DEV_SPEC + " init --guard off desliga-o.)",
      forced: (list) => `dev-spec guard: as alterações de código só estão cobertas por uma aprovação FORÇADA das tarefas (${list}) — as verificações falhavam quando foi aprovada.`,
      on: "Modo guarda LIGADO — Write/Edit em ficheiros de código fora de .specs/ pede confirmação enquanto nenhuma feature tiver tarefas aprovadas por concluir (roadmap.json meta.guard). Os ficheiros de teste são permitidos enquanto o plano de testes de uma feature por concluir estiver aprovado (a Fase 4 escreve os testes a falhar antes do gate das tarefas), e todos os ficheiros de código enquanto um spike estiver em curso (o seu protótipo).",
      off: "Modo guarda DESLIGADO — as alterações de código não são controladas.",
      badValue: (v) => `--guard aceita on, off ou scope (recebido '${v}').`,
    },
    approvalGuard: {
      on: {
        ask: "O guarda de aprovações está em ASK — uma aprovação feita por um agente (spec_approve / dev-spec approve, a remoção de uma feature, baixar este guarda) pede primeiro a tua confirmação (roadmap.json meta.approvalGuard). O Claude Code mostra esse pedido também no modo auto; só o modo bypass de permissões o pode saltar — 'deny' vale em todos os modos.",
        deny: "O guarda de aprovações está em DENY — uma aprovação feita por um agente (spec_approve / dev-spec approve, a remoção de uma feature, baixar este guarda) é recusada: só a pessoa aprova, no seu próprio terminal ou no Claude Code com o prefixo ! (roadmap.json meta.approvalGuard).",
      },
      off: "O guarda de aprovações está DESLIGADO — as aprovações pedidas por um agente não são controladas (roadmap.json meta.approvalGuard).",
      badValue: (v) => `--approval-guard aceita off, ask ou deny (recebido '${v}').`,
      action: (a) => {
        const f = a.feature || "?";
        if (a.kind === "remove") return `apagar definitivamente a feature '${f}' (a pasta em .specs/, as aprovações e o histórico)`;
        if (a.kind === "unreadable") {
          if (a.why === "partial") return "executar uma chamada de ferramenta que o guarda de aprovações só recebeu em parte (a entrada veio cortada) e que menciona dev-spec ou .specs/";
          return a.why === "too-long" ? `correr um comando de shell demasiado longo para o guarda de aprovações o ler (${a.length} caracteres) que menciona dev-spec ou .specs/`
            : "correr um comando de shell que menciona a CLI do dev-spec com uma palavra de aprovação numa forma que o guarda de aprovações não consegue ler (um lançador desconhecido, um glob, uma variável ou uma string concatenada)";
        }
        if (a.kind === "guard-down") {
          if (a.setting === "roadmap" && a.source === "edit") return "editar à mão .specs/roadmap.json (é lá que estão o guarda de aprovações e os gates do projeto)";
          if (a.setting === "state") return a.source === "edit" ? `editar à mão o .state.json de '${f}' — as aprovações, a evidência e o histórico`
            : `alterar o .state.json de '${f}' a partir da shell — as aprovações, a evidência e o histórico`;
          if (a.setting === "observed") return (a.feature ? `escrever à mão o registo das execuções observadas de '${a.feature}' (.execution/observed.jsonl)` : "escrever à mão o registo das execuções observadas do projeto (.specs/.execution/observed.jsonl)") +
            " — as execuções que os gates aceitam como evidência";
          if (a.setting === "track") return `desligar ${(a.tracks || []).map((t) => "+" + t).join(", ")} em '${f}' — os gates que traz (o plano de testes / de evals, os testes a falhar ou os evals da Fase 4) deixam de ser exigidos`;
          if (a.setting === "evidence") return "voltar a pôr o modo de evidência (meta.evidence) em reported";
          if (a.setting === "stopCheck") return "desligar o gate de evidência no fim do turno (meta.stopCheck)";
          if (a.setting === "guard") return a.from ? `baixar o modo guarda (meta.guard) de ${a.from} para ${a.to}` : `pôr o modo guarda (meta.guard) em ${a.to}`;
          if (a.setting === "roles") {
            if (!a.to || !Object.keys(a.to).length) return "remover os papéis de aprovação (meta.approvalRoles)";
            return Array.isArray(a.removed) ? `retirar papéis de aprovação exigidos (${a.removed.join(", ")}) de meta.approvalRoles` : "substituir os papéis de aprovação (meta.approvalRoles)";
          }
          if (a.setting === "check") return a.to == null ? `remover a verificação do projeto '${a.name}' (meta.checks)` : `alterar o comando da verificação do projeto '${a.name}' (meta.checks)`;
          if (a.setting === "roadmap") return "alterar .specs/roadmap.json a partir da shell — escrevê-lo, movê-lo ou apagá-lo (é lá que estão o guarda de aprovações e os gates do projeto)";
          return `baixar o guarda de aprovações de ${a.from} para ${a.to}`;
        }
        if (a.revoke) return `revogar a aprovação da fase ${a.phase || "?"} de '${f}'` + (a.role ? ` como ${a.role}` : "") + (a.by ? ` em nome de '${a.by}'` : "");
        return (a.through ? `aprovar todas as fases de '${f}' até ${a.through}` : `aprovar a fase ${a.phase || "?"} de '${f}'`) +
          (a.role ? ` como ${a.role}` : "") + (a.by ? ` em nome de '${a.by}'` : "") +
          (a.force ? " — FORÇADA (--force)" : "");
      },
      ask: (list, force) => `dev-spec approval guard: o agente quer ${list}.` + (force ? " ⚠ FORCE: as verificações da fase são ignoradas — um gate que falha ficaria registado como aprovado mesmo assim." : "") +
        " As aprovações são tuas — confirma só se aprovares isto. (meta.approvalGuard: ask — " + DEV_SPEC + " init --approval-guard deny recusa de vez as aprovações dos agentes.)",
      deny: (list, command) => `dev-spec approval guard: recusado — as aprovações são da pessoa, e um agente não pode ${list}. ` +
        (command ? `Pede ao utilizador que o execute ele próprio, no seu terminal ou no Claude Code com o prefixo ! (o comando é executado como o utilizador, não pela tua chamada de ferramenta): ${command}` : "Pede ao utilizador que faça ele próprio essa alteração, no seu editor ou terminal") +
        " — e espera por ele. Não tentes outra via (a ferramenta MCP, a CLI, um script ou uma edição dos ficheiros de .specs/). (meta.approvalGuard: deny.)",
      denyUser: (list, command) => `dev-spec approval guard recusou o pedido de um agente para ${list}.` + (command ? ` Para aprovar: ${command}` : " Se a quiseres, faz tu essa alteração."),
      denyMcp: (list, command) => `dev-spec approval guard: recusado — as aprovações são da pessoa, e um agente não pode ${list}. ` +
        (command ? `Pede ao utilizador que o execute ele próprio, no seu terminal: ${command}` : "Pede ao utilizador que faça ele próprio essa alteração, no seu editor ou terminal") +
        " — e espera por ele. Não tentes outra via (a ferramenta MCP, a CLI, um script ou uma edição dos ficheiros de .specs/). (meta.approvalGuard: deny.)",
    },
    elicit: {
      message: (list, details) => `dev-spec: um agente pede para ${list}.` + (details ? " " + details : "") + " As aprovações são tuas: marca Aprovar só se aprovares isto.",
      gatePasses: "As verificações da fase passam.",
      forced: (ids) => `⚠ FORÇADA: as verificações da fase falham (${ids}) — ficaria registada como aprovada mesmo assim.`,
      waiver: (reason, expires) => "Exceção: " + [reason ? `"${reason}"` : null, expires ? `até ${expires}` : null].filter(Boolean).join(" ") + ".",
      phases: (list) => `Fases a aprovar, por ordem: ${list}.`,
      removeSize: (n, rel) => `Isto apaga ${rel} de vez — ${n} ficheiro${n === 1 ? "" : "s"}.`,
      approveTitle: "Aprovar",
      approveDesc: "Marca para registar; deixa em branco (ou recusa) para não aprovar.",
      noteTitle: "Nota",
      noteDesc: "Opcional — registada com a aprovação (uma linha).",
      declined: (list) => `O utilizador recusou no cliente MCP: nada foi registado (${list}). Não tentes outra via — pede ao utilizador que diga o que deve mudar.`,
      unapproved: (list) => `O utilizador respondeu no cliente MCP sem marcar Aprovar: nada foi registado (${list}). Não tentes outra via — pede ao utilizador que diga se o aprova.`,
      cancelled: (list) => `O utilizador fechou a confirmação: nada foi registado (${list}). Pede confirmação ao utilizador antes de tentar de novo.`,
      timedOut: (s, list) => `Sem resposta do utilizador em ${s} s: nada foi registado (${list}). Pede ao utilizador que o aprove ele próprio.`,
      failed: (why, list) => `O cliente MCP não conseguiu perguntar ao utilizador (${why}): nada foi registado (${list}). Pede ao utilizador que faça ele próprio a aprovação.`,
      confirmed: "Confirmado pelo utilizador no cliente MCP (elicitation).",
      waiting: "À espera da resposta do utilizador no cliente MCP…",
    },
    mergeState: {
      doctor: (n, list) => `${n} conflito(s) de merge que o merge driver do dev-spec deixou por resolver — ${list}. Em cada um ficou o valor de ours: escolhe o valor certo no ficheiro (a lista "mergeConflicts" mostra base / ours / theirs) e depois apaga "mergeConflicts".`,
      conflictHead: (file, n) => `dev-spec merge-state: ${file}: ${n} conflito(s) — ficou o valor de ours em cada um, listados no ficheiro em "mergeConflicts":`,
      conflictLine: (p, ours, theirs, base) => `  ${p}: ours ${ours} · theirs ${theirs} · base ${base}`,
      conflictTail: "Escolhe cada valor no ficheiro, apaga \"mergeConflicts\" e faz git add.",
      absent: "(ausente)",
      parseError: (side, why) => `dev-spec merge-state: ${side} não é JSON válido (${why}) — nada foi combinado e ours ficou como estava; faz o merge do ficheiro à mão.`,
      unreadable: (file) => `não é possível ler ${file}.`,
      noGit: (dir) => `${dir} não está dentro de um repositório git (ou o git não está instalado) — merge-state --install escreve a configuração git desse repositório.`,
      noGitUninstall: (dir) => `${dir} não está dentro de um repositório git (ou o git não está instalado) — merge-state --uninstall retira a configuração git e as linhas do .gitattributes desse repositório; aqui não há nada a retirar.`,
      attrsAdded: (file) => `${file}: linhas do merge driver adicionadas (faz commit — toda a equipa as recebe):`,
      attrsKept: (file) => `${file}: o ficheiro já tem as linhas do merge driver.`,
      attrsRemoved: (file) => `${file}: linhas do merge driver removidas (faz commit).`,
      attrsNone: (file) => `${file}: sem linhas do merge driver para remover.`,
      configSet: (key, value) => `git config ${key} = ${value}`,
      configRemoved: (key) => `git config: ${key} removido.`,
      configFailed: (why) => `git config falhou: ${why}`,
      teamNote: `A configuração git é de cada clone: cada pessoa da equipa executa ${DEV_SPEC} merge-state --install uma vez — e de novo após cada atualização do plugin (o git executa o driver pelo caminho da pasta deste plugin, que uma atualização muda; ${DEV_SPEC} merge-state --check diz se está atual). Sem isso, o git usa o seu merge de texto.`,
      checkOk: (script) => `O merge driver do estado da spec está instalado e executa a CLI deste clone (${script}).`,
      checkNone: `O merge driver do estado da spec não está instalado aqui e o .gitattributes não o refere — nada a verificar (para o instalar: ${DEV_SPEC} merge-state --install).`,
      checkNotInstalled: (file) => `${file} refere o merge driver dev-spec-state, mas a configuração git deste clone não o tem — o git usa o seu merge de texto (um .state.json alterado nos dois ramos entra em conflito). Instala-o: ${DEV_SPEC} merge-state --install`,
      checkOther: (script, cli) => `O git executa o merge driver do estado da spec a partir de ${script}, não da CLI deste clone (${cli}) — corre de novo: ${DEV_SPEC} merge-state --install`,
      checkMissing: (script) => `O git executa o merge driver do estado da spec a partir de ${script}, que já não existe (uma atualização do plugin muda-o para outra pasta) — o git reporta então um conflito e fica só com o teu lado de .state.json / roadmap.json. Corre de novo: ${DEV_SPEC} merge-state --install`,
      checkNoGit: (dir) => `${dir} não está dentro de um repositório git (ou o git não está instalado) — não há merge driver para verificar.`,
      hookLine: (script, missing) => `⚠ O merge driver git do estado da spec executa ${script}, ${missing ? "que já não existe (uma atualização do plugin mudou-o de pasta)" : "que não é a CLI deste plugin"} — um merge ficaria só com o teu lado de .state.json / roadmap.json. Corre de novo: ${DEV_SPEC} merge-state --install`,
    },
    scopedSteering: {
      customHint: "— ou um ficheiro de steering próprio, com âmbito: letras minúsculas, algarismos e '-', a terminar em .md (ex.: api-conventions.md).",
      reservedName: (file) => `'${file}' é um nome reservado (um nome de dispositivo do Windows ou um membro nativo do JavaScript) — escolhe outro nome para o ficheiro de steering.`,
      customStub: (title, pattern) => `---\ninclusion: fileMatch\nfileMatchPattern: "${pattern}"\n---\n\n# ${title}\n\n` +
        "<!-- Steering com âmbito. O front matter decide quando o spec_task_brief inclui este ficheiro:\n" +
        "     inclusion: always    → em todos os briefs de tarefa\n" +
        "     inclusion: fileMatch → só nas tarefas cujos caminhos _Implements:_ correspondem ao fileMatchPattern\n" +
        "                            (glob: ** · * · ? · {a,b}; aceita uma lista: [\"src/api/**\", \"src/routes/**\"])\n" +
        "     inclusion: manual    → nunca automaticamente; os briefs listam-no como disponível a pedido\n" +
        "     Substitui o padrão de exemplo e as linhas entre parênteses retos abaixo. -->\n\n" +
        "## Regras\n- [Uma regra que todos os ficheiros que correspondem ao padrão têm de seguir.]\n\n## Exemplos\n- [Um exemplo curto — ou uma referência a um ficheiro que mostre o padrão.]\n",
      placeholders: (list) => `ainda com placeholders do template: ${list}`,
      scoped: "Steering com âmbito (fileMatch — corresponde aos ficheiros desta tarefa):",
      manual: "Disponível a pedido (steering manual):",
    },
    designSaveCheck: {
      head: (slug, tracks) => `Verificação do design em design.md (${slug} [${tracks}]):`,
      clean: (tracks, constitution) => `Verificação do design [${tracks}]: secções obrigatórias${constitution ? " e Verificação da Constituição" : ""} preenchidas, sem placeholders do template ✓`,
      sections: (marker, list) => `secções ${marker}: ${list}`,
      constitution: {
        missing: "Verificação da Constituição: em falta — acrescenta a secção e verifica cada princípio de steering/constitution.md",
        unfilled: "Verificação da Constituição: por preencher",
      },
      placeholders: (n, list) => `${n} placeholder(s) do template por substituir: ${list}`,
      hint: (slug) => `Preenche-os antes de aprovar o design — detalhes: /spec-doctor ${slug}.`,
    },
    upgrade: {
      head: (from, to, mode) => mode === "unknown" ? "dev-spec upgrade — a versão deste motor é desconhecida (não há package.json ao lado): nada será carimbado."
        : mode === "behind" ? `dev-spec upgrade — .specs/ ${from ? `na ${from}` : "de antes da 1.13 (sem carimbo de versão)"} → dev-spec ${to}`
        : mode === "pending" ? `dev-spec upgrade — .specs/ na ${from} (este dev-spec: ${to}), mas ainda há migrações pendentes`
        : `dev-spec upgrade — .specs/ na ${from}: em dia com este dev-spec (${to})`,
      newer: (from, to) => `.specs/ foi atualizado por último por um dev-spec mais recente (${from}) do que este (${to}) — atualiza o plugin antes de confiar nesta auditoria.`,
      summary: (n, blocked, attention, ok, archived) => `${n} feature(s) ativa(s): ${blocked} bloqueada(s) · ${attention} a precisar de atenção · ${ok} ok` + (archived ? ` · ${archived} arquivada(s) (não revista(s))` : ""),
      noFeatures: "Não há features ativas — nada a rever.",
      group: { blocked: "⛔ Bloqueadas — o doctor falha:", attention: "▲ Precisam de atenção:", ok: "✓ OK:" },
      status: { "not-started": "por começar", planning: "em planeamento", executing: "em execução", complete: "completa", finished: "fechada" },
      feature: (name, status, tracks, phase, done, total, bugfix) => `${name} — ${status} · [${tracks}] · ${phase} · ${done}/${total} tarefas${bugfix ? " · bugfix" : ""}`,
      tracksInferred: "os tracks foram inferidos dos ficheiros — o apply guarda-os no .state.json",
      item: {
        error: (e) => `Corrige-o primeiro à mão: ${e}`,
        fix: (list) => `Corrige o que o doctor dá como falha: ${list}`,
        approve: (list, slug) => `Aprova o(s) gate(s) pendente(s), por ordem: ${list} — /approve ${slug} <fase>`,
        reReview: (list, cmds) => `Revê o que mudou depois da aprovação: ${list}` + (cmds ? ` — vê primeiro a diferença: ${cmds}` : "") + "; depois volta a aprovar",
        reapprove: (list) => `Volta a aprovar para começar o histórico de alterações (o spec_impact ainda não consegue comparar estas): ${list}`,
        verify: (list, slug) => `Regista uma execução bem-sucedida das tarefas marcadas que não a têm: ${list} — ${DEV_SPEC} done ${slug} <n> --run`,
        drift: (n, slug) => `Decide sobre a deriva: ${n} ficheiro(s) de implementação alterado(s) desde o fecho — ${DEV_SPEC} drift ${slug}`,
        stale: (slug) => `Mudou depois do fecho — volta a fechá-la: /spec-finish ${slug}`,
        packReserved: (list, slug, since) => `Muda o nome do(s) seu(s) track pack(s) anterior(es) à ${since || "1.17"} — ${list}: o nome é agora reservado, por isso o track está inativo (detalhes: ${DEV_SPEC} doctor ${slug}, verificação track-pack-missing)`,
        packMarkerReserved: (list, slug, since, tracks) => `Muda o marcador do(s) seu(s) track pack(s) anterior(es) à ${since || "1.19"} — ${list}: o marcador é agora o de um track incluído, por isso o pack está inativo; ou usa o track incluído: ${DEV_SPEC} add-track ${slug} ${tracks} (detalhes: ${DEV_SPEC} doctor ${slug}, verificação track-pack-missing)`,
        bareAcIds: (list, slug, file = "requirements.md") => `Renumera os critérios que o ${file} identifica com IDs soltos (${list}) como US-<história>.AC-<n> — e as referências a eles ${file === "change.md" ? "nos _Requirements:_ das suas tarefas (também no change.md)" : "no tasks.md e no test-plan.md"} — e volta a aprovar: desde a 1.22 um AC-n sozinho não é um ID que o trace_check leia, por isso o doctor (ears, traceability) falha e a aprovação é recusada (detalhes: ${DEV_SPEC} doctor ${slug})`,
        critic: (files) => `Revê-a com o agente spec-critic (só leitura), fase a fase: ${files || "—"}`,
        converge: (files) => "Corre a passagem de convergência do spec-reviewer (as tarefas feitas face aos seus ACs)" + (files ? `, depois o agente spec-critic sobre ${files}` : ""),
        none: "Não precisa de revisão da spec — todas as tarefas estão feitas",
        next: (rec) => `A seguir: ${rec}`,
        warnings: (list) => `Avisos: ${list}`,
      },
      reason: { "no-fingerprint": "aprovada antes das impressões digitais de conteúdo", changed: "alterada depois da aprovação", missing: "o ficheiro não existe", untracked: "uma aprovação de design de bugfix da 1.12 — o bug.md nunca foi seguido", "snapshot-missing": "o ficheiro do snapshot desapareceu" },
      planHead: "O apply mudaria (spec_upgrade {apply: true} · " + DEV_SPEC + " upgrade --apply) — nunca um artefacto, uma aprovação ou uma marcação:",
      migHead: "Migrações aplicadas — nenhum artefacto editado, nada aprovado, marcado ou apagado:",
      migStamp: (from, to) => `meta.specVersion: ${from || "nenhuma"} → ${to}`,
      migTracks: (list) => `tracks guardados no .state.json: ${list}`,
      migSeeded: (list) => `baselines de aprovação guardadas: ${list}`,
      planSeed: (list) => `baselines de aprovação a guardar em .history/ (o ficheiro ainda corresponde à aprovação): ${list}`,
      migRecords: (n) => `${n} aprovação(ões) anterior(es) registada(s) no approvalHistory`,
      migSkipped: (list) => `sem baseline — volta a aprovar para começar o histórico: ${list}`,
      migGitignore: (n) => `.specs/.gitignore: ${n} linha(s) acrescentada(s)`,
      migErrors: (list) => `não migrado: ${list} — corrige e volta a correr o upgrade (o meta.specVersion fica como está até lá)`,
      nothing: "Nada a migrar — .specs/ já está em dia; nada foi alterado.",
      upToDate: "Nada a migrar — a lista acima é o que as regras atuais assinalam.",
      applyHint: "Nada foi alterado. Revê a lista e depois aplica as migrações seguras: " + DEV_SPEC + " upgrade --apply (spec_upgrade {apply: true}).",
      reportAt: (file) => `Relatório: ${file} — uma checklist para ir cumprindo (/spec-upgrade).`,
      reportKept: (file) => `${file} existe e não foi gerado pelo dev-spec — ficou intacto (relatório não escrito).`,
      hookLine: (from) => `⬆ .specs/ foi criado com um dev-spec mais antigo (${from || "anterior à 1.13"}) — corre /spec-upgrade (${DEV_SPEC} upgrade) para rever o que ainda não está implementado (ou pede simplesmente para atualizar as specs)`,
      md: {
        title: (proj) => `dev-spec upgrade — ${proj}`,
        autogen: "AUTO-GERADO por dev-spec — marca as caixas à medida que avanças; o spec_upgrade {apply: true} (dev-spec upgrade --apply) escreve-o quando migra alguma coisa.",
        intro: (from, to) => `.specs/ atualizado de ${from || "um dev-spec anterior à 1.13"} para ${to || "?"}. Por feature: o que as regras da ${to || "?"} assinalam, o que fazer e que revisão correr. Trabalha-o com /spec-upgrade (Claude Code) ou dev-spec upgrade; volta a correr a auditoria quando quiseres para ver o estado atual.`,
        migrations: "Migrações",
        group: { blocked: "⛔ Bloqueadas — o doctor falha", attention: "▲ Precisam de atenção", ok: "✓ OK" },
        footer: "Todas as alterações passam pelos gates normais: novas aprovações com spec_approve (/approve), edições da spec depois de uma aprovação com spec_impact (/spec-impact), trabalho de seguimento com spec_append_tasks (/spec-converge). Nada aqui é aplicado automaticamente.",
      },
    },

    promptsResources: {
      preamble: (agentsMd, refsDir) => `Nota para o agente: se não houver uma skill dev-spec-driven disponível nesta ferramenta, segue o fluxo do AGENTS.md do plugin (${agentsMd}) e usa as ferramentas MCP spec-driven (spec_*, ears_validate, trace_check); os ficheiros references/… citados abaixo estão em ${refsDir}.`,
      argDesc: (hint) => (hint ? `Argumentos (opcionais): ${hint}` : "Não precisa de argumentos (texto livre opcional)."),
      cliHead: (n) => `${n} prompt(s) — um por comando do plugin; ${DEV_SPEC} prompts <nome> [--args "…"] mostra um:`,
      res: {
        roadmap: "O roadmap do projeto (.specs/ROADMAP.md): a fase, o progresso e as dependências de cada feature.",
        roadmapFromJson: "O roadmap do projeto, gerado a partir de .specs/roadmap.json (ainda sem ROADMAP.md escrito).",
        catalog: "O catálogo vivo (.specs/SPECS.md): todas as features e critérios de aceitação, com os substituídos assinalados.",
        steering: (file) => `Ficheiro de steering .specs/steering/${file} — regras do projeto que todas as features seguem.`,
        artifact: (slug, label, file) => `${label} da feature '${slug}' (.specs/${slug}/${file}).`,
        labels: {
          "classification.md": "Classificação (tracks)", "requirements.md": "Requisitos (EARS)", "design.md": "Design técnico", "test-plan.md": "Plano de testes",
          "eval-plan.md": "Plano de evals", "load-test.md": "Plano de testes de carga", "tasks.md": "Tasks", "bug.md": "Relatório do bug (reprodução · causa raiz · correção)",
          "quickstart.md": "Quickstart", "checklist.md": "Checklist", "integration-plan.md": "Plano de integração", "retro.md": "Retrospetiva",
          "spike.md": "Spike (pergunta · evidência · decisão)", "decisions.md": "Registo de decisões", "change.md": "Alteração (critérios · abordagem · tarefas)", // 1.14 C2 · 1.21 F5
        },
        tplFeature: (list) => `Um artefacto da spec de uma feature: .specs/{slug}/{artifact} — {artifact} é um de ${list}.`,
        tplSteering: "Um ficheiro de steering: .specs/steering/{file} (um ficheiro .md).",
      },
      err: {
        badCursor: "resources/list: cursor inválido — devolve tal como está o nextCursor da página anterior.",
        noPromptName: "prompts/get precisa do `name` do prompt (uma string).",
        badPromptArgs: 'prompts/get: `arguments` tem de ser um objeto de strings, p. ex. {"args": "login"}.',
        unknownPrompt: (name, list) => `Prompt desconhecido '${name}' — um de: ${list}.`,
        noUri: "resources/read precisa do `uri` do recurso (uma string).",
        badUri: (uri) => `URI de recurso inválido '${uri}' — esperado specs://roadmap, specs://catalog, specs://steering/<ficheiro>.md ou specs://feature/<slug>/<artefacto> (sem '..', sem caminho absoluto, sem outro esquema).`,
        unknownArtifact: (a, list) => `Artefacto desconhecido '${a}' — um de: ${list}.`,
        badSteering: (file) => `Nome de ficheiro de steering inválido '${file}' — um ficheiro .md diretamente em .specs/steering/.`,
        notFound: (uri, detail) => `Recurso não encontrado: ${uri}` + (detail ? ` — ${detail}` : ""),
      },
    },

    // 1.16 C — integração com o Claude Code (status line, ponte do plan mode, spec_import {text}, completion/complete).
    claudeCode: {
      statusLine: {
        head: (slug, kind) => `◆ ${slug}` + (kind === "bugfix" ? " (bugfix)" : kind === "spike" ? " (spike)" : ""),
        tasks: (done, total) => `${done}/${total} tarefas`,
        unverified: (n) => `${n} por verificar`,
        next: (step) => `a seguir: ${step}`,
        none: "◆ dev-spec · ainda sem features — /spec",
        steps: {
          "re-review": (s) => `rever ${s.files.join(", ")}`,
          fill: (s) => `preencher ${s.file}`,
          fix: (s) => (s.file === "bug.md" ? "escrever a causa raiz em bug.md" : s.file === ".state.json" ? "reparar o .state.json (não pode ser lido)" : s.file === "roadmap.json" ? "reparar o roadmap.json (não pode ser lido)" : `corrigir o gate ${s.phase}`),
          approve: (s) => `aprovar ${s.phase}`,
          tests: () => "escrever os testes e depois aprová-los (Fase 4)",
          tasks: () => "dividir em tarefas",
          implement: (s) => `tarefa ${s.task}`,
          blocked: () => "desbloquear as tarefas (_Depends:_)",
          verify: (s) => (s.suite ? `executar as verificações do projeto (${s.suite.join(", ")})` : `verificar a tarefa ${s.task}`),
          decide: (s) => (s.outcome ? "acrescentar a linha _Outcome:_ à decisão" : "escrever a decisão"),
          promote: () => "go — criar a spec da feature, arquivar o spike",
          archive: () => "no-go — arquivar o spike",
          pivot: () => "pivot — começar um novo spike",
          finish: (s) => (s.again ? "/spec-finish de novo" : "/spec-finish"),
          "sign-off": (s) => (s.again ? "aprovar execution de novo (sign-off)" : "aprovar execution (sign-off)"),
          finished: () => "concluída",
        },
        config: {
          head: "Status line — acrescenta isto ao ~/.claude/settings.json (todos os projetos) ou ao .claude/settings.local.json de um projeto (só nesta máquina — o caminho é desta máquina, por isso nunca no .claude/settings.json versionado):",
          after: "Resultado: uma linha — a feature mais ativa, as suas tarefas, as tarefas por verificar e o próximo passo — e nada fora de um projeto dev-spec.",
          cacheNote: "Este caminho é uma cópia com versão na cache de plugins do Claude Code (…/plugins/cache/…): depois de atualizar o plugin, volta a correr /spec-statusline — a cópia antiga é apagada 14 dias após uma atualização.",
          tryIt: (cmd) => `Experimenta: echo '{"cwd": "<pasta do projeto>"}' | ${cmd}`,
        },
      },
      planBridge: {
        byText: "dev-spec: o utilizador aprovou este plano. Para o acompanhar como spec (critérios EARS, tarefas rastreadas, gates de evidência), sugerir /spec-import — spec_import {tool: \"plan\", text: <o markdown do plano aprovado>} (CLI: " + DEV_SPEC + " import plan - < plan.md). O plano gravado em ~/.claude/plans está fora do projeto: importar o texto. Numa alteração rápida não é preciso; importar só com o OK do utilizador.",
        byPath: (rel) => `dev-spec: o utilizador aprovou este plano. Para o acompanhar como spec (critérios EARS, tarefas rastreadas, gates de evidência), sugerir /spec-import — spec_import {tool: "plan", path: "${rel}"} (CLI: ${DEV_SPEC} import plan ${rel}). Numa alteração rápida não é preciso; importar só com o OK do utilizador.`,
      },
      importText: {
        label: "(texto)",
        note: (tool, date) => `> Importado de ${tool} (texto) em ${date}.`,
        orText: "Ou passa o markdown como `text` em vez de `path` (spec_import {tool, text}; CLI: " + DEV_SPEC + " import <tool> - < plano.md).",
        textOnly: (tool, list) => `\`text\` importa um único documento — ferramenta ${list}; '${tool}' lê uma pasta: indica o \`path\`.`,
        pathAndText: "Indica `path` ou `text`, não os dois.",
        empty: (tool) => `O texto ${tool} está vazio — nada para importar.`,
      },
      completion: {
        badRequest: 'completion/complete precisa de `ref` ({type: "ref/prompt", name} ou {type: "ref/resource", uri}) e de `argument` {name, value} (texto).',
        promptsOff: "Este servidor não serve prompts (SPEC_MCP_PROMPTS=off) — nada para completar.",
        unknownTemplate: (uri, list) => `Template de recurso desconhecido '${uri}' — um de: ${list}.`,
        unknownArgument: (name, list) => `Argumento desconhecido '${name}' — um de: ${list}.`,
      },
    },

    secPrivacy: {
      sectionNames: {
        "Threat Model": "Modelo de Ameaças", "Security Requirements": "Requisitos de Segurança", "Authentication & Authorization": "Autenticação e Autorização",
        "Secrets & Key Management": "Gestão de Segredos e Chaves", "Security Testing": "Testes de Segurança",
        "Personal Data Inventory": "Inventário de Dados Pessoais", "Lawful Basis & Purpose": "Fundamento de Licitude e Finalidade",
        "Retention & Deletion": "Conservação e Eliminação", "Data Subject Rights": "Direitos dos Titulares dos Dados",
        "Processors & International Transfers": "Subcontratantes e Transferências Internacionais", "DPIA": "AIPD",
        "Consistency Model": "Modelo de Consistência", "Cross-system Writes": "Escritas entre Sistemas", "Delivery & Idempotency": "Entrega e Idempotência",
        "Concurrency": "Concorrência", "Failure Modes": "Modos de Falha",
        "API Contract": "Contrato da API", "Versioning & Compatibility": "Versionamento e Compatibilidade", "Error Model": "Modelo de Erros", "Pagination, Idempotency & Concurrency": "Paginação, Idempotência e Concorrência", "Rate Limits & Quotas": "Limites de Taxa e Quotas",
        "Design System Usage": "Uso do Design System", "UI States": "Estados da Interface", "Accessibility": "Acessibilidade", "Responsiveness & i18n": "Design Responsivo e i18n", "UI Performance Budget": "Orçamento de Desempenho da Interface",
        "SLIs & SLOs": "SLIs e SLOs", "Telemetry": "Telemetria", "Alerting & Runbooks": "Alertas e Runbooks", "Rollout & Rollback": "Lançamento e Reversão", "Health & Capacity": "Saúde e Capacidade",
        "Data Contracts & Schema Evolution": "Contratos de Dados e Evolução do Esquema", "Data Quality": "Qualidade dos Dados",
        "Pipeline Idempotency & Backfills": "Idempotência do Pipeline e Backfills", "Lineage & Ownership": "Linhagem e Responsáveis", "Retention & Cost": "Retenção e Custo",
      },
      allFilled: { sec: "as 5 preenchidas", privacy: "as 6 preenchidas", dist: "as 5 preenchidas", api: "as 5 preenchidas", ui: "as 5 preenchidas", obs: "as 5 preenchidas", data: "as 5 preenchidas" },
      statusSections: { sec: (list) => `Secções de segurança: ${list}`, privacy: (list) => `Secções de privacidade: ${list}`, dist: (list) => `Secções de consistência de dados: ${list}`, api: (list) => `Secções do contrato da API: ${list}`, ui: (list) => `Secções da interface: ${list}`, obs: (list) => `Secções de operabilidade: ${list}`,
        data: (list) => `Secções do pipeline de dados: ${list}` },
      finishChecks: {
        sec: ["+sec: SAST, auditoria de dependências e análise de segredos limpos numa execução local nova; todos os testes de casos de abuso a verde.",
          "+sec: modelo de ameaças revisto contra o código final — nenhum ponto de entrada ou fronteira de confiança novo sem mitigação."],
        privacy: ["+privacy: acesso/exportação e apagamento verificados de ponta a ponta nos repositórios reais (subcontratantes incluídos).",
          "+privacy: processo de conservação agendado; política de privacidade e registo das atividades de tratamento (art. 30.º) atualizados; decisão sobre a AIPD registada."],
        dist: ["+dist: testes de injeção de falhas a verde numa execução local nova — falha entre o commit e a publicação, entrega duplicada, atualizações concorrentes, uma dependência indisponível.",
          "+dist: nenhuma escrita entre sistemas no código final contorna a sua mitigação (outbox / inbox / saga) — nenhum commit na base de dados seguido de uma publicação direta."],
        api: ["+api: testes de contrato e a comparação de alterações incompatíveis com o contrato publicado a verde numa execução local nova.",
          "+api: o ficheiro do contrato corresponde ao comportamento entregue — cada código de estado, código de erro e cabeçalho documentado é o que os handlers devolvem; o que foi removido está descontinuado com a sua data de Sunset."],
        ui: ["+ui: a verificação automática de acessibilidade limpa e a passagem com teclado / leitor de ecrã feita na versão final; cada estado da matriz de estados alcançável e mostrado.",
          "+ui: o orçamento de desempenho medido na versão final (LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1) e a regressão visual dos estados revista."],
        obs: ["+obs: um alerta disparou numa falha encenada e o ensaio de reversão foi feito na versão final; os dashboards e runbooks a que os alertas ligam existem.",
          "+obs: as métricas, os logs e os traces que o design indica vistos a ser emitidos pela versão final — nenhum dado pessoal nos logs nem nos traces."],
        data: ["+data: as verificações de qualidade de dados, uma reexecução de partição e um ensaio de backfill a verde numa execução nova com dados de tamanho real — as mesmas linhas que uma execução, as linhas erradas em quarentena.",
          "+data: cada conjunto de dados que o código final escreve corresponde ao seu contrato (esquema, responsável, SLA de atualidade) e à linhagem, retenção e particionamento do design.md."],
      },
      clarify: {
        secAccess: "Especifica o que recebe quem chama sem autenticação ou sem autorização (SE … ENTÃO O SISTEMA DEVE negar …) e o nível ASVS que a feature visa.",
        secSecrets: "Especifica que segredos / credenciais a feature trata e que nenhum chega a uma resposta ou a um log (escreve-o como AC).",
        privacyRights: "Especifica os direitos dos titulares que a feature tem de satisfazer (acesso, apagamento, portabilidade…) como ACs, com o prazo de um mês.",
        privacyRetention: "Especifica durante quanto tempo é conservada cada categoria de dados pessoais e o que acontece quando esse prazo termina.",
        distDelivery: "Especifica a garantia de entrega (pelo menos uma vez) e como uma mensagem entregue duas vezes é detetada e aplicada uma só vez (chave de idempotência, inbox) — escreve-o como AC.",
        distFailure: "Especifica o que a feature faz quando cada dependência (base de dados, broker, API externa) está indisponível ou excede o tempo limite — como critérios SE … ENTÃO O SISTEMA DEVE.",
      },
    },

    markerSyntax: {
      unreadTasks: (list) => `linhas com caixa de verificação que não são tarefas: ${list} — uma linha de tarefa é "- [ ] N. texto" (um marcador -, * ou +, depois o número); estas nunca são marcadas, incluídas num brief nem verificadas. Numera-as (ou torna-as subpassos de uma tarefa); uma linha com 4+ espaços de indentação depois de uma linha em branco, fora de uma lista, é um bloco de código — tira-lhe a indentação.`,
      doctor: (list) => `texto com forma de marcador numa linha de tarefa não dá nenhum marcador: ${list} — as ferramentas não leem nada aí (nenhuma verificação é executada, nenhum ficheiro é rastreado). Escreve-o como _Verify: <comando>_ / _Implements: <caminho>_ / _Depends: 3_ (em itálico, com o valor lá dentro).`,
      suspiciousVerify: (list) => `um comando _Verify:_ parece mal escrito: ${list} — começa por _ ou * (um delimitador do marcador lido como parte dele), tem código entre crases lá dentro (dois comandos escritos como um: dá a cada um o seu _Verify:_; uma substituição de comando lê-se melhor como $(…)) ou tem uma aspa sem par. O done --run corre-o tal como está escrito: corrige o marcador.`,
      expectValue: (list) => `um valor de _Expect:_ que as ferramentas não conhecem: ${list} — o único valor é fail (_Expect: fail_: a execução da tarefa tem de FALHAR, um teste escrito antes da correção); qualquer outro valor deixa uma tarefa cuja execução tem de passar. Escreve _Expect: fail_, ou tira o marcador.`,
    },
    outsideCode: {
      doctor: (list) => `testes planeados fora do código de testes apontam para um artefacto que ainda é um modelo: ${list} — preenche-o (a execução de carga real, o conjunto de avaliação da própria feature) antes de considerar esses testes verificados.`,
    },

    verifyPipe: {
      brief: (cmds) => `⚠ ${cmds.map((c) => "`" + c + "`").join(", ")} ${cmds.length > 1 ? "encaminham" : "encaminha"} a saída para outro comando (pipe): o exit code de um pipeline é o do ÚLTIMO comando, por isso uma verificação que falha pode sair com 0 e passar por verificada. Tira o pipe, ou corre-o em bash depois de \`set -o pipefail\` (o cmd.exe não tem pipefail) — o exit code que reportas tem de ser o da própria verificação.`,
      runHint: (cmd) => `⚠ \`${cmd}\` encaminha a saída para outro comando (pipe): a shell só reporta o exit code do ÚLTIMO comando, por isso uma verificação que falha pode ficar registada como bem-sucedida — tira o pipe, ou começa-o com \`set -o pipefail;\` em bash (--shell bash); o cmd.exe não tem pipefail.`,
      doctor: (list) => `um comando _Verify:_ encaminha a saída para outro (pipe) — uma verificação que falha pode sair com 0 (um pipeline reporta o código do ÚLTIMO comando): ${list}. Tira o pipe ou usa \`set -o pipefail\` (bash).`,
      completeNote: (n, cmd) => `Tarefa ${n}: o comando registado encaminha a saída para outro (\`${cmd}\`) — o seu exit 0 é o do ÚLTIMO comando, por isso esta passagem pode esconder uma verificação que falha. Tira o pipe (ou usa \`set -o pipefail\` em bash) e corre-o de novo.`,
    },

    templates: {
      noSummary: "[a definir]",
      badAction: (a) => `Ação de templates desconhecida '${a}' — uma de: list, init, check.`,
      unknownArtifact: (a, list) => `Template desconhecido '${a}' — um de: ${list}, ou steering/<ficheiro>.md.`,
      writeFailed: (rel, why) => `Não foi possível escrever ${rel} (${why}).`,
      writeOutside: (rel) => `Recusei escrever ${rel}: a pasta é uma ligação para fora do projeto.`,
      legacyFeature: ".specs/templates/ é a pasta de uma feature criada antes de existirem templates do projeto (tem um .state.json) — continua a ser essa feature e nunca é lida como templates. Muda-lhe o nome (" + DEV_SPEC + " feature rename templates <novo-nome>, ou spec_feature rename) para usares templates do projeto.",
      builtIn: "de base",
      override: "do projeto",
      listHead: (lang, n) => `Templates para features em '${lang}' — ${n} template(s) do projeto em .specs/templates/ (um ficheiro em <lang>/ prevalece sobre um partilhado):`,
      ignored: (list) => `Ignorados — não são templates que o dev-spec conheça: ${list}`,
      initDone: (n) => `${n} template(s) de base copiado(s) para .specs/templates/ — edita-os; os novos scaffolds passam a usá-los:`,
      initKept: (list) => `Mantidos (já existiam — nunca são substituídos): ${list}`,
      initNothing: "Nada copiado — todos os templates pedidos já estão em .specs/templates/.",
      checkNone: "Nenhum template do projeto para verificar — .specs/templates/ não tem nenhum (`" + DEV_SPEC + " templates init` copia os de base).",
      checkHead: (n, errors, warnings) => `${n} ficheiro(s) de template verificado(s) — ${errors} erro(s), ${warnings} aviso(s).`,
      appends: (file, list) => `${file}: o motor acrescenta ele próprio as secções ${list} (o template não tem os respetivos títulos).`,
      problems: {
        empty: "vazio — ignorado; é usado o template de base.",
        "unknown-file": "não é um template que o dev-spec conheça (ver spec_templates list) — ignorado.",
        "unknown-variable": (v) => `{{${v}}} não é uma variável de template — fica tal como está (conhecidas: {{name}} {{slug}} {{summary}} {{tracks}} {{lang}} {{date}}).`,
        "no-placeholders": "nenhum campo [entre parênteses retos] nem linha > **TODO** — um scaffold por editar pareceria preenchido e o seu gate poderia ser aprovado sem alterações.",
        "missing-section": (marker, section) => `falta ${marker} ${section} — o template tem outros títulos ${marker}, por isso o motor não acrescenta nenhuma secção desse track e o doctor falha nesta.`,
        "no-sentinel": (marker, section) => `${marker} ${section} não tem linha > **TODO** — numa feature nova a secção pareceria preenchida (o template de base semeia uma).`,
        "constitution-missing": "sem secção Verificação da Constituição (Constitution Check) — o doctor avisa em todas as features criadas a partir dele.",
        "tradeoffs-missing": "sem secção Alternativas e Compromissos — o doctor avisa (design-tradeoffs) em todas as features criadas a partir dele.",
        "risks-missing": "sem secção Riscos — o doctor avisa (design-risks) em todas as features criadas a partir dele.",
        "reuse-missing": "sem secção Reutilização e Integração — o doctor avisa (design-reuse) em todas as features criadas a partir dele.",
        "no-criteria": "nenhum critério de aceitação (uma linha US-n.AC-m com DEVE) — nada para o EARS, o trace_check ou o plano de testes seguirem.",
        "ac-duplicate": (ids) => `IDs de AC duplicados: ${ids} — o doctor falha em todas as features criadas a partir dele.`,
        "phantom-ac": (ids, file) => `cita IDs de AC que ${file} não define: ${ids} — o trace_check reporta-os como fantasmas.`,
        "builtin-phantom": (file, ids) => `o ${file} de base (não substituído) cita IDs de AC que este template não define: ${ids} — substitui também o ${file}, ou mantém esses IDs.`,
        "phantom-test": (ids, file) => `põe a verde IDs de teste que ${file} não define: ${ids} — o trace_check reporta-os como testes desconhecidos em todas as features +tdd.`,
        "builtin-phantom-test": (file, ids) => `o ${file} de base de uma feature +tdd (não substituído) põe a verde IDs de teste que este template não define: ${ids} — substitui também o ${file}, ou mantém esses IDs.`,
        "root-cause-missing": "sem secção Causa Raiz — o gate do bugfix (root-cause do doctor) falharia em todos os bugfixes até ser acrescentada.",
        "root-cause-filled": "a Causa Raiz já parece escrita (texto, sem campo, sem linha > **TODO**) — um bugfix novo passaria o gate da causa raiz antes de a causa ser conhecida.",
        "repro-missing": "sem secção Reprodução — o doctor avisa em todos os bugfixes.",
        "repro-filled": "a Reprodução já parece escrita — um bugfix novo não pediria os passos.",
        "no-tasks": "nenhuma linha de tarefa (- [ ] 1. …) — um scaffold a partir dele não tem nada para executar.",
        "no-active-tracks": "sem título 'Tracks ativos' — o spec_add_track não consegue registar uma mudança de track no classification.md.",
        "filematch-no-pattern": "o front matter diz inclusion: fileMatch mas não indica nenhum fileMatchPattern — o ficheiro só é listado a pedido.",
      },
    },

    trackPacks: {
      acHeading: "Critérios de Aceitação (EARS)",
      taskHeading: (marker, title) => `História US-1 — ${marker} ${title}`,
      todoLine: "> **TODO** — substituir pelos valores reais (remover esta linha quando estiver feito).",
      defaultCriterion: (title) => `O SISTEMA DEVE [o comportamento de ${title} que esta feature garante]`,
      defaultTask: (marker, title) => `[US1] Cumprir os critérios ${marker} ${title} — preencher as secções de design, implementar e verificar`,
      rowLayer: "integração",
      rowDesc: "[comportamento]",
      checklistItem: (n) => `${n} secção(ões) obrigatória(s) de design preenchida(s) (sem TODO) — cada critério verificado.`,
      steeringStub: (title, name) => `# ${title}\n\n<!-- As normas de ${title} da equipa: todas as features +${name} as seguem (o spec_task_brief cita este ficheiro). -->\n- [fill me in]\n`,
      allFilled: (marker) => `todas as secções ${marker} preenchidas`,
      statusSections: (marker, list) => `Secções ${marker}: ${list}`,
      missing: (list) => `track pack(s) indisponível(eis): ${list} — o track fica inativo nesta feature até o pack voltar (${DEV_SPEC} tracks check).`,
      missingAbsent: (name) => `+${name} (não há .specs/tracks/${name}/ neste projeto)`,
      missingInvalid: (name, codes) => `+${name} (o pack é inválido: ${codes})`,
      missingReserved: (name, slug, builtIn, since) => `+${name} (um track pack anterior à ${since || "1.17"} — '${name}' é agora um nome reservado${builtIn ? `, e o track +${name} incluído NÃO se aplica a esta feature` : ""}: muda o nome de .specs/tracks/${name}/ (e do marcador, se também estiver reservado) e depois ${DEV_SPEC} add-track ${slug} <novo-nome> e ${DEV_SPEC} add-track ${slug} ${name} --remove${builtIn ? `; para usar o track incluído em vez dele: ${DEV_SPEC} add-track ${slug} ${name}` : ""})`,
      missingReservedMarker: (name, marker, track, slug, since) => `+${name} (um track pack anterior à ${since || "1.19"} — o seu marcador ${marker} é agora o do track +${track} incluído, por isso o pack é ignorado e as suas secções ${marker} não contam como as do +${track}: muda o marcador em .specs/tracks/${name}/track.json e nos títulos ${marker} desta feature; para usar o track incluído em vez dele: ${DEV_SPEC} add-track ${slug} ${track} (as secções dele são acrescentadas e o pack sai desta feature); para retirar o pack: ${DEV_SPEC} add-track ${slug} ${name} --remove)`,
      badAction: (a) => `Ação de tracks desconhecida '${a}' — uma de: list, init, check, signals.`,
      nameRequired: "o tracks init precisa de um nome — " + DEV_SPEC + " tracks init <nome> (spec_tracks {action: \"init\", name}).",
      unknownPack: (n, list) => `Não há track nem track pack '${n}' — os packs do projeto: ${list}.`,
      legacyFeature: ".specs/tracks/ é a pasta de uma feature criada antes de existirem track packs (tem um .state.json) — continua a ser essa feature e nunca é lida como packs. Muda-lhe o nome (" + DEV_SPEC + " feature rename tracks <novo-nome>, ou spec_feature rename) para usar track packs.",
      writeFailed: (rel, why) => `Não foi possível escrever ${rel} (${why}).`,
      writeOutside: (rel) => `Recusei escrever ${rel}: a pasta é uma ligação para fora do projeto.`,
      builtIn: "incluído",
      sectionCount: (n) => `${n} secção(ões)`,
      signalCount: (n) => `${n} sinal(is)`,
      invalid: (n) => `inválido (${n} erro(s)) — ignorado; detalhes: ${DEV_SPEC} tracks check`,
      noPacks: "Não há track packs em .specs/tracks/ — o `" + DEV_SPEC + " tracks init <nome>` cria um.",
      listHead: (builtIn, packs, valid) => `Tracks — ${builtIn} incluídos, ${packs} pack(s) do projeto em .specs/tracks/ (${valid} válido(s)):`,
      checkNone: "Não há track packs a verificar — .specs/tracks/ não tem nenhum (o `" + DEV_SPEC + " tracks init <nome>` cria um).",
      checkHead: (n, valid, errors, warnings) => `${n} track pack(s) verificado(s) — ${valid} válido(s), ${errors} erro(s), ${warnings} aviso(s).`,
      initDone: (name, n) => `Track pack +${name} criado (${n} ficheiro(s)) — edita-os; a partir de agora é um track válido:`,
      initKept: (list) => `Mantidos (já existiam — nunca são substituídos): ${list}`,
      initNothing: (name) => `Nada escrito — todos os ficheiros do pack +${name} já existem.`,
      initNext: (name) => `A seguir: verificar com ${DEV_SPEC} tracks check e usar com ${DEV_SPEC} add-track <feature> ${name} (spec_add_track) ou ao criar uma feature.`,
      initJson: (a) => `// Track pack +${a.name} — um track definido pelo projeto (dev-spec 1.15). Só dados: nada nesta pasta é executado.
// Guia: references/project-tracks.md · validação: dev-spec tracks check (spec_tracks {action: "check"}).
{
  // = o nome desta pasta: ^[a-z][a-z0-9]{1,19}$, nunca um track incluído (core tdd saas ai sec privacy dist api ui obs data).
  "name": "${a.name}",
  // O marcador estável (sensível a maiúsculas) das secções de design, dos critérios e do bloco de tarefas: [${a.token}].
  "marker": "${a.token}",
  // Aparece nos títulos ("#### [${a.token}] ${a.title} — Critérios de Aceitação (EARS)"); en é obrigatório, es / pt-BR opcionais.
  "title": { "en": "${a.title}", "pt": "${a.title}" },
  // Palavras-chave do classificador, comparadas como palavras inteiras (com flexões): uma "strong" liga o track, duas "weak" também,
  // uma "context" só corrobora outra. Uma palavra-chave em MAIÚSCULAS é uma sigla, comparada com maiúsculas e minúsculas exatas.
  "signals": { "strong": [], "weak": [], "context": [] },
  // As secções obrigatórias de design: o design.md recebe "## [${a.token}] <nome>" + uma linha > **TODO** para cada uma; o doctor
  // (${a.name}-sections) e a aprovação do design falham até todas estarem preenchidas. syn: outros títulos que contam (qualquer língua).
  "sections": [
    { "name": { "en": "Standards", "pt": "Normas" }, "syn": [], "guidance": { "en": "The ${a.title} standards this feature meets, and how each one is verified.", "pt": "As normas de ${a.title} que esta feature cumpre, e como cada uma é verificada." } },
    { "name": { "en": "Verification", "pt": "Verificação" }, "syn": [], "guidance": { "en": "Who checks it, with which tools, before the merge.", "pt": "Quem a verifica, com que ferramentas, antes do merge." } }
  ],
  // Opcional: o ficheiro de steering que o track traz (.specs/steering/<ficheiro>, escrito a partir do steering.md quando uma feature acrescenta o track).
  "steering": "${a.name}.md"
}
`,
      initRequirements: (a) => `<!-- Track pack +${a.name}: os critérios de aceitação com que começa cada feature +${a.name} — um item da lista = um critério, em EARS.
     O motor numera-os a seguir aos critérios US-1 da feature (US-1.AC-n), em "#### [${a.token}] ${a.title} — Critérios de Aceitação (EARS)".
     Os espaços [entre parênteses retos] continuam a ser placeholders do template até a feature os preencher. -->
- QUANDO [gatilho] O SISTEMA DEVE [o comportamento de ${a.title}]
- O SISTEMA DEVE [uma propriedade de ${a.title} que se mantém sempre]
`,
      initTasks: (a) => `<!-- Um item da lista = uma tarefa do bloco "História US-1 — [${a.token}] ${a.title}" da feature (numerada a seguir à última tarefa).
     {{ac1}}, {{ac2}}… = os critérios deste pack tal como a feature os numera, {{acs}} = todos; {{t1}}… / {{tests}} = os testes
     planeados para eles (+tdd — uma linha que não nomeie nenhum é deixada de fora). Uma tarefa sem _Requirements:_ recebe {{acs}}. -->
- [ ] [as decisões de design de ${a.title} desta feature]
  - _Requirements: {{acs}}_
- [ ] [implementar e verificar os critérios de ${a.title}]
  - _Requirements: {{acs}}_
  - _Makes green: {{tests}}_
`,
      initTestPlan: (a) => `<!-- Uma linha = um teste planeado (features +tdd) — as seis células do plano incluído; a célula Test ID é renumerada a seguir às do plano. -->
| Test ID | Camada | Tipo | Descrição | Cobre (IDs de AC) | Ficheiro |
|---------|--------|------|-----------|-------------------|----------|
| T-00 | integração | example | [o comportamento de ${a.title}, de ponta a ponta] | {{ac1}} | \`tests/integration/...\` |
| T-00 | unit | property | [a propriedade de ${a.title} sempre verdadeira] | {{ac2}} | \`tests/unit/...\` |
`,
      initChecklist: (a) => `<!-- Um item da lista = uma linha do checklist.md da feature ("- [ ] ${a.token}: …"). -->
- todas as secções de design [${a.token}] preenchidas (sem TODO) e revistas.
- [a verificação de ${a.title} que a equipa faz antes do merge]
`,
      initSteering: (a) => `# ${a.title}

<!-- As normas de ${a.title} da equipa — todas as features +${a.name} as seguem (o spec_task_brief cita este ficheiro). -->
- [fill me in]
`,
      // A regra que um campo do track.json viola / porque o track.json não é JSON — o motor passa um código (+ o limite), nunca texto
      rule: (r) => {
        const x = r && typeof r === "object" ? r : { id: r };
        return ({
          name: "= o nome da pasta", marker: "^[A-Z][A-Z0-9]{1,11}$", text: `2–${x.max} caracteres, uma só linha, sem [ ] < > \``,
          line: `uma só linha, ≤ ${x.max} caracteres`, signals: "{ strong?, weak?, context? }", keywords: "[palavra-chave, …]",
          sections: "[{ name, syn?, loose?, guidance? }, …] — pelo menos uma", section: "{ name, syn?, loose?, guidance? }",
          lead: "um nome depois da numeração / do emoji / do travessão", texts: "[texto, …]",
          guidance: `uma só linha, ≤ ${x.max} caracteres, sem <!-- -->`,
        })[x.id] || String(x.id);
      },
      jsonWhy: (a) => (a.why === "comment" ? "um comentário /* nunca é fechado" : a.why === "object" ? "não é um objeto JSON"
        : a.line ? `um erro de sintaxe na linha ${a.line}` : "um erro de sintaxe"),
      problems: {
        "linked-folder": "uma ligação (symlink / junction) ou uma pasta fora de .specs/ — ignorada: um pack só é lido da sua própria pasta.",
        "unknown-file": "não é um ficheiro de pack (track.json, requirements.md, tasks.md, test-plan.md, checklist.md, steering.md, <língua>/) — ignorado.",
        "too-many-packs": (a) => `mais de ${a.max} track packs — este é ignorado.`,
        "name-invalid": (a) => `'${a.name}' não é um nome de track (^[a-z][a-z0-9]{1,19}$ — letras minúsculas e dígitos) — o pack é ignorado.`,
        "name-reserved": (a) => `'${a.name}' está reservado (um track incluído, uma palavra para um, ou uma palavra que o dev-spec usa) — o pack é ignorado.`,
        "name-mismatch": (a) => `"name": "${a.name}" não é o nome da pasta '${a.folder}' — o pack é ignorado.`,
        "json-missing": "não há track.json — o pack é ignorado.",
        "json-invalid": (a) => `o track.json não é JSON válido (${MSG.pt.trackPacks.jsonWhy(a)}) — o pack é ignorado.`,
        "too-big": (a) => `${a.file} tem mais de ${a.max} bytes — o pack é ignorado.`,
        "fragment-linked": (a) => `${a.file} não é um ficheiro normal dentro de .specs/ (é uma ligação ou uma pasta) — o pack é ignorado.`,
        "field-missing": (a) => `falta "${a.field}" (${MSG.pt.trackPacks.rule(a.rule)}) — o pack é ignorado.`,
        "field-invalid": (a) => `"${a.field}" é inválido (${MSG.pt.trackPacks.rule(a.rule)}) — o pack é ignorado.`,
        "marker-invalid": (a) => `o marcador '${a.marker}' não é ^[A-Z][A-Z0-9]{1,11}$ — o pack é ignorado.`,
        "marker-reserved": (a) => `o marcador [${a.marker}] é do dev-spec (um marcador incluído, uma etiqueta de história / paralela ou um espaço genérico) — o pack é ignorado.`,
        "marker-duplicate": (a) => `o marcador ${a.marker} já é do pack +${a.other} — os marcadores são únicos; este pack é ignorado.`,
        "signal-invalid": (a) => `signals.${a.tier}: '${a.keyword}' não é uma palavra-chave (letras e dígitos com espaços, - ' . no meio — 2 a 60 caracteres; sempre comparada como palavra literal, nunca como padrão) — o pack é ignorado.`,
        "too-many": (a) => `${a.field}: mais de ${a.max} — o pack é ignorado.`,
        "section-duplicate": (a) => `a secção '${a.name}' tem o nome repetido — o pack é ignorado.`,
        "section-overlap": (a) => `as secções '${a.other}' e '${a.name}' podem responder ao mesmo título ('${a.heading}'): um nome ou sinónimo que começa o de outra deixa um só título preencher as duas — muda o nome de uma; o pack é ignorado.`,
        "steering-invalid": (a) => `o steering '${a.file}' não é um nome de ficheiro de steering (minúsculas, dígitos e -, terminado em .md; não um nome de dispositivo) — o pack é ignorado.`,
        "steering-shared": (a) => `o steering ${a.file} também é um ficheiro de steering incluído — fica o que for escrito primeiro.`,
        "unknown-key": (a) => `chave desconhecida "${a.key}" — ignorada.`,
        "unknown-variable": (a) => `{{${a.v}}} não é uma variável de pack — fica como está (conhecidas: {{ac1}}… {{acs}} {{t1}}… {{tests}} {{title}} {{marker}} {{name}} {{slug}}).`,
        "fragment-empty": (a) => `${a.file} não tem nada que o motor leia — é usado o padrão incluído.`,
        "fragment-row": (a) => `uma linha de ${a.file} sem as seis células do plano (Test ID | Camada | Tipo | Descrição | Cobre | Ficheiro) — o pack é ignorado.`,
        "fragment-ref": (a) => a.kind === "t" && a.file !== "tasks.md" ? `${a.ref} não pode ser usado em ${a.file} — só o tasks.md nomeia os testes planeados — o pack é ignorado.`
          : `${a.ref} não nomeia nada ${a.ctx ? "nas features " + a.ctx : "na raiz do pack"}: ${a.from || "o padrão incluído"} dá ${a.n} ${a.kind === "ac" ? "critério(s)" : "teste(s) planeado(s)"} — o pack é ignorado.`,
        "section-name-lead": (a) => `o nome de secção '${a.name}' começa por numeração, um emoji ou um travessão — ignorado ao comparar títulos: conta como '${a.key}'.`,
        "section-core-name": (a) => `a secção '${a.name}' tem o nome de um título do design base ('${a.heading}') — só conta um título com o marcador do pack (ou debaixo de um); a secção base nunca conta.`,
      },
    },

    stakeholderExport: {
      autogen: "AUTO-GERADO por dev-spec — não editar à mão. Para regenerar: spec_export (dev-spec export).",
      kicker: { feature: "Especificação da feature", bugfix: "Especificação do bugfix", change: "Especificação da alteração", project: "Especificação do projeto" },
      projectTitle: (proj) => `${proj} — visão geral da especificação`,
      generated: (date) => `gerado a ${date} a partir das specs do projeto (.specs/)`,
      meta: { id: "Feature", kind: "Tipo", tracks: "Tracks", phase: "Fase", progress: "Progresso", status: "Estado", lang: "Idioma", overall: "Progresso global" },
      kind: { feature: "feature", bugfix: "bugfix", change: "alteração (tamanho xs)" },
      progress: (done, total, pct) => `${done}/${total} tasks feitas · ${pct}%`,
      overall: (pct, complete, total, done, tasks) => `${pct}% · ${complete}/${total} features completas · ${done}/${tasks} tasks feitas`,
      sections: {
        contents: "Índice", summary: "Resumo", stories: "Histórias de utilizador e critérios de aceitação", successCriteria: "Critérios de sucesso", bug: "Relatório do bug",
        design: "Design", testPlan: "Plano de testes", tasks: "Tasks", decisions: "Decisões", approvals: "Aprovações", clarifications: "Clarificações em aberto",
        roadmap: "Roadmap", backlog: "Backlog", catalog: "Catálogo vivo",
      },
      cols: { task: ["#", "Task", "Estado", "Verificação"], approval: ["Fase", "Aprovado por", "Quando", "Notas"], roadmap: ["Feature", "Tracks", "Fase", "Progresso", "Tasks", "Depende de"] },
      taskStatus: { done: "✅ feita", open: "☐ por fazer" },
      verification: { verified: "verificada", nothing: "nada a verificar", open: "—", unverified: (why) => "⚠ não verificada" + (why ? ` (${why})` : "") },
      phases: { classification: "Classificação", requirements: "Requisitos", design: "Design", "test-plan": "Plano de testes", "eval-plan": "Plano de evals", tests: "Testes (Fase 4)", tasks: "Tasks", execution: "Aprovação da execução" },
      forced: (ids) => `aprovado com --force (a falhar: ${ids})`,
      changedSince: "alterado desde esta aprovação — a rever de novo",
      planPhase: "Plano (change.md)",
      criteria: "Critérios de aceitação",
      pending: "a aguardar aprovação",
      template: "template — ainda por escrever",
      supersededBy: (list) => `substituído por ${list}`,
      toBeSupersededBy: (list) => `substituição prevista por ${list} (ainda não entregue)`,
      supersedes: (list) => `substitui ${list}`,
      blocked: (list) => `bloqueada por ${list}`,
      none: "Nada.",
      noSummary: "Ainda sem resumo.",
      noStories: "Ainda sem histórias de utilizador nem critérios de aceitação.",
      noDesign: "Ainda sem design.",
      noTasks: "Ainda sem tasks.",
      noApprovals: "Ainda nenhuma fase aprovada.",
      noClarifications: "Nenhuma — não há marcadores [NEEDS CLARIFICATION] por resolver.",
      noFeatures: "Ainda sem features.",
      theme: "Tema",
      print: "Imprimir",
      wrote: (file) => `✎ gerado ${file}`,
      exportsIsFeature: (dir) => `${dir} é uma pasta de feature anterior à reserva do nome 'exports' pelo dev-spec (contém requirements.md / .state.json) — move ou renomeia essa pasta à mão e volta a exportar.`,
      exportsLinked: (rel) => `Recusei escrever ${rel}: .specs/exports/ ou esse ficheiro é uma ligação (simbólica, ou uma junction) ou aponta para fora de .specs/ — substitui-a por uma pasta / um ficheiro normal e volta a exportar. Nada foi escrito.`,
    },
    rtm: {
      title: "Matriz de rastreabilidade",
      projectTitle: "Rastreabilidade",
      autogen: "AUTO-GERADO por dev-spec — não editar à mão. Para regenerar: dev-spec export --csv (spec_export format csv).",
      cols: {
        feature: "Feature", id: "ID", kind: "Tipo", requirement: "Requisito", status: "Estado", gaps: "Lacunas", template: "Template", design: "Secções do design",
        tasks: "Tasks", tests: "Testes", testFiles: "Ficheiros de teste", evidence: "Última evidência", decisions: "Decisões", supersedes: "Critérios que substitui",
        supersededBy: "Substituído por", approvedAt: "Requisitos aprovados", approvedBy: "Aprovado por", changed: "Alterado desde a aprovação",
      },
      projectCols: ["Feature", "Requisitos", "Verificados", "Implementados", "Planeados", "Sem rastreio"],
      status: { verified: "verificado", implemented: "implementado", planned: "planeado", untraced: "sem rastreio" },
      gap: {
        "no-task": "nenhuma task o cita", "no-test": "nenhuma linha do plano de testes o cobre", "no-coverage": "nenhuma task nem teste planeado o cobre",
        "no-coverage-sc": "nenhuma linha do plano de testes nem do quickstart o cobre",
      },
      yes: "sim", no: "não", unknown: "desconhecido",
      forced: "forçada",
      task: {
        verified: (n) => `#${n} verificada`, nothing: (n) => `#${n} feita (nada a verificar)`, open: (n) => `#${n} por fazer`,
        unverified: (n, why) => `#${n} feita, não verificada${why ? ` (${why})` : ""}`,
      },
      evidence: (n, cmd, code, at, commit, expectedFail) => `#${n}: ${cmd} → saída ${code}${expectedFail ? " (execução vermelha, falha esperada)" : ""}${commit ? ` @${commit}` : ""}${at ? ` · ${at}` : ""}`,
      evidenceNote: (n, note, at) => `#${n}: nota — ${note}${at ? ` · ${at}` : ""}`,
      notInCode: "em nenhum ficheiro de teste",
      outsideCode: "executado fora do código de teste",
      template: "template — ainda por escrever",
      supersededBy: (list) => `substituído por ${list}`,
      toBeSupersededBy: (list) => `substituição prevista por ${list} (ainda não entregue)`,
      changedSince: "alterado desde a aprovação dos requisitos",
      legend: "Uma linha por ID de requisito. Tasks: ✅ verificada · ⚠ feita, não verificada · ☐ por fazer. Estado: verificado — todas as tasks ligadas feitas e verificadas; implementado — feitas, nem todas verificadas; planeado — rastreado, com trabalho por fazer; sem rastreio — uma lacuna de rastreio (indicada).",
      projectLegend: "IDs de requisito (AC / EC / NFR / SC) por feature, por estado de rastreabilidade — a exportação de cada feature tem a sua matriz.",
      approvedLine: (at, by, forced) => `Requisitos aprovados em ${at} por ${by}${forced ? " (com --force)" : ""}.`,
      notApproved: "Requisitos ainda não aprovados.",
      planApprovedLine: (at, by, forced) => `Plano (change.md) aprovado em ${at} por ${by}${forced ? " (com --force)" : ""}.`,
      planNotApproved: "Plano (change.md) ainda não aprovado.",
      changedSincePlan: "alterado desde a aprovação do plano",
      none: "Ainda sem IDs de requisito.",
      cli: {
        head: (feature, tracks, c) => `Matriz de rastreabilidade — ${feature} (${tracks}): ${c.rows} requisito(s) · ${c.verified} verificado(s) · ${c.implemented} implementado(s) · ${c.planned} planeado(s) · ${c.untraced} sem rastreio`,
        legend: "tasks: ✓ verificada · ▲ feita, não verificada · ○ por fazer",
        codeLegend: "testes: ✓ nomeado num ficheiro de teste · ✗ em nenhum ficheiro de teste · ○ executado fora do código de teste",
        approved: (at, by, forced) => `requisitos aprovados em ${at} por ${by}${forced ? " (forçada)" : ""}`,
        notApproved: "requisitos ainda não aprovados",
        planApproved: (at, by, forced) => `plano (change.md) aprovado em ${at} por ${by}${forced ? " (forçada)" : ""}`,
        planNotApproved: "plano (change.md) ainda não aprovado",
        notes: { template: "template", superseded: (list) => `substituído por ${list}`, changed: "alterado desde a aprovação" },
      },
    },
    releaseNotes: {
      title: (proj) => `Notas de versão — ${proj}`,
      autogen: "AUTO-GERADO por dev-spec — não editar à mão. Para regenerar: spec_changelog {write: true} (dev-spec changelog --write).",
      sinceDate: (d) => `Alterações desde ${d}`,
      sinceLast: (d) => `Alterações desde as últimas notas de versão (${d})`,
      all: "Todas as alterações registadas nas specs",
      generated: (d) => `geradas a ${d}`,
      added: "Adicionado",
      changed: "Alterado",
      fixed: "Corrigido",
      none: "Nada.",
      rootCause: (t) => `Causa raiz: ${t}`,
      noRootCause: "causa raiz por escrever no bug.md",
      changeRequest: (n, phase, d) => `pedido de alteração #${n} (${phase}, ${d})`,
      crParts: { added: (l) => `adicionado: ${l}`, modified: (l) => `alterado: ${l}`, removed: (l) => `removido: ${l}`, reopened: (l) => `tasks reabertas: ${l}` },
      wrote: (file, a, c, f) => `✎ gerado ${file} — ${a} adicionado(s) · ${c} alterado(s) · ${f} corrigido(s)`,
      nothingToWrite: (file) => `Nada a reportar desde então — ${file} não foi escrito e meta.changelogAt fica como estava.`,
      badSince: (v) => `since: '${v}' não é uma data ISO (AAAA-MM-DD, ou um timestamp ISO completo), 'last' nem 'all'.`,
      noLast: "Ainda não foram escritas notas de versão (roadmap.json meta.changelogAt não está definido) — são listadas todas as alterações.",
    },
    gherkin: {
      autogen: "AUTO-GERADO por dev-spec — não editar à mão. Para regenerar: spec_export {format: \"gherkin\"} (dev-spec export <feature> --gherkin).",
      source: (rel) => `Origem: ${rel} — um cenário por critério de aceitação em vigor; EARS → Dado (ENQUANTO / ONDE / SE) · Quando (QUANDO) · Então (a cláusula DEVE).`,
      summaryLabel: "Resumo",
      template: (id) => `${id} — template, ainda por escrever: deixado de fora`,
      superseded: (id, by) => `${id} — substituído por ${by} (entregue): deixado de fora`,
      unsplit: "cláusulas EARS sem separação limpa — o critério inteiro é um único passo Então",
      noScenarios: "Ainda sem critérios de aceitação em vigor.",
      spike: (slug) => `'${slug}' é um spike — não tem critérios de aceitação a exportar em Gherkin (spec_export {name: "${slug}"} sem o formato gherkin exporta o seu documento).`,
      wroteMany: (n, scenarios) => `✎ gerados ${n} ficheiro(s) .feature — ${scenarios} cenário(s)`,
      noFeatures: "Nenhuma feature ativa com critérios de aceitação a exportar.",
    },
    trackerCsv: {
      autogen: "AUTO-GERADO por dev-spec — não editar à mão; deixa esta coluna sem mapeamento. Para regenerar: spec_export {format: \"jira\" | \"linear\"} (dev-spec export --tracker jira|linear).",
      featureLine: (rel, tracks, phase, done, total) => `feature dev-spec ${rel} · tracks ${tracks} · fase: ${phase} · ${done}/${total} tasks feitas`,
      acceptance: "Critérios de aceitação:",
      taskLine: (rel, n) => `task dev-spec #${n} — ${rel}`,
      wrote: (file, n) => `✎ gerado ${file} — ${n} item(s) de trabalho`,
    },
    adr: {
      autogen: "AUTO-GERADO por dev-spec a partir do registo de decisões (.specs/<feature>/decisions.md) — regista as decisões aí (spec_decide), nunca neste ficheiro. Para regenerar: spec_export {format: \"adr\"} (dev-spec export --adr --write).",
      h: { context: "Contexto e Definição do Problema", outcome: "Resultado da Decisão", consequences: "Consequências", more: "Mais Informação" },
      labels: { status: "Estado", date: "Data", supersedes: "Em substituição de", feature: "Feature", entry: "Registo de decisões", affects: "Afeta" },
      accepted: "Em vigor",
      supersededBy: (ref) => `Substituída por ${ref}`,
      indexTitle: (name) => `Registos de Decisões de Arquitetura — ${name}`,
      indexIntro: (feature, log) => `As decisões de ${feature}, um ficheiro MADR cada, a partir do seu [registo de decisões](${log}). O número de um ADR é o da sua decisão: D-3 → 0003.`,
      projectIntro: "As decisões de todas as features, um ficheiro MADR cada, numeradas por feature: o número de um ADR é o da sua decisão (D-3 → 0003).",
      cols: ["ADR", "Título", "Estado", "Data"],
      projectCols: ["Feature", "ADR", "Título", "Estado", "Data"],
      archived: "arquivada",
      discoveries: (list) => `Não exportadas como ADR — descobertas (o que se aprendeu, não o que se decidiu): ${list}.`,
      duplicates: (list) => `Escritas mais de uma vez em decisions.md — só a primeira entrada é exportada: ${list}.`,
      nothing: "Ainda sem decisões registadas — nenhum ADR a exportar.",
      removed: (file) => `✗ removido ${file} — já nenhuma decisão o sustenta`,
      stale: (file) => `obsoleto: ${file} — o --write remove-o (já nenhuma decisão o sustenta)`,
      summary: (n, w, u, r) => `ADR: ${n} — ${w} ficheiro(s) gerado(s) · ${u} sem alterações · ${r} removido(s)`,
    },
    milestone: {
      title: "Marcos",
      cols: ["Marco", "Data", "Features", "Feitas", "ETA", "Estado"],
      status: { "on-track": "no prazo", "at-risk": "em risco", late: "atrasado", done: "concluído" },
      archivedLabel: "arquivadas",
      line: (name, date, done, total, eta, status, feats, archived) => `${name} — ${date} · ${done}/${total} feature(s) feitas · ETA ${eta || "—"} · ${status} · ${feats || "—"}${archived ? ` (arquivadas: ${archived})` : ""}`,
      head: (n, today) => `${n} marco(s) — hoje ${today}:`,
      none: "Ainda sem marcos — adiciona um: " + DEV_SPEC + " milestone add <nome> <AAAA-MM-DD> <features…> (spec_milestone {action: \"add\", name, date, features}).",
      added: (name, date, list) => `Marco '${name}' adicionado — ${date}: ${list}`,
      updated: (name, date, list) => `Marco '${name}' atualizado — ${date}: ${list}`,
      removed: (name) => `Marco '${name}' removido.`,
      attention: {
        late: (date, done, total, eta) => `marco atrasado — a data ${date} já passou com ${done}/${total} feature(s) feitas${eta ? ` (ETA ${eta})` : ""}`,
        "eta-after-date": (date, eta) => `marco em risco — o ETA mais tardio das suas features (${eta}) é posterior à data ${date}`,
        "eta-unknown": (date, eta, list) => `marco em risco — ainda sem ETA para ${list} (data ${date}): dados de velocidade insuficientes, ou ainda sem tasks`,
        "no-features": (date) => `marco em risco — já não tem nenhuma feature ativa (data ${date})`,
        invalid: (n, names, rel) => `${n} entrada(s) inválida(s) (${names}) em ${rel} — ignoradas: sem estado, e renomear / arquivar / remover / restaurar uma feature não as atualiza; corrige-as à mão (um nome válido, um dia AAAA-MM-DD real, listas de slugs de features, uma entrada por nome).`,
        notList: (rel) => `${rel} → meta.milestones não é uma lista — nenhum marco é lido, e renomear / arquivar / remover / restaurar uma feature não o atualiza; corrige-o à mão.`,
      },
      nameRequired: "Indica o nome do marco (name).",
      badName: (v) => `nome de marco inválido '${v}' — letras, dígitos, espaços e . _ : # ( ) + - (até 60 caracteres, a começar por uma letra ou um dígito).`,
      badDate: (v) => `date: '${v}' não é um dia no formato AAAA-MM-DD (p. ex. 2026-10-31).`,
      noFeatures: "Indica pelo menos uma feature do marco (features).",
      unknownFeatures: (list) => `Cada feature do marco tem de ser uma feature ativa existente — não encontrada(s): ${list}`,
      tooMany: (max) => `no máximo ${max} marcos — remove um primeiro (${DEV_SPEC} milestone rm <nome>).`,
      tooManyFeatures: (max) => `no máximo ${max} features por marco.`,
      notFound: (name, list) => `Não existe o marco '${name}' (marcos: ${list}).`,
      badStored: (rel) => `${rel} → meta.milestones não é uma lista de {name, date, features} como o milestone add os escreve (um nome válido, um dia AAAA-MM-DD real, uma entrada por nome) — corrige-o à mão; recuso alterá-lo.`,
      notesTitle: (title, name) => `${title} — ${name}`,
      notesScope: (name, date, list) => `Marco ${name} (${date}): ${list}`,
      notesAutogen: "AUTO-GERADO por dev-spec — não editar à mão. Para regenerar: spec_changelog {milestone, write: true} (dev-spec changelog --milestone <nome> --write).",
      nothingToWrite: (file) => `Nada a reportar para este marco — ${file} não foi escrito.`,
    },

    governance: {
      rolesShape: "approvalRoles tem de associar fases a listas de papéis, p. ex. {\"requirements\": [\"product\"], \"design\": [\"tech\", \"security\"]} (CLI: --roles requirements=product,design=tech+security; --roles none remove-os)",
      rolesPhase: (phase, known) => `approvalRoles: fase desconhecida '${phase}' (conhecidas: ${known})`,
      rolesEmpty: (phase) => `approvalRoles.${phase}: indica pelo menos um papel`,
      badRole: (role) => `nome de papel inválido '${role}' — usa letras, dígitos, '-', '_' ou '.' (no máximo 40 caracteres)`,
      rolesSet: (summary) => `Papéis de aprovação: ${summary} — cada fase indicada só conta como aprovada quando todos os papéis tiverem validado o seu conteúdo atual (spec_approve {role} / --role).`,
      rolesCleared: "Papéis de aprovação removidos — cada fase volta a precisar de uma única aprovação.",
      phaseRequired: "Indica a fase a aprovar — ou through: <fase> (CLI: --through <fase>) para avançar rapidamente até ela.",
      roleRequired: (phase, slug, roles) => `'${phase}' é validada por papel (${roles}) — indica o papel com que validas: /approve ${slug} ${phase} --role <papel> (spec_approve {role}). Nada foi registado.`,
      roleNotListed: (role, phase, roles) => `'${role}' não é um papel que valide '${phase}' (papéis: ${roles}) — nada foi registado.`,
      missing: (list) => `${list.length > 1 ? "faltam os papéis" : "falta o papel"}: ${list.join(", ")}`,
      stepForced: (ids) => ` (forçada: ${ids.join(", ")})`,
      signedOff: (phase, slug, role) => `'${phase}' de ${slug} validada como ${role} ✓`,
      signedForced: (ids) => `Validado com force — as verificações a falhar ficam registadas com a validação: ${ids}.`,
      stillPending: (phase, missing) => `'${phase}' continua pendente até todos os papéis validarem o seu conteúdo atual — ${missing}.`,
      approvedByRoles: (phase, roles) => `'${phase}' está aprovada — todos os papéis validaram o conteúdo atual: ${roles}.`,
      sameSigner: (by, phase, roles) => `Nota: ${by} validou '${phase}' por vários papéis (${roles}) — as validações por papel pressupõem pessoas diferentes.`,
      staleSignOffs: (list) => `as validações feitas antes de o artefacto mudar já não contam (volta a validar o conteúdo atual): ${list}`,
      resigning: (list) => `nova validação em curso (a fase continua aprovada como estava até todos os papéis validarem o novo conteúdo): ${list}`,
      unsigned: (list) => `aprovado sem as validações por papel agora exigidas (aprovado antes de os papéis serem configurados ou alterados — conta como aprovado por um papel desconhecido; pede a cada papel que volte a validar): ${list}`,
      approveRoles: (phase, slug, missing, signed, first) => `Revê e valida '${phase}' — ${missing}${signed ? ` (já validaram: ${signed})` : ""}: /approve ${slug} ${phase} --role ${first}.`,
      signedAll: (roles) => `todos os papéis validaram: ${roles} — ainda não aprovada`,
      signoffsComplete: (list, cmd) => `todos os papéis validaram, mas a fase nunca foi aprovada (as validações foram registadas à parte — em dois ramos combinados, ou antes de um papel ser retirado): ${list} — um desses papéis volta a validar para a concluir: ${cmd}`,
      completeSignoffs: (phase, slug, signed, first) => `Todos os papéis validaram '${phase}' (${signed}), mas a fase ainda não está aprovada — as validações foram registadas à parte (dois ramos combinados?). Um deles volta a validar para a concluir: /approve ${slug} ${phase} --role ${first}.`,
      roadmapAwaiting: (list) => `à espera de validação por papel: ${list}`,
      resignHint: (list, cmd) => `Cada papel volta a validar o novo conteúdo — ${list}: ${cmd}.`,
      ffBoth: "Passa uma fase ou through (o avanço rápido), não as duas.",
      ffExecution: "O avanço rápido cobre só as fases de planeamento (no máximo até 'tasks') — valida 'execution' à parte, depois do /spec-finish.",
      ffNotActive: (phase, slug) => `'${phase}' não é uma fase aprovável de '${slug}' neste momento (o track está desativado, ou o plano que valida ainda não existe) — nada foi aprovado.`,
      ffNothing: (slug, through) => `Nada para avançar: todas as fases ativas de '${slug}' até '${through}' já estão aprovadas.`,
      ffDone: (slug, list, through) => `Avanço rápido de '${slug}': ${list} aprovadas, por ordem, cada uma pelo seu próprio gate — todas as fases até '${through}' estão aprovadas.`,
      ffStopped: (slug, phase, list, why) => `O avanço rápido de '${slug}' parou em '${phase}'${list ? ` (aprovadas antes: ${list})` : " (nada aprovado)"} — ${why}`,
      ffWhyRefused: (ids, lines, slug, phase) => `o gate recusa-a — verificações a falhar: ${ids}.\n${lines}\nCorrige-as (detalhes: /spec-doctor ${slug}) e volta a correr o avanço rápido (retoma em '${phase}').`,
      ffWhyRoles: (missing) => `validada, mas fica à espera dos outros papéis (${missing}) — as fases seguintes não podem ser aprovadas antes dela.`,
      ffWhyRole: (roles, slug, phase, through, given) => (given ? `'${given}' não é um papel que valida '${phase}' (papéis: ${roles})` : `'${phase}' é validada por papel (${roles})`) +
        ` — nada foi registado para '${phase}'. Volta a correr o avanço rápido com o papel com que validas: /spec-ff ${slug} --role <papel> (CLI: ${DEV_SPEC} approve ${slug} --through ${through} --role <papel>); o avanço rápido retoma em '${phase}'.`,
      ffHint: (slug, list, role) => `Todos os artefactos de planeamento até às tasks estão preenchidos e passam o seu gate — avanço rápido: /spec-ff ${slug}${role ? " --role " + role : ""} (CLI: ${DEV_SPEC} approve ${slug} --through tasks${role ? " --role " + role : ""}) aprova ${list} por ordem, cada uma pelo seu próprio gate.`,
      ffHintTests: (slug, list, through, role) => `Todos os artefactos de planeamento até ${through} estão preenchidos e passam o seu gate — avanço rápido: /spec-ff ${slug} ${through}${role ? " --role " + role : ""} (CLI: ${DEV_SPEC} approve ${slug} --through ${through}${role ? " --role " + role : ""}) aprova ${list} por ordem, cada uma pelo seu próprio gate. Depois a Fase 4: escrever os testes que falham / os conjuntos de avaliação (/writeTests ${slug}), aprovar os testes e depois as tasks.`,
      batch: (n) => `  aprovações em lote (avanço rápido): ${n}`,
    },

    undo: {
      unticked: (n, slug, runnable, stale) => `A tarefa ${n} voltou a ficar aberta (desmarcada).` +
        (stale ? ` A evidência registada deixou de contar — voltar a marcá-la exige ${runnable ? `uma nova execução do seu comando _Verify:_: ${DEV_SPEC} done ${slug} ${n} --run` : "nova evidência"}.` : ""),
      alreadyOpen: (n) => `A tarefa ${n} não está marcada — nada a desfazer.`,
      redKept: (n, slug, day) => `A execução vermelha de ${day} (a prova do _Expect: fail_) mantém-se: voltar a marcá-la exige uma nova execução do seu comando _Verify:_ — com a correção feita, uma execução com sucesso conta como a correção que deixa o teste verde: ${DEV_SPEC} done ${slug} ${n} --run.`,
      duplicateTicked: (n, list) => `Várias tarefas marcadas partilham o número ${n} (${list}) — o undo não consegue saber qual das marcações foi o engano. Renumera-as primeiro para que cada número seja único (doctor: duplicate-tasks); depois, desfaz a que foi marcada por engano. Nada foi alterado.`,
      duplicateItem: (line, text) => `linha ${line}: "${text}"`,
      reopened: (slug) => `'${slug}' já estava concluída ou validada — quando a tarefa voltar a estar feita, conclui-a de novo (/spec-finish ${slug}) e volta a validar a execução (/approve ${slug} execution).`,
      noEvidence: "undo não aceita evidência — só desmarca a tarefa (regista a nova execução quando a voltares a marcar).",
      reasonNeedsUndo: "reason acompanha undo (spec_complete_task {undo: true, reason} / " + DEV_SPEC + " undone <feature> <n> --reason \"…\") — ao marcar uma tarefa regista-se evidência.",
      badReason: (max) => `reason tem de ser texto (uma linha, no máximo ${max} caracteres).`,
      staleNote: (n, slug, runnable) => `Tarefa ${n}: foi desmarcada depois de esta evidência ser registada — continua não verificada até se registar ` +
        (runnable ? `uma nova execução: ${DEV_SPEC} done ${slug} ${n} --run` : "nova evidência."),
      label: "desmarcada depois de esta evidência ser registada",
      cliDone: (n, done, total) => `Tarefa ${n} desmarcada. ${done}/${total}`,
      cliAlready: (n, done, total) => `A tarefa ${n} não estava marcada. ${done}/${total}`,
      driftWhy: (list) => `desmarcada(s) depois: ${list}`,
      signOffWhy: (list) => `a desmarcação de ${list}`,
    },
    revoke: {
      revoked: (phase, slug) => `Aprovação de '${phase}' revogada em ${slug} — a fase volta a estar pendente (o doctor, o next_action e o spec_finish pedem-na).`,
      withdrawn: (phase, slug, roles) => `Retiradas as validações por papel à espera para '${phase}' de ${slug}: ${roles} — ainda nada estava aprovado.`,
      signOffsToo: (roles) => `As validações por papel que estavam à espera também foram retiradas: ${roles}.`,
      laterStay: (list, phase) => `Nada em cascata: as fases seguintes continuam aprovadas (${list}); aprovar outra fase é recusado (phase-order) até '${phase}' voltar a ser aprovada.`,
      notApproved: (phase, slug) => `'${phase}' não está aprovada em ${slug} e nenhuma validação por papel está à espera — nada a revogar.`,
      changedSincePreview: (phase, slug) => `Nada revogado: '${phase}' de ${slug} mudou depois de se pedir ao utilizador para confirmar a revogação (aprovada de novo, ou revogada, entretanto) — a confirmação cobria o que lhe foi mostrado. Volta a pedir a confirmação ao utilizador, para que confirme o que existe agora.`,
      roleRequired: (phase, slug, roles) => `'${phase}' é validada por papel (${roles}) — uma revogação indica o papel que revoga: /approve ${slug} ${phase} --revoke --role <papel>. Nada foi registado.`,
      noSignOff: (role, phase, slug, waiting) => `'${role}' não tem nenhuma validação à espera para '${phase}' de ${slug} — nada a retirar (à espera: ${waiting}); cada papel só retira a sua própria validação.`,
      phaseRequired: "Indica a fase cuja aprovação queres revogar.",
      noThrough: "revoke aceita uma só fase — não through (o avanço rápido).",
      noForce: "revoke não aceita force nem expires — serve para retirar uma aprovação; reason diz porquê.",
      driftWhy: (list) => `aprovação revogada: ${list} (volta a aprová-la antes de voltar a fechar a feature)`,
      signOffWhy: (list) => `a revogação de ${list}`,
    },
    waiver: {
      badExpires: (v, max) => `expires tem de ser uma data ISO (AAAA-MM-DD, hoje ou depois em UTC — válida até ao fim desse dia, UTC — no máximo daqui a ${max} dias) ou um número de dias (30d, 1–${max}) — recebido: ${v}.`,
      needsForce: "reason / expires descrevem uma exceção (waiver) — acompanham force (reason também acompanha revoke).",
      notForced: "O gate passou — nada foi dispensado: o motivo / a validade não foram registados.",
      recorded: (reason, expires) => `Exceção registada${reason ? `: ${reason}` : ""}${expires ? ` (válida até ${expires})` : ""}.`,
      doctor: (list, slug) => `aprovações forçadas cuja exceção expirou: ${list} — corrige as verificações a falhar e volta a aprovar sem force (/approve ${slug} <fase>); para renovar a exceção: /approve ${slug} <fase> --force --reason "…" --expires 30d`,
      expiredItem: (phase, expires, reason) => `${phase} (expirou a ${expires}${reason ? ` — ${reason}` : ""})`,
      roadmapItem: (phase, reason, expires, expired) => `${phase} (${[reason ? `exceção: ${reason}` : "exceção", expires ? (expired ? `EXPIROU a ${expires}` : `até ${expires}`) : null].filter(Boolean).join(", ")})`,
      prHeading: "## Gates dispensados (aprovações forçadas)",
      prLine: (phase, failing, reason, expires, expired) => `- ${phase} — forçada apesar de: ${failing || "—"} · ${reason ? `motivo: ${reason}` : "sem motivo registado"}${expires ? ` · ${expired ? "EXPIROU a" : "válida até"} ${expires}` : ""}`,
      finishWarn: (list, slug) => `exceções expiradas em aprovações forçadas: ${list} — volta a aprovar essas fases sem force; para renovar a exceção: ${DEV_SPEC} approve ${slug} <fase> --force --reason "…" --expires 30d`,
    },

    forecast: {
      colEta: "Previsão",
      etaCell: (eta, low, high) => `${eta}${low ? ` (${low}…${high})` : ""}`,
      cliEta: (eta, low, high) => `previsão ${eta}${low ? ` (${low}…${high})` : ""}`,
      velocity: (v) => `Velocidade: ${v.pointsPerDay} ponto(s)/dia útil — ${v.completed} tarefa(s), ${v.points} ponto(s) concluídos desde ${v.since} (últimos ${v.windowDays} dias)`,
      notEnough: (v) => `Velocidade: ainda sem dados suficientes — ${v.completed} das ${v.minTasks} tarefas concluídas de que uma previsão precisa nos últimos ${v.windowDays} dias`,
      metricsVelocity: (v) => (v.completed ? `  velocidade: ${v.pointsPerDay} ponto(s)/dia útil (${v.completed} tarefa(s), ${v.points} ponto(s) desde ${v.since}, últimos ${v.windowDays} dias)${v.enough ? "" : ` — ainda sem dados suficientes para uma previsão (são precisas ${v.minTasks})`}`
        : `  velocidade: nenhuma tarefa concluída nos últimos ${v.windowDays} dias`),
      etaNote: (pct) => `Previsão = pontos por fazer ÷ velocidade, em dias úteis (±${pct}%) · \`_Size: XS|S|M|L|XL_\` numa tarefa = 1/2/3/5/8 pontos; uma tarefa sem tamanho conta como a mediana da sua feature (senão M) · uma feature à espera de uma dependência começa depois da previsão dessa.`,
      overlap: {
        attentionActive: (other, files) => `planeia os mesmos ficheiros que ${other}: ${files} — ordena-as (spec_depend) ou declara _Supersedes:_ se uma substitui o comportamento da outra`,
        attentionFinished: (other, files) => `planeia ficheiros da baseline de fecho de ${other}: ${files} — declara _Supersedes: ${other}/US-n.AC-m_ onde substitui esse comportamento, ou o spec_drift assinala ${other} depois do merge`,
        doctorActive: (list, slug) => `há tarefas por fazer que planeiam os mesmos ficheiros que outra feature ativa — ${list}: ambas mexem neles no merge e uma deriva sem aviso. Ordena as duas (spec_depend {name: "${slug}", add: ["<outra>"]} · ${DEV_SPEC} depend ${slug} <outra>) ou, onde uma substitui o comportamento da outra, declara _Supersedes: <outra>/US-n.AC-m_`,
        doctorFinished: (list, slug) => `há tarefas por fazer que planeiam ficheiros que uma feature fechada registou na sua baseline de drift — ${list}: depois do merge, o spec_drift assinala-a. Declara _Supersedes: <feature>/US-n.AC-m_ nos critérios de ${slug} que substituem o comportamento dela, faz ${slug} depender dela onde assenta nela (spec_depend {name: "${slug}", add: ["<feature>"]} · ${DEV_SPEC} depend ${slug} --add <feature>), ou volta a fechá-la depois do merge (spec_finish)`,
        hookLine: (n, list) => `⚠ ${n} sobreposição(ões) de ficheiros entre features: ${list} — corre /spec-doctor nelas (ordena-as com /depend, ou declara _Supersedes:_)`,
        cliHead: (n) => `⚠ ${n} sobreposição(ões) de ficheiros entre features:`,
        cliActive: (a, b, files) => `  ${a} ↔ ${b}: ${files}`,
        cliFinished: (a, b, files) => `  ${a} → ${b} (fechada): ${files}`,
        more: (n) => `+${n} outro(s)`,
      },
    },

    // 1.14 B5 — vermelho → verde (_Expect: fail_), verificações do projeto (roadmap.json meta.checks) + a suite no fim, `dev-spec log`.
    redGreen: {
      passRefused: (n) => `A tarefa ${n} espera que o seu teste FALHE (_Expect: fail_), mas a execução passou (exit 0) — o teste ainda não falha, por isso não testa nada. Põe-no a falhar pela razão certa (uma asserção, "não implementado" — não um erro de escrita nem um import em falta) e regista essa execução. Não a marco como feita.`,
      passTicked: (n) => `A tarefa ${n} está marcada, mas espera que o seu teste FALHE (_Expect: fail_) e esta execução passou (exit 0) sem nenhuma execução vermelha registada antes — o teste não testa nada: registado; a tarefa passa a contar como não verificada até ser registada uma execução a falhar (vermelha).`,
      cantRun: (n, code, ticked) => `Tarefa ${n}: exit ${code} significa que o próprio comando não pôde correr (não encontrado / não executável) — isso não é um teste vermelho (_Expect: fail_). Corrige o comando _Verify:_ e regista depois a execução a falhar. ` + (ticked ? "Registado; a tarefa passa a contar como não verificada." : "Não a marco como feita."),
      passAfterRed: (n, day) => `Tarefa ${n}: o teste passa agora — é o esperado depois da correção; a execução vermelha registada em ${day} continua a ser a prova (_Expect: fail_).`,
      unexpectedPassNote: (n, slug) => `A tarefa ${n} espera que o seu teste FALHE (_Expect: fail_), mas a última execução passou sem nenhuma execução vermelha antes — continua não verificada até ser registada uma execução a falhar: ${DEV_SPEC} done ${slug} ${n} --run`,
      redRecorded: (n, code) => `  ✓ execução vermelha registada para a tarefa ${n} (exit ${code}) — o teste falha antes da correção, como o _Expect: fail_ espera.`,
      shellNotRed: (cmd) => `a shell por omissão do Windows (cmd.exe) não conseguiu correr \`${cmd}\` tal como está escrito — isso não é um teste vermelho (_Expect: fail_). Nada foi registado; a tarefa continua aberta.`,
      pwshNotRed: (cmd, what) => `o PowerShell não conseguiu analisar \`${cmd}\` (${what}) — o comando nunca correu, por isso não é um teste vermelho (_Expect: fail_). Nada foi registado; a tarefa continua aberta. O Windows PowerShell 5.1 não tem && / || (usa ; ou o pwsh 7).`,
      cantRunOutput: (n, code, what, ticked) => `Tarefa ${n}: a execução saiu com exit ${code}, mas o output mostra que o teste nunca foi executado (${what}) — isso não é um teste vermelho (_Expect: fail_): um ficheiro de teste, módulo ou script em falta não é a razão certa. Escreve o teste para que falhe numa asserção (ou "não implementado") e regista essa execução. ` + (ticked ? "Registado; a tarefa passa a contar como não verificada." : "Não a marco como feita."),
      notRed: (cmd, what) => `\`${cmd}\` falhou, mas o output mostra que o teste nunca foi executado (${what}) — isso não é um teste vermelho (_Expect: fail_): um ficheiro de teste, módulo ou script em falta não é a razão certa. Nada foi registado; a tarefa continua aberta. Escreve o teste para que falhe numa asserção (ou "não implementado"); depois, repete o done --run.`,
      crashNotRed: (n, code, ticked) => `Tarefa ${n}: a execução crashou (exit ${code} — um sinal como SIGSEGV / SIGABRT, ou um código de crash do Windows) — isso não é um teste vermelho (_Expect: fail_): um crash não é o teste a falhar pela razão certa. Faz o teste falhar numa asserção (ou "não implementado") e regista essa execução. ` + (ticked ? "Registado; a tarefa passa a contar como não verificada." : "Não a marco como feita."),
      prRed: "a execução vermelha esperada (_Expect: fail_)",
      prRedKept: (code, day) => `execução vermelha antes da correção: exit ${code}${day ? " em " + day : ""}`,
      doctorMissing: (list) => `T-IDs postos a verde por tarefas feitas sem uma execução vermelha registada: ${list} — um teste que nunca falhou não prova nada. Marca a tarefa que o escreve com _Expect: fail_ e regista a execução a falhar antes da correção (${DEV_SPEC} done <feature> <n> --run).`,
      doctorOk: (n) => `todos os T-IDs postos a verde por tarefas feitas (${n}) têm uma execução vermelha registada`,
      briefExpect: "**Resultado esperado: FALHA** (_Expect: fail_) — a execução tem de terminar com um exit diferente de zero: o teste falha pela razão certa antes da correção (uma asserção / não implementado — não um erro de escrita, um import em falta ou um comando que não corre). Uma execução que passe é recusada: significaria que o teste não testa nada.",
      dodExpect: "A execução do _Verify:_ tem de FALHAR (exit diferente de zero) pela razão certa — põe no relatório o comando, o exit code e a falha; fica registada como a execução vermelha da tarefa.",
      naVerify: (n, slug) => `A tarefa ${n} tem _Expect: fail_: a prova é uma execução que FALHA (o teste vermelho antes da correção) — uma execução que passa não conta. Regista a execução vermelha (${DEV_SPEC} done ${slug} ${n} --run enquanto o teste falha — antes da correção, ou com a correção guardada num stash), ou tira o _Expect: fail_ se a tarefa não for um teste vermelho.`,
    },
    projectChecks: {
      badInput: 'checks tem de ser um objeto nome → comando (ex.: {"test": "npm test"}); um comando vazio remove essa verificação.',
      badName: (k) => `nome de verificação inválido '${k}' — letras, dígitos e . _ : - (até 40 caracteres, a começar por uma letra ou um dígito).`,
      badCommand: (k) => `o comando da verificação '${k}' tem de ser uma linha de texto (até 500 caracteres) — ou vazio para remover a verificação.`,
      tooMany: (max) => `no máximo ${max} verificações do projeto.`,
      badStored: (rel) => `${rel} → meta.checks não é um objeto de nome → comando (texto) — corrige-o à mão; não o vou alterar.`,
      initLine: (list) => `Verificações do projeto (meta.checks): ${list}`,
      evidenceNotList: "evidence tem de ser uma lista de execuções de verificações: [{name, command, exitCode, summary}].",
      noChecks: 'não há verificações do projeto configuradas (roadmap.json meta.checks) — nada para registar. Define-as primeiro: spec_init {checks: {"test": "npm test"}} (CLI: ' + DEV_SPEC + ' init --check test="npm test").',
      evidenceItem: (i, why) => `evidence[${i}]: ${why}`,
      itemNotObject: "cada execução tem de ser um objeto {name, command, exitCode, summary}",
      unknownCheck: (name, list) => `'${name}' não é uma verificação do projeto — uma de: ${list}`,
      needsCommand: "falta o comando que correu",
      needsExit: "falta o exit code (um inteiro)",
      status: (i) => ({ "no-run": "nenhuma execução registada", failed: `a última execução falhou (exit ${i.exitCode})`, changed: "a execução não é do seu comando (ou o comando mudou desde então)", "before-last-tick": "correu antes da última atividade nas tarefas", "code-changed": "os ficheiros de implementação mudaram desde a execução", unobserved: "a execução não foi observada pelo harness" })[i.status] || i.status,
      blocker: (list, slug) => `verificações do projeto sem uma execução bem-sucedida desde a última atividade nas tarefas: ${list} — corre-as: ${DEV_SPEC} finish ${slug} --run (ou regista as execuções com spec_finish {evidence})`,
      doctorWarn: (list, slug) => `todas as tarefas estão feitas, mas há verificações do projeto sem uma execução bem-sucedida desde a última atividade nas tarefas: ${list} — o spec_finish recusa até passarem: ${DEV_SPEC} finish ${slug} --run`,
      doctorOk: (n) => `todas as verificações do projeto (${n}) têm uma execução bem-sucedida desde a última atividade nas tarefas`,
      invalidStored: (list) => `roadmap.json meta.checks: entradas inválidas ignoradas (${list}) — cada uma tem de ser "nome": "comando numa linha"`,
      prChecks: "## Verificações do projeto",
      prNoRun: "nenhuma execução registada",
      briefDod: (list) => `Corre as verificações do projeto e põe no relatório cada comando, o exit code e as últimas linhas do output — nada do que passava antes desta tarefa pode falhar depois dela: ${list}.`,
      briefDodRed: (list) => `Corre as verificações do projeto e põe no relatório cada comando, o exit code e as últimas linhas do output — as únicas falhas permitidas são os novos testes vermelhos desta tarefa; tudo o que passava antes tem de continuar a passar: ${list}.`,
      naFinish: (slug, list) => `Há verificações do projeto configuradas (${list}): para fechar a feature é preciso uma execução bem-sucedida de cada uma desde a última atividade nas tarefas — ${DEV_SPEC} finish ${slug} --run corre-as e regista-as (ou corre-as tu e regista cada uma com spec_finish {evidence: [{name, command, exitCode, summary}]}).`,
      recorded: (n) => `Registada(s) ${n} execução(ões) de verificações do projeto em .state.json → finishChecks.`,
      noneToRun: 'não há verificações do projeto para correr (roadmap.json meta.checks) — define-as: ' + DEV_SPEC + ' init --check test="npm test" [--check lint="npm run lint"]',
      badArg: (v) => `--check espera nome=comando (recebido '${v}') — um comando vazio (nome=) remove essa verificação`,
      posixOnWindows: (name, cmd, kinds) => `a verificação do projeto '${name}' (\`${cmd}\`) usa sintaxe de shell POSIX (${kinds.map((k) => ({ "single-quotes": "plicas '…'", variable: "$VARIAVEIS" })[k] || k).join(", ")}) que o cmd.exe — a shell por omissão do --run no Windows — lê de outra forma, muitas vezes sem falhar. Nada foi executado. Volta a correr com --shell bash (Git Bash; ou define DEV_SPEC_SHELL=bash), com --shell pwsh se for um comando PowerShell (ou dá o script ao PowerShell entre aspas: pwsh -NoProfile -Command "…") — ou --shell cmd para a correr no cmd.exe mesmo assim.`,
      pwshInPosix: (name, cmd, kinds, shell) => `a verificação do projeto '${name}' (\`${cmd}\`) passa ao PowerShell um script com ${kinds.map((k) => ({ variable: "$VARIAVEIS", backtick: "acentos graves (backticks)" })[k] || k).join(" e ")} fora de plicas, mas é uma shell POSIX (${shell}) que corre a linha e expande-os primeiro — \`exit $LASTEXITCODE\` fica um \`exit\` sem código (sai com 0), por isso uma verificação que falha podia ficar registada como bem-sucedida. Nada foi executado. Põe o script entre plicas para uma shell POSIX, ou corre as verificações com --shell pwsh (ou define DEV_SPEC_SHELL=pwsh) e escreve só o PowerShell.`,
    },
    runGate: {
      taskRefused: (cmd, why) => `\`${cmd}\` não pôde correr (${why}) — nada foi registado; a tarefa continua aberta.`,
      checkRefused: (name, cmd, why) => `a verificação do projeto '${name}' (\`${cmd}\`) não pôde correr (${why}) — nada foi registado; corrige isso e volta a correr finish --run.`,
      why: {
        spawn: (shell, code) => `não foi possível iniciar a shell '${shell}': ${code}`,
        signal: (sig) => `foi terminado pelo sinal ${sig}`,
        timeout: (s) => `não terminou dentro do --timeout de ${s} s`,
        buffer: "o output passou dos 64 MB",
        wsl: (text) => `o bash que o correu é o lançador do WSL, não uma shell desta máquina: ${text}`,
        shell: (text) => `a shell não o conseguiu iniciar: ${text}`,
        error: (code) => `a execução não conseguiu arrancar: ${code}`,
      },
      wslBash: (p) => `--shell ${p} é o lançador bash.exe do WSL, que corre o comando dentro de uma distribuição Linux (ou falha com "execvpe(/bin/bash) failed") e não numa shell desta máquina — usado como pediste; uma execução que o WSL não consiga arrancar não é registada. A shell desta máquina é o Git Bash, que o --shell bash encontra (com o Git for Windows).`,
      wslExe: (p) => `--shell ${p} é o wsl.exe, que não é uma shell (rejeita o -c que qualquer execução numa shell usa) — recusado, nada foi executado. Indica o caminho do bash.exe do WSL para correr dentro do WSL, ou --shell bash para o Git Bash.`,
      noTests: (cmd, what) => `\`${cmd}\` passou, mas o output mostra que nenhum teste correu (${what}) — uma execução que não testa nada não prova nada (um glob, um caminho ou um filtro que não apanha nenhum teste). Nada foi registado; a tarefa continua por fazer. Corrige o comando _Verify:_ (ou o teste que ele indica) e depois volta a correr o done --run.`,
      noGitBash: "--shell bash: não foi encontrado nenhum Git Bash (git --exec-path, %ProgramFiles%\\Git\\bin\\bash.exe, PATH) — um bash.exe em System32 ou WindowsApps é o lançador do WSL, que corre o comando dentro de uma distribuição Linux, por isso nunca é usado. Nada foi executado. Instala o Git for Windows, ou indica em --shell o caminho completo de um bash.exe.",
    },
    gitLog: {
      head: (slug, n, citing, truncated) => `Commits: ${slug} — ${n} commit(s) lido(s)${truncated ? " (a janela está cheia: os commits mais antigos não foram lidos — --max N)" : ""}, ${citing} citam as suas tarefas`,
      taskLine: (n, text, done, list) => `  ${done ? "[x]" : "[ ]"} #${n} ${text} — ${list}`,
      commitRef: (short, subject, via) => `${short} ${subject} (${via})`,
      more: (n) => `+${n} mais`,
      noCommit: "nenhum commit a cita",
      implFirst: (n, tests, taskC, testC, files) => `red-first: a tarefa ${n} (que põe ${tests} a verde) teve o primeiro commit em ${taskC}, antes de qualquer commit que toque num ficheiro de teste que nomeie ${tests} (${files} — primeiro em ${testC}): a implementação veio antes do teste.`,
      testNotCommitted: (n, tests, taskC, files) => `red-first: a tarefa ${n} (que põe ${tests} a verde) tem commit (${taskC}), mas nenhum commit lido toca num ficheiro de teste que nomeie ${tests} (${files}) — faz primeiro o commit do teste.`,
      redFirstStatus: (n, tests, status) => `red-first: tarefa ${n} (${tests}) — ` + ({ ok: "o teste teve commit primeiro ✓", "no-test-file": "ainda nenhum ficheiro de teste o nomeia (nada para comparar)", "no-task-commit": "ainda nenhum commit cita a tarefa", "outside-window": "impossível saber: a janela do log está cheia (--max N)" })[status],
      conventions: (slug) => `Nenhum commit cita uma tarefa de '${slug}'. Convenções: nomeia a feature e a tarefa — "Part of .specs/${slug}/ task #N." (o que o /spec-commit escreve) — ou os IDs que cobre: "Makes T-01 green", US-1.AC-2.`,
      noGit: "o git não está disponível aqui, ou isto não é um repositório git com commits — o dev-spec log lê o `git log`. Ou passa um log pelo stdin: git log --name-only --relative | " + DEV_SPEC + " log <feature> -",
    },

    stopGate: {
      // 1.25.1: no bare verb or participle — "verifiquei", "concluí", "implementado" alone claimed "Verifiquei o ficheiro…", "Concluí
      // que o problema…", "O método está implementado em src/pay.ts" (STOP_PT_* above, common.js stopLineClaim).
      claims: [
        // "A correção está concluída.", "Foi implementado e testado." — the clause ends there…
        String.raw`(?:está|estão|esta|ficou|ficaram|foi|foram|já\s+está|já\s+estão)\s+(?:tudo\s+|totalmente\s+|agora\s+)?${STOP_PT_DONE}${STOP_PT_CHAIN}${STOP_PT_END}`,
        // …or the work is its subject ("a funcionalidade está concluída e publicada"), or "está tudo feito"
        String.raw`(?:tudo|tarefas?|feature|funcionalidade|hist[óo]rias?|implementa[çc][ãa]o|corre[çc][ãa]o|altera[çc](?:[ãa]o|[õo]es)|mudan[çc]as|trabalho|bugfix)\s+(?:(?:já|agora)\s+)?(?:está|estão|ficou|ficaram|foi|foram)\s+(?:tudo\s+|totalmente\s+|agora\s+)?${STOP_PT_DONE}${STOP_PT_NOT_WHERE}`,
        String.raw`(?:está|estão|ficou|ficaram|já\s+está|já\s+estão)\s+tudo\s+${STOP_PT_DONE}${STOP_PT_NOT_WHERE}`,
        String.raw`tarefas?\s+#?\d+(?:\s*(?:,|e|[-–]|a)\s*#?\d+)*\s+(?:(?:est[áa]|est[ãa]o|foi|foram|ficou|ficaram)\s+)?(?:feit[oa]s?|conclu[íi]d[oa]s?|terminad[oa]s?|implementad[oa]s?|verificad[oa]s?)`,
        String.raw`todas\s+as\s+(?:\d+\s+)?tarefas\s+(?:(?:est[ãa]o|foram|ficaram|já)\s+)*(?:feitas|conclu[íi]das|terminadas|implementadas|verificadas|finalizadas|prontas)`,
        // "Feito.", "✅ Concluído", "Implementado e verificado." — "Pronto, aqui está o resumo." claims no task (common.js)
        stopLineClaim(String.raw`(?:tudo\s+)?(?:feit[oa]|conclu[íi]d[oa]|terminad[oa]|implementad[oa]|verificad[oa]|finalizad[oa]|pront[oa])${STOP_PT_CHAIN}`, STOP_PT_TESTED,
          String.raw`(?:${STOP_PT_WORK}|(?<=implementad[oa]s?\s+)(?:o|a|os|as|um|uma)(?![\p{L}\p{N}_]))`),
        // "Tarefa concluída.", "Trabalho concluído —" (ending its clause)
        String.raw`(?:feature|funcionalidade|hist[óo]ria|tarefa|implementa[çc][ãa]o|corre[çc][ãa]o|bugfix|refactor|migra[çc][ãa]o|trabalho)\s+(?:agora\s+)?(?:feit[oa]|conclu[íi]d[oa]|terminad[oa]|implementad[oa]|verificad[oa]|finalizad[oa]|complet[oa]|pront[oa])${STOP_PT_END}`,
        String.raw`tudo\s+(?:feito|pronto|conclu[íi]do|terminado|verificado|implementado|testado|verde|funciona|a\s+funcionar)`,
        String.raw`(?:todos\s+os\s+(?:\d+\s+)?|os\s+)?testes?\s+(?:(?:já|agora|todos)\s+)*(?:passam|passaram|passa|passou|est[ãa]o\s+a\s+passar|a\s+passar|est[ãa]o\s+verdes|ficaram\s+verdes|verdes)`,
        String.raw`(?:isto|já)\s+funciona`,
        // first person: "Implementei a tarefa 3", "Terminei." — not "Verifiquei o ficheiro", "Concluí que…", "Acabei de ler…"
        String.raw`${STOP_PT_I}(?:\s+(?:já|agora|também))?(?:\s*(?:,|e)\s*${STOP_PT_I})*(?:\s+${STOP_PT_WORK}|${STOP_PT_END1})`,
        // …and "implementei" builds the work whatever its object ("Implementei a lógica de retry") — not "…que" / "…como"
        String.raw`(?:implementei|implement[áa]mos)(?=\s+(?!(?:que|se|como|porque|onde|quando|qual)(?![\p{L}\p{N}_]))[\p{L}\p{N}_])`,
        // "Pronto para merge" (1.25.1 — it claimed nothing)
        String.raw`pront[oa]s?\s+(?:para|pra)\s+(?:(?:o|a|um|uma|fazer|fazer\s+o)\s+)?(?:merge|integrar|integra[çc][ãa]o|entrega|entregar|release|lan[çc]amento|deploy|produ[çc][ãa]o|revis[ãa]o|review|pr|pull\s+request)`,
      ],
      // 1.25.1 — the words every claim above holds at least one of (see en.js): pt-BR's own claims (funcionando, passando, rodando)
      // included — pt-BR keeps pt's list raw.
      triggers: [String.raw`${STOP_PT_DONE}|${STOP_PT_I}|testad[oa]s?|verdes?|funciona|funcionar|funcionando|passam|passaram|passa|passou|passar|passando|rodando`],
      negators: ["não", "nunca", "nem", "nada", "sem", "falta", "faltam", "ser", "quando", "depois", "antes", "se", "até", "vou", "vamos", "irei",
        "devo", "deve", "devem", "precisa", "precisam", "tenho", "temos", "quase", "parcialmente", "possa", "possam", "ainda"],
      admissions: [
        String.raw`(?:não|nunca)\s+(?:(?:foi|foram|está|estão|ficou|ainda|totalmente|chegou|a|ser)\s+){0,2}(?:verificad[oa]s?|testad[oa]s?|corrid[oa]s?)`,
        String.raw`por\s+verificar|sem\s+evid[êe]ncia|sem\s+verifica[çc][ãa]o`,
        String.raw`[1-9]\d*\s+(?:testes?\s+)?(?:a\s+falhar|falharam|falhas?)`,
        String.raw`testes?\s+(?:(?:ainda|estão)\s+)*(?:falham|falharam|a\s+falhar)`,
      ],
      fixed: ["corrigi", "corrigimos", "corrigido", "corrigida", "corrigidos", "corrigidas", "resolvi", "resolvemos", "resolvido", "resolvida", "resolvidos", "resolvidas",
        "reparei", "reparado", "reparada", "anteriormente"],
      zeroes: [String.raw`0|zero|nenhu(?:m|ns|ma|mas)(?:\s+d[oa]s)?`],
      passNow: [String.raw`agora\s+(?:passam|passa|est[ãa]o\s+a\s+passar|est[áa]\s+a\s+passar|est[ãa]o\s+verdes|est[áa]\s+verde)`],
      head: "dev-spec — gate de evidência: a tua última mensagem diz que o trabalho está feito ou verificado, mas há tarefas marcadas sem evidência de verificação:",
      headSuite: "dev-spec — gate de evidência: a tua última mensagem diz que o trabalho está feito ou verificado, mas as verificações do projeto não têm uma execução bem-sucedida desde a última atividade nas tarefas:",
      taskLine: (slug, list) => `  - ${slug}: ${list}`,
      suiteLine: (slug, list) => `  - ${slug}: verificações do projeto sem uma execução bem-sucedida desde a última atividade nas tarefas: ${list}`,
      more: (n) => `+${n} mais`,
      todoTasks: (slug, n, file = "tasks.md") => `Regista a evidência antes de o afirmar: lê o comando _Verify:_ de cada tarefa listada em .specs/${slug}/${file} (primeiro a tarefa ${n}) — uma tarefa com vários: todos eles, numa SÓ execução unidos com \` && \` —; corre esse comando no código final só se for seguro; regista essa execução (o comando tal como está escrito) com spec_complete_task {name, number, evidence: {command, exitCode, summary}}.`,
      todoSuite: (slug) => `As verificações do projeto de ${slug} não têm nenhuma execução que passe: lê-as em .specs/roadmap.json (meta.checks); corre essas verificações só se for seguro; regista as execuções com spec_finish {evidence}.`,
      plainly: "Ou diz claramente quais destas não estão verificadas.",
      implementer: {
        head: (n, slug) => `dev-spec — gate de evidência: reportas a tarefa ${n} de '${slug}' como DONE, mas`,
        noReport: (file) => `o relatório (${file}) não existe.`,
        noRun: (file, cmds) => `o relatório (${file}) não mostra a execução do _Verify:_ — o comando exato e o seu exit code: ${cmds}.`,
        notPassing: (file, cmds) => `o relatório (${file}) não mostra nenhuma execução com sucesso (exit 0) de ${cmds} — o _Verify:_ de uma tarefa DONE tem de passar.`,
        notFailing: (file, cmds) => `o relatório (${file}) não mostra nenhuma execução a falhar (um exit code diferente de zero) de ${cmds} — a tarefa tem _Expect: fail_: a prova é a execução vermelha.`,
        todo: "Corre o comando no código final e põe no relatório o comando, o exit code e as últimas linhas do output — ou reporta BLOCKED / NEEDS_CONTEXT se não puder passar. (Evidência antes de afirmações: o controlador só marca a tarefa com essa execução.)",
      },
      simplifier: {
        head: (slug) => `dev-spec — gate de evidência: reportas a passagem de simplificação de '${slug}' como DONE, mas`,
        noReport: (file) => `o relatório (${file}) não existe.`,
        noFinal: (file) => `o relatório (${file}) não tem uma secção "## Final runs" com execuções — a última secção, uma linha por execução: - \`<comando>\` → exit <código>.`,
        noRun: (file, cmds) => `a secção "## Final runs" do relatório (${file}) não mostra estas execuções com o seu exit code: ${cmds} — todas as verificações do projeto têm de lá estar, uma linha por execução: - \`<comando>\` → exit <código>.`,
        notPassing: (file, cmds) => `as execuções finais do relatório (${file}) falham: ${cmds} — uma simplificação tem de deixar todas as execuções a passar.`,
        todo: "Corre as verificações do projeto (ou a bateria de testes completa) e o _Verify:_ das tarefas alteradas no código final e põe-nos no fim do relatório, em \"## Final runs\", uma linha cada (- `<comando>` → exit <código>, depois as últimas linhas do output) — ou reverte a alteração que fez falhar uma execução, ou reporta BLOCKED. (\"Comportamento inalterado\" é uma afirmação: as execuções são a prova.)",
      },
      allow: {
        off: () => "gate de evidência: desligado (roadmap.json meta.stopCheck: false) — nada verificado.",
        "stop-hook-active": () => "gate de evidência: este fim de turno já foi devolvido uma vez (stop_hook_active) — permitido.",
        "no-specs": () => "gate de evidência: não há aqui uma .specs/ do dev-spec — nada a verificar.",
        "no-claim": () => "gate de evidência: a mensagem não afirma conclusão nem verificação — permitido.",
        admitted: () => "gate de evidência: a mensagem diz claramente o que não está verificado (ou falha) — permitido.",
        "no-recent": (i) => `gate de evidência: nenhuma feature teve atividade nas últimas ${i.hours} h (tarefa marcada, evidência registada ou tasks.md editado) — permitido.`,
        verified: (i) => `gate de evidência: todas as tarefas marcadas das features com atividade recente têm evidência de sucesso (${i.list}) — permitido.`,
        "not-done": () => "gate de evidência: o subagente reporta BLOCKED / NEEDS_CONTEXT — permitido.",
        "no-changes": () => "gate de evidência: o simplificador reporta NO_CHANGES — nada a provar, permitido.",
        "no-report": () => "gate de evidência: a mensagem não nomeia nenhum relatório de simplificação (.specs/<feature>/.execution/simplify-report.md) — permitido.",
        "simplify-ok": (i) => `gate de evidência: o relatório de simplificação de '${i.slug}' termina com as execuções com sucesso — permitido.`,
        "no-task": () => "gate de evidência: a mensagem não nomeia nenhum relatório de tarefa (.specs/<feature>/.execution/task-N-report.md) — permitido.",
        "nothing-to-verify": (i) => `gate de evidência: a tarefa ${i.n} de '${i.slug}' não tem um comando _Verify:_ executável — permitido.`,
        "report-ok": (i) => `gate de evidência: o relatório da tarefa ${i.n} de '${i.slug}' mostra a execução do _Verify:_ — permitido.`,
      },
      on: "Gate de evidência LIGADO — um turno que termina a dizer que o trabalho está feito ou verificado é devolvido enquanto uma feature com atividade recente tiver tarefas marcadas sem evidência de verificação (roadmap.json meta.stopCheck; hooks/stop-hook.js).",
      off: "Gate de evidência DESLIGADO — a verificação das afirmações no fim do turno está desativada (roadmap.json meta.stopCheck: false).",
      badValue: (v) => `--stop-check aceita on ou off (recebido '${v}').`,
    },
    scopeGuard: {
      on: "Modo guarda SCOPE (âmbito) — Write/Edit num ficheiro de código fora de .specs/ pede confirmação, a menos que uma tarefa por concluir de uma feature aprovada o nomeie em _Implements:_ (o ficheiro, a sua pasta ou um glob; ficheiros de teste excetuados), e pede-a em todas as alterações de código enquanto nenhuma feature tiver tarefas aprovadas por concluir (roadmap.json meta.guard: \"scope\"). Os ficheiros de teste são permitidos enquanto o plano de testes de uma feature por concluir estiver aprovado (a Fase 4 escreve os testes a falhar antes do gate das tarefas), e todos os ficheiros de código enquanto um spike estiver em curso (o seu protótipo).",
      ask: (file, features, hint) => `dev-spec guard (scope): ${file} não está no plano — nenhuma tarefa por concluir de ${features} o nomeia em _Implements:_. ${hint} (O modo guarda está em scope — ${DEV_SPEC} init --guard on permite todos os ficheiros de código enquanto houver tarefas aprovadas; --guard off desliga-o.)`,
      hint: {
        "same-folder": (n, slug, ref) => `Acrescenta-o ao _Implements:_ da tarefa ${n} (${slug} — mesma pasta que ${ref}) e volta a aprovar a fase tasks, ou planeia a alteração com /spec-converge (spec_append_tasks).`,
        nearby: (n, slug, ref) => `Acrescenta-o ao _Implements:_ da tarefa ${n} (${slug} — planeia ${ref}, ali perto) e volta a aprovar a fase tasks, ou planeia a alteração com /spec-converge (spec_append_tasks).`,
        next: (n, slug) => `Acrescenta-o ao _Implements:_ da tarefa ${n} (${slug}, a próxima tarefa por concluir) e volta a aprovar a fase tasks, ou planeia a alteração com /spec-converge (spec_append_tasks).`,
      },
    },

    // 1.14 C2 — registo de decisões (decisions.md, spec_decide) e o tipo spike (investigar → decidir).
    decisions: {
      header: (name) => `# Decisões: ${name}

<!-- Registo de decisões — só se acrescenta, é versionado com a spec. O spec_decide (dev-spec decide) acrescenta cada
     entrada: D-1, D-2… nunca renumeradas, nunca reescritas. _Affects:_ indica os AC IDs, T-IDs e secções do design em
     que a decisão toca; uma decisão posterior que substitua outra diz _Supersedes: D-n_. As descobertas (factos
     aprendidos durante o trabalho) usam o mesmo registo (_Kind: discovery_). -->
`,
      labels: { context: "Contexto", decision: "Decisão", discovery: "Descoberta", consequences: "Consequências" },
      kinds: { decision: "decisão", discovery: "descoberta" },
      titleRequired: "uma decisão precisa de um título (uma linha de texto).",
      decisionRequired: "uma decisão precisa do seu texto — decision: o que foi decidido (numa descoberta: o que se descobriu).",
      badText: (field) => `${field} tem de ser texto.`,
      tooLong: (field, max) => `${field} é demasiado longo (no máximo ${max} caracteres).`,
      badKind: (v) => `kind tem de ser decision ou discovery (recebido: ${v}).`,
      badAffectsChange: (list) => `referência(s) _Affects:_ desconhecida(s): ${list} — uma alteração refere um AC ID que o seu change.md define, ou um título de secção do change.md (Resumo, Critérios de Aceitação, Abordagem, Tarefas). Nada foi escrito.`,
      badAffects: (list) => `referência(s) _Affects:_ desconhecida(s): ${list} — um AC ID tem de estar definido em requirements.md, um T-ID planeado em test-plan.md, um ID EC/NFR/SC escrito em requirements.md; qualquer outra tem de ser um título de secção do design.md (bug.md / design.md num bugfix, spike.md num spike). Nada foi escrito.`,
      badSupersedes: (list) => `_Supersedes:_ tem de indicar decisões que já estão neste registo (D-n): ${list}. Nada foi escrito.`,
      unsafeFile: (rel) => `${rel} não é um ficheiro normal dentro de .specs/ (é uma ligação simbólica, ou aponta para fora do projeto) — substitui-o primeiro por um ficheiro normal. Nada foi escrito.`,
      recorded: (id, kind, file) => `${id} (${kind}) registada em ${file}.`,
      briefHeading: "## Decisões",
      briefIntro: "Decisões e descobertas (decisions.md) que citam os critérios ou testes desta tarefa — respeita-as:",
      briefOmitted: (list) => `…e ${list} — ver decisions.md.`,
      supersedesNote: (list) => `substitui ${list}`,
      prHeading: "## Decisões",
      catalogLine: (n, list) => `Decisões (${n}): ${list}`,
      superseded: "substituída",
      affectsApproved: (list, slug, phases) => `decisões registadas depois de uma aprovação tocam na spec aprovada: ${list} — revê o que mudam (spec_impact ${slug} --phase ${phases}), atualiza a spec e volta a aprovar.`,
      affectsApprovedEntry: (id, refs, file, day) => `${id} (${refs}) depois de ${file} ter sido aprovado (${day})`,
      phantomDoctor: (list) => `referências _Affects:_ em decisions.md que não correspondem a nada nesta feature: ${list} — um erro de escrita, ou um critério / teste / secção removido entretanto.`,
      phantom: (id, ref) => `${id} _Affects:_ ${ref} — não corresponde a nada nesta feature (um erro de escrita, ou um critério / teste / secção removido entretanto)`,
      cliRecorded: (id, title, file) => `✎ ${id} — ${title}  (${file})`,
    },
    spike: {
      kind: "spike",
      kicker: "Spike (investigação)",
      report: (a) => `# Spike: ${a.name}

<!-- Spike (investigar → decidir): uma investigação com prazo fixo (timebox) que termina numa DECISÃO, não em código de produção.
     O código de protótipo vive FORA de .specs/ (uma pasta de rascunho ou um branch) — liga-o em Evidência.
     O spec_doctor falha enquanto a "Decisão" não estiver escrita e avisa quando a data do timebox passa sem ela.
     Indica o resultado numa linha própria: _Outcome: go_ · _Outcome: no-go_ · _Outcome: pivot_ -->

## Pergunta
${a.question || "> **TODO** — a única pergunta a que este spike responde (que resposta mudaria o plano?)."}

## Timebox (prazo)
${a.until ? `**Até:** ${a.until}${a.raw && a.raw !== a.until ? ` (${a.raw})` : ""}` : "> **TODO** — a data de fim (AAAA-MM-DD) ou o limite de esforço. Quando terminar, decide com a evidência que tiveres."}

## Opções consideradas
- [opção A — o que é, quanto custaria]
- [opção B]

## Evidência
<!-- Links, medições, protótipos (o código fica fora da spec — liga-o aqui), o que se tentou e o que aconteceu. -->
- [link / medição / protótipo — e o que mostrou]

## Decisão
> **TODO** — go / no-go / pivot (avançar / não avançar / mudar de rumo) e porquê: a evidência que decidiu.

_Outcome: [go | no-go | pivot]_

## Seguimento
- [go: a feature a especificar (spec_create) · no-go: porque foi abandonado · pivot: a nova pergunta]
`,
      tasks: (name) => `# Tasks: ${name}

<!-- Um spike não tem gates de requisitos / design: pergunta → investigar → decidir. O código de protótipo vive FORA
     de .specs/ — liga-o em spike.md → Evidência. Quando o timebox terminar, decide com o que tiveres. -->

## Fase: Investigação
- [ ] 1. [shared] Afinar a pergunta e definir o timebox em spike.md (que resposta mudaria o plano?)
- [ ] 2. [shared] Listar as opções consideradas em spike.md → Opções consideradas
- [ ] 3. [shared] Reunir a evidência — protótipos (fora de .specs/), medições, links — em spike.md → Evidência
- [ ] 4. [shared] Registar a decisão (go / no-go / pivot) e a justificação em spike.md → Decisão; regista-a com o spec_decide
**Checkpoint:** a pergunta tem uma resposta apoiada em evidência.
`,
      badTimebox: (v) => `timebox tem de ser uma data de fim (AAAA-MM-DD) ou uma duração a partir de hoje (p. ex. 3d, 2w, 8h) — recebido: ${v}.`,
      spikeOnly: (arg) => `${arg} só se aplica a um spike (kind: "spike").`,
      spikeOnlyCli: (flag) => `${flag} só se aplica a um spike — cria-o como spike: ${DEV_SPEC} spike "<nome>" ${flag} "…" (ou --kind spike).`,
      tracksIgnored: (list) => `Um spike é só core — tracks ignorados (${list}); dá-os à feature que especificares depois de um 'go'.`,
      noTracks: (slug) => `'${slug}' é um spike — não tem tracks. Depois de um 'go', especifica a feature real com os seus tracks (spec_create).`,
      noGate: (phase, slug) => `'${slug}' é um spike: não tem gate de ${phase} — o seu percurso é pergunta → investigar → decidir. Regista a decisão em spike.md → Decisão (o spec_decide regista-a no log); o spec_finish fecha-o.`,
      doctor: {
        missing: "falta o spike.md — é lá que vivem a pergunta, a evidência e a decisão de um spike.",
        questionOk: "a pergunta está escrita",
        questionMissing: "spike.md → Pergunta ainda é o template — escreve a única pergunta a que este spike responde.",
        decisionOk: (o) => `decisão registada (_Outcome: ${o}_)`,
        decisionMissing: "spike.md → Decisão ainda não está escrita (go / no-go / pivot + justificação) — o spike não termina enquanto não estiver.",
        outcomeMissing: "a decisão está escrita mas o resultado não está indicado — acrescenta uma linha _Outcome: go_, _Outcome: no-go_ ou _Outcome: pivot_.",
        timeboxOk: (d) => `timebox até ${d}`,
        timeboxPassed: (d) => `o timebox terminou a ${d} e não há decisão registada — decide com a evidência que tens (go / no-go / pivot), ou prolonga o timebox de propósito.`,
        timeboxUnset: "sem timebox definido — escreve uma data de fim (AAAA-MM-DD) em spike.md → Timebox.",
        timeboxNoDate: "o timebox não tem data de fim (AAAA-MM-DD) — não é possível verificar quando acaba.",
        timeboxDecided: "decidido — o timebox está fechado",
      },
      next: {
        missing: (slug) => `falta o spike.md — volta a criá-lo: ${DEV_SPEC} spike "${slug}" (só cria: o que existe é mantido).`,
        fillQuestion: (slug) => `Escreve a pergunta a que este spike responde (e o timebox) em spike.md → Pergunta / Timebox — /spec-spike ${slug}.`,
        investigate: (n, text, slug) => `Investiga — tarefa #${n}: ${text}. O código de protótipo fica fora de .specs/ (liga-o em spike.md → Evidência); marca-a: ${DEV_SPEC} done ${slug} ${n}.`,
        decide: (slug) => `Regista a decisão em spike.md → Decisão — go / no-go / pivot, a justificação e a linha _Outcome:_ — e regista-a no log: /spec-decide ${slug} (spec_decide).`,
        outcome: (slug) => `Indica o resultado em spike.md → Decisão: uma linha _Outcome: go_, _Outcome: no-go_ ou _Outcome: pivot_ (/spec-spike ${slug}).`,
        timeboxPassed: (d) => `O timebox terminou a ${d}: decide com a evidência que tens.`,
        goCreateFirst: (slug, name, summary) => `Decisão: go. Especifica a feature real — spec_create {name: "${name}", summary: ${JSON.stringify(summary)}} (${DEV_SPEC} create "${name}" --summary ${JSON.stringify(summary)}) — e depois arquiva o spike: /feature archive ${slug}.`,
        goArchiveFirst: (slug, name, summary) => `Decisão: go. Arquiva primeiro o spike — /feature archive ${slug} (liberta o nome) — e depois especifica a feature real: spec_create {name: "${name}", summary: ${JSON.stringify(summary)}} (${DEV_SPEC} create "${name}" --summary ${JSON.stringify(summary)}).`,
        noGo: (slug, reason) => `Decisão: no-go${reason ? ` — ${reason}` : ""}. Arquiva o spike com o seu motivo (fica em spike.md → Decisão): /feature archive ${slug}.`,
        pivot: (slug, reason) => `Decisão: pivot${reason ? ` — ${reason}` : ""}. Começa um novo spike para a nova direção (${DEV_SPEC} spike "<nova pergunta>") — ou especifica a feature se a resposta já for clara — e depois arquiva este: /feature archive ${slug}.`,
      },
      finish: {
        ready: (slug) => `o spike '${slug}' está pronto para fechar — a decisão está registada. Age sobre ela (o spec_next_action diz como).`,
        notReady: (slug) => `o spike '${slug}' ainda não está pronto para fechar:`,
        missing: "falta o spike.md",
        decisionBlocker: "spike.md → Decisão ainda não está escrita (go / no-go / pivot + justificação)",
        prQuestion: "## Pergunta",
        prDecision: (o) => `## Decisão${o ? ` — ${o}` : ""}`,
        prEvidence: "## Evidência",
        prOptions: "## Opções consideradas",
        prFollowUp: "## Seguimento",
        checks: ["A decisão foi partilhada com as pessoas a quem diz respeito.", "O código de protótipo fica fora do branch principal — a feature real reescreve o que aproveitar nas suas próprias tarefas."],
      },
      roadmapTimebox: (d) => `spike: o timebox terminou a ${d} sem decisão`,
      catalogQuestion: (q) => `Pergunta: ${q}`,
      catalogOutcome: (o) => `Decisão: ${o}`,
      catalogPending: "Decisão: pendente",
      exportSection: "Spike",
      cliQuestion: (q) => `  pergunta: ${q}`,
      cliUntil: (d) => `  timebox: até ${d}`,
    },

    flow: {
      required: (slug, known) => `fluxo em falta — um de: ${known} (spec_feature {action: "flow", name: "${slug}", flow}; CLI: ${DEV_SPEC} feature flow ${slug} <flow>).`,
      kindRefused: (slug, kind) => `'${slug}' é um ${kind}, que segue a sua própria ordem de fases fixa — o fluxo só se aplica a features.`,
      kindIgnored: (kind) => `fluxo ignorado: um ${kind} segue a sua própria ordem de fases fixa (o fluxo só se aplica a features).`,
      kept: (slug, cur, asked) => `fluxo mantido: '${slug}' segue ${cur} (pedido: ${asked}) — muda-o com spec_feature {action: "flow"} (CLI: ${DEV_SPEC} feature flow ${slug} ${asked}).`,
      set: (slug, flow, prev, order) => `'${slug}' segue agora o fluxo ${flow} (antes: ${prev}) — ordem das fases: ${order}.`,
      same: (slug, flow, order) => `'${slug}' já segue o fluxo ${flow} — ordem das fases: ${order}.`,
      approvedStay: (list) => `As fases já aprovadas continuam aprovadas: ${list}.`,
      created: (order) => `fluxo design-first — ordem das fases: ${order} (os requisitos escrevem-se depois de o design ser aprovado).`,
      nextNote: (order) => `(fluxo design-first: ${order})`,
      laterPhase: (detail) => `o requirements.md é uma fase posterior (design-first) — ${detail}`,
    },
    branch: {
      invalid: (name) => `'${name}' não é um nome de branch que o dev-spec possa passar ao git: só letras, dígitos, '.', '_', '+', '-' e '/' (sem espaços, aspas nem caracteres da shell), sem '..' nem '//', nenhuma parte que comece por '.' ou termine em '.lock', sem '-' nem '/' no início, sem '/' nem '.' no fim, nunca HEAD — no máximo 200 caracteres.`,
      empty: "branch: indica um nome, ou true para o nome por omissão (feature/<slug> · fix/<slug> num bugfix · spike/<slug> num spike).",
      noGit: (name) => `Não há aqui um repositório git — nenhum branch foi registado (${name} seria o branch da feature; a feature foi criada).`,
      exists: (name) => `Já existe um branch git chamado ${name} — não foi registado, e nunca se muda para ele (pode ter outro trabalho): escolhe outro nome (branch: "<nome>" · --branch <nome>), ou deixa a opção de fora.`,
      kept: (name, asked) => `O branch da feature continua a ser ${name}, registado quando ela começou (${asked} não foi registado).`,
      run: (command) => `Branch próprio da feature: corre ${command} para começar nele (este servidor nunca corre o git).`,
      notOn: (name, current, command) => `O branch desta feature é ${name} e estás em ${current} — primeiro ${command}.`,
      summary: (name, base, short) => `Branch: \`${name}\`${base ? ` — a partir de \`${base}\`` : ""}${short ? ` em ${short}` : ""}`,
      finishLine: (name, base) => (base ? `Branch ${name} (a partir de ${base}): 1. faz merge em ${base} localmente — git switch ${base}, depois git merge ${name} · 2. mantém o branch.`
        : `Branch ${name}: 1. faz merge localmente no branch de onde partiu · 2. mantém o branch.`),
      statusLine: (name, base, short, current) => `  branch: ${name}${base ? ` (a partir de ${base}${short ? ` em ${short}` : ""})` : short ? ` (a partir de ${short})` : ""}${current ? (current === name ? " — estás nele" : ` — estás em ${current}`) : ""}`,
      logSince: (base, short) => `  lido desde o início da feature: ${base ? base + " em " : ""}${short} (git log ${short}..HEAD)`,
      cliCreated: (name, base, short) => `  Branch ${name} criado${base ? ` a partir de ${base}` : ""}${short ? ` (${short})` : ""} — já estás nele.`,
      cliSwitched: (name) => `  Agora no branch da feature ${name}.`,
      cliOn: (name) => `  No branch da feature ${name}.`,
      cliGitMissing: (command) => `  ▲ o git não pôde correr aqui — o branch está registado mas não foi criado: ${command}`,
      cliFailed: (command, why) => `  ▲ ${command} falhou${why ? `: ${why}` : ""} — o branch está registado; corre o comando quando isso estiver resolvido.`,
      cliTrackWord: (word) => `--branch ${word}: '${word}' é um track — põe os tracks antes de --branch (create "<nome>" ${word} --branch), ou escreve --branch=${word} para um branch com esse nome.`,
    },
    importPlans: {
      plansDir: "O plan mode do Claude Code guarda os planos em plansDirectory (por omissão ~/.claude/plans — fora do projeto): copia primeiro o plano para dentro do projeto, ou aponta plansDirectory para uma pasta dentro dele.",
      several: (dir, list) => `'${dir}' tem vários documentos (${list}) — indica o que queres importar.`,
      planTitle: "Plano",
      wNoSteps: "nenhuma checklist, lista de to-dos ou de passos encontrada — o tasks.md do scaffold foi mantido (divide o trabalho em tasks com /createTask)",
      wCancelled: (list) => `to-dos cancelados importados como tasks em aberto (remove os que já não se aplicam): ${list}`,
      wNoDesignLeft: "nada ficou para o design além dos critérios e dos passos — o design.md do scaffold foi mantido",
      wNotExecPlan: "nenhuma secção de ExecPlan encontrada (Progress, Decision Log, Concrete Steps, Validation and Acceptance …) — é mesmo um ExecPlan? Experimenta a ferramenta 'plan'.",
      decisionsHeading: "## Decisões",
      nonFunctional: "## Requisitos Não-Funcionais",
      wUnknownAc: (story, task, list) => `${story}, '${task}': referência(s) de AC ${list} não correspondem a nenhum critério dessa história — mantidas como escritas`,
      wWorkflow: (list) => `registos de workflow do BMAD não importados (ficam no sítio): ${list}`,
    },
    // 1.17 F — spec_import {tool: "fluidplan"} (ver o bloco EN).
    importFluidplan: {
      several: (dir, list) => `'${dir}' tem vários planos do fluidplan (${list}) — indica o que queres importar (a pasta, o plan.json ou o PLAN.md dele).`,
      notFluidplan: (file) => `'${file}' não é um PLAN.md nem um DECISIONS.md do fluidplan (sem título '<título> — execution plan' / '<título> — decisions', sem tarefa '### [ ] 1.1 <tarefa> · D1').`,
      notFluidplanText: "O texto não é um PLAN.md nem um DECISIONS.md do fluidplan (sem título '<título> — execution plan' / '<título> — decisions', sem tarefa '### [ ] 1.1 <tarefa> · D1').",
      decisionsIntro: "O contexto, a escolha e as consequências de cada decisão estão em decisions.md.",
      rejectedMark: "rejeitada",
      openMark: (state) => `ainda em aberto no fluidplan (${state})`,
      chosen: "escolhida",
      tradeoffsHead: ["Decisão", "Opção", "Prós", "Contras", "Esforço"],
      context: "## Contexto",
      sourceDoc: (p) => `Documento de origem: \`${p}\``,
      glossary: "## Glossário",
      finalCheck: "## Verificação final",
      visuals: "## Visuais",
      outOfScope: "## Fora de Âmbito",
      openDecisions: "## Decisões em aberto",
      openLine: (id, title, state, acs, note) => `- [NEEDS CLARIFICATION] **${id} · ${title}** — ${state}${note ? `: ${note}` : ""}${acs ? ` (os critérios que determina: ${acs})` : ""}: decide-a no fluidplan, ou aqui, antes de aprovar os requisitos`,
      constraints: "## Restrições Globais",
      themes: "## Temas",
      revisionNote: (round, note) => `Revisão (ciclo ${round}): ${note}`,
      label: {
        decision: "Decisão", deletes: "A apagar", untraced: "Outros ficheiros indicados (sem rastreio)", verify: "Verificar (sem marcador)", do: "Fazer", remark: "Observação", remarks: "Observações",
        itemsKept: "Itens mantidos", items: "Itens", importance: "Importância", phase: "Fase", page: "Tema", proposal: "Proposta", rewritten: "reescrita por quem reviu",
        pros: "prós", cons: "contras", effort: "esforço", cost: "custo", others: "Outras opções", dependsOn: "Depende de", fluidplan: "decisão do fluidplan",
        question: "Pergunta em aberto na origem", sourceRef: "Na origem", learnMore: "Mais", subtitle: "Subtítulo",
      },
      importance: { critical: "crítica", important: "importante", minor: "menor" },
      verdict: { pending: "sem resposta", modify: "a alterar", explain: "com uma pergunta", ko: "rejeitada", mixed: "parcialmente decidida" },
      otherOption: "outra opção (descrita na observação)",
      rejected: (reason) => `Rejeitada — fora desta feature${reason ? `: ${reason}` : "."}`,
      wDraft: (pending, revise) => `o plano do fluidplan não está fechado (DRAFT: ${pending} decisão(ões) sem resposta, ${revise} a rever) — é preciso fechá-lo no fluidplan e finalizá-lo, ou clarificar aqui as decisões em aberto`,
      wOpen: (list) => `decisões ainda em aberto no fluidplan — sem entrada em decisions.md, listadas em Decisões em aberto com [NEEDS CLARIFICATION]: ${list}`,
      wRejected: (list) => `decisões rejeitadas no fluidplan (Not OK) — registadas em decisions.md como rejeitadas e listadas em Fora de Âmbito (o fluidplan não mantém nenhuma das tarefas delas): ${list}`,
      wAfter: (task, ref) => `tarefa ${task}: after '${ref}' não corresponde a nenhuma tarefa que o plano mantém — sem _Depends:_ para ela`,
      wPath: (task, p) => `tarefa ${task}: '${p}' não é um caminho relativo ao projeto (absoluto, na pasta pessoal, URL, '..' ou um glob) — citado no texto da tarefa, não no _Implements:_`,
      wVerify: (task, cmd) => `tarefa ${task}: o comando de verificação '${cmd}' não pode ser escrito como marcador _Verify:_ — mantido no texto da tarefa`,
      wRounds: "o histórico de revisões do fluidplan (rounds/, os veredictos anteriores) não é importado — as decisões fechadas são, com a última nota de revisão",
      wCycle: (tasks, dropped) => `tarefas ${tasks}: os 'after' delas formam um ciclo — nenhuma podia começar. Retirado: ${dropped} (tarefa → a tarefa posterior de que dependia, contra a ordem do plano); convém acertar a ordem no fluidplan`,
      wNoExport: "o state.json diz que o plano foi exportado, mas o PLAN.md dele não foi encontrado (a pasta do plano, o output do plan.json, o outputDir do fluidplan.config.json) — as tarefas vêm do plan.json, sem as marcações de feitas",
      wNoDecisions: "nenhum DECISIONS.md nem plan.json junto ao PLAN.md — o decisions.md só tem o que o PLAN.md diz de cada decisão (a escolha e a importância: sem porquê, sem alternativas)",
      wBadJson: (file, err) => `${file} não é um objeto JSON válido (${err}) — não foi lido`,
      wVisuals: (list) => `os visuais do fluidplan são desenhados pela página dele — citados em design.md (Visuais), não desenhados: ${list}`,
      wNoTasks: "o plano não mantém nenhuma tarefa — o tasks.md do scaffold foi mantido",
    },
  };

// 1.16 Q — spec quality: steering amendments (Q1), cross-feature acceptance criteria (Q2), the glossary (Q3). One group per
// language, merged into MSG (pt-BR derives from pt's). Check ids, reason codes and file names stay English.
const quality = {
    steeringChange: { modified: "alterado", removed: "removido" },
    steeringItem: (phase, day, files) => `${phase} (aprovado em ${day}): ${files}`,
    steeringDoctor: (items, slug) => `steering alterado depois da aprovação — ${items}: revê à luz do steering alterado e volta a aprovar (${DEV_SPEC} impact ${slug} --phase steering; sem feature lista todas as afetadas).`,
    naSteering: (phases, files, slug) => `Nota: o steering mudou depois da aprovação de ${phases} (${files}) — revê à luz dele e volta a aprovar se continuar válido (${DEV_SPEC} impact ${slug} --phase steering).`,
    impactNeedsName: (phases) => `nome em falta — só a fase 'steering' funciona para o projeto todo (sem feature). Fases: ${phases}.`,
    impactNoReopen: "o reopen não se aplica à fase 'steering' — nada é desmarcado: revê as features listadas e volta a aprovar os requisitos / o design.",
    impactHead: (n, feature) => (feature
      ? (n ? `Steering — ${feature}: aprovada com uma versão anterior de steering que mudou desde então` : `Steering — ${feature}: nenhuma aprovação foi feita com steering que mudou desde então`)
      : (n ? `Steering — ${n} feature(s) ativa(s) aprovada(s) com uma versão anterior de steering que mudou desde então` : "Steering — nenhuma aprovação de requisitos / design foi feita com steering que mudou desde então")),
    impactUntracked: (list) => `aprovadas antes da 1.16 (sem fingerprints do steering — nunca sinalizadas): ${list}`,
    impactUnreadable: (list) => `ignoradas — .state.json ilegível: ${list}`,
    impactReReview: (slug, phase) => `Revê cada uma à luz do steering alterado e volta a aprovar (/approve ${slug} ${phase}) — a aprovação regista o steering atual.`,
    xacKind: { duplicate: "quase duplicado", conflict: "possível conflito" },
    xacWhy: (reason, pct, nums) => (reason === "opposite-modal" ? `DEVE vs NÃO DEVE, ${pct}% semelhantes` : reason === "different-numbers" ? `números diferentes ${nums}, ${pct}% semelhantes` : `${pct}% semelhantes`),
    xacItem: (mine, other, kind, why) => `${mine} ↔ ${other} (${kind}: ${why})`,
    xacDoctor: (n, list) => `${n} par(es) de critérios parecem-se com os de outra feature ativa ou podem contradizê-los — ${list}. Junta-os ou muda um deles, ou declara _Supersedes: <feature>/US-n.AC-m_ no mais recente.`,
    xacMore: (n) => `… +${n}`,
    xacHeading: "Possíveis duplicados / conflitos",
    xacIntro: "Critérios de aceitação de features ativas diferentes que se parecem (quase duplicados) ou podem contradizer-se (o mesmo gatilho com DEVE vs NÃO DEVE, ou números diferentes) — uma heurística: junta-os ou muda um deles, ou declara _Supersedes:_ no mais recente.",
    xacTruncated: "(limitado — nem todos os critérios foram comparados)",
    glossaryQuestion: (locs, word, term, def) => `${locs}: '${word}' — o glossário diz ${term}${def ? ` (${def})` : ""}. Usa "${term}", ou corrige o .specs/steering/glossary.md se '${word}' significar outra coisa aqui.`,
    glossaryMore: (n) => `… e mais ${n} palavra(s) que o glossário manda evitar — ver spec_doctor (glossary).`,
    glossaryItem: (word, term, locs) => `'${word}' → ${term} (${locs})`,
    glossaryDoctor: (n, list) => `${n} uso(s) de palavras que o glossário manda evitar — ${list} (o spec_clarify pergunta por cada uma)`,
    glossaryOk: (n) => `nenhuma palavra que o glossário manda evitar no requirements.md / design.md (${n} termo(s))`,
    glossaryTruncated: (read, total) => `o glossary.md tem ${total} entradas — só as primeiras ${read} são lidas (reduz o número de entradas)`,
    briefGlossaryHeading: "## Glossário (termos que esta task usa)",
    briefGlossaryIntro: "Usa estas palavras exatamente como estão definidas (.specs/steering/glossary.md) — nunca as que são para evitar:",
    briefGlossaryAvoid: (list) => `evitar: ${list}`,
    briefGlossaryOmitted: (list) => `Aplicam-se mais entradas (tamanho) — lê-as no .specs/steering/glossary.md: ${list}`,
  };

// 1.17 A — every design weighs its choices: doctor's design-tradeoffs / design-risks details (keyed by check id, then by the
// section state: missing · template · empty · few · filled) and spec_clarify's consistency nudge (A2). pt-BR derives from pt.
const designWeigh = {
    "design-tradeoffs": {
      filled: (n) => (n ? `${n} opção(ões) ponderada(s)` : "escrita em prosa (sem lista de opções — as opções ponderadas num parágrafo, ou a razão de este design não ter nenhuma decisão-chave)"),
      missing: () => "sem secção Alternativas e Compromissos — lista as opções ponderadas para cada decisão-chave (prós, contras, custo de errar, a escolhida e porquê)",
      template: () => "Alternativas e Compromissos ainda é o template — substitui os placeholders pelas opções realmente ponderadas",
      empty: () => "Alternativas e Compromissos está vazia — lista as opções ponderadas para cada decisão-chave",
      few: (n, min) => `Alternativas e Compromissos lista ${n} opção(ões) — o mínimo são ${min} por decisão-chave (uma linha da tabela ou um item cada: uma opção sozinha nunca foi ponderada), ou uma frase a explicar a ausência de decisões-chave`,
    },
    "design-risks": {
      filled: (n) => (n ? `${n} risco(s) listado(s)` : "escrita (sem linha nem item — um honesto 'nenhum risco relevante' conta)"),
      missing: () => "sem secção Riscos — lista o que pode tornar o design errado ou atrasar a entrega (probabilidade, impacto, mitigação, responsável)",
      template: () => "Riscos ainda é o template — substitui os placeholders pelos riscos reais (ou pela razão de não haver nenhum)",
      empty: () => "Riscos está vazia — um honesto 'nenhum risco relevante, porque X' serve; em branco não",
      few: () => "Riscos não lista nenhum risco",
    },
    // 1.19 R1 — a secção Reutilização e Integração (os estados acima, mais `integration`: o integration-plan.md de uma feature
    // brownfield → Pontos de Integração substitui-a).
    "design-reuse": {
      filled: (n) => (n ? `${n} item(ns) indicado(s) (reutilizado / estendido / novo)` : "escrita (sem linha nem item — 'projeto novo: ainda nada a reutilizar' conta)"),
      missing: () => "sem secção Reutilização e Integração — indica os módulos, componentes, helpers ou serviços existentes que esta feature reutiliza ou estende (com os caminhos), o que é novo e a razão de nada do que existe servir, e onde fica o código novo",
      template: () => "Reutilização e Integração ainda é o template — substitui os placeholders pelo que esta feature realmente reutiliza ou estende, e pelo que é novo (ou indica que é um projeto novo)",
      empty: () => "Reutilização e Integração está vazia — indica o que é reutilizado ou estendido, ou numa linha a razão de nada o ser (projeto novo); em branco não",
      few: () => "Reutilização e Integração não indica nada",
      integration: (n) => `coberta pelo integration-plan.md → Pontos de Integração${n ? ` (${n} item(ns))` : ""}`,
    },
    legacyApproval: (d, v = "1.17") => `design aprovado antes da ${v} — só é exigido a partir da próxima aprovação (${d})`,
    clarifyConsistency: (words) => `A spec menciona ${words}, mas nem os requisitos nem o design dizem nada sobre consistência ou idempotência (a resposta vai para as secções Alternativas e Compromissos / Riscos do design, ou para um requisito): o que tem de ter sucesso ou falhar em conjunto (atomicidade, nível de isolamento), quem mais escreve os mesmos dados ao mesmo tempo, consistência forte ou eventual (que desatualização é aceitável), e a garantia de entrega e a idempotência de tudo o que for assíncrono?`,
  };

// ===========================================================================
// Task brief (spec_task_brief) — the self-contained brief a fresh implementer reads first.
// Labels and loop rules per language; renderBrief() owns the layout. IDs, `_Label:_` markers and
// **Checkpoint:** stay English-stable inside the rendered brief.
// ===========================================================================
const brief = {
    title: (feature, n) => `# Brief da tarefa — ${feature} · tarefa ${n}`,
    intro: "Lê isto primeiro — são os teus requisitos. Os valores abaixo são vinculativos; não construas nada além desta tarefa.",
    story: "História", phase: "Fase", parallel: "Paralela", tracks: "Tracks", loop: "Ciclo",
    yes: "sim [P]", no: "não",
    inlineOnly: "⚠ **Só inline** — tarefa de prompt/evals: o controlador executa-a na sessão principal (as evals custam dinheiro; aceitar/reverter é uma decisão). Não a delegues.",
    task: "## Tarefa",
    context: "## Onde isto encaixa (história de utilizador)",
    bug: "## O bug (bug.md)", bugRepro: "Reprodução", bugRootCause: "Causa raiz",
    bugUnfilled: "_Ainda por escrever — nenhuma correção antes de a causa raiz estar escrita no bug.md._",
    acs: "## Critérios de aceitação (vinculativos)",
    acsNone: "_Nenhum critério de aceitação referido — responde NEEDS_CONTEXT em vez de inventar âmbito._",
    tests: "## Testes a pôr a verde",
    testsRed: "## Testes que esta tarefa escreve — têm de FALHAR primeiro (vermelho)",
    evals: "## Evals afetadas",
    metrics: "## Métricas a emitir",
    files: "## Ficheiros (_Implements:_)",
    // 1.19 R2 — pesquisar antes de escrever: as entradas de Reutilização e Integração do design para esta tarefa, e os ficheiros ao lado dos seus
    reuse: "## Reutilização — pesquisar antes de escrever",
    reuseRule: "Procura no código, pelo conceito e por sinónimos (references/code-reuse-and-quality.md), antes de escrever qualquer helper, componente, cliente, validador ou formatador: primeiro reutilizar, depois estender, só então criar. Uma unidade a estender fora dos ficheiros desta tarefa (_Implements:_) nunca é editada em silêncio — pede contexto (NEEDS_CONTEXT), ou cria localmente e indica-a no relatório. O bloco **Reuse** do teu relatório diz o que foi reutilizado, estendido ou criado, e porquê.",
    reuseEntries: "As entradas de Reutilização e Integração do design para esta tarefa — reutilizar ou estender isto antes de escrever algo novo:",
    reuseOmitted: (n) => `Mais ${n} item(ns) correspondem — lê-os no design.md (Reutilização e Integração).`,
    reuseNoMatch: (n) => `A secção Reutilização e Integração do design lista ${n} item(ns), nenhum com os ficheiros ou os critérios desta tarefa — lê-a antes de criar algo novo.`,
    reuseFiles: "Ficheiros de código existentes ao lado dos desta tarefa — procura aqui primeiro:",
    reuseFilesMore: (n, atLeast) => (!atLeast ? `…e mais ${n} na(s) mesma(s) pasta(s).`
      : n ? `…e pelo menos mais ${n} na(s) mesma(s) pasta(s) — uma pasta grande: só as primeiras entradas foram lidas.`
        : "…e possivelmente mais na(s) mesma(s) pasta(s) — uma pasta grande: só as primeiras entradas foram lidas."),
    design: "## Contexto de design",
    designToc: (p) => `Design completo: \`${p}\` — secções:`,
    designOmitted: "Relevantes mas não incluídas (tamanho) — lê-as no design.md:",
    steering: "## Restrições globais",
    constraintsIntro: "Vinculativas para todas as tarefas (tasks.md → Restrições Globais):",
    verification: "## Verificação (_Verify:_)",
    verifyRule: "Corre cada comando _Verify:_ acima sobre o código final e põe no relatório o comando exato, o exit code e as últimas linhas do output — o controlador regista-os com o spec_complete_task como evidência da tarefa.",
    steeringRead: "Lê antes de programar:",
    unresolved: "## ⚠ Referências não resolvidas",
    unresolvedNote: "A tarefa cita estes IDs mas a spec não os define. Responde NEEDS_CONTEXT em vez de adivinhar.",
    dod: "## Definição de pronto",
    loopRules: {
      core: [
        "Implementa exatamente o que a tarefa e os seus critérios de aceitação exigem — nada a mais (YAGNI).",
        "Corre a suite de testes existente: tudo o que estava verde continua verde.",
        "Faz commit com uma mensagem convencional que cite a tarefa (ex.: `feat(módulo): … — tarefa #N`).",
        "Nunca alteres um teste existente para o pôr a passar. Se um teste parecer errado, pára e responde BLOCKED.",
      ],
      tdd: [
        "Primeiro VERMELHO: corre os testes-alvo e confirma que falham pela razão certa (asserção / não implementado — não um erro de escrita nem um import em falta). Põe o comando e o output no relatório.",
        "Escreve o código mínimo que põe os testes-alvo a verde.",
        "Corre a suite COMPLETA: alvos a verde, testes que estavam verdes continuam verdes, testes de tarefas futuras continuam vermelhos.",
        "Refatora só com tudo verde. Nunca mudes a expectativa de um teste planeado — se parecer errada, pára e responde BLOCKED.",
        "Faz commit citando a tarefa e os testes que põe a verde (`Makes T-01, T-02 green`).",
      ],
      "ai-prompt": [
        "Regista a baseline das evals antes de mudar o que quer que seja.",
        "Edita o prompt num ficheiro versionado NOVO (`prompts/vN.md`), nunca no mesmo ficheiro.",
        "Corre o harness de evals completo; aceita só se o golden melhorou ou se manteve e o adversarial se manteve — caso contrário, reverte.",
        "Faz commit com o delta das evals (`Eval delta: golden 82% → 87%`).",
      ],
    },
    metricsRule: "Cada métrica listada acima é mesmo emitida — mostra a evidência no relatório.",
    redRules: [
      "Esta é uma tarefa VERMELHA: escreve (ou mantém) os testes planeados exatamente como o plano de testes os descreve — nenhum código de produção e nenhuma correção nesta tarefa.",
      "Corre-os: têm de FALHAR pela razão certa — uma asserção ou \"não implementado\". Um ficheiro de teste, módulo ou script em falta, um erro de escrita ou um comando que não corre não é um teste vermelho (é recusado como tal).",
      "Os testes que passavam antes continuam verdes: só os testes novos desta tarefa podem falhar. Nunca alteres um teste existente.",
      "Faz commit do teste a falhar citando a tarefa e os seus T-IDs (`test(âmbito): T-01 red — tarefa #N`).",
    ],
    evalsRule: "Esta alteração toca num caminho de IA: corre o harness de evals no fim — o golden mantém-se ou melhora, o adversarial mantém-se — e põe as pontuações no relatório.",
    checkpoint: "Quando a última tarefa desta história estiver feita, o controlador pára para revisão humana no checkpoint:",
    report: "## Relatório",
    reportTo: (p) => `Escreve o relatório completo em \`${p}\` e responde só com a linha de estado (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), os teus commits, um resumo de uma linha dos testes, eventuais preocupações e o caminho do relatório escrito por extenso (\`${p}\`) — é por esse caminho que o gate de evidência e o controlador chegam ao relatório.`,
    ledgerHeader: (feature) => `# Ledger de execução — feature: ${feature}\n\n<!-- Uma linha por evento, acrescentada pelo controlador (nunca reescrita):\n     Preflight: … · Ruling: <o quê> — <porquê> — <custo se estiver errado> · Task N: dispatched (base <sha>, model <m>)\n     Task N: fix round R/5 (…) · Task N: minor (deferred): … · Task N: parked — … · Task N: complete (commits a..b, review clean)\n     Checkpoint USn: presented → approved -->\n`,
    allDone: "Todas as tarefas estão feitas — não há nada para o brief.",
    alreadyDone: (n) => `A tarefa ${n} já está marcada como feita.`,
  };

module.exports = { build, steering, evalsReadme, msg, quality, designWeigh, brief, __link };
