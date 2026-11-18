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
  { // lifts: one allows; `protect <file>` ends it; another feature's lift counts whatever that feature's tasks — all ticked, or with an
    // open task again (1.36.0 review 3: a lift is in force until a protect <file> record, the 1.36 rule); the snapshot note
    const un = S.manageFeature(pD, "unprotect", "login", "test/auth.test.js", { reason: "replaced by the v2 suite" });
    const gLifted = g(pD, "test/auth.test.js");
    const re = S.manageFeature(pD, "protect", "login", "test/auth.test.js", {});
    const gAgain = g(pD, "test/auth.test.js");
    // a lift recorded by another feature, one whose tasks are all done (never finished), then with an open task again
    const fDone = S.createFeature(pD, "Done Work", ["core"], "", undefined, "en");
    tasks(fDone, "- [x] 1. old\n  - _Implements: src/old.js_\n");
    setState(fDone, { protectedTests: { files: {}, lifts: [{ file: "test/far.test.js", at: new Date().toISOString(), by: "u", reason: "r" }] } });
    const gDoneLift = g(pD, "test/far.test.js");
    tasks(fDone, "- [x] 1. old\n  - _Implements: src/old.js_\n- [ ] 2. more\n  - _Implements: src/old.js_\n");
    const gOtherLift = g(pD, "test/far.test.js");
    tasks(fDone, "- [x] 1. old\n  - _Implements: src/old.js_\n");
    S.manageFeature(pD, "protect", "done-work", "test/far.test.js", {}); // ended: protected again
    const gFarEnded = g(pD, "test/far.test.js");
    all("1.36 guard tests: a lift allows the test; protect <file> ends the lift (the latest record decides) and it asks again; another feature's lift counts whatever its tasks — all ticked, or one open again — until protect <file>; the first approval's note says what was recorded (got " +
      js([un.ok, gLifted.why, re.unlifted, gAgain.why, gDoneLift.why, gOtherLift.why, gFarEnded.why, snapD.protectedTests]) + ")", {
      lift: () => un.ok && un.lifted.file === "test/auth.test.js" && un.lifted.reason === "replaced by the v2 suite" && un.listed === true,
      allowed: () => gLifted.decision === "allow", ended: () => re.unlifted === "test/auth.test.js" && re.lifts.some((l) => l.revoked === true),
      asks: () => gAgain.decision === "ask" && gAgain.why === "protected-test",
      doneFeature: () => gDoneLift.decision === "allow", otherFeature: () => gOtherLift.decision === "allow",
      farEnded: () => gFarEnded.decision === "ask" && gFarEnded.why === "protected-test",
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
    // 1.36.0 review 3: protect {accept: true} — the same path: checked before the question (no reason: nobody is asked), its own sentence
    const askedBeforeAccept = asked.length;
    const accNoReason = await call("spec_feature", { action: "protect", name: "elicit", file: "test/a.test.js", accept: true, projectDir: pE });
    const askedAfterNoReason = asked.length;
    w(pE, "test/a.test.js", "a, rewritten\n");
    const accOk = await call("spec_feature", { action: "protect", name: "elicit", file: "test/a.test.js", accept: true, reason: "the rewrite is right", projectDir: pE });
    const accRec = ((stateOf(fE).protectedTests || {}).lifts || []).find((l) => l.accepted === true);
    const plain = await call("spec_feature", { action: "protect", name: "elicit", projectDir: pE }); // no accept: never asked
    const askedAfterPlain = asked.length;
    // 1.36.0 review 4 (R4-PT-4): the test rewritten while the question waits — refused (changed-since-preview), nothing recorded
    const accState = () => { const pt = stateOf(fE).protectedTests || {}; return js([(pt.lifts || []).filter((l) => l.accepted === true).length, (pt.files || {})["test/a.test.js"]]); };
    const beforeRace = accState();
    answer = () => { w(pE, "test/a.test.js", "a, swapped while the question waited\n"); return { result: { action: "accept", content: { approve: true } } }; };
    const race = await call("spec_feature", { action: "protect", name: "elicit", file: "test/a.test.js", accept: true, reason: "the rewrite is right", projectDir: pE });
    const afterRace = accState();
    await new Promise((resolve) => { kid.on("exit", resolve); kid.stdin.end(); });
    const q = (asked[0] || { params: {} }).params.message || "";
    const qAcc = (asked[askedBeforeAccept] || { params: {} }).params.message || "";
    all("1.36 guard tests over MCP elicitation, the accept: without a reason it is refused before any question; the question names the accept and its reason; an approve records the accept with `confirmed`; a plain protect asks nothing (got " +
      js([accNoReason.code, askedBeforeAccept, askedAfterNoReason, qAcc, accOk.accepted, askedAfterPlain]) + ")", {
      refusedFirst: () => accNoReason.code === "reason-required" && askedAfterNoReason === askedBeforeAccept,
      question: () => qAcc.includes(S.msg("en").approvalGuard.action({ kind: "guard-down", setting: "accept", file: "test/a.test.js", feature: "elicit" })) && qAcc.includes(S.msg("en").elicit.accept("the rewrite is right")),
      recorded: () => accOk.ok && accRec && accRec.reason === "the rewrite is right" && accRec.confirmed && accRec.confirmed.via === "elicitation",
      plain: () => plain.ok && askedAfterPlain === askedBeforeAccept + 1,
    });
    all("1.36.0 review 4 (R4-PT-4) guard tests over MCP elicitation: an accept records only the content the question was asked about — the test rewritten while it waited is refused changed-since-preview, nothing recorded (got " +
      js([race.code, race.error, beforeRace, afterRace]) + ")", {
      refused: () => race.ok === false && race.code === "changed-since-preview" && race.error === M().err.acceptChangedSincePreview("test/a.test.js"),
      nothingRecorded: () => afterRace === beforeRace,
    });
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
    // another feature plans and ticks a change of a test on fin's list (its re-baseline explains it); its lift counts (an open task left)
    const fO = S.createFeature(pF, "Other", ["core"], "", undefined, "en");
    tasks(fO, "- [ ] 1. O\n  - _Implements: test/shared.test.js_\n- [ ] 2. More\n  - _Implements: src/o.js_\n");
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

  { // +port, the differential check's half (1.36.0 review 1, T1): baseline 1 verified, port task 2 done, differential check 3 open —
    // improvement 4 (ready by its _Depends: 2_) names a protected test: it sits after the open D, so it unlocks nothing until D's run
    const pP = project("port-held-d", { approvalGuard: "ask" });
    w(pP, "test/parser.test.js", "parser\n");
    const fP = S.createFeature(pP, "Csv port", ["core", "port"], "", undefined, "en");
    tasks(fP, "- [ ] 1. Record the baseline\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node base.js_\n" +
      "- [ ] 2. Port the parser\n  - _Requirements: US-1.AC-1_\n  - _Verify: node port.js_\n" +
      "- [ ] 3. Differential check\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node diff.js_\n" +
      "- [ ] 4. Improve the parser's errors\n  - _Requirements: US-2.AC-1_\n  - _Depends: 2_\n  - _Implements: test/parser.test.js_\n  - _Verify: node imp.js_\n");
    approveTasks(pP, "csv-port");
    S.completeTask(pP, "csv-port", 1, { command: "node base.js", exitCode: 0 });
    S.completeTask(pP, "csv-port", 2, { command: "node port.js", exitCode: 0 });
    const ready = E.readyTasks(S.taskBlocks(fs.readFileSync(path.join(fP.dir, "tasks.md"), "utf8"))).join(",");
    const held = g(pP, "test/parser.test.js");
    const d = S.completeTask(pP, "csv-port", 3, { command: "node diff.js", exitCode: 0 });
    const free = g(pP, "test/parser.test.js");
    all("1.36 guard tests + port: a task after the OPEN differential check (4, ready by _Depends: 2_ — readyTasks lists 3 and 4) unlocks nothing: its protected test asks; D ticked with its run, task 4 unlocks it (got " + js({ ready, held: held.decision, d: d.ok, free: free.decision }) + ")", {
      ready: () => ready === "3,4", held: () => held.decision === "ask" && held.why === "protected-test" && !held.current.some((t) => t.number === 4),
      free: () => d.ok === true && free.decision !== "ask" && free.decision !== "deny",
    });
  }

  { // 1.36.0 review 1 (PT-1): a reopened task with a tick record never unlocks its _Implements:_ test — a box unchecked by hand (ticks[n]
    // kept) and an untick (an `unticks` entry; ticks[n] dropped) still ask; the re-tick keeps the recorded hash, so finish names the edit
    const pR = project("reopen", { approvalGuard: "ask" });
    w(pR, "src/cart.js", "c\n"); w(pR, "test/cart.test.js", "old\n");
    const fR = S.createFeature(pR, "Cart", ["core"], "", undefined, "en");
    tasks(fR, "- [ ] 1. Red test\n  - _Implements: test/cart.test.js_\n  - _Verify: node --test test/cart.test.js_\n- [ ] 2. Fix\n  - _Implements: src/cart.js_\n");
    approveTasks(pR, "cart");
    w(pR, "test/cart.test.js", "red T-01\n");
    S.completeTask(pR, "cart", 1, { command: "node --test test/cart.test.js", exitCode: 0 });
    const hRed = listOf(fR).files["test/cart.test.js"];
    const tf = path.join(fR.dir, "tasks.md");
    fs.writeFileSync(tf, fs.readFileSync(tf, "utf8").replace("- [x] 1.", "- [ ] 1.")); // unchecked by hand: no prompt, the approval current
    const gHand = g(pR, "test/cart.test.js");
    fs.writeFileSync(tf, fs.readFileSync(tf, "utf8").replace("- [ ] 1.", "- [x] 1."));
    const undo = S.completeTask(pR, "cart", 1, null, { undo: true, reason: "redo the red test" });
    const gUntick = g(pR, "test/cart.test.js");
    w(pR, "test/cart.test.js", "weakened\n"); // the user confirmed the ask
    const re = S.completeTask(pR, "cart", 1, { command: "node --test test/cart.test.js", exitCode: 0 });
    const hRe = listOf(fR).files["test/cart.test.js"];
    S.completeTask(pR, "cart", 2, { summary: "done" });
    const fin = S.finishFeature(pR, "cart", {});
    all("1.36 guard tests: a reopened task with a tick record unlocks nothing — unchecked by hand (ticks[n] kept) or unticked (unticks), its own _Implements:_ test still asks and it is not named as a task that can start now; its re-tick keeps the recorded hash and finish names the change (got " +
      js([gHand.why, undo.ok, gUntick.why, re.ok, hRe === hRed, fin.protectedTests]) + ")", {
      hand: () => gHand.decision === "ask" && gHand.why === "protected-test",
      untick: () => undo.ok && gUntick.decision === "ask" && gUntick.why === "protected-test" && !gUntick.current.some((t) => t.number === 1),
      kept: () => re.ok && typeof hRed === "string" && hRe === hRed,
      finishNames: () => fin.protectedTests.unexplained.some((x) => x.file === "test/cart.test.js" && x.status === "changed"),
    });
  }

  { // 1.36.0 review 1 (PT-2, T2): other spellings of a protected test at approvalGuard deny — a glob in a folder segment (the hook's shell
    // readings), a [class], a case variant (by name or not: listed is folded membership), a path through a junction, a listed path holding
    // brackets, a case variant of a listed test that is gone
    const pG = project("spellings", { approvalGuard: "deny" });
    w(pG, "src/cart.js", "c\n"); w(pG, "test/auth.test.js", "auth\n"); w(pG, "test/unit/deep.test.js", "deep\n"); w(pG, "src/cart.test.js", "colocated\n");
    w(pG, "pkg/test_util.py", "def test_x(): pass\n"); w(pG, "app/[id]/page.test.js", "page\n"); w(pG, "test/gone.test.js", "gone\n");
    const fG = S.createFeature(pG, "Cart", ["core"], "", undefined, "en");
    tasks(fG, "- [ ] 1. Cart logic\n  - _Implements: src/cart.js_\n");
    approveTasks(pG, "cart");
    fs.unlinkSync(path.join(pG, "test", "gone.test.js"));
    fs.symlinkSync(path.join(pG, "test"), path.join(pG, "t2"), "junction");
    const hs = (cmd, toolName) => { const h = hookOut(hook(pG, toolName || "Bash", { command: cmd })); return (h && h.hookSpecificOutput && h.hookSpecificOutput.permissionDecision) || "silent"; };
    const shell = { tesQ: hs("sed -i 's/a/b/' tes?/auth.test.js"), star: hs("sed -i 's/a/b/' */auth.test.js"), deep: hs("sed -i 's/x/y/' test/*/deep.test.js"),
      cls: hs("rm [t]est/auth.test.js"), ps: hs("Set-Content -Path tes?/auth.test.js -Value x", "PowerShell"), link: hs("sed -i 's/a/b/' t2/auth.test.js") };
    const d = (rel) => g(pG, rel).why;
    const edits = { link: d("t2/auth.test.js"), brackets: d("app/[id]/page.test.js"), name: d("src/cart.TEST.js"), ext: d("src/cart.test.JS"), all: d("SRC/Cart.Test.Js"),
      py: d("pkg/TEST_UTIL.PY"), gone: d("TEST/GONE.TEST.JS") };
    const fold = E.FOLD_CASE;
    all("1.36 guard tests: other spellings of a protected test are refused at deny — sed -i / Set-Content through a glob in a folder segment (tes?/, */, test/*/), rm [t]est/, an Edit or sed -i through a junction, a listed path holding brackets; where the file system folds case: a case variant by name (cart.TEST.js, .JS, TEST_UTIL.PY) and one of a listed test that is gone (got " +
      js([shell, edits]) + ")", {
      shellGlobs: () => shell.tesQ === "deny" && shell.star === "deny" && shell.deep === "deny" && shell.ps === "deny", cls: () => shell.cls === "deny",
      link: () => shell.link === "deny" && edits.link === "protected-test", brackets: () => edits.brackets === "protected-test",
      caseName: () => !fold || [edits.name, edits.ext, edits.all, edits.py].every((x) => x === "protected-test"), caseGone: () => !fold || edits.gone === "protected-test",
    });
  }

  { // 1.36.0 review 1 (PT-3): in a project past the cap, the feature's own .specs/<f>/tests/ is walked FIRST — before the project's 2,000
    // tests, and before another feature's (the same 2,000 moved into aaa, which sorts first) — then the project; `feature protect` alike
    const pC = project("cap-feature", { approvalGuard: "ask" });
    S.createFeature(pC, "Aaa", ["core"], "", undefined, "en");
    for (let i = 0; i < 2000; i++) w(pC, "test/bulk/d" + (i % 20) + "/t" + String(i).padStart(4, "0") + ".test.js", "t" + i + "\n");
    const fC = S.createFeature(pC, "Cart", ["core"], "", undefined, "en");
    w(pC, ".specs/cart/tests/cart.red.test.js", "red\n");
    tasks(fC, "- [ ] 1. A\n  - _Implements: src/cart.js_\n");
    const again = () => { S.approvePhase(pC, "cart", "tasks", "me", { revoke: true }); setState(fC, { protectedTests: undefined }); };
    const apProject = approveTasks(pC, "cart"); // the 2,000 in the project
    const viaProjectCap = listOf(fC);
    fs.mkdirSync(path.join(pC, ".specs", "aaa", "tests"), { recursive: true });
    fs.renameSync(path.join(pC, "test", "bulk"), path.join(pC, ".specs", "aaa", "tests", "bulk")); // …now in feature aaa
    w(pC, "test/p1.test.js", "p\n");
    again();
    const ap = approveTasks(pC, "cart");
    const viaApproval = listOf(fC);
    again();
    const prot = S.manageFeature(pC, "protect", "cart", undefined, {});
    const viaProtect = listOf(fC);
    const red = ".specs/cart/tests/cart.red.test.js";
    all("1.36 guard tests: past the 2,000-file cap the approving feature's own failing tests are listed (its .specs/<f>/tests/ first, then the other features', then the project) — 2,000 tests in the project, then in another feature; at the tasks approval and at `feature protect` (got " +
      js([apProject.protectedTests, Object.keys(viaProjectCap.files || {}).includes(red), ap.protectedTests, Object.keys(viaApproval.files || {}).includes(red), prot.protectedTests, Object.keys(viaProtect.files || {}).includes(red)]) + ")", {
      projectCap: () => apProject.protectedTests && apProject.protectedTests.count === 2000 && apProject.protectedTests.truncated === true && Object.keys(viaProjectCap.files).includes(red),
      approval: () => ap.protectedTests && ap.protectedTests.count === 2000 && ap.protectedTests.truncated === true && Object.keys(viaApproval.files).includes(red),
      protect: () => prot.ok && prot.protectedTests.truncated === true && Object.keys(viaProtect.files).includes(red),
    });
  }

  { // 1.36.0 review 1 (PT-4): `feature protect` before the tasks approval never cancels its snapshot — the approval walks and merges
    // add-only (the tests written in between listed), then marks the list via "approval"; a re-approval keeps it
    const pE = project("early-protect", { approvalGuard: "ask" });
    w(pE, "test/old.test.js", "old\n");
    const fE = S.createFeature(pE, "Cart", ["core"], "", undefined, "en");
    const early = S.manageFeature(pE, "protect", "cart", undefined, {});
    w(pE, "test/cart.test.js", "red\n"); w(pE, ".specs/cart/tests/red.test.js", "red\n"); // Phase 4 writes the failing tests
    tasks(fE, "- [ ] 1. A\n  - _Implements: src/cart.js_\n");
    const ap = approveTasks(pE, "cart");
    const after = listOf(fE);
    w(pE, "test/later.test.js", "later\n");
    S.approvePhase(pE, "cart", "tasks", "me", { revoke: true });
    approveTasks(pE, "cart");
    const again = listOf(fE);
    all("1.36 guard tests: a protect run before the tasks approval — the approval still records the snapshot (the tests written since listed, add-only) and marks it via approval; a revoke and re-approval keeps it (got " +
      js([early.protectedTests, ap.protectedTests, Object.keys(after.files || {}), after.via, Object.keys(again.files || {})]) + ")", {
      early: () => early.ok && early.protectedTests.via === "protect" && early.protectedTests.count === 1,
      snapshot: () => ap.protectedTests && ap.protectedTests.count === 3 && ["test/cart.test.js", ".specs/cart/tests/red.test.js"].every((k) => Object.keys(after.files).includes(k)),
      marked: () => after.via === "approval", kept: () => !Object.keys(again.files).includes("test/later.test.js"),
    });
  }

  { // 1.36.0 review 3 (R3-PT-2, R3-PT-3 — rounds 1 and 2 cut lifts at their feature's finish, then to its open tasks): a lift lasts until
    // a protect <file> record of any feature — recorded before its feature's finish or after it, its feature reopened or all ticked — the
    // same answer before and after an open task is added to it; doctor warns, on a finished feature, about each lift of its own recorded
    // BEFORE that finish and still in force (its two lines), never one after the finish or one a later record ended
    const pL = project("lift-ends", { approvalGuard: "ask" });
    for (const n of ["auth", "b", "c", "d", "e1", "e2"]) w(pL, "test/" + n + ".test.js", n + "\n");
    const fGa = S.createFeature(pL, "Gamma", ["core"], "", undefined, "en");
    tasks(fGa, "- [ ] 1. G\n  - _Implements: src/g.js_\n");
    approveTasks(pL, "gamma");
    const fAl = S.createFeature(pL, "Alpha", ["core"], "", undefined, "en");
    tasks(fAl, "- [x] 1. A\n  - _Implements: src/a.js_\n- [ ] 2. Reopened after the finish\n  - _Implements: src/a.js_\n");
    setState(fAl, { finished: { at: "2026-01-02T00:00:00.000Z", files: {} }, protectedTests: { files: {}, lifts: [
      { file: "test/auth.test.js", at: "2026-01-01T00:00:00.000Z", by: "u", reason: "intended" }, // before alpha's finish: still in force
      { file: "test/c.test.js", at: "2026-01-01T12:00:00.000Z", by: "u", revoked: true }, // alpha's protect <file>: ends beta's lift
      { file: "test/b.test.js", at: "2026-01-03T00:00:00.000Z", by: "u", reason: "reopened" }] } }); // after the finish: in force
    const fBe = S.createFeature(pL, "Beta", ["core"], "", undefined, "en");
    tasks(fBe, "- [ ] 1. B\n  - _Implements: src/b.js_\n");
    setState(fBe, { protectedTests: { files: {}, lifts: [{ file: "test/c.test.js", at: "2026-01-01T06:00:00.000Z", by: "u", reason: "r" }] } });
    const fDe = S.createFeature(pL, "Delta", ["core"], "", undefined, "en");
    tasks(fDe, "- [x] 1. D\n  - _Implements: src/d.js_\n"); // finished, nothing reopened: its lift after the finish counts
    setState(fDe, { finished: { at: "2026-01-02T00:00:00.000Z", files: {} }, protectedTests: { files: {}, lifts: [{ file: "test/d.test.js", at: "2026-01-03T00:00:00.000Z", by: "u", reason: "after" }] } });
    const fEp = S.createFeature(pL, "Epsilon", ["core"], "", undefined, "en");
    tasks(fEp, "- [x] 1. E\n  - _Implements: src/e.js_\n"); // finished, all ticked: e1's lift before the finish in force, e2's ended since
    setState(fEp, { finished: { at: "2026-01-02T00:00:00.000Z", files: {} }, protectedTests: { files: {}, lifts: [
      { file: "test/e1.test.js", at: "2026-01-01T00:00:00.000Z", by: "u", reason: "e1" }, { file: "test/e2.test.js", at: "2026-01-01T00:00:00.000Z", by: "u", reason: "e2" },
      { file: "test/e2.test.js", at: "2026-01-03T00:00:00.000Z", by: "u", revoked: true }] } });
    const gAuth = g(pL, "test/auth.test.js"), gB = g(pL, "test/b.test.js"), gC = g(pL, "test/c.test.js"), gD = g(pL, "test/d.test.js");
    tasks(fDe, "- [x] 1. D\n  - _Implements: src/d.js_\n- [ ] 2. An agent's line\n  - _Implements: src/d.js_\n"); // an open task again
    const gDOpen = g(pL, "test/d.test.js");
    tasks(fDe, "- [x] 1. D\n  - _Implements: src/d.js_\n");
    const doc = (slug) => (S.specDoctor(pL, slug).checks || []).find((c) => c.id === "protected-tests");
    const dAl = doc("alpha"), dDe = doc("delta"), dEp = doc("epsilon");
    all("1.36 guard tests: a lift lasts until protect <file> — alpha's lift recorded before alpha's finish still allows the test, one after it too, delta's after its finish (all ticked) too and the same with an open task added; alpha's protect <file> record still ends beta's earlier lift; doctor warns about a finished feature's lift recorded before its finish and in force (alpha's auth, epsilon's e1 — all ticked), never one after it (delta) or one ended since (e2) (got " +
      js([gAuth.why, gB.why, gC.why, gD.why, gDOpen.why, dAl, dDe, dEp]) + ")", {
      beforeFinish: () => gAuth.decision === "allow", afterFinish: () => gB.decision === "allow", revoked: () => gC.decision === "ask" && gC.why === "protected-test",
      doneAfterFinish: () => gD.decision === "allow" && gDOpen.decision === "allow",
      doctorAlpha: () => dAl && dAl.status === "warn" && dAl.detail === M().doctorLiftAfterFinish("alpha", "test/auth.test.js", "test/auth.test.js"),
      doctorLines: () => /feature protect alpha test\/auth\.test\.js\)/.test(dAl.detail) && /feature protect alpha test\/auth\.test\.js --accept --reason/.test(dAl.detail),
      doctorEpsilon: () => dEp && dEp.status === "warn" && dEp.detail === M().doctorLiftAfterFinish("epsilon", "test/e1.test.js", "test/e1.test.js"),
      doctorDelta: () => dDe === undefined,
    });
  }

  { // 1.36.0 review 1 (INT-1, PT-6, PT-7, PT-8): every task ticked, the feature unfinished — its listed test is still refused at deny; once
    // its finish is recorded the list no longer counts. The approval question names the file `newName` carries. Finish's hashes are taken
    // before the feature lock (the facade) and read under it
    const pI = project("all-done", { approvalGuard: "deny" });
    w(pI, "test/auth.test.js", "a\n");
    const fI = S.createFeature(pI, "Login", ["core"], "", undefined, "en");
    tasks(fI, "- [ ] 1. A\n  - _Implements: src/a.js_\n");
    approveTasks(pI, "login");
    S.completeTask(pI, "login", 1, { summary: "done" });
    const gDone = g(pI, "test/auth.test.js");
    const recorded = listOf(fI).files["test/auth.test.js"];
    const seen = [];
    const stub = E.protectHashFirst(function stubFinish(dir, name, opts) { seen.push(opts && opts.protectHashes ? js(opts.protectHashes) : null); return opts; });
    stub(pI, "login", { write: true });
    w(pI, "test/auth.test.js", "changed\n");
    const handed = E.finishFeature(pI, "login", { protectHashes: { "test/auth.test.js": recorded } });
    const rehashed = E.finishFeature(pI, "login", {});
    S.createFeature(pI, "No List", ["core"], "", undefined, "en"); // no list: the facade finishes it as before (nothing hashed)
    let noList;
    try { noList = S.finishFeature(pI, "no-list", {}); } catch (e) { noList = { threw: e.message }; }
    const facade = fs.readFileSync(path.join(__dirname, "lib", "spec.js"), "utf8");
    setState(fI, { finished: { at: new Date().toISOString(), files: {} } });
    const gFinished = g(pI, "test/auth.test.js");
    const ask = (ti) => S.approvalGuardDecision({ hook_event_name: "PreToolUse", tool_name: "mcp__plugin_dev-spec-driven_spec-driven__spec_feature", tool_input: ti }, "ask", { lang: "en" });
    const qNew = ask({ action: "unprotect", name: "login", newName: "test/auth.test.js", reason: "r" }), qFile = ask({ action: "unprotect", name: "login", file: "test/auth.test.js", reason: "r" });
    all("1.36 guard tests: every task ticked, no finish recorded — a listed test is still refused at deny (a protected test, not the generic ask); a recorded finish ends its list's protection; spec_feature unprotect's question names the file newName carries; finish's protected-test hashes are taken before the feature lock and read under it (got " +
      js([gDone.decision, gDone.why, gFinished.why, qNew.reason && qNew.reason.slice(0, 90), seen, handed.protectedTests, rehashed.protectedTests]) + ")", {
      allDone: () => gDone.decision === "deny" && gDone.why === "protected-test", finished: () => gFinished.why !== "protected-test",
      newName: () => qNew.decision === "ask" && qNew.reason === qFile.reason && qNew.reason.includes("test/auth.test.js"),
      prehashed: () => seen.length === 1 && seen[0] === js({ "test/auth.test.js": recorded }) && /finishFeature: protectHashFirst\(featureLocked\(finishFeature,/.test(facade),
      handed: () => handed.protectedTests.unexplained.length === 0 && rehashed.protectedTests.unexplained.some((x) => x.file === "test/auth.test.js"),
      noList: () => !noList.threw && noList.feature === "no-list" && !("protectedTests" in noList),
    });
  }

  { // 1.36.0 review 1 (INT-4): the scope ask keeps the space before the CLI line in every language
    eq(["en", "pt", "es"].map((l) => /\btests — node "[^"]+" init --guard on /.test(S.msg(l).scopeGuard.ask("src/b.js", "x", "h.", "tests"))),
      [true, true, true], "1.36 guard tests: the scope ask reads '(… tests — node \"…\" init --guard on …' in EN, PT and ES (a space before the command)");
  }

  { // 1.36.0 review 1 (T2, the tick record's path forms): a quoted _Verify:_ test path is read as its file, an absolute _Implements:_ path
    // inside the project as its project-relative one (both listed at the tick), and an absolute unprotect file lifts that test
    const pF = project("path-forms", { approvalGuard: "ask" });
    w(pF, "src/cart.js", "c\n");
    const fF = S.createFeature(pF, "Cart", ["core"], "", undefined, "en");
    const absImpl = path.join(pF, "test", "abs.test.js").split(path.sep).join("/");
    tasks(fF, "- [ ] 1. Tests\n  - _Implements: src/cart.js, " + absImpl + "_\n  - _Verify: node --test \"test/q.test.js\"_\n");
    approveTasks(pF, "cart");
    w(pF, "test/q.test.js", "q\n"); w(pF, "test/abs.test.js", "abs\n"); // written after the snapshot: only the tick lists them
    const tick = S.completeTask(pF, "cart", 1, { command: "node --test \"test/q.test.js\"", exitCode: 0 });
    const files = listOf(fF).files || {};
    const un = S.manageFeature(pF, "unprotect", "cart", path.join(pF, "test", "q.test.js"), { reason: "r" });
    all("1.36 guard tests: the tick record reads a quoted _Verify:_ test path (\"test/q.test.js\") and an absolute _Implements:_ path inside the project (test/abs.test.js); `feature unprotect` takes an absolute file inside the project (got " +
      js([tick.ok, Object.keys(files), un.ok, un.code, un.lifted && un.lifted.file]) + ")", {
      quoted: () => tick.ok && typeof files["test/q.test.js"] === "string",
      absImplements: () => typeof files["test/abs.test.js"] === "string",
      absUnprotect: () => un.ok === true && un.lifted.file === "test/q.test.js",
    });
  }

  { // 1.36.0 review 2 (R2-PT-1) → review 3 (R3-PT-2), in /spec-finish's order at deny: the written finish is ready (it records the finish)
    // and warns about the changed test; the user ACCEPTS it as the warning says — its own re-finish is explained by the hash, never a lift:
    // a later feature's edit is refused, also once login-loop has an open task again; a lift recorded before the finish lasts (doctor)
    const pO = project("finish-order", { approvalGuard: "deny" });
    w(pO, "src/auth.js", "module.exports = 1;\n");
    w(pO, "test/auth.test.js", "test('auth', () => { expect(login('a')).toBe(true); });\n");
    w(pO, "test/other.test.js", "test('other', () => {});\n");
    w(pO, "tests/integration/auth.test.js", "test('T-01', () => {});\n");
    const bf = S.createFeature(pO, "Login Loop", [], "users bounce back to /login", undefined, "en", "bugfix");
    const slug = "login-loop";
    const fill = (rel, pairs) => { const fp = path.join(bf.dir, rel); let t = fs.readFileSync(fp, "utf8"); pairs.forEach(([a, b]) => { t = t.split(a).join(b); }); fs.writeFileSync(fp, t); };
    const bugPath = path.join(bf.dir, "bug.md");
    fs.writeFileSync(bugPath, fs.readFileSync(bugPath, "utf8")
      .replace(/## Reproduction\n> \*\*TODO\*\*[^\n]*/, "## Reproduction\nLog in with an expired refresh token.")
      .replace(/## Root Cause\n> \*\*TODO\*\*[^\n]*/, "## Root Cause\nThe refresh handler returns 302 to /login before clearing the cookie (auth.js:88).")
      .replace(/## Fix\n\[[^\n]*\]/, "## Fix\nClear the cookie before redirecting."));
    fill("requirements.md", [["[the condition that triggers the bug]", "the refresh token has expired"], ["[the correct behavior]", "clear the session cookie before redirecting to /login"],
      ["[the neighbouring behavior that already worked]", "a login with a valid refresh token"], ["[nearby inputs that must keep working]", "a token that expires mid-request"]]);
    fill("test-plan.md", [["[unit/integration]", "integration"], ["`[path]`", "`tests/integration/auth.test.js`"]]);
    fill("tasks.md", [["\n  - _Implements: [the test file T-01 goes in]_", "\n  - _Implements: tests/integration/auth.test.js_"], ["\n  - _Implements: [path of the code the fix changes]_", "\n  - _Implements: src/auth.js_"],
      ["[command that runs T-01]", "node --test tests/integration/auth.test.js"], ["[exact values the fix must respect — versions, limits, formats]", "Node >= 20"], ["[full test suite command]", "npm test"]]);
    fill("bug.md", [["[correct behavior]", "the dashboard opens"], ["[what happens — error message, output, log lines]", "302 back to /login in a loop"]]);
    const approvals = ["requirements", "design", "test-plan", "tasks"].map((ph) => S.approvePhase(pO, slug, ph).ok);
    const listed = Object.keys(listOf(bf).files || {});
    const liftBefore = S.manageFeature(pO, "unprotect", slug, "test/other.test.js", { reason: "rewritten with the fix" });
    const gBefore = g(pO, "test/other.test.js"); // its feature open: in force
    const t1 = S.completeTask(pO, slug, 1, { command: "node --test tests/integration/auth.test.js", exitCode: 1, summary: "T-01 fails" });
    w(pO, "test/auth.test.js", "test('auth', () => { expect(login({ name: 'a' })).toBe(true); });\n"); // the user confirmed it
    w(pO, "test/other.test.js", "test('other', () => { expect(2).toBe(2); });\n"); // lifted
    const t2 = S.completeTask(pO, slug, 2, { command: "npm test", exitCode: 0, summary: "42/42 passing" });
    const fin = S.finishFeature(pO, slug, { write: true }); // /spec-finish step 1
    const finishedAt = (stateOf(bf).finished || {}).at;
    const finWarn = fin.warnings.find((x) => x.startsWith(M().finishWarn(slug, "", 0).slice(0, 20))) || "";
    // 1.36.0 review 3: the warning's line accepts the content — the user's decision — never a lift
    const acc = S.manageFeature(pO, "protect", slug, "test/auth.test.js", { accept: true, reason: "intended: login takes a user now" });
    const refin = S.finishFeature(pO, slug, { write: true, includeBody: true }); // the re-check (written; the merge summary shows the accept)
    // 1.36.0 review 4 (R4-PT-3): step 3 — finish again after a last-minute code change: the same cycle, the summary keeps the accept
    w(pO, "src/auth.js", "module.exports = 2; // a last-minute fix\n");
    const refin2 = S.finishFeature(pO, slug, { write: true, includeBody: true });
    const doc = () => (S.specDoctor(pO, slug).checks || []).find((c) => c.id === "protected-tests");
    const dLift = doc(); // the lift recorded before the finish (other) is still in force
    const fGm = S.createFeature(pO, "Gamma", ["core"], "", undefined, "en");
    tasks(fGm, "- [ ] 1. Gamma\n  - _Implements: src/auth.js_\n");
    approveTasks(pO, "gamma");
    const gAuth = g(pO, "test/auth.test.js"), gOther = g(pO, "test/other.test.js");
    const endOther = S.manageFeature(pO, "protect", slug, "test/other.test.js", {}); // doctor's first line: the lift ends
    const gOtherEnded = g(pO, "test/other.test.js"), dEnded = doc();
    // login-loop gets an open task again — an agent's one line in tasks.md (unguarded), then a change request: the accept unlocks nothing
    const tPath = path.join(bf.dir, "tasks.md"), tText = fs.readFileSync(tPath, "utf8");
    fs.writeFileSync(tPath, tText + "\n- [ ] 9. Tidy\n");
    const gAuthHand = g(pO, "test/auth.test.js");
    fs.writeFileSync(tPath, tText);
    const app = S.appendTasks(pO, slug, [{ text: "Log the redirect reason", implements: ["src/auth.js"], verify: ["npm test"] }]);
    const gAuthApp = g(pO, "test/auth.test.js");
    w(pO, "test/auth.test.js", "test('auth', () => { expect(true).toBe(true); });\n"); // weakened during gamma, by a script
    const gamFin = S.finishFeature(pO, "gamma", {}), ownFin = S.finishFeature(pO, slug, {});
    const files = (xs) => (xs || []).map((x) => x.file).sort().join();
    all("1.36 guard tests in /spec-finish's order: the written finish is ready and its warning gives the ACCEPT line; the accept re-baselines the test — the feature's own re-check is explained by the hash and its merge summary shows the accept, a third written finish of the same cycle too (1.36.0 review 4); the lift recorded before the finish stays in force (doctor names it) until protect <file>; a later feature's edit of the accepted test is refused, also once login-loop has an open task again (an agent's line in tasks.md, a change request); a later change is named by both finishes (got " +
      js({ approvals, listed, gBefore: gBefore.decision, fin: [fin.readyToFinish, finishedAt, fin.protectedTests], acc: acc.accepted, refin: refin.protectedTests, refin2: refin2.protectedTests, dLift,
        later: [gAuth.decision, gOther.decision, gOtherEnded.decision, dEnded], reopened: [gAuthHand.decision, app.ok, gAuthApp.decision], gamFin: gamFin.protectedTests, ownFin: ownFin.protectedTests }) + ")", {
      setup: () => approvals.every(Boolean) && ["test/auth.test.js", "test/other.test.js"].every((k) => listed.includes(k)) && liftBefore.ok && t1.ok && t2.ok,
      beforeInForce: () => gBefore.decision === "allow",
      step1: () => fin.readyToFinish === true && typeof finishedAt === "string" && finWarn === M().finishWarn(slug, M().changed("test/auth.test.js"), 0) && files(fin.protectedTests.lifted) === "test/other.test.js",
      acceptLine: () => finWarn.includes("feature protect " + slug + " <file> --accept --reason") && !/unprotect/.test(finWarn),
      accepted: () => acc.ok && acc.accepted.file === "test/auth.test.js" && acc.accepted.accepted === true && acc.accepted.reason === "intended: login takes a user now" && !acc.unlifted && acc.note.includes(M().accepted("test/auth.test.js", slug)),
      reFinish: () => refin.protectedTests.unexplained.length === 0 && files(refin.protectedTests.lifted) === "test/other.test.js" && files(refin.protectedTests.accepted) === "test/auth.test.js" && !refin.warnings.some((x) => /Protected tests of/.test(x)),
      summary: () => refin.mergeSummary.includes(M().summaryAccept("test/auth.test.js", acc.accepted.by, "intended: login takes a user now")),
      sameCycle: () => files(refin2.protectedTests.accepted) === "test/auth.test.js" && !refin2.protectedTests.unexplained.length &&
        refin2.mergeSummary.includes(M().summaryAccept("test/auth.test.js", acc.accepted.by, "intended: login takes a user now")),
      doctor: () => dLift && dLift.status === "warn" && dLift.detail === M().doctorLiftAfterFinish(slug, "test/other.test.js", "test/other.test.js") && dEnded === undefined,
      laterEdit: () => gAuth.decision === "deny" && gAuth.why === "protected-test" && gOther.decision === "allow" && endOther.unlifted === "test/other.test.js" && gOtherEnded.decision === "deny",
      reopened: () => gAuthHand.decision === "deny" && gAuthHand.why === "protected-test" && app.ok && gAuthApp.decision === "deny" && gAuthApp.why === "protected-test",
      // other.test.js, rewritten under the lift, then the lift ended (no accept): named by both (1.36.0 review 4 — gamma's snapshot,
      // taken while the lift stood, recorded login-loop's hash for it, never the rewritten content)
      laterFinish: () => files(gamFin.protectedTests.unexplained) === "test/auth.test.js,test/other.test.js" && !gamFin.protectedTests.lifted.length &&
        files(ownFin.protectedTests.unexplained) === "test/auth.test.js,test/other.test.js",
    });
  }

  { // 1.36.0 review 2 (R2-PT-2): the lift line names the feature being worked on — accounts (all ticked, never finished) sorts first, cart
    // is being worked on: the line names cart. 1.36.0 review 3 (R3-PT-1): a lift of either is in force — accounts' too — until protect
    // <file>, and cart's lasts once its tasks are all ticked (the final review's window). The order: an unlocker that lists the file, else
    // the first unlocker, else a holder with open tasks, else the first holder
    const liftOf = (r) => ((r.userNote || r.reason || "").match(/feature unprotect (\S+) test\/auth\.test\.js/) || [])[1];
    const pA = project("lift-line", { approvalGuard: "deny" });
    w(pA, "src/a.js", "a\n"); w(pA, "src/cart.js", "c\n"); w(pA, "test/auth.test.js", "auth\n");
    const fAc = S.createFeature(pA, "Accounts", ["core"], "", undefined, "en");
    tasks(fAc, "- [ ] 1. Accounts\n  - _Implements: src/a.js_\n");
    approveTasks(pA, "accounts");
    S.completeTask(pA, "accounts", 1, { summary: "done" });
    const fCa = S.createFeature(pA, "Cart", ["core"], "", undefined, "en");
    tasks(fCa, "- [ ] 1. Cart\n  - _Implements: src/cart.js_\n");
    approveTasks(pA, "cart");
    const dCart = g(pA, "test/auth.test.js");
    S.manageFeature(pA, "unprotect", "accounts", "test/auth.test.js", { reason: "the old line" });
    const dAccLift = g(pA, "test/auth.test.js");
    S.manageFeature(pA, "protect", "accounts", "test/auth.test.js", {});
    const dAccEnded = g(pA, "test/auth.test.js");
    S.manageFeature(pA, "unprotect", "cart", "test/auth.test.js", { reason: "cart changes the login signature" });
    const dCartLift = g(pA, "test/auth.test.js");
    S.completeTask(pA, "cart", 1, { summary: "done" });
    const dCartDone = g(pA, "test/auth.test.js");
    const pQ = project("lift-pref", { approvalGuard: "deny" });
    w(pQ, "src/a.js", "a\n"); w(pQ, "test/auth.test.js", "auth\n");
    const fOld = S.createFeature(pQ, "Old", ["core"], "", undefined, "en");
    tasks(fOld, "- [ ] 1. Old\n  - _Implements: src/a.js_\n");
    approveTasks(pQ, "old");
    S.completeTask(pQ, "old", 1, { summary: "done" }); // lists the test; all ticked, never finished
    const fAaa = S.createFeature(pQ, "Aaa", ["core"], "", undefined, "en");
    tasks(fAaa, "- [ ] 1. A\n  - _Implements: src/a.js_\n"); // pending: open tasks, no approval, no list
    const step3 = g(pQ, "test/auth.test.js");
    const fBbb = S.createFeature(pQ, "Bbb", ["core"], "", undefined, "en");
    tasks(fBbb, "- [ ] 1. B\n  - _Implements: src/a.js_\n");
    setState(fBbb, { approvals: { tasks: { at: "2026-01-01T00:00:00Z", by: "t" } } }); // covering, no list
    const step2 = g(pQ, "test/auth.test.js");
    const fCcc = S.createFeature(pQ, "Ccc", ["core"], "", undefined, "en");
    tasks(fCcc, "- [ ] 1. C\n  - _Implements: src/a.js_\n");
    approveTasks(pQ, "ccc"); // covering, lists the test
    const step1 = g(pQ, "test/auth.test.js");
    all("1.36 guard tests: the lift line names the feature being worked on — cart, not accounts (all ticked, never finished, first by name); accounts' lift is in force too until protect <file>, cart's lasts once its tasks are all ticked; with no unlocker listing the file, the first unlocker (bbb); with no unlocker, a holder with open tasks (aaa, before old) (got " +
      js({ cart: [dCart.decision, liftOf(dCart)], accLift: dAccLift.decision, accEnded: dAccEnded.decision, cartLift: dCartLift.decision, cartDone: [dCartDone.decision, dCartDone.why], steps: [liftOf(step1), liftOf(step2), liftOf(step3)] }) + ")", {
      namesCart: () => dCart.decision === "deny" && dCart.why === "protected-test" && liftOf(dCart) === "cart",
      accountsLift: () => dAccLift.decision === "allow" && dAccEnded.decision === "deny" && dAccEnded.why === "protected-test", cartLift: () => dCartLift.decision === "allow",
      cartDone: () => dCartDone.why !== "protected-test",
      listingUnlocker: () => step1.decision === "deny" && liftOf(step1) === "ccc", firstUnlocker: () => liftOf(step2) === "bbb", openHolder: () => liftOf(step3) === "aaa",
    });
  }

  { // 1.36.0 review 2 (R2-PT-4): at deny a FOLDER target with a glob above its last segment is read for protected tests too — rm -rf tes?/unit,
    // */unit, packages/*/test, mv packages/*/test, Remove-Item -Recurse tes?/unit; a non-code glob matching no protected test stays not-code
    const pU = project("glob-folders", { approvalGuard: "deny" });
    w(pU, "src/cart.js", "c\n"); w(pU, "test/auth.test.js", "auth\n"); w(pU, "test/unit/deep.test.js", "deep\n"); w(pU, "packages/a/test/api.test.js", "api\n");
    w(pU, "docs/a/old/readme.md", "old\n");
    const fU = S.createFeature(pU, "Cart", ["core"], "", undefined, "en");
    tasks(fU, "- [ ] 1. Cart logic\n  - _Implements: src/cart.js_\n");
    approveTasks(pU, "cart");
    const hs = (cmd, toolName) => { const h = hookOut(hook(pU, toolName || "Bash", { command: cmd })); return (h && h.hookSpecificOutput && h.hookSpecificOutput.permissionDecision) || "silent"; };
    const shell = { tesQ: hs("rm -rf tes?/unit"), star: hs("rm -rf */unit"), pkgs: hs("rm -rf packages/*/test"), mv: hs("mv packages/*/test /tmp/x"),
      ps: hs("Remove-Item -Recurse -Force tes?/unit", "PowerShell"), docs: hs("rm -rf doc?/a/old") };
    const gDocs = g(pU, "doc?/a/old"), gPkgs = g(pU, "packages/*/test");
    // below level tests a non-code glob still takes the early not-code allow — no feature read (a cost: 60 features, ×150 per target)
    const pV = project("glob-scope-cost", { guard: "scope" });
    w(pV, "docs/a/x.md", "x\n");
    for (let i = 0; i < 25; i++) tasks(S.createFeature(pV, "Feat " + i, ["core"], "", undefined, "en"), Array.from({ length: 20 }, (_, k) => "- [ ] " + (k + 1) + ". T\n  - _Implements: src/f" + i + "_" + k + ".js_\n").join(""));
    const per = (t) => { const t0 = process.hrtime.bigint(); for (let i = 0; i < 20; i++) g(pV, t); return Number(process.hrtime.bigint() - t0) / 1e6 / 20; };
    const cost = remeasure(() => { const glob = per("doc?/a/x.md"), plain = per("docs/a/x.md"); return { glob, plain, ratio: glob / Math.max(0.05, plain) }; }, (s) => s.ratio <= 4);
    const gScope = g(pV, "doc?/a/x.md");
    all("1.36 guard tests: a folder target with a glob above its last segment is refused at deny when it holds a protected test — rm -rf tes?/unit, */unit, packages/*/test, mv packages/*/test, Remove-Item -Recurse tes?/unit; a non-code glob holding none stays not-code; below level tests a non-code glob costs what a plain non-code target does (≤ 4×, 25 features) (got " +
      js([shell, gDocs.why, gPkgs.why, gScope.why, { ratio: cost.ratio, glob: cost.glob, plain: cost.plain, tries: cost.tries }]) + ")", {
      shell: () => ["tesQ", "star", "pkgs", "mv", "ps"].every((k) => shell[k] === "deny"), engine: () => gPkgs.decision === "deny" && gPkgs.why === "protected-test",
      notCode: () => shell.docs === "silent" && gDocs.decision === "allow" && gDocs.why === "not-code",
      scopeCost: () => gScope.why === "not-code" && cost.ratio <= 4,
    });
  }

  { // 1.36.0 review 2 (R2-PT-3): a reopened task's planned test still asks, and the ask says why — the planned test of a task reopened after
    // its tick needs a lift — never "no task that can start now names it"; another protected test keeps the plain text; the reopened task's
    // brief says so too (never "edit it when THIS task's _Implements:_ names it"), another task's brief keeps the plain line
    const pR = project("reopen-text", { approvalGuard: "ask" });
    w(pR, "src/cart.js", "c\n"); w(pR, "test/other.test.js", "other\n");
    const fR = S.createFeature(pR, "Cart", ["core"], "", undefined, "en");
    tasks(fR, "- [ ] 1. Red test\n  - _Implements: test/cart.test.js_\n  - _Verify: node --test test/cart.test.js_\n- [ ] 2. Fix\n  - _Implements: src/cart.js_\n");
    approveTasks(pR, "cart");
    w(pR, "test/cart.test.js", "red T-01\n");
    S.completeTask(pR, "cart", 1, { command: "node --test test/cart.test.js", exitCode: 0 });
    const undo = S.completeTask(pR, "cart", 1, null, { undo: true, reason: "red for the wrong reason" });
    const gRe = g(pR, "test/cart.test.js"), gOther = g(pR, "test/other.test.js");
    const b1 = S.taskBrief(pR, "cart", 1, {}), b2 = S.taskBrief(pR, "cart", 2, {});
    const n = Object.keys(listOf(fR).files || {}).length;
    all("1.36 guard tests: a reopened task's planned test asks and the ask names the reopened task (a lift is needed), never 'no task names it'; another protected test keeps the plain text; the reopened task's brief says its planned test needs the user's lift, another task's keeps the plain line (got " +
      js([undo.ok, gRe.why, gRe.reason && gRe.reason.slice(0, 200), gOther.why, n]) + ")", {
      reopened: () => undo.ok && gRe.decision === "ask" && gRe.why === "protected-test" && gRe.reason.includes(M().reopened("1 (cart)")) && !gRe.reason.includes(M().noCurrent),
      other: () => gOther.decision === "ask" && gOther.reason.includes(M().noCurrent) && !gOther.reason.includes(M().reopened("1 (cart)")),
      brief1: () => n === 2 && b1.brief.includes(M().briefDodReopened(n, "cart")) && !b1.brief.includes(M().briefDod(n)),
      brief2: () => b2.brief.includes(M().briefDod(n)) && !b2.brief.includes(M().briefDodReopened(n, "cart")),
    });
  }

  { // 1.36.0 review 3 (R3-PT-1): every task ticked, no finish yet (the final review, its fix round, the simplify pass) — the guard's line
    // names the only holder (no open task); the user runs it and the test is no longer refused (a lift does not depend on its feature's
    // open tasks); the same at approvalGuard ask; the real hook agrees
    const edit = (p) => hookOut(hook(p, "Edit", { file_path: path.join(p, "test", "auth.test.js"), old_string: "auth", new_string: "{ name: 'a' }" }));
    const hd = (h) => (h && h.hookSpecificOutput ? h.hookSpecificOutput.permissionDecision + " " + (h.hookSpecificOutput.permissionDecisionReason || "") + " " + (h.systemMessage || "") : "silent");
    const run = (ag) => {
      const p = project("all-ticked-line-" + ag, { approvalGuard: ag });
      w(p, "src/auth.js", "a\n"); w(p, "test/auth.test.js", "auth\n");
      const f = S.createFeature(p, "Alpha", ["core"], "", undefined, "en");
      tasks(f, "- [ ] 1. Login takes a user object\n  - _Implements: src/auth.js_\n  - _Verify: node --test test/auth.test.js_\n");
      approveTasks(p, "alpha");
      const tick = S.completeTask(p, "alpha", 1, { command: "node --test test/auth.test.js", exitCode: 0, summary: "1 passing" });
      const before = g(p, "test/auth.test.js"), hBefore = hd(edit(p));
      const line = (before.userNote || before.reason || "").match(/feature unprotect (\S+) (\S+) --reason/) || [];
      const lifted = line[1] ? S.manageFeature(p, "unprotect", line[1], line[2], { reason: "the review: the test asserted the old call" }) : { ok: false };
      const after = g(p, "test/auth.test.js"), hAfter = hd(edit(p));
      const listing = S.manageFeature(p, "protect", "alpha", undefined, {});
      return { tick: tick.ok, before: [before.decision, before.why], hBefore, line: line.slice(1), lifted, after: [after.decision, after.why], hAfter, active: listing.lifts.map((l) => l.active) };
    };
    const D = run("deny"), A = run("ask");
    all("1.36 guard tests: every task ticked, no finish — the guard's line names the only holder (alpha); run, its lift is in force: the edit is no longer refused as a protected test (deny and ask; the hook too), and the listing says the lift is active (got " + js({ D, A }) + ")", {
      deny: () => D.tick && D.before[0] === "deny" && D.before[1] === "protected-test" && D.line[0] === "alpha" && D.line[1] === "test/auth.test.js" && /^deny /.test(D.hBefore),
      ask: () => A.tick && A.before[0] === "ask" && A.before[1] === "protected-test" && A.line[0] === "alpha",
      lifted: () => D.lifted.ok && D.lifted.note === M().lifted("test/auth.test.js", "alpha", true) && A.lifted.ok,
      inForce: () => D.after[1] !== "protected-test" && A.after[1] !== "protected-test" && D.active.join() === "true" && A.active.join() === "true",
      hook: () => !/dev-spec guard \(tests\)/.test(D.hAfter) && !/dev-spec guard \(tests\)/.test(A.hAfter) && /dev-spec guard \(tests\)/.test(A.hBefore),
    });
  }

  { // 1.36.0 review 3 (R3-PT-3): a later cycle's finish is explained only by a lift still in force or a recorded / accepted hash — cycle 1's
    // lift (the guard's line) is not ended by the finish: in cycle 2 the guard allows the edit and finish names it lifted (they agree) and
    // doctor warns; ended (protect <file>), the guard refuses again and a change made around it is finish's warning; the accept explains it
    // by its hash, its record in the merge summary of that finish only
    const p = project("cross-cycle", { approvalGuard: "deny" });
    w(p, "src/auth.js", "a\n"); w(p, "test/auth.test.js", "v1\n");
    const f = S.createFeature(p, "Alpha", ["core"], "", undefined, "en");
    tasks(f, "- [ ] 1. One\n  - _Implements: src/auth.js_\n- [ ] 2. Two\n  - _Implements: src/auth.js_\n");
    approveTasks(p, "alpha");
    S.completeTask(p, "alpha", 1, { summary: "done" });
    const c1Deny = g(p, "test/auth.test.js");
    const line = (c1Deny.userNote || "").match(/feature unprotect (\S+) (\S+) --reason/) || [];
    const lift = S.manageFeature(p, "unprotect", line[1], line[2], { reason: "intended: login takes a user now" });
    w(p, "test/auth.test.js", "v2\n");
    S.completeTask(p, "alpha", 2, { summary: "done" });
    const fin1 = S.finishFeature(p, "alpha", {});
    const finished = () => { const at = new Date(Date.now() + 5).toISOString(); setState(f, { finished: { at, files: {} } }); return at; }; // a ready written finish's record
    const doc = () => (S.specDoctor(p, "alpha").checks || []).find((c) => c.id === "protected-tests");
    const d0 = doc(); // before the finish: no warn
    finished();
    const d1 = doc();
    const app = S.appendTasks(p, "alpha", [{ text: "Three", implements: ["src/auth.js"] }]); // a change request
    approveTasks(p, "alpha");
    const c2Allow = g(p, "test/auth.test.js");
    w(p, "test/auth.test.js", "v3\n");
    const fin2 = S.finishFeature(p, "alpha", {});
    const ended = S.manageFeature(p, "protect", "alpha", "test/auth.test.js", {}); // doctor's line
    const c2Deny = g(p, "test/auth.test.js"), d2 = doc();
    w(p, "test/auth.test.js", "v4: weakened\n"); // around the guard — a script, a git checkout
    const fin2b = S.finishFeature(p, "alpha", {});
    const acc = S.manageFeature(p, "protect", "alpha", "test/auth.test.js", { accept: true, reason: "v4 is the intended suite" });
    S.completeTask(p, "alpha", 3, { summary: "done" });
    const fin3 = S.finishFeature(p, "alpha", {});
    const f2 = finished();
    const fin4 = S.finishFeature(p, "alpha", {}); // 1.36.0 review 4 (R4-PT-3): a re-finish of the same cycle keeps the accept
    for (const until = Date.parse(f2) + 2; Date.now() <= until;) { /* the next accept strictly after cycle 2's finish */ }
    w(p, "test/auth.test.js", "v5\n");
    const acc2 = S.manageFeature(p, "protect", "alpha", "test/auth.test.js", { accept: true, reason: "v5 between cycles" }); // before the next approval
    const app3 = S.appendTasks(p, "alpha", [{ text: "Four", implements: ["src/auth.js"] }]); // a change request: cycle 3
    approveTasks(p, "alpha");
    const fin5 = S.finishFeature(p, "alpha", {});
    const pt = (r) => r.protectedTests;
    const files = (xs) => (xs || []).map((x) => x.file).join();
    const warns = (r) => r.warnings.some((x) => /Protected tests of/.test(x));
    all("1.36 guard tests across cycles: cycle 1's lift is never ended by the finish — cycle 2's guard allows the edit and its finish names it lifted, doctor warns; protect <file> ends it, the guard refuses and a change around it is finish's warning; the accept re-baselines (explained, no warning), its record shown by every finish of its cycle (a re-finish too — 1.36.0 review 4) and dropped by the next cycle's, which shows an accept made between the two (got " +
      js({ c1: c1Deny.decision, line: line.slice(1), lift: lift.ok, fin1: pt(fin1), d0, d1, app: app.ok, c2Allow: c2Allow.decision, fin2: pt(fin2), ended: ended.unlifted, c2Deny: c2Deny.decision, d2, fin2b: pt(fin2b), acc: acc.ok, fin3: pt(fin3), fin4: pt(fin4), acc2: acc2.ok, app3: app3.ok, fin5: pt(fin5) }) + ")", {
      cycle1: () => c1Deny.decision === "deny" && line[1] === "alpha" && lift.ok && files(pt(fin1).lifted) === "test/auth.test.js" && !warns(fin1),
      doctor: () => d0 === undefined && d1 && d1.status === "warn" && d1.detail === M().doctorLiftAfterFinish("alpha", "test/auth.test.js", "test/auth.test.js"),
      cycle2: () => app.ok && c2Allow.decision === "allow" && files(pt(fin2).lifted) === "test/auth.test.js" && !pt(fin2).unexplained.length && !warns(fin2),
      ended: () => ended.unlifted === "test/auth.test.js" && c2Deny.decision === "deny" && d2 === undefined,
      backstop: () => files(pt(fin2b).unexplained) === "test/auth.test.js" && !pt(fin2b).lifted.length && warns(fin2b),
      accepted: () => acc.ok && !acc.unlifted && !pt(fin3).unexplained.length && !pt(fin3).lifted.length && files(pt(fin3).accepted) === "test/auth.test.js" && !warns(fin3) &&
        fin3.mergeSummary.includes(M().summaryAccept("test/auth.test.js", acc.accepted.by, "v4 is the intended suite")),
      sameCycle: () => !pt(fin4).unexplained.length && files(pt(fin4).accepted) === "test/auth.test.js" && fin4.mergeSummary.includes(M().summaryAccept("test/auth.test.js", acc.accepted.by, "v4 is the intended suite")),
      once: () => acc2.ok && app3.ok && !pt(fin5).unexplained.length && js(pt(fin5).accepted.map((a) => a.reason)) === js(["v5 between cycles"]) &&
        !fin5.mergeSummary.includes(M().summaryAccept("test/auth.test.js", acc.accepted.by, "v4 is the intended suite")),
    });
  }

  { // 1.36.0 review 3: accepting a protected test's content (spec_feature {action: "protect", file, accept: true, reason}) — a test file
    // inside the project and a reason (the stable codes, the accept's own words); the dry run writes nothing; with them the hash now is the
    // recorded one (the listed spelling), a lift in force ends (a revoked record before the accept record), the accept record is no lift;
    // the listing shows it; a test not on the list joins it
    const p = project("accept", { approvalGuard: "off" });
    w(p, "src/x.js", "x\n"); w(p, "test/a.test.js", "a\n");
    const f = S.createFeature(p, "Acc", ["core"], "", undefined, "en");
    tasks(f, "- [ ] 1. A\n  - _Implements: src/x.js_\n");
    approveTasks(p, "acc");
    const h0 = listOf(f).files["test/a.test.js"];
    const noFile = await tool("spec_feature", { action: "protect", name: "acc", accept: true, reason: "r", projectDir: p });
    const noReason = await tool("spec_feature", { action: "protect", name: "acc", file: "test/a.test.js", accept: true, projectDir: p });
    const notTest = await tool("spec_feature", { action: "protect", name: "acc", file: "src/x.js", accept: true, reason: "r", projectDir: p });
    const outside = await tool("spec_feature", { action: "protect", name: "acc", file: "../elsewhere.test.js", accept: true, reason: "r", projectDir: p });
    const beforeDry = js(listOf(f));
    const dry = S.manageFeature(p, "protect", "acc", "test/a.test.js", { accept: true, reason: "r", dryRun: true });
    const afterDry = js(listOf(f));
    S.manageFeature(p, "unprotect", "acc", "test/a.test.js", { reason: "being rewritten" });
    w(p, "test/a.test.js", "a, rewritten\n");
    const acc = await tool("spec_feature", { action: "protect", name: "acc", file: "test/a.test.js", accept: true, reason: "the rewrite is right", projectDir: p });
    const lst = listOf(f);
    const gAfter = g(p, "test/a.test.js");
    const fin = S.finishFeature(p, "acc", {});
    w(p, "test/n.test.js", "n\n"); // written after the snapshot: not on the list
    const accNew =S.manageFeature(p, "protect", "acc", "test/n.test.js", { accept: true, reason: "a new suite" });
    const listing = S.manageFeature(p, "protect", "acc", undefined, {});
    all("1.36 guard tests: accept refuses without a file (its own words), a reason (its own words), a test file or inside the project — stable codes; the dry run writes nothing; the accept re-baselines the test, ends its lift (revoked, then the accept record), the test is protected again and finish is explained by the hash; a test not listed joins the list; the listing marks the accept record (got " +
      js([noFile.code, noReason.code, notTest.code, outside.code, dry, acc.accepted, acc.unlifted, lst.lifts, gAfter.why, fin.protectedTests, accNew.protectedTests, listing.lifts]) + ")", {
      codes: () => js([noFile.code, noReason.code, notTest.code, outside.code]) === js(["file-required", "reason-required", "not-a-test", "outside-project"]) && [noFile, noReason, notTest, outside].every((r) => r.isError),
      messages: () => noFile.error === M().err.acceptFileRequired && noReason.error === M().err.acceptReasonRequired,
      dryRun: () => dry.ok && dry.dryRun === true && dry.accept === true && dry.file === "test/a.test.js" && dry.reason === "r" && afterDry === beforeDry && !/lifts/.test(afterDry),
      record: () => acc.ok && acc.accepted.file === "test/a.test.js" && acc.accepted.reason === "the rewrite is right" && acc.accepted.accepted === true && typeof acc.accepted.by === "string" && acc.note.includes(M().accepted("test/a.test.js", "acc")),
      rebaseline: () => typeof lst.files["test/a.test.js"] === "string" && lst.files["test/a.test.js"] !== h0,
      liftEnded: () => acc.unlifted === "test/a.test.js" && js(lst.lifts.map((l) => [l.revoked === true, l.accepted === true])) === js([[false, false], [true, false], [false, true]]),
      protectedAgain: () => gAfter.decision === "ask" && gAfter.why === "protected-test",
      explained: () => fin.protectedTests.unexplained.length === 0 && fin.protectedTests.lifted.length === 0,
      added: () => accNew.ok && accNew.protectedTests.added === 1 && typeof listOf(f).files["test/n.test.js"] === "string",
      listing: () => listing.lifts.filter((l) => l.accepted === true).length === 2 && listing.lifts.filter((l) => l.accepted === true).every((l) => l.active === undefined && typeof l.reason === "string"),
    });
  }

  { // 1.36.0 review 4 (R4-PT-1): a plain `feature protect` — no guard-down — never authorises new content. alpha's listed test is
    // weakened by a route the guard does not read; a protect of it in an existing feature in planning (beta), the walk of a new one
    // (zeta), a protect of it in another new one (omega) each record the hash alpha recorded, never the content now: alpha's finish
    // still names the change; a file no live feature lists joins with its hash now; only the accept explains the change
    const p = project("launder", { approvalGuard: "deny" });
    w(p, "src/auth.js", "a\n"); w(p, "test/auth.test.js", "auth: two assertions\n");
    const fBe = S.createFeature(p, "Beta", ["core"], "", undefined, "en"); // in planning: no list
    const fAl = S.createFeature(p, "Alpha", ["core"], "", undefined, "en");
    tasks(fAl, "- [ ] 1. Login rule\n  - _Implements: src/auth.js_\n  - _Verify: node --test test/auth.test.js_\n");
    approveTasks(p, "alpha");
    S.completeTask(p, "alpha", 1, { command: "node --test test/auth.test.js", exitCode: 0, summary: "1 passing" });
    const hAl = listOf(fAl).files["test/auth.test.js"];
    w(p, "test/auth.test.js", "auth: weakened\n"); // a script, a git checkout: finish is the backstop
    w(p, "test/new.test.js", "new\n"); // on no feature's list
    const named = () => (S.finishFeature(p, "alpha", {}).protectedTests.unexplained || []).map((x) => x.file + ":" + x.status).join();
    const w0 = named();
    const existing = S.manageFeature(p, "protect", "beta", "test/auth.test.js", {});
    const w1 = named();
    const fZe = S.createFeature(p, "Zeta", ["core"], "", undefined, "en");
    const walk = S.manageFeature(p, "protect", "zeta", undefined, {});
    const w2 = named();
    const fOm = S.createFeature(p, "Omega", ["core"], "", undefined, "en");
    const file = S.manageFeature(p, "protect", "omega", "test/auth.test.js", {});
    const w3 = named();
    const acc = S.manageFeature(p, "protect", "alpha", "test/auth.test.js", { accept: true, reason: "the weaker test is intended" });
    const w4 = named();
    const hNew = E.fileHash(path.join(p, "test", "new.test.js")).slice(0, 16);
    all("1.36.0 review 4 (R4-PT-1) guard tests: a plain feature protect of a test another feature lists — an existing feature in planning, the walk of a new one, a new one with the file — records the hash that feature recorded, never the content now: alpha's finish still names its weakened test; a test no feature lists joins with its hash now; the accept explains the change (got " +
      js({ w0, existing: existing.protectedTests, w1, walk: walk.protectedTests, w2, file: file.protectedTests, w3, w4, beta: listOf(fBe).files, zeta: listOf(fZe).files, omega: listOf(fOm).files, hAl, hNew }) + ")", {
      before: () => w0 === "test/auth.test.js:changed",
      existing: () => existing.ok && existing.protectedTests.added === 1 && listOf(fBe).files["test/auth.test.js"] === hAl && w1 === w0,
      walk: () => walk.ok && listOf(fZe).files["test/auth.test.js"] === hAl && w2 === w0,
      unlisted: () => listOf(fZe).files["test/new.test.js"] === hNew && typeof hNew === "string",
      file: () => file.ok && file.protectedTests.added === 1 && listOf(fOm).files["test/auth.test.js"] === hAl && w3 === w0,
      accept: () => acc.ok && w4 === "",
    });
  }

  { // 1.36.0 review 4 (R4-PT-1's class — a snapshot, a tick's run): a new feature's first tasks approval (zeta) snapshots alpha's weakened
    // test with the hash alpha recorded and a test no feature lists with its hash now; a tick whose _Verify:_ runs them (omega, approved
    // before the tests existed) lists them the same way — alpha's finish still names the change; a task's exact _Implements:_ still
    // re-baselines the test to its content now (the planned change)
    const p = project("snapshot-tick", { approvalGuard: "ask" });
    w(p, "src/a.js", "a\n");
    const fOm = S.createFeature(p, "Omega", ["core"], "", undefined, "en");
    tasks(fOm, "- [ ] 1. Runs the suites\n  - _Implements: src/a.js_\n  - _Verify: node --test test/auth.test.js test/fresh.test.js_\n- [ ] 2. Rewrites the auth test\n  - _Implements: test/auth.test.js_\n");
    approveTasks(p, "omega"); // no test yet: an empty snapshot
    w(p, "test/auth.test.js", "auth: two assertions\n");
    const fAl = S.createFeature(p, "Alpha", ["core"], "", undefined, "en");
    tasks(fAl, "- [ ] 1. A\n  - _Implements: src/a.js_\n");
    approveTasks(p, "alpha");
    const hAl = listOf(fAl).files["test/auth.test.js"];
    w(p, "test/auth.test.js", "auth: weakened\n"); w(p, "test/new.test.js", "new\n");
    const h = (rel) => E.fileHash(path.join(p, rel)).slice(0, 16);
    const named = () => (S.finishFeature(p, "alpha", {}).protectedTests.unexplained || []).map((x) => x.file + ":" + x.status).join();
    const n0 = named();
    const fZe = S.createFeature(p, "Zeta", ["core"], "", undefined, "en");
    tasks(fZe, "- [ ] 1. Z\n  - _Implements: src/a.js_\n");
    approveTasks(p, "zeta");
    const zeta = listOf(fZe).files, n1 = named();
    w(p, "test/fresh.test.js", "fresh\n");
    const t1 = S.completeTask(p, "omega", 1, { command: "node --test test/auth.test.js test/fresh.test.js", exitCode: 0, summary: "2 passing" });
    const omega1 = Object.assign({}, listOf(fOm).files), n2 = named();
    const t2 = S.completeTask(p, "omega", 2, { summary: "the auth test rewritten, as planned" });
    const omega2 = listOf(fOm).files, n3 = named();
    all("1.36.0 review 4 (R4-PT-1's class) guard tests: a first tasks approval's snapshot and a tick's _Verify:_ run list a test another feature lists with the hash it recorded — alpha's finish still names its weakened test; a test no feature lists joins with its hash now; a task's exact _Implements:_ still re-baselines to the content now (got " +
      js({ hAl, zeta, omega1, omega2, n: [n0, n1, n2, n3], t: [t1.ok, t2.ok] }) + ")", {
      before: () => n0 === "test/auth.test.js:changed",
      snapshot: () => zeta["test/auth.test.js"] === hAl && n1 === n0,
      snapshotUnlisted: () => zeta["test/new.test.js"] === h("test/new.test.js"),
      tick: () => t1.ok && omega1["test/auth.test.js"] === hAl && n2 === n0,
      tickUnlisted: () => omega1["test/fresh.test.js"] === h("test/fresh.test.js"),
      planned: () => t2.ok && omega2["test/auth.test.js"] === h("test/auth.test.js") && n3 === "",
    });
  }

  { // 1.36.0 review 4 (R4-PT-1, doctor's "end it"): every task of alpha ticked, beta's agent needs alpha's red test changed — the line
    // names beta (the first unlocker; its list lacks the file); the user lifts it there, beta finishes, doctor beta offers to end the
    // lift or accept; ENDING it (protect beta <file>) leaves the change named at alpha's finish — ending accepts nothing
    const p = project("end-is-not-accept", { approvalGuard: "deny" });
    w(p, "src/a.js", "1\n"); w(p, "src/b.js", "1\n");
    const fB = S.createFeature(p, "Beta", ["core"], "", undefined, "en");
    tasks(fB, "- [ ] 1. Beta one\n  - _Implements: src/b.js_\n- [ ] 2. Beta two\n  - _Implements: src/b.js_\n");
    approveTasks(p, "beta"); // its snapshot predates alpha's red test
    const fA = S.createFeature(p, "Alpha", ["core"], "", undefined, "en");
    tasks(fA, "- [ ] 1. Red test\n  - _Implements: test/login.test.js_\n- [ ] 2. Fix\n  - _Implements: src/a.js_\n");
    approveTasks(p, "alpha");
    w(p, "test/login.test.js", "login: two assertions\n");
    S.completeTask(p, "alpha", 1, { summary: "red" });
    S.completeTask(p, "alpha", 2, { summary: "green" });
    const d = g(p, "test/login.test.js");
    const line = (d.userNote || "").match(/feature unprotect (\S+) (\S+) --reason/) || [];
    const lift = S.manageFeature(p, "unprotect", line[1] || "beta", "test/login.test.js", { reason: "beta's login change" });
    w(p, "test/login.test.js", "login: one assertion\n"); // the edit made under the lift
    S.completeTask(p, "beta", 1, { summary: "done" });
    S.completeTask(p, "beta", 2, { summary: "done" });
    setState(fB, { finished: { at: new Date(Date.now() + 1000).toISOString(), files: {} } });
    const dBeta = (S.specDoctor(p, "beta").checks || []).find((c) => c.id === "protected-tests");
    const finLifted = S.finishFeature(p, "alpha", {}).protectedTests;
    const end = S.manageFeature(p, "protect", "beta", "test/login.test.js", {});
    const finEnded = S.finishFeature(p, "alpha", {}).protectedTests;
    all("1.36.0 review 4 (R4-PT-1) guard tests: ending a lift in a feature whose list lacked the test (doctor's \"end it\") records the hash the listing feature recorded — alpha's finish names the change made under the lift, no longer explained (got " +
      js({ d: [d.decision, line.slice(1)], lift: lift.ok, dBeta, finLifted, end: [end.ok, end.unlifted, end.protectedTests && end.protectedTests.added], finEnded }) + ")", {
      line: () => d.decision === "deny" && line[1] === "beta" && lift.ok,
      doctor: () => dBeta && dBeta.status === "warn" && dBeta.detail === M().doctorLiftAfterFinish("beta", "test/login.test.js", "test/login.test.js"),
      lifted: () => finLifted.lifted.map((x) => x.file).join() === "test/login.test.js" && !finLifted.unexplained.length,
      ended: () => end.ok && end.unlifted === "test/login.test.js" && end.protectedTests.added === 1 && listOf(fB).files["test/login.test.js"] === listOf(fA).files["test/login.test.js"] &&
        finEnded.unexplained.map((x) => x.file + ":" + x.status).join() === "test/login.test.js:changed" && !finEnded.lifted.length,
    });
  }

  { // 1.36.0 review 4 (R4-PT-2): no open task anywhere — accounts (older, all ticked, never finished, first by name) and cart (its last
    // task ticked: the final review's fix round) both list the test; the line names cart, the holder listing it with the latest tick —
    // never accounts, nor zed (ticked later, its list lacks the test); cart's lift, after cart's finish, is named by doctor cart
    const p = project("window-line", { approvalGuard: "deny" });
    w(p, "src/a.js", "a\n"); w(p, "src/cart.js", "c\n"); w(p, "test/auth.test.js", "auth\n");
    const mk = (name, src) => {
      const f = S.createFeature(p, name, ["core"], "", undefined, "en");
      tasks(f, "- [ ] 1. " + name + "\n  - _Implements: " + src + "_\n");
      approveTasks(p, name.toLowerCase());
      S.completeTask(p, name.toLowerCase(), 1, { summary: "done" });
      return f;
    };
    const fAc = mk("Accounts", "src/a.js"), fCa = mk("Cart", "src/cart.js"), fZe = mk("Zed", "src/a.js");
    setState(fAc, { ticks: { 1: "2026-01-01T00:00:00.000Z" } });
    setState(fCa, { ticks: { 1: "2026-01-02T00:00:00.000Z" } });
    setState(fZe, { ticks: { 1: "2026-01-03T00:00:00.000Z" }, protectedTests: { at: "2026-01-01T00:00:00.000Z", via: "approval", files: { "test/other.test.js": null } } });
    const d = g(p, "test/auth.test.js");
    const liftIn = ((d.userNote || "").match(/feature unprotect (\S+) test\/auth\.test\.js/) || [])[1];
    const lift = S.manageFeature(p, "unprotect", liftIn || "accounts", "test/auth.test.js", { reason: "the review: the test asserted the old call" });
    setState(fCa, { finished: { at: new Date(Date.now() + 1000).toISOString(), files: {} } });
    const dCart = (S.specDoctor(p, "cart").checks || []).find((c) => c.id === "protected-tests");
    all("1.36.0 review 4 (R4-PT-2) guard tests: with no open task anywhere the lift line names the holder listing the test with the latest tick — cart, not accounts (first by name) nor zed (a later tick, its list lacks the test); cart's lift after cart's finish is named by doctor cart (got " +
      js({ d: [d.decision, d.why, liftIn], lift: lift.ok, dCart }) + ")", {
      namesCart: () => d.decision === "deny" && d.why === "protected-test" && liftIn === "cart",
      doctor: () => lift.ok && dCart && dCart.status === "warn" && dCart.detail === M().doctorLiftAfterFinish("cart", "test/auth.test.js", "test/auth.test.js"),
    });
  }

  { // 1.36.0 review 4 (R4-PT-5): protect <file> and the accept read an existing file by its real path, as the guard does — through a
    // junction they end the real file's lift and add no second key; a junction out of the project keeps the typed path
    const p = project("accept-junction", { approvalGuard: "ask" });
    const out = path.join(tmp, "pt-outside-tests");
    w(p, "src/x.js", "x\n"); w(p, "test/auth.test.js", "auth\n"); w(out, "x.test.js", "x\n");
    const f = S.createFeature(p, "Alpha", ["core"], "", undefined, "en");
    tasks(f, "- [ ] 1. A\n  - _Implements: src/x.js_\n");
    approveTasks(p, "alpha");
    fs.symlinkSync(path.join(p, "test"), path.join(p, "t2"), "junction");
    fs.symlinkSync(out, path.join(p, "t3"), "junction");
    const keys = () => Object.keys(listOf(f).files).sort().join();
    S.manageFeature(p, "unprotect", "alpha", "test/auth.test.js", { reason: "lift" });
    w(p, "test/auth.test.js", "auth, rewritten\n");
    const acc = S.manageFeature(p, "protect", "alpha", "t2/auth.test.js", { accept: true, reason: "via the junction" });
    const k1 = keys(), gAcc = g(p, "test/auth.test.js");
    S.manageFeature(p, "unprotect", "alpha", "test/auth.test.js", { reason: "lift again" });
    const end = S.manageFeature(p, "protect", "alpha", "t2/auth.test.js", {});
    const k2 = keys(), gEnd = g(p, "test/auth.test.js");
    const outside = S.manageFeature(p, "protect", "alpha", "t3/x.test.js", {});
    const k3 = keys();
    all("1.36.0 review 4 (R4-PT-5) guard tests: the accept and protect <file> through a junction (t2/ → test/) act on the real file — its lift ended, no second key, the guard asks again; a junction out of the project keeps the typed key (got " +
      js({ acc: [acc.ok, acc.unlifted, acc.accepted && acc.accepted.file], k1, gAcc: gAcc.why, end: [end.ok, end.unlifted], k2, gEnd: gEnd.why, outside: outside.ok, k3 }) + ")", {
      accept: () => acc.ok && acc.unlifted === "test/auth.test.js" && acc.accepted.file === "test/auth.test.js" && k1 === "test/auth.test.js" && gAcc.why === "protected-test",
      protect: () => end.ok && end.unlifted === "test/auth.test.js" && end.protectedTests.added === 0 && k2 === "test/auth.test.js" && gEnd.why === "protected-test",
      outside: () => outside.ok && k3 === "t3/x.test.js,test/auth.test.js",
    });
  }

  // 1.36.0 review 4 (cosmetic): doctor's lift-after-finish line with several files speaks of them in the plural
  eq(["en", "pt", "es"].map((l) => [M(l).doctorLiftAfterFinish("a", "x, y", null), M(l).doctorLiftAfterFinish("a", "x", "x")]).map(([many, one], i) =>
    [/the tests stay|os testes ficam|las pruebas quedan/.test(many), [/the test stays/, /o teste fica/, /la prueba queda/][i].test(one)]),
  [[true, true], [true, true], [true, true]], "1.36.0 review 4 guard tests: doctor's lift-after-finish line — several files in the plural, one in the singular (EN, PT, ES)");
};
