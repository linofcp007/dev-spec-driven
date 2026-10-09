# Testing — the suites' layout, Linux containers, plugin evals, cross-platform rules

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The suites' exact counts and the source guards are in CLAUDE.md → Tests; this file holds the rest.

## The suites: files, runner, running a part (1.20)
- **Layout.** `node mcp/test.js` and `node cli/test-cli.js` are small entry points over ONE runner, `scripts/test-runner.js`
  (Node core only). The assertions live in `mcp/tests/NN-<area>[-<topic>].js` (the MCP server: one file per area, each
  ≤ ~1,500 lines) and `cli/tests/NN-<area>-<topic>.js` (the CLI: one small file per topic). NN numbers the AREA and is the
  same in both folders: 01 core · 02 the MCP server / CLI surfaces · 03 languages · 04 tracks · 05 markdown and trace ·
  06 gates · 07 approvals · 08 tasks · 09 evidence · 10 guards and hooks · 11 Claude Code integration · 12 lifecycle ·
  13 imports · 14 templates and exports · 15 spec quality · 16 conventions and source guards · 17 docs and prose ·
  18 review regressions whose findings span several areas. `--list` prints every file with its one-line summary (the
  file's first comment line). (1.21 F5: `06-gates-sizes.js` in both folders — the sizes, the change kind, the stricter
  filled rule, the overlaps; its pinned sha1 is every no-size builder output of the pre-1.21 track combinations: update it
  only when the no-size scaffold changes ON PURPOSE. A test that "fills" a track section answers each `> **TODO**` line with
  a line of its own — deleting the sentinel and keeping the guidance bullet is the template, not an answer.) (1.24 r6 I-I8:
  `16-conventions.js` was the MCP suite's critical path — ~30 s alone, 33–40 s under load, the rest of the suite done long
  before it; its "1.20 build" block — the committed corpus and stop-claim filter, the bundle, the race of sources updated under
  a running process, the all-language sets — is `16-conventions-build.js` now, in a process of its own: ~16 s each, every
  assertion kept, 56 + 14. Split a file the same way when `--times` shows it alone on the critical path.)
- **The harnesses.** `mcp/tests/harness.js`: ONE server per process (mcp/server.js over stdio, its default project a
  throwaway temp dir), the handshake, and the context every file's `run` receives, destructured in its signature
  (`exports.run = async ({ ok, rpc, S, tmp }) => { … }` — no parameter name a test could redeclare): `ok`, `rpc`,
  `rawOnce`, `notify`, `payload`, `S` (the engine), `root`, `tmp`, `SERVER`, `libSources()`, `maintainerNotes()`,
  `GATE_ORDER`, `approveBefore()`, `shipFeature()`, `child` / `abort()`, the handshake's `init` / `list`, and `require` /
  `__dirname` / `__filename` **as mcp/test.js's**: test code reads paths from `mcp/` (`require("./lib/i18n.js")`,
  `path.join(__dirname, "server.js")`) whichever file it lives in. `cli/tests/harness.js`: `ok`, `run(args)` (`node
  cli/dev-spec.js <args>` with `SPEC_PROJECT_DIR` = `tmp`), `tmp`, `CLI`, and cli/test-cli.js's `require` / `__dirname` — and
  (1.27) **`runIn(args, {env, cwd, input})`** — the same `{ out, code }` IN the test process (cli/main.js `main`, the call's
  environment and working folder applied for it and restored; ~100× cheaper than a process) — and **`spawnIn(args, {env, cwd,
  input})`**, spawnSync's `{ stdout, stderr, status }` the same way (its `env` the whole environment, as spawnSync's). **Call the
  CLI in-process unless the test needs a real process:** a `--run` that runs commands (it waits: runIn / spawnIn throw on a call
  that doesn't settle at once — every helper sends `--run` calls to spawnSync), EPIPE, a real stdin pipe or a TTY, a process's
  own timing or loaded modules (a preload), `DEV_SPEC_BUNDLE` (the facade picks the bundle at load), a lock held by another live
  process, `__complete` and the completion scripts' shells, git running the merge driver. 16-conventions-cli-modules.js checks
  runIn = run on a set of calls.
- **How it runs.** A file is independent unless it declares `exports.deps` — the files it needs to have run first IN THE
  SAME PROCESS, because it reads a project folder they built or a value one of them returned (`return { vDir }` from
  `run` joins the context of the files after it) — say which in a comment above `deps`. A file and
  the files it needs form a chain; every chain runs in its own child process (its own temp dir and server), at most one
  per CPU, the longest first (by the previous run's times, kept in `<os tmpdir>/dev-spec-test-times-<mcp|cli>.json`; a
  file never timed starts first). The output comes file by file (a `# <file>` line before each), then `# N file(s) in M process(es), T s —
  slowest: …`, then the total: the LAST line is always `N passed, M failed` (scripts/test-docker.js reads it). A process
  that dies or never prints its total fails the suite, a file that throws is one FAIL (its chain goes on), a server that
  stops answering (15 s) fails the run — never a drain to exit 0. On a loaded machine (1.26): a chain whose process the OS
  refuses to start (spawn() throwing `UNKNOWN` / `EAGAIN` under memory or handle pressure — it used to crash the whole run, every
  other chain's output lost) is tried once more a second later, then fails; a chain still running after 30 min
  (`DEV_SPEC_TEST_CHAIN_TIMEOUT_S`) is killed with its process tree and fails — the suite never hangs on a stuck child. Each file gets its own `ok`: one it calls after its `run`
  resolved (a forgotten await) is a FAIL, "late assertion from <file>", whenever it fires — the runner lets pending timers
  run (≤ 3 s) before the total, and one fired after it prints the total again; the total is read from stdout alone (a Node
  warning on stderr after it doesn't void the count). cli/tests/16-conventions-runner.js tests the runner on a fake suite.
  The MCP chains today: `01-core → 17-docs` (17-docs reads
  `vDir`, the project whose login-loop feature 01-core took to its finish) and `17-docs-evals → 15-quality`
  (15-quality re-checks the behavioural fixtures 17-docs-evals builds under tmp). The handshake's assertions are counted
  by the file exporting `handshake: true` (02-mcp-server); every other process runs the handshake muted.
- **Hermetic chains (1.26).** A chain never sees the shell the suite was started from: the runner spawns it with a fresh,
  empty temp folder as its working folder (`<os tmpdir>/<spec-test-|cli-test->XXXXXX`, removed once it closed) and an
  environment without the variables that steer the plugin — `SPEC_PROJECT_DIR`, `CLAUDE_PROJECT_DIR`, `SPEC_MCP_*`,
  `CLAUDE_PLUGIN_*`, `COLUMNS` and every `DEV_SPEC_*` but the suites' own `DEV_SPEC_TEST_*` (`DEV_SPEC_TEST_CHAIN`,
  `DEV_SPEC_TEST_CWD`, `DEV_SPEC_TEST_BASH` / `_ZSH` / `_FISH`) — scripts/test-runner.js `isolate()` / `hermeticEnv()`. The
  child runs `isolate()` again before it loads a file, and both harnesses first thing (a no-op in the folder the runner gave
  it), so a chain started by hand (`DEV_SPEC_TEST_CHAIN=<file> node mcp/test.js`) is isolated too. Why: the main checkout
  keeps a git-ignored dogfood `.specs/` (meta.lang pt) at the repo root, and a test that started the CLI or a hook without
  naming a project picked it up — green in a worktree, red after the merge; a `DEV_SPEC_DEFAULT_LANG` or `SPEC_PROJECT_DIR`
  exported in the maintainer's shell did the same. A test that needs one of these variables sets it for the process it
  starts; a test never reads `process.cwd()` for a path (use `tmp`, `root`, `__dirname`). cli/tests/16-conventions-runner.js
  proves it on the fake suite (a decoy `.specs/` and the variables exported: none reaches a chain). The proof run: put a decoy
  `.specs/` (`roadmap.json` `{"features":{},"meta":{"lang":"pt"}}` and a feature folder) at the repo root, export
  `SPEC_PROJECT_DIR` / `CLAUDE_PROJECT_DIR` at it and `DEV_SPEC_DEFAULT_LANG=es`, and run both suites — still green.
- **Running a part.** `--only <x>[,…]` (repeatable) takes a file by its full name (`17-docs` — that file alone; the CLI's
  `06-gates`, no file of that exact name, means `06-gates-*`), an area by its number (`09`) or its name (`gates`; `tracks`
  → `04-tracks` and `04-tracks-builtin`), and pulls in — and names — the files they need: `node mcp/test.js --only
  17-docs` runs 01-core first. `--list` runs nothing; `--times` adds every file's time and count;
  `--jobs <n>` caps the processes (`--jobs 1` to time files without contention). The same options work on both suites.
- **Adding a test.** Put it in the file of its area (the `--list` summaries say what each holds), in its own `{ … }`
  block under a one-line comment. No per-release sections any more: 1.13–1.19 each added a section / block per package;
  the 1.20 split moved them into their areas and kept their `// 1.xx …` comments as history. A new file only for a new
  area or a file past ~1,500 lines: `NN-<area>-<topic>.js` whose first comment line says what it holds, exporting
  `run` (async in the MCP suite) — the runner picks it up. Make your projects under `tmp` (`path.join(tmp, "proj-<name>")`, a name no other file uses); the MCP
  server's default project (`tmp` itself) is 01-core's. A test that reads what another file built declares it in `deps`
  — never rely on file order. **Say what failed (1.26):** beside `ok(cond, label)` every file receives `all(label, conds)` and
  `eq(actual, expected, label)` (scripts/test-runner.js `assertHelpers`, built on the file's own `ok` — one call is ONE
  assertion, so the totals stay comparable, and a late one is a late assertion). **Prefer `all()` over `ok(a && b && …)` for
  more than ~4 conditions**: `ok()` with 15 conditions said only that one of them was false. `all(label, [() => a.ok, () =>
  /x/.test(a.text), …])` names each false condition on its own `false: <the thunk's source>` line below the FAIL (an object
  `{ name: cond, … }` names them by its keys); every condition is evaluated (no short circuit), a thunk runs lazily in order and
  a throw is a false condition with its message — so `r && r.ok` becomes `() => r.ok` and never aborts the file — and a promise
  is false (await it first). A prose check over many texts reads best as a table: `[[where, text, pattern], …]` mapped into
  `all()`'s object (mcp/tests/15-quality.js, the 1.22 simplification-pass prose: 65 conditions, each FAIL names the file and the
  sentence). `eq()` is `js(a) === js(b)` (key order counts) with the first difference printed: its path (`$.features[2].name`),
  what was found, what was expected. The 1.26 conversion turned the 201 `ok()`s of 15 or more conditions (3,814 conditions, 42
  files) into `all()` — every one but the five of 02-mcp-server.js (none in 17-docs*.js). Timing-bound assertions share the machine with the other processes: bound them relative to
  a baseline measured in the same test (as the 1.17 H checks do), not with a figure tuned on an idle machine — keep the old
  figure as a floor (`Math.max(floor, k × baseline)`: an idle run is as strict as before) and measure once more on a
  timing-only miss (the statusline and flat-import checks since the 1.20 review). Since 1.26 that retry is one call — every
  file receives `remeasure(measure, holds)`: `measure()` returns a sample (the times AND whatever the check reads — the baseline
  too, when the bound is relative), `holds(sample)` says whether the time bound holds; on a miss it measures again and returns
  the passing retry or the last miss (`sample.tries`). A load spike fails one sample, a real regression (a linear scan gone
  quadratic, a retry loop come back) fails both. Prefer counting to timing where the regression has a count: "refused at once"
  is ONE rename attempt (16-conventions-review7-core.js — `took < 1000` missed at 1,333 ms under load), the wall time a backstop.
  1.26 put it on: the read-only refusal, the `__complete` medians (cli/tests/16-conventions-completion.js), the 16 KB / 64 KB
  ratios and the 1 MB "at once" bound of the run matcher (09-evidence.js, 09-evidence-matcher.js), the cross-call cache's
  cold / warm ratio (15-quality.js), the nested lock's wait (16-conventions.js) and the in-process "bounded time" checks of
  18-reviews.js (S2, S4, S5/S6, R10), 04-tracks.js, 04-tracks-builtin.js, 03-languages.js, 05-markdown-trace.js, 08-tasks.js,
  09-evidence.js, 10-guards.js, 10-guards-review.js, 13-imports.js and 15-quality.js (bounds unchanged); and on one non-timing
  miss seen only under load — 16-conventions.js asks git `check-ignore` once more when it answers nothing.
- **The source guards follow the layout:** the U+FEFF guard reads mcp/test.js, scripts/test-runner.js and every file of
  mcp/tests/. The engine guards (U+FEFF, backslash-stripped regex literals) also read scripts/build.js — a bundle's
  registry comes from it — and `libSources()` leaves a user-built `mcp/lib/spec.bundle.js` out (the sources verbatim: it
  would only report every finding twice).
- **The corpus and the bundle (1.20).** Run `npm run build` after changing a file of `CORPUS_SOURCES` (`mcp/lib/i18n.js`,
  `mcp/lib/i18n/*.js`, `engine/core.js` / `markdown.js` / `packs.js` / `tasks.js` / `tracks.js`) — never for a version bump
  alone (1.26: the generated files carry no version; `npm run check` says whether they are current) — and BEFORE the suites: mcp/tests/16-conventions-build.js ("1.20 build") fails while the committed `corpus.generated.json` differs from a
  fresh build (architecture.md → The build). The bundle is never committed: its tests BUILD one into tmp (`writeBundle()` /
  `dev-spec bundle --out`) and point `DEV_SPEC_BUNDLE_PATH` at it. Both suites run on the engine's modules — the runner and the
  harnesses drop `DEV_SPEC_BUNDLE` (with every other `DEV_SPEC_*` — Hermetic chains) for their processes; the bundle's own
  tests set it for the children they start: 16-conventions-build ("1.20
  bundle": the namespace, the embedded corpus, the modules' paths, the stamps; the facade's choice on a copy of the clone —
  none, current, unset / 0, an invalid or another `DEV_SPEC_BUNDLE_PATH`, a module touched or resized and put back, another
  version, a broken bundle; the MCP server on it; "1.20 build": a copy of the clone with a missing, broken or hand-edited
  corpus renders it and decides every fresh scaffold text alike — one under another package.json version reads it, and a
  rebuild after a version bump rewrites neither generated file (1.26) — and V8 coverage proves `CORPUS_SOURCES`) and
  cli/tests/16-conventions-bundle.js (`dev-spec bundle`, then one session — 39 CLI commands, 7 hook events — in two fresh
  projects, modules vs bundle: the same output, exit codes and `.specs/` tree).

## Tests (continued)
- **Linux, locally:** `npm run test:docker` (`scripts/test-docker.js`, zero-dep) runs both suites in
  `node:18-alpine` (the engines floor, musl), `node:22-bookworm-slim` and `node:24-alpine`:
  `docker run --rm --network none --user 1000:1000 -v <repo>:/repo:ro`, `--init`, the repo READ-ONLY (the suites work
  under `os.tmpdir()`) and copied (without .git) into the container's own file system, where the suite runs — where an
  installed plugin lives: a Docker Desktop bind mount costs tens of ms per file loaded and the engine is ~36 files since
  1.18 (a 50-feature statusline took 9–10 s on the mount, 0.7 s on the copy); `--mounted` runs from the mount to measure a
  slow file system. No network, an unprivileged user (`--root` to opt out). Only the first run needs network — to pull
  and to build a cached derived image `dev-spec-test:<image>` that adds git (`--no-git` skips it; the git-dependent tests
  then skip; `--rebuild` rebuilds it). Options `--image <name>` (repeatable), `--suite mcp|cli`. Exit 0 all passed · 1 a
  suite failed or an image couldn't be prepared · 2 no Docker (not installed, daemon down, Windows-containers mode) or a
  usage error; logs in `<tmp>/dev-spec-docker/<image>-<suite>.log`. Never wire it to hosted CI.
- **Plugin evals** (`claude plugin eval`, maintainer-side, cost tokens, local only): the triggering suite
  (`--tag triggering negative`) and the behavioural suite (`--tag behavior` plus `--scaffold --allow-real-servers
  --allow-tools …` — the exact command is in evals/README.md). `mcp/test.js` checks every behavioural case is well-formed
  (runs, turns, a scaffold, ≥ 3 graders incl. a deterministic one, regexes compile, every MCP tool it names exists) and
  builds every fixture with the current engine (bash / Git Bash; skipped without bash) — fix a fixture there, not after
  a paid run. A grader regex that failed a right answer in a paid run gets that answer as a fixture: 1.21 checks the
  finish case's `local-options` pattern on both replies the 1.19.0 run recorded (`17-docs-evals.js`). The case front
  matter has no `disallowed_tools` (CLI 2.1.282: `max_turns`, `timeout_seconds`, `model`, `allowed_tools`,
  `artifact_publish`, `growthbook_overrides`, `append_system_prompt`, `env`) and `allowed_tools` only grants gated tools,
  so `Agent` can't be taken away per case; the triggering cases keep `max_turns: 4` (a "max turns" run error after the
  Skill fired is harmless — evals/README.md).
- **Tests run on Windows AND Linux** (`npm run test:docker`): a `_Verify:_` a test writes must work under cmd.exe AND
  `/bin/sh` — quote it (`node -e "process.exit(0)"`; the bare `node -e process.exit(0)` is a sh syntax error that cmd.exe
  accepts); don't depend on a case-insensitive file system (assert the Linux counterpart where Windows/macOS fold case)
  or on the text of a V8 error (Node 18 omits a RegExp's flags in its SyntaxError). A test that RUNS PowerShell (1.21.1 —
  cli/tests/09-evidence-done-run.js: `done --run --shell pwsh`, a `pwsh -Command "…"` `_Verify:_` under cmd.exe, `--shell
  powershell`) probes the program first (`<shell> -NoProfile -NonInteractive -Command "exit 0"` → 0) and asserts `ok(true,
  "… skipped: …")` without it — the Docker images have no pwsh, and cmd.exe / Windows PowerShell exist only on Windows. The
  POSIX-shell refusal of a double-quoted pwsh script runs everywhere (nothing is run: /bin/sh on Linux, `--shell bash` on
  Windows — skipped without Git Bash), a Pester run is stood in for by a node script printing captured Pester output, and the
  engine-level PowerShell checks (posixShellSyntax, posixPwshScript, resolveRunShell, couldNotRunOutput / pwshParseFailure
  on captured pwsh 7 / 5.1 / Pester 3–6 outputs, every new pattern timed on 200 KB hostile inputs) run everywhere.
  The shell completion scripts (1.25, cli/tests/16-conventions-completion.js) run the same way: bash (Git Bash on Windows,
  `DEV_SPEC_TEST_BASH`), Windows PowerShell / pwsh through TabExpansion2, zsh and fish where installed (`DEV_SPEC_TEST_ZSH`,
  `DEV_SPEC_TEST_FISH` — the Docker images have neither: `apk add zsh fish bash` in a `node:24-alpine` container runs them
  all), each skipped with an `ok(true, "… skipped")` where it isn't.
- **Eval harness** (`run-evals.js`) resolves the feature with the engine's resolver (accents, legacy slugs,
  `${VAR}` guard), prints in the feature's language, and treats a wrong-shaped set as invalid (exit 1). It validates
  EVERY item (`itemProblems()`: object, `id`, `input`, a grader in contains|equals|regex|refuse|judge, a value / a regex
  that compiles with gradeItem's flags / a rubric) and `thresholds.json` (a number in [0, 1] per set) before anything
  runs: a dry run exits 1 naming each bad item, a live run calls no model while any set is invalid.
