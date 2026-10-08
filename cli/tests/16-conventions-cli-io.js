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

exports.run = async ({ ok, run, tmp, CLI }) => {
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
    ok(human.code === 0 && human.out.includes(pkgVersion) && human.out.includes(path.resolve(CLI).replace(/\\/g, "/")) && /módulos/.test(human.out) && /--project/.test(human.out) &&
      dash.stdout === human.stdout && short.stdout === human.stdout && anywhere.code === 0 && anywhere.stdout === human.stdout &&
      j && j.ok === true && j.version === pkgVersion && j.cli === path.resolve(CLI).replace(/\\/g, "/") && j.node === process.version &&
      j.engine.source === "modules" && j.engine.bundle.requested === false && j.project.dir === path.resolve(pt) && j.project.source === "flag" &&
      j.project.exists === true && j.project.devSpec === true && j.project.lang === "pt" &&
      envJ && envJ.project.source === "SPEC_PROJECT_DIR" && cwdJ && cwdJ.project.source === "cwd" && cwdJ.project.devSpec === false &&
      missJ.code === 0 && missJ.j && missJ.j.project.exists === false && missJ.j.project.source === "SPEC_PROJECT_DIR",
      "1.24 r6 B-I1: version / --version / -V (anywhere) print the version, the CLI path, Node, the engine (modules), the project, its source and language (PT); --json the same as data; a missing project is reported, not refused (got " +
      JSON.stringify([human.code, human.out.slice(0, 400), j, envJ && envJ.project, cwdJ && cwdJ.project, missJ.code, missJ.j && missJ.j.project, anywhere.code]) + ")");

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
};
