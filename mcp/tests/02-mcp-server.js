"use strict";
// MCP server — the protocol, argument validation, prompts and resources, CLI ↔ MCP parity.
// Framing, batches, errors, notifications, stdin close; each tool's inputSchema, prototype keys, JSON shapes; prompts
// (= commands/*.md) and specs:// resources; the surfaces' review regressions. Counts the handshake's assertions.

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

exports.handshake = true; // this file counts the handshake's assertions — every other process runs it muted
exports.run = async ({
  ok, rpc, payload, S, root, tmp, SERVER, approveBefore, abort, list, require, __dirname, __filename,
}) => {

  { // --- 1.13 WP3: robustness — MCP argument validation, prototype keys, JSON shapes, depend, evals, pre-commit ---
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    const errText = (res) => { try { return JSON.parse(res.result.content[0].text).error || ""; } catch { return res.result.content[0].text; } };
    const body = (res) => { try { return payload(res); } catch { return { ok: false, error: res.result.content[0].text }; } };
    const safe = (fn) => { try { return fn(); } catch (e) { return { ok: false, threw: true, error: "THREW: " + e.message }; } }; // a regression must FAIL, not crash the run
    const w3 = path.join(tmp, "proj-wp3");
    S.initProject(w3, ["tdd"], "en");
    const w3f = S.createFeature(w3, "Arg Check", ["core"]);
    const w3Tasks = path.join(w3f.dir, "tasks.md");
    fs.writeFileSync(w3Tasks, "- [ ] 1. a\n- [ ] 2. b\n");

    // 1. Argument types are checked against the advertised inputSchema before dispatch.
    const r19 = await call("spec_complete_task", { name: "arg-check", number: 1.9, projectDir: w3 });
    ok(r19.result.isError && /number must be an integer ≥ 0 \(got 1\.9\)/.test(errText(r19)) && S.nextTask(w3, "arg-check").next.number === 1,
      "MCP rejects number 1.9 (not an integer) instead of ticking task 1");
    const rObj = await call("spec_create", { name: { a: 1 }, projectDir: w3 });
    ok(rObj.result.isError && /name must be a string/.test(errText(rObj)) && !fs.existsSync(path.join(w3, ".specs", "object-object")),
      "MCP rejects an object name (no .specs/object-object/)");
    const rCap = await call("spec_scan", { cap: "abc", projectDir: w3 });
    const rCap0 = await call("spec_scan", { cap: 0, projectDir: w3 });
    ok(rCap.result.isError && /cap must be an integer/.test(errText(rCap)) && rCap0.result.isError && /≥ 1/.test(errText(rCap0)),
      "MCP rejects cap 'abc' and cap 0 (both scanned 0 files)");
    const rText = await call("ears_validate", { text: 123 });
    ok(rText.result.isError && /text must be a string/.test(errText(rText)) && !/trim/.test(errText(rText)), "MCP rejects a numeric text (no 'text.trim is not a function')");
    const rDepStr = await call("spec_depend", { name: "arg-check", dependsOn: "steering", projectDir: w3 });
    ok(rDepStr.result.isError && /dependsOn must be an array/.test(errText(rDepStr)), "MCP rejects dependsOn given as a string");
    const rEnum = await call("spec_create", { name: "Enum Check", tracks: ["tdd", "quantum"], projectDir: w3 });
    // tracks carry no schema enum (the engine splits "tdd,saas" and answers with a did-you-mean), but the bad item is still named
    ok(rEnum.result.isError && /'quantum'/.test(errText(rEnum)) && /core, tdd, saas, ai/.test(errText(rEnum)) && !fs.existsSync(path.join(w3, ".specs", "enum-check")),
      "an unknown track item is rejected and named (nothing scaffolded)");
    // String enums the engine folds are case-insensitive on MCP too (the CLI and the 1.12 MCP took 'Design' / 'PT'):
    // phase, lang, kind, action. spec_import's tool stays exact on both surfaces; a value that folds to nothing is refused as given.
    const rPhase = body(await call("spec_approve", { name: "arg-check", phase: " Design ", force: true, projectDir: w3 }));
    const rLang = body(await call("spec_create", { name: "Case Lang", lang: "PT", projectDir: w3 }));
    const rKind = body(await call("spec_create", { name: "Case Kind", kind: "Bugfix", projectDir: w3 }));
    const rBl = body(await call("spec_backlog", { action: "ADD", name: "Later thing", projectDir: w3 }));
    const rBlList = body(await call("spec_backlog", { action: "LIST", projectDir: w3 }));
    const rFeat = await call("spec_feature", { action: "Remove", name: "case-lang", projectDir: w3 });
    const rImp = await call("spec_impact", { name: "arg-check", phase: "DESIGN", projectDir: w3 });
    const rTool = await call("spec_import", { tool: "Kiro", path: ".kiro/specs/x", projectDir: w3 });
    const rBadPh = await call("spec_approve", { name: "arg-check", phase: "Desing", projectDir: w3 });
    ok(rPhase.ok && rPhase.approved === "design" && rLang.ok && rLang.lang === "pt" && rKind.ok && rKind.kind === "bugfix" &&
      rBl.ok && rBl.backlog.some((b) => b.name === "Later thing") && rBlList.ok && rBlList.backlog.length === 1 &&
      body(rFeat).needsConfirm === true && !/one of/.test(errText(rFeat)) && !/one of/.test(errText(rImp)) &&
      rTool.result.isError && /tool must be one of: kiro, spec-kit, openspec, plan, execplan, bmad, fluidplan \(got "Kiro"\)/.test(errText(rTool)) && // 1.14 C3: + plan · execplan · bmad; 1.17 F: + fluidplan
      rBadPh.result.isError && /phase must be one of: .* \(got "Desing"\)/.test(errText(rBadPh)),
      "MCP enums are case-insensitive where the engine folds them (phase ' Design ', lang 'PT', kind 'Bugfix', backlog 'ADD'/'LIST', feature 'Remove', impact 'DESIGN'); spec_import's tool stays exact; a typo is still refused as given");
    const rNested =await call("spec_complete_task", { name: "arg-check", number: 2, evidence: { command: "npm test", exitCode: "0" }, projectDir: w3 });
    ok(rNested.result.isError && /evidence\.exitCode must be an integer/.test(errText(rNested)) && /- \[ \] 2\./.test(fs.readFileSync(w3Tasks, "utf8")),
      "nested object properties are validated (evidence.exitCode)");
    const rExtra = await call("spec_list", { projectDir: w3, bogus: { deep: 1 } });
    // 1.24 r6 A1: an argument the schema doesn't list is refused (it was ignored — and a misspelt one changed what the call did)
    ok(rExtra.result.isError && body(rExtra).code === "unknown-argument" && /^Unknown argument for spec_list: bogus/.test(errText(rExtra)), "an unknown extra property is refused (unknown-argument)");
    const rArr = await call("spec_list", [w3]);
    ok(rArr.result.isError && /arguments must be a JSON object/.test(errText(rArr)), "non-object arguments are rejected");
    const w3pt = path.join(tmp, "proj-wp3-pt");
    S.initProject(w3pt, [], "pt");
    const rPt = await call("spec_create", { name: 5, projectDir: w3pt });
    ok(rPt.result.isError && /name tem de ser uma string/.test(errText(rPt)), "argument errors are localized (PT project)");
    const rPtMiss = await call("spec_create", { projectDir: w3pt });
    ok(rPtMiss.result.isError && /Argumento\(s\) obrigatório\(s\) em falta: name/.test(errText(rPtMiss)), "the missing-argument error is localized too (PT project)");
    fs.writeFileSync(w3Tasks, "- [ ] 1. a\n- [ ] 2. b\n");
    const rBig = await call("spec_complete_task", { name: "arg-check", number: 1e21, projectDir: w3 });
    const rBigBrief = await call("spec_task_brief", { name: "arg-check", number: 2e300, projectDir: w3 });
    ok(rBig.result.isError && /number must be an integer/.test(errText(rBig)) && /- \[ \] 1\./.test(fs.readFileSync(w3Tasks, "utf8")) &&
      rBigBrief.result.isError && /number must be an integer/.test(errText(rBigBrief)),
      "MCP rejects number 1e21 / 2e300 (parseInt('1e+21') is 1 — task 1 stays open, no brief for the wrong task)");
    // 1.22 review: a task number is an integer ≥ 0 — the schemas say so (minimum: 0, enforced by the validator): -1 read "number
    // must be an integer". Not ≥ 1: a hand-written "0." task is read and served by next, so refusing 0 would loop next → complete.
    // The engine refuses the CLI's raw word (done / undone / brief) in the same words.
    const numMin = ["spec_task_brief", "spec_complete_task"].map((n) => ((list.result.tools.find((t) => t.name === n) || {}).inputSchema.properties.number || {}).minimum);
    const tasksBefore22 = fs.readFileSync(w3Tasks, "utf8");
    const rNeg22 = await call("spec_task_brief", { name: "arg-check", number: -1, projectDir: w3 });
    const rNegTick22 = await call("spec_complete_task", { name: "arg-check", number: -1, evidence: { command: "x", exitCode: 0 }, projectDir: w3 });
    const rZero22 = await call("spec_complete_task", { name: "arg-check", number: 0, evidence: { command: "x", exitCode: 0 }, projectDir: w3 });
    const eng22 = [safe(() => S.completeTask(w3, "arg-check", "-1")), safe(() => S.taskBrief(w3, "arg-check", "-1")), safe(() => S.completeTask(w3, "arg-check", -2, undefined, { undo: true })),
      safe(() => S.taskBrief(w3, "arg-check", "1.9"))];
    const w0 = path.join(tmp, "task-zero");
    S.initProject(w0, ["core"], "en");
    const f0 = S.createFeature(w0, "Zero", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f0.dir, "tasks.md"), "- [ ] 0. [US1] Zeroth\n- [ ] 1. [US1] First\n");
    const next0 = S.nextTask(w0, f0.slug), tick0 = await call("spec_complete_task", { name: f0.slug, number: 0, evidence: { summary: "done" }, projectDir: w0 }), next1 = S.nextTask(w0, f0.slug);
    ok(numMin.every((m) => m === 0) && [rNeg22, rNegTick22].every((r) => r.result.isError && /number must be an integer ≥ 0 \(got -1\)/.test(errText(r))) &&
      !/must be an integer/.test(errText(rZero22) || JSON.stringify(rZero22.result)) &&
      eng22.every((r, i) => r.ok === false && new RegExp("^Invalid argument\\(s\\): number must be an integer ≥ 0 \\(got " + ['"-1"', '"-1"', "-2", '"1.9"'][i] + "\\)$").test(r.error)) &&
      fs.readFileSync(w3Tasks, "utf8") === tasksBefore22 &&
      next0.next && next0.next.number === 0 && !tick0.result.isError && next1.next && next1.next.number === 1,
      "1.22 review: spec_task_brief / spec_complete_task {number} are integers ≥ 0 (schema minimum, enforced): -1 is refused as such, the engine refuses '-1' / -2 / '1.9' from the CLI in the validator's words, nothing ticked; a hand-written task 0 that next serves can be ticked (no next → complete loop) (got " +
      JSON.stringify([numMin, errText(rNeg22), errText(rZero22), eng22.map((r) => r.error), next0.next, next1.next]) + ")");

    // 2. User-controlled keys never index Object.prototype.
    const protoRes = [];
    for (const k of ["constructor", "__proto__", "toString", "hasOwnProperty"]) protoRes.push(await call("steering_scaffold", { file: k, projectDir: w3 }));
    ok(protoRes.every((r) => r.result.isError && /Unknown steering file/.test(errText(r)) && !/^ERROR|ERR_INVALID_ARG_TYPE/.test(r.result.content[0].text)),
      "steering_scaffold {file: constructor|__proto__|toString|hasOwnProperty} → the unknown-file error, not a TypeError");
    const ctorDir = path.join(tmp, "proj-wp3-ctor");
    S.createFeature(ctorDir, "constructor", ["core"]);
    S.createFeature(ctorDir, "other", ["core"]);
    const ctorDep = safe(() => S.setDependency(ctorDir, "constructor", ["other"]));
    const ctorJson = safe(() => JSON.parse(fs.readFileSync(path.join(ctorDir, ".specs", "roadmap.json"), "utf8")));
    ok(ctorDep.ok && ctorJson.features && Object.prototype.hasOwnProperty.call(ctorJson.features, "constructor") && ctorJson.features.constructor.dependsOn[0] === "other" &&
      Object.dependsOn === undefined && ({}).dependsOn === undefined,
      "a feature slugged 'constructor' is a plain roadmap key (no Object.prototype pollution, not lost on write)");
    const ctorCycle = safe(() => S.setDependency(ctorDir, "other", ["constructor"]));
    const ctorView = safe(() => S.roadmap(ctorDir));
    ok(/Circular/.test(ctorCycle.error || "") && ctorView.ok && ctorView.features.find((x) => x.name === "constructor").dependsOn[0] === "other",
      "the cycle check and the roadmap see the 'constructor' feature's deps");
    const ghostDir = path.join(tmp, "proj-wp3-ghost");
    S.createFeature(ghostDir, "a", ["core"]);
    fs.writeFileSync(path.join(ghostDir, ".specs", "roadmap.json"), JSON.stringify({ features: { a: { dependsOn: ["constructor"] } } }));
    let ghost = null;
    try { ghost = S.roadmap(ghostDir); } catch { /* crashed in findCycle */ }
    ok(ghost && ghost.features[0].unmetDeps.includes("constructor"), "a dep named 'constructor' that is not a feature is unmet — no crash in the cycle check");

    // 3. Valid JSON with the wrong shape is refused like unparseable JSON — before any destructive step.
    const shp = path.join(tmp, "proj-wp3-shape");
    S.createFeature(shp, "a", ["core"]);
    const shpRm = path.join(shp, ".specs", "roadmap.json");
    const badShape = JSON.stringify({ features: { b: null } });
    fs.writeFileSync(shpRm, badShape);
    const rmA = body(await call("spec_feature", { action: "remove", name: "a", projectDir: shp }));
    ok(rmA.ok === false && /unexpected shape/.test(rmA.error) && /features\.b/.test(rmA.error) && fs.existsSync(path.join(shp, ".specs", "a")) && fs.readFileSync(shpRm, "utf8") === badShape,
      "roadmap.json {features:{b:null}} → remove refuses BEFORE deleting the folder; the file is untouched");
    const shapes = [
      [{ features: { a: { dependsOn: "b" } } }, /features\.a\.dependsOn/],
      [{ features: { a: { dependsOn: ["b", 3] } } }, /features\.a\.dependsOn/],
      [{ features: [] }, /'features'/],
      [{ backlog: {} }, /'backlog'/],
      [{ backlog: [{ note: "x" }] }, /'backlog' entry/],
      [{ meta: "pt" }, /'meta'/],
      [[], /top level/],
    ];
    ok(shapes.every(([data, re]) => {
      fs.writeFileSync(shpRm, JSON.stringify(data));
      const before = fs.readFileSync(shpRm, "utf8");
      const results = [() => S.backlog(shp, "add", "X"), () => S.backlog(shp, "rm", "X"), () => S.setDependency(shp, "a", []), () => S.manageFeature(shp, "archive", "a"),
        () => S.initProject(shp, [], "es"), () => S.writeRoadmapMd(shp, "es"), () => S.writeRoadmapHtml(shp, "es")].map(safe);
      return results.every((r) => r.ok === false && !r.threw && re.test(r.error)) && fs.readFileSync(shpRm, "utf8") === before && fs.existsSync(path.join(shp, ".specs", "a"));
    }), "wrong-shaped roadmap.json (dependsOn / features / backlog / meta / top level) → every mutator refuses, the file is untouched");
    // spec_roadmap must surface a refused write (it used to answer ok:true, wrote:[]) — the CLI exits 1 on it.
    const rmRefused = [];
    const shpMd = path.join(shp, ".specs", "ROADMAP.md");
    const mdOf = () => (fs.existsSync(shpMd) ? fs.readFileSync(shpMd, "utf8") : null);
    for (const [bad, re] of [[badShape, /unexpected shape/], ['{"features":{"a":{}},}', /not valid JSON/]]) {
      fs.writeFileSync(shpRm, bad);
      const mdBefore = mdOf();
      const res = await call("spec_roadmap", { write: true, html: true, lang: "pt", projectDir: shp });
      rmRefused.push(res.result.isError && re.test(errText(res)) && fs.readFileSync(shpRm, "utf8") === bad && mdOf() === mdBefore && !fs.existsSync(path.join(shp, ".specs", "ROADMAP.html")));
    }
    ok(rmRefused.every(Boolean), "spec_roadmap {write, lang} on a wrong-shaped / unparseable roadmap.json → isError with the refusal, nothing written");
    fs.unlinkSync(shpRm);
    fs.writeFileSync(shpMd, "# My own roadmap\n");
    const rmHand = await call("spec_roadmap", { write: true, projectDir: shp });
    ok(rmHand.result.isError && /not generated by dev-spec/.test(errText(rmHand)) && mdOf() === "# My own roadmap\n",
      "spec_roadmap write over a hand-written ROADMAP.md → isError (same as the CLI), the file is untouched");
    fs.unlinkSync(shpMd);
    fs.writeFileSync(path.join(shp, ".specs", "ROADMAP.html"), "<p>mine</p>");
    const rmHtml = body(await call("spec_roadmap", { write: true, html: true, projectDir: shp }));
    ok(rmHtml.ok && rmHtml.wrote.length === 1 && /ROADMAP\.md$/.test(rmHtml.wrote[0]) && /ROADMAP\.html exists and was not generated/.test((rmHtml.warnings || []).join()),
      "a hand-written ROADMAP.html is skipped visibly (warnings) while ROADMAP.md is still written");
    fs.unlinkSync(path.join(shp, ".specs", "ROADMAP.html"));
    fs.writeFileSync(shpRm, JSON.stringify({ meta: { lang: "pt" }, features: { a: { dependsOn: "b" } }, backlog: {} }));
    let shapeRead = null;
    try { shapeRead = S.roadmap(shp); } catch { /* crashed */ }
    const aRow = shapeRead && shapeRead.ok && shapeRead.features.find((x) => x.name === "a");
    ok(aRow && aRow.dependsOn.length === 0 && /estrutura inesperada/.test(safe(() => S.backlog(shp, "add", "X")).error || ""),
      "reads survive a wrong-shaped roadmap.json (sanitized) and the refusal stays in the project language (meta.lang pt)");
    const stp = path.join(tmp, "proj-wp3-state");
    const stF = S.createFeature(stp, "a", ["core"]);
    const stShape = path.join(stF.dir, ".state.json");
    const badState = JSON.stringify({ lang: "pt", approvals: [] });
    fs.writeFileSync(stShape, badState);
    const apShape = body(await call("spec_approve", { name: "a", phase: "requirements", projectDir: stp }));
    ok(apShape.ok === false && /estrutura inesperada/.test(apShape.error) && /'approvals'/.test(apShape.error) && fs.readFileSync(stShape, "utf8") === badState && S.featureLang(stp, "a") === "pt",
      ".state.json with approvals:[] → approve refuses (in the feature's language), file untouched, lang still read");
    fs.writeFileSync(stShape, JSON.stringify({ lang: "en", evidence: "x", approvals: {} }));
    fs.writeFileSync(path.join(stF.dir, "tasks.md"), "- [ ] 1. a\n");
    const evShape = safe(() => S.completeTask(stp, "a", 1, { command: "npm test", exitCode: 0 }));
    ok(evShape.ok === false && /'evidence'/.test(evShape.error) && /- \[ \] 1\./.test(fs.readFileSync(path.join(stF.dir, "tasks.md"), "utf8")),
      ".state.json with evidence:\"x\" → recording evidence is refused and the task stays open");
    fs.writeFileSync(stShape, JSON.stringify({ tracks: "tdd" }));
    ok(/'tracks'/.test(S.readState(stp, "a").invalid || "") && S.approvePhase(stp, "a", "design").ok === false, ".state.json with tracks:\"tdd\" is flagged invalid too");

    // 4. spec_depend: existing features only; add/remove; {name} alone is a read; [] clears.
    const dp = path.join(tmp, "proj-wp3-dep");
    ["a", "b", "c"].forEach((n) => S.createFeature(dp, n, ["core"]));
    const dpRm = path.join(dp, ".specs", "roadmap.json");
    const unk = body(await call("spec_depend", { name: "a", dependsOn: ["b", "nope", "steering"], projectDir: dp }));
    ok(unk.ok === false && /not found: nope, steering/.test(unk.error) && !S.readRoadmap(dp).features.a, "spec_depend refuses unknown/reserved dependencies and lists them (nothing stored)");
    const dep = async (args) => body(await call("spec_depend", { name: "a", projectDir: dp, ...args }));
    const dA = await dep({ add: ["b"] });
    const dB = await dep({ add: ["c", "b"] });
    const dC = await dep({ remove: ["b"] });
    ok(dA.dependsOn.join() === "b" && dB.dependsOn.join() === "b,c" && dC.dependsOn.join() === "c", "spec_depend add/remove edit the list incrementally (deduplicated)");
    const beforeRead = fs.readFileSync(dpRm, "utf8");
    const dRead = await dep({});
    ok(dRead.ok && dRead.dependsOn.join() === "c" && fs.readFileSync(dpRm, "utf8") === beforeRead, "spec_depend {name} alone returns the deps and writes nothing");
    const dCyc = body(await call("spec_depend", { name: "c", add: ["a"], projectDir: dp }));
    ok(dCyc.ok === false && /Circular/.test(dCyc.error), "an incremental add is cycle-checked");
    const dClear = await dep({ dependsOn: [] });
    ok(dClear.ok && dClear.dependsOn.length === 0 && S.readRoadmap(dp).features.a.dependsOn.length === 0, "dependsOn: [] clears the list explicitly");
    fs.writeFileSync(dpRm, JSON.stringify({ features: { a: { dependsOn: ["gone", "b"] } } }));
    const dStale = await dep({ remove: ["gone"] });
    ok(dStale.ok && dStale.dependsOn.join() === "b", "a stale dependency (feature deleted by hand) can still be removed");
    ok(/order must be an integer/.test(safe(() => S.setDependency(dp, "a", undefined, "abc")).error || ""), "a non-integer order is refused by the engine (same as MCP's integer check)");
    // 1.22 review: an order past Number.MAX_SAFE_INTEGER — MCP's integer is a SAFE integer; the CLI's word "99999999999999999999"
    // matched the digits and was stored as 1e20. Refused on both surfaces, in the same words; a safe one (negative too) is stored.
    const ordBefore = fs.readFileSync(dpRm, "utf8");
    const oMcp = await call("spec_depend", { name: "a", order: 1e20, projectDir: dp });
    const oEng = [safe(() => S.setDependency(dp, "a", undefined, "99999999999999999999")), safe(() => S.setDependency(dp, "a", undefined, 1e20)),
      safe(() => S.setDependency(dp, "a", undefined, "9007199254740992"))];
    const ordAfter = fs.readFileSync(dpRm, "utf8");
    const oSafe = [safe(() => S.setDependency(dp, "a", undefined, "9007199254740991")).order, safe(() => S.setDependency(dp, "a", undefined, "-3")).order];
    ok(oMcp.result.isError && /^Invalid argument\(s\): order must be an integer \(got 100000000000000000000\)$/.test(errText(oMcp)) &&
      oEng.every((r) => r.ok === false && /^Invalid argument\(s\): order must be an integer \(got "?(?:99999999999999999999|100000000000000000000|9007199254740992)"?\)$/.test(r.error)) &&
      ordAfter === ordBefore && oSafe[0] === 9007199254740991 && oSafe[1] === -3 && S.readRoadmap(dp).features.a.order === -3,
      "1.22 review: spec_depend / depend refuse an unsafe order (1e20, '99999999999999999999', 2^53) in the MCP validator's words, nothing written; a safe one (MAX_SAFE_INTEGER, -3) is stored (got " +
      JSON.stringify([errText(oMcp), oEng.map((r) => r.error), oSafe]) + ")");

    // 5. One default approver on both surfaces.
    const expectBy = process.env.USER || process.env.USERNAME || "user";
    const apBy = body(await call("spec_approve", { name: "b", phase: "requirements", force: true, projectDir: dp })); // a template: 1.13 gate
    ok(apBy.ok && apBy.approvals.requirements.by === expectBy, "MCP approve without `by` records $USER/$USERNAME (same default as the CLI), not a fixed 'user'");

    // 6. Eval harness: resolver (accents, legacy slugs), project-dir resolution, localized output.
    const EVALS = path.join(__dirname, "evals", "run-evals.js");
    const evp = path.join(tmp, "proj-wp3-evals");
    S.initProject(evp, ["ai"], "pt");
    const evF = S.createFeature(evp, "Análise Avançada", ["ai"]);
    const runEv = (args, env) => spawnSync(process.execPath, [EVALS, ...args], { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: "", SPEC_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: "", ...env } });
    const ev1 = runEv(["Análise Avançada", "--dry-run", "--project", evp]);
    ok(evF.slug === "analise-avancada" && ev1.status === 0 && /feature 'analise-avancada'/.test(ev1.stdout) && /correria/.test(ev1.stdout) && /Dry run concluído/.test(ev1.stdout),
      "run-evals --dry-run on a PT feature with an accented name resolves it and reports in PT");
    fs.renameSync(evF.dir, path.join(evp, ".specs", "an-lise-avan-ada")); // the pre-1.11 slug of the same name
    const ev2 = runEv(["Análise Avançada", "--dry-run"], { SPEC_PROJECT_DIR: evp, CLAUDE_PROJECT_DIR: "${CLAUDE_PROJECT_DIR}" });
    ok(ev2.status === 0 && /feature 'an-lise-avan-ada'/.test(ev2.stdout), "run-evals finds legacy slugs and honours SPEC_PROJECT_DIR (an unexpanded ${CLAUDE_PROJECT_DIR} is ignored)");
    const ev3 = runEv(["Inexistente", "--dry-run", "--project", evp]);
    ok(ev3.status === 2 && /não encontrada/.test(ev3.stderr), "run-evals on an unknown feature → localized error, exit 2");
    const evLive = runEv(["Análise Avançada", "--require-live", "--project", evp]);
    const evBase = runEv(["Análise Avançada", "--dry-run", "--set-baseline", "--project", evp]);
    ok(evLive.status === 2 && /--require-live/.test(evLive.stderr) && /recuso/.test(evLive.stderr) && evBase.status === 0 && !fs.existsSync(path.join(evp, ".specs", "an-lise-avan-ada", "evals", "baseline.json")),
      "--require-live without a key still exits 2 (localized); a dry run never writes a baseline");
    // Valid JSON of the wrong shape is an invalid set (exit 1, localized), not a harness crash (exit 2).
    const evDir = path.join(evp, ".specs", "an-lise-avan-ada", "evals");
    fs.writeFileSync(path.join(evDir, "adversarial.json"), "null");
    fs.writeFileSync(path.join(evDir, "golden.json"), JSON.stringify({ items: { a: 1 } }));
    const evSetShape = runEv(["Análise Avançada", "--dry-run", "--project", evp]);
    ok(evSetShape.status === 1 && /adversarial\.json — 'items' tem de ser um array/.test(evSetShape.stdout) && /golden\.json — 'items' tem de ser um array/.test(evSetShape.stdout) &&
      !/harness de evals|Cannot read/.test(evSetShape.stdout + evSetShape.stderr),
      "run-evals --dry-run on a null / {items:{…}} eval set → invalid set (exit 1, localized), no harness crash");
    // Malformed ITEMS are an invalid set too — dry run and live run alike, found before any model call (a fetch stub proves
    // the live run calls nothing); an unparseable / out-of-range thresholds.json is invalid, not ignored.
    fs.writeFileSync(path.join(evDir, "golden.json"), JSON.stringify({ items: [{ id: "g1", input: "Sum 2+2", expect: { type: "contains", value: "4" } }] }));
    fs.rmSync(path.join(evDir, "adversarial.json"));
    fs.writeFileSync(path.join(evDir, "regression.json"), JSON.stringify({ items: [
      { id: "r1", input: "x", expect: { type: "contain", value: "x" } }, { id: "r2", input: "x", expect: { type: "regex", value: "(pago" } },
      { input: "no id, no expect" }, { id: "r4", expect: { type: "equals", value: "x" } }, "not-an-object",
      { id: "r6", input: "x", expect: { type: "judge" } }, { id: "r7", input: "x", expect: { type: "contains" } },
      { id: "r8", input: "x", expect: { type: "refuse" } }] }));
    const stubEv = path.join(tmp, "stub-fetch-evals.js"), markEv = path.join(tmp, "fetch-called.txt");
    fs.writeFileSync(stubEv, "globalThis.fetch = async () => { require('fs').writeFileSync(process.env.FETCH_MARK, 'called'); throw new Error('offline'); };\n");
    const evBadDry = runEv(["Análise Avançada", "--dry-run", "--project", evp]);
    const evBadLive = spawnSync(process.execPath, ["-r", stubEv, EVALS, "Análise Avançada", "--project", evp],
      { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: "dummy", FETCH_MARK: markEv, SPEC_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: "" } });
    // V8 before Node 20 leaves the flags out of a RegExp SyntaxError ("/(pago/: Unterminated group"; Node 20+: "/(pago/i:")
    // — the engines floor is Node 18, so the expected line accepts both (the rest of the line stays exact).
    const itemLines = (out) => (out.match(/regression\.json — item [^\n]*/g) || []).join("\n").replace("Invalid regular expression: /(pago/: ", "Invalid regular expression: /(pago/i: ");
    ok(evBadDry.status === 1 && itemLines(evBadDry.stdout) === ["regression.json — item r1: tipo de avaliador desconhecido 'contain' (usa contains | equals | regex | refuse | judge)",
      "regression.json — item r2: a regex não compila: Invalid regular expression: /(pago/i: Unterminated group", "regression.json — item #3: sem 'id' (texto não vazio); sem objeto 'expect'",
      "regression.json — item r4: sem 'input' (texto não vazio)", "regression.json — item #5: não é um objeto", "regression.json — item r6: 'judge' precisa de uma 'rubric'",
      "regression.json — item r7: 'contains' precisa de um 'value'"].join("\n") && /golden: 1 item/.test(evBadDry.stdout) && /O dry run encontrou conjunto\(s\) de evals inválido\(s\)/.test(evBadDry.stdout) &&
      evBadLive.status === 1 && itemLines(evBadLive.stdout) === itemLines(evBadDry.stdout) && /nenhum modelo foi chamado/.test(evBadLive.stdout) && !fs.existsSync(markEv),
      "run-evals validates every item (object, id, input, a known grader, value / a compiling regex / rubric) — dry run exit 1 with one line per bad item; a live run refuses before any model call (localized, PT) (got " + JSON.stringify(itemLines(evBadDry.stdout)) + ")");
    fs.rmSync(path.join(evDir, "regression.json"));
    fs.writeFileSync(path.join(evDir, "thresholds.json"), "{ golden: 0.9");
    const evThr1 = runEv(["Análise Avançada", "--dry-run", "--project", evp]);
    fs.writeFileSync(path.join(evDir, "thresholds.json"), JSON.stringify({ golden: 1.5, note: "strict" }));
    const evThr2 = runEv(["Análise Avançada", "--dry-run", "--project", evp]);
    fs.writeFileSync(path.join(evDir, "thresholds.json"), JSON.stringify({ golden: 0.9, note: "strict" }));
    const evThr3 = runEv(["Análise Avançada", "--dry-run", "--project", evp]);
    ok(evThr1.status === 1 && /✗ thresholds\.json — /.test(evThr1.stdout) && evThr2.status === 1 && /thresholds\.json — tem de ser um objeto/.test(evThr2.stdout) &&
      evThr3.status === 0 && /Dry run concluído/.test(evThr3.stdout),
      "run-evals: an unparseable thresholds.json or a set threshold outside [0, 1] is invalid (exit 1, localized) — never silently ignored; a valid one (extra keys allowed) passes");
    // --max-items must be an integer ≥ 1 (a bare flag, "abc", 0 or -5 graded nothing and scored 0/0 = 100%: exit 0 and a 100%
    // baseline) — usage error, exit 2, before any model call; a set with no items is invalid (dry and live), never "passing".
    const liveEv = (args) => spawnSync(process.execPath, ["-r", stubEv, EVALS, "Análise Avançada", "--project", evp, ...args],
      { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: "dummy", FETCH_MARK: markEv, SPEC_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: "" } });
    const maxBad3 = [["--max-items"], ["--max-items=abc"], ["--max-items", "0"], ["--max-items=-5", "--set-baseline"]].map(liveEv);
    const maxOk3 = runEv(["Análise Avançada", "--dry-run", "--max-items", "1", "--project", evp]);
    fs.writeFileSync(path.join(evDir, "golden.json"), JSON.stringify({ items: [] }));
    fs.writeFileSync(path.join(evDir, "adversarial.json"), JSON.stringify({ set: "adversarial" }));
    const emptyDry3 = runEv(["Análise Avançada", "--dry-run", "--project", evp]);
    const emptyLive3 = liveEv(["--set-baseline"]);
    ok(maxBad3.every((r) => r.status === 2 && /Argumento\(s\) inválido\(s\): --max-items tem de ser um inteiro ≥ 1/.test(r.stderr) && !/100\.0%/.test(r.stdout)) && !fs.existsSync(markEv) &&
      !fs.existsSync(path.join(evDir, "baseline.json")) && maxOk3.status === 0 &&
      emptyDry3.status === 1 && /✗ golden\.json — sem itens para avaliar/.test(emptyDry3.stdout) && /✗ adversarial\.json — sem itens para avaliar/.test(emptyDry3.stdout) &&
      emptyLive3.status === 1 && /nenhum modelo foi chamado/.test(emptyLive3.stdout) && !/100\.0%|todos os conjuntos passam/.test(emptyLive3.stdout) && !fs.existsSync(path.join(evDir, "baseline.json")),
      "run-evals: a bare / non-numeric / zero / negative --max-items is a usage error (exit 2, localized) before any model call — no 0/0 = 100%, no baseline; an empty set is invalid dry and live (got " +
      JSON.stringify(maxBad3.map((r) => [r.status, r.stderr.trim().slice(0, 60)]).concat([[emptyDry3.status], [emptyLive3.status]])) + ")");
    // Switches follow the CLI's rule: --x=true|false (1/0, yes/no, on/off), anything else exit 2. They were read by
    // truthiness — "false" is truthy: --set-baseline=false overwrote baseline.json, --dry-run=false dry-ran,
    // --require-live=false refused to run. A fetch stub answers "4" so the live path runs offline.
    fs.writeFileSync(path.join(evDir, "golden.json"), JSON.stringify({ items: [{ id: "g1", input: "Sum 2+2", expect: { type: "contains", value: "4" } }] }));
    fs.rmSync(path.join(evDir, "adversarial.json"));
    const okStub = path.join(tmp, "stub-fetch-evals-ok.js"), okMark = path.join(tmp, "fetch-ok-called.txt");
    fs.writeFileSync(okStub, "globalThis.fetch = async () => { require('fs').appendFileSync(process.env.FETCH_MARK, 'x'); return { ok: true, json: async () => ({ content: [{ type: 'text', text: '4' }], usage: { input_tokens: 1, output_tokens: 1 } }) }; };\n");
    const baseF = path.join(evDir, "baseline.json");
    const okEv = (args, key = "dummy") => {
      try { fs.rmSync(okMark); } catch {}
      const r = spawnSync(process.execPath, ["-r", okStub, EVALS, "Análise Avançada", "--project", evp, ...args],
        { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: key, FETCH_MARK: okMark, SPEC_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: "" } });
      r.called = fs.existsSync(okMark);
      r.baseline = fs.existsSync(baseF);
      try { fs.rmSync(baseF); } catch {}
      return r;
    };
    const sbFalse = okEv(["--set-baseline=false"]), sbZero = okEv(["--set-baseline=0"]), sbYes = okEv(["--dry-run=false", "--set-baseline=yes"]);
    const drBad = okEv(["--dry-run=maybe"]), sbBad = okEv(["--set-baseline=later"]);
    const rlFalse = okEv(["--require-live=false"], ""), rlOn = okEv(["--require-live=on"], "");
    ok(sbFalse.status === 0 && sbFalse.called && !sbFalse.baseline && /REAL/.test(sbFalse.stdout) && sbZero.status === 0 && !sbZero.baseline &&
      sbYes.status === 0 && sbYes.called && sbYes.baseline && /REAL/.test(sbYes.stdout) &&
      drBad.status === 2 && /Argumento\(s\) inválido\(s\): --dry-run tem de ser um booleano \(true\/false\) \(recebido: "maybe"\)/.test(drBad.stderr) && !drBad.called &&
      sbBad.status === 2 && /--set-baseline tem de ser um booleano/.test(sbBad.stderr) && !sbBad.called && !sbBad.baseline &&
      rlFalse.status === 0 && /DRY-RUN/.test(rlFalse.stdout) && !rlFalse.called && rlOn.status === 2 && /--require-live/.test(rlOn.stderr),
      "run-evals switches: --set-baseline=false / =0 write no baseline, --dry-run=false with a key runs live, =yes writes it; --dry-run=maybe is a usage error (exit 2, localized) before any call; --require-live=false without a key dry-runs, =on refuses (got " +
      JSON.stringify([sbFalse, sbZero, sbYes, drBad, sbBad, rlFalse, rlOn].map((r) => [r.status, r.called, r.baseline])) + ")");
    // 1.22 review: the report is text only — --json is a usage error (exit 2, localized) before anything runs, with or without a
    // feature; it was accepted silently (the text report on stdout, exit 0). --json=false is the switch off, =maybe a bad switch.
    const evJson = [runEv(["Análise Avançada", "--dry-run", "--json", "--project", evp]), runEv(["--json", "--project", evp])];
    const evJsonBad = runEv(["Análise Avançada", "--dry-run", "--json=maybe", "--project", evp]);
    const evJsonOff = runEv(["Análise Avançada", "--dry-run", "--json=false", "--project", evp]);
    ok(evJson.every((r) => r.status === 2 && r.stdout === "" && /--json não está disponível para 'evals': só imprime texto/.test(r.stderr)) &&
      evJsonBad.status === 2 && /--json tem de ser um booleano/.test(evJsonBad.stderr) && evJsonOff.status === 0 && /Dry run concluído/.test(evJsonOff.stdout),
      "1.22 review: run-evals --json is a usage error (exit 2, localized, nothing on stdout) — the report is text; --json=false runs, --json=maybe is a bad switch (got " +
      JSON.stringify([...evJson, evJsonBad, evJsonOff].map((r) => [r.status, r.stderr.trim().slice(0, 70)])) + ")");

    // 7. Pre-commit: NUL-separated staged paths (accents/spaces) and named IDs.
    if (spawnSync("git", ["--version"], { encoding: "utf8" }).status !== 0) {
      console.log("  skip - git not available: pre-commit regression not run");
    } else {
      const repo = path.join(tmp, "proj-wp3-git");
      fs.mkdirSync(repo, { recursive: true });
      const git = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
      git("init", "-q");
      const pf = path.join(repo, "serviços e apps", ".specs", "autenticacao");
      fs.mkdirSync(pf, { recursive: true });
      fs.writeFileSync(path.join(pf, ".state.json"), JSON.stringify({ lang: "pt", approvals: {} }));
      fs.writeFileSync(path.join(pf, "requirements.md"), "## Critérios de Aceitação\n1. **US-1.AC-1** — QUANDO o utilizador entra, O SISTEMA DEVE mostrar o painel\n2. **US-1.AC-2** — QUANDO o utilizador sai, o painel é fechado\n");
      fs.writeFileSync(path.join(pf, "tasks.md"), "- [ ] 1. Painel\n  - _Requirements: US-1.AC-1, US-9.AC-9_\n");
      git("add", "-A");
      const pc = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "precommit-check.js")], { cwd: repo, encoding: "utf8" });
      ok(pc.status === 1 && /serviços e apps\/\.specs\/autenticacao\/requirements\.md: 1 erro\(s\) EARS/.test(pc.stdout),
        "pre-commit checks staged spec files under accented/space paths (the EARS error blocks the commit)");
      ok(/fantasma[^\n]*US-9\.AC-9/.test(pc.stdout) && /sem tarefa[^\n]*US-1\.AC-2/.test(pc.stdout), "pre-commit names the phantom and uncovered AC IDs (localized)");
      // An untouched template has no EARS errors but is not "clean": its warnings and placeholders are named (not blocking).
      const repo2 = path.join(tmp, "proj-wp3-git-template");
      S.initProject(repo2, ["core"], "en");
      const tf = S.createFeature(repo2, "Search", ["core"]);
      const git2 = (...a) => spawnSync("git", a, { cwd: repo2, encoding: "utf8" });
      const hook2 = () => spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "precommit-check.js")], { cwd: repo2, encoding: "utf8" });
      git2("init", "-q");
      git2("add", "-A");
      const pcT = hook2();
      fs.writeFileSync(path.join(tf.dir, "requirements.md"), "# Feature: Search\n\n## Summary\nFind invoices.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a user searches THE SYSTEM SHALL list the matching invoices\n");
      git2("add", "-A"); // tasks.md still cites the template ACs: its phantom refs block — this checks the requirements line only
      const pcC = hook2();
      ok(pcT.status === 0 && /⚠ \.specs\/search\/requirements\.md: no EARS errors \(5 criteria\), but 5 warning\(s\) and \d+ template placeholder\(s\) left — not blocking/.test(pcT.stdout) &&
        /L\d+ Criterion still holds template placeholder/.test(pcT.stdout) && !/EARS clean/.test(pcT.stdout) &&
        /✓ \.specs\/search\/requirements\.md: EARS clean \(1 criteria\)/.test(pcC.stdout) &&
        /sem erros EARS \(2 critérios\), mas 1 aviso\(s\) e 3 placeholder/.test(S.msg("pt").precommit.earsWarnings("x", 2, 1, 3)) && /pero 2 aviso\(s\) — no bloquea/.test(S.msg("es").precommit.earsWarnings("x", 1, 2, 0)),
        "pre-commit never says 'EARS clean' for a template: warnings + staged placeholders are named (exit 0); a real requirements.md is clean (EN/PT/ES)");
      // 1.22 review: the engine loads only once a staged spec file needs it — a commit staging none (a README, a design.md) exits 0
      // without it (it cost ~130 ms per commit). A preload records whether mcp/lib/spec.js was loaded when the hook exits.
      const probe = path.join(tmp, "precommit-probe.js"), probeOut = path.join(tmp, "precommit-probe.txt");
      fs.writeFileSync(probe, "process.on('exit', () => require('fs').writeFileSync(process.env.PROBE_OUT, Object.keys(require.cache).some((f) => f.split(require('path').sep).join('/').endsWith('/mcp/lib/spec.js')) ? 'engine' : 'none'));\n");
      const probed = (cwd) => {
        try { fs.rmSync(probeOut); } catch { /* none yet */ }
        const r = spawnSync(process.execPath, ["-r", probe, path.join(__dirname, "..", "hooks", "precommit-check.js")], { cwd, encoding: "utf8", env: { ...process.env, PROBE_OUT: probeOut } });
        let loaded = null;
        try { loaded = fs.readFileSync(probeOut, "utf8"); } catch { /* the probe never ran */ }
        return { code: r.status, out: r.stdout, loaded };
      };
      const repo3 = path.join(tmp, "proj-22-precommit-lazy");
      fs.mkdirSync(path.join(repo3, ".specs", "x"), { recursive: true });
      fs.writeFileSync(path.join(repo3, "README.md"), "# x\n");
      fs.writeFileSync(path.join(repo3, ".specs", "x", "design.md"), "# Design\n");
      spawnSync("git", ["init", "-q"], { cwd: repo3 });
      spawnSync("git", ["add", "-A"], { cwd: repo3 });
      const lazy = probed(repo3), needed = probed(repo2);
      ok(lazy.code === 0 && lazy.out === "" && lazy.loaded === "none" && needed.code === pcC.status && needed.loaded === "engine" && needed.out === pcC.stdout,
        "1.22 review: the pre-commit hook loads the engine only when a staged requirements.md / tasks.md / change.md needs it — none staged (README.md, a design.md): exit 0, nothing loaded; a staged spec file is checked as before (got " +
        JSON.stringify([lazy, needed.loaded, needed.code]) + ")");
    }

    // 8. No invisible code points in this file (the BOM test writes it as an escape).
    const suiteSrc = [__filename, path.join(root, "scripts", "test-runner.js"), ...fs.readdirSync(path.join(__dirname, "tests")).map((f) => path.join(__dirname, "tests", f))]; // the runner, the shared runner, every file of mcp/tests/
    ok(suiteSrc.length > 10 && !suiteSrc.some((f) => fs.readFileSync(f, "utf8").includes(String.fromCharCode(0xfeff))), "mcp/test.js carries no literal U+FEFF");
  }

  {
  // --- 1.13 WP4: CLI ↔ MCP parity, every trace gap listed, destructive ops confirmed, localized phases ---
  const hookJs = path.join(__dirname, "..", "hooks", "spec-hook.js");
  const w4 = path.join(tmp, "proj-wp4");
  S.initProject(w4, ["tdd"], "en");
  const w4f = S.createFeature(w4, "Gaps", ["tdd"]);
  fs.writeFileSync(path.join(w4f.dir, "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n2. **US-1.AC-2** — WHEN c THE SYSTEM SHALL d\n");
  fs.writeFileSync(path.join(w4f.dir, "test-plan.md"), "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-2 |\n");
  fs.writeFileSync(path.join(w4f.dir, "tasks.md"), "- [x] 1. a\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01, T-99_\n  - _Implements: src/nope.js_\n"); // ticked: 1.13 plannedImplFiles
  const w4kinds = S.traceGaps(S.traceCheck(w4, "gaps")).map((g) => g.kind).join(",");
  ok(w4kinds === "phantomTestsInTasks,testsNotMappedToTasks,missingImplFiles", "traceGaps lists every non-empty gap kind in a stable order (got " + w4kinds + ")");
  const w4doc = S.specDoctor(w4, "gaps").checks.find((c) => c.id === "traceability");
  ok(w4doc.status === "fail" && /unknown tests \(typos\?\): T-99/.test(w4doc.detail) && /T-02/.test(w4doc.detail) && /src\/nope\.js/.test(w4doc.detail) && !/=0/.test(w4doc.detail),
    "doctor's traceability detail names each failing kind with its IDs (no '=0' counters while failing)");
  const w4pt = S.createFeature(w4, "Lacunas", ["tdd"], undefined, undefined, "pt");
  ["requirements.md", "test-plan.md", "tasks.md"].forEach((x) => fs.copyFileSync(path.join(w4f.dir, x), path.join(w4pt.dir, x)));
  ok(/testes desconhecidos \(erros de escrita\?\): T-99/.test(S.specDoctor(w4, "lacunas").checks.find((c) => c.id === "traceability").detail),
    "doctor's traceability detail is localized (PT)");
  // The hook used to print "Traceability gaps in <f>:" and an empty "- " when the only gap was a missing file.
  fs.writeFileSync(path.join(w4f.dir, "tasks.md"), "- [x] 1. a\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01, T-02_\n  - _Implements: src/nope.js_\n"); // ticked: 1.13 plannedImplFiles
  const hkTr = spawnSync(process.execPath, [hookJs], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_input: { file_path: path.join(w4f.dir, "tasks.md") } }), encoding: "utf8" });
  const hkTrTxt = JSON.parse(hkTr.stdout).hookSpecificOutput.additionalContext;
  ok(/Traceability gaps in gaps/.test(hkTrTxt) && /_Implements:_ files that don't exist: src\/nope\.js/.test(hkTrTxt) && !/^\s*-\s*$/m.test(hkTrTxt),
    "PostToolUse trace message lists the gap it found (missing _Implements:_ file), never an empty '- '");
  const esW4 = path.join(tmp, "proj-wp4-es");
  S.initProject(esW4, [], "es");
  const esW4f = S.createFeature(esW4, "Pagos", ["core"]);
  fs.writeFileSync(path.join(esW4f.dir, "tasks.md"), "- [x] 1. a\n- [ ] 2. b\n");
  const hkEs = spawnSync(process.execPath, [hookJs], { input: JSON.stringify({ hook_event_name: "SessionStart" }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: esW4 } });
  ok(/en ejecución \(1\/2 tareas\)/.test(hkEs.stdout) && !/executing/.test(hkEs.stdout), "SessionStart phase names are localized (ES 'en ejecución')");

  // spec_roadmap: a failed write is an error with the reason (the CLI already exited 1), not wrote:[] + success.
  const handW4 = path.join(tmp, "proj-wp4-hand");
  S.createFeature(handW4, "Thing", ["core"]);
  fs.writeFileSync(path.join(handW4, ".specs", "ROADMAP.md"), "# Mine\n");
  const rmFail = await rpc("tools/call", { name: "spec_roadmap", arguments: { write: true, html: true, projectDir: handW4 } });
  const rmFailP = payload(rmFail);
  ok(rmFail.result.isError === true && rmFailP.ok === false && rmFailP.errors.length === 1 && /ROADMAP\.md/.test(rmFailP.error) &&
    rmFailP.wrote.length === 1 && /ROADMAP\.html$/.test(rmFailP.wrote[0]) && rmFailP.features.length === 1 && fs.readFileSync(path.join(handW4, ".specs", "ROADMAP.md"), "utf8") === "# Mine\n",
    "spec_roadmap: a hand-written ROADMAP.md is left alone AND reported (isError, errors, wrote lists only ROADMAP.html)");
  const rmToolDesc = list.result.tools.find((t) => t.name === "spec_roadmap").description;
  ok(/git-friendly/.test(rmToolDesc) && !/PR-friendly/.test(rmToolDesc), "spec_roadmap description says git-friendly (no PR wording)");

  // spec_backlog rm: an unknown name is an error, not a silent ok.
  const blMiss = await rpc("tools/call", { name: "spec_backlog", arguments: { action: "rm", name: "nope", projectDir: w4 } });
  S.backlog(w4, "add", "SSO");
  const ptProj = path.join(tmp, "proj-wp4-pt"); // this section's own PT project (the sections run in parallel, apart from main's)
  S.initProject(ptProj, [], "pt");
  ok(blMiss.result.isError === true && /not in the backlog/.test(payload(blMiss).error) && S.backlog(w4, "rm", "sso").ok === true && S.backlog(w4, "list").backlog.length === 0 &&
    /não está no backlog/.test(S.backlog(ptProj, "rm", "x").error), "backlog rm: unknown name → localized error (isError); a listed name (any case) is removed");

  // spec_feature remove needs confirm:true — without it nothing is deleted and the result says what would be.
  const fTool = list.result.tools.find((t) => t.name === "spec_feature");
  const noConf = await rpc("tools/call", { name: "spec_feature", arguments: { action: "remove", name: "gaps", projectDir: w4 } });
  const noConfP = payload(noConf);
  const falseConf = payload(await rpc("tools/call", { name: "spec_feature", arguments: { action: "remove", name: "gaps", confirm: false, projectDir: w4 } }));
  ok(fTool.inputSchema.properties.confirm.type === "boolean" && !fTool.inputSchema.required.includes("confirm") && noConf.result.isError === true &&
    noConfP.needsConfirm === true && noConfP.wouldDelete.files >= 4 && noConfP.wouldDelete.entries.includes("tasks.md") && /confirm: true/.test(noConfP.error) &&
    falseConf.needsConfirm === true && fs.existsSync(w4f.dir), "spec_feature remove without confirm:true deletes nothing and reports what it would delete");
  const yesConf = payload(await rpc("tools/call", { name: "spec_feature", arguments: { action: "remove", name: "gaps", confirm: true, projectDir: w4 } }));
  ok(yesConf.ok === true && !fs.existsSync(w4f.dir) && /Remover 'lacunas'/.test(S.manageFeature(w4, "remove", "lacunas").error),
    "spec_feature remove with confirm:true deletes; the confirmation message is in the feature's language (PT)");
  // The remove preview counts a symlink/junction as ONE entry (like fs.rmSync) — it used to follow it, counting
  // files outside the feature and recursing through a link loop.
  const lnkF = S.createFeature(w4, "Linky", ["core"]);
  const lnkOut = path.join(w4, "outside");
  fs.mkdirSync(lnkOut, { recursive: true });
  for (let i = 0; i < 30; i++) fs.writeFileSync(path.join(lnkOut, "f" + i + ".txt"), "x");
  let linked = true;
  try {
    fs.symlinkSync(lnkOut, path.join(lnkF.dir, "linked"), "junction"); // junction: no admin rights needed on Windows
    fs.symlinkSync(path.join(w4, ".specs"), path.join(lnkF.dir, "loop"), "junction");
  } catch { linked = false; }
  if (linked) {
    const realFiles = fs.readdirSync(lnkF.dir).length; // flat folder: every entry is a file or a link
    const lnkPrev = S.manageFeature(w4, "remove", "linky");
    const lnkDel = S.manageFeature(w4, "remove", "linky", undefined, { confirm: true });
    ok(lnkPrev.needsConfirm === true && lnkPrev.wouldDelete.files === realFiles && lnkDel.ok === true && !fs.existsSync(lnkF.dir) &&
      fs.readdirSync(lnkOut).length === 30 && fs.existsSync(path.join(w4, ".specs")),
      "remove preview does not follow symlinks/junctions (got " + lnkPrev.wouldDelete.files + " of " + realFiles + "); the delete leaves the link targets alone");
  } else ok(true, "remove preview vs symlinks: skipped (links not creatable here)");
  // With an unreadable roadmap.json the preview returns the same error the confirmed remove would — it used to
  // list what "would" be deleted and ask for confirm:true, then the confirmed call refused.
  const badRmDir = path.join(w4, "bad-roadmap");
  S.initProject(badRmDir, ["core"]);
  const badRmF = S.createFeature(badRmDir, "Delta", ["core"]);
  fs.writeFileSync(path.join(badRmDir, ".specs", "roadmap.json"), "{broken");
  const badPrev = S.manageFeature(badRmDir, "remove", "delta");
  const badConf = S.manageFeature(badRmDir, "remove", "delta", undefined, { confirm: true });
  const badPrevMcp = await rpc("tools/call", { name: "spec_feature", arguments: { action: "remove", name: "delta", projectDir: badRmDir } });
  ok(badPrev.ok === false && !badPrev.needsConfirm && !badPrev.wouldDelete && /roadmap\.json/.test(badPrev.error) && badPrev.error === badConf.error &&
    badPrevMcp.result.isError === true && !payload(badPrevMcp).needsConfirm && fs.existsSync(badRmF.dir),
    "remove preview with a broken roadmap.json returns the roadmap error (no needsConfirm), like the confirmed call");

  // spec_finish includeBody with write (the CLI's --include-body maps to it); classify reports its language.
  const finDir = path.join(tmp, "proj-wp4-finish"); // this section's own bugfix (the sections run in parallel, apart from main's)
  S.createFeature(finDir, "Login Loop", undefined, "users bounce back to /login", undefined, "en", "bugfix");
  const finBody = payload(await rpc("tools/call", { name: "spec_finish", arguments: { name: "login-loop", write: true, includeBody: true, projectDir: finDir } }));
  ok(finBody.wrote === true && /## Summary/.test(finBody.mergeSummary), "spec_finish write + includeBody returns the merge summary too");
  ok(S.classify("Webhook de faturação com resumo por um LLM").lang === "pt" && S.classify("x", { lang: "es" }).lang === "es",
    "classify returns the language its notes/reasoning are in");
  }

  { // 1.14 A1 — MCP prompts (one per commands/*.md) + resources (the project's spec artifacts as specs:// URIs)
    const PR = require("./lib/prompts-resources.js");
    const a1Stems = fs.readdirSync(path.join(root, "commands")).filter((f) => /\.md$/.test(f)).map((f) => f.slice(0, -3));
    const a1Fm = (stem) => PR.parseFrontMatter(fs.readFileSync(path.join(root, "commands", stem + ".md"), "utf8")).data;
    const posix = (p) => p.split(path.sep).join("/");
    // A private server per scenario (its own SPEC_PROJECT_DIR and env); every line it writes is kept, so a reply to a
    // notification would show up. String ids: the server must echo them as given.
    const a1Server = (projectDir, env) => {
      const kid = spawn(process.execPath, [SERVER], { env: { ...process.env, SPEC_MCP_PROMPTS: "", ...env, SPEC_PROJECT_DIR: projectDir }, stdio: ["pipe", "pipe", "inherit"] });
      const lines = [];
      const waiting = new Map();
      let b = "";
      let n = 0;
      kid.stdout.on("data", (d) => {
        b += d.toString();
        let nl;
        while ((nl = b.indexOf("\n")) >= 0) {
          const line = b.slice(0, nl).trim();
          b = b.slice(nl + 1);
          if (!line) continue;
          const m = JSON.parse(line);
          lines.push(m);
          if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
        }
      });
      const req = (method, params) => new Promise((resolve) => {
        const id = "a1-" + ++n;
        const t = setTimeout(() => abort("A1: no reply to " + method + " (" + id + ") within 15s"), 15000);
        waiting.set(id, (m) => { clearTimeout(t); resolve(m); });
        kid.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      });
      const note = (method, params) => kid.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
      const stop = () => new Promise((resolve) => { kid.on("exit", resolve); kid.stdin.end(); });
      return { req, note, lines, stop, sent: () => n };
    };

    // A project with 2 active features (a +tdd feature and a bugfix), steering (+ a custom file), SPECS.md, an archived
    // feature, a non-addressable folder, a non-allowlisted file in a feature and a file outside .specs/.
    const a1p = path.join(tmp, "proj-a1");
    S.initProject(a1p, ["tdd"], "en");
    const a1f = S.createFeature(a1p, "Auth Login", ["tdd"], "", undefined, "en");
    const a1b = S.createFeature(a1p, "Crash on save", ["core"], "", undefined, "en", "bugfix");
    S.scaffoldSteeringFile(a1p, "api-rules.md", "en");
    S.createFeature(a1p, "Old Thing", ["core"], "", undefined, "en");
    S.manageFeature(a1p, "archive", "Old Thing");
    S.catalog(a1p, { write: true });
    const a1s = path.join(a1p, ".specs");
    fs.writeFileSync(path.join(a1f.dir, "notes.md"), "private notes\n");
    fs.mkdirSync(path.join(a1s, "My Notes"), { recursive: true });
    fs.writeFileSync(path.join(a1s, "My Notes", "requirements.md"), "not a feature\n");
    fs.writeFileSync(path.join(a1p, "secret.md"), "TOP SECRET\n");
    const a1Expected = ["specs://roadmap", "specs://catalog"]
      .concat(fs.readdirSync(path.join(a1s, "steering")).filter((f) => /\.md$/.test(f)).sort().map((f) => "specs://steering/" + f))
      .concat([a1f, a1b].sort((x, y) => (x.slug < y.slug ? -1 : 1)).flatMap((f) => PR.RESOURCE_ARTIFACTS.filter((a) => fs.existsSync(path.join(f.dir, a))).map((a) => `specs://feature/${f.slug}/${a}`)));

    const s1 = a1Server(a1p);
    const i1 = await s1.req("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    const caps = (i1.result && i1.result.capabilities) || {};
    ok(JSON.stringify(caps.prompts) === '{"listChanged":false}' && JSON.stringify(caps.resources) === '{"listChanged":false,"subscribe":false}' &&
      JSON.stringify(caps.tools) === '{"listChanged":false}' && /Prompts: one per plugin command/.test(i1.result.instructions) &&
      /specs:\/\/feature\/\{slug\}\/\{artifact\}/.test(i1.result.instructions) && i1.id === "a1-1",
      "initialize advertises prompts {listChanged:false} and resources {listChanged:false, subscribe:false} beside tools; the instructions mention both; a string id is echoed");
    s1.note("notifications/initialized", {});

    // prompts/list — one per commands/*.md, read at runtime; description = front matter; one optional `args` argument.
    const pl = (await s1.req("prompts/list", {})).result.prompts;
    const plNames = pl.map((p) => p.name);
    ok(pl.length === a1Stems.length && a1Stems.length >= 44 && plNames.slice().sort().join() === a1Stems.slice().sort().join() &&
      plNames.indexOf("spec") < plNames.indexOf("spec-bugfix") && pl.every((p) => p.description && p.description === a1Fm(p.name).description) &&
      pl.every((p) => Object.keys(p).join() === "name,description,arguments" && p.arguments.length === 1 && p.arguments[0].name === "args" && p.arguments[0].required === false),
      "prompts/list: one prompt per commands/*.md (" + pl.length + "), sorted by name, each with its front-matter description and one optional `args` argument");
    const plArg = (n) => (pl.find((p) => p.name === n) || { arguments: [{}] }).arguments[0].description || "";
    ok(plArg("spec-impact") === "Arguments (optional): " + a1Fm("spec-impact")["argument-hint"] && /^No arguments needed/.test(plArg("coverage")) &&
      JSON.stringify(pl) === JSON.stringify(PR.listPrompts({ lang: "en" }).map((p) => ({ name: p.name, description: p.description, arguments: p.arguments }))),
      "prompts/list: the `args` description comes from argument-hint (an empty hint says no arguments are needed); same list as the module the CLI uses");

    // prompts/get — the body with $ARGUMENTS replaced, after one line for agents without the skill.
    const g1 = (await s1.req("prompts/get", { name: "spec-impact", arguments: { args: "login design $& $1" } })).result;
    const g1t = g1 && g1.messages[0].content.text;
    const rootPosix = posix(path.resolve(root));
    ok(g1 && g1.description === a1Fm("spec-impact").description && g1.messages.length === 1 && g1.messages[0].role === "user" && g1.messages[0].content.type === "text" &&
      /^Note for the agent: if no dev-spec-driven skill is available/.test(g1t) && g1t.includes(rootPosix + "/AGENTS.md") && g1t.includes(rootPosix + "/skills/dev-spec-driven/references/") &&
      g1t.includes("Args: login design $& $1\n") && !g1t.includes("$ARGUMENTS") && g1t.split("\n")[1] === "" && /spec_impact/.test(g1t),
      "prompts/get: {description, messages:[{role:user, content:{type:text}}]} — the preamble (AGENTS.md + references/ paths), then the body with $ARGUMENTS ← args ($& / $1 kept literally)");
    const g2 = (await s1.req("prompts/get", { name: "spec-impact" })).result;
    const g3 = (await s1.req("prompts/get", { name: "eval", arguments: {} })).result;
    const g3t = g3 && g3.messages[0].content.text;
    ok(g2 && g2.messages[0].content.text.includes("Args: \n") && !g2.messages[0].content.text.includes("$ARGUMENTS") &&
      g3t && !g3t.includes("${CLAUDE_PLUGIN_ROOT}") && g3t.includes(rootPosix + "/mcp/evals/run-evals.js"),
      "prompts/get: no arguments → $ARGUMENTS is empty; ${CLAUDE_PLUGIN_ROOT} resolves to this clone (other clients have no such variable)");
    const gBad = await Promise.all([
      s1.req("prompts/get", { name: "nope" }), s1.req("prompts/get", { name: "../README" }), s1.req("prompts/get", { name: "spec-impact.md" }),
      s1.req("prompts/get", {}), s1.req("prompts/get", { name: "spec", arguments: { args: 5 } }), s1.req("prompts/get", { name: "spec", arguments: ["x"] }),
      s1.req("prompts/get", { name: "spec", arguments: "x" }), s1.req("prompts/get", { name: "constructor" }),
    ]);
    ok(gBad.every((r) => r.error && r.error.code === -32602 && !r.result) && /^Unknown prompt 'nope' — one of: .*spec-impact/.test(gBad[0].error.message) &&
      /Unknown prompt '\.\.\/README'/.test(gBad[1].error.message) && /needs the prompt `name`/.test(gBad[3].error.message) &&
      [4, 5, 6].every((i) => /`arguments` must be an object of strings/.test(gBad[i].error.message)),
      "prompts/get: an unknown prompt (also '../README', 'spec-impact.md', 'constructor'), no name or non-string arguments → JSON-RPC -32602 with a clear message");

    // resources/list — ROADMAP.md, SPECS.md, steering, each active feature's allowlisted artifacts; nothing else.
    const rl = (await s1.req("resources/list", {})).result;
    const rlUris = rl.resources.map((r) => r.uri);
    ok(JSON.stringify(rlUris) === JSON.stringify(a1Expected) && rlUris.includes("specs://feature/auth-login/test-plan.md") &&
      rlUris.includes("specs://feature/crash-on-save/bug.md") && rlUris.includes("specs://steering/api-rules.md") && !rl._meta &&
      rl.resources.every((r) => r.mimeType === "text/markdown" && r.name && r.description && Object.keys(r).join() === "uri,name,description,mimeType"),
      "resources/list: roadmap, catalog, every steering file, then each active feature's existing artifacts — uri, name, description, text/markdown (" + rlUris.length + ")");
    ok(!rlUris.some((u) => /old-thing|notes\.md|state\.json|My Notes|my-notes|secret|_archive/.test(u)) &&
      (rl.resources.find((r) => r.uri === "specs://feature/auth-login/requirements.md") || {}).description === "Requirements (EARS) of feature 'auth-login' (.specs/auth-login/requirements.md).",
      "resources/list: no archived feature, non-addressable folder, non-allowlisted file or file outside .specs/; descriptions name the artifact and its path");
    const tl = (await s1.req("resources/templates/list", {})).result;
    ok(tl && tl.resourceTemplates.map((t) => t.uriTemplate).join() === "specs://feature/{slug}/{artifact},specs://steering/{file}" &&
      tl.resourceTemplates.every((t) => t.name && t.description && t.mimeType === "text/markdown") && /requirements\.md, design\.md/.test(tl.resourceTemplates[0].description),
      "resources/templates/list: specs://feature/{slug}/{artifact} (naming the allowed artifacts) and specs://steering/{file}");

    // resources/read — the file's text, for every listed URI.
    const reads = await Promise.all(a1Expected.map((u) => s1.req("resources/read", { uri: u })));
    const fileOf = (u) => u === "specs://roadmap" ? path.join(a1s, "ROADMAP.md") : u === "specs://catalog" ? path.join(a1s, "SPECS.md")
      : u.startsWith("specs://steering/") ? path.join(a1s, "steering", u.slice(17)) : path.join(a1s, ...u.slice(16).split("/"));
    ok(reads.every((r, i) => r.result && r.result.contents.length === 1 && r.result.contents[0].uri === a1Expected[i] && r.result.contents[0].mimeType === "text/markdown" &&
      r.result.contents[0].text === fs.readFileSync(fileOf(a1Expected[i]), "utf8")),
      "resources/read: every listed URI returns {contents:[{uri, mimeType, text}]} with the file's exact text");

    // Traversal / arbitrary files / unknown artifacts → -32602 (Invalid params) with data.uri; well-formed but absent → -32002.
    const badUris = ["specs://feature/../x", "specs://feature/%2e%2e/auth-login/requirements.md", "specs://feature/auth-login/../../secret.md", "specs:///etc/passwd",
      "specs://steering/../roadmap.json", "specs://steering/..%2Froadmap.json", "specs://steering/%2E%2E%5Csecret.md", "file:///etc/passwd", "/etc/passwd",
      path.join(a1s, "auth-login", "requirements.md"), "C:\\Windows\\win.ini", "specs://feature/C:/requirements.md", "specs://feature/auth-login/notes.md",
      "specs://feature/auth-login/.state.json", "specs://feature/auth-login/REQUIREMENTS.MD", "specs://feature/steering/requirements.md", "specs://feature/nul/requirements.md",
      "specs://feature/.../requirements.md", "specs://feature/auth-login/requirements.md?x=1", "specs://roadmap/extra", "specs://feature/auth-login", "specs://steering/a.txt",
      "specs://steering/nul.md", "specs://whatever", "specs://", "specs://feature//requirements.md", "specs://feature/auth-login/%ZZ"];
    const badR = await Promise.all(badUris.map((u) => s1.req("resources/read", { uri: u })));
    const wrong = badR.map((r, i) => [badUris[i], r]).filter(([u, r]) => !(r.error && r.error.code === -32602 && r.error.data && r.error.data.uri === u && !r.result));
    ok(!wrong.length && /^Invalid resource URI 'specs:\/\/feature\/\.\.\/x'/.test(badR[0].error.message) && /^Unknown artifact 'notes\.md' — one of: classification\.md/.test(badR[12].error.message) &&
      /reserved/i.test(badR[15].error.message) && /^Invalid steering file name 'a\.txt'/.test(badR[21].error.message) && !badR.some((r) => /TOP SECRET|\[extensions\]/.test(JSON.stringify(r))),
      "resources/read: traversal ('..', %2e%2e, %2F, %5C), absolute paths, other schemes, drive letters, unknown / non-allowlisted artifacts, reserved names → -32602 with data.uri (wrong: " + wrong.map(([u, r]) => u + "→" + JSON.stringify(r.error || r.result).slice(0, 80)).join(" | ") + ")");
    const missR = await Promise.all(["specs://feature/nope/requirements.md", "specs://feature/auth-login/eval-plan.md", "specs://feature/old-thing/requirements.md",
      "specs://steering/missing.md", "specs://steering/TECH.md"].map((u) => s1.req("resources/read", { uri: u })));
    ok(missR.every((r) => r.error && r.error.code === -32002 && /^Resource not found: specs:\/\//.test(r.error.message) && r.error.data && typeof r.error.data.uri === "string") &&
      /not found/.test(missR[0].error.message) && /archived/.test(missR[2].error.message),
      "resources/read: a well-formed URI naming nothing (unknown feature, absent artifact, archived feature — says so, missing / case-aliased steering file) → -32002 Resource not found");
    const noUri = await Promise.all([s1.req("resources/read", {}), s1.req("resources/read", { uri: 42 }), s1.req("resources/read")]);
    ok(noUri.every((r) => r.error && r.error.code === -32602 && /needs the resource `uri`/.test(r.error.message)), "resources/read without a string uri → -32602");

    // A notification never gets a reply (and never runs anything); the next request is answered normally.
    const before = s1.lines.length;
    s1.note("prompts/list", {});
    s1.note("prompts/get", { name: "nope" });
    s1.note("resources/read", { uri: "specs://feature/../x" });
    s1.note("resources/list");
    const ping = await s1.req("ping", {});
    ok(ping.result && s1.lines.length === before + 1 && s1.lines.length === s1.sent() && s1.lines.every((m) => typeof m.id === "string"),
      "prompts/* and resources/* notifications get no reply — only requests are answered (" + s1.lines.length + " lines for " + s1.sent() + " requests)");
    const unsub = await s1.req("resources/subscribe", { uri: "specs://roadmap" });
    ok(unsub.error && unsub.error.code === -32601, "resources/subscribe (subscribe: false) → Method not found");
    await s1.stop();

    // Module-level: the pages (1.23 — a hard cap of 500 until then), the roadmap fallback, a symlink out of .specs/, CRLF/BOM
    // front matter, PT.
    const capped = PR.listResources(a1p, { cap: 3 });
    const page2 = PR.listResources(a1p, { cap: 3, cursor: capped.nextCursor });
    const badCursors = ["x", "", 5, capped.nextCursor + "A", Buffer.from("o:-1").toString("base64url"), Buffer.from("o:3 ").toString("base64url")].map((c) => PR.listResources(a1p, { cap: 3, cursor: c }));
    ok(capped.ok && capped.resources.length === 3 && capped.total === a1Expected.length && typeof capped.nextCursor === "string" &&
      JSON.stringify(page2.resources.map((r) => r.uri)) === JSON.stringify(a1Expected.slice(3, 6)) && PR.listResources(a1p).nextCursor === undefined && PR.RESOURCE_PAGE === 500 &&
      badCursors.every((r) => r.ok === false && r.reason === "invalid" && /invalid cursor/.test(r.error)),
      "1.23: resources/list comes in pages — RESOURCE_PAGE (500), then nextCursor, the next page from it; a cursor it didn't hand out is refused (invalid)");
    const a1big = path.join(tmp, "proj-a1-big"); // 45 hand-made feature folders × 15 artifacts = 675 resources > one page (1.21 F5: + a change's change.md)
    for (let i = 1; i <= 45; i++) {
      const d = path.join(a1big, ".specs", "f" + String(i).padStart(2, "0"));
      fs.mkdirSync(d, { recursive: true });
      for (const a of PR.RESOURCE_ARTIFACTS) fs.writeFileSync(path.join(d, a), "# " + a + "\n");
    }
    const s4 = a1Server(a1big);
    await s4.req("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    const big = (await s4.req("resources/list", {})).result;
    const big2 = (await s4.req("resources/list", { cursor: big.nextCursor })).result || { resources: [] };
    const bigBad = await s4.req("resources/list", { cursor: "nope" });
    const bigLast = await s4.req("resources/read", { uri: "specs://feature/f45/retro.md" });
    await s4.stop();
    ok(big.resources.length === 500 && typeof big.nextCursor === "string" && !big._meta && big2.resources.length === 175 && !("nextCursor" in big2) &&
      new Set(big.resources.concat(big2.resources).map((r) => r.uri)).size === 675 && big2.resources[174].uri === "specs://feature/f45/change.md" &&
      bigBad.error && bigBad.error.code === -32602 && /^resources\/list: invalid cursor/.test(bigBad.error.message) && bigLast.result && bigLast.result.contents[0].text === "# retro.md\n",
      "1.23: resources/list past one page — 500 resources + nextCursor, then the other 175 (no nextCursor): every resource listed once; a cursor it didn't hand out → -32602 (got " +
      JSON.stringify([big.resources.length, big.nextCursor, big2.resources.length, bigBad.error]) + ")");
    const a1r = path.join(tmp, "proj-a1-roadmap");
    S.initProject(a1r, ["core"], "en");
    S.createFeature(a1r, "Only One", ["core"], "", undefined, "en");
    fs.unlinkSync(path.join(a1r, ".specs", "ROADMAP.md"));
    const fbList = PR.listResources(a1r).resources.find((r) => r.uri === "specs://roadmap") || {};
    const fbRead = PR.readResource(a1r, "specs://roadmap");
    ok(/rendered from \.specs\/roadmap\.json/.test(fbList.description || "") && fbRead.ok && /^# Roadmap — /.test(fbRead.contents[0].text) && /only-one/.test(fbRead.contents[0].text) &&
      !fs.existsSync(path.join(a1r, ".specs", "ROADMAP.md")) && !PR.listResources(a1r).resources.some((r) => r.uri === "specs://catalog"),
      "specs://roadmap without ROADMAP.md: rendered from roadmap.json in memory (nothing written); no SPECS.md → no catalog resource");
    const a1e = path.join(tmp, "proj-a1-empty");
    fs.mkdirSync(a1e, { recursive: true });
    ok(PR.listResources(a1e).resources.length === 0 && PR.readResource(a1e, "specs://roadmap").reason === "not-found" && PR.readResource(a1e, "specs://feature/x/tasks.md").reason === "not-found",
      "no .specs/ → an empty resource list; reads are not-found");
    let linked = false;
    try { fs.symlinkSync(path.join(a1p, "secret.md"), path.join(a1f.dir, "retro.md"), "file"); linked = true; } catch { /* no symlink privilege here */ }
    ok(!linked || (!PR.listResources(a1p).resources.some((r) => /retro\.md/.test(r.uri)) && PR.readResource(a1p, "specs://feature/auth-login/retro.md").reason === "not-found"),
      "a symlinked artifact pointing out of .specs/ is neither listed nor read" + (linked ? "" : " (symlinks not creatable here — checked by construction only)"));
    const outFeat = path.join(a1p, "outside-feature");
    fs.mkdirSync(outFeat, { recursive: true });
    fs.writeFileSync(path.join(outFeat, "requirements.md"), "OUTSIDE\n");
    let junction = false;
    try { fs.symlinkSync(outFeat, path.join(a1s, "linked-feat"), "junction"); junction = true; } catch { /* no link support here */ }
    ok(!junction || (!PR.listResources(a1p).resources.some((r) => /linked-feat/.test(r.uri)) && PR.readResource(a1p, "specs://feature/linked-feat/requirements.md").reason === "not-found"),
      "a feature folder linked (junction / symlink) to a folder outside .specs/ is neither listed nor read" + (junction ? "" : " (links not creatable here — checked by construction only)"));
    const fmDir = path.join(tmp, "proj-a1-cmds");
    fs.mkdirSync(fmDir, { recursive: true });
    fs.writeFileSync(path.join(fmDir, "crlf-cmd.md"), "\uFEFF---\r\ndescription: 'It''s a CRLF command'\r\nargument-hint: \"[x] [--y]\"\r\n---\r\n\r\nDo it: $ARGUMENTS\r\nThen $ARGUMENTS again.\r\n");
    fs.writeFileSync(path.join(fmDir, "no-fm.md"), "Just a body $ARGUMENTS\n");
    fs.writeFileSync(path.join(fmDir, "notes.txt"), "not a command\n");
    fs.mkdirSync(path.join(fmDir, "dir.md"));
    const fmList = PR.listPrompts({ commandsDir: fmDir, lang: "en" });
    const fmGet = PR.getPrompt("crlf-cmd", "a b", { commandsDir: fmDir, lang: "en" });
    ok(fmList.map((p) => p.name).join() === "crlf-cmd,no-fm" && fmList[0].description === "It's a CRLF command" && fmList[0].argumentHint === "[x] [--y]" &&
      fmList[1].description === "" && fmGet.ok && /\n\nDo it: a b\nThen a b again\.\n$/.test(fmGet.messages[0].content.text) && !fmGet.messages[0].content.text.includes("\r"),
      "front matter with a BOM, CRLF and quoted values is parsed; a file without front matter is still a prompt; only *.md files are prompts; the body comes back with LF");
    const a1pt = path.join(tmp, "proj-a1-pt");
    S.initProject(a1pt, ["core"], "pt");
    S.createFeature(a1pt, "Pagamentos", ["core"]);
    const s2 = a1Server(a1pt);
    await s2.req("initialize", { protocolVersion: "2024-11-05", capabilities: {} });
    const ptGet = (await s2.req("prompts/get", { name: "spec" })).result;
    const ptBad = await s2.req("resources/read", { uri: "specs://feature/../x" });
    const ptMiss = await s2.req("resources/read", { uri: "specs://feature/pagamentos/eval-plan.md" });
    const ptList = (await s2.req("resources/list", {})).result.resources;
    const ptArgs = (await s2.req("prompts/list", {})).result.prompts.find((p) => p.name === "coverage").arguments[0].description;
    await s2.stop();
    const deepKeys = (o, pre = "") => Object.keys(o).sort().flatMap((k) => (o[k] && typeof o[k] === "object" ? deepKeys(o[k], pre + k + ".") : [pre + k]));
    const a1Msg = ["en", "pt", "es"].map((l) => S.msg(l).promptsResources);
    ok(/^Nota para o agente: se não houver uma skill dev-spec-driven/.test(ptGet.messages[0].content.text) && /^URI de recurso inválido/.test(ptBad.error.message) &&
      /^Recurso não encontrado/.test(ptMiss.error.message) && ptList.some((r) => r.description === "Requisitos (EARS) da feature 'pagamentos' (.specs/pagamentos/requirements.md).") &&
      /^Não precisa de argumentos/.test(ptArgs) && deepKeys(a1Msg[1]).join() === deepKeys(a1Msg[0]).join() && deepKeys(a1Msg[2]).join() === deepKeys(a1Msg[0]).join() &&
      a1Msg.every((m) => Object.keys(m.res.labels).sort().join() === PR.RESOURCE_ARTIFACTS.slice().sort().join()) && /^Nota para el agente/.test(a1Msg[2].preamble("a", "b")),
      "prompts/resources messages follow the project language (PT preamble, errors, descriptions); EN/PT/ES blocks have the same keys and a label per artifact");

    // SPEC_MCP_PROMPTS=off (the Claude Code plugin's mcp/servers.json): no prompts capability — its own slash commands are these files.
    const s3 = a1Server(a1p, { SPEC_MCP_PROMPTS: "off" });
    const i3 = await s3.req("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    const p3 = await s3.req("prompts/list", {});
    const r3 = await s3.req("resources/list", {});
    await s3.stop();
    const servers = JSON.parse(fs.readFileSync(path.join(root, "mcp", "servers.json"), "utf8")).mcpServers["spec-driven"];
    ok(!("prompts" in i3.result.capabilities) && i3.result.capabilities.resources && !/Prompts:/.test(i3.result.instructions) && p3.error && p3.error.code === -32601 &&
      r3.result.resources.length === a1Expected.length && servers.env.SPEC_MCP_PROMPTS === "off",
      "SPEC_MCP_PROMPTS=off drops the prompts capability (prompts/* → -32601), resources stay; mcp/servers.json sets it for the Claude Code plugin (no duplicate slash commands)");
    const BOM = String.fromCharCode(0xfeff);
    ok(!fs.readFileSync(path.join(__dirname, "lib", "prompts-resources.js"), "utf8").includes(BOM) && !/require\((?!["'](?:fs|path|\.\/spec\.js)["'])/.test(fs.readFileSync(path.join(__dirname, "lib", "prompts-resources.js"), "utf8")),
      "lib/prompts-resources.js: zero dependencies (fs, path, ./spec.js) and no literal U+FEFF");
  }

  { // A4.1 — stdin closed: the server flushes the replies it already wrote before exiting. On Linux a pipe takes writes
    // asynchronously once its 64 KB buffer is full, and a bare process.exit() dropped the queued tail (a client that sends
    // its requests and closes stdin got 64 KB of ~390 KB). The reader here waits before reading, so the buffer fills.
    const kid = spawn(process.execPath, [SERVER], { env: { ...process.env, SPEC_PROJECT_DIR: tmp }, stdio: ["pipe", "pipe", "ignore"] });
    const closed = new Promise((resolve) => kid.on("close", (code) => resolve(code)));
    kid.stdout.pause();
    kid.stdin.end([1, 2, 3, 4, 5, 6, 7, 8].map((id) => JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list", params: {} })).join("\n") + "\n");
    await new Promise((resolve) => setTimeout(resolve, 400));
    let raw = "";
    kid.stdout.setEncoding("utf8");
    kid.stdout.on("data", (d) => (raw += d));
    kid.stdout.resume();
    const code = await Promise.race([closed, new Promise((resolve) => setTimeout(() => { kid.kill(); resolve("timeout"); }, 15000))]);
    let ids = [];
    try { ids = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l).id); } catch { /* a cut reply is not JSON */ }
    ok(code === 0 && ids.join() === "1,2,3,4,5,6,7,8",
      "the server answers every request sent before stdin closes, even to a reader that is slower than it (replies flushed before exit; got " + ids.length + " of 8 replies, " + raw.length + " chars, exit " + code + ")");
  }

  // 1.14 full review (S) — surfaces: MCP server, CLI, hooks.
  {
    // A private server fed RAW bytes; every reply line is kept as text (the raw form matters for S1) and parsed.
    const frsProj = path.join(tmp, "proj-frs");
    S.initProject(frsProj, ["core"], "en");
    const frsPt = path.join(tmp, "proj-frs-pt");
    S.initProject(frsPt, ["core"], "pt");
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const frsServer = () => {
      const kid = spawn(process.execPath, [SERVER], { env: { ...process.env, SPEC_PROJECT_DIR: frsProj }, stdio: ["pipe", "pipe", "inherit"] });
      const raw = [];
      let b = Buffer.alloc(0);
      kid.stdout.on("data", (d) => {
        b = Buffer.concat([b, d]);
        let nl;
        while ((nl = b.indexOf(0x0a)) >= 0) { raw.push(b.slice(0, nl).toString("utf8")); b = b.slice(nl + 1); }
      });
      const done = new Promise((resolve) => kid.on("exit", resolve));
      const timer = setTimeout(() => { try { kid.kill(); } catch {} }, 15000); // a hung server fails the assertions, never the suite
      const end = async () => { kid.stdin.end(); await done; clearTimeout(timer); return raw.map((l) => { try { return JSON.parse(l); } catch { return { unparsable: l }; } }); };
      return { write: (x) => kid.stdin.write(x), raw, end };
    };
    const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
    const byId = (msgs, id) => msgs.find((m) => m && m.id === id);

    // S1 — framing on "\n" only: U+2028 / U+2029 raw inside a JSON string no longer cut a request in two.
    const s1 = frsServer();
    s1.write(JSON.stringify({ jsonrpc: "2.0", id: "s1-a", method: "tools/call", params: { name: "spec_classify", arguments: { description: "Stripe" + LS + "billing" + PS + "webhook" } } }) + "\n");
    s1.write(JSON.stringify([{ jsonrpc: "2.0", id: "s1-b1", method: "ping" }, { jsonrpc: "2.0", id: "s1-b2", method: "prompts/get", params: { name: "no" + LS + "such" } }]) + "\n");
    s1.write(JSON.stringify({ jsonrpc: "2.0", id: "s1-u", method: "resources/read", params: { uri: "specs://feature/x" + LS + "y/requirements.md" } }) + "\n");
    // a multibyte character split across two chunks stays whole; a CRLF line; a last line without its newline
    const mb = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: "s1-m", method: "tools/call", params: { name: "spec_classify", arguments: { description: "faturação multi-inquilino" } } }) + "\n", "utf8");
    const cut = mb.indexOf(0xc3) + 1;
    s1.write(mb.slice(0, cut));
    await sleep(60);
    s1.write(mb.slice(cut));
    s1.write(JSON.stringify({ jsonrpc: "2.0", id: "s1-crlf", method: "ping" }) + "\r\n");
    s1.write(JSON.stringify({ jsonrpc: "2.0", id: "s1-last", method: "ping" }));
    const r1 = await s1.end();
    const cls1 = byId(r1, "s1-a");
    const batch1 = r1.find((m) => Array.isArray(m));
    const uri1 = byId(r1, "s1-u");
    const uriLine = s1.raw.find((l) => /"s1-u"/.test(l)) || "";
    const esc = String.fromCharCode(92) + "u2028"; // the 6-character JSON escape
    ok(cls1 && cls1.result && !cls1.result.isError && JSON.parse(cls1.result.content[0].text).tracks.includes("saas") &&
      !r1.some((m) => m && m.error && m.error.code === -32700) && batch1 && batch1.map((m) => m.id).join() === "s1-b1,s1-b2" &&
      byId(r1, "s1-m") && byId(r1, "s1-m").result && JSON.parse(byId(r1, "s1-m").result.content[0].text).lang === "pt" &&
      byId(r1, "s1-crlf") && byId(r1, "s1-last") && byId(r1, "s1-last").result,
      "full review S1: a request carrying raw U+2028 / U+2029 inside a JSON string is ONE message (answered, no -32700 pair); batches, a UTF-8 character split across chunks, CRLF and a last unterminated line still work (got " +
      JSON.stringify(r1.map((m) => (m && (m.id !== undefined ? m.id + ":" + (m.error ? m.error.code : "ok") : Array.isArray(m) ? "batch" : m.unparsable)))) + ")");
    ok(uri1 && uri1.error && uri1.error.data && uri1.error.data.uri === "specs://feature/x" + LS + "y/requirements.md" && uriLine.includes(esc) &&
      !s1.raw.some((l) => l.includes(LS) || l.includes(PS)),
      "full review S1: replies never carry a raw U+2028 / U+2029 (written as their JSON escapes — readline-framed clients survive them), the value is unchanged (got " + JSON.stringify(uriLine.slice(0, 160)) + ")");

    // S2 — JSON-RPC / MCP conformance: ids, method, unknown tools.
    const s2 = frsServer();
    [
      { jsonrpc: "2.0", id: null, method: "ping" },
      { jsonrpc: "2.0", id: { a: 1 }, method: "ping" },
      { jsonrpc: "2.0", id: [1], method: "ping" },
      { jsonrpc: "2.0", id: true, method: "ping" },
      { jsonrpc: "2.0", id: 1.5, method: "ping" },
      { jsonrpc: "2.0", id: "s2-nomethod" },
      { jsonrpc: "2.0", id: "s2-response", result: {} }, // a response: never answered
      { jsonrpc: "2.0", method: "notifications/initialized" }, // a notification: never answered
      { jsonrpc: "2.0", id: "s2-unknown", method: "tools/call", params: { name: "nope", arguments: {} } },
      { jsonrpc: "2.0", id: "s2-noparams", method: "tools/call" },
      { jsonrpc: "2.0", id: "s2-pt", method: "tools/call", params: { name: "nope", arguments: { projectDir: frsPt } } },
      { jsonrpc: "2.0", id: 0, method: "ping" },
      { jsonrpc: "2.0", id: -7, method: "ping" },
      { jsonrpc: "2.0", id: "s2-ok", method: "tools/call", params: { name: "spec_list", arguments: {} } },
    ].forEach((m) => s2.write(JSON.stringify(m) + "\n"));
    const r2 = await s2.end();
    const nullIds = r2.filter((m) => m && m.id === null);
    const e2 = (id) => (byId(r2, id) || {}).error || {};
    ok(nullIds.length === 5 && nullIds.every((m) => m.error && m.error.code === -32600) && e2("s2-nomethod").code === -32600 && !byId(r2, "s2-response") &&
      r2.length === 12 && byId(r2, 0) && byId(r2, 0).result && byId(r2, -7) && byId(r2, -7).result && byId(r2, "s2-ok").result && !byId(r2, "s2-ok").result.isError,
      "full review S2: id null / object / array / boolean / fractional → -32600 (id null, never echoed); an id without a string method → -32600; a response or a notification gets no reply; ids 0 / -7 / strings are answered (got " +
      JSON.stringify(r2.map((m) => (m ? m.id + ":" + (m.error ? m.error.code : "ok") : m))) + ")");
    ok(e2("s2-unknown").code === -32602 && /Unknown tool: nope/.test(e2("s2-unknown").message) && e2("s2-noparams").code === -32602 && /params\.name/.test(e2("s2-noparams").message) &&
      e2("s2-pt").code === -32602 && /Ferramenta desconhecida: nope/.test(e2("s2-pt").message) && !byId(r2, "s2-unknown").result,
      "full review S2: tools/call of an unknown tool (or without params / a name) is a JSON-RPC error -32602 Invalid params, localized in the project language — never a successful isError result (got " +
      JSON.stringify([e2("s2-unknown"), e2("s2-noparams").code, e2("s2-pt").message]) + ")");

    // S3 — the guard sees an alias of the project (a junction / symlink; an 8.3 short name) as the project, not "outside".
    const g3 = path.join(tmp, "proj-frs-guard");
    S.initProject(g3, ["core"], "en", { guard: true });
    const g3link = path.join(tmp, "frs-guard-link");
    let linked = false;
    try { fs.symlinkSync(g3, g3link, "junction"); linked = true; } catch { /* no links here: the link assertions are skipped */ }
    if (linked) {
      const viaLink = S.guardCheck(g3, path.join(g3link, "src", "a.ts"));
      const fromLink = S.guardCheck(g3link, path.join(g3, "src", "a.ts"));
      const specsViaLink = S.guardCheck(g3, path.join(g3link, ".specs", "x.ts"));
      const outside = S.guardCheck(g3, path.join(tmp, "frs-elsewhere", "a.ts"));
      ok(viaLink.decision === "ask" && viaLink.why === "no-approved-tasks" && fromLink.decision === "ask" && specsViaLink.why === "specs" && outside.why === "outside",
        "full review S3: guard on, no approved tasks — a code file reached through a junction / symlink of the project (either side) asks like the real path; .specs/ through the link is the spec folder; a real outside file stays allowed (got " +
        JSON.stringify([viaLink.why, fromLink.why, specsViaLink.why, outside.why]) + ")");
      // scope: an absolute _Implements:_ spelled through the link plans the real file.
      const f3 = S.createFeature(g3, "Scoped", ["core"], "", undefined, "en");
      fs.writeFileSync(path.join(f3.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Implements: " + path.join(g3link, "src", "a.ts").split(path.sep).join("/") + "_\n");
      approveBefore(g3, f3.slug, "tasks");
      S.approvePhase(g3, f3.slug, "tasks", "t", { force: true });
      S.initProject(g3, [], "en", { guard: "scope" });
      const sc3 = S.guardCheck(g3, path.join(g3, "src", "a.ts"));
      ok(sc3.decision === "allow" && sc3.why === "in-scope" && sc3.task && sc3.task.number === 1,
        "full review S3: scope guard — an absolute _Implements:_ path written through the project's link plans the real file (in-scope, task 1) (got " + JSON.stringify([sc3.decision, sc3.why]) + ")");
    }
    let realTmp = tmp;
    try { realTmp = fs.realpathSync.native(tmp); } catch { /* keep */ }
    if (realTmp !== tmp) { // this machine's temp folder has another spelling (an 8.3 short name, /tmp → /private/tmp)
      const g3b = path.join(tmp, "proj-frs-guard83");
      S.initProject(g3b, ["core"], "en", { guard: true });
      const other = S.guardCheck(path.join(realTmp, "proj-frs-guard83"), path.join(g3b, "src", "b.ts"));
      ok(other.decision === "ask", "full review S3: the project given in one spelling, the file in the other (" + tmp + " vs " + realTmp + ") — the guard asks (got " + other.why + ")");
    }

    // S6 — backlog add of a name that already has an active feature folder is refused (it was listed twice in ROADMAP.md).
    const p6 = path.join(tmp, "proj-frs-backlog");
    S.initProject(p6, ["core"], "en");
    S.createFeature(p6, "Pay", ["core"], "", undefined, "en");
    const b6 = S.backlog(p6, "add", "pay", "later");
    const b6mcp = await rpc("tools/call", { name: "spec_backlog", arguments: { action: "add", name: "PAY", projectDir: p6 } });
    S.manageFeature(p6, "archive", "pay");
    const b6arch = S.backlog(p6, "add", "Pay", "again");
    ok(b6.ok === false && b6.feature === "pay" && /already has a spec \(\.specs\/pay\/\)/.test(b6.error) && b6mcp.result.isError === true &&
      /already has a spec/.test(payload(b6mcp).error) && b6arch.ok === true && b6arch.backlog.map((x) => x.name).join() === "Pay",
      "full review S6: spec_backlog add refuses a name an active feature already has (engine + MCP, nothing stored); once archived it can be planned again (got " + JSON.stringify([b6.error, b6arch.backlog]) + ")");

    // S7 — backlog 'remove' is rm's alias on every surface (the enum lists it); the templates description names pt-BR.
    const tl7 = (await rpc("tools/list", {})).result.tools;
    const bl7 = tl7.find((t) => t.name === "spec_backlog");
    const tp7 = tl7.find((t) => t.name === "spec_templates");
    const rm7 = await rpc("tools/call", { name: "spec_backlog", arguments: { action: "REMOVE", name: "pay", projectDir: p6 } });
    ok(bl7.inputSchema.properties.action.enum.join() === "add,rm,remove,list" && !rm7.result.isError && payload(rm7).backlog.length === 0 &&
      S.backlog(p6, "add", "X").ok && S.backlog(p6, "remove", "x").ok && /\(en \| pt \| pt-BR \| es\)/.test(tp7.description),
      "full review S7: spec_backlog's action enum lists remove (alias of rm — engine and MCP, case-folded); spec_templates names the pt-BR/ folder (got " +
      JSON.stringify([bl7.inputSchema.properties.action.enum, rm7.result.isError]) + ")");
  }

  { // 1.23 review — the protocol: 2025-11-25, a tool that throws answers JSON, the size of a message, the default project from roots
    const js = JSON.stringify;
    const I = require("./lib/i18n.js");

    // tools/list is what every client that loads its tools up front pays in context on every session: it was ~124k characters
    // (~31k tokens), 29 descriptions past 1,024 characters. The descriptions carry the rules an agent acts on (evidence before
    // claims, approvals are the user's, what a refusal means); the reference detail lives in references/tooling-reference.md.
    // The runnable CLI path (spec.DEV_SPEC — the clone's location) is counted as the bare `dev-spec`.
    const toolsJson = js(list.result.tools).split(S.DEV_SPEC).join("dev-spec");
    const longDesc = list.result.tools.map((t) => [t.name, t.description.split(S.DEV_SPEC).join("dev-spec").length]).filter(([, n]) => n > 2500);
    ok(toolsJson.length < 76000 && !longDesc.length && list.result.tools.every((t) => !/\n/.test(t.description)),
      "1.23 review: tools/list stays compact — under 76,000 characters (was ~124,000), no tool description past 2,500, every one a single line (got " +
      toolsJson.length + " characters; " + js(longDesc) + ")");
    // A private server with its own env (null removes a variable) and cwd; every line it writes is kept; `onRequest` answers the
    // server's own requests (roots/list).
    const server23 = (env, cwd, onRequest) => {
      const e = { ...process.env, SPEC_MCP_PROMPTS: "" };
      for (const [k, v] of Object.entries(env || {})) { if (v === null) delete e[k]; else e[k] = v; }
      const kid = spawn(process.execPath, [SERVER], { env: e, cwd: cwd || tmp, stdio: ["pipe", "pipe", "inherit"] });
      const lines = [], waiting = new Map(), asked = [];
      let b = "", n = 0;
      const write = (m) => kid.stdin.write((typeof m === "string" ? m : JSON.stringify(m)) + "\n");
      kid.stdout.on("data", (d) => {
        b += d.toString();
        let nl;
        while ((nl = b.indexOf("\n")) >= 0) {
          const line = b.slice(0, nl).trim();
          b = b.slice(nl + 1);
          if (!line) continue;
          const m = JSON.parse(line);
          lines.push(m);
          if (m.method && m.id !== undefined) { asked.push(m); const a = onRequest ? onRequest(m) : null; if (a) write(Object.assign({ jsonrpc: "2.0", id: m.id }, a)); continue; }
          if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
        }
      });
      const req = (method, params) => new Promise((resolve) => {
        const id = "p23-" + ++n;
        const t = setTimeout(() => abort("1.23: no reply to " + method + " (" + id + ") within 15s"), 15000);
        waiting.set(id, (m) => { clearTimeout(t); resolve(m); });
        write({ jsonrpc: "2.0", id, method, params });
      });
      const call = async (name, args) => { const r = await req("tools/call", { name, arguments: args }); try { return JSON.parse(r.result.content[0].text); } catch { return { raw: r }; } };
      const stop = () => new Promise((resolve) => { kid.on("exit", resolve); kid.stdin.end(); });
      return { req, call, write, raw: (s) => kid.stdin.write(s), lines, asked, stop };
    };

    // 2025-11-25 is spoken (echoed); an unknown revision gets the latest, 2025-11-25.
    const sv = server23({});
    const iNew = await sv.req("initialize", { protocolVersion: "2025-11-25", capabilities: {} });
    const iOdd = await sv.req("initialize", { protocolVersion: "2099-01-01", capabilities: {} });
    await sv.stop();
    // A tool that throws answers the JSON every other refusal is — {ok: false, error: "The tool failed: …", code} — never the
    // bare text "ERROR: …" (1.23 review L24). The throw: a server whose fs.mkdirSync fails with EACCES for one project (a
    // --require preload — the engine itself no longer throws on the shapes 1.23 used: since 1.24 r6 G7 a `.specs` FILE is a
    // localized wrongKind refusal, and since A3 a projectDir that is a file is refused before the engine).
    const throwProj = path.join(tmp, "proj-p23-throws");
    fs.mkdirSync(throwProj, { recursive: true });
    const preload = path.join(tmp, "p23-mkdir-eacces.js");
    fs.writeFileSync(preload, [
      "const fs = require('fs');",
      "const mkdir = fs.mkdirSync;",
      "fs.mkdirSync = function (p, ...rest) {",
      "  if (String(p).includes('proj-p23-throws')) { const e = new Error(\"EACCES: permission denied, mkdir '\" + p + \"'\"); e.code = 'EACCES'; throw e; }",
      "  return mkdir.call(this, p, ...rest);",
      "};",
    ].join("\n") + "\n");
    const svThrow = server23({ NODE_OPTIONS: "--require \"" + preload.split(path.sep).join("/") + "\"" });
    await svThrow.req("initialize", { protocolVersion: "2025-11-25", capabilities: {} });
    const thrown = await svThrow.req("tools/call", { name: "spec_init", arguments: { projectDir: throwProj } });
    let thrownOut = null;
    try { thrownOut = JSON.parse(thrown.result.content[0].text); } catch { thrownOut = null; }
    await svThrow.stop();
    ok(iNew.result.protocolVersion === "2025-11-25" && iOdd.result.protocolVersion === "2025-11-25" &&
      thrown.result.isError === true && thrownOut && thrownOut.ok === false && /^The tool failed: E[A-Z]+/.test(thrownOut.error) && /^E[A-Z]+$/.test(thrownOut.code || "") &&
      /^A ferramenta falhou: x$/.test(I.msg("pt").args.toolFailed("x")) && /^La herramienta falló: x$/.test(I.msg("es").args.toolFailed("x")),
      "1.23: initialize speaks 2025-11-25 (and offers it for an unknown revision); a tool that throws answers JSON {ok: false, error: 'The tool failed: …' (localized), code} with isError (got " +
      js([iNew.result.protocolVersion, iOdd.result.protocolVersion, thrown.result.content[0].text.slice(0, 160)]) + ")");

    // The size of one message: past DEV_SPEC_MCP_MAX_MESSAGE (here 4096) it is refused once (-32600, id null), its bytes skipped up
    // to the next newline — in one write or across several — and the server keeps answering (a message within it works as before).
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const sc = server23({ DEV_SPEC_MCP_MAX_MESSAGE: "4096" });
    await sc.req("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    sc.write({ jsonrpc: "2.0", id: "big-1", method: "ping", params: { pad: "x".repeat(6000) } });
    const afterWhole = await sc.req("ping", {});
    const big2 = JSON.stringify({ jsonrpc: "2.0", id: "big-2", method: "ping", params: { pad: "y".repeat(9000) } });
    for (const part of [big2.slice(0, 3000), big2.slice(3000, 6000), big2.slice(6000) + "\n"]) { sc.raw(part); await sleep(40); }
    const afterChunks = await sc.req("ping", {});
    const within = await sc.call("ears_validate", { text: "WHEN the user saves THE SYSTEM SHALL store the draft." });
    await sc.stop();
    const tooBig = sc.lines.filter((m) => m.id === null && m.error && m.error.code === -32600);
    ok(tooBig.length === 2 && tooBig.every((m) => /passes this server's limit of 4096 \(DEV_SPEC_MCP_MAX_MESSAGE\) — it was skipped/.test(m.error.message)) &&
      afterWhole.result && afterChunks.result && !sc.lines.some((m) => m.id === "big-1" || m.id === "big-2") && within.verdict === "pass" &&
      ["pt", "es"].every((l) => /4096/.test(I.msg(l).args.tooLarge(5000, 4096))),
      "1.23: a message past DEV_SPEC_MCP_MAX_MESSAGE is refused once (-32600, id null, localized) — sent whole or in chunks — skipped to its newline, and the server keeps answering (got " +
      js(sc.lines.map((m) => (m.error ? m.error.code : m.id))) + ")");

    // The default project from the client's roots: without SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR, a client declaring `roots` is asked
    // once (roots/list, on the first request that reads the project) and its first LOCAL file:// root is the default — a tool call
    // without projectDir, resources/list. An explicit projectDir still wins; roots/list_changed asks again; a network root or no
    // roots capability → the server's cwd as before; SPEC_PROJECT_DIR set → never asked.
    const fileUri = (p, vscodeStyle) => {
      const s = path.resolve(p).split(path.sep).join("/");
      if (process.platform !== "win32") return "file://" + encodeURI(s);
      return "file:///" + (vscodeStyle ? s[0].toLowerCase() + "%3A" + encodeURI(s.slice(2)) : encodeURI(s));
    };
    const rootA = path.join(tmp, "proj-p23-root-a"), rootB = path.join(tmp, "proj-p23-root-b"), cwd23 = path.join(tmp, "proj-p23-cwd"), other = path.join(tmp, "proj-p23-explicit");
    for (const d of [rootA, rootB, cwd23, other]) fs.mkdirSync(d, { recursive: true });
    S.initProject(rootA, ["core"], "en");
    S.createFeature(rootA, "From Roots", ["core"]);
    let rootsAnswer = [{ uri: "file://fileserver/share/proj", name: "a network root: skipped" }, { uri: "https://example.com/x" }, { uri: fileUri(rootA, true) }];
    const noEnv = { SPEC_PROJECT_DIR: null, CLAUDE_PROJECT_DIR: null };
    const sr = server23(noEnv, cwd23, (m) => (m.method === "roots/list" ? { result: { roots: rootsAnswer } } : null));
    await sr.req("initialize", { protocolVersion: "2025-06-18", capabilities: { roots: { listChanged: true } } });
    sr.write({ jsonrpc: "2.0", method: "notifications/initialized" });
    const rlA = (await sr.req("resources/list", {})).result;
    const listA = await sr.call("spec_list", {});
    const explicit = await sr.call("spec_list", { projectDir: other });
    const askedOnce = sr.asked.filter((m) => m.method === "roots/list").length;
    S.initProject(rootB, ["core"], "en");
    rootsAnswer = [{ uri: fileUri(rootB) }];
    sr.write({ jsonrpc: "2.0", method: "notifications/roots/list_changed" });
    const listB = await sr.call("spec_init", { tracks: ["core"] });
    const askedTwice = sr.asked.filter((m) => m.method === "roots/list").length;
    await sr.stop();
    const sn = server23(noEnv, cwd23); // no roots capability: the cwd, as before
    await sn.req("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    const listCwd = await sn.call("spec_list", {});
    await sn.stop();
    const se = server23({ SPEC_PROJECT_DIR: other, CLAUDE_PROJECT_DIR: null }, cwd23, () => ({ result: { roots: [{ uri: fileUri(rootA) }] } }));
    await se.req("initialize", { protocolVersion: "2025-06-18", capabilities: { roots: {} } });
    const listEnv = await se.call("spec_list", {});
    await se.stop();
    const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
    ok(rlA.resources.some((r) => r.uri === "specs://feature/from-roots/requirements.md") && same(listA.specsDir, path.join(rootA, ".specs")) && listA.features.length === 1 &&
      same(explicit.specsDir, path.join(other, ".specs")) && askedOnce === 1 && same(listB.specsDir, path.join(rootB, ".specs")) && askedTwice === 2 &&
      !fs.existsSync(path.join(cwd23, ".specs")) && same(listCwd.specsDir, path.join(cwd23, ".specs")) &&
      same(listEnv.specsDir, path.join(other, ".specs")) && se.asked.length === 0,
      "1.23: no SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR + a client with roots → its first local file:// root is the default project (asked once; a network root skipped; an explicit projectDir wins; list_changed asks again); no roots → cwd; SPEC_PROJECT_DIR set → never asked (got " +
      js([listA.specsDir, explicit.specsDir, askedOnce, listB.specsDir, askedTwice, listCwd.specsDir, listEnv.specsDir, se.asked.length]) + ")");
  }

  { // 1.24 r6 — the MCP server (review 6): unknown arguments, codes on argument errors, projectDir (roots, file://, an existing folder)
    const js = JSON.stringify;
    const os = require("os");
    const I = require("./lib/i18n.js");
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    const bodyOf = (res) => { try { return JSON.parse(res.result.content[0].text); } catch { return { raw: res }; } };
    const txt = (fn) => { try { return String(fn()); } catch (e) { return "THREW: " + e.message; } }; // a missing text must FAIL, not crash the run
    const same = (a, b) => typeof a === "string" && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
    const fileUri = (p) => {
      const s = path.resolve(p).split(path.sep).join("/");
      return process.platform === "win32" ? "file:///" + encodeURI(s) : "file://" + encodeURI(s);
    };
    // A private server with its own env (null removes a variable) and cwd; `onRequest` answers the server's own requests (roots/list).
    const srv = (env, cwd, onRequest) => {
      const e = { ...process.env, SPEC_MCP_PROMPTS: "" };
      for (const [k, v] of Object.entries(env || {})) { if (v === null) delete e[k]; else e[k] = v; }
      const kid = spawn(process.execPath, [SERVER], { env: e, cwd: cwd || tmp, stdio: ["pipe", "pipe", "inherit"] });
      const waiting = new Map(), asked = [];
      let b = "", n = 0;
      const write = (m) => kid.stdin.write(JSON.stringify(m) + "\n");
      kid.stdout.on("data", (d) => {
        b += d.toString();
        let nl;
        while ((nl = b.indexOf("\n")) >= 0) {
          const line = b.slice(0, nl).trim();
          b = b.slice(nl + 1);
          if (!line) continue;
          const m = JSON.parse(line);
          if (m.method && m.id !== undefined) { asked.push(m); const a = onRequest ? onRequest(m) : null; if (a) write(Object.assign({ jsonrpc: "2.0", id: m.id }, a)); continue; }
          if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
        }
      });
      const req = (method, params) => new Promise((resolve) => {
        const id = "r6-" + ++n;
        const t = setTimeout(() => abort("1.24 r6: no reply to " + method + " (" + id + ") within 20s"), 20000);
        waiting.set(id, (m) => { clearTimeout(t); resolve(m); });
        write({ jsonrpc: "2.0", id, method, params });
      });
      const callP = async (name, args) => bodyOf(await req("tools/call", { name, arguments: args }));
      const stop = () => new Promise((resolve) => { kid.on("exit", resolve); kid.stdin.end(); });
      return { req, call: callP, asked, stop, init: (caps) => req("initialize", { protocolVersion: "2025-06-18", capabilities: caps || {} }) };
    };

    { // 1.24 r6 A1: an unknown / misspelt top-level argument is refused before anything runs — code unknown-argument, a did-you-mean
      const p = path.join(tmp, "proj-r6-a1");
      S.initProject(p, ["core"], "en");
      const f = S.createFeature(p, "alpha", ["core"]);
      const cls = path.join(f.dir, "classification.md");
      fs.writeFileSync(cls, "# Classification — alpha\n\n## Active Tracks\ncore\n\n## Rationale\nA small internal change with no external surface.\n");
      const a0 = S.approvePhase(p, "alpha", "classification", "t");
      fs.appendFileSync(cls, "\nScope grew: it now also touches billing.\n");
      const stateFile = path.join(f.dir, ".state.json");
      const before = fs.readFileSync(stateFile, "utf8");
      // `revoked` for `revoke`: the key was dropped and the call RE-APPROVED the changed content
      const rv = await call("spec_approve", { name: "alpha", phase: "classification", revoked: true, projectDir: p });
      const after = fs.readFileSync(stateFile, "utf8");
      const tb = bodyOf(await call("spec_task_brief", { name: "alpha", task: 3, projectDir: p })); // `task` for `number`: the NEXT task's brief
      const typo = bodyOf(await call("spec_status", { nmae: "alpha", projectDir: p })); // a misspelt required key: named as unknown, with its fix
      const extra = bodyOf(await call("spec_list", { projectDir: p, bogus: { deep: 1 } }));
      const nul = await call("spec_list", { projectDir: p, bogus: null }); // null = not given, as for every argument
      const ptMsg = txt(() => I.msg("pt").args.unknownArgs("spec_x", [{ argument: "a", didYouMean: "b" }], "b, c"));
      const esMsg = txt(() => I.msg("es").args.unknownArgs("spec_x", [{ argument: "a" }, { argument: "z" }], "b"));
      const rvB = bodyOf(rv);
      ok(a0.ok && rv.result.isError === true && rvB.code === "unknown-argument" && js(rvB.unknown) === js([{ argument: "revoked", didYouMean: "revoke" }]) &&
        /^Unknown argument for spec_approve: revoked \(did you mean revoke\?\) — nothing was done\. spec_approve takes: name, phase,/.test(rvB.error) && before === after &&
        tb.ok === false && tb.code === "unknown-argument" && tb.unknown[0].argument === "task" && tb.unknown[0].didYouMean === "number" && tb.task === undefined &&
        typo.code === "unknown-argument" && typo.unknown[0].didYouMean === "name" && extra.code === "unknown-argument" && extra.unknown[0].didYouMean === undefined &&
        !nul.result.isError && /^Argumento desconhecido para spec_x: a \(será b\?\)/.test(ptMsg) && /^Argumentos desconocidos para spec_x: a, z/.test(esMsg),
        "1.24 r6 A1: a top-level argument the tool's inputSchema doesn't list is refused (code unknown-argument, `unknown` [{argument, didYouMean}], localized) and nothing runs — spec_approve {revoked} no longer re-approves changed content, spec_task_brief {task: 3} no longer briefs the next task (got " +
        js([rvB, tb.code, typo.unknown, extra.unknown, before === after]) + ")");
      // Every argument a tool's handler reads is in its inputSchema — one it doesn't list would now be refused, never read.
      const src = fs.readFileSync(SERVER, "utf8");
      const parts = src.slice(src.indexOf("function runTool("), src.indexOf("// --- JSON-RPC / MCP plumbing")).split(/case "([a-z_]+)":/);
      const unlisted = [];
      for (let i = 1; i < parts.length; i += 2) {
        const tool = list.result.tools.find((t) => t.name === parts[i]);
        const props = tool ? tool.inputSchema.properties : {};
        for (const m of parts[i + 1].matchAll(/\bargs\.([A-Za-z_]+)/g)) if (!Object.prototype.hasOwnProperty.call(props, m[1])) unlisted.push(parts[i] + "." + m[1]);
      }
      ok((parts.length - 1) / 2 === list.result.tools.length && !unlisted.length,
        "1.24 r6 A1: every argument runTool reads is in its tool's inputSchema (" + (parts.length - 1) / 2 + " tools; got " + js(unlisted) + ")");
    }

    { // 1.24 r6 A-I2: every argument error carries a stable code (+ the arguments it names) — the message stays localized
      const p = path.join(tmp, "proj-r6-ai2");
      S.initProject(p, ["core"], "pt");
      const miss = bodyOf(await call("spec_status", { projectDir: p }));
      const inv = bodyOf(await call("spec_complete_task", { name: "x", number: 1.5, evidence: { command: "a", exitCode: "0" }, projectDir: p }));
      const notObj = bodyOf(await rpc("tools/call", { name: "spec_list", arguments: [p] }));
      const dd = bodyOf(await call("spec_list", { projectDir: "../somewhere" }));
      const net = bodyOf(await call("spec_list", { projectDir: "//fileserver/share/proj" }));
      ok(miss.code === "missing-arguments" && js(miss.missing) === '["name"]' && /em falta: name/.test(miss.error) &&
        inv.code === "invalid-arguments" && js(inv.invalid) === '["number","evidence.exitCode"]' && /tem de ser/.test(inv.error) &&
        notObj.code === "invalid-arguments" && js(notObj.invalid) === '["arguments"]' && dd.code === "project-dotdot" && net.code === "project-network",
        "1.24 r6 A-I2: argument errors carry a stable code — missing-arguments {missing}, invalid-arguments {invalid}, project-dotdot, project-network — with the localized message (got " +
        js([miss, inv.code, inv.invalid, notObj.code, dd.code, net.code]) + ")");
    }

    { // 1.24 r6 A2: with the client's roots, an unexpanded projectDir counts as not given (→ the root) and a relative one resolves from the root
      const rootDir = path.join(tmp, "proj-r6-a2-root"), cwd = path.join(tmp, "proj-r6-a2-cwd");
      for (const d of [path.join(rootDir, "sub"), cwd]) fs.mkdirSync(d, { recursive: true });
      const s = srv({ SPEC_PROJECT_DIR: null, CLAUDE_PROJECT_DIR: null }, cwd, (m) => (m.method === "roots/list" ? { result: { roots: [{ uri: fileUri(rootDir) }] } } : null));
      await s.init({ roots: { listChanged: true } });
      const init = await s.call("spec_init", { tracks: ["core"], projectDir: "$HOME" });
      const made = [];
      for (const [name, pd] of [["brace", "${workspaceFolder}/"], ["percent", "%CD%"], ["dollar", "$PWD/x"], ["dot", "."], ["dotslash", "./"]]) {
        made.push([name, await s.call("spec_create", { name, tracks: ["core"], projectDir: pd })]);
      }
      const sub = await s.call("spec_init", { tracks: ["core"], projectDir: "sub" });
      await s.stop();
      ok(init.ok !== false && same(init.specsDir, path.join(rootDir, ".specs")) && made.every(([n, r]) => r.ok && fs.existsSync(path.join(rootDir, ".specs", n))) &&
        sub.ok !== false && same(sub.specsDir, path.join(rootDir, "sub", ".specs")) && fs.readdirSync(cwd).length === 0,
        "1.24 r6 A2: roots chose the default project → a projectDir holding an unexpanded variable ($HOME, ${workspaceFolder}/, %CD%, $PWD/x) is the root, a relative one ('.', './', 'sub') resolves from it — nothing lands in the server's cwd (got " +
        js([init.specsDir, made.map(([n, r]) => [n, r.ok]), sub.specsDir, fs.readdirSync(cwd)]) + ")");
    }

    { // 1.24 r6 A3: a projectDir naming no folder is refused (only spec_init creates one), a file too; a file:// URI names its folder
      const base = path.join(tmp, "proj-r6-a3"), cwd = path.join(tmp, "proj-r6-a3-cwd");
      fs.mkdirSync(cwd, { recursive: true });
      S.initProject(base, ["core"], "en");
      const typo = path.join(base, "my-projct-typo");
      const aFile = path.join(base, "a-file.txt");
      fs.writeFileSync(aFile, "x\n");
      const s = srv({ SPEC_PROJECT_DIR: base, CLAUDE_PROJECT_DIR: null }, cwd);
      await s.init();
      const refused = [];
      for (const [tool, args] of [["spec_create", { name: "alpha", tracks: ["core"] }], ["spec_backlog", { action: "add", name: "x" }], ["spec_roadmap", { write: true }],
        ["steering_scaffold", { file: "tech.md" }], ["spec_tracks", { action: "init", name: "mob" }], ["spec_list", {}]]) refused.push(await s.call(tool, Object.assign({ projectDir: typo }, args)));
      const onFile = await s.call("spec_list", { projectDir: aFile });
      const initNew = await s.call("spec_init", { tracks: ["core"], projectDir: path.join(base, "fresh") });
      const viaUri = await s.call("spec_create", { name: "beta", tracks: ["core"], projectDir: fileUri(base) });
      const listUri = await s.call("spec_list", { projectDir: fileUri(base) });
      const netUri = await s.call("spec_list", { projectDir: "file://fileserver/share/proj" });
      await s.stop();
      ok(refused.every((r) => r.ok === false && r.code === "project-missing" && /^projectDir .*my-projct-typo: no such folder — check the path \(only spec_init creates a project folder\)/.test(r.error)) &&
        !fs.existsSync(typo) && onFile.ok === false && onFile.code === "project-not-dir" && /a-file\.txt is a file, not a folder/.test(onFile.error) &&
        initNew.ok !== false && fs.existsSync(path.join(base, "fresh", ".specs")) && viaUri.ok && fs.existsSync(path.join(base, ".specs", "beta")) &&
        listUri.ok !== false && same(listUri.specsDir, path.join(base, ".specs")) && netUri.ok === false && netUri.code === "project-network" && fs.readdirSync(cwd).length === 0 &&
        ["pt", "es"].every((l) => /x-dir/.test(txt(() => I.msg(l).args.projectMissing("x-dir"))) && /x-dir/.test(txt(() => I.msg(l).args.projectNotDir("x-dir")))),
        "1.24 r6 A3: a projectDir that names no folder is refused (project-missing — spec_init alone creates one), a file is refused (project-not-dir — spec_list said exists: false), a file:// URI names its folder (a network one is refused), nothing lands in the cwd (got " +
        js([refused.map((r) => r.code), onFile, viaUri.ok, listUri.specsDir, netUri.code, fs.readdirSync(cwd)]) + ")");
    }

    { // 1.24 r6 A5: descriptions — spec_status names the change kind, spec_next_task.max has its maximum (validated), every projectDir is described
      const tools = list.result.tools;
      const tool = (n) => tools.find((t) => t.name === n);
      const undescribed = tools.filter((t) => t.inputSchema.properties.projectDir && !t.inputSchema.properties.projectDir.description).map((t) => t.name);
      const p = path.join(tmp, "proj-r6-a5");
      S.initProject(p, ["core"], "en");
      S.createFeature(p, "alpha", ["core"]);
      const over = bodyOf(await call("spec_next_task", { name: "alpha", batch: true, max: 9, projectDir: p }));
      const atMax = bodyOf(await call("spec_next_task", { name: "alpha", batch: true, max: 8, projectDir: p }));
      const pdInit = tool("spec_init").inputSchema.properties.projectDir.description;
      ok(/feature \/ bugfix \/ spike \/ change\)/.test(tool("spec_status").description) && tool("spec_next_task").inputSchema.properties.max.maximum === 8 &&
        over.code === "invalid-arguments" && /max must be an integer between 1 and 8 \(got 9\)/.test(over.error) && atMax.ok !== false && !undescribed.length &&
        /client's first root/.test(pdInit) && /relative/i.test(pdInit) && /only spec_init creates/i.test(pdInit) &&
        ["pt", "es"].every((l) => /1.*8/.test(txt(() => I.msg(l).args.between(1, 8)))),
        "1.24 r6 A5: spec_status's kinds name change; spec_next_task.max carries maximum 8 and 9 is refused; every projectDir has a description — spec_init's says how the folder is chosen (got " +
        js([over.error, atMax.ok, undescribed, pdInit]) + ")");
    }

    { // 1.24 r6 A-I1: a tool's result is compact JSON — the same object without the indentation (~22% of a reply's characters)
      const r = await call("spec_list", { projectDir: path.join(tmp, "proj-r6-a5") });
      const e = await call("spec_status", { projectDir: path.join(tmp, "proj-r6-a5") });
      const t = r.result.content[0].text, te = e.result.content[0].text;
      ok(!/\n/.test(t) && JSON.stringify(JSON.parse(t)) === t && !/\n/.test(te) && JSON.parse(te).code === "missing-arguments",
        "1.24 r6 A-I1: tool results and argument errors are compact JSON (got " + js([t.slice(0, 80), te.slice(0, 80)]) + ")");
    }

    { // 1.24 r6 A6: a feature lock another live process holds makes an MCP call wait ~2 s (not DEV_SPEC_LOCK_WAIT_MS's 10 s) — then busy
      const p = path.join(tmp, "proj-r6-a6");
      S.initProject(p, ["core"], "en");
      const f = S.createFeature(p, "alpha", ["core"]);
      const lock = path.join(f.dir, ".lock");
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), token: "r6-a6" }));
      const s = srv({ SPEC_PROJECT_DIR: p, DEV_SPEC_LOCK_WAIT_MS: null }, p);
      await s.init();
      const t0 = Date.now();
      const busy = await s.call("spec_complete_task", { name: "alpha", number: 1, evidence: { command: "echo", exitCode: 0, summary: "x" } });
      const waited = Date.now() - t0;
      await s.stop();
      const s2 = srv({ SPEC_PROJECT_DIR: p, DEV_SPEC_LOCK_WAIT_MS: "300" }, p); // an explicit DEV_SPEC_LOCK_WAIT_MS still wins
      await s2.init();
      const t1 = Date.now();
      const busy2 = await s2.call("spec_complete_task", { name: "alpha", number: 1, evidence: { command: "echo", exitCode: 0, summary: "x" } });
      const waited2 = Date.now() - t1;
      await s2.stop();
      const untouched = /- \[ \] 1\./.test(fs.readFileSync(path.join(f.dir, "tasks.md"), "utf8"));
      fs.unlinkSync(lock);
      ok(busy.ok === false && busy.busy === true && waited >= 1500 && waited < 8000 && busy2.busy === true && waited2 < 1500 && untouched,
        "1.24 r6 A6: an MCP call waits ~2 s for a feature lock another live process holds (DEV_SPEC_LOCK_WAIT_MS unset), then answers busy — the server froze 10 s; an explicit DEV_SPEC_LOCK_WAIT_MS still wins (got " +
        js([busy.busy, waited, busy2.busy, waited2, untouched]) + ")");
    }
  }
};
