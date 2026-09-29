"use strict";

/**
 * dev-spec-driven engine — the track registries.
 * The built-in tracks (VALID_TRACKS, markers, design-section tables, steering files), track input (parseTracks), the
 * accessors that add the project's track packs (allTracks, trackMarker, trackSectionTable…), a feature's saved tracks
 * (detectTracks) and the inactive-section readers (a removed track's or a missing pack's sections).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
const { CTX } = require("./ctx.js"); // the shared per-call state (mutated in place)
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, existsCached, headingIndex, isObj, packRegistry, packReservedName, RE_PACK_MARKER, RE_PACK_MARKER_RESERVED,
  RE_PACK_NAME, readIfExists, readJson, SIGNALS, statePath, stripHtmlComments, useTemplateScopeOf;
function __link(E) { ({ acIndex, existsCached, headingIndex, isObj, packRegistry, packReservedName, RE_PACK_MARKER,
  RE_PACK_MARKER_RESERVED, RE_PACK_NAME, readIfExists, readJson, SIGNALS, statePath, stripHtmlComments,
  useTemplateScopeOf } = E); }

const VALID_TRACKS = ["core", "tdd", "saas", "ai", "sec", "privacy", "dist"];
// The optional, composable tracks (core is always on) — the classifier's, add_track's and every per-track loop's list.
// Adding a track: VALID_TRACKS + its classifier SIGNALS; a MARKER track (mandatory design sections under a stable
// [Marker]) also needs TRACK_MARKER, a sections table in TRACK_SECTIONS, TRACK_STEERING and its i18n builders
// (requirements criteria, design block, template tasks, test rows, steering stub).
const OPTIONAL_TRACKS = VALID_TRACKS.filter((t) => t !== "core");
// The steering files a track brings (spec_init / add_track write them, the task brief lists them).
const TRACK_STEERING = { tdd: ["testing-standards.md"], saas: ["scale.md", "observability.md", "cost.md"], ai: ["ai-strategy.md"], sec: ["security.md"], privacy: ["privacy.md"],
  dist: ["distributed.md"] };

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
  microsservicos: "dist", microservicios: "dist", consistency: "dist", consistencia: "dist", "consistência": "dist", kafka: "dist" };
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
// A feature's saved tracks naming a pack the project no longer has (deleted, now invalid, or — 1.17 — its name reserved since):
// inactive, kept in .state.json.
function missingPackTracks(dir) {
  const st = readJson(statePath(dir)).data;
  const saved = isObj(st) && Array.isArray(st.tracks) ? st.tracks : [];
  const valid = allTracks();
  return [...new Set(saved.filter((x) => typeof x === "string").map((x) => x.toLowerCase())
    .filter((x) => legacyPackName(st, x) || (!valid.includes(x) && savedPackName(st, x))))];
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
const TRACK_MARKER = { saas: "[SaaS]", ai: "[AI]", sec: "[SEC]", privacy: "[PRIVACY]", dist: "[DIST]" };
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
// The marker tracks' mandatory design sections — the ONE table doctor, approve, status, the roadmap and the design-save
// check read (a marker track = a TRACK_MARKER entry + its table here).
const TRACK_SECTIONS = { saas: SAAS_SECTIONS, ai: AI_SECTIONS, sec: SEC_SECTIONS, privacy: PRIVACY_SECTIONS, dist: DIST_SECTIONS };
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
  TRACK_ALIASES, suggestTrack, unknownTracksError, trackLabel, packTracks, packOf, isPackTrack, allTracks,
  optionalTracks, markerTracks, trackMarker, trackSectionTable, trackSteeringFiles, trackSignalTable,
  isPackMarkerBracket, packMarkersFor, noteGhostPacks, ghostMarkers, savedPackName, legacyPackName, missingPackTracks,
  detectTracks, savedTracks, headingHasMarker, TRACK_MARKER, MARKER_TRACKS, trackAcIds, normTaskHeading, TASK_HEADINGS,
  trackTaskHeadings, trackTaskHeadingIs, trackTaskHeading, activeTasks, sectionDropLines, inactiveTaskLines,
  inactiveMarkerLines, RE_ACTIVE_TRACKS, trackRunSource, RE_TRACK_RUN, trackRunRe, SAAS_SECTIONS, AI_SECTIONS,
  SEC_SECTIONS, PRIVACY_SECTIONS, DIST_SECTIONS, TRACK_SECTIONS, activeSectionTracks, activeDesign, __link };
