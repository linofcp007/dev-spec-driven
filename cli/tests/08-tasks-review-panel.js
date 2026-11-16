"use strict";
// The review panel (1.36) on the CLI — init --review-models (a list, diverse, off, refused), next-action's finish sentence, --json = the engine's reviewPanel, completion.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, all, runIn, tmp, require, __dirname }) => {
  const SD = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = JSON.stringify;
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const meta = (p) => { try { return JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8")).meta || {}; } catch { return null; } };
  const RM = SD.msg("en").reviewModels;

  { // init --review-models opus,sonnet | "opus sonnet" | diverse | none | off — stored, with the human note; a bad value exits 1
    const p = path.join(tmp, "rp-init");
    SD.initProject(p, ["core"], "en");
    const set = runIn(["init", "--review-models", "opus,sonnet", "--project", p]);
    const setMeta = meta(p).reviewModels;
    const spaced = runIn(["init", "--review-models", "sonnet opus", "--project", p]);
    const spacedMeta = meta(p).reviewModels;
    const div = runIn(["init", "--review-models=diverse", "--project", p]);
    const divMeta = meta(p).reviewModels;
    const none = runIn(["init", "--review-models", "none", "--project", p]);
    const noneMeta = meta(p);
    runIn(["init", "--review-models", "diverse", "--project", p]);
    const offJ = jsonOf(runIn(["init", "--review-models", "OFF", "--json", "--project", p]));
    const offMeta = meta(p);
    runIn(["init", "--review-models", "opus,sonnet", "--project", p]);
    const bad = runIn(["init", "--review-models", "opus", "--project", p]);
    const badJ = jsonOf(runIn(["init", "--review-models", "opus,inherit", "--json", "--project", p]));
    const empty = runIn(["init", "--review-models", "--json", "--project", p]); // a value flag: a following flag is no value
    all("1.36 review panel: init --review-models stores the list (comma or space separated), the word diverse, and none / OFF delete it — each with its note on the human output (--json: spec_init's result); a bad value or no value exits 1, --json with invalid-arguments [reviewModels] (got " +
      js([set, spaced.out, div.out, none.out, offJ, bad, badJ, empty]) + ")", {
      set: () => set.code === 0 && js(setMeta) === '["opus","sonnet"]' && set.out.includes("\n  " + RM.on("opus, sonnet", false) + "\n"),
      spaced: () => spaced.code === 0 && js(spacedMeta) === '["sonnet","opus"]',
      diverse: () => div.code === 0 && divMeta === "diverse" && div.out.includes("  " + RM.on("opus, sonnet", true)),
      none: () => none.code === 0 && !("reviewModels" in noneMeta) && none.out.includes("  " + RM.off),
      offJson: () => offJ && js(offJ.reviewModels) === "[]" && offJ.reviewModelsNote === RM.off && !("reviewModels" in offMeta),
      bad: () => bad.code === 1 && bad.out.includes(RM.bad("opus")) && js(meta(p).reviewModels) === '["opus","sonnet"]',
      badJson: () => badJ && badJ.ok === false && badJ.code === "invalid-arguments" && js(badJ.invalid) === '["reviewModels"]',
      noValue: () => empty.code === 1,
    });
  }

  { // next-action: the finish step's sentence (EN, PT — the feature's language); doctor / next-action --json carry the engine's reviewPanel
    const PASS = 'node -e "process.exit(0)"';
    const CLASS = "# Classification: x\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none, plain feature\n\n## Blast Radius\nLow; only the login page.\n\n## Compliance Tags\nnone\n";
    const REQ = "# Feature: x\n\n## Summary\nUsers log in with email and password.\n\n## User Stories (prioritized — each independently testable)\n\n### US-1 (P1 — MVP): Log in\n" +
      "**As a** user, **I want** to log in, **so that** I see my account.\n**Why P1:** nothing works without it.\n**Independent Test:** Can be fully tested by logging in and delivers access, without the other stories.\n\n" +
      "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n\n" +
      "## Success Criteria (measurable, technology-agnostic)\n- **SC-001** — 95% of logins complete in under 2 seconds\n\n## Edge Cases & Error Handling\n- **EC-1** — Locked account: show the lock message\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 latency under 300 ms\n\n## Out of Scope\n- Social login\n\n## Assumptions\n- Users already have accounts\n";
    const DESIGN = "# Design: x\n\n## Overview\nA form posts to /login.\n\n## Architecture\nThe web app calls the auth service.\n\n## Data Models\nUser { id, email, hash }\n\n" +
      "## API Contracts\nPOST /login returns 200 or 401.\n\n## Security Considerations\nHashes use bcrypt.\n\n## Error Handling\nWrong credentials give 401.\n\n## Testing Strategy\n- Unit tests.\n\n" +
      "## Constitution Check\n- [x] Simplicity — complies\n\n## Complexity Tracking\nNone.\n";
    const TASKS = "# Tasks\n\n## Story US-1 (P1 — MVP)\n- [ ] 1. [US1] Implement the login handler (EC-1, NFR-1, SC-001)\n  - _Requirements: US-1.AC-1_\n  - _Verify: " + PASS + "_\n**Checkpoint:** US-1 works.\n";
    const p = path.join(tmp, "rp-finish");
    SD.initProject(p, ["core"], "en", { reviewModels: ["opus", "sonnet"] });
    const done = (name, lang) => {
      const f = SD.createFeature(p, { name, tracks: ["core"], lang });
      for (const [n, t] of [["classification.md", CLASS], ["requirements.md", REQ], ["design.md", DESIGN], ["tasks.md", TASKS]]) fs.writeFileSync(path.join(f.dir, n), t);
      SD.approvePhase(p, f.slug, null, "u", { through: "tasks" });
      SD.completeTask(p, f.slug, 1, { command: PASS, exitCode: 0 });
      return f.slug;
    };
    const en = done("Login", "en"), pt = done("Entrar", "pt");
    const naEn = runIn(["next-action", en, "--project", p]);
    const naPt = runIn(["next-action", pt, "--project", p]);
    const naJ = jsonOf(runIn(["next-action", en, "--json", "--project", p]));
    const docJ = jsonOf(runIn(["doctor", en, "--json", "--project", p]));
    const engine = SD.specDoctor(p, en).reviewPanel;
    all("1.36 review panel: next-action prints the finish step's branch-review sentence in the feature's language (EN, PT); next-action / doctor --json carry the engine's reviewPanel (got " +
      js([naEn.out, naPt.out, naJ && naJ.reviewPanel, docJ && docJ.reviewPanel]) + ")", {
      en: () => naEn.code === 0 && naEn.out.includes(SD.msg("en").next.reviewBranch(en, "opus, sonnet")),
      pt: () => naPt.code === 0 && naPt.out.includes(SD.msg("pt").next.reviewBranch(pt, "opus, sonnet")),
      nextJson: () => naJ && naJ.step === "finish" && js(naJ.reviewPanel) === js(engine) && js(engine) === '{"models":["opus","sonnet"]}',
      doctorJson: () => docJ && js(docJ.reviewPanel) === js(engine),
    });
  }

  { // completion offers the flag on init and its two words after it (a list is the user's own)
    const bash = runIn(["completion", "bash"]).out, pwsh = runIn(["completion", "powershell"]).out;
    ok(/'init'\) __dev_spec_r='[^']*--review-models /.test(bash) && /'--review-models'\) __dev_spec_r='diverse off'/.test(bash) &&
      /'--review-models' = 'diverse off'/.test(pwsh),
      "1.36 review panel: shell completion offers --review-models on init and diverse / off after it (bash, PowerShell)");
  }
};
