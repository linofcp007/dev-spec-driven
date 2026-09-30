"use strict";
// The CLI surfaces of next-action / impact / approve --through / stop-check, and the guard hook.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// 1.14 full review (Gb) — next_action, doctor, stop gate, guard.
exports.run = ({ ok, run, tmp, __dirname }) => {
  const gbP = (n) => path.join(tmp, "frgb-" + n);
  const gbW = (dir, rel, txt) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), txt); };
  const gbR = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const gbRun = 'node -e "process.exit(0)"';
  // A core feature 'login' whose planning chain is filled (the fast-forward through tasks passes every gate).
  const gbFill = (p) => {
    const dir = path.join(p, ".specs", "login");
    gbW(dir, "classification.md", "# Classification: login\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none, plain feature\n\n## Blast Radius\nLow; only the login page.\n\n## Compliance Tags\nnone\n");
    gbW(dir, "requirements.md", "# Feature: login\n\n## Summary\nUsers log in with email and password.\n\n## User Stories (prioritized — each independently testable)\n\n### US-1 (P1 — MVP): Log in\n" +
      "**As a** user, **I want** to log in, **so that** I see my account.\n**Why P1:** nothing works without it.\n**Independent Test:** Can be fully tested by logging in and delivers access, without the other stories.\n\n" +
      "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n2. **US-1.AC-2** — IF the credentials are wrong THEN THE SYSTEM SHALL show an error\n\n" +
      "## Success Criteria (measurable, technology-agnostic)\n- **SC-001** — 95% of logins complete in under 2 seconds\n\n## Edge Cases & Error Handling\n- **EC-1** — Locked account: show the lock message\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 latency under 300 ms\n\n## Out of Scope\n- Social login\n\n## Assumptions\n- Users already have accounts\n");
    gbW(dir, "design.md", "# Design: login\n\n## Overview\nA form posts to /login; the server checks the hash.\n\n## Architecture\nThe web app calls the auth service.\n\n## Data Models\nUser { id, email, hash }\n\n" +
      "## API Contracts\nPOST /login returns 200 or 401.\n\n## Security Considerations\nHashes use bcrypt.\n\n## Error Handling\nWrong credentials give 401.\n\n## Testing Strategy\n- Unit tests for the handler.\n\n" +
      "## Constitution Check\n- [x] Simplicity — complies\n\n## Complexity Tracking\nNone.\n");
    gbW(dir, "tasks.md", "# Tasks: login\n\n## Global Constraints\n- Node >= 18\n\n## Story US-1 (P1 — MVP)\n" +
      "- [ ] 1. [US1] Implement the login handler (EC-1, NFR-1)\n  - _Requirements: US-1.AC-1_\n  - _Verify: " + gbRun + "_\n" +
      "- [ ] 2. [US1] Show the error message\n  - _Requirements: US-1.AC-2_\n  - _Verify: " + gbRun + "_\n**Checkpoint:** US-1 works.\n");
    return dir;
  };
  const guardHook = (cwd, file) => spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "guard-hook.js")], { encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "PreToolUse", cwd, tool_name: "Write", tool_input: { file_path: path.join(cwd, file), content: "x" } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" } });

  // Gb2: next-action names the execution role to sign as (roadmap.json meta.approvalRoles.execution).
  const p2 = gbP("roles");
  run(["init", "core", "--roles", "execution=qa+product", "--project", p2]);
  run(["create", "login", "core", "--project", p2]);
  gbFill(p2);
  const ff2 = run(["approve", "login", "--through", "tasks", "--project", p2]);
  run(["done", "login", "1", "--run", "--project", p2]);
  run(["done", "login", "2", "--run", "--project", p2]);
  const fin2 = run(["finish", "login", "--write", "--project", p2]);
  const na2 = run(["next-action", "login", "--project", p2]);
  run(["approve", "login", "execution", "--role", "qa", "--project", p2]);
  const na2b = run(["next-action", "login", "--project", p2]);
  ok(ff2.code === 0 && fin2.code === 0 && /\/approve login execution --role qa\./.test(na2.out) && /missing roles: qa, product/.test(na2.out) && /\/approve login execution --role product\./.test(na2b.out),
    "full review Gb2: next-action names the role for the execution sign-off (--role qa, then --role product) — a role-less /approve is refused (got " + JSON.stringify([na2.out.trim().split("\n").pop(), na2b.out.trim().split("\n").pop()]) + ")");

  // Gb11 + Gb12: impact prints the role to re-approve as; a fast-forward stopped by a role says what it approved.
  const p11 = gbP("impact");
  run(["init", "core", "--roles", "requirements=product", "--project", p11]);
  run(["create", "login", "core", "--project", p11]);
  const d11 = gbFill(p11);
  const ff12 = run(["approve", "login", "--through", "tasks", "--project", p11]);
  run(["approve", "login", "--through", "tasks", "--role", "product", "--project", p11]);
  gbW(d11, "requirements.md", gbR(d11, "requirements.md").replace("THE SYSTEM SHALL open a session", "THE SYSTEM SHALL open a session within 2 seconds"));
  const im11 = run(["impact", "login", "--project", p11]);
  ok(im11.code === 0 && /→ review the change, then re-approve: \/approve login requirements --role product/.test(im11.out),
    "full review Gb11: `impact` prints the re-approve command with the role still to sign (--role product) (got " + JSON.stringify(im11.out.trim().split("\n").pop()) + ")");
  ok(ff12.code === 1 && /stopped at 'requirements' \(approved before it: classification\)/.test(ff12.out) && /nothing was recorded for 'requirements'/.test(ff12.out) && !/Nothing recorded/.test(ff12.out),
    "full review Gb12: approve --through stopped by a role refusal says what it approved and that nothing was recorded for the stopping phase — not 'Nothing recorded.' (got " + JSON.stringify(ff12.out.trim()) + ")");

  // Gb4: stop-check never sends a decided spike back over project checks (a spike has none).
  const p4 = gbP("spike");
  run(["init", "core", "--check", "test=" + gbRun, "--project", p4]);
  run(["spike", "cache spike", "--question", "Should we use Redis for the session cache?", "--timebox", "3d", "--project", p4]);
  const sd4 = path.join(p4, ".specs", "cache-spike");
  gbW(sd4, "spike.md", gbR(sd4, "spike.md").replace("> **TODO** — go / no-go / pivot, and why: the evidence that decided it.", "Go: Redis cut p95 latency by 40% in the prototype.").replace("_Outcome: [go | no-go | pivot]_", "_Outcome: go_"));
  for (const n of ["1", "2", "3", "4"]) run(["done", "cache-spike", n, "--project", p4]);
  const sc4 = run(["stop-check", "--message", "The spike is done: the decision is go.", "--project", p4]);
  ok(sc4.code === 0 && !/project checks/.test(sc4.out),
    "full review Gb4: stop-check allows a decided spike's 'done' — project checks are not a spike's gate (got " + JSON.stringify([sc4.code, sc4.out.trim()]) + ")");

  // Gb8 + Gb9 through the guard hook: Phase 4 test files and an active spike's prototype are not asked for; other code still is.
  const p8 = gbP("guard");
  run(["init", "tdd", "--guard", "on", "--project", p8]);
  run(["create", "Shortener", "tdd", "--project", p8]);
  const st8 = path.join(p8, ".specs", "shortener", ".state.json");
  const s8 = JSON.parse(fs.readFileSync(st8, "utf8"));
  s8.approvals = { "test-plan": { at: "2026-09-01T00:00:00.000Z", by: "u" } };
  fs.writeFileSync(st8, JSON.stringify(s8, null, 2));
  const h8t = guardHook(p8, "test/shortener.test.js");
  const h8c = guardHook(p8, "src/shortener.js");
  run(["spike", "cache spike", "--question", "Should we use Redis?", "--project", p8]);
  const h9 = guardHook(p8, "proto/redis.js");
  let h8cJ = null;
  try { h8cJ = JSON.parse(h8c.stdout); } catch { /* not JSON */ }
  ok(h8t.status === 0 && h8t.stdout === "" && h8cJ && h8cJ.hookSpecificOutput.permissionDecision === "ask" && h9.status === 0 && h9.stdout === "",
    "full review Gb8/Gb9: the guard hook stays silent for a test file while a test plan is approved (Phase 4) and for a prototype file while a spike is under way; a code file with no approved tasks still asks (got " +
    JSON.stringify([h8t.stdout, h8cJ && h8cJ.hookSpecificOutput.permissionDecision, h9.stdout]) + ")");
};
