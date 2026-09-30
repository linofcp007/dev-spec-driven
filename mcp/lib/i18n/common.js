"use strict";

/**
 * dev-spec-driven i18n — what every language shares: the language codes (BASE_LANGS / LANGS, canonicalLang,
 * normalizeLang, baseLang), the template's track criteria and the order the builders render them in (TEMPLATE_ACS,
 * MARKER_TRACK_ORDER, signalTracks), and the template test IDs / rows every language's builders number alike
 * (templateTests, greenLine, templateTestRows). Zero-dependency, data-only.
 *
 * Part of the localized content behind mcp/lib/i18n.js (the facade, which assembles the tables and is what the engine
 * requires): each authored language's blocks live in i18n/en.js · pt.js · es.js (they require this file at load time),
 * the pt-BR derivation in i18n/pt-br.js. The language model and the English-stable tokens are described in i18n.js.
 */

const path = require("path");

// 1.21 F3 — the CLI line a person can RUN. A plugin install puts no `dev-spec` on PATH (only `npm link` does), so a message
// that tells someone to run the CLI names THIS clone's script — `${DEV_SPEC} done <f> <n> --run` in every language, never
// a bare `dev-spec done …` (the 1.19 eval run relayed exactly that to a user, who could not run it). The path is resolved
// from this file's place (mcp/lib/i18n/ → the clone root), with forward slashes (bash, PowerShell and cmd.exe all read
// them). Quoted to paste as is into bash AND PowerShell: double quotes, unless the path holds a character one of them
// expands or ends a string on there (" $ ` ! and the curly double quotes PowerShell also reads) — then single quotes
// (literal in both); a path that also holds a single quote gets a <placeholder> (no quoting survives both shells).
// Text written into a COMMITTED file (ROADMAP.md, SPECS.md, UPGRADE.md, the exports, retro.md) goes through portableCli():
// a machine path never lands in git — there the CLI keeps its name, `dev-spec`.
const RE_CLI_UNSAFE_DOUBLE = /["$`!“”„]/;
const RE_CLI_UNSAFE_SINGLE = /['‘’‚‛]/;
function cliQuote(p) {
  const s = String(p).replace(/\\/g, "/");
  if (!RE_CLI_UNSAFE_DOUBLE.test(s)) return '"' + s + '"';
  if (!RE_CLI_UNSAFE_SINGLE.test(s)) return "'" + s + "'";
  return '"<dev-spec-driven>/cli/dev-spec.js"';
}
const DEV_SPEC_SCRIPT = path.resolve(__dirname, "..", "..", "..", "cli", "dev-spec.js").replace(/\\/g, "/");
// `node "<clone>/cli/dev-spec.js"` — the runnable stand-in for `dev-spec` (a message appends the subcommand and its arguments).
const cliPrefix = (script) => "node " + cliQuote(script || DEV_SPEC_SCRIPT);
const DEV_SPEC = cliPrefix();
// The runnable line → its portable form, for a file meant to be committed — as written, or HTML-escaped (ROADMAP.html and
// the HTML export escape its quotes).
const DEV_SPEC_HTML = DEV_SPEC.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function portableCli(text) {
  if (typeof text !== "string") return text;
  let s = text;
  if (s.includes(DEV_SPEC)) s = s.split(DEV_SPEC).join("dev-spec");
  if (DEV_SPEC_HTML !== DEV_SPEC && s.includes(DEV_SPEC_HTML)) s = s.split(DEV_SPEC_HTML).join("dev-spec");
  return s;
}

// The AUTHORED locales (one hand-written block each in BUILD / STEERING / MSG / BRIEF / EVALS_README — i18n/<lang>.js) and
// every locale the engine speaks: pt-BR (1.14 D1) is DERIVED from pt — see "pt-BR — a derived locale" in i18n/pt-br.js.
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
  dist: ["US-1.AC-16", "US-1.AC-17", "US-1.AC-18", "US-1.AC-19"], // +dist (1.17 D)
  api: ["US-1.AC-20", "US-1.AC-21", "US-1.AC-22", "US-1.AC-23"], // +api (1.19 T)
  ui: ["US-1.AC-24", "US-1.AC-25", "US-1.AC-26", "US-1.AC-27"], // +ui (1.19 T)
  obs: ["US-1.AC-28", "US-1.AC-29", "US-1.AC-30", "US-1.AC-31"] }; // +obs (1.19 T)
// The optional tracks whose template criteria / tasks / sections follow the core ones, in track order.
const MARKER_TRACK_ORDER = ["saas", "ai", "sec", "privacy", "dist", "api", "ui", "obs"];
// The tracks classification.md lists signals for: +tdd, the built-in marker tracks, then a project's track packs (1.15 — any
// other name in the feature's track list), in its order.
function signalTracks(tracks) {
  const builtIn = ["core", "tdd", ...MARKER_TRACK_ORDER];
  return ["tdd", ...MARKER_TRACK_ORDER, ...(tracks || []).filter((t) => typeof t === "string" && !builtIn.includes(t))];
}
// 1.21 F5 — feature sizes (spec_create {size}): xs is the one-file change (change.md), s a one-story scaffold, m / l today's
// chain with the duplicates merged. No size = the 1.20 scaffolds, byte for byte (every builder takes `a.size` undefined).
const FEATURE_SIZES = ["xs", "s", "m", "l"];
// The core template criteria of a size: S keeps one story with two criteria — AC-1 (WHEN) and AC-2 (IF…THEN, the error path);
// the track criteria keep their numbers at every size (US-1.AC-5… — a gap after AC-2 is fine: IDs are stable, not contiguous).
const SIZE_CORE_ACS = { s: ["US-1.AC-1", "US-1.AC-2"] };
function coreTemplateAcs(size) {
  return Object.prototype.hasOwnProperty.call(SIZE_CORE_ACS, size) ? SIZE_CORE_ACS[size] : TEMPLATE_ACS.core;
}
// Core design sections a track's own sections supersede on a SIZED scaffold (P4 — DATA: a track that owns a concern the core
// design also asks about): the builders leave the core section out when one of its tracks is on. Keys = the core sections every
// language's design builder names; values = the tracks that supersede them. A new built-in track adds its entry here.
const CORE_SUPERSEDED_BY = { apiContracts: ["api"], errorHandling: ["api"], securityConsiderations: ["sec"], testingStrategy: ["tdd"] };
const coreSuperseded = (a, key) => !!a.size && (CORE_SUPERSEDED_BY[key] || []).some((t) => (a.tracks || []).includes(t));
function templateTests(tracks, size) {
  const ids = {};
  let n = 0;
  for (const t of Object.keys(TEMPLATE_ACS)) {
    if (t !== "core" && !(tracks || []).includes(t)) continue;
    for (const ac of t === "core" ? coreTemplateAcs(size) : TEMPLATE_ACS[t]) ids[ac] = "T-" + String(++n).padStart(2, "0");
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
function templateTestRows(tracks, row, L, acs, size) {
  if (Array.isArray(acs) && acs.length) {
    return acs.map((ac, i) => row("T-" + String(i + 1).padStart(2, "0"), "unit", "example", L.behavior, ac, "tests/unit/...")).join("\n");
  }
  // An EMPTY list: requirements.md was written and defines no AC ID (an import without criteria) — one generic row whose
  // Covers cell is a slot, never the template's US-1.AC-1… rows (phantoms for trace_check). 1.14 full review Pa4.
  if (Array.isArray(acs)) return row("T-01", "unit", "example", L.behavior, L.acSlot, "tests/unit/...");
  const T = templateTests(tracks, size);
  const r = (ac, layer, desc, file, kind = "example") => row(T[ac], layer, kind, desc, ac, file);
  // 1.21 F5: size S — its two core criteria (AC-2 is the IF…THEN error path there)
  const rows = size === "s" ? [r("US-1.AC-1", "unit", L.behavior, "tests/unit/..."), r("US-1.AC-2", "unit", L.recovery, "tests/unit/...")]
    : [r("US-1.AC-1", "unit", L.behavior, "tests/unit/..."), r("US-1.AC-2", L.integration, L.behavior, "tests/integration/..."),
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
  // +api (1.19 T): contract tests against the spec; an Idempotency-Key replay has one effect however often it is repeated → property;
  // the breaking-change diff compares the contract with the published one.
  if (T["US-1.AC-20"]) rows.push(r("US-1.AC-20", L.contract, L.problemJson, "tests/contract/..."),
    r("US-1.AC-21", L.integration, L.idempotencyReplay, "tests/integration/...", "property"), r("US-1.AC-22", L.integration, L.staleEtag, "tests/integration/..."),
    r("US-1.AC-23", L.contract, L.breakingDiff, "tests/contract/..."));
  // +ui (1.19 T): a keyboard-only walk-through + an automated accessibility check (e2e); a form keeps every value for any set of
  // invalid fields → property; the view's states under visual regression; a failed load keeps what was shown.
  if (T["US-1.AC-24"]) rows.push(r("US-1.AC-24", "e2e", L.keyboardA11y, "tests/e2e/..."),
    r("US-1.AC-25", L.component, L.formErrors, "tests/component/...", "property"), r("US-1.AC-26", L.visual, L.emptyState, "tests/visual/..."),
    r("US-1.AC-27", L.component, L.loadError, "tests/component/..."));
  // +obs (1.19 T): every request emits its telemetry → property; an alert fires in a staged failure, a rollback drill, fault injection.
  if (T["US-1.AC-28"]) rows.push(r("US-1.AC-28", L.integration, L.telemetry, "tests/integration/...", "property"),
    r("US-1.AC-29", L.integration, L.burnAlert, "tests/integration/..."), r("US-1.AC-30", L.integration, L.rollbackDrill, "tests/integration/..."),
    r("US-1.AC-31", L.integration, L.readiness, "tests/integration/..."));
  return rows.join("\n");
}


module.exports = { BASE_LANGS, LANGS, LANG_ALIASES, canonicalLang, normalizeLang, baseLang, TEMPLATE_ACS, MARKER_TRACK_ORDER, signalTracks, templateTests, greenLine, templateTestRows,
  cliQuote, cliPrefix, DEV_SPEC_SCRIPT, DEV_SPEC, portableCli, FEATURE_SIZES, SIZE_CORE_ACS, coreTemplateAcs, CORE_SUPERSEDED_BY, coreSuperseded };
