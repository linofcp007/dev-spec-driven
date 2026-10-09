"use strict";
// Gates — the check registry (1.27): every check spec_doctor emits and every check an approval gate refuses on is ONE entry of DOCTOR_CHECKS, once.
// (06-gates.js holds the gates area's behaviour; this file the registry's own rules — doctor.js DOCTOR_CHECKS / GATES / CHECK_PHASE.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, eq, S, tmp, root }) => {
  const js = JSON.stringify;
  const E = require(path.join(root, "mcp", "lib", "engine", "index.js"));
  const { DOCTOR_CHECKS, GATES, CHECK_PHASE } = E;
  const idsOf = (e) => e.emits || [e.id];
  // The entries an id resolves to: the ones listing it (emits, else their id) or whose family matches it (<name>-sections).
  const entriesOf = (id) => DOCTOR_CHECKS.filter((e) => idsOf(e).includes(id) || (e.family && e.family.test(id)));

  { // The registry's shape: unique keys, every emitted id owned by ONE entry, each entry a doctor verdict and / or approval probes.
    const keys = DOCTOR_CHECKS.map((e) => e.id);
    const emitted = DOCTOR_CHECKS.flatMap(idsOf);
    const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i), dupIds = emitted.filter((k, i) => emitted.indexOf(k) !== i);
    all("1.27 registry: every entry has its own id, every id it emits belongs to it alone, and it runs as a doctor check, an approval probe or both", {
      entries: () => DOCTOR_CHECKS.length >= 45,
      uniqueKeys: () => !dupKeys.length,
      uniqueEmitted: () => !dupIds.length,
      eachOwnsItsIds: () => emitted.every((id) => entriesOf(id).length === 1),
      shape: () => DOCTOR_CHECKS.every((e) => typeof e.id === "string" && /^[a-z<][a-z<>-]*$/.test(e.id) && (typeof e.run === "function" || (e.gate && typeof e.gate === "object")) &&
        (e.applies === undefined || typeof e.applies === "function") && Object.values(e.gate || {}).every((p) => typeof p === "function")),
      multiEmittersListTheirIds: () => DOCTOR_CHECKS.filter((e) => e.emits).every((e) => e.emits.length >= 1 && e.emits.every((id) => /^[a-z][a-z-]*$/.test(id))),
      // CHECK_PHASE is derived from the entries' `phase` — next_action ranks a failure by it
      checkPhase: () => js(Object.keys(CHECK_PHASE).sort()) === js(DOCTOR_CHECKS.filter((e) => e.phase).flatMap(idsOf).sort()) &&
        Object.values(CHECK_PHASE).every((n) => Number.isInteger(n) && n >= 1 && n <= 6) && CHECK_PHASE.ears === 1 && CHECK_PHASE["root-cause"] === 2 && CHECK_PHASE["evidence-moved"] === 6,
      builtInSections: () => ["saas", "ai", "sec", "privacy", "dist", "api", "ui", "obs", "data"].every((t) => entriesOf(t + "-sections").length === 1 && CHECK_PHASE[t + "-sections"] === 2) &&
        entriesOf("perfx-sections").length === 1,
    });
  }

  { // GATES: each phase's probes name registry entries that hold that probe (the phase's own, `all`, or the one named after ":").
    const contexts = [{ kind: "feature", testsTdd: true, testsAi: true }, { kind: "bugfix", testsTdd: true, testsAi: false }, { kind: "change", testsTdd: false, testsAi: true }];
    const bad = [];
    for (const [phase, gate] of Object.entries(GATES)) {
      if (gate.blockers) continue; // the execution sign-off: spec_finish's blockers
      for (const c of contexts) {
        for (const ref of gate.probes(c)) {
          const [id, name] = ref.split(":");
          const e = DOCTOR_CHECKS.find((x) => x.id === id);
          if (!e || !e.gate || typeof (e.gate[name || phase] || e.gate.all) !== "function") bad.push(phase + " " + c.kind + " " + ref);
        }
      }
    }
    all("1.27 registry: GATES covers every approval phase, and every probe a phase runs is a registry entry's", {
      phases: () => js(Object.keys(GATES).sort()) === js(S.PHASES.slice().sort()),
      execution: () => typeof GATES.execution.blockers === "function",
      probes: () => !bad.length || (() => { throw new Error(js(bad)); })(),
    });
  }

  { // Over a matrix of features (every kind, tracks + a track pack, sizes, a design-first flow, filled / fresh / approved / changed,
    // odd task markers, an unreadable state): every id spec_doctor emits resolves to ONE registry entry, and every id an approval
    // gate refuses on is one of the probes GATES lists for that phase (the execution sign-off: spec_finish's blockers).
    const p = path.join(tmp, "proj-registry");
    S.initProject(p, ["core", "tdd", "ai", "saas", "sec", "privacy"], "en");
    const put = (slug, rel, text) => fs.writeFileSync(path.join(p, ".specs", slug, rel), text);
    const fill = (slug, rel) => {
      const fp = path.join(p, ".specs", slug, rel);
      if (!fs.existsSync(fp)) return;
      const lines = fs.readFileSync(fp, "utf8").split("\n");
      for (const it of S.placeholderReport(lines.join("\n")).reverse()) {
        const i = it.line - 1;
        lines[i] = it.kind === "todo" ? "The concrete answer is written here for the reviewers." : lines[i].split(it.text).join("concrete value");
      }
      fs.writeFileSync(fp, lines.join("\n"));
    };
    const REQ = "# Requirements\n\n### US-1 (P1 — MVP): Export\n#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user exports THE SYSTEM SHALL write the file.\n" +
      "2. **US-1.AC-2** — WHEN the export fails THE SYSTEM SHALL show the error code.\n\n## Success Criteria\n- SC-001: 95% of exports finish in 2 s.\n";
    const DESIGN = "# Design\n\n## Architecture\n```mermaid\ngraph TD; A-->B\n```\n\n## Constitution Check\n- Simple: one module.\n";
    const TASKS = "# Tasks\n\n- [x] 1. Export\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/a.js_\n  - _Verify: npm test | tee log.txt_\n  - _Expect: failure_\n" +
      "- [ ] 1. Again\n  - _Requirements: US-1.AC-2_\n  - _Depends: 2_\n- [ ] 2. Errors\n  - _Requirements: US-1.AC-2_\n  - **Verify:** npm test\n  - _Depends: 1_\n1. [ ] unread\n";
    const feats = [];
    const mk = (name, tracks, kind, opts) => { const r = S.createFeature(p, name, tracks, "summary", undefined, "en", kind, opts || {}); feats.push(r.slug); return r.slug; };
    mk("Fresh Core", ["core"]);
    mk("Fresh Every", ["tdd", "ai", "saas", "sec", "privacy", "dist", "api", "ui", "obs", "data"]);
    mk("Fresh Bug", undefined, "bugfix");
    mk("Fresh Change", undefined, "change");
    mk("Sized", ["tdd", "saas"], undefined, { size: "s" });
    mk("Arch First", ["core"], undefined, { flow: "design-first" });
    { const s = mk("Filled Every", ["tdd", "ai", "saas"]); ["classification.md", "requirements.md", "design.md", "test-plan.md", "eval-plan.md", "tasks.md"].forEach((f) => fill(s, f)); }
    { const s = mk("Bug Filled", undefined, "bugfix"); ["requirements.md", "bug.md", "test-plan.md", "tasks.md"].forEach((f) => fill(s, f)); }
    { const s = mk("Change Filled", undefined, "change"); fill(s, "change.md"); }
    { // hand-written, approved (forced where refused), then edited: changed-since-approval, a forced approval, odd task markers
      const s = mk("Odd", ["tdd"]);
      put(s, "requirements.md", REQ); put(s, "design.md", DESIGN); put(s, "tasks.md", TASKS);
      for (const ph of ["requirements", "design"]) S.approvePhase(p, s, ph, "t", { force: true });
      put(s, "requirements.md", REQ + "3. **US-1.AC-3** — WHEN the user cancels THE SYSTEM SHALL stop [NEEDS CLARIFICATION: how fast?].\n");
    }
    { S.trackPacks(p, "init", { name: "perfx" }); const s = mk("Pack", ["perfx"]); fill(s, "requirements.md"); }
    { S.trackPacks(p, "init", { name: "gonepack" }); mk("Pack Gone", ["gonepack"]); fs.rmSync(path.join(p, ".specs", "tracks", "gonepack"), { recursive: true }); }
    { const s = mk("Broken State", ["core"]); put(s, ".state.json", "{ not json"); }
    { const s = mk("No Design", ["core"]); fs.rmSync(path.join(p, ".specs", s, "design.md")); fs.rmSync(path.join(p, ".specs", s, "requirements.md")); }
    const demo = path.join(tmp, "proj-registry-demo");
    fs.cpSync(path.join(root, "examples", "demo-project"), demo, { recursive: true });
    const projects = [[p, feats], [demo, ["api-keys", "usage-metering"]]];

    const emitted = new Set(), unowned = [], badGate = [], gateIds = new Set();
    let doctors = 0, gates = 0;
    for (const [proj, list] of projects) {
      for (const slug of list) {
        const doc = S.specDoctor(proj, slug);
        if (!doc.ok) continue;
        doctors++;
        for (const c of doc.checks) { emitted.add(c.id); if (entriesOf(c.id).length !== 1) unowned.push(slug + ": " + c.id); }
        const f = S.existingFeature(proj, slug);
        const tracks = S.detectTracks(f.dir), kind = S.readState(proj, slug).kind || "feature", lang = S.featureLang(proj, slug);
        for (const phase of S.PHASES) {
          const g = E.withReadCache(() => E.approvalChecks(proj, slug, f.dir, phase, tracks, kind, lang));
          gates++;
          const gate = GATES[phase];
          const allowed = gate.blockers ? new Set(E.withReadCache(() => E.finishFeature(proj, slug, { gateOnly: true })).checks.map((x) => x.id))
            : new Set(gate.probes({ kind, testsTdd: true, testsAi: true }).map((ref) => ref.split(":")[0]));
          for (const x of g.checks) {
            gateIds.add(phase + ":" + x.id);
            const own = allowed.has(x.id) || (allowed.has("<track>-sections") && /-sections$/.test(x.id));
            if (!own || (!gate.blockers && entriesOf(x.id).length !== 1)) badGate.push(slug + " " + phase + ": " + x.id);
          }
        }
      }
    }
    all("1.27 registry: every check id spec_doctor emits on a matrix of features is registered once, and every id an approval refuses on comes from the registry by phase (got " +
      emitted.size + " doctor ids over " + doctors + " features, " + gateIds.size + " gate ids over " + gates + " gates)", {
      coverage: () => doctors >= 15 && emitted.size >= 35 && gateIds.size >= 20,
      doctorIdsRegistered: () => !unowned.length || (() => { throw new Error(js(unowned)); })(),
      gateIdsFromRegistry: () => !badGate.length || (() => { throw new Error(js(badGate)); })(),
      packSections: () => emitted.has("perfx-sections") && emitted.has("track-pack-missing"),
    });
    // The status line's forced-approval re-check leaves out what the doctor only warns about — the entries flagged warnsOnly.
    eq(DOCTOR_CHECKS.filter((e) => e.warnsOnly).map((e) => e.id).sort(), ["constitution-check", "priorities", "reproduction", "success-criteria"],
      "1.27 registry: the checks the doctor only warns about while their approval refuses (warnsOnly) are success-criteria, priorities, reproduction and constitution-check");
  }
};
