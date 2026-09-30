"use strict";

/**
 * dev-spec-driven engine — evidence and verification.
 * The evidence gate (ONE verdict: taskVerification), run records, the shells `done --run` uses, red → green
 * (_Expect: fail_), harness-observed runs (observed.jsonl), the project's check commands and git-linked evidence.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeTasks, baselineFiles, cleanTaskText, codeSpan, detectTracks, duplicateTaskNumbers, errs, existingFeature,
  extractAcIds, extractTestIds, featureDirs, featureLang, fileHash, FOLD_CASE, forgetCached, headRest, isBacktickUnit,
  isDirSafe, isObj, loadRoadmap, normalizeLang, oneLine, planIdText, projectLang, PROTO_KEYS, readIfExists, readRoadmap,
  readState, roadmapPath, specsRoot, statePath, stripEnds, taskBlocks, taskMarkers, taskProse, timeOf, tKey, toPosix,
  traceTestCode, withRoadmapLock, writeFileAtomic, writeIfAbsent, writeRoadmap;
function __link(E) { ({ activeTasks, baselineFiles, cleanTaskText, codeSpan, detectTracks, duplicateTaskNumbers, errs,
  existingFeature, extractAcIds, extractTestIds, featureDirs, featureLang, fileHash, FOLD_CASE, forgetCached, headRest,
  isBacktickUnit, isDirSafe, isObj, loadRoadmap, normalizeLang, oneLine, planIdText, projectLang, PROTO_KEYS,
  readIfExists, readRoadmap, readState, roadmapPath, specsRoot, statePath, stripEnds, taskBlocks, taskMarkers,
  taskProse, timeOf, tKey, toPosix, traceTestCode, withRoadmapLock, writeFileAtomic, writeIfAbsent, writeRoadmap } = E); }

// Verification evidence (verification-before-completion): a task that declares _Verify: <command>_ is only
// trustworthy when its result was recorded. Evidence lives in .state.json → evidence[<task number>].
function normalizeEvidence(ev) {
  if (ev == null || ev === "") return null;
  if (typeof ev === "string") return ev.trim() ? { summary: ev.slice(0, 2000), manual: true } : null;
  if (typeof ev !== "object") return null;
  const out = {};
  if (ev.command != null && String(ev.command).trim()) out.command = String(ev.command).slice(0, 500);
  if (ev.exitCode != null && ev.exitCode !== "") {
    const raw = String(ev.exitCode).trim();
    if (!/^-?\d+$/.test(raw)) return { error: "badExit", value: raw };
    out.exitCode = parseInt(raw, 10);
  }
  if (ev.summary != null && String(ev.summary).trim()) out.summary = String(ev.summary).slice(0, 2000);
  Object.assign(out, gitEvidence(ev)); // B5: the commit the run was made on (+ dirty) — `done --run` fills it; a malformed value is dropped
  if (out.command && out.exitCode == null) return { error: "needsExit" };
  // A bare exit code proves nothing ({exitCode: 0} used to verify a task on its own).
  if (!out.command && !out.summary) return out.exitCode != null ? { error: "noContent" } : null;
  // "exit 0" with no command is a claim, not a run: it stays a note, so it can't clear a recorded failed run
  // (a non-zero one is still refused and recorded — erring toward "not verified").
  if (!out.command && out.exitCode === 0) delete out.exitCode;
  if (out.exitCode == null) out.manual = true; // a human-attested check (no command was run)
  return out;
}
// Why a task is NOT verified — a stable reason code (null = verified):
//   no-evidence · failed-run (the latest recorded run failed; only a later PASSING run clears it) ·
//   manual-note-on-runnable-verify (the task's _Verify:_ holds a command, but only a note was given) ·
//   duplicate-number · stale-evidence (see taskEvidenceIssue).
// `runnable` = the task's _Verify:_ is a real command (not a [bracketed placeholder/manual note]): then
// only {command, exitCode: 0} verifies it. A check with no command may be attested by a summary. An exit
// code only proves a RUNNABLE _Verify:_ next to the command that produced it (a v1.12 record could hold a bare
// {exitCode: 0}). A task with no runnable _Verify:_ is outside the run gate — with no record at all it passes —
// so the v1.12 bare {exitCode: 0} (1.12's "done (verified)") passes there too: legacy evidence must never leave
// a task worse off than none (it used to block spec_finish, and neither a note nor --run could clear it).
function evidenceIssue(e, runnable, expectFail) {
  if (!e || typeof e !== "object" || Array.isArray(e)) return "no-evidence";
  // spec_impact --reopen: the spec this record proved changed — only a new run (or, without a runnable _Verify:_, a new note) clears it.
  if (e.stale === true) return "stale-evidence";
  if (expectFail) return expectFailIssue(e, runnable); // _Expect: fail_ (B5): a red run is the proof, a pass is unexpected-pass
  if (e.exitCode != null && e.exitCode !== 0) return "failed-run";
  if (runnable) return e.command && e.exitCode === 0 ? null : "manual-note-on-runnable-verify";
  return e.exitCode === 0 || !!e.summary ? null : "no-evidence";
}
// Evidence is keyed by task NUMBER and stamped with its task: `task` (the text) and `verify` (the task's
// runnable _Verify:_ command(s) when it was recorded). A stamped record counts only while that _Verify:_ is
// unchanged — an edited command's old run proves nothing, a plain title edit keeps it. A record made while
// the number was shared by several tasks (`shared`) must match the title too, for good: ticking the second
// "3." never borrows the first one's run, not even once the doctor's duplicate-tasks warn got them
// renumbered. An unstamped (v1.12) record counts while the number is unique.
const taskStamp = (block) => String(block.text || "").slice(0, 500);
const verifyStamp = (block) => taskMarkers(block).verify.join("\n").slice(0, 1000);
const isRecord = (v) => v != null && typeof v === "object" && !Array.isArray(v);
// evidence[n] is the latest record; `others` keeps the records of the other tasks that share(d) number n.
function evidenceRecords(slot) {
  return isRecord(slot) ? [slot, ...(Array.isArray(slot.others) ? slot.others.filter(isRecord) : [])] : [];
}
function ownRecord(slot, block, dup) {
  if (!isRecord(slot)) return dup ? undefined : slot;
  const text = taskStamp(block), verify = verifyStamp(block);
  const fits = (r) => r.verify == null || r.verify === verify;
  const recs = evidenceRecords(slot);
  return recs.find((r) => r.task === text && fits(r)) ||
    (dup ? undefined : recs.find((r) => !r.shared && fits(r) && (r === slot || r.task != null)));
}
function ownEvidence(evidence, block, dup) {
  return ownRecord(evidence[String(block.number)], block, dup);
}
function taskEvidenceIssue(evidence, block, dup) {
  const e = ownEvidence(evidence, block, dup);
  const reason = evidenceIssue(e, taskMarkers(block).verify.length > 0, expectsFail(block));
  if (reason !== "no-evidence" || e !== undefined || !evidenceRecords(evidence[String(block.number)]).length) return reason;
  // The number HAS records, none of them this task's: another task shares the number (duplicate-number), or
  // they are for an earlier _Verify:_ command / a task that held the number before a renumbering.
  return dup ? "duplicate-number" : "stale-evidence";
}
// The evidence gate's verdict for one task → { reason, nothingToVerify }: `reason` a stable code, or null (verified). The
// ONE rule behind every public `verified` (spec_complete_task, spec_status, spec_impact's per-task `evidence`) and every
// unverified list (doctor, spec_finish, ROADMAP.md): a task with no runnable _Verify:_ is outside the run gate, so nothing
// recorded for THIS task (a duplicated number's record may be the other's) — or a record that proves nothing — is no
// worse than no record, and passes (`nothingToVerify`: nothing was run or attested, so no surface calls it a check); only
// its own failed run or stale record counts against it. (spec_complete_task used to answer verified:false with no reason
// for such a task while doctor, finish and the roadmap passed it.)
// mode (1.14 F1): the project's evidenceMode — "observed" verifies a runnable _Verify:_ only when the run that proves it was
// observed by the harness or made by the CLI (observedProof), else reason `unobserved`; "reported" / absent: today's rule.
function taskVerification(evidence, block, dup, mode) {
  const rule = typeof mode === "string" ? { mode } : mode || {}; // evidenceRule(): { mode, since }
  if (taskMarkers(block).verify.length) {
    const reason = taskEvidenceIssue(evidence, block, dup);
    if (reason || rule.mode !== "observed" || observedProof(ownEvidence(evidence, block, dup), expectsFail(block), rule.since)) return { reason, nothingToVerify: false };
    return { reason: "unobserved", nothingToVerify: false };
  }
  const reason = ownEvidence(evidence, block, dup) == null ? "no-evidence" : taskEvidenceIssue(evidence, block, dup);
  return reason === "no-evidence" ? { reason: null, nothingToVerify: true } : { reason, nothingToVerify: false };
}
// evidence[n] stays the LATEST RUN {command, exitCode, summary, at} (the v1.12 shape) plus `history`, its
// last EVIDENCE_HISTORY runs (oldest dropped) for pass-rate metrics, and the stamps. A note after a run is
// attached as `note` — it never overwrites (or clears) the run's result. A v1.12 bare {exitCode: 0} (no command)
// was a claim, not a run: a note after it becomes the record's summary (attaching it as `note` left it unreadable).
const EVIDENCE_HISTORY = 5;
const EVIDENCE_OTHERS = 5;
function recordEvidence(prev, ev, at, stamp) {
  const p = isRecord(prev) ? prev : null;
  const pRun = p && p.exitCode != null;
  const stamped = (r) => { const o = { ...r, ...stamp }; if (!stamp.shared) delete o.shared; delete o.others; return o; };
  if (ev.exitCode == null) {
    const claim = pRun && p.exitCode === 0 && !p.command; // v1.12 bare exit 0: the note replaces it
    const rec = stamped(pRun && !claim ? { ...p, note: ev.summary, noteAt: at } : { ...ev, at });
    if (stamp.verify) return rec; // a note never clears a stale run of a runnable _Verify:_ (only a new run does)
    delete rec.stale; // no runnable _Verify:_: a new note IS the re-check after a spec change (or an undo)
    delete rec.staleBy;
    return rec;
  }
  let hist = p && Array.isArray(p.history) ? p.history.filter((h) => h && typeof h === "object") : [];
  if (!hist.length && pRun) hist = [runOf(p)]; // a v1.12 record: its run seeds the history
  const run = runOf({ ...ev, at });
  const rec = { ...run, history: hist.concat([run]).slice(-EVIDENCE_HISTORY) };
  // B5: an _Expect: fail_ task's red run stays its proof (`red`) when a later run passes — its fix made the test green.
  const keep = ev.keepRed === true ? redProof(p) : null;
  if (keep) rec.red = keep;
  return stamped(rec);
}
// evidence[n] after a run/note for `block`: its own record, updated, becomes the latest; every OTHER task's
// record under that number is kept in `others` (newest first, bounded) — never discarded, so a renumbering
// can't hand one task's passing run to the other, nor lose the other's failed run.
function storeEvidence(slot, block, dup, ev, at) {
  const own = ownRecord(slot, block, dup);
  const stamp = { task: taskStamp(block), verify: verifyStamp(block) };
  if (dup) stamp.shared = true;
  const rec = recordEvidence(own, ev, at, stamp);
  const others = evidenceRecords(slot).filter((r) => r !== own).map(({ others: _nested, ...r }) => r).slice(0, EVIDENCE_OTHERS);
  return others.length ? { ...rec, others } : rec;
}
function runOf(e) {
  const r = {};
  // expected: "fail" (_Expect: fail_), commit / dirty (the git state `done --run` saw) — B5; observed (true | false | "cli": the
  // harness — or the CLI itself — saw the run, 1.14 F1); absent on older records
  for (const k of ["command", "exitCode", "summary", "at", "expected", "commit", "dirty", "observed"]) if (e[k] != null) r[k] = e[k];
  return r;
}
function stateEvidence(projectDir, slug) {
  const e = readState(projectDir, slug).evidence;
  return isRecord(e) ? e : {};
}
// Ticked tasks that are not verified: every task whose _Verify:_ holds a command, and any task with a
// recorded run (a failed run stays a failure until a passing one). One entry per task number.
function verificationStatus(projectDir, slug, dir) {
  // A removed track's tasks stay on disk but are inactive — not a verification gap (same view as status/finish).
  const blocks = taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", detectTracks(dir)) || "");
  const evidence = stateEvidence(projectDir, slug);
  const withVerify = blocks.filter((b) => taskMarkers(b).verify.length);
  const dups = new Set(duplicateTaskNumbers(blocks));
  const mode = evidenceRule(projectDir); // 1.14 F1: meta.evidence "observed" — an unobserved run verifies nothing
  const unverifiedDetail = [];
  for (const b of blocks) {
    if (!b.done || unverifiedDetail.some((d) => d.number === b.number)) continue;
    const { reason } = taskVerification(evidence, b, dups.has(b.number), mode); // the rule every `verified` shares
    // specChanged: the task's OWN record was marked stale by spec_impact --reopen (same code, a more precise label).
    if (reason) unverifiedDetail.push({ number: b.number, reason, ...(specChangedSince(evidence, b, dups.has(b.number), reason) ? { specChanged: true } : {}),
      ...(untickedSince(evidence, b, dups.has(b.number), reason) ? { unticked: true } : {}) }); // 1.16 U1: unticked since the record
  }
  return { withVerify: withVerify.length, evidence, unverified: unverifiedDetail.map((d) => d.number), unverifiedDetail };
}
// What `done --run` records of a run's output: the last 3 lines that report counts (`node --test` prints
// "ℹ pass 5" / "ℹ fail 0" before trailing noise, so a plain tail lost them) plus the last lines — deduped,
// in output order, capped at ~max chars (plain lines are dropped before count lines). A count line has a
// NUMBER next to the keyword ("5 passing", "tests: 3", "# fail 0"): failure details like "✖ failing tests:"
// also say "fail"/"test" and would otherwise push the real counts out. Whitespace before the number, so a
// stack frame's "test_runner/test:960:18" (file:line) is not "test: 960".
const RE_COUNT_KW = "(?:tests?|pass(?:ed|es|ing)?|fail(?:ed|s|ing|ures?)?|ok|errors?)";
const RE_COUNT_LINE = new RegExp(`(?<![\\p{L}\\p{N}_])(?:\\d+\\s*${RE_COUNT_KW}|${RE_COUNT_KW}:?\\s+\\d+)(?![\\p{L}_])`, "iu");
// 1.21.1 — terminal colour codes: PowerShell 7 (and Pester under it) colours its output even when it is captured
// ("\e[91m[-] T-01 …\e[0m", "\e[97mTests Passed: 0, \e[0m\e[91mFailed: 1"), and so do runners forced to (FORCE_COLOR). They
// are dropped before a run is summarized or read for could-not-run phrases: CSI sequences (ESC [ … final byte) and OSC ones
// (ESC ] … BEL / ESC \). Built from char codes — never a raw control character (or its escape through an editor) in source.
const ESC = String.fromCharCode(27), BEL = String.fromCharCode(7);
const RE_ANSI = new RegExp(ESC + "\\[[0-9;?]*[ -/]*[@-~]|" + ESC + "\\][^" + BEL + ESC + "]{0,2000}(?:" + BEL + "|" + ESC + "\\\\)?", "g");
const stripAnsi = (s) => (s.indexOf(ESC) === -1 ? s : s.replace(RE_ANSI, ""));
function summarizeRunOutput(output, max = 500) {
  const lines = stripAnsi(String(output || "")).split(/\r?\n/).map((l) => l.trimEnd().slice(0, 200)).filter((l) => l.trim());
  const counts = lines.map((l, i) => (RE_COUNT_LINE.test(l) ? i : -1)).filter((i) => i >= 0).slice(-3);
  const idx = [...new Set([...counts, ...lines.map((_, i) => i).slice(-5)])].sort((a, b) => a - b);
  const seen = new Set();
  const picked = idx.reverse().filter((i) => !seen.has(lines[i]) && seen.add(lines[i])).reverse()
    .map((i) => ({ text: lines[i], count: counts.includes(i) }));
  const size = () => picked.reduce((s, p) => s + p.text.length + 1, -1);
  while (picked.length > 1 && size() > max) {
    const plain = picked.findIndex((p) => !p.count);
    picked.splice(plain === -1 ? 0 : plain, 1);
  }
  return picked.map((p) => p.text).join("\n").slice(0, max);
}
// POSIX-only shell syntax in a _Verify:_ command that cmd.exe — the default shell of `dev-spec done --run` on Windows —
// reads differently, often WITHOUT failing: cmd.exe has no single quotes (`node -e 'process.exit(1)'` evaluates a string
// literal and exits 0) and never expands `$VAR` / `${…}` / `$(…)`. Quote state is tracked the way cmd.exe does it (every
// `"` toggles), so an apostrophe inside double quotes, or a lone one (`it's`), is not a single-quoted string.
// → the stable codes found, in order: "single-quotes" | "variable" ([] = nothing POSIX-only).
// A failure cmd.exe itself reported — the command line never ran as written — the only case where `done --run`'s
// "--shell bash" hint helps (POSIX quoting / $VAR is refused before anything runs): an unknown command (exit 9009,
// "… is not recognized as an internal or external command"), a syntax error cmd.exe raised ("The syntax of the command is
// incorrect", "… was unexpected at this time"), a path it could not resolve ("The system cannot find the path specified").
// EN / PT / ES Windows wording. A check that ran and failed (`node tests/x.js` → exit 1) is none: it printed the hint on
// every failed run.
const RE_CMD_SHELL_FAILURE = new RegExp([
  "is not recognized as an internal or external command", "n[ãa]o [ée] reconhecido como (?:um )?comando interno", "no se reconoce como (?:un )?comando interno",
  "the syntax of the command is incorrect", "a sintaxe do comando est[áa] incorreta", "la sintaxis del comando no es correcta",
  "was unexpected at this time", "n[ãa]o era esperad[oa] (?:nesta altura|neste momento)", "era inesperad[oa] neste momento", "no se esperaba en este momento",
  "cannot find the path specified", "n[ãa]o (?:pode|consegue|conseguiu) (?:encontrar|localizar) o caminho especificado", "no puede (?:encontrar|hallar) la ruta especificada",
  "the filename, directory name, or volume label syntax is incorrect",
].join("|"), "i");
function windowsShellFailure(output, code) {
  return code === 9009 || RE_CMD_SHELL_FAILURE.test(String(output == null ? "" : output).slice(0, 200000));
}
// full review Ga9 — the shell `dev-spec done --run` / `finish --run` runs a command with. requested: --shell / DEV_SPEC_SHELL
// ("" = the platform default: cmd.exe on Windows, /bin/sh elsewhere). On Windows a bare `bash` resolves to Git Bash — never
// to WSL's launcher (C:\Windows\System32\bash.exe, …\WindowsApps\bash.exe): PATH lists it first from PowerShell / cmd, and it
// runs the command inside a Linux distribution or fails ("execvpe(/bin/bash) failed", exit 1 for every command — a passing
// check recorded as failed, a bogus red run). Candidates, in order: git --exec-path's install (<git>/mingw64/libexec/git-core
// → <git>/bin/bash.exe, then usr/bin), %ProgramFiles% / %ProgramW6432% / %ProgramFiles(x86)% / %LOCALAPPDATA%\Programs \Git\bin,
// then the first bash.exe on PATH that is not WSL's (MSYS2, Cygwin). An EXPLICIT path is the user's choice and is used as
// given — WSL's launcher too (running the checks inside a Linux distribution on purpose), flagged `wsl: true`; a run WSL's
// relay fails is still could-not-run (couldNotRunOutput kind `wsl`: nothing recorded). 1.14 refused that path (`wsl-bash`).
// Pure: the CLI passes what it knows (opts.gitExecPath — git's own output —, opts.env, opts.exists, opts.platform); the engine
// never runs a command or git. → { shell: true | "<shell>", cmd: <cmd.exe runs it>, resolved?: true, wsl?: true } |
// { error: "no-git-bash" }
const RE_WSL_LAUNCHER_DIR = /[\\/](?:system32|syswow64|sysnative|windowsapps)[\\/][^\\/]*$/i;
function isWslLauncher(p) {
  const s = String(p == null ? "" : p).trim().replace(/^"|"$/g, "");
  return /^(?:bash|wsl)(?:\.exe)?$/i.test(path.win32.basename(s)) && RE_WSL_LAUNCHER_DIR.test(s);
}
// 1.21.1 — PowerShell as the run shell (`--shell pwsh` / `powershell`, a path to either, DEV_SPEC_SHELL=pwsh). Node's shell
// option would run `<shell> -c "<cmd>"` — pwsh 7 and Windows PowerShell 5.1 both accept it — but that loads the user's
// profile (slow; it may print, prompt or change the folder). The result carries `pwsh: true` and `args`: the CLI runs
// `<shell> -NoProfile -NonInteractive -Command <cmd>` itself — the command ONE argument, quoted by Node's Windows rules, which
// PowerShell reads back intact. The exit code is the script's (`exit 3` → 3; a last command that failed → 1; `exit
// $LASTEXITCODE` passes a native program's own code on).
const PWSH_RUN_ARGS = ["-NoProfile", "-NonInteractive", "-Command"];
const RE_PWSH_PROGRAM = /^(?:pwsh|powershell)(?:\.exe)?$/i;
const isPwshShell = (p) => RE_PWSH_PROGRAM.test(path.win32.basename(String(p == null ? "" : p).trim().replace(/^"|"$/g, "")));
const pwshShell = (shell) => ({ shell, cmd: false, pwsh: true, args: PWSH_RUN_ARGS.slice() });
function resolveRunShell(requested, opts = {}) {
  const platform = opts.platform || process.platform;
  const req = typeof requested === "string" ? requested.trim() : "";
  if (platform !== "win32") return req && isPwshShell(req) ? pwshShell(req.replace(/^"(.*)"$/, "$1")) : { shell: req || true, cmd: false };
  if (!req) return { shell: true, cmd: true }; // Node's default there: %ComSpec% (cmd.exe)
  if (/^(?:.*[\\/])?cmd(?:\.exe)?$/i.test(req)) return { shell: req, cmd: true }; // --shell cmd / a ComSpec path: cmd.exe anyway
  // wsl.exe is no shell: Node runs `<shell> -c "<cmd>"` and wsl.exe rejects -c (exit 4294967295 — a bogus failed run, or a
  // fake red proof) — refused, a bare `wsl` too. Only WSL's bash.exe, named by its path, is used as given (1.15).
  if (/^(?:.*[\\/])?wsl(?:\.exe)?$/i.test(req.replace(/^"|"$/g, ""))) return { error: "wsl-exe", path: req };
  if (/[\\/]/.test(req)) {
    const shell = req.replace(/^"(.*)"$/, "$1"); // a quoted path: the quotes are no part of it (spawn would miss the file)
    if (isPwshShell(shell)) return pwshShell(shell);
    return isWslLauncher(shell) ? { shell, cmd: false, wsl: true } : { shell, cmd: false };
  }
  if (isPwshShell(req)) return pwshShell(req); // pwsh / powershell(.exe): found on PATH
  if (!/^bash(?:\.exe)?$/i.test(req)) return { shell: req, cmd: false }; // sh, zsh…: as given
  const env = opts.env || process.env;
  const envOf = (k) => { const hit = Object.keys(env).find((x) => x.toLowerCase() === k.toLowerCase()); return hit ? String(env[hit] || "") : ""; };
  const exists = opts.exists || ((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
  const W = path.win32;
  const cands = [];
  const git = typeof opts.gitExecPath === "string" ? opts.gitExecPath.trim() : "";
  if (/^[A-Za-z]:[\\/]/.test(git)) { const top = W.resolve(git, "..", "..", ".."); cands.push(W.join(top, "bin", "bash.exe"), W.join(top, "usr", "bin", "bash.exe")); }
  for (const k of ["ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"]) if (envOf(k)) cands.push(W.join(envOf(k), "Git", "bin", "bash.exe"));
  if (envOf("LOCALAPPDATA")) cands.push(W.join(envOf("LOCALAPPDATA"), "Programs", "Git", "bin", "bash.exe"));
  for (const d of envOf("PATH").split(";").slice(0, 200)) { const dir = d.trim().replace(/^"|"$/g, ""); if (dir) cands.push(W.join(dir, "bash.exe")); }
  for (const c of cands) if (!isWslLauncher(c) && exists(c)) return { shell: c, cmd: false, resolved: true };
  return { error: "no-git-bash" };
}
// 1.21.1 — a PowerShell program's own script is PowerShell, not POSIX: `$` inside a double-quoted word of it is never flagged
// (`pwsh -NoProfile -Command "Invoke-Pester ./tests -CI; exit $LASTEXITCODE"` was refused as "variable"). cmd.exe hands such a
// word to the program intact — it expands no `$`, and `;` / `&` inside quotes are no separators to it. The script is every
// word after -Command / -c (any abbreviation, `-` or `/`), -CommandWithArgs / -cwa or -EncodedCommand of pwsh / powershell
// (.exe, any path) in PROGRAM position (the first word of a command: cmd.exe's `&` `|` `(` `)` and line breaks outside quotes
// start another), and Windows PowerShell's first positional argument (powershell.exe's default parameter is -Command; its
// value options — -ExecutionPolicy Bypass… — skipped). Still flagged: a single-quoted string outside double quotes
// (`pwsh -c 'Invoke-Pester'`: cmd.exe splits it and PowerShell evaluates a string literal — exit 0), a `$` outside double
// quotes, and the arguments after -File or pwsh's positional script path: PowerShell passes them to the script as literal
// strings, so a `$` there was written for the CALLING shell (which, under cmd.exe, expands nothing) — --shell pwsh runs them.
const PWSH_VALUE_OPTS = ["executionpolicy", "windowstyle", "version", "inputformat", "outputformat", "configurationname", "configurationfile",
  "psconsolefile", "workingdirectory", "settingsfile", "custompipename"];
const PWSH_VALUE_ALIASES = new Set(["ep", "ex", "if", "of", "wd", "v", "w", "o", "inp", "out"]);
const RE_PWSH_COMMAND_OPT = /^c(?:o(?:m(?:m(?:a(?:n(?:d)?)?)?)?)?)?$|^c(?:ommandwithargs|wa)$/; // what shellScript() reads as -Command, + -CommandWithArgs
function pwshOption(word) { // → "script" (the rest is the script) | "file" | "value" (takes the next word) | null (a switch)
  const o = word.slice(1).toLowerCase();
  if (!o) return null;
  if (RE_PWSH_COMMAND_OPT.test(o) || o === "ec" || "encodedcommand".startsWith(o)) return "script";
  if ("file".startsWith(o)) return "file";
  return PWSH_VALUE_ALIASES.has(o) || (o.length >= 3 && PWSH_VALUE_OPTS.some((n) => n.startsWith(o))) ? "value" : null;
}
function posixShellSyntax(cmd) {
  const s = String(cmd == null ? "" : cmd);
  const found = new Set();
  let dq = false, sq = false;
  // The command being read — only to find a PowerShell program's script: its words, its program, where the script starts.
  let word = "", inWord = false, nWords = 0;
  let ps = null; // the command's program is PowerShell: { win: Windows PowerShell (powershell.exe) }
  let script = false; // the rest of the command is PowerShell's script
  let skipValue = false; // the next word is a value option's value
  let wordScript = false; // the word being read belongs to the script
  const startWord = (c) => {
    inWord = true;
    word = "";
    wordScript = script || (!!ps && ps.win && nWords > 0 && !skipValue && c !== "-" && c !== "/"); // powershell.exe's positional command
  };
  const endWord = () => {
    if (!inWord) return;
    inWord = false;
    if (nWords++ === 0) {
      const prog = word.replace(/^@/, "").split(/[\\/]/).pop();
      ps = RE_PWSH_PROGRAM.test(prog) ? { win: /^powershell/i.test(prog) } : null;
    } else if (ps && !script) {
      if (wordScript) script = true;
      else if (skipValue) skipValue = false;
      else if (/^[-/]/.test(word)) {
        const k = pwshOption(word);
        if (k === "script") script = true;
        else if (k === "file") ps = null; // the script's arguments: literal strings
        else if (k === "value") skipValue = true;
      } else ps = null; // pwsh's positional argument is -File's script path
    }
  };
  const endCommand = () => { endWord(); nWords = 0; ps = null; script = false; skipValue = false; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!dq && !sq) {
      if (c === " " || c === "\t") { endWord(); continue; }
      if (c === "&" || c === "|" || c === "(" || c === ")" || c === "\n" || c === "\r") { endCommand(); continue; }
    }
    if (!inWord) startWord(c);
    if (c === '"' && !sq) dq = !dq;
    else if (c === "'" && !dq) { sq = !sq; if (!sq) found.add("single-quotes"); }
    else if (c === "^" && !dq && !sq && i + 1 < s.length) { word += s[++i]; } // cmd.exe's escape: the next character is literal
    else {
      if (c === "$" && !sq && /[A-Za-z_{(]/.test(s[i + 1] || "") && !(dq && wordScript)) found.add("variable");
      word += c;
    }
  }
  endCommand();
  return ["single-quotes", "variable"].filter((k) => found.has(k));
}
// A _Verify:_ command that PIPES into another one (`npm test | tee log`, `pytest | grep passed`): a pipeline's exit code is
// its LAST command's, so a failing check exits 0 and would be recorded as a passing run. → true for an unquoted single `|`
// (`|&` too); never `||` (or), a `|` inside '…' / "…", an escaped one (`\|`, cmd.exe's `^|`), the `>|` redirection, or one
// inside $(…) / `…` (a substitution's status is not the command's).
// C4 — what used to be false negatives:
// - pipefail counts only when a `set -o pipefail` (`set -eo pipefail`, `set -euo pipefail`, `set -e -o pipefail` …) RUNS
//   BEFORE the pipe, or the shell is started with `-o pipefail`. The bare word anywhere (`set +o pipefail; …`, `tee
//   pipefail.log`, a trailing `# pipefail later`) switched the check off.
// - a pipeline inside the SCRIPT handed to a shell is still a pipeline: `bash -c "npm test | tee log"`, `sh -c 'pytest |
//   tee out'`, `pwsh -Command "…|…"`, `cmd /c "…|…"` (analysed recursively, with that shell's own pipefail).
// - `"C:\Program Files\" | more`: inside "…", `\"` after a Windows path (a literal backslash before it, or a bare drive /
//   %VAR% / . / ..) is that path's last backslash plus the CLOSING quote (cmd.exe has no backslash escapes) — read as an
//   escaped quote it swallowed the pipe into a string that never closed.
function verifyPipeMasked(cmd) {
  return pipeMaskedIn(String(cmd == null ? "" : cmd), false, "posix", 0);
}
const POSIX_SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "mksh", "ash", "fish"]);
const PWSH_SHELLS = new Set(["pwsh", "powershell"]);
const SHELL_WRAPPERS = new Set(["env", "command", "exec", "nohup", "time", "busybox", "wsl"]);
const WRAPPER_ARG_OPTS = new Set(["-u", "-C", "-d", "--unset", "--chdir", "--distribution", "--user", "--cd"]); // env -u NAME · wsl -d Ubuntu
// Split a command line into words and operators the way a shell reads it — enough to find pipes, `set` and shell scripts.
// A word keeps its unquoted value `v` and its spelling as written (`raw`, quotes and escapes included — programName reads it).
function lexShell(s) {
  const toks = [];
  let w = null, raw = "";
  const put = (ch, r) => { if (w === null) { w = ""; raw = ""; } w += ch; raw += r == null ? ch : r; };
  const end = () => { if (w !== null) toks.push({ t: "w", v: w, raw }); w = null; };
  const op = (v) => { end(); toks.push({ t: "op", v }); };
  // $(…) — balanced parentheses, quotes inside honoured; returns the index after its ")" (or the end).
  const skipSubst = (i) => {
    let depth = 0;
    for (let k = i; k < s.length; k++) {
      const c = s[k];
      if (c === "\\") { k++; continue; }
      if (c === "'") { const e = s.indexOf("'", k + 1); k = e < 0 ? s.length : e; continue; }
      if (c === '"') { let e = k + 1; while (e < s.length && s[e] !== '"') e += s[e] === "\\" ? 2 : 1; k = e; continue; }
      if (c === "(") depth++;
      else if (c === ")" && --depth === 0) return k + 1;
    }
    return s.length;
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === " " || c === "\t") { end(); continue; }
    if (c === "\n" || c === "\r") { op("\n"); continue; }
    if (c === "\\" || c === "^") { put(i + 1 < s.length ? s[i + 1] : c, s.slice(i, i + 2)); i++; continue; } // POSIX \x · cmd.exe ^x
    if (c === "'") { const e = s.indexOf("'", i + 1); const stop = e < 0 ? s.length : e; put(s.slice(i + 1, stop), s.slice(i, stop + 1)); i = stop; continue; }
    if (c === '"') {
      let k = i + 1, val = "", literalBs = false;
      for (; k < s.length && s[k] !== '"'; k++) {
        if (s[k] === "\\" && k + 1 < s.length) {
          const n = s[k + 1];
          // a Windows path's last "\" + the closing quote. The prefix test is bounded (C:, %VAR%, . and .. are short): re-testing
          // the whole value at every \" made one long _Verify:_ quadratic.
          if (n === '"' && (literalBs || (val.length <= 260 && /^(?:[A-Za-z]:|%[^%\s]+%|\.{1,2})$/.test(val)))) { val += "\\"; k++; break; }
          if (n === '"' || n === "\\" || n === "$" || n === "`") { val += n; k++; continue; }
          literalBs = true; val += "\\"; continue;
        }
        if (s[k] === "$" && s[k + 1] === "(") { const e = skipSubst(k + 1); val += s.slice(k, e); k = e - 1; continue; }
        val += s[k];
      }
      put(val, s.slice(i, Math.min(k + 1, s.length)));
      i = k;
      continue;
    }
    if (c === "`") { const e = s.indexOf("`", i + 1); const stop = e < 0 ? s.length : e; put(s.slice(i, stop + 1)); i = stop; continue; }
    if (c === "$" && s[i + 1] === "(") { const e = skipSubst(i + 1); put(s.slice(i, e)); i = e - 1; continue; }
    if (c === "|") {
      if (s[i - 1] === ">") { put(c); continue; } // `>|` — a redirection, not a pipe
      if (s[i + 1] === "|") { op("||"); i++; continue; }
      if (s[i + 1] === "&") i++; // `|&` pipes stderr too
      op("|");
      continue;
    }
    if (c === "&") {
      if (s[i - 1] === ">" || s[i - 1] === "<" || s[i + 1] === ">") { put(c); continue; } // 2>&1 · >&2 · &>file
      if (s[i + 1] === "&") { op("&&"); i++; continue; }
      op("&");
      continue;
    }
    if (c === ";" || c === "(" || c === ")") { op(c); continue; }
    put(c);
  }
  end();
  return toks;
}
// The program a command's words run, as a lower-case basename without .exe (quotes and the path dropped — read from the raw
// spelling: an unquoted `C:\Windows\System32\cmd.exe` has no backslashes left in its POSIX value).
const programName = (tok) => (tok ? tok.raw : "").replace(/["']/g, "").split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, "");
// `set -o pipefail` → true, `set +o pipefail` → false, anything else → null.
function setPipefail(words) {
  if (!words.length || words[0].v !== "set") return null;
  let res = null;
  for (let k = 1; k < words.length - 1; k++) {
    const w = words[k].v;
    if (words[k + 1].v !== "pipefail") continue;
    if (/^-[A-Za-z]*o$/.test(w)) res = true;
    else if (/^\+[A-Za-z]*o$/.test(w)) res = false;
  }
  return res;
}
// A shell started with a script (`bash -c "<script>"`, `pwsh -Command <script>`, `cmd /c <script>`) → { script, kind,
// pipefail } (a POSIX shell's own `-o pipefail`), else null.
function shellScript(words) {
  let i = 0, wrapped = false; // skip `VAR=value`, `env` / `exec` / `wsl`… and the options that follow a wrapper
  for (; i < words.length; i++) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i].v)) continue;
    if (SHELL_WRAPPERS.has(programName(words[i]))) { wrapped = true; continue; }
    if (wrapped && words[i].v.startsWith("-")) { if (WRAPPER_ARG_OPTS.has(words[i].v)) i++; continue; }
    break;
  }
  if (i >= words.length) return null;
  const prog = programName(words[i]);
  const rest = words.slice(i + 1).map((t) => t.v);
  if (POSIX_SHELLS.has(prog)) {
    let pipefail = false, c = false;
    for (let k = 0; k < rest.length; k++) {
      const a = rest[k];
      if (a === "--") return c && k + 1 < rest.length ? { script: rest[k + 1], kind: "posix", pipefail } : null;
      if (!/^[-+]/.test(a) || a === "-" || a === "+") return c ? { script: a, kind: "posix", pipefail } : null;
      if (/^[-+][A-Za-z]*[oO]$/.test(a)) { // -o / +o / -eo … take the next word (an option name)
        if (/o$/.test(a) && rest[k + 1] === "pipefail") pipefail = a[0] === "-";
        if (/^-[A-Za-z]*c/.test(a)) c = true;
        k++;
        continue;
      }
      if ((/^-[A-Za-z]*$/.test(a) && a.includes("c")) || a === "--command") c = true; // /^-[A-Za-z]*c[A-Za-z]*$/ (quadratic) — fish spells it --command too
    }
    return null;
  }
  if (PWSH_SHELLS.has(prog)) {
    const k = rest.findIndex((a) => /^[-/]c(?:o(?:m(?:m(?:a(?:n(?:d)?)?)?)?)?)?$/i.test(a));
    return k >= 0 && k + 1 < rest.length ? { script: rest.slice(k + 1).join(" "), kind: "pwsh", pipefail: false } : null;
  }
  if (prog === "cmd") {
    const k = rest.findIndex((a) => /^\/[ck]$/i.test(a));
    return k >= 0 && k + 1 < rest.length ? { script: rest.slice(k + 1).join(" "), kind: "cmd", pipefail: false } : null;
  }
  return null;
}
function pipeMaskedIn(s, pipefailAtStart, kind, depth) {
  if (depth > 4) return false; // a script inside a script inside a script… — enough
  let pf = pipefailAtStart;
  const scopes = []; // ( … ) subshells: pipefail set inside one ends with it
  let words = [];
  // Runs at the end of every simple command: `set` changes pipefail (POSIX shells only), a shell script is analysed on its own.
  const finish = () => {
    if (!words.length) return false;
    const set = kind === "posix" ? setPipefail(words) : null;
    if (set !== null) pf = set;
    const sc = shellScript(words);
    words = [];
    return !!sc && pipeMaskedIn(sc.script, sc.pipefail, sc.kind, depth + 1);
  };
  for (const t of lexShell(s)) {
    if (t.t === "w") { words.push(t); continue; }
    if (finish()) return true;
    if (t.v === "|" && !pf) return true;
    if (t.v === "(") scopes.push(pf);
    else if (t.v === ")" && scopes.length) pf = scopes.pop();
  }
  return finish();
}
// The runnable _Verify:_ commands of a block that pipe (verifyPipeMasked) — brief, doctor and `done --run` name them.
function verifyPipes(block) {
  return taskMarkers(block).verify.filter(verifyPipeMasked);
}

// ---------------------------------------------------------------------------
// 1.14 B5 — evidence: red → green (_Expect: fail_), the project's check commands (roadmap.json meta.checks) with a recorded
// full-suite run at finish, and git-linked evidence. The engine never runs a command nor git: `dev-spec done --run` /
// `finish --run` execute, `dev-spec log` feeds `git log` text to taskCommits() — an agent can pass the same text.
// ---------------------------------------------------------------------------

// _Expect: fail_ — an English-stable task marker, its value kept whole like _Verify:_: the task's run must FAIL (a test
// written before its fix). Only `fail` (any case, backticks dropped) sets it; any other value leaves a must-pass task.
function expectsFail(block) {
  return !!block && taskMarkers(block).expect.some((v) => /^fail$/i.test(stripEnds(v, isBacktickUnit).trim()));
}
// Exit codes of a shell that could not run the command at all — never a red test: 126 (not executable), 127 (command not
// found, POSIX shells), 9009 (cmd.exe: "… is not recognized as an internal or external command").
const CANT_RUN_EXIT = new Set([126, 127, 9009]);
// full review Ga2 / Ga9 — the OUTPUT of a run that never exercised the check, whatever its exit code: the shell or its
// launcher could not start it (`wsl`: WSL's bash.exe relay with no Linux distribution / no /bin/bash; `spawn`: a spawn error
// Node reported), or the test runner found nothing to run (`test`: a missing test file, module or script, no test collected).
// Such a run is no red test — the brief says so: "not a missing file or import" — so on an _Expect: fail_ task it is
// refused (`done --run` records nothing, spec_complete_task refuses a run whose summary shows it). Conservative: literal
// phrases of the runners' own messages, every pattern linear (bounded classes, no nested quantifier), over ≤ 200 000 chars.
const CANT_RUN_OUTPUT = [
  ["wsl", /<\d>WSL \(\d+[^)\n]{0,40}\) ERROR:[^\n]{0,200}/], // "<3>WSL (10 - Relay) ERROR: CreateProcessCommon:818: execvpe(/bin/bash) failed…"
  ["wsl", /execvpe\([^)\n]{0,300}\) failed[^\n]{0,120}/],
  ["wsl", /Windows Subsystem for Linux (?:has no installed distributions|is not installed|must be updated)[^\n]{0,120}/i],
  ["spawn", /\bspawn(?:Sync)? [^\n]{1,300} (?:ENOENT|EACCES|ENOEXEC)\b/], // Node: the shell itself could not be started
  ["test", /^[ \t]*Could not find '[^'\n]{1,400}'/m], // node --test <missing file>
  ["test", /\bCannot find module '[^'\n]{1,400}'/], // node / jest / ts: a module the test loads doesn't exist
  ["test", /\bERR_MODULE_NOT_FOUND\b/],
  ["test", /can't open file '[^'\n]{1,400}': \[Errno 2\]/], // python <missing file>
  ["test", /\bModuleNotFoundError: No module named\b[^\n]{0,200}/],
  ["test", /\bERROR: file or directory not found: [^\n]{0,300}/], // pytest <missing path>
  ["test", /\bno tests ran in \d/], // pytest: nothing collected (exit 5)
  ["test", /\bNo tests found, exiting with code \d/], // jest
  ["test", /\bNo test files found\b[^\n]{0,200}/i], // vitest / mocha
  ["test", /\bMissing script: [^\n]{0,120}/], // npm run / npm test without that script
  ["test", /\bNo rule to make target [^\n]{0,200}/], // make <missing target>
  ["test", /\bnpm (?:ERR!|error) (?:code )?ENOENT\b/], // npm with no package.json
  // PowerShell (1.21.1) — the command is unknown (Invoke-Pester without Pester installed, a typo): pwsh 7 "…is not recognized
  // as a name of a cmdlet", Windows PowerShell 5.1 "…as the name of a cmdlet" (its console wraps long lines, so blanks between
  // the words), pwsh's pt-BR / es wording ("não é reconhecido como um nome de um cmdlet", "no se reconoce como nombre de un
  // cmdlet"); a module that isn't installed; the execution policy refusing a script (and an unsigned one); a script path
  // pwsh / powershell can't find; Pester 5+ finding no test file. A test that RAN and failed on such an error — the function
  // under test doesn't exist yet: "[-] Get-Greeting.T-01 … 12ms" then "The term 'Get-Greeting' is not recognized" — stays
  // red (RE_ASSERTION_RAN / pesterRan below).
  ["test", /(?:['"][^'"\r\n]{1,200}['"]\s+)?(?:is\s+not\s+recognized\s+as\s+(?:a|the)\s+name\s+of\s+a|n[ãa]o\s+[ée]\s+reconhecido\s+como\s+(?:um\s+)?nome\s+de\s+(?:um\s+)?|no\s+se\s+reconoce\s+como\s+(?:el\s+)?nombre\s+de\s+(?:un\s+)?)\s*cmdlet\b/i],
  ["test", /\bThe\s+specified\s+module\s+['"][^'"\r\n]{1,300}['"]\s+was\s+not\s+loaded\b|\bO\s+m[óo]dulo\s+especificado\s+['"][^'"\r\n]{1,300}['"]\s+n[ãa]o\s+foi\s+carregado\b|\bNo\s+se\s+carg[óo]\s+el\s+m[óo]dulo\s+especificado\s+['"][^'"\r\n]{1,300}['"]/i],
  ["test", /\bcannot\s+be\s+loaded\s+because\s+running\s+scripts\s+is\s+disabled\s+on\s+this\s+system\b|\bporque\s+a\s+execu[çc][ãa]o\s+de\s+scripts\s+(?:est[áa]|foi)\s+(?:desabilitad|desativad)[ao]\s+neste\s+sistema\b|\bporque\s+la\s+ejecuci[óo]n\s+de\s+scripts\s+est[áa]\s+deshabilitada\s+en\s+este\s+sistema\b|\bis\s+not\s+digitally\s+signed\.\s+You\s+cannot\s+run\s+this\s+script\b/i],
  ["test", /\bThe\s+argument\s+['"][^'"\r\n]{1,400}['"]\s+(?:is\s+not\s+recognized\s+as\s+(?:the|a)\s+name\s+of\s+a\s+script\s+file|to\s+the\s+-File\s+parameter\s+does\s+not\s+exist)\b/i],
  ["test", /\bNo test files were found and no scriptblocks were provided\b/], // Pester 5 / 6: no *.Tests.ps1 under the path
];
// → null | { kind: "wsl" | "spawn" | "test", text: "<the matched text, ≤ 160 chars>" }. NUL bytes are dropped first (the WSL
// launcher writes UTF-16).
// Output that shows tests RAN and an assertion failed ("not ok 1", AssertionError, pytest's "E   assert", jest's
// "Expected:" / expect(…)): a genuine red run, even when its message quotes a runner phrase ("expected: Cannot find module
// 'foo-plugin'") — the `test` kind never applies to it (full review R6).
// 1.21.1 — Pester's shapes too: a failed TEST line "[-] Get-Greeting.T-01 greets by name 12ms (9ms|3ms)" (Pester 3–6; never
// a block's "[-] Error occurred in Describe block …" / "[-] Discovery in … failed" / "[-] <file> failed with:"), "Expected
// 'Hello, Ana', but got 'Hello'." / "Expected strings to be the same, but they were different." / Pester 3's "Expected string
// length 10 but was 5.", and "But was:" (Pester, NUnit).
const RE_ASSERTION_RAN = /^[ \t]*not ok \d|\bAssertionError\b|^[ \t]*E[ \t]{2,}assert\b|\bexpect\(|^[ \t]*(?:Expected|Received|But was):|^[ \t]*\[-\][ \t]+(?!Error occurred in |Discovery in )[^\r\n]{1,500}?[ \t]\d+(?:\.\d+)?m?s(?:[ \t]+\([^\r\n)]{0,40}\))?[ \t]*$|\bExpected [^\r\n]{1,400}?,? but (?:got|was|they were|no exception)\b/m;
// Pester's summary ("Tests Passed: 0, Failed: 1" — Pester 4–6; Pester 3: "Passed: 0 Failed: 1") counts a test whose block never
// ran — a BeforeAll that failed on a module that isn't there, a test file that doesn't parse — as failed too; "Container
// failed: N" (Pester 5+) or "[-] Error occurred in …" / "[-] Discovery in …" say so, and then the count proves no assertion.
const RE_PESTER_FAILED = /^[ \t]*(?:Tests Passed: \d+, |Passed: \d+ )Failed: [1-9]/m;
const RE_PESTER_NOT_RUN = /^[ \t]*(?:Container failed: [1-9]|\[-\] (?:Error occurred in |Discovery in ))/m;
const pesterRan = (s) => RE_PESTER_FAILED.test(s) && !RE_PESTER_NOT_RUN.test(s);
function couldNotRunOutput(output) {
  const s = stripAnsi(String(output == null ? "" : output).slice(0, 200000).replace(/\u0000/g, ""));
  if (!s.trim()) return null;
  const ran = RE_ASSERTION_RAN.test(s) || pesterRan(s);
  for (const [kind, re] of CANT_RUN_OUTPUT) {
    if (kind === "test" && ran) continue;
    const m = s.match(re);
    if (m) return { kind, text: m[0].trim().replace(/\s+/g, " ").slice(0, 160) };
  }
  return null;
}
// A recorded run that could not run at all: a could-not-run exit code, or a non-zero one whose output (summary) shows it.
function cantRunRecord(r) {
  if (!isRecord(r) || typeof r.command !== "string" || r.command.trim() === "" || !Number.isInteger(r.exitCode)) return false;
  return CANT_RUN_EXIT.has(r.exitCode) || (r.exitCode !== 0 && !!couldNotRunOutput(r.summary));
}
// A run that proves a red test: a command that ran and exited non-zero (not a could-not-run code or output).
function isRedRun(r) {
  return isRecord(r) && typeof r.command === "string" && r.command.trim() !== "" && Number.isInteger(r.exitCode) && r.exitCode !== 0 && !cantRunRecord(r);
}
// The red proof a record holds: its latest run, or `red` — the red run kept when a later run passed (recordEvidence). A
// stale record (spec_impact --reopen: the spec it proved changed) proves nothing any more. One an UNDO made stale (staleBy
// "undo", 1.16 U review 1) keeps its red run: unticking changed neither the spec nor the test, and once the fix is in that red
// run can't be made again — the task was stuck on unexpected-pass for good. The record itself still reads stale-evidence
// (evidenceIssue checks `stale` first), so a re-tick needs a new run: a pass is then the fix going green (expectFailRun's
// passAfterRed), and the red run is carried into the new record as `red`. Callers pass the task's OWN record (ownEvidence /
// ownRecord), which an edited _Verify:_ no longer matches — its red run proves nothing for the new command.
function redProof(e) {
  if (!isRecord(e) || (e.stale === true && e.staleBy !== "undo")) return null;
  return isRedRun(e) ? runOf(e) : isRedRun(e.red) ? runOf(e.red) : null;
}
// evidenceIssue() for an _Expect: fail_ task: verified by a red run {command, exitCode ≠ 0} (or the red run kept after the
// fix made it pass); a passing run with no red run before it is `unexpected-pass` (the test doesn't fail: it tests nothing
// yet); a could-not-run exit is a failed run; a note never proves a runnable _Verify:_; without one a note attests.
function expectFailIssue(e, runnable) {
  // A could-not-run latest run is a failed re-check even while the red run it carries forward stays on record (so the
  // pass after the fix is still accepted as the green one).
  const cantRun = cantRunRecord(e); // full review Ga2: a could-not-run OUTPUT too (a missing test file…)
  if (!cantRun && redProof(e)) return null;
  if (e.command && e.exitCode === 0) return "unexpected-pass";
  if (e.command && e.exitCode != null) return "failed-run";
  if (runnable) return "manual-note-on-runnable-verify";
  return e.exitCode === 0 || !!e.summary ? null : "no-evidence";
}
// completeTask's reading of one run on an _Expect: fail_ task (prev = the task's own record before it): `refused` — a pass
// with no red run of this _Verify:_ on record, or a command that could not run; `red` — this run is the red proof;
// `passAfterRed` — a pass once the red run is on record (the fix made the test green: the red run stays the proof).
function expectFailRun(ev, prev) {
  const run = !!ev && ev.exitCode != null && !!ev.command;
  const before = redProof(prev);
  const red = run && isRedRun(ev);
  const pass = run && ev.exitCode === 0;
  return { refused: run && (pass ? !before : !red), red, passAfterRed: pass && before ? before : null };
}
function expectFailRefusal(n, ev, ticked, lng) {
  const X = i18n.msg(lng).redGreen;
  if (ev.exitCode === 0) return { ok: false, recorded: true, expected: "fail", unexpectedPass: true, error: ticked ? X.passTicked(n) : X.passRefused(n) };
  // couldNotRun (stable): "exit-code" (126 / 127 / 9009) · "output" (full review Ga2: its summary shows the test never ran —
  // a missing test file, module or script, no test collected, a shell that could not start).
  const out = !CANT_RUN_EXIT.has(ev.exitCode) ? couldNotRunOutput(ev.summary) : null;
  if (out) return { ok: false, recorded: true, expected: "fail", couldNotRun: "output", error: X.cantRunOutput(n, ev.exitCode, out.text, ticked) };
  return { ok: false, recorded: true, expected: "fail", couldNotRun: "exit-code", error: X.cantRun(n, ev.exitCode, ticked) };
}
function expectFailResult(res, xf, n, lng) {
  res.expected = "fail"; // stable: the task carries _Expect: fail_
  if (xf.red) res.redRecorded = true; // this call recorded the red run
  if (xf.passAfterRed) res.note = [res.note, i18n.msg(lng).redGreen.passAfterRed(n, String(xf.passAfterRed.at || "?").slice(0, 10))].filter(Boolean).join(" ");
}
// red-green (doctor, +tdd): the T-IDs DONE tasks make green (_Makes green:_) against those an _Expect: fail_ task citing
// them (anywhere in its own text / markers) has a red run recorded for (its own record: same _Verify:_, not stale).
function redGreenGaps(blocks, evidence) {
  const dups = new Set(duplicateTaskNumbers(blocks));
  const greened = new Map();
  for (const b of blocks) if (b.done) for (const id of extractTestIds(taskMarkers(b)["makes green"].join(" "))) if (!greened.has(tKey(id.slice(2)))) greened.set(tKey(id.slice(2)), id);
  const proven = new Set();
  for (const b of blocks) {
    if (!expectsFail(b) || !redProof(ownEvidence(evidence, b, dups.has(b.number)))) continue;
    for (const id of extractTestIds(taskProse(b).join(" "))) proven.add(tKey(id.slice(2)));
  }
  return { greened: [...greened.values()], missing: [...greened].filter(([k]) => !proven.has(k)).map(([, id]) => id) };
}

// The git state a run was made on (read-only, by `done --run` / `finish --run`): commit = a hex sha, dirty = uncommitted
// changes outside .specs/. Context, not proof: a malformed value is dropped, never an error.
function gitEvidence(ev) {
  const out = {};
  if (ev && typeof ev.commit === "string" && /^[0-9a-f]{4,40}$/i.test(ev.commit.trim())) out.commit = ev.commit.trim().toLowerCase();
  if (out.commit && typeof ev.dirty === "boolean") out.dirty = ev.dirty;
  return out;
}

// ---------------------------------------------------------------------------
// 1.14 F1 — harness-observed evidence. In Claude Code the plugin's hooks/observe-hook.js (PostToolUse and PostToolUseFailure,
// matcher Bash) sees every Bash run: a run of a task's runnable _Verify:_ command (or the " && " join of a task's commands) or
// of a project check (roadmap.json meta.checks) is appended — one JSON line {command, exitCode, at, event, session} — to a
// git-ignored, size-bounded log: .specs/<feature>/.execution/observed.jsonl for a task's command, .specs/.execution/
// observed.jsonl for a project check's (a dot folder is never a feature; both .execution/ folders ignore themselves).
// spec_complete_task / `done` and spec_finish {evidence} stamp every reported run `observed: true | false` from that log
// (observedRun: the LATEST observed run of the same command, within OBSERVED_WINDOW_MS, has the same exit code); `done --run`
// / `finish --run` ran the command themselves → `observed: "cli"` (counts as observed). The stamp is context by default
// (roadmap.json meta.evidence "reported", today's rule); with meta.evidence "observed" (opt-in) a runnable _Verify:_ is
// verified only by an observed run — reason `unobserved`, through taskVerification (the one verdict) — and a project check's
// passing run counts only when observed (suiteChecks status `unobserved`). The engine never runs a command.
// ---------------------------------------------------------------------------
const OBSERVED_LOG = "observed.jsonl";
const OBSERVED_MAX_BYTES = 64 * 1024; // a log past this keeps its newest lines, up to half of it
const OBSERVED_WINDOW_MS = 24 * 3600 * 1000; // an observed run counts for this long
const OBSERVED_MAX_COMMAND = 4000; // a longer Bash command is never logged (no _Verify:_ / check command is that long)
const OBSERVED_MAX_FEATURES = 200; // feature folders an observed run is matched against, at most
const EVIDENCE_MODES = ["reported", "observed"];
// A command as the log and the lookup compare it: backticks dropped, whitespace runs flattened (the implementer gate's rule).
const flatCommand = (s) => String(s == null ? "" : s).replace(/`/g, "").replace(/\s+/g, " ").trim();
// roadmap.json meta.evidence → "observed" | "reported" (absent or anything else: reported — the default, today's rule).
// Fails CLOSED: a roadmap.json that doesn't parse (one stray byte appended) keeps "observed" when its raw text says so — it
// used to read as "reported", and a single write switched the rule off (feature review R1).
function evidenceMode(projectDir) {
  const l = loadRoadmap(projectDir);
  if (l.parseError) return /"evidence"\s*:\s*"observed"/.test(readIfExists(roadmapPath(projectDir)) || "") ? "observed" : "reported";
  return isObj(l.rm.meta) && l.rm.meta.evidence === "observed" ? "observed" : "reported";
}
// When the project switched to "observed" (roadmap.json meta.evidenceSince, ms) — null when unknown. A red proof recorded
// before it is grandfathered (observedProof).
function evidenceSince(projectDir) {
  const l = loadRoadmap(projectDir);
  return !l.parseError && isObj(l.rm.meta) ? timeOf(l.rm.meta.evidenceSince) : null;
}
// The rule taskVerification applies: { mode, since } (a bare mode string is accepted too).
function evidenceRule(projectDir) {
  const mode = evidenceMode(projectDir);
  return mode === "observed" ? { mode, since: evidenceSince(projectDir) } : { mode };
}
// spec_init {evidence} / `init --evidence`: "reported" | "observed" (case-insensitive) → the mode; anything else → undefined.
function evidenceModeInput(v) {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return EVIDENCE_MODES.includes(s) ? s : undefined;
}
// Inside initProject's roadmap lock: no write when the effective mode doesn't change.
function setEvidenceMode(projectDir, mode) {
  const rm = readRoadmap(projectDir);
  rm.meta = isObj(rm.meta) ? rm.meta : {};
  if (rm.meta.evidence === mode || (mode === "reported" && rm.meta.evidence === undefined)) return;
  rm.meta.evidence = mode;
  if (mode === "observed") rm.meta.evidenceSince = new Date().toISOString(); // the switch — red proofs before it are grandfathered
  else delete rm.meta.evidenceSince;
  writeRoadmap(projectDir, rm);
}
// The log a feature's task runs (slug) or the project checks' runs (slug null) go to — null when the feature doesn't exist.
function observedLogFile(projectDir, slug) {
  if (slug == null) return path.join(specsRoot(projectDir), ".execution", OBSERVED_LOG);
  const f = existingFeature(projectDir, slug);
  return f.ok ? path.join(f.dir, ".execution", OBSERVED_LOG) : null;
}
// The log's entries, oldest first (malformed lines skipped; at most the newest 4 × OBSERVED_MAX_BYTES read).
function readObservedLog(file) {
  let text = "";
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, 4 * OBSERVED_MAX_BYTES);
    const buf = Buffer.alloc(len);
    text = buf.toString("utf8", 0, fs.readSync(fd, buf, 0, len, size - len));
    if (len < size) text = text.slice(text.indexOf("\n") + 1); // started mid-line
  } catch {
    return [];
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* closed */ }
  }
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (isRecord(e) && typeof e.command === "string" && Number.isInteger(e.exitCode) && typeof e.at === "string") out.push(e);
  }
  return out;
}
// Did the harness observe this run? → { observed: boolean, at? } — true when the LATEST observed run of the same command
// (flatCommand) within OBSERVED_WINDOW_MS exited with this code (a report of exit 0 after an observed exit 1 is not what the
// harness saw). A command `a && b` — how `done --run` reports a task with several _Verify:_ commands — also counts when each
// part's latest observed run passed and the report is exit 0. slug: the feature's log; null: the project checks' log.
function observedRun(projectDir, slug, command, exitCode, opts = {}) {
  const key = flatCommand(command);
  const code = typeof exitCode === "number" ? exitCode : /^\s*-?\d+\s*$/.test(String(exitCode)) ? parseInt(String(exitCode), 10) : NaN;
  if (!key || !Number.isInteger(code)) return { observed: false };
  const file = observedLogFile(projectDir, slug);
  if (!file) return { observed: false };
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const entries = readObservedLog(file).filter((e) => { const t = Date.parse(e.at); return Number.isFinite(t) && t >= now - OBSERVED_WINDOW_MS && t <= now + 5 * 60 * 1000; });
  const latest = (k) => { for (let i = entries.length - 1; i >= 0; i--) if (flatCommand(entries[i].command) === k) return entries[i]; return null; };
  const hit = latest(key);
  if (hit) return hit.exitCode === code ? { observed: true, at: hit.at } : { observed: false, latestExitCode: hit.exitCode };
  if (code === 0 && key.includes(" && ")) {
    const hits = key.split(" && ").map((p) => p.trim()).filter(Boolean).map(latest);
    if (hits.length > 1 && hits.every((h) => h && h.exitCode === 0)) return { observed: true, at: hits.map((h) => h.at).sort().pop() };
  }
  return { observed: false };
}
// Was any run ever observed in this project (a log with an entry, project or active feature)? The "MCP-only client" note.
function observedAny(projectDir) {
  const files = [observedLogFile(projectDir, null), ...featureDirs(projectDir).filter((f) => !f.archived).slice(0, OBSERVED_MAX_FEATURES)
    .map((f) => path.join(f.dir, ".execution", OBSERVED_LOG))];
  return files.some((f) => { try { return fs.statSync(f).size > 0; } catch { return false; } });
}
// The stamp of a reported run: "cli" when the CLI ran it itself (`done --run`, `finish --run`), else what the log says.
function observedStamp(projectDir, slug, ev, ranBy) {
  if (!ev || typeof ev.command !== "string" || !ev.command.trim() || !Number.isInteger(ev.exitCode)) return undefined;
  return ranBy === "cli" ? "cli" : observedRun(projectDir, slug, ev.command, ev.exitCode).observed;
}
// meta.evidence "observed": the run that proves a runnable _Verify:_ — the latest passing run, or an _Expect: fail_ task's red
// proof — was observed by the harness (true) or made by the CLI itself ("cli").
// An _Expect: fail_ task whose red proof was recorded BEFORE the project switched to "observed" (since) counts once the fix's
// passing run of it was observed: re-making the red run would mean breaking the fixed code again (feature review R2 — the task
// stayed unobserved for good and the note sent the user round in circles).
function observedProof(e, expectFail, since) {
  const seen = (r) => isRecord(r) && (r.observed === true || r.observed === "cli");
  const run = expectFail ? redProof(e) : e;
  if (seen(run)) return true;
  return !!(expectFail && since != null && isRecord(run) && timeOf(run.at) != null && timeOf(run.at) < since && seen(e) && e.exitCode === 0);
}
// Every runnable _Verify:_ command of a tasks.md (flattened), plus the " && " join of a task's commands when it has several.
function verifyCommandSet(tasksText) {
  const set = new Set();
  for (const b of taskBlocks(tasksText)) {
    const v = taskMarkers(b).verify.map(flatCommand).filter(Boolean);
    v.forEach((c) => set.add(c));
    if (v.length > 1) set.add(v.join(" && "));
  }
  return set;
}
// hooks/observe-hook.js, once its cheap text pre-filter found the command in a tasks.md or meta.checks: one log line per
// target the run belongs to — each non-archived feature with a task whose runnable _Verify:_ is this command, and the project
// log when it is a project check. Never creates a feature folder (a feature renamed or removed meanwhile stays gone), never
// throws. run: {command, exitCode, event?, session?, at?} → { recorded: [{feature | null, file}] }
function observeRun(projectDir, run) {
  const pdir = path.resolve(projectDir);
  const root = specsRoot(pdir);
  const key = flatCommand(run && run.command);
  const code = run && Number.isInteger(run.exitCode) ? run.exitCode : null;
  if (!key || key.length > OBSERVED_MAX_COMMAND || code == null || !isDirSafe(root)) return { recorded: [] };
  const entry = { command: key, exitCode: code, at: typeof run.at === "string" && Number.isFinite(Date.parse(run.at)) ? run.at : new Date().toISOString() };
  if (typeof run.event === "string" && run.event) entry.event = run.event.slice(0, 40);
  if (typeof run.session === "string" && run.session) entry.session = run.session.slice(0, 200);
  const targets = [];
  for (const f of featureDirs(pdir).filter((x) => !x.archived).slice(0, OBSERVED_MAX_FEATURES)) {
    const text = readIfExists(path.join(f.dir, "tasks.md"));
    // The cheap text check first — a task's " && " join is never written whole, only its parts are (review R6).
    const flatTasks = text ? flatCommand(text) : "";
    const inText = flatTasks.includes(key) || (key.includes(" && ") && key.split(" && ").every((p) => !p.trim() || flatTasks.includes(p.trim())));
    if (text && inText && verifyCommandSet(text).has(key)) targets.push({ feature: f.slug, dir: path.join(f.dir, ".execution") });
  }
  if (projectChecks(pdir).checks.some((c) => flatCommand(c.command) === key)) targets.push({ feature: null, dir: path.join(root, ".execution") });
  const recorded = [];
  for (const t of targets) {
    const file = appendObserved(t.dir, entry);
    if (file) recorded.push({ feature: t.feature, file: toPosix(path.relative(pdir, file)) });
  }
  return { recorded };
}
function appendObserved(exDir, entry) {
  try {
    if (!isDirSafe(path.dirname(exDir))) return null; // the feature folder (or .specs/) must exist — never recreated here
    try { fs.mkdirSync(exDir); } catch (e) { if (e.code !== "EEXIST") return null; }
    writeIfAbsent(path.join(exDir, ".gitignore"), "*\n"); // .execution/ ignores itself
    const file = path.join(exDir, OBSERVED_LOG);
    forgetCached(file);
    fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
    trimObservedLog(file);
    return file;
  } catch {
    return null;
  }
}
// Bounded: past OBSERVED_MAX_BYTES the log keeps its newest lines, up to half of that (replaced atomically). Two hooks
// appending while one trims can lose a line — the run then reads unobserved and is simply run again.
function trimObservedLog(file) {
  let size;
  try { size = fs.statSync(file).size; } catch { return; }
  if (size <= OBSERVED_MAX_BYTES) return;
  const keep = [];
  let bytes = 0;
  const entries = readObservedLog(file);
  for (let i = entries.length - 1; i >= 0; i--) {
    const line = JSON.stringify(entries[i]) + "\n";
    if (bytes + Buffer.byteLength(line) > OBSERVED_MAX_BYTES / 2) break;
    keep.unshift(line);
    bytes += Buffer.byteLength(line);
  }
  writeFileAtomic(file, keep.join(""));
}
// The feature's last task activity (ms): the last tick completeTask stamped (lastTickAt) or the newest recorded task run. A
// box ticked by hand in tasks.md leaves no time; null = nothing known (then any passing check run counts). A stamp in the
// future is ignored, as the stop gate's stopActivity does (full review Ga4): a .state.json committed from a machine with a
// fast clock made every check run "before the last task activity" until that time had passed.
function lastTaskActivity(state) {
  let best = null;
  const horizon = Date.now() + 5 * 60 * 1000; // clock skew tolerated
  const see = (v) => { const t = typeof v === "string" ? Date.parse(v) : NaN; if (Number.isFinite(t) && t <= horizon && (best == null || t > best)) best = t; };
  see(state.lastTickAt);
  for (const slot of Object.values(isRecord(state.evidence) ? state.evidence : {})) {
    for (const r of evidenceRecords(slot)) {
      if (r.exitCode != null) see(r.at);
      (Array.isArray(r.history) ? r.history : []).forEach((h) => { if (isRecord(h)) see(h.at); });
    }
  }
  return best;
}

// roadmap.json → meta.checks: named project commands ({"test": "npm test", "lint": "npm run lint"}). A name is letters,
// digits and . _ : - (≤ 40, never a prototype key); a command one line of ≤ 500 characters.
const CHECK_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,39}$/;
const CHECKS_MAX = 20;
const validCheckName = (k) => typeof k === "string" && CHECK_NAME_RE.test(k) && !PROTO_KEYS.has(k.toLowerCase());
const validCheckCmd = (v) => typeof v === "string" && v.trim() !== "" && !/[\r\n]/.test(v) && v.trim().length <= 500;
// → { checks: [{name, command}] (stored order), invalid: [names of malformed entries — ignored] }
function projectChecks(projectDir) {
  const l = loadRoadmap(projectDir);
  const raw = !l.parseError && isObj(l.rm.meta) ? l.rm.meta.checks : undefined;
  if (raw === undefined) return { checks: [], invalid: [] };
  if (!isObj(raw)) return { checks: [], invalid: ["meta.checks"] };
  const checks = [], invalid = [];
  for (const [name, cmd] of Object.entries(raw)) (validCheckName(name) && validCheckCmd(cmd) ? checks.push({ name, command: cmd.trim() }) : invalid.push(name));
  return { checks, invalid };
}
// spec_init {checks} / `init --check name=cmd`: {name: command} adds or replaces those checks, an empty command (or null)
// removes one, the others are kept. → null (not given) · { set, remove } · { error } — validated before anything is written.
function checksInput(input, lng) {
  if (input === undefined || input === null) return null;
  const P = i18n.msg(normalizeLang(lng)).projectChecks;
  if (!isObj(input)) return { error: P.badInput };
  const set = {}, remove = [];
  for (const [k, v] of Object.entries(input)) {
    if (!validCheckName(k)) return { error: P.badName(k) };
    if (v == null || (typeof v === "string" && v.trim() === "")) { remove.push(k); continue; }
    if (!validCheckCmd(v)) return { error: P.badCommand(k) };
    set[k] = v.trim();
  }
  return { set, remove };
}
// Under the roadmap lock, before any write of initProject: the merged meta.checks (nc.merged) or the refusal — a stored
// meta.checks that is not an object of strings is reported, never "repaired"; more than CHECKS_MAX checks is refused.
function checksPlanError(projectDir, nc) {
  const l = loadRoadmap(projectDir);
  const lng = projectLang(projectDir);
  const P = i18n.msg(lng).projectChecks;
  const raw = isObj(l.rm.meta) ? l.rm.meta.checks : undefined;
  if (raw !== undefined && !(isObj(raw) && Object.values(raw).every((v) => typeof v === "string"))) return P.badStored(l.rel);
  const merged = { ...(raw || {}) };
  for (const k of nc.remove) delete merged[k];
  Object.assign(merged, nc.set);
  if (Object.keys(merged).length > CHECKS_MAX) return P.tooMany(CHECKS_MAX);
  nc.merged = merged;
  return null;
}
function writeChecks(projectDir, nc) {
  return withRoadmapLock(projectDir, () => {
    const rm = readRoadmap(projectDir);
    rm.meta = isObj(rm.meta) ? rm.meta : {};
    if (JSON.stringify(rm.meta.checks || {}) === JSON.stringify(nc.merged)) return { ok: true }; // unchanged: no write
    if (Object.keys(nc.merged).length) rm.meta.checks = nc.merged;
    else delete rm.meta.checks;
    writeRoadmap(projectDir, rm);
    return { ok: true };
  });
}
// spec_finish {evidence: [{name, command, exitCode, summary}]} — the project checks' runs as the agent (or `finish --run`)
// ran them, validated all-or-nothing, then recorded in .state.json → finishChecks[name]: the latest run {command, exitCode,
// summary, at, commit?, dirty?} stamped `check` (the meta.checks command it ran for — an edited command makes it `changed`)
// plus a short history. A failed run is recorded too (it stays a blocker). → { recorded } | { error }
// ranBy "cli" (1.14 F1): `finish --run` ran the checks itself — each run is stamped observed: "cli"; otherwise the harness's
// project-check log says whether it saw each run (observed: true | false).
function recordFinishChecks(projectDir, slug, dir, evidence, lng, ranBy) {
  const P = i18n.msg(lng).projectChecks;
  if (!Array.isArray(evidence)) return { error: P.evidenceNotList };
  if (!evidence.length) return { recorded: [] };
  const { checks } = projectChecks(projectDir);
  if (!checks.length) return { error: P.noChecks };
  const byName = new Map(checks.map((c) => [c.name, c.command]));
  const runs = [];
  for (let i = 0; i < evidence.length; i++) {
    const it = evidence[i];
    const bad = (why) => ({ error: P.evidenceItem(i, why) });
    if (!isObj(it)) return bad(P.itemNotObject);
    if (typeof it.name !== "string" || !byName.has(it.name)) return bad(P.unknownCheck(String(it.name), checks.map((c) => c.name).join(", ")));
    if (typeof it.command !== "string" || !it.command.trim()) return bad(P.needsCommand);
    const code = it.exitCode == null ? "" : String(it.exitCode).trim();
    if (!/^-?\d+$/.test(code)) return bad(P.needsExit);
    const run = { command: it.command.trim().slice(0, 500), exitCode: parseInt(code, 10), ...gitEvidence(it) };
    run.observed = observedStamp(projectDir, null, run, ranBy); // 1.14 F1
    if (typeof it.summary === "string" && it.summary.trim()) run.summary = it.summary.slice(0, 2000);
    runs.push({ name: it.name, check: byName.get(it.name), run });
  }
  const state = readState(projectDir, slug);
  if (state.invalid) return { error: state.invalid };
  const at = new Date().toISOString();
  const fc = isObj(state.finishChecks) ? state.finishChecks : {};
  // full review Ga3: each run is stamped `code` — a hash of the feature's implementing files as they are now (the set the
  // finish baseline records); code edited after the run makes it `code-changed`. No stamp when the walk was capped.
  const code = suiteCodeStamp(projectDir, dir);
  for (const r of runs) {
    const prev = Object.prototype.hasOwnProperty.call(fc, r.name) && isRecord(fc[r.name]) ? fc[r.name] : null;
    const run = runOf({ ...r.run, at });
    const hist = prev && prev.check === r.check && Array.isArray(prev.history) ? prev.history.filter(isRecord) : [];
    fc[r.name] = { ...run, check: r.check, ...(code ? { code } : {}), history: hist.concat([run]).slice(-EVIDENCE_HISTORY) };
  }
  state.finishChecks = fc;
  writeFileAtomic(statePath(dir), JSON.stringify(state, null, 2));
  return { recorded: runs.map((r) => ({ name: r.name, exitCode: r.run.exitCode })) }; // the observed stamp: suiteChecks[].observed
}
// Each project check's standing (spec_finish's suite-evidence blocker, doctor's warn): pass — its latest run exited 0, for
// the command meta.checks names now, at or after the feature's last task activity · no-run · failed · changed (meta.checks'
// command changed since the run) · before-last-tick · code-changed (full review Ga3: the run's `code` stamp no longer matches
// the feature's implementing files — code edited after the checks ran; a run recorded without a stamp keeps the older rule).
// dir: the feature folder (the stamp is only compared with it). → { items, missing (not pass), invalid, lastActivity }
// · unobserved (1.14 F1, only with roadmap.json meta.evidence "observed": a passing run the harness never saw — observed is
// neither true nor "cli").
function suiteStatus(projectDir, state, dir) {
  const { checks, invalid } = projectChecks(projectDir);
  const observedOnly = evidenceMode(projectDir) === "observed";
  const last = lastTaskActivity(state);
  const fc = isObj(state.finishChecks) ? state.finishChecks : {};
  let codeNow; // computed once, only when a passing stamped run needs it
  const codeChanged = (r) => {
    if (!dir || typeof r.code !== "string") return false;
    if (codeNow === undefined) codeNow = suiteCodeStamp(projectDir, dir);
    return codeNow != null && codeNow !== r.code;
  };
  const items = checks.map(({ name, command }) => {
    const r = Object.prototype.hasOwnProperty.call(fc, name) && isRecord(fc[name]) ? fc[name] : null;
    if (!r || typeof r.command !== "string" || !Number.isInteger(r.exitCode)) return { name, command, status: "no-run" };
    const it = { name, command, exitCode: r.exitCode, at: typeof r.at === "string" ? r.at : null, ranCommand: r.command, ...runOf({ summary: r.summary, ...gitEvidence(r) }) };
    if (r.observed === true || r.observed === false || r.observed === "cli") it.observed = r.observed; // 1.14 F1
    const t = Date.parse(r.at);
    it.status = r.check !== command ? "changed" : r.exitCode !== 0 ? "failed" : last != null && !(Number.isFinite(t) && t >= last) ? "before-last-tick"
      : codeChanged(r) ? "code-changed" : observedOnly && r.observed !== true && r.observed !== "cli" ? "unobserved" : "pass";
    return it;
  });
  return { items, missing: items.filter((i) => i.status !== "pass"), invalid, lastActivity: last != null ? new Date(last).toISOString() : null };
}
// The code a project check run tested (full review Ga3): one sha1 over the feature's implementing files — the ACTIVE tasks'
// _Implements:_ set the finish baseline records (baselineFiles: files, folders expanded, globs, inside the project, bounded),
// each file's CRLF-normalized content hash (fileHash; a missing file counts as missing). null when the walk was capped (a
// partial set proves nothing) — the run is then judged by the older rule alone.
function suiteCodeStamp(projectDir, dir) {
  const root = path.resolve(projectDir);
  const tasksText = activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", detectTracks(dir)) || "";
  const { files, truncated } = baselineFiles(root, tasksText);
  if (truncated) return null;
  const h = require("crypto").createHash("sha1");
  for (const rel of files.slice().sort()) h.update(rel + "\u0000" + (fileHash(path.resolve(root, rel)) || "-") + "\n");
  return h.digest("hex");
}
function suiteLabel(items, lng) {
  const P = i18n.msg(lng).projectChecks;
  return items.map((i) => `${i.name} (${P.status(i)})`).join(", ");
}
// "@1a2b3c4" (+ "-dirty", as git describe writes it) for a run recorded with its commit — the merge summary's evidence tail.
function commitTag(r) {
  return isRecord(r) && typeof r.commit === "string" && r.commit ? "@" + r.commit + (r.dirty === true ? "-dirty" : "") : "";
}
// The merge summary's "Project checks" section: each check with its latest recorded run (or none) and, unless it passes, why.
function suiteSummaryLines(items, lng) {
  const P = i18n.msg(lng).projectChecks;
  return [P.prChecks, ...items.map((i) => {
    const run = i.status === "no-run" ? P.prNoRun : [codeSpan(i.ranCommand || i.command) + " → exit " + i.exitCode, oneLine(i.summary), commitTag(i)].filter(Boolean).join(" · ");
    return `- ${i.name}: ${run}` + (i.status !== "pass" && i.status !== "no-run" ? ` (${P.status(i)})` : "");
  })];
}
// spec_doctor's B5 checks — warns only: red-green (+tdd, once a task that makes a T-ID green is done) and suite-evidence
// (meta.checks set and every active task done: the finish blocker, shown before finish).
function b5DoctorChecks(projectDir, slug, dir, tracks, lng) {
  const out = [];
  const X = i18n.msg(lng);
  const blocks = taskBlocks(activeTasks(readIfExists(path.join(dir, "tasks.md")) || "", tracks) || "");
  const state = readState(projectDir, slug);
  if (tracks.includes("tdd")) {
    const rg = redGreenGaps(blocks, isRecord(state.evidence) ? state.evidence : {});
    if (rg.greened.length) out.push({ id: "red-green", status: rg.missing.length ? "warn" : "pass", detail: rg.missing.length ? X.redGreen.doctorMissing(rg.missing.join(", ")) : X.redGreen.doctorOk(rg.greened.length) });
  }
  if (blocks.length && blocks.every((b) => b.done)) {
    const s = suiteStatus(projectDir, state, dir);
    if (s.items.length) out.push({ id: "suite-evidence", status: s.missing.length ? "warn" : "pass", detail: s.missing.length ? X.projectChecks.doctorWarn(suiteLabel(s.missing, lng), slug) : X.projectChecks.doctorOk(s.items.length) });
  }
  return out;
}

// `git log` text → commits, newest first as git prints them: { hash, short, date, author, subject, message, files }. Reads
// git's default ("medium") format — `git log --name-only` (or --name-status; with --relative the paths are project-relative)
// — and, when no "commit <sha>" header is present, `git log --oneline` lines (no files then). At most GITLOG_MAX_COMMITS.
const GITLOG_MAX_COMMITS = 5000;
function parseGitLog(text) {
  const lines = String(text == null ? "" : text).replace(/^\uFEFF/, "").split(/\r?\n/);
  const RE_HEAD = /^commit ([0-9a-f]{4,64})(?:\s|$)/i;
  const commits = [];
  const mk = (hash, subject) => ({ hash: hash.toLowerCase(), short: hash.slice(0, 7).toLowerCase(), date: null, author: null, subject, message: subject, files: [] });
  if (!lines.some((l) => RE_HEAD.test(l))) {
    for (const l of lines) {
      const m = l.match(/^([0-9a-f]{4,64})\s+(\S.*)$/i);
      if (m && commits.length < GITLOG_MAX_COMMITS) commits.push(mk(m[1], m[2].trim()));
    }
    return commits;
  }
  let cur = null, part = null, msg = [];
  const close = () => { if (cur) { cur.message = msg.join("\n").trim(); cur.subject = (msg.find((x) => x.trim()) || "").trim(); } };
  for (const l of lines) {
    const h = l.match(RE_HEAD);
    if (h) {
      close();
      cur = null;
      if (commits.length >= GITLOG_MAX_COMMITS) break;
      cur = mk(h[1], "");
      commits.push(cur);
      msg = [];
      part = "head";
      continue;
    }
    if (!cur) continue;
    if (part === "head") {
      if (!l.trim()) { part = "msg"; continue; }
      const kv = headRest(l, /^([A-Za-z][\w-]*):/, false); // /^([A-Za-z][\w-]*):\s*(.*)$/ (headRest: 1.17 H)
      if (kv && /^author$/i.test(kv[1])) cur.author = kv[2].trim();
      else if (kv && /^(?:author)?date$/i.test(kv[1])) cur.date = kv[2].trim();
      continue;
    }
    if (part === "msg" && /^ {4}/.test(l)) { msg.push(l.slice(4)); continue; }
    if (!l.trim()) continue;
    part = "files"; // --name-only "path" · --name-status "M\tpath" / "R100\told\tnew"
    const ns = l.match(/^[ACDMRTUXB]\d*\t(.+)$/);
    let file = (ns ? ns[1].split("\t").pop() : l).trim();
    if (/^".*"$/.test(file)) file = file.slice(1, -1);
    cur.files.push(file.replace(/\\/g, "/").replace(/^(?:\.\/)+/, ""));
  }
  close();
  return commits;
}
// `dev-spec log <feature>` (the CLI feeds it `git log` output; an agent can pass the same text): the commits whose message
// cites each ACTIVE task, plus — +tdd — a red-first check. Conventions (what /spec-commit writes: "Part of .specs/<feature>/
// task #N." · "Makes T-01, T-02 green."): a message cites task N when it names the feature — its slug as a word:
// `.specs/<slug>/`, `feat(<slug>):` … — AND "task #N" / "task N" / "#N" (PT "tarefa N", ES "tarea N"); it cites every task
// whose own text / markers name one of its T-IDs (T-01 = T-1) or AC IDs (US-1.AC-2) — unless the message names another
// feature and not this one (IDs restart in every feature). Red-first: a task with _Makes green: T-xx_ whose first commit
// citing it (by number or by one of those T-IDs) is OLDER than the first commit touching a test file that names T-xx (the
// trace --code scan of this feature's plan) — or when no commit read touches one — gets a warning. opts.max: the window the
// log was read with (a full window means older commits were not read: an order that can't be known is `outside-window`).
function taskCommits(projectDir, name, logText, opts = {}) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const { slug, dir } = f;
  const tasksText = readIfExists(path.join(dir, "tasks.md"));
  if (tasksText == null) return { ok: false, error: errs(projectDir, slug).tasksMissing(slug) };
  const lng = featureLang(projectDir, slug);
  const G = i18n.msg(lng).gitLog;
  const tracks = detectTracks(dir);
  const blocks = taskBlocks(activeTasks(tasksText, tracks) || "");
  const commits = parseGitLog(logText);
  const truncated = commits.length >= GITLOG_MAX_COMMITS || (Number.isInteger(opts.max) && commits.length >= opts.max); // the parser's cap is a window too
  const wordRe = (s) => new RegExp("(?<![\\p{L}\\p{N}_-])" + s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}\\p{N}_-])", "iu");
  const self = wordRe(slug);
  const others = featureDirs(projectDir).map((d) => d.slug).filter((s) => s !== slug).map(wordRe);
  const RE_NUM = /(?<![\p{L}\p{N}_])(?:tasks?|tarefas?|tareas?)\s*(?:#\s*)?(\d+)(?!\d)|(?<![\p{L}\p{N}_#&/])#(\d+)(?!\d)/giu; // \s*(?:#\s*)?: \s*#?\s* was quadratic on a blank run
  const info = blocks.map((b) => {
    const prose = taskProse(b).join(" ");
    return { b, tids: new Map([...extractTestIds(prose)].map((id) => [tKey(id.slice(2)), id])), acs: extractAcIds(prose),
      green: [...extractTestIds(taskMarkers(b)["makes green"].join(" "))], commits: [] };
  });
  let citing = 0;
  commits.forEach((c, idx) => {
    const text = c.message || c.subject;
    const mine = self.test(text);
    const foreign = !mine && others.some((re) => re.test(text));
    const nums = new Set(mine ? [...text.matchAll(RE_NUM)].map((m) => parseInt(m[1] || m[2], 10)) : []);
    const tids = new Set(foreign ? [] : [...extractTestIds(text)].map((id) => tKey(id.slice(2))));
    const acs = foreign ? new Set() : extractAcIds(text);
    let cites = false;
    for (const t of info) {
      const byNumber = nums.has(t.b.number);
      const tkeys = [...t.tids.keys()].filter((k) => tids.has(k));
      const acIds = [...t.acs].filter((a) => acs.has(a));
      if (!byNumber && !tkeys.length && !acIds.length) continue;
      t.commits.push({ idx, byNumber, tkeys, via: [...(byNumber ? ["#" + t.b.number] : []), ...tkeys.map((k) => t.tids.get(k)), ...acIds] });
      cites = true;
    }
    if (cites) citing++;
  });
  const ref = (i) => (i < 0 ? null : { hash: commits[i].hash, short: commits[i].short, subject: commits[i].subject, date: commits[i].date });
  // Red-first (+tdd): test files are found once, by the trace --code scan of this feature's plan.
  const redFirst = [];
  let testFiles = null;
  const fold = (s) => (FOLD_CASE ? s.toLowerCase() : s);
  for (const t of tracks.includes("tdd") ? info.filter((x) => x.green.length) : []) {
    if (!testFiles) {
      const tc = traceTestCode(projectDir, dir, planIdText(readIfExists(path.join(dir, "test-plan.md")) || ""), new Set(), opts.scan);
      testFiles = new Map(Object.entries(tc.testsInCode).map(([id, files]) => [tKey(id.slice(2)), files]));
    }
    const keys = t.green.map((id) => tKey(id.slice(2)));
    const files = [...new Set(keys.flatMap((k) => testFiles.get(k) || []))];
    const strong = t.commits.filter((c) => c.byNumber || c.tkeys.some((k) => keys.includes(k)));
    const first = strong.length ? Math.max(...strong.map((c) => c.idx)) : -1; // newest first: the oldest has the highest index
    const want = new Set(files.map(fold));
    let testIdx = -1;
    commits.forEach((c, i) => { if (c.files.some((p) => want.has(fold(p)))) testIdx = i; });
    // A full window hides the older commits: the first commit of either side may be older than what was read — no order is known.
    const status = !files.length ? "no-test-file" : first < 0 ? "no-task-commit" : truncated ? "outside-window" : testIdx < 0 ? "test-not-committed" : first > testIdx ? "impl-first" : "ok";
    redFirst.push({ task: t.b.number, tests: t.green, status, taskCommit: ref(first), testCommit: ref(testIdx), testFiles: files });
  }
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const lines = [G.head(slug, commits.length, citing, truncated)];
  for (const t of info) {
    const list = t.commits.slice(0, 5).map((c) => G.commitRef(commits[c.idx].short, cut(commits[c.idx].subject, 60), c.via.join(", ")));
    if (t.commits.length > 5) list.push(G.more(t.commits.length - 5));
    lines.push(G.taskLine(t.b.number, cut(cleanTaskText(t.b.text), 60), t.b.done, list.length ? list.join("; ") : G.noCommit));
  }
  const warnings = [];
  for (const r of redFirst) {
    const tests = r.tests.join(", ");
    const files = r.testFiles.slice(0, 3).join(", ");
    if (r.status === "impl-first") warnings.push(G.implFirst(r.task, tests, r.taskCommit.short, r.testCommit.short, files));
    else if (r.status === "test-not-committed") warnings.push(G.testNotCommitted(r.task, tests, r.taskCommit.short, files));
    else lines.push("  · " + G.redFirstStatus(r.task, tests, r.status));
  }
  warnings.forEach((w) => lines.push("  ▲ " + w));
  if (!citing) lines.push(G.conventions(slug));
  return {
    ok: true, feature: slug, lang: lng, commits: commits.length, truncated, citing,
    tasks: info.map((t) => ({ number: t.b.number, text: t.b.text, done: t.b.done,
      commits: t.commits.map((c) => ({ hash: commits[c.idx].hash, short: commits[c.idx].short, subject: commits[c.idx].subject, date: commits[c.idx].date, via: c.via })) })),
    redFirst, warnings, lines,
  };
}
// "#1, #3 (latest run failed)" — localized reasons for doctor / spec_finish (no-evidence needs none).
function unverifiedLabel(vs, lang) {
  const R = i18n.msg(lang).evidenceGate.reason;
  const label = (d) => (d.specChanged ? i18n.msg(lang).impact.staleSpec : d.unticked ? i18n.msg(lang).undo.label : R[d.reason] || d.reason);
  return vs.unverifiedDetail.map((d) => "#" + d.number + (d.reason === "no-evidence" ? "" : ` (${label(d)})`)).join(", ");
}
// stale-evidence because the spec changed (spec_impact --reopen marked this task's own record), not because the
// record belongs to another task / an earlier _Verify:_ — the reason code stays stale-evidence either way.
function specChangedSince(evidence, block, dup, reason) {
  if (reason !== "stale-evidence") return false;
  const own = ownEvidence(evidence, block, dup);
  return isRecord(own) && own.stale === true && own.staleBy !== "undo";
}
// 1.16 U1: stale-evidence because the task was unticked after this record (spec_complete_task {undo}: staleBy "undo") — the
// same code, its own label (undo.label): a re-tick needs a new run.
function untickedSince(evidence, block, dup, reason) {
  if (reason !== "stale-evidence") return false;
  const own = ownEvidence(evidence, block, dup);
  return isRecord(own) && own.stale === true && own.staleBy === "undo";
}

module.exports = { normalizeEvidence, evidenceIssue, taskStamp, verifyStamp, isRecord, evidenceRecords, ownRecord,
  ownEvidence, taskEvidenceIssue, taskVerification, EVIDENCE_HISTORY, EVIDENCE_OTHERS, recordEvidence, storeEvidence,
  runOf, stateEvidence, verificationStatus, RE_COUNT_KW, RE_COUNT_LINE, RE_ANSI, stripAnsi, summarizeRunOutput,
  RE_CMD_SHELL_FAILURE, windowsShellFailure, RE_WSL_LAUNCHER_DIR, isWslLauncher, PWSH_RUN_ARGS, RE_PWSH_PROGRAM,
  isPwshShell, resolveRunShell, PWSH_VALUE_OPTS, PWSH_VALUE_ALIASES, RE_PWSH_COMMAND_OPT, pwshOption, posixShellSyntax,
  verifyPipeMasked, POSIX_SHELLS, PWSH_SHELLS, SHELL_WRAPPERS, WRAPPER_ARG_OPTS, lexShell, programName, setPipefail,
  shellScript, pipeMaskedIn, verifyPipes, expectsFail, CANT_RUN_EXIT, CANT_RUN_OUTPUT, RE_ASSERTION_RAN,
  RE_PESTER_FAILED, RE_PESTER_NOT_RUN, pesterRan, couldNotRunOutput,
  cantRunRecord, isRedRun, redProof, expectFailIssue, expectFailRun, expectFailRefusal, expectFailResult, redGreenGaps,
  gitEvidence, OBSERVED_LOG, OBSERVED_MAX_BYTES, OBSERVED_WINDOW_MS, OBSERVED_MAX_COMMAND, OBSERVED_MAX_FEATURES,
  EVIDENCE_MODES, flatCommand, evidenceMode, evidenceSince, evidenceRule, evidenceModeInput, setEvidenceMode,
  observedLogFile, readObservedLog, observedRun, observedAny, observedStamp, observedProof, verifyCommandSet,
  observeRun, appendObserved, trimObservedLog, lastTaskActivity, CHECK_NAME_RE, CHECKS_MAX, validCheckName,
  validCheckCmd, projectChecks, checksInput, checksPlanError, writeChecks, recordFinishChecks, suiteStatus,
  suiteCodeStamp, suiteLabel, commitTag, suiteSummaryLines, b5DoctorChecks, GITLOG_MAX_COMMITS, parseGitLog,
  taskCommits, unverifiedLabel, specChangedSince, untickedSince, __link };
