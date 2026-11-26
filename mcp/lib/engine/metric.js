"use strict";

/**
 * dev-spec-driven engine — the METRIC line (metric-lines/1, 1.41): the number a check prints that can get worse while every
 * test stays green.
 *   metricLinesOf(text | [text…])  the reader — the contract is mcp/tests/fixtures/metric-lines.v1.json, which dev-guardian 3.17's
 *                                  reader passes too (DECISIONS 3b: one set of bounds, the walk from the END with indexOf)
 *   judgeMetric(reference, current) one judge rule: the REFERENCE's terms, the current line may only tighten, no defaults,
 *                                  exact decimals (BigInt-scaled)
 *   finishMetrics(…)               spec_finish's comparison: each (check, name) a project check's passing run printed, against the
 *                                  latest OTHER finish that recorded it (finished.at) — warnings, never a blocker
 *   walkFeatureStates · measuredBlock  spec_metrics' ONE walk over every feature folder (active, then archived), each state read
 *                                  once, and the `measured` block (the series across finishes) it feeds
 * Only the CLI reads METRIC lines (`done --run` / `finish --run` hand the full output, ranBy "cli"); a reading is stored on the
 * LATEST run only, never in its history (docs/maintainers/tasks-and-evidence.md → Metrics that regress silently).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let featureDirs, stateFromFile, statePath, isObj, timeOf, round1, dayOf, activeDesign, readIfExists, weighSection, SILENT_SYN, stripHtmlComments,
  stripFencedCode;
function __link(E) { ({ featureDirs, stateFromFile, statePath, isObj, timeOf, round1, dayOf, activeDesign, readIfExists, weighSection, SILENT_SYN,
  stripHtmlComments, stripFencedCode } = E); }

// ---------------------------------------------------------------------------
// The line — metric-lines/1 (CRIT_X D1). The fixture's grammar, once: 17-docs pins references/verification.md's line to it.
// ---------------------------------------------------------------------------
const METRIC_GRAMMAR = "METRIC <name>=<number>[ <unit>][ better=lower|higher][ tolerance=<n>[%]][ <key>=<value>...]";
// ONE set of bounds (the fixture's `bounds`): the last readBytes of the output read (a character is at least one byte: run.js's
// cap is bytes), a candidate line of at most candidateBytes, at most `candidates` candidate lines walked from the END, at most
// `names` names kept — each says it dropped input (`dropped`, in this order).
const METRIC_BOUNDS = Object.freeze({ readBytes: 64 * 1024 * 1024, candidateBytes: 512, candidates: 1000, names: 20 });
const BOUND_ORDER = ["readBytes", "candidateBytes", "candidates", "names"];
const RE_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/;
const NUMBER = "-?(?:0|[1-9][0-9]{0,14})(?:\\.[0-9]{1,9})?(?:[eE][-+]?[0-9]{1,3})?";
const RE_NUMBER = new RegExp("^" + NUMBER + "$");
const RE_TOLERANCE = new RegExp("^(" + NUMBER.slice(2) + ")(%?)$"); // the number without a sign: a tolerance is never negative
const RE_AMOUNT = new RegExp("^" + NUMBER.slice(2) + "$"); // a tolerance's printed amount, read back (readingOf)
const UNIT_MAX = 16; // code points (an astral character is one — dev-guardian 3.17's count, R1-MF-4)
// (past 2 × UNIT_MAX UTF-16 units a text holds more than UNIT_MAX code points: no array is built for a long one)
const unitFits = (u) => u.length <= 2 * UNIT_MAX && [...u].length <= UNIT_MAX;
const KEYWORD = "METRIC";
const ESC = String.fromCharCode(27);
const RE_CSI = new RegExp(ESC + "\\[[0-?]*[ -/]*[A-Za-z]", "g"); // a CSI sequence (ESC [ params intermediates, a final LETTER) — 3b(9)
const RE_CSI_AT = new RegExp(RE_CSI.source, "y"); // the same sequence at one index (visibleLine's lone sequence)
const CLEAN_CHUNK = 4096; // the UTF-16 units of a candidate line cleaned at a time (visibleLine)
// the keyword at a line's start, after blanks and one '# ' (never blanks after it), then a blank or the line's end (a bare METRIC)
const RE_CANDIDATE = /^[ \t]*(?:# )?METRIC(?=[ \t]|$)/;
const RE_CONTROL = /[\u0000-\u001f\u007f]+/g;

// The index the line of the keyword at i starts at, when only blanks, '#' and CSI sequences stand before it on that line — a
// pre-filter, linear over the whole walk (a scan stops at the first other character: an earlier "METRIC" stops it at its 'C', so
// two scans never cross), its CSI test any final byte (a superset of RE_CSI's letters); RE_CANDIDATE on the cleaned line then
// decides, and the candidate bound is the cleaned line's (R1-MF-4: a colour never counts). → the start · -1 (not a line start) · -3
// (blanks or '#' up to the read's first character, which is no line start: the read bound cut what may be a candidate — said as readBytes)
function lineStartOf(s, i, lo) {
  const floor = lo;
  let j = i;
  while (j > floor) {
    const c = s.charCodeAt(j - 1);
    if (c === 10) return j;
    if (c === 32 || c === 9 || c === 35) { j--; continue; }
    if (c >= 0x40 && c <= 0x7e) { // a CSI sequence's final byte: back over its parameters to "ESC ["
      let k = j - 2;
      while (k > floor && s.charCodeAt(k) >= 0x20 && s.charCodeAt(k) <= 0x3f) k--;
      if (k > floor && s.charCodeAt(k) === 0x5b && s.charCodeAt(k - 1) === 27) { j = k - 1; continue; }
    }
    return -1;
  }
  if (lo === 0 || s.charCodeAt(lo - 1) === 10) return lo; // the read's first line is whole only at a line start
  const c = s.charCodeAt(lo - 1);
  return c === 32 || c === 9 || c === 35 ? -3 : -1;
}

// The candidate line s[start, end) with its CSI sequences removed, read only as far as the candidate bound needs (1.41.0 review 2: a
// long coloured line was stripped whole first): its head up to the keyword's end (kwEnd) whole — what lineStartOf walked; no sequence
// crosses kwEnd, the keyword's 'M' ends any sequence before it —, then CLEAN_CHUNK units at a time until the text holds more than
// candidateBytes units AND a character past the keyword: then it is over the bound (a UTF-16 unit is at least one UTF-8 byte) and
// RE_CANDIDATE reads the same characters as on the whole line. A chunk ends before its last ESC, so no sequence is split (a sequence
// holds no other ESC); a chunk that starts with its only ESC reads that sequence alone — its parameters may run past the chunk. A line
// of at most CLEAN_CHUNK units is cleaned whole, as before (its cost is a chunk's; a short line pays no head and chunk apart — a cost
// guard, its mutant equivalent in verdicts: 6 Mi `#METRIC x` lines read in ~1.5× the time without it).
function visibleLine(s, start, kwEnd, end) {
  if (end - start <= CLEAN_CHUNK) { const raw = s.slice(start, end); return raw.indexOf(ESC) === -1 ? raw : raw.replace(RE_CSI, ""); }
  const head = s.slice(start, kwEnd);
  let out = head.indexOf(ESC) === -1 ? head : head.replace(RE_CSI, "");
  const enough = Math.max(METRIC_BOUNDS.candidateBytes, out.length);
  let pos = kwEnd;
  while (pos < end && out.length <= enough) {
    let chunk = s.slice(pos, Math.min(end, pos + CLEAN_CHUNK));
    const esc = chunk.lastIndexOf(ESC);
    if (esc === 0) {
      RE_CSI_AT.lastIndex = pos; // (a sequence never holds an LF or a CR: a match ends before `end`)
      if (RE_CSI_AT.test(s)) { pos = RE_CSI_AT.lastIndex; continue; }
    } else if (esc > 0) chunk = chunk.slice(0, esc);
    out += esc === -1 ? chunk : chunk.replace(RE_CSI, "");
    pos += chunk.length;
  }
  return out;
}

// One candidate line (CSI removed) → { kind: "metric", reading } · { kind: "malformed" } · { kind: "ignored" }.
function readLine(line) {
  const m = RE_CANDIDATE.exec(line);
  if (!m) return { kind: "ignored" };
  const tokens = line.slice(m[0].length).split(/[ \t]+/).filter((t) => t !== "");
  if (!tokens.length || !tokens[0].includes("=")) return { kind: "ignored" }; // no attempt: a table header, a JSON payload, a log line
  const eq = tokens[0].indexOf("=");
  const name = tokens[0].slice(0, eq), num = tokens[0].slice(eq + 1);
  if (!RE_NAME.test(name) || !RE_NUMBER.test(num)) return { kind: "malformed" };
  const value = Number(num);
  if (!Number.isFinite(value)) return { kind: "malformed" };
  // text: the decimal as the line printed it — what the judge compares (R1-MF-5: past 15 significant digits a double drops digits)
  const r = { name, value, text: num, unit: null, better: null, tolerance: null };
  const known = new Set();
  for (let k = 1; k < tokens.length; k++) {
    const t = tokens[k], at = t.indexOf("=");
    if (at === -1) { // a unit: one token, right after the number, at most UNIT_MAX code points
      if (k !== 1 || !unitFits(t)) return { kind: "malformed" };
      r.unit = t;
      continue;
    }
    const key = t.slice(0, at), v = t.slice(at + 1);
    if (key !== "better" && key !== "tolerance") continue; // an unknown key: ignored (G3's runs=, spread=…)
    if (known.has(key)) return { kind: "malformed" }; // a known key twice: which one?
    known.add(key);
    if (key === "better") {
      if (v !== "lower" && v !== "higher") return { kind: "malformed" };
      r.better = v;
    } else {
      const tm = RE_TOLERANCE.exec(v);
      const amount = tm ? Number(tm[1]) : NaN;
      if (!Number.isFinite(amount)) return { kind: "malformed" };
      r.tolerance = { amount, percent: tm[2] === "%", text: tm[1] }; // text: the amount as printed, as a value's (R1-DG-H-7)
    }
  }
  return { kind: "metric", reading: r };
}

// The METRIC lines of a run's output (a string, or the outputs of several commands in run order — a later one wins) →
// { metrics: [{name, value, text, unit, better, tolerance}] in print order (each name's last valid line, whole), repeats (the lines a
// later one of the same name replaced), malformed (failed attempts), dropped: [the bounds that dropped input], lastMalformed? }.
// Walked from the END with lastIndexOf — never a split (a 64 MiB output costs a scan, no copy) —, so the bounds keep what was
// printed LAST: a benchmark loop's final iteration. 3b(7): a later malformed line of a name read stays malformed; the last valid
// reading stands. 3b(5): names live in a Map — `__proto__` is an ordinary name.
function metricLinesOf(input) {
  const texts = (Array.isArray(input) ? input : [input]).map((t) => (typeof t === "string" ? t : ""));
  const B = METRIC_BOUNDS;
  const kept = new Map(); // name → { reading, ti, at }
  const dropped = new Set();
  let repeats = 0, malformed = 0, candidates = 0, budget = B.readBytes, lastMalformed = null, stop = false;
  for (let ti = texts.length - 1; ti >= 0 && !stop; ti--) {
    const s = texts[ti];
    if (budget <= 0) { if (s.indexOf(KEYWORD) !== -1) dropped.add("readBytes"); continue; }
    const lo = s.length > budget ? s.length - budget : 0;
    if (lo > 0 && s.lastIndexOf(KEYWORD, lo - 1) !== -1) dropped.add("readBytes");
    budget -= s.length - lo;
    let from = s.length - KEYWORD.length;
    while (from >= lo) {
      const i = s.lastIndexOf(KEYWORD, from);
      if (i < lo) break;
      from = i - 1;
      const next = s.charCodeAt(i + KEYWORD.length);
      // METRICS, METRIC=…: no keyword; a bare METRIC (LF, CR, the text's end after it) is one — a candidate, as dev-guardian 3.17 counts it
      if (next !== 32 && next !== 9 && next !== 27 && next !== 10 && next !== 13 && i + KEYWORD.length !== s.length) continue;
      const start = lineStartOf(s, i, lo);
      if (start === -1) continue;
      if (start === -3) { dropped.add("readBytes"); continue; }
      // the candidate line: from its start to its LF (ONE CR before it dropped — or at the text's end, no LF after it: dev-guardian
      // 3.17's line end too), its CSI sequences removed — the candidate bound is
      // the CLEANED line's bytes (R1-MF-4, as dev-guardian 3.17 reads it: a colour never pushes a line over), counted as it is cleaned
      // (visibleLine: past the bound it stops — `line` is then a prefix over it). Each line is read once: only its first keyword can
      // follow nothing but blanks, '#' and CSI sequences.
      const nl = s.indexOf("\n", i);
      let end = nl === -1 ? s.length : nl;
      if (s.charCodeAt(end - 1) === 13) end--;
      const line = visibleLine(s, start, i + KEYWORD.length, end);
      if (!RE_CANDIDATE.test(line)) continue; // "## METRIC", "#METRIC", "#  METRIC", a '#' run of any length: no candidate
      if (candidates === B.candidates) { dropped.add("candidates"); stop = true; break; }
      candidates++;
      // 3b(6): over the bound is a drop, never malformed (a UTF-16 unit is at least one UTF-8 byte: the length decides most lines)
      if (line.length > B.candidateBytes || Buffer.byteLength(line, "utf8") > B.candidateBytes) { dropped.add("candidateBytes"); continue; }
      const got = readLine(line);
      if (got.kind === "ignored") continue;
      if (got.kind === "malformed") {
        malformed++;
        if (lastMalformed === null) lastMalformed = line.replace(RE_CONTROL, " ").trim().slice(0, 120);
        continue;
      }
      const name = got.reading.name;
      if (kept.has(name)) { repeats++; continue; } // an earlier line of a name a later one replaced
      if (kept.size === B.names) { dropped.add("names"); continue; }
      kept.set(name, { reading: got.reading, ti, at: i });
    }
  }
  const metrics = [...kept.values()].sort((a, b) => a.ti - b.ti || a.at - b.at).map((k) => k.reading);
  const out = { metrics, repeats, malformed, dropped: BOUND_ORDER.filter((b) => dropped.has(b)) };
  if (lastMalformed !== null) out.lastMalformed = lastMalformed;
  return out;
}

// ---------------------------------------------------------------------------
// The judge — CRIT_X D2 + DECISIONS 3b: the REFERENCE's terms; the current line may only tighten (the smaller stated tolerance);
// a flipped / dropped better=, a raised / dropped tolerance or a changed unit is ONE `loosened` term (unit, then better, then
// tolerance), judged by the reference's terms (a changed unit is not compared); no defaults — judged only when the REFERENCE
// states a direction AND a tolerance, else `unjudged` with its delta and `why` (the reference's missing terms); n% is n percent
// of |reference|; the boundary inclusive; symmetric (3b.1): improved / regressed only past the applied tolerance.
// ---------------------------------------------------------------------------
// A reading's printed text — or a JS number — as an exact decimal { n: BigInt, s: scale } (value = n / 10^s). A number is read
// by its shortest round-trip text, which is the printed decimal only up to 15 significant digits: the grammar prints up to 24
// (15 integer + 9 fraction digits), so the judge reads the line's own text when both readings carry one (R1-MF-5) — a tolerance's
// too (R1-DG-H-7).
function decimalOf(v) {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([-+]?\d+))?$/i.exec(String(v)); // a finite number always matches (readingOf, the grammar)
  const frac = m[3] || "";
  let n = BigInt(m[2] + frac);
  let s = frac.length - (m[4] ? parseInt(m[4], 10) : 0);
  if (s < 0) { n *= 10n ** BigInt(-s); s = 0; }
  return { n: m[1] ? -n : n, s };
}
const scaled = (d, s) => d.n * 10n ** BigInt(s - d.s);
const absBig = (x) => (x < 0n ? -x : x);
// {n, s} → a JS number, read from its exact decimal text
function numberOf(n, s) {
  const neg = n < 0n, digits = absBig(n).toString().padStart(s + 1, "0");
  return Number((neg ? "-" : "") + (s ? digits.slice(0, -s) + "." + digits.slice(-s) : digits));
}
// a tolerance as an absolute amount, exact: n% is n percent of |reference| — its printed text when `exact`, else its number
function toleranceAmount(t, ref, exact) {
  const a = decimalOf(exact ? t.text : t.amount);
  return t.percent ? { n: absBig(ref.n) * a.n, s: ref.s + a.s + 2 } : a;
}
// → { verdict: new · within · improved · regressed · unjudged, why: null | [better · tolerance · unit], loosened: null | term,
// delta: null | number, applied: null | number } — the fixture's `judge` shape. ref null: no earlier reading.
function judgeMetric(ref, cur) {
  const out = { verdict: "new", why: null, loosened: null, delta: null, applied: null };
  if (!ref) return out;
  // the printed texts when BOTH readings carry one (a reading without — a hand edit, another writer — is judged on the two values)
  const exact = ref.text != null && cur.text != null;
  const R = decimalOf(exact ? ref.text : ref.value), C = decimalOf(exact ? cur.text : cur.value);
  const why = [];
  if (ref.better == null) why.push("better");
  if (ref.tolerance == null) why.push("tolerance");
  const unitChanged = ref.unit !== cur.unit; // (a reading's absent term is always null — the reader's and readingOf's shape)
  // the tolerances the same way (R1-DG-H-7): their printed texts when every tolerance the two lines state carries one — a line stating
  // none needs none —, else both on their numbers
  const tolExact = [ref.tolerance, cur.tolerance].every((t) => t == null || t.text != null);
  const refTol = ref.tolerance ? toleranceAmount(ref.tolerance, R, tolExact) : null, curTol = cur.tolerance ? toleranceAmount(cur.tolerance, R, tolExact) : null;
  const S = Math.max(R.s, C.s, refTol ? refTol.s : 0, curTol ? curTol.s : 0);
  const tolLoose = !!refTol && (!curTol || scaled(curTol, S) > scaled(refTol, S));
  const betterLoose = ref.better != null && cur.better !== ref.better;
  out.loosened = unitChanged ? "unit" : betterLoose ? "better" : tolLoose ? "tolerance" : null;
  if (unitChanged) return Object.assign(out, { verdict: "unjudged", why: why.concat(["unit"]) }); // not compared: no delta
  const delta = scaled(C, S) - scaled(R, S);
  out.delta = numberOf(delta, S);
  if (why.length) return Object.assign(out, { verdict: "unjudged", why });
  const applied = curTol && scaled(curTol, S) < scaled(refTol, S) ? scaled(curTol, S) : scaled(refTol, S);
  out.applied = numberOf(applied, S);
  const worse = ref.better === "lower" ? delta > 0n : delta < 0n;
  out.verdict = absBig(delta) <= applied ? "within" : worse ? "regressed" : "improved";
  return out;
}

// ---------------------------------------------------------------------------
// Readings in the state: an ARRAY (never an object keyed by name — no name is a prototype key there either), null terms left out.
// ---------------------------------------------------------------------------
// a reading as stored: {name, value, text?, unit?, better?, tolerance?} (+ check: finished.metrics' entries)
function storedReading(r, check) {
  const o = check ? { check, name: r.name, value: r.value } : { name: r.name, value: r.value };
  if (r.text != null) o.text = r.text;
  if (r.unit != null) o.unit = r.unit;
  if (r.better != null) o.better = r.better;
  if (r.tolerance != null) {
    o.tolerance = { amount: r.tolerance.amount, percent: r.tolerance.percent };
    if (r.tolerance.text != null) o.tolerance.text = r.tolerance.text;
  }
  return o;
}
// a stored reading read back (a hand edit, another version's record) → the reader's shape {check?, name, value, text, unit, better,
// tolerance {amount, percent, text}} or null — what the grammar could not have printed is skipped (a text: only the grammar's number
// that IS the value — the tolerance's: the amount's)
function readingOf(x, withCheck) {
  if (!isObj(x) || typeof x.name !== "string" || !RE_NAME.test(x.name) || typeof x.value !== "number" || !Number.isFinite(x.value)) return null;
  if (withCheck && (typeof x.check !== "string" || !x.check || x.check.length > 40)) return null;
  const text = typeof x.text === "string" && RE_NUMBER.test(x.text) && Number(x.text) === x.value ? x.text : null;
  const unit = typeof x.unit === "string" && x.unit && unitFits(x.unit) && !/[\s=]/.test(x.unit) ? x.unit : null;
  const better = x.better === "lower" || x.better === "higher" ? x.better : null;
  const t = x.tolerance;
  const tolerance = isObj(t) && typeof t.amount === "number" && Number.isFinite(t.amount) && t.amount >= 0 && typeof t.percent === "boolean"
    ? { amount: t.amount, percent: t.percent, text: typeof t.text === "string" && RE_AMOUNT.test(t.text) && Number(t.text) === t.amount ? t.text : null } : null;
  const r = { name: x.name, value: x.value, text, unit, better, tolerance };
  return withCheck ? { check: x.check, ...r } : r;
}
const readingsOf = (list, withCheck) => (Array.isArray(list) ? list.map((x) => readingOf(x, withCheck)).filter(Boolean) : []);
// A CLI run's output → what a run record keeps: { metrics: [stored readings] (only when some), note fields } — the reader's
// counts said on the result (malformed, dropped), never stored. output: a string or several commands' outputs.
function runMetricsOf(output) {
  const read = metricLinesOf(output);
  return { stored: read.metrics.map((r) => storedReading(r)), read };
}
// The result fields of a run's reading (spec_complete_task / recordedChecks[]): metrics (the readings) · metricsMalformed ·
// metricsDropped · metricsLastMalformed — only the ones that say something.
function metricResultFields(read, count) {
  const o = {};
  if (read.metrics.length) o.metrics = count ? read.metrics.length : read.metrics;
  if (read.malformed) { o.metricsMalformed = read.malformed; if (read.lastMalformed) o.metricsLastMalformed = read.lastMalformed; }
  if (read.dropped.length) o.metricsDropped = read.dropped;
  return o;
}

// "bundle-size=142.3 kB better=lower tolerance=2%" — a reading in its line's own form (the CLI's tick lines, the summary). A number
// shows as its line printed it (`text`, the judge's input) when the reading carries one, else as its value (1.41.0 review 2).
const shown = (r) => (r.text != null ? r.text : String(r.value));
const toleranceText = (t) => (t ? (t.text != null ? t.text : String(t.amount)) + (t.percent ? "%" : "") : "");
function metricLineText(r) {
  return r.name + "=" + shown(r) + (r.unit ? " " + r.unit : "") + (r.better ? " better=" + r.better : "") + (r.tolerance ? " tolerance=" + toleranceText(r.tolerance) : "");
}
const valueText = (v, unit) => String(v) + (unit ? " " + unit : "");
const signed = (d) => (d > 0 ? "+" : "") + String(d);

// ---------------------------------------------------------------------------
// The walk — every feature folder (featureDirs: active, then archived) with its state read ONCE (stateFromFile), handed to each
// visitor. spec_metrics' blocks plug in here: a block is { key, visit(fd, state), result() } (finish.js metricsBlocks) —
// M's `measured`, F's `friction`, L's `lessons`. skipDir: a folder left out (finish: the feature's own).
// ---------------------------------------------------------------------------
function walkFeatureStates(projectDir, visitors, skipDir) {
  const skip = skipDir ? path.resolve(skipDir) : null;
  for (const fd of featureDirs(projectDir)) {
    if (skip && path.resolve(fd.dir) === skip) continue;
    const state = stateFromFile(projectDir, statePath(fd.dir));
    for (const v of visitors) v(fd, state);
  }
}
// a folder's finished record → { t (finished.at), at, list: [readings with check] } | null
function finishedMetricsOf(state) {
  const fin = isObj(state.finished) ? state.finished : null; // (stateFromFile always hands an object)
  if (!fin || !Array.isArray(fin.metrics)) return null;
  const t = timeOf(fin.at);
  return t == null ? null : { t, at: fin.at, list: readingsOf(fin.metrics, true) };
}

// ---------------------------------------------------------------------------
// spec_finish — the comparison (CRIT_S2 #4: keyed by (check, name), the project checks' latest PASSING runs only — a guardian check's
// run never carries readings: recordFinishChecks never reads it —, ordered by finished.at; only finish compares, never the tick).
// ---------------------------------------------------------------------------
const MAX_LISTED = 5; // the warning names at most this many readings, then "and N more"
const pairKey = (check, name) => check + "\u0000" + name;
// → { items: [verdict items], record: [finished.metrics entries], warning?, unmeasured: [names], unmeasuredWarning?, summaryLines }
// state: the feature's (read after this call's runs were recorded); suite: suiteStatus's { items, missing }; dir: its folder.
function finishMetrics(projectDir, dir, state, suite, tracks, lng, slug) {
  const T = i18n.msg(lng).metric;
  const fc = isObj(state.finishChecks) ? state.finishChecks : {};
  const current = [];
  for (const it of suite.items) {
    if (it.status !== "pass") continue; // (a check's name is never a prototype key — validCheckName)
    for (const r of readingsOf(isObj(fc[it.name]) ? fc[it.name].metrics : null, false)) current.push({ check: it.name, ...r });
  }
  const res = { items: [], record: current.map((r) => storedReading(r, r.check)), unmeasured: [], summaryLines: [] };
  // the design's Silent Regressions rows name what a check should print: said when no passing run printed it — only once every
  // project check passes (a missing run is the suite-evidence blocker's to say) AND each of those runs is the CLI's (observed "cli":
  // finish --run). A run reported over MCP never carries a reading — what it printed is a doubt, never judged (R1-MF-1).
  const cliRuns = suite.items.every((it) => (isObj(fc[it.name]) ? fc[it.name].observed : null) === "cli");
  if (!suite.missing.length && cliRuns) {
    const names = designMetricNames(activeDesign(readIfExists(path.join(dir, "design.md")) || "", tracks));
    const printed = new Set(current.map((r) => r.name));
    res.unmeasured = names.filter((n) => !printed.has(n));
    if (res.unmeasured.length) res.unmeasuredWarning = T.unmeasured(res.unmeasured.map((n) => "`" + n + "`").join(", "), slug);
  }
  if (!current.length) return res; // nothing printed: no walk (the fs calls of a finish without METRIC lines are 1.40's)
  const want = new Set(current.map((r) => pairKey(r.check, r.name)));
  const refs = new Map(); // pairKey → { reading, feature, at, t }
  walkFeatureStates(projectDir, [(fd, st) => {
    const fm = finishedMetricsOf(st);
    if (!fm) return;
    for (const r of fm.list) {
      const k = pairKey(r.check, r.name);
      if (!want.has(k)) continue;
      const prev = refs.get(k);
      if (!prev || fm.t > prev.t) refs.set(k, { reading: r, feature: fd.slug, at: fm.at, t: fm.t });
    }
  }], dir);
  const flagged = [];
  for (const r of current) {
    const ref = refs.get(pairKey(r.check, r.name)) || null;
    const j = judgeMetric(ref && ref.reading, r);
    const item = { check: r.check, name: r.name, value: r.value, text: r.text, unit: r.unit, better: r.better, tolerance: r.tolerance, ...j,
      reference: ref ? { feature: ref.feature, at: ref.at, value: ref.reading.value, text: ref.reading.text, unit: ref.reading.unit, better: ref.reading.better,
        tolerance: ref.reading.tolerance } : null };
    res.items.push(item);
    if (j.verdict === "regressed" || j.loosened) flagged.push(item);
  }
  if (flagged.length) {
    const listed = flagged.slice(0, MAX_LISTED).map((x) => flaggedText(x, T)).join("; ");
    // a warning naming only unit changes says so (none was compared — never "got worse past the tolerance")
    res.warning = T.finishWarn(flagged.length, listed, flagged.length - Math.min(flagged.length, MAX_LISTED), flagged.every((x) => x.loosened === "unit"));
  }
  res.summaryLines = [T.summaryHead, ...res.items.map((x) => "- " + itemText(x, T))];
  return res;
}
// spec_finish's `metrics` items as the CLI's report lines (the merge summary's, without the list marker)
function metricItemLines(items, lng) {
  const T = i18n.msg(lng).metric;
  return (items || []).map((x) => itemText(x, T));
}
// "bundle-size (check size): 120 → 142.3 kB since checkout's finish on 2026-11-20 (+22.3, tolerance 2.4)" · + loosened
function flaggedText(x, T) {
  const ref = x.reference;
  const head = T.flagged(x.name, x.check, valueText(shown(ref), ref.unit), valueText(shown(x), x.unit), ref.feature, dayOf(ref.at) || "?",
    x.delta == null ? null : signed(x.delta), x.applied == null ? null : String(x.applied), x.verdict);
  return x.loosened ? head + " " + T.loosened(x.loosened, termText(ref, x.loosened), termText(x, x.loosened)) : head;
}
const termText = (r, term) => (term === "better" ? r.better || "—" : term === "tolerance" ? toleranceText(r.tolerance) || "—" : r.unit || "—");
// the merge summary's / the CLI's line of one reading
function itemText(x, T) {
  const now = valueText(shown(x), x.unit);
  if (!x.reference) return T.lineNew(x.name, x.check, now);
  const ref = x.reference;
  const judged = x.verdict === "unjudged" ? T.unjudged(x.why) : T.verdict[x.verdict] + " (" + x.applied + ")";
  const loose = x.loosened ? " · " + T.loosened(x.loosened, termText(ref, x.loosened), termText(x, x.loosened)) : "";
  return T.line(x.name, x.check, now, valueText(shown(ref), ref.unit), ref.feature, dayOf(ref.at) || "?", x.delta == null ? null : signed(x.delta), judged) + loose;
}

// The names a design's Silent Regressions section declares: a code span in the FIRST cell of a table data row (prose never
// names one), each a valid METRIC name. → [names] in order, once each.
function designMetricNames(design) {
  const body = weighSection(design || "", SILENT_SYN);
  if (body == null) return [];
  const out = [];
  let inTable = false;
  for (const l of stripFencedCode(stripHtmlComments(body)).split(/\r?\n/)) {
    if (!/^\s*\|/.test(l)) { inTable = false; continue; }
    if (!inTable) { inTable = true; continue; } // the header row
    if (/^[\s|:-]+$/.test(l)) continue; // the separator row
    const first = l.replace(/^\s*\|/, "").split("|")[0];
    for (const m of first.matchAll(/`([^`\r\n]{1,64})`/g)) if (RE_NAME.test(m[1]) && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// spec_metrics' `measured` block: each (check, name) across the finishes that recorded it — the creep view (a 1.9 % step at each
// finish never warns; here it shows). One series per (check, name) in the unit of its LATEST finish (another unit's finishes are
// counted apart, `otherUnit`), ordered by finished.at, its last SERIES_MAX points.
// ---------------------------------------------------------------------------
const SERIES_MAX = 10;
function measuredBlock() {
  const by = new Map(); // pairKey → [{ feature, at, t, reading }]
  return {
    key: "measured",
    visit(fd, state) {
      const fm = finishedMetricsOf(state);
      if (!fm) return;
      for (const r of fm.list) {
        const k = pairKey(r.check, r.name);
        if (!by.has(k)) by.set(k, []);
        by.get(k).push({ feature: fd.slug, at: fm.at, t: fm.t, reading: r });
      }
    },
    result() {
      const out = [];
      for (const list of by.values()) {
        list.sort((a, b) => a.t - b.t);
        const last = list[list.length - 1].reading;
        const same = list.filter((x) => x.reading.unit === last.unit);
        const first = same[0];
        const F = decimalOf(first.reading.value), L = decimalOf(last.value), S = Math.max(F.s, L.s);
        const change = numberOf(scaled(L, S) - scaled(F, S), S);
        const e = { check: last.check, name: last.name, unit: last.unit, better: last.better, finishes: same.length,
          first: { feature: first.feature, at: first.at, value: first.reading.value }, last: { feature: same[same.length - 1].feature, at: same[same.length - 1].at, value: last.value },
          change, changePct: first.reading.value === 0 ? null : round1((change / Math.abs(first.reading.value)) * 100),
          series: same.slice(-SERIES_MAX).map((x) => ({ feature: x.feature, at: x.at, value: x.reading.value })) };
        if (same.length < list.length) e.otherUnit = list.length - same.length;
        out.push(e);
      }
      // none recorded: null — no key (a project without METRIC lines reads as in 1.40)
      return out.length ? out.sort((a, b) => (a.check < b.check ? -1 : a.check > b.check ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) : null;
    },
  };
}
// The CLI's lines of `measured` (spec_metrics, the project)
function measuredLines(list, lng) {
  if (!list || !list.length) return [];
  const T = i18n.msg(lng).metric;
  return [T.measuredHead, ...list.map((m) => "    " + T.measuredLine(m.name, m.check, String(m.first.value), valueText(m.last.value, m.unit), m.finishes,
    m.changePct == null ? signed(m.change) : signed(m.changePct) + " %"))];
}

module.exports = { METRIC_GRAMMAR, METRIC_BOUNDS, metricLinesOf, judgeMetric, runMetricsOf, metricResultFields, metricLineText, walkFeatureStates,
  finishMetrics, metricItemLines, measuredBlock, measuredLines, __link };
