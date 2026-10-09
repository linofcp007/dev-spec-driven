"use strict";

/**
 * dev-spec-driven engine — the decision log, its ADR export and the spike kind.
 * decisions.md (spec_decide, append-only), the log as MADR files (spec_export {format: "adr"}, 1.25) and spikes
 * (question → investigate → decide).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { BOM_CHAR } = require("./state.js"); // load time
const { TRACE_INFO_FIELDS } = require("./trace.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeTasks, atxHeading, cleanTaskText, dayOf, today, detectPhase, detectTracks, duplicateTaskNumbers, ensureDir,
  existingFeature, extractSection, extractTestIds, featureLang, fenceStep, forcedApprovalList, forgetCached,
  hasProseOutsideBrackets, headingIndex, headingLeadRe, idKey, isBacktickUnit, isObj, isRecord, isWsUnit,
  maybeRefreshRoadmap, mergeConflictsCheck, oneLiner, phaseFile, planIdText, RE_LINE_TERMINATOR, RE_TODO_SENTINEL,
  readIfExists, readJson,
  readState, recordFinishBaseline, replaceHtmlCommentSpans, requirementAcIds, secondaryDefinitions, secondaryIds,
  commitTitle, specsFileContained, specTitle, statePath, stripEnd, stripEnds, stripHtmlComments, taskBlocks,
  taskDepsBlockedNote, taskDepsCheck, taskSchedule, timeOf, tKey, trackLabel, unitIn, waiverExpiredCheck, waiverResult,
  waiverSummaryLines, writeFileAtomic, writeIfAbsent, wsOrUnitIn, criteriaText, CHANGE_FILE, unreadTasksDetail, roadmapGovernanceCheck,
  backtickRuns, EXPORT_DIR, featureDirs, isGeneratedOrAbsent, mdCell, mdPlainText, normalizeLang, projectLang, readContained, readDirCached,
  removeEmptySpecDir, removeSpecFile, shiftHeadings, slugify, specsRoot, specsWriteContained, squeezeBlankLines, stateFromFile, withinRoot;
function __link(E) { ({ activeTasks, atxHeading, cleanTaskText, dayOf, today, detectPhase, detectTracks, duplicateTaskNumbers,
  ensureDir, existingFeature, extractSection, extractTestIds, featureLang, fenceStep, forcedApprovalList, forgetCached,
  hasProseOutsideBrackets, headingIndex, headingLeadRe, idKey, isBacktickUnit, isObj, isRecord, isWsUnit,
  maybeRefreshRoadmap, mergeConflictsCheck, oneLiner, phaseFile, planIdText, RE_LINE_TERMINATOR, RE_TODO_SENTINEL,
  readIfExists, readJson,
  readState, recordFinishBaseline, replaceHtmlCommentSpans, requirementAcIds, secondaryDefinitions, secondaryIds,
  commitTitle, specsFileContained, specTitle, statePath, stripEnd, stripEnds, stripHtmlComments, taskBlocks,
  taskDepsBlockedNote, taskDepsCheck, taskSchedule, timeOf, tKey, trackLabel, unitIn, waiverExpiredCheck, waiverResult,
  waiverSummaryLines, writeFileAtomic, writeIfAbsent, wsOrUnitIn, criteriaText, CHANGE_FILE, unreadTasksDetail, roadmapGovernanceCheck,
  backtickRuns, EXPORT_DIR, featureDirs, isGeneratedOrAbsent, mdCell, mdPlainText, normalizeLang, projectLang, readContained, readDirCached,
  removeEmptySpecDir, removeSpecFile, shiftHeadings, slugify, specsRoot, specsWriteContained, squeezeBlankLines, stateFromFile, withinRoot } = E); }

// ---------------------------------------------------------------------------
// 1.14 C2 — the decision log (.specs/<feature>/decisions.md, spec_decide) · the spike kind (investigate → decide)
// ---------------------------------------------------------------------------
//
// decisions.md is COMMITTED with the spec (the .execution/ ledger is self-ignored scratch): a localized header, then one
// entry per decision or discovery —
//   ## D-<n> — <title>
//   - _Kind: decision | discovery_
//   - _Date: <ISO timestamp>_
//   - _Affects: US-1.AC-2, T-03, <design section>_      (optional)
//   - _Supersedes: D-1_                                 (optional)
//   **Context:** …  **Decision:** (**Discovery:**) …  **Consequences:** …   (localized labels, any EN/PT/ES spelling read)
// The IDs and the four markers are English-stable; the markers are read on the lines between the heading and the first
// label only. spec_decide appends under the feature lock: numbered after the highest D-n, the existing bytes never
// rewritten (a BOM and CRLF line ends are kept — the entry follows the file's line ends). _Affects:_ references are
// validated against the feature when written (an unknown one is an error, nothing written: AC IDs defined in
// requirements.md, T-IDs planned in test-plan.md, EC/NFR/SC IDs written in requirements.md, anything else a section heading
// of design.md — bug.md / design.md for a bugfix, spike.md for a spike) and re-checked by trace_check (phantomAffects,
// warnings) and doctor. A later entry's _Supersedes: D-n_ retires D-n: the brief and doctor's decision-affects-approved skip
// it, the catalog marks it. Readers: spec_task_brief (entries citing the task's ACs / T-IDs, bounded), spec_finish's merge
// summary, spec_export, spec_catalog, spec_doctor, trace_check. HTML comments and fenced code never hold an entry.
const DECISIONS_FILE = "decisions.md";
const DECISION_TITLE_MAX = 200;
const DECISION_TEXT_MAX = 20000;
// A "## D-3 — Title" heading → [line, hashes, number, title] | null — what
// /^(#{2,3})[ \t]+D-(\d{1,6})(?!\d)[ \t]*(?:[—–:-]+[ \t]*)?(.*?)[ \t]*$/ matched; the title is read by a scan (the lazy title
// before [ \t]*$ was quadratic on a long blank run — 1.17 H).
const RE_DECISION_HEAD_START = /^(#{2,3})[ \t]+D-(\d{1,6})(?!\d)/;
const isBlankUnit = (c) => c === " " || c === "\t";
function decisionHead(line) {
  const h = RE_DECISION_HEAD_START.exec(line);
  if (!h) return null;
  let i = h[0].length;
  while (i < line.length && isBlankUnit(line[i])) i++;
  if (i < line.length && "—–:-".includes(line[i])) {
    while (i < line.length && "—–:-".includes(line[i])) i++;
    while (i < line.length && isBlankUnit(line[i])) i++;
  }
  const title = stripEnd(line.slice(i), isBlankUnit);
  return RE_LINE_TERMINATOR.test(title) ? null : [line, h[1], h[2], title];
}
// s.replace(/[ \t]+#+$/, "") — a closing "##" sequence led by blanks.
function stripClosingHashes(s) {
  let h0 = s.length;
  while (h0 > 0 && s[h0 - 1] === "#") h0--;
  let w0 = h0;
  while (w0 > 0 && isBlankUnit(s[w0 - 1])) w0--;
  return h0 < s.length && w0 < h0 ? s.slice(0, w0) : s;
}
// A whole-line `_Label: value_` marker (a list item too) → { label, value } | null — what
// /^\s*(?:[-*+]\s+)?_(Label…):[ \t]*(.*)_\s*$/i matched ($1, $2): `head` reads up to the colon, the value is scanned (the
// pattern's [ \t]*(.*)_ backtracked quadratically on a value with a long blank run and no closing "_" — 1.17 H).
function underscoreMarkerLine(line, head) {
  const h = head.exec(line);
  if (!h) return null;
  let a = h[0].length;
  while (a < line.length && isBlankUnit(line[a])) a++;
  const u = stripEnd(line, isWsUnit).length - 1; // the closing "_": the last unit before trailing whitespace
  if (u < a || line[u] !== "_") return null;
  const value = line.slice(a, u);
  return RE_LINE_TERMINATOR.test(value) ? null : { label: h[1], value };
}
const RE_DECISION_MARKER_HEAD = /^\s*(?:[-*+]\s+)?_(Kind|Date|Affects|Supersedes):/i;
const decisionMarker = (line) => underscoreMarkerLine(line, RE_DECISION_MARKER_HEAD);
const DECISION_LABELS = {
  context: ["context", "contexto"],
  decision: ["decision", "decisão", "decisao", "decisión", "discovery", "descoberta", "descubrimiento"],
  consequences: ["consequences", "consequências", "consequencias", "consecuencias"],
};
const RE_DECISION_LABEL = new RegExp("^\\s*\\*\\*(" + Object.values(DECISION_LABELS).flat().join("|") + "):\\*\\*[ \\t]*(.*)$", "iu");
const BRIEF_DECISIONS_MAX = 5; // entries a brief carries…
const BRIEF_DECISIONS_CHARS = 2000; // …and the characters of their titles + texts (the most recent kept first)
const RE_LEADING_BOM = new RegExp("^" + BOM_CHAR);
// HTML comments blanked line for line (line numbers hold) — /<!--[\s\S]*?-->/g by replaceHtmlCommentSpans (1.17 H).
const blankHtmlComments = (s) => replaceHtmlCommentSpans(String(s || ""), (m) => m.replace(/[^\n]/g, ""));
// An `_Affects:_` value → its pieces: split at "," / ";" OUTSIDE a backtick-quoted span (1.22 review: a section heading holding a
// comma or a semicolon — the size-S "Decisions, reuse & risks", "[API] Pagination, Idempotency & Concurrency" — is written
// `quoted` by decisionEntryLines), each piece trimmed and its backticks stripped. → [{ text, start, end }] (start / end: the
// piece's span in the value, so affectsRefs can rejoin pieces from the value itself). A backtick with no closing one is text.
function affectPieces(v) {
  const s = String(v == null ? "" : v);
  const spans = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "`") { const close = s.indexOf("`", i + 1); if (close !== -1) { i = close; continue; } }
    if (s[i] === "," || s[i] === ";") { spans.push([start, i]); start = i + 1; }
  }
  spans.push([start, s.length]);
  return spans.map(([a, b]) => ({ start: a, end: b, text: cleanRef(s.slice(a, b)) })).filter((p) => p.text);
}
const cleanRef = (s) => stripEnds(String(s).trim(), isBacktickUnit).trim();
const splitRefs = (v) => affectPieces(v).map((p) => p.text);
// 1.22 review — the unquoted form (`decide --affects "Decisions, reuse & risks"`, a hand-written entry): a piece that names nothing
// is joined with the pieces after it (at most AFFECTS_JOIN_MAX, the longest first) when together they name something. texts: the
// pieces; join(i, j) → the text of pieces i..j together; ok(text) → it resolves (resolveAffect). → the references
const AFFECTS_JOIN_MAX = 8;
function rejoinRefs(texts, join, ok) {
  const out = [];
  for (let i = 0; i < texts.length;) {
    let j = -1;
    if (!ok(texts[i])) for (let k = Math.min(texts.length - 1, i + AFFECTS_JOIN_MAX - 1); k > i; k--) if (ok(join(i, k))) { j = k; break; }
    if (j > i) { out.push(join(i, j)); i = j + 1; } else { out.push(texts[i]); i++; }
  }
  return out;
}
// A raw _Affects:_ value (a spec_decide item) → its references, rejoined over the value's own separators.
function affectsRefs(v, ok) {
  const s = String(v == null ? "" : v);
  const p = affectPieces(s);
  return rejoinRefs(p.map((x) => x.text), (i, j) => cleanRef(s.slice(p[i].start, p[j].end)), ok);
}
// A logged entry's references (decisionLog's `affects`), rejoined with ", " (the separator the log no longer holds).
const entryRefs = (refs, t) => rejoinRefs(refs, (i, j) => refs.slice(i, j + 1).join(", "), (r) => resolveAffect(r, t).ok);
// A reference as decisionEntryLines writes it: `quoted` when it holds a separator (its backticks dropped — no key reads them).
const quoteRef = (r) => (/[,;]/.test(r) ? "`" + String(r).replace(/`/g, "") + "`" : r);
const normDecisionId = (s) => { const m = String(s || "").trim().match(/^D-(\d{1,6})$/i); return m ? "D-" + parseInt(m[1], 10) : null; };
function decisionLabelKey(label) {
  const l = String(label).toLowerCase();
  return Object.keys(DECISION_LABELS).find((k) => DECISION_LABELS[k].includes(l)) || "decision";
}

// decisions.md → [{ id, n, title, line, kind, date (the marker's text), at (ms | null), affects: [ref], supersedes: [D-n],
// context, decision, consequences }] in file order. An entry runs to the next heading of its level or above.
function decisionLog(text) {
  const lines = blankHtmlComments(String(text || "").replace(RE_LEADING_BOM, "")).split(/\r?\n/);
  const entries = [];
  const fst = { fence: null };
  let cur = null;
  let seg = "body";
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fenceStep(fst, line)) { if (cur) cur.parts[seg].push(line); continue; }
    const h = decisionHead(line);
    if (h) {
      cur = { id: "D-" + parseInt(h[2], 10), n: parseInt(h[2], 10), level: h[1].length, line: i + 1, title: stripClosingHashes(h[3]).trim(),
        kind: "decision", date: null, affects: [], supersedes: [], parts: { body: [], context: [], decision: [], consequences: [] } };
      entries.push(cur);
      seg = "body";
      seen.clear();
      continue;
    }
    const hl = line.match(/^(#{1,6})\s/);
    if (hl) {
      if (cur && hl[1].length <= cur.level) cur = null;
      else if (cur) cur.parts[seg].push(line);
      continue;
    }
    if (!cur) continue;
    const mk = seg === "body" ? decisionMarker(line) : null;
    if (mk) {
      const key = mk.label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        const v = mk.value.trim();
        if (key === "kind") cur.kind = /^discovery$/i.test(v.replace(/`/g, "").trim()) ? "discovery" : "decision";
        else if (key === "date") cur.date = v.replace(/`/g, "").trim();
        else cur[key] = splitRefs(v);
      }
      continue;
    }
    const lb = line.match(RE_DECISION_LABEL);
    if (lb) { seg = decisionLabelKey(lb[1]); cur.parts[seg].push(lb[2]); continue; }
    cur.parts[seg].push(line);
  }
  const txt = (arr) => arr.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return entries.map(({ parts, level: _l, ...e }) => ({
    ...e,
    at: e.date ? timeOf(e.date) : null,
    supersedes: e.supersedes.map(normDecisionId).filter(Boolean),
    context: txt(parts.context),
    decision: txt(parts.decision) || txt(parts.body),
    consequences: txt(parts.consequences),
  }));
}
// D-n → the later entry that supersedes it.
function retiredDecisions(log) {
  const out = new Map();
  for (const e of log) for (const s of e.supersedes) if (s !== e.id && !out.has(s)) out.set(s, e.id);
  return out;
}

// A heading / an _Affects:_ section reference → its comparison keys: the text folded (case, whitespace, emphasis, a trailing
// ':' / '.') and the same without a leading [Marker] / numbering (headingMatches' RE_HEADING_LEAD) — "Data Model" names
// "## 3. Data Model", "[SaaS] Observability" and "Observability" name "### [SaaS] Observability".
function decisionSectionKeys(text) {
  const base0 = String(text || "").replace(/[*_`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const base = stripEnd(base0, unitIn(":.")).trim(); // /[:.]+$/
  const keys = new Set(base ? [base] : []);
  let t = base;
  const lead = headingLeadRe(); // + the track packs' markers (1.15)
  for (let prev = null; prev !== t;) { prev = t; t = t.replace(lead, "").trim(); }
  if (t) keys.add(t);
  return keys;
}
// What an _Affects:_ reference may name in this feature (see the header comment).
function decisionTargets(dir, kind) {
  const read = (x) => readIfExists(path.join(dir, x)) || "";
  const req = criteriaText(dir) || ""; // a change: its criteria without the task blocks (1.21 review C1)
  // (1.21 verify V7: a change has no design — its own sections, change.md's Summary / Acceptance Criteria / Approach / Tasks)
  const files = kind === "spike" ? [SPIKE_FILE] : kind === "bugfix" ? ["bug.md", "design.md"] : kind === "change" ? [CHANGE_FILE] : ["design.md"];
  const sections = new Map(); // key → { title, file }
  for (const file of files) {
    const lines = blankHtmlComments(read(file)).split(/\r?\n/);
    for (const i of headingIndex(lines)) {
      const m = atxHeading(lines[i], 2, 6, "closing"); // /^#{2,6}\s+(.*?)(?:\s+#+)?\s*$/
      if (!m || !m.text.trim()) continue;
      for (const k of decisionSectionKeys(m.text)) if (!sections.has(k)) sections.set(k, { title: m.text.trim(), file });
    }
  }
  return {
    acs: requirementAcIds(req, dir),
    secondary: secondaryDefinitions(req).all,
    tests: new Set([...extractTestIds(planIdText(read("test-plan.md")))].map((id) => tKey(id.slice(2)))),
    sections,
  };
}
// One reference → { ref (canonical: IDs upper-cased, a section as its heading reads), type: ac | test | secondary | section, ok }.
function resolveAffect(ref, t) {
  const r = String(ref || "").trim();
  let m;
  if ((m = r.match(/^US-(\d+)\.AC-(\d+)$/i))) { const id = `US-${m[1]}.AC-${m[2]}`; return { ref: id, type: "ac", ok: t.acs.has(id) }; }
  if ((m = r.match(/^T-(\d+)$/i))) return { ref: "T-" + m[1], type: "test", ok: t.tests.has(tKey(m[1])) };
  if ((m = r.match(/^(EC|NFR|SC)-(\d+)$/i))) { const p = m[1].toUpperCase(); return { ref: p + "-" + m[2], type: "secondary", ok: t.secondary.has(idKey(p, m[2])) }; }
  const hit = [...decisionSectionKeys(r)].map((k) => t.sections.get(k)).find(Boolean);
  return hit ? { ref: hit.title, type: "section", ok: true, file: hit.file } : { ref: r, type: "section", ok: false };
}

// A line without its trailing spaces / tabs — a scan, not /[ \t]+$/ (quadratic on a long run of blanks inside the line; 1.17 F).
function trimBlanksEnd(l) {
  let e = l.length;
  while (e > 0 && (l[e - 1] === " " || l[e - 1] === "\t")) e--;
  return e === l.length ? l : l.slice(0, e);
}
// User text written into a spec file (a decision's paragraphs, a spike's question): a line that would read as a heading, an
// entry marker or a label is escaped, an HTML comment opener neutralized, an unclosed code fence closed — nothing a caller
// writes can hide or fake the entries after it.
function safeSpecText(s) {
  const st = { fence: null };
  const out = String(s).replace(/\r\n?/g, "\n").replace(/<!--/g, "&lt;!--").split("\n").map(trimBlanksEnd).map((l) => {
    if (fenceStep(st, l)) return l;
    if (/^\s{0,3}#{1,6}(?:\s|$)/.test(l)) return l.replace("#", "\\#");
    if (decisionMarker(l) || outcomeMarker(l)) return l.replace("_", "\\_");
    if (RE_DECISION_LABEL.test(l)) return l.replace("**", "\\*\\*");
    return l;
  });
  if (st.fence) out.push(" ".repeat(st.fence.indent) + st.fence.mark);
  return stripEnds(out.join("\n"), unitIn("\n")); // /^\n+|\n+$/g
}

// `raw` (a spec file's text) with `addition` appended — THE append of every spec writer (1.23 review 5: spec_decide's entry,
// spec_add_track's mandatory sections and task block, the covered sections a track removal restores, the importer's design body +
// track blocks). A code block `raw` leaves open at its end (a snippet pasted by hand) is closed first, by appending its closer —
// nothing is rewritten: whatever followed it was code to every reader (the decision entry was written unreadable and its D-n
// handed out again; add_track's sections read 'missing' right after it said it added them, and a second add wrote them twice). A
// fence opened inside a list item (indented) needs no closer: the appended text at the margin ends it. `addition` (written with
// "\n") follows in raw's line ends (CRLF kept).
//   default     raw's bytes kept (a BOM, a missing final newline) and a blank line before `addition` (decisions.md's entries);
//   opts.trim   raw's trailing blanks dropped, then opts.join (default "\n") — the scaffold writers' join (`text.trimEnd() + "\n" + block`).
function appendSpecText(raw, addition, opts = {}) {
  const text = String(raw == null ? "" : raw);
  const eol = /\r\n/.test(text) ? "\r\n" : "\n";
  const add = String(addition == null ? "" : addition).replace(/\r?\n/g, eol);
  const base = opts.trim ? text.trimEnd() : text;
  const fst = { fence: null };
  for (const l of blankHtmlComments(base.replace(RE_LEADING_BOM, "")).split(/\r?\n/)) fenceStep(fst, l);
  const closer = fst.fence && !(fst.fence.indent > 0) ? fst.fence.mark : null;
  if (opts.trim) return base + (closer ? eol + closer : "") + String(opts.join == null ? "\n" : opts.join).replace(/\r?\n/g, eol) + add;
  const body = closer ? base + (/\n$/.test(base) ? "" : eol) + closer + eol : base;
  const sep = /(?:^|\n)[ \t]*\r?\n$/.test(body) ? "" : /\n$/.test(body) ? eol : eol + eol;
  return body + sep + add;
}

// spec_decide input → { title, decision, context, consequences, kind, affects, supersedes } | { error }.
function decisionInput(input, D) {
  const o = isObj(input) ? input : {};
  const str = (k, max, required, errRequired) => {
    const v = o[k];
    if (v == null || (typeof v === "string" && !v.trim())) return required ? { error: errRequired } : { value: null };
    if (typeof v !== "string") return { error: D.badText(k) };
    if (v.length > max) return { error: D.tooLong(k, max) };
    return { value: v };
  };
  const title = str("title", DECISION_TITLE_MAX * 4, true, D.titleRequired);
  if (title.error) return title;
  const t1 = title.value.replace(/\s+/g, " ").trim().replace(/<!--/g, "&lt;!--");
  if (t1.length > DECISION_TITLE_MAX) return { error: D.tooLong("title", DECISION_TITLE_MAX) };
  const decision = str("decision", DECISION_TEXT_MAX, true, D.decisionRequired);
  if (decision.error) return decision;
  const context = str("context", DECISION_TEXT_MAX, false);
  if (context.error) return context;
  const consequences = str("consequences", DECISION_TEXT_MAX, false);
  if (consequences.error) return consequences;
  let kind = "decision";
  if (o.kind != null) {
    const k = typeof o.kind === "string" ? o.kind.trim().toLowerCase() : null;
    if (k !== "decision" && k !== "discovery") return { error: D.badKind(JSON.stringify(o.kind)) };
    kind = k;
  }
  const list = (k) => {
    const v = o[k];
    if (v == null) return { value: [], items: [] };
    const items = Array.isArray(v) ? v : [v];
    if (items.some((x) => typeof x !== "string")) return { error: D.badText(k) };
    return { value: [...new Set(items.flatMap(splitRefs))], items };
  };
  const affects = list("affects");
  if (affects.error) return affects;
  const supersedes = list("supersedes");
  if (supersedes.error) return supersedes;
  // affectItems: the raw values — decide() rejoins their pieces against the feature's sections (affectsRefs)
  return { title: t1, decision: decision.value, context: context.value, consequences: consequences.value, kind, affects: affects.value, affectItems: affects.items,
    supersedes: supersedes.value };
}
// One entry's lines (no line ends).
function decisionEntryLines(e, D) {
  const para = (label, text) => {
    if (!text) return [];
    const body = safeSpecText(text);
    return body ? ["", `**${label}:** ` + body] : [];
  };
  return [
    `## ${e.id} — ${e.title}`,
    "",
    `- _Kind: ${e.kind}_`,
    `- _Date: ${e.at}_`,
    ...(e.affects.length ? [`- _Affects: ${e.affects.map(quoteRef).join(", ")}_`] : []), // 1.22 review: a heading with a "," / ";" quoted
    ...(e.supersedes.length ? [`- _Supersedes: ${e.supersedes.join(", ")}_`] : []),
    ...para(D.labels.context, e.context),
    ...para(e.kind === "discovery" ? D.labels.discovery : D.labels.decision, e.decision),
    ...para(D.labels.consequences, e.consequences),
  ].join("\n").split("\n");
}

// spec_decide {name, title, decision, context?, consequences?, affects?, supersedes?, kind?} / `dev-spec decide`: append one
// entry to decisions.md (created with its localized header when absent). Under the feature lock (featureLocked).
function decide(projectDir, name, input) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const { slug, dir } = f;
  const lng = featureLang(projectDir, slug);
  const D = i18n.msg(lng).decisions;
  const st = readState(projectDir, slug);
  if (st.invalid) return { ok: false, error: st.invalid };
  const kind = st.kind || "feature";
  const inp = decisionInput(input, D);
  if (inp.error) return { ok: false, error: inp.error };
  const file = path.join(dir, DECISIONS_FILE);
  if (!specsFileContained(projectDir, file)) return { ok: false, error: D.unsafeFile(".specs/" + slug + "/" + DECISIONS_FILE) };
  const raw = readIfExists(file);
  const log = decisionLog(raw || "");
  const known = new Set(log.map((e) => e.id));
  const sup = inp.supersedes.map((s) => ({ s, id: normDecisionId(s) }));
  const badSup = sup.filter((x) => !x.id || !known.has(x.id)).map((x) => x.s);
  if (badSup.length) return { ok: false, unknownSupersedes: badSup, error: D.badSupersedes(badSup.join(", ")) };
  const targets = decisionTargets(dir, kind);
  // 1.22 review: each value's pieces, rejoined where together they name a heading (an unquoted "Decisions, reuse & risks")
  const okRef = (r) => resolveAffect(r, targets).ok;
  const refs = [...new Set(inp.affectItems.flatMap((v) => affectsRefs(v, okRef)))];
  const resolved = refs.map((r) => resolveAffect(r, targets));
  const unknown = resolved.filter((r) => !r.ok).map((r) => r.ref);
  if (unknown.length) return { ok: false, unknownAffects: unknown, error: (kind === "change" ? D.badAffectsChange : D.badAffects)(unknown.join(", ")) };
  const n = Math.max(0, ...log.map((e) => e.n)) + 1;
  const entry = { id: "D-" + n, title: inp.title, kind: inp.kind, at: new Date().toISOString(), affects: [...new Set(resolved.map((r) => r.ref))],
    supersedes: [...new Set(sup.map((x) => x.id))], context: inp.context, decision: inp.decision, consequences: inp.consequences };
  const lines = decisionEntryLines(entry, D);
  let out;
  if (raw == null) {
    const title = specTitle(readIfExists(path.join(dir, "requirements.md")) || readIfExists(path.join(dir, SPIKE_FILE)) || readIfExists(path.join(dir, "bug.md")) || "", slug);
    out = D.header(title) + "\n" + lines.join("\n") + "\n";
  } else {
    // Append only: the file's bytes stay as they are (BOM, line ends, a missing final newline) — the entry follows its line ends,
    // after a code block left open at the end is closed (appendSpecText — it was written unreadable, and its number handed out again).
    out = appendSpecText(raw, lines.join("\n") + "\n");
  }
  writeFileAtomic(file, out);
  maybeRefreshRoadmap(projectDir); // + SPECS.md once it exists (the catalog lists the decisions)
  const rel = ".specs/" + slug + "/" + DECISIONS_FILE;
  return { ok: true, feature: slug, id: entry.id, n, kind: entry.kind, title: entry.title, affects: entry.affects, supersedes: entry.supersedes, at: entry.at,
    file: rel, created: raw == null, message: D.recorded(entry.id, D.kinds[entry.kind] || entry.kind, rel) };
}

// trace_check's part: every _Affects:_ reference that names nothing in the feature now — warnings, never a gap.
function decisionsTrace(dir, kind) {
  const raw = readIfExists(path.join(dir, DECISIONS_FILE));
  if (raw == null) return { phantomAffects: [] };
  const t = decisionTargets(dir, kind);
  const out = [];
  for (const e of decisionLog(raw)) for (const r of entryRefs(e.affects, t)) if (!resolveAffect(r, t).ok) out.push({ decision: e.id, ref: r, line: e.line });
  return { phantomAffects: out };
}
TRACE_INFO_FIELDS.add("phantomAffects"); // informational, so traceGaps never lists them as gaps
// Localized "⚠" lines for a trace_check result's phantom _Affects:_ references (CLI).
function affectsWarnings(tr, lang) {
  const D = i18n.msg(lang).decisions;
  return (tr && Array.isArray(tr.phantomAffects) ? tr.phantomAffects : []).map((p) => D.phantom(p.decision, p.ref));
}

// Doctor (warns): `decision-affects` — phantom _Affects:_ references; `decision-affects-approved` — a current decision recorded
// AFTER the approval of requirements.md (it names its AC / EC / NFR / SC IDs) or of the design (its sections; a bugfix's
// design approval signs off bug.md) — the approved spec may no longer say what was decided: re-review (spec_impact), re-approve.
function decisionDoctorChecks(projectDir, slug, dir, state, kind, lng, tr) {
  const raw = readIfExists(path.join(dir, DECISIONS_FILE));
  if (raw == null) return [];
  const D = i18n.msg(lng).decisions;
  const out = [];
  const phantom = tr && Array.isArray(tr.phantomAffects) ? tr.phantomAffects : decisionsTrace(dir, kind).phantomAffects;
  if (phantom.length) out.push({ id: "decision-affects", status: "warn", detail: D.phantomDoctor(phantom.map((p) => p.decision + " → " + p.ref).join(", ")) });
  if (kind === "spike") return out;
  const log = decisionLog(raw);
  const retired = retiredDecisions(log);
  const t = decisionTargets(dir, kind);
  const approvals = isObj(state && state.approvals) ? state.approvals : {};
  const approvedAt = (ph) => (isRecord(approvals[ph]) ? timeOf(approvals[ph].at) : null);
  const rq = approvedAt("requirements");
  const ds = approvedAt("design");
  const hits = [];
  const phases = [];
  for (const e of log) {
    if (retired.has(e.id) || e.at == null) continue;
    const res = entryRefs(e.affects, t).map((r) => resolveAffect(r, t)).filter((r) => r.ok);
    const reqRefs = res.filter((r) => r.type === "ac" || r.type === "secondary").map((r) => r.ref);
    const desRefs = res.filter((r) => r.type === "section").map((r) => r.ref);
    if (reqRefs.length && rq != null && e.at > rq) {
      hits.push(D.affectsApprovedEntry(e.id, reqRefs.join(", "), "requirements.md", dayOf(rq)));
      if (!phases.includes("requirements")) phases.push("requirements");
    }
    if (desRefs.length && ds != null && e.at > ds) {
      hits.push(D.affectsApprovedEntry(e.id, desRefs.join(", "), phaseFile("design", kind), dayOf(ds)));
      if (!phases.includes("design")) phases.push("design");
    }
  }
  if (hits.length) out.push({ id: "decision-affects-approved", status: "warn", detail: D.affectsApproved(hits.join("; "), slug, phases.join(" | ")) });
  return out;
}

// spec_task_brief: the current entries citing the task's AC IDs, T-IDs (T-3 = T-03) or EC / NFR / SC IDs — at most
// BRIEF_DECISIONS_MAX, within BRIEF_DECISIONS_CHARS (the most recent kept first), shown in log order; the rest named.
function briefDecisions(dir, acIds, testIds, blockText) {
  const raw = readIfExists(path.join(dir, DECISIONS_FILE));
  if (raw == null) return { items: [], omitted: [] };
  const log = decisionLog(raw);
  const retired = retiredDecisions(log);
  const acs = new Set(acIds);
  const tests = new Set(testIds.map((id) => tKey(id.slice(2))));
  const sec = secondaryIds(blockText);
  const cites = (r) => {
    if (acs.has(r)) return true;
    let m;
    if ((m = r.match(/^T-(\d+)$/i))) return tests.has(tKey(m[1]));
    if ((m = r.match(/^(EC|NFR|SC)-(\d+)$/i))) return sec.has(idKey(m[1].toUpperCase(), m[2]));
    return false;
  };
  const hits = log.filter((e) => !retired.has(e.id) && e.affects.some(cites));
  const kept = [];
  let budget = BRIEF_DECISIONS_CHARS;
  for (const e of hits.slice().reverse()) {
    const text = oneLiner(e.decision, 400) || "";
    const cost = e.title.length + text.length;
    if (kept.length >= BRIEF_DECISIONS_MAX || cost > budget) continue;
    budget -= cost;
    kept.push({ id: e.id, n: e.n, title: e.title, kind: e.kind, affects: e.affects, supersedes: e.supersedes, text });
  }
  kept.sort((a, b) => a.n - b.n);
  const ids = new Set(kept.map((k) => k.id));
  return { items: kept.map(({ n: _n, ...k }) => k), omitted: hits.filter((e) => !ids.has(e.id)).map((e) => e.id) };
}

// spec_finish's merge summary: "## Decisions" + one line per entry (superseded ones struck through), or [] without a log.
function decisionSummaryLines(dir, lang) {
  const raw = readIfExists(path.join(dir, DECISIONS_FILE));
  if (raw == null) return [];
  const log = decisionLog(raw);
  if (!log.length) return [];
  const D = i18n.msg(lang).decisions;
  const retired = retiredDecisions(log);
  return [D.prHeading, ...log.map((e) => {
    const head = `**${e.id}** — ${e.title}`;
    const meta = [D.kinds[e.kind] || e.kind, e.affects.join(", "), e.supersedes.length ? D.supersedesNote(e.supersedes.join(", ")) : ""].filter(Boolean).join(" · ");
    const text = oneLiner(e.decision, 300);
    return retired.has(e.id) ? `- ~~${head}~~ _(${D.superseded}: ${retired.get(e.id)})_` : `- ${head} _(${meta})_` + (text ? ": " + text : "");
  })];
}
// spec_catalog: { count, items: [{ id, title, kind, superseded? }] }.
function catalogDecisions(dir) {
  const log = decisionLog(readIfExists(path.join(dir, DECISIONS_FILE)) || "");
  const retired = retiredDecisions(log);
  return { count: log.length, items: log.map((e) => Object.assign({ id: e.id, title: e.title, kind: e.kind }, retired.has(e.id) ? { supersededBy: retired.get(e.id) } : {})) };
}

// ---------------------------------------------------------------------------
// 1.25 — the decision log as Architecture Decision Records: spec_export {format: "adr"} · `dev-spec export [feature] --adr [--write]`
// ---------------------------------------------------------------------------
// One MADR file per DECISION (https://adr.github.io/madr/ — 4.0's front matter `status` / `date`, then the title, Context and
// Problem Statement, Decision Outcome with its Consequences, More Information), holding only the sections the log has text
// for: the log records no options, drivers or pros and cons, so those sections are never written (nothing is invented).
// LAYOUT: .specs/exports/adr/<feature>/NNNN-<kebab-title>.md + <feature>/index.md (an archived feature: adr/_archive/<slug>/);
// the project export (no name) writes every feature's — archived ones too: an ADR log is history — and adr/index.md.
// NUMBERING — per feature, the ADR number IS the decision's D-number (D-3 → 0003, ≥ 4 digits). The log is append-only and
// numbers after its highest D-n, so a number never moves: a new decision takes the next one, a removed or left-out one leaves a
// gap, nothing is renumbered (a sequence across features would shift with every removed feature and every merge of interleaved
// dates). The name's title part is the title slugged (ASCII, ≤ ADR_SLUG_MAX; "decision" when nothing is left).
// STATUS — front matter in MADR's own English words (machine-read, every language): accepted | superseded by ADR-NNNN (the
// first later entry naming it in _Supersedes:_, retiredDecisions; "superseded" alone when that entry is no ADR); the visible
// line is localized and links the newer ADR, which says "Supersedes ADR-NNNN" back.
// DISCOVERIES (_Kind: discovery_ — a fact learnt, not a choice made) are no ADR: left out, named in the feature's index and in
// the result's `excluded` (reason "discovery"); a supersession naming one links the decision log. A D-n written twice: the
// first is exported (`excluded` reason "duplicate-id"); a decisions.md that is a link out of .specs/ is never read ("unsafe-file").
// LINKS BACK (relative — they work in any clone): the feature folder, its decisions.md, every _Affects:_ reference to the file
// that defines it (AC / EC / NFR / SC → requirements.md — a change: change.md —, T-ID → test-plan.md, a section → its file).
// USER TEXT stays markdown, made inert where it sits in OUR structure: a link label's [ ] escaped (adrLabel), a table cell's |
// (mdCell), a comment opener neutralized (it hid the rest of the file), a code fence a paragraph leaves open closed, its
// headings moved below the section's (shiftHeadings); the front matter and the AUTO-GENERATED comment hold no user text, and no
// file holds the date of the run — a re-run is byte-identical.
// WRITE — all-or-nothing through the write gate: a linked adr folder / target, or a same-named file without the AUTO-GENERATED
// marker (hand-written), refuses the whole export (nothing written); an unchanged file (line ends aside) is left alone; then
// the scope's GENERATED ADR / index files no decision backs any more are removed (a decision removed from the log, a retitled
// one, a removed / renamed / archived feature — project export), never a hand-written file nor a link, and the folders that
// leaves empty. A feature export touches its own folder only (adr/index.md is the project export's).
const ADR_DIR = "adr";
const ADR_INDEX = "index.md";
const ADR_SLUG_MAX = 60;
const RE_ADR_NAME = /^\d{4,}-[a-z0-9-]*\.md$/; // a generated ADR's file name — with index.md, the only names the stale sweep weighs
const adrNumber = (n) => String(n).padStart(4, "0");
function adrFileName(n, title) {
  const s = slugify(mdPlainText(title)).slice(0, ADR_SLUG_MAX).replace(/-+$/, "");
  return adrNumber(n) + "-" + (s || "decision") + ".md";
}
const adrInert = (s) => String(s == null ? "" : s).replace(/<!--/g, "&lt;!--");
// A link label: [ and ] escaped — outside code spans (backtickRuns, read left to right), a backslash escape already there kept
// whole, a trailing lone backslash doubled (it would escape the closing bracket).
function adrLabel(s) {
  const t = adrInert(s).replace(/\s+/g, " ").trim();
  const ticks = t.includes("`") ? backtickRuns(t) : null;
  let out = "";
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "`" && ticks) { const e = ticks.spanEnd(i); out += t.slice(i, e); i = e - 1; continue; }
    if (c === "\\") { out += i + 1 < t.length ? c + t[++i] : "\\\\"; continue; }
    out += c === "[" || c === "]" ? "\\" + c : c;
  }
  return out;
}
// A paragraph of the log under a heading of `level`: a code fence it leaves open closed, its own headings one level below.
function adrBlock(text, level) {
  let t = adrInert(text).trim();
  if (!t) return "";
  const st = { fence: null };
  for (const l of t.split("\n")) fenceStep(st, l);
  if (st.fence) t += "\n" + " ".repeat(st.fence.indent || 0) + st.fence.mark;
  return squeezeBlankLines(shiftHeadings(t, level + 1)).trim();
}
const posixRel = (from, to) => path.relative(from, to).split(path.sep).join("/") || ".";

// One feature's decision log → its ADR model { feature, archived, rel, lang, title, outDir, toFeature, kind, byId, adrs, excluded }.
function adrModel(projectDir, f, archived) {
  const { slug, dir } = f;
  const st = stateFromFile(projectDir, statePath(dir));
  const kind = st.kind || "feature";
  const lang = normalizeLang(st.lang || projectLang(projectDir));
  const rel = (archived ? "_archive/" : "") + slug;
  const outDir = path.join(specsRoot(projectDir), EXPORT_DIR, ADR_DIR, ...rel.split("/"));
  const read = (n) => readContained(projectDir, path.join(dir, n));
  const m = { feature: slug, archived: !!archived, rel, lang, kind, outDir, toFeature: posixRel(outDir, dir), byId: new Map(), adrs: [], excluded: [],
    title: specTitle(read("requirements.md") || read(SPIKE_FILE) || read("bug.md") || "", slug) };
  const file = path.join(dir, DECISIONS_FILE);
  const raw = read(DECISIONS_FILE);
  if (raw == null) {
    if (fs.existsSync(file)) m.excluded.push({ feature: slug, reason: "unsafe-file" });
    return m;
  }
  const log = decisionLog(raw);
  const retired = retiredDecisions(log);
  let targets = null;
  for (const e of log) {
    if (m.byId.has(e.id)) { m.excluded.push({ feature: slug, id: e.id, title: e.title, reason: "duplicate-id" }); continue; }
    const x = { id: e.id, n: e.n, title: e.title || e.id, date: dayOf(e.at) || null,
      supersedes: e.supersedes.filter((s) => s !== e.id), supersededBy: retired.get(e.id) || null, entry: e, file: null };
    m.byId.set(e.id, x);
    if (e.kind === "discovery") { m.excluded.push({ feature: slug, id: e.id, title: e.title, reason: "discovery" }); continue; }
    x.file = adrFileName(e.n, x.title);
    if (e.affects.length && !targets) targets = decisionTargets(dir, kind);
    x.affects = e.affects.length ? entryRefs(e.affects, targets).map((r) => {
      const t = resolveAffect(r, targets);
      if (!t.ok) return { ref: r };
      const file = t.type === "test" ? "test-plan.md" : t.type === "section" ? t.file : kind === "change" ? CHANGE_FILE : "requirements.md";
      return { ref: r, file };
    }) : [];
    m.adrs.push(x);
  }
  m.adrs.sort((a, b) => a.n - b.n);
  return m;
}
// D-n as a link from `base` (a folder inside adr/, relative to the feature's folder): its ADR, else the log (a discovery), else text.
function adrRef(m, id, base) {
  const x = m.byId.get(id);
  if (x && x.file) return `[ADR-${adrNumber(x.n)}](${path.posix.join(base, x.file)})`;
  return x ? `[${id}](${path.posix.join(base, m.toFeature, DECISIONS_FILE)})` : id;
}
function adrStatusText(m, x, A, base) {
  return x.supersededBy ? A.supersededBy(adrRef(m, x.supersededBy, base)) : A.accepted;
}
// A feature model → its documents [{ file, type: "adr" | "index", … content }] (none without an ADR).
function adrDocs(m) {
  const A = i18n.msg(m.lang).adr;
  if (!m.adrs.length) return [];
  const feature = `[${adrLabel(m.title)}](${m.toFeature}/) · \`.specs/${m.rel}/\``;
  const docs = m.adrs.map((x) => {
    const e = x.entry;
    const by = x.supersededBy ? m.byId.get(x.supersededBy) : null;
    const fm = by && by.file ? "superseded by ADR-" + adrNumber(by.n) : x.supersededBy ? "superseded" : "accepted";
    const lines = ["---", "status: " + fm, ...(x.date ? ["date: " + x.date] : []), "---", "", `<!-- ${A.autogen} -->`, "", "# " + adrLabel(x.title), "",
      `- **${A.labels.status}:** ${adrStatusText(m, x, A, ".")}`, ...(x.date ? [`- **${A.labels.date}:** ${x.date}`] : []),
      ...(x.supersedes.length ? [`- **${A.labels.supersedes}:** ${x.supersedes.map((s) => adrRef(m, s, ".")).join(", ")}`] : [])];
    const ctx = adrBlock(e.context, 2);
    const dec = adrBlock(e.decision, 2);
    const cons = adrBlock(e.consequences, 3);
    if (ctx) lines.push("", "## " + A.h.context, "", ctx);
    if (dec || cons) {
      lines.push("", "## " + A.h.outcome);
      if (dec) lines.push("", dec);
      if (cons) lines.push("", "### " + A.h.consequences, "", cons);
    }
    const refs = x.affects.map((a) => (a.file ? `[${adrLabel(a.ref)}](${m.toFeature}/${a.file})` : adrLabel(a.ref)));
    lines.push("", "## " + A.h.more, "", `- **${A.labels.feature}:** ${feature}`, `- **${A.labels.entry}:** [${x.id}](${m.toFeature}/${DECISIONS_FILE})`,
      ...(refs.length ? [`- **${A.labels.affects}:** ${refs.join(", ")}`] : []));
    return { file: path.join(m.outDir, x.file), type: "adr", feature: m.feature, ...(m.archived ? { archived: true } : {}), id: x.id, number: adrNumber(x.n),
      title: x.title, status: x.supersededBy ? "superseded" : "accepted", ...(x.supersededBy ? { supersededBy: x.supersededBy } : {}), supersedes: x.supersedes,
      date: x.date, lang: m.lang, content: lines.join("\n") + "\n" };
  });
  const head = (cols) => `| ${cols.join(" | ")} |\n|${cols.map(() => "---").join("|")}|`;
  const rows = m.adrs.map((x) => `| [${adrNumber(x.n)}](${x.file}) | ${mdCell(adrLabel(x.title))} | ${mdCell(adrStatusText(m, x, A, "."))} | ${x.date || "—"} |`);
  const disc = m.excluded.filter((z) => z.reason === "discovery").map((z) => z.id + (z.title ? " — " + adrInert(z.title).replace(/\s+/g, " ").trim() : ""));
  const dup = [...new Set(m.excluded.filter((z) => z.reason === "duplicate-id").map((z) => z.id))];
  const intro = A.indexIntro(`[${adrLabel(m.title)}](${m.toFeature}/) (\`.specs/${m.rel}/\`)`, `${m.toFeature}/${DECISIONS_FILE}`);
  const index = [`<!-- ${A.autogen} -->`, "", "# " + A.indexTitle(adrLabel(m.title)), "", intro, "", head(A.cols), ...rows,
    ...(disc.length ? ["", A.discoveries(disc.join("; "))] : []), ...(dup.length ? ["", A.duplicates(dup.join(", "))] : [])];
  docs.push({ file: path.join(m.outDir, ADR_INDEX), type: "index", feature: m.feature, ...(m.archived ? { archived: true } : {}), lang: m.lang, content: index.join("\n") + "\n" });
  return docs;
}
// The project's adr/index.md (project language): one row per ADR, every feature's.
function adrProjectIndex(projectDir, models, lang, adrRoot) {
  const A = i18n.msg(lang).adr;
  const head = (cols) => `| ${cols.join(" | ")} |\n|${cols.map(() => "---").join("|")}|`;
  const rows = [];
  for (const m of models) {
    const feature = mdCell(`[${adrLabel(m.title)}](${m.rel}/${ADR_INDEX})` + (m.archived ? ` _(${A.archived})_` : ""));
    for (const x of m.adrs) {
      rows.push(`| ${feature} | [${adrNumber(x.n)}](${m.rel}/${x.file}) | ${mdCell(adrLabel(x.title))} | ${mdCell(adrStatusText(m, x, A, m.rel))} | ${x.date || "—"} |`);
    }
  }
  const md = [`<!-- ${A.autogen} -->`, "", "# " + A.indexTitle(adrLabel(path.basename(path.resolve(projectDir)))), "", A.projectIntro, "", head(A.projectCols), ...rows];
  return { file: path.join(adrRoot, ADR_INDEX), type: "index", lang, content: md.join("\n") + "\n" };
}
// The generated files under `scopeDir` a write would remove: an ADR-named or index.md regular file carrying the AUTO-GENERATED
// marker that the export no longer produces — in the feature's folder, or (project) adr/, its feature folders and
// adr/_archive/'s. A link is never entered nor listed; a scope reached through a link is not read at all.
function adrStaleFiles(projectDir, scopeDir, project, produced) {
  if (!specsWriteContained(projectDir, scopeDir)) return [];
  const out = [];
  const files = (d) => {
    for (const e of readDirCached(d) || []) {
      const p = path.join(d, e.name);
      if (e.isFile() && (e.name === ADR_INDEX || RE_ADR_NAME.test(e.name)) && !produced.has(p) && isGeneratedOrAbsent(p)) out.push(p);
    }
  };
  const dirs = (d) => (readDirCached(d) || []).filter((e) => e.isDirectory() && !e.isSymbolicLink()).map((e) => e.name);
  files(scopeDir);
  if (project) {
    for (const n of dirs(scopeDir)) {
      if (n !== "_archive") files(path.join(scopeDir, n));
      else for (const a of dirs(path.join(scopeDir, n))) files(path.join(scopeDir, n, a));
    }
  }
  return out;
}

// spec_export {format: "adr", name?, write?} (exportSpecs hands it over). → { ok, scope, format, lang, dir, wrote, feature | features,
// adrs, excluded, note?, documents [{file, type, feature, id, number, title, status, supersededBy?, supersedes, date, lang, content}],
// stale } — with write: { files, written, unchanged, removed, documents (bytes, no content) } instead of the contents.
function exportAdr(projectDir, opts, pl) {
  const root = specsRoot(projectDir);
  const adrRoot = path.join(root, EXPORT_DIR, ADR_DIR);
  let models;
  let scope;
  if (opts.name != null && String(opts.name).trim() !== "") {
    const f = existingFeature(projectDir, opts.name);
    if (!f.ok) return { ok: false, error: f.error };
    models = [adrModel(projectDir, f, false)];
    scope = "feature";
  } else {
    if (!fs.existsSync(root)) return { ok: false, error: i18n.msg(pl).err.noSpecs(root) };
    models = featureDirs(projectDir).map((x) => adrModel(projectDir, x, x.archived));
    scope = "project";
  }
  const lang = scope === "feature" ? models[0].lang : pl;
  const dir = scope === "feature" ? models[0].outDir : adrRoot;
  const docs = models.flatMap(adrDocs);
  if (scope === "project" && docs.length) docs.push(adrProjectIndex(projectDir, models, pl, adrRoot));
  const stale = adrStaleFiles(projectDir, dir, scope === "project", new Set(docs.map((d) => d.file)));
  const A = i18n.msg(lang).adr;
  const adrs = docs.filter((d) => d.type === "adr").length;
  const res = { ok: true, scope, format: "adr", lang, dir, wrote: false };
  if (scope === "feature") res.feature = models[0].feature;
  else res.features = [...new Set(models.filter((m) => m.adrs.length).map((m) => m.feature))];
  Object.assign(res, { adrs, excluded: models.flatMap((m) => m.excluded) });
  if (!adrs) res.note = A.nothing;
  if (!opts.write) return { ...res, documents: docs, stale };
  const X = i18n.msg(lang).stakeholderExport;
  const rel = (p) => ".specs/" + path.relative(root, p).split(path.sep).join("/");
  // A feature folder named 'exports' from before the name was reserved: never drop documents into someone's spec.
  if (["requirements.md", ".state.json"].some((n) => fs.existsSync(path.join(root, EXPORT_DIR, n)))) return { ...res, ok: false, error: X.exportsIsFeature(".specs/" + EXPORT_DIR + "/") };
  const linked = [dir, ...docs.map((d) => d.file)].find((p) => !specsWriteContained(projectDir, p));
  if (linked) return { ...res, ok: false, error: X.exportsLinked(rel(linked)) };
  const hand = docs.find((d) => !isGeneratedOrAbsent(d.file));
  if (hand) return { ...res, ok: false, skipped: true, error: i18n.msg(lang).err.notGenerated(rel(hand.file)) };
  const written = [];
  const unchanged = [];
  for (const d of docs) {
    const text = i18n.portableCli(d.content);
    const cur = readIfExists(d.file);
    if (cur != null && cur.replace(/\r\n/g, "\n") === text) { unchanged.push(d.file); continue; }
    writeFileAtomic(d.file, text);
    written.push(d.file);
  }
  const removed = stale.filter((p) => removeSpecFile(p));
  // the folders that leaves empty — a feature's, adr/_archive/, adr/ itself — never above adr/
  for (const d0 of [...new Set(removed.map((p) => path.dirname(p)))].sort((a, b) => b.length - a.length)) {
    for (let d = d0; d.length >= adrRoot.length && withinRoot(adrRoot, d) && removeEmptySpecDir(d);) d = path.dirname(d);
  }
  return { ...res, wrote: docs.length > 0 || removed.length > 0, files: docs.map((d) => d.file), written, unchanged, removed,
    documents: docs.map(({ content, ...d }) => ({ ...d, bytes: Buffer.byteLength(i18n.portableCli(content), "utf8") })) };
}

// ---------------------------------------------------------------------------
// The spike kind — spec_create {kind: "spike"} / `dev-spec spike "<name>" [--question …] [--timebox …]`
// ---------------------------------------------------------------------------
// An investigation with a question, a timebox and a DECISION — neither an unrecorded vibe session nor a spec with fake ACs.
// It scaffolds spike.md (Question · Timebox · Options considered · Evidence · Decision + _Outcome: go | no-go | pivot_ ·
// Follow-up — localized headings, matched by the synonyms below) and a small tasks.md of investigation steps; it is
// core-only and has no requirements / design / test / tasks gates (gateWalk, pendingGateList and chainArtifacts are empty
// for it; approve refuses every phase but the execution sign-off; add_track refuses it). Its own doctor (spikeDoctor:
// question, decision — fail until written —, timebox — warn once its end date passed with no decision), next_action
// (spikeNextAction: fill the question → investigate → record the decision → go: spec the real feature, seeded from the
// question + decision, and archive the spike · no-go: archive it with its reason · pivot: a new spike) and finish
// (spikeFinish: ready once the decision is written and every task ticked — no suite / evidence gates). detectPhase:
// requirements (question unwritten) → tasks-ready → executing → complete (decision written and every task ticked).
// Prototype code lives OUTSIDE .specs/. The changelog never lists a spike (it ships nothing).
const SPIKE_FILE = "spike.md";
const SPIKE_SYN = {
  question: ["question", "pergunta", "pregunta"],
  timebox: ["timebox", "prazo", "plazo"],
  options: ["options considered", "opções consideradas", "opcoes consideradas", "opciones consideradas", "options", "opções", "opcoes", "opciones"],
  evidence: ["evidence", "evidência", "evidencia"],
  decision: ["decision", "decisão", "decisao", "decisión"],
  followUp: ["follow-up", "follow up", "seguimento", "seguimiento"],
};
// /^\s*(?:[-*+]\s+)?_Outcome:[ \t]*(.*)_\s*$/i ($1 = value), scanned (underscoreMarkerLine — 1.17 H).
const RE_OUTCOME_HEAD = /^\s*(?:[-*+]\s+)?_Outcome:/i;
const outcomeMarker = (line) => underscoreMarkerLine(line, RE_OUTCOME_HEAD);
// _Outcome:_ values (English-stable go | no-go | pivot; the PT / ES words and yes / no read too).
const OUTCOME_SYN = {
  go: ["go", "yes", "sim", "sí", "si", "avançar", "avancar", "avanzar", "seguir"],
  "no-go": ["no-go", "no go", "nogo", "no", "não", "nao", "não avançar", "nao avancar", "no avanzar", "no seguir", "drop", "abandonar"],
  pivot: ["pivot", "pivotar", "pivotear", "mudar de rumo", "cambiar de rumbo"],
};
function normOutcome(v) {
  const s = stripEnd(String(v == null ? "" : v).replace(/[`*[\]]/g, "").replace(/\s+/g, " ").trim().toLowerCase(), unitIn(".!")); // /[.!]+$/
  if (!s || s.includes("|")) return null;
  return Object.keys(OUTCOME_SYN).find((k) => OUTCOME_SYN[k].includes(s)) || null;
}
// A spike.md section's own prose: comments out, the TODO sentinel and the _Outcome:_ line set aside.
function spikeProse(body) {
  return stripHtmlComments(body || "").split(/\r?\n/).filter((l) => !outcomeMarker(l) && !RE_TODO_SENTINEL.test(l)).join("\n");
}
// Written = present, no `> **TODO**` sentinel, and some prose outside [bracketed slots] (the _Outcome:_ line alone is no rationale).
function spikeFilled(body) {
  return body != null && !RE_TODO_SENTINEL.test(stripHtmlComments(body)) && hasProseOutsideBrackets(spikeProse(body));
}
// The Decision section's outcome: its _Outcome: …_ line, else a first line that opens with go / no-go / pivot.
function spikeOutcome(body) {
  if (body == null) return null;
  const lines = stripHtmlComments(body).split(/\r?\n/);
  const mk = lines.map((l) => outcomeMarker(l)).find(Boolean);
  const marked = mk ? normOutcome(mk.value) : null; // the template's `_Outcome: [go | no-go | pivot]_` reads as none
  if (marked) return marked;
  const first = spikeProse(body).split(/\r?\n/).map((l) => l.trim()).find(Boolean) || "";
  const m = first.match(/^(?:[-*+>]\s*)*(?:\*\*|__)?(no-go|no go|nogo|go|pivot|não avançar|nao avancar|no avanzar|avançar|avancar|avanzar|pivotar|pivotear)(?![\p{L}\p{N}-])/iu);
  return m ? normOutcome(m[1]) : null;
}
// The first paragraph of a section's prose, one line (null when it is only [slots]).
function spikeParagraph(body, max) {
  const para = [];
  for (const l of spikeProse(body).split(/\r?\n/).map((x) => x.trim())) {
    if (!l) { if (para.length) break; continue; }
    para.push(l);
  }
  const t = para.join(" ");
  return t && hasProseOutsideBrackets(t) ? oneLiner(t, max || 300) : null;
}
const validIsoDay = (s) => { const d = new Date(s + "T00:00:00Z"); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
// The Timebox section → { state: missing | unset (TODO / empty) | date | nodate, date? } — the first real YYYY-MM-DD in it.
function spikeTimebox(body) {
  if (body == null) return { state: "missing" };
  const t = stripHtmlComments(body);
  if (RE_TODO_SENTINEL.test(t) || !t.trim()) return { state: "unset" };
  for (const m of t.matchAll(/(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/g)) if (validIsoDay(m[0])) return { state: "date", date: m[0] };
  return { state: "nodate" };
}
// Everything the spike tools read from spike.md.
function spikeInfo(dir) {
  const text = readIfExists(path.join(dir, SPIKE_FILE));
  if (text == null) return { text: null, questionFilled: false, decisionFilled: false, outcome: null, question: null, rationale: null, timebox: { state: "missing" } };
  const q = extractSection(text, SPIKE_SYN.question);
  const d = extractSection(text, SPIKE_SYN.decision);
  const tb = spikeTimebox(extractSection(text, SPIKE_SYN.timebox));
  const decisionFilled = spikeFilled(d);
  return { text, questionFilled: spikeFilled(q), decisionFilled, outcome: decisionFilled ? spikeOutcome(d) : null, question: spikeFilled(q) ? spikeParagraph(q) : null,
    rationale: decisionFilled ? spikeParagraph(d) : null, timebox: tb, timeboxPassed: !decisionFilled && tb.state === "date" && tb.date < today() ? tb.date : null };
}
const isSpikeDir = (dir) => (readJson(statePath(dir)).data || {}).kind === "spike";
// detectPhase for a spike (tasks: parseTasks of its tasks.md).
function spikePhase(dir, tasks) {
  const s = spikeInfo(dir);
  const allDone = tasks.length > 0 && tasks.every((t) => t.done);
  if (s.decisionFilled && (allDone || !tasks.length)) return "complete";
  if (s.decisionFilled || tasks.some((t) => t.done)) return "executing";
  return s.questionFilled ? "tasks-ready" : "requirements";
}
// spec_create's spike inputs → { question, until, raw } | { error }. timebox: an end date (YYYY-MM-DD) or a duration from
// today (3d, 2w, 8h — days / weeks / hours; dias / semanas / horas / días read too).
function spikeCreateInput(opts, M) {
  const SP = M.spike;
  const A = M.args;
  const out = { question: null, until: null, raw: null };
  const q = opts.question;
  if (q != null && typeof q !== "string") return { error: A.invalid(A.item("question", A.type.string, JSON.stringify(q))) };
  if (typeof q === "string" && q.trim()) {
    if (q.length > DECISION_TEXT_MAX) return { error: M.decisions.tooLong("question", DECISION_TEXT_MAX) };
    out.question = safeSpecText(q.trim());
  }
  const v = opts.timebox;
  if (v == null || (typeof v === "string" && !v.trim())) return out;
  if (typeof v !== "string") return { error: SP.badTimebox(JSON.stringify(v)) };
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return validIsoDay(s) ? { ...out, until: s, raw: s } : { error: SP.badTimebox(JSON.stringify(s)) };
  const m = s.match(/^(\d{1,3})\s*(h|hours?|horas?|d|days?|dias?|días?|w|weeks?|semanas?)$/i);
  if (!m) return { error: SP.badTimebox(JSON.stringify(s)) };
  const u = m[2][0].toLowerCase();
  const ms = u === "h" ? 3600e3 : u === "w" || u === "s" ? 7 * 864e5 : 864e5;
  return { ...out, until: today(Date.now() + parseInt(m[1], 10) * ms), raw: s };
}
// The go seed: the spike's name without its "spike" words, and a summary from its question + decision.
function spikeSeed(slug, s) {
  const name = slug.split("-").filter((w) => !/^(spike|spikes|investigate|investigation|investigacao|investigacion|investigar|poc)$/.test(w)).join("-") || slug;
  const summary = oneLiner([s.question, s.rationale].filter(Boolean).join(" — "), 240) || slug;
  return { name, summary, archiveFirst: name === slug };
}

function spikeDoctor(projectDir, f) {
  const { slug, dir } = f;
  const lng = featureLang(projectDir, slug);
  const SP = i18n.msg(lng).spike;
  const tracks = detectTracks(dir);
  const st = readState(projectDir, slug);
  const s = spikeInfo(dir);
  const checks = [];
  const add = (id, status, detail) => checks.push({ id, status, detail });
  if (s.text == null) add("spike", "fail", SP.doctor.missing);
  else {
    add("question", s.questionFilled ? "pass" : "fail", s.questionFilled ? SP.doctor.questionOk : SP.doctor.questionMissing);
    add("decision", !s.decisionFilled ? "fail" : s.outcome ? "pass" : "warn", !s.decisionFilled ? SP.doctor.decisionMissing : s.outcome ? SP.doctor.decisionOk(s.outcome) : SP.doctor.outcomeMissing);
    const tb = s.timebox;
    if (s.decisionFilled) add("timebox", "pass", SP.doctor.timeboxDecided);
    else if (tb.state === "date") add("timebox", s.timeboxPassed ? "warn" : "pass", s.timeboxPassed ? SP.doctor.timeboxPassed(tb.date) : SP.doctor.timeboxOk(tb.date));
    else add("timebox", "warn", tb.state === "nodate" ? SP.doctor.timeboxNoDate : SP.doctor.timeboxUnset);
  }
  const dupTasks = duplicateTaskNumbers(taskBlocks(readIfExists(path.join(dir, "tasks.md")) || ""));
  if (dupTasks.length) add("duplicate-tasks", "warn", i18n.msg(lng).evidenceGate.duplicateTasks(dupTasks.map((n) => "#" + n).join(", ")));
  const unread = unreadTasksDetail(readIfExists(path.join(dir, "tasks.md")) || ""); // 1.22 review: checkbox lines that are no tasks
  if (unread) add("unread-tasks", "warn", i18n.msg(lng).markerSyntax.unreadTasks(unread));
  const depsCheck = taskDepsCheck(taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks) || ""), lng); // 1.14 F3
  if (depsCheck) add("task-deps", depsCheck.status, depsCheck.detail);
  for (const c of decisionDoctorChecks(projectDir, slug, dir, st, "spike", lng)) add(c.id, c.status, c.detail);
  const wExp = waiverExpiredCheck(st.approvals, tracks, slug, lng); // 1.16 U3 (a forced execution sign-off)
  if (wExp) add(wExp.id, wExp.status, wExp.detail);
  const mc = mergeConflictsCheck(projectDir, slug, st, lng); // 1.21 F1a: conflicts the merge driver left unresolved
  if (mc) add(mc.id, mc.status, mc.detail);
  const rmc = roadmapGovernanceCheck(projectDir, lng); // 1.24 review 6 (E4): roadmap.json unreadable — its roles (the sign-off's) unknown
  if (rmc) add(rmc.id, rmc.status, rmc.detail);
  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  return { ok: true, feature: slug, kind: "spike", tracks: trackLabel(tracks), phase: detectPhase(dir, tracks), approvals: st.approvals || {}, pendingGates: [], forcedGates: [],
    nextGate: null, gatesOk: true, checks, summary: { pass: checks.length - fails.length - warns.length, warn: warns.length, fail: fails.length },
    readyToAdvance: fails.length === 0, verdict: fails.length ? "fail" : warns.length ? "warn" : "pass" };
}

function spikeNextAction(projectDir, f, opts = {}) {
  const { slug, dir } = f;
  const lng = featureLang(projectDir, slug);
  const N = i18n.msg(lng).spike.next;
  const tracks = detectTracks(dir);
  const doc = opts.doctor && opts.doctor.ok ? opts.doctor : spikeDoctor(projectDir, f);
  const s = spikeInfo(dir);
  const spikeBlocks = taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")), tracks) || "");
  const sch = taskSchedule(spikeBlocks); // 1.14 F3: next_task's rule (_Depends:_ all done)
  const next = sch.next;
  const late = s.timeboxPassed ? " " + N.timeboxPassed(s.timeboxPassed) : "";
  const res = { ok: true, feature: slug, kind: "spike", tracks: trackLabel(tracks), phase: detectPhase(dir, tracks), verdict: doc.verdict, gatesOk: true, pendingGates: [], changedSinceApproval: [] };
  if (s.text == null) Object.assign(res, { step: "fill", file: SPIKE_FILE, recommendation: N.missing(slug) });
  else if (!s.questionFilled) Object.assign(res, { step: "fill", file: SPIKE_FILE, recommendation: N.fillQuestion(slug) });
  else if (next) Object.assign(res, { step: "implement", recommendation: N.investigate(next.number, cleanTaskText(next.text), slug) + late });
  else if (spikeBlocks.some((b) => !b.done)) Object.assign(res, { step: "fix", blocked: sch.blocked.length ? sch.blocked : sch.skipped, recommendation: taskDepsBlockedNote(sch, slug, lng) });
  else if (!s.decisionFilled) Object.assign(res, { step: "decide", file: SPIKE_FILE, recommendation: N.decide(slug) + late });
  else if (!s.outcome) Object.assign(res, { step: "decide", file: SPIKE_FILE, recommendation: N.outcome(slug) });
  else if (s.outcome === "go") {
    const seed = spikeSeed(slug, s);
    Object.assign(res, { step: "promote", outcome: "go", seed: { name: seed.name, summary: seed.summary },
      recommendation: (seed.archiveFirst ? N.goArchiveFirst : N.goCreateFirst)(slug, seed.name, seed.summary) });
  } else {
    const why = s.rationale ? stripEnd(s.rationale, wsOrUnitIn(".;:!…")) : null; // /[\s.;:!…]+$/ — the message ends the sentence itself
    if (s.outcome === "no-go") Object.assign(res, { step: "archive", outcome: "no-go", recommendation: N.noGo(slug, why) });
    else Object.assign(res, { step: "pivot", outcome: "pivot", recommendation: N.pivot(slug, why) });
  }
  return res;
}

// spec_finish on a spike (after spec_finish {evidence} was recorded, if any): ready once the decision is written and every
// task is ticked — no suite / evidence / approval gates. opts.gateOnly: the execution sign-off's checks.
function spikeFinish(projectDir, f, opts, recordedChecks) {
  const { slug, dir } = f;
  const lng = featureLang(projectDir, slug);
  const M = i18n.msg(lng);
  const F = M.finish;
  const SP = M.spike;
  const tracks = detectTracks(dir);
  const s = spikeInfo(dir);
  const tasksText = activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks);
  const blocks = taskBlocks(tasksText);
  const open = blocks.filter((b) => !b.done).map((b) => b.number);
  const blocked = [];
  const block = (id, detail) => blocked.push({ id, detail });
  if (s.text == null) block("spike", SP.finish.missing);
  else if (!s.decisionFilled) block("decision", SP.finish.decisionBlocker);
  if (open.length) block("open-tasks", F.open(open.map((n) => "#" + n).join(", ")));
  if (opts.gateOnly) return { ok: true, checks: blocked };
  const blockers = blocked.map((b) => b.detail);
  const text = s.text || "";
  const sec = (syn) => { const b = extractSection(text, syn); return b == null ? null : spikeFilled(b) ? spikeProse(b).trim() : null; };
  const mergeTitle = commitTitle(`docs(${slug}): ${SP.kind}${s.outcome ? " " + s.outcome : ""} — `, s.question || slug);
  const body = [SP.finish.prQuestion, s.question || slug, ""];
  const decision = sec(SPIKE_SYN.decision);
  if (decision) body.push(SP.finish.prDecision(s.outcome), decision, "");
  for (const [syn, h] of [[SPIKE_SYN.options, SP.finish.prOptions], [SPIKE_SYN.evidence, SP.finish.prEvidence], [SPIKE_SYN.followUp, SP.finish.prFollowUp]]) {
    const t = sec(syn);
    if (t) body.push(h, t, "");
  }
  const dec = decisionSummaryLines(dir, lng);
  if (dec.length) body.push(...dec, "");
  if (blocks.length) body.push(F.prTasks, ...blocks.map((b) => `- [${b.done ? "x" : " "}] ${b.number}. ${cleanTaskText(b.text)}`), "");
  const forcedList = forcedApprovalList(readState(projectDir, slug).approvals, tracks); // 1.16 U3: a forced execution sign-off
  if (forcedList.length) body.push(...waiverSummaryLines(forcedList, lng), "");
  body.push(F.prChecks, ...SP.finish.checks.map((c) => "- [ ] " + c), "");
  body.push(F.prSpec, ...[SPIKE_FILE, DECISIONS_FILE, "tasks.md"].filter((x) => fs.existsSync(path.join(dir, x))).map((x) => "- `.specs/" + slug + "/" + x + "`"));
  const mergeSummary = body.join("\n") + "\n";
  const exDir = path.join(dir, ".execution");
  const summaryPath = path.join(exDir, "merge-summary.md");
  const write = !!opts.write;
  if (write) {
    ensureDir(exDir);
    writeIfAbsent(path.join(exDir, ".gitignore"), "*\n");
    writeFileAtomic(summaryPath, "# " + mergeTitle + "\n\n" + mergeSummary); // derived: regenerated on every call (1.24 r6: through the write gate)
  }
  const ready = blockers.length === 0;
  const baseline = write && ready ? recordFinishBaseline(projectDir, slug, dir, tasksText, opts.globCap) : null; // "finished" (catalog, next_action)
  const res = { ok: true, feature: slug, kind: "spike", tracks: trackLabel(tracks), readyToFinish: ready, message: ready ? SP.finish.ready(slug) : SP.finish.notReady(slug),
    blockers, warnings: [], openTasks: open, unverified: [], pendingGates: [], changedSinceApproval: [], placeholders: [], checks: SP.finish.checks.slice(),
    outcome: s.outcome, mergeTitle, paths: { summary: summaryPath }, wrote: write };
  if (baseline) res.baseline = baseline;
  if (forcedList.length) res.waivers = waiverResult(forcedList); // 1.16 U3
  if (recordedChecks) res.recordedChecks = recordedChecks;
  if (opts.includeBody != null ? !!opts.includeBody : !write) res.mergeSummary = mergeSummary;
  return res;
}

module.exports = { DECISIONS_FILE, DECISION_TITLE_MAX, DECISION_TEXT_MAX, RE_DECISION_HEAD_START, isBlankUnit,
  decisionHead, stripClosingHashes, underscoreMarkerLine, RE_DECISION_MARKER_HEAD, decisionMarker, DECISION_LABELS,
  RE_DECISION_LABEL, BRIEF_DECISIONS_MAX, BRIEF_DECISIONS_CHARS, RE_LEADING_BOM, blankHtmlComments, splitRefs, affectPieces, rejoinRefs, affectsRefs, AFFECTS_JOIN_MAX,
  normDecisionId, decisionLabelKey, decisionLog, retiredDecisions, decisionSectionKeys, decisionTargets, resolveAffect,
  trimBlanksEnd, safeSpecText, appendSpecText, decisionInput, decisionEntryLines, decide, decisionsTrace, affectsWarnings,
  decisionDoctorChecks, briefDecisions, decisionSummaryLines, catalogDecisions, ADR_DIR, ADR_INDEX, ADR_SLUG_MAX, RE_ADR_NAME, adrNumber,
  adrFileName, adrInert, adrLabel, adrBlock, posixRel, adrModel, adrRef, adrStatusText, adrDocs, adrProjectIndex, adrStaleFiles, exportAdr, SPIKE_FILE, SPIKE_SYN, RE_OUTCOME_HEAD,
  outcomeMarker, OUTCOME_SYN, normOutcome, spikeProse, spikeFilled, spikeOutcome, spikeParagraph, validIsoDay,
  spikeTimebox, spikeInfo, isSpikeDir, spikePhase, spikeCreateInput, spikeSeed, spikeDoctor, spikeNextAction,
  spikeFinish, __link };
