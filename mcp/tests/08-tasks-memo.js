"use strict";
// Tasks — the task-blocks memo (1.42 perf-2): its LRU bounds (lruPut), the scans a refresh, a tick and SessionStart make past 32 features, one scan shared by features with the same text.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, all, eq, S, tmp, hookIn, require, __dirname }) => {
  const js = JSON.stringify;
  const E = require("./lib/engine/index.js"); // lruPut is the engine's (not the facade's)
  const scans = () => E.taskBlocks.scans; // misses only: a non-enumerable counter on the engine function (in-process; the facade wraps it)

  // lruPut, the memo's one rule, on small bounds (3 entries, 10 characters of keys): the oldest goes first, a hit (put again) moves
  // its key to the newest place, the kept keys' length is exact through hits and evictions, and the NEWEST entry is always kept —
  // an over-size key too (alone), never refused (refusing it re-scanned a tasks.md over 4 M characters on every call)
  {
    const m = new Map(), st = { chars: 0 }, b = { maxEntries: 3, maxChars: 10 };
    const put = (k) => E.lruPut(m, k, k.toUpperCase(), st, b);
    const keys = () => [...m.keys()].join(",");
    const sum = () => [...m.keys()].reduce((n, k) => n + k.length, 0);
    const got = [];
    for (const k of ["a", "b", "c", "d"]) put(k);
    got.push([keys(), st.chars]); // a evicted
    put("b"); put("e");
    got.push([keys(), st.chars]); // b refreshed: c evicted, not b
    put("ffff"); put("gggg");
    got.push([keys(), st.chars]); // ffff: 4 entries → d out; gggg: 4 entries (10 characters) → b out
    put("hhhhhhhhhhh"); // 11 characters: over the bound alone — kept, alone
    got.push([keys(), st.chars]);
    put("i");
    got.push([keys(), st.chars]); // the over-size key evicted by the next put (its own put kept it)
    eq(got.concat([[sum(), m.get("i")]]), [["b,c,d", 3], ["d,b,e", 3], ["e,ffff,gggg", 9], ["hhhhhhhhhhh", 11], ["i", 1], [1, "I"]],
      "1.42 perf-2 lruPut: the oldest evicted first, a hit moved to the newest place, the characters bound and the entries bound both held, the newest kept even over the bound (alone), chars exact");
  }

  // A 40-feature project (more than the 32 texts the memo held before): each tasks.md a real-shaped 10-task plan — _Requirements:_,
  // _Implements:_, _Verify:_, _Depends:_, half ticked — distinct per feature.
  const p = path.join(tmp, "proj-memo40");
  S.initProject(p, ["core"], "en");
  fs.writeFileSync(path.join(p, ".specs", "ROADMAP.md"), "# Roadmap\n\nHand-written while the features are made.\n"); // no refresh per create
  const N = 40;
  const slugs = [];
  for (let i = 0; i < N; i++) {
    const f = S.createFeature(p, "Memo feature " + i, ["core"], "", undefined, "en");
    const lines = ["# Tasks", "", "## Phase 1: Setup " + i, ""];
    for (let n = 1; n <= 10; n++) {
      lines.push("- [" + (n <= 5 ? "x" : " ") + "] " + n + ". [US1] Step " + n + " of feature " + i, "  - _Requirements: US-1.AC-" + (1 + (n % 3)) + "_",
        "  - _Implements: src/f" + i + "/m" + n + ".js_", "  - _Verify: node --test test/f" + i + "/m" + n + ".test.js_");
      if (n > 1) lines.push("  - _Depends: " + (n - 1) + "_");
      if (n === 5) lines.push("", "**Checkpoint:** half " + i, "", "## Phase 2: Core " + i, "");
    }
    fs.writeFileSync(path.join(f.dir, "tasks.md"), lines.join("\n") + "\n");
    slugs.push(f.slug);
  }
  fs.rmSync(path.join(p, ".specs", "ROADMAP.md")); // generated from here on: a mutation refreshes it
  const texts = slugs.map((s) => fs.readFileSync(path.join(p, ".specs", s, "tasks.md"), "utf8"));

  // the counts, as properties (never a pinned total: the texts a call reads depend on the fixture) — a cold refresh scans each text
  // it reads once at most (fresh texts: ≥ 1), a warm one nothing, a tick then its refresh the ticked text alone, SessionStart at most
  // one text a feature
  {
    const s0 = scans();
    const cold = S.roadmapReport(p, { write: true });
    const s1 = scans();
    const warm = S.roadmapReport(p, { write: true });
    const s2 = scans();
    const tick = S.completeTask(p, slugs[7], 6); // refreshes ROADMAP.md (generated): every other feature's text is in the memo
    const s3 = scans();
    const ss = hookIn(path.join(__dirname, "..", "hooks", "spec-hook.js"), { input: js({ session_id: "s", cwd: p, hook_event_name: "SessionStart", source: "startup" }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" }, encoding: "utf8" });
    const s4 = scans();
    all("1.42 perf-2: past 32 features the memo keeps every text a refresh reads — a cold refresh of 40 features scans at most 2 texts a feature, a warm one 0 (1.41.2: 160), a tick then its refresh 1 (the ticked text; 1.41.2: 162), SessionStart at most one a feature (got " +
      js({ cold: s1 - s0, warm: s2 - s1, tick: s3 - s2, sessionStart: s4 - s3, wrote: [cold.ok !== false, warm.ok !== false], ticked: tick.ok, ss: ss.status }) + ")", {
      counted: () => typeof s0 === "number" && s1 - s0 > 0,
      cold: () => cold.ok !== false && s1 - s0 <= 2 * N,
      warm: () => warm.ok !== false && s2 - s1 === 0,
      tick: () => tick.ok === true && s3 - s2 === 1,
      sessionStart: () => ss.status === 0 && s4 - s3 <= N,
      written: () => fs.existsSync(path.join(p, ".specs", "ROADMAP.md")),
    });
  }

  // (red against 1.41.2: 32 texts held — a second pass over 40 scanned all 40 again) one scan per text, kept across two passes:
  // taskPeerStamps is ONE Set per scan (SCAN_STAMPS), so the same Set twice means the second pass was served by the first's scan
  {
    const first = texts.map((t) => E.taskPeerStamps(S.taskBlocks(t)[0]));
    const second = texts.map((t) => E.taskPeerStamps(S.taskBlocks(t)[0]));
    const same = first.filter((s, i) => s && s === second[i]).length;
    ok(same === N, "1.42 perf-2: 40 distinct tasks.md texts, two passes — each text's second read is the first pass's scan (the same peer-stamp Set), never a re-scan (got " + same + " of " + N + ")");
  }

  // (1.42 [INT-1]) Features whose tasks.md are byte-identical share ONE scan: what one feature's readers make of its blocks never
  // reaches the other's. A bugfix and a plain feature with the same tasks text: each one's next task, brief and status, read in
  // this process one after the other (the second served by the first's scan), equal the same calls in a fresh process that never
  // read its twin — a field written onto a shared scan (a plan note, a bugfix's investigation mark) would differ there.
  {
    const q = path.join(tmp, "proj-memo-twins");
    S.initProject(q, ["core"], "en");
    fs.writeFileSync(path.join(q, ".specs", "ROADMAP.md"), "# Roadmap\n\nHand-written.\n");
    const bug = S.createFeature(q, { name: "Login loop", kind: "bugfix", lang: "en" });
    const plain = S.createFeature(q, { name: "Login form", tracks: ["core"], lang: "en" });
    const text = "# Tasks\n\n- [ ] 1. [US1] Investigate the redirect loop and write the failing test for US-1.AC-1\n  - _Requirements: US-1.AC-1_\n" +
      "  - _Implements: test/login.test.js_\n  - _Verify: node --test test/login.test.js_\n- [ ] 2. [US1] Fix the session check\n  - _Requirements: US-1.AC-1_\n" +
      "  - _Implements: src/session.js_\n  - _Verify: node --test test/login.test.js_\n  - _Depends: 1_\n";
    fs.writeFileSync(path.join(bug.dir, "tasks.md"), text);
    fs.writeFileSync(path.join(plain.dir, "tasks.md"), text);
    const views = (slug) => ({ next: S.nextTask(q, slug), brief: S.taskBrief(q, slug, 1, {}), status: S.statusFeature(q, slug) });
    const here = { [bug.slug]: views(bug.slug), [plain.slug]: views(plain.slug) };
    const again = views(bug.slug); // after its twin read the shared scan
    const script = path.join(tmp, "memo-twin-views.js");
    fs.writeFileSync(script, "const S = require(process.argv[2]);\nconst q = process.argv[3], slug = process.argv[4];\n" +
      "process.stdout.write(JSON.stringify({ next: S.nextTask(q, slug), brief: S.taskBrief(q, slug, 1, {}), status: S.statusFeature(q, slug) }));\n");
    const alone = (slug) => {
      const r = spawnSync(process.execPath, [script, path.join(__dirname, "lib", "spec.js"), q, slug], { encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" }, timeout: 60000 });
      try { return JSON.parse(r.stdout); } catch { return { failed: String(r.stderr || r.error || r.status).slice(0, 300) }; }
    };
    const fresh = { [bug.slug]: alone(bug.slug), [plain.slug]: alone(plain.slug) };
    const differ = [bug.slug, plain.slug].filter((s) => js(here[s]) !== js(fresh[s])).concat(js(again) !== js(fresh[bug.slug]) ? [bug.slug + " (read again)"] : []);
    // the mechanism under it: every caller gets its own copies of the shared scan — a field one writes (and a body line it adds) is
    // never on the next caller's blocks
    const mine = S.taskBlocks(text);
    mine[0].planNote = "mine"; mine[0].body.push("mine");
    const theirs = S.taskBlocks(text);
    all("1.42 perf-2 [INT-1]: a bugfix and a plain feature with byte-identical tasks.md share one scan — each one's next task, brief and status read in one process (its twin read first, then itself again) equal a fresh process's that never read its twin (got " +
      js({ kinds: [here[bug.slug].status.kind, here[plain.slug].status.kind], differ, next: [here[bug.slug].next.task && here[bug.slug].next.task.number, here[plain.slug].next.task && here[plain.slug].next.task.number], fresh: Object.values(fresh).map((v) => v.failed || "ok") }) + ")", {
      shared: () => E.taskPeerStamps(S.taskBlocks(fs.readFileSync(path.join(bug.dir, "tasks.md"), "utf8"))[0]) === E.taskPeerStamps(S.taskBlocks(fs.readFileSync(path.join(plain.dir, "tasks.md"), "utf8"))[0]),
      freshRan: () => Object.values(fresh).every((v) => !v.failed),
      equal: () => differ.length === 0,
      "own copies: a field and a body line one caller writes never reach the next": () => theirs[0].planNote === undefined && !theirs[0].body.includes("mine") &&
        E.taskPeerStamps(mine[0]) === E.taskPeerStamps(theirs[0]),
    });
  }
};
