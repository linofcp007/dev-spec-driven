"use strict";
// Lifecycle — the lesson kind (1.41): a `_Kind: lesson_` decisions.md entry (spec_decide {kind: "lesson", cause, target}) — why a
// confirmed review finding happened —, its readers (the brief, finish, the merge summary, the ADR export, the catalog, doctor),
// spec_metrics' lessons (a feature's, the project's over active AND archived folders) and the retro. Every fixture below was written
// from a mutation of the rule it names (the mutation list came first): each must fail without it. The shapes are the demo project's
// (examples/demo-project/.specs: api-keys, usage-metering) — none of the real corpora has a decisions.md, so the first lesson creates it.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, eq, rpc, payload, S, tmp, fsCalls, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const I = require(path.join(__dirname, "lib", "i18n.js"));
  const D = (l) => I.msg(l || "en").decisions;
  const DEMO = path.join(__dirname, "..", "examples", "demo-project");
  const demo = (n) => {
    const p = path.join(tmp, "proj-lessons-" + n);
    fs.cpSync(DEMO, p, { recursive: true });
    return p;
  };
  const rd = (...a) => fs.readFileSync(path.join(...a), "utf8");
  const log = (p, f) => E.decisionLog(rd(p, ".specs", f, "decisions.md"));
  const lesson = (p, f, o) => S.decide(p, f, Object.assign({ title: "Float arithmetic on money", decision: "Money is integer cents; never a float.", kind: "lesson", cause: "example-copied", target: "src/api-keys/service.js" }, o));
  const call = async (name, args) => payload(await rpc("tools/call", { name, arguments: args }));

  // --- the write: the cause (one of five codes, required), the target (a project path, decided on its text first), the markers ------
  {
    const p = demo("write");
    const before = fs.existsSync(path.join(p, ".specs", "api-keys", "decisions.md"));
    const noCause = S.decide(p, "api-keys", { title: "t", decision: "d", kind: "lesson" });
    const badCause = S.decide(p, "api-keys", { title: "t", decision: "d", kind: "lesson", cause: "because-reasons" });
    const onDecision = S.decide(p, "api-keys", { title: "t", decision: "d", cause: "model-error" });
    const onDiscovery = S.decide(p, "api-keys", { title: "t", decision: "d", kind: "discovery", target: "src/api-keys/service.js" });
    const gone = lesson(p, "api-keys", { target: "src/api-keys/gone.js" });
    const goneWrong = lesson(p, "api-keys", { cause: "guidance-wrong", target: ".specs/steering/nowhere.md" });
    all("1.41 lessons: a lesson without a cause (causeRequired), with one outside the five codes (badCause), cause / target on a decision or a discovery (lessonOnly), an example-copied / guidance-wrong target that is gone (targetGone) — each refused, nothing written (got " +
      js([noCause, badCause, onDecision, onDiscovery, gone, goneWrong].map((r) => r.error)) + ")", {
      noCause: noCause.ok === false && noCause.error === D().causeRequired(E.LESSON_CAUSES.join(", ")),
      badCause: badCause.ok === false && badCause.error === D().badCause(js("because-reasons"), E.LESSON_CAUSES.join(", ")),
      lessonOnlyDecision: onDecision.ok === false && onDecision.error === D().lessonOnly,
      lessonOnlyDiscovery: onDiscovery.ok === false && onDiscovery.error === D().lessonOnly,
      targetGone: gone.ok === false && gone.error === D().targetGone("src/api-keys/gone.js", "example-copied"),
      wrongGone: goneWrong.ok === false && /nowhere\.md/.test(goneWrong.error) && goneWrong.error === D().targetGone(".specs/steering/nowhere.md", "guidance-wrong"),
      nothingWritten: !before && !fs.existsSync(path.join(p, ".specs", "api-keys", "decisions.md")),
    });
    // the text rule decides BEFORE any fs call — a network path is never stat'ed (an unreachable host would hang), nor an absolute
    // path elsewhere, nor a way out with `..`
    // (each counted where a stat of it would land: the target resolved against the project — an UNC path on Windows, /host/… on POSIX)
    const outside = [path.join(path.dirname(p), "elsewhere.js"), "../elsewhere.js", "//host/share/x.md", "\\\\host\\share\\x.md", "src/a\nb.js"];
    const calls = outside.map((t) => fsCalls(path.resolve(p, t.split("\n")[0]), () => lesson(p, "api-keys", { cause: "guidance-missing", target: t })));
    const res = outside.map((t) => lesson(p, "api-keys", { cause: "guidance-missing", target: t }));
    all("1.41 lessons: a target outside the project (an absolute path elsewhere, `..`, a network path both ways, a line break) is badTarget — decided on its text: no fs call reaches it (got " + js([res.map((r) => r.error && r.error.slice(0, 40)), calls]) + ")", {
      refused: res.every((r, i) => r.ok === false && r.error === D().badTarget(js(outside[i]))),
      noStat: calls.every((c) => Object.keys(c).length === 0),
      nothingWritten: !fs.existsSync(path.join(p, ".specs", "api-keys", "decisions.md")),
    });
    // a guidance-missing lesson may name the steering file it asks for (not created yet); the target is stored as its project path
    const ok1 = lesson(p, "api-keys", { cause: "guidance-missing", target: "./.specs/steering/money.md", affects: ["T-02"], context: "Task 5, round 1 — finding (92)." });
    const ok2 = lesson(p, "api-keys", { title: "Copied the old verify", target: "./src/api-keys/service.js" });
    const ok3 = S.decide(p, "api-keys", { title: "No target", decision: "Check the tenant first.", kind: "lesson", cause: "model-error" });
    const text = rd(p, ".specs", "api-keys", "decisions.md").replace(/\r\n/g, "\n");
    const entry = (id) => text.split("## " + id + " — ")[1].split("\n## ")[0];
    const e1 = entry("D-1").split("\n");
    all("1.41 lessons: written — kind lesson, the markers in order Kind · Date · Cause · Target · Affects, the target as its project path (./ dropped), the **Lesson:** label; a guidance-missing target may not exist yet; no target → no _Target:_ line (got " + js(e1) + ")", {
      results: ok1.ok && ok1.kind === "lesson" && ok1.cause === "guidance-missing" && ok1.target === ".specs/steering/money.md" && ok2.target === "src/api-keys/service.js" && ok3.ok && ok3.target === null,
      order: e1[2] === "- _Kind: lesson_" && /^- _Date: /.test(e1[3]) && e1[4] === "- _Cause: guidance-missing_" && e1[5] === "- _Target: .specs/steering/money.md_" && e1[6] === "- _Affects: T-02_",
      label: /\n\*\*Lesson:\*\* Money is integer cents; never a float\./.test(entry("D-1")) && !/\*\*Decision:\*\*/.test(entry("D-1")),
      noTarget: !/_Target:/.test(entry("D-3")) && /- _Cause: model-error_/.test(entry("D-3")),
      read: (() => { const l = log(p, "api-keys"); return l[0].kind === "lesson" && l[0].cause === "guidance-missing" && l[0].target === ".specs/steering/money.md" && l[2].target === null && js(l[0].affects) === js(["T-02"]); })(),
    });
    // MCP = the engine (one operations entry): the same refusal, the same entry
    const m1 = await call("spec_decide", { projectDir: p, name: "api-keys", title: "t", decision: "d", cause: "model-error" });
    const m2 = await call("spec_decide", { projectDir: p, name: "api-keys", title: "Over MCP", decision: "Rule.", kind: "lesson", cause: "tool-friction", target: "src/api-keys/service.js" });
    all("1.41 lessons: spec_decide over MCP — the same lessonOnly refusal as the engine, a lesson written with its cause and target (got " + js([m1.error, m2.kind, m2.cause, m2.target]) + ")", {
      refusal: m1.ok === false && m1.error === D().lessonOnly,
      written: m2.ok === true && m2.kind === "lesson" && m2.cause === "tool-friction" && m2.target === "src/api-keys/service.js",
    });
  }

  // --- the reader: a lesson's markers and label only inside a lesson entry (1.40's entries read the same) --------------------------------
  {
    const old = ["# Decisions: X", "", "## D-1 — A decision with a cause line", "", "- _Kind: decision_", "- _Date: 2026-11-20T10:00:00.000Z_", "- _Cause: example-copied_", "",
      "**Context:** Why.", "", "**Lesson:** a paragraph a team wrote under its decision", "", "**Decision:** Use cents.", "", "**Consequences:** Fewer bugs.", "",
      "## D-2 — A lesson", "", "- _Kind: lesson_", "- _Date: 2026-11-21T10:00:00.000Z_", "- _Cause: model-error_", "- _Target: src/x.js_", "",
      "**Context:** the finding.", "- _Cause: guidance-missing_", "", "**Lição:** the rule", "", "## D-3 — A lesson whose cause came first", "", "- _Cause: model-error_", "- _Kind: lesson_", ""].join("\n");
    const l = E.decisionLog(old);
    all("1.41 lessons: `_Cause:_` and `**Lesson:**` in a DECISION entry stay its text (1.40's reading: Decision and Consequences unchanged, no cause key); in a lesson, `_Cause:_` inside Context is text, `**Lição:**` is the label; a cause before `_Kind: lesson_` is not read (got " + js(l.map((e) => [e.kind, e.cause, e.decision, e.context])) + ")", {
      decisionKind: l[0].kind === "decision" && !("cause" in l[0]) && !("target" in l[0]),
      decisionText: l[0].decision === "Use cents." && l[0].consequences === "Fewer bugs." && /\*\*Lesson:\*\* a paragraph a team wrote/.test(l[0].context),
      lessonRead: l[1].kind === "lesson" && l[1].cause === "model-error" && l[1].target === "src/x.js" && l[1].decision === "the rule" && /- _Cause: guidance-missing_/.test(l[1].context),
      causeFirst: l[2].kind === "lesson" && l[2].cause === null,
    });
    // what a caller writes can't fake the label or a marker inside a lesson
    const p = demo("fake");
    lesson(p, "api-keys", { context: "line one\n**Lesson:** a fake rule\n- _Cause: model-error_", decision: "The real rule." });
    const e = log(p, "api-keys")[0];
    ok(e.decision === "The real rule." && /\\\*\\\*Lesson:\*\* a fake rule/.test(e.context) && e.cause === "example-copied",
      "1.41 lessons: a lesson's Context holding `**Lesson:**` / `_Cause:_` lines is written escaped — the rule and the cause read are the caller's own (got " + js([e.decision, e.cause]) + ")");
  }

  // --- the readers that leave lessons out: the brief's Decisions part, decision-affects-approved, the ADR export, the catalog ------------
  {
    const p = demo("readers");
    const L1 = lesson(p, "api-keys", { affects: ["T-02"] }); // the task 5 brief cites T-02
    const dec = S.decide(p, "api-keys", { title: "Keys hashed with SHA-256", decision: "Store the hash only.", affects: ["T-02"] });
    const brief = S.taskBrief(p, "api-keys", 5, {});
    all("1.41 lessons: a lesson citing the task's T-ID is quoted in the brief's Lessons part only — never in its Decisions part (got decisions " + js((brief.decisions || []).map((x) => x.id)) + ", lessons " + js(brief.lessons) + ")", {
      decisions: (brief.decisions || []).map((x) => x.id).join() === dec.id,
      lessons: brief.lessons && brief.lessons.quoted.map((x) => x.id).join() === L1.id,
      once: brief.brief.split("**" + L1.id + "**").length === 2 && brief.brief.includes(D().briefLessonsHeading),
    });
    // the ADR export: a lesson, and a decision closing lessons only, are no ADR; one superseding a lesson AND a decision stays one
    const L2 = lesson(p, "api-keys", { title: "Second lesson", cause: "model-error", target: undefined });
    const close = S.decide(p, "api-keys", { title: "Lessons of api-keys: amended tech.md", decision: "D-1 → tech.md", supersedes: [L1.id, L2.id] });
    const adr = S.exportSpecs(p, { name: "api-keys", format: "adr" });
    const ex = Object.fromEntries(adr.excluded.map((x) => [x.id, x.reason]));
    all("1.41 lessons: spec_export {format: adr} leaves out a lesson (reason lesson) and a decision that only closes lessons (reason lesson-close) — the real decision stays an ADR (got " + js([adr.adrs, adr.excluded]) + ")", {
      adrs: adr.adrs === 1 && adr.documents.filter((d) => d.type === "adr").map((d) => d.id).join() === dec.id,
      lesson: ex[L1.id] === "lesson" && ex[L2.id] === "lesson",
      close: ex[close.id] === "lesson-close",
    });
    const mixed = S.decide(p, "api-keys", { title: "Supersedes a lesson and a decision", decision: "Both replaced.", supersedes: [dec.id, L1.id] });
    const adr2 = S.exportSpecs(p, { name: "api-keys", format: "adr" });
    ok(adr2.documents.some((d) => d.type === "adr" && d.id === mixed.id), "1.41 lessons: a decision superseding a lesson AND a decision is still an ADR (got " + js(adr2.excluded) + ")");
    // the catalog: decisions and discoveries only, its count = its items
    const cat = E.catalogDecisions(path.join(p, ".specs", "api-keys"));
    eq({ count: cat.count, ids: cat.items.map((x) => x.id) }, { count: 2, ids: [dec.id, mixed.id] }, "1.41 lessons: the catalog lists no lesson nor a lesson-closing entry — count = the items (2)");
    // the merge summary: every entry, a lesson's cause → target in its meta, a closed one struck through
    const L3 = lesson(p, "api-keys", { title: "Still open", affects: ["T-02"] });
    const lines = E.decisionSummaryLines(path.join(p, ".specs", "api-keys"), "en");
    all("1.41 lessons: the merge summary keeps the lessons — an open one with its cause → target in its meta, closed ones struck through with their closing entry (got " + js(lines) + ")", {
      closed: lines.some((l) => l === `- ~~**${L1.id}** — Float arithmetic on money~~ _(superseded: ${close.id})_`),
      open: lines.includes(`- **${L3.id}** — Still open _(lesson · example-copied → src/api-keys/service.js · T-02)_: Money is integer cents; never a float.`),
      heading: lines[0] === D().prHeading && lines.length === 7,
    });
  }
  {
    // decision-affects-approved never weighs a lesson (it changes nothing the approved spec says)
    const p = demo("affects-approved");
    fs.writeFileSync(path.join(p, ".specs", "api-keys", ".state.json"), js({ approvals: { requirements: { at: "2026-01-01T00:00:00.000Z" }, design: { at: "2026-01-01T00:00:00.000Z" } } }));
    lesson(p, "api-keys", { affects: ["US-1.AC-2"] });
    const d1 = S.specDoctor(p, "api-keys");
    const before = d1.checks.find((c) => c.id === "decision-affects-approved");
    S.decide(p, "api-keys", { title: "Grace window 24h", decision: "24 hours.", affects: ["US-1.AC-2"] });
    const after = S.specDoctor(p, "api-keys").checks.find((c) => c.id === "decision-affects-approved");
    ok(!before && after && /D-2/.test(after.detail) && !/D-1/.test(after.detail),
      "1.41 lessons: decision-affects-approved skips a lesson recorded after the approval, warns on a decision (got " + js([before, after && after.detail]) + ")");
  }

  // --- finish: `lessons` (only with one), ONE warning for the open ones — never a blocker, the last warning ------------------------------
  {
    const p = demo("finish");
    const f0 = S.finishFeature(p, "usage-metering", {});
    const L1 = lesson(p, "usage-metering", { target: "src/api-keys/service.js" });
    const L2 = lesson(p, "usage-metering", { title: "Logs", cause: "guidance-missing", target: ".specs/steering/logging.md" });
    const f1 = S.finishFeature(p, "usage-metering", {});
    S.decide(p, "usage-metering", { title: "Lessons of usage-metering", decision: "D-1 → structure.md; D-2 declined (one-off).", supersedes: [L1.id, L2.id] });
    const f2 = S.finishFeature(p, "usage-metering", {});
    all("1.41 lessons: spec_finish — no `lessons` key without one (= 1.40); with open ones the lessons view and ONE warning, the LAST, never a blocker (readyToFinish unchanged); all closed → the view, no warning (got " +
      js([f0.lessons, f1.lessons, f1.warnings.slice(-1), f2.lessons]) + ")", {
      none: !("lessons" in f0) && !f0.warnings.some((w) => /lesson/.test(w)),
      open: f1.lessons && f1.lessons.open.map((x) => x.id).join() === "D-1,D-2" && f1.lessons.closed.length === 0 && f1.lessons.open[0].cause === "example-copied" && f1.lessons.open[0].target === "src/api-keys/service.js",
      warningLast: f1.warnings[f1.warnings.length - 1] === D().finishOpen(["D-1", "D-2"], "usage-metering") && f1.warnings.length === f0.warnings.length + 1,
      notBlocker: f1.readyToFinish === f0.readyToFinish && js(f1.blockers) === js(f0.blockers),
      closed: f2.lessons && f2.lessons.open.length === 0 && f2.lessons.closed.map((x) => x.closedBy).join() === "D-3,D-3" && f2.warnings.length === f0.warnings.length,
    });
    // an unread cause (a hand edit) is listed, never counted under a cause
    const file = path.join(p, ".specs", "usage-metering", "decisions.md");
    fs.appendFileSync(file, "\n## D-4 — Hand-written\n\n- _Kind: lesson_\n- _Cause: sloppy_\n\n**Lesson:** something\n");
    const f3 = S.finishFeature(p, "usage-metering", {});
    const m3 = S.metrics(p, "usage-metering");
    all("1.41 lessons: a hand-written cause outside the five codes is `unread` — open, listed, its cause null, never counted in byCause (got " + js([f3.lessons.unread, m3.lessons]) + ")", {
      finish: js(f3.lessons.unread) === js(["D-4"]) && f3.lessons.open.map((x) => x.id).join() === "D-4" && f3.lessons.open[0].cause === null,
      metrics: m3.lessons.total === 3 && m3.lessons.open === 1 && js(m3.lessons.byCause) === js({ "guidance-missing": 1, "example-copied": 1 }) && js(m3.lessons.unread) === js(["D-4"]),
    });
  }

  // --- spec_metrics: a feature's block (only with lessons), the project's over active AND archived folders, `repeated` -------------------
  {
    const p = demo("metrics");
    const k0 = Object.keys(S.metrics(p, "api-keys")), pk0 = Object.keys(S.metrics(p));
    lesson(p, "api-keys", { target: "src/api-keys/service.js" });
    lesson(p, "api-keys", { title: "money → tech", cause: "guidance-missing", target: ".specs/steering/tech.md" });
    lesson(p, "usage-metering", { title: "copied again", target: "./src/api-keys/service.js" }); // `./x` = `x`
    lesson(p, "usage-metering", { title: "logging → tech", cause: "guidance-missing", target: ".specs/steering/tech.md" });
    lesson(p, "usage-metering", { title: "no target", cause: "model-error", target: undefined });
    lesson(p, "usage-metering", { title: "slow check", cause: "tool-friction", target: "src/api-keys/service.js" }); // one feature: never repeated
    const mf = S.metrics(p, "api-keys");
    // two hand-written lessons whose cause reads as none of the codes, the same target in two features: unread, never one repeated group
    const unreadLesson = "\n## D-9 — Hand-written\n\n- _Kind: lesson_\n- _Cause: sloppy_\n- _Target: src/api-keys/service.js_\n\n**Lesson:** x\n";
    for (const f of ["api-keys", "usage-metering"]) fs.appendFileSync(path.join(p, ".specs", f, "decisions.md"), unreadLesson);
    const before = S.metrics(p);
    // an archived feature's lessons still count (the archive is history), and a third feature repeating the copied file
    // (its lesson hand-written, `./`-prefixed: spec_decide stores the project path, a hand edit may not — the grouping reads it as one)
    const f3 = S.createFeature(p, "Invoices", ["core"], "Invoices are sent monthly");
    fs.writeFileSync(path.join(f3.dir, "decisions.md"), "# Decisions: Invoices\n\n## D-1 — copied a third time\n\n- _Kind: lesson_\n- _Date: 2026-11-25T10:00:00.000Z_\n" +
      "- _Cause: example-copied_\n- _Target: ./src/api-keys/service.js_\n\n**Lesson:** Money is integer cents.\n");
    const arch = S.manageFeature(p, "archive", "invoices");
    const after = S.metrics(p);
    all("1.41 lessons: spec_metrics — the feature block {total, open, byCause, unread} only with lessons; the project's over active AND archived folders: `repeated` only for a target outside .specs/ in two features or more (`./x` = `x`), a steering file never, no target never (got " +
      js([mf.lessons, before.lessons, after.lessons]) + ")", {
      keysBefore: !k0.includes("lessons") && !pk0.includes("lessons"),
      feature: js(mf.lessons) === js({ total: 2, open: 2, byCause: { "guidance-missing": 1, "example-copied": 1 }, unread: [] }),
      project: before.lessons.total === 8 && before.lessons.open === 8 && js(before.lessons.byCause) === js({ "guidance-missing": 2, "example-copied": 2, "tool-friction": 1, "model-error": 1 }) &&
        js(before.lessons.unread) === js([{ feature: "api-keys", id: "D-9" }, { feature: "usage-metering", id: "D-9" }]),
      repeated: js(before.lessons.repeated) === js([{ cause: "example-copied", target: "src/api-keys/service.js", features: ["api-keys", "usage-metering"], lessons: 2 }]),
      archived: f3.ok && arch.ok && after.lessons.total === 9 && js(after.lessons.repeated[0].features) === js(["api-keys", "usage-metering", "_archive/invoices"]) && after.lessons.repeated[0].lessons === 3 &&
        after.lessons.repeated.length === 1,
      perFeature: after.features.find((m) => m.feature === "api-keys").lessons.total === 3 && !("lessons" in (after.features.find((m) => m.feature === "invoices") || {})),
    });
    const lines = E.metricsLines(after);
    all("1.41 lessons: the CLI's metrics lines — the project's count by cause, the unread ones, one `repeated:` line each (got " + js(lines.filter((l) => /lessons|repeated/.test(l))) + ")", {
      count: lines.includes(I.msg("en").metrics.lessonsLine(9, 9, "guidance-missing 2 · example-copied 3 · tool-friction 1 · model-error 1")),
      unread: lines.includes(I.msg("en").metrics.lessonsUnread("api-keys D-9, usage-metering D-9")),
      repeated: lines.includes(I.msg("en").metrics.lessonsRepeated("example-copied", "src/api-keys/service.js", "api-keys, usage-metering, _archive/invoices", 3)),
      feature: E.metricsLines(mf).includes(I.msg("en").metrics.lessonsLine(2, 2, "guidance-missing 1 · example-copied 1")),
    });
    // the retro: one line per lesson under the amendments heading, and the signal
    const w = S.metrics(p, "api-keys", { write: true });
    const retro = rd(p, ".specs", "api-keys", "retro.md");
    const T = I.msg("en").metrics.retroText;
    all("1.41 lessons: retro.md — the amendments section starts from the lessons (one line each: cause → target, the rule, open / closed by) and the signals say how many (got " + js(retro.split(T.amend)[1]) + ")", {
      written: w.retro && w.retro.written === true,
      lines: retro.includes("- D-1 (example-copied → src/api-keys/service.js): Money is integer cents; never a float. — open") && retro.includes("- D-2 (guidance-missing → .specs/steering/tech.md):") &&
        retro.includes("- D-9 (? → src/api-keys/service.js): x — open"),
      signal: retro.includes(T.sigLessons(3, 3)),
    });
    // a retro without lessons is 1.40's
    const p2 = demo("retro-none");
    S.metrics(p2, "api-keys", { write: true });
    const plain = rd(p2, ".specs", "api-keys", "retro.md");
    ok(plain.includes(T.amend + "\n\n" + T.amendNote + "\n- \n") && !/lesson/i.test(plain), "1.41 lessons: a retro without lessons keeps 1.40's empty amendments line");
  }

  // --- the brief's Lessons part: open lessons only, newest first, bounded (5 / 1,200 characters), the rest named; refs on write --------
  {
    const p = demo("brief");
    const ids = [];
    for (let i = 1; i <= 7; i++) ids.push(lesson(p, "api-keys", { title: "Lesson " + i, decision: (i === 6 ? "x".repeat(399) : "Rule " + i) + ".", cause: "model-error", target: undefined }).id);
    S.decide(p, "api-keys", { title: "Close the first", decision: "done", supersedes: [ids[0]] });
    const b = S.taskBrief(p, "api-keys", 5, {});
    const w = S.taskBrief(p, "api-keys", 5, { write: true });
    all("1.41 lessons: the brief quotes the OPEN lessons newest first, at most 5, the rest named — a superseded one never (got " + js(b.lessons) + ")", {
      newestFirst: b.lessons.quoted.map((x) => x.id).join() === "D-7,D-6,D-5,D-4,D-3",
      omitted: js(b.lessons.omitted) === js(["D-2"]) && b.brief.includes(D().briefOmitted("D-2")),
      superseded: !b.brief.includes("**D-1**"),
      refs: w.refs && js(w.refs.lessons) === js({ quoted: ["D-7", "D-6", "D-5", "D-4", "D-3"], omitted: ["D-2"] }) && !("lessons" in w),
    });
    // over the character budget the NEWEST stay; an older shorter one fills what is left
    const p2 = demo("brief-budget");
    for (let i = 1; i <= 4; i++) lesson(p2, "api-keys", { title: "L" + i, decision: (i === 1 ? "short" : "y".repeat(380)) + ".", cause: "model-error", target: undefined });
    const b2 = S.taskBrief(p2, "api-keys", 5, {});
    ok(b2.lessons.quoted.map((x) => x.id).join() === "D-4,D-3,D-2,D-1" || b2.lessons.quoted.map((x) => x.id).join() === "D-4,D-3,D-1",
      "1.41 lessons: within 1,200 characters the newest lessons are kept, an older short one fits after them (got " + js(b2.lessons) + ")");
    // no lesson: no part, no key (= 1.40)
    const p3 = demo("brief-none");
    const b3 = S.taskBrief(p3, "api-keys", 5, {});
    ok(!("lessons" in b3) && !b3.brief.includes(D().briefLessonsHeading), "1.41 lessons: a brief without lessons has no Lessons part and no key");
  }

  // --- languages: PT / ES labels, the markers and codes English ---------------------------------------------------------------------
  {
    const p = demo("pt");
    S.createFeature(p, "Faturas", ["core"], "As faturas são enviadas", null, "pt");
    const r = S.decide(p, "faturas", { title: "Dinheiro em vírgula flutuante", decision: "O dinheiro é em cêntimos inteiros.", kind: "lesson", cause: "model-error" });
    const t = rd(p, ".specs", "faturas", "decisions.md");
    S.createFeature(p, "Facturas", ["core"], "Las facturas se envían", null, "es");
    S.decide(p, "facturas", { title: "Dinero", decision: "Céntimos.", kind: "lesson", cause: "model-error" });
    const te = rd(p, ".specs", "facturas", "decisions.md");
    all("1.41 lessons: a PT lesson is labelled **Lição:**, an ES one **Lección:** — `_Kind: lesson_` / `_Cause: model-error_` stay English, and both read back (got " + js([t.slice(-200), te.slice(-120)]) + ")", {
      pt: r.ok && /\n\*\*Lição:\*\* O dinheiro é em cêntimos inteiros\./.test(t) && /- _Kind: lesson_\n/.test(t) && /- _Cause: model-error_\n/.test(t),
      es: /\n\*\*Lección:\*\* Céntimos\./.test(te),
      read: log(p, "faturas")[0].decision === "O dinheiro é em cêntimos inteiros." && log(p, "facturas")[0].decision === "Céntimos.",
      finishPt: S.finishFeature(p, "faturas", {}).warnings.slice(-1)[0] === D("pt").finishOpen(["D-1"], "faturas"),
    });
  }

  // --- 1.41.0 merge: spec_metrics' lessons ride the ONE walk of the metrics blocks (metric.js walkFeatureStates) — COUNTED -----------
  // A project with lessons in an ACTIVE and an ARCHIVED feature and its twin with plain decisions instead: through the facade the twin
  // makes exactly the same fs calls (the feature folders listed as often — no walk of the lessons' own), and each decisions.md is read
  // once; without the read cache (the engine called directly) too — the walk's read of an active folder is handed on to that feature's
  // own metrics, and no second walk reads it again.
  {
    const twin = (n, withLessons) => {
      const p = demo("walk-" + n);
      const inv = S.createFeature(p, "Invoices", ["core"]);
      for (const f of ["api-keys", inv.slug]) {
        if (withLessons) lesson(p, f, {});
        else S.decide(p, f, { title: "Integer cents", decision: "Money is integer cents." });
      }
      const arch = S.manageFeature(p, "archive", inv.slug);
      return { p, arch, act: path.join(p, ".specs", "api-keys", "decisions.md"), old: path.join(p, ".specs", "_archive", inv.slug, "decisions.md") };
    };
    const L = twin("lessons", true), N = twin("plain", false);
    const reads = (x, fn) => [fsCalls(x.act, fn).readFileSync || 0, fsCalls(x.old, fn).readFileSync || 0];
    const r = S.metrics(L.p);
    const cL = fsCalls(L.p + path.sep, () => S.metrics(L.p)), cN = fsCalls(N.p + path.sep, () => S.metrics(N.p));
    const facade = reads(L, () => S.metrics(L.p)), engine = reads(L, () => E.metrics(L.p));
    all("1.41.0 merge: spec_metrics' lessons come from the metrics blocks' ONE walk — a project with lessons in an active and an archived feature makes exactly the fs calls of its twin without lessons, and reads each decisions.md once, through the facade and without the read cache (got " +
      js({ lessons: r.lessons && [r.lessons.total, r.lessons.repeated.map((g) => g.features)], cL, cN, facade, engine }) + ")", {
      setup: L.arch.ok && N.arch.ok && fs.existsSync(L.old) && fs.existsSync(N.old),
      both: r.ok && r.lessons.total === 2 && js(r.lessons.repeated.map((g) => g.features)) === js([["api-keys", "_archive/invoices"]]) &&
        js(r.features.find((m) => m.feature === "api-keys").lessons) === js({ total: 1, open: 1, byCause: { "example-copied": 1 }, unread: [] }),
      sameCalls: js(cL) === js(cN) && (cL.readdirSync || 0) > 0,
      onceFacade: js(facade) === js([1, 1]),
      onceEngine: js(engine) === js([1, 1]),
    });
  }

  // --- 1.41.0 merge: the finish batch's order — dev-guardian's warnings (W, test integrity, the last of them), then the metrics', then
  // the lessons' LAST: the order /spec-finish's ONE batched question lists (commands/spec-finish.md — the prose and the engine agree) --
  {
    const p = path.join(tmp, "proj-lessons-batch");
    const GCMD = "node .specs/guardian.cjs scan --project . --fail-on high --format json", SIZE = 'node -e "process.exit(0)"';
    S.initProject(p, ["core"], "en", { guardian: true, checks: { size: SIZE } });
    const VERIFY = 'node -e "process.exit(0)"';
    const change = (name) => {
      const c = S.createFeature(p, name, undefined, "x", undefined, "en", "change");
      fs.writeFileSync(path.join(c.dir, "change.md"), "# Change: " + name + "\n\n## Summary\nThe change " + name + ".\n\n## Acceptance Criteria (EARS)\n" +
        "1. **US-1.AC-1** — WHEN any page renders THE SYSTEM SHALL show the footer.\n\n## Approach\nOne string.\n\n## Tasks\n- [ ] 1. [US1] Do it\n" +
        "  - _Requirements: US-1.AC-1_\n  - _Verify: " + VERIFY + "_\n");
      S.approvePhase(p, c.slug, null, "t", { through: "tasks" });
      S.completeTask(p, c.slug, 1, { command: VERIFY, exitCode: 0, summary: "ok" });
      return c.slug;
    };
    const TI = (sev, rule, file, line) => ({ fingerprint: rule + file, tool: "guardian-test-integrity", severity: sev, category: "quality", title: rule, rule_id: rule, file_path: file, line_start: line, fix_available: false });
    const report = (fresh) => js({ exit_code: 0, tool_version: "3.17.0", baseline_status: "present", coverage: "full", coverage_gaps: [], new_findings: fresh,
      blocking_findings: [], baseline_absent: false, unused_timeout_acceptances: ["src/gone.js"] });
    const finish = (slug, metric, fresh, write) => S.finishFeature(p, slug, { ranBy: "cli", write, evidence: [
      { name: "guardian", command: GCMD, exitCode: 0, summary: "", report: report(fresh) },
      { name: "size", command: SIZE, exitCode: 0, summary: "ok", output: metric }] });
    const base = change("Base line");
    const first = finish(base, "METRIC bundle=100 kB better=lower tolerance=1%\n", [], true);
    const subj = change("Subject");
    const le = S.decide(p, subj, { title: "Copied the float", decision: "Money is integer cents.", kind: "lesson", cause: "model-error" });
    const until = Date.now() + 3; while (Date.now() < until) { /* a later finished.at */ }
    const r = finish(subj, "METRIC bundle=110 kB better=lower tolerance=1%\n", [TI("low", "test-skipped", "tests/b.test.js", 9)], false);
    const w = r.warnings || [];
    const at = { stale: w.findIndex((s) => /stale accept_timeouts/.test(s)), integrity: w.findIndex((s) => /^dev-guardian: \d+ new finding\(s\) of its test-integrity and suppression checks/.test(s)),
      metrics: w.indexOf(I.msg("en").metric.finishWarn(1, I.msg("en").metric.flagged("bundle", "size", "100 kB", "110 kB", "base-line", E.dayOf(r.metrics[0].reference.at), "+10", "1", "regressed"), 0)),
      lessons: w.indexOf(D().finishOpen(["D-1"], subj)) };
    // the prose: the batch paragraph names the four in this order
    const md = rd(__dirname, "..", "commands", "spec-finish.md").replace(/\s+/g, " ");
    const batch = md.slice(md.indexOf("**The finish batch — ONE question.**"));
    const prose = ["dev-guardian's", "test integrity's (`testIntegrity`", "the metrics' (", "the lessons' (`lessons`"].map((s) => batch.indexOf(s));
    all("1.41.0 merge: the finish batch's order — dev-guardian's warnings with W (test integrity) the last of them, then the METRIC warning, then the lessons' LAST — the order commands/spec-finish.md's batch paragraph lists (got " +
      js({ at, n: w.length, prose, first: first.readyToFinish, warnings: w.map((s) => s.slice(0, 70)) }) + ")", {
      setup: first.readyToFinish && first.baseline && first.baseline.recorded && le.ok && r.readyToFinish,
      found: Object.values(at).every((i) => i >= 0),
      guardianThenW: at.stale + 1 === at.integrity,
      wThenMetrics: at.integrity < at.metrics,
      metricsThenLessons: at.metrics < at.lessons,
      lessonsLast: at.lessons === w.length - 1,
      prose: prose.every((i) => i >= 0) && prose.every((i, k) => k === 0 || prose[k - 1] < i),
    });
  }
};
