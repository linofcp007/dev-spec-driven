"use strict";

/**
 * dev-spec-driven engine — the requirements traceability matrix.
 * trace_check {matrix}, `trace --matrix | --csv`, the RTM's CSV and its section in the stakeholder export.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acOneLine, activeDesign, activeTasks, BOM_CHAR, cleanTaskText, decisionLog, DECISIONS_FILE, designSections,
  detectTracks, dirKey, duplicateTaskNumbers, evidenceRule, existingFeature, extractAcIds, extractTestIds, featureDirs,
  featureLang, fingerprintMatches, gitEvidence, historyText, idKey, inertOutsideCode, isApprovalRecord, isObj, isRecord,
  italic, latestSnapshot, mdCell, mdPlainText, normWs, oneLiner, ownEvidence, packTracks, PHASE_FILE, phaseActive,
  placeholderReport, planIdText, RE_SECONDARY_ID_LINE, readContained, realLines, requirementAcIds, requirementIndex,
  resolveSupersedes, retiredDecisions, secondaryDefinitions, secondaryIds, stateFromFile, statePath, supersedesMarkers,
  taskBlocks, taskProse, taskVerification, testPlanEntries, textFingerprint, timeOf, tKey, traceTestCode, trackAcIds,
  trackLabel, trackMarker, utcStamp;
function __link(E) { ({ acOneLine, activeDesign, activeTasks, BOM_CHAR, cleanTaskText, decisionLog, DECISIONS_FILE,
  designSections, detectTracks, dirKey, duplicateTaskNumbers, evidenceRule, existingFeature, extractAcIds,
  extractTestIds, featureDirs, featureLang, fingerprintMatches, gitEvidence, historyText, idKey, inertOutsideCode,
  isApprovalRecord, isObj, isRecord, italic, latestSnapshot, mdCell, mdPlainText, normWs, oneLiner, ownEvidence,
  packTracks, PHASE_FILE, phaseActive, placeholderReport, planIdText, RE_SECONDARY_ID_LINE, readContained, realLines,
  requirementAcIds, requirementIndex, resolveSupersedes, retiredDecisions, secondaryDefinitions, secondaryIds,
  stateFromFile, statePath, supersedesMarkers, taskBlocks, taskProse, taskVerification, testPlanEntries,
  textFingerprint, timeOf, tKey, traceTestCode, trackAcIds, trackLabel, trackMarker, utcStamp } = E); }

// ---------------------------------------------------------------------------
// 1.14 F5 — requirements traceability matrix (RTM): trace_check {matrix} · `dev-spec trace <f> --matrix | --csv` ·
// spec_export {format: "csv"} (.specs/exports/<slug>.rtm.csv) · an RTM section in the stakeholder export
// ---------------------------------------------------------------------------
//
// ONE row per requirement ID of the feature — its US-n.AC-m criteria (document order), then its EC-n, NFR-n and SC-nnn IDs
// (trace_check's sets, read from requirements.md as it is active: a removed track's criteria are out, as in the export and
// the catalog). Nothing new is recorded: each column is what another tool already reads —
//   text        acOneLine (the whole criterion on one line, its ID and a _Supersedes:_ marker dropped); template = still
//               template text (placeholderReport; a secondary ID trace_check doesn't count as defined)
//   design      the `##` sections of design.md (a bugfix: bug.md + design.md, named by file as spec_impact names them) that
//               mention the ID — plus, for a [SEC] / [PRIVACY] criterion, that track's sections (the brief's rule)
//   tasks       the LINKED tasks: those whose own prose (never a fenced example) cites the ID, and those citing one of its
//               planned T-IDs — each with done, verified + its stable reason (taskVerification, the ONE verdict) and the
//               latest evidence record (command, exitCode, at, commit / dirty when `done --run` recorded them)
//   tests       the T-IDs of the test-plan entries that cite the ID (+tdd); with opts.code the test files naming each one
//               (traceTestCode: bounded, read-only; a T-ID run outside test code is flagged outsideCode)
//   decisions   the CURRENT decisions.md entries (not superseded) whose _Affects:_ names the ID
//   supersedes / supersededBy   this criterion's _Supersedes:_ targets / the other features' criteria replacing it
//   approval    the requirements approval (at, by, forced) and whether THIS row changed since (the approved snapshot's text
//               for the ID; an approval without a snapshot knows only whether the file changed: null = unknown)
// status (stable codes):
//   untraced    a trace gap names it — `gaps`: no-task (an AC no task cites), no-test (+tdd: an AC no test-plan line covers),
//               no-coverage (an EC / NFR no task or planned test covers; an SC no test-plan row or quickstart.md line) —
//               exactly trace_check's gaps and its secondary warnings for that ID
//   planned     traced, but no linked task is done yet — one is still open, or none is linked (a planned test only)
//   implemented every linked task is done, but one of them is not verified
//   verified    every linked task is done and verified (a task with no runnable _Verify:_ counts — nothingToVerify)
const RTM_STATUSES = ["verified", "implemented", "planned", "untraced"];
const RTM_KIND_ORDER = { ac: 0, ec: 1, nfr: 2, sc: 3 };
const RTM_TEXT_MAX = 1000; // characters of a criterion's one line (the matrix is bounded by the requirement count)
// "US-2.AC-10" → [2, 10] (the order an AC no criterion defines falls back to).
const acNums = (id) => (String(id).match(/\d+/g) || []).map(Number);
// Other features' _Supersedes:_ markers → Map(dirKey(target dir) + "\n" + AC → ["<feature>/<AC>" | "<feature>"]) — the
// catalog's rule, built once per call (the project export passes it to every feature). `.live` (a Set of the same keys):
// retired by at least one SHIPPED feature (featureShipped); a key outside it is only "to be superseded" (1.15). A feature
// archived without ever shipping (abandoned) declares nothing.
function supersededByIndex(projectDir) {
  const out = new Map();
  out.live = new Set();
  out.liveBy = new Map(); // key → the SHIPPED declarers only (a retired AC names those, never a draft's plan)
  const cache = new Map();
  const push = (m, k, who) => { if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(who)) m.get(k).push(who); };
  for (const s of featureDirs(projectDir)) {
    const raw = readContained(projectDir, path.join(s.dir, "requirements.md"));
    if (!raw || !/_Supersedes:/i.test(raw)) continue;
    const state = stateFromFile(projectDir, statePath(s.dir));
    const shipped = featureShipped(state);
    if (s.archived && !shipped) continue;
    const shippedKeys = shipped ? shippedSupersedeKeys(projectDir, s.dir, state, raw, cache) : null;
    for (const v of resolveSupersedes(projectDir, s.dir, supersedesMarkers(raw), cache).valid) {
      const k = dirKey(v.dir) + "\n" + v.ac;
      const who = s.slug + (v.by ? "/" + v.by : "");
      push(out, k, who);
      if (shipped && (!shippedKeys || shippedKeys.has(k))) { out.live.add(k); push(out.liveBy, k, who); }
    }
  }
  return out;
}
// The _Supersedes:_ targets (dirKey + "\n" + AC) a SHIPPED feature actually shipped with — null when every current
// declaration counts: requirements.md is unchanged since the requirements snapshot approved at or before its latest ship
// (a finish or an execution sign-off), or there is no such snapshot (a pre-1.13 approval: trusted). A declaration a later
// change request added is only "to be superseded" until the feature ships again (the release notes list it then).
function shippedSupersedeKeys(projectDir, dir, state, reqRaw, cache) {
  const t = (v) => timeOf(v) || 0;
  const shipAt = Math.max(t(isObj(state.finished) ? state.finished.at : null), t(isRecord(state.approvals) && isRecord(state.approvals.execution) ? state.approvals.execution.at : null));
  if (!shipAt) return null;
  const hist = Array.isArray(state.approvalHistory) ? state.approvalHistory.filter((h) => isApprovalRecord(h) && h.phase === "requirements" &&
    typeof h.snapshot === "string" && timeOf(h.at) != null && timeOf(h.at) <= shipAt) : [];
  const rec = hist[hist.length - 1];
  if (!rec) return null;
  const text = historyText(dir, rec.snapshot);
  if (text == null || textFingerprint(text, "requirements") === textFingerprint(reqRaw || "", "requirements")) return null;
  return new Set(resolveSupersedes(projectDir, dir, supersedesMarkers(text), cache).valid.map((v) => dirKey(v.dir) + "\n" + v.ac));
}
// A feature that SHIPPED — a finish recorded, or its execution signed off (spec_changelog's rule). Only a shipped feature's
// _Supersedes:_ retires the older criterion in the catalog, the export and the matrix (1.15): a draft's declaration is
// "to be superseded" — the catalog says what the system does today.
function featureShipped(st) {
  return isObj(st) && (isObj(st.finished) || (isRecord(st.approvals) && isRecord(st.approvals.execution)));
}
// The latest evidence record of a task, as the matrix shows it (null = nothing recorded for it).
function rtmEvidence(rec) {
  if (!isRecord(rec)) return null;
  const o = {};
  for (const k of ["command", "exitCode", "at", "expected", "observed"]) if (rec[k] != null && typeof rec[k] !== "object") o[k] = rec[k]; // observed: 1.14 F1
  Object.assign(o, gitEvidence(rec));
  if (rec.exitCode == null && typeof rec.summary === "string" && rec.summary.trim()) o.note = oneLiner(rec.summary, 200);
  if (rec.stale === true) o.stale = true;
  return Object.keys(o).length ? o : null;
}
// traceMatrix for a resolved feature ({ slug, dir }). opts: code (+ scan: a scanTestCode() result or a function returning
// one), supBy (a supersededByIndex() result to reuse).
function buildTraceMatrix(projectDir, f, opts = {}) {
  const { slug, dir } = f;
  const lang = featureLang(projectDir, slug);
  const tracks = detectTracks(dir);
  const state = stateFromFile(projectDir, statePath(dir));
  const kind = state.kind === "bugfix" || state.kind === "spike" ? state.kind : "feature";
  const read = (n) => readContained(projectDir, path.join(dir, n));
  const reqRaw = read("requirements.md") || "";
  const reqs = activeDesign(reqRaw, tracks);
  const idx = requirementIndex(reqs);

  // The rows: trace_check's AC set (requirementAcIds) in document order, then the secondary IDs (trace's secondaryDefinitions).
  const rows = [];
  for (const id of requirementAcIds(reqs)) {
    const e = idx.get(id);
    rows.push({ id, key: id, kind: "ac", raw: e ? e.text : "", line: e ? e.line : Infinity });
  }
  rows.sort((a, b) => a.line - b.line || acNums(a.id)[0] - acNums(b.id)[0] || acNums(a.id)[1] - acNums(b.id)[1]);
  const sec = secondaryDefinitions(reqs);
  const secEntry = new Map();
  for (const [id, e] of idx) {
    const m = id.match(/^(EC|NFR|SC)-(\d+)$/);
    if (m && !secEntry.has(idKey(m[1], m[2]))) secEntry.set(idKey(m[1], m[2]), e);
  }
  const secRows = [...sec.all].map((k) => {
    const e = secEntry.get(k);
    return { id: sec.defined.get(k) || (e && e.id) || k, key: k, kind: k.slice(0, k.indexOf("-")).toLowerCase(), raw: e ? e.text : "", line: e ? e.line : Infinity, secTemplate: !sec.defined.has(k) };
  }).sort((a, b) => RTM_KIND_ORDER[a.kind] - RTM_KIND_ORDER[b.kind] || a.line - b.line);
  rows.push(...secRows);
  const cites = (row, acs, secIds) => (row.kind === "ac" ? acs.has(row.id) : secIds.has(row.key));

  // Tasks (the active ones — verificationStatus' view), each read once.
  const blocks = taskBlocks(activeTasks(read("tasks.md") || "", tracks) || "");
  const dups = new Set(duplicateTaskNumbers(blocks));
  const evidence = isRecord(state.evidence) ? state.evidence : {};
  const evMode = evidenceRule(projectDir); // 1.14 F1: the ONE verdict, in the project's evidence mode (unobserved under "observed")
  const tinfo = blocks.map((b) => {
    const prose = taskProse(b).join("\n");
    return { b, acs: extractAcIds(prose), sec: secondaryIds(prose), tids: new Set([...extractTestIds(prose)].map((t) => tKey(t.slice(2)))) };
  });
  const tasksAcs = new Set(tinfo.flatMap((t) => [...t.acs]));
  const tasksSec = new Set(tinfo.flatMap((t) => [...t.sec.keys()]));

  // The test plan (+tdd only — an inactive artifact otherwise, as trace_check reads it).
  const planOn = phaseActive("test-plan", tracks);
  const planRaw = planOn ? read("test-plan.md") || "" : "";
  const planText = planIdText(planRaw);
  const planAcs = extractAcIds(planText); // trace_check's uncoveredByTests set
  const entries = testPlanEntries(planRaw).map((e) => ({ ids: e.ids, acs: extractAcIds(e.text), sec: secondaryIds(e.text) }));
  const planSec = new Set(entries.flatMap((e) => [...e.sec.keys()]));
  const quickSec = secondaryIds(realLines(read("quickstart.md") || "", RE_SECONDARY_ID_LINE).join("\n"));
  let code = null;
  if (opts.code && planOn) code = traceTestCode(projectDir, dir, planText, requirementAcIds(reqs), opts.scan);
  const inCode = new Map(code ? Object.entries(code.testsInCode).map(([id, files]) => [tKey(id.slice(2)), files]) : []);
  const outside = new Set(code ? code.plannedOutsideCode.map((id) => tKey(id.slice(2))) : []);

  // Design sections (a bugfix: bug.md's and design.md's, named by file — spec_impact's keys), each scanned once.
  let dsecs = designSections(activeDesign(read("design.md") || "", tracks));
  if (kind === "bugfix") {
    const byFile = (name) => (s) => ({ ...s, title: `${name}: ${s.title}` });
    dsecs = designSections(read("bug.md") || "").map(byFile("bug.md")).concat(dsecs.map(byFile(PHASE_FILE.design)));
  }
  const dinfo = dsecs.map((s) => { const hay = s.title + "\n" + s.body; return { title: s.title, acs: extractAcIds(hay), sec: secondaryIds(hay) }; });
  const trackMarks = ["sec", "privacy", "dist", ...packTracks()].filter((tr) => tracks.includes(tr)).map((tr) => ({ marker: trackMarker(tr), acs: trackAcIds(reqs, tr) })); // + track packs (1.15)

  // decisions.md — the current entries (a later entry's _Supersedes: D-n_ retires D-n).
  const decRaw = read(DECISIONS_FILE);
  const log = decRaw == null ? [] : decisionLog(decRaw);
  const retired = retiredDecisions(log);
  const decs = log.filter((e) => !retired.has(e.id)).map((e) => {
    const acs = new Set();
    const secIds = new Set();
    for (const r of e.affects) {
      let m;
      if ((m = r.match(/^US-(\d+)\.AC-(\d+)$/i))) acs.add(`US-${m[1]}.AC-${m[2]}`);
      else if ((m = r.match(/^(EC|NFR|SC)-(\d+)$/i))) secIds.add(idKey(m[1].toUpperCase(), m[2]));
    }
    return { id: e.id, title: e.title, kind: e.kind, acs, secIds };
  });

  // _Supersedes:_ both ways.
  const own = resolveSupersedes(projectDir, dir, supersedesMarkers(reqs), new Map()).valid;
  const supBy = opts.supBy || supersededByIndex(projectDir);

  // The requirements approval, and per row whether its text changed since (the snapshot), or only whether the file did.
  const appr = isRecord(state.approvals) ? state.approvals.requirements : null;
  let approval = null;
  let rowChanged = () => null;
  if (isRecord(appr)) {
    approval = { at: typeof appr.at === "string" ? appr.at : null, by: appr.by == null ? null : String(appr.by), forced: appr.forced === true };
    if (appr.forced === true && Array.isArray(appr.failing)) approval.failing = appr.failing.filter((x) => typeof x === "string");
    const snap = latestSnapshot(dir, state, "requirements");
    if (snap) {
      const before = requirementIndex(snap.text);
      Object.assign(approval, { baseline: "snapshot", snapshot: snap.rel, changed: textFingerprint(reqRaw, "requirements") !== textFingerprint(snap.text, "requirements") });
      rowChanged = (row) => { const o = before.get(row.id); return !o || normWs(o.text) !== normWs(row.raw); };
    } else if (appr.fingerprint) {
      const changed = !fingerprintMatches(reqRaw, "requirements", appr.fingerprint);
      Object.assign(approval, { baseline: "fingerprint-only", changed });
      rowChanged = () => (changed ? null : false); // THAT the file changed, not which criterion
    } else Object.assign(approval, { baseline: "none", changed: null });
  }

  const out = rows.map((row) => {
    const tests = [];
    for (const e of entries) {
      if (!cites(row, e.acs, e.sec)) continue;
      for (const id of e.ids) if (!tests.some((t) => tKey(t.id.slice(2)) === tKey(id.slice(2)))) tests.push({ id });
    }
    if (code) for (const t of tests) {
      const k = tKey(t.id.slice(2));
      if (outside.has(k)) t.outsideCode = true;
      else t.files = inCode.get(k) || [];
    }
    const testKeys = new Set(tests.map((t) => tKey(t.id.slice(2))));
    const tasks = [];
    for (const t of tinfo) {
      const via = [];
      if (cites(row, t.acs, t.sec)) via.push(row.id);
      for (const tt of tests) if (t.tids.has(tKey(tt.id.slice(2)))) via.push(tt.id);
      if (!via.length) continue;
      const b = t.b;
      const dup = dups.has(b.number);
      const v = b.done ? taskVerification(evidence, b, dup, evMode) : { reason: null, nothingToVerify: false };
      const task = { number: b.number, text: oneLiner(cleanTaskText(b.text) || b.text, 200) || "", done: b.done, verified: b.done && v.reason == null, reason: b.done ? v.reason : null };
      if (b.done && v.nothingToVerify) task.nothingToVerify = true;
      task.cites = via;
      task.evidence = rtmEvidence(ownEvidence(evidence, b, dup));
      tasks.push(task);
    }
    const gaps = [];
    if (row.kind === "ac") {
      if (!tasksAcs.has(row.id)) gaps.push("no-task");
      if (planOn && !planAcs.has(row.id)) gaps.push("no-test");
    } else if (!row.secTemplate && (row.kind === "sc" ? !planSec.has(row.key) && !quickSec.has(row.key) : !tasksSec.has(row.key) && !planSec.has(row.key))) {
      gaps.push("no-coverage"); // a scaffold's untouched EC/NFR/SC row is no gap — trace_check warns about none (review R11)
    }
    const status = gaps.length ? "untraced" : !tasks.length || tasks.some((t) => !t.done) ? "planned" : tasks.some((t) => !t.verified) ? "implemented" : "verified";
    const design = dinfo.filter((d) => cites(row, d.acs, d.sec) || (row.kind === "ac" && trackMarks.some((m) => m.acs.has(row.id) && d.title.includes(m.marker)))).map((d) => d.title);
    const decisions = decs.filter((d) => (row.kind === "ac" ? d.acs.has(row.id) : d.secIds.has(row.key))).map((d) => ({ id: d.id, title: d.title, kind: d.kind }));
    const r = {
      id: row.id,
      kind: row.kind,
      text: acOneLine(row.raw, row.id, RTM_TEXT_MAX),
      template: row.kind === "ac" ? placeholderReport(row.raw).length > 0 : row.secTemplate === true,
      status,
      gaps,
      design,
      tasks,
      tests,
      decisions,
      supersedes: row.kind === "ac" ? own.filter((v) => v.by === row.id).map((v) => v.feature + "/" + v.ac) : [],
      supersededBy: row.kind === "ac" ? (supBy.get(dirKey(dir) + "\n" + row.id) || []).slice() : [],
      approval: approval ? { at: approval.at, by: approval.by, forced: approval.forced, changed: rowChanged(row) } : null,
    };
    // Declared only by features not shipped yet: "to be superseded", never retired (1.15 — supersededByIndex().live); a
    // retired AC names its shipped declarers only.
    const supKey = dirKey(dir) + "\n" + row.id;
    if (r.supersededBy.length && supBy.live && !supBy.live.has(supKey)) r.supersedePending = true;
    else if (r.supersededBy.length && supBy.liveBy && supBy.liveBy.has(supKey)) r.supersededBy = supBy.liveBy.get(supKey).slice();
    return r;
  });
  const counts = { rows: out.length, verified: 0, implemented: 0, planned: 0, untraced: 0, template: 0, superseded: 0, supersedePending: 0 };
  for (const r of out) {
    counts[r.status]++;
    if (r.template) counts.template++;
    if (r.supersededBy.length) counts[r.supersedePending ? "supersedePending" : "superseded"]++;
  }
  const res = { ok: true, feature: slug, lang, kind, tracks: trackLabel(tracks), approval, counts, rows: out };
  if (code) res.code = { scanned: code.scanned, truncated: code.truncated };
  return res;
}
// trace_check {matrix: true} / `dev-spec trace <f> --matrix`: the matrix of one feature (see above). opts.code: + the test
// files naming each planned T-ID (bounded walk; opts.scan reuses one).
function traceMatrix(projectDir, name, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  return buildTraceMatrix(projectDir, f, opts);
}

// --- the matrix as CSV (RFC 4180) ---
// Records end with CRLF; a field holding a comma, a double quote, CR or LF is quoted (its quotes doubled). Formula
// injection guard (OWASP): a field starting with = + - @, a tab or a CR gets a leading apostrophe — a criterion written
// "=HYPERLINK(…)" or "@SUM(…)" is shown as text in Excel / LibreOffice / Sheets, never evaluated.
const RE_CSV_FORMULA = /^[=+\-@\t\r]/;
function csvCell(v) {
  let s = v == null ? "" : String(v);
  if (RE_CSV_FORMULA.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const csvRecord = (cells) => cells.map(csvCell).join(",") + "\r\n";
const RTM_CSV_COLS = ["feature", "id", "kind", "requirement", "status", "gaps", "template", "design", "tasks", "tests", "testFiles", "evidence", "decisions", "supersedes", "supersededBy", "approvedAt", "approvedBy", "changed"];
// One task of a row as words ("#3 done, not verified (latest run failed)"), in `lang`.
function rtmTaskWords(t, lang) {
  const R = i18n.msg(lang).rtm;
  if (!t.done) return R.task.open(t.number);
  if (t.verified) return t.nothingToVerify ? R.task.nothing(t.number) : R.task.verified(t.number);
  return R.task.unverified(t.number, i18n.msg(lang).evidenceGate.reason[t.reason] || t.reason || "");
}
function rtmEvidenceWords(t, lang) {
  const R = i18n.msg(lang).rtm;
  const e = t.evidence;
  if (e.exitCode == null) return R.evidenceNote(t.number, e.note || "—", e.at || null);
  return R.evidence(t.number, e.command || "—", e.exitCode, e.at || null, e.commit ? e.commit.slice(0, 12) + (e.dirty ? "-dirty" : "") : null, e.expected === "fail");
}
// matrices: traceMatrix results → the CSV text (header + one record per row; a Test files column when one was built with
// code). opts.document (spec_export): a UTF-8 BOM first — Excel reads a BOM-less CSV in the ANSI code page and mangles
// every accent — and a LAST record carrying the AUTO-GENERATED marker in its first cell ("# AUTO-GENERATED by dev-spec …",
// the other cells empty: the table stays rectangular, the header stays the first record a spreadsheet or a CSV reader
// takes as the column names, and `comment="#"` readers skip it); isGeneratedOrAbsent finds it in the file's tail.
// `dev-spec trace --csv` prints the data alone (no BOM, no marker record) for pipes and scripts.
function matrixCsv(matrices, lang, opts = {}) {
  const R = i18n.msg(lang).rtm;
  const withCode = matrices.some((m) => m && m.code);
  const cols = RTM_CSV_COLS.filter((c) => c !== "testFiles" || withCode);
  const yn = (v) => (v === true ? R.yes : v === false ? R.no : R.unknown);
  let out = (opts.document ? BOM_CHAR : "") + csvRecord(cols.map((c) => R.cols[c]));
  for (const m of matrices) {
    if (!m || !Array.isArray(m.rows)) continue;
    for (const r of m.rows) {
      const cell = {
        feature: m.feature,
        id: r.id,
        kind: r.kind.toUpperCase(),
        requirement: mdPlainText(r.text), // plain text: an escape / entity as the character (1.17 verification N3)
        status: R.status[r.status] || r.status,
        gaps: r.gaps.map((g) => R.gap[g === "no-coverage" && r.kind === "sc" ? "no-coverage-sc" : g] || g).join("; "),
        template: r.template ? R.yes : "",
        design: r.design.join("; "),
        tasks: r.tasks.map((t) => rtmTaskWords(t, lang)).join("; "),
        tests: r.tests.map((t) => t.id).join("; "),
        testFiles: r.tests.map((t) => `${t.id}: ${t.outsideCode ? R.outsideCode : t.files && t.files.length ? t.files.join(", ") : R.notInCode}`).join("; "),
        evidence: r.tasks.filter((t) => t.evidence).map((t) => rtmEvidenceWords(t, lang)).join("; "),
        decisions: r.decisions.map((d) => `${d.id} ${mdPlainText(d.title)}`).join("; "),
        supersedes: r.supersedes.join("; "),
        supersededBy: r.supersedePending ? R.toBeSupersededBy(r.supersededBy.join("; ")) : r.supersededBy.join("; "), // 1.15: pending reads apart
        approvedAt: r.approval ? r.approval.at || "" : "",
        approvedBy: r.approval ? (r.approval.by || "—") + (r.approval.forced ? ` (${R.forced})` : "") : "",
        changed: r.approval ? yn(r.approval.changed) : "",
      };
      out += csvRecord(cols.map((c) => cell[c]));
    }
  }
  if (opts.document) out += csvRecord(cols.map((c, k) => (k ? "" : "# " + R.autogen)));
  return out;
}

// --- the matrix in the stakeholder export (markdown → the export's escaping renderer) ---
const RTM_ICON = { verified: "✅", implemented: "⚠", planned: "☐", untraced: "✗" };
// A table cell: a '|' escaped, lines folded (mdCell), and an HTML comment opener neutralized — markdownToHtml drops
// <!-- … --> first, so an opener in one cell and a closer in a later one would swallow the cells between them.
const rtmCell = (s) => mdCell(s).replace(/<!--/g, "&lt;!--");
// The requirement's cell (the row's first text — only its ID before it, no backtick): an opener inside a code span stays as
// written (commentInert's rule — "escape `<!--` in names" showed `&lt;!--` in the export's code; 1.17 verification N3).
const rtmTextCell = (s) => inertOutsideCode(mdCell(s), false);
function rtmMarkdown(mx, lang) {
  const R = i18n.msg(lang).rtm;
  const code = (s) => "`" + s + "`";
  const lines = [italic(R.legend)];
  const a = mx.approval;
  lines.push("", a ? R.approvedLine(utcStamp(a.at), a.by == null ? "—" : a.by, a.forced) : R.notApproved);
  if (!mx.rows.length) return lines.concat(["", italic(R.none)]).join("\n");
  const cols = ["id", "requirement", "status", "design", "tasks", "tests", "decisions"].map((c) => R.cols[c]);
  lines.push("", `| ${cols.join(" | ")} |`, `|${cols.map(() => "---").join("|")}|`);
  for (const r of mx.rows) {
    const notes = [];
    if (r.supersededBy.length) notes.push((r.supersedePending ? R.toBeSupersededBy : R.supersededBy)(r.supersededBy.map(code).join(", ")));
    if (r.supersedes.length) notes.push(i18n.msg(lang).stakeholderExport.supersedes(r.supersedes.map(code).join(", ")));
    if (r.template) notes.push(R.template);
    if (r.approval && r.approval.changed === true) notes.push(R.changedSince);
    const gaps = r.gaps.map((g) => R.gap[g === "no-coverage" && r.kind === "sc" ? "no-coverage-sc" : g] || g);
    const taskIcon = (t) => (!t.done ? "☐" : t.verified ? "✅" : "⚠");
    const cells = [
      r.supersededBy.length && !r.supersedePending ? `~~${r.id}~~` : r.id,
      rtmTextCell(r.text) + (notes.length ? " " + italic("(" + rtmCell(notes.join("; ")) + ")") : ""),
      `${RTM_ICON[r.status]} ${R.status[r.status]}` + (gaps.length ? " — " + rtmCell(gaps.join("; ")) : ""),
      r.design.length ? rtmCell(r.design.join("; ")) : "—",
      r.tasks.length ? r.tasks.map((t) => `#${t.number} ${taskIcon(t)}`).join(", ") : "—",
      r.tests.length ? r.tests.map((t) => t.id).join(", ") : "—",
      r.decisions.length ? rtmCell(r.decisions.map((d) => d.id).join(", ")) : "—",
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}
// The project document's per-feature status counts (active features with requirements).
function rtmProjectMarkdown(projectDir, lang, features) {
  const R = i18n.msg(lang).rtm;
  const supBy = supersededByIndex(projectDir);
  const rows = [];
  for (const f of features) {
    const mx = buildTraceMatrix(projectDir, f, { supBy });
    if (!mx.rows.length) continue;
    const c = mx.counts;
    rows.push(`| ${rtmCell(f.slug)} | ${c.rows} | ${c.verified} | ${c.implemented} | ${c.planned} | ${c.untraced} |`);
  }
  if (!rows.length) return italic(R.none);
  return [italic(R.projectLegend), "", `| ${R.projectCols.join(" | ")} |`, `|${R.projectCols.map(() => "---").join("|")}|`, ...rows].join("\n");
}

module.exports = { RTM_STATUSES, RTM_KIND_ORDER, RTM_TEXT_MAX, acNums, supersededByIndex, shippedSupersedeKeys,
  featureShipped, rtmEvidence, buildTraceMatrix, traceMatrix, RE_CSV_FORMULA, csvCell, csvRecord, RTM_CSV_COLS,
  rtmTaskWords, rtmEvidenceWords, matrixCsv, RTM_ICON, rtmCell, rtmTextCell, rtmMarkdown, rtmProjectMarkdown, __link };
