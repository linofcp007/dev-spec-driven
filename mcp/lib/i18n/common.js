"use strict";

/**
 * dev-spec-driven i18n — the language codes and the template test IDs every language's builders share.
 */
/**
 * dev-spec-driven — localized scaffold content (EN / PT / ES, plus pt-BR DERIVED from PT — see "pt-BR — a derived
 * locale" near the end). Zero-dependency, data-only.
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
 *   AC/SC/test IDs (US-1.AC-1, SC-001, T-01, EC-1, NFR-1), section markers ([SaaS], [AI], [SEC], [PRIVACY], [DIST]),
 *   story/parallel tags ([US1], [US2], [shared], [P]), the unfilled sentinel `> **TODO**`,
 *   `[NEEDS CLARIFICATION]`, the annotation tags `_Requirements:_ / _Makes green:_ /
 *   _Affects evals:_ / _Emits metrics:_ / _Implements:_`, `**Checkpoint:**`, the ```mermaid /
 *   ```typescript fences, the eval-harness headings `## System` / `## User Template`, and the test-plan
 *   Kind values (example / property).
 * EARS modal/keywords ARE localized (WHEN→QUANDO→CUANDO, THE SYSTEM SHALL→O SISTEMA DEVE→
 * EL SISTEMA DEBE, …) because earsValidate recognizes all three languages. Translated headings
 * are matched by the synonym tables (SAAS_SECTIONS/AI_SECTIONS/SEC_SECTIONS/PRIVACY_SECTIONS/DIST_SECTIONS) and RE_* matchers in spec.js.
 */

// The AUTHORED locales (one hand-written block each in BUILD / STEERING / MSG / BRIEF / EVALS_README) and every locale the
// engine speaks: pt-BR (1.14 D1) is DERIVED from pt — see "pt-BR — a derived locale" near the end of this file.
const BASE_LANGS = ["en", "pt", "es"];
const LANGS = [...BASE_LANGS, "pt-BR"];
// The strict reading every surface validates with (MCP `lang` enum, CLI --lang, templates): a known code or alias → the
// canonical code, anything else → null. pt / pt-PT / pt_PT stay European Portuguese; pt-BR / pt_BR / pt-br / ptbr → pt-BR.
const LANG_ALIASES = { "pt-pt": "pt", pt_pt: "pt", "pt-br": "pt-BR", pt_br: "pt-BR", ptbr: "pt-BR" };
function canonicalLang(l) {
  if (typeof l !== "string") return null;
  const s = l.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(LANG_ALIASES, s)) return LANG_ALIASES[s];
  return BASE_LANGS.includes(s) ? s : null;
}
// The lenient reading the engine stores and renders with: a canonical code, else its first two letters (es-MX → es,
// en-US → en), else en.
function normalizeLang(l) {
  const c = canonicalLang(String(l == null || l === "" ? "en" : l));
  if (c) return c;
  const s = String(l || "en").toLowerCase().slice(0, 2);
  return BASE_LANGS.includes(s) ? s : "en";
}
// The language family (pt-BR → pt): what grammar-level rules (the classifier's "no" = em+o) follow.
function baseLang(l) {
  return normalizeLang(l).slice(0, 2);
}

// The template's test IDs: one per template AC of the active tracks, numbered in the order the requirements template
// lists them. The test-plan and tasks builders (every language) share it, so a fresh +tdd scaffold plans a test for
// every AC and every planned test is made green by a task (it used to start with AC-3/AC-4/US-2.AC-1 uncovered and
// T-02 unmapped).
const TEMPLATE_ACS = { core: ["US-1.AC-1", "US-1.AC-2", "US-1.AC-3", "US-1.AC-4", "US-2.AC-1"], saas: ["US-1.AC-5", "US-1.AC-6"], ai: ["US-1.AC-7", "US-1.AC-8", "US-1.AC-9"],
  sec: ["US-1.AC-10", "US-1.AC-11", "US-1.AC-12"], privacy: ["US-1.AC-13", "US-1.AC-14", "US-1.AC-15"],
  dist: ["US-1.AC-16", "US-1.AC-17", "US-1.AC-18", "US-1.AC-19"] }; // +dist (1.17 D)
// The optional tracks whose template criteria / tasks / sections follow the core ones, in track order.
const MARKER_TRACK_ORDER = ["saas", "ai", "sec", "privacy", "dist"];
// The tracks classification.md lists signals for: +tdd, the built-in marker tracks, then a project's track packs (1.15 — any
// other name in the feature's track list), in its order.
function signalTracks(tracks) {
  const builtIn = ["core", "tdd", ...MARKER_TRACK_ORDER];
  return ["tdd", ...MARKER_TRACK_ORDER, ...(tracks || []).filter((t) => typeof t === "string" && !builtIn.includes(t))];
}
function templateTests(tracks) {
  const ids = {};
  let n = 0;
  for (const t of Object.keys(TEMPLATE_ACS)) {
    if (t !== "core" && !(tracks || []).includes(t)) continue;
    for (const ac of TEMPLATE_ACS[t]) ids[ac] = "T-" + String(++n).padStart(2, "0");
  }
  return ids;
}
// `_Makes green: T-0x, …_` for these template ACs — only on a +tdd scaffold (green = templateTests, else null).
function greenLine(green, ...acs) {
  return green ? "\n  - _Makes green: " + acs.map((ac) => green[ac]).join(", ") + "_" : "";
}
// The test-plan matrix rows of the template ACs — row(testId, layer, kind, description, acId, file) formats one per
// language, L holds that language's layer names and descriptions. Kind stays English-stable (example | property): the
// ubiquitous AC-4 ("always-true property") and tenant isolation ("never") are invariants, the event-driven ones examples.
// acs: the feature's REAL AC IDs (a test plan scaffolded after requirements.md was written — spec_add_track tdd): one
// generic row each (T-01…, unit, example, [behavior]) instead of the template's, whose IDs the feature may not define.
function templateTestRows(tracks, row, L, acs) {
  if (Array.isArray(acs) && acs.length) {
    return acs.map((ac, i) => row("T-" + String(i + 1).padStart(2, "0"), "unit", "example", L.behavior, ac, "tests/unit/...")).join("\n");
  }
  // An EMPTY list: requirements.md was written and defines no AC ID (an import without criteria) — one generic row whose
  // Covers cell is a slot, never the template's US-1.AC-1… rows (phantoms for trace_check). 1.14 full review Pa4.
  if (Array.isArray(acs)) return row("T-01", "unit", "example", L.behavior, L.acSlot, "tests/unit/...");
  const T = templateTests(tracks);
  const r = (ac, layer, desc, file, kind = "example") => row(T[ac], layer, kind, desc, ac, file);
  const rows = [r("US-1.AC-1", "unit", L.behavior, "tests/unit/..."), r("US-1.AC-2", L.integration, L.behavior, "tests/integration/..."),
    r("US-1.AC-3", "unit", L.recovery, "tests/unit/..."), r("US-1.AC-4", "unit", L.property, "tests/unit/...", "property"),
    r("US-2.AC-1", L.integration, L.behavior, "tests/integration/...")];
  if (T["US-1.AC-5"]) rows.push(r("US-1.AC-5", L.integration, L.tenant, "tests/integration/...", "property"), r("US-1.AC-6", L.load, L.latency, "load-test.md"));
  if (T["US-1.AC-7"]) rows.push(r("US-1.AC-7", "eval", L.golden, "evals/golden.json"), r("US-1.AC-8", "eval", L.injection, "evals/adversarial.json"),
    r("US-1.AC-9", L.integration, L.cost, "tests/integration/..."));
  // +sec: abuse-case tests; "never" rules (cross-user access, secrets in output) are invariants → property.
  if (T["US-1.AC-10"]) rows.push(r("US-1.AC-10", L.integration, L.unauthenticated, "tests/integration/..."),
    r("US-1.AC-11", L.integration, L.forbidden, "tests/integration/...", "property"), r("US-1.AC-12", L.integration, L.noSecrets, "tests/integration/...", "property"));
  if (T["US-1.AC-13"]) rows.push(r("US-1.AC-13", L.integration, L.exportData, "tests/integration/..."), r("US-1.AC-14", L.integration, L.erasure, "tests/integration/..."),
    r("US-1.AC-15", "unit", L.retention, "tests/unit/..."));
  // +dist (1.17 D): failure-injection tests; "exactly one effect" and "no lost update" hold for every delivery count /
  // interleaving → property.
  if (T["US-1.AC-16"]) rows.push(r("US-1.AC-16", L.integration, L.outboxCrash, "tests/integration/..."),
    r("US-1.AC-17", L.integration, L.duplicateDelivery, "tests/integration/...", "property"), r("US-1.AC-18", L.integration, L.lostUpdate, "tests/integration/...", "property"),
    r("US-1.AC-19", L.integration, L.dependencyDown, "tests/integration/..."));
  return rows.join("\n");
}


module.exports = { BASE_LANGS, LANGS, LANG_ALIASES, canonicalLang, normalizeLang, baseLang, TEMPLATE_ACS, MARKER_TRACK_ORDER, signalTracks, templateTests, greenLine, templateTestRows };
