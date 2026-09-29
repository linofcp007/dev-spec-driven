"use strict";

/**
 * dev-spec-driven engine — the track registries, the classifier and track packs.
 * The built-in tracks (VALID_TRACKS, markers, design-section tables, steering files), track input (parseTracks), the
 * accessors that add the project's track packs (allTracks, trackMarker, trackSectionTable…), a feature's saved tracks
 * (detectTracks) and the inactive-section readers; the Phase 0 classifier (keyword signals EN / PT / ES, negation, the
 * language guess — local, no model); project-defined track packs (.specs/tracks/<name>/: load and validate, cached per
 * call and across calls; render their blocks; spec_tracks). Guide: references/project-tracks.md.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { CTX } = require("./ctx.js"); // the shared per-call state (mutated in place)
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, commentLines, earsValidate, existsCached, extractAcIds, extractTestIds, headingIndex, isInsideDir, isObj,
  newProjectLang, normalizeLang, parseTasks, planIdText, projectLang, PROTO_KEYS, RE_CUSTOM_STEERING, RE_HEADING_LEAD,
  RE_TEMPLATE_VAR, RE_WIN_RESERVED, readCacheKey, readDirCached, readIfExists, readJson, readRoadmap, requirementAcIds,
  specsRoot, statePath, stripFencedCode, stripHtmlComments, taskDescription, templateBracketKeys, templateLangChain,
  testIndex, useTemplateScopeOf, writeIfAbsent;
function __link(E) { ({ acIndex, commentLines, earsValidate, existsCached, extractAcIds, extractTestIds, headingIndex,
  isInsideDir, isObj, newProjectLang, normalizeLang, parseTasks, planIdText, projectLang, PROTO_KEYS,
  RE_CUSTOM_STEERING, RE_HEADING_LEAD, RE_TEMPLATE_VAR, RE_WIN_RESERVED, readCacheKey, readDirCached, readIfExists,
  readJson, readRoadmap, requirementAcIds, specsRoot, statePath, stripFencedCode, stripHtmlComments, taskDescription,
  templateBracketKeys, templateLangChain, testIndex, useTemplateScopeOf, writeIfAbsent } = E); }

const VALID_TRACKS = ["core", "tdd", "saas", "ai", "sec", "privacy", "dist", "api", "ui", "obs"];
// The optional, composable tracks (core is always on) — the classifier's, add_track's and every per-track loop's list.
// Adding a track: VALID_TRACKS + its classifier SIGNALS; a MARKER track (mandatory design sections under a stable
// [Marker]) also needs TRACK_MARKER, a sections table in TRACK_SECTIONS, TRACK_STEERING and its i18n builders
// (requirements criteria, design block, template tasks, test rows, steering stub).
const OPTIONAL_TRACKS = VALID_TRACKS.filter((t) => t !== "core");
// The steering files a track brings (spec_init / add_track write them, the task brief lists them).
const TRACK_STEERING = { tdd: ["testing-standards.md"], saas: ["scale.md", "observability.md", "cost.md"], ai: ["ai-strategy.md"], sec: ["security.md"], privacy: ["privacy.md"],
  dist: ["distributed.md"], api: ["api.md"], ui: ["ui.md"], obs: ["observability.md"] };

// Track input from MCP or the CLI: an array or a string, EVERY element split on whitespace, commas and '+'
// ("tdd,saas", "+saas +ai", ["tdd saas"]), case-insensitive, core implied. Unknown tokens are reported
// (with a did-you-mean) instead of being dropped — silently losing 'sass' also skipped auto-classification.
// → { tracks (stable order, incl. core), named (valid tokens as given), given (any token at all), unknown }
// The track tokens a caller wrote (arrays or strings split on space / comma / '+'), lower-cased.
function trackTokens(input) {
  return (Array.isArray(input) ? input : input == null ? [] : [input])
    .flatMap((x) => String(x == null ? "" : x).split(/[\s,+]+/))
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}
function parseTracks(input) {
  const tokens = trackTokens(input);
  const valid = allTracks(); // the built-in tracks + the project's track packs (1.15)
  const named = [...new Set(tokens.filter((t) => valid.includes(t)))];
  const unknown = [...new Set(tokens.filter((t) => !valid.includes(t)))].map((token) => ({ token, suggestion: suggestTrack(token) }));
  const set = new Set([...named, "core"]); // core is always on
  return { tracks: valid.filter((t) => set.has(t)), named, given: tokens.length > 0, unknown };
}
function normalizeTracks(tracks) {
  return parseTracks(tracks).tracks; // lenient: valid tokens only (the boundaries use parseTracks and report unknowns)
}
// Words people type for a track — suggestion only, never accepted as input.
const TRACK_ALIASES = { ia: "ai", llm: "ai", ml: "ai", genai: "ai", test: "tdd", tests: "tdd", testing: "tdd", scale: "saas", scaling: "saas",
  security: "sec", secure: "sec", appsec: "sec", owasp: "sec", seguranca: "sec", "segurança": "sec", seguridad: "sec",
  priv: "privacy", gdpr: "privacy", rgpd: "privacy", lgpd: "privacy", pii: "privacy", privacidade: "privacy", privacidad: "privacy",
  // +dist (1.17 D) — also names a pack can't take (packReservedName reads these keys)
  distributed: "dist", distribuido: "dist", "distribuído": "dist", distribuida: "dist", microservices: "dist", microservicos: "dist",
  microsservicos: "dist", microservicios: "dist", consistency: "dist", consistencia: "dist", "consistência": "dist", kafka: "dist",
  // +api (1.19 T) — also names a pack can't take (a pre-1.19 pack of one of these names is the feature's missing pack: legacyPackName)
  apis: "api", rest: "api", restful: "api", openapi: "api", swagger: "api", graphql: "api", grpc: "api",
  // +ui (1.19 T) — never "a11y" / "accessibility": a team's accessibility pack (the example of references/project-tracks.md) keeps its name
  frontend: "ui", "front-end": "ui", ux: "ui", gui: "ui", wcag: "ui",
  // +obs (1.19 T)
  observability: "obs", o11y: "obs", monitoring: "obs", sre: "obs", telemetry: "obs", opentelemetry: "obs" };
function suggestTrack(token) {
  // Own keys only: a plain-object lookup matched 'constructor' / '__proto__' and suggested Object itself.
  if (Object.prototype.hasOwnProperty.call(TRACK_ALIASES, token)) return TRACK_ALIASES[token];
  // Optimal-string-alignment distance: a transposition ('sasa', 'ia') costs 1.
  const dist = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  };
  let best = null;
  for (const t of allTracks()) {
    const n = dist(token, t);
    if (n <= Math.max(1, Math.floor(token.length / 2)) && (!best || n < best.n)) best = { t, n };
  }
  return best ? best.t : null;
}
function unknownTracksError(lang, unknown) {
  return i18n.msg(lang).tracks.unknown(unknown, allTracks().join(", "));
}

function trackLabel(tracks) {
  return tracks
    .map((t) => (t === "core" ? "core" : "+" + t))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Heuristic classifier (local, keyword based — no LLM, no cost)
// ---------------------------------------------------------------------------

// Signals are split into STRONG (turns a track on alone) and WEAK (needs corroboration —
// a single weak match is reported as "possible" but does NOT auto-enable the track, which
// cuts false positives like "user-agent" → +ai or "data model" → +ai). Multilingual EN/PT/ES
// plus technical synonyms.
const SIGNALS = {
  tdd: {
    strong: [
      "billing", "payment", "refund", "invoice", "credit", "metering", "charge",
      "subscription", "auth", "login", "signin", "sign-in", "session", "rbac", "sso",
      "oauth", "jwt", "mfa", "2fa", "password", "authentication", "authorization",
      "migration", "integrity", "money", "currency", "decimal", "rounding", "settlement",
      "reconcile", "ledger", "checkout", "exactly-once", "state machine", "pricing",
      "eligibility", "tdd", "test first", "tests first", "test-first", "red green",
      "red-green", "no code without",
      // PT
      "faturação", "faturacao", "fatura", "pagamento", "reembolso", "autenticação",
      "autenticacao", "início de sessão", "inicio de sessao", "palavra-passe", "palavra passe",
      "autorização", "autorizacao", "migração", "migracao", "integridade", "dinheiro",
      "moeda", "mensalidade", "cobrança", "cobranca", "subscrição", "subscricao", "sessão", "sessao",
      "iniciar sessão", "iniciar sessao",
      // pt-BR (1.14 D1)
      "senha", "faturamento",
      // ES
      "facturación", "facturacion", "factura", "pago", "contraseña", "autenticación",
      "autorización", "migración", "integridad", "dinero", "suscripción", "suscripcion", "cobro",
      "sesión", "sesion", "iniciar sesión", "iniciar sesion", "inicio de sesión", "inicio de sesion",
    ],
    weak: [
      "token", "permission", "parser", "parsing", "timezone", "concurrency",
      "race condition", "deadlock", "scheduling", "rollback", "data integrity",
      // PT/ES
      "permissão", "permiso", "fuso horário", "fuso horario", "zona horaria",
      "concorrência", "concurrencia", "agendamento",
    ],
  },
  saas: {
    strong: [
      "multi-tenant", "multitenant", "multi tenant", "tenant isolation", "webhook", "cron",
      "rate limit", "rate-limit", "pci", "soc2", "soc 2", "sla", // gdpr / rgpd / hipaa are +privacy signals (1.14)
      "uptime", "observability", "idempoten", "circuit breaker", "sharding",
      "noisy neighbor", "row-level security", "rls", "dead letter", "dlq", "slo",
      "multi-region", "production-ready", "production grade", "production-grade",
      "enterprise", "high performance", "load test", "load-test", "egress",
      "horizontal scaling", "autoscale", "thousands of users", "millions of",
      // PT
      "inquilino", "multi-inquilino", "multiinquilino", "limite de taxa", "tempo de atividade",
      "observabilidade", "alta disponibilidade", "pronto para produção", "pronto para producao",
      "teste de carga", "escalabilidade",
      // pt-BR (1.14 D1): the Brazilian word for tenant
      "locatário", "multilocatário", "multi-locatário", "multilocatario",
      // ES
      "límite de tasa", "tiempo de actividad", "observabilidad", "alta disponibilidad",
      "listo para producción", "prueba de carga", "escalabilidad",
    ],
    weak: [
      "tenant", "queue", "worker", "background job", "scheduled", "scheduled task",
      "public api", "scale", "throughput", "latency", "p95", "p99", "p50", "tps", "qps",
      "cdn", "cache", "partition",
      // 1.17 D review: a message queue IS a queue — the phrase counts for +saas too (as 'exactly-once' does for +tdd and +dist):
      // listed here, its span equals +dist's strong one, so the +saas hint survives (1.16 parity: "a message queue and a worker").
      "message queue", "distributed cache",
      // PT/ES ("fila de mensagens" / "cola de mensajes" before "fila" / "cola": the first keyword matching at a place wins it)
      "fila de mensagens", "cola de mensajes",
      "fila", "agendado", "tarefa agendada", "desempenho", "latência", "cola", "programado",
      "rendimiento", "latencia", "escala", "caché",
    ],
  },
  ai: {
    strong: [
      "llm", "gpt", "claude", "openai", "anthropic", "gemini", "mistral", "chatbot",
      "copilot", "rag", "fine-tune", "finetune", "fine tune", "hallucinat",
      "prompt injection", "ai feature", "ai product", "semantic search", "embedding",
      "embeddings", "tool use", "function calling", "reranker", "guardrail", "multimodal",
      "vlm", "vector search", "vector database", "image generation", "text generation",
      "language model", "artificial intelligence",
      // PT
      "alucina", "injeção de prompt", "injecao de prompt", "funcionalidade de ia",
      "produto de ia", "pesquisa semântica", "pesquisa semantica", "incorporação",
      "base de dados vetorial", "modelo de linguagem", "inteligência artificial", "inteligencia artificial",
      // pt-BR (1.14 D1)
      "banco de dados vetorial", "busca semântica", "busca semantica", "recurso de ia",
      // ES
      "inyección de prompt", "inyeccion de prompt", "función de ia", "producto de ia",
      "búsqueda semántica", "busqueda semantica", "incrustación", "base de datos vectorial",
      "modelo de lenguaje",
    ],
    weak: [
      "prompt", "agent", "model", "generation", "summariz", "completion", "inference",
      "tokens", "token cost", "assistant", "temperature", "context window", "retrieval",
      "moderation", "few-shot", "sampling", "ai", "generative",
      // PT/ES
      "agente", "modelo", "geração", "resumo", "resumir", "assistente", "inferência", "custo de tokens",
      "generación", "resumen", "asistente", "coste de tokens", "ia", "generativo", "generativa",
    ],
  },
  // +sec (1.14). Auth words stay WEAK here (they are +tdd's strong signals): an auth feature is only "possibly"
  // +sec until a second signal corroborates it. Never a bare "injection" (dependency injection) or "https" (URLs).
  sec: {
    strong: [
      "threat model", "threat modelling", "owasp", "xss", "cross-site scripting", "csrf", "xsrf", "sql injection",
      "command injection", "code injection", "pentest", "pen test", "penetration test", "vulnerabili", "cve", "asvs",
      "secrets management", "secret management", "secrets manager", "encryption at rest", "encryption in transit",
      "security audit", "security review", "security test", "security hardening", "sast", "dast", "attack surface",
      "privilege escalation", "ssrf", "remote code execution", "brute force attack", "brute-force attack", "credential stuffing",
      "session hijack", "clickjacking", "zero trust", "zero-trust", "mtls", "content security policy",
      // PT
      "modelo de ameaças", "modelação de ameaças", "modelagem de ameaças", "injeção de sql", "injeção sql",
      // (pluralize() returns early for a phrase ending in -ão / -ção / -ión: its plural first word is listed too)
      "injeção de código", "injeção de comandos", "teste de intrusão", "testes de intrusão", "teste de penetração",
      "testes de penetração", "gestão de segredos", "gestão de secrets", "cifragem em repouso", "encriptação em repouso",
      "auditoria de segurança", "revisão de segurança", "superfície de ataque", "escalada de privilégios",
      "escalonamento de privilégios", "ataque de força bruta", "sequestro de sessão",
      // C4 — aligned with the EN strong ones (encryption in transit / at rest, security test): they were weak here
      "cifragem em trânsito", "cifragem em transito", "encriptação em trânsito", "criptografia em trânsito", "criptografia em repouso",
      "teste de segurança",
      // pt-BR (1.14 D1)
      "gerenciamento de segredos", "teste de invasão", "testes de invasão",
      // ES
      "modelo de amenazas", "modelado de amenazas", "inyección sql", "inyección de sql", "inyección de código",
      "inyección de comandos", "prueba de penetración", "pruebas de penetración", "prueba de intrusión", "pruebas de intrusión",
      "gestión de secretos", "cifrado en reposo", "auditoría de seguridad", "revisión de seguridad", "superficie de ataque",
      "escalada de privilegios", "escalamiento de privilegios", "ataque de fuerza bruta", "secuestro de sesión",
      // C4 — aligned with EN (encryption in transit / at rest, security test)
      "cifrado en tránsito", "cifrado en transito", "encriptación en tránsito", "encriptación en reposo", "prueba de seguridad",
    ],
    weak: [
      "authentication", "authorization", "rbac", "abac", "access control", "access token", "refresh token",
      "api key", "credential", "encryption", "encrypt", "tls", "cors", "csp", "audit log", "audit trail", "sanitiz",
      "input validation", "security", "hardening", "least privilege", "mfa", "2fa", "two-factor", "firewall", "secrets",
      "brute force", "brute-force", // weak: also an algorithm ("a brute-force search") — the attack phrase is strong
      // C4: the STRIDE methodology only as the upper-case acronym (an upper-case keyword is matched case-sensitively, see
      // classify): a lower-case "stride" is an array stride or a running stride. "STRIDE threat model" stays strong through
      // "threat model".
      "STRIDE",
      // PT
      "autenticação", "autenticacao", "autorização", "autorizacao", "controlo de acesso", "controle de acesso",
      "token de acesso", "chave de api", "credencial", "credenciais", "encriptação", "cifragem", "criptografia", "segurança",
      "registo de auditoria", "trilho de auditoria", "registro de auditoria", "trilha de auditoria", "privilégio mínimo", "menor privilégio", "validação de entrada", "força bruta",
      // ES
      "autenticación", "autorización", "control de acceso", "token de acceso", "clave de api",
      "cifrado", "encriptación", "seguridad", "registro de auditoría", "privilegio mínimo", "validación de entrada", "fuerza bruta",
      // full review Pb5 — the encryption VERBS, PT / pt-BR / ES (EN has "encrypt" + its inflections): encriptar, cifrar,
      // criptografar as VERB_STEMS — their conjugations only, one signal per verb (like encrypt / encryption). Never a bare
      // "cifra": PT/ES also a figure, an amount ("as cifras do trimestre").
      "encript", "cifr", "criptograf",
    ],
    // C4: CORROBORATING-only — evidence for +sec only beside another +sec signal ("RBAC permissions"); alone it is no hint at
    // all, not even a "possible" note (file permission bits, app permissions, "permiso" = a leave of absence).
    // Full review Pb5: "at rest" / "in transit" (EN / PT / ES) the same way — beside "encrypt" they name data encryption
    // ("Encrypt customer PII at rest and in transit"), alone they are a patient at rest or a parcel in transit.
    context: ["permission", "permissão", "permiso", "at rest", "in transit", "em repouso", "em trânsito", "em transito", "en reposo", "en tránsito", "en transito"],
  },
  // +privacy (1.14): GDPR / RGPD. The regulation names moved here from +saas — one concept, one track.
  privacy: {
    strong: [
      "gdpr", "rgpd", "lgpd", "ccpa", "cpra", "hipaa", "personal data", "personally identifiable", "pii", "dpia",
      "data protection", "data subject", "right to erasure", "right to be forgotten", "data portability",
      "data retention", "anonymiz", "anonymis", "pseudonymiz",
      "pseudonymis", "data minimi", "data processing agreement", "privacy by design", "privacy policy", "privacy notice",
      "special category data", "data controller", "data processor", "international transfer", "standard contractual clauses",
      // PT
      "dados pessoais", "dado pessoal", "proteção de dados", "protecao de dados", "titular dos dados", "titulares dos dados",
      "direito ao apagamento", "direito ao esquecimento", "direito de apagamento", "portabilidade dos dados",
      "portabilidade de dados", "retenção de dados", "conservação de dados",
      "anonimiza", "pseudonimiza", "aipd", "cnpd", "categorias especiais de dados", "dados sensíveis", "subcontratante",
      "responsável pelo tratamento", "transferência internacional", "transferências internacionais",
      "política de privacidade", "minimização de dados", "aviso de privacidade",
      // pt-BR (1.14 D1): LGPD vocabulary
      "anpd", "ripd", "relatório de impacto à proteção de dados",
      // ES
      "datos personales", "dato personal", "protección de datos", "titular de los datos",
      "derechos arco", "derecho de supresión", "derecho al olvido", "portabilidad de datos", "portabilidad de los datos",
      "retención de datos", "conservación de datos", "seudonimiza", "eipd", "aepd", "categorías especiales de datos",
      "datos sensibles", "encargado del tratamiento", "responsable del tratamiento", "transferencia internacional",
      "transferencias internacionales", "política de privacidad", "minimización de datos", "aviso de privacidad",
    ],
    weak: [
      "user data", "customer data", "user profile", "customer profile", "email address", "phone number", "date of birth",
      "cookie", "user tracking", "geolocation", "location data", "biometric", "health data", "contact details", "opt-out",
      "opt-in", "unsubscribe", "privacy", "delete account", "account deletion", "data export", "dpa",
      // C4: generic alone — an OAuth consent screen, a trash folder's retention period, an archive's retention policy are no
      // personal-data processing. WEAK (EN / PT / ES alike): +privacy only once another privacy signal corroborates them.
      "consent", "retention period", "retention policy", "retention policies",
      // PT
      "dados do utilizador", "dados dos utilizadores", "dados de utilizador", "dados do cliente", "dados dos clientes",
      "perfil do utilizador", "perfil de utilizador", "perfil do cliente", "endereço de email", "endereço de e-mail",
      "número de telefone", "número de telemóvel", "data de nascimento", "geolocalização", "dados de saúde",
      "dados biométricos", "privacidade", "apagar conta", "eliminar conta", "exportar dados", "avaliação de impacto",
      "consentimento", "prazo de conservação", "período de retenção", "política de retenção", "política de conservação", // C4 (see EN)
      // pt-BR (1.14 D1)
      "dados do usuário", "dados dos usuários", "dados de usuário", "perfil do usuário", "perfil de usuário", "número de celular",
      "excluir conta", "exclusão de conta",
      // ES
      "datos del usuario", "datos de usuario", "datos de los usuarios", "datos del cliente", "perfil de usuario",
      "perfil del usuario", "perfil del cliente", "dirección de correo", "número de teléfono", "fecha de nacimiento",
      "datos de salud", "datos biométricos", "privacidad", "eliminar cuenta", "borrar cuenta", "exportar datos", "evaluación de impacto",
      "consentimiento", "plazo de conservación", "periodo de retención", "período de retención", "política de retención", // C4 (see EN)
      "política de conservación",
    ],
  },
  // +dist (1.17 D): distributed systems and data consistency — a write that reaches more than one system (a database AND a
  // broker, a cache, another service), delivery guarantees, idempotency, concurrency. STRONG: the named brokers / job and workflow
  // platforms and the patterns that only exist across systems (transactional outbox, saga pattern, dual write, eventual
  // consistency, two-phase commit, microservices, event sourcing, CQRS, change data capture, optimistic / pessimistic locking…).
  // WEAK — the cross-system ANCHORS, on only in pairs: webhooks, idempotency, delivery guarantees (at-least-once, duplicate
  // deliveries), other / another / downstream services, dead letters, circuit breakers, backoff, replication, cache invalidation,
  // concurrent updates, an event bus / stream / event-driven design, a bare "saga" (also a story series), "CDC" (also the health
  // agency), Redis, a search index, gRPC. GENERIC (1.17 D review — app-level words: a print queue, a music player's retry, a
  // farmers' market's producers and consumers, a newsletter's subscribers, a nightly dedupe): weak evidence that turns the
  // track on only beside a strong or an anchor signal — two generic words alone stay 'possible'. Never a bare "event" (DOM,
  // calendar, analytics events), "lock" (an account lock), "stream" (video streaming) or "broker" (an insurance broker).
  // CONTEXT (corroborating only): transaction, consistency, atomic(ity) — data-consistency words that alone are ordinary
  // ("a consistent UI"). One concept, one signal: SIGNAL_CONCEPTS folds the words of one concept (retry · backoff · jitter,
  // consumer · producer · subscriber, dedupe · deduplicate).
  // Shared spans: 'exactly-once' is +tdd strong too, 'idempoten' / 'webhook' / 'circuit breaker' / 'dead letter' +saas strong,
  // 'queue' / 'worker' / 'background job' / 'fila' / 'cola' +saas weak, 'race condition' +tdd weak — a keyword serves both tracks
  // (equal spans are never shadowed); "message queue" / "distributed cache" (and PT / ES) are listed in +saas weak too, so the
  // +saas hint survives inside them (1.17 D review — 1.16 parity).
  dist: {
    strong: [
      "kafka", "rabbitmq", "activemq", "amqp", "amazon sqs", "sqs", "kinesis", "eventbridge", "service bus", "redis streams", "debezium",
      // named platforms (1.17 D review). A common word is matched only in its capitalised product phrase (a keyword written with
      // capitals is case-sensitive): "Temporal workflow" (PT / ES "temporal" is an adjective), "Celery task" (a vegetable),
      // "Pulsar topic" (a star), "NATS", "Event Hubs", "CDC pipeline".
      "google pub / sub", "cloud pub / sub", "pub / sub topic", "NATS", "apache pulsar", "Pulsar topic", "azure event hub", "Event Hubs",
      "Temporal workflow", "Temporal worker", "sidekiq", "Celery task", "Celery worker", "bullmq", "resque", "nservicebus", "masstransit",
      "CDC pipeline", "CDC connector",
      "message broker", "message queue", "message bus", "event broker", "event-driven architecture", "event driven architecture",
      "stream processing", "event sourcing", "event-sourced", "domain event", "integration event",
      "transactional outbox", "outbox pattern", "outbox table", "inbox pattern", "idempotent consumer", "dual write", "dual-write",
      "eventual consistency", "eventually consistent", "strong consistency", "strongly consistent", "read-your-writes",
      "distributed transaction", "distributed system", "distributed lock", "distributed cache", "two-phase commit", "two phase commit",
      "2PC", "microservice", "micro-service", "cqrs", "change data capture", "exactly-once", "at-least-once delivery",
      "saga pattern", "saga orchestration", "saga orchestrator", "compensating transaction", "compensating action",
      "optimistic locking", "pessimistic locking", "isolation level", "write skew", "lost update", "network partition",
      "split brain", "split-brain", "read replica", "replication lag",
      // PT (pluralize() adds a plural to a phrase's FIRST word only for -ção / "de" / non-ASCII phrases: the other plurals are listed)
      "fila de mensagens", "broker de mensagens", "outbox transacional", "padrão outbox", "tabela de outbox", "escrita dupla", "escritas duplas",
      "consistência eventual", "eventualmente consistente", "consistência forte", "transação distribuída", "transações distribuídas",
      "commit em duas fases", "commit de duas fases", "microsserviço", "micro-serviço", "arquitetura orientada a eventos",
      "sistema distribuído", "bloqueio otimista", "bloqueio pessimista",
      "nível de isolamento", "atualização perdida", "atualizações perdidas", "partição de rede", "partições de rede",
      "captura de dados de alteração", "transação de compensação", "transações de compensação", "consumidor idempotente",
      "réplica de leitura", "atraso de replicação",
      // ES
      "cola de mensajes", "broker de mensajes", "outbox transaccional", "patrón outbox", "tabla de outbox", "escritura dual", "escrituras duales",
      "doble escritura", "consistencia eventual", "consistencia fuerte", "transacción distribuida", "transacciones distribuidas",
      "commit en dos fases", "confirmación en dos fases", "microservicio", "arquitectura orientada a eventos", "sistema distribuido",
      "sistemas distribuidos", "bloqueo optimista", "bloqueo pesimista", "nivel de aislamiento", "actualización perdida",
      "actualizaciones perdidas", "partición de red", "particiones de red", "captura de datos de cambios", "transacción de compensación",
      "transacciones de compensación", "réplica de lectura", "retraso de replicación",
    ],
    // ANCHORS: a word that names a second system or a delivery / concurrency concern. (A bare "outbox" — an email client's folder
    // — an "event stream" (a live keynote), an "event bus" (Vue's in-process bus), "event-driven" (a game loop) and "leader
    // election" (a club vote) were strong in the first 1.17 cut: weak now.)
    weak: [
      "webhook", "idempoten", "at-least-once", "at-most-once", "duplicate delivery", "delivered twice", "delivered more than once",
      "duplicate message", "duplicate event", "other services", "another service", "downstream service", "cross-service",
      "exponential backoff", "backoff exponencial", "backoff", // ("backoff exponencial" before "backoff": the first keyword matching at a place wins it)
      "replication", "cache invalidation", "saga", "CDC", "dead letter", "dead-letter", "dlq", "poison message", "circuit breaker",
      "concurrent updates", "concurrent writes", "update … lost", "overwrite each other", "version column", "clock skew",
      "message ordering", "event bus", "event stream",
      "event-driven", "event driven", "leader election", "redis", "search index", "elasticsearch", "opensearch", "grpc",
      // a service named by its domain role ("the notification service", "the payment service") — one concept with "other services"
      "notification service", "payment service", "billing service", "order service", "orders service", "shipping service",
      "inventory service", "analytics service", "pricing service", "catalog service",
      // PT
      "outros serviços", "outro serviço", "recuo exponencial", "replicação", "réplica", "invalidação de cache", "atualizações concorrentes",
      "escritas concorrentes", "atualização … perdida", "barramento de eventos", "orientado a eventos", "orientada a eventos",
      "entregue duas vezes", "mensagens duplicadas", "eventos duplicados", "coluna de versão", "serviço de notificações", "serviço de pagamentos",
      "serviço de faturação", "serviço de faturamento", "serviço de encomendas", "serviço de pedidos", "serviço de envios", "serviço de inventário",
      "serviço de stock", "serviço de estoque", "serviço de preços", "serviço de catálogo",
      // ES
      "otros servicios", "otro servicio", "retroceso exponencial", "replicación", "invalidación de caché", "actualizaciones concurrentes",
      "escrituras concurrentes", "actualización … perdida", "bus de eventos", "entregado dos veces", "mensajes duplicados", "columna de versión",
      "servicio de notificaciones", "servicio de pagos", "servicio de facturación", "servicio de pedidos", "servicio de envíos",
      "servicio de inventario", "servicio de precios", "servicio de catálogo",
    ],
    // GENERIC (1.17 D review): app-level words — evidence only beside a strong or an anchor signal (see above).
    generic: [
      "queue", "consumer", "producer", "subscriber", "retry", "jitter", "deduplica", "dedup", "dedupe", "race condition",
      "pubsub", "pub-sub", "pub / sub", "publish-subscribe", "publish / subscribe", "publish … event", "publish … message",
      "send … message", "exactly once", "event store", "outbox", "worker", "background job", "keep … in sync", "update … same",
      "oversell", "compensate", "concurrently", "simultaneously",
      // PT ("tentar novamente" is no signal: "the user can try again")
      "fila", "consumidor", "produtor", "subscritor", "nova tentativa", "novas tentativas", "retentativa", "desduplica",
      "condição de corrida", "condições de corrida", "public … evento", "public … mensagem", "envi … mensagem", "pelo menos uma vez",
      "no máximo uma vez", "exatamente uma vez", "em segundo plano", "em simultâneo", "simultaneamente",
      // ES
      "cola", "productor", "suscriptor", "reintento", "condición de carrera", "condiciones de carrera", "public … mensaje",
      "envi … mensaje", "al menos una vez", "como máximo una vez", "exactamente una vez", "en segundo plano", "simultáneamente",
      "de forma concurrente",
    ],
    context: ["transaction", "consistency", "atomic", "atomically", "atomicity",
      "transação", "consistência", "atómico", "atômico", "atomicidade", "atomicamente",
      "transacción", "consistencia", "atomicidad", "atómicamente"],
  },
  // +api (1.19 T): an API contract other code depends on — public, partner or internal. STRONG: contract-level words only (a
  // public / REST / HTTP API, OpenAPI / Swagger, GraphQL, gRPC / protobuf, API versioning, the contract itself, its consumers —
  // third-party developers, a developer portal —, the headers and formats a contract fixes: problem+json, Idempotency-Key,
  // rate-limit headers, Retry-After, Sunset). WEAK — the anchors, on only in pairs or beside a generic word: compatibility
  // (backward compatible, a breaking change), an SDK / client library (also the one you consume), ETag / If-Match, status codes,
  // JSON Schema, cursor pagination, deprecation, an API gateway / internal API / the API docs. GENERIC (app-level): api, endpoint,
  // route, request, pagination — every app has them; alone they are 'possible' at most ("call the Stripe API", "an API key
  // management page" — +sec's api key is no contract). HAZARDS: a breaking change is written negated by nature ("without
  // breaking changes") — the negation is the requirement.
  api: {
    strong: [
      "public api", "rest api", "restful", "http api", "web api", "json api", "partner api", "api-first", "contract-first",
      "openapi", "swagger", "graphql", "grpc", "protobuf", "protocol buffers", "proto file",
      "api versioning", "api version", "versioned api", "api v1", "api v2", "api v3", "breaking api change", "api contract",
      "api spec", "api specification", "api design", "api consumer", "third-party developers", "third party developers",
      "external developers", "developer portal", "contract test", "consumer-driven contract",
      "application/problem+json", "problem+json", "problem details", "rfc 9457", "rfc 7807", "idempotency-key", "rate limit headers",
      "ratelimit header", "x-ratelimit", "retry-after", "sunset header", "deprecation header",
      // PT (the plural of a phrase's first word is generated only for "de" / non-ASCII phrases: the others are listed)
      "api pública", "api rest", "versionamento da api", "versionamento de api", "versão da api", "versões da api",
      "contrato da api", "contrato de api", "especificação da api", "consumidores da api", "programadores externos",
      "desenvolvedores externos", "programadores terceiros", "desenvolvedores terceiros", "portal de programadores",
      "portal do programador", "portal do desenvolvedor", "portal de desenvolvedores", "teste de contrato",
      // ES
      "versionado de la api", "versionado de api", "versión de la api", "versiones de la api", "contrato de la api",
      "especificación de la api", "consumidores de la api", "desarrolladores externos", "desarrolladores de terceros",
      "portal de desarrolladores", "prueba de contrato",
    ],
    weak: [
      "breaking change", "backward compatible", "backwards compatible", "backward-compatible", "backwards-compatible",
      "backward compatibility", "backwards compatibility", "sdk", "client library", "client libraries", "etag", "if-match",
      "if-none-match", "status code", "http status", "json schema", "request schema", "response schema", "cursor pagination",
      "cursor-based pagination", "keyset pagination", "deprecation", "api gateway", "internal api", "api client",
      "api documentation", "api docs", "api reference", "content negotiation",
      // PT
      "quebra de compatibilidade", "alteração incompatível", "alterações incompatíveis", "mudança incompatível", "mudanças incompatíveis",
      "compatibilidade retroativa", "retrocompatível", "retrocompatíveis", "retrocompatibilidade", "compatível com versões anteriores",
      "código de estado", "código de status", "esquema json", "paginação por cursor",
      "cliente da api", "api interna", "documentação da api", "descontinuação", "gateway de api",
      // ES
      "cambio incompatible", "cambios incompatibles", "compatibilidad hacia atrás", "retrocompatible",
      "retrocompatibilidad", "paginación por cursor", "cliente de la api", "documentación de la api", "obsolescencia",
    ],
    generic: [
      "api", "endpoint", "route", "request", "pagination", "paginate",
      // PT / ES
      "rota", "requisição", "paginação", "ruta", "solicitud http", "petición http", "paginación",
    ],
  },
  // +ui (1.19 T): a user-facing interface — the screens, the design system, accessibility, the states every view needs, the
  // front-end performance budget. STRONG: the design system and its parts (tokens, a component library, UI components), WCAG /
  // accessibility and its concrete words (a screen reader, keyboard navigation, focus order, contrast, alt text, ARIA, reduced
  // motion), responsive design, dark mode, Storybook / Figma, Core Web Vitals (LCP), visual regression, an empty state / skeleton
  // screen and the UI-heavy page types (a settings / admin / management / profile / landing page, an admin panel). WEAK (anchors):
  // the frontend, UI / UX (capitals — "translate the UI into Spanish", "Spanish UI labels" alone stay 'possible'), a UI framework named with its capital (React, Vue, Angular,
  // Svelte), CSS / Tailwind, widgets (modal, dropdown, tooltip, sidebar, toast, carousel, spinner), responsive, i18n / l10n,
  // RTL / CLS / INP (capitals), a loading / error state, form validation, a wireframe / mockup. GENERIC (app-level — every
  // feature has them): screen, page, form, button, dialog, dashboard, menu, icon, widget, click, layout, theme — "add a button
  // to export" or "the log in form" is 'possible' at most. A dashboard is +ui's generic word only (never +obs: "a metrics
  // dashboard for sales" is a product screen); a monitoring / Grafana dashboard is +obs strong and shadows it.
  ui: {
    strong: [
      "design system", "design-system", "design tokens", "component library", "ui component", "ui kit", "user interface", "wcag", "accessibility", "a11y",
      "screen reader", "screen-reader", "keyboard navigation", "keyboard accessible", "keyboard-only", "keyboard only", "focus order",
      "focus trap", "focus indicator", "focus management", "color contrast", "colour contrast", "contrast ratio", "alt text", "aria-label",
      "aria-live", "ARIA", "reduced motion", "prefers-reduced-motion", "responsive layout", "responsive design", "mobile-first", "dark mode",
      "storybook", "figma", "core web vitals", "largest contentful paint", "cumulative layout shift", "interaction to next paint", "LCP",
      "visual regression", "skeleton screen", "skeleton loader", "empty state", "right-to-left", "landing page", "settings page",
      "settings screen", "admin page", "admin panel", "admin ui", "management page", "profile page", "account page",
      // PT
      "sistema de design", "acessibilidade", "leitor de ecrã", "leitor de tela", "navegação por teclado", "contraste de cor", "texto alternativo", "movimento reduzido", "design responsivo", "layout responsivo", "modo escuro", "tema escuro",
      "interface do utilizador", "interface de utilizador", "interface do usuário", "interface de usuário", "componente de interface",
      "biblioteca de componentes", "regressão visual", "estado vazio", "página de definições", "página de configurações",
      "página de administração", "painel de administração", "página de gestão", "página de perfil", "ecrã de definições",
      "tela de configurações",
      // ES
      "sistema de diseño", "accesibilidad", "lector de pantalla", "navegación por teclado", "contraste de color", "movimiento reducido",
      "diseño responsivo", "diseño adaptable", "modo oscuro", "tema oscuro", "interfaz de usuario", "componente de interfaz", "regresión visual",
      "estado vacío", "página de ajustes", "página de configuración", "panel de administración", "página de gestión", "pantalla de ajustes",
    ],
    weak: [
      "frontend", "front-end", "UI", "UX", "React", "Vue", "Angular", "Svelte", "tailwind", "css", "stylesheet", "modal", "dropdown", "tooltip",
      "navbar", "sidebar", "toast", "carousel", "spinner", "responsive", "i18n", "l10n", "RTL", "CLS", "INP", "loading state", "error state",
      "form validation", "wireframe", "mockup",
      // PT
      "responsivo", "responsiva", "estado de carregamento", "estado de erro", "validação de formulário",
      // ES
      "estado de carga", "estado de error", "validación de formulario",
    ],
    generic: [
      "screen", "page", "form", "button", "dialog", "dashboard", "menu", "icon", "widget", "click", "layout", "theme",
      // PT
      "ecrã", "tela", "página", "formulário", "botão", "painel", "ícone",
      // ES
      "pantalla", "formulario", "botón", "icono",
    ],
  },
  // +obs (1.19 T): observability & operability — a feature the team can watch, alert on, roll out and roll back. STRONG: SLOs /
  // SLIs / error budgets / burn rates, observability, OpenTelemetry, distributed tracing, runbooks, on-call, the alerting and
  // monitoring tools (PagerDuty, Opsgenie, Prometheus, Grafana, Datadog, Sentry…), structured logging, correlation / trace IDs,
  // incident response and postmortems, feature flags / kill switches, a canary release / blue-green / progressive / staged
  // rollout, a rollback plan, liveness / readiness probes, synthetic monitoring, chaos engineering / fault injection, a monitoring
  // dashboard. WEAK (anchors): monitoring, alerts, a health check, uptime, an SLA, an incident, an outage, downtime, a rollback, a
  // rollout, a bare canary ("Canary Islands" is no release),
  // telemetry, instrumentation, tracing, APM (capitals), an error rate, 5xx, on call (two words — a doctor on call is prose).
  // GENERIC: metrics, logs / logging, latency, p99 / p95 / p50, monitor, deploy — every service has them: "a metrics dashboard for
  // sales" or "store the import logs" is 'possible' at most. Never a bare "log" ("log in"), "trace" or "dashboard" (+ui's word).
  // HAZARDS: "zero downtime", "without an outage" state the concern. Shared: observability / SLO / SLA / uptime are +saas strong
  // too (the 1.14 +saas hint survives — a phrase may serve two tracks), rollback +tdd weak, latency / p95 / p99 +saas weak.
  obs: {
    strong: [
      "observability", "slo", "sli", "error budget", "burn rate", "burn-rate", "opentelemetry", "otel", "distributed tracing", "runbook",
      "on-call", "pagerduty", "opsgenie", "alertmanager", "alerting rule", "alert rule",
      // (a longer phrase before its prefix: the first keyword matching at a place wins it — and shadows +ui's generic "dashboard")
      "monitoring dashboard", "grafana dashboard", "datadog dashboard", "prometheus", "grafana", "datadog", "new relic",
      "jaeger", "zipkin", "sentry", "structured logging", "structured logs", "correlation id", "trace id", "trace context",
      "context propagation", "golden signals", "mttr", "mttd", "incident response", "postmortem", "post-mortem", "feature flag",
      "feature toggle", "kill switch", "canary release", "canary deployment", "canary deploy", "canary rollout", "canary analysis", "blue-green", "progressive delivery", "progressive rollout", "gradual rollout",
      "staged rollout", "phased rollout", "percentage rollout", "dark launch", "rollback plan", "automatic rollback", "liveness probe",
      "readiness probe", "health check endpoint", "synthetic monitoring", "real user monitoring", "chaos engineering", "fault injection",
      "game day", "zero-downtime", "zero downtime", "operational dashboard", "ops dashboard",
      "log aggregation", "error tracking",
      // PT
      "observabilidade", "orçamento de erro", "rastreio distribuído", "rastreamento distribuído", "registos estruturados",
      "logs estruturados", "resposta a incidentes", "lançamento canário", "lançamento gradual", "lançamento progressivo", "plano de rollback",
      "plano de reversão", "painel de monitorização", "painel de monitoramento", "engenharia do caos", "injeção de falhas",
      // ES
      "observabilidad", "presupuesto de error", "rastreo distribuido", "trazas distribuidas", "logs estructurados",
      "registros estructurados", "respuesta a incidentes", "despliegue canario", "lanzamiento canario", "despliegue gradual",
      "despliegue progresivo", "plan de reversión", "plan de rollback", "panel de monitorización", "panel de monitoreo", "ingeniería del caos",
      "inyección de fallos",
    ],
    weak: [
      "monitoring", "alerts", "alerting", "health check", "healthcheck", "liveness", "readiness", "uptime", "sla", "incident", "outage",
      "downtime", "rollback", "roll back", "rollout", "roll out", "canary", "telemetry", "instrumentation", "tracing", "APM", "error rate", "5xx",
      "on call",
      // PT
      "monitorização", "monitoramento", "alertas", "incidente", "indisponibilidade", "reversão", "telemetria", "instrumentação", "rastreio",
      "taxa de erro", "tempo de inatividade", "plantão",
      // ES
      "monitorización", "monitoreo", "caída del servicio", "reversión", "telemetría", "instrumentación", "trazas", "tasa de error",
      "tiempo de inactividad", "guardia",
    ],
    generic: [
      "metrics", "logs", "logging", "latency", "p99", "p95", "p50", "monitor", "deploy",
      // PT / ES
      "métricas", "latência", "latencia", "implantação", "despliegue",
    ],
  },
};
// One concept, one signal (1.17 D review) — a built-in track's weak / generic keywords that name the SAME concept count once:
// "deduplicate … dedupe them", "producers and consumers", "retry … with jitter" are one hint each, never the two weak signals
// that would turn the track on. Keyed by track (a keyword may belong to a concept in one track only: +saas' 'worker' and
// 'background job' stay two signals there). The concept of the matched keywords decides, whatever their tier: a concept with an
// anchor (weak) keyword matched counts as an anchor. Track packs have none (their keywords are their own).
const conceptMap = (groups) => new Map(Object.entries(groups).flatMap(([c, kws]) => kws.map((k) => [k, c])));
const SIGNAL_CONCEPTS = {
  dist: conceptMap({
    queue: ["queue", "fila", "cola"],
    party: ["consumer", "producer", "subscriber", "consumidor", "produtor", "subscritor", "productor", "suscriptor"],
    retry: ["retry", "jitter", "nova tentativa", "novas tentativas", "retentativa", "reintento", "exponential backoff", "backoff exponencial",
      "backoff", "recuo exponencial", "retroceso exponencial"],
    dedup: ["deduplica", "dedup", "dedupe", "desduplica"],
    race: ["race condition", "condição de corrida", "condições de corrida", "condición de carrera", "condiciones de carrera"],
    publish: ["pubsub", "pub-sub", "pub / sub", "publish-subscribe", "publish / subscribe", "publish … event", "publish … message",
      "public … evento", "public … mensagem", "public … mensaje", "send … message", "envi … mensagem", "envi … mensaje"],
    worker: ["worker", "background job", "em segundo plano", "en segundo plano"],
    concurrent: ["concurrently", "simultaneously", "em simultâneo", "simultaneamente", "simultáneamente", "de forma concurrente",
      "concurrent updates", "concurrent writes", "atualizações concorrentes", "escritas concorrentes", "actualizaciones concurrentes",
      "escrituras concurrentes"],
    services: ["other services", "another service", "downstream service", "cross-service", "outros serviços", "outro serviço",
      "otros servicios", "otro servicio", "notification service", "payment service", "billing service", "order service", "orders service",
      "shipping service", "inventory service", "analytics service", "pricing service", "catalog service", "serviço de notificações",
      "serviço de pagamentos", "serviço de faturação", "serviço de faturamento", "serviço de encomendas", "serviço de pedidos",
      "serviço de envios", "serviço de inventário", "serviço de stock", "serviço de estoque", "serviço de preços", "serviço de catálogo",
      "servicio de notificaciones", "servicio de pagos", "servicio de facturación", "servicio de pedidos", "servicio de envíos",
      "servicio de inventario", "servicio de precios", "servicio de catálogo"],
    deadLetter: ["dead letter", "dead-letter", "dlq", "poison message"],
    delivery: ["at-least-once", "at-most-once", "exactly once", "duplicate delivery", "delivered twice", "delivered more than once",
      "duplicate message", "duplicate event", "pelo menos uma vez", "no máximo uma vez", "exatamente uma vez", "entregue duas vezes",
      "mensagens duplicadas", "eventos duplicados", "al menos una vez", "como máximo una vez", "exactamente una vez", "entregado dos veces",
      "mensajes duplicados"],
    replication: ["replication", "réplica", "replicação", "replicación"],
    cacheInvalidation: ["cache invalidation", "invalidação de cache", "invalidación de caché"],
    eventBus: ["event bus", "barramento de eventos", "bus de eventos"],
    eventDriven: ["event-driven", "event driven", "orientado a eventos", "orientada a eventos"],
    lostUpdate: ["update … lost", "atualização … perdida", "actualización … perdida", "overwrite each other"],
    versionColumn: ["version column", "coluna de versão", "columna de versión"],
    sameRecord: ["update … same"],
    searchIndex: ["search index", "elasticsearch", "opensearch"],
  }),
  // +api (1.19 T): compatibility is one concept ("no breaking change, stay backward compatible"), so are ETag / If-Match, the
  // status codes, the schemas, cursor pagination, a client library / SDK; the generic words (an endpoint and its route, a request).
  api: conceptMap({
    compat: ["breaking change", "backward compatible", "backwards compatible", "backward-compatible", "backwards-compatible",
      "backward compatibility", "backwards compatibility", "quebra de compatibilidade", "alteração incompatível", "alterações incompatíveis",
      "mudança incompatível", "mudanças incompatíveis", "compatibilidade retroativa", "retrocompatível", "retrocompatíveis",
      "retrocompatibilidade", "compatível com versões anteriores", "cambio incompatible", "cambios incompatibles",
      "compatibilidad hacia atrás", "retrocompatible", "retrocompatibilidad"],
    client: ["sdk", "client library", "client libraries", "api client", "cliente da api", "cliente de la api"],
    etag: ["etag", "if-match", "if-none-match"],
    status: ["status code", "http status", "código de estado", "código de status"],
    schema: ["json schema", "request schema", "response schema", "esquema json"],
    cursor: ["cursor pagination", "cursor-based pagination", "keyset pagination", "paginação por cursor", "paginación por cursor"],
    docs: ["api documentation", "api docs", "api reference", "documentação da api", "documentación de la api"],
    deprecation: ["deprecation", "descontinuação", "obsolescencia"],
    endpoint: ["endpoint", "route", "rota", "ruta"],
    request: ["request", "requisição", "solicitud http", "petición http"],
    paging: ["pagination", "paginate", "paginação", "paginación"],
  }),
  // +ui (1.19 T): a UI framework, the styling, i18n, a loading / error state, form validation, "responsive" are one concept each;
  // the generic words too (a screen is a page, a form, a button, a dashboard, an icon).
  ui: conceptMap({
    framework: ["React", "Vue", "Angular", "Svelte"],
    uiux: ["UI", "UX"],
    style: ["css", "stylesheet", "tailwind"],
    frontend: ["frontend", "front-end"],
    i18n: ["i18n", "l10n", "RTL"],
    vitals: ["CLS", "INP"],
    states: ["loading state", "error state", "estado de carregamento", "estado de erro", "estado de carga", "estado de error"],
    formValidation: ["form validation", "validação de formulário", "validación de formulario"],
    responsive: ["responsive", "responsivo", "responsiva"],
    design: ["wireframe", "mockup"],
    screen: ["screen", "page", "ecrã", "tela", "página", "pantalla"],
    form: ["form", "formulário", "formulario"],
    button: ["button", "botão", "botón", "click"],
    dashboard: ["dashboard", "painel"],
    icon: ["icon", "ícone", "icono"],
  }),
  // +obs (1.19 T): alerting, monitoring, health checks, a rollback, a rollout, an outage, telemetry, tracing, error rates, on-call and
  // availability are one concept each; the generic metrics / logs / latency / deploy words too.
  obs: conceptMap({
    alerting: ["alerts", "alerting", "alertas"],
    monitoring: ["monitoring", "monitorização", "monitoramento", "monitorización", "monitoreo"],
    health: ["health check", "healthcheck", "liveness", "readiness"],
    rollback: ["rollback", "roll back", "reversão", "reversión"],
    rollout: ["rollout", "roll out"],
    outage: ["outage", "downtime", "indisponibilidade", "tempo de inatividade", "caída del servicio", "tiempo de inactividad"],
    incident: ["incident", "incidente"],
    telemetry: ["telemetry", "instrumentation", "telemetria", "instrumentação", "telemetría", "instrumentación"],
    tracing: ["tracing", "rastreio", "trazas"],
    errors: ["error rate", "5xx", "taxa de erro", "tasa de error"],
    oncall: ["on call", "plantão", "guardia"],
    availability: ["uptime", "sla"],
    metrics: ["metrics", "métricas"],
    logs: ["logs", "logging"],
    latency: ["latency", "p99", "p95", "p50", "latência", "latencia"],
    deploy: ["deploy", "implantação", "despliegue"],
  }),
};
// HAZARDS (1.17 D review): a failure a requirement says must never happen — "concurrent updates never oversell", "no lost updates",
// "they must not overwrite each other", "no duplicate deliveries". Written negated by nature, the negation is the requirement,
// not an absence: such a keyword counts (and is no "appeared negated" note). Built-in +dist only.
const SIGNAL_HAZARDS = {
  dist: new Set(["lost update", "atualização perdida", "atualizações perdidas", "actualización perdida", "actualizaciones perdidas",
    "update … lost", "atualização … perdida", "actualización … perdida", "overwrite each other", "write skew", "split brain", "split-brain",
    "oversell", "race condition", "condição de corrida", "condições de corrida", "condición de carrera", "condiciones de carrera",
    "duplicate delivery", "duplicate message", "duplicate event", "delivered twice", "delivered more than once", "entregue duas vezes",
    "entregado dos veces", "mensagens duplicadas", "eventos duplicados", "mensajes duplicados"]),
  // +api (1.19 T): "no breaking changes", "sem quebra de compatibilidade", "sin cambios incompatibles" state the contract concern.
  api: new Set(["breaking change", "breaking api change", "quebra de compatibilidade", "alteração incompatível", "alterações incompatíveis",
    "mudança incompatível", "mudanças incompatíveis", "cambio incompatible", "cambios incompatibles"]),
  // +obs (1.19 T): "zero downtime", "without an outage", "sem indisponibilidade", "sin tiempo de inactividad" state the concern.
  obs: new Set(["downtime", "outage", "indisponibilidade", "tempo de inatividade", "caída del servicio", "tiempo de inactividad"]),
};

// Words that negate a signal when they appear just before the keyword (EN/PT/ES).
const NEGATORS = ["no", "not", "without", "never", "skip", "exclude", "avoid", "omit", "dispensa", "prescinde", "sem", "não", "nao", "sin"];

// Words that may sit between a negator and the keyword ("sem uso de IA", "without the use of any LLM").
const NEG_FILLER = new Set(["uso", "use", "usage", "of", "de", "do", "da", "del", "the", "a", "an", "any", "qualquer", "nenhum", "nenhuma", "ningún", "ninguna", "ningun", "el", "la", "o"]);
// The English ones — the only fillers a wide "no" may negate across (see isNegated).
const NEG_FILLER_EN = new Set(["use", "usage", "of", "the", "a", "an", "any"]);

// Phrases that negate a signal shortly AFTER the keyword ("auth is not needed", "auth não é preciso").
const NEG_AFTER = /^\s*(\w+\s+)?(is |are |isn'?t |aren'?t |won'?t |é |são |sao |es |no )?(not (needed|required|necessary|used)|n[ãa]o (é |e )?(preciso|necess[áa]ri[ao]|usad[ao])|no (es )?necesari[ao]|no hace falta)\b/;

// Which language a description is written in, from function words only EN/PT/ES use. Needed for
// "no": a negator in EN ("no LLM") and ES ("no usa LLM"), but in PT it is the contraction em+o —
// "desconto aplicado no checkout" is IN the checkout (PT negates with não/sem).
// Only UNAMBIGUOUS markers: "do", "da", "com", "usa", "los", "del", "con"… also occur in English text
// ("Do the export", "example.com", "USA offices", "Las Vegas") and flipped negation + reasoning language.
// STRONG markers (weight 2) never occur in English; WEAK ones (weight 1) are common PT/ES function words
// that English only uses by accident ("de", "por"). Deliberately absent: "no", "o", "a", "as", "do",
// "usa", "los"… — they appear in ordinary English ("Do the export", "USA offices", "Las Vegas").
const W = (words) => new RegExp("(?<![\\p{L}.])(" + words + ")(?![\\p{L}])", "giu");
// Brazilian Portuguese (1.14 D1) counts as Portuguese: você / usuário / arquivo / cadastro / senha are PT-only words
// ("usuario" without the accent and "archivo" are Spanish); "tela" (screen — ES: fabric) and "equipe" are weak. The guess
// is still 'pt' — only an explicit lang: "pt-BR" makes the classifier answer in Brazilian Portuguese.
const PT_STRONG = W("n[ãa]o|uma|umas|pelo|pela|pelos|também|tambem|você|voce|vocês|isso|isto|então|entao|ainda|quando|onde|deve|devem|utilizador|utilizadores|usuário|usuários|arquivo|arquivos|cadastro|cadastrar|senha|senhas|sem");
const PT_STRONG_CHARS = /ç[ãa]o|ções|[ãõç]/giu;
const PT_WEAK = W("com|um|por|para|de|da|dos|das|que|na|tela|telas|equipe");
const ES_STRONG = W("una|unos|pero|también|tambien|usted|esto|eso|entonces|todavía|cuando|donde|debe|deben|usuario|usuarios|sin|sólo");
const ES_STRONG_CHARS = /ción|ciones|ñ/giu;
const ES_WEAK = W("con|un|por|para|de|del|el|la|las|que|en|solo");
const EN_WORDS = W("the|and|with|for|of|is|are|to|an|in|on|by|from|that|this|it|should|must|when|without");
// 1.17 D review: a PT / ES INFINITIVE opening a clause — the form a PT / ES requirement line starts with ("Publicar eventos no
// Kafka.", "Gravar o pedido no Postgres e …"): a short line with no other marker read as English, and "no" (PT em + o) as a
// negator. Only at a clause start (the text's start, after . ! ? ; : or a line break, or a list bullet) and followed by its
// object (a word on the same line — a UI label list "Guardar, Enviar, Cancelar" or "Enviar. Pagar." is no clause), a STRONG
// marker (2) — and only in a text with no English function word (1.17 verification N1: "Spanish labels: …" is English).
// PT_INF / ES_INF hold verbs that exist in ONE language only; a verb both languages have (alterar, excluir, mudar, apagar,
// agregar, cambiar…) is in PTES_INF and counts for both — it tells PT / ES from English, never PT from ES (a tie is PT, or the
// project's language when that is ES). None is an English word ("remover", "registrar", "leer" are left out: an English noun /
// verb). CLAUSE_START is linear: the spaces after a start never cross a line break (`\s*` there re-read a whole run of blank
// lines from each of its line breaks — quadratic; 1.17 verification N2).
const CLAUSE_START = "(?:^|[.!?;:\\n]|[-*+•]\\s)[^\\S\\n]*";
const INF_WORDS = {
  pt: "atualizar|gerar|escrever|armazenar|receber|manter|processar|reprocessar|obter|corrigir|melhorar|exibir|carregar|descarregar|baixar",
  es: "crear|escribir|actualizar|añadir|generar|almacenar|recibir|mantener|procesar|reprocesar|sustituir|obtener|comprobar|corregir|mejorar|cargar|descargar|reintentar",
  both: "publicar|enviar|guardar|consumir|notificar|validar|eliminar|mostrar|permitir|implementar|integrar|calcular|sincronizar|exportar|importar|listar|editar|bloquear|usar|pagar|cobrar|evitar|configurar|definir|verificar|migrar|filtrar|ordenar|buscar|" +
    "criar|gravar|adicionar|apagar|substituir|excluir|alterar|mudar|testar|agregar|borrar|cambiar",
};
const INF = (words) => new RegExp(CLAUSE_START + "(" + words + ")(?=[^\\S\\n]+[\\p{L}\\p{N}\"'`“«(])", "giu");
const PT_INF = INF(INF_WORDS.pt);
const ES_INF = INF(INF_WORDS.es);
const PTES_INF = INF(INF_WORDS.both);
// "no" + an infinitive is Spanish ("no usar LLM", "No enviar correos"): Portuguese negates with "não" (and its "no" = em + o
// never precedes an infinitive). A STRONG ES marker (1.17 verification N1: "Adicionar productos al carrito, no usar LLM." read PT).
const ES_NO_INF = new RegExp("(?<![\\p{L}\\p{N}_])no[^\\S\\n]+(" + INF_WORDS.es + "|" + INF_WORDS.both + ")(?![\\p{L}\\p{N}_])", "giu");
// fallback (full review Pb2 — an imported source): the project's language, used when the text shows no language of its own
// (no PT/ES marker to speak of and fewer than two English function words) — and its variant (pt-BR) when the text is in
// its family. Without it the answer is the plain guess ('en' when nothing says otherwise).
function guessLang(text, fallback) {
  const distinct = (re) => new Set((text.match(re) || []).map((m) => m.toLowerCase())).size;
  const distinctInf = (re) => new Set(Array.from(text.matchAll(re), (m) => m[1].toLowerCase())).size;
  const en = distinct(EN_WORDS);
  // clause-start infinitives only in a text without English function words (1.17 verification N1)
  const inf = (re) => (en ? 0 : distinctInf(re));
  const shared = inf(PTES_INF);
  const pt = 2 * (distinct(PT_STRONG) + distinct(PT_STRONG_CHARS) + inf(PT_INF) + shared) + distinct(PT_WEAK);
  const es = 2 * (distinct(ES_STRONG) + distinct(ES_STRONG_CHARS) + inf(ES_INF) + shared + distinctInf(ES_NO_INF)) + distinct(ES_WEAK);
  const best = Math.max(pt, es);
  const f = fallback ? normalizeLang(fallback) : null;
  // a PT / ES tie (a shared verb, "de", "para"…) is PT — unless the project's language is Spanish
  const tieEs = pt === es && f !== null && i18n.baseLang(f) === "es";
  const g = best < 2 || best <= en ? "en" : pt > es || (pt === es && !tieEs) ? "pt" : "es";
  if (!f) return g;
  if (i18n.baseLang(f) === g) return f;
  return g === "en" && best < 2 && en < 2 ? f : g;
}
// The language the classifier reads a NEW feature's summary in (full review Pb2): the explicit one, else the project's
// configured language (roadmap.json meta.lang, set by spec_init) — the language the feature is written in. Never the 'en'
// fallback: a project without meta.lang keeps the guess. ("Corrigir o cálculo do IVA no checkout" in a PT project read
// 'no' as a negator — the guess said 'en' — and kept +tdd off.)
function configuredLang(projectDir, lang) {
  if (lang) return lang;
  const l = (readRoadmap(projectDir).meta || {}).lang;
  // 1.16 C2: a brand-new project without meta.lang reads it in the user's DEFAULT_LANG option, the language it is about to get.
  return typeof l === "string" && l.trim() ? normalizeLang(l) : projectDir ? newProjectLang(projectDir) : undefined;
}

function isNegated(text, idx, kwLen, lang, cased) {
  // Negator token in the 1-2 words immediately before the match.
  const before = text.slice(Math.max(0, idx - 20), idx).toLowerCase();
  const tokens = before.split(/[^a-zà-ú-]+/).filter(Boolean);
  const pt = i18n.baseLang(lang) === "pt"; // pt and pt-BR alike: "no" is em+o, never a negator
  const negators = pt ? NEGATORS.filter((w) => w !== "no") : NEGATORS;
  // "aplicado no checkout" / "guardado na sessão": after a participle, "no"/"na" is PT em+o, even in a
  // phrase too short for guessLang to see Portuguese.
  const prev = tokens[tokens.length - 2] || "";
  const prevCased = ((cased || "").slice(Math.max(0, idx - 20), idx).split(/[^\p{L}-]+/u).filter(Boolean).slice(-2)[0]) || "";
  const contraction = tokens[tokens.length - 1] === "no" && /(?:ad|id)[oa]s?$/.test(prev) &&
    (pt || (prev.length >= 6 && prevCased === prevCased.toLowerCase()));
  if (!contraction && tokens.slice(-2).some((w) => negators.includes(w))) return true;
  // "sem uso de IA", "sin uso de IA", "no use of AI", "without the use of any AI": a negator a few filler words
  // back still negates — weak signals included (a lone 'ia' used to come back as "Possible +ai").
  const wide = text.slice(Math.max(0, idx - 40), idx).toLowerCase().split(/[^a-zà-ú-]+/).filter(Boolean);
  let k = wide.length - 1;
  while (k >= 0 && NEG_FILLER.has(wide[k])) k--;
  // Across fillers, "no" negates only before an ENGLISH filler ("no use of AI"): before a PT one it is the
  // contraction em+o — "Guia no uso do LLM" is a guide IN the use of the LLM, even when guessLang says 'en'.
  const noContraction = wide[k] === "no" && !NEG_FILLER_EN.has(wide[k + 1]);
  if (k < wide.length - 1 && k >= 0 && negators.includes(wide[k]) && !noContraction) return true; // only across at least one filler word
  // "<keyword> ... not needed/required" shortly after.
  const after = text.slice(idx + (kwLen || 0), idx + (kwLen || 0) + 30).toLowerCase();
  return NEG_AFTER.test(after);
}

// Signals are matched as WORDS, never as bare substrings. A plain `indexOf` fired 'claude' inside
// '.claude-plugin', 'rag' inside 'storage', 'sla' inside 'translate' and 'auth' inside 'author' —
// and a phantom STRONG signal auto-enables a track, which in turn hides the negation the classifier
// computed for that same track. Never reintroduce `indexOf` here.

// Keywords deliberately written as STEMS: any letters may follow ('idempoten' → idempotent /
// idempotency / idempotência, 'hallucinat' → hallucinations, 'summariz' → summarization).
const STEMS = new Set(["idempoten", "hallucinat", "summariz", "alucina",
  // +sec / +privacy: vulnerability / vulnerabilities / vulnerabilidade(s) / vulnerabilidad(es); sanitize / sanitização;
  // anonymize / anonymisation / anonimização / anonimización; data minimization / minimisation.
  "vulnerabili", "sanitiz", "anonymiz", "anonymis", "pseudonymiz", "pseudonymis", "data minimi", "anonimiza", "pseudonimiza", "seudonimiza",
  // +dist (1.17 D): deduplicate / deduplication / deduplicação / deduplicación; desduplicação
  "deduplica", "desduplica"]);
// VERB stems (full review Pb5): the stem + one of the listed endings, nothing else — 'cifr' is cifrar / cifrado / cifram…,
// never "cifra" (a figure); 'encript' never "encriptação" (a keyword of its own). The stem is the keyword (its literal and
// its name in notes), so a verb and its noun (encriptar / encriptação) are one signal, as encrypt / encryption are.
// VERB_STEMS and IRREGULAR_FORMS apply to the BUILT-IN signals only (1.17 D review): a track pack's keyword is always a literal
// word + the ordinary inflections — a pack keyword "public" matches "public", never only "publicar" (keywordRe(kw, true)).
const VERB_STEMS = new Map([
  ["encript", "(?:ar|a|am|an|amos|ando|ado|ada|ados|adas|ou|aram|em|en)"],
  ["cifr", "(?:ar|am|an|amos|ando|ado|ada|ados|adas|ou|aram|em|en)"],
  ["criptograf", "(?:ar|a|am|amos|ando|ado|ada|ados|adas|ou|aram|em)"],
  // +dist (1.17 D): publicar (PT / ES) — only inside the gap phrases "public … evento" / "… mensagem" / "… mensaje"; a bare
  // English "public" (a public API) never matches it: an ending is required.
  ["public", "(?:ar|a|as|am|an|amos|ando|ado|ada|ados|adas|ou|aram|ó|aron|ará|arão|arán)"],
  // enviar (PT / ES — 1.17 D review): only inside "envi … mensagem" / "envi … mensaje" ("environment" has no listed ending)
  ["envi", "(?:ar|a|as|am|an|amos|ando|ado|ada|ados|adas|ou|aram|ó|aron|ará|arão|arán)"],
]);
// Irregular inflections (1.17 D): a keyword whose forms the suffix rules can't produce — retry → retries / retried. The key is
// the keyword (its name in notes); the value its literal prefix and the alternation of endings. One concept, one signal:
// "retry … retries" is a single +dist hint, not the two weak ones that would turn the track on.
const IRREGULAR_FORMS = new Map([
  ["retry", ["retr", "(?:y|ies|ied|ying)"]],
  ["reintento", ["reintent", "(?:o|os|ar|a|an|ado|ada|ando)"]], // ES reintento(s) / reintentar / reintenta…
  ["duplicate delivery", ["duplicate deliver", "(?:y|ies)"]], // (1.17 D review)
  ["mensagem", ["mensage", "(?:m|ns)"]], // PT mensagem → mensagens (a part of "public … mensagem" / "envi … mensagem")
  // An EXACT form (no inflection at all — 1.17 D review): "2PC", never "2PCS" (a product listing's "2 pieces"). Upper case: matched
  // case-sensitively like every keyword written with capitals.
  ["2PC", ["2PC", ""]],
  // +api (1.19 T): the noun only — "requests", never "requested" ("the user requested a refund" is no HTTP request)
  ["request", ["request", "(?:s)?"]],
  // +ui (1.19 T): the nouns only — "screening", "formed", "paged the on-call" are no UI
  ["screen", ["screen", "(?:s)?"]], ["page", ["page", "(?:s)?"]], ["form", ["form", "(?:s)?"]],
]);
// A GAP keyword (built-in signals only — a track pack's keywords can't hold "…", RE_PACK_KEYWORD): its words with up to three
// words between them, none crossing sentence punctuation — "publish … event" is "publishes a UserCreated event", "publish
// events", "publicou o evento". Each part is matched as a keyword of its own (inflections, stems, verb stems).
const KW_GAP = " … ";
const KW_GAP_RE = "(?:\\s+[^\\s.!?;:,]+){0,3}?\\s+";
// Inflections accepted on an exact keyword: payment→payments, cache→cached, rate-limit→rate-limiting.
const INFLECTION = "(?:e?s|ed|ing|d)?";
// Short acronyms ('rag', 'sla', 'slo', 'gpt', 'llm', 'ai') pluralize but never conjugate — without
// this, 'rag' + 'ing' would make "raging" a strong +ai signal.
const ACRONYM_INFLECTION = "s?";
// Hyphen compounds that keep the head word a real signal ('AI-powered', 'LLM-based') rather than
// turning it into an identifier ('claude-plugin'). C4: compliance / certification / grade compounds too — "GDPR-compliant",
// "HIPAA-compliant", "PCI-compliance", "SOC2-certified", "enterprise-grade" name the keyword's concept ('-compliant' used to
// be a rejected '-<letter>' compound: "A GDPR-compliant signup form" classified as core only). Not '-aware': "session-aware
// routing" (sticky sessions) would read as an auth session.
const ADJ_SUFFIX = "(?:-(?:based|powered|driven|generated|assisted|enabled|native|ready|first|compliant|compliance|certified|grade))?";

const KW_RE = new Map();
// PT/ES plurals the English inflections can't produce: migração→migrações, sessão→sessões,
// suscripción→suscripciones. A multi-word keyword also pluralizes its FIRST word ("limites de taxa").
function pluralize(body, kw) {
  if (/ç[ãa]o$/.test(kw)) return body.replace(/ç[ãa]o$/, "(?:ção|cão|ções|çoes|coes)");
  if (/cao$/.test(kw)) return body.replace(/cao$/, "(?:cao|coes|ções)");
  if (/[ãa]o$/.test(kw) && /ss[ãa]o$|s[ãa]o$/.test(kw)) return body.replace(/[ãa]o$/, "(?:ão|ao|ões|oes)");
  if (/i[óo]n$/.test(kw)) return body.replace(/i[óo]n$/, "(?:ión|ion|iones)");
  if (/ (de|do|da|del|de la) /.test(kw) || /[^\x00-\x7f]/.test(kw)) return body.replace(/^([\p{L}]+)/u, "$1(?:e?s)?");
  return body;
}

// The part of a keyword its regex (keywordRe) always matches verbatim: pluralize() only rewrites the last 3 characters
// (-ção / -ão / -ión) or inserts a plural right after the FIRST word — so the leading characters up to both are literal.
// A keyword pluralize() leaves alone is matched verbatim WHOLE (only an inflection is appended): the whole keyword is the
// literal — "data retention" no longer compiles a regex for every text that merely says "data".
const KW_LITERAL = new Map();
const KW_CACHE_MAX = 5000; // the built-in signals (~700) + every track pack's (≤ 150 each)
// plain (1.17 D review): a track pack's keyword — a literal word (no gap, no verb stem, no irregular forms); cached apart from a
// built-in keyword of the same spelling.
const KW_PLAIN = "\u0001";
function keywordLiteral(kw, plain) {
  const key = plain ? KW_PLAIN + kw : kw;
  let lit = KW_LITERAL.get(key);
  if (lit != null) return lit;
  if (KW_LITERAL.size >= KW_CACHE_MAX) KW_LITERAL.clear();
  // a gap keyword: its first part's literal · an irregular one: its stem (1.17 D)
  if (!plain && kw.includes(KW_GAP)) { lit = keywordLiteral(kw.slice(0, kw.indexOf(KW_GAP))); KW_LITERAL.set(key, lit); return lit; }
  if (!plain && IRREGULAR_FORMS.has(kw)) { lit = IRREGULAR_FORMS.get(kw)[0]; KW_LITERAL.set(key, lit); return lit; }
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const first = (kw.match(/^[\p{L}\p{N}]+/u) || [""])[0];
  const n = pluralize(escaped, kw) === escaped ? kw.length : Math.min(first.length || kw.length, kw.length > 3 ? kw.length - 3 : kw.length);
  lit = kw.slice(0, Math.max(1, n));
  KW_LITERAL.set(key, lit);
  return lit;
}

function keywordRe(kw, plain) {
  const key = plain ? KW_PLAIN + kw : kw;
  let re = KW_RE.get(key);
  if (re) return re;
  if (KW_RE.size >= KW_CACHE_MAX) KW_RE.clear(); // track packs (1.15) add keywords: a long-lived server's cache stays bounded
  // A gap keyword's parts, each its own keyword pattern, joined by at most three words (KW_GAP_RE: whitespace and non-whitespace
  // runs alternate — linear); the edge guards below wrap the whole phrase.
  const bodyTail = plain ? keywordPattern(kw, true) : kw.includes(KW_GAP) ? kw.split(KW_GAP).map((p) => keywordPattern(p)).join(KW_GAP_RE) : keywordPattern(kw);
  // Left edge: not glued to a word char, and not part of a dotted/slashed/hyphenated identifier
  // ('.claude-plugin', 'src/rag.ts'). Right edge: after the optional inflection/adjective, no word
  // char and no '-<letter>' compound ('claude-plugin') — but '-<digit>' stays legal ('gpt-4').
  re = new RegExp(
    "(?<![\\p{L}\\p{N}_\\-./\\\\])" + bodyTail + "(?![\\p{L}\\p{N}_])(?![-./\\\\][\\p{L}])",
    "gu"
  );
  KW_RE.set(key, re);
  return re;
}
// One keyword (or one part of a gap keyword) → its pattern: the escaped text (pluralized) + its tail — a stem's letters, a verb
// stem's endings, an irregular keyword's forms, else the inflections (+ an adjective compound). plain: a track pack's keyword —
// never a verb stem's or an irregular keyword's forms (STEMS stay as in 1.16).
function keywordPattern(kw, plain) {
  if (!plain && IRREGULAR_FORMS.has(kw)) { const [stem, ends] = IRREGULAR_FORMS.get(kw); return stem + ends; }
  const body = pluralize(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), kw);
  return body + (STEMS.has(kw) ? "\\p{L}*" : !plain && VERB_STEMS.has(kw) ? VERB_STEMS.get(kw) : (kw.length <= 3 ? ACRONYM_INFLECTION : INFLECTION) + ADJ_SUFFIX);
}

// Tokens that look like source paths ("src/rag", "lib/auth.ts") must stay opaque to the classifier.
const PATH_HEADS = new Set(["src", "lib", "app", "apps", "api", "pkg", "packages", "internal", "cmd", "bin", "test", "tests", "docs",
  "components", "modules", "services", "server", "client", "scripts", "config", "routes", "handlers", "controllers", "features",
  "web", "frontend", "backend", "pages", "views", "middleware", "utils", "util", "core", "shared", "models", "public", "static",
  "assets", "infra", "deploy", "db", "migrations", "templates", "hooks", "plugins", "store", "stores", "types", "schemas", "jobs",
  "workers", "domain", "adapters", "providers", "resources", "spec", "specs", "e2e", "fixtures"]);
// "login/signup", "payments/refunds", "RAG/embeddings" are prose pairs, not paths: split them so each
// word is matched. A token keeps its slash when it has a dot, a backslash, more than one slash, or a
// directory-like head.
function splitWordPairs(s) {
  return s.split(/(\s+)/).map((tok) => {
    const m = tok.match(/^([(\["']*)([\p{L}\p{N}-]{2,})\/([\p{L}\p{N}-]{2,})([)\]"',;:!?]*)$/u);
    if (!m || PATH_HEADS.has(m[2].toLowerCase())) return tok;
    return m[1] + m[2] + " / " + m[3] + m[4];
  }).join("");
}

function classify(description, opts = {}) {
  // opts.projectDir: that project's track packs (1.15) are classified too — their signals beside the built-in ones.
  if (opts.projectDir) specsRoot(opts.projectDir);
  const OPT = optionalTracks();
  // An optional feature name is part of the evidence ("LLM chatbot billing" says a lot).
  const raw = [opts.name, description].filter((s) => s != null && String(s).trim()).map(String).join(". ");
  const cased = " " + splitWordPairs(raw) + " ";
  const text = cased.toLowerCase();
  // No explicit lang: the text's own language, the project's configured one (opts.projectDir → meta.lang) only as the fallback
  // when the text is inconclusive — the same rule for spec_classify, create and import (full review R4).
  const lang = opts.lang ? normalizeLang(opts.lang) : guessLang(text, opts.fallbackLang || (opts.projectDir ? configuredLang(opts.projectDir) : undefined));
  const C = i18n.msg(lang).classify;
  // Accented/unaccented twins ("sessão"/"sessao") match the same word: one span counts once per track.
  const perTrack = (mk) => Object.fromEntries(OPT.map((t) => [t, mk()]));
  const seenSpan = perTrack(() => new Set());
  const active = new Set(["core"]);
  const matched = perTrack(() => ({ strong: [], weak: [], generic: [] }));
  const negated = perTrack(() => []);
  const hits = []; // every counted match, in scan order: { track, tier, kw, start, end, neg }

  for (const track of OPT) {
    const table = trackSignalTable(track);
    const plain = !Object.prototype.hasOwnProperty.call(SIGNALS, track); // a track pack's keywords are literal words (1.17 D review)
    const hazards = Object.prototype.hasOwnProperty.call(SIGNAL_HAZARDS, track) ? SIGNAL_HAZARDS[track] : null; // (never negated)
    // (tier `generic` — 1.17 D review — exists in the built-in +dist table only; see SIGNALS.dist)
    for (const tier of ["strong", "weak", "generic", "context"]) {
      for (const kw of table[tier] || []) {
        // A keyword written with upper-case letters ('STRIDE') is an acronym matched CASE-SENSITIVELY, on the original
        // text (C4): the lower-case word is something else (an array stride). `cased` is `text` before toLowerCase().
        const hay = kw === kw.toLowerCase() ? text : cased;
        // A text without the keyword's literal prefix can't match its regex — skipping it spares compiling ~300 unicode
        // regexes on every CLI run (a classify used to cost ~250 ms per process).
        if (!hay.includes(keywordLiteral(kw, plain))) continue;
        const re = keywordRe(kw, plain);
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(hay)) !== null) {
          if (seenSpan[track].has(m.index)) continue;
          seenSpan[track].add(m.index);
          hits.push({ track, tier, kw, start: m.index, end: m.index + m[0].length, neg: !(hazards && hazards.has(kw)) && isNegated(text, m.index, m[0].length, lang, cased) });
        }
      }
    }
  }
  // A WEAK signal inside a longer STRONG signal (of another track — and, 1.17 D review, of its own) is part of that phrase, not evidence of its own:
  // 'model' in "threat model" / "modelo de ameaças" (+sec) is no +ai hint, 'security' in "row-level security" (+saas)
  // no +sec one. The same word in two tracks ('authentication': +tdd strong, +sec weak) is not shadowed — equal spans.
  // 1.17 D review: inside a longer strong phrase of its OWN track it is part of that phrase too — "mensagens" in "fila de
  // mensagens", "outbox" in "transactional outbox", "worker" in "Celery worker" (the name-based de-dupe below misses a plural).
  // Linear (1.17 D review — every hit was compared with every hit: 100 KB of "queue …" took 9.6 s): the strong hits sorted by
  // start; a sweep keeps the furthest end of the strong hits starting BEFORE the hit (one reaching its end contains it
  // strictly) and looks up the strong hits starting AT it (only a longer one shadows).
  const strongHits = hits.filter((h) => h.tier === "strong").sort((a, b) => a.start - b.start);
  const startsAt = new Map();
  for (const s of strongHits) { const l = startsAt.get(s.start); if (l) l.push(s); else startsAt.set(s.start, [s]); }
  let reach = -1; // the furthest end of the strong hits started before the current hit
  const shadowedHits = new Set();
  let si = 0;
  for (const h of hits.filter((x) => x.tier !== "strong").sort((a, b) => a.start - b.start)) {
    for (; si < strongHits.length && strongHits[si].start < h.start; si++) if (strongHits[si].end > reach) reach = strongHits[si].end;
    if (reach >= h.end || (startsAt.get(h.start) || []).some((s) => s.end > h.end)) shadowedHits.add(h);
  }
  // CORROBORATING-only signals (tier `context`, C4 — 'permission' for +sec) are weak evidence only beside another
  // (non-negated) signal of their track ("RBAC permissions"); a negated one is noted only when the track has some other
  // signal. Alone they are no evidence at all: no signal, no "possible" note, no "kept off" note ("file permission bits").
  // A GENERIC word (1.17 D review) backs no context word: "retry the card transaction" is no +dist evidence.
  const counted = hits.filter((h) => !shadowedHits.has(h));
  const own = (pred) => new Set(counted.filter((h) => h.tier !== "context" && pred(h)).map((h) => h.track));
  const backedBy = own((h) => !h.neg && h.tier !== "generic"), mentionedBy = own(() => true);
  for (const h of counted) {
    if (h.tier === "context" && !(h.neg ? mentionedBy : backedBy).has(h.track)) continue;
    const tier = h.tier === "context" ? "weak" : h.tier;
    if (h.neg) { if (!negated[h.track].includes(h.kw)) negated[h.track].push(h.kw); }
    else if (!matched[h.track][tier].includes(h.kw)) matched[h.track][tier].push(h.kw);
  }

  // De-dupe by containment: a keyword that is a substring of another matched keyword in the same
  // track (e.g. "agent" ⊂ "agente", "model" ⊂ "modelo", "tokens" ⊂ "custo de tokens") is ONE
  // concept, not two signals — otherwise a single PT/ES word would auto-enable a track. The
  // containment must sit at a word edge, or a short keyword vanishes inside an unrelated one
  // ("ai" ⊂ "guardr-ai-l").
  for (const t of OPT) {
    const all = [...matched[t].strong, ...matched[t].weak, ...matched[t].generic];
    const keep = (arr) => arr.filter((k) => !all.some((m) => m !== k && (m.startsWith(k) || m.endsWith(k))));
    matched[t].strong = keep(matched[t].strong);
    matched[t].weak = keep(matched[t].weak);
    matched[t].generic = keep(matched[t].generic);
    // One concept, one signal (1.17 D review — SIGNAL_CONCEPTS): the first keyword of a concept stays, an anchor (weak) before a
    // generic one — "retry … with exponential backoff" is one anchor, "producers … consumers" one generic hint.
    const cm = Object.prototype.hasOwnProperty.call(SIGNAL_CONCEPTS, t) ? SIGNAL_CONCEPTS[t] : null;
    if (cm) {
      const seen = new Set();
      const once = (arr) => arr.filter((k) => { const c = cm.get(k); if (c == null) return true; if (seen.has(c)) return false; seen.add(c); return true; });
      matched[t].weak = once(matched[t].weak);
      matched[t].generic = once(matched[t].generic);
    }
    // The same for the negated ones (1.17 D): "no distributed transactions" is ONE negated concept, not also a negated
    // corroborating 'transaction' (+dist's context word inside it).
    const neg = negated[t];
    negated[t] = neg.filter((k) => !neg.some((m) => m !== k && (m.startsWith(k) || m.endsWith(k))));
  }

  // Weighting: score = strong*2 + weak (+ generic). A track turns ON at score >= 2 (one strong signal,
  // or two weak ones). A lone weak signal (score 1) is surfaced as "possible" but not enabled.
  // GENERIC signals (1.17 D review) add to the score but never turn a track on by themselves: at least one strong or weak (anchor)
  // signal must be there — "a print queue … retry failed prints" stays 'possible'.
  const signals = {};
  const confidence = {};
  const weak = [];
  const possible = [];
  for (const t of OPT) {
    signals[t] = [...matched[t].strong, ...matched[t].weak, ...matched[t].generic];
    const s = matched[t].strong.length;
    const w = matched[t].weak.length;
    const g = matched[t].generic.length;
    const score = s * 2 + w + g;
    if (score >= 2 && s + w > 0) {
      active.add(t);
      confidence[t] = score >= 4 ? "high" : "medium";
      if (s === 0) weak.push(t); // on, but from weak signals only
    } else if (score >= 1) {
      confidence[t] = "none";
      possible.push(Object.assign({ track: t, signal: matched[t].weak[0] || matched[t].generic[0] }, g >= 2 ? { generic: matched[t].generic.slice() } : {}));
    } else {
      confidence[t] = "none";
    }
  }

  const wordCount = raw.trim().split(/\s+/).filter(Boolean).length;
  const notes = [];
  if (active.size === 1 && !possible.length && wordCount > 25) {
    notes.push(C.substantial);
  }
  if (weak.length) {
    notes.push(C.weakOnly(weak.map((t) => "+" + t).join(", ")));
  }
  for (const p of possible) {
    // (1.17 D review) two or more app-level words and no anchor: named as such
    notes.push(p.generic ? C.genericOnly(p.track, p.generic.map((k) => `'${k.trim()}'`).join(", ")) : C.possible(p.track, p.signal.trim()));
  }
  // A negation is never silently dropped. It cannot *veto* a track — "the system shall not
  // hallucinate" negates 'hallucinat' on a feature that is unmistakably +ai — so when the track is
  // on anyway, surface the contradiction for the human who confirms Phase 0.
  for (const t of OPT) {
    if (!negated[t].length) continue;
    const quoted = negated[t].map((k) => `'${k.trim()}'`).join(", ");
    if (!active.has(t)) {
      notes.push(C.keptOff(t, negated[t][0].trim()));
    } else {
      notes.push(C.onAlthough(t, quoted, signals[t].join(", ")));
    }
  }

  const tracks = allTracks().filter((t) => active.has(t));
  return {
    tracks,
    label: trackLabel(tracks),
    signals,
    negated,
    confidence,
    weak,
    possible,
    note: notes.length ? notes.join(" ") : null,
    notes,
    mode: opts.mode || "spec",
    lang, // the language notes/reasoning were written in (explicit, or guessed from the text)
    reasoning: buildReasoning(tracks, signals, confidence, negated, C, OPT),
  };
}

function buildReasoning(tracks, signals, confidence, negated, C, optional) {
  C = C || i18n.msg("en").classify;
  const lines = [C.core];
  for (const t of optional || OPTIONAL_TRACKS) {
    const neg = negated && negated[t] && negated[t].length ? negated[t].map((k) => `'${k.trim()}'`).join(", ") : null;
    if (tracks.includes(t)) {
      const uniq = [...new Set(signals[t])].slice(0, 6);
      const conf = confidence ? C.conf[confidence[t]] || confidence[t] : "";
      lines.push(C.on(t, conf, uniq.join(", "), neg));
    } else {
      lines.push(C.off(t, neg));
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Project-defined tracks (1.15) — track packs in .specs/tracks/<name>/
// ---------------------------------------------------------------------------
// Six tracks are built in; a project adds its own domain rigor (+a11y, +mobile, +dbmigration…) as a folder:
// .specs/tracks/<name>/track.json (JSON — `//` and `/* */` comments allowed) + optional markdown fragments: requirements.md
// (criteria), tasks.md (task lines), test-plan.md (rows), checklist.md (items), steering.md (the steering stub); a <lang>/
// subfolder's fragment wins over the pack root's (pt-BR → pt → root, as the project templates). A VALID pack is a MARKER track
// like [SaaS] / [SEC]: every registry reader goes through allTracks / optionalTracks / markerTracks / trackMarker /
// trackSectionTable / trackSteeringFiles / trackSignalTable, which add the packs of the project the current engine call works in
// (TEMPLATE_SCOPE_ROOT, set by specsRoot()) to the built-in tables — loaded lazily, memoized per call (PACK_MEMO), dropped when the
// engine writes under .specs/tracks/ (forgetCached). A pack is DATA only: nothing in it runs, its keywords reach the classifier
// through keywordRe (escaped: a literal, linear), its name and marker are validated to a closed alphabet before any regex sees
// them, and only allowlisted file names are read from its own folder (lstat + realpath: a link out of .specs/ is ignored). A bad
// pack is reported (spec_tracks check, doctor's track-pack-missing) and IGNORED as a whole — never half-applied.
const TRACK_PACKS_DIR = "tracks";
const PACK_JSON = "track.json";
const PACK_FRAGMENTS = Object.freeze(["requirements.md", "tasks.md", "test-plan.md", "checklist.md", "steering.md"]);
const PACK_LIMITS = Object.freeze({ packs: 20, jsonBytes: 32 * 1024, fragmentBytes: 32 * 1024, sections: 20, syn: 20, keywords: 50,
  keywordLen: 60, textLen: 80, descriptionLen: 300, guidanceLen: 600, items: 20 });
const RE_PACK_NAME = /^[a-z][a-z0-9]{1,19}$/;
const RE_PACK_MARKER = /^[A-Z][A-Z0-9]{1,11}$/;
// Bracket words the engine already reads — the built-in markers, the story / parallel tags ([US1] [P1] [shared]), the generic
// slots ([TODO] [TBD] [FIXME]…) and ID prefixes — are never a pack marker.
const RE_PACK_MARKER_RESERVED = /^(?:SAAS|AI|SEC|PRIVACY|DIST|API|UI|OBS|TDD|CORE|SHARED|US\d*|P\d|TODO|TBD|TBC|FIXME|NEEDS|NOTE|WIP|AC\d*|SC\d*|EC\d*|NFR\d*|T\d+)$/;
// A classifier keyword: letters / digits with inner spaces, hyphens, apostrophes and dots, 2–60 characters (a bounded class — linear).
const RE_PACK_KEYWORD = /^[\p{L}\p{N}][\p{L}\p{N}' .’-]{0,58}[\p{L}\p{N}]$/u;
const PACK_KEYS = new Set(["name", "marker", "title", "description", "signals", "sections", "steering", "$schema"]);
const PACK_SECTION_KEYS = new Set(["name", "syn", "loose", "guidance"]);
const PACK_TIERS = ["strong", "weak", "context"];
// Names a pack can't take: the built-in tracks, the words people type for them (suggestTrack's aliases), the tool's own words,
// Windows device names (the name IS a folder) and Object.prototype keys.
const PACK_RESERVED_WORDS = new Set(["none", "all", "any", "track", "tracks", "pack", "packs", "list", "init", "check"]);
function packReservedName(n) {
  return VALID_TRACKS.includes(n) || Object.prototype.hasOwnProperty.call(TRACK_ALIASES, n) || PACK_RESERVED_WORDS.has(n) || RE_WIN_RESERVED.test(n) || PROTO_KEYS.has(n);
}
const RE_PACK_ITEM = /^ ?(?:[-*+]|\d{1,3}[.)])[ \t]+(?=\S)/; // a top-level list item's lead (linear: one anchored start)
const RE_TABLE_SEPARATOR = /^\|[\s:|-]+\|?$/;

// A one-line display text (a title, a section name or synonym): 2–max characters, no control character, no bracket, angle bracket
// or backtick — it lands in a markdown heading, where a [bracket] would read as a slot and "<!--" would open a comment.
function packTextOk(s, max) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return t.length >= 2 && t.length <= max && !/[\u0000-\u001f\u007f[\]<>`]/.test(t);
}
// A section's guidance (the line under its > **TODO**): one line, no comment delimiters, never a heading or a fence.
function packGuidanceOk(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return t.length >= 1 && t.length <= PACK_LIMITS.guidanceLen && !/[\u0000-\u001f\u007f]/.test(t) && !/<!--|-->/.test(t) && !/^(?:#|```|~~~)/.test(t);
}
// JSON with `//` line and `/* */` block comments (the commented example `init` writes) → the JSON text with every comment blanked
// (line breaks kept, so JSON.parse positions still point at the right line), or null for a block comment that never closes. One
// linear pass; a "//" inside a string is text.
function stripJsonComments(text) {
  let out = "", i = 0, from = 0, inStr = false;
  const n = text.length;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (inStr) {
      if (c === 92) i += 2; // a backslash escapes the next character
      else { if (c === 34) inStr = false; i++; }
      continue;
    }
    if (c === 34) { inStr = true; i++; continue; }
    if (c === 47 && text.charCodeAt(i + 1) === 47) {
      out += text.slice(from, i);
      const j = text.indexOf("\n", i);
      i = from = j === -1 ? n : j;
      continue;
    }
    if (c === 47 && text.charCodeAt(i + 1) === 42) {
      out += text.slice(from, i);
      const end = text.indexOf("*/", i + 2);
      if (end === -1) return null;
      out += text.slice(i, end + 2).replace(/[^\n]/g, " ");
      i = from = end + 2;
      continue;
    }
    i++;
  }
  return out + text.slice(from);
}
// A pack folder's entries as the loader reads them — the pack root and each <lang>/ folder — WITHOUT their content: { items, sig }.
// items: { frel, abs, name, lang, state: "file" (+ size) | "linked" (a link, or a folder where a file belongs) | "unknown" }. Every
// allowlisted file is lstat'ed: a regular file, never a link. Its folder chain is already checked (.specs/tracks/ is no link, the pack
// folder's real path is inside .specs/, a <lang>/ folder is no link), so a regular file's real path stays inside too — no per-file
// realpath (F4 review R9: it was the loader's biggest cost). sig: every entry with size / mtime / ctime / inode — the key of the
// cross-call pack cache (PACK_CACHE): an edit changes it and is picked up by the next call.
function packScan(dir, rel) {
  const items = [], sig = [];
  const visit = (absDir, relDir, langKey) => {
    for (const e of readDirCached(absDir) || []) {
      if (e.name.startsWith(".")) continue;
      const frel = relDir + e.name, abs = path.join(absDir, e.name);
      if (langKey === "" && i18n.LANGS.includes(e.name)) {
        if (e.isSymbolicLink() || !e.isDirectory()) { items.push({ frel, name: e.name, lang: langKey, state: "linked" }); sig.push(frel + "|L"); continue; }
        sig.push(frel + "/");
        visit(abs, frel + "/", e.name);
        continue;
      }
      if (!((langKey === "" && e.name === PACK_JSON) || PACK_FRAGMENTS.includes(e.name))) {
        items.push({ frel: frel + (e.isDirectory() ? "/" : ""), name: e.name, lang: langKey, state: "unknown" });
        sig.push(frel + "|U");
        continue;
      }
      let st = null;
      try { st = fs.lstatSync(abs); } catch { /* vanished meanwhile */ }
      if (!st) continue;
      if (st.isSymbolicLink() || !st.isFile()) { items.push({ frel, name: e.name, lang: langKey, state: "linked" }); sig.push(frel + "|L"); continue; }
      items.push({ frel, abs, name: e.name, lang: langKey, state: "file", size: st.size });
      sig.push(frel + "|" + st.size + "|" + st.mtimeMs + "|" + st.ctimeMs + "|" + st.ino);
    }
  };
  visit(dir, rel, "");
  return { items, sig: sig.join("\n") };
}
// One scanned file's text — at most `max` bytes (the size comes from lstat, before any read), BOM-stripped with LF line ends.
// → { text } | { missing } | { tooBig }.
function readPackItem(it, max) {
  if (it.size > max) return { tooBig: true };
  const raw = readIfExists(it.abs);
  if (raw == null) return { missing: true };
  const t = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return { text: t.replace(/\r\n?/g, "\n") };
}
// The top-level list items of a fragment (`- x`, `* x`, `1. x`, `- [ ] x` — at most one space before the bullet) with their
// continuation lines (indented two spaces or more: `  - _Requirements: {{ac1}}_`) — HTML comments and fenced code set aside.
// → [{ text, sub: [line…], line }] (sub lines left-trimmed).
function packListItems(text) {
  const lines = stripFencedCode(stripHtmlComments(text)).split("\n");
  const items = [];
  let cur = null;
  lines.forEach((l, i) => {
    if (!l.trim()) return; // a blank line: an indented continuation may still follow
    if (cur && /^\s{2}/.test(l)) { cur.sub.push(l.trim()); return; }
    const m = l.match(RE_PACK_ITEM);
    if (m) { cur = { text: l.slice(m[0].length).trim(), sub: [], line: i + 1 }; items.push(cur); return; }
    cur = null;
  });
  return items;
}
// The data rows of a test-plan fragment's tables (each table's header and separator rows set aside) — six cells each, as the
// built-in plan (Test ID | Layer | Kind | Description | Covers | File; the Test ID cell is renumbered). → { rows: [{ cells, line }], bad: [line…] }.
function packTableRows(text) {
  const lines = stripFencedCode(stripHtmlComments(text)).split("\n");
  const rows = [], bad = [];
  let inTable = false;
  lines.forEach((l, i) => {
    const t = l.trim();
    if (!t.startsWith("|")) { inTable = false; return; }
    if (!inTable) {
      inTable = true;
      if (RE_TABLE_SEPARATOR.test((lines[i + 1] || "").trim())) return; // the header row
    }
    if (RE_TABLE_SEPARATOR.test(t)) return;
    const cells = t.slice(1, t.endsWith("|") && t.length > 1 ? -1 : undefined).split("|").map((c) => c.trim());
    if (cells.length !== 6) bad.push(i + 1);
    else rows.push({ cells, line: i + 1 });
  });
  return { rows, bad };
}
// The {{variables}} a fragment may use: {{ac1}}… (the pack's n-th criterion as the feature numbers it), {{acs}} (all of them),
// {{t1}}… / {{tests}} (their planned tests), {{title}}, {{marker}}, and the feature's {{name}} / {{slug}}.
const RE_PACK_VAR = /^(?:ac\d{1,3}|acs|t\d{1,3}|tests|title|marker|name|slug)$/;
// A section's guidance takes the feature / pack values only (it has no criteria of its own).
const RE_PACK_GUIDANCE_VAR = /^(?:title|marker|name|slug)$/;
// A section name / synonym as headingMatches compares it: lower-case, its heading lead stripped (RE_HEADING_LEAD — numbering, an
// emoji, a dash, "Section N"; names hold no bracket, so no marker).
function packSectionKey(lower) {
  let t = lower;
  for (let prev = null; prev !== t;) { prev = t; t = t.replace(RE_HEADING_LEAD, ""); }
  return t.trim();
}
// The core design's own headings (every language, + the tdd block's) as section keys — a pack section named like one only counts
// under its marker (sections are marker-bound); check says so (section-core-name). Static i18n text: built once per process.
let CORE_DESIGN_KEYS = null;
function coreDesignHeadingKeys() {
  if (CORE_DESIGN_KEYS) return CORE_DESIGN_KEYS;
  const set = new Set();
  for (const l of i18n.BASE_LANGS) { // (pt-BR's headings derive from pt's — not rendered a fourth time: toPtBr is costly)
    for (const line of i18n.design({ name: "x", tracks: ["core", "tdd"], label: "core +tdd" }, l).split("\n")) {
      const m = line.match(/^#{2,6}\s+(.*)$/);
      if (m) set.add(packSectionKey(m[1].replace(/[*_`]/g, "").replace(/\s+/g, " ").trim().toLowerCase()));
    }
  }
  return (CORE_DESIGN_KEYS = set);
}
function packVarRefs(text) {
  const out = [];
  for (const m of String(text).matchAll(RE_TEMPLATE_VAR)) out.push(m[1].toLowerCase());
  return out;
}
// One fragment's text → its parsed form, or null (reported through err / warn).
function parsePackFragment(file, text, frel, err, warn) {
  const cap = (list) => { if (list.length > PACK_LIMITS.items) { err(frel, "too-many", { field: file, max: PACK_LIMITS.items }); return null; } return list; };
  for (const v of packVarRefs(text)) if (!RE_PACK_VAR.test(v)) warn(frel, "unknown-variable", { v });
  if (file === "steering.md") {
    if (!text.trim()) { warn(frel, "fragment-empty", { file }); return null; }
    return { text };
  }
  if (file === "test-plan.md") {
    const t = packTableRows(text);
    t.bad.forEach((line) => err(frel, "fragment-row", { file }, line));
    if (t.bad.length || !cap(t.rows)) return null;
    if (!t.rows.length) { warn(frel, "fragment-empty", { file }); return null; }
    return { rows: t.rows, text };
  }
  const items = packListItems(text).map((it) => {
    let t = it.text;
    if (file === "requirements.md") t = t.replace(/^(?:\*\*)?(?:US-\d+\.)?AC-\d+(?:\*\*)?[ \t]*(?:[—–:-][ \t]*)?/, "");
    else t = t.replace(/^\[[ xX]\][ \t]+/, "").replace(/^\d{1,4}[.)][ \t]+/, "");
    return { text: t.trim(), sub: it.sub, line: it.line };
  }).filter((it) => it.text);
  if (!cap(items)) return null;
  if (!items.length) { warn(frel, "fragment-empty", { file }); return null; }
  return { items, text };
}
// A localized value — { en, pt?, es?, "pt-BR"? } or a plain string (its English) — checked with ok(); null when invalid.
function packLocalized(v, field, ok, rule, jrel, err, warn) {
  const val = typeof v === "string" ? { en: v } : v;
  if (!isObj(val) || typeof val.en !== "string") { err(jrel, v == null ? "field-missing" : "field-invalid", { field, rule }); return null; }
  const out = {};
  for (const k of Object.keys(val)) {
    if (!i18n.LANGS.includes(k)) { warn(jrel, "unknown-key", { key: field + "." + k }); continue; }
    if (!ok(val[k])) { err(jrel, "field-invalid", { field: field + (typeof v === "string" ? "" : "." + k), rule }); return null; }
    out[k] = val[k].trim();
  }
  return out;
}

// One pack folder → { entry, pack?, problems } — pack only when it is valid. A folder whose scan (packScan's sig) is unchanged since
// an earlier call is served from PACK_CACHE (F4 review R9: 20 packs × 4 languages cost ~100 ms per call); its real path is checked
// every time.
const PACK_CACHE = new Map(); // readCacheKey(pack dir) → { sig, entry, pack, problems } — across calls, bounded
function loadPack(dir, folder, rel, realSpecs) {
  let realDir = null;
  try { realDir = fs.realpathSync.native(dir); } catch { /* vanished */ }
  if (!realDir || !isInsideDir(realSpecs, realDir)) {
    return { entry: { name: folder, folder: rel, valid: false, marker: null, title: null, errors: 1 }, problems: [{ file: rel, severity: "error", code: "linked-folder", args: {}, pack: folder }] };
  }
  const scan = packScan(dir, rel);
  const ck = readCacheKey(dir);
  const hit = PACK_CACHE.get(ck);
  if (hit && hit.sig === scan.sig) return { entry: { ...hit.entry }, pack: hit.pack, problems: hit.problems };
  const problems = [];
  const r = loadPackScan(scan, folder, rel, (file, severity, code, args, line) =>
    problems.push({ file, severity, code, args: args || {}, ...(line ? { line } : {}), pack: folder }));
  if (r.pack) r.pack.sig = scan.sig;
  if (PACK_CACHE.size >= 64) PACK_CACHE.clear();
  PACK_CACHE.set(ck, { sig: scan.sig, entry: { ...r.entry }, pack: r.pack || null, problems });
  return { entry: r.entry, pack: r.pack, problems };
}
// The validation of one scanned pack (every problem goes through problem()).
function loadPackScan(scan, folder, rel, problem) {
  let errors = 0;
  const err = (file, code, args, line) => { errors++; problem(file, "error", code, args, line); };
  const warn = (file, code, args, line) => problem(file, "warn", code, args, line);
  const entry = { name: folder, folder: rel, valid: false, marker: null, title: null, errors: 0 };
  const done = () => { entry.errors = errors; return { entry }; };
  const jrel = rel + PACK_JSON;
  if (!RE_PACK_NAME.test(folder)) err(rel, "name-invalid", { name: folder });
  else if (packReservedName(folder)) err(rel, "name-reserved", { name: folder });
  const jItem = scan.items.find((x) => x.lang === "" && x.name === PACK_JSON);
  if (!jItem) { err(jrel, "json-missing", {}); return done(); }
  if (jItem.state === "linked") { err(jrel, "fragment-linked", { file: PACK_JSON }); return done(); }
  const jf = readPackItem(jItem, PACK_LIMITS.jsonBytes);
  if (jf.missing) { err(jrel, "json-missing", {}); return done(); }
  if (jf.tooBig) { err(jrel, "too-big", { file: PACK_JSON, max: PACK_LIMITS.jsonBytes }); return done(); }
  const stripped = stripJsonComments(jf.text);
  let j = null;
  try {
    if (stripped == null) throw new Error("a /* comment is never closed");
    j = JSON.parse(stripped);
  } catch (e) { err(jrel, "json-invalid", { detail: String(e && e.message).slice(0, 200) }); return done(); }
  if (!isObj(j)) { err(jrel, "json-invalid", { detail: "not a JSON object" }); return done(); }
  for (const k of Object.keys(j)) if (!PACK_KEYS.has(k)) warn(jrel, "unknown-key", { key: k });

  if (typeof j.name !== "string") err(jrel, "field-missing", { field: "name", rule: "= the folder name" });
  else if (j.name !== folder) err(jrel, "name-mismatch", { name: j.name.slice(0, 80), folder });

  let token = null;
  if (typeof j.marker !== "string") err(jrel, "field-missing", { field: "marker", rule: "^[A-Z][A-Z0-9]{1,11}$" });
  else {
    const t = j.marker.trim();
    const bare = t.length > 2 && t.startsWith("[") && t.endsWith("]") ? t.slice(1, -1) : t;
    if (!RE_PACK_MARKER.test(bare)) err(jrel, "marker-invalid", { marker: j.marker.slice(0, 40) });
    else if (RE_PACK_MARKER_RESERVED.test(bare)) err(jrel, "marker-reserved", { marker: bare });
    else token = bare;
  }

  const textRule = "2–" + PACK_LIMITS.textLen + " characters, one line, no [ ] < > `";
  const title = packLocalized(j.title, "title", (s) => packTextOk(s, PACK_LIMITS.textLen), textRule, jrel, err, warn);
  let description = null;
  if (j.description != null) {
    if (typeof j.description !== "string" || j.description.length > PACK_LIMITS.descriptionLen || /[\u0000-\u001f\u007f]/.test(j.description)) {
      err(jrel, "field-invalid", { field: "description", rule: "one line, ≤ " + PACK_LIMITS.descriptionLen + " characters" });
    } else description = j.description.trim();
  }

  const signals = { strong: [], weak: [], context: [] };
  if (j.signals != null) {
    if (!isObj(j.signals)) err(jrel, "field-invalid", { field: "signals", rule: "{ strong?, weak?, context? }" });
    else {
      for (const k of Object.keys(j.signals)) {
        if (!PACK_TIERS.includes(k)) { warn(jrel, "unknown-key", { key: "signals." + k }); continue; }
        const list = j.signals[k];
        if (!Array.isArray(list)) { err(jrel, "field-invalid", { field: "signals." + k, rule: "[keyword, …]" }); continue; }
        if (list.length > PACK_LIMITS.keywords) { err(jrel, "too-many", { field: "signals." + k, max: PACK_LIMITS.keywords }); continue; }
        for (const kw of list) {
          const t = typeof kw === "string" && kw.length <= 4 * PACK_LIMITS.keywordLen ? kw.trim().replace(/\s+/g, " ") : null;
          if (t == null || t.length > PACK_LIMITS.keywordLen || !RE_PACK_KEYWORD.test(t)) {
            err(jrel, "signal-invalid", { tier: k, keyword: String(kw).slice(0, 80) });
            continue;
          }
          if (!signals[k].includes(t)) signals[k].push(t);
        }
      }
    }
  }

  const sections = [];
  if (!Array.isArray(j.sections) || !j.sections.length) err(jrel, j.sections == null ? "field-missing" : "field-invalid", { field: "sections", rule: "[{ name, syn?, loose?, guidance? }, …] — at least one" });
  else if (j.sections.length > PACK_LIMITS.sections) err(jrel, "too-many", { field: "sections", max: PACK_LIMITS.sections });
  else {
    j.sections.forEach((s, i) => {
      const f = "sections[" + i + "]";
      if (!isObj(s)) { err(jrel, "field-invalid", { field: f, rule: "{ name, syn?, loose?, guidance? }" }); return; }
      for (const k of Object.keys(s)) if (!PACK_SECTION_KEYS.has(k)) warn(jrel, "unknown-key", { key: f + "." + k });
      // (a section name keys the localized-name lookups: never an Object.prototype key such as "constructor")
      const names = packLocalized(s.name, f + ".name", (x) => packTextOk(x, PACK_LIMITS.textLen) && !PROTO_KEYS.has(x.trim().toLowerCase()), textRule, jrel, err, warn);
      // A name / synonym is matched as headingMatches reads a heading: after its lead (numbering "2 " / "1.2 ", "Section 3",
      // an emoji, a dash) — the same strip here, or "2 Offline Modes" could never match its own heading (F4 review R4). Nothing
      // left after the lead → invalid; a lead stripped → a warning (it is ignored when matching).
      let leadWarned = false;
      const key = (x, field) => {
        const raw = x.trim().replace(/\s+/g, " ").toLowerCase();
        const k = packSectionKey(raw);
        if (k.length < 2) { err(jrel, "field-invalid", { field, rule: "a name after its numbering / emoji / dash" }); return null; }
        if (k !== raw && !leadWarned) { leadWarned = true; warn(jrel, "section-name-lead", { name: x.trim(), key: k }); }
        return k;
      };
      const list = (k) => {
        const v = s[k];
        if (v == null) return [];
        if (!Array.isArray(v)) { err(jrel, "field-invalid", { field: f + "." + k, rule: "[text, …]" }); return null; }
        if (v.length > PACK_LIMITS.syn) { err(jrel, "too-many", { field: f + "." + k, max: PACK_LIMITS.syn }); return null; }
        const out = [];
        for (const x of v) {
          if (!packTextOk(x, PACK_LIMITS.textLen)) { err(jrel, "field-invalid", { field: f + "." + k, rule: textRule }); return null; }
          const kx = key(x, f + "." + k);
          if (kx == null) return null;
          out.push(kx);
        }
        return out;
      };
      const syn = list("syn"), loose = list("loose");
      const guidance = s.guidance == null ? null : packLocalized(s.guidance, f + ".guidance", packGuidanceOk, "one line, ≤ " + PACK_LIMITS.guidanceLen + " characters, no <!-- -->", jrel, err, warn);
      if (!names || !syn || !loose || (s.guidance != null && !guidance)) return;
      if (guidance) for (const g of Object.values(guidance)) for (const v of packVarRefs(g)) if (!RE_PACK_GUIDANCE_VAR.test(v)) warn(jrel, "unknown-variable", { v });
      const nameKeys = [];
      for (const [l, x] of Object.entries(names)) {
        const kx = key(x, f + ".name" + (typeof s.name === "string" ? "" : "." + l));
        if (kx == null) return;
        if (!nameKeys.includes(kx)) nameKeys.push(kx);
      }
      const clash = sections.find((o) => nameKeys.some((x) => o.nameKeys.includes(x)));
      if (clash) { err(jrel, "section-duplicate", { name: names.en }); return; }
      // Every pack synonym is MARKER-BOUND (F4 review R7): it names the section only on a heading carrying the pack's marker, or on an
      // unmarked heading nested under one — never the core design's own "## Architecture" / "## Testing Strategy". (`loose` is kept
      // for symmetry with the built-in tables; for a pack every synonym already behaves as one.)
      const all = [...new Set([...nameKeys, ...syn, ...loose])];
      const core = all.filter((x) => coreDesignHeadingKeys().has(x));
      if (core.length) warn(jrel, "section-core-name", { name: names.en, heading: core[0] });
      sections.push({ name: names.en, names, nameKeys, syn: all, loose: all, guidance });
    });
  }

  let steering = null;
  if (j.steering != null) {
    const s = j.steering;
    const stem = typeof s === "string" ? s.slice(0, -3) : "";
    if (typeof s !== "string" || !RE_CUSTOM_STEERING.test(s) || RE_WIN_RESERVED.test(stem) || PROTO_KEYS.has(stem)) err(jrel, "steering-invalid", { file: String(s).slice(0, 80) });
    else {
      steering = s;
      if (i18n.steeringKnownFiles().includes(s)) warn(jrel, "steering-shared", { file: s });
    }
  }

  // The fragments: the pack root, then each <lang>/ folder (packScan's items); anything else is listed (ignored).
  const fragments = {};
  for (const it of scan.items) {
    if (it.lang === "" && it.name === PACK_JSON) continue;
    if (it.state === "unknown") { warn(it.frel, "unknown-file", {}); continue; }
    if (it.state === "linked") { err(it.frel, "fragment-linked", { file: it.name }); continue; }
    const r = readPackItem(it, PACK_LIMITS.fragmentBytes);
    if (r.tooBig) { err(it.frel, "too-big", { file: it.name, max: PACK_LIMITS.fragmentBytes }); continue; }
    if (r.missing) continue;
    const parsed = parsePackFragment(it.name, r.text, it.frel, err, warn);
    if (parsed) (fragments[it.name] = fragments[it.name] || {})[it.lang] = { ...parsed, rel: it.frel };
  }
  // {{acN}} / {{tN}} must name a criterion / a planned test the pack scaffolds — per language context (a <lang>/ folder, else the root).
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const contexts = ["", ...i18n.LANGS.filter((l) => PACK_FRAGMENTS.some((fl) => fragments[fl] && has(fragments[fl], l)))];
  const effective = (fl, ctx) => {
    const by = fragments[fl];
    if (!by) return null;
    for (const l of ctx ? [ctx, i18n.baseLang(ctx), ""] : [""]) if (has(by, l)) return by[l];
    return null;
  };
  for (const ctx of contexts) {
    const req = effective("requirements.md", ctx);
    const nAc = req ? req.items.length : 1;
    const plan = effective("test-plan.md", ctx);
    const nT = plan ? plan.rows.length : nAc;
    for (const fl of ["tasks.md", "test-plan.md", "checklist.md"]) {
      const fr = effective(fl, ctx);
      if (!fr) continue;
      for (const v of new Set(packVarRefs(fr.text))) {
        const m = v.match(/^(ac|t)(\d{1,3})$/);
        if (!m) continue;
        const max = m[1] === "ac" ? nAc : fl === "tasks.md" ? nT : 0;
        // Named with the language context and where the count comes from (F4 review R10): a root tasks.md checked for the pt/
        // features reads pt/requirements.md's criteria.
        const from = m[1] === "ac" ? (req ? req.rel : "") : fl === "tasks.md" ? (plan ? plan.rel : req ? req.rel : "") : "";
        if (+m[2] < 1 || +m[2] > max) err(fr.rel, "fragment-ref", { file: fl, ref: "{{" + v + "}}", n: max, ctx, from, kind: m[1] });
      }
    }
  }

  entry.errors = errors;
  if (errors || !token || !title) return { entry };
  entry.valid = true;
  entry.marker = "[" + token + "]";
  entry.title = title.en;
  return { entry, pack: { name: folder, token, marker: "[" + token + "]", title, description, signals, sections, steering, rel, fragments } };
}

// Every pack folder of a project's .specs/ → the registry { packs (valid, in name order), names, byName, byToken, problems, entries,
// legacy }. A .specs/tracks/ holding a .state.json is a FEATURE created before 1.15 (legacy: no packs, as templates/).
function loadTrackPacks(root) {
  const reg = { packs: [], names: [], byName: new Map(), byToken: new Map(), problems: [], entries: [], legacy: false, corpus: null, dir: path.join(root, TRACK_PACKS_DIR) };
  const tdir = reg.dir;
  if (!existsCached(tdir)) return reg;
  const rel0 = ".specs/" + TRACK_PACKS_DIR + "/";
  const problem = (file, severity, code, args, line, pack) => reg.problems.push({ file, severity, code, args: args || {}, ...(line ? { line } : {}), ...(pack ? { pack } : {}) });
  let st;
  try { st = fs.lstatSync(tdir); } catch { return reg; }
  if (st.isSymbolicLink() || !st.isDirectory()) { problem(rel0, "error", "linked-folder", {}); return reg; }
  if (existsCached(statePath(tdir))) { reg.legacy = true; return reg; }
  let realSpecs;
  try { realSpecs = fs.realpathSync.native(root); } catch { return reg; }
  let count = 0;
  for (const e of readDirCached(tdir) || []) {
    if (e.name.startsWith(".")) continue;
    const rel = rel0 + e.name + "/";
    if (e.isSymbolicLink()) { problem(rel, "error", "linked-folder", {}, null, e.name); reg.entries.push({ name: e.name, folder: rel, valid: false, marker: null, title: null, errors: 1 }); continue; }
    if (!e.isDirectory()) { problem(rel0 + e.name, "warn", "unknown-file", {}); continue; }
    if (++count > PACK_LIMITS.packs) { problem(rel, "error", "too-many-packs", { max: PACK_LIMITS.packs }, null, e.name); reg.entries.push({ name: e.name, folder: rel, valid: false, marker: null, title: null, errors: 1 }); continue; }
    const r = loadPack(path.join(tdir, e.name), e.name, rel, realSpecs);
    reg.problems.push(...r.problems);
    if (r.pack) {
      const other = reg.byToken.get(r.pack.token);
      if (other) { // markers are unique: the first pack (by name) keeps it
        problem(rel + PACK_JSON, "error", "marker-duplicate", { marker: r.pack.marker, other: other.name }, null, e.name);
        r.entry.valid = false;
        r.entry.errors++;
      } else {
        reg.packs.push(r.pack);
        reg.names.push(r.pack.name);
        reg.byName.set(r.pack.name, r.pack);
        reg.byToken.set(r.pack.token, r.pack);
      }
    }
    reg.entries.push(r.entry);
  }
  return reg;
}

let PACK_LOADING = false;
const NO_PACKS = Object.freeze({ packs: [], names: [], byName: new Map(), byToken: new Map(), problems: [], entries: [], legacy: false, corpus: null, dir: null });
// The track packs of the project the current engine call works in (TEMPLATE_SCOPE_ROOT) — none outside a call's scope or while
// the packs themselves load (a reader of the registries never sees a half-built one).
function packRegistry() {
  const root = CTX.TEMPLATE_SCOPE_ROOT;
  if (!root || PACK_LOADING) return NO_PACKS;
  if (CTX.PACK_MEMO && CTX.PACK_MEMO.root === root) return CTX.PACK_MEMO.reg;
  PACK_LOADING = true;
  let reg;
  try { reg = loadTrackPacks(root); } catch { reg = NO_PACKS; } finally { PACK_LOADING = false; }
  if (CTX.READ_CACHE) CTX.PACK_MEMO = { root, dirKey: readCacheKey(path.join(root, TRACK_PACKS_DIR)), reg };
  return reg;
}
// --- the registries: built-in tables + the project's valid packs (in name order, after the built-in ones) ---
const packTracks = () => packRegistry().names;
const packOf = (tr) => packRegistry().byName.get(tr) || null;
const isPackTrack = (tr) => typeof tr === "string" && packRegistry().byName.has(tr);
function allTracks() { const p = packTracks(); return p.length ? VALID_TRACKS.concat(p) : VALID_TRACKS; }
function optionalTracks() { const p = packTracks(); return p.length ? OPTIONAL_TRACKS.concat(p) : OPTIONAL_TRACKS; }
function markerTracks() { const p = packTracks(); return p.length ? MARKER_TRACKS.concat(p) : MARKER_TRACKS; }
function trackMarker(tr) { if (Object.prototype.hasOwnProperty.call(TRACK_MARKER, tr)) return TRACK_MARKER[tr]; const p = packOf(tr); return p ? p.marker : undefined; }
function trackSectionTable(tr) { if (Object.prototype.hasOwnProperty.call(TRACK_SECTIONS, tr)) return TRACK_SECTIONS[tr]; const p = packOf(tr); return p ? p.sections : undefined; }
function trackSteeringFiles(tr) { if (Object.prototype.hasOwnProperty.call(TRACK_STEERING, tr)) return TRACK_STEERING[tr]; const p = packOf(tr); return p && p.steering ? [p.steering] : []; }
function trackSignalTable(tr) { if (Object.prototype.hasOwnProperty.call(SIGNALS, tr)) return SIGNALS[tr]; const p = packOf(tr); return p ? p.signals : { strong: [], weak: [] }; }
// `[A11Y]` — exactly, markers are case-sensitive tokens — is a pack's stable marker, never a template slot (a lower-case
// `[role]` stays the template's slot even beside a ROLE pack). Never while the process-wide built-in corpus is built.
function isPackMarkerBracket(inner) {
  if (CTX.BUILTIN_CORPUS_BUILD) return false;
  const reg = packRegistry();
  return reg.packs.length > 0 && reg.byToken.has(String(inner).trim());
}
// The markers a feature's active track packs carry → { packMarkers: { name: "[TOKEN]" } } for its .state.json (none: {}) — so the
// feature's pack sections stay recognizable (and inactive) if the pack later disappears.
function packMarkersFor(tracks) {
  const m = {};
  for (const t of tracks || []) if (isPackTrack(t)) m[t] = trackMarker(t);
  return Object.keys(m).length ? { packMarkers: m } : {};
}
// The track packs a feature once used that the project lacks now (this engine call): [[name, marker]] — their sections, criteria
// and task blocks are INACTIVE like a removed track's (inactiveMarkerLines / inactiveTaskLines). Filled by detectTracks from each
// feature's .state.json packMarkers — EVERY recorded pack that is no valid pack now, whether the feature still lists it or turned
// it off before the pack went (F4 review R1: an off-then-deleted pack's sections came back to life); a marker that is a valid
// pack's or reserved is never one. Dropped with the read-cache scope.
function noteGhostPacks(st) {
  if (!CTX.READ_CACHE || !isObj(st) || !isObj(st.packMarkers)) return;
  const valid = allTracks();
  for (const n of Object.keys(st.packMarkers)) {
    const m = st.packMarkers[n];
    // (a pre-1.17 pack named like a built-in track — 'dist' — is a missing pack too: legacyPackName, 1.17 D review)
    if (typeof m !== "string" || !RE_PACK_NAME.test(n) || (valid.includes(n) && !legacyPackName(st, n))) continue;
    const token = m.length > 2 && m.startsWith("[") && m.endsWith("]") ? m.slice(1, -1) : "";
    if (!RE_PACK_MARKER.test(token) || RE_PACK_MARKER_RESERVED.test(token) || packRegistry().byToken.has(token)) continue;
    if (!CTX.GHOST_MARKERS) CTX.GHOST_MARKERS = new Map();
    CTX.GHOST_MARKERS.set(n, m);
  }
}
const ghostMarkers = () => (CTX.GHOST_MARKERS ? [...CTX.GHOST_MARKERS] : []);
// A saved (non-built-in) track name that is a track pack's: a valid pack now, or one recorded in the state's packMarkers (a pack the
// feature used) — never a reserved word (F4 review R6: a hand-typed "gdpr" / "security" / a typo is no pack; the list then falls
// back to the files as in 1.14) — except a pre-1.17 pack of a name reserved since (legacyPackName, 1.17 D review).
function savedPackName(st, n) {
  if (legacyPackName(st, n)) return true;
  if (VALID_TRACKS.includes(n) || !RE_PACK_NAME.test(n) || packReservedName(n)) return false;
  return isPackTrack(n) || (isObj(st) && isObj(st.packMarkers) && Object.prototype.hasOwnProperty.call(st.packMarkers, n));
}
// A track pack from before 1.17 whose name is reserved now (1.17 D review): 1.15 / 1.16 accepted a pack named 'dist', 'kafka',
// 'consistency', 'microservices', 'distributed'… — 1.17 reserves them (the built-in +dist track and its TRACK_ALIASES), so the
// pack is invalid ('name-reserved'). A feature that used it recorded the name in .state.json packMarkers (only a VALID pack is
// ever recorded there): it stays that feature's MISSING pack — inactive, listed by doctor's track-pack-missing with the reason
// and the way out (rename the pack folder, add it again) — never silently dropped (the list read "core" and no warning), and a
// pack named 'dist' is never read as the built-in +dist track (whose five [DIST] sections the pack's design doesn't have).
// Adding the built-in track by name adopts it (applyTracks drops the record); add_track <name> --remove drops the pack.
function legacyPackName(st, n) {
  return typeof n === "string" && RE_PACK_NAME.test(n) && packReservedName(n) && isObj(st) && isObj(st.packMarkers) &&
    Object.prototype.hasOwnProperty.call(st.packMarkers, n);
}
// The dev-spec release that reserved a pack name a feature still records (1.19 T): the +api / +ui / +obs names and their aliases
// became reserved in 1.19, +dist's in 1.17 — the doctor / upgrade messages say "a track pack from before <that release>".
const TRACK_RESERVED_SINCE = { dist: "1.17", api: "1.19", ui: "1.19", obs: "1.19" };
function packReservedSince(n) {
  const tr = Object.prototype.hasOwnProperty.call(TRACK_ALIASES, n) ? TRACK_ALIASES[n] : n;
  return Object.prototype.hasOwnProperty.call(TRACK_RESERVED_SINCE, tr) ? TRACK_RESERVED_SINCE[tr] : "1.17";
}
// A feature's saved tracks naming a pack the project no longer has (deleted, now invalid, or — 1.17 — its name reserved since):
// inactive, kept in .state.json.
function missingPackTracks(dir) {
  const st = readJson(statePath(dir)).data;
  const saved = isObj(st) && Array.isArray(st.tracks) ? st.tracks : [];
  const valid = allTracks();
  return [...new Set(saved.filter((x) => typeof x === "string").map((x) => x.toLowerCase())
    .filter((x) => legacyPackName(st, x) || (!valid.includes(x) && savedPackName(st, x))))];
}

// --- rendering a pack's blocks (the design sections, criteria, task block, test rows, checklist items, steering stub) ---
function packLocal(v, lang) {
  if (!v) return "";
  if (typeof v === "string") return v;
  const l = normalizeLang(lang), b = i18n.baseLang(l);
  return (Object.prototype.hasOwnProperty.call(v, l) && v[l]) || (Object.prototype.hasOwnProperty.call(v, b) && v[b]) || v.en || "";
}
const packTitle = (pack, lang) => packLocal(pack.title, lang);
// The fragment `file` for a feature in `lang`: its <lang>/ folder's, its family's (pt-BR → pt), else the pack root's — or null.
function packFragment(pack, file, lang) {
  const by = pack.fragments[file];
  if (!by) return null;
  for (const l of [...templateLangChain(lang), ""]) if (Object.prototype.hasOwnProperty.call(by, l)) return by[l];
  return null;
}
// The values a fragment's {{variables}} take (see RE_PACK_VAR). ctx: { acs, tids, title, marker, acSlot, name?, slug? }.
// → { text, drop } — drop: a {{tN}} / {{tests}} with no planned test (the caller leaves that line out).
function packSubst(text, ctx) {
  let drop = false;
  const out = String(text).replace(RE_TEMPLATE_VAR, (m, k) => {
    const key = k.toLowerCase();
    let x;
    if ((x = key.match(/^ac(\d{1,3})$/))) return ctx.acs[+x[1] - 1] || ctx.acSlot;
    if (key === "acs") return ctx.acs.length ? ctx.acs.join(", ") : ctx.acSlot;
    if ((x = key.match(/^t(\d{1,3})$/))) { const t = ctx.tids[+x[1] - 1]; if (!t) drop = true; return t || m; }
    if (key === "tests") { if (!ctx.tids.length) drop = true; return ctx.tids.join(", "); }
    if (key === "title") return ctx.title;
    if (key === "marker") return ctx.marker;
    if ((key === "name" || key === "slug") && ctx[key] != null) return ctx[key];
    return m;
  });
  return { text: out, drop };
}
function packCtx(pack, lang, acs, tids, vars) {
  return { acs, tids, title: packTitle(pack, lang), marker: pack.marker, acSlot: i18n.msg(lang).tracks.acPlaceholder(pack.name), ...(vars || {}) };
}
// {{title}} / {{marker}} (and {{name}} / {{slug}} when `vals` has them) filled in; every other {{variable}} left as written.
function packSubstBasic(text, vals) {
  return String(text).replace(RE_TEMPLATE_VAR, (m, k) => {
    const key = k.toLowerCase();
    return (key === "title" || key === "marker" || key === "name" || key === "slug") && vals[key] != null ? vals[key] : m;
  });
}
// The mandatory design sections: `## [MARKER] <name>` + the > **TODO** sentinel + the section's guidance (as the built-in blocks) —
// the guidance's {{title}} / {{marker}} / {{name}} / {{slug}} filled in (vars: the feature's { name, slug }).
function packDesignBlock(pack, lang, vars) {
  const P = i18n.msg(lang).trackPacks;
  const vals = { title: packTitle(pack, lang), marker: pack.marker, ...(vars || {}) };
  return pack.sections.map((s) => {
    const g = s.guidance ? packSubstBasic(packLocal(s.guidance, lang), vals) : "";
    return "\n## " + pack.marker + " " + packLocal(s.names, lang) + "\n" + P.todoLine + "\n" + (g ? g + "\n" : "");
  }).join("");
}
// The criteria block — `#### [MARKER] <title> — Acceptance Criteria (EARS)`, numbered after the highest US-1 AC `existing` defines.
function packRequirementsBlock(pack, lang, existing, vars) {
  const P = i18n.msg(lang).trackPacks;
  const have = [...requirementAcIds(existing || "")].filter((id) => /^US-1\.AC-\d+$/.test(id)).map((id) => parseInt(id.slice(8), 10));
  let n = have.reduce((a, b) => Math.max(a, b), 0);
  const f = packFragment(pack, "requirements.md", lang);
  const items = f ? f.items : [{ text: P.defaultCriterion(packTitle(pack, lang)), sub: [] }];
  const ctx = packCtx(pack, lang, [], [], vars);
  const lines = ["#### " + pack.marker + " " + packTitle(pack, lang) + " — " + P.acHeading];
  for (const it of items) {
    n++;
    lines.push(n + ". **US-1.AC-" + n + "** — " + packSubst(it.text, ctx).text);
    it.sub.forEach((s) => lines.push("   " + packSubst(s, ctx).text));
  }
  return lines.join("\n");
}
// requirements.md + a pack's criteria block, placed right after the US-1 criteria (before the next story / section heading) —
// appended at the end when the text has no US-1 criterion. The heading is a REAL one: never inside an HTML comment (F4 review R3 —
// a template's `<!-- Add more stories like this: ### US-2 … -->` swallowed the block) nor fenced code.
function insertPackRequirements(text, block) {
  const lines = text.split("\n");
  const us1 = [...acIndex(text).values()].filter((e) => /^US-1\.AC-/.test(e.id)).map((e) => e.line);
  if (us1.length) {
    const last = us1.reduce((a, b) => Math.max(a, b), 0) - 1;
    const cl = commentLines(lines);
    const at = headingIndex(lines).find((h) => h > last && !cl[h].hidden && cl[h].vis.startsWith("#") && lines[h].match(/^(#{1,6})/)[1].length <= 3);
    if (at != null) {
      let k = at;
      while (k > 0 && !lines[k - 1].trim()) k--;
      return [...lines.slice(0, k), "", block, "", ...lines.slice(at)].join("\n");
    }
  }
  return text.trimEnd() + "\n\n" + block + "\n";
}
// The planned tests of a pack's criteria: test-plan rows citing one of `acs`, in plan order → [{ tid, acs: Set }].
function packPlanRows(planText, acs) {
  const want = new Set(acs);
  const out = [];
  for (const [tid, r] of testIndex(planText || "")) {
    const cov = [...extractAcIds(r.row)].filter((a) => want.has(a));
    if (cov.length) out.push({ tid, acs: new Set(cov) });
  }
  return out;
}
// The task block — `## Story US-1 — [MARKER] <title>`, numbered after the last task — or null when tasks.md already has it (a
// heading carrying the marker). Each task cites the pack's criteria as requirements.md defines them (trackAcIds; none yet → the
// track's criterion slot) and, on a +tdd plan with the pack's rows, makes their tests green.
function packTaskBlock(pack, tasksText, reqText, planText, lang, vars) {
  if (trackTaskHeading(pack.name, tasksText)) return null;
  const P = i18n.msg(lang).trackPacks;
  const start = parseTasks(tasksText).reduce((a, t) => Math.max(a, t.number), 0) + 1;
  const acs = [...trackAcIds(reqText || "", pack.name)];
  const rows = packPlanRows(planText, acs);
  const ctx = packCtx(pack, lang, acs, rows.map((r) => r.tid), vars);
  const f = packFragment(pack, "tasks.md", lang);
  const items = f ? f.items : [{ text: P.defaultTask(pack.marker, packTitle(pack, lang)), sub: [] }];
  const out = ["", "## " + P.taskHeading(pack.marker, packTitle(pack, lang))];
  let n = start - 1;
  for (const it of items) {
    n++;
    const text = packSubst(it.text, ctx).text;
    const sub = it.sub.map((s) => packSubst(s, ctx)).filter((s) => !s.drop).map((s) => s.text);
    if (!sub.some((s) => /_Requirements:/.test(s))) sub.unshift("- _Requirements: " + (acs.length ? acs.join(", ") : ctx.acSlot) + "_");
    if (!f && rows.length && !sub.some((s) => /_Makes green:/.test(s))) { // the default task (a fragment's tasks say it with {{tests}})
      const cited = extractAcIds(sub.join(" "));
      const green = rows.filter((r) => [...r.acs].some((a) => cited.has(a))).map((r) => r.tid);
      if (green.length) sub.push("- _Makes green: " + green.join(", ") + "_");
    }
    out.push("- [ ] " + n + ". " + (/^\[(?:US\d+|shared)\]/i.test(text) ? text : "[US1] " + text), ...sub.map((s) => "  " + s));
  }
  return out.join("\n") + "\n";
}
// The test rows block — `## [MARKER] <Traceability Matrix>` + the built-in plan's header + one row per fragment row (else one per
// criterion), T-IDs after the plan's own — or null (no pack criterion in requirements.md, or the plan already cites them).
function packTestRowsBlock(pack, lang, planText, reqText, vars) {
  const acs = [...trackAcIds(reqText || "", pack.name)];
  if (!acs.length) return null;
  const plan = planIdText(planText || "");
  const cited = extractAcIds(plan);
  if (acs.some((id) => cited.has(id))) return null;
  let n = [...extractTestIds(plan)].map((id) => parseInt(id.slice(2), 10)).reduce((a, b) => Math.max(a, b), 0);
  const P = i18n.msg(lang).trackPacks;
  const ctx = packCtx(pack, lang, acs, [], vars);
  const f = packFragment(pack, "test-plan.md", lang);
  const rows = f ? f.rows.map((r) => {
    const c = r.cells.map((x) => packSubst(x, ctx).text);
    if (!extractAcIds(c[4]).size) c[4] = acs.join(", ");
    return c;
  }) : acs.map((ac) => ["", P.rowLayer, "example", P.rowDesc, ac, "`tests/integration/...`"]);
  const lines = i18n.testPlan("x", lang, ["core", "tdd"]).split("\n");
  const first = lines.findIndex((l) => /^\|\s*T-\d+\s*\|/.test(l));
  if (first < 2) return null;
  const heading = (lines.slice(0, first).reverse().find((l) => /^##\s/.test(l)) || "").replace(/^##\s+/, "");
  const body = rows.map((c) => "| T-" + String(++n).padStart(2, "0") + " | " + c.slice(1).join(" | ") + " |");
  return "\n## " + pack.marker + " " + heading + "\n\n" + lines[first - 2] + "\n" + lines[first - 1] + "\n" + body.join("\n") + "\n";
}
// The checklist items (`- [ ] MARKER: …`) — null when the checklist already holds one of them.
// reqText: the feature's requirements.md — a checklist item's {{acN}} names the pack's criteria as it numbers them.
function packChecklistBlock(pack, lang, text, vars, reqText) {
  const lead = pack.token + ":";
  const RE_BOX = /^\s*[-*]\s+\[[ xX]\]\s+/;
  if (String(text || "").split("\n").some((l) => RE_BOX.test(l) && l.replace(RE_BOX, "").startsWith(lead))) return null;
  const P = i18n.msg(lang).trackPacks;
  const ctx = packCtx(pack, lang, [...trackAcIds(reqText || "", pack.name)], [], vars);
  const f = packFragment(pack, "checklist.md", lang);
  const items = f ? f.items.map((it) => packSubst(it.text, ctx).text) : [P.checklistItem(pack.sections.length)];
  return items.map((t) => "- [ ] " + (t.startsWith(lead) ? t : lead + " " + t)).join("\n");
}
// The steering stub a pack brings (its steering.md, else a generic one titled after the track).
function packSteeringStub(pack, lang) {
  const f = packFragment(pack, "steering.md", lang);
  return f ? (f.text.endsWith("\n") ? f.text : f.text + "\n") : i18n.msg(lang).trackPacks.steeringStub(packTitle(pack, lang), pack.name);
}
// A steering file's stub: the built-in one, else the one of the pack that brings that file, else null.
function trackSteeringStub(file, lang) {
  const b = i18n.steeringStub(file, lang);
  if (b) return b;
  const p = packRegistry().packs.find((x) => x.steering === file);
  return p ? packSteeringStub(p, lang) : null;
}

// The pack blocks as template corpus (placeholder detection): every text a valid pack scaffolds, in every language — its brackets,
// code-span slots and task lines are template text until a feature edits them. Read straight from the pack's sources (the section
// guidance, the fragments' items / rows, the i18n defaults) — never by rendering whole blocks (F4 review R9) — with {{title}} /
// {{marker}} filled in and the FEATURE's values ({{name}} {{slug}} {{acN}} {{acs}} {{tN}} {{tests}}) kept as variables: a key holding
// one is a LINEAR wildcard (packWildcard → wildcardMatch, the project templates' rule), so `[the {{name}} screens]` still reads as
// a slot once it became `[the Login screens]` (F4 review R2). Built on first use per call and cached across calls by the packs' scan
// signatures (PACK_CORPUS_CACHE — any edit to a pack changes the key).
const RE_PACK_WILD_VAR = /\{\{\s*(?:ac\d{1,3}|acs|t\d{1,3}|tests|name|slug)\s*\}\}/i;
const RE_PACK_WILD_VAR_G = new RegExp(RE_PACK_WILD_VAR.source, "gi");
const PACK_CORPUS_CACHE = new Map(); // corpus key → sets, across calls (bounded)
function packCorpusSets() {
  const reg = packRegistry();
  if (!reg.packs.length) return null;
  if (reg.corpus) return reg.corpus;
  const ck = reg.packs.map((p) => p.name + "|" + p.token + "|" + (p.sig || "")).join("\n");
  const cached = PACK_CORPUS_CACHE.get(ck);
  if (cached) return (reg.corpus = cached);
  const sets = { brackets: { set: new Set(), wild: [] }, code: new Set(), tasks: { set: new Set(), wild: [] } };
  reg.corpus = sets; // visible to the scan below (a code-span slot lookup) while it is filled
  const seen = new Set();
  // A key holding a feature variable → a wildcard (at least 3 literal characters, as templateWildcard: a slot that is nothing but
  // a variable would match every bracket), else an exact key.
  const put = (entry, key) => {
    if (!RE_PACK_WILD_VAR.test(key)) { entry.set.add(key); return; }
    const segs = key.split(RE_PACK_WILD_VAR_G);
    if (segs.join("").replace(/\s+/g, "").length >= 3) entry.wild.push(segs);
  };
  for (const p of reg.packs) {
    for (const l of i18n.LANGS) {
      const P = i18n.msg(l).trackPacks;
      const vals = { title: packTitle(p, l), marker: p.marker };
      const texts = [], taskTexts = [];
      for (const s of p.sections) if (s.guidance) texts.push(packLocal(s.guidance, l));
      const fr = packFragment(p, "requirements.md", l);
      if (fr) fr.items.forEach((it) => texts.push(it.text, ...it.sub)); else texts.push(P.defaultCriterion(vals.title));
      const ft = packFragment(p, "tasks.md", l);
      if (ft) ft.items.forEach((it) => { texts.push(it.text, ...it.sub); taskTexts.push(it.text); });
      else { const d = P.defaultTask(p.marker, vals.title); texts.push(d); taskTexts.push(d); }
      const fp = packFragment(p, "test-plan.md", l);
      if (fp) fp.rows.forEach((r) => texts.push("| " + r.cells.slice(1).join(" | ") + " |")); else texts.push(P.rowDesc);
      const fc = packFragment(p, "checklist.md", l);
      if (fc) fc.items.forEach((it) => texts.push(it.text)); else texts.push(P.checklistItem(p.sections.length));
      texts.push(packSteeringStub(p, l), i18n.msg(l).tracks.acPlaceholder(p.name));
      for (const t of texts) {
        const k = templateBracketKeys(packSubstBasic(t, vals), seen);
        k.brackets.forEach((x) => put(sets.brackets, x));
        k.code.forEach((x) => sets.code.add(x));
      }
      for (const t of taskTexts) put(sets.tasks, taskDescription(packSubstBasic(t, vals)));
    }
  }
  if (PACK_CORPUS_CACHE.size >= 16) PACK_CORPUS_CACHE.clear();
  PACK_CORPUS_CACHE.set(ck, sets);
  return sets;
}

// --- spec_tracks {action: list | init | check, name?, lang?} — `dev-spec tracks [list|init <name>|check]` ---
function localizePackProblem(p, K) {
  const M = K.problems[p.code];
  const out = { file: p.file, severity: p.severity, code: p.code, message: typeof M === "function" ? M(p.args || {}) : M || p.code };
  if (p.line) out.line = p.line;
  if (p.pack) out.pack = p.pack;
  return out;
}
function trackPacks(projectDir, action, opts = {}) {
  const pl = projectLang(projectDir);
  let lang = null;
  if (opts.lang != null && String(opts.lang).trim()) {
    lang = i18n.canonicalLang(String(opts.lang));
    if (!lang) {
      const A = i18n.msg(pl).args;
      return { ok: false, error: A.invalid(A.item("lang", A.oneOf(i18n.LANGS.join(", ")), JSON.stringify(String(opts.lang)))) };
    }
  }
  const lng = lang || pl;
  const K = i18n.msg(lng).trackPacks;
  const act = action == null || !String(action).trim() ? "list" : String(action).trim().toLowerCase();
  if (!["list", "init", "check"].includes(act)) return { ok: false, error: K.badAction(String(action)) };
  const root = specsRoot(projectDir);
  const tdir = path.join(root, TRACK_PACKS_DIR);
  // .specs/tracks/ of a feature created before 1.15 stays that feature: nothing is read from it, nothing written into it.
  if (existsCached(statePath(tdir))) return { ok: false, legacyFeature: true, error: K.legacyFeature };
  if (act === "init") return initTrackPack(projectDir, opts.name, lang, lng);
  const reg = packRegistry();
  const name = opts.name != null && String(opts.name).trim() ? String(opts.name).trim().toLowerCase() : null;
  if (name && !reg.entries.some((e) => e.name === name) && !VALID_TRACKS.includes(name)) return { ok: false, error: K.unknownPack(name, reg.entries.map((e) => e.name).join(", ") || "—") };
  if (act === "check") return checkTrackPacks(reg, name, lng);
  return listTrackPacks(reg, name, lng);
}
function listTrackPacks(reg, name, lng) {
  const K = i18n.msg(lng).trackPacks;
  const builtIn = VALID_TRACKS.filter((t) => !name || t === name).map((t) => ({ name: t, builtIn: true, marker: TRACK_MARKER[t] || null,
    sections: (TRACK_SECTIONS[t] || []).map((s) => s.name), steering: (TRACK_STEERING[t] || []).slice() }));
  const packs = reg.entries.filter((e) => !name || e.name === name).map((e) => {
    const p = e.valid ? reg.byName.get(e.name) : null;
    const errs = reg.problems.filter((x) => x.pack === e.name && x.severity === "error").length;
    const warns = reg.problems.filter((x) => x.pack === e.name && x.severity === "warn").length;
    return p ? { name: p.name, folder: e.folder, valid: true, marker: p.marker, title: packTitle(p, lng), description: p.description,
      sections: p.sections.map((s) => packLocal(s.names, lng)), signals: { strong: p.signals.strong.length, weak: p.signals.weak.length, context: p.signals.context.length },
      steering: p.steering, fragments: Object.keys(p.fragments).sort(), errors: 0, warnings: warns }
      : { name: e.name, folder: e.folder, valid: false, errors: errs, warnings: warns };
  });
  const lines = [K.listHead(VALID_TRACKS.length, packs.length, packs.filter((p) => p.valid).length)];
  const width = Math.max(8, ...builtIn.map((b) => b.name.length), ...packs.map((p) => p.name.length));
  builtIn.forEach((b) => lines.push("  · " + b.name.padEnd(width) + "  " + (b.marker ? b.marker + "  " + K.sectionCount(b.sections.length) : K.builtIn)));
  packs.forEach((p) => lines.push(p.valid
    ? "  ✎ " + p.name.padEnd(width) + "  " + p.marker + "  " + p.title + " — " + K.sectionCount(p.sections.length) + " · " + K.signalCount(p.signals.strong + p.signals.weak + p.signals.context) + (p.steering ? " · steering/" + p.steering : "")
    : "  ✗ " + p.name.padEnd(width) + "  " + K.invalid(p.errors)));
  if (!reg.entries.length) lines.push(K.noPacks);
  return { ok: true, action: "list", dir: reg.dir || null, lang: lng, builtIn, packs, lines };
}
function checkTrackPacks(reg, name, lng) {
  const K = i18n.msg(lng).trackPacks;
  const problems = reg.problems.filter((p) => !name || p.pack === name).map((p) => localizePackProblem(p, K));
  // Beyond the loader's rules: the criteria each valid pack scaffolds, read by EARS as a feature's requirements would be.
  for (const p of reg.packs.filter((x) => !name || x.name === name)) {
    for (const [l, f] of Object.entries(p.fragments["requirements.md"] || {})) {
      const L = l || lng;
      const ctx = packCtx(p, L, [], []);
      for (const it of f.items) {
        const text = "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — " + packSubst(it.text, ctx).text + it.sub.map((s) => "\n   " + packSubst(s, ctx).text).join("");
        const e = earsValidate(text, L);
        if (!e.ok) continue;
        for (const i of e.issues) {
          if (i.code !== "no-modal" && i.code !== "vague") continue;
          problems.push({ file: f.rel, severity: "warn", code: "ears-" + i.code, message: i.msg, line: it.line, pack: p.name });
        }
      }
    }
  }
  const errors = problems.filter((x) => x.severity === "error").length;
  const warnings = problems.length - errors;
  const checked = reg.entries.filter((e) => !name || e.name === name).map((e) => ({ name: e.name, folder: e.folder, valid: e.valid && reg.byName.has(e.name) }));
  const lines = [];
  if (!checked.length && !problems.length) lines.push(K.checkNone);
  else {
    lines.push(K.checkHead(checked.length, checked.filter((c) => c.valid).length, errors, warnings));
    problems.forEach((x) => lines.push("  " + (x.severity === "error" ? "✗ " : "▲ ") + x.file + (x.line ? ":" + x.line : "") + " — " + x.message));
  }
  return { ok: true, action: "check", lang: lng, checked, problems, errors, warnings, verdict: errors ? "fail" : warnings ? "warn" : "pass", lines };
}
function initTrackPack(projectDir, name, lang, lng) {
  const K = i18n.msg(lng).trackPacks;
  const n = typeof name === "string" ? name.trim().toLowerCase() : "";
  if (!n) return { ok: false, error: K.nameRequired };
  if (!RE_PACK_NAME.test(n)) return { ok: false, error: K.problems["name-invalid"]({ name: n }) };
  if (packReservedName(n)) return { ok: false, error: K.problems["name-reserved"]({ name: n }) };
  const tdir = path.join(specsRoot(projectDir), TRACK_PACKS_DIR);
  const dir = path.join(tdir, n);
  // A marker no other pack uses: the name in capitals (at most 12), "TRACK"-suffixed when that is a reserved word.
  const taken = new Set(packRegistry().packs.filter((p) => p.name !== n).map((p) => p.token));
  let token = n.toUpperCase().slice(0, 12);
  if (RE_PACK_MARKER_RESERVED.test(token)) token = (token + "TRACK").slice(0, 12);
  for (let i = 2; taken.has(token) && i < 100; i++) token = n.toUpperCase().slice(0, 12 - String(i).length) + i;
  const title = n.charAt(0).toUpperCase() + n.slice(1);
  const a = { name: n, token, title, lang: lng };
  const files = { "track.json": K.initJson(a), "requirements.md": K.initRequirements(a), "tasks.md": K.initTasks(a), "test-plan.md": K.initTestPlan(a),
    "checklist.md": K.initChecklist(a), "steering.md": K.initSteering(a) };
  // Writes stay inside the project: a .specs/ or tracks/ folder that is a link to a folder elsewhere is refused.
  const inside = (abs) => {
    let real;
    try { real = fs.realpathSync.native(projectDir); } catch { return true; }
    let d = path.dirname(abs);
    while (!fs.existsSync(d) && path.dirname(d) !== d) d = path.dirname(d);
    try { return isInsideDir(real, fs.realpathSync.native(d)); } catch { return false; }
  };
  const created = [], kept = [];
  for (const [file, text] of Object.entries(files)) {
    const rel = ".specs/" + TRACK_PACKS_DIR + "/" + n + "/" + file;
    const abs = path.join(dir, file);
    if (!inside(abs)) return { ok: false, error: K.writeOutside(rel), created, kept };
    try {
      if (writeIfAbsent(abs, text)) created.push(rel);
      else kept.push(rel);
    } catch (e) {
      return { ok: false, error: K.writeFailed(rel, e.code || e.message), created, kept };
    }
  }
  const lines = created.length ? [K.initDone(n, created.length), ...created.map((c) => "  + " + c)] : [K.initNothing(n)];
  if (created.length && kept.length) lines.push(K.initKept(kept.join(", ")));
  if (created.length) lines.push(K.initNext(n));
  return { ok: true, action: "init", name: n, marker: "[" + token + "]", dir, lang: lng, created, kept, lines };
}

// The feature's active tracks — the ONE source every tool uses (status, doctor, add_track, roadmap,
// next_action, brief…). Since 1.13 they are persisted in .state.json `tracks` (create / add_track /
// add_track --remove write them). Older features fall back to their files; there a [SaaS]/[AI] marker only
// counts on a real markdown heading — a Mermaid node `X[AI]` or prose used to switch +ai on (doctor then
// failed 10 "missing" AI sections and add_track said "already on +ai").
function detectTracks(dir) {
  useTemplateScopeOf(dir); // the project's track packs are tracks too (1.15) — a direct call knows its project by the folder
  const st = readJson(statePath(dir)).data;
  noteGhostPacks(st); // a saved track pack the project lacks now: its sections are inactive (1.15)
  const saved = savedTracks(st);
  if (saved) return saved;
  const t = ["core"];
  if (existsCached(path.join(dir, "test-plan.md")) || existsCached(path.join(dir, "tests"))) t.push("tdd");
  const design = readIfExists(path.join(dir, "design.md")) || "";
  if (existsCached(path.join(dir, "load-test.md")) || headingHasMarker(design, "[SaaS]")) t.push("saas");
  if (existsCached(path.join(dir, "eval-plan.md")) || existsCached(path.join(dir, "evals")) || headingHasMarker(design, "[AI]")) t.push("ai");
  // The marker tracks without an artifact of their own (+sec, +privacy): their design sections are the evidence.
  for (const x of markerTracks()) if (!t.includes(x) && headingHasMarker(design, trackMarker(x))) t.push(x);
  return allTracks().filter((x) => t.includes(x));
}
// The track list a state object saved (a non-empty list of known track names) → normalized, else null (inferred from the
// files — detectTracks' fallback, and what spec_upgrade {apply} saves).
function savedTracks(st) {
  const saved = st && typeof st === "object" && !Array.isArray(st) ? st.tracks : null;
  // A track pack's name (1.15 — a valid pack now, or one the state recorded in packMarkers) is a saved track too, one the project
  // may lack now (inactive: normalizeTracks drops it, doctor warns track-pack-missing); any other unknown name → the files decide,
  // as in 1.14 (savedPackName — F4 review R6). A pre-1.17 pack of a now reserved name (legacyPackName) is a missing pack — never
  // the built-in track of that name (1.17 D review: a 1.16 pack 'dist' is not +dist).
  return Array.isArray(saved) && saved.length && saved.every((x) => typeof x === "string" && (VALID_TRACKS.includes(x.toLowerCase()) || savedPackName(st, x.toLowerCase())))
    ? normalizeTracks(saved.filter((x) => !legacyPackName(st, x.toLowerCase()))) : null;
}

// A markdown heading (outside fenced code and HTML comments) carrying a track marker.
// Track markers are English-stable, CASE-SENSITIVE tokens (C4): `[SaaS]`, `[AI]`, `[SEC]`, `[PRIVACY]` exactly. A heading
// that merely ends in a lower-case "[sec]" / "[privacy]" (`### Timeout [sec]` — seconds) is no track section: matched
// case-insensitively it was hidden while the track was off (inactiveMarkerLines) and made detectTracks infer +sec.
function headingHasMarker(md, marker) {
  const lines = stripHtmlComments(md).split(/\r?\n/);
  return headingIndex(lines).some((i) => lines[i].includes(marker));
}

// The tracks with mandatory design sections under a stable, English marker (the markers are matched literally, in any
// language). MARKER_TRACKS drives every per-marker loop: detection, inactive sections/tasks, doctor, approve, status.
const TRACK_MARKER = { saas: "[SaaS]", ai: "[AI]", sec: "[SEC]", privacy: "[PRIVACY]", dist: "[DIST]", api: "[API]", ui: "[UI]", obs: "[OBS]" };
const MARKER_TRACKS = Object.keys(TRACK_MARKER);
// The AC IDs requirements.md defines as a track's criteria: under a heading carrying its marker ([SaaS] / [AI] — the
// template's "#### [SaaS] Acceptance Criteria (EARS)", in any language) or with the marker in the criterion itself.
function trackAcIds(reqText, tr) {
  const out = new Set();
  const marker = trackMarker(tr);
  if (!marker || !reqText) return out;
  const inSection = inactiveMarkerLines(reqText, allTracks().filter((t) => t !== tr)); // exactly that track's sections
  // … and only ITS lines: a missing pack's ghost sections (inactiveMarkerLines adds them) are no other track's criteria (F4 review R5)
  for (const [id, e] of acIndex(reqText)) if (inSection.get(e.line - 1) === tr || e.text.includes(marker)) out.add(id); // case-sensitive marker (C4)
  return out;
}
// The heading of a track's template task block as it appears in tasks.md (in any language), or null.
const normTaskHeading = (l) => l.replace(/^#{1,6}\s+/, "").replace(/\s+/g, " ").trim().toLowerCase();
const TASK_HEADINGS = new Map(); // built-in track → its template task headings (static i18n text: built once per process)
function trackTaskHeadings(tr) {
  if (isPackTrack(tr)) return new Set(); // a track pack's block is found by its marker (trackTaskHeadingIs)
  let set = TASK_HEADINGS.get(tr);
  if (!set) {
    set = new Set(i18n.LANGS.map((l) => (i18n.msg(l).tracks.taskBlock(tr, 1).match(/^#{1,6}\s.*$/m) || [""])[0]).filter(Boolean).map(normTaskHeading));
    if (VALID_TRACKS.includes(tr)) TASK_HEADINGS.set(tr, set);
  }
  return set;
}
// Is this tasks.md heading line a track's task block heading? A track pack's is any heading carrying its marker (1.15 — the
// marker is its stable token); a built-in track's is its template heading, in any language.
function trackTaskHeadingIs(tr, line) {
  if (isPackTrack(tr)) return /^#{1,6}\s/.test(line) && line.includes(trackMarker(tr));
  return trackTaskHeadings(tr).has(normTaskHeading(line));
}
function trackTaskHeading(tr, tasksText) {
  if (!isPackTrack(tr) && !trackTaskHeadings(tr).size) return null;
  const hit = stripHtmlComments(tasksText || "").split(/\r?\n/).find((l) => /^#{1,6}\s/.test(l) && trackTaskHeadingIs(tr, l));
  return hit ? hit.replace(/^#{1,6}\s+/, "").trim() : null;
}
// tasks.md minus the task blocks of tracks that were turned off — the same rule as activeDesign: the block stays
// on disk (inactive) and counts again when the track is re-added. Progress, next task, phase, roadmap and finish
// read this; completing, tracing and briefing a task read the whole file.
function activeTasks(tasksText, tracks) {
  if (tasksText == null) return tasksText;
  const lines = tasksText.split(/\r?\n/);
  const drop = inactiveTaskLines(lines, tracks);
  return drop.size ? lines.filter((_, i) => !drop.has(i)).join("\n") : tasksText;
}
// 0-based line index → the value `owner` returned for the heading that holds it: every line under a heading
// `owner` picks (a truthy value, e.g. the turned-off track), up to the next heading of the same or a higher level.
// The ONE rule behind activeTasks / activeDesign, the gates (which need the real line numbers) and
// spec_append_tasks (which must never land in a section the other tools hide, and names its track).
function sectionDropLines(lines, owner) {
  const heads = headingIndex(lines);
  const level = (i) => lines[i].match(/^(#{1,6})/)[1].length;
  const drop = new Map();
  for (const h of heads) {
    const who = owner(lines[h]);
    if (!who) continue;
    const end = heads.find((x) => x > h && level(x) <= level(h));
    for (let i = h; i < (end == null ? lines.length : end); i++) drop.set(i, who);
  }
  return drop;
}
// tasks.md (text or lines): the template task blocks of tracks that are off (matched by their heading, in any language).
// + the task blocks of a saved track pack the project lacks now (ghostMarkers — 1.15: inactive, as a removed track's).
function inactiveTaskLines(tasks, tracks) {
  const off = markerTracks().filter((t) => !tracks.includes(t));
  const ghosts = ghostMarkers();
  if (!off.length && !ghosts.length) return new Map();
  const lines = Array.isArray(tasks) ? tasks : String(tasks).split(/\r?\n/);
  return sectionDropLines(lines, (l) => off.find((t) => trackTaskHeadingIs(t, l)) || ((ghosts.find(([, m]) => l.includes(m)) || [])[0]));
}
// design.md / requirements.md: the [SaaS] / [AI] / [SEC] / [PRIVACY] headed sections of tracks that are off (+ a track pack's
// that is off, or saved by the feature but gone from the project — ghostMarkers, 1.15).
// The marker is matched case-sensitively (C4, see headingHasMarker): `### Timeout [sec]` is never a [SEC] section.
function inactiveMarkerLines(md, tracks) {
  const off = markerTracks().filter((t) => !tracks.includes(t)).map((t) => [t, trackMarker(t)]).concat(ghostMarkers());
  if (!off.length) return new Map();
  return sectionDropLines(md.split(/\r?\n/), (l) => { const hit = off.find(([, m]) => l.includes(m)); return hit && hit[0]; });
}

// classification.md → the line under "## Active Tracks" (EN/PT/ES — the line the template generates) gets the
// new label. Only the leading track run is replaced ("core +tdd — confirmed by X" keeps its tail); a missing
// line is inserted. Returns true when the file changed.
const RE_ACTIVE_TRACKS = /^#{1,6}\s+(?:active tracks|tracks ativos|tracks activos)\s*$/i;
const trackRunSource = (names) => "^\\s*core(?:\\s+\\+(?:" + names.join("|") + "))*(?=\\s|$)";
const RE_TRACK_RUN = new RegExp(trackRunSource(OPTIONAL_TRACKS), "i");
// + the project's track packs (1.15): their names are ^[a-z][a-z0-9]{1,19}$ (validated), safe inside the alternation.
let TRACK_RUN_PACKS = { key: "", re: RE_TRACK_RUN };
function trackRunRe() {
  const p = packTracks();
  if (!p.length) return RE_TRACK_RUN;
  const key = p.join("|");
  if (TRACK_RUN_PACKS.key !== key) TRACK_RUN_PACKS = { key, re: new RegExp(trackRunSource(OPTIONAL_TRACKS.concat(p)), "i") };
  return TRACK_RUN_PACKS.re;
}

// Each mandatory section is matched by a heading containing ANY synonym (EN/PT/ES), so specs can
// be written fully in the user's language — headings included.
const SAAS_SECTIONS = [
  { name: "Performance Budget", syn: ["performance budget", "orçamento de desempenho", "orcamento de desempenho", "orçamento de performance", "presupuesto de rendimiento"] },
  { name: "Scale Design", syn: ["scale design", "design de escala", "desenho de escala", "diseño de escala", "escalabilidade", "escalabilidad"] },
  { name: "Multi-tenancy", syn: ["multi-tenancy", "multitenancy", "multi-inquilino", "multiinquilino", "multi inquilino", "multitenant", "modelo multi-inquilino", "modelo multiinquilino", "modelo de multi-inquilino",
    // pt-BR (full review Pb4 / Pb7): the Brazilian word for tenant — its scaffold writes "Modelo Multilocatário"
    "multilocatário", "multilocatario", "multi-locatário", "multi-locatario", "modelo multilocatário", "modelo multilocatario", "modelo multi-locatário"] },
  { name: "Observability", syn: ["observability", "observabilidade", "observabilidad"] },
  { name: "Cost Envelope", syn: ["cost envelope", "envelope de custo", "orçamento de custo", "sobre de coste", "presupuesto de coste"] },
];
const AI_SECTIONS = [
  { name: "Model Strategy", syn: ["model strategy", "estratégia de modelo", "estrategia de modelo"] },
  { name: "Prompt Architecture", syn: ["prompt architecture", "arquitetura de prompt", "arquitectura de prompt"] },
  { name: "Token Economics", syn: ["token economics", "economia de tokens", "economía de tokens"] },
  { name: "Latency Budget", syn: ["latency budget", "orçamento de latência", "presupuesto de latencia"] },
  { name: "Eval Strategy", syn: ["eval strategy", "estratégia de eval", "estrategia de eval", "estratégia de avaliação", "estrategia de evaluación"] },
  { name: "Safety & Abuse", syn: ["safety & abuse", "safety and abuse", "segurança e abuso", "seguridad y abuso"] },
  { name: "Fallback & Degradation", syn: ["fallback", "degradação", "degradación"] },
  { name: "Observability for AI", syn: ["observability for ai", "observabilidade de ai", "observabilidade de ia", "observabilidad de ia"] },
  { name: "Model Lifecycle", syn: ["model lifecycle", "ciclo de vida do modelo", "ciclo de vida del modelo"] },
  { name: "Multi-modality", syn: ["multi-modality", "multimodality", "multimodalidade", "multimodalidad"] },
];
// +sec (1.14) — never a bare "security" synonym: the core design's own "Security Considerations" is not a [SEC] section.
const SEC_SECTIONS = [
  { name: "Threat Model", syn: ["threat model", "modelo de ameaças", "modelo de ameacas", "modelação de ameaças", "modelacao de ameacas", "modelo de amenazas", "modelado de amenazas"] },
  { name: "Security Requirements", syn: ["security requirements", "requisitos de segurança", "requisitos de seguranca", "requisitos de seguridad"] },
  { name: "Authentication & Authorization", syn: ["authentication & authorization", "authentication and authorization", "authn & authz", "authn/authz",
    "autenticação e autorização", "autenticacao e autorizacao", "autenticación y autorización", "autenticacion y autorizacion"] },
  { name: "Secrets & Key Management", syn: ["secrets & key management", "secrets and key management", "secrets management", "secret management", "key management",
    "gestão de segredos", "gestao de segredos", "gestão de chaves", "gestión de secretos", "gestion de secretos", "gestión de claves",
    "gerenciamento de segredos", "gerenciamento de chaves"] }, // pt-BR (full review Pb4)
  { name: "Security Testing", syn: ["security testing", "security tests", "testes de segurança", "testes de seguranca", "pruebas de seguridad"] },
];
// +privacy (1.14) — GDPR / RGPD. `loose` (C4, see extractSection): the synonyms that are ordinary design words — they
// count only on a [PRIVACY] heading or under one, never on a core heading ("## Processors and queues", "## Retention").
const PRIVACY_SECTIONS = [
  { name: "Personal Data Inventory", syn: ["personal data inventory", "data inventory", "inventário de dados pessoais", "inventario de dados pessoais", "inventário de dados",
    "inventario de datos personales", "inventario de datos"], loose: ["data inventory", "inventário de dados", "inventario de datos"] },
  { name: "Lawful Basis & Purpose", syn: ["lawful basis", "legal basis", "fundamento de licitude", "fundamento jurídico", "fundamento juridico", "base de licitude",
    "base jurídica", "base juridica", "base legal", "base de legitimación", "base de legitimacion"] },
  { name: "Retention & Deletion", syn: ["retention & deletion", "retention and deletion", "retention", "data retention", "conservação e eliminação", "conservacao e eliminacao",
    "prazo de conservação", "conservação", "retenção", "retencao", "conservación y supresión", "conservacion y supresion", "plazo de conservación", "conservación", "retención", "retencion",
    "retenção e eliminação", "retencao e eliminacao", "retenção e exclusão", "retencao e exclusao"], // pt-BR (full review Pb4 / Pb7)
  loose: ["retention", "conservação", "retenção", "retencao", "conservación", "retención", "retencion"] },
  { name: "Data Subject Rights", syn: ["data subject rights", "direitos dos titulares", "direitos do titular", "derechos de los interesados", "derechos del interesado", "derechos arco"] },
  // pt-BR / LGPD (full review Pb4 / Pb7): the processor is the "operador" — an ordinary word alone (loose), the whole heading strict.
  { name: "Processors & International Transfers", syn: ["processors & international transfers", "processors and international transfers", "processors", "sub-processors",
    "international transfers", "subcontratantes", "transferências internacionais", "transferencias internacionais", "encargados del tratamiento", "transferencias internacionales",
    "operadores e transferências internacionais", "operadores e transferencias internacionais", "operadores", "suboperadores"],
  loose: ["processors", "sub-processors", "operadores", "suboperadores"] },
  // pt-BR / LGPD (full review Pb4 / Pb7): the RIPD (Relatório de Impacto à Proteção de Dados), art. 38.
  { name: "DPIA", syn: ["dpia", "data protection impact assessment", "aipd", "avaliação de impacto", "avaliacao de impacto", "eipd", "evaluación de impacto", "evaluacion de impacto",
    "ripd", "relatório de impacto à proteção de dados", "relatorio de impacto a protecao de dados", "relatório de impacto", "relatorio de impacto"],
    loose: ["avaliação de impacto", "avaliacao de impacto", "evaluación de impacto", "evaluacion de impacto", "relatório de impacto", "relatorio de impacto"] },
];
// +dist (1.17 D) — distributed systems and data consistency. `loose`: the synonyms that are ordinary design words (a core
// "## Concurrency", "## Failure modes", "## Idempotency", "## Consistency") — they name a [DIST] section only on a heading
// carrying the marker or nested under one. The cross-system writes names (dual writes) are unambiguous: strict.
const DIST_SECTIONS = [
  { name: "Consistency Model", syn: ["consistency model", "data consistency", "consistency", "modelo de consistência", "modelo de consistencia",
    "consistência de dados", "consistencia de dados", "consistencia de datos", "consistência", "consistencia"],
  loose: ["data consistency", "consistency", "consistência de dados", "consistencia de dados", "consistencia de datos", "consistência", "consistencia"] },
  { name: "Cross-system Writes", syn: ["cross-system writes", "cross-system write", "cross system writes", "dual writes", "dual write", "dual-writes",
    "escritas entre sistemas", "escrita entre sistemas", "escritas duplas", "escrita dupla", "escrituras entre sistemas", "escritura entre sistemas",
    "escrituras duales", "escritura dual", "doble escritura"] },
  { name: "Delivery & Idempotency", syn: ["delivery & idempotency", "delivery and idempotency", "idempotency", "delivery guarantees", "message delivery",
    "entrega e idempotência", "entrega e idempotencia", "idempotência", "idempotencia", "garantias de entrega", "garantías de entrega", "entrega y idempotencia"],
  loose: ["idempotency", "delivery guarantees", "message delivery", "idempotência", "idempotencia", "garantias de entrega", "garantías de entrega"] },
  { name: "Concurrency", syn: ["concurrency control", "concurrency", "controlo de concorrência", "controle de concorrência", "controle de concorrencia",
    "concorrência", "concorrencia", "control de concurrencia", "concurrencia"],
  loose: ["concurrency", "concorrência", "concorrencia", "concurrencia"] },
  // 1.17 D review: the section's own names (Failure Modes / Failure Handling — the core design's heading is "Error Handling")
  // are strict, as every other [DIST] section's are — a marker-less hand-written design with all five headings passes; the
  // singular is loose.
  { name: "Failure Modes", syn: ["failure modes", "failure mode", "failure handling", "modos de falha", "modo de falha", "modos de fallo", "modo de fallo",
    "modos de falla", "modo de falla"],
  loose: ["failure mode", "modo de falha", "modo de fallo", "modo de falla"] },
];
// +api (1.19 T) — API contracts. The core design already has "## API Contracts" (PT / ES "Contratos de API") and "## Error
// Handling": every ordinary name here is `loose` — it names an [API] section only on a heading carrying the marker or nested
// under one, so deleting "## [API] API Contract" never lets the core heading stand in for it. The full compound names stay strict.
const API_SECTIONS = [
  { name: "API Contract", syn: ["api contract", "api specification", "api spec", "contrato da api", "contrato de api", "especificação da api",
    "contrato de la api", "especificación de la api"],
  loose: ["api contract", "api specification", "api spec", "contrato da api", "contrato de api", "especificação da api", "contrato de la api",
    "especificación de la api"] },
  { name: "Versioning & Compatibility", syn: ["versioning & compatibility", "versioning and compatibility", "api versioning", "versioning", "compatibility",
    "versionamento e compatibilidade", "versionamento", "compatibilidade", "versionado y compatibilidad", "versionado", "compatibilidad"],
  loose: ["api versioning", "versioning", "compatibility", "versionamento", "compatibilidade", "versionado", "compatibilidad"] },
  { name: "Error Model", syn: ["error model", "error format", "api errors", "errors", "modelo de erros", "formato de erros", "erros da api", "erros",
    "modelo de errores", "formato de errores", "errores de la api", "errores"],
  loose: ["error format", "api errors", "errors", "formato de erros", "erros da api", "erros", "formato de errores", "errores de la api", "errores"] },
  { name: "Pagination, Idempotency & Concurrency", syn: ["pagination, idempotency & concurrency", "pagination, idempotency and concurrency", "pagination",
    "paginação, idempotência e concorrência", "paginação", "paginación, idempotencia y concurrencia", "paginación"],
  loose: ["pagination", "paginação", "paginación"] },
  { name: "Rate Limits & Quotas", syn: ["rate limits & quotas", "rate limits and quotas", "rate limits", "rate limiting", "quotas",
    "limites de taxa e quotas", "limites de taxa e cotas", "limites de taxa", "cotas", "límites de tasa y cuotas", "límites de tasa", "cuotas"],
  loose: ["rate limits", "rate limiting", "quotas", "limites de taxa", "cotas", "límites de tasa", "cuotas"] },
];
// +ui (1.19 T) — user-facing UI. Every ordinary name is `loose` (marker-bound): a core "## Accessibility" or "## States" note, or
// +saas's "## [SaaS] Performance Budget", never stands in for a deleted [UI] section; the full names stay strict.
const UI_SECTIONS = [
  { name: "Design System Usage", syn: ["design system usage", "design system", "component inventory", "uso do design system", "sistema de design",
    "inventário de componentes", "uso del design system", "sistema de diseño", "inventario de componentes"],
  loose: ["design system", "component inventory", "sistema de design", "inventário de componentes", "sistema de diseño", "inventario de componentes"] },
  { name: "UI States", syn: ["ui states", "view states", "states", "estados da interface", "estados da ui", "estados de la interfaz", "estados de la ui", "estados"],
  loose: ["view states", "states", "estados"] },
  { name: "Accessibility", syn: ["accessibility", "a11y", "acessibilidade", "accesibilidad"], loose: ["accessibility", "a11y", "acessibilidade", "accesibilidad"] },
  { name: "Responsiveness & i18n", syn: ["responsiveness & i18n", "responsiveness and i18n", "responsiveness", "responsive design", "internationalization",
    "internationalisation", "i18n", "design responsivo e i18n", "design responsivo", "responsividade", "internacionalização", "diseño adaptable e i18n",
    "diseño adaptable", "diseño responsivo", "internacionalización"],
  loose: ["responsiveness", "responsive design", "internationalization", "internationalisation", "i18n", "design responsivo", "responsividade",
    "internacionalização", "diseño adaptable", "diseño responsivo", "internacionalización"] },
  { name: "UI Performance Budget", syn: ["ui performance budget", "web performance budget", "front-end performance", "frontend performance", "core web vitals",
    "performance budget", "orçamento de desempenho da interface", "orçamento de desempenho", "presupuesto de rendimiento de la interfaz",
    "presupuesto de rendimiento"],
  loose: ["front-end performance", "frontend performance", "core web vitals", "performance budget", "orçamento de desempenho", "presupuesto de rendimiento"] },
];
// +obs (1.19 T) — observability & operability. No name is "Observability" (+saas's section); every ordinary name is `loose`
// (marker-bound) — a core "## Rollback" or "## Alerts" note never stands in for a deleted [OBS] section; the full names stay strict.
const OBS_SECTIONS = [
  { name: "SLIs & SLOs", syn: ["slis & slos", "slis and slos", "sli & slo", "service level objectives", "slos", "slo", "error budget", "slis e slos",
    "objetivos de nível de serviço", "slis y slos", "objetivos de nivel de servicio"],
  loose: ["service level objectives", "slos", "slo", "error budget", "objetivos de nível de serviço", "objetivos de nivel de servicio"] },
  { name: "Telemetry", syn: ["telemetry", "instrumentation", "metrics, logs & traces", "metrics, logs and traces", "telemetria", "instrumentação", "telemetría",
    "instrumentación"],
  loose: ["telemetry", "instrumentation", "metrics, logs & traces", "metrics, logs and traces", "telemetria", "instrumentação", "telemetría", "instrumentación"] },
  { name: "Alerting & Runbooks", syn: ["alerting & runbooks", "alerting and runbooks", "alerting", "alerts", "runbooks", "alertas e runbooks", "alertas y runbooks",
    "alertas"],
  loose: ["alerting", "alerts", "runbooks", "alertas"] },
  { name: "Rollout & Rollback", syn: ["rollout & rollback", "rollout and rollback", "rollout", "rollback", "release strategy", "lançamento e reversão", "rollout e rollback",
    "despliegue y reversión", "rollout y rollback"],
  loose: ["rollout", "rollback", "release strategy"] },
  { name: "Health & Capacity", syn: ["health & capacity", "health and capacity", "health checks", "capacity", "saúde e capacidade", "verificações de saúde",
    "capacidade", "salud y capacidad", "comprobaciones de salud", "capacidad"],
  loose: ["health checks", "capacity", "verificações de saúde", "capacidade", "comprobaciones de salud", "capacidad"] },
];
// The marker tracks' mandatory design sections — the ONE table doctor, approve, status, the roadmap and the design-save
// check read (a marker track = a TRACK_MARKER entry + its table here).
const TRACK_SECTIONS = { saas: SAAS_SECTIONS, ai: AI_SECTIONS, sec: SEC_SECTIONS, privacy: PRIVACY_SECTIONS, dist: DIST_SECTIONS, api: API_SECTIONS, ui: UI_SECTIONS, obs: OBS_SECTIONS };
// [[track, sections, marker]] for the ACTIVE marker tracks, in track order.
function activeSectionTracks(tracks) {
  return markerTracks().filter((t) => tracks.includes(t)).map((t) => [t, trackSectionTable(t), trackMarker(t)]); // + the track packs (1.15)
}

// design.md minus the [SaaS]/[AI] sections of tracks that were turned off (their text stays, inactive).
// Also applied to requirements.md, whose +saas/+ai template criteria sit under [SaaS]/[AI] headings.
function activeDesign(design, tracks) {
  const drop = inactiveMarkerLines(design, tracks);
  return drop.size ? design.split(/\r?\n/).filter((_, i) => !drop.has(i)).join("\n") : design;
}

module.exports = { VALID_TRACKS, OPTIONAL_TRACKS, TRACK_STEERING, trackTokens, parseTracks, normalizeTracks,
  TRACK_ALIASES, suggestTrack, unknownTracksError, trackLabel, SIGNALS, conceptMap, SIGNAL_CONCEPTS, SIGNAL_HAZARDS,
  NEGATORS, NEG_FILLER, NEG_FILLER_EN, NEG_AFTER, W, PT_STRONG, PT_STRONG_CHARS, PT_WEAK, ES_STRONG, ES_STRONG_CHARS,
  ES_WEAK, EN_WORDS, CLAUSE_START, INF_WORDS, INF, PT_INF, ES_INF, PTES_INF, ES_NO_INF, guessLang, configuredLang,
  isNegated, STEMS, VERB_STEMS, IRREGULAR_FORMS, KW_GAP, KW_GAP_RE, INFLECTION, ACRONYM_INFLECTION, ADJ_SUFFIX, KW_RE,
  pluralize, KW_LITERAL, KW_CACHE_MAX, KW_PLAIN, keywordLiteral, keywordRe, keywordPattern, PATH_HEADS, splitWordPairs,
  classify, buildReasoning, TRACK_PACKS_DIR, PACK_JSON, PACK_FRAGMENTS, PACK_LIMITS, RE_PACK_NAME, RE_PACK_MARKER,
  RE_PACK_MARKER_RESERVED, RE_PACK_KEYWORD, PACK_KEYS, PACK_SECTION_KEYS, PACK_TIERS, PACK_RESERVED_WORDS,
  packReservedName, RE_PACK_ITEM, RE_TABLE_SEPARATOR, packTextOk, packGuidanceOk, stripJsonComments, packScan,
  readPackItem, packListItems, packTableRows, RE_PACK_VAR, RE_PACK_GUIDANCE_VAR, packSectionKey, coreDesignHeadingKeys,
  packVarRefs, parsePackFragment, packLocalized, PACK_CACHE, loadPack, loadPackScan, loadTrackPacks, NO_PACKS,
  packRegistry, packTracks, packOf, isPackTrack, allTracks, optionalTracks, markerTracks, trackMarker,
  trackSectionTable, trackSteeringFiles, trackSignalTable, isPackMarkerBracket, packMarkersFor, noteGhostPacks,
  ghostMarkers, savedPackName, legacyPackName, TRACK_RESERVED_SINCE, packReservedSince, missingPackTracks, packLocal, packTitle, packFragment, packSubst,
  packCtx, packSubstBasic, packDesignBlock, packRequirementsBlock, insertPackRequirements, packPlanRows, packTaskBlock,
  packTestRowsBlock, packChecklistBlock, packSteeringStub, trackSteeringStub, RE_PACK_WILD_VAR, RE_PACK_WILD_VAR_G,
  PACK_CORPUS_CACHE, packCorpusSets, localizePackProblem, trackPacks, listTrackPacks, checkTrackPacks, initTrackPack,
  detectTracks, savedTracks, headingHasMarker, TRACK_MARKER, MARKER_TRACKS, trackAcIds, normTaskHeading, TASK_HEADINGS,
  trackTaskHeadings, trackTaskHeadingIs, trackTaskHeading, activeTasks, sectionDropLines, inactiveTaskLines,
  inactiveMarkerLines, RE_ACTIVE_TRACKS, trackRunSource, RE_TRACK_RUN, trackRunRe, SAAS_SECTIONS, AI_SECTIONS,
  SEC_SECTIONS, PRIVACY_SECTIONS, DIST_SECTIONS, API_SECTIONS, UI_SECTIONS, OBS_SECTIONS, TRACK_SECTIONS, activeSectionTracks, activeDesign, __link };
