#!/usr/bin/env node
"use strict";

/**
 * Smoke test for the local MCP server. Spawns server.js, drives the MCP
 * handshake over stdio, exercises every tool against a throwaway temp project,
 * and asserts the results. Run: `node mcp/test.js`
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SERVER = path.join(__dirname, "server.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spec-test-"));

let pass = 0,
  fail = 0;
function ok(cond, label) {
  if (cond) {
    pass++;
    console.log("  ok   - " + label);
  } else {
    fail++;
    console.log("  FAIL - " + label);
  }
}

const child = spawn(process.execPath, [SERVER], {
  env: { ...process.env, SPEC_PROJECT_DIR: tmp },
  stdio: ["pipe", "pipe", "inherit"],
});

const pending = new Map();
let buf = "";
child.stdout.on("data", (d) => {
  buf += d.toString();
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let idc = 1;
function rpc(method, params) {
  const id = idc++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}
function payload(res) {
  return JSON.parse(res.result.content[0].text);
}

(async () => {
  const init = await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {} });
  ok(init.result && init.result.serverInfo.name === "dev-spec-driven", "initialize returns serverInfo");
  notify("notifications/initialized", {});

  const list = await rpc("tools/list", {});
  ok(list.result.tools.length === 21, "tools/list returns 21 tools (got " + list.result.tools.length + ")");

  const cls = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "Stripe billing webhook for multi-tenant SaaS that also summarizes invoices with an LLM" } }));
  ok(cls.tracks.includes("tdd") && cls.tracks.includes("saas") && cls.tracks.includes("ai"), "classify detects tdd+saas+ai (" + cls.label + ")");

  const init2 = payload(await rpc("tools/call", { name: "spec_init", arguments: { tracks: ["tdd", "saas", "ai"] } }));
  ok(init2.created.includes("scale.md") && init2.created.includes("ai-strategy.md") && init2.created.includes("testing-standards.md"), "spec_init creates track-specific steering files");

  const created = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Invoice Summary", tracks: ["tdd", "saas", "ai"], summary: "Summarize invoices per tenant" } }));
  ok(created.ok && created.slug === "invoice-summary", "spec_create makes feature folder");
  ok(created.created.includes("test-plan.md") && created.created.includes("eval-plan.md") && created.created.includes("load-test.md"), "spec_create writes track artifacts");

  const status = payload(await rpc("tools/call", { name: "spec_status", arguments: { name: "Invoice Summary" } }));
  ok(status.ok && status.tasks.total > 0, "spec_status reports tasks (" + status.tasks.total + ")");
  ok(Array.isArray(status.scaleSections) && status.scaleSections.length === 5, "spec_status lists 5 scale sections");

  const next = payload(await rpc("tools/call", { name: "spec_next_task", arguments: { name: "Invoice Summary" } }));
  ok(next.ok && next.next && next.next.number === 1, "spec_next_task returns task 1");

  const done = payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: "Invoice Summary", number: 1 } }));
  ok(done.ok && done.done === 1, "spec_complete_task marks task 1 done");

  const next2 = payload(await rpc("tools/call", { name: "spec_next_task", arguments: { name: "Invoice Summary" } }));
  ok(next2.next && next2.next.number === 2, "next task advances to 2");

  const ears = payload(await rpc("tools/call", { name: "ears_validate", arguments: { text: "1. **US-1.AC-1** — WHEN a user clicks submit THE SYSTEM SHALL validate input\n2. The response should be fast and user-friendly" } }));
  ok(ears.ok && ears.verdict === "fail", "ears_validate flags the bad criterion");
  ok(ears.issues.some((i) => /SHALL/.test(i.msg)) && ears.issues.some((i) => /Vague/.test(i.msg)), "ears_validate reports SHALL + vague issues");

  const trace = payload(await rpc("tools/call", { name: "trace_check", arguments: { name: "Invoice Summary" } }));
  ok(trace.ok && typeof trace.totalAcs === "number", "trace_check runs (acs=" + trace.totalAcs + ", uncovered=" + trace.uncoveredByTasks.length + ")");

  const listFeat = payload(await rpc("tools/call", { name: "spec_list", arguments: {} }));
  ok(listFeat.features.length === 1 && listFeat.features[0].name === "invoice-summary", "spec_list shows the feature");

  // --- new: classifier negation + confidence ---
  const neg = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "Build a simple CRUD admin page with no auth and without any LLM" } }));
  ok(!neg.tracks.includes("tdd") && !neg.tracks.includes("ai"), "classify respects negation (no auth / no LLM → core only: " + neg.label + ")");
  ok(neg.confidence && typeof neg.confidence.tdd === "string", "classify returns confidence levels");

  // --- new: Portuguese classification ---
  const ptc = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "Webhook de faturação multi-inquilino com resumo gerado por um LLM" } }));
  ok(ptc.tracks.includes("tdd") && ptc.tracks.includes("saas") && ptc.tracks.includes("ai"), "classify works in Portuguese (" + ptc.label + ")");

  // --- new: weighting — a single weak signal is 'possible', not auto-enabled ---
  const wk = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "Build an agent dashboard for the internal team" } }));
  ok(!wk.tracks.includes("ai"), "single weak signal does NOT auto-enable a track");
  ok(Array.isArray(wk.possible) && wk.possible.some((p) => p.track === "ai"), "single weak signal is surfaced as 'possible' (+ai via 'agent')");

  // --- new: EARS recognizes PT modal (DEVE) + PT vague word ---
  const ptEars = payload(await rpc("tools/call", { name: "ears_validate", arguments: { text: "1. **US-1.AC-1** — QUANDO o utilizador submete, O SISTEMA DEVE validar os dados\n2. A resposta deve ser rápida e amigável" } }));
  ok(ptEars.summary.criteriaDetected === 2 && ptEars.summary.withShall === 2, "EARS accepts PT modal DEVE (2 criteria, 2 with modal)");
  ok(ptEars.verdict === "pass" && ptEars.issues.some((i) => i.msg.includes("amigável")), "EARS passes PT (no SHALL error) and flags PT vague 'amigável'");

  // --- regression: a criterion is a LOGICAL unit, not a physical line. EARS phrasing wraps
  //     ("WHILE … WHEN … THE SYSTEM SHALL …"); a line-based parser scored each half separately
  //     (ID half → "no modal verb" error, modal half → "no stable ID" warn). ---
  const wrapped = payload(await rpc("tools/call", { name: "ears_validate", arguments: { text:
    "## Acceptance Criteria\n\n" +
    "1. **US-1.AC-1** — WHEN a user submits the form THE SYSTEM SHALL validate every field\n" +
    "2. **US-2.AC-2** — IF the access token has expired, THEN\n" +
    "   THE SYSTEM SHALL return HTTP 401 with the code TOKEN_EXPIRED\n" +
    "3. **US-2.AC-3** — WHILE an upload is in progress,\n" +
    "   THE SYSTEM SHALL display the completed percentage\n" } }));
  ok(wrapped.summary.criteriaDetected === 3, "wrapped EARS criteria count once each (got " + wrapped.summary.criteriaDetected + ", want 3)");
  ok(wrapped.summary.withShall === 3 && wrapped.summary.withStableId === 3, "wrapped criteria keep their modal + stable ID (shall=" + wrapped.summary.withShall + ", id=" + wrapped.summary.withStableId + ")");
  ok(wrapped.verdict === "pass" && wrapped.issues.length === 0, "wrapped criteria raise no spurious issues (got " + wrapped.issues.length + ")");
  const wrappedPt = payload(await rpc("tools/call", { name: "ears_validate", arguments: { text:
    "1. **US-1.AC-1** — QUANDO o utilizador submete o formulário, O SISTEMA DEVE validar os campos\n" +
    "2. **US-2.AC-2** — SE o token expirou, ENTÃO\n" +
    "   O SISTEMA DEVE devolver um erro 401 com o código TOKEN_EXPIRED\n" } }));
  ok(wrappedPt.summary.criteriaDetected === 2 && wrappedPt.verdict === "pass", "wrapped PT criteria validate as 2 passing criteria");
  ok(wrapped.issues.filter((i) => i.severity === "error").length === 0, "no 'missing modal verb' error from a wrapped criterion");
  // Block-level constructs bound a criterion: fenced code is code (a `const shall = 1` line is not
  // an AC), a heading ends the criterion, and a comment-only line does not split one.
  const bounded = payload(await rpc("tools/call", { name: "ears_validate", arguments: { text:
    "1. **US-1.AC-1** — WHEN x THE SYSTEM SHALL y\n```ts\nconst shall = 1;\n```\n## Out of Scope\nEverything else" } }));
  ok(bounded.summary.criteriaDetected === 1, "fenced code + heading bound the criterion (got " + bounded.summary.criteriaDetected + ", want 1)");
  const commented = payload(await rpc("tools/call", { name: "ears_validate", arguments: { text:
    "1. **US-1.AC-1** — IF the token expired, THEN\n<!-- reviewer: check this -->\n   THE SYSTEM SHALL return HTTP 401" } }));
  ok(commented.summary.criteriaDetected === 1 && commented.verdict === "pass", "a comment-only line does not split a criterion");
  const vagueWrap = payload(await rpc("tools/call", { name: "ears_validate", arguments: { text:
    "1. **US-1.AC-1** — WHEN a page loads,\n   THE SYSTEM SHALL render it fast" } }));
  ok((vagueWrap.issues.find((i) => /Vague/.test(i.msg)) || {}).line === 1, "a vague term on a continuation line is reported at the criterion's start line");

  // --- regression: signals are matched as WORDS, not substrings. `indexOf` fired 'claude'
  //     inside '.claude-plugin', 'rag' inside 'storage', 'sla' inside 'translate', 'auth'
  //     inside 'author' — a phantom STRONG signal silently masked the negation it computed. ---
  const fp = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "Fix the duplicate hooks key in .claude-plugin/plugin.json. No LLM involved — this is pure JSON parsing." } }));
  ok(!fp.tracks.includes("ai"), "classify does not fire +ai on 'claude' inside '.claude-plugin/plugin.json' (" + fp.label + ")");
  ok(/negated/i.test(fp.note || ""), "classify reports the negated 'llm' it computed");
  const subs = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "Add object storage for uploaded files, translate the UI into Spanish, and show the author name on each post." } }));
  ok(subs.tracks.length === 1 && subs.tracks[0] === "core", "no phantom tracks from storage/translate/author substrings (got " + subs.label + ")");
  // …but real signals must still match, including inflections, versions and hyphenated adjectives.
  const kept = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "An AI-powered assistant on GPT-4 and Claude: reduce hallucinations, add guardrails, and log token cost." } }));
  ok(kept.tracks.includes("ai"), "classify still detects +ai from 'AI-powered', 'GPT-4', 'Claude', 'hallucinations' (" + kept.label + ")");
  const infl = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "Process Stripe payments and refunds, replay webhooks idempotently, and enforce rate-limiting per tenant." } }));
  ok(infl.tracks.includes("tdd") && infl.tracks.includes("saas"), "classify matches inflected keywords (payments/webhooks/idempotently/rate-limiting) (" + infl.label + ")");
  const conflict = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "Summarize support tickets with an LLM and detect hallucinations, but no auth is needed for this internal page." } }));
  ok(conflict.tracks.includes("ai") && !conflict.tracks.includes("tdd"), "negation suppresses only the negated track (+ai on, +tdd off: " + conflict.label + ")");

  // --- new: spec_doctor flags unfilled mandatory sections on a fresh scaffold ---
  const doc = payload(await rpc("tools/call", { name: "spec_doctor", arguments: { name: "Invoice Summary" } }));
  ok(doc.ok && doc.verdict === "fail" && doc.readyToAdvance === false, "spec_doctor flags fresh scaffold as not ready (verdict=" + doc.verdict + ")");
  ok(doc.checks.some((c) => c.id === "saas-sections" && c.status === "fail") && doc.checks.some((c) => c.id === "ai-sections" && c.status === "fail"), "spec_doctor detects unfilled +saas and +ai sections");

  // --- new: spec_approve records a phase gate, surfaced by doctor ---
  const appr = payload(await rpc("tools/call", { name: "spec_approve", arguments: { name: "Invoice Summary", phase: "requirements" } }));
  ok(appr.ok && appr.approvals.requirements, "spec_approve records the requirements gate");
  const doc2 = payload(await rpc("tools/call", { name: "spec_doctor", arguments: { name: "Invoice Summary" } }));
  ok(doc2.approvals && doc2.approvals.requirements, "spec_doctor surfaces recorded approvals");

  // --- new: bidirectional trace_check fields present ---
  const tr2 = payload(await rpc("tools/call", { name: "trace_check", arguments: { name: "Invoice Summary" } }));
  ok(Array.isArray(tr2.phantomAcsInTasks), "trace_check reports phantom AC refs (reverse direction)");
  ok(Array.isArray(tr2.implementsFiles) && Array.isArray(tr2.missingImplFiles), "trace_check reports spec↔code (_Implements:_) fields");

  // --- new (sdd-skill ideas): roadmap + dependencies + cycle ---
  await rpc("tools/call", { name: "spec_create", arguments: { name: "User Auth", tracks: ["tdd"] } });
  const dep = payload(await rpc("tools/call", { name: "spec_depend", arguments: { name: "Invoice Summary", dependsOn: ["user-auth"] } }));
  ok(dep.ok && dep.dependsOn[0] === "user-auth", "spec_depend declares a dependency");
  const cyc = payload(await rpc("tools/call", { name: "spec_depend", arguments: { name: "User Auth", dependsOn: ["invoice-summary"] } }));
  ok(cyc.ok === false && /Circular/.test(cyc.error), "spec_depend rejects a cycle");
  const rm = payload(await rpc("tools/call", { name: "spec_roadmap", arguments: {} }));
  ok(rm.ok && rm.total === 2 && typeof rm.overallPercent === "number", "spec_roadmap returns the multi-feature view");
  ok(rm.features.find((f) => f.name === "invoice-summary").blocked === true, "roadmap marks blocked feature (unmet dep)");

  // --- ROADMAP.md generator + backlog + auto-regen ---
  const bk = payload(await rpc("tools/call", { name: "spec_backlog", arguments: { action: "add", name: "sso-login", note: "SAML SSO" } }));
  ok(bk.ok && bk.backlog.some((b) => b.name === "sso-login"), "spec_backlog add records a planned feature");
  const wr = payload(await rpc("tools/call", { name: "spec_roadmap", arguments: { write: true, html: true, lang: "pt" } }));
  ok(wr.wrote && fs.existsSync(path.join(tmp, ".specs", "ROADMAP.md")) && fs.existsSync(path.join(tmp, ".specs", "ROADMAP.html")), "spec_roadmap write generates ROADMAP.md (default) + ROADMAP.html (html:true)");
  const rmMd = fs.readFileSync(path.join(tmp, ".specs", "ROADMAP.md"), "utf8");
  ok(/## Features/.test(rmMd) && /```mermaid/.test(rmMd) && /sso-login/.test(rmMd) && /Progresso/.test(rmMd), "ROADMAP.md (default) keeps Mermaid graph + backlog, localized PT");
  const rmHtml = fs.readFileSync(path.join(tmp, ".specs", "ROADMAP.html"), "utf8");
  ok(/#11689B/.test(rmHtml) && /prefers-color-scheme/.test(rmHtml) && /localStorage/.test(rmHtml) && !/https?:\/\//.test(rmHtml), "ROADMAP.html is brand-styled, system-default + toggle, zero external deps");
  await rpc("tools/call", { name: "spec_complete_task", arguments: { name: "User Auth", number: 1 } });
  ok(/🟡/.test(fs.readFileSync(path.join(tmp, ".specs", "ROADMAP.md"), "utf8")), "ROADMAP.md auto-regenerates on spec_complete_task (no write)");

  // --- regression: progress % reflects real task completion, not just the phase. A fully-planned
  //     but unimplemented feature (phase "tasks-ready", 0 tasks done) used to read as a flat 70%,
  //     even though implementation — the bulk of the work — had not started. Planning now tops out
  //     at the planning ceiling (30%) and the executing phase is driven by the real done/total. ---
  const progDir = path.join(tmp, ".specs", "progress-demo");
  fs.mkdirSync(progDir, { recursive: true });
  fs.writeFileSync(path.join(progDir, "requirements.md"), "# Requirements\n", "utf8");
  fs.writeFileSync(path.join(progDir, "design.md"), "# Design\n", "utf8");
  const fourTasks = (doneCount) =>
    "# Tasks\n\n" + [1, 2, 3, 4].map((n) => `- [${n <= doneCount ? "x" : " "}] ${n}. Task ${n}`).join("\n") + "\n";
  const pctOf = async (name) =>
    (payload(await rpc("tools/call", { name: "spec_roadmap", arguments: {} })).features.find((f) => f.name === name) || {});
  fs.writeFileSync(path.join(progDir, "tasks.md"), fourTasks(0), "utf8");
  let pf = await pctOf("progress-demo");
  ok(pf.phase === "tasks-ready" && pf.percent === 30, "tasks-ready (0/4 done) reads as planning ceiling 30%, not 70% (got " + pf.percent + ")");
  fs.writeFileSync(path.join(progDir, "tasks.md"), fourTasks(2), "utf8");
  pf = await pctOf("progress-demo");
  ok(pf.phase === "executing" && pf.percent === 65, "executing 2/4 done interpolates to 65% (got " + pf.percent + ")");
  fs.writeFileSync(path.join(progDir, "tasks.md"), fourTasks(4), "utf8");
  pf = await pctOf("progress-demo");
  ok(pf.phase === "complete" && pf.percent === 100, "all tasks done → complete → 100%");
  // Clean up so the added feature does not perturb later whole-roadmap assertions.
  fs.rmSync(progDir, { recursive: true, force: true });

  // --- new: brownfield scan + coverage (scan the real repo, not the empty temp project) ---
  const repoRoot = path.resolve(__dirname, "..");
  const scan = payload(await rpc("tools/call", { name: "spec_scan", arguments: { projectDir: repoRoot, cap: 1500 } }));
  ok(scan.ok && scan.filesScanned > 0 && Array.isArray(scan.topLevelDirs), "spec_scan inventories the codebase");
  const cov = payload(await rpc("tools/call", { name: "spec_coverage", arguments: {} }));
  ok(cov.ok && typeof cov.coveragePercent === "number", "spec_coverage returns a percentage");

  // --- new: clarify ---
  const cl = payload(await rpc("tools/call", { name: "spec_clarify", arguments: { name: "Invoice Summary" } }));
  ok(cl.ok && Array.isArray(cl.questions) && cl.questions.length > 0, "spec_clarify surfaces clarification questions");

  // --- v1.5 (spec-kit ideas): prioritized stories, success criteria, clarification gate, constitution check ---
  const reqV15 = payload(await rpc("tools/call", { name: "ears_validate", arguments: { name: "Invoice Summary" } }));
  ok(typeof reqV15.summary.needsClarification === "number" && reqV15.summary.needsClarification === 0, "scaffold requirements have 0 open [NEEDS CLARIFICATION]");
  const doc3 = payload(await rpc("tools/call", { name: "spec_doctor", arguments: { name: "Invoice Summary" } }));
  ok(["success-criteria", "priorities", "clarifications", "constitution-check", "ac-uniqueness"].every((id) => doc3.checks.some((c) => c.id === id)), "spec_doctor includes v1.5 checks");
  ok(doc3.checks.find((c) => c.id === "success-criteria").status === "pass" && doc3.checks.find((c) => c.id === "priorities").status === "pass", "scaffold has SC + P1 (success-criteria & priorities pass)");

  // --- multilingual: a PT-headed design passes the +saas/Constitution checks ---
  await rpc("tools/call", { name: "spec_create", arguments: { name: "Escala PT", tracks: ["saas"] } });
  const ptDesign = [
    "# Design: Escala PT", "", "## Visão Geral", "Resumo.", "",
    "## Arquitetura", "```mermaid", "graph TD", "  A-->B", "```", "",
    "## Verificação da Constituição", "- [x] Isolamento de inquilino respeitado.", "",
    "## Orçamento de Desempenho", "P95 < 50ms, throughput 500 rps.", "",
    "## Design de Escala", "Cache com TTL 60s; índices em (tenant_id).", "",
    "## Modelo Multi-inquilino", "Pooled; todas as queries com tenant_id.", "",
    "## Observabilidade", "Métricas req_duration_seconds; alertas.", "",
    "## Envelope de Custo", "$0,002 / 1000 pedidos.", "",
  ].join("\n");
  fs.writeFileSync(path.join(tmp, ".specs", "escala-pt", "design.md"), ptDesign, "utf8");
  const ptDoc = payload(await rpc("tools/call", { name: "spec_doctor", arguments: { name: "Escala PT" } }));
  ok(ptDoc.checks.find((c) => c.id === "saas-sections").status === "pass", "doctor accepts the 5 +saas sections written in Portuguese");
  ok(ptDoc.checks.find((c) => c.id === "constitution-check").status === "pass", "doctor accepts a Portuguese 'Verificação da Constituição' heading");

  // --- v1.8: approval gates are a real gate ---
  const gateDoc = payload(await rpc("tools/call", { name: "spec_doctor", arguments: { name: "User Auth" } }));
  ok(gateDoc.checks.some((c) => c.id === "approval-gates") && gateDoc.gatesOk === false && gateDoc.pendingGates.includes("requirements"), "doctor reports pending approval gates (gatesOk=false)");

  // --- v1.8: spec_add_track escalates an existing feature (additive, never overwrites) ---
  const addTr = payload(await rpc("tools/call", { name: "spec_add_track", arguments: { name: "User Auth", track: "saas" } }));
  ok(addTr.ok && addTr.added.includes("load-test.md") && /saas/.test(addTr.tracks), "spec_add_track adds +saas artifacts to an existing feature");
  ok(fs.readFileSync(path.join(tmp, ".specs", "user-auth", "design.md"), "utf8").includes("[SaaS]"), "spec_add_track appends the +saas design sections");
  const addTr2 = payload(await rpc("tools/call", { name: "spec_add_track", arguments: { name: "User Auth", track: "saas" } }));
  ok(addTr2.ok && addTr2.added.length === 0, "spec_add_track is idempotent (no duplicate scaffolding)");

  // --- v1.8: spec_next_action synthesizes a recommendation + changed-since-approval ---
  const na = payload(await rpc("tools/call", { name: "spec_next_action", arguments: { name: "User Auth" } }));
  ok(na.ok && typeof na.recommendation === "string" && Array.isArray(na.changedSinceApproval), "spec_next_action returns a recommendation + changedSinceApproval");

  // --- v1.8: spec_feature remove / archive / rename keep roadmap.json consistent ---
  await rpc("tools/call", { name: "spec_create", arguments: { name: "Throwaway", tracks: ["core"] } });
  const ren = payload(await rpc("tools/call", { name: "spec_feature", arguments: { action: "rename", name: "Throwaway", newName: "Renamed Feature" } }));
  ok(ren.ok && ren.to === "renamed-feature" && fs.existsSync(path.join(tmp, ".specs", "renamed-feature")), "spec_feature rename moves the folder + slug");
  const arch = payload(await rpc("tools/call", { name: "spec_feature", arguments: { action: "archive", name: "renamed-feature" } }));
  ok(arch.ok && fs.existsSync(path.join(tmp, ".specs", "_archive", "renamed-feature")), "spec_feature archive moves to .specs/_archive/");
  const listAfter = payload(await rpc("tools/call", { name: "spec_list", arguments: {} }));
  ok(!listAfter.features.some((f) => f.name === "renamed-feature" || f.name === "_archive"), "archived feature (and _archive) are hidden from spec_list");
  const rmRes = payload(await rpc("tools/call", { name: "spec_feature", arguments: { action: "remove", name: "Escala PT" } }));
  ok(rmRes.ok && !fs.existsSync(path.join(tmp, ".specs", "escala-pt")), "spec_feature remove deletes the folder");

  // --- trilingual: project language cascades to steering + generated artifacts (PT) ---
  const ptDir = path.join(tmp, "proj-pt");
  const ptInit = payload(await rpc("tools/call", { name: "spec_init", arguments: { tracks: ["saas", "ai"], lang: "pt", projectDir: ptDir } }));
  ok(ptInit.lang === "pt" && typeof ptInit.note === "string", "spec_init lang:pt sets the project language");
  const ptConst = fs.readFileSync(path.join(ptDir, ".specs", "steering", "constitution.md"), "utf8");
  ok(/# Constituição/.test(ptConst) && /Princípios/.test(ptConst), "spec_init lang:pt writes Portuguese steering");
  const ptFeat = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Resumo Faturas", tracks: ["saas", "ai"], projectDir: ptDir } }));
  ok(ptFeat.ok && ptFeat.lang === "pt", "spec_create inherits the project language (pt)");
  const ptReq = fs.readFileSync(path.join(ptDir, ".specs", "resumo-faturas", "requirements.md"), "utf8");
  ok(/## Histórias de Utilizador/.test(ptReq) && /US-1\.AC-1/.test(ptReq) && /O SISTEMA DEVE/.test(ptReq), "PT requirements: localized headings, stable AC IDs, PT EARS modal");
  const ptDes = fs.readFileSync(path.join(ptDir, ".specs", "resumo-faturas", "design.md"), "utf8");
  ok(/\[SaaS\]/.test(ptDes) && /\[AI\]/.test(ptDes) && /Orçamento de Desempenho/.test(ptDes) && /> \*\*TODO\*\*/.test(ptDes), "PT design keeps [SaaS]/[AI]/TODO markers with localized headings");
  const ptDoc2 = payload(await rpc("tools/call", { name: "spec_doctor", arguments: { name: "Resumo Faturas", projectDir: ptDir } }));
  ok(ptDoc2.checks.find((c) => c.id === "saas-sections").status === "fail" && /aguardar aprova/i.test(ptDoc2.checks.find((c) => c.id === "approval-gates").detail), "doctor runs on the PT feature with localized messages");
  const ptClar = payload(await rpc("tools/call", { name: "spec_clarify", arguments: { name: "Resumo Faturas", projectDir: ptDir } }));
  ok(ptClar.questions.some((s) => /na linha|teto de custo|limites de taxa/.test(s)), "spec_clarify returns Portuguese questions for a PT feature");

  // --- trilingual: Spanish project, and per-feature override of the project default ---
  const esDir = path.join(tmp, "proj-es");
  await rpc("tools/call", { name: "spec_init", arguments: { tracks: ["tdd"], lang: "es", projectDir: esDir } });
  const esFeat = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Inicio Sesion", tracks: ["tdd"], projectDir: esDir } }));
  ok(esFeat.ok && esFeat.lang === "es", "spec_create inherits the project language (es)");
  const esReq = fs.readFileSync(path.join(esDir, ".specs", "inicio-sesion", "requirements.md"), "utf8");
  ok(/## Historias de Usuario/.test(esReq) && /EL SISTEMA DEBE/.test(esReq), "ES requirements: localized headings + ES EARS modal");
  const esTasks = fs.readFileSync(path.join(esDir, ".specs", "inicio-sesion", "tasks.md"), "utf8");
  ok(/\[US1\]/.test(esTasks) && /## Fase: Setup/.test(esTasks), "ES tasks keep [US1] tags with localized phase headings");
  const enOver = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Override EN", tracks: ["core"], lang: "en", projectDir: ptDir } }));
  const enOverReq = fs.readFileSync(path.join(ptDir, ".specs", "override-en", "requirements.md"), "utf8");
  ok(enOver.lang === "en" && /## User Stories/.test(enOverReq), "per-feature lang overrides the project default (EN feature in a PT project)");

  // --- v1.8: projectDir traversal is rejected at the MCP boundary ---
  const trav = payload(await rpc("tools/call", { name: "spec_list", arguments: { projectDir: "../../etc" } }));
  ok(trav.ok === false && /\.\./.test(trav.error), "MCP rejects projectDir with '..' segments");

  child.stdin.end();
  console.log(`\n${pass} passed, ${fail} failed`);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  process.exit(fail ? 1 : 0);
})();
