# Testing — Linux containers, plugin evals, cross-platform rules

Maintainer notes, one topic of the map in [CLAUDE.md](../../CLAUDE.md) — the index and the hard constraints.
The suites, their exact counts and the source guards are in CLAUDE.md → Tests; this file holds the rest.

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
