"use strict";
// Lifecycle — the read gate below .specs/ (1.41.1): nothing READ through a link (it reads as absent, feature-linked, doctor specs-links), every operation under an fs tracer, where absence relaxes a guard; project files by real path (protected tests, the tests gate, the importers).
// (12-lifecycle-write-gate.js holds the write side — the 1.24 refusals this file keeps unchanged.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, eq, S, tmp, hookIn, fsCalls, require, __dirname }) => {
  const js = JSON.stringify;
  const E = require("./lib/engine/index.js");
  const { OPERATIONS } = require("./lib/operations.js");
  const R = require("./lib/prompts-resources.js");
  const HOOKS = path.join(__dirname, "..", "hooks");
  const WIN = process.platform === "win32";
  const fold = (s) => (WIN || process.platform === "darwin" ? String(s).toLowerCase() : String(s));
  // a folder link: a junction on Windows (no privilege needed), a symlink elsewhere (the type is ignored there)
  const link = (target, at) => { try { fs.symlinkSync(target, at, "junction"); return true; } catch { return false; } };
  const fileLink = (target, at) => { try { fs.symlinkSync(target, at, "file"); return true; } catch { return false; } };
  const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  const OUT = "OUTSIDE-"; // every text behind a link carries it
  const has = (v) => js(v === undefined ? null : v).includes(OUT);
  const now = new Date().toISOString();
  // Every file under a folder (never through a link) holding OUT — what nothing may copy into the project.
  const leaked = (dir) => {
    const bad = [];
    const walk = (d) => {
      let ents = [];
      try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        const p = path.join(d, e.name);
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) walk(p);
        else if (e.isFile()) { try { if (fs.readFileSync(p, "utf8").includes(OUT)) bad.push(path.relative(dir, p)); } catch { /* busy */ } }
      }
    };
    walk(dir);
    return bad;
  };
  // A folder's files as size + mtime (never through a link): what a call must leave as it was.
  const snap = (dir) => {
    const out = [];
    const walk = (d, rel) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const p = path.join(d, e.name);
        const st = fs.lstatSync(p);
        if (st.isDirectory()) walk(p, rel + e.name + "/");
        else out.push(rel + e.name + ":" + st.size + ":" + st.mtimeMs);
      }
    };
    walk(dir, "");
    return out.join("\n");
  };

  // THE maze: a project whose every way OUT is a link below .specs/ — a linked feature folder (lnk), a linked steering/, a linked
  // _archive/ (a planted feature), and in plain features file links: plaina's tasks.md / decisions.md / test-plan.md /
  // .execution/observed.jsonl / task-1-report.md and tests/ext/, plainb's requirements.md and .state.json; .specs/.gitignore.
  const maze = (name, lang = "en") => {
    const base = path.join(tmp, "proj-rg-" + name);
    const p = path.join(base, "proj"), out = path.join(base, "outside");
    fs.mkdirSync(p, { recursive: true });
    S.initProject(p, ["tdd"], lang);
    put(path.join(out, "feat", "requirements.md"), "# Feature: OUTSIDE-REQ\n\n## Summary\nOUTSIDE-SUMMARY\n\n### US-1 OUTSIDE-STORY (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN OUTSIDE-AC happens THE SYSTEM SHALL do OUTSIDE-AC-THEN\n");
    put(path.join(out, "feat", "tasks.md"), "# Tasks\n\n- [x] 1. [US1] OUTSIDE-TASK-ONE for US-1.AC-1\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -v_\n\n- [ ] 2. [US1] OUTSIDE-TASK-TWO\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/outside-impl.js_\n  - _Verify: node -v_\n");
    put(path.join(out, "feat", "test-plan.md"), "# Test Plan: OUTSIDE-PLAN\n\n## Traceability Matrix\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n| T-01 | unit | example | OUTSIDE-T01 | US-1.AC-1 | `tests/ext/a.test.js` |\n");
    put(path.join(out, "feat", "decisions.md"), "# Decisions: OUTSIDE-DECTITLE\n\n## D-1 — OUTSIDE-DEC-TITLE\n\n- _Kind: lesson_\n- _Cause: model-error_\n\n**Lesson:** OUTSIDE-LESSON\n");
    put(path.join(out, "feat", ".state.json"), js({ approvals: { requirements: { at: now, by: "OUTSIDE-BY" } }, lastTickAt: now, ticks: { 1: now } }));
    put(path.join(out, "feat", "tests", "b.test.js"), "// T-01 US-1.AC-1 OUTSIDE-FTEST\n");
    put(path.join(out, "steer", "api.md"), "---\ninclusion: always\n---\n\n# OUTSIDE-STEER rules\n\nOUTSIDE-STEER-BODY\n");
    put(path.join(out, "steer", "tech.md"), "# Tech OUTSIDE-TECH\n\n_Budget: unit 1s_\n");
    put(path.join(out, "arch", "planted", "requirements.md"), "# Feature: OUTSIDE-ARCH\n");
    put(path.join(out, "arch", "planted", ".state.json"), js({ archived: { at: now }, lang: "en" }));
    put(path.join(out, "tests", "a.test.js"), "// T-01 US-1.AC-1 OUTSIDE-TEST\n");
    put(path.join(out, "files", "obs.jsonl"), js({ command: "node -v", exitCode: 0, at: now, tool: "Bash", note: "OUTSIDE-OBS" }) + "\n");
    put(path.join(out, "files", "report.md"), "# Task 1 OUTSIDE-REPORT\n`node -v` → exit 0\n");
    put(path.join(out, "files", "gitignore"), "OUTSIDE-GI\n");
    const a = S.createFeature(p, { name: "plaina", tracks: ["tdd"] });
    const b = S.createFeature(p, { name: "plainb", tracks: ["tdd"] });
    const root = path.join(p, ".specs");
    const links = { lnk: link(path.join(out, "feat"), path.join(root, "lnk")) };
    fs.rmSync(path.join(root, "steering"), { recursive: true, force: true });
    links.steering = link(path.join(out, "steer"), path.join(root, "steering"));
    links.archive = link(path.join(out, "arch"), path.join(root, "_archive"));
    fs.mkdirSync(path.join(a.dir, "tests"), { recursive: true });
    links.tests = link(path.join(out, "tests"), path.join(a.dir, "tests", "ext"));
    const swap = (target, at) => { try { fs.rmSync(at, { force: true }); } catch { /* none */ } fs.mkdirSync(path.dirname(at), { recursive: true }); return fileLink(target, at); };
    links.files = swap(path.join(out, "feat", "tasks.md"), path.join(a.dir, "tasks.md")) &&
      swap(path.join(out, "feat", "decisions.md"), path.join(a.dir, "decisions.md")) &&
      swap(path.join(out, "feat", "test-plan.md"), path.join(a.dir, "test-plan.md")) &&
      swap(path.join(out, "files", "obs.jsonl"), path.join(a.dir, ".execution", "observed.jsonl")) &&
      swap(path.join(out, "files", "report.md"), path.join(a.dir, ".execution", "task-1-report.md")) &&
      swap(path.join(out, "feat", "requirements.md"), path.join(b.dir, "requirements.md")) &&
      swap(path.join(out, "feat", ".state.json"), path.join(b.dir, ".state.json")) &&
      swap(path.join(out, "files", "gitignore"), path.join(root, ".gitignore"));
    return { p, out, base, root, a: a.dir, b: b.dir, links, folders: links.lnk && links.steering && links.archive && links.tests };
  };

  // An fs tracer: every fs.*Sync call made by fn whose path lies in the project and whose REAL location (the nearest existing
  // ancestor's real path) is inside `outside` — a read, a stat, a listing, an existence probe or a write through a link. lstat / readlink
  // / unlink of a link itself are judged by its folder; realpath is the gates' own reading (never content). `exempt`: the frames
  // allowed to (the engine-free 1-bit pre-filters and the project rule — DESIGN §1-E).
  const NOFOLLOW = new Set(["lstatSync", "readlinkSync", "unlinkSync", "lutimesSync", "symlinkSync", "rmSync", "rmdirSync"]);
  const EXEMPT = /\b(?:isDevSpecProject|recentActivity|mentioned|readTasksText|refreshStale)\b/;
  const traced = (projectDir, outside, fn) => {
    const rp = fs.realpathSync.native;
    const proj = fold(path.resolve(projectDir));
    const outReal = fold(rp(outside));
    const realLoose = (q) => {
      let cur = path.resolve(q);
      const rest = [];
      for (let i = 0; i < 64; i++) {
        try { return path.join(rp(cur), ...rest); } catch { /* up */ }
        const up = path.dirname(cur);
        if (up === cur) return null;
        rest.unshift(path.basename(cur));
        cur = up;
      }
      return null;
    };
    const bad = [];
    const saved = [];
    let inside = false;
    const spy = (orig, name) => function (q, ...rest) {
      if (!inside && typeof q === "string") {
        inside = true;
        try {
          const abs = path.resolve(q);
          if (fold(abs).startsWith(proj)) {
            const excl = (name === "writeFileSync" && rest[1] && /x/.test(String(rest[1].flag || ""))) || (name === "openSync" && /x/.test(String(rest[0] || "")));
            const real = NOFOLLOW.has(name) || excl ? realLoose(path.dirname(abs)) : realLoose(abs);
            if (real && fold(real).startsWith(outReal)) {
              const stack = new Error().stack;
              if (!EXEMPT.test(stack)) bad.push(name + " " + path.relative(projectDir, abs) + " ← " + (stack.split("\n").slice(2, 5).map((l) => l.trim().replace(/^at /, "").replace(/ \(.*[\\/]/, " (")).join(" < ")));
            }
          }
        } finally { inside = false; }
      }
      return orig.call(this, q, ...rest);
    };
    const ahead = process.env.DEV_SPEC_TEST_AHEAD;
    try {
      for (const key of Object.keys(fs)) {
        const orig = fs[key];
        if (!/Sync$/.test(key) || typeof orig !== "function" || key === "realpathSync") continue;
        saved.push([key, orig]);
        fs[key] = spy(orig, key);
      }
      process.env.DEV_SPEC_TEST_AHEAD = "off";
      return { value: fn(), bad };
    } finally {
      for (const [key, orig] of saved) fs[key] = orig;
      if (ahead === undefined) delete process.env.DEV_SPEC_TEST_AHEAD; else process.env.DEV_SPEC_TEST_AHEAD = ahead;
    }
  };

  const M = maze("main");
  if (!M.folders) ok(true, "1.41.1 read gate: folder links not creatable here — skipped");
  else {
    const fl = M.links.files; // file symlinks (Windows: admin / Developer Mode — else skipped; Linux: always)
    const before = snap(M.out);

    // (a) the triage probes as assertions — nothing behind a link reaches a result
    {
      const calls = {
        nextA: () => S.nextTask(M.p, "plaina"), statusA: () => S.statusFeature(M.p, "plaina"), briefA: () => S.taskBrief(M.p, "plaina", 1, { includeBrief: true }),
        briefB: () => S.taskBrief(M.p, "plainb", 1, { includeBrief: true }), traceB: () => S.traceCheck(M.p, "plainb", { code: true }),
        traceA: () => S.traceCheck(M.p, "plaina", { code: true }), doctorA: () => S.specDoctor(M.p, "plaina"), catalog: () => S.catalog(M.p, {}),
        adr: () => S.exportSpecs(M.p, { format: "adr", name: "plaina" }), finishA: () => S.finishFeature(M.p, "plaina", {}),
        metricsA: () => S.metrics(M.p, "plaina", {}), roadmap: () => S.roadmapReport(M.p, {}), list: () => S.listFeatures(M.p),
        statusLine: () => S.statusLine(M.p, {}), statusLnk: () => S.statusFeature(M.p, "lnk"), traceLnk: () => S.traceCheck(M.p, "lnk", { code: true }),
        exportLnk: () => S.exportSpecs(M.p, { name: "lnk", format: "md" }), finishLnk: () => S.finishFeature(M.p, "lnk", {}), coverage: () => S.coverage(M.p),
      };
      const res = Object.fromEntries(Object.entries(calls).map(([k, f]) => [k, f()]));
      const leaks = Object.entries(res).filter(([, r]) => has(r)).map(([k, r]) => k + ": " + js(r).slice(Math.max(0, js(r).indexOf(OUT) - 80), js(r).indexOf(OUT) + 40));
      all("1.41.1 read gate (R2): next_task, status, the brief (steering, ACs), trace {code}, doctor, the catalog, the ADR export, finish, metrics, the roadmap, the list, the status line, coverage — and every reader of a linked feature folder — carry nothing behind a link below .specs/ (got " + js(leaks) + ")", {
        noLeak: () => !leaks.length,
        lnkRefused: () => ["statusLnk", "traceLnk", "finishLnk"].every((k) => res[k].ok === false && res[k].code === "feature-linked"),
        steeringNotQuoted: () => !/OUTSIDE-STEER/.test(js(res.briefA)),
        testsNotScanned: () => !js(res.traceA).includes("ext/a.test.js"),
      });
      // the same through the MCP-only surface: the specs:// resources
      const lr = R.listResources(M.p);
      const rr = ["specs://feature/lnk/tasks.md", "specs://steering/api.md", "specs://feature/plaina/tasks.md"].map((u) => R.readResource(M.p, u));
      ok(!has(lr) && rr.every((r) => !has(r) && r.ok === false), "1.41.1 read gate: the specs:// resources list and read nothing behind a link (got " + js(rr.map((r) => r.reason || r.ok)) + ")");
    }

    // (b) THE property: every operation of the table, driven with each feature name (the plain ones, the linked folder, the planted
    // archive) in a read pass and a write pass, under the tracer — no fs call through a link below .specs/, no OUT text in any result.
    {
      const NAMES = ["plaina", "plainb", "plainc", "lnk", "planted"];
      const EV = { command: "node -v", exitCode: 0, summary: "ok" };
      const GENERIC = (w, nm) => ({ name: nm, number: 1, write: w, includeBody: true, includeBrief: true, code: true, matrix: true, batch: true, waves: true,
        max: 3, evidence: w ? EV : undefined, reason: "r", phase: "requirements", by: "t", force: w, lang: "en", explain: true,
        text: "WHEN a user saves an item THE SYSTEM SHALL store it", description: "users save items", track: "sec", dependsOn: ["plainb"],
        tasks: [{ text: "More", requirements: ["US-1.AC-1"] }], heading: undefined, gitLog: "", since: "all", apply: w, reopen: w, cap: 100,
        minLines: 8, tests: true, title: "t", decision: "d", message: "All tasks are done and verified.", agent: "" });
      // the arguments an operation REQUIRES beyond the generic pack (a mode, an action); every operation must have been driven
      const OWN = {
        init: () => [{ tracks: ["tdd"], lang: "en" }], classify: () => [{}], create: (w) => (w ? [{ name: "fresh-one", tracks: ["tdd"] }, {}] : [{}]),
        steering: () => [{ file: "custom-one.md" }], backlog: () => [{ action: "list" }], milestone: () => [{ action: "list" }],
        feature: (w, nm) => (w && (nm === "lnk" || nm === "planted") ? [{ action: "archive" }, { action: "rename", newName: nm + "-two" }, { action: "restore" }, { action: "remove" }, { action: "remove", confirm: true }]
          : [{ action: "remove" }, { action: "flow", flow: "design-first" }, { action: "protect", file: "tests/ext/a.test.js", accept: true, reason: "r", dryRun: true },
            { action: "unprotect", file: "tests/ext/a.test.js", reason: "r", dryRun: true }]),
        import: (w) => [{ tool: "plan", text: "# Plan: OK\n\n## Steps\n1. do `src/a.js`\n", dryRun: !w }],
        templates: () => [{ action: "list" }], tracks: () => [{ action: "list" }], signals: () => [{ op: "list" }],
        export: () => [{ format: "md" }, { format: "html" }, { format: "adr" }, { format: "csv" }, { format: "gherkin" }], changelog: () => [{ since: "all" }],
        "stop-check": () => [{}, { agent: "dev-spec-driven:spec-implementer", message: "**Status:** DONE\nReport: .specs/plaina/.execution/task-1-report.md" }],
        approve: (w) => [{ phase: "requirements" }, ...(w ? [{ through: "tasks", reason: "r" }] : [])],
      };
      const P = maze("prop");
      const pc = S.createFeature(P.p, { name: "plainc", tracks: ["tdd"] });
      fs.writeFileSync(path.join(pc.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Do it for US-1.AC-1\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/c.js_\n  - _Verify: node -v_\n");
      if (P.links.files) { fs.mkdirSync(path.join(pc.dir, ".execution"), { recursive: true }); fileLink(path.join(P.out, "files", "obs.jsonl"), path.join(pc.dir, ".execution", "observed.jsonl")); }
      put(path.join(P.out, "exec", "observed.jsonl"), js({ command: "node -v", exitCode: 0, at: now, tool: "Bash", note: "OUTSIDE-PEXEC" }) + "\n");
      put(path.join(P.out, "exec", "roadmap-stale"), "");
      fs.rmSync(path.join(P.root, ".execution"), { recursive: true, force: true });
      link(path.join(P.out, "exec"), path.join(P.root, ".execution"));
      const beforeP = snap(P.out);
      const driven = new Set();
      const bad = [], leaks = [];
      const order = OPERATIONS.filter((o) => o.id !== "feature").concat(OPERATIONS.filter((o) => o.id === "feature")); // the folder moves last
      for (const w of [false, true]) {
        for (const op of order) {
          const keys = Object.keys(op.args || {});
          const names = keys.includes("name") ? NAMES : [undefined];
          for (const nm of names) {
            for (const extra of (OWN[op.id] ? OWN[op.id](w, nm) : [{}])) {
              const o = {};
              const g = GENERIC(w, nm);
              for (const k of keys) if (g[k] !== undefined) o[k] = g[k];
              Object.assign(o, extra);
              let r;
              const t = traced(P.p, P.out, () => { try { return op.call(S, P.p, o); } catch (e) { return { threw: e.message }; } });
              r = t.value;
              driven.add(op.id);
              for (const b of t.bad) bad.push(op.id + "(" + (nm || "") + (w ? ",w" : "") + "): " + b);
              if (has(r)) leaks.push(op.id + "(" + (nm || "") + (w ? ",w" : "") + ")");
            }
          }
        }
      }
      // the hooks' decisions on the maze (the engine-free pre-filters exempted by name: EXEMPT)
      const hook = (file, payload) => traced(P.p, P.out, () => hookIn(path.join(HOOKS, file), { input: js(payload), cwd: P.p, env: { ...process.env, CLAUDE_PROJECT_DIR: P.p } }));
      const hooks = [
        hook("spec-hook.js", { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: path.join(P.b, "requirements.md") }, cwd: P.p }),
        hook("spec-hook.js", { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: path.join(P.a, "tasks.md") }, cwd: P.p }),
        hook("spec-hook.js", { hook_event_name: "SessionStart", cwd: P.p }),
        hook("observe-hook.js", { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "node -v" }, tool_response: { stdout: "v1", exit_code: 0 }, cwd: P.p }),
        hook("stop-hook.js", { hook_event_name: "Stop", last_assistant_message: "All tasks are done and verified.", cwd: P.p }),
        hook("guard-hook.js", { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: path.join(P.p, "src", "x.js") }, cwd: P.p }),
        hook("approval-hook.js", { hook_event_name: "PreToolUse", tool_name: "mcp__plugin_dev-spec-driven_spec-driven__spec_approve", tool_input: { name: "plaina", phase: "requirements" }, cwd: P.p }),
      ];
      for (const h of hooks) for (const b of h.bad) bad.push("hook: " + b);
      for (const h of hooks) if (has(h.value)) leaks.push("hook " + h.value.stdout.slice(0, 80));
      const notDriven = OPERATIONS.map((o) => o.id).filter((id) => !driven.has(id));
      all("1.41.1 read gate — THE property: every operation of the table (" + OPERATIONS.length + "), each feature name (plain, a linked folder, a linked archive's), read and write passes, and the hooks: no fs call reads, stats, lists or writes THROUGH a link below .specs/ (lstat / realpath of the link itself only), no result carries what lies behind one, nothing lands outside (got " +
        js({ bad: bad.slice(0, 40), more: Math.max(0, bad.length - 40), leaks: leaks.slice(0, 8), notDriven }) + ")", {
        noReadThrough: () => !bad.length, noLeak: () => !leaks.length, everyOpDriven: () => !notDriven.length,
        outsideUntouched: () => snap(P.out) === beforeP, nothingCopiedIn: () => !leaked(P.p).length,
      });
    }

    // (c) the resolver: a linked feature folder is reported, never "not found", in the project's language — and the folder-level
    // operations keep the 1.24 write refusal (12-lifecycle-write-gate.js G1 holds them unchanged)
    {
      const P2 = maze("pt", "pt");
      const st = S.statusFeature(M.p, "lnk"), pt = S.statusFeature(P2.p, "lnk"), nx = S.nextTask(M.p, "lnk"), d = S.specDoctor(M.p, "lnk");
      const ap = S.approvePhase(M.p, "lnk", "requirements", "t", { force: true });
      all("1.41.1 read gate: a feature folder that is a link answers `feature-linked` (its message by the entry, EN / PT) to every reader — status, next_task, doctor — while a mutator still meets the write gate's refusal at its lock (linked: true, the 1.24 message) (got " + js([st.error, pt.error, ap.error]) + ")", {
        code: () => [st, nx, d].every((r) => r.ok === false && r.code === "feature-linked"),
        en: () => st.error === S.msg("en").err.featureLinked(".specs/lnk/"),
        pt: () => pt.error === S.msg("pt").err.featureLinked(".specs/lnk/"),
        es: () => typeof S.msg("es").err.featureLinked(".specs/lnk/") === "string" && S.msg("es").err.featureLinked("x") !== S.msg("en").err.featureLinked("x"),
        mutator: () => ap.ok === false && ap.linked === true && ap.error === S.msg("en").err.specsLinked(".specs/lnk/"),
      });
    }

    // doctor specs-links: each link below .specs/ the reads treat as absent is named (never what it points at)
    {
      const d = S.specDoctor(M.p, "plaina");
      const c = (d.checks || []).find((x) => x.id === "specs-links");
      const names = [".specs/_archive", ".specs/lnk", ".specs/steering", ".specs/plaina/tests/ext"].concat(fl ? [".specs/.gitignore", ".specs/plaina/tasks.md", ".specs/plaina/decisions.md", ".specs/plaina/test-plan.md", ".specs/plaina/.execution/observed.jsonl", ".specs/plaina/.execution/task-1-report.md"] : []);
      const clean = maze("clean-links-none");
      for (const x of ["lnk", "steering", "_archive"]) fs.rmSync(path.join(clean.root, x), { recursive: true, force: true });
      fs.rmSync(path.join(clean.a, "tests", "ext"), { recursive: true, force: true });
      for (const f of ["tasks.md", "decisions.md", "test-plan.md", ".execution/observed.jsonl", ".execution/task-1-report.md"]) fs.rmSync(path.join(clean.a, f), { force: true });
      fs.rmSync(path.join(clean.root, ".gitignore"), { force: true });
      const none = (S.specDoctor(clean.p, "plaina").checks || []).find((x) => x.id === "specs-links");
      all("1.41.1 doctor specs-links: a warn naming each link below .specs/ the reads treat as absent — a linked feature folder, steering/, _archive/, a linked tests/ folder and every file link — never what they point at; no entry without one (got " + js([c, none]) + ")", {
        warn: () => !!c && c.status === "warn", named: () => names.every((n) => c.detail.includes(n)), inert: () => !has(c), noneWithout: () => none === undefined,
        entry: () => c.detail.startsWith(S.msg("en").doctor.specsLinks("", 0).split(":")[0]),
      });
    }

    // Addition A — where ABSENCE relaxes a decision: each fail-closed row (DESIGN-S2 §3) on its own fixture. Each moves a file OUT
    // of the project unchanged and links it back — the parent read the very same content through the link; only the link differs.
    if (fl) {
      const fresh = (name, opts) => {
        const p = path.join(tmp, "proj-rg-a-" + name), out = path.join(tmp, "proj-rg-a-" + name + "-out");
        fs.mkdirSync(out, { recursive: true });
        S.initProject(p, ["core"], "en", opts || {});
        const f = S.createFeature(p, { name: "feat", tracks: ["core"] });
        return { p, out, dir: f.dir, root: path.join(p, ".specs") };
      };
      const outLink = (x, file) => { const to = path.join(x.out, path.basename(file) + ".moved"); fs.renameSync(file, to); return fileLink(to, file); };
      const TASKS = "# Tasks\n\n- [ ] 1. [US1] Build it for US-1.AC-1\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/impl.js_\n  - _Verify: node -v_\n";
      const msgDone = "All tasks are done and verified.";
      // (A1) the approval guard: a roadmap.json that is a link is a GONE one — the engine and the hook ask (the gate alone read it as
      // absent → meta {} → off, while the raw existence check said "present")
      const a1 = fresh("guard", { approvalGuard: "ask" });
      outLink(a1, path.join(a1.root, "roadmap.json"));
      // its target says off — a file the agent may write outside .specs/ unguarded (the parent followed the link: off)
      const t1 = path.join(a1.out, "roadmap.json.moved");
      fs.writeFileSync(t1, js({ ...JSON.parse(fs.readFileSync(t1, "utf8")), meta: { ...JSON.parse(fs.readFileSync(t1, "utf8")).meta, approvalGuard: "off" } }, null, 2));
      const lvl = E.withReadCache(() => E.approvalGuardLevel(a1.p));
      const h1 = hookIn(path.join(HOOKS, "approval-hook.js"), { input: js({ hook_event_name: "PreToolUse", tool_name: "mcp__plugin_dev-spec-driven_spec-driven__spec_approve", tool_input: { name: "feat", phase: "requirements", projectDir: a1.p }, cwd: a1.p }), cwd: a1.p });
      const twin = fresh("guard-twin", { approvalGuard: "off" });
      all("1.41.1 Addition A (A1): a roadmap.json that is a link is a GONE one — the approval guard asks, engine (approvalGuardLevel) and hook alike; its plain twin saying off stays off (got " + js({ lvl, hook: h1.stdout.slice(0, 90) }) + ")", {
        engineAsks: () => lvl === "ask", hookAsks: () => /"permissionDecision":"ask"/.test(h1.stdout),
        twinOff: () => E.withReadCache(() => E.approvalGuardLevel(twin.p)) === "off",
      });
      // (A2) the stop gate: a linked roadmap.json saying stopCheck false never turns it off — engine (the user's option, else on) and
      // the Stop hook's raw pre-check alike; a ticked task with no evidence and a "done" claim is sent back
      const a2 = fresh("stop");
      fs.writeFileSync(path.join(a2.dir, "tasks.md"), TASKS.replace("- [ ] 1.", "- [x] 1."));
      const st2 = JSON.parse(fs.readFileSync(path.join(a2.dir, ".state.json"), "utf8"));
      fs.writeFileSync(path.join(a2.dir, ".state.json"), js({ ...st2, ticks: { 1: now }, lastTickAt: now }, null, 2));
      const rm2 = JSON.parse(fs.readFileSync(path.join(a2.root, "roadmap.json"), "utf8"));
      fs.writeFileSync(path.join(a2.root, "roadmap.json"), js({ ...rm2, meta: { ...rm2.meta, stopCheck: false } }, null, 2));
      const offPlain = S.stopCheck(a2.p, { message: msgDone });
      outLink(a2, path.join(a2.root, "roadmap.json"));
      const envNoStop = { ...process.env };
      delete envNoStop.DEV_SPEC_STOP_CHECK;
      const e2 = S.stopCheck(a2.p, { message: msgDone });
      const h2 = hookIn(path.join(HOOKS, "stop-hook.js"), { input: js({ hook_event_name: "Stop", last_assistant_message: msgDone, cwd: a2.p }), cwd: a2.p, env: { ...envNoStop, CLAUDE_PROJECT_DIR: a2.p } });
      all("1.41.1 Addition A (A2): a linked roadmap.json saying stopCheck: false leaves the stop gate ON — the engine sends a done claim over an unverified tick back, and so does the Stop hook (its raw pre-check reads the link as no roadmap.json); the plain file saying false keeps it off (got " + js({ offPlain: offPlain.block, e2: [e2.block, e2.why], h2: h2.stdout.slice(0, 80) }) + ")", {
        plainOff: () => offPlain.block === false, engineOn: () => e2.block === true, hookOn: () => /"decision":"block"/.test(h2.stdout),
      });
      // (A3) guard mode: a linked roadmap.json reads as none on both sides — the user's default (off here), never its target's "scope"
      const a3 = fresh("guardmode", { guard: "scope" });
      outLink(a3, path.join(a3.root, "roadmap.json"));
      const gl = E.withReadCache(() => E.guardLevel(a3.p));
      const g3 = hookIn(path.join(HOOKS, "guard-hook.js"), { input: js({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: path.join(a3.p, "src", "x.js") }, cwd: a3.p }), cwd: a3.p, env: envNoStop });
      ok(gl === false && g3.stdout === "", "1.41.1 Addition A (A3 — no weaker than a deleted roadmap.json): guard mode reads a linked roadmap.json as none, the engine and the guard hook alike — the user's default (got " + js([gl, g3.stdout.slice(0, 60)]) + ")");
      // (A4) the implementer's report behind a link is no report — the stop gate sends the turn back (the parent read its "exit 0")
      const a4 = fresh("report");
      fs.writeFileSync(path.join(a4.dir, "tasks.md"), TASKS);
      put(path.join(a4.dir, ".execution", "task-1-report.md"), "# Task 1\n`node -v` → exit 0\n");
      const r4plain = S.stopCheck(a4.p, { agent: "dev-spec-driven:spec-implementer", message: "**Status:** DONE\nReport: .specs/feat/.execution/task-1-report.md" });
      outLink(a4, path.join(a4.dir, ".execution", "task-1-report.md"));
      const r4 = S.stopCheck(a4.p, { agent: "dev-spec-driven:spec-implementer", message: "**Status:** DONE\nReport: .specs/feat/.execution/task-1-report.md" });
      // (A5) the approvals of a .state.json behind a link are none — next_action asks for them again
      const a5 = fresh("approvals");
      fs.writeFileSync(path.join(a5.dir, "tasks.md"), TASKS);
      S.approvePhase(a5.p, "feat", null, "t", { through: "tasks", force: true, reason: "r" });
      const n5plain = S.nextAction(a5.p, "feat");
      outLink(a5, path.join(a5.dir, ".state.json"));
      const n5 = S.nextAction(a5.p, "feat");
      // (A6) an approved artifact moved out and linked back: changed since its approval (it reads gone)
      const a6 = fresh("changed");
      fs.writeFileSync(path.join(a6.dir, "tasks.md"), TASKS);
      S.approvePhase(a6.p, "feat", null, "t", { through: "tasks", force: true, reason: "r" });
      outLink(a6, path.join(a6.dir, "requirements.md"));
      const n6 = S.nextAction(a6.p, "feat");
      // (A7) finish of a feature whose tasks.md is a link: blocked for having no tasks — never judged on what it points at
      const a7 = fresh("finish");
      fs.writeFileSync(path.join(a7.dir, "tasks.md"), TASKS);
      outLink(a7, path.join(a7.dir, "tasks.md"));
      const f7 = S.finishFeature(a7.p, "feat", {});
      // (A8) the scope guard: an approved plan behind a link covers nothing — an edit of its file asks (the parent allowed it)
      const a8 = fresh("scope", { guard: "scope" });
      fs.writeFileSync(path.join(a8.dir, "tasks.md"), TASKS);
      S.approvePhase(a8.p, "feat", null, "t", { through: "tasks", force: true, reason: "r" });
      const s8plain = E.withReadCache(() => E.guardCheck(a8.p, path.join(a8.p, "src", "impl.js")));
      outLink(a8, path.join(a8.dir, "tasks.md"));
      const s8 = E.withReadCache(() => E.guardCheck(a8.p, path.join(a8.p, "src", "impl.js")));
      const F = S.msg("en").finish;
      all("1.41.1 Addition A (A4–A8): absence fails closed — a linked implementer report is no report (sent back), a linked .state.json approves nothing (next_action asks again), an approved artifact linked back changed since its approval, finish of a linked tasks.md is blocked for having no tasks, the scope guard asks for a plan behind a link — each the plain file's verdict until the move (got " +
        js({ r4: [r4plain.why, r4.block, r4.why], n5: [n5plain.step, n5.step, n5.pendingGates], n6: [n6.step, n6.changedSinceApproval], f7: (f7.blockers || []).slice(0, 2), s8: [s8plain.decision, s8.decision] }) + ")", {
        report: () => r4plain.block === false && r4.block === true && !has(r4),
        approvals: () => !(n5plain.pendingGates || []).length && (n5.pendingGates || []).includes("tasks"),
        changed: () => (n6.changedSinceApproval || []).includes("requirements.md"),
        finish: () => (f7.blockers || []).some((b) => b.includes(typeof F.noTasks === "string" ? F.noTasks : String(F.noTasks).slice(0, 10))),
        scope: () => s8plain.decision === "allow" && s8.decision === "ask",
      });
    } else ok(true, "1.41.1 Addition A: file symlinks not creatable here — skipped (Linux runs them)");

    // (d) .specs ITSELF a link (a project keeping its specs elsewhere): read exactly as a plain .specs/ — the gate is BELOW it
    {
      const base = path.join(tmp, "proj-rg-specs-link");
      const real = path.join(base, "real"), shared = path.join(base, "shared"), lp = path.join(base, "linked");
      fs.mkdirSync(real, { recursive: true }); fs.mkdirSync(lp, { recursive: true });
      S.initProject(real, ["tdd"], "en");
      const f = S.createFeature(real, { name: "login", tracks: ["tdd"] });
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Do it for US-1.AC-1\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -v_\n");
      fs.cpSync(path.join(real, ".specs"), shared, { recursive: true });
      if (link(shared, path.join(lp, ".specs"))) {
        const view = (p) => { const r = [S.statusFeature(p, "login"), S.nextTask(p, "login"), S.traceCheck(p, "login", {}), S.taskBrief(p, "login", 1, {}).task, S.specDoctor(p, "login").checks.map((c) => c.id + c.status)];
          return js(r).split(p).join("<P>").split(fold(p)).join("<P>"); };
        eq(view(lp), view(real), "1.41.1 read gate: a project whose .specs/ IS a link reads every spec as a plain .specs/ does (status, next_task, trace, the brief, doctor) — only what lies BELOW .specs/ is gated");
      } else ok(true, "1.41.1 read gate (.specs a link): links not creatable here — skipped");
    }

    // the read-ahead pool (readFileHeads with workers: DEV_SPEC_TEST_AHEAD=on, ≥ 96 files) never reads a file behind a link either
    {
      const p = path.join(tmp, "proj-rg-pool");
      S.initProject(p, ["tdd"], "en");
      const f = S.createFeature(p, { name: "pool", tracks: ["tdd"] });
      const files = [];
      for (let i = 0; i < 110; i++) { const q = path.join(f.dir, "tests", "t" + i + ".test.js"); put(q, "// T-" + i + "\n"); files.push(q); }
      const outF = path.join(tmp, "proj-rg-pool-out", "secret.test.js");
      put(outF, "// OUTSIDE-POOL\n");
      const at = path.join(f.dir, "tests", "zz-linked.test.js");
      if (fileLink(outF, at)) {
        files.splice(80, 0, at);
        const ahead = process.env.DEV_SPEC_TEST_AHEAD;
        process.env.DEV_SPEC_TEST_AHEAD = "on";
        let got = [];
        try { const r = E.readFileHeads(files, 100); try { for (let i = 0; i < files.length; i++) got.push(r.next()); } finally { r.stop(); } } finally { if (ahead === undefined) delete process.env.DEV_SPEC_TEST_AHEAD; else process.env.DEV_SPEC_TEST_AHEAD = ahead; }
        ok(got[80] === null && got.filter((x) => x !== null).length === 110 && !has(got), "1.41.1 read gate: the read-ahead pool (workers on, 111 heads) gives null for a file behind a link below .specs/ and every other head as read (got " + js([got[80], got.filter((x) => x !== null).length]) + ")");
      } else ok(true, "1.41.1 read gate (pool): file symlinks not creatable here — skipped");
    }
    // a rename onto a name held by a link (a dangling one too): taken — never a move onto it
    {
      const p = path.join(tmp, "proj-rg-rename");
      S.initProject(p, ["tdd"], "en");
      S.createFeature(p, { name: "alpha" });
      if (link(path.join(tmp, "proj-rg-rename-nowhere"), path.join(p, ".specs", "beta"))) {
        const r = S.manageFeature(p, "rename", "alpha", "beta");
        ok(r.ok === false && r.error === S.msg("en").err.alreadyExists("beta") && fs.existsSync(path.join(p, ".specs", "alpha")), "1.41.1: a rename onto a name a dangling link holds is refused as taken (entryAt) — the feature stays (got " + js(r) + ")");
      } else ok(true, "1.41.1 (rename onto a link): links not creatable here — skipped");
    }
    // roadmap.json gone, the only feature's .state.json a link: no feature on both sides (the engine's existsRaw, the hook's lstat)
    if (M.links.files) {
      const p = path.join(tmp, "proj-rg-gone");
      S.initProject(p, ["tdd"], "en");
      const f = S.createFeature(p, { name: "solo" });
      const st = path.join(tmp, "proj-rg-gone-state.json");
      fs.renameSync(path.join(f.dir, ".state.json"), st);
      fileLink(st, path.join(f.dir, ".state.json"));
      fs.rmSync(path.join(p, ".specs", "roadmap.json"));
      const lvl = E.withReadCache(() => E.approvalGuardLevel(p));
      const h = hookIn(path.join(HOOKS, "approval-hook.js"), { input: js({ hook_event_name: "PreToolUse", tool_name: "mcp__plugin_dev-spec-driven_spec-driven__spec_approve", tool_input: { name: "solo", phase: "requirements", projectDir: p }, cwd: p }), cwd: p });
      ok(lvl === "off" && h.stdout === "", "1.41.1: roadmap.json gone and the only feature's .state.json a link — no feature counts, on both sides (engine off, the hook silent): one answer (got " + js([lvl, h.stdout.slice(0, 60)]) + ")");
    }

    // (f) one scope, a write, then a read: the gate's memo follows the engine's writes (a file made in the call reads as made)
    {
      const p = path.join(tmp, "proj-rg-memo");
      S.initProject(p, ["tdd"], "en");
      const f = S.createFeature(p, { name: "memo" });
      const file = path.join(f.dir, ".execution", "note.md");
      const r = E.withReadCache(() => { const a = E.existsRaw(file); const d0 = E.isDirSafe(path.join(f.dir, ".execution")); E.writeFileAtomic(file, "hello\n"); return [a, d0, E.existsRaw(file), E.readIfExists(file), E.isDirSafe(path.join(f.dir, ".execution")), (E.readDirCached(path.join(f.dir, ".execution")) || []).map((e) => e.name)]; });
      eq(r, [false, false, true, "hello\n", true, ["note.md"]], "1.41.1 read gate: inside ONE read-cache scope a file and folder the engine writes read as made (forgetCached drops the gate's lstat / realpath memo)");
    }

    // (g) the branches no fixture can make without admin rights — a folder whose real path leaves .specs/ (a mount point), one resolving
    // to .specs itself, a part lstat can't read: stubbed for one path, each reads as absent, nothing thrown
    {
      const p = path.join(tmp, "proj-rg-stubs");
      S.initProject(p, ["tdd"], "en");
      const f = S.createFeature(p, { name: "stub" });
      const tasks = path.join(f.dir, "tasks.md");
      const rp = fs.realpathSync.native, ls = fs.lstatSync;
      const dirKey = fold(path.resolve(f.dir));
      const withStub = (mode, fn) => {
        fs.realpathSync.native = function (q) { if (mode !== "eacces" && fold(path.resolve(String(q))) === dirKey) return mode === "out" ? path.join(tmp, "elsewhere", "stub") : rp(path.join(p, ".specs")); return rp.apply(this, arguments); };
        fs.lstatSync = function (q) { if (mode === "eacces" && fold(path.resolve(String(q))) === dirKey) throw Object.assign(new Error("EACCES"), { code: "EACCES" }); return ls.apply(this, arguments); };
        try { return E.withReadCache(fn); } finally { fs.realpathSync.native = rp; fs.lstatSync = ls; }
      };
      const read = () => [E.readIfExists(tasks) === null, E.existsRaw(tasks), E.isDirSafe(f.dir), (E.readDirCached(f.dir) || null) === null, E.safeReaddir(f.dir).length, E.readFileHead(tasks, 100) === null, typeof E.specsReadBlocked === "function" ? E.specsReadBlocked(tasks) : "n/a"];
      const plain = E.withReadCache(read);
      eq({ out: withStub("out", read), root: withStub("root", read), eacces: withStub("eacces", read), plain },
        { out: [true, false, false, true, 0, true, true], root: [true, false, false, true, 0, true, true], eacces: [true, false, false, true, 0, true, true], plain: [false, true, true, false, plain[4], false, false] },
        "1.41.1 read gate: a folder below .specs/ whose real path leaves the real .specs/ (a mount point), one resolving to .specs itself, and a part lstat can't read (EACCES) read as absent — every primitive; the plain folder as ever");
    }

    // (h) an import's dry run beside a linked steering/: the preview is the real import's, and nothing is read through the link
    {
      const p = path.join(tmp, "proj-rg-dry");
      fs.mkdirSync(p, { recursive: true });
      S.initProject(p, ["tdd"], "en");
      const out = path.join(tmp, "proj-rg-dry-out");
      put(path.join(out, "x.md"), "---\ninclusion: always\n---\n# OUTSIDE-DRY\n");
      fs.rmSync(path.join(p, ".specs", "steering"), { recursive: true, force: true });
      if (link(out, path.join(p, ".specs", "steering"))) {
        const text = "# Plan: Dry\n\n## Steps\n1. Build `src/dry.js`\n\n## Acceptance\n- WHEN a user saves THE SYSTEM SHALL store it\n";
        const t = traced(p, out, () => S.importSpec(p, "plan", null, { text, dryRun: true }));
        const real = S.importSpec(p, "plan", null, { text });
        const files = (t.value.preview || []).map((x) => [x.file, fs.readFileSync(path.join(real.dir, x.file), "utf8").slice(0, x.content.length) === x.content]);
        all("1.41.1 read gate: spec_import's dry run beside a linked steering/ previews what the real import writes and reads nothing through the link (got " + js({ bad: t.bad, files }) + ")", {
          ok: () => t.value.ok === true && real.ok === true, parity: () => files.length > 0 && files.every(([, same]) => same), noRead: () => !t.bad.length && !has(t.value),
        });
      } else ok(true, "1.41.1 read gate (dry run): links not creatable here — skipped");
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // the cost — COUNTS (1.40 method): one lstat per distinct part, one realpath per distinct folder, no gate call outside .specs/
  // ---------------------------------------------------------------------------------------------------------------------------
  {
    const mk = (name, n) => {
      const p = path.join(tmp, "proj-rg-cost-" + name);
      S.initProject(p, ["tdd"], "en");
      fs.mkdirSync(path.join(p, "src"), { recursive: true });
      for (let i = 1; i <= n; i++) {
        const f = S.createFeature(p, { name: "f" + i, tracks: ["tdd"] });
        fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Do " + i + " for US-1.AC-1\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/f" + i + ".js_\n  - _Verify: node -v_\n");
        fs.writeFileSync(path.join(p, "src", "f" + i + ".js"), "x\n");
      }
      return p;
    };
    const p2 = mk("n2", 2), p4 = mk("n4", 4);
    const under = (p) => path.join(path.resolve(p), ".specs") + path.sep;
    const twice = fsCalls(under(p4), () => S.withReadCache(() => { E.specDoctor(p4, "f1"); E.specDoctor(p4, "f1"); }));
    const once = fsCalls(under(p4), () => S.withReadCache(() => E.specDoctor(p4, "f1")));
    // one listing (the project's), N feature folders: the gate's calls grow by the same per-feature step from 2 to 4 features
    const listing = (p) => fsCalls(under(p), () => S.listFeatures(p));
    const l2 = listing(p2), l4 = listing(p4), l3p = listing(mk("n3", 3));
    const src = (p) => fsCalls(path.join(path.resolve(p), "src") + path.sep, () => S.traceCheck(p, "f1", { code: true }));
    const s4 = src(p4);
    all("1.41.1 read gate cost (counts): a path touched twice in one scope costs one lstat (doctor twice = doctor once, lstat and realpath alike), the list's gate calls grow by one fixed step per feature (2 → 3 → 4 features), and no lstat / realpath is made outside .specs/ by the gate (src/ sees what it read before) (got " +
      js({ twice: [twice.lstatSync, twice["realpathSync.native"]], once: [once.lstatSync, once["realpathSync.native"]], l2, l3p, l4, s4 }) + ")", {
      memo: () => twice.lstatSync === once.lstatSync && twice["realpathSync.native"] === once["realpathSync.native"],
      linear: () => ["lstatSync", "realpathSync.native"].every((k) => (l4[k] || 0) - (l3p[k] || 0) === (l3p[k] || 0) - (l2[k] || 0) && (l4[k] || 0) > (l2[k] || 0)),
      realpathPerFolder: () => (l4["realpathSync.native"] || 0) <= 4 + 1 + 1, // the 4 feature folders, steering/, the root
      noneInSrc: () => !s4.lstatSync && !s4["realpathSync.native"],
    });
  }

  // ---------------------------------------------------------------------------------------------------------------------------
  // R3 — a project file by its REAL path (projectFileReal): protected tests, the status line's tests gate, the importers
  // ---------------------------------------------------------------------------------------------------------------------------
  {
    const base = path.join(tmp, "proj-rg-r3");
    const p = path.join(base, "proj"), outdir = path.join(base, "outdir");
    fs.mkdirSync(p, { recursive: true });
    put(path.join(base, "secret.txt"), "hunter2\n");
    put(path.join(outdir, "a.test.js"), "// T-01 outside content\n");
    S.initProject(p, ["tdd"], "en");
    const f = S.createFeature(p, { name: "feat", tracks: ["tdd"] });
    fs.mkdirSync(path.join(p, "tests"), { recursive: true });
    const linked = link(outdir, path.join(p, "tests", "ext"));
    const sp = path.join(f.dir, ".state.json");
    const crypto = require("crypto");
    const h16 = (file) => crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
    const keys = { "../secret.txt": null, [path.join(base, "secret.txt")]: null, "C:x.test.js": null, ...(linked ? { "tests/ext/a.test.js": null } : {}) };
    const finishWith = (hash, missing) => {
      const st = JSON.parse(fs.readFileSync(sp, "utf8"));
      const files = {};
      for (const k of Object.keys(keys)) files[k] = hash;
      st.protectedTests = { at: now, via: "approval", files, lifts: [] };
      fs.writeFileSync(sp, js(st, null, 2));
      const moves = [[path.join(base, "secret.txt"), path.join(base, "secret.gone")], [path.join(outdir, "a.test.js"), path.join(outdir, "a.test.gone")]];
      for (const [from, to] of moves) { if (missing && fs.existsSync(from)) fs.renameSync(from, to); else if (!missing && fs.existsSync(to)) fs.renameSync(to, from); }
      const r = S.finishFeature(p, "feat", {});
      return js([r.protectedTests, (r.warnings || []).filter((w) => /Protected tests/.test(w))]);
    };
    const v = [finishWith(null), finishWith(h16(path.join(base, "secret.txt"))), finishWith("0000000000000000"), finishWith(null, true)];
    finishWith(null);
    const pt = JSON.parse(v[0])[0];
    const acc = linked ? S.manageFeature(p, "protect", "feat", null, { file: "tests/ext/a.test.js", accept: true, reason: "probe", dryRun: true }) : null;
    all("1.41.1 R3: a protected-tests key that is no file of the project by its real path (`../x`, absolute, `C:x`, a junction out) is never hashed, never counted, never unexplained — finish's answer is the SAME whether the file it names exists, matches the recorded hash or not (no oracle) — and it is NAMED in finish's warning; the accept of a path through a junction out is outside-project, no hash (got " + js({ v0: v[0].slice(0, 300), acc }) + ")", {
      noOracle: () => v.every((x) => x === v[0]), ignored: () => js(pt.ignored.slice().sort()) === js(Object.keys(keys).sort()) && pt.count === 0 && !pt.unexplained.length,
      named: () => JSON.parse(v[0])[1].some((w) => w.includes("../secret.txt") && w.includes(S.msg("en").protectedTests.ignored("feat", "", 0).split(":")[1].trim().slice(0, 20))),
      accept: () => !linked || (acc.ok === false && acc.code === "outside-project" && acc.hash === undefined),
    });
    // the status line's tests gate: a plan's file through a junction out is never read (its T-ID counts for nothing)
    if (linked) {
      fs.writeFileSync(path.join(f.dir, "test-plan.md"), "# Test Plan: feat\n\n## Traceability Matrix\n\n| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---|---|---|---|---|---|\n| T-01 | unit | example | it | US-1.AC-1 | `tests/ext/a.test.js` |\n");
      S.approvePhase(p, "feat", null, "t", { through: "test-plan", force: true, reason: "r" });
      const reads = [];
      S.statusLine(p, { reads });
      ok(!reads.some((r) => fold(r).includes(fold(path.join("tests", "ext")))), "1.41.1 R3: the status line's tests gate never reads a plan's file through a junction out of the project (got " + js(reads) + ")");
    }
    // the importers: a folder of the source that is a link out of the project lists nothing — one warning names the FOLDER
    const ip = path.join(tmp, "proj-rg-imports");
    const io = path.join(tmp, "proj-rg-imports-out");
    put(path.join(io, "private-name-one.md"), "# OUTSIDE-IMP\n");
    put(path.join(io, "stories", "private-story-two.md"), "# Story 1.1: OUTSIDE-STORY\n");
    put(path.join(io, "cap", "spec.md"), "# OUTSIDE-SPEC\n");
    fs.mkdirSync(path.join(ip, ".specs"), { recursive: true });
    fs.writeFileSync(path.join(ip, ".specs", "roadmap.json"), js({ meta: { lang: "en" }, features: {} }));
    put(path.join(ip, "specs", "001-x", "spec.md"), "# Feature Specification: X\n\n## User Scenarios & Testing\n\n### User Story 1 - Do (Priority: P1)\n\nU.\n\n**Acceptance Scenarios**:\n\n1. **Given** a, **When** b, **Then** c\n");
    put(path.join(ip, "specs", "001-x", "plan.md"), "# Plan\n");
    put(path.join(ip, "openspec", "changes", "add-x", "proposal.md"), "# Change: Add x\n\n## Why\nB.\n");
    put(path.join(ip, "bmadsrc", "epics.md"), "# Epics\n\n## Epic 1: T\n\n### Story 1.1: Do\n\nAs a user I want x so that y.\n\n**Acceptance Criteria:**\n1. WHEN x THEN the system SHALL y\n");
    const l1 = link(io, path.join(ip, "specs", "001-x", "contracts")), l2 = link(io, path.join(ip, "openspec", "changes", "add-x", "specs")), l3 = link(io, path.join(ip, "bmadsrc", "docs"));
    if (l1 && l2 && l3) {
      const runs = [S.importSpec(ip, "spec-kit", "specs/001-x", { dryRun: true }), S.importSpec(ip, "openspec", "openspec/changes/add-x", { dryRun: true }), S.importSpec(ip, "bmad", "bmadsrc", { dryRun: true })];
      const W = S.msg("en").importSpec;
      all("1.41.1 R3: spec-kit's contracts/, OpenSpec's specs/ and BMAD's docs/ linked out of the project list nothing — no outside name or text in the result, one warning naming the linked folder (got " + js(runs.map((r) => r.warnings)) + ")", {
        okAll: () => runs.every((r) => r.ok === true),
        noName: () => runs.every((r) => !/private-name-one|private-story-two|OUTSIDE-/.test(js(r))),
        speckit: () => runs[0].warnings.includes(W.wUnreadable("specs/001-x/contracts")),
        openspec: () => runs[1].warnings.includes(W.wUnreadable("openspec/changes/add-x/specs")),
        bmad: () => runs[2].warnings.includes(W.wUnreadable("bmadsrc/docs/stories")),
      });
    } else ok(true, "1.41.1 R3 (imports): links not creatable here — skipped");
    // trace's feature folders are FOLDERS: a root file (ROADMAP.md, roadmap.json) is never read as one
    const calls = fsCalls(path.join(path.resolve(p), ".specs") + path.sep, () => S.traceCheck(p, "feat", { code: true }));
    const seen = [];
    const rd = fs.readFileSync;
    fs.readFileSync = function (q) { if (typeof q === "string") seen.push(q); return rd.apply(this, arguments); };
    try { S.traceCheck(p, "feat", { code: true }); } finally { fs.readFileSync = rd; }
    ok(calls.readFileSync > 0 && !seen.some((q) => /ROADMAP\.md[\\/]|roadmap\.json[\\/]/.test(q)), "1.41.1: trace's feature folders are folders only — never ROADMAP.md/test-plan.md, roadmap.json/… (got " + js(seen.filter((q) => /ROADMAP|roadmap\.json/.test(q))) + ")");
  }
};
