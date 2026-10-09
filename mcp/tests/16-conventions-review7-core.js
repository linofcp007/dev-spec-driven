"use strict";
// Conventions — 1.25.1 review 7 (engine core): one local calendar date (today / dayOf).
// (16-conventions.js holds the area's earlier tests; this file the engine-core findings of the seventh review.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, S, tmp, libSources, require, __dirname }) => {
  const js = JSON.stringify;
  const E = require("./lib/engine/index.js");
  const tmpsIn = (d) => fs.readdirSync(d).filter((x) => /\.tmp$/i.test(x));

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
