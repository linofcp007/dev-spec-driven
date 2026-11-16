"use strict";
// Protected tests (1.36, meta.guard "tests") on the CLI — init --guard tests (its note, the unguarded warning), feature protect / unprotect (the human lines, --json = the MCP result, the refusals' exit code and code, each action's flags and arguments).

const fs = require("fs");
const path = require("path");

exports.run = ({ all, runIn, tmp, require, __dirname }) => {
  const SD = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = JSON.stringify;
  const P = SD.msg("en").protectedTests;
  const C = SD.msg("en").cliOutput;
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const p = path.join(tmp, "pt-cli");
  const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(p, rel)), { recursive: true }); fs.writeFileSync(path.join(p, rel), text); };

  const init = runIn(["init", "--guard", "tests", "--project", p]);
  const meta = JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8")).meta;
  w("test/a.test.js", "a\n"); w("test/b.test.js", "b\n");
  SD.createFeature(p, "Login", ["core"], "", undefined, "en");
  const protect = runIn(["feature", "protect", "login", "--project", p]);
  const lift = runIn(["feature", "unprotect", "login", "test/a.test.js", "--reason", "replaced by v2", "--project", p]);
  const liftJ = jsonOf(runIn(["feature", "unprotect", "login", "--file", "test/b.test.js", "--reason", "flaky", "--json", "--project", p]));
  const listed = runIn(["feature", "protect", "login", "--project", p]);
  const listedJ = jsonOf(runIn(["feature", "protect", "login", "--json", "--project", p]));
  const st = JSON.parse(fs.readFileSync(path.join(p, ".specs", "login", ".state.json"), "utf8")).protectedTests;
  all("1.36 guard tests on the CLI: init --guard tests stores meta.guard 'tests' with its note and the unguarded warning; feature protect prints the list's line, then each lift; feature unprotect <f> <file> (or --file) --reason records the lift — --json is the MCP result {action, lifted, listed} (got " +
    js([init.code, meta.guard, protect.out, lift.out, liftJ, listed.out]) + ")", {
    init: () => init.code === 0 && meta.guard === "tests" && init.out.includes(P.on) && init.out.includes(P.unguarded),
    protect: () => protect.code === 0 && protect.out.includes(P.listNote("login", 2, SD.dayOf(st.at), P.via.protect, 2)),
    lift: () => lift.code === 0 && lift.out.includes(P.lifted("test/a.test.js", "login", true)),
    liftJson: () => liftJ && liftJ.ok === true && liftJ.action === "unprotect" && liftJ.lifted.file === "test/b.test.js" && liftJ.lifted.reason === "flaky" && liftJ.listed === true,
    lines: () => listed.code === 0 && st.lifts.filter((l) => !l.revoked).every((l) => listed.out.includes(C.protectLift(l.file, l.by, SD.dayOf(l.at), l.reason, false, true))),
    jsonLifts: () => listedJ && listedJ.lifts.length === 2 && listedJ.protectedTests.count === 2 && listedJ.lifts.every((l) => l.active === true),
  });

  const noReason = runIn(["feature", "unprotect", "login", "test/a.test.js", "--project", p]);
  const noReasonJ = jsonOf(runIn(["feature", "unprotect", "login", "test/a.test.js", "--json", "--project", p]));
  const reasonOnProtect = runIn(["feature", "protect", "login", "--reason", "x", "--project", p]);
  const fileOnArchive = runIn(["feature", "archive", "login", "--file", "test/a.test.js", "--project", p]);
  const extra = runIn(["feature", "unprotect", "login", "test/a.test.js", "test/b.test.js", "--reason", "x", "--project", p]);
  const extraWithFile = runIn(["feature", "unprotect", "login", "test/a.test.js", "--file", "test/b.test.js", "--reason", "x", "--project", p]);
  const badGuard = runIn(["init", "--guard", "strict", "--project", p]);
  all("1.36 guard tests on the CLI: an unprotect without --reason exits 1 (--json: code reason-required, the MCP refusal); --reason only on unprotect, --file only on protect / unprotect (flagNotFor); a second file (also beside --file) is an extra argument; --guard names tests in its refusal (got " +
    js([noReason.code, noReasonJ, reasonOnProtect.out, fileOnArchive.out, extra.code, extraWithFile.code]) + ")", {
    refused: () => noReason.code === 1 && noReason.out.includes(P.err.reasonRequired) && noReasonJ && noReasonJ.code === "reason-required" && noReasonJ.ok === false,
    reasonFlag: () => reasonOnProtect.code === 1 && reasonOnProtect.out.includes(C.flagNotFor("--reason", "feature protect", "--file")),
    fileFlag: () => fileOnArchive.code === 1 && fileOnArchive.out.includes(C.flagNotFor("--file", "feature archive", "")),
    extra: () => extra.code === 1 && extra.out.includes(C.extraArgs("feature unprotect", "test/b.test.js")),
    extraWithFile: () => extraWithFile.code === 1 && extraWithFile.out.includes(C.extraArgs("feature unprotect", "test/a.test.js")),
    guard: () => badGuard.code === 1 && badGuard.out.includes(SD.msg("en").guardMode.badValue("strict")),
  });
};
