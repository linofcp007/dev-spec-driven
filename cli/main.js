"use strict";

/**
 * The dev-spec CLI's `main` (1.27) — one call: `main(argv, io)` → a promise of the exit code. cli/dev-spec.js (the entry point) calls
 * it with the process's own streams and exits once they have flushed; the CLI suite calls it in-process (cli/tests/harness.js
 * runIn) with captured ones. Nothing here exits the process or keeps state between calls: every call parses its own command line
 * into its own context (createContext), a refusal ends the call by throwing CliExit (main turns it into the exit code), and the
 * call is SYNCHRONOUS — its promise already settled, `io.done(code)` already called — unless the command waits (done --run /
 * finish --run, stdin from a stream, the status line's stdin).
 *
 *   io: { stdout, stderr }  objects with write(string) — the process's streams, or captures
 *       stdin                a string / Buffer (the input, whole) or a readable stream (the process's); none: an empty input
 *       env, cwd             the environment and working folder the call runs in (the process's when absent). The engine reads
 *                            process.env / process.cwd() itself, so main applies them to the process for the call and restores them
 *       exit(code)           given by the entry point only: a reader that closed stdout ends the process at once (stdoutError),
 *                            a SIGINT / SIGTERM during done --run / finish --run too, once the run's process tree is killed
 *       done(code)           called once the call has finished (a synchronous caller reads the code there)
 *
 * The commands themselves — options, arguments, help, handler — are cli/commands.js's table.
 */

const fs = require("fs");
const path = require("path");
const CMD = require(path.join(__dirname, "commands.js"));
const COMPLETION = require(path.join(__dirname, "completion.js"));

const { spec, VALUE_FLAGS, REPEATABLE_FLAGS, OPTIONAL_VALUE_FLAGS, GLOBAL_OPTIONS, COMMAND_OPTIONS, TEXT_ONLY_COMMANDS, BOOL_FLAGS } = CMD;

// A usage error or a refusal ended the command (it was process.exit(1) inside the CLI): main returns its code.
class CliExit {
  constructor(code) { this.code = code; }
}

// ---- the command line ------------------------------------------------------------------------------------------------------
// → { argv (cut at `--`), ARGV0 (as given — evals hands its own flags to run-evals.js), flags, pos, cmd, cmdIdx (where the command
// word stands in ARGV0), flagCount, versionAsked, unknownShort, missingValue, branchSpaced }.
function parseArgs(args) {
  const argv = args.map(String);
  const ARGV0 = argv.slice();
  const flags = {};
  const pos = [];
  let cmdIdx = -1;
  // 1.24 r6 B5 — how many times each VALUE flag was given (`--k v` and `--k=v`): the parser keeps the last value, so a second one of a
  // single-value flag dropped the first silently (`approve … --role tech --role product` signed for product alone) — main refuses it
  // (refuseRepeatedFlags); the flags a command collects every occurrence of are REPEATABLE_FLAGS.
  const flagCount = Object.create(null);
  const countFlag = (k) => { if (VALUE_FLAGS.has(k)) flagCount[k] = (flagCount[k] || 0) + 1; };
  let versionAsked = false; // 1.24 r6 B-I1: --version / -V
  let unknownShort = null; // 1.25.1: the first single-dash option given (-j) — refused in main (refuseUnknownFlags)
  let missingValue = null; // reported in main, once --project is known (message in the project language)
  let branchSpaced = false; // 1.25: --branch's name was the next word (branchFlag refuses a track word there)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // `--` ends the options (POSIX): every later token is positional (`create -- --odd-name`) — it used to become flags[""]. argv is
    // cut there, so the repeated-flag collectors (depend --add, init --check, decide --affects…) stop there too.
    if (a === "--") { if (cmdIdx < 0 && !pos.length && i + 1 < argv.length) cmdIdx = i + 1; pos.push(...argv.slice(i + 1)); argv.splice(i); break; }
    if (a === "--json") flags.json = true;
    // anywhere, like --help: the version command, nothing else runs (`--version=true|false` as a switch — the help documents it)
    else if (a === "--version" || a === "-V" || /^--version=(?:true|1|yes|on)$/i.test(a)) versionAsked = true;
    else if (/^--version=(?:false|0|no|off)$/i.test(a)) { /* off */ }
    else if (a === "-h") flags.help = true; // 1.24 r6 B-I3: = --help (`status -h` looked for a feature named "h")
    else if (a.startsWith("--") && a.includes("=")) { const k = a.slice(2, a.indexOf("=")); flags[k] = a.slice(a.indexOf("=") + 1); countFlag(k); }
    else if (a.startsWith("--") && VALUE_FLAGS.has(a.slice(2))) {
      const k = a.slice(2);
      // A value flag never swallows the next flag: `--order --json` must not set order="--json". Only a `--<letter>` token is a
      // flag — `---` (front matter, an HR) or `-- draft` stays a value, like over MCP.
      if (argv[i + 1] === undefined || /^--[A-Za-z]/.test(argv[i + 1])) {
        if (OPTIONAL_VALUE_FLAGS.has(k)) { flags[k] = true; countFlag(k); } // 1.25 (--branch): its value is optional — bare = the default name
        else missingValue = missingValue || k;
      }
      else { flags[k] = argv[++i]; countFlag(k); if (k === "branch") branchSpaced = true; }
    }
    else if (a.startsWith("--")) flags[a.slice(2)] = true;
    // 1.25.1 (review 7): a single-dash option (-j, -x…) is no positional — `status -j` looked for a feature "j". Refused like an unknown
    // --flag (refuseUnknownFlags); -h / -V are handled above, a lone "-" (stdin) and "-1" (a number, refused by its command) stay words.
    else if (/^-[A-Za-z]/.test(a)) { if (unknownShort === null) unknownShort = a; }
    else { if (!pos.length) cmdIdx = i; pos.push(a); }
  }
  if (versionAsked && pos[0] !== "help") pos.splice(0, pos.length, "version"); // the words of another command are not run (its flags: printVersion ignores them)
  const cmd = pos.shift();
  // 1.23 review (L14): Windows' `--project "C:\dir\"` reaches the CLI as `C:\dir"` (the backslash escapes the closing quote) — a double
  // quote is never part of a Windows path, so a trailing one is dropped.
  if (process.platform === "win32" && typeof flags.project === "string") flags.project = flags.project.replace(/"+$/, "");
  // 1.25.1 (review 7): a leading ~ is the home folder — Windows PowerShell 5.1 passes `~` to node as typed (`--project ~/zz` made a
  // folder named "~" in the working folder). The engine's expandHome, mirrored without the engine in cli/completion.js.
  if (typeof flags.project === "string") flags.project = COMPLETION.expandHome(flags.project.trim());
  return { argv, ARGV0, flags, pos, cmd, cmdIdx, flagCount, versionAsked, unknownShort, missingValue, branchSpaced };
}

// ---- terminal-safe output (1.25.1, review 7) ----------------------------------------------------------------------------------
// The human output prints spec text (task text, a _Verify:_ command, its run's output, names…) as it is written: an ESC / OSC sequence
// or a lone carriage return in a cloned tasks.md could make `done --run` show `$ npm test` while it ran something else, retitle the
// terminal or hide lines. Everything the CLI writes goes through c.write / c.writeErr: the human text loses every C0 control but tab
// and line feed (a CR only before a LF — CRLF lines, RFC 4180 CSV), DEL and every C1 control (U+0080–U+009F); JSON keeps its value —
// JSON.stringify escapes C0 itself, and a raw DEL / C1 (legal inside a JSON string) is written as its \u escape. Built from char codes
// (never a raw control character in the source).
const cc = (n) => String.fromCharCode(n);
const RE_TERM_CONTROL = new RegExp("\r(?!\n)|[" + cc(0) + "-" + cc(8) + cc(11) + cc(12) + cc(14) + "-" + cc(31) + cc(0x7f) + "-" + cc(0x9f) + "]", "g");
const RE_JSON_RAW_CONTROL = new RegExp("[" + cc(0x7f) + "-" + cc(0x9f) + "]", "g");
const terminalSafe = (s) => String(s).replace(RE_TERM_CONTROL, "");
const jsonSafe = (s) => String(s).replace(RE_JSON_RAW_CONTROL, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
// One chunk through the guard: a string, or a buffer that is whole UTF-8 text (a cut multibyte character is passed on as it is).
function guarded(chunk, json) {
  if (typeof chunk === "string") return json ? jsonSafe(chunk) : terminalSafe(chunk);
  if (Buffer.isBuffer(chunk)) {
    const s = chunk.toString("utf8");
    const t = json ? jsonSafe(s) : terminalSafe(s);
    if (t !== s && Buffer.from(s, "utf8").equals(chunk)) return Buffer.from(t, "utf8");
  }
  return chunk;
}
// console.log's text for what the CLI prints (strings, numbers, a missing note): the arguments joined by a space.
const line = (args) => args.map((a) => (typeof a === "string" ? a : String(a))).join(" ") + "\n";

// ---- the call's context ----------------------------------------------------------------------------------------------------
// Everything a handler reads: the parsed command line, the project, the output helpers — one per call, never shared.
function createContext(argv, io) {
  const p = parseArgs(argv);
  const { flags, pos, cmd } = p;
  const env = io.env || process.env;
  const cwd = io.cwd || process.cwd();
  const c = { ...p, io, env, cwd, exitCode: 0, entry: null };

  // 1.25.1 (review 7) — the two runs that never load the engine up front: the status line's render (it loads the engine only once a
  // dev-spec project is found) and the bare help (`dev-spec`, `--help` / `-h` alone, `help` alone: helpText() is plain text). Anything
  // else on the line (a flag, an argument) takes the usual path.
  c.STATUSLINE_RENDER = cmd === "statusline" && !("print-config" in flags) && !("help" in flags);
  c.BARE_HELP = !p.versionAsked && p.unknownShort === null && p.missingValue === null &&
    ((cmd === undefined && Object.keys(flags).every((k) => k === "help" && flags.help === true)) || (cmd === "help" && !pos.length && !Object.keys(flags).length));
  const LIGHT = c.STATUSLINE_RENDER || c.BARE_HELP;
  // --project > SPEC_PROJECT_DIR > CLAUDE_PROJECT_DIR > the nearest folder at or above the working folder with a dev-spec .specs/ > the
  // working folder — the same resolution as the MCP server (spec.resolveProjectDir). --project is checked in main (checkProject).
  c.projectDir = LIGHT ? null : spec.resolveProjectDir(flags.project);
  // 1.24 r6 B1 — WHICH input chose it, read with resolveProjectDir's own precedence (a value that is empty or holds an unexpanded
  // variable falls through): "flag" (--project) · "SPEC_PROJECT_DIR" · "CLAUDE_PROJECT_DIR" · "nearest" (a folder above the working one
  // with a dev-spec .specs/) · "cwd" (the working folder). checkProject() checks a named one; `version` reports it.
  const usableDir = (v) => v != null && String(v).trim() !== "" && !spec.unexpandedVar(v);
  c.PROJECT_SOURCE = LIGHT ? null : typeof flags.project === "string" && usableDir(flags.project) ? "flag"
    : usableDir(env.SPEC_PROJECT_DIR) ? "SPEC_PROJECT_DIR"
    : usableDir(env.CLAUDE_PROJECT_DIR) ? "CLAUDE_PROJECT_DIR"
    : path.resolve(cwd) === c.projectDir ? "cwd" : "nearest";
  // Where a PATH argument is read from (scan <path>, ears <file>, import <tool> <path>): the project folder when it was NAMED (--project,
  // SPEC_PROJECT_DIR, CLAUDE_PROJECT_DIR — as import always read it), else the working folder: a path typed in a subfolder of the
  // project found by walking up is relative to that subfolder, as in git (1.23 review L12).
  c.projectNamed = typeof flags.project === "string" || c.PROJECT_SOURCE === "SPEC_PROJECT_DIR" || c.PROJECT_SOURCE === "CLAUDE_PROJECT_DIR";
  c.argPath = (q) => path.resolve(c.projectNamed ? c.projectDir : cwd, String(q));

  // ---- output: stdout under --json carries the JSON document (human lines go to stderr then: c.say); stderr is human text
  // --json asked for (before normalizeBoolFlags has run too: a usage error found first still answers in JSON).
  c.jsonWanted = () => flags.json === true || (typeof flags.json === "string" && /^(?:true|1|yes|on)$/i.test(flags.json.trim()));
  c.write = (s) => io.stdout.write(guarded(s, c.jsonWanted()));
  c.writeErr = (s) => io.stderr.write(guarded(s, false));
  c.log = (...a) => c.write(line(a));
  c.err = (...a) => c.writeErr(line(a));
  Object.defineProperty(c, "say", { get: () => (flags.json ? c.err : c.log) }); // done / finish --run: --json keeps stdout one JSON document

  // Localized human output — the feature's language for feature commands, the project's otherwise (--json prints the structured
  // result, which is never localized).
  c.cliText = (lang) => {
    const m = spec.msg(lang);
    return Object.assign({}, m.cliOutput, {
      phase: (ph) => (m.phaseNames && m.phaseNames[ph]) || ph,
      word: (v) => (m.cliOutput.words && m.cliOutput.words[v]) || v,
      bool: (b) => (b ? m.cliOutput.yes : m.cliOutput.no),
    });
  };
  c.featureText = (name) => c.cliText(spec.featureLang(c.projectDir, name));
  c.projectText = () => c.cliText(spec.projectLang(c.projectDir));

  c.out = (obj, human) => {
    if (flags.json) c.log(JSON.stringify(obj, null, 2));
    else if (typeof human === "function") human(obj);
    else c.log(typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
  };
  // A CLI usage / argument error: the message on stderr, exit 1 — and (1.23 review) with --json also {ok: false, error, code, …} as the
  // one JSON document on stdout, as a refusal prints (fail), so a script reads one shape. `text: true` (the --json-on-a-text-command
  // error) keeps stdout empty. 1.25.1 (review 7): every such error carries a stable `code` — MCP's where MCP has the same error
  // (unknown-argument {unknown}, missing-arguments {missing}, invalid-arguments {invalid}, project-missing, project-not-dir), else the
  // CLI's own (usage, unknown-command, project-empty, project-unexpanded, project-is-specs…). opts: { text, code (default "usage"),
  // …fields the document carries (unknown, missing, invalid) }.
  c.die = (msg, opts) => {
    const { text, code, ...extra } = opts || {};
    c.err("dev-spec: " + msg);
    if (c.jsonWanted() && !text) {
      try { c.write(jsonSafe(JSON.stringify({ ok: false, error: String(msg), code: code || "usage", ...extra }, null, 2)) + "\n"); } catch { /* stdout gone */ }
    }
    throw new CliExit(1);
  };
  // An engine refusal ({ok: false, error, …}). With --json the WHOLE result is the one JSON document on stdout — what the MCP tool
  // returns, `recorded` / `neverApproved` / `gated`… included — and the exit code is 1; a script never has to parse localized stderr.
  // Otherwise the error goes to stderr (+ an optional hint line), exit 1. Callers `return fail(r)`.
  c.fail = (r, hint) => {
    if (flags.json) {
      c.log(JSON.stringify(r, null, 2));
      if (hint) c.err(hint);
      c.exitCode = 1;
      return;
    }
    c.err("dev-spec: " + r.error);
    if (hint) c.err(hint);
    throw new CliExit(1);
  };
  // A usage line: the syntax stays as typed, the "usage:" prefix is in the project language.
  c.usage = (syntax) => c.die(c.projectText().usage(syntax));
  // The argument-error shapes (MCP's): an unknown option / word, an option given a bad value.
  c.unknownArg = (argument, didYouMean) => ({ code: "unknown-argument", unknown: [didYouMean ? { argument, didYouMean } : { argument }] });
  c.invalidArg = (...names) => ({ code: "invalid-arguments", invalid: names });

  // ---- flags. Switches are read with on(), never by truthiness: the string "false" is truthy, so `done --run=false` ran the
  // _Verify:_ commands and `add-track --remove=false` removed the track (MCP `false` is false) — normalizeBoolFlags reads them first.
  c.on = (k) => flags[k] === true;
  // A switch passed through to an engine option whose default depends on others (finish's includeBody, brief's includeBrief: true when
  // not writing): absent → undefined (the engine's default), else the explicit boolean — `--include-body=false` is false, as
  // spec_finish {includeBody: false}.
  c.boolFlag = (k) => (typeof flags[k] === "boolean" ? flags[k] : undefined);
  // 1.26: a document the human output prints (export html / md, catalog's and changelog's markdown) — always there for the human
  // output; with --json only on --include-body, as spec_export {includeBody} (the MCP default leaves it out: --json = the MCP result).
  c.bodyWanted = () => (flags.json ? c.boolFlag("include-body") === true : true);
  // --cap / --max / --timeout: an integer ≥ 1, like the MCP schema ({type: integer, minimum: 1}) — and at most the command's bound
  // (its entry's `bounds`: next --max ≤ 8, --timeout ≤ TIMEOUT_MAX_S). parseInt read "1.5" as 1, "-3" as -3 (a scan of zero files,
  // "truncated") and "abc" as the default. Absent → undefined (the engine's default).
  c.intFlag = (k) => {
    if (flags[k] === undefined) return undefined;
    const max = c.entry && c.entry.bounds ? c.entry.bounds[k] : undefined;
    const v = String(flags[k]).trim();
    if (/^\d+$/.test(v) && Number.isSafeInteger(Number(v)) && Number(v) >= 1 && (max === undefined || Number(v) <= max)) return Number(v);
    const A = spec.msg(spec.projectLang(c.projectDir)).args;
    const most = max === undefined ? "" : c.projectText().atMost(max);
    return c.die(A.invalid(A.item("--" + k, A.type.integer + " " + A.atLeast(1) + most, JSON.stringify(String(flags[k])))), c.invalidArg("--" + k));
  };
  c.timeoutFlag = () => c.intFlag("timeout");
  // done / finish: --shell and --timeout say how --run runs the commands — without --run they are a usage error (1.23 review: ignored).
  c.runOnlyFlags = () => {
    if (c.on("run")) return;
    const k = ["shell", "timeout"].find((n) => flags[n] !== undefined);
    if (k) c.die(c.projectText().needsRun("--" + k), c.invalidArg("--" + k));
  };
  // How done --run / finish --run run a command (cli/run.js): from the project root, --timeout's limit, and Ctrl+C / SIGTERM to the
  // CLI kill the run's tree before the CLI exits (130 / 143) — the entry point's exit; in-process, no signal handler.
  c.execOpts = () => ({ cwd: c.projectDir, timeoutS: c.timeoutFlag(), onSignal: io.exit ? (sig) => io.exit(sig === "SIGINT" ? 130 : 143) : undefined });
  // Every value of a value flag a command collects (depend --add / --rm, init --check, append-tasks --req…, decide --affects…): the
  // shared parser keeps only the LAST value of a repeated flag, so this walks argv with the parser's own rules.
  c.every = (name) => {
    const vals = [];
    for (let i = 0; i < p.argv.length; i++) {
      const a = p.argv[i];
      if (a.startsWith("--") && a.includes("=")) { if (a.slice(2, a.indexOf("=")) === name) vals.push(a.slice(a.indexOf("=") + 1)); }
      else if (a.startsWith("--") && VALUE_FLAGS.has(a.slice(2)) && p.argv[i + 1] !== undefined && !/^--[A-Za-z]/.test(p.argv[i + 1])) { const v = p.argv[++i]; if (a.slice(2) === name) vals.push(v); }
    }
    return vals;
  };
  // --tracks takes ONE token: every command that takes tracks merges the flag with its positional tracks (parseTracks splits
  // "tdd,saas") — none may drop it silently.
  c.withTracksFlag = (list) => (typeof flags.tracks === "string" && flags.tracks.trim() ? list.concat([flags.tracks]) : list);

  // ---- stdin. Read as BYTES and decoded as a file is (spec.decodeText: a UTF-16 BOM decides, else UTF-8) — 1.23 review: a UTF-16
  // document (what Windows PowerShell 5.1's `>` writes) piped into `ears -` read as "0 criteria, pass". From a stream asynchronously
  // (fs.readFileSync(0) is unreliable on Windows pipes — the hooks' rule): the handler's `cb` runs at its end, and readStdin returns a
  // promise of it; a string / Buffer input (in-process) runs `cb` at once. 1.24 r6 B-I9: from a terminal (a TTY) the CLI seemed to
  // hang — one line on stderr says it reads the terminal and how to end it.
  c.readStdin = (cb) => {
    const s = io.stdin;
    if (s == null || typeof s === "string" || Buffer.isBuffer(s)) return cb(spec.decodeText(s == null ? Buffer.alloc(0) : Buffer.isBuffer(s) ? s : Buffer.from(s, "utf8")));
    if (s.isTTY) c.err("dev-spec: " + c.projectText().stdinHint);
    return new Promise((resolve, reject) => {
      const chunks = [];
      // a refusal (CliExit) is the call's end; anything else is one error line, as main reports an engine exception
      const settle = (fn) => { try { resolve(fn()); } catch (e) { reject(e); } };
      const failWith = (e, code) => { if (e instanceof CliExit) throw e; c.die(e.message, { code: e.code ? String(e.code) : code }); };
      s.on("data", (ch) => chunks.push(Buffer.isBuffer(ch) ? ch : Buffer.from(String(ch), "utf8")));
      s.on("end", () => settle(() => { try { return cb(spec.decodeText(Buffer.concat(chunks))); } catch (e) { return failWith(e, "exception"); } }));
      s.on("error", (e) => settle(() => failWith(e, "stdin")));
    });
  };
  // The status line's stdin (cli/commands.js statusLineRender): UTF-8 text, a chunk appended while under `max` characters, handed to
  // `fn` ONCE — at its end, an error, or after `waitMs` (a caller that never closes stdin still gets its line). A terminal: "".
  c.readInput = (opts, fn) => {
    const s = io.stdin;
    if (s == null || typeof s === "string" || Buffer.isBuffer(s)) return fn(s == null ? "" : String(s));
    if (s.isTTY) return fn("");
    return new Promise((resolve) => {
      let data = "", done = false;
      const finish = () => { if (done) return; done = true; try { fn(data); } finally { resolve(); } };
      try {
        s.setEncoding("utf8");
        s.on("data", (ch) => { if (data.length < opts.max) data += ch; });
        s.on("end", finish);
        s.on("error", finish);
      } catch {
        return finish();
      }
      setTimeout(finish, opts.waitMs).unref();
    });
  };
  return c;
}

// ---- the checks every command shares ---------------------------------------------------------------------------------------
// An unknown --flag is a usage error, before anything runs: it used to be accepted as a silent boolean switch, so `done big 2 --rnu`
// ticked the task with no evidence (exit 0). Known = VALUE_FLAGS ∪ BOOL_FLAGS, with a did-you-mean. `evals` forwards its flags
// untouched to mcp/evals/run-evals.js, which refuses its own unknown ones (1.23 review: a mistyped --dryrun ran a LIVE, paid eval).
// A KNOWN flag the command doesn't read is refused too (checkCommandArgs: COMMAND_OPTIONS), and so is an extra argument.
function refuseUnknownFlags(c) {
  const { flags, cmd } = c;
  if (cmd === "evals") return;
  // VALUE_FLAGS, --help and --json are known without the engine's switch list (the bare help, version and completion never load it)
  const keys = Object.keys(flags).filter((k) => !VALUE_FLAGS.has(k) && k !== "help" && k !== "json");
  if (c.unknownShort === null && !keys.length) return;
  const known = [...VALUE_FLAGS, ...BOOL_FLAGS()];
  // 1.25.1 (review 7): a single-dash option — its did-you-mean: the long form of the same word (-json → --json), else the one flag the
  // letters start (-j → --json)
  if (c.unknownShort !== null) {
    const w = c.unknownShort.slice(1).toLowerCase();
    const starts = known.filter((k) => k.startsWith(w));
    const near = known.includes(w) ? w : starts.length === 1 ? starts[0] : null;
    c.die(c.projectText().unknownFlag(c.unknownShort, near ? "--" + near : null), c.unknownArg(c.unknownShort, near ? "--" + near : null));
  }
  const bad = keys.find((k) => !known.includes(k));
  if (bad === undefined) return;
  // Optimal-string-alignment distance (a transposition — --rnu — costs 1), as the track did-you-mean.
  const dist = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  };
  const k = bad.toLowerCase();
  let best = null;
  for (const cand of known) {
    const n = dist(k, cand);
    if (n <= Math.max(1, Math.floor(cand.length / 3)) && (!best || n < best.n)) best = { c: cand, n };
  }
  c.die(c.projectText().unknownFlag("--" + bad, best ? "--" + best.c : null), c.unknownArg("--" + bad, best ? "--" + best.c : null));
}
// 1.24 r6 B5 — a single-value flag given twice is a usage error, never last-wins (--role, --by, --cmd, --summary, --through, --phase,
// --project, --lang… dropped the first value). REPEATABLE_FLAGS are the ones a command reads every occurrence of. append-tasks keeps
// its own words for --task (one task per call) and --verify / --story / --heading / --size. `evals` is exempt (its flags are
// run-evals.js's).
function refuseRepeatedFlags(c) {
  const { cmd, pos } = c;
  if (cmd === "evals") return;
  const k = Object.keys(c.flagCount).find((n) => c.flagCount[n] > 1 && !REPEATABLE_FLAGS.has(n));
  if (k === undefined) return;
  if (cmd === "append-tasks" && ["task", "verify", "story", "heading", "size"].includes(k)) {
    const AT = spec.msg(pos[0] != null ? spec.featureLang(c.projectDir, pos[0]) : spec.projectLang(c.projectDir)).appendTasks;
    c.die(k === "task" ? AT.oneTaskPerCall : AT.oneValue(k), c.invalidArg("--" + k));
  }
  c.die(c.projectText().flagTwice("--" + k), c.invalidArg("--" + k));
}
// Boolean switches: `--x` is true, `--x=true|false` (also 1/0, yes/no, on/off) sets it explicitly; any other `=value` is an error.
function normalizeBoolFlags(c) {
  const { flags, cmd } = c;
  if (!Object.keys(flags).some((k) => typeof flags[k] === "string" && !VALUE_FLAGS.has(k))) return; // no switch given a value: nothing to read
  for (const k of BOOL_FLAGS()) {
    if (typeof flags[k] !== "string") continue;
    if (cmd === "evals" && k === "dry-run") continue; // 1.25: import's switch has the name of run-evals.js's own flag — evals hands it over unread
    const v = flags[k].trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) flags[k] = true;
    else if (["false", "0", "no", "off"].includes(v)) flags[k] = false;
    else {
      const A = spec.msg(spec.projectLang(c.projectDir)).args;
      c.die(A.invalid(A.item("--" + k, A.type.boolean, JSON.stringify(flags[k]))), c.invalidArg("--" + k));
    }
  }
}
// 1.23 review — the command's own options (COMMAND_OPTIONS, from its table entry) and the most arguments it takes: they were ignored
// silently — `approve <f> <phase> --remove` (meant --revoke) still approved, `done <f> 3 4` ticked task 3 alone.
function checkCommandArgs(c) {
  const { flags, cmd, pos } = c;
  const own = Object.prototype.hasOwnProperty.call(COMMAND_OPTIONS, cmd) ? COMMAND_OPTIONS[cmd] : null;
  if (!own) return; // an unknown command (its own error), evals (run-evals.js), help
  const T = c.projectText();
  const bad = Object.keys(flags).find((k) => !GLOBAL_OPTIONS.includes(k) && !own.options.includes(k));
  if (bad !== undefined) c.die(T.flagNotFor("--" + bad, cmd, own.options.map((f) => "--" + f).join(", ")), c.unknownArg("--" + bad));
  if (own.max !== undefined && pos.length > own.max) c.die(T.extraArgs(cmd, pos.slice(own.max).join(" ")), { code: "unknown-argument", unknown: pos.slice(own.max).map((w) => ({ argument: String(w) })) });
}
// 1.23 review (L14) — --project names an existing FOLDER: an empty value, a variable left unexpanded (`$HOME/x`, `%DIR%`, `${…}`) or a
// file is refused, and so is a folder that doesn't exist — except for init, which creates it (`create x --project <typo>` used to
// create the whole mistyped tree). 1.24 r6 B1 — SPEC_PROJECT_DIR / CLAUDE_PROJECT_DIR are checked the same way when one of them chose
// the project (PROJECT_SOURCE), the message naming the variable. A folder without .specs/ is fine (CLAUDE_PROJECT_DIR is whatever
// folder Claude Code opened). An empty or unexpanded value still falls through (resolveProjectDir's rule). B7 — a dev-spec project's
// own .specs/ folder named as the project is refused with the folder to name: it created .specs/.specs/, which then won every walk-up.
function checkProject(c) {
  const { flags, cmd } = c;
  const T = c.projectText();
  let v, src;
  if ("project" in flags) {
    v = typeof flags.project === "string" ? flags.project.trim() : "";
    if (!v) c.die(T.projectEmpty, { code: "project-empty" });
    if (spec.unexpandedVar(v)) c.die(T.projectUnexpanded(v), { code: "project-unexpanded" });
    src = "--project";
  } else if (c.PROJECT_SOURCE === "SPEC_PROJECT_DIR" || c.PROJECT_SOURCE === "CLAUDE_PROJECT_DIR") {
    v = String(c.env[c.PROJECT_SOURCE]).trim();
    src = c.PROJECT_SOURCE;
  } else return;
  const abs = path.resolve(c.cwd, COMPLETION.expandHome(v)); // 1.25.1: SPEC_PROJECT_DIR=~/x too (a JSON config never expands it)
  const flag = src === "--project";
  let st = null;
  try { st = fs.statSync(abs); } catch { st = null; }
  if (st && !st.isDirectory()) c.die(flag ? T.projectNotDir(abs) : T.projectEnvNotDir(src, abs), { code: "project-not-dir" });
  if (!st && cmd !== "init") c.die(flag ? T.projectMissing(abs) : T.projectEnvMissing(src, abs), { code: "project-missing" });
  const base = path.basename(abs);
  const specsName = process.platform === "win32" || process.platform === "darwin" ? /^\.specs$/i.test(base) : base === ".specs";
  if (st && specsName && spec.isDevSpecDir(path.dirname(abs))) c.die(T.projectIsSpecs(flag ? "--project " + abs : src + "=" + abs, path.dirname(abs)), { code: "project-is-specs" });
}
// 1.24 r6 B2 — stdout's reader went away (`export --md | head -1`, a pager quit): an EPIPE / EOF / ERR_STREAM_DESTROYED is the end of
// the output, never a crash — the process ends at once, quietly, with the status the command set (the MCP server's rule since 1.22);
// any other stdout error is one stderr line, exit 1. Installed after the status line's render path, which keeps its own (exit 0).
function stdoutError(c, e) {
  const code = e && e.code;
  if (code === "EPIPE" || code === "EOF" || code === "ERR_STREAM_DESTROYED") return c.io.exit(c.exitCode || 0);
  try { fs.writeSync(2, "dev-spec: " + (e && e.message ? e.message : String(e)) + "\n"); } catch { /* stderr gone too */ }
  return c.io.exit(1);
}

// ---- dispatch -----------------------------------------------------------------------------------------------------------------
// The checks, in their order, then the command's handler (→ its result: nothing, or a promise when it waits).
function dispatch(c) {
  const { flags, cmd, pos } = c;
  // 1.16 C1: the status line's render path runs before any flag / usage check — it must print its line or nothing, exit 0.
  if (c.STATUSLINE_RENDER) return CMD.statusLineRender(c);
  if (c.io.exit && typeof c.io.stdout.on === "function") c.io.stdout.on("error", (e) => stdoutError(c, e)); // 1.24 r6 B2: a reader that closed early ends the output quietly
  refuseUnknownFlags(c); // `--rnu` is an error (did you mean --run?), never a silent switch
  // 1.21 review A3: `merge-state --check` is a switch there — `--check` is init's VALUE flag (init --check name="cmd"), so it can't join
  // spec.CLI_SWITCHES (normalizeBoolFlags would refuse `init --check test="npm test"`, and the approval hook's lexer would read init's
  // value as the next word): a bare `--check` after merge-state reads as on.
  if (cmd === "merge-state" && c.missingValue === "check") { c.missingValue = null; flags.check = true; }
  if (c.missingValue) c.die(c.projectText().missingValue(c.missingValue), { code: "missing-arguments", missing: ["--" + c.missingValue] });
  refuseRepeatedFlags(c); // 1.24 r6 B5: `--role tech --role product` is an error, never last-wins
  // --lang is checked once, like the MCP `lang` enum: an unknown value (fr, spanish, portugues…) is refused before any command runs —
  // the engine would quietly turn it into 'en' and SAVE it (init rewrote the project language).
  if (flags.lang !== undefined) {
    const langs = spec.LANGS; // = the MCP tools' `lang` enum (en · pt · es · pt-BR)
    const l = spec.canonicalLang(String(flags.lang)); // PT → pt · pt-br / pt_BR / ptbr → pt-BR · pt-PT → pt (the MCP enum folds the same)
    if (!l || !langs.includes(l)) {
      const A = spec.msg(spec.projectLang(c.projectDir)).args;
      c.die(A.invalid(A.item("--lang", A.oneOf(langs.join(", ")), JSON.stringify(String(flags.lang)))), c.invalidArg("--lang"));
    }
    flags.lang = l;
  }
  normalizeBoolFlags(c); // `--run=false` is false, `--run=maybe` an error — before any command runs
  // 1.22 review: --json on what prints text only — the help (`help`, no command, `--help` anywhere) and TEXT_ONLY_COMMANDS — is a usage
  // error, before anything runs: it printed the text on stdout with exit 0, and a script parsing it failed far away.
  const helpOnly = cmd === undefined || cmd === "help" || cmd === "-h" || cmd === "--help" || (c.on("help") && cmd !== "evals");
  if (c.on("json") && (helpOnly || TEXT_ONLY_COMMANDS.has(cmd))) c.die(c.projectText().noJson(helpOnly ? "help" : cmd), { text: true });
  // `<command> --help` / `-h` prints the help and runs nothing — 1.24 r6 B-I3: that command's part of it and its options
  if (c.on("help") && cmd !== "evals") return c.log(CMD.helpFor(c, cmd));
  // 1.24 r6 B-I1: --version / -V anywhere prints the version and runs nothing (the other command's words and flags unread); the
  // `version` command reports the project it resolves — never refuses it (a missing one reads exists: false).
  if (c.versionAsked && cmd === "version") return CMD.printVersion(c);
  if (!helpOnly) {
    // 1.23 review L14: an existing folder (init alone may create it) — 1.24 r6 B1: the environment too. `version` reports the project and
    // `completion` reads none (it runs from a shell profile, wherever that starts): neither refuses it.
    if (cmd !== "version" && cmd !== "completion") checkProject(c);
    checkCommandArgs(c); // 1.23 review: the command's own options, at most its own arguments
  }
  if (cmd === undefined || cmd === "-h" || cmd === "--help") return c.log(CMD.helpText()); // (`-- --help`: the word itself)
  c.entry = CMD.commandFor(cmd);
  if (!c.entry) c.die(c.projectText().unknownCommand(cmd), { code: "unknown-command" });
  return c.entry.run(c);
}

// The engine reads process.env and process.cwd() itself (resolveProjectDir, the user defaults, the default approver…): a call given
// another environment or working folder runs in them, restored when it ends. The entry point passes the process's own — no change.
function enterProcessContext(io) {
  const undo = [];
  if (io.env && io.env !== process.env) {
    const before = { ...process.env };
    const apply = (to) => {
      for (const k of Object.keys(process.env)) if (!Object.prototype.hasOwnProperty.call(to, k)) delete process.env[k];
      for (const [k, v] of Object.entries(to)) if (process.env[k] !== v) process.env[k] = v;
    };
    apply(io.env);
    undo.push(() => apply(before));
  }
  if (io.cwd && path.resolve(io.cwd) !== process.cwd()) {
    const before = process.cwd();
    process.chdir(io.cwd);
    undo.push(() => { try { process.chdir(before); } catch { /* gone */ } });
  }
  return () => { while (undo.length) undo.pop()(); };
}

// One CLI call → a promise of its exit code (also handed to io.done). Synchronous unless the command waits.
function main(argv, io) {
  const restore = enterProcessContext(io);
  let c = null;
  const finish = (e) => {
    let code;
    if (e === undefined) code = c.exitCode || 0;
    else if (e instanceof CliExit) code = e.code;
    else if (!c) {
      // the command line could not even be read (an engine exception resolving the project): one line, never a stack trace
      try { io.stderr.write("dev-spec: " + (e && e.message ? e.message : String(e)) + "\n"); } catch { /* stderr gone */ }
      code = 1;
    } else {
      // Engine guards (e.g. an unreadable roadmap.json) surface as a one-line error, not a stack trace — with --json (1.23 review L24)
      // also as {ok: false, error, code} on stdout (code: the system error's, e.g. ENOTDIR, else "exception").
      try { c.die(e && e.message ? e.message : String(e), { code: e && typeof e.code === "string" && e.code ? e.code : "exception" }); } catch (x) { code = x instanceof CliExit ? x.code : 1; }
    }
    restore();
    if (typeof io.done === "function") io.done(code);
    return code;
  };
  try {
    c = createContext(argv, io);
    const r = dispatch(c);
    if (r && typeof r.then === "function") return r.then(() => finish(), (e) => finish(e));
    return Promise.resolve(finish());
  } catch (e) {
    return Promise.resolve(finish(e));
  }
}

module.exports = { main, parseArgs, CliExit };
