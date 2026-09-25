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
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      cb(msg);
    } else if ((msg.id === null || Array.isArray(msg)) && rawWaiters.length) {
      rawWaiters.shift()(msg);
    }
  }
});

// A server that dies or stops answering must FAIL the suite — never let the event loop drain and exit 0.
function abort(reason) {
  console.log("  FAIL - " + reason);
  console.log(`\n${pass} passed, ${fail + 1} failed`);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  process.exit(1);
}
let finished = false;
child.on("exit", (code) => { if (!finished) abort("MCP server exited early (code " + code + ") with " + pending.size + " request(s) pending"); });

let idc = 1;
function rpc(method, params) {
  const id = idc++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => abort(`no reply to ${method} (id ${id}) within 15s`), 15000);
    pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
// Raw line → first reply (for malformed-input tests, where the reply id is null).
function rawOnce(line) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => abort("no reply to raw line " + JSON.stringify(line)), 15000);
    rawWaiters.push((msg) => { clearTimeout(timer); resolve(msg); });
    child.stdin.write(line + "\n");
  });
}
const rawWaiters = [];
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
  ok(list.result.tools.length >= 23, "tools/list returns at least the 23 v1.12 tools (got " + list.result.tools.length + ")"); // exact count restored at release

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
  // 1.13: the requirements are still the template, so the gate refuses them — force records a flagged approval.
  const appr = payload(await rpc("tools/call", { name: "spec_approve", arguments: { name: "Invoice Summary", phase: "requirements", force: true } }));
  ok(appr.ok && appr.approvals.requirements && appr.approvals.requirements.forced === true, "spec_approve records the requirements gate (forced over the template's failing checks)");
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
  ok(doc3.checks.find((c) => c.id === "success-criteria").status === "warn" && doc3.checks.find((c) => c.id === "priorities").status === "warn",
    "1.13: the scaffold's placeholder SC-001 and its P1 legend don't pass success-criteria & priorities while still template");

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
  const rmRes = payload(await rpc("tools/call", { name: "spec_feature", arguments: { action: "remove", name: "Escala PT", confirm: true } })); // 1.13: remove needs confirm
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

  // --- v1.11: spec_task_brief — a self-contained brief per task (subagent-driven execution) ---
  const bDir = path.join(tmp, "proj-brief");
  await rpc("tools/call", { name: "spec_create", arguments: { name: "Brief Demo", tracks: ["tdd"], projectDir: bDir } });
  const bFeat = path.join(bDir, ".specs", "brief-demo");
  fs.writeFileSync(path.join(bFeat, "requirements.md"), [
    "# Feature: brief-demo", "", "## User Stories", "",
    "### US-1 (P1 — MVP): Create keys",
    "**As a** tenant admin, **I want** API keys, **so that** scripts can authenticate.", "",
    "#### Acceptance Criteria (EARS)",
    "1. **US-1.AC-1** — WHEN an admin creates a key",
    "   THE SYSTEM SHALL return the token exactly once.",
    "2. **US-1.AC-2** — IF the key is revoked THEN THE SYSTEM SHALL reject it with 401.",
    "3. **US-1.AC-10** — THE SYSTEM SHALL log every key creation.", "",
    "<!-- **US-9.AC-9** — WHEN example THE SYSTEM SHALL be ignored -->", "",
  ].join("\r\n")); // CRLF on purpose (EC-1)
  fs.writeFileSync(path.join(bFeat, "test-plan.md"), [
    "# Test Plan: brief-demo", "",
    "| Test ID | Layer | Description | Covers (AC IDs) | File |",
    "|---------|-------|-------------|-----------------|------|",
    "| T-01 | unit | token returned once | US-1.AC-1 | `tests/unit/keys.test.js` |",
    "| T-02 | integration | revoked key rejected | US-1.AC-2 | `tests/integration/keys.test.js` |",
    "| T-10 | unit | creation logged | US-1.AC-10 | `tests/unit/log.test.js` |", "",
  ].join("\n"));
  fs.writeFileSync(path.join(bFeat, "tasks.md"), [
    "# Tasks: brief-demo", "",
    "## Phase: Setup",
    "- [x] 1. [shared] Scaffold the module", "",
    "## Story US-1 (P1 — MVP)",
    "- [ ] 2. [US1][P] Create-key endpoint (token shown once)",
    "  - _Requirements: US-1.AC-1_",
    "  - _Makes green: T-01_",
    "  - _Implements: src/keys.js_",
    "- [ ] 3. [US1] Revocation",
    "  - _Requirements: US-1.AC-2, US-7.AC-9_",
    "  - _Makes green: T-02, T-99_",
    "**Checkpoint:** US-1 is independently shippable.", "",
  ].join("\n"));
  const brief = (args) => rpc("tools/call", { name: "spec_task_brief", arguments: { projectDir: bDir, ...args } }).then(payload);

  const b2 = await brief({ name: "Brief Demo", number: 2 }); // T-01
  ok(b2.ok && b2.task.number === 2 && b2.task.story === "US1" && b2.task.parallel === true,
    "spec_task_brief returns the task with its story and [P] flag");
  ok(b2.acceptanceCriteria.length === 1 && b2.acceptanceCriteria[0].id === "US-1.AC-1" &&
    /WHEN an admin creates a key THE SYSTEM SHALL return the token exactly once/.test(b2.acceptanceCriteria[0].text),
    "spec_task_brief resolves the full (multi-line, CRLF) EARS text of each referenced AC");
  ok(/Create-key endpoint/.test(b2.brief) && /US-1\.AC-1/.test(b2.brief) && /As a\*\* tenant admin/.test(b2.brief) &&
    /Story US-1/.test(b2.task.phase) && /independently shippable/.test(b2.task.checkpoint),
    "brief carries the task text, story context, phase and closing checkpoint");
  ok(b2.loop === "tdd" && b2.tests.length === 1 && /token returned once/.test(b2.tests[0].row) && /T-01/.test(b2.brief), // T-02
    "+tdd brief includes the test-plan row of each T-ID and the tdd loop");
  ok(!/log every key creation/.test(b2.brief) && !b2.tests.some((t) => t.id === "T-10") && b2.implements[0] === "src/keys.js", // T-04
    "AC-1 / T-01 never resolve to AC-10 / T-10 (prefix collision); _Implements:_ parsed");
  const b3 = await brief({ name: "Brief Demo", number: 3 });
  ok(b3.ok && b3.unresolved.acs.includes("US-7.AC-9") && b3.unresolved.tests.includes("T-99") && b3.acceptanceCriteria.length === 1,
    "unknown AC/T IDs are listed as unresolved instead of failing");
  const bNext = await brief({ name: "Brief Demo" }); // T-03
  ok(bNext.ok && bNext.task.number === 2, "spec_task_brief defaults to the next open task");
  const bMissing = await brief({ name: "Brief Demo", number: 42 }); // T-05
  ok(bMissing.ok === false && /42/.test(bMissing.error), "spec_task_brief rejects a task number that doesn't exist");

  const bw = await brief({ name: "Brief Demo", number: 2, write: true }); // T-06
  const exDir = path.join(bFeat, ".execution");
  ok(bw.ok && bw.wrote === true && bw.brief === undefined && fs.existsSync(path.join(exDir, "task-2-brief.md")) &&
    fs.readFileSync(path.join(exDir, ".gitignore"), "utf8").trim() === "*" && fs.existsSync(bw.paths.ledger) && /task-2-report\.md$/.test(bw.paths.report),
    "write:true writes the brief + self-ignoring .execution/ + ledger and returns paths, not content");
  fs.appendFileSync(bw.paths.ledger, "Task 2: complete (commits a..b, review clean)\n");
  await brief({ name: "Brief Demo", number: 2, write: true });
  ok(/Task 2: complete/.test(fs.readFileSync(bw.paths.ledger, "utf8")), "a second write never overwrites the ledger");

  await rpc("tools/call", { name: "spec_create", arguments: { name: "Brief PT", tracks: ["tdd"], lang: "pt", projectDir: bDir } }); // T-07
  const bpt = await brief({ name: "Brief PT", number: 2 });
  ok(bpt.ok && bpt.lang === "pt" && /Critérios de aceitação/.test(bpt.brief) && /US-1\.AC-1/.test(bpt.brief) && /O SISTEMA DEVE/.test(bpt.brief),
    "brief is generated in the feature language (PT) with English-stable IDs");

  await rpc("tools/call", { name: "spec_create", arguments: { name: "Brief AI", tracks: ["ai"], projectDir: bDir } }); // T-08
  fs.writeFileSync(path.join(bDir, ".specs", "brief-ai", "tasks.md"),
    "# Tasks\n\n- [ ] 1. [US1] Tighten the summary prompt\n  - _Requirements: US-1.AC-1_\n  - _Affects evals: golden (maintain baseline)_\n- [ ] 2. [US1] Validate output schema\n  - _Requirements: US-1.AC-1_\n");
  const bai = await brief({ name: "Brief AI", number: 1 });
  const bai2 = await brief({ name: "Brief AI", number: 2 });
  ok(bai.ok && bai.inlineOnly === true && bai.loop === "ai-prompt" && bai.evals.length === 1 && bai2.inlineOnly === false,
    "+ai task with _Affects evals:_ is flagged inlineOnly (prompt loop); a deterministic +ai task is not");

  // T-10: the hook ignores the execution workspace (no roadmap churn, no context spam).
  const { spawnSync } = require("child_process");
  const hk = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], {
    input: JSON.stringify({ hook_event_name: "PostToolUse", tool_input: { file_path: path.join(exDir, "ledger.md") } }),
    encoding: "utf8",
  });
  ok(hk.status === 0 && hk.stdout.trim() === "", "PostToolUse hook stays silent for files under .specs/<feature>/.execution/");

  // US-2: the protocol ships with the plugin and the skill routes to it.
  const root = path.join(__dirname, "..");
  const skillMd = fs.readFileSync(path.join(root, "skills", "dev-spec-driven", "SKILL.md"), "utf8");
  ok(fs.existsSync(path.join(root, "skills", "dev-spec-driven", "references", "subagent-execution.md")) &&
    fs.existsSync(path.join(root, "agents", "spec-implementer.md")) && fs.existsSync(path.join(root, "agents", "spec-reviewer.md")) &&
    /subagent-execution\.md/.test(skillMd) && /spec_task_brief/.test(skillMd),
    "subagent protocol + agents ship with the plugin and SKILL.md routes Phase 6 to them");

  // --- v1.11 review fixes: each assertion reproduces a finding from the full plugin review ---
  const S = require("./lib/spec.js");
  const rDir = path.join(tmp, "proj-review");
  const rSpecs = path.join(rDir, ".specs");
  S.initProject(rDir, ["tdd"], "en");
  S.createFeature(rDir, "Billing", ["core"]);

  // Critical: a name with no ASCII letters must never resolve to .specs/ itself (remove used to wipe it all).
  const rmEmpty = payload(await rpc("tools/call", { name: "spec_feature", arguments: { action: "remove", name: "日本語", projectDir: rDir } }));
  const rmSteer = S.manageFeature(rDir, "remove", "steering");
  ok(rmEmpty.ok === false && rmSteer.ok === false && fs.existsSync(path.join(rSpecs, "billing")) && fs.existsSync(path.join(rSpecs, "steering", "constitution.md")),
    "remove with an empty-slug name or 'steering' is refused and .specs/ survives");
  const noName = await rpc("tools/call", { name: "spec_create", arguments: { tracks: ["core"], projectDir: rDir } });
  ok(noName.result.isError === true && /Missing required argument/.test(noName.result.content[0].text) && !fs.existsSync(path.join(rSpecs, "undefined")),
    "MCP validates required args (no .specs/undefined/ from a missing name)");
  ok(S.manageFeature(rDir, "rename", "billing").ok === false && S.createFeature(rDir, "nul", ["core"]).ok === false,
    "rename without a new name and Windows device names (nul) are refused");

  // Accented names transliterate; folders created under the old slug are still found.
  const acc = S.createFeature(rDir, "Autenticação", ["core"]);
  fs.mkdirSync(path.join(rSpecs, "fatura-o"), { recursive: true }); // pre-1.11 slug of "Faturação"
  fs.writeFileSync(path.join(rSpecs, "fatura-o", "tasks.md"), "- [ ] 1. x\n");
  ok(acc.slug === "autenticacao" && S.nextTask(rDir, "Faturação").feature === "fatura-o", "slugs transliterate accents; legacy slug folders still resolve");

  // Important: unparseable JSON is reported, never "repaired" into an empty file (data loss).
  S.setDependency(rDir, "billing", ["autenticacao"]);
  const rmPath = path.join(rSpecs, "roadmap.json");
  fs.writeFileSync(rmPath, "\uFEFF" + fs.readFileSync(rmPath, "utf8")); // Windows editor BOM
  ok(S.backlog(rDir, "add", "Exports").ok && S.readRoadmap(rDir).features.billing.dependsOn[0] === "autenticacao", "roadmap.json with a BOM is read, not reset");
  const broken = fs.readFileSync(rmPath, "utf8").replace(/\}\s*$/, ",}");
  fs.writeFileSync(rmPath, broken);
  const blAdd = S.backlog(rDir, "add", "More");
  ok(blAdd.ok === false && /not valid JSON/.test(blAdd.error) && fs.readFileSync(rmPath, "utf8") === broken, "invalid roadmap.json → mutators refuse; the file is left untouched");
  fs.writeFileSync(rmPath, broken.replace(",}", "}"));
  const stPath = path.join(rSpecs, "billing", ".state.json");
  fs.writeFileSync(stPath, '{"lang":"en","approvals":{"requirements":{"at":"x"}},}');
  ok(S.approvePhase(rDir, "billing", "design").ok === false && /requirements/.test(fs.readFileSync(stPath, "utf8")), "invalid .state.json → approve refuses instead of erasing approvals");
  fs.writeFileSync(stPath, '{"lang":"en","approvals":{}}');

  // setDependency with only an order keeps the declared deps; roadmap lang doesn't change the project lang.
  const ord = S.setDependency(rDir, "billing", undefined, 2);
  ok(ord.ok && ord.dependsOn[0] === "autenticacao" && ord.order === 2, "order-only spec_depend keeps existing dependencies");
  S.writeRoadmapMd(rDir, "es");
  ok(S.projectLang(rDir) === "en" && /Hoja de ruta|Progreso/.test(fs.readFileSync(path.join(rSpecs, "ROADMAP.md"), "utf8")), "roadmap lang:es localizes the roadmap only — the project stays EN");
  const handDir = path.join(tmp, "proj-hand");
  fs.mkdirSync(path.join(handDir, ".specs"), { recursive: true });
  fs.writeFileSync(path.join(handDir, ".specs", "ROADMAP.md"), "# My own roadmap\n- Q1: ship X\n");
  S.createFeature(handDir, "Thing", ["core"]);
  ok(/My own roadmap/.test(fs.readFileSync(path.join(handDir, ".specs", "ROADMAP.md"), "utf8")), "a hand-written ROADMAP.md is never overwritten");

  // EARS: DEVERÁ/DEBERÁ are modals; ordinary numbered prose outside AC sections is not a criterion.
  ok(S.earsValidate("1. **US-1.AC-1** — QUANDO o utilizador submete, O SISTEMA DEVERÁ guardar o registo.\n2. **US-1.AC-2** — CUANDO falla, EL SISTEMA DEBERÁ reintentar.").verdict === "pass",
    "EARS recognizes DEVERÁ / DEBERÁ (unicode word boundaries)");
  const prose = S.earsValidate("## Acceptance Criteria\n1. **US-1.AC-1** — WHEN x THE SYSTEM SHALL y\n\n## Assumptions\n1. Users will already have an account.\n\n## Pressupostos\n1. O utilizador já se registou.\n");
  ok(prose.verdict === "pass" && prose.summary.criteriaDetected === 1, "numbered prose under Assumptions/Pressupostos is not linted as a criterion");
  const ptFresh = S.earsValidate(fs.readFileSync(path.join(ptDir, ".specs", "resumo-faturas", "requirements.md"), "utf8"));
  ok(ptFresh.issues.filter((i) => i.severity === "warn" && i.code !== "placeholder").length === 0 && ptFresh.issues.some((i) => i.code === "placeholder"),
    "a fresh PT scaffold has no EARS warnings beyond its template placeholders (template prose 'deve' is not a criterion)");

  // Doctor: [AI] Observability for AI can't stand in for [SaaS] Observability; definitions-only AC uniqueness.
  const aiSaas = S.createFeature(rDir, "Mixed", ["ai"]);
  S.addTrack(rDir, "mixed", "saas");
  const mixedDesign = path.join(aiSaas.dir, "design.md");
  const filled = fs.readFileSync(mixedDesign, "utf8").split(/\r?\n/);
  let inSaasObs = false;
  const keptLines = filled.filter((l) => {
    if (/^#{1,6}\s/.test(l)) inSaasObs = /\[SaaS\]/.test(l) && /Observability/i.test(l);
    return inSaasObs || !/^\s*>\s*\*\*TODO\*\*/.test(l);
  });
  fs.writeFileSync(mixedDesign, keptLines.join("\n").replace(/\n(#{2,3} [^\n]*\n)/g, "\n$1filled.\n"));
  const mixedDoc = S.specDoctor(rDir, "mixed").checks.find((c) => c.id === "saas-sections");
  ok(mixedDoc.status === "fail" && /Observability:unfilled/.test(mixedDoc.detail), "doctor sees the unfilled [SaaS] Observability even after [AI] Observability for AI");
  fs.writeFileSync(path.join(rSpecs, "billing", "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n2. **US-1.AC-2** — WHEN c THE SYSTEM SHALL reuse the key from US-1.AC-1\n");
  const dupChk = S.specDoctor(rDir, "billing").checks.find((c) => c.id === "ac-uniqueness");
  ok(dupChk.status === "pass", "a reference to US-1.AC-1 inside another criterion is not a duplicate definition");

  // Tasks: duplicated numbers progress; "1.1" is not task 1; _Implements: keeps underscores.
  fs.writeFileSync(path.join(rSpecs, "billing", "tasks.md"), "- [ ] 1. a\n- [ ] 1.1 sub-step\n- [ ] 2. b\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: src/user_service.py_\n- [ ] 2. b again\n");
  fs.mkdirSync(path.join(rDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(rDir, "src", "user_service.py"), "");
  const c1 = S.completeTask(rDir, "billing", 2), c2 = S.completeTask(rDir, "billing", 2), c3 = S.completeTask(rDir, "billing", 2);
  ok(c1.done === 1 && c2.done === 2 && c3.alreadyDone === true && S.parseTasks(fs.readFileSync(path.join(rSpecs, "billing", "tasks.md"), "utf8")).length === 3,
    "duplicate task numbers tick the next open one; '1.1' is not parsed as task 1");
  const trImpl = S.traceCheck(rDir, "billing");
  ok(trImpl.implementsFiles[0] === "src/user_service.py" && trImpl.missingImplFiles.length === 0, "_Implements: src/user_service.py_ keeps the underscore");

  // next_action: ticking tasks after approval is progress, not a spec change.
  const na2Feat = S.createFeature(rDir, "Flow", ["core"]);
  fs.writeFileSync(path.join(na2Feat.dir, "tasks.md"), "- [ ] 1. first\n- [ ] 2. second\n");
  ["classification", "requirements", "design", "tasks"].forEach((p) => S.approvePhase(rDir, "flow", p, undefined, { force: true })); // templates: 1.13 gate
  S.completeTask(rDir, "flow", 1);
  const na2 = S.nextAction(rDir, "flow");
  ok(!na2.changedSinceApproval.includes("tasks.md"), "completing a task does not flag tasks.md as changed since approval");

  // Phase: a fresh scaffold (placeholder tasks only) is not "tasks-ready"; doctor warns on zero criteria.
  const fresh = S.createFeature(rDir, "Fresh", ["tdd"]);
  ok(S.statusFeature(rDir, "fresh").phase === "requirements", "fresh scaffold phase ignores placeholder-only template tasks (and still-template artifacts → requirements)");
  fs.writeFileSync(path.join(fresh.dir, "requirements.md"), "# Feature: fresh\n");
  ok(S.specDoctor(rDir, "fresh").checks.find((c) => c.id === "ears").status === "warn", "doctor warns (not passes) when requirements.md has zero criteria");

  // clarify: English-stable tags, links and inline code are not placeholders.
  fs.writeFileSync(path.join(fresh.dir, "requirements.md"), "## Success Criteria\n- **SC-001** — 99% [P] tasks use [RFC 7519](https://x) and `[x]` code\n");
  ok(!S.clarify(rDir, "fresh").questions.some((q) => /placeholder/.test(q)), "clarify ignores [P]/[US1] tags, markdown links and inline code");

  // MCP protocol: malformed input gets a JSON-RPC error and the server keeps serving.
  const bad1 = await rawOnce("null");
  const bad2 = await rawOnce("{not json");
  const alive = await rpc("ping", {});
  ok(bad1.error && bad1.error.code === -32600 && bad2.error && bad2.error.code === -32700 && alive.result, "null / malformed JSON → -32600 / -32700 and the server stays up");

  // Hook: never crashes on a hostile payload.
  const hkNull = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: "null", encoding: "utf8" });
  const hkNum = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_input: { file_path: 123 } }), encoding: "utf8" });
  ok(hkNull.status === 0 && hkNum.status === 0 && !hkNull.stderr && !hkNum.stderr, "hook exits 0 silently on a null payload or a non-string file_path");

  // --- v1.11 final-review regressions (defects the change set itself introduced, caught before release) ---
  const fDir = path.join(tmp, "proj-final");
  const fSpecs = path.join(fDir, ".specs");
  // Sections whose content sits under ### sub-headings are filled (the plugin's own reference template).
  const tpl = S.createFeature(fDir, "Tpl", ["saas"]);
  fs.copyFileSync(path.join(__dirname, "..", "skills", "dev-spec-driven", "references", "scale-design-template.md"), path.join(tpl.dir, "design.md"));
  ok(S.specDoctor(fDir, "tpl").checks.find((c) => c.id === "saas-sections").status === "pass", "a mandatory section filled under ### sub-headings counts as filled (scale-design-template.md passes)");
  // Kiro-style "1.1" sub-tasks belong to their parent in the brief too.
  const kiro = S.createFeature(fDir, "Kiro", ["core"]);
  fs.writeFileSync(path.join(kiro.dir, "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
  fs.writeFileSync(path.join(kiro.dir, "tasks.md"), "- [ ] 1. Parser\n  - [ ] 1.1 tokenise\n  - _Requirements: US-1.AC-1_\n- [ ] 2. Printer\n");
  const kb1 = S.taskBrief(fDir, "kiro");
  S.completeTask(fDir, "kiro", 1);
  const kb2 = S.taskBrief(fDir, "kiro");
  ok(kb1.task.number === 1 && kb1.acceptanceCriteria.length === 1 && kb2.task.number === 2, "brief treats '1.1' checkbox lines as part of task 1 and advances to task 2");
  // _Implements: in the middle of a line; bracket-style real tasks don't read as complete after one tick.
  fs.mkdirSync(path.join(fDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(fDir, "src", "x.js"), "");
  fs.writeFileSync(path.join(kiro.dir, "tasks.md"), "- [ ] 1. Do X _Implements: src/x.js_ _Requirements: US-1.AC-1_\n- [ ] 2. Y _Implements: src/x.js_ (see notes)\n");
  const midTr = S.traceCheck(fDir, "kiro");
  ok(midTr.implementsFiles.length === 1 && midTr.implementsFiles[0] === "src/x.js" && midTr.missingImplFiles.length === 0, "_Implements: parsed mid-line (followed by another marker or prose)");
  fs.writeFileSync(path.join(kiro.dir, "tasks.md"), "- [ ] 1. [US1] [Create users table]\n- [ ] 2. [US1] [Add endpoint]\n- [ ] 3. [US1] [Wire UI]\n");
  S.completeTask(fDir, "kiro", 1);
  ok(S.statusFeature(fDir, "kiro").phase === "executing", "ticking 1 of 3 bracket-style tasks is 'executing', not 'complete'");
  // _Affects evals: on an ordinary code task keeps its tdd loop; only real prompt work is inline-only.
  const mix = S.createFeature(fDir, "Mix", ["tdd", "ai"]);
  const promptNo = S.taskBlocks(fs.readFileSync(path.join(mix.dir, "tasks.md"), "utf8")).find((t) => /Prompt v1/.test(t.text)).number;
  const m3 = S.taskBrief(fDir, "mix", 3), m7 = S.taskBrief(fDir, "mix", promptNo);
  ok(m3.loop === "tdd" && m3.inlineOnly === false && m7.loop === "ai-prompt" && m7.inlineOnly === true && /run the eval harness afterwards/.test(m3.brief),
    "_Affects evals: on a code task keeps the tdd loop (+ an eval check); the prompt task stays inline-only");
  // acIndex keys a criterion by the ID it defines; table-row ACs resolve.
  fs.writeFileSync(path.join(kiro.dir, "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a token expires THE SYSTEM SHALL refresh it (replaces the old US-1.AC-2 flow)\n2. **US-1.AC-2** — WHEN refresh fails THE SYSTEM SHALL log out\n\n| ID | Criterion |\n|---|---|\n| US-1.AC-3 | THE SYSTEM SHALL audit logins |\n");
  fs.writeFileSync(path.join(kiro.dir, "tasks.md"), "- [ ] 1. Logout\n  - _Requirements: US-1.AC-2, US-1.AC-3_\n");
  const ab = S.taskBrief(fDir, "kiro", 1);
  ok(/log out/.test(ab.acceptanceCriteria[0].text) && ab.acceptanceCriteria.length === 2 && ab.unresolved.acs.length === 0, "a brief resolves each AC to the criterion that DEFINES it (and table-row ACs)");
  // EARS: previously valid specs stay valid.
  const earsOk = (t) => S.earsValidate(t).verdict === "pass";
  ok(earsOk("## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n\n## Open Questions\n1. Does US-1.AC-1 apply to admins?\n\n## Non-Functional Requirements\n1. All measurements are reported in SI units.\n") &&
    earsOk("#### Critérios de Aceite\n1. US-1.AC-1 — QUANDO o utilizador entra, a aplicação deve mostrar o painel\n") &&
    earsOk("## Acceptance Criteria\n##### Erros\n1. **US-1.AC-1** — SE falha ENTÃO o serviço deve reintentar\n") &&
    earsOk("## Criterios de Aceptación\n1. **US-1.AC-1** — CUANDO fallan, LOS SERVICIOS DEBERÁN reintentar\n"),
    "EARS: open questions / SI units / pt-BR 'Aceite' / sub-headings under AC / DEBERÁN keep passing");
  const bullet = S.earsValidate("- US-1.AC-1 — QUANDO o pedido chega, a API deve responder 200\n");
  ok(bullet.summary.criteriaDetected === 1 && bullet.verdict === "pass", "a bullet that defines an AC with lowercase 'deve' is still a criterion");
  // Legacy accented slug via ears_validate {name}; an existing 'aux' folder can be renamed away.
  fs.mkdirSync(path.join(fSpecs, "autentica-o"), { recursive: true });
  fs.writeFileSync(path.join(fSpecs, "autentica-o", "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
  const earsLegacy = payload(await rpc("tools/call", { name: "ears_validate", arguments: { name: "Autenticação", projectDir: fDir } }));
  fs.mkdirSync(path.join(fSpecs, "aux"), { recursive: true });
  const renAux = S.manageFeature(fDir, "rename", "aux", "auxiliary");
  ok(earsLegacy.verdict === "pass" && renAux.ok === true && renAux.to === "auxiliary", "ears_validate {name} resolves legacy slugs; an existing 'aux' folder can be renamed");
  // Hook: a v1.8-era project (generated ROADMAP.md, no steering/roadmap.json/.state.json) is still served.
  const oldDir = path.join(tmp, "proj-v18");
  fs.mkdirSync(path.join(oldDir, ".specs", "legacy"), { recursive: true });
  fs.writeFileSync(path.join(oldDir, ".specs", "ROADMAP.md"), "# Roadmap — x\n\n<!-- AUTO-GENERATED by dev-spec — do not edit by hand. -->\n");
  const oldReq = path.join(oldDir, ".specs", "legacy", "requirements.md");
  fs.writeFileSync(oldReq, "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
  const hkOld = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_input: { file_path: oldReq } }), encoding: "utf8" });
  ok(/EARS check/.test(hkOld.stdout), "the hook still serves a v1.8-era project identified by its generated ROADMAP.md");

  // --- v1.11 remaining-items round: classifier, i18n of returned text, parity, structure ---
  const cls2 = (d, o) => S.classify(d, o).tracks;
  ok(cls2("desconto aplicado no checkout").includes("tdd") && !cls2("Build a CRUD page with no auth and without any LLM").includes("ai") &&
    !cls2("Página interna que no usa LLM, sólo una tabla").includes("ai"),
    "classifier: PT 'no' (em+o) is not a negator; EN/ES 'no' still negates");
  ok(cls2("login/signup flow").includes("tdd") && cls2("RAG/embeddings over the docs").includes("ai") && !cls2("refactor src/rag.ts").includes("ai"),
    "classifier: 'a/b' word pairs are matched; source paths stay opaque");
  ok(cls2("Migrações de base de dados").includes("tdd") && cls2("Suscripciones mensuales").includes("tdd") && cls2("limites de taxa por inquilino").includes("saas") &&
    cls2("Planos de subscrição mensal").includes("tdd") && cls2("Resumir faturas com um modelo de linguagem").includes("ai") && cls2("Inicio de sesión con Google").includes("tdd"),
    "classifier: PT/ES plurals (-ções/-ciones, first word of phrases) and new PT/ES/EN signals");
  ok(cls2("simple page", { name: "LLM chatbot billing" }).includes("ai"), "classifier uses the optional feature name as evidence");
  ok(/sempre ativo/.test(S.classify("Webhook de faturação com resumo por um LLM").reasoning) && /always on/.test(S.classify("Stripe billing webhook").reasoning) &&
    /siempre activo/.test(S.classify("x", { lang: "es" }).reasoning), "classify reasoning follows the description's language (or an explicit lang)");

  // Returned text is localized; the structured fields stay stable.
  const ptProj = path.join(tmp, "proj-pt-msgs");
  S.initProject(ptProj, [], "pt");
  ok(/não encontrada/.test(S.statusFeature(ptProj, "inexistente").error) && /nome reservado/.test(S.createFeature(ptProj, "steering", ["core"]).error),
    "engine errors come back in the project language (PT)");
  const ptF = S.createFeature(ptProj, "Pagamentos", ["saas"]);
  fs.writeFileSync(path.join(ptF.dir, "requirements.md"), "## Critérios de Aceitação\n1. **US-1.AC-1** — QUANDO paga, a resposta deve ser rápida e amigável\n");
  const ptE = S.earsFeature(ptProj, "pagamentos");
  ok(ptE.issues.filter((i) => i.code === "vague").length === 2 && ptE.issues.every((i) => /Termo vago/.test(i.msg)),
    "EARS: every vague term is reported, with a stable code and a PT message");
  const ptDocSaas = S.specDoctor(ptProj, "pagamentos").checks.find((c) => c.id === "saas-sections").detail;
  ok(/Observabilidade:por preencher/.test(ptDocSaas), "doctor names unfilled sections in the feature language");
  const reLang = S.createFeature(ptProj, "Pagamentos", ["saas"], undefined, undefined, "en");
  ok(reLang.lang === "pt" && /mantive/.test(reLang.note || ""), "re-running spec_create with another lang keeps the feature's language and says so");
  const hkSess = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "SessionStart" }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: ptProj } });
  ok(/tarefas\)/.test(hkSess.stdout), "SessionStart feature lines are localized (PT 'tarefas')");

  // Parity / robustness
  const covDir = path.join(tmp, "proj-cov");
  ["build-tools/x.js", "happy-path-tests/y.js", "auth/login.js", "payments/pay.js"].forEach((f) => { fs.mkdirSync(path.dirname(path.join(covDir, f)), { recursive: true }); fs.writeFileSync(path.join(covDir, f), "x"); });
  ["ui", "app", "user-auth", "payment"].forEach((n) => S.createFeature(covDir, n, ["core"]));
  fs.writeFileSync(path.join(covDir, ".specs", "user-auth", "tasks.md"), "- [ ] 1. a\n  - _Implements: auth/login.js_\n");
  const covSeg = S.coverage(covDir);
  // 1.13: coverage counts code files named in _Implements:_ — a folder whose NAME matches a feature is no longer "documented".
  ok(covSeg.documented.join(",") === "auth" && covSeg.undocumented.includes("payments") && covSeg.undocumented.includes("build-tools") && covSeg.coveragePercent === 25,
    "coverage counts files named in _Implements:_ ('payments' ≈ feature 'payment' by name alone is not covered)");
  ok(S.resolveProjectDir("${CLAUDE_PROJECT_DIR}") !== path.resolve("${CLAUDE_PROJECT_DIR}"), "an unexpanded ${VAR} projectDir is ignored, not created as a folder");
  const autoCreate = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "LLM Summaries", projectDir: path.join(tmp, "proj-auto") } }));
  ok(autoCreate.ok && autoCreate.tracks.includes("ai"), "MCP spec_create without tracks auto-classifies (same as the CLI)");
  const batch = await rawOnce(JSON.stringify([{ jsonrpc: "2.0", id: 901, method: "ping" }, { jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 902, method: "ping" }]));
  ok(Array.isArray(batch) && batch.length === 2 && batch.map((r) => r.id).join() === "901,902", "a JSON-RPC batch gets ONE array reply (notifications contribute nothing)");

  // Plugin structure: no root .mcp.json (it broke every maintainer session); renamed commands; references resolve.
  const pj = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin", "plugin.json"), "utf8"));
  ok(!fs.existsSync(path.join(root, ".mcp.json")) && fs.existsSync(path.join(root, pj.mcpServers)) &&
    /\$\{CLAUDE_PLUGIN_ROOT\}\/mcp\/server\.js/.test(fs.readFileSync(path.join(root, pj.mcpServers), "utf8")),
    "plugin.json → mcp/servers.json (no root .mcp.json), server path via ${CLAUDE_PLUGIN_ROOT}");
  ok(["spec-init", "spec-status", "spec-doctor", "spec-commit"].every((c) => fs.existsSync(path.join(root, "commands", c + ".md"))) &&
    !["init", "status", "doctor", "commit"].some((c) => fs.existsSync(path.join(root, "commands", c + ".md"))),
    "commands that collided with Claude Code built-ins are renamed spec-*");
  const skillNow = fs.readFileSync(path.join(root, "skills", "dev-spec-driven", "SKILL.md"), "utf8");
  const refsCited = [...new Set([...skillNow.matchAll(/references\/([\w-]+\.md)/g)].map((m) => m[1]))];
  ok(refsCited.length > 15 && refsCited.every((r) => fs.existsSync(path.join(root, "skills", "dev-spec-driven", "references", r))) && skillNow.split("\n").length <= 540,
    `every reference SKILL.md cites exists (${refsCited.length}) and SKILL.md stays compact`);

  // --- review round 3 regressions ---
  const enNeg = ["Do the export; no auth", "Export page for da Vinci museum; no auth, no payment", "Static page on example.com with no billing",
    "Show a to-do list with no login", "Guests in Canada no login required", "CSV export for USA offices; no login"];
  ok(enNeg.every((d) => { const r = S.classify(d); return !r.tracks.includes("tdd") && /always on/.test(r.reasoning); }),
    "English with 'do/da/.com/to-do/Canada/USA' stays English: negation and reasoning unchanged");
  ok(!cls2("Admin tools used by the support staff").includes("ai") && !cls2("The seeder loads test fixtures into the database").includes("saas") &&
    !cls2("routes/login handler").includes("tdd"), "no phantom signals from English first-word plurals or extensionless paths");
  const twin = S.classify("Guardar a sessão do utilizador");
  ok(twin.signals.tdd.length === 1 && twin.confidence.tdd === "medium", "accented/unaccented keyword twins count once per word");
  const existing = S.createFeature(rDir, "Chat Support", ["core"]);
  const again = S.createFeature(rDir, "Chat Support", undefined, "LLM chatbot for billing");
  const strTracks = S.createFeature(rDir, "String Tracks", "tdd");
  ok(existing.ok && again.label === "core" && !fs.existsSync(path.join(again.dir, "eval-plan.md")) && strTracks.tracks.includes("tdd"),
    "spec_create without tracks never re-classifies an existing feature; string tracks are honoured");
  ok(S.earsValidate("1. **US-1.AC-1** — QUANDO exporta, O SISTEMA DEVE garantir que a exportação não leve mais de 5 s.", "pt").issues.every((i) => i.code !== "vague"),
    "'leve' (subjunctive of levar) is not a vague term");
  ok(/heurístic/i.test(S.coverage(ptProj).note) && /heurístic/i.test(S.scanCodebase(ptProj).note), "scan/coverage notes are localized");

  // --- v1.12: verification evidence, Global Constraints, parallel batches, bugfix flow, finish ---
  const vDir = path.join(tmp, "proj-v112");
  const vf = S.createFeature(vDir, "Keys", ["tdd"]);
  const tplTasks = fs.readFileSync(path.join(vf.dir, "tasks.md"), "utf8");
  ok(/## Global Constraints/.test(tplTasks) && /_Verify: \[/.test(tplTasks), "tasks template carries a Global Constraints section and a _Verify:_ marker");
  fs.writeFileSync(path.join(vf.dir, "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
  fs.writeFileSync(path.join(vf.dir, "tasks.md"), [
    "## Global Constraints", "- Node >= 20", "- [placeholder]", "",
    "## Story US-1 (P1)",
    "- [ ] 1. [US1] Core", "  - _Requirements: US-1.AC-1_", "  - _Verify: node -e \"process.exit(0)\"_",
    "- [ ] 2. [US1][P] Parser", "  - _Requirements: US-1.AC-1_", "  - _Implements: src/parser.js_",
    "- [ ] 3. [US1][P] Printer", "  - _Requirements: US-1.AC-1_", "  - _Implements: src/printer.js_",
    "- [ ] 4. [US1][P] Printer tweak", "  - _Requirements: US-1.AC-1_", "  - _Implements: src/printer.js_", "",
  ].join("\n"));
  const vb = S.taskBrief(vDir, "keys", 1);
  ok(vb.verify[0] === 'node -e "process.exit(0)"' && /## Verification/.test(vb.brief) && /Node >= 20/.test(vb.brief) && !/\[placeholder\]/.test(vb.brief),
    "brief carries the _Verify:_ command and the Global Constraints (placeholders skipped)");
  const failEv = payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: "keys", number: 1, evidence: { command: "npm test", exitCode: 1 }, projectDir: vDir } }));
  ok(failEv.ok === false && /exit 1/.test(failEv.error) && S.nextTask(vDir, "keys").next.number === 1, "a failed verification refuses the tick (evidence before claims)");
  const noEv = S.completeTask(vDir, "keys", 1);
  ok(noEv.ok && noEv.verified === false && /_Verify:_/.test(noEv.note) && S.specDoctor(vDir, "keys").checks.find((c) => c.id === "verification").status === "warn" &&
    /without verification evidence/.test(fs.readFileSync(path.join(vDir, ".specs", "ROADMAP.md"), "utf8")),
    "ticking a _Verify:_ task without evidence warns (result, doctor, roadmap)");
  const backfill = payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: "keys", number: 1, evidence: { command: "npm test", exitCode: 0, summary: "3/3 passing" }, projectDir: vDir } }));
  const vState = JSON.parse(fs.readFileSync(path.join(vf.dir, ".state.json"), "utf8"));
  ok(backfill.verified && vState.evidence["1"].summary === "3/3 passing" && S.specDoctor(vDir, "keys").checks.find((c) => c.id === "verification").status === "pass" &&
    S.statusFeature(vDir, "keys").tasks.list[0].verified === true, "evidence is recorded (and back-fillable) — doctor and status see it");
  const batch2 = payload(await rpc("tools/call", { name: "spec_next_task", arguments: { name: "keys", batch: true, projectDir: vDir } }));
  ok(batch2.batch.map((b) => b.number).join() === "2,3", "next_task batch: consecutive [P] tasks with disjoint _Implements:_ (stops at the shared file)");

  // bugfix flow
  const bf = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Login Loop", kind: "bugfix", summary: "users bounce back to /login", projectDir: vDir } }));
  ok(bf.ok && bf.kind === "bugfix" && bf.label === "core +tdd" && ["bug.md", "requirements.md", "test-plan.md", "tasks.md"].every((x) => bf.created.includes(x)) &&
    S.listFeatures(vDir).features.find((x) => x.name === "login-loop").kind === "bugfix", "spec_create kind:bugfix scaffolds bug.md + regression plan, always +tdd");
  const bdoc = S.specDoctor(vDir, "login-loop");
  ok(bdoc.checks.find((c) => c.id === "root-cause").status === "fail" && !bdoc.checks.some((c) => c.id === "design") && S.traceCheck(vDir, "login-loop").verdict === "pass",
    "bugfix doctor gates on the root cause (no fix before the cause) and needs no design.md");
  const bugPath = path.join(vDir, ".specs", "login-loop", "bug.md");
  fs.writeFileSync(bugPath, fs.readFileSync(bugPath, "utf8")
    .replace(/## Reproduction\n> \*\*TODO\*\*[^\n]*/, "## Reproduction\nLog in with an expired refresh token.")
    .replace(/## Root Cause\n> \*\*TODO\*\*[^\n]*/, "## Root Cause\nThe refresh handler returns 302 to /login before clearing the cookie (auth.js:88).")
    .replace(/## Fix\n\[[^\n]*\]/, "## Fix\nClear the cookie before redirecting."));
  ok(S.specDoctor(vDir, "login-loop").checks.find((c) => c.id === "root-cause").status === "pass", "filling bug.md → Root Cause clears the gate");
  const notReady = payload(await rpc("tools/call", { name: "spec_finish", arguments: { name: "login-loop", projectDir: vDir } }));
  ok(notReady.ok && notReady.readyToFinish === false && notReady.blockers.length >= 2 && /^fix\(login-loop\): users bounce back/.test(notReady.mergeTitle) &&
    /cookie/.test(notReady.mergeSummary) && notReady.checks.some((c) => /no longer reproduce/.test(c)), "spec_finish reports blockers + a merge summary built from the spec (root cause, fix)");
  // 1.13 gates: the bugfix templates' placeholders must be filled before approving and finishing.
  const llFill = (rel, pairs) => { const fp = path.join(vDir, ".specs", "login-loop", rel); let t = fs.readFileSync(fp, "utf8"); pairs.forEach(([a, b]) => { t = t.split(a).join(b); }); fs.writeFileSync(fp, t); };
  llFill("requirements.md", [["[the condition that triggers the bug]", "the refresh token has expired"], ["[the correct behavior]", "clear the session cookie before redirecting to /login"],
    ["[the neighbouring behavior that already worked]", "a login with a valid refresh token"], ["[nearby inputs that must keep working]", "a token that expires mid-request"]]);
  llFill("test-plan.md", [["[unit/integration]", "integration"], ["`[path]`", "`tests/integration/auth.test.js`"]]);
  llFill("tasks.md", [["[exact values the fix must respect — versions, limits, formats]", "Node >= 20"], ["[full test suite command]", "npm test"]]);
  llFill("bug.md", [["[correct behavior]", "the dashboard opens"], ["[what happens — error message, output, log lines]", "302 back to /login in a loop"]]);
  [1, 2, 3].forEach((n) => S.completeTask(vDir, "login-loop", n));
  S.completeTask(vDir, "login-loop", 4, { command: "npm test", exitCode: 0, summary: "42/42 passing" });
  ["requirements", "test-plan", "tasks"].forEach((p) => S.approvePhase(vDir, "login-loop", p));
  const ready = S.finishFeature(vDir, "login-loop", { write: true });
  const prFile = fs.readFileSync(ready.paths.summary, "utf8");
  ok(ready.readyToFinish === true && ready.blockers.length === 0 && /42\/42 passing/.test(prFile) && /US-1\.AC-1/.test(prFile) && ready.mergeSummary === undefined && /merge-summary\.md$/.test(ready.paths.summary),
    "all tasks done + evidence + approvals → readyToFinish; the merge summary (with evidence) is written to .execution/");
  const ptBug = S.createFeature(path.join(tmp, "proj-pt-msgs"), "Erro de Login", undefined, undefined, undefined, undefined, "bugfix");
  ok(/## Causa Raiz/.test(fs.readFileSync(path.join(ptBug.dir, "bug.md"), "utf8")) && /Restrições Globais/.test(fs.readFileSync(path.join(ptBug.dir, "tasks.md"), "utf8")),
    "bugfix scaffolds are localized (PT)");

  // --- v1.12 final-review regressions ---
  fs.writeFileSync(path.join(vf.dir, "tasks.md"), [
    "## Story A", "- [ ] 1. [US1] Core", "  - _Verify: `node -e \"process.exit(0)\"`_", "- [ ] 2. [US1] Placeholder", "  - _Verify: [full suite command]_",
    "- [ ] 3. [US1][P] a", "  - _Implements: src/a.js_", "- [ ] 4. [US1][P] b", "  - _Implements: src/b.js_", "**Checkpoint:** A done.",
    "- [ ] 5. [US1][P] c", "  - _Implements: src/c.js_", "",
  ].join("\n"));
  const st2 = path.join(vf.dir, ".state.json");
  fs.writeFileSync(st2, JSON.stringify({ lang: "en", approvals: {} }));
  ok(S.taskBrief(vDir, "keys", 1).verify[0] === 'node -e "process.exit(0)"' && S.taskBrief(vDir, "keys", 2).verify.length === 0,
    "_Verify:_ values lose wrapping backticks; a [placeholder] is not a command");
  ok(S.completeTask(vDir, "keys", 1, { command: "npm test", exitCode: "FAILED" }).ok === false && S.completeTask(vDir, "keys", 1, { command: "npm test" }).ok === false &&
    S.nextTask(vDir, "keys").next.number === 1, "a non-integer exit code, or a command without its exit code, is rejected (never 'verified')");
  S.completeTask(vDir, "keys", 1, { command: "npm test", exitCode: 0, summary: "ok" });
  const reFail = S.completeTask(vDir, "keys", 1, { command: "npm test", exitCode: 1, summary: "1 failing" });
  ok(reFail.ok === false && reFail.recorded === true && S.statusFeature(vDir, "keys").tasks.list[0].verified === false &&
    S.specDoctor(vDir, "keys").checks.find((c) => c.id === "verification").status === "warn", "a failed re-check of a ticked task is recorded: the task becomes unverified");
  ok(S.completeTask(vDir, "keys", 2, "checked the login page by hand").verified === true, "a summary-only (manual) attestation verifies");
  ok(S.nextTask(vDir, "keys", { batch: true, max: 8 }).batch.map((b) => b.number).join() === "3,4", "a parallel batch never crosses a **Checkpoint:**");
  const aiF = S.createFeature(vDir, "Prompty", ["ai"]);
  fs.writeFileSync(path.join(aiF.dir, "tasks.md"), "- [ ] 1. [US1][P] a\n  - _Implements: src/a.js_\n- [ ] 2. [US1][P] tune prompt\n  - _Implements: prompts/v2.md_\n");
  ok(S.nextTask(vDir, "prompty", { batch: true }).batch.length === 1, "+ai prompt tasks never join a parallel batch");
  const bfx2 = S.createFeature(vDir, "Pay Bug", undefined, "charge fails", undefined, "en", "bugfix");
  S.addTrack(vDir, "pay-bug", "saas");
  const bfxDoc = S.specDoctor(vDir, "pay-bug");
  ok(fs.existsSync(path.join(bfx2.dir, "design.md")) && bfxDoc.checks.find((c) => c.id === "saas-sections").status === "fail" && !bfxDoc.checks.some((c) => c.id === "mermaid"),
    "add_track saas on a bugfix creates design.md with the mandatory sections (no mermaid/constitution noise)");
  const mixed = S.createFeature(vDir, "Pay Bug", undefined, undefined, undefined, undefined, "feature");
  ok(mixed.kind === "bugfix" && /kind/.test(mixed.note || "") && !fs.existsSync(path.join(bfx2.dir, "classification.md")), "a different explicit kind on an existing feature is reported; the stored kind wins");
  const empty = S.createFeature(vDir, "Empty One", ["core"]);
  fs.writeFileSync(path.join(empty.dir, "tasks.md"), "# Tasks\n");
  ok(S.finishFeature(vDir, "empty-one").blockers.some((b) => /no tasks/.test(b)), "spec_finish is never ready with zero tasks");
  const tpNa = S.createFeature(vDir, "Gate Chain", ["tdd"]);
  fs.writeFileSync(path.join(tpNa.dir, "requirements.md"), "## Success Criteria\n- **SC-001** — x\n\n### US-1 (P1)\n#### Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
  fs.writeFileSync(path.join(tpNa.dir, "test-plan.md"), "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n");
  fs.writeFileSync(path.join(tpNa.dir, "tasks.md"), "- [ ] 1. real task\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n");
  fs.writeFileSync(path.join(tpNa.dir, "design.md"), "# Design: Gate Chain\n\n## Overview\nOne endpoint.\n\n## Constitution Check\n- [x] Principle 1 — complies\n"); // 1.13: gates need real content
  S.approvePhase(vDir, "gate-chain", "classification", undefined, { force: true });
  ["requirements", "design"].forEach((p) => S.approvePhase(vDir, "gate-chain", p));
  ok(/test-plan/.test(S.nextAction(vDir, "gate-chain").recommendation), "next_action prompts the test-plan gate (spec_finish blocks on it)");
  const shortT = S.createFeature(vDir, "Title Case", ["core"]);
  fs.writeFileSync(path.join(shortT.dir, "requirements.md"), "## Summary\nPer-tenant API keys, e.g. Stripe-style secrets. They rotate.\n");
  fs.writeFileSync(path.join(shortT.dir, "tasks.md"), "- [x] 1. a\n  - _Verify: node x.js_\n");
  S.completeTask(vDir, "title-case", 1, { command: "node -e \"console.log(`x`)\"", exitCode: 0, summary: "# tests 5\n# pass 5" });
  const tc = S.finishFeature(vDir, "title-case");
  ok(tc.mergeTitle === "feat(title-case): Per-tenant API keys, e.g. Stripe-style secrets" && !/\n# pass/.test(tc.mergeSummary) && /`` node -e/.test(tc.mergeSummary),
    "merge title keeps 'e.g.' inside the sentence; evidence stays on one line with a safe code span");

  // @wp WP1 tests >>>
  // --- 1.13 WP1: ONE task scanner, numeric task numbers, one duplicate resolver, the evidence gate ---
  const w1 = path.join(tmp, "proj-wp1");
  const w1f = S.createFeature(w1, "Scan", ["core"]);
  const w1Tasks = path.join(w1f.dir, "tasks.md");
  // 1. Commented / fenced task-looking lines are not tasks — for status, complete, brief, finish and phase alike.
  fs.writeFileSync(w1Tasks, ["# Tasks", "- [x] 1. a", "- [ ] 2. b", "<!--", "- [ ] 3. dropped", "-->", "```md", "- [ ] 4. example", "```", ""].join("\n"));
  const w1St = S.statusFeature(w1, "scan");
  ok(w1St.tasks.list.map((t) => t.number).join() === "1,2" && w1St.tasks.next.number === 2, "status lists only real tasks (commented/fenced look-alikes are not tasks)");
  const w1c3 = payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: "scan", number: 3, projectDir: w1 } }));
  ok(w1c3.ok === false && /Task 3 not found/.test(w1c3.error) && S.completeTask(w1, "scan", 4).ok === false, "complete_task on a commented or fenced task → task-not-found");
  const w1c2 = S.completeTask(w1, "scan", 2);
  const w1After = fs.readFileSync(w1Tasks, "utf8");
  ok(w1c2.ok && w1c2.next === null && w1c2.done === 2 && w1c2.total === 2 && /- \[ \] 3\. dropped/.test(w1After) && /- \[ \] 4\. example/.test(w1After) &&
    S.statusFeature(w1, "scan").phase === "complete" && S.taskBrief(w1, "scan").task === null && S.finishFeature(w1, "scan").openTasks.length === 0 && S.nextTask(w1, "scan").next === null,
    "after the last real task nothing is next and the phase is complete — status/next/brief/finish agree; look-alikes untouched");
  // A multi-line comment ABOVE the real task: the old first-regex-match ticked the commented example.
  fs.writeFileSync(w1Tasks, "<!--\n- [ ] 1. example in a comment\n-->\r\n- [ ] 1. real\r\n");
  S.completeTask(w1, "scan", 1);
  ok(fs.readFileSync(w1Tasks, "utf8") === "<!--\n- [ ] 1. example in a comment\n-->\r\n- [x] 1. real\r\n", "complete ticks the resolved line — never a commented look-alike (CRLF kept)");
  fs.writeFileSync(w1Tasks, "- [x] 1. a\n<!-- stray, never closed\n- [ ] 2. b\n");
  ok(S.statusFeature(w1, "scan").phase === "executing" && S.nextTask(w1, "scan").next.number === 2, "an unclosed '<!--' hides nothing (the feature can't read as complete)");
  // 2. Task numbers are numeric: "01." is task 1 everywhere.
  fs.writeFileSync(w1Tasks, "- [ ] 01. First\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 02. Second\n");
  const w1b1 = S.taskBrief(w1, "scan", 1);
  ok(S.statusFeature(w1, "scan").tasks.list.map((t) => t.number).join() === "1,2" && S.nextTask(w1, "scan").next.number === 1 && w1b1.task.number === 1 && w1b1.verify.length === 1,
    "zero-padded '01.' is task 1 in status, next and brief");
  const w1z1 = S.completeTask(w1, "scan", 1, { command: "node -e 0", exitCode: 0 }), w1z2 = S.completeTask(w1, "scan", "02");
  ok(w1z1.ok && w1z1.verified && w1z2.ok && w1z2.next === null && /- \[x\] 01\. First\n[\s\S]*- \[x\] 02\. Second/.test(fs.readFileSync(w1Tasks, "utf8")),
    "complete_task finds zero-padded tasks by number (1) or by '02'");
  // 3. Duplicated numbers: ONE resolver — the first OPEN task with that number, else the first.
  const dupF = S.createFeature(w1, "Dups", ["core"]);
  const dupTasks = path.join(dupF.dir, "tasks.md");
  fs.writeFileSync(dupTasks, "- [x] 3. a\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 3. b\n  - _Verify: node -e \"process.exit(7)\"_\n");
  const dupBrief = S.taskBrief(w1, "dups", 3);
  ok(S.resolveTask(S.taskBlocks(fs.readFileSync(dupTasks, "utf8")), 3).text === "b" && dupBrief.task.text === "b" && /exit\(7\)/.test(dupBrief.verify[0]),
    "a duplicated number resolves to its first OPEN task (the brief carries the _Verify:_ that will run)");
  const dupDoc = S.specDoctor(w1, "dups").checks.find((c) => c.id === "duplicate-tasks");
  const dupDone = S.completeTask(w1, "dups", 3);
  ok(dupDoc && dupDoc.status === "warn" && /#3/.test(dupDoc.detail) && dupDone.ok && !dupDone.alreadyDone && /- \[x\] 3\. b/.test(fs.readFileSync(dupTasks, "utf8")),
    "doctor warns on duplicate task numbers (duplicate-tasks); complete ticks the same open task the brief showed");
  const dupPt = S.createFeature(w1, "Duplas", ["core"], undefined, undefined, "pt");
  fs.writeFileSync(path.join(dupPt.dir, "tasks.md"), "- [ ] 1. a\n- [ ] 1. b\n");
  ok(/números de tarefa repetidos: #1/.test(S.specDoctor(w1, "duplas").checks.find((c) => c.id === "duplicate-tasks").detail), "duplicate-tasks detail is localized (PT)");
  // 4. Evidence gate ("evidence before claims" was bypassable).
  const eg = S.createFeature(w1, "Gate", ["core"]);
  const egTasks = path.join(eg.dir, "tasks.md");
  fs.writeFileSync(egTasks, "- [ ] 1. suite\n  - _Verify: npm test_\n- [ ] 2. page\n  - _Verify: [manual: check the page]_\n- [ ] 3. docs\n- [ ] 4. suite again\n  - _Verify: npm test_\n- [ ] 5. extra\n");
  const egState = () => JSON.parse(fs.readFileSync(path.join(eg.dir, ".state.json"), "utf8"));
  // f. the bypass: a failed run, then a summary-only note, used to leave the task "verified".
  const eg1 = payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: "gate", number: 1, evidence: { command: "npm test", exitCode: 1, summary: "1 failing" }, projectDir: w1 } }));
  ok(eg1.ok === false && eg1.recorded === true && egState().evidence["1"].exitCode === 1 && egState().evidence["1"].history.length === 1 && /- \[ \] 1\. suite/.test(fs.readFileSync(egTasks, "utf8")),
    "a failed run on an OPEN task is refused AND recorded (evidence + history in .state.json)");
  const eg2 = payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: "gate", number: 1, evidence: { summary: "all green" }, projectDir: w1 } }));
  const eg2Doc = S.specDoctor(w1, "gate").checks.find((c) => c.id === "verification");
  ok(eg2.ok && eg2.verified === false && eg2.unverifiedReason === "failed-run" && egState().evidence["1"].exitCode === 1 && egState().evidence["1"].note === "all green" &&
    eg2Doc.status === "warn" && /#1 \(latest run failed\)/.test(eg2Doc.detail) && S.finishFeature(w1, "gate").blockers.some((b) => /#1 \(latest run failed\)/.test(b)) &&
    /\*\*gate\*\* — 1 task\(s\) ticked without verification evidence/.test(fs.readFileSync(path.join(w1, ".specs", "ROADMAP.md"), "utf8")),
    "a later summary-only note may tick but never verifies over a failed run (doctor, spec_finish and ROADMAP flag it)");
  const eg3 = S.completeTask(w1, "gate", 1, { command: "npm test", exitCode: 0, summary: "5 passing" });
  ok(eg3.ok && eg3.alreadyDone && eg3.verified === true && egState().evidence["1"].history.map((h) => h.exitCode).join() === "1,0" &&
    !S.verificationStatus(w1, "gate", eg.dir).unverified.includes(1), "only a later PASSING command run verifies it (history keeps both runs)");
  // a. a summary-only note on a task whose _Verify:_ holds a command ticks it but leaves it UNVERIFIED.
  const eg4 = S.completeTask(w1, "gate", 4, "looks fine to me");
  ok(eg4.ok && eg4.verified === false && eg4.unverifiedReason === "manual-note-on-runnable-verify" && /--run/.test(eg4.note) &&
    S.verificationStatus(w1, "gate", eg.dir).unverifiedDetail.some((d) => d.number === 4 && d.reason === "manual-note-on-runnable-verify") &&
    S.statusFeature(w1, "gate").tasks.list.find((t) => t.number === 4).verified === false && S.finishFeature(w1, "gate").unverified.includes(4),
    "a note on a task with a runnable _Verify:_ stays unverified (manual-note-on-runnable-verify) in status, doctor and finish");
  // b. …but a summary still attests a check that has no command: a [manual: …] placeholder, or no _Verify:_ at all.
  ok(S.completeTask(w1, "gate", 2, "checked the page by hand").verified === true && S.completeTask(w1, "gate", 3, { summary: "proofread" }).verified === true,
    "a summary-only attestation verifies a task without a runnable _Verify:_");
  // c. evidence with neither a command nor a summary is rejected, and nothing is ticked.
  const eg5 = S.completeTask(w1, "gate", 5, { exitCode: 0 });
  ok(eg5.ok === false && /exit code alone/.test(eg5.error) && /- \[ \] 5\. extra/.test(fs.readFileSync(egTasks, "utf8")), "{exitCode: 0} alone is rejected (no tick, no 'verified')");
  // d. the history is bounded: the last 5 runs, oldest dropped; evidence[n] stays the latest run.
  for (let i = 1; i <= 6; i++) S.completeTask(w1, "gate", 1, { command: "npm test", exitCode: 0, summary: "run " + i });
  const egH = egState().evidence["1"];
  ok(egH.history.length === 5 && egH.history[0].summary === "run 2" && egH.summary === "run 6" && egH.command === "npm test" && egH.exitCode === 0, "evidence keeps the latest run + its last 5 runs");
  // e. a .state.json of the wrong shape is refused BEFORE tasks.md is touched (it used to tick, then throw).
  const egText = fs.readFileSync(egTasks, "utf8");
  fs.writeFileSync(path.join(eg.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: {}, evidence: "legacy" }));
  const egBad1 = S.completeTask(w1, "gate", 5, { command: "npm test", exitCode: 0 }), egBad2 = S.completeTask(w1, "gate", 5);
  fs.writeFileSync(path.join(eg.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: [] }));
  const egBad3 = S.completeTask(w1, "gate", 5);
  ok(egBad1.ok === false && /'evidence' must be an object/.test(egBad1.error) && egBad2.ok === false && egBad3.ok === false && /'approvals'/.test(egBad3.error) &&
    fs.readFileSync(egTasks, "utf8") === egText, "a .state.json whose evidence/approvals aren't objects → state error, tasks.md untouched");
  fs.writeFileSync(path.join(eg.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: {} }));
  // 5. what `done --run` records: the count lines a plain tail loses, plus the tail, capped.
  const noisy = ["TAP version 13", "ok 1 - a", "ok 2 - b", "# tests 2", "# pass 2", "# fail 0", ...Array.from({ length: 12 }, (_, i) => "trailing noise line " + i)].join("\n");
  const sumNoisy = S.summarizeRunOutput(noisy);
  const sumHuge = S.summarizeRunOutput(Array.from({ length: 50 }, (_, i) => "x".repeat(190) + i).join("\n") + "\n1 failing");
  const sumFail = S.summarizeRunOutput(["✖ t (68ms)", "  'test failed'", "ℹ tests 1", "ℹ suites 0", "ℹ pass 0", "ℹ fail 1", "ℹ cancelled 0", "ℹ skipped 0",
    "ℹ todo 0", "ℹ duration_ms 77.8", "✖ failing tests:", "", "test at t:1:1", "    at Test.run (node:internal/test_runner/test:1447:12)",
    "    at Test.postRun (node:internal/test_runner/test:1522:19)", "    at async startSubtest (node:internal/test_runner/harness:332:3)", "✖ t (68.6781ms)", "  'test failed'"].join("\r\n"));
  ok(/# tests 2\n# pass 2\n# fail 0\n/.test(sumNoisy) && /trailing noise line 11$/.test(sumNoisy) && !/ok 1 - a/.test(sumNoisy) && sumHuge.length <= 500 && /1 failing$/.test(sumHuge) &&
    /^ℹ tests 1\nℹ pass 0\nℹ fail 1\n {4}at Test\.run/.test(sumFail) && /'test failed'$/.test(sumFail),
    "run summary keeps the last count lines (node --test pass/fail, even past failure details) + the tail, deduped and capped at ~500 chars");
  // Review fixes. A line that only LOOKS like a fence opener must not hide the tasks below it (CommonMark):
  // "```npm test```" is inline code; a fence left open in a task's body ends with that list item; a fence
  // that never closes is plain text — the feature must not read as complete with real tasks still open.
  const fz = S.createFeature(w1, "Fence", ["core"]);
  const fzTasks = path.join(fz.dir, "tasks.md");
  const fzSeen = () => S.statusFeature(w1, "fence").tasks.list.map((t) => t.number + (t.done ? "x" : "")).join();
  fs.writeFileSync(fzTasks, "- [x] 1. Wire the runner\n  ```npm test``` must pass\n- [ ] 2. Ship it\n- [ ] 3. Docs\n");
  const fzC2 = S.completeTask(w1, "fence", 2);
  ok(fzC2.ok && fzC2.next.number === 3 && fzSeen() === "1x,2x,3" && S.statusFeature(w1, "fence").phase === "executing" && S.finishFeature(w1, "fence").openTasks.join() === "3",
    "a one-line ```code``` span is inline code, not a fence: the tasks below it stay visible to status/complete/finish");
  fs.writeFileSync(fzTasks, "- [x] 1. Add the helper\n  ```js\n  const x = 1;\n- [ ] 2. Ship it\n");
  const fzBody = S.taskBlocks(fs.readFileSync(fzTasks, "utf8"))[0].body;
  ok(fzSeen() === "1x,2" && S.nextTask(w1, "fence").next.number === 2 && fzBody.join("|") === "```js|const x = 1;", "an unclosed fence in a task's body ends with that list item (the next task is still a task)");
  fs.writeFileSync(fzTasks, "- [x] 1. a\n```js\n- [ ] 2. b\n");
  ok(fzSeen() === "1x,2" && S.statusFeature(w1, "fence").phase === "executing", "a top-level fence that never closes is plain text — it hides nothing");
  fs.writeFileSync(fzTasks, "- [x] 1. a\n```html\n<!-- header partial\n```\n- [ ] 2. b\n\nlater prose --> end\n");
  ok(fzSeen() === "1x,2", "a '<!--' inside fenced code is code, not the start of a comment that swallows the next task");
  fs.writeFileSync(fzTasks, "- [ ] 1. doc\n  ```md\n  - [ ] 9. example\n  ```\n~~~\n- [ ] 8. tilde example\n~~~\n- [ ] 2. b\n");
  ok(fzSeen() === "1,2", "closed fences (backtick in a task body, top-level tilde) still hide their task look-alikes");
  fs.writeFileSync(fzTasks, "\uFEFF```md\n- [ ] 9. example\n```\n- [ ] 1. real\n");
  ok(fzSeen() === "1" && S.completeTask(w1, "fence", 1).ok && fs.readFileSync(fzTasks, "utf8") === "\uFEFF```md\n- [ ] 9. example\n```\n- [x] 1. real\n",
    "a UTF-8 BOM is not indentation: a fence on the first line still hides its look-alikes (and the tick keeps the BOM)");
  // Comment tokens inside `inline code` are literal text, never a comment spanning two task lines.
  fs.writeFileSync(fzTasks, "- [x] 1. Detect the `<!--` opener\n- [ ] 2. Detect the `-->` closer\n");
  const cmList = S.statusFeature(w1, "fence").tasks.list;
  ok(cmList.length === 2 && cmList[0].text === "Detect the `<!--` opener" && cmList[1].text === "Detect the `-->` closer" && S.completeTask(w1, "fence", 2).ok,
    "'<!--' / '-->' inside inline code spans don't form a comment (both tasks keep their full text; task 2 completes)");
  // A zero exit code with no command is a claim, not a run: it can't clear a recorded failed run (4d).
  const nr = S.createFeature(w1, "Norun", ["core"]);
  fs.writeFileSync(path.join(nr.dir, "tasks.md"), "- [ ] 1. no verify marker\n- [ ] 2. fresh\n");
  S.completeTask(w1, "norun", 1, { command: "npm test", exitCode: 1, summary: "1 failing" });
  const nr1 = S.completeTask(w1, "norun", 1, { exitCode: 0, summary: "all green" });
  const nrState = JSON.parse(fs.readFileSync(path.join(nr.dir, ".state.json"), "utf8")).evidence;
  const nr2 = S.completeTask(w1, "norun", 2, { exitCode: 0, summary: "proofread" });
  ok(nr1.ok && nr1.verified === false && nr1.unverifiedReason === "failed-run" && nrState["1"].exitCode === 1 && nrState["1"].note === "all green" &&
    S.verificationStatus(w1, "norun", nr.dir).unverifiedDetail.some((d) => d.number === 1 && d.reason === "failed-run") && nr2.verified === true,
    "{summary, exitCode: 0} without a command after a failed run stays failed-run (only a passing COMMAND run clears it); on a fresh check it is a plain attestation");
  // Evidence is stamped with its task: a duplicated number never lends one task's passing run to the other.
  const dv = S.createFeature(w1, "Dupev", ["core"]);
  fs.writeFileSync(path.join(dv.dir, "tasks.md"), "- [ ] 3. a\n  - _Verify: node -e 0_\n- [ ] 3. b\n  - _Verify: node -e \"process.exit(7)\"_\n");
  const dv1 = S.completeTask(w1, "dupev", 3, { command: "node -e 0", exitCode: 0 });
  const dv2 = S.completeTask(w1, "dupev", 3);
  const dvDoc = S.specDoctor(w1, "dupev").checks.find((c) => c.id === "verification");
  const dvFin = S.finishFeature(w1, "dupev");
  ok(dv1.ok && dv1.verified && dv2.ok && dv2.verified === false && dv2.unverifiedReason === "duplicate-number" && /renumber/.test(dv2.note) &&
    S.statusFeature(w1, "dupev").tasks.list.map((t) => t.text + ":" + t.verified).join() === "a:true,b:false" &&
    dvDoc.status === "warn" && /#3 \(number shared with another task\)/.test(dvDoc.detail) && dvFin.unverified.includes(3) &&
    /3\. a — `node -e 0` → exit 0/.test(dvFin.mergeSummary) && /3\. b — /.test(dvFin.mergeSummary) && !/3\. b — `node -e 0`/.test(dvFin.mergeSummary),
    "the second '3.' ticked without its own run is unverified (duplicate-number) in complete, status, doctor and spec_finish — never 'verified' by the first one's run");
  const dvRun = S.completeTask(w1, "dupev", 3, { command: "node -e 0", exitCode: 0 }); // both ticked → resolves to the first
  ok(dvRun.verified && S.statusFeature(w1, "dupev").tasks.list[1].verified === false, "re-verifying a duplicated number credits only the task it resolves to");
  // Round 2. The stamp is the title AND the _Verify:_: a copy-paste duplicate (same title, other command) can't
  // borrow the first one's run, and renumbering can't hand one task's passing run to the other (whose own
  // failed run is kept under `others`, never discarded).
  const rn = S.createFeature(w1, "Renum", ["core"]);
  const rnTasks = path.join(rn.dir, "tasks.md");
  const rnEv = () => JSON.parse(fs.readFileSync(path.join(rn.dir, ".state.json"), "utf8")).evidence;
  fs.writeFileSync(rnTasks, "- [ ] 3. a\n  - _Verify: node -e \"process.exit(7)\"_\n- [ ] 3. b\n  - _Verify: node -e \"process.exit(0)\"_\n");
  const rn1 = S.completeTask(w1, "renum", 3, { command: "node -e \"process.exit(7)\"", exitCode: 7 });
  const rn2 = S.completeTask(w1, "renum", 3);
  const rn3 = S.completeTask(w1, "renum", 3, { command: "node -e \"process.exit(0)\"", exitCode: 0 });
  fs.writeFileSync(rnTasks, fs.readFileSync(rnTasks, "utf8").replace("- [x] 3. b", "- [x] 4. b")); // as the duplicate-tasks warn advises
  const rnSeen = () => S.statusFeature(w1, "renum").tasks.list.map((t) => t.number + t.text + ":" + t.verified).join();
  const rnVs = S.verificationStatus(w1, "renum", rn.dir);
  ok(rn1.recorded && rn2.ok && rn2.unverifiedReason === "failed-run" && rn3.ok && rn3.verified && rnSeen() === "3a:false,4b:false" &&
    rnVs.unverifiedDetail.map((d) => d.number + ":" + d.reason).join() === "3:failed-run,4:no-evidence" &&
    rnEv()["3"].task === "b" && rnEv()["3"].others.length === 1 && rnEv()["3"].others[0].task === "a" && rnEv()["3"].others[0].exitCode === 7 && rnEv()["3"].others[0].history.length === 1,
    "after renumbering, #3 keeps its OWN failed run (kept under others) — never 'verified' by the other task's passing run");
  const rn4 = S.completeTask(w1, "renum", 4, { command: "node -e \"process.exit(0)\"", exitCode: 0 });
  const rn5 = S.completeTask(w1, "renum", 3, { command: "node -e \"process.exit(7)\"", exitCode: 0 });
  ok(rn4.verified && rn5.verified && rnSeen() === "3a:true,4b:true" && rnEv()["3"].task === "a" && rnEv()["3"].history.map((h) => h.exitCode).join() === "7,0" && rnEv()["3"].others[0].task === "b",
    "each task is verified only by its own passing run; the re-run task's history continues where it left off");
  fs.writeFileSync(rnTasks, "- [ ] 5. Run the checks\n  - _Verify: node -e \"process.exit(0)\"_\n- [ ] 5. Run the checks\n  - _Verify: node -e \"process.exit(7)\"_\n");
  const cp1 = S.completeTask(w1, "renum", 5, { command: "node -e \"process.exit(0)\"", exitCode: 0 });
  const cp2 = S.completeTask(w1, "renum", 5);
  ok(cp1.verified && cp2.ok && cp2.verified === false && cp2.unverifiedReason === "duplicate-number" &&
    S.specDoctor(w1, "renum").checks.find((c) => c.id === "verification").status === "warn",
    "a copy-paste duplicate (same number AND title, another _Verify:_) never borrows the first one's run");
  // Outside duplicates the _Verify:_ stamp alone decides: a title edit keeps the evidence, an edited command
  // doesn't (stale-evidence); an unstamped v1.12 record still counts.
  const sv = S.createFeature(w1, "Stale", ["core"]);
  const svTasks = path.join(sv.dir, "tasks.md");
  fs.writeFileSync(svTasks, "- [ ] 1. Build\n  - _Verify: npm test_\n- [x] 2. Legacy\n  - _Verify: npm run lint_\n");
  S.completeTask(w1, "stale", 1, { command: "npm test", exitCode: 0 });
  const svState = JSON.parse(fs.readFileSync(path.join(sv.dir, ".state.json"), "utf8"));
  svState.evidence["2"] = { command: "npm run lint", exitCode: 0, summary: "clean", at: "2026-01-01T00:00:00.000Z" };
  fs.writeFileSync(path.join(sv.dir, ".state.json"), JSON.stringify(svState));
  fs.writeFileSync(svTasks, "- [x] 1. Build the parser\n  - _Verify: npm test_\n- [x] 2. Legacy\n  - _Verify: npm run lint_\n");
  const svRenamed = S.statusFeature(w1, "stale").tasks.list.map((t) => t.verified).join();
  fs.writeFileSync(svTasks, "- [x] 1. Build the parser\n  - _Verify: npm run test:unit_\n- [x] 2. Legacy\n  - _Verify: npm run lint_\n");
  const svDoc = S.specDoctor(w1, "stale").checks.find((c) => c.id === "verification");
  const svAgain = S.completeTask(w1, "stale", 1);
  ok(svRenamed === "true,true" && S.statusFeature(w1, "stale").tasks.list[0].verified === false && /#1 \(evidence is for another task or _Verify:_ command\)/.test(svDoc.detail) &&
    svAgain.unverifiedReason === "stale-evidence" && /--run/.test(svAgain.note) && S.statusFeature(w1, "stale").tasks.list[1].verified === true,
    "a title edit keeps the evidence; an edited _Verify:_ command makes it stale-evidence; a v1.12 record without stamps still verifies");
  // Scanner: only a "<!--" that starts its line may span lines; an inline one ends with its paragraph (never
  // past the next task line), and a "-->" in a code span or fenced code is not a closer.
  const cmF = S.createFeature(w1, "Cmt", ["core"]);
  const cmTasks = path.join(cmF.dir, "tasks.md");
  const cmSeen = () => S.statusFeature(w1, "cmt").tasks.list.map((t) => t.number + (t.done ? "x" : "")).join();
  fs.writeFileSync(cmTasks, "- [x] 1. Strip <!-- markers in the parser\n- [ ] 2. Handle the `-->` closer\n- [ ] 3. Docs\n");
  const cm2 = S.completeTask(w1, "cmt", 2);
  ok(cm2.ok && cm2.next.number === 3 && cmSeen() === "1x,2x,3", "an inline '<!--' doesn't open a comment across task lines (a '-->' in inline code below doesn't close it)");
  fs.writeFileSync(cmTasks, "- [x] 1. Build the parser <!-- see notes\n- [ ] 2. Ship\n\n## Notes\n```html\n<!-- keep -->\n```\n");
  ok(cmSeen() === "1x,2" && S.statusFeature(w1, "cmt").phase === "executing" && S.listFeatures(w1).features.find((x) => x.name === "cmt").tasks === 2,
    "an inline '<!--' + a fenced '<!-- keep -->' below: the open task stays visible (phase executing, list 1/2)");
  fs.writeFileSync(cmTasks, "<!-- stray note\n- [x] 1. a\n- [ ] 2. b\n```html\n<!-- keep -->\n```\n");
  ok(cmSeen() === "1x,2", "a line-start '<!--' whose only '-->' sits in fenced code is plain text");
  fs.writeFileSync(cmTasks, "- [ ] 1. a <!-- example:\n  _Verify: node -e \"process.exit(3)\"_ -->\n- [ ] 2. b\n");
  const cmBlocks = S.taskBlocks(fs.readFileSync(cmTasks, "utf8"));
  ok(cmBlocks.length === 2 && cmBlocks[0].text === "a" && cmBlocks[0].body.length === 0 && S.taskBrief(w1, "cmt", 1).verify.length === 0, "an inline comment continued on the task's next line still hides its content (no hidden _Verify:_ runs)");
  const cmBig = Array.from({ length: 3000 }, (_, i) => "- [ ] " + (i + 1) + ". a <!-- b").join("\n") + "\n-->\n";
  ok(S.parseTasks(cmBig).length === 3000, "thousands of inline '<!--' followed by one '-->' are still thousands of tasks");
  // No literal U+FEFF in shipped engine code (the scan_skill hidden-unicode rule): the escape is used instead.
  const BOM = String.fromCharCode(0xfeff);
  const engineFiles = ["mcp/lib/spec.js", "mcp/lib/i18n.js", "mcp/server.js", "cli/dev-spec.js", "hooks/spec-hook.js", "hooks/precommit-check.js"]
    .map((f) => path.join(__dirname, "..", f)).filter((f) => fs.existsSync(f));
  ok(engineFiles.length >= 4 && engineFiles.every((f) => !fs.readFileSync(f, "utf8").includes(BOM)), "no literal U+FEFF (BOM) in the shipped engine files");
  // @wp WP1 <<<

  // @wp WP2 tests >>>
  { // --- 1.13 WP2: tracks, scaffolds & sections (own block scope: no name clashes with other packages) ---
  const w2 = path.join(tmp, "proj-wp2");
  const w2s = path.join(w2, ".specs");
  S.initProject(w2, ["core"], "en");
  const readW2 = (...p) => fs.readFileSync(path.join(w2s, ...p), "utf8");
  const stateW2 = (slug) => JSON.parse(readW2(slug, ".state.json"));
  const headingCount = (md, marker) => md.split(/\r?\n/).filter((l) => /^#{1,6}\s/.test(l) && l.includes(marker)).length;

  // (1) persisted tracks; legacy detection only trusts markers on real headings
  const pf1 = S.createFeature(w2, "Invoice export", ["tdd"]);
  ok(stateW2("invoice-export").tracks.join() === "core,tdd", "spec_create persists the track set in .state.json");
  const leg = S.createFeature(w2, "Legacy Diagram", ["core"]);
  fs.writeFileSync(path.join(leg.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: {} })); // a pre-1.13 feature
  fs.appendFileSync(path.join(leg.dir, "design.md"), "\n```mermaid\ngraph TD\n  UI --> X[AI]\n  X --> Q[SaaS]\n```\nThe [AI] helper is out of scope.\n");
  const legDoc = S.specDoctor(w2, "legacy-diagram");
  const legAdd = S.addTrack(w2, "legacy-diagram", "ai");
  ok(legDoc.tracks === "core" && !legDoc.checks.some((c) => c.id === "ai-sections" || c.id === "saas-sections") && legAdd.addedTracks.join() === "ai" &&
    headingCount(fs.readFileSync(path.join(leg.dir, "design.md"), "utf8"), "[AI]") === 10,
    "a Mermaid node X[AI] / prose [AI] no longer switches a track on (doctor, add_track 'already on')");

  // (2) track input: arrays or strings, split on space/comma/'+', case-insensitive; unknown → did-you-mean
  ok(S.parseTracks("tdd,saas").tracks.join() === "core,tdd,saas" && S.parseTracks("+SaaS +ai").tracks.join() === "core,saas,ai" &&
    S.parseTracks(["tdd saas"]).tracks.join() === "core,tdd,saas" && S.parseTracks(["TDD", "+ai"]).tracks.join() === "core,tdd,ai",
    "track input is split on whitespace, commas and '+' (arrays and strings), case-insensitive, core implied");
  const badCreate = S.createFeature(w2, "Typo Feature", "tdd,sass");
  ok(badCreate.ok === false && /'sass'/.test(badCreate.error) && /did you mean 'saas'/.test(badCreate.error) && /core, tdd, saas, ai/.test(badCreate.error) &&
    !fs.existsSync(path.join(w2s, "typo-feature")), "an unknown track is an error with a did-you-mean (nothing scaffolded, no silent drop)");
  const mcpBad = await rpc("tools/call", { name: "spec_create", arguments: { name: "Typo MCP", tracks: ["sass"], projectDir: w2 } });
  const mcpBadInit = payload(await rpc("tools/call", { name: "spec_init", arguments: { tracks: ["ia"], projectDir: w2 } }));
  const mcpBadAdd = payload(await rpc("tools/call", { name: "spec_add_track", arguments: { name: "invoice-export", track: "sass", projectDir: w2 } }));
  ok(mcpBad.result.isError === true && /did you mean 'saas'/.test(mcpBad.result.content[0].text) && /did you mean 'ai'/.test(mcpBadInit.error) && /did you mean 'saas'/.test(mcpBadAdd.error),
    "MCP spec_create / spec_init / spec_add_track reject unknown tracks the same way");
  const ptW2 = path.join(tmp, "proj-wp2-pt");
  S.initProject(ptW2, ["core"], "pt");
  ok(/querias dizer 'saas'/.test(S.createFeature(ptW2, "Exportar", ["sass"]).error), "the unknown-track error is localized (PT)");

  // (3) spec_create on an EXISTING feature with new tracks → the add_track path (never overwrites)
  const reqBefore = readW2("invoice-export", "requirements.md");
  const again3 = S.createFeature(w2, "Invoice export", "saas");
  const des3 = readW2("invoice-export", "design.md");
  ok(again3.ok && again3.label === "core +tdd +saas" && again3.addedTracks.join() === "saas" && headingCount(des3, "[SaaS]") === 5 &&
    fs.existsSync(path.join(w2s, "invoice-export", "load-test.md")) && stateW2("invoice-export").tracks.join() === "core,tdd,saas" &&
    readW2("invoice-export", "requirements.md") === reqBefore && /already existed/.test(again3.note),
    "spec_create with a new track on an existing core+tdd feature adds it (design sections, load-test, state) — label [core +tdd +saas]");
  const same3 = S.createFeature(w2, "Invoice export", "tdd");
  ok(same3.ok && !same3.addedTracks && same3.created.length === 0 && same3.label === "core +tdd +saas", "spec_create with no new track keeps the plain additive behavior");

  // (4) add_track completeness: Active Tracks line, steering, template tasks once, localized bugfix design title
  const tasks4 = readW2("invoice-export", "tasks.md");
  ok(/^## Active Tracks\ncore \+tdd \+saas$/m.test(readW2("invoice-export", "classification.md")) &&
    ["scale.md", "observability.md", "cost.md"].every((x) => fs.existsSync(path.join(w2s, "steering", x))) &&
    (tasks4.match(/## Story US-1 — Observability & Scale/g) || []).length === 1 && /- \[ \] 7\. \[US1\] Emit metrics/.test(tasks4),
    "add_track path updates classification Active Tracks, scaffolds the track's steering and appends its template tasks (numbered on)");
  const tr4 = S.traceCheck(w2, "invoice-export");
  S.addTrack(w2, "invoice-export", "saas"); S.createFeature(w2, "Invoice export", "saas");
  ok(tr4.phantomAcsInTasks.length === 0 && (readW2("invoice-export", "tasks.md").match(/Observability & Scale/g) || []).length === 1,
    "appended track tasks never cite ACs the spec lacks (no phantom IDs) and are appended only once");
  const pt4 = S.createFeature(ptW2, "Painel", ["core"]);
  S.addTrack(ptW2, "painel", "ai");
  ok(/^## Tracks Ativos\ncore \+ai$/m.test(fs.readFileSync(path.join(pt4.dir, "classification.md"), "utf8")) &&
    /## História US-1 — IA/.test(fs.readFileSync(path.join(pt4.dir, "tasks.md"), "utf8")), "add_track updates the PT 'Tracks Ativos' line and appends the PT task block");
  const esW2 = path.join(tmp, "proj-wp2-es");
  S.initProject(esW2, ["core"], "es");
  const esBug = S.createFeature(esW2, "Error de pago", undefined, "falla el cobro", undefined, undefined, "bugfix");
  S.addTrack(esW2, "error-de-pago", "saas");
  const esPagos = S.createFeature(esW2, "Pagos", ["core"]);
  S.addTrack(esW2, "pagos", "tdd");
  ok(/^# Diseño: /.test(fs.readFileSync(path.join(esBug.dir, "design.md"), "utf8")) && /^## Tracks Activos\ncore \+tdd$/m.test(fs.readFileSync(path.join(esPagos.dir, "classification.md"), "utf8")) &&
    fs.existsSync(path.join(esW2, ".specs", "steering", "testing-standards.md")),
    "add_track on a bugfix writes a localized design title (ES '# Diseño:'); the ES 'Tracks Activos' line and steering follow");

  // (5) removal: non-destructive, core can't go, a bugfix keeps +tdd; doctor/status/next_action stop requiring it
  const rmSaas = payload(await rpc("tools/call", { name: "spec_add_track", arguments: { name: "invoice-export", track: "saas", remove: true, projectDir: w2 } }));
  const docRm = S.specDoctor(w2, "invoice-export");
  ok(rmSaas.ok && rmSaas.removedTracks.join() === "saas" && rmSaas.tracks === "core +tdd" && rmSaas.inactive.includes("load-test.md") &&
    rmSaas.inactive.some((x) => /\[SaaS\]/.test(x)) && fs.existsSync(path.join(w2s, "invoice-export", "load-test.md")) &&
    headingCount(readW2("invoice-export", "design.md"), "[SaaS]") === 5 && stateW2("invoice-export").tracks.join() === "core,tdd" &&
    /^## Active Tracks\ncore \+tdd$/m.test(readW2("invoice-export", "classification.md")),
    "spec_add_track remove:true turns +saas off — every file kept, inactive artifacts listed, state + Active Tracks updated");
  ok(!docRm.checks.some((c) => c.id === "saas-sections") && S.statusFeature(w2, "invoice-export").scaleSections === null &&
    !/\*\*invoice-export\*\* — design has unfilled/.test(S.renderRoadmapMd(w2, "en")),
    "after removal doctor/status/roadmap stop requiring the +saas sections");
  const aiRm = S.createFeature(w2, "Ai Gone", ["ai"]);
  S.approvePhase(w2, "ai-gone", "requirements", undefined, { force: true }); S.approvePhase(w2, "ai-gone", "design", undefined, { force: true }); // templates: 1.13 gate
  S.removeTrack(w2, "ai-gone", "ai");
  ok(!S.specDoctor(w2, "ai-gone").pendingGates.includes("eval-plan") && !/eval-plan/.test(S.nextAction(w2, "ai-gone").recommendation) && fs.existsSync(path.join(aiRm.dir, "eval-plan.md")),
    "an inactive track's artifact is no longer an approval gate (doctor, next_action) — and it is still on disk");
  const vBug = path.join(tmp, "proj-v112");
  ok(S.addTrack(w2, "invoice-export", "core", { remove: true }).ok === false && /core/.test(S.addTrack(w2, "invoice-export", "core", { remove: true }).error) &&
    S.removeTrack(vBug, "login-loop", "tdd").ok === false && /bugfix/i.test(S.removeTrack(vBug, "login-loop", "tdd").error),
    "'core' can't be removed; a bugfix can't drop +tdd");

  // (6) placeholder helpers
  const phText = [
    "# Feature: x", "## Summary", "[1-2 sentences: what this does and why it matters]",
    "1. **US-1.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behavior] within $[0.03]",
    "- [ ] tick me · - see [RFC 7519](https://x) ![img](a.png) [ref][r1] [r1] [^1] [[Wiki]] `code [x]` items[0]",
    "- [x] done [US1][P] [shared] [SaaS] [AI] [US-1.AC-1, T-01] [NEEDS CLARIFICATION: which?] [P1] [US-2]",
    "> **TODO** — replace me", "<!-- [inside comment] -->", "```", "[inside fence]", "```", "[r1]: https://example.com",
    "| T-01 | unit | `[path]` |", "> [!NOTE] a callout",
  ].join("\n");
  const ph = S.placeholderReport(phText).map((p) => p.line + ":" + p.text);
  ok(ph.join("|") === "3:[1-2 sentences: what this does and why it matters]|4:[trigger]|4:[behavior]|4:[0.03]|7:> **TODO** — replace me|13:[path]",
    "placeholderReport flags bracketed prose + the TODO sentinel, never links/refs/footnotes/checkboxes/tags/IDs/NEEDS CLARIFICATION/comments/fences (got " + ph.join("|") + ")");
  const ptReqFresh = fs.readFileSync(path.join(pt4.dir, "requirements.md"), "utf8");
  const esReqFresh = fs.readFileSync(path.join(esBug.dir, "requirements.md"), "utf8");
  ok(S.artifactState(path.join(w2s, "nope.md")) === "missing" && S.artifactState({ file: path.join(pt4.dir, "requirements.md") }) === "placeholder" &&
    S.artifactState({ text: esReqFresh }) === "placeholder" && S.artifactState({ text: "# Title\n\n## Summary\n" }) === "placeholder" &&
    S.artifactState({ text: "## Summary\nShips invoices as CSV.\n" }) === "filled" && S.artifactState({ text: "## A\nsame text\n" }, { template: "## A\n  same   text" }) === "placeholder" &&
    S.placeholderReport(ptReqFresh).length > 10, "artifactState: missing / placeholder (EN/PT/ES templates, heading-only, == template) / filled");

  // (7) phase + % for fresh scaffolds; template track tasks are placeholder tasks
  const fr = ["saas", "ai", "tdd"].map((t) => S.createFeature(w2, "Fresh " + t, [t]));
  const rmv7 = S.roadmap(w2).features;
  ok(fr.every((x) => S.statusFeature(w2, x.slug).phase === "requirements") && fr.every((x) => rmv7.find((f) => f.name === x.slug).percent === 8),
    "a fresh +saas/+ai/+tdd scaffold is in 'requirements' at 8% (not tasks-ready 30% / test-plan 20%)");
  ok(S.isPlaceholderTask("[US1] Emit metrics, add dashboard, configure alerts") && S.isPlaceholderTask("[US1] Monitorização de custo — emitir métrica de custo + alerta") &&
    !S.isPlaceholderTask("[shared] Reproduce the bug reliably and write the steps in bug.md → Reproduction") && !S.isPlaceholderTask("[US1] Emit invoice metrics to Prometheus"),
    "template track tasks count as placeholders (EN/PT) until edited; the verbatim bugfix steps are the method, not placeholders");
  fs.writeFileSync(path.join(fr[0].dir, "requirements.md"), "## Summary\nExport invoices.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN asked THE SYSTEM SHALL export CSV.\n");
  const ph7a = S.statusFeature(w2, fr[0].slug).phase;
  fs.appendFileSync(path.join(fr[0].dir, "tasks.md"), "\n## Real\n- [ ] 20. [US1] Build the CSV writer\n  - _Requirements: US-1.AC-1_\n");
  ok(ph7a === "design" && S.statusFeature(w2, fr[0].slug).phase === "tasks-ready", "filled requirements → 'design'; one real task → 'tasks-ready' (task-driven model kept)");

  // (8) listFeatures ignores dot-folders and non-addressable names; _archive and legacy slugs keep working
  fs.mkdirSync(path.join(w2s, ".obsidian"), { recursive: true });
  fs.mkdirSync(path.join(w2s, "My Notes"), { recursive: true });
  fs.mkdirSync(path.join(w2s, "fatura-o"), { recursive: true });
  const lf8 = S.listFeatures(w2);
  ok(!lf8.features.some((f) => f.name === ".obsidian" || f.name === "My Notes") && lf8.features.some((f) => f.name === "fatura-o") &&
    lf8.ignored.join() === "My Notes" && !S.roadmap(w2).features.some((f) => f.name === ".obsidian"),
    "listFeatures/roadmap skip .obsidian and 'My Notes' (reported as ignored); legacy slug folders stay listed");

  // (9) extractSection never matches the H1 title
  const wk = S.createFeature(w2, "Weekly summary email", ["core"]);
  const ptWk = S.createFeature(ptW2, "Resumo semanal", ["core"]);
  ok(S.finishFeature(w2, wk.slug).mergeTitle === "feat(weekly-summary-email): weekly-summary-email" && !/##/.test(S.finishFeature(ptW2, ptWk.slug).mergeTitle) &&
    S.extractSection("# Feature: Weekly summary email\n\n## Summary\nReal one.\n", ["summary"]).trim() === "Real one." &&
    S.extractSection("## [AI] 3. Token Economics\nx\n## Tokens\ny", ["token economics"]).trim() === "x" && S.extractSection("## Fixtures\nz", ["fix"]) === null,
    "extractSection skips the H1 (feature names contain synonyms), matches after marker/numbering, at a word boundary");
  const aiRef = S.createFeature(w2, "Ai Reference", ["ai"]);
  fs.copyFileSync(path.join(root, "skills", "dev-spec-driven", "references", "mandatory-ai-design-sections.md"), path.join(aiRef.dir, "design.md"));
  ok(S.specDoctor(w2, "ai-reference").checks.find((c) => c.id === "ai-sections").status === "pass", "the AI reference design ('## Section 1: Model Strategy' headings) still has all 10 sections filled");
  const fx = S.createFeature(w2, "Fix login crash", undefined, "crash on login", undefined, "en", "bugfix");
  const fxBug = path.join(fx.dir, "bug.md");
  fs.writeFileSync(fxBug, fs.readFileSync(fxBug, "utf8").replace(/## Fix\n\[[^\n]*\]/, "## Fix\nGuard the null session."));
  const fxSum = S.finishFeature(w2, fx.slug).mergeSummary;
  ok(/## Fix\nGuard the null session\.\n/.test(fxSum) && !/## Reproduction/.test(fxSum) && !/# Bug:/.test(fxSum), "a bugfix named 'Fix …' gets only its Fix section in the merge summary");

  // (10) status reports present AND filled, agreeing with doctor
  const st10 = S.statusFeature(w2, fr[0].slug);
  const doc10 = S.specDoctor(w2, fr[0].slug).checks.find((c) => c.id === "saas-sections");
  ok(st10.scaleSections.every((s) => s.present && s.filled === false) && doc10.status === "fail" && S.statusFeature(fDir, "tpl").scaleSections.every((s) => s.filled),
    "status scaleSections carry present + filled (fresh: present, unfilled — same as doctor; the filled template: all filled)");

  // (11) creating a feature removes its backlog entry
  S.backlog(w2, "add", "SSO Login", "SAML");
  S.backlog(w2, "add", "Exports v2");
  const sso = S.createFeature(w2, "sso-login", ["core"]);
  ok(sso.removedFromBacklog.join() === "SSO Login" && S.backlog(w2).backlog.map((b) => b.name).join() === "Exports v2", "spec_create drops the backlog item with the same slug");

  // --- review fixes ---
  // placeholderReport: literals in code spans and number intervals are code/data, not placeholders
  const lit = S.placeholderReport('returns `[]`, `["read", "write"]`, `[0, 1]`, `[chunk:ID]` or `[a-z]`; score in [0, 1]; file `[path]`; slot: []; ≥ [85]%').map((x) => x.text);
  ok(lit.join("|") === "[path]|[]|[85]",
    "placeholderReport: code-span literals ([], [\"a\"], [0, 1], [chunk:ID], [a-z]) and number intervals are not placeholders; `[path]`, a bare [] slot and [85] still are (got " + lit.join("|") + ")");
  const keys = S.createFeature(w2, "Keys", ["core"]);
  fs.writeFileSync(path.join(keys.dir, "requirements.md"), "# Feature: Keys\n\n## Summary\nList API keys.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a tenant has no keys THE SYSTEM SHALL return `[]`.\n");
  ok(S.statusFeature(w2, keys.slug).phase === "design", "an AC that returns `[]` does not send a filled feature back to 'requirements'");
  // inline code is code even when it is bracketed words; only the templates' own `[path]`/`[caminho]`/`[ruta]` open up
  const words = S.placeholderReport("xUnit `[Fact]` · `[Authorize]` · Cargo `[dependencies]` · ini `[database]` · regex `[aeiou]` · `[Serializable]` `[HttpGet]`; PT `[caminho]`, ES `[ruta]`").map((x) => x.text);
  ok(words.join("|") === "[caminho]|[ruta]", "placeholderReport: C# attributes, TOML/INI tables and regex classes in code spans are code; PT `[caminho]` / ES `[ruta]` still are placeholders (got " + words.join("|") + ")");
  const auth = S.createFeature(w2, "Auth keys", ["core"]);
  fs.writeFileSync(path.join(auth.dir, "requirements.md"), "# Feature: Auth keys\n\n## Summary\nOnly callers passing the `[Authorize]` filter may list keys.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN an admin lists keys THE SYSTEM SHALL return them.\n");
  fs.writeFileSync(path.join(auth.dir, "design.md"), "# Design: Auth keys\n\n## Overview\nA GET endpoint on KeysController.\n");
  ok(S.artifactState({ file: path.join(auth.dir, "requirements.md") }) === "filled" && S.statusFeature(w2, auth.slug).phase === "design" &&
    S.roadmap(w2).features.find((x) => x.name === auth.slug).percent === 16,
    "an `[Authorize]` code span leaves requirements.md 'filled': phase 'design' (16%), not back at 'requirements'");

  // a NEW bugfix given extra tracks gets them — the same command twice gives the same track set
  const bf1 = S.createFeature(w2, "Login crash", ["saas"], "crash", undefined, "en", "bugfix");
  const bf2 = S.createFeature(w2, "Login crash", ["saas"], "crash", undefined, "en", "bugfix");
  ok(bf1.label === "core +tdd +saas" && bf2.label === bf1.label && !bf2.addedTracks && stateW2("login-crash").tracks.join() === "core,tdd,saas" &&
    /^# Design: Login crash/.test(readW2("login-crash", "design.md")) && headingCount(readW2("login-crash", "design.md"), "[SaaS]") === 5 &&
    fs.existsSync(path.join(w2s, "login-crash", "load-test.md")) && /## Story US-1 — Observability & Scale/.test(readW2("login-crash", "tasks.md")),
    "a new bugfix given +saas scaffolds it (design sections, load-test, tasks); a re-run gives the same [core +tdd +saas]");

  // a fully planned bugfix reaches tasks-ready: its verbatim steps count once requirements + test plan are filled
  const ns = S.createFeature(w2, "Null session", undefined, "crash on login", undefined, "en", "bugfix");
  const ns0 = S.statusFeature(w2, ns.slug).phase;
  const fillNs = (rel, fn) => fs.writeFileSync(path.join(ns.dir, rel), fn(fs.readFileSync(path.join(ns.dir, rel), "utf8")));
  fillNs("requirements.md", (s) => s.replace("[the condition that triggers the bug]", "the session is null").replace("[the correct behavior]", "redirect to /login")
    .replace("[the neighbouring behavior that already worked]", "a normal login").replace("[nearby inputs that must keep working]", "an expired session"));
  const ns1 = S.statusFeature(w2, ns.slug).phase;
  fillNs("test-plan.md", (s) => s.replace(/\[unit\/integration\]/g, "unit").replace(/`\[path\]`/g, "`test/session.test.js`"));
  ok(ns0 === "requirements" && ns1 === "test-plan" && S.statusFeature(w2, ns.slug).phase === "tasks-ready" && S.roadmap(w2).features.find((x) => x.name === ns.slug).percent === 30,
    "bugfix phase: fresh → requirements, requirements filled → test-plan, test plan filled → tasks-ready (30%) with the steps kept verbatim");
  // the same bugfix planned with +saas, then +saas removed: its design.md held only the track's sections — out of the chain
  const nsS = S.createFeature(w2, "Null session saas", ["saas"], "crash on login", undefined, "en", "bugfix");
  for (const rel of ["requirements.md", "test-plan.md"]) fs.copyFileSync(path.join(ns.dir, rel), path.join(nsS.dir, rel));
  const nsS0 = S.statusFeature(w2, nsS.slug).phase;
  S.removeTrack(w2, nsS.slug, "saas");
  const nsS1 = S.statusFeature(w2, nsS.slug);
  ok(nsS0 === "design" && nsS1.phase === "tasks-ready" && nsS1.tracks === "core +tdd" && S.roadmap(w2).features.find((x) => x.name === nsS.slug).percent === 30 &&
    fs.existsSync(path.join(nsS.dir, "design.md")),
    "a bugfix planned with +saas waits on its [SaaS] design sections; once +saas is removed it reaches tasks-ready (30%) like a plain bugfix (design.md kept)");
  // …but a regular feature whose design.md is only headings is still in 'design' (+tdd: a wrong skip would say 'test-plan')
  const hd = S.createFeature(w2, "Headings only", ["tdd"]);
  fs.writeFileSync(path.join(hd.dir, "requirements.md"), "## Summary\nX.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN asked THE SYSTEM SHALL answer.\n");
  fs.writeFileSync(path.join(hd.dir, "design.md"), "# Design: Headings only\n\n## Overview\n");
  ok(S.statusFeature(w2, hd.slug).phase === "design", "only a bugfix drops a headings-only design.md from the chain; a feature's stays open at 'design'");

  // localized removal / create-on-existing messages (PT, ES)
  const ptRel = S.createFeature(ptW2, "Relatórios", ["saas"]);
  const ptRelRm = S.addTrack(ptW2, ptRel.slug, "saas", { remove: true });
  ok(/^Tracks desativados: \+saas\. Nenhum ficheiro foi apagado/.test(ptRelRm.note) && S.addTrack(ptW2, ptRel.slug, "core", { remove: true }).error === "O 'core' está sempre ativo — não pode ser removido." &&
    /^Não ativo: \+ai/.test(S.addTrack(ptW2, ptRel.slug, "ai", { remove: true }).note), "removal messages follow the feature language (PT: removed, core, not active)");
  S.createFeature(esW2, "Exportar", ["core"]);
  const esAgain = S.createFeature(esW2, "Exportar", ["saas"]);
  ok(/^'exportar' ya existía — tracks añadidos: \+saas/.test(esAgain.note) && esAgain.addedTracks.join() === "saas" &&
    S.removeTrack(esW2, "error-de-pago", "tdd").error === "Un bugfix es siempre test-first — no se puede quitar +tdd.",
    "create-on-existing note and the bugfix +tdd refusal are localized (ES)");

  // roadmap: planned-but-not-started (tasks-ready, 0 done) is its own state — never ⬜ next to 30%
  const pl = S.createFeature(w2, "Planned export", ["saas"]);
  fs.appendFileSync(path.join(pl.dir, "tasks.md"), "\n- [ ] 20. [US1] Build the CSV writer\n");
  const mdEn = S.renderRoadmapMd(w2, "en");
  const plRow = mdEn.split("\n").find((l) => l.includes("[planned-export]")) || "";
  ok(/^\| 📋 \|/.test(plRow) && / 30% /.test(plRow) && /📋 planned · ⬜ not started/.test(mdEn) && !mdEn.split("\n").some((l) => /^\| ⬜ \|.* 30% /.test(l)) &&
    /📋 planeada/.test(S.renderRoadmapMd(w2, "pt")) && /planificada/.test(S.renderRoadmapHtml(w2, "es")),
    "a planned feature (tasks-ready, nothing done) shows 📋 planned at 30% — never ⬜ (MD EN/PT, HTML ES)");

  // after removing a track, its leftover [SaaS] TODO sections don't hold the phase at 'design'
  const ex6 = S.createFeature(w2, "Export six", ["tdd", "saas"]);
  fs.writeFileSync(path.join(ex6.dir, "requirements.md"), "## Summary\nExport.\n\n## Acceptance Criteria\n1. **US-1.AC-1** — WHEN asked THE SYSTEM SHALL export CSV.\n");
  const d6 = fs.readFileSync(path.join(ex6.dir, "design.md"), "utf8");
  fs.writeFileSync(path.join(ex6.dir, "design.md"), "# Design: Export six\n\n## Overview\nA nightly job.\n\n" + d6.slice(d6.search(/^## \[SaaS\]/m)));
  const ph6 = S.statusFeature(w2, ex6.slug).phase;
  S.removeTrack(w2, ex6.slug, "saas");
  ok(ph6 === "design" && S.statusFeature(w2, ex6.slug).phase === "test-plan", "phase judges design.md on its active part: removing +saas moves 'design' on to 'test-plan'");

  // a removed track's task block is inactive: not next, not progress, not a finish blocker — and back when re-added
  const chat = S.createFeature(w2, "Chat seven", ["ai"]);
  const t7 = path.join(chat.dir, "tasks.md");
  const raw7 = fs.readFileSync(t7, "utf8");
  const aiNums7 = S.parseTasks(raw7.split("## Story US-1 — AI")[1].split(/\n## /)[0]).map((t) => t.number);
  fs.writeFileSync(t7, raw7.replace(/- \[ \] (\d+)\./g, (m, n) => (aiNums7.includes(+n) ? m : `- [x] ${n}.`)));
  const rm7 = S.removeTrack(w2, chat.slug, "ai");
  const st7 = S.statusFeature(w2, chat.slug);
  const ct7 = S.completeTask(w2, chat.slug, 1);
  ok(aiNums7.length === 2 && rm7.inactive.includes("tasks.md (Story US-1 — AI)") && S.nextTask(w2, chat.slug).next === null && st7.tasks.done === st7.tasks.total &&
    st7.phase === "complete" && !S.finishFeature(w2, chat.slug).blockers.some((b) => /open tasks/.test(b)) && ct7.next === null && ct7.done === ct7.total &&
    S.roadmap(w2).features.find((x) => x.name === chat.slug).percent === 100,
    "after add_track --remove the track's template tasks stop counting (next_task, status, complete_task, finish, roadmap)");
  const br7 = S.taskBrief(w2, chat.slug);
  const br7n = S.taskBrief(w2, chat.slug, aiNums7[0]);
  ok(br7.ok && br7.task === null && br7.note === "All tasks are done — nothing to brief." && br7n.ok && br7n.task.number === aiNums7[0],
    "spec_task_brief with no number agrees with next_task (removed track's block is not 'next'); an explicit number still reaches it");
  S.addTrack(w2, chat.slug, "ai");
  ok(S.nextTask(w2, chat.slug).next.number === aiNums7[0] && (fs.readFileSync(t7, "utf8").match(/## Story US-1 — AI/g) || []).length === 1 &&
    S.taskBrief(w2, chat.slug).task.number === aiNums7[0],
    "re-adding the track brings its task block back into play (next_task and brief; never appended twice)");

  // prototype keys never produce a did-you-mean
  const ctor = S.createFeature(w2, "Ctor", ["constructor"]);
  ok(S.parseTracks("constructor").unknown[0].suggestion === null && S.parseTracks("__proto__").unknown[0].suggestion === null && ctor.ok === false && !/did you mean/.test(ctor.error),
    "'constructor' / '__proto__' are unknown tracks without a did-you-mean");

  // a .state.json that parses but isn't an object is refused — never a removal that "succeeds" without saving
  const arr = S.createFeature(w2, "Array state", ["saas"]);
  fs.writeFileSync(path.join(arr.dir, ".state.json"), "[]");
  const arrRm = S.removeTrack(w2, arr.slug, "saas");
  const arrAdd = S.addTrack(w2, arr.slug, "ai");
  const arrCreate = S.createFeature(w2, "Array state", ["ai"]);
  const ptArr = S.createFeature(ptW2, "Estado lista", ["saas"]);
  fs.writeFileSync(path.join(ptArr.dir, ".state.json"), "[1]");
  ok(arrRm.ok === false && /array-state\/\.state\.json has an unexpected shape \(the top level must be an object\)/.test(arrRm.error) && arrAdd.ok === false && arrCreate.ok === false &&
    readW2(arr.slug, ".state.json") === "[]" && !fs.existsSync(path.join(arr.dir, "eval-plan.md")) && /nível de topo tem de ser um objeto/.test(S.removeTrack(ptW2, ptArr.slug, "saas").error),
    "add_track / remove / create-with-new-tracks refuse a non-object .state.json (nothing written; PT message)");

  // a case-only folder name ('Billing/') stays listed where the slug reaches it (case-insensitive FS), ignored where it can't
  const caseInsensitive = fs.existsSync(path.join(w2s, "INVOICE-EXPORT"));
  const bil = S.createFeature(w2, "Billing", ["core"]);
  fs.renameSync(bil.dir, path.join(w2s, "Billing"));
  const lf11 = S.listFeatures(w2);
  ok(caseInsensitive ? lf11.features.some((f) => f.name === "Billing") && S.statusFeature(w2, "billing").ok && !(lf11.ignored || []).includes("Billing")
    : !lf11.features.some((f) => f.name === "Billing") && lf11.ignored.includes("Billing"),
    "listFeatures keeps a case-only folder name when 'billing' reaches it (" + (caseInsensitive ? "case-insensitive" : "case-sensitive") + " FS)");
  { // merge follow-up: a removed track's ticked-without-evidence task is not an unverified gap
    const vt = S.createFeature(w2, "Verify inactive", ["saas"]);
    const vtTasks = path.join(vt.dir, "tasks.md");
    const allNums = S.statusFeature(w2, vt.slug).tasks.list.map((t) => t.number);
    S.removeTrack(w2, vt.slug, "saas");
    const activeNums = S.statusFeature(w2, vt.slug).tasks.list.map((t) => t.number);
    const inactive = allNums.find((n) => !activeNums.includes(n));
    // tick one of the removed track's tasks without evidence, and give it a runnable _Verify:_
    const vl = fs.readFileSync(vtTasks, "utf8").split("\n");
    const at = vl.findIndex((l) => new RegExp("^\\s*- \\[ \\] " + inactive + "\\.").test(l));
    if (at >= 0) { vl[at] = vl[at].replace("- [ ]", "- [x]"); vl.splice(at + 1, 0, "  - _Verify: npm test_"); }
    fs.writeFileSync(vtTasks, vl.join("\n"));
    ok(inactive != null && at >= 0 && S.verificationStatus(w2, vt.slug, vt.dir).unverified.length === 0,
      "verificationStatus ignores the tasks of a removed track (inactive, not a gap)");
  }
  }
  // @wp WP2 <<<

  // @wp WP3 tests >>>
  { // --- 1.13 WP3: robustness — MCP argument validation, prototype keys, JSON shapes, depend, evals, pre-commit ---
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    const errText = (res) => { try { return JSON.parse(res.result.content[0].text).error || ""; } catch { return res.result.content[0].text; } };
    const body = (res) => { try { return payload(res); } catch { return { ok: false, error: res.result.content[0].text }; } };
    const safe = (fn) => { try { return fn(); } catch (e) { return { ok: false, threw: true, error: "THREW: " + e.message }; } }; // a regression must FAIL, not crash the run
    const w3 = path.join(tmp, "proj-wp3");
    S.initProject(w3, ["tdd"], "en");
    const w3f = S.createFeature(w3, "Arg Check", ["core"]);
    const w3Tasks = path.join(w3f.dir, "tasks.md");
    fs.writeFileSync(w3Tasks, "- [ ] 1. a\n- [ ] 2. b\n");

    // 1. Argument types are checked against the advertised inputSchema before dispatch.
    const r19 = await call("spec_complete_task", { name: "arg-check", number: 1.9, projectDir: w3 });
    ok(r19.result.isError && /number must be an integer \(got 1\.9\)/.test(errText(r19)) && S.nextTask(w3, "arg-check").next.number === 1,
      "MCP rejects number 1.9 (not an integer) instead of ticking task 1");
    const rObj = await call("spec_create", { name: { a: 1 }, projectDir: w3 });
    ok(rObj.result.isError && /name must be a string/.test(errText(rObj)) && !fs.existsSync(path.join(w3, ".specs", "object-object")),
      "MCP rejects an object name (no .specs/object-object/)");
    const rCap = await call("spec_scan", { cap: "abc", projectDir: w3 });
    const rCap0 = await call("spec_scan", { cap: 0, projectDir: w3 });
    ok(rCap.result.isError && /cap must be an integer/.test(errText(rCap)) && rCap0.result.isError && /≥ 1/.test(errText(rCap0)),
      "MCP rejects cap 'abc' and cap 0 (both scanned 0 files)");
    const rText = await call("ears_validate", { text: 123 });
    ok(rText.result.isError && /text must be a string/.test(errText(rText)) && !/trim/.test(errText(rText)), "MCP rejects a numeric text (no 'text.trim is not a function')");
    const rDepStr = await call("spec_depend", { name: "arg-check", dependsOn: "steering", projectDir: w3 });
    ok(rDepStr.result.isError && /dependsOn must be an array/.test(errText(rDepStr)), "MCP rejects dependsOn given as a string");
    const rEnum = await call("spec_create", { name: "Enum Check", tracks: ["tdd", "quantum"], projectDir: w3 });
    // tracks carry no schema enum (the engine splits "tdd,saas" and answers with a did-you-mean), but the bad item is still named
    ok(rEnum.result.isError && /'quantum'/.test(errText(rEnum)) && /core, tdd, saas, ai/.test(errText(rEnum)) && !fs.existsSync(path.join(w3, ".specs", "enum-check")),
      "an unknown track item is rejected and named (nothing scaffolded)");
    const rNested = await call("spec_complete_task", { name: "arg-check", number: 2, evidence: { command: "npm test", exitCode: "0" }, projectDir: w3 });
    ok(rNested.result.isError && /evidence\.exitCode must be an integer/.test(errText(rNested)) && /- \[ \] 2\./.test(fs.readFileSync(w3Tasks, "utf8")),
      "nested object properties are validated (evidence.exitCode)");
    const rExtra = await call("spec_list", { projectDir: w3, bogus: { deep: 1 } });
    ok(!rExtra.result.isError && body(rExtra).features.some((x) => x.name === "arg-check"), "unknown extra properties are ignored");
    const rArr = await call("spec_list", [w3]);
    ok(rArr.result.isError && /arguments must be a JSON object/.test(errText(rArr)), "non-object arguments are rejected");
    const w3pt = path.join(tmp, "proj-wp3-pt");
    S.initProject(w3pt, [], "pt");
    const rPt = await call("spec_create", { name: 5, projectDir: w3pt });
    ok(rPt.result.isError && /name tem de ser uma string/.test(errText(rPt)), "argument errors are localized (PT project)");
    const rPtMiss = await call("spec_create", { projectDir: w3pt });
    ok(rPtMiss.result.isError && /Argumento\(s\) obrigatório\(s\) em falta: name/.test(errText(rPtMiss)), "the missing-argument error is localized too (PT project)");
    fs.writeFileSync(w3Tasks, "- [ ] 1. a\n- [ ] 2. b\n");
    const rBig = await call("spec_complete_task", { name: "arg-check", number: 1e21, projectDir: w3 });
    const rBigBrief = await call("spec_task_brief", { name: "arg-check", number: 2e300, projectDir: w3 });
    ok(rBig.result.isError && /number must be an integer/.test(errText(rBig)) && /- \[ \] 1\./.test(fs.readFileSync(w3Tasks, "utf8")) &&
      rBigBrief.result.isError && /number must be an integer/.test(errText(rBigBrief)),
      "MCP rejects number 1e21 / 2e300 (parseInt('1e+21') is 1 — task 1 stays open, no brief for the wrong task)");

    // 2. User-controlled keys never index Object.prototype.
    const protoRes = [];
    for (const k of ["constructor", "__proto__", "toString", "hasOwnProperty"]) protoRes.push(await call("steering_scaffold", { file: k, projectDir: w3 }));
    ok(protoRes.every((r) => r.result.isError && /Unknown steering file/.test(errText(r)) && !/^ERROR|ERR_INVALID_ARG_TYPE/.test(r.result.content[0].text)),
      "steering_scaffold {file: constructor|__proto__|toString|hasOwnProperty} → the unknown-file error, not a TypeError");
    const ctorDir = path.join(tmp, "proj-wp3-ctor");
    S.createFeature(ctorDir, "constructor", ["core"]);
    S.createFeature(ctorDir, "other", ["core"]);
    const ctorDep = safe(() => S.setDependency(ctorDir, "constructor", ["other"]));
    const ctorJson = safe(() => JSON.parse(fs.readFileSync(path.join(ctorDir, ".specs", "roadmap.json"), "utf8")));
    ok(ctorDep.ok && ctorJson.features && Object.prototype.hasOwnProperty.call(ctorJson.features, "constructor") && ctorJson.features.constructor.dependsOn[0] === "other" &&
      Object.dependsOn === undefined && ({}).dependsOn === undefined,
      "a feature slugged 'constructor' is a plain roadmap key (no Object.prototype pollution, not lost on write)");
    const ctorCycle = safe(() => S.setDependency(ctorDir, "other", ["constructor"]));
    const ctorView = safe(() => S.roadmap(ctorDir));
    ok(/Circular/.test(ctorCycle.error || "") && ctorView.ok && ctorView.features.find((x) => x.name === "constructor").dependsOn[0] === "other",
      "the cycle check and the roadmap see the 'constructor' feature's deps");
    const ghostDir = path.join(tmp, "proj-wp3-ghost");
    S.createFeature(ghostDir, "a", ["core"]);
    fs.writeFileSync(path.join(ghostDir, ".specs", "roadmap.json"), JSON.stringify({ features: { a: { dependsOn: ["constructor"] } } }));
    let ghost = null;
    try { ghost = S.roadmap(ghostDir); } catch { /* crashed in findCycle */ }
    ok(ghost && ghost.features[0].unmetDeps.includes("constructor"), "a dep named 'constructor' that is not a feature is unmet — no crash in the cycle check");

    // 3. Valid JSON with the wrong shape is refused like unparseable JSON — before any destructive step.
    const shp = path.join(tmp, "proj-wp3-shape");
    S.createFeature(shp, "a", ["core"]);
    const shpRm = path.join(shp, ".specs", "roadmap.json");
    const badShape = JSON.stringify({ features: { b: null } });
    fs.writeFileSync(shpRm, badShape);
    const rmA = body(await call("spec_feature", { action: "remove", name: "a", projectDir: shp }));
    ok(rmA.ok === false && /unexpected shape/.test(rmA.error) && /features\.b/.test(rmA.error) && fs.existsSync(path.join(shp, ".specs", "a")) && fs.readFileSync(shpRm, "utf8") === badShape,
      "roadmap.json {features:{b:null}} → remove refuses BEFORE deleting the folder; the file is untouched");
    const shapes = [
      [{ features: { a: { dependsOn: "b" } } }, /features\.a\.dependsOn/],
      [{ features: { a: { dependsOn: ["b", 3] } } }, /features\.a\.dependsOn/],
      [{ features: [] }, /'features'/],
      [{ backlog: {} }, /'backlog'/],
      [{ backlog: [{ note: "x" }] }, /'backlog' entry/],
      [{ meta: "pt" }, /'meta'/],
      [[], /top level/],
    ];
    ok(shapes.every(([data, re]) => {
      fs.writeFileSync(shpRm, JSON.stringify(data));
      const before = fs.readFileSync(shpRm, "utf8");
      const results = [() => S.backlog(shp, "add", "X"), () => S.backlog(shp, "rm", "X"), () => S.setDependency(shp, "a", []), () => S.manageFeature(shp, "archive", "a"),
        () => S.initProject(shp, [], "es"), () => S.writeRoadmapMd(shp, "es"), () => S.writeRoadmapHtml(shp, "es")].map(safe);
      return results.every((r) => r.ok === false && !r.threw && re.test(r.error)) && fs.readFileSync(shpRm, "utf8") === before && fs.existsSync(path.join(shp, ".specs", "a"));
    }), "wrong-shaped roadmap.json (dependsOn / features / backlog / meta / top level) → every mutator refuses, the file is untouched");
    // spec_roadmap must surface a refused write (it used to answer ok:true, wrote:[]) — the CLI exits 1 on it.
    const rmRefused = [];
    const shpMd = path.join(shp, ".specs", "ROADMAP.md");
    const mdOf = () => (fs.existsSync(shpMd) ? fs.readFileSync(shpMd, "utf8") : null);
    for (const [bad, re] of [[badShape, /unexpected shape/], ['{"features":{"a":{}},}', /not valid JSON/]]) {
      fs.writeFileSync(shpRm, bad);
      const mdBefore = mdOf();
      const res = await call("spec_roadmap", { write: true, html: true, lang: "pt", projectDir: shp });
      rmRefused.push(res.result.isError && re.test(errText(res)) && fs.readFileSync(shpRm, "utf8") === bad && mdOf() === mdBefore && !fs.existsSync(path.join(shp, ".specs", "ROADMAP.html")));
    }
    ok(rmRefused.every(Boolean), "spec_roadmap {write, lang} on a wrong-shaped / unparseable roadmap.json → isError with the refusal, nothing written");
    fs.unlinkSync(shpRm);
    fs.writeFileSync(shpMd, "# My own roadmap\n");
    const rmHand = await call("spec_roadmap", { write: true, projectDir: shp });
    ok(rmHand.result.isError && /not generated by dev-spec/.test(errText(rmHand)) && mdOf() === "# My own roadmap\n",
      "spec_roadmap write over a hand-written ROADMAP.md → isError (same as the CLI), the file is untouched");
    fs.unlinkSync(shpMd);
    fs.writeFileSync(path.join(shp, ".specs", "ROADMAP.html"), "<p>mine</p>");
    const rmHtml = body(await call("spec_roadmap", { write: true, html: true, projectDir: shp }));
    ok(rmHtml.ok && rmHtml.wrote.length === 1 && /ROADMAP\.md$/.test(rmHtml.wrote[0]) && /ROADMAP\.html exists and was not generated/.test((rmHtml.warnings || []).join()),
      "a hand-written ROADMAP.html is skipped visibly (warnings) while ROADMAP.md is still written");
    fs.unlinkSync(path.join(shp, ".specs", "ROADMAP.html"));
    fs.writeFileSync(shpRm, JSON.stringify({ meta: { lang: "pt" }, features: { a: { dependsOn: "b" } }, backlog: {} }));
    let shapeRead = null;
    try { shapeRead = S.roadmap(shp); } catch { /* crashed */ }
    const aRow = shapeRead && shapeRead.ok && shapeRead.features.find((x) => x.name === "a");
    ok(aRow && aRow.dependsOn.length === 0 && /estrutura inesperada/.test(safe(() => S.backlog(shp, "add", "X")).error || ""),
      "reads survive a wrong-shaped roadmap.json (sanitized) and the refusal stays in the project language (meta.lang pt)");
    const stp = path.join(tmp, "proj-wp3-state");
    const stF = S.createFeature(stp, "a", ["core"]);
    const stShape = path.join(stF.dir, ".state.json");
    const badState = JSON.stringify({ lang: "pt", approvals: [] });
    fs.writeFileSync(stShape, badState);
    const apShape = body(await call("spec_approve", { name: "a", phase: "requirements", projectDir: stp }));
    ok(apShape.ok === false && /estrutura inesperada/.test(apShape.error) && /'approvals'/.test(apShape.error) && fs.readFileSync(stShape, "utf8") === badState && S.featureLang(stp, "a") === "pt",
      ".state.json with approvals:[] → approve refuses (in the feature's language), file untouched, lang still read");
    fs.writeFileSync(stShape, JSON.stringify({ lang: "en", evidence: "x", approvals: {} }));
    fs.writeFileSync(path.join(stF.dir, "tasks.md"), "- [ ] 1. a\n");
    const evShape = safe(() => S.completeTask(stp, "a", 1, { command: "npm test", exitCode: 0 }));
    ok(evShape.ok === false && /'evidence'/.test(evShape.error) && /- \[ \] 1\./.test(fs.readFileSync(path.join(stF.dir, "tasks.md"), "utf8")),
      ".state.json with evidence:\"x\" → recording evidence is refused and the task stays open");
    fs.writeFileSync(stShape, JSON.stringify({ tracks: "tdd" }));
    ok(/'tracks'/.test(S.readState(stp, "a").invalid || "") && S.approvePhase(stp, "a", "design").ok === false, ".state.json with tracks:\"tdd\" is flagged invalid too");

    // 4. spec_depend: existing features only; add/remove; {name} alone is a read; [] clears.
    const dp = path.join(tmp, "proj-wp3-dep");
    ["a", "b", "c"].forEach((n) => S.createFeature(dp, n, ["core"]));
    const dpRm = path.join(dp, ".specs", "roadmap.json");
    const unk = body(await call("spec_depend", { name: "a", dependsOn: ["b", "nope", "steering"], projectDir: dp }));
    ok(unk.ok === false && /not found: nope, steering/.test(unk.error) && !S.readRoadmap(dp).features.a, "spec_depend refuses unknown/reserved dependencies and lists them (nothing stored)");
    const dep = async (args) => body(await call("spec_depend", { name: "a", projectDir: dp, ...args }));
    const dA = await dep({ add: ["b"] });
    const dB = await dep({ add: ["c", "b"] });
    const dC = await dep({ remove: ["b"] });
    ok(dA.dependsOn.join() === "b" && dB.dependsOn.join() === "b,c" && dC.dependsOn.join() === "c", "spec_depend add/remove edit the list incrementally (deduplicated)");
    const beforeRead = fs.readFileSync(dpRm, "utf8");
    const dRead = await dep({});
    ok(dRead.ok && dRead.dependsOn.join() === "c" && fs.readFileSync(dpRm, "utf8") === beforeRead, "spec_depend {name} alone returns the deps and writes nothing");
    const dCyc = body(await call("spec_depend", { name: "c", add: ["a"], projectDir: dp }));
    ok(dCyc.ok === false && /Circular/.test(dCyc.error), "an incremental add is cycle-checked");
    const dClear = await dep({ dependsOn: [] });
    ok(dClear.ok && dClear.dependsOn.length === 0 && S.readRoadmap(dp).features.a.dependsOn.length === 0, "dependsOn: [] clears the list explicitly");
    fs.writeFileSync(dpRm, JSON.stringify({ features: { a: { dependsOn: ["gone", "b"] } } }));
    const dStale = await dep({ remove: ["gone"] });
    ok(dStale.ok && dStale.dependsOn.join() === "b", "a stale dependency (feature deleted by hand) can still be removed");
    ok(/order must be an integer/.test(safe(() => S.setDependency(dp, "a", undefined, "abc")).error || ""), "a non-integer order is refused by the engine (same as MCP's integer check)");

    // 5. One default approver on both surfaces.
    const expectBy = process.env.USER || process.env.USERNAME || "user";
    const apBy = body(await call("spec_approve", { name: "b", phase: "requirements", force: true, projectDir: dp })); // a template: 1.13 gate
    ok(apBy.ok && apBy.approvals.requirements.by === expectBy, "MCP approve without `by` records $USER/$USERNAME (same default as the CLI), not a fixed 'user'");

    // 6. Eval harness: resolver (accents, legacy slugs), project-dir resolution, localized output.
    const EVALS = path.join(__dirname, "evals", "run-evals.js");
    const evp = path.join(tmp, "proj-wp3-evals");
    S.initProject(evp, ["ai"], "pt");
    const evF = S.createFeature(evp, "Análise Avançada", ["ai"]);
    const runEv = (args, env) => spawnSync(process.execPath, [EVALS, ...args], { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: "", SPEC_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: "", ...env } });
    const ev1 = runEv(["Análise Avançada", "--dry-run", "--project", evp]);
    ok(evF.slug === "analise-avancada" && ev1.status === 0 && /feature 'analise-avancada'/.test(ev1.stdout) && /correria/.test(ev1.stdout) && /Dry run concluído/.test(ev1.stdout),
      "run-evals --dry-run on a PT feature with an accented name resolves it and reports in PT");
    fs.renameSync(evF.dir, path.join(evp, ".specs", "an-lise-avan-ada")); // the pre-1.11 slug of the same name
    const ev2 = runEv(["Análise Avançada", "--dry-run"], { SPEC_PROJECT_DIR: evp, CLAUDE_PROJECT_DIR: "${CLAUDE_PROJECT_DIR}" });
    ok(ev2.status === 0 && /feature 'an-lise-avan-ada'/.test(ev2.stdout), "run-evals finds legacy slugs and honours SPEC_PROJECT_DIR (an unexpanded ${CLAUDE_PROJECT_DIR} is ignored)");
    const ev3 = runEv(["Inexistente", "--dry-run", "--project", evp]);
    ok(ev3.status === 2 && /não encontrada/.test(ev3.stderr), "run-evals on an unknown feature → localized error, exit 2");
    const evLive = runEv(["Análise Avançada", "--require-live", "--project", evp]);
    const evBase = runEv(["Análise Avançada", "--dry-run", "--set-baseline", "--project", evp]);
    ok(evLive.status === 2 && /--require-live/.test(evLive.stderr) && /recuso/.test(evLive.stderr) && evBase.status === 0 && !fs.existsSync(path.join(evp, ".specs", "an-lise-avan-ada", "evals", "baseline.json")),
      "--require-live without a key still exits 2 (localized); a dry run never writes a baseline");
    // Valid JSON of the wrong shape is an invalid set (exit 1, localized), not a harness crash (exit 2).
    const evDir = path.join(evp, ".specs", "an-lise-avan-ada", "evals");
    fs.writeFileSync(path.join(evDir, "adversarial.json"), "null");
    fs.writeFileSync(path.join(evDir, "golden.json"), JSON.stringify({ items: { a: 1 } }));
    const evSetShape = runEv(["Análise Avançada", "--dry-run", "--project", evp]);
    ok(evSetShape.status === 1 && /adversarial\.json — 'items' tem de ser um array/.test(evSetShape.stdout) && /golden\.json — 'items' tem de ser um array/.test(evSetShape.stdout) &&
      !/harness de evals|Cannot read/.test(evSetShape.stdout + evSetShape.stderr),
      "run-evals --dry-run on a null / {items:{…}} eval set → invalid set (exit 1, localized), no harness crash");

    // 7. Pre-commit: NUL-separated staged paths (accents/spaces) and named IDs.
    if (spawnSync("git", ["--version"], { encoding: "utf8" }).status !== 0) {
      console.log("  skip - git not available: pre-commit regression not run");
    } else {
      const repo = path.join(tmp, "proj-wp3-git");
      fs.mkdirSync(repo, { recursive: true });
      const git = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
      git("init", "-q");
      const pf = path.join(repo, "serviços e apps", ".specs", "autenticacao");
      fs.mkdirSync(pf, { recursive: true });
      fs.writeFileSync(path.join(pf, ".state.json"), JSON.stringify({ lang: "pt", approvals: {} }));
      fs.writeFileSync(path.join(pf, "requirements.md"), "## Critérios de Aceitação\n1. **US-1.AC-1** — QUANDO o utilizador entra, O SISTEMA DEVE mostrar o painel\n2. **US-1.AC-2** — QUANDO o utilizador sai, o painel é fechado\n");
      fs.writeFileSync(path.join(pf, "tasks.md"), "- [ ] 1. Painel\n  - _Requirements: US-1.AC-1, US-9.AC-9_\n");
      git("add", "-A");
      const pc = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "precommit-check.js")], { cwd: repo, encoding: "utf8" });
      ok(pc.status === 1 && /serviços e apps\/\.specs\/autenticacao\/requirements\.md: 1 erro\(s\) EARS/.test(pc.stdout),
        "pre-commit checks staged spec files under accented/space paths (the EARS error blocks the commit)");
      ok(/fantasma[^\n]*US-9\.AC-9/.test(pc.stdout) && /sem tarefa[^\n]*US-1\.AC-2/.test(pc.stdout), "pre-commit names the phantom and uncovered AC IDs (localized)");
    }

    // 8. No invisible code points in this file (the BOM test writes it as an escape).
    ok(!fs.readFileSync(__filename, "utf8").includes(String.fromCharCode(0xfeff)), "mcp/test.js carries no literal U+FEFF");
  }
  // @wp WP3 <<<

  // @wp WP4 tests >>>
  // --- 1.13 WP4: CLI ↔ MCP parity, every trace gap listed, destructive ops confirmed, localized phases ---
  const hookJs = path.join(__dirname, "..", "hooks", "spec-hook.js");
  const w4 = path.join(tmp, "proj-wp4");
  S.initProject(w4, ["tdd"], "en");
  const w4f = S.createFeature(w4, "Gaps", ["tdd"]);
  fs.writeFileSync(path.join(w4f.dir, "requirements.md"), "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n2. **US-1.AC-2** — WHEN c THE SYSTEM SHALL d\n");
  fs.writeFileSync(path.join(w4f.dir, "test-plan.md"), "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-2 |\n");
  fs.writeFileSync(path.join(w4f.dir, "tasks.md"), "- [x] 1. a\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01, T-99_\n  - _Implements: src/nope.js_\n"); // ticked: 1.13 plannedImplFiles
  const w4kinds = S.traceGaps(S.traceCheck(w4, "gaps")).map((g) => g.kind).join(",");
  ok(w4kinds === "phantomTestsInTasks,testsNotMappedToTasks,missingImplFiles", "traceGaps lists every non-empty gap kind in a stable order (got " + w4kinds + ")");
  const w4doc = S.specDoctor(w4, "gaps").checks.find((c) => c.id === "traceability");
  ok(w4doc.status === "fail" && /unknown tests \(typos\?\): T-99/.test(w4doc.detail) && /T-02/.test(w4doc.detail) && /src\/nope\.js/.test(w4doc.detail) && !/=0/.test(w4doc.detail),
    "doctor's traceability detail names each failing kind with its IDs (no '=0' counters while failing)");
  const w4pt = S.createFeature(w4, "Lacunas", ["tdd"], undefined, undefined, "pt");
  ["requirements.md", "test-plan.md", "tasks.md"].forEach((x) => fs.copyFileSync(path.join(w4f.dir, x), path.join(w4pt.dir, x)));
  ok(/testes desconhecidos \(erros de escrita\?\): T-99/.test(S.specDoctor(w4, "lacunas").checks.find((c) => c.id === "traceability").detail),
    "doctor's traceability detail is localized (PT)");
  // The hook used to print "Traceability gaps in <f>:" and an empty "- " when the only gap was a missing file.
  fs.writeFileSync(path.join(w4f.dir, "tasks.md"), "- [x] 1. a\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01, T-02_\n  - _Implements: src/nope.js_\n"); // ticked: 1.13 plannedImplFiles
  const hkTr = spawnSync(process.execPath, [hookJs], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_input: { file_path: path.join(w4f.dir, "tasks.md") } }), encoding: "utf8" });
  const hkTrTxt = JSON.parse(hkTr.stdout).hookSpecificOutput.additionalContext;
  ok(/Traceability gaps in gaps/.test(hkTrTxt) && /_Implements:_ files that don't exist: src\/nope\.js/.test(hkTrTxt) && !/^\s*-\s*$/m.test(hkTrTxt),
    "PostToolUse trace message lists the gap it found (missing _Implements:_ file), never an empty '- '");
  const esW4 = path.join(tmp, "proj-wp4-es");
  S.initProject(esW4, [], "es");
  const esW4f = S.createFeature(esW4, "Pagos", ["core"]);
  fs.writeFileSync(path.join(esW4f.dir, "tasks.md"), "- [x] 1. a\n- [ ] 2. b\n");
  const hkEs = spawnSync(process.execPath, [hookJs], { input: JSON.stringify({ hook_event_name: "SessionStart" }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: esW4 } });
  ok(/en ejecución \(1\/2 tareas\)/.test(hkEs.stdout) && !/executing/.test(hkEs.stdout), "SessionStart phase names are localized (ES 'en ejecución')");

  // spec_roadmap: a failed write is an error with the reason (the CLI already exited 1), not wrote:[] + success.
  const handW4 = path.join(tmp, "proj-wp4-hand");
  S.createFeature(handW4, "Thing", ["core"]);
  fs.writeFileSync(path.join(handW4, ".specs", "ROADMAP.md"), "# Mine\n");
  const rmFail = await rpc("tools/call", { name: "spec_roadmap", arguments: { write: true, html: true, projectDir: handW4 } });
  const rmFailP = payload(rmFail);
  ok(rmFail.result.isError === true && rmFailP.ok === false && rmFailP.errors.length === 1 && /ROADMAP\.md/.test(rmFailP.error) &&
    rmFailP.wrote.length === 1 && /ROADMAP\.html$/.test(rmFailP.wrote[0]) && rmFailP.features.length === 1 && fs.readFileSync(path.join(handW4, ".specs", "ROADMAP.md"), "utf8") === "# Mine\n",
    "spec_roadmap: a hand-written ROADMAP.md is left alone AND reported (isError, errors, wrote lists only ROADMAP.html)");
  const rmToolDesc = list.result.tools.find((t) => t.name === "spec_roadmap").description;
  ok(/git-friendly/.test(rmToolDesc) && !/PR-friendly/.test(rmToolDesc), "spec_roadmap description says git-friendly (no PR wording)");

  // spec_backlog rm: an unknown name is an error, not a silent ok.
  const blMiss = await rpc("tools/call", { name: "spec_backlog", arguments: { action: "rm", name: "nope", projectDir: w4 } });
  S.backlog(w4, "add", "SSO");
  ok(blMiss.result.isError === true && /not in the backlog/.test(payload(blMiss).error) && S.backlog(w4, "rm", "sso").ok === true && S.backlog(w4, "list").backlog.length === 0 &&
    /não está no backlog/.test(S.backlog(ptProj, "rm", "x").error), "backlog rm: unknown name → localized error (isError); a listed name (any case) is removed");

  // spec_feature remove needs confirm:true — without it nothing is deleted and the result says what would be.
  const fTool = list.result.tools.find((t) => t.name === "spec_feature");
  const noConf = await rpc("tools/call", { name: "spec_feature", arguments: { action: "remove", name: "gaps", projectDir: w4 } });
  const noConfP = payload(noConf);
  const falseConf = payload(await rpc("tools/call", { name: "spec_feature", arguments: { action: "remove", name: "gaps", confirm: false, projectDir: w4 } }));
  ok(fTool.inputSchema.properties.confirm.type === "boolean" && !fTool.inputSchema.required.includes("confirm") && noConf.result.isError === true &&
    noConfP.needsConfirm === true && noConfP.wouldDelete.files >= 4 && noConfP.wouldDelete.entries.includes("tasks.md") && /confirm: true/.test(noConfP.error) &&
    falseConf.needsConfirm === true && fs.existsSync(w4f.dir), "spec_feature remove without confirm:true deletes nothing and reports what it would delete");
  const yesConf = payload(await rpc("tools/call", { name: "spec_feature", arguments: { action: "remove", name: "gaps", confirm: true, projectDir: w4 } }));
  ok(yesConf.ok === true && !fs.existsSync(w4f.dir) && /Remover 'lacunas'/.test(S.manageFeature(w4, "remove", "lacunas").error),
    "spec_feature remove with confirm:true deletes; the confirmation message is in the feature's language (PT)");
  // The remove preview counts a symlink/junction as ONE entry (like fs.rmSync) — it used to follow it, counting
  // files outside the feature and recursing through a link loop.
  const lnkF = S.createFeature(w4, "Linky", ["core"]);
  const lnkOut = path.join(w4, "outside");
  fs.mkdirSync(lnkOut, { recursive: true });
  for (let i = 0; i < 30; i++) fs.writeFileSync(path.join(lnkOut, "f" + i + ".txt"), "x");
  let linked = true;
  try {
    fs.symlinkSync(lnkOut, path.join(lnkF.dir, "linked"), "junction"); // junction: no admin rights needed on Windows
    fs.symlinkSync(path.join(w4, ".specs"), path.join(lnkF.dir, "loop"), "junction");
  } catch { linked = false; }
  if (linked) {
    const realFiles = fs.readdirSync(lnkF.dir).length; // flat folder: every entry is a file or a link
    const lnkPrev = S.manageFeature(w4, "remove", "linky");
    const lnkDel = S.manageFeature(w4, "remove", "linky", undefined, { confirm: true });
    ok(lnkPrev.needsConfirm === true && lnkPrev.wouldDelete.files === realFiles && lnkDel.ok === true && !fs.existsSync(lnkF.dir) &&
      fs.readdirSync(lnkOut).length === 30 && fs.existsSync(path.join(w4, ".specs")),
      "remove preview does not follow symlinks/junctions (got " + lnkPrev.wouldDelete.files + " of " + realFiles + "); the delete leaves the link targets alone");
  } else ok(true, "remove preview vs symlinks: skipped (links not creatable here)");
  // With an unreadable roadmap.json the preview returns the same error the confirmed remove would — it used to
  // list what "would" be deleted and ask for confirm:true, then the confirmed call refused.
  const badRmDir = path.join(w4, "bad-roadmap");
  S.initProject(badRmDir, ["core"]);
  const badRmF = S.createFeature(badRmDir, "Delta", ["core"]);
  fs.writeFileSync(path.join(badRmDir, ".specs", "roadmap.json"), "{broken");
  const badPrev = S.manageFeature(badRmDir, "remove", "delta");
  const badConf = S.manageFeature(badRmDir, "remove", "delta", undefined, { confirm: true });
  const badPrevMcp = await rpc("tools/call", { name: "spec_feature", arguments: { action: "remove", name: "delta", projectDir: badRmDir } });
  ok(badPrev.ok === false && !badPrev.needsConfirm && !badPrev.wouldDelete && /roadmap\.json/.test(badPrev.error) && badPrev.error === badConf.error &&
    badPrevMcp.result.isError === true && !payload(badPrevMcp).needsConfirm && fs.existsSync(badRmF.dir),
    "remove preview with a broken roadmap.json returns the roadmap error (no needsConfirm), like the confirmed call");

  // spec_finish includeBody with write (the CLI's --include-body maps to it); classify reports its language.
  const finBody = payload(await rpc("tools/call", { name: "spec_finish", arguments: { name: "login-loop", write: true, includeBody: true, projectDir: vDir } }));
  ok(finBody.wrote === true && /## Summary/.test(finBody.mergeSummary), "spec_finish write + includeBody returns the merge summary too");
  ok(S.classify("Webhook de faturação com resumo por um LLM").lang === "pt" && S.classify("x", { lang: "es" }).lang === "es",
    "classify returns the language its notes/reasoning are in");
  // @wp WP4 <<<

  // @wp WP5 tests >>>
  { // --- 1.13 WP5: gates — placeholders, approve --force, finish/next-action, bugfix gate, clarify/EARS, roadmap, templates ---
    const w5 = path.join(tmp, "proj-wp5");
    S.initProject(w5, ["core"], "en");
    const read5 = (f, rel) => fs.readFileSync(path.join(f.dir, rel), "utf8");
    const write5 = (f, rel, text) => fs.writeFileSync(path.join(f.dir, rel), text);
    const chk = (doc, id) => doc.checks.find((c) => c.id === id) || {};
    const stateOf = (f) => JSON.parse(read5(f, ".state.json"));
    // Real content for the core chain (IDs match the template tasks, so traceability passes).
    const REQ = "# Feature: x\n\n## Summary\nExport invoices as CSV.\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN an admin clicks Export THE SYSTEM SHALL download a CSV.\n2. **US-1.AC-2** — WHILE an export runs, WHEN the admin clicks again THE SYSTEM SHALL ignore it.\n" +
      "3. **US-1.AC-3** — IF the export fails THEN THE SYSTEM SHALL show the error code.\n4. **US-1.AC-4** — THE SYSTEM SHALL name files invoices-YYYY-MM.csv.\n\n" +
      "### US-2 (P2): Schedule\n#### Acceptance Criteria (EARS)\n1. **US-2.AC-1** — WHEN a schedule is due THE SYSTEM SHALL email the CSV.\n\n" +
      "## Success Criteria\n- **SC-001** — 95% of exports finish in under 5 s.\n\n## Edge Cases & Error Handling\n- **EC-1** — WHEN the month has no invoices THE SYSTEM SHALL return a header-only CSV.\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 export time < 5 s.\n\n## Out of Scope\n- PDF export.\n";
    const DESIGN = "# Design: x\n\n## Overview\nA nightly job and an endpoint.\n\n## Architecture\n```mermaid\ngraph TD\n  A-->B\n```\n\n## Constitution Check\n- [x] Principle 1 — complies\n";

    // (1) placeholder gate: an untouched scaffold is never readyToAdvance; file:line detail, bounded
    const f1 = S.createFeature(w5, "Fresh gate", ["core"]);
    const d1 = S.specDoctor(w5, f1.slug);
    const ph1 = chk(d1, "placeholders");
    ok(d1.readyToAdvance === false && ph1.status === "fail" && /requirements\.md \(\d+\): requirements\.md:4 \[1-2 sentences/.test(ph1.detail) && /\+\d+ more/.test(ph1.detail) &&
      (ph1.detail.match(/requirements\.md:\d+/g) || []).length === 5,
      "doctor: a fresh scaffold fails 'placeholders' (file:line + text, first 5 + a count) and is NOT readyToAdvance");
    write5(f1, "requirements.md", REQ);
    write5(f1, "design.md", DESIGN);
    const d1b = S.specDoctor(w5, f1.slug);
    ok(d1b.phase === "design" && chk(d1b, "placeholders").status === "warn" && /tasks\.md/.test(chk(d1b, "placeholders").detail) && d1b.readyToAdvance === true &&
      chk(d1b, "success-criteria").status === "pass" && chk(d1b, "priorities").status === "pass",
      "a LATER phase still being a template (tasks.md at phase design) is only a warn; real SC-001 / P1 lines pass");
    // EARS: a template criterion is reported with the stable code 'placeholder' (warn) — never 'clean'
    const e1 = S.earsValidate("1. **US-1.AC-1** — WHEN [trigger] THE SYSTEM SHALL [behavior]\n2. **US-1.AC-2** — WHEN x THE SYSTEM SHALL y");
    ok(e1.verdict === "pass" && e1.summary.placeholders === 1 && e1.issues.filter((i) => i.code === "placeholder").length === 1 &&
      e1.issues.find((i) => i.code === "placeholder").severity === "warn" && /\[trigger\] \[behavior\]/.test(e1.issues.find((i) => i.code === "placeholder").msg),
      "ears_validate reports template placeholder criteria with code 'placeholder' (warn)");
    const hookReq = (file) => { const r = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_input: { file_path: file } }), encoding: "utf8" }); try { return JSON.parse(r.stdout).hookSpecificOutput.additionalContext; } catch { return ""; } };
    const f1h = S.createFeature(w5, "Hook gate", ["core"]);
    write5(f1h, "requirements.md", REQ.replace("Export invoices as CSV.", "[1-2 sentences: what this does]"));
    const hk1 = hookReq(path.join(f1h.dir, "requirements.md"));
    write5(f1h, "requirements.md", REQ);
    const hk2 = hookReq(path.join(f1h.dir, "requirements.md"));
    ok(/Template placeholders: 1 left in requirements\.md \(L4 \[1-2 sentences: what this does\]\)/.test(hk1) && !/all clean/.test(hk1) && /all clean ✓/.test(hk2),
      "PostToolUse on requirements.md: a placeholder outside any criterion still stops 'all clean' (count + line, localized); clean once filled");

    // (2) approve gate: refused while the phase's checks fail; force records forced + failing ids; nothing to approve = error
    const f2 = S.createFeature(w5, "Approve gate", ["core"]);
    const ap1 = S.approvePhase(w5, f2.slug, "requirements");
    ok(ap1.ok === false && ap1.refused && ap1.failing.join() === "placeholders,success-criteria,priorities" && /✗ placeholders — requirements\.md \(\d+\): requirements\.md:4/.test(ap1.error) &&
      /force: true/.test(ap1.error) && !stateOf(f2).approvals.requirements, "approve on the template is REFUSED, listing the failing check ids + details — nothing recorded");
    const ap2 = payload(await rpc("tools/call", { name: "spec_approve", arguments: { name: f2.slug, phase: "requirements", force: true, projectDir: w5 } }));
    const d2 = S.specDoctor(w5, f2.slug);
    ok(ap2.ok && ap2.forced === true && stateOf(f2).approvals.requirements.forced === true && stateOf(f2).approvals.requirements.failing.join() === "placeholders,success-criteria,priorities" &&
      chk(d2, "approval-gates").status === "warn" && /approved with force over failing checks: requirements \(placeholders, success-criteria, priorities\)/.test(chk(d2, "approval-gates").detail) &&
      d2.forcedGates.join() === "requirements", "spec_approve {force: true} records forced + failing ids; doctor's approval-gates shows it as a warn");
    write5(f2, "requirements.md", REQ);
    const ap3 = S.approvePhase(w5, f2.slug, "requirements");
    ok(ap3.ok && !ap3.forced && !stateOf(f2).approvals.requirements.forced, "a clean re-approval replaces the forced one");
    const noEval = S.approvePhase(w5, f2.slug, "eval-plan", undefined, { force: true });
    const noPlan = payload(await rpc("tools/call", { name: "spec_approve", arguments: { name: f2.slug, phase: "test-plan", force: true, projectDir: w5 } }));
    ok(noEval.ok === false && noEval.nothingToApprove && /Nothing to approve: 'eval-plan'/.test(noEval.error) && noPlan.ok === false && /test-plan\.md/.test(noPlan.error) &&
      !stateOf(f2).approvals["eval-plan"], "approving a phase with no artifact (eval-plan without +ai, test-plan without +tdd) is an error even with force");
    ok(S.approvePhase(w5, f2.slug, "execution").ok && S.approvePhase(w5, f2.slug, "tests").ok, "tests / execution have no artifact of their own — approved without checks");
    const apD = S.approvePhase(w5, f2.slug, "design");
    write5(f2, "design.md", DESIGN.replace("- [x] Principle 1 — complies\n", ""));
    const apD2 = S.approvePhase(w5, f2.slug, "design");
    write5(f2, "design.md", DESIGN);
    ok(apD.ok === false && apD.failing.includes("placeholders") && apD.failing.includes("constitution-check") && apD2.failing.join() === "constitution-check" &&
      S.approvePhase(w5, f2.slug, "design").ok, "design gate: placeholders and an empty Constitution Check refuse it; a filled design is approved");
    const apT = S.approvePhase(w5, f2.slug, "tasks");
    write5(f2, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build the CSV writer\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-9_\n");
    const apT2 = S.approvePhase(w5, f2.slug, "tasks");
    write5(f2, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build the CSV writer\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1_\n  - _Verify: [manual: open the CSV in a spreadsheet]_\n");
    ok(apT.ok === false && apT.failing.includes("placeholders") && apT2.ok === false && apT2.failing.join() === "traceability" &&
      /US-1\.AC-4/.test(apT2.error) && /US-1\.AC-9/.test(apT2.error) && S.approvePhase(w5, f2.slug, "tasks").ok,
      "tasks gate: template tasks, uncovered ACs and phantom IDs refuse it; a '[manual: …]' _Verify:_ is not a placeholder");
    const f2t = S.createFeature(w5, "Plan gate", ["tdd"]);
    write5(f2t, "requirements.md", REQ);
    write5(f2t, "test-plan.md", "# Test Plan\n\n| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n");
    const apP = S.approvePhase(w5, f2t.slug, "test-plan");
    ok(apP.ok === false && apP.failing.join() === "traceability" && /ACs with no planned test: US-1\.AC-2/.test(apP.error), "test-plan gate: every AC needs a planned test");
    const f2b = S.createFeature(w5, "Bug gate", undefined, "crash", undefined, "en", "bugfix");
    const apB1 = S.approvePhase(w5, f2b.slug, "requirements", undefined, { force: true });
    const apB2 = S.approvePhase(w5, f2b.slug, "design");
    const apB3 = S.approvePhase(w5, f2b.slug, "classification", undefined, { force: true });
    ok(apB1.forced && apB1.failing.includes("reproduction") && apB2.ok === false && apB2.failing.join() === "root-cause" && apB3.ok === false && apB3.nothingToApprove,
      "bugfix: requirements needs bug.md Reproduction, design needs its Root Cause (no design.md), classification has nothing to approve");
    const w5pt = path.join(tmp, "proj-wp5-pt");
    S.initProject(w5pt, ["core"], "pt");
    const fpt = S.createFeature(w5pt, "Aprovação", ["core"]);
    ok(/Não é possível aprovar 'requirements' de 'aprovacao' — verificações a falhar: placeholders/.test(S.approvePhase(w5pt, fpt.slug, "requirements").error) &&
      /Nada para aprovar/.test(S.approvePhase(w5pt, fpt.slug, "eval-plan").error), "the approve refusal / nothing-to-approve errors are localized (PT)");
    const apTool = list.result.tools.find((t) => t.name === "spec_approve");
    ok(apTool.inputSchema.properties.force.type === "boolean" && !apTool.inputSchema.required.includes("force") && /REFUSES/.test(apTool.description), "spec_approve advertises force: boolean (optional) and the gate");

    // (3) _Implements:_ of an OPEN task is planned, not a gap; a DONE task's missing file is
    const f3 = S.createFeature(w5, "Planned files", ["core"]);
    write5(f3, "requirements.md", "## Acceptance Criteria\n1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n");
    write5(f3, "tasks.md", "- [ ] 1. a\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/not-yet.js_\n");
    const t3a = S.traceCheck(w5, f3.slug);
    write5(f3, "tasks.md", "- [x] 1. a\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/not-yet.js_\n");
    const t3b = S.traceCheck(w5, f3.slug);
    ok(t3a.verdict === "pass" && t3a.plannedImplFiles.join() === "src/not-yet.js" && t3a.missingImplFiles.length === 0 && S.traceGaps(t3a).length === 0 &&
      t3b.verdict === "gaps-found" && t3b.missingImplFiles.join() === "src/not-yet.js" && t3b.plannedImplFiles.length === 0,
      "trace: an OPEN task's not-yet-written _Implements:_ file is plannedImplFiles (no gap); once the task is done it is a gap");

    // (4) spec_finish blocks on what next_action flags (changed since approval), placeholders anywhere, the root cause
    const f4 = S.createFeature(w5, "Finish gate", ["core"]);
    write5(f4, "requirements.md", REQ);
    S.approvePhase(w5, f4.slug, "requirements");
    fs.appendFileSync(path.join(f4.dir, "requirements.md"), "\n## Assumptions\n- Admins are logged in.\n");
    const na4 = S.nextAction(w5, f4.slug);
    const fin4 = S.finishFeature(w5, f4.slug);
    ok(na4.changedSinceApproval.join() === "requirements.md" && fin4.changedSinceApproval.join() === "requirements.md" &&
      fin4.blockers.some((b) => /changed after their approval \(re-review, then re-approve\): requirements\.md/.test(b)) &&
      fin4.blockers.some((b) => /template placeholders left in the spec chain: design\.md/.test(b)) && fin4.placeholders.includes("tasks.md") && fin4.readyToFinish === false,
      "spec_finish: an artifact changed after its approval (the same list next_action shows) and placeholders anywhere in the chain are blockers");
    const fin4b = S.finishFeature(w5, f2b.slug);
    ok(fin4b.blockers.some((b) => b === "bug.md → Root Cause is not filled — no fix before the root cause is known") && !fin4b.blockers.some((b) => /blocking checks: [^\n]*root-cause/.test(b)),
      "spec_finish on a bugfix: an unfilled Root Cause is its own blocker");

    // (5) bugfix execution gate + brief context
    const f5 = S.createFeature(w5, "Null deref", undefined, "crash on save", undefined, "en", "bugfix");
    const tasks5 = () => read5(f5, "tasks.md");
    const c51 = S.completeTask(w5, f5.slug, 1), c52 = S.completeTask(w5, f5.slug, 2);
    const c53 = payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: f5.slug, number: 4, evidence: { command: "npm test", exitCode: 0 }, projectDir: w5 } }));
    ok(c51.ok && c52.ok && c53.ok === false && c53.gated === "root-cause" && /Task 4 can't be completed yet: bug\.md → Root Cause is not filled/.test(c53.error) && /do task 2 first/.test(c53.error) &&
      /- \[ \] 4\./.test(tasks5()) && !(stateOf(f5).evidence || {})["4"], "bugfix: while Root Cause is unfilled, tasks after the root-cause task are refused (nothing ticked, no evidence recorded)");
    const br5 = S.taskBrief(w5, f5.slug, 4);
    const bug5 = path.join(f5.dir, "bug.md");
    fs.writeFileSync(bug5, fs.readFileSync(bug5, "utf8").replace(/## Reproduction\n> \*\*TODO\*\*[^\n]*/, "## Reproduction\nSave an empty form.")
      .replace(/## Root Cause\n> \*\*TODO\*\*[^\n]*/, "## Root Cause\nform.owner is null when the form is empty (save.js:12)."));
    const br5b = S.taskBrief(w5, f5.slug, 4);
    ok(br5.bug.rootCause === null && /## The bug \(bug\.md\)/.test(br5.brief) && /Not written yet/.test(br5.brief) &&
      br5b.bug.reproduction === "Save an empty form." && /\*\*Root cause\*\*\nform\.owner is null/.test(br5b.brief) && S.completeTask(w5, f5.slug, 3).ok,
      "spec_task_brief on a bugfix task carries bug.md's Reproduction and Root Cause; once written, the gate opens");
    const f5b = S.createFeature(w5, "Odd bug", undefined, "x", undefined, "en", "bugfix");
    write5(f5b, "tasks.md", "- [ ] 1. Investigate\n- [ ] 2. Patch it\n");
    const f5pt = S.createFeature(w5pt, "Falha", undefined, "x", undefined, "pt", "bugfix");
    ok(/only task 1 can be completed/.test(S.completeTask(w5, f5b.slug, 2).error) && S.completeTask(w5, f5b.slug, 1).ok &&
      /A tarefa 3 ainda não pode ser concluída/.test(S.completeTask(w5pt, f5pt.slug, 3).error), "no task mentions the Root Cause → only the first task can be completed; the refusal is localized (PT)");

    // (6) next_action: the chain's order — fill → re-review → current checks → approve → implement → finish
    const f6 = S.createFeature(w5, "Order", ["saas"]);
    const n6a = S.nextAction(w5, f6.slug);
    ok(n6a.step === "fill" && n6a.file === "requirements.md" && /^Fill requirements\.md — \d+ template placeholder/.test(n6a.recommendation) && /\/clarify order/.test(n6a.recommendation) &&
      !/saas-sections|traceability/.test(n6a.recommendation), "next_action on a fresh +saas feature: 'fill requirements.md' (with /clarify), never the later phases' failing checks");
    const f6c = S.createFeature(w5, "Order core", ["core"]);
    write5(f6c, "requirements.md", REQ);
    const n6b = S.nextAction(w5, f6c.slug);
    write5(f6c, "design.md", DESIGN);
    write5(f6c, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-7_\n");
    const n6c = S.nextAction(w5, f6c.slug);
    write5(f6c, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1_\n");
    const n6d = S.nextAction(w5, f6c.slug);
    // classification.md is still the scaffold: the approve gate would refuse it, so next_action names what it fails on
    write5(f6c, "classification.md", read5(f6c, "classification.md").replace(/\[[^\]]*\]/g, "filled"));
    const n6d2 = S.nextAction(w5, f6c.slug);
    ok(n6b.step === "fill" && n6b.file === "design.md" && n6c.step === "fix" && /traceability/.test(n6c.recommendation) &&
      n6d.step === "fix" && n6d.refusedGate.phase === "classification" && n6d.refusedGate.failing.join() === "placeholders" && /Before approving 'classification'.*classification\.md:\d+ \[/.test(n6d.recommendation) &&
      n6d2.step === "approve" && /classification/.test(n6d2.recommendation) && !n6d2.refusedGate,
      "next_action: requirements filled → fill design.md; a current-phase check fails → fix it; a pending gate approve would refuse → what it fails on; then approve");
    ["classification", "requirements", "design", "tasks"].forEach((p) => S.approvePhase(w5, f6c.slug, p));
    const n6e = S.nextAction(w5, f6c.slug);
    S.completeTask(w5, f6c.slug, 1, "built and checked");
    const n6f = S.nextAction(w5, f6c.slug);
    ok(n6e.step === "implement" && /#1/.test(n6e.recommendation) && n6f.step === "finish" && /\/spec-finish order-core \(spec_finish\)/.test(n6f.recommendation),
      "next_action: approvals done → implement the next task; all tasks done → spec_finish / /spec-finish by name");
    ok(/\/spec-finish x \(spec_finish\)/.test(S.msg("pt").next.allDone("x")) && /\/spec-finish x/.test(S.msg("es").next.allDone("x")), "the all-done recommendation names /spec-finish in PT/ES too");

    // (7) clarify: IF…THEN per criterion, natural rate-limit wording, grouped placeholders; the classifier
    const f7 = S.createFeature(w5, "Clarify gate", ["saas"]);
    write5(f7, "requirements.md", REQ.replace("3. **US-1.AC-3** — IF the export fails THEN THE SYSTEM SHALL show the error code.", "3. **US-1.AC-3** — IF the export fails,\n   THEN THE SYSTEM SHALL show the error code.") +
      "\n## Tenancy\nEvery query is scoped by tenant; exports are throttled to 10 per minute per tenant.\n");
    const q7 = S.clarify(w5, f7.slug).questions;
    ok(!q7.some((q) => /unwanted-behavior/.test(q)) && !q7.some((q) => /rate limits/.test(q)), "clarify: IF on one line and THEN on the next counts; 'throttled' answers the rate-limit question");
    const ptRate = S.createFeature(w5pt, "Limites", ["saas"]);
    write5(ptRate, "requirements.md", "## Critérios\n1. **US-1.AC-1** — SE o inquilino excede o limite de pedidos, ENTÃO O SISTEMA DEVE responder 429.\n");
    const esW5 = path.join(tmp, "proj-wp5-es");
    S.initProject(esW5, ["core"], "es");
    const esRate = S.createFeature(esW5, "Limites", ["saas"]);
    write5(esRate, "requirements.md", "## Criterios\n1. **US-1.AC-1** — SI se supera el límite de solicitudes, ENTONCES EL SISTEMA DEBE responder 429.\n");
    ok(!S.clarify(w5pt, ptRate.slug).questions.some((q) => /limites de taxa/.test(q)) && !S.clarify(esW5, esRate.slug).questions.some((q) => /límites de tasa/.test(q)),
      "clarify: 'limite de pedidos' (PT) / 'límite de solicitudes' (ES) count as rate limits");
    const q7b = S.clarify(w5, f1h.slug).questions;
    write5(f1h, "requirements.md", REQ.replace("Export invoices as CSV.", "[1-2 sentences]").replace("PDF export.", "[what is excluded] TBD"));
    const q7c = S.clarify(w5, f1h.slug).questions.filter((q) => /placeholder/.test(q));
    ok(!q7b.some((q) => /placeholder/.test(q)) && q7c.length === 1 && /^Replace the 3 template placeholder\(s\)\/TBD in requirements\.md: requirements\.md:4 \[1-2 sentences\], requirements\.md:\d+ \[what is excluded\], requirements\.md:\d+ TBD$/.test(q7c[0]),
      "clarify groups the placeholders/TBDs into ONE question naming file:line and the bracketed text");
    const cls7 = ["Página simples sem uso de IA", "Página simple sin uso de IA", "Simple page without AI", "A page with no use of AI"].map((x) => S.classify(x));
    ok(cls7.every((r) => !r.tracks.includes("ai") && !r.possible.some((p) => p.track === "ai") && r.negated.ai.length === 1) &&
      S.classify("Summarize tickets with an LLM, no use of AI moderation").tracks.includes("ai"),
      "classifier: 'sem/sin uso de IA', 'without AI', 'no use of AI' negate the weak signal (no 'Possible +ai'); a strong signal still turns +ai on");

    // (8) EARS: EC-/NFR-/SC- are stable IDs; a deeper numbered sub-list continues its criterion
    const e8 = S.earsValidate("## Edge Cases\n- **EC-1** — WHEN the payload is empty THE SYSTEM SHALL respond 400.\n- **NFR-1** — THE SYSTEM SHALL answer in < 200 ms.\n- **SC-001** — THE SYSTEM SHALL keep errors < 1%.\n");
    ok(e8.summary.criteriaDetected === 3 && e8.summary.withStableId === 3 && !e8.issues.some((i) => i.code === "no-id"), "EARS: EC-1 / NFR-1 / SC-001 are stable IDs (no 'Criterion has no stable ID')");
    const e8b = S.earsValidate("1. **US-1.AC-1** — WHEN the form is submitted THE SYSTEM SHALL:\n   2. show an inline error when a field is invalid\n   3. keep the entered values\n2. **US-1.AC-2** — WHEN x THE SYSTEM SHALL y\n");
    const e8c = S.earsValidate("- Criteria:\n  - **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n  - **US-1.AC-2** — WHEN c THE SYSTEM SHALL d\n");
    ok(e8b.verdict === "pass" && e8b.summary.criteriaDetected === 2 && e8b.issues.length === 0 && e8c.summary.criteriaDetected === 2 && e8c.summary.withStableId === 2,
      "EARS: a numbered sub-list indented under 'THE SYSTEM SHALL:' continues that criterion; a sub-item that defines its own AC still starts one");

    // (9) templates internally consistent (EN/PT/ES, feature and bugfix); track criteria under [SaaS]/[AI] headings
    const tplOk = ["en", "pt", "es"].every((l) => {
      const f = S.createFeature(w5, "Tpl full " + l, ["tdd", "saas", "ai"], undefined, undefined, l);
      const b = S.createFeature(w5, "Tpl bug " + l, undefined, "x", undefined, l, "bugfix");
      const t = S.traceCheck(w5, f.slug), tb = S.traceCheck(w5, b.slug);
      const req = read5(f, "requirements.md");
      return t.verdict === "pass" && t.totalAcs === 10 && t.plannedTests === 10 && tb.verdict === "pass" && /^#### \[SaaS\] .*\n5\. \*\*US-1\.AC-5\*\*/m.test(req) && /^#### \[AI\] .*\n7\. \*\*US-1\.AC-7\*\*/m.test(req);
    });
    const t9 = S.traceCheck(w5, S.createFeature(w5, "Tpl tdd", ["tdd"]).slug);
    ok(tplOk && t9.verdict === "pass" && t9.plannedTests === 5 && t9.uncoveredByTests.length === 0 && t9.testsNotMappedToTasks.length === 0,
      "fresh scaffolds trace clean: every template AC has a planned test and a task, every T-ID a task (EN/PT/ES, +tdd+saas+ai, +tdd, bugfix); track ACs sit under [SaaS]/[AI] headings");
    const f9 = S.createFeature(w5, "Ai off", ["ai"]);
    S.removeTrack(w5, f9.slug, "ai");
    const ph9 = S.featurePlaceholders(w5, f9.slug, "requirements.md").items;
    write5(f9, "requirements.md", read5(f9, "requirements.md").split("\n").map((l, i) => (ph9.some((p) => p.line === i + 1) ? l.replace(/\[[^\]]*\]/g, "x") : l)).join("\n"));
    ok(!ph9.some((p) => /85|0\.03/.test(p.text)) && S.featurePlaceholders(w5, f9.slug, "requirements.md").state === "filled" && S.statusFeature(w5, f9.slug).phase === "design",
      "after add_track ai --remove, the [AI] criteria ([85]%, $[0.03]) are inactive: requirements.md can be 'filled' and the phase moves on");

    // (10) roadmap: a placeholder next task gets a localized marker; the icon agrees with the percent; attention lists the gates
    const w10 = path.join(tmp, "proj-wp5-rm");
    S.initProject(w10, ["core"], "en");
    const r1 = S.createFeature(w10, "Fresh one", ["saas"]);
    const r2 = S.createFeature(w10, "Designing", ["core"]);
    write5(r2, "requirements.md", REQ);
    S.approvePhase(w10, r2.slug, "requirements");
    fs.appendFileSync(path.join(r2.dir, "requirements.md"), "\n## Assumptions\n- none.\n");
    S.approvePhase(w10, r2.slug, "classification", undefined, { force: true });
    const md10 = S.renderRoadmapMd(w10, "en");
    const row = (n) => md10.split("\n").find((l) => l.includes("[" + n + "]")) || "";
    ok(/#1 \(placeholder\)/.test(row("fresh-one")) && /^\| ⬜ \|.* 8% /.test(row("fresh-one")) && /^\| 🟡 \|.* 16% /.test(row("designing")) && !/#1 \|/.test(md10),
      "roadmap: a placeholder next task reads '#1 (placeholder)'; 16% (design) is 🟡 in progress, ⬜ only below");
    ok(/\*\*fresh-one\*\* — mandatory sections missing\/unfilled: \[SaaS\] Performance Budget \(unfilled\)/.test(md10) && /\*\*fresh-one\*\* — template placeholders in the current phase: requirements\.md/.test(md10) &&
      /\*\*designing\*\* — changed since approval — re-review: requirements\.md/.test(md10) && /\*\*designing\*\* — approved with --force \(checks were failing\): classification/.test(md10) &&
      /\*\*designing\*\* — template placeholders in the current phase: design\.md/.test(md10),
      "roadmap 'needs attention': mandatory sections, current-phase placeholders, changed since approval, forced approvals");
    const pt10 = S.renderRoadmapMd(w10, "pt"), html10 = S.renderRoadmapHtml(w10, "es");
    ok(/#1 \(por preencher\)/.test(pt10) && /secções obrigatórias em falta\/por preencher: \[SaaS\] Orçamento de Desempenho \(por preencher\)/.test(pt10) &&
      /#1 \(sin rellenar\)/.test(html10) && /aprobado con --force/.test(html10) && /modificado desde la aprobación/.test(html10), "the roadmap markers and attention lines are localized (MD PT, HTML ES)");

    // --- review fixes ---
    // next_action never recommends an approval the approve gate refuses (it looped: approve → refused → approve…)
    const fR = S.createFeature(w5, "No loop", ["core"]);
    write5(fR, "classification.md", read5(fR, "classification.md").replace(/\[[^\]]*\]/g, "filled"));
    write5(fR, "requirements.md", REQ.replace(/## Success Criteria\n[^\n]*\n\n/, ""));
    write5(fR, "design.md", DESIGN);
    write5(fR, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4, US-2.AC-1_\n");
    const apR0 = S.approvePhase(w5, fR.slug, "classification");
    const nR1 = S.nextAction(w5, fR.slug);
    const apR = S.approvePhase(w5, fR.slug, "requirements");
    const nR2 = S.nextAction(w5, fR.slug);
    const dR = S.specDoctor(w5, fR.slug);
    ok(apR0.ok && nR1.step === "fix" && nR1.refusedGate.phase === "requirements" && nR1.refusedGate.failing.join() === "success-criteria" &&
      /^Before approving 'requirements', fix what the approve gate would refuse: success-criteria \(no measurable SC-### success criteria\)/.test(nR1.recommendation) &&
      apR.ok === false && apR.failing.join() === "success-criteria" && nR2.step === "fix" && nR2.recommendation === nR1.recommendation &&
      chk(dR, "success-criteria").status === "warn" && dR.nextGate.phase === "requirements" && dR.nextGate.ready === false &&
      /approving 'requirements' would be refused \(success-criteria\)/.test(chk(dR, "approval-gates").detail),
      "next_action never recommends an approval the gate would refuse (no loop) — it names the failing check; doctor's approval-gates says so too");
    ok(/^Antes de aprovar 'design', corrige/.test(S.msg("pt").gates.fixGate("design", "x", "f")) && /^Antes de aprobar 'design', corrige/.test(S.msg("es").gates.fixGate("design", "x", "f")),
      "the refused-gate recommendation is localized (PT/ES)");

    // clarify: TBDs are reported at their real line after a multi-line comment; one in an inactive [AI] section is not asked
    const fT = S.createFeature(w5, "Tbd lines", ["core"]);
    write5(fT, "requirements.md", "# Feature: Q\n<!-- guidance\n   more guidance\n   even more -->\n\n## Summary\nA thing.\n\n- Retention period: TBD\n\n" +
      "#### [AI] Acceptance Criteria (EARS)\n7. **US-1.AC-7** — THE SYSTEM SHALL be good TBD\n\n## Edge Cases\n- none\n## Non-Functional Requirements\n- none\n");
    const qT = S.clarify(w5, fT.slug).questions.filter((q) => /placeholder/.test(q));
    ok(qT.length === 1 && qT[0] === "Replace the 1 template placeholder(s)/TBD in requirements.md: requirements.md:9 TBD",
      "clarify: a TBD below a multi-line HTML comment keeps its real line; a TBD in an inactive [AI] section is not asked about");

    // classifier: PT 'no uso do/de' is the contraction em+o, never a negation across filler words
    const clsNo = ["Guia no uso do LLM", "Chatbot no uso do LLM para suporte", "Painel no uso de IA"].map((x) => S.classify(x));
    ok(clsNo[0].tracks.includes("ai") && !clsNo[0].negated.ai.length && !clsNo[0].notes.length &&
      clsNo[1].tracks.includes("ai") && !clsNo[1].notes.some((n) => /negated/.test(n)) && !clsNo[2].negated.ai.length && clsNo[2].possible.some((p) => p.track === "ai"),
      "classifier: 'Guia no uso do LLM' keeps +ai ON (no negation, no false conflict note); 'no use of AI' still negates");

    // bugfix gate: the template's own FIX task ("Fix the root cause") never counts as the task that writes the root cause
    const fG = S.createFeature(w5, "Login crash", undefined, "crashes", undefined, "en", "bugfix");
    write5(fG, "tasks.md", read5(fG, "tasks.md").replace("Find the root cause with evidence; fill bug.md → Root Cause (no fix yet)", "Find why it crashes, with evidence, and document it in bug.md"));
    const g1 = S.completeTask(w5, fG.slug, 1), g4 = S.completeTask(w5, fG.slug, 4), g2 = S.completeTask(w5, fG.slug, 2);
    const brG = S.taskBrief(w5, fG.slug, 4);
    ok(g1.ok && g4.ok === false && g4.gated === "root-cause" && /only task 1 can be completed/.test(g4.error) && g2.ok === false && !/- \[x\] [24]\./.test(read5(fG, "tasks.md")) &&
      brG.gated === "root-cause" && brG.gateError === g4.error && S.taskBrief(w5, fG.slug, 1).gated === undefined,
      "bugfix gate: with step 2 reworded, 'Fix the root cause' does not open the gate for itself — only the first task; spec_task_brief reports the gate");

    // the scaffold's concrete track tasks are real tasks (doctor / next_action / finish); a list of ONLY template tasks can't be approved
    const fK = S.createFeature(w5, "Track tasks kept", ["core"]);
    write5(fK, "classification.md", read5(fK, "classification.md").replace(/\[[^\]]*\]/g, "filled"));
    write5(fK, "requirements.md", REQ);
    write5(fK, "design.md", DESIGN);
    write5(fK, "tasks.md", "# Tasks\n\n- [ ] 1. [US1] Emit metrics, add dashboard, configure alerts\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n" +
      "- [ ] 2. [US1] Enforce tenant isolation — every query scoped by tenant_id\n  - _Requirements: US-1.AC-3, US-1.AC-4, US-2.AC-1_\n");
    const apK1 = S.approvePhase(w5, fK.slug, "tasks");
    write5(fK, "tasks.md", "# Tasks\n\n- [x] 1. [US1] Build the CSV writer\n  - _Requirements: US-1.AC-1_\n- [ ] 2. [US1] Emit metrics, add dashboard, configure alerts\n  - _Requirements: US-1.AC-2_\n" +
      "- [ ] 3. [US1] Enforce tenant isolation — every query scoped by tenant_id\n  - _Requirements: US-1.AC-3, US-1.AC-4, US-2.AC-1_\n");
    const approvedK = ["classification", "requirements", "design", "tasks"].every((p) => S.approvePhase(w5, fK.slug, p).ok);
    const nK = S.nextAction(w5, fK.slug);
    const dK = S.specDoctor(w5, fK.slug);
    ok(apK1.ok === false && apK1.failing.join() === "placeholders" && /only the scaffold's template tasks/.test(apK1.error) &&
      S.featurePlaceholders(w5, fK.slug, "tasks.md").state === "filled" && approvedK && nK.phase === "executing" && nK.step === "implement" && /#2/.test(nK.recommendation) &&
      chk(dK, "placeholders").status === "pass" && !S.finishFeature(w5, fK.slug).placeholders.length,
      "verbatim track tasks (tenant isolation, metrics) are not placeholders mid-execution: doctor passes, next_action implements; ONLY template tasks refuse the tasks gate");

    // trace: an OPEN task's path outside the project root can never be created there — it stays a gap, never 'planned'
    write5(f3, "tasks.md", "- [ ] 1. a\n  - _Requirements: US-1.AC-1_\n  - _Implements: ../../outside/secret.js, src/not-yet.js_\n");
    const t3c = S.traceCheck(w5, f3.slug);
    ok(t3c.verdict === "gaps-found" && t3c.missingImplFiles.join() === "../../outside/secret.js" && t3c.plannedImplFiles.join() === "src/not-yet.js",
      "trace: an open task's _Implements:_ path outside the project root is missingImplFiles (only in-root files are planned)");
  }
  // @wp WP5 <<<

  // @wp WP6 tests >>>
  { // --- 1.13 WP6: brownfield depth (scan routes/tests/entrypoints/env/migrations, coverage by _Implements:_), spec_import, integration-plan ---
    const call6 = async (name, args) => { const res = await rpc("tools/call", { name, arguments: args }); let body; try { body = JSON.parse(res.result.content[0].text); } catch { body = { ok: false, error: res.result.content[0].text }; } return { isError: !!res.result.isError, body }; };
    const safe6 = (fn) => { try { return fn(); } catch (e) { return { ok: false, threw: true, error: "THREW: " + e.message }; } };
    const w6 = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const r6 = (root, ...p) => fs.readFileSync(path.join(root, ...p), "utf8");

    // 1. scan: routes with method + path + file:line for every framework family, counted as ROUTES.
    const sc = path.join(tmp, "proj-wp6-scan");
    w6(sc, "package.json", JSON.stringify({ name: "shop", main: "src/server.js", scripts: { start: "node src/server.js" }, dependencies: { express: "^4" }, devDependencies: { jest: "^29" } }));
    w6(sc, "src/server.js", ["const express = require('express');", "const app = express();", "const router = express.Router();",
      "app.get('/health', (req, res) => res.send('ok'));", "router.post('/orders', createOrder);", "router.route('/orders/:id')", "  .get(getOrder)", "  .delete(deleteOrder);",
      "const port = process.env.PORT || 3000; const db = process.env['DB_URL'];", "axios.get('/api/external'); cache.get('/k'); app.get('env');",
      "// app.get('/commented', h);", "/* router.post('/commented', h) */", "const home = 'https://x.dev'; // app.get('/commented', h)"].join("\n"));
    w6(sc, "src/f.js", "const fastify = require('fastify')();\nfastify.get('/f', h);\n");
    w6(sc, "src/h.ts", "import { Hono } from 'hono';\nconst app = new Hono();\napp.post('/h', (c) => c.text('ok'));\n");
    w6(sc, "src/k.js", "const Router = require('@koa/router');\nconst router = new Router();\nrouter.put('/koa', h);\n");
    w6(sc, "cmd/chi/main.go", "package main\nimport \"github.com/go-chi/chi/v5\"\nfunc main() {\n  r := chi.NewRouter()\n  r.Get(\"/chi\", h)\n}\n");
    w6(sc, "src/Controller/HomeController.php","<?php\nclass HomeController {\n  #[Route('/home', methods: ['GET'])]\n  public function home() {}\n  # Route::get('/commented', h);\n}\n");
    w6(sc, "src/server.test.js", "const request = require('supertest');\nrequest(app).get('/health');\napi.get('/from-a-test');\n");
    w6(sc, "src/users.controller.ts", "import { Controller, Get, Post } from '@nestjs/common';\n@Controller('users')\nexport class UsersController {\n  @Get(':id')\n  find() {}\n  @Post()\n  create() {}\n}\n");
    w6(sc, "src/app/api/items/route.ts", "export async function GET() {}\nexport async function POST() {}\n");
    w6(sc, "api/main.py", "from fastapi import FastAPI, APIRouter\napp = FastAPI()\nrouter = APIRouter(prefix=\"/v1\")\n@app.get(\"/items/{item_id}\")\ndef read(item_id): ...\n@router.post(\"/users\")\ndef mk(): ...\nimport os\nKEY = os.getenv('SECRET_KEY')\nTOKEN = os.environ['API_TOKEN']\n");
    w6(sc, "web/app.py", "from flask import Flask, Blueprint\napp = Flask(__name__)\nbp = Blueprint('p', __name__, url_prefix='/me')\n@app.route('/login', methods=['GET', 'POST'])\ndef login(): ...\n@bp.get('/profile')\ndef profile(): ...\n");
    w6(sc, "shop/urls.py", "from django.urls import path\nurlpatterns = [\n    path('cart/', views.cart),\n]\n");
    w6(sc, "web/helpers.py", "from unittest import mock\n@mock.patch(\"svc.client\")\ndef stubbed(): ...\n@lru_cache.get(\"/cached\")\ndef c(): ...\n");
    w6(sc, "svc/src/main/java/com/x/OrderController.java", "package com.x;\n@RestController\n@RequestMapping(\"/api\")\npublic class OrderController {\n  @GetMapping(\"/orders\")\n  List<Order> all() { return null; }\n  @PostMapping(value = \"/orders\", produces = \"application/json\")\n  Order add() { String h = System.getenv(\"JAVA_OPTS\"); return null; }\n  @RequestMapping(value = \"/orders/{id}\", method = RequestMethod.PUT)\n  Order put() { return null; }\n}\n");
    w6(sc, "net/Controllers/ItemsController.cs", "[ApiController]\n[Route(\"api/[controller]\")]\npublic class ItemsController : ControllerBase {\n  [HttpGet(\"{id}\")]\n  public IActionResult Get(int id) => Ok();\n}\n");
    w6(sc, "net/Program.cs", "var app = builder.Build();\napp.MapGet(\"/ping\", () => \"pong\");\nvar x = Environment.GetEnvironmentVariable(\"ASPNET_ENV\");\n");
    w6(sc, "config/routes.rb", "Rails.application.routes.draw do\n  get '/about', to: 'pages#about'\n  resources :orders\nend\n");
    w6(sc, "routes/web.php", "<?php\nRoute::get('/dashboard', [D::class, 'index']);\nRoute::middleware('auth')->post('/posts', [P::class, 'store']);\n$k = env('APP_KEY');\n");
    w6(sc, "cmd/api/main.go", "package main\nimport (\"net/http\"; \"os\"; \"github.com/gin-gonic/gin\")\nfunc main() {\n  http.HandleFunc(\"/healthz\", h)\n  r := gin.Default()\n  r.GET(\"/v1/users\", h)\n  http.Get(\"/not-a-route\")\n  _ = os.Getenv(\"GO_ENV\")\n}\n");
    w6(sc, "tests/test_api.py", "import pytest\ndef test_x(): pass\n");
    w6(sc, ".env.example", "# comment\nSTRIPE_KEY=\nexport MAIL_FROM=noreply@example.com\n");
    w6(sc, ".env", "SECRET_IN_DOTENV=supersecret\n");
    w6(sc, "db/migrate/20240101_create_users.rb", "class CreateUsers < ActiveRecord::Migration[7.0]; end\n");
    w6(sc, "prisma/schema.prisma", "model User { id Int @id }\n");
    w6(sc, "migrations/001_init.sql", "create table t (id int);\n");
    w6(sc, "alembic/versions/abc_init.py", "def upgrade(): pass\n");
    const scan6 = safe6(() => S.scanCodebase(sc));
    const routeKeys = (scan6.routes || []).map((r) => `${r.method} ${r.path} ${r.file}:${r.line}`);
    const wantRoutes = ["GET /health src/server.js:4", "POST /orders src/server.js:5", "GET /orders/:id src/server.js:6", "DELETE /orders/:id src/server.js:6",
      "GET /users/:id src/users.controller.ts:4", "POST /users src/users.controller.ts:6", "GET /api/items src/app/api/items/route.ts:1",
      "GET /items/{item_id} api/main.py:4", "POST /v1/users api/main.py:6", "GET /login web/app.py:4", "POST /login web/app.py:4", "GET /me/profile web/app.py:6",
      "ANY /cart/ shop/urls.py:3", "GET /api/orders svc/src/main/java/com/x/OrderController.java:5", "POST /api/orders svc/src/main/java/com/x/OrderController.java:7",
      "GET /api/[controller]/{id} net/Controllers/ItemsController.cs:4", "GET /ping net/Program.cs:2", "GET /about config/routes.rb:2", "RESOURCES /orders config/routes.rb:3",
      "GET /dashboard routes/web.php:2", "POST /posts routes/web.php:3", "GET /home src/Controller/HomeController.php:3", "ANY /healthz cmd/api/main.go:4", "GET /v1/users cmd/api/main.go:6",
      "GET /f src/f.js:2", "POST /h src/h.ts:3", "PUT /koa src/k.js:3", "GET /chi cmd/chi/main.go:5", "PUT /api/orders/{id} svc/src/main/java/com/x/OrderController.java:9"];
    ok(scan6.ok && wantRoutes.every((k) => routeKeys.includes(k)) && scan6.candidateEndpoints === 30 && scan6.candidateEndpoints === scan6.routes.length && scan6.endpointFiles === 17,
      "scan lists routes with method + path + file:line for Express/NestJS/Next/FastAPI/Flask/Django/Spring/ASP.NET/Rails/Laravel/Go, and counts ROUTES (missing: " +
      wantRoutes.filter((k) => !routeKeys.includes(k)).join(" | ") + ")");
    ok(!routeKeys.some((k) => /\/api\/external|\/k |not-a-route|from-a-test| env |helpers\.py|commented/.test(k)) && (scan6.routes || []).every((r) => !/\\/.test(r.file)) && (scan6.endpointSamples || []).every((f) => !/\\/.test(f)),
      "scan: client calls (axios.get, http.Get, cache.get, app.get('env')), @mock.patch decorators, commented-out routes and test files are not routes; every path uses forward slashes");
    ok((scan6.frameworks || []).includes("fastapi") && scan6.frameworks.includes("flask") && scan6.frameworks.includes("nestjs") && scan6.frameworks.includes("spring") && ["fastify", "hono", "koa", "chi", "gin", "laravel", "symfony", "rails", "aspnet", "django", "next.js"].every((x) => scan6.frameworks.includes(x)) &&
      scan6.stack.some((s) => /^python \(fastapi, flask, django\)$/.test(s)), "scan detects FastAPI/Flask/Django from imports without a Python manifest (frameworks + stack)");
    ok(scan6.testFiles === 2 && scan6.testFrameworks.includes("jest") && scan6.testFrameworks.includes("pytest"), "scan reports the test-file count and the test frameworks (package.json + imports)");
    const entries = (scan6.entrypoints || []).map((e) => e.file + " (" + e.kind + ")");
    ok(["src/server.js (package.json main)", "src/server.js (npm start)", "api/main.py (python)", "cmd/api/main.go (go main)", "net/Program.cs (.NET Program.cs)"].every((e) => entries.includes(e)),
      "scan lists entrypoints (package.json main + scripts.start, main.py, cmd/*/main.go, Program.cs) — got " + entries.join(", "));
    const scanJson = JSON.stringify(scan6);
    ok(["PORT", "DB_URL", "SECRET_KEY", "API_TOKEN", "JAVA_OPTS", "ASPNET_ENV", "APP_KEY", "GO_ENV", "STRIPE_KEY", "MAIL_FROM"].every((n) => scan6.envVars.includes(n)) &&
      !scanJson.includes("SECRET_IN_DOTENV") && !scanJson.includes("supersecret") && !scanJson.includes("noreply@example.com") && scan6.envFiles.join() === ".env.example",
      "scan collects environment variable NAMES (code + .env.example) — never a value, and never reads .env");
    ok(scan6.migrationsTotal === 4 && ["alembic/versions/abc_init.py", "db/migrate/20240101_create_users.rb", "migrations/001_init.sql", "prisma/schema.prisma"].every((m) => scan6.migrations.includes(m)),
      "scan lists migration/schema files (migrations/, db/migrate, alembic/, *.sql, schema.prisma)");
    w6(sc, "gen/many.js", Array.from({ length: 230 }, (_, i) => `app.get('/r${i}', h);`).join("\n"));
    const scanCap = safe6(() => S.scanCodebase(sc));
    ok(scanCap.candidateEndpoints === 260 && scanCap.routes.length === 200 && scanCap.routesTruncated === true && /200 of 260/.test(scanCap.routesNote || ""),
      "scan caps the listed routes at 200 with a truncation note, and still counts all of them");
    const scanMcp = await call6("spec_scan", { projectDir: sc });
    ok(!scanMcp.isError && scanMcp.body.candidateEndpoints === 260 && Array.isArray(scanMcp.body.routes) && scanMcp.body.routes[0].line > 0, "MCP spec_scan returns the routes structured");
    fs.rmSync(path.join(sc, "gen"), { recursive: true, force: true });

    // 2. coverage: files named in any _Implements:_ (active + archived features), per folder; the repro src/ layout is no longer 0%.
    const cv = path.join(tmp, "proj-wp6-cov");
    ["src/routes/orders.js", "src/routes/users.js", "src/lib/db.js", "lib/x.py", "index.js", "src/routes/orders.test.js", "tests/test_x.py", "README.md"].forEach((f) => w6(cv, f, "x"));
    const cvA = S.createFeature(cv, "Orders", ["core"]);
    fs.writeFileSync(path.join(cvA.dir, "tasks.md"), "- [ ] 1. a\n  - _Implements: src/routes/orders.js, `src/nope.js`, ../outside.js_\n<!-- _Implements: src/lib/db.js_ -->\n");
    const cvB = S.createFeature(cv, "Legacy", ["core"]);
    fs.writeFileSync(path.join(cvB.dir, "tasks.md"), "- [x] 1. b\n  - _Implements: lib/_\n");
    S.manageFeature(cv, "archive", "legacy");
    const cov6 = safe6(() => S.coverage(cv));
    const folderOf = (n) => (cov6.byFolder || []).find((f) => f.folder === n) || {};
    ok(cov6.coveragePercent === 40 && cov6.codeFiles === 5 && cov6.coveredFiles === 2 && cov6.testFiles === 2 && folderOf("src").files === 3 && folderOf("src").covered === 1 &&
      folderOf("lib").percent === 100 && cov6.documented.join() === "lib,src" && cov6.undocumented.join() === "." && cov6.uncoveredFolders.join() === "." && cov6.modulesTotal === 3,
      "coverage = code files named in _Implements:_ (40%: src/routes/orders.js + the archived feature's lib/), per folder, tests apart");
    ok(cov6.archivedFeatures.join() === "legacy" && cov6.features.join() === "orders" && cov6.byFeature.find((b) => b.feature === "legacy").archived === true &&
      cov6.unmatchedImplements.map((u) => u.ref).join() === "src/nope.js,../outside.js" && !cov6.uncoveredSample.includes("src/routes/orders.js"),
      "coverage reads archived features too, ignores commented markers, never counts a path outside the project, and lists _Implements:_ entries that name no code file");
    const testNames = ["src/a.test.js", "src/a.spec.ts", "tests/x.js", "__tests__/a.js", "test_x.py", "pkg/x_test.go", "spec/models/user_spec.rb", "src/test/java/FooTest.java", "UserSpec.kt", "mcp/test.js"];
    const codeNames = ["cli/dev-spec.js", "mcp/lib/spec.js", "src/latest.js", "src/contest.py", "src/specs.js", "src/attest.js"];
    ok(testNames.every((f) => S.isTestFile(f)) && !codeNames.some((f) => S.isTestFile(f)),
      "test files follow the naming conventions (foo.test.js, test_x.py, x_test.go, FooTest.java…); dev-spec.js / lib/spec.js are code");
    fs.writeFileSync(path.join(cvA.dir, "tasks.md"), "- [ ] 1. a\n  - _Implements: src/routes/*.js_\n");
    const covGlob = await call6("spec_coverage", { projectDir: cv });
    ok(!covGlob.isError && covGlob.body.coveredFiles === 3 && covGlob.body.coveragePercent === 60, "coverage: a glob in _Implements:_ (src/routes/*.js) names every matching file (MCP spec_coverage)");

    // 3. spec_import — Kiro.
    const im = path.join(tmp, "proj-wp6-import");
    S.initProject(im, ["core"], "en");
    w6(im, ".kiro/specs/user-auth/requirements.md", ["# Requirements Document", "", "## Introduction", "", "Users sign in with email and password to reach their account.", "",
      "## Requirements", "", "### Requirement 1", "", "**User Story:** As a user, I want to sign in with my email, so that I can reach my account.", "", "#### Acceptance Criteria", "",
      "1. WHEN a user submits valid credentials THEN the system SHALL create a session", "2. IF the password is wrong THEN the system SHALL show an error and keep the form", "",
      "### Requirement 2", "", "**User Story:** As an admin, I want to lock accounts, so that abuse stops.", "", "#### Acceptance Criteria", "",
      "1. WHEN an admin locks an account THEN the system rejects its sign-ins", "2. The lock is audited", ""].join("\n"));
    w6(im, ".kiro/specs/user-auth/design.md", "# Design Document\n\n## Overview\nSession cookies, bcrypt.\n");
    w6(im, ".kiro/specs/user-auth/tasks.md", ["# Implementation Plan", "", "- [x] 1. Set up the auth module", "  - Create folders", "  - _Requirements: 1.1_", "",
      "- [ ] 2. Implement sign-in", "- [x] 2.1 Password check", "  - _Requirements: 1.1, 1.2_", "- [ ] 2.2 Lockout", "  - _Requirements: 2.1, 2.2, 9.9_", "",
      "- [ ]* 3. Write e2e tests", "  - _Requirements: 2_", ""].join("\n"));
    const kiroSrc = ["requirements.md", "design.md", "tasks.md"].map((f) => r6(im, ".kiro", "specs", "user-auth", f));
    const kiro = await call6("spec_import", { tool: "kiro", path: ".kiro/specs/user-auth", projectDir: im });
    const kb = kiro.body;
    const kReq = kb.ok ? r6(im, ".specs", "user-auth", "requirements.md") : "";
    const kTasks = kb.ok ? r6(im, ".specs", "user-auth", "tasks.md") : "";
    ok(!kiro.isError && kb.feature === "user-auth" && kb.mapping["1.1"] === "US-1.AC-1" && kb.mapping["1.2"] === "US-1.AC-2" && kb.mapping["2.2"] === "US-2.AC-2" && kb.mapping["Requirement 2"] === "US-2" &&
      /1\. \*\*US-1\.AC-1\*\* — WHEN a user submits valid credentials THEN the system SHALL create a session/.test(kReq),
      "spec_import kiro: Requirement N criterion M → US-N.AC-M (EARS criteria kept verbatim), mapping returned");
    ok(/- \[x\] 1\. Set up the auth module\n  - Create folders\n  - _Requirements: US-1\.AC-1_/.test(kTasks) && /## Implement sign-in\n- \[x\] 2\. Password check\n  - _Requirements: US-1\.AC-1, US-1\.AC-2_/.test(kTasks) &&
      /- \[ \] 3\. Lockout\n  - _Requirements: US-2\.AC-1, US-2\.AC-2, 9\.9_/.test(kTasks) && /- \[ \] 4\. Write e2e tests \(optional\)\n  - _Requirements: US-2\.AC-1, US-2\.AC-2_/.test(kTasks) &&
      kb.mapping["task 2.1"] === "task 2" && kb.warnings.some((x) => /'9\.9'/.test(x)),
      "spec_import kiro: _Requirements:_ rewritten (a whole requirement expands to its ACs; an unknown ref is kept + reported), sub-tasks numbered, checkbox state kept");
    const kEars = safe6(() => S.earsFeature(im, "user-auth"));
    const kErrLines = (kEars.issues || []).filter((x) => x.severity === "error").map((x) => x.text);
    ok(/US-2\.AC-1\*\* — WHEN an admin locks an account, THE SYSTEM SHALL reject its sign-ins/.test(kReq) && kErrLines.length === 1 && /US-2\.AC-2.*The lock is audited \[NEEDS CLARIFICATION/.test(kErrLines[0]) &&
      kb.warnings.some((x) => /US-2\.AC-2/.test(x)), "spec_import kiro: WHEN…THEN without SHALL becomes EARS; an unconvertible criterion keeps its text + [NEEDS CLARIFICATION] (the only EARS error)");
    const kNote = /^> Imported from Kiro `\.kiro\/specs\/user-auth` on \d{4}-\d{2}-\d{2}\.$/m;
    ok(["requirements.md", "design.md", "tasks.md", "classification.md"].every((f) => kNote.test(r6(im, ".specs", "user-auth", f))) && /## Overview\nSession cookies, bcrypt\./.test(r6(im, ".specs", "user-auth", "design.md")) &&
      kb.tracks.includes("tdd") && /## Testability Notes/.test(r6(im, ".specs", "user-auth", "design.md")),
      "spec_import: every generated artifact carries 'Imported from <tool> <path> on <date>'; the design is imported (+ the active tracks' sections); tracks auto-classified (+tdd)");
    ok(["requirements.md", "design.md", "tasks.md"].every((f, i) => r6(im, ".kiro", "specs", "user-auth", f) === kiroSrc[i]), "spec_import never modifies the source files");
    const kAgain = await call6("spec_import", { tool: "kiro", path: ".kiro/specs/user-auth", projectDir: im });
    ok(kAgain.isError && /already exists/.test(kAgain.body.error) && r6(im, ".specs", "user-auth", "requirements.md") === kReq, "spec_import refuses an existing feature (nothing overwritten)");
    const outDir = path.join(tmp, "wp6-outside");
    w6(outDir, "requirements.md", "### Requirement 1\n#### Acceptance Criteria\n1. WHEN x THEN the system SHALL y\n");
    const kOut = await call6("spec_import", { tool: "kiro", path: "../wp6-outside", projectDir: im });
    const kAbs = safe6(() => S.importSpec(im, "kiro", outDir, { name: "outside-abs" }));
    ok(kOut.isError && /outside the project/.test(kOut.body.error) && !kAbs.ok && /outside the project/.test(kAbs.error) && !fs.existsSync(path.join(im, ".specs", "wp6-outside")) && !fs.existsSync(path.join(im, ".specs", "outside-abs")),
      "spec_import refuses a source outside the project (relative ../ and absolute), creating nothing");
    w6(im, ".kiro/specs/cost$1/requirements.md", "## Requirements\n\n### Requirement 1\n\n#### Acceptance Criteria\n\n1. WHEN a refund is requested THEN the system administrator approves it\n2. WHEN a refund is paid THEN the system sends a receipt\n");
    const kDollar = safe6(() => S.importSpec(im, "kiro", ".kiro/specs/cost$1", { name: "Refunds" }));
    const kdReq = kDollar.ok ? r6(im, ".specs", "refunds", "requirements.md") : "";
    ok(kDollar.ok && kdReq.includes("> Imported from Kiro `.kiro/specs/cost$1` on ") && r6(im, ".specs", "refunds", "classification.md").includes("`.kiro/specs/cost$1`") &&
      /US-1\.AC-1\*\* — WHEN a refund is requested, THE SYSTEM SHALL ensure that the system administrator approves it/.test(kdReq) &&
      /US-1\.AC-2\*\* — WHEN a refund is paid, THE SYSTEM SHALL send a receipt/.test(kdReq),
      "spec_import: a '$' in the source path is written literally; 'the system <noun>' is not read as a verb ('ensure that'), 'the system sends' → SHALL send");
    w6(im, ".kiro/specs/bold-ac/requirements.md", "### Requirement 1: Export\n\n**Acceptance Criteria:**\n\n1. WHEN a user exports THEN the system SHALL send a CSV\n");
    const kBold = safe6(() => S.importSpec(im, "kiro", ".kiro/specs/bold-ac"));
    ok(kBold.ok && kBold.mapping["1.1"] === "US-1.AC-1" && /### US-1: Export/.test(r6(im, ".specs", "bold-ac", "requirements.md")) && kBold.warnings.some((x) => /tasks\.md/.test(x)),
      "spec_import kiro: a bold **Acceptance Criteria:** label and a titled '### Requirement 1: Export' are read too; a missing tasks.md is reported");
    let linked = false;
    try { fs.symlinkSync(outDir, path.join(im, "linked-spec"), "junction"); linked = true; } catch { /* no symlink rights: skip */ }
    const kLink = linked ? safe6(() => S.importSpec(im, "kiro", "linked-spec", { name: "via-link" })) : { ok: false, error: "outside the project (skipped)" };
    ok(!kLink.ok && /outside the project/.test(kLink.error) && !fs.existsSync(path.join(im, ".specs", "via-link")), "spec_import refuses a link inside the project that points outside it" + (linked ? "" : " (link not creatable here — skipped)"));
    const kBad = [await call6("spec_import", { tool: "notion", path: ".kiro/specs/user-auth", projectDir: im }), await call6("spec_import", { tool: "kiro", projectDir: im }),
      await call6("spec_import", { tool: "kiro", path: ".kiro", name: "Nothing Here", projectDir: im }), await call6("spec_import", { tool: "kiro", path: ".kiro/specs/user-auth", name: "Typo", tracks: ["sass"], projectDir: im })];
    ok(kBad.every((r) => r.isError) && /Invalid argument|one of/.test(kBad[0].body.error) && /Missing required argument\(s\): path/.test(kBad[1].body.error) && /No Kiro spec files found/.test(kBad[2].body.error) &&
      /did you mean 'saas'/.test(kBad[3].body.error) && !fs.existsSync(path.join(im, ".specs", "typo")), "spec_import errors: unknown tool, missing path, nothing to import, unknown track (did-you-mean) — nothing created");

    // spec-kit
    w6(im, "specs/001-photo-albums/spec.md", ["# Feature Specification: Photo Albums", "", "**Feature Branch**: `001-photo-albums`", "**Input**: User description: \"Organize photos into albums by date\"", "",
      "## User Scenarios & Testing *(mandatory)*", "", "### User Story 1 - Create albums (Priority: P1)", "", "A user groups photos into albums.", "", "**Independent Test**: create an album and see it listed.", "",
      "**Acceptance Scenarios**:", "", "1. **Given** a user with photos, **When** they create an album named Trip, **Then** the album Trip is listed",
      "2. **Given** an album, **When** the user renames it, **Then** the system shows the new name", "", "---", "", "### User Story 2 - Share albums (Priority: P2)", "", "**Acceptance Scenarios**:", "",
      "1. **When** the owner shares an album, **Then** the invitee can view it", "", "### Edge Cases", "", "- What happens when an album is empty?", "",
      "## Requirements *(mandatory)*", "", "### Functional Requirements", "", "- **FR-001**: System MUST let users create albums", "- **FR-002**: System MUST keep photo order", "",
      "## Success Criteria *(mandatory)*", "", "### Measurable Outcomes", "", "- **SC-001**: 90% of users create an album in under 1 minute", ""].join("\n"));
    w6(im, "specs/001-photo-albums/plan.md", "# Implementation Plan: Photo Albums\n\n## Summary\nSQLite + Vite.\n\n## Constitution Check\n- [x] Simplicity\n");
    w6(im, "specs/001-photo-albums/tasks.md", ["# Tasks: Photo Albums", "", "## Phase 1: Setup", "", "- [x] T001 Create project structure", "- [ ] T002 [P] Configure linting", "",
      "## Phase 3: User Story 1 - Create albums (Priority: P1)", "", "- [ ] T010 [P] [US1] Album model in src/models/album.ts", "- [ ] T011 [US1] Album service", "",
      "**Checkpoint**: User Story 1 works on its own", ""].join("\n"));
    w6(im, "specs/001-photo-albums/research.md", "# Research\n");
    const sk = safe6(() => S.importSpec(im, "spec-kit", "specs/001-photo-albums", { tracks: "saas" }));
    const skReq = sk.ok ? r6(im, ".specs", "photo-albums", "requirements.md") : "";
    const skTasks = sk.ok ? r6(im, ".specs", "photo-albums", "tasks.md") : "";
    ok(sk.ok && sk.feature === "photo-albums" && sk.mapping["User Story 1 / Scenario 2"] === "US-1.AC-2" && sk.mapping["User Story 2"] === "US-2" && sk.mapping["SC-001"] === "SC-001" && sk.mapping["FR-002"] === "FR-002" &&
      /### US-1 \(P1\): Create albums/.test(skReq) && /1\. \*\*US-1\.AC-1\*\* — WHILE a user with photos, WHEN they create an album named Trip, THE SYSTEM SHALL ensure that the album Trip is listed/.test(skReq) &&
      /2\. \*\*US-1\.AC-2\*\* — WHILE an album, WHEN the user renames it, THE SYSTEM SHALL show the new name/.test(skReq) && /- \*\*FR-001\*\*: System MUST let users create albums/.test(skReq) &&
      /## Success Criteria\n[\s\S]*- \*\*SC-001\*\*: 90%/.test(skReq), "spec_import spec-kit: scenario M of story N → US-N.AC-M as one EARS criterion; FR-/SC- lines kept with their IDs; priority kept");
    ok(/- \[x\] 1\. Create project structure/.test(skTasks) && /- \[ \] 2\. \[P\] Configure linting/.test(skTasks) && /- \[ \] 3\. \[P\] \[US1\] Album model in src\/models\/album\.ts/.test(skTasks) &&
      /\*\*Checkpoint\*\*: User Story 1 works on its own/.test(skTasks) && sk.mapping["task T010"] === "task 3" && S.parseTasks(skTasks).find((t) => t.number === 3).story === "US1" &&
      S.parseTasks(skTasks).find((t) => t.number === 3).parallel === true, "spec_import spec-kit: T001… → numbered tasks keeping checkbox state, [P]/[USn] tags and checkpoints");
    const skEars = safe6(() => S.earsFeature(im, "photo-albums"));
    ok(skEars.verdict === "pass" && skEars.summary.criteriaDetected === 3 && sk.label === "core +saas" && /## \[SaaS\] Performance Budget/.test(r6(im, ".specs", "photo-albums", "design.md")) &&
      /## Constitution Check/.test(r6(im, ".specs", "photo-albums", "design.md")) && sk.warnings.some((x) => /research\.md/.test(x)),
      "spec_import spec-kit: the imported requirements pass ears_validate; explicit tracks honoured; plan.md becomes design.md (+ the [SaaS] sections); un-imported files reported");

    // OpenSpec: a capability and a change folder (PT artifacts).
    w6(im, "openspec/specs/auth/spec.md", ["# Auth Specification", "", "## Purpose", "Authentication and session management.", "", "## Requirements", "### Requirement: User Authentication",
      "The system SHALL issue a JWT on successful login.", "", "#### Scenario: Valid credentials", "- **WHEN** a user submits valid credentials", "- **THEN** a JWT is returned",
      "- **AND** the token expires in 24 hours", "", "#### Scenario: Invalid credentials", "- **WHEN** credentials are invalid", "- **THEN** the system returns 401", "",
      "### Requirement: Logout", "Users can end a session.", "", "#### Scenario: Logout", "- **GIVEN** a signed-in user", "- **WHEN** they log out", "- **THEN** the session is revoked", ""].join("\n"));
    w6(im, "openspec/changes/add-2fa/proposal.md", "# Change: Add 2FA\n\n## Why\nAccounts need a second factor.\n\n## What Changes\n- Add OTP\n");
    w6(im, "openspec/changes/add-2fa/tasks.md", "## 1. Implementation\n- [ ] 1.1 Add OTP secret to user model\n- [x] 1.2 Verify OTP on login\n\n## 2. Docs\n- [ ] 2.1 Document 2FA\n");
    w6(im, "openspec/changes/add-2fa/specs/auth/spec.md", ["## ADDED Requirements", "### Requirement: Two-Factor Authentication", "The system MUST require a second factor.", "",
      "#### Scenario: OTP required", "- **WHEN** a user with 2FA logs in", "- **THEN** an OTP challenge is shown", "", "## MODIFIED Requirements", "### Requirement: User Authentication",
      "#### Scenario: Valid credentials and OTP", "- **WHEN** credentials and OTP are valid", "- **THEN** the system SHALL issue a JWT", "",
      "## REMOVED Requirements", "### Requirement: Remember Me", "**Reason**: replaced by 2FA", ""].join("\n"));
    const os1 = safe6(() => S.importSpec(im, "openspec", "openspec/specs/auth/spec.md", { name: "Auth" }));
    const osReq = os1.ok ? r6(im, ".specs", "auth", "requirements.md") : "";
    ok(os1.ok && os1.mapping["auth: Requirement: Logout"] === "US-2" && os1.mapping["auth: User Authentication / Scenario: Invalid credentials"] === "US-1.AC-2" &&
      /US-1\.AC-1\*\* — WHEN a user submits valid credentials, THE SYSTEM SHALL ensure that a JWT is returned and the token expires in 24 hours/.test(osReq) &&
      /US-1\.AC-2\*\* — WHEN credentials are invalid, THE SYSTEM SHALL return 401/.test(osReq) && /US-2\.AC-1\*\* — WHILE a signed-in user, WHEN they log out, THE SYSTEM SHALL ensure that the session is revoked/.test(osReq) &&
      /^> The system SHALL issue a JWT on successful login\.$/m.test(osReq) && /## Summary\nAuthentication and session management\./.test(osReq) && S.earsFeature(im, "auth").verdict === "pass" &&
      os1.warnings.some((x) => /tasks\.md/.test(x)), "spec_import openspec capability: requirement N scenario M → US-N.AC-M, WHEN/THEN/AND (+GIVEN) → EARS that passes ears_validate");
    const os2 = await call6("spec_import", { tool: "openspec", path: "openspec/changes/add-2fa", lang: "pt", projectDir: im });
    const os2Req = os2.body.ok ? r6(im, ".specs", "add-2fa", "requirements.md") : "";
    const os2Tasks = os2.body.ok ? r6(im, ".specs", "add-2fa", "tasks.md") : "";
    ok(!os2.isError && os2.body.lang === "pt" && /^> Importado de OpenSpec `openspec\/changes\/add-2fa` em /m.test(os2Req) && /## Histórias de Utilizador/.test(os2Req) && /#### Critérios de Aceitação \(EARS\)/.test(os2Req) &&
      /### US-2: User Authentication \(modificado\)/.test(os2Req) && /US-2\.AC-1\*\* — WHEN credentials and OTP are valid, the system SHALL issue a JWT/.test(os2Req) && !/Remember Me/.test(os2Req) &&
      os2.body.warnings.some((x) => /REMOVED.*Remember Me/.test(x)) && /## Resumo\nAccounts need a second factor\./.test(os2Req) &&
      /## 1\. Implementation\n- \[ \] 1\. Add OTP secret to user model\n- \[x\] 2\. Verify OTP on login/.test(os2Tasks) && /- \[ \] 3\. Document 2FA/.test(os2Tasks) && os2.body.mapping["task 2.1"] === "task 3" &&
      S.earsFeature(im, "add-2fa").verdict === "pass", "spec_import openspec change: ADDED + MODIFIED imported (REMOVED reported), proposal Why → summary, 1.1-style tasks renumbered, PT artifact text");

    // 4. integration-plan.md: spec_create {brownfield:true} scaffolds it (create-only); doctor warns while it is the template.
    const bf = await call6("spec_create", { name: "Legacy Billing", tracks: ["core"], brownfield: true, projectDir: im });
    const planPath = path.join(im, ".specs", "legacy-billing", "integration-plan.md");
    const docCheck = () => (S.specDoctor(im, "legacy-billing").checks || []).find((c) => c.id === "integration-plan");
    const before = docCheck();
    fs.writeFileSync(planPath, "# Integration Plan: Legacy Billing\n\n## Integration Points\n- billing/invoice.js (new hook)\n\n## Risks & Mitigations\n- Double charge: idempotency key.\n");
    const again = S.createFeature(im, "Legacy Billing", undefined, undefined, undefined, undefined, undefined, { brownfield: true });
    const after = docCheck();
    ok(!bf.isError && bf.body.created.includes("integration-plan.md") && before && before.status === "warn" && /template/.test(before.detail) && after && after.status === "pass" &&
      again.skipped.includes("integration-plan.md") && /idempotency key/.test(fs.readFileSync(planPath, "utf8")) && !(S.specDoctor(im, "auth").checks || []).some((c) => c.id === "integration-plan"),
      "spec_create brownfield:true scaffolds integration-plan.md (never overwritten); doctor 'integration-plan' warns while it is the template, passes once filled, is absent without the file");
    const ptBf = path.join(tmp, "proj-wp6-pt");
    S.initProject(ptBf, ["core"], "pt");
    S.createFeature(ptBf, "Faturas Antigas", ["core"], undefined, undefined, undefined, undefined, { brownfield: true });
    ok(/## Pontos de Integração/.test(r6(ptBf, ".specs", "faturas-antigas", "integration-plan.md")) && /ainda é o template/.test(S.specDoctor(ptBf, "faturas-antigas").checks.find((c) => c.id === "integration-plan").detail),
      "integration-plan.md and its doctor check follow the feature language (PT)");

    // 5. Review round: HTTP client calls are not routes; wrapped decorators/annotations are.
    const sc2 = path.join(tmp, "proj-wp6-scan2");
    w6(sc2, "package.json", JSON.stringify({ name: "front", dependencies: { vue: "^3", axios: "^1" } }));
    w6(sc2, "src/http.js", "import axios from 'axios';\nconst instance = axios.create({ baseURL: 'https://api.example.com' });\nexport const me = () => instance.get('/user');\nexport const upd = (b) => instance.put('/user', b);\n");
    w6(sc2, "src/client.ts", "import ky from 'ky';\nconst api = ky.create({prefixUrl: '/api'});\nexport const list = () => api.get('/orders').json();\n");
    w6(sc2, "src/services/users.ts", "import axios from 'axios'; const api = axios.create({ baseURL: '/api' }); export const listUsers = () => api.get('/users'); export const delUser = (id) => api.delete('/users/' + id);\n");
    w6(sc2, "server/proxy.js", "const express = require('express');\nconst axios = require('axios');\nconst app = express();\napp.get('/proxy', h);\nconst api = axios.create();\napi.get('/not-a-route');\n");
    w6(sc2, "server/plugin.js", "module.exports = async function (api) {\n  api.get('/plugin-route', h);\n};\n");
    w6(sc2, "app/main.py", "from fastapi import FastAPI\napp = FastAPI()\n@app.get(\n    \"/multi\",\n    response_model=Item,\n)\ndef m(): ...\n@app.route(\n    \"/login\",\n    methods=[\"GET\", \"POST\"],\n)\ndef login(): ...\n@app.get(\"/one\")\ndef one(): ...\n");
    w6(sc2, "svc/Ctl.java", "@RestController\n@RequestMapping(\n    \"/api\"\n)\npublic class Ctl {\n  @GetMapping(\n      value = \"/wrapped\",\n      produces = \"application/json\")\n  String w() { return null; }\n}\n");
    const scan2 = safe6(() => S.scanCodebase(sc2));
    const rk2 = (scan2.routes || []).map((r) => `${r.method} ${r.path} ${r.file}:${r.line}`);
    const want2 = ["GET /proxy server/proxy.js:4", "GET /plugin-route server/plugin.js:2", "GET /multi app/main.py:3", "GET /login app/main.py:8", "POST /login app/main.py:8", "GET /one app/main.py:13", "GET /api/wrapped svc/Ctl.java:6"];
    ok(want2.every((k) => rk2.includes(k)) && scan2.candidateEndpoints === 7,
      "scan: a Black-wrapped @app.get(\\n \"/x\",…) and a multi-line @GetMapping(value = …) are routes, reported on the decorator's line (got " + rk2.join(" | ") + ")");
    ok(!rk2.some((k) => /\/user |\/users|\/orders|not-a-route/.test(k)),
      "scan: calls on an HTTP client (axios.create() instance, ky api) in .js/.ts service files are not routes; an `api` parameter in a plain module still is");

    // Review round: coverage separates missing targets from existing test / non-code ones, and works at a drive root.
    const cv2 = path.join(tmp, "proj-wp6-cov2");
    ["tests/orders.test.js", "src/routes/orders.js", "README.md", "dist/bundle.js"].forEach((f) => w6(cv2, f, "x"));
    const cv2f = S.createFeature(cv2, "Orders", ["tdd"]);
    fs.writeFileSync(path.join(cv2f.dir, "tasks.md"), "- [ ] 1. t\n  - _Implements: tests/orders.test.js_\n- [ ] 2. i\n  - _Implements: src/routes/orders.js, README.md, dist/bundle.js, docs/*.md, src/gone.js_\n");
    const cov2 = safe6(() => S.coverage(cv2));
    ok(cov2.coveragePercent === 100 && (cov2.unmatchedImplements || []).map((u) => u.ref).join() === "docs/*.md,src/gone.js" &&
      (cov2.nonCodeImplements || []).map((u) => u.ref).join() === "tests/orders.test.js,README.md,dist/bundle.js",
      "coverage: only _Implements:_ entries naming nothing on disk are unmatched; an existing test / doc / build file is listed apart (nonCodeImplements)");
    const driveRoot = path.parse(tmp).root; // C:\ or / — already ends in a separator
    ok(safe6(() => S.implementsTargets(driveRoot, "src/a.js", new Map([["src/a.js", "src/a.js"]]), (s) => s)).join() === "src/a.js",
      "coverage: an _Implements:_ target resolves when the project root is a drive root (subst Q:\\)");

    // Review round: tool names are exact on both surfaces (the MCP enum), no aliases or case folding.
    const aliasMcp = await call6("spec_import", { tool: "speckit", path: "specs/001-photo-albums", name: "Alias MCP", projectDir: im });
    const aliasEng = [safe6(() => S.importSpec(im, "speckit", "specs/001-photo-albums", { name: "Alias One" })), safe6(() => S.importSpec(im, "Kiro", ".kiro/specs/user-auth", { name: "Alias Two" }))];
    ok(aliasMcp.isError && aliasEng.every((r) => !r.ok && /Unknown spec format/.test(r.error)) && !["alias-mcp", "alias-one", "alias-two"].some((s) => fs.existsSync(path.join(im, ".specs", s))),
      "spec_import: 'speckit' / 'Kiro' are refused by the engine exactly like the MCP schema refuses them (CLI = MCP)");

    // Review round: Kiro in-progress `[-]`, a stand-alone task after a parent group, a reference no task owns.
    w6(im, ".kiro/specs/todo/requirements.md", "## Requirements\n\n### Requirement 1\n\n#### Acceptance Criteria\n\n1. WHEN a todo is added THEN the system SHALL store it\n2. WHEN a todo is edited THEN the system SHALL save it\n3. WHEN the app restarts THEN the system SHALL reload todos\n");
    w6(im, ".kiro/specs/todo/tasks.md", "- [ ] 1. Set up\n- [ ] 2. Implement todo model\n  - [x] 2.1 Create Todo type\n    - _Requirements: 1.1, 1.2_\n  - [-] 2.2 Add persistence\n    - _Requirements: 1.3_\n- [ ]* 3. Optional: audit export\n\nNotes: _Requirements: 1.2, 7.7_\n<!-- _Requirements: 8.8_ -->\n");
    const todo = safe6(() => S.importSpec(im, "kiro", ".kiro/specs/todo"));
    const todoTasks = todo.ok ? r6(im, ".specs", "todo", "tasks.md") : "";
    ok(todo.ok && todo.mapping["task 2.2"] === "task 3" && /- \[ \] 3\. Add persistence\n  - _Requirements: US-1\.AC-3_/.test(todoTasks) && !/\[-\]/.test(todoTasks) &&
      (S.traceCheck(im, "todo").uncoveredByTasks || ["?"]).length === 0,
      "spec_import kiro: an in-progress `[-]` task is a task (open), its _Requirements:_ rewritten — trace_check covers its AC");
    ok(/- \[ \] 1\. Set up\n\n## Implement todo model\n- \[x\] 2\. Create Todo type/.test(todoTasks) && /\n\n## Other tasks\n- \[ \] 4\. Optional: audit export \(optional\)/.test(todoTasks) &&
      /"\*\*Phase:\*\* Other tasks|\*\*Phase:\*\* Other tasks/.test(JSON.stringify(safe6(() => S.taskBrief(im, "todo", 4)))),
      "spec_import: a stand-alone task after a parent's phase heading gets a neutral '## Other tasks' heading (its brief no longer names the parent's phase)");
    ok(/^Notes: _Requirements: US-1\.AC-2, 7\.7_$/m.test(todoTasks) && todo.warnings.some((x) => /line 9: .*'7\.7'/.test(x)) && /<!-- _Requirements: 8\.8_ -->/.test(todoTasks) && !todo.warnings.some((x) => /8\.8/.test(x)),
      "spec_import: a _Requirements:_ reference no task owns is rewritten too (unknown ones reported by line); one inside an HTML comment is left alone");

    // Review round: no source requirement text is dropped (wrapped/bulleted criteria, notes, NFR sub-sections, Purpose, Constraints).
    w6(im, ".kiro/specs/wrap/requirements.md", ["# Requirements Document", "", "## Introduction", "", "Exports for users.", "", "Second intro paragraph WRAPINTRO.", "", "## Requirements", "",
      "### Requirement 1", "", "**User Story:** As a user, I want exports, so that I keep my data.", "", "#### Acceptance Criteria", "",
      "1. WHEN a user requests an export of all their photos and albums", "THEN the system SHALL produce a zip archive within 60 seconds", "",
      "Note: exports older than 7 days are deleted.", "", "### Requirement 2", "", "#### Acceptance Criteria", "",
      "- WHEN a user clicks save THEN the system SHALL persist the draft", "- IF the save fails THEN the system SHALL show a retry banner", "",
      "### Non-Functional Requirements", "", "- The export endpoint SHALL be rate-limited to 10 req/min", ""].join("\n"));
    const wrap = safe6(() => S.importSpec(im, "kiro", ".kiro/specs/wrap"));
    const wrapReq = wrap.ok ? r6(im, ".specs", "wrap", "requirements.md") : "";
    const wrapEars = safe6(() => S.earsFeature(im, "wrap"));
    ok(wrap.ok && /US-1\.AC-1\*\* — WHEN a user requests an export of all their photos and albums THEN the system SHALL produce a zip archive within 60 seconds/.test(wrapReq) &&
      /AC-1\*\*[^\n]*\n\nNote: exports older than 7 days are deleted\.\n\n### US-2/.test(wrapReq) && !wrap.warnings.some((x) => /not converted to EARS/.test(x)),
      "spec_import kiro: a criterion wrapped onto an unindented THEN line stays whole; a note after the criteria follows them verbatim");
    ok(wrap.mapping["2.1"] === "US-2.AC-1" && /US-2\.AC-1\*\* — WHEN a user clicks save THEN the system SHALL persist the draft/.test(wrapReq) && /US-2\.AC-2\*\* — IF the save fails/.test(wrapReq) &&
      /## Non-Functional Requirements\n- The export endpoint SHALL be rate-limited to 10 req\/min/.test(wrapReq) && /## Introduction\nSecond intro paragraph WRAPINTRO\./.test(wrapReq) &&
      wrap.warnings.some((x) => /carried over verbatim.*Introduction.*Non-Functional Requirements/.test(x)) && Array.isArray(wrapEars.issues) && !wrapEars.issues.some((x) => x.severity === "error"),
      "spec_import kiro: bulleted criteria are criteria; a ### Non-Functional Requirements section and the rest of the introduction are carried verbatim and named in a warning; no EARS error");
    w6(im, "specs/003-nfr/spec.md", "# Feature Specification: NFR\n\n## User Scenarios & Testing\n\n### User Story 1 - Export (Priority: P1)\n\n**Acceptance Scenarios**:\n\n1. **Given** a user, **When** they export, **Then** the system sends a zip\n\nThe zip is named after the account (SKNOTE).\n\n## Requirements\n\n### Functional Requirements\n\n- **FR-001**: System MUST export\n\n### Non-Functional Requirements\n\n- **NFR-001**: exports finish in 60 s (UNIQUEMARKER1)\n");
    const skn = safe6(() => S.importSpec(im, "spec-kit", "specs/003-nfr"));
    const sknReq = skn.ok ? r6(im, ".specs", "nfr", "requirements.md") : "";
    ok(skn.ok && /## Non-Functional Requirements\n- \*\*NFR-001\*\*: exports finish in 60 s \(UNIQUEMARKER1\)/.test(sknReq) && /US-1\.AC-1\*\*[^\n]*\n(?:[^\n]*\n)?\nThe zip is named after the account \(SKNOTE\)\./.test(sknReq) &&
      skn.warnings.some((x) => /carried over verbatim.*Non-Functional Requirements/.test(x)),
      "spec_import spec-kit: an unrecognised ### section (NFR-001) and text after the scenarios are carried verbatim");
    w6(im, "openspec/specs/export/spec.md", "# Export Specification\n\n## Purpose\nExports.\n\nSecond purpose paragraph UNIQUEMARKER2.\n\n## Requirements\n### Requirement: Zip\nThe system SHALL zip exports.\n\n#### Scenario: Long form\n- **WHEN** a user submits a very long export form that\n  spans several lines\n- **THEN** the archive is produced\n\n## Constraints\n- UNIQUEMARKER3\n");
    const osx = safe6(() => S.importSpec(im, "openspec", "openspec/specs/export"));
    const osxReq = osx.ok ? r6(im, ".specs", "export", "requirements.md") : "";
    ok(osx.ok && /## Purpose\nSecond purpose paragraph UNIQUEMARKER2\./.test(osxReq) && /## Constraints\n- UNIQUEMARKER3/.test(osxReq) &&
      /US-1\.AC-1\*\* — WHEN a user submits a very long export form that spans several lines, THE SYSTEM SHALL ensure that the archive is produced/.test(osxReq) &&
      osx.warnings.some((x) => /carried over verbatim.*Purpose.*Constraints/.test(x)),
      "spec_import openspec: every Purpose paragraph and other ## sections are carried; a wrapped WHEN clause stays whole");

    // Review round: a flat tasks.md is imported in linear time (the parent lookup was quadratic).
    w6(im, ".kiro/specs/flat/requirements.md", "### Requirement 1\n\n#### Acceptance Criteria\n\n1. WHEN x happens THEN the system SHALL do y\n");
    w6(im, ".kiro/specs/flat/tasks.md", Array.from({ length: 20000 }, (_, i) => `- [ ] ${i + 1}. T\n  - _Requirements: 1.1_`).join("\n") + "\n");
    const t0flat = Date.now();
    const flat = safe6(() => S.importSpec(im, "kiro", ".kiro/specs/flat"));
    const flatMs = Date.now() - t0flat;
    ok(flat.ok && flat.mapping["task 20000"] === "task 20000" && flatMs < 6000, "spec_import: a flat 20 000-task tasks.md imports in linear time (" + flatMs + " ms; was ~11 s)");

    // Review round 2: a ## section WRAPPING requirements/stories carries only what is left around them (no second copy).
    w6(im, ".kiro/specs/wrapped-h2/requirements.md", ["# Requirements Document", "", "## Introduction", "", "Login stuff.", "", "## Functional Requirements", "", "Core flows (FRINTRO).", "",
      "### Requirement 1: Login", "", "#### Acceptance Criteria", "", "1. WHEN a user logs in THEN the system SHALL create a session", "",
      "## Non-Functional Requirements", "", "### Requirement 2: Speed", "", "#### Acceptance Criteria", "", "1. WHEN a page loads THEN the system SHALL respond within 200 ms", ""].join("\n"));
    const wh = safe6(() => S.importSpec(im, "kiro", ".kiro/specs/wrapped-h2"));
    const whReq = wh.ok ? r6(im, ".specs", "wrapped-h2", "requirements.md") : "";
    const whEars = safe6(() => S.earsFeature(im, "wrapped-h2"));
    ok(wh.ok && wh.mapping["1.1"] === "US-1.AC-1" && wh.mapping["2.1"] === "US-2.AC-1" && (whReq.match(/create a session/g) || []).length === 1 && (whReq.match(/within 200 ms/g) || []).length === 1 &&
      !/### Requirement \d/.test(whReq) && !/## Non-Functional Requirements/.test(whReq) && /## Functional Requirements\n\nCore flows \(FRINTRO\)\./.test(whReq) &&
      Array.isArray(whEars.issues) && whEars.issues.length === 0,
      "spec_import kiro: '### Requirement N' under a '## Functional/Non-Functional Requirements' is imported once (no verbatim copy, no no-id warnings); the wrapper's own prose is still carried");
    w6(im, "specs/004-board/spec.md", "# Feature Specification: Board\n\n## User Stories\n\n### User Story 1 - See board (Priority: P1)\n\nAs a user I want to see the board.\n\n**Acceptance Scenarios**:\n\n1. **Given** a board, **When** I open it, **Then** the system shows the columns\n");
    const skw = safe6(() => S.importSpec(im, "spec-kit", "specs/004-board"));
    const skwReq = skw.ok ? r6(im, ".specs", "board", "requirements.md") : "";
    ok(skw.ok && skw.mapping["User Story 1 / Scenario 1"] === "US-1.AC-1" && (skwReq.match(/^## User Stories$/gm) || []).length === 1 && !/### User Story 1 - See board/.test(skwReq) &&
      (skwReq.match(/As a user I want to see the board/g) || []).length === 1 && S.earsFeature(im, "board").verdict === "pass",
      "spec_import spec-kit: stories under a '## User Stories' wrapper are imported once (one ## User Stories heading, no raw copy)");

    // Review round 2: an unknown reference on a Kiro PARENT (now a phase heading, its number reused) is reported by line.
    w6(im, ".kiro/specs/parent-ref/requirements.md", "## Requirements\n\n### Requirement 1\n\n#### Acceptance Criteria\n\n1. WHEN a THEN the system SHALL b\n2. WHEN c THEN the system SHALL d\n3. WHEN e THEN the system SHALL f\n");
    w6(im, ".kiro/specs/parent-ref/tasks.md", "- [ ] 1. Set up\n  - _Requirements: 1.3_\n- [ ] 2. Implement login\n  - Parent notes\n  - _Requirements: 1.1, 9.9_\n  - [ ] 2.1 Form\n    - _Requirements: 1.1_\n  - [ ] 2.2 Session\n    - _Requirements: 1.2_\n- [ ] 3. Deploy _Requirements: 8.8_\n  - [ ] 3.1 Ship\n");
    const pr = safe6(() => S.importSpec(im, "kiro", ".kiro/specs/parent-ref"));
    const prTasks = pr.ok ? r6(im, ".specs", "parent-ref", "tasks.md") : "";
    ok(pr.ok && /## Implement login\n  - Parent notes\n  - _Requirements: US-1\.AC-1, 9\.9_\n- \[ \] 2\. Form/.test(prTasks) &&
      pr.warnings.some((x) => /^tasks\.md line 5: _Requirements:_ reference '9\.9'/.test(x)) && pr.warnings.some((x) => /^tasks\.md line 10: _Requirements:_ reference '8\.8'/.test(x)) &&
      !pr.warnings.some((x) => /^task \d+: .*'(?:9\.9|8\.8)'/.test(x)),
      "spec_import kiro: an unknown _Requirements:_ reference in a parent task's heading or own body is reported by source line, never as 'task <old number>' (got " + pr.warnings.join(" | ") + ")");

    // Review round 2: a Black-wrapped APIRouter(prefix=…)/Blueprint(url_prefix=…) and a Prettier-wrapped router.post(\n "/x", …).
    const sc3 = path.join(tmp, "proj-wp6-scan3");
    w6(sc3, "app/items.py", "from fastapi import APIRouter\n\nrouter = APIRouter(\n    prefix=\"/items\",\n    tags=[\"items\"],\n    dependencies=[Depends(get_token)],\n)\n\n\n@router.get(\"/{item_id}\")\ndef read(item_id: int): ...\n");
    w6(sc3, "app/bp.py", "from flask import Blueprint\nbp = Blueprint(\n    \"orders\",\n    __name__,\n    url_prefix=\"/orders\",\n)\n@bp.get(\"/<int:id>\")\ndef g(id): ...\n");
    w6(sc3, "app/users.py", "from fastapi import APIRouter\nrouter = APIRouter(prefix=\"/users\", tags=[\"users\"])\n@router.get(\"/{user_id}\")\ndef u(user_id): ...\n");
    w6(sc3, "src/routes/orders.js", "const express = require(\"express\");\nconst router = express.Router();\n\nrouter.post(\n  \"/orders/:orderId/items\",\n  requireAuth,\n  validateBody(itemSchema),\n  async (req, res) => {\n    router.get(\"/inner\", h);\n    res.json({});\n  }\n);\nrouter.get(\"/orders\", list);\nrouter.put(\n  handlerPath,\n  h\n);\n");
    w6(sc3, "src/services/api.js", "import axios from 'axios';\nconst api = axios.create();\nexport const list = () => api.get(\n  '/users'\n);\n");
    const scan3 = safe6(() => S.scanCodebase(sc3));
    const rk3 = (scan3.routes || []).map((r) => `${r.method} ${r.path} ${r.file}:${r.line}`);
    const want3 = ["GET /items/{item_id} app/items.py:10", "GET /orders/<int:id> app/bp.py:7", "GET /users/{user_id} app/users.py:3",
      "POST /orders/:orderId/items src/routes/orders.js:4", "GET /inner src/routes/orders.js:9", "GET /orders src/routes/orders.js:13"];
    ok(want3.every((k) => rk3.includes(k)) && scan3.candidateEndpoints === 6 && !rk3.some((k) => /\/users src\/services|\/item_id\} app\/items\.py|^GET \/<int:id>/.test(k)),
      "scan: a wrapped APIRouter(\\n prefix=…)/Blueprint(\\n url_prefix=…) prefixes its routes; a Prettier-wrapped router.post(\\n \"/x\", …) is a route on the call's line, counted once; a wrapped client call is not (got " + rk3.join(" | ") + ")");
  }
  // @wp WP6 <<<

  // @wp WP7 tests >>>
  // --- 1.13 WP7: spec_append_tasks (converge) — appended tasks work end to end, all-or-nothing, line-exact ---
  {
    const call7 = async (name, args) => { const r = await rpc("tools/call", { name, arguments: args }); return { isError: r.result.isError === true, p: payload(r) }; };
    const w7 = path.join(tmp, "proj-wp7");
    S.initProject(w7, ["tdd"]);
    const cf = S.createFeature(w7, "Converge", ["tdd"]);
    const cTasks = path.join(cf.dir, "tasks.md");
    fs.writeFileSync(path.join(cf.dir, "requirements.md"), "# Requirements\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a user saves THE SYSTEM SHALL store the draft\n" +
      "2. **US-1.AC-2** — WHEN the parser meets a BOM THE SYSTEM SHALL skip it\n3. **US-1.AC-3** — WHEN the writer runs THE SYSTEM SHALL keep CRLF endings\n");
    fs.writeFileSync(path.join(cf.dir, "test-plan.md"), "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n");
    const cOrig = "# Tasks: Converge\n\n## Global Constraints\n- Node >= 20\n\n## Story US-1 (P1 — MVP)\n- [x] 1. [US1] Core behavior\n  - _Requirements: US-1.AC-1_\n" +
      "- [x] 2. [US1] Second step\n  - _Requirements: US-1.AC-1_\n**Checkpoint:** US-1 works.\n";
    fs.writeFileSync(cTasks, cOrig);
    S.approvePhase(w7, "converge", "tasks", "tester", { force: true }); // template tasks: forced past the (WP5) approve gate
    const vCmd = 'node -e "process.exit(0)"';
    const ap = await call7("spec_append_tasks", { name: "converge", projectDir: w7, tasks: [
      { text: "Skip the BOM in the parser", requirements: ["US-1.AC-2"], implements: ["src\\parser.js"], verify: vCmd, story: "US1", parallel: true },
      { text: "Keep CRLF in the writer", requirements: ["us-1.ac-3"], implements: ["./src/writer.js"], story: "US1", parallel: true },
      { text: "[shared] Document the drift" },
    ] });
    const cNow = fs.readFileSync(cTasks, "utf8");
    const cSection = "\n## Phase: Convergence\n- [ ] 3. [US1][P] Skip the BOM in the parser\n  - _Requirements: US-1.AC-2_\n  - _Implements: src/parser.js_\n  - _Verify: " + vCmd + "_\n" +
      "- [ ] 4. [US1][P] Keep CRLF in the writer\n  - _Requirements: US-1.AC-3_\n  - _Implements: src/writer.js_\n- [ ] 5. [shared] Document the drift\n" +
      "**Checkpoint:** the convergence tasks are done and verified — the spec and the code agree again.\n";
    ok(!ap.isError && ap.p.ok && ap.p.headingCreated === true && ap.p.heading === "Phase: Convergence" && ap.p.appended.map((t) => t.number).join() === "3,4,5" && cNow === cOrig + cSection,
      "spec_append_tasks appends a new 'Phase: Convergence' (max+1 numbering, [USn][P] tags, English-stable markers, forward-slash paths, closing Checkpoint) — existing lines untouched");
    ok(ap.p.needsReapproval === true && /re-approve: \/approve converge tasks/.test(ap.p.note) && S.nextAction(w7, "converge").changedSinceApproval.includes("tasks.md"),
      "appending after a tasks approval → needsReapproval + note, and next_action lists tasks.md as changed since approval");
    const apSt = (await call7("spec_status", { name: "converge", projectDir: w7 })).p;
    ok(apSt.tasks.total === 5 && apSt.tasks.next.number === 3 && apSt.tasks.list.filter((t) => t.parallel).map((t) => t.number).join() === "3,4" && apSt.tasks.list.find((t) => t.number === 5).story === "shared",
      "spec_status counts the appended tasks (next = #3, [P] and story read back)");
    const apNx = (await call7("spec_next_task", { name: "converge", batch: true, projectDir: w7 })).p;
    ok(apNx.next.number === 3 && JSON.stringify(apNx.batch.map((b) => [b.number, b.implements])) === JSON.stringify([[3, ["src/parser.js"]], [4, ["src/writer.js"]]]),
      "spec_next_task batch pairs the appended [P] tasks by their disjoint _Implements:_ files (the non-[P] #5 ends it)");
    const apBr = (await call7("spec_task_brief", { name: "converge", number: 3, projectDir: w7 })).p;
    ok(apBr.acceptanceCriteria.length === 1 && apBr.acceptanceCriteria[0].id === "US-1.AC-2" && /meets a BOM THE SYSTEM SHALL skip it/.test(apBr.acceptanceCriteria[0].text) &&
      apBr.verify.join() === vCmd && apBr.unresolved.acs.length === 0 && apBr.task.phase === "Phase: Convergence" && /spec and the code agree again/.test(apBr.task.checkpoint) &&
      apBr.brief.includes("- `" + vCmd + "`"), "spec_task_brief on an appended task resolves its AC to the EARS text and carries its _Verify:_ command + checkpoint");
    const apNoEv = (await call7("spec_complete_task", { name: "converge", number: 3, projectDir: w7 })).p;
    const apEv = (await call7("spec_complete_task", { name: "converge", number: 3, evidence: { command: vCmd, exitCode: 0, summary: "ok" }, projectDir: w7 })).p;
    const apEv4 = (await call7("spec_complete_task", { name: "converge", number: 4, evidence: { summary: "writer keeps CRLF (checked by hand)" }, projectDir: w7 })).p;
    const apEv5 = (await call7("spec_complete_task", { name: "converge", number: 5, projectDir: w7 })).p;
    ok(apNoEv.ok && apNoEv.verified === false && apEv.ok && apEv.alreadyDone && apEv.verified === true && apEv4.verified === true && apEv5.ok && apEv5.done === 5 && apEv5.next === null,
      "spec_complete_task on appended tasks: the runnable _Verify:_ needs its passing run (back-filled), a manual one takes a note");
    const apFin = (await call7("spec_finish", { name: "converge", projectDir: w7 })).p;
    ok(apFin.ok && apFin.openTasks.length === 0 && apFin.unverified.length === 0 && apFin.mergeSummary.includes("- [x] 3. Skip the BOM in the parser — `" + vCmd + "` → exit 0 · ok") &&
      apFin.mergeSummary.includes("- [x] 5. Document the drift"), "spec_finish lists the appended tasks with their evidence (none open, none unverified)");
    ok(S.traceCheck(w7, "converge").phantomAcsInTasks.length === 0, "appended _Requirements:_ never introduce a phantom AC in trace_check");

    // Reuse: the default heading again → the same phase, before its closing checkpoint; a custom existing heading too.
    const beforeReuse = fs.readFileSync(cTasks, "utf8");
    const ap2 = S.appendTasks(w7, "converge", [{ text: "Follow-up" }]);
    const ap3 = S.appendTasks(w7, "converge", [{ text: "Story fix", requirements: ["US-1.AC-1"] }], { heading: "## Story US-1 (P1 — MVP)" });
    const reuseTxt = fs.readFileSync(cTasks, "utf8");
    const reuseBlocks = S.taskBlocks(reuseTxt);
    ok(ap2.ok && ap2.headingCreated === false && ap2.appended[0].number === 6 && reuseTxt.includes("- [x] 5. [shared] Document the drift\n- [ ] 6. Follow-up\n**Checkpoint:** the convergence") &&
      reuseTxt.split("## Phase: Convergence").length === 2, "an existing 'Phase: Convergence' is reused: the task goes at the end of that phase, before its closing checkpoint");
    ok(ap3.ok && ap3.heading === "Story US-1 (P1 — MVP)" && reuseTxt.includes("  - _Requirements: US-1.AC-1_\n- [ ] 7. Story fix\n  - _Requirements: US-1.AC-1_\n**Checkpoint:** US-1 works.") &&
      reuseBlocks.find((b) => b.number === 7).checkpoint === "US-1 works." && reuseBlocks.filter((b) => b.number < 6).every((b) => b.done) &&
      reuseTxt.replace("- [ ] 6. Follow-up\n", "").replace("- [ ] 7. Story fix\n  - _Requirements: US-1.AC-1_\n", "") === beforeReuse,
      "heading → an existing phase gets the task before ITS checkpoint; nothing else in tasks.md changed");

    // All-or-nothing validation: a phantom AC (with a valid task beside it), bad paths/story/verify/heading write nothing.
    const frozen = fs.readFileSync(cTasks, "utf8");
    const ph = await call7("spec_append_tasks", { name: "converge", projectDir: w7, tasks: [{ text: "ok one", requirements: ["US-1.AC-1"] }, { text: "bad", requirements: ["US-1.AC-9", "US-7.AC-1"] }] });
    ok(ph.isError && ph.p.ok === false && /US-1\.AC-9, US-7\.AC-1/.test(ph.p.error) && /Nothing was written/.test(ph.p.error) && ph.p.phantom.join() === "US-1.AC-9,US-7.AC-1" &&
      fs.readFileSync(cTasks, "utf8") === frozen, "phantom AC IDs → localized error listing them (isError) and NOTHING is written, not even the valid task");
    const bads = [
      [{ text: "x", implements: ["../outside.js"] }], [{ text: "x", implements: ["/etc/passwd"] }], [{ text: "x", implements: ["C:\\repo\\a.js"] }],
      [{ text: "x", story: "P1" }], [{ text: "x", verify: "npm test\nrm -rf /" }], [{ text: "x", verify: "pytest -k 'a_ b'" }], [{ text: "   " }], [{ text: "[US1][P]" }], [],
    ].map((t) => S.appendTasks(w7, "converge", t));
    const badHeads = [S.appendTasks(w7, "converge", [{ text: "x" }], { heading: "Global Constraints" }), S.appendTasks(w7, "converge", [{ text: "x" }], { heading: "a\nb" })];
    ok(bads.concat(badHeads).every((r) => r.ok === false && r.error) && /relative to the project root, without '\.\.'/.test(bads[0].error) && /relative/.test(bads[1].error) && /relative/.test(bads[2].error) &&
      /US<n>/.test(bads[3].error) && /single-line/.test(bads[4].error) && /would not read back/.test(bads[5].error) && /text is required/.test(bads[6].error) && /text is required/.test(bads[7].error) &&
      /at least one task/.test(bads[8].error) && /constraints/.test(badHeads[0].error) && /one line/.test(badHeads[1].error) && fs.readFileSync(cTasks, "utf8") === frozen,
      "bad paths (.., absolute, drive), story, multi-line/unstorable _Verify:_, empty text, no tasks, a non-phase heading: localized errors, nothing written");
    const hid = S.appendTasks(w7, "converge", [{ text: "fix <!-- hidden --> parser" }]);
    ok(hid.ok === false && /task 8 would not read back as written/.test(hid.error) && fs.readFileSync(cTasks, "utf8") === frozen,
      "a task that would not read back as written (an inline comment hides part of it) is refused — the read-back check writes nothing");
    const noTasksArg = await rpc("tools/call", { name: "spec_append_tasks", arguments: { name: "converge", projectDir: w7 } });
    const badItem = await rpc("tools/call", { name: "spec_append_tasks", arguments: { name: "converge", projectDir: w7, tasks: [{ text: 123 }] } });
    const apTool = list.result.tools.find((t) => t.name === "spec_append_tasks");
    ok(apTool && apTool.inputSchema.required.join() === "name,tasks" && apTool.inputSchema.properties.tasks.items.required.join() === "text" &&
      noTasksArg.result.isError && /Missing required argument\(s\): tasks/.test(payload(noTasksArg).error) && badItem.result.isError && /tasks\[0\]\.text must be a string/.test(payload(badItem).error),
      "spec_append_tasks is advertised (name + tasks required, items need text) and its arguments are schema-checked");

    // Line endings: CRLF + BOM kept exactly; a CRLF file without a final newline keeps having none.
    const crF = S.createFeature(w7, "Crlf", ["core"]);
    const crTasks = path.join(crF.dir, "tasks.md");
    const BOM7 = String.fromCharCode(0xfeff);
    const crOrig = BOM7 + "# Tasks: Crlf\r\n\r\n## Phase: Setup\r\n- [ ] 1. [shared] Set up\r\n**Checkpoint:** ready.\r\n";
    fs.writeFileSync(crTasks, crOrig);
    const crR = S.appendTasks(w7, "crlf", [{ text: "Converge the setup", implements: ["src/setup.js"] }]);
    const crNow = fs.readFileSync(crTasks, "utf8");
    ok(crR.ok && crNow.startsWith(crOrig) && crNow.startsWith(BOM7) && crNow.split(BOM7).length === 2 && !/[^\r]\n/.test(crNow) &&
      crNow.endsWith("\r\n\r\n## Phase: Convergence\r\n- [ ] 2. Converge the setup\r\n  - _Implements: src/setup.js_\r\n**Checkpoint:** the convergence tasks are done and verified — the spec and the code agree again.\r\n") &&
      S.completeTask(w7, "crlf", 2).ok && /- \[x\] 2\. Converge the setup\r\n/.test(fs.readFileSync(crTasks, "utf8")),
      "a CRLF tasks.md with a BOM: every existing byte kept, new lines CRLF, BOM still first — and the appended task can be ticked");
    fs.writeFileSync(crTasks, "# Tasks: Crlf\r\n\r\n## Phase: Convergence\r\n- [ ] 1. a\r\n- [x] 2. b");
    const crR2 = S.appendTasks(w7, "crlf", [{ text: "c" }]);
    ok(crR2.ok && crR2.headingCreated === false && fs.readFileSync(crTasks, "utf8") === "# Tasks: Crlf\r\n\r\n## Phase: Convergence\r\n- [ ] 1. a\r\n- [x] 2. b\r\n- [ ] 3. c",
      "a CRLF tasks.md with no final newline: the last line is ended with CRLF and the file still has no final newline");
    fs.writeFileSync(crTasks, BOM7);
    const crR3 = S.appendTasks(w7, "crlf", [{ text: "first" }]);
    ok(crR3.ok && fs.readFileSync(crTasks, "utf8").startsWith(BOM7 + "\n## Phase: Convergence\n- [ ] 1. first\n") && S.taskBlocks(fs.readFileSync(crTasks, "utf8"))[0].phase === "Phase: Convergence",
      "a BOM-only tasks.md: the new heading starts one line down (a BOM'd first line is not read as a heading)");

    // PT feature: localized default heading, checkpoint and errors; markers stay English-stable.
    const ptF = S.createFeature(w7, "Convergência", ["core"], undefined, undefined, "pt");
    S.approvePhase(w7, "convergencia", "tasks", "tester", { force: true });
    const ptR = await call7("spec_append_tasks", { name: "Convergência", projectDir: w7, tasks: [{ text: "Corrigir o desvio", requirements: ["US-1.AC-2"], verify: "npm test", story: "US1" }] });
    const ptTxt = fs.readFileSync(path.join(ptF.dir, "tasks.md"), "utf8");
    const ptPh = S.appendTasks(w7, "convergencia", [{ text: "x", requirements: ["US-3.AC-3"] }]);
    ok(ptR.p.ok && ptR.p.heading === "Fase: Convergência" && /\n## Fase: Convergência\n- \[ \] \d+\. \[US1\] Corrigir o desvio\n  - _Requirements: US-1\.AC-2_\n  - _Verify: npm test_\n\*\*Checkpoint:\*\* as tarefas de convergência estão concluídas/.test(ptTxt) &&
      /Critérios de aceitação desconhecidos \(não estão em requirements\.md\): US-3\.AC-3\. Nada foi escrito/.test(ptPh.error) && S.statusFeature(w7, "convergencia").tasks.list.some((t) => t.text === "[US1] Corrigir o desvio") &&
      ptR.p.needsReapproval === true && /revê as novas tarefas e volta a aprovar: \/approve convergencia tasks/.test(ptR.p.note),
      "PT feature: 'Fase: Convergência' + PT checkpoint, English-stable markers, PT phantom error and re-approval note; status counts the task");
    const esF = S.createFeature(w7, "Convergencia ES", ["core"], undefined, undefined, "es");
    const esR = S.appendTasks(w7, "convergencia-es", [{ text: "Corregir la desviación", story: "US-2" }]);
    ok(esR.ok && esR.heading === "Fase: Convergencia" && /\n## Fase: Convergencia\n- \[ \] \d+\. \[US2\] Corregir la desviación\n\*\*Checkpoint:\*\* las tareas de convergencia/.test(fs.readFileSync(path.join(esF.dir, "tasks.md"), "utf8")) &&
      /Tarea 1: story debe ser US<n>/.test(S.appendTasks(w7, "convergencia-es", [{ text: "x", story: "historia" }]).error), "ES feature: 'Fase: Convergencia' + ES checkpoint and errors ('US-2' → [US2])");

    // Removed track: its trailing task section stays after the new phase, and its heading is refused.
    const rtF = S.createFeature(w7, "Tracked", ["core"]);
    const rtTasks = path.join(rtF.dir, "tasks.md");
    S.addTrack(w7, "tracked", "ai");
    S.addTrack(w7, "tracked", "ai", { remove: true });
    const rtBefore = fs.readFileSync(rtTasks, "utf8");
    const rtMax = Math.max(...S.parseTasks(rtBefore).map((t) => t.number));
    const rtR = S.appendTasks(w7, "tracked", [{ text: "Converge without AI" }]);
    const rtTxt = fs.readFileSync(rtTasks, "utf8");
    const rtNew = rtTxt.indexOf("## Phase: Convergence"), rtAi = rtTxt.indexOf("## Story US-1 — AI");
    const rtSt = S.statusFeature(w7, "tracked");
    const rtHead = S.appendTasks(w7, "tracked", [{ text: "x" }], { heading: "Story US-1 — AI" });
    ok(rtR.ok && rtR.appended[0].number === rtMax + 1 && rtNew > 0 && rtAi > rtNew && rtSt.tasks.list.some((t) => t.number === rtMax + 1) &&
      rtTxt.replace(/\n## Phase: Convergence\n- \[ \] \d+\. Converge without AI\n\*\*Checkpoint:\*\* [^\n]*\n\n/, "\n") === rtBefore &&
      rtHead.ok === false && /inactive \+ai track/.test(rtHead.error) && fs.readFileSync(rtTasks, "utf8") === rtTxt,
      "after add_track --remove ai the new phase goes after the last ACTIVE phase (before the inactive AI section), counts in status; the AI heading is refused");

    // A removed task's leftover evidence is never inherited: the new task is numbered past it.
    const evF = S.createFeature(w7, "Leftover", ["core"]);
    fs.writeFileSync(path.join(evF.dir, "tasks.md"), "# Tasks\n\n## Phase: Build\n- [x] 1. a\n");
    const evState = JSON.parse(fs.readFileSync(path.join(evF.dir, ".state.json"), "utf8"));
    evState.evidence = { "2": { command: "npm test", exitCode: 0, at: "2026-01-01T00:00:00Z", task: "old task", verify: "npm test" } };
    fs.writeFileSync(path.join(evF.dir, ".state.json"), JSON.stringify(evState));
    const evR = S.appendTasks(w7, "leftover", [{ text: "new work", verify: "npm test" }]);
    ok(evR.ok && evR.appended[0].number === 3 && S.statusFeature(w7, "leftover").tasks.list.find((t) => t.number === 3).verified === false,
      "a number that still has a removed task's evidence is skipped (the new task never inherits that run)");
  }
  // --- 1.13 WP7 review fixes: closing checkpoint as a reader sees it, verify/paths/heading read back as given ---
  {
    const w7r = path.join(tmp, "proj-wp7-review");
    S.initProject(w7r, ["core"]);
    const mk7 = (name, body, lang) => { const f = S.createFeature(w7r, name, ["core"], undefined, undefined, lang); const p = path.join(f.dir, "tasks.md"); fs.writeFileSync(p, body); return p; };
    // A comment, a '---' or a note after a reused phase's checkpoint: the task still goes BEFORE it (same section,
    // so next --batch pairs it with #1), and the trailer stays where it was.
    const trailers = ["<!-- guidance: keep this phase small -->\n", "\n---\n", "Note: ship it after QA.\n"];
    const cpRes = trailers.map((tr, k) => {
      const file = mk7("Cp " + k, "# Tasks: f\n\n## Phase: Build\n- [ ] 1. [P] a\n  - _Implements: src/a.js_\n**Checkpoint:** build works.\n" + tr + "\n## Phase: Polish\n- [ ] 2. b\n");
      const r = S.appendTasks(w7r, "cp-" + k, [{ text: "c", parallel: true, implements: ["src/c.js"] }], { heading: "Phase: Build" });
      const txt = fs.readFileSync(file, "utf8");
      const b3 = S.taskBlocks(txt).find((b) => b.number === 3);
      return r.ok && txt.includes("  - _Implements: src/a.js_\n- [ ] 3. [P] c\n  - _Implements: src/c.js_\n**Checkpoint:** build works.\n" + tr) && b3 && b3.checkpoint === "build works." &&
        S.nextTask(w7r, "cp-" + k, { batch: true }).batch.map((b) => b.number).join() === "1,3";
    });
    ok(cpRes.every(Boolean), "reused phase: a comment / '---' / note after its checkpoint doesn't move it — the task goes before it, keeps that checkpoint and batches with #1");
    // The tool's own default phase, reused after the user added '---' below it (CRLF file): still before the checkpoint.
    const dfFile = mk7("Cp default", "# Tasks\r\n\r\n## Phase: Convergence\r\n- [ ] 1. a\r\n**Checkpoint:** converged.\r\n\r\n---\r\n");
    const dfR = S.appendTasks(w7r, "cp-default", [{ text: "b" }]);
    ok(dfR.ok && dfR.headingCreated === false && fs.readFileSync(dfFile, "utf8") === "# Tasks\r\n\r\n## Phase: Convergence\r\n- [ ] 1. a\r\n- [ ] 2. b\r\n**Checkpoint:** converged.\r\n\r\n---\r\n",
      "the default 'Phase: Convergence' reused after a '---' was added below it (CRLF): the task lands before its checkpoint, CRLF kept");
    // No checkpoint: trailing '---' / own-line comments stay after the new task; a multi-line comment's tail is never entered.
    const ncFile = mk7("No cp", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n\n---\n<!-- keep small -->\n\n## Phase: Ship\n- [ ] 2. b\n");
    const ncR = S.appendTasks(w7r, "no-cp", [{ text: "c" }], { heading: "Phase: Build" });
    const mlFile = mk7("Multi", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n<!-- guidance\n  more -->\n");
    const mlR = S.appendTasks(w7r, "multi", [{ text: "c" }], { heading: "Phase: Build" });
    ok(ncR.ok && fs.readFileSync(ncFile, "utf8").includes("- [ ] 1. a\n- [ ] 3. c\n\n---\n<!-- keep small -->\n") && S.taskBlocks(fs.readFileSync(ncFile, "utf8")).find((b) => b.number === 3).checkpoint === null &&
      mlR.ok && fs.readFileSync(mlFile, "utf8") === "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n<!-- guidance\n  more -->\n- [ ] 2. c\n",
      "a phase without a checkpoint: trailing '---' and own-line comments stay after the new task; a multi-line comment is never split");

    // _Verify:_ is stored so it reads back — and runs — exactly as given: one code span around the whole command is
    // unwrapped, a command that starts/ends with a backtick is stored inside a longer span, a [placeholder] is refused.
    const tkFile = mk7("Ticks", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n");
    const tk = S.appendTasks(w7r, "ticks", [{ text: "subst", verify: "test -n `echo ok`" }, { text: "wrapped", verify: "`npm test`" }, { text: "ends", verify: "`true` && echo `date`" }]);
    const tkTxt = fs.readFileSync(tkFile, "utf8");
    ok(tk.ok && JSON.stringify(tk.appended.map((t) => t.verify)) === JSON.stringify(["test -n `echo ok`", "npm test", "`true` && echo `date`"]) &&
      tkTxt.includes("  - _Verify: `` test -n `echo ok` ``_\n") && tkTxt.includes("  - _Verify: npm test_\n") && tkTxt.includes("  - _Verify: `` `true` && echo `date` ``_\n") &&
      S.taskBrief(w7r, "ticks", 2).verify.join() === "test -n `echo ok`" && S.taskBrief(w7r, "ticks", 4).verify.join() === "`true` && echo `date`",
      "a _Verify:_ starting/ending with a backtick (command substitution) reads back as given via task_brief; `npm test` still unwraps");
    const tkFrozen = fs.readFileSync(tkFile, "utf8");
    const phV = S.appendTasks(w7r, "ticks", [{ text: "p", verify: "[run tests]" }]);
    const phV2 = S.appendTasks(w7r, "ticks", [{ text: "p", verify: "`[ -f dist/app.js ]`" }]);
    mk7("Marcador", "# Tarefas\n\n## Fase 1\n- [ ] 1. a\n", "pt");
    const phVpt = S.appendTasks(w7r, "marcador", [{ text: "p", verify: "[correr testes]" }]);
    ok(!phV.ok && /'\[run tests\]' reads as a placeholder/.test(phV.error) && !phV2.ok && /'\[ -f dist\/app\.js \]' reads as a placeholder/.test(phV2.error) &&
      !phVpt.ok && /lê-se como um marcador de posição/.test(phVpt.error) && fs.readFileSync(tkFile, "utf8") === tkFrozen,
      "a [bracketed] _Verify:_ (ignored by every reader, so the evidence gate would never apply) is refused, localized — nothing written");
    // _Implements:_ is project-relative only: URI schemes and home paths in any form are refused; a tilde inside a path is fine.
    const badP = ["file:///etc/passwd", "~user/x.js", "~", "https://example.com/a.js"].map((p) => S.appendTasks(w7r, "ticks", [{ text: "t", implements: [p] }]));
    const tildeIn = S.appendTasks(w7r, "ticks", [{ text: "t", implements: ["src/~tmp/x.js"] }]);
    ok(badP.every((r) => r.ok === false && /relative to the project root/.test(r.error)) && tildeIn.ok && tildeIn.appended[0].implements.join() === "src/~tmp/x.js",
      "_Implements:_ refuses file:// / https:// and ~user / ~ paths; a '~' inside a relative path is kept");
    // Any heading globalConstraints() would read as the constraints section is refused (EN/PT/ES substrings).
    const gcFile = mk7("Gc", "# Tasks: gc\n\n## Phase 1\n- [ ] 1. Build the thing\n");
    const gcR = ["Global constraints follow-up", "Restrições globais — revisão", "Revisar restricciones globales"].map((h) => S.appendTasks(w7r, "gc", [{ text: "Bump Node floor" }], { heading: h }));
    ok(gcR.every((r) => r.ok === false && /holds the constraints every task respects/.test(r.error)) && fs.readFileSync(gcFile, "utf8") === "# Tasks: gc\n\n## Phase 1\n- [ ] 1. Build the thing\n" &&
      !/Bump Node floor/.test(S.taskBrief(w7r, "gc", 1).brief), "a heading containing 'Global constraints' (EN/PT/ES) is refused — appended tasks never become brief constraints");
  }
  // --- 1.13 WP7 review round 2: a no-checkpoint phase's trailers never cut into the last task or a comment ---
  {
    const w7s = path.join(tmp, "proj-wp7-r2");
    S.initProject(w7s, ["core"]);
    // Appends one task to a fresh feature → [result, tasks.md after]; the last task's body must read back unchanged.
    const r2 = (name, body, opts) => {
      const f = S.createFeature(w7s, name, ["core"]);
      const p = path.join(f.dir, "tasks.md");
      fs.writeFileSync(p, body);
      const lastBody = JSON.stringify(S.taskBlocks(body).slice(-1)[0].body);
      const r = S.appendTasks(w7s, S.slugify(name), [{ text: "new" }], opts);
      const txt = fs.readFileSync(p, "utf8");
      const kept = JSON.stringify(S.taskBlocks(txt).find((b) => b.number === S.taskBlocks(body).slice(-1)[0].number).body) === lastBody;
      return { r, txt, kept };
    };
    // A rule right under the last task line / sub-line (or an indented one after a blank, or after its fenced body)
    // is that task's lazy-continuation body: the new task goes after it (round-2 placed it before → refused as unsafe).
    const bodyRules = [
      ["Rule task", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n---\n\n## Phase: Ship\n- [ ] 2. b\n", { heading: "Phase: Build" }, "- [ ] 1. a\n---\n- [ ] 3. new\n\n## Phase: Ship\n"],
      ["Rule sub", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n  - _Implements: src/a.js_\n---\n\n## Phase: Ship\n- [ ] 2. b\n", { heading: "Phase: Build" }, "  - _Implements: src/a.js_\n---\n- [ ] 3. new\n\n## Phase: Ship\n"],
      ["Rule default", "# Tasks\n\n## Phase: Convergence\n- [ ] 1. a\n***\n", undefined, "## Phase: Convergence\n- [ ] 1. a\n***\n- [ ] 2. new\n"],
      ["Rule indented", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n\n  ---\n", { heading: "Phase: Build" }, "- [ ] 1. a\n\n  ---\n- [ ] 2. new\n"],
      ["Rule fence", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n  ```\n  code\n  ```\n---\n", { heading: "Phase: Build" }, "  ```\n  code\n  ```\n---\n- [ ] 2. new\n"],
    ].map(([name, body, opts, want]) => { const x = r2(name, body, opts); return x.r.ok && x.r.headingCreated === false && x.txt.includes(want) && x.kept; });
    ok(bodyRules.every(Boolean), "no checkpoint: a '---'/'***' directly under the last task or its sub-line (also indented after a blank, or after a fenced body — incl. the default 'Phase: Convergence') stays its body; the task goes after it");
    // A line starting with "<!--" inside an open multi-line comment is that comment's tail, not an own-line trailer.
    const tail = r2("Tail", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n<!-- draft:\n  maybe split this\n\n<!-- see notes -->\n", { heading: "Phase: Build" });
    const tail2 = r2("Tail two", "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n<!-- a\n<!-- b -->\n\n---\n", { heading: "Phase: Build" });
    ok(tail.r.ok && tail.txt === "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n<!-- draft:\n  maybe split this\n\n<!-- see notes -->\n- [ ] 2. new\n" &&
      tail2.r.ok && tail2.txt === "# Tasks\n\n## Phase: Build\n- [ ] 1. a\n<!-- a\n<!-- b -->\n- [ ] 2. new\n\n---\n",
      "no checkpoint: a '<!-- … -->' line that closes an earlier multi-line comment is its tail — the task goes after it, never inside the comment; a later '---' still trails");
  }
  // @wp WP7 <<<

  // @wp WP8 tests >>>
  // --- 1.13 WP8: change requests (approval history + snapshots, spec_impact, reopen) + metrics & retro ---
  {
    const call8 = async (name, args) => { const r = await rpc("tools/call", { name, arguments: args }); return { isError: r.result.isError === true, p: payload(r) }; };
    const w8 = path.join(tmp, "proj-wp8");
    S.initProject(w8, ["tdd"]);
    const cr8 = S.createFeature(w8, "Drafts", ["tdd"]);
    const f8 = (x) => path.join(cr8.dir, x);
    const st8 = () => JSON.parse(fs.readFileSync(f8(".state.json"), "utf8"));
    ok(typeof st8().createdAt === "string" && /^\d{4}-\d\d-\d\dT/.test(st8().createdAt) && Math.abs(Date.now() - Date.parse(st8().createdAt)) < 600000,
      "createFeature stores createdAt (ISO) in the new .state.json");
    ok(["spec_impact", "spec_metrics"].every((t) => list.result.tools.some((x) => x.name === t)), "tools/list advertises spec_impact and spec_metrics");

    // Fixture — CRLF requirements and tasks (Windows editors), a test plan and a design that cite the ACs.
    const reqA = ["# Feature: Drafts", "", "## Summary", "Save drafts.", "", "### US-1 (P1 — MVP): Save drafts", "", "#### Acceptance Criteria (EARS)",
      "1. **US-1.AC-1** — WHEN a user saves THE SYSTEM SHALL store the draft", "2. **US-1.AC-2** — WHEN the parser meets a BOM THE SYSTEM SHALL skip it",
      "3. **US-1.AC-3** — WHEN the writer runs THE SYSTEM SHALL keep CRLF endings", "", "## Success Criteria", "- **SC-001** — 95% of saves finish under 200 ms", "",
      "## Edge Cases & Error Handling", "- **EC-1** — an empty draft is rejected with a message", ""].join("\r\n");
    const designA = "# Design: Drafts\n\n## Data Model\nDrafts keyed by id (US-1.AC-1).\n\n## Parser\nSkips a BOM (US-1.AC-2, T-02).\n\n## Writer\nKeeps line endings (US-1.AC-3).\n";
    const tasksA = ["# Tasks: Drafts", "", "## Story US-1 (P1 — MVP)", "- [x] 1. [US1] Store drafts", "  - _Requirements: US-1.AC-1_", '  - _Verify: node -e "process.exit(0)"_',
      "- [x] 2. [US1] Skip the BOM", "  - _Requirements: US-1.AC-2, SC-001_", "  - _Makes green: T-02_", "- [x] 3. [US1] Keep CRLF", "  - _Requirements: US-1.AC-3_",
      "- [ ] 4. [US1] Reject empty drafts", "  - _Requirements: EC-1_", "**Checkpoint:** drafts work.", ""].join("\r\n");
    fs.writeFileSync(f8("requirements.md"), reqA);
    fs.writeFileSync(f8("design.md"), designA);
    fs.writeFileSync(f8("test-plan.md"), "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-2 |\n| T-03 | US-1.AC-3 |\n");
    fs.writeFileSync(f8("tasks.md"), tasksA);
    S.completeTask(w8, "drafts", 1, { command: 'node -e "process.exit(0)"', exitCode: 0, summary: "ok" });
    S.completeTask(w8, "drafts", 2, { summary: "BOM skipped (checked by hand)" });

    // 1. Approval history + snapshots.
    const ap8 = await call8("spec_approve", { name: "drafts", phase: "requirements", force: true, projectDir: w8 });
    const h8 = st8().approvalHistory, a8 = st8().approvals.requirements;
    ok(!ap8.isError && ap8.p.snapshot === ".history/requirements@1.md" && h8.length === 1 && h8[0].phase === "requirements" && h8[0].at === a8.at && h8[0].by === a8.by &&
      h8[0].fingerprint === a8.fingerprint && h8[0].snapshot === ".history/requirements@1.md" && !("snapshot" in a8) &&
      fs.readFileSync(f8(".history/requirements@1.md"), "utf8") === reqA && !fs.existsSync(f8(".history/.gitignore")),
      "spec_approve keeps approvals[phase] and appends approvalHistory {phase, at, by, fingerprint, snapshot}; the snapshot is the file verbatim (CRLF kept), not self-ignored");
    const apD8 = S.approvePhase(w8, "drafts", "design", "rev", { force: true });
    const hD8 = st8().approvalHistory[1];
    ok(apD8.forced === true && hD8.phase === "design" && hD8.forced === true && hD8.failing.includes("constitution-check") && hD8.snapshot === ".history/design@1.md",
      "a forced approval is recorded in the history too (forced + failing ids), with its snapshot");
    S.approvePhase(w8, "drafts", "tasks", "rev", { force: true });
    const snapT8 = fs.readFileSync(f8(".history/tasks@1.md"), "utf8");
    ok(snapT8 === tasksA.replace(/- \[x\]/g, "- [ ]") && snapT8.includes("\r\n"), "the tasks snapshot stores tasks.md with its checkboxes normalized (like the fingerprint), CRLF kept");
    S.approvePhase(w8, "drafts", "tests", "rev", { force: true });
    const hT8 = st8().approvalHistory[3];
    ok(hT8.phase === "tests" && hT8.snapshot === undefined && hT8.fingerprint === undefined && !fs.readdirSync(f8(".history")).some((x) => x.startsWith("tests")),
      "a phase with no artifact (tests) is recorded in the history without a snapshot");
    const im0 = (await call8("spec_impact", { name: "drafts", projectDir: w8 })).p;
    ok(im0.ok && im0.baseline === "snapshot" && im0.changed === false && im0.added.length + im0.modified.length + im0.removed.length === 0 &&
      !S.specDoctor(w8, "drafts").checks.some((c) => c.id === "changed-since-approval"), "right after the approval: spec_impact finds no change and doctor has no changed-since-approval check");

    // 2. spec_impact on requirements: whitespace-only reflow of AC-1 (not a change), AC-2 + SC-001 modified, AC-3 → AC-4.
    const reqB = reqA.replace("1. **US-1.AC-1** — WHEN a user saves THE SYSTEM SHALL store the draft", "1. **US-1.AC-1** — WHEN a user saves\r\n   THE SYSTEM SHALL   store the draft")
      .replace("SHALL skip it", "SHALL strip it and log a warning").replace("3. **US-1.AC-3** — WHEN the writer runs THE SYSTEM SHALL keep CRLF endings", "3. **US-1.AC-4** — WHEN a draft is older than 30 days THE SYSTEM SHALL archive it")
      .replace("under 200 ms", "under 150 ms");
    fs.writeFileSync(f8("requirements.md"), reqB);
    const im1 = (await call8("spec_impact", { name: "drafts", phase: "requirements", projectDir: w8 })).p;
    const imp8 = (id) => im1.impacted.find((x) => x.id === id) || { tasks: [], tests: [], designSections: [] };
    ok(im1.changed === true && im1.added.map((a) => a.id).join() === "US-1.AC-4" && im1.added[0].tasks.length === 0 && im1.modified.map((m) => m.id).join() === "US-1.AC-2,SC-001" &&
      /skip it$/.test(im1.modified[0].before) && /strip it and log a warning$/.test(im1.modified[0].after) && im1.removed.map((r) => r.id).join() === "US-1.AC-3",
      "requirements diff by stable ID: added / modified (a whitespace-only reflow is NOT a change) / removed — SC-/EC-/NFR- IDs too");
    ok(imp8("US-1.AC-2").tasks.map((t) => [t.number, t.done, t.evidence].join(":")).join() === "2:true:verified" && imp8("US-1.AC-2").tests.map((t) => t.id).join() === "T-02" &&
      imp8("US-1.AC-2").designSections.join() === "Parser" && imp8("US-1.AC-3").tasks.map((t) => [t.number, t.evidence].join(":")).join() === "3:no-evidence" &&
      imp8("US-1.AC-3").tests.map((t) => t.id).join() === "T-03" && imp8("US-1.AC-3").designSections.join() === "Writer" && imp8("SC-001").tasks.map((t) => t.number).join() === "2" &&
      im1.affectedTasks.map((t) => t.number + ":" + t.via.join("+")).join() === "2:US-1.AC-2+SC-001,3:US-1.AC-3" && /--reopen/.test(im1.hint),
      "each modified/removed ID lists the tasks citing it (done + evidence state), its T-IDs and design sections; affectedTasks names each task once (+ a reopen hint)");
    const imL8 = S.impactLines(im1).join("\n");
    ok(/^Impact: drafts · requirements — against the approval of \d{4}-\d\d-\d\d \(\.history\/requirements@1\.md\)/.test(imL8) && imL8.includes("  ~ US-1.AC-2  WHEN the parser meets a BOM THE SYSTEM SHALL strip it") &&
      imL8.includes("  - US-1.AC-3  WHEN the writer runs") && imL8.includes("US-1.AC-2 (modified) — tasks: #2 [x] verified · tests: T-02 · design: Parser") && /new, no task cites them yet: US-1\.AC-4/.test(imL8),
      "impactLines: the diff, what each change reaches, the uncovered new AC");

    // 3. next_action + doctor name spec_impact.
    const na8 = S.nextAction(w8, "drafts");
    const dc8 = S.specDoctor(w8, "drafts").checks.find((c) => c.id === "changed-since-approval");
    ok(na8.step === "re-review" && /Re-review: requirements\.md changed/.test(na8.recommendation) && /spec_impact \(dev-spec impact drafts --phase requirements\)/.test(na8.recommendation) &&
      na8.impact && na8.impact.tool === "spec_impact" && na8.impact.phases.join() === "requirements" && dc8 && dc8.status === "warn" && /^changed after their approval: requirements\.md/.test(dc8.detail) &&
      /spec_impact/.test(dc8.detail), "next_action's re-review recommends spec_impact (tool + command) before re-approval; doctor warns changed-since-approval with the artifacts");
    ok(/spec_impact \(dev-spec impact drafts --phase requirements\)/.test(dc8.detail), "doctor's changed-since-approval names the phase to diff (dev-spec impact defaults to requirements)");

    // Reopen: the done tasks citing a modified/removed ID are unticked, their evidence marked stale; nothing else is edited.
    const designBefore8 = fs.readFileSync(f8("design.md"), "utf8");
    const ro8 = (await call8("spec_impact", { name: "drafts", reopen: true, projectDir: w8 })).p;
    const s8 = st8();
    ok(ro8.ok && ro8.recorded === true && ro8.reopened.join() === "2,3" && fs.readFileSync(f8("tasks.md"), "utf8") === tasksA.replace("- [x] 2.", "- [ ] 2.").replace("- [x] 3.", "- [ ] 3.") &&
      s8.evidence["2"].stale === true && !s8.evidence["1"].stale && fs.readFileSync(f8("requirements.md"), "utf8") === reqB && fs.readFileSync(f8("design.md"), "utf8") === designBefore8 &&
      /Reopened #2, #3/.test(ro8.note), "reopen unticks the affected DONE tasks (CRLF kept), marks their evidence stale and never edits requirements.md / design.md");
    const ch8 = s8.changes[0];
    ok(s8.changes.length === 1 && ch8.phase === "requirements" && ch8.added.join() === "US-1.AC-4" && ch8.modified.join() === "US-1.AC-2,SC-001" && ch8.removed.join() === "US-1.AC-3" &&
      ch8.reopened.join() === "2,3" && /^\d{4}-/.test(ch8.at) && ch8.snapshot === ".history/requirements@1.md", "reopen records {at, phase, added, modified, removed, reopened} in .state.json changes");
    const re8 = S.completeTask(w8, "drafts", 2);
    ok(re8.ok && re8.verified === false && re8.unverifiedReason === "stale-evidence" && /predates a spec change/.test(re8.note) &&
      S.specDoctor(w8, "drafts").checks.find((c) => c.id === "verification").detail.includes("#2"), "re-ticking a reopened task without new evidence: stale-evidence (unverified), doctor names it");
    const vd8 = S.specDoctor(w8, "drafts").checks.find((c) => c.id === "verification").detail;
    const sv8 = S.impactReport(w8, "drafts", {});
    const tv8 = sv8.affectedTasks.find((t) => t.number === 2);
    ok(vd8.includes("#2 (the spec changed since this evidence; spec_impact reopened the task)") && !/evidence is for another task/.test(vd8) && tv8.evidence === "stale-evidence" &&
      tv8.specChanged === true && S.impactLines(sv8).join("\n").includes("#2 [x] the spec changed since this evidence") &&
      S.finishFeature(w8, "drafts").blockers.some((b) => b.includes("#2 (the spec changed since this evidence")),
      "evidence staled by a reopen keeps the stale-evidence code but says the spec changed (doctor, impact, finish) — not 'evidence is for another task'");
    const re8b = S.completeTask(w8, "drafts", 2, { summary: "re-checked against the new AC-2" });
    ok(re8b.verified === true && !st8().evidence["2"].stale, "a task without a runnable _Verify:_: a new note clears the stale mark");
    const hi8 = S.impactReport(w8, "drafts", {});
    ok(hi8.hint === undefined && hi8.affectedTasks.some((t) => t.number === 2 && t.done),
      "no reopen hint once an earlier reopen against this approval covered every change (task #2, redone since, is done)");
    const beforeT8 = fs.readFileSync(f8("tasks.md"), "utf8"), beforeS8 = fs.readFileSync(f8(".state.json"), "utf8");
    const ro8b = S.impactReport(w8, "drafts", { reopen: true });
    ok(ro8b.ok && ro8b.recorded === false && ro8b.reopened.length === 0 && /Nothing new since the last reopen/.test(ro8b.note) &&
      fs.readFileSync(f8("tasks.md"), "utf8") === beforeT8 && fs.readFileSync(f8(".state.json"), "utf8") === beforeS8, "a second reopen with nothing new changes nothing (task #2, redone since, stays ticked)");

    // design: section-level diff; reopen reaches the done task citing an ID of a changed section.
    fs.writeFileSync(f8("design.md"), designA.replace("keyed by id", "keyed by uuid").replace("## Writer\nKeeps line endings (US-1.AC-3).\n", "") + "\n## Archive\nOld drafts move (US-1.AC-4).\n");
    const di8 = (await call8("spec_impact", { name: "drafts", phase: "design", projectDir: w8 })).p;
    ok(di8.ok && di8.added.map((x) => x.section).join() === "Archive" && di8.modified.map((x) => x.section).join() === "Data Model" && di8.removed.map((x) => x.section).join() === "Writer" &&
      di8.impacted.find((x) => x.section === "Data Model").tasks.map((t) => t.number).join() === "1" && di8.impacted.find((x) => x.section === "Writer").ids.join() === "US-1.AC-3",
      "design diff by ## section (added / modified by normalized body / removed) with the IDs each names and the tasks citing them");
    ok(S.specDoctor(w8, "drafts").checks.find((c) => c.id === "changed-since-approval").detail
      .includes("spec_impact (dev-spec impact drafts --phase requirements · dev-spec impact drafts --phase design)"), "doctor names one impact command per changed phase with a snapshot");
    const dro8 = S.impactReport(w8, "drafts", { phase: "design", reopen: true });
    ok(dro8.reopened.join() === "1" && st8().evidence["1"].stale === true && st8().changes[1].phase === "design" && st8().changes[1].removed.join() === "Writer",
      "design reopen: only the DONE task citing an ID of a changed section is reopened, its run marked stale");
    const n8 = S.completeTask(w8, "drafts", 1, { summary: "looked fine" });
    const r8 = S.completeTask(w8, "drafts", 1, { command: 'node -e "process.exit(0)"', exitCode: 0, summary: "ok" });
    ok(n8.verified === false && n8.unverifiedReason === "stale-evidence" && r8.verified === true && !st8().evidence["1"].stale && st8().evidence["1"].history.length === 2,
      "a runnable _Verify:_: a note doesn't clear the stale run, a new passing run does (history keeps both runs)");
    fs.writeFileSync(f8("requirements.md"), fs.readFileSync(f8("requirements.md"), "utf8").replace("log a warning", "log an error"));
    ok(/--phase requirements --reopen/.test(S.impactReport(w8, "drafts", {}).hint), "a NEW edit reaching a done task brings the reopen hint back");
    const ro8c = S.impactReport(w8, "drafts", { reopen: true });
    ok(ro8c.recorded === true && ro8c.reopened.join() === "2" && st8().changes.length === 3 && Object.keys(st8().changes[2].digests).length === 4,
      "a NEW edit of an AC already reopened once is new: the task citing it is reopened again");

    // tasks: added / removed / changed numbers (checkbox state is not a change); reopen/phase validation.
    fs.writeFileSync(f8("tasks.md"), fs.readFileSync(f8("tasks.md"), "utf8").replace("[US1] Reject empty drafts", "[US1] Reject empty drafts with a message")
      .replace("- [ ] 3. [US1] Keep CRLF\r\n  - _Requirements: US-1.AC-3_\r\n", "") + "- [ ] 5. [US1] Archive old drafts\r\n  - _Requirements: US-1.AC-4_\r\n");
    const ti8 = (await call8("spec_impact", { name: "drafts", phase: "tasks", projectDir: w8 })).p;
    ok(ti8.ok && ti8.added.map((x) => x.number).join() === "5" && ti8.modified.map((x) => x.number).join() === "4" && ti8.removed.map((x) => x.number).join() === "3" && ti8.affectedTasks === undefined,
      "tasks diff: added / changed / removed task numbers (unticked checkboxes are not a change)");
    const rt8 = S.impactReport(w8, "drafts", { phase: "tasks", reopen: true });
    const bad8m = await call8("spec_impact", { name: "drafts", phase: "plan", projectDir: w8 });
    const bad8e = S.impactReport(w8, "drafts", { phase: "plan" });
    ok(rt8.ok === false && /requirements and design only/.test(rt8.error) && bad8m.isError && /phase must be one of: requirements, design, tasks/.test(bad8m.p.error) &&
      bad8e.ok === false && /Unknown phase 'plan' for spec_impact/.test(bad8e.error), "reopen on tasks is refused; an unknown phase is refused (MCP schema and engine)");
    // A ticked sub-step is progress (like the fingerprint), not a changed task; doctor names only the phase that changed.
    const sb8 = S.createFeature(w8, "Steps", ["core"]);
    const sbf = (x) => path.join(sb8.dir, x);
    fs.writeFileSync(sbf("tasks.md"), "# Tasks\n\n## S\n- [ ] 1. Do A\n  - [ ] 1.1 first sub-step\n  - _Requirements: US-1.AC-1_\n");
    ["requirements", "design", "tasks"].forEach((ph) => S.approvePhase(w8, "steps", ph, "x", { force: true }));
    fs.writeFileSync(sbf("tasks.md"), "# Tasks\n\n## S\n- [ ] 1. Do A\n  - [x] 1.1 first sub-step\n  - _Requirements: US-1.AC-1_\n");
    const sbT = S.impactReport(w8, "steps", { phase: "tasks" });
    fs.appendFileSync(sbf("design.md"), "\n## Extra\nmore\n");
    const sbD = S.specDoctor(w8, "steps").checks.find((c) => c.id === "changed-since-approval");
    ok(sbT.ok && sbT.changed === false && sbT.modified.length === 0 && sbD && /^changed after their approval: design\.md —/.test(sbD.detail) &&
      sbD.detail.includes("(dev-spec impact steps --phase design)") && !sbD.detail.includes("--phase requirements"),
      "impact tasks: a ticked sub-step is not a changed task; doctor's hint names --phase design when only design.md changed");

    // Never approved; an existing snapshot file is never overwritten; a pre-1.13 approval is fingerprint-only.
    const fr8 = S.createFeature(w8, "Fresh", ["core"]);
    const nv8 = await call8("spec_impact", { name: "fresh", projectDir: w8 });
    fs.mkdirSync(path.join(fr8.dir, ".history"), { recursive: true });
    fs.writeFileSync(path.join(fr8.dir, ".history", "requirements@1.md"), "hand-made\n");
    const frAp = S.approvePhase(w8, "fresh", "requirements", "x", { force: true });
    ok(nv8.isError && nv8.p.neverApproved === true && /'requirements' was never approved for 'fresh'/.test(nv8.p.error) && frAp.snapshot === ".history/requirements@2.md" &&
      fs.readFileSync(path.join(fr8.dir, ".history", "requirements@1.md"), "utf8") === "hand-made\n", "never approved → a clear error; an existing snapshot file is never overwritten (@2)");
    const lg8 = S.createFeature(w8, "Legacy", ["core"]);
    S.approvePhase(w8, "legacy", "requirements", "old", { force: true });
    const lgFile = path.join(lg8.dir, ".state.json");
    const lgSt = JSON.parse(fs.readFileSync(lgFile, "utf8"));
    delete lgSt.approvalHistory;
    fs.writeFileSync(lgFile, JSON.stringify(lgSt));
    fs.rmSync(path.join(lg8.dir, ".history"), { recursive: true, force: true });
    const lf0 = S.impactReport(w8, "legacy", {});
    fs.appendFileSync(path.join(lg8.dir, "requirements.md"), "\n- one more assumption\n");
    const lf1 = (await call8("spec_impact", { name: "legacy", reopen: true, projectDir: w8 })).p;
    const lgDoc = S.specDoctor(w8, "legacy").checks.find((c) => c.id === "changed-since-approval");
    ok(lf0.baseline === "fingerprint-only" && lf0.changed === false && /Re-approve to start the history: \/approve legacy requirements/.test(lf0.hint) && lf1.baseline === "fingerprint-only" &&
      lf1.changed === true && lf1.reopened.length === 0 && lf1.recorded === false && lf1.added === undefined && lgDoc && !/spec_impact/.test(lgDoc.detail),
      "a pre-1.13 approval (no history) → baseline fingerprint-only, changed from the fingerprint + a re-approve hint; reopen reopens nothing; doctor doesn't point to spec_impact");
    const lgRe = S.approvePhase(w8, "legacy", "requirements", "new", { force: true });
    const lgH = JSON.parse(fs.readFileSync(lgFile, "utf8")).approvalHistory;
    ok(lgRe.snapshot === ".history/requirements@1.md" && S.impactReport(w8, "legacy", {}).baseline === "snapshot" &&
      lgH.length === 2 && lgH[0].legacy === true && lgH[0].by === "old" && lgH[0].snapshot === undefined && lgH[1].by === "new" && !lgH[1].legacy,
      "re-approving a legacy phase starts its history: the approval it replaces is seeded first as a legacy record (no snapshot; @1 counts snapshots)");
    const bh8 = S.createFeature(w8, "Badhist", ["core"]);
    const bhFile = path.join(bh8.dir, ".state.json");
    fs.writeFileSync(bhFile, JSON.stringify({ lang: "en", approvals: {}, approvalHistory: { requirements: 1 }, changes: "x" }));
    const bhAp = S.approvePhase(w8, "badhist", "requirements", "x", { force: true });
    const bhIm = S.impactReport(w8, "badhist", {});
    const bhM = S.metrics(w8, "badhist");
    ok(bhAp.ok === false && /'approvalHistory' must be an array; 'changes' must be an array/.test(bhAp.error) && JSON.parse(fs.readFileSync(bhFile, "utf8")).approvalHistory.requirements === 1 &&
      bhIm.ok === false && bhM.ok === true && /approvalHistory/.test(bhM.warning) && bhM.rework === null && bhM.changeRequests === 0,
      "a non-list approvalHistory / changes is refused by approve and impact (never replaced); metrics uses the valid parts and says so");

    // PT feature: impact lines, the next_action hint, errors and the retro template are European Portuguese.
    const pt8 = S.createFeature(w8, "Rascunhos", ["core"], undefined, undefined, "pt");
    const ptf = (x) => path.join(pt8.dir, x);
    const ptReq = "# Funcionalidade: Rascunhos\n\n## Resumo\nGuardar rascunhos.\n\n### US-1 (P1 — MVP): Guardar\n\n#### Critérios de Aceitação (EARS)\n1. **US-1.AC-1** — QUANDO o utilizador guarda O SISTEMA DEVE guardar o rascunho\n";
    fs.writeFileSync(ptf("requirements.md"), ptReq);
    fs.writeFileSync(ptf("design.md"), "# Design: Rascunhos\n\n## Modelo de dados\nRascunhos por id (US-1.AC-1).\n");
    fs.writeFileSync(ptf("tasks.md"), "# Tarefas: Rascunhos\n\n## História US-1\n- [x] 1. [US1] Guardar rascunhos\n  - _Requirements: US-1.AC-1_\n");
    ["requirements", "design", "tasks"].forEach((ph) => S.approvePhase(w8, "rascunhos", ph, "x", { force: true }));
    fs.writeFileSync(ptf("requirements.md"), ptReq.replace("guardar o rascunho", "guardar o rascunho em menos de 1 segundo"));
    const ptL8 = S.impactLines(S.impactReport(w8, "rascunhos", {})).join("\n");
    const ptNa8 = S.nextAction(w8, "rascunhos");
    const ptNv8 = S.impactReport(w8, "rascunhos", { phase: "design", reopen: true });
    const ptDg = S.specDoctor(w8, "rascunhos").checks.find((c) => c.id === "changed-since-approval");
    ok(/^Impacto: rascunhos · requirements — face à aprovação de \d{4}/.test(ptL8) && ptL8.includes("US-1.AC-1 (alterado) — tarefas: #1 [x] sem evidência") && /volta a aprovar: \/approve rascunhos requirements/.test(ptL8) &&
      /Vê primeiro o que a edição afeta com spec_impact/.test(ptNa8.recommendation) && ptNv8.ok && ptNv8.changed === false && ptNv8.recorded === false &&
      /^alterado\(s\) após a aprovação: requirements\.md/.test(ptDg.detail) && /nunca foi aprovada em 'fresca'/.test(S.impactReport(w8, S.createFeature(w8, "Fresca", ["core"], undefined, undefined, "pt").slug, {}).error),
      "PT feature: impact lines, next_action's spec_impact hint, doctor's check and errors are in European Portuguese");

    // K. Metrics: deterministic state (createdAt, history with a re-approval and a forced one, evidence runs, change requests).
    const w8m = path.join(tmp, "proj-wp8m");
    S.initProject(w8m, ["tdd"]);
    const mt8 = S.createFeature(w8m, "Metered", ["tdd"]);
    fs.writeFileSync(path.join(mt8.dir, "tasks.md"), "# Tasks\n\n## S\n- [x] 1. A\n- [x] 2. B\n");
    fs.writeFileSync(path.join(mt8.dir, "requirements.md"), "# R\n\n1. **US-1.AC-1** — WHEN x THE SYSTEM SHALL y [NEEDS CLARIFICATION: which store?]\n");
    const T8 = (d, h = "00") => `2026-01-${d}T${h}:00:00.000Z`;
    fs.writeFileSync(path.join(mt8.dir, ".state.json"), JSON.stringify({ lang: "en", tracks: ["core", "tdd"], createdAt: T8("01"),
      approvals: { requirements: { at: T8("02"), by: "a" }, design: { at: T8("03"), by: "a", forced: true, failing: ["constitution-check"] }, tasks: { at: T8("04"), by: "a" }, execution: { at: T8("06"), by: "a" } },
      approvalHistory: [{ phase: "requirements", at: T8("01", "12"), by: "a" }, { phase: "requirements", at: T8("02"), by: "a" }, { phase: "design", at: T8("03"), by: "a", forced: true, failing: ["constitution-check"] },
        { phase: "tasks", at: T8("04"), by: "a" }, { phase: "execution", at: T8("06"), by: "a" }],
      evidence: { 1: { command: "npm test", exitCode: 0, at: T8("05"), history: [{ command: "npm test", exitCode: 1, at: T8("04", "12") }, { command: "npm test", exitCode: 0, at: T8("05") }], task: "A", verify: "" },
        2: { summary: "checked by hand", manual: true, at: T8("04", "18"), task: "B", verify: "" } },
      changes: [{ at: T8("05"), phase: "requirements", reopened: [1, 2] }, { at: T8("05"), phase: "design", reopened: [2] }] }));
    const m8 = (await call8("spec_metrics", { name: "metered", projectDir: w8m })).p;
    const lt8 = m8.leadTime;
    ok(m8.ok && m8.scope === "feature" && m8.createdAt === T8("01") && m8.createdAtApproximate === false && lt8.requirements.hours === 12 && lt8.design.hours === 48 && lt8.tasks.hours === 72 &&
      lt8["test-plan"] === null && lt8.complete.hours === 96 && !lt8.complete.approximate && lt8.finished.hours === 120,
      "spec_metrics: createdAt from state; lead time (hours) to each phase's FIRST approval, to complete (latest evidence of the done tasks) and to finished (execution approved)");
    ok(m8.approvalsTotal === 5 && m8.rework === 1 && m8.reworkByPhase.requirements === 1 && m8.forcedApprovals === 1 && m8.changeRequests === 2 && m8.reopenedTasks === 3 &&
      m8.reopenedTasksUnique === 2 && m8.evidence.runs === 2 && m8.evidence.passing === 1 && m8.evidence.passRate === 50 && m8.tasks.done === 2 && m8.tasks.total === 2 && m8.openClarifications === 1,
      "spec_metrics: rework (re-approvals), forced approvals, change requests + reopened tasks, evidence pass rate from the run history, tasks, open clarification markers");
    ok(JSON.stringify(m8) === JSON.stringify(S.metrics(w8m, "metered")) && S.metricsLines(m8).join("\n").includes("lead time from creation: requirements 12h · design 2d · tasks 3d · complete 4d · finished 5d") &&
      S.metricsLines(m8).includes("  approvals: 5 · rework: 1 (requirements 1) · forced: 1") && S.metricsLines(m8).includes("  evidence: 50% of runs passing (1/2)"),
      "MCP spec_metrics = the engine call; metricsLines formats durations (h/d) and counts");
    const old8 = S.createFeature(w8m, "Oldie", ["core"]);
    fs.writeFileSync(path.join(old8.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: { requirements: { at: "2026-02-01T00:00:00.000Z", by: "x" }, design: { at: "2026-02-03T00:00:00.000Z", by: "x", forced: true } } }));
    const om8 = S.metrics(w8m, "oldie");
    ok(om8.ok && om8.createdAt === "2026-02-01T00:00:00.000Z" && om8.createdAtApproximate === true && om8.createdAtSource === "approval" && om8.leadTime.requirements.approximate === true &&
      om8.leadTime.design.hours === 48 && om8.rework === null && om8.approvalsTotal === 2 && om8.legacyPhases.join() === "requirements,design" && om8.reworkLowerBound === false &&
      om8.forcedApprovals === 1 && om8.changeRequests === 0 && om8.evidence.passRate === null &&
      /rework: unknown/.test(S.metricsLines(om8).join("\n")) && /\(approximate: from the earliest approval\)/.test(S.metricsLines(om8)[0]),
      "a legacy feature (no createdAt, no history): createdAt from the earliest approval (approximate), rework unknown (null) — never throws");
    const bare8 = S.createFeature(w8, "Bare", ["core"]);
    fs.writeFileSync(path.join(bare8.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: {} }));
    const bm8 = S.metrics(w8, "bare");
    ok(bm8.ok && bm8.createdAtSource === "filesystem" && bm8.createdAtApproximate === true && typeof bm8.createdAt === "string" && ["classification", "requirements", "design", "test-plan", "eval-plan", "tasks"].every((p) => bm8.leadTime[p] === null) && bm8.leadTime.complete === null,
      "no createdAt and no approval: the folder's date, flagged approximate; no lead times");
    // A feature with no approval yet has an empty history (createFeature doesn't seed approvalHistory) — rework 0, not unknown.
    const nw8 = S.createFeature(w8, "Brand new", ["core"]);
    const nm8 = S.metrics(w8, nw8.slug, { write: true });
    ok(nm8.approvalsTotal === 0 && nm8.rework === 0 && nm8.forcedApprovals === 0 && nm8.createdAtApproximate === false && bm8.rework === 0 &&
      S.metricsLines(nm8).includes("  approvals: 0 · rework: 0 · forced: 0") && fs.readFileSync(path.join(nw8.dir, "retro.md"), "utf8").includes("| Rework (re-approvals) | 0 |"),
      "a feature never approved: approvals 0, rework 0 (not 'unknown — the approvals predate the change history'), in the lines and retro.md");
    // Pass rate follows the evidence gate: a bare {exitCode: 0} (v1.12) is no run; a non-zero exit code is a failed run.
    const lr8 = S.createFeature(w8, "Legacy runs", ["core"]);
    fs.writeFileSync(path.join(lr8.dir, ".state.json"), JSON.stringify({ lang: "en", approvals: {}, evidence: { 1: { exitCode: 0 }, 2: { exitCode: 2, summary: "crashed" },
      3: { command: "npm test", exitCode: 0, history: [{ exitCode: 0 }, { command: "npm test", exitCode: 0 }] } } }));
    const lrm8 = S.metrics(w8, "legacy-runs");
    ok(lrm8.evidence.runs === 2 && lrm8.evidence.passing === 1 && lrm8.evidence.passRate === 50,
      "evidence pass rate: a bare exit code 0 (record or history entry) is not a passing run — only {command, exitCode: 0} is; a non-zero exit is a failed run");
    const pm8 = (await call8("spec_metrics", { projectDir: w8m })).p;
    ok(pm8.ok && pm8.scope === "project" && pm8.features.map((x) => x.feature).join() === "metered,oldie" && pm8.aggregates.rework.n === 1 && pm8.aggregates.rework.avg === 1 &&
      pm8.aggregates.leadTimeHours.requirements.avg === 6 && pm8.aggregates.leadTimeHours.requirements.median === 6 && pm8.aggregates.leadTimeHours.design.median === 48 &&
      pm8.aggregates.forcedApprovals.avg === 1 && pm8.aggregates.evidencePassRate.n === 1 && pm8.totals.features === 2 && pm8.totals.changeRequests === 2 && pm8.totals.evidencePassRate === 50 &&
      /^Metrics — 2 feature\(s\)/.test(S.metricsLines(pm8)[0]) && S.metricsLines(pm8).some((l) => /^ {2}median /.test(l)),
      "spec_metrics without name: per-feature rows + averages/medians (nulls skipped) + totals");

    // 6. Retro: create-only, localized, pre-filled; never overwritten; needs a feature.
    const rw8 = S.metrics(w8m, "metered", { write: true });
    const retro8 = path.join(mt8.dir, "retro.md");
    const retroTxt = fs.readFileSync(retro8, "utf8");
    ok(rw8.retro.written === true && rw8.retro.path === ".specs/metered/retro.md" && retroTxt.startsWith("# Retrospective: metered\n") &&
      ["## What went well", "## What hurt", "## Proposed steering or constitution amendments", "## Follow-ups", "| Rework (re-approvals) | 1 (requirements 1) |",
        "| Evidence pass rate | 50% (1/2 runs) |", "| Lead time → complete | 4d |", "never applied automatically", "3 task(s) reopened by change requests"].every((s) => retroTxt.includes(s)) &&
      !/NEEDS CLARIFICATION|\*\*TODO\*\*/.test(retroTxt), "metrics {write:true} creates retro.md: metrics table + What went well / What hurt / amendments (human approval) / Follow-ups");
    ok(retroTxt.includes("'requirements' approved 2 time(s)") && !/re-approved/.test(retroTxt), "the retro signal counts approvals (rework 1 = approved 2 times), like PT/ES — never 're-approved 2 time(s)'");
    fs.appendFileSync(retro8, "\nmy notes\n");
    const rw8b = await call8("spec_metrics", { name: "metered", write: true, projectDir: w8m });
    const pw8 = await call8("spec_metrics", { write: true, projectDir: w8m });
    ok(!rw8b.isError && rw8b.p.retro.written === false && /already exists — left untouched/.test(rw8b.p.note) && fs.readFileSync(retro8, "utf8").endsWith("my notes\n") &&
      pw8.isError && /write needs a feature name/.test(pw8.p.error), "an existing retro.md is never overwritten (said so); write without a feature is an error");
    S.metrics(w8, "rascunhos", { write: true });
    const ptRetro = fs.readFileSync(ptf("retro.md"), "utf8");
    ok(ptRetro.startsWith("# Retrospetiva: rascunhos") && ["## O que correu bem", "## O que custou", "## Alterações propostas ao steering ou à constituição", "## Seguimento", "| Tempo até requisitos |"]
      .every((s) => ptRetro.includes(s)) && /^Métricas: rascunhos \[core\] — criada a \d{4}/.test(S.metricsLines(S.metrics(w8, "rascunhos"))[0]), "PT feature: the retro template and metrics lines are European Portuguese");

    // A feature upgraded mid-flight (a pre-1.13 approval, then 1.13 ones): the legacy approval still counts — approvals,
    // forced (agreeing with doctor's approval-gates) — and rework becomes a lower bound, in the JSON, the lines and retro.md.
    const mx8 = S.createFeature(w8m, "Mixed", ["core"]);
    const mxFile = path.join(mx8.dir, ".state.json");
    fs.writeFileSync(mxFile, JSON.stringify({ lang: "en", tracks: ["core"], approvals: { requirements: { at: "2026-01-01T00:00:00.000Z", by: "old", forced: true, failing: ["placeholders"] } } }));
    S.approvePhase(w8m, "mixed", "design", "x", { force: true });
    const mx1 = S.metrics(w8m, "mixed");
    const mxGates = S.specDoctor(w8m, "mixed").checks.find((c) => c.id === "approval-gates").detail;
    ok(mx1.approvalsTotal === 2 && mx1.forcedApprovals === 2 && mx1.rework === 0 && mx1.reworkLowerBound === true && mx1.legacyPhases.join() === "requirements" &&
      mx1.leadTime.requirements.approximate === true && /requirements \(placeholders\), design/.test(mxGates) &&
      S.metricsLines(mx1).includes("  approvals: 2 · rework: at least 0 · forced: 2 — rework unknown for requirements (approved before the change history)"),
      "mixed legacy + 1.13 approvals: the legacy one is counted (approvals 2, forced 2 like doctor's approval-gates), rework is a lower bound");
    S.approvePhase(w8m, "mixed", "requirements", "x", { force: true });
    const mx2 = S.metrics(w8m, "mixed");
    const mxH = JSON.parse(fs.readFileSync(mxFile, "utf8")).approvalHistory;
    S.metrics(w8m, "mixed", { write: true });
    ok(mxH.map((h) => h.phase + (h.legacy ? "*" : "")).join() === "requirements*,design,requirements" && mxH[0].forced === true && mx2.approvalsTotal === 3 && mx2.forcedApprovals === 3 &&
      mx2.rework === 1 && mx2.reworkLowerBound === true &&
      fs.readFileSync(path.join(mx8.dir, "retro.md"), "utf8").includes("| Rework (re-approvals) | at least 1 (requirements 1) — unknown for requirements (approved before the change history) |") &&
      S.metricsLines(S.metrics(w8m)).some((l) => /^ {2}mixed .* · rework 1\+ · forced 3 /.test(l)),
      "the replaced legacy approval stays in the history (seeded legacy record): re-approving its phase is rework 1 (at least) — JSON, retro.md, project row");

    // Bugfix: the design approval signs off bug.md (its Root Cause) — snapshot, fingerprint, impact and doctor follow it.
    const bf8 = S.createFeature(w8, "Crash on save", ["core"], undefined, undefined, undefined, "bugfix");
    const bff = (x) => path.join(bf8.dir, x);
    const bug8 = fs.readFileSync(bff("bug.md"), "utf8");
    const bfAp = S.approvePhase(w8, "crash-on-save", "design", "x", { force: true });
    const bfSt = JSON.parse(fs.readFileSync(bff(".state.json"), "utf8"));
    ok(bfAp.ok && bfAp.snapshot === ".history/design@1.md" && fs.readFileSync(bff(".history/design@1.md"), "utf8") === bug8 && !fs.existsSync(bff("design.md")) &&
      bfSt.approvals.design.file === "bug.md" && bfSt.approvalHistory[0].file === "bug.md" && typeof bfSt.approvals.design.fingerprint === "string" && S.finishFeature(w8, "crash-on-save").changedSinceApproval.length === 0,
      "a bugfix's design approval snapshots and fingerprints bug.md (the artifact its gate signs off), recorded as file: bug.md");
    fs.writeFileSync(bff("bug.md"), bug8.replace(/## Root Cause[^\n]*\n/, (h) => h + "The save handler swallowed ENOSPC (US-1.AC-1).\n"));
    const bfIm = S.impactReport(w8, "crash-on-save", { phase: "design" });
    const bfDc = S.specDoctor(w8, "crash-on-save").checks.find((c) => c.id === "changed-since-approval");
    ok(bfIm.ok && bfIm.file === "bug.md" && bfIm.baseline === "snapshot" && bfIm.changed === true && bfIm.modified.map((x) => x.section + "|" + x.file).join() === "bug.md: Root Cause|bug.md" &&
      bfDc && /^changed after their approval: bug\.md —/.test(bfDc.detail) && bfDc.detail.includes("(dev-spec impact crash-on-save --phase design)"),
      "an edit to bug.md after a bugfix's design approval: spec_impact --phase design diffs bug.md's sections; doctor flags bug.md and names --phase design");
    S.addTrack(w8, "crash-on-save", "saas");
    const ob8 = S.createFeature(w8, "Old bug", ["core"], undefined, undefined, undefined, "bugfix");
    const obFile = path.join(ob8.dir, ".state.json");
    fs.writeFileSync(obFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(obFile, "utf8")), approvals: { design: { at: "2026-01-01T00:00:00.000Z", by: "x" } } }));
    fs.appendFileSync(path.join(ob8.dir, "bug.md"), "\nmore\n");
    ok(S.finishFeature(w8, "crash-on-save").changedSinceApproval.join() === "bug.md,design.md" && S.finishFeature(w8, "old-bug").changedSinceApproval.length === 0 &&
      S.impactReport(w8, "old-bug", { phase: "design" }).baseline === "fingerprint-only",
      "a design.md created after a bugfix's design approval (track added) counts as changed too; a pre-1.13 bugfix approval (no file) keeps its old meaning");
    const csI = S.impactReport(w8, "crash-on-save", { phase: "design" });
    ok(csI.designMd && csI.designMd.baseline === "absent" && csI.designMd.changed === true && csI.added.length > 0 &&
      csI.added.every((x) => x.file === "design.md" && x.section.startsWith("design.md: ")) && csI.modified.map((x) => x.section).join() === "bug.md: Root Cause",
      "spec_impact on that bugfix: design.md (absent at approval) adds every section, keyed by its file, next to bug.md's change");

    // A bugfix with +saas: its design approval snapshots design.md too (the [SaaS] sections its gate checks) — an edit there
    // is diffed by spec_impact --phase design and reopened, agreeing with doctor (it used to read "no changes").
    const sp8 = S.createFeature(w8, "Slow page", ["saas"], undefined, undefined, "en", "bugfix");
    const spf = (x) => path.join(sp8.dir, x);
    const spAp = S.approvePhase(w8, "slow-page", "design", "x", { force: true });
    const spDesign = fs.readFileSync(spf("design.md"), "utf8");
    ok(spAp.snapshot === ".history/design@1.md" && spAp.designSnapshot === ".history/design@1.design.md" && fs.readFileSync(spf(".history/design@1.design.md"), "utf8") === spDesign &&
      JSON.parse(fs.readFileSync(spf(".state.json"), "utf8")).approvalHistory[0].designSnapshot === ".history/design@1.design.md",
      "a bugfix +saas design approval snapshots design.md too (<phase>@<n>.design.md, recorded as designSnapshot)");
    fs.writeFileSync(spf("design.md"), spDesign.replace(/(## \[SaaS\] Performance Budget[^\n]*\n)/, "$1p95 under 200 ms on the listing (US-1.AC-1)\n"));
    const spI = (await call8("spec_impact", { name: "slow-page", phase: "design", projectDir: w8 })).p;
    const spDc = S.specDoctor(w8, "slow-page").checks.find((c) => c.id === "changed-since-approval");
    const spL = S.impactLines(spI).join("\n");
    ok(spI.ok && spI.changed === true && spI.designMd.baseline === "snapshot" && spI.modified.map((x) => x.section + "|" + x.file).join() === "design.md: [SaaS] Performance Budget|design.md" &&
      spI.impacted[0].ids.includes("US-1.AC-1") && spL.includes("(.history/design@1.md, .history/design@1.design.md)") && spL.includes("  ~ design.md: [SaaS] Performance Budget") &&
      !spL.includes("no changes since the approval") && /^changed after their approval: design\.md —/.test(spDc.detail) && spDc.detail.includes("(dev-spec impact slow-page --phase design)"),
      "an edit to a bugfix's design.md after its design approval: spec_impact --phase design diffs it (keyed by file), agreeing with doctor");
    const spR = S.impactReport(w8, "slow-page", { phase: "design", reopen: true });
    const spR2 = S.impactReport(w8, "slow-page", { phase: "design", reopen: true });
    ok(spR.recorded === true && spR.changeRequest === 1 && spR2.recorded === false && /Nothing new since the last reopen/.test(spR2.note),
      "reopen on a bugfix's design.md edit records the change request; a second reopen is 'nothing new' (a prior reopen exists)");
    // An approval that kept only design.md's fingerprint (no designSnapshot): impact says THAT design.md changed, never
    // "no changes"; reopen says why nothing was reopened; doctor doesn't send to an impact that can't diff it.
    const fp8 = S.createFeature(w8, "Slow list", ["saas"], undefined, undefined, "en", "bugfix");
    S.approvePhase(w8, "slow-list", "design", "x", { force: true });
    const fpFile = path.join(fp8.dir, ".state.json");
    const fpSt = JSON.parse(fs.readFileSync(fpFile, "utf8"));
    delete fpSt.approvalHistory[0].designSnapshot;
    fs.writeFileSync(fpFile, JSON.stringify(fpSt));
    fs.appendFileSync(path.join(fp8.dir, "design.md"), "\nmore budget notes\n");
    const fpI = S.impactReport(w8, "slow-list", { phase: "design" });
    const fpR = S.impactReport(w8, "slow-list", { phase: "design", reopen: true });
    const fpDc = S.specDoctor(w8, "slow-list").checks.find((c) => c.id === "changed-since-approval");
    ok(fpI.changed === true && fpI.designMd.baseline === "fingerprint-only" && /design\.md changed since the approval too, but this approval kept no snapshot of it/.test(fpI.designHint) &&
      !S.impactLines(fpI).join("\n").includes("no changes since the approval") && fpR.recorded === false && /design\.md changed, but without a snapshot of it/.test(fpR.note) &&
      /^changed after their approval: design\.md — re-review/.test(fpDc.detail),
      "a bugfix approval with only design.md's fingerprint: impact and reopen say design.md changed but can't be diffed; doctor doesn't send to spec_impact");

    // reopen with nothing to reopen: say why — never "nothing new since the last reopen" when no reopen preceded it.
    const nc8 = S.createFeature(w8, "Unchanged", ["core"]);
    S.approvePhase(w8, "unchanged", "requirements", "x", { force: true });
    const nc0 = (await call8("spec_impact", { name: "unchanged", reopen: true, projectDir: w8 })).p;
    fs.appendFileSync(path.join(nc8.dir, "requirements.md"), "\nA closing remark outside any criterion.\n");
    const nc1 = S.impactReport(w8, "unchanged", { reopen: true });
    ok(nc0.recorded === false && nc0.note === "Nothing changed since the approval — nothing to reopen." && nc1.changed === true && nc1.recorded === false &&
      /^Nothing to reopen: the edit changed no criterion or section/.test(nc1.note) && !(JSON.parse(fs.readFileSync(path.join(nc8.dir, ".state.json"), "utf8")).changes || []).length &&
      ptNv8.note === "Nada mudou desde a aprovação — nada a reabrir.",
      "reopen with nothing changed (or only text outside the criteria) says so (EN/PT) — not 'nothing new since the last reopen', which no reopen preceded");

    // Every WP8 message exists in EN, PT and ES (same keys).
    const keys8 = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys8(v, pre + k + ".") : [pre + k])).sort();
    ok(["impact", "metrics"].every((ns) => { const en = JSON.stringify(keys8(S.msg("en")[ns]).filter((k) => k !== "buildRetro")); return ["pt", "es"].every((l) => JSON.stringify(keys8(S.msg(l)[ns])) === en); }) &&
      ["approvalHistory", "changes"].every((k) => ["en", "pt", "es"].every((l) => typeof S.msg(l).jsonShape[k] === "string")) &&
      /^# Retrospectiva: x/.test(S.msg("es").metrics.retro({ feature: "x", leadTime: {}, evidence: { runs: 0 }, tasks: { done: 0, total: 0 }, openClarifications: 0, forcedApprovals: 0, changeRequests: 0, reopenedTasks: 0, rework: null }, { dur: String, today: "2026-01-01" })),
      "WP8 messages (impact, metrics, retro, jsonShape) exist in EN, PT and ES with the same keys");
  }
  // @wp WP8 <<<

  // @wp WP9 tests >>>
  { // --- 1.13 WP9: deep traceability (EC/NFR/SC warnings, T-IDs in test code) + property-based test plans ---
    const call9 = async (args) => payload(await rpc("tools/call", { name: "trace_check", arguments: args }));
    const w9f = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const kinds9 = (tr) => (tr.warnings || []).map((w) => w.kind + "=" + w.items.join("+")).join(" ");
    const w9 = path.join(tmp, "proj-wp9");
    S.initProject(w9, ["tdd"]);

    // B. A fresh scaffold (every track, EN/PT/ES) and a fresh bugfix raise no secondary warning: the template SC-001 /
    // EC-1 / NFR-1 rows are placeholders, and the bugfix's real SC-001 is covered by its regression row T-01.
    const fresh9 = [["Fresh all", ["tdd", "saas", "ai"], "en"], ["Fresco", ["tdd"], "pt"], ["Fresca", ["tdd", "saas"], "es"]]
      .map(([n, t, l]) => S.traceCheck(w9, S.createFeature(w9, n, t, undefined, undefined, l).slug));
    const bugs9 = ["en", "pt", "es"].map((l) => S.traceCheck(w9, S.createFeature(w9, "Bug " + l, ["tdd"], undefined, undefined, l, "bugfix").slug));
    ok(fresh9.concat(bugs9).every((tr) => tr.ok && tr.verdict === "pass" && Array.isArray(tr.warnings) && tr.warnings.length === 0 &&
      ["uncoveredEdgeCases", "uncoveredNfr", "uncoveredSuccessCriteria", "phantomSecondary"].every((k) => Array.isArray(tr[k]) && tr[k].length === 0) && tr.code === undefined),
      "fresh scaffolds (EN/PT/ES, all tracks) and fresh bugfixes: no EC/NFR/SC warning — template rows don't count, the bugfix's SC-001 is covered by T-01");

    // Secondary IDs: EC/NFR need a task or a test-plan row, SC a test-plan row or a real quickstart line.
    const d9 = S.createFeature(w9, "Deep", ["tdd"]);
    w9f(d9.dir, "requirements.md", ["# Feature: Deep", "", "## Summary", "Sessions expire and refresh.", "", "## User Stories", "",
      "### US-1 (P1 — MVP): Sessions", "**As a** user, **I want** sessions, **so that** I stay signed in.", "",
      "#### Acceptance Criteria (EARS)", "1. **US-1.AC-1** — WHEN a token expires THE SYSTEM SHALL reject it with 401.", "",
      "## Success Criteria", "- **SC-001** — 99% of refreshes succeed within 300 ms.", "- **SC-002** — zero sessions outlive their expiry.",
      "- **SC-003** — support tickets about logouts drop by 50%.", "- **SC-004** — [e.g., 90% of users complete [task] in under [N] seconds]", "",
      "## Edge Cases & Error Handling", "- **EC-1** — a clock skew of 5 s: the token is still accepted.", "- **EC-2** — a revoked refresh token",
      "  is rejected with 401 (wrapped onto a second line).", "", "## Non-Functional Requirements", "- **NFR-1** — p95 refresh latency ≤ 300 ms.",
      "- **NFR-2** — [measurable performance / security / accessibility constraint]", "", "<!-- - **EC-5** — an example in a comment is not a definition -->", ""].join("\n"));
    w9f(d9.dir, "tasks.md", ["# Tasks: Deep", "", "## Phase: Build", "- [ ] 1. [US1] Reject expired tokens (keeps EC-1 in mind)",
      "  - _Requirements: US-1.AC-1, NFR-2_", "  - _Makes green: T-01_", "- [ ] 2. [US1] Cover the skew window", "  - _Requirements: US-1.AC-1, EC-9_", ""].join("\n"));
    w9f(d9.dir, "test-plan.md", ["# Test Plan: Deep", "", "| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |", "|---|---|---|---|---|---|",
      "| T-01 | unit | example | expired token rejected | US-1.AC-1, SC-001 | `tests/unit/session.test.js` |",
      "| T-02 | unit | property | refresh stays in budget | US-1.AC-1, NFR-1, NFR-7 | `tests/unit/perf.test.js` |", "",
      "## Coverage Check", "- EC-2 — not tested yet (a gap note is not a test row).", ""].join("\n"));
    w9f(d9.dir, "quickstart.md", "# Quickstart: Deep\n\n3. **Expect:** no session outlives its expiry (SC-2).\n4. **Expect:** [observable result tied to SC-003]\n");
    const t9 = S.traceCheck(w9, "deep");
    ok(t9.ok && t9.verdict === "pass" && t9.uncoveredEdgeCases.join() === "EC-2" && t9.uncoveredNfr.length === 0 && t9.uncoveredSuccessCriteria.join() === "SC-003" &&
      t9.phantomSecondary.join() === "EC-9,NFR-7" && kinds9(t9) === "uncoveredEdgeCases=EC-2 uncoveredSuccessCriteria=SC-003 phantomSecondary=EC-9+NFR-7",
      "trace_check: EC-2 (a gap note isn't a test row) and SC-003 (only on a template quickstart line) are uncovered; SC-2 names SC-002; EC-9 / NFR-7 are phantom; the verdict stays pass (got " + kinds9(t9) + ")");
    ok(!S.traceGaps(t9).some((g) => /Edge|Nfr|Success|Secondary|warnings/.test(g.kind)) && S.traceGapLines(t9, "en").every((l) => !/EC-|SC-|NFR-/.test(l)),
      "the secondary warnings are never trace gaps (traceGaps / traceGapLines skip them and the `warnings` field)");
    ok(!t9.phantomSecondary.includes("NFR-2") && !t9.uncoveredNfr.includes("NFR-2") && !t9.uncoveredSuccessCriteria.includes("SC-004") && !t9.uncoveredEdgeCases.includes("EC-5"),
      "a template-only ID (NFR-2, SC-004) is defined but never uncovered; an ID inside an HTML comment (EC-5) is not defined");
    const m9 = await call9({ name: "Deep", projectDir: w9 });
    const m9c = await call9({ name: "Deep", projectDir: w9, code: false });
    ok(kinds9(m9) === kinds9(t9) && m9.verdict === "pass" && m9.code === undefined && m9c.code === undefined,
      "MCP trace_check returns the same warnings as the engine; without code: true there is no `code` field");

    // doctor: a secondary-trace WARN (traceability still passes); finish lists them as warnings, never blockers.
    const doc9 = S.specDoctor(w9, "deep");
    const sec9 = doc9.checks.find((c) => c.id === "secondary-trace");
    ok(sec9 && sec9.status === "warn" && /edge cases \(EC\) that no task or test covers: EC-2/.test(sec9.detail) && /SC-003/.test(sec9.detail) && /EC-9, NFR-7/.test(sec9.detail) &&
      doc9.checks.find((c) => c.id === "traceability").status === "pass" && !doc9.checks.some((c) => c.id === "tests-in-code"),
      "doctor: secondary-trace is a warn naming each kind with its IDs; traceability passes; no tests-in-code check without done _Makes green:_ tasks");
    const fin9 = S.finishFeature(w9, "deep");
    ok(Array.isArray(fin9.warnings) && fin9.warnings.some((w) => /EC-2/.test(w)) && fin9.warnings.some((w) => /EC-9, NFR-7/.test(w)) &&
      !fin9.blockers.some((b) => /EC-|SC-|NFR-/.test(b)), "spec_finish lists the EC/NFR/SC findings under warnings — never as blockers");
    const clean9 = S.specDoctor(w9, "fresh-all");
    const cleanFin9 = S.finishFeature(w9, "fresh-all").warnings;
    ok(!clean9.checks.some((c) => c.id === "secondary-trace") && cleanFin9.length === 1 && /^planned tests that no test file names \(put the T-ID in the test name\): T-01, T-02, .*T-10$/.test(cleanFin9[0]),
      "no secondary IDs written yet → no secondary-trace check and no EC/NFR/SC finish warning (only: no test file names the planned T-IDs yet)");
    // Hook on tasks.md: the warnings follow the trace line, under their own heading.
    const hk9 = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "PostToolUse", tool_input: { file_path: path.join(d9.dir, "tasks.md") } }), encoding: "utf8" });
    let hk9t = "";
    try { hk9t = JSON.parse(hk9.stdout).hookSpecificOutput.additionalContext; } catch { /* no output */ }
    ok(/Traceability: all 1 ACs covered by tasks/.test(hk9t) && /Warnings \(not blocking\):\n  ▲ edge cases \(EC\) that no task or test covers: EC-2/.test(hk9t) && /▲ tasks \/ test plan cite unknown EC\/NFR\/SC IDs \(typos\?\): EC-9, NFR-7/.test(hk9t),
      "tasks.md hook: the EC/NFR/SC warnings are listed after the trace line (got " + JSON.stringify(hk9t) + ")");
    // Covering EC-2 in a task and SC-003 in the plan clears them; the doctor check then passes.
    fs.appendFileSync(path.join(d9.dir, "tasks.md"), "- [ ] 3. [US1] Reject revoked refresh tokens\n  - _Requirements: US-1.AC-1, EC-2_\n");
    fs.appendFileSync(path.join(d9.dir, "test-plan.md"), "\n| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n| T-03 | e2e | example | logout tickets | SC-003 | `tests/e2e/x.spec.ts` |\n");
    fs.writeFileSync(path.join(d9.dir, "tasks.md"), fs.readFileSync(path.join(d9.dir, "tasks.md"), "utf8").replace(", EC-9", ""));
    fs.writeFileSync(path.join(d9.dir, "test-plan.md"), fs.readFileSync(path.join(d9.dir, "test-plan.md"), "utf8").replace(", NFR-7", ""));
    const doc9b = S.specDoctor(w9, "deep");
    ok(S.traceCheck(w9, "deep").warnings.length === 0 && doc9b.checks.find((c) => c.id === "secondary-trace").status === "pass" &&
      /all 6 EC\/NFR\/SC IDs covered/.test(doc9b.checks.find((c) => c.id === "secondary-trace").detail),
      "once every real EC/NFR/SC is covered, trace has no warnings and secondary-trace passes (6 real IDs; the template ones don't count)");

    // PT feature: localized warning lines in doctor / finish / the engine helper; markers stay English-stable.
    const p9 = S.createFeature(w9, "Sessões", ["tdd"], undefined, undefined, "pt");
    fs.appendFileSync(path.join(p9.dir, "requirements.md"), "\n## Requisitos Extra\n- **EC-7** — relógio adiantado 5 s: o token continua aceite.\n");
    const pdoc9 = S.specDoctor(w9, "sessoes").checks.find((c) => c.id === "secondary-trace");
    ok(pdoc9 && pdoc9.status === "warn" && /casos limite \(EC\) sem tarefa nem teste que os cubra: EC-7/.test(pdoc9.detail) &&
      S.finishFeature(w9, "sessoes").warnings.some((w) => /^casos limite \(EC\) sem tarefa nem teste que os cubra: EC-7$/.test(w)) &&
      S.traceWarningLines(S.traceCheck(w9, "sessoes"), "es").join() === "casos límite (EC) sin tarea ni prueba que los cubra: EC-7",
      "PT feature: secondary-trace / finish warnings in Portuguese (and traceWarningLines localizes to ES on request)");

    // I. Property-based test plans: a Kind column (example | property, English-stable) with the T-ID still the FIRST
    // cell — the brief quotes the row under its header; the ubiquitous AC-4 and tenant isolation are properties.
    const plan9 = (slug) => fs.readFileSync(path.join(w9, ".specs", slug, "test-plan.md"), "utf8");
    ok(/\| Test ID \| Layer \| Kind \| Description \| Covers \(AC IDs\) \| File \|/.test(plan9("fresh-all")) && /\| T-04 \| unit \| property \| \[always-true property\] \| US-1\.AC-4 \|/.test(plan9("fresh-all")) &&
      /\| T-06 \| integration \| property \| tenant A never reads/.test(plan9("fresh-all")) && /\| T-01 \| unit \| example \|/.test(plan9("fresh-all")) &&
      /\| Test ID \| Camada \| Tipo \| Descrição \|/.test(plan9("fresco")) && /\| T-04 \| unit \| property \|/.test(plan9("fresco")) &&
      /\| Test ID \| Capa \| Tipo \| Descripción \|/.test(plan9("fresca")) && /\| T-06 \| integración \| property \|/.test(plan9("fresca")) &&
      ["fresh-all", "fresco", "fresca"].every((s) => /<!--[\s\S]*property[\s\S]*fast-check, Hypothesis, jqwik, gopter, FsCheck[\s\S]*T-01[\s\S]*-->/.test(plan9(s))),
      "feature test plans (EN/PT/ES) carry a Kind/Tipo column after Layer, T-ID first; AC-4 and tenant isolation are property rows; the guidance comment names the libraries");
    ok(["bug-en", "bug-pt", "bug-es"].every((s) => /\| Test ID \| (Layer|Camada|Capa) \| (Kind|Tipo) \|/.test(plan9(s)) && /\| T-01 \| [^|]+ \| example \| [^|]+ \| US-1\.AC-1, SC-001 \|/.test(plan9(s))),
      "bugfix test plans (EN/PT/ES) carry the Kind column and the regression row T-01 covers SC-001");
    const br9 = S.taskBrief(w9, "fresh-all", 3);
    ok(br9.ok && br9.tests.length === 3 && br9.tests[0].row.startsWith("| T-01 | unit | example |") && br9.brief.includes("| Test ID | Layer | Kind | Description | Covers (AC IDs) | File |\n|---------|-------|------|") &&
      S.traceCheck(w9, "fresh-all").plannedTests === 10,
      "the brief still resolves each T-ID to its row (T-ID in the first cell) and quotes it under the Kind header; trace counts every planned test");

    // Drive root: withinRoot (used by trace_check's _Implements:_ clamp) holds at C:\ or / — `root + sep` did not.
    const drive9 = path.parse(tmp).root;
    ok(S.withinRoot(drive9, path.join(drive9, "src", "a.js")) && S.withinRoot(drive9, drive9) && !S.withinRoot(path.join(drive9, "proj"), path.join(drive9, "projX", "a.js")) &&
      !S.withinRoot(path.join(drive9, "proj"), path.join(drive9, "a.js")) && S.withinRoot(path.join(drive9, "proj"), path.join(drive9, "proj", "..cache", "a.js")),
      "withinRoot: a drive root contains its files; a sibling with the same prefix and the parent are outside; a '..cache' folder is inside");

    // C. T-IDs in test code — one test file per language family, in a small project of its own.
    const c9 = path.join(tmp, "proj-wp9-code");
    S.initProject(c9, ["tdd"]);
    const cf9 = S.createFeature(c9, "Coded", ["tdd"]);
    w9f(cf9.dir, "requirements.md", "# Feature: Coded\n\n## User Stories\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a token expires THE SYSTEM SHALL reject it.\n2. **US-1.AC-2** — WHEN a key rotates THE SYSTEM SHALL keep old tokens valid for 60 s.\n");
    w9f(cf9.dir, "test-plan.md", "| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n" +
      ["T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-07"].map((t) => `| ${t} | unit | example | x | US-1.AC-1, US-1.AC-2 | \`x\` |`).join("\n") + "\n");
    w9f(cf9.dir, "tasks.md", "# Tasks\n\n## Phase: Build\n- [x] 1. [US1] Reject expired tokens\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01, T-07_\n" +
      "- [ ] 2. [US1] Rotate keys\n  - _Requirements: US-1.AC-2_\n  - _Makes green: T-02, T-03, T-04, T-05, T-06_\n");
    const of9 = S.createFeature(c9, "Other", ["tdd"]);
    w9f(of9.dir, "test-plan.md", "| Test ID | Covers |\n|---|---|\n| T-09 | US-1.AC-1 |\n");
    w9f(c9, "tests/unit/login.test.js", "const { test } = require(\"node:test\");\ntest(\"T-01 rejects an expired token (US-1.AC-1)\", () => {});\n// GPT-4 and UTF-8 are not test IDs\n");
    w9f(c9, "tests/test_login.py", "def test_T02_lockout():\n    assert True\n");
    w9f(c9, "pkg/auth/login_test.go", "package auth\n\nimport \"testing\"\n\nfunc TestT03Refresh(t *testing.T) {}\n");
    w9f(c9, "src/test/java/com/acme/LoginTest.java", "class LoginTest {\n  @Test @DisplayName(\"T-04 rotates keys\")\n  void rotates() {}\n}\n");
    w9f(c9, "tests/LoginTests.cs", "public class LoginTests {\n  [Fact(DisplayName = \"T-05 audit\")]\n  public void Audit() {}\n  [Fact]\n  public void T06_Revokes() {}\n  Func<T7, T8> f;\n}\n");
    w9f(c9, "tests/other.test.js", "test(\"T-42 an orphan\", () => {});\ntest(\"T-09 belongs to Other\", () => {});\n");
    w9f(c9, "src/app.js", "// T-07 named in source code, not in a test\n");
    w9f(c9, "node_modules/pkg/x.test.js", "test(\"T-07 vendored\", () => {});\n");
    const ct9 = S.traceCheck(c9, "coded", { code: true });
    const code9 = ct9.code || {};
    const tic9 = code9.testsInCode || {};
    ok(ct9.ok && JSON.stringify(Object.keys(tic9).sort()) === JSON.stringify(["T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-09", "T-42"]) &&
      tic9["T-01"].join() === "tests/unit/login.test.js" && tic9["T-02"].join() === "tests/test_login.py" && tic9["T-03"].join() === "pkg/auth/login_test.go" &&
      tic9["T-04"].join() === "src/test/java/com/acme/LoginTest.java" && tic9["T-05"].join() === "tests/LoginTests.cs" && tic9["T-06"].join() === "tests/LoginTests.cs",
      "trace_check {code: true}: T-IDs found per language family — test(\"T-01 …\"), def test_T02_, func TestT03, @DisplayName(\"T-04 …\"), DisplayName=\"T-05 …\", T06_ (got " + JSON.stringify(tic9) + ")");
    ok(code9.plannedNotInCode.join() === "T-07" && code9.inCodeNotInPlan.join() === "T-42" && code9.acsInTests.join() === "US-1.AC-1" && code9.scanned === 6 &&
      code9.truncated === false && code9.planned === 7 && kinds9(ct9) === "plannedNotInCode=T-07 inCodeNotInPlan=T-42" && ct9.verdict === "pass",
      "T-07 (only in source code and node_modules) is planned-not-in-code; T-42 is in no feature's plan while Other's T-09 isn't reported; Func<T7, T8> / GPT-4 are not IDs; 6 test files read");
    const mc9 = await call9({ name: "Coded", projectDir: c9, code: true });
    ok(mc9.ok && JSON.stringify(mc9.code) === JSON.stringify(code9) && kinds9(mc9) === kinds9(ct9), "MCP trace_check {code: true} returns the same code block as the engine");
    // doctor: the done task claims T-01 and T-07 → tests-in-code warns about T-07 only (open tasks' tests may not exist yet).
    const cdoc9 = S.specDoctor(c9, "coded").checks.find((c) => c.id === "tests-in-code");
    const cfin9 = S.finishFeature(c9, "coded");
    ok(cdoc9 && cdoc9.status === "warn" && /no test file names them: T-07 — put the T-ID in the test name/.test(cdoc9.detail) && !/T-0[2-6]/.test(cdoc9.detail) &&
      cfin9.warnings.some((w) => /^planned tests that no test file names \(put the T-ID in the test name\): T-07$/.test(w)) && !cfin9.warnings.some((w) => /T-42/.test(w)) &&
      !cfin9.blockers.some((b) => /T-07/.test(b)),
      "doctor tests-in-code warns about the done task's T-07 only; spec_finish lists plannedNotInCode as a warning (not T-42, never a blocker)");
    w9f(c9, "tests/unit/rotate.test.js", "test(\"T-07 keeps old tokens for 60 s\", () => {});\n");
    const cdoc9b = S.specDoctor(c9, "coded").checks.find((c) => c.id === "tests-in-code");
    ok(cdoc9b && cdoc9b.status === "pass" && /\(2\)/.test(cdoc9b.detail) && S.traceCheck(c9, "coded", { code: true }).code.plannedNotInCode.length === 0,
      "with a test named T-07 the tests-in-code check passes (both claimed T-IDs found)");
    // The scan is bounded and never enters .specs/, node_modules/ or hidden folders.
    const sc9 = S.scanTestCode(c9);
    ok(sc9.scanned === 7 && !sc9.truncated && ![...sc9.tids.values()].some((e) => e.files.some((f) => /node_modules|\.specs|src\/app\.js/.test(f))),
      "scanTestCode reads only test files (node_modules/, .specs/ outside a feature's tests/ folder and source files skipped)");
    // +tdd removed: its test plan is inactive — no tests-in-code check and no planned-not-in-code finish warning.
    const u9 = S.createFeature(c9, "Untested", ["tdd"]);
    w9f(u9.dir, "tasks.md", "# Tasks\n\n## Phase: Build\n- [x] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-11_\n");
    w9f(u9.dir, "test-plan.md", "| Test ID | Kind | Covers |\n|---|---|---|\n| T-11 | example | US-1.AC-1 |\n");
    const u9Before = S.specDoctor(c9, "untested").checks.some((c) => c.id === "tests-in-code") && S.finishFeature(c9, "untested").warnings.some((w) => /^planned tests/.test(w));
    S.addTrack(c9, "untested", "tdd", { remove: true });
    ok(u9Before && !S.specDoctor(c9, "untested").checks.some((c) => c.id === "tests-in-code") && !S.finishFeature(c9, "untested").warnings.some((w) => /^planned tests/.test(w)),
      "after add_track --remove tdd the inactive test plan raises no tests-in-code check and no planned-not-in-code finish warning");

    // --- review round: one small project per finding ---
    const fx9 = (n) => { const p = path.join(tmp, "proj-wp9-" + n); S.initProject(p, ["tdd"]); return p; };
    const REQ9 = "# Feature: X\n\n## User Stories\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN a token expires THE SYSTEM SHALL reject it.\n";
    const TPH9 = "| Test ID | Layer | Kind | Description | Covers | File |\n|---|---|---|---|---|---|\n";
    const DONE9 = (tids) => `# Tasks\n\n## Phase: Build\n- [x] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Makes green: ${tids}_\n`;

    // Without the hyphen a T-ID needs an UPPERCASE T and a zero-padded number: test_t2_is_after_t1 / test_t0_is_epoch are
    // pytest names about time variables — they used to pass T-02's tests-in-code check and report a phantom T-0.
    const k9 = fx9("clock");
    const kf9 = S.createFeature(k9, "Clock", ["tdd"]);
    w9f(kf9.dir, "requirements.md", REQ9);
    w9f(kf9.dir, "tasks.md", DONE9("T-02"));
    w9f(kf9.dir, "test-plan.md", TPH9 + "| T-02 | unit | example | x | US-1.AC-1 | `x` |\n");
    w9f(k9, "tests/test_clock.py", "def test_t2_is_after_t1():\n    assert t2 > t1\n\ndef test_t0_is_epoch():\n    pass\n\ndef testT2(x):\n    pass\n");
    const kc9 = S.traceCheck(k9, "clock", { code: true }).code;
    const kd9 = S.specDoctor(k9, "clock").checks.find((c) => c.id === "tests-in-code");
    ok(JSON.stringify(kc9.testsInCode) === "{}" && kc9.plannedNotInCode.join() === "T-02" && kc9.inCodeNotInPlan.length === 0 && kd9 && kd9.status === "warn" && /: T-02 — /.test(kd9.detail),
      "test_t2_… / test_t0_… / testT2 are not T-IDs: T-02 stays planned-not-in-code (doctor warns), no phantom T-0 (got " + JSON.stringify(kc9) + ")");
    w9f(k9, "tests/test_clock.py", "def test_T02_rejects_a_stale_clock():\n    pass\n");
    ok(S.traceCheck(k9, "clock", { code: true }).code.testsInCode["T-02"].join() === "tests/test_clock.py", "the documented test_T02_ form still names T-02");

    // Test files in F# / Scala / Groovy / Elixir / Dart are read (by name: CodecTests.fs, CodecSpec.scala, codec_test.exs …).
    const g9 = fx9("langs");
    const gf9 = S.createFeature(g9, "Codec", ["tdd"]);
    w9f(gf9.dir, "requirements.md", REQ9);
    w9f(gf9.dir, "test-plan.md", TPH9 + ["T-01", "T-02", "T-03", "T-04", "T-05"].map((t) => `| ${t} | unit | property | round trip | US-1.AC-1 | \`x\` |`).join("\n") + "\n");
    w9f(g9, "src/CodecTests.fs", "[<Property(DisplayName = \"T-01 round trip\")>]\nlet ``T-01 round trip`` (s: string) = decode (encode s) = s\n");
    w9f(g9, "modules/codec/CodecSpec.scala", "class CodecSpec extends AnyFlatSpec { \"T-02 round trip\" should \"hold\" in {} }\n");
    w9f(g9, "lib/codec_test.exs", "test \"T-03 round trip\" do\nend\n");
    w9f(g9, "pkg/codec_test.dart", "test('T-04 round trip', () {});\n");
    w9f(g9, "src/CodecSpec.groovy", "def \"T-05 round trip\"() { expect: true }\n");
    w9f(g9, "src/shader.fs", "// T-06 a fragment shader, not a test\n");
    const gc9 = S.traceCheck(g9, "codec", { code: true }).code;
    ok(gc9.plannedNotInCode.length === 0 && gc9.scanned === 5 && gc9.testsInCode["T-01"].join() === "src/CodecTests.fs" && gc9.testsInCode["T-02"].join() === "modules/codec/CodecSpec.scala" &&
      gc9.testsInCode["T-03"].join() === "lib/codec_test.exs" && gc9.testsInCode["T-04"].join() === "pkg/codec_test.dart" && gc9.testsInCode["T-05"].join() === "src/CodecSpec.groovy" && !gc9.testsInCode["T-06"],
      "F# / Scala / Elixir / Dart / Groovy test files are scanned; a non-test .fs file is not (got " + JSON.stringify(gc9) + ")");

    // +tdd removed: the inactive test plan no longer covers (or cites) EC / NFR / SC — only tasks and quickstart.md do.
    const o9 = fx9("offtdd");
    const of9b = S.createFeature(o9, "Probe", ["tdd"]);
    w9f(of9b.dir, "requirements.md", REQ9 + "\n## Edge Cases\n- **EC-1** — a clock skew of 5 s is tolerated.\n\n## Success Criteria\n- **SC-001** — 99% of refreshes succeed.\n");
    w9f(of9b.dir, "tasks.md", "# Tasks\n\n## Phase: Build\n- [ ] 1. [US1] Reject\n  - _Requirements: US-1.AC-1_\n  - _Makes green: T-01_\n");
    w9f(of9b.dir, "test-plan.md", TPH9 + "| T-01 | unit | example | x | US-1.AC-1, EC-1, SC-001, NFR-9 | `x` |\n");
    const ob9 = S.traceCheck(o9, "probe");
    S.addTrack(o9, "probe", "tdd", { remove: true });
    const oa9 = S.traceCheck(o9, "probe");
    ok(kinds9(ob9) === "phantomSecondary=NFR-9" && oa9.tracks === "core" && kinds9(oa9) === "uncoveredEdgeCases=EC-1 uncoveredSuccessCriteria=SC-001",
      "after add_track --remove tdd the inactive plan's rows neither cover EC-1 / SC-001 nor cite a phantom NFR-9 (got " + kinds9(oa9) + ")");

    // The feature's own .specs/<f>/tests/ (scaffolded by +tdd) is scanned; another feature's never counts; the rest of the
    // feature folder stays unread.
    const s9 = fx9("specs-tests");
    const sl9 = S.createFeature(s9, "Login", ["tdd"]);
    const sb9 = S.createFeature(s9, "Beta", ["tdd"]);
    for (const f of [sl9, sb9]) {
      w9f(f.dir, "requirements.md", REQ9);
      w9f(f.dir, "tasks.md", DONE9("T-01, T-02, T-03"));
      w9f(f.dir, "test-plan.md", "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-1 |\n| T-03 | US-1.AC-1 |\n");
    }
    w9f(sl9.dir, "tests/unit/login.test.js", "test(\"T-01 valid login (US-1.AC-1)\", () => {});\ntest(\"T-02 wrong password\", () => {});\ntest(\"T-03 latency\", () => {});\n");
    w9f(sl9.dir, "notes.test.js", "test(\"T-99 not under tests/\", () => {});\n");
    const slc9 = S.traceCheck(s9, "login", { code: true }).code;
    const sbc9 = S.traceCheck(s9, "beta", { code: true }).code;
    const sld9 = S.specDoctor(s9, "login").checks.find((c) => c.id === "tests-in-code");
    const sbd9 = S.specDoctor(s9, "beta").checks.find((c) => c.id === "tests-in-code");
    ok(slc9.plannedNotInCode.length === 0 && slc9.testsInCode["T-01"].join() === ".specs/login/tests/unit/login.test.js" && slc9.acsInTests.join() === "US-1.AC-1" &&
      slc9.scanned === 1 && !slc9.testsInCode["T-99"] && sld9.status === "pass" && !S.finishFeature(s9, "login").warnings.some((w) => /^planned tests/.test(w)),
      "tests in .specs/login/tests/ count for Login (doctor passes, finish has no planned-not-in-code warning); .specs/login/notes.test.js is not read (got " + JSON.stringify(slc9) + ")");
    ok(sbc9.plannedNotInCode.join() === "T-01,T-02,T-03" && JSON.stringify(sbc9.testsInCode) === "{}" && sbc9.acsInTests.length === 0 && sbd9.status === "warn",
      "Login's .specs tests never satisfy Beta's T-01..T-03 nor its AC (another feature's scaffolded test folder is theirs)");

    // A secondary ID covered on ANY row of the T-ID: a list item's sub-bullets / lazy continuation, or a second table.
    const r9 = fx9("plan-rows");
    const rf9 = S.createFeature(r9, "Adv", ["tdd"]);
    w9f(rf9.dir, "requirements.md", REQ9 + "2. **US-1.AC-2** — WHEN a key rotates THE SYSTEM SHALL keep old tokens for 60 s.\n\n## Success Criteria\n- **SC-001** — 99% of logins succeed.\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 latency ≤ 300 ms.\n\n## Edge Cases\n- **EC-1** — a clock skew of 5 s is tolerated.\n");
    w9f(rf9.dir, "tasks.md", "# Tasks\n\n## Phase: Build\n- [ ] 1. [US1] Build\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01, T-02_\n");
    w9f(rf9.dir, "test-plan.md", "# Test Plan\n\n- **T-01** — valid login\n  - Covers: US-1.AC-1, SC-001\n- **T-02** — latency, covers US-1.AC-2\nand the skew window EC-1\n\n  - Covers: NFR-1\n\nProse about NFR-9 is not a test row.\n");
    const rl9 = S.traceCheck(r9, "adv");
    w9f(rf9.dir, "test-plan.md", "| Test ID | Covers |\n|---|---|\n| T-01 | US-1.AC-1 |\n| T-02 | US-1.AC-2, EC-1 |\n\n## Non-functional checks\n\n| Test ID | Check | Covers |\n|---|---|---|\n| T-02 | p95 | NFR-1, SC-001 |\n");
    const rt9 = S.traceCheck(r9, "adv");
    ok(rl9.verdict === "pass" && rl9.warnings.length === 0 && rt9.verdict === "pass" && rt9.warnings.length === 0,
      "EC/NFR/SC on a list item's sub-bullet / lazy continuation, or on a T-ID's row in a second table, are covered; prose isn't a row (got " + kinds9(rl9) + " | " + kinds9(rt9) + ")");

    // A concrete File cell scopes the T-ID to that file / folder (project- or feature-relative): another feature's T-01
    // test no longer passes it. A template slot or a non-test artifact falls back to the project-wide number match.
    const f9 = fx9("scoped");
    S.createFeature(f9, "Alpha", ["tdd"]);
    const fb9 = S.createFeature(f9, "Beta", ["tdd"]);
    w9f(fb9.dir, "requirements.md", REQ9);
    w9f(fb9.dir, "tasks.md", DONE9("T-01, T-02, T-03, T-04, T-05"));
    w9f(fb9.dir, "test-plan.md", TPH9 + "| T-01 | unit | example | x | US-1.AC-1 | `tests/beta.test.js` |\n| T-02 | unit | example | x | US-1.AC-1 | `tests/unit/...` |\n" +
      "| T-03 | unit | example | x | US-1.AC-1 | `tests/beta/` |\n| T-04 | unit | example | x | US-1.AC-1 | `tests/unit/beta.test.js::test_T04` |\n| T-05 | load | example | x | US-1.AC-1 | `load-test.md` |\n");
    w9f(f9, "tests/alpha.test.js", ["T-01", "T-02", "T-03", "T-04", "T-05"].map((t) => `test("${t} alpha", () => {});`).join("\n") + "\n");
    const fc9 = S.traceCheck(f9, "beta", { code: true }).code;
    const fd9 = S.specDoctor(f9, "beta").checks.find((c) => c.id === "tests-in-code");
    ok(fc9.plannedNotInCode.join() === "T-01,T-03,T-04" && !fc9.testsInCode["T-01"] && fc9.testsInCode["T-02"].join() === "tests/alpha.test.js" && fc9.testsInCode["T-05"].join() === "tests/alpha.test.js" &&
      fd9.status === "warn" && /: T-01, T-03, T-04 — put the T-ID in the test name .*File column/.test(fd9.detail),
      "Alpha's tests don't satisfy Beta's T-01 / T-03 / T-04 (concrete File cells); T-02 (template slot) and T-05 (load-test.md) match by number (got " + JSON.stringify(fc9) + ")");
    w9f(f9, "tests/beta.test.js", "test(\"T-01 beta\", () => {});\n");
    w9f(f9, "tests/beta/rotate.test.js", "test(\"T-03 beta\", () => {});\n");
    w9f(fb9.dir, "tests/unit/beta.test.js", "test(\"T-04 beta\", () => {});\n");
    const fc9b = S.traceCheck(f9, "beta", { code: true }).code;
    ok(fc9b.plannedNotInCode.length === 0 && fc9b.testsInCode["T-01"].join() === "tests/beta.test.js" && fc9b.testsInCode["T-03"].join() === "tests/beta/rotate.test.js" &&
      fc9b.testsInCode["T-04"].join() === ".specs/beta/tests/unit/beta.test.js" && S.specDoctor(f9, "beta").checks.find((c) => c.id === "tests-in-code").status === "pass",
      "the named file, a file under the named folder and the feature-relative path (with a ::test suffix) satisfy the scoped T-IDs; doctor passes");
    const fp9 = S.createFeature(f9, "Pagamentos", ["tdd"], undefined, undefined, "pt");
    w9f(fp9.dir, "test-plan.md", "| Test ID | Camada | Tipo | Descrição | Cobre (AC IDs) | Ficheiro |\n|---|---|---|---|---|---|\n| T-01 | unit | example | x | US-1.AC-1 | `tests/pagamentos.test.js` |\n");
    const fpc9 = S.traceCheck(f9, "pagamentos", { code: true }).code;
    ok(fpc9.plannedNotInCode.join() === "T-01" && JSON.stringify(fpc9.testsInCode).indexOf("T-01") === -1 &&
      /no ficheiro que a coluna Ficheiro do plano indica/.test(S.msg("pt").deepTrace.testsInCodeMissing("T-01")),
      "PT: a concrete Ficheiro cell scopes T-01 too (Alpha's / Beta's T-01 tests don't satisfy it); the PT advice names the Ficheiro column");

    // Round 2: the File cell matches whole path segments at the end of the test's path — a bare file name and a path
    // relative to a monorepo package satisfy the T-ID; a partial name doesn't; a file the scan never reads scopes nothing.
    const sx9 = fx9("suffix");
    const sxl9 = S.createFeature(sx9, "Login", ["tdd"]);
    w9f(sxl9.dir, "requirements.md", REQ9);
    w9f(sxl9.dir, "tasks.md", DONE9("T-01, T-02, T-03, T-04"));
    w9f(sxl9.dir, "test-plan.md", TPH9 + "| T-01 | unit | example | x | US-1.AC-1 | `login.test.ts` |\n| T-02 | unit | example | x | US-1.AC-1 | `tests/unit/session.test.ts` |\n" +
      "| T-03 | unit | example | x | US-1.AC-1 | `token.test.ts` |\n| T-04 | load | example | x | US-1.AC-1 | `tests/load/checkout-load.md` |\n");
    w9f(sx9, "src/auth/login.test.ts", "test(\"T-01 rejects an expired token\", () => {});\n");
    w9f(sx9, "packages/api/tests/unit/session.test.ts", "test(\"T-02 keeps the session\", () => {});\n");
    w9f(sx9, "src/auth/oldtoken.test.ts", "test(\"T-03 not this one\", () => {});\n");
    w9f(sx9, "tests/load/checkout.k6.js", "// T-04 load test\n");
    const sxc9 = S.traceCheck(sx9, "login", { code: true }).code;
    const sxd9 = S.specDoctor(sx9, "login").checks.find((c) => c.id === "tests-in-code");
    ok(sxc9.testsInCode["T-01"].join() === "src/auth/login.test.ts" && sxc9.testsInCode["T-02"].join() === "packages/api/tests/unit/session.test.ts" &&
      sxc9.testsInCode["T-04"].join() === "tests/load/checkout.k6.js" && sxc9.plannedNotInCode.join() === "T-03" && sxd9.status === "warn" && /: T-03 — /.test(sxd9.detail),
      "a bare file name and a package-relative File cell satisfy T-01 / T-02; `token.test.ts` doesn't match oldtoken.test.ts; a .md under tests/ scopes nothing (got " + JSON.stringify(sxc9) + ")");
    ok(/columna Archivo \(o Fichero\) del plan/.test(S.msg("es").deepTrace.testsInCodeMissing("T-01")) &&
      /\| Fichero \|/.test(fs.readFileSync(path.join(S.createFeature(sx9, "Fallo", ["tdd"], undefined, undefined, "es", "bugfix").dir, "test-plan.md"), "utf8")),
      "ES advice names both spellings of the column (the ES bugfix plan says Fichero, the feature plan Archivo)");
  }
  // @wp WP9 <<<

  // @wp WP10 tests >>>
  // @wp WP10 <<<

  // @wp WP11 tests >>>
  // @wp WP11 <<<

  // @wp DOCS tests >>>
  // Prose regressions: the skill must describe the engine honestly (loops tick with evidence, examples
  // pass its own linter), stay compact, and every user-facing surface must agree with it.
  const docsRead = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
  const docsRef = (f) => docsRead("skills", "dev-spec-driven", "references", f);
  const docsSkill = docsRead("skills", "dev-spec-driven", "SKILL.md");
  const docsDesc = ((docsSkill.match(/^description: >\r?\n([\s\S]*?)\r?\n---/m) || [])[1] || "").split(/\r?\n/).map((l) => l.trim()).join(" ").trim();
  ok(docsDesc.length > 200 && docsDesc.length < 1024 && /Not for trivial edits, requirements\.txt/.test(docsDesc) && /antes de começar a programar/.test(docsDesc) &&
    /antes de empezar a programar/.test(docsDesc) && !/^## When to use this skill/m.test(docsSkill) && !/\| Replaces \|/.test(docsSkill) && !/^\*\*One sentence:\*\*/m.test(docsSkill),
    `SKILL.md description is trilingual, scoped ("Not for …") and < 1024 chars (${docsDesc.length}); no in-body trigger list, Replaces column or closing summary`);
  const docsLoops = (docsSkill.split("## Phase 6")[1] || "").split("Track-gated")[0];
  ok(["**core task", "**+tdd task", "**+ai generation/prompt task"].every((k) => /spec_complete_task \{evidence\}/.test(((docsLoops.split(k)[1] || "").split("\n- **")[0]))),
    "every Phase 6 execution loop (core, +tdd, +ai) ends in spec_complete_task {evidence}");
  const docsUnwanted = (docsSkill.match(/^\| Unwanted \| IF…THEN \| (.+) \|\r?$/m) || [])[1] || "";
  ok(/ shall /.test(docsUnwanted) && S.earsValidate("1. **US-1.AC-1** — " + docsUnwanted).issues.length === 0 && !/user-friendly error message/.test(docsRef("ears-guide.md")),
    "the SKILL.md EARS IF…THEN example passes the plugin's own linter; ears-guide's canonical example is measurable");
  ok(/real defect[^\n]*\/spec-bugfix/.test(docsSkill) && /Bounded/.test(docsRef("classification-matrix.md")) && /\/spec-bugfix/.test(docsRef("classification-matrix.md")) &&
    /Bounded/.test(docsRef("bugfix.md")) && /\*\*After Phase 0 approval:\*\* `spec_init \{tracks, lang\}` if steering is missing, then\s+`spec_create \{name, tracks, lang\}` \*\*once\*\*/.test(docsSkill),
    "mode routing sends a real defect to /spec-bugfix and knows Bounded (SKILL, matrix, bugfix.md); spec_init → spec_create once, after Phase 0 approval");
  ok(/`spec_doctor` only checks that the section is there/.test(docsSkill) && /always scaffolds `quickstart\.md`/.test(docsSkill) && !/^\| Tool \|/m.test(docsSkill) &&
    (docsRef("tooling-reference.md").match(/^\| `(?:spec_|ears_|trace_|steering_)/gm) || []).length >= 22,
    "SKILL.md claims are honest (constitution check = section presence; quickstart/checklist always scaffolded); the tool table lives in tooling-reference.md");
  const docsTools = ["spec_init", "spec_classify", "spec_create", "spec_list", "spec_status", "spec_next_task", "spec_complete_task", "ears_validate", "trace_check",
    "spec_doctor", "spec_approve", "steering_scaffold", "spec_roadmap", "spec_backlog", "spec_depend", "spec_scan", "spec_coverage", "spec_clarify",
    "spec_next_action", "spec_add_track", "spec_feature", "spec_task_brief", "spec_finish"];
  const docsReadme = docsRead("README.md");
  const docsTables = ["## English", "## Português", "## Español"].map((h) => new Set([...((docsReadme.split("\n" + h + "\n")[1] || "").split("\n## ")[0])
    .matchAll(/^\| (`[a-z_]+`(?: \/ `[a-z_]+`)*) \|/gm)].flatMap((m) => m[1].match(/[a-z_]+/g))));
  ok(docsTables.every((s) => docsTools.every((t) => s.has(t)) && [...s].every((t) => list.result.tools.some((x) => x.name === t))) &&
    !/path-filled/.test(docsReadme) && ["## Português", "## Español"].every((h) => { const sec = docsReadme.split("\n" + h + "\n")[1].split("\n## ")[0];
      return /\/plugin marketplace add/.test(sec) && /node cli\/test-cli\.js/.test(sec) && /--subagents/.test(sec) && /_Verify:/.test(sec); }),
    "README: EN/PT/ES tool tables list all 23 tools (no phantom); PT/ES carry subagents, evidence, marketplace install and the CLI test line");
  const docsRules = [[path.join(".cursor", "rules", "dev-spec-driven.mdc"), "cursor"], [path.join(".windsurf", "rules", "dev-spec-driven.md"), "windsurf"],
    [path.join(".github", "copilot-instructions.md"), "copilot"], ["GEMINI.md", "gemini"], ["AGENTS.md", "agents"]];
  const docsAgents = docsRead("AGENTS.md");
  // `rules <tool>` copies these files verbatim and makes only a BARE `cli/dev-spec.js` absolute, so the note must
  // stay true in the generated copy (no "relative to the clone") and no path may carry a prefix like `<clone>/`.
  ok(docsRules.every(([f, tool]) => { const t = docsRead(f); return /^> Paths in this file point into the dev-spec-driven clone\. `node cli\/dev-spec\.js rules /m.test(t) &&
    !/relative to the dev-spec-driven clone/.test(t) && !/[\w./<>-]cli\/dev-spec\.js/.test(t) && t.includes("cli/dev-spec.js rules " + tool) && /no pull requests/i.test(t) &&
    !/\b(?:[Tt]he|[Tt]his|[Oo]ur) repo(?:sitory)?\b/.test(t); }) &&
    !/(?<!skills\/dev-spec-driven\/)references\//.test(docsAgents) && ["next-action", "add-track", "feature", "backlog", "rules"].every((c) => new RegExp("^dev-spec " + c + " ", "m").test(docsAgents)) &&
    /rules <tool>/.test(docsRead("INTEGRATIONS.md")) && /ABSOLUTE\/PATH\/TO/.test(docsRead("INTEGRATIONS.md")) && !/Pre-filled config files/.test(docsRead("INTEGRATIONS.md")),
    "rule files + AGENTS.md: a note that survives `rules <tool>`, bare CLI paths, no pull requests, no text about 'the repo' (false in the copy); AGENTS.md paths prefixed + CLI list complete; INTEGRATIONS admits the placeholder");
  const docsIntegr = docsRead("INTEGRATIONS.md");
  ok(["mkdir -p .cursor/rules && node", "mkdir -p .windsurf/rules && node", "mkdir -p .github && node", "New-Item -ItemType Directory -Force .cursor\\rules",
    "cmd /c 'node \"<PLUGIN>\\cli\\dev-spec.js\" rules cursor > .cursor\\rules\\dev-spec-driven.mdc'"].every((s) => docsIntegr.includes(s)) &&
    /PowerShell 5\.1[^\n]*\n?[^\n]*UTF-16/.test(docsIntegr) && /INTEGRATIONS\.md[^\n]*\n?[^\n]*UTF-16/.test(docsRead("INSTALL.md")),
    "INTEGRATIONS: `rules <tool>` redirects create the folder first; PowerShell goes through `cmd /c` (a bare `>` in 5.1 writes UTF-16)");
  const docsStep = (n) => (docsAgents.split("\n" + n + ". **")[1] || "").split("\n")[0];
  ok(/for a task whose `_Verify:_` names a runnable command, a text note alone/.test(docsStep(6)) && /`_Verify: <command>_` always/.test(docsStep(5)) &&
    /`_Verify: <command>_` always/.test(docsRead("commands", "createTask.md")) && /target tests/.test(docsRead("commands", "createTask.md")) &&
    ((docsRef("example-spec-combined.md").split("## tasks.md")[1] || "").split("\n---")[0].match(/_Verify: /g) || []).length === 7 &&
    /\*\*Constitution\*\*[^\n]*constitution\.md/.test(docsRead("commands", "prReview.md")) && /`\/prReview` \| [^|\n]*constitution/.test(docsSkill),
    "_Verify:_ is an always-marker in AGENTS.md step 5, /createTask and the combined example; a note verifies only a non-runnable task; /prReview checks the constitution");
  const docsInstall = docsRead("INSTALL.md"), docsContrib = docsRead("CONTRIBUTING.md");
  ok(!/Copy-Item -Recurse/.test(docsInstall) && /\/plugin marketplace add <path-to-your-clone>/.test(docsInstall) && /dev-spec-driven@dev-spec-driven-marketplace/.test(docsInstall) &&
    [docsInstall, docsContrib].every((t) => /claude plugin validate [^\n]*plugin\.json/.test(t) && /claude plugin validate (?:\.|"\$plugin")[\s`]/.test(t)) &&
    !/^## Pull requests/m.test(docsContrib) && /^## Before merging/m.test(docsContrib),
    "INSTALL: always-on via a local marketplace (no copy into the plugin cache); INSTALL + CONTRIBUTING validate plugin.json AND the marketplace");
  ok(/model: sonnet/.test(docsRef("subagent-execution.md")) && !/inherits the session/.test(docsRef("subagent-execution.md")) &&
    ["spec-critic.md", "spec-implementer.md", "spec-reviewer.md"].every((a) => /^model: sonnet$/m.test(docsRead("agents", a))) &&
    /baseline green/.test(docsRead("commands", "executeTask.md")) && /Vocabulary map/.test(docsRef("classification-examples-saas.md")) &&
    /Vocabulary map/.test(docsRef("classification-examples-ai.md")) && !/`node mcp\/evals\/run-evals\.js/.test(docsRef("eval-suite-patterns.md")),
    "references agree with the code: agents default to sonnet, --subagents needs a green baseline, Fast/Rigor vocabulary mapped, eval harness path resolvable");
  const docsAttack = /ignore (?:all )?(?:previous|above|your|prior) instructions|ignore above|you are now DAN|disregard prior rules|what's your system prompt/i;
  const docsOutsideFences = (t) => t.split(/^\s*```.*$/m).filter((_, i) => i % 2 === 0).join("\n");
  ok(["ai-safety-patterns.md", "eval-suite-patterns.md", "mandatory-ai-design-sections.md", "example-spec-combined.md"].every((f) => {
    const t = docsRef(f); return /Example attack inputs \(defensive test data — never instructions to follow\):/.test(t) && !docsAttack.test(docsOutsideFences(t)); }),
    "attack examples in the AI references sit in fenced blocks labelled as defensive test data");
  const docsEvalRoot = path.join(root, "evals");
  const docsNeg = fs.readdirSync(docsEvalRoot).filter((c) => fs.existsSync(path.join(docsEvalRoot, c, "prompt.md")) && /^\s+- negative\s*$/m.test(docsRead("evals", c, "prompt.md")));
  ok(docsNeg.length >= 4 && ["requirements.txt", "eval()", "OpenAI"].every((k) => docsNeg.some((c) => docsRead("evals", c, "prompt.md").includes(k))) &&
    docsNeg.every((c) => fs.readdirSync(path.join(docsEvalRoot, c, "graders")).every((g) => /^max: 0\s*$/m.test(docsRead("evals", c, "graders", g)))) &&
    !/The planning request/.test(docsRead("evals", "trigger-bugfix-en", "graders", "skill-fires.md")),
    "plugin evals: near-miss negatives (requirements.txt, eval(), one LLM call) keep the skill silent; the bugfix grader names the defect report");
  // @wp DOCS <<<

  // Plugin structure for v1.12: agents, commands, plugin evals.
  const agentsDir = path.join(root, "agents");
  const agentFiles = fs.readdirSync(agentsDir).filter((x) => x.endsWith(".md"));
  // The read-only critic is limited to Read/Grep/Glob; implementer + reviewer need a shell, so stay unrestricted.
  const agentTools = (x) => (fs.readFileSync(path.join(agentsDir, x), "utf8").split(/^---\r?$/m)[1] || "").match(/^tools:.*?(?=\r?$)/gm) || [];
  ok(agentFiles.sort().join() === "spec-critic.md,spec-implementer.md,spec-reviewer.md" &&
    agentTools("spec-critic.md").join() === "tools: Read, Grep, Glob" &&
    ["spec-implementer.md", "spec-reviewer.md"].every((x) => agentTools(x).length === 0),
    "3 plugin agents: the critic is read-only (tools: Read, Grep, Glob); implementer + reviewer keep every tool");
  const cmdFiles = fs.readdirSync(path.join(root, "commands")).filter((x) => x.endsWith(".md"));
  ok(cmdFiles.length === 35 && ["spec-bugfix.md", "spec-finish.md", "spec-review-feedback.md"].every((x) => cmdFiles.includes(x)), "35 commands incl. /spec-bugfix, /spec-finish, /spec-review-feedback");
  const evalRoot = path.join(root, "evals");
  const evalCases = fs.readdirSync(evalRoot, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== "results").map((e) => e.name);
  ok(evalCases.length >= 5 && evalCases.every((c) => fs.existsSync(path.join(evalRoot, c, "prompt.md")) &&
    fs.readdirSync(path.join(evalRoot, c, "graders")).some((g) => /input_match: '"skill":\\s\*"dev-spec-driven:\[\\w-\]\+"'/.test(fs.readFileSync(path.join(evalRoot, c, "graders", g), "utf8")))),
    "plugin evals: every case has prompt.md + a grader with an intact regex");

  // Owner's cost rule: the plugin never steers users toward pull requests or CI.
  // Scans every prose surface a user or agent reads (not CHANGELOG.md — that is history).
  const walkFiles = (p) => fs.statSync(p).isDirectory() ? fs.readdirSync(p).flatMap((x) => walkFiles(path.join(p, x))) : [p];
  const proseFiles = ["commands", path.join("skills", "dev-spec-driven"), "agents", "evals", "integrations"]
    .flatMap((d) => walkFiles(path.join(root, d)).filter((p) => p.endsWith(".md")))
    .concat([path.join(".cursor", "rules"), path.join(".windsurf", "rules")].flatMap((d) => walkFiles(path.join(root, d))))
    .concat(["README.md", "AGENTS.md", "CONTRIBUTING.md", "INSTALL.md", "INTEGRATIONS.md", "GEMINI.md", path.join(".github", "copilot-instructions.md")].map((f) => path.join(root, f)));
  // Negations are dropped before matching. `no` is ambiguous: the English/Spanish negator ("no PRs", "(no CI)")
  // or the European-Portuguese contraction em+o ("o delta de eval no PR" = IN the PR). So a plural is always a
  // negation, but a singular `no PR`/`no CI` only after punctuation or at a line start; right after a word it
  // reads as PT and is flagged (write "…, no CI" or use never/without). never/not/without/sem/sin/nunca/nem/
  // ni/não may sit up to 3 words before the noun ("never run in CI", "not in the PR", "never open a PR") — but
  // no window word may invert it ("never skip opening a PR", "never bypass the CI gate" steer), and a window
  // never swallows "CI gate" ("merge without the CI gate" steers too).
  const negWord = String.raw`(?:\s+(?!(?:skip|bypass|forg[eo]t|ignor|omit|avoid|disabl|remov|circumvent|unless|until|before|without|salt[aeo]|esquec|olvid|evit|desativ|desactiv|contorn|antes))[A-Za-zÀ-ÿ0-9'’-]+)`;
  const negWindow = String.raw`\b(?:not|never|without|sem|sin|nunca|nem|ni|não|neither|nor)${negWord}{0,3}?\s+(?:PRs?|pull requests?|CI(?!\s+gate))\b`;
  const negTail = (no) => String.raw`(?:\s*(?:,|or|and|nor|ou|o|e|y)\s*${no ? String.raw`(?:no\s+)?` : ""}(?:paid\s+)?CI\b)?`;
  const negations = [String.raw`\bno\s+(?:PRs|pull requests)\b`, String.raw`(?<![A-Za-zÀ-ÿ0-9_]\s*)\bno\s+(?:paid\s+)?(?:PR|pull request|CI)\b`, negWindow]
    .map((r) => new RegExp(r + negTail(true), "gi"));
  const dropNegations = (t) => negations.reduce((s, re) => s.replace(re, ""), t);
  // PT prose (README's `## Português` block) is read as PT: there `no` is always em+o, so only the window negates
  // (PT negates with não/sem/nem) and a sentence-initial "No PR, inclui…" / "Depois, no CI, …" steers.
  const ptNegation = new RegExp(negWindow + negTail(false), "gi");
  const ptNoRe = /(?<![\p{L}\p{N}_])[Nn]os?\s+(?:PRs?|[Pp]ull [Rr]equests?|CI)\b/u;
  const PR = "(?:PR|[Pp]ull [Rr]equest)";
  const steersRe = new RegExp([
    String.raw`\b(?:[Oo]pen|[Cc]reate|[Ss]ubmit|[Rr]aise|[Ff]ile)(?:s|ed|ing)?\b[^.\n]{0,20}?\b${PR}s?\b`,
    String.raw`\b(?:abr(?:e|ir|a|as|es)|cri(?:a|ar|e)|crea|crear)\b[^.\n]{0,15}?\b${PR}s?\b`, // PT/ES open/create
    String.raw`\b(?:[Ee]very|[Ee]ach|[Cc]ada) (?:prompt )?${PR}\b`, String.raw`\bPR comment`, String.raw`\bPR #\d`,
    String.raw`\bPRs? (?:is|are) blocked`, String.raw`\bPR-friendly`, String.raw`\b[Ii]n (?:the |a |your |each |every )?${PR}\b`,
    String.raw`\b[Ee]n (?:el |un |cada )?${PR}\b`, String.raw`[A-Za-zÀ-ÿ]\s+nos?\s+(?:${PR}s?|CI)\b`, // ES "en el PR", PT "no PR"/"nos PRs"
    String.raw`\b[Pp]ush(?:es|ing)? and open`, String.raw`\bCI gate`, String.raw`\b[Ii]n (?:the |your |a |our )?CI\b`, String.raw`\b[Oo]n CI\b`,
    String.raw`\b[Ee]n (?:el |la )?CI\b`,
  ].join("|"));
  const steers = (t, pt) => { const u = pt ? t.replace(ptNegation, "") : dropNegations(t); return steersRe.test(u) || (!!pt && ptNoRe.test(u)); };
  const readmePath = path.join(root, "README.md");
  const proseParts = proseFiles.map((p) => { const t = fs.readFileSync(p, "utf8"); const m = p === readmePath && t.match(/\n## Português\r?\n([\s\S]*?)\r?\n## Español\r?\n/);
    return m ? [p, t.replace(m[1], ""), m[1]] : [p, t, ""]; });
  const readmePt = (proseParts.find(([p]) => p === readmePath) || [])[2] || "";
  const steersToPr = proseParts.filter(([, t, pt]) => steers(t) || steers(pt, true)).map(([p]) => p);
  const guardMissed = ["in the PR", "Prompt PRs are blocked", "git/PR-friendly", "Open a pull request", "push and open one", "on every PR", "a CI gate", "runs in CI",
    "Põe o delta de eval no PR.", "Os testes de carga correm no CI.", "Incluye el delta de evals en el PR.", "Depois, abrir o PR com o resumo.", "comenta nos PRs",
    "Then create a pull request with the summary.", "Push the branch and open a new PR.", "Run the load test in your CI pipeline.", "Every pull request must include evals.",
    "Fix: PR #1234 adds index.", "Never skip the CI gate.", "Do not skip the CI gate before merging.", "Never bypass the CI gate.", "Never skip opening a PR.",
    "Never forget to open a PR.", "Never merge without the CI gate.", "Never merge before opening a PR."].filter((s) => !steers(s))
    .concat(["No PR, inclui o delta de evals.", "Depois, no PR, inclui o delta de evals.", "No CI corre a suite completa.", "Quando terminares: no PR, cola o resumo.",
      "Nos PRs, cola o resumo."].filter((s) => !steers(s, true)));
  const guardFlagged = ["no PR or CI needed", "no pull requests, no CI", "never open a PR", "without a PR", "sem PR", "sin PR", "no PRs or CI", "locally, not in CI",
    "/prReview", "comments on PRs", "Evals are never run in CI.", "Keep the summary local, not in the PR.", "Do not create a pull request.", "(no CI, no extra service)",
    "Automatización local, no CI", "Automação local, não CI", "sem pull requests, sem CI", "No PR needed.", "merge locally; no PRs",
    "**No GitHub Actions / no paid CI / no pull requests**", "a PRD", "the CIA"].filter((s) => steers(s))
    .concat(["sem pull requests, sem CI", "Automação local, não CI", "Nunca abras um PR.", "sem PR nem CI", "Tudo local: sem GitHub Actions, sem CI pago, sem pull requests.",
      "Nota: o PRD e a CIA."].filter((s) => steers(s, true)));
  ok(guardMissed.length === 0 && guardFlagged.length === 0,
    "the PR/CI guard catches EN/PT/ES steering and allows negations (missed: " + guardMissed.join(" | ") + "; wrongly flagged: " + guardFlagged.join(" | ") + ")");
  ok(steersToPr.length === 0 && readmePt.length > 1000 && S.finishFeature(vDir, "login-loop").message.indexOf("PR") === -1,
    "no command/skill/agent text steers toward PRs or CI; README's PT block is read as PT (found: " + steersToPr.map((p) => path.relative(root, p)).join(", ") + ")");

  // Release hygiene: the three version fields agree.
  const vRoot = path.join(__dirname, "..");
  const vPkg = require(path.join(vRoot, "package.json")).version;
  const vPlugin = JSON.parse(fs.readFileSync(path.join(vRoot, ".claude-plugin", "plugin.json"), "utf8")).version;
  const vMkt = JSON.parse(fs.readFileSync(path.join(vRoot, ".claude-plugin", "marketplace.json"), "utf8")).plugins[0].version;
  ok(vPkg === vPlugin && vPlugin === vMkt, `package.json / plugin.json / marketplace.json versions agree (${vPkg} / ${vPlugin} / ${vMkt})`);

  finished = true;
  child.stdin.end();
  console.log(`\n${pass} passed, ${fail} failed`);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  process.exit(fail ? 1 : 0);
})();
