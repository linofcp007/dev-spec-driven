"use strict";
// dev-spec import fluidplan (= spec_import {tool: "fluidplan"}).

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, runIn, tmp, CLI, require, __dirname }) => {
  const SF = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof s === "string" ? s : JSON.stringify(s, null, 2)); };
  const rd = (root, ...p) => { try { return fs.readFileSync(path.join(root, ...p), "utf8"); } catch { return ""; } };
  const withStdin = (args, input) => { const r = spawnSync(process.execPath, [CLI, ...args], { input, encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } }); return { out: r.stdout || "", err: r.stderr || "", code: r.status }; };
  // plan.json v2 + answers.json, as fluidplan writes them (github.com/morganhub/fluidplan @ 755d1b24): D2's task is a template
  // ({{value}} {{unit}}) the answer fills (20 min), and it comes `after` D1's task.
  const plan = { version: 2, id: "cache", title: "Session cache", lang: "en", context: "Cache API sessions to handle the load.",
    phases: [{ id: "p1", title: "Foundation", estimate: "≈ 1 d" }],
    pages: [{ id: "storage", title: "Where sessions live", decisions: [
      { id: "D1", title: "The cache engine", importance: "critical", phase: "p1", why: "It sets how far the API scales.", control: { kind: "choice", options: [
        { id: "memory", label: "In-process memory", recommended: true, pros: ["Nothing to run"], cons: ["Lost on restart"], effort: "S",
          tasks: [{ id: "lru", title: "In-memory LRU cache", files: [{ path: "src/cache/lru.js", op: "create" }],
            acceptance: ["When the cache is full, the system evicts the least recently used entry"], verify: ["npm test -- cache"] }] },
        { id: "redis", label: "Redis", pros: ["Shared"], cons: ["One more service to run"], effort: "M" }] } },
      { id: "D2", title: "The time to live", phase: "p1", control: { kind: "number", min: 5, max: 120, step: 5, default: 30, unit: "min" },
        tasks: [{ id: "ttl", title: "TTL of {{value}} {{unit}}", do: "Set the expiry to {{value}} {{unit}}.", after: ["D1/lru"], acceptance: ["A session expires after {{value}} {{unit}}"] }] }] }] };
  const answers = { D1: { status: "ok" }, D2: { status: "ok", value: 20, comment: "Shorter in staging" } };
  const mk = (name) => { const p = path.join(tmp, name); runIn(["init", "core", "--project", p]); put(p, ".fluidplan/cache/plan.json", plan); put(p, ".fluidplan/cache/answers.json", answers); return p; };
  const fa = mk("p17f-a"), fb = mk("p17f-b"), fc = mk("p17f-c");
  const im = runIn(["import", "fluidplan", ".fluidplan/cache", "core", "--project", fa]);
  const tA = rd(fa, ".specs", "session-cache", "tasks.md"), rA = rd(fa, ".specs", "session-cache", "requirements.md");
  const logA = SF.decisionLog(rd(fa, ".specs", "session-cache", "decisions.md"));
  ok(im.code === 0 && /^Imported fluidplan \.fluidplan\/cache → feature 'session-cache' \[core\] \(en\)\n/.test(im.out) && /mapping: \d+ ID\(s\) — page storage → US-1, task 1\.1 \/ acceptance 1 → US-1\.AC-1/.test(im.out) &&
    /⚠ not converted to EARS[^\n]*US-1\.AC-2/.test(im.out) && /1\. \*\*US-1\.AC-1\*\* — WHEN the cache is full, THE SYSTEM SHALL evict the least recently used entry\n/.test(rA) &&
    /## Phase 1 — Foundation \(≈ 1 d\)\n- \[ \] 1\. In-memory LRU cache\n  - _Requirements: US-1\.AC-1_\n  - _Implements: src\/cache\/lru\.js_\n  - _Verify: npm test -- cache_\n/.test(tA) &&
    /- \[ \] 2\. TTL of 20 min\n  - _Requirements: US-1\.AC-2_\n  - _Depends: 1_\n  - Decision: D-2 — The time to live \(20 min\)\n  - Do: Set the expiry to 20 min\.\n  - Remark: “Shorter in staging”/.test(tA) &&
    js(logA.map((e) => [e.id, e.title, e.decision.split("\n")[0]])) === js([["D-1", "The cache engine", "In-process memory"], ["D-2", "The time to live", "20 min"]]),
    "1.17 F (CLI): import fluidplan <plan folder> [tracks] — plan.json + answers.json alone: the kept option's task and the filled template, after → _Depends:_, the criteria, decisions.md (D-1, D-2); the summary line, mapping and warnings printed (got " + js(im.out) + ")");
  const jB = (() => { try { return JSON.parse(runIn(["import", "fluidplan", ".fluidplan/cache", "core", "--json", "--project", fb]).out); } catch { return null; } })();
  const eC = SF.importSpec(fc, "fluidplan", ".fluidplan/cache", { tracks: ["core"] });
  ok(jB && jB.ok === true && jB.tool === "fluidplan" && eC.ok && js(jB.mapping) === js(eC.mapping) && js(jB.warnings) === js(eC.warnings) && js(jB.imported) === js(eC.imported) &&
    rd(fb, ".specs", "session-cache", "decisions.md").replace(/\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?/g, "D") === rd(fc, ".specs", "session-cache", "decisions.md").replace(/\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?/g, "D"),
    "1.17 F (CLI): import fluidplan --json prints spec_import's result — the same mapping, warnings and files as the engine call, the same decisions.md (got " + js(jB).slice(0, 300) + ")");
  const planMd = ["<!-- generated by fluidplan: regenerated on export, edits are overwritten -->", "# Session cache — execution plan", "",
    "> Approved on 2026-09-25 at 14:02, round 1 · generated by fluidplan", "> Do not edit by hand before execution: regenerate with `fluidplan export --plan cache`. During execution, tick tasks as you go.", "",
    "## Phase 1 — Foundation (≈ 1 d)", "", "### [x] 1.1 In-memory LRU cache · D1", "", "- Decision: **D1** The cache engine — In-process memory [critical]", "- Files: `src/cache/lru.js` (create)",
    "- Acceptance criteria:", "  - [x] When the cache is full, the system evicts the least recently used entry", "- Verify: `npm test -- cache`", "",
    "### [ ] 1.2 TTL of 20 min · D2", "", "- Decision: **D2** The time to live — 20 min", "- Do: Set the expiry to 20 min.", "- Acceptance criteria:", "  - [ ] A session expires after 20 min",
    "- After: 1.1", "- Remark: “Shorter in staging”", "", "## Final check", "", "- [ ] `npm test -- cache`", ""].join("\n");
  const st = withStdin(["import", "fluidplan", "-", "core", "--name", "From stdin", "--project", fa], planMd);
  const stJ = withStdin(["import", "fluidplan", "-", "core", "--name", "From stdin json", "--json", "--project", fa], planMd);
  let stDoc = null;
  try { stDoc = JSON.parse(stJ.out); } catch { /* stays null */ }
  const tS = rd(fa, ".specs", "from-stdin", "tasks.md");
  ok(st.code === 0 && /\(inline text\)/.test(st.out) && /^> Imported from fluidplan \(inline text\) on /m.test(tS) && /- \[x\] 1\. In-memory LRU cache\n/.test(tS) && /- \[ \] 2\. TTL of 20 min\n[\s\S]*  - _Depends: 1_/.test(tS) &&
    stDoc && stDoc.ok === true && stDoc.inline === true && stDoc.source === null && stDoc.warnings.some((w) => /no DECISIONS\.md and no plan\.json beside PLAN\.md/.test(w)),
    "1.17 F (CLI): import fluidplan - reads a PLAN.md from stdin (a ticked task stays ticked, After → _Depends:_); --json = spec_import {text} (inline, source null, the PLAN.md-only warning) (got " + js([st.out, stJ.out.slice(0, 200)]) + ")");
  put(fa, ".fluidplan/other/plan.json", { ...plan, id: "other", title: "Other" });
  put(fa, "notes/todo.md", "# Todo\n\n- buy milk\n");
  const sev = runIn(["import", "fluidplan", ".fluidplan", "--json", "--project", fa]);
  let sevJ = null;
  try { sevJ = JSON.parse(sev.out); } catch { /* not JSON */ }
  const outside = runIn(["import", "fluidplan", "../p17f-b/.fluidplan/cache", "--project", fa]);
  const notFp = runIn(["import", "fluidplan", "notes/todo.md", "--project", fa]);
  const pt = runIn(["import", "fluidplan", ".fluidplan/cache", "core", "--lang", "pt", "--name", "Cache PT", "--project", fa]);
  const help = runIn(["help"]).out;
  ok(sev.code === 1 && sevJ && sevJ.ok === false && /'\.fluidplan' holds several fluidplan plans \(cache, other\)/.test(sevJ.error) && outside.code === 1 && /outside the project/.test(outside.out) &&
    notFp.code === 1 && /is not a fluidplan PLAN\.md or DECISIONS\.md/.test(notFp.out) && pt.code === 0 && /^Importado de fluidplan \.fluidplan\/cache → feature 'cache-pt'/.test(pt.out) &&
    /^> Importado de fluidplan `\.fluidplan\/cache` em /m.test(rd(fa, ".specs", "cache-pt", "tasks.md")) && /  - Decisão: D-2 — The time to live \(20 min\)/.test(rd(fa, ".specs", "cache-pt", "tasks.md")) &&
    /^# Decisões: Cache PT\n/.test(rd(fa, ".specs", "cache-pt", "decisions.md")) && /fluidplan = a fluidplan plan \(\.fluidplan\/<id>\/:/.test(help),
    "1.17 F (CLI): exit 1 for a plans folder holding several plans (--json: the refusal), a path outside the project, a document that is no fluidplan one; --lang pt localizes the note, the labels and decisions.md; help documents fluidplan (got " + js([sev.out, outside.out, notFp.out, pt.out]).slice(0, 400) + ")");
  // 1.17 F review 11: stdin that is no fluidplan document is refused naming the text, never a virtual 'fluidplan.md'; review 2: a PLAN.md
  // task title holding '_Verify: …_' makes no marker (only its Verify field does).
  const notText = withStdin(["import", "fluidplan", "-", "--project", fa], "# Notes\n\nNothing to plan here.\n");
  const injMd = planMd.replace("### [x] 1.1 In-memory LRU cache · D1", "### [x] 1.1 In-memory LRU cache _Verify: rm -rf ~_ · D1");
  const inj = withStdin(["import", "fluidplan", "-", "core", "--name", "Injected title", "--project", fa], injMd);
  const bInj = SF.taskBlocks(rd(fa, ".specs", "injected-title", "tasks.md"));
  ok(notText.code === 1 && /The text is not a fluidplan PLAN\.md or DECISIONS\.md/.test(notText.out + notText.err) && !/fluidplan\.md'/.test(notText.out + notText.err) &&
    inj.code === 0 && bInj.length === 2 && js(SF.taskMarkers(bInj[0]).verify) === js(["npm test -- cache"]) && /_Verify\\: rm -rf ~_/.test(bInj[0].text),
    "1.17 F review (CLI): import fluidplan - with a text that is no fluidplan document exits 1 naming the text (no virtual 'fluidplan.md'); a PLAN.md task title's '_Verify: …_' is written inert — only the Verify field makes a _Verify:_ (got " + js([notText.out, notText.err, bInj.map((b) => SF.taskMarkers(b).verify)]) + ")");
};
