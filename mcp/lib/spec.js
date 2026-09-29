"use strict";

/**
 * dev-spec-driven — local spec engine.
 * Zero-dependency. Pure Node core (fs, path). No network, no cost.
 *
 * Operates on a project's `.specs/` directory. The MCP server (server.js)
 * exposes these functions as tools; this module holds all the logic so it can
 * be unit-tested in isolation (see mcp/test.js).
 *
 * 1.18: being split into mcp/lib/engine/ (one module per concern; the rule is in engine/index.js). What is still below
 * hands its names to the extracted modules with engine.link() (they reach it at call time).
 */

const fs = require("fs");
const path = require("path");
const i18n = require("./i18n.js");
const engine = require("./engine/index.js");
const { addTrack, affectsWarnings, appendTasks, APPROVAL_GUARD_LEVELS, approvalGuardDecision, approvalGuardLevel,
  approvalRolesOf, approvePhase, archiveFeature, artifactState, backlog, BACKLOG_ACTIONS, backtickRuns, blankFacts,
  BOM_CHAR, catalog, changelog, checklistMd, clarify, classify, CLI_SWITCHES, closesFence, colonLineAnchorAt,
  compareSemver, completeTask, configuredLang, couldNotRunOutput, coverage, createFeature, crossFeatureAcs, csvCell,
  decide, DECISION_TITLE_MAX, decisionEntryLines, decisionLog, DECISIONS_FILE, dependencyCycles, designSaveCheck,
  detectPhase, detectTracks, drift, earsFeature, earsSteps, earsValidate, engineVersion, etaText, evidenceMode,
  existingFeature, expectsFail, EXPORT_FORMATS, exportSpecs, extractAcIds, extractSection, featureFlow, featureLang,
  featureLocked, featureOverlaps, featurePercent, featurePlaceholders, fenceStep, finishFeature, FLOWS, forecastData,
  globalConstraints, globFiles, glossaryEntries, guardCheck, guardEnabled, guardLevel, headingHasMarker, headingIndex,
  headPlus, headRest, impactLines, impactReport, implementsTargets, indentOf, initProject, insertPackRequirements,
  integrationPlanMd, isFeatureFolder, isInsideDir, isLtUnit, isNetworkPath, isObj, isPackTrack, isPlaceholderTask,
  isTemplatePlaceholder, isTestFile, isWslLauncher, isWsUnit, listFeatures, manageFeature, markdownToHtml, markerTracks,
  matrixCsv, maybeRefreshCatalog, maybeRefreshRoadmap, mdPlainText, metrics, metricsLines, milestone, MILESTONE_ACTIONS,
  MILESTONE_STATUSES, milestoneLine, networkPathInside, nextAction, nextTask, normalizeLang, normalizeTracks,
  OBSERVED_MAX_BYTES, observedRun, observeRun, OPTIONAL_TRACKS, own, PACK_LIMITS, packOf, packRequirementsBlock,
  packTaskBlock, parseApprovalRolesText, parseGitLog, parseTasks, parseTracks, phasePercent, PHASES, placeholderKey,
  placeholderReport, planBridge, plusAfterBlanks, posixShellSyntax, projectChecks, projectLang, RE_CHECKPOINT,
  RE_EARS_KEYWORD, RE_FENCE, RE_LINE_TERMINATOR, RE_MODAL, RE_TESTABILITY, readIfExists, readRoadmap, readState,
  removeFeature, removeTrack, renameFeature, renderRoadmapHtml, renderRoadmapMd, requirementAcIds, resolveFeature,
  resolveProjectDir, resolveRunShell, resolveTask, restAfterBlanks, restoreFeature, roadmap, roadmapData, roadmapReport,
  roadmapTailLines, RTM_STATUSES, safeReaddir, scaffoldSteeringFile, scaffoldTestPlan, scanCodebase, scanTestCode,
  sectionDropLines, setDependency, shortTitle, SIGNAL_CONCEPTS, SIGNALS, SIZE_POINTS, slugify, specDoctor, specsRoot,
  specUpgrade, specVersionStatus, spikeInfo, statusFeature, statusLine, statusLineProject, steeringFingerprints,
  steeringFrontMatter, steeringGlobMatch, STOP_RECENT_HOURS, stopCheck, stopCheckEnabled, stopClaims, stripEnd,
  stripHashComment, stripHtmlComments, summarizeRunOutput, supersedesMarkers, supersedesWarnings, TASK_MARKER_LABELS,
  taskBlocks, taskBrief, taskCommits, taskDependsSpec, taskLine, taskMarkers, taskSchedule, taskSize, taskWaves,
  TEMPLATE_ARTIFACTS, templateBracketKeys, templateKey, templates, templateSets, testIndex, toPosix, traceCheck,
  traceGapLines, traceGaps, traceMatrix, traceWarningLines, TRACK_MARKER, TRACK_SECTIONS, trackAcIds, trackDesignBlock,
  TRACKERS, trackLabel, trackMarker, trackPacks, trackTaskHeadingIs, unknownTracksError, userDefaults, VALID_TRACKS,
  verificationStatus, verifyPipeMasked, windowsShellFailure, withFeatureLock, withinRoot, withReadCache,
  withTrackBlocks, writeFileAtomic, writeRoadmapHtml, writeRoadmapMd, wsOrUnitIn } = engine.E;

// ---------------------------------------------------------------------------
// spec_import — a spec written for another tool (Kiro · spec-kit · OpenSpec) becomes a NEW dev-spec feature
// ---------------------------------------------------------------------------
// Read-only on the source (never modified), inside the project only, and never over an existing feature: the
// feature is scaffolded by createFeature, then requirements.md / design.md / tasks.md are replaced by the
// imported content. Requirement/story N, criterion/scenario M → US-N.AC-M; scenarios become ONE EARS criterion
// where possible (else the text is kept with [NEEDS CLARIFICATION]); spec-kit FR-xxx / SC-xxx lines keep their IDs.

const IMPORT_TOOLS = { kiro: "Kiro", "spec-kit": "spec-kit", openspec: "OpenSpec", plan: "plan", execplan: "ExecPlan", bmad: "BMAD", fluidplan: "fluidplan" }; // C3: + plan · execplan · bmad; 1.17 F: + fluidplan
const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const TEXT_IMPORT_TOOLS = ["plan", "execplan", "fluidplan"]; // 1.16 C4: the single-document sources spec_import {text} accepts (1.17 F: a fluidplan PLAN.md, DECISIONS.md after it)
// An imported line never opens an HTML comment (1.17 F review): every parser reads its source without its comments, so a `<!--`
// left in the text was an unclosed one — plain text there, but in the files written it paired with a later `-->` (the
// `<!-- <tool>: … -->` line under a converted criterion) and hid every criterion between.
// Outside inline code spans only (1.17 verification N3): a code span's `<!--` is text to every comment reader (commentLines —
// the same pairing, backtickRuns, line by line) and a code span shows its text verbatim — "escape `<!--` in user names" became
// `&lt;!--` in requirements.md and the exports (1.16 kept it). The written line starts with the text or follows a prefix of the
// importer's without backticks, so the pairing read here is the file's.
const commentInert = (s) => inertOutsideCode(String(s), false);
// `<!--` (and, with `closers`, `-->`) → `&lt;!--` / `--&gt;` outside inline code spans, line by line. Linear.
function inertOutsideCode(text, closers) {
  if (!text.includes("<!--") && !(closers && text.includes("-->"))) return text;
  const esc = (t) => (closers ? t.replace(/<!--/g, "&lt;!--").replace(/-->/g, "--&gt;") : t.replace(/<!--/g, "&lt;!--"));
  return text.split("\n").map((line) => {
    if (!line.includes("`")) return esc(line);
    const ticks = backtickRuns(line);
    let out = "";
    let from = 0;
    // [k, spanEnd(k)) is a whole code span, or an unmatched backtick run (literal — the scan goes on after it): kept as written
    for (let k = line.indexOf("`"); k !== -1; k = line.indexOf("`", from)) {
      const e = ticks.spanEnd(k);
      out += esc(line.slice(from, k)) + line.slice(k, e);
      from = e;
    }
    return out + esc(line.slice(from));
  }).join("\n");
}
// A block of imported lines as requirements.md holds it: commentInert outside fenced code (a fenced `<!--` is code, kept), and a
// fence the block leaves open closed at its end (the block starts outside any fence: it follows a heading the importer writes).
function inertBlock(lines) {
  const st = { fence: null };
  const out = lines.map((l) => (fenceStep(st, l) ? l : commentInert(l)));
  if (st.fence) out.push(" ".repeat(st.fence.indent) + st.fence.mark);
  return out;
}

// Headings outside fenced code: [{ i, level, text }].
function mdHeadings(lines) {
  return headingIndex(lines).map((i) => ({ i, ...mdHeadingParts(lines[i]) }));
}
// "## Title ##" → { level, text }: what /^(#{1,6})\s+(.*?)\s*#*\s*$/ captured (text trimmed), read by a scan — that pattern
// backtracked cubically on a heading holding a long run of spaces (a 3,000-space heading took 10 s; 1.17 F review). The line
// is one headingIndex() accepts (1–6 '#' then whitespace). The closing sequence is the longest suffix whitespace · '#'s ·
// whitespace.
const isWs = (c) => c !== undefined && c.trim() === "";
function mdHeadingParts(line) {
  let level = 0;
  while (level < 6 && line[level] === "#") level++;
  let lo = level;
  while (lo < line.length && isWs(line[lo])) lo++;
  let hi = line.length;
  while (hi > lo && isWs(line[hi - 1])) hi--;
  while (hi > lo && line[hi - 1] === "#") hi--;
  while (hi > lo && isWs(line[hi - 1])) hi--;
  return { level, text: line.slice(lo, hi).trim() };
}
// [lo, hi) of the lines under heading hs[k], up to the next heading of the same or a higher level.
function mdRange(lines, hs, k) {
  const h = hs[k];
  let next = null; // a scan, no slice: copying the rest of the headings for each one was quadratic on a long PLAN.md (1.17 F review)
  for (let j = k + 1; j < hs.length && !next; j++) if (hs[j].level <= h.level) next = hs[j];
  return [h.i + 1, next ? next.i : lines.length];
}
function mdBody(lines, hs, k) {
  const [lo, hi] = mdRange(lines, hs, k);
  return lines.slice(lo, hi);
}
// The parsers mark every source line they import; leftoverExtras() carries the rest.
function markRange(used, lo, hi) {
  for (let i = lo; i < hi; i++) used.add(i);
}
// The lines of [lo, hi) no parser used: a "## Functional Requirements" wrapping "### Requirement N" (already a
// story) carries only what is left around it, never a second verbatim copy of the requirement.
function unusedLines(lines, used, lo, hi) {
  return lines.slice(lo, hi).filter((_, r) => !used.has(lo + r));
}
const RE_MD_HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
// First paragraph of prose (no headings, lists, quotes, tables or metadata), whitespace-folded. `at` (optional)
// collects the offsets of the lines it used.
function firstParagraph(lines, at) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) { if (out.length) break; continue; }
    if (/^(?:#|[-*+]\s|\d+[.)]\s|>|\||```|~~~|---)/.test(t) || /^\*\*[^*]+\*\*:?/.test(t)) { if (out.length) break; continue; }
    out.push(t);
    if (at) at.push(i);
  }
  return out.join(" ").trim() || null;
}
// List items of a body: [{ n (printed number or null), text (continuation folded), at (offsets of its lines) }].
// A continuation line is indented OR lazy (CommonMark: an unindented line right after the item's text — a wrapped
// "THEN the system SHALL …" belongs to its criterion); a more-indented sub-list folds into its item. A blank line,
// a heading, a quote, a table, a rule or a sibling list that is not ours ends the item.
function mdListItems(lines, numberedOnly) {
  const items = [];
  let cur = null;
  let fence = null;
  lines.forEach((l, i) => {
    if (fence) { if (closesFence(l, fence)) fence = null; cur = null; return; }
    const f = l.match(RE_FENCE);
    if (f) { fence = f[1]; cur = null; return; }
    const ind = indentOf(l);
    // /^\s*(\d+)[.)]\s+(.*)$/ (or with a bullet too), the text read by headRest (1.17 H)
    const m = headRest(l, numberedOnly ? /^\s*(\d+)[.)]/ : /^\s*(?:(\d+)[.)]|[-*+])/, true);
    if (m && (!cur || ind <= cur.indent)) { cur = { n: m[1] ? +m[1] : null, text: m[2].trim(), indent: ind, at: [i] }; items.push(cur); return; }
    if (!l.trim() || /^\s*(?:#|>|\|)/.test(l) || RE_MD_HR.test(l)) { cur = null; return; }
    if (!cur) return;
    if (/^\s*(?:[-*+]|\d+[.)])\s/.test(l) && ind <= cur.indent) { cur = null; return; }
    cur.text += " " + l.trim();
    cur.at.push(i);
  });
  return items.map(({ n, text, at }) => ({ n, text, at }));
}
// What no parser mapped still travels verbatim: the unused lines of one file, grouped under their nearest heading
// (an unused heading opens its own group and keeps its unused sub-headings inside it) → [{ heading, label, lines }].
// Nothing is dropped silently — importSpec appends them and names them in a warning. `prefix` names the
// capability when an OpenSpec import reads several spec.md files.
function leftoverExtras(lines, hs, used, prefix = "") {
  const at = new Map(hs.map((h) => [h.i, h]));
  const out = [];
  let near = null;
  let cur = null;
  lines.forEach((raw, i) => {
    const h = at.get(i);
    if (h) {
      near = h;
      if (used.has(i)) { cur = null; return; }
      if (cur && cur.level != null && h.level > cur.level) { cur.lines.push(raw.trimEnd()); return; } // trimEnd: /\s+$/ is quadratic on a long space run
      cur = { label: prefix + h.text, level: h.level, lines: [] };
      out.push(cur);
      return;
    }
    if (used.has(i)) return;
    const l = raw.trimEnd();
    if (!l.trim() || RE_MD_HR.test(l)) { if (cur) cur.lines.push(""); return; }
    if (!cur) { cur = { label: near ? prefix + near.text : null, level: null, lines: [] }; out.push(cur); }
    cur.lines.push(l);
  });
  return out.map((b) => ({ heading: b.label != null ? "## " + b.label : null, label: b.label, lines: tidyLines(b.lines) })).filter((b) => b.lines.length);
}
const trimClause = (s) => stripEnd(String(s || "").trim(), wsOrUnitIn(",.;:")); // /[\s,.;:]+$/
// Prose lines as written (trailing spaces dropped), blank runs folded, no blank edges.
function tidyLines(lines) {
  const out = [];
  for (const l of lines.map((x) => x.trimEnd())) if (l || (out.length && out[out.length - 1])) out.push(l); // trimEnd: /\s+$/ is quadratic on a long blank run (1.17 F)
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}
const lcFirst = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const IRREGULAR_VERBS = new Map([["is", "be"], ["are", "be"], ["has", "have"], ["does", "do"], ["goes", "go"]]);
function baseVerb(v) {
  const w = v.toLowerCase();
  if (IRREGULAR_VERBS.has(w)) return IRREGULAR_VERBS.get(w);
  if (/[^aeiou]ies$/.test(w)) return w.slice(0, -3) + "y";
  if (/(?:ss|sh|ch|x|z|o)es$/.test(w)) return w.slice(0, -2);
  if (/[^s]s$/.test(w)) return w.slice(0, -1);
  return w;
}
// A THEN clause as an EARS response. Already modal ("the API SHALL return 401") → kept. English "the system
// returns X" → THE SYSTEM SHALL return X; anything else → THE SYSTEM SHALL ensure that <clause> (PT/ES likewise,
// with 'garantir que' / 'garantizar que' — no verb guessing there).
function earsThen(clause, lng, E) {
  const c = trimClause(clause);
  if (!c) return null;
  if (RE_MODAL.test(c)) return c;
  if (lng === "en") {
    let m = c.match(/^(?:the\s+)?system\s+(?:should|must|will|shall)\s+(not\s+)?(.+)$/i);
    if (m) return E.shall + " " + (m[1] ? E.not + " " : "") + m[2];
    m = c.match(/^(?:the\s+)?system\s+(?:does\s+not|doesn't|never)\s+(.+)$/i);
    if (m) return E.shall + " " + E.not + " " + m[1];
    // Only a verb-shaped word ("returns", "is", "stores"): "the system administrator approves" / "the system status is
    // green" name something else — those take the 'ensure that' form below.
    m = c.match(/^(?:the\s+)?system\s+([a-z]+)\b(.*)$/i);
    if (m && (IRREGULAR_VERBS.has(m[1].toLowerCase()) || /(?:[^aeiou]ies|(?:ss|sh|ch|x|z|o)es|[^usi]s)$/i.test(m[1]))) return E.shall + " " + baseVerb(m[1]) + m[2];
  }
  return E.ensure + " " + lcFirst(c);
}
// { given, when, then } → "WHILE <given>, WHEN <when>, THE SYSTEM SHALL …" (null without a THEN).
function earsFromClauses(cl, lng) {
  const E = i18n.msg(lng).importSpec.ears;
  const then = earsThen(cl.then, lng, E);
  if (!then) return null;
  return [cl.given ? E.while + " " + trimClause(cl.given) + "," : null, cl.when ? E.when + " " + trimClause(cl.when) + "," : null, then].filter(Boolean).join(" ");
}
// 1.17 H — the importer's clause patterns, read by a scan. /^(?:given\s+(.+?)\s*,?\s+)?(?:when\s+(.+?)\s*,?\s+)?then\s+(.+)$/i
// and /^(WHEN|IF|WHILE|WHERE)\s+(.+?),?\s+THEN\s+(.+)$/i backtracked quadratically — Given/When/Then cubically — on a long
// blank run, a long run of "when"s or a line break a capture can't cross. The scan tries the choices in the order the regex
// engine does, so the first reading it finds is the engine's own, captures included (down to the one-blank capture the
// engine settled for by giving back a keyword's \s+). Per-position facts are filled in one pass; every run of blanks /
// commas that a keyword follows is judged once.
function clauseScanner(t) {
  const n = t.length;
  const nnw = new Int32Array(n + 1), nlt = new Int32Array(n + 1), sepEnd = new Int32Array(n + 1), prevComma = new Int32Array(n + 1);
  nnw[n] = n; nlt[n] = n; sepEnd[n] = n;
  for (let i = n - 1; i >= 0; i--) {
    const c = t[i], w = isWsUnit(c);
    nnw[i] = w ? nnw[i + 1] : i; // the first non-blank at or after i
    nlt[i] = isLtUnit(c) ? i : nlt[i + 1]; // the first line terminator at or after i (n: none)
    sepEnd[i] = w || c === "," ? sepEnd[i + 1] : i; // the end of the run of blanks / commas at i
  }
  for (let i = 0, pc = -1; i <= n; i++) { prevComma[i] = pc; if (t[i] === ",") pc = i; }
  const runStart = [], runKw = []; // each run of blanks / commas that something follows: its start and what follows
  for (let i = 0; i < n;) {
    if (isWsUnit(t[i]) || t[i] === ",") { if (sepEnd[i] < n) { runStart.push(i); runKw.push(sepEnd[i]); } i = sepEnd[i]; } else i++;
  }
  const firstRun = new Int32Array(n + 2); // the first run starting at or after p
  for (let p = n + 1, j = runStart.length; p >= 0; p--) { while (j > 0 && runStart[j - 1] >= p) j--; firstRun[p] = j; }
  const kwAt = (re, at) => { re.lastIndex = at; const m = re.exec(t); return m ? { end: at + m[0].length, m } : null; };
  // The smallest e ≥ x (x..k inside one run) whose separator t[e..k) the rule reads: "gwt" \s*,?\s+ (one comma at most, a
  // blank last), "kiro" ,?\s+ (a comma only first). -1: none.
  const sepStart = (rule, x, k) => {
    if (k <= x || !isWsUnit(t[k - 1])) return -1;
    const c1 = prevComma[k];
    if (rule === "kiro") return c1 < x ? x : c1 < k - 1 ? c1 : -1;
    const c2 = c1 >= x ? prevComma[c1] : -1;
    return c2 >= x ? c2 + 1 : x;
  };
  // (.+?)<separator> before a keyword whose continuation cont(k) reads: from a capture start gs → { e, k, r } | null.
  const lazyReader = (rule, cont) => {
    const nv = new Int32Array(runStart.length + 1).fill(-1), res = new Array(runStart.length).fill(null);
    for (let j = runStart.length - 1; j >= 0; j--) {
      if (sepStart(rule, runStart[j], runKw[j]) !== -1) res[j] = cont(runKw[j]);
      nv[j] = res[j] ? j : nv[j + 1]; // the first run from j on whose keyword reads
    }
    return (gs) => {
      const x = gs + 1, lt = nlt[gs]; // the capture t[gs..e) holds no line terminator: e ≤ lt
      if (x >= n) return null;
      let j = firstRun[x];
      if (isWsUnit(t[x]) || t[x] === ",") { // a run under way at x is read from x
        const k = sepEnd[x];
        const e = k < n ? sepStart(rule, x, k) : -1;
        if (e !== -1) { if (e > lt) return null; const r = cont(k); if (r) return { e, k, r }; }
        j = firstRun[k + 1];
      }
      j = j < runStart.length ? nv[j] : -1;
      if (j === -1) return null;
      const e = sepStart(rule, runStart[j], runKw[j]);
      return e > lt ? null : { e, k: runKw[j], r: res[j] };
    };
  };
  // KW\s+(.+?)<separator><keyword …> at `a` (just past KW, a blank there): the capture from the first non-blank — else,
  // as the engine giving back \s+ found it, one blank (the last that is no line terminator, a blank kept on each side)
  // before a keyword at that first non-blank.
  const clause = (a, lazy, cont) => {
    const gs = nnw[a];
    if (gs >= n) return null;
    const m = lazy(gs);
    if (m) return { g: t.slice(gs, m.e), r: m.r };
    if (t[gs] === "," || gs - a < 3) return null;
    const r = cont(gs);
    if (r) for (let s = gs - 2; s > a; s--) if (!isLtUnit(t[s])) return { g: t[s], r };
    return null;
  };
  // THEN\s+(.+)$ at c → the response | null (all blanks: the last one, as the engine giving back \s+ read it).
  const thenAt = (re, c) => {
    const kw = kwAt(re, c);
    if (!kw) return null;
    const q = nnw[kw.end];
    if (q < n) return nlt[q] === n ? t.slice(q) : null;
    return n - kw.end >= 2 && !isLtUnit(t[n - 1]) ? t[n - 1] : null;
  };
  const memo = (f) => { const c = new Map(); return (k) => { if (!c.has(k)) c.set(k, f(k)); return c.get(k); }; };
  return { n, nnw, kwAt, lazyReader, clause, thenAt, memo };
}
// Given/When/Then prose (spec-kit scenarios; Gherkin keywords in EN/PT/ES) → EARS, in the scenario's language. Each language's
// keywords, a blank after each (`given\s+` …; PT / ES: dad[oa]s?\s+(?:que\s+)?).
const GWT = [
  ["en", { given: /given(?=\s)/iy, que: null, when: /when(?=\s)/iy, then: /then(?=\s)/iy }],
  ["pt", { given: /dad[oa]s?(?=\s)/iy, que: /que(?=\s)/iy, when: /quando(?=\s)/iy, then: /ent[ãa]o(?=\s)/iy }],
  ["es", { given: /dad[oa]s?(?=\s)/iy, que: /que(?=\s)/iy, when: /cuando(?=\s)/iy, then: /entonces(?=\s)/iy }],
];
// /^(?:given\s+(.+?)\s*,?\s+)?(?:when\s+(.+?)\s*,?\s+)?then\s+(.+)$/i on t → [t, given, when, then] | null (clauseScanner S).
function gwtMatch(S, t, K) {
  const C = S.memo((k) => S.thenAt(K.then, k));
  const lazyC = S.lazyReader("gwt", C);
  const B = S.memo((k) => { const kw = S.kwAt(K.when, k); const c = kw && S.clause(kw.end, lazyC, C); return c ? { when: c.g, then: c.r } : null; });
  const cont = S.memo((k) => B(k) || (C(k) != null ? { then: C(k) } : null)); // (?:when…)? then…
  const g = S.kwAt(K.given, 0);
  if (g) {
    const lazyAG = S.lazyReader("gwt", cont);
    const g0 = S.nnw[g.end];
    const q = K.que && g0 < S.n ? S.kwAt(K.que, g0) : null;
    const r = (q && S.clause(q.end, lazyAG, cont)) || S.clause(g.end, lazyAG, cont);
    if (r) return [t, r.g, r.r.when, r.r.then];
  }
  const r0 = cont(0);
  return r0 ? [t, undefined, r0.when, r0.then] : null;
}
function earsFromGwt(text) {
  const t = String(text).replace(/\*\*|__/g, "").trim();
  if (RE_MODAL.test(t) && RE_EARS_KEYWORD.test(t)) return t;
  const S = clauseScanner(t);
  for (const [lng, K] of GWT) {
    const m = gwtMatch(S, t, K);
    if (m && (m[1] || m[2])) return earsFromClauses({ given: m[1], when: m[2], then: m[3] }, lng);
  }
  return null;
}
// A Kiro criterion is usually EARS already ("WHEN … THEN the system SHALL …") — kept verbatim; a WHEN/IF … THEN
// without SHALL gets its response rewritten. A spec written in Portuguese / Spanish (QUANDO … ENTÃO … / CUANDO … ENTONCES …)
// the same way, in its language (full review Pb1: only the English keywords were read). Read as
// /^(WHEN|IF|WHILE|WHERE)\s+(.+?),?\s+THEN\s+(.+)$/i by clauseScanner (1.17 H): [lang, the condition keyword, THEN, …].
const KIRO_COND = [
  ["en", /(WHEN|IF|WHILE|WHERE)(?=\s)/iy, /THEN(?=\s)/iy, { when: "when", if: "if", while: "while", where: "where" }],
  ["pt", /(QUANDO|SE|ENQUANTO|ONDE)(?=\s)/iy, /ENT[ÃA]O(?=\s)/iy, { quando: "when", se: "if", enquanto: "while", onde: "where" }],
  ["es", /(CUANDO|SI|MIENTRAS|DONDE)(?=\s)/iy, /ENTONCES(?=\s)/iy, { cuando: "when", si: "if", mientras: "while", donde: "where" }],
];
function kiroCondMatch(S, t, head, thenRe) {
  const h = S.kwAt(head, 0);
  if (!h) return null;
  const C = S.memo((k) => S.thenAt(thenRe, k));
  const c = S.clause(h.end, S.lazyReader("kiro", C), C);
  return c ? [t, h.m[1], c.g, c.r] : null;
}
// Kiro's requirements.md headings in EN / PT / ES: the document title, "## Introduction", "## Requirements" and the story
// headings "### Requirement N" (PT/ES "Requisito N" — or a translated "História de Utilizador / Usuário N", "Historia de
// Usuario N"). The English forms read exactly as before; a PT/ES "## Requisitos" wrapper only when it is the whole heading
// ("## Requisitos Não Funcionais" is a section of its own, carried).
const RE_KIRO_REQ_TITLE = /^(?:requirements?(?:\s+document)?|(?:documento\s+de\s+)?requisitos)$/i;
const RE_KIRO_INTRO = /^(?:introduction\b|introdu[çc][ãa]o(?![\p{L}\p{N}_])|introducci[óo]n(?![\p{L}\p{N}_]))/iu;
const RE_KIRO_REQS = /^(?:requirements\b|requisitos\s*$)/i;
// A Kiro story heading → [text, word, number, title] | null — /^(requirement|…)\s+(\d+)\s*[:.\-–—]?\s*(.*)$/i with the
// title read by a scan (the two \s* around the optional dash backtracked quadratically before a line break — 1.17 H).
const RE_KIRO_STORY_HEAD = /^(requirement|requisito|hist[óo]ria\s+de\s+(?:utilizador|usu[áa]rio)|historia\s+de\s+usuario)\s+(\d+)/i;
function kiroStoryHeading(text) {
  const h = RE_KIRO_STORY_HEAD.exec(text);
  const title = h && titleAfterDash(text, h[0].length);
  return title == null ? null : [text, h[1], h[2], title];
}
function earsFromKiro(text) {
  const t = String(text).trim();
  if (RE_MODAL.test(t)) return t;
  const S = clauseScanner(t);
  for (const [lng, head, thenRe, kws] of KIRO_COND) {
    const m = kiroCondMatch(S, t, head, thenRe);
    if (!m) continue;
    const E = i18n.msg(lng).importSpec.ears;
    const then = earsThen(m[3], lng, E);
    const kw = kws[m[1].toLowerCase()];
    return kw === "if" ? `${E.if} ${trimClause(m[2])}, ${E.then} ${then}` : `${E[kw]} ${trimClause(m[2])}, ${then}`;
  }
  return null;
}
// The story's title from its "I want …" clause (PT "quero …", ES "quiero …").
function titleFromStory(prose) {
  const s = prose.join(" ");
  const m = wantClause(s, /\bI want(?=\s)/gi, /to(?=\s)/iy, /so that\b/iy) ||
    wantClause(s, /(?<![\p{L}\p{N}_])(?:quero|quiero)(?=\s)/giu, /que(?=\s)/iuy, /(?:para|de modo a|de forma a)(?![\p{L}\p{N}_])/iuy);
  return m ? shortTitle(m.charAt(0).toUpperCase() + m.slice(1), 60) : null;
}
// The capture of /\bI want\s+(?:to\s+)?(.+?)(?:,|\s+so that\b|$)/i (and its PT / ES twin) by a scan: head / opt / closing are
// its pieces (head global, opt / closing sticky). The lazy capture rescanned a long blank run at each step and every head
// the text after it (1.17 H); here each position's "a clause ends here" is known once. Choices in the engine's order: the
// heads left to right; the optional word taken, its blanks given back one by one, not taken; the head's blanks given back.
function wantClause(s, head, opt, closing) {
  const n = s.length;
  const nnw = new Int32Array(n + 1), nlt = new Int32Array(n + 1), nextEnd = new Int32Array(n + 1);
  nnw[n] = n; nlt[n] = n; nextEnd[n] = n;
  for (let i = n - 1; i >= 0; i--) {
    nnw[i] = isWsUnit(s[i]) ? nnw[i + 1] : i;
    nlt[i] = isLtUnit(s[i]) ? i : nlt[i + 1];
    let ends = s[i] === ",";
    if (!ends && nnw[i] > i) { closing.lastIndex = nnw[i]; ends = closing.test(s); } // \s+ then the closing words
    nextEnd[i] = ends ? i : nextEnd[i + 1]; // the first position ≥ i where the capture may end (n: the end)
  }
  const from = (cs) => { const e = cs < n ? nextEnd[cs + 1] : -1; return e !== -1 && e <= nlt[cs] ? s.slice(cs, e) : null; };
  head.lastIndex = 0;
  for (let h; (h = head.exec(s));) {
    const a = h.index + h[0].length, g0 = nnw[a];
    let r = null;
    opt.lastIndex = g0;
    if (g0 < n && opt.test(s)) {
      const a1 = opt.lastIndex, g1 = nnw[a1];
      for (let cs = g1; cs > a1 && r == null; cs--) r = from(cs);
    }
    for (let cs = g0; cs > a && r == null; cs--) r = from(cs);
    if (r != null) return r;
  }
  return null;
}
function newImportModel() {
  return { title: null, summary: null, nameHint: null, stories: [], extra: [], carried: [], design: null, tasks: null, skipped: [], warnings: [], mapping: {} };
}

// Kiro: .kiro/specs/<name>/ — requirements.md (### Requirement N, **User Story:**, #### Acceptance Criteria with
// numbered WHEN/THEN/SHALL items), design.md, tasks.md (- [ ] 1. / 2.1 with _Requirements: 1.1, 2.3_).
function parseKiro(dir, read, W) {
  const req = read(path.join(dir, "requirements.md"));
  const des = read(path.join(dir, "design.md"));
  const tasks = read(path.join(dir, "tasks.md"));
  if (req == null && tasks == null) return null;
  const model = newImportModel();
  model.nameHint = path.basename(dir);
  if (req != null) {
    const lines = stripHtmlComments(req).split(/\r?\n/);
    const hs = mdHeadings(lines);
    const used = new Set();
    const h1 = hs.find((h) => h.level === 1);
    if (h1) used.add(h1.i);
    model.title = h1 && !RE_KIRO_REQ_TITLE.test(h1.text) ? h1.text : null;
    const introK = hs.findIndex((h) => RE_KIRO_INTRO.test(h.text));
    if (introK !== -1) used.add(hs[introK].i);
    const [sLo, sHi] = introK !== -1 ? mdRange(lines, hs, introK) : [h1 ? h1.i + 1 : 0, (hs.find((h) => h.level > 1) || { i: lines.length }).i];
    const sAt = [];
    model.summary = firstParagraph(lines.slice(sLo, sHi), sAt);
    sAt.forEach((r) => used.add(sLo + r)); // the rest of the introduction is carried verbatim
    hs.forEach((h, k) => {
      if (h.level === 2 && RE_KIRO_REQS.test(h.text)) { used.add(h.i); return; }
      const hm = kiroStoryHeading(h.text);
      if (!hm) return;
      // m = [, number, title] as the English form always had it; the heading's own word names the story in the mapping
      // ("Requisito 1") — English keeps "Requirement N" whatever its case.
      const m = [hm[0], hm[2], hm[3]];
      const word = /^requirement$/i.test(hm[1]) ? "Requirement" : hm[1].charAt(0).toUpperCase() + hm[1].slice(1).toLowerCase().replace(/\s+/g, " ");
      const [lo, hi] = mdRange(lines, hs, k);
      markRange(used, h.i, hi); // prose, criteria AND what follows them are all written into the story
      const body = lines.slice(lo, hi);
      // "#### Acceptance Criteria" (or a bold "**Acceptance Criteria:**" label) opens the criteria.
      // (?=(\s+))\1: the heading's blanks taken whole — \s+.* rescanned a long blank run from each of its units (1.17 H).
      const acAt = body.findIndex((l) => /^\s*(?:#{1,6}(?=(\s+))\1|\*\*|__).*(?:acceptance criteria|crit[ée]rios de aceita|criterios de aceptaci)/i.test(l));
      const off = acAt === -1 ? 0 : acAt + 1;
      const acBody = body.slice(off);
      // Numbered criteria (Kiro's form); bulleted ones when there are none — but only under an explicit label, where
      // a bullet can't be a note in the story's prose.
      let items = mdListItems(acBody, true);
      if (!items.length && acAt !== -1) items = mdListItems(acBody, false);
      const inItem = new Set(items.flatMap((it) => it.at.map((r) => r + off)));
      const proseLines = tidyLines(body.slice(0, acAt === -1 ? body.length : acAt).filter((l, r) => !inItem.has(r) && !/^\s*#/.test(l)));
      // Anything under the label that is not a criterion (a note, a sub-heading, a table) follows the criteria.
      const after = acAt === -1 ? [] : tidyLines(acBody.filter((l, r) => !inItem.has(r + off) && !RE_MD_HR.test(l)));
      model.stories.push({
        printed: +m[1], key: `${word} ${m[1]}`, title: m[2].trim() || titleFromStory(proseLines) || `${word} ${m[1]}`, priority: null,
        prose: proseLines, quote: [], after,
        criteria: items.map((it, j) => ({ key: `${m[1]}.${it.n != null ? it.n : j + 1}`, raw: it.text, ears: earsFromKiro(it.text) })),
      });
    });
    if (!model.stories.length) model.warnings.push(W.wNoRequirements("requirements.md"));
    // Other top-level sections (Glossary, non-functional notes…) travel verbatim.
    hs.forEach((h, k) => {
      if (h.level !== 2 || RE_KIRO_INTRO.test(h.text) || RE_KIRO_REQS.test(h.text) || used.has(h.i)) return;
      const [lo, hi] = mdRange(lines, hs, k);
      const rest = unusedLines(lines, used, lo, hi);
      markRange(used, h.i, hi);
      if (tidyLines(rest).length) model.extra.push({ heading: "## " + h.text, lines: rest });
    });
    model.carried.push(...leftoverExtras(lines, hs, used)); // e.g. a ### Non-Functional Requirements under ## Requirements
  }
  if (des != null) model.design = { text: des, file: "design.md" };
  else model.warnings.push(W.wNoDesign("design.md"));
  if (tasks != null) model.tasks = { text: tasks, file: "tasks.md" };
  else model.warnings.push(W.wNoTasks);
  return model;
}

// spec-kit: specs/<nnn-name>/ — spec.md (### User Story N - Title (Priority: P1) + numbered Given/When/Then
// Acceptance Scenarios, Edge Cases, FR-xxx, Key Entities, SC-xxx), plan.md (→ design.md), tasks.md (T001 [P] [US1]).
// Template guidance sections (Execution Flow, Quick Guidelines, checklists) are the tool's own, never imported.
const SPECKIT_GUIDANCE = /^(?:execution flow|quick guidelines|review & acceptance checklist|execution status)\b/i;
// spec-kit's summary — $1 of /^\*\*Input\*\*:\s*(?:User description:\s*)?"?(.+?)"?\s*$/im, by a scan (the lazy text before
// "?\s*$ rescanned a long blank run at each step — 1.17 H). The choices in the engine's order; the text runs to the first
// place where `"?`, blanks and a line end follow.
function specKitInput(spec) {
  const F = blankFacts(spec), n = F.n;
  const nextTail = new Int32Array(n + 1); // the first e ≥ p where "?\s*$ reads
  nextTail[n] = n;
  for (let p = n - 1; p >= 0; p--) nextTail[p] = (spec[p] === '"' && F.tws(p + 1)) || F.tws(p) ? p : nextTail[p + 1];
  const text = (d) => (d < n && !isLtUnit(spec[d]) ? spec.slice(d, nextTail[d + 1]) : null); // it never needs a line terminator
  const head = /^\*\*Input\*\*:/gim;
  for (let h; (h = head.exec(spec));) {
    const a = head.lastIndex, b = F.nnw[a];
    let r = null;
    if (/^User description:/i.test(spec.slice(b, b + 17))) {
      const c0 = b + 17;
      for (let c = F.nnw[c0]; c >= c0 && r == null; c--) r = (spec[c] === '"' ? text(c + 1) : null) ?? text(c);
    }
    if (r == null) r = (spec[b] === '"' ? text(b + 1) : null) ?? text(b);
    for (let x = b - 1; x >= a && r == null; x--) r = text(x);
    if (r != null) return r;
  }
  return null;
}
// A spec-kit story heading → [text, number, title, priority] | null — what
// /^user story\s+(\d+)\s*[-–—:.]?\s*(.*?)\s*(?:\((?:priority\s*:\s*)?(P\d)\))?\s*(?:🎯.*)?$/iu matched, the title read by a
// scan (its lazy capture rescanned a long blank run at each step — 1.17 H). When no title end reads, nothing does.
const RE_SPECKIT_PRIORITY = /\((?:priority\s*:\s*)?(P\d)\)/iuy;
function specKitStoryHeading(text) {
  const h = /^user story\s+(\d+)/iu.exec(text);
  if (!h) return null;
  const F = blankFacts(text), n = F.n;
  let ts = F.nnw[h[0].length];
  if (ts < n && "-–—:.".includes(text[ts])) ts = F.nnw[ts + 1];
  const target = "\u{1F3AF}";
  const tail = (e) => { // \s*(?:\((?:priority\s*:\s*)?(P\d)\))?\s*(?:🎯.*)?$ at e → { prio } | null
    const ends = (p) => p === n || (text.startsWith(target, p) && F.nlt[p + 2] === n);
    const p1 = F.nnw[e];
    RE_SPECKIT_PRIORITY.lastIndex = p1;
    const pm = RE_SPECKIT_PRIORITY.exec(text);
    if (pm && ends(F.nnw[p1 + pm[0].length])) return { prio: pm[1] };
    return ends(p1) ? { prio: undefined } : null;
  };
  for (let e = ts, lt = F.nlt[ts]; e <= lt;) {
    const r = tail(e);
    if (r) return [text, h[1], text.slice(ts, e), r.prio];
    if (e === n) break;
    e = isWsUnit(text[e]) ? Math.max(F.nnw[e], e + 1) : e + 1; // a blank run ends the same way from each of its units
  }
  return null;
}
// $1 of each match of /FROM:\s*`?(?:#+\s*)?Requirement:\s*([^`\n]+?)`?\s*$/gim (head: its part up to the colon, global) — by
// a scan: the lazy name before `?\s*$ rescanned a long blank run at each step (1.17 H).
function renamedRequirementNames(s, head) {
  const F = blankFacts(s), n = F.n;
  const nextTws = new Int32Array(n + 1), nextStop = new Int32Array(n + 1), lastLt = new Int32Array(n + 1);
  nextTws[n] = n; nextStop[n] = n;
  for (let p = n - 1; p >= 0; p--) {
    nextTws[p] = F.tws(p) ? p : nextTws[p + 1];
    nextStop[p] = s[p] === "`" || s[p] === "\n" ? p : nextStop[p + 1];
  }
  for (let i = 0, l = -1; i <= n; i++) { lastLt[i] = l; if (isLtUnit(s[i])) l = i; }
  const endAt = (p) => (F.nnw[p] === n ? n : lastLt[F.nnw[p]]); // where \s*$ stops: the end, or before the run's last line terminator
  const name = (cs) => { // (.+?)`?\s*$ from cs → { e, end } | null
    if (cs >= n || s[cs] === "`" || s[cs] === "\n") return null;
    const B = nextStop[cs], e = nextTws[cs + 1];
    if (e < B) return { e, end: endAt(e) };
    if (B === n || s[B] === "\n") return { e: B, end: endAt(B) };
    return F.tws(B + 1) ? { e: B, end: endAt(B + 1) } : null; // a closing backtick
  };
  const out = [];
  head.lastIndex = 0;
  for (let h; (h = head.exec(s));) {
    const a = head.lastIndex;
    let r = null, cs = F.nnw[a];
    for (; cs >= a && !r; cs--) r = name(cs);
    if (r) { out.push(s.slice(cs + 1, r.e)); head.lastIndex = r.end; }
  }
  return out;
}
function parseSpecKit(dir, read, W) {
  const spec = read(path.join(dir, "spec.md"));
  const plan = read(path.join(dir, "plan.md"));
  const tasks = read(path.join(dir, "tasks.md"));
  if (spec == null && tasks == null) return null;
  const model = newImportModel();
  model.nameHint = path.basename(dir).replace(/^\d+[-_]/, "") || path.basename(dir);
  // /\s*\*?\((?:mandatory|optional|include if[^)]*)\)\*?\s*$/i dropped — read after the last ')' but the closing one (the
  // only place it can match), from a blank run's start (?<!\s): each "(include if" and each blank rescanned the rest (1.17 H).
  const norm = (t) => {
    let e = stripEnd(t, isWsUnit).length;
    if (t[e - 1] === "*") e--;
    if (t[e - 1] !== ")") return t.trim();
    const from = e >= 2 ? t.lastIndexOf(")", e - 2) + 1 : 0;
    return (t.slice(0, from) + t.slice(from).replace(/(?<!\s)\s*\*?\((?:mandatory|optional|include if[^)]*)\)\*?\s*$/i, "")).trim();
  };
  if (spec != null) {
    const lines = stripHtmlComments(spec).split(/\r?\n/);
    const hs = mdHeadings(lines);
    const used = new Set();
    const h1 = hs.find((h) => h.level === 1);
    if (h1) { used.add(h1.i); model.title = h1.text.replace(/^feature specification:\s*/i, "").trim() || null; }
    const input = specKitInput(spec);
    model.summary = input != null && input.trim() && !/\$ARGUMENTS/.test(input) ? input.trim() : null;
    // spec-kit's own metadata (branch, date, status; Input is the summary) describes its workflow, not the feature.
    lines.forEach((l, i) => { if (/^\s*\*\*(?:feature branch|created|status|input)\*\*\s*:/i.test(l)) used.add(i); });
    // body: the story's lines (all written into it: prose, scenarios, then whatever follows the scenarios).
    const storyFrom = (body, printed, title, priority) => {
      // \s*:?\s*(?:\*\*|__)?\s*:?\s*$ → \s*(?::\s*)?(?:(?:\*\*|__)\s*)?(?::\s*)?$ (the same lines): blank runs meeting with
      // nothing between them backtracked exponentially (1.17 H).
      const at = body.findIndex((l) => /^\s*(?:\*\*|__)?acceptance scenarios(?:\*\*|__)?\s*(?::\s*)?(?:(?:\*\*|__)\s*)?(?::\s*)?$/i.test(l));
      const off = at === -1 ? 0 : at + 1;
      const scen = mdListItems(body.slice(off), true).filter((it) => at !== -1 || /\bthen\b|\bent[ãa]o\b|\bentonces\b/i.test(it.text));
      const inScen = new Set(scen.flatMap((it) => it.at.map((r) => r + off)));
      const keep = (l, r) => !inScen.has(r) && !RE_MD_HR.test(l);
      const prose = tidyLines(body.slice(0, at === -1 ? body.length : at).filter(keep));
      const after = at === -1 ? [] : tidyLines(body.slice(off).filter((l, r) => keep(l, r + off)));
      model.stories.push({
        printed, key: `User Story ${printed}`, title, priority, prose, quote: [], after,
        criteria: scen.map((it, j) => ({ key: `User Story ${printed} / Scenario ${j + 1}`, raw: it.text, ears: earsFromGwt(it.text) })),
      });
    };
    hs.forEach((h, k) => {
      const m = specKitStoryHeading(h.text);
      if (!m) return;
      const [lo, hi] = mdRange(lines, hs, k);
      markRange(used, h.i, hi);
      storyFrom(lines.slice(lo, hi), +m[1], m[2].trim() || `User Story ${m[1]}`, m[3] ? m[3].toUpperCase() : null);
    });
    if (!model.stories.length) { // older template: one "Primary User Story" + "Acceptance Scenarios"
      const pk = hs.findIndex((h) => /^primary user story/i.test(h.text));
      const ak = hs.findIndex((h) => /^acceptance scenarios/i.test(h.text));
      if (ak !== -1) {
        const prose = pk !== -1 ? mdBody(lines, hs, pk) : [];
        for (const k of pk !== -1 ? [pk, ak] : [ak]) { used.add(hs[k].i); markRange(used, ...mdRange(lines, hs, k)); }
        storyFrom([...prose, "**Acceptance Scenarios**:", ...mdBody(lines, hs, ak)], 1, titleFromStory(prose) || model.title || "User Story 1", null);
      }
    }
    if (!model.stories.length) model.warnings.push(W.wNoRequirements("spec.md"));
    const section = (re, key) => {
      const k = hs.findIndex((h) => h.level > 1 && !used.has(h.i) && re.test(norm(h.text)));
      if (k === -1) return;
      const [lo, hi] = mdRange(lines, hs, k);
      const rest = unusedLines(lines, used, lo, hi);
      markRange(used, hs[k].i, hi);
      model.extra.push({ key, lines: rest.filter((l) => !/^\s*#{1,6}\s+measurable outcomes/i.test(l)) });
    };
    section(/^functional requirements$/i, "functional");
    section(/^key entities$/i, "entities");
    section(/^success criteria$/i, "success");
    section(/^edge cases$/i, "edge");
    hs.forEach((h, k) => {
      if (h.level !== 2 || used.has(h.i)) return;
      const t = norm(h.text);
      const [lo, hi] = mdRange(lines, hs, k);
      if (SPECKIT_GUIDANCE.test(t.replace(/^[^\p{L}\p{N}]+/u, ""))) { markRange(used, h.i, hi); return; } // "## ⚡ Quick Guidelines"
      if (/^(?:user scenarios|requirements$)/i.test(t)) { used.add(h.i); return; } // their sub-sections are read above; the rest is carried
      const rest = unusedLines(lines, used, lo, hi); // "## User Stories" wrapping the stories read above
      markRange(used, h.i, hi);
      if (tidyLines(rest).length) model.extra.push({ heading: "## " + t, lines: rest });
    });
    model.carried.push(...leftoverExtras(lines, hs, used)); // e.g. ### Non-Functional Requirements (NFR-001)
    for (const x of [...model.extra, ...model.carried]) for (const l of x.lines) for (const id of l.match(/(?<![A-Za-z0-9])(?:FR|SC)-\d+(?!\d)/g) || []) model.mapping[id] = id;
  }
  if (plan != null) model.design = { text: plan, file: "plan.md" };
  else model.warnings.push(W.wNoDesign("plan.md"));
  if (tasks != null) model.tasks = { text: tasks, file: "tasks.md" };
  else model.warnings.push(W.wNoTasks);
  model.skipped = ["research.md", "data-model.md", "quickstart.md", "contracts"].filter((x) => fs.existsSync(path.join(dir, x)));
  return model;
}

// OpenSpec: a capability (openspec/specs/<capability>/spec.md) or a change (openspec/changes/<id>/ — proposal.md,
// tasks.md, design.md, specs/<capability>/spec.md with ADDED/MODIFIED/REMOVED/RENAMED Requirements).
// A scenario clause "- **WHEN** …" → [line, keyword, text] | null — /^\s*[-*+]\s+(?:\*\*|__)?(GIVEN|WHEN|THEN|AND|BUT)(?:\*\*|__)?\s*:?\s*(.*)$/i
// with the text read by a scan (\s*:?\s*(.*)$ backtracked quadratically before a line break — 1.17 H).
const RE_OS_CLAUSE_HEAD = /^\s*[-*+]\s+(?:\*\*|__)?(GIVEN|WHEN|THEN|AND|BUT)(?:\*\*|__)?/i;
function openSpecClause(line) {
  const h = RE_OS_CLAUSE_HEAD.exec(line);
  if (!h) return null;
  let i = h[0].length;
  while (i < line.length && isWsUnit(line[i])) i++;
  if (line[i] === ":") { i++; while (i < line.length && isWsUnit(line[i])) i++; }
  const text = line.slice(i);
  return RE_LINE_TERMINATOR.test(text) ? null : [line, h[1], text];
}
function parseOpenSpec(dir, read, W) {
  const walkSpecs = (d, depth, out) => {
    if (depth > 4) return out;
    for (const n of safeReaddir(d).sort()) {
      const p = path.join(d, n);
      let st;
      try { st = fs.lstatSync(p); } catch { continue; }
      if (st.isDirectory()) walkSpecs(p, depth + 1, out);
      else if (n === "spec.md" && st.isFile()) out.push(p);
    }
    return out;
  };
  const model = newImportModel();
  model.nameHint = path.basename(dir);
  let specFiles;
  let tasks = null;
  let proposal = null;
  if (fs.existsSync(path.join(dir, "spec.md"))) specFiles = [path.join(dir, "spec.md")];
  else if (fs.existsSync(path.join(dir, "proposal.md")) || fs.existsSync(path.join(dir, "specs")) || fs.existsSync(path.join(dir, "tasks.md"))) {
    specFiles = walkSpecs(path.join(dir, "specs"), 0, []);
    tasks = read(path.join(dir, "tasks.md"));
    proposal = read(path.join(dir, "proposal.md"));
  } else specFiles = walkSpecs(dir, 0, []); // a folder of capabilities
  const texts = specFiles.map((f) => ({ file: f, cap: path.basename(path.dirname(f)), text: read(f) })).filter((x) => x.text != null);
  if (!texts.length && tasks == null && proposal == null) return null;
  if (proposal != null) {
    const lines = stripHtmlComments(proposal).split(/\r?\n/);
    const hs = mdHeadings(lines);
    const used = new Set();
    hs.filter((h) => h.level === 1).forEach((h) => used.add(h.i));
    const why = hs.findIndex((h) => /^why\b/i.test(h.text));
    const [sLo, sHi] = why !== -1 ? mdRange(lines, hs, why) : [0, lines.length];
    if (why !== -1) used.add(hs[why].i);
    const sAt = [];
    model.summary = firstParagraph(lines.slice(sLo, sHi), sAt);
    sAt.forEach((r) => used.add(sLo + r));
    hs.forEach((h, k) => {
      if (h.level !== 2 || k === why) return;
      const [lo, hi] = mdRange(lines, hs, k);
      const rest = unusedLines(lines, used, lo, hi); // without a ## Why, the summary paragraph may sit in here
      markRange(used, h.i, hi);
      if (tidyLines(rest).length) model.extra.push({ heading: "## " + h.text, lines: rest });
    });
    model.carried.push(...leftoverExtras(lines, hs, used));
  }
  for (const { cap, text } of texts) {
    const lines = stripHtmlComments(text).split(/\r?\n/);
    const hs = mdHeadings(lines);
    const used = new Set();
    const h1 = hs.find((h) => h.level === 1);
    if (h1) used.add(h1.i);
    if (!model.title && h1) { // h1.text.replace(/\s+specification$/i, ""), without rescanning a blank run from each unit (1.17 H)
      const sp = h1.text.search(/specification$/i);
      let w0 = sp;
      while (w0 > 0 && isWsUnit(h1.text[w0 - 1])) w0--;
      model.title = (sp > 0 && w0 < sp ? h1.text.slice(0, w0) : h1.text).trim() || null;
    }
    const purpose = hs.findIndex((h) => /^purpose\b/i.test(h.text));
    if (!model.summary && purpose !== -1) { // the rest of Purpose (and every other capability's Purpose) is carried
      const [lo, hi] = mdRange(lines, hs, purpose);
      const at = [];
      model.summary = firstParagraph(lines.slice(lo, hi), at);
      used.add(hs[purpose].i);
      at.forEach((r) => used.add(lo + r));
    }
    let section = "";
    hs.forEach((h, k) => {
      if (h.level <= 2) section = h.text;
      if (h.level <= 2 && /^(?:(?:added|modified|removed|renamed)\s+)?requirements\b/i.test(h.text)) used.add(h.i);
      if (/^renamed\b/i.test(section) && h.level <= 2) {
        const [lo, hi] = mdRange(lines, hs, k);
        markRange(used, lo, hi);
        const body = lines.slice(lo, hi).join("\n");
        const froms = renamedRequirementNames(body, /FROM:\s*`?(?:#+\s*)?Requirement:/gi).map((x) => x.trim());
        const tos = renamedRequirementNames(body, /TO:\s*`?(?:#+\s*)?Requirement:/gi).map((x) => x.trim());
        froms.forEach((f, i) => model.warnings.push(W.wRenamed(f, tos[i] || "?")));
      }
      const m = headPlus(h.text, /^requirement:/i); // /^requirement:\s*(.+)$/i (headPlus: 1.17 H)
      if (!m) return;
      const name = m[1].trim();
      const [lo, hi] = mdRange(lines, hs, k);
      markRange(used, h.i, hi);
      if (/^removed\b/i.test(section)) { model.warnings.push(W.wRemoved(name)); return; }
      const body = lines.slice(lo, hi);
      const sub = mdHeadings(body);
      const firstScenario = sub.find((s) => /^scenario:/i.test(s.text));
      const statement = body.slice(0, firstScenario ? firstScenario.i : body.length).filter((l) => l.trim() && !/^\s*#/.test(l)).map((l) => l.trim());
      const criteria = [];
      const after = [];
      // Only the sub-headings at the scenarios' level: a deeper one is inside a scenario's body. A non-scenario
      // sub-section after the scenarios (#### Notes) follows the criteria verbatim.
      const top = firstScenario ? sub.filter((s) => s.i >= firstScenario.i && s.level <= firstScenario.level) : [];
      top.forEach((s) => {
        const sb = mdBody(body, sub, sub.indexOf(s));
        const sm = headPlus(s.text, /^scenario:/i); // /^scenario:\s*(.+)$/i
        if (!sm) { after.push("", body[s.i], ...sb); return; }
        const cl = { given: "", when: "", then: "" };
        let last = null;
        let open = false; // a clause bullet's wrapped (indented or lazy) continuation extends that clause
        const rawParts = [];
        const other = [];
        for (const l of sb) {
          const b = openSpecClause(l);
          if (b) {
            open = true;
            rawParts.push(b[1].toUpperCase() + " " + b[2].trim());
            const kw = b[1].toLowerCase();
            if (kw === "and" || kw === "but") { if (last) cl[last] += " and " + trimClause(b[2]); continue; }
            cl[kw] = cl[kw] ? cl[kw] + " and " + trimClause(b[2]) : trimClause(b[2]);
            last = kw;
            continue;
          }
          if (!l.trim()) { open = false; if (other.length) other.push(""); continue; }
          if (open && last && !/^\s*(?:[-*+]\s|#|>|\|)/.test(l)) {
            cl[last] = trimClause(cl[last] + " " + l.trim());
            rawParts[rawParts.length - 1] += " " + l.trim();
            continue;
          }
          open = false;
          other.push(l.trimEnd());
        }
        const prose = tidyLines(other);
        // A prose-only scenario becomes its criterion's text; prose beside clauses follows the criteria.
        const raw = rawParts.join(" ") || [sm[1].trim(), prose.join(" ").trim()].filter(Boolean).join(" — ");
        criteria.push({ key: `${cap}: ${name} / Scenario: ${sm[1].trim()}`, raw, ears: rawParts.length ? earsFromClauses(cl, "en") : prose.length ? earsFromGwt(prose.join(" ")) : null });
        if (rawParts.length && prose.length) after.push("", ...prose);
      });
      model.stories.push({ printed: null, key: `${cap}: Requirement: ${name}`, title: name + (/^modified\b/i.test(section) ? " " + W.modified : ""), priority: null, prose: [], quote: statement, after: tidyLines(after), criteria });
    });
    model.carried.push(...leftoverExtras(lines, hs, used, texts.length > 1 ? cap + ": " : "")); // ## Constraints, Purpose's other paragraphs…
  }
  if (!model.stories.length && texts.length) model.warnings.push(W.wNoRequirements(texts.map((x) => toPosix(path.relative(dir, x.file))).join(", ")));
  const des = read(path.join(dir, "design.md"));
  if (des != null) model.design = { text: des, file: "design.md" };
  if (tasks != null) model.tasks = { text: tasks, file: "tasks.md" };
  else model.warnings.push(W.wNoTasks);
  return model;
}

const RE_IMPORT_TASK_HEAD = /^(\s*)[-*+]\s+\[([ xX~\-/])\](\*)?/;
// line.replace(/_Requirements:\s*(.+?)_(?=\s|$)/g, fn) — fn(match, list) — by a scan: the lazy list rescanned a long blank run
// at each step, and each marker the rest of a line with no closing "_" (1.17 H). As the engine: the list runs from the first
// non-blank to the first "_" followed by a blank or the end, never over a line terminator — else, when that "_" comes
// right after the blanks, the list is their last one.
function replaceRequirementsMarkers(s, fn) {
  const open = "_Requirements:";
  if (!s.includes(open)) return s;
  const n = s.length;
  const nextClose = new Int32Array(n + 2), nlt = new Int32Array(n + 1);
  nextClose[n] = nextClose[n + 1] = n + 1;
  nlt[n] = n;
  for (let p = n - 1; p >= 0; p--) {
    nlt[p] = isLtUnit(s[p]) ? p : nlt[p + 1];
    nextClose[p] = s[p] === "_" && (p + 1 === n || isWsUnit(s[p + 1])) ? p : nextClose[p + 1];
  }
  let out = "", at = 0;
  for (let i = s.indexOf(open); i !== -1;) {
    const a = i + open.length;
    let j = a;
    while (j < n && isWsUnit(s[j])) j++;
    let cs = -1, e = -1;
    if (j < n && nextClose[j + 1] <= nlt[j]) { cs = j; e = nextClose[j + 1]; }
    else if (j > a && !isLtUnit(s[j - 1]) && nextClose[j] === j) { cs = j - 1; e = j; }
    if (cs === -1) { i = s.indexOf(open, i + 1); continue; }
    out += s.slice(at, i) + fn(s.slice(i, e + 1), s.slice(cs, e));
    at = e + 1;
    i = s.indexOf(open, at);
  }
  return at ? out + s.slice(at) : s;
}
// s.replace(/_LABEL:\s*([^_\n]+)_/g, fn) — fn(match, list) — by a scan (the blanks before the list backtracked quadratically —
// 1.17 H): the list runs from the first non-blank to the next "_" (never a line feed) — else, when that "_" comes right after
// the blanks, the list is their last one (not a line feed).
function replaceUnderscoreList(s, label, fn) {
  const open = "_" + label + ":";
  let out = "", at = 0;
  for (let i = s.indexOf(open); i !== -1;) {
    const a = i + open.length;
    let j = a;
    while (j < s.length && isWsUnit(s[j])) j++;
    let b = j;
    while (b < s.length && s[b] !== "_" && s[b] !== "\n") b++;
    let cs = -1;
    if (s[b] === "_" && b > j) cs = j;
    else if (b === j && s[j] === "_" && j > a && s[j - 1] !== "\n") cs = j - 1;
    if (cs === -1) { i = s.indexOf(open, i + 1); continue; }
    out += s.slice(at, i) + fn(s.slice(i, b + 1), s.slice(cs, b));
    at = b + 1;
    i = s.indexOf(open, at);
  }
  return at ? out + s.slice(at) : s;
}
// tasks.md of any of the three tools → dev-spec tasks: every checkbox (outside code fences and HTML comments)
// that is not a parent of numbered sub-tasks becomes `- [x|space] N.` numbered 1…K in order, keeping its
// checkbox state, its [P]/[USn] tags and its indented sub-lines; a Kiro/OpenSpec parent ("2." with "2.1", "2.2")
// becomes a `## <its title>` phase heading. _Requirements:_ references are rewritten through `refs`.
function importTasks(text, refs, name, lng, W, mapping, warnings) {
  const L = i18n.msg(lng).importSpec;
  const src = String(text).replace(/^\uFEFF/, "").split(/\r?\n/);
  const items = [];
  const inert = new Set(); // lines inside a comment or a fence that no task owns: copied, never rewritten
  let fence = null;
  let fenceOwner = null; // a fenced block indented under a task stays in that task's body
  let inComment = false;
  let cur = null;
  const opensComment = (l) => l.includes("<!--") && !l.slice(l.lastIndexOf("<!--")).includes("-->");
  src.forEach((l, i) => {
    if (inComment) { inert.add(i); if (l.includes("-->")) inComment = false; cur = null; return; }
    const f = l.match(RE_FENCE);
    if (fence) {
      if (fenceOwner) fenceOwner.body.push(i);
      else inert.add(i);
      if (closesFence(l, fence)) { fence = null; fenceOwner = null; }
      return;
    }
    if (f) {
      fence = f[1];
      fenceOwner = cur && indentOf(l) > cur.indent ? cur : null;
      if (fenceOwner) cur.body.push(i);
      else { inert.add(i); cur = null; }
      return;
    }
    // Any one-character state is a task: Kiro marks one in progress `[-]` (also `[~]`, `[/]` elsewhere). Only x/X is
    // done — anything else imports as open, never dropped into the previous task's body.
    const h = RE_IMPORT_TASK_HEAD.exec(l); // /^(\s*)[-*+]\s+\[([ xX~\-/])\](\*)?\s+(.*)$/, its text scanned (1.17 H)
    const text = h && restAfterBlanks(l, h[0].length, true);
    const m = text == null ? null : [l, h[1], h[2], h[3], text];
    if (m) {
      const rest = m[4];
      const idm = rest.match(/^(T\d+)\b[.:]?\s*(.*)$/) || rest.match(/^(\d+(?:\.\d+)*)\.?(?=\s)\s*(.*)$/);
      cur = { i, indent: m[1].length, done: /[xX]/.test(m[2]), optional: !!m[3], id: idm ? idm[1] : null, text: idm ? idm[2] : rest, body: [] };
      items.push(cur);
    } else if (cur && l.trim() && indentOf(l) > cur.indent) cur.body.push(i);
    else if (l.trim()) { cur = null; if (/^\s*<!--.*-->\s*$/.test(l)) inert.add(i); }
    if (opensComment(l)) { inComment = true; cur = null; if (!m) inert.add(i); } // a task line that opens a comment is still a task
  });
  // Parent ids ("2" when a "2.1" exists), computed once: a per-item scan made a flat 10 000-task file quadratic.
  const parentIds = new Set(items.filter((o) => o.id && o.id.includes(".")).map((o) => o.id.slice(0, o.id.indexOf("."))));
  const isParent = (it) => !!it.id && /^\d+$/.test(it.id) && parentIds.has(it.id);
  const byLine = new Map(items.map((it) => [it.i, it]));
  const bodyOf = new Map();
  items.forEach((it) => it.body.forEach((b) => bodyOf.set(b, it)));
  let n = 0;
  let anyRefs = false;
  // taskNo: the task a reference belongs to; a line no task owns is reported by its line number instead.
  const rewrite = (line, taskNo, lineNo) => replaceRequirementsMarkers(line, (all, list) => {
    anyRefs = true;
    const outIds = [];
    for (const ref of list.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
      const hit = refs(ref);
      if (hit) hit.forEach((x) => { if (!outIds.includes(x)) outIds.push(x); });
      else { outIds.push(ref); warnings.push(taskNo != null ? W.wUnknownRef(taskNo, ref) : W.wUnknownRefLine(lineNo, ref)); }
    }
    return "_Requirements: " + outIds.join(", ") + "_";
  });
  const out = [L.tasksTitle(name), "", "{{NOTE}}", ""];
  const heading = (h) => { if (out[out.length - 1].trim()) out.push(""); out.push(h); };
  let group = null; // the parent task whose `## <title>` phase heading is open
  let seen = false;
  src.forEach((l, i) => {
    if (!seen && /^#\s/.test(l)) { seen = true; return; } // the source's title — ours replaces it
    if (l.trim()) seen = true;
    const it = byLine.get(i);
    if (it) {
      // Its sub-tasks are the tasks now. No new task is the parent (its old number belongs to another task after
      // renumbering), so an unknown reference on it — or in its own body below — is reported by line.
      if (isParent(it)) { heading(`## ${rewrite(it.text, null, i + 1)}`); group = it; return; }
      // A stand-alone task after a parent's group is not in that phase: a neutral heading closes it.
      if (group && it.indent <= group.indent && !(it.id && it.id.startsWith(group.id + "."))) { heading(L.otherTasks); group = null; }
      n++;
      if (it.id) mapping["task " + it.id] = "task " + n;
      it.no = n;
      out.push(`- [${it.done ? "x" : " "}] ${n}. ${rewrite(it.text, n, i + 1)}${it.optional ? " " + L.optional : ""}`);
      return;
    }
    if (/^#{1,6}\s/.test(l) && !bodyOf.has(i) && !inert.has(i)) group = null; // the source's own heading opens a new phase
    const owner = bodyOf.get(i);
    if (owner && !isParent(owner)) {
      const body = l.slice(Math.min(owner.indent, indentOf(l)));
      out.push(/^\s{2}/.test(body) ? rewrite(body, owner.no, i + 1) : "  " + rewrite(body.trimStart(), owner.no, i + 1));
      return;
    }
    out.push(owner || !inert.has(i) ? rewrite(l, null, i + 1) : l); // owner here = a parent (see above)
  });
  return { text: out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n", count: n, anyRefs }; // trimEnd: /\s*$/ is quadratic (1.17 F review)
}

// The scaffold's template tasks.md that spec_import keeps when the source has none: each _Requirements:_ keeps only the
// AC IDs the imported requirements define, and each _Makes green:_ names the planned tests covering the task's kept ACs
// — else a placeholder (trackTaskBlock's rule). The template's own US-1.AC-3 / US-2.AC-1 / T-05 read as typos in
// trace_check on a freshly imported feature. Headings and task lines scope the ACs a _Makes green:_ line looks at.
// A +saas / +ai track block (its template heading, any language) keeps only the IDs the import defines AS that track's
// criteria (trackAcIds): the template's US-1.AC-5…9 are its own track criteria, and the import's criteria of those
// numbers are unrelated ones — kept by number, tenant isolation / load test / the prompt task "covered" a coupon or a
// checkout criterion (and "made green" its unit test) and trace_check passed with nothing implementing it.
function fitTemplateTasks(tasksText, reqText, planText, lng) {
  const I = i18n.msg(lng).importSpec;
  const T = i18n.msg(lng).tracks;
  const known = requirementAcIds(reqText || "");
  const marked = markerTracks(); // + the track packs (1.15): their task block is the heading carrying their marker
  const trackKnown = Object.fromEntries(marked.map((tr) => [tr, trackAcIds(reqText || "", tr)]));
  const testsFor = new Map(); // AC → the planned T-IDs covering it, in plan order
  for (const [tid, r] of testIndex(planText || "")) {
    for (const ac of extractAcIds(r.row)) {
      if (!testsFor.has(ac)) testsFor.set(ac, []);
      testsFor.get(ac).push(tid);
    }
  }
  let acs = [];
  let section = null; // the track whose template task block the current heading opens, else null
  return String(tasksText).split("\n").map((line) => {
    if (/^\s*#{1,6}\s/.test(line)) {
      section = marked.find((tr) => trackTaskHeadingIs(tr, line.trim())) || null;
    }
    if (/^\s*#{1,6}\s/.test(line) || /^\s*[-*+]\s+\[[ xX-]\]/.test(line)) acs = [];
    const fits = section ? trackKnown[section] : known;
    // /_Requirements:\s*([^_\n]+)_/g then /_Makes green:\s*([^_\n]+)_/g, by a scan (1.17 H)
    const fitted = replaceUnderscoreList(line, "Requirements", (m, ids) => {
      const keep = ids.split(/[,;]/).map((s) => s.trim()).filter((id) => fits.has(id));
      acs = acs.concat(keep);
      return "_Requirements: " + (keep.length ? keep.join(", ") : section ? T.acPlaceholder(section) : I.taskAcPlaceholder) + "_";
    });
    return replaceUnderscoreList(fitted, "Makes green", () => {
      const ids = [...new Set(acs.flatMap((ac) => testsFor.get(ac) || []))];
      return "_Makes green: " + (ids.length ? ids.join(", ") : I.taskTestPlaceholder) + "_";
    });
  }).join("\n");
}

// ---------------------------------------------------------------------------
// spec_import (1.14 C3) — three more sources, with the same guarantees (a NEW feature, the source only read and inside the project,
// mapping + warnings, the localized "Imported from" note, tracks auto-classified unless given):
//   plan      a Markdown plan: Claude Code plan mode (plansDirectory — default ~/.claude/plans, OUTSIDE the project: copy the
//             plan in, or point plansDirectory inside it) or Cursor (.cursor/plans/*.plan.md — YAML front matter name /
//             overview / todos [{id, content, status}]). Goals and acceptance-like bullets → US-1's criteria (EARS when the bullet
//             already reads like one, else kept with [NEEDS CLARIFICATION]); checklists (or Cursor todos, else the items of a
//             Steps / Implementation section, else its sub-headings) → tasks keeping their state; the file paths a step names →
//             _Implements:_; everything else (context, approach, files, risks, verification commands) → design.md.
//   execplan  a Codex ExecPlan (PLANS.md): Validation and Acceptance → criteria; Progress (state kept) + Concrete Steps → tasks,
//             a step naming a check command (npm test, pytest, curl …) → _Verify:_; Decision Log → design.md "## Decisions"
//             (D-1 …); Purpose → the summary; the living sections (Surprises & Discoveries, Outcomes, Context, Plan of Work …) →
//             design.md verbatim.
//   bmad      BMAD-METHOD docs: the PRD (docs/prd.md, a sharded docs/prd/, v6 _bmad-output/planning-artifacts/) FR / NFR lines →
//             FR-n / NFR-n (dev-spec's IDs), its epic stories and story files (docs/stories/*.md, v6 implementation-artifacts)
//             → US-1…US-n in story order (a story file wins over the PRD's copy), their ACs → US-n.AC-m, Tasks / Subtasks →
//             tasks tagged [USn] (a subtask is a task of its own, as every imported checkbox is), "(AC: 1, 3)" →
//             _Requirements:_; architecture.md + Technical Assumptions / UI Design Goals + each story's Dev Notes → design.md.
// A path naming a folder with several plans is refused (name the file). Nothing is dropped silently: what no mapping takes is
// carried (design.md for a plan / ExecPlan, requirements.md for a PRD) or named in a warning.
// ---------------------------------------------------------------------------
// /^(\s*)[-*+]\s+\[([ xX~\-/])\]\s+(.*)$/ → [line, indent, box, text] | null (restAfterBlanks for the text)
const RE_PLAN_CHECKBOX_HEAD = /^(\s*)[-*+]\s+\[([ xX~\-/])\]/;
function planCheckbox(l) {
  const h = RE_PLAN_CHECKBOX_HEAD.exec(l);
  const rest = h && restAfterBlanks(l, h[0].length, true);
  return rest == null ? null : [l, h[1], h[2], rest];
}
// /^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[([ xX~\-/])\]\s+)?(.*)$/ → [line, indent, box | undefined, text] | null
const RE_PLAN_ITEM_HEAD = /^(\s*)(?:[-*+]|\d+[.)])/;
const RE_PLAN_ITEM_BOX = /\[([ xX~\-/])\](?=\s)/y;
function planItem(l) {
  const h = RE_PLAN_ITEM_HEAD.exec(l);
  if (!h || !isWsUnit(l[h[0].length])) return null;
  let q = h[0].length;
  while (q < l.length && isWsUnit(l[q])) q++;
  RE_PLAN_ITEM_BOX.lastIndex = q;
  const box = RE_PLAN_ITEM_BOX.exec(l);
  const rest = restAfterBlanks(l, box ? q + 3 : h[0].length, true);
  return rest == null ? null : [l, h[1], box ? box[1] : undefined, rest];
}
// A single backticked name reads as a file with one of these extensions (`package.json`); a name with a folder part needs none.
const PLAN_FILE_EXT = new Set(["js", "mjs", "cjs", "jsx", "ts", "tsx", "mts", "cts", "py", "rb", "go", "rs", "java", "kt", "kts", "scala", "cs", "fs", "php",
  "swift", "m", "mm", "c", "h", "cc", "cpp", "hpp", "md", "mdx", "json", "jsonc", "yaml", "yml", "toml", "ini", "cfg", "conf", "css", "scss", "sass", "less",
  "html", "htm", "vue", "svelte", "astro", "sql", "prisma", "graphql", "gql", "proto", "sh", "bash", "zsh", "ps1", "bat", "xml", "gradle", "lock", "txt",
  "csv", "tf", "hcl", "ex", "exs", "erl", "dart", "lua", "ipynb"]);
const PLAN_NOT_FILES = new Set(["node.js", "next.js", "vue.js", "react.js", "nuxt.js", "express.js", "three.js", "d3.js", "chart.js", "nest.js", "ember.js", "backbone.js", "alpine.js", "solid.js"]);
const PLAN_BARE_FILES = /^(?:Dockerfile|Makefile|Procfile|Gemfile|Rakefile|Jenkinsfile|Containerfile|Justfile)$/;
// The file paths a step names → its _Implements:_ list: backticked paths / file names, markdown link targets and bare tokens
// with a folder part and an extension. Never a URL, an absolute or home path, '..', an alias (@/…), a glob or a path a
// marker couldn't read back (spaces, ',' ';'); a trailing :line / #L10 is dropped.
function planPaths(text) {
  const out = [];
  const add = (raw, spanned) => {
    const p0 = String(raw).trim().replace(/^\.\//, "");
    // .replace(/(?::\d+(?:[-:]\d+)*|#L\d+(?:-L?\d+)?)$/, "") — the leftmost of the two anchors, found without rescanning a
    // long run of ":1" from each of its units (1.17 H): a "#L…" one can only start at the last '#'.
    const h = p0.lastIndexOf("#"), c = colonLineAnchorAt(p0);
    const hl = h !== -1 && /^#L\d+(?:-L?\d+)?$/.test(p0.slice(h)) ? h : -1;
    const cut = c === -1 ? hl : hl === -1 ? c : Math.min(c, hl);
    const p = cut === -1 ? p0 : p0.slice(0, cut);
    if (!p || p.length > 200 || /[\s,;<>|"'`*?\\]/.test(p) || /^(?:[a-z][a-z0-9+.-]*:|\/|~|@|\$|%)/i.test(p) || /(?:^|\/)\.\.(?:\/|$)/.test(p)) return;
    if (PLAN_NOT_FILES.has(p.toLowerCase())) return;
    const bare = p.replace(/\/+$/, "");
    const last = bare.split("/").pop();
    const ext = (last.match(/\.([A-Za-z0-9]{1,10})$/) || [])[1];
    if (bare.includes("/")) {
      if (!/^[\w.@+\-/[\]()]+$/.test(p) || (!ext && !spanned)) return;
    } else if (!spanned || !((ext && PLAN_FILE_EXT.has(ext.toLowerCase()) && /^[\w.\-+]+$/.test(p)) || PLAN_BARE_FILES.test(p))) return;
    if (!out.includes(p)) out.push(p);
  };
  const s = String(text || "");
  for (const m of s.matchAll(/`([^`\n]+)`/g)) add(m[1], true);
  // Linear (full review Pb6): a link text holds no '[' (each '[' scans only up to the next bracket — "[" × N was quadratic)
  // and a link target is bounded (add() refuses a path over 200 characters anyway).
  const rest = s.replace(/`[^`\n]*`/g, " ").replace(/\[([^[\]\n]*)\]\(([^)\s]{1,256})\)/g, " $1 $2 ");
  for (const tok of rest.split(/\s+/)) {
    const t = planTokenTrim(tok);
    if (t.includes("/")) add(t, false);
  }
  return out;
}
// A token's wrapping punctuation dropped — a plain scan: the anchored regex (/[)…]+$/) rescanned a long run of ')' from every
// position (full review Pb6).
const PLAN_TOKEN_LEAD = new Set(["(", '"', "'", "[", "{", "<", "*", "_"]);
const PLAN_TOKEN_TRAIL = new Set([")", '"', "'", "]", "}", ">", ".", ",", ";", ":", "!", "?", "*", "_"]);
function planTokenTrim(tok) {
  let a = 0, b = tok.length;
  while (a < b && PLAN_TOKEN_LEAD.has(tok[a])) a++;
  while (b > a && PLAN_TOKEN_TRAIL.has(tok[b - 1])) b--;
  return tok.slice(a, b);
}
// A shell command a step names (a backticked span, or a line of its code block) — the first that reads as a CHECK (a test, lint,
// build or curl run) becomes the task's _Verify:_. A `$ ` prompt and a leading `cd <dir> &&` are dropped; one line only.
const RE_PLAN_RUNNER = /^(?:npm|npx|pnpm|yarn|bun|bunx|node|deno|python3?|py|pytest|uv|poetry|go|cargo|make|mvn|gradle|\.\/gradlew|dotnet|bundle|rake|rspec|rails|php|composer|phpunit|vendor\/bin\/phpunit|swift|xcodebuild|ctest|tox|nox|ruff|mypy|eslint|tsc|jest|vitest|mocha|playwright|cypress|curl|mix|flutter|dart|sbt|zig|just)\b/;
const RE_PLAN_CHECK = /(?<![\w-])(?:test|tests|spec|check|lint|verify|tsc|typecheck|type-check|build|pytest|jest|vitest|mocha|rspec|phpunit|ctest|clippy|vet|curl|e2e)(?![\w-])/i;
function planCommand(candidates) {
  for (const raw of candidates) {
    const c = String(raw).trim().replace(/^\$\s+/, "").replace(/^cd\s+\S+\s*&&\s*/, "");
    if (!c || /[\r\n`]/.test(c) || /_\s/.test(c) || c.length > 300) continue;
    if (RE_PLAN_RUNNER.test(c) && RE_PLAN_CHECK.test(c)) return c;
  }
  return null;
}
// A command-only bullet ("Run `npm test`", "`npm test` passes") is a check to run, not a criterion.
function planCommandOnly(text) {
  const t = String(text).replace(/\*\*|__/g, "").trim();
  // \s*:?\s* → \s*(?::\s*)? and \s*(?:word)?\s* → \s*(?:word\s*)? (the same lines): blank runs meeting around an absent
  // token backtracked quadratically (1.17 H).
  const m = t.match(/^(?:run|execute|corre|correr|executa|executar|ejecuta|ejecutar)?\s*(?::\s*)?`([^`]+)`\s*(?:(?:passes|succeeds|is green|should pass|passa|pasa)\s*)?[.;]?$/i);
  return !!(m && RE_PLAN_RUNNER.test(m[1].trim().replace(/^\$\s+/, "")));
}
// A criterion as written in a plan → EARS when it already reads like one: a modal requirement (kept), Given/When/Then, or a
// WHEN / IF / WHILE clause with its response ("When the toggle is clicked, the theme switches" → WHEN …, THE SYSTEM SHALL ensure
// that …) — EN / PT / ES. Anything else → null (kept with [NEEDS CLARIFICATION]).
const PLAN_COND = [
  ["en", /^(when|whenever|if|while)\s+(.+?),\s*(.+)$/i],
  ["pt", /^(quando|sempre que|se|enquanto)\s+(.+?),\s*(.+)$/i],
  ["es", /^(cuando|siempre que|si|mientras)\s+(.+?),\s*(.+)$/i],
];
function earsFromPlanText(raw) {
  const t = String(raw).replace(/^\[[ xX~\-/]\]\s+/, "").replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (RE_MODAL.test(t)) return t;
  const g = earsFromGwt(t);
  if (g) return g;
  for (const [lng, re] of PLAN_COND) {
    const m = t.match(re);
    if (!m) continue;
    const E = i18n.msg(lng).importSpec.ears;
    const then = earsThen(m[3], lng, E);
    if (!then) return null;
    const kw = m[1].toLowerCase();
    if (kw === "if" || kw === "se" || kw === "si") return `${E.if} ${trimClause(m[2])}, ${E.then} ${then}`;
    return `${kw === "while" || kw === "enquanto" || kw === "mientras" ? E.while : E.when} ${trimClause(m[2])}, ${then}`;
  }
  return null;
}
// Top-level list items of [lo, hi) with their whole body (nested items, paragraphs, code blocks — blank lines inside it): up to the
// next item at (or left of) its indent, a heading, or a line back at its indent after a blank one. code = the body's code lines
// (fenced, or indented 4 past the item's text).
function planBlocks(lines, lo, hi) {
  const items = [];
  let cur = null, fence = null, prevBlank = true;
  for (let i = lo; i < hi; i++) {
    const l = lines[i];
    if (fence) { if (cur) { cur.body.push(i); cur.code.add(i); } if (closesFence(l, fence)) fence = null; prevBlank = false; continue; }
    const f = l.match(RE_FENCE);
    if (f) {
      if (cur && (indentOf(l) > cur.indent || !prevBlank)) { cur.body.push(i); cur.code.add(i); } else cur = null;
      fence = f[1];
      prevBlank = false;
      continue;
    }
    if (/^\s*#{1,6}\s/.test(l)) { cur = null; prevBlank = false; continue; }
    const blank = !l.trim();
    const m = planItem(l);
    const ind = indentOf(l);
    if (m && (!cur || ind <= cur.indent)) {
      cur = { i, indent: ind, content: l.length - l.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").length, box: m[2] != null ? m[2] : null, text: m[3].trim(), body: [], code: new Set() };
      items.push(cur);
      prevBlank = false;
      continue;
    }
    if (!cur) { prevBlank = blank; continue; }
    if (blank) { cur.body.push(i); prevBlank = true; continue; }
    if (ind > cur.indent || !prevBlank) {
      cur.body.push(i);
      if (ind >= cur.content + 4) cur.code.add(i);
      prevBlank = false;
      continue;
    }
    cur = null;
    prevBlank = false;
  }
  for (const it of items) while (it.body.length && !lines[it.body[it.body.length - 1]].trim()) it.body.pop();
  return items;
}
// Every checkbox of [lo, hi) outside fenced code — importTasks' rule: a nested one is a task of its own — with its own body (the
// more-indented lines under it, up to the next checkbox, a heading or a line back at its indent). skip(i): lines not to read.
function checkboxUnits(lines, lo, hi, skip) {
  const units = [];
  let cur = null, fence = null;
  for (let i = lo; i < hi; i++) {
    const l = lines[i];
    if (fence) { if (cur) { cur.body.push(i); cur.code.add(i); } if (closesFence(l, fence)) fence = null; continue; }
    if (skip && skip(i)) { cur = null; continue; }
    const f = l.match(RE_FENCE);
    if (f) { fence = f[1]; if (cur && indentOf(l) > cur.indent) { cur.body.push(i); cur.code.add(i); } else cur = null; continue; }
    const m = planCheckbox(l);
    if (m) {
      cur = { i, indent: m[1].length, content: l.length - l.replace(/^\s*[-*+]\s+/, "").length, box: m[2], text: m[3].trim(), body: [], code: new Set() };
      units.push(cur);
      continue;
    }
    if (/^\s*#{1,6}\s/.test(l)) { cur = null; continue; }
    if (!cur) continue;
    if (!l.trim()) { cur.body.push(i); continue; }
    if (indentOf(l) > cur.indent) { cur.body.push(i); if (indentOf(l) >= cur.content + 4) cur.code.add(i); continue; }
    cur = null;
  }
  for (const u of units) while (u.body.length && !lines[u.body[u.body.length - 1]].trim()) u.body.pop();
  return units;
}
const markUnit = (used, u) => { used.add(u.i); u.body.forEach((b) => used.add(b)); };
// A unit's prose (its text + the body lines that are not code) and its code lines.
const unitProse = (lines, u) => [u.text, ...u.body.filter((b) => !u.code.has(b)).map((b) => lines[b])].join("\n");
const unitCode = (lines, u) => u.body.filter((b) => u.code.has(b) && !RE_FENCE.test(lines[b])).map((b) => lines[b].trim());
// One synthesized task (importTasks renumbers it): `- [x] <tag> text`, its markers, then its own body re-indented under it.
function planTaskLines(lines, u, o) {
  const out = [`- [${o.done ? "x" : " "}] ${o.tag ? o.tag + " " : ""}${o.text != null ? o.text : u.text}`];
  if (o.req && o.req.length) out.push(`  - _Requirements: ${o.req.join(", ")}_`);
  if (o.paths && o.paths.length) out.push(`  - _Implements: ${o.paths.join(", ")}_`);
  if (o.verify) out.push(`  - _Verify: ${o.verify}_`);
  const base = u.content != null ? u.content : u.indent + 2;
  for (const b of u.body || []) {
    const l = lines[b].trimEnd();
    out.push(!l.trim() ? "" : "  " + l.slice(Math.min(indentOf(l), base)));
  }
  return out;
}
const planDone = (box) => box === "x" || box === "X";
// The heading text a section is recognised by: numbering, emoji and emphasis dropped ("## 2. ✅ Verification" → "Verification").
// "### Step 1: Add the store" is a step's own title ("Add the store"), never a Steps section heading of its own.
const planHeadingText = (t) => String(t).replace(/[*_`]/g, "").replace(/^[^\p{L}\p{N}]+/u, "").replace(/^\d+(?:\.\d+)*[.):]?\s+/, "")
  .replace(/^(?:step|phase|passo|paso|fase|etapa)\s+\d+(?:\.\d+)*\s*[:.\-–—]\s*/i, "").trim();
// Each heading's section kind (its own, else its parent's): { kinds: [kind | null per heading], direct(k): [lo, hi) of its own lines }.
function planSections(lines, hs, classify) {
  const kinds = [], own = [], parent = [];
  const stack = [];
  hs.forEach((h, k) => {
    while (stack.length && hs[stack[stack.length - 1]].level >= h.level) stack.pop();
    parent[k] = stack.length ? stack[stack.length - 1] : -1;
    own[k] = classify(planHeadingText(h.text), h) || null;
    kinds[k] = own[k] || (parent[k] !== -1 ? kinds[parent[k]] : null);
    stack.push(k);
  });
  return { kinds, own, parent, direct: (k) => [hs[k].i + 1, k + 1 < hs.length ? hs[k + 1].i : lines.length] };
}
// A sub-heading step ("### Step 1: Create the context" under "## Implementation") → a unit: the heading (its "Step N:" / "N."
// dropped) and everything under it; its own sub-headings become bold lines in the task body, code fences stay code.
function headingUnit(lines, hs, k) {
  const [lo, hi] = mdRange(lines, hs, k);
  const body = [], code = new Set();
  let fence = null;
  for (let i = lo; i < hi; i++) {
    const l = lines[i];
    if (fence) { code.add(i); if (closesFence(l, fence)) fence = null; }
    else if (RE_FENCE.test(l)) { fence = l.match(RE_FENCE)[1]; code.add(i); }
    body.push(i);
  }
  const text = hs[k].text.replace(/^(?:step|passo|paso)\s+\d+\s*[:.\-–—]\s*/i, "").replace(/^\d+(?:\.\d+)*[.)]?\s+/, "");
  return { i: hs[k].i, indent: 0, content: 0, text, body, code };
}
// The unused lines, with only the headings whose section still holds some unused content (a Steps heading whose every item became
// a task goes too) — the design body of a plan / ExecPlan. A level-1 section ("# Appendix") becomes "## …": design.md has its own
// title (and importSpec drops a leading H1 as the source's title).
function unusedMarkdown(lines, hs, used, from = 0) {
  const isHead = new Set(hs.map((h) => h.i));
  const h1s = new Set(hs.filter((h) => h.level === 1).map((h) => h.i));
  const keep = new Set();
  hs.forEach((h, k) => {
    if (used.has(h.i)) return;
    const [lo, hi] = mdRange(lines, hs, k);
    for (let i = lo; i < hi; i++) if (!used.has(i) && !isHead.has(i) && lines[i].trim() && !RE_MD_HR.test(lines[i])) { keep.add(h.i); return; }
  });
  const out = [];
  for (let i = from; i < lines.length; i++) if (!used.has(i) && (!isHead.has(i) || keep.has(i))) out.push(h1s.has(i) ? "#" + lines[i] : lines[i]);
  return tidyLines(out);
}
// A tiny YAML subset for Cursor's plan front matter: top-level `key: value` scalars (quoted or plain; `|` / `>` blocks folded) and
// `todos:` — a list of maps (`- id: …` / `  content: …` / `  status: …`). → { data, end } (end = the line after the closing ---) or null.
function planFrontMatter(lines) {
  if (!lines.length || lines[0].trim() !== "---") return null;
  const end = lines.findIndex((l, i) => i > 0 && /^(?:---|\.\.\.)\s*$/.test(l));
  if (end === -1) return null;
  const unq = (v) => {
    const s = String(v).trim();
    if (/^"(?:[^"\\]|\\.)*"$/.test(s)) return s.slice(1, -1).replace(/\\(["\\/])/g, "$1").replace(/\\n/g, " ").replace(/\\t/g, " ");
    if (/^'(?:[^']|'')*'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
    return stripHashComment(s); // s.replace(/\s+#.*$/, "") (1.17 H)
  };
  const data = Object.create(null); // a key named __proto__ is a plain key
  let list = null, item = null;
  // The key: value / list entry patterns below read their text by headRest — \s*(.*)$ rescanned a long blank run before a
  // line terminator (1.17 H).
  for (let i = 1; i < end; i++) {
    const l = lines[i];
    if (!l.trim() || /^\s*#/.test(l)) continue;
    const top = headRest(l, /^([A-Za-z_][\w-]*):/, false); // /^([A-Za-z_][\w-]*):\s*(.*)$/
    if (top) {
      list = item = null;
      if (/^[|>][-+]?\s*$/.test(top[2])) { // a block scalar: the more-indented lines under it, folded into one line
        const parts = [];
        while (i + 1 < end && (!lines[i + 1].trim() || /^\s/.test(lines[i + 1]))) parts.push(lines[++i].trim());
        data[top[1]] = parts.filter(Boolean).join(" ");
      } else if (!top[2].trim()) data[top[1]] = list = [];
      else data[top[1]] = unq(top[2]);
      continue;
    }
    const entry = list && headRest(l, /^\s*-/, true); // /^\s*-\s+(.*)$/
    if (entry) { // a list entry: a map ("- id: x") or a scalar
      const kv = headRest(entry[1], /^([A-Za-z_][\w-]*):/, false);
      item = kv ? Object.create(null) : null;
      if (kv) item[kv[1]] = unq(kv[2]);
      list.push(item || unq(entry[1]));
      continue;
    }
    const kv = item && headRest(l, /^\s+([A-Za-z_][\w-]*):/, false); // /^\s+([A-Za-z_][\w-]*):\s*(.*)$/
    if (kv) item[kv[1]] = unq(kv[2]); // the entry's next key (null-prototype maps: any key is a plain key)
  }
  return { data, end: end + 1 };
}
// A folder given for a single-document source (a plan, an ExecPlan): its only .md file — several → { several }, none → null.
function singleDoc(dir, src, exclude) {
  if (src.file) return { file: src.file };
  const names = safeReaddir(dir).filter((n) => /\.md$/i.test(n) && !(exclude && exclude.test(n))).sort();
  const files = names.filter((n) => { try { return fs.lstatSync(path.join(dir, n)).isFile(); } catch { return false; } });
  if (files.length > 1) return { several: files };
  return files.length ? { file: path.join(dir, files[0]) } : null;
}
// Headings whose whole section is already imported (every line used, blank, or a heading marked so) — marked used too, so
// leftoverExtras never carries an empty "## Requirements" wrapping the FR / NFR lines it read. Bottom-up: a parent follows its children.
function markEmptyHeadings(lines, hs, used) {
  for (let k = hs.length - 1; k >= 0; k--) {
    if (used.has(hs[k].i)) continue;
    const [lo, hi] = mdRange(lines, hs, k);
    let empty = true;
    for (let i = lo; i < hi && empty; i++) if (!used.has(i) && lines[i].trim() && !RE_MD_HR.test(lines[i])) empty = false;
    if (empty) used.add(hs[k].i);
  }
}
// A single-document model with one story: title → US-1, the criteria given. → the story object.
function planStory(model, title, criteria) {
  const story = { printed: null, key: title, title, priority: null, prose: [], quote: [], after: [], criteria };
  model.stories.push(story);
  return story;
}
// A plan / ExecPlan wrapped whole in one ```md fence (PLANS.md's own examples are) → its inside.
// What /^\s*(`{3,}|~{3,})\s*(?:md|markdown)?\s*\r?\n([\s\S]*?)\r?\n\1\s*$/i took as the inside ($2), by a scan — that pattern
// backtracked quadratically over a long fence run or blank run (1.17 H). The closing fence can only be the text's last
// non-blank run (on a line of its own); the inside starts after the opening line's newline: the last one of the blanks after
// "md" / "markdown" when the word is there, else the last one of the blanks after the fence (the engine's order), as long as
// the inside does not run past the closing fence.
function unwrapDocFence(text) {
  const s = String(text);
  let f0 = 0;
  while (f0 < s.length && isWsUnit(s[f0])) f0++;
  const c = s[f0];
  if (c !== "`" && c !== "~") return text;
  let p1 = f0;
  while (s[p1] === c) p1++;
  const L = p1 - f0, T = stripEnd(s, isWsUnit).length, close = T - L - 1; // the closing fence's newline
  if (L < 3 || close < p1 || s[close] !== "\n" || s.slice(T - L, T) !== c.repeat(L)) return text;
  const bodyStart = (hi, lo) => { for (let x = hi - 1; x >= lo; x--) if (s[x] === "\n" && x + 1 <= close) return x + 1; return -1; };
  let q1 = p1;
  while (q1 < s.length && isWsUnit(s[q1])) q1++;
  let bs = -1;
  const word = /^(?:md|markdown)/i.exec(s.slice(q1, q1 + 8));
  if (word) {
    const w = q1 + word[0].length;
    let q2 = w;
    while (q2 < s.length && isWsUnit(s[q2])) q2++;
    bs = bodyStart(q2, w);
  }
  if (bs === -1) bs = bodyStart(q1, p1);
  if (bs === -1) return text;
  return s.slice(bs, s[close - 1] === "\r" && close - 1 >= bs ? close - 1 : close);
}

const RE_PLAN_CRITERIA = /^(?:goals?|objectives?|acceptance(?:\s+criteria)?|success\s+criteria|requirements|definition\s+of\s+done|done\s+when|expected\s+(?:outcomes?|behaviou?r|results?)|verification|validation|objetivos?|metas?|crit[ée]rios\s+de\s+(?:aceita[çc][ãa]o|sucesso)|requisitos|defini[çc][ãa]o\s+de\s+(?:pronto|conclu[íi]do)|resultados?\s+esperados?|verifica[çc][ãa]o|valida[çc][ãa]o|criterios\s+de\s+(?:aceptaci[óo]n|[ée]xito)|definici[óo]n\s+de\s+(?:hecho|terminado)|verificaci[óo]n|validaci[óo]n)\b/i;
const RE_PLAN_STEPS = /^(?:(?:implementation\s+)?steps?|implementation(?:\s+(?:plan|details|order|steps))?|(?:work\s+)?plan(?:\s+of\s+work)?|tasks?|to-?dos?|work\s+items?|(?:proposed\s+)?changes|phases?|milestones?|passos|etapas|implementa[çc][ãa]o|plano(?:\s+de\s+implementa[çc][ãa]o)?|tarefas|altera[çc][õo]es|fases|pasos|implementaci[óo]n|plan\s+de\s+implementaci[óo]n|tareas|cambios)\b/i;
// An Approach section (PT abordagem, ES enfoque) holds the plan's steps only when the plan has no other steps section (full
// review Pb3): beside a Steps section it is design prose — its "### Files to modify" inventory became tasks duplicating the
// real steps, and left design.md.
const RE_PLAN_APPROACH = /^(?:approach|abordagem|enfoque)\b/i;
const RE_PLAN_SUMMARY = /^(?:summary|overview|goal|objective|context|problem(?:\s+statement)?|purpose|background|tl;?dr|resumo|vis[ãa]o\s+geral|objetivo|contexto|problema|prop[óo]sito|resumen|visi[óo]n\s+general)\b/i;

// plan — Claude Code plan mode / Cursor plans (see the block comment above).
function parsePlan(dir, read, W, src) {
  const P = i18n.msg(src.lang).importPlans;
  const doc = singleDoc(dir, src);
  if (!doc) return null;
  if (doc.several) return { error: P.several(toPosix(path.relative(src.root, dir)) || ".", doc.several.join(", ")) };
  const text = read(doc.file);
  // An empty plan (blank, or only comments) is nothing to import — the other importers answer "nothing found" too.
  if (text == null || !stripHtmlComments(text).replace(/^\uFEFF/, "").trim()) return null;
  const model = newImportModel();
  model.sourceFile = doc.file;
  const lines = stripHtmlComments(text).split(/\r?\n/);
  const used = new Set();
  const fm = planFrontMatter(lines);
  const fmData = fm ? fm.data : {};
  if (fm) for (let i = 0; i < fm.end; i++) used.add(i);
  const hs = mdHeadings(lines).filter((h) => !fm || h.i >= fm.end);
  const h1 = hs[0] && hs[0].level === 1 ? hs[0] : null; // the title: a first heading of level 1 (never a later '# Steps')
  if (h1) used.add(h1.i);
  const cleanTitle = (t) => String(t || "").replace(/^(?:(?:implementation|execution)\s+plan|plan|plano(?:\s+de\s+implementa[çc][ãa]o)?|plan\s+de\s+implementaci[óo]n)\s*(?:[:—–-]\s*|$)/i, "").trim();
  model.title = (typeof fmData.name === "string" && fmData.name.trim()) || cleanTitle(h1 && h1.text) || null;
  const stem = path.basename(doc.file).replace(/\.md$/i, "").replace(/\.plan$/i, "").replace(/[-_][0-9a-f]{6,}$/i, "");
  model.nameHint = model.title || stem;
  // The title is no section ("# Plan: Add dark mode" is not a Plan-of-work heading its sub-sections inherit).
  const stepsHead = (t) => !RE_PLAN_CRITERIA.test(t) && RE_PLAN_STEPS.test(t);
  const approachSteps = !hs.some((h) => h !== h1 && stepsHead(planHeadingText(h.text))); // no Steps section: an Approach is one
  const sec = planSections(lines, hs, (t, h) => (h === h1 ? null : RE_PLAN_CRITERIA.test(t) ? "criteria"
    : RE_PLAN_STEPS.test(t) || (approachSteps && RE_PLAN_APPROACH.test(t)) ? "steps" : RE_PLAN_SUMMARY.test(t) ? "summary" : null));
  // Summary: Cursor's overview, else the first paragraph of a Summary / Goal / Context section, else the one under the title.
  if (typeof fmData.overview === "string" && fmData.overview.trim()) model.summary = fmData.overview.trim();
  else {
    const k = hs.findIndex((h, j) => sec.kinds[j] === "summary" || (sec.kinds[j] === "criteria" && /^(?:goal|objective|objetivo)\b/i.test(planHeadingText(h.text))));
    const [lo, hi] = k !== -1 ? sec.direct(k) : [fm ? fm.end : 0, (hs.find((h) => h.level > 1) || { i: lines.length }).i];
    const at = [];
    model.summary = firstParagraph(lines.slice(lo, hi), at);
    at.forEach((r) => used.add(lo + r));
  }
  // Criteria: the items of every goals / acceptance / verification section (a command-only item stays in the design).
  const criteria = [];
  hs.forEach((h, k) => {
    if (sec.kinds[k] !== "criteria") return;
    const [lo, hi] = sec.direct(k);
    let j = 0;
    for (const it of planBlocks(lines, lo, hi)) {
      if (planCommandOnly(it.text) && !it.body.length) continue;
      const raw = [it.text, ...it.body.filter((b) => !it.code.has(b)).map((b) => lines[b].trim().replace(/^(?:[-*+]|\d+[.)])\s+/, ""))].filter(Boolean).join(" ").replace(/^\[[ xX~\-/]\]\s+/, "");
      criteria.push({ key: `${planHeadingText(h.text)} ${++j}`, raw, ears: earsFromPlanText(raw) });
      markUnit(used, it);
    }
  });
  const inCriteria = new Set();
  hs.forEach((h, k) => { if (sec.kinds[k] === "criteria") { const [lo, hi] = sec.direct(k); for (let i = lo; i < hi; i++) inCriteria.add(i); } });
  // Tasks: Cursor's todos, else every checklist outside the criteria, else a Steps section's items, else its sub-headings.
  const out = [];
  const keys = [];
  const cancelled = [];
  const todos = Array.isArray(fmData.todos) ? fmData.todos.filter((x) => isObj(x) && typeof x.content === "string" && x.content.trim()) : [];
  if (todos.length) {
    todos.forEach((x, n) => {
      const status = String(x.status || "").toLowerCase();
      if (/^cancel/.test(status)) cancelled.push(shortTitle(x.content.trim(), 40));
      out.push(...planTaskLines(lines, { text: x.content.trim(), body: [], indent: 0 }, { done: /^(?:completed?|done)$/.test(status), paths: planPaths(x.content) }));
      keys.push(`todo ${typeof x.id === "string" && x.id ? x.id : n + 1}`);
    });
  } else {
    const boxes = checkboxUnits(lines, fm ? fm.end : 0, lines.length, (i) => inCriteria.has(i));
    if (boxes.length) {
      let head = null;
      let k = -1; // the heading the checkbox sits under (one walk: the boxes come in line order)
      boxes.forEach((u, n) => {
        while (k + 1 < hs.length && hs[k + 1].i < u.i) k++;
        if (k >= 0 && hs[k].i !== head && hs[k] !== h1) { head = hs[k].i; out.push("", "## " + planHeadingText(hs[k].text)); }
        out.push(...planTaskLines(lines, u, { done: planDone(u.box), paths: planPaths(unitProse(lines, u)) }));
        keys.push(`step ${n + 1}`);
        markUnit(used, u);
      });
    } else {
      hs.forEach((h, k) => {
        if (sec.kinds[k] !== "steps") return;
        const [lo, hi] = sec.direct(k);
        for (const it of planBlocks(lines, lo, hi)) {
          out.push(...planTaskLines(lines, it, { done: planDone(it.box), paths: planPaths(unitProse(lines, it)) }));
          keys.push(`step ${keys.length + 1}`);
          markUnit(used, it);
        }
      });
      if (!out.length) { // no items: the sub-headings right under a Steps section ("### Step 1: Create the context")
        hs.forEach((h, k) => {
          const p = sec.parent[k];
          if (p === -1 || sec.own[p] !== "steps" || sec.own[k]) return;
          const u = headingUnit(lines, hs, k);
          const task = planTaskLines(lines, u, { done: false, paths: planPaths(unitProse(lines, u)) });
          const off = task.length - u.body.length; // the body lines come last: a sub-heading there becomes a bold line (never one in code)
          out.push(...task.map((l, r) => (r >= off && !u.code.has(u.body[r - off]) && /^\s*#{1,6}\s/.test(l) ? "  **" + l.replace(/^\s*#+\s*/, "").trim() + "**" : l)));
          keys.push(`step ${keys.length + 1}`);
          markUnit(used, u);
        });
      }
    }
  }
  planStory(model, model.title || model.nameHint || P.planTitle, criteria);
  if (out.length) {
    model.tasks = { text: out.join("\n"), file: path.basename(doc.file) };
    model.taskKeys = keys;
  } else model.warnings.push(P.wNoSteps);
  if (cancelled.length) model.warnings.push(P.wCancelled(cancelled.join(", ")));
  const design = unusedMarkdown(lines, hs, used, fm ? fm.end : 0);
  if (design.length) model.design = { text: design.join("\n"), file: path.basename(doc.file) };
  else model.warnings.push(P.wNoDesignLeft);
  return model;
}

// execplan — a Codex ExecPlan (PLANS.md): see the block comment above.
const RE_EXEC_SECTION = [
  ["purpose", /^purpose\b|^big picture\b|^prop[óo]sito\b/i],
  ["progress", /^progress\b|^progresso\b|^progreso\b/i],
  ["decisions", /^decision log\b|^decisions?\b|^registo de decis|^registro de decis|^decis[õo]es\b|^decisiones\b/i],
  ["steps", /^concrete steps\b|^passos concretos\b|^pasos concretos\b/i],
  ["validation", /^validation(?:\s+and\s+|\s*&\s*)acceptance\b|^validation\b|^acceptance\b|^valida[çc][ãa]o(?:\s+e\s+aceita[çc][ãa]o)?\b|^validaci[óo]n(?:\s+y\s+aceptaci[óo]n)?\b/i],
];
function parseExecPlan(dir, read, W, src) {
  const P = i18n.msg(src.lang).importPlans;
  const doc = singleDoc(dir, src, /^(?:plans|agents|readme)\.md$/i); // PLANS.md itself is the guide, not a plan
  if (!doc) return null;
  if (doc.several) return { error: P.several(toPosix(path.relative(src.root, dir)) || ".", doc.several.join(", ")) };
  const text = read(doc.file);
  if (text == null) return null;
  const model = newImportModel();
  model.sourceFile = doc.file;
  const lines = stripHtmlComments(unwrapDocFence(text)).split(/\r?\n/);
  const hs = mdHeadings(lines);
  const used = new Set();
  const h1 = hs[0] && hs[0].level === 1 ? hs[0] : null; // the title: a first heading of level 1 (never a later '# Steps')
  if (h1) { used.add(h1.i); model.title = h1.text.replace(/^exec\s*plan\s*[:—–-]\s*/i, "").trim() || null; }
  model.nameHint = model.title || path.basename(doc.file).replace(/\.md$/i, "");
  const sec = planSections(lines, hs, (t, h) => (h === h1 ? null : (RE_EXEC_SECTION.find(([, re]) => re.test(t)) || [null])[0]));
  const ranges = (kind) => hs.map((h, k) => (sec.kinds[k] === kind ? sec.direct(k) : null)).filter(Boolean);
  if (!hs.some((h, k) => sec.kinds[k])) model.warnings.push(P.wNotExecPlan);
  // Summary: Purpose / Big Picture's first paragraph (the rest of it is design context).
  const pr = ranges("purpose")[0];
  if (pr) { const at = []; model.summary = firstParagraph(lines.slice(pr[0], pr[1]), at); at.forEach((r) => used.add(pr[0] + r)); }
  // Criteria: Validation and Acceptance — its items, else its paragraphs (code blocks stay design).
  const criteria = [];
  for (const [lo, hi] of ranges("validation")) {
    const items = planBlocks(lines, lo, hi);
    if (items.length) {
      for (const it of items) {
        if (planCommandOnly(it.text) && !it.body.length) continue;
        const raw = [it.text, ...it.body.filter((b) => !it.code.has(b)).map((b) => lines[b].trim())].filter(Boolean).join(" ").replace(/^\[[ xX~\-/]\]\s+/, "");
        criteria.push({ key: `Validation and Acceptance ${criteria.length + 1}`, raw, ears: earsFromPlanText(raw) });
        markUnit(used, it);
      }
    } else {
      let para = [];
      let fence = null;
      const flush = () => { if (para.length) { const raw = para.map((i) => lines[i].trim()).join(" "); if (!planCommandOnly(raw)) { criteria.push({ key: `Validation and Acceptance ${criteria.length + 1}`, raw, ears: earsFromPlanText(raw) }); para.forEach((i) => used.add(i)); } } para = []; };
      for (let i = lo; i < hi; i++) {
        const l = lines[i];
        if (fence) { if (closesFence(l, fence)) fence = null; continue; }
        const f = l.match(RE_FENCE);
        if (f) { flush(); fence = f[1]; continue; }
        if (!l.trim() || /^\s{4,}\S/.test(l) || /^\s*(?:>|\|)/.test(l)) { flush(); continue; }
        para.push(i);
      }
      flush();
    }
  }
  // Tasks: Progress (checkbox state kept) + Concrete Steps (the steps Progress doesn't already list).
  const out = [];
  const keys = [];
  const seen = new Map(); // a Progress item's text → its unit's index (a Concrete Step saying the same maps to that task)
  model.taskAliases = [];
  const norm = (s) => String(s).replace(/^\(\s*\d{4}-\d{2}-\d{2}[^)]*\)\s*/, "").replace(/[`*_]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const addUnit = (u, key, head) => {
    if (head && !out.includes(head)) out.push("", head);
    const verify = planCommand([...[...unitProse(lines, u).matchAll(/`([^`\n]+)`/g)].map((m) => m[1]), ...unitCode(lines, u)]);
    out.push(...planTaskLines(lines, u, { done: planDone(u.box), paths: planPaths(unitProse(lines, u)), verify }));
    keys.push(key);
    if (!seen.has(norm(u.text))) seen.set(norm(u.text), keys.length - 1);
    markUnit(used, u);
  };
  hs.forEach((h, k) => {
    if (sec.kinds[k] !== "progress") return;
    const [lo, hi] = sec.direct(k);
    checkboxUnits(lines, lo, hi).forEach((u, n) => addUnit(u, `Progress ${n + 1}`, "## " + h.text));
  });
  hs.forEach((h, k) => {
    if (sec.kinds[k] !== "steps") return;
    const [lo, hi] = sec.direct(k);
    const hasBoxes = lines.slice(lo, hi).some((l) => !!planCheckbox(l));
    const units = hasBoxes ? checkboxUnits(lines, lo, hi) : planBlocks(lines, lo, hi);
    units.forEach((u, n) => {
      if (!seen.has(norm(u.text))) return addUnit(u, `Concrete Steps ${n + 1}`, "## " + h.text);
      model.taskAliases.push([`Concrete Steps ${n + 1}`, seen.get(norm(u.text))]); // the same step as a Progress item: one task
      markUnit(used, u);
    });
  });
  // Decision Log → the design's "## Decisions" (D-1 …), each entry's Rationale / Date lines under it.
  const decisions = [];
  for (const [lo, hi] of ranges("decisions")) {
    for (const it of planBlocks(lines, lo, hi)) {
      markUnit(used, it);
      const what = it.text.replace(/^(?:\*\*|__)?(?:decision|decis[ãa]o|decisi[óo]n)(?:\*\*|__)?\s*:\s*(?:\*\*|__)?/i, "").trim();
      if (!what || /^\(?(?:none|n\/a|tbd|nenhuma|ninguna)(?:\s+yet)?\)?\.?$/i.test(what)) continue;
      const n = decisions.length + 1;
      model.mapping[`Decision Log ${n}`] = `D-${n}`;
      decisions.push(`- **D-${n}** — ${what}`, ...it.body.map((b) => lines[b].trimEnd()).filter((l) => l.trim()).map((l) => "  " + l.trim()));
    }
  }
  planStory(model, model.title || model.nameHint, criteria);
  if (out.length) {
    model.tasks = { text: out.join("\n"), file: path.basename(doc.file) };
    model.taskKeys = keys;
  } else model.warnings.push(P.wNoSteps);
  const design = unusedMarkdown(lines, hs, used);
  if (decisions.length) design.push(...(design.length ? [""] : []), P.decisionsHeading, "", ...decisions);
  if (design.length) model.design = { text: design.join("\n"), file: path.basename(doc.file) };
  else model.warnings.push(P.wNoDesignLeft);
  return model;
}

// bmad — BMAD-METHOD docs (v4 docs/…, v6 _bmad-output/…): see the block comment above.
// 1.17 H — the heads below are read by a regex up to their separator, the text after it by a scan: their \s*…\s*(.*)$ tails
// rescanned a long blank run from each blank they gave back.
// /^(?:story\s+)?(\d+)\.(\d+)\s*(?:[:.\-–—]\s*)?(.*)$/i → [text, epic, story, title] | null
const RE_BMAD_STORY_START = /^(?:story\s+)?(\d+)\.(\d+)/i;
function bmadStoryHead(text) {
  const h = RE_BMAD_STORY_START.exec(text);
  const title = h && titleAfterDash(text, h[0].length);
  return title == null ? null : [text, h[1], h[2], title];
}
// A PRD title without its "Product Requirements Document" / "(PRD)" / "PRD" words and the separator they leave at either end:
// text.replace(/\s*(?:product requirements document|\(prd\)|prd)\s*/gi, " ").replace(/^\s*[:—–-]\s*|\s*[:—–-]\s*$/g, ""), by a
// scan (a blank run was rescanned from each of its units). A word's blanks: the run before it (from where the last match
// ended at most) and the one after it.
const RE_PRD_WORDS = /product requirements document|\(prd\)|prd/gi;
function bmadPrdTitle(text) {
  let out = "", at = 0;
  RE_PRD_WORDS.lastIndex = 0;
  for (let m; (m = RE_PRD_WORDS.exec(text));) {
    let p = m.index, e = p + m[0].length;
    while (p > at && isWsUnit(text[p - 1])) p--;
    while (e < text.length && isWsUnit(text[e])) e++;
    out += text.slice(at, p) + " ";
    at = RE_PRD_WORDS.lastIndex = e;
  }
  const s = out + text.slice(at);
  const lead = /^\s*[:—–-]\s*/.exec(s);
  const from = lead ? lead[0].length : 0;
  const end = stripEnd(s, isWsUnit).length;
  if (end <= from || !":—–-".includes(s[end - 1])) return s.slice(from);
  let p = end - 1;
  while (p > from && isWsUnit(s[p - 1])) p--;
  return s.slice(from, p);
}
// /^story\s+(\d+)\.(\d+)\s*[:.\-–—]?\s*(.*)$/i → [text, epic, story, title] | null
const RE_BMAD_EPIC_STORY_START = /^story\s+(\d+)\.(\d+)/i;
function bmadEpicStory(text) {
  const h = RE_BMAD_EPIC_STORY_START.exec(text);
  const title = h && titleAfterDash(text, h[0].length);
  return title == null ? null : [text, h[1], h[2], title];
}
// /^\s*(?:[-*+]|\d+[.)])?\s*(?:\*\*|__)?(N?FR)[-\s]?(\d+)(?:\*\*|__)?\s*[:.\-–—]\s*(?:\*\*|__)?\s*(.+)$/i → [line, kind, n, text] | null
const RE_BMAD_FR_HEAD = /^\s*(?:(?:[-*+]|\d+[.)])\s*)?(?:\*\*|__)?(N?FR)[-\s]?(\d+)(?:\*\*|__)?\s*[:.\-–—]/i;
function bmadFrLine(l) {
  const h = RE_BMAD_FR_HEAD.exec(l);
  if (!h) return null;
  const text = boldThenText(l, h[0].length);
  return text == null ? null : [l, h[1], h[2], text];
}
// /^#{1,6}\s+(N?FR)[-\s]?(\d+)\s*[:.\-–—]\s*(.+)$/i → [line, kind, n, text] | null
const RE_BMAD_FR_HEADING = /^#{1,6}\s+(N?FR)[-\s]?(\d+)\s*[:.\-–—]/i;
function bmadFrHeading(l) {
  const h = RE_BMAD_FR_HEADING.exec(l);
  const text = h && plusAfterBlanks(l, h[0].length);
  return text == null ? null : [l, h[1], h[2], text];
}
// \s*[:.\-–—]?\s*(.*)$ (= \s*(?:[:.\-–—]\s*)?(.*)$) from i → the title | null
function titleAfterDash(s, i) {
  while (i < s.length && isWsUnit(s[i])) i++;
  if (i < s.length && ":.-–—".includes(s[i])) i++;
  return restAfterBlanks(s, i, false);
}
// \s*(?:\*\*|__)?\s*(.+)$ from p: with the bold marker first, then without it.
function boldThenText(s, p) {
  let w = p;
  while (w < s.length && isWsUnit(s[w])) w++;
  const b = s.startsWith("**", w) || s.startsWith("__", w) ? plusAfterBlanks(s, w + 2) : null;
  return b != null ? b : plusAfterBlanks(s, p);
}
const RE_BMAD_WORKFLOW = /^(?:change log|changelog|status)$/i; // BMAD's own workflow records — named in a warning, not imported
const RE_BMAD_PRD_DESIGN = /^(?:technical assumptions|user interface design goals)\b/i;
function parseBmad(dir, read0, W, src) {
  const P = i18n.msg(src.lang).importPlans;
  const seen = new Map(); // each file read once (a story file is read to recognise it, then to parse it)
  const read = (f) => { if (!seen.has(f)) seen.set(f, read0(f)); return seen.get(f); };
  const isDir = (p) => { try { const st = fs.lstatSync(p); return st.isDirectory() && !st.isSymbolicLink(); } catch { return false; } };
  const isFile = (p) => { try { return fs.lstatSync(p).isFile(); } catch { return false; } };
  const mdIn = (d) => (isDir(d) ? safeReaddir(d).filter((n) => /\.md$/i.test(n) && isFile(path.join(d, n))).sort((a, b) => a.localeCompare(b, "en", { numeric: true })).map((n) => path.join(d, n)) : []);
  const bases = [dir, path.join(dir, "docs"), path.join(dir, "_bmad-output", "planning-artifacts"), path.join(dir, "planning-artifacts")];
  const first = (names) => { for (const b of bases) for (const n of names) if (isFile(path.join(b, n))) return path.join(b, n); return null; };
  const isStoryText = (t) => /^#\s+(?:story\s+)?\d+\.\d+\b/im.test(t || "");
  let prdFiles = [], storyFiles = [], epicsFile = null, archFile = null;
  const skipped = [];
  if (src.file) {
    const t = read(src.file);
    if (t == null) return null;
    if (isStoryText(t) && !/^[^\S\n\r\u2028\u2029]*(?:[-*+]\s*)?(?:\*\*)?N?FR-?\d+/im.test(t)) storyFiles = [src.file];
    else { prdFiles = [src.file]; storyFiles = mdIn(path.join(dir, "stories")).filter((f) => isStoryText(read(f))); }
  } else {
    const prd = first(["prd.md", "PRD.md"]);
    if (prd) prdFiles = [prd];
    else for (const b of bases) { const sh = mdIn(path.join(b, "prd")); if (sh.length) { prdFiles = sh.sort((a, b2) => (/index\.md$/i.test(a) ? -1 : /index\.md$/i.test(b2) ? 1 : 0)); break; } }
    epicsFile = first(["epics.md"]);
    archFile = first(["architecture.md"]);
    for (const b of bases) if (!archFile && isDir(path.join(b, "architecture")) && mdIn(path.join(b, "architecture")).length) skipped.push(toPosix(path.relative(src.root, path.join(b, "architecture"))) + "/");
    for (const d of [path.join(dir, "stories"), path.join(dir, "docs", "stories"), path.join(dir, "_bmad-output", "implementation-artifacts"), path.join(dir, "implementation-artifacts"), dir]) {
      const found = mdIn(d).filter((f) => isStoryText(read(f)));
      if (found.length) { storyFiles = found; break; }
    }
  }
  if (!prdFiles.length && !storyFiles.length && !epicsFile) return null;
  const model = newImportModel();
  model.nameHint = path.basename(dir) === "docs" ? path.basename(path.dirname(dir)) : path.basename(dir);
  model.skipped = skipped;
  const stories = new Map(); // "E.S" → { e, s, title, prose, acs: [{n, raw}], tasks: {lines, units} | null, design: [], file }
  const workflow = new Map(); // BMAD's workflow records (Status, Change Log) → the documents they were found in
  const addWorkflow = (t, where) => { const k = /^status$/i.test(t) ? "Status" : t; if (!workflow.has(k)) workflow.set(k, []); if (!workflow.get(k).includes(where)) workflow.get(k).push(where); };
  const designParts = [];
  // A story's criteria items ("1: text" / "1. text" / "- text"; a BDD block's bold title dropped) → [{ n, raw }].
  const acItems = (body) => mdListItems(body.map((l) => l.replace(/^(\s*)(\d+)\s*:\s/, "$1$2. ")), false).map((it) => ({
    n: it.n, raw: it.text.replace(/^(?:\*\*|__)?AC\s*(?:#\s*)?(\d+)(?:\*\*|__)?\s*[:.\-–—]\s*/i, "").trim(),
  }));
  const acEars = (raw) => {
    const t = raw.replace(/^(?:\*\*|__)[^*_]+(?:\*\*|__)\s*(?=(?:\*\*|__)?(?:given|when|dad[oa]|quando|cuando)\b)/i, "");
    return earsFromPlanText(t);
  };
  // PRD text(s) → title, summary, FR/NFR, stories (from its epics), carried sections.
  const prdText = prdFiles.map((f) => read(f)).filter((t) => t != null).join("\n\n");
  const epicsText = epicsFile ? read(epicsFile) : null;
  for (const [txt, isPrd] of [[prdText, true], [epicsText, false]]) {
    if (!txt) continue;
    const lines = stripHtmlComments(txt).split(/\r?\n/);
    const hs = mdHeadings(lines);
    const used = new Set();
    if (!isPrd && hs.length && hs[0].level === 1) used.add(hs[0].i); // epics.md's own title
    if (isPrd) {
      const h1 = hs.find((h) => h.level === 1);
      if (h1) { used.add(h1.i); model.title = bmadPrdTitle(h1.text).trim() || null; }
      const sk = hs.findIndex((h) => /^(?:background context|vision|1\.\s*vision)\b/i.test(planHeadingText(h.text)));
      const [lo, hi] = sk !== -1 ? [hs[sk].i + 1, sk + 1 < hs.length ? hs[sk + 1].i : lines.length] : [h1 ? h1.i + 1 : 0, (hs.find((h) => h.level > 1) || { i: lines.length }).i];
      const at = [];
      model.summary = firstParagraph(lines.slice(lo, hi), at);
      at.forEach((r) => used.add(lo + r));
      // FR / NFR: list lines ("- FR1: …", "**NFR2**: …") and v6 headings ("#### FR-1: name" + its first paragraph).
      const fr = [], nfr = [];
      let fence = null;
      lines.forEach((l, i) => {
        if (fence) { if (closesFence(l, fence)) fence = null; return; }
        const f = l.match(RE_FENCE);
        if (f) { fence = f[1]; return; }
        const hm = bmadFrHeading(l);
        const m = hm || (!/^\s*#/.test(l) && bmadFrLine(l));
        if (!m) return;
        const kind = m[1].toUpperCase();
        let txt2 = m[3].replace(/(?:\*\*|__)\s*$/, "").trim();
        used.add(i);
        if (hm) {
          const k = hs.findIndex((h) => h.i === i);
          const body = [];
          for (let j = i + 1; j < (k + 1 < hs.length ? hs[k + 1].i : lines.length); j++) body.push(j);
          const at2 = [];
          const para = firstParagraph(body.map((j) => lines[j]), at2);
          if (para) { txt2 += " — " + para; at2.forEach((r) => used.add(body[r])); }
        }
        const id = `${kind}-${+m[2]}`;
        model.mapping[(l.match(/N?FR[-\s]?\d+/i) || [id])[0].toUpperCase().replace(/\s+/, "")] = id; // "FR1" → "FR-1" (as written → dev-spec's form)
        (kind === "NFR" ? nfr : fr).push(`- **${id}** — ${txt2}`);
      });
      if (fr.length) model.extra.push({ key: "functional", lines: fr });
      if (nfr.length) model.extra.push({ heading: P.nonFunctional, lines: nfr });
    }
    // Stories: "### Story 1.1 Title" (v4 PRD epic sections), "### Story 1.1: Title" (v6 epics.md).
    hs.forEach((h, k) => {
      const m = bmadEpicStory(planHeadingText(h.text));
      if (!m) return;
      const [lo, hi] = mdRange(lines, hs, k);
      markRange(used, h.i, hi);
      const body = lines.slice(lo, hi);
      // /^\s*(?:#{1,6}\s+|\*\*|__)?\s*acceptance criteria/i as \s*(?:(?:#{1,6}\s|\*\*|__)\s*)? (the same lines): blank runs meeting
      // around an absent marker backtracked quadratically (1.17 H)
      const acAt = body.findIndex((l) => /^\s*(?:(?:#{1,6}\s|\*\*|__)\s*)?acceptance criteria/i.test(l));
      const prose = tidyLines(body.slice(0, acAt === -1 ? body.length : acAt).filter((l) => !/^\s*#/.test(l)));
      const acs = acAt === -1 ? [] : acItems(body.slice(acAt + 1));
      const key = `${+m[1]}.${+m[2]}`;
      if (!stories.has(key)) stories.set(key, { e: +m[1], s: +m[2], title: m[3].trim() || `Story ${key}`, prose, acs, tasks: null, design: [], from: "prd" });
    });
    // PRD sections: design-level ones → design.md; BMAD's change log → a warning; the rest → carried into requirements.md.
    hs.forEach((h, k) => {
      if (used.has(h.i)) return;
      const t = planHeadingText(h.text);
      const [lo, hi] = mdRange(lines, hs, k);
      if (isPrd && RE_BMAD_PRD_DESIGN.test(t)) { designParts.push("## " + t, ...unusedLines(lines, used, lo, hi)); markRange(used, h.i, hi); }
      else if (RE_BMAD_WORKFLOW.test(t)) { addWorkflow(t, isPrd ? "PRD" : "epics.md"); markRange(used, h.i, hi); }
    });
    markEmptyHeadings(lines, hs, used); // "## Requirements" whose FR / NFR lines were all read carries nothing
    model.carried.push(...leftoverExtras(lines, hs, used, isPrd ? "" : "epics: "));
  }
  // Story files: # Story 1.1: Title · Status · Story · Acceptance Criteria · Tasks / Subtasks · Dev Notes (+ Testing) · Change Log ·
  // Dev Agent Record · QA Results — the file wins over the PRD's copy of the same story.
  for (const file of storyFiles) {
    const txt = read(file);
    if (txt == null) continue;
    const lines = stripHtmlComments(txt).split(/\r?\n/);
    const hs = mdHeadings(lines);
    const h1 = hs.find((h) => h.level === 1);
    const m = h1 && bmadStoryHead(planHeadingText(h1.text));
    if (!m) continue;
    const key = `${+m[1]}.${+m[2]}`;
    const st = { e: +m[1], s: +m[2], title: m[3].trim() || `Story ${key}`, prose: [], acs: [], tasks: null, design: [], from: toPosix(path.relative(src.root, file)) };
    const top = hs.filter((h) => h.level === 2);
    // Before the first section: v6's "Status: ready-for-dev" line (a workflow record); any other text → the story's design notes.
    const intro = lines.slice(h1.i + 1, top.length ? top[0].i : lines.length);
    if (intro.some((l) => /^\s*status\s*:/i.test(l))) addWorkflow("Status", key);
    const introRest = tidyLines(intro.filter((l) => !/^\s*status\s*:/i.test(l)));
    if (introRest.length) st.design.push("", ...introRest);
    for (const h of top) {
      const k = hs.indexOf(h);
      const t = planHeadingText(h.text);
      const [lo, hi] = mdRange(lines, hs, k);
      const body = lines.slice(lo, hi);
      if (/^(?:story|user story)$/i.test(t)) st.prose = tidyLines(body.filter((l) => !/^\s*#/.test(l)).map((l) => l.replace(/\*\*(as an?|i want|so that)\*\*/gi, "$1")));
      else if (/^acceptance criteria$/i.test(t)) st.acs = acItems(body);
      else if (/^tasks?\s*(?:(?:\/|&|and)\s*)?(?:subtasks?)?$/i.test(t)) st.tasks = { lines, lo, hi };
      else if (RE_BMAD_WORKFLOW.test(t)) addWorkflow(t, key);
      else if (tidyLines(body).length) st.design.push("", `### ${t}`, ...tidyLines(body.map((l) => l.replace(/^(#{1,4})(\s)/, "#$1$2"))));
    }
    stories.set(key, st);
  }
  const ordered = [...stories.values()].sort((a, b) => a.e - b.e || a.s - b.s);
  const out = [];
  const keys = [];
  ordered.forEach((st, idx) => {
    const n = idx + 1;
    const key = `Story ${st.e}.${st.s}`;
    const byNumber = new Map(); // the printed AC number a task's (AC: …) cites → the new AC ID
    const criteria = st.acs.map((a, j) => {
      const id = `US-${n}.AC-${j + 1}`;
      if (a.n != null && !byNumber.has(a.n)) byNumber.set(a.n, id);
      if (!byNumber.has(j + 1) && a.n == null) byNumber.set(j + 1, id);
      return { key: `${key} / AC ${a.n != null ? a.n : j + 1}`, raw: a.raw, ears: acEars(a.raw) };
    });
    model.stories.push({ printed: null, key, title: st.title, priority: null, prose: st.prose, quote: [], after: [], criteria });
    if (st.design.length) designParts.push("", `## US-${n}: ${st.title}`, ...st.design);
    if (!st.tasks) return;
    const units = checkboxUnits(st.tasks.lines, st.tasks.lo, st.tasks.hi);
    if (!units.length) return;
    out.push("", `## US-${n}: ${st.title}`);
    units.forEach((u, j) => {
      // /\(\s*ACs?\s*[:#]?\s*([^)]*)\)/i, read up to the last ')' (no match can end later: each "(AC" rescanned the rest of a
      // text with no ')' after it) with \s*(?:[:#]\s*)? (blank runs meeting with no ':' / '#' between them) — 1.17 H.
      const refM = u.text.slice(0, u.text.lastIndexOf(")") + 1).match(/\(\s*ACs?\s*(?:[:#]\s*)?([^)]*)\)/i);
      // "(AC: 1, 3)", "(AC #2)", "(ACs: 1-3)" — a range is every number in it (bounded: a typo like 1-9999 is not expanded)
      const nums = refM ? (refM[1].match(/\d+\s*[-–]\s*\d+|\d+/g) || []).flatMap((x) => {
        const r = x.match(/^(\d+)\s*[-–]\s*(\d+)$/);
        return r && +r[2] >= +r[1] && +r[2] - +r[1] < 50 ? Array.from({ length: +r[2] - +r[1] + 1 }, (_, q) => +r[1] + q) : (x.match(/\d+/g) || []).map(Number);
      }) : [];
      const req = [], unknown = [];
      nums.forEach((x) => { if (byNumber.has(x)) { if (!req.includes(byNumber.get(x))) req.push(byNumber.get(x)); } else unknown.push(x); });
      if (unknown.length) model.warnings.push(P.wUnknownAc(key, shortTitle(u.text, 40), unknown.join(", ")));
      const text = refM && !unknown.length ? u.text.replace(refM[0], "").replace(/\s{2,}/g, " ").trim() : u.text;
      const label = (u.text.match(/^(?:sub)?task\s+[\d.]+/i) || [`item ${j + 1}`])[0];
      out.push(...planTaskLines(st.tasks.lines, u, { done: planDone(u.box), tag: `[US${n}]`, text: text.replace(/^\[US\d+\]\s*/, ""), req, paths: planPaths(unitProse(st.tasks.lines, u)) }));
      keys.push(`${key} / ${label}`);
    });
  });
  if (!ordered.length) model.warnings.push(W.wNoRequirements(prdFiles.concat(epicsFile ? [epicsFile] : []).map((f) => toPosix(path.relative(src.root, f))).join(", ") || "."));
  if (out.length) { model.tasks = { text: out.join("\n"), file: "Tasks / Subtasks" }; model.taskKeys = keys; }
  else model.warnings.push(W.wNoTasks);
  if (workflow.size) model.warnings.push(P.wWorkflow([...workflow].map(([t, where]) => `${t} (${where.join(", ")})`).join(", ")));
  const arch = archFile ? read(archFile) : null;
  const design = [arch != null ? arch.trimEnd() : null, ...(designParts.length ? ["", ...designParts] : [])].filter((x) => x != null);
  if (tidyLines(design).length) model.design = { text: tidyLines(design).join("\n"), file: archFile ? path.basename(archFile) : "Dev Notes" };
  else model.warnings.push(W.wNoDesign("architecture.md"));
  if (model.title) model.nameHint = model.title; // the product's name, not "docs"
  if (storyFiles.length === 1 && !prdFiles.length && ordered.length === 1) { model.sourceFile = storyFiles[0]; model.nameHint = ordered[0].title; }
  return model;
}

// ---------------------------------------------------------------------------
// spec_import fluidplan (1.17 F) — a plan settled with fluidplan (github.com/morganhub/fluidplan, a Claude Code skill, MIT). The
// formats were read at its commit 755d1b24ccb09aa8d3663774e0a83d99d24cdc4c (2026-09-26): engine/schema/plan.schema.json (plan
// v2), references/schema.md + execution-plan.md, engine/public/js/model.js / export_plan.js / export_decisions.js (what PLAN.md
// and DECISIONS.md hold) and engine/public/i18n/en.json + fr.json (their labels — a plan is written in English or French).
// Nothing of fluidplan's is vendored: its files are only READ, and the few rules the import needs (verdicts, kept options,
// templates, numbering by phase) are re-stated below.
// Sources: a plan folder (<plansDir>/<id>/, default .fluidplan/<id>/ — plan.json, answers.json, state.json, rounds/<n>/, PLAN.md,
// DECISIONS.md), its plan.json, its PLAN.md / DECISIONS.md (finalize writes them to the plan folder or to plan.json's `output`
// paths), a plans folder holding ONE plan (several → refused, name one), or PLAN.md's text — DECISIONS.md may follow it
// (spec_import {text}). The finalized artifacts win when present (PLAN.md: the tasks and their ticks; DECISIONS.md: the settled
// decisions); plan.json + answers.json fill in the rest (each option's pros / cons / effort, the pages) or stand alone (the tasks
// then follow fluidplan's own rules: the kept options, the templates, the reviewer's rewrites, the numbering by phase). Mapping:
//   pages (themes) → user stories (without plan.json: PLAN.md's phases); each kept task's `acceptance` → that story's criteria
//   (EARS when they read like one, else [NEEDS CLARIFICATION]); tasks → tasks.md under their phase headings, ticks kept, numbered
//   1…K in PLAN.md's order — `files` create / modify → _Implements:_ (planPaths' filter: never a URL, an absolute / home path,
//   '..' or a glob), delete → the task text, `verify` → one _Verify:_ per command, `after` → _Depends:_ (renumbered);
//   accepted AND rejected decisions → decisions.md (D-1…, spec_decide's format: Context = why + importance / phase / proposal,
//   Decision = the choice + the reviewer's remarks, Consequences = the chosen option's pros / cons / effort + the other options;
//   _Affects:_ = the criteria its tasks carry) and design.md "## Decisions" + "## Alternatives & Trade-offs"; the working rules
//   (accepted decisions without tasks) → tasks.md "## Global Constraints"; rejected decisions / items → requirements.md "## Out
//   of Scope"; decisions still open (no answer, to change, a question) → requirements.md "## Open decisions" with
//   [NEEDS CLARIFICATION] + a warning; the context, glossary, final check, visuals and any other section → design.md. The round
//   history (rounds/, revision notes, the verdict history) is not imported — a warning says so.
// ---------------------------------------------------------------------------
const FP_PLAN_ID = /^[a-z0-9][a-z0-9_-]*$/; // a plan's id = its folder's name (fluidplan's engine/lib/config.mjs)
const FP_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/; // a decision / page / task id (plan.schema.json $defs/id)
const FP_OTHER = "__other"; // the "Another option" answer every choice offers
const FP_SEC = {
  context: /^(?:context|contexte)$/i,
  rules: /^(?:working rules|r[èe]gles de travail)$/i,
  loose: /^(?:cross-cutting tasks|t[âa]ches transverses)$/i,
  finalCheck: /^(?:final check|v[ée]rification finale)$/i,
  outOfScope: /^(?:out of scope|hors p[ée]rim[èe]tre)$/i,
  kept: /^(?:accepted decisions|d[ée]cisions retenues)$/i,
  rejected: /^(?:rejected decisions|d[ée]cisions [ée]cart[ée]es)$/i,
  open: /^(?:still open|encore ouvertes)$/i,
  glossary: /^(?:glossary|glossaire)$/i,
};
const RE_FP_STATE = /_\(([^()]*)\)_[ \t]*$/; // a task's / rule's "_(to change)_" mark: its decision is not settled
const FP_LINE_MAX = 2000; // a heading / bullet longer than this is carried as text, never parsed
const fpShort = (s) => String(s).length <= FP_LINE_MAX;
const fpMap = (table, key) => (typeof key === "string" && own(table, key) ? table[key] : null); // never a prototype key
// "<title> — execution plan" / "— plan d'exécution" (kind plan), "<title> — decisions" / "— décisions" (kind decisions) → the title,
// else null. Suffix checks, no backtracking pattern (every pattern here stays linear).
const FP_TITLE_SUFFIX = { plan: ["execution plan", "plan d'exécution", "plan d’exécution", "plan d'execution"], decisions: ["decisions", "décisions"] };
function fpTitleOf(text, kind) {
  const t = String(text || "").trim();
  if (!fpShort(t)) return null;
  const low = t.toLowerCase();
  for (const s of FP_TITLE_SUFFIX[kind]) {
    if (!low.endsWith(s)) continue;
    const head = t.slice(0, t.length - s.length);
    const before = head.trimEnd();
    if (head === before || !/[—–-]$/.test(before)) continue;
    const title = before.slice(0, -1);
    if (/\s$/.test(title) && title.trim()) return title.trim();
  }
  return null;
}
// "### [ ] 1.1 <title>[ _(state)_] · <decision id>" → { box, num, title, fid } | null.
function fpTaskHeading(line) {
  if (!fpShort(line)) return null;
  const m = line.match(/^###[ \t]+\[([ xX~\-/])\][ \t]+(\d+\.\d+)[ \t]+(.*)$/);
  if (!m) return null;
  const k = m[3].lastIndexOf("·");
  if (k === -1) return null;
  const title = m[3].slice(0, k), fid = m[3].slice(k + 1).trim();
  return title.trim() && /\s$/.test(title) && FP_ID.test(fid) ? { box: m[1], num: m[2], title: title.trim(), fid } : null;
}
// "Phase 2 — Delivery (≈ 2 d)" → { n, title } | null.
function fpPhaseHeading(text) {
  if (!fpShort(text)) return null;
  const m = String(text).match(/^phase[ \t]+(\d+)[ \t]+[—–-][ \t]+(.*)$/i);
  if (!m) return null;
  let title = m[2];
  const meta = title.match(/\(([^()]*)\)$/);
  if (meta && meta.index > 0 && /\s/.test(title[meta.index - 1])) title = title.slice(0, meta.index);
  return title.trim() ? { n: +m[1], title: title.trim() } : null;
}
// An acceptance bullet → [line, text] | null — /^\s*[-*+]\s+(?:\[[ xX]\]\s+)?(.*)$/ with its text read by restAfterBlanks
// (1.17 H): after the optional checkbox when it is there; a line terminator after the text → null either way.
function fpAcceptanceItem(l) {
  const h = /^\s*[-*+]/.exec(l);
  if (!h || !isWsUnit(l[h[0].length])) return null;
  let q = h[0].length;
  while (q < l.length && isWsUnit(l[q])) q++;
  const text = restAfterBlanks(l, /^\[[ xX]\]\s/.test(l.slice(q, q + 4)) ? q + 3 : h[0].length, true);
  return text == null ? null : [l, text];
}
// "- **D3 · Logging** …" → [line, id, title, rest] | null — /^[-*][ \t]+\*\*([A-Za-z0-9][A-Za-z0-9_-]*)[ \t]+·[ \t]+(?![ \t])(.+?)\*\*(.*)$/
// by a scan after its head: the title runs to the first "**" after it and nothing after it holds a line terminator (the lazy
// title rescanned the rest of the line from each "**" — 1.17 H).
const RE_FP_DEC_HEAD = /^[-*][ \t]+\*\*([A-Za-z0-9][A-Za-z0-9_-]*)[ \t]+·[ \t]+(?![ \t])/;
function fpDecLine(l) {
  const h = RE_FP_DEC_HEAD.exec(l);
  if (!h) return null;
  const ts = h[0].length, k = l.indexOf("**", ts + 1);
  return k === -1 || RE_LINE_TERMINATOR.test(l.slice(ts)) ? null : [l, h[1], l.slice(ts, k), l.slice(k + 2)];
}
const FP_TASK_FIELDS = [["decision", /^d[ée]cision$/i], ["files", /^(?:files|fichiers)$/i], ["do", /^(?:do|faire)$/i],
  ["acceptance", /^(?:acceptance criteria|crit[èe]res d['’]acceptation)$/i], ["verify", /^(?:verify|v[ée]rifier)$/i], ["after", /^(?:after|apr[èe]s)$/i],
  ["remark", /^(?:remark|remarque)$/i], ["items", /^(?:items kept|[ée]l[ée]ments retenus)$/i]];
const FP_DEC_FIELDS = [["importance", /^importance$/i], ["phase", /^phase$/i], ["choice", /^(?:choice|choix)$/i], ["why", /^(?:why|pourquoi)$/i],
  ["proposal", /^(?:proposal|proposition)$/i], ["others", /^(?:other options|autres options)$/i], ["remarks", /^(?:remarks|remarques)$/i],
  ["history", /^(?:history|historique)$/i], ["reason", /^(?:reason|raison)$/i]];
const FP_OPS = { create: "create", "créer": "create", creer: "create", modify: "modify", modifier: "modify", delete: "delete", supprimer: "delete" };
const FP_IMPORTANCE = { critical: "critical", critique: "critical", important: "important", minor: "minor", mineur: "minor", mineure: "minor" };
const FP_SRC_LABELS = { en: { loose: "Cross-cutting tasks", rejected: "rejected" }, fr: { loose: "Tâches transverses", rejected: "écartée" } };
const fpFilled = (s) => String(s == null ? "" : s).trim() !== "";
// A line break as a markdown reader and the task scanner see one: LF, a lone CR, U+2028 / U+2029 (built from their code points:
// written raw inside a regex literal they end the line — a syntax error).
const FP_LS_PS = String.fromCharCode(0x2028, 0x2029);
const RE_FP_BREAK = new RegExp("[\\n\\r" + FP_LS_PS + "]");
const RE_FP_BREAKS = new RegExp("[\\n\\r" + FP_LS_PS + "]+", "g");
const RE_FP_LINE_SPLIT = new RegExp("\\r\\n|[\\n\\r" + FP_LS_PS + "]");
const RE_FP_VERIFY_BAD = new RegExp("[\\n\\r" + FP_LS_PS + "]|<!--|-->");
// One line: every whitespace run holding a line break → one space (what /\s*\n\s*/g did — quadratic on a long space run
// without a break, 80,000 spaces took 6 s; 1.17 F review), then trimmed. A lone CR / U+2028 / U+2029 is a line break too for a
// markdown reader (and ends a task line for the scanners): folded like "\n".
const fpOneLine = (s) => String(s == null ? "" : s).split(RE_FP_BREAK).map((x) => x.trim()).filter(Boolean).join(" ");
const fpList = (v) => (Array.isArray(v) ? v : []);
const fpStr = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
// Imported free text never becomes markup a tool reads (1.17 F review) — each escape renders the same in a markdown reader:
//   a comment opener / closer → `&lt;!--` / `--&gt;` (a title's `<!--` and a later `-->` hid the markers between them);
//   a task / decision marker look-alike → its colon escaped, `_Verify\:` (taskMarkerSpans() needs the colon right after the
//     label — a title `Clean up _Verify: rm -rf ~_` was a runnable _Verify:_; only fluidplan's own `verify` field makes one);
//   an AC / T / EC / NFR / SC ID → `US-7\.AC-1`, `T\-01`, `NFR\-2` (extractAcIds & co. read the plain spelling only — a page
//     intro's `US-7.AC-1` was a phantom criterion, a Do text's `T-01` a phantom test).
// Linear: fixed alternatives after a one-character lookbehind. Idempotent (an escaped form never matches again).
// codeOk (1.17 verification N3): the comment escapes skip inline code spans (commentInert's rule) — only for text written into
// requirements.md as a whole line or after the importer's backtick-free prefix (a criterion, a story's prose, Out of Scope):
// its comment readers see code spans. Elsewhere a value is joined to others on its line (a code span's pairing could shift) or
// lands in design.md / decisions.md, read by blankHtmlComments (no code spans) — escaped everywhere. The ID / marker escapes
// apply inside code spans too: extractAcIds and taskMarkerSpans read code spans (a backslash shows there — CommonMark's rule).
const RE_FP_MARKER_LIKE = new RegExp("(?<=[_*])(" + [...TASK_MARKER_LABELS, "Kind", "Date", "Affects", "Supersedes", "Outcome"].join("|") + ")(?=:)", "giu");
function fpInert(s, codeOk) {
  const t = String(s == null ? "" : s);
  return (codeOk ? inertOutsideCode(t, true) : t.replace(/<!--/g, "&lt;!--").replace(/-->/g, "--&gt;")).replace(RE_FP_MARKER_LIKE, "$1\\")
    .replace(/(?<![A-Za-z0-9])(US-\d+)\.(?=AC-\d)/g, "$1\\.").replace(/(?<![A-Za-z0-9])(T|EC|NFR|SC)-(?=\d)/g, "$1\\-");
}
const fpV = (s) => fpInert(fpOneLine(s)); // a value written inside one line
// A value written into a heading (a title): fpV with its whitespace runs folded — a markdown reader shows one space anyway, and the
// heading readers downstream (the task scanner's /^#{1,6}\s+(.*?)\s*$/) are quadratic on a long space run (1.17 F review: an
// 80,000-space plan title took 15 s).
const fpHead = (s) => fpV(s).replace(/\s+/g, " ");
const fpTitle = (s) => fpV(s).replace(/^\[/, "\\["); // a task title: never a leading [P] / [US2] / [shared] tag run
// A line as a file holds it — never a heading, a task line or a checkpoint: one physical line (a CR / U+2028 / U+2029 folded,
// as fpOneLine does), then the structural escapes (the task scanner's and a markdown reader's).
function fpLine(l) {
  const s = String(l).replace(RE_FP_BREAKS, " ");
  if (/^\s{0,3}#{1,6}(?:\s|$)/.test(s)) return s.replace("#", "\\#");
  if (taskLine(s)) return s.replace("[", "\\[");
  if (RE_CHECKPOINT.test(s)) return s.replace("**", "\\*\\*");
  return s;
}
// Imported prose, line for line, each written at the start of a line of requirements.md / design.md: fpInert outside fenced code
// (+ fpLine's escapes when `structural` — requirements.md, where a heading or an ID-led line is structure); a fence it leaves open
// is closed (it swallowed every line after it — the criteria, the decisions). The fence view is the readers' own (fenceStep):
// the block starts outside any fence and is written whole lines at column 0.
function fpProse(lines, structural, codeOk) {
  const st = { fence: null };
  const out = [];
  for (const raw of lines) {
    const l = String(raw).replace(RE_FP_BREAKS, " ");
    if (fenceStep(st, l)) { out.push(l); continue; }
    out.push(structural ? fpLine(fpInert(l, codeOk)) : fpInert(l, codeOk));
  }
  if (st.fence) out.push(" ".repeat(st.fence.indent) + st.fence.mark);
  return out;
}
const fpCell = (s) => fpV(s).replace(/\|/g, "\\|") || "—";
// A verdict as the exports print it (EN / FR) → fluidplan's code: pending · modify · explain · ko · ok (null: unknown).
function fpVerdictOfText(s) {
  const t = String(s || "").trim().toLowerCase();
  if (/^(?:rejected|[ée]cart[ée]e)/.test(t)) return "ko";
  if (/^(?:to change|[àa] modifier)/.test(t)) return "modify";
  if (/^(?:question asked|question pos[ée]e)/.test(t)) return "explain";
  if (/^(?:no answer|sans r[ée]ponse)/.test(t)) return "pending";
  if (/^(?:accepted|retenue|mixed|nuanc[ée]e)/.test(t)) return "ok";
  return null;
}
// ----- plan.json + answers.json (fluidplan's model.js rules, re-stated) -----
const fpEdits = (a) => (a && isObj(a.edits) ? a.edits : {});
const fpTextOf = (a, key, orig) => { const e = own(fpEdits(a), key) ? fpEdits(a)[key] : null; return typeof e === "string" && fpFilled(e) ? e : orig; };
const fpHasEdits = (a, prefix) => Object.keys(fpEdits(a)).some((k) => k.startsWith(prefix) && fpFilled(fpEdits(a)[k]));
function fpItemVerdict(a, id) {
  const st = a && isObj(a.items) && own(a.items, id) && isObj(a.items[id]) ? a.items[id] : null;
  const s = st && st.status;
  if (!s) return "pending";
  if (s === "modify" && !fpFilled(st.comment) && !fpHasEdits(a, `items/${id}/`)) return "pending";
  return ["ok", "ko", "modify"].includes(s) ? s : "pending";
}
function fpVerdict(d, a) {
  const s = a && a.status;
  if (s === "explain") return fpFilled(a.comment) ? "explain" : "pending";
  const items = fpList(d.items).filter(isObj);
  if (items.length) {
    const st = items.map((it) => fpItemVerdict(a, it.id));
    if (st.includes("pending")) return "pending";
    if (st.every((x) => x === "ok")) return "ok";
    if (st.every((x) => x === "ko")) return "ko";
    return "mixed";
  }
  if (!s) return "pending";
  if (s === "modify" && !fpFilled(a.comment) && !fpHasEdits(a, "")) return "pending";
  return ["ok", "ko", "modify"].includes(s) ? s : "pending";
}
// settled: ok (accepted, mixed) · ko (rejected) · open (no answer, or waiting for a revision)
function fpStatus(d, a) {
  const v = fpVerdict(d, a);
  if (v === "ko") return "ko";
  if (v === "pending" || v === "modify" || v === "explain" || fpList(d.items).some((it) => isObj(it) && fpItemVerdict(a, it.id) === "modify")) return "open";
  return "ok";
}
const fpOptions = (d) => (isObj(d.control) ? fpList(d.control.options).filter((o) => isObj(o) && typeof o.id === "string") : []);
function fpChoice(d, a) {
  if (a && typeof a.choice === "string") return a.choice;
  const r = fpOptions(d).find((o) => o.recommended === true);
  return r ? r.id : null;
}
const fpChoices = (d, a) => (a && Array.isArray(a.choices) ? a.choices.filter((x) => typeof x === "string") : fpOptions(d).filter((o) => o.recommended === true).map((o) => o.id));
const fpValue = (d, a) => (a && Number.isFinite(a.value) ? a.value : isObj(d.control) && Number.isFinite(d.control.default) ? d.control.default : null);
const fpOptionLabel = (a, o) => fpOneLine(fpTextOf(a, `options/${o.id}/label`, o.label)); // a label (or its rewrite) is one line
function fpOrderedPhases(plan, answerOf) {
  const phases = fpList(plan.phases).filter((p) => isObj(p) && typeof p.id === "string");
  let order = null;
  for (const pg of fpList(plan.pages)) for (const d of isObj(pg) ? fpList(pg.decisions) : []) {
    if (!order && isObj(d) && isObj(d.control) && d.control.kind === "order" && d.control.source === "phases") order = d;
  }
  const a = order ? answerOf(order.id) : null;
  const byId = new Map(phases.map((p) => [p.id, p]));
  const out = [], inOut = new Set();
  const add = (p) => { if (p && !inOut.has(p)) { inOut.add(p); out.push(p); } };
  for (const id of a && Array.isArray(a.order) ? a.order : []) add(byId.get(id));
  for (const p of phases) add(p);
  return out;
}
function fpControlSummary(plan, answerOf, d, a, P) {
  const c = isObj(d.control) ? d.control : null;
  if (!c) return "";
  if (c.kind === "choice") {
    const id = fpChoice(d, a);
    if (!id) return "";
    if (id === FP_OTHER) return P.otherOption;
    const o = fpOptions(d).find((x) => x.id === id);
    return o ? fpOptionLabel(a, o) : fpOneLine(id);
  }
  if (c.kind === "multi") { const ids = fpChoices(d, a); return fpOptions(d).filter((o) => ids.includes(o.id)).map((o) => fpOptionLabel(a, o)).join(", ") || "—"; }
  if (c.kind === "number") { const v = fpValue(d, a); return v == null ? "" : `${v}${fpFilled(c.unit) ? " " + fpOneLine(c.unit) : ""}`; }
  if (c.kind === "order") return fpOrderedPhases(plan, (id) => (id === d.id ? a : answerOf(id))).map((p, i) => `${i + 1}. ${fpOneLine(p.title)}`).join(" · ");
  return "";
}
// The tasks an answer keeps: the decision's own, the chosen option's (the checked options'), the kept items' — templates filled
// ({{value}} {{unit}} {{choice.id}} {{choice.label}} {{choices}}), the reviewer's rewrites of a title / the criteria applied.
function fpDecisionTasks(d, a) {
  const c = isObj(d.control) ? d.control : null;
  const picked = [...fpList(d.tasks)];
  const chosen = c && c.kind === "choice" ? fpOptions(d).find((x) => x.id === fpChoice(d, a)) : null;
  if (chosen) picked.push(...fpList(chosen.tasks));
  const ids = c && c.kind === "multi" ? fpChoices(d, a) : [];
  if (c && c.kind === "multi") for (const o of fpOptions(d)) if (ids.includes(o.id)) picked.push(...fpList(o.tasks));
  for (const it of fpList(d.items)) if (isObj(it) && fpItemVerdict(a, it.id) !== "ko") picked.push(...fpList(it.tasks));
  const vars = {};
  if (c && c.kind === "number") { vars.value = fpValue(d, a); vars.unit = fpOneLine(c.unit); }
  if (c && c.kind === "choice") { vars["choice.id"] = chosen ? chosen.id : ""; vars["choice.label"] = chosen ? fpOptionLabel(a, chosen) : ""; }
  if (c && c.kind === "multi") vars.choices = fpOptions(d).filter((o) => ids.includes(o.id)).map((o) => fpOptionLabel(a, o)).join(", ");
  const fill = (s) => (typeof s === "string" ? s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => (own(vars, k) && vars[k] != null ? String(vars[k]) : m)) : s);
  return picked.filter((t) => isObj(t) && typeof t.id === "string").map((t) => {
    const acc = fpTextOf(a, `tasks/${t.id}/acceptance`, null);
    return { ...t, title: fill(fpStr(fpTextOf(a, `tasks/${t.id}/title`, t.title))), do: fill(typeof t.do === "string" ? t.do : ""),
      acceptance: (acc != null ? String(acc).split(/\r?\n/).map((s) => s.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean) : fpList(t.acceptance).filter((x) => typeof x === "string")).map(fill),
      verify: fpList(t.verify).filter((x) => typeof x === "string").map(fill) };
  });
}
// plan.json + answers.json + state.json → the normalized plan (see fpImportModel), the tasks numbered as PLAN.md numbers them:
// by phase (the chosen order), then by `after`, then page order; "0.n" for a task without a known phase.
function fpFromPlanJson(plan, answers, state, P, lang) {
  const A = isObj(answers) ? answers : {};
  const answerOf = (id) => (typeof id === "string" && own(A, id) && isObj(A[id]) ? A[id] : {});
  const SL = FP_SRC_LABELS[lang] || FP_SRC_LABELS.en;
  const fp = fpEmpty();
  fp.title = fpFilled(plan.title) ? fpOneLine(plan.title) : null;
  fp.subtitle = fpFilled(plan.subtitle) ? fpOneLine(plan.subtitle) : null; // 1.17 F review: carried (the summary, or design.md's Context)
  fp.id = typeof plan.id === "string" && FP_PLAN_ID.test(plan.id) ? plan.id : null;
  fp.context = typeof plan.context === "string" ? tidyLines(plan.context.split(/\r?\n/)) : [];
  const srcPath = isObj(plan.source) && typeof plan.source.path === "string" ? plan.source.path : typeof plan.source === "string" ? plan.source : null;
  fp.sourceDoc = fpFilled(srcPath) ? fpOneLine(srcPath) : null;
  const st = isObj(state) ? state : {};
  const hist = fpList(st.history).filter(isObj);
  const stamp = [st.submitted_at, hist.length ? hist[hist.length - 1].submitted_at : null, st.opened_at].find((x) => typeof x === "string" && !isNaN(Date.parse(x)));
  fp.date = stamp ? new Date(stamp) : null;
  fp.round = Number.isInteger(st.round) ? st.round : null;
  const phases = fpList(plan.phases).filter((p) => isObj(p) && typeof p.id === "string");
  const phaseTitle = new Map(phases.map((p, i) => [p.id, `Phase ${i + 1} — ${fpOneLine(p.title)}`]));
  const rows = [];
  const seen = new Set();
  fpList(plan.pages).forEach((pg, pi) => {
    if (!isObj(pg)) return;
    const pid = typeof pg.id === "string" ? pg.id : "page-" + (pi + 1);
    fp.pages.set(pid, { title: fpFilled(pg.title) ? fpOneLine(pg.title) : fpOneLine(pid), intro: typeof pg.intro === "string" ? tidyLines(pg.intro.split(/\r?\n/)) : [], index: pi });
    if (isObj(pg.visual) && pg.visual.kind) fp.visuals.push({ where: fp.pages.get(pid).title, kind: fpOneLine(pg.visual.kind), caption: fpStr(pg.visual.caption || pg.visual.alt) });
    for (const d of fpList(pg.decisions)) {
      if (!isObj(d) || typeof d.id !== "string" || !FP_ID.test(d.id) || seen.has(d.id)) continue;
      seen.add(d.id);
      rows.push({ pid, pi, d, a: answerOf(d.id) });
      if (isObj(d.visual) && d.visual.kind) fp.visuals.push({ where: d.id, kind: fpOneLine(d.visual.kind), caption: fpStr(d.visual.caption || d.visual.alt) });
    }
  });
  let pending = 0, revise = 0;
  for (const { pid, d, a } of rows) {
    const status = fpStatus(d, a);
    const v = fpVerdict(d, a);
    if (v === "pending") pending++;
    else if (status === "open") revise++;
    const chosenIds = isObj(d.control) && d.control.kind === "choice" ? [fpChoice(d, a)] : isObj(d.control) && d.control.kind === "multi" ? fpChoices(d, a) : [];
    const dec = fpNewDecision(d.id, fpOneLine(d.title) || d.id, status);
    Object.assign(dec, {
      verdict: v, importance: fpMap(FP_IMPORTANCE, d.importance) || "important", phaseTitle: typeof d.phase === "string" ? phaseTitle.get(d.phase) || null : null,
      choice: fpControlSummary(plan, answerOf, d, a, P) || null, why: fpFilled(d.why) ? fpOneLine(d.why) : null,
      proposal: fpFilled(fpTextOf(a, "proposal", d.proposal)) ? fpOneLine(fpTextOf(a, "proposal", d.proposal)) : null, rewritten: fpFilled(fpEdits(a).proposal),
      remarks: fpFilled(a.comment) ? [`“${fpOneLine(a.comment)}”`] : [], reason: status === "ko" && fpFilled(a.comment) ? `“${fpOneLine(a.comment)}”` : null,
      dependsOn: fpList(d.depends_on).filter((x) => typeof x === "string"), learnMore: fpFilled(d.learn_more) ? fpOneLine(d.learn_more) : null,
      facts: fpList(d.facts).filter((f) => isObj(f) && fpFilled(f.label)).map((f) => ({ label: fpOneLine(f.label), value: fpOneLine(f.value) })),
      question: Number.isInteger(d.question) ? d.question : null, sourceRef: fpFilled(d.source_ref) ? fpOneLine(d.source_ref) : null,
      pageId: pid, pageTitle: fp.pages.get(pid).title, stateText: P.verdict[v] || null,
      options: fpOptions(d).map((o) => ({ label: fpOptionLabel(a, o), detail: fpTextOf(a, `options/${o.id}/detail`, fpStr(o.detail)), pros: fpList(o.pros).map(fpStr), cons: fpList(o.cons).map(fpStr),
        effort: fpStr(o.effort), cost: fpStr(o.cost), chosen: chosenIds.includes(o.id) })),
      items: fpList(d.items).filter(isObj).map((it) => ({ title: fpOneLine(it.title), tag: fpOneLine(it.tag), detail: fpOneLine(fpTextOf(a, `items/${it.id}/detail`, it.detail)),
        verdict: fpItemVerdict(a, it.id), comment: a && isObj(a.items) && own(a.items, it.id) && isObj(a.items[it.id]) && fpFilled(a.items[it.id].comment) ? fpOneLine(a.items[it.id].comment) : "" })),
    });
    // 1.17 F review: what the reviewer and Claude said of it is carried — the revision note (Claude's, the latest round) in
    // decisions.md's Context, and for a decision still open, its question / request and its unsettled items' remarks on the
    // Open decisions line (they were dropped without a warning).
    if (isObj(d.revision) && fpFilled(d.revision.note)) dec.revisionNote = P.revisionNote(Number.isInteger(d.revision.round) ? d.revision.round : "?", fpOneLine(d.revision.note));
    if (status === "open") {
      const note = [fpFilled(a.comment) ? `“${fpOneLine(a.comment)}”` : null,
        ...dec.items.filter((it) => it.verdict === "modify" || it.verdict === "pending").map((it) => `${it.title} (${P.verdict[it.verdict]}${it.comment ? `: “${it.comment}”` : ""})`),
        dec.revisionNote].filter(Boolean);
      dec.openNote = note.length ? note.join(" · ") : null;
    }
    fp.decisions.set(d.id, dec);
    fp.decisionOrder.push(d.id);
    fp.decisionPage.set(d.id, pid);
  }
  if (pending || revise) fp.draft = { pending, revise };
  // The tasks (for a plan with no PLAN.md): the kept ones, grouped and numbered as fluidplan's resolvePlanTasks does.
  const entries = [];
  for (const r of rows) {
    if (fpVerdict(r.d, r.a) === "ko") continue;
    for (const t of fpDecisionTasks(r.d, r.a)) entries.push({ ref: `${r.d.id}/${t.id}`, r, task: t, phaseId: typeof t.phase === "string" ? t.phase : typeof r.d.phase === "string" ? r.d.phase : null });
  }
  const byRef = new Map();
  for (const e of entries) if (!byRef.has(e.ref)) byRef.set(e.ref, e);
  const ordered = fpOrderedPhases(plan, answerOf);
  const known = new Set(ordered.map((p) => p.id));
  const afterOf = (e) => fpList(e.task.after).filter((x) => typeof x === "string").map((x) => (x.includes("/") ? x : `${e.r.d.id}/${x}`));
  // fluidplan's order within a group: repeatedly the first entry (page order) whose in-group `after` are all placed — a cycle
  // (nothing ready) places the first remaining one. Kahn's walk with a min-heap of ready positions: the same order, linear-log
  // (the findIndex + splice loop was quadratic — a reversed `after` chain of 8,000 tasks took 9 s; 1.17 F review).
  const sortGroup = (group) => {
    const n = group.length;
    const inGroup = new Set(group.map((e) => e.ref));
    const need = new Array(n).fill(0);
    const waiting = new Map(); // ref → positions waiting for it
    group.forEach((e, i) => {
      for (const x of new Set(afterOf(e))) {
        if (!inGroup.has(x)) continue;
        need[i]++;
        if (!waiting.has(x)) waiting.set(x, []);
        waiting.get(x).push(i);
      }
    });
    const heap = [];
    const push = (v) => { heap.push(v); for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p] <= heap[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l] < heap[m]) m = l;
          if (r < heap.length && heap[r] < heap[m]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    need.forEach((k, i) => { if (!k) push(i); });
    const done = new Array(n).fill(false), placed = new Set(), out = [];
    let low = 0;
    while (out.length < n) {
      let i = -1;
      while (heap.length) { const c = pop(); if (!done[c]) { i = c; break; } }
      if (i < 0) { while (done[low]) low++; i = low; } // a cycle: page order (fluidplan's check reports it)
      done[i] = true;
      out.push(group[i]);
      const ref = group[i].ref;
      if (!placed.has(ref)) { placed.add(ref); for (const j of waiting.get(ref) || []) if (--need[j] === 0 && !done[j]) push(j); }
    }
    return out;
  };
  const groups = [];
  const byPhase = new Map(), looseEntries = [];
  for (const e of entries) {
    if (!e.phaseId || !known.has(e.phaseId)) { looseEntries.push(e); continue; }
    if (!byPhase.has(e.phaseId)) byPhase.set(e.phaseId, []);
    byPhase.get(e.phaseId).push(e);
  }
  const loose = sortGroup(looseEntries);
  if (loose.length) groups.push({ heading: SL.loose, title: SL.loose, entries: loose, num: (k) => `0.${k + 1}` });
  ordered.forEach((p, index) => {
    const es = sortGroup(byPhase.get(p.id) || []);
    const meta = [p.estimate, p.cost].filter((x) => typeof x === "string" && x.trim()).map(fpOneLine).join(" · ");
    const title = `Phase ${index + 1} — ${fpOneLine(p.title)}`;
    if (es.length) groups.push({ heading: title + (meta ? ` (${meta})` : ""), title, entries: es, num: (k) => `${index + 1}.${k + 1}` });
  });
  const numOf = new Map();
  for (const g of groups) g.entries.forEach((e, k) => numOf.set(e.ref, g.num(k)));
  const firstOf = new Set();
  groups.forEach((g) => {
    const gi = fp.groups.push({ heading: g.heading, title: g.title }) - 1;
    g.entries.forEach((e) => {
      const d = e.r.d, a = e.r.a, dec = fp.decisions.get(d.id);
      const first = !firstOf.has(d.id);
      firstOf.add(d.id);
      const after = [], dangling = [];
      for (const x of afterOf(e)) (numOf.has(x) ? after : dangling).push(numOf.has(x) ? numOf.get(x) : x);
      fp.tasks.push({ num: numOf.get(e.ref), done: false, title: fpOneLine(e.task.title) || e.task.id, fid: d.id, group: gi, state: dec.status === "open" ? dec.verdict : null,
        files: fpList(e.task.files).filter((f) => isObj(f) && typeof f.path === "string").map((f) => ({ path: f.path, op: fpMap(FP_OPS, f.op) || "modify" })),
        doLines: e.task.do ? e.task.do.split(RE_FP_LINE_SPLIT) : [], acceptance: e.task.acceptance.map(fpOneLine).filter(Boolean), verify: e.task.verify, after, dangling,
        remark: first && fpFilled(a.comment) ? `“${fpOneLine(a.comment)}”` : null,
        // An item kept as PLAN.md lists it: its verdict when not OK and the reviewer's remark (1.17 F review: the remark was dropped).
        items: first ? dec.items.filter((it) => it.verdict !== "ko").map((it) => `- ${it.title}${it.tag ? ` (${it.tag})` : ""}${it.detail ? ` — ${it.detail}` : ""}` +
          (it.verdict !== "ok" ? ` (${P.verdict[it.verdict] || it.verdict}${it.comment ? `: “${it.comment}”` : ""})` : it.comment ? ` (“${it.comment}”)` : "")) : [],
        extra: [], summary: dec.choice, critical: dec.importance === "critical" });
    });
  });
  // Working rules (accepted decisions no kept task carries), out of scope (rejected decisions and items), final check, glossary.
  const withTasks = new Set(entries.map((e) => e.r.d.id));
  for (const { d } of rows) {
    const dec = fp.decisions.get(d.id);
    dec.hasTasks = withTasks.has(d.id);
    // A rule has the shape PLAN.md's parser gives it (lines, state): fpImportModel reads r.lines (1.17 F review — a plan.json
    // with an accepted decision and no task, a working rule, threw "Cannot read properties of undefined").
    if (dec.status === "ok" && !dec.hasTasks) fp.rules.push({ fid: d.id, title: dec.title, rest: [dec.choice ? ` — ${dec.choice}` : "", dec.proposal ? `. ${dec.proposal}` : ""].join(""), state: null, remark: dec.remarks[0] || null, lines: [] });
    if (dec.status === "ko") fp.outOfScope.push(`- **${d.id} · ${dec.title}** — ${SL.rejected}${dec.reason ? `: ${dec.reason}` : ""}`);
    else for (const it of dec.items) if (it.verdict === "ko") fp.outOfScope.push(`- **${d.id}** / ${it.title} — ${SL.rejected}${it.comment ? `: “${it.comment}”` : ""}`);
  }
  const cmds = new Set();
  for (const t of fp.tasks) for (const c of t.verify) cmds.add(c);
  fp.finalCheck = [...cmds].map((c) => `- [ ] \`${fpOneLine(c)}\``);
  fp.glossary = fpList(plan.glossary).filter((g) => isObj(g) && fpFilled(g.term)).sort((x, y) => fpStr(x.term).localeCompare(fpStr(y.term)))
    .map((g) => `- **${fpOneLine(g.term)}**${fpList(g.aliases).length ? ` (${fpList(g.aliases).map(fpOneLine).join(", ")})` : ""} — ${fpOneLine(g.definition)}`);
  return fp;
}
function fpEmpty() {
  return { title: null, subtitle: null, id: null, context: [], sourceDoc: null, date: null, round: null, draft: null, groups: [], tasks: [], decisions: new Map(), decisionOrder: [],
    decisionPage: new Map(), pages: new Map(), rules: [], outOfScope: [], finalCheck: [], glossary: [], visuals: [], extra: [] };
}
function fpNewDecision(fid, title, status) {
  return { fid, title, status, verdict: status === "ko" ? "ko" : status === "open" ? "pending" : "ok", importance: null, phaseTitle: null, choice: null, why: null, proposal: null,
    rewritten: false, remarks: [], reason: null, dependsOn: [], learnMore: null, facts: [], question: null, sourceRef: null, pageId: null, pageTitle: null, options: null,
    othersText: null, items: [], itemsTable: [], extra: [], stateText: null, hasTasks: false, openNote: null, revisionNote: null };
}
// fluidplan's "To change" / "À modifier" (an item's verdict, in DECISIONS.md's items table or PLAN.md's "_(to change)_" mark).
const RE_FP_TO_CHANGE = /^(?:to change|[àa] modifier)$/i;
// DECISIONS.md's items table row "| Item | Detail | Opinion | Remark |" → its cells (a `\|` stays in its cell), else null.
function fpTableCells(row) {
  const t = String(row).trim();
  if (!t.startsWith("|") || !fpShort(t)) return null;
  const cells = [];
  let cur = "";
  for (let i = 1; i < t.length; i++) {
    if (t[i] === "\\" && t[i + 1] === "|") { cur += "\\|"; i++; continue; }
    if (t[i] === "|") { cells.push(cur.trim()); cur = ""; continue; }
    cur += t[i];
  }
  if (cur.trim()) cells.push(cur.trim());
  return cells;
}
// ----- PLAN.md / DECISIONS.md (fluidplan's exports, EN or FR) -----
// The blockquote header: the DRAFT notice ({pending, revise}), the date ("Approved on 2026-09-25 at 14:02"), the round, the source
// document and the plan's id (the "regenerate with `fluidplan export --plan <id>`" line).
function fpHeader(lines, from, to) {
  const out = { draft: null, date: null, round: null, source: null, id: null };
  for (let i = from; i < to; i++) {
    if (!/^\s*>/.test(lines[i])) continue;
    const t = lines[i].replace(/^\s*>\s?/, "");
    let m;
    if (/\*\*(?:DRAFT|BROUILLON)\*\*/.test(t)) {
      const n = t.match(/\((\d+)\D+(\d+)\D*\)/);
      out.draft = { pending: n ? +n[1] : null, revise: n ? +n[2] : null };
      continue;
    }
    if ((m = t.match(/fluidplan export --plan ([a-z0-9][a-z0-9_-]*)/))) out.id = m[1];
    if (!out.date && (m = t.match(/(\d{4})-(\d{2})-(\d{2})(?:\D{1,12}?(\d{2}):(\d{2}))?/))) {
      const d = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
      if (!isNaN(d.getTime())) out.date = d;
    }
    if (out.round == null && (m = t.match(/(?<![\p{L}])(?:round|tour)\s+(\d+)/iu))) out.round = +m[1];
    if (!out.source && (m = t.match(/(?<![\p{L}])source\s?:\s*`([^`\n]+)`/iu))) out.source = m[1];
  }
  return out;
}
// "- Label: value" (FR "- Label : value") bullets and the lines under each (a Do block, the criteria, the items kept).
function fpFields(body, table) {
  const fields = [];
  let cur = null;
  for (const raw of body) {
    const l = raw.trimEnd();
    if (/^[-*]\s/.test(l)) {
      const m = fpShort(l) ? l.match(/^[-*][ \t]+(?![ \t])([^:*`\n]+?)[ \t]?:(?:[ \t]+(.*))?$/) : null;
      const key = m ? (table.find(([, re]) => re.test(m[1].trim())) || [null])[0] : null;
      cur = { key, value: m && m[2] ? m[2].trim() : "", raw: l, lines: [] };
      fields.push(cur);
      continue;
    }
    if (cur) cur.lines.push(l);
    else if (l.trim()) fields.push({ key: null, value: "", raw: l, lines: [] });
  }
  for (const f of fields) f.lines = tidyLines(f.lines);
  return fields;
}
function fpTaskFromMd(th, body, group) {
  let title = th.title;
  let state = null;
  const sm = title.match(RE_FP_STATE);
  if (sm) { state = fpVerdictOfText(sm[1]); title = title.slice(0, sm.index).trimEnd(); }
  const t = { num: th.num, done: /[xX]/.test(th.box), title, fid: th.fid, group, state: state === "ok" ? null : state, files: [], doLines: [], acceptance: [], verify: [], after: [], dangling: [],
    remark: null, items: [], extra: [], summary: null, critical: false, decisionTitle: null };
  for (const f of fpFields(body, FP_TASK_FIELDS)) {
    const v = f.value;
    if (f.key === "decision") {
      const m = v.match(/^\*\*[^*]+\*\*\s*(.*)$/);
      let rest = m ? m[1] : v;
      if (/\s\[(?:critical|critique)\]$/i.test(rest)) { t.critical = true; rest = rest.replace(/\s\[[^\]]*\]$/, ""); }
      const k = rest.indexOf(" — ");
      t.decisionTitle = (k === -1 ? rest : rest.slice(0, k)).trim() || null;
      t.summary = k === -1 ? null : rest.slice(k + 3).trim() || null;
    } else if (f.key === "files") {
      for (const m of v.matchAll(/`([^`\n]+)`(?:[ \t]*\(([^()\n]*)\))?/g)) t.files.push({ path: m[1].trim(), op: fpMap(FP_OPS, String(m[2] || "").trim().toLowerCase()) || "modify" });
    } else if (f.key === "do") t.doLines = tidyLines([v, ...f.lines.map((l) => l.replace(/^ {2}/, ""))]);
    else if (f.key === "acceptance") {
      for (const l of f.lines) { const m = fpAcceptanceItem(l); if (m && m[1].trim()) t.acceptance.push(m[1].trim()); else if (l.trim() && t.acceptance.length) t.acceptance[t.acceptance.length - 1] += " " + l.trim(); }
    } else if (f.key === "verify") { for (const m of v.matchAll(/`([^`\n]+)`/g)) t.verify.push(m[1]); }
    else if (f.key === "after") t.after.push(...(v.match(/(?<!\d)\d+\.\d+/g) || [])); // (?<!\d): a digit run read from its start (1.17 H)
    else if (f.key === "remark") t.remark = v || null;
    else if (f.key === "items") t.items.push(...f.lines.filter((l) => l.trim()).map((l) => l.trim()));
    else t.extra.push(f.raw.trim(), ...f.lines.filter((l) => l.trim()).map((l) => "  " + l.trim()));
  }
  // An item kept "_(to change)_" (PLAN.md's mark): its decision waits for a revision — not settled (1.17 F review).
  t.itemsToChange = t.items.filter((l) => fpShort(l) && [...l.matchAll(/_\(([^()\n]*)\)_/g)].some((m) => fpVerdictOfText(m[1]) === "modify"));
  return t;
}
function fpParsePlanMd(text, fp) {
  const lines = stripHtmlComments(String(text)).split(/\r?\n/);
  const hs = mdHeadings(lines);
  const h1 = hs.find((h) => h.level === 1);
  const m1 = h1 ? fpTitleOf(h1.text, "plan") : null;
  if (h1) fp.title = fp.title || m1 || h1.text.trim();
  const h2 = hs.find((h) => h.level === 2);
  const header = fpHeader(lines, h1 ? h1.i + 1 : 0, h2 ? h2.i : lines.length);
  const tasks = [], groups = [], rules = [], extra = [];
  let context = null, finalCheck = null, outOfScope = null;
  hs.forEach((h, k) => {
    if (h.level !== 2) return;
    const t = h.text.trim();
    const [lo, hi] = mdRange(lines, hs, k);
    const body = lines.slice(lo, hi);
    if (FP_SEC.context.test(t)) { context = tidyLines(body); return; }
    if (FP_SEC.finalCheck.test(t)) { finalCheck = tidyLines(body); return; }
    if (FP_SEC.outOfScope.test(t)) { outOfScope = tidyLines(body); return; }
    if (FP_SEC.rules.test(t)) {
      let cur = null;
      for (const l of body) {
        const m = fpShort(l) ? fpDecLine(l) : null;
        if (m) {
          let rest = m[3];
          let state = null;
          const sm = rest.match(/_\(([^()]*)\)_/);
          if (sm) { state = fpVerdictOfText(sm[1]); rest = rest.slice(0, sm.index).trimEnd() + rest.slice(sm.index + sm[0].length); }
          cur = { fid: m[1], title: m[2].trim(), rest: rest.trimEnd(), state: state === "ok" ? null : state, remark: null, lines: [] };
          rules.push(cur);
        } else if (cur && /^\s+[-*]\s/.test(l)) {
          const r = fpShort(l) ? l.trim().match(/^[-*][ \t]+(?![ \t])([^:]+?)[ \t]?:[ \t]*(.*)$/) : null;
          if (r && /^(?:remark|remarque)$/i.test(r[1].trim())) cur.remark = r[2].trim();
          else cur.lines.push(l.trim());
        } else if (l.trim()) { cur = null; rules.push({ fid: null, raw: l.trim() }); }
      }
      return;
    }
    const pm = fpPhaseHeading(t);
    if (pm || FP_SEC.loose.test(t)) {
      const gi = groups.push({ heading: t, title: pm ? `Phase ${pm.n} — ${pm.title}` : t }) - 1;
      const covered = new Set();
      for (let j = k + 1; j < hs.length && hs[j].i < hi; j++) {
        const th = hs[j].level === 3 ? fpTaskHeading(lines[hs[j].i]) : null;
        if (!th) continue;
        const [tlo, thi] = mdRange(lines, hs, j);
        for (let q = hs[j].i; q < thi; q++) covered.add(q);
        tasks.push(fpTaskFromMd(th, lines.slice(tlo, thi), gi));
      }
      const left = tidyLines(body.filter((_, r) => !covered.has(lo + r) && !/^_[^_].*_$/.test(body[r].trim()))); // "_Nothing kept in this phase._"
      if (left.length) extra.push({ heading: "## " + t, lines: left });
      return;
    }
    const b = tidyLines(body);
    if (b.length) extra.push({ heading: "## " + t, lines: b });
  });
  return { looks: !!m1 || tasks.length > 0, header, tasks, groups, rules, context, finalCheck, outOfScope, extra };
}
function fpParseDecisionsMd(text, fp) {
  const lines = stripHtmlComments(String(text)).split(/\r?\n/);
  const hs = mdHeadings(lines);
  const h1 = hs.find((h) => h.level === 1);
  const m1 = h1 ? fpTitleOf(h1.text, "decisions") : null;
  if (h1 && !fp.title) fp.title = m1 || h1.text.trim();
  const h2 = hs.find((h) => h.level === 2);
  const header = fpHeader(lines, h1 ? h1.i + 1 : 0, h2 ? h2.i : lines.length);
  const decisions = [], extra = [];
  let context = null, glossary = null;
  hs.forEach((h, k) => {
    if (h.level !== 2) return;
    const t = h.text.trim();
    const [lo, hi] = mdRange(lines, hs, k);
    const body = lines.slice(lo, hi);
    if (FP_SEC.context.test(t)) { context = tidyLines(body); return; }
    if (FP_SEC.glossary.test(t)) { glossary = tidyLines(body); return; }
    if (FP_SEC.kept.test(t) || FP_SEC.rejected.test(t)) {
      const status = FP_SEC.kept.test(t) ? "ok" : "ko";
      for (let j = k + 1; j < hs.length && hs[j].i < hi; j++) {
        const dm = hs[j].level === 3 && fpShort(hs[j].text) ? hs[j].text.match(/^([A-Za-z0-9][A-Za-z0-9_-]*)[ \t]+·[ \t]+(.+)$/) : null;
        if (!dm) continue;
        const d = fpNewDecision(dm[1], dm[2].trim(), status);
        const dBody = mdBody(lines, hs, j);
        d.itemsTable = dBody.filter((l) => /^\s*\|/.test(l)).map((l) => l.trim()); // a list decision's items table (Item · Detail · Opinion · Remark)
        // DECISIONS.md writes "- **Label:** value" (FR "- **Label :** value") — read as fpFields' "- Label: value".
        for (const f of fpFields(dBody.filter((l) => !/^\s*\|/.test(l)).map((l) => l.replace(/^([-*]\s+)\*\*([^*]+?)\s?:\*\*/, "$1$2:")), FP_DEC_FIELDS)) {
          const v = f.value;
          if (f.key === "importance") d.importance = fpMap(FP_IMPORTANCE, v.toLowerCase());
          else if (f.key === "phase") d.phaseTitle = v || null;
          else if (f.key === "choice") d.choice = v || null;
          else if (f.key === "why") d.why = v || null;
          else if (f.key === "proposal") { const rw = v.match(/_\((?:rewritten|réécrite)\)_$/i); d.proposal = (rw ? v.slice(0, rw.index) : v).trim() || null; d.rewritten = !!rw; }
          else if (f.key === "others") d.othersText = v || null;
          else if (f.key === "remarks") { if (v) d.remarks.push(v); }
          else if (f.key === "history") d.history = v || null;
          else if (f.key === "reason") d.reason = v && v !== "—" ? v : null;
          else d.extra.push(f.raw.trim(), ...f.lines.map((l) => l.trim()).filter(Boolean));
        }
        // A list decision kept with an item still "To change" is not settled — fluidplan lists it with the accepted ones (its
        // verdict is "mixed") while it waits for a revision (1.17 F review: it was imported as settled).
        const toChange = d.itemsTable.map(fpTableCells).filter((c) => c && c.length >= 3 && RE_FP_TO_CHANGE.test(c[2]));
        if (status === "ok" && toChange.length) { d.status = "open"; d.verdict = "mixed"; d.itemsToChange = toChange.map((c) => ({ label: c[0], remark: c[3] || "" })); }
        decisions.push(d);
      }
      return;
    }
    if (FP_SEC.open.test(t)) {
      for (const l of body) {
        const m = fpShort(l) ? fpDecLine(l) : null;
        if (!m) continue;
        const d = fpNewDecision(m[1], m[2].trim(), "open");
        const rest = m[3].replace(/^\s*[—–-]\s*/, "").trim();
        d.verdict = fpVerdictOfText(rest) || "pending";
        d.stateText = rest || null;
        decisions.push(d);
      }
      return;
    }
    const b = tidyLines(body);
    if (b.length) extra.push({ heading: "## " + t, lines: b });
  });
  return { looks: !!m1 || decisions.length > 0, header, decisions, context, glossary, extra };
}
// A project's fluidplan.config.json (fluidplan's engine/lib/config.mjs): plansDir (default .fluidplan — inside the project only,
// else null), outputDir (where finalize writes PLAN.md / DECISIONS.md, default "{plansDir}/{id}" — the plan folder), lang.
function fpConfig(root, read) {
  let cfg = null;
  try { cfg = JSON.parse(read(path.join(root, "fluidplan.config.json")) || "null"); } catch { /* the defaults */ }
  const str = (k) => (isObj(cfg) && typeof cfg[k] === "string" && cfg[k].trim() ? cfg[k].trim() : null);
  const abs = path.resolve(root, str("plansDir") || ".fluidplan");
  return { plansDir: isInsideDir(root, abs) ? abs : null, outputDir: str("outputDir"), lang: str("lang") };
}
const fpPlansDir = (root, read) => fpConfig(root, read).plansDir;
// A fluidplan document's kind from its title: "plan" (PLAN.md), "decisions" (DECISIONS.md) or null.
function fpDocKind(text) {
  const lines = stripHtmlComments(String(text || "")).split(/\r?\n/);
  const h1 = lines.find((l) => /^#[ \t]/.test(l));
  const title = h1 ? h1.replace(/^#[ \t]+/, "") : "";
  if (fpTitleOf(title, "decisions") != null) return "decisions";
  if (fpTitleOf(title, "plan") != null || lines.some((l) => /^###[ \t]/.test(l) && fpTaskHeading(l))) return "plan";
  return null;
}
// PLAN.md's text followed by DECISIONS.md's (one pasted document) → the two parts.
function fpSplitDocs(text) {
  const lines = String(text).split(/\r?\n/);
  const at = lines.findIndex((l, i) => i > 0 && /^#[ \t]/.test(l) && fpTitleOf(l.replace(/^#[ \t]+/, ""), "decisions") != null);
  if (at === -1 || fpDocKind(lines.slice(0, at).join("\n")) !== "plan") return null;
  return { plan: lines.slice(0, at).join("\n"), decisions: lines.slice(at).join("\n") };
}

// fluidplan — see the block comment above.
function parseFluidplan(dir, read, W, src) {
  const P = i18n.msg(src.lang).importFluidplan;
  const PP = i18n.msg(src.lang).importPlans;
  const warnings = [];
  const rel = (p) => toPosix(path.relative(src.root, p)) || ".";
  const isDirL = (p) => { try { const st = fs.lstatSync(p); return st.isDirectory() && !st.isSymbolicLink(); } catch { return false; } };
  const json = (file) => {
    const t = read(file);
    if (t == null) return null;
    try { const v = JSON.parse(t); if (isObj(v)) return v; warnings.push(P.wBadJson(rel(file), "not an object")); } catch (e) { warnings.push(P.wBadJson(rel(file), String(e.message).slice(0, 120))); }
    return null;
  };
  // Where the plan is: its folder (plan.json) and / or its finalized documents.
  let planDir = null, planText = null, decText = null, sourceFile = null;
  // A folder is listed only when its real path is inside the project (1.17 F review: a `.fluidplan` junction to a folder outside
  // was listed, and the "several plans" refusal named what it held); a plan folder is never a link.
  const realInside = (p) => { try { return isInsideDir(src.root, fs.realpathSync.native(p)); } catch { return false; } };
  const planSubdirs = (d) => (realInside(d) ? safeReaddir(d).filter((n) => FP_PLAN_ID.test(n) && isDirL(path.join(d, n)) && realInside(path.join(d, n)) && fs.existsSync(path.join(d, n, "plan.json"))).sort() : []);
  if (src.file && !/\.json$/i.test(src.file)) {
    const text = read(src.file);
    if (text == null) return null;
    const both = fpSplitDocs(text);
    const kind = both ? "plan" : fpDocKind(text);
    if (!kind) return { error: src.inline ? P.notFluidplanText : P.notFluidplan(rel(src.file)) }; // inline text has no file to name
    sourceFile = src.file;
    if (both) { planText = both.plan; decText = both.decisions; } else if (kind === "plan") planText = text; else decText = text;
    // The other document beside it (PLAN.md ↔ DECISIONS.md, PLAN_x.md ↔ DECISIONS_x.md), and plan.json: beside it, else the plan
    // folder its "fluidplan export --plan <id>" line names.
    const base = path.basename(src.file);
    const swap = kind === "plan" ? base.replace(/plan/i, (m) => (m === "PLAN" ? "DECISIONS" : m === "Plan" ? "Decisions" : "decisions"))
      : base.replace(/decisions/i, (m) => (m === "DECISIONS" ? "PLAN" : m === "Decisions" ? "Plan" : "plan"));
    if (!both && swap !== base) {
      const other = read(path.join(dir, swap));
      if (other != null && fpDocKind(other) === (kind === "plan" ? "decisions" : "plan")) { if (kind === "plan") decText = other; else planText = other; }
    }
    if (read(path.join(dir, "plan.json")) != null) planDir = dir;
    else {
      const id = fpHeader(String(planText || decText).split(/\r?\n/), 0, 40).id;
      const plans = id ? fpPlansDir(src.root, read) : null;
      if (plans && read(path.join(plans, id, "plan.json")) != null) planDir = path.join(plans, id);
    }
  } else if (src.file) {
    planDir = dir; // plan.json (or answers.json / state.json): its folder
    sourceFile = dir;
  } else if (fs.existsSync(path.join(dir, "plan.json"))) { planDir = dir; sourceFile = dir; }
  else if (["PLAN.md", "DECISIONS.md"].some((n) => fs.existsSync(path.join(dir, n)))) {
    planText = read(path.join(dir, "PLAN.md"));
    decText = read(path.join(dir, "DECISIONS.md"));
    sourceFile = dir;
  } else {
    // A plans folder (or the project root / a folder holding .fluidplan/): exactly one plan in it.
    const bases = [dir, path.join(dir, ".fluidplan")];
    if (fs.existsSync(path.join(dir, "fluidplan.config.json"))) { const pd = fpPlansDir(dir, read); if (pd && realInside(pd)) bases.push(pd); }
    for (const b of bases) {
      const found = planSubdirs(b);
      if (found.length > 1) return { error: P.several(rel(b), found.join(", ")) };
      if (found.length === 1) { planDir = path.join(b, found[0]); sourceFile = planDir; break; }
    }
    if (!planDir) return null;
  }
  let plan = null, answers = null, state = null;
  const cfg = fpConfig(src.root, read);
  if (planDir) {
    plan = json(path.join(planDir, "plan.json"));
    answers = json(path.join(planDir, "answers.json"));
    state = json(path.join(planDir, "state.json"));
    // The finalized documents: in the plan folder, else where fluidplan writes them (engine/lib/config.mjs outputPaths) — plan.json's
    // `output`, else fluidplan.config.json's outputDir ("{plansDir}/{id}" by default; 1.17 F review: a finalized PLAN.md in
    // `docs/fp/{id}` wasn't found, and its ticks were lost). Inside the project only (read() checks the real path too).
    const planId = plan && typeof plan.id === "string" && FP_PLAN_ID.test(plan.id) ? plan.id : path.basename(planDir);
    const outputOf = (key, name) => {
      const inDir = read(path.join(planDir, name));
      if (inDir != null) return inDir;
      const o = plan && isObj(plan.output) && typeof plan.output[key] === "string" ? plan.output[key].trim() : "";
      if (o) {
        if (!/\.md$/i.test(o)) return null;
        const abs = path.resolve(src.root, o);
        return isInsideDir(src.root, abs) ? read(abs) : null;
      }
      if (!cfg.outputDir || (cfg.outputDir.includes("{plansDir}") && !cfg.plansDir)) return null;
      const abs = path.resolve(src.root, cfg.outputDir.split("{plansDir}").join(cfg.plansDir || "").split("{id}").join(planId), name);
      return isInsideDir(src.root, abs) ? read(abs) : null;
    };
    if (planText == null) { const t = outputOf("plan", "PLAN.md"); if (t != null && fpDocKind(t) === "plan") planText = t; }
    if (decText == null) { const t = outputOf("decisions", "DECISIONS.md"); if (t != null && fpDocKind(t) === "decisions") decText = t; }
    if (!plan && planText == null && decText == null) return warnings.length ? { error: warnings[0] } : null;
    // Finalized (state.json) but no PLAN.md found: the tasks come from plan.json, unticked — said, never silently.
    if (plan && planText == null && isObj(state) && state.status === "exported") warnings.push(P.wNoExport);
  }
  // plan.json's language (else fluidplan.config.json's): the headings it builds (a PLAN.md carries its own).
  const lang = plan && (plan.lang === "fr" || plan.lang === "en") ? plan.lang : cfg.lang === "fr" ? "fr" : "en";
  // The normalized plan: plan.json's view first (the pages, the options), then the finalized documents over it.
  const fp = plan ? fpFromPlanJson(plan, answers, state, P, lang) : fpEmpty();
  const fromJson = { decisions: fp.decisions, order: fp.decisionOrder };
  if (planText != null) {
    const pm = fpParsePlanMd(planText, fp);
    fp.tasks = pm.tasks;
    fp.groups = pm.groups;
    fp.rules = pm.rules;
    if (pm.context) fp.context = pm.context;
    if (pm.finalCheck) fp.finalCheck = pm.finalCheck;
    if (pm.outOfScope) fp.outOfScope = pm.outOfScope;
    fp.extra.push(...pm.extra);
    fp.draft = pm.header.draft;
    fp.date = pm.header.date || fp.date;
    fp.round = pm.header.round || fp.round;
    fp.sourceDoc = pm.header.source || fp.sourceDoc;
    fp.id = fp.id || pm.header.id;
  }
  if (decText != null) {
    const dm = fpParseDecisionsMd(decText, fp);
    if (!fp.context.length && dm.context) fp.context = dm.context;
    if (dm.glossary) fp.glossary = dm.glossary;
    fp.extra.push(...dm.extra);
    if (planText == null) { fp.draft = dm.header.draft; fp.date = dm.header.date || fp.date; fp.round = dm.header.round || fp.round; fp.sourceDoc = dm.header.source || fp.sourceDoc; }
    fp.id = fp.id || dm.header.id;
    // DECISIONS.md's settled decisions win; plan.json adds what the export leaves out (every option's pros / cons / effort, the
    // page, depends_on, learn_more, facts).
    fp.decisions = new Map();
    fp.decisionOrder = [];
    for (const d of dm.decisions) {
      const j = fromJson.decisions.get(d.fid);
      if (j) {
        for (const k of ["dependsOn", "learnMore", "facts", "question", "sourceRef", "pageId", "pageTitle", "items", "hasTasks", "revisionNote"]) d[k] = j[k];
        if (!d.importance) d.importance = j.importance;
        if (j.options && j.options.length) {
          const picked = String(d.choice || "").split(", ").map((s) => s.trim());
          d.options = j.options.map((o) => ({ ...o, chosen: d.choice ? picked.includes(o.label) || (o.chosen && !j.options.some((x) => picked.includes(x.label))) : o.chosen }));
        }
      }
      if (!fp.decisions.has(d.fid)) { fp.decisions.set(d.fid, d); fp.decisionOrder.push(d.fid); }
    }
    for (const fid of fromJson.order) if (!fp.decisions.has(fid)) { fp.decisions.set(fid, fromJson.decisions.get(fid)); fp.decisionOrder.push(fid); }
  } else if (!plan && planText != null) {
    // PLAN.md alone: its decisions are what it names — the working rules, each task's "Decision:" line, the rejected ones.
    const add = (fid, title, status) => {
      if (!fp.decisions.has(fid)) { fp.decisions.set(fid, fpNewDecision(fid, title, status)); fp.decisionOrder.push(fid); }
      return fp.decisions.get(fid);
    };
    for (const r of fp.rules) if (r.fid) { const d = add(r.fid, r.title, r.state ? "open" : "ok"); if (r.state) d.verdict = r.state; const s = r.rest.replace(/^\s*[—–-]\s*/, "").replace(/^\.\s*/, ""); if (s) d.choice = s; }
    for (const t of fp.tasks) {
      const d = add(t.fid, t.decisionTitle || t.fid, t.state ? "open" : "ok");
      if (t.state) { d.status = "open"; d.verdict = t.state; }
      if (t.summary && !d.choice) d.choice = t.summary;
      if (t.critical) d.importance = "critical";
      d.hasTasks = true;
    }
    for (const l of fp.outOfScope) {
      const m = fpDecLine(l);
      if (!m) continue;
      const d = add(m[1], m[2].trim(), "ko");
      d.status = "ko";
      const r = m[3].replace(/^\s*[—–-]\s*/, "").match(/^[^:]*:\s*(.+)$/);
      d.reason = r ? r[1].trim() : null;
    }
    if (fp.decisions.size) warnings.push(P.wNoDecisions);
  }
  // A decision a task or rule shows as not settled is open, whatever the source — a task keeping an item "_(to change)_" too
  // (fluidplan prints no state on such a task: its decision's verdict is "mixed").
  for (const t of fp.tasks) {
    const d = fp.decisions.get(t.fid);
    const toChange = t.itemsToChange && t.itemsToChange.length;
    if (d && (t.state || toChange) && d.status === "ok") { d.status = "open"; d.verdict = t.state || "mixed"; }
    if (d && toChange && d.status === "open" && !d.itemsToChangeMd) d.itemsToChangeMd = t.itemsToChange;
  }
  for (const r of fp.rules) { const d = r.fid ? fp.decisions.get(r.fid) : null; if (d && r.state && d.status === "ok") { d.status = "open"; d.verdict = r.state; } }
  // What an open decision's line carries besides its state (1.17 F review — dropped before): plan.json's view already holds it
  // (fpFromPlanJson); a decision read from the exports gets its remarks (DECISIONS.md's "Remarks:" — a "Still open" line
  // quotes its own), its items not settled (plan.json's, else DECISIONS.md's table, else PLAN.md's marked lines) and the revision note.
  for (const d of fp.decisions.values()) {
    if (d.status !== "open" || d.openNote) continue;
    const items = d.items.length ? d.items.filter((it) => it.verdict === "modify" || it.verdict === "pending").map((it) => `${it.title} (${P.verdict[it.verdict]}${it.comment ? `: “${it.comment}”` : ""})`)
      : d.itemsToChange ? d.itemsToChange.map((it) => `${it.label} (${P.verdict.modify}${it.remark ? `: ${it.remark}` : ""})`)
      : (d.itemsToChangeMd || []).map((l) => l.replace(/^[-*+]\s+/, ""));
    const note = [...(d.stateText ? [] : d.remarks), ...items, d.revisionNote].filter(Boolean);
    d.openNote = note.length ? note.join(" · ") : null;
  }
  if (!fp.title && !fp.tasks.length && !fp.decisions.size) return null;
  const model = fpImportModel(fp, P, PP, W, src, warnings);
  model.sourceFile = sourceFile;
  model.nameHint = model.title || fp.id || path.basename(planDir || dir);
  const roundsDir = planDir ? path.join(planDir, "rounds") : null;
  if ((roundsDir && isDirL(roundsDir)) || (fp.round && fp.round > 1)) model.warnings.push(P.wRounds);
  return model;
}
// The normalized plan → spec_import's model: stories + criteria, tasks.md (numbered here: its _Depends:_ name these numbers),
// design.md, decisions.md, the Out of Scope / Open decisions sections, warnings and the mapping.
function fpImportModel(fp, P, PP, W, src, warnings) {
  const model = newImportModel();
  // Every value below comes from the plan: written through fpV (one line) / fpProse (line for line) — never markup (1.17 F review).
  model.title = fp.title ? fpHead(fp.title) : null;
  const L = P.label;
  // D-1… for the settled decisions (accepted and rejected), in the plan's order.
  const dn = new Map();
  for (const fid of fp.decisionOrder) {
    const d = fp.decisions.get(fid);
    if (d.status === "ok" || d.status === "ko") { dn.set(fid, "D-" + (dn.size + 1)); model.mapping["decision " + fid] = dn.get(fid); }
  }
  // Summary: the context's first paragraph (the rest goes to design.md), else plan.json's subtitle.
  const at = [];
  const first = firstParagraph(fp.context, at);
  const atSet = new Set(at);
  const ctxRest = tidyLines(fp.context.filter((_, i) => !atSet.has(i)));
  const summary = first || fp.subtitle;
  model.summary = summary ? fpLine(fpV(summary)) : null;
  // Stories: the pages (themes), else PLAN.md's phase groups — each gathers its tasks' criteria; a criterion stated twice in one
  // story is one AC, cited by every task stating it.
  const stories = new Map();
  const taskCrit = new Map(); // task index → [criterion objects]
  fp.tasks.forEach((t, i) => {
    if (!t.acceptance.length) return;
    const pid = fp.decisionPage.get(t.fid);
    const page = pid != null ? fp.pages.get(pid) : null;
    const key = page ? "p:" + pid : "g:" + t.group;
    if (!stories.has(key)) {
      const g = fp.groups[t.group] || { title: fp.title || PP.planTitle };
      stories.set(key, page ? { order: page.index, key: "page " + pid, title: fpHead(page.title), prose: fpProse(page.intro, true, true), crit: [], byText: new Map() }
        : { order: 1e6 + t.group, key: g.title, title: fpHead(g.title), prose: [], crit: [], byText: new Map() });
    }
    const s = stories.get(key);
    const list = [];
    t.acceptance.forEach((raw0, m) => {
      const raw = fpInert(fpOneLine(raw0), true); // requirements.md, after "N. **US-n.AC-m** — ": a code span's `<!--` stays
      const norm = raw.replace(/\s+/g, " ").trim().toLowerCase();
      let c = s.byText.get(norm);
      if (!c) { c = { key: `task ${t.num} / acceptance ${m + 1}`, raw, ears: earsFromPlanText(raw), also: [] }; s.byText.set(norm, c); s.crit.push(c); }
      else c.also.push(`task ${t.num} / acceptance ${m + 1}`);
      if (!list.includes(c)) list.push(c);
    });
    taskCrit.set(i, list);
  });
  const ordered = [...stories.values()].sort((a, b) => a.order - b.order);
  ordered.forEach((s, idx) => {
    s.crit.forEach((c, j) => { c.id = `US-${idx + 1}.AC-${j + 1}`; for (const k of c.also) model.mapping[k] = c.id; });
    model.stories.push({ printed: null, key: s.key, title: s.title, priority: null, prose: s.prose, quote: [], after: [], criteria: s.crit.map((c) => ({ key: c.key, raw: c.raw, ears: c.ears })) });
  });
  if (!model.stories.length) planStory(model, fp.title ? fpHead(fp.title) : PP.planTitle, []);
  // The decisions' criteria (their _Affects:_) and the open decisions' ones.
  const acsOf = new Map();
  fp.tasks.forEach((t, i) => { for (const c of taskCrit.get(i) || []) { if (!acsOf.has(t.fid)) acsOf.set(t.fid, new Set()); acsOf.get(t.fid).add(c.id); } });
  const acsList = (fid) => [...(acsOf.get(fid) || [])];
  const stateOf = (d) => fpV(d.stateText || P.verdict[d.verdict] || P.verdict.pending);
  const ref = (fid) => { const d = fp.decisions.get(fid); return dn.has(fid) ? `${dn.get(fid)} — ${d ? fpV(d.title) : fpV(fid)}` : `${fpV(fid)}${d ? " · " + fpV(d.title) : ""}`; };
  // tasks.md
  const numOf = new Map();
  fp.tasks.forEach((t, i) => { if (!numOf.has(t.num)) numOf.set(t.num, i + 1); });
  const ruleLines = [];
  for (const r of fp.rules) {
    if (!r.fid) { ruleLines.push(fpLine(fpInert(r.raw).replace(/^(?![-*]\s)/, "- "))); continue; }
    const d = fp.decisions.get(r.fid);
    if (r.state || (d && d.status === "open")) continue; // not settled: listed under Open decisions instead
    ruleLines.push(fpLine(`- ${dn.get(r.fid) || fpV(r.fid)} · ${fpV(r.title)}${fpInert(r.rest)}`), ...(r.remark ? [`  - ${L.remark}: ${fpV(r.remark)}`] : []),
      ...(r.lines || []).map((l) => fpLine("  " + fpInert(l))));
  }
  // The dependencies (fluidplan's `after`, renumbered), then the cycles among them broken (1.17 F review): an `after` cycle became
  // mutual _Depends:_ — no task of it could ever start, doctor's task-deps failed and the tasks approval was refused. In each
  // cycle (a strongly connected set, dependencyCycles) the edges against the plan's order — a task depending on a LATER one, the
  // `after` fluidplan's own numbering had to break — are dropped, each named in a warning.
  const depsOf = fp.tasks.map((t, i) => {
    const deps = [];
    for (const a of t.after) { const d = numOf.get(a); if (d != null && d !== i + 1 && !deps.includes(d)) deps.push(d); }
    return deps;
  });
  const byNum = new Map(fp.tasks.map((_, i) => [i + 1, [i]]));
  const cycles = fp.tasks.length ? dependencyCycles({ blocks: fp.tasks.map((_, i) => ({ number: i + 1, done: false })), byNum, specs: depsOf.map((numbers) => ({ numbers })) }, false) : [];
  for (const cyc of cycles) {
    const inCyc = new Set(cyc);
    const dropped = [];
    for (const i of cyc) {
      const keep = depsOf[i - 1].filter((j) => !(inCyc.has(j) && j > i));
      if (keep.length === depsOf[i - 1].length) continue;
      for (const j of depsOf[i - 1]) if (!keep.includes(j)) dropped.push(`${fp.tasks[i - 1].num} → ${fp.tasks[j - 1].num}`);
      depsOf[i - 1] = keep;
    }
    warnings.push(P.wCycle(cyc.map((i) => fp.tasks[i - 1].num).join(", "), dropped.join(", ")));
  }
  const out = [];
  const keys = [];
  let g = -1;
  fp.tasks.forEach((t, i) => {
    if (t.group !== g) { g = t.group; if (fp.groups[g]) out.push("", "## " + fpHead(fp.groups[g].heading)); }
    const n = i + 1;
    keys.push("task " + t.num);
    const body = [];
    const acs = (taskCrit.get(i) || []).map((c) => c.id);
    if (acs.length) body.push(`  - _Requirements: ${acs.join(", ")}_`);
    const impl = [], deletes = [], untraced = [];
    for (const f of t.files) {
      const p = f.path.includes("`") ? null : planPaths("`" + f.path + "`")[0]; // a backtick would split the span: "src/`x`.js" read as ".js"
      const readable = p && taskMarkers({ text: "", body: [`- _Implements: ${p}_`], bodyCode: [] }).implements.join("\n") === p;
      if (!readable) { untraced.push(f); warnings.push(P.wPath(t.num, fpOneLine(f.path))); continue; }
      if (f.op === "delete") { if (!deletes.includes(p)) deletes.push(p); } else if (!impl.includes(p)) impl.push(p);
    }
    if (impl.length) body.push(`  - _Implements: ${impl.join(", ")}_`);
    const badVerify = [];
    for (const c of t.verify) {
      const cmd = String(c).trim();
      // Only fluidplan's `verify` field makes a _Verify:_ — and only a command the marker holds whole, on one line, opening or
      // closing no HTML comment (a `<!--` in one command and a `-->` in the next hid the lines between).
      const readable = cmd && !RE_FP_VERIFY_BAD.test(cmd) && taskMarkers({ text: "", body: [`- _Verify: ${cmd}_`], bodyCode: [] }).verify.join("\n") === cmd;
      if (readable) { if (!body.includes(`  - _Verify: ${cmd}_`)) body.push(`  - _Verify: ${cmd}_`); } else { badVerify.push(cmd); warnings.push(P.wVerify(t.num, fpOneLine(cmd).slice(0, 120))); }
    }
    for (const a of t.after) { if (!numOf.has(a)) warnings.push(P.wAfter(t.num, fpOneLine(a))); }
    for (const a of t.dangling || []) warnings.push(P.wAfter(t.num, fpOneLine(a)));
    if (depsOf[i].length) body.push(`  - _Depends: ${depsOf[i].join(", ")}_`);
    const dec = fp.decisions.get(t.fid);
    const open = dec && dec.status === "open";
    body.push(`  - ${L.decision}: ${ref(t.fid)}${!open && t.summary ? ` (${fpV(t.summary)})` : ""}${open ? ` — ${P.openMark(stateOf(dec))}` : ""}`);
    if (deletes.length) body.push(`  - ${L.deletes}: ${deletes.map((p) => "`" + p + "`").join(", ")}`);
    // A refused path is shown in a code span, inert (1.17 F review: one holding `_, _Verify:` made a marker of the line).
    if (untraced.length) body.push(`  - ${L.untraced}: ${untraced.map((f) => "`" + fpV(f.path).replace(/`/g, "'") + "` (" + f.op + ")").join(", ")}`);
    if (badVerify.length) body.push(`  - ${L.verify}: ${badVerify.map(fpV).join(" · ")}`);
    if (t.doLines.length) {
      const st = { fence: null };
      const lines = t.doLines.map((l) => { fenceStep(st, l); return fpInert(l); });
      if (st.fence) lines.push(st.fence.mark);
      body.push(`  - ${L.do}: ${lines[0]}`, ...lines.slice(1).map((l) => (l.trim() ? "    " + l : "")));
    }
    if (t.remark) body.push(`  - ${L.remark}: ${fpV(t.remark)}`);
    if (t.items.length) body.push(`  - ${L.itemsKept}:`, ...t.items.map((l) => "    " + fpInert(l)));
    body.push(...t.extra.map((l) => "  " + fpInert(l.trim())));
    // Line by line (a value holding a line break is one line; 1.17 F review: only an entry's first line was checked), a body line
    // never reads as a task, a checkpoint or a heading of tasks.md.
    out.push(`- [${t.done ? "x" : " "}] ${n}. ${fpTitle(t.title)}`, ...body.map(fpLine));
  });
  if (fp.tasks.length) {
    const text = [...(ruleLines.length ? [P.constraints, "", ...ruleLines, ""] : []), ...out].join("\n").replace(/^\n+/, "");
    model.tasks = { text, file: "PLAN.md", numbered: true };
    model.taskKeys = keys;
  } else warnings.push(P.wNoTasks);
  // decisions.md — spec_decide's format (decisionEntryLines runs every text through safeSpecText; the title is ours to make safe).
  const at0 = (fp.date && !isNaN(fp.date.getTime()) ? fp.date : new Date()).toISOString();
  model.decisions = [];
  const summaryLines = [];
  const tradeRows = [];
  for (const fid of fp.decisionOrder) {
    const d = fp.decisions.get(fid);
    if (!dn.has(fid)) continue;
    const id = dn.get(fid);
    const meta = [d.importance ? `${L.importance}: ${P.importance[d.importance] || d.importance}` : null, d.phaseTitle ? `${L.phase}: ${d.phaseTitle}` : null,
      d.pageTitle ? `${L.page}: ${d.pageTitle}` : null, `${L.fluidplan} ${fid}`].filter(Boolean).join(" · ");
    const noChoice = !d.choice && !d.items.length && !d.itemsTable.length;
    const ctx = [d.why || meta, ...(d.why ? ["- " + meta] : [])];
    if (d.proposal && !(noChoice && d.status === "ok")) ctx.push(`- ${L.proposal}: ${d.proposal}${d.rewritten ? ` _(${L.rewritten})_` : ""}`);
    if (d.dependsOn.length) ctx.push(`- ${L.dependsOn}: ${d.dependsOn.map((x) => dn.get(x) || x).join(", ")}`);
    if (d.question != null) ctx.push(`- ${L.question}: ${d.question}`);
    if (d.sourceRef) ctx.push(`- ${L.sourceRef}: ${d.sourceRef}`);
    for (const f of d.facts) ctx.push(`- ${f.label}: ${f.value}`);
    if (d.learnMore) ctx.push(`- ${L.learnMore}: ${d.learnMore}`);
    if (d.revisionNote) ctx.push(`- ${d.revisionNote}`);
    const decision = [];
    if (d.status === "ko") {
      decision.push(P.rejected(d.reason));
    } else {
      const chosen = (d.options || []).filter((o) => o.chosen);
      decision.push(d.choice ? d.choice + (chosen.length === 1 && chosen[0].detail ? ` — ${fpOneLine(chosen[0].detail)}` : "") : d.proposal ? `${d.proposal}${d.rewritten ? ` _(${L.rewritten})_` : ""}` : d.title);
      if (d.items.length) decision.push(`- ${L.items}: ${d.items.map((it) => `${it.title} (${it.verdict === "ko" ? P.verdict.ko : it.verdict === "ok" ? "OK" : P.verdict[it.verdict] || it.verdict}${it.comment ? `: “${it.comment}”` : ""})`).join(" · ")}`);
      else if (d.itemsTable.length) decision.push("", ...d.itemsTable);
    }
    for (const r of d.remarks) if (!(d.status === "ko" && d.reason && r.startsWith(d.reason))) decision.push(`- ${L.remarks}: ${r}`); // a rejection's reason is its remark
    for (const x of d.extra) decision.push(x.startsWith("- ") || x.startsWith("|") ? x : "- " + x);
    const cons = [];
    const optText = (o) => [o.pros.length ? `${L.pros}: ${o.pros.join("; ")}` : null, o.cons.length ? `${L.cons}: ${o.cons.join("; ")}` : null,
      o.effort ? `${L.effort}: ${o.effort}` : null, o.cost ? `${L.cost}: ${o.cost}` : null].filter(Boolean).join(" · ");
    if (d.status === "ok" && d.options && d.options.length) {
      for (const o of d.options.filter((x) => x.chosen)) { const t = optText(o); if (t) cons.push(`${o.label} — ${t}`); }
      const others = d.options.filter((x) => !x.chosen);
      if (others.length) cons.push(`- ${L.others}:`, ...others.map((o) => `  - ${o.label}${optText(o) ? ` — ${optText(o)}` : ""}`));
    } else if (d.status === "ok" && d.othersText) cons.push(`- ${L.others}: ${d.othersText}`);
    if (cons.length && cons[0].startsWith("- ")) cons[0] = cons[0].slice(2);
    // The title: one line, inert (1.17 F review: a `<!--` in it reached the heading — the import bypasses decisionInput — and a
    // later `-->` hid the entry's markers).
    model.decisions.push({ id, title: fpHead(fpOneLine(d.title).replace(/\s+/g, " ").slice(0, DECISION_TITLE_MAX)), kind: "decision", at: at0, affects: d.status === "ok" ? acsList(fid) : [], supersedes: [],
      context: ctx.join("\n"), decision: decision.join("\n"), consequences: cons.join("\n") || null });
    summaryLines.push(`- **${id}** — ${fpV(d.title)}${d.status === "ko" ? `: ${P.rejectedMark}${d.reason ? ` — ${fpV(d.reason)}` : ""}` : d.choice ? `: ${fpV(d.choice)}` : ""}${d.importance === "critical" ? ` _(${P.importance.critical})_` : ""}`);
    // Alternatives & Trade-offs: every option of a choice, the chosen one first; without plan.json, the choice + DECISIONS.md's others.
    const label = `${id} ${d.title}`;
    if (d.options && d.options.length > 1) {
      for (const o of [...d.options.filter((x) => x.chosen), ...d.options.filter((x) => !x.chosen)]) {
        tradeRows.push(`| ${fpCell(label)} | ${o.chosen ? `**${fpCell(o.label)}** (${P.chosen})` : fpCell(o.label)} | ${fpCell(o.pros.join("; "))} | ${fpCell(o.cons.join("; "))} | ${fpCell(o.effort)} |`);
      }
    } else if (d.othersText && d.choice) {
      tradeRows.push(`| ${fpCell(label)} | **${fpCell(d.choice)}** (${P.chosen}) | — | — | — |`);
      for (const piece of d.othersText.split(" · ")) { // "Redis (con: One more service to run)" — FR "(contre : …)"
        const k = piece.search(/\((?:con|contre)[ \t]?:/i);
        const cons = k === -1 ? "" : piece.slice(k).replace(/^\((?:con|contre)[ \t]?:[ \t]*/i, "").replace(/\)$/, "");
        tradeRows.push(`| ${fpCell(label)} | ${fpCell(k === -1 ? piece : piece.slice(0, k))} | — | ${fpCell(cons)} | — |`);
      }
    }
  }
  // requirements.md: Out of Scope, Open decisions.
  const scope = fp.outOfScope.length ? fpProse(fp.outOfScope, true, true)
    : fp.decisionOrder.map((fid) => fp.decisions.get(fid)).filter((d) => d.status === "ko").map((d) => `- **${fpV(d.fid)} · ${fpV(d.title)}** — ${P.rejectedMark}${d.reason ? `: ${fpV(d.reason)}` : ""}`);
  if (scope.length) model.extra.push({ heading: P.outOfScope, lines: scope });
  const openD = fp.decisionOrder.map((fid) => fp.decisions.get(fid)).filter((d) => d.status === "open");
  if (openD.length) {
    model.extra.push({ heading: P.openDecisions, lines: openD.map((d) => fpLine(P.openLine(fpV(d.fid), fpV(d.title), stateOf(d), acsList(d.fid).join(", "), d.openNote ? fpV(d.openNote) : null))) });
    warnings.push(P.wOpen(openD.map((d) => `${fpOneLine(d.fid)} (${stateOf(d)})`).join(", ")));
  }
  const rejected = fp.decisionOrder.map((fid) => fp.decisions.get(fid)).filter((d) => d.status === "ko");
  if (rejected.length) warnings.push(P.wRejected(rejected.map((d) => `${d.fid} → ${dn.get(d.fid)}`).join(", ")));
  if (fp.draft) warnings.push(P.wDraft(fp.draft.pending == null ? "?" : fp.draft.pending, fp.draft.revise == null ? "?" : fp.draft.revise));
  // design.md
  const design = [];
  const section = (heading, lines) => { if (lines.length) design.push(...(design.length ? [""] : []), heading, "", ...lines); };
  const sub = fp.subtitle && first ? [`${L.subtitle}: ${fpV(fp.subtitle)}`] : []; // the subtitle, when the summary is the context's
  const ctxLines = fpProse(ctxRest, false);
  section(P.context, [...sub, ...(sub.length && ctxLines.length ? [""] : []), ...ctxLines, ...(fp.sourceDoc ? [...(sub.length || ctxLines.length ? [""] : []), P.sourceDoc(fpV(fp.sourceDoc))] : [])]);
  // A page no story carries (its tasks state no criterion, or it keeps none): its intro is said here (1.17 F review: dropped).
  const storyPages = new Set([...stories.keys()].filter((k) => k.startsWith("p:")).map((k) => k.slice(2)));
  const themes = [];
  for (const [pid, pg] of fp.pages) if (!storyPages.has(pid) && pg.intro.length) themes.push(...(themes.length ? [""] : []), `### ${fpHead(pg.title)}`, "", ...fpProse(pg.intro, true));
  section(P.themes, themes);
  if (summaryLines.length) section(PP.decisionsHeading, [P.decisionsIntro, "", ...summaryLines]);
  if (tradeRows.length) section(FP_TRADEOFFS_HEADING, [`| ${P.tradeoffsHead.join(" | ")} |`, "|" + P.tradeoffsHead.map(() => "---").join("|") + "|", ...tradeRows]);
  if (!fp.tasks.length && ruleLines.length) section(P.constraints, ruleLines);
  section(P.glossary, fpProse(fp.glossary, false));
  section(P.finalCheck, fpProse(fp.finalCheck, false));
  if (fp.visuals.length) {
    section(P.visuals, fp.visuals.map((v) => `- ${fpV(v.where)}: ${fpV(v.kind)}${fpFilled(v.caption) ? ` — ${fpV(v.caption)}` : ""}`));
    warnings.push(P.wVisuals(fp.visuals.map((v) => `${fpOneLine(v.where)} (${fpOneLine(v.kind)})`).join(", ")));
  }
  for (const x of fp.extra) section(fpHead(x.heading), fpProse(x.lines, false));
  if (design.length) model.design = { text: design.join("\n"), file: "PLAN.md" };
  else warnings.push(PP.wNoDesignLeft);
  model.warnings.push(...warnings);
  return model;
}
// Package A's core design section (1.17): the heading is written in English in every language (its synonym table reads it).
const FP_TRADEOFFS_HEADING = "## Alternatives & Trade-offs";
const C3_PARSERS = { plan: parsePlan, execplan: parseExecPlan, bmad: parseBmad, fluidplan: parseFluidplan };

function importSpec(projectDir, tool, source, opts = {}) {
  // The language of the import's own text (warnings, design.md's Decisions heading…): explicit, else the project's configured one,
  // else — a brand-new project (1.16 C2) — the user's DEV_SPEC_DEFAULT_LANG, spec_create's resolution (configuredLang).
  const lang0 = normalizeLang(opts.lang || configuredLang(projectDir) || projectLang(projectDir));
  const W = i18n.msg(lang0).importSpec;
  // Exact names only — the values spec_import's schema enum allows, so the CLI accepts exactly what MCP does
  // (no aliases, no case folding: 'speckit' / 'Kiro' are refused on both surfaces).
  const t = typeof tool === "string" && own(IMPORT_TOOLS, tool) ? tool : null;
  if (!t) return { ok: false, error: W.unknownTool(tool == null ? "" : tool, Object.keys(IMPORT_TOOLS).join(", ")) };
  // 1.16 C4 — the plan-mode bridge: `text` imports a single-document source (a plan / an ExecPlan) from its markdown, no file
  // needed — Claude Code keeps plans in plansDirectory (~/.claude/plans by default, outside the project), so the plan the user
  // approved is passed as text. Same parser, same mapping, same guarantees; nothing is read from disk for it.
  const C = i18n.msg(lang0).claudeCode.importText;
  const inline = opts.text != null;
  if (inline) {
    if (typeof opts.text !== "string") { const A = i18n.msg(lang0).args; return { ok: false, error: A.invalid(A.item("text", A.type.string, String(JSON.stringify(opts.text)).slice(0, 60))) }; }
    if (!TEXT_IMPORT_TOOLS.includes(t)) return { ok: false, error: C.textOnly(t, TEXT_IMPORT_TOOLS.join(", ")) };
    if (source != null && String(source).trim()) return { ok: false, error: C.pathAndText };
    if (!stripHtmlComments(opts.text).split(BOM_CHAR).join("").trim()) return { ok: false, error: C.empty(IMPORT_TOOLS[t]) };
  } else if (source == null || !String(source).trim()) return { ok: false, error: W.pathRequired + (TEXT_IMPORT_TOOLS.includes(t) ? " " + C.orText : "") };
  const root = path.resolve(projectDir);
  const readWarnings = [];
  let realRoot, realSrc, isFileSrc, dir, rel, read;
  if (inline) {
    try { realRoot = fs.realpathSync.native(root); } catch { realRoot = root; } // a project folder not created yet is fine
    realSrc = path.join(realRoot, t + ".md"); // a virtual file — its stem is the parsers' fallback feature name (the title wins)
    isFileSrc = true;
    dir = realRoot;
    rel = C.label;
    const doc = opts.text.slice(0, IMPORT_MAX_BYTES).replace(new RegExp("^" + BOM_CHAR), "");
    read = (file) => (file === realSrc ? doc : null);
  } else {
    const abs = path.resolve(root, String(source).trim());
    const shown = String(source).trim();
    // Lexical check first (nothing outside the project is even stat'ed), then the real paths (a symlink out). A leading ~ is the
    // home folder (outside), never a folder named "~"; a plan's refusal says where plan mode keeps plans (C3) and that its text
    // can be imported instead (1.16 C4).
    const outside = () => ({ ok: false, error: W.outside(shown) + (t === "plan" ? " " + i18n.msg(lang0).importPlans.plansDir + " " + C.orText : "") });
    if (/^~(?:[\\/]|$)/.test(shown) || !isInsideDir(root, abs)) return outside();
    if (!fs.existsSync(abs)) return { ok: false, error: W.notFound(shown) };
    try { realRoot = fs.realpathSync.native(root); realSrc = fs.realpathSync.native(abs); } catch { return { ok: false, error: W.notFound(shown) }; }
    if (!isInsideDir(realRoot, realSrc)) return outside();
    isFileSrc = !fs.statSync(realSrc).isDirectory();
    dir = isFileSrc ? path.dirname(realSrc) : realSrc;
    rel = toPosix(path.relative(realRoot, dir)) || ".";
    read = (file) => {
      try {
        if (!fs.existsSync(file)) return null;
        const real = fs.realpathSync.native(file);
        if (!isInsideDir(realRoot, real)) { readWarnings.push(W.wUnreadable(toPosix(path.relative(realRoot, file)))); return null; }
        if (!fs.statSync(real).isFile()) return null;
        return fs.readFileSync(real, "utf8").slice(0, IMPORT_MAX_BYTES).replace(/^\uFEFF/, "");
      } catch { return null; }
    };
  } // inline (1.16 C4) or a path
  // C3 parsers also get the file named (a plan among several), the language and the real root: { file, lang, root }.
  const parse = own(C3_PARSERS, t) ? C3_PARSERS[t] : t === "kiro" ? parseKiro : t === "spec-kit" ? parseSpecKit : parseOpenSpec;
  const model = parse(dir, read, W, { file: isFileSrc ? realSrc : null, lang: lang0, root: realRoot, inline }); // inline: no file to name (1.17 F review)
  if (!model) return { ok: false, error: W.nothing(IMPORT_TOOLS[t], rel) };
  if (model.error) return { ok: false, error: model.error }; // C3: a folder of several plans — name the file
  // C3: a single-document source shows its file; inline text (1.16 C4) has none — `source` null, `inline` true.
  const srcRel = inline ? null : model.sourceFile ? toPosix(path.relative(realRoot, model.sourceFile)) : rel;

  // The source's title never opens an HTML comment in the files' titles (1.17 F review); a name the caller gives is theirs. Even in a
  // code span: the name reaches design.md / tasks.md too, whose decision-target reader (blankHtmlComments) sees no code spans.
  const name = opts.name != null && String(opts.name).trim() ? String(opts.name).trim() : model.nameHint == null ? model.nameHint : String(model.nameHint).replace(/<!--/g, "&lt;!--");
  const f = resolveFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  if (fs.existsSync(f.dir)) return { ok: false, error: W.exists(f.slug) };
  const pt = parseTracks(opts.tracks);
  if (pt.unknown.length) return { ok: false, error: unknownTracksError(lang0, pt.unknown) };
  // Tracks: explicit, else classified from the requirements-level text (not design/tasks — "data model" is not +ai).
  const evidence = [model.title, model.summary, ...model.stories.flatMap((s) => [s.title, ...s.prose, ...s.quote, ...s.criteria.map((c) => c.raw)]),
    ...model.extra.flatMap((x) => x.lines)].filter(Boolean).join("\n");
  // Read in the source's own language when it shows one (an English plan imported into a PT project reads "no LLM" as a
  // negation), else in the project's configured language (full review Pb2); an explicit lang wins.
  const cls = classify(evidence, { name, lang: opts.lang, fallbackLang: configuredLang(projectDir) });
  const cr = createFeature(projectDir, name, pt.given ? pt.tracks : cls.tracks, model.summary || undefined, cls, opts.lang);
  if (!cr.ok) return cr;
  const lng = cr.lang;
  const L = i18n.msg(lng).importSpec;
  const warnings = [...readWarnings, ...model.warnings];
  const note = inline ? i18n.msg(lng).claudeCode.importText.note(IMPORT_TOOLS[t], new Date().toISOString().slice(0, 10))
    : L.note(IMPORT_TOOLS[t], srcRel, new Date().toISOString().slice(0, 10));
  const mapping = {};

  // Stories keep their printed numbers when those are unique (spec-kit's [USn] task tags point at them).
  const printed = model.stories.map((s) => s.printed);
  const keepNumbers = printed.every((p) => Number.isInteger(p) && p > 0) && new Set(printed).size === printed.length;
  const acOf = new Map(); // story number → its AC IDs
  const critMap = new Map(); // source criterion key → new AC ID
  const notEars = [];
  const noCriteria = [];
  // Every imported line is written inert to HTML comments (commentInert — the parsers read their sources without comments, so a
  // `<!--` left is an unclosed one): one criterion's `<!--` and a later `-->` (another criterion's, or the `<!-- <tool>: … -->`
  // line under a converted one) hid the criteria between (1.17 F review, every importer). A block of imported lines closes a
  // fence it leaves open (inertBlock) — it swallowed every criterion after it.
  const req = [L.featureTitle(name), "", note, "", L.summary, model.summary ? commentInert(model.summary) : L.summaryPlaceholder, "", L.stories];
  model.stories.forEach((s, idx) => {
    const n = keepNumbers ? s.printed : idx + 1;
    mapping[s.key] = "US-" + n;
    req.push("", L.story(n, s.priority, s.title == null ? s.title : commentInert(s.title)));
    if (s.prose.length) req.push(...inertBlock(s.prose));
    if (s.quote.length) req.push(...s.quote.map((q) => "> " + commentInert(q)));
    req.push("", L.criteria);
    const ids = [];
    s.criteria.forEach((c, j) => {
      const id = `US-${n}.AC-${j + 1}`;
      ids.push(id);
      mapping[c.key] = id;
      critMap.set(c.key, id);
      if (!c.ears) notEars.push(id);
      req.push(`${j + 1}. **${id}** — ${commentInert(c.ears || c.raw + " " + L.notEars)}`);
      if (c.ears && c.ears !== c.raw) req.push("   " + L.original(IMPORT_TOOLS[t], c.raw.replace(/-->/g, "—>")));
    });
    if (!s.criteria.length) { req.push(L.noCriteria); noCriteria.push("US-" + n); }
    if (s.after && s.after.length) req.push("", ...inertBlock(s.after)); // a note after the criteria, a sub-section… verbatim
    acOf.set(n, ids);
  });
  // The recognised sections, then whatever no parser mapped (carried verbatim — never dropped silently).
  for (const x of [...model.extra, ...model.carried]) {
    req.push("", x.heading ? commentInert(x.heading) : L[x.key] || L.importedNotes, ...inertBlock(x.lines.map((l) => l.trimEnd())));
  }
  Object.assign(mapping, model.mapping);
  if (notEars.length) warnings.push(W.wNotEars(notEars.join(", ")));
  if (noCriteria.length) warnings.push(W.wNoCriteria(noCriteria.join(", ")));
  if (model.carried.length) warnings.push(W.wCarried([...new Set(model.carried.map((x) => x.label || L.importedNotes.replace(/^#+\s*/, "")))].join(", ")));

  const written = [];
  const put = (file, content) => { writeFileAtomic(path.join(cr.dir, file), content); if (!written.includes(file)) written.push(file); };
  put("requirements.md", req.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n"); // trimEnd: no /\s*$/ backtracking
  // A source with no criteria at all (an OpenSpec change of proposal.md + tasks.md): requirements.md defines no AC — said
  // once, so no one approves requirements that trace nothing (1.14 full review Pa4).
  if (!requirementAcIds(readIfExists(path.join(cr.dir, "requirements.md")) || "").size) warnings.push(W.wNoCriteriaAtAll);
  // 1.15 track packs (F4 review R8): the import replaced the scaffold's requirements.md — each pack's [MARKER] criteria go back in,
  // after the imported US-1 criteria, as spec_create writes them (a pack's scaffold always has its criteria); its test rows and its
  // task block follow below, citing the IDs the criteria got here.
  const packs = cr.tracks.filter(isPackTrack);
  const packVars = { name, slug: cr.slug };
  const reqFile = path.join(cr.dir, "requirements.md");
  if (packs.length) {
    let rq = readIfExists(reqFile) || "";
    for (const tr of packs) if (!headingHasMarker(rq, trackMarker(tr))) rq = insertPackRequirements(rq, packRequirementsBlock(packOf(tr), lng, rq, packVars));
    put("requirements.md", rq.endsWith("\n") ? rq : rq + "\n");
  }
  const withPackTasks = (text) => {
    let out = text;
    for (const tr of packs) {
      const b = packTaskBlock(packOf(tr), out, readIfExists(reqFile) || "", readIfExists(path.join(cr.dir, "test-plan.md")) || "", lng, packVars);
      if (b) out = out.trimEnd() + "\n" + b;
    }
    return out;
  };
  // createFeature scaffolded the +tdd test plan from the TEMPLATE requirements (the imported ones weren't written yet):
  // its T-01…T-05 rows covered US-1.AC-3 / US-1.AC-4 / US-2.AC-1 the feature doesn't have — "(typos?)" in trace_check,
  // and a doctor FAIL once real tasks were imported. Re-planned from the imported ACs: the plan `spec_add_track tdd`
  // gives this feature (scaffoldTestPlan — one generic row per AC). Scaffold output, not imported text (not in `imported`).
  // A test plan scaffolded from the project's own template (.specs/templates/) is the team's format: kept as it is (1.14).
  if (cr.created.includes("test-plan.md") && !(cr.templates && cr.templates["test-plan.md"])) {
    let plan = scaffoldTestPlan(cr.dir, name, lng, cr.tracks);
    if (packs.length) plan = withTrackBlocks("test-plan", plan, cr.tracks, lng, () => readIfExists(reqFile) || "", { only: packs, vars: packVars }); // + the packs' rows
    writeFileAtomic(path.join(cr.dir, "test-plan.md"), plan);
  }

  if (model.design) {
    const dl = model.design.text.replace(/^\uFEFF/, "").split(/\r?\n/);
    const h1 = dl.findIndex((l) => /^#\s/.test(l));
    const body = (h1 !== -1 && dl.slice(0, h1).every((l) => !l.trim()) ? dl.slice(h1 + 1) : dl).join("\n").trim();
    // The active tracks' mandatory sections, unless the imported design already has them.
    const blocks = cr.tracks.filter((x) => x !== "core").filter((x) => (x === "tdd" ? !RE_TESTABILITY.test(body) : !headingHasMarker(body, trackMarker(x))))
      .map((x) => trackDesignBlock(x, lng, { name, slug: cr.slug })).join("");
    put("design.md", [i18n.msg(lng).tracks.designTitle(name), "", note, "", body, blocks].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n");
  }

  if (model.tasks && model.tasks.numbered) {
    // 1.17 F (fluidplan): the parser numbered its tasks itself — its _Depends:_ name those numbers, its _Requirements:_ the AC IDs
    // the stories above got — so the text is written as it is (importTasks would renumber, and read a title's leading "10 " as an id).
    model.taskKeys.forEach((k, j) => { mapping[k] = "task " + (j + 1); });
    put("tasks.md", withPackTasks([L.tasksTitle(name), "", note, "", model.tasks.text].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n"));
  } else if (model.tasks) {
    // _Requirements:_ references → new AC IDs: a criterion ("1.1"), a whole requirement/story ("2", "Requirement 2",
    // "US2") or an ID that is already dev-spec's. Anything else is kept as written and reported.
    const storyNo = (s) => { const idx = model.stories.findIndex((x) => x.printed === s); return idx === -1 ? null : keepNumbers ? s : idx + 1; };
    const refs = (ref) => {
      if (/^US-\d+\.AC-\d+$/.test(ref) || /^(?:FR|SC|NFR|EC)-\d+$/.test(ref)) return [ref];
      if (t === "kiro" && critMap.has(ref)) return [critMap.get(ref)];
      const whole = ref.match(/^(?:requirement\s+|requisito\s+|user story\s+|US-?)?(\d+)$/i);
      if (whole) { const sn = storyNo(+whole[1]); if (sn != null && acOf.get(sn).length) return acOf.get(sn); }
      return null;
    };
    const tk = importTasks(model.tasks.text, refs, name, lng, W, mapping, warnings);
    // C3: a synthesized task list (plan / ExecPlan / BMAD) — one task per source item, in order: its item → the new task number.
    if (Array.isArray(model.taskKeys) && model.taskKeys.length === tk.count) {
      model.taskKeys.forEach((k, j) => { mapping[k] = "task " + (j + 1); });
      for (const [k, j] of model.taskAliases || []) mapping[k] = "task " + (j + 1); // an ExecPlan step Progress already lists
    }
    put("tasks.md", withPackTasks(tk.text.replace("{{NOTE}}", () => note))); // a function: a '$' in the folder name is not a pattern
    if (!tk.anyRefs && tk.count && acOf.size) warnings.push(W.wNoRefs);
  } else if (cr.created.includes("tasks.md")) {
    // No tasks.md in the source: the scaffold's is kept (wNoTasks) — its template references fitted to the imported spec. A track
    // pack's block is written again (its criteria were renumbered after the imported ones), never fitted.
    const tp = path.join(cr.dir, "tasks.md");
    let cur = readIfExists(tp);
    if (cur != null) {
      const orig = cur;
      if (packs.length) {
        const lines = cur.split("\n");
        const drop = sectionDropLines(lines, (l) => packs.find((tr) => trackTaskHeadingIs(tr, l)));
        if (drop.size) cur = lines.filter((_, i) => !drop.has(i)).join("\n");
      }
      const fitted = withPackTasks(fitTemplateTasks(cur, readIfExists(reqFile) || "", readIfExists(path.join(cr.dir, "test-plan.md")), lng));
      if (fitted !== orig) writeFileAtomic(tp, fitted);
    }
  }
  // 1.17 F (fluidplan): the settled decisions → decisions.md, in spec_decide's format (its header, D-n entries — decisionLog reads
  // them back). An _Affects:_ AC the requirements don't define (none should) is left out rather than written as a phantom.
  if (Array.isArray(model.decisions) && model.decisions.length) {
    const D = i18n.msg(lng).decisions;
    const known = requirementAcIds(readIfExists(reqFile) || "");
    const entries = model.decisions.map((e) => decisionEntryLines({ ...e, affects: e.affects.filter((id) => known.has(id)) }, D).join("\n"));
    put(DECISIONS_FILE, D.header(name) + "\n" + note + "\n\n" + entries.join("\n\n") + "\n");
  }
  // Provenance on the scaffolded classification too (it was generated from the imported text).
  const clsFile = path.join(cr.dir, "classification.md");
  const clsText = readIfExists(clsFile);
  if (clsText != null) put("classification.md", clsText.replace(/^(#\s[^\n]*\n)/, (h1) => `${h1}\n${note}\n`));
  if (model.skipped.length) warnings.push(W.wSkipped(model.skipped.join(", ")));
  maybeRefreshRoadmap(projectDir);
  return {
    ok: true,
    feature: cr.slug,
    dir: cr.dir,
    tool: t,
    toolName: IMPORT_TOOLS[t],
    source: srcRel, // C3: the file, for a single-document source (a plan, an ExecPlan, one BMAD story); else the folder
    ...(inline ? { inline: true } : {}), // 1.16 C4: imported from text (spec_import {text}) — source is null
    ...(cr.userDefaults ? { userDefaults: cr.userDefaults } : {}), // 1.16 C2: the language a new project took from DEV_SPEC_DEFAULT_LANG
    tracks: cr.tracks,
    label: cr.label,
    lang: lng,
    files: cr.created.slice(),
    imported: written,
    mapping,
    warnings,
  };
}

// The names still defined here, for the extracted modules (call time).
engine.link({ IMPORT_TOOLS, IMPORT_MAX_BYTES, TEXT_IMPORT_TOOLS, commentInert, inertOutsideCode, inertBlock, mdHeadings,
  isWs, mdHeadingParts, mdRange, mdBody, markRange, unusedLines, RE_MD_HR, firstParagraph, mdListItems, leftoverExtras,
  trimClause, tidyLines, lcFirst, IRREGULAR_VERBS, baseVerb, earsThen, earsFromClauses, clauseScanner, GWT, gwtMatch,
  earsFromGwt, KIRO_COND, kiroCondMatch, RE_KIRO_REQ_TITLE, RE_KIRO_INTRO, RE_KIRO_REQS, RE_KIRO_STORY_HEAD,
  kiroStoryHeading, earsFromKiro, titleFromStory, wantClause, newImportModel, parseKiro, SPECKIT_GUIDANCE, specKitInput,
  RE_SPECKIT_PRIORITY, specKitStoryHeading, renamedRequirementNames, parseSpecKit, RE_OS_CLAUSE_HEAD, openSpecClause,
  parseOpenSpec, RE_IMPORT_TASK_HEAD, replaceRequirementsMarkers, replaceUnderscoreList, importTasks, fitTemplateTasks,
  RE_PLAN_CHECKBOX_HEAD, planCheckbox, RE_PLAN_ITEM_HEAD, RE_PLAN_ITEM_BOX, planItem, PLAN_FILE_EXT, PLAN_NOT_FILES,
  PLAN_BARE_FILES, planPaths, PLAN_TOKEN_LEAD, PLAN_TOKEN_TRAIL, planTokenTrim, RE_PLAN_RUNNER, RE_PLAN_CHECK,
  planCommand, planCommandOnly, PLAN_COND, earsFromPlanText, planBlocks, checkboxUnits, markUnit, unitProse, unitCode,
  planTaskLines, planDone, planHeadingText, planSections, headingUnit, unusedMarkdown, planFrontMatter, singleDoc,
  markEmptyHeadings, planStory, unwrapDocFence, RE_PLAN_CRITERIA, RE_PLAN_STEPS, RE_PLAN_APPROACH, RE_PLAN_SUMMARY,
  parsePlan, RE_EXEC_SECTION, parseExecPlan, RE_BMAD_STORY_START, bmadStoryHead, RE_PRD_WORDS, bmadPrdTitle,
  RE_BMAD_EPIC_STORY_START, bmadEpicStory, RE_BMAD_FR_HEAD, bmadFrLine, RE_BMAD_FR_HEADING, bmadFrHeading,
  titleAfterDash, boldThenText, RE_BMAD_WORKFLOW, RE_BMAD_PRD_DESIGN, parseBmad, FP_PLAN_ID, FP_ID, FP_OTHER, FP_SEC,
  RE_FP_STATE, FP_LINE_MAX, fpShort, fpMap, FP_TITLE_SUFFIX, fpTitleOf, fpTaskHeading, fpPhaseHeading, fpAcceptanceItem,
  RE_FP_DEC_HEAD, fpDecLine, FP_TASK_FIELDS, FP_DEC_FIELDS, FP_OPS, FP_IMPORTANCE, FP_SRC_LABELS, fpFilled, FP_LS_PS,
  RE_FP_BREAK, RE_FP_BREAKS, RE_FP_LINE_SPLIT, RE_FP_VERIFY_BAD, fpOneLine, fpList, fpStr, RE_FP_MARKER_LIKE, fpInert,
  fpV, fpHead, fpTitle, fpLine, fpProse, fpCell, fpVerdictOfText, fpEdits, fpTextOf, fpHasEdits, fpItemVerdict,
  fpVerdict, fpStatus, fpOptions, fpChoice, fpChoices, fpValue, fpOptionLabel, fpOrderedPhases, fpControlSummary,
  fpDecisionTasks, fpFromPlanJson, fpEmpty, fpNewDecision, RE_FP_TO_CHANGE, fpTableCells, fpHeader, fpFields,
  fpTaskFromMd, fpParsePlanMd, fpParseDecisionsMd, fpConfig, fpPlansDir, fpDocKind, fpSplitDocs, parseFluidplan,
  fpImportModel, FP_TRADEOFFS_HEADING, C3_PARSERS, importSpec });

module.exports = {
  CLI_SWITCHES, // the CLI's boolean switches — ONE list (cli/dev-spec.js BOOL_FLAGS, the approval hook's lexer)
  VALID_TRACKS,
  PHASES,
  resolveProjectDir,
  specsRoot,
  slugify,
  normalizeTracks,
  trackLabel,
  classify,
  initProject,
  scaffoldSteeringFile,
  createFeature: featureLocked(createFeature), // re-run on an EXISTING feature: new tracks via applyTracks (spec_add_track's path), locked like it
  checklistMd,
  integrationPlanMd,
  listFeatures,
  statusFeature,
  nextTask,
  completeTask: featureLocked(completeTask), // read-modify-write of tasks.md + .state.json: under the feature lock (withFeatureLock)
  earsValidate,
  earsFeature,
  traceCheck,
  taskBrief: featureLocked(taskBrief, (a) => !!(a[3] && a[3].write)), // write: .execution/ resolved and written under the lock (a move waits)
  taskBlocks,
  taskMarkers, // a task block's English-stable markers ({ requirements, "makes green", …, verify, expect }) — taskMarkerSpans' reading
  stripHtmlComments, // text minus HTML comments as every reader sees it (code spans and fenced code keep their "<!--")
  globalConstraints,
  taskDependsSpec, // 1.14 F3: a task block's _Depends:_ → { declared, numbers, invalid }
  taskSchedule, // 1.14 F3: task blocks → { next, skipped, blocked } — THE next-task rule (dependencies all done)
  taskWaves, // 1.14 F3: task blocks (+ tracks) → { waves: [[numbers…]…], cycles, blocked } — spec_next_task {waves}
  finishFeature: featureLocked(finishFeature, (a) => !!(a[2] && (a[2].write || a[2].evidence != null))), // write: the drift baseline · evidence (B5): finishChecks — both in .state.json
  parseTasks,
  approvePhase: featureLocked(approvePhase),
  readState,
  manageFeature, // remove / archive / rename / restore move or delete the folder under its lock (withMoveLock), then the roadmap lock
  removeFeature,
  archiveFeature,
  renameFeature,
  addTrack: featureLocked(addTrack),
  nextAction,
  specDoctor,
  phasePercent,
  featurePercent,
  readRoadmap,
  setDependency,
  roadmap,
  backlog,
  BACKLOG_ACTIONS, // the spec_backlog `action` enum (rm and its alias remove)
  renderRoadmapMd,
  writeRoadmapMd,
  renderRoadmapHtml,
  writeRoadmapHtml,
  scanCodebase,
  coverage,
  clarify,
  // language resolution (used by the server, CLI and hooks)
  LANGS: i18n.LANGS, // en · pt · es · pt-BR — the MCP `lang` enum and the CLI --lang values
  canonicalLang: i18n.canonicalLang, // strict: a code or alias (pt_BR, pt-pt…) → its canonical code, else null
  normalizeLang,
  projectLang,
  featureLang,
  msg: i18n.msg,

  resolveTask,
  verificationStatus,
  summarizeRunOutput,
  posixShellSyntax, // `done --run` on Windows: POSIX-only syntax cmd.exe would misread (refused unless --shell)
  windowsShellFailure, // `done --run` on Windows: did cmd.exe itself fail (unknown command / its syntax error)? — the --shell hint
  resolveRunShell, // full review Ga9: `done --run` / `finish --run` — the shell (a bare bash → Git Bash on Windows; WSL's launcher refused)
  isWslLauncher,
  couldNotRunOutput, // full review Ga2 / Ga9: a run's output shows it never exercised the check (WSL relay, spawn error, missing test file…)

  parseTracks,
  detectTracks,
  detectPhase,
  isPlaceholderTask,
  placeholderReport,
  templateBracketKeys,
  templateSets,
  placeholderKey,
  isTemplatePlaceholder,
  artifactState,
  extractSection,
  removeTrack: featureLocked(removeTrack),

  existingFeature, // the eval harness resolves its feature like every other operation

  traceGaps,
  traceGapLines,
  roadmapReport,

  featurePlaceholders, // the gates' placeholder view of one artifact (active part, real line numbers)

  importSpec,
  // 1.16 C — Claude Code integration: the status line, the plan-mode bridge, the user's DEV_SPEC_* defaults (fallbacks)
  statusLine,
  statusLineProject,
  isNetworkPath,
  networkPathInside, // 1.16 verify NEW-3: the guard's (and the save hook's) text-only rule for a network path
  planBridge,
  userDefaults,
  isTestFile,
  implementsTargets,

  appendTasks: featureLocked(appendTasks), // spec_append_tasks / `dev-spec append-tasks` (converge)

  impactReport: featureLocked(impactReport, (a) => !!(a[2] && a[2].reopen === true)), // spec_impact / `dev-spec impact` (change requests: diff vs the approved snapshot, --reopen)
  impactLines,
  metrics: featureLocked(metrics, (a) => !!(a[2] && a[2].write === true)), // spec_metrics / `dev-spec metrics` (+ retro.md with write, under the feature lock)
  metricsLines,

  traceWarningLines, // trace_check warnings (EC/NFR/SC, tests in code) as localized lines — CLI, hook, finish
  scanTestCode, // the bounded walk over test files that trace_check {code: true} reads
  withinRoot, // "inside the project root?" that also holds at a drive root (C:\)

  catalog, // spec_catalog / `dev-spec catalog` (.specs/SPECS.md)
  maybeRefreshCatalog,
  specUpgrade, // spec_upgrade / `dev-spec upgrade [--apply]` / `/spec-upgrade` (audit + safe migrations, .specs/UPGRADE.md)
  specVersionStatus, // roadmap.json meta.specVersion vs the engine — the SessionStart upgrade notice
  engineVersion,
  compareSemver,
  supersedesMarkers,
  supersedesWarnings,
  restoreFeature, // spec_feature restore / `dev-spec feature restore`
  drift, // spec_drift / `dev-spec drift` / SessionStart

  steeringFrontMatter, // scoped steering: Kiro-compatible front matter (inclusion / fileMatchPattern)
  steeringGlobMatch,
  guardEnabled, // guard mode (roadmap.json meta.guard) — hooks/guard-hook.js
  guardCheck,
  designSaveCheck, // the PostToolUse design.md save check
  globFiles, // the files an _Implements:_ glob matches in the project (trace_check / drift baseline)
  withFeatureLock, // the cross-process feature lock the mutators hold (tests drive it with a short waitMs)
  resolveFeature, // MCP resources (mcp/lib/prompts-resources.js): a specs://feature/<slug>/… URI resolves like every name-taking op
  isFeatureFolder, // … and lists only the folders listFeatures would (no _archive, dot folders, steering/)

  OPTIONAL_TRACKS,
  TRACK_MARKER: Object.freeze({ ...TRACK_MARKER }), // the stable [Marker] of each marker track
  // A track's mandatory design sections ([{ name, syn }] — saas / ai / sec / privacy; undefined for core / tdd).
  trackSections: (tr) => (Object.prototype.hasOwnProperty.call(TRACK_SECTIONS, tr) ? TRACK_SECTIONS[tr].map((s) => ({ name: s.name, syn: s.syn.slice() })) : undefined),
  // A track's classifier keywords (copies — the engine's tables stay private): { strong, weak }.
  trackSignals: (tr) => (Object.prototype.hasOwnProperty.call(SIGNALS, tr) ? { strong: SIGNALS[tr].strong.slice(), weak: SIGNALS[tr].weak.slice(), generic: (SIGNALS[tr].generic || []).slice(), context: (SIGNALS[tr].context || []).slice() } : undefined),
  signalConcept: (tr, kw) => (Object.prototype.hasOwnProperty.call(SIGNAL_CONCEPTS, tr) ? SIGNAL_CONCEPTS[tr].get(kw) || null : null), // 1.17 D review

  verifyPipeMasked, // a _Verify:_ command that pipes into another one (its exit code is the LAST command's) — `done --run`'s hint

  templates, // spec_templates / `dev-spec templates [list|init|check]` — the project's own scaffolds in .specs/templates/
  templateKey, // "requirements.md" / "steering/tech" → the template key, or null (the allowlist)
  TEMPLATE_ARTIFACTS,
  trackPacks, // 1.15 — spec_tracks / `dev-spec tracks [list|init <name>|check]`: the project's track packs (.specs/tracks/<name>/)
  PACK_LIMITS, // 1.15 — a track pack's bounds (sizes, counts)

  exportSpecs, // spec_export / `dev-spec export` — the stakeholder document (.specs/exports/, offline HTML or markdown)
  changelog, // spec_changelog / `dev-spec changelog` — release notes from the specs (.specs/RELEASE-NOTES.md + meta.changelogAt)
  markdownToHtml, // the export's zero-dep markdown renderer (every text escaped; links http(s)/mailto only; no images)
  traceMatrix, // 1.14 F5 — the requirements traceability matrix of a feature (trace_check {matrix} / `dev-spec trace --matrix`)
  matrixCsv, // traceMatrix results → RFC 4180 CSV (`trace --csv`; opts.document: + BOM and the AUTO-GENERATED record — spec_export csv)
  csvCell, // one CSV field: quoted when it must be, a leading = + - @ / tab / CR neutralized with an apostrophe
  RTM_STATUSES, // the matrix's row status codes, best first
  earsSteps, // 1.16 E1 — one EARS criterion → its Gherkin steps [{kind: given|when|then, text}] + split (false: one Then, the whole text)
  mdPlainText, // 1.17 verification N3 — markdown inline text → the plain text a reader sees (escapes / entities, outside code spans)
  EXPORT_FORMATS: Object.freeze(EXPORT_FORMATS.slice()), // the spec_export `format` enum (server.js reads it from here)
  TRACKERS: Object.freeze(TRACKERS.slice()), // 1.16 E2 — the tracker CSV formats (export --tracker)
  milestone, // 1.16 E3 — spec_milestone / `dev-spec milestone [add|rm|list]` (roadmap.json meta.milestones)
  MILESTONE_ACTIONS, // the spec_milestone `action` enum (rm and its alias remove)
  MILESTONE_STATUSES: Object.freeze(MILESTONE_STATUSES.slice()), // on-track · at-risk · late · done
  milestoneLine, // one milestone (with its status) as a localized line — CLI

  approvalRolesOf, // roadmap.json meta.approvalRoles, sanitized ({} = single approvals) — team governance (approvals by role)
  parseApprovalRolesText, // `init --roles requirements=product,design=tech+security` → the object spec_init {approvalRoles} takes

  roadmapData, // the ROADMAP.* computation (+ opts.now for the forecasts)
  forecastData, // velocity + per-feature ETA (roadmap() features; opts.now fixes "today")
  featureOverlaps, // cross-feature file overlap pairs (roadmap attention, doctor, SessionStart)
  crossFeatureAcs, // 1.16 Q2: near-duplicate / conflicting acceptance criteria across the active features ({only}: one feature's pairs)
  glossaryEntries, // 1.16 Q3: .specs/steering/glossary.md → { file, entries: [{ term, definition, avoid }] } | null (takes the .specs root)
  steeringFingerprints, // 1.16 Q1: (specsRoot, featureDir, tracks) → { file: fingerprint } of the steering a requirements / design approval records (opts.match: + steeringMatch, the fileMatch files' patterns)
  taskSize, // a task block's _Size:_ (XS|S|M|L|XL) or null
  SIZE_POINTS, // XS=1 S=2 M=3 L=5 XL=8
  etaText, // "2026-10-05 (10-03…10-08)" for a forecast (CLI: cli=true)
  roadmapTailLines, // `dev-spec roadmap`'s velocity / ETA-rule / overlap lines

  expectsFail, // _Expect: fail_ on a task block (spec_task_brief reports it as `expect: "fail"`, which `done --run` reads)
  projectChecks, // roadmap.json meta.checks → {checks: [{name, command}], invalid} — `finish --run` runs them
  parseGitLog, // `git log` text (medium --name-only/--name-status, or --oneline) → commits
  taskCommits, // `dev-spec log <feature>`: the commits citing each task + the +tdd red-first check, from git log TEXT (never runs git)

  stopCheck, // the end-of-turn evidence gate — hooks/stop-hook.js (Stop / SubagentStop) and `dev-spec stop-check`
  stopClaims, // does a message claim the work is done / verified? (EN / PT / ES, conservative) → { claim, admitted, claims }
  stopCheckEnabled, // roadmap.json meta.stopCheck (on unless false)
  guardLevel, // roadmap.json meta.guard → false | true | "scope"
  approvalGuardDecision, // 1.14 F2: the human approval guard's decision for one PreToolUse payload (hooks/approval-hook.js) — pure
  approvalGuardLevel, // roadmap.json meta.approvalGuard → "off" | "ask" | "deny"
  APPROVAL_GUARD_LEVELS: Object.freeze(APPROVAL_GUARD_LEVELS.slice()), // in order, a later one stricter
  STOP_RECENT_HOURS, // the gate's "recently active" window, in hours

  decide: featureLocked(decide), // spec_decide / `dev-spec decide` — append a D-n entry to decisions.md (under the feature lock)
  decisionLog, // decisions.md text → its entries [{ id, n, title, kind, date, at, affects, supersedes, context, decision, consequences, line }]
  affectsWarnings, // trace_check's phantom _Affects:_ references as localized lines (CLI)
  spikeInfo, // a spike folder → { questionFilled, decisionFilled, outcome, question, rationale, timebox, timeboxPassed }

  FLOWS: Object.freeze(FLOWS.slice()), // the phase orders spec_create {flow} / spec_feature {action: "flow"} take (requirements-first = the default)
  featureFlow: (projectDir, name) => { const f = existingFeature(projectDir, name); return f.ok ? featureFlow(f.dir) : null; }, // a feature's flow (null: no such feature)
  planPaths, // the file paths a plan step names (spec_import plan → _Implements:_)

  // 1.14 F1 — harness-observed evidence
  observeRun, // hooks/observe-hook.js: log a Bash run of a _Verify:_ / project-check command (.specs/<f>/.execution/observed.jsonl, .specs/.execution/observed.jsonl)
  observedRun, // was this reported run observed? (latest observed run of the same command, same exit code, recent) → { observed, at? }
  evidenceMode, // roadmap.json meta.evidence → "reported" (default) | "observed"
  OBSERVED_MAX_BYTES, // the log's size bound
};

// Every engine entry point is ONE call with ONE read-cache scope (withReadCache): an MCP tool call, a CLI command, a
// hook step. Inside it each file is read once however many helpers ask (a mutation's gate, its writes and the roadmap /
// catalog refresh after it); the engine's writers keep the cache true (forgetCached / invalidateReadCache) and it is
// dropped when the call returns — never shared between calls. A caller that makes several calls as one step (a hook)
// can wrap them in withReadCache itself.
for (const [name, fn] of Object.entries(module.exports)) {
  if (typeof fn !== "function" || name === "msg") continue;
  const call = function () { return withReadCache(() => fn.apply(this, arguments)); };
  Object.defineProperty(call, "name", { value: fn.name || name });
  module.exports[name] = call;
}
module.exports.withReadCache = withReadCache;
