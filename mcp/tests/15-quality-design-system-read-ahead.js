"use strict";
// The design-system registry — 1.35.4: the scan's two long reads read AHEAD in worker threads (files.js readFileHeads) where
// opens are slow: readFileHead's text, in order, in every mode (on / off / fail, a worker that never starts or goes silent);
// when the pool starts (the probe's timing, the list's length), its window, an early stop, the scan and the CLI alike.

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const wt = require("worker_threads");

exports.run = async ({ all, S, tmp, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const ENGINE = path.join(__dirname, "lib", "engine", "index.js");
  const CLI = path.join(__dirname, "..", "cli", "dev-spec.js");
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const L = (lines) => lines.join("\n") + "\n";
  const UI = "src/components/ui/";
  const project = (tag, files) => {
    const p = path.join(tmp, "proj-ahead-" + tag);
    for (const [rel, text] of Object.entries(files || {})) write(p, rel, text);
    S.initProject(p, ["ui"], "en");
    return p;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (cond, ms) => { const t0 = Date.now(); while (!cond() && Date.now() - t0 < ms) await sleep(10); return cond(); };
  // the first index where two lists of heads differ → "i: got ≠ want" (null: the same)
  const firstDiff = (got, want) => {
    for (let i = 0; i < Math.max(got.length, want.length); i++) if (got[i] !== want[i]) return i + ": " + String(js(got[i])).slice(0, 50) + " ≠ " + String(js(want[i])).slice(0, 50);
    return null;
  };
  const caught = (fn) => { try { return { v: fn() }; } catch (e) { return { error: String((e && e.stack) || e).split("\n").slice(0, 3).join(" / ") }; } };
  const ran = (r) => () => { if (r.error) throw new Error(r.error); return true; };
  // The workers the engine starts, seen through worker_threads' own constructor (aheadPool reads it at call time): each one's
  // online / exit, and — o.silent(j) — one that runs nothing (never gives a file), o.throwAt — the j-th that fails to start
  const spyWorkers = (o = {}) => {
    const Real = wt.Worker, made = [];
    wt.Worker = class extends Real {
      constructor(src, opts) {
        if (o.throwAt === made.length) throw new Error("no worker " + made.length + " (the test)");
        super(o.silent && o.silent(made.length) ? "setTimeout(() => {}, 120000);" : src, opts);
        const rec = { online: false, exited: false };
        made.push(rec);
        this.on("online", () => { rec.online = true; });
        this.on("exit", () => { rec.exited = true; });
      }
    };
    return { made, restore: () => { wt.Worker = Real; } };
  };
  // DEV_SPEC_TEST_AHEAD set for fn, then put back as it was
  const withMode = (mode, fn) => {
    const saved = process.env.DEV_SPEC_TEST_AHEAD;
    if (mode == null) delete process.env.DEV_SPEC_TEST_AHEAD; else process.env.DEV_SPEC_TEST_AHEAD = mode;
    try { return fn(); } finally { if (saved === undefined) delete process.env.DEV_SPEC_TEST_AHEAD; else process.env.DEV_SPEC_TEST_AHEAD = saved; }
  };
  // every head of `list` through readFileHeads → { out, made, ms }; tick: the probe's clock advances `tick` ns a call (the
  // probe's 32 reads, then the real clock again) — 0: the probe says "fast" whatever the disk, so only the mode decides
  const readAll = (list, chars, mode, { tick = null, spy: so } = {}) => {
    const spy = spyWorkers(so), clock = process.hrtime.bigint;
    let c = 0n;
    if (tick != null) process.hrtime.bigint = () => (c += BigInt(tick));
    const out = [], t0 = Date.now();
    try {
      return withMode(mode, () => {
        const h = E.readFileHeads(list, chars);
        try { for (let i = 0; i < list.length; i++) { out.push(h.next()); if (i === 31) process.hrtime.bigint = clock; } } finally { h.stop(); }
        return { out, made: spy.made, ms: Date.now() - t0 };
      });
    } finally {
      process.hrtime.bigint = clock;
      spy.restore();
    }
  };
  // a node process → { code, signal, killed, stdout, stderr, ms } — killed after killMs (a hang FAILS, never waits forever)
  const runNode = (args, { env, cwd, killMs }) => new Promise((resolve) => {
    const t0 = Date.now();
    const ch = spawn(process.execPath, args, { env, cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", killed = false;
    ch.stdout.on("data", (d) => { stdout += d; });
    ch.stderr.on("data", (d) => { stderr += d; });
    const timer = setTimeout(() => { killed = true; ch.kill(); }, killMs);
    ch.on("close", (code, signal) => { clearTimeout(timer); resolve({ code, signal, killed, stdout, stderr, ms: Date.now() - t0 }); });
  });

  // --- the files: every encoding readFileHead decodes, a cut, an empty file, a missing path, a folder -------------------------------
  const CHARS = 101; // odd: the cut falls inside a surrogate pair
  const EURO = String.fromCharCode(0x20ac), E_ACUTE = String.fromCharCode(0xe9), EMOJI = String.fromCodePoint(0x1f600);
  const le = (s) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, "utf16le")]);
  const be = (s) => { const b = Buffer.from(s, "utf16le"); b.swap16(); return Buffer.concat([Buffer.from([0xfe, 0xff]), b]); };
  const KINDS = [
    (i) => Buffer.from("plain " + i + "\nline two\n"),
    (i) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("utf-8 bom " + i + " " + E_ACUTE + "\n")]),
    (i) => le("utf-16 le " + i + " " + E_ACUTE + EURO + "\n"),
    (i) => be("utf-16 be " + i + " " + E_ACUTE + EURO + "\n"),
    (i) => Buffer.from("cr " + i + "\rtwo\rthree"),
    (i) => Buffer.from("crlf " + i + "\r\nlone\rcr"),
    (i) => Buffer.from("long " + i + " " + "x".repeat(CHARS * 4 + 37)), // past one read of CHARS × 4 bytes
    (i) => Buffer.from(EURO.repeat(CHARS * 2) + i), // three bytes a character: the read ends inside one
    (i) => Buffer.from(EMOJI.repeat(CHARS + 3) + i), // surrogate pairs
    (i) => Buffer.from(E_ACUTE.repeat(150) + i),
    (i) => Buffer.concat([le("odd " + i), Buffer.from([0x41])]), // an odd UTF-16 length
    () => Buffer.alloc(0), // empty
    () => null, // a missing path
    () => "dir", // a folder
  ];
  const fileSet = (tag, n, kinds = KINDS) => {
    const d = path.join(tmp, "proj-ahead-files-" + tag);
    fs.mkdirSync(d, { recursive: true });
    const list = [];
    for (let i = 0; i < n; i++) {
      const f = path.join(d, "h" + String(i).padStart(3, "0") + ".txt"), b = kinds[i % kinds.length](i);
      if (b === "dir") fs.mkdirSync(f, { recursive: true }); else if (b) fs.writeFileSync(f, b);
      list.push(f);
    }
    return list;
  };

  // --- (a) what readFileHeads gives: readFileHead's text for each file, in order, in every mode ----------------------------------------
  {
    const list = fileSet("id", 300);
    // (1,000 paths: the 300 files, then 700 that do not exist — a list whose files left outlast the pool's start at 200 µs)
    const long = list.concat(Array.from({ length: 700 }, (_, i) => path.join(tmp, "proj-ahead-nowhere", "n" + i + ".txt")));
    const ref = long.map((f) => E.readFileHead(f, CHARS));
    const r = caught(() => ({
      on: readAll(list, CHARS, "on", { tick: 0 }),
      off: readAll(list, CHARS, "off", { tick: 1e6 }),
      fail: readAll(list, CHARS, "fail", { tick: 0 }),
      slow: readAll(long, CHARS, null, { tick: 200000 }), // the probe's 32 reads at 200 µs each: the bound itself
      fast: readAll(long, CHARS, null, { tick: 199999 }),
      // (review 1 of 1.38: the files left × the probe's average against the pool's start, AHEAD_START_US = 80 ms — 250 left
      // at 320 µs is the bound itself; 1 ns a read under starts none, though 200 µs and 64 files left are passed)
      start: readAll(list.slice(0, 282), CHARS, null, { tick: 320000 }),
      brief: readAll(list.slice(0, 282), CHARS, null, { tick: 319999 }),
      short: readAll(list.slice(0, 95), CHARS, "on", { tick: 0 }), // 32 + 63: one under AHEAD_MIN past the probe
      edge: readAll(list.slice(0, 96), CHARS, "on", { tick: 0 }),
    }));
    const v = r.v || {};
    const view = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, { made: x.made.length, diff: firstDiff(x.out, ref.slice(0, x.out.length)) }]));
    const kinds = { nulls: ref.slice(0, 300).filter((t) => t === null).length, empty: ref.filter((t) => t === "").length, cut: ref.filter((t) => t && t.length === CHARS).length };
    const nth = (k) => list.filter((_, i) => i % KINDS.length === k).length;
    all("1.35.4: readFileHeads gives, file by file and in order, exactly what readFileHead gives — UTF-8 with and without a BOM, UTF-16 LE / BE with a BOM (an odd length too), CR-only line ends, a read cut at maxChars (ASCII, three-byte characters, a surrogate pair cut by an odd maxChars), an empty file \"\", a missing path and a folder null — whether its workers read them (on; the probe at 200 µs a file, mode unset) or it reads them in sequence (off, fail — no worker starts —, a probe under 200 µs a file, a list too short); the pool starts when the probe's 32 reads average 200 µs or more (the bound itself starts it, 1 ns a read under does not) and 64 files remain — 96 files start 8 workers, 95 none, whatever the mode — and (review 1 of 1.38) when the files left × the probe's average reach the pool's 80 ms start (250 left at 320 µs start it, at 1 ns a read under none) (got " + js({ view, kinds, error: r.error }) + ")", {
      ran: ran(r),
      fixture: () => kinds.nulls === nth(12) + nth(13) && kinds.empty === nth(11) && kinds.cut >= 4 * nth(6) && ref.slice(300).every((t) => t === null),
      same: () => Object.values(view).every((x) => x.diff === null),
      on: () => view.on.made === 8 && view.slow.made === 8 && view.edge.made === 8 && view.start.made === 8,
      none: () => view.off.made === 0 && view.fail.made === 0 && view.fast.made === 0 && view.short.made === 0 && view.brief.made === 0,
    });
  }

  // --- a worker that fails to start; the window each worker reads ahead -----------------------------------------------------------
  {
    const list = fileSet("start", 200);
    const ref = list.map((f) => E.readFileHead(f, CHARS));
    // (the fifth worker's constructor throws: the four started are stopped, every file is read in sequence)
    const r = caught(() => readAll(list, CHARS, "on", { tick: 0, spy: { throwAt: 4 } }));
    const startMade = r.v ? r.v.made : [];
    const exited = await until(() => startMade.length > 0 && startMade.every((m) => m.exited), 5000);
    // The window: worker j reads files j, j + 8, j + 16, j + 24 of the pool's (AHEAD_WINDOW = 4 ahead of what is taken) and no
    // further until the caller takes one of its files. The pool's first 32 files exist when it starts and are deleted once
    // the workers had the time to read them; the next 64 do not exist then and are written before the caller takes any: what
    // was read ahead is the first 32's text, the rest is read as written after — none ahead of its window, none late.
    let round = 0;
    const windowCase = async (settle) => {
      const d = path.join(tmp, "proj-ahead-window-" + (++round));
      fs.mkdirSync(d, { recursive: true });
      const probe = Array.from({ length: 32 }, (_, i) => path.join(d, "probe" + String(i).padStart(2, "0") + ".txt"));
      const pool = Array.from({ length: 96 }, (_, i) => path.join(d, "pool" + String(i).padStart(2, "0") + ".txt"));
      probe.forEach((f, i) => fs.writeFileSync(f, "probe " + i));
      pool.slice(0, 32).forEach((f, i) => fs.writeFileSync(f, "ahead " + i));
      const spy = spyWorkers(), clock = process.hrtime.bigint;
      const got = [];
      let h = null, online = false;
      const saved = process.env.DEV_SPEC_TEST_AHEAD;
      process.env.DEV_SPEC_TEST_AHEAD = "on";
      try {
        process.hrtime.bigint = () => 0n;
        h = E.readFileHeads(probe.concat(pool), 64);
        for (let i = 0; i < 32; i++) got.push(h.next());
        process.hrtime.bigint = clock;
        online = await until(() => spy.made.length === 8 && spy.made.every((m) => m.online), 10000);
        await sleep(settle);
        pool.slice(0, 32).forEach((f) => fs.rmSync(f));
        pool.slice(32).forEach((f, i) => fs.writeFileSync(f, "late " + (32 + i)));
        for (let i = 0; i < 96; i++) got.push(h.next());
      } finally {
        process.hrtime.bigint = clock;
        if (h) h.stop();
        if (saved === undefined) delete process.env.DEV_SPEC_TEST_AHEAD; else process.env.DEV_SPEC_TEST_AHEAD = saved;
        spy.restore();
      }
      const want = probe.map((_, i) => "probe " + i).concat(pool.map((_, i) => (i < 32 ? "ahead " : "late ") + i));
      return { made: spy.made.length, online, diff: firstDiff(got, want) };
    };
    let w = null, wErr = null;
    try { w = await windowCase(300); if (w.diff !== null) w = await windowCase(1500); } catch (e) { wErr = e; } // (once more, longer, on a miss: a loaded machine)
    all("1.35.4: a worker that fails to start leaves every file to readFileHead, in order — the ones started are stopped (got " + js({ diff: r.v && firstDiff(r.v.out, ref), made: startMade.length, exited, error: r.error }) + "); each of the 8 workers reads AHEAD_WINDOW = 4 files ahead of the one taken — the pool's first 32 files are read before the caller takes any (deleted then, their text still given), the 33rd onward only once the caller takes (written after the pool started, their text given) (got " + js({ w, error: wErr && String(wErr) }) + ")", {
      start: () => r.v && firstDiff(r.v.out, ref) === null && startMade.length === 4 && exited,
      window: () => !wErr && w.made === 8 && w.online && w.diff === null,
    });
  }

  // --- (b) an early stop, a caller that never stops it, a worker that goes silent: real processes ----------------------------------------
  {
    const d = path.join(tmp, "proj-ahead-child");
    fs.mkdirSync(path.join(d, "files"), { recursive: true });
    for (let i = 0; i < 400; i++) fs.writeFileSync(path.join(d, "files", "f" + String(i).padStart(3, "0") + ".txt"), "file " + i + "\n" + "y".repeat(i % 300));
    const CHILD = path.join(d, "child.js");
    // (1.42 R8: files.js's AHEAD_STALL_MS — a take that waits it out stops the pool — and the child's "slow take", 0.9 of it)
    const STALL_MS = 2000, SLOW_TAKE_MS = 0.9 * STALL_MS;
    const stallPinned = /\bAHEAD_STALL_MS = 2000\b/.test(fs.readFileSync(path.join(__dirname, "lib", "engine", "files.js"), "utf8"));
    fs.writeFileSync(CHILD, L([
      "\"use strict\";",
      "const fs = require(\"fs\"), path = require(\"path\"), wt = require(\"worker_threads\");",
      "const [engine, scenario, dir] = process.argv.slice(2);",
      "const Real = wt.Worker, made = [];",
      "wt.Worker = class extends Real {",
      "  constructor(src, o) {",
      "    super(scenario === \"stall\" && made.length === 3 ? \"setTimeout(() => {}, 120000);\" : scenario === \"failing\" && made.length === 3 ? \"throw new Error('worker fails');\" : src, o);",
      // (each worker's own 'error' counted beside the engine's listener: a worker the shell's NODE_OPTIONS reached throws on its start)
      "    const rec = { exited: false, failed: false }; made.push(rec); this.on(\"exit\", () => { rec.exited = true; }); this.on(\"error\", () => { rec.failed = true; });",
      "  }",
      "};",
      "const E = require(engine);",
      "const files = fs.readdirSync(dir).sort().map((n) => path.join(dir, n));",
      "const ref = files.map((f) => E.readFileHead(f, 64));",
      "const take = scenario === \"stall\" || scenario === \"failing\" || scenario === \"refused\" ? files.length : 40;",
      "const t0 = Date.now(), h = E.readFileHeads(files, 64), got = [], slow = [];",
      // (1.42 R8: each take timed — `slow`, the ones of 0.9 × AHEAD_STALL_MS or more: a stall is a COUNT of them)
      "for (let i = 0; i < take; i++) { const n0 = Date.now(); got.push(h.next()); const dt = Date.now() - n0; if (dt >= " + SLOW_TAKE_MS + ") slow.push(dt); }",
      "const took = Date.now() - t0;",
      "if (scenario !== \"abandon\") h.stop();",
      "const same = got.every((t, i) => t === ref[i]) && got.length === take;",
      "const t1 = Date.now();",
      "const say = () => process.stdout.write(JSON.stringify({ scenario, made: made.length, exited: made.filter((m) => m.exited).length, failed: made.filter((m) => m.failed).length, same, took, slow, exitMs: Date.now() - t1 }) + \"\\n\");",
      // (abandon: says at once, and nothing of its own holds the process — the workers it left must not either)
      "const tick = () => { if (scenario === \"abandon\" || made.every((m) => m.exited) || Date.now() - t1 > 5000) return say(); setTimeout(tick, 10); };",
      "tick();",
    ]));
    const env = (mode) => Object.assign({}, process.env, { DEV_SPEC_TEST_AHEAD: mode });
    const child = (scenario, mode = "on") => runNode([CHILD, ENGINE, scenario, path.join(d, "files")], { env: env(mode), cwd: d, killMs: 40000 });
    // (a worker that fails on its own — its source throws: its 'error' must be heard, or it is thrown on the main thread and
    // ends the process — an MCP server's too — once the read is over; and a NODE_OPTIONS preload that refuses worker threads
    // never reaches one: no stall — the workers' env holds no NODE_OPTIONS, review 1 of 1.35.4)
    const pre = path.join(d, "refuse-workers.js");
    fs.writeFileSync(pre, "if (!require(\"worker_threads\").isMainThread) throw new Error(\"preload refuses worker threads\");\n");
    const refusedEnv = Object.assign(env("on"), { NODE_OPTIONS: "--require \"" + pre.split(path.sep).join("/") + "\"" });
    const [early, abandon, stall, base, failing] = await Promise.all([child("early"), child("abandon"), child("stall"), child("early", "off"), child("failing")]);
    const said = (x) => { try { return JSON.parse(x.stdout.trim().split("\n").pop()); } catch { return null; } };
    const [e1, a1, s1, b1, f1] = [early, abandon, stall, base, failing].map(said);
    // (…COUNTED: none of its workers fails on its start — each child counts its workers' errors, the failing one's 1 —; and timed
    // against its twin, the same read of all 400 files with no NODE_OPTIONS: a stall adds AHEAD_STALL_MS to the read whatever the
    // load, so "no stall" is within 1.5× the twin's time + 1 s, never an absolute figure — 1.35.4 review 2. 1.40: the two one
    // after the other, under a remeasure of their own — among the seven children at once, `refused` took 2,375 ms against
    // `plain`'s 724 in a default --jobs Windows run)
    const runSync = (args, e) => { const t0 = Date.now(); const r = spawnSync(process.execPath, args, { env: e, cwd: d, encoding: "utf8", timeout: 40000 });
      return { code: r.status, killed: !!r.error, ms: Date.now() - t0, stdout: r.stdout || "", stderr: r.stderr || "" }; };
    const twins = remeasure(() => {
      const refused = runSync([CHILD, ENGINE, "refused", path.join(d, "files")], refusedEnv), plain = runSync([CHILD, ENGINE, "refused", path.join(d, "files")], env("on"));
      return { refused, plain, r1: said(refused), p1: said(plain) };
    }, (x) => x.r1 != null && x.p1 != null && x.r1.took < 1.5 * x.p1.took + 1000);
    const { refused, plain, r1, p1 } = twins;
    // (1.42 R8: the stall COUNTED — exactly one take waited 0.9 × AHEAD_STALL_MS or more, and less than twice it: one stall, then
    // the rest in sequence. It was `took ≥ 1800 && took < 15000`, the whole read's time: worker starts and contention among the five
    // children at once — 9.1 s of 15 in a pre-push run. A pool start of 2 s or more is itself a stall by the product's rule (that
    // take times out, the pool stops: still one slow take); only a start between 1.8 and 2 s beside the planted stall makes two —
    // on a miss the stall child runs once more ALONE, with spawnSync)
    let stallFirst = true;
    const stallOk = (x, y) => x.code === 0 && !x.killed && y != null && y.same && y.made === 8 && y.exited === 8 && Array.isArray(y.slow) && y.slow.length === 1 && y.slow[0] < 2 * STALL_MS;
    const st = remeasure(() => {
      if (stallFirst) { stallFirst = false; return { x: stall, y: s1 }; }
      const x = runSync([CHILD, ENGINE, "stall", path.join(d, "files")], env("on"));
      return { x, y: said(x) };
    }, (v) => stallOk(v.x, v.y));
    const brief = (x, y) => ({ code: x.code, killed: x.killed, ms: x.ms, said: y, stderr: x.stderr.slice(0, 200) });
    all("1.35.4: a caller that takes 40 of 400 files and stops leaves no worker alive (all 8 exit) and its process exits by itself; one that never calls stop() cannot hold its process either (the workers are unref'd); a worker that gives nothing for AHEAD_STALL_MS — 2 s — leaves the rest to readFileHead: every file's text, in order, after about 2 s; a worker that FAILS on its own (its source throws) is heard — the process lives on and every file comes, in order; a NODE_OPTIONS preload that refuses worker threads reaches none (no worker's error; no stall: 1.35.4 review 2 — within 1.5× + 1 s of the same read with no NODE_OPTIONS, measured next to it, no longer an absolute 1.8 s); 1.42: the stall is ONE slow take, under twice AHEAD_STALL_MS (got " + js({ early: brief(early, e1), abandon: brief(abandon, a1), stall: brief(st.x, st.y), base: brief(base, b1), failing: brief(failing, f1), refused: brief(refused, r1), plain: brief(plain, p1), tries: twins.tries, stallTries: st.tries }) + ")", {
      failing: () => failing.code === 0 && !failing.killed && f1 != null && f1.same && f1.made === 8 && f1.failed === 1,
      refused: () => refused.code === 0 && !refused.killed && r1 != null && r1.same && r1.made === 8 && r1.failed === 0 && plain.code === 0 && p1 != null && p1.same && p1.made === 8 && r1.took < 1.5 * p1.took + 1000,
      early: () => early.code === 0 && !early.killed && e1.same && e1.made === 8 && e1.exited === 8 && e1.exitMs < 5000,
      base: () => base.code === 0 && b1.same && b1.made === 0,
      abandon: () => abandon.code === 0 && !abandon.killed && a1.same && a1.made === 8 && abandon.ms < 3 * base.ms + 5000,
      stall: () => stallPinned && stallOk(st.x, st.y),
      quiet: () => [early, abandon, st.x, base, plain].every((x) => x.stderr === ""),
    });
  }

  // --- (c) the scan: the same report and seed whether the files are read ahead or in sequence ------------------------------------------
  const kit = (() => {
    // 120 component files — what each exports beside its own name: a candidate (`motion(Base)`) its page renders, a weak one
    // (`memoize(…)`) every third page calls — and 120 pages, every other one a folder deeper (its import one `../` longer)
    const p = project("kit", { "package.json": js({ dependencies: { react: "1.0.0" } }) });
    for (let i = 0; i < 120; i++) {
      const id = String(i).padStart(3, "0"), deep = i % 2 === 1;
      write(p, UI + "c" + id + ".tsx", L(["export function C" + id + "() { return <div />; }", "export const Glow" + id + " = motion(Base);", "export const Fmt" + id + " = memoize((v) => <i />);"]));
      write(p, (deep ? "src/app/deep/" : "src/app/") + "p" + id + ".tsx", L(["import { Glow" + id + ", Fmt" + id + " } from \"" + (deep ? "../../" : "../") + "components/ui/c" + id + "\";",
        "export const P" + id + " = () => <Glow" + id + " />;", i % 3 === 0 ? "export const f" + id + " = Fmt" + id + "(1);" : ""]));
    }
    return p;
  })();
  {
    const scan = (p, mode) => {
      const spy = spyWorkers();
      try { return withMode(mode, () => ({ report: js(S.designSystemReport(p)), seed: (E.designSystemSeed(p, "en") || {}).text, made: spy.made.length })); } finally { spy.restore(); }
    };
    const r = caught(() => ({ on: scan(kit, "on"), off: scan(kit, "off"), fail: scan(kit, "fail") }));
    const v = r.v || {};
    const rows = (seed) => [...String(seed).matchAll(/^\| ([^|]+?) \| `([^`]+)` \|/gm)].map((m) => m[1] + " " + m[2]).sort();
    const WANT = [];
    for (let i = 0; i < 120; i++) {
      const id = String(i).padStart(3, "0"), at = " " + UI + "c" + id + ".tsx";
      WANT.push("C" + id + at, "Glow" + id + at);
      if (i % 3 !== 0) WANT.push("Fmt" + id + at);
    }
    WANT.sort();
    const got = v.off ? rows(v.off.seed) : [];
    const rep = v.off ? JSON.parse(v.off.report) : {};
    // (an early stop of both reads, each with more files left than the 8 workers' windows hold — else they end on their own:
    // 110 component files of 64 KB — the exports read ends at 4 MB, the 64th: 46 left —, 128 pages of 256K characters — the
    // other scripts' read ends at 32 MB — and 41 small ones after them: every worker started is stopped)
    const early = project("early", { "package.json": js({ dependencies: { react: "1.0.0" } }) });
    const pad64 = "// " + "z".repeat(64 * 1024) + "\n", pad256 = "const x = compute(1, \"value\");\n".repeat(8500);
    for (let i = 0; i < 110; i++) { const id = String(i).padStart(3, "0"); write(early, UI + "e" + id + ".tsx", (i === 0 ? "export const MotionBox = motion(Box);\n" : "") + "export function E" + id + "() { return <i />; }\n" + pad64); }
    for (let i = 0; i < 128; i++) write(early, "src/app/b" + String(i).padStart(3, "0") + ".tsx", "export const B = () => null;\n" + pad256);
    for (let i = 0; i < 41; i++) write(early, "src/app/zz/s" + String(i).padStart(3, "0") + ".tsx", "import { MotionBox } from \"../../components/ui/e000\";\nexport const S = () => <MotionBox />;\n");
    const spy = spyWorkers();
    const er = caught(() => { try { return withMode("on", () => js(S.designSystemReport(early))); } finally { spy.restore(); } });
    const exited = await until(() => spy.made.length > 0 && spy.made.every((m) => m.exited), 5000);
    const eOff = caught(() => withMode("off", () => js(S.designSystemReport(early))));
    const eRep = eOff.v ? JSON.parse(eOff.v) : {};
    all("1.35.4: the design-system scan gives the same report (missing, limits) and the same seed whether its two long reads — what the component files export, what the other scripts tell — are read ahead (on: a pool for each) or in sequence (off, fail); the seed holds what the files say, each name at its own file's path (got " + js({ made: v.on && [v.on.made, v.off.made, v.fail.made], rows: [got.length, WANT.length, firstDiff(got, WANT)], missingTotal: rep.missingTotal, limits: rep.limits, error: r.error }) + "); a report whose two reads both stop at their bound (4 MB of component files, 32 MB of the other scripts) with files left past the workers' windows stops every worker it started and says what it said without them (got " + js({ made: spy.made.length, exited, alive: spy.made.filter((m) => !m.exited).length, limits: eRep.limits, same: er.v === eOff.v, error: er.error || eOff.error }) + ")", {
      ran: ran(r),
      same: () => v.on.report === v.off.report && v.fail.report === v.off.report && v.on.seed === v.off.seed && v.fail.seed === v.off.seed,
      pools: () => v.on.made === 32 && v.off.made === 0 && v.fail.made === 0,
      rows: () => firstDiff(got, WANT) === null && rep.missingTotal === 320 && js(rep.limits) === "[]",
      early: () => er.v === eOff.v && spy.made.length === 16 && exited && js(eRep.limits.map((l) => l.code)) === js(["component-files"]),
    });
  }

  // --- (d) the CLI and the MCP server: read ahead, they exit by themselves, print what they print in sequence and nothing else ----------
  {
    // what a worker would print: NODE_OPTIONS' --require reaches a worker thread — its output must stay out of stdout (the MCP
    // server's channel) and stderr —, a `-r` on the command line must not reach one (a worker's execArgv is its own). Each run
    // its own folder of preloads: a.js marks marks-a.txt (and writes to stdout / stderr) in each worker it runs in, b.js marks-b.txt
    // in each worker it runs in — and, in the main thread, marks-w.txt once per Worker the process constructs (worker_threads'
    // own constructor, as the (b) child's): the proof the CLI and the server DID read ahead, without which "no preload reaches
    // a worker" and "exits by itself" would hold of a run that started none (1.35.4 review 2)
    const preloads = (tag) => {
      const d = path.join(tmp, "proj-ahead-preload-" + tag);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, "a.js"), L(["\"use strict\";", "const wt = require(\"worker_threads\"), fs = require(\"fs\"), path = require(\"path\");",
        "if (!wt.isMainThread) { fs.appendFileSync(path.join(__dirname, \"marks-a.txt\"), \"a\\n\"); process.stdout.write(\"LEAK-OUT\\n\"); process.stderr.write(\"LEAK-ERR\\n\"); }"]));
      fs.writeFileSync(path.join(d, "b.js"), L(["\"use strict\";", "const wt = require(\"worker_threads\"), fs = require(\"fs\"), path = require(\"path\");",
        "if (!wt.isMainThread) fs.appendFileSync(path.join(__dirname, \"marks-b.txt\"), \"b\\n\");",
        "else { const Real = wt.Worker; wt.Worker = class extends Real { constructor(src, o) { super(src, o); fs.appendFileSync(path.join(__dirname, \"marks-w.txt\"), \"w\\n\"); } }; }"]));
      const marks = (n) => { try { return fs.readFileSync(path.join(d, "marks-" + n + ".txt"), "utf8").split("\n").filter(Boolean).length; } catch { return 0; } };
      return { d, argv: ["-r", path.join(d, "b.js")], env: { NODE_OPTIONS: "--require \"" + path.join(d, "a.js").split(path.sep).join("/") + "\"" }, marks };
    };
    const env = (mode, extra) => Object.assign({}, process.env, { SPEC_PROJECT_DIR: kit, DEV_SPEC_TEST_AHEAD: mode }, extra || {});
    const cli = (mode, pre) => runNode((pre ? pre.argv : []).concat([CLI, "design-system", "--json"]), { env: env(mode, pre && pre.env), cwd: pre ? pre.d : tmp, killMs: 60000 });
    // (the server: initialize, spec_scan {designSystem} read ahead, a moment — a worker's output would reach its stdout then —,
    // tools/list; then its stdin ends and it must exit by itself)
    const server = (pre) => new Promise((resolve) => {
      const t0 = Date.now();
      const ch = spawn(process.execPath, pre.argv.concat([path.join(__dirname, "server.js")]), { env: env("on", pre.env), cwd: pre.d, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "", stderr = "", killed = false, listed = false;
      const send = (o) => ch.stdin.write(JSON.stringify(o) + "\n");
      const ids = () => stdout.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l).id; } catch { return "?"; } });
      ch.stdout.on("data", (b) => {
        stdout += b;
        if (!listed && ids().includes(2)) { listed = true; setTimeout(() => send({ jsonrpc: "2.0", id: 3, method: "tools/list" }), 500); }
        if (ids().includes(3)) ch.stdin.end();
      });
      ch.stderr.on("data", (b) => { stderr += b; });
      const timer = setTimeout(() => { killed = true; ch.kill(); }, 60000);
      ch.on("close", (code) => { clearTimeout(timer); resolve({ code, killed, stdout, stderr, ms: Date.now() - t0, ids: ids() }); });
      send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "read-ahead", version: "1" } } });
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "spec_scan", arguments: { designSystem: true } } });
    });
    const preCli = preloads("cli"), preServer = preloads("server");
    const [off, on, pre, srv] = await Promise.all([cli("off"), cli("on"), cli("on", preCli), server(preServer)]);
    const parsed = (x) => { try { return JSON.parse(x.stdout); } catch { return null; } };
    const [jOff, jOn, jPre] = [off, on, pre].map(parsed);
    const lines = srv.stdout.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } });
    const scanReply = lines.find((m) => m && m.id === 2);
    const brief = (x) => ({ code: x.code, killed: x.killed, ms: x.ms, out: x.stdout.length, head: x.stdout.slice(0, 40), err: x.stderr.slice(0, 120) });
    all("1.35.4: `dev-spec design-system --json` with its reads ahead (DEV_SPEC_TEST_AHEAD=on) exits 0 by itself, about as soon as in sequence, printing the same JSON and nothing else; the MCP server answers spec_scan {designSystem} read ahead, then the next request, and exits once its stdin ends; no preload reaches a worker — neither the shell's NODE_OPTIONS one (it would write to stdout and stderr in each worker thread: the workers' env holds no NODE_OPTIONS, review 1 of 1.35.4) nor a `-r` of the command line — and nothing reaches either one's stdout or stderr — 1.35.4 review 2: and both DID read ahead, the CLI and the server each constructing 8 workers or more (a pool for each read: 16) — counted by the command line's `-r` in the main thread —, else every check above holds of a run that started none (got " + js({ off: brief(off), on: brief(on), pre: brief(pre), marksA: preCli.marks("a"), marksB: preCli.marks("b"), workers: preCli.marks("w"), server: Object.assign(brief(srv), { ids: srv.ids, marksA: preServer.marks("a"), marksB: preServer.marks("b"), workers: preServer.marks("w") }) }) + ")", {
      exits: () => [off, on, pre].every((x) => x.code === 0 && !x.killed),
      json: () => jOff && jOn && jPre && jOff.ok === true && js(jOn) === js(jOff) && js(jPre) === js(jOff) && jOff.missingTotal === 320,
      quiet: () => [off, on, pre].every((x) => x.stderr === "" && !/LEAK/.test(x.stdout)),
      readAhead: () => preCli.marks("w") >= 8 && preServer.marks("w") >= 8,
      noPreloadInWorkers: () => preCli.marks("a") === 0,
      ownArgv: () => preCli.marks("b") === 0,
      prompt: () => on.ms < 3 * off.ms + 3000,
      server: () => srv.code === 0 && !srv.killed && js(srv.ids) === js([1, 2, 3]) && lines.every((m) => m && m.jsonrpc === "2.0") && scanReply.result && !scanReply.result.isError,
      serverQuiet: () => srv.stderr === "" && !/LEAK/.test(srv.stdout) && preServer.marks("a") === 0 && preServer.marks("b") === 0,
    });
  }

  // --- the cost: reading ahead never costs much more than reading in sequence ----------------------------------------------------------
  {
    // (the soft side reads in sequence — no pool; the hard side's every file is handed over by a worker: a wait gone slow — a
    // lost notify, a stall — is seconds over 400 files)
    const list = fileSet("cost", 400, [(i) => Buffer.from("cost " + i + "\n" + "w".repeat(i % 200))]);
    const r = caught(() => remeasure(() => { const a = readAll(list, 64, "off"); const b = readAll(list, 64, "on", { tick: 0 }); return [b.ms, a.ms, b.made.length, firstDiff(b.out, a.out)]; }, (s) => s[0] < 1.5 * s[1] + 600));
    const s = r.v || [];
    all("1.35.4: 400 files read ahead by the 8 workers take no more than 1.5 × the time read in sequence + 600 ms, the same text (got " + js({ on: s[0], off: s[1], made: s[2], diff: s[3], tries: s.tries, error: r.error }) + ")", {
      ran: ran(r),
      bound: () => s[0] < 1.5 * s[1] + 600 && s[2] === 8 && s[3] === null,
    });
  }
};
