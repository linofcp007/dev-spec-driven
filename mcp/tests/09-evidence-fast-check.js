"use strict";
// Evidence — the fast check (1.36, roadmap.json meta.fastCheck, warn only): set by spec_init (checked against this call's checks, refused before any write), the tick-time status (the project log's latest run vs the planned files' dates), next_task / the brief / complete_task's keys, metrics, doctor, the offer.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, eq, rpc, payload, S, tmp, hookIn, remeasure, fsCalls, __dirname }) => {
  const js = JSON.stringify;
  const call = async (name, args) => payload(await rpc("tools/call", { name, arguments: args }));
  const FC = S.msg("en").fastCheck;
  const PASS = 'node -e "process.exit(0)"';
  const TC = "node tc.js"; // the fast check's command — the MCP tests run nothing, the CLI's do
  const rmFile = (p) => path.join(p, ".specs", "roadmap.json");
  const meta = (p) => { try { return JSON.parse(fs.readFileSync(rmFile(p), "utf8")).meta || {}; } catch { return null; } };
  const setMeta = (p, patch) => { const rm = JSON.parse(fs.readFileSync(rmFile(p), "utf8")); rm.meta = { ...(rm.meta || {}), ...patch }; fs.writeFileSync(rmFile(p), js(rm, null, 2)); };
  const bytes = (p) => fs.readFileSync(rmFile(p), "utf8");
  const safe = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } }; // a regression must FAIL, not crash the file
  const logFile = (p) => path.join(p, ".specs", ".execution", "observed.jsonl");
  // the project log as the observe hook writes it: [command, exitCode, at (ms)]
  const writeLog = (p, lines) => {
    fs.mkdirSync(path.dirname(logFile(p)), { recursive: true });
    fs.writeFileSync(logFile(p), lines.map(([command, exitCode, at]) => js({ command, exitCode, at: new Date(at).toISOString(), event: "PostToolUse" }) + "\n").join(""));
  };
  const appendLog = (p, lines) => fs.appendFileSync(logFile(p), lines.map(([command, exitCode, at]) => js({ command, exitCode, at: new Date(at).toISOString(), event: "PostToolUse" }) + "\n").join(""));
  const dated = (p, rels, ms) => rels.forEach((r) => fs.utimesSync(path.join(p, r), new Date(ms), new Date(ms)));
  const project = (name, tasks, files) => {
    const p = path.join(tmp, name);
    S.initProject(p, ["core"], "en", { checks: { tc: TC, lint: "npm run lint" }, fastCheck: "tc" });
    const f = S.createFeature(p, { name: "Login", tracks: ["core"] });
    for (const rel of files) { fs.mkdirSync(path.dirname(path.join(p, rel)), { recursive: true }); fs.writeFileSync(path.join(p, rel), "// " + rel + "\n"); }
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n## Phase 1\n\n" + tasks);
    return { p, f };
  };
  const task = (n, title, lines) => `- [ ] ${n}. [US1] ${title}\n` + lines.map((l) => "  - " + l + "\n").join("");

  { // spec_init {fastCheck}: a check of this very call (one call), echoed (the CURRENT one, always), off / none / "" delete it, the same value
    // again writes nothing, alone it is stored too
    const p = path.join(tmp, "proj-fc-init");
    S.initProject(p, ["core"], "en");
    S.createFeature(p, { name: "Login", tracks: ["core"] }); // no longer brand-new: init stamps nothing more
    const plain0 = await call("spec_init", { projectDir: p });
    const set = await call("spec_init", { checks: { tc: TC }, fastCheck: "tc", projectDir: p });
    const setMeta1 = meta(p).fastCheck;
    const past = new Date("2026-01-01T00:00:00Z");
    fs.utimesSync(rmFile(p), past, past);
    const again = S.initProject(p, [], null, { fastCheck: "tc" });
    const kept = fs.statSync(rmFile(p)).mtimeMs === past.getTime();
    const off = await call("spec_init", { fastCheck: "off", projectDir: p });
    const offMeta = meta(p);
    const alone = await call("spec_init", { fastCheck: " tc ", projectDir: p });
    const aloneMeta = meta(p).fastCheck;
    const none = S.initProject(p, [], null, { fastCheck: "NONE" });
    const noneMeta = meta(p);
    S.initProject(p, [], null, { fastCheck: "tc" });
    const empty = await call("spec_init", { fastCheck: "", projectDir: p });
    const emptyMeta = meta(p);
    S.initProject(p, [], null, { fastCheck: "tc" });
    const plain = await call("spec_init", { projectDir: p });
    all("1.36 fast check: spec_init {fastCheck} names a check of the same call (checks + fastCheck at once), stored in meta.fastCheck and echoed as the CURRENT one with its note; the same value again writes nothing; off / NONE / \"\" delete it (note off); alone it is stored too; a call that names none echoes it without a note (got " +
      js([set, off.fastCheck, offMeta, alone.fastCheck, none.fastCheckNote, empty.fastCheck, plain.fastCheck, plain.fastCheckNote]) + ")", {
      noneEchoed: () => plain0.fastCheck === null && plain0.fastCheckNote === undefined,
      oneCall: () => set.ok !== false && setMeta1 === "tc" && set.fastCheck === "tc" && js(set.checks) === js({ tc: TC }),
      onNote: () => set.fastCheckNote === FC.on("tc", TC),
      sameNoWrite: () => again.fastCheckNote === FC.on("tc", TC) && kept,
      offDeletes: () => off.ok !== false && !("fastCheck" in offMeta) && off.fastCheck === null && off.fastCheckNote === FC.off,
      aloneStored: () => alone.ok !== false && aloneMeta === "tc" && alone.fastCheck === "tc",
      noneDeletes: () => none.fastCheckNote === FC.off && !("fastCheck" in noneMeta),
      emptyDeletes: () => empty.ok !== false && !("fastCheck" in emptyMeta) && empty.fastCheckNote === FC.off,
      plainEcho: () => plain.fastCheck === "tc" && plain.fastCheckNote === undefined,
    });
  }

  { // refused before ANY write (invalid-arguments, invalid [fastCheck]): no such check, dev-guardian's gate, a command that rewrites files
    // (--fix, --write, a formatter without --check); the stored fast check's command replaced by a fixer; a non-string (engine; the
    // schema over MCP). A check-only formatter is fine.
    const p = path.join(tmp, "proj-fc-refuse");
    S.initProject(p, ["core"], "en", { checks: { tc: TC }, fastCheck: "tc" });
    const before = bytes(p);
    const refused = (r) => r.ok === false && r.code === "invalid-arguments" && js(r.invalid) === '["fastCheck"]';
    const r = {
      unknown: await call("spec_init", { fastCheck: "nope", guard: "on", projectDir: p }),
      guardian: await call("spec_init", { checks: { guardian: PASS }, fastCheck: "guardian", projectDir: p }),
      fix: await call("spec_init", { checks: { fx: "eslint --fix ." }, fastCheck: "fx", projectDir: p }),
      write: S.initProject(p, [], null, { checks: { pw: "prettier --write ." }, fastCheck: "pw" }),
      fmt: S.initProject(p, [], null, { checks: { fm: "cargo fmt" }, fastCheck: "fm" }),
      replaced: S.initProject(p, [], null, { checks: { tc: "eslint --fix src" } }),
      number: safe(() => S.initProject(p, [], null, { fastCheck: 5 })),
      schema: await call("spec_init", { fastCheck: 5, projectDir: p }),
    };
    const after = bytes(p);
    const fmtCheck = S.initProject(p, [], null, { checks: { fc: "cargo fmt --check" }, fastCheck: "fc" });
    const fmtMeta = meta(p).fastCheck;
    all("1.36 fast check: refused before anything is written — a name that is no check after this call's merge (beside a good setting: nothing lands), dev-guardian's gate, --fix / --write / a formatter without --check, the stored fast check's command replaced by a fixer, a non-string; `cargo fmt --check` is accepted (got " +
      js(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, [v.ok, v.code, (v.error || v.threw || "").slice(0, 70)]]))) + ")", {
      unknown: () => refused(r.unknown) && r.unknown.error === FC.badName("nope", "tc"),
      guardian: () => refused(r.guardian) && r.guardian.error === FC.guardianNotFast("guardian"),
      fix: () => refused(r.fix) && r.fix.error === FC.fixer("fx", "eslint --fix ."),
      write: () => refused(r.write) && r.write.error === FC.fixer("pw", "prettier --write ."),
      fmt: () => refused(r.fmt) && r.fmt.error === FC.fixer("fm", "cargo fmt"),
      replaced: () => refused(r.replaced) && r.replaced.error === FC.fixer("tc", "eslint --fix src"),
      number: () => refused(r.number) && r.number.error === FC.badInput("5"),
      schema: () => r.schema.ok === false && r.schema.code === "invalid-arguments",
      nothingWritten: () => after === before && meta(p).guard === undefined,
      checkOnlyFormatter: () => fmtCheck.ok !== false && fmtMeta === "fc",
    });
    // 1.36 review 1 (FC-4 / T3): the rule as the docs say it, both ways — a --fix / --fix=… / --write word, or a fmt / format program or
    // subcommand with no check flag, is refused; a check-only command never is (a check flag, a check-named script, an @alias, a flag
    // that holds "format"). A formatter known by another name (prettier -w, black .) is outside the heuristic, as the docs say.
    const fixerOf = (cmd) => S.initProject(p, [], null, { checks: { fx: cmd }, fastCheck: "fx" }).ok === false;
    const rewriters = ["eslint --fix=true .", "gofmt -w .", "ruff format .", "dotnet format", "clang-format -i src/a.c", "npm run format", "mix format",
      // 1.36 review 2 (FC2-1): a -w word beside a formatter writes, whatever check flag stands beside it; a formatter's bare form writes
      "gofmt -l -w .", "shfmt -l -w .", "buf format -w --exit-code", "dart format --set-exit-if-changed .", "swiftformat .", "elm-format --yes src",
      // 1.36 review 3 (PF3-4): the words of the formatter's own simple command decide (another command's check word in a chain never does), and
      // `lint` after a make / just / task target is another target
      "make fmt lint", "just fmt lint", "task fmt lint", "cargo fmt && git diff --exit-code", "cargo fmt; git diff --exit-code", "cargo fmt || git diff --exit-code",
      "cargo fmt && cargo test --test api",
      // 1.36 review 4 (PF4-2): `lint` is swift-format's own subcommand only — any other runner's `fmt lint` runs fmt (a target, a goal, a script's
      // argument), and a program merely named …swift is not swift
      "gmake fmt lint", "pants fmt lint ::", "npm run fmt lint", "myswift format lint"];
    const checkOnly = ["prettier --check .", "eslint --fix-dry-run .", "cargo fmt --check", "ruff format --check .", "black --check .", "terraform fmt -check",
      "gofmt -l .", "shfmt -d .", "ruff format --diff .", "clang-format --dry-run --Werror src/a.c", "dotnet format --verify-no-changes",
      "mix format --check-formatted", "make check-fmt", "npm run check:fmt", "npm run fmt:check", "dune build @fmt", "cargo clippy --message-format short",
      // 1.36 review 2 (FC2-1): the check modes of the formatters the widened set reads — a lint subcommand or flag, a validate / test / exit-code
      // / no-output flag, -n (a dry run) —, a lint-named script, and a -w that is no formatter's
      "swift format lint --strict -r Sources", "swift-format lint -r Sources", "swiftformat --lint .", "dart format --output=none --set-exit-if-changed .",
      "elm-format --validate src", "buf format --exit-code", "clang-format -n --Werror src/a.c", "google-java-format -n --set-exit-if-changed A.java",
      "scalafmt --test", "npm run lint:format", "npm run lint-fmt", "npx jest -w 2",
      // 1.36 review 3 (PF3-4): another command's -w in a pipe is not the formatter's
      "gofmt -l . | grep -v -w vendor", "test -z \"$(gofmt -l . | grep -w go)\"",
      // 1.36 review 4 (PF4-2): swift-format's lint subcommand, however the program is reached
      "swift format lint", "swift-format lint", "xcrun swift-format lint -r .", "/usr/bin/swift format lint -r Sources"];
    const outside = ["prettier -w .", "black ."]; // rewriters by another name: accepted, the documented limit of the heuristic
    const plainOnly = ["biome format ."]; // a formatter whose bare form only reports: refused, the documented limit (its check form: biome ci / biome check)
    const wrong = [...[...rewriters, ...plainOnly].filter((c) => !fixerOf(c)), ...[...checkOnly, ...outside].filter((c) => fixerOf(c))];
    // 1.36 review 1 (INT-6): a refused init leaves nothing behind — beside dev-guardian's gate the fast check is planned before the
    // gate's launcher is written (the gate itself, a name no check carries); a roadmap.json that doesn't parse keeps its own refusal
    const fresh = (name) => { const q = path.join(tmp, name); fs.mkdirSync(q, { recursive: true }); return q; };
    const g = fresh("proj-fc-guardian-fresh"), n = fresh("proj-fc-guardian-name");
    const rg = S.initProject(g, ["core"], "en", { guardian: true, fastCheck: "guardian" });
    const rn = S.initProject(n, ["core"], "en", { guardian: true, fastCheck: "nope" });
    const b = path.join(tmp, "proj-fc-guardian-broken");
    S.initProject(b, ["core"], "en", { checks: { tc: TC } });
    fs.appendFileSync(rmFile(b), "x");
    const rb0 = S.initProject(b, [], null, { guardian: true }), rb = S.initProject(b, [], null, { guardian: true, fastCheck: "tc" });
    all("1.36 review 1: init --guardian with a fast check it refuses writes nothing on a fresh folder (no .specs/, no .gitignore) — the gate as the fast check, a name no check carries; a broken roadmap.json still answers with its own refusal (got " +
      js([rg.error, fs.readdirSync(g), rn.error, fs.readdirSync(n), rb.error && rb.error.slice(0, 80)]) + ")", {
      gate: () => rg.ok === false && rg.code === "invalid-arguments" && js(rg.invalid) === '["fastCheck"]' && rg.error === FC.guardianNotFast("guardian") && fs.readdirSync(g).length === 0,
      name: () => rn.ok === false && rn.error === FC.badName("nope", "guardian") && fs.readdirSync(n).length === 0,
      broken: () => rb0.ok === false && rb.ok === false && rb.error === rb0.error && rb.code === undefined,
    });
    ok(wrong.length === 0, "1.36 review 1 + 2 + 3 + 4: the fixer refusal follows its documented rule — --fix / --fix=… / --write, or a fmt / format command with -w or without a check word in its own simple command (review 3: never another command's of a chain or pipe) (-l, -d, -n, --diff, --dry-run, --verify-no-changes, --check-…, --lint, --validate, --test, --exit-code, --output=none, swift-format's own lint subcommand — review 4: any other runner's `fmt lint` is refused: make, gmake, pants, npm run) refused; check-only commands, check- / lint-named scripts, an @fmt alias, a --message-format flag and a -w of no formatter accepted; biome format . refused (the documented limit) (wrong: " + js(wrong) + ")");
  }

  { // removing the fast check's own check removes the fast check too (cleared note); doctor's `fast-check` warns on a stored value no
    // fast check reads (no such check, dev-guardian's gate, a fixer — a hand edit), never on a valid one
    const p = path.join(tmp, "proj-fc-clear");
    S.initProject(p, ["core"], "en", { checks: { tc: TC, lint: "npm run lint" }, fastCheck: "tc" });
    const f = S.createFeature(p, { name: "Login", tracks: ["core"] });
    const fastWarn = () => S.specDoctor(p, f.slug).checks.filter((c) => c.id === "fast-check");
    const valid = fastWarn();
    const cleared = await call("spec_init", { checks: { tc: "" }, projectDir: p });
    const clearedMeta = meta(p);
    const other = S.initProject(p, [], null, { checks: { lint: "" } }); // a call that removes ANOTHER check: nothing to clear
    setMeta(p, { fastCheck: "gone" });
    const missing = fastWarn();
    const echo = await call("spec_init", { projectDir: p }); // 1.36 review 1 (INT-5): init says the stored value is ignored, as reviewModels'
    setMeta(p, { checks: { guardian: PASS }, fastCheck: "guardian" });
    const guardian = fastWarn();
    setMeta(p, { checks: { fx: "eslint --fix ." }, fastCheck: "fx" });
    const fixer = fastWarn();
    all("1.36 fast check: removing its check clears meta.fastCheck (the cleared note); doctor warns fast-check (once) for a stored name that is no check, dev-guardian's gate or a fixer — never for a valid one (got " +
      js([cleared.fastCheckNote, clearedMeta, valid, missing, guardian, fixer]) + ")", {
      cleared: () => cleared.ok !== false && !("fastCheck" in clearedMeta) && cleared.fastCheck === null && cleared.fastCheckNote === FC.cleared("tc"),
      otherNoNote: () => other.fastCheckNote === undefined,
      validSilent: () => valid.length === 0,
      missing: () => js(missing) === js([{ id: "fast-check", status: "warn", detail: FC.doctorInvalid("gone", "missing") }]),
      initIgnored: () => echo.fastCheck === "gone" && echo.fastCheckNote === FC.doctorInvalid("gone", "missing") && /no fast check runs/.test(echo.fastCheckNote),
      guardian: () => guardian.length === 1 && guardian[0].detail === FC.doctorInvalid("guardian", "guardian"),
      fixer: () => fixer.length === 1 && fixer[0].detail === FC.doctorInvalid("fx", "fixer"),
    });
  }

  { // the status at a code task: the project log's LATEST run of the fast command (by its time; > 5 min ahead ignored; the check as ONE
    // command) against the newest date of the feature's planned files (> 5 min ahead ignored)
    const files = ["src/a.js", "src/b.js", "tests/a.test.js"];
    const { p, f } = project("proj-fc-status",
      task(1, "Code A", ["_Implements: src/a.js_", "_Verify: " + PASS + "_"]) + task(2, "Code B", ["_Implements: src/b.js_", "_Verify: " + PASS + "_"]) +
      task(3, "Docs", ["_Verify: " + PASS + "_"]) + task(4, "Write T-01 red", ["_Implements: tests/a.test.js_", "_Verify: node -e \"process.exit(1)\"_", "_Expect: fail_"]), files);
    const T0 = Date.now() - 600000;
    dated(p, files, T0);
    const st = () => { const b = S.taskBrief(p, f.slug, 1); return b.fastCheck ? b.fastCheck.status : "none"; };
    const got = {};
    got.unknown = st(); // no harness log at all
    writeLog(p, [["npm run lint", 0, T0 + 10000]]);
    got.missing = st();
    writeLog(p, [[TC + " && npm test", 0, T0 + 10000]]);
    got.chained = st();
    writeLog(p, [[TC, 0, T0 + 10000]]);
    got.clean = st();
    dated(p, ["src/b.js"], T0 + 20000);
    got.stale = st(); // ANY planned file of the feature, edited after the run
    dated(p, ["src/b.js"], T0);
    writeLog(p, [[TC, 0, T0 + 10000], [TC, 1, T0 + 30000]]);
    got.failed = st();
    writeLog(p, [[TC, 0, T0 + 10000], [TC, 1, Date.now() + 10 * 60000]]);
    got.futureRun = st();
    writeLog(p, [[TC, 0, T0 + 10000]]);
    dated(p, ["src/a.js"], Date.now() + 3600000);
    got.futureFile = st();
    dated(p, ["src/a.js"], T0);
    writeLog(p, [[TC, 0, T0 + 40000], [TC, 1, T0 + 10000]]); // an older run appended later (done --run logs its START time)
    got.byTime = st();
    fs.rmSync(path.join(p, "tests", "a.test.js"));
    got.missingFile = st(); // a planned file not there is no edit
    eq(got, { unknown: "unknown", missing: "missing", chained: "missing", clean: "clean", stale: "stale", failed: "failed", futureRun: "clean", futureFile: "clean", byTime: "clean", missingFile: "clean" },
      "1.36 fast check: the status — unknown (no log at all) · missing (no run of the fast command; a chained `tc && test` line is none) · clean · stale (a planned file newer than the run) · failed (the latest run failed) — the latest by time (an older line appended later loses), a run or a file date > 5 min ahead ignored, a missing planned file no edit");
    fs.writeFileSync(path.join(p, "tests", "a.test.js"), "// back\n");
    dated(p, ["tests/a.test.js"], T0);
    writeLog(p, [[TC, 0, T0 + 10000]]);
    // the keys: next_task / the brief / write:true on a code task; none on a task naming no file; the red task's line
    const next = await call("spec_next_task", { name: f.slug, projectDir: p });
    const b1 = S.taskBrief(p, f.slug, 1);
    const b1w = S.taskBrief(p, f.slug, 1, { write: true });
    const b3 = S.taskBrief(p, f.slug, 3);
    const b4 = await call("spec_task_brief", { name: f.slug, number: 4, includeBrief: true, projectDir: p });
    S.completeTask(p, f.slug, 2, { command: PASS, exitCode: 0 });
    const b2done = S.taskBrief(p, f.slug, 2);
    const spike = S.createFeature(p, { name: "Probe", kind: "spike", question: "Does X scale?", timebox: "1d" });
    fs.writeFileSync(path.join(spike.dir, "tasks.md"), "# Tasks\n\n" + task(1, "Prototype", ["_Implements: src/a.js_", "_Verify: " + PASS + "_"]));
    const bSpike = S.taskBrief(p, spike.slug, 1);
    const nSpike = S.nextTask(p, spike.slug);
    all("1.36 fast check: next_task {check, command} and the brief {check, command, status} for an open CODE task — kept under write:true, its definition of done the loop line (a red task: the stub line instead); no key for a task naming no file, a done task or a spike's task (got " +
      js([next.fastCheck, b1.fastCheck, b1w.fastCheck, b3.fastCheck, b4.fastCheck, b2done.fastCheck, bSpike.fastCheck, nSpike.fastCheck]) + ")", {
      next: () => js(next.fastCheck) === js({ check: "tc", command: TC }),
      brief: () => js(b1.fastCheck) === js({ check: "tc", command: TC, status: "clean" }),
      briefDod: () => b1.brief.includes(FC.briefDod(TC)) && !b1.brief.includes(FC.briefDodRed(TC)) && /chained or piped/.test(FC.briefDod(TC)), // piped: review 1
      writeKeeps: () => js(b1w.fastCheck) === js(b1.fastCheck) && b1w.brief === undefined,
      docsNone: () => !("fastCheck" in b3) && !b3.brief.includes(FC.briefDod(TC)),
      redLine: () => b4.fastCheck && b4.fastCheck.check === "tc" && b4.brief.includes(FC.briefDodRed(TC)) && !b4.brief.includes(FC.briefDod(TC)),
      doneNone: () => !("fastCheck" in b2done),
      spikeNone: () => !("fastCheck" in bSpike) && !("fastCheck" in nSpike),
    });
  }

  { // the tick: complete_task carries {check, status, runs, clean} on a code task it TICKS, with a note while it isn't clean since the last
    // edit (never for unknown: no log at all); none on a task naming no file, nor on a re-check of a done task
    const files = ["src/a.js", "src/b.js", "src/c.js"];
    const { p, f } = project("proj-fc-notes",
      task(1, "Code A", ["_Implements: src/a.js_", "_Verify: " + PASS + "_"]) + task(2, "Code B", ["_Implements: src/b.js_", "_Verify: " + PASS + "_"]) +
      task(3, "Code C", ["_Implements: src/c.js_", "_Verify: " + PASS + "_"]) + task(4, "Docs", ["_Verify: " + PASS + "_"]), files);
    const T0 = Date.now() - 60000;
    dated(p, files, T0);
    const run = { command: PASS, exitCode: 0 };
    const t1 = await call("spec_complete_task", { name: f.slug, number: 1, evidence: run, projectDir: p });
    writeLog(p, [["npm run lint", 0, T0 + 1000]]);
    const t2 = S.completeTask(p, f.slug, 2, run);
    writeLog(p, [[TC, 0, T0 + 30000]]);
    dated(p, ["src/c.js"], T0 + 50000);
    const t3 = S.completeTask(p, f.slug, 3, run);
    const nextDocs = S.nextTask(p, f.slug);
    const t4 = await call("spec_complete_task", { name: f.slug, number: 4, evidence: run, projectDir: p });
    const again = S.completeTask(p, f.slug, 1, run);
    const m = S.metrics(p, f.slug).fastCheck;
    // 1.36 review 1 (FC-2): the note names no command but the fast check itself — its `done <f> <n> --run` named the task just ticked,
    // whose --run runs no fast check (a done task's brief carries none) — in every language, status and form
    const onlyFast = (note) => !/--run|dev-spec/.test(note) && (note.match(/`[^`]*`/g) || []).every((s) => s === "`" + TC + "`");
    const every = ["en", "pt", "es"].every((l) => ["stale", "failed", "missing"].every((s) => [false, true].every((pw) => onlyFast(S.msg(l).fastCheck.tickNote(3, "tc", TC, s, pw)))));
    all("1.36 fast check: the tick's fastCheck {check, status, runs, clean} — unknown without a note, missing and stale with their note (the PowerShell hint on missing); next_task / complete_task carry none for a task naming no file, nor a re-check of a done task; the note names no command but the fast check (review 1); metrics leave the unknown tick out (review 1) (got " +
      js([t1.fastCheck, t1.note, t2.fastCheck, t2.note, t3.fastCheck, nextDocs.fastCheck, t4.fastCheck, again.fastCheck, m]) + ")", {
      unknown: () => t1.ok && js(t1.fastCheck) === js({ check: "tc", status: "unknown", runs: 0, clean: 0 }) && t1.note === undefined,
      missing: () => t2.fastCheck.status === "missing" && t2.note === FC.tickNote(2, "tc", TC, "missing", false) && /PowerShell/.test(t2.note) && /on its own/.test(t2.note) && /piped/.test(t2.note),
      stale: () => t3.fastCheck.status === "stale" && t3.note === FC.tickNote(3, "tc", TC, "stale", false) && !/PowerShell/.test(t3.note),
      noOtherCommand: () => every && onlyFast(t2.note) && onlyFast(t3.note),
      docsNext: () => nextDocs.next.number === 4 && !("fastCheck" in nextDocs),
      docsTick: () => t4.ok && !("fastCheck" in t4),
      recheck: () => again.ok && again.alreadyDone === true && !("fastCheck" in again),
      metricsNoUnknown: () => m && m.ticks === 2 && m.ticksClean === 0, // missing + stale; the unknown tick (no harness log yet) is none
    });
  }

  { // 1.36 review 1 (FC-1): past the planned set's cap (500 files — an earlier task's folder of 600), the task's OWN _Implements:_ file
    // is still dated: its edit reads stale, never clean (done --run then runs the check); partial: true says the set was cut — no other
    // status, no note of its own
    const p = path.join(tmp, "proj-fc-cap");
    S.initProject(p, ["core"], "en", { checks: { tc: TC }, fastCheck: "tc" });
    const f = S.createFeature(p, { name: "Port", tracks: ["core"] });
    const T0 = Date.now() - 600000;
    fs.mkdirSync(path.join(p, "src", "legacy"), { recursive: true });
    fs.mkdirSync(path.join(p, "src", "new"), { recursive: true });
    const files = [...Array.from({ length: 600 }, (_, i) => "src/legacy/m" + i + ".ts"), "src/new/port.ts"];
    files.forEach((rel) => fs.writeFileSync(path.join(p, rel), "//\n"));
    dated(p, files, T0);
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" + task(1, "The legacy module", ["_Implements: src/legacy/_", "_Verify: " + PASS + "_"]) +
      task(2, "The port", ["_Implements: `src/new/port.ts`_", "_Verify: " + PASS + "_"]));
    writeLog(p, [[TC, 0, T0 + 10000]]);
    const before = S.taskBrief(p, f.slug, 2).fastCheck;
    dated(p, ["src/new/port.ts"], T0 + 20000); // the task's own edit, after the run
    const after = S.taskBrief(p, f.slug, 2).fastCheck;
    const t2 = S.completeTask(p, f.slug, 2, { command: PASS, exitCode: 0 });
    all("1.36 review 1: over 500 planned files the ticked task's own file is dated past the cap — clean before its edit, stale after it (brief and tick, with the stale note), partial: true on both (got " +
      js([before, after, t2.fastCheck, t2.note]) + ")", {
      before: () => js(before) === js({ check: "tc", command: TC, status: "clean", partial: true }),
      after: () => js(after) === js({ check: "tc", command: TC, status: "stale", partial: true }),
      tick: () => t2.ok && js(t2.fastCheck) === js({ check: "tc", status: "stale", runs: 0, clean: 0, partial: true }) && t2.note === FC.tickNote(2, "tc", TC, "stale", false),
    });
  }

  { // 1.36 review 2 (FC2-3): the task's own files are dated from the planned walk's result (its files known: no second realpath check, no second
    // date) — COUNTED (1.40): on a big-glob task the brief and next_task with the fast check make, under the project root, the fs calls of the
    // same call without it plus the planned walk's own, and one open more (the observed log's). A second realpath check of the own files
    // (+500 realpathSync.native), a second date (+500 statSync) or the log read again per planned file (+500 openSync — outside src/: why the
    // root) is a count. The time is a backstop only: four calls a side (each side ≥ 100 ms in a Linux container), the call with the fast
    // check against the call without it plus the walk in ONE interval, each side's median of 5, the rounds interleaved, one ratio a
    // remeasure, ≤ 2.5× — it hides anything under 2.5×: a quadratic over the planned set that makes no fs call (the known set rebuilt
    // per own file: 1.6–2.2× on node 22, 1.1–1.2× on Windows) passes. The 1.39 bound (≤ 1.3, one call a side) missed on Linux under load
    // (1.73 / 1.78 node:24-alpine); at ≤ 1.5 the four calls crossed 1.5 in 7 of 36 base samples on node 22 (max 1.94) and 3 of 36 on
    // node:24-alpine (1.75), the MCP suite running beside; one call a side (~40 ms) crossed even 2.5 (testing.md → Adding a test)
    const E = require(path.join(__dirname, "lib", "engine", "index.js"));
    const p = path.join(tmp, "proj-fc-cost");
    S.initProject(p, ["core"], "en", { checks: { tc: TC }, fastCheck: "tc" });
    const f = S.createFeature(p, { name: "Big", tracks: ["core"] });
    for (let d = 0; d < 8; d++) {
      fs.mkdirSync(path.join(p, "src", "d" + d), { recursive: true });
      for (let i = 0; i < 100; i++) fs.writeFileSync(path.join(p, "src", "d" + d, "f" + i + ".ts"), "//\n");
    }
    const text = "# Tasks\n\n" + task(1, "Refactor", ["_Implements: src/**/*.ts_", "_Verify: " + PASS + "_"]) + task(2, "More", ["_Implements: src/**/*.ts_", "_Verify: " + PASS + "_"]);
    fs.writeFileSync(path.join(f.dir, "tasks.md"), text);
    writeLog(p, [[TC, 0, Date.now() + 1000]]);
    const planned = () => S.withReadCache(() => E.baselineFiles(p, text).files.forEach((r) => { try { fs.statSync(path.join(p, r)); } catch { /* none */ } }));
    const brief = () => S.taskBrief(p, f.slug, 1), next = () => S.nextTask(p, f.slug);
    // the counts: (the call with the fast check − the call without it) − the planned walk's, per fs function, under the project root
    const root = p + path.sep;
    const minus = (a, b) => { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = (a[k] || 0) - (b[k] || 0); if (d) o[k] = d; } return o; };
    const extra = (call) => { setMeta(p, { fastCheck: undefined }); const off = fsCalls(root, call); setMeta(p, { fastCheck: "tc" }); return minus(fsCalls(root, call), off); };
    const walk = fsCalls(root, planned);
    const counted = { brief: minus(extra(brief), walk), next: minus(extra(next), walk) };
    // the backstop: per round four calls with the fast check, then four of the call without it and the walk, each side in one interval;
    // 6 rounds, the first a warm-up, each side's median of 5
    const backstop = (call) => remeasure(() => {
      const on = [], off = [];
      const time = (into, fn) => { const t0 = process.hrtime.bigint(); for (let k = 0; k < 4; k++) fn(); into.push(Number(process.hrtime.bigint() - t0) / 1e6); };
      for (let i = 0; i < 6; i++) {
        setMeta(p, { fastCheck: "tc" });
        time(on, call);
        setMeta(p, { fastCheck: undefined });
        time(off, () => { call(); planned(); });
      }
      const med = (a) => a.slice(1).sort((x, y) => x - y)[2];
      return { on: Math.round(med(on)), off: Math.round(med(off)), ratio: Math.round(med(on) / med(off) * 100) / 100 };
    }, (x) => x.ratio <= 2.5);
    const s = { brief: backstop(brief), next: backstop(next) };
    setMeta(p, { fastCheck: "tc" });
    const st = S.taskBrief(p, f.slug, 1).fastCheck;
    all("1.36 review 2 (FC2-3): a big-glob task's brief and next_task with the fast check make, under the project root, the fs calls of the call without it plus the planned walk's and ONE open more (the observed log's) — each file realpath-checked and dated once —, and four of them cost at most ×2.5 four of the call without it plus the walk (a backstop) (got " +
      js({ counted, walk, s, tries: [s.brief.tries, s.next.tries], st }) + ")", {
      counted: () => js(counted) === js({ brief: { openSync: 1 }, next: { openSync: 1 } }),
      walkSeen: () => walk.statSync > 0 && walk["realpathSync.native"] > 0, // (a spy that saw nothing would make every difference 0)
      backstop: () => s.brief.ratio <= 2.5 && s.next.ratio <= 2.5,
      status: () => st && st.status === "clean" && st.partial === true,
    });
  }

  { // 1.36 review 1 (FC-6): the PowerShell tool through the observe hook — its failure is logged (marked tool: PowerShell), a later pass
    // with no explicit exit code is not: the failed note says why (a Bash run's line carries no tool, its failure no such sentence —
    // the window block below)
    const p = path.join(tmp, "proj-fc-pwsh");
    S.initProject(p, ["core"], "en", { checks: { tc: TC }, fastCheck: "tc" });
    const f = S.createFeature(p, { name: "Login", tracks: ["core"] });
    fs.mkdirSync(path.join(p, "src"), { recursive: true });
    fs.writeFileSync(path.join(p, "src", "a.ts"), "//\n");
    dated(p, ["src/a.ts"], Date.now() - 600000);
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" + task(1, "Code A", ["_Implements: src/a.ts_", "_Verify: " + PASS + "_"]));
    const hookJs = path.join(__dirname, "..", "hooks", "observe-hook.js");
    const runHook = (o) => hookIn(hookJs, { input: js({ session_id: "s", cwd: p, tool_name: "PowerShell", tool_input: { command: TC }, ...o }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: p, SPEC_PROJECT_DIR: "" } });
    runHook({ hook_event_name: "PostToolUseFailure", error: "Command failed with exit code 2" });
    runHook({ hook_event_name: "PostToolUse", tool_response: { stdout: "", stderr: "" } }); // a pass with no explicit exit code: not logged
    const lines = (() => { try { return fs.readFileSync(logFile(p), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } })();
    const t1 = S.completeTask(p, f.slug, 1, { command: PASS, exitCode: 0 });
    all("1.36 review 1: a PowerShell-tool failure of the fast check is logged with tool: PowerShell (its pass without an explicit exit code is not) — the tick's failed note names the PowerShell case and the Bash tool (got " +
      js([lines, t1.fastCheck, t1.note]) + ")", {
      logged: () => lines.length === 1 && lines[0].exitCode === 2 && lines[0].tool === "PowerShell",
      note: () => t1.fastCheck && t1.fastCheck.status === "failed" && t1.note === FC.tickNote(1, "tc", TC, "failed", true) && /PowerShell/.test(t1.note) && /Bash tool/.test(t1.note),
    });
  }

  { // the window and the record: runs / clean since the previous tick; the snapshot rides on the tick's RUN (`fast`, its history too — a
    // re-check after it keeps it, a note-only tick records none); metrics per feature + the project's tick totals
    const files = ["src/a.js", "src/b.js", "src/c.js"];
    const { p, f } = project("proj-fc-window",
      task(1, "Code A", ["_Implements: src/a.js_", "_Verify: " + PASS + "_"]) + task(2, "Code B", ["_Implements: src/b.js_", "_Verify: " + PASS + "_"]) +
      task(3, "Code C", ["_Implements: src/c.js_"]) + task(4, "Docs", []), files);
    dated(p, files, Date.now() - 600000);
    const base = Date.now() + 2000; // after the feature's creation (the first window's start), inside the 5-min skew
    writeLog(p, [[TC, 0, base], ["npm run lint", 1, base + 500], [TC, 0, base + 1000]]);
    const run = { command: PASS, exitCode: 0 };
    const t1 = S.completeTask(p, f.slug, 1, run);
    const stFile = path.join(f.dir, ".state.json");
    const st = JSON.parse(fs.readFileSync(stFile, "utf8"));
    st.lastTickAt = new Date(base + 1500).toISOString(); // the tick, as of the log's clock
    fs.writeFileSync(stFile, js(st, null, 2));
    appendLog(p, [[TC, 0, base + 2000], [TC, 1, base + 3000], [TC, 1, base + 4000]]);
    const t2 = S.completeTask(p, f.slug, 2, run);
    S.completeTask(p, f.slug, 1, run); // a re-check after the tick: its run carries no snapshot
    const t3 = S.completeTask(p, f.slug, 3, "checked by hand"); // a note-only tick: no run, no snapshot
    const ev = JSON.parse(fs.readFileSync(stFile, "utf8")).evidence;
    const m = S.metrics(p, f.slug);
    const proj = S.metrics(p);
    const lines = S.metricsLines(m), projLines = S.metricsLines(proj);
    S.completeTask(p, f.slug, 2, undefined, { undo: true }); // 1.36 review 1 (FC-9): an undone tick is no tick
    const mUndone = S.metrics(p, f.slug).fastCheck;
    all("1.36 fast check: each tick counts the fast runs since the previous tick (2, then 3 with one clean), its snapshot on the tick's run (kept in the history past a re-check; none for a note-only tick); metrics {check, runs, clean, cleanRate, ticks, ticksClean} and the line; the project's fastTicks / fastTicksClean and its line; an undone task's tick no longer counts (review 1) (got " +
      js([t1.fastCheck, t2.fastCheck, t3.fastCheck, ev["1"].fast, (ev["1"].history || []).map((h) => h.fast), ev["3"].fast, m.fastCheck, proj.totals.fastTicks, proj.totals.fastTicksClean, mUndone]) + ")", {
      tick1: () => js(t1.fastCheck) === js({ check: "tc", status: "clean", runs: 2, clean: 2 }),
      tick2: () => js(t2.fastCheck) === js({ check: "tc", status: "failed", runs: 3, clean: 1 }) && t2.note === FC.tickNote(2, "tc", TC, "failed", false) && !/PowerShell/.test(t2.note),
      undone: () => js(mUndone) === js({ check: "tc", runs: 2, clean: 2, cleanRate: 100, ticks: 1, ticksClean: 1 }),
      onTheRun: () => js(ev["2"].fast) === js({ check: "tc", status: "failed", runs: 3, clean: 1 }) && ev["2"].history.some((h) => h.fast),
      recheckKeeps: () => ev["1"].fast === undefined && ev["1"].history.some((h) => js(h.fast) === js({ check: "tc", status: "clean", runs: 2, clean: 2 })),
      noteTick: () => t3.ok && t3.fastCheck && ev["3"].fast === undefined,
      metrics: () => js(m.fastCheck) === js({ check: "tc", runs: 5, clean: 3, cleanRate: 60, ticks: 2, ticksClean: 1 }),
      line: () => lines.includes(FC.metrics("tc", 5, 3, 60, 2, 1)),
      totals: () => proj.totals.fastTicks === 2 && proj.totals.fastTicksClean === 1 && projLines.includes(FC.metricsTotals(2, 1)),
      noTickNull: () => S.metrics(path.join(tmp, "proj-fc-clear"), "login").fastCheck === null,
    });
  }

  { // the offer (init, spec_upgrade): what the ROOT manifests suggest — offered, never set; none while one is set or right after off
    const mk = (name, files) => {
      const p = path.join(tmp, name);
      fs.mkdirSync(p, { recursive: true });
      for (const [rel, text] of Object.entries(files)) fs.writeFileSync(path.join(p, rel), typeof text === "string" ? text : js(text));
      return p;
    };
    const offerOf = (p, opts) => { const r = S.initProject(p, ["core"], "en", opts || {}); return r.fastCheckOffer || null; };
    const TS = { devDependencies: { typescript: "5.6.0" } };
    const pScript = mk("proj-fc-offer-script", { "package.json": { scripts: { typecheck: "tsc --noEmit" }, ...TS }, "tsconfig.json": "{}" });
    const o = {
      script: offerOf(pScript),
      pnpm: offerOf(mk("proj-fc-offer-pnpm", { "package.json": { scripts: { "type-check": "tsc -p ." }, ...TS }, "pnpm-lock.yaml": "" })),
      fixerScript: offerOf(mk("proj-fc-offer-fixer", { "package.json": { scripts: { typecheck: "eslint --fix ." }, ...TS }, "tsconfig.json": "{}" })),
      tsNoDep: offerOf(mk("proj-fc-offer-tsnodep", { "package.json": { scripts: { lint: "eslint ." } }, "tsconfig.json": "{}" })),
      tsDep: offerOf(mk("proj-fc-offer-tsdep", { "package.json": TS, "tsconfig.json": "{}" })),
      cargo: offerOf(mk("proj-fc-offer-cargo", { "Cargo.toml": "[package]\nname = \"x\"\n" })),
      go: offerOf(mk("proj-fc-offer-go", { "go.mod": "module x\n" })),
      ruff: offerOf(mk("proj-fc-offer-ruff", { "pyproject.toml": "[project]\nname = \"x\"\n\n[tool.ruff]\nline-length = 100\n" })),
      mypy: offerOf(mk("proj-fc-offer-mypy", { "mypy.ini": "[mypy]\n" })),
      nothing: offerOf(mk("proj-fc-offer-none", { "README.md": "# x\n" })),
      same: offerOf(mk("proj-fc-offer-same", { "package.json": { scripts: { typecheck: "tsc --noEmit" }, ...TS } }), { checks: { tsc: "npm run typecheck" } }),
      taken: offerOf(mk("proj-fc-offer-taken", { "package.json": { scripts: { typecheck: "tsc --noEmit" }, ...TS } }), { checks: { typecheck: "npm test" } }),
    };
    const neverSet = meta(pScript).fastCheck === undefined && meta(pScript).checks === undefined;
    const offAfter = S.initProject(pScript, [], null, { fastCheck: "off" });
    S.initProject(pScript, [], null, { checks: { typecheck: "npm run typecheck" }, fastCheck: "typecheck" });
    const whileSet = S.initProject(pScript, [], null, {});
    const upWhileSet = S.specUpgrade(pScript); // the offer's own rule (init skips it already): none while one is set
    const cmd = (x) => (x ? x.command : null);
    all("1.36 fast check: the offer — a package.json typecheck script (the lockfile's runner; never one that rewrites files), else tsconfig.json → npx tsc --noEmit only when typescript is a dependency, Cargo.toml → cargo check, go.mod → go vet ./..., [tool.ruff] → ruff check ., mypy.ini → mypy .; nothing → none; a check already running it is named, a name taken by another command → fast; never set, never while one is set nor right after off (got " +
      js(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && [v.name, v.command, v.from]]))) + ")", {
      script: () => cmd(o.script) === "npm run typecheck" && o.script.name === "typecheck" && o.script.from === 'package.json "typecheck"' &&
        o.script.note === FC.offer("npm run typecheck", 'package.json "typecheck"', "typecheck", false),
      pnpm: () => cmd(o.pnpm) === "pnpm run type-check",
      fixerScript: () => cmd(o.fixerScript) === "npx tsc --noEmit",
      tsNoDep: () => o.tsNoDep === null,
      tsDep: () => cmd(o.tsDep) === "npx tsc --noEmit" && o.tsDep.from === "tsconfig.json",
      cargo: () => cmd(o.cargo) === "cargo check", go: () => cmd(o.go) === "go vet ./...",
      ruff: () => cmd(o.ruff) === "ruff check ." && o.ruff.from === "pyproject.toml [tool.ruff]", mypy: () => cmd(o.mypy) === "mypy .",
      nothing: () => o.nothing === null,
      same: () => o.same && o.same.name === "tsc" && o.same.note === FC.offer("npm run typecheck", 'package.json "typecheck"', "tsc", true),
      taken: () => o.taken && o.taken.name === "fast",
      neverSet: () => neverSet,
      notAfterOff: () => offAfter.fastCheckOffer === undefined,
      notWhileSet: () => whileSet.fastCheckOffer === undefined && upWhileSet.ok && upWhileSet.fastCheckOffer === undefined,
    });
    // spec_upgrade carries it, and its UPGRADE.md lists it (the runnable line made portable: a committed file)
    const pu = mk("proj-fc-offer-upgrade", { "Cargo.toml": "[package]\nname = \"x\"\n" });
    S.initProject(pu, ["core"], "en");
    S.createFeature(pu, { name: "Login", tracks: ["core"] });
    const rm = JSON.parse(fs.readFileSync(rmFile(pu), "utf8"));
    delete rm.meta.specVersion; // a project of an earlier version: apply stamps it, so UPGRADE.md is written
    fs.writeFileSync(rmFile(pu), js(rm, null, 2));
    const audit = S.specUpgrade(pu);
    const applied = S.specUpgrade(pu, { apply: true });
    const md = (() => { try { return fs.readFileSync(path.join(pu, ".specs", "UPGRADE.md"), "utf8"); } catch { return ""; } })();
    all("1.36 fast check: spec_upgrade offers it (fastCheckOffer, never set) and UPGRADE.md lists it as an item, its CLI line portable (got " +
      js([audit.fastCheckOffer, applied.migrations && applied.migrations.report, md.slice(0, 200)]) + ")", {
      audit: () => cmd(audit.fastCheckOffer) === "cargo check" && meta(pu).fastCheck === undefined,
      md: () => md.includes("- [ ] " + S.portableCli(audit.fastCheckOffer.note)),
    });
  }
};
