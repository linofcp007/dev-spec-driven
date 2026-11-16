"use strict";
// Guards and hooks — protected tests (1.36, meta.guard "tests"): the level, the snapshot at the first tasks approval, the tick record, the edit decision (ready tasks, lifts, folders, globs, deny), the hook's strictest answer, protect / unprotect (and over elicitation), finish's check, doctor, the brief.

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

exports.run = async ({ ok, all, eq, remeasure, rpc, payload, S, tmp, hookIn, require, __dirname }) => {
  const E = require("./lib/engine/index.js"); // engine internals: readyTasks, protectWalkFirst, approvePhase without the facade
  const M = (l) => S.msg(l || "en").protectedTests;
  const js = JSON.stringify;
  const guardJs = path.join(__dirname, "..", "hooks", "guard-hook.js");
  const w = (p, rel, text) => { fs.mkdirSync(path.dirname(path.join(p, rel)), { recursive: true }); fs.writeFileSync(path.join(p, rel), text); };
  const stateOf = (f) => JSON.parse(fs.readFileSync(path.join(f.dir, ".state.json"), "utf8"));
  const setState = (f, patch) => fs.writeFileSync(path.join(f.dir, ".state.json"), JSON.stringify({ ...stateOf(f), ...patch }, null, 2));
  const listOf = (f) => (stateOf(f).protectedTests || {});
  const tasks = (f, text) => fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" + text);
  // the tasks approval forced (the snapshot is taken), then made a plain one (covering, not forced)
  const approveTasks = (p, slug, opts) => {
    const r = S.approvePhase(p, slug, "tasks", "me", Object.assign({ force: true }, opts || {}));
    const f = S.existingFeature(p, slug);
    const st = stateOf(f);
    if (st.approvals && st.approvals.tasks) { delete st.approvals.tasks.forced; delete st.approvals.tasks.failing; fs.writeFileSync(path.join(f.dir, ".state.json"), JSON.stringify(st, null, 2)); }
    return r;
  };
  const g = (p, file) => S.guardCheck(p, file, p);
  const tool = async (name, args) => { const r = await rpc("tools/call", { name, arguments: args }); let out; try { out = payload(r); } catch { out = { error: r.result.content[0].text }; } return Object.assign(out, { isError: r.result.isError === true }); };
  const pre = (cwd, toolName, input) => JSON.stringify({ session_id: "s-pt", hook_event_name: "PreToolUse", cwd, tool_name: toolName, tool_input: input });
  const hook = (cwd, toolName, input, env) => hookIn(guardJs, { input: pre(cwd, toolName, input), env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "", DEV_SPEC_GUARD_DEFAULT: "", ...(env || {}) }, encoding: "utf8" });
  const hookOut = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };
  const project = (name, opts) => { const p = path.join(tmp, "proj-pt-" + name); S.initProject(p, ["core"], "en", Object.assign({ guard: "tests" }, opts || {})); return p; };

  { // the level: spec_init {guard: "tests"} — stored, reported, its note and the unguarded warning; the user's default; the ladder
    const p = path.join(tmp, "proj-pt-level");
    const r = await tool("spec_init", { projectDir: p, guard: "tests" });
    const rAsk = await tool("spec_init", { projectDir: p, approvalGuard: "ask" });
    const pDef = path.join(tmp, "proj-pt-default");
    S.initProject(pDef, ["core"], "en", {});
    const before = S.guardLevel(pDef);
    const saved = process.env.DEV_SPEC_GUARD_DEFAULT;
    process.env.DEV_SPEC_GUARD_DEFAULT = "tests";
    let viaDefault;
    try { viaDefault = S.guardLevel(pDef); } finally { if (saved === undefined) delete process.env.DEV_SPEC_GUARD_DEFAULT; else process.env.DEV_SPEC_GUARD_DEFAULT = saved; }
    all("1.36 guard tests: spec_init {guard: 'tests'} stores meta.guard 'tests' and reports it, with its note and — the approval guard off — the warning that the lists live in an agent-writable .state.json (gone once it is on); DEV_SPEC_GUARD_DEFAULT=tests is the level of a project that leaves meta.guard unset (got " + js([r.guard, r.guardNote, r.protectedTestsWarning, rAsk.protectedTestsWarning, before, viaDefault]) + ")", {
      reported: () => r.guard === "tests", stored: () => S.readRoadmap(p).meta.guard === "tests", level: () => S.guardLevel(p) === "tests",
      note: () => r.guardNote === M().on, warned: () => r.protectedTestsWarning === M().unguarded, guarded: () => rAsk.protectedTestsWarning === undefined && rAsk.guard === "tests",
      defaultOff: () => before === false, defaultTests: () => viaDefault === "tests",
    });
  }

  { // readyTasks — the tasks that can start now: the first open task (a [P] run as a whole, one section) and every task whose _Depends:_ are done
    const blocks = (text) => S.taskBlocks(text);
    const ready = (text) => E.readyTasks(blocks(text)).join(",");
    eq([
      ready("- [x] 1. a\n- [ ] 2. b\n- [ ] 3. c\n"),
      ready("- [ ] 1. [P] a\n- [ ] 2. [P] b\n- [ ] 3. c\n"),
      ready("## Phase 1\n- [ ] 1. [P] a\n**Checkpoint:** one\n\n## Phase 2\n- [ ] 2. [P] b\n"),
      ready("- [x] 1. a\n- [ ] 2. b\n- [ ] 3. c\n  - _Depends: 1_\n- [ ] 4. d\n  - _Depends: 2_\n"),
    ], ["2", "1,2", "1", "2,3"], "1.36 guard tests: readyTasks = the first open task, its whole [P] run in one section, and each task whose _Depends:_ are all done — never a [P] task of the next section, never one waiting on an open dependency");
  }

  // ---- the decision: one project, two features (login covering, cart for the cross-feature cases) --------------------------------
  const pD = project("decide", { approvalGuard: "ask" });
  w(pD, "src/a.js", "a\n"); w(pD, "src/out.js", "o\n");
  w(pD, "test/auth.test.js", "auth\n"); w(pD, "test/p2.test.js", "p2\n"); w(pD, "test/far.test.js", "far\n"); w(pD, "test/dep.test.js", "dep\n");
  w(pD, "test/glob.test.js", "glob\n"); w(pD, "test/unit/deep.test.js", "deep\n"); w(pD, "test/made.test.js", "made\n");
  const fD = S.createFeature(pD, "Login", ["core"], "", undefined, "en");
  w(pD, ".specs/login/tests/red.test.js", "red\n"); w(pD, ".specs/login/tests/data.json", "{}\n");
  tasks(fD, "- [ ] 1. [P] First — names the folder and a glob, makes T-01 green\n  - _Implements: src/a.js, test/, test/*.test.js_\n  - _Makes green: T-01_\n" +
    "- [ ] 2. [P] Second\n  - _Implements: test/p2.test.js_\n- [ ] 3. Third\n  - _Implements: test/far.test.js_\n" +
    "- [ ] 4. Waits on 3\n  - _Depends: 3_\n  - _Implements: test/dep.test.js_\n");
  const snapD = approveTasks(pD, "login");
  const listD = listOf(fD);
  {
    const gAuth = g(pD, "test/auth.test.js"), gP2 = g(pD, "test/p2.test.js"), gFar = g(pD, "test/far.test.js"), gDep = g(pD, "test/dep.test.js");
    const gNew = g(pD, "test/brand-new.test.js"), gSrc = g(pD, "src/a.js"), gOut = g(pD, "src/out.js");
    all("1.36 guard tests: a test on the snapshot asks unless a task that can START NOW names it exactly — a ready [P] task's file passes; a folder, a glob or _Makes green:_ in a ready task never unlocks; a later task (3) or one waiting on it (4) never does; a new test file passes; code follows the scope rule, at level tests (got " +
      js([gAuth.why, gP2.why, gFar.why, gDep.why, gNew.why, gSrc.why, gOut.why, gOut.level]) + ")", {
      listed: () => Object.keys(listD.files || {}).includes("test/auth.test.js") && listD.via === "approval",
      auth: () => gAuth.decision === "ask" && gAuth.why === "protected-test" && gAuth.level === "tests" && gAuth.feature === "login",
      authReason: () => gAuth.reason.includes(M().current("1 (login), 2 (login)")) && gAuth.reason.includes(M().planHint(1, "login")) && /feature unprotect login test\/auth\.test\.js --reason "<reason>"/.test(gAuth.reason),
      readyP: () => gP2.decision === "allow", far: () => gFar.decision === "ask" && gFar.why === "protected-test", dep: () => gDep.decision === "ask",
      newTest: () => gNew.decision === "allow", src: () => gSrc.decision === "allow" && gSrc.why === "in-scope",
      outScope: () => gOut.decision === "ask" && gOut.why === "out-of-scope" && gOut.level === "tests" && /Guard mode is tests/.test(gOut.reason),
    });
    const gFolder = g(pD, "test"), gGlobFolder = g(pD, "test/u*"), gRoot = g(pD, "."), gGlob = g(pD, "test/*.test.js");
    const gSpecs = g(pD, ".specs/login/tests/red.test.js"), gSpecsData = g(pD, ".specs/login/tests/data.json"), gSpecsDir = g(pD, ".specs/login/tests");
    all("1.36 guard tests: a folder holding a protected test asks (even with `test/` in a ready task), a glob in the last segment asks — a nested test through a folder it matches too (`test/u*`), the project root asks; .specs/<f>/tests/ is in the snapshot and asks (its non-code file stays 'specs') (got " +
      js([gFolder.why, gGlobFolder.why, gRoot.why, gGlob.why, gSpecs.why, gSpecsData.why, gSpecsDir.why]) + ")", {
      folder: () => gFolder.decision === "ask" && gFolder.why === "protected-test" && gFolder.reason.includes(M().whyFolder(6, gFolder.protected[0])) && !gFolder.protected.includes("test/p2.test.js"),
      globFolder: () => gGlobFolder.decision === "ask" && gGlobFolder.protected.join() === "test/unit/deep.test.js",
      root: () => gRoot.decision === "ask" && gRoot.why === "protected-test", glob: () => gGlob.decision === "ask",
      specsListed: () => Object.keys(listD.files).includes(".specs/login/tests/red.test.js"),
      specs: () => gSpecs.decision === "ask" && gSpecs.why === "protected-test", specsData: () => gSpecsData.decision === "allow" && gSpecsData.why === "specs",
      specsDir: () => gSpecsDir.decision === "ask",
    });
  }
  { // lifts: one allows; `protect <file>` ends it; any feature's lift counts (one with no open task too); the snapshot note
    const un = S.manageFeature(pD, "unprotect", "login", "test/auth.test.js", { reason: "replaced by the v2 suite" });
    const gLifted = g(pD, "test/auth.test.js");
    const re = S.manageFeature(pD, "protect", "login", "test/auth.test.js", {});
    const gAgain = g(pD, "test/auth.test.js");
    // a lift recorded by another feature, one whose tasks are all done
    const fDone = S.createFeature(pD, "Done Work", ["core"], "", undefined, "en");
    tasks(fDone, "- [x] 1. old\n  - _Implements: src/old.js_\n");
    setState(fDone, { protectedTests: { files: {}, lifts: [{ file: "test/far.test.js", at: new Date().toISOString(), by: "u", reason: "r" }] } });
    const gOtherLift = g(pD, "test/far.test.js");
    all("1.36 guard tests: a lift allows the test; protect <file> ends the lift (the latest record decides) and it asks again; a lift any feature records counts — one whose tasks are all done too; the first approval's note says what was recorded (got " +
      js([un.ok, gLifted.why, re.unlifted, gAgain.why, gOtherLift.why, snapD.protectedTests]) + ")", {
      lift: () => un.ok && un.lifted.file === "test/auth.test.js" && un.lifted.reason === "replaced by the v2 suite" && un.listed === true,
      allowed: () => gLifted.decision === "allow", ended: () => re.unlifted === "test/auth.test.js" && re.lifts.some((l) => l.revoked === true),
      asks: () => gAgain.decision === "ask" && gAgain.why === "protected-test", otherFeature: () => gOtherLift.decision === "allow",
      snap: () => snapD.protectedTests && snapD.protectedTests.count === Object.keys(listD.files).length && snapD.note.includes(M().snapshotNote(snapD.protectedTests.count, 0)),
    });
  }
  { // deny under meta.approvalGuard deny (+ the user's line); the hook prints it; every target is read and the strictest wins
    const pZ = project("deny", { approvalGuard: "deny" });
    w(pZ, "src/a.js", "a\n"); w(pZ, "src/out.js", "o\n"); w(pZ, "test/auth.test.js", "auth\n");
    const fZ = S.createFeature(pZ, "Login", ["core"], "", undefined, "en");
    tasks(fZ, "- [ ] 1. A\n  - _Implements: src/a.js_\n");
    approveTasks(pZ, "login");
    const d = g(pZ, "test/auth.test.js");
    const hEdit = hookOut(hook(pZ, "Edit", { file_path: path.join(pZ, "test", "auth.test.js"), old_string: "a", new_string: "b" }));
    const hSed = hookOut(hook(pZ, "Bash", { command: "sed -i s/a/b/ src/out.js test/auth.test.js" }));
    S.initProject(pZ, ["core"], "en", { approvalGuard: "ask" });
    const hSedAsk = hookOut(hook(pZ, "Bash", { command: "sed -i s/a/b/ src/out.js test/auth.test.js" }));
    const hs = (h) => (h && h.hookSpecificOutput) || {};
    all("1.36 guard tests: under meta.approvalGuard deny a protected test is REFUSED — the agent's reason says not to route around it, the user's line carries the `!` lift command; the hook prints deny + systemMessage; a shell command's targets are all read: an out-of-scope file first never hides the protected test (deny; at ask, its ask's reason) (got " +
      js([d.decision, hs(hEdit).permissionDecision, hs(hSed).permissionDecision, hs(hSedAsk).permissionDecisionReason && hs(hSedAsk).permissionDecisionReason.slice(0, 60)]) + ")", {
      deny: () => d.decision === "deny" && d.reason === M().deny("test/auth.test.js", M().whyFile("login", S.dayOf(listOf(fZ).at))),
      userNote: () => d.userNote.startsWith(M().denyUser("test/auth.test.js", "! ").slice(0, -1)) && /! node ".+" feature unprotect login test\/auth\.test\.js --reason "<reason>"/.test(d.userNote),
      hookDeny: () => hs(hEdit).permissionDecision === "deny" && hs(hEdit).permissionDecisionReason === d.reason && hEdit.systemMessage === d.userNote,
      sedDeny: () => hs(hSed).permissionDecision === "deny" && hSed.systemMessage === d.userNote,
      sedAsk: () => hs(hSedAsk).permissionDecision === "ask" && /test\/auth\.test\.js is a protected test/.test(hs(hSedAsk).permissionDecisionReason),
    });
    // the hook at level tests read raw — meta.guard "tests", and the user's default with meta.guard unset
    const pH = project("hook-default", { approvalGuard: "ask" });
    w(pH, "src/a.js", "a\n"); w(pH, "test/auth.test.js", "auth\n");
    S.createFeature(pH, "Login", ["core"], "", undefined, "en");
    tasks(S.existingFeature(pH, "login"), "- [ ] 1. A\n  - _Implements: src/a.js_\n");
    approveTasks(pH, "login");
    const edit = (env) => hookOut(hook(pH, "Edit", { file_path: path.join(pH, "test", "auth.test.js"), old_string: "a", new_string: "b" }, env));
    const hMeta = edit();
    const rm = JSON.parse(fs.readFileSync(path.join(pH, ".specs", "roadmap.json"), "utf8"));
    delete rm.meta.guard;
    fs.writeFileSync(path.join(pH, ".specs", "roadmap.json"), JSON.stringify(rm, null, 2));
    const hDefault = edit({ DEV_SPEC_GUARD_DEFAULT: "tests" });
    const hNone = edit();
    all("1.36 guard tests: the guard hook reads level tests raw — meta.guard 'tests', and DEV_SPEC_GUARD_DEFAULT=tests while meta.guard is unset (without it: silent)", {
      meta: () => hs(hMeta).permissionDecision === "ask" && /protected test/.test(hs(hMeta).permissionDecisionReason),
      viaDefault: () => hs(hDefault).permissionDecision === "ask" && /protected test/.test(hs(hDefault).permissionDecisionReason), off: () => hNone === null,
    });
  }
  { // which features' lists count: a stale one's too (its new task never unlocks), with no covering feature beside a Phase 4 one; a forced
    // approval's ready task unlocks; a broken list never throws
    const pS = project("stale", { approvalGuard: "ask" });
    w(pS, "src/a.js", "a\n"); w(pS, "test/old.test.js", "old\n"); w(pS, "test/forced.test.js", "f\n");
    const fA = S.createFeature(pS, "Alpha", ["core"], "", undefined, "en");
    tasks(fA, "- [x] 1. Done\n  - _Implements: src/z.js_\n- [ ] 2. A\n  - _Implements: src/a.js_\n");
    approveTasks(pS, "alpha");
    const fB = S.createFeature(pS, "Beta", ["core"], "", undefined, "en");
    tasks(fB, "- [ ] 1. B\n  - _Implements: src/b.js_\n");
    setState(fB, { approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t" } } }); // covering, no list of its own
    // alpha goes stale: a task appended after its approval, naming the protected test — one that could start now (its dependency done)
    fs.appendFileSync(path.join(fA.dir, "tasks.md"), "- [ ] 3. Appended\n  - _Depends: 1_\n  - _Implements: test/old.test.js_\n");
    const gStale = g(pS, "test/old.test.js");
    // no covering feature: beta finished; a Phase 4 feature (an approved test plan) would wave test files through
    tasks(fB, "- [x] 1. B\n  - _Implements: src/b.js_\n");
    const fC = S.createFeature(pS, "Gamma", ["core", "tdd"], "", undefined, "en");
    setState(fC, { approvals: { "test-plan": { at: "2026-01-01T00:00:00Z", by: "t" } } });
    const gPhase4 = g(pS, "test/old.test.js");
    // a forced approval's ready task unlocks its file
    const fF = S.createFeature(pS, "Forced", ["core"], "", undefined, "en");
    tasks(fF, "- [ ] 1. F\n  - _Implements: test/forced.test.js_\n");
    S.approvePhase(pS, "forced", "tasks", "me", { force: true });
    const gForced = g(pS, "test/forced.test.js");
    // a hand-broken list (null) is no list — the guard answers, never throws
    setState(fC, { protectedTests: null });
    let gBroken = null, threw = null;
    try { gBroken = g(pS, "test/old.test.js"); } catch (e) { threw = e.message; }
    all("1.36 guard tests: a STALE feature's list still counts and its new (unapproved) task never unlocks it; with no covering feature the Phase 4 allow never waves a protected test through; a forced approval's task that can start now unlocks its file; a broken protectedTests is no list (got " +
      js([gStale.why, gPhase4.why, gForced.why, gBroken && gBroken.why, threw]) + ")", {
      stale: () => gStale.decision === "ask" && gStale.why === "protected-test" && gStale.feature === "alpha",
      phase4: () => gPhase4.decision === "ask" && gPhase4.why === "protected-test",
      forced: () => gForced.decision === "allow", broken: () => !threw && gBroken && gBroken.decision === "ask",
    });
  }

  { // the snapshot: only at the FIRST complete tasks approval at level tests — not at scope, not a role's waiting sign-off, kept after a
    // revoke and re-approval (a test made in between is not added), a walk racing an earlier snapshot never replaces it; a fast-forward
    // takes it; the walk is the facade's, before the feature lock
    const pA = project("snap", { approvalGuard: "ask" });
    w(pA, "test/a.test.js", "a\n");
    const fA = S.createFeature(pA, "Snap", ["core"], "", undefined, "en");
    tasks(fA, "- [ ] 1. A\n  - _Implements: src/a.js_\n");
    const fArch = S.createFeature(pA, "Old", ["core"], "", undefined, "en");
    w(pA, ".specs/old/tests/arch.test.js", "x\n");
    S.manageFeature(pA, "archive", "old");
    approveTasks(pA, "snap");
    const first = listOf(fA);
    w(pA, "test/later.test.js", "later\n");
    S.approvePhase(pA, "snap", "tasks", "me", { revoke: true });
    approveTasks(pA, "snap");
    const second = listOf(fA);
    // the engine's own approvePhase handed a walk while a snapshot exists (another process took it first): kept
    const raced = E.approvePhase(pA, "snap", "tasks", "me", { force: true, protectWalk: { files: { "test/zz.test.js": "0000000000000000" }, truncated: false } });
    const third = listOf(fA);
    // scope: no snapshot
    const pScope = project("snap-scope", { guard: "scope" });
    w(pScope, "test/a.test.js", "a\n");
    const fScope = S.createFeature(pScope, "Snap", ["core"], "", undefined, "en");
    tasks(fScope, "- [ ] 1. A\n  - _Implements: src/a.js_\n");
    const atScope = S.approvePhase(pScope, "snap", "tasks", "me", { force: true });
    // a role's sign-off that doesn't complete the phase: no snapshot; the fast-forward through tasks: one
    const pRole = project("snap-role", { approvalRoles: { tasks: ["dev", "qa"] } });
    w(pRole, "test/a.test.js", "a\n");
    const fRole = S.createFeature(pRole, "Snap", ["core"], "", undefined, "en");
    tasks(fRole, "- [ ] 1. A\n  - _Implements: src/a.js_\n");
    const half = S.approvePhase(pRole, "snap", "tasks", "me", { force: true, role: "dev" });
    const pFf = project("snap-ff", {});
    w(pFf, "test/a.test.js", "a\n");
    const fFf = S.createFeature(pFf, "Snap", ["core"], "", undefined, "en");
    tasks(fFf, "- [ ] 1. A\n  - _Implements: src/a.js_\n");
    const ff = S.approvePhase(pFf, "snap", null, "me", { force: true, through: "tasks" });
    all("1.36 guard tests: the snapshot — taken at the first complete tasks approval (an archived feature's tests left out), kept after a revoke and re-approval (a test made in between not added, `at` unchanged), never replaced by a walk racing it; none at scope or for a role's waiting sign-off; a fast-forward through tasks takes it (got " +
      js([Object.keys(first.files || {}), Object.keys(second.files || {}), raced.ok, atScope.protectedTests, half.complete, ff.ok && listOf(fFf).via]) + ")", {
      first: () => Object.keys(first.files).join() === "test/a.test.js" && first.via === "approval" && typeof first.at === "string",
      kept: () => second.at === first.at && !Object.keys(second.files).includes("test/later.test.js"),
      raced: () => raced.ok && third.at === first.at && !Object.keys(third.files).includes("test/zz.test.js"),
      scope: () => atScope.ok && !atScope.protectedTests && !("protectedTests" in stateOf(fScope)),
      role: () => half.ok && half.complete === false && !("protectedTests" in stateOf(fRole)),
      ff: () => ff.ok && listOf(fFf).via === "approval" && Object.keys(listOf(fFf).files).join() === "test/a.test.js",
    });
    // the facade's walk: made before the feature lock, only when this call may be the first complete tasks approval at level tests
    const seen = [];
    const stub = E.protectWalkFirst(function stubApprove(dir, name, phase, by, opts) { seen.push(!!(opts && opts.protectWalk)); return opts; });
    const pW = project("walk", {});
    w(pW, "test/a.test.js", "a\n");
    S.createFeature(pW, "W", ["core"], "", undefined, "en");
    stub(pW, "w", "tasks", "me", {}); stub(pW, "w", null, "me", { through: "tasks" }); stub(pW, "w", "design", "me", {});
    stub(pW, "w", "tasks", "me", { revoke: true }); stub(pW, "w", "tasks", "me", { dryRun: true });
    stub(pA, "snap", "tasks", "me", {}); // a snapshot exists
    stub(pScope, "snap", "tasks", "me", {}); // level scope
    const facade = fs.readFileSync(path.join(__dirname, "lib", "spec.js"), "utf8");
    eq([seen, /approvePhase: protectWalkFirst\(featureLocked\(approvePhase\)\)/.test(facade)], [[true, true, false, false, false, false, false], true],
      "1.36 guard tests: the test files are walked OUTSIDE the feature lock (the facade wraps the locked approvePhase) and only for a first tasks approval at level tests — a fast-forward through tasks too; never a design approval, a revocation, a preview, a feature already snapshotted or level scope");
  }

  { // the tick record: a ticked task's exact _Implements:_ tests are re-baselined, its _Verify:_ tests listed (a pytest node / an rspec line
    // read as the file; never a glob, never re-hashed); an untick keeps them; none below level tests
    const pT = project("tick", { approvalGuard: "ask" });
    w(pT, "src/cart.js", "c\n"); w(pT, "test/cart.test.js", "before\n"); w(pT, "test/listed.test.js", "orig\n");
    const fT = S.createFeature(pT, "Cart", ["core"], "", undefined, "en");
    tasks(fT, "- [ ] 1. Red test\n  - _Implements: test/cart.test.js, test/*.test.js_\n  - _Verify: node --test test/cart.test.js_\n" +
      "- [ ] 2. Fix\n  - _Implements: src/cart.js_\n  - _Verify: pytest tests/test_api.py::test_x_\n" +
      "- [ ] 3. More\n  - _Implements: src/cart.js_\n  - _Verify: rspec spec/a_spec.rb:12 && node --test test/listed.test.js_\n");
    approveTasks(pT, "cart");
    const h0 = listOf(fT).files["test/cart.test.js"];
    const gTask1 = g(pT, "test/cart.test.js");
    w(pT, "test/cart.test.js", "the red test T-01\n"); // task 1 writes it — planned
    S.completeTask(pT, "cart", 1, { command: "node --test test/cart.test.js", exitCode: 0 });
    const h1 = listOf(fT).files["test/cart.test.js"];
    const gTask2 = g(pT, "test/cart.test.js");
    w(pT, "tests/test_api.py", "def test_x(): pass\n"); w(pT, "spec/a_spec.rb", "it\n");
    const hListed0 = listOf(fT).files["test/listed.test.js"];
    w(pT, "test/listed.test.js", "weakened\n"); // a listed test changed, then run by task 3's _Verify:_
    S.completeTask(pT, "cart", 2, { command: "pytest tests/test_api.py::test_x", exitCode: 0 });
    const gPy = g(pT, "tests/test_api.py"); // task 3 still open: the feature's list is read
    S.completeTask(pT, "cart", 3, { command: "rspec spec/a_spec.rb:12 && node --test test/listed.test.js", exitCode: 0 });
    const files = listOf(fT).files;
    S.completeTask(pT, "cart", 3, null, { undo: true });
    const afterUndo = listOf(fT).files;
    const fin = S.finishFeature(pT, "cart", {});
    // below level tests a tick records nothing
    const pS2 = project("tick-scope", { guard: "scope" });
    w(pS2, "test/t.test.js", "t\n");
    const fS2 = S.createFeature(pS2, "S", ["core"], "", undefined, "en");
    tasks(fS2, "- [ ] 1. T\n  - _Implements: test/t.test.js_\n");
    S.approvePhase(pS2, "s", "tasks", "me", { force: true });
    S.completeTask(pS2, "s", 1, { summary: "done" });
    all("1.36 guard tests: the tick record — the red test task 1 writes (its exact _Implements:_) is allowed while task 1 can start, re-baselined at its tick, then protected from task 2; a pytest node id and an rspec line read as their files and listed at the tick; a glob never listed; a listed test a _Verify:_ runs keeps its recorded hash (finish names it); an untick keeps the entries; no list below level tests (got " +
      js([gTask1.why, gTask2.why, Object.keys(files), gPy.why, fin.protectedTests]) + ")", {
      allowed: () => gTask1.decision === "allow", rebaselined: () => h1 && h1 !== h0, protectedNow: () => gTask2.decision === "ask" && gTask2.why === "protected-test",
      pytest: () => typeof files["tests/test_api.py"] === "string" && gPy.decision === "ask" && gPy.why === "protected-test", rspec: () => typeof files["spec/a_spec.rb"] === "string",
      noGlob: () => !Object.keys(files).some((k) => /\*/.test(k)), noLaunder: () => hListed0 && files["test/listed.test.js"] === hListed0 && fin.protectedTests.unexplained.some((x) => x.file === "test/listed.test.js" && x.status === "changed"),
      plannedSilent: () => !fin.protectedTests.unexplained.some((x) => x.file === "test/cart.test.js"),
      untick: () => js(afterUndo) === js(files), scope: () => !("protectedTests" in stateOf(fS2)),
    });
  }

  { // protect / unprotect over MCP: the refusals (stable codes), a lift, protect add-only (a weakened test is never re-hashed), protect
    // <file> never re-hashes a listed one, the note below level tests
    const pP = project("ops", { approvalGuard: "off" });
    w(pP, "test/a.test.js", "a\n"); w(pP, "src/x.js", "x\n");
    S.createFeature(pP, "Ops", ["core"], "", undefined, "en");
    const f = S.existingFeature(pP, "ops");
    const noReason = await tool("spec_feature", { action: "unprotect", name: "ops", file: "test/a.test.js", projectDir: pP });
    const noFile = await tool("spec_feature", { action: "unprotect", name: "ops", reason: "r", projectDir: pP });
    const notTest = await tool("spec_feature", { action: "unprotect", name: "ops", file: "src/x.js", reason: "r", projectDir: pP });
    const glob = await tool("spec_feature", { action: "unprotect", name: "ops", file: "test/*.test.js", reason: "r", projectDir: pP });
    const outside = await tool("spec_feature", { action: "unprotect", name: "ops", file: "../elsewhere.test.js", reason: "r", projectDir: pP });
    const lifted = await tool("spec_feature", { action: "unprotect", name: "ops", file: "test/a.test.js", reason: "  the v2\nsuite ", projectDir: pP });
    const prot = await tool("spec_feature", { action: "protect", name: "ops", projectDir: pP });
    const h = listOf(f).files["test/a.test.js"];
    w(pP, "test/a.test.js", "weakened\n");
    const prot2 = S.manageFeature(pP, "protect", "ops", undefined, {});
    const prot3 = S.manageFeature(pP, "protect", "ops", "test/a.test.js", {});
    S.initProject(pP, ["core"], "en", { guard: "scope" });
    const prot4 = S.manageFeature(pP, "protect", "ops", undefined, {});
    all("1.36 guard tests: spec_feature unprotect refuses without a reason, a file, a test file (a glob is none) or inside the project — stable codes; with them it records the lift {file, at, by, reason} (one line); protect lists the tests present now (via protect), ADD-ONLY: a weakened test keeps its recorded hash, protect <file> never re-hashes it either, and ends its lift; below level tests the note says the list is not read (got " +
      js([noReason.code, noFile.code, notTest.code, glob.code, outside.code, lifted.lifted, prot.protectedTests]) + ")", {
      codes: () => js([noReason.code, noFile.code, notTest.code, glob.code, outside.code]) === js(["reason-required", "file-required", "not-a-test", "not-a-test", "outside-project"]) && [noReason, noFile, notTest, outside].every((r) => r.isError),
      messages: () => noReason.error === M().err.reasonRequired && notTest.error === M().err.notATest("src/x.js"),
      lift: () => lifted.ok && lifted.lifted.file === "test/a.test.js" && lifted.lifted.reason === "the v2 suite" && typeof lifted.lifted.by === "string" && lifted.listed === false,
      protect: () => prot.ok && prot.protectedTests.via === "protect" && prot.protectedTests.count === 1 && prot.protectedTests.added === 1,
      addOnly: () => prot2.protectedTests.added === 0 && listOf(f).files["test/a.test.js"] === h,
      fileNoRehash: () => prot3.ok && prot3.unlifted === "test/a.test.js" && listOf(f).files["test/a.test.js"] === h && prot3.lifts.some((l) => l.revoked === true),
      note: () => prot4.note.includes(M().notEnforced) && !prot2.note.includes(M().notEnforced),
    });
  }

  { // over MCP elicitation (another client, meta.approvalGuard ask): checked BEFORE the question; a decline records nothing; an approve
    // records the lift with `confirmed`; the question names the file and the reason
    const SERVER_JS = path.join(__dirname, "server.js");
    const kid = spawn(process.execPath, [SERVER_JS], { env: { ...process.env, SPEC_MCP_APPROVAL_HOOK: "", DEV_SPEC_ELICIT_TIMEOUT_MS: "5000" }, stdio: ["pipe", "pipe", "inherit"] });
    const waiting = new Map(), asked = [];
    let buf = "", n = 0, answer = () => null;
    const write = (m) => kid.stdin.write(JSON.stringify(m) + "\n");
    kid.stdout.on("data", (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const m = JSON.parse(line);
        if (m.method === "elicitation/create") { asked.push(m); const a = answer(m); if (a) setTimeout(() => write(Object.assign({ jsonrpc: "2.0", id: m.id }, a)), 20); continue; }
        if (m.method) continue;
        if (waiting.has(m.id)) { const cb = waiting.get(m.id); waiting.delete(m.id); cb(m); }
      }
    });
    const req = (method, params) => new Promise((resolve) => {
      const id = "pt-" + ++n;
      const t = setTimeout(() => { waiting.delete(id); resolve({ result: { content: [{ text: "{}" }] } }); }, 15000);
      waiting.set(id, (m) => { clearTimeout(t); resolve(m); });
      write({ jsonrpc: "2.0", id, method, params });
    });
    const call = async (name, args) => { const r = await req("tools/call", { name, arguments: args }); return JSON.parse(r.result.content[0].text); };
    await req("initialize", { protocolVersion: "2025-06-18", capabilities: { elicitation: {} }, clientInfo: { name: "pt-client", version: "1" } });
    const pE = project("elicit", { approvalGuard: "ask" });
    w(pE, "test/a.test.js", "a\n");
    const fE = S.createFeature(pE, "Elicit", ["core"], "", undefined, "en");
    const noReason = await call("spec_feature", { action: "unprotect", name: "elicit", file: "test/a.test.js", projectDir: pE });
    const askedBefore = asked.length;
    answer = () => ({ result: { action: "decline" } });
    const declined = await call("spec_feature", { action: "unprotect", name: "elicit", file: "test/a.test.js", reason: "flaky\u0007 rewrite", projectDir: pE });
    const afterDecline = (stateOf(fE).protectedTests || {}).lifts;
    answer = () => ({ result: { action: "accept", content: { approve: true, note: "ok" } } });
    const accepted = await call("spec_feature", { action: "unprotect", name: "elicit", file: "test/a.test.js", reason: "flaky rewrite", projectDir: pE });
    const lifts = (stateOf(fE).protectedTests || {}).lifts || [];
    await new Promise((resolve) => { kid.on("exit", resolve); kid.stdin.end(); });
    const q = (asked[0] || { params: {} }).params.message || "";
    all("1.36 guard tests over MCP elicitation: an unprotect without a reason is refused before any question; the question names the test and the reason (control characters out); a decline records nothing; an approve records the lift with `confirmed` (got " +
      js([noReason.code, askedBefore, declined.declined, q, accepted.lifted]) + ")", {
      refusedFirst: () => noReason.code === "reason-required" && askedBefore === 0,
      question: () => q.includes(S.msg("en").approvalGuard.action({ kind: "guard-down", setting: "unprotect", file: "test/a.test.js", feature: "elicit" })) && q.includes(S.msg("en").elicit.unprotect("flaky rewrite")),
      declined: () => declined.declined === true && afterDecline === undefined,
      accepted: () => accepted.ok && lifts.length === 1 && lifts[0].confirmed && lifts[0].confirmed.via === "elicitation" && lifts[0].confirmed.note === "ok",
    });
  }

  { // finish: re-hashed against every live feature's records and every lift in force — a warning (capped) and the merge summary's block
    const pF = project("finish", { approvalGuard: "ask" });
    for (let i = 1; i <= 7; i++) w(pF, "test/t" + i + ".test.js", "t" + i + "\n");
    w(pF, "test/shared.test.js", "s\n"); w(pF, "test/lifted.test.js", "l\n");
    const fF = S.createFeature(pF, "Fin", ["core"], "", undefined, "en");
    tasks(fF, "- [ ] 1. A\n  - _Implements: src/a.js_\n");
    approveTasks(pF, "fin");
    const clean = S.finishFeature(pF, "fin", {});
    // another feature plans and ticks a change of a test on fin's list (its re-baseline explains it)
    const fO = S.createFeature(pF, "Other", ["core"], "", undefined, "en");
    tasks(fO, "- [ ] 1. O\n  - _Implements: test/shared.test.js_\n");
    approveTasks(pF, "other");
    w(pF, "test/shared.test.js", "s2\n");
    S.completeTask(pF, "other", 1, { summary: "done" });
    S.manageFeature(pF, "unprotect", "other", "test/lifted.test.js", { reason: "rewritten on purpose" });
    w(pF, "test/lifted.test.js", "l2\n");
    for (let i = 1; i <= 6; i++) w(pF, "test/t" + i + ".test.js", "changed " + i + "\n");
    fs.unlinkSync(path.join(pF, "test", "t7.test.js"));
    const dirty = S.finishFeature(pF, "fin", {});
    const warn = dirty.warnings.find((x) => x.startsWith(M().finishWarn("fin", "", 0).slice(0, 20))) || "";
    all("1.36 guard tests: spec_finish re-hashes the list — silent while nothing changed; a change no live feature's record (another feature's tick) and no lift (of any feature) explains is a warning naming the first 5 and how many more (changed / deleted), never a blocker; the merge summary carries the Protected tests block (got " +
      js([clean.protectedTests, dirty.protectedTests, warn.slice(0, 120)]) + ")", {
      clean: () => clean.protectedTests && clean.protectedTests.count === 9 && clean.protectedTests.unexplained.length === 0 && !clean.warnings.some((x) => /Protected tests of/.test(x)),
      unexplained: () => dirty.protectedTests.unexplained.length === 7 && dirty.protectedTests.unexplained.find((x) => x.file === "test/t7.test.js").status === "deleted",
      crossFeature: () => !dirty.protectedTests.unexplained.some((x) => x.file === "test/shared.test.js"),
      lifted: () => dirty.protectedTests.lifted.length === 1 && dirty.protectedTests.lifted[0].file === "test/lifted.test.js" && dirty.protectedTests.lifted[0].reason === "rewritten on purpose",
      warning: () => warn === M().finishWarn("fin", dirty.protectedTests.unexplained.slice(0, 5).map((x) => M()[x.status](x.file)).join(", "), 2),
      notBlocker: () => !dirty.blockers.some((b) => /protected/i.test(b)),
      summary: () => dirty.mergeSummary.includes(M().summaryHead) && dirty.mergeSummary.includes(M().summaryLine(9, 7)) && dirty.mergeSummary.includes(M().summaryLift("test/lifted.test.js", dirty.protectedTests.lifted[0].by, "rewritten on purpose")),
    });
  }

  { // doctor protected-tests — level tests, approved open tasks: no snapshot / truncated / the approval guard off; never below level tests.
    // The 2,000-file cap (truncated; protect never grows a capped list) and the snapshot's cost: linear (2,000 vs 200 test files, a ratio)
    const pN = project("doctor", { approvalGuard: "ask" });
    const fN = S.createFeature(pN, "Doc", ["core"], "", undefined, "en");
    tasks(fN, "- [ ] 1. A\n  - _Implements: src/a.js_\n");
    setState(fN, { approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t" } } }); // approved before the level was set: no snapshot
    const dMissing = (S.specDoctor(pN, "doc").checks || []).find((c) => c.id === "protected-tests");
    S.initProject(pN, ["core"], "en", { approvalGuard: "off" });
    const dBoth = (S.specDoctor(pN, "doc").checks || []).find((c) => c.id === "protected-tests");
    S.initProject(pN, ["core"], "en", { guard: "scope" });
    const dScope = (S.specDoctor(pN, "doc").checks || []).find((c) => c.id === "protected-tests");
    const big = (n, name) => {
      const p = project("cost-" + name, { approvalGuard: "ask" });
      for (let i = 0; i < n; i++) w(p, "test/d" + (i % 20) + "/t" + String(i).padStart(4, "0") + ".test.js", "t" + i + "\n");
      const f = S.createFeature(p, "Cost", ["core"], "", undefined, "en");
      tasks(f, "- [ ] 1. A\n  - _Implements: src/a.js_\n");
      return { p, f };
    };
    const c2000 = big(2000, "2000"), c200 = big(200, "200"), c4000 = big(4000, "4000");
    const time = (c) => { const t0 = process.hrtime.bigint(); const r = S.approvePhase(c.p, "cost", "tasks", "me", { force: true }); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      S.approvePhase(c.p, "cost", "tasks", "me", { revoke: true }); const st = stateOf(c.f); delete st.protectedTests; fs.writeFileSync(path.join(c.f.dir, ".state.json"), JSON.stringify(st)); return { ms, count: r.protectedTests && r.protectedTests.count }; };
    const sample = remeasure(() => { const a = time(c2000), b = time(c200); return { a, b, ratio: a.ms / Math.max(1, b.ms) }; }, (s) => s.ratio <= 25);
    // past the cap the walk STOPS: 4,000 test files cost what 2,000 do (it neither lists nor hashes the rest)
    const over = remeasure(() => { const a = time(c4000), b = time(c2000); return { a, b, ratio: a.ms / Math.max(1, b.ms) }; }, (s) => s.ratio <= 1.5);
    // past the cap: truncated, and protect (a new file sorting first) never grows the capped list
    const capped = S.approvePhase(c4000.p, "cost", "tasks", "me", { force: true });
    w(c4000.p, "test/a-first.test.js", "first\n");
    const prot = S.manageFeature(c4000.p, "protect", "cost", undefined, {});
    const dTrunc = (S.specDoctor(c4000.p, "cost").checks || []).find((c) => c.id === "protected-tests");
    all("1.36 guard tests: doctor protected-tests warns at level tests on approved, open tasks — no snapshot (the runnable feature protect), the approval guard off, a truncated snapshot — never below level tests; the snapshot stops at 2,000 files (truncated; 4,000 test files cost what 2,000 do, ≤ 1.5×) and protect never grows past it; its cost is linear — 2,000 vs 200 test files ≤ 25× (got " +
      js([dMissing, dBoth && dBoth.detail.length, dScope, capped.protectedTests, prot.protectedTests, { ratio: sample.ratio, a: sample.a.ms, b: sample.b.ms, tries: sample.tries }, { ratio: over.ratio, a: over.a.ms, b: over.b.ms, tries: over.tries }]) + ")", {
      missing: () => dMissing && dMissing.status === "warn" && dMissing.detail === M().doctorMissing("doc"),
      unguarded: () => dBoth && dBoth.detail === M().doctorMissing("doc") + " " + M().unguarded, scope: () => dScope === undefined,
      counts: () => sample.a.count === 2000 && sample.b.count === 200 && over.a.count === 2000, linear: () => sample.ratio <= 25, stops: () => over.ratio <= 1.5,
      capped: () => capped.protectedTests.count === 2000 && capped.protectedTests.truncated === true && capped.note.includes(M().snapshotNote(2000, 2000)),
      protectCapped: () => prot.protectedTests.count === 2000 && prot.protectedTests.added === 0 && prot.protectedTests.truncated === true,
      doctorTruncated: () => dTrunc && dTrunc.detail === M().truncated(2000),
    });
  }

  { // the shape: a protectedTests that is no object, or whose files / lifts are of the wrong kind, is refused like any wrong shape
    const pX = project("shape", { approvalGuard: "ask" });
    const fX = S.createFeature(pX, "Shape", ["core"], "", undefined, "en");
    tasks(fX, "- [ ] 1. A\n  - _Implements: src/a.js_\n");
    const refusals = ["x", { files: [] }, { files: {}, lifts: {} }].map((v) => { setState(fX, { protectedTests: v }); return S.completeTask(pX, "shape", 1, { summary: "done" }); });
    setState(fX, { protectedTests: { files: {}, lifts: [] } });
    const fine = S.completeTask(pX, "shape", 1, { summary: "done" });
    all("1.36 guard tests: .state.json's protectedTests of the wrong shape (no object, files no object, lifts no list) is refused before anything is written — its own jsonShape message; the right shape ticks (got " + js([refusals.map((r) => r.error), fine.ok]) + ")", {
      refused: () => refusals.every((r) => r.ok === false && r.error.includes(S.msg("en").jsonShape.protectedTests)), fine: () => fine.ok === true,
    });
  }

  { // the brief: an open task at level tests carries the count and the definition-of-done line; none below level tests
    const pB = project("brief", { approvalGuard: "ask" });
    w(pB, "test/a.test.js", "a\n"); w(pB, "test/b.test.js", "b\n");
    const fB = S.createFeature(pB, "Brief", ["core"], "", undefined, "en");
    tasks(fB, "- [ ] 1. A\n  - _Implements: src/a.js_\n");
    approveTasks(pB, "brief");
    const br = S.taskBrief(pB, "brief", 1, {});
    S.initProject(pB, ["core"], "en", { guard: "scope" });
    const brScope = S.taskBrief(pB, "brief", 1, {});
    all("1.36 guard tests: the brief of an open task at level tests carries protectedTests (the feature's list) and its definition-of-done line; below level tests neither", {
      key: () => br.protectedTests === 2, line: () => br.brief.includes(M().briefDod(2)),
      scope: () => !("protectedTests" in brScope) && !brScope.brief.includes(M().briefDod(2).slice(0, 30)),
    });
  }

  { // +port and the protected tests (1.36, the two items met): a task the port's fence holds cannot start now — a [P] task beside
    // the open baseline names a protected test in _Implements:_: it asks until the baseline is ticked AND verified, then it is free
    const pP = project("port-held", { approvalGuard: "ask" });
    w(pP, "test/parser.test.js", "parser\n");
    const fP = S.createFeature(pP, "Csv port", ["core", "port"], "", undefined, "en");
    tasks(fP, "- [ ] 1. [P] Record the baseline\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node base.js_\n" +
      "- [ ] 2. [P] Port the parser\n  - _Requirements: US-1.AC-1_\n  - _Implements: test/parser.test.js_\n");
    approveTasks(pP, "csv-port");
    const listed = Object.keys(listOf(fP).files || {}).includes("test/parser.test.js");
    const ready = E.readyTasks(S.taskBlocks(fs.readFileSync(path.join(fP.dir, "tasks.md"), "utf8"))).join(",");
    const held = g(pP, "test/parser.test.js");
    const unverified = S.completeTask(pP, "csv-port", 1, undefined, { note: "UNVERIFIED: recorded by hand" });
    const stillHeld = g(pP, "test/parser.test.js");
    S.completeTask(pP, "csv-port", 1, undefined, { undo: true });
    const ticked = S.completeTask(pP, "csv-port", 1, { command: "node base.js", exitCode: 0 });
    const free = g(pP, "test/parser.test.js");
    all("1.36 guard tests + port: a task +port's fence holds cannot start now — test/parser.test.js (in the snapshot), named by [P] task 2 beside the open baseline (task 1, which readyTasks also lists), asks; it still asks once the baseline is ticked unverified; ticked with its _Verify:_ run, task 2 unlocks it (got " + js({ listed, ready, held: held.decision, unverified: unverified.ok, stillHeld: stillHeld.decision, ticked: ticked.ok, free: free.decision || "allow" }) + ")", {
      listed: () => listed, bothReady: () => ready === "1,2",
      held: () => held.decision === "ask" && held.why === "protected-test",
      unverified: () => stillHeld.decision === "ask",
      free: () => ticked.ok === true && free.decision !== "ask" && free.decision !== "deny",
    });
  }
};
