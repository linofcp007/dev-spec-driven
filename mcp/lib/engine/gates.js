"use strict";

/**
 * dev-spec-driven engine — gates and flows.
 * The ONE view doctor / approve / next_action / finish / roadmap share of what a phase still lacks: the phase walk,
 * pending gates, changed-since-approval, each phase's approval checks, the flows (design-first) and the phase detector.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { featureLocked } = require("./locks.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeDesign, activeSectionTracks, activeTasks, artifactMatches, artifactReport, artifactState, bugPlaceholders,
  clarificationMarkers, detectTracks, earsUnlinted, earsValidate, existingFeature, existsCached, extractSection,
  extractTestIds, featureLang, finishFeature, hasProseOutsideBrackets, headingsOnly, isBugStep, isObj,
  isPlaceholderTask, isRecord, isSpikeDir, maybeRefreshRoadmap, normalizeLang, parseTasks, PHASE_FILE, phaseFile,
  PHASES, placeholderReport, placeholderSummary, planIdText, projectLang, RE_TODO_SENTINEL, readIfExists, readJson,
  readState, REPRO_SYN, ROOT_CAUSE_SYN, SAMPLE_GOLDEN, sectionState, spikePhase, statePath, stripFencedCode,
  stripHtmlComments, taskBlocks, taskDepsCheck, traceCheck, traceGapLines, useTemplateScopeOf, writeFileAtomic;
function __link(E) { ({ activeDesign, activeSectionTracks, activeTasks, artifactMatches, artifactReport, artifactState,
  bugPlaceholders, clarificationMarkers, detectTracks, earsUnlinted, earsValidate, existingFeature, existsCached,
  extractSection, extractTestIds, featureLang, finishFeature, hasProseOutsideBrackets, headingsOnly, isBugStep, isObj,
  isPlaceholderTask, isRecord, isSpikeDir, maybeRefreshRoadmap, normalizeLang, parseTasks, PHASE_FILE, phaseFile,
  PHASES, placeholderReport, placeholderSummary, planIdText, projectLang, RE_TODO_SENTINEL, readIfExists, readJson,
  readState, REPRO_SYN, ROOT_CAUSE_SYN, SAMPLE_GOLDEN, sectionState, spikePhase, statePath, stripFencedCode,
  stripHtmlComments, taskBlocks, taskDepsCheck, traceCheck, traceGapLines, useTemplateScopeOf, writeFileAtomic } = E); }

// Phases that only exist for a track: an inactive track's artifact (kept on disk after add_track --remove)
// is not a gate, not a phase and not a "changed since approval".
function phaseActive(phase, tracks) {
  return phase === "test-plan" ? tracks.includes("tdd") : phase === "eval-plan" ? tracks.includes("ai")
    : phase === "tests" ? tracks.includes("tdd") || tracks.includes("ai") : true;
}
// Phase 4 — the hard gate (failing tests on +tdd, the eval harness + baseline on +ai), approved before any
// implementation. It has no artifact of its own, so it is due once the plan it implements exists (test-plan.md /
// eval-plan.md of an active track) — never for a bugfix, whose failing regression test is one of its tasks.
function testsGateDue(dir, tracks, kind) {
  if (kind === "bugfix" || !phaseActive("tests", tracks)) return false;
  return (tracks.includes("tdd") && fs.existsSync(path.join(dir, "test-plan.md"))) || (tracks.includes("ai") && fs.existsSync(path.join(dir, "eval-plan.md")));
}

function detectPhase(dir, tracks) {
  useTemplateScopeOf(dir); // the project's templates are template text too (1.14)
  const has = (f) => existsCached(path.join(dir, f));
  const tasks = parseTasks(activeTasks(readIfExists(path.join(dir, "tasks.md")), tracks));
  const anyDone = tasks.some((t) => t.done);
  const allDone = tasks.length > 0 && tasks.every((t) => t.done);
  if (isSpikeDir(dir)) return spikePhase(dir, tasks); // 1.14 C2: question → investigate → decide (no planning chain)
  if (allDone) return "complete";
  if (anyDone) return "executing";
  // Planning: the EARLIEST artifact of the chain that is still a template (artifactState). design.md is judged
  // on its active part — a removed track's [SaaS]/[AI] sections keep their TODOs, and they are inactive.
  // A bugfix has no design of its own (bug.md takes its place): its design.md exists only for a track's sections,
  // so once that track is removed and nothing active is left, the file is out of the chain — not a phase forever open.
  const activeDesignText = () => activeDesign(readIfExists(path.join(dir, "design.md")) || "", tracks);
  const bugfix = (readJson(statePath(dir)).data || {}).kind === "bugfix";
  const planning = [["requirements", "requirements.md"], ["design", "design.md"], ["test-plan", "test-plan.md"], ["eval-plan", "eval-plan.md"]];
  if (featureFlow(dir) === "design-first") planning.unshift(planning.splice(1, 1)[0]); // C3: design-first — the design is the chain's first artifact
  const chain = planning
    .filter(([ph, f]) => phaseActive(ph, tracks) && has(f) && !(f === "design.md" && bugfix && headingsOnly(activeDesignText())));
  // requirements.md too: its +saas/+ai template criteria sit under [SaaS]/[AI] headings, inactive once the track is off.
  const stateOf = (f) => artifactState(f === "design.md" ? { text: activeDesignText() }
    : f === "requirements.md" ? { text: activeDesign(readIfExists(path.join(dir, f)) || "", tracks) } : { file: path.join(dir, f) });
  const open = chain.find(([, f]) => stateOf(f) !== "filled");
  // A scaffold whose tasks are ALL still placeholders / template track tasks hasn't been broken into tasks yet.
  // One real task wins over an unfilled chain (the task-driven model); the verbatim bugfix steps only count
  // once the bug's planning chain is filled.
  if (has("tasks.md") && tasks.some((t) => !isPlaceholderTask(t.text) && !(open && isBugStep(t.text)))) return "tasks-ready";
  // So a fresh scaffold is in "requirements" — not in its last scaffolded phase (test-plan 20%, or tasks-ready
  // 30% for +saas/+ai). Once every artifact is filled, the last planning phase present.
  if (open) return open[0];
  if (chain.length) return chain[chain.length - 1][0];
  if (has("classification.md")) return "classified";
  return "empty";
}
// The approval chain next_action walks, in order: every active phase (PHASES; `execution` is the sign-off after a
// finish, not a planning phase), `tests` only once testsGateDue says the plan it implements exists (never a bugfix's),
// classification only when classification.md exists (a feature folder made by hand, or by an old engine, has none —
// it was never a gate there; every other chain artifact that is missing is "fill it").
function gateWalk(dir, tracks, kind) {
  if (kind === "spike") return []; // 1.14 C2: a spike has no approval chain (question → investigate → decide)
  return phaseOrder(featureFlow(dir, kind)).filter((ph) => ph !== "execution" && phaseActive(ph, tracks) && (ph !== "tests" || testsGateDue(dir, tracks, kind)) && // C3: the feature's flow orders the chain
    (ph !== "classification" || fs.existsSync(path.join(dir, "classification.md"))));
}
// The artifacts a phase's approval signs off, as next_action's "fill" step checks them: classification.md, the chain
// artifact(s) of that phase (a bugfix's design is bug.md, plus design.md while it holds active track sections), none for `tests`.
function gateArtifacts(dir, tracks, kind, phase) {
  if (phase === "classification") return ["classification.md"];
  return chainArtifacts(dir, tracks, kind).filter((a) => a.phase === phase).map((a) => a.file);
}
// Doctor's pending gates: the active phases whose artifact exists (phaseFile — a bugfix's design gate is due on bug.md)
// or, for `tests` (Phase 4, no artifact), once testsGateDue() says so — not approved yet, in the chain's order. approvePhase
// refuses a phase while an EARLIER one is still in this list (a phase with nothing to approve never blocks a later one).
function pendingGateList(dir, tracks, kind, approvals) {
  if (kind === "spike") return []; // 1.14 C2
  const due = (ph) => (ph === "tests" ? testsGateDue(dir, tracks, kind) : fs.existsSync(path.join(dir, phaseFile(ph, kind))));
  return phaseOrder(featureFlow(dir, kind)).filter((ph) => ph !== "execution" && phaseActive(ph, tracks) && due(ph) && !(approvals || {})[ph]); // C3: in the flow's order
}

// ---------------------------------------------------------------------------
// Flows (1.14 C3) — Kiro's tech-design-first variant. Some features start from an architecture (a port, platform or performance
// work): `.state.json → flow: "design-first"` (spec_create {flow} / `create --flow design-first`; changed later with spec_feature
// {action: "flow"} / `feature flow <name> <flow>`) orders the chain classification → design → requirements → (test-plan / eval-plan)
// → tests → tasks, for every reader of the order: gateWalk / pendingGateList (next_action, doctor, approve's phase-order check,
// the fast-forward), detectPhase and chainArtifacts (the placeholder gate's phase scoping), next_action's failing-check filter and
// the roadmap percent. The design gate of a design-first feature never looks at the requirements (they come after it): its
// clarifications are the design's own, and doctor defers the AC traceability while requirements.md is still a later phase's
// template. No flow (or "requirements-first") = the default order, unchanged. A bugfix, a spike — any kind but a plain feature —
// keeps its own fixed order: the flow is ignored there (spec_create says so; spec_feature {action: "flow"} refuses it).
// ---------------------------------------------------------------------------
const FLOWS = ["requirements-first", "design-first"];
const DESIGN_FIRST_PHASES = ["classification", "design", "requirements", "test-plan", "eval-plan", "tests", "tasks", "execution"];
// The flow a state (the raw .state.json data) gives. `kind`: the caller's (else the state's) — only a plain feature has one.
function flowOfState(st, kind) {
  const k = kind != null ? kind : isObj(st) && typeof st.kind === "string" ? st.kind : "feature";
  return k === "feature" && isObj(st) && st.flow === "design-first" ? "design-first" : "requirements-first";
}
// A feature folder's flow (read-cached like every .state.json read of the same call).
function featureFlow(dir, kind) {
  return flowOfState(readJson(statePath(dir)).data, kind);
}
const phaseOrder = (flow) => (flow === "design-first" ? DESIGN_FIRST_PHASES : PHASES);
// PHASE_INDEX / CHECK_PHASE / chainArtifacts' idx on the flow's scale: design-first swaps the requirements (1) and design (2) slots.
const flowIndex = (i, flow) => (flow === "design-first" && (i === 1 || i === 2) ? 3 - i : i);
const flowPhaseIndex = (phase, flow) => flowIndex(PHASE_INDEX[phase] || 0, flow);
// A track pack's `<name>-sections` check (1.15) is a design check, as the built-in marker tracks' are.
const checkPhaseIndex = (id, flow) => flowIndex((Object.prototype.hasOwnProperty.call(CHECK_PHASE, id) && CHECK_PHASE[id]) || (/-sections$/.test(id) ? 2 : 0), flow);
// The default flow's phase at the same position of the chain (design-first: design ↔ requirements) — for the tables keyed by
// position: PHASE_PERCENT (the roadmap percent) and NOT_STARTED_PHASES (spec_upgrade's status).
const positionPhase = (phase, flow) => (flow === "design-first" && (phase === "design" || phase === "requirements") ? (phase === "design" ? "requirements" : "design") : phase);
// A flow as given (MCP enum / CLI --flow, folded like the other enums) → { flow } | { flow: null } (not given) | { error }.
function parseFlow(v, lng) {
  if (v === undefined || v === null || (typeof v === "string" && !v.trim())) return { flow: null };
  const s = typeof v === "string" ? v.trim().toLowerCase() : null;
  if (s && FLOWS.includes(s)) return { flow: s };
  const A = i18n.msg(lng).args;
  return { error: A.invalid(A.item("flow", A.oneOf(FLOWS.join(", ")), JSON.stringify(typeof v === "string" ? v : String(v)))) };
}
// "classification → design → requirements → test-plan → tests → tasks" — the active phases of a feature in its flow's order.
function flowOrderText(dir, tracks, flow) {
  return phaseOrder(flow).filter((ph) => ph !== "execution" && phaseActive(ph, tracks) && (ph !== "classification" || fs.existsSync(path.join(dir, "classification.md")))).join(" → ");
}
// spec_feature {action: "flow", name, flow} / `dev-spec feature flow <name> <flow>` — set (or reset) a feature's flow. Phases
// already approved stay approved (named); the pending gates follow the new order at once. → { ok, action: "flow", feature, flow,
// previous, changed, order, pendingGates, note }
function setFeatureFlow(projectDir, name, flow) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const lng = featureLang(projectDir, f.slug);
  const F = i18n.msg(lng).flow;
  const pf = parseFlow(flow, lng);
  if (pf.error) return { ok: false, error: pf.error };
  if (!pf.flow) return { ok: false, error: F.required(f.slug, FLOWS.join(", ")) };
  const state = readState(projectDir, f.slug);
  if (state.invalid) return { ok: false, error: state.invalid };
  const kind = typeof state.kind === "string" ? state.kind : "feature";
  if (kind !== "feature") return { ok: false, kindIgnored: true, kind, error: F.kindRefused(f.slug, kind) };
  const tracks = detectTracks(f.dir);
  const previous = flowOfState(state);
  const res = { ok: true, action: "flow", feature: f.slug, flow: pf.flow, previous, changed: previous !== pf.flow };
  if (res.changed) {
    if (pf.flow === "design-first") state.flow = "design-first";
    else delete state.flow; // the default order: no key (a pre-1.14 engine reads the feature as it always did)
    writeFileAtomic(statePath(f.dir), JSON.stringify(state, null, 2));
    maybeRefreshRoadmap(projectDir);
  }
  res.order = flowOrderText(f.dir, tracks, pf.flow);
  res.pendingGates = pendingGateList(f.dir, tracks, kind, state.approvals);
  const approved = ["requirements", "design"].filter((ph) => isRecord(state.approvals[ph]));
  res.note = [res.changed ? F.set(f.slug, pf.flow, previous, res.order) : F.same(f.slug, pf.flow, res.order),
    res.changed && approved.length ? F.approvedStay(approved.join(", ")) : null].filter(Boolean).join(" ");
  return res;
}
const setFeatureFlowLocked = featureLocked(setFeatureFlow); // manageFeature's "flow": a .state.json read-modify-write, under the feature lock
// createFeature's flow (spec_create {flow} / `create --flow`) → { error } | { flow, store?, note? }. A NEW plain feature created
// design-first stores it (`store`); an existing feature keeps its flow (a note names spec_feature {action: "flow"} when another
// one is asked); any other kind (bugfix, spike…) ignores it, and a note says so.
function createFlow(projectDir, slug, dir, existed, kind, asked, lang) {
  const lng = existed ? featureLang(projectDir, slug) : normalizeLang(lang || projectLang(projectDir));
  const pf = parseFlow(asked, lng);
  if (pf.error) return { error: pf.error };
  const F = i18n.msg(lng).flow;
  if (existed) {
    const cur = featureFlow(dir);
    return { flow: cur, note: pf.flow && pf.flow !== cur ? (kind !== "feature" ? F.kindIgnored(kind) : F.kept(slug, cur, pf.flow)) : null };
  }
  if (kind !== "feature") return { flow: "requirements-first", note: pf.flow === "design-first" ? F.kindIgnored(kind) : null };
  return { flow: pf.flow || "requirements-first", store: pf.flow === "design-first" ? "design-first" : null };
}
// The new feature's .state.json (just written by createFeature) ← flow.
function storeCreateFlow(dir, flow) {
  const j = readJson(statePath(dir));
  if (!isObj(j.data)) return;
  j.data.flow = flow;
  writeFileAtomic(statePath(dir), JSON.stringify(j.data, null, 2));
}

// The phase each doctor check belongs to (PHASE_INDEX scale) — next_action only puts the current phase's failures
// (and earlier ones) first. A check not listed (placeholders: it only fails for the current phase or an earlier
// one) counts as current.
const CHECK_PHASE = { requirements: 1, ears: 1, clarifications: 1, "success-criteria": 1, priorities: 1, "ac-uniqueness": 1, reproduction: 1,
  design: 2, mermaid: 2, "constitution-check": 2, "saas-sections": 2, "ai-sections": 2, "sec-sections": 2, "privacy-sections": 2, "dist-sections": 2, "root-cause": 2,
  "test-plan": 3, "eval-plan": 4, traceability: 5, "duplicate-tasks": 5, "verify-pipes": 5, "malformed-markers": 5, verification: 6, "outside-code-artifacts": 6 };
CHECK_PHASE["task-deps"] = 5; // 1.14 F3: the tasks phase (task dependencies)
Object.assign(CHECK_PHASE, { glossary: 1, "cross-feature-acs": 1, "steering-changed-since-approval": 2 }); // 1.16 Q (warns only)
Object.assign(CHECK_PHASE, { "design-tradeoffs": 2, "design-risks": 2 }); // 1.17 A1 (warns only)

// ---------------------------------------------------------------------------
// Gates — the ONE view doctor / approve / next_action / finish / roadmap share of what a phase still lacks
// ---------------------------------------------------------------------------

// detectPhase's phases on the chain's scale: the artifact at the current position and every earlier one must be
// real content; later ones may still be templates (tasks-ready = tasks.md is current; executing/complete = all).
const PHASE_INDEX = { empty: 0, classified: 0, requirements: 1, design: 2, "test-plan": 3, "eval-plan": 4, tests: 5, "tasks-ready": 5, executing: 6, complete: 6 };

// The planning chain in phase order (detectPhase's walk). A bugfix's bug.md takes the design slot — its Root Cause
// replaces the design — and its design.md joins only while it holds active track sections (detectPhase's rule).
function chainArtifacts(dir, tracks, kind) {
  if (kind === "spike") return []; // 1.14 C2: spike.md is judged by the spike tools (spikeDoctor / spikeFinish), not the planning chain
  const out = [{ file: "requirements.md", phase: "requirements", idx: 1 }];
  if (kind === "bugfix") {
    out.push({ file: "bug.md", phase: "design", idx: 2 });
    const d = readIfExists(path.join(dir, "design.md"));
    if (d != null && !headingsOnly(activeDesign(d, tracks))) out.push({ file: "design.md", phase: "design", idx: 2 });
  } else if (featureFlow(dir, kind) === "design-first") { // C3: design first — the requirements take the second slot
    out[0].idx = 2;
    out.unshift({ file: "design.md", phase: "design", idx: 1 });
  } else out.push({ file: "design.md", phase: "design", idx: 2 });
  if (tracks.includes("tdd")) out.push({ file: "test-plan.md", phase: "test-plan", idx: 3 });
  if (tracks.includes("ai")) out.push({ file: "eval-plan.md", phase: "eval-plan", idx: 4 });
  out.push({ file: "tasks.md", phase: "tasks", idx: 5 });
  return out;
}

// Approved artifacts whose content changed after THEIR OWN approval (fingerprint at approval; checkbox ticks in
// tasks.md don't count). Approvals recorded before fingerprints existed fall back to that phase's own timestamp —
// never the latest approval of any phase. Inactive-track phases are skipped. Shared by next_action, finish, roadmap.
// kind: the feature's (state.kind). A file's date is no evidence of an edit — a clone, checkout, copy or unzip gives every
// file a new mtime — so what is judged by it alone is reported apart (opts.detail → { changed, byDate, untracked }):
//   byDate     a pre-1.11 approval (no fingerprint): its phase file newer than the approval — kept in `changed` (next_action,
//              doctor and the roadmap show it, as 1.12 did) but never a spec_finish blocker (a warning there);
//   untracked  a pre-1.13 bugfix design approval (no fingerprint, no `file`) signed off bug.md, and nothing about bug.md was
//              recorded (1.12 never tracked it): not a change at all — re-approving starts tracking it.
// Without opts.detail → the `changed` list.
function changedSinceApproval(dir, approvals, tracks, kind, opts = {}) {
  const out = [];
  const byDate = [];
  const untracked = [];
  for (const [ph, file] of Object.entries(PHASE_FILE)) {
    const a = approvals && approvals[ph];
    if (a && !a.fingerprint && !a.file && a.at && kind === "bugfix" && ph === "design" && phaseActive(ph, tracks)) {
      // bug.md: untracked (above). design.md: 1.12 fingerprinted design.md whenever it existed, so one that exists now was
      // created after this approval (a track added since) — a change known without any date, as for a 1.13 approval.
      if (fs.existsSync(path.join(dir, phaseFile(ph, "bugfix")))) untracked.push({ phase: ph, file: phaseFile(ph, "bugfix") });
      if (fs.existsSync(path.join(dir, file))) out.push(file);
      continue;
    }
    if (a && a.file !== file && a.file === phaseFile(ph, "bugfix") && phaseActive(ph, tracks)) {
      // A bugfix's design approval signed off bug.md (`file`, see phaseFile) and design.md as it was then
      // (`designFingerprint`) — a design.md created since (a track added) is a change too.
      const bug = path.join(dir, a.file), design = path.join(dir, file);
      if (fs.existsSync(bug) && !artifactMatches(bug, ph, a.fingerprint)) out.push(a.file);
      if (fs.existsSync(design) && !artifactMatches(design, ph, a.designFingerprint)) out.push(file);
      continue;
    }
    const abs = path.join(dir, file);
    if (!a || !fs.existsSync(abs) || !phaseActive(ph, tracks)) continue;
    if (a.fingerprint) {
      if (!artifactMatches(abs, ph, a.fingerprint)) out.push(file);
    } else if (a.at && ph !== "tasks") {
      try { if (fs.statSync(abs).mtime.getTime() > new Date(a.at).getTime()) { out.push(file); byDate.push(file); } } catch { /* ignore */ }
    }
  }
  return opts.detail ? { changed: out, byDate, untracked } : out;
}

// Success criteria / priorities count once they are REAL: the template's "Priorities: **P1** = …" legend, its
// "US-1 (P1 — MVP): [Story Title]" and its placeholder SC-001 line must not pass while still template — nor a line in a
// fenced example or an HTML comment.
function realLines(md, re) {
  return stripFencedCode(stripHtmlComments(md || "")).split(/\r?\n/).filter((l) => re.test(l) && !placeholderReport(l).length);
}
function hasSuccessCriteria(md) {
  return realLines(md, /(?<![A-Za-z0-9])SC-\d+/).length > 0;
}
function hasPriority(md) {
  // A line naming P1, P2 AND P3 is the priority legend, not a prioritized story.
  return realLines(md, /(?<![A-Za-z0-9])P1(?![0-9])/).some((l) => !(/(?<![A-Za-z0-9])P2(?![0-9])/.test(l) && /(?<![A-Za-z0-9])P3(?![0-9])/.test(l)));
}
// Duplicate AC DEFINITIONS (the ID opening a list item, optionally bold) — "as in US-1.AC-1" is a reference, and a
// fenced example is no definition.
function acDuplicates(md) {
  const seen = new Set(), dups = new Set();
  // The indent within its line ([^\S\n\r\u2028\u2029]): the same IDs, without rescanning a long blank run from each of its
  // line starts (1.17 H).
  for (const mm of stripFencedCode(stripHtmlComments(md || "")).matchAll(/^[^\S\n\r\u2028\u2029]*(?:\d+[.)]|[-*+])\s+(?:\*\*|__)?(US-\d+\.AC-\d+)(?!\d)/gm)) (seen.has(mm[1]) ? dups : seen).add(mm[1]);
  return [...dups];
}
// A section with real content: present, no `> **TODO**` sentinel, not empty, no template placeholder left.
function sectionFilled(md, syn) {
  const b = extractSection(md || "", syn);
  return b != null && !RE_TODO_SENTINEL.test(b) && !!stripHtmlComments(b).trim() && !placeholderReport(b).length;
}
// bug.md's Reproduction / Root Cause as the bugfix gates judge them (doctor, approve requirements / design, complete_task's
// root-cause gate, finish, the brief): present, no `> **TODO**` sentinel, not empty, and no bug-report placeholder left
// (bugPlaceholders — quoted evidence such as `[object Object]` or `[WARN]` is content, not a slot).
function bugSectionFilled(md, syn) {
  const b = extractSection(md || "", syn);
  return b != null && !RE_TODO_SENTINEL.test(b) && !!stripHtmlComments(b).trim() && !bugPlaceholders(b, placeholderReport(b)).length && hasProseOutsideBrackets(b);
}
const CONSTITUTION_SYN = ["constitution check", "verificação da constituição", "verificacao da constituicao", "verificación de la constitución", "verificacion de la constitucion"];

// What approving `phase` requires (the same checks doctor runs, scoped to that phase). → { artifact, file, checks }
// where `checks` lists only the FAILING ones as { id, detail }; artifact=false = nothing to approve (the file is
// missing, or its track is off) — an error even with force.
function approvalChecks(projectDir, slug, dir, phase, tracks, kind, lang) {
  const fm = i18n.msg(lang);
  const m = fm.doctor, G = fm.gates;
  const read = (x) => readIfExists(path.join(dir, x));
  const exists = (x) => fs.existsSync(path.join(dir, x));
  const checks = [];
  const need = (id, ok, detail) => { if (!ok && !checks.some((c) => c.id === id)) checks.push({ id, detail }); };
  const noPlaceholders = (x) => { const r = artifactReport(dir, x, tracks); need("placeholders", r.state !== "placeholder", placeholderSummary([r], lang)); };
  const gaps = (tr, kinds) => traceGapLines({ ...Object.fromEntries(kinds.map((k) => [k, tr[k] || []])), removedAcs: tr.removedAcs }, lang).join("; ");
  const nothing = (file) => ({ artifact: false, file, checks });
  const bugfix = kind === "bugfix";
  const label = (s) => `${fm.sectionNames[s.section] || s.section}:${fm.sectionStatus[s.status] || s.status}`;
  switch (phase) {
    case "classification":
      if (!exists("classification.md")) return nothing("classification.md");
      noPlaceholders("classification.md");
      break;
    case "requirements": {
      if (!exists("requirements.md")) return nothing("requirements.md");
      const reqs = read("requirements.md");
      const ev = earsValidate(reqs, lang);
      const errs = (ev.issues || []).filter((i) => i.severity === "error");
      need("ears", !errs.length, errs.slice(0, 3).map((i) => `L${i.line} ${i.msg}`).join("; "));
      const unlinted = earsUnlinted(reqs, ev); // AC IDs trace_check counts, none linted (doctor's rule — Pa2)
      need("ears", !unlinted, unlinted ? m.earsNoCriteria(unlinted) : "");
      noPlaceholders("requirements.md");
      const mk = clarificationMarkers(reqs);
      need("clarifications", !mk.length, m.clarificationsOpen(mk.length));
      need("success-criteria", hasSuccessCriteria(activeDesign(reqs, tracks)), m.scMissing);
      need("priorities", hasPriority(activeDesign(reqs, tracks)), m.prioritiesMissing);
      const dups = acDuplicates(reqs);
      need("ac-uniqueness", !dups.length, m.acDup(dups.join(", ")));
      if (bugfix) need("reproduction", bugSectionFilled(read("bug.md"), REPRO_SYN), m.reproMissing);
      break;
    }
    case "design": {
      const design = read("design.md");
      if (bugfix) {
        // A bugfix has no design of its own: its Root Cause stands in for it.
        if (!exists("bug.md")) return nothing("bug.md");
        need("root-cause", bugSectionFilled(read("bug.md"), ROOT_CAUSE_SYN), m.rootCauseMissing);
      } else {
        if (design == null) return nothing("design.md");
        noPlaceholders("design.md");
        need("constitution-check", sectionFilled(activeDesign(design, tracks), CONSTITUTION_SYN), G.constitutionUnfilled);
      }
      if (design != null) {
        for (const [tr, secs, mark] of activeSectionTracks(tracks)) {
          const bad = sectionState(design, secs, mark).filter((s) => s.status !== "filled");
          need(tr + "-sections", !bad.length, bad.map(label).join("; "));
        }
      }
      // C3: a design-first design is approved BEFORE the requirements are written — only its own open questions block it.
      const reqMarkers = featureFlow(dir, kind) === "design-first" ? [] : clarificationMarkers(read("requirements.md") || "");
      const mk = [...reqMarkers, ...clarificationMarkers(design || "")];
      need("clarifications", !mk.length, m.clarificationsOpen(mk.length));
      break;
    }
    case "test-plan": {
      if (!phaseActive("test-plan", tracks) || !exists("test-plan.md")) return nothing("test-plan.md");
      noPlaceholders("test-plan.md");
      const tr = traceCheck(projectDir, slug);
      need("traceability", !(tr.uncoveredByTests || []).length && !(tr.phantomAcsInTests || []).length, gaps(tr, ["uncoveredByTests", "phantomAcsInTests"]));
      break;
    }
    case "eval-plan":
      if (!phaseActive("eval-plan", tracks) || !exists("eval-plan.md")) return nothing("eval-plan.md");
      noPlaceholders("eval-plan.md");
      break;
    case "tasks": {
      if (!exists("tasks.md")) return nothing("tasks.md");
      noPlaceholders("tasks.md");
      // No placeholder tasks: bracketed ones are in the report above; a list made ONLY of the scaffold's verbatim track
      // tasks (isPlaceholderTask) is not a breakdown yet either — detectPhase's "tasks-ready" rule.
      const active = parseTasks(activeTasks(read("tasks.md"), tracks));
      need("placeholders", active.some((t) => !isPlaceholderTask(t.text)), G.noRealTasks);
      const tr = traceCheck(projectDir, slug);
      const kinds = ["uncoveredByTasks", "phantomAcsInTasks", "phantomTestsInTasks"];
      need("traceability", kinds.every((k) => !(tr[k] || []).length), gaps(tr, kinds));
      const deps = taskDepsCheck(taskBlocks(activeTasks(read("tasks.md"), tracks) || ""), lang); // 1.14 F3: doctor's task-deps
      if (deps) need("task-deps", deps.status !== "fail", deps.detail);
      break;
    }
    case "tests": {
      // Phase 4 has no artifact of its own: it signs off the failing tests (+tdd) / the eval harness (+ai) that implement
      // an active plan — nothing to approve without one (a core-only feature has no Phase 4).
      const tdd = tracks.includes("tdd") && exists("test-plan.md");
      const ai = tracks.includes("ai") && exists("eval-plan.md");
      if (!phaseActive("tests", tracks) || (!tdd && !ai)) return nothing(tracks.includes("ai") && !tracks.includes("tdd") ? "eval-plan.md" : "test-plan.md");
      if (tdd) {
        // Every planned T-ID named by a test file (SKILL Phase 4: the T-ID in each failing test's name) — trace_check's
        // own code scan, so a row scoped to a test path counts only there.
        const planned = extractTestIds(planIdText(read("test-plan.md") || "")).size;
        const tr = planned ? traceCheck(projectDir, slug, { code: true }) : null;
        const missing = tr && tr.ok && tr.code ? tr.code.plannedNotInCode : [];
        // Once tasks are ticked (executing / complete) the code exists: the refusal is worded as next_action's sign-off
        // (name each existing test's T-ID), never "write each failing test".
        const started = missing.length && ["executing", "complete"].includes(detectPhase(dir, tracks));
        need("tests-in-code", planned > 0 && !missing.length, planned ? (started ? G.testsNotInCodeSignOff : G.testsNotInCode)(missing.join(", ")) : G.noPlannedTests);
      }
      if (ai) {
        // The harness runs this feature's eval sets: evals/golden.json must be a set of its own, not the scaffold's sample.
        const golden = readJson(path.join(dir, "evals", "golden.json"));
        const items = golden.data && Array.isArray(golden.data.items) ? golden.data.items : null;
        const sample = items && JSON.stringify(golden.data) === JSON.stringify(JSON.parse(SAMPLE_GOLDEN));
        need("eval-sets", !!(items && items.length) && !sample, sample ? G.evalSetsSample : G.evalSetsMissing);
      }
      break;
    }
    case "execution": {
      // The sign-off after a READY finish (commands/spec-finish.md): spec_finish's blockers are its failing checks —
      // open or unverified tasks, pending gates, edits after approval, placeholders, a bugfix's missing root cause.
      const fin = finishFeature(projectDir, slug, { gateOnly: true });
      if (fin.ok) fin.checks.forEach((c) => need(c.id, false, c.detail));
      break;
    }
    default:
  }
  return { artifact: true, checks };
}

// Multilingual heading matchers for the doctor / clarify checks.
const RE_CONSTITUTION_CHECK = /constitution check|verifica[çc][ãa]o da constitui[çc][ãa]o|verificaci[óo]n de la constituci[óo]n/i;
const RE_SUCCESS_CRITERIA = /success criteria|crit[ée]rios de sucesso|criterios de [ée]xito/i;
const RE_INDEPENDENT_TEST = /independent test|teste independente|prueba independiente/i;
const RE_OUT_OF_SCOPE = /out of scope|fora de [aâ]mbito|fora do [aâ]mbito|fora d[eo] escopo|fuera de alcance/i; // pt-BR: Fora do Escopo
const RE_NFR = /non-functional|nfr|performance|security|n[ãa]o[- ]funcional|no funcional|desempenho|rendimento|rendimiento|seguran[çc]a|seguridad/i;
const RE_EDGE_CASES = /edge case|error handling|casos? limite|casos? l[íi]mite|tratamento de erro|manejo de error/i;
// The +tdd design block heading, localized (used by addTrack to avoid re-appending it).
const RE_TESTABILITY = /##\s*(testability notes|notas de testabilidade|notas de testabilidad)/i;

module.exports = { phaseActive, testsGateDue, detectPhase, gateWalk, gateArtifacts, pendingGateList, FLOWS,
  DESIGN_FIRST_PHASES, flowOfState, featureFlow, phaseOrder, flowIndex, flowPhaseIndex, checkPhaseIndex, positionPhase,
  parseFlow, flowOrderText, setFeatureFlow, setFeatureFlowLocked, createFlow, storeCreateFlow, CHECK_PHASE, PHASE_INDEX,
  chainArtifacts, changedSinceApproval, realLines, hasSuccessCriteria, hasPriority, acDuplicates, sectionFilled,
  bugSectionFilled, CONSTITUTION_SYN, approvalChecks, RE_CONSTITUTION_CHECK, RE_SUCCESS_CRITERIA, RE_INDEPENDENT_TEST,
  RE_OUT_OF_SCOPE, RE_NFR, RE_EDGE_CASES, RE_TESTABILITY, __link };
