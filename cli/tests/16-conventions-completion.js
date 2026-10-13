"use strict";
// Shell completion (1.25) — `completion <shell>` built from the CLI's own tables, the hidden `__complete` (feature names without the engine), zsh / fish when installed; bash and PowerShell at work: -bash / -pwsh.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const SHELLS = ["powershell", "bash", "zsh", "fish"];
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const fwd = (p) => p.split(path.sep).join("/");
// An environment where no variable names the project (the harness sets SPEC_PROJECT_DIR).
const cleanEnv = () => { const e = { ...process.env }; delete e.SPEC_PROJECT_DIR; delete e.CLAUDE_PROJECT_DIR; delete e.DEV_SPEC_BUNDLE; return e; };

// The words of every single-quoted token of a line ('…' with '\'' / '' / \' escapes per shell).
function quotedWords(line, shell) {
  const re = shell === "fish" ? /'((?:[^'\\]|\\.)*)'/g : shell === "powershell" ? /'((?:[^']|'')*)'/g : /'([^']*)'/g;
  return [...line.matchAll(re)].map((m) => (shell === "fish" ? m[1].replace(/\\(.)/g, "$1") : shell === "powershell" ? m[1].replace(/''/g, "'") : m[1]));
}
// A generated script → { commands, flags: {cmd: [flags]}, rows: {table: {key: words}} } — read the way each shell holds its tables.
function readScript(text, shell) {
  const out = { commands: [], rows: {} };
  const lines = text.split("\n");
  if (shell === "powershell") {
    out.commands = quotedWords(lines.find((l) => /^\s+Commands = @\(/.test(l)) || "", shell);
    let table = null;
    for (const l of lines) {
      const head = /^\s+(Flags|Args|Values) = @\{$/.exec(l);
      if (head) { table = head[1]; out.rows[table] = {}; continue; }
      if (table && /^\s+\}$/.test(l)) { table = null; continue; }
      if (table) { const w = quotedWords(l, shell); if (w.length === 2) out.rows[table][w[0]] = w[1]; }
    }
  } else if (shell === "fish") {
    out.commands = quotedWords(lines.find((l) => l.startsWith("set -g __dev_spec_commands ")) || "", shell)[0].split(" ");
    for (const [table, fn] of [["Flags", "__dev_spec_flags"], ["Args", "__dev_spec_arg"], ["Values", "__dev_spec_val"]]) {
      const keys = quotedWords(lines.find((l) => l.startsWith("set -g " + fn + "_keys ")) || "", shell);
      const vals = quotedWords(lines.find((l) => l.startsWith("set -g " + fn + "_vals ")) || "", shell);
      out.rows[table] = Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
    }
  } else {
    out.commands = (quotedWords(lines.find((l) => l.startsWith("__dev_spec_commands=") || l.startsWith("typeset -g __dev_spec_commands=")) || "", shell)[0] || "").split(" ");
    let table = null;
    for (const l of lines) {
      const head = /^(__dev_spec_flags|__dev_spec_arg|__dev_spec_val)\(\) \{$/.exec(l);
      if (head) { table = { __dev_spec_flags: "Flags", __dev_spec_arg: "Args", __dev_spec_val: "Values" }[head[1]]; out.rows[table] = {}; continue; }
      if (table && l === "}") { table = null; continue; }
      const row = table && /^\s+'([^']*)'\) __dev_spec_r='([^']*)' ;;$/.exec(l);
      if (row) out.rows[table][row[1]] = row[2];
    }
  }
  out.flags = Object.fromEntries(Object.entries(out.rows.Flags || {}).map(([k, v]) => [k, v.split(" ").filter(Boolean)]));
  return out;
}
// A shell that runs: the first of the candidates that answers --version.
const probe = (cands) => cands.filter(Boolean).find((b) => { try { return spawnSync(b, ["--version"], { encoding: "utf8", timeout: 20000 }).status === 0; } catch { return false; } });


// What every completion file starts from (16-conventions-completion-bash.js and -pwsh.js require it — one copy): the CLI's tables,
// the generated script of each shell asked for, a project with active, archived, hidden, reserved and hand-made folders (p), and a
// fake plugin cache — <cache>/m/dev-spec-driven/<version>/cli/dev-spec.js stubs that print their version as a feature name (and their
// argv as JSON otherwise): a script whose CLI path lies there follows the newest installed version (a plugin update).
exports.fixture = ({ runIn, tmp, CLI }, shells) => {
  const ROOT = path.join(path.dirname(CLI), "..");
  const S = require(path.join(ROOT, "mcp", "lib", "spec.js"));
  const cliFwd = fwd(path.resolve(CLI));
  const gen = (shell, env) => spawnSync(process.execPath, [CLI, "completion", shell], { encoding: "utf8", env: env || cleanEnv(), cwd: tmp });
  const scripts = {};
  for (const sh of shells) scripts[sh] = gen(sh);
  const p = path.join(tmp, "c125-proj");
  runIn(["init", "--project", p]);
  for (const n of ["Login", "Logout", "Billing", "Reports"]) runIn(["create", n, "--project", p]);
  runIn(["feature", "archive", "billing", "--project", p]);
  const sp = path.join(p, ".specs");
  for (const d of [".hidden", "_tmp", "My Notes", "exports", path.join("templates"), path.join("_archive", "old-thing"), path.join("_archive", ".x")]) fs.mkdirSync(path.join(sp, d), { recursive: true });
  fs.writeFileSync(path.join(sp, "templates", ".state.json"), "{}"); // a feature made before "templates" was reserved stays one
  fs.writeFileSync(path.join(sp, "notes.md"), "x");
  fs.mkdirSync(path.join(p, "src", "deep"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "c125-outside"), { recursive: true }); // a folder with no .specs/ (completion run outside a project)
  const cache =path.join(tmp, "c125-cache", "m", "dev-spec-driven");
  for (const v of ["1.9.0", "1.10.0", "1.2.0-rc1"]) {
    fs.mkdirSync(path.join(cache, v, "cli"), { recursive: true });
    fs.writeFileSync(path.join(cache, v, "cli", "dev-spec.js"), "const a = process.argv.slice(2); process.stdout.write(a[0] === '__complete' ? 'from-" + v.replace(/\./g, "-") + "' + String.fromCharCode(10) : JSON.stringify(a));");
  }
  const staleCli = fwd(path.join(cache, "1.0.0", "cli", "dev-spec.js")); // gone: a plugin update replaced its folder
  const withCli = (text, cli) => text.split(cliFwd).join(cli);
  return { ROOT, S, cliFwd, gen, scripts, p, cache, staleCli, withCli };
};
exports.helpers = { fwd, cleanEnv, probe };

exports.run = async ({ ok, all, remeasure, run, runIn, tmp, CLI }) => {
  const { ROOT, S, cliFwd, gen, scripts, p } = exports.fixture({ runIn, tmp, CLI }, SHELLS);
  const C = require(path.join(ROOT, "cli", "completion.js"));
  // The CLI's tables (1.27): its command table, cli/commands.js, and what it derives (COMMAND_OPTIONS, COMMAND_ARGS, FLAG_VALUES…).
  const T = require(path.join(ROOT, "cli", "commands.js"));

  // 1.25 completion: every shell's script holds every command (COMMAND_OPTIONS, + help and evals — every command and alias of the
  // CLI's table) and, for each command, every flag of its COMMAND_OPTIONS (+ --json --project --help): a new command or flag
  // completes with nothing else to touch. `__complete` (hidden) is no command of the list.
  {
    const want = [...new Set([...Object.keys(T.COMMAND_OPTIONS), "evals", "help"])];
    const cases = [...T.COMMAND_INDEX.keys()];
    const missing = {};
    for (const sh of SHELLS) {
      const r = scripts[sh];
      const s = readScript(r.stdout || "", sh);
      const miss = [];
      for (const c of want) {
        if (!s.commands.includes(c)) miss.push(c);
        const own = c === "evals" ? T.EVALS_SWITCHES : c === "help" ? [] : T.COMMAND_OPTIONS[c].options;
        for (const f of [...own, ...T.GLOBAL_OPTIONS]) if (!(s.flags[c] || []).includes("--" + f)) miss.push(c + " --" + f);
      }
      for (const c of cases) if (!s.commands.includes(c)) miss.push("case " + c);
      if (r.status !== 0 || r.stderr || s.commands.includes("__complete") || !r.stdout.includes(cliFwd)) miss.push("run: " + JSON.stringify([r.status, String(r.stderr).slice(0, 200)]));
      if (miss.length) missing[sh] = miss;
    }
    ok(want.length >= 50 && want.includes("completion") && cases.includes("completion") && !Object.keys(missing).length,
      "1.25 completion: each generated script (powershell / bash / zsh / fish) lists all " + want.length + " commands — every `case` of the CLI — and each command's COMMAND_OPTIONS flags + --json --project --help, names this CLI by its path, exit 0, nothing on stderr; __complete stays hidden (missing: " + JSON.stringify(missing).slice(0, 600) + ")");
  }

  // 1.25 completion: the values come from the facade (a new language, track, phase, import format… completes as it lands) and the
  // positionals from COMMAND_ARGS — the same tables in every shell.
  {
    const per = SHELLS.map((sh) => [sh, readScript(scripts[sh].stdout || "", sh).rows]);
    const words = (rows, table, key) => String((rows[table] || {})[key] || "").split(" ").filter(Boolean);
    const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
    const checks = per.map(([sh, rows]) => [sh, {
      lang: same(words(rows, "Values", "--lang"), S.LANGS),
      approve: same(words(rows, "Args", "approve#2"), S.PHASES) && same(words(rows, "Args", "approve#1"), ["@feature"]),
      addTrack: same(words(rows, "Args", "add-track#*"), S.OPTIONAL_TRACKS),
      init: same(words(rows, "Args", "init#*"), S.VALID_TRACKS),
      imports: same(words(rows, "Args", "import#1"), S.IMPORT_TOOLS) && S.IMPORT_TOOLS.includes("fluidplan"),
      restore: same(words(rows, "Args", "feature restore#2"), ["@archived"]) && same(words(rows, "Args", "feature flow#3"), S.FLOWS),
      sizes: same(words(rows, "Values", "create --size"), S.FEATURE_SIZES) && same(words(rows, "Values", "append-tasks --size"), Object.keys(S.SIZE_POINTS)),
      evidence: same(words(rows, "Values", "init --evidence"), ["reported", "observed"]) && !("done --evidence" in (rows.Values || {})),
      tracker: same(words(rows, "Values", "--tracker"), S.TRACKERS) && same(words(rows, "Values", "--approval-guard"), S.APPROVAL_GUARD_LEVELS),
      alias: same(words(rows, "Args", "na#1"), ["@feature"]) && same(words(rows, "Args", "milestones add#4"), []) && same(words(rows, "Args", "milestones add#*"), ["@feature"]),
      shells: same(words(rows, "Args", "completion#1"), SHELLS) && same(words(rows, "Args", "help#1"), ["@command"]),
    }]);
    const bad = checks.filter(([, c]) => !Object.values(c).every(Boolean));
    ok(!bad.length, "1.25 completion: values from the facade (--lang = LANGS, approve's phase = PHASES, add-track = OPTIONAL_TRACKS, init = VALID_TRACKS, import = IMPORT_TOOLS, sizes, trackers, guard levels), per-command values (init --evidence, never done's), sub-command positions (feature restore → archived names) and the aliases (na, milestones) in every shell (bad: " + JSON.stringify(bad) + ")");
  }

  // 1.25 completion: the command itself — no shell → usage (exit 1); an unknown one → refused naming the four; --json → a usage error
  // with nothing on stdout (text only); pwsh = powershell; it reads no project (a mistyped SPEC_PROJECT_DIR in a profile's
  // environment refuses nothing); `completion --help` gives the install lines with this CLI's path, PowerShell first.
  {
    const none = runIn(["completion"]), bad = runIn(["completion", "tcsh"]), j = spawnSync(process.execPath, [CLI, "completion", "bash", "--json"], { encoding: "utf8", env: cleanEnv() });
    const pw = gen("pwsh"), env = gen("bash", { ...cleanEnv(), SPEC_PROJECT_DIR: path.join(tmp, "c125-nope") });
    const help = runIn(["completion", "--help"]);
    all("1.25 completion: `completion` needs a shell (usage, exit 1), refuses another (naming powershell, bash, zsh, fish), refuses --json (stdout empty), takes pwsh for powershell, ignores a mistyped SPEC_PROJECT_DIR, and its --help gives the install lines with this CLI's path — PowerShell first (got " +
      JSON.stringify([none.code, none.out.slice(0, 120), bad.code, bad.out.slice(0, 160), j.status, j.stdout, pw.status, env.status, env.stderr, help.out.slice(0, 400)]) + ")", [
      () => none.code === 1, () => /completion <powershell\|bash\|zsh\|fish>/.test(none.out), () => bad.code === 1, () => /tcsh/.test(bad.out),
      () => /powershell, bash, zsh, fish/.test(bad.out), () => j.status === 1, () => j.stdout === "", () => /--json/.test(j.stderr),
      () => pw.status === 0, () => pw.stdout === scripts.powershell.stdout, () => env.status === 0, () => env.stdout === scripts.bash.stdout,
      () => help.code === 0, () => help.out.includes('node "' + cliFwd + '" completion powershell > "$HOME\\dev-spec-completion.ps1"'),
      () => /\$PROFILE/.test(help.out), () => help.out.indexOf("PowerShell") < help.out.indexOf("bash:"),
      () => /conf\.d\/dev-spec\.fish/.test(help.out), () => /compinit/.test(help.out),
    ]);
  }

  // 1.25 completion: the PowerShell script is pure ASCII (Windows PowerShell 5.1 reads a native command's output with the console's
  // code page) — a path or message with other characters is embedded as base64 and decodes back to the same text.
  {
    const model = { version: "9.9.9", cli: "C:/Users/José/plugins/cache/m/dev-spec-driven/9.9.9/cli/dev-spec.js", gone: "já não existe — ação",
      commands: ["status"], rootFlags: ["--json"], globalFlags: ["--json"], valueFlags: ["--project"], flags: {}, args: { status: ["@feature"] }, values: {}, sources: {} };
    const ps = C.script("powershell", model);
    const b64 = [...ps.matchAll(/FromBase64String\('([A-Za-z0-9+/=]+)'\)/g)].map((m) => Buffer.from(m[1], "base64").toString("utf8"));
    ok(/^[\x00-\x7f]*$/.test(scripts.powershell.stdout) && /^[\x00-\x7f]*$/.test(ps) && b64.includes(model.cli) && b64.includes(model.gone),
      "1.25 completion: the PowerShell script is ASCII-only; a non-ASCII CLI path or message rides as base64 that decodes back (got " + JSON.stringify(b64) + ")");
  }

  // ---- __complete: the feature names without the engine ------------------------------------------------------------------------

  // (the project: exports.fixture's p — active, archived, hidden, reserved and hand-made folders)
  const engineNames = (cwd, env, project) => {
    const code = "const S = require(" + JSON.stringify(path.join(ROOT, "mcp", "lib", "spec.js")) + "); const fs = require('fs'), path = require('path');" +
      "const d = S.resolveProjectDir(process.argv[1] || undefined); const a = path.join(d, '.specs', '_archive'); let ar = [];" +
      "try { ar = fs.readdirSync(a, { withFileTypes: true }).filter((x) => x.isDirectory() && S.isFeatureFolder(x.name, a)).map((x) => x.name).sort(); } catch {}" +
      "console.log(JSON.stringify({ features: S.listFeatures(d).features.map((f) => f.name).sort(), archived: ar }));";
    const r = spawnSync(process.execPath, ["-e", code, project || ""], { encoding: "utf8", cwd, env });
    try { return JSON.parse(r.stdout); } catch { return { error: r.stderr }; }
  };
  const fastNames = (cwd, env, extra) => {
    const one = (what) => spawnSync(process.execPath, [CLI, "__complete", what, ...(extra || [])], { encoding: "utf8", cwd, env });
    const f = one("features"), a = one("archived");
    return { features: f.stdout.split("\n").filter(Boolean), archived: a.stdout.split("\n").filter(Boolean), codes: [f.status, a.status], err: f.stderr + a.stderr };
  };

  // 1.25 completion: __complete agrees with the engine (resolveProjectDir + listFeatures, the _archive/ listing) on several layouts —
  // the project's folder, a subfolder (the nearest .specs/ above), SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR, an unexpanded variable
  // (falls through), --project / --project=, a folder with no .specs/, a hand-made empty .specs/ — and skips what listFeatures skips.
  {
    const outside = path.join(tmp, "c125-outside");
    const handMade = path.join(tmp, "c125-handmade");
    fs.mkdirSync(outside, { recursive: true });
    fs.mkdirSync(path.join(handMade, ".specs"), { recursive: true });
    const env0 = cleanEnv();
    const cases = [
      ["project folder", p, env0],
      ["subfolder", path.join(p, "src", "deep"), env0],
      ["SPEC_PROJECT_DIR", outside, { ...env0, SPEC_PROJECT_DIR: p }],
      ["CLAUDE_PROJECT_DIR", outside, { ...env0, CLAUDE_PROJECT_DIR: p }],
      ["unexpanded", path.join(p, "src"), { ...env0, SPEC_PROJECT_DIR: "${CLAUDE_PROJECT_DIR}/x" }],
      ["--project", outside, env0, p],
      ["no .specs", outside, env0],
      ["hand-made .specs", handMade, env0],
    ];
    const diffs = [];
    for (const [label, cwd, env, project] of cases) {
      const e = engineNames(cwd, env, project);
      const f = fastNames(cwd, env, project ? ["--project", project] : []);
      if (JSON.stringify([e.features, e.archived]) !== JSON.stringify([f.features, f.archived]) || f.codes.some((c) => c !== 0) || f.err) diffs.push({ label, engine: e, fast: f });
    }
    const eq = fastNames(outside, env0, ["--project=" + p]);
    const listed = fastNames(p, env0);
    ok(!diffs.length && JSON.stringify(eq.features) === JSON.stringify(listed.features) &&
      ["login", "logout", "reports", "templates"].every((n) => listed.features.includes(n)) && !listed.features.some((n) => /^[._]|My Notes|exports|steering|billing/.test(n)) &&
      JSON.stringify(listed.archived) === JSON.stringify(["billing", "old-thing"]),
      "1.25 completion: __complete features / archived list the names the engine lists (resolveProjectDir + listFeatures + _archive/) on 8 layouts — project, subfolder, SPEC_PROJECT_DIR, CLAUDE_PROJECT_DIR, an unexpanded variable, --project (and --project=), no .specs/, a hand-made empty .specs/ — never a dot / _ / reserved / non-slug folder (diffs: " +
      JSON.stringify(diffs).slice(0, 800) + "; listed: " + JSON.stringify(listed) + ")");
  }

  // 1.25 completion: __complete never errs (an unknown word, no word, a second word, a missing project: nothing, exit 0), never loads a
  // module of mcp/lib but the engine-free project probe (1.27: mcp/lib/probe.js — a preload lists the loaded modules at exit), and costs
  // about node's own startup — well under a command that loads the engine (medians of 5; bounded relative to `node -e 0` measured here,
  // as testing.md asks).
  {
    const env0 = cleanEnv();
    const q = (args, cwd) => spawnSync(process.execPath, [CLI, "__complete", ...args], { encoding: "utf8", cwd: cwd || p, env: env0 });
    const odd = [q(["nope"]), q([]), q(["features", "extra"]), q(["features", "--project", path.join(tmp, "c125-missing")])];
    const pre = path.join(tmp, "c125-preload.js");
    fs.writeFileSync(pre, "process.on('exit', () => { const sep = String.fromCharCode(92); const m = Object.keys(require.cache).filter((f) => f.split(sep).join('/').includes('/mcp/lib/') && !f.split(sep).join('/').endsWith('/mcp/lib/probe.js')); process.stderr.write('LOADED ' + JSON.stringify(m)); });");
    const pl = spawnSync(process.execPath, ["-r", pre, CLI, "__complete", "features"], { encoding: "utf8", cwd: p, env: env0 });
    const time = (args) => { const t0 = process.hrtime.bigint(); spawnSync(process.execPath, args, { cwd: p, env: env0 }); return Number(process.hrtime.bigint() - t0) / 1e6; };
    const node0 = [], fast = [], list = [];
    for (let i = 0; i < 5; i++) { node0.push(time(["-e", "0"])); fast.push(time([CLI, "__complete", "features"])); list.push(time([CLI, "list"])); }
    const [n, f, l] = [median(node0), median(fast), median(list)];
    ok(odd.every((r) => r.status === 0 && r.stdout === "" && r.stderr === "") && /LOADED \[\]$/.test(pl.stderr) && pl.stdout.split("\n").includes("login") &&
      f < l && f <= Math.max(250, 2.5 * n),
      "1.25 completion: __complete answers nothing (exit 0) to an unknown / missing / extra word or a missing project, loads no mcp/lib module but the probe, and takes " + Math.round(f) +
      " ms (node -e 0: " + Math.round(n) + " ms; `list`, which loads the engine: " + Math.round(l) + " ms) (got " + JSON.stringify([odd.map((r) => [r.status, r.stdout, r.stderr]), pl.stderr.slice(-300)]) + ")");
  }

  // ---- the scripts at work: bash in 16-conventions-completion-bash.js, PowerShell in 16-conventions-completion-pwsh.js (1.30 — this
  // file ran them all in one process: the CLI suite's critical path) ---------------------------------------------------------------

  // 1.25 completion: zsh and fish — their scripts are balanced (every block closed) and register the completion; run for real where
  // the shell is installed (zsh: the function with compadd / compset stubbed; fish: `complete -C`).
  {
    const z = scripts.zsh.stdout, f = scripts.fish.stdout;
    const count = (t, re) => (t.match(re) || []).length;
    const zCode = z.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n"); // comments aside
    const zBal = count(zCode, /\bif\b/g) === count(zCode, /\bfi\b/g) && count(zCode, /\bcase\b/g) === count(zCode, /\besac\b/g) &&
      count(zCode, /\{/g) === count(zCode, /\}/g) && /compdef _dev_spec dev-spec/.test(z) && /^_dev_spec\(\) \{$/m.test(z);
    const fOpen = count(f, /^\s*(?:function|if|for|while|switch|begin)\b/gm), fEnd = count(f, /^\s*end\b/gm);
    const fBal = fOpen === fEnd && /^complete -c dev-spec -f -a '\(__dev_spec_complete\)'$/m.test(f) && /^function __dev_spec_complete$/m.test(f);
    ok(zBal && fBal, "1.25 completion: the zsh script is balanced (case/esac, braces) and calls compdef _dev_spec dev-spec; the fish script closes every block (" + fOpen + " / " + fEnd + ") and registers complete -c dev-spec");
    const zsh = probe([process.env.DEV_SPEC_TEST_ZSH, "zsh"]);
    if (!zsh) ok(true, "1.25 completion: zsh at work — skipped (no zsh here; set DEV_SPEC_TEST_ZSH)");
    else {
      const file = path.join(tmp, "c125-c.zsh"), drive = path.join(tmp, "c125-drive.zsh");
      fs.writeFileSync(file, z);
      fs.writeFileSync(drive, [
        "compadd() { [[ $1 == -- ]] && shift; print -r -- \"${IPREFIX}|$*\"; }",
        "compset() { if [[ $1 == -P && $PREFIX == ${~2}* ]]; then local m=${(M)PREFIX#${~2}}; IPREFIX+=$m; PREFIX=${PREFIX#$m}; return 0; fi; return 1; }",
        "_files() { print -r -- \"FILES $*\"; }",
        "compdef() { :; }",
        ". $1",
        "t() { words=(\"$@\"); CURRENT=$#; PREFIX=${words[CURRENT]}; IPREFIX=; _dev_spec; }",
        "t dev-spec status lo; t dev-spec init --lang=p; t dev-spec feature restore ''; t dev-spec create x --tracks tdd,s; t dev-spec scan ''",
      ].join("\n") + "\n");
      const r = spawnSync(zsh, ["-f", drive, file], { encoding: "utf8", cwd: p, env: cleanEnv() });
      const got = r.stdout.split("\n");
      ok(got[0] === "|login logout reports templates" && got[1] === "--lang=|en pt es pt-BR" && got[2] === "|billing old-thing" && got[3] === "tdd,|" + S.VALID_TRACKS.join(" ") && got[4] === "FILES -/",
        "1.25 completion: zsh — feature names, --lang= values (the prefix set aside), archived names, a track list's last item, directories for scan (got " + JSON.stringify([got.slice(0, 5), r.stderr.slice(0, 300)]) + ")");
    }
    const fish = probe([process.env.DEV_SPEC_TEST_FISH, "fish"]);
    if (!fish) ok(true, "1.25 completion: fish at work — skipped (no fish here; set DEV_SPEC_TEST_FISH)");
    else {
      const file = path.join(tmp, "c125-c.fish"), drive = path.join(tmp, "c125-drive.fish");
      fs.writeFileSync(file, f);
      fs.writeFileSync(drive, "source $argv[1]\nfor l in 'dev-spec status lo' 'dev-spec init --lang=p' 'dev-spec feature restore ' 'dev-spec create x --tracks tdd,s' 'dev-spec help ap'\n" +
        "    set -l got (complete -C\"$l\" | string replace -r -- '\\t.*' '')\n    string join -- ' ' $got '.'\nend\n");
      const r = spawnSync(fish, [drive, file], { encoding: "utf8", cwd: p, env: cleanEnv() });
      const got = r.stdout.split("\n");
      ok(got[0] === "login logout ." && got[1] === "--lang=pt --lang=pt-BR ." && got[2] === "billing old-thing ." && got[3] === "tdd,saas tdd,sec ." && got[4] === "append-tasks approve .",
        "1.25 completion: fish — complete -C gives feature names, --lang= values, archived names, a track list's last item, commands (got " + JSON.stringify([got.slice(0, 5), r.stderr.slice(0, 300)]) + ")");
    }
  }
};