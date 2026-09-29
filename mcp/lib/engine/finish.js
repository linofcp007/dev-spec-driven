"use strict";

/**
 * dev-spec-driven engine — spec_finish and drift since finish.
 * Close a feature LOCALLY (readiness + a merge summary from the spec chain — never a merge, push or pull request) and
 * the finish baseline spec_drift hashes.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, activeTasks, artifactReport, bugSectionFilled, chainArtifacts, changedSinceApproval, cleanTaskText,
  commitTag, DECISIONS_FILE, decisionSummaryLines, detectPhase, detectTracks, duplicateTaskNumbers, ensureDir, errs,
  existingFeature, expectsFail, extractSection, extractTestIds, featureDirs, featureLang, FOLD_CASE, forcedApprovalList,
  forgetCached, globFiles, implementsPath, implementsRefs, isDirSafe, isImplementsGlob, isInsideDir, isObj, isRecord,
  isRedRun, locateFeatures, maybeRefreshCatalog, normalizeLang, ownEvidence, placeholderSummary, planIdText,
  projectLang, RE_TODO_SENTINEL, readIfExists, readState, recordFinishChecks, resolveFeature, roleLabel, ROOT_CAUSE_SYN,
  scanTestCode, specDoctor, spikeFinish, stateFromFile, statePath, stripHtmlComments, suiteLabel, suiteStatus,
  suiteSummaryLines, taskBlocks, taskMarkers, testIndex, timeOf, toPosix, TRACE_SECONDARY_KINDS, traceCheck,
  traceWarningLines, trackLabel, unverifiedLabel, verificationStatus, waiverResult, waiverSummaryLines, walkProject,
  writeFileAtomic, writeIfAbsent;
function __link(E) { ({ acIndex, activeTasks, artifactReport, bugSectionFilled, chainArtifacts, changedSinceApproval,
  cleanTaskText, commitTag, DECISIONS_FILE, decisionSummaryLines, detectPhase, detectTracks, duplicateTaskNumbers,
  ensureDir, errs, existingFeature, expectsFail, extractSection, extractTestIds, featureDirs, featureLang, FOLD_CASE,
  forcedApprovalList, forgetCached, globFiles, implementsPath, implementsRefs, isDirSafe, isImplementsGlob, isInsideDir,
  isObj, isRecord, isRedRun, locateFeatures, maybeRefreshCatalog, normalizeLang, ownEvidence, placeholderSummary,
  planIdText, projectLang, RE_TODO_SENTINEL, readIfExists, readState, recordFinishChecks, resolveFeature, roleLabel,
  ROOT_CAUSE_SYN, scanTestCode, specDoctor, spikeFinish, stateFromFile, statePath, stripHtmlComments, suiteLabel,
  suiteStatus, suiteSummaryLines, taskBlocks, taskMarkers, testIndex, timeOf, toPosix, TRACE_SECONDARY_KINDS,
  traceCheck, traceWarningLines, trackLabel, unverifiedLabel, verificationStatus, waiverResult, waiverSummaryLines,
  walkProject, writeFileAtomic, writeIfAbsent } = E); }

// ---------------------------------------------------------------------------
// spec_finish — close a feature LOCALLY: readiness report + a merge summary generated from the spec chain
// (no PRs, no CI — the owner's cost rule; the summary is the merge commit message)
// ---------------------------------------------------------------------------

// The first paragraph of a section (wrapped lines joined), or null for a placeholder / TODO sentinel.
function sectionFirstParagraph(md, synonyms) {
  const body = extractSection(md, synonyms);
  if (body == null) return null;
  const para = [];
  for (const l of stripHtmlComments(body).split(/\r?\n/).map((x) => x.trim())) {
    if (!l) { if (para.length) break; continue; }
    para.push(l);
  }
  const text = para.join(" ");
  return text && !/^\[.*\]$/.test(text) && !RE_TODO_SENTINEL.test(text) ? text : null;
}
// Markdown helpers for the merge summary: multi-line output collapsed to one line; a code span whose fence is
// longer than any backtick run inside it.
function oneLine(s) {
  return String(s || "").replace(/(?<!\s)\s*\r?\n\s*/g, " ⏎ ").trim(); // (?<!\s): a blank run is read from its start only (1.17 H)
}
function codeSpan(s) {
  const text = oneLine(s);
  const longest = Math.max(0, ...(text.match(/`+/g) || []).map((r) => r.length));
  const fence = "`".repeat(longest + 1);
  return longest ? fence + " " + text + " " + fence : fence + text + fence;
}
// A commit title: the first sentence, at most ~72 chars, cut at a word boundary. Abbreviations like
// "e.g." / "i.e." / "p. ej." don't end a sentence.
function shortTitle(text, max = 72) {
  const first = text.split(/(?<!\b(?:e\.g|i\.e|ex|etc|ej|vs|p)\.)(?<=[.!?])\s+(?=\p{Lu})/u)[0];
  if (first.length <= max) return first.replace(/\.$/, "");
  const cut = first.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2)).replace(/[,;:\s]+$/, "") + "…";
}

function finishFeature(projectDir, name, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const { slug, dir } = f;
  const lng = featureLang(projectDir, slug);
  const F = i18n.msg(lng).finish;
  const tracks = detectTracks(dir);
  // B5: spec_finish {evidence} — the project checks' runs, recorded BEFORE the readiness is computed (the same call can make
  // the feature ready); all-or-nothing, under the feature lock.
  let recordedChecks = null;
  if (opts.evidence != null) {
    const rc = recordFinishChecks(projectDir, slug, dir, opts.evidence, lng, opts.ranBy); // ranBy "cli": `finish --run` (1.14 F1; never from MCP)
    if (rc.error) return { ok: false, error: rc.error };
    recordedChecks = rc.recorded;
  }
  const state = readState(projectDir, slug);
  const kind = state.kind || "feature";
  if (kind === "spike") return spikeFinish(projectDir, f, opts, recordedChecks); // 1.14 C2: ready once the decision is written
  // Deep traceability — WARNINGS, never blockers: uncovered / phantom EC·NFR·SC, and planned tests no test file names.
  // One walk of the test code (only when an active +tdd plan has T-IDs), shared with doctor's tests-in-code check.
  const scan = tracks.includes("tdd") && extractTestIds(planIdText(readIfExists(path.join(dir, "test-plan.md")) || "")).size ? scanTestCode(projectDir) : null;
  const tr = traceCheck(projectDir, slug, { ...(scan ? { code: true, scan } : {}), globCap: opts.globCap });
  const warnings = tr.ok ? traceWarningLines(tr, lng, [...TRACE_SECONDARY_KINDS, "plannedNotInCode"]) : [];
  const doc = specDoctor(projectDir, slug, { scan, lean: true }); // lean: finish reads the failing checks (never the cross-feature warn)
  const tasksText = activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks);
  const blocks = taskBlocks(tasksText);
  const open = blocks.filter((b) => !b.done).map((b) => b.number);
  const vs = verificationStatus(projectDir, slug, dir);
  const G = i18n.msg(lng).gates;
  // placeholders / root-cause get their own, more precise blockers below.
  const failing = doc.ok ? doc.checks.filter((c) => c.status === "fail" && c.id !== "placeholders" && c.id !== "root-cause").map((c) => c.id) : [];
  const pendingGates = doc.pendingGates || [];
  // What next_action flags must block finishing too: an artifact edited after its approval, a template placeholder
  // ANYWHERE in the chain, and — for a bugfix — an unwritten root cause. Only a change known by CONTENT blocks: a file date
  // (a pre-1.11 approval) is no evidence — every clone or copy resets it — and a pre-1.13 bugfix design approval never
  // tracked bug.md; both are warnings (re-approve to track them).
  const cs = changedSinceApproval(dir, state.approvals || {}, tracks, kind, { detail: true });
  const changed = cs.changed.filter((x) => !cs.byDate.includes(x));
  if (cs.byDate.length) warnings.push(F.changedByDate(cs.byDate.join(", "), slug));
  if (cs.untracked.length) warnings.push(F.untrackedApproval(cs.untracked.map((u) => `${u.phase} (${u.file})`).join(", "), slug));
  // 1.14 B3: phases approved without the role sign-offs now required (approved before the roles) — a warning, never a blocker.
  const unsigned = doc.ok && isObj(doc.unsignedRoles) ? Object.entries(doc.unsignedRoles) : [];
  if (unsigned.length) warnings.push(i18n.msg(lng).governance.unsigned(unsigned.map(([p, l]) => `${p} (${l.join(", ")})`).join(", ")));
  // 1.14 full review Pa6: a test planned outside test code whose artifact (load-test.md, an eval set) is still the scaffold —
  // doctor's outside-code-artifacts warn, repeated here as a warning (never a blocker).
  const ocWarn = doc.ok && Array.isArray(doc.checks) ? doc.checks.find((c) => c.id === "outside-code-artifacts") : null;
  if (ocWarn) warnings.push(ocWarn.detail);
  // 1.16 U3: the forced approvals (each a waived gate, with its waiver when one was recorded) — the merge summary lists them,
  // an expired waiver is a warning (never a blocker; doctor warns waiver-expired).
  const forcedList = forcedApprovalList(state.approvals, tracks);
  const expiredW = forcedList.filter((x) => x.waiver && x.waiver.expired);
  if (expiredW.length) warnings.push(i18n.msg(lng).waiver.finishWarn(expiredW.map((x) => i18n.msg(lng).waiver.expiredItem(x.phase, x.waiver.expires, x.waiver.reason)).join(", "), slug));
  const leftovers = chainArtifacts(dir, tracks, kind).map((a) => artifactReport(dir, a.file, tracks)).filter((r) => r.state === "placeholder");
  const rootCauseMissing = kind === "bugfix" && !bugSectionFilled(readIfExists(path.join(dir, "bug.md")), ROOT_CAUSE_SYN);

  // Each blocker with a stable id: the approve gate of 'execution' refuses on exactly these (opts.gateOnly).
  const blocked = [];
  const block = (id, detail) => blocked.push({ id, detail });
  if (failing.length) block("doctor", F.doctor(failing.join(", ")));
  if (rootCauseMissing) block("root-cause", G.finishRootCause);
  if (leftovers.length) block("placeholders", G.finishPlaceholders(placeholderSummary(leftovers, lng)));
  if (changed.length) block("changed-since-approval", G.finishChanged(changed.join(", ")));
  if (!blocks.length) block("tasks", F.noTasks);
  if (open.length) block("open-tasks", F.open(open.map((n) => "#" + n).join(", ")));
  if (vs.unverified.length) block("verification", F.unverified(unverifiedLabel(vs, lng)));
  // B5: meta.checks set → every check needs a passing run since the feature's last task activity (suiteStatus).
  const suite = suiteStatus(projectDir, state, dir);
  if (suite.missing.length) block("suite-evidence", i18n.msg(lng).projectChecks.blocker(suiteLabel(suite.missing, lng), slug));
  if (suite.invalid.length) warnings.push(i18n.msg(lng).projectChecks.invalidStored(suite.invalid.join(", ")));
  if (pendingGates.length) block("approval-gates", F.gates(pendingGates.map((p) => roleLabel(doc.pendingRoles, p, lng)).join(", "))); // + the roles a phase waits for (1.14 B3)
  if (opts.gateOnly) return { ok: true, checks: blocked };
  const blockers = blocked.map((b) => b.detail);

  // What only a human (or a fresh run) can confirm — the track-gated "done" checks.
  const checks = [F.checkSuite];
  if (kind === "bugfix") checks.push(F.checkBug);
  if (tracks.includes("saas")) checks.push(F.checkLoad, F.checkObs);
  if (tracks.includes("ai")) checks.push(F.checkCost, F.checkSafety);
  for (const tr of ["sec", "privacy", "dist"]) if (tracks.includes(tr)) checks.push(...i18n.msg(lng).secPrivacy.finishChecks[tr]);

  // Merge summary from the spec chain (usable as the merge commit message).
  const reqs = readIfExists(path.join(dir, "requirements.md")) || "";
  const summary = sectionFirstParagraph(reqs, ["summary", "resumo", "resumen"]) || slug;
  const mergeTitle = `${kind === "bugfix" ? "fix" : "feat"}(${slug}): ${shortTitle(summary)}`;
  const body = [F.prSummary, summary, ""];
  if (kind === "bugfix") {
    const bug = readIfExists(path.join(dir, "bug.md")) || "";
    const rc = extractSection(bug, ROOT_CAUSE_SYN);
    const fix = extractSection(bug, ["fix", "correção", "correcao", "corrección", "correccion"]);
    // Only real content: an unfilled TODO sentinel or a [bracketed placeholder] stays out of the PR.
    const real = (x) => { const t = stripHtmlComments(x || "").trim(); return t && !RE_TODO_SENTINEL.test(t) && !/^\[[^\]]*\]$/.test(t) ? t : null; };
    if (real(rc)) body.push(F.prRootCause, real(rc), "");
    if (real(fix)) body.push(F.prFix, real(fix), "");
  }
  const acs = [...acIndex(reqs).values()];
  if (acs.length) body.push(F.prAcs, ...acs.map((a) => "- " + a.text), "");
  if (blocks.length) {
    body.push(F.prTasks);
    const dups = new Set(duplicateTaskNumbers(blocks));
    for (const b of blocks) {
      const ev = ownEvidence(vs.evidence, b, dups.has(b.number)); // never the other "N."'s run
      const hasVerify = taskMarkers(b).verify.length > 0;
      // A record with nothing to show (a v1.12 bare {exitCode: 0}) prints its exit code — never a dangling " — ".
      // full review Ga8: an _Expect: fail_ task's red run is labelled as the EXPECTED failure (a bare "→ exit 1" read as a
      // failing check), and a passing re-run after the fix names the red run it keeps as the proof.
      const RG = i18n.msg(lng).redGreen;
      const redTag = ev && expectsFail(b) ? (isRedRun(ev) ? RG.prRed : ev.exitCode === 0 && isRedRun(ev.red) ? RG.prRedKept(ev.red.exitCode, typeof ev.red.at === "string" ? ev.red.at.slice(0, 10) : "") : "") : "";
      const shown = ev ? [ev.command ? codeSpan(ev.command) + (ev.exitCode != null ? " → exit " + ev.exitCode : "") + (redTag ? ` (${redTag})` : "") : ev.exitCode != null ? "exit " + ev.exitCode : "",
        oneLine(ev.summary), commitTag(ev)].filter(Boolean) : [];
      const tail = shown.length ? " — " + shown.join(" · ") : hasVerify ? " — " + F.noEvidence : "";
      body.push(`- [${b.done ? "x" : " "}] ${b.number}. ${cleanTaskText(b.text)}${tail}`);
    }
    body.push("");
  }
  if (suite.items.length) body.push(...suiteSummaryLines(suite.items, lng), ""); // B5: the project checks' recorded runs
  const testIds = [...testIndex(readIfExists(path.join(dir, "test-plan.md")) || "").keys()];
  if (testIds.length) body.push(F.prTests, testIds.join(", "), "");
  const decLines = decisionSummaryLines(dir, lng); // 1.14 C2: decisions.md
  if (decLines.length) body.push(...decLines, "");
  if (forcedList.length) body.push(...waiverSummaryLines(forcedList, lng), ""); // 1.16 U3: the waived gates
  body.push(F.prChecks, ...checks.map((c) => "- [ ] " + c), "");
  const specFiles = ["requirements.md", "bug.md", "design.md", "test-plan.md", "eval-plan.md", "load-test.md", "tasks.md", DECISIONS_FILE]
    .filter((x) => fs.existsSync(path.join(dir, x)));
  body.push(F.prSpec, ...specFiles.map((x) => "- `.specs/" + slug + "/" + x + "`"));
  const mergeSummary = body.join("\n") + "\n";

  const exDir = path.join(dir, ".execution");
  const summaryPath = path.join(exDir, "merge-summary.md");
  const write = !!opts.write;
  if (write) {
    ensureDir(exDir);
    writeIfAbsent(path.join(exDir, ".gitignore"), "*\n");
    forgetCached(summaryPath); // written in place below: its cached text is dropped
    fs.writeFileSync(summaryPath, "# " + mergeTitle + "\n\n" + mergeSummary, "utf8"); // derived: regenerated on every call
  }
  const ready = blockers.length === 0;
  // A written finish of a READY feature is the drift baseline: a hash of every _Implements:_ file (spec_drift).
  const baseline = write && ready ? recordFinishBaseline(projectDir, slug, dir, tasksText, opts.globCap) : null;
  const res = {
    ok: true,
    feature: slug,
    kind,
    tracks: trackLabel(tracks),
    readyToFinish: ready,
    message: ready ? F.ready(slug) : F.notReady(slug),
    blockers,
    warnings, // localized lines; readyToFinish ignores them
    openTasks: open,
    unverified: vs.unverified,
    pendingGates,
    changedSinceApproval: changed,
    placeholders: leftovers.map((r) => r.file),
    checks,
    mergeTitle,
    paths: { summary: summaryPath },
    wrote: write,
  };
  if (baseline) res.baseline = baseline;
  if (forcedList.length) res.waivers = waiverResult(forcedList); // 1.16 U3: [{phase, failing, reason?, expires?, expired}]
  if (suite.items.length) res.suiteChecks = suite.items; // B5: [{name, command, status, exitCode?, at?, …}] — status is a stable code
  if (recordedChecks) res.recordedChecks = recordedChecks; // B5: the runs this call recorded
  if (doc.ok && doc.pendingRoles) res.pendingRoles = doc.pendingRoles; // 1.14 B3: the roles each pending phase waits for
  if (opts.includeBody != null ? !!opts.includeBody : !write) res.mergeSummary = mergeSummary;
  return res;
}

// --- drift since finish ---

// Content hash of a file, CRLF-normalized on the raw bytes (latin1 is byte-preserving), or null (missing / not a file).
function fileHash(abs) {
  try {
    if (!fs.statSync(abs).isFile()) return null;
    return require("crypto").createHash("sha1").update(fs.readFileSync(abs).toString("latin1").replace(/\r\n/g, "\n"), "latin1").digest("hex");
  } catch {
    return null;
  }
}
// A project-relative path → its absolute path, or null when it leaves the project (by path or through a symlink).
function projectFile(root, rootReal, rel) {
  if (typeof rel !== "string" || !rel.trim() || path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return null;
  const abs = path.resolve(root, rel);
  if (abs === root || !isInsideDir(root, abs)) return null;
  try {
    return isInsideDir(rootReal, fs.realpathSync.native(abs)) ? abs : null;
  } catch {
    return abs; // missing: judged by its path alone
  }
}
const realRootOf = (root) => { try { return fs.realpathSync.native(root); } catch { return root; } };
// The files a feature's _Implements:_ markers name, project-relative with forward slashes: a file (existing or not) or
// every file under a folder, or the files a glob matches now (globFiles — trace_check's reading) — only inside the
// project, at most BASELINE_CAP.
const BASELINE_CAP = 500;
// known: a Set of fold(rel) already recorded in a baseline (staleFinish) — those are counted without the realpath check
// (they were checked when recorded, and can never be "new"): the check is the whole cost of the walk, and the catalog
// runs it for every finished feature on each refresh.
function baselineFiles(projectDir, tasksText, globCap, known) {
  const root = path.resolve(projectDir);
  const rootReal = realRootOf(root);
  const fold = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
  const out = new Map(); // fold(rel) → rel
  let truncated = false;
  const add = (rel) => {
    const k = fold(rel);
    if (out.has(k)) return;
    if (out.size >= BASELINE_CAP) { truncated = true; return; }
    if ((known && known.has(k)) || projectFile(root, rootReal, rel)) out.set(k, rel);
  };
  for (const ref of implementsRefs(tasksText)) {
    const p = implementsPath(ref).replace(/^\.\//, "");
    if (!p) continue;
    if (isImplementsGlob(p)) {
      const g = globFiles(root, p, { cap: globCap || BASELINE_CAP * 20 });
      if (g.truncated) truncated = true; // the walk stopped at its cap: the glob's file list is incomplete
      for (const rel of g.files) add(rel);
      continue;
    }
    const abs = path.resolve(root, p);
    if (abs === root || !isInsideDir(root, abs)) continue;
    if (isDirSafe(abs)) { const pre = toPosix(path.relative(root, abs)); walkProject(abs, BASELINE_CAP + 1, (r) => add(pre + "/" + r)); }
    else add(toPosix(path.relative(root, abs)));
  }
  return { files: [...out.values()], truncated };
}
// state.finished = { at, files: { '<rel>': sha1 | null } } — latest finish wins.
function recordFinishBaseline(projectDir, slug, dir, tasksText, globCap) {
  const st = readState(projectDir, slug);
  if (st.invalid) return { recorded: false, error: st.invalid };
  const root = path.resolve(projectDir);
  // A re-finish over a DRIFTED baseline accepts the drift: say which files it was (replaced), never erase it silently.
  const before = isObj(st.finished) && isObj(st.finished.files) ? baselineDrift(root, realRootOf(root), st.finished) : null;
  const replaced = before && before.drifted ? { at: typeof st.finished.at === "string" ? st.finished.at : null,
    changed: before.changed, missing: before.missing, nowPresent: before.nowPresent } : null;
  const { files, truncated } = baselineFiles(root, tasksText, globCap);
  const map = {};
  for (const rel of files) map[rel] = fileHash(path.resolve(root, rel));
  const at = new Date().toISOString();
  // firstAt: when the feature was FIRST finished — a re-finish (a stale baseline, a change request) keeps it, so the release
  // notes never list a feature that already shipped as new again (spec_changelog's shipped-before test).
  const prevFin = isObj(st.finished) ? st.finished : null;
  const firstAt = prevFin && typeof prevFin.firstAt === "string" ? prevFin.firstAt : prevFin && typeof prevFin.at === "string" ? prevFin.at : null;
  st.finished = firstAt ? { at, firstAt, files: map } : { at, files: map };
  if (truncated) st.finished.truncated = true;
  writeFileAtomic(statePath(dir), JSON.stringify(st, null, 2));
  maybeRefreshCatalog(projectDir); // the feature now reads as finished
  const res = { recorded: true, at, files: files.length, missing: files.filter((r) => map[r] === null).length };
  if (truncated) res.truncated = true;
  if (replaced) res.replaced = replaced; // the drift this finish accepted: {at, changed, missing, nowPresent}
  return res;
}
// A finish baseline (state.finished) describes the feature as it was when it was finished. Work added or reopened AFTER
// it — a change request (spec_impact --reopen: state.changes[].at), a re-approval of any other phase (the tasks
// re-approved after append_tasks …), or an active task's _Implements:_ file the baseline never recorded — means the
// feature has to be finished AGAIN (spec_finish {write}: a fresh readiness report, merge summary and baseline) before
// drift or next_action's "nothing left to do" can speak for it. Once its tasks were done again, next_action said
// "finished — nothing left to do", drift kept hashing the old file list (a new implementing file was never checked) and
// the catalog kept calling it finished. tasksText: the ACTIVE tasks (what a finish records). opts.newFiles === false skips
// the _Implements:_ walk (state only): SessionStart's bounded drift check and the catalog, refreshed after every mutation.
// → null (no baseline, or still current) | { finishedAt, since: [{ kind: "change-request", n, at } | { kind: "approval",
// phase, at } | { kind: "untick", task, at } (1.16 U1) | { kind: "revoke", phase, at } (1.16 U review 3)], newFiles: [rel …] }
function staleFinish(projectDir, st, tasksText, opts = {}) {
  const fin = isObj(st.finished) && isObj(st.finished.files) ? st.finished : null;
  if (!fin) return null;
  const finAt = timeOf(fin.at);
  const since = finAt == null ? [] : changesSince(st, finAt, "execution");
  let newFiles = [];
  if (!fin.truncated && opts.newFiles !== false) {
    const fold = FOLD_CASE ? (s) => s.toLowerCase() : (s) => s;
    const had = new Set(Object.keys(fin.files).map(fold));
    const now = baselineFiles(projectDir, tasksText || "", undefined, had);
    if (!now.truncated) newFiles = now.files.filter((rel) => !had.has(fold(rel))); // a capped walk proves nothing about what is new
  }
  if (!since.length && !newFiles.length) return null;
  return { finishedAt: typeof fin.at === "string" ? fin.at : null, since, newFiles };
}
// What changed the spec after time t: change requests, and approvals of any phase but `except`.
function changesSince(st, t, except) {
  const out = [];
  (Array.isArray(st.changes) ? st.changes : []).forEach((c, i) => {
    const at = isRecord(c) ? timeOf(c.at) : null;
    if (at != null && at > t) out.push({ kind: "change-request", n: i + 1, at: c.at });
  });
  for (const [phase, a] of Object.entries(isObj(st.approvals) ? st.approvals : {})) {
    const at = phase !== except && isRecord(a) ? timeOf(a.at) : null;
    if (at != null && at > t) out.push({ kind: "approval", phase, at: a.at });
  }
  // 1.16 U1: a task unticked after t (spec_complete_task {undo}) — the work was reopened: a finish or a sign-off older than it no
  // longer speaks for the feature once the task is done again.
  for (const u of Array.isArray(st.unticks) ? st.unticks : []) {
    const at = isRecord(u) && Number.isSafeInteger(u.n) ? timeOf(u.at) : null;
    if (at != null && at > t) out.push({ kind: "untick", task: u.n, at: u.at });
  }
  // 1.16 U review 3: an approval revoked after t (spec_approve {revoke}) — the phase is pending again, so a finish or a sign-off
  // older than it no longer speaks for the feature (the catalog kept calling it finished, drift said clean). Only a revocation
  // that removed an approval (a `partial` one withdrew waiting sign-offs: nothing was approved) and never of `except`.
  for (const h of Array.isArray(st.approvalHistory) ? st.approvalHistory : []) {
    const at = isRecord(h) && h.revoked === true && h.partial !== true && typeof h.phase === "string" && h.phase !== except ? timeOf(h.at) : null;
    if (at != null && at > t) out.push({ kind: "revoke", phase: h.phase, at: h.at });
  }
  return out;
}
// The phases revoked in `since` that no approval in it restores (a revoke then a re-approval reads "re-approved" alone).
function revokedSinceList(since) {
  const back = new Set(since.filter((x) => x.kind === "approval").map((x) => x.phase));
  return [...new Set(since.filter((x) => x.kind === "revoke" && !back.has(x.phase)).map((x) => x.phase))];
}
// The execution sign-off predates a change (a change request or a re-approval of another phase after it): it signed
// off a different feature — next_action asks for it again.
function executionSignOffStale(st) {
  const ex = isObj(st.approvals) && isRecord(st.approvals.execution) ? timeOf(st.approvals.execution.at) : null;
  return ex != null && changesSince(st, ex, "execution").length > 0;
}
// What came after the execution sign-off, localized: "the approval of tests and change request #2".
function signOffWhyText(st, lang) {
  const W = i18n.msg(lang).next.signOffWhy;
  const ex = isObj(st.approvals) && isRecord(st.approvals.execution) ? timeOf(st.approvals.execution.at) : null;
  const since = ex == null ? [] : changesSince(st, ex, "execution");
  const parts = [];
  const phases = [...new Set(since.filter((x) => x.kind === "approval").map((x) => x.phase))];
  if (phases.length) parts.push(W.approvals(phases.join(", ")));
  const crs = since.filter((x) => x.kind === "change-request").map((x) => "#" + x.n);
  if (crs.length) parts.push(W.changeRequests(crs.join(", ")));
  const un = [...new Set(since.filter((x) => x.kind === "untick").map((x) => "#" + x.task))]; // 1.16 U1
  if (un.length) parts.push(i18n.msg(lang).undo.signOffWhy(un.join(", ")));
  const rv = revokedSinceList(since); // 1.16 U review 3
  if (rv.length) parts.push(i18n.msg(lang).revoke.signOffWhy(rv.join(", ")));
  return parts.join(W.join);
}
// "change request #2, tasks re-approved, 1 implementing file not in the baseline (src/a.js)" — localized.
function staleFinishText(stale, lang) {
  const W = i18n.msg(lang).drift.staleWhy;
  const parts = [];
  const crs = stale.since.filter((x) => x.kind === "change-request").map((x) => "#" + x.n);
  if (crs.length) parts.push(W.changeRequests(crs.join(", ")));
  const phases = [...new Set(stale.since.filter((x) => x.kind === "approval").map((x) => x.phase))];
  if (phases.length) parts.push(W.approvals(phases.join(", ")));
  if (stale.newFiles.length) parts.push(W.newFiles(stale.newFiles.length, stale.newFiles.slice(0, 5).join(", ") + (stale.newFiles.length > 5 ? ", …" : "")));
  const un = [...new Set(stale.since.filter((x) => x.kind === "untick").map((x) => "#" + x.task))]; // 1.16 U1
  if (un.length) parts.push(i18n.msg(lang).undo.driftWhy(un.join(", ")));
  const rv = revokedSinceList(stale.since); // 1.16 U review 3
  if (rv.length) parts.push(i18n.msg(lang).revoke.driftWhy(rv.join(", ")));
  return parts.join("; ");
}
// spec_drift {name?} / `dev-spec drift [feature]`: per finished feature, the recorded files changed / missing / now
// present since the finish baseline. Only the recorded files are hashed. "Finished" here is phase complete AND a
// baseline (the catalog also needs it current and every tick verified): a baselined feature whose tasks are open again (append_tasks after finish) is
// `reopened`, listed apart and not hashed until it is finished again; one whose tasks are done again but changed since
// the finish (staleFinish) is `stale` — listed apart with why (verdict `stale` unless something drifted or a state file
// failed): finish it again. Its recorded files are still hashed: one that drifted puts the feature in `features` too
// (`stale: true`) and in `drifted` (verdict `drift`) — a stale baseline never hides a changed file (adding one file
// under a folder _Implements:_ names made the drift of another go unreported), and a re-finish would accept it. A state file that can't be read is an error (verdict `error` unless something
// drifted; a named feature that can't be read at all → ok:false), never "clean".
// opts.maxFiles / opts.maxBytes bound the work (SessionStart): over budget, nothing is hashed and the result says
// `skipped`. opts.activeOnly leaves archived features out (the SessionStart line is about the work in .specs/).
function drift(projectDir, name, opts = {}) {
  const root = path.resolve(projectDir);
  const named = name != null && String(name).trim() !== "";
  let sources;
  if (named) {
    const f = resolveFeature(projectDir, name);
    if (!f.ok) return { ok: false, error: f.error };
    sources = locateFeatures(projectDir, name);
    if (!sources.length) return { ok: false, error: errs(projectDir).notFound(f.slug, f.root) };
  } else sources = featureDirs(projectDir);
  if (opts.activeOnly) sources = sources.filter((s) => !s.archived);
  const withBase = [];
  const unbaselined = [];
  const reopened = [];
  const stale = []; // [{ feature, archived, finishedAt, since, newFiles, why, drifted? }] — finished again needed (staleFinish)
  const errors = [];
  let lang = projectLang(projectDir);
  for (const s of sources) {
    const st = stateFromFile(projectDir, statePath(s.dir));
    if (named && typeof st.lang === "string") lang = normalizeLang(st.lang);
    if (st.invalid) { errors.push({ feature: s.slug, error: st.invalid }); continue; }
    if (!isObj(st.finished) || !isObj(st.finished.files)) { unbaselined.push(s.slug); continue; }
    const tracks = detectTracks(s.dir);
    if (detectPhase(s.dir, tracks) !== "complete") { reopened.push(s.slug); continue; }
    // Budgeted (SessionStart): the state-only check — no _Implements:_ walk before the hashing budget is even known. An
    // ARCHIVED feature is never walked either (the catalog's rule): it can't be finished again where it is, so a file
    // added later under a folder it once implemented kept drift at exit 1 for good, with a remedy (finish) that failed.
    // Its recorded files are still hashed, and a change request / re-approval newer than its baseline still makes it
    // stale — the CLI line then says to restore it first.
    const budgeted = opts.maxFiles != null || opts.maxBytes != null;
    const walk = !budgeted && !s.archived;
    const sf = staleFinish(projectDir, st, walk ? activeTasks(readIfExists(path.join(s.dir, "tasks.md")) || "", tracks) : "", { newFiles: walk });
    const staleEntry = sf ? { feature: s.slug, archived: s.archived, ...sf } : null;
    if (staleEntry) stale.push(staleEntry);
    withBase.push({ s, fin: st.finished, staleEntry });
  }
  if (named && errors.length && errors.length === sources.length) return { ok: false, error: errors[0].error, errors };
  const res = { ok: true, lang, features: [], drifted: [], unbaselined, reopened, stale, verdict: errors.length ? "error" : "clean" };
  for (const x of stale) x.why = staleFinishText(x, lang); // localized, for the CLI line
  if (errors.length) res.errors = errors;
  const recorded = withBase.reduce((n, x) => n + Object.keys(x.fin.files).length, 0);
  const rootReal = realRootOf(root);
  const over = () => {
    if (opts.maxFiles != null && recorded > opts.maxFiles) return true;
    if (opts.maxBytes == null) return false;
    let bytes = 0;
    for (const { fin } of withBase) for (const rel of Object.keys(fin.files)) {
      const abs = projectFile(root, rootReal, rel);
      try { if (abs) bytes += fs.statSync(abs).size; } catch { /* missing */ }
      if (bytes > opts.maxBytes) return true;
    }
    return false;
  };
  if (over()) return { ...res, skipped: true, recordedFiles: recorded, verdict: "skipped" };
  for (const { s, fin, staleEntry } of withBase) {
    const { unchanged, changed, missing, nowPresent, ignored } = baselineDrift(root, rootReal, fin);
    const d = { feature: s.slug, archived: s.archived, finishedAt: typeof fin.at === "string" ? fin.at : null, files: Object.keys(fin.files).length,
      unchanged, changed, missing, nowPresent, drifted: changed.length + missing.length + nowPresent.length > 0 };
    if (ignored.length) d.ignored = ignored;
    if (staleEntry) {
      staleEntry.drifted = d.drifted;
      if (!d.drifted) continue; // nothing recorded changed: listed in `stale` only (finish it again)
      d.stale = true;
    }
    res.features.push(d);
    if (d.drifted) res.drifted.push(s.slug);
  }
  if (res.drifted.length) res.verdict = "drift";
  else if (!errors.length && stale.length) res.verdict = "stale"; // not "clean": the baseline no longer covers the feature
  if (!res.features.length && !errors.length && !reopened.length && !stale.length) res.note = i18n.msg(lang).drift.none;
  return res;
}
// One finish baseline (state.finished) against the files now: the recorded files changed / missing / now present
// (missing at finish). Shared by spec_drift, next_action and a re-finish that replaces a drifted baseline.
function baselineDrift(root, rootReal, fin) {
  const changed = [], missing = [], nowPresent = [], ignored = [];
  let unchanged = 0;
  for (const [rel, was] of Object.entries(isObj(fin && fin.files) ? fin.files : {})) {
    const abs = projectFile(root, rootReal, rel);
    if (!abs || (was !== null && typeof was !== "string")) { ignored.push(rel); continue; }
    const now = fileHash(abs);
    if (was === null) { if (now === null) unchanged++; else nowPresent.push(rel); }
    else if (now === null) missing.push(rel);
    else if (now !== was) changed.push(rel);
    else unchanged++;
  }
  return { unchanged, changed, missing, nowPresent, ignored, drifted: changed.length + missing.length + nowPresent.length > 0 };
}

module.exports = { sectionFirstParagraph, oneLine, codeSpan, shortTitle, finishFeature, fileHash, projectFile,
  realRootOf, BASELINE_CAP, baselineFiles, recordFinishBaseline, staleFinish, changesSince, revokedSinceList,
  executionSignOffStale, signOffWhyText, staleFinishText, drift, baselineDrift, __link };
