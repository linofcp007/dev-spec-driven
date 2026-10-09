"use strict";

/**
 * dev-spec-driven — local spec engine (the facade).
 * Zero-dependency. Pure Node core (fs, path, module). No network, no cost.
 *
 * Operates on a project's `.specs/` directory. The MCP server (server.js), the CLI and the hooks require THIS file; the
 * logic lives in mcp/lib/engine/ (one module per concern — the module map and the rule are in engine/index.js). This
 * facade assembles the public object: the same keys as ever, each operation run in ONE read-cache scope (withReadCache)
 * and the mutators under the feature lock (featureLocked). See mcp/test.js for the assertions.
 */

// Node's module compile cache (Node ≥ 22.8; nothing on older ones): every hook and CLI call is a fresh process that
// compiles the engine's modules again — the cache keeps their compiled code between processes (one small file per module
// and Node version, in NODE_COMPILE_CACHE or <os.tmpdir()>/node-compile-cache; NODE_DISABLE_COMPILE_CACHE=1 turns it off).
// A quiet optimization: it never throws; the first process after an update writes the cache (once), a cache that can't
// be written only costs the time it would have saved. Measured and explained in docs/maintainers/architecture.md (The
// module rule — "Few, cohesive files").
try { require("module").enableCompileCache?.(); } catch { /* never a reason to fail */ }
// 1.20 — where the engine loads from. By default its modules (engine/index.js and i18n.js, ~36 files). With DEV_SPEC_BUNDLE=1
// (opt-in, for a slow file system — a Docker Desktop bind mount, a network drive, WSL's /mnt/c — where every file costs
// tens of ms) the same modules from ONE file the user builds (`dev-spec bundle`, never committed): spec.bundle.js here, or
// DEV_SPEC_BUNDLE_PATH (an absolute path to a .js file; anything else is ignored). Only while it is current: its version
// stamp is package.json's and every module it holds still has the size and mtime it was built from — one stat per module,
// no read (a plugin update or an edit since the build). A missing, broken or stale bundle: the modules, silently — hooks
// and the status line print nothing about it. The bundle runs each module's source verbatim (its own __dirname, the same
// load order and __link): no behaviour differs. docs/maintainers/architecture.md → The build.
// 1.24 r6 B-I1: where it loaded from is recorded (ENGINE_SOURCE → the facade's `engineSource`, which `dev-spec version` reports):
// { kind: "modules" | "bundle", requested (DEV_SPEC_BUNDLE on), file (the bundle looked for), skipped: null | "missing" |
// "other-version" | "stale" | "broken", pathIgnored (a DEV_SPEC_BUNDLE_PATH that is no absolute .js path) } — the choice itself
// is unchanged and still silent.
let ENGINE_SOURCE = null;
const { i18n, engine } = loadEngine();
function loadEngine() {
  const requested = /^(?:1|true|yes|on)$/i.test(String(process.env.DEV_SPEC_BUNDLE || "").trim());
  let file = null, skipped = null, pathIgnored = false;
  if (requested) {
    try {
      const fs = require("fs"), path = require("path");
      const given = String(process.env.DEV_SPEC_BUNDLE_PATH || "").trim();
      const usable = path.isAbsolute(given) && /\.js$/i.test(given);
      pathIgnored = given !== "" && !usable;
      file = usable ? given : path.join(__dirname, "spec.bundle.js");
      skipped = fs.existsSync(file) ? "broken" : "missing"; // until the checks below pass
      if (skipped === "broken") {
        const b = require(file);
        const pkg = fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8");
        const version = JSON.parse(pkg.charCodeAt(0) === 0xfeff ? pkg.slice(1) : pkg).version;
        const current = ([rel, size, mtimeMs]) => {
          const st = fs.statSync(path.join(__dirname, ...String(rel).split("/")), { throwIfNoEntry: false });
          return !!st && st.size === size && st.mtimeMs === mtimeMs;
        };
        if (b.stamp.version !== String(version).trim()) skipped = "other-version";
        else if (b.stamp.files.length > 0 && !b.stamp.files.every(current)) skipped = "stale";
        else if (b.stamp.files.length > 0) {
          const req = b.load(__dirname);
          const loaded = { i18n: req("./i18n.js"), engine: req("./engine/index.js") };
          ENGINE_SOURCE = { kind: "bundle", requested, file, skipped: null, pathIgnored };
          return loaded;
        }
      }
    } catch { /* missing, broken or foreign: the modules */ }
  }
  ENGINE_SOURCE = { kind: "modules", requested, file, skipped, pathIgnored };
  return { i18n: require("./i18n.js"), engine: require("./engine/index.js") };
}
const { addTrack, affectsWarnings, appendTasks, APPROVAL_GUARD_LEVELS, approvalGuardDecision, approvalGuardLevel,
  approvalRolesOf, approvePhase, archiveFeature, artifactState, backlog, BACKLOG_ACTIONS, catalog, changelog,
  clarify, classify, CLI_SWITCHES, compareSemver, completeTask, couldNotRunOutput, vacuousRun, coverage, crashExit, createFeature,
  crossFeatureAcs, csvCell, decide, decisionLog, designSaveCheck, detectPhase, detectTracks, drift, earsFeature,
  earsSteps, earsValidate, engineVersion, etaText, evidenceMode, existingFeature, expectsFail, EXPORT_FORMATS,
  exportSpecs, extractSection, featureLang, featureLocked, featureOverlaps, featurePercent,
  featurePlaceholders, finishFeature, FLOWS, forecastData, gateRefusal, globFiles, glossaryEntries, guardCheck,
  guardEnabled, guardLevel, sessionProject, sessionPath, shellWriteTargets, impactLines, impactReport, implementsTargets, importSpec, initProject,
  isDevSpecDir, isFeatureFolder, isNetworkPath, isPlaceholderTask, isTemplatePlaceholder, isTestFile, isWslLauncher, listFeatures,
  manageFeature, markdownToHtml, markRoadmapStale, matrixCsv, maybeRefreshCatalog, mdPlainText, refreshStaleRoadmap, ROADMAP_STALE_FILE, roadmapStale, staleGeneratedText, MERGE_ATTRIBUTE_LINES,
  MERGE_DRIVER, MERGE_DRIVER_KEY, mergeAttributes, mergeDriverScript, mergeDriverStatus, gitConfigGet, mergeKindOfPath, mergeStateJson, mergeStateText, metrics, metricsLines, templatesLines, upgradeLines, milestone,
  MILESTONE_ACTIONS, networkPathInside, nextAction, nextTask, normalizeLang,
  normalizeTracks, OBSERVED_MAX_BYTES, observedRun, observeRun, OPTIONAL_TRACKS, parseApprovalRolesText, runProvesVerify, stripCdPrefix,
  recordSpecEdit, runStartStamp,
  parseGitLog, parseTasks, parseTracks, PHASES, placeholderReport, planBridge, planPaths,
  posixPwshScript, posixShellSyntax, projectChecks, projectLang, pwshParseFailure, runsPwsh, readRoadmap, readState, removeFeature, removeTrack, renameFeature,
  renderRoadmapHtml, renderRoadmapMd, resolveFeature, resolveProjectDir, unexpandedVar, expandHome, resolveRunShell, resolveTask, restoreFeature,
  roadmap, roadmapData, roadmapReport, roadmapTailLines, RTM_STATUSES, scaffoldSteeringFile, scanCodebase, scanTestCode,
  setDependency, SIGNAL_CONCEPTS, SIGNALS, SIZE_POINTS, slugify, specDoctor, specsRoot, specUpgrade, specVersionStatus,
  spikeInfo, statusFeature, statusLine, statusLineProject, steeringFrontMatter, steeringGlobMatch, STEERING_IMPORT_TOOLS,
  STOP_RECENT_HOURS, stopCheck, stopCheckEnabled, stopClaims, stripHtmlComments, summarizeRunOutput,
  supersedesWarnings, taskBlocks, taskBrief, taskCommits, taskDependsSpec, taskMarkers, taskSchedule, taskSize,
  taskWaves, TEMPLATE_ARTIFACTS, templateKey, templates, templateSets, traceCheck, traceGapLines,
  traceGaps, traceMatrix, traceWarningLines, TRACK_MARKER, TRACK_SECTIONS, TRACKERS, trackLabel, trackPacks, FEATURE_SIZES, TRACK_OVERLAPS, TRACK_TASK_OVERLAPS,
  changeViews, closestName, today, dayOf, decodeText, featureBranch, IMPORT_TOOLS,
  userDefaults, VALID_TRACKS, verificationStatus, verifyPipeMasked, commandHasControl, controlVisible, windowsShellFailure, withFeatureLock, withinRoot,
  withReadCache, writeFileAtomic, writeRoadmapHtml, writeRoadmapMd } = engine;

module.exports = {
  CLI_SWITCHES, // the CLI's boolean switches — ONE list (cli/commands.js BOOL_FLAGS, the approval hook's lexer)
  DEV_SPEC: i18n.DEV_SPEC, // 1.21 F3: `node "<clone>/cli/dev-spec.js"` — the runnable CLI line (tool descriptions, messages)
  portableCli: i18n.portableCli, // the runnable line → `dev-spec`, for text meant to be committed
  engineSource: Object.freeze({ ...ENGINE_SOURCE }), // 1.24 r6 B-I1: modules or the bundle, and why a requested bundle was skipped (`dev-spec version`)
  VALID_TRACKS,
  PHASES,
  resolveProjectDir, // --project / projectDir > SPEC_PROJECT_DIR > CLAUDE_PROJECT_DIR > the nearest dev-spec project at or above cwd > cwd
  unexpandedVar, // 1.23 review: a value holding a variable left unexpanded ("${…}", a leading $NAME, %NAME%) — never a folder name
  today, // 1.25.1: the local calendar date (YYYY-MM-DD) of now / of a given moment (engine/core.js)
  dayOf, // 1.25.1: a stored instant's local calendar date, "" when there is none
  expandHome, // 1.25.1 (review 7): a leading ~ / ~/ is the home folder (PowerShell 5.1 and MCP arguments never expand it) — server projectDir
  closestName, // 1.24 r6: the did-you-mean — the candidate nearest a mistyped word (optimal-string-alignment distance), else null
  specsRoot,
  slugify,
  normalizeTracks,
  trackLabel,
  classify,
  initProject,
  scaffoldSteeringFile,
  createFeature: featureLocked(createFeature), // re-run on an EXISTING feature: new tracks via applyTracks (spec_add_track's path), locked like it
  listFeatures,
  statusFeature,
  nextTask,
  completeTask: featureLocked(completeTask), // read-modify-write of tasks.md + .state.json: under the feature lock (withFeatureLock)
  earsValidate,
  earsFeature,
  traceCheck,
  taskBrief: featureLocked(taskBrief, (a) => !!(a[3] && a[3].write)), // write: .execution/ resolved and written under the lock (a move waits)
  taskBlocks,
  taskMarkers, // a task block's English-stable markers ({ requirements, "makes green", …, verify, expect }) — taskMarkerSpans' reading
  decodeText, // a file's bytes as text: a UTF-16 BOM (FF FE / FE FF) decides, else UTF-8 (1.22 review — the hooks, the resources, `ears <file>`)
  stripHtmlComments, // text minus HTML comments as every reader sees it (code spans and fenced code keep their "<!--")
  taskDependsSpec, // 1.14 F3: a task block's _Depends:_ → { declared, numbers, invalid }
  taskSchedule, // 1.14 F3: task blocks → { next, skipped, blocked } — THE next-task rule (dependencies all done)
  taskWaves, // 1.14 F3: task blocks (+ tracks) → { waves: [[numbers…]…], cycles, blocked } — spec_next_task {waves}
  finishFeature: featureLocked(finishFeature, (a) => !!(a[2] && (a[2].write || a[2].evidence != null))), // write: the drift baseline · evidence (B5): finishChecks — both in .state.json
  parseTasks,
  approvePhase: featureLocked(approvePhase),
  readState,
  manageFeature, // remove / archive / rename / restore move or delete the folder under its lock (withMoveLock), then the roadmap lock
  removeFeature,
  archiveFeature,
  renameFeature,
  addTrack: featureLocked(addTrack),
  nextAction,
  specDoctor,
  featurePercent,
  readRoadmap,
  setDependency,
  roadmap,
  backlog,
  BACKLOG_ACTIONS, // the spec_roadmap_edit {kind: "backlog"} `action` enum (rm and its alias remove)
  renderRoadmapMd,
  writeRoadmapMd,
  renderRoadmapHtml,
  writeRoadmapHtml,
  scanCodebase,
  coverage,
  clarify,
  // language resolution (used by the server, CLI and hooks)
  LANGS: i18n.LANGS, // en · pt · es · pt-BR — the MCP `lang` enum and the CLI --lang values
  canonicalLang: i18n.canonicalLang, // strict: a code or alias (pt_BR, pt-pt…) → its canonical code, else null
  normalizeLang,
  projectLang,
  featureLang,
  msg: i18n.msg,

  resolveTask,
  verificationStatus,
  summarizeRunOutput,
  posixShellSyntax, // `done --run` on Windows: POSIX-only syntax cmd.exe would misread (refused unless --shell)
  windowsShellFailure, // `done --run` on Windows: did cmd.exe itself fail (unknown command / its syntax error)? — the --shell hint
  resolveRunShell, // full review Ga9: `done --run` / `finish --run` — the shell (a bare bash → Git Bash on Windows; WSL's launcher refused)
  isWslLauncher,
  vacuousRun, // 1.24 r6 D4: a pass whose output shows no test ran (node --test "tests 0", go "[no tests to run]"…) — done --run refuses it (no-tests)
  couldNotRunOutput, // full review Ga2 / Ga9: a run's output shows it never exercised the check (WSL relay, spawn error, missing test file…)
  crashExit, // 1.23 review: a crash's exit code (128 + SIGILL/ABRT/BUS/FPE/SEGV, a Windows NTSTATUS crash) — a failed run, never a red test
  posixPwshScript, // 1.21.1 review: a pwsh script whose `$…` / backticks a POSIX shell (/bin/sh, bash) would expand first — refused
  pwshParseFailure, // 1.21.1 review: PowerShell's own parse error (the script never ran) — no red test when PowerShell runs the line
  runsPwsh, // does a command line run pwsh / powershell (program position)?

  parseTracks,
  detectTracks,
  detectPhase,
  isPlaceholderTask,
  placeholderReport,
  templateSets,
  isTemplatePlaceholder,
  artifactState,
  extractSection,
  removeTrack: featureLocked(removeTrack),

  existingFeature, // the eval harness resolves its feature like every other operation
  // 1.25.1 (review 7): the write gate for a .specs/ file a script outside the engine owns — the eval harness's evals/baseline.json
  // (it wrote with a raw fs.writeFileSync, through any link under .specs/). → { ok: true, file } | the gate's refusal (the wrapper below).
  writeSpecFile: (file, text) => { writeFileAtomic(file, text); return { ok: true, file }; },

  traceGaps,
  traceGapLines,
  roadmapReport,

  featurePlaceholders, // the gates' placeholder view of one artifact (active part, real line numbers)

  importSpec, // 1.25: + dryRun (the whole pipeline in the write gate's dry-run sink) and the steering tools (kiro-steering · cursor-rules)
  STEERING_IMPORT_TOOLS, // 1.25: the spec_import tools that write .specs/steering/ files, not a feature — their path is optional (server.js, the CLI)
  IMPORT_TOOLS: Object.freeze(Object.keys(IMPORT_TOOLS)), // 1.25: the source formats importSpec reads (spec_import `tool`) — the CLI's completion offers them
  // 1.16 C — Claude Code integration: the status line, the plan-mode bridge, the user's DEV_SPEC_* defaults (fallbacks)
  statusLine,
  statusLineProject,
  isDevSpecDir, // does <dir>/.specs/ belong to dev-spec (mcp/lib/probe.js's rule: roadmap.json, steering/, a generated ROADMAP.md or a feature's .state.json / classification.md)? — the CLI refuses a project's .specs/ named as the project
  isNetworkPath,
  networkPathInside, // 1.16 verify NEW-3: the guard's (and the save hook's) text-only rule for a network path
  planBridge,
  userDefaults,
  isTestFile,
  implementsTargets,

  appendTasks: featureLocked(appendTasks), // spec_append_tasks / `dev-spec append-tasks` (converge)

  impactReport: featureLocked(impactReport, (a) => !!(a[2] && a[2].reopen === true)), // spec_impact / `dev-spec impact` (change requests: diff vs the approved snapshot, --reopen)
  impactLines,
  metrics: featureLocked(metrics, (a) => !!(a[2] && a[2].write === true)), // spec_metrics / `dev-spec metrics` (+ retro.md with write, under the feature lock)
  metricsLines,

  traceWarningLines, // trace_check warnings (EC/NFR/SC, tests in code) as localized lines — CLI, hook, finish
  scanTestCode, // the bounded walk over test files that trace_check {code: true} reads
  withinRoot, // "inside the project root?" that also holds at a drive root (C:\)

  catalog, // spec_export {format: "catalog"} / `dev-spec catalog` (.specs/SPECS.md)
  maybeRefreshCatalog,
  // 1.24 r6 I-I1 — the save hook's deferred ROADMAP.* / SPECS.md refresh (a stamp in .specs/.execution/, refreshed once a turn)
  ROADMAP_STALE_FILE, // "roadmap-stale" — the stamp's name in .specs/.execution/ (the Stop hook and the pre-commit check stat it raw)
  markRoadmapStale, // (projectDir) → true when the stamp is there — hooks/spec-hook.js on a spec save, instead of the refresh
  roadmapStale, // (projectDir) → is the stamp there?
  refreshStaleRoadmap, // (projectDir) → { refreshed } — the refresh, once, when stamped (Stop / SessionStart / pre-commit)
  staleGeneratedText, // (projectDir, "ROADMAP.md" | "SPECS.md") → while stamped, the text the refresh would write (in memory), else null — the specs:// resources
  specUpgrade, // spec_upgrade / `dev-spec upgrade [--apply]` / `/spec-upgrade` (audit + safe migrations, .specs/UPGRADE.md)
  upgradeLines, // 1.26: a specUpgrade() result as the CLI's human report (the result no longer carries its `lines`)
  specVersionStatus, // roadmap.json meta.specVersion vs the engine — the SessionStart upgrade notice
  engineVersion,
  compareSemver,
  supersedesWarnings,
  restoreFeature, // spec_feature restore / `dev-spec feature restore`
  drift, // spec_drift / `dev-spec drift` / SessionStart

  steeringFrontMatter, // scoped steering: Kiro-compatible front matter (inclusion / fileMatchPattern)
  steeringGlobMatch,
  guardEnabled, // guard mode (roadmap.json meta.guard) — hooks/guard-hook.js
  guardCheck,
  sessionProject, // 1.23 review 5: the project a hook reads — the nearest dev-spec .specs/ above its cwd, a worktree mapped to the session's checkout
  sessionPath, // …and a payload path spelled under that project (a file in the worktree's copy)
  shellWriteTargets, // 1.25.1 (review 7): the files a Bash / PowerShell command writes, removes or copies into — the edit guard on the shell
  designSaveCheck, // the PostToolUse design.md save check
  globFiles, // the files an _Implements:_ glob matches in the project (trace_check / drift baseline)
  withFeatureLock, // the cross-process feature lock the mutators hold (tests drive it with a short waitMs)
  resolveFeature, // MCP resources (mcp/lib/prompts-resources.js): a specs://feature/<slug>/… URI resolves like every name-taking op
  isFeatureFolder, // … and lists only the folders listFeatures would (no _archive, dot folders, steering/)

  OPTIONAL_TRACKS,
  TRACK_MARKER: Object.freeze({ ...TRACK_MARKER }), // the stable [Marker] of each marker track
  // A track's mandatory design sections ([{ name, syn }] — saas / ai / sec / privacy; undefined for core / tdd).
  trackSections: (tr) => (Object.prototype.hasOwnProperty.call(TRACK_SECTIONS, tr) ? TRACK_SECTIONS[tr].map((s) => ({ name: s.name, syn: s.syn.slice(), ...(s.tier ? { tier: s.tier } : {}) })) : undefined),
  // A track's classifier keywords (copies — the engine's tables stay private): { strong, weak }.
  trackSignals: (tr) => (Object.prototype.hasOwnProperty.call(SIGNALS, tr) ? { strong: SIGNALS[tr].strong.slice(), weak: SIGNALS[tr].weak.slice(), generic: (SIGNALS[tr].generic || []).slice(), context: (SIGNALS[tr].context || []).slice() } : undefined),
  signalConcept: (tr, kw) => (Object.prototype.hasOwnProperty.call(SIGNAL_CONCEPTS, tr) ? SIGNAL_CONCEPTS[tr].get(kw) || null : null), // 1.17 D review

  verifyPipeMasked, // a _Verify:_ command that pipes into another one (its exit code is the LAST command's) — `done --run`'s hint
  commandHasControl, // 1.25.1 (review 7): a command holding a control character (ESC, a lone CR…) — done --run / finish --run refuse it
  controlVisible, // …and that command with its control characters as escapes, for the message

  templates, // spec_templates / `dev-spec templates [list|init|check]` — the project's own scaffolds in .specs/templates/
  templatesLines, // 1.26: a templates() result as the CLI's human report (the result no longer carries its `lines`)
  templateKey, // "requirements.md" / "steering/tech" → the template key, or null (the allowlist)
  TEMPLATE_ARTIFACTS,
  trackPacks, // 1.15 — spec_tracks / `dev-spec tracks [list|init <name>|check]`: the project's track packs (.specs/tracks/<name>/)

  exportSpecs, // spec_export / `dev-spec export` — the stakeholder document (.specs/exports/, offline HTML or markdown)
  changelog, // spec_export {format: "changelog"} / `dev-spec changelog` — release notes from the specs (.specs/RELEASE-NOTES.md + meta.changelogAt)
  markdownToHtml, // the export's zero-dep markdown renderer (every text escaped; links http(s)/mailto only; no images)
  traceMatrix, // 1.14 F5 — the requirements traceability matrix of a feature (trace_check {matrix} / `dev-spec trace --matrix`)
  matrixCsv, // traceMatrix results → RFC 4180 CSV (`trace --csv`; opts.document: + BOM and the AUTO-GENERATED record — spec_export csv)
  csvCell, // one CSV field: quoted when it must be, a leading = + - @ / tab / CR neutralized with an apostrophe
  RTM_STATUSES, // the matrix's row status codes, best first
  earsSteps, // 1.16 E1 — one EARS criterion → its Gherkin steps [{kind: given|when|then, text}] + split (false: one Then, the whole text)
  mdPlainText, // 1.17 verification N3 — markdown inline text → the plain text a reader sees (escapes / entities, outside code spans)
  EXPORT_FORMATS: Object.freeze(EXPORT_FORMATS.slice()), // the spec_export `format` enum (server.js reads it from here)
  TRACKERS: Object.freeze(TRACKERS.slice()), // 1.16 E2 — the tracker CSV formats (export --tracker)
  milestone, // 1.16 E3 — spec_roadmap_edit {kind: "milestone"} / `dev-spec milestone [add|rm|list]` (roadmap.json meta.milestones)
  MILESTONE_ACTIONS, // the spec_roadmap_edit {kind: "milestone"} `action` enum (rm and its alias remove)

  approvalRolesOf, // roadmap.json meta.approvalRoles, sanitized ({} = single approvals) — team governance (approvals by role)
  parseApprovalRolesText, // `init --roles requirements=product,design=tech+security` → the object spec_init {approvalRoles} takes

  roadmapData, // the ROADMAP.* computation (+ opts.now for the forecasts)
  forecastData, // velocity + per-feature ETA (roadmap() features; opts.now fixes "today")
  featureOverlaps, // cross-feature file overlap pairs (roadmap attention, doctor, SessionStart)
  crossFeatureAcs, // 1.16 Q2: near-duplicate / conflicting acceptance criteria across the active features ({only}: one feature's pairs)
  glossaryEntries, // 1.16 Q3: .specs/steering/glossary.md → { file, entries: [{ term, definition, avoid }] } | null (takes the .specs root)
  taskSize, // a task block's _Size:_ (XS|S|M|L|XL) or null
  SIZE_POINTS, // XS=1 S=2 M=3 L=5 XL=8
  etaText, // "2026-10-05 (10-03…10-08)" for a forecast (CLI: cli=true)
  roadmapTailLines, // `dev-spec roadmap`'s velocity / ETA-rule / overlap lines

  expectsFail, // _Expect: fail_ on a task block (spec_task_brief reports it as `expect: "fail"`, which `done --run` reads)
  projectChecks, // roadmap.json meta.checks → {checks: [{name, command}], invalid} — `finish --run` runs them
  parseGitLog, // `git log` text (medium --name-only/--name-status, or --oneline) → commits
  taskCommits, // `dev-spec log <feature>`: the commits citing each task + the +tdd red-first check, from git log TEXT (never runs git)

  stopCheck, // the end-of-turn evidence gate — hooks/stop-hook.js (Stop / SubagentStop) and `dev-spec stop-check`
  stopClaims, // does a message claim the work is done / verified? (EN / PT / ES, conservative) → { claim, admitted, claims }
  stopCheckEnabled, // roadmap.json meta.stopCheck (on unless false)
  recordSpecEdit, // 1.22 review: (projectDir, feature) — stamp .state.json lastEditAt (a tasks.md / change.md saved by hand; the PostToolUse spec-hook) under the feature lock
  guardLevel, // roadmap.json meta.guard → false | true | "scope"
  approvalGuardDecision, // 1.14 F2: the human approval guard's decision for one PreToolUse payload (hooks/approval-hook.js) — pure
  approvalGuardLevel, // roadmap.json meta.approvalGuard → "off" | "ask" | "deny"
  APPROVAL_GUARD_LEVELS: Object.freeze(APPROVAL_GUARD_LEVELS.slice()), // in order, a later one stricter
  STOP_RECENT_HOURS, // the gate's "recently active" window, in hours

  decide: featureLocked(decide), // spec_decide / `dev-spec decide` — append a D-n entry to decisions.md (under the feature lock)
  decisionLog, // decisions.md text → its entries [{ id, n, title, kind, date, at, affects, supersedes, context, decision, consequences, line }]
  affectsWarnings, // trace_check's phantom _Affects:_ references as localized lines (CLI)
  spikeInfo, // a spike folder → { questionFilled, decisionFilled, outcome, question, rationale, timebox, timeboxPassed }

  FLOWS: Object.freeze(FLOWS.slice()), // the phase orders spec_create {flow} / spec_feature {action: "flow"} take (requirements-first = the default)
  planPaths, // the file paths a plan step names (spec_import plan → _Implements:_)

  // 1.14 F1 — harness-observed evidence
  observeRun, // hooks/observe-hook.js: log a Bash run of a _Verify:_ / project-check command (.specs/<f>/.execution/observed.jsonl, .specs/.execution/observed.jsonl)
  observedRun, // was this reported run observed? (latest observed run of the same command, same exit code, recent) → { observed, at? }
  runProvesVerify, // 1.22 review: is a run {command, observed?} a run of one of these _Verify:_ / check commands? (else command-mismatch / changed)
  stripCdPrefix, // 1.22 review: `cd <dir> && cmd` → cmd when <dir> is one of the given project roots — the observe hook's log and observedRun alike
  evidenceMode, // roadmap.json meta.evidence → "reported" (default) | "observed"
  OBSERVED_MAX_BYTES, // the log's size bound
  runStartStamp, // 1.22 review: (projectDir, feature) → { ok, at, code } — the stamps `finish --run` takes BEFORE its checks run

  // 1.21 F1a — git's merge driver for the spec state (`dev-spec merge-state %O %A %B %P`, installed by `merge-state --install`)
  mergeStateJson, // (base, ours, theirs, kind) → { kind, merged, conflicts } — the semantic 3-way merge of a .state.json / roadmap.json (pure)
  mergeStateText, // the driver's job on the three file texts → { ok, kind, clean, conflicts, text } (conflicts written INTO the JSON: mergeConflicts)
  mergeKindOfPath, // git's %P → "state" | "roadmap" | "generated" (ROADMAP.md / .html, SPECS.md) | null
  mergeAttributes, // (.gitattributes text, remove) → { text, changed, lines } — the driver's lines added / removed (pure)
  MERGE_DRIVER, // "dev-spec-state" — the git config merge.<driver>.* name
  MERGE_ATTRIBUTE_LINES, // the .gitattributes lines --install writes
  // 1.21 review A3 — is the installed driver still THIS clone's? (a plugin update moves the plugin folder; git then drops theirs)
  mergeDriverStatus, // (projectDir, {driver?, cli?}) → { status: ok | none | not-installed | other | missing, named, attributes, driver, script, cli } (read only)
  mergeDriverScript, // the driver command → the script it runs (the word before `merge-state`), or null (pure)
  gitConfigGet, // (git config file text, "section.sub.key") → the value as git reads it (pure)
  MERGE_DRIVER_KEY, // "merge.dev-spec-state.driver"

  // 1.21 F5 — right-sized rigor (data: the sizes; the sections / tasks two tracks both scaffold — the tiers are TRACK_SECTIONS' own)
  FEATURE_SIZES, // ["xs", "s", "m", "l"] — spec_create {size}
  TRACK_OVERLAPS, // [{drop: [track, section], by: [[track, section]…]}]
  TRACK_TASK_OVERLAPS, // [{drop: [track, position], by: track}]
  changeViews, // (change.md text) → { criteria, tasks }: its criteria without the task blocks / the task blocks alone, line for line (1.21 review C1)

  // 1.25 — a feature's own git branch (spec_create {branch} / `create --branch`; createFeature's opts.git: what git said, CLI only)
  featureBranch, // (projectDir, name) → { name, base, commit, at, current, exists } | null — `log` reads the base commit from it
};

// Every engine entry point is ONE call with ONE read-cache scope (withReadCache): an MCP tool call, a CLI command, a
// hook step. Inside it each file is read once however many helpers ask (a mutation's gate, its writes and the roadmap /
// catalog refresh after it); the engine's writers keep the cache true (forgetCached / invalidateReadCache) and it is
// dropped when the call returns — never shared between calls. A caller that makes several calls as one step (a hook)
// can wrap them in withReadCache itself.
// 1.24 r6 — a write the engine's write gate refused (a link under .specs/, a path of the wrong kind: engine/files.js
// specsWriteGate) is that call's ANSWER, never an exception: { ok: false, linked | wrongKind: true, path, error } (localized), on
// every surface alike (MCP isError, CLI exit 1). Any other exception is thrown as before.
for (const [name, fn] of Object.entries(module.exports)) {
  if (typeof fn !== "function" || name === "msg") continue;
  const call = function () {
    try {
      return withReadCache(() => fn.apply(this, arguments));
    } catch (e) {
      const refused = gateRefusal(e);
      if (refused) return refused;
      throw e;
    }
  };
  Object.defineProperty(call, "name", { value: fn.name || name });
  module.exports[name] = call;
}
module.exports.withReadCache = withReadCache;
