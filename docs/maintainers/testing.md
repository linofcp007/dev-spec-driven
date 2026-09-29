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
  file's first comment line).
- **The harnesses.** `mcp/tests/harness.js`: ONE server per process (mcp/server.js over stdio, its default project a
  throwaway temp dir), the handshake, and the context every file's `run` receives, destructured in its signature
  (`exports.run = async ({ ok, rpc, S, tmp }) => { … }` — no parameter name a test could redeclare): `ok`, `rpc`,
  `rawOnce`, `notify`, `payload`, `S` (the engine), `root`, `tmp`, `SERVER`, `libSources()`, `maintainerNotes()`,
  `GATE_ORDER`, `approveBefore()`, `shipFeature()`, `child` / `abort()`, the handshake's `init` / `list`, and `require` /
  `__dirname` / `__filename` **as mcp/test.js's**: test code reads paths from `mcp/` (`require("./lib/i18n.js")`,
  `path.join(__dirname, "server.js")`) whichever file it lives in. `cli/tests/harness.js`: `ok`, `run(args)` (`node
  cli/dev-spec.js <args>` with `SPEC_PROJECT_DIR` = `tmp`), `tmp`, `CLI`, and cli/test-cli.js's `require` / `__dirname`.
- **How it runs.** A file is independent unless it declares `exports.deps` — the files it needs to have run first IN THE
  SAME PROCESS, because it reads a project folder they built or a value one of them returned (`return { vDir }` from
  `run` joins the context of the files after it) — say which in a comment above `deps`. A file and
  the files it needs form a chain; every chain runs in its own child process (its own temp dir and server), at most one
  per CPU, the longest first (by the previous run's times, kept in `<os tmpdir>/dev-spec-test-times-<mcp|cli>.json`; a
  file never timed starts first). The output comes file by file (a `# <file>` line before each), then `# N file(s) in M process(es), T s —
  slowest: …`, then the total: the LAST line is always `N passed, M failed` (scripts/test-docker.js reads it). A process
  that dies or never prints its total fails the suite, a file that throws is one FAIL (its chain goes on), a server that
  stops answering (15 s) fails the run — never a drain to exit 0. The MCP chains today: `01-core → 17-docs` (17-docs reads
  `vDir`, the project whose login-loop feature 01-core took to its finish) and `17-docs-evals → 15-quality`
  (15-quality re-checks the behavioural fixtures 17-docs-evals builds under tmp). The handshake's assertions are counted
  by the file exporting `handshake: true` (02-mcp-server); every other process runs the handshake muted.
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
  — never rely on file order. Timing-bound assertions share the machine with the other processes: bound them relative to
  a baseline measured in the same test (as the 1.17 H checks do), not with a figure tuned on an idle machine.
- **The source guards follow the layout:** the U+FEFF guard reads mcp/test.js, scripts/test-runner.js and every file of
  mcp/tests/.

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
  a paid run.
- **Tests run on Windows AND Linux** (`npm run test:docker`): a `_Verify:_` a test writes must work under cmd.exe AND
  `/bin/sh` — quote it (`node -e "process.exit(0)"`; the bare `node -e process.exit(0)` is a sh syntax error that cmd.exe
  accepts); don't depend on a case-insensitive file system (assert the Linux counterpart where Windows/macOS fold case)
  or on the text of a V8 error (Node 18 omits a RegExp's flags in its SyntaxError).
- **Eval harness** (`run-evals.js`) resolves the feature with the engine's resolver (accents, legacy slugs,
  `${VAR}` guard), prints in the feature's language, and treats a wrong-shaped set as invalid (exit 1). It validates
  EVERY item (`itemProblems()`: object, `id`, `input`, a grader in contains|equals|regex|refuse|judge, a value / a regex
  that compiles with gradeItem's flags / a rubric) and `thresholds.json` (a number in [0, 1] per set) before anything
  runs: a dry run exits 1 naming each bad item, a live run calls no model while any set is invalid.
