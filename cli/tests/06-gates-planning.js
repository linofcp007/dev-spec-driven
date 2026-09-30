"use strict";
// Gates at the planning phases, the bugfix root-cause task, add-track tdd rows, removed ACs, eval sets.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
  const S16 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const w16 = path.join(tmp, "wp16");
  S16.initProject(w16, ["core"], "en");
  const at16 = (slug, rel) => path.join(w16, ".specs", slug, rel);
  const REQ16 = "# Feature: Digest\n\n## Summary\nWeekly digest.\n\n### US-1 (P1 — MVP): Digest\n#### Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN the weekly job runs THE SYSTEM SHALL email each active account a digest.\n2. **US-1.AC-2** — IF an account has no activity THEN THE SYSTEM SHALL skip the email.\n\n" +
    "## Success Criteria\n- **SC-001** — 95% delivered within 1 hour.\n";

  // doctor at the design gate: the untouched tasks.md template's references are deferred (▲), never "✗ … (typos?)"; exit 0.
  S16.createFeature(w16, "Weekly digest", ["core"]);
  fs.writeFileSync(at16("weekly-digest", "requirements.md"), REQ16);
  fs.writeFileSync(at16("weekly-digest", "design.md"), "# Design: Digest\n\n## Overview\nA weekly job.\n\n## Constitution Check\n- [x] Principle 1 — complies\n");
  const doc16 = run(["doctor", "weekly-digest", "--project", w16]);
  ok(doc16.code === 0 && /readyToAdvance=true/.test(doc16.out) && /▲ traceability — not traced yet — still a later phase's template: tasks\.md/.test(doc16.out) && !/✗ traceability|\(typos\?\)/.test(doc16.out),
    "doctor at the design gate (CLI): the template tasks.md's AC references are deferred (▲ not traced yet), readyToAdvance=true, exit 0");

  // bugfix: ticking the root-cause task with Root Cause empty warns; the next refusal says the section is empty (not "do task 2 first").
  run(["bugfix", "Login crash", "--summary", "Login crashes on accented emails", "--project", w16]);
  const d2 = run(["done", "login-crash", "2", "--project", w16]);
  const d3 = run(["done", "login-crash", "3", "--evidence", "red", "--project", w16]);
  ok(d2.code === 0 && /⚠ Task 2 is ticked, but bug\.md → Root Cause is still empty — write the root cause there/.test(d2.out) &&
    d3.code === 1 && /Task 3 can't be completed yet: bug\.md → Root Cause is still empty — task 2 is ticked, but its deliverable is that section/.test(d3.out) && !/do task 2 first/.test(d3.out),
    "bugfix (CLI): done on the root-cause task with Root Cause empty warns; a later task's refusal names the empty section, never 'do task 2 first' for a ticked task");

  // add-track tdd after the requirements exist: rows from the feature's own ACs.
  S16.createFeature(w16, "Order cancel", ["core"]);
  fs.writeFileSync(at16("order-cancel", "requirements.md"), REQ16.replace("### US-1", "### US-1").replace("## Success Criteria", "### US-3 (P2): Notify\n#### Acceptance Criteria (EARS)\n1. **US-3.AC-1** — WHEN a digest bounces THE SYSTEM SHALL flag the account.\n\n## Success Criteria"));
  const addT16 = run(["add-track", "order-cancel", "tdd", "--project", w16]);
  const rows16 = (fs.readFileSync(at16("order-cancel", "test-plan.md"), "utf8").match(/^\| T-\d+ \|[^|]*\|[^|]*\|[^|]*\| ([^|]*) \|/gm) || []).map((r) => r.split("|")[5].trim()).join();
  ok(addT16.code === 0 && rows16 === "US-1.AC-1,US-1.AC-2,US-3.AC-1" && run(["trace", "order-cancel", "--json", "--project", w16]).out.includes('"phantomAcsInTests": []'),
    "add-track tdd (CLI) on written requirements: one test-plan row per real AC, no phantom template row (got " + rows16 + ")");

  // A removed AC: impact --reopen unticks nothing for it (retire), doctor names the change request instead of "typos?".
  S16.createFeature(w16, "Billing", ["core"]);
  const reqB16 = REQ16.replace("## Success Criteria", "### US-2 (P2): Export\n#### Acceptance Criteria (EARS)\n1. **US-2.AC-1** — WHEN an admin exports THE SYSTEM SHALL produce a CSV.\n\n## Success Criteria");
  fs.writeFileSync(at16("billing", "requirements.md"), reqB16);
  fs.writeFileSync(at16("billing", "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Send\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n- [ ] 2. [US2] CSV export\n  - _Requirements: US-2.AC-1_\n");
  S16.completeTask(w16, "billing", 1, { summary: "checked" });
  S16.completeTask(w16, "billing", 2, { summary: "checked" });
  S16.approvePhase(w16, "billing", "requirements", undefined, { force: true });
  fs.writeFileSync(at16("billing", "requirements.md"), REQ16);
  const im16 = run(["impact", "billing", "--project", w16]);
  const ro16 = run(["impact", "billing", "--reopen", "--project", w16]);
  const drB16 = run(["doctor", "billing", "--project", w16]);
  ok(/Removed criteria still cited — US-2\.AC-1 → tasks #2: don't redo those tasks/.test(im16.out) && !/To untick the affected done tasks/.test(im16.out) &&
    ro16.code === 0 && /Change request #1 recorded — nothing unticked: a removed criterion's tasks are not redone/.test(ro16.out) &&
    /- \[x\] 2\. \[US2\] CSV export/.test(fs.readFileSync(at16("billing", "tasks.md"), "utf8")) &&
    /✗ traceability — tasks still cite ACs a change request removed \(delete or update those tasks — not a typo\): US-2\.AC-1 \(change request #1\)/.test(drB16.out),
    "impact (CLI) on a removed AC: retire hint, --reopen records the change request without unticking its task; doctor names the change request, not 'typos?'");

  // Eval sets: a malformed item fails the dry run (exit 1, one line per item) — the CLI forwards to the harness.
  const ai16 = path.join(tmp, "wp16-ai");
  S16.initProject(ai16, ["ai"], "en");
  S16.createFeature(ai16, "Ticket summary", ["ai"]);
  fs.writeFileSync(path.join(ai16, ".specs", "ticket-summary", "evals", "regression.json"), JSON.stringify({ items: [{ id: "r1", input: "x", expect: { type: "contain", value: "x" } }] }));
  const ev16 = spawnSync(process.execPath, [CLI, "evals", "ticket-summary", "--dry-run", "--project", ai16], { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: "" } });
  ok(ev16.status === 1 && /✗ regression\.json — item r1: unknown grader type 'contain' \(use contains \| equals \| regex \| refuse \| judge\)/.test(ev16.stdout) &&
    /Dry run found invalid eval set\(s\)/.test(ev16.stdout) && !/sets are valid/.test(ev16.stdout),
    "evals --dry-run (CLI): a malformed item is an invalid set — exit 1, named with its reason, never 'sets are valid'");
  // --max-items 0 (or a bare / non-numeric one) is a usage error the CLI passes through — exit 2, no 0/0 = 100% and no
  // baseline, even with a key set (nothing is called: it is refused before any set is read).
  fs.rmSync(path.join(ai16, ".specs", "ticket-summary", "evals", "regression.json"));
  const evMax16 = spawnSync(process.execPath, [CLI, "evals", "ticket-summary", "--max-items", "0", "--set-baseline", "--project", ai16], { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: "dummy" } });
  ok(evMax16.status === 2 && /Invalid argument\(s\): --max-items must be an integer ≥ 1 \(got "0"\)/.test(evMax16.stderr) && !/100\.0%|all sets pass/.test(evMax16.stdout) &&
    !fs.existsSync(path.join(ai16, ".specs", "ticket-summary", "evals", "baseline.json")),
    "evals --max-items 0 (CLI): exit 2 with the argument error — never 0/0 = 100% 'all sets pass', no baseline written");
  // The switches the CLI forwards follow its own rule (help: "--flag=true|false … anything else is an error"):
  // --set-baseline=false used to overwrite baseline.json. A fetch stub (NODE_OPTIONS reaches the harness) keeps it offline.
  const stub16 = path.join(tmp, "stub16-fetch.js");
  fs.writeFileSync(stub16, "globalThis.fetch = async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }], usage: {} }) });\n");
  const base16 = path.join(ai16, ".specs", "ticket-summary", "evals", "baseline.json");
  const evSw16 = (args, key) => {
    const r = spawnSync(process.execPath, [CLI, "evals", "ticket-summary", ...args, "--project", ai16],
      { encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: key, NODE_OPTIONS: "--require " + JSON.stringify(stub16) } });
    r.baseline = fs.existsSync(base16);
    try { fs.rmSync(base16); } catch {}
    return r;
  };
  const sbF16 = evSw16(["--set-baseline=false"], "dummy"), sbT16 = evSw16(["--set-baseline=true"], "dummy");
  const drMb16 = evSw16(["--dry-run=maybe"], "dummy"), rlF16 = evSw16(["--require-live=false"], "");
  ok(/mode: LIVE/.test(sbF16.stdout) && !sbF16.baseline && /mode: LIVE/.test(sbT16.stdout) && sbT16.baseline &&
    drMb16.status === 2 && /Invalid argument\(s\): --dry-run must be a boolean \(true\/false\) \(got "maybe"\)/.test(drMb16.stderr) &&
    rlF16.status === 0 && /DRY-RUN/.test(rlF16.stdout),
    "evals (CLI) switches: --set-baseline=false writes no baseline (=true does), --dry-run=maybe exits 2 with the argument error, --require-live=false without a key dry-runs (got " +
    JSON.stringify([sbF16, sbT16, drMb16, rlF16].map((r) => [r.status, r.baseline, (r.stderr || "").trim().slice(0, 80)])) + ")");

  // bug.md evidence in brackets ([object Object], [A-Z]) is content: doctor documents both sections and approve design passes.
  run(["bugfix", "Profile Name Shows Object", "--summary", "The profile header shows object text", "--project", w16]);
  const bugP16 = at16("profile-name-shows-object", "bug.md");
  fs.writeFileSync(bugP16, fs.readFileSync(bugP16, "utf8").replace(/## Reproduction\n> \*\*TODO\*\*[^\n]*/, "## Reproduction\n1. Log in.\n2. Open /profile: the header reads [object Object].")
    .replace(/## Root Cause\n> \*\*TODO\*\*[^\n]*/, "## Root Cause\nheader.js interpolates the whole user object, so the browser shows [object Object]; norm() only maps [A-Z]."));
  const bugDoc16 = run(["doctor", "profile-name-shows-object", "--project", w16]);
  run(["approve", "profile-name-shows-object", "requirements", "--force", "--project", w16]); // phase by phase: requirements first
  const bugAp16 = run(["approve", "profile-name-shows-object", "design", "--project", w16]);
  ok(/✓ reproduction — reproduction documented/.test(bugDoc16.out) && /✓ root-cause — root cause documented/.test(bugDoc16.out) && !/bug\.md:\d+ \[object Object\]/.test(bugDoc16.out) && bugAp16.code === 0,
    "bugfix (CLI): a Reproduction / Root Cause quoting [object Object] / [A-Z] is documented (doctor ✓) and approve design passes (got " + bugAp16.out.slice(0, 120) + ")");

  // A ```fenced example``` row in test-plan.md covers nothing: trace reports the AC without a real row (exit 1), never PASS.
  S16.createFeature(w16, "Shop fence", ["tdd"]);
  fs.writeFileSync(at16("shop-fence", "requirements.md"), REQ16);
  fs.writeFileSync(at16("shop-fence", "test-plan.md"), "# Test Plan\n\n| ID | AC | File |\n|---|---|---|\n| T-01 | US-1.AC-1 | tests/digest.test.js |\n\n```md\n| T-02 | US-1.AC-2 | tests/skip.test.js |\n```\n");
  fs.writeFileSync(at16("shop-fence", "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Digest\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Makes green: T-01_\n");
  const trF16 = run(["trace", "shop-fence", "--project", w16]);
  ok(trF16.code === 1 && /US-1\.AC-2/.test(trF16.out) && !/verdict=pass/i.test(trF16.out),
    "trace (CLI): a fenced example row in test-plan.md is no coverage — the AC it names is reported uncovered, exit 1 (got " + trF16.out.slice(0, 160) + ")");

  // 1.21 F3: bugfix --reproduction / --root-cause / --condition / --behaviour prefill bug.md and US-1.AC-1 (= spec_create's prefill);
  // --include-body puts the scaffolds' bodies in the --json result; the prefill on a plain feature is refused (exit 1, nothing made).
  const bf21 = run(["bugfix", "Coupon twice", "--project", w16, "--summary", "The coupon applies twice", "--reproduction", "Apply PROMO10 twice; the total reads 81",
    "--root-cause", "applyCoupon() never checks cart.coupons (src/discount.js:12).", "--condition", "the same coupon is applied twice", "--behaviour", "keep one discount",
    "--include-body", "--json"]);
  let j21 = null;
  try { j21 = JSON.parse(bf21.out); } catch { /* reported below */ }
  const bug21 = fs.existsSync(at16("coupon-twice", "bug.md")) ? fs.readFileSync(at16("coupon-twice", "bug.md"), "utf8") : "";
  const ref21 = run(["create", "Not a bug", "--project", w16, "--root-cause", "x"]);
  ok(bf21.code === 0 && j21 && j21.ok && /Apply PROMO10 twice; the total reads 81/.test(bug21) && /^applyCoupon\(\) never checks/m.test(bug21) &&
    /US-1\.AC-1\*\* — IF the same coupon is applied twice THEN THE SYSTEM SHALL keep one discount$/m.test(j21.bodies["requirements.md"]) && j21.bodies["bug.md"] === bug21 &&
    JSON.stringify(j21.prefilled) === JSON.stringify({ "bug.md": ["reproduction", "rootCause", "behaviour"], "requirements.md": ["condition", "behaviour"] }) &&
    ref21.code === 1 && /--root-cause is a bugfix's input/.test(ref21.out) && !fs.existsSync(path.join(w16, ".specs", "not-a-bug")),
    "1.21 F3: dev-spec bugfix --reproduction --root-cause --condition --behaviour prefills bug.md + the IF … THEN criterion, --include-body returns the bodies in --json; refused on a plain feature (got " +
    JSON.stringify({ code: bf21.code, prefilled: j21 && j21.prefilled, ref: ref21.out.slice(0, 160) }) + ")");

  // 1.21 review A8: the CLI's refusals name the FLAG the user typed (--root-cause), never the MCP key (rootCause), and the CLI's own
  // way to make a bugfix (the runnable `bugfix` line); a too-long --condition names --condition. MCP keeps its keys (mcp/tests/06-gates.js).
  const refA8 = run(["create", "Not a bug either", "--project", w16, "--root-cause", "x", "--json"]);
  let jA8 = null;
  try { jA8 = JSON.parse(refA8.out); } catch { /* reported below */ }
  const longA8 = run(["bugfix", "Long cond", "--project", w16, "--condition", "x".repeat(501)]);
  const I = require(path.join(__dirname, "..", "mcp", "lib", "i18n.js"));
  ok(refA8.code === 1 && jA8 && jA8.ok === false && /^--root-cause is a bugfix's input — create it as a bugfix: /.test(jA8.error) && !/rootCause/.test(jA8.error) &&
    jA8.error.includes(I.DEV_SPEC + ' bugfix "<name>" --root-cause') && longA8.code === 1 && /--condition must be one line of at most 500 characters/.test(longA8.out) &&
    !fs.existsSync(path.join(w16, ".specs", "not-a-bug-either")) && !fs.existsSync(path.join(w16, ".specs", "long-cond")),
    "1.21 review A8: on the CLI a bugfix input given to a plain feature is refused naming --root-cause (not the MCP key rootCause) and the runnable bugfix command; a too-long --condition names the flag (got " +
    JSON.stringify([jA8 && jA8.error, longA8.out.slice(0, 160)]) + ")");
};
