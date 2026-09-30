"use strict";

/**
 * dev-spec-driven engine — spec_import.
 * A spec written for another tool becomes a NEW dev-spec feature: read-only on the source, inside the project only,
 * never over an existing feature. The per-tool parsers live beside this file.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../../i18n.js");
const { parseBmad } = require("./bmad.js"); // load time
const { parseFluidplan } = require("./fluidplan.js"); // load time
const { parseExecPlan, parsePlan } = require("./plan.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let BOM_CHAR, classify, closesFence, configuredLang, createFeature, decisionEntryLines, DECISIONS_FILE, extractAcIds,
  fenceStep, headingHasMarker, indentOf, inertOutsideCode, insertPackRequirements, isInsideDir, isLtUnit, isPackTrack,
  isWsUnit, markerTracks, maybeRefreshRoadmap, normalizeLang, own, packOf, packRequirementsBlock, packTaskBlock,
  parseKiro, parseOpenSpec, parseSpecKit, parseTracks, projectLang, RE_FENCE, RE_TESTABILITY, readIfExists,
  requirementAcIds, resolveFeature, restAfterBlanks, scaffoldTestPlan, sectionDropLines, stripHtmlComments, testIndex,
  toPosix, trackAcIds, trackDesignBlock, trackMarker, trackTaskHeadingIs, unknownTracksError, withTrackBlocks,
  writeFileAtomic;
function __link(E) { ({ BOM_CHAR, classify, closesFence, configuredLang, createFeature, decisionEntryLines,
  DECISIONS_FILE, extractAcIds, fenceStep, headingHasMarker, indentOf, inertOutsideCode, insertPackRequirements,
  isInsideDir, isLtUnit, isPackTrack, isWsUnit, markerTracks, maybeRefreshRoadmap, normalizeLang, own, packOf,
  packRequirementsBlock, packTaskBlock, parseKiro, parseOpenSpec, parseSpecKit, parseTracks, projectLang, RE_FENCE,
  RE_TESTABILITY, readIfExists, requirementAcIds, resolveFeature, restAfterBlanks, scaffoldTestPlan, sectionDropLines,
  stripHtmlComments, testIndex, toPosix, trackAcIds, trackDesignBlock, trackMarker, trackTaskHeadingIs,
  unknownTracksError, withTrackBlocks, writeFileAtomic } = E); }

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
// A block of imported lines as requirements.md holds it: commentInert outside fenced code (a fenced `<!--` is code, kept), and a
// fence the block leaves open closed at its end (the block starts outside any fence: it follows a heading the importer writes).
function inertBlock(lines) {
  const st = { fence: null };
  const out = lines.map((l) => (fenceStep(st, l) ? l : commentInert(l)));
  if (st.fence) out.push(" ".repeat(st.fence.indent) + st.fence.mark);
  return out;
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
  // negation), else in the project's configured language (full review Pb2); an explicit lang wins. The project's signal overrides
  // (1.21 F2 — .specs/classifier.json) apply as for spec_classify / spec_create (projectDir); an import never learns from them.
  const cls = classify(evidence, { name, lang: opts.lang, fallbackLang: configuredLang(projectDir), projectDir });
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

module.exports = { IMPORT_TOOLS, IMPORT_MAX_BYTES, TEXT_IMPORT_TOOLS, commentInert, inertBlock, RE_IMPORT_TASK_HEAD,
  replaceRequirementsMarkers, replaceUnderscoreList, importTasks, fitTemplateTasks, C3_PARSERS, importSpec, __link };
