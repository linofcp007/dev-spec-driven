"use strict";
// Tasks — the review panel (1.36, opt-in): meta.reviewModels set by spec_init (checked, stored, echoed), doctor's / next_action's reviewPanel, the finish step's sentence.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, eq, rpc, payload, S, tmp, list }) => {
  const js = JSON.stringify;
  const call = async (name, args) => payload(await rpc("tools/call", { name, arguments: args }));
  const rmFile = (dir) => path.join(dir, ".specs", "roadmap.json");
  const meta = (dir) => { try { return JSON.parse(fs.readFileSync(rmFile(dir), "utf8")).meta || {}; } catch { return null; } };
  const setMeta = (dir, patch) => { const rm = JSON.parse(fs.readFileSync(rmFile(dir), "utf8")); rm.meta = { ...(rm.meta || {}), ...patch }; fs.writeFileSync(rmFile(dir), js(rm, null, 2)); };
  const safe = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } }; // a regression must FAIL, not crash the file
  const RM = S.msg("en").reviewModels, PAIR = ["opus", "sonnet"];

  { // spec_init {reviewModels}: a list, "diverse", off — stored, echoed (the CURRENT panel, always), each with its note
    const p = path.join(tmp, "proj-rp-init");
    S.initProject(p, ["core"], "en");
    S.createFeature(p, { name: "Login", tracks: ["core"] }); // no longer a brand-new project: init stamps nothing more
    const plain = await call("spec_init", { projectDir: p });
    const set = await call("spec_init", { reviewModels: ["opus", "sonnet"], projectDir: p });
    const setMeta1 = meta(p).reviewModels;
    // the same value again: no write (roadmap.json keeps the time set below)
    const past = new Date("2026-01-01T00:00:00Z");
    fs.utimesSync(rmFile(p), past, past);
    const again = S.initProject(p, [], null, { reviewModels: ["opus", "sonnet"] });
    const keptTime = fs.statSync(rmFile(p)).mtimeMs === past.getTime();
    const div = await call("spec_init", { reviewModels: ["diverse"], projectDir: p });
    const divMeta = meta(p).reviewModels;
    const mixed = S.initProject(p, [], null, { reviewModels: ["Opus", "sonnet[1m]", "bedrock/team-a:inference-profile@v2"] });
    const mixedMeta = meta(p).reviewModels;
    const off = await call("spec_init", { reviewModels: [], projectDir: p });
    const offMeta = meta(p);
    all("1.36 review panel: spec_init {reviewModels} stores 2–3 names as given (any shape: an alias, a [1m] suffix, a profile id), the word \"diverse\" (read as opus + sonnet), [] deletes the key — each echoed as the CURRENT panel with its note; the same value again writes nothing (got " +
      js([set, div.reviewModels, divMeta, mixedMeta, off.reviewModels, offMeta]) + ")", {
      noPanelEchoed: () => js(plain.reviewModels) === "[]" && plain.reviewModelsNote === undefined,
      setStored: () => js(setMeta1) === js(PAIR), setEcho: () => js(set.reviewModels) === js(PAIR),
      setNote: () => set.reviewModelsNote === RM.on("opus, sonnet", false),
      sameAgainNoWrite: () => again.reviewModelsNote === RM.on("opus, sonnet", false) && keptTime,
      diverseStoredAsWord: () => divMeta === "diverse", diverseEcho: () => js(div.reviewModels) === js(PAIR),
      diverseNote: () => div.reviewModelsNote === RM.on("opus, sonnet", true),
      asGiven: () => js(mixedMeta) === js(["Opus", "sonnet[1m]", "bedrock/team-a:inference-profile@v2"]) && js(mixed.reviewModels) === js(mixedMeta),
      offDeletes: () => !("reviewModels" in offMeta), offEcho: () => js(off.reviewModels) === "[]", offNote: () => off.reviewModelsNote === RM.off,
    });
  }

  { // refused before ANY write — the engine's code on both kinds of refusal; nothing of the call lands
    const p = path.join(tmp, "proj-rp-refuse");
    S.initProject(p, ["core"], "en", { reviewModels: ["opus", "sonnet"] });
    const long = (n) => "m" + "x".repeat(n - 1);
    // 1.36.0 review 1 (T2): every reserved word inside a list — default / off / none too, not only inherit and diverse
    const bad = [["opus"], ["opus", "Opus"], ["opus", "sonnet", "haiku", "fable"], ["opus", "inherit"], ["opus", "diverse"], ["opus", "default"],
      ["opus", "off"], ["opus", "none"], ["opus x", "sonnet"], ["-opus", "sonnet"], [long(129), "sonnet"], ["opus", "sonnet["], ["opus", ""], ["opus,sonnet"]];
    const answers = [];
    for (const v of bad) answers.push([v, await call("spec_init", { reviewModels: v, projectDir: p })]);
    const okLong = S.initProject(p, [], null, { reviewModels: [long(128), "sonnet"] });
    const okLongMeta = meta(p).reviewModels;
    S.initProject(p, [], null, { reviewModels: ["opus", "sonnet"] });
    const half = S.initProject(p, [], null, { guard: "on", reviewModels: ["opus"] }); // a good setting beside a bad panel: nothing written
    const truthy = safe(() => S.initProject(p, [], null, { reviewModels: true }));
    const str = await call("spec_init", { reviewModels: "opus,sonnet", projectDir: p });
    const item = await call("spec_init", { reviewModels: ["opus", 1], projectDir: p });
    const after = meta(p);
    const refused = (r) => r.ok === false && r.code === "invalid-arguments" && js(r.invalid) === '["reviewModels"]';
    all("1.36 review panel: a bad value is refused before anything is written (invalid-arguments, invalid [reviewModels]) — one name, a case-folded duplicate, 4 names, a reserved word inside a list (inherit, diverse, default, off, none), a space, a leading dash, past 128 characters, a broken suffix, an empty name, one item holding a list, true; a refused array echoed as JSON (1.36.0 review 1); a string or a non-string item over MCP by the schema; up to 128 characters pass (got " +
      js([answers.filter(([, r]) => !refused(r)).map(([v, r]) => [v, r]), half, truthy, str, item, after]) + ")", {
      eachRefused: () => answers.every(([, r]) => refused(r)),
      message: () => answers[0][1].error === RM.bad('["opus"]'),
      listItemAsJson: () => answers[answers.length - 1][1].error === RM.bad('["opus,sonnet"]'),
      long128: () => okLong.ok !== false && js(okLongMeta) === js([long(128), "sonnet"]),
      halfNothingWritten: () => refused(half) && after.guard === undefined,
      truthyRefused: () => refused(truthy) && truthy.error === RM.bad("true"),
      stringBySchema: () => str.ok === false && str.code === "invalid-arguments",
      itemBySchema: () => item.ok === false && item.code === "invalid-arguments" && js(item.invalid) === '["reviewModels[1]"]',
      keptAsBefore: () => js(after.reviewModels) === js(PAIR),
    });
  }

  { // 1.36.0 review 1 (RP-4): the CLI word (a string — init --review-models) — a stray separator at either end is no empty name;
    // a word with no name at all stays refused, as before; the refusal names the [1m] suffix (EN, PT, ES)
    const p = path.join(tmp, "proj-rp-word");
    S.initProject(p, ["core"], "en");
    const word = (w) => { const r = safe(() => S.initProject(p, [], null, { reviewModels: w })); const m = meta(p).reviewModels; S.initProject(p, [], null, { reviewModels: "off" }); return { r, m }; };
    const lead = word(" opus,sonnet"), trail = word("opus,sonnet,"), both = word(", opus sonnet ,");
    const none = ["", "  ", ","].map((w) => [w, word(w)]);
    const suffix = ["en", "pt", "es"].filter((l) => !S.msg(l).reviewModels.bad("x").includes("[1m]"));
    all("1.36.0 review 1 (RP-4): init --review-models' word — a stray comma or space at either end is no empty name (\" opus,sonnet\", \"opus,sonnet,\" stored as opus, sonnet); a word with no name (\"\", spaces, a comma) still refused, nothing written; the refusal names the [1m] suffix in EN, PT and ES (got " +
      js([lead, trail, both, none, suffix]) + ")", {
      lead: () => lead.r.ok !== false && js(lead.m) === js(PAIR), trail: () => trail.r.ok !== false && js(trail.m) === js(PAIR),
      both: () => both.r.ok !== false && js(both.m) === js(PAIR),
      noName: () => none.every(([w, x]) => x.r.ok === false && x.r.code === "invalid-arguments" && x.r.error === RM.bad(w) && x.m === undefined),
      suffix: () => suffix.length === 0,
    });
  }

  { // a hand-written value: "diverse" / ["diverse"] read as the pair, [] / ["off"] as none (silent), anything else ignored (said)
    const p = path.join(tmp, "proj-rp-stored");
    S.initProject(p, ["core"], "en");
    const f = S.createFeature(p, { name: "Stored", tracks: ["core"] });
    const read = (v) => {
      setMeta(p, { reviewModels: v });
      const r = safe(() => S.initProject(p, [], null, {}));
      const d = safe(() => S.specDoctor(p, f.slug));
      return { echo: r.reviewModels, note: r.reviewModelsNote, panel: d.reviewPanel, threw: r.threw || d.threw };
    };
    const huge = Array.from({ length: 30 }, (_, i) => "model-name-" + i);
    const cases = {
      word: [read("diverse"), PAIR, undefined], list: [read(["diverse"]), PAIR, undefined],
      empty: [read([]), [], undefined], offWord: [read(["off"]), [], undefined],
      one: [read("opus"), [], RM.ignored('"opus"')], string: [read("opus,sonnet"), [], RM.ignored('"opus,sonnet"')],
      single: [read(["opus"]), [], RM.ignored('["opus"]')], dup: [read(["Opus", "opus"]), [], RM.ignored('["Opus","opus"]')],
      number: [read(42), [], RM.ignored("42")], numbers: [read([1, 2]), [], RM.ignored("[1,2]")],
    };
    const big = read(huge);
    fs.writeFileSync(rmFile(p), js({ features: {} })); // no meta at all
    const noMeta = safe(() => S.specDoctor(p, f.slug));
    all("1.36 review panel: a stored meta.reviewModels — \"diverse\" and [\"diverse\"] are opus + sonnet, [] and [\"off\"] no panel (no note), a string, one name, a duplicate, a number or numbers no panel with init's `ignored` note (bounded); a roadmap.json without meta: no panel (got " +
      js([Object.fromEntries(Object.entries(cases).map(([k, [r]]) => [k, r])), big.note && big.note.length, noMeta.reviewPanel, noMeta.threw]) + ")",
      Object.assign(Object.fromEntries(Object.entries(cases).map(([k, [r, models, note]]) => [k, () => !r.threw && js(r.echo) === js(models) && r.note === note &&
        js(r.panel) === js(models.length ? { models } : undefined)])), {
        bounded: () => !big.threw && js(big.echo) === "[]" && big.note === RM.ignored(js(huge).slice(0, 119) + "…"),
        noMeta: () => !noMeta.threw && noMeta.ok && !("reviewPanel" in noMeta),
      }));
  }

  { // doctor and next_action: {models} for every feature but an xs one (a change) — a spike, and no panel, carry none
    const p = path.join(tmp, "proj-rp-kinds");
    S.initProject(p, ["core"], "en", { reviewModels: ["sonnet", "opus"] });
    const mk = (o) => S.createFeature(p, { tracks: ["core"], ...o }).slug;
    const kinds = { m: mk({ name: "Medium", size: "m" }), l: mk({ name: "Large", size: "l" }), none: mk({ name: "Plain" }),
      bugfix: mk({ name: "Crash", kind: "bugfix" }), xs: mk({ name: "Tiny", size: "xs" }), spike: mk({ name: "Probe", kind: "spike", question: "Does it scale?" }) };
    const got = {};
    for (const [k, slug] of Object.entries(kinds)) {
      got[k] = { doc: S.specDoctor(p, slug).reviewPanel, na: S.nextAction(p, slug).reviewPanel,
        mcpDoc: (await call("spec_doctor", { name: slug, projectDir: p })).reviewPanel, mcpNa: (await call("spec_next_action", { name: slug, projectDir: p })).reviewPanel };
    }
    const q = path.join(tmp, "proj-rp-kinds-off");
    S.initProject(q, ["core"], "en");
    const qs = S.createFeature(q, { name: "Medium", tracks: ["core"], size: "m" }).slug;
    const PANEL = js({ models: ["sonnet", "opus"] }); // the stored order: the first model leads
    all("1.36 review panel: spec_doctor and spec_next_action carry reviewPanel {models} (the stored order) at size m, l, no size and on a bugfix, the same object on both and over MCP; none for an xs change, a spike or a project without a panel (got " + js(got) + ")", {
      ...Object.fromEntries(["m", "l", "none", "bugfix"].map((k) => [k, () => [got[k].doc, got[k].na, got[k].mcpDoc, got[k].mcpNa].every((v) => js(v) === PANEL)])),
      xs: () => [got.xs.doc, got.xs.na, got.xs.mcpDoc, got.xs.mcpNa].every((v) => v === undefined),
      spike: () => [got.spike.doc, got.spike.na, got.spike.mcpDoc, got.spike.mcpNa].every((v) => v === undefined),
      off: () => S.specDoctor(q, qs).reviewPanel === undefined && S.nextAction(q, qs).reviewPanel === undefined,
    });
  }

  { // the finish step: the branch review on every model FIRST — before the simplify pass and the project checks' runs; at a
    // re-finish too; never at implement / verify / finished; without a panel the step's own text alone
    const PASS = 'node -e "process.exit(0)"';
    const CLASS = "# Classification: x\n\n## Mode\nSpec\n\n## Active Tracks\ncore\n\n## Signals\n- none, plain feature\n\n## Blast Radius\nLow; only the login page.\n\n## Compliance Tags\nnone\n";
    const REQ = "# Feature: x\n\n## Summary\nUsers log in with email and password.\n\n## User Stories (prioritized — each independently testable)\n\n### US-1 (P1 — MVP): Log in\n" +
      "**As a** user, **I want** to log in, **so that** I see my account.\n**Why P1:** nothing works without it.\n**Independent Test:** Can be fully tested by logging in and delivers access, without the other stories.\n\n" +
      "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the user submits valid credentials THE SYSTEM SHALL open a session\n2. **US-1.AC-2** — IF the credentials are wrong THEN THE SYSTEM SHALL show an error\n\n" +
      "## Success Criteria (measurable, technology-agnostic)\n- **SC-001** — 95% of logins complete in under 2 seconds\n\n## Edge Cases & Error Handling\n- **EC-1** — Locked account: show the lock message\n\n" +
      "## Non-Functional Requirements\n- **NFR-1** — p95 latency under 300 ms\n\n## Out of Scope\n- Social login\n\n## Assumptions\n- Users already have accounts\n";
    const DESIGN = "# Design: x\n\n## Overview\nA form posts to /login; the server checks the hash.\n\n## Architecture\nThe web app calls the auth service.\n\n## Data Models\nUser { id, email, hash }\n\n" +
      "## API Contracts\nPOST /login returns 200 or 401.\n\n## Security Considerations\nHashes use bcrypt.\n\n## Error Handling\nWrong credentials give 401.\n\n## Testing Strategy\n- Unit tests for the handler.\n\n" +
      "## Constitution Check\n- [x] Simplicity — complies\n\n## Complexity Tracking\nNone.\n";
    const TASKS = "# Tasks\n\n## Story US-1 (P1 — MVP)\n- [ ] 1. [US1] Implement the login handler (EC-1, NFR-1)\n  - _Requirements: US-1.AC-1_\n  - _Verify: " + PASS + "_\n" +
      "- [ ] 2. [US1] Show the error message\n  - _Requirements: US-1.AC-2_\n  - _Verify: " + PASS + "_\n**Checkpoint:** US-1 works.\n";
    const filled = (dir, name, lang) => {
      const f = S.createFeature(dir, { name, tracks: ["core"], lang: lang || "en" });
      for (const [n, t] of [["classification.md", CLASS], ["requirements.md", REQ], ["design.md", DESIGN], ["tasks.md", TASKS]]) fs.writeFileSync(path.join(f.dir, n), t);
      S.approvePhase(dir, f.slug, null, "u", { through: "tasks" });
      return f;
    };
    const run = { command: PASS, exitCode: 0 };
    const p = path.join(tmp, "proj-rp-finish");
    S.initProject(p, ["core"], "en", { reviewModels: ["opus", "sonnet"] });
    const f = filled(p, "Login");
    const N = S.msg("en").next, sentence = N.reviewBranch(f.slug, "opus, sonnet");
    const has = (r) => r.recommendation.split(sentence).length - 1;
    const naImpl = S.nextAction(p, f.slug);
    S.completeTask(p, f.slug, 1, run);
    S.completeTask(p, f.slug, 2); // ticked without its run: the verify step
    const naVerify = S.nextAction(p, f.slug);
    S.completeTask(p, f.slug, 2, run);
    const naFinish = safe(() => S.nextAction(p, f.slug));
    const mcpFinish = await call("spec_next_action", { name: f.slug, projectDir: p });
    const fin = S.finishFeature(p, f.slug, { write: true });
    const naFinished = S.nextAction(p, f.slug);
    const sp = path.join(f.dir, ".state.json"), st = JSON.parse(fs.readFileSync(sp, "utf8"));
    fs.writeFileSync(sp, js({ ...st, changes: [...(st.changes || []), { at: new Date(Date.now() + 60000).toISOString(), phase: "requirements", reopened: [] }] }, null, 2));
    const naRefinish = S.nextAction(p, f.slug);
    fs.writeFileSync(sp, js(st, null, 2));
    // with project checks (meta.checks): the sentence < the step's own text (its simplify clause) < the checks' runs
    const pc = path.join(tmp, "proj-rp-finish-checks");
    S.initProject(pc, ["core"], "en", { reviewModels: ["opus", "sonnet"], checks: { test: PASS } });
    const fc = filled(pc, "Login");
    S.completeTask(pc, fc.slug, 1, run);
    S.completeTask(pc, fc.slug, 2, run);
    const naChecks = S.nextAction(pc, fc.slug);
    const at = (s) => naChecks.recommendation.indexOf(s);
    // no panel: the finish step's own text, unchanged
    const pn = path.join(tmp, "proj-rp-finish-none");
    S.initProject(pn, ["core"], "en");
    const fn = filled(pn, "Login");
    S.completeTask(pn, fn.slug, 1, run);
    S.completeTask(pn, fn.slug, 2, run);
    const naNone = safe(() => S.nextAction(pn, fn.slug));
    all("1.36 review panel: next_action's finish step starts with the branch review on every model (once), before the step's own text — the first finish and a re-finish (staleBaseline) — and before the project checks' runs; never at implement, verify or finished; MCP = engine; no panel → the step's text alone (got " +
      js([naImpl.step, naVerify.step, naFinish.step, naFinish.recommendation, fin.readyToFinish, naFinished.step, naRefinish.step, naRefinish.recommendation, naChecks.recommendation, naNone]) + ")", {
      implement: () => naImpl.step === "implement" && has(naImpl) === 0,
      verify: () => naVerify.step === "verify" && has(naVerify) === 0,
      finishFirst: () => naFinish.step === "finish" && naFinish.recommendation === sentence + " " + N.allDone(f.slug),
      mcpSame: () => js(mcpFinish) === js(naFinish),
      finished: () => fin.readyToFinish && naFinished.step === "finished" && has(naFinished) === 0,
      refinish: () => naRefinish.step === "finish" && !!naRefinish.staleBaseline && naRefinish.recommendation.indexOf(sentence) === 0 && has(naRefinish) === 1 &&
        naRefinish.recommendation.includes("finish it again"),
      order: () => naChecks.step === "finish" && at(sentence) === 0 && has(naChecks) === 1 && at(N.allDone(fc.slug)) > 0 &&
        at(S.DEV_SPEC + " finish " + fc.slug + " --run") > at(N.allDone(fc.slug)),
      none: () => !naNone.threw && naNone.step === "finish" && naNone.recommendation === N.allDone(fn.slug),
    });
    // the feature's language: PT and ES features get their own sentence
    const langs = {};
    for (const lang of ["pt", "es"]) {
      const fl = filled(p, "Login " + lang, lang);
      S.completeTask(p, fl.slug, 1, run);
      S.completeTask(p, fl.slug, 2, run);
      langs[lang] = { na: S.nextAction(p, fl.slug), sentence: S.msg(lang).next.reviewBranch(fl.slug, "opus, sonnet") };
    }
    all("1.36 review panel: the finish step's sentence is the feature's language (PT, ES) (got " + js(langs) + ")",
      Object.fromEntries(Object.entries(langs).map(([k, v]) => [k, () => v.na.step === "finish" && v.na.recommendation.indexOf(v.sentence) === 0 && v.sentence !== N.reviewBranch(v.na.feature, "opus, sonnet")])));
  }

  { // the tools/list contract: spec_init takes reviewModels (an array of strings) and its settings sentence names it
    const init = list.result.tools.find((t) => t.name === "spec_init");
    eq(init.inputSchema.properties.reviewModels, { type: "array", items: { type: "string" } }, "1.36 review panel: spec_init's schema — reviewModels, an array of strings (no description: the settings sentence says it)");
    ok(/`reviewModels` \(2–3 review models, diverse or \[\]\)/.test(init.description), "1.36 review panel: spec_init's settings sentence names `reviewModels` (2–3 models, diverse or [])");
  }
};
