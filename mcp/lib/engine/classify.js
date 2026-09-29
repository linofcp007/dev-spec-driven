"use strict";

/**
 * dev-spec-driven engine — the heuristic track classifier.
 * Phase 0: keyword signals (EN / PT / ES), negation, the language guess — local, no model, no cost.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let allTracks, newProjectLang, normalizeLang, OPTIONAL_TRACKS, optionalTracks, readRoadmap, specsRoot, trackLabel,
  trackSignalTable;
function __link(E) { ({ allTracks, newProjectLang, normalizeLang, OPTIONAL_TRACKS, optionalTracks, readRoadmap,
  specsRoot, trackLabel, trackSignalTable } = E); }

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

module.exports = { SIGNALS, conceptMap, SIGNAL_CONCEPTS, SIGNAL_HAZARDS, NEGATORS, NEG_FILLER, NEG_FILLER_EN, NEG_AFTER,
  W, PT_STRONG, PT_STRONG_CHARS, PT_WEAK, ES_STRONG, ES_STRONG_CHARS, ES_WEAK, EN_WORDS, CLAUSE_START, INF_WORDS, INF,
  PT_INF, ES_INF, PTES_INF, ES_NO_INF, guessLang, configuredLang, isNegated, STEMS, VERB_STEMS, IRREGULAR_FORMS, KW_GAP,
  KW_GAP_RE, INFLECTION, ACRONYM_INFLECTION, ADJ_SUFFIX, KW_RE, pluralize, KW_LITERAL, KW_CACHE_MAX, KW_PLAIN,
  keywordLiteral, keywordRe, keywordPattern, PATH_HEADS, splitWordPairs, classify, buildReasoning, __link };
