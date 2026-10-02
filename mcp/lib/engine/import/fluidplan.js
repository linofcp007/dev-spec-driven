"use strict";

/**
 * dev-spec-driven engine — spec_import fluidplan.
 * A plan settled with fluidplan (plan.json / answers.json, or its PLAN.md / DECISIONS.md exports) → the import model.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../../i18n.js");
const { TASK_MARKER_LABELS } = require("../tasks.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let DECISION_TITLE_MAX, dependencyCycles, earsFromPlanText, fenceStep, firstParagraph, inertOutsideCode, isInsideDir,
  isObj, isWsUnit, mdBody, mdHeadings, mdRange, newImportModel, own, planPaths, planStory, RE_CHECKPOINT,
  RE_LINE_TERMINATOR, restAfterBlanks, safeReaddir, stripHtmlComments, taskLine, taskMarkers, tidyLines, toPosix;
function __link(E) { ({ DECISION_TITLE_MAX, dependencyCycles, earsFromPlanText, fenceStep, firstParagraph,
  inertOutsideCode, isInsideDir, isObj, isWsUnit, mdBody, mdHeadings, mdRange, newImportModel, own, planPaths,
  planStory, RE_CHECKPOINT, RE_LINE_TERMINATOR, restAfterBlanks, safeReaddir, stripHtmlComments, taskLine, taskMarkers,
  tidyLines, toPosix } = E); }

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
  model.nameFallback = fp.id || path.basename(planDir || dir); // a title that slugifies to nothing (importSpec, 1.22 review)
  model.nameHint = model.title || model.nameFallback;
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

module.exports = { FP_PLAN_ID, FP_ID, FP_OTHER, FP_SEC, RE_FP_STATE, FP_LINE_MAX, fpShort, fpMap, FP_TITLE_SUFFIX,
  fpTitleOf, fpTaskHeading, fpPhaseHeading, fpAcceptanceItem, RE_FP_DEC_HEAD, fpDecLine, FP_TASK_FIELDS, FP_DEC_FIELDS,
  FP_OPS, FP_IMPORTANCE, FP_SRC_LABELS, fpFilled, FP_LS_PS, RE_FP_BREAK, RE_FP_BREAKS, RE_FP_LINE_SPLIT,
  RE_FP_VERIFY_BAD, fpOneLine, fpList, fpStr, RE_FP_MARKER_LIKE, fpInert, fpV, fpHead, fpTitle, fpLine, fpProse, fpCell,
  fpVerdictOfText, fpEdits, fpTextOf, fpHasEdits, fpItemVerdict, fpVerdict, fpStatus, fpOptions, fpChoice, fpChoices,
  fpValue, fpOptionLabel, fpOrderedPhases, fpControlSummary, fpDecisionTasks, fpFromPlanJson, fpEmpty, fpNewDecision,
  RE_FP_TO_CHANGE, fpTableCells, fpHeader, fpFields, fpTaskFromMd, fpParsePlanMd, fpParseDecisionsMd, fpConfig,
  fpPlansDir, fpDocKind, fpSplitDocs, parseFluidplan, fpImportModel, FP_TRADEOFFS_HEADING, __link };
