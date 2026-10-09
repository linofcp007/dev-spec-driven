"use strict";
// The CLI's modules (1.27) — the command table (every command has its help and completes), cli/git.js alone, main(argv, io) in-process (no process.exit, the environment restored, synchronous unless it waits; runIn = run).

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, all, eq, run, runIn, spawnIn, tmp, CLI, __dirname }) => {
  const T = require(path.join(__dirname, "commands.js"));
  const MAIN = require(path.join(__dirname, "main.js"));
  const S = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = JSON.stringify;

  // ---- the command table -----------------------------------------------------------------------------------------------------

  // 1.27 table: every entry is a whole command — a name, a handler, its help (`help` aside: it prints the help) whose lines start
  // with the command at two spaces (continuation lines indented), options that are each a value flag (VALUE_FLAG_SPECS) or one of the
  // engine's switches (spec.CLI_SWITCHES — never both, never a global one), completion specs whose first word picks a `sub`.
  {
    const switches = S.CLI_SWITCHES;
    const bad = [];
    const names = new Set();
    for (const e of T.COMMANDS) {
      if (!/^[a-z][a-z-]*$/.test(e.name) || typeof e.run !== "function") bad.push(e.name + ": name / run");
      for (const n of [e.name, ...(e.aliases || [])]) { if (names.has(n)) bad.push(n + ": twice"); names.add(n); }
      if (e.name !== "help") {
        const lines = typeof e.help === "string" ? e.help.split("\n") : [];
        if (!lines.length || !new RegExp("^ {2}" + e.name.replace(/-/g, "\\-") + "(?=[\\s(]|$)").test(lines[0])) bad.push(e.name + ": help's first line");
        lines.slice(1).forEach((l, i) => { if (!/^ {3,}\S/.test(l) && !new RegExp("^ {2}" + e.name + "(?=[\\s(]|$)").test(l)) bad.push(e.name + ": help line " + (i + 2)); });
      }
      for (const o of e.options || []) {
        const value = T.VALUE_FLAGS.has(o), sw = switches.has(o);
        if (value === sw || T.GLOBAL_OPTIONS.includes(o)) bad.push(e.name + " --" + o + (value && sw ? ": a value flag AND a switch" : value || sw ? ": global" : ": neither a value flag nor a switch"));
      }
      if (new Set(e.options || []).size !== (e.options || []).length) bad.push(e.name + ": an option twice");
      const takesValue = (k) => T.VALUE_FLAGS.has(k) || (!!e.completeFlags && T.EVALS_VALUE_FLAGS.has(k)); // evals: run-evals.js's value flags
      for (const k of Object.keys(e.values || {})) if (!takesValue(k) || !(e.options || e.completeFlags || []).includes(k)) bad.push(e.name + " values --" + k);
      for (const k of Object.keys(e.bounds || {})) if (!(e.options || []).includes(k)) bad.push(e.name + " bounds --" + k);
      if (e.sub && !(e.args && e.args[0])) bad.push(e.name + ": sub without a first-word spec");
      for (const w of Object.keys(e.sub || {})) if (!String(e.args[0]).split(" ").includes(w) && !String(e.args[0]).startsWith("@")) bad.push(e.name + " sub " + w);
    }
    const unread = [...T.REPEATABLE_FLAGS].filter((k) => !T.COMMANDS.some((e) => (e.options || []).includes(k)));
    all("1.27 table: every command has a name, a handler and its help (two spaces + its name, continuation lines indented); each option is a value flag or an engine switch, once; values / bounds / sub name its own options and words; every repeatable flag is some command's (bad: " +
      js(bad.concat(unread)) + ")", {
      commands: T.COMMANDS.length >= 50, noBad: !bad.length, repeatable: !unread.length,
      helpOnlyForHelp: T.COMMANDS.filter((e) => !e.help).map((e) => e.name).join() === "help",
      aliases: js(T.HELP_ALIASES) === js({ na: "next-action", milestones: "milestone" }),
    });
  }

  // 1.27 table: the help is the table's — helpText() is the head, every entry's lines in order, the foot; `help <command>` (helpFor)
  // prints exactly the lines the pre-1.27 rule cut out of that text (every line whose first word is the command, with its
  // continuation lines), so the per-command help stayed byte for byte; the CLI prints helpText() for `help`.
  {
    const text = T.helpText();
    const cut = (name) => { // the 1.24 r6 B-I3 rule, on the whole text
      const block = [];
      let take = false;
      for (const l of text.split("\n")) {
        const m = /^ {2}([a-z][a-z-]*)(?=[\s(]|$)/.exec(l);
        if (m) take = m[1] === name;
        else if (!/^ {3,}\S/.test(l)) take = false;
        if (take) block.push(l);
      }
      return block.join("\n");
    };
    const differ = T.COMMANDS.filter((e) => e.help && cut(e.name) !== e.help).map((e) => e.name);
    const fakeCtx = { projectText: () => ({ cmdHelp: { options: (x) => "OPTIONS " + x, none: "NONE", global: "GLOBAL", all: "ALL" } }) };
    const ap = T.helpFor(fakeCtx, "approve"), na = T.helpFor(fakeCtx, "na"), ev = T.helpFor(fakeCtx, "evals");
    const printed = runIn(["help"]);
    all("1.27 table: helpText() is the table's help in order; each command's lines are exactly what the pre-1.27 cut took from it; help <command> adds its options (an alias its command's); `help` prints it (differ: " + js(differ) + ")", {
      head: text.startsWith("dev-spec — universal spec-driven CLI (local, zero-dependency)\n\n  classify "), foot: /\n\n {2}The project: --project <dir>/.test(text) && text.endsWith("or a plain shell."),
      blocks: !differ.length, approve: ap.startsWith("dev-spec approve\n" + T.commandFor("approve").help + "\n\nOPTIONS --by …  --force  --role …") && /\nGLOBAL\nALL$/.test(ap),
      alias: na.startsWith("dev-spec next-action\n") && /\nNONE\nGLOBAL/.test(na), evals: !/OPTIONS|NONE/.test(ev), unknown: T.helpFor(fakeCtx, "nope") === text && T.helpFor(fakeCtx, "help") === text,
      printed: printed.code === 0 && printed.out === text + "\n",
    });
  }

  // 1.27 table: every command and alias completes — the completion model (what `completion <shell>` fills its script with) lists it
  // with its options (+ the global ones; evals: run-evals.js's flags), and its positional / per-command value specs.
  {
    const model = T.completionModel({ projectText: () => S.msg("en").cliOutput });
    const miss = [];
    for (const [n, e] of T.COMMAND_INDEX) {
      if (!model.commands.includes(n)) miss.push(n);
      for (const f of [...(e.completeFlags || e.options || []), ...T.GLOBAL_OPTIONS]) if (!(model.flags[n] || []).includes("--" + f)) miss.push(n + " --" + f);
      if (e.args && js(model.args[n]) !== js(e.args)) miss.push(n + " args");
      for (const [w, s] of Object.entries(e.sub || {})) if (js(model.args[n + " " + w]) !== js(s)) miss.push(n + " " + w);
      for (const [k, v] of Object.entries(e.values || {})) if (model.values[e.name + " --" + k] !== v) miss.push(n + " --" + k + " values");
    }
    const scripts = ["bash", "powershell"].map((sh) => runIn(["completion", sh]));
    all("1.27 table: the completion model lists every command and alias of the table with its flags, positionals and values; the scripts build (missing: " + js(miss) + ")", {
      complete: !miss.length, count: model.commands.length === T.COMMAND_INDEX.size, noHidden: !model.commands.includes("__complete"),
      scripts: scripts.every((r) => r.code === 0 && r.out.includes("approve")),
    });
  }

  // ---- cli/git.js ---------------------------------------------------------------------------------------------------------------

  // 1.27 git.js: ONE environment for every call — GIT_OPTIONAL_LOCKS=0, GIT_TERMINAL_PROMPT=0, the rest the caller's, nothing changed in
  // place; git that cannot run (here: a working folder that doesn't exist) is an error, never a throw: gitRun ok false, gitText null.
  {
    const G = require(path.join(__dirname, "git.js"));
    const base = { A: "1", GIT_OPTIONAL_LOCKS: "1" };
    const env = G.gitEnv(base);
    const gone = path.join(tmp, "git-mod-no-such-folder");
    const noGit = G.gitRun(["--version"], { cwd: gone });
    all("1.27 git.js: gitEnv adds GIT_OPTIONAL_LOCKS=0 and GIT_TERMINAL_PROMPT=0 to the caller's environment (a copy); git that can't start answers ok: false with the error, gitText null (got " +
      js([env, noGit.ok, noGit.status, noGit.error && noGit.error.code]) + ")", {
      env: env.GIT_OPTIONAL_LOCKS === "0" && env.GIT_TERMINAL_PROMPT === "0" && env.A === "1" && base.GIT_OPTIONAL_LOCKS === "1",
      limits: G.GIT_MAX_BUFFER === 64 * 1024 * 1024 && G.GIT_TIMEOUT_MS === 30000,
      noGit: noGit.ok === false && !!noGit.error, noGitText: G.gitText(["--version"], { cwd: gone }) === null, noFacts: G.branchFacts(gone) === undefined,
    });
  }

  // 1.27 git.js: in a repository — gitRun / gitText read git's answer; gitState is the short commit and whether the tree is dirty
  // OUTSIDE .specs/; branchFacts the branch, the commit, exists(); a large answer (3 MB, past spawnSync's default 1 MB) is read whole;
  // outside a work tree: ok false (exit status, no error), gitState {}, branchFacts {repo: false}.
  {
    const G = require(path.join(__dirname, "git.js"));
    if (spawnSync("git", ["--version"], { encoding: "utf8" }).status !== 0) ok(true, "1.27 git.js in a repository — skipped: no git");
    else {
      const repo = path.join(tmp, "git-mod-repo");
      fs.mkdirSync(repo, { recursive: true });
      const git = (...a) => spawnSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "commit.gpgsign=false", ...a], { cwd: repo, encoding: "utf8" });
      git("init", "-q");
      fs.writeFileSync(path.join(repo, "a.txt"), "a\n");
      git("add", "-A");
      git("commit", "-q", "-m", "first");
      const inside = G.gitRun(["rev-parse", "--is-inside-work-tree"], { cwd: repo });
      const clean = G.gitState(repo);
      fs.mkdirSync(path.join(repo, ".specs"), { recursive: true });
      fs.writeFileSync(path.join(repo, ".specs", "x.json"), "{}");
      const specsOnly = G.gitState(repo);
      fs.writeFileSync(path.join(repo, "a.txt"), "changed\n");
      const dirty = G.gitState(repo);
      const facts = G.branchFacts(repo);
      const big = path.join(repo, "big.txt");
      fs.writeFileSync(big, "y".repeat(3 * 1024 * 1024));
      const sha = String(G.gitText(["hash-object", "-w", "big.txt"], { cwd: repo }) || "").trim();
      const blob = G.gitText(["cat-file", "-p", sha], { cwd: repo });
      const outside = path.join(tmp, "git-mod-outside");
      fs.mkdirSync(outside, { recursive: true });
      // (tmp itself may sit inside a work tree on some machines: outside is only asserted when git agrees it is outside one)
      const out = G.gitRun(["rev-parse", "--is-inside-work-tree"], { cwd: outside });
      const isOutside = out.status !== 0;
      all("1.27 git.js: in a repository gitRun / gitText read git, gitState = {commit, dirty} (.specs/ ignored), branchFacts the branch and commit, a 3 MB answer read whole; outside one ok false, {} and {repo: false} (got " +
        js([inside.stdout, clean, specsOnly, dirty, facts && [facts.repo, facts.base, facts.commit], blob && blob.length, out.status]) + ")", {
        inside: inside.ok && inside.stdout.trim() === "true" && inside.error === null,
        clean: /^[0-9a-f]{4,40}$/.test(clean.commit) && clean.dirty === false, specsIgnored: specsOnly.dirty === false, dirty: dirty.dirty === true,
        facts: facts.repo === true && !!facts.base && /^[0-9a-f]{40}$/.test(facts.commit) && facts.exists(facts.base) === true && facts.exists("no-such-branch") === false,
        big: typeof blob === "string" && blob.length === 3 * 1024 * 1024,
        outside: !isOutside || (out.ok === false && out.error === null && js(G.gitState(outside)) === "{}" && G.branchFacts(outside).repo === false),
      });
    }
  }

  // ---- main(argv, io) in-process --------------------------------------------------------------------------------------------------

  // 1.27 main: a call never exits the process — a usage error, a refusal (fail), an engine exception, an unknown command and --json
  // all END the call with their code (process.exit is never reached); the environment and the working folder it was given are the
  // process's for the call and restored after it, whatever ended it.
  {
    const p = path.join(tmp, "main-mod");
    runIn(["init", "--project", p]);
    runIn(["create", "Login", "--project", p]);
    const realExit = process.exit;
    const exits = [];
    process.exit = (c) => { exits.push(c); throw new Error("process.exit(" + c + ") called"); };
    const envNow = () => js(Object.entries(process.env).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
    const envBefore = envNow(), cwdBefore = process.cwd();
    let rs;
    try {
      const other = path.join(tmp, "main-mod-cwd");
      fs.mkdirSync(other, { recursive: true });
      rs = [
        spawnIn(["status", "login", "--rnu", "--project", p]), // unknown flag
        spawnIn(["status", "nope", "--project", p]), // a refusal
        spawnIn(["status", "nope", "--json", "--project", p]), // the refusal as JSON, exit 1
        spawnIn(["frobnicate", "--project", p]), // unknown command
        spawnIn(["done", "login", "x", "--json", "--project", p]), // an argument error
        spawnIn(["list"], { env: { ...process.env, SPEC_PROJECT_DIR: p, MAIN_MOD_PROBE: "1" }, cwd: other }),
        spawnIn(["version", "--json"], { env: { ...process.env, SPEC_PROJECT_DIR: "" }, cwd: other }),
        spawnIn(["list"], { env: { ...process.env, MAIN_MOD_PROBE: "2" }, cwd: path.join(tmp, "main-mod-no-such-folder") }), // can't be entered
      ];
    } finally {
      process.exit = realExit;
    }
    let j2 = null, j4 = null, v6 = null;
    try { j2 = JSON.parse(rs[2].stdout); } catch { /* not JSON */ }
    try { j4 = JSON.parse(rs[4].stdout); } catch { /* not JSON */ }
    try { v6 = JSON.parse(rs[6].stdout); } catch { /* not JSON */ }
    all("1.27 main: in-process calls end with their exit code — never process.exit — and leave process.env and the working folder as they found them (got " +
      js([exits, rs.map((r) => [r.status, r.stdout.slice(0, 60), r.stderr.slice(0, 80)])]) + ")", {
      noExit: !exits.length, unknownFlag: rs[0].status === 1 && /did you mean --run/.test(rs[0].stderr), refusal: rs[1].status === 1 && /not found/.test(rs[1].stderr) && rs[1].stdout === "",
      json: rs[2].status === 1 && j2 && j2.ok === false, unknownCommand: rs[3].status === 1 && /frobnicate/.test(rs[3].stderr),
      argError: rs[4].status === 1 && j4 && j4.code === "invalid-arguments", list: rs[5].status === 0 && /login/.test(rs[5].stdout),
      // the working folder given: the project resolved from it (it, or a dev-spec project above it)
      cwd: rs[6].status === 0 && v6 && (v6.project.source === "cwd" ? v6.project.dir === path.resolve(tmp, "main-mod-cwd") : v6.project.source === "nearest"),
      badCwd: rs[7].status === 1 && /^dev-spec: .*main-mod-no-such-folder/.test(rs[7].stderr) && rs[7].stdout === "",
      envRestored: envNow() === envBefore && !("MAIN_MOD_PROBE" in process.env), cwdRestored: process.cwd() === cwdBefore,
    });
  }

  // 1.27 main: synchronous unless the command waits — io.done(code) is called before main returns; done --run (its commands run with a
  // timer) settles later, through the promise, with the same result as a spawned run; stdin given as a string is read at once.
  {
    const p = path.join(tmp, "main-mod-async");
    runIn(["init", "--project", p]);
    runIn(["create", "Login", "--project", p]);
    fs.writeFileSync(path.join(p, ".specs", "login", "tasks.md"), "# Tasks\n\n## Phase: Build\n- [ ] 1. [US1] A\n  - _Verify: node -e \"console.log(41 + 1)\"_\n- [ ] 2. [US1] B\n");
    const sink = (to) => ({ write: (s) => { to.push(String(s)); return true; } });
    const call = (args, input) => {
      const out = [], err = [];
      let code;
      const promise = MAIN.main(args, { stdout: sink(out), stderr: sink(err), stdin: input, env: { ...process.env, SPEC_PROJECT_DIR: p }, cwd: process.cwd(), done: (c) => { code = c; } });
      return { promise, syncCode: code, out, err };
    };
    const sync = call(["status", "login"]);
    const later = call(["done", "login", "1", "--run"]);
    const laterCode = await later.promise;
    const piped = call(["ears", "-"], "- **US-1.AC-1** — WHEN a user signs in THE SYSTEM SHALL open a session\n");
    // task 2 has no _Verify:_: done --run refuses it before anything runs — synchronously, so spawnIn answers it; a run that would
    // wait (task 1's, ticked again) is refused by spawnIn itself, which says so (the run still ends on its own; this file waits for it)
    const refused = spawnIn(["done", "login", "2", "--run", "--project", p]);
    let threw = null;
    try { spawnIn(["done", "login", "1", "--run", "--project", p]); } catch (e) { threw = e.message; }
    await new Promise((r) => setTimeout(r, 1500));
    all("1.27 main: a synchronous command is done when main returns (io.done called), done --run settles through its promise (exit 0, the run's output, task 1 verified), stdin as a string is read at once; spawnIn answers a refusal made before any run and refuses a call that waits (got " +
      js([sync.syncCode, later.syncCode, laterCode, later.out.join(""), piped.syncCode, piped.out.join(""), refused.status, threw]) + ")", {
      sync: sync.syncCode === 0 && /login/.test(sync.out.join("")), async: later.syncCode === undefined && laterCode === 0 && /\$ node -e/.test(later.out.join("")) && /42/.test(later.out.join("")),
      ticked: /- \[x\] 1\./.test(fs.readFileSync(path.join(p, ".specs", "login", "tasks.md"), "utf8")),
      piped: piped.syncCode === 0 && /1 criteria, 1 with modal, verdict=pass/.test(piped.out.join("")),
      refusedSync: refused.status === 1 && /_Verify/.test(refused.stderr), waits: typeof threw === "string" && /waits/.test(threw),
    });
  }

  // 1.27 runIn = run: the same { out, code } in-process as from a spawned CLI — the help, a listing, a refusal, a usage error with
  // --json, a PT project's localized output.
  {
    const p = path.join(tmp, "main-mod-parity");
    run(["init", "--lang", "pt", "--project", p]);
    run(["create", "Pagamentos", "--project", p]);
    const cases = [["help"], ["approve", "--help"], ["list", "--project", p], ["status", "pagamentos", "--project", p], ["status", "nope", "--json", "--project", p],
      ["done", "pagamentos", "--json", "--project", p], ["doctor", "pagamentos", "--project", p], ["next", "pagamentos", "--max", "50", "--project", p], ["mcp-config", "cursor"]];
    const diff = cases.map((a) => [a, run(a), runIn(a)]).filter(([, x, y]) => x.out !== y.out || x.code !== y.code).map(([a, x, y]) => [a.join(" "), x.code, y.code, x.out.slice(0, 120), y.out.slice(0, 120)]);
    ok(!diff.length, "1.27 runIn = run: " + cases.length + " calls (help, a command's help, list, a PT status, a --json refusal and usage error, doctor's exit 1, a bound, mcp-config) give the same out and code in-process and spawned (diff: " + js(diff) + ")");
  }
};
