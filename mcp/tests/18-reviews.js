"use strict";
// Whole-plugin review regressions whose findings span several areas — one assertion per finding.
// A new test goes to the file of its area, not here.

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

exports.run = async ({ ok, rpc, rawOnce, payload, S, root, tmp, SERVER, child, require }) => {

  { // 1.14 C4 — /spec-tour + the fixes from the independent review of the first 1.14 packages.
    const c4Root = path.join(tmp, "proj-c4");
    const c4 = (n) => path.join(c4Root, n);
    const cls = (d, lang) => S.classify(d, lang ? { lang } : {});
    const chk = (doc, id) => doc.checks.find((c) => c.id === id) || {};

    // C4.1 — /spec-tour: a thin command, a short EN description (1.24 review 6: no PT / ES tail — Claude Code's skill-listing budget;
    // the user types it: disable-model-invocation), every gate named, never auto-approves, keep/archive/remove.
    const PRc4 = require("./lib/prompts-resources.js");
    const tourMd = fs.readFileSync(path.join(root, "commands", "spec-tour.md"), "utf8");
    const tourFm = PRc4.parseFrontMatter(tourMd).data;
    const tourGet = PRc4.getPrompt("spec-tour", "add a length check to the signup name", { lang: "en" });
    ok(/10-minute tour/.test(tourFm.description) && !/ PT - | ES - /.test(tourFm.description) && tourFm.description.length <= 150 && tourFm["disable-model-invocation"] === "true" && tourFm["argument-hint"] &&
      ["spec_scan", "spec_classify", "spec_init", "spec_create", "ears_validate", "spec_doctor", "spec_approve", "spec_complete_task", "spec_next_action", "spec_finish", "spec_feature"].every((t) => tourMd.includes("`" + t)) &&
      /1–2 EARS criteria/.test(tourMd) && /exactly \*\*2 tasks\*\*/.test(tourMd) && /real\*\*\s+`_Verify: <command>_`/.test(tourMd) && /each only after the user says yes\*\*; never approve on their behalf/.test(tourMd) &&
      /evidence: \{command, exitCode, summary\}/.test(tourMd) && /confirm: true` only after the user\s+confirms/.test(tourMd) && /action: "archive"/.test(tourMd) &&
      /in the user's language/.test(tourMd) && !/\b(?:PRs?|pull requests?|CI)\b/.test(tourMd) &&
      tourGet.ok && /Change to take through the tour \(optional\): add a length check to the signup name/.test(tourGet.messages[0].content.text),
      "C4.1 /spec-tour: a short EN description (no PT / ES tail), user-invoked only, scan → classify → 1–2 EARS → design → 2 tasks with real _Verify:_ → approvals only on the user's yes → one task with evidence → next_action → finish → keep/archive/remove (confirm); no PR/CI wording; served as a prompt");

    // C4.2.1 — '-compliant' (and -compliance / -certified / -grade) compounds keep the keyword a signal; '-aware' does not.
    const gdprC = cls("A GDPR-compliant signup form"), hipaaC = cls("HIPAA-compliant storage"), socC = cls("SOC2-certified audit export"), gradeC = cls("enterprise-grade SSO");
    ok(gdprC.tracks.includes("privacy") && gdprC.signals.privacy.includes("gdpr") && hipaaC.tracks.includes("privacy") && socC.tracks.includes("saas") && gradeC.tracks.includes("saas") &&
      cls("Ship the .claude-plugin manifest").tracks.join() === "core" && !cls("Fix the author-name field").signals.tdd.length &&
      cls("Session-aware routing for the load balancer").signals.tdd.length === 0 && cls("PCI-compliance report").tracks.includes("saas"),
      "C4.2.1 classify: 'GDPR-compliant' / 'HIPAA-compliant' turn +privacy on, 'SOC2-certified' / 'enterprise-grade' +saas (they were core only); '-<letter>' identifiers (claude-plugin, author-name) stay rejected (" +
      [gdprC, hipaaC, socC, gradeC].map((r) => r.label).join(" · ") + ")");

    // C4.2.2 — EN / PT / ES aligned: consent-family words, encryption in transit, security testing.
    const consEs = cls("Registrar el consentimiento del usuario para el boletín"), consPt = cls("Registar o consentimento do utilizador para a newsletter"), consEn = cls("Record the user's consent for the newsletter");
    const trEs = cls("Cifrado en tránsito para la API de pagos"), trPt = cls("Cifragem em trânsito na API de pagamentos"), trEn = cls("Encryption in transit for the payments API");
    const stEs = cls("Pruebas de seguridad de la API de subida"), stPt = cls("Testes de segurança da API de carregamento"), stEn = cls("Security testing of the upload API");
    ok([consEs, consPt, consEn].every((r) => !r.tracks.includes("privacy") && r.possible.some((p) => p.track === "privacy")) &&
      consEs.signals.privacy.includes("consentimiento") && consPt.signals.privacy.includes("consentimento") && consEn.signals.privacy.includes("consent") &&
      [trEs, trPt, trEn, stEs, stPt, stEn].every((r) => r.tracks.includes("sec") && !r.weak.includes("sec")) &&
      trEs.signals.sec.includes("cifrado en tránsito") && trPt.signals.sec.includes("cifragem em trânsito") && stEs.signals.sec.includes("prueba de seguridad") && stPt.signals.sec.includes("teste de segurança") &&
      cls("Consentimiento explícito y datos personales").tracks.includes("privacy"),
      "C4.2.2 classify: consent / consentimento / consentimiento are the same (weak) signal in EN / PT / ES; cifrado en tránsito / cifragem em trânsito and pruebas de seguridad / testes de segurança are strong like their EN twins (" +
      [consEs, trEs, trPt, stEs, stPt].map((r) => r.label).join(" · ") + ")");

    // C4.2.3 — no +privacy / +sec (and its mandatory sections) from one generic word.
    const soft = cls("Soft-delete with a 30-day retention period for trashed files"), oauthC = cls("Google sign-in with an OAuth consent screen"), arch = cls("Admin can set a retention period for archived projects");
    const stride = cls("array stride"), perm = cls("file permission bits"), both = cls("array stride and file permission bits");
    const strideTm = cls("STRIDE threat model for the upload API"), strideAlone = cls("Run STRIDE on the upload flow"), rbacPerm = cls("Login with a password, RBAC permissions for admins");
    const negPerm = cls("No permission checks are needed here"), corroborated = cls("Retention period and consent records for account deletion");
    ok([soft, oauthC, arch].every((r) => !r.tracks.includes("privacy") && r.possible.some((p) => p.track === "privacy" && /retention period|consent/.test(p.signal))) &&
      oauthC.tracks.includes("tdd") && corroborated.tracks.includes("privacy") && corroborated.weak.includes("privacy"),
      "C4.2.3 classify: 'retention period' / 'consent' alone → only a 'possible +privacy' note (was core +privacy with 6 mandatory sections); two privacy signals together still turn it on (" + [soft, oauthC, arch, corroborated].map((r) => r.label).join(" · ") + ")");
    ok([stride, perm, both].every((r) => !r.tracks.includes("sec") && !r.signals.sec.length && !r.possible.some((p) => p.track === "sec") && !r.notes.some((n) => /\+sec/.test(n))) &&
      strideTm.tracks.includes("sec") && strideTm.signals.sec.includes("STRIDE") && strideTm.signals.sec.includes("threat model") && strideAlone.possible.some((p) => p.track === "sec" && p.signal === "STRIDE") &&
      rbacPerm.tracks.includes("sec") && rbacPerm.signals.sec.includes("permission") && !negPerm.notes.some((n) => /\+sec/.test(n)) &&
      S.trackSignals("sec").context.includes("permission") && !S.trackSignals("sec").weak.includes("permission") && !S.trackSignals("sec").weak.includes("stride"),
      "C4.2.3 classify: 'array stride' / 'file permission bits' (alone or together) give no +sec signal or note; upper-case STRIDE is the methodology (weak; strong with 'threat model'); 'permission' corroborates another +sec signal (RBAC permissions) but is no evidence alone, negated or not (" +
      [both, strideTm, strideAlone, rbacPerm].map((r) => r.label).join(" · ") + ")");
    const mcpC4 = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: "A GDPR-compliant signup form with an array stride", projectDir: c4("mcp") } }));
    ok(mcpC4.label === "core +privacy" && !mcpC4.signals.sec.length, "C4.2.1/3 spec_classify (MCP) = the engine (" + mcpC4.label + ")");

    // C4.2.4 — track markers are case-sensitive: `### Timeout [sec]` is no [SEC] section.
    const legacy = S.createFeature(c4("markers"), "Timeouts", ["core"], "", undefined, "en");
    fs.appendFileSync(path.join(legacy.dir, "design.md"), "\n### Timeout [sec]\n30\n\n### Budget [saas]\n5\n");
    fs.appendFileSync(path.join(legacy.dir, "requirements.md"), "\n### Limits [privacy]\n- [TBD]\n");
    const lst = JSON.parse(fs.readFileSync(path.join(legacy.dir, ".state.json"), "utf8"));
    delete lst.tracks; // a pre-1.13 feature: the tracks are inferred from its files
    fs.writeFileSync(path.join(legacy.dir, ".state.json"), JSON.stringify(lst, null, 2));
    const upper = S.createFeature(c4("markers"), "Upper", ["core"], "", undefined, "en");
    fs.appendFileSync(path.join(upper.dir, "design.md"), "\n## [SEC] Threat Model\nSTRIDE per element.\n");
    const ust = JSON.parse(fs.readFileSync(path.join(upper.dir, ".state.json"), "utf8"));
    delete ust.tracks;
    fs.writeFileSync(path.join(upper.dir, ".state.json"), JSON.stringify(ust, null, 2));
    const reqPh = S.featurePlaceholders(c4("markers"), legacy.slug, "requirements.md").items.map((x) => x.text);
    ok(S.detectTracks(legacy.dir).join() === "core" && S.detectTracks(upper.dir).join() === "core,sec" && reqPh.some((x) => /TBD/.test(x)) &&
      S.extractSection("## Threat Model [sec]\nx\n## [SEC] Threat Model\ny\n", ["threat model"], "[SEC]").trim() === "y",
      "C4.2.4 markers are case-sensitive: a legacy feature with '### Timeout [sec]' / '### Budget [saas]' stays core (was +sec +saas), '## [SEC] …' still infers +sec, a '[privacy]'-suffixed requirements section is no longer hidden while +privacy is off (its [TBD] is reported), the exact marker wins in extractSection (got " +
      S.detectTracks(legacy.dir).join() + " / " + JSON.stringify(reqPh) + ")");

    // C4.2.5 — a deleted [PRIVACY] heading is not satisfied by an unrelated core heading.
    const pv = S.createFeature(c4("sections"), "Accounts", ["privacy"], "", undefined, "en");
    const pvDesign = path.join(pv.dir, "design.md");
    const filledDesign = fs.readFileSync(pvDesign, "utf8").split(/\r?\n/).map((l) => (/^\s*>\s*\*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n")
      .replace(/\[([^\]\n]*)\]/g, (m, x) => (/^(?:PRIVACY|SEC|SaaS|AI|x| )$/.test(x) ? m : "filled"));
    fs.writeFileSync(pvDesign, filledDesign);
    const pvFilled = chk(S.specDoctor(c4("sections"), pv.slug), "privacy-sections");
    fs.writeFileSync(pvDesign, filledDesign.replace(/## \[PRIVACY\] Processors & International Transfers\n/, "") + "\n## Processors and queues\nBullMQ workers.\n");
    const pvDeleted = chk(S.specDoctor(c4("sections"), pv.slug), "privacy-sections");
    fs.writeFileSync(pvDesign, filledDesign.replace(/## \[PRIVACY\] Processors & International Transfers\n/, "## [PRIVACY] Processing\n\n### Processors\nStripe (US, SCCs).\n"));
    const pvNested = chk(S.specDoctor(c4("sections"), pv.slug), "privacy-sections");
    const RET = { syn: ["retention & deletion", "retention", "conservação", "conservação e eliminação"], loose: ["retention", "conservação"] };
    ok(pvFilled.status === "pass" && pvDeleted.status === "fail" && /Processors & International Transfers:missing/.test(pvDeleted.detail) && pvNested.status === "pass" &&
      S.extractSection("## Retention\nx\n", RET.syn, "[PRIVACY]", RET.loose) === null && S.extractSection("## Conservação de ficheiros\nx\n", RET.syn, "[PRIVACY]", RET.loose) === null &&
      S.extractSection("## Retention & Deletion\nx\n", RET.syn, "[PRIVACY]", RET.loose).trim() === "x" && S.extractSection("## [PRIVACY] Retention\nx\n", RET.syn, "[PRIVACY]", RET.loose).trim() === "x" &&
      S.extractSection("## Observability\nm\n", ["observability"], "[SaaS]").trim() === "m",
      "C4.2.5 extractSection: a generic synonym ('Processors', 'Retention', 'Conservação …') on an unmarked core heading no longer satisfies a [PRIVACY] section (doctor fails 'Processors & International Transfers:missing' — it passed); under a [PRIVACY] heading or spelled unambiguously it still does; unmarked SaaS headings unchanged (" +
      pvDeleted.detail + ")");

    // C4.2.6 — the _Verify:_ pipe check: pipefail must really be set BEFORE the pipe; scripts handed to a shell; a Windows path's trailing "\".
    const vpC4 = S.verifyPipeMasked;
    const pipeYes = ["set +o pipefail; npm test | tee log", "npm test | tee pipefail.log", "npm test | tee log # pipefail later", "npm test | tee log; set -o pipefail",
      'bash -c "npm test | tee log"', "sh -c 'pytest | tee out'", 'pwsh -Command "npm test | Tee-Object log"', 'powershell -NoProfile -c "a | b"', 'cmd /c "npm test | more"',
      '"C:\\Program Files\\" | more', 'dir "C:\\" | more', '/usr/bin/env bash -lc "a | b"', 'C:\\Windows\\System32\\cmd.exe /s /c "a | b"',
      'set -o pipefail; bash -c "npm test | tee log"', "(set -o pipefail); npm test | tee log"];
    const pipeNo = ["set -euo pipefail; npm test | tee log", "set -eo pipefail && pytest | tee out", "set -e -o pipefail; a | b", 'bash -c "set -o pipefail; npm test | tee log"',
      "bash -lc 'set -euo pipefail; npm test | tee log'", 'bash -eo pipefail -c "a | b"', 'node -e "console.log(1|2)"', 'echo "say \\"hi\\" | x"', 'test "$(echo "a|b")" = x',
      'dir "C:\\Program Files\\" && echo ok', 'grep "a|b" file', "echo a^|b", "a \\| b"];
    const vpWrongC4 = pipeYes.filter((c) => !vpC4(c)).map((c) => "missed: " + c).concat(pipeNo.filter((c) => vpC4(c)).map((c) => "flagged: " + c));
    const pp4 = c4("pipes");
    S.initProject(pp4, ["core"], "en");
    const pf4 = S.createFeature(pp4, "Shell pipes", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(pf4.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Wrapped pipe\n  - _Verify: bash -c \"npm test | tee test.log\"_\n- [ ] 2. [US1] Real pipefail\n  - _Verify: set -o pipefail; npm test | tee test.log_\n");
    const c4d = chk(S.specDoctor(pp4, pf4.slug), "verify-pipes");
    const c4done = S.completeTask(pp4, pf4.slug, 1, { command: 'bash -c "npm test | tee test.log"', exitCode: 0 });
    ok(!vpWrongC4.length && c4d.status === "warn" && /#1 /.test(c4d.detail) && !/#2 /.test(c4d.detail) && c4done.ok && c4done.pipeMasked === true,
      "C4.2.6 verifyPipeMasked: only a `set -o pipefail` run BEFORE the pipe (or the shell's -o pipefail) silences it — not the word (set +o pipefail, tee pipefail.log, a comment); a pipe inside bash -c / sh -c / pwsh -Command / cmd /c is flagged; a Windows path ending in \\ before the closing quote no longer hides the pipe; doctor + spec_complete_task follow (" +
      vpWrongC4.join(" · ") + ")");

    // C4.2.7 — the server survives a client that closes its read end first: EPIPE → quiet exit 0; another stdout error → one stderr line, exit 1.
    const runServer = (stdio, drive) => new Promise((resolve) => {
      const kid = spawn(process.execPath, [SERVER], { env: { ...process.env, SPEC_PROJECT_DIR: c4("epipe") }, stdio });
      let err = "";
      kid.stderr.on("data", (d) => (err += d));
      if (kid.stdin) kid.stdin.on("error", () => {});
      const timer = setTimeout(() => { kid.kill(); resolve({ code: "timeout", err }); }, 10000);
      kid.on("close", (code) => { clearTimeout(timer); resolve({ code, err }); });
      drive(kid);
    });
    const req = (id) => JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list", params: {} }) + "\n";
    const epipe = await runServer(["pipe", "pipe", "pipe"], (kid) => {
      kid.stdout.once("data", () => {
        kid.stdout.destroy(); // the client closes its read end, then keeps talking
        let n = 0;
        const t = setInterval(() => {
          if (++n > 15 || kid.exitCode !== null) { clearInterval(t); try { kid.stdin.end(); } catch {} return; }
          try { kid.stdin.write(req(100 + n)); } catch {}
        }, 20);
      });
      kid.stdin.write(req(1));
    });
    const roFile = path.join(tmp, "c4-readonly-stdout.txt");
    fs.writeFileSync(roFile, "");
    const roFd = fs.openSync(roFile, "r");
    const badFd = await runServer(["pipe", roFd, "pipe"], (kid) => { kid.stdin.write(req(1)); setTimeout(() => { try { kid.stdin.end(); } catch {} }, 1500); });
    fs.closeSync(roFd);
    ok(epipe.code === 0 && !/Unhandled|EPIPE|at /.test(epipe.err) && badFd.code === 1 && /^dev-spec MCP server: stdout error: /.test(badFd.err) && !/Unhandled 'error' event|\n\s+at /.test(badFd.err),
      "C4.2.7 mcp/server.js: a client closing its read end first → quiet exit 0 (was an unhandled EPIPE stack trace, exit 1); a non-EPIPE stdout error (read-only fd) → one stderr line and exit 1 (got " +
      JSON.stringify([epipe.code, epipe.err.slice(0, 120), badFd.code, badFd.err.slice(0, 120)]) + ")");
  }

  // 1.14 final review — one regression per confirmed finding (engine, security, pt-BR).
  {
    const fr = path.join(tmp, "proj-final-review");
    S.initProject(fr, ["core"], "en");
    const mkF = (name, tasks) => { const c = S.createFeature(fr, name, ["core"], "x", undefined, "en"); fs.writeFileSync(path.join(c.dir, "tasks.md"), tasks); return c; };
    // E1: a could-not-run exit on an _Expect: fail_ task keeps the red run on record — the pass after the fix still verifies it.
    mkF("Red keep", "# Tasks\n\n- [ ] 1. [US1] Write T-01 red\n  - _Verify: npm test_\n  - _Expect: fail_\n- [ ] 2. [US1] Implement\n  - _Verify: npm test_\n");
    const r1 = S.completeTask(fr, "red-keep", 1, { command: "npm test", exitCode: 1 });
    S.completeTask(fr, "red-keep", 2, { command: "npm test", exitCode: 0 });
    const r127 = S.completeTask(fr, "red-keep", 1, { command: "npm test", exitCode: 127 });
    const v127 = S.statusFeature(fr, "red-keep").tasks.list.find((t) => t.number === 1).verified;
    const rPass = S.completeTask(fr, "red-keep", 1, { command: "npm test", exitCode: 0 });
    ok(r1.ok && r1.verified && r127.ok === false && v127 === false && rPass.ok === true && rPass.verified === true,
      "final review E1: an exit 127 re-run of an _Expect: fail_ task is a failed re-check but keeps the red proof — the next (fixed, passing) run verifies it again, never unexpected-pass forever (got " +
      JSON.stringify([r1.verified, r127.ok, v127, rPass.ok, rPass.verified, rPass.unverifiedReason, rPass.error && rPass.error.slice(0, 80)]) + ")");
    // E4: an empty plan is nothing to import (no feature created).
    fs.mkdirSync(path.join(fr, "docs"), { recursive: true });
    fs.writeFileSync(path.join(fr, "docs", "empty.md"), "  \n\n");
    const imp = S.importSpec(fr, "plan", "docs/empty.md");
    ok(imp.ok === false && !fs.existsSync(path.join(fr, ".specs", "empty")), "final review E4: importing a blank plan answers 'nothing found' and creates no feature (got " + JSON.stringify([imp.ok, imp.error]) + ")");
    // S1: the Stop gate counts only activity the engine recorded — a fresh tasks.md (a clone) or a future stamp never makes it
    // fire, and its reason never hands the agent a `--run` command.
    const sg = mkF("Stop clone", "# Tasks\n\n- [x] 1. [US1] Ship\n  - _Verify: node evil.js_\n");
    const claim = "I fixed the typo in README. All done.";
    const sClone = S.stopCheck(fr, { message: claim });
    const sgState = path.join(sg.dir, ".state.json");
    const sgSt = JSON.parse(fs.readFileSync(sgState, "utf8"));
    fs.writeFileSync(sgState, JSON.stringify({ ...sgSt, lastTickAt: "2099-01-01T00:00:00.000Z" }, null, 2));
    const sFuture = S.stopCheck(fr, { message: claim });
    fs.writeFileSync(sgState, JSON.stringify({ ...sgSt, lastTickAt: new Date().toISOString() }, null, 2));
    const sNow = S.stopCheck(fr, { message: claim });
    const reasons = ["en", "pt", "es", "pt-BR"].map((l) => { const G = S.msg(l).stopGate; return G.todoTasks("f", 1) + G.todoSuite("f"); });
    ok(sClone.block === false && sFuture.block === false && sNow.block === true && !/--run/.test(sNow.reason) && reasons.every((t) => !/--run/.test(t)),
      "final review S1: stop gate — a hand-fresh tasks.md or a future lastTickAt is no recent activity; a real recent tick still blocks, and no reason (EN/PT/ES/pt-BR) suggests `--run` (got " +
      JSON.stringify([sClone.why, sFuture.why, sNow.block]) + ")");
    // S2: a planted private-use sentinel never makes the pt-BR transform expand (it used to double the string per pass).
    const tS2 = Date.now();
    const planted = S.msg("pt-BR").stopGate.taskLine("a00", "x");
    ok(typeof planted === "string" && planted.length < 200 && Date.now() - tS2 < 1000, "final review S2: pt-BR text holding the transform's sentinels is left as it is, in bounded time (got " + JSON.stringify([planted && planted.length, Date.now() - tS2]) + ")");
    // S3: decisions.md / an exported artifact that is a symlink out of the project is never followed.
    const outside = path.join(tmp, "final-review-secret.txt");
    fs.writeFileSync(outside, "TOP-SECRET-KEY");
    const lk = mkF("Linked", "# Tasks\n\n- [ ] 1. [US1] a\n");
    let linked = true;
    try {
      fs.symlinkSync(outside, path.join(lk.dir, "decisions.md"), "file");
      fs.renameSync(path.join(lk.dir, "requirements.md"), path.join(lk.dir, "requirements.orig.md"));
      fs.symlinkSync(outside, path.join(lk.dir, "requirements.md"), "file");
    } catch { linked = false; }
    if (linked) {
      const dz = S.decide(fr, "linked", { title: "t", decision: "d" });
      const ex = S.exportSpecs(fr, { name: "linked", format: "md" });
      const exText = JSON.stringify(ex);
      ok(dz.ok === false && /regular file inside \.specs/.test(dz.error) && fs.readFileSync(outside, "utf8") === "TOP-SECRET-KEY" && fs.lstatSync(path.join(lk.dir, "decisions.md")).isSymbolicLink() &&
        !/TOP-SECRET-KEY/.test(exText), "final review S3: spec_decide refuses a decisions.md symlink (nothing written through it); spec_export never copies a linked artifact's content (got " +
        JSON.stringify([dz.ok, dz.error && dz.error.slice(0, 80), /TOP-SECRET-KEY/.test(exText)]) + ")");
    } else ok(true, "final review S3: symlinks unavailable here (Windows without the privilege) — skipped");
    // S4: long _Implements:_ references never stall the overlap check (SessionStart runs it).
    const longSeg = "a".repeat(120);
    mkF("Long globs", "# Tasks\n\n" + Array.from({ length: 150 }, (_, i) => `- [ ] ${i + 1}. [US1] t\n  - _Implements: src/${longSeg}/**/${longSeg}${i}*/x*.js_\n`).join(""));
    mkF("Long paths", "# Tasks\n\n" + Array.from({ length: 100 }, (_, i) => `- [ ] ${i + 1}. [US1] t\n  - _Implements: src/${longSeg}/${longSeg}/${longSeg}${i}/x.js_\n`).join(""));
    mkF("Too long", "# Tasks\n\n- [ ] 1. [US1] t\n  - _Implements: src/" + "b".repeat(600) + ".js_\n");
    const tS4 = Date.now();
    const ov = S.featureOverlaps(fr);
    ok(Date.now() - tS4 < 3000 && ov.truncated === true, "final review S4: the overlap check is budgeted by work (pattern × path) and a reference over 512 chars is skipped — bounded time, marked truncated (got " + JSON.stringify([Date.now() - tS4, ov.truncated]) + ")");
    // S5 + S6: a long _Verify:_ with many \" and a huge unclosed-emphasis paragraph stay linear.
    const longVerify = "echo \"" + "%\\\"".repeat(20000) + "\"";
    mkF("Long verify", "# Tasks\n\n- [ ] 1. [US1] t\n  - _Verify: " + longVerify + "_\n");
    const tS5 = Date.now();
    S.specDoctor(fr, "long-verify");
    const dS5 = Date.now() - tS5;
    const big = mkF("Big para", "# Tasks\n\n- [ ] 1. [US1] t\n");
    fs.writeFileSync(path.join(big.dir, "requirements.md"), "# Big\n\n## Summary\n" + "a *b _c ~~d **e ".repeat(15000) + "\n");
    const tS6 = Date.now();
    const bigEx = S.exportSpecs(fr, { name: "big-para", format: "html" });
    const dS6 = Date.now() - tS6;
    ok(dS5 < 5000 && bigEx.ok && dS6 < 5000, "final review S5/S6: a 60 KB _Verify:_ full of \\\" and a 240 KB paragraph of unclosed * _ ~~ ** render in bounded time (got " + JSON.stringify([dS5, dS6]) + ")");
    // pt-BR: descriptive 3rd-person verbs stay descriptive; "gerado/arquivado a <date>" → "em".
    const BR = S.msg("pt-BR");
    const brTexts = [BR.gitLog.implFirst(3, "T-01", "abc", "def", "t.js"), BR.gitLog.testNotCommitted(3, "T-01", "abc", "t.js"), BR.flow.kindRefused("erro", "bugfix"), BR.spike.noGate("design", "x")];
    const brDate = require("./lib/i18n.js").toPtBr("_Notas geradas a 2026-09-26_ · arquivada a 2026-09-26");
    ok(!/faça T-01|siga a sua|— siga/.test(brTexts.join(" ")) && /que faz T-01 passar/.test(brTexts[0]) && /que faz T-01 passar/.test(brTexts[1]) && /geradas em 2026-09-26/.test(brDate) && /arquivada em 2026-09-26/.test(brDate),
      "final review pt-BR: 'põe … a verde' / 'segue' stay descriptive (no 'faça' / 'siga'); 'geradas / arquivada a <date>' → 'em' (got " + JSON.stringify(brTexts.map((t) => t.slice(0, 70)).concat(brDate)) + ")");
  }

  // 1.14 full review (R) — regressions the independent review of the merged fixes found: one assertion each.
  {
    // R1: an auxiliary ("was", "había", "havia") never turns an honest failure into history; "not fixed" stays an admission;
    // the noun + done claim must end its clause.
    const adm = (m) => S.stopClaims(m).admitted;
    const honest = ["Task 1 is done. 2 tests failed and I was unable to fix them.", "Task 3 is done, but the build was slow and 2 tests failed.",
      "The 3 failing tests were not fixed.", "La tarea 3 está hecha. Había 2 pruebas fallando.", "A tarefa 3 está feita. Havia 2 testes a falhar."];
    const noClaim = ["The implementation done so far covers task 1.", "Here is the task done list for today."];
    ok(honest.every(adm) && !adm("Done! I fixed the 2 failing tests and everything works now.") && noClaim.every((m) => !S.stopClaims(m).claim) &&
      S.stopClaims("Feature complete.").claim,
      "full review R1: 'was' / 'havia' / 'había' near a failure keep it an admission, a negator anywhere keeps it too; 'the implementation done so far' is no claim (got " +
      JSON.stringify([honest.map(adm), noClaim.map((m) => S.stopClaims(m).claim)]) + ")");
    // R10: the admission / claim scans are linear (bounded look-back and tail).
    const tR10 = Date.now();
    S.stopClaims("was 2 failing. ".repeat(1400));
    S.stopClaims("all done ".repeat(2300));
    const dR10 = Date.now() - tR10;
    ok(dR10 < 1500, "full review R10: 20 KB of admissions or claims scans in bounded time (got " + dR10 + " ms)");
    // R2: another plan's File cell owns only its EXACT path — a monorepo package's same-named test file stays this feature's.
    const r2 = path.join(tmp, "proj-review-r2");
    S.initProject(r2, ["tdd"], "en");
    for (const [n, file] of [["Alpha", "tests/test_api.py"], ["Beta", "services/beta/tests/"]]) {
      const c = S.createFeature(r2, n, ["core", "tdd"], "x", undefined, "en");
      fs.writeFileSync(path.join(c.dir, "test-plan.md"), "# Test plan\n\n| ID | Covers | Kind | File |\n|---|---|---|---|\n| T-01 | US-1.AC-1 | example | `" + file + "` |\n");
    }
    fs.mkdirSync(path.join(r2, "services", "beta", "tests"), { recursive: true });
    fs.writeFileSync(path.join(r2, "services", "beta", "tests", "test_api.py"), "def test_T01_beta():\n    assert True\n");
    const tr2 = S.traceCheck(r2, "beta", { code: true }).code;
    ok(tr2 && (tr2.testsInCode["T-01"] || []).some((f) => /services\/beta\/tests\/test_api\.py$/.test(f)) && !tr2.plannedNotInCode.includes("T-01"),
      "full review R2: alpha's File `tests/test_api.py` doesn't own services/beta/tests/test_api.py — beta's own T-01 is found (got " + JSON.stringify(tr2 && [tr2.testsInCode, tr2.plannedNotInCode]) + ")");
    // R3: a spike whose timebox passed undecided covers nothing; at the scope level a spike never overrides approved plans.
    const r3 = path.join(tmp, "proj-review-r3");
    S.initProject(r3, ["core"], "en", { guard: "on" });
    S.createFeature(r3, "Old spike", undefined, "", undefined, "en", "spike", { question: "Q?", timebox: "2020-01-01" });
    const g3old = S.guardCheck(r3, "src/app.js", r3);
    S.createFeature(r3, "New spike", undefined, "", undefined, "en", "spike", { question: "Q?", timebox: "3d" });
    const g3new = S.guardCheck(r3, "src/app.js", r3);
    S.initProject(r3, ["core"], "en", { guard: "scope" });
    const b3 = S.createFeature(r3, "Billing", ["core"], "x", undefined, "en");
    fs.writeFileSync(path.join(b3.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Bill\n  - _Implements: src/billing.js_\n");
    S.approvePhase(r3, "billing", "tasks", "t", { force: true });
    const g3scope = S.guardCheck(r3, "src/app.js", r3);
    ok(g3old.decision === "ask" && g3new.decision === "allow" && g3new.why === "spike" && g3scope.decision === "ask",
      "full review R3: a spike past its timebox covers nothing, an active one covers prototype edits, and at scope level it never overrides an approved plan (got " +
      JSON.stringify([g3old.decision, g3new.why, g3scope.decision + ":" + g3scope.why]) + ")");
    // R4: create classifies like spec_classify — the text's own language first, meta.lang only when it is inconclusive.
    const r4en = path.join(tmp, "proj-review-r4en"), r4pt = path.join(tmp, "proj-review-r4pt");
    S.initProject(r4en, [], "en");
    S.initProject(r4pt, [], "pt");
    const c4en = S.createFeature(r4en, "desconto", undefined, "Aplicar o desconto no checkout com testes de regressão");
    const k4pt = S.classify("Corrigir o cálculo do IVA no checkout", { projectDir: r4pt });
    const c4pt = S.createFeature(r4pt, "IVA", undefined, "Corrigir o cálculo do IVA no checkout");
    ok(c4en.tracks.includes("tdd") && k4pt.tracks.includes("tdd") && JSON.stringify(k4pt.tracks) === JSON.stringify(c4pt.tracks),
      "full review R4: a PT summary in an EN project is read as PT ('no' = em+o), and create agrees with classify in a PT project (got " +
      JSON.stringify([c4en.tracks, k4pt.tracks, c4pt.tracks]) + ")");
    // R5: an AC ID a list item defines is a reference elsewhere (Notes, a coverage table) — never a criterion to lint.
    const req5 = "# F\n\n## User Stories\n\n### US-1 (P1): Login\n\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user logs in THE SYSTEM SHALL open a session\n2. **US-1.AC-2** — IF the password is wrong THEN THE SYSTEM SHALL show an error\n";
    const e5a = S.earsValidate(req5 + "\n## Notes\nUS-1.AC-2 depends on the identity provider's error codes.\n", "en");
    const e5b = S.earsValidate(req5 + "\n| AC | Priority |\n|---|---|\n| US-1.AC-1 | P1 |\n", "en");
    const e5c = S.earsValidate("# F\n\n### Acceptance Criteria\n| ID | Criterion |\n|---|---|\n| US-1.AC-1 | Checkout is quick |\n", "en");
    ok(e5a.summary.criteriaDetected === 2 && !e5a.issues.some((i) => i.severity === "error") && e5b.summary.criteriaDetected === 2 && !e5b.issues.some((i) => i.severity === "error") &&
      e5c.issues.some((i) => i.code === "no-modal"),
      "full review R5: a Notes line or a coverage table naming a defined AC is a reference, not a criterion; a table that IS the definition is still linted (got " +
      JSON.stringify([e5a.summary.criteriaDetected, e5a.issues.map((i) => i.code), e5b.summary.criteriaDetected, e5c.issues.map((i) => i.code)]) + ")");
    // R6: a genuine red run whose assertion quotes a runner phrase is not "could not run".
    ok(S.couldNotRunOutput("not ok 1 - T-01 loads plugins\n  AssertionError: expected: Cannot find module 'foo-plugin' actual: undefined") === null &&
      S.couldNotRunOutput("Error: Cannot find module '/x/test/a.js'\nRequire stack:\n- /x") !== null,
      "full review R6: an assertion failure quoting 'Cannot find module' is a red run; the runner's own missing-module error still reads could-not-run");
    // R7: a punctuation closer never cuts a value that closes plainly later on the line.
    const v7 = (line) => S.taskMarkers({ text: line, body: [] }).verify[0];
    ok(v7('x _Verify: python -c "import a_; print(1)"_') === 'python -c "import a_; print(1)"' && v7("x _Verify: npm test -- --grep='route_: 200'_") === "npm test -- --grep='route_: 200'" &&
      v7("Wire (_Verify: npm test_).") === "npm test" && S.taskMarkers({ text: "(_Verify: npm test_), _Implements: a.js_", body: [] }).implements[0] === "a.js",
      "full review R7: `_` + punctuation closes a marker only when no plain closer follows before the next marker (got " +
      JSON.stringify([v7('x _Verify: python -c "import a_; print(1)"_'), v7("x _Verify: npm test -- --grep='route_: 200'_"), v7("Wire (_Verify: npm test_).")]) + ")");
    // R9: a client's JSON-RPC response with id null is never answered (the next reply is the malformed line's -32700).
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "client could not parse" } }) + "\n");
    const r9 = await rawOnce("{not json");
    ok(r9 && r9.error && r9.error.code === -32700, "full review R9: a JSON-RPC response with id null gets no reply (got " + JSON.stringify(r9 && r9.error) + ")");
  }
};
