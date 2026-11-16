"use strict";
// The fast check (1.36) on the CLI — init --fast-check (note, refusal, the offer), done --run running it first (only when it isn't clean, once when the _Verify:_ is it, logged at its START, warn only, the shell rules), metrics' line (PT), upgrade's offer.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, runIn, runAsync, tmp, require, __dirname }) => {
  const SD = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = JSON.stringify;
  const jsonOf = (r) => { try { return JSON.parse(r.stdout !== undefined ? r.stdout : r.out); } catch { return null; } };
  const meta = (p) => { try { return JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8")).meta || {}; } catch { return null; } };
  const FC = SD.msg("en").fastCheck;
  const PASS = 'node -e "process.exit(0)"';

  { // init --fast-check: the note (on / off), a name no check carries refused (exit 1; --json invalid-arguments [fastCheck]), the offer printed
    const p = path.join(tmp, "fc-init");
    SD.initProject(p, ["core"], "en");
    const on = runIn(["init", "--check", "tc=node tc.js", "--fast-check", "tc", "--project", p]);
    const onMeta = meta(p).fastCheck;
    const off = runIn(["init", "--fast-check", "off", "--project", p]);
    const offMeta = meta(p);
    const bad = runIn(["init", "--fast-check", "nope", "--project", p]);
    const badJ = jsonOf(runIn(["init", "--fast-check", "nope", "--json", "--project", p]));
    const empty = runIn(["init", "--fast-check", "--json", "--project", p]); // a value flag: a following flag is no value
    const q = path.join(tmp, "fc-init-offer");
    fs.mkdirSync(q, { recursive: true });
    fs.writeFileSync(path.join(q, "go.mod"), "module x\n");
    const offer = runIn(["init", "--project", q]);
    const offerJ = jsonOf(runIn(["init", "--json", "--project", q]));
    all("1.36 fast check: init --check tc=… --fast-check tc stores it with its note, --fast-check off its off note; a name no check carries exits 1 (--json: invalid-arguments [fastCheck]); a go.mod project's init prints the offer (never set) (got " +
      js([on.out.slice(-300), off.out.slice(-120), bad, badJ, offer.out.slice(-300)]) + ")", {
      on: () => on.code === 0 && onMeta === "tc" && on.out.includes("\n  " + FC.on("tc", "node tc.js") + "\n"),
      off: () => off.code === 0 && !("fastCheck" in offMeta) && off.out.includes("  " + FC.off),
      bad: () => bad.code === 1 && bad.out.includes(FC.badName("nope", "tc")),
      badJson: () => badJ && badJ.ok === false && badJ.code === "invalid-arguments" && js(badJ.invalid) === '["fastCheck"]',
      noValue: () => empty.code === 1,
      offer: () => offer.code === 0 && offerJ && offerJ.fastCheckOffer && offerJ.fastCheckOffer.command === "go vet ./..." &&
        offer.out.includes("  " + offerJ.fastCheckOffer.note) && meta(q).fastCheck === undefined,
    });
  }

  { // done --run: the fast check first — only while it isn't clean, never on a task naming no file, once when the _Verify:_ IS it — logged
    // in the project's log at its START (an edit it makes reads stale), warn only (a failure / could-not-run says so, the _Verify:_ runs)
    const p = path.join(tmp, "fc-done");
    fs.mkdirSync(p, { recursive: true });
    // tc.js: counts its runs (tc-runs.log); exits with tc-exit.txt's code; rewrites the file tc-touch.txt names; sleeps with tc-sleep.txt
    fs.writeFileSync(path.join(p, "tc.js"), [
      "const fs = require('fs');",
      "fs.appendFileSync('tc-runs.log', 'run\\n');",
      "if (fs.existsSync('tc-sleep.txt')) { const end = Date.now() + 4000; while (Date.now() < end) { /* busy */ } }",
      "if (fs.existsSync('tc-touch.txt')) fs.writeFileSync(fs.readFileSync('tc-touch.txt', 'utf8').trim(), '// rewritten\\n');",
      "console.log('0 type errors');",
      "process.exit(fs.existsSync('tc-exit.txt') ? parseInt(fs.readFileSync('tc-exit.txt', 'utf8'), 10) : 0);",
    ].join("\n"));
    SD.initProject(p, ["core"], "en", { checks: { tc: "node tc.js" }, fastCheck: "tc" });
    const f = SD.createFeature(p, { name: "Login", tracks: ["core"] });
    const files = ["a", "b", "c", "e", "f", "g"].map((x) => "src/" + x + ".js");
    fs.mkdirSync(path.join(p, "src"), { recursive: true });
    files.forEach((rel) => fs.writeFileSync(path.join(p, rel), "// " + rel + "\n"));
    const past = new Date(Date.now() - 600000);
    const datePast = () => files.forEach((rel) => fs.utimesSync(path.join(p, rel), past, past));
    datePast();
    const task = (n, title, lines) => `- [ ] ${n}. [US1] ${title}\n` + lines.map((l) => "  - " + l + "\n").join("");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" +
      task(1, "Code A", ["_Implements: src/a.js_", "_Verify: " + PASS + "_"]) + task(2, "Code B", ["_Implements: src/b.js_", "_Verify: " + PASS + "_"]) +
      task(3, "Types", ["_Implements: src/c.js_", "_Verify: node tc.js_"]) + task(4, "Docs", ["_Verify: " + PASS + "_"]) +
      task(5, "Code E", ["_Implements: src/e.js_", "_Verify: " + PASS + "_"]) + task(6, "Code F", ["_Implements: src/f.js_", "_Verify: " + PASS + "_"]) +
      task(7, "Code G", ["_Implements: src/g.js_", "_Verify: " + PASS + "_"]));
    const runs = () => { try { return fs.readFileSync(path.join(p, "tc-runs.log"), "utf8").split("\n").filter(Boolean).length; } catch { return 0; } };
    const log = () => { try { return fs.readFileSync(path.join(p, ".specs", ".execution", "observed.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
    const done = async (n, extra) => { const r = await runAsync(["done", f.slug, String(n), "--run", "--json", ...(extra || []), "--project", p]); return { ...r, j: jsonOf(r) }; };
    const label = "$ node tc.js   (" + FC.label + ")";
    const got = {};
    got.first = await done(1); got.firstRuns = runs(); got.firstLog = log();
    got.clean = await done(2); got.cleanRuns = runs();
    fs.writeFileSync(path.join(p, "src", "c.js"), "// edited\n"); // stale now — but task 3's _Verify:_ IS the fast command
    got.inVerify = await done(3); got.inVerifyRuns = runs();
    got.docs = await done(4); got.docsRuns = runs();
    fs.writeFileSync(path.join(p, "tc-exit.txt"), "2");
    fs.writeFileSync(path.join(p, "src", "e.js"), "// edited\n");
    got.failing = await done(5); got.failingRuns = runs();
    fs.unlinkSync(path.join(p, "tc-exit.txt"));
    fs.writeFileSync(path.join(p, "src", "f.js"), "// edited\n");
    fs.writeFileSync(path.join(p, "tc-touch.txt"), "src/f.js");
    got.rewrites = await done(6);
    fs.unlinkSync(path.join(p, "tc-touch.txt"));
    fs.writeFileSync(path.join(p, "tc-sleep.txt"), "1");
    fs.writeFileSync(path.join(p, "src", "g.js"), "// edited\n");
    got.cantRun = await done(7, ["--timeout", "2"]);
    fs.unlinkSync(path.join(p, "tc-sleep.txt"));
    const brief = (r) => [r.code, r.j && r.j.fastCheck, (r.out || "").split("\n").filter((l) => /fast check|node tc\.js/i.test(l)).slice(0, 4)];
    all("1.36 fast check: done --run runs it FIRST (alone, '(fast check)') while it isn't clean, logs it (event cli) and the tick reads clean; clean → not run again (its line); a _Verify:_ that is the fast command runs it once and its run counts; a task naming no file runs none; a failing one warns and the _Verify:_ still runs (failed + the note); a fast check that rewrites a planned file reads stale (logged at its START); one that could not run warns; --json stays one document (got " +
      js(Object.fromEntries(Object.entries(got).map(([k, v]) => [k, v && v.j !== undefined ? brief(v) : v]))) + ")", {
      first: () => got.first.code === 0 && got.firstRuns === 1 && got.first.out.includes(label) && js(got.first.j.fastCheck) === js({ check: "tc", status: "clean", runs: 1, clean: 1 }),
      logged: () => got.firstLog.some((e) => e.command === "node tc.js" && e.exitCode === 0 && e.event === "cli"),
      cleanSkips: () => got.clean.code === 0 && got.cleanRuns === 1 && got.clean.out.includes(FC.skipClean("tc")) && got.clean.j.fastCheck.status === "clean",
      inVerifyOnce: () => got.inVerify.code === 0 && got.inVerifyRuns === 2 && !got.inVerify.out.includes(label) && got.inVerify.j.fastCheck.status === "clean",
      docsNone: () => got.docs.code === 0 && got.docsRuns === 2 && !("fastCheck" in got.docs.j) && !/fast check/i.test(got.docs.out),
      failingWarns: () => got.failing.code === 0 && got.failingRuns === 3 && got.failing.out.includes(FC.runFailed("node tc.js", 2)) && got.failing.j.verified === true &&
        got.failing.j.fastCheck.status === "failed" && got.failing.j.note === FC.tickNote(5, "tc", "node tc.js", "failed", f.slug),
      startStamp: () => got.rewrites.code === 0 && got.rewrites.j.fastCheck.status === "stale",
      cantRunWarns: () => got.cantRun.code === 0 && /could not run/.test(got.cantRun.out) && got.cantRun.out.includes("`node tc.js`") && got.cantRun.j.completed === 7,
    });
  }

  { // the shell rules of finish --run's checks refuse the fast command before anything runs (RUN.preRunRefusal): POSIX quoting under
    // cmd.exe (Windows), a pwsh script's $… under /bin/sh (elsewhere)
    const p = path.join(tmp, "fc-done-shell");
    const cmd = process.platform === "win32" ? "node -e 'process.exit(0)'" : 'pwsh -NoProfile -Command "exit $LASTEXITCODE"';
    SD.initProject(p, ["core"], "en", { checks: { tc: cmd }, fastCheck: "tc" });
    const f = SD.createFeature(p, { name: "Login", tracks: ["core"] });
    fs.mkdirSync(path.join(p, "src"), { recursive: true });
    fs.writeFileSync(path.join(p, "src", "a.js"), "//\n");
    fs.writeFileSync(path.join(p, "marker.js"), "require('fs').writeFileSync('ran.txt', 'x'); process.exit(0);\n");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Code\n  - _Implements: src/a.js_\n  - _Verify: node marker.js_\n");
    const M = SD.msg("en").projectChecks;
    const want = process.platform === "win32" ? M.posixOnWindows("tc", cmd, ["single-quotes"]) : M.pwshInPosix("tc", cmd, ["variable"], "/bin/sh");
    return runAsync(["done", f.slug, "1", "--run", "--project", p]).then((r) => {
      all("1.36 fast check: done --run refuses a fast command the shell would misread before anything runs — the project-check message, the _Verify:_ never ran, nothing ticked (got " + js([r.code, r.out.slice(0, 300)]) + ")", {
        refused: () => r.code === 1 && r.out.includes(want),
        nothingRan: () => !fs.existsSync(path.join(p, "ran.txt")) && /- \[ \] 1\./.test(fs.readFileSync(path.join(f.dir, "tasks.md"), "utf8")),
      });
    }).then(async () => {
      // metrics: the feature's fast-check line in its language (PT); upgrade: the offer line
      const q = path.join(tmp, "fc-metrics-pt");
      SD.initProject(q, ["core"], "pt", { checks: { tc: "node tc.js" }, fastCheck: "tc" });
      const g = SD.createFeature(q, { name: "Entrar", tracks: ["core"], lang: "pt" });
      fs.mkdirSync(path.join(q, "src"), { recursive: true });
      fs.writeFileSync(path.join(q, "src", "a.js"), "//\n");
      fs.utimesSync(path.join(q, "src", "a.js"), new Date(Date.now() - 600000), new Date(Date.now() - 600000));
      fs.writeFileSync(path.join(g.dir, "tasks.md"), "# Tarefas\n\n- [ ] 1. [US1] Código\n  - _Implements: src/a.js_\n  - _Verify: " + PASS + "_\n");
      fs.mkdirSync(path.join(q, ".specs", ".execution"), { recursive: true });
      fs.writeFileSync(path.join(q, ".specs", ".execution", "observed.jsonl"), js({ command: "node tc.js", exitCode: 0, at: new Date(Date.now() + 1000).toISOString(), event: "PostToolUse" }) + "\n");
      SD.completeTask(q, g.slug, 1, { command: PASS, exitCode: 0 });
      const m = runIn(["metrics", g.slug, "--project", q]);
      const want2 = SD.msg("pt").fastCheck.metrics("tc", 1, 1, 100, 1, 1);
      const u = path.join(tmp, "fc-upgrade");
      fs.mkdirSync(u, { recursive: true });
      fs.writeFileSync(path.join(u, "Cargo.toml"), "[package]\nname = \"x\"\n");
      SD.initProject(u, ["core"], "en");
      SD.createFeature(u, { name: "Login", tracks: ["core"] });
      const up = runIn(["upgrade", "--project", u]);
      const offer = SD.specUpgrade(u).fastCheckOffer;
      all("1.36 fast check: metrics prints the feature's fast-check line in its language (PT); upgrade prints the offer (got " + js([m.out.slice(-400), up.out.slice(0, 400)]) + ")", {
        metricsPt: () => m.code === 0 && m.out.includes(want2),
        upgrade: () => up.code === 0 && !!offer && up.out.includes("  ▲ " + offer.note),
      });
    });
  }
};
