"use strict";

/**
 * dev-spec-driven engine — the track registries.
 * The built-in tracks and every table a track brings: VALID_TRACKS, the aliases people type, the stable markers, the mandatory
 * design sections (TRACK_SECTIONS), the steering files and the classifier's signals (SIGNALS — one object per track: its keyword
 * tiers, concepts, hazards and cue rules, the DATA classify.js interprets); track input (parseTracks); the accessors that add the
 * project's track packs (allTracks, trackMarker, trackSectionTable…); a feature's saved tracks (detectTracks) and the
 * inactive-section readers (activeTasks, activeDesign).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, existsCached, ghostMarkers, headingIndex, isPackTrack, legacyPackName, noteGhostPacks, packOf, packTracks,
  readIfExists, readJson, savedPackName, statePath, stripHtmlComments, useTemplateScopeOf;
function __link(E) { ({ acIndex, existsCached, ghostMarkers, headingIndex, isPackTrack, legacyPackName, noteGhostPacks,
  packOf, packTracks, readIfExists, readJson, savedPackName, statePath, stripHtmlComments, useTemplateScopeOf } = E); }

const VALID_TRACKS = ["core", "tdd", "saas", "ai", "sec", "privacy", "dist", "api", "ui", "obs", "data"];
// The optional, composable tracks (core is always on) — the classifier's, add_track's and every per-track loop's list.
// Adding a track: VALID_TRACKS + its classifier SIGNALS; a MARKER track (mandatory design sections under a stable
// [Marker]) also needs TRACK_MARKER, a sections table in TRACK_SECTIONS, TRACK_STEERING and its i18n builders
// (requirements criteria, design block, template tasks, test rows, steering stub).
const OPTIONAL_TRACKS = VALID_TRACKS.filter((t) => t !== "core");
// The steering files a track brings (spec_init / add_track write them, the task brief lists them).
const TRACK_STEERING = { tdd: ["testing-standards.md"], saas: ["scale.md", "observability.md", "cost.md"], ai: ["ai-strategy.md"], sec: ["security.md"], privacy: ["privacy.md"],
  dist: ["distributed.md"], api: ["api.md"], ui: ["ui.md"], obs: ["observability.md"], data: ["data.md"] };

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
  observability: "obs", o11y: "obs", monitoring: "obs", sre: "obs", telemetry: "obs", opentelemetry: "obs",
  // +data (1.21 F4) — never "analytics": a team's product-analytics pack (a tracking plan, event names) is another concern and keeps its name
  etl: "data", elt: "data", pipeline: "data", pipelines: "data", warehouse: "data", datawarehouse: "data", lakehouse: "data", dbt: "data",
  dataquality: "data", dataeng: "data" };
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

// --- the registries: built-in tables + the project's valid packs (in name order, after the built-in ones) ---
function allTracks() { const p = packTracks(); return p.length ? VALID_TRACKS.concat(p) : VALID_TRACKS; }
function optionalTracks() { const p = packTracks(); return p.length ? OPTIONAL_TRACKS.concat(p) : OPTIONAL_TRACKS; }
function markerTracks() { const p = packTracks(); return p.length ? MARKER_TRACKS.concat(p) : MARKER_TRACKS; }
function trackMarker(tr) { if (Object.prototype.hasOwnProperty.call(TRACK_MARKER, tr)) return TRACK_MARKER[tr]; const p = packOf(tr); return p ? p.marker : undefined; }
function trackSectionTable(tr) { if (Object.prototype.hasOwnProperty.call(TRACK_SECTIONS, tr)) return TRACK_SECTIONS[tr]; const p = packOf(tr); return p ? p.sections : undefined; }
function trackSteeringFiles(tr) { if (Object.prototype.hasOwnProperty.call(TRACK_STEERING, tr)) return TRACK_STEERING[tr]; const p = packOf(tr); return p && p.steering ? [p.steering] : []; }
function trackSignalTable(tr) { if (Object.prototype.hasOwnProperty.call(SIGNALS, tr)) return SIGNALS[tr]; const p = packOf(tr); return p ? p.signals : { strong: [], weak: [] }; }

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
const TRACK_MARKER = { saas: "[SaaS]", ai: "[AI]", sec: "[SEC]", privacy: "[PRIVACY]", dist: "[DIST]", api: "[API]", ui: "[UI]", obs: "[OBS]", data: "[DATA]" };
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
  { name: "Observability", syn: ["observability", "observabilidade", "observabilidad"], tier: "extended" },
  { name: "Cost Envelope", syn: ["cost envelope", "envelope de custo", "orçamento de custo", "sobre de coste", "presupuesto de coste"], tier: "extended" },
];
const AI_SECTIONS = [
  { name: "Model Strategy", syn: ["model strategy", "estratégia de modelo", "estrategia de modelo"] },
  { name: "Prompt Architecture", syn: ["prompt architecture", "arquitetura de prompt", "arquitectura de prompt"] },
  { name: "Token Economics", syn: ["token economics", "economia de tokens", "economía de tokens"] },
  { name: "Latency Budget", syn: ["latency budget", "orçamento de latência", "presupuesto de latencia"], tier: "extended" },
  { name: "Eval Strategy", syn: ["eval strategy", "estratégia de eval", "estrategia de eval", "estratégia de avaliação", "estrategia de evaluación"] },
  { name: "Safety & Abuse", syn: ["safety & abuse", "safety and abuse", "segurança e abuso", "seguridad y abuso"] },
  { name: "Fallback & Degradation", syn: ["fallback", "degradação", "degradación"] },
  { name: "Observability for AI", syn: ["observability for ai", "observabilidade de ai", "observabilidade de ia", "observabilidad de ia"], tier: "extended" },
  { name: "Model Lifecycle", syn: ["model lifecycle", "ciclo de vida do modelo", "ciclo de vida del modelo"], tier: "extended" },
  { name: "Multi-modality", syn: ["multi-modality", "multimodality", "multimodalidade", "multimodalidad"], tier: "extended" },
];
// +sec (1.14) — never a bare "security" synonym: the core design's own "Security Considerations" is not a [SEC] section.
const SEC_SECTIONS = [
  { name: "Threat Model", syn: ["threat model", "modelo de ameaças", "modelo de ameacas", "modelação de ameaças", "modelacao de ameacas", "modelo de amenazas", "modelado de amenazas"] },
  { name: "Security Requirements", syn: ["security requirements", "requisitos de segurança", "requisitos de seguranca", "requisitos de seguridad"], tier: "extended" },
  { name: "Authentication & Authorization", syn: ["authentication & authorization", "authentication and authorization", "authn & authz", "authn/authz",
    "autenticação e autorização", "autenticacao e autorizacao", "autenticación y autorización", "autenticacion y autorizacion"] },
  { name: "Secrets & Key Management", syn: ["secrets & key management", "secrets and key management", "secrets management", "secret management", "key management",
    "gestão de segredos", "gestao de segredos", "gestão de chaves", "gestión de secretos", "gestion de secretos", "gestión de claves",
    "gerenciamento de segredos", "gerenciamento de chaves"], tier: "extended" }, // pt-BR (full review Pb4)
  { name: "Security Testing", syn: ["security testing", "security tests", "testes de segurança", "testes de seguranca", "pruebas de seguridad"], tier: "extended" },
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
  loose: ["processors", "sub-processors", "operadores", "suboperadores"], tier: "extended" },
  // pt-BR / LGPD (full review Pb4 / Pb7): the RIPD (Relatório de Impacto à Proteção de Dados), art. 38.
  { name: "DPIA", syn: ["dpia", "data protection impact assessment", "aipd", "avaliação de impacto", "avaliacao de impacto", "eipd", "evaluación de impacto", "evaluacion de impacto",
    "ripd", "relatório de impacto à proteção de dados", "relatorio de impacto a protecao de dados", "relatório de impacto", "relatorio de impacto"],
    loose: ["avaliação de impacto", "avaliacao de impacto", "evaluación de impacto", "evaluacion de impacto", "relatório de impacto", "relatorio de impacto"], tier: "extended" },
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
  loose: ["concurrency", "concorrência", "concorrencia", "concurrencia"], tier: "extended" },
  // 1.17 D review: the section's own names (Failure Modes / Failure Handling — the core design's heading is "Error Handling")
  // are strict, as every other [DIST] section's are — a marker-less hand-written design with all five headings passes; the
  // singular is loose.
  { name: "Failure Modes", syn: ["failure modes", "failure mode", "failure handling", "modos de falha", "modo de falha", "modos de fallo", "modo de fallo",
    "modos de falla", "modo de falla"],
  loose: ["failure mode", "modo de falha", "modo de fallo", "modo de falla"], tier: "extended" },
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
  loose: ["pagination", "paginação", "paginación"], tier: "extended" },
  { name: "Rate Limits & Quotas", syn: ["rate limits & quotas", "rate limits and quotas", "rate limits", "rate limiting", "quotas",
    "limites de taxa e quotas", "limites de taxa e cotas", "limites de taxa", "cotas", "límites de tasa y cuotas", "límites de tasa", "cuotas"],
  loose: ["rate limits", "rate limiting", "quotas", "limites de taxa", "cotas", "límites de tasa", "cuotas"], tier: "extended" },
];
// +ui (1.19 T) — user-facing UI. Every ordinary name is `loose` (marker-bound): a core "## Accessibility" or "## States" note, or
// +saas's "## [SaaS] Performance Budget", never stands in for a deleted [UI] section; the full names stay strict.
const UI_SECTIONS = [
  { name: "Design System Usage", syn: ["design system usage", "design system", "component inventory", "uso do design system", "sistema de design",
    "inventário de componentes", "uso del design system", "sistema de diseño", "inventario de componentes"],
  loose: ["design system", "component inventory", "sistema de design", "inventário de componentes", "sistema de diseño", "inventario de componentes"], tier: "extended" },
  { name: "UI States", syn: ["ui states", "view states", "states", "estados da interface", "estados da ui", "estados de la interfaz", "estados de la ui", "estados"],
  loose: ["view states", "states", "estados"] },
  { name: "Accessibility", syn: ["accessibility", "a11y", "acessibilidade", "accesibilidad"], loose: ["accessibility", "a11y", "acessibilidade", "accesibilidad"] },
  { name: "Responsiveness & i18n", syn: ["responsiveness & i18n", "responsiveness and i18n", "responsiveness", "responsive design", "internationalization",
    "internationalisation", "i18n", "design responsivo e i18n", "design responsivo", "responsividade", "internacionalização", "diseño adaptable e i18n",
    "diseño adaptable", "diseño responsivo", "internacionalización"],
  loose: ["responsiveness", "responsive design", "internationalization", "internationalisation", "i18n", "design responsivo", "responsividade",
    "internacionalização", "diseño adaptable", "diseño responsivo", "internacionalización"], tier: "extended" },
  { name: "UI Performance Budget", syn: ["ui performance budget", "web performance budget", "front-end performance", "frontend performance", "core web vitals",
    "performance budget", "orçamento de desempenho da interface", "orçamento de desempenho", "presupuesto de rendimiento de la interfaz",
    "presupuesto de rendimiento"],
  loose: ["front-end performance", "frontend performance", "core web vitals", "performance budget", "orçamento de desempenho", "presupuesto de rendimiento"], tier: "extended" },
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
  loose: ["alerting", "alerts", "runbooks", "alertas"], tier: "extended" },
  { name: "Rollout & Rollback", syn: ["rollout & rollback", "rollout and rollback", "rollout", "rollback", "release strategy", "lançamento e reversão", "rollout e rollback",
    "despliegue y reversión", "rollout y rollback"],
  loose: ["rollout", "rollback", "release strategy"] },
  { name: "Health & Capacity", syn: ["health & capacity", "health and capacity", "health checks", "capacity", "saúde e capacidade", "verificações de saúde",
    "capacidade", "salud y capacidad", "comprobaciones de salud", "capacidad"],
  loose: ["health checks", "capacity", "verificações de saúde", "capacidade", "comprobaciones de salud", "capacidad"], tier: "extended" },
];
// +data (1.21 F4) — data pipelines & data quality. The ordinary names are `loose` (marker-bound): a core "## Retention" or
// "## Ownership" note, +privacy's "[PRIVACY] Retention & Deletion" or +saas's "[SaaS] Cost Envelope" never stand in for a deleted
// [DATA] section; the full names and the unmistakable data terms (schema evolution, data quality, data lineage) stay strict.
const DATA_SECTIONS = [
  { name: "Data Contracts & Schema Evolution", syn: ["data contracts & schema evolution", "data contracts and schema evolution", "schema evolution", "data contracts",
    "data contract", "schema versioning", "contratos de dados e evolução do esquema", "evolução do esquema", "evolução de esquemas", "contratos de dados",
    "contratos de datos y evolución del esquema", "evolución del esquema", "evolución de esquemas", "contratos de datos"],
  loose: ["data contracts", "data contract", "schema versioning", "contratos de dados", "contratos de datos"] },
  { name: "Data Quality", syn: ["data quality", "data quality checks", "quality checks", "qualidade dos dados", "qualidade de dados", "verificações de qualidade",
    "calidad de los datos", "calidad de datos", "comprobaciones de calidad", "controles de calidad"],
  loose: ["quality checks", "verificações de qualidade", "comprobaciones de calidad", "controles de calidad"] },
  { name: "Pipeline Idempotency & Backfills", syn: ["pipeline idempotency & backfills", "pipeline idempotency and backfills", "idempotency & backfills",
    "idempotency and backfills", "backfills", "backfill", "reprocessing", "re-runs", "idempotência do pipeline e backfills", "idempotência e backfills",
    "reprocessamento", "idempotencia del pipeline y backfills", "idempotencia y backfills", "reprocesamiento"],
  loose: ["backfills", "backfill", "reprocessing", "re-runs", "reprocessamento", "reprocesamiento"] },
  { name: "Lineage & Ownership", syn: ["lineage & ownership", "lineage and ownership", "data lineage", "lineage", "ownership", "linhagem e responsáveis",
    "linhagem e responsaveis", "linhagem dos dados", "linhagem", "linaje y responsables", "linaje de los datos", "linaje"],
  loose: ["lineage", "ownership", "linhagem", "linaje"], tier: "extended" },
  { name: "Retention & Cost", syn: ["retention & cost", "retention and cost", "storage & cost", "storage and cost", "retention", "storage cost", "query cost",
    "retenção e custo", "retencao e custo", "retenção", "custo de armazenamento", "retención y coste", "retención y costo", "retención", "coste de almacenamiento"],
  loose: ["retention", "storage cost", "query cost", "retenção", "custo de armazenamento", "retención", "coste de almacenamiento"], tier: "extended" },
];
// The marker tracks' mandatory design sections — the ONE table doctor, approve, status, the roadmap and the design-save
// check read (a marker track = a TRACK_MARKER entry + its table here).
const TRACK_SECTIONS = { saas: SAAS_SECTIONS, ai: AI_SECTIONS, sec: SEC_SECTIONS, privacy: PRIVACY_SECTIONS, dist: DIST_SECTIONS, api: API_SECTIONS, ui: UI_SECTIONS, obs: OBS_SECTIONS,
  data: DATA_SECTIONS };
// A section's `tier` (1.21 F5 — DATA in the tables above): "core" (absent = core) is mandatory at every size; "extended" is
// optional at size S — absent, or answered by one "n/a — <reason>" line (sectionVerdict). A track pack's sections are all core.
// 1.21 F5 P4 — sections two tracks both scaffold (DATA): when both tracks are on, a SIZED scaffold writes only the covering
// section(s) (`by`, [track, section name]) and the gate reads the dropped one (`drop`) as answered by them — status "covered"
// (trackSectionReport); a design that still holds the dropped heading is judged on it as ever. No size: never applied. A new
// built-in track adds its pairs here, no code.
const TRACK_OVERLAPS = [
  { drop: ["saas", "Observability"], by: [["obs", "Telemetry"], ["obs", "Alerting & Runbooks"]] },
  { drop: ["saas", "Performance Budget"], by: [["obs", "SLIs & SLOs"]] },
];
// (1.21 review C8: no +api / +dist entry — [API] Pagination, Idempotency & Concurrency asks what [DIST] Delivery & Idempotency /
// Concurrency never do: cursor pagination, an Idempotency-Key, If-Match / 412, 202 + a status resource for a long-running
// operation — those are about the API's callers, the [DIST] ones about messages and locks. Both sections stay.)
// +data (1.21 F4) has no overlap entry: its sections (schema evolution, data quality, backfills, lineage, retention & cost) ask
// what no other track's do — [DIST] Delivery & Idempotency is about messages, not re-running a partition; [PRIVACY] retention is
// about personal data, not storage tiers and query cost.
// The template TASKS two tracks both scaffold (DATA): with the `by` track on, a sized scaffold leaves out the task at 1-based
// `drop` position of the other track's template block (its criteria stay cited by that block's other tasks).
const TRACK_TASK_OVERLAPS = [
  { drop: ["saas", 1], by: "obs" }, // "Emit metrics, add dashboard, configure alerts" — +obs's telemetry / alerting tasks do it
];
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

// ---------------------------------------------------------------------------
// The classifier's signals — per built-in track (the data classify.js interprets)
// ---------------------------------------------------------------------------
// ONE object per optional built-in track: adding or tuning a track's signals is editing this table, never classify.js.
//   strong   — turns the track on alone.
//   weak     — an anchor that needs corroboration: two of them, or one beside a strong / generic word, turn the track on; alone
//              it is only a "possible" note — it cuts false positives like "user-agent" → +ai or "data model" → +ai.
//   generic  — app-level words (1.17 D review): they add to the score but never turn the track on without a strong or a weak
//              signal (two alone stay 'possible', named by the genericOnly note).
//   context  — corroborating only (C4): evidence beside another (non-negated) strong / weak signal of the track; alone no
//              signal, no note at all ("file permission bits").
//   concepts — { concept: [keywords] } (1.17 D review): one concept, one signal — the weak / generic keywords of a concept count
//              once ("deduplicate … dedupe them", "producers and consumers"), an anchor member first. Per track: a keyword may
//              belong to a concept in one track only (+saas' 'worker' and 'background job' stay two signals there).
//   hazards  — [keywords] (1.17 D review): a failure a requirement says must never happen, written negated by nature ("no lost
//              updates", "without breaking changes") — the negation is the requirement: never negated, no "kept off" note.
//   cues     — [rules] (1.19 T review): a keyword whose tier depends on the words around it. Rules are tried in order and the
//              first that fires decides; `kind` names the generic mechanism (classify.js CUE_KINDS: near · sentence · text ·
//              clause · ownership), `on` the keywords it reads (none: every keyword of the track), `ifTier` a hit of that tier
//              only, `then` the new tier, "none" (no signal at all) or "keep" (unchanged, no later rule).
// Keywords are EN / PT / ES (+ pt-BR words) and technical synonyms, matched as WORDS (classify.js keywordRe: inflections, PT / ES
// plurals, STEMS, VERB_STEMS, IRREGULAR_FORMS). One written with capitals is matched case-sensitively ("STRIDE", "UI"); " … " is a
// gap keyword (≤ 3 words between, never across . ! ? ; : ,). Within a track the first keyword matching at a place wins it: list a
// longer phrase before its prefix. A phrase may serve two tracks (equal spans are never shadowed). Track packs have their own
// strong / weak / context keywords (packs.js), never concepts, hazards or cues.
// +api (1.19 verify 2): breaking compatibility as a verb — "must not break compatibility", "não pode quebrar a compatibilidade da API
// pública", "no puede romper la compatibilidad": weak, one concept with the compatibility nouns (api concepts.compat) and a hazard
// (api hazards — the negation is the requirement), in the three languages alike.
const API_BREAK_VERBS = ["break compatibility", "breaks compatibility", "breaking compatibility", "quebrar a compatibilidade",
  "quebra a compatibilidade", "quebre a compatibilidade", "quebrem a compatibilidade", "quebrar compatibilidade", "romper la compatibilidad",
  "rompa la compatibilidad", "rompe la compatibilidad", "rompan la compatibilidad", "romper compatibilidad"];
// +ui: the page types and the frontend / UI / UX words — what the backend-only cues read (ui cues)
const UI_PAGE_WORDS = ["landing page", "settings page", "settings screen", "admin page", "admin panel", "admin ui", "management page",
  "profile page", "account page", "página de definições", "página de configurações", "página de administração", "painel de administração",
  "página de gestão", "página de perfil", "ecrã de definições", "tela de configurações", "página de ajustes", "página de configuración",
  "panel de administración", "página de gestión", "pantalla de ajustes", "frontend", "front-end", "UI", "UX"];
// +obs: the TECHNICAL TARGETS (1.19 T review) — context words, and one concept (obs concepts.target): a service, servers, a cron /
// batch / sync job, production, a cluster, an endpoint, the backend, the infrastructure, ops / SRE, a status page, disk / CPU /
// queue depth — phrases where the bare word is also a business word (a sales pipeline, a production line, a job posting, a reefer
// container, a restaurant's server)
const OBS_TARGETS = [
  "service", "servers", "web server", "app server", "microservice", "in production", "to production", "on production",
  "production environment", "production traffic", "in prod", "to prod", "cluster", "kubernetes", "k8s", "pod", "cron job", "cronjob",
  "cron", "batch job", "sync job", "import job", "export job", "backup job", "scheduled job", "nightly job", "background job",
  "background worker", "etl job", "data pipeline", "etl pipeline", "ci pipeline", "deployment pipeline", "endpoint", "backend",
  "infrastructure", "ops", "devops", "sre", "status page", "queue depth", "consumer lag", "disk usage", "disk space", "cpu",
  "memory usage",
  // PT
  "serviço", "servidor", "servidores", "microsserviço", "em produção", "para produção", "ambiente de produção", "tarefa agendada",
  "tarefa noturna", "processo … noturno", "infraestrutura", "página de estado", "uso de disco", "espaço em disco",
  // ES
  "servicio", "microservicio", "en producción", "a producción", "entorno de producción", "tarea programada", "tarea nocturna",
  "proceso … nocturno", "infraestructura", "espacio en disco",
];
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
  // ("a consistent UI"). One concept, one signal: its concepts fold the words of one concept (retry · backoff · jitter,
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
    concepts: {
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
    },
    hazards: ["lost update", "atualização perdida", "atualizações perdidas", "actualización perdida", "actualizaciones perdidas",
      "update … lost", "atualização … perdida", "actualización … perdida", "overwrite each other", "write skew", "split brain", "split-brain",
      "oversell", "race condition", "condição de corrida", "condições de corrida", "condición de carrera", "condiciones de carrera",
      "duplicate delivery", "duplicate message", "duplicate event", "delivered twice", "delivered more than once", "entregue duas vezes",
      "entregado dos veces", "mensagens duplicadas", "eventos duplicados", "mensajes duplicados"],
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
  // OWNERSHIP (1.19 T review — the cues below): an API someone ELSE owns is app-level for us. A keyword right after
  // a third-party owner ("Stripe's REST API", "the payment provider's OpenAPI spec", "their Admin API version"; PT / ES "a API
  // REST do Stripe", "la API REST del banco") counts as a GENERIC word, and so does one after a consumer verb ("call", "integrate
  // with", "sync from", "through", "via", "the Salesforce REST API"; PT "integrar com", "chamar"; ES "integrar con", "llamar a")
  // unless the clause says the API is ours ("our", an own verb: expose, publish, offer, provide, design, document…). The
  // ownership-AMBIGUOUS names (the cues' `ambiguous`: a REST / public / HTTP / JSON / web / partner API, an API version, problem
  // details) are weak — strong only beside an own cue ("our public REST API", "Expose … through a versioned REST API",
  // "Versionar a API pública").
  api: {
    strong: [
      "restful", "api-first", "contract-first",
      "openapi", "swagger", "graphql", "grpc", "protobuf", "protocol buffers", "proto file",
      "api versioning", "versioned api", "api v1", "api v2", "api v3", "breaking api change", "api contract",
      "api spec", "api specification", "api design", "api consumer", "third-party developers", "third party developers",
      "external developers", "developer portal", "contract test", "consumer-driven contract",
      "application/problem+json", "problem+json", "rfc 9457", "rfc 7807", "idempotency-key", "rate limit headers",
      "ratelimit header", "x-ratelimit", "retry-after", "sunset header", "deprecation header",
      // the rate-limit headers by name (1.19 T review: 'x-ratelimit' never matched "X-RateLimit-Remaining" — a '-<letter>'
      // compound ends no keyword)
      "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "ratelimit-limit", "ratelimit-remaining", "ratelimit-reset",
      "ratelimit-policy",
      // PT (the plural of a phrase's first word is generated only for "de" / non-ASCII phrases: the others are listed)
      "versionamento da api", "versionamento de api",
      "contrato da api", "contrato de api", "especificação da api", "consumidores da api", "programadores externos",
      "desenvolvedores externos", "programadores terceiros", "desenvolvedores terceiros", "portal de programadores",
      "portal do programador", "portal do desenvolvedor", "portal de desenvolvedores", "teste de contrato",
      // ES
      "versionado de la api", "versionado de api", "contrato de la api",
      "especificación de la api", "consumidores de la api", "desarrolladores externos", "desarrolladores de terceros",
      "portal de desarrolladores", "prueba de contrato",
    ],
    weak: [
      // ownership-ambiguous (the cues' `ambiguous` — strong beside an own cue; one concept: "the public API is a REST API" is one hint)
      "public api", "rest api", "http api", "web api", "json api", "partner api", "api version", "problem details",
      "api pública", "api rest", "versão da api", "versões da api", "versión de la api", "versiones de la api",
      "breaking change", "backward compatible", "backwards compatible", "backward-compatible", "backwards-compatible",
      "backward compatibility", "backwards compatibility", "sdk", "client library", "client libraries", "etag", "if-match",
      "if-none-match", "status code", "http status", "json schema", "request schema", "response schema", "cursor pagination",
      "cursor-based pagination", "keyset pagination", "deprecation", "api gateway", "internal api", "api client",
      "api documentation", "api docs", "api reference", "content negotiation",
      "management api", "admin api", // (1.19 T review) an API named by its role — "Management API for tenants"
      ...API_BREAK_VERBS, // (1.19 verify 2) breaking compatibility as a verb, EN / PT / ES
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
    // +api (1.19 T): compatibility is one concept ("no breaking change, stay backward compatible"), so are ETag / If-Match, the
    // status codes, the schemas, cursor pagination, a client library / SDK; the generic words (an endpoint and its route, a request).
    concepts: {
      // (1.19 T review) the ownership-ambiguous names: one hint, whichever of them a text uses
      kind: ["public api", "rest api", "http api", "web api", "json api", "partner api", "api version", "api pública", "api rest",
        "versão da api", "versões da api", "versión de la api", "versiones de la api"],
      role: ["management api", "admin api"],
      compat: ["breaking change", "backward compatible", "backwards compatible", "backward-compatible", "backwards-compatible",
        "backward compatibility", "backwards compatibility", "quebra de compatibilidade", "alteração incompatível", "alterações incompatíveis",
        "mudança incompatível", "mudanças incompatíveis", "compatibilidade retroativa", "retrocompatível", "retrocompatíveis",
        "retrocompatibilidade", "compatível com versões anteriores", "cambio incompatible", "cambios incompatibles",
        "compatibilidad hacia atrás", "retrocompatible", "retrocompatibilidad", ...API_BREAK_VERBS],
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
    },
    // +api (1.19 T): "no breaking changes", "sem quebra de compatibilidade", "sin cambios incompatibles" state the contract concern.
    hazards: ["breaking change", "breaking api change", "quebra de compatibilidade", "alteração incompatível", "alterações incompatíveis",
      "mudança incompatível", "mudanças incompatíveis", "cambio incompatible", "cambios incompatibles", ...API_BREAK_VERBS],
    // CUES — who owns the API (1.19 T review; the ownership kind in classify.js holds the algorithm, these are its words):
    // - a third party named at the API phrase makes it someone else's (GENERIC): "Stripe's REST API", "the provider's OpenAPI
    //   spec", "their API", a `possessives` word ≤ window.near words back, "<phrase> of / do / del <Owner>" (`ownerAfter`, ≤
    //   window.ownerReach characters) — an owner is a Titlecase word, a `thirdParty` noun or an ALL-CAPS organisation acronym
    //   ("la API pública del BCE"; never one of `techAcronyms`), never one of `notOwner`;
    // - unless the clause says the API is ours — an own cue: an `ownWords` word ≤ window.near words back, an `ownVerbs` verb
    //   anywhere before it (a past participle right after a `determiners` word is an adjective: "the deprecated Google Places API"),
    //   a `versionWords` word opening the clause, a `buildVerbs` verb whose direct object it is ("Build a REST API") — a consumer
    //   verb governing the phrase (`consumerVerbs`: ≤ window.verbReach words back, only `articles` / `linkWords`, Titlecase names
    //   and ≤ window.verbGap other words between) and "the <Name> <phrase>" (`nameArticles`, ≤ window.names names) make it
    //   GENERIC (`ownNames` never: ours by name);
    // - an `ambiguous` name is strong with an own cue, else weak; a `kinds` name also when it opens its clause or follows a plain
    //   article + ≤ window.adjectives lower-case adjectives ("REST API for the mobile app", "Add rate limiting to the public API").
    // Verb lists hold one whole lower-case word per entry — a word or a regex fragment ("publish(?:es|ed|ing)?").
    cues: [
      // (1.21 F2) our own API + a new version of it in the sentence is contract work: "Our webhooks API needs a v2 …", "A nossa API
      // de webhooks precisa de uma v2", "Nuestra API de pagos necesita una nueva versión" — the bare word "api" (generic) is strong
      // when an own word stands right before it (≤ 2 words between) AND the sentence names a version (v2, version 3, a new / major
      // version, versioning). Tried before the ownership rule (which decides every other hit).
      { kind: "all", on: ["api"], ifTier: "generic", then: "strong",
        rules: [
          { kind: "near", before: { words: [[["our", "nosso", "nossa", "nuestro", "nuestra"], { optional: "[\\p{L}\\p{N}-]+" }, { optional: "[\\p{L}\\p{N}-]+" }]],
            chars: 40, edge: "letter" } },
          { kind: "sentence", edge: "word", phrases: ["v[1-9][0-9]?", ["versions?", "[0-9]+"], ["new", { optional: "major" }, "versions?"],
            ["major", "versions?"], "versioning", ["versão", "[0-9]+"], ["nova", "versão"], "versionamento", ["versión", "[0-9]+"],
            ["nueva", "versión"], "versionado"] },
        ] },
      {
        kind: "ownership",
        ambiguous: ["public api", "rest api", "http api", "web api", "json api", "partner api", "api version", "problem details",
          "api pública", "api rest", "versão da api", "versões da api", "versión de la api", "versiones de la api"],
        kinds: ["public api", "rest api", "http api", "web api", "json api", "partner api", "api pública", "api rest"],
        ownNames: ["internal api", "api interna", "management api", "admin api"],
        thirdParty: ["provider", "providers", "supplier", "suppliers", "vendor", "vendors", "partner", "partners", "bank", "banks", "carrier",
          "carriers", "courier", "couriers", "merchant", "merchants", "third-party", "fornecedor", "fornecedores",
          "parceiro", "parceiros", "banco", "bancos", "transportadora", "transportadoras", "provedor", "provedores",
          "terceiros", "proveedor", "proveedores", "socio", "socios", "transportista", "transportistas", "terceros"],
        ownWords: ["our", "ours", "own", "nosso", "nossa", "nossos", "nossas", "próprio", "própria", "nuestro", "nuestra", "nuestros",
          "nuestras", "propio", "propia"],
        ownVerbs: ["expos(?:e|es|ed|ing)", "publish(?:es|ed|ing)?", "offer(?:s|ed|ing)?", "provid(?:e|es|ed|ing)", "design(?:s|ed|ing)?",
          "document(?:s|ed|ing)?", "deprecat\\p{L}*", "expor", "expõe", "expõem", "expomos", "publicar", "publica",
          "publicam", "publicamos", "disponibiliz\\p{L}*", "oferecer", "oferece", "oferecem", "oferecemos", "versionar",
          "versiona", "versionam", "versionamos", "desenhar", "projetar", "documentar", "documenta", "documentam",
          "descontinuar", "exponer", "expone", "exponen", "exponemos", "ofrecer", "ofrece", "ofrecen", "ofrecemos",
          "proporcionar", "proporciona", "diseñar", "diseña", "deprecar"],
        buildVerbs: ["build", "builds", "building", "create", "creates", "creating", "implement", "implements", "implementing", "develop",
          "develops", "developing", "ship", "construir", "constrói", "criar", "cria", "implementar", "implementa",
          "desenvolver", "desenvolve", "crear", "crea", "desarrollar", "desarrolla"],
        articles: ["a", "an", "the", "this", "um", "uma", "o", "un", "una", "el", "la"],
        linkWords: ["its", "their", "that", "os", "as", "los", "las", "seu", "sua", "seus", "suas", "su", "sus", "with", "to", "from", "into",
          "via", "through", "on", "com", "ao", "à", "aos", "às", "do", "da", "dos", "das", "de", "del", "con", "al", "en"],
        consumerVerbs: ["call", "calls", "called", "calling", "consume", "consumes", "consumed", "consuming", "integrate", "integrates",
          "integrated", "integrating", "integration", "integrations", "sync", "syncs", "synced", "syncing",
          "synchroni[sz]\\p{L}*", "via", "through", "connect", "connects", "connected", "connecting", "fetch", "fetches",
          "fetched", "fetching", "pull", "pulls", "pulled", "pulling", "poll", "polls", "polled", "polling", "integrar",
          "integra", "integram", "integração", "integrações", "chamar", "chama", "chamam", "chamada", "chamadas",
          "consumir", "consome", "consomem", "sincronizar", "sincroniza", "sincronizam", "através", "buscar", "busca",
          "consultar", "consulta", "obter", "obtém", "vía", "integran", "integración", "integraciones", "llamar", "llama",
          "llaman", "llamada", "llamadas", "consumen", "sincronizan", "través", "conectar", "conecta", "conectan",
          "obtener", "obtiene"],
        notOwner: ["it", "that", "there", "here", "what", "let", "he", "she", "who", "public", "private", "internal", "external", "new",
          "old", "legacy", "current", "next", "main", "core", "our", "admin", "management", "rest", "http", "json", "web",
          "open", "the"],
        techAcronyms: ["api", "apis", "rest", "http", "https", "json", "xml", "yaml", "soap", "rpc", "sdk", "cli", "crm", "erp", "cms", "lms",
          "dms", "pos", "mvp", "ui", "ux", "gui", "spa", "pwa", "iot", "etl", "saas", "paas", "iaas", "sso", "jwt", "oauth",
          "oidc", "ldap", "url", "uri", "sql", "db", "pdf", "csv", "qa", "ci", "cd", "ai", "ml", "llm", "sms", "mfa", "otp",
          "crud", "id", "ids", "app", "web", "os", "ios", "kpi", "smtp", "ftp", "sftp", "tcp", "udp", "dns", "cdn", "vpn",
          "b2b", "b2c", "hr", "rh", "rrhh", "ti"],
        determiners: ["a", "an", "the", "this", "that", "these", "those", "its", "their", "his", "her", "any", "some", "every"],
        possessives: ["their"],
        versionWords: ["version"],
        nameArticles: ["the"],
        ownerAfter: { links: ["of", "do", "da", "dos", "das", "de", "del"], articles: ["the", "la", "el", "los", "las", "o", "a", "os", "as"] },
        window: { near: 3, verbReach: 8, verbGap: 1, names: 3, adjectives: 2, ownerReach: 60 },
      },
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
  // CUES (1.19 T review — the cues below): a page type (a settings / admin / profile page, an admin panel…) and the
  // frontend / UI / UX words count as GENERIC in a CLAUSE that says the work is backend-only — a handler, an endpoint, the
  // backend, an API (never "API keys"), a data layer / repository / SQL, "the UI already exists" ("a PATCH handler that the
  // settings page calls", "the profile page backend should return…") — unless a negator governs the backend word ("no backend
  // changes"), the page consumes it ("loads … from the CMS API") or the text says "frontend only" (1.19 verify 1; "the frontend
  // team" names a team: generic); an empty state is weak in a sentence about a state
  // machine ("the empty state blocks sales"). "accessibility" alone is weak (a venue's wheelchair accessibility): it needs a
  // digital co-signal — WCAG, a screen reader, a page, a form… (WCAG / a11y / screen reader stay strong).
  ui: {
    strong: [
      "design system", "design-system", "design tokens", "component library", "ui component", "ui kit", "user interface", "wcag", "a11y",
      "screen reader", "screen-reader", "keyboard navigation", "keyboard accessible", "keyboard-only", "keyboard only", "focus order",
      "focus trap", "focus indicator", "focus management", "color contrast", "colour contrast", "contrast ratio", "alt text", "aria-label",
      "aria-live", "ARIA", "reduced motion", "prefers-reduced-motion", "responsive layout", "responsive design", "mobile-first", "dark mode",
      "storybook", "figma", "core web vitals", "largest contentful paint", "cumulative layout shift", "interaction to next paint", "LCP",
      "visual regression", "skeleton screen", "skeleton loader", "empty state", "right-to-left", "landing page", "settings page",
      "settings screen", "admin page", "admin panel", "admin ui", "management page", "profile page", "account page",
      // 1.21 F2: the everyday UI components a text names by themselves — a confirm dialog, a toast notification, a snackbar (one
      // word: a "snack bar" is a food counter) — were anchors only ('possible' alone); they are UI work
      "confirm dialog", "confirmation dialog", "confirmation modal", "confirm modal", "modal dialog", "modal window",
      "toast notification", "toast message", "snackbar",
      // PT
      "sistema de design", "leitor de ecrã", "leitor de tela", "navegação por teclado", "contraste de cor", "texto alternativo", "movimento reduzido", "design responsivo", "layout responsivo", "modo escuro", "tema escuro",
      "interface do utilizador", "interface de utilizador", "interface do usuário", "interface de usuário", "componente de interface",
      "biblioteca de componentes", "regressão visual", "estado vazio", "página de definições", "página de configurações",
      "página de administração", "painel de administração", "página de gestão", "página de perfil", "ecrã de definições",
      "tela de configurações",
      "diálogo de confirmação", "caixa de diálogo de confirmação", "janela de confirmação", "modal de confirmação", "janela modal",
      "notificação toast", "notificações toast", "mensagem toast",
      // ES
      "sistema de diseño", "lector de pantalla", "navegación por teclado", "contraste de color", "movimiento reducido",
      "diseño responsivo", "diseño adaptable", "modo oscuro", "tema oscuro", "interfaz de usuario", "componente de interfaz", "regresión visual",
      "estado vacío", "página de ajustes", "página de configuración", "panel de administración", "página de gestión", "pantalla de ajustes",
      "diálogo de confirmación", "cuadro de diálogo de confirmación", "ventana de confirmación", "modal de confirmación", "ventana modal",
      "notificación toast", "notificaciones toast", "mensaje toast",
    ],
    weak: [
      "accessibility", // (1.19 T review) weak: "wheelchair accessibility of each venue" — with a page / form / WCAG it is +ui
      "frontend", "front-end", "UI", "UX", "React", "Vue", "Angular", "Svelte", "tailwind", "css", "stylesheet", "modal", "dropdown", "tooltip",
      "navbar", "sidebar", "toast", "carousel", "spinner", "responsive", "i18n", "l10n", "RTL", "CLS", "INP", "loading state", "error state",
      "form validation", "wireframe", "mockup",
      // 1.19 T review: a picker ("a language picker"), a swipe gesture, inline form errors (a confirm dialog is strong since 1.21)
      "picker", "swipeable", "swipe", "inline error", "inline validation",
      // 1.21 F2: a pop-up; errors shown next to each field (inline validation, one concept); a mobile-friendly screen (responsive)
      "popup", "pop-up", "banner", "next to each field", "beside each field", "below each field", "under each field", "mobile-friendly", "mobile friendly",
      // PT
      "acessibilidade", "responsivo", "responsiva", "estado de carregamento", "estado de erro", "validação de formulário",
      "validação inline", "erros inline",
      "junto a cada campo", "junto de cada campo", "ao lado de cada campo", "por baixo de cada campo", "adaptado ao telemóvel",
      "adaptada ao telemóvel", "adaptado para telemóvel", "adaptada para telemóvel", "adaptado para celular", "adaptada para celular",
      // ES
      "accesibilidad", "estado de carga", "estado de error", "validación de formulario", "validación inline", "errores inline",
      "al lado de cada campo", "debajo de cada campo", "adaptada al móvil", "adaptado al móvil", "adaptada a móviles", "adaptado a móviles",
      "adaptada para móvil", "adaptado para móvil",
    ],
    generic: [
      "screen", "page", "form", "button", "dialog", "dashboard", "menu", "icon", "widget", "click", "layout", "theme",
      // PT
      "ecrã", "tela", "página", "formulário", "botão", "painel", "ícone",
      // ES ("tablero" / "cuadro de mando": a dashboard — 1.19 T review)
      "pantalla", "formulario", "botón", "icono", "tablero", "cuadro de mando",
    ],
    // +ui (1.19 T): a UI framework, the styling, i18n, a loading / error state, form validation, "responsive" are one concept each;
    // the generic words too (a screen is a page, a form, a button, a dashboard, an icon).
    concepts: {
      framework: ["React", "Vue", "Angular", "Svelte"],
      uiux: ["UI", "UX"],
      style: ["css", "stylesheet", "tailwind"],
      frontend: ["frontend", "front-end"],
      i18n: ["i18n", "l10n", "RTL"],
      vitals: ["CLS", "INP"],
      states: ["loading state", "error state", "estado de carregamento", "estado de erro", "estado de carga", "estado de error"],
      formValidation: ["form validation", "validação de formulário", "validación de formulario"],
      responsive: ["responsive", "responsivo", "responsiva", "mobile-friendly", "mobile friendly", "adaptado ao telemóvel", "adaptada ao telemóvel",
        "adaptado para telemóvel", "adaptada para telemóvel", "adaptado para celular", "adaptada para celular", "adaptada al móvil",
        "adaptado al móvil", "adaptada a móviles", "adaptado a móviles", "adaptada para móvil", "adaptado para móvil"],
      design: ["wireframe", "mockup"],
      a11y: ["accessibility", "acessibilidade", "accesibilidad"],
      gesture: ["swipe", "swipeable"],
      popup: ["popup", "pop-up", "banner"],
      inline: ["inline error", "inline validation", "validação inline", "erros inline", "validación inline", "errores inline",
        "next to each field", "beside each field", "below each field", "under each field", "junto a cada campo", "junto de cada campo",
        "ao lado de cada campo", "por baixo de cada campo", "al lado de cada campo", "debajo de cada campo"],
      screen: ["screen", "page", "ecrã", "tela", "página", "pantalla"],
      form: ["form", "formulário", "formulario"],
      button: ["button", "botão", "botón", "click"],
      dashboard: ["dashboard", "painel", "tablero", "cuadro de mando"],
      icon: ["icon", "ícone", "icono"],
    },
    // CUES (1.19 T review, verify 1) — rules tried in order, the first that fires decides (generic kinds in classify.js):
    cues: [
      // (1.21 F2) a widget a display verb shows or opens is UI work: "Show a modal …", "display a tooltip", "open the date picker",
      // "Mostrar um popup", "muestra un spinner" — strong (alone the widget word stays an anchor: "modal split", "the modal verbs")
      { kind: "near", on: ["modal", "dropdown", "tooltip", "toast", "popup", "pop-up", "banner", "carousel", "sidebar", "navbar", "spinner", "picker", "dialog"],
        then: "strong",
        before: { words: [[["show", "shows", "showing", "display", "displays", "displaying", "open", "opens", "opening", "render", "renders",
          "mostrar", "mostra", "mostram", "exibir", "exibe", "exibem", "abrir", "abre", "abrem", "muestra", "muestran", "abren"],
        ["a", "an", "the", "um", "uma", "o", "un", "una", "el", "la"], { optional: "[\\p{L}-]+" }]], chars: 40, edge: "letter" } },
      // an empty state in a sentence about a state machine is a flow state, not a UI state ("the empty state blocks sales"): weak
      { kind: "sentence", on: ["empty state", "estado vazio", "estado vacío"], ifTier: "strong", then: "weak", edge: "letter",
        phrases: ["state[- ]machines?", "state transitions?", "máquinas? de estados?", "transiç(?:ão|ões) de estados?",
          "transici(?:ón|ones) de estados?"] },
      // "the frontend team" / "a equipa de frontend" names a team, not UI work
      { kind: "near", on: ["frontend", "front-end"], then: "generic",
        after: { words: ["teams?", "developers?", "devs?", "engineers?", "squads?"], chars: 20 },
        before: { words: [[["equipas?", "equipes?", "equipos?"], ["de", "do", "del"]]], chars: 20, edge: "letter" } },
      // a text that says the work is frontend-only ("Frontend only, …", "Apenas frontend", "Solo frontend"): nothing is demoted
      { kind: "text", on: UI_PAGE_WORDS, then: "keep", edge: "word",
        phrases: ["front-?end[- ]only", ["only", { optional: "the" }, "front-?end"],
          [["apenas", "só", "somente", "unicamente"], { optional: "o" }, "front-?end"],
          [["solo", "sólo", "solamente", "únicamente"], { optional: "el" }, "front-?end"]] },
      // the work is backend-only — a backend word in the page word's CLAUSE (cueClause: a colon after a short label joins the two;
      // never the whole sentence — "Redesign the admin panel; the backend team will add the endpoints later" is UI work): an HTTP
      // method + a path or a route word, a handler, an endpoint, the backend, a data layer / repository / SQL, "already exists", an
      // API (never an API key / token). The page types and the frontend / UI / UX words are then generic ("a PATCH
      // /me/preferences handler that the settings page calls; the UI already exists") — unless a negator governs the backend word
      // (≤ negWindow words back in the clause, or a word ending n't: "no backend changes", "does not touch the backend", "needs no
      // API changes", "sin backend"; PT "no" is em + o) or the page CONSUMES it: it follows the page word with a consumer verb
      // between ("The landing page loads its testimonials from the CMS API"; a backend word before the page — "a handler that the
      // settings page calls" — or right after it — "the profile page backend", "the admin page's API" — still says the work is
      // backend-only) …
      { kind: "clause", on: UI_PAGE_WORDS, then: "generic",
        mention: {
          words: ["request handlers?", "route handlers?", "endpoints?", "back-?end", "data layer", "repositor(?:y|ies)", "sql",
            "server-side", "already exists?", "já existe", "ya existe", "camada de dados", "capa de datos"],
          requests: { methods: ["get", "post", "put", "patch", "delete"], targets: ["handlers?", "endpoints?", "routes?"] },
          // (never an API key / token; 1.21 F2: never a PUBLIC API — a contract for outside consumers, not the backend of one page:
          // "Expose a public REST API for the mobile app's settings screen" builds the screen's consumer too, the mixed case)
          api: { words: ["apis?"], notAfter: [[["chaves?", "claves?"], ["de", "da", "del"]], "public", ["public", ["rest", "http", "json", "web"]]],
            notBefore: ["keys?", "tokens?", "públicas?", [["rest", "http", "json", "web"], "públicas?"]] },
        },
        negators: ["no", "not", "without", "never", "nor", "none", "sem", "não", "nao", "nem", "nunca", "sin", "ni"],
        negWindow: 4,
        consumers: ["load", "loads", "loaded", "loading", "fetch", "fetches", "fetched", "fetching", "call", "calls", "called", "calling",
          "consume", "consumes", "consumed", "consuming", "read", "reads", "reading", "pull", "pulls", "pulled", "pulling",
          "get", "gets", "getting", "query", "queries", "queried", "querying", "use", "uses", "used", "using", "submit",
          "submits", "submitted", "submitting", "send", "sends", "sending", "post", "posts", "posted", "posting", "carrega",
          "carregam", "carregar", "busca", "buscam", "buscar", "chama", "chamam", "chamar", "consome", "consomem",
          "consumir", "lê", "leem", "ler", "obtém", "obtêm", "obter", "usa", "usam", "usar", "utiliza", "utilizam",
          "utilizar", "envia", "enviam", "enviar", "consulta", "consultam", "consultar", "carga", "cargan", "cargar",
          "obtiene", "obtienen", "obtener", "llama", "llaman", "llamar", "consumen", "lee", "leen", "leer", "usan", "envía",
          "envían", "consultan", "buscan"] },
      // … or "the UI / the interface / the form already exists" in its SENTENCE (the backend words stay clause-bound: "the endpoint
      // already exists; redesign the settings page" is UI work)
      { kind: "sentence", on: UI_PAGE_WORDS, then: "generic", edge: "word",
        phrases: [[["ui", "ux", "user interface", "interface", "interfaz", "front-?end", "form", "formulário", "formulario"],
          { optional: ["itself", "em si", "en sí"] }, ["already exists?", "já existe", "ya existe"]]] },
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
  // 1.19 T review — business monitoring is no operability: "monitor stock levels and send alerts to purchasing", "warehouse
  // temperature monitoring … alerts go to the shift manager", "price-drop alerts … monitor competitor prices", a support
  // incident within the SLA, a clinical health check. So: monitoring · monitor · alert(s) · alerting · an incident · a
  // postmortem · an SLA are ONE concept (concepts.watch — "monitoring and alerts" is one hint); an SLA, an incident
  // and a health check are CONTEXT (evidence only beside another obs signal); on-call, game day, postmortem and a lower-case
  // "otel" (Otel reservations) are weak ("OTel" in its capitals stays strong); and a TECHNICAL TARGET — a service, servers, a
  // cron / batch / sync job, production, a cluster, an endpoint, the backend, the infrastructure, ops / SRE, a status page, disk /
  // CPU / queue depth (CONTEXT, one concept) — backs a lone weak word: "monitor the ERP sync job and alert ops", "alert the team
  // when the nightly backup job hasn't completed" are +obs. (Its cues drop "customer / room service", "service level".)
  obs: {
    strong: [
      "observability", "slo", "sli", "error budget", "burn rate", "burn-rate", "opentelemetry", "OTel", "otel collector", "distributed tracing",
      "runbook", "pagerduty", "opsgenie", "alertmanager", "alerting rule", "alert rule",
      // paging the on-call (a gap keyword: "page the on-call engineer") — shadows +ui's generic "page"
      "page … on-call", "page … on call",
      // (a longer phrase before its prefix: the first keyword matching at a place wins it — and shadows +ui's generic "dashboard")
      "monitoring dashboard", "grafana dashboard", "datadog dashboard", "prometheus", "grafana", "datadog", "new relic",
      "jaeger", "zipkin", "sentry", "structured logging", "structured logs", "correlation id", "trace id", "trace context", "x-request-id",
      "context propagation", "golden signals", "mttr", "mttd", "incident response", "feature flag",
      "feature toggle", "kill switch", "canary release", "canary deployment", "canary deploy", "canary rollout", "canary analysis", "blue-green", "progressive delivery", "progressive rollout", "gradual rollout",
      "staged rollout", "phased rollout", "percentage rollout", "dark launch", "rollback plan", "automatic rollback", "liveness probe",
      "readiness probe", "health check endpoint", "health endpoint", "synthetic monitoring", "real user monitoring", "chaos engineering", "fault injection",
      "zero-downtime", "zero downtime", "operational dashboard", "ops dashboard",
      "log aggregation", "error tracking",
      // rolling a deployment back (gap keywords: "roll back to the previous release", PT / ES "reverter a implantação", "revertir el despliegue")
      "roll back … deployment", "roll back … deploy", "roll back … release",
      // PT
      "observabilidade", "orçamento de erro", "rastreio distribuído", "rastreamento distribuído", "registos estruturados",
      "logs estruturados", "resposta a incidentes", "lançamento canário", "lançamento gradual", "lançamento progressivo", "plano de rollback",
      "plano de reversão", "painel de monitorização", "painel de monitoramento", "engenharia do caos", "injeção de falhas",
      "implantação canário", "implantação canária", "implantação gradual", "implantação progressiva", "reverter … implantação", "reverter … deploy",
      // (1.19 verify 3) a health check endpoint, as in EN (PT / ES; the English noun too) — before the context words it shadows
      "endpoint de verificação de saúde", "endpoint de verificação do estado", "endpoint de health check", "endpoint de healthcheck",
      // ES
      "observabilidad", "presupuesto de error", "rastreo distribuido", "trazas distribuidas", "logs estructurados",
      "registros estructurados", "respuesta a incidentes", "despliegue canario", "lanzamiento canario", "despliegue gradual",
      "despliegue progresivo", "plan de reversión", "plan de rollback", "panel de monitorización", "panel de monitoreo", "ingeniería del caos",
      "inyección de fallos", "revertir … despliegue", "endpoint de comprobación de salud", "endpoint de comprobación de estado",
    ],
    weak: [
      "monitoring", "monitor", "alerts", "alerting", "alert", "postmortem", "post-mortem", "healthcheck", "liveness", "readiness", "uptime",
      "outage", "downtime", "rollback", "roll back", "rollout", "roll out", "canary", "telemetry", "instrumentation", "tracing", "APM",
      "error rate", "5xx", "on-call", "on call", "game day", "otel", "request id", "latency metrics", "request logs", "application logs",
      // PT
      // (1.19 verify 3) the verbs "alertar" (PT / ES) and "avisar" (ES / PT) are the watch concept too: alone a hint, beside a
      // technical target +obs ("Alertar a equipa de operações quando a tarefa agendada … falhar", "Avisar … cuando falle la tarea
      // programada …"), a business watch stays 'possible' ("Avisar al encargado de la tienda cuando el stock baje")
      "alertar", "avisar",
      "monitorização", "monitoramento", "monitorizar", "monitorar", "alertas", "alerta", "indisponibilidade", "reversão", "telemetria",
      "instrumentação", "rastreio", "taxa de erro", "tempo de inatividade", "plantão", "métricas de latência",
      // ES
      "monitorización", "monitoreo", "monitorear", "caída del servicio", "reversión", "telemetría", "instrumentación", "trazas",
      "tasa de error", "tiempo de inactividad", "guardia", "métricas de latencia",
    ],
    generic: [
      "metrics", "logs", "logging", "latency", "p99", "p95", "p50", "deploy",
      // PT / ES
      "métricas", "latência", "latencia", "implantação", "despliegue",
    ],
    // CONTEXT (1.19 T review): evidence only beside another (non-negated) obs signal — the SLA / incident / health-check words of
    // support desks and clinics, and the technical targets that make a lone monitoring / rollback / error-rate word operability.
    context: [
      "sla", "incident", "incidente", "health check", "verificação de saúde", "verificações de saúde", "comprobación de salud",
      "comprobaciones de salud",
      ...OBS_TARGETS, // the technical targets (one concept: concepts.target)
    ],
    // +obs (1.19 T): alerting, monitoring, health checks, a rollback, a rollout, an outage, telemetry, tracing, error rates, on-call and
    // availability are one concept each; the generic metrics / logs / latency / deploy words too.
    // 1.19 T review: watching and alerting — monitoring, monitor, alert(s), an incident, a postmortem (+ PT / ES) — are ONE concept
    // ("monitor stock levels and send alerts" is one hint, never the two that turned +obs on); the technical targets are one too.
    concepts: {
      // (an SLA too: "tickets breaching the SLA … alerts to the supervisor" is a help desk's words, one hint)
      watch: ["monitoring", "monitor", "alerts", "alerting", "alert", "incident", "postmortem", "post-mortem", "sla", "alertar", "avisar", "monitorização",
        "monitoramento", "monitorizar", "monitorar", "alertas", "alerta", "incidente", "monitorización", "monitoreo", "monitorear"],
      health: ["health check", "healthcheck", "liveness", "readiness", "verificação de saúde", "verificações de saúde",
        "comprobación de salud", "comprobaciones de salud"],
      rollback: ["rollback", "roll back", "reversão", "reversión"],
      rollout: ["rollout", "roll out"],
      outage: ["outage", "downtime", "indisponibilidade", "tempo de inatividade", "caída del servicio", "tiempo de inactividad"],
      telemetry: ["telemetry", "instrumentation", "telemetria", "instrumentação", "telemetría", "instrumentación"],
      tracing: ["tracing", "rastreio", "trazas"],
      errors: ["error rate", "5xx", "taxa de erro", "tasa de error"],
      oncall: ["on-call", "on call", "plantão", "guardia"],
      availability: ["uptime"],
      metrics: ["metrics", "métricas", "latency metrics", "métricas de latência", "métricas de latencia"],
      logs: ["logs", "logging", "request logs", "application logs"],
      latency: ["latency", "p99", "p95", "p50", "latência", "latencia"],
      deploy: ["deploy", "implantação", "despliegue"],
      target: OBS_TARGETS,
    },
    // +obs (1.19 T): "zero downtime", "without an outage", "sem indisponibilidade", "sin tiempo de inactividad" state the concern.
    hazards: ["downtime", "outage", "indisponibilidade", "tempo de inatividade", "caída del servicio", "tiempo de inactividad"],
    // CUES (1.19 T review): "customer / room service", "service level", "serviço ao cliente", "servicio al cliente" are no
    // technical target — no signal at all. (The words before carry no left edge, as in 1.19: "bathroom service" is room service.)
    cues: [
      { kind: "near", on: ["service", "serviço", "servicio"], then: "none",
        before: { words: ["customer", "client", "room", "table", "field", "after-sales", "delivery"], chars: 20 },
        after: { words: ["level", "ao cliente", "a clientes", "de atendimento", "al cliente", "de atención"], chars: 30, plural: true } },
    ],
  },
  // +data (1.21 F4): data pipelines & data quality — data that moves between stores on a schedule or a stream (ETL / ELT, a warehouse or
  // a lake, dbt / Airflow / Spark jobs) and whose quality, freshness, lineage and history the feature owns. STRONG: ETL / ELT, a data
  // pipeline / warehouse / lake / mart, data quality, data contracts, lineage, a data catalog, schema evolution / a schema registry,
  // slowly changing dimensions, a star schema, fact / dimension tables, dbt models / tests, an Airflow DAG, Spark jobs, the platforms
  // named in full (BigQuery, Databricks, Amazon Redshift, a Snowflake warehouse / table, Delta Lake, Iceberg tables, Fivetran,
  // Airbyte), data freshness, late-arriving data, incremental loads. WEAK (anchors): a backfill (also a migration's "backfill the new
  // column" — its cue makes that one generic), a warehouse (also a building — its cue drops the logistics one), the product names
  // written with their capital (Snowflake, Redshift, Airflow — a snowflake icon, a galaxy's redshift, a vent's airflow), dbt (also a
  // therapy), lineage, ingestion, change data capture (+dist's strong phrase too), Parquet / Avro, BI and its tools, data
  // governance / platform. GENERIC (app-level — every product has them): analytics, a dataset, a partition, a transformation, a
  // batch / nightly job, ingest, upsert, a materialized view — "analytics events for the signup funnel", "import a CSV of contacts",
  // "export orders as CSV" and "migrate the users table" stay core ('possible' at most). CONTEXT (corroborating only — one concept):
  // table, column, rows, SQL, query, schema — "a nightly job that loads the orders table into the warehouse" is +data, "migrate the
  // users table" is not. HAZARDS: duplicate rows, stale data, schema drift ("without duplicate rows" states the concern).
  // 1.21 review B3 — words that mean something else in everyday text are tied to a data phrase or read by a cue: ELT only as a
  // pipeline / job / tool / process ("ELT teachers" teach English); a bare lakehouse is an anchor (a lakehouse to rent), strong in a
  // sentence about data; a freshness check is an anchor (a kitchen's produce crate); PT / ES "carga incremental" an anchor (a
  // training plan's load); BI only with its tool / dashboard / report ("o número do BI" is the Portuguese ID card — "BI" matched
  // case-sensitively, the words around it not: "Relatório de BI", "BI Dashboard"); and the context words never back an anchor with an
  // everyday sense (everydayAnchors) — a table, a column or a query is on every screen ("in a table", "React Query"): beside a horse's
  // lineage, SCD patient records, medication ingestion or duplicate rows in the users table they are no second hint (1.21 verify V3:
  // beside a data-term anchor — a warehouse, a backfill, a BI dashboard, parquet — they still are).
  data: {
    strong: [
      "etl", "elt pipeline", "elt job", "elt tool", "elt process", "elt workflow", "pipeline elt", "processo elt", "proceso elt",
      "data pipeline", "ingestion pipeline", "batch pipeline", "data warehouse", "data warehousing", "data lakehouse",
      "data lake", "data mart", "data quality", "data-quality", "data contract", "data lineage", "data catalog", "data catalogue", "data mesh",
      "data engineering", "analytics engineering", "schema evolution", "schema registry", "schema drift",
      "backfill job", "historical backfill", "slowly changing dimension", "star schema", "snowflake schema", "fact table", "dimension table",
      "dimensional model", "dimensional modelling", "olap", "dbt model", "dbt project", "dbt test", "dbt run", "dbt job",
      "dbt cloud", "apache airflow", "airflow dag", "dagster", "apache spark", "pyspark", "spark job", "spark sql", "spark streaming",
      "databricks", "bigquery", "amazon redshift", "Snowflake warehouse", "Snowflake table", "delta lake", "apache iceberg",
      "iceberg table", "apache hudi", "parquet file", "fivetran", "airbyte", "data ingestion", "data freshness",
      "freshness sla", "late-arriving data", "late arriving data", "incremental load", "incremental model", "medallion architecture",
      "data observability", "great expectations suite", "quarantine table",
      // PT (the plural of a phrase's first word is generated only for "de" / non-ASCII phrases — "armazéns" is listed)
      "pipeline de dados", "armazém de dados", "armazéns de dados", "lago de dados", "qualidade de dados", "qualidade dos dados",
      "contrato de dados", "linhagem de dados", "linhagem dos dados", "catálogo de dados", "engenharia de dados",
      "evolução do esquema", "evolução de esquema", "evolução dos esquemas", "ingestão de dados", "frescura dos dados", "atualidade dos dados",
      "esquema em estrela", "tabela de factos", "tabela de fatos", "tabela de dimensão", "carga incremental de dados", "carga incremental dos dados",
      "dados que chegam atrasados",
      // ES
      "pipeline de datos", "canalización de datos", "almacén de datos", "almacenes de datos", "lago de datos", "calidad de datos",
      "calidad de los datos", "contrato de datos", "linaje de datos", "linaje de los datos", "catálogo de datos", "ingeniería de datos",
      "evolución del esquema", "evolución de esquema", "ingesta de datos", "frescura de los datos",
      "frescura de datos", "esquema en estrella", "tabla de hechos", "tabla de dimensiones", "datos que llegan tarde", "datos tardíos",
      "carga incremental de datos", "carga incremental de los datos",
    ],
    weak: [
      "backfill", "warehouse", "lakehouse", "Snowflake", "Redshift", "Airflow", "dbt", "SCD", "lineage", "ingestion", "change data capture",
      "CDC pipeline", "parquet", "avro", "streaming pipeline", "batch processing", "data platform", "data governance", "data product",
      "freshness check", "business intelligence", "BI tool", "BI dashboard", "BI report", "BI platform", "BI team", "power bi", "looker",
      "tableau", "metabase", "duplicate rows", "stale data", "uniqueness check", "uniqueness test",
      // PT ("carga incremental" — PT and ES alike)
      "linhagem", "ingestão", "processamento em lote", "plataforma de dados", "governação de dados", "carga incremental",
      "governança de dados", "inteligência de negócio", "produto de dados", "linhas duplicadas", "dados desatualizados",
      "ferramenta de BI", "relatório de BI", "painel de BI", "dashboard de BI",
      // ES
      "linaje", "ingesta", "procesamiento por lotes", "plataforma de datos", "gobierno de datos", "gobernanza de datos",
      "inteligencia de negocio", "producto de datos", "filas duplicadas", "datos obsoletos", "herramienta de BI", "informe de BI", "panel de BI",
    ],
    generic: [
      // a role names no pipeline work of its own: "the data engineer wants a new column in the users table" (listed before "analytics":
      // the first keyword matching at a place wins it)
      "data engineer", "analytics engineer",
      "analytics", "dataset", "partition", "transformation", "batch job", "nightly job", "ingest", "upsert", "materialized view",
      // PT
      "conjunto de dados", "partição", "transformação", "tarefa noturna", "processo noturno", "job noturno", "analítica", "engenheiro de dados",
      // ES
      "conjunto de datos", "partición", "transformación", "tarea nocturna", "proceso nocturno", "ingeniero de datos",
    ],
    // CONTEXT: the words of the tables a pipeline reads and writes — evidence only beside another (non-negated) strong / weak +data
    // signal, and one concept (concepts.sql): "the warehouse … the orders table" is two hints, "table … rows … columns" one.
    context: ["table", "column", "row", "sql", "query", "queries", "schema", "tabela", "coluna", "linhas", "tabla", "columna", "filas"],
    // 1.21 review B3 / verify V3: the anchors that also have an everyday sense — a context word never backs them (classify.js — backedBy):
    // a table / a column / a query is on every screen, so "a horse's lineage in a table", "SCD patient records in the patients table",
    // "duplicate rows in the users table", "React Query never shows stale data" name no pipeline; a data-term anchor + a table still
    // does ("a BI dashboard over the orders table", "load the orders table into the warehouse", "backfill the orders table")
    everydayAnchors: ["lakehouse", "lineage", "linhagem", "linaje", "ingestion", "ingestão", "ingesta", "freshness check", "SCD", "duplicate rows",
      "linhas duplicadas", "filas duplicadas", "stale data", "dados desatualizados", "datos obsoletos"],
    concepts: {
      sql: ["table", "column", "row", "sql", "query", "queries", "schema", "tabela", "coluna", "linhas", "tabla", "columna", "filas"],
      role: ["data engineer", "analytics engineer", "engenheiro de dados", "ingeniero de datos"],
      ingest: ["ingestion", "ingest", "ingestão", "ingesta"],
      lineage: ["lineage", "linhagem", "linaje"],
      bi: ["business intelligence", "BI tool", "BI dashboard", "BI report", "BI platform", "BI team", "power bi", "looker", "tableau", "metabase",
        "inteligência de negócio", "inteligencia de negocio", "ferramenta de BI", "relatório de BI", "painel de BI", "dashboard de BI",
        "herramienta de BI", "informe de BI", "panel de BI"],
      batch: ["batch job", "nightly job", "batch processing", "processamento em lote", "procesamiento por lotes",
        "tarefa noturna", "processo noturno", "job noturno", "tarea nocturna", "proceso nocturno"],
      files: ["parquet", "avro"],
      cdc: ["change data capture", "CDC pipeline"],
      platform: ["data platform", "data product", "plataforma de dados", "produto de dados", "plataforma de datos", "producto de datos"],
      governance: ["data governance", "governação de dados", "governança de dados", "gobierno de datos", "gobernanza de datos"],
      duplicates: ["duplicate rows", "linhas duplicadas", "filas duplicadas"],
      stale: ["stale data", "dados desatualizados", "datos obsoletos"],
      uniqueness: ["uniqueness check", "uniqueness test"],
      dataset: ["dataset", "conjunto de dados", "conjunto de datos"],
      partition: ["partition", "partição", "partición"],
      transform: ["transformation", "transformação", "transformación"],
      analytics: ["analytics", "analítica"],
      sqlOps: ["upsert", "materialized view"],
    },
    // "without duplicate rows", "no stale data", "sem linhas duplicadas" state the concern (the negation is the requirement).
    hazards: ["duplicate rows", "linhas duplicadas", "filas duplicadas", "stale data", "dados desatualizados", "datos obsoletos", "schema drift"],
    // CUES — rules tried in order, the first that fires decides (generic kinds in classify.js):
    cues: [
      // a warehouse in a sentence about data (SQL, a load, dbt, a pipeline, a schema…) stays an anchor … — never for a table, a column or
      // a query, which a stock screen shows too (1.21 review B4: "Show stock levels per warehouse in a table …" reaches the next rule)
      { kind: "sentence", on: ["warehouse"], then: "keep", edge: "letter",
        phrases: ["sql", "load(?:s|ed|ing)?[^\\S\\n]+into", "snapshots?", "schemas?", "dbt", "pipelines?", "etl", "elt",
          "partitions?", "ingest\\p{L}*", "analytics", "bi"] },
      // … one about the building (stock, inventory, shelves, picking, pallets, shipping, temperature, shifts…) is no signal at all
      { kind: "sentence", on: ["warehouse"], then: "none", edge: "letter",
        phrases: ["stock", "inventor(?:y|ies)", "shel(?:f|ves)", "picking", "pick list", "forklifts?", "pallets?", "shipping", "shipments?",
          "deliver(?:y|ies)", "dispatch\\p{L}*", "temperatures?", "staff", "shifts?", "trucks?", "goods", "aisles?", "loading docks?", "receiving",
          "square (?:feet|meters|metres)", "robots?", "packing", "parcels?"] },
      // a backfill in a sentence about partitions, a pipeline, the warehouse, a DAG or history is data work (an anchor) …
      { kind: "sentence", on: ["backfill"], then: "keep", edge: "letter",
        phrases: ["partitions?", "pipelines?", "warehouse", "dbt", "dags?", "historical", "history", "partições", "particiones", "histórico", "históricos",
          "históricas?"] },
      // … one in a schema migration ("add a currency column; backfill existing rows") is an app-level word
      { kind: "sentence", on: ["backfill"], then: "generic", edge: "letter",
        phrases: ["migrat\\p{L}*", "columns?", "nullable", "alter table", "default values?", "migraç\\p{L}*", "migraci\\p{L}*", "colunas?", "columnas?"] },
      // data moved into / out of the product is the product: "load the contacts into Snowflake", "export from Redshift", "no Snowflake"
      { kind: "near", on: ["Snowflake", "Redshift"], then: "strong",
        before: { words: ["into", "in", "to", "from", "via", "no", "na", "para", "en", "desde", "hacia"], chars: 12, edge: "letter" } },
      // the product names are something else beside these words: a snowflake icon, a vent's airflow, a galaxy's redshift, DBT therapy
      { kind: "near", on: ["Snowflake"], then: "none",
        after: { words: ["icons?", "emojis?", "patterns?", "decorations?", "ornaments?", "animations?", "effects?", "themes?", "shapes?"], chars: 24 } },
      { kind: "near", on: ["Airflow"], then: "none",
        after: { words: ["sensors?", "rates?", "meters?", "vents?", "readings?", "measurements?", "direction", "fans?"], chars: 24 } },
      { kind: "sentence", on: ["Redshift"], then: "none", edge: "letter",
        phrases: ["galax\\p{L}*", "stars?", "telescopes?", "spectr\\p{L}*", "astronom\\p{L}*", "cosmolog\\p{L}*", "quasars?"] },
      { kind: "near", on: ["dbt"], then: "none",
        after: { words: ["therapy", "therapists?", "skills?", "diar(?:y|ies)", "sessions?", "groups?", "programm?e?s?"], chars: 24 },
        before: { words: ["dialectical behaviou?r therapy", "dialectical"], chars: 40, edge: "letter" } },
      // 1.21 review B3 / 1.21 verify V3 — the data senses FIRST (the first rule that fires decides): a lakehouse, a freshness check or a
      // lineage in a sentence about data is data work (strong) — "Load the bookkeeping entries into the lakehouse tables", "Add a
      // freshness check to the grocery orders pipeline", "the column lineage of each metric per product family" …
      { kind: "sentence", on: ["lakehouse"], then: "strong", edge: "letter",
        phrases: ["tables?", "raw (?:zones?|layers?|data)", "bronze", "silver", "medallion", "delta", "iceberg", "hudi", "parquet", "spark",
          "databricks", "catalogs?", "partitions?", "pipelines?", "ingest\\p{L}*", "schemas?", "sql", "quer(?:y|ies)", "etl", "elt", "dbt", "data",
          "dados", "datos", "tabelas?", "tablas?"] },
      { kind: "sentence", on: ["freshness check"], then: "strong", edge: "letter",
        phrases: ["tables?", "pipelines?", "datasets?", "sources?", "warehouse", "dbt", "partitions?", "feeds?", "dags?", "data", "sla", "tabelas?",
          "tablas?", "dados", "datos"] },
      { kind: "sentence", on: ["lineage", "linhagem", "linaje"], then: "strong", edge: "letter",
        phrases: ["metrics?", "dashboards?", "columns?", "datasets?", "source tables?", "pipelines?", "kpis?", "métricas?", "indicadores?", "colunas?",
          "conjuntos? de dados", "tabelas de origem", "painéis?", "columnas?", "conjuntos? de datos", "tablas de origen", "cuadros? de mando"] },
      // 1.21 verify N2: what is ingested named right next to the word — "water / medication ingestion", "ingestão (diária) de água", "ingesta
      // de agua" — is the everyday sense even beside a CSV file (tried before the data sense)
      { kind: "near", on: ["ingestion", "ingestão", "ingesta"], then: "none",
        before: { words: ["water", "fluids?", "medications?", "medicines?", "drugs?", "pills?", "foods?", "calories", "calorie", "meals?", "alcohol",
          "caffeine", "sugar", "vitamins?", "supplements?", "nutrients?", "protein", "salt"], chars: 20, edge: "letter" },
        after: { words: [[{ optional: ["diária", "diaria", "daily", "total"] }, ["de", "do", "da", "of", "del"], { optional: ["the", "a", "o", "la", "el"] },
          ["água", "agua", "water", "líquidos?", "fluids?", "medicaç\\p{L}*", "medicaci\\p{L}*", "medicamentos?", "medications?", "comprimidos?",
            "pastillas?", "pills?", "alimentos?", "comida", "food", "calorias", "calorías", "calories", "açúcar", "azúcar", "sugar", "álcool",
            "alcohol", "cafeína", "caffeine", "vitaminas?", "vitamins?", "suplementos?", "supplements?", "sal", "salt", "proteínas?", "protein",
            "meals?", "refeições", "refeição", "comidas"]]],
        chars: 40 } },
      // 1.21 verify R4: ingestion of files / feeds / batches / streams into a lake or a warehouse, a slowly changing dimension's type 2
      { kind: "sentence", on: ["ingestion", "ingestão", "ingesta"], then: "strong", edge: "letter",
        phrases: ["csv", "json", "xml", "parquet", "avro", "files?", "ficheiros?", "arquivos?", "ficheros?", "archivos?", "feeds?", "pipelines?",
          "batch(?:es)?", "lotes?", "streams?", "streaming", "lakes?", "lakehouse", "warehouse", "buckets?", "s3", "topics?", "kafka",
          "raw (?:zones?|layers?)"] },
      { kind: "sentence", on: ["SCD"], then: "strong", edge: "letter",
        phrases: ["type[^\\S\\n]*[123]", "tipo[^\\S\\n]*[123]", "dimensions?", "dimensão", "dimensões", "dimensión", "dimensiones", "surrogate keys?",
          "valid[_ ]from", "valid[_ ]to", "effective dates?"] },
      // … then the everyday senses: a lakehouse to rent, a kitchen's freshness check, a training plan's "carga incremental", a horse's
      // lineage, the ingestion of water or a medication, parquet flooring — no signal at all
      { kind: "sentence", on: ["lakehouse"], then: "none", edge: "letter",
        phrases: ["book(?:s|ed|ings?)?", "rent(?:s|ed|als?|ing)?", "cabins?", "cottages?", "chalets?", "guests?", "weekends?", "nights?", "overnight",
          "holidays?", "vacations?", "reservations?", "deposits?", "bedrooms?", "airbnb", "reservas?", "alug\\p{L}*", "hóspedes", "fim de semana",
          "noites?", "férias", "cabanas?", "quartos?", "alquil\\p{L}*", "huéspedes", "fin de semana", "noches?", "vacaciones", "cabañas?",
          "habitaciones?"] },
      { kind: "sentence", on: ["freshness check"], then: "none", edge: "letter",
        phrases: ["produce", "foods?", "fruits?", "vegetables?", "meat", "fish", "milk", "dairy", "bread", "crates?", "fridges?", "refrigerat\\p{L}*",
          "kitchens?", "perishables?", "groceries", "grocery"] },
      { kind: "sentence", on: ["carga incremental"], then: "none", edge: "letter",
        phrases: ["treinos?", "entrenamientos?", "atletas?", "ginásios?", "gimnasios?", "exercícios?", "ejercicios?", "musculaç\\p{L}*",
          "musculaci\\p{L}*", "corridas?", "repetiç\\p{L}*", "repeticiones", "estruturas?", "estructuras?", "vigas?", "pontes?", "puentes?"] },
      { kind: "sentence", on: ["lineage", "linhagem", "linaje"], then: "none", edge: "letter",
        phrases: ["horses?", "dogs?", "cats?", "breed\\p{L}*", "pedigrees?", "cattle", "livestock", "famil(?:y|ies)", "ancestors?", "ancestry",
          "genealog\\p{L}*", "royal", "dynast\\p{L}*", "cavalos?", "cães", "cão", "gatos?", "raças?", "gado", "família", "famílias", "antepassados?",
          "caballos?", "perros?", "razas?", "ganado", "familias?", "antepasados?"] },
      // 1.21 verify R3: a lineage of reports, fields or models is data work too — tried AFTER the animals / families ("a horse's lineage in
      // the report" stays none), never among the first data words (a report is everyday text)
      { kind: "sentence", on: ["lineage", "linhagem", "linaje"], then: "strong", edge: "letter",
        phrases: ["reports?", "fields?", "models?", "relatórios?", "campos?", "modelos?", "informes?", "reportes?"] },
      { kind: "sentence", on: ["ingestion", "ingestão", "ingesta"], then: "none", edge: "letter",
        phrases: ["medicat\\p{L}*", "medicines?", "drugs?", "pills?", "doses?", "water", "foods?", "calories", "meals?", "nutri\\p{L}*", "intake",
          "fluids?", "alcohol", "caffeine", "sugar", "vitamins?", "supplements?", "água", "alimentos?", "calorias", "refeiç\\p{L}*", "medicaç\\p{L}*",
          "medicamentos?", "comprimidos?", "líquidos?", "açúcar", "vitaminas?", "suplementos?", "álcool", "agua", "calorías", "comidas?",
          "medicaci\\p{L}*", "pastillas?", "dosis", "azúcar"] },
      { kind: "sentence", on: ["parquet"], then: "none", edge: "letter",
        phrases: ["floor\\p{L}*", "laminate", "oak", "tiles?", "carpets?", "planks?", "hardwood", "varnish\\p{L}*", "square (?:feet|meters|metres)",
          "pavimentos?", "soalho", "pisos?", "madeira", "flutuante", "suelos?", "tarima", "laminado", "madera", "baldosas?", "alfombras?"] },
    ],
  },
};

module.exports = { VALID_TRACKS, OPTIONAL_TRACKS, TRACK_STEERING, trackTokens, parseTracks, normalizeTracks,
  TRACK_ALIASES, suggestTrack, unknownTracksError, trackLabel, SIGNALS, allTracks, optionalTracks, markerTracks, trackMarker, trackSectionTable, trackSteeringFiles, trackSignalTable,
  detectTracks, savedTracks, headingHasMarker, TRACK_MARKER, MARKER_TRACKS, trackAcIds, normTaskHeading, TASK_HEADINGS,
  trackTaskHeadings, trackTaskHeadingIs, trackTaskHeading, activeTasks, sectionDropLines, inactiveTaskLines,
  inactiveMarkerLines, RE_ACTIVE_TRACKS, trackRunSource, RE_TRACK_RUN, trackRunRe, SAAS_SECTIONS, AI_SECTIONS,
  SEC_SECTIONS, PRIVACY_SECTIONS, DIST_SECTIONS, API_SECTIONS, UI_SECTIONS, OBS_SECTIONS, DATA_SECTIONS, TRACK_SECTIONS,
  TRACK_OVERLAPS, TRACK_TASK_OVERLAPS, activeSectionTracks, activeDesign, __link };
