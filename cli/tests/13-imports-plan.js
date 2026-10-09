"use strict";
// import plan / execplan / bmad, the design-first flow (create --flow, feature flow).

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, runIn, tmp, CLI, require, __dirname }) => {
  const c3 = path.join(tmp, "pc3-proj");
  const put = (rel, s) => { const p = path.join(c3, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
  const read = (...p) => fs.readFileSync(path.join(c3, ...p), "utf8");
  const json = (args) => { try { return JSON.parse(runIn(args).out); } catch { return null; } };
  runIn(["init", "core", "--project", c3]);
  const planText = "# Plan: Dark mode\n\n## Goals\n- When the user clicks the toggle, the theme switches\n\n## Steps\n- [x] Add `src/theme.ts`\n- [ ] Wire the toggle in `src/Header.tsx`\n";
  put(".claude/plans/dark.md", planText);
  const pi = runIn(["import", "plan", ".claude/plans/dark.md", "--project", c3]);
  const piTasks = fs.existsSync(path.join(c3, ".specs", "dark-mode", "tasks.md")) ? read(".specs", "dark-mode", "tasks.md") : "";
  ok(pi.code === 0 && /Imported plan \.claude\/plans\/dark\.md → feature 'dark-mode' \[core \+ui\] \(en\)/.test(pi.out) && /mapping: \d+ ID\(s\) — Dark mode → US-1, Goals 1 → US-1\.AC-1/.test(pi.out) &&
    /- \[x\] 1\. Add `src\/theme\.ts`\n  - _Implements: src\/theme\.ts_\n- \[ \] 2\. Wire the toggle in `src\/Header\.tsx`\n  - _Implements: src\/Header\.tsx_/.test(piTasks) &&
    /US-1\.AC-1\*\* — WHEN the user clicks the toggle, THE SYSTEM SHALL ensure that the theme switches/.test(read(".specs", "dark-mode", "requirements.md")) &&
    read(".claude", "plans", "dark.md") === planText && runIn(["ears", "dark-mode", "--project", c3]).code === 0,
    "import plan <file>: a NEW feature named after the plan, checklist state kept, file paths → _Implements:_, criteria in EARS (ears passes), the source untouched");
  const home = runIn(["import", "plan", "~/.claude/plans/dark.md", "--project", c3]);
  put("plans/a.md", "# A\n- [ ] x\n");
  put("plans/b.md", "# B\n- [ ] y\n");
  const sev = runIn(["import", "plan", "plans", "--json", "--project", c3]);
  let sevJ = null;
  try { sevJ = JSON.parse(sev.out); } catch { /* not JSON */ }
  const again = runIn(["import", "plan", ".claude/plans/dark.md", "--project", c3]);
  const bad = runIn(["import", "notion", "x", "--project", c3]);
  ok(home.code === 1 && /outside the project[^\n]*plansDirectory \(default ~\/\.claude\/plans/.test(home.out) && sev.code === 1 && sevJ && sevJ.ok === false && /several documents \(a\.md, b\.md\)/.test(sevJ.error) &&
    again.code === 1 && /already exists/.test(again.out) && bad.code === 1 && /Known: kiro, spec-kit, openspec, plan, execplan, bmad, fluidplan, kiro-steering, cursor-rules\./.test(bad.out),
    "import plan refusals exit 1: ~/.claude/plans (outside — says how to bring the plan in), a folder of several plans (--json: the refusal on stdout), an existing feature; an unknown format lists every one (1.25: the steering tools too)");
  put("exec/health.md", "# Health endpoint\n\n## Purpose / Big Picture\n\nOperators can check the API.\n\n## Progress\n\n- [x] (2025-10-01 13:00Z) Add `src/health.ts`\n- [ ] Ping the database and run `npm test`\n\n" +
    "## Decision Log\n\n- Decision: SELECT 1 as the ping.\n  Rationale: cheap.\n\n## Validation and Acceptance\n\n- If the database is down, the endpoint returns 503\n");
  const exJ = json(["import", "execplan", "exec/health.md", "--json", "--project", c3]);
  const exEngine = (() => { const d2 = path.join(tmp, "pc3-engine"); fs.mkdirSync(path.join(d2, "exec"), { recursive: true }); fs.copyFileSync(path.join(c3, "exec", "health.md"), path.join(d2, "exec", "health.md"));
    return require(path.join(__dirname, "..", "mcp", "lib", "spec.js")).importSpec(d2, "execplan", "exec/health.md"); })();
  ok(exJ && exJ.ok && exJ.feature === "health-endpoint" && exJ.toolName === "ExecPlan" && exJ.mapping["Decision Log 1"] === "D-1" && exJ.mapping["Progress 2"] === "task 2" &&
    JSON.stringify(exJ.mapping) === JSON.stringify(exEngine.mapping) && JSON.stringify(exJ.warnings) === JSON.stringify(exEngine.warnings) &&
    /- \[ \] 2\. Ping the database and run `npm test`\n  - _Verify: npm test_/.test(read(".specs", "health-endpoint", "tasks.md")) &&
    /## Decisions\n\n- \*\*D-1\*\* — SELECT 1 as the ping\.\n  Rationale: cheap\./.test(read(".specs", "health-endpoint", "design.md")),
    "import execplan --json: the engine's result (same mapping and warnings as spec_import), Progress → tasks with _Verify:_, Decision Log → design.md ## Decisions");
  put("docs/prd.md", "# Notes App Product Requirements Document (PRD)\n\n## Requirements\n\n### Functional\n- FR1: Users can write notes.\n\n### Non Functional\n- NFR1: Saves in under 1 s.\n");
  put("docs/stories/1.1.write.md", "# Story 1.1: Write notes\n\n## Story\n\nAs a user, I want to write notes, so that I remember.\n\n## Acceptance Criteria\n\n1. WHEN a user saves a note THEN the system SHALL store it.\n\n" +
    "## Tasks / Subtasks\n\n- [ ] Task 1: Note store (AC: 1)\n");
  const bm = runIn(["import", "bmad", "docs", "--lang", "pt", "--project", c3]);
  const bmReq = fs.existsSync(path.join(c3, ".specs", "notes-app", "requirements.md")) ? read(".specs", "notes-app", "requirements.md") : "";
  ok(bm.code === 0 && /Importado de BMAD docs → feature 'notes-app'/.test(bm.out) && /## Requisitos Não-Funcionais\n- \*\*NFR-1\*\* — Saves in under 1 s\./.test(bmReq) &&
    /- \[ \] 1\. \[US1\] Task 1: Note store\n  - _Requirements: US-1\.AC-1_/.test(read(".specs", "notes-app", "tasks.md")) && /^> Importado de BMAD `docs` em /m.test(bmReq),
    "import bmad --lang pt: FR/NFR → FR-1 / NFR-1 under the localized heading, story tasks tagged [US1] with (AC: 1) → _Requirements:_, PT output and note");

  // design-first: create --flow, next-action order, approve order, feature flow, roadmap
  const df = path.join(tmp, "pc3-flow");
  runIn(["init", "core", "--project", df]);
  const cr = runIn(["create", "Port engine", "core", "--flow", "design-first", "--project", df]);
  const crJ = json(["create", "Other", "core", "--flow", "design-first", "--json", "--project", df]);
  const crBad = runIn(["create", "Bad one", "core", "--flow", "sideways", "--project", df]);
  ok(cr.code === 0 && /design-first flow — phase order: classification → design → requirements → tasks/.test(cr.out) && crJ && crJ.flow === "design-first" &&
    JSON.parse(fs.readFileSync(path.join(df, ".specs", "port-engine", ".state.json"), "utf8")).flow === "design-first" &&
    crBad.code === 1 && /flow must be one of: requirements-first, design-first \(got "sideways"\)/.test(crBad.out) && !fs.existsSync(path.join(df, ".specs", "bad-one")),
    "create --flow design-first (= spec_create {flow}): stored, the phase order printed, --json carries flow; an unknown flow exits 1 with the MCP enum's message, nothing created");
  runIn(["approve", "port-engine", "classification", "--force", "--project", df]);
  const na = runIn(["next-action", "port-engine", "--project", df]);
  const apReq = runIn(["approve", "port-engine", "requirements", "--project", df]);
  ok(/design\.md/.test(na.out) && /\(design-first flow: classification → design → requirements → tasks\)/.test(na.out) && apReq.code === 1 && /earlier phases are not approved yet: design/.test(apReq.out),
    "next-action on a design-first feature asks for design.md (naming the flow); approve requirements before the design exits 1 on phase-order");
  const rmOut = runIn(["roadmap", "--project", df]).out;
  runIn(["create", "Classic", "core", "--project", df]);
  const fl = runIn(["feature", "flow", "classic", "design-first", "--project", df]);
  const flSame = runIn(["feature", "flow", "classic", "--flow", "design-first", "--project", df]);
  const flBad = runIn(["feature", "flow", "classic", "sideways", "--project", df]);
  runIn(["bugfix", "Crash", "--project", df]);
  const flBug = runIn(["feature", "flow", "crash", "design-first", "--project", df]);
  const flNone = runIn(["feature", "flow", "classic", "--project", df]);
  ok(/port-engine[^\n]*8%/.test(rmOut) && fl.code === 0 && /'classic' now follows the design-first flow \(was requirements-first\) — phase order: classification → design → requirements → tasks\./.test(fl.out) &&
    flSame.code === 0 && /already follows the design-first flow/.test(flSame.out) && flBad.code === 1 && /flow must be one of/.test(flBad.out) &&
    flBug.code === 1 && /is a bugfix: it follows its own fixed phase order/.test(flBug.out) && flNone.code === 1 && /flow required/.test(flNone.out),
    "roadmap shows a fresh design-first feature at 8%; feature flow <name> <flow> / --flow sets it (idempotent), a bad or missing flow and a bugfix exit 1 (got " + JSON.stringify([rmOut.split("\n").filter((l) => /port-engine/.test(l)), fl.out, flNone.out]).slice(0, 400) + ")");
  const help = runIn(["help"]).out;
  const doc = require(path.join(path.dirname(CLI), "commands.js")).helpText();
  ok(/import <kiro\|spec-kit\|openspec\|plan\|execplan\|bmad\|fluidplan> <path>/.test(help) && /import <kiro\|spec-kit\|openspec\|plan\|execplan\|bmad\|fluidplan> <path>/.test(doc) &&
    /feature flow <name> <requirements-first\|design-first>/.test(help) && /--flow design-first/.test(help) && /--flow design-first/.test(doc),
    "help and the command table document import plan|execplan|bmad, create --flow design-first and feature flow");
};
