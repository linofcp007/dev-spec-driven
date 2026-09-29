"use strict";

/**
 * dev-spec-driven engine — spec_task_brief.
 * A self-contained brief for ONE task (subagent-driven execution): its block, criteria, planned tests, design sections,
 * steering, decisions and definition of done.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeTasks, AI_SECTIONS, atxHeading, blockLines, briefDecisions, briefDependencies, briefGlossary, briefSteering,
  bugfixGate, bugSectionFilled, criterionBlocks, detectTracks, ensureDir, errs, existingFeature, expectsFail,
  extractAcIds, extractSection, extractTestIds, featureLang, fenceStep, forgetCached, globalConstraints, implementsRel,
  lineMap, packTracks, planIdText, projectChecks, RE_LIST_ITEM, readIfExists, readState, REPRO_SYN, resolveTask,
  ROOT_CAUSE_SYN, SAAS_SECTIONS, stripFencedCode, stripHtmlComments, stripSupersedes, taskBlocks, taskDepsBlockedNote,
  taskMarkers, taskNumber, taskProse, taskSchedule, trackAcIds, trackLabel, trackMarker, verifyPipes, writeIfAbsent;
function __link(E) { ({ activeTasks, AI_SECTIONS, atxHeading, blockLines, briefDecisions, briefDependencies,
  briefGlossary, briefSteering, bugfixGate, bugSectionFilled, criterionBlocks, detectTracks, ensureDir, errs,
  existingFeature, expectsFail, extractAcIds, extractSection, extractTestIds, featureLang, fenceStep, forgetCached,
  globalConstraints, implementsRel, lineMap, packTracks, planIdText, projectChecks, RE_LIST_ITEM, readIfExists,
  readState, REPRO_SYN, resolveTask, ROOT_CAUSE_SYN, SAAS_SECTIONS, stripFencedCode, stripHtmlComments, stripSupersedes,
  taskBlocks, taskDepsBlockedNote, taskMarkers, taskNumber, taskProse, taskSchedule, trackAcIds, trackLabel,
  trackMarker, verifyPipes, writeIfAbsent } = E); }

// ---------------------------------------------------------------------------
// spec_task_brief — a self-contained brief for ONE task (subagent-driven execution)
// ---------------------------------------------------------------------------

// +ai prompt work (touches prompts/, or an _Affects evals:_ task about a prompt) stays with the controller.
function isPromptTask(block, mk, tracks) {
  return tracks.includes("ai") && (mk.implements.some((f) => /(^|[\\/])prompts[\\/]/.test(f)) ||
    (mk["affects evals"].length > 0 && /(?<![\p{L}])prompts?(?![\p{L}])/iu.test(block.text)));
}

// AC ID → the full logical criterion (multi-line EARS folded by criterionBlocks). Exact-ID keys, so
// US-1.AC-1 can never resolve to US-1.AC-10.
const RE_DEFINES_AC = /^(?:(?:\d+[.)]|[-*+])\s+)?(?:\*\*|__)?(US-\d+\.AC-\d+)(?!\d)/;
function acIndex(reqText) {
  const map = new Map();
  const { cleaned, blocks } = criterionBlocks(reqText || "");
  const entry = (id, b) => ({ id, text: b.text.replace(RE_LIST_ITEM, ""), line: b.line });
  for (const b of blocks) {
    const m = b.text.match(RE_DEFINES_AC);
    if (m && !map.has(m[1])) map.set(m[1], entry(m[1], b));
  }
  // A `_Supersedes: other/US-1.AC-2_` reference is another feature's AC, not one of this feature's — stripped over the
  // criterion's own lines (joined by "\n"), so a marker wrapped onto the next line follows traceCheck's wrap rule.
  const byLine = lineMap(cleaned);
  for (const b of blocks) {
    for (const id of extractAcIds(stripSupersedes(blockLines(byLine, b).map((l) => l.text).join("\n")))) if (!map.has(id)) map.set(id, entry(id, b));
  }
  stripFencedCode(stripHtmlComments(reqText || "")).split(/\r?\n/).forEach((l, i) => { // a table in a ``` example is code
    if (!/^\s*\|/.test(l)) return;
    for (const id of extractAcIds(stripSupersedes(l))) if (!map.has(id)) map.set(id, { id, text: l.trim(), line: i + 1 });
  });
  return map;
}

// The `### US-n …` heading and its body (As a / Why P1 / Independent Test) up to the next heading.
function storyContext(reqText, n) {
  const lines = stripHtmlComments(reqText || "").split(/\r?\n/);
  const re = new RegExp("^#{1,6}\\s+US-" + n + "(?!\\d)");
  const start = lines.findIndex((l) => re.test(l));
  if (start === -1) return null;
  const out = [lines[start].replace(/^#{1,6}\s+/, "").trim()];
  for (let i = start + 1; i < lines.length && !/^#{1,6}\s/.test(lines[i]); i++) {
    if (lines[i].trim()) out.push(lines[i].trim());
  }
  return out;
}

// T-ID → its test-plan row. A table row is keyed by the T-ID in its FIRST cell (other cells may cite
// IDs of other tests); a list item is keyed by a T-ID it starts with. Rows remember their table header.
function testIndex(planText) {
  const map = new Map();
  let header = null;
  let sep = null;
  let inTable = false;
  for (const line of planIdText(planText || "").split(/\r?\n/)) {
    if (/^\s*\|/.test(line)) {
      if (!inTable) { inTable = true; header = line.trim(); sep = null; continue; }
      if (!sep && /^\s*\|[\s:|-]+$/.test(line.trim())) { sep = line.trim(); continue; }
      for (const id of extractTestIds(line.split("|")[1] || "")) {
        if (!map.has(id)) map.set(id, { id, row: line.trim(), header, sep });
      }
      continue;
    }
    inTable = false;
    const lead = line.replace(RE_LIST_ITEM, "").replace(/^[\s*`_]+/, "");
    if (RE_LIST_ITEM.test(line)) {
      const m = lead.match(/^T-\d+(?!\d)/);
      if (m && !map.has(m[0])) map.set(m[0], { id: m[0], row: line.trim(), header: null, sep: null });
    }
  }
  return map;
}

// design.md split into its `##` sections (nested `###` content stays in the body).
function designSections(designText) {
  const out = [];
  let cur = null;
  const fst = { fence: null };
  for (const line of stripHtmlComments(designText || "").split(/\r?\n/)) {
    const h = !fenceStep(fst, line) && atxHeading(line, 2, 2); // /^##\s+(.*?)\s*$/
    if (h) { cur = { title: h.text, body: [] }; out.push(cur); continue; }
    if (cur) cur.body.push(line);
  }
  return out.map((s) => ({ title: s.title, body: s.body.join("\n").trim() }));
}

const BRIEF_DESIGN_BUDGET = 4000; // chars of design text carried into a brief (keeps it ~≤8 KB)

function taskBrief(projectDir, name, number, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const { slug, dir, root } = f;
  const tasksText = readIfExists(path.join(dir, "tasks.md"));
  const E = errs(projectDir, slug);
  if (tasksText == null) return { ok: false, error: E.tasksMissing(slug) };

  const lng = featureLang(projectDir, slug);
  const t = i18n.brief(lng);
  const tracks = detectTracks(dir);
  const blocks = taskBlocks(tasksText);
  const rel = (p) => path.relative(projectDir, p).split(path.sep).join("/");
  const exDir = path.join(dir, ".execution");

  let block;
  const activeBlocks = taskBlocks(activeTasks(tasksText, tracks) || "");
  if (number == null || number === "") {
    // "The next task" is next_task's (taskSchedule — its _Depends:_ all done): a removed track's block is inactive, never
    // served as next. An explicit number still reaches the whole file (like complete_task).
    const sch = taskSchedule(activeBlocks);
    block = sch.next;
    if (!block && activeBlocks.some((b) => !b.done)) { // 1.14 F3: open tasks, none can start — say why, never "all done"
      return { ok: true, feature: slug, lang: lng, tracks: trackLabel(tracks), task: null, ...(sch.blocked.length ? { blocked: sch.blocked } : { skipped: sch.skipped }),
        note: taskDepsBlockedNote(sch, slug, lng) };
    }
    if (!block) return { ok: true, feature: slug, lang: lng, tracks: trackLabel(tracks), task: null, note: t.allDone };
  } else {
    const n = taskNumber(number);
    if (!Number.isFinite(n)) return { ok: false, error: E.numberInt };
    block = resolveTask(blocks, n); // the task completeTask would tick (first OPEN one of a duplicated number)
    if (!block) return { ok: false, error: E.taskNotFound(n) };
  }

  const reqText = readIfExists(path.join(dir, "requirements.md")) || "";
  const planText = readIfExists(path.join(dir, "test-plan.md")) || "";
  const mk = taskMarkers(block);
  // The task's OWN text — fenced code under it is an example (taskProse): its AC/T IDs are never the task's (they gave the
  // brief a foreign AC, flipped the loop to tdd for the example's T-ID and reported it unresolved, while trace_check read
  // the same criterion as uncovered). The rendered brief still shows the whole body.
  const blockText = taskProse(block).join("\n");
  // A bugfix task carries the bug itself: bug.md's Reproduction and Root Cause (null while still unwritten).
  let bug = null;
  const kind = readState(projectDir, slug).kind;
  // The same gate complete_task applies — reported up front, so `done --run` refuses BEFORE running any command.
  const gate = bugfixGate(dir, kind, blocks, block, lng);
  if (kind === "bugfix") {
    const bugText = readIfExists(path.join(dir, "bug.md")) || "";
    const sec = (syn) => (bugSectionFilled(bugText, syn) ? stripHtmlComments(extractSection(bugText, syn)).trim() : null);
    bug = { reproduction: sec(REPRO_SYN), rootCause: sec(ROOT_CAUSE_SYN) };
  }

  // Acceptance criteria and tests referenced by the task, resolved to their spec text.
  const acs = acIndex(reqText);
  const acIds = [...extractAcIds(blockText)];
  const acceptanceCriteria = acIds.filter((id) => acs.has(id)).map((id) => acs.get(id));
  const tests = testIndex(planText);
  const testIds = [...extractTestIds(blockText)];
  const testRows = testIds.filter((id) => tests.has(id)).map((id) => tests.get(id));
  const unresolved = { acs: acIds.filter((id) => !acs.has(id)), tests: testIds.filter((id) => !tests.has(id)) };
  const dec = briefDecisions(dir, acIds, testIds, blockText); // 1.14 C2: decisions.md entries citing the task's IDs (bounded)
  // 1.16 Q3: the glossary entries the task's text and its criteria use (a term or an avoided word; bounded)
  const gloss = briefGlossary(root, [blockText, ...acceptanceCriteria.map((a) => a.text)].join("\n"));

  // Which loop the implementer follows; +ai prompt work stays with the controller (evals cost money,
  // accept/revert is a judgment call).
  // The scaffold also puts _Affects evals:_ on ordinary code tasks, so that alone doesn't make a prompt task.
  const loop = isPromptTask(block, mk, tracks) ? "ai-prompt" : tracks.includes("tdd") && testIds.length ? "tdd" : "core";
  const inlineOnly = loop === "ai-prompt";

  // Story context: the task's own story tag plus the stories its ACs belong to.
  const storyNums = new Set();
  if (block.story && /^US\d+$/i.test(block.story)) storyNums.add(block.story.replace(/\D/g, ""));
  acIds.forEach((id) => storyNums.add(id.match(/^US-(\d+)/)[1]));
  const stories = [...storyNums].map((n) => storyContext(reqText, n)).filter(Boolean);

  // Design sections that mention the task's IDs or files, plus the track sections its markers touch.
  const sections = designSections(readIfExists(path.join(dir, "design.md")) || "");
  // The files as the design spells them: `src/payment.js:10` / `#L10` / backticks never appear there (implementsRel, the
  // way briefSteering reads them) — the raw spelling left the design section out.
  const impFiles = mk.implements.map(implementsRel).filter(Boolean);
  const needles = [...acIds, ...testIds, ...impFiles, ...impFiles.map((f) => path.posix.basename(f)).filter((b) => b.length >= 5)];
  // A task proving a +sec / +privacy criterion reads that track's design sections (threat model, authz, retention…).
  // … and a track pack's (1.15) — its sections are the rigor its criteria were written for.
  const trackMarks = ["sec", "privacy", "dist", ...packTracks()].filter((tr) => tracks.includes(tr) && acIds.some((id) => trackAcIds(reqText, tr).has(id))).map((tr) => trackMarker(tr));
  const want = (s) => {
    const hay = s.title + "\n" + s.body;
    if (needles.some((x) => hay.includes(x))) return true;
    const title = s.title.toLowerCase();
    const syn = (list, nm) => list.find((x) => x.name === nm).syn.some((y) => title.includes(y));
    if (mk["emits metrics"].length && syn(SAAS_SECTIONS, "Observability")) return true;
    if (mk["affects evals"].length && (syn(AI_SECTIONS, "Prompt Architecture") || syn(AI_SECTIONS, "Eval Strategy"))) return true;
    if (trackMarks.some((m) => s.title.includes(m))) return true; // the case-sensitive marker (C4)
    return false;
  };
  let budget = BRIEF_DESIGN_BUDGET;
  const included = [];
  const omitted = [];
  for (const s of sections.filter(want)) {
    if (s.body.length <= budget) { included.push(s); budget -= s.body.length; }
    else omitted.push(s.title);
  }

  // Steering: the default files (as before) + front-matter scoped ones (always / fileMatch on _Implements:_ paths).
  const steer = briefSteering(root, tracks, mk.implements);
  const steering = steer.included.map((s) => rel(path.join(steer.dir, s.name)));

  const paths = {
    dir: exDir,
    brief: path.join(exDir, `task-${block.number}-brief.md`),
    report: path.join(exDir, `task-${block.number}-report.md`),
    ledger: path.join(exDir, "ledger.md"),
  };
  // The runnable _Verify:_ commands that pipe into another one: their exit code is the pipeline's LAST command's.
  const pipes = verifyPipes(block);
  const expectFail = expectsFail(block); // B5: _Expect: fail_ — the brief's Verification section says the run must fail
  const checks = projectChecks(projectDir).checks; // B5: roadmap.json meta.checks — part of the definition of done
  const deps = briefDependencies(activeBlocks, block); // 1.14 F3: its _Depends:_ and where each stands

  const md = i18n.renderBrief({
    feature: slug,
    tracks: trackLabel(tracks),
    task: block,
    dependsOn: deps,
    loop,
    inlineOnly,
    stories,
    bug,
    acceptanceCriteria,
    glossary: gloss.items,
    glossaryOmitted: gloss.omitted,
    tests: testRows,
    evals: mk["affects evals"],
    metrics: mk["emits metrics"],
    implements: mk.implements,
    unresolved,
    design: { path: rel(path.join(dir, "design.md")), toc: sections.map((s) => s.title), included, omitted },
    steering,
    steeringScoped: steer.included.filter((s) => s.body).map((s) => ({ path: rel(path.join(steer.dir, s.name)), patterns: s.patterns, body: s.body })),
    steeringManual: steer.manual.map((n) => rel(path.join(steer.dir, n))),
    verify: mk.verify,
    verifyPipes: pipes, // a pipe masks the check's exit code — the brief says so
    expectFail,
    projectChecks: checks,
    globalConstraints: globalConstraints(tasksText),
    decisions: dec.items,
    decisionsOmitted: dec.omitted,
    reportPath: rel(paths.report),
  }, lng);

  const write = !!opts.write;
  if (write) {
    ensureDir(exDir);
    writeIfAbsent(path.join(exDir, ".gitignore"), "*\n"); // self-ignoring scratch: no repo config needed
    writeIfAbsent(paths.ledger, t.ledgerHeader(slug));    // the ledger is appended by the controller, never reset
    forgetCached(paths.brief); // written in place below: its cached text is dropped
    fs.writeFileSync(paths.brief, md, "utf8");            // derived artifact: regenerated on every call
  }
  const includeBrief = opts.includeBrief != null ? !!opts.includeBrief : !write;

  const res = {
    ok: true,
    feature: slug,
    lang: lng,
    tracks: trackLabel(tracks),
    task: { number: block.number, text: block.text, story: block.story, parallel: block.parallel, done: block.done, phase: block.phase, checkpoint: block.checkpoint },
    loop,
    inlineOnly,
    acceptanceCriteria,
    tests: testRows.map((r) => ({ id: r.id, row: r.row })),
    implements: mk.implements,
    metrics: mk["emits metrics"],
    evals: mk["affects evals"],
    verify: mk.verify,
    unresolved,
    designSections: included.map((s) => s.title),
    // which steering the brief carries and why (inclusion mode; the patterns/paths that matched a fileMatch file)
    steering: {
      included: steer.included.map((s) => Object.assign({ file: rel(path.join(steer.dir, s.name)), inclusion: s.inclusion },
        s.inclusion === "fileMatch" ? { patterns: s.patterns, matched: s.matched, quoted: !!s.body } : {})),
      manual: steer.manual.map((n) => rel(path.join(steer.dir, n))),
    },
    paths,
    wrote: write,
  };
  if (bug) res.bug = bug;
  if (gate) Object.assign(res, { gated: gate.gated, gateError: gate.error });
  if (pipes.length) res.verifyPipes = pipes; // stable: branch on it, never on the brief's text
  if (expectFail) res.expect = "fail"; // B5 (kept with write:true, like verify): the run must exit non-zero
  if (checks.length) res.projectChecks = checks; // B5: [{name, command}] the definition of done names
  if (deps.length) res.dependsOn = deps.map((d) => ({ number: d.number, status: d.status })); // 1.14 F3 (kept with write:true: identifiers only)
  if (dec.items.length) res.decisions = dec.items.map((x) => ({ id: x.id, title: x.title, kind: x.kind, affects: x.affects })); // 1.14 C2
  if (dec.omitted.length) res.decisionsOmitted = dec.omitted;
  if (gloss.items.length) res.glossary = gloss.items.map((g) => ({ term: g.term, definition: g.definition, avoid: g.avoid })); // 1.16 Q3
  if (gloss.omitted.length) res.glossaryOmitted = gloss.omitted;
  if (block.done) res.note = t.alreadyDone(block.number);
  if (includeBrief) res.brief = md;
  else if (write) {
    // write:true is the controller's call (references/subagent-execution.md): the brief lives in the file, so the result
    // keeps what the controller acts on — the paths, the task's identity, its loop (inlineOnly), _Verify:_ command, the
    // IDs it cites (refs) and the unresolved ones, markers, the bugfix gate — never the spec text the brief quotes (AC
    // texts, test rows, design sections, steering, bug.md). includeBrief:true returns everything, brief included.
    res.refs = { acs: acceptanceCriteria.map((a) => a.id), tests: testRows.map((r) => r.id) };
    if (res.decisions) res.refs.decisions = res.decisions.map((x) => x.id); // 1.14 C2: the IDs only (their text is in the brief)
    if (res.glossary) res.refs.glossary = res.glossary.map((g) => g.term); // 1.16 Q3: the terms only (the entries are in the brief)
    for (const k of ["acceptanceCriteria", "tests", "designSections", "steering", "bug", "decisions", "glossary"]) delete res[k];
  }
  return res;
}

module.exports = { isPromptTask, RE_DEFINES_AC, acIndex, storyContext, testIndex, designSections, BRIEF_DESIGN_BUDGET,
  taskBrief, __link };
