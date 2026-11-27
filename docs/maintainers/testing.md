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
  18 cross-area regressions (`18-cross-area*.js` — findings that span several areas). `--list` prints every file with its
  one-line summary (the file's first comment line). `mcp/tests/fixtures/` holds files a test reads byte for byte (1.30: the
  launcher dev-spec-driven 1.29 wrote, `guardian-launcher-1.29.cjs`; 1.33: the one 1.30–1.32.x wrote, `guardian-launcher-1.32.cjs` —
  never edited: their sha1s are pinned; 1.41: `metric-lines.v1.json`, the METRIC line's contract with dev-guardian — the same
  bytes at its `mcp/test/fixtures/metrics/`, BOTH suites pinning one sha256 literal (09-evidence-runs.js here,
  `test/unit/metrics/metricLinesFixture.test.ts` there), never edited: a change is `metric-lines/2`, a new file landed in both
  repositories before either tags; 1.42: `metric-bytes.v1.json`, how the two METRIC readers decode a run's bytes — the same bytes
  at its `mcp/test/fixtures/metrics/`, both suites pinning one sha256 (09-evidence-runs.js here,
  `test/unit/metrics/metricBytesFixture.test.ts` there), a change is `metric-bytes/2`); the runner loads only
  `NN-*.js` files. 1.41's topics: 09 — `09-evidence-friction.js` (the friction budget: `_Budget:_` lines, timings.jsonl, the
  verdict, next_action's hint) and `09-evidence-metrics.js` (METRIC lines: the reader case by case against the fixture, the
  judge, the latest run's readings, finish's comparison, Silent Regressions' unmeasured names, spec_metrics' `measured`), with
  their CLI twins `cli/tests/09-evidence-run-friction.js` / `09-evidence-run-metrics.js` (real children through `done --run` /
  `finish --run`); W in each suite's `09-evidence-guardian.js`; 12 — `12-lifecycle-lessons.js` (the lesson kind, finish's
  `lessons`, the brief's part, spec_metrics' lessons on the one walk, the finish batch's order against
  commands/spec-finish.md); 15 — `15-quality-reference-examples.js` (structure.md's table, doctor `reference-examples`, the
  brief's part). 1.41.1: 12 — `12-lifecycle-read-gate.js` (the read gate: every `OPERATIONS` entry and the hooks on a link maze
  under an fs tracer, `feature-linked`, doctor `specs-links`, where absence relaxes a decision, the cost as counts, R3's project
  files by real path) and its CLI twin `cli/tests/12-lifecycle-read-gate.js`, with `12-lifecycle-read-gate-root.js` (the gate's ROOT —
  the project's own .specs/, never a folder merely named so —, the listing's seed and its counts, the readers outside the primitives,
  the review's surviving mutants) and `12-lifecycle-read-gate-scope.js` (every entry the surfaces call reads with its project
  recorded — a property over the operations, resources, CLI commands, hooks and the MCP server). **A file is named after its topic** — `10-guards-shell-writes.js`,
  `12-lifecycle-branch.js` — never after a release or a review round: 1.27 renamed the 23 that were (`10-guards-review7.js`
  → `10-guards-shell-writes.js`, `13-imports-1-25.js` → `13-imports-steering.js`, `18-reviews.js` → `18-cross-area.js`…) and
  merged six small ones into their area's topic file (`05-markdown-r7-readers.js` into `05-markdown-readers.js`). An
  assertion's label keeps its review id ("1.25.1 review 7: …", "1.24 r6 I-I3") — grep the label, not the file name.
  (1.21 F5: `06-gates-sizes.js` in both folders — the sizes, the change kind, the stricter
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
  `GATE_ORDER`, `approveBefore()`, `shipFeature()`, `hookIn()` / `cliIn()` / `handRoadmap()` (below), `child` / `abort()`, the
  handshake's `init` / `list`, and `require` /
  `__dirname` / `__filename` **as mcp/test.js's**: test code reads paths from `mcp/` (`require("./lib/i18n.js")`,
  `path.join(__dirname, "server.js")`) whichever file it lives in. `cli/tests/harness.js`: `ok`, `run(args)` (`node
  cli/dev-spec.js <args>` with `SPEC_PROJECT_DIR` = `tmp`), `tmp`, `CLI`, and cli/test-cli.js's `require` / `__dirname` — and
  (1.27) **`runIn(args, {env, cwd, input})`** — the same `{ out, code }` IN the test process (cli/main.js `main`, the call's
  environment and working folder applied for it and restored; ~100× cheaper than a process) — and **`spawnIn(args, {env, cwd,
  input})`**, spawnSync's `{ stdout, stderr, status }` the same way (its `env` the whole environment, as spawnSync's) — and (1.30)
  **`runAsync` / `spawnAsync`**, the same for a call that WAITS (`done --run` / `finish --run` running their commands — runIn /
  spawnIn throw on a call that doesn't settle at once): a promise of the same shape (+ runAsync's `stdout` alone), awaited — the
  run's commands are still processes, only the CLI's own start and engine load are saved (the --run files went 2–4× faster:
  09-evidence-guardian 30.6 → 9.4 s). **Call the
  CLI in-process unless the test needs a real process:** a signal during a run, EPIPE, a real stdin pipe or a TTY, a process's
  own timing or loaded modules (a preload), `DEV_SPEC_BUNDLE` (the facade picks the bundle at load), a lock held by another live
  process, `__complete` and the completion scripts' shells, git running the merge driver. 16-conventions-cli-modules.js checks
  runIn = run on a set of calls. **In-process calls run one at a time (1.30):** a call that waits keeps its env and cwd applied
  until it ends, and `main()` called meanwhile is queued behind it (it then settles later — runIn / spawnIn refuse it as one that
  waits); a test that lets a waiting call go on its own awaits `MAIN.whenIdle()` before its next in-process call. **The hooks the
  same way (1.30, review 8):** the MCP harness's **`hookIn(file, {input, env, cwd, timedOut})`** runs a hook's exported `decide()`
  in the test process with spawnSync's `{ status, stdout, stderr }` (env the whole environment, applied and restored with the
  working folder — claude-code-integration.md → A hook IS its decision). **Call a hook in-process unless the test is about its
  process:** stdin (an oversized or partial payload — `timedOut` stands in for the safety net in-process), the flushed exit, the exec
  form, what a fresh process loads (a `-r` preload), its timing, a copy of the hooks over a broken engine. The hook tests' spawns
  were most of 10-guards*.js's time (the area's critical path). **The CLI the same way in the MCP suite (r14):** **`cliIn(args,
  {env, cwd, input})`** runs cli/main.js `main` in the test process with spawnSync's `{ status, stdout, stderr }` — the CLI suite's
  `spawnIn`; a command that waits throws (keep a process there). **A project whose tests read nothing of its ROADMAP.md:**
  **`handRoadmap(projectDir)`** right after its `initProject` writes a hand-written `.specs/ROADMAP.md`, which the engine never
  overwrites — every mutation then skips the roadmap refresh, `roadmapData` over every feature of the project each time (quadratic
  over a test that scaffolds many features: 50 creates cost 15 s). The refresh swallows its errors, so in such a test it proved
  nothing; a roadmap test renders it in memory (`renderRoadmapMd`, `S.roadmap` — unaffected) or reads the file of a project of
  its own. The refresh was a third of the heavy files' time (measured with a counting preload: proj-wp5 in 06-gates 15 s, the
  50-feature project of 15-quality 15 s).
- **How it runs.** A file is independent unless it declares `exports.deps` — the files it needs to have run first IN THE
  SAME PROCESS, because it reads a project folder they built or a value one of them returned (`return { vDir }` from
  `run` joins the context of the files after it) — say which in a comment above `deps`. A file and
  the files it needs form a chain; every chain runs in its own child process (its own temp dir and server), at most one
  per CPU, the longest first (by the previous run's times, kept in `<os tmpdir>/dev-spec-test-times-<mcp|cli>-<id>.json` —
  `<id>` 10 hex of the checkout's root path (1.30): each worktree has its own, and each write keeps only the suite's current
  files, so a renamed or deleted file's entry goes with the next run, `--only`'s too; a file never timed starts first; 1.42: a
  non-blank `DEV_SPEC_TEST_TIMES_ROOT` keys it by that folder instead — the parent's knob alone: no chain sees it, in any spelling
  — and the local pre-push hook sets it to the pushing checkout, so its fresh temp worktree starts the longest chains first, where
  every chain weighed "never timed"; never export it in a shell: every checkout would share one file, the 1.30 problem; what the
  suites leave in the OS temp folder: `dev-spec-test-times-<mcp|cli>-<id>.json` — a run's order only — and the status line's
  `dev-spec-statusline-<16 hex>.json` cache entries — dead 10 s after their write —, both safe to delete). The output comes file by file (a `# <file>` line before each), then `# N file(s) in M process(es), T s —
  slowest: …`, then the total: the LAST line is always `N passed, M failed` (scripts/test-docker.js reads it). A process
  that dies or never prints its total fails the suite, a file that throws is one FAIL (its chain goes on), a server that
  stops answering (15 s) fails the run — never a drain to exit 0. On a loaded machine (1.26): a chain whose process the OS
  refuses to start (spawn() throwing `UNKNOWN` / `EAGAIN` under memory or handle pressure — it used to crash the whole run, every
  other chain's output lost) is tried once more a second later, then fails; a chain still running after 30 min
  (`DEV_SPEC_TEST_CHAIN_TIMEOUT_S`) is killed with its process tree and fails — the suite never hangs on a stuck child. Each file gets its own `ok`: one it calls after its `run`
  resolved (a forgotten await) is a FAIL, "late assertion from <file>", whenever it fires — the runner lets pending timers
  run (≤ 3 s) before the total, and one fired after it prints the total again; the total is read from stdout alone (a Node
  warning on stderr after it doesn't void the count). **A check that cannot run here (1.42)** — no git, no pwsh / zsh / fish,
  links not creatable — calls `skip(label, why)`, which every file receives beside `ok` from the runner: neither a pass nor a
  fail, a `  skip - <label> (<why>)` line, the suite's skips summed in a `# K skipped in F file(s): <file> <n>, …` line before
  the total (a late one is a late assertion) — never an `ok()` whose first argument is a truthy LITERAL (`true`, a number but 0, a
  non-empty string, `[]` / `{}`, a falsy one negated), which counted as a pass (mcp/tests/16-conventions.js refuses one, and a
  hand-printed skip line, in every test file, with no allowance; a falsy literal is a fail and stays — the harnesses' `ok(false,
  label)` —, and a truthy EXPRESSION is not read). cli/tests/16-conventions-runner.js tests the runner on a fake suite, whose files
  assert `ok(typeof exports === "object", …)`. "Links not creatable" is a win32 cause alone (a junction, a file symlink without
  Developer Mode): a link failure skips on win32 and is rethrown elsewhere — the file FAILS, a broken fixture never a skip.
  **Known limits** (the guard cannot read either shape; split each into its own `ok()` + `skip()` when next touched): the older
  link sites — the `link()` helpers of the 12-lifecycle-* files (and cli/tests/12-lifecycle-read-gate.js), the inline ones of
  02-mcp-server, 04-tracks, 13-imports, 14-exports, 18-cross-area — still skip on ANY error (1.42's own sites rethrow off win32);
  and a part skipped INSIDE a passing assertion counts as a pass — a `!linked || …` disjunct (02-mcp-server.js's linked artifact /
  folder rows, 13-imports.js's 1.17 F3 and review 9, 14-templates.js's B1, 16-conventions.js's G-I2, cli 12-lifecycle-read-gate.js,
  cli 16-conventions-merge-state.js), `git: ignored === null || …` (09-evidence-guardian.js), and 02-mcp-server.js's row that
  exists only where tmp has two spellings (neither a pass nor a skip elsewhere: the alias leg's one extra MCP assertion).
  The MCP chains today: `01-core → 17-docs` (17-docs reads
  `vDir`, the project whose login-loop feature 01-core took to its finish) and `17-docs-evals → 15-quality-fixtures`
  (re-checks of the behavioural fixtures 17-docs-evals builds under tmp — 1.30: they were 15-quality's, and the two files were the
  suite's critical path). The handshake's assertions are counted by the file exporting `handshake: true` (02-mcp-server); every
  other process runs the handshake muted. A chain's process requires only its own files (1.30 — requiring the whole suite to find
  them cost each chain ~0.25 s MCP / ~0.1 s CLI); the MCP harness starts its server before it loads the engine (the two starts
  overlap). **Split a file that alone sets the critical path** (`--times`, the default `--jobs` = one per CPU) by topic, mechanically
  — the blocks move verbatim, a shared fixture is exported by the main file (16-conventions-completion.js `fixture`), never copied.
  (1.40: 15-quality-design-system-cost.js's G1–G3 → 15-quality-design-system-cost-deprecated.js, which takes `trees` — its
  projects under a prefix of its own, `proj-costdep-` — and `pair` from the main file.)
  At `--jobs 4` the wall time is the files' sum / 4: there only less work (fewer process starts) makes it shorter.
- **Hermetic chains (1.26).** A chain never sees the shell the suite was started from: the runner spawns it with a fresh,
  empty temp folder as its working folder (`<temp base>/<spec-test-|cli-test->XXXXXX`, removed once it closed — The temp base) and an
  environment without the variables that steer the plugin — `SPEC_PROJECT_DIR`, `CLAUDE_PROJECT_DIR`, `SPEC_MCP_*`,
  `CLAUDE_PLUGIN_*`, `COLUMNS` and every `DEV_SPEC_*` but the suites' own `DEV_SPEC_TEST_*` (`DEV_SPEC_TEST_CHAIN`,
  `DEV_SPEC_TEST_CWD`, `DEV_SPEC_TEST_BASH` / `_ZSH` / `_FISH`; 1.41.1: `DEV_SPEC_TEST_APPROVAL_DEADLINE_MS`, which only lowers the
  approval hook's deadline — a test sets it for the hook it starts, never export it) — scripts/test-runner.js `isolate()` / `hermeticEnv()`; 1.29:
  nor the maintainer's installed plugins — `DEV_GUARDIAN_CLI` is dropped and `CLAUDE_CONFIG_DIR` names an absent folder inside
  the chain's own (`no-claude-config`), so no dev-guardian plugin cache is seen (init / spec_upgrade would offer its gate on one
  machine and not on another; a test that wants one builds a fake cache and passes it); 1.30: nor Node's own steering
  variables (`RE_NODE_ENV`) — `NODE_OPTIONS` (a `--require` preload: a VS Code JavaScript Debug Terminal's bootloader reached every
  chain, server, hook and CLI process), `NODE_COMPILE_CACHE` / `NODE_DISABLE_COMPILE_CACHE`, `NODE_DEBUG` / `NODE_DEBUG_NATIVE`,
  `NODE_V8_COVERAGE`, `NODE_PATH`, `NODE_PRESERVE_SYMLINKS(_MAIN)`, `NODE_NO_WARNINGS`, `NODE_PENDING_DEPRECATION`,
  `NODE_REDIRECT_WARNINGS` — unless `DEV_SPEC_TEST_KEEP_NODE_ENV=1` (a coverage run's `NODE_V8_COVERAGE`, a profiler's preload); 1.32.1:
  nor git's repository variables (`RE_GIT_ENV`: every name `git rev-parse --local-env-vars` prints — `GIT_DIR`, `GIT_WORK_TREE`,
  `GIT_INDEX_FILE`, `GIT_COMMON_DIR`…). git exports them to its hooks and to `git rebase --exec`'s command, so a suite run from a
  pre-push hook had every test's `git init` / `git commit` in a temp repo of its own act on the maintainer's repository. The
  child runs `isolate()` again before it loads a file, and both harnesses first thing (a no-op in the folder the runner gave
  it), so a chain started by hand (`DEV_SPEC_TEST_CHAIN=<file> node mcp/test.js`) is isolated too. Why: the main checkout
  keeps a git-ignored dogfood `.specs/` (meta.lang pt) at the repo root, and a test that started the CLI or a hook without
  naming a project picked it up — green in a worktree, red after the merge; a `DEV_SPEC_DEFAULT_LANG` or `SPEC_PROJECT_DIR`
  exported in the maintainer's shell did the same. A test that needs one of these variables sets it for the process it
  starts; a test never reads `process.cwd()` for a path (use `tmp`, `root`, `__dirname`). cli/tests/16-conventions-runner.js
  proves it on the fake suite (a decoy `.specs/` and the variables exported — a `NODE_OPTIONS` preload too: none reaches a chain; a
  `GIT_DIR` / `GIT_WORK_TREE` naming another repository: the chain's own commit lands in its own temp repo). The proof run: put a decoy
  `.specs/` (`roadmap.json` `{"features":{},"meta":{"lang":"pt"}}` and a feature folder) at the repo root, export
  `SPEC_PROJECT_DIR` / `CLAUDE_PROJECT_DIR` at it and `DEV_SPEC_DEFAULT_LANG=es`, and run both suites — still green.
- **The temp base (1.30).** No test depends on WHERE the temp folder is. The runner (and `isolate()` for a chain started by hand)
  takes a neutral base — `neutralTmpBase()`: the shell's temp folder, unless its path names dev-spec (`dev-spec`, `devspec`,
  a `.specs` segment), lies inside a folder holding a `.specs/`, holds a character a shell reads (`$`, a backtick, `%`, `!`, a
  quote) or — on Windows — is longer than 100 characters; then the user's default one (`%LOCALAPPDATA%\Temp`; `/tmp`,
  `/var/tmp`) — makes every chain's folder there and names it the chain's `TMP` / `TEMP` / `TMPDIR` (a line `# temp: …` says
  so). Why: under a TMP whose path said "dev-spec" the approval hook's partial-payload test saw dev-spec named in the payload's
  cwd, and under a 160-character one (Windows, git without `core.longpaths`) the pre-commit, worktree and eval-fixture tests
  could not reach their repositories' files (a 99-character base passes). The proof run: `TMP` / `TEMP` set to
  `<a long folder>\dev-spec-tmp`, both suites green; 16-conventions-runner.js checks the choice on the fake suite. No new nesting:
  a temp path's length is what git's MAX_PATH tests feel — keep a test's own paths short. Nor on where the CHECKOUT is
  (1.32.2): text that embeds the plugin's path (a tool description's runnable `node "<root>/cli/dev-spec.js"` line) is checked
  with that path taken out — the proof run: both suites from a worktree in a folder named `a.DFTcheck`.
- **Running a part.** `--only <x>[,…]` (repeatable) takes a file by its full name (`17-docs` — that file alone; the CLI's
  `06-gates`, no file of that exact name, means `06-gates-*`), an area by its number (`09`) or its name (`gates`; `tracks`
  → `04-tracks` and `04-tracks-builtin`), and pulls in — and names — the files they need: `node mcp/test.js --only
  17-docs` runs 01-core first. `--list` runs nothing; `--times` adds every file's time and count;
  `--jobs <n>` caps the processes (`--jobs 1` to time files without contention). The same options work on both suites.
- **Adding a test.** Put it in the file of its area (the `--list` summaries say what each holds), in its own `{ … }`
  block under a one-line comment. No per-release sections any more: 1.13–1.19 each added a section / block per package;
  the 1.20 split moved them into their areas and kept their `// 1.xx …` comments as history. A new file only for a new
  area or a file past ~1,500 lines: `NN-<area>-<topic>.js` — named after its topic, never a release or a review — whose
  first comment line says what it holds, exporting
  `run` (async in the MCP suite) — the runner picks it up. Make your projects under `tmp` (`path.join(tmp, "proj-<name>")`, a name no other file uses); the MCP
  server's default project (`tmp` itself) is 01-core's. A test that reads what another file built declares it in `deps`
  — never rely on file order. **Check a message by its entry, not its words (1.30):** a result's stable `code` / key first; its
  text against the rendered i18n entry — `S.msg(lang).<section>.<key>` (a string) or `….<key>(args)` (a function, with the
  arguments the test knows); a CLI file reads `MSG = require(…/mcp/lib/i18n.js).msg` — so a rewording touches the locale file
  alone; else a short fragment naming the message. A whole sentence is pinned only where the sentence IS the point: the prose
  guards (README tables, rule files, no PR / CI steering), the i18n parity and translation checks. (Review 8 found ~150 such pins;
  1.30 moved ~70 to their entries, 1.30.1 50 more (a stable `code` replaced two) — the 35 left are translation checks, a
  template's own structure or an entry's own words.) **Say what failed (1.26):** beside `ok(cond, label)` every file receives `all(label, conds)` and
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
  is ONE rename attempt (16-conventions-atomic-writes.js — `took < 1000` missed at 1,333 ms under load), the wall time a backstop.
  1.26 put it on: the read-only refusal, the `__complete` medians (cli/tests/16-conventions-completion.js), the 16 KB / 64 KB
  ratios and the 1 MB "at once" bound of the run matcher (09-evidence.js, 09-evidence-matcher.js), the cross-call cache's
  cold / warm ratio (15-quality.js), the nested lock's wait (16-conventions.js) and the in-process "bounded time" checks of
  18-cross-area.js (S2, S4, S5/S6, R10), 04-tracks.js, 04-tracks-builtin.js, 03-languages.js, 05-markdown-trace.js, 08-tasks.js,
  09-evidence.js, 10-guards.js, 10-guards-stop-gate.js, 13-imports.js and 15-quality.js (bounds unchanged; 1.32.1: 13-imports-scan.js's
  two budgets too); and on one non-timing miss seen only under load — 16-conventions.js asks git `check-ignore` once more when it
  answers nothing.
- **Cost guards — the method (1.40).** A ratio of two timings flaked under load where the property it guarded was a count, and
  a yardstick that skipped work the measured side does measured that work's speed instead. A new or changed cost check:
  (1) **counts before it times** — what the regression does to the file system is a count: `fsCalls(under, fn)` (every file
  receives it — scripts/test-runner.js) returns the fs calls a synchronous `fn` makes under a folder; assert an equality or a
  difference with a non-zero side, never a pinned total (the totals differ by platform), and count under the project root, not
  one folder of it (FC2-3's log read again per planned file sits outside `src/`); what the engine does is a count where it
  keeps one — the deprecated uses' watch counts the pages it parses itself, `deprecatedUses.parsed` (not enumerable:
  in-process only, never in a result's JSON), so G1's `asks` asserts that count and the fs calls under the project root, no
  clock — the marked tree's own reads are the follow's config files (package.json, tsconfig), one or two by platform, a
  bound of 2 a kind — and, under every folder that holds what it reads (`src/`, `docs/`, `.specs/`), the SAME calls: a bound
  is a slack, and a slack holds a regression of its size (review 2, DT2-1: a read once a row fit the root's on Windows; what
  the root's bound still holds, review 3: a root file stat'ed once a row anywhere, a root config read once a row on Windows)
  (15-quality-design-system-cost-deprecated.js); `fsCalls` counts a path as the engine spells it, so a call made through the
  realpath of an aliased folder (Windows' 8.3 `ADMINI~1`) is not under it — assert no pinned difference that depends on one
  (1.41's are counts: spec_metrics' one walk — each `.state.json` and decisions.md opened once, a twin without lessons making
  the same calls —, finish's metric lookup — one more open per other folder, none without a reading —, Reference Examples'
  lstats per row, the friction verdict's bytes read, `read`). It times only what has no count (1.41: the METRIC reader's CPU
  walk, a ratio against a bare `lastIndexOf` of the same text), and its
  comment says what the bound hides (FC2-3's 2.5× backstop passes a 2× quadratic over the planned set that makes no fs call);
  (2) does **the same work on both sides** (1.39's G1 yardstick skipped the watch's parse: 1.02× Windows, 1.7–1.8× Linux);
  (3) **interleaves the sides** — a, b, a, b, …, each side's median of 5 (`pair`, 15-quality-design-system-cost.js) —, never a
  block of one side, then the other; (4) has **one ratio per `remeasure`** (a bundle misses whenever any one of its ratios meets a
  spike); (5) gives **each side ≥ ~100 ms in a Linux container** — repeat the call inside one interval (FC2-3's four calls a
  side) — or counts (a ~40 ms median wanders ±40 % with one GC pause); (6) adds **no absolute slack that can hide the
  mechanism** (`+ 1 s` beside a 2 s stall hides it once the twin takes 2 s); (7) puts **every timing assertion under
  `remeasure`** — a check of child processes runs them with `spawnSync`, so a retry can measure again; (8) is measured
  **before review** on Windows, node:22-bookworm-slim and node:24-alpine, alone and with the MCP suite running beside it at the
  default `--jobs` (the pre-push's setting), its numbers in its comment. **A mutation pass over a cost guard (1.42):** a mutant
  that only the chain timeout catches — a reader the 1.17 H block (05-markdown-trace.js, 100,000-line inputs) guards made
  quadratic — is a kill: run its file with `DEV_SPEC_TEST_CHAIN_TIMEOUT_S=180` and a timeout fails it in minutes, not 30.
- **The source guards follow the layout:** the U+FEFF guard reads mcp/test.js, scripts/test-runner.js and every file of
  mcp/tests/. The engine guards (U+FEFF, backslash-stripped regex literals) also read scripts/build.js — a bundle's
  registry comes from it — and `libSources()` leaves a user-built `mcp/lib/spec.bundle.js` out (the sources verbatim: it
  would only report every finding twice).
- **The duplication guard (1.27.1)** — mcp/tests/16-conventions-duplication.js reads every source the plugin runs: each `.js`
  under mcp/lib (never a `*.generated.*` file or a built bundle), mcp/server.js, cli/*.js (not its tests), hooks/*.js and
  scripts/*.js — and runs the ENGINE'S duplicate-code detector over them (1.28: `S.duplicateRuns(files, {minLines: 8, code:
  true})`, quality.md → Duplicate-code detector — the one spec_scan {duplicates} runs; no scanner of its own). Each source
  becomes its CODE lines (comments, blank lines, lines of brackets / punctuation alone and import lines dropped, whitespace
  folded, string literals KEPT — two builders that differ in their strings are no duplicate), and a run of **8** consecutive
  code lines found twice (another file, or a place of the same file that doesn't overlap; a window of lines under 12 characters
  on average is noise) FAILS, one line per run with each place (`12 lines · a.js:40-55  b.js:310-327 · <its first line>`). The
  label reports the duplicated share at a window of 6 (the detector's `scanned.duplicated`: 0.2 % at 1.27.1 with its own
  scanner, 0.1 % on the detector). One duplication is allowed, by its pattern and reason in `ALLOW`, read over a run's `code` —
  the module rule's link lists (identifier-list lines: a `let` list and its `__link` twin); an allowance that matches nothing any
  more fails too (drop it). A planted copy of state.js lines must be found. A duplicate it finds is a helper to extract — into the module that owns the concept, linked
  where the other copy was (hooks: hooks/hook-utils.js; engine-free readings both the hooks and the engine need:
  mcp/lib/probe.js) — never a reason to widen `ALLOW`. Self-contained, zero dependencies, ~0.3 s.
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
- **Release counts (1.30):** the suites' totals are stated in two places — CLAUDE.md → Tests ("(N assertions, incl." and
  "`node cli/test-cli.js` adds N") and the current CHANGELOG entry's tests line ("`node mcp/test.js` N assertions, `node
  cli/test-cli.js` N") — and the user-facing docs state none (17-docs.js). They are WRITTEN FROM A RUN, at release, never
  typed: **`npm run release:counts [-- --jobs 4]`** (`scripts/release-counts.js`) runs both suites, reads each one's last line
  (`N passed, M failed` — the runner's `RE_TOTAL`) and rewrites those sentences; a suite with a failure records nothing (exit
  1). `--check` writes nothing and exits 1 when a sentence states another total; `--mcp N --cli M` takes the totals of the full
  run you just made instead of running again; a current entry without its tests line gets the line to paste, `(was …)` read
  from the previous entry (exit 1). Between releases mcp/tests/17-docs.js holds the two records to each other, through the
  script's own patterns (`readCounts()` — `SENTENCES`: one copy), and runs the script on a copy with fake suites. The release
  step: write the CHANGELOG entry (its tests line with any numbers), then `npm run release:counts -- --jobs 4`, then commit.
  The script's own run sets `DEV_SPEC_TEST_RELEASE_COUNTS=1`: under it 17-docs holds only that both records are present (the
  assertion still counts) — the new entry states its numbers before CLAUDE.md does, so their comparison failed the very run
  meant to rewrite them (1.30.0's release, the first one through the script).
- **Linux, locally:** `npm run test:docker` (`scripts/test-docker.js`, zero-dep) runs both suites in
  `node:18-alpine` (the engines floor, musl), `node:22-bookworm-slim`, `node:24-alpine` and `node:26-trixie-slim` (1.30). **The
  matrix:** package.json's engines floor first — kept while `engines` says it (raise the floor, drop its image) —, then the LTS
  lines, ascending, musl and glibc both (Node 20 is end-of-life and no floor: not tested); mcp/tests/16-conventions.js holds
  `DEFAULT_IMAGES` to that shape. A new LTS line (an even major, LTS each October) joins it; one past its end of life leaves it.
  Each image runs:
  `docker run --rm --network none --user 1000:1000 -v <repo>:/repo:ro`, `--init`, the repo READ-ONLY (the suites work
  under `os.tmpdir()`) and copied (without .git) into the container's own file system, where the suite runs — where an
  installed plugin lives: a Docker Desktop bind mount costs tens of ms per file loaded and the engine is ~36 files since
  1.18 (a 50-feature statusline took 9–10 s on the mount, 0.7 s on the copy); `--mounted` runs from the mount to measure a
  slow file system. No network, an unprivileged user (`--root` to opt out). Only the first run needs network — to pull
  and to build a cached derived image `dev-spec-test:<image>` that adds git (`--no-git` skips it; the git-dependent tests
  then skip; `--rebuild` rebuilds it). Options `--image <name>` (repeatable), `--suite mcp|cli`, `--jobs <n>` (the suites'
  own, in each container — a shared machine: `--jobs 4`), `--alias-tmp` (1.42, opt-in: each suite's TMPDIR behind a symlink the
  container makes, `/tmp/alias-tmp` → `/tmp/real-tmp` — every test project's path an alias of its real one on a case-sensitive file
  system, the POSIX twin of Windows' 8.3 temp and of macOS's `/var` → `/private/var`: macOS itself is never run here; the Summary
  marks the rows `(alias tmp)`; it becomes the last image's default only after a clean run of both suites under it). Exit 0 all passed · 1 a
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
  Skill fired is harmless — evals/README.md). The review-seat cases (1.42, `--tag review-seat`: the task reviewer and the
  verifier on one seeded task) are checked offline in the same file — shape, the seeded premise on their overlay files, no
  regex grader matching any of the case's inputs — and ONE of them is built (its package byte for byte §4's commands'
  output); a reply is graded on `last_message`, never the trace, which carries the seat's own reads of those inputs.
- **Tests run on Windows AND Linux** (`npm run test:docker`): a `_Verify:_` a test writes must work under cmd.exe AND
  `/bin/sh` — quote it (`node -e "process.exit(0)"`; the bare `node -e process.exit(0)` is a sh syntax error that cmd.exe
  accepts); don't depend on a case-insensitive file system (assert the Linux counterpart where Windows/macOS fold case)
  or on the text of a V8 error (Node 18 omits a RegExp's flags in its SyntaxError). A test that RUNS PowerShell (1.21.1 —
  cli/tests/09-evidence-done-run.js: `done --run --shell pwsh`, a `pwsh -Command "…"` `_Verify:_` under cmd.exe, `--shell
  powershell`) probes the program first (`<shell> -NoProfile -NonInteractive -Command "exit 0"` → 0) and calls `skip("…",
  "<why>")` without it — the Docker images have no pwsh, and cmd.exe / Windows PowerShell exist only on Windows. The
  POSIX-shell refusal of a double-quoted pwsh script runs everywhere (nothing is run: /bin/sh on Linux, `--shell bash` on
  Windows — skipped without Git Bash), a Pester run is stood in for by a node script printing captured Pester output, and the
  engine-level PowerShell checks (posixShellSyntax, posixPwshScript, resolveRunShell, couldNotRunOutput / pwshParseFailure
  on captured pwsh 7 / 5.1 / Pester 3–6 outputs, every new pattern timed on 200 KB hostile inputs) run everywhere.
  The shell completion scripts (1.25, cli/tests/16-conventions-completion.js) run the same way: bash (Git Bash on Windows,
  `DEV_SPEC_TEST_BASH`), Windows PowerShell / pwsh through TabExpansion2, zsh and fish where installed (`DEV_SPEC_TEST_ZSH`,
  `DEV_SPEC_TEST_FISH` — the Docker images have neither: `apk add zsh fish bash` in a `node:24-alpine` container runs them
  all), each a `skip()` where it isn't.
- **Eval harness** (`run-evals.js`) resolves the feature with the engine's resolver (accents, legacy slugs,
  `${VAR}` guard), prints in the feature's language, and treats a wrong-shaped set as invalid (exit 1). It validates
  EVERY item (`itemProblems()`: object, `id`, `input`, a grader in contains|equals|regex|refuse|judge, a value / a regex
  that compiles with gradeItem's flags / a rubric) and `thresholds.json` (a number in [0, 1] per set) before anything
  runs: a dry run exits 1 naming each bad item, a live run calls no model while any set is invalid.

## History
How the rules above came to be — grep a release here.

- **1.27.1** — the duplication guard (16-conventions-duplication.js): the cleanup took the plugin's duplicated code lines (window
  of 6, mcp/evals and mcp/test.js counted too) from 364 of 39,680 (0.9 %; the hooks 13.2 %) to 72 of 39,435 (0.2 %; the hooks
  0) — 60 of them the two allowed duplications — and the guard keeps new copies out.
- **1.28** — the guard runs the engine's detector (`S.duplicateRuns`) instead of its own scanner: one detector. Its reading
  of a template literal dropped the PT / ES design sample's allowance — the old scanner read the sample's `// …` line (it differs
  per language) as a comment, the detector as the string it is — so the stale allowance went; 56 of 40,697 code lines (0.1 %).
- **1.30 review 8 (ds-engine 11)** — two overlapping in-process `main()` calls (two `ears -` waiting on their stdin) shared the
  process's env and cwd: A's callback ran in B's context, and A ending first left A's env and cwd behind (B restored what it saw
  at its start). Calls are serialized now (`WAITING` in cli/main.js); 16-conventions-cli-modules.js awaits `whenIdle()` instead
  of a fixed 1.5 s.
- **1.29** — hermetic chains also leave out the maintainer's installed plugins (`DEV_GUARDIAN_CLI` dropped, `CLAUDE_CONFIG_DIR` an
  absent folder of the chain's own): with dev-guardian installed, every `init` in the suites would have printed its offer.
- **1.30 (review 8, ds-maint finding 1)** — the hooks had no in-process entry, so the MCP suite's hook tests spawned ~390 hook
  processes (10-guards-guard-downs alone 57: ~24 of its 27 s). Every hook exports `decide()` and the harness's `hookIn` calls it;
  real processes stay where the test is about one. Measured (the ten hook-heavy files, `--jobs 4`, two rounds each on a loaded
  machine, seconds): 10-guards 57 / 47 → 17 / 24, 10-guards-guard-downs 32 / 36 → 16 / 23, 10-guards-shell-writes 14 / 13 → 3 / 6,
  10-guards-hooks 10 / 11 → 3 / 4, 12-lifecycle 57 / 68 → 30 / 41, 05-markdown-trace 61 / 76 → 42 / 54, 16-conventions 50 / 53 →
  31 / 34, 09-evidence 44 / 76 → 33 / 42.
- **1.30** — `mcp/tests/fixtures/`, the first data folder beside the test files (the 1.29 dev-guardian launcher the gate must
  recognize as genuine).
- **1.30 (review 8, ds-maint 6 and 14)** — hermetic chains also drop Node's steering variables (`NODE_OPTIONS`, the compile cache's,
  `NODE_DEBUG`…; `DEV_SPEC_TEST_KEEP_NODE_ENV=1` keeps them): a `--require` preload in `NODE_OPTIONS` reached every chain, server and hook.
  The times file is the checkout's (`dev-spec-test-times-<suite>-<id>.json`) and pruned on each write: it was one per machine,
  merged into by every worktree, and held 29 entries of files 1.27 had renamed.
- **1.30 (review 8, ds-maint 7)** — the test totals in CLAUDE.md and the CHANGELOG were checked against each other only (two equal
  typos passed): `npm run release:counts` writes them from a run (Release counts).
- **1.30 (review 8, ds-maint 15)** — the Docker matrix was 18 / 22 / 24: Node 26 (the maintainer's own, LTS from October 2026)
  was never run; `node:26-trixie-slim` joins, and 16-conventions holds the first image to the engines floor.
- **1.30 (review 9)** — a TMP whose path named dev-spec, or a long one (Windows), failed 8–11 MCP assertions that pass under the
  default TMP: the chains' temp base is chosen neutral now (The temp base), and the approval hook's partial-payload test no longer
  carries the temp path in its "names nothing of dev-spec's" payload.
- **1.30 (review 8, ds-maint 2)** — the critical-path files split by topic: 15-quality's re-checks of the built eval fixtures →
  15-quality-fixtures.js (the MCP chain `17-docs-evals → 15-quality` was ~60 s in one process); 16-conventions-completion.js → -bash /
  -pwsh (one PowerShell process per shell runs the three scripts: four starts of ~2–4 s each before); 09-evidence-done-run.js → -pwsh /
  -verify. A chain requires only its own files; the MCP server starts before the harness's engine. Measured: see the notes of that
  release (median of 3, `--jobs 4`, before / after interleaved).
- **1.30.1** — where the MCP suite's summed time went, measured with two preloads (`NODE_OPTIONS=--require …`,
  `DEV_SPEC_TEST_KEEP_NODE_ENV=1`): one timestamping every assertion line with the test line that made it, one counting the engine's
  `roadmapData` calls per project. The long tail is engine work in-process (~2,200 assertions at ~0.2 s), not spawns (~450 a run);
  its largest single slice was the roadmap refresh after every mutation — a third of the heavy files' time, quadratic in a project
  that scaffolds many features (15 s for one 50-feature project). `handRoadmap()` on the projects whose tests read no ROADMAP.md,
  `cliIn()` for ~27 CLI spawns, the eval fixtures built four at a time (18 s one after the other), 16-conventions-build's
  independent children side by side. Measured (median of 3 interleaved rounds, `--jobs 4`, Windows 11, Node 26, a shared machine;
  1.30.0 → 1.30.1): wall 119.2 → 107.4 s, the files' summed time 446.7 → 401.6 s; an earlier set under a drifting load had the
  pairs at −14 % / +13 % (the 1.30.1 run first, in the heavier window) / −12 %.
- **1.32.1** — the suites run from a local pre-push hook, so a load spike is no longer a rare annoyance: it blocks a push. Two
  checks failed only in a full parallel run and passed alone. 13-imports-scan.js's two budgets take `remeasure()` like the
  suite's other bounds (the one over 300 nested .gitignore files: 11.3 s against its 10, 1.4 s alone). 08-tasks.js's racy-window
  check counted cache hits under the default 3 s window, and two renders ended past it (the stamp then rightly trusted). It now
  freezes `Date.now` for the renders and puts the window's edge halfway between the edited tasks.md's stamp and every other
  file's: exactly the two other rows are served per render (the per-file rule — the old check passed without it), none under a
  window holding every stamp, none with the edge between a project template rewritten with the same bytes and every feature's
  files (the project's rule, untested before), and the default window is over FAT's 2 s. Hermetic chains drop git's repository variables
  (`RE_GIT_ENV`, with git < 2.40's `GIT_INTERNAL_SUPER_PREFIX`: bookworm's git 2.39 lists it): from the hook, `GIT_DIR` reached
  every chain.
- **1.32.2** — the pre-push gate's first real run failed 17-docs.js's A8 check (no tool description runs two sentences
  together): spec_complete_task's description carries the runnable CLI line with the plugin's path, and the gate's temp
  worktree `dev-spec-pre-push.DFT…` read as "h.DFT". The check reads the prose with that quoted path taken out.
- **1.40.0** — the cost-guard method (Adding a test) and `fsCalls`, from an audit of every `remeasure(` (104 sites in 44 files —
  23 absolute bounds, 14 ratios of different work, 8 inverse; six instrumented full suites and two cost-file runs at `--jobs 4`,
  then one Windows run at the default `--jobs` and one per Linux image, after the changes: none of the rewritten checks missed a
  first try on Windows). Counted: FC2-3 (`on − off − planned` = one open under the project root; under `src/` the log read
  again per planned file was blind), the protected-tests cap (opens and stats equal, listings 24 < 33 — `≤` passed a walk listing
  past the cap: 20 = 20 under `test/`), :908's glob target (its `.specs/` calls = the plain target's; its 4× per-call mean, which
  missed both tries on Linux, went) and a feature's report over 400 pages (no call under them). Resampled: K1 / K3 / K4 and
  G1–G3 one interleaved pair a remeasure (K1 blocked crossed 1.5 in 3 of 64 samples, interleaved in none of 64), each hostile UI
  input beside its own plain JSX; under `remeasure`: the 1.17 linear headings (it failed once on alpine, outside any) and the
  read-ahead's refused read (run with `spawnSync`, and its workers' errors counted). FC2-3's yardstick was decided by its base
  samples: four calls a side at ≤ 1.5 crossed 1.5 in 7 of 36 on node 22 (max 1.94) and 3 of 36 on alpine (1.75) with the MCP
  suite running beside — 0 of 36 on Windows (max 1.40) —, so it is a 2.5 backstop that says what it hides (the known set
  rebuilt per own file, no fs call: 1.6–2.2× on node 22, 0.8–1.5× on Windows); one call a side (~40 ms) crossed even 2.5
  (2.76, 1 of 36 alpine). Left as found, their numbers for 1.41: `clickNest` / `clickControl` cost 2–2.6× plain JSX themselves
  and still reach the 3× bound under load (both tries 3.06 / 3.14 once on node 22 with two containers at once; more calls a side
  did not steady them); timing assertions outside `remeasure`; the three
  different-work checks (reexports :434, usage :513, aliases :490), which passed every Linux run (a first try missed on
  node:24-alpine for two of them, the retry held); the read-ahead pool's start against a read in sequence (+600 ms: the start
  took 650–1,330 ms in two containers at once; it held one container at a time). The cost file split by topic (The suites): its two halves took 133 and
  174 s in the default-jobs Windows run — one file, it was the critical path; that run's wall was 317 s, its slowest chains
  15-quality-design-system-usage (209 s) and 10-guards-protected-tests (194 s). The injectable bounds table was cut again (−11 to
  −12 s Windows, −2 to −3 s Linux, off the critical path). G1's `asks`, resampled on 1.39's yardstick (~1.2× typical), still
  missed both tries once on node:24-alpine (1.63 / 1.64 — 1 of 16 probe samples over 1.5, the 1.39 sampling 0 of 16) while
  the property is two counts, so once the merged tree gave the report `deprecatedUses.parsed` it is COUNTED, no clock (the
  owner, after the merges): with settle asking a candidate on 50 pages, the watch parses the 275 Table pages settle did not
  (300 − 25), and every fs call under the pages equals the identical tree's with no marker (600 / 600); a watch parsing every
  page — the case the 1.39 clock saw at 1.05× on Windows — fails both (610, 660). `nothing` keeps its clock (0.67–1.29×
  measured, loaded) and counts its 300. Review 1 (DOC-2, T-1, T-3; the replay's S3): the pages folder hid a re-read outside it
  (the registry, the views, the MDX once a page) — the reads are counted under the project root, the follow's config reads
  the one difference (+1 open, +1 realpath on Windows — package.json's open; tsconfig's goes through the 8.3 TEMP's realpath,
  uncounted —, +2 opens on Linux; bound 2 a kind), and both mutants fail. Review 2 (DT2-1): that bound held a read once a
  row on Windows (one spare open; a stat two spare everywhere) — beside it, every fs call under `src/`, `docs/` and `.specs/`
  is now the same with and without the marker ({} apart on Windows, node 22 and node 24-alpine), which kills the reviewer's
  once-a-row mutants (all six on Windows — a row's file opened, read or stat'ed, the registry read again, a row's first
  importer read again, the tsconfig once a page; the stat and the open checked on node 22 and node 24-alpine too); the feature report's 1.25× clock (40–59 ms
  sides on Linux) is a count — with a row marked as with none it makes the same calls under `src/` and opens no page (the
  project report 642), and a watch built for it fails; DS_PATH_WORDS, a cost guard only timed (1.48–1.55×), is counted — a
  path cell of 33 absent files makes the calls of its first 20 (without the bound 38 lstats against 28).
- **1.41.0** — `mcp/tests/fixtures/metric-lines.v1.json` (F0 of the 1.41.0 / dev-guardian 3.17.0 round): the METRIC line's
  contract — its grammar and the one set of reader bounds, the judge's rule, 36 lines, 5 whole outputs and 21 judge cases —
  written once and committed byte-identical in both repositories, each suite pinning the same sha256. The readers live in two
  languages (dev-spec's CommonJS, dev-guardian's TypeScript) and no hermetic suite can read the other repository, so the pin is
  the only thing that keeps them on one contract. 09-evidence-runs.js holds the file, not a reader: the pin, and the fields
  every case gives one (an absent value is `null`, never a missing key; `new` ⇔ no reference; `unjudged` ⇔ a `why`; a judged
  verdict ⇔ its `applied` tolerance), the cases the decisions name (a TAP line, a non-ASCII name, every kind, verdict and term),
  ASCII with LF ends, no CI / PR word — dev-guardian's test checks the same properties. The expectations were written by hand
  and re-derived by an independent oracle (a second reader of the grammar, BigInt-scaled decimals) before the copy; three
  decimal cases read `regressed` in binary floating point and `within` exactly (120 → 122.4 at 2 %, 0.7 → 0.77 at 0.07,
  0.3 → 0.33 at 10 %).
- **1.42** — a skip was a constant-true `ok(true, "… skipped")`, counted as a pass: 69 sites in 29 test files (plus the runner
  test's own git skip), so a Linux container's total held the PowerShell, zsh / fish and Windows-only checks it never ran, and the
  only skips any summary saw were the two `console.log("  skip - …")` lines test-docker.js counts. The runner owns `skip()` now
  (scripts/test-runner.js: the optional 5th field of a file's `#file` line, the `# K skipped` line before the unchanged last
  line), all 72 sites call it, and 16-conventions.js's guard keeps the old idiom out with no allowance — the fake suite's files
  assert `ok(1, …)`. Each machine's total drops by its own skips.
- **1.42 —** (the tests chain: the suites' honesty) the pre-push hook's fresh temp worktree had no times file of its own, so every
  chain weighed "never timed" and ran in file order (simulated −19 % of an MCP run at 24 jobs once ordered):
  `DEV_SPEC_TEST_TIMES_ROOT`, the parent's own knob (its own predicate beside the host's variables; no chain sees it). The
  checks that timed a count now count: the alias reader's three memos (`aliasStats`, in-process — two of them dropped cost
  nothing the clocks could see), T10's corpus (a 0.35–0.8 ms side carried a ratio; the count bound stays), the read-ahead
  stall (ONE slow take of at least 0.9 × AHEAD_STALL_MS, under twice it — the whole read's `took < 15000` was worker starts
  and contention, and passed a doubled wait). K2 samples two interleaved pairs; capMs and the duplication guard's 5 s sit
  under `remeasure`; done --run's timing rows are containments on one clock. Property nets: R1's four checks that survived
  their removal in the 1.41.1 review and the read-pass sweep over a junction out (12-lifecycle-read-gate-root.js), every
  Object.prototype name a check name's shape admits (09-evidence.js), an upper-case `[X]` reader by reader with a twin over
  every operation's read pass (08-tasks-checkbox-case.js — the read gate's calls exported as `operationCalls`, the same 400
  calls before and after), two milestones sharing a release-notes name (14-exports.js); `--alias-tmp` in test-docker.js,
  opt-in. Cut: a sweep of the runner's litter in the shared temp folder (prose above instead), a time-named source guard (a
  name list), the click-dense yardstick for the UI checks' click inputs (it changes the owner's "3× plain JSX" ruling: to the
  owner), a 10,000 pass of the 1.17 H block (the chain timeout kills its quadratics — the mutation tip above), a slow-take
  count on the read-ahead pair (a load false-fail — a comment instead), the import / hook clocks of 05-markdown-trace (6× and
  ~200× margins), T10's render spy and R1(d)'s CLI row (they kill nothing the other rows do not).
- **1.42 (UX-05, UX-01)** — `mcp/tests/17-docs-shipped-texts.js`: the properties every text the plugin ships must hold, read by
  property, never a list of places — every .md / .mdc but CHANGELOG* and every .js; not what .gitignore ignores, hidden folders
  but the rule files `rules` prints (cli/commands.js `RULE_FILES`), examples/, evals/, the suites' own folders, nor a
  maintainer note's History. The file set is itself checked on a planted tree (a gap list in each place, read only where shipped).
- **1.42 (review seats)** — no plugin eval measured the review loop's two seats, the costliest and most edited prose of
  Phase 6. Seven `review-seat` cases (five task reviews, two verify passes) share one builder (`review_seat <variant>` in
  evals/fixtures/lib.sh); the suite builds ONE of them (the 8th slot of the 4-wide build pool, ≈ 0 s) and checks the six others'
  premises on their overlay files — the design's eight built cases would have cost ≈ +9 s warm / +20–25 s cold per run. A
  `--keep-temp` probe (one paid run) settled the grading: the seat's reply is the `Agent` call's result and the main session
  relays it, while the trace also holds the seat's reads of every input, so the graders read `last_message` and a property keeps
  every regex grader from matching any input. Cut: the dev-guardian pair (no dev-guardian prose changes this round; its
  deterministic half needed another chain's rule) and the long-package final-review case (with S3's protocol).
- **1.42 (fix round 1, tests)** — review 1 of the round. The read-ahead stall row has `took < 15000` back beside the one-slow-take
  count: each bound holds its own part (the count the stall, `took` the ~396 fallback takes after it — a 50 ms wait before each
  passed the count alone at 27 s). The skip guard reads any truthy literal first argument: the word `true` alone let `1` and a
  string through, so the fake suite's files assert `typeof exports === "object"`. The round's own link skips fire on win32 alone
  (rethrown elsewhere), and 14-templates' file-link part is its own `ok()` beside its `skip()`; the older sites are the known
  limits above. R10's Step 0: the ten path comparisons the alias leg broke compare real paths, a gone folder by its nearest
  parent's (the runner's samePath norm alone left a gone alias folder unequal to the physical one, and an 8.3 gone folder against
  its expanded parent made a startsWith negative vacuous on win32); the launcher row records projectPath with fs.realpathSync —
  `.native` expands the 8.3 name the launcher's own cwd keeps, which failed this machine's run. The leg stays opt-in until a clean
  run of both suites under it.
