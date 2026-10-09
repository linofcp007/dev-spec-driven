"use strict";
// The CLI's process I/O — a reader that closes stdout early (EPIPE), `version` / --version, per-command --help, stdin's hint.

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

// One CLI run whose stdout reader goes away after the first chunk (`… | head -1`): → { code, signal, err, bytes }.
function closedEarly(CLI, args, env) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [CLI, ...args], { stdio: ["ignore", "pipe", "pipe"], env });
    let err = "", bytes = 0;
    c.stderr.on("data", (d) => { err += d; });
    c.stdout.once("data", (d) => { bytes = d.length; c.stdout.destroy(); });
    c.on("close", (code, signal) => resolve({ code, signal, err, bytes }));
  });
}

exports.run = async ({ ok, all, run, tmp, CLI }) => {
  // 1.24 r6 B2: a stdout reader that stops early (`export --md | head -1`) ended in an unhandled 'error' (EPIPE) with a stack
  // trace and exit 1 — the CLI now ends quietly with the status the command set (as the MCP server does since 1.22).
  {
    const p = path.join(tmp, "r6b2-epipe");
    run(["init", "--project", p]);
    run(["create", "Login", "--project", p]);
    const req = path.join(p, ".specs", "login", "requirements.md");
    let s = "# Requirements: Login\n\n## User Stories\n\n### US-1 — sign in\n\n#### Acceptance Criteria\n";
    for (let i = 1; i <= 3000; i++) s += "- **US-1.AC-" + i + "** — WHEN the user signs in from device number " + i + " THE SYSTEM SHALL open a session for that device\n";
    fs.writeFileSync(req, s);
    const env = { ...process.env, SPEC_PROJECT_DIR: p };
    const full = spawnSync(process.execPath, [CLI, "export", "login", "--md", "--project", p], { encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
    const exp = await closedEarly(CLI, ["export", "login", "--md", "--project", p], env);
    const csv = await closedEarly(CLI, ["trace", "login", "--csv", "--project", p], env); // gaps: exit 1, kept
    ok(full.status === 0 && full.stdout.length > 200000 && exp.bytes > 0 && exp.code === 0 && !/EPIPE|Unhandled|at .*dev-spec\.js/.test(exp.err) &&
      csv.code === 1 && !/EPIPE|Unhandled|at .*dev-spec\.js/.test(csv.err),
      "1.24 r6 B2: a reader that closes stdout early (head -1) ends the CLI quietly — export --md exits 0, trace --csv keeps its exit 1 (gaps) — never an unhandled EPIPE with a stack trace (got " +
      JSON.stringify([full.status, full.stdout.length, exp, csv].map((x) => (x && x.err ? { ...x, err: x.err.slice(0, 200) } : x))) + ")");
  }

  // 1.24 r6 B-I1: `dev-spec version` (also --version / -V): the version, this CLI's path, Node, where the engine loaded from (its
  // modules, or the bundle — and why a requested bundle was skipped), the project, which input chose it, and its language.
  {
    const ROOT = path.join(path.dirname(CLI), "..");
    const pkgVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
    const pt = path.join(tmp, "r6i1-pt");
    run(["init", "--lang", "pt", "--project", pt]);
    const env0 = { ...process.env };
    for (const k of ["SPEC_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "DEV_SPEC_BUNDLE", "DEV_SPEC_BUNDLE_PATH"]) delete env0[k];
    const neutral = path.join(tmp, "r6i1-cwd");
    fs.mkdirSync(neutral, { recursive: true });
    const v = (args, env) => {
      const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: neutral, env: { ...env0, ...(env || {}) } });
      let j = null;
      try { j = JSON.parse(r.stdout); } catch { /* text */ }
      return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", j };
    };
    const human = v(["version", "--project", pt]), dash = v(["--version", "--project", pt]), short = v(["-V", "--project", pt]);
    const j = v(["version", "--json", "--project", pt]).j;
    const envJ = v(["--version", "--json"], { SPEC_PROJECT_DIR: pt }).j, cwdJ = v(["version", "--json"]).j;
    const missJ = v(["version", "--json"], { SPEC_PROJECT_DIR: path.join(tmp, "r6i1-nope") });
    const anywhere = v(["status", "login", "--version", "--project", pt]);
    all("1.24 r6 B-I1: version / --version / -V (anywhere) print the version, the CLI path, Node, the engine (modules), the project, its source and language (PT); --json the same as data; a missing project is reported, not refused (got " +
      JSON.stringify([human.code, human.out.slice(0, 400), j, envJ && envJ.project, cwdJ && cwdJ.project, missJ.code, missJ.j && missJ.j.project, anywhere.code]) + ")", [
      () => human.code === 0, () => human.out.includes(pkgVersion), () => human.out.includes(path.resolve(CLI).replace(/\\/g, "/")),
      () => /módulos/.test(human.out), () => /--project/.test(human.out), () => dash.stdout === human.stdout, () => short.stdout === human.stdout,
      () => anywhere.code === 0, () => anywhere.stdout === human.stdout, () => j, () => j.ok === true, () => j.version === pkgVersion,
      () => j.cli === path.resolve(CLI).replace(/\\/g, "/"), () => j.node === process.version, () => j.engine.source === "modules",
      () => j.engine.bundle.requested === false, () => j.project.dir === path.resolve(pt), () => j.project.source === "flag",
      () => j.project.exists === true, () => j.project.devSpec === true, () => j.project.lang === "pt", () => envJ,
      () => envJ.project.source === "SPEC_PROJECT_DIR", () => cwdJ, () => cwdJ.project.source === "cwd", () => cwdJ.project.devSpec === false,
      () => missJ.code === 0, () => missJ.j, () => missJ.j.project.exists === false, () => missJ.j.project.source === "SPEC_PROJECT_DIR",
    ]);

    // The bundle: used when current, else skipped with the reason — missing, another version, broken.
    const bfile = path.join(tmp, "r6i1-bundle", "spec.bundle.js");
    run(["bundle", "--out", bfile]);
    const other = path.join(tmp, "r6i1-bundle", "other.js"), broken = path.join(tmp, "r6i1-bundle", "broken.js");
    fs.writeFileSync(other, "module.exports = { stamp: { version: \"0.0.1\", files: [[\"i18n.js\", 1, 1]] }, load: () => null };\n");
    fs.writeFileSync(broken, "throw new Error('not a bundle');\n");
    const eng = (file) => { const r = v(["version", "--json"], { DEV_SPEC_BUNDLE: "1", DEV_SPEC_BUNDLE_PATH: file }); return (r.j && r.j.engine) || { bundle: {}, out: r.out.slice(0, 200) }; };
    const used = eng(bfile), miss = eng(path.join(tmp, "r6i1-bundle", "none.js")), oth = eng(other), brk = eng(broken), rel = eng("relative.js");
    const usedHuman = v(["version"], { DEV_SPEC_BUNDLE: "1", DEV_SPEC_BUNDLE_PATH: other });
    ok(used.source === "bundle" && used.bundle.file === bfile && used.bundle.skipped === null &&
      miss.source === "modules" && miss.bundle.requested === true && miss.bundle.skipped === "missing" &&
      oth.source === "modules" && oth.bundle.skipped === "other-version" && brk.source === "modules" && brk.bundle.skipped === "broken" &&
      rel.bundle.pathIgnored === true && usedHuman.code === 0 && /was skipped: it was built for another version/.test(usedHuman.out),
      "1.24 r6 B-I1: version reports the bundle it runs on (DEV_SPEC_BUNDLE=1) or why it was skipped — missing, other-version, broken; an unusable DEV_SPEC_BUNDLE_PATH is reported ignored (got " +
      JSON.stringify([used, miss, oth, brk, rel, usedHuman.out.slice(0, 300)]) + ")");
  }

  // 1.24 r6 B-I3: `<command> --help` / `-h` (and `help <command>`) print that command's lines of the help and its options (from
  // COMMAND_OPTIONS), never the whole help — and `status -h` no longer looked for a feature named "h".
  {
    const p = path.join(tmp, "r6i3-help");
    run(["init", "--project", p]);
    run(["create", "Login", "--project", p]);
    const h = (args) => run([...args, "--project", p]);
    const st = h(["status", "--help"]), stH = h(["status", "-h"]), done = h(["done", "login", "1", "-h"]), ap = h(["approve", "--help"]), apHelp = h(["help", "approve"]);
    const na = h(["na", "-h"]), whole = h(["-h"]), unknown = h(["frobnicate", "--help"]);
    const tasks = fs.readFileSync(path.join(p, ".specs", "login", "tasks.md"), "utf8");
    all("1.24 r6 B-I3: <command> --help / -h / help <command> print that command's help and its options (aliases too); status -h looks for no feature 'h'; -h alone and an unknown command still print the whole help (got " +
      JSON.stringify([st.out.slice(0, 300), stH.out === st.out, done.out.slice(0, 200), ap.out.slice(0, 200), na.out.slice(0, 120), whole.code]) + ")", [
      () => st.code === 0, () => /^ {2}status \[feature\]/m.test(st.out), () => !/universal spec-driven CLI/.test(st.out),
      () => !/^ {2}doctor/m.test(st.out), () => /--json/.test(st.out), () => stH.code === 0, () => stH.out === st.out, () => !/'h'/.test(stH.out),
      () => done.code === 0, () => /^ {2}done <feature> <n>/m.test(done.out), () => /--run/.test(done.out), () => /--timeout …/.test(done.out),
      () => !/- \[x\] 1\./.test(tasks), () => ap.code === 0, () => (ap.out.match(/^ {2}approve /gm) || []).length === 3,
      () => /--revoke/.test(ap.out), () => apHelp.out === ap.out, () => na.code === 0, () => /^ {2}next-action <feature>/m.test(na.out),
      () => whole.code === 0, () => /universal spec-driven CLI/.test(whole.out), () => unknown.code === 0,
      () => /universal spec-driven CLI/.test(unknown.out),
    ]);
  }

  // 1.24 r6 B-I9: an argument `-` reads stdin — from a terminal (a TTY) a one-line hint goes to stderr (type, then Ctrl+D /
  // Ctrl+Z Enter); piped input prints none. (A TTY can't be faked here: the piped side is what this asserts.)
  {
    const p = path.join(tmp, "r6i9-stdin");
    run(["init", "--project", p]);
    const r = spawnSync(process.execPath, [CLI, "ears", "-", "--project", p], { encoding: "utf8", input: "- **US-1.AC-1** — WHEN a user signs in THE SYSTEM SHALL open a session\n" });
    const S = require(path.join(path.dirname(CLI), "..", "mcp", "lib", "i18n.js"));
    const hints = ["en", "pt", "es", "pt-BR"].map((l) => S.msg(l).cliOutput.stdinHint);
    ok(r.status === 0 && /EARS: 1 criteria/.test(r.stdout) && r.stderr === "" && hints.every((x) => typeof x === "string" && /Ctrl\+D/.test(x)),
      "1.24 r6 B-I9: `ears -` with piped stdin prints no stdin hint (only a terminal gets it); the hint exists in every language (got " +
      JSON.stringify([r.status, r.stderr.slice(0, 120), hints]) + ")");
  }

  // 1.25.1 (review 7): terminal escape injection — task text / a _Verify:_ with raw ESC / OSC / C1 bytes reached the terminal (a cloned
  // tasks.md could show `$ npm test` while done --run ran something else). The human output loses every control character but tab and
  // line feed; --json keeps the value (a raw C1 / DEL written as its \u escape); done --run / finish --run refuse such a command
  // (nothing runs, code control-chars) and doctor fails verify-control.
  {
    const ESC = String.fromCharCode(27), BEL = String.fromCharCode(7), CSI1 = String.fromCharCode(0x9b), CR = String.fromCharCode(13);
    const p = path.join(tmp, "r7-ctl");
    run(["init", "--project", p]);
    run(["create", "Esc", "core", "--project", p]);
    const tasks = path.join(p, ".specs", "esc", "tasks.md");
    const evil = "node -e \"require('fs').writeFileSync('ran.txt','x')\" " + ESC + "[2K" + CR + "$ npm test";
    fs.writeFileSync(tasks, "# Tasks\n\n## Phase: Build\n- [ ] 1. [US1] Title " + ESC + "]0;pwned" + BEL + "done " + CSI1 + "31m\n  - _Verify: " + evil + "_\n- [ ] 2. [US1] Plain\n");
    const cli = (args) => spawnSync(process.execPath, [CLI, ...args, "--project", p], { encoding: "utf8" });
    const raw = (s) => [...String(s)].filter((ch) => { const c = ch.charCodeAt(0); return (c < 32 && c !== 9 && c !== 10 && c !== 13) || (c >= 0x7f && c <= 0x9f); }).length;
    const done = cli(["done", "esc", "1", "--run", "--json"]);
    let dj = null;
    try { dj = JSON.parse(done.stdout); } catch { dj = null; }
    const status = cli(["status", "esc"]);
    const next = cli(["next", "esc", "--json"]);
    let nj = null;
    try { nj = JSON.parse(next.stdout); } catch { nj = null; }
    const doc = cli(["doctor", "esc", "--json"]);
    let docj = null;
    try { docj = JSON.parse(doc.stdout); } catch { docj = null; }
    const vc = docj && docj.checks.find((c) => c.id === "verify-control");
    // a project check holding an ESC: spec_init refuses it, one stored by hand makes finish --run run nothing
    const initBad = cli(["init", "--check", "test=npm test" + ESC + "[2K"]);
    const rmPath = path.join(p, ".specs", "roadmap.json");
    const rm = JSON.parse(fs.readFileSync(rmPath, "utf8"));
    rm.meta = Object.assign(rm.meta || {}, { checks: { test: "node -e \"require('fs').writeFileSync('ran2.txt','x')\"" + ESC + "[2K" } });
    fs.writeFileSync(rmPath, JSON.stringify(rm, null, 2));
    const fin = cli(["finish", "esc", "--run", "--json"]);
    let fj = null;
    try { fj = JSON.parse(fin.stdout); } catch { fj = null; }
    const S = require(path.join(path.dirname(CLI), "..", "mcp", "lib", "i18n.js"));
    all("1.25.1 r7: no raw control character reaches the terminal — status prints the task text without ESC / OSC / C1 bytes, next --json keeps the value (C1 as \\u009b); done --run and finish --run refuse a command holding one (code control-chars, nothing ran), init --check refuses one, doctor fails verify-control (got " +
      JSON.stringify([done.status, dj && dj.code, fs.existsSync(path.join(p, "ran.txt")), raw(status.stdout + status.stderr), nj && raw(next.stdout), vc, initBad.status, fin.status, fj && fj.code]).slice(0, 600) + ")", [
      () => done.status === 1, () => dj, () => dj.code === "control-chars", () => /\\u001b/.test(dj.error),
      () => !fs.existsSync(path.join(p, "ran.txt")), () => status.status === 0, () => /Title/.test(status.stdout),
      () => raw(status.stdout + status.stderr) === 0, () => !/\r(?!\n)/.test(status.stdout), () => nj, () => nj.next,
      () => nj.next.text.includes(ESC), () => nj.next.text.includes(CSI1), () => raw(next.stdout) === 0, () => /\\u009b/.test(next.stdout), () => vc,
      () => vc.status === "fail", () => /\\u001b/.test(vc.detail), () => raw(doc.stdout) === 0, () => initBad.status === 1, () => fin.status === 1,
      () => fj, () => fj.code === "control-chars", () => /meta|test/.test(fj.error), () => !fs.existsSync(path.join(p, "ran2.txt")),
      () => ["pt", "es"].every((l) => /#1/.test(S.msg(l).verifyControl.doctor("#1")) && /x/.test(S.msg(l).verifyControl.run(1, "x")) && /t1/.test(S.msg(l).verifyControl.checks("t1"))),
    ]);
  }
};
