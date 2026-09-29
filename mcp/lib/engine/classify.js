"use strict";

/**
 * dev-spec-driven engine — the Phase 0 classifier.
 * Local and keyword based (no model, no cost): the keyword machinery (word-bounded regexes, inflections, stems, gap keywords),
 * negation, shadowing, the context / generic tiers and concepts, the cue rules, the language guess (guessLang) — over the
 * built-in tracks' SIGNALS (tracks.js) and the project's track packs' keywords (packs.js).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let allTracks, newProjectLang, normalizeLang, OPTIONAL_TRACKS, optionalTracks, readRoadmap, SIGNAL_CONCEPTS,
  SIGNAL_HAZARDS, SIGNALS, specsRoot, trackLabel, trackSignalTable;
function __link(E) { ({ allTracks, newProjectLang, normalizeLang, OPTIONAL_TRACKS, optionalTracks, readRoadmap,
  SIGNAL_CONCEPTS, SIGNAL_HAZARDS, SIGNALS, specsRoot, trackLabel, trackSignalTable } = E); }

// ---------------------------------------------------------------------------
// Heuristic classifier (local, keyword based — no LLM, no cost)
// ---------------------------------------------------------------------------

// CUES (1.19 T review) — a built-in keyword whose tier depends on the words around it: SIGNAL_CUES[track](hit, text, cased, lang) → a new
// tier ("strong" / "weak" / "generic"), "none" (no signal at all) or null (unchanged). Built-in tracks only (a track pack's keywords
// are its own). Every rule reads a BOUNDED window around the hit (its clause / sentence, ≤ CUE_SPAN characters each way) with
// linear regexes — the classifier stays linear in the text.
const CUE_SPAN = 200;
const CUE_BOUNDARY = /[.!?;:\n]/;
const SENTENCE_BOUNDARY = /[.!?\n]/;
// The text before the hit, back to its clause start (. ! ? ; : or a line break — `bound` picks the set), at most CUE_SPAN characters.
function cueBefore(s, start, bound) {
  const from = Math.max(0, start - CUE_SPAN);
  let i = start - 1;
  while (i >= from && !bound.test(s[i])) i--;
  return s.slice(i + 1, start);
}
function cueAfter(s, end, bound) {
  const to = Math.min(s.length, end + CUE_SPAN);
  let i = end;
  while (i < to && !bound.test(s[i])) i++;
  return s.slice(end, i);
}
const cueWords = (s) => s.match(/[\p{L}\p{N}'’-]+/gu) || [];
// The hit's CLAUSE (1.19 verify 1): the text between the CUE_BOUNDARY characters around it (≤ CUE_SPAN each way) → {from, to} —
// except that a colon after a short LABEL (≤ CUE_LABEL_WORDS words: "Profile page: the GET /me handler…", "Sin backend: nueva
// página…") joins the label to the clause it introduces, in either direction (a label is the topic of what follows it).
const CUE_LABEL_WORDS = 4;
function cueClause(s, start, end) {
  const from = Math.max(0, start - CUE_SPAN), to = Math.min(s.length, end + CUE_SPAN);
  let a = start - 1;
  while (a >= from && !CUE_BOUNDARY.test(s[a])) a--;
  let b = end;
  while (b < to && !CUE_BOUNDARY.test(s[b])) b++;
  if (a >= from && s[a] === ":") { // the clause opens after a colon: a short label before it belongs to it
    let p = a - 1;
    while (p >= from && !CUE_BOUNDARY.test(s[p])) p--;
    if (cueWords(s.slice(p + 1, a)).length <= CUE_LABEL_WORDS) a = p;
  }
  if (b < to && s[b] === ":" && cueWords(s.slice(a + 1, b)).length <= CUE_LABEL_WORDS) { // the clause IS a label: what it introduces joins
    let q = b + 1;
    while (q < to && !CUE_BOUNDARY.test(s[q])) q++;
    b = q;
  }
  return { from: a + 1, to: b };
}

// +api — who owns the API (see SIGNALS.api). A third party named at the API phrase always makes it someone else's; a consumer verb
// does unless the clause says the API is ours; an ownership-ambiguous name is strong only beside an own cue.
const API_AMBIGUOUS = new Set(["public api", "rest api", "http api", "web api", "json api", "partner api", "api version", "problem details",
  "api pública", "api rest", "versão da api", "versões da api", "versión de la api", "versiones de la api"]);
const API_KIND = new Set(["public api", "rest api", "http api", "web api", "json api", "partner api", "api pública", "api rest"]);
const API_OWN_NAMES = new Set(["internal api", "api interna", "management api", "admin api"]); // ours by name — never consumed by a verb
const API_THIRD_PARTY = new Set(["provider", "providers", "supplier", "suppliers", "vendor", "vendors", "partner", "partners", "bank", "banks",
  "carrier", "carriers", "courier", "couriers", "merchant", "merchants", "third-party", "fornecedor", "fornecedores", "parceiro", "parceiros",
  "banco", "bancos", "transportadora", "transportadoras", "provedor", "provedores", "terceiros", "proveedor", "proveedores", "socio", "socios",
  "transportista", "transportistas", "terceros"]);
const API_OWN_WORDS = new Set(["our", "ours", "own", "nosso", "nossa", "nossos", "nossas", "próprio", "própria", "nuestro", "nuestra",
  "nuestros", "nuestras", "propio", "propia"]);
const RE_API_OWN_VERB = /^(?:expos(?:e|es|ed|ing)|publish(?:es|ed|ing)?|offer(?:s|ed|ing)?|provid(?:e|es|ed|ing)|design(?:s|ed|ing)?|document(?:s|ed|ing)?|deprecat\p{L}*|expor|expõe|expõem|expomos|publicar|publica|publicam|publicamos|disponibiliz\p{L}*|oferecer|oferece|oferecem|oferecemos|versionar|versiona|versionam|versionamos|desenhar|projetar|documentar|documenta|documentam|descontinuar|exponer|expone|exponen|exponemos|ofrecer|ofrece|ofrecen|ofrecemos|proporcionar|proporciona|diseñar|diseña|deprecar)$/u;
// A build verb is an own cue only when the API phrase is its direct object ("Build a REST API", "Criar uma API REST pública") —
// never "Create payment intents via the Stripe REST API".
const RE_API_BUILD_VERB = /^(?:build|builds|building|create|creates|creating|implement|implements|implementing|develop|develops|developing|ship|construir|constrói|criar|cria|implementar|implementa|desenvolver|desenvolve|crear|crea|desarrollar|desarrolla)$/u;
const API_ARTICLES = new Set(["a", "an", "the", "this", "um", "uma", "o", "un", "una", "el", "la"]);
// A consumer verb counts only when it governs the API phrase — between them nothing but these link words, Titlecase names and at
// most one other word ("Integrate with the Salesforce REST API", "Retry calls to the PayPal REST API", "Llamar a la API REST del
// banco") — never "the order service calls the payment service over gRPC" (the verb's object is the service).
const API_LINK_WORDS = new Set([...API_ARTICLES, "its", "their", "that", "os", "as", "los", "las", "seu", "sua", "seus", "suas", "su", "sus",
  "with", "to", "from", "into", "via", "through", "on", "com", "ao", "à", "aos", "às", "do", "da", "dos", "das", "de", "del", "con", "al", "en"]);
const RE_API_CONSUMER_VERB = /^(?:call|calls|called|calling|consume|consumes|consumed|consuming|integrate|integrates|integrated|integrating|integration|integrations|sync|syncs|synced|syncing|synchroni[sz]\p{L}*|via|through|connect|connects|connected|connecting|fetch|fetches|fetched|fetching|pull|pulls|pulled|pulling|poll|polls|polled|polling|integrar|integra|integram|integração|integrações|chamar|chama|chamam|chamada|chamadas|consumir|consome|consomem|sincronizar|sincroniza|sincronizam|através|buscar|busca|consultar|consulta|obter|obtém|vía|integran|integración|integraciones|llamar|llama|llaman|llamada|llamadas|consumen|sincronizan|través|conectar|conecta|conectan|obtener|obtiene)$/u;
function consumerVerbGoverns(before, lower) {
  let other = 0;
  for (let i = lower.length - 1; i >= 0 && i >= lower.length - 8; i--) {
    if (RE_API_CONSUMER_VERB.test(lower[i])) return true;
    if (API_LINK_WORDS.has(lower[i]) || RE_TITLECASE.test(before[i])) continue;
    if (++other > 1) return false;
  }
  return false;
}
// words that look like an owner but aren't one ("It's", "the Public REST API", "the New API version")
const API_NOT_OWNER = new Set(["it", "that", "there", "here", "what", "let", "he", "she", "who", "public", "private", "internal", "external",
  "new", "old", "legacy", "current", "next", "main", "core", "our", "admin", "management", "rest", "http", "json", "web", "open", "the"]);
const RE_POSSESSIVE = /^(.+?)(?:['’]s|s['’])$/u;
const RE_TITLECASE = /^\p{Lu}\p{Ll}/u;
const RE_API_OWNER_AFTER = /^\s+(?:of|do|da|dos|das|de|del)(?:\s+(?:the|la|el|los|las|o|a|os|as))?\s+([\p{L}][\p{L}\p{N}-]*)/u;
// (1.19 verify 2) an ALL-CAPS owner — an organisation's acronym ("the ECB's public API", "la API pública del BCE", "a API do INE") — is
// a third party too; a technical acronym never names one ("the REST API of the CRM", "the public API of the SDK")
const RE_API_ACRONYM = /^\p{Lu}{2,6}$/u;
const API_TECH_ACRONYMS = new Set(["api", "apis", "rest", "http", "https", "json", "xml", "yaml", "soap", "rpc", "sdk", "cli", "crm", "erp", "cms",
  "lms", "dms", "pos", "mvp", "ui", "ux", "gui", "spa", "pwa", "iot", "etl", "saas", "paas", "iaas", "sso", "jwt", "oauth", "oidc", "ldap",
  "url", "uri", "sql", "db", "pdf", "csv", "qa", "ci", "cd", "ai", "ml", "llm", "sms", "mfa", "otp", "crud", "id", "ids", "app", "web", "os",
  "ios", "kpi", "smtp", "ftp", "sftp", "tcp", "udp", "dns", "cdn", "vpn", "b2b", "b2c", "hr", "rh", "rrhh", "ti"]);
// (1.19 verify 2) a past participle right after a determiner is an adjective, never an own verb: "Replace the deprecated Google
// Places API calls", "the documented Stripe API"
const API_DETERMINERS = new Set(["a", "an", "the", "this", "that", "these", "those", "its", "their", "his", "her", "any", "some", "every"]);
function apiCueTier(h, text, cased) {
  const before = cueWords(cueBefore(cased, h.start, CUE_BOUNDARY));
  const lower = before.map((w) => w.toLowerCase());
  const last3 = before.slice(-3);
  const owner = (w) => !API_NOT_OWNER.has(w.toLowerCase()) && (RE_TITLECASE.test(w) || API_THIRD_PARTY.has(w.toLowerCase()) ||
    (RE_API_ACRONYM.test(w) && !API_TECH_ACRONYMS.has(w.toLowerCase())));
  // a third party named at the API phrase: "Stripe's REST API", "the provider's OpenAPI spec", "their API", "a API REST do Stripe"
  const possessed = last3.some((w) => { const m = RE_POSSESSIVE.exec(w); return !!m && owner(m[1]); }) || lower.slice(-3).includes("their");
  const post = RE_API_OWNER_AFTER.exec(cased.slice(h.end, Math.min(cased.length, h.end + 60)));
  if (possessed || (post && owner(post[1]))) return "generic";
  const n = lower.length;
  const ownVerb = (w, i) => RE_API_OWN_VERB.test(w) && !(/ed$/.test(w) && i > 0 && API_DETERMINERS.has(lower[i - 1]));
  const own = lower.slice(-3).some((w) => API_OWN_WORDS.has(w)) || lower.some(ownVerb) ||
    (n > 0 && lower[0] === "version") ||
    (n > 0 && RE_API_BUILD_VERB.test(lower[n - 1])) || (n > 1 && API_ARTICLES.has(lower[n - 1]) && RE_API_BUILD_VERB.test(lower[n - 2]));
  if (!own && !API_OWN_NAMES.has(h.kw)) {
    // a consumer verb governing the API phrase ("Integrate with the Salesforce REST API", "Book the courier through the partner API")
    if (consumerVerbGoverns(before, lower)) return "generic";
    // "the <Name> <API phrase>" — "the Shopify API version", "the Google Maps JSON API"
    let k = before.length;
    while (k > 0 && before.length - k < 3 && RE_TITLECASE.test(before[k - 1]) && !API_NOT_OWNER.has(before[k - 1].toLowerCase())) k--;
    if (k < before.length && k > 0 && lower[k - 1] === "the") return "generic";
  }
  if (!API_AMBIGUOUS.has(h.kw)) return null;
  if (own) return "strong";
  // an API-kind name with no owner named is ours when it opens its clause or follows a plain determiner, adjectives allowed ("REST
  // API for the mobile app…", "Add rate limiting to the public API", "a versioned REST API", "Uma API pública para os parceiros"):
  // a third party's is named first ("Stripe REST API integration", "the shipping provider REST API" stay weak)
  if (!API_KIND.has(h.kw)) return null;
  let j = n, adj = 0;
  while (j > 0 && adj < 2 && /^\p{Ll}+$/u.test(before[j - 1]) && !API_LINK_WORDS.has(lower[j - 1]) && !API_THIRD_PARTY.has(lower[j - 1])) { j--; adj++; }
  return j === 0 || API_ARTICLES.has(lower[j - 1]) ? "strong" : null;
}

// +ui — a page type / the frontend words in a sentence that says the work is backend-only; an empty state in a state machine.
const UI_PAGE_WORDS = new Set(["landing page", "settings page", "settings screen", "admin page", "admin panel", "admin ui", "management page",
  "profile page", "account page", "página de definições", "página de configurações", "página de administração", "painel de administração",
  "página de gestão", "página de perfil", "ecrã de definições", "tela de configurações", "página de ajustes", "página de configuración",
  "panel de administración", "página de gestión", "pantalla de ajustes", "frontend", "front-end", "UI", "UX"]);
const UI_EMPTY_STATE = new Set(["empty state", "estado vazio", "estado vacío"]);
const RE_UI_BACKEND = /(?<![\p{L}\p{N}_])(?:(?:get|post|put|patch|delete)[^\S\n]+(?:\/|(?:handlers?|endpoints?|routes?)(?![\p{L}\p{N}_]))|(?:request handlers?|route handlers?|endpoints?|back-?end|data layer|repositor(?:y|ies)|sql|server-side|already exists?|já existe|ya existe|camada de dados|capa de datos)(?![\p{L}\p{N}_])|(?<!(?:chaves?|claves?)[^\S\n]+(?:de|da|del)[^\S\n]+)apis?(?![\p{L}\p{N}_])(?![^\S\n]+(?:keys?|tokens?)(?![\p{L}])))/gu;
const RE_UI_STATE_MACHINE = /(?<![\p{L}])(?:state[- ]machines?|state transitions?|máquinas? de estados?|transiç(?:ão|ões) de estados?|transici(?:ón|ones) de estados?)(?![\p{L}])/u;
// 1.19 verify 1 — the backend cue reads the page word's CLAUSE (cueClause), never the whole sentence ("Redesign the admin panel;
// the backend team will add the endpoints later"), and a backend word does not count when
// - a negator governs it (≤ UI_NEG_WINDOW words before it in the clause: "no backend changes", "does not touch the backend",
//   "needs no API changes", "sem backend", "sin backend" — PT "no" is em + o, never a negator), or
// - the page CONSUMES it: it follows the page word, a consumer verb between them ("The landing page loads its testimonials from
//   the CMS API") — a backend word before the page ("a PATCH handler that the settings page calls") or right after it ("the
//   profile page backend", "the admin page's API") still says the work is backend-only;
// and nothing is demoted where the text says the work is frontend-only ("Frontend only, …", "Apenas frontend", "Solo frontend").
// "the frontend team" / "a equipa de frontend" names a team, not UI work: generic.
const UI_NEG_WINDOW = 4;
const UI_NEGATORS = new Set(["no", "not", "without", "never", "nor", "none", "sem", "não", "nao", "nem", "nunca", "sin", "ni"]);
const UI_CONSUMER_VERBS = new Set(["load", "loads", "loaded", "loading", "fetch", "fetches", "fetched", "fetching", "call", "calls", "called",
  "calling", "consume", "consumes", "consumed", "consuming", "read", "reads", "reading", "pull", "pulls", "pulled", "pulling", "get", "gets",
  "getting", "query", "queries", "queried", "querying", "use", "uses", "used", "using", "submit", "submits", "submitted", "submitting",
  "send", "sends", "sending", "post", "posts", "posted", "posting",
  "carrega", "carregam", "carregar", "busca", "buscam", "buscar", "chama", "chamam", "chamar", "consome", "consomem", "consumir", "lê",
  "leem", "ler", "obtém", "obtêm", "obter", "usa", "usam", "usar", "utiliza", "utilizam", "utilizar", "envia", "enviam", "enviar", "consulta",
  "consultam", "consultar",
  "carga", "cargan", "cargar", "obtiene", "obtienen", "obtener", "llama", "llaman", "llamar", "consumen", "lee", "leen", "leer", "usan",
  "envía", "envían", "consultan", "buscan"]);
const UI_FRONTEND_WORDS = new Set(["frontend", "front-end"]);
const RE_UI_TEAM_AFTER = /^[^\S\n]*(?:teams?|developers?|devs?|engineers?|squads?)(?![\p{L}])/u;
const RE_UI_TEAM_BEFORE = /(?<![\p{L}])(?:equipas?|equipes?|equipos?)[^\S\n]+(?:de|do|del)[^\S\n]+$/u;
const RE_UI_FRONTEND_ONLY = /(?<![\p{L}\p{N}_])(?:front-?end[- ]only|only[^\S\n]+(?:the[^\S\n]+)?front-?end|(?:apenas|só|somente|unicamente)[^\S\n]+(?:o[^\S\n]+)?front-?end|(?:solo|sólo|solamente|únicamente)[^\S\n]+(?:el[^\S\n]+)?front-?end)(?![\p{L}\p{N}_])/u;
// one test per classified text, not per page word (the classifier stays linear in the text)
let uiFrontendOnlyText = null;
let uiFrontendOnlyAnswer = false;
function uiFrontendOnly(text) {
  if (text !== uiFrontendOnlyText) { uiFrontendOnlyText = text; uiFrontendOnlyAnswer = RE_UI_FRONTEND_ONLY.test(text); }
  return uiFrontendOnlyAnswer;
}
function uiBackendInClause(h, text, lang) {
  const c = cueClause(text, h.start, h.end);
  const clause = text.slice(c.from, c.to);
  const pt = i18n.baseLang(lang || "en") === "pt";
  // where the first consumer verb after the page word ends (a backend word after it is consumed) — one pass over the clause
  let consumedFrom = Infinity;
  const RE_WORD = /[\p{L}\p{N}'’-]+/gu;
  const tail = text.slice(h.end, c.to);
  let w;
  while ((w = RE_WORD.exec(tail)) !== null) if (UI_CONSUMER_VERBS.has(w[0].toLowerCase())) { consumedFrom = h.end + w.index + w[0].length; break; }
  RE_UI_BACKEND.lastIndex = 0;
  let m;
  while ((m = RE_UI_BACKEND.exec(clause)) !== null) {
    const at = c.from + m.index;
    if (at < h.end && at + m[0].length > h.start) continue; // (never the hit itself)
    // the words just before it (a bounded look-back: UI_NEG_WINDOW words fit in 80 characters but for very long words)
    const before = cueWords(text.slice(Math.max(c.from, at - 80), at)).slice(-UI_NEG_WINDOW).map((x) => x.toLowerCase());
    if (before.some((x) => (UI_NEGATORS.has(x) && !(pt && x === "no")) || /n['’]t$/.test(x))) continue;
    if (at >= consumedFrom) continue;
    return true;
  }
  return false;
}
// "the UI / the interface / the form already exists" speaks for its whole sentence (the backend words stay clause-bound: "the
// endpoint already exists; redesign the settings page" is UI work)
const RE_UI_ALREADY = /(?<![\p{L}\p{N}_])(?:ui|ux|user interface|interface|interfaz|front-?end|form|formulário|formulario)[^\S\n]+(?:itself[^\S\n]+|em si[^\S\n]+|en sí[^\S\n]+)?(?:already exists?|já existe|ya existe)(?![\p{L}\p{N}_])/u;
function uiCueTier(h, text, cased, lang) {
  const isPage = UI_PAGE_WORDS.has(h.kw), isEmpty = UI_EMPTY_STATE.has(h.kw);
  if (!isPage && !isEmpty) return null;
  const sentence = () => cueBefore(text, h.start, SENTENCE_BOUNDARY) + text.slice(h.start, h.end) + cueAfter(text, h.end, SENTENCE_BOUNDARY);
  if (isEmpty) return h.tier === "strong" && RE_UI_STATE_MACHINE.test(sentence()) ? "weak" : null;
  if (UI_FRONTEND_WORDS.has(h.kw) && (RE_UI_TEAM_AFTER.test(text.slice(h.end, h.end + 20)) || RE_UI_TEAM_BEFORE.test(text.slice(Math.max(0, h.start - 20), h.start)))) return "generic";
  if (uiFrontendOnly(text)) return null;
  return uiBackendInClause(h, text, lang) || RE_UI_ALREADY.test(sentence()) ? "generic" : null;
}

// +obs — "customer service", "room service", "service level", "serviço ao cliente", "servicio al cliente" are no technical target.
const OBS_SERVICE_WORDS = new Set(["service", "serviço", "servicio"]);
const RE_OBS_NOT_TARGET_BEFORE = /(?:customer|client|room|table|field|after-sales|delivery)[^\S\n]*$/u;
const RE_OBS_NOT_TARGET_AFTER = /^(?:s|es)?[^\S\n]+(?:level|ao cliente|a clientes|de atendimento|al cliente|de atención)(?![\p{L}])/u;
function obsCueTier(h, text) {
  if (!OBS_SERVICE_WORDS.has(h.kw)) return null;
  return RE_OBS_NOT_TARGET_BEFORE.test(text.slice(Math.max(0, h.start - 20), h.start)) || RE_OBS_NOT_TARGET_AFTER.test(text.slice(h.start + h.kw.length, h.end + 30))
    ? "none" : null;
}
const SIGNAL_CUES = { api: apiCueTier, ui: uiCueTier, obs: obsCueTier };

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
  // CUES (1.19 T review — SIGNAL_CUES): a built-in keyword whose tier depends on the words around it ("Stripe's REST API" is
  // app-level for us, "the settings page backend" is no UI work, "customer service" no technical target).
  const counted = [];
  for (const h of hits) {
    if (shadowedHits.has(h)) continue;
    const cue = Object.prototype.hasOwnProperty.call(SIGNAL_CUES, h.track) && Object.prototype.hasOwnProperty.call(SIGNALS, h.track) ? SIGNAL_CUES[h.track] : null;
    const tier = cue ? cue(h, text, cased, lang) : null;
    if (tier === "none") continue;
    counted.push(tier && tier !== h.tier ? Object.assign({}, h, { tier }) : h);
  }
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

module.exports = { SIGNAL_CUES, NEGATORS, NEG_FILLER, NEG_FILLER_EN, NEG_AFTER, W, PT_STRONG, PT_STRONG_CHARS, PT_WEAK,
  ES_STRONG, ES_STRONG_CHARS, ES_WEAK, EN_WORDS, CLAUSE_START, INF_WORDS, INF, PT_INF, ES_INF, PTES_INF, ES_NO_INF,
  guessLang, configuredLang, isNegated, STEMS, VERB_STEMS, IRREGULAR_FORMS, KW_GAP, KW_GAP_RE, INFLECTION,
  ACRONYM_INFLECTION, ADJ_SUFFIX, KW_RE, pluralize, KW_LITERAL, KW_CACHE_MAX, KW_PLAIN, keywordLiteral, keywordRe,
  keywordPattern, PATH_HEADS, splitWordPairs, classify, buildReasoning, __link };
