"use strict";
// +port on the CLI (1.36 — port first, improve later): done --run refuses a task the fence holds before running anything (its --json = the
// spec_complete_task refusal: gated, heldBy), status prints the [PORT] sections, approve tasks at size m refuses on port-verify, next names the
// unverified baseline's run instead of a held task (1.36.0 review 1 — --json = spec_next_task), a bugfix with
// +port is refused, classify reads a port's verb as a 'Possible +port' note (the same reading as the engine).

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, runIn, runAsync, tmp, require, __dirname }) => {
  const S = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const p = path.join(tmp, "p36-port-cli");
  runIn(["init", "core", "--lang", "en", "--project", p]);
  runIn(["create", "Csv port", "--tracks", "port", "--size", "m", "--project", p]);
  const dir = path.join(p, ".specs", "csv-port");
  const marker = path.join(p, "ran-2.txt");
  fs.writeFileSync(path.join(dir, "tasks.md"), "# Tasks: Csv port\n\n## Story US-1 — Behaviour Baseline (before the port)\n" +
    "- [ ] 1. [US1] Record the baseline\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n  - _Verify: node -e \"process.exit(0)\"_\n\n## Phase: Setup\n" +
    "- [ ] 2. [shared] Set up\n  - _Verify: node -e \"require('fs').writeFileSync('ran-2.txt', 'x')\"_\n\n" +
    "## Story US-1 — Differential Check (the port's proof)\n- [ ] 3. [US1] Differential check\n  - _Requirements: US-1.AC-36, US-1.AC-37_\n" +
    "  - _Verify: [command that runs the NEW implementation on the corpus and compares it with the recorded baseline]_\n");
  const before = fs.readFileSync(path.join(dir, ".state.json"), "utf8");
  const held = await runAsync(["done", "csv-port", "2", "--run", "--project", p]);
  const heldJson = await runAsync(["done", "csv-port", "2", "--run", "--json", "--project", p]);
  const mcp = S.completeTask(p, "csv-port", 2, { command: "node x.js", exitCode: 0 });
  let parsed = null;
  try { parsed = JSON.parse(heldJson.out); } catch { /* reported below */ }
  all("1.36 (CLI): done --run on a task the +port fence holds exits 1 with the gate's message and runs nothing (its _Verify:_ marker never written, .state.json unchanged); --json is the spec_complete_task refusal — gated port-order, heldBy [1] (got " +
    js([held.code, held.out.slice(0, 160), parsed]) + ")", [
    () => held.code === 1, () => held.out.includes(S.msg("en").gates.portHeld(2, 1, "csv-port")), () => !fs.existsSync(marker),
    () => fs.readFileSync(path.join(dir, ".state.json"), "utf8") === before, () => heldJson.code === 1, () => !!parsed,
    () => js(parsed) === js({ ok: false, gated: mcp.gated, heldBy: mcp.heldBy, error: mcp.error }), () => mcp.gated === "port-order" && js(mcp.heldBy) === "[1]",
  ]);
  // status prints the [PORT] sections; approve tasks at size m refuses naming port-verify (the differential check's _Verify:_ is a slot)
  const st = runIn(["status", "csv-port", "--project", p]);
  for (const ph of ["classification", "requirements", "design"]) runIn(["approve", "csv-port", ph, "--force", "--project", p]);
  const ap = runIn(["approve", "csv-port", "tasks", "--project", p]);
  all("1.36 (CLI): status prints 'Port sections: …'; approve tasks at size m is refused on port-verify (got " + js([st.out.split("\n").filter((l) => /Port sections/.test(l)), ap.code, ap.out.slice(0, 300)]) + ")", [
    () => st.code === 0, () => st.out.split("\n").some((l) => l.trim().startsWith(S.msg("en").secPrivacy.statusSections.port("").trim())),
    () => ap.code === 1, () => /port-verify/.test(ap.out),
  ]);
  // 1.36 review 1 (INT-2): the baseline ticked with a note only (unverified) — next serves no held task: it prints the way out (the baseline's
  // run), and --json is spec_next_task's result (next null, gated, heldBy)
  S.completeTask(p, "csv-port", 1, { summary: "recorded by hand" });
  const nx = runIn(["next", "csv-port", "--project", p]), nxJson = runIn(["next", "csv-port", "--json", "--project", p]);
  let nj = null;
  try { nj = JSON.parse(nxJson.out); } catch { /* reported below */ }
  const engNext = S.nextTask(p, "csv-port");
  all("1.36 review 1 (CLI): next on a +port plan whose baseline is ticked but unverified prints the baseline's run, never a held task; --json is spec_next_task's (got " + js([nx.out.slice(0, 200), nj]) + ")", [
    () => nx.code === 0, () => nx.out.includes(S.msg("en").port.naHeld(2, 1, "csv-port", true)), () => !!nj, () => js(nj) === js(engNext),
    () => nj.next === null && nj.gated === "port-order" && js(nj.heldBy) === "[1]",
  ]);
  // a bugfix with +port is refused before anything is written; classify reads a port verb as a note only — the engine's reading
  const bug = runIn(["create", "Crash", "--kind", "bugfix", "--tracks", "port", "--project", p]);
  const text = "Port the CSV importer from Python to Go";
  const cl = runIn(["classify", text, "--json", "--project", p]);
  let c = null;
  try { c = JSON.parse(cl.out); } catch { /* reported below */ }
  const eng = S.classify(text, { projectDir: p });
  all("1.36 (CLI): create --kind bugfix --tracks port is refused (nothing written); classify --json reads 'Port … to Go' as a 'Possible +port' note, the engine's reading (got " + js([bug.code, bug.out.slice(0, 160), c && c.possible]) + ")", [
    () => bug.code === 1, () => bug.out.includes(S.msg("en").tracks.portBugfix), () => !fs.existsSync(path.join(p, ".specs", "crash")),
    () => !!c, () => js(c.tracks) === js(eng.tracks), () => js(c.possible) === js(eng.possible), () => c.possible.some((x) => x.track === "port") && !c.tracks.includes("port"),
  ]);
};
