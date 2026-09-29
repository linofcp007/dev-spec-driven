"use strict";

/**
 * dev-spec-driven engine — the human approval guard.
 * meta.approvalGuard (off | ask | deny — hooks/approval-hook.js): a pure decision over one PreToolUse payload, with
 * its shell lexer. CLI_SWITCHES (the CLI's boolean switches) lives here: the lexer reads it.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let approvalRolesFrom, checksInput, evidenceModeInput, guardInput, isObj, loadRoadmap, normalizeLang, own,
  parseApprovalRolesText, readIfExists, readRoadmap, roadmapPath, toPosix, validateApprovalRoles, writeRoadmap;
function __link(E) { ({ approvalRolesFrom, checksInput, evidenceModeInput, guardInput, isObj, loadRoadmap,
  normalizeLang, own, parseApprovalRolesText, readIfExists, readRoadmap, roadmapPath, toPosix, validateApprovalRoles,
  writeRoadmap } = E); }

// ---------------------------------------------------------------------------
// 1.14 F2 — the human approval guard (roadmap.json meta.approvalGuard: off | ask | deny; hooks/approval-hook.js, PreToolUse).
// An approval is the human's act, yet an agent can call spec_approve (force included) or run `dev-spec approve` itself. With the
// guard on, an AGENT's approval — the spec_approve MCP tool under any server prefix, spec_feature {action: "remove", confirm: true},
// `dev-spec approve …` / `dev-spec feature remove … --yes` run through the Bash / PowerShell tool (also inside `bash -c "…"`,
// `cmd /c "…"`, `pwsh -Command "…"`, `$( … )`, a heredoc fed to a shell) — or a GUARD-DOWN action: lowering this guard
// (spec_init {approvalGuard} / `init --approval-guard`), weakening what it stands for (spec_init / `init`: evidence observed →
// reported, clearing or dropping approval roles, removing or changing a project check, turning the stop gate or the edit guard
// down) or a shell command writing .specs/roadmap.json — asks the user (ask: a permission prompt) or is refused with the command
// the human runs (deny: in their own terminal, or with Claude Code's `!` prefix). Raising or adding stays allowed. A guardrail on
// the approve paths, not a sandbox: a script, a variable or the Write tool can still reach .specs/ files.
// approvalGuardDecision is PURE (reads nothing): the hook reads the level and meta (one raw read of roadmap.json) and passes them in.
// ---------------------------------------------------------------------------

const APPROVAL_GUARD_LEVELS = ["off", "ask", "deny"]; // in order: a later level is stricter
// The approve-shaped MCP tools, under any server prefix (Claude Code: mcp__plugin_dev-spec-driven_spec-driven__spec_approve;
// a project server: mcp__spec-driven__spec_approve; any name a user registered the server under) or bare.
const RE_APPROVAL_MCP = /^(?:mcp__.+__)?(spec_approve|spec_feature|spec_init)$/;
const APPROVAL_SHELL_TOOLS = new Set(["Bash", "PowerShell"]);
const APPROVAL_COMMAND_MAX = 64 * 1024; // characters of a shell command read (the hook's payload may be anything)
const APPROVAL_SHELL_DEPTH = 3; // nested scripts (bash -c "cmd /c \"…\"") read at most this deep
const APPROVAL_LEX_DEPTH = 32; // $( … ) / `…` / heredoc scripts lexed at most this deep (deeper: read as a plain subshell)
// The CLI's boolean switches (cli/dev-spec.js BOOL_FLAGS): any other `--flag` takes the next word as its value.
const CLI_SWITCHES = new Set(["json", "run", "remove", "write", "md", "html", "batch", "include-brief", "include-body", "code", "force",
  "reopen", "yes", "brownfield", "parallel", "clear", "apply", "discovery", "expect-fail", "help", "matrix", "csv", "waves",
  "print-config"]); // the CLI's BOOL_FLAGS ARE this list (print-config: 1.16 C1 — statusline --print-config)
CLI_SWITCHES.add("revoke"); // 1.16 U2: approve <feature> <phase> --revoke (the approval hook reads it as a switch too)
CLI_SWITCHES.add("gherkin"); // 1.16 E1: export [f] --gherkin (= spec_export {format: "gherkin"})
// Words that may come before the CLI's script in the same simple command (a launcher, an env assignment, an option, a timeout, a
// shell keyword — `! node … approve`, the very line the deny reason suggests, run by the agent itself is still an approval).
const APPROVAL_WRAPPERS = new Set(["node", "nodejs", "bun", "deno", "npx", "bunx", "pnpx", "npm", "pnpm", "yarn", "sudo", "doas", "env", "nohup",
  "time", "exec", "command", "call", "start", "timeout", "nice", "ionice", "setsid", "stdbuf", "wsl", "xargs", "!", "if", "then", "else", "elif",
  "do", "while", "until"]);
// Launchers that run a package's bin through a subcommand only: npm exec / npm x, pnpm dlx / pnpm exec, yarn dlx / yarn exec,
// bun x / bun run, deno run (`yarn dev-spec …` — the CLI named directly — is found as it is). Any other subcommand runs no bin.
const APPROVAL_SUBCOMMANDS = new Map([["npm", ["exec", "x"]], ["pnpm", ["dlx", "exec"]], ["yarn", ["dlx", "exec"]], ["bun", ["x", "run"]], ["deno", ["run"]]]);
// The launchers' options that take the NEXT word as their value (`sudo -u bob`, `exec -a name`, `node -r ./hook.js`); any other
// option is a switch (a value glued with = or attached — `-ubob` — is part of the option word).
const APPROVAL_OPTION_VALUES = new Map(Object.entries({
  sudo: "-u -g -p -C -D -r -t -U -T -R -h --user --group --prompt --close-from --chdir --role --type --other-user --command-timeout --chroot --host",
  doas: "-u -C",
  exec: "-a",
  env: "-u -C --unset --chdir",
  node: "-r --require --import --loader --experimental-loader -C --conditions --title --env-file --input-type --inspect-port --redirect-warnings --openssl-config --icu-data-dir --diagnostic-dir --report-dir",
  bun: "-r --preload --cwd -c --config --env-file --tsconfig-override",
  deno: "-c --config --import-map --location --seed --cert --env-file --lock -L --log-level",
  npx: "-p --package -c --call --cache --userconfig -w --workspace --prefix",
  npm: "-p --package -c --call --cache --userconfig -w --workspace --prefix -C",
  pnpm: "-C --dir --filter -F --package",
  yarn: "--cwd -p --package",
  timeout: "-s -k --signal --kill-after",
  nice: "-n --adjustment",
  ionice: "-c -n -p --class --classdata --pid",
  time: "-f -o --format --output",
  stdbuf: "-i -o -e --input --output --error",
  xargs: "-I -n -P -L -d -E -s -a --max-args --max-procs --delimiter --arg-file --max-lines --max-chars --eof --replace",
  wsl: "-d -u --distribution --user --cd --shell-type",
}).map(([p, list]) => [p, new Set(list.split(" "))]));
APPROVAL_OPTION_VALUES.set("nodejs", APPROVAL_OPTION_VALUES.get("node"));
APPROVAL_OPTION_VALUES.set("pnpx", APPROVAL_OPTION_VALUES.get("npx"));
// Programs whose quoted argument is itself a script: bash -c "…", cmd /c "…", pwsh -Command "…", eval "…", Start-Process … "…",
// env -S "…", npx -c "…" — read in that program's syntax (cmd → cmd.exe, the PowerShell ones → PowerShell, the rest → Bash).
const APPROVAL_SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "fish", "cmd", "powershell", "pwsh", "eval", "iex", "invoke-expression",
  "start-process", "wsl", "su", "watch", "env", "npx", "pnpx", "npm", "pnpm", "yarn"]);
const APPROVAL_PS_SHELLS = new Set(["powershell", "pwsh", "iex", "invoke-expression", "start-process"]);
// The shells that run a heredoc / here-string fed to them as their script (`bash <<'EOF' … EOF`, `sh <<< "…"`).
const APPROVAL_STDIN_SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "fish", "cmd", "powershell", "pwsh", "wsl", "su"]);
const approvalShellMode = (prog) => (prog === "cmd" ? "cmd" : APPROVAL_PS_SHELLS.has(prog) ? "ps" : "bash");
const RE_DEVSPEC_WORD = /(?:^|[\\/])dev-spec(?:\.(?:[cm]?js|cmd|ps1|exe))?$/i;
// A word that is only a substitution or a variable ($(which node), `…`, $NODE, ${NODE}, $env:NODE, %NODE%): an unknown launcher.
const RE_APPROVAL_VAR_WORD = /^(?:\$(?:\{[^{}]*\}|[A-Za-z_][\w:]*)|%\w+%)$/;
// A shell command can run the CLI or write .specs/roadmap.json only if it names dev-spec or .specs — read with quotes, escapes and
// line continuations taken out (`dev\-spec`, `d'e'v-spec`, `dev`-spec`). The hook's own pre-check is the same test.
const RE_APPROVAL_CANDIDATE = /dev-?spec|\.specs/i;
const approvalCandidate = (text) => RE_APPROVAL_CANDIDATE.test(String(text).replace(/[\\`^]\r?\n|['"\\`^]/g, ""));
// .specs/roadmap.json as a write target (R1): a redirection's target, or the file a writer program names.
const RE_ROADMAP_FILE = /(?:^|[\\/])\.specs[\\/]+roadmap\.json$/i;
const RE_SPECS_DIR = /(?:^|[\\/])\.specs[\\/]*$/i;
const APPROVAL_WRITERS_ANY = new Set(["tee", "truncate", "rm", "unlink", "shred", "del", "erase", "remove-item", "ri", "set-content", "sc",
  "add-content", "ac", "out-file", "clear-content", "clc", "new-item", "ni", "mv", "move", "move-item", "mi", "ren", "rename", "rename-item",
  "rni", "dd"]);
// Deleting .specs/ or moving it away takes roadmap.json with it (the guard reads a missing file as off).
const APPROVAL_REMOVERS = new Set(["rm", "rmdir", "rd", "del", "erase", "remove-item", "ri"]);
const APPROVAL_MOVERS = new Set(["mv", "move", "move-item", "mi", "ren", "rename", "rename-item", "rni"]);
const APPROVAL_WRITERS_TARGET =new Set(["cp", "copy", "copy-item", "cpi", "install", "ln", "rsync", "xcopy", "robocopy"]); // the LAST path is written
const APPROVAL_WRITERS_INPLACE = new Set(["sed", "perl", "ruby"]); // with -i / --in-place
const RE_DEST_OPTION = /^-(?:destination|dest|t|-target-directory)$/i;

// "off" | "ask" | "deny" (any case, trimmed), else undefined — spec_init {approvalGuard} / `init --approval-guard`.
function approvalGuardInput(v) {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return APPROVAL_GUARD_LEVELS.includes(s) ? s : undefined;
}
// A roadmap.json that exists but doesn't parse keeps the strictest meta.approvalGuard its raw text names (fail closed: appending
// a byte to the file must not switch the guard off). Linear: one literal key, no nested quantifier.
const RE_RAW_APPROVAL_GUARD = /"approvalGuard"\s*:\s*"\s*(ask|deny)\s*"/gi;
function rawApprovalGuard(text) {
  let lvl = 0;
  for (const m of String(text || "").matchAll(RE_RAW_APPROVAL_GUARD)) lvl = Math.max(lvl, APPROVAL_GUARD_LEVELS.indexOf(m[1].toLowerCase()));
  return APPROVAL_GUARD_LEVELS[lvl];
}
// roadmap.json meta.approvalGuard → "off" | "ask" | "deny" (anything else, or no roadmap.json: off; a broken one: what its text
// names — rawApprovalGuard). The hook reads it raw the same way.
function approvalGuardLevel(projectDir) {
  const l = loadRoadmap(projectDir);
  if (l.parseError) return rawApprovalGuard(readIfExists(roadmapPath(projectDir)));
  return (isObj(l.rm.meta) && approvalGuardInput(l.rm.meta.approvalGuard)) || "off";
}
// Inside initProject's roadmap lock. Off is the default (absent = off): no write when the effective value doesn't change.
function setApprovalGuard(projectDir, level) {
  const rm = readRoadmap(projectDir);
  rm.meta = isObj(rm.meta) ? rm.meta : {};
  if ((approvalGuardInput(rm.meta.approvalGuard) || "off") === level) return;
  rm.meta.approvalGuard = level;
  writeRoadmap(projectDir, rm);
}
const lowersApprovalGuard = (to, level) => APPROVAL_GUARD_LEVELS.indexOf(to) < APPROVAL_GUARD_LEVELS.indexOf(level);

// $'…' (Bash ANSI-C quoting): the escape after the backslash at s[k] → { text, end } (end: the index after it). Bounded reads.
const ANSI_C_ESCAPES = { a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\\": "\\", "'": "'", '"': '"', "?": "?" };
function ansiCEscape(s, k) {
  const c = s[k];
  if (c === undefined) return { text: "\\", end: k };
  if (own(ANSI_C_ESCAPES, c)) return { text: ANSI_C_ESCAPES[c], end: k + 1 };
  let m;
  if (c === "x" && (m = /^[0-9A-Fa-f]{1,2}/.exec(s.slice(k + 1, k + 3)))) return { text: String.fromCharCode(parseInt(m[0], 16)), end: k + 1 + m[0].length };
  if ((c === "u" || c === "U") && (m = (c === "u" ? /^[0-9A-Fa-f]{1,4}/ : /^[0-9A-Fa-f]{1,8}/).exec(s.slice(k + 1, k + 9)))) {
    const cp = parseInt(m[0], 16);
    return { text: cp <= 0x10ffff ? String.fromCodePoint(cp) : "", end: k + 1 + m[0].length };
  }
  if ((m = /^[0-7]{1,3}/.exec(s.slice(k, k + 3)))) return { text: String.fromCharCode(parseInt(m[0], 8) & 0xff), end: k + m[0].length };
  if (c === "c" && k + 1 < s.length) return { text: String.fromCharCode(s.charCodeAt(k + 1) & 0x1f), end: k + 2 };
  return { text: "\\" + c, end: k + 1 };
}
const PS_ESCAPES = { 0: "\0", a: "\x07", b: "\b", e: "\x1b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" }; // "`n" in a PowerShell string

// A shell command → its simple commands: each a list of words (quotes and escapes removed) carrying `raw` (the same words with a
// Bash backslash kept — `node C:\x\cli\dev-spec.js` names the CLI in either spelling), `redirs` (the targets of its redirections,
// never words: `>log node cli/dev-spec.js approve …` still runs the CLI) and `herestrings` (`<<< "…"` words). `mode` = the shell
// that reads it (the tool: Bash / PowerShell; a nested script: its program's):
//  bash — '…' literal; "…" escapes \ " $ ` and a newline; $'…' ANSI-C escapes; outside quotes \x is x and \⏎ continues the line;
//         $( … ) and `…` are commands of their own (also inside "…" and an unquoted heredoc); a heredoc body (<<WORD, <<-WORD,
//         <<'WORD', <<"WORD", up to its terminator line) is data — read only for its $( ) / `…` when WORD is unquoted, or as a
//         whole script when the command is a shell (`bash <<'EOF'`); # at the start of a word starts a comment.
//  ps   — PowerShell: '…' literal ('' is a quote); in "…" and outside quotes the backtick escapes (`⏎ continues the line), "" is
//         a quote; $( … ) is a command; @'…'@ / @"…"@ here-strings are data ($( ) read in @"…"@); # and <# … #> are comments.
//  cmd  — cmd.exe: "…" literal, ^ escapes outside quotes (^⏎ continues the line), no ' quoting.
// Separators outside quotes: newline ; & | ( ) { }. One pass: a substitution is read by a nested call that returns where it ended
// (a backtick body at most twice), bounded by APPROVAL_LEX_DEPTH; nothing is evaluated.
function shellCommandWords(cmd, mode) {
  const segs = [];
  shellLexList(String(cmd), 0, mode === "ps" || mode === "cmd" ? mode : "bash", segs, false, 0);
  return segs;
}
// The first word that is the program run (after launchers, their options and values, env assignments, timeouts, shell keywords,
// an unknown substitution / variable) → its index, or -1. A launcher that needs a subcommand (npm exec) returns the word that
// stands where the subcommand should be when it is another one (`npm run …` → "run": no bin run).
function programAt(words, raw) {
  let prog = null, sub = null;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === "" || RE_APPROVAL_VAR_WORD.test(w)) continue;
    if (w.startsWith("-")) {
      const vals = prog ? APPROVAL_OPTION_VALUES.get(prog) : null;
      if (vals && vals.has(w)) i++;
      continue;
    }
    if (sub) {
      const need = sub;
      sub = null;
      if (need.includes(w.toLowerCase())) continue;
      return i;
    }
    if (/^[A-Za-z_]\w*=/.test(w) || /^\d+(?:\.\d+)?[smhd]?$/.test(w)) continue;
    const p = approvalProgram(w);
    if (APPROVAL_WRAPPERS.has(p) && !RE_DEVSPEC_WORD.test(w) && !RE_DEVSPEC_WORD.test((raw && raw[i]) || "")) {
      prog = p;
      sub = APPROVAL_SUBCOMMANDS.get(p) || null;
      continue;
    }
    return i;
  }
  return -1;
}
// A simple command's shell (the program, when it is one that runs a heredoc / here-string fed to it) → its lexer mode, else null.
function stdinShellMode(words, raw) {
  const k = programAt(words, raw);
  const p = k >= 0 ? approvalProgram(words[k]) : "";
  return APPROVAL_STDIN_SHELLS.has(p) ? approvalShellMode(p) : null;
}
// The lexer (see shellCommandWords): reads s from `start` — to its end, or, inSub, to the `)` closing a `$(` (its index is
// returned) — pushing every simple command it finds (nested ones too) into segs.
function shellLexList(s, start, mode, segs, inSub, depth) {
  const bash = mode === "bash", ps = mode === "ps", cmdm = mode === "cmd";
  let words = [], raws = [], redirs = [], herestrings = [], segDocs = [];
  let cur = "", raw = "", has = false, quoted = false, redir = null, paren = 0, arith = 0; // arith: the paren level inside (( … ))
  const heredocs = []; // bash: bodies waiting for the next newline — { delim, strip, quoted, shell }
  const add = (t, r) => { cur += t; raw += r === undefined ? t : r; has = true; };
  const endWord = () => {
    if (has) {
      if (redir === "<<" || redir === "<<-") { const h = { delim: cur, strip: redir === "<<-", quoted, shell: null }; heredocs.push(h); segDocs.push(h); }
      else if (redir && redir.startsWith("<<<")) herestrings.push(cur);
      else if (redir) redirs.push(cur, raw);
      else { words.push(cur); raws.push(raw); }
      redir = null;
    }
    cur = ""; raw = ""; has = false; quoted = false;
  };
  const endSeg = () => {
    endWord();
    redir = null;
    if (words.length || redirs.length || herestrings.length) {
      const seg = words;
      seg.raw = raws;
      seg.redirs = redirs;
      seg.herestrings = herestrings;
      const sh = segDocs.length || herestrings.length ? stdinShellMode(words, raws) : null;
      for (const h of segDocs) h.shell = sh;
      seg.stdinShell = sh;
      segs.push(seg);
    }
    words = []; raws = []; redirs = []; herestrings = []; segDocs = [];
  };
  // A `$(` whose text starts at `from` → its nested command list; returns the index of its `)` (or the end), -1 past the depth bound.
  const subst = (from) => (depth < APPROVAL_LEX_DEPTH ? shellLexList(s, from, mode, segs, true, depth + 1) : -1);
  // A Bash `…` substitution opening at s[at] → the index of its closing backtick (or the end); its body is lexed as a script.
  const backtick = (at) => {
    if (depth >= APPROVAL_LEX_DEPTH) return -1;
    let k = at + 1;
    while (k < s.length && s[k] !== "`") k += s[k] === "\\" ? 2 : 1;
    k = Math.min(k, s.length);
    shellLexList(s.slice(at + 1, k), 0, mode, segs, false, depth + 1);
    return k;
  };
  // After a newline: the pending heredoc bodies, in order → the index where the command text resumes.
  const heredocBodies = (pos) => {
    for (const h of heredocs.splice(0)) {
      let p = pos, end = s.length, next = s.length;
      while (p < s.length) {
        let e = s.indexOf("\n", p);
        if (e < 0) e = s.length;
        let line = s.slice(p, e);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if ((h.strip ? line.replace(/^\t+/, "") : line) === h.delim) { end = p; next = Math.min(e + 1, s.length); break; }
        p = e + 1;
      }
      if (depth < APPROVAL_LEX_DEPTH && end > pos) {
        const body = s.slice(pos, end);
        if (h.shell) shellLexList(body, 0, h.shell, segs, false, depth + 1); // `bash <<'EOF'`: the body IS the script
        else if (!h.quoted) shellSubstitutionsIn(body, "bash", segs, depth + 1); // unquoted: its $( ) / `…` run
      }
      pos = next;
    }
    return pos;
  };
  let i = start;
  for (; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (c === "'" && !cmdm) { // single quotes: literal ('' is a quote in PowerShell)
      quoted = true; has = true;
      let j = i + 1;
      for (; j < s.length; j++) {
        if (s[j] === "'") { if (ps && s[j + 1] === "'") { add("'"); j++; continue; } break; }
        add(s[j]);
      }
      i = j;
      continue;
    }
    if (bash && c === "$" && n === "'") { // $'…' ANSI-C
      quoted = true; has = true;
      let j = i + 2;
      while (j < s.length && s[j] !== "'") {
        if (s[j] === "\\") { const e = ansiCEscape(s, j + 1); add(e.text); j = Math.max(e.end, j + 1); }
        else add(s[j++]);
      }
      i = j;
      continue;
    }
    if (c === '"' || (bash && c === "$" && n === '"')) { // double quotes ($"…" is Bash's locale string)
      quoted = true; has = true;
      let j = c === "$" ? i + 2 : i + 1;
      for (; j < s.length; j++) {
        const d = s[j];
        if (d === '"') { if (ps && s[j + 1] === '"') { add('"'); j++; continue; } break; }
        if (bash && d === "\\") {
          if (s[j + 1] === "\n") { j++; continue; }
          if (s[j + 1] === "\r" && s[j + 2] === "\n") { j += 2; continue; }
          if (j + 1 < s.length && "\"\\$`".includes(s[j + 1])) { add(s[++j]); continue; }
        }
        if (ps && d === "`" && j + 1 < s.length) { j++; add(own(PS_ESCAPES, s[j]) ? PS_ESCAPES[s[j]] : s[j]); continue; }
        if (!cmdm && d === "$" && s[j + 1] === "(") { const e = subst(j + 2); if (e >= 0) { j = e; continue; } }
        if (bash && d === "`") { const e = backtick(j); if (e >= 0) { j = e; continue; } }
        add(d);
      }
      i = j;
      continue;
    }
    if (bash && c === "\\") { // \x is x (raw keeps the backslash), \⏎ continues the line
      if (n === "\n") { i++; continue; }
      if (n === "\r" && s[i + 2] === "\n") { i += 2; continue; }
      if (n !== undefined) { add(n, "\\" + n); quoted = true; i++; continue; }
      add("\\");
      continue;
    }
    if ((ps && c === "`") || (cmdm && c === "^")) { // PowerShell's / cmd.exe's escape character
      if (n === "\n") { i++; continue; }
      if (n === "\r" && s[i + 2] === "\n") { i += 2; continue; }
      if (n !== undefined) { add(n); i++; }
      continue;
    }
    if (bash && c === "$" && n === "{") { // ${…}: part of the word ({ } are no separators inside it)
      let k = i + 2, lvl = 1;
      for (; k < s.length && lvl; k++) { if (s[k] === "{") lvl++; else if (s[k] === "}") lvl--; }
      const body = s.slice(i, k);
      add(body);
      if (/\$\(|`/.test(body) && depth < APPROVAL_LEX_DEPTH) shellSubstitutionsIn(body.slice(2), "bash", segs, depth + 1);
      i = k - 1;
      continue;
    }
    if (!cmdm && c === "$" && n === "(") { // $( … ): a command of its own; its output is part of this word
      const e = subst(i + 2);
      if (e >= 0) { has = true; i = e; continue; }
      endSeg(); paren++; i++;
      continue;
    }
    if (bash && c === "`") {
      const e = backtick(i);
      if (e >= 0) { has = true; i = e; continue; }
      endSeg();
      continue;
    }
    if (ps && c === "@" && (n === "'" || n === '"')) { // @'…'@ / @"…"@ here-string: data (a @"…"@ runs its $( ))
      const m = /^[ \t]*\r?\n/.exec(s.slice(i + 2, i + 66));
      if (m) {
        const bodyStart = i + 2 + m[0].length;
        const k = s.indexOf("\n" + n + "@", bodyStart - 1);
        const bodyEnd = k < 0 ? s.length : k;
        if (n === '"' && depth < APPROVAL_LEX_DEPTH && bodyEnd > bodyStart) shellSubstitutionsIn(s.slice(bodyStart, bodyEnd), "ps", segs, depth + 1);
        quoted = true; has = true;
        i = k < 0 ? s.length : k + 2;
        continue;
      }
    }
    if (ps && c === "<" && n === "#") { // <# … #> block comment
      endWord();
      const k = s.indexOf("#>", i + 2);
      i = (k < 0 ? s.length : k + 2) - 1;
      continue;
    }
    if (!cmdm && c === "#" && !has) { // a comment runs to the end of the line
      const k = s.indexOf("\n", i);
      i = (k < 0 ? s.length : k) - 1;
      continue;
    }
    if (c === "\n" || c === "\r") {
      endSeg();
      if (c === "\n" && heredocs.length) i = heredocBodies(i + 1) - 1;
      continue;
    }
    if (c === " " || c === "\t") { endWord(); continue; }
    if (bash && c === "&" && n === ">") continue; // &> / &>>: the redirection below
    if (bash && (c === "<" || c === ">") && n === "(") { endWord(); continue; } // <( … ) / >( … ): a process substitution
    if (bash && c === "<" && n === "<" && s[i + 2] !== "<" && arith && paren >= arith) { add("<<"); i++; continue; } // (( 1 << 2 )): a shift, no heredoc
    if (c === "<" || c === ">") { // a redirection: its target is no word of the command
      let op = "";
      if (has && !quoted && (ps ? /^(?:\d+|\*)$/ : /^\d+$/).test(cur)) { op = cur; cur = ""; raw = ""; has = false; } else endWord();
      let k;
      if (c === "<" && n === "<" && s[i + 2] === "<") { op += "<<<"; k = i + 3; }
      else if (bash && c === "<" && n === "<") { op = s[i + 2] === "-" ? "<<-" : "<<"; k = i + op.length; }
      else {
        op += c;
        k = i + 1;
        if (s[k] === c) { op += c; k++; }
        else if (c === ">" && s[k] === "|") { op += "|"; k++; }
        if (s[k] === "&") { op += "&"; k++; }
      }
      redir = op;
      i = k - 1;
      continue;
    }
    if (c === "(") { endSeg(); paren++; if (n === "(" && !arith) arith = paren + 1; continue; }
    if (c === ")") {
      if (inSub && paren === 0) { endSeg(); return i; }
      endSeg();
      if (paren) paren--;
      if (paren < arith) arith = 0;
      continue;
    }
    if (";&|{}".includes(c)) { endSeg(); continue; }
    add(c);
  }
  endSeg();
  return s.length;
}
// The $( … ) / `…` substitutions inside data that a shell still expands (an unquoted heredoc body, a PowerShell @"…"@ here-string,
// a ${…} expansion) → their commands, pushed into segs. Everything else in it is text.
function shellSubstitutionsIn(t, mode, segs, depth) {
  if (depth >= APPROVAL_LEX_DEPTH) return;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if ((mode === "bash" && c === "\\") || (mode === "ps" && c === "`")) { i++; continue; }
    if (c === "$" && t[i + 1] === "(") { i = shellLexList(t, i + 2, mode, segs, true, depth + 1); continue; }
    if (mode === "bash" && c === "`") {
      let k = i + 1;
      while (k < t.length && t[k] !== "`") k += t[k] === "\\" ? 2 : 1;
      k = Math.min(k, t.length);
      shellLexList(t.slice(i + 1, k), 0, mode, segs, false, depth + 1);
      i = k;
    }
  }
}
const approvalProgram = (w) => w.replace(/^.*[\\/]/, "").toLowerCase().replace(/\.exe$/, "");
// The index of the CLI's script in a simple command, when it is the program run (after launchers / env assignments / options) —
// never an argument of another program (`echo dev-spec approve x`, `git commit -m "…"`): -1.
function devSpecWordAt(words, raw) {
  const k = programAt(words, raw);
  return k >= 0 && (RE_DEVSPEC_WORD.test(words[k]) || RE_DEVSPEC_WORD.test((raw && raw[k]) || "")) ? k : -1;
}
// A simple command that writes .specs/roadmap.json (R1: where the approval guard lives) → a guard-down action, else null: a
// redirection to it (> >> >| &> 2> *>), a writer naming it (tee, Set-Content, Out-File, Add-Content, rm / Remove-Item, mv /
// Move-Item / ren, truncate, dd of=…), sed / perl -i on it, or cp / Copy-Item / ln / install onto it (the last path, a
// -Destination / -t value, or .specs/ receiving a roadmap.json). Reading it (cat, jq, cp FROM it) is no write.
function roadmapWriteAction(words, raw) {
  const redirs = words.redirs || [];
  if (redirs.some((t) => RE_ROADMAP_FILE.test(t))) return { kind: "guard-down", setting: "roadmap", source: "shell" };
  const k = programAt(words, raw);
  if (k < 0) return null;
  const p = approvalProgram(words[k]);
  const hit = (i) => [words[i], (raw && raw[i]) || ""].some((w) => RE_ROADMAP_FILE.test(w.replace(/^(?:of=|-(?:path|literalpath|filepath)[:=])/i, "")));
  const args = [];
  for (let i = k + 1; i < words.length; i++) args.push(i);
  const specsDir = (i) => [words[i], (raw && raw[i]) || ""].some((w) => RE_SPECS_DIR.test(w.replace(/^-(?:path|literalpath)[:=]/i, "")));
  let written = false;
  if (APPROVAL_WRITERS_ANY.has(p)) written = args.some(hit);
  if (!written && APPROVAL_REMOVERS.has(p)) written = args.some(specsDir);
  if (!written && APPROVAL_MOVERS.has(p)) written = args.filter((i) => !words[i].startsWith("-")).slice(0, -1).some(specsDir); // .specs/ as a source
  if (!written && APPROVAL_WRITERS_INPLACE.has(p)) written = args.some((i) => /^(?:-[A-Za-z]*i|--in-place)/.test(words[i])) && args.some(hit);
  if (!written && APPROVAL_WRITERS_TARGET.has(p)) {
    const pos = args.filter((i) => !words[i].startsWith("-") && !RE_DEST_OPTION.test(words[i - 1] || ""));
    const dest = args.filter((i) => RE_DEST_OPTION.test(words[i - 1] || "") || /^--target-directory=/.test(words[i]));
    const last = pos.length > 1 ? pos[pos.length - 1] : null;
    const targets = dest.concat(last == null ? [] : [last]);
    const destText = (i) => words[i].replace(/^--target-directory=/, "");
    written = targets.some(hit) ||
      (targets.some((i) => RE_SPECS_DIR.test(destText(i))) && pos.some((i) => i !== last && /(?:^|[\\/])roadmap\.json$/i.test(words[i])));
  }
  return written ? { kind: "guard-down", setting: "roadmap", source: "shell" } : null;
}
const approvalStr = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const approvalTruthy = (v) => v === true || (typeof v === "string" && !/^(?:false|0|no|off)$/i.test(v.trim()));
// The edit guard's strength (meta.guard): off < on < scope.
const guardRank = (g) => (g === "scope" ? 2 : g === true ? 1 : 0);
const guardName = (g) => (g === "scope" ? "scope" : g === true ? "on" : "off");
// spec_init / `init` settings → the GUARD-DOWN actions among them (R10: what weakens a protection the approval guard stands for;
// raising or adding is never one). ch = { approvalGuard, evidence, stopCheck, guard, roles (a validated map), checks ({name:
// command | ""}) } — the values the call would set; meta = the project's roadmap.json meta, or undefined when it can't be read
// (then every change that COULD weaken counts — fail closed).
function initGuardDowns(ch, level, meta) {
  const known = isObj(meta);
  const m = known ? meta : {};
  const out = [];
  if (ch.approvalGuard && lowersApprovalGuard(ch.approvalGuard, level)) out.push({ setting: "approvalGuard", from: level, to: ch.approvalGuard });
  if (ch.evidence === "reported" && (!known || m.evidence === "observed")) out.push({ setting: "evidence", from: known ? "observed" : null, to: "reported" });
  if (ch.stopCheck === false && (!known || m.stopCheck !== false)) out.push({ setting: "stopCheck", from: known ? "on" : null, to: "off" });
  if (ch.guard !== undefined) {
    const cur = known ? (m.guard === true || m.guard === "scope" ? m.guard : false) : null;
    if (cur === null ? ch.guard !== "scope" : guardRank(ch.guard) < guardRank(cur)) out.push({ setting: "guard", from: cur === null ? null : guardName(cur), to: guardName(ch.guard) });
  }
  if (ch.roles) {
    const cur = known ? approvalRolesFrom(m.approvalRoles) : null;
    const removed = cur ? Object.entries(cur).flatMap(([ph, rs]) => rs.filter((r) => !(own(ch.roles, ph) ? ch.roles[ph] : []).includes(r)).map((r) => ph + "=" + r)) : null;
    if (!cur || removed.length) out.push({ setting: "roles", to: ch.roles, removed });
  }
  if (ch.checks) {
    for (const [name, command] of Object.entries(ch.checks)) {
      const cur = !known ? null : isObj(m.checks) && own(m.checks, name) && typeof m.checks[name] === "string" ? m.checks[name] : undefined;
      if (command === "" ? cur !== undefined : cur === null || (typeof cur === "string" && cur.trim() !== command.trim())) out.push({ setting: "check", name, to: command === "" ? null : command });
    }
  }
  return out.map((a) => Object.assign({ kind: "guard-down" }, a));
}
// spec_init {approvalRoles} / {checks} → what they would set (the engine's own validation — a refused value changes nothing).
function initRolesInput(v) {
  if (v === undefined || v === null) return undefined;
  const r = validateApprovalRoles(v, "en");
  return r.ok ? r.map : undefined;
}
function initChecksInput(v) {
  const nc = checksInput(v, "en");
  if (!nc || nc.error) return undefined;
  const out = {};
  for (const k of nc.remove) out[k] = "";
  return Object.assign(out, nc.set);
}
// The words after the CLI's script → the approvals / guard-down actions it would record ([] = none). Read twice: with the CLI's
// value flags (a `--flag` that is no switch takes the next word), then with every flag as a switch — `approve` is found either way.
function cliApprovalAction(args, level, meta) {
  for (const valueFlags of [true, false]) {
    const pos = [];
    const fl = Object.create(null);
    const checkVals = []; // --check is repeatable (init --check name=cmd)
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--") { pos.push(...args.slice(i + 1)); break; }
      const m = /^--([A-Za-z][\w-]*)(?:=([\s\S]*))?$/.exec(a);
      if (!m) { pos.push(a); continue; }
      const k = m[1].toLowerCase();
      if (m[2] !== undefined) fl[k] = m[2];
      else if (valueFlags && !CLI_SWITCHES.has(k) && args[i + 1] !== undefined && !/^--[A-Za-z]/.test(args[i + 1])) fl[k] = args[++i];
      else fl[k] = true;
      if (k === "check") checkVals.push(fl[k]);
    }
    if (approvalTruthy(fl.help)) return []; // `<command> --help` prints the help and runs nothing
    const cmd = String(pos[0] || "").toLowerCase();
    const base = { source: "cli", project: approvalStr(fl.project) };
    if (cmd === "approve") {
      return [Object.assign({ kind: "approve", feature: approvalStr(pos[1]), phase: approvalStr(pos[2]), through: approvalStr(fl.through),
        role: approvalStr(fl.role), by: approvalStr(fl.by), force: approvalTruthy(fl.force) }, approvalExtras(approvalTruthy(fl.revoke), fl.reason, fl.expires), base)];
    }
    // `feature remove <name>` without --yes only previews what it would delete.
    if (cmd === "feature" && String(pos[1] || "").toLowerCase() === "remove" && approvalTruthy(fl.yes)) return [Object.assign({ kind: "remove", feature: approvalStr(pos[2]) }, base)];
    if (cmd === "init") {
      const onOff = (v) => { const s = typeof v === "string" ? v.trim().toLowerCase() : ""; return ["on", "true", "yes", "1"].includes(s) ? true : ["off", "false", "no", "0"].includes(s) ? false : s === "scope" ? "scope" : undefined; };
      const rolesText = typeof fl.roles === "string" ? parseApprovalRolesText(fl.roles, "en") : undefined;
      // A --check without name= makes the CLI stop before anything is written: no check changes then.
      const checks = checkVals.length && checkVals.every((v) => typeof v === "string" && v.indexOf("=") > 0)
        ? initChecksInput(Object.fromEntries(checkVals.map((v) => [v.slice(0, v.indexOf("=")).trim(), v.slice(v.indexOf("=") + 1)]))) : undefined;
      const stop = onOff(fl["stop-check"]);
      const acts = initGuardDowns({ approvalGuard: approvalGuardInput(fl["approval-guard"]), evidence: evidenceModeInput(fl.evidence),
        stopCheck: stop === false ? false : undefined, guard: onOff(fl.guard), roles: rolesText && !rolesText.error ? initRolesInput(rolesText) : undefined, checks }, level, meta);
      if (acts.length) return acts.map((a) => Object.assign(a, base));
    }
  }
  return [];
}
// Every approval / guard-down action a shell command runs (each simple command; the scripts of bash -c / cmd /c / pwsh -Command
// …, of a heredoc / here-string fed to a shell; a write to .specs/roadmap.json).
function shellApprovalActions(command, level, depth, mode, meta) {
  const out = [];
  for (const words of shellCommandWords(command, mode)) {
    const raw = words.raw || words;
    const at = devSpecWordAt(words, raw);
    if (at >= 0) out.push(...cliApprovalAction(words.slice(at + 1), level, meta));
    const w = roadmapWriteAction(words, raw);
    if (w) out.push(w);
    if (depth >= APPROVAL_SHELL_DEPTH) continue;
    const end = at >= 0 ? at : words.length;
    let shell = null;
    for (let j = 0; j < end; j++) {
      if (shell && /\s/.test(words[j]) && approvalCandidate(words[j])) out.push(...shellApprovalActions(words[j], level, depth + 1, shell, meta));
      const p = approvalProgram(words[j]);
      if (APPROVAL_SHELLS.has(p)) shell = approvalShellMode(p);
    }
    if (words.stdinShell) for (const h of words.herestrings || []) if (approvalCandidate(h)) out.push(...shellApprovalActions(h, level, depth + 1, words.stdinShell, meta));
  }
  return out;
}
// 1.16 U: a revocation (revoke: true — the same gate as an approval: the approval record is the human's) and a waiver's reason /
// expiry (carried into the command the human runs) → the extra fields of an "approve" action (none when absent).
function approvalExtras(revoke, reason, expires) {
  const out = {};
  if (revoke) out.revoke = true;
  if (approvalStr(reason)) out.reason = approvalStr(reason);
  if (approvalStr(expires)) out.expires = approvalStr(expires);
  return out;
}
function mcpApprovalAction(tool, ti, level, meta) {
  const base = { source: "mcp", project: approvalStr(ti.projectDir) };
  if (tool === "spec_approve") {
    return [Object.assign({ kind: "approve", feature: approvalStr(ti.name), phase: approvalStr(ti.phase), through: approvalStr(ti.through),
      role: approvalStr(ti.role), by: approvalStr(ti.by), force: ti.force === true }, approvalExtras(ti.revoke === true, ti.reason, ti.expires), base)];
  }
  // spec_feature remove without confirm: true only previews what it would delete; archive / rename / restore / flow aren't approvals.
  if (tool === "spec_feature") return String(approvalStr(ti.action) || "").toLowerCase() === "remove" && ti.confirm === true ? [Object.assign({ kind: "remove", feature: approvalStr(ti.name) }, base)] : [];
  // spec_init: only what LOWERS a protection (the approval guard, the evidence mode, roles, project checks, the stop gate, the edit guard).
  return initGuardDowns({ approvalGuard: approvalGuardInput(ti.approvalGuard), evidence: evidenceModeInput(ti.evidence), stopCheck: ti.stopCheck === false ? false : undefined,
    guard: guardInput(ti.guard), roles: initRolesInput(ti.approvalRoles), checks: initChecksInput(ti.checks) }, level, meta).map((a) => Object.assign(a, base));
}
// The command the human runs instead (`! node "<clone>/cli/dev-spec.js" approve <f> <phase> …`), or null when there is none (a
// shell write of roadmap.json). A value from the agent's call goes in only when it is plainly safe to paste into bash / PowerShell
// (else a <placeholder>): no quote, $, backtick, backslash or !.
function approvalCommand(a, cli) {
  const safe = (v, re) => (typeof v === "string" && re.test(v) ? v : null);
  const word = (v, ph) => safe(v, /^[\p{L}\p{N}_.-]{1,80}$/u) || ph;
  const name = (v) => { const s = safe(v, /^[\p{L}\p{N} _.@+,-]{1,120}$/u); return s ? (/\s/.test(s) ? '"' + s + '"' : s) : "<feature>"; };
  const words = ["node", '"' + cli + '"'];
  if (a.kind === "remove") words.push("feature", "remove", name(a.feature), "--yes");
  else if (a.kind === "guard-down") {
    if (a.setting === "roadmap") return null;
    if (a.setting === "evidence") words.push("init", "--evidence", "reported");
    else if (a.setting === "stopCheck") words.push("init", "--stop-check", "off");
    else if (a.setting === "guard") words.push("init", "--guard", a.to === "on" ? "on" : "off");
    else if (a.setting === "roles") {
      const map = isObj(a.to) ? a.to : {};
      words.push("init", "--roles", Object.keys(map).length ? '"' + Object.entries(map).map(([p, r]) => p + "=" + r.join("+")).join(",") + '"' : "none");
    } else if (a.setting === "check") {
      const n = safe(a.name, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,39}$/) || "<name>";
      words.push("init", "--check", '"' + n + "=" + (a.to == null ? "" : safe(a.to, /^[\p{L}\p{N} _.@+,:/=-]{1,200}$/u) || "<command>") + '"');
    } else words.push("init", "--approval-guard", a.to);
  } else {
    words.push("approve", name(a.feature));
    if (a.through) words.push("--through", word(a.through, "<phase>"));
    else words.push(word(a.phase, "<phase>"));
    if (a.role) words.push("--role", word(a.role, "<role>"));
    if (a.revoke) words.push("--revoke"); // 1.16 U2: the human revokes — never an approve line in its place
    else if (a.force) words.push("--force");
    // 1.16 U3 / U2: the reason (a waiver's, a revocation's) and the expiry go in only when plainly safe to paste, else a placeholder
    if (a.reason) words.push("--reason", "\"" + (safe(a.reason, /^[\p{L}\p{N} _.,:;@+()/-]{1,200}$/u) || "<reason>") + "\"");
    if (a.expires && !a.revoke) words.push("--expires", word(a.expires, "<YYYY-MM-DD>"));
  }
  const proj = a.project ? safe(a.project.replace(/\\/g, "/"),/^[\p{L}\p{N} _.@+,:/()~-]{1,400}$/u) : null;
  if (proj) words.push("--project", '"' + proj + '"');
  return words.join(" ");
}

// The approval guard's decision for ONE tool call (the PreToolUse payload: tool_name + tool_input) at `level` ("off" | "ask" |
// "deny" — the project's meta.approvalGuard, read by the caller). Pure. → { decision: "allow" | "ask" | "deny", why, level, … };
// why (stable): off · no-payload · not-pre-tool-use · not-an-approval · approval. On an approval: `actions` [{kind: approve |
// remove | guard-down, source: mcp | cli | shell, feature, phase, through, role, by, force, setting (guard-down: approvalGuard |
// evidence | roles | check | stopCheck | guard | roadmap), from, to, name, removed, project}], `force`, `command` (what the human
// runs, `!`-prefixed; null when there is none), `reason` (localized — opts.lang: the user reads it for ask, the agent for deny)
// and, for deny, `userNote` (the line the user sees). opts.cli: the CLI path shown (default: this clone's cli/dev-spec.js);
// opts.meta: the project's roadmap.json meta (what a spec_init / `init` change is compared with — absent: unknown, fail closed).
function approvalGuardDecision(payload, level, opts = {}) {
  const lvl = approvalGuardInput(level) || "off";
  const allow = (why, extra) => Object.assign({ decision: "allow", why, level: lvl }, extra);
  if (lvl === "off") return allow("off");
  if (!isObj(payload)) return allow("no-payload");
  const event = payload.hook_event_name || payload.hookEventName;
  if (event && event !== "PreToolUse") return allow("not-pre-tool-use");
  const tool = typeof payload.tool_name === "string" ? payload.tool_name : typeof payload.toolName === "string" ? payload.toolName : "";
  const ti = isObj(payload.tool_input) ? payload.tool_input : isObj(payload.toolInput) ? payload.toolInput : {};
  const meta = isObj(opts.meta) ? opts.meta : undefined;
  let actions = [];
  const m = RE_APPROVAL_MCP.exec(tool);
  if (m) actions = mcpApprovalAction(m[1], ti, lvl, meta);
  else if (APPROVAL_SHELL_TOOLS.has(tool) && typeof ti.command === "string" && approvalCandidate(ti.command.slice(0, APPROVAL_COMMAND_MAX))) {
    actions = shellApprovalActions(ti.command.slice(0, APPROVAL_COMMAND_MAX), lvl, 0, tool === "PowerShell" ? "ps" : "bash", meta);
  }
  if (!actions.length) return allow("not-an-approval", { tool });
  const A = i18n.msg(normalizeLang(opts.lang || "en")).approvalGuard;
  // Shown as text (the prompt, the agent's context): one line each, bounded.
  const show = (v) => (v == null ? v : (() => { const s = String(v).replace(/[\u0000-\u001f\u007f]+/g, " "); return s.length > 80 ? s.slice(0, 79) + "…" : s; })());
  const list = actions.map((a) => A.action(Object.assign({}, a, { feature: show(a.feature), phase: show(a.phase), through: show(a.through), role: show(a.role), by: show(a.by),
    name: show(a.name), removed: Array.isArray(a.removed) ? a.removed.map(show) : a.removed })));
  const text = [...new Set(list)].join("; ");
  const force = actions.some((a) => a.force);
  const cli = typeof opts.cli === "string" && opts.cli ? opts.cli : toPosix(path.resolve(__dirname, "..", "..", "..", "cli", "dev-spec.js"));
  const commands = [...new Set(actions.map((a) => approvalCommand(a, cli)).filter(Boolean))];
  const command = commands.length ? "! " + commands.join(" && ") : null;
  const res = { decision: lvl, why: "approval", level: lvl, tool, actions, force, command, reason: lvl === "deny" ? A.deny(text, command) : A.ask(text, force) };
  if (lvl === "deny") res.userNote = A.denyUser(text, command);
  return res;
}

module.exports = { APPROVAL_GUARD_LEVELS, RE_APPROVAL_MCP, APPROVAL_SHELL_TOOLS, APPROVAL_COMMAND_MAX,
  APPROVAL_SHELL_DEPTH, APPROVAL_LEX_DEPTH, CLI_SWITCHES, APPROVAL_WRAPPERS, APPROVAL_SUBCOMMANDS,
  APPROVAL_OPTION_VALUES, APPROVAL_SHELLS, APPROVAL_PS_SHELLS, APPROVAL_STDIN_SHELLS, approvalShellMode,
  RE_DEVSPEC_WORD, RE_APPROVAL_VAR_WORD, RE_APPROVAL_CANDIDATE, approvalCandidate, RE_ROADMAP_FILE, RE_SPECS_DIR,
  APPROVAL_WRITERS_ANY, APPROVAL_REMOVERS, APPROVAL_MOVERS, APPROVAL_WRITERS_TARGET, APPROVAL_WRITERS_INPLACE,
  RE_DEST_OPTION, approvalGuardInput, RE_RAW_APPROVAL_GUARD, rawApprovalGuard, approvalGuardLevel, setApprovalGuard,
  lowersApprovalGuard, ANSI_C_ESCAPES, ansiCEscape, PS_ESCAPES, shellCommandWords, programAt, stdinShellMode,
  shellLexList, shellSubstitutionsIn, approvalProgram, devSpecWordAt, roadmapWriteAction, approvalStr, approvalTruthy,
  guardRank, guardName, initGuardDowns, initRolesInput, initChecksInput, cliApprovalAction, shellApprovalActions,
  approvalExtras, mcpApprovalAction, approvalCommand, approvalGuardDecision, __link };
