"use strict";
// Lifecycle — the catalog, archive → restore, drift, spec_upgrade, forecasts, overlaps, decisions and spikes.
// SPECS.md and _Supersedes:_, the finish baseline, meta.specVersion, velocity / ETA, decisions.md, the spike kind.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, rpc, payload, S, root, tmp, shipFeature, list, require, __dirname }) => {

  // --- 1.13 WP10: living catalog (SPECS.md, _Supersedes:_), archive → restore round-trip, drift since finish ---
  {
    const call10 = async (name, args) => { const r = await rpc("tools/call", { name, arguments: args }); return { isError: r.result.isError === true, p: payload(r) }; };
    const { spawnSync: spawn10 } = require("child_process");
    const hook10 = (dir) => spawn10(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "SessionStart" }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } }).stdout;
    const w10 = path.join(tmp, "proj-wp10");
    const w10Specs = path.join(w10, ".specs");
    S.initProject(w10, ["core"]);
    const req10 = (dir, f, body) => fs.writeFileSync(path.join(dir, ".specs", f, "requirements.md"), "# Requirements\n\n## Summary\n" + f + " behavior.\n\n### US-1 (P1)\n\n#### Acceptance Criteria (EARS)\n" + body);
    ["Billing", "Billing v2", "Payments", "Accounts"].forEach((n) => S.createFeature(w10, n, ["core"]));
    req10(w10, "billing", "1. **US-1.AC-1** — WHEN a user pays THE SYSTEM SHALL store the receipt\n2. **US-1.AC-2** — WHEN a refund is asked THE SYSTEM SHALL refund within 30 days\n" +
      "3. **US-1.AC-3** — WHEN a card expires THE SYSTEM SHALL email the owner\n");
    // Same-line marker; a wrapped criterion whose marker sits on a sub-line (with a case-different feature name and three
    // bad references); a commented and a fenced marker that must not count.
    req10(w10, "billing-v2", "1. **US-1.AC-1** — WHEN a refund is asked THE SYSTEM SHALL refund within 14 days _Supersedes: billing/US-1.AC-2_\n" +
      "2. **US-1.AC-2** — WHEN a card expires\n   THE SYSTEM SHALL text the owner\n   - _Supersedes: Billing/US-1.AC-3, nope/US-1.AC-1, billing/US-9.AC-9, junk_\n\n" +
      "<!-- _Supersedes: billing/US-1.AC-1_ -->\n```\n_Supersedes: billing/US-1.AC-1_\n```\n");
    fs.writeFileSync(path.join(w10Specs, "billing-v2", "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Refund in 14 days\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n");

    // _Supersedes:_ in trace_check: resolved references, phantom ones as warnings — never an AC gap, never this feature's AC.
    const tr10 = (await call10("trace_check", { name: "Billing v2", projectDir: w10 })).p;
    ok(tr10.ok && tr10.verdict === "pass" && tr10.totalAcs === 2 && !tr10.uncoveredByTasks.length && S.traceGaps(tr10).length === 0 &&
      JSON.stringify(tr10.supersedes.map((s) => [s.ref, s.feature, s.ac, s.by])) === JSON.stringify([["billing/US-1.AC-2", "billing", "US-1.AC-2", "US-1.AC-1"], ["Billing/US-1.AC-3", "billing", "US-1.AC-3", "US-1.AC-2"]]) &&
      tr10.phantomSupersedes.map((p) => p.ref + ":" + p.reason).join() === "nope/US-1.AC-1:unknown-feature,billing/US-9.AC-9:unknown-ac,junk:bad-ref" &&
      tr10.phantomSupersedes.every((p) => p.by === "US-1.AC-2" && p.line === 12),
      "trace_check: _Supersedes:_ (same line or sub-line) resolves to another feature's AC; unknown feature/AC or a malformed ref → phantomSupersedes warnings, not gaps (verdict pass, own ACs only)");
    ok(/_Supersedes:_ nope\/US-1\.AC-1 \(on US-1\.AC-2\) — no such feature/.test(S.supersedesWarnings(tr10, "en").join("\n")) &&
      /essa feature não existe/.test(S.supersedesWarnings(tr10, "pt")[0]), "phantom _Supersedes:_ warnings are localized (EN/PT)");
    const ap10 = S.appendTasks(w10, "billing-v2", [{ text: "x", requirements: ["US-1.AC-3"] }]);
    const ms10 = S.finishFeature(w10, "billing-v2").mergeSummary;
    ok(ap10.ok === false && /US-1\.AC-3/.test(ap10.error) && ms10.split("## Acceptance criteria\n")[1].split("\n\n")[0].split("\n").length === 2,
      "a superseded ID is another feature's AC: append_tasks refuses it as phantom, finish lists only this feature's 2 criteria");

    // spec_catalog: the structure + markdown, superseded ACs struck through with the ID that replaces them — billing-v2
    // SHIPPED (1.15: a draft's _Supersedes:_ is only "to be superseded"; see the full review 1.15 block).
    shipFeature(w10, "billing-v2");
    const cat = await call10("spec_catalog", { projectDir: w10 });
    const cf = (n) => cat.p.features.find((f) => f.feature === n);
    const bAcs = cf("billing").acs;
    ok(!cat.isError && cat.p.wrote === false && !fs.existsSync(path.join(w10Specs, "SPECS.md")) && cat.p.totals.superseded === 2 && cat.p.totals.features === 4 &&
      bAcs.map((a) => a.id + ":" + (a.supersededBy || []).join("|")).join() === "US-1.AC-1:,US-1.AC-2:billing-v2/US-1.AC-1,US-1.AC-3:billing-v2/US-1.AC-2" &&
      cf("billing-v2").acs[0].supersedes.join() === "billing/US-1.AC-2" && cf("billing-v2").acs[1].text === "WHEN a card expires THE SYSTEM SHALL text the owner" &&
      cf("billing-v2").acs.every((a) => !/Supersedes/.test(a.text)) && cf("payments").acs.every((a) => a.template === true) && cf("billing").status === "active",
      "spec_catalog (no write): every feature's ACs one line each, superseded ones point to their replacement; commented/fenced markers ignored; template criteria flagged; nothing written");
    ok(cat.p.markdown.includes("- ~~**US-1.AC-2** — WHEN a refund is asked THE SYSTEM SHALL refund within 30 days~~ — superseded by `billing-v2/US-1.AC-1`") &&
      cat.p.markdown.includes("_(supersedes `billing/US-1.AC-2`)_") && /<!-- AUTO-GENERATED by dev-spec/.test(cat.p.markdown) && /^# Spec catalog — proj-wp10$/m.test(cat.p.markdown),
      "the catalog markdown strikes superseded criteria through and carries the AUTO-GENERATED marker");
    const catW = await call10("spec_catalog", { write: true, projectDir: w10 });
    const specsMd = path.join(w10Specs, "SPECS.md");
    ok(!catW.isError && catW.p.wrote === true && catW.p.markdown === undefined && fs.readFileSync(specsMd, "utf8") === cat.p.markdown,
      "spec_catalog {write: true} writes .specs/SPECS.md (the same markdown; content omitted from the result)");
    S.createFeature(w10, "Refunds", ["core"]);
    ok(/## 🟡 refunds — in progress/.test(fs.readFileSync(specsMd, "utf8")), "once SPECS.md exists, a mutator (create) refreshes it like the roadmap");

    // Guard: a hand-written SPECS.md (no marker) is never overwritten — neither by spec_catalog nor by a mutator's refresh.
    fs.writeFileSync(specsMd, "# Our specs\n\nWritten by hand.\n");
    const catG = await call10("spec_catalog", { write: true, projectDir: w10 });
    S.approvePhase(w10, "refunds", "classification", "tester", { force: true });
    ok(catG.isError && catG.p.ok === false && catG.p.wrote === false && /SPECS\.md exists and was not generated by dev-spec/.test(catG.p.error) &&
      fs.readFileSync(specsMd, "utf8") === "# Our specs\n\nWritten by hand.\n", "a hand-written SPECS.md is never overwritten (spec_catalog → error; mutator refresh → left alone)");
    fs.unlinkSync(specsMd);
    S.catalog(w10, { write: true });

    // Archive → restore round-trip with dependents: roadmap.json comes back equivalent (dependsOn order included).
    S.setDependency(w10, "billing", ["accounts"], 2);
    S.setDependency(w10, "billing-v2", ["billing", "payments"]);
    S.setDependency(w10, "payments", ["billing"]);
    const rmFile = path.join(w10Specs, "roadmap.json");
    const norm = (o) => (Array.isArray(o) ? o.map(norm) : o && typeof o === "object" ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, norm(o[k])])) : o);
    const rmBefore = JSON.stringify(norm(JSON.parse(fs.readFileSync(rmFile, "utf8"))));
    const arch10 = await call10("spec_feature", { action: "archive", name: "Billing", projectDir: w10 });
    const archState = JSON.parse(fs.readFileSync(path.join(w10Specs, "_archive", "billing", ".state.json"), "utf8"));
    const rmArch = JSON.parse(fs.readFileSync(rmFile, "utf8"));
    ok(arch10.p.ok && JSON.stringify(archState.archived.entry) === JSON.stringify({ dependsOn: ["accounts"], order: 2 }) &&
      JSON.stringify(archState.archived.dependents) === JSON.stringify([{ feature: "billing-v2", dependsOn: ["billing", "payments"] }, { feature: "payments", dependsOn: ["billing"] }]) &&
      typeof archState.archived.at === "string" && !rmArch.features.billing && rmArch.features["billing-v2"].dependsOn.join() === "payments" && rmArch.features.payments.dependsOn.length === 0,
      "archive records its roadmap.json entry and the dependents' dependsOn in the archived .state.json BEFORE pruning them");
    ok(arch10.p.dependentsPruned.join() === "billing-v2,payments" && arch10.p.incompleteDependency === true &&
      /^'billing' was not complete \(\d+%\), yet billing-v2, payments depended on it: the roadmap no longer shows them blocked by it/.test(arch10.p.note),
      "spec_feature archive names the dependents whose dependsOn it pruned, with a warning (incompleteDependency) when the archived feature was not complete — they now read as unblocked (got " + JSON.stringify(arch10.p) + ")");
    // A complete feature's dependents are just listed; a feature nobody depends on returns [] and no note; the note is in
    // the archived feature's language (PT).
    const w10a = path.join(tmp, "proj-wp10-archdeps");
    S.initProject(w10a, ["core"]);
    ["Card payments", "Dunning emails", "Receipts", "Lonely"].forEach((n) => S.createFeature(w10a, n, ["core"]));
    S.createFeature(w10a, "Pagamentos", ["core"], undefined, undefined, "pt");
    fs.writeFileSync(path.join(w10a, ".specs", "receipts", "tasks.md"), "# Tasks\n\n## Phase: Build\n- [x] 1. Send receipts\n");
    S.setDependency(w10a, "dunning-emails", ["card-payments", "receipts"]);
    S.setDependency(w10a, "card-payments", ["pagamentos"]);
    const adDone = S.manageFeature(w10a, "archive", "receipts");
    const adLone = S.manageFeature(w10a, "archive", "lonely");
    const adPt = S.manageFeature(w10a, "archive", "pagamentos");
    const adRm = S.roadmap(w10a).features.find((f) => f.name === "dunning-emails");
    ok(adDone.ok && adDone.dependentsPruned.join() === "dunning-emails" && adDone.incompleteDependency === undefined && /^its dependents' links to it left the roadmap: dunning-emails \(recorded/.test(adDone.note) &&
      adLone.ok && adLone.dependentsPruned.length === 0 && adLone.note === undefined &&
      adPt.ok && adPt.incompleteDependency === true && /^'pagamentos' não estava completa \(\d+%\), mas card-payments dependia\(m\) dela/.test(adPt.note) &&
      adRm.dependsOn.join() === "card-payments" && adRm.blocked === true,
      "archive of a complete feature lists the pruned dependents (no warning); nobody depending → [] and no note; the warning is in the archived feature's language (PT)");
    const trArch = S.traceCheck(w10, "billing-v2");
    const specsArch = fs.readFileSync(specsMd, "utf8");
    ok(trArch.phantomSupersedes.length === 3 && trArch.supersedes.every((s) => s.archived === true) && /## 🗄 billing — archived\n\n_core · archived \d{4}-\d\d-\d\d_/.test(specsArch) &&
      specsArch.includes("~~**US-1.AC-3** — WHEN a card expires THE SYSTEM SHALL email the owner~~ — superseded by `billing-v2/US-1.AC-2`"),
      "an archived feature still resolves _Supersedes:_ and stays in SPECS.md (refreshed on archive) as archived, its superseded ACs marked");
    const rest10 = await call10("spec_feature", { action: "restore", name: "Billing", projectDir: w10 });
    const restState = JSON.parse(fs.readFileSync(path.join(w10Specs, "billing", ".state.json"), "utf8"));
    ok(rest10.p.ok && rest10.p.action === "restore" && rest10.p.restored.entry === true && rest10.p.restored.dependents.join() === "billing-v2,payments" && rest10.p.skipped.length === 0 &&
      JSON.stringify(norm(JSON.parse(fs.readFileSync(rmFile, "utf8")))) === rmBefore && JSON.parse(fs.readFileSync(rmFile, "utf8")).features["billing-v2"].dependsOn.join() === "billing,payments" &&
      !("archived" in restState) && !fs.existsSync(path.join(w10Specs, "_archive", "billing")) && /## 🟡 billing — in progress/.test(fs.readFileSync(specsMd, "utf8")),
      "spec_feature restore: folder back, roadmap.json equivalent to before archive (entry, order, dependents in their old position), record cleared, SPECS.md refreshed");
    const featTool = list.result.tools.find((t) => t.name === "spec_feature");
    const again10 = await call10("spec_feature", { action: "restore", name: "Billing", projectDir: w10 });
    ok(featTool.inputSchema.properties.action.enum.includes("restore") && again10.isError && /Nothing is archived as 'billing'/.test(again10.p.error) &&
      /remove \| archive \| rename \| restore/.test(S.manageFeature(w10, "wat", "billing").error), "restore is in the spec_feature enum; nothing archived under that name → error");

    // Restore only re-adds references to features that still exist; one that would close a cycle stays out; errors refuse.
    ["Core Lib", "Consumer", "Helper"].forEach((n) => S.createFeature(w10, n, ["core"]));
    S.setDependency(w10, "core-lib", ["helper", "accounts"]);
    S.setDependency(w10, "consumer", ["core-lib"]);
    S.manageFeature(w10, "archive", "core-lib");
    ["consumer", "helper"].forEach((n) => S.manageFeature(w10, "remove", n, undefined, { confirm: true }));
    const gone10 = S.manageFeature(w10, "restore", "Core Lib");
    ok(gone10.ok && gone10.restored.dependents.length === 0 && gone10.restored.dependsOn.join() === "accounts" && S.readRoadmap(w10).features["core-lib"].dependsOn.join() === "accounts" &&
      JSON.stringify(gone10.skipped) === JSON.stringify([{ feature: "helper", kind: "dependsOn", reason: "gone" }, { feature: "consumer", kind: "dependent", reason: "gone" }]) &&
      /Not restored: its dependency 'helper' \(no longer exists\); 'consumer', which depended on it \(no longer exists\)/.test(gone10.note),
      "restore re-adds only references to features that still exist — a gone dependency or dependent is skipped and reported");
    ["Cyc A", "Cyc B", "Cyc C"].forEach((n) => S.createFeature(w10, n, ["core"]));
    S.setDependency(w10, "cyc-a", ["cyc-c"]);
    S.setDependency(w10, "cyc-b", ["cyc-a"]);
    S.manageFeature(w10, "archive", "cyc-a");
    S.setDependency(w10, "cyc-c", ["cyc-b"]);
    const cyc10 = S.manageFeature(w10, "restore", "cyc-a");
    ok(cyc10.ok && cyc10.restored.dependsOn.join() === "cyc-c" && cyc10.skipped.map((s) => s.feature + ":" + s.reason).join() === "cyc-b:cycle" && S.roadmap(w10).cycle === null,
      "restore leaves out an old dependent edge that would now close a cycle (reported), never writing a circular roadmap");
    S.manageFeature(w10, "archive", "core-lib");
    S.createFeature(w10, "Core Lib", ["core"]);
    const dupe10 = S.manageFeature(w10, "restore", "core-lib");
    ok(dupe10.ok === false && /'core-lib' is already an active feature/.test(dupe10.error) && fs.existsSync(path.join(w10Specs, "_archive", "core-lib")),
      "restore refuses when an active feature has that slug (the archived one stays put)");
    const oldState = path.join(w10Specs, "_archive", "core-lib", ".state.json");
    fs.writeFileSync(oldState, "{ broken");
    S.manageFeature(w10, "remove", "core-lib", undefined, { confirm: true });
    const bad10 = S.manageFeature(w10, "restore", "core-lib");
    fs.writeFileSync(oldState, JSON.stringify({ lang: "en", approvals: {} }));
    const old10 = S.manageFeature(w10, "restore", "core-lib");
    const liveState = path.join(w10Specs, "accounts", ".state.json");
    fs.writeFileSync(liveState, "[]");
    const badArch = S.manageFeature(w10, "archive", "accounts");
    ok(bad10.ok === false && /not valid JSON/.test(bad10.error) && old10.ok && /archived before archive recorded its roadmap entry/.test(old10.note) &&
      badArch.ok === false && /unexpected shape/.test(badArch.error) && fs.existsSync(path.join(w10Specs, "accounts")) && fs.readFileSync(liveState, "utf8") === "[]",
      "a broken archived .state.json refuses restore; a pre-1.13 archive restores with a note; archive refuses a broken .state.json (never rewritten, nothing moved)");
    fs.writeFileSync(liveState, JSON.stringify({ lang: "en", tracks: ["core"], approvals: {} }));
    // A hand-edited archive record of the wrong shape: the bad parts are left out (reported); roadmap.json stays valid.
    ["Rec A", "Rec B"].forEach((n) => S.createFeature(w10, n, ["core"]));
    S.setDependency(w10, "rec-a", ["rec-b"]);
    S.manageFeature(w10, "archive", "rec-a");
    const recSt = path.join(w10Specs, "_archive", "rec-a", ".state.json");
    const recJ = JSON.parse(fs.readFileSync(recSt, "utf8"));
    recJ.archived.entry.dependsOn = "rec-b";
    recJ.archived.dependents = "nope";
    fs.writeFileSync(recSt, JSON.stringify(recJ));
    const recR = S.manageFeature(w10, "restore", "rec-a");
    ok(recR.ok && recR.restored.entry === true && recR.restored.dependsOn.length === 0 &&
      recR.skipped.map((s) => s.kind + ":" + s.field + ":" + s.reason).join() === "record:entry.dependsOn:invalid,record:dependents:invalid" &&
      !("dependsOn" in S.readRoadmap(w10).features["rec-a"]) && S.setDependency(w10, "rec-b", []).ok === true && S.manageFeature(w10, "archive", "rec-b").ok === true &&
      /the archive record's entry\.dependsOn \(unexpected shape — left out\)/.test(recR.note),
      "restore of a hand-edited archive record: a wrong-shape dependsOn / dependents is left out and reported — roadmap.json stays valid, later mutators still work");

    // A rename keeps every cross-feature reference: `_Supersedes:_` markers in other features (active AND archived —
    // never a commented example) follow the new slug, so the auto-refreshed SPECS.md still strikes the replaced AC
    // through; archived features' archive records follow it too, so restore puts the dependency back (it used to say
    // the renamed feature "no longer exists"). Both directions of the archive record.
    const w10r = path.join(tmp, "proj-wp10-rename");
    S.initProject(w10r, ["core"]);
    ["User Login", "Account Lockout", "Old Lockout", "Auth", "Billing", "Ledger", "Invoices"].forEach((n) => S.createFeature(w10r, n, ["core"]));
    req10(w10r, "user-login", "1. **US-1.AC-1** — WHEN a user logs in THE SYSTEM SHALL open the dashboard\n2. **US-1.AC-2** — WHEN x THE SYSTEM SHALL y\n" +
      "3. **US-1.AC-3** — IF three failed attempts occur THEN THE SYSTEM SHALL lock the account for 5 minutes\n");
    req10(w10r, "account-lockout", "1. **US-1.AC-1** — IF five failed attempts occur THEN THE SYSTEM SHALL lock the account for 15 minutes _Supersedes: user-login/US-1.AC-3_\n\n" +
      "<!-- e.g. _Supersedes: user-login/US-1.AC-2_ -->\n");
    req10(w10r, "old-lockout", "1. **US-1.AC-1** — WHEN q THE SYSTEM SHALL r _Supersedes: `user-login/US-1.AC-2`, User Login/US-1.AC-1_\n");
    shipFeature(w10r, "account-lockout"); // 1.15: shipped declarers retire (old-lockout shipped, then archived to declutter)
    shipFeature(w10r, "old-lockout");
    S.manageFeature(w10r, "archive", "old-lockout");
    S.setDependency(w10r, "billing", ["auth"]);
    S.manageFeature(w10r, "archive", "auth");
    S.setDependency(w10r, "invoices", ["ledger"]);
    S.manageFeature(w10r, "archive", "invoices");
    S.catalog(w10r, { write: true });
    const specsMdR = () => fs.readFileSync(path.join(w10r, ".specs", "SPECS.md"), "utf8");
    const struckBefore = (specsMdR().match(/~~/g) || []).length;
    const ren10 = (await call10("spec_feature", { action: "rename", name: "user-login", newName: "auth-login", projectDir: w10r })).p;
    const lockReq = fs.readFileSync(path.join(w10r, ".specs", "account-lockout", "requirements.md"), "utf8");
    const oldReq = fs.readFileSync(path.join(w10r, ".specs", "_archive", "old-lockout", "requirements.md"), "utf8");
    const trLock = S.traceCheck(w10r, "account-lockout");
    ok(ren10.ok && struckBefore > 0 && (specsMdR().match(/~~/g) || []).length === struckBefore && /_Supersedes: auth-login\/US-1\.AC-3_/.test(lockReq) &&
      /<!-- e\.g\. _Supersedes: user-login\/US-1\.AC-2_ -->/.test(lockReq) && /_Supersedes: `auth-login\/US-1\.AC-2`, auth-login\/US-1\.AC-1_/.test(oldReq) &&
      trLock.phantomSupersedes.length === 0 && trLock.supersedes.map((s) => s.feature + "/" + s.ac).join() === "auth-login/US-1.AC-3" &&
      ren10.supersedesUpdated.map((s) => (s.archived ? "_archive/" : "") + s.feature + ":" + s.refs).join() === "account-lockout:1,_archive/old-lockout:2" &&
      /_Supersedes:_ references to it now use the new name, in: account-lockout \(1\), _archive\/old-lockout \(2\)/.test(ren10.note),
      "rename rewrites _Supersedes:_ references to the old slug in active and archived features (not a commented example); SPECS.md still strikes the AC through (got " + JSON.stringify(ren10.supersedesUpdated) + ")");
    S.manageFeature(w10r, "rename", "billing", "payments");
    S.manageFeature(w10r, "rename", "ledger", "books");
    const restA = S.manageFeature(w10r, "restore", "auth");
    const restI = S.manageFeature(w10r, "restore", "invoices");
    const rm10r = S.readRoadmap(w10r).features;
    ok(restA.ok && restA.skipped.length === 0 && restA.restored.dependents.join() === "payments" && rm10r.payments.dependsOn.join() === "auth" &&
      restI.ok && restI.skipped.length === 0 && restI.restored.dependsOn.join() === "books" && rm10r.invoices.dependsOn.join() === "books",
      "archive → rename the other feature → restore puts the dependency back under the new name (dependent and dependency sides)");
    // A phantom _Supersedes:_ (a typo, a removed feature) is a doctor warning too — where users look.
    req10(w10r, "account-lockout", "1. **US-1.AC-1** — IF five failed attempts occur THEN THE SYSTEM SHALL lock the account _Supersedes: nowhere/US-1.AC-3_\n");
    const supChk = S.specDoctor(w10r, "account-lockout").checks.find((c) => c.id === "supersedes");
    ok(supChk && supChk.status === "warn" && /nowhere\/US-1\.AC-3.*no such feature/.test(supChk.detail), "doctor warns on a phantom _Supersedes:_ reference (check 'supersedes')");

    // _Supersedes:_ edge cases: punctuation after the marker (`…_.`, `(…_)`), a table-row criterion, an unterminated
    // marker, a case-different folder — the foreign ID never becomes one of the feature's own ACs.
    const w10x = path.join(tmp, "proj-wp10-sup");
    S.initProject(w10x, ["core"]);
    ["Billing", "Paren", "Table Row", "Open"].forEach((n) => S.createFeature(w10x, n, ["core"]));
    const billing10x = "1. **US-1.AC-1** — WHEN a user pays THE SYSTEM SHALL store the receipt\n2. **US-1.AC-2** — WHEN a refund is asked THE SYSTEM SHALL refund within 30 days\n" +
      "3. **US-1.AC-3** — WHEN x THE SYSTEM SHALL y\n4. **US-1.AC-4** — WHEN z THE SYSTEM SHALL w\n";
    req10(w10x, "billing", billing10x);
    req10(w10x, "paren", "1. **US-1.AC-1** — WHEN a refund is asked THE SYSTEM SHALL refund within 14 days (_Supersedes: billing/US-1.AC-2_).\n" +
      "2. **US-1.AC-2** — WHEN a thing THE SYSTEM SHALL do _Supersedes: billing/US-1.AC-4_.\n");
    fs.writeFileSync(path.join(w10x, ".specs", "paren", "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Refund\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n");
    req10(w10x, "table-row", "| ID | Criterion |\n|---|---|\n| US-1.AC-1 | WHEN a card expires THE SYSTEM SHALL text the owner _Supersedes: billing/US-1.AC-3_ |\n");
    req10(w10x, "open", "1. **US-1.AC-1** — WHEN a thing THE SYSTEM SHALL do it _Supersedes: billing/US-1.AC-7 and more\n");
    const trP10 = S.traceCheck(w10x, "paren");
    const trT10 = S.traceCheck(w10x, "table-row");
    const trO10 = S.traceCheck(w10x, "open");
    ok(trP10.verdict === "pass" && trP10.totalAcs === 2 && !trP10.uncoveredByTasks.length && trP10.phantomSupersedes.length === 0 &&
      trP10.supersedes.map((s) => s.by + ">" + s.ref).join() === "US-1.AC-1>billing/US-1.AC-2,US-1.AC-2>billing/US-1.AC-4" &&
      trT10.totalAcs === 1 && trT10.supersedes.length === 1 && trT10.supersedes[0].by === "US-1.AC-1" &&
      trO10.totalAcs === 1 && trO10.supersedes.length === 0 && trO10.phantomSupersedes.map((p) => p.reason + ":" + p.ref + ":" + p.by).join() === "unterminated:billing/US-1.AC-7 and more:US-1.AC-1" &&
      /never closed/.test(S.supersedesWarnings(trO10, "en")[0]) && /nunca é fechado/.test(S.supersedesWarnings(trO10, "pt")[0]),
      "_Supersedes:_ followed by punctuation resolves (no spurious gap); a table-row marker's `by` is its row's AC; an unterminated marker is an `unterminated` warning and its ID is never an own AC");
    shipFeature(w10x, "paren"); // 1.15: shipped declarers retire the targets
    shipFeature(w10x, "table-row");
    const catX = S.catalog(w10x);
    const xAcs = (n) => catX.features.find((f) => f.feature === n).acs;
    ok(xAcs("billing").map((a) => a.id + ":" + (a.supersededBy || []).join("|")).join() === "US-1.AC-1:,US-1.AC-2:paren/US-1.AC-1,US-1.AC-3:table-row/US-1.AC-1,US-1.AC-4:paren/US-1.AC-2" &&
      xAcs("paren").map((a) => a.id + "=" + a.text).join("|") === "US-1.AC-1=WHEN a refund is asked THE SYSTEM SHALL refund within 14 days.|US-1.AC-2=WHEN a thing THE SYSTEM SHALL do." &&
      xAcs("table-row")[0].supersedes.join() === "billing/US-1.AC-3" && xAcs("table-row")[0].text === "WHEN a card expires THE SYSTEM SHALL text the owner" &&
      xAcs("open").length === 1 && xAcs("open")[0].text === "WHEN a thing THE SYSTEM SHALL do it" && catX.totals.superseded === 3,
      "catalog: punctuated and table-row markers mark their targets superseded with the replacing ID; no phantom AC row; the one-line text drops the marker cleanly");
    // A marker hard-wrapped onto its next line is ONE marker (trace, acIndex and catalog agree); one that wraps and
    // never closes is one `unterminated` warning whose continuation IDs stay foreign; emphasis around it leaves no `** **`.
    const w10w = path.join(tmp, "proj-wp10-wrap");
    S.initProject(w10w, ["core"]);
    ["Billing", "Wrapped", "Open Wrap", "Bold"].forEach((n) => S.createFeature(w10w, n, ["core"]));
    req10(w10w, "billing", billing10x + "5. **US-1.AC-5** — WHEN v THE SYSTEM SHALL u\n");
    req10(w10w, "wrapped", "1. **US-1.AC-1** — WHEN a refund is asked THE SYSTEM SHALL refund within 14 days\n   - _Supersedes: billing/US-1.AC-2, billing/US-1.AC-3,\n     billing/US-1.AC-4_\n");
    fs.writeFileSync(path.join(w10w, ".specs", "wrapped", "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Refund\n  - _Requirements: US-1.AC-1_\n");
    req10(w10w, "open-wrap", "1. **US-1.AC-1** — WHEN a THE SYSTEM SHALL b\n   - _Supersedes: billing/US-1.AC-2,\n     billing/US-1.AC-3\n2. **US-1.AC-2** — WHEN c THE SYSTEM SHALL d\n");
    req10(w10w, "bold", "1. **US-1.AC-1** — WHEN a user pays THE SYSTEM SHALL store the receipt **_Supersedes: billing/US-1.AC-1_**\n" +
      "2. **US-1.AC-2** — WHEN v THE SYSTEM SHALL u (*_Supersedes: billing/US-1.AC-5_*).\n");
    const trW10 = S.traceCheck(w10w, "wrapped");
    const trOW10 = S.traceCheck(w10w, "open-wrap");
    const docW10 = S.specDoctor(w10w, "wrapped").checks.find((c) => c.id === "traceability");
    ok(trW10.verdict === "pass" && trW10.totalAcs === 1 && !trW10.uncoveredByTasks.length && trW10.phantomSupersedes.length === 0 && docW10.status === "pass" &&
      trW10.supersedes.map((s) => s.by + ">" + s.ref + "@" + s.line).join() === "US-1.AC-1>billing/US-1.AC-2@10,US-1.AC-1>billing/US-1.AC-3@10,US-1.AC-1>billing/US-1.AC-4@10" &&
      trOW10.totalAcs === 2 && trOW10.supersedes.length === 0 && trOW10.phantomSupersedes.map((p) => p.reason + ":" + p.ref + ":" + p.by + "@" + p.line).join() === "unterminated:billing/US-1.AC-2, billing/US-1.AC-3:US-1.AC-1@10",
      "a _Supersedes:_ marker wrapped onto its next line resolves whole (no gap, no phantom, doctor traceability passes); a wrapped marker that never closes is ONE `unterminated` warning and its continuation ID is never an own AC");
    shipFeature(w10w, "wrapped"); // 1.15: shipped declarers retire the targets
    shipFeature(w10w, "bold");
    const catW10 = S.catalog(w10w);
    const wAcs = (n) => catW10.features.find((f) => f.feature === n).acs;
    ok(wAcs("billing").map((a) => a.id + ":" + (a.supersededBy || []).join("|")).join() === "US-1.AC-1:bold/US-1.AC-1,US-1.AC-2:wrapped/US-1.AC-1,US-1.AC-3:wrapped/US-1.AC-1,US-1.AC-4:wrapped/US-1.AC-1,US-1.AC-5:bold/US-1.AC-2" &&
      wAcs("wrapped").length === 1 && wAcs("wrapped")[0].supersedes.join() === "billing/US-1.AC-2,billing/US-1.AC-3,billing/US-1.AC-4" &&
      wAcs("open-wrap").map((a) => a.id).join() === "US-1.AC-1,US-1.AC-2" && wAcs("open-wrap")[0].text === "WHEN a THE SYSTEM SHALL b" &&
      wAcs("bold").map((a) => a.text).join("|") === "WHEN a user pays THE SYSTEM SHALL store the receipt|WHEN v THE SYSTEM SHALL u." &&
      !/\*\s\*/.test(catW10.markdown) && catW10.totals.superseded === 5,
      "catalog: a wrapped marker strikes all its targets through; emphasis around a marker (**_…_**, (*_…_*).) leaves no stray `** **` in the one-liner");
    if (process.platform === "win32" || process.platform === "darwin") {
      // A case-different folder (made by hand / on another OS) is the same feature: its ACs are still marked, and its own
      // marker naming itself is `self`, never a supersession.
      fs.renameSync(path.join(w10x, ".specs", "billing"), path.join(w10x, ".specs", "Billing"));
      req10(w10x, "Billing", billing10x + "5. **US-1.AC-5** — WHEN q THE SYSTEM SHALL r _Supersedes: billing/US-1.AC-1_\n");
      const catXc = S.catalog(w10x);
      const bXc = catXc.features.find((f) => f.feature === "Billing");
      ok(bXc && bXc.acs.map((a) => a.id + ":" + (a.supersededBy || []).join("|")).join() === "US-1.AC-1:,US-1.AC-2:paren/US-1.AC-1,US-1.AC-3:table-row/US-1.AC-1,US-1.AC-4:paren/US-1.AC-2,US-1.AC-5:" &&
        catXc.totals.superseded === 3, "catalog on a case-insensitive file system: a case-different feature folder still gets its superseded ACs; a self-reference is not one");
    } else {
      // A case-sensitive file system (Linux): the slug 'billing' can't reach a 'Billing/' folder — listFeatures reports it as
      // ignored (the listFeatures case-only check) — so the catalog doesn't list it and trace_check reads the references to
      // billing/… as unknown-feature warnings: never silently resolved, never a half-listed feature.
      fs.renameSync(path.join(w10x, ".specs", "billing"), path.join(w10x, ".specs", "Billing"));
      const catXs = S.catalog(w10x);
      const trXs = S.traceCheck(w10x, "paren");
      ok(!catXs.features.some((f) => f.feature.toLowerCase() === "billing") && catXs.totals.superseded === 0 && (S.listFeatures(w10x).ignored || []).includes("Billing") &&
        trXs.phantomSupersedes.map((p) => p.reason + ":" + p.ref).join() === "unknown-feature:billing/US-1.AC-2,unknown-feature:billing/US-1.AC-4",
        "catalog on a case-sensitive file system: a case-different feature folder is not reached by its slug (listFeatures ignores it) — not listed, and the _Supersedes:_ references to it are unknown-feature warnings (got " +
        JSON.stringify([catXs.features.map((f) => f.feature), catXs.totals.superseded, trXs.phantomSupersedes.map((p) => p.reason + ":" + p.ref)]) + ")");
    }

    // Drift: finish {write} on a READY feature records the baseline; drift reports changed / missing / now present.
    const w10d = path.join(tmp, "proj-wp10-drift");
    S.initProject(w10d, ["tdd"]);
    fs.mkdirSync(path.join(w10d, "src", "lib"), { recursive: true });
    fs.writeFileSync(path.join(w10d, "src", "auth.js"), "a\r\nb\r\n");
    fs.writeFileSync(path.join(w10d, "src", "lib", "x.js"), "x");
    fs.writeFileSync(path.join(w10d, "src", "lib", "y.ts"), "y");
    const bf10 = S.createFeature(w10d, "Login Loop", undefined, "users bounce back to /login", undefined, "en", "bugfix");
    const fill10 = (rel, pairs) => { const fp = path.join(bf10.dir, rel); let t = fs.readFileSync(fp, "utf8"); pairs.forEach(([a, b]) => { t = t.split(a).join(b); }); fs.writeFileSync(fp, t); };
    fill10("requirements.md", [["[the condition that triggers the bug]", "the refresh token has expired"], ["[the correct behavior]", "clear the session cookie before redirecting to /login"],
      ["[the neighbouring behavior that already worked]", "a login with a valid refresh token"], ["[nearby inputs that must keep working]", "a token that expires mid-request"]]);
    fill10("test-plan.md", [["[unit/integration]", "integration"], ["`[path]`", "`tests/integration/auth.test.js`"]]);
    fill10("tasks.md", [["[command that runs T-01]", "node --test tests/integration/auth.test.js"], ["[exact values the fix must respect — versions, limits, formats]", "Node >= 20"], ["_Verify: [full test suite command]_", "_Verify: npm test_\n  - _Implements: src/auth.js, src/lib/_"]]);
    fill10("bug.md", [["[correct behavior]", "the dashboard opens"], ["[what happens — error message, output, log lines]", "302 back to /login in a loop"],
      ["> **TODO** — exact steps, input and environment that reproduce it every time.", "Log in with an expired refresh token."],
      ["> **TODO** — the cause, with evidence (stack trace, log, failing assertion, the change that introduced it). Not \"probably\".", "The refresh handler redirects before clearing the cookie (auth.js:88)."],
      ["[What changes and why it removes the root cause — one fix, not a bundle.]", "Clear the cookie before redirecting."]]);
    S.completeTask(w10d, "login-loop", 1, { command: "node --test tests/integration/auth.test.js", exitCode: 1, summary: "T-01 fails: 302 back to /login" }); // the red run (_Expect: fail_)
    S.completeTask(w10d, "login-loop", 2, { command: "npm test", exitCode: 0, summary: "42/42 passing" });
    ["requirements", "design", "test-plan", "tasks"].forEach((p) => S.approvePhase(w10d, "login-loop", p));
    S.createFeature(w10d, "Draft", ["core"]);
    const bfState = () => JSON.parse(fs.readFileSync(path.join(bf10.dir, ".state.json"), "utf8"));
    const fin0 = S.finishFeature(w10d, "login-loop");
    const notReady10 = S.finishFeature(w10d, "draft", { write: true });
    const fin10 = (await call10("spec_finish", { name: "login-loop", write: true, projectDir: w10d })).p;
    const base10 = bfState().finished;
    ok(fin0.readyToFinish && fin0.baseline === undefined && notReady10.baseline === undefined && !JSON.parse(fs.readFileSync(path.join(w10d, ".specs", "draft", ".state.json"), "utf8")).finished &&
      fin10.readyToFinish && fin10.baseline.recorded === true && fin10.baseline.files === 3 && fin10.baseline.missing === 0 &&
      Object.keys(base10.files).join() === "src/auth.js,src/lib/x.js,src/lib/y.ts" && Object.values(base10.files).every((h) => /^[0-9a-f]{40}$/.test(h)) && base10.at === fin10.baseline.at,
      "spec_finish {write} on a READY feature records state.finished {at, files: {rel: sha1}} over its _Implements:_ files (a folder expands; forward slashes); no write / not ready → none");
    const dr0 = (await call10("spec_drift", { projectDir: w10d })).p;
    fs.writeFileSync(path.join(w10d, "src", "auth.js"), "a\nb\n");
    const drCrlf = S.drift(w10d, "login-loop");
    ok(dr0.ok && dr0.verdict === "clean" && dr0.features.length === 1 && dr0.features[0].unchanged === 3 && dr0.unbaselined.join() === "draft" &&
      drCrlf.verdict === "clean" && drCrlf.features[0].changed.length === 0 && !/⚠/.test(hook10(w10d)),
      "spec_drift right after finish: clean (unfinished features listed apart); a CRLF → LF rewrite is not a change; SessionStart shows no drift line");
    // next_action on a FINISHED feature: not "close it with /spec-finish" again — finished (+ the execution sign-off while it is missing).
    const naF10 = (await call10("spec_next_action", { name: "login-loop", projectDir: w10d })).p;
    ok(naF10.step === "finished" && naF10.drift && naF10.drift.drifted === false && naF10.drift.files === 3 &&
      /^'login-loop' is finished \(\d{4}-\d\d-\d\d\) — its 3 implementing file\(s\) are unchanged since\. Sign it off: \/approve login-loop execution\.$/.test(naF10.recommendation) &&
      !/close the feature/.test(naF10.recommendation),
      "next_action after finish {write}: step 'finished' (drift clean), asks for the execution sign-off — never 'close the feature with /spec-finish' again");
    fs.writeFileSync(path.join(w10d, "src", "auth.js"), "a\nc\n");
    fs.unlinkSync(path.join(w10d, "src", "lib", "x.js"));
    const st10 = bfState();
    st10.finished.files["src/new.js"] = null;
    st10.finished.files["../outside.js"] = "0000000000000000000000000000000000000000";
    fs.writeFileSync(path.join(bf10.dir, ".state.json"), JSON.stringify(st10, null, 2));
    fs.writeFileSync(path.join(w10d, "src", "new.js"), "new");
    const dr1 = (await call10("spec_drift", { name: "Login Loop", projectDir: w10d })).p;
    const d1 = dr1.features[0];
    ok(dr1.ok && dr1.verdict === "drift" && dr1.drifted.join() === "login-loop" && dr1.features.length === 1 && d1.changed.join() === "src/auth.js" && d1.missing.join() === "src/lib/x.js" &&
      d1.nowPresent.join() === "src/new.js" && d1.unchanged === 1 && d1.ignored.join() === "../outside.js",
      "spec_drift after edits: changed / missing / now present per file; a recorded path outside the project is never probed (ignored)");
    const naD10 = S.nextAction(w10d, "login-loop");
    ok(naD10.step === "drift" && naD10.drift.drifted && naD10.drift.changed.join() === "src/auth.js" && naD10.drift.missing.join() === "src/lib/x.js" && naD10.drift.nowPresent.join() === "src/new.js" &&
      /^'login-loop' was finished on \d{4}-\d\d-\d\d, but 3 of 5 implementing file\(s\) changed since: src\/auth\.js, src\/lib\/x\.js, src\/new\.js \(node "[^"]*dev-spec\.js" drift login-loop\)\. Decide: /.test(naD10.recommendation) &&
      /\/spec-impact login-loop/.test(naD10.recommendation) && /re-run \/spec-finish login-loop for a fresh baseline/.test(naD10.recommendation) &&
      /mudaram desde então/.test(S.msg("pt").next.drifted("x", "2026-01-01", 1, 2, "a.js")) && /cambiaron desde entonces/.test(S.msg("es").next.drifted("x", "2026-01-01", 1, 2, "a.js")),
      "next_action on a finished feature whose implementing files drifted: step 'drift' with the files and the decision (spec wrong → spec_impact, code wrong → fix, harmless → re-finish); PT/ES localized");
    ok(/ {2}⚠ login-loop: 3 implementing file\(s\) changed since finish — run node \\?"[^"]*dev-spec\.js\\?" drift login-loop/.test(hook10(w10d)) /* the hook's JSON escapes the quotes */ &&
      S.drift(w10d, null, { maxFiles: 2 }).skipped === true && S.drift(w10d, null, { maxBytes: 1 }).skipped === true && S.drift(w10d, null, { maxFiles: 2 }).features.length === 0,
      "SessionStart: one localized drift line per drifted finished feature; over the file/byte budget the check is skipped (nothing hashed)");
    ok(S.drift(w10d, "nope").ok === false && S.drift(w10d, "draft").features.length === 0 && S.drift(w10d, "draft").unbaselined.join() === "draft" &&
      /No finished feature has a drift baseline yet/.test(S.drift(w10d, "draft").note), "drift: an unknown feature is an error; an unfinished one is listed as unbaselined, not an error");
    S.manageFeature(w10d, "archive", "login-loop");
    const drArch = S.drift(w10d);
    const hookArch = hook10(w10d); // "draft" is still active, so the hook runs
    S.manageFeature(w10d, "restore", "login-loop");
    const fin2 = S.finishFeature(w10d, "login-loop", { write: true });
    const base2 = bfState().finished;
    ok(drArch.features.length === 1 && drArch.features[0].archived === true && drArch.drifted.join() === "login-loop" && /draft/.test(hookArch) && !/⚠/.test(hookArch) &&
      fin2.baseline.recorded && Object.keys(base2.files).join() === "src/auth.js,src/lib/y.ts" && S.drift(w10d).verdict === "clean" &&
      S.catalog(w10d).features.find((f) => f.feature === "login-loop").status === "finished",
      "drift covers archived finished features (SessionStart leaves archived ones to dev-spec drift); a later finish re-records the baseline (latest wins → clean again); the catalog shows the feature as finished");
    // That re-finish replaced a DRIFTED baseline: it says which drift it accepted (never erased silently); once the execution
    // phase is signed off, next_action has nothing left to ask.
    const apEx10 = S.approvePhase(w10d, "login-loop", "execution");
    const naE10 = S.nextAction(w10d, "login-loop");
    ok(fin2.baseline.replaced && fin2.baseline.replaced.changed.join() === "src/auth.js" && fin2.baseline.replaced.missing.join() === "src/lib/x.js" &&
      fin2.baseline.replaced.nowPresent.join() === "src/new.js" && /^\d{4}-/.test(fin2.baseline.replaced.at) && S.finishFeature(w10d, "login-loop", { write: true }).baseline.replaced === undefined &&
      apEx10.ok && naE10.step === "finished" && /Nothing left to do here — \/spec-drift login-loop checks it after later changes\.$/.test(naE10.recommendation),
      "a re-finish over a drifted baseline returns baseline.replaced {at, changed, missing, nowPresent} (a clean re-finish none); after the execution sign-off next_action says nothing is left");
    // An unreadable state is an error, never "clean".
    const draftSt = path.join(w10d, ".specs", "draft", ".state.json");
    const draftKeep = fs.readFileSync(draftSt, "utf8");
    fs.writeFileSync(draftSt, "{ broken");
    const drBadNamed = S.drift(w10d, "draft");
    const drBadAll = S.drift(w10d);
    const drBadMcp = await call10("spec_drift", { name: "draft", projectDir: w10d });
    fs.writeFileSync(draftSt, draftKeep);
    ok(drBadNamed.ok === false && /not valid JSON/.test(drBadNamed.error) && drBadMcp.isError && drBadAll.ok && drBadAll.verdict === "error" &&
      drBadAll.errors.length === 1 && drBadAll.note === undefined && drBadAll.features.length === 1,
      "drift: a named feature whose .state.json can't be read → error; project-wide → verdict `error` (never `clean`), no 'no baseline yet' note");
    // Reworked after finish (append_tasks): `reopened` — the catalog's "active", so no drift and no SessionStart line.
    const ap10d = S.appendTasks(w10d, "login-loop", [{ text: "Also handle the remember-me cookie", requirements: ["US-1.AC-1"], implements: ["src/auth.js"] }]);
    fs.writeFileSync(path.join(w10d, "src", "auth.js"), "reworked\n");
    const drRe = (await call10("spec_drift", { projectDir: w10d })).p;
    ok(ap10d.ok && drRe.ok && drRe.verdict === "clean" && drRe.reopened.join() === "login-loop" && drRe.drifted.length === 0 && drRe.features.length === 0 &&
      !/⚠/.test(hook10(w10d)) && S.catalog(w10d).features.find((f) => f.feature === "login-loop").status === "active",
      "a finished feature reworked after finish is `reopened`: not hashed, no drift, no SessionStart line — the catalog calls it active too");
    // ...and once that work is done again, the OLD baseline no longer speaks for it: the tasks were re-approved after the
    // finish and a new task implements src/audit.js, which the baseline never recorded. next_action asks to finish AGAIN (it
    // said "finished — nothing left to do"), drift lists it as `stale` (it said "unchanged", never hashing audit.js), the
    // catalog calls it complete; after the re-finish the execution sign-off (older than the change) is asked for again.
    S.appendTasks(w10d, "login-loop", [{ text: "Audit log of logins", requirements: ["US-1.AC-1"], implements: ["src/audit.js"] }]);
    fs.writeFileSync(path.join(w10d, "src", "audit.js"), "audit\n");
    const apT10 = S.approvePhase(w10d, "login-loop", "tasks");
    [3, 4].forEach((n) => S.completeTask(w10d, "login-loop", n)); // the two appended tasks (after the bugfix's red test and fix)
    // src/auth.js (recorded by the last finish as "a\nc\n") was reworked above: a stale baseline still hashes its recorded
    // files — the drift and its decision come first (it said only "finish it again", and the re-finish accepted the drift).
    const naSD10 = (await call10("spec_next_action", { name: "login-loop", projectDir: w10d })).p;
    const drSD10 = S.drift(w10d, "login-loop");
    ok(naSD10.step === "drift" && naSD10.staleBaseline && naSD10.staleBaseline.newFiles.join() === "src/audit.js" && naSD10.drift && naSD10.drift.changed.join() === "src/auth.js" &&
      /^'login-loop' was finished on \d{4}-\d\d-\d\d, but 1 of 2 implementing file\(s\) changed since: src\/auth\.js \(node "[^"]*dev-spec\.js" drift login-loop\)\. Decide: /.test(naSD10.recommendation) &&
      /It also changed since that finish \(re-approved: tasks; 1 implementing file\(s\) not in the baseline: src\/audit\.js\): whichever you decide, finish it again afterwards/.test(naSD10.recommendation) &&
      drSD10.verdict === "drift" && drSD10.drifted.join() === "login-loop" && drSD10.features.length === 1 && drSD10.features[0].stale === true && drSD10.features[0].changed.join() === "src/auth.js" &&
      drSD10.stale.length === 1 && drSD10.stale[0].drifted === true && / {2}⚠ login-loop: 1 implementing file\(s\) changed since finish/.test(hook10(w10d)),
      "a stale baseline (tasks re-approved, a new _Implements:_ file) whose recorded src/auth.js also changed: next_action → drift (the decision, then finish again; drift + staleBaseline), spec_drift → drift (features[].stale, stale[].drifted), SessionStart agrees (got " +
      JSON.stringify([naSD10.step, naSD10.drift && naSD10.drift.changed, drSD10.verdict, drSD10.features.map((f) => f.feature)]) + ")");
    fs.writeFileSync(path.join(w10d, "src", "auth.js"), "a\nc\n"); // back to what the baseline recorded: only stale now
    const naS10 = (await call10("spec_next_action", { name: "login-loop", projectDir: w10d })).p;
    const drS10 = S.drift(w10d, "login-loop");
    const catS10 = S.catalog(w10d).features.find((f) => f.feature === "login-loop");
    ok(apT10.ok && naS10.step === "finish" && naS10.staleBaseline && naS10.staleBaseline.newFiles.join() === "src/audit.js" &&
      naS10.staleBaseline.since.some((x) => x.kind === "approval" && x.phase === "tasks") && !/Nothing left to do/.test(naS10.recommendation) &&
      /^'login-loop' was finished on \d{4}-\d\d-\d\d, but it changed since \(re-approved: tasks; 1 implementing file\(s\) not in the baseline: src\/audit\.js\) and all its tasks are done — finish it again: \/spec-finish login-loop/.test(naS10.recommendation) &&
      JSON.stringify(naS10) === JSON.stringify(S.nextAction(w10d, "login-loop")) && naS10.drift && naS10.drift.drifted === false &&
      drS10.verdict === "stale" && drS10.features.length === 0 && drS10.stale.map((x) => x.feature).join() === "login-loop" && drS10.stale[0].newFiles.join() === "src/audit.js" && drS10.stale[0].drifted === false &&
      catS10.status === "complete" && catS10.finishedAt === undefined,
      "a finished feature changed since (tasks re-approved, a new _Implements:_ file) and done again: next_action → finish again (staleBaseline {since, newFiles}, drift clean; MCP = engine), drift → `stale`, the catalog → complete (got " +
      JSON.stringify([naS10.step, naS10.staleBaseline, drS10.verdict, catS10.status]) + ")");
    const reFin10 = S.finishFeature(w10d, "login-loop", { write: true });
    const naR10 = S.nextAction(w10d, "login-loop");
    const apR10 = S.approvePhase(w10d, "login-loop", "execution");
    const naR10b = S.nextAction(w10d, "login-loop");
    // The execution approval EXISTS but predates the change: re-confirm it, naming what came after (EN/PT/ES) — never
    // "Sign it off" / "Falta a aprovação final" as if there were none.
    const wOff = S.msg("pt").next.finished("x", "2026-01-02", 1, { at: "2026-01-01", why: "aprovação de tests" });
    const wOffEs = S.msg("es").next.finished("x", "2026-01-02", 1, { at: "2026-01-01", why: "la aprobación de tests" });
    ok(reFin10.readyToFinish && Object.keys(bfState().finished.files).includes("src/audit.js") && naR10.step === "finished" &&
      /Its execution sign-off \(\d{4}-\d\d-\d\d\) predates the approval of tasks — re-confirm it: \/approve login-loop execution\.$/.test(naR10.recommendation) && !/Sign it off/.test(naR10.recommendation) &&
      /A aprovação final \(execution, 2026-01-01\) foi registada antes destas alterações: aprovação de tests — volta a confirmá-la: \/approve x execution\.$/.test(wOff) && !/Falta a aprovação final/.test(wOff) &&
      /La aprobación final \(execution, 2026-01-01\) es anterior a la aprobación de tests — vuelve a confirmarla/.test(wOffEs) &&
      /Falta a aprovação final: \/approve x execution\./.test(S.msg("pt").next.finished("x", "d", 1, {})) &&
      apR10.ok && naR10b.step === "finished" && /Nothing left to do here/.test(naR10b.recommendation) && S.drift(w10d, "login-loop").verdict === "clean" &&
      S.catalog(w10d).features.find((f) => f.feature === "login-loop").status === "finished",
      "after the re-finish the baseline records src/audit.js; the execution sign-off older than the change is asked to be RE-CONFIRMED (naming the tasks re-approval; PT/ES too), then nothing is left; drift clean, catalog finished (got " + naR10.recommendation + ")");
    const stC10 = bfState();
    fs.writeFileSync(path.join(bf10.dir, ".state.json"), JSON.stringify({ ...stC10, changes: [...(stC10.changes || []), { at: new Date(Date.now() + 1000).toISOString(), phase: "requirements", reopened: [] }] }, null, 2));
    const naC10 = S.nextAction(w10d, "login-loop");
    fs.writeFileSync(path.join(bf10.dir, ".state.json"), JSON.stringify(stC10, null, 2));
    ok(naC10.step === "finish" && naC10.staleBaseline.since.map((x) => x.kind + (x.n || "")).join() === "change-request" + (1 + (stC10.changes || []).length) &&
      naC10.staleBaseline.newFiles.length === 0 && /changed since \(change request #\d+\)/.test(naC10.recommendation) &&
      /mudou desde então \(x\)/.test(S.msg("pt").next.refinish("f", "2026-01-01", "x")) && /cambió desde entonces \(x\)/.test(S.msg("es").next.refinish("f", "2026-01-01", "x")) &&
      /pedido de alteração/.test(S.msg("pt").drift.staleWhy.changeRequests("#1")) && /solicitud de cambio/.test(S.msg("es").drift.staleWhy.changeRequests("#1")),
      "a change request recorded after the finish makes the baseline stale too (next_action names it); the re-finish messages exist in PT and ES");
    // A baseline made stale ONLY by a new file under a folder _Implements:_ names (no spec change) never hides the drift of
    // a recorded file: next_action asks for the decision (it said "finish it again" and the re-finish accepted the drift),
    // spec_drift names the file (it said `stale` with features []).
    const yTs10 = path.join(w10d, "src", "lib", "y.ts"), zTs10 = path.join(w10d, "src", "lib", "z.ts");
    const y0 = fs.readFileSync(yTs10, "utf8");
    fs.writeFileSync(yTs10, "rewritten by another change\n");
    fs.writeFileSync(zTs10, "helper\n");
    const naNF10 = (await call10("spec_next_action", { name: "login-loop", projectDir: w10d })).p;
    const drNF10 = S.drift(w10d, "login-loop");
    ok(naNF10.step === "drift" && naNF10.drift.changed.join() === "src/lib/y.ts" && naNF10.staleBaseline && naNF10.staleBaseline.since.length === 0 &&
      naNF10.staleBaseline.newFiles.join() === "src/lib/z.ts" && /changed since: src\/lib\/y\.ts \(node "[^"]*dev-spec\.js" drift login-loop\)\. Decide: /.test(naNF10.recommendation) &&
      /It also changed since that finish \(1 implementing file\(s\) not in the baseline: src\/lib\/z\.ts\)/.test(naNF10.recommendation) &&
      drNF10.verdict === "drift" && drNF10.features.length === 1 && drNF10.features[0].changed.join() === "src/lib/y.ts" && drNF10.features[0].stale === true && drNF10.stale[0].drifted === true &&
      /Também mudou desde esse fecho \(x\)/.test(S.msg("pt").next.driftedStale("x")) && /También cambió desde ese cierre \(x\)/.test(S.msg("es").next.driftedStale("x")),
      "a new file under an implemented folder (stale, no spec change) plus a changed recorded file: next_action → drift with the decision + finish again, spec_drift → drift naming it (PT/ES localized) (got " +
      JSON.stringify([naNF10.step, naNF10.drift && naNF10.drift.changed, drNF10.verdict, drNF10.features.map((f) => f.changed)]) + ")");
    fs.writeFileSync(yTs10, y0);
    fs.unlinkSync(zTs10);
    // Every task ticked but the latest run of task 2 (the fix) failed: spec_finish and the execution sign-off refuse — next_action
    // names the task and how to re-verify it (it said "finished — nothing left to do", the catalog ✅ finished).
    const failRun10 = S.completeTask(w10d, "login-loop", 2, { command: "npm test", exitCode: 1, summary: "1 failing" });
    const naV10 = (await call10("spec_next_action", { name: "login-loop", projectDir: w10d })).p;
    const finV10 = S.finishFeature(w10d, "login-loop");
    const catV10 = S.catalog(w10d).features.find((f) => f.feature === "login-loop");
    ok(failRun10.ok === false && naV10.step === "verify" && /^All tasks are ticked, but not all are verified: #2 \(latest run failed\) — \/spec-finish and the execution sign-off refuse/.test(naV10.recommendation) &&
      /node "[^"]*dev-spec\.js" done login-loop 2 --run/.test(naV10.recommendation) && !/Nothing left to do|close the feature|Sign it off/.test(naV10.recommendation) && naV10.drift && naV10.drift.drifted === false &&
      finV10.readyToFinish === false && finV10.unverified.join() === "2" && catV10.status === "complete" && catV10.finishedAt === undefined &&
      /nem todas estão verificadas: #1/.test(S.msg("pt").next.verify("f", "#1", 1, true)) && /no todas están verificadas: #1/.test(S.msg("es").next.verify("f", "#1", 1, false)) &&
      /spec_complete_task \{name: "f", number: 2/.test(S.msg("en").next.verify("f", "#2", 2, false)),
      "a finished feature whose task's latest run failed: next_action → verify (names #2 and `done --run`, never 'nothing left to do'), finish not ready, the catalog → complete; PT/ES localized (got " +
      JSON.stringify([failRun10.ok, naV10.step, naV10.recommendation.slice(0, 90), finV10.readyToFinish, catV10.status]) + ")");
    S.completeTask(w10d, "login-loop", 2, { command: "npm test", exitCode: 0, summary: "42/42 passing" });
    const naV10b = S.nextAction(w10d, "login-loop");
    ok(naV10b.step === "finished" && /Nothing left to do here/.test(naV10b.recommendation) && S.catalog(w10d).features.find((f) => f.feature === "login-loop").status === "finished",
      "a passing re-run: next_action → finished (nothing left), the catalog → finished again");
    // ONLY a new file under a folder _Implements:_ names (no change request, no re-approval): the catalog agrees with
    // next_action (finish) and drift (stale) — complete — as the CHANGELOG says (it checked state only and kept ✅ finished).
    const zNew10 = path.join(w10d, "src", "lib", "z2.ts");
    fs.writeFileSync(zNew10, "helper\n");
    const naNew10 = S.nextAction(w10d, "login-loop");
    const drNew10 = S.drift(w10d, "login-loop");
    const catNew10 = S.catalog(w10d).features.find((f) => f.feature === "login-loop");
    fs.unlinkSync(zNew10);
    const catNewBack10 = S.catalog(w10d).features.find((f) => f.feature === "login-loop").status;
    ok(naNew10.step === "finish" && naNew10.staleBaseline && naNew10.staleBaseline.since.length === 0 && naNew10.staleBaseline.newFiles.join() === "src/lib/z2.ts" &&
      drNew10.verdict === "stale" && catNew10.status === "complete" && catNew10.finishedAt === undefined && catNewBack10 === "finished",
      "only a new _Implements:_ file since the finish: next_action → finish, drift → stale, the catalog → complete (not ✅ finished); the file gone → finished again (got " +
      JSON.stringify([naNew10.step, drNew10.verdict, catNew10.status, catNewBack10]) + ")");
    // An approved artifact edited and not re-approved (a criterion extended): next_action → re-review, finish refuses — the
    // catalog no longer says ✅ finished while listing the unapproved text as what the system does today.
    const reqEd10 = path.join(bf10.dir, "requirements.md");
    const reqKeepEd10 = fs.readFileSync(reqEd10, "utf8");
    fs.writeFileSync(reqEd10, reqKeepEd10.replace("clear the session cookie before redirecting to /login", "clear the session cookie before redirecting to /login and record an audit event"));
    const naEd10 = S.nextAction(w10d, "login-loop");
    const finEd10 = S.finishFeature(w10d, "login-loop");
    const catEd10 = S.catalog(w10d).features.find((f) => f.feature === "login-loop");
    fs.writeFileSync(reqEd10, reqKeepEd10);
    const catEdBack10 = S.catalog(w10d).features.find((f) => f.feature === "login-loop").status;
    ok(reqKeepEd10.includes("clear the session cookie before redirecting to /login") && naEd10.step === "re-review" && finEd10.readyToFinish === false &&
      catEd10.status === "complete" && catEd10.finishedAt === undefined && catEdBack10 === "finished",
      "an approved requirements.md edited without re-approval: next_action → re-review, finish not ready, the catalog → complete (not ✅ finished); the approved text back → finished (got " +
      JSON.stringify([naEd10.step, finEd10.readyToFinish, catEd10.status, catEdBack10]) + ")");
    // ARCHIVED finished features: a file added later under a folder it implemented is not a stale baseline (it can't be
    // finished again where it is — drift exited 1 for good with a `finish` remedy that failed "not found"). Stale for a
    // real reason (a change request after the finish), the CLI line says to restore it first; finish of an archived
    // feature names the archive and the restore.
    S.manageFeature(w10d, "archive", "login-loop");
    const zArch10 = path.join(w10d, "src", "lib", "z3.ts");
    fs.writeFileSync(zArch10, "later\n");
    const drAr10 = S.drift(w10d);
    const drArNamed10 = S.drift(w10d, "login-loop");
    const arSt10 = path.join(w10d, ".specs", "_archive", "login-loop", ".state.json");
    const arKeep10 = fs.readFileSync(arSt10, "utf8");
    const arObj10 = JSON.parse(arKeep10);
    fs.writeFileSync(arSt10, JSON.stringify({ ...arObj10, changes: [...(arObj10.changes || []), { at: new Date(Date.now() + 1000).toISOString(), phase: "requirements", reopened: [] }] }, null, 2));
    const drArCr10 = S.drift(w10d, "login-loop");
    fs.writeFileSync(arSt10, arKeep10);
    const finAr10 = S.finishFeature(w10d, "login-loop", { write: true });
    const staleLine10 = (l, a) => S.msg(l).drift.stale("login-loop", "2026-01-01", "why", a);
    ok(drAr10.ok && drAr10.stale.length === 0 && drAr10.verdict === "clean" && drAr10.features.some((f) => f.feature === "login-loop" && f.archived && !f.drifted) &&
      drArNamed10.verdict === "clean" && drArNamed10.stale.length === 0 &&
      drArCr10.verdict === "stale" && drArCr10.stale.length === 1 && drArCr10.stale[0].archived === true && drArCr10.stale[0].newFiles.length === 0 &&
      finAr10.ok === false && /not found/.test(finAr10.error) && /it is archived \(\.specs\/_archive\/login-loop\): restore it first \(node "[^"]*dev-spec\.js" feature restore login-loop\)/.test(finAr10.error) &&
      ["en", "pt", "es"].every((l) => staleLine10(l, true).includes("" + S.DEV_SPEC + " feature restore login-loop") && staleLine10(l, true).includes("" + S.DEV_SPEC + " finish login-loop --write") &&
        !staleLine10(l, false).includes("feature restore")) &&
      ["pt", "es"].every((l) => S.msg(l).err.archivedHint("x").includes("" + S.DEV_SPEC + " feature restore x")),
      "an archived finished feature: a later file under its implemented folder is no stale baseline (drift clean, exit 0); a change request after its finish is (stale, archived) and the line says restore → finish → archive (EN/PT/ES); finish of an archived feature names the archive and the restore (got " +
      JSON.stringify([drAr10.verdict, drAr10.stale.map((x) => x.feature), drArCr10.verdict, finAr10.error]) + ")");
    fs.unlinkSync(zArch10);
    S.manageFeature(w10d, "restore", "login-loop");

    // PT / ES chrome.
    const w10pt = path.join(tmp, "proj-wp10-pt");
    S.initProject(w10pt, ["core"], "pt");
    S.createFeature(w10pt, "Pagamentos", ["core"]);
    req10(w10pt, "pagamentos", "1. **US-1.AC-1** — QUANDO o utilizador paga O SISTEMA DEVE guardar o recibo\n");
    const catPt = S.catalog(w10pt, { write: true });
    const mdPt = fs.readFileSync(path.join(w10pt, ".specs", "SPECS.md"), "utf8");
    ok(catPt.ok && catPt.lang === "pt" && /^# Catálogo de specs — proj-wp10-pt$/m.test(mdPt) && /<!-- AUTO-GERADO por dev-spec/.test(mdPt) && /## 🟡 pagamentos — em curso \(/.test(mdPt) &&
      /1 feature\(s\) · 1 critérios de aceitação — 1 em vigor, 0 substituído\(s\)/.test(mdPt) && /Não há nada arquivado como 'x'/.test(S.manageFeature(w10pt, "restore", "x").error) &&
      /Nenhuma feature fechada tem ainda uma baseline de drift/.test(S.drift(w10pt).note), "PT project: SPECS.md chrome (title, AUTO-GERADO marker, status, totals), restore and drift messages in Portuguese");
    const w10es = path.join(tmp, "proj-wp10-es");
    S.initProject(w10es, ["core"], "es");
    S.createFeature(w10es, "Pagos", ["core"]);
    const mdEs = S.catalog(w10es).markdown;
    ok(/^# Catálogo de specs — proj-wp10-es$/m.test(mdEs) && /AUTO-GENERADO por dev-spec/.test(mdEs) && /función\(es\)/.test(mdEs) && /en curso/.test(mdEs), "ES project: catalog chrome in Spanish");
  }

  { // 1.22 review — the drift hash reads a file in fixed-size pieces (it read it whole: null at 512 MiB, two copies in memory),
    // dropping each CR that precedes an LF across the pieces too — the digests are the old function's for every file.
    const E = require(path.join(__dirname, "lib", "engine", "index.js"));
    const crypto = require("crypto");
    const oldHash = (abs) => { try { if (!fs.statSync(abs).isFile()) return null; return crypto.createHash("sha1").update(fs.readFileSync(abs).toString("latin1").replace(/\r\n/g, "\n"), "latin1").digest("hex"); } catch { return null; } };
    const hd = path.join(tmp, "proj-122-filehash");
    fs.mkdirSync(hd, { recursive: true });
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const noisy = Buffer.from(Array.from({ length: 4000 }, () => { const r = rnd(); return r < 0.15 ? 0x0d : r < 0.3 ? 0x0a : r < 0.35 ? 0xff : 0x61 + Math.floor(rnd() * 26); }));
    const files = { "empty.txt": Buffer.alloc(0), "lf.txt": Buffer.from("a\nb\n"), "crlf.txt": Buffer.from("a\r\nb\r\n"), "cr-only.txt": Buffer.from("\r"), "cr-cr-lf.txt": Buffer.from("x\r\r\ny\r"),
      "boundary.txt": Buffer.from("ab\r\ncd\r\r\n\r\n"), "noisy.bin": noisy,
      // the default 1 MiB piece ends on the CR of a CRLF: the LF opens the next piece
      "big.txt": Buffer.concat([Buffer.alloc(1048575, 0x61), Buffer.from("\r\n" + "line\r\n".repeat(200000) + "tail\r")]) };
    const diffs = [];
    for (const [name, buf] of Object.entries(files)) {
      const abs = path.join(hd, name);
      fs.writeFileSync(abs, buf);
      for (const chunk of buf.length > 100000 ? [undefined, 65536, 1048576 - 7] : [1, 2, 3, 4, 7, 64, undefined]) if (E.fileHash(abs, chunk) !== oldHash(abs)) diffs.push(name + "@" + chunk);
    }
    // …and never as a whole: no readFileSync of the file (at 512 MiB its latin1 string could not exist — the old hash was null).
    const bigAbs = path.join(hd, "big.txt");
    const want = oldHash(bigAbs);
    const realReadFile = fs.readFileSync;
    let whole = 0, got = null;
    fs.readFileSync = function (p) { if (path.resolve(String(p)) === bigAbs) whole++; return realReadFile.apply(this, arguments); };
    try { got = E.fileHash(bigAbs); } finally { fs.readFileSync = realReadFile; }
    if (whole !== 0 || got !== want) diffs.push("big.txt read whole " + whole + "x");
    ok(!diffs.length && E.fileHash(path.join(hd, "missing.txt")) === null && E.fileHash(hd) === null && E.fileHash(path.join(hd, "boundary.txt"), 3) === E.fileHash(path.join(hd, "boundary.txt")),
      "1.22 review: fileHash in pieces (1, 2, 3, 4, 7, 64 bytes and the default 1 MiB — a CR on the boundaries) equals the old whole-file digest for CRLF / LF / CR-only / CR CR LF / an empty file / random bytes / a 2.2 MB file whose first piece ends on a CR — and never reads a file whole (no readFileSync); null for a missing file or a folder (got " + JSON.stringify(diffs) + ")");
  }

  { // --- 1.13 batch 8: spec_upgrade — meta.specVersion, the audit, the safe migrations, UPGRADE.md, the SessionStart notice ---
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    const hookJs = path.join(__dirname, "..", "hooks", "spec-hook.js");
    const sess = (dir) => spawnSync(process.execPath, [hookJs], { input: JSON.stringify({ hook_event_name: "SessionStart", cwd: dir }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } }).stdout || "";
    const sha1 = (t) => require("crypto").createHash("sha1").update(String(t).replace(/\r\n/g, "\n")).digest("hex");
    const ENGINE = require(path.join(root, "package.json")).version;
    const readJ = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
    const snapTree = (d) => {
      const out = {};
      const walk = (x) => { for (const e of fs.readdirSync(x, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) { const q = path.join(x, e.name); if (e.isDirectory()) walk(q); else out[path.relative(d, q)] = fs.readFileSync(q, "utf8"); } };
      walk(d);
      return JSON.stringify(out);
    };
    // A legacy project: scaffolded by this engine, then turned into what 1.12 left behind — no meta.specVersion, no saved
    // tracks, no approval history: `half` has a requirements approval whose fingerprint still matches, a design approval
    // whose file changed since and a date-only tasks approval (≤1.10), one task ticked; `done` is complete with a finish
    // baseline; `bug` has a 1.12 bugfix design approval (no fingerprint, no file); `old` sits in _archive/.
    const legacy16 = (dir, lang) => {
      S.initProject(dir, ["core", "tdd"], lang);
      const L = { draft: S.createFeature(dir, "Draft", ["core"]), half: S.createFeature(dir, "Half", ["tdd"]), done: S.createFeature(dir, "Done", ["core"]),
        bug: S.createFeature(dir, "Bug", undefined, "the export crashes", undefined, lang, "bugfix") };
      const old = S.createFeature(dir, "Old", ["core"]);
      fs.mkdirSync(path.join(dir, ".specs", "_archive"), { recursive: true });
      fs.renameSync(old.dir, path.join(dir, ".specs", "_archive", "old"));
      const rmF = path.join(dir, ".specs", "roadmap.json");
      const rm = readJ(rmF);
      delete rm.meta.specVersion;
      fs.writeFileSync(rmF, JSON.stringify(rm, null, 2));
      const state = (f, extra) => { const p = path.join(f.dir, ".state.json"); const st = readJ(p); delete st.tracks; delete st.createdAt; fs.writeFileSync(p, JSON.stringify(Object.assign(st, extra), null, 2)); };
      const req = fs.readFileSync(path.join(L.half.dir, "requirements.md"), "utf8");
      const des = fs.readFileSync(path.join(L.half.dir, "design.md"), "utf8");
      state(L.draft, {});
      state(L.half, { approvals: { requirements: { at: "2026-01-01T10:00:00.000Z", by: "old", fingerprint: sha1(req) },
        design: { at: "2026-01-02T10:00:00.000Z", by: "old", fingerprint: sha1(des) }, tasks: { at: "2026-01-03T10:00:00.000Z", by: "old" } } });
      fs.appendFileSync(path.join(L.half.dir, "design.md"), "\nA paragraph written after the design approval.\n");
      const tk = path.join(L.half.dir, "tasks.md");
      fs.writeFileSync(tk, fs.readFileSync(tk, "utf8").replace("- [ ]", "- [x]"));
      const dk = path.join(L.done.dir, "tasks.md");
      fs.writeFileSync(dk, fs.readFileSync(dk, "utf8").replace(/- \[ \]/g, "- [x]"));
      state(L.done, { finished: { at: "2026-02-01T10:00:00.000Z", files: {} } });
      state(L.bug, { approvals: { design: { at: "2026-01-05T10:00:00.000Z", by: "old" } } });
      return L;
    };

    // 1. The engine knows its version (package.json, read once) and compares versions numerically.
    ok(S.engineVersion() === ENGINE && S.compareSemver("1.9.0", "1.13.0") === -1 && S.compareSemver("1.13.0", "1.9.0") === 1 && S.compareSemver("v1.13.0", "1.13.0") === 0 &&
      S.compareSemver("1.13.0-beta.2", "1.13.0") === -1 && S.compareSemver("1.13.0-beta.2", "1.13.0-beta.10") === -1 && S.compareSemver("nope", "0.0.1") === -1,
      "engine version = package.json (" + S.engineVersion() + "); semver compared numerically (1.9.0 < 1.13.0), a pre-release before its release");

    // 2. The audit (read-only) of a legacy project, over MCP = the engine.
    const p16 = path.join(tmp, "proj-wp16-legacy");
    const L16 = legacy16(p16, "en");
    const before16 = snapTree(path.join(p16, ".specs"));
    const hookBefore16 = sess(p16);
    const impBefore16 = S.impactReport(p16, "half", { phase: "requirements" });
    const au16 = payload(await call("spec_upgrade", { projectDir: p16 }));
    const f16 = (r, n) => r.features.find((f) => f.name === n) || { history: {}, reviewArtifacts: [], legacyApprovals: [], changedSinceApproval: [] };
    ok(au16.ok && au16.from === null && au16.to === ENGINE && au16.needsUpgrade === true && au16.archived === 1 && au16.migrations === null &&
      au16.features.map((f) => f.name).join() === "bug,done,draft,half" && snapTree(path.join(p16, ".specs")) === before16 &&
      JSON.stringify(au16) === JSON.stringify(S.specUpgrade(p16)) && impBefore16.baseline === "fingerprint-only" &&
      /⬆ \.specs\/ was created with an older dev-spec \(before 1\.13\) — run \/spec-upgrade \(node \\?"[^"]*dev-spec\.js\\?" upgrade\) to review what isn't implemented yet/.test(hookBefore16),
      "spec_upgrade audit of a legacy .specs/ (no meta.specVersion): from null → " + ENGINE + ", needsUpgrade, the archived feature counted apart, nothing written, MCP = engine; SessionStart prints the one-line notice (got " +
      JSON.stringify([au16.from, au16.to, au16.archived, au16.features.map((f) => f.name)]) + ")");
    const d16 = f16(au16, "draft"), h16 = f16(au16, "half"), dn16 = f16(au16, "done"), b16 = f16(au16, "bug");
    ok(d16.status === "not-started" && d16.review === "critic" && d16.group === "blocked" && d16.tracksSource === "inferred" && d16.reviewArtifacts.includes("requirements.md") &&
      h16.status === "executing" && h16.review === "converge" && h16.tracks === "core +tdd" && (h16.history.seed || []).join() === "requirements" &&
      JSON.stringify(h16.history.skip) === JSON.stringify([{ phase: "design", reason: "changed" }, { phase: "tasks", reason: "no-fingerprint" }]) &&
      h16.legacyApprovals.join() === "tasks" && h16.changedSinceApproval.includes("design.md") && h16.attention.includes("re-approve") && h16.next && typeof h16.next.step === "string" &&
      dn16.status === "finished" && dn16.review === "none" && dn16.drift && dn16.drift.drifted === false &&
      b16.kind === "bugfix" && (b16.history.skip || []).some((x) => x.phase === "design" && x.reason === "untracked") &&
      au16.plan.tracks.length === 4 && au16.plan.specVersion.stamp === true && au16.plan.history.records === 4 &&
      JSON.stringify(au16.plan.history.seed) === JSON.stringify([{ feature: "half", phase: "requirements" }]) &&
      au16.summary.blocked + au16.summary.attention + au16.summary.ok === 4 && au16.lines.some((l) => /^Apply would change/.test(l)),
      "audit per feature: a template-only feature → not-started + review critic; a half-executed one → executing + converge, its matching approval seedable, the changed / date-only ones skipped; a finished one → none; a 1.12 bugfix design approval → untracked (got " +
      JSON.stringify([d16.status, d16.review, h16.status, h16.review, h16.history, dn16.status, dn16.review, b16.history]) + ")");

    // 3. apply: the safe migrations — never an artifact, an approval or a tick — then UPGRADE.md; the notice goes away.
    const stHalfBefore = readJ(path.join(L16.half.dir, ".state.json"));
    const tasksHalfBefore = fs.readFileSync(path.join(L16.half.dir, "tasks.md"), "utf8");
    const reqHalf = fs.readFileSync(path.join(L16.half.dir, "requirements.md"), "utf8");
    const designHalf = fs.readFileSync(path.join(L16.half.dir, "design.md"), "utf8");
    const ap16 = payload(await call("spec_upgrade", { apply: true, projectDir: p16 }));
    const m16 = ap16.migrations || { history: {}, specVersion: {}, tracks: [], report: {} };
    const stHalf = readJ(path.join(L16.half.dir, ".state.json"));
    const recs16 = (ph) => (stHalf.approvalHistory || []).filter((h) => h.phase === ph);
    ok(ap16.ok && m16.changed === true && m16.specVersion.stamped === true && m16.specVersion.from === null && m16.specVersion.to === ENGINE && S.readRoadmap(p16).meta.specVersion === ENGINE &&
      m16.tracks.length === 4 && ["draft", "half", "done", "bug"].every((n) => Array.isArray(readJ(path.join(p16, ".specs", n, ".state.json")).tracks)) &&
      JSON.stringify(m16.history.seeded) === JSON.stringify([{ feature: "half", phase: "requirements", snapshot: ".history/requirements@1.md" }]) &&
      fs.readFileSync(path.join(L16.half.dir, ".history", "requirements@1.md"), "utf8") === reqHalf &&
      recs16("requirements").length === 1 && recs16("requirements")[0].snapshot === ".history/requirements@1.md" && recs16("requirements")[0].legacy === true && !!recs16("requirements")[0].seededAt &&
      recs16("design").length === 1 && recs16("design")[0].snapshot === undefined && recs16("tasks").length === 1 && !fs.existsSync(path.join(L16.half.dir, ".history", "design@1.md")) &&
      JSON.stringify(stHalf.approvals) === JSON.stringify(stHalfBefore.approvals) && fs.readFileSync(path.join(L16.half.dir, "tasks.md"), "utf8") === tasksHalfBefore &&
      fs.readFileSync(path.join(L16.half.dir, "design.md"), "utf8") === designHalf &&
      m16.history.skipped.some((x) => x.feature === "half" && x.phase === "design" && x.reason === "changed") && m16.history.records === 4 && m16.report.written === true,
      "spec_upgrade {apply}: tracks saved, the matching approval gets .history/requirements@1.md (legacy record + seededAt), the changed / date-only ones are recorded without a snapshot, approvals / ticks / artifacts untouched, meta.specVersion stamped (got " +
      JSON.stringify([m16.changed, m16.specVersion, m16.history.seeded, m16.history.records]) + ")");
    const imp16 = S.impactReport(p16, "half", { phase: "requirements" });
    const upMd16 = fs.readFileSync(path.join(p16, ".specs", "UPGRADE.md"), "utf8");
    const hookAfter16 = sess(p16);
    ok(imp16.baseline === "snapshot" && imp16.changed === false && /AUTO-GENERATED by dev-spec/.test(upMd16.slice(0, 400)) && /^### draft — not started/m.test(upMd16) &&
      /^- \[ \] Review it with the spec-critic agent/m.test(upMd16) && /^## ⛔ Blocked — doctor fails$/m.test(upMd16) && /^- meta\.specVersion: none → /m.test(upMd16) &&
      !/⬆/.test(hookAfter16) && /features in \.specs/.test(hookAfter16) && f16(ap16, "draft").tracksSource === "state" && ap16.lines.some((l) => /^Report: \.specs\/UPGRADE\.md/.test(l)),
      "after apply: spec_impact diffs the seeded baseline (snapshot, unchanged), UPGRADE.md is a generated checklist, tracks come from the state, the SessionStart notice is gone");
    const beforeSecond16 = snapTree(path.join(p16, ".specs"));
    const ap16b = payload(await call("spec_upgrade", { apply: true, projectDir: p16 }));
    ok(ap16b.migrations.changed === false && ap16b.migrations.report.written === false && ap16b.needsUpgrade === false && ap16b.from === ENGINE &&
      ap16b.lines.includes("Nothing to migrate — .specs/ is already up to date; nothing was changed.") && snapTree(path.join(p16, ".specs")) === beforeSecond16,
      "a second apply changes nothing — no state, roadmap, .history or UPGRADE.md write — and says so");

    // 4. A brand-new project is stamped (spec_init, or its first spec_create) and never gets the notice; a legacy project is not
    // stamped by creating a feature or re-running spec_init.
    const n16 = path.join(tmp, "proj-wp16-new");
    S.initProject(n16, ["core"], "en");
    const stampInit16 = S.readRoadmap(n16).meta.specVersion;
    S.createFeature(n16, "First", ["core"]);
    const n16b = path.join(tmp, "proj-wp16-new-create");
    await call("spec_create", { name: "Solo", tracks: ["core"], projectDir: n16b });
    const g16 = path.join(tmp, "proj-wp16-legacy-create");
    legacy16(g16, "en");
    S.createFeature(g16, "Brand New", ["core"]);
    S.initProject(g16, ["core", "saas"], "en");
    await call("spec_create", { name: "Another", tracks: ["core"], projectDir: g16 });
    ok(stampInit16 === ENGINE && S.readRoadmap(n16b).meta.specVersion === ENGINE && !/⬆/.test(sess(n16)) && !/⬆/.test(sess(n16b)) && /first \[core\]/.test(sess(n16)) &&
      S.readRoadmap(g16).meta.specVersion === undefined && /⬆/.test(sess(g16)),
      "a brand-new project is stamped (spec_init / its first spec_create) and never shows the notice; creating features or re-running spec_init in a legacy project stamps nothing");

    // 5. A hand-written .specs/UPGRADE.md is never overwritten — the migrations still run.
    const w16 = path.join(tmp, "proj-wp16-handwritten");
    legacy16(w16, "en");
    const hand16 = "# Our upgrade notes\n\nWritten by hand.\n";
    fs.writeFileSync(path.join(w16, ".specs", "UPGRADE.md"), hand16);
    const hw16 = S.specUpgrade(w16, { apply: true });
    ok(hw16.ok && hw16.migrations.changed && hw16.migrations.report.written === false && /UPGRADE\.md exists and was not generated by dev-spec/.test(hw16.migrations.report.error || "") &&
      fs.readFileSync(path.join(w16, ".specs", "UPGRADE.md"), "utf8") === hand16 && hw16.lines.some((l) => /left untouched \(no report written\)/.test(l)) && S.readRoadmap(w16).meta.specVersion === ENGINE,
      "a hand-written .specs/UPGRADE.md is left untouched (the result says so); the migrations and the stamp still happen");

    // 6. A feature another process is updating (its .lock held): not migrated, reported, and meta.specVersion waits for the retry.
    const k16 = path.join(tmp, "proj-wp16-busy");
    const K16 = legacy16(k16, "en");
    const lock16 = path.join(K16.half.dir, ".lock");
    fs.writeFileSync(lock16, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), token: "held-by-the-test" }));
    const prevWait16 = process.env.DEV_SPEC_LOCK_WAIT_MS;
    process.env.DEV_SPEC_LOCK_WAIT_MS = "0";
    let busy16;
    try { busy16 = S.specUpgrade(k16, { apply: true }); } finally {
      if (prevWait16 === undefined) delete process.env.DEV_SPEC_LOCK_WAIT_MS; else process.env.DEV_SPEC_LOCK_WAIT_MS = prevWait16;
    }
    const stampBusy16 = S.readRoadmap(k16).meta.specVersion;
    const tracksBusy16 = readJ(path.join(K16.half.dir, ".state.json")).tracks;
    fs.rmSync(lock16, { force: true });
    const retry16 = S.specUpgrade(k16, { apply: true });
    ok(busy16.ok && busy16.migrations.errors.length === 1 && busy16.migrations.errors[0].feature === "half" && /updating 'half'/.test(busy16.migrations.errors[0].error) &&
      busy16.migrations.specVersion.stamped === false && stampBusy16 === undefined && tracksBusy16 === undefined && busy16.lines.some((l) => /not migrated: half/.test(l)) &&
      retry16.migrations.errors.length === 0 && retry16.migrations.specVersion.stamped === true && S.readRoadmap(k16).meta.specVersion === ENGINE,
      "a feature whose lock another process holds is reported (not migrated) and meta.specVersion stays unstamped until a retry completes");

    // 7. An older stamp gets the notice with its version; a newer one is never lowered and gets none.
    const o16 = path.join(tmp, "proj-wp16-stamps");
    S.initProject(o16, ["core"], "en");
    S.createFeature(o16, "One", ["core"]);
    const setStamp16 = (v) => { const f = path.join(o16, ".specs", "roadmap.json"); const rm = readJ(f); rm.meta.specVersion = v; fs.writeFileSync(f, JSON.stringify(rm, null, 2)); };
    setStamp16("1.12.1");
    const olderHook16 = sess(o16), olderSt16 = S.specVersionStatus(o16);
    setStamp16("9.0.0");
    const newer16 = S.specUpgrade(o16, { apply: true });
    ok(olderSt16.behind && olderSt16.from === "1.12.1" && /older dev-spec \(1\.12\.1\)/.test(olderHook16) && newer16.newer === true && newer16.needsUpgrade === false &&
      newer16.migrations.changed === false && S.readRoadmap(o16).meta.specVersion === "9.0.0" && !/⬆/.test(sess(o16)) && newer16.lines.some((l) => /newer dev-spec \(9\.0\.0\)/.test(l)),
      "an older stamp (1.12.1) gets the notice naming it; a newer stamp (9.0.0) is never lowered, needs no upgrade and says the plugin is older");

    // 8. PT: the lines, the notice and UPGRADE.md in the project language.
    const pt16 = path.join(tmp, "proj-wp16-pt");
    legacy16(pt16, "pt");
    const ptAu16 = S.specUpgrade(pt16);
    const ptHook16 = sess(pt16);
    const ptAp16 = S.specUpgrade(pt16, { apply: true });
    const ptMd16 = fs.readFileSync(path.join(pt16, ".specs", "UPGRADE.md"), "utf8");
    ok(ptAu16.lang === "pt" && ptAu16.lines.some((l) => /feature\(s\) ativa\(s\)/.test(l)) && ptAu16.lines.some((l) => /por começar/.test(l)) && ptAu16.lines.some((l) => /^O apply mudaria/.test(l)) &&
      /⬆ \.specs\/ foi criado com um dev-spec mais antigo \(anterior à 1\.13\) — corre \/spec-upgrade/.test(ptHook16) &&
      /AUTO-GERADO por dev-spec/.test(ptMd16) && /^## Migrações$/m.test(ptMd16) && /^- \[ \] Revê-a com o agente spec-critic/m.test(ptMd16) && ptAp16.lines.some((l) => /^Migrações aplicadas/.test(l)),
      "PT project: the audit lines, the SessionStart notice and UPGRADE.md are in European Portuguese");

    // 9. Every upgrade message exists in EN, PT and ES; the MCP schema refuses a non-boolean apply; no .specs/ is an error.
    const keys16 = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys16(v, pre + k + ".") : [pre + k])).sort();
    const en16 = JSON.stringify(keys16(S.msg("en").upgrade));
    const badArg16 = await call("spec_upgrade", { apply: "yes", projectDir: p16 });
    const noSpecs16 = await call("spec_upgrade", { projectDir: path.join(tmp, "proj-wp16-empty") });
    ok(["pt", "es"].every((l) => JSON.stringify(keys16(S.msg(l).upgrade)) === en16) && badArg16.result.isError && /apply must be a boolean/.test(badArg16.result.content[0].text) &&
      noSpecs16.result.isError && /No \.specs\/ at/.test(noSpecs16.result.content[0].text) && !fs.existsSync(path.join(tmp, "proj-wp16-empty")),
      "upgrade messages exist in EN / PT / ES with the same keys; spec_upgrade {apply: 'yes'} is an argument error; a project without .specs/ is an error (nothing created)");
  }

  { // 1.22 review 2 — a feature approved before 1.22 with bare AC-n IDs fails doctor's ears / traceability now: the upgrade audit names
    // them (attention bare-ac-ids, an item to renumber them US-<story>.AC-<n> with their references, then re-approve — in UPGRADE.md
    // too) and never edits the spec. On a copy of the demo whose api-keys criteria, tasks and plan were numbered AC-11, AC-12 …
    const js = JSON.stringify;
    const p = path.join(tmp, "proj-122r2-bare-upgrade");
    fs.cpSync(path.join(root, "examples", "demo-project"), p, { recursive: true });
    const dir = path.join(p, ".specs", "api-keys");
    for (const f of ["requirements.md", "design.md", "test-plan.md", "tasks.md"]) {
      const fp = path.join(dir, f);
      if (fs.existsSync(fp)) fs.writeFileSync(fp, fs.readFileSync(fp, "utf8").replace(/US-(\d+)\.AC-(\d+)/g, (m, a, b) => "AC-" + a + b));
    }
    const rmFile = path.join(p, ".specs", "roadmap.json"); // stamped by 1.21.1: the apply below stamps it again and writes UPGRADE.md
    fs.writeFileSync(rmFile, fs.readFileSync(rmFile, "utf8").replace(/"specVersion": "[^"]*"/, '"specVersion": "1.21.1"'));
    const reqBefore = fs.readFileSync(path.join(dir, "requirements.md"), "utf8");
    const au = payload(await rpc("tools/call", { name: "spec_upgrade", arguments: { projectDir: p } }));
    const fa = (au.features || []).find((f) => f.name === "api-keys") || {};
    const fu = (au.features || []).find((f) => f.name === "usage-metering") || {};
    const ap = S.specUpgrade(p, { apply: true });
    const md = fs.readFileSync(path.join(p, ".specs", "UPGRADE.md"), "utf8");
    const U = (l) => S.msg(l).upgrade.item.bareAcIds("AC-1, AC-2", "x");
    ok(js(fa.bareAcIds) === '["AC-11","AC-12","AC-13","AC-14","AC-21"]' && (fa.attention || []).includes("bare-ac-ids") && fa.group === "blocked" &&
      js(fu.bareAcIds) === "[]" && !(fu.attention || []).includes("bare-ac-ids") &&
      au.lines.some((l) => /^ {6}- Renumber the criteria requirements\.md numbers with bare IDs \(AC-11, AC-12, AC-13, AC-14, AC-21\) as US-<story>\.AC-<n> — and their references in tasks\.md and test-plan\.md — then re-approve/.test(l)) &&
      /^- \[ \] Renumber the criteria requirements\.md numbers with bare IDs \(AC-11/m.test(md) && fs.readFileSync(path.join(dir, "requirements.md"), "utf8") === reqBefore && ap.ok &&
      /^Renumera os critérios que o requirements\.md identifica com IDs soltos \(AC-1, AC-2\) como US-<história>\.AC-<n>/.test(U("pt")) &&
      /^Renumera los criterios que requirements\.md identifica con IDs sueltos \(AC-1, AC-2\) como US-<historia>\.AC-<n>/.test(U("es")),
      "1.22 review 2: spec_upgrade names criteria numbered with bare AC-n IDs (bareAcIds, attention bare-ac-ids, an item to renumber them US-<story>.AC-<n> with their tasks / test-plan references, then re-approve — EN / PT / ES, in UPGRADE.md too) and never edits the spec; a US-n.AC-m feature has none (got " +
      js([fa.bareAcIds, fa.attention, fu.bareAcIds, au.lines.filter((l) => /Renumber/.test(l))]) + ")");
    // review 3 — a CHANGE has no tasks.md nor test-plan.md (its tasks live in change.md): the item names its tasks' _Requirements:_
    const pc = path.join(tmp, "proj-122r3-bare-change");
    S.initProject(pc, ["core"], "en");
    const ch = S.createFeature(pc, "Tweak", undefined, "", undefined, "en", undefined, { size: "xs" });
    const chFile = path.join(ch.dir, "change.md");
    fs.writeFileSync(chFile, fs.readFileSync(chFile, "utf8").replace(/US-(\d+)\.AC-(\d+)/g, (m, a, b) => "AC-" + a + b));
    const auC = S.specUpgrade(pc);
    const fc = (auC.features || []).find((f) => f.name === ch.slug) || {};
    const lineC = (auC.lines || []).find((l) => /Renumber/.test(l)) || "";
    const UC = (l) => S.msg(l).upgrade.item.bareAcIds("AC-1", "x", "change.md");
    ok(fc.criteriaFile === "change.md" && (fc.bareAcIds || []).length > 0 && /Renumber the criteria change\.md numbers with bare IDs .* — and their references in its tasks' _Requirements:_ \(in change\.md too\) — then re-approve/.test(lineC) &&
      !/tasks\.md and test-plan\.md/.test(lineC) && /nos _Requirements:_ das suas tarefas \(também no change\.md\)/.test(UC("pt")) && !/test-plan/.test(UC("pt")) &&
      /en los _Requirements:_ de sus tareas \(también en change\.md\)/.test(UC("es")) && !/test-plan/.test(UC("es")) && /tasks\.md and test-plan\.md/.test(U("en")),
      "1.22 review 3 (9): the bare-ID upgrade item for a change names its tasks' _Requirements:_ in change.md — never tasks.md / test-plan.md, which a change has not (EN / PT / ES); a feature's item is unchanged (got " +
      js([fc.criteriaFile, fc.bareAcIds, lineC, UC("pt"), UC("es")]) + ")");
  }

  { // 1.14 B4.1 — forecasts on the roadmap: _Size:_ points, tick timestamps, velocity, ETA (dependencies chained), surfaces
    const callB4 = (name, args) => rpc("tools/call", { name, arguments: args });
    const setStateB4 = (dir, patch) => {
      const f = path.join(dir, ".state.json");
      fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(fs.readFileSync(f, "utf8")), ...patch }, null, 2));
    };
    const sizeBlocks = S.taskBlocks("# Tasks\n\n- [ ] 1. One\n  - _Size: XS_\n- [ ] 2. Two _Size: s_\n- [ ] 3. Three\n  - _Size: `XL`_\n- [ ] 4. Four\n  - _Size: XXL_\n" +
      "- [ ] 5. Five\n  ```md\n  - _Size: L_\n  ```\n- [ ] 6. Six\n  - _Size: M_\n- [ ] 7. Seven\n  - _Size: L_\n");
    const sizes = sizeBlocks.map((b) => S.taskSize(b));
    ok(JSON.stringify(sizes) === JSON.stringify(["XS", "S", "XL", null, null, "M", "L"]) && JSON.stringify(S.SIZE_POINTS) === '{"XS":1,"S":2,"M":3,"L":5,"XL":8}',
      "taskSize: _Size: XS|S|M|L|XL_ on the task line or a sub-line (any case, backticks) → XS=1 S=2 M=3 L=5 XL=8; XXL and a fenced example are unsized (got " + JSON.stringify(sizes) + ")");

    // Ticks: when each task was ticked (state.ticks[n] = ISO).
    const tpB4 = path.join(tmp, "proj-b4-ticks");
    S.initProject(tpB4, ["core"], "en");
    const tfB4 = S.createFeature(tpB4, "Ticks", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(tfB4.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] One\n- [ ] 2. [US1] Two\n  - _Verify: npm test_\n- [ ] 3. [US1] Three\n");
    const beforeB4 = Date.now();
    const t1B4 = S.completeTask(tpB4, "ticks", 1);
    const tick1 = (S.readState(tpB4, "ticks").ticks || {})["1"];
    const t1againB4 = S.completeTask(tpB4, "ticks", 1);
    const tick1again = S.readState(tpB4, "ticks").ticks["1"];
    const failB4 = S.completeTask(tpB4, "ticks", 2, { command: "npm test", exitCode: 1 });
    const stFailB4 = S.readState(tpB4, "ticks");
    const passB4 = S.completeTask(tpB4, "ticks", 2, { command: "npm test", exitCode: 0 });
    const stPassB4 = S.readState(tpB4, "ticks");
    ok(t1B4.ok && typeof tick1 === "string" && Date.parse(tick1) >= beforeB4 - 1000 && Date.parse(tick1) <= Date.now() + 1000 && t1againB4.ok && t1againB4.alreadyDone && tick1again === tick1 &&
      failB4.ok === false && stFailB4.ticks["2"] === undefined && stFailB4.evidence["2"].exitCode === 1 &&
      passB4.ok && typeof stPassB4.ticks["2"] === "string" && stPassB4.evidence["2"].exitCode === 0,
      "spec_complete_task records when a task is ticked (state.ticks[n] = ISO): a re-complete keeps the first tick, a failed run records no tick (its evidence stays), a passing run records both (got " + JSON.stringify([tick1, stFailB4.ticks, stPassB4.ticks]) + ")");
    const stFileB4 = path.join(tfB4.dir, ".state.json");
    setStateB4(tfB4.dir, { ticks: "hand edit" });
    const t3B4 = S.completeTask(tpB4, "ticks", 3);
    ok(t3B4.ok && JSON.parse(fs.readFileSync(stFileB4, "utf8")).ticks === "hand edit" && /- \[x\] 3\./.test(fs.readFileSync(path.join(tfB4.dir, "tasks.md"), "utf8")),
      "a hand-edited `ticks` that is not an object is left as it is (never repaired) — the task still ticks");

    // Velocity / ETA from dated ticks, "today" injected (a Wednesday).
    const NOW_B4 = "2026-06-10T12:00:00Z";
    const fpB4 = path.join(tmp, "proj-b4-forecast");
    S.initProject(fpB4, ["core"], "en");
    const mkB4 = (proj, name, tasks) => { const f = S.createFeature(proj, name, ["core"], "", undefined, "en"); if (tasks != null) fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" + tasks); return f; };
    const coreB4 = mkB4(fpB4, "Core API",
      "- [x] 1. [US1] Schema\n  - _Size: L_\n- [x] 2. [US1] Endpoints\n  - _Size: L_\n- [x] 3. [US1] Auth\n  - _Size: M_\n  - _Verify: npm test_\n" +
      "- [x] 4. [US1] Paging\n  - _Size: M_\n- [x] 5. [US1] Old work\n  - _Size: S_\n- [x] 6. [US1] Ticked by hand\n  - _Size: XS_\n" +
      "- [ ] 7. [US1] Filters\n  - _Size: M_\n- [ ] 8. [US1] Sorting\n- [ ] 9. [US1] Bulk import\n  - _Size: XL_\n");
    setStateB4(coreB4.dir, { ticks: { 1: "2026-06-01T09:00:00Z", 2: "2026-06-02T15:00:00Z", 4: "2026-06-05T11:00:00Z", 5: "2026-04-01T10:00:00Z" },
      evidence: { 3: { command: "npm test", exitCode: 0, at: "2026-06-09T10:00:00Z",
        history: [{ command: "npm test", exitCode: 1, at: "2026-06-03T09:00:00Z" }, { command: "npm test", exitCode: 0, at: "2026-06-04T10:00:00Z" }, { command: "npm test", exitCode: 0, at: "2026-06-09T10:00:00Z" }] } } });
    mkB4(fpB4, "Reports", "- [ ] 1. [US1] Report view\n  - _Size: M_\n- [ ] 2. [US1] CSV\n  - _Size: M_\n");
    mkB4(fpB4, "Bulk export", "- [ ] 1. [US1] Export job\n  - _Size: S_\n");
    mkB4(fpB4, "Draft", null); // the scaffold's tasks only: not broken into tasks
    mkB4(fpB4, "Later", "- [ ] 1. [US1] Later thing\n");
    mkB4(fpB4, "Shipped", "- [x] 1. [US1] Done long ago\n");
    S.setDependency(fpB4, "bulk-export", ["reports"]);
    S.setDependency(fpB4, "later", ["draft"]);
    const fcB4 = S.forecastData(fpB4, S.roadmap(fpB4).features, { now: NOW_B4 });
    const FB4 = fcB4.byFeature;
    ok(fcB4.velocity.completed === 4 && fcB4.velocity.points === 16 && fcB4.velocity.since === "2026-06-01" && fcB4.velocity.workingDays === 8 && fcB4.velocity.pointsPerDay === 2 && fcB4.velocity.enough === true,
      "velocity = points completed per working day over the last 28 days — ticks plus a task's first passing evidence run (a later re-check is not the completion); a tick outside the window and a hand tick don't count (got " + JSON.stringify(fcB4.velocity) + ")");
    ok(FB4["core-api"].eta === "2026-06-18" && JSON.stringify(FB4["core-api"].range) === '["2026-06-17","2026-06-22"]' && FB4["core-api"].remainingPoints === 14 &&
      FB4["core-api"].unsizedTasks === 1 && FB4["core-api"].velocity === "feature" && FB4["core-api"].workingDays === 7 && FB4["core-api"].pointsPerDay === 2,
      "ETA: 14 open points (M + an unsized task = the feature's median 3 + XL) ÷ 2 points/day = 7 working days from Wed 2026-06-10 → 2026-06-18, ±25% → 06-17…06-22 (got " + JSON.stringify(FB4["core-api"]) + ")");
    ok(FB4.reports.eta === "2026-06-12" && FB4.reports.velocity === "project" && FB4["bulk-export"].eta === "2026-06-15" && JSON.stringify(FB4["bulk-export"].range) === '["2026-06-15","2026-06-17"]' &&
      JSON.stringify(FB4["bulk-export"].after) === '["reports"]' && FB4["bulk-export"].eta > FB4.reports.eta,
      "a feature blocked by an unfinished dependency forecasts after it (bulk-export starts the working day after reports' ETA, Fri 06-12 → Mon 06-15); without completions of its own a feature uses the project velocity (got " + JSON.stringify([FB4.reports, FB4["bulk-export"]]) + ")");
    ok(FB4.draft.eta === null && FB4.draft.reason === "no-tasks" && FB4.later.eta === null && FB4.later.reason === "dependency" && JSON.stringify(FB4.later.after) === '["draft"]' &&
      FB4.shipped.reason === "done",
      "no ETA for a feature not broken into tasks (no-tasks), one waiting on a dependency that has none (dependency, after: [draft]) or a done one (got " + JSON.stringify([FB4.draft, FB4.later, FB4.shipped]) + ")");

    const npB4 = path.join(tmp, "proj-b4-nodata");
    S.initProject(npB4, ["core"], "en");
    const soloB4 = mkB4(npB4, "Solo", "- [x] 1. [US1] A\n- [x] 2. [US1] B\n- [ ] 3. [US1] C\n");
    setStateB4(soloB4.dir, { ticks: { 1: "2026-06-08T10:00:00Z", 2: "2026-06-09T10:00:00Z" } });
    const ndB4 = S.roadmapData(npB4, { now: NOW_B4 });
    const ndMdB4 = S.renderRoadmapMd(npB4, "en", ndB4);
    ok(ndB4.rmv.velocity.enough === false && ndB4.rmv.velocity.completed === 2 && ndB4.rmv.features[0].forecast.reason === "not-enough-data" && ndB4.rmv.features[0].forecast.eta === null &&
      /_Velocity: not enough data yet — 2 of the 3 completed tasks a forecast needs in the last 28 days_/.test(ndMdB4) && /\| #3 C \| — \|$/m.test(ndMdB4) && !/ETA = remaining points/.test(ndMdB4),
      "fewer than 3 completed tasks in the window: not enough data — no ETA ('—' in the column), the roadmap says so and shows no ETA rule");

    const fdB4 = S.roadmapData(fpB4, { now: NOW_B4 });
    const mdB4 = S.renderRoadmapMd(fpB4, "en", fdB4);
    const mdPtB4 = S.renderRoadmapMd(fpB4, "pt", fdB4);
    const htmlB4 = S.renderRoadmapHtml(fpB4, "es", fdB4);
    ok(/\| Next \| ETA \|\n\|---\|---\|---\|---\|---\|---\|---\|---\|---\|/.test(mdB4) && /\[core-api\]\(\.\/core-api\/requirements\.md\) .*\| 2026-06-18 \(06-17…06-22\) \|$/m.test(mdB4) &&
      /\[bulk-export\].*\| 2026-06-15 \(06-15…06-17\) \|$/m.test(mdB4) && /\[later\].*\| — \|$/m.test(mdB4) && /\[shipped\].*\| — \|$/m.test(mdB4) &&
      /_Velocity: 2 point\(s\)\/working day — 4 task\(s\), 16 point\(s\) completed since 2026-06-01 \(last 28 days\)_/.test(mdB4) && /ETA = remaining points ÷ velocity, in working days \(±25%\)/.test(mdB4),
      "ROADMAP.md: an ETA column (the date and its range, '—' without one), the project velocity line and the ETA rule");
    ok(/\| Próxima \| Previsão \|/.test(mdPtB4) && /\[core-api\].*\| 2026-06-18 \(06-17…06-22\) \|$/m.test(mdPtB4) && /_Velocidade: 2 ponto\(s\)\/dia útil — 4 tarefa\(s\), 16 ponto\(s\) concluídos desde 2026-06-01/.test(mdPtB4) &&
      /Previsão = pontos por fazer ÷ velocidade, em dias úteis \(±25%\)/.test(mdPtB4),
      "ROADMAP.md in Portuguese: the Previsão column, the Velocidade line and the rule in European Portuguese");
    ok(/<th>Previsión<\/th>/.test(htmlB4) && /<td class="eta">2026-06-18 \(06-17…06-22\)<\/td>/.test(htmlB4) && /Velocidad: 2 punto\(s\)\/día laborable/.test(htmlB4) && !/https?:\/\//.test(htmlB4),
      "ROADMAP.html (ES): the Previsión column and the velocity line — still offline (no URL)");

    const mB4 = S.metrics(fpB4, "core-api", { now: NOW_B4 });
    const mpB4 = S.metrics(fpB4, undefined, { now: NOW_B4 });
    ok(mB4.velocity.pointsPerDay === 2 && mB4.velocity.completed === 4 && S.metricsLines(mB4).includes("  velocity: 2 point(s)/working day (4 task(s), 16 point(s) since 2026-06-01, last 28 days)") &&
      mpB4.velocity.pointsPerDay === 2 && mpB4.velocity.enough === true && S.metricsLines(mpB4).some((l) => /^ {2}velocity: 2 point\(s\)\/working day/.test(l)) &&
      /velocity: no completed task in the last 28 days/.test(S.metricsLines(S.metrics(fpB4, "reports", { now: NOW_B4 })).join("\n")),
      "spec_metrics carries velocity — the feature's own and the project's — and metricsLines prints it");

    // MCP = engine (real "today": ticks recorded now by spec_complete_task over MCP).
    const lpB4 = path.join(tmp, "proj-b4-live");
    S.initProject(lpB4, ["core"], "pt");
    mkB4(lpB4, "Agora", "- [ ] 1. [US1] A\n  - _Size: S_\n- [ ] 2. [US1] B\n  - _Size: S_\n- [ ] 3. [US1] C\n  - _Size: S_\n- [ ] 4. [US1] D\n  - _Size: L_\n");
    for (const n of [1, 2, 3]) await callB4("spec_complete_task", { name: "agora", number: n, projectDir: lpB4 });
    const mRmB4 = payload(await callB4("spec_roadmap", { projectDir: lpB4 }));
    const eRmB4 = S.roadmapReport(lpB4);
    const mMetB4 = payload(await callB4("spec_metrics", { projectDir: lpB4 }));
    const pick = (r) => JSON.stringify([r.velocity, r.overlaps, r.features.map((f) => [f.name, f.forecast])]);
    ok(mRmB4.velocity.enough === true && mRmB4.velocity.completed === 3 && typeof mRmB4.features[0].forecast.eta === "string" && pick(mRmB4) === pick(eRmB4) &&
      JSON.stringify(mMetB4.velocity) === JSON.stringify(S.metrics(lpB4).velocity) && /Velocidade: /.test(S.renderRoadmapMd(lpB4, "pt")),
      "MCP spec_roadmap returns the engine's velocity / forecast / overlaps (ticks recorded over MCP); spec_metrics carries the same velocity (got " + pick(mRmB4).slice(0, 300) + ")");
    const mdStr = (fs.readFileSync(path.join(__dirname, "server.js"), "utf8").match(/name: "spec_roadmap",\s*description: "([^"\\]|\\.)*"/) || [""])[0];
    ok(/_Size: XS\|S\|M\|L\|XL_/.test(mdStr) && /cross-feature-overlap/.test(mdStr) && /not-enough-data/.test(mdStr), "spec_roadmap's description documents _Size:_, the forecast reasons and the overlaps");

    const keysB4 = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keysB4(v, pre + k + ".") : [pre + k])).sort().join();
    ok(keysB4(S.msg("en").forecast) === keysB4(S.msg("pt").forecast) && keysB4(S.msg("en").forecast) === keysB4(S.msg("es").forecast),
      "the forecast / overlap messages exist in EN, PT and ES with the same keys");
  }

  { // 1.14 B4.2 — cross-feature file overlap: roadmapData pairs, ROADMAP attention, doctor warn, SessionStart line
    const callB4 = (name, args) => rpc("tools/call", { name, arguments: args });
    const opB4 = path.join(tmp, "proj-b4-overlap");
    S.initProject(opB4, ["core"], "en");
    const mkO = (name, tasks) => { const f = S.createFeature(opB4, name, ["core"], "", undefined, "en"); fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n" + tasks); return f; };
    mkO("Billing", "- [ ] 1. [US1] Invoice model\n  - _Implements: src/billing/invoice.js:10_\n- [ ] 2. [US1] Money util\n  - _Implements: ./src/util/money.js#L5_\n- [x] 3. [US1] Done one\n  - _Implements: src/done.js_\n");
    mkO("Refunds", "- [ ] 1. [US1] Refund flow\n  - _Implements: `src/util/`_\n- [ ] 2. [US1] Refund model\n  - _Implements: src/refunds/refund.js_\n- [ ] 3. [US1] Touch the done file\n  - _Implements: src/done.js_\n");
    mkO("Payouts", "- [ ] 1. [US1] Payout invoice\n  - _Implements: src/billing/invoice.js#L20_\n");
    const searchO = mkO("Search", "- [ ] 1. [US1] Index\n  - _Implements: src/search/index.js, src/search/query.js_\n- [ ] 2. [US1] Docs\n  - _Implements: docs/search/*.md_\n");
    mkO("Notes", "- [ ] 1. [US1] Notes\n  - _Implements: src/notes/notes.js_\n");
    const legacyO = mkO("Legacy", "- [x] 1. [US1] Old invoices\n  - _Implements: src/billing/legacy.js_\n");
    const stL = path.join(legacyO.dir, ".state.json");
    fs.writeFileSync(stL, JSON.stringify({ ...JSON.parse(fs.readFileSync(stL, "utf8")), finished: { at: "2026-06-01T00:00:00Z", files: { "src/billing/legacy.js": "abc", "docs/search/intro.md": null } } }, null, 2));
    const ovB4 = S.featureOverlaps(opB4);
    const pairB4 = (a, b) => ovB4.pairs.find((p) => p.a === a && p.b === b) || {};
    ok(ovB4.pairs.length === 3 && JSON.stringify(ovB4.pairs.map((p) => p.a + "/" + p.b)) === '["billing/payouts","billing/refunds","search/legacy"]' &&
      pairB4("billing", "payouts").kind === "active" && JSON.stringify(pairB4("billing", "payouts").files) === '["src/billing/invoice.js"]' &&
      JSON.stringify(pairB4("billing", "refunds").files) === '["src/util/money.js"]' &&
      pairB4("search", "legacy").kind === "finished" && JSON.stringify(pairB4("search", "legacy").files) === '["docs/search/intro.md"]' && ovB4.truncated === false,
      "featureOverlaps: the same file however spelled (:10 / #L20 anchors), a folder covering a file (src/util/ ⊃ src/util/money.js), a glob matching a finished feature's baseline file; a DONE task's file, sibling files and disjoint features never pair (got " + JSON.stringify(ovB4) + ")");

    const chk = (f) => S.specDoctor(opB4, f).checks.find((c) => c.id === "cross-feature-overlap");
    const dBill = chk("billing"), dRef = chk("refunds"), dSearch = chk("search");
    ok(dBill && dBill.status === "warn" && /payouts \(src\/billing\/invoice\.js\); refunds \(src\/util\/money\.js\)/.test(dBill.detail) && /spec_depend/.test(dBill.detail) && /_Supersedes:/.test(dBill.detail) &&
      dRef && dRef.status === "warn" && /billing \(src\/util\/money\.js\)/.test(dRef.detail) &&
      dSearch && /finished feature recorded in its drift baseline — legacy \(docs\/search\/intro\.md\)/.test(dSearch.detail) && /_Supersedes: <feature>\/US-n\.AC-m_/.test(dSearch.detail) &&
      !chk("legacy") && !chk("notes"),
      "spec_doctor: a warn 'cross-feature-overlap' on both features of an active pair and on the active side of a finished pair (suggesting spec_depend / _Supersedes:_); none on the finished feature nor on a disjoint one (got " + JSON.stringify([dBill, dSearch]) + ")");

    const omdB4 = S.renderRoadmapMd(opB4, "en");
    const attB4 = omdB4.split("## ⚠")[1] || "";
    ok(/- \*\*billing\*\* — plans the same files as payouts: src\/billing\/invoice\.js — order them \(spec_depend\) or declare _Supersedes:_/.test(attB4) &&
      /- \*\*billing\*\* — plans the same files as refunds: src\/util\/money\.js/.test(attB4) &&
      /- \*\*search\*\* — plans files in legacy's finish baseline: docs\/search\/intro\.md — declare _Supersedes: legacy\/US-n\.AC-m_/.test(attB4) &&
      !/\*\*(refunds|payouts|notes|legacy)\*\* — plans/.test(attB4) && /planeia os mesmos ficheiros que payouts/.test(S.renderRoadmapMd(opB4, "pt")),
      "ROADMAP.md 'needs attention' names each overlap once, on its active side (PT too)");

    const hkB4 = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "SessionStart" }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: opB4 } });
    let ctxB4 = "";
    try { ctxB4 = JSON.parse(hkB4.stdout).hookSpecificOutput.additionalContext; } catch { /* no output */ }
    ok(ctxB4.split("\n").filter((l) => /overlap/.test(l)).length === 1 && /⚠ 3 cross-feature file overlap\(s\): billing ↔ payouts, billing ↔ refunds, search → legacy — run \/spec-doctor/.test(ctxB4),
      "SessionStart prints ONE line naming the overlapping pairs (got " + JSON.stringify(ctxB4.slice(-300)) + ")");

    const mDocB4 = payload(await callB4("spec_doctor", { name: "billing", projectDir: opB4 }));
    const mRmB4 = payload(await callB4("spec_roadmap", { projectDir: opB4 }));
    ok(JSON.stringify(mDocB4.checks.find((c) => c.id === "cross-feature-overlap")) === JSON.stringify(dBill) && JSON.stringify(mRmB4.overlaps) === JSON.stringify(ovB4.pairs),
      "MCP spec_doctor / spec_roadmap carry the same overlap check and pairs as the engine");

    // Ordered by a dependency, or declared with _Supersedes:_ → no longer an overlap.
    S.setDependency(opB4, "payouts", ["billing"]);
    fs.appendFileSync(path.join(searchO.dir, "requirements.md"), "\n- **US-9.AC-1** — WHEN a search runs THE SYSTEM SHALL use the new index _Supersedes: legacy/US-1.AC-1_\n");
    const ov2B4 = S.featureOverlaps(opB4);
    const hk2B4 = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "SessionStart" }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: opB4 } });
    ok(JSON.stringify(ov2B4.pairs.map((p) => p.a + "/" + p.b)) === '["billing/refunds"]' && !chk("payouts") && !chk("search") && /⚠ 1 cross-feature file overlap\(s\): billing ↔ refunds —/.test(hk2B4.stdout),
      "no overlap once the pair is ordered by a dependency (payouts → billing) or the active feature declares _Supersedes:_ of the finished one's criteria (got " + JSON.stringify(ov2B4.pairs) + ")");
    const globB4 = path.join(tmp, "proj-b4-globs");
    S.initProject(globB4, ["core"], "en");
    for (const [name, imp] of [["Api all", "src/api/**"], ["Api v2", "src/api/v2/*.js"], ["Lib css", "lib/**/*.css"], ["Lib js", "lib/a.js"], ["Styles dir", "styles/"], ["Styles glob", "styles/**/*.css"]]) {
      const f = S.createFeature(globB4, name, ["core"], "", undefined, "en");
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Work\n  - _Implements: " + imp + "_\n");
    }
    const ovG = S.featureOverlaps(globB4).pairs;
    ok(JSON.stringify(ovG.map((p) => [p.a, p.b, p.files])) === '[["api-all","api-v2",["src/api/**"]],["styles-dir","styles-glob",["styles"]]]',
      "globs: a glob pairs with another glob it matches (src/api/** ⊇ src/api/v2/*.js) and with a folder holding its literal part (styles/ ⊇ styles/**/*.css); lib/**/*.css never pairs with lib/a.js (got " + JSON.stringify(ovG) + ")");
    const cleanB4 = path.join(tmp, "proj-b4-clean");
    S.initProject(cleanB4, ["core"], "en");
    const c1 = S.createFeature(cleanB4, "One", ["core"], "", undefined, "en");
    const c2 = S.createFeature(cleanB4, "Two", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(c1.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] A\n  - _Implements: src/one/a.js, src/shared-one.js_\n- [ ] 2. [US1] Later\n  - _Implements: TBD_\n- [ ] 3. [US1] Else\n  - _Implements: [path]_\n");
    fs.writeFileSync(path.join(c2.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] B\n  - _Implements: src/one-two/b.js, src/shared.js_\n- [ ] 2. [US1] Later\n  - _Implements: tbd_\n- [ ] 3. [US1] Else\n  - _Implements: [path]_\n");
    const hk3B4 = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "spec-hook.js")], { input: JSON.stringify({ hook_event_name: "SessionStart" }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: cleanB4 } });
    ok(S.featureOverlaps(cleanB4).pairs.length === 0 && !S.specDoctor(cleanB4, "one").checks.some((c) => c.id === "cross-feature-overlap") && !/overlap/.test(hk3B4.stdout) &&
      !/plans the same files/.test(S.renderRoadmapMd(cleanB4, "en")),
      "no false positive for disjoint files (src/one/ vs src/one-two/, shared-one.js vs shared.js) nor for stand-ins both write (TBD, [path]): no pair, no doctor check, no hook line, no attention line");
    // 1.22 review — doctor walks the roadmap for overlaps only when an OPEN task of the feature plans a file (_Implements:_): a pair
    // needs one. The answer is the walk's for every feature — the quiet one's DONE task names billing's open file, a finished one.
    mkO("Quiet", "- [ ] 1. [US1] Talk it through\n- [x] 2. [US1] Done before\n  - _Implements: src/billing/invoice.js_\n");
    const same22 = ["billing", "refunds", "payouts", "search", "notes", "legacy", "quiet"].map((n) => {
      const c = chk(n);
      const pairs = S.featureOverlaps(opB4, undefined, { only: n }).pairs;
      return [n, !!c, pairs.length > 0];
    });
    // …and for such a feature doctor reads no other feature's tasks.md (the walk did: roadmap() over every feature).
    const realRF = fs.readFileSync;
    const otherTasks = [];
    fs.readFileSync = function (p) { const s = String(p).replace(/\\/g, "/"); if (/\/\.specs\/(?!quiet\/)[^/]+\/tasks\.md$/.test(s)) otherTasks.push(s); return realRF.apply(this, arguments); };
    try { S.specDoctor(opB4, "quiet"); } finally { fs.readFileSync = realRF; }
    ok(same22.every(([, d, w]) => d === w) && same22.filter(([, d]) => d).map(([n]) => n).join() === "billing,refunds" && !chk("quiet") && otherTasks.length === 0,
      "1.22 review: doctor's cross-feature-overlap (computed only when an open task plans a file — no other feature's tasks.md read otherwise) agrees with featureOverlaps {only} for every feature — none for a feature whose only _Implements:_ is a done task's (got " + JSON.stringify([same22, otherTasks.length]) + ")");
  }

  { // 1.14 C2 — the decision log (decisions.md, spec_decide) and the spike kind (investigate → decide)
    const c2Call = async (tool, args) => payload(await rpc("tools/call", { name: tool, arguments: args }));
    const c2Dir = (n) => path.join(tmp, "c2-" + n);
    const c2Read = (f, rel) => fs.readFileSync(path.join(f.dir, rel), "utf8");
    const c2Tick = () => { const until = Date.now() + 15; while (Date.now() < until) { /* a later millisecond for the next timestamp */ } };
    const c2Chk = (doc, id) => (doc.checks || []).find((c) => c.id === id);
    const BOM = String.fromCharCode(0xfeff);

    // --- C2.1 spec_decide: numbering, the file, canonical refs, the header / labels, the result.
    const d1 = c2Dir("log");
    S.initProject(d1, ["tdd"], "en");
    const f1 = S.createFeature(d1, "Auth", ["tdd"], "", undefined, "en");
    const dec1 = await c2Call("spec_decide", { projectDir: d1, name: "auth", title: "JWT sessions", decision: "Use JWT with a 15 min expiry.\nRefresh tokens rotate.",
      context: "The API is stateless.", consequences: "A refresh endpoint is needed.", affects: ["us-1.ac-2, t-2", "data models"] });
    const log1 = c2Read(f1, "decisions.md");
    const dec2 = S.decide(d1, "auth", { title: "  Clock skew\n tolerated ", decision: "Tokens accept 30 s of skew.", kind: "discovery", supersedes: "D-1" });
    const log2 = c2Read(f1, "decisions.md");
    const parsed = S.decisionLog(log2);
    ok(dec1.ok && dec1.id === "D-1" && dec1.n === 1 && dec1.created === true && dec1.file === ".specs/auth/decisions.md" && dec1.kind === "decision" &&
      JSON.stringify(dec1.affects) === '["US-1.AC-2","T-2","Data Models"]' && /^Recorded D-1 \(decision\) in \.specs\/auth\/decisions\.md\.$/.test(dec1.message) &&
      /^# Decisions: Auth\n\n<!-- Decision log — append-only/.test(log1) && /\n## D-1 — JWT sessions\n\n- _Kind: decision_\n- _Date: \d{4}-\d\d-\d\dT[\d:.]+Z_\n- _Affects: US-1\.AC-2, T-2, Data Models_\n\n\*\*Context:\*\* The API is stateless\.\n\n\*\*Decision:\*\* Use JWT with a 15 min expiry\.\nRefresh tokens rotate\.\n\n\*\*Consequences:\*\* A refresh endpoint is needed\.\n$/.test(log1) &&
      dec2.ok && dec2.id === "D-2" && dec2.created === false && dec2.title === "Clock skew tolerated" && JSON.stringify(dec2.supersedes) === '["D-1"]' && log2.startsWith(log1) &&
      /\n## D-2 — Clock skew tolerated\n\n- _Kind: discovery_\n- _Date: [^_]+_\n- _Supersedes: D-1_\n\n\*\*Discovery:\*\* Tokens accept 30 s of skew\.\n$/.test(log2) &&
      parsed.length === 2 && parsed[0].decision === "Use JWT with a 15 min expiry.\nRefresh tokens rotate." && parsed[0].context === "The API is stateless." &&
      parsed[1].kind === "discovery" && parsed[1].at > parsed[0].at && JSON.stringify(parsed[1].supersedes) === '["D-1"]',
      "C2 spec_decide appends D-1, D-2 to decisions.md (localized header on creation; markers _Kind/_Date/_Affects/_Supersedes; Context / Decision (Discovery) / Consequences); refs canonical (US-1.AC-2, T-2, the heading 'Data Models'); the old bytes kept; decisionLog reads it back (got " +
      JSON.stringify([dec1.affects, dec2.title, log1.slice(0, 80)]) + ")");

    // Append-only: after a hand-written D-7 → D-8; an entry in an HTML comment or a fenced block is none; CRLF + BOM kept.
    const d2 = c2Dir("crlf");
    S.initProject(d2, ["core"], "en");
    const f2 = S.createFeature(d2, "Pay", ["core"], "", undefined, "en");
    const hand = BOM + "# Decisions: Pay\r\n\r\n<!-- example: ## D-99 — not an entry -->\r\n\r\n## D-7 — Stripe first\r\n\r\n- _Kind: decision_\r\n- _Date: 2026-01-02_\r\n\r\n**Decision:** Stripe.\r\n\r\n```md\r\n## D-50 — inside a fence\r\n```\r\n";
    fs.writeFileSync(path.join(f2.dir, "decisions.md"), hand);
    const dec3 = S.decide(d2, "pay", { title: "Webhooks retried", decision: "Retry 5 times." });
    const log3 = c2Read(f2, "decisions.md");
    const noEol = "# Decisions: Pay\n\n## D-1 — X\n\n**Decision:** x";
    const d2b = c2Dir("noeol");
    S.initProject(d2b, ["core"], "en");
    const f2b = S.createFeature(d2b, "Pay", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(f2b.dir, "decisions.md"), noEol);
    S.decide(d2b, "pay", { title: "Y", decision: "y" });
    const log3b = c2Read(f2b, "decisions.md");
    ok(dec3.ok && dec3.id === "D-8" && log3.startsWith(hand) && log3.slice(hand.length).startsWith("\r\n## D-8 — Webhooks retried\r\n") && !/[^\r]\n/.test(log3) &&
      S.decisionLog(log3).map((e) => e.id).join() === "D-7,D-8" && S.decisionLog(log3)[0].decision === "Stripe.\n\n```md\n## D-50 — inside a fence\n```" &&
      log3b.startsWith(noEol + "\n\n## D-2 — Y\n"),
      "C2 spec_decide is append-only: numbered after the highest D-n (a D-99 in a comment / D-50 in a fence is no entry); a BOM + CRLF file keeps its bytes and gets a CRLF entry; a file without a final newline is only appended to");

    // Validation: unknown _Affects:_ / _Supersedes:_, missing title / decision, bad kind — an error, nothing written.
    const before1 = c2Read(f1, "decisions.md");
    const bad1 = S.decide(d1, "auth", { title: "t", decision: "d", affects: ["US-1.AC-2", "US-9.AC-9", "T-99", "SC-042", "Nowhere Section"] });
    const bad2 = S.decide(d1, "auth", { title: "t", decision: "d", supersedes: ["D-9", "X-1"] });
    const bad3 = S.decide(d1, "auth", { title: " ", decision: "d" });
    const bad4 = S.decide(d1, "auth", { title: "t" });
    const bad5 = S.decide(d1, "auth", { title: "t", decision: "d", kind: "idea" });
    const bad6 = await c2Call("spec_decide", { projectDir: d1, name: "auth", decision: "d" });
    const bad7 = await rpc("tools/call", { name: "spec_decide", arguments: { projectDir: d1, name: "auth", title: "t", decision: "d", affects: "US-1.AC-2" } });
    const d1b = c2Dir("none");
    S.initProject(d1b, ["core"], "en");
    const f1b = S.createFeature(d1b, "Nolog", ["core"], "", undefined, "en");
    const bad8 = S.decide(d1b, "nolog", { title: "t", decision: "d", affects: "T-01" });
    ok(bad1.ok === false && JSON.stringify(bad1.unknownAffects) === '["US-9.AC-9","T-99","SC-042","Nowhere Section"]' && /^unknown _Affects:_ reference\(s\): US-9\.AC-9, T-99, SC-042, Nowhere Section — .*Nothing was written\.$/.test(bad1.error) &&
      bad2.ok === false && /_Supersedes:_ must name decisions already in this log \(D-n\): D-9, X-1/.test(bad2.error) &&
      bad3.ok === false && /needs a title/.test(bad3.error) && bad4.ok === false && /needs its text/.test(bad4.error) && bad5.ok === false && /kind must be decision or discovery \(got "idea"\)/.test(bad5.error) &&
      bad6.ok === false && /Missing required argument\(s\): title/.test(bad6.error) && bad7.result && bad7.result.isError === true &&
      c2Read(f1, "decisions.md") === before1 && bad8.ok === false && !fs.existsSync(path.join(f1b.dir, "decisions.md")),
      "C2 spec_decide validates before writing: unknown AC / T-ID / SC / section in _Affects:_ (listed, unknownAffects), unknown _Supersedes:_, no title / decision, a bad kind, a non-array affects over MCP — nothing written, no file created (got " +
      JSON.stringify([bad1.error, bad6.error]).slice(0, 300) + ")");

    // Text can't fake entries: a heading, a marker line, an HTML comment and an unclosed fence in the user's text are neutralized.
    const tricky = S.decide(d1, "auth", { title: "Tricky <!-- x", decision: "## D-40 — fake\n- _Affects: US-9.AC-9_\n<!-- hide the rest\n```js\nconst a = 1;" });
    const decT = S.decide(d1, "auth", { title: "After tricky", decision: "still numbered", affects: "Architecture" });
    const logT = S.decisionLog(c2Read(f1, "decisions.md"));
    ok(tricky.ok && tricky.id === "D-3" && decT.ok && decT.id === "D-4" && logT.map((e) => e.id).join() === "D-1,D-2,D-3,D-4" && logT[2].affects.length === 0 &&
      logT[2].title === "Tricky &lt;!-- x" && logT[3].affects.join() === "Architecture",
      "C2 a decision's own text can't fake or hide entries (a heading / _Affects:_ line escaped, <!-- neutralized, an open fence closed) — the next entry is still D-4 with its markers");

    // --- the brief: the current entries citing the task's ACs / T-IDs (superseded ones out; bounded; write:true keeps the IDs).
    const br3 = S.taskBrief(d1, "auth", 3);
    const br2 = S.taskBrief(d1, "auth", 2);
    const br3w = S.taskBrief(d1, "auth", 3, { write: true });
    ok(br3.ok && JSON.stringify((br3.decisions || []).map((x) => x.id)) === "[]" && !/## Decisions/.test(br3.brief) && br2.ok && !br2.decisions,
      "C2 brief: a superseded entry (D-1 by D-2) is never inlined; a task citing nothing an entry names gets no Decisions section");
    S.decide(d1, "auth", { title: "Rotate keys monthly", decision: "Signing keys rotate every 30 days.", affects: "T-03, US-1.AC-3" });
    const br3b = S.taskBrief(d1, "auth", 3);
    const br3bw = S.taskBrief(d1, "auth", 3, { write: true });
    const br4 = S.taskBrief(d1, "auth", 4);
    ok(br3b.decisions.map((x) => x.id).join() === "D-5" && /## Decisions\nDecisions and discoveries \(decisions\.md\) that cite this task's criteria or tests — respect them:\n- \*\*D-5\*\* — Rotate keys monthly _\(decision · T-03, US-1\.AC-3\)_: Signing keys rotate every 30 days\./.test(br3b.brief) &&
      br3bw.refs && JSON.stringify(br3bw.refs.decisions) === '["D-5"]' && !br3bw.decisions && !br4.decisions && br3w.refs && !br3w.refs.decisions,
      "C2 brief inlines the entry citing the task's T-ID / AC (T-03 ↔ _Makes green: T-03_) with its kind and _Affects:_; write:true keeps only refs.decisions; another task's brief has none");
    for (let i = 0; i < 6; i++) S.decide(d1, "auth", { title: "Rule " + i, decision: "Detail " + i, affects: "US-1.AC-1" });
    const br2b = S.taskBrief(d1, "auth", 2);
    ok(br2b.decisions.map((x) => x.id).join() === "D-7,D-8,D-9,D-10,D-11" && JSON.stringify(br2b.decisionsOmitted) === '["D-6"]' && /…and D-6 — see decisions\.md\./.test(br2b.brief),
      "C2 brief is bounded: at most 5 entries (the most recent), the rest named (got " + JSON.stringify([br2b.decisions.map((x) => x.id), br2b.decisionsOmitted]) + ")");

    // --- merge summary, export, catalog.
    const fin1 = S.finishFeature(d1, "auth");
    const exp1 = S.exportSpecs(d1, { name: "auth", format: "md" });
    const cat1 = S.catalog(d1, { write: true });
    const catF1 = cat1.features.find((x) => x.feature === "auth");
    const specsMd = fs.readFileSync(path.join(d1, ".specs", "SPECS.md"), "utf8");
    ok(/\n## Decisions\n- ~~\*\*D-1\*\* — JWT sessions~~ _\(superseded: D-2\)_\n- \*\*D-2\*\* — Clock skew tolerated _\(discovery · supersedes D-1\)_: Tokens accept 30 s of skew\.\n/.test(fin1.mergeSummary) &&
      /- `\.specs\/auth\/decisions\.md`/.test(fin1.mergeSummary) &&
      exp1.ok && /\n## Decisions\n[\s\S]*### D-5 — Rotate keys monthly/.test(exp1.content) &&
      catF1.kind === "feature" && catF1.decisions.count === 11 && catF1.decisions.items[0].supersededBy === "D-2" && catF1.decisions.items[4].title === "Rotate keys monthly" &&
      /- 📝 Decisions \(11\): ~~D-1 JWT sessions~~ · D-2 Clock skew tolerated · D-3 /.test(specsMd),
      "C2 the decision log in the merge summary (superseded struck through, the file in Spec), the export's Decisions section, the catalog (count + titles, superseded marked) and SPECS.md");
    const specsBefore = specsMd;
    S.decide(d1, "auth", { title: "Refresh on write", decision: "SPECS.md follows." });
    ok(fs.readFileSync(path.join(d1, ".specs", "SPECS.md"), "utf8") !== specsBefore && /D-12 Refresh on write/.test(fs.readFileSync(path.join(d1, ".specs", "SPECS.md"), "utf8")),
      "C2 spec_decide refreshes SPECS.md once it exists (the catalog lists the new entry)");

    // --- doctor: decision-affects-approved after an approval; gone after re-approval; trace_check phantom _Affects:_ (warnings).
    const d3 = c2Dir("doctor");
    S.initProject(d3, ["tdd"], "en");
    const f3 = S.createFeature(d3, "Orders", ["tdd"], "", undefined, "en");
    S.decide(d3, "orders", { title: "Before approval", decision: "early", affects: "US-1.AC-1" });
    for (const ph of ["classification", "requirements", "design"]) S.approvePhase(d3, "orders", ph, "t", { force: true });
    const doc3a = S.specDoctor(d3, "orders");
    c2Tick();
    S.decide(d3, "orders", { title: "Cap order size", decision: "Max 50 items.", affects: "US-1.AC-2, EC-1" });
    S.decide(d3, "orders", { title: "Async fulfilment", decision: "Queue it.", affects: "Architecture" });
    const doc3b = S.specDoctor(d3, "orders");
    const w3 = c2Chk(doc3b, "decision-affects-approved");
    c2Tick();
    S.approvePhase(d3, "orders", "requirements", "t", { force: true });
    const doc3c = S.specDoctor(d3, "orders");
    ok(!c2Chk(doc3a, "decision-affects-approved") && w3 && w3.status === "warn" && /D-2 \(US-1\.AC-2, EC-1\) after requirements\.md was approved \(\d{4}-\d\d-\d\d\)/.test(w3.detail) &&
      /D-3 \(Architecture\) after design\.md was approved/.test(w3.detail) && /spec_impact orders --phase requirements \| design/.test(w3.detail) && !/D-1/.test(w3.detail) &&
      c2Chk(doc3c, "decision-affects-approved") && !/D-2/.test(c2Chk(doc3c, "decision-affects-approved").detail) && /D-3/.test(c2Chk(doc3c, "decision-affects-approved").detail),
      "C2 doctor warns decision-affects-approved for decisions recorded after the approval of requirements.md (their AC / EC IDs) or design.md (their sections) — not an older one; re-approving requirements clears its part (got " + JSON.stringify(w3) + ")");
    fs.appendFileSync(path.join(f3.dir, "decisions.md"), "\n## D-4 — Hand-written\n\n- _Kind: decision_\n- _Date: 2026-01-01_\n- _Affects: US-9.AC-9, Ghost Section, T-01_\n\n**Decision:** x\n");
    const tr3 = await c2Call("trace_check", { projectDir: d3, name: "orders" });
    const doc3d = S.specDoctor(d3, "orders");
    ok(tr3.ok && JSON.stringify(tr3.phantomAffects.map((p) => p.decision + ":" + p.ref)) === '["D-4:US-9.AC-9","D-4:Ghost Section"]' && !S.traceGaps(tr3).some((g) => g.kind === "phantomAffects") &&
      c2Chk(doc3d, "decision-affects").status === "warn" && /D-4 → US-9\.AC-9, D-4 → Ghost Section/.test(c2Chk(doc3d, "decision-affects").detail) &&
      S.affectsWarnings(tr3, "en")[0] === "D-4 _Affects:_ US-9.AC-9 — names nothing in this feature (a typo, or a criterion / test / section removed since)" &&
      Array.isArray(S.traceCheck(d1b, "nolog").phantomAffects) && S.traceCheck(d1b, "nolog").phantomAffects.length === 0,
      "C2 trace_check reports _Affects:_ references that name nothing (phantomAffects — a warning, never a gap); doctor warns decision-affects; a feature without a log has phantomAffects: []");

    // --- PT / ES logs: localized header and labels, read back by the parser (the brief shows the text).
    const d4 = c2Dir("pt");
    S.initProject(d4, ["tdd"], "pt");
    const f4 = S.createFeature(d4, "Faturas", ["tdd"], "", undefined, "pt");
    const dec4 = S.decide(d4, "faturas", { title: "PDF no servidor", decision: "Gerar o PDF no servidor.", context: "Clientes antigos.", affects: "US-1.AC-2" });
    const f5 = S.createFeature(d4, "Pagos", ["tdd"], "", undefined, "es");
    S.decide(d4, "pagos", { title: "Reintentos", decision: "Tres reintentos.", kind: "discovery", affects: "T-03" });
    const br4pt = S.taskBrief(d4, "faturas", 3);
    ok(dec4.ok && /^# Decisões: Faturas\n/.test(c2Read(f4, "decisions.md")) && /\*\*Contexto:\*\* Clientes antigos\.\n\n\*\*Decisão:\*\* Gerar o PDF no servidor\./.test(c2Read(f4, "decisions.md")) &&
      /^D-1 \(decisão\) registada em/.test(dec4.message) && /^# Decisiones: Pagos\n/.test(c2Read(f5, "decisions.md")) && /\*\*Descubrimiento:\*\* Tres reintentos\./.test(c2Read(f5, "decisions.md")) &&
      /## Decisões\n.*\n- \*\*D-1\*\* — PDF no servidor _\(decisão · US-1\.AC-2\)_: Gerar o PDF no servidor\./.test(br4pt.brief) && S.decisionLog(c2Read(f5, "decisions.md"))[0].decision === "Tres reintentos.",
      "C2 decision logs in PT / ES: localized header and labels (Contexto / Decisão, Descubrimiento), read back by the parser; the PT brief's Decisions section");

    // 1.22 review — _Affects:_ can name a heading holding "," / ";" (the size-S "Decisions, reuse & risks" and its PT / ES twins,
    // "[API] Pagination, Idempotency & Concurrency"): written `quoted`, split outside backticks, and the unquoted form rejoined
    // when its pieces together name a heading. The log reads back clean (no phantom), and a hand-written unquoted entry too.
    const d22 = c2Dir("affects-commas");
    S.initProject(d22, ["core"], "en");
    const sizedS = [["Small", "en", "Decisions, reuse & risks"], ["Pequena", "pt", "Decisões, reutilização e riscos"], ["Chica", "es", "Decisiones, reutilización y riesgos"]]
      .map(([n, l, h]) => [S.createFeature(d22, n, ["core"], "", undefined, l, "feature", { size: "s" }), h]);
    const api22 = S.createFeature(d22, "Api", ["api"], "", undefined, "en");
    const r22 = sizedS.map(([f, h]) => S.decide(d22, f.slug, { title: "Cache the token", decision: "In memory.", affects: h + "; US-1.AC-1" }));
    const q22 = S.decide(d22, "small", { title: "Quoted", decision: "q", affects: ["`Decisions, reuse & risks`", "US-1.AC-2"] });
    const a22 = S.decide(d22, "api", { title: "Cursor pages", decision: "Opaque cursors.", affects: "Pagination, Idempotency & Concurrency, US-1.AC-1" });
    const bad22 = S.decide(d22, "small", { title: "Typo", decision: "x", affects: "Decisions, reuse & rsks" });
    const rd22 = (ft) => { try { return c2Read(ft, "decisions.md"); } catch { return ""; } }; // (no log when every decide was refused)
    const log22 = rd22(sizedS[0][0]);
    fs.appendFileSync(path.join(sizedS[0][0].dir, "decisions.md"), "\n## D-9 — By hand\n\n- _Kind: decision_\n- _Date: 2026-09-01T00:00:00.000Z_\n- _Affects: Decisions, reuse & risks_\n\n**Decision:** typed without quotes.\n");
    const tr22 = S.traceCheck(d22, "small");
    ok(r22.every((r, i) => r.ok && JSON.stringify(r.affects) === JSON.stringify([sizedS[i][1], "US-1.AC-1"])) &&
      /^- _Affects: `Decisions, reuse & risks`, US-1\.AC-1_$/m.test(log22) && /^- _Affects: `Decisões, reutilização e riscos`, US-1\.AC-1_$/m.test(rd22(sizedS[1][0])) &&
      q22.ok && JSON.stringify(q22.affects) === '["Decisions, reuse & risks","US-1.AC-2"]' &&
      a22.ok && JSON.stringify(a22.affects) === '["[API] Pagination, Idempotency & Concurrency","US-1.AC-1"]' && /`\[API\] Pagination, Idempotency & Concurrency`, US-1\.AC-1_/.test(rd22(api22)) &&
      bad22.ok === false && JSON.stringify(bad22.unknownAffects) === '["Decisions","reuse & rsks"]' &&
      S.decisionLog(log22)[0].affects.join("|") === "Decisions, reuse & risks|US-1.AC-1" && tr22.phantomAffects.length === 0 &&
      ["pequena", "chica", "api"].every((n) => S.traceCheck(d22, n).phantomAffects.length === 0),
      "1.22 review: spec_decide takes a heading holding ',' / ';' — unquoted (rejoined), quoted, EN / PT / ES size-S and +api headings — writes it `quoted`, reads it back whole; a typo is still unknown; a hand-written unquoted entry is no phantom (got " +
      JSON.stringify([r22.map((r) => r.affects || r.error), q22.affects, a22.affects, bad22.unknownAffects, tr22.phantomAffects]) + ")");

    // --- C2.2 the spike kind: scaffold EN / PT / ES, question + timebox, no planning chain, core-only.
    const d6 = c2Dir("spike");
    S.initProject(d6, ["core"], "en");
    const sp1 = await c2Call("spec_create", { projectDir: d6, name: "Cache spike", kind: "spike", question: "Can Redis hold the sessions under 5 ms p95?", timebox: "3d", tracks: ["saas"] });
    const spDir = path.join(d6, ".specs", "cache-spike");
    const spMd = fs.readFileSync(path.join(spDir, "spike.md"), "utf8");
    const spSt = JSON.parse(fs.readFileSync(path.join(spDir, ".state.json"), "utf8"));
    const in3 = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    ok(sp1.ok && sp1.kind === "spike" && sp1.label === "core" && JSON.stringify(sp1.created) === '["spike.md","tasks.md"]' && sp1.timebox === in3 &&
      /A spike is core-only — tracks ignored \(\+saas\)/.test(sp1.note) && spSt.kind === "spike" && JSON.stringify(spSt.tracks) === '["core"]' &&
      !fs.existsSync(path.join(spDir, "requirements.md")) && !fs.existsSync(path.join(spDir, "design.md")) &&
      /^# Spike: Cache spike\n/.test(spMd) && /\n## Question\nCan Redis hold the sessions under 5 ms p95\?\n\n## Timebox\n\*\*Until:\*\* \d{4}-\d\d-\d\d \(3d\)\n\n## Options considered\n/.test(spMd) &&
      /\n## Evidence\n/.test(spMd) && /\n## Decision\n> \*\*TODO\*\*/.test(spMd) && /_Outcome: \[go \| no-go \| pivot\]_/.test(spMd) && /\n## Follow-up\n/.test(spMd) &&
      /## Phase: Investigate\n- \[ \] 1\. \[shared\] Sharpen the question/.test(fs.readFileSync(path.join(spDir, "tasks.md"), "utf8")),
      "C2 spec_create {kind: 'spike'} scaffolds spike.md (Question · Timebox Until · Options · Evidence · Decision + _Outcome:_ · Follow-up) + investigation tasks — core-only (tracks ignored, noted), no requirements / design (got " +
      JSON.stringify([sp1.created, sp1.note, sp1.timebox]) + ")");
    const spPt = S.createFeature(d6, "Pesquisa fila", undefined, "Kafka ou RabbitMQ?", undefined, "pt", "spike");
    const spEs = S.createFeature(d6, "Investigar colas", undefined, "", undefined, "es", "spike", { timebox: "2026-10-30" });
    const mdPt = fs.readFileSync(path.join(spPt.dir, "spike.md"), "utf8");
    const mdEs = fs.readFileSync(path.join(spEs.dir, "spike.md"), "utf8");
    ok(spPt.ok && /\n## Pergunta\nKafka ou RabbitMQ\?\n\n## Timebox \(prazo\)\n> \*\*TODO\*\*/.test(mdPt) && /\n## Opções consideradas\n/.test(mdPt) && /\n## Decisão\n/.test(mdPt) &&
      /^# Tasks: Pesquisa fila\n[\s\S]*## Fase: Investigação/.test(fs.readFileSync(path.join(spPt.dir, "tasks.md"), "utf8")) &&
      spEs.ok && /\n## Pregunta\n> \*\*TODO\*\*/.test(mdEs) && /\n## Timebox \(plazo\)\n\*\*Hasta:\*\* 2026-10-30\n/.test(mdEs) && /\n## Evidencia\n/.test(mdEs) && /\n## Seguimiento\n/.test(mdEs) &&
      /^# Tareas: Investigar colas/.test(fs.readFileSync(path.join(spEs.dir, "tasks.md"), "utf8")) &&
      S.spikeInfo(spPt.dir).questionFilled === true && S.spikeInfo(spEs.dir).questionFilled === false && S.spikeInfo(spEs.dir).timebox.date === "2026-10-30",
      "C2 spike scaffolds in PT / ES (Pergunta / Pregunta, Timebox (prazo / plazo), Decisão, Evidencia, Seguimiento; the summary becomes the question) and spikeInfo reads them");
    const badTb = S.createFeature(d6, "Bad timebox", undefined, "", undefined, "en", "spike", { timebox: "soon" });
    const badTb2 = S.createFeature(d6, "Bad date", undefined, "", undefined, "en", "spike", { timebox: "2026-02-30" });
    const notSpike = S.createFeature(d6, "Plain", ["core"], "", undefined, "en", "feature", { question: "why?" });
    const badKind = await c2Call("spec_create", { projectDir: d6, name: "x", kind: "spik" });
    ok(badTb.ok === false && /timebox must be an end date \(YYYY-MM-DD\) or a duration from today \(e\.g\. 3d, 2w, 8h\) — got "soon"/.test(badTb.error) && badTb2.ok === false &&
      !fs.existsSync(path.join(d6, ".specs", "bad-timebox")) && notSpike.ok === false && /question only applies to a spike/.test(notSpike.error) && !fs.existsSync(path.join(d6, ".specs", "plain")) &&
      badKind.ok === false && /kind must be one of: feature, bugfix, spike/.test(badKind.error),
      "C2 spike inputs are validated first: a bad timebox / an impossible date, a question on a non-spike, an unknown kind — refused, nothing created");

    // Gates: none to approve (the execution sign-off apart), no tracks.
    const apSp = S.approvePhase(d6, "cache-spike", "requirements", "t");
    const apSpF = S.approvePhase(d6, "cache-spike", "tasks", "t", { force: true });
    const atSp = S.addTrack(d6, "cache-spike", "tdd");
    const docSp0 = S.specDoctor(d6, "cache-spike");
    ok(apSp.ok === false && apSp.spike === true && /'cache-spike' is a spike: it has no requirements gate/.test(apSp.error) && apSpF.ok === false &&
      atSp.ok === false && /is a spike — it has no tracks/.test(atSp.error) && docSp0.kind === "spike" && docSp0.gatesOk === true && docSp0.pendingGates.length === 0 &&
      docSp0.checks.map((c) => c.id + ":" + c.status).join() === "question:pass,decision:fail,timebox:pass" && docSp0.verdict === "fail" && docSp0.phase === "tasks-ready",
      "C2 a spike has no requirements / design / tasks gates (approve refuses, even forced) and no tracks (add_track refuses); its doctor: question pass, decision fail, timebox pass (got " +
      JSON.stringify(docSp0.checks) + ")");

    // doctor: timebox passed with no decision (warn), no end date, a decision without an outcome (warn), decided.
    const spFile = path.join(spDir, "spike.md");
    const setSp = (fn) => fs.writeFileSync(spFile, fn(fs.readFileSync(spFile, "utf8")));
    setSp((t) => t.replace(/\*\*Until:\*\* \S+/, "**Until:** 2020-01-06"));
    const docSp1 = S.specDoctor(d6, "cache-spike");
    const na1 = S.nextAction(d6, "cache-spike");
    setSp((t) => t.replace("**Until:** 2020-01-06", "two days of effort"));
    const docSp2 = S.specDoctor(d6, "cache-spike");
    setSp((t) => t.replace("two days of effort", "**Until:** 2020-01-06"));
    ok(c2Chk(docSp1, "timebox").status === "warn" && /the timebox ended on 2020-01-06 and no decision is recorded/.test(c2Chk(docSp1, "timebox").detail) &&
      /The timebox ended on 2020-01-06: decide with the evidence you have\./.test(na1.recommendation) &&
      c2Chk(docSp2, "timebox").status === "warn" && /no end date/.test(c2Chk(docSp2, "timebox").detail),
      "C2 spike doctor warns timebox once its end date passed with no decision (next_action says so too), and when the timebox has no end date");

    // next_action: fill the question → investigate (tasks) → record the decision → go / no-go / pivot.
    const spBare = S.createFeature(d6, "Queue spike", undefined, "", undefined, "en", "spike");
    const naQ = S.nextAction(d6, "queue-spike");
    const naT = S.nextAction(d6, "cache-spike");
    for (const n of [1, 2, 3, 4]) S.completeTask(d6, "cache-spike", n);
    const naD = S.nextAction(d6, "cache-spike");
    const phD = S.detectPhase(spDir, ["core"]);
    setSp((t) => t.replace(/> \*\*TODO\*\* — go \/ no-go \/ pivot, and why: the evidence that decided it\./, "Redis held 2 ms p95 under a 5k rps load run."));
    const naO = S.nextAction(d6, "cache-spike");
    const docO = S.specDoctor(d6, "cache-spike");
    setSp((t) => t.replace("_Outcome: [go | no-go | pivot]_", "_Outcome: go_"));
    const naGo = await c2Call("spec_next_action", { projectDir: d6, name: "cache-spike" });
    const docGo = S.specDoctor(d6, "cache-spike");
    ok(spBare.ok && naQ.step === "fill" && naQ.file === "spike.md" && /Write the question this spike answers/.test(naQ.recommendation) && S.detectPhase(spBare.dir, ["core"]) === "requirements" &&
      naT.step === "implement" && /^Investigate — task #1: Sharpen the question/.test(naT.recommendation) &&
      naD.step === "decide" && naD.phase === "executing" && phD === "executing" && /Record the decision in spike\.md → Decision/.test(naD.recommendation) && /\/spec-decide cache-spike/.test(naD.recommendation) &&
      naO.step === "decide" && /State the outcome/.test(naO.recommendation) && c2Chk(docO, "decision").status === "warn" &&
      naGo.step === "promote" && naGo.outcome === "go" && naGo.phase === "complete" && naGo.seed.name === "cache" &&
      naGo.seed.summary === "Can Redis hold the sessions under 5 ms p95? — Redis held 2 ms p95 under a 5k rps load run." &&
      /^Decision: go\. Spec the real feature — spec_create \{name: "cache", summary: "Can Redis/.test(naGo.recommendation) && /then archive the spike: \/feature archive cache-spike\.$/.test(naGo.recommendation) &&
      docGo.verdict === "pass" && c2Chk(docGo, "timebox").status === "pass" && c2Chk(docGo, "decision").detail === "decision recorded (_Outcome: go_)",
      "C2 spike next_action: fill the question → investigate #1 → (all ticked) record the decision → state the outcome → go: spec the real feature (seed name 'cache', summary = question — decision) and archive the spike; doctor passes once decided (got " +
      JSON.stringify([naQ.step, naT.step, naD.step, naO.step, naGo.step, naGo.seed]) + ")");
    // no-go / pivot, and a spike whose name has no "spike" word (archive first — it frees the name).
    const spNo = S.createFeature(d6, "Redis eval", undefined, "Is Redis worth it?", undefined, "en", "spike");
    const noFile = path.join(spNo.dir, "spike.md");
    const decideSp = (file, rationale, outcome) => fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/> \*\*TODO\*\* — go \/ no-go \/ pivot[^\n]*/, rationale)
      .replace(/^_Outcome: [^\n]*_$/m, "_Outcome: " + outcome + "_"));
    for (const n of [1, 2, 3, 4]) S.completeTask(d6, "redis-eval", n);
    decideSp(noFile, "Too costly for the gain.", "no-go");
    const naNo = S.nextAction(d6, "redis-eval");
    decideSp(noFile, "Too costly for the gain.", "pivot");
    const naPv = S.nextAction(d6, "redis-eval");
    decideSp(noFile, "Worth it.", "go");
    const naGo2 = S.nextAction(d6, "redis-eval");
    ok(naNo.step === "archive" && naNo.outcome === "no-go" && naNo.recommendation === "Decision: no-go — Too costly for the gain. Archive the spike with its reason (it stays in spike.md → Decision): /feature archive redis-eval." &&
      naPv.step === "pivot" && /^Decision: pivot — Too costly for the gain\. Start a new spike/.test(naPv.recommendation) &&
      naGo2.step === "promote" && naGo2.seed.name === "redis-eval" && /^Decision: go\. Archive the spike first — \/feature archive redis-eval \(it frees the name\)/.test(naGo2.recommendation),
      "C2 spike next_action: no-go → archive with the reason; pivot → a new spike; a go on a spike named without 'spike' archives it first (the seed keeps its name) (got " +
      JSON.stringify([naNo.recommendation, naGo2.recommendation]).slice(0, 300) + ")");

    // The outcome read from the decision's first line when the _Outcome:_ line is still the template's.
    const spH = S.createFeature(d6, "Heuristic spike", undefined, "Does the cache pay off?", undefined, "en", "spike");
    const hFile = path.join(spH.dir, "spike.md");
    fs.writeFileSync(hFile, fs.readFileSync(hFile, "utf8").replace(/> \*\*TODO\*\* — go \/ no-go \/ pivot[^\n]*/, "**Go** — the numbers hold."));
    const hInfo = S.spikeInfo(spH.dir);
    fs.writeFileSync(hFile, fs.readFileSync(hFile, "utf8").replace("**Go** — the numbers hold.", "Going with it would cost too much."));
    ok(hInfo.decisionFilled === true && hInfo.outcome === "go" && S.spikeInfo(spH.dir).outcome === null,
      "C2 a spike's outcome is read from the decision's first line (**Go** — …) while the _Outcome:_ line is still the template's — 'Going …' is no outcome");

    // finish: blocked until the decision is written and every task ticked; ready → merge summary + the finish baseline.
    const finQ = S.finishFeature(d6, "queue-spike");
    const finGo = await c2Call("spec_finish", { projectDir: d6, name: "cache-spike", write: true, includeBody: true });
    const stGo = JSON.parse(fs.readFileSync(path.join(spDir, ".state.json"), "utf8"));
    const apEx = S.approvePhase(d6, "cache-spike", "execution", "t");
    const apExQ = S.approvePhase(d6, "queue-spike", "execution", "t");
    ok(finQ.ok && finQ.readyToFinish === false && finQ.kind === "spike" && finQ.blockers.some((b) => /Decision is not written yet/.test(b)) && finQ.blockers.some((b) => /^open tasks: #1, #2, #3, #4$/.test(b)) &&
      finGo.readyToFinish === true && finGo.outcome === "go" && finGo.mergeTitle === "docs(cache-spike): spike go — Can Redis hold the sessions under 5 ms…" /* 1.21 F3: ≤ 72 */ &&
      /^## Question\nCan Redis hold the sessions under 5 ms p95\?\n\n## Decision — go\nRedis held 2 ms p95 under a 5k rps load run\.\n\n## Tasks\n- \[x\] 1\. /.test(finGo.mergeSummary) &&
      /## Checks before merge\n- \[ \] The decision is shared with the people it affects\./.test(finGo.mergeSummary) && !/## Acceptance criteria|## Tests/.test(finGo.mergeSummary) &&
      finGo.suiteChecks === undefined && finGo.baseline && finGo.baseline.recorded === true && stGo.finished && typeof stGo.finished.at === "string" &&
      fs.existsSync(path.join(spDir, ".execution", "merge-summary.md")) && apEx.ok === true && apExQ.ok === false && apExQ.refused === true,
      "C2 spike finish: blocked while the decision is unwritten / tasks open; ready once decided — merge summary from spike.md (question, decision, checks), the finish baseline recorded, the execution sign-off follows the same gate (got " +
      JSON.stringify([finQ.blockers, finGo.mergeTitle]).slice(0, 300) + ")");
    // spec_decide on a spike: its sections are the affectable ones.
    const decSp = S.decide(d6, "cache-spike", { title: "Go with Redis", decision: "Redis 7 cluster.", affects: "Evidence, decision" });
    const decSpBad = S.decide(d6, "cache-spike", { title: "x", decision: "y", affects: "US-1.AC-1" });
    ok(decSp.ok && decSp.id === "D-1" && decSp.affects.join() === "Evidence,Decision" && /^# Decisions: Cache spike\n/.test(fs.readFileSync(path.join(spDir, "decisions.md"), "utf8")) &&
      decSpBad.ok === false && JSON.stringify(decSpBad.unknownAffects) === '["US-1.AC-1"]',
      "C2 spec_decide works on a spike: its spike.md sections are what _Affects:_ may name (an AC ID is unknown there)");

    // Roadmap / catalog / export / changelog show the spike apart.
    S.roadmapReport(d6, { write: true });
    const rmMd = fs.readFileSync(path.join(d6, ".specs", "ROADMAP.md"), "utf8");
    const rmHtml = S.renderRoadmapHtml(d6, "en");
    const catSp = S.catalog(d6);
    const cSp = catSp.features.find((x) => x.feature === "cache-spike");
    const expSp = S.exportSpecs(d6, { name: "cache-spike", format: "md" });
    const chSp = S.changelog(d6, { since: "all" });
    const expProj = S.exportSpecs(d6, { format: "md" });
    ok(/\| \[cache-spike\]\(\.\/cache-spike\/spike\.md\) 🔬 spike \| core \|/.test(rmMd) && /\[queue-spike\]\(\.\/queue-spike\/spike\.md\) 🔬 spike/.test(rmMd) &&
      /<a href="\.\/cache-spike\/spike\.md">cache-spike<\/a> <span class="tracks">🔬 spike<\/span>/.test(rmHtml) &&
      cSp.kind === "spike" && cSp.status === "finished" && cSp.spike.outcome === "go" && cSp.spike.question === "Can Redis hold the sessions under 5 ms p95?" &&
      /## ✅ cache-spike — finished · 🔬 spike\n\n_core · finished \d{4}-\d\d-\d\d_\n\n- Question: Can Redis hold the sessions under 5 ms p95\?\n- Decision: go\n- 📝 Decisions \(1\): D-1 Go with Redis\n/.test(catSp.markdown) &&
      !/cache-spike — finished · 🔬 spike[\s\S]{0,300}No acceptance criteria yet/.test(catSp.markdown) &&
      expSp.ok && /_Spike \(investigation\) · /.test(expSp.content) && /- \*\*Kind:\*\* spike/.test(expSp.content) && /\n## Spike\n\n### Question\n/.test(expSp.content) && !/## User stories/.test(expSp.content) &&
      chSp.ok && !chSp.added.some((a) => a.feature === "cache-spike") &&
      expProj.ok && /\n## cache-spike\n\n_spike · core · [^\n]*_\n\nCan Redis hold the sessions under 5 ms p95\?\n\n## /.test(expProj.content),
      "C2 spikes read apart: ROADMAP.md / .html (🔬 spike, linked to spike.md), the catalog (kind, question + decision, no 'no ACs' line), the export (Spike kicker + spike.md body), never in the release notes");
    // Roadmap attention: a spike past its timebox with no decision.
    const spLate = S.createFeature(d6, "Late spike", undefined, "Which ORM?", undefined, "en", "spike", { timebox: "2020-03-01" });
    const rmLate = S.roadmapReport(d6, { write: true });
    ok(spLate.ok && /- \*\*late-spike\*\* — spike: the timebox ended on 2020-03-01 with no decision/.test(fs.readFileSync(path.join(d6, ".specs", "ROADMAP.md"), "utf8")) && rmLate.ok !== false,
      "C2 ROADMAP.md's needs-attention names a spike past its timebox with no decision");

    // Project templates (B1) apply to a new spike: spike / spike-tasks are template keys ({{summary}} = the question).
    const d7 = c2Dir("tpl");
    S.initProject(d7, ["core"], "en");
    fs.mkdirSync(path.join(d7, ".specs", "templates"), { recursive: true });
    fs.writeFileSync(path.join(d7, ".specs", "templates", "spike.md"), "# Spike: {{name}}\n\n## Question\n{{summary}}\n\n## Timebox\n> **TODO** — end date\n\n## Decision\n> **TODO** — team rule: go / no-go\n");
    const spT = S.createFeature(d7, "Tpl spike", undefined, "", undefined, "en", "spike", { question: "Which queue?" });
    const lsT = S.templates(d7, "list");
    const inT = S.templates(d7, "init", { artifact: "spike-tasks" });
    ok(spT.ok && spT.templates && spT.templates["spike.md"] === ".specs/templates/spike.md" && /## Question\nWhich queue\?\n/.test(fs.readFileSync(path.join(spT.dir, "spike.md"), "utf8")) &&
      S.spikeInfo(spT.dir).questionFilled === true && S.specDoctor(d7, "tpl-spike").checks.find((c) => c.id === "decision").status === "fail" &&
      lsT.templates.some((e) => e.artifact === "spike" && e.source === "override") && lsT.templates.some((e) => e.artifact === "spike-tasks" && e.file === "tasks.md") &&
      inT.ok && inT.created.join() === ".specs/templates/spike-tasks.md" && S.templates(d7, "check").problems.length === 0,
      "C2 project templates apply to a new spike (spike.md from .specs/templates/, {{summary}} = the question); spec_templates lists / inits / checks spike and spike-tasks");

    // i18n: every C2 message block has the same keys in EN / PT / ES.
    const c2Keys = (o, pre = "") => Object.keys(o).sort().flatMap((k) => (o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) ? c2Keys(o[k], pre + k + ".") : [pre + k]));
    ok(["decisions", "spike"].every((ns) => ["pt", "es"].every((l) => c2Keys(S.msg(l)[ns]).join() === c2Keys(S.msg("en")[ns]).join())),
      "C2 the decisions / spike message blocks have the same keys in EN, PT and ES");
  }

  // 1.15 — only a SHIPPED feature's _Supersedes:_ retires the older criterion (catalog, export, matrix): a draft's is "to be
  // superseded", and a feature archived without ever shipping declares nothing and does nothing today.
  {
    const sp = path.join(tmp, "proj-115-supersedes");
    S.initProject(sp, ["core"], "en");
    const reqOf = (slug, body) => fs.writeFileSync(path.join(sp, ".specs", slug, "requirements.md"), "# Feature: " + slug + "\n\n### US-1 (P1): Story\n#### Acceptance Criteria (EARS)\n" + body);
    ["Base", "Draft", "Shipped", "Abandoned"].forEach((n) => S.createFeature(sp, n, ["core"], "x", undefined, "en"));
    reqOf("base", "1. **US-1.AC-1** — WHEN a WHEN THE SYSTEM SHALL a\n2. **US-1.AC-2** — WHEN b THE SYSTEM SHALL b\n3. **US-1.AC-3** — WHEN c THE SYSTEM SHALL c\n");
    reqOf("draft", "1. **US-1.AC-1** — WHEN x THE SYSTEM SHALL x _Supersedes: base/US-1.AC-1_\n");
    reqOf("shipped", "1. **US-1.AC-1** — WHEN y THE SYSTEM SHALL y _Supersedes: base/US-1.AC-2_\n");
    reqOf("abandoned", "1. **US-1.AC-1** — WHEN z THE SYSTEM SHALL z _Supersedes: base/US-1.AC-3_\n");
    shipFeature(sp, "shipped");
    S.manageFeature(sp, "archive", "abandoned"); // never shipped: declares nothing
    const cat = S.catalog(sp);
    const base = cat.features.find((f) => f.feature === "base").acs;
    const by = (id) => base.find((a) => a.id === id) || {};
    ok(by("US-1.AC-1").supersedePending === true && JSON.stringify(by("US-1.AC-1").supersededBy) === '["draft/US-1.AC-1"]' &&
      by("US-1.AC-2").supersededBy && !by("US-1.AC-2").supersedePending && !by("US-1.AC-3").supersededBy &&
      cat.totals.superseded === 1 && cat.totals.pending === 1 && cat.totals.acs === 6 && cat.totals.current === 4 &&
      cat.markdown.includes("- **US-1.AC-1** — WHEN a WHEN THE SYSTEM SHALL a — to be superseded by `draft/US-1.AC-1` (not shipped yet)") &&
      cat.markdown.includes("- ~~**US-1.AC-2** — WHEN b THE SYSTEM SHALL b~~ — superseded by `shipped/US-1.AC-1`") && /4 current \(1 to be superseded\), 1 superseded\*\*/.test(cat.markdown),
      "1.15 catalog: a draft's _Supersedes:_ marks the AC 'to be superseded' (not struck, still current); a shipped feature's retires it; an abandoned archived feature's does nothing and its own AC is not current (got " +
      JSON.stringify([base.map((a) => a.id + ":" + (a.supersededBy || []).join("|") + (a.supersedePending ? "(pending)" : "")), cat.totals]) + ")");
    const ex = S.exportSpecs(sp, { name: "base", format: "md" }).content || "";
    const mx = S.traceMatrix(sp, "base");
    const mrow = (id) => mx.rows.find((r) => r.id === id) || {};
    ok(/US-1\.AC-1\*\* — WHEN a WHEN THE SYSTEM SHALL a — to be superseded by `draft\/US-1\.AC-1`/.test(ex) && /~~\*\*US-1\.AC-2\*\*/.test(ex) && !/~~\*\*US-1\.AC-1\*\*/.test(ex) &&
      mrow("US-1.AC-1").supersedePending === true && !mrow("US-1.AC-2").supersedePending && mx.counts.superseded === 1 && mx.counts.supersedePending === 1,
      "1.15 export + matrix: the same rule — a draft's supersession is 'to be superseded' (never struck), a shipped one's is (got " + JSON.stringify([mx.counts, (ex.match(/^.*US-1\.AC-[12]\*\*.*$/gm) || [])]) + ")");
    // The CSV and the CLI table read a pending one apart; a retired AC also planned by a draft names the shipped declarer only.
    reqOf("draft", "1. **US-1.AC-1** — WHEN x THE SYSTEM SHALL x _Supersedes: base/US-1.AC-1, base/US-1.AC-2_\n");
    const csv = S.matrixCsv([S.traceMatrix(sp, "base")], "en");
    const cat2 = S.catalog(sp).features.find((f) => f.feature === "base").acs.find((a) => a.id === "US-1.AC-2");
    const cli = spawnSync(process.execPath, [path.join(__dirname, "..", "cli", "dev-spec.js"), "trace", "base", "--matrix", "--project", sp], { encoding: "utf8" }).stdout || "";
    ok(/to be superseded by draft\/US-1\.AC-1 \(not shipped yet\)/.test(csv) && JSON.stringify(cat2.supersededBy) === '["shipped/US-1.AC-1"]' && !cat2.supersedePending &&
      /to be superseded by draft\/US-1\.AC-1/.test(cli) && !/superseded by draft\/US-1\.AC-2/.test(cli),
      "1.15: the matrix CSV and `trace --matrix` show a pending supersession apart; a retired AC names only its SHIPPED declarers, never a draft that also plans it (got " +
      JSON.stringify([cat2, (csv.match(/superseded by [^\r\n,]*/g) || [])]) + ")");
    // A declaration a change request adds AFTER the ship waits until the feature ships again (the requirements snapshot
    // approved before the ship doesn't hold it).
    const later = S.createFeature(sp, "Later", ["core"], "x", undefined, "en");
    reqOf("later", "1. **US-1.AC-1** — WHEN l THE SYSTEM SHALL l\n");
    S.approvePhase(sp, "later", "requirements", "t", { force: true }); // the snapshot the feature ships with (no _Supersedes:_)
    shipFeature(sp, "later", new Date().toISOString()); // shipped AFTER that approval
    reqOf("later", "1. **US-1.AC-1** — WHEN l THE SYSTEM SHALL l _Supersedes: base/US-1.AC-3_\n"); // a change request, after the ship
    const ac3 = S.catalog(sp).features.find((f) => f.feature === "base").acs.find((a) => a.id === "US-1.AC-3");
    ok(later.ok && ac3 && ac3.supersedePending === true && JSON.stringify(ac3.supersededBy) === '["later/US-1.AC-1"]',
      "1.15: a _Supersedes:_ added to a shipped feature after it shipped (a change request) is 'to be superseded' until it ships again (got " + JSON.stringify(ac3) + ")");
  }
};
