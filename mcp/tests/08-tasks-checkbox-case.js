"use strict";
// Tasks — an upper-case `[X]` box reads as `[x]` (1.42 R2): each reader of a box on a fixture shaped for it (status / next_task, doctor's unread-tasks, trace and its matrix with a checkbox criterion as its AC's only definition, EARS, the HTML export, the approval fingerprint), and every operation's read pass on a [x] / [X] twin.

const fs = require("fs");
const path = require("path");
const { operationCalls } = require("./12-lifecycle-read-gate.js"); // (the calls that drive every operation — one fixture, never a copy)

exports.run = async ({ all, eq, S, tmp, require }) => {
  const js = JSON.stringify;
  const { OPERATIONS } = require("./lib/operations.js");
  // A feature `box`: two criteria — US-1.AC-2 written as a checkbox criterion, its ONLY definition —, four tasks (1 and 3 ticked),
  // a box line no task reads. `x` is the tick's spelling; the twin differs by it alone. The roots `<tag>/proj` share a length and a
  // basename, so text padded to a width never shifts between the twins.
  const REQ = (x) => "# Feature: Box\n\n## Summary\nBoxes.\n\n### US-1 Save (P1)\n\n#### Acceptance Criteria (EARS)\n" +
    "1. **US-1.AC-1** — WHEN a user saves an item THE SYSTEM SHALL store it\n- [" + x + "] **US-1.AC-2** — WHEN a user deletes an item THE SYSTEM SHALL remove it\n";
  const TASKS = (x) => "# Tasks\n\n" + [
    "- [" + x + "] 1. [US1] Store it for US-1.AC-1\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/a.js_\n  - _Verify: node -v_\n",
    "- [ ] 2. [US1] Remove it for US-1.AC-2\n  - _Requirements: US-1.AC-2_\n  - _Implements: src/b.js_\n  - _Verify: node -v_\n",
    "- [" + x + "] 3. [US1] Log it for US-1.AC-1\n  - _Requirements: US-1.AC-1_\n  - _Verify: node -v_\n",
    "- [ ] 4. [US1] Show it for US-1.AC-2\n  - _Requirements: US-1.AC-2_\n  - _Verify: node -v_\n",
    "- [" + x + "] note: a box line no task reads\n"].join("\n");
  const twin = (tag, x) => {
    const p = path.join(tmp, "r2" + tag, "proj");
    fs.mkdirSync(path.join(p, "src"), { recursive: true });
    S.initProject(p, ["core"], "en");
    const f = S.createFeature(p, { name: "box", tracks: ["core"] });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ(x));
    fs.writeFileSync(path.join(f.dir, "tasks.md"), TASKS(x));
    fs.writeFileSync(path.join(p, "src", "a.js"), "module.exports = 1;\n");
    return p;
  };
  // one reading as text, the twin's differences that are no reading taken out: its root (raw and JSON-escaped), a stamp, a 40-hex
  // digest (by its shape: a fingerprint of the raw text), the tick's spelling
  const norm = (v, p) => {
    let s = js(v === undefined ? null : v);
    for (const r of [js(p).slice(1, -1), p, p.split(path.sep).join("/")]) s = s.split(r).join("<P>");
    return s.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, "<at>").replace(/\b[0-9a-f]{40}\b/g, "<h>").replace(/\[X\]/g, "[x]");
  };
  const A = twin("a", "x"), B = twin("b", "X");
  const both = (fn) => [norm(fn(A), A), norm(fn(B), B)];
  const same = (pair) => pair[0] === pair[1];

  // status's done count and next_task (tasks.js's task line, RE_TASK_LINE_HEAD)
  {
    const st = both((p) => S.statusFeature(p, "box").tasks), nx = both((p) => S.nextTask(p, "box").next);
    const a = S.statusFeature(A, "box").tasks;
    all("1.42 R2: an [X] task is ticked as an [x] one — status counts it done, next_task serves the first open task (got " + js({ st, nx }) + ")", {
      status: () => same(st) && a.total === 4 && a.done === 2, next: () => same(nx) && S.nextTask(B, "box").next.number === 2,
    });
  }
  // doctor's unread-tasks: a box line that is no task (tasks.js's box-line reader) is named in both spellings
  {
    const un = both((p) => (S.specDoctor(p, "box").checks || []).find((c) => c.id === "unread-tasks"));
    all("1.42 R2: doctor's unread-tasks names an [X] box line no task reads as it names an [x] one (got " + js(un) + ")", {
      same: () => same(un), named: () => /note: a box line no task reads/.test(un[0]) && /"status":"warn"/.test(un[0]),
    });
  }
  // trace (its criterion readers: a checkbox criterion as its AC's only definition) and its matrix's task leads; EARS
  {
    const tr = both((p) => S.traceCheck(p, "box", { matrix: true }));
    const ears = both((p) => S.earsFeature(p, "box"));
    const a = S.traceCheck(A, "box", { matrix: true });
    all("1.42 R2: a criterion written `- [X] **US-1.AC-2** — …` defines its AC as `- [x]` does — trace (and its matrix) and EARS read the same (got " + js({ tr: tr.map((t) => t.slice(0, 300)), ears }) + ")", {
      trace: () => same(tr) && !a.phantomAcsInTasks.length && !a.uncoveredByTasks.length,
      ears: () => same(ears) && /"withStableId":2/.test(ears[0]),
    });
  }
  // the HTML export: a ticked box is drawn as one
  {
    const ex = both((p) => { const r = S.exportSpecs(p, { name: "box", format: "html" }); return (js(r).match(/☑/g) || []).length; });
    all("1.42 R2: the HTML export draws an [X] box ticked, as an [x] one (got " + js(ex) + ")", { same: () => same(ex) && +ex[0] >= 1 });
  }
  // the approval fingerprint: tasks approved with open boxes, then ticked by hand — as [x] or [X], no change since the approval
  // (doctor) and no re-review (next_action); a real edit of the same file is both. `*` bullets (task lines too: the scanner reads
  // any GFM bullet): the pre-1.22 rule that also matches an approval reads `- [x]` lines alone, so a `-` list would hide the
  // current rule's case behind it
  {
    const star = (t) => t.replace(/^- \[/gm, "* [");
    const approved = (tag, after) => {
      const p = path.join(tmp, "r2fp-" + tag, "proj");
      fs.mkdirSync(p, { recursive: true });
      S.initProject(p, ["core"], "en");
      const f = S.createFeature(p, { name: "box", tracks: ["core"] });
      fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ(" ").replace(/- \[ \] \*\*US-1\.AC-2\*\*/, "2. **US-1.AC-2**"));
      fs.writeFileSync(path.join(f.dir, "tasks.md"), star(TASKS(" ")));
      const ap = S.approvePhase(p, "box", null, "t", { through: "tasks", force: true, reason: "r" });
      fs.writeFileSync(path.join(f.dir, "tasks.md"), star(after));
      const changed = (S.specDoctor(p, "box").checks || []).some((c) => c.id === "changed-since-approval");
      return { ok: ap.ok === true, changed, step: S.nextAction(p, "box").step, done: S.statusFeature(p, "box").tasks.done };
    };
    const r = { lower: approved("lower", TASKS("x")), upper: approved("upper", TASKS("X")), edit: approved("edit", TASKS("x").replace("Show it", "Show it again")) };
    all("1.42 R2: tasks approved with open boxes and then ticked by hand — [x] or [X] — are no change since the approval (doctor) and ask no re-review (next_action); a real edit of the same file is both (got " + js(r) + ")", {
      approved: () => Object.values(r).every((x) => x.ok),
      ticks: () => !r.lower.changed && !r.upper.changed && r.lower.step === r.upper.step && r.upper.step !== "re-review" && r.upper.done === 2,
      edit: () => r.edit.changed && r.edit.step === "re-review",
    });
  }
  // the criterion readers a plain criterion list never reaches — each on the shape that reaches it (a second reader answers for
  // the others): a criterion copied twice (ac-uniqueness: the label and the list definition), a heading led by a box (the lead
  // definition), an empty slot after a box (the placeholder reader's whole value), a +sec section answered only by `- [X] TBD` (a
  // section's written line). Each twin reads as its [x] one, and the [x] one reads what the shape is about.
  {
    const HEAD = REQ(" ").split("- [ ] **US-1.AC-2**")[0];
    const shaped = (tag, x, tracks, files) => {
      const p = path.join(tmp, "r2s" + tag + (x === "X" ? "u" : "l"), "proj");
      fs.mkdirSync(p, { recursive: true });
      S.initProject(p, ["core"], "en");
      const f = S.createFeature(p, { name: "box", tracks });
      for (const [rel, t] of Object.entries(files(x))) fs.writeFileSync(path.join(f.dir, rel), typeof t === "function" ? t(fs.readFileSync(path.join(f.dir, rel), "utf8")) : t);
      return p;
    };
    const read = (tag, tracks, files, fn) => { const a = shaped(tag, "x", tracks, files), b = shaped(tag, "X", tracks, files); return { pair: [norm(fn(a), a), norm(fn(b), b)], a: fn(a) }; };
    const check = (p, re) => (S.specDoctor(p, "box").checks || []).filter((c) => re.test(c.id));
    const crit = (x) => "- [" + x + "] **US-1.AC-2** — WHEN a user deletes an item THE SYSTEM SHALL remove it\n";
    const dup = read("dup", ["core"], (x) => ({ "requirements.md": HEAD + crit(x) + crit(x) }), (p) => check(p, /^ac-uniqueness$/));
    const head = read("head", ["core"], (x) => ({ "requirements.md": HEAD + "\n##### [" + x + "] US-1.AC-3 — WHEN a user edits an item THE SYSTEM SHALL keep it\n" }), (p) => S.earsFeature(p, "box"));
    const slot = read("slot", ["core"], (x) => ({ "requirements.md": HEAD + crit(x) + "\n## Assumptions\n\n- [" + x + "] []\n" }), (p) => check(p, /^placeholders$/));
    const sec = read("sec", ["core", "sec"], (x) => ({ "design.md": (d) => d.replace(/(\n## \[SEC\][^\n]*\n)[\s\S]*?(?=\n## )/, "$1\n- [" + x + "] TBD\n") }), (p) => check(p, /^sec-sections$/));
    all("1.42 R2: a criterion copied twice, a heading led by a box, an empty slot after a box and a +sec section answered by a ticked TBD read the same in [X] as in [x] — a duplicate, a criterion, a placeholder, an unfilled section (got " +
      js({ dup: dup.pair[0], head: head.pair[0].slice(0, 200), slot: slot.pair[0].slice(0, 200), sec: sec.pair[0] }) + ")", {
      duplicate: () => same(dup.pair) && dup.a.length === 1 && dup.a[0].status === "fail" && /US-1\.AC-2/.test(dup.a[0].detail),
      headingBox: () => same(head.pair) && head.a.summary.criteriaDetected === 2 && head.a.summary.withStableId === 2,
      emptySlot: () => same(slot.pair) && slot.a.length === 1 && slot.a[0].status === "fail" && /requirements\.md:\d+ \[\]/.test(slot.a[0].detail),
      secSection: () => same(sec.pair) && sec.a.length === 1 && /Threat Model:unfilled/.test(sec.a[0].detail),
    });
  }
  // the smoke twin: every operation's read pass on fresh copies of the twin — the same results but for the tick's spelling (a
  // smoke: most box readers are reached by the targeted rows above, several behind a second reader for every input tried)
  {
    const A2 = path.join(tmp, "r2c", "proj"), B2 = path.join(tmp, "r2d", "proj");
    fs.cpSync(A, A2, { recursive: true });
    fs.cpSync(B, B2, { recursive: true });
    const pass = operationCalls(OPERATIONS, { names: ["box"], other: "box", report: "box" })(false);
    const diffs = [], driven = new Set();
    for (const { op, o } of pass) {
      const run = (p) => { try { return op.call(S, p, o); } catch (e) { return { threw: e.message }; } };
      const a = norm(run(A2), A2), b = norm(run(B2), B2);
      driven.add(op.id);
      if (a !== b) { let i = 0; while (a[i] === b[i]) i++; diffs.push(op.id + " @" + i + ": " + a.slice(Math.max(0, i - 40), i + 60) + " ≠ " + b.slice(Math.max(0, i - 40), i + 60)); }
    }
    all("1.42 R2: every operation's read pass (" + pass.length + " calls, " + driven.size + " operations) answers an [X] twin as its [x] one (got " + js(diffs.slice(0, 6)) + ")", {
      everyOp: () => driven.size === OPERATIONS.length, same: () => !diffs.length,
    });
  }
};
