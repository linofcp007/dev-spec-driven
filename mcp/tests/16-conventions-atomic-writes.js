"use strict";
// Conventions — writeFileAtomic is durable and never torn in place (fsync before the rename, a refused rename keeps the old content), one local calendar date (today / dayOf).
// (16-conventions.js holds the area's main tests.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, remeasure, S, tmp, libSources, require, __dirname }) => {
  const js = JSON.stringify;
  const E = require("./lib/engine/index.js");
  const tmpsIn = (d) => fs.readdirSync(d).filter((x) => /\.tmp$/i.test(x));

  // Finding 9 — writeFileAtomic wrote the temp file without an fsync (a crash right after the rename could leave the new name empty)
  // and, when the rename kept failing (~60 ms of Windows retries), fell back to a plain in-place write that truncated the file first
  // (a crash, a full disk or a concurrent reader met it empty or half written) and followed a link. Now: the temp file is fsynced
  // before the rename, a refused rename is retried with backoff (Windows) and then REFUSED — the error thrown, the temp file
  // removed, the previous content untouched; a read-only target is refused at once.
  {
    const p = path.join(tmp, "proj-r7c-atomic");
    S.initProject(p, ["core"], "en");
    const dir = path.join(p, ".specs");
    const file = path.join(dir, "r7-atomic.json");
    fs.writeFileSync(file, "OLD CONTENT\n");
    const real = { rename: fs.renameSync, fsync: fs.fsyncSync, open: fs.openSync, write: fs.writeFileSync };
    const log = [];
    let fails = [];
    fs.openSync = function (pth, fl) { const fd = real.open.apply(this, arguments); if (String(pth).endsWith(".tmp")) log.push(["open", fl, fd]); return fd; };
    fs.fsyncSync = function (fd) { log.push(["fsync", fd]); return real.fsync.apply(this, arguments); };
    fs.renameSync = function (a, b) {
      log.push(["rename", path.basename(String(a)).replace(/\.\d+\.\d+\.tmp$/, ".<tmp>"), path.basename(String(b))]);
      const code = fails.shift();
      if (code) { const e = new Error(code + ": refused (test)"); e.code = code; throw e; }
      return real.rename.apply(this, arguments);
    };
    fs.writeFileSync = function (pth) { if (path.resolve(String(pth)) === path.resolve(file)) log.push(["in-place", path.basename(String(pth))]); return real.write.apply(this, arguments); };
    let ok1, buf, refused = null, afterRefused, retried = null, t0, t1;
    try {
      E.writeFileAtomic(file, "NEW ✓\n");
      ok1 = fs.readFileSync(file, "utf8");
      const order = log.map((x) => x[0]);
      const tmpFd = (log.find((x) => x[0] === "open") || [])[2];
      buf = { order, wx: (log.find((x) => x[0] === "open") || [])[1], syncedTmp: log.some((x) => x[0] === "fsync" && x[1] === tmpFd) };
      E.writeFileAtomic(file, Buffer.from([0x41, 0x0d, 0x0a, 0xc3, 0xa9]));
      buf.bytes = js([...fs.readFileSync(file)]);
      // a rename refused for good: thrown, the old content intact, nothing written in place, no temp file left
      fs.writeFileSync(file, "OLD CONTENT\n");
      log.length = 0;
      fails = ["EIO"];
      try { E.writeFileAtomic(file, "NEVER\n"); } catch (e) { refused = e.code; }
      afterRefused = { content: fs.readFileSync(file, "utf8"), inPlace: log.some((x) => x[0] === "in-place"), tmps: tmpsIn(dir) };
      // a lock that clears: Windows retries EBUSY (with backoff) and the write lands; elsewhere it is refused at once
      log.length = 0;
      fails = ["EBUSY", "EBUSY"];
      t0 = Date.now();
      try { E.writeFileAtomic(file, "AFTER LOCK\n"); retried = "written"; } catch (e) { retried = e.code; }
      t1 = Date.now() - t0;
      retried = { result: retried, renames: log.filter((x) => x[0] === "rename").length, content: fs.readFileSync(file, "utf8"), tmps: tmpsIn(dir) };
    } finally {
      fs.renameSync = real.rename; fs.fsyncSync = real.fsync; fs.openSync = real.open; fs.writeFileSync = real.write; fails = [];
    }
    const win = process.platform === "win32";
    ok(ok1 === "NEW ✓\n" && buf.wx === "wx" && buf.syncedTmp && buf.order.indexOf("fsync") > -1 && buf.order.indexOf("fsync") < buf.order.indexOf("rename") &&
      buf.bytes === "[65,13,10,195,169]" && refused === "EIO" && afterRefused.content === "OLD CONTENT\n" && !afterRefused.inPlace && js(afterRefused.tmps) === "[]" &&
      (win ? retried.result === "written" && retried.renames === 3 && retried.content === "AFTER LOCK\n"
        : retried.result === "EBUSY" && retried.renames === 1 && retried.content === "OLD CONTENT\n") && js(retried.tmps) === "[]",
      "1.25.1 review 7: writeFileAtomic creates its temp file exclusively, fsyncs it BEFORE the rename, writes bytes exactly; a refused rename is thrown with the old content intact (no in-place write, no temp left); Windows retries a passing lock (EBUSY) with backoff (got " +
      js([ok1, buf, refused, afterRefused, retried, t1]) + ")");

    // a read-only target on Windows: no wait fixes it — refused at once (the old fallback's plain write failed there too). "At once"
    // is counted, not timed (1.26 — `took < 1000` missed at 1,333 ms on a loaded machine): ONE rename attempt, no retry; the wall time
    // stays a backstop under the ~1.6 s the retries cost, measured once more on a miss.
    if (win) {
      const ro = path.join(dir, "r7-readonly.json");
      fs.writeFileSync(ro, "KEEP\n");
      fs.chmodSync(ro, 0o444);
      const realRename = fs.renameSync;
      const attempt = () => {
        let code = null, renames = 0;
        fs.renameSync = function () { renames++; return realRename.apply(this, arguments); };
        const s0 = Date.now();
        try { E.writeFileAtomic(ro, "NO\n"); } catch (e) { code = e.code; } finally { fs.renameSync = realRename; }
        return { code, renames, took: Date.now() - s0 };
      };
      const r = remeasure(attempt, (x) => x.took < 1000);
      fs.chmodSync(ro, 0o644);
      ok(r.code && r.renames === 1 && fs.readFileSync(ro, "utf8") === "KEEP\n" && r.took < 1000 && js(tmpsIn(dir)) === "[]",
        "1.25.1 review 7: a read-only target is refused at once — one rename attempt, no retry (no ~1.6 s of retries) — its content kept, no temp file left (got " + js([r.code, r.renames, r.took, r.tries, tmpsIn(dir)]) + ")");
    } else ok(true, "1.25.1 review 7: read-only target — skipped (Windows only: a POSIX rename replaces a read-only file in a writable folder)");
  }

  // Finding 10 — every calendar date was the UTC one (toISOString().slice(0, 10) in eleven places; todayIso, day): written between
  // 00:00 and 01:00 in Lisbon summer time, it was the day before. One helper, today(now) / dayOf(instant): the LOCAL date; stored
  // instants unchanged; a waiver's `expires` stays UTC (its schema and message say so).
  {
    const local = S.today(new Date(2026, 9, 9, 0, 30)); // a LOCAL 00:30: the 9th in every time zone
    const unit = [local, S.today("2026-10-09"), S.today("not a date"), S.dayOf(null), S.dayOf(""), S.today(Date.UTC(2026, 9, 8, 23, 30), true), typeof S.today()];
    // a child in Tokyo (UTC+9) at 2026-10-08T20:00Z — 05:00 on the 9th there — with a frozen clock
    const script = path.join(tmp, "r7-tz-child.js");
    fs.writeFileSync(script, [
      "const FIX = Date.parse('2026-10-08T20:00:00Z'); const RealDate = Date;",
      "global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(FIX); } static now() { return FIX; } };",
      "const S = require(process.argv[2]); const E = require(process.argv[3]);",
      "const M = S.msg('en');",
      "console.log(JSON.stringify({ today: S.today(), stored: S.dayOf('2026-10-08T20:00:00.000Z'), spike: (E.spikeCreateInput({ timebox: '3d' }, M) || {}).until,",
      "  waiver: (E.waiverInput({ force: true, expires: '3d' }, 'en').waiver || {}).expires, forecast: E.fcIso(E.fcDay(Date.now())) }));",
    ].join("\n"));
    const env = { ...process.env, TZ: "Asia/Tokyo" };
    delete env.DEV_SPEC_BUNDLE;
    const r = spawnSync(process.execPath, [script, path.join(__dirname, "lib", "spec.js"), path.join(__dirname, "lib", "engine", "index.js")], { env, encoding: "utf8", timeout: 30000 });
    let got = null;
    try { got = JSON.parse(String(r.stdout).trim().split("\n").pop()); } catch { /* reported below */ }
    ok(js(unit) === js(["2026-10-09", "2026-10-09", "", "", "", "2026-10-08", "string"]) && got && got.today === "2026-10-09" && got.stored === "2026-10-09" &&
      got.spike === "2026-10-12" && got.waiver === "2026-10-11" && got.forecast === "2026-10-09",
      "1.25.1 review 7: today() / dayOf() give the LOCAL calendar date (a YYYY-MM-DD kept as it is, no date → \"\"); in Tokyo at 2026-10-08T20:00Z today, a stored instant, a spike's 3d timebox and the forecasts' today are the 9th / 12th, while a waiver's 3d stays UTC (the 11th) (got " +
      js([unit, got, r.status, String(r.stderr || "").slice(0, 300)]) + ")");
  }
  {
    // the source guard: no UTC calendar date left in the engine (validIsoDay's round trip is a format check, not a date)
    const hits = [];
    for (const f of libSources()) {
      String(fs.readFileSync(f, "utf8")).split("\n").forEach((l, i) => {
        if (/toISOString\(\)\.(?:slice|substring|substr)\(0, ?10\)/.test(l) && !/^\s*\/\//.test(l) && !/validIsoDay/.test(l)) hits.push(path.basename(f) + ":" + (i + 1));
      });
    }
    ok(hits.length === 0, "1.25.1 review 7: no engine source computes a calendar date as toISOString().slice(0, 10) — today() / dayOf() (core.js) do (got " + js(hits) + ")");
  }
};
