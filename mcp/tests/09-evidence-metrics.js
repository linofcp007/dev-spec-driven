"use strict";
// Metrics that regress silently (1.41, engine/metric.js) — the METRIC line's reader against the metric-lines/1 contract case by case (+ DECISIONS 3b and the bounds), the judge, a CLI run's readings on the latest run only, spec_finish's (check, name) comparison with the latest other finish (the record, the warning, the summary, the fs-call count), the m / l Silent Regressions warn, spec_metrics' one walk.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, eq, rpc, payload, S, tmp, remeasure, fsCalls, approveBefore, __dirname, require }) => {
  const js = JSON.stringify;
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const i18n = require(path.join(__dirname, "lib", "i18n.js"));
  const MT = (lng) => i18n.msg(lng || "en").metric;
  const FX = JSON.parse(fs.readFileSync(path.join(__dirname, "tests", "fixtures", "metric-lines.v1.json"), "utf8"));
  const reading = (r) => ({ value: r.value, unit: r.unit, better: r.better, tolerance: r.tolerance });
  const one = (t) => E.metricLinesOf(t).metrics[0];
  const ESC = String.fromCharCode(27);

  // --- the reader and the judge: the contract, case by case ---
  {
    const bad = [];
    for (const c of FX.lines) {
      const r = E.metricLinesOf(c.text);
      const got = r.metrics.length ? { kind: "metric", name: r.metrics[0].name, ...reading(r.metrics[0]) } : { kind: r.malformed ? "malformed" : "ignored" };
      const exp = c.expect.kind === "metric" ? { kind: "metric", name: c.expect.name, ...reading(c.expect) } : { kind: c.expect.kind };
      if (js(got) !== js(exp) || r.metrics.length + r.malformed > 1) bad.push(c.id + " → " + js(got));
    }
    for (const c of FX.outputs) {
      const r = E.metricLinesOf(c.text);
      const metrics = {};
      for (const m of r.metrics) metrics[m.name] = reading(m);
      if (js({ metrics, repeats: r.repeats, malformed: r.malformed, dropped: r.dropped }) !== js(c.expect)) bad.push(c.id + " → " + js({ metrics, repeats: r.repeats, malformed: r.malformed, dropped: r.dropped }));
    }
    for (const c of FX.judge) {
      const got = E.judgeMetric(c.reference == null ? null : one(c.reference), one(c.current));
      if (js(got) !== js(c.expect)) bad.push(c.id + " → " + js(got));
    }
    all("1.41 metric-lines/1: the reader reads every one of the contract's " + FX.lines.length + " lines and " + FX.outputs.length + " outputs as it says, and the judge gives each of its " +
      FX.judge.length + " cases its verdict, why, loosened, delta and applied — exactly (bad: " + js(bad) + ")", {
      cases: bad.length === 0,
      // ONE owner of the line's form and bounds: the fixture's (17-docs pins references/verification.md's line to METRIC_GRAMMAR)
      grammar: E.METRIC_GRAMMAR === FX.grammar.line,
      bounds: js(E.METRIC_BOUNDS) === js(FX.bounds),
    });
  }

  // --- DECISIONS 3b, the points the contract leaves to each reader ---
  {
    const proto = E.metricLinesOf("METRIC __proto__=1\nMETRIC constructor=2\nMETRIC prototype=3\n");
    const later = E.metricLinesOf("METRIC a=1 ms\nMETRIC a=1,5\n");
    const csi = E.metricLinesOf(ESC + "[32mMETRIC a=1 " + ESC + "[1mms" + ESC + "[0m\n" + ESC + "[1mMETRIC" + ESC + "[0m b=2 better=lower\n");
    const oneByte = (n) => E.metricLinesOf("METRIC a=1 k=" + "x".repeat(n - "METRIC a=1 k=".length) + "\n");
    const multi = (k) => Buffer.byteLength("METRIC a=1 k=" + "é".repeat(k), "utf8"); // 260 two-byte letters: 273 characters, 533 bytes
    all("1.41 DECISIONS 3b: symmetric (a small improvement inside the tolerance is within) · the reference's terms (a current line adding better= / tolerance= is unjudged) · runs of blanks, a trailing blank, the keys in any order · __proto__ / constructor / prototype are ordinary names · a candidate over 512 BYTES is dropped and said, never malformed · a later malformed line keeps the last valid reading · repeats = Σ (occurrences − 1) · CSI sequences removed · a unit of ≤ 16 characters, any class (got " +
      js({ proto: proto.metrics.map((m) => m.name), later, csi: csi.metrics }) + ")", {
      symmetric: E.judgeMetric(one("METRIC a=100 better=lower tolerance=5%"), one("METRIC a=97 better=lower tolerance=5%")).verdict === "within" &&
        E.judgeMetric(one("METRIC a=100 better=lower tolerance=5%"), one("METRIC a=94 better=lower tolerance=5%")).verdict === "improved",
      refTerms: js(E.judgeMetric(one("METRIC a=100"), one("METRIC a=150 better=lower tolerance=1%"))) === js({ verdict: "unjudged", why: ["better", "tolerance"], loosened: null, delta: 50, applied: null }) &&
        E.judgeMetric(one("METRIC a=100 better=lower"), one("METRIC a=150 better=lower tolerance=1%")).verdict === "unjudged",
      blanks: js(reading(one("METRIC  a=1 \t ms  better=lower \t\n"))) === js({ value: 1, unit: "ms", better: "lower", tolerance: null }),
      anyOrder: js(reading(one("METRIC a=1 ms tolerance=2% better=lower"))) === js(reading(one("METRIC a=1 ms better=lower tolerance=2%"))),
      proto: js(proto.metrics.map((m) => [m.name, m.value])) === js([["__proto__", 1], ["constructor", 2], ["prototype", 3]]) && Object.getPrototypeOf(proto.metrics[0]) === Object.prototype,
      bytes512: oneByte(512).metrics.length === 1 && js(oneByte(513).dropped) === js(["candidateBytes"]) && oneByte(513).malformed === 0,
      bytesNotChars: multi(260) > 512 && 13 + 260 <= 512 && js(E.metricLinesOf("METRIC a=1 k=" + "é".repeat(260) + "\n").dropped) === js(["candidateBytes"]),
      laterMalformed: later.malformed === 1 && later.metrics.length === 1 && later.metrics[0].unit === "ms" && later.repeats === 0 && later.lastMalformed === "METRIC a=1,5",
      repeats: E.metricLinesOf("METRIC a=1\nMETRIC b=1\nMETRIC a=2\nMETRIC a=3\nMETRIC b=2\n").repeats === 3,
      csi: js(csi.metrics.map((m) => [m.name, m.unit, m.better])) === js([["a", "ms", null], ["b", null, "lower"]]),
      unitClass: one("METRIC a=1 µs").unit === "µs" && one("METRIC a=1 1/s").unit === "1/s" && E.metricLinesOf("METRIC a=1 abcdefghijklmnopq").malformed === 1,
    });
  }

  // --- the bounds: each drops input and says so; the walk from the END keeps what was printed last ---
  {
    const cands = Array.from({ length: 1001 }, (_, k) => "METRIC c" + (k % 15) + "=" + k).join("\n") + "\n";
    const rc = E.metricLinesOf(cands);
    const names = Array.from({ length: 25 }, (_, k) => "METRIC n" + k + "=" + k).join("\n");
    const rn = E.metricLinesOf(names);
    const big = "METRIC early=1\n" + "x".repeat(E.METRIC_BOUNDS.readBytes) + "\nMETRIC late=2\n";
    const rb = E.metricLinesOf(big);
    const exact = E.metricLinesOf("x".repeat(E.METRIC_BOUNDS.readBytes - 14) + "\nMETRIC last=1\n"); // exactly readBytes characters: nothing dropped
    const ignoredNoCount = E.metricLinesOf(Array.from({ length: 1000 }, (_, k) => "METRIC a" + (k % 5) + "=" + k).join("\n") + "\n## METRIC z=1\nMETRICS q=1\n");
    const prefix = E.metricLinesOf(" ".repeat(600) + "METRIC a=1\n");
    const two = E.metricLinesOf(["METRIC a=1\nMETRIC b=1\n", "METRIC a=2\n"]);
    all("1.41 the reader's bounds (the fixture's constants; each suite tests the drop): ≤ 1,000 candidates walked from the END (the last value of each name, `candidates` said), ≤ 20 names (the 20 printed last, `names` said), the output's last 64 Mi characters (`readBytes` said, the end still read), a prefix past the candidate bound dropped; a line that is no candidate never counts; several outputs read as one, the later winning (got " +
      js({ rc: [rc.dropped, rc.metrics.map((m) => m.value).slice(0, 3)], rn: [rn.dropped, rn.metrics[0].name], rb: [rb.dropped, rb.metrics.map((m) => m.name)], exact: exact.dropped, ig: ignoredNoCount.dropped, two: two.metrics }) + ")", {
      candidates: js(rc.dropped) === js(["candidates"]) && rc.metrics.length === 15 && rc.metrics.every((m) => m.value >= 1001 - 15) && rc.repeats === 1000 - 15,
      names: js(rn.dropped) === js(["names"]) && rn.metrics.length === 20 && rn.metrics[0].name === "n5" && rn.metrics[19].name === "n24",
      readBytes: js(rb.dropped) === js(["readBytes"]) && js(rb.metrics.map((m) => m.name)) === js(["late"]) && js(exact.dropped) === js([]) && exact.metrics.length === 1,
      notCandidates: js(ignoredNoCount.dropped) === js([]) && ignoredNoCount.metrics.length === 5,
      prefix: js(prefix.dropped) === js(["candidateBytes"]) && !prefix.metrics.length,
      outputs: js(two.metrics.map((m) => [m.name, m.value])) === js([["b", 1], ["a", 2]]) && two.repeats === 1,
      midLine: !E.metricLinesOf("echo METRIC a=1\n  x METRIC b=2\nMETRICMETRIC c=3\n" + ESC + "METRIC d=4\n").metrics.length,
    });
  }

  // --- the reader's edges: a lone CR is no line start; the read window's first character mid-line, or after blanks the bound cut;
  // a 512-byte CRLF line; the last malformed line kept; the grammar's other refusals; several outputs filling the read bound ---
  {
    const RB = E.METRIC_BOUNDS.readBytes;
    const midLine = E.metricLinesOf("abc" + "METRIC a=1\n" + "x".repeat(RB - 11)); // the window starts at "METRIC", inside "abcMETRIC"
    const cutBlank = E.metricLinesOf("  " + "METRIC a=1\n" + "x".repeat(RB - 11)); // … after blanks the bound cut: maybe a candidate
    const crlf512 = E.metricLinesOf("METRIC a=1 k=" + "x".repeat(512 - 13) + "\r\nok\r\n");
    const twoMal = E.metricLinesOf("METRIC a=1,5\nMETRIC b=2,5\n");
    const filled = E.metricLinesOf(["METRIC early=1\n", "x".repeat(RB - 15) + "\nMETRIC late=2\n"]); // the later output fills the bound
    const partial = E.metricLinesOf(["METRIC early=1\n" + "x".repeat(40 * 1024 * 1024), "y".repeat(40 * 1024 * 1024) + "\nMETRIC late=2\n"]);
    const refused = ["METRIC a=1 better=lower ms", "METRIC a=1 better=lower better=higher", "METRIC a=1 tolerance=-2%", "METRIC a=1 tolerance=1e400%"];
    all("1.41 the reader's edges: a lone CR is no line start; a METRIC at the read window's first character is read only at a line start (mid-line: ignored; after blanks the bound cut: said, readBytes); a 512-byte line with its CRLF is read; the LAST printed malformed line is the one kept; a unit after a key, a known key twice, a negative or infinite tolerance are malformed; several outputs share the read bound (an earlier one past it, wholly or in part, said) (got " +
      js({ midLine, cutBlank, crlf512: crlf512.metrics.length, twoMal: twoMal.lastMalformed, filled, partial, refused: refused.map((t) => E.metricLinesOf(t).malformed) }) + ")", {
      loneCr: !E.metricLinesOf("x\rMETRIC a=1\n").metrics.length,
      midLine: !midLine.metrics.length && js(midLine.dropped) === js([]),
      cutBlank: !cutBlank.metrics.length && js(cutBlank.dropped) === js(["readBytes"]),
      crlf512: crlf512.metrics.length === 1 && !crlf512.dropped.length,
      lastMalformed: twoMal.malformed === 2 && twoMal.lastMalformed === "METRIC b=2,5",
      refused: refused.every((t) => E.metricLinesOf(t).malformed === 1),
      filled: js(filled.dropped) === js(["readBytes"]) && js(filled.metrics.map((m) => m.name)) === js(["late"]),
      partial: js(partial.dropped) === js(["readBytes"]) && js(partial.metrics.map((m) => m.name)) === js(["late"]),
    });
    // the judge's own choices beyond the contract: a changed unit wins `loosened` and adds `unit` to the reference's missing terms
    ok(E.judgeMetric(one("METRIC a=1 kB better=lower tolerance=1%"), one("METRIC a=1 MB better=higher tolerance=1%")).loosened === "unit" &&
      js(E.judgeMetric(one("METRIC a=1 kB tolerance=1%"), one("METRIC a=1 MB")).why) === js(["better", "unit"]),
      "1.41 the judge: a changed unit is THE loosened term (before a flipped better=), and `why` names the reference's missing terms then the unit");
  }

  // --- 1.41.0 review 1 (R1-MF-4): the five shapes the fixture is silent on, read as dev-guardian 3.17's reader reads them (mcp/src/metrics/
  // metricLine.ts — each expected value below is what that reader gives the same line, checked with the review's differential harness) ---
  {
    const sum = (t) => { const r = E.metricLinesOf(t); return { metrics: r.metrics.map((m) => [m.name, m.value, m.unit]), malformed: r.malformed, dropped: r.dropped }; };
    const none = { metrics: [], malformed: 0, dropped: [] };
    const a1 = { metrics: [["a", 1, null]], malformed: 0, dropped: [] };
    const shapes = {
      // (1) ONE '# ' — never a second run of blanks after it (`[ \t]*(?:# )?METRIC`)
      hash: [["#  METRIC a=1\n", none], ["# \tMETRIC a=1\n", none], ["\t#  METRIC a=1\n", none], ["  #   METRIC a=1\n", none], ["\t# METRIC a=1\n", a1]],
      // (2) a CSI sequence ends at a LETTER: `ESC [ 2 ~` is no colour and stays in the line
      csiLetter: [[ESC + "[2~METRIC a=1\n", none], ["METRIC " + ESC + "[2~a=1\n", { metrics: [], malformed: 1, dropped: [] }], [ESC + "[1;31mMETRIC a=1" + ESC + "[0m\n", a1]],
      // (3) the 512-byte bound is the CLEANED line's: colours before or after the reading never push it over
      csiBytes: [["METRIC a=1 k=" + "x".repeat(498) + ESC + "[0m\n", a1], [(ESC + "[0m").repeat(200) + "METRIC a=1\n", a1],
        [(ESC + "[0m").repeat(200) + "METRIC a=1 k=" + "x".repeat(520) + "\n", { metrics: [], malformed: 0, dropped: ["candidateBytes"] }]],
      // (4) a unit's 16 is counted in code points (an astral character is one)
      unitPoints: [["METRIC a=1 " + "\u{1F600}".repeat(9) + "\n", { metrics: [["a", 1, "\u{1F600}".repeat(9)]], malformed: 0, dropped: [] }],
        ["METRIC a=1 " + "\u{1F600}".repeat(16) + "\n", { metrics: [["a", 1, "\u{1F600}".repeat(16)]], malformed: 0, dropped: [] }],
        ["METRIC a=1 " + "\u{1F600}".repeat(17) + "\n", { metrics: [], malformed: 1, dropped: [] }]],
      // (5) '#' runs before the keyword are no candidate at any length (one '# ' at most) — nothing dropped; blanks past 512 still are
      hashRun: [["#".repeat(600) + " METRIC a=1\n", none], ["#".repeat(10) + " METRIC a=1\n", none],
        [" ".repeat(600) + "METRIC a=1\n", { metrics: [], malformed: 0, dropped: ["candidateBytes"] }]],
      // (6, the controller's ruling) a CR at a text's very end, no LF after it, ends the line like CR LF — one CR, never two
      finalCr: [["METRIC a=1\r", a1], ["x\nMETRIC b=2\r", { metrics: [["b", 2, null]], malformed: 0, dropped: [] }],
        ["METRIC a=1 ms\r", { metrics: [["a", 1, "ms"]], malformed: 0, dropped: [] }], ["# METRIC a=1\r", a1],
        ["METRIC a=1\r\r", { metrics: [], malformed: 1, dropped: [] }], ["METRIC a=1\r\n", a1]],
      // (7, the controller's ruling) a bare `METRIC` (nothing after it on its line — LF, CR LF, the text's end, a colour) is a candidate:
      // ignored, but counted toward the 1,000 — the 1,001st says `candidates`
      bareKeyword: [["METRIC\n".repeat(3), none],
        [Array.from({ length: 1001 }, () => "METRIC").join("\n") + "\nMETRIC z=1\n", { metrics: [["z", 1, null]], malformed: 0, dropped: ["candidates"] }],
        ["METRIC early=1\n" + "METRIC\n".repeat(1000), { metrics: [], malformed: 0, dropped: ["candidates"] }],
        ["METRIC early=1\r\n" + "METRIC\r\n".repeat(1000), { metrics: [], malformed: 0, dropped: ["candidates"] }],
        ["METRIC early=1\n" + "METRIC\n".repeat(999) + "METRIC", { metrics: [], malformed: 0, dropped: ["candidates"] }],
        ["METRIC early=1\n" + ("METRIC" + ESC + "[0m\n").repeat(1000), { metrics: [], malformed: 0, dropped: ["candidates"] }],
        ["METRIC early=1\n" + "METRIC\n".repeat(999), { metrics: [["early", 1, null]], malformed: 0, dropped: [] }],
        ["METRIC\rx\nMETRIC early=1\n", { metrics: [["early", 1, null]], malformed: 0, dropped: [] }]],
    };
    const names = { hash: "(1) one '# ' prefix", csiLetter: "(2) a CSI sequence ends at a letter", csiBytes: "(3) the 512-byte bound after CSI removal",
      unitPoints: "(4) a unit's 16 in code points", hashRun: "(5) a '#' run before the keyword", finalCr: "(6) a final CR with no LF ends the line",
      bareKeyword: "(7) a bare METRIC line is a candidate, ignored" };
    for (const [k, rows] of Object.entries(shapes)) {
      const got = rows.map(([t]) => sum(t));
      ok(rows.every(([, want], i) => js(got[i]) === js(want)), "1.41.0 review 1 R1-MF-4 parity with dev-guardian 3.17 metricLine.ts: " + names[k] + " (got " + js(got) + ")");
    }
  }

  // --- 1.41.0 review 1 (R1-MF-2, R1-MF-5): the judge's exact decimals — exponent forms (JS prints < 1e-6 and ≥ 1e21 that way) and
  // values of more than 15 significant digits (judged on the printed text) — each verdict, delta and applied as dev-guardian 3.17's judge gives it ---
  {
    const J = (r, c) => { const j = E.judgeMetric(r, c); return { verdict: j.verdict, delta: j.delta, applied: j.applied }; };
    const noText = (t) => { const r = one(t); return { name: r.name, value: r.value, unit: r.unit, better: r.better, tolerance: r.tolerance }; }; // a reading without its text
    const exp = [
      ["METRIC a=0.000001 better=lower tolerance=10%", "METRIC a=1.5e-7 better=lower tolerance=10%", { verdict: "improved", delta: -8.5e-7, applied: 1e-7 }],
      ["METRIC a=1.5e-7 better=lower tolerance=10%", "METRIC a=0.000001 better=lower tolerance=10%", { verdict: "regressed", delta: 8.5e-7, applied: 1.5e-8 }],
      ["METRIC a=1e21 better=lower tolerance=1%", "METRIC a=9.8e20 better=lower tolerance=1%", { verdict: "improved", delta: -20000000000000000000, applied: 10000000000000000000 }],
      ["METRIC a=9.8e20 better=lower tolerance=1%", "METRIC a=1e21 better=lower tolerance=1%", { verdict: "regressed", delta: 20000000000000000000, applied: 9800000000000000000 }],
    ];
    const gotExp = exp.map(([r, c]) => [J(one(r), one(c)), J(noText(r), noText(c))]);
    ok(exp.every(([, , want], i) => js(gotExp[i][0]) === js(want) && js(gotExp[i][1]) === js(want)),
      "1.41.0 review 1 R1-MF-2: exponent-form values are judged exactly — 0.000001 vs 1.5e-7 (better=lower, 10 %) improved, 1e21 vs 9.8e20 (1 %) improved, and back regressed — from the line's text and from a stored value alike, as dev-guardian 3.17's judge (got " + js(gotExp) + ")");
    const long = [
      ["METRIC a=100000000000000.000000001 better=lower tolerance=0", "METRIC a=100000000000000.000000002 better=lower tolerance=0", { verdict: "regressed", delta: 1e-9, applied: 0 }],
      ["METRIC a=1234567890.12345678 better=lower tolerance=0", "METRIC a=1234567890.12345679 better=lower tolerance=0", { verdict: "regressed", delta: 1e-8, applied: 0 }],
      ["METRIC a=123456789012345.123456789 better=lower tolerance=0.000000001", "METRIC a=123456789012345.123456790 better=lower tolerance=0.000000001", { verdict: "within", delta: 1e-9, applied: 1e-9 }],
    ];
    const gotLong = long.map(([r, c]) => J(one(r), one(c)));
    // only when BOTH have a text: a reading without one (a hand edit, another writer) is judged on the two values
    const mixed = J(noText(long[0][0]), one(long[0][1]));
    ok(long.every(([, , want], i) => js(gotLong[i]) === js(want)) && one(long[0][0]).text === "100000000000000.000000001" && js(mixed) === js({ verdict: "within", delta: 0, applied: 0 }),
      "1.41.0 review 1 R1-MF-5: a value of more than 15 significant digits is judged on the decimal the line printed (its `text`) — 100000000000000.000000001 → …002 at tolerance 0 regressed, as dev-guardian 3.17's judge; with one side's text missing, on the values (got " + js({ gotLong, mixed }) + ")");
  }

  // --- cost (the same work on both sides): the walk is linear on hostile input UNDER the cap, and a 64 MiB output costs one scan ---
  {
    const hostile = (n) => {
      const unit = "METRIC" + "METRIC ".repeat(3) + " ".repeat(30) + "#".repeat(20) + "1".repeat(30) + "mMETRIC " + ESC + "[1m" + ESC + "[0" + "x=" + "9".repeat(40) + "\n";
      let s = "";
      while (s.length < n) s += unit;
      return s.slice(0, n);
    };
    const time = (s, reps) => { const t0 = process.hrtime.bigint(); let k = 0; for (let i = 0; i < reps; i++) k += E.metricLinesOf(s).repeats + 1; return { ms: Number(process.hrtime.bigint() - t0) / 1e6 / reps, k }; };
    const small = hostile(64 * 1024), large = hostile(256 * 1024); // (no line of it is a candidate: under the cap at any size)
    time(small, 20); time(large, 5); // warmed: neither side pays the compile
    const sm = remeasure(() => { const a = time(small, 80), b = time(large, 20); return { a: a.ms, b: b.ms, ratio: b.ms / a.ms }; }, (x) => x.ratio <= 6, 3);
    const underCap = E.metricLinesOf(large).dropped;
    // 64 MiB of output lines (2.2 M of them) with ONE METRIC line at the start: the reader's backward scan against a bare lastIndexOf
    // of the same FLAT text (flattened first — the first scan of a concatenation pays for the copy) — a split of it costs 6–9×
    const noise = "ok 1 - a noise line of output\n";
    const huge = "METRIC first=1\n" + noise.repeat(Math.floor((64 * 1024 * 1024 - 16) / noise.length));
    huge.lastIndexOf("zzzz");
    const big = remeasure(() => {
      let t0 = process.hrtime.bigint(); const bare = huge.lastIndexOf("METRIC", huge.length) === 0 ? 1 : 0; const tb = Number(process.hrtime.bigint() - t0) / 1e6;
      t0 = process.hrtime.bigint(); const r = E.metricLinesOf(huge); const tr = Number(process.hrtime.bigint() - t0) / 1e6;
      return { bare: tb, reader: tr, ratio: tr / Math.max(tb, 0.5), read: r.metrics.length + bare };
    }, (x) => x.ratio <= 3, 3);
    all("1.41 the reader's cost: hostile lines (METRICMETRIC runs, blank / '#' / digit runs before a keyword, CSI fragments, a long value) grown 64 → 256 KiB UNDER the candidate cap cost ≤ 6× (linear: 4×; measured " +
      sm.ratio.toFixed(2) + "×, " + sm.a.toFixed(3) + " → " + sm.b.toFixed(3) + " ms); 64 MiB of output lines with one METRIC line costs ≤ 3× a bare lastIndexOf over the same flat text (a split: 6–9×; measured " + big.ratio.toFixed(2) + "×, " + big.bare.toFixed(1) + " / " + big.reader.toFixed(1) + " ms)", {
      linear: sm.ratio <= 6, underCap: js(underCap) === js([]), oneScan: big.ratio <= 3 && big.read === 2,
    });
  }

  // --- a project of change features with two project checks, finished through the facade as finish --run does (ranBy "cli") ---
  const CHECKS = { size: 'node -e "process.exit(0)"', test: 'node -e "process.exit(0)" --test' };
  const proj = (name, checks) => { const p = path.join(tmp, "m41-" + name); S.initProject(p, ["core"], "en", { checks: checks || CHECKS }); return p; };
  const stateOf = (p, slug, arch) => JSON.parse(fs.readFileSync(path.join(p, ".specs", ...(arch ? ["_archive"] : []), slug, ".state.json"), "utf8"));
  const writeState = (p, slug, st) => fs.writeFileSync(path.join(p, ".specs", slug, ".state.json"), JSON.stringify(st, null, 2));
  const VERIFY = 'node -e "process.exit(0)"';
  const change = (p, name, noTick) => {
    const c = S.createFeature(p, name, undefined, "x", undefined, "en", "change");
    fs.writeFileSync(path.join(c.dir, "change.md"), "# Change: " + name + "\n\n## Summary\nThe change " + name + ".\n\n## Acceptance Criteria (EARS)\n" +
      "1. **US-1.AC-1** — WHEN any page renders THE SYSTEM SHALL show the footer.\n\n## Approach\nOne string.\n\n## Tasks\n- [ ] 1. [US1] Do it\n" +
      "  - _Requirements: US-1.AC-1_\n  - _Verify: " + VERIFY + "_\n");
    S.approvePhase(p, c.slug, null, "t", { through: "tasks" });
    if (!noTick) S.completeTask(p, c.slug, 1, { command: VERIFY, exitCode: 0, summary: "ok" });
    return c.slug;
  };
  const later = () => { const until = Date.now() + 3; while (Date.now() < until) { /* a later stamp */ } };
  const evidenceOf = (outs, checks) => Object.keys(checks || CHECKS).map((name) => ({ name, command: (checks || CHECKS)[name], exitCode: 0, summary: "ok", output: outs[name] == null ? "" : outs[name] }));
  const finishWith = (p, slug, outs, opts = {}) => { later(); return S.finishFeature(p, slug, { evidence: evidenceOf(outs, opts.checks), ranBy: "cli", write: opts.write !== false }); };

  // runs: the readings on the LATEST run only (never in history); only a CLI run's passing output; a later run without leaves none
  {
    const p = proj("runs");
    const slug = change(p, "Runs");
    const tick = S.completeTask(p, slug, 1, { command: VERIFY, exitCode: 0, summary: "ok", output: ["METRIC t=1 ms\n", "METRIC t=2 ms\nMETRIC u=1,5\n"] }, { ranBy: "cli" });
    const st1 = stateOf(p, slug).evidence["1"];
    const noCli = S.completeTask(p, slug, 1, { command: VERIFY, exitCode: 0, summary: "METRIC t=9", output: "METRIC t=9\n" });
    const st2 = stateOf(p, slug).evidence["1"];
    const failed = S.completeTask(p, slug, 1, { command: VERIFY, exitCode: 1, summary: "x", output: "METRIC t=7\n" }, { ranBy: "cli" });
    const st3 = stateOf(p, slug).evidence["1"];
    const fin = finishWith(p, slug, { size: "METRIC bundle-size=120 kB\n", test: "METRIC tests.count=3\n" }, { write: false });
    const fc = stateOf(p, slug).finishChecks;
    later();
    const failRun = S.finishFeature(p, slug, { evidence: [{ name: "size", command: CHECKS.size, exitCode: 1, summary: "x", output: "METRIC bundle-size=1 kB\n" }], ranBy: "cli" });
    const fc2 = stateOf(p, slug).finishChecks;
    const facade = S.finishFeature(p, slug, { evidence: evidenceOf({ size: "METRIC bundle-size=5 kB\n", test: "METRIC tests.count=3\n" }) });
    const fc3 = stateOf(p, slug).finishChecks;
    all("1.41 a run's METRIC readings: done --run's passing commands (several outputs, the later winning) go on the LATEST run — never in its history — and into the result (metrics, metricsMalformed); a run reported without ranBy \"cli\" (MCP, a facade call) and a failed run carry none, and drop the older run's; finish --run's passing checks the same, recordedChecks counting them (got " +
      js({ tick: [tick.metrics, tick.metricsMalformed], st1: [st1.metrics, st1.history.map((h) => h.metrics)], st2: st2.metrics, st3: st3.metrics, rec: fin.recordedChecks, fc: [fc.size.metrics, fc.size.history.some((h) => h.metrics)], fc2: fc2.size.metrics, fc3: fc3.size.metrics }) + ")", {
      tick: tick.ok && js(tick.metrics) === js([{ name: "t", value: 2, text: "2", unit: "ms", better: null, tolerance: null }]) && tick.metricsMalformed === 1 && tick.metricsLastMalformed === "METRIC u=1,5",
      latestOnly: js(st1.metrics) === js([{ name: "t", value: 2, text: "2", unit: "ms" }]) && st1.history.every((h) => h.metrics === undefined),
      notCli: noCli.ok && noCli.metrics === undefined && st2.metrics === undefined,
      notFailed: failed.ok === false && failed.metrics === undefined && st3.metrics === undefined,
      finishRun: js(fin.recordedChecks) === js([{ name: "size", exitCode: 0, metrics: 1 }, { name: "test", exitCode: 0, metrics: 1 }]) &&
        js(fc.size.metrics) === js([{ name: "bundle-size", value: 120, text: "120", unit: "kB" }]) && !fc.size.history.some((h) => h.metrics),
      finishFailed: fc2.size.exitCode === 1 && fc2.size.metrics === undefined,
      finishFacade: facade.ok && fc3.size.metrics === undefined && !facade.recordedChecks.some((r) => r.metrics),
    });
  }

  // MCP never carries a reading: `output` is no key of either tool's evidence (nested keys are validated)
  {
    const p = proj("mcp");
    const slug = change(p, "Over MCP");
    const ct = await rpc("tools/call", { name: "spec_complete_task", arguments: { projectDir: p, name: slug, number: 1, evidence: { command: VERIFY, exitCode: 0, summary: "ok", output: "METRIC a=1" } } });
    const sf = await rpc("tools/call", { name: "spec_finish", arguments: { projectDir: p, name: slug, evidence: [{ name: "size", command: CHECKS.size, exitCode: 0, summary: "METRIC a=1", output: "METRIC a=1" }] } });
    const fromSummary = payload(await rpc("tools/call", { name: "spec_finish", arguments: { projectDir: p, name: slug, evidence: evidenceOf({}).map(({ output, ...e }) => ({ ...e, summary: "METRIC bundle-size=1 kB" })) } }));
    const ctErr = payload(ct), sfErr = payload(sf);
    all("1.41 over MCP a run carries no METRIC reading: spec_complete_task {evidence.output} and spec_finish {evidence[].output} are refused (unknown arguments), and a summary's METRIC line is never read (got " +
      js([ctErr.code, ctErr.invalid || ctErr.unknown, sfErr.code, fromSummary.recordedChecks, stateOf(p, slug).finishChecks.size.metrics]) + ")", {
      complete: ctErr.ok === false && /output/.test(js(ctErr)),
      finish: sfErr.ok === false && /output/.test(js(sfErr)),
      summary: fromSummary.ok && !fromSummary.recordedChecks.some((r) => r.metrics) && stateOf(p, slug).finishChecks.size.metrics === undefined,
    });
  }

  // the guardian check's output is never read (its output is dev-guardian's report)
  {
    const p = path.join(tmp, "m41-guardian");
    S.initProject(p, [], "en", { guardian: true });
    const slug = change(p, "Gated");
    const GCMD = "node .specs/guardian.cjs scan --project . --fail-on high --format json";
    const rep = js({ exit_code: 0, coverage: "full", coverage_gaps: [], new_findings: [], blocking_findings: [], baseline_absent: false, tool_version: "3.17.0", baseline_status: "present" });
    const r = S.finishFeature(p, slug, { evidence: [{ name: "guardian", command: GCMD, exitCode: 0, summary: "", report: rep, stderr: "METRIC g=1\n", output: "METRIC g=1\n" }], ranBy: "cli" });
    all("1.41 the guardian check's run is never read for METRIC lines (got " + js([r.ok, r.recordedChecks, stateOf(p, slug).finishChecks.guardian.metrics]) + ")", {
      recorded: r.ok && js(r.recordedChecks) === js([{ name: "guardian", exitCode: 0, guardian: "pass" }]),
      none: stateOf(p, slug).finishChecks.guardian.metrics === undefined && r.metrics === undefined,
    });
  }

  // --- finish: the (check, name) reference = the latest OTHER finish by finished.at; one warning, never a blocker ---
  {
    const p = proj("base");
    // mmm finishes first (X), aaa second (X, Y), zzz third (Y): X's reference is aaa (first in folder order), Y's zzz (last)
    const mmm = change(p, "Mmm"), aaa = change(p, "Aaa"), zzz = change(p, "Zzz");
    const fM = finishWith(p, mmm, { size: "METRIC x=100 kB better=lower tolerance=2%\n" });
    const fA = finishWith(p, aaa, { size: "METRIC x=110 kB better=lower tolerance=2%\nMETRIC y=50 better=higher tolerance=10%\n" });
    const fZ = finishWith(p, zzz, { size: "METRIC y=60 better=higher tolerance=10%\n" });
    const subj = change(p, "Subject");
    const fS = finishWith(p, subj, { size: "METRIC x=112.2 kB better=lower tolerance=2%\nMETRIC y=54 better=higher tolerance=10%\n", test: "METRIC tests.count=5 better=higher tolerance=0\n" }, { write: false });
    const ref = (r, name) => { const m = (r.metrics || []).find((x) => x.name === name); return m ? [m.verdict, m.reference && m.reference.feature, m.delta, m.applied] : null; };
    // a re-finish of mmm (later) records X again: its finished.at is now the latest — the reference follows it (never firstAt)
    const fM2 = finishWith(p, mmm, { size: "METRIC x=120 kB better=lower tolerance=2%\n" });
    const fS2 = finishWith(p, subj, { size: "METRIC x=112.2 kB better=lower tolerance=2%\nMETRIC y=54 better=higher tolerance=10%\n", test: "METRIC tests.count=5 better=higher tolerance=0\n" }, { write: false });
    // the subject's OWN finish is never its reference: written, then re-read — the same comparison
    const fS3 = finishWith(p, subj, { size: "METRIC x=112.2 kB better=lower tolerance=2%\nMETRIC y=54 better=higher tolerance=10%\n", test: "METRIC tests.count=5 better=higher tolerance=0\n" });
    const fS4 = S.finishFeature(p, subj, {});
    // an archived feature's finish is a reference too
    const arch = S.archiveFeature(p, zzz);
    const fS5 = S.finishFeature(p, subj, {});
    all("1.41 finish's reference for each (check, name): the latest OTHER finish that recorded it, by finished.at — whatever the folder order, a re-finish moving it, archived features included, the feature's own never (a written finish re-read compares the same); a reading no finish recorded is `new` (got " +
      js({ fS: [ref(fS, "x"), ref(fS, "y"), ref(fS, "tests.count")], fS2: ref(fS2, "x"), fS4: [ref(fS4, "x"), ref(fS4, "y")], fS5: ref(fS5, "y"), ready: [fM.readyToFinish, fA.readyToFinish, fZ.readyToFinish, fS.readyToFinish] }) + ")", {
      setup: [fM, fA, fZ, fM2].every((r) => r.readyToFinish && r.baseline && r.baseline.recorded) && arch.ok,
      firstInOrder: js(ref(fS, "x")) === js(["within", "aaa", 2.2, 2.2]),
      lastInOrder: js(ref(fS, "y")) === js(["within", "zzz", -6, 6]),
      firstMeasure: js(ref(fS, "tests.count")) === js(["new", null, null, null]),
      byFinishedAt: js(ref(fS2, "x")) === js(["improved", "mmm", -7.8, 2.4]),
      notOwn: fS3.readyToFinish && js(ref(fS4, "x")) === js(ref(fS2, "x")) && js(ref(fS4, "y")) === js(ref(fS, "y")),
      archived: js(ref(fS5, "y")) === js(["within", "zzz", -6, 6]) && fS5.metrics.find((m) => m.name === "y").reference.feature === "zzz",
      blocking: fS.readyToFinish === true && !fS.blockers.length,
    });
  }

  // (check, name): two checks printing the same name are two readings, each against its own check's reference
  {
    const p = proj("pairs", { web: 'node -e "0"', admin: 'node -e "1"' });
    const a = change(p, "First");
    finishWith(p, a, { web: "METRIC bundle-size=100 kB better=lower tolerance=1%\n", admin: "METRIC bundle-size=500 kB better=lower tolerance=1%\n" }, { checks: { web: 'node -e "0"', admin: 'node -e "1"' } });
    const b = change(p, "Second");
    const r = finishWith(p, b, { web: "METRIC bundle-size=101 kB better=lower tolerance=1%\n", admin: "METRIC bundle-size=499 kB better=lower tolerance=1%\n" }, { checks: { web: 'node -e "0"', admin: 'node -e "1"' }, write: false });
    eq((r.metrics || []).map((m) => [m.check, m.name, m.verdict, m.reference && m.reference.value]), [["web", "bundle-size", "within", 100], ["admin", "bundle-size", "within", 500]],
      "1.41 the reference is keyed by (check, name): web's bundle-size against web's, admin's against admin's");
  }

  // the warning: one, for what got worse past a stated tolerance OR loosened its terms; worded without blaming this feature; bounded
  {
    const p = proj("warn");
    const a = change(p, "Base line");
    const base = Array.from({ length: 7 }, (_, k) => "METRIC r" + k + "=100 ms better=lower tolerance=1%").join("\n") + "\nMETRIC keep=10 better=lower tolerance=5%\nMETRIC loose=10 better=lower tolerance=5%\nMETRIC terms=10\nMETRIC gain=10 better=lower tolerance=5%\n";
    finishWith(p, a, { size: base });
    const b = change(p, "Next one");
    const now = Array.from({ length: 7 }, (_, k) => "METRIC r" + k + "=110 ms better=lower tolerance=1%").join("\n") + "\nMETRIC keep=10.5 better=lower tolerance=5%\nMETRIC loose=10.1 better=lower\nMETRIC terms=50 better=lower tolerance=1%\nMETRIC gain=5 better=lower tolerance=5%\n";
    const r = finishWith(p, b, { size: now }, { write: false });
    const warn = (r.warnings || []).filter((w) => /METRIC/.test(w));
    const flagged = (r.metrics || []).filter((m) => m.verdict === "regressed" || m.loosened).map((m) => m.name);
    const c = change(p, "Quiet one");
    const quiet = finishWith(p, c, { size: "METRIC keep=10 better=lower tolerance=5%\nMETRIC gain=10 better=lower tolerance=5%\nMETRIC terms=99\n" }, { write: false });
    all("1.41 the finish warning: ONE line for the readings worse past a stated tolerance and the loosened ones (a dropped tolerance within its bound too), at most 5 named + the rest counted; it says the number holds every change merged since that finish — never a blocker; within / improved / unjudged / new give none (got " +
      js({ warn, flagged, quiet: quiet.warnings.filter((w) => /METRIC/.test(w)) }) + ")", {
      one: warn.length === 1 && js(flagged) === js(["r0", "r1", "r2", "r3", "r4", "r5", "r6", "loose"]),
      text: warn[0] === MT().finishWarn(8, ["r0", "r1", "r2", "r3", "r4"].map((n) => MT().flagged(n, "size", "100 ms", "110 ms", "base-line", E.dayOf(r.metrics[0].reference.at), "+10", "1", "regressed")).join("; "), 3),
      blame: /not only this feature's/.test(warn[0]) && !warn[0].includes("next-one"),
      ready: r.readyToFinish === true,
      quiet: quiet.readyToFinish && !quiet.warnings.some((w) => /METRIC/.test(w)) && quiet.metrics.map((m) => m.verdict).join() === "within,within,unjudged",
      loosenedWithin: (() => { const m = r.metrics.find((x) => x.name === "loose"); return m.verdict === "within" && m.loosened === "tolerance"; })(),
    });
  }

  // the record: a ready WRITTEN finish only; the project checks' passing runs only — a task's readings and a check not passing never
  {
    const p = proj("record");
    const slug = change(p, "Recorder");
    S.completeTask(p, slug, 1, { command: VERIFY, exitCode: 0, summary: "ok", output: "METRIC task_only=1\n" }, { ranBy: "cli" });
    const report = finishWith(p, slug, { size: "METRIC a=1\n", test: "METRIC b=2\n" }, { write: false });
    const noRecord = stateOf(p, slug).finished;
    const written = finishWith(p, slug, { size: "METRIC a=1\n", test: "METRIC b=2\n" });
    const rec = stateOf(p, slug).finished.metrics;
    // the check `test` changes its command: its run reads `changed` — not compared (the finish is not ready either: nothing recorded)
    S.initProject(p, ["core"], "en", { checks: { test: 'node -e "process.exit(0)" --test --again' } });
    const stale = S.finishFeature(p, slug, { write: true });
    const rec2 = stateOf(p, slug).finished.metrics;
    // a ready written finish whose checks printed no METRIC line records no key
    const quiet = change(p, "Quiet");
    const quietFin = finishWith(p, quiet, {}, { checks: { size: CHECKS.size, test: 'node -e "process.exit(0)" --test --again' } });
    // not ready (an open task): no record, the comparison still shown
    const other = change(p, "Not ready", true);
    const notReady = finishWith(p, other, { size: "METRIC a=3\n", test: "METRIC b=2\n" }, { checks: { size: CHECKS.size, test: 'node -e "process.exit(0)" --test --again' } });
    all("1.41 finished.metrics: recorded by a ready WRITTEN finish only ([{check, name, value, text, unit?, better?, tolerance?}], baseline.metrics counts it), from the project checks' passing runs — never a task's reading, never a check whose run no longer passes (`changed`), never a not-ready finish (got " +
      js({ noRecord, rec, rec2, baseline: written.baseline, stale: [stale.readyToFinish, stale.suiteChecks.map((s) => s.status)], notReady: [notReady.readyToFinish, stateOf(p, other).finished, notReady.metrics && notReady.metrics.length] }) + ")", {
      reportOnly: report.readyToFinish && noRecord === undefined,
      written: js(rec) === js([{ check: "size", name: "a", value: 1, text: "1" }, { check: "test", name: "b", value: 2, text: "2" }]) && written.baseline.metrics === 2,
      noTask: !js(rec).includes("task_only"),
      notPassing: stale.readyToFinish === false && js((stale.metrics || []).map((m) => m.check)) === js(["size"]) && js(rec2) === js(rec),
      notReady: notReady.readyToFinish === false && stateOf(p, other).finished === undefined && notReady.metrics.length === 2,
      noReadings: quietFin.readyToFinish && quietFin.baseline.recorded && !("metrics" in stateOf(p, quiet).finished) && quietFin.baseline.metrics === undefined && quietFin.metrics === undefined,
    });
  }

  // the merge summary: ## Metrics after the project checks; the unmeasured names of the design's Silent Regressions
  {
    const p = proj("summary");
    const a = change(p, "Earlier");
    finishWith(p, a, { size: "METRIC bundle-size=120 kB better=lower tolerance=2%\n" });
    const b = change(p, "Later");
    const r = S.finishFeature(p, b, { evidence: evidenceOf({ size: "METRIC bundle-size=142.3 kB better=lower tolerance=2%\nMETRIC first.one=7\n" }), ranBy: "cli", includeBody: true });
    const body = r.mergeSummary;
    const iChecks = body.indexOf("## Project checks"), iMetrics = body.indexOf("## Metrics"), iNext = body.indexOf("\n## ", iMetrics + 1);
    const lines = body.slice(iMetrics, iNext).trim().split("\n");
    all("1.41 the merge summary's ## Metrics block comes right after the project checks: one line per reading against the earlier finish (its verdict and tolerance), `new` ones as first measures (got " + js(lines) + ")", {
      order: iChecks > 0 && iMetrics > iChecks && body.indexOf("## ", iChecks + 3) === iMetrics,
      lines: js(lines) === js(["## Metrics", "- " + MT().line("bundle-size", "size", "142.3 kB", "120 kB", "earlier", E.dayOf(r.metrics[0].reference.at), "+22.3", MT().verdict.regressed + " (2.4)"),
        "- " + MT().lineNew("first.one", "size", "7")]),
      cli: js(E.metricItemLines(r.metrics, "en")) === js(lines.slice(1).map((l) => l.slice(2))),
    });
  }
  {
    // unmeasured: a code span in a row's FIRST cell of Silent Regressions, once every check passes
    const p = proj("unmeasured");
    const slug = change(p, "Measured");
    const design = "# Design\n\n## Silent Regressions\n<!--\n| Metric | Why | Printed by |\n|---|---|---|\n| `in_comment` | x | y |\n-->\n" +
      "```\n| Metric | Why | Printed by |\n|---|---|---|\n| `in_fence` | x | y |\n```\n| `Metric` | Why | Printed by |\n|---|---|---|\n| `bundle-size` | grows | size |\n| `p95_ms` and `p99_ms` | slow | perf |\n" +
      "| prose name | x | `not_first` |\nA line naming `prose_span` outside the table.\n";
    fs.writeFileSync(path.join(p, ".specs", slug, "design.md"), design);
    const missing = S.finishFeature(p, slug, {}); // no passing run yet: suite-evidence says it, nothing unmeasured
    const r = finishWith(p, slug, { size: "METRIC bundle-size=1 kB\n" }, { write: false });
    eq([missing.metricsUnmeasured, r.metricsUnmeasured, r.warnings.filter((w) => /Silent Regressions/.test(w))],
      [undefined, ["p95_ms", "p99_ms"], [MT().unmeasured("`p95_ms`, `p99_ms`", slug)]],
      "1.41 metricsUnmeasured: the code spans of the FIRST cell of Silent Regressions' data rows (never the header, a comment, a prose cell, another cell, a line outside the table) no passing check printed — only once every project check passes");
  }

  // --- the COUNT: a finish without METRIC readings walks nothing; with them it opens each OTHER folder's state once, never its own ---
  {
    const p = proj("count");
    const others = ["one", "two", "three"].map((n) => change(p, "Other " + n));
    for (const o of others) finishWith(p, o, { size: "METRIC x=" + o.length + "\n" });
    S.archiveFeature(p, others[2]);
    const subj = change(p, "Counted");
    finishWith(p, subj, { size: "METRIC x=9\n" }, { write: false });
    const st = stateOf(p, subj);
    const strip = () => { const s = JSON.parse(JSON.stringify(st)); for (const k of Object.keys(s.finishChecks)) delete s.finishChecks[k].metrics; writeState(p, subj, s); };
    const dirs = [...others.slice(0, 2).map((o) => path.join(p, ".specs", o)), path.join(p, ".specs", "_archive", others[2])];
    const own = path.join(p, ".specs", subj);
    const calls = (dir) => fsCalls(path.join(dir, ".state.json"), () => S.finishFeature(p, subj, {})).readFileSync || 0;
    const withM = { others: dirs.map(calls), own: calls(own) };
    strip();
    const without = { others: dirs.map(calls), own: calls(own) };
    const reportWith = (() => { writeState(p, subj, st); return S.finishFeature(p, subj, {}); })();
    const gate = S.approvePhase(p, subj, "execution", "t", { dryRun: true });
    const gateCalls = dirs.map((d) => fsCalls(path.join(d, ".state.json"), () => S.approvePhase(p, subj, "execution", "t", { dryRun: true })).readFileSync || 0);
    all("1.41 the reference lookup is a COUNT: with readings a finish opens each other folder's .state.json (active and archived) exactly once more than without, its own the same number of times; without readings none; the execution approval's gate (gateOnly) never looks (got " +
      js({ withM, without, gateCalls, gate: gate.ok }) + ")", {
      withReadings: withM.others.every((n, k) => n === without.others[k] + 1),
      ownSame: withM.own === without.own && withM.own > 0,
      withoutNone: without.others.every((n) => n === 0),
      gateOnly: gateCalls.every((n) => n === 0) && reportWith.metrics.length === 1,
    });
  }

  // --- spec_metrics: ONE walk, each state opened once (active and archived); the measured series; no key without readings ---
  {
    const p = proj("series");
    const names = ["s1", "s2", "s3"].map((n) => change(p, "Series " + n));
    finishWith(p, names[0], { size: "METRIC bundle-size=100 kB better=lower tolerance=2%\n" });
    finishWith(p, names[1], { size: "METRIC bundle-size=101.9 kB better=lower tolerance=2%\n" });
    finishWith(p, names[2], { size: "METRIC bundle-size=0.1 MB better=lower tolerance=2%\n" });
    finishWith(p, names[1], { size: "METRIC bundle-size=103.8 kB better=lower tolerance=2%\n" }); // a re-finish: s2's record is its latest
    S.archiveFeature(p, names[0]);
    const m = S.metrics(p);
    const dirs = [path.join(p, ".specs", names[1]), path.join(p, ".specs", names[2]), path.join(p, ".specs", "_archive", names[0])];
    const opened = dirs.map((d) => fsCalls(path.join(d, ".state.json"), () => S.metrics(p)).readFileSync || 0);
    const blank = proj("series-none");
    change(blank, "Nothing measured");
    const none = S.metrics(blank);
    const ms = (m.measured || [])[0] || {};
    const seen = [];
    E.walkFeatureStates(p, [(fd, st) => seen.push([fd.slug, fd.archived, typeof st.approvals])]);
    all("1.41 spec_metrics: the project's `measured` — one entry per (check, name) in its latest finish's unit (the other unit's finishes counted, `otherUnit`), ordered by finished.at, first → last and the change; ONE walk opens each .state.json once (an archived one too); a project without readings has no key; the walk hands every folder, active then archived, its state (got " +
      js({ measured: m.measured, opened, none: Object.keys(none), seen }) + ")", {
      entry: ms.check === "size" && ms.name === "bundle-size" && ms.unit === "kB" && ms.finishes === 2 && ms.otherUnit === 1 && ms.first.feature === names[0] && ms.first.value === 100 &&
        ms.last.feature === names[1] && ms.last.value === 103.8 && ms.change === 3.8 && ms.changePct === 3.8 && js(ms.series.map((x) => x.value)) === js([100, 103.8]),
      onceEach: opened.every((n) => n === 1),
      noKey: none.ok && !("measured" in none),
      walk: js(seen) === js([[names[1], false, "object"], [names[2], false, "object"], [names[0], true, "object"]]),
      lines: E.metricsLines(m).slice(-2).join("\n") === MT().measuredHead + "\n    " + MT().measuredLine("bundle-size", "size", "100", "103.8 kB", 2, "+3.8 %"),
    });
    // every feature archived (no active one): the CLI lines still carry `measured`, as the JSON does
    S.archiveFeature(p, names[1]);
    S.archiveFeature(p, names[2]);
    const gone = S.metrics(p);
    const goneLines = E.metricsLines(gone);
    all("1.41 spec_metrics: with every feature archived, the CLI's lines still print `measured` after `no features` (got " + js(goneLines) + ")", {
      noActive: gone.features.length === 0 && (gone.measured || []).length === 1,
      tail: goneLines.slice(-2).join("\n") === MT().measuredHead + "\n    " + MT().measuredLine("bundle-size", "size", "100", "103.8 kB", 2, "+3.8 %"),
    });
  }

  // a hand-edited (or another version's) finished.metrics: what the grammar could not have printed is skipped, term by term or whole
  {
    const p = proj("handedit");
    const a = change(p, "Edited");
    finishWith(p, a, { size: "METRIC x=1\n" });
    const sp = path.join(p, ".specs", a, ".state.json");
    const st = stateOf(p, a);
    st.finished.metrics = [{ check: "size", name: "x", value: 7, unit: "k B", better: "up", tolerance: { amount: -1, percent: true } },
      { check: "size", name: "bad name", value: 1 }, { check: "size", name: "s", value: "5" }, { name: "z", value: 1 }, { check: "c".repeat(41), name: "v", value: 1 },
      { check: "size", name: "w", value: 424242.125 }];
    fs.writeFileSync(sp, JSON.stringify(st, null, 2).replace("424242.125", "1e999")); // JSON.parse reads 1e999 as Infinity
    const b = change(p, "Reader");
    const r = finishWith(p, b, { size: "METRIC x=7\nMETRIC w=1\nMETRIC z=1\nMETRIC v=1\nMETRIC s=5\n" }, { write: false });
    const m = S.metrics(p);
    const x = (r.metrics || []).find((i) => i.name === "x") || {};
    all("1.41 a hand-edited finished.metrics: an entry the grammar could not have printed is skipped (a bad name, a non-number or non-finite value, no check or one past 40 characters) and a bad term read as absent (a unit with a blank, better=up, a negative tolerance) — the comparison and spec_metrics' series alike (got " +
      js({ items: (r.metrics || []).map((i) => [i.name, i.verdict, i.reference && i.reference.value]), x, measured: (m.measured || []).map((e) => e.check + ":" + e.name) }) + ")", {
      sanitized: js(x.reference) === js({ feature: a, at: stateOf(p, a).finished.at, value: 7, unit: null, better: null, tolerance: null }) && x.verdict === "unjudged" && js(x.why) === js(["better", "tolerance"]),
      skipped: ["w", "z", "v", "s"].every((n) => (r.metrics.find((i) => i.name === n) || {}).verdict === "new"),
      series: js((m.measured || []).map((e) => e.check + ":" + e.name)) === js(["size:x"]),
    });
  }
  {
    // 1.41.0 review 1 R1-MF-4: a stored reading read back counts its unit as the reader does (code points) — a recorded 9-astral unit is
    // kept, so the next finish compares (no `unit` loosened)
    const unit9 = "\u{1F600}".repeat(9);
    const p = proj("unit-points");
    finishWith(p, change(p, "Astral first"), { size: "METRIC emoji=5 " + unit9 + " better=lower tolerance=1\n" });
    const r = finishWith(p, change(p, "Astral next"), { size: "METRIC emoji=5 " + unit9 + " better=lower tolerance=1\n" }, { write: false });
    const m = (r.metrics || [])[0] || {};
    ok(m.verdict === "within" && m.loosened === null && !!m.reference && m.reference.unit === unit9,
      "1.41.0 review 1 R1-MF-4 parity with dev-guardian 3.17 metricLine.ts: (4) a recorded unit of 9 astral characters is read back whole — the next finish compares it (got " + js(m) + ")");
  }
  {
    // 1.41.0 review 1 R1-MF-5: the printed text rides the reading — the run's and finished.metrics — so the next finish judges a value of
    // more than 15 significant digits exactly; a text read back that the grammar could not print, or that is not the value's, is dropped
    // (judged on the values), and so is a judgment against a reading without one
    const safe = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } };
    const p = proj("long-digits");
    const a = change(p, "Long first");
    finishWith(p, a, { size: "METRIC d=100000000000000.000000001 better=lower tolerance=0\nMETRIC m=100000000000000.000000001 better=lower tolerance=0\n" +
      "METRIC x=100000000000000 better=lower tolerance=0\nMETRIC y=16 better=lower tolerance=0\n" });
    const st = stateOf(p, a);
    const rec = js(st.finished.metrics.filter((e) => e.name === "d")), run = js(st.finishChecks.size.metrics.filter((e) => e.name === "d"));
    for (const e of st.finished.metrics) {
      if (e.name === "m") delete e.text; // a reading recorded without its text
      if (e.name === "x") e.text = "999"; // not the value's decimal
      if (e.name === "y") e.text = "0x10"; // Number() reads it as 16, the grammar never prints it
    }
    writeState(p, a, st);
    const r = safe(() => finishWith(p, change(p, "Long next"), { size: "METRIC d=100000000000000.000000002 better=lower tolerance=0\nMETRIC m=100000000000000.000000002 better=lower tolerance=0\n" +
      "METRIC x=100000000000000 better=lower tolerance=0\nMETRIC y=16 better=lower tolerance=0\n" }, { write: false }));
    const v = (n) => { const m = ((r && r.metrics) || []).find((i) => i.name === n); return m ? [m.verdict, m.delta] : null; };
    all("1.41.0 review 1 R1-MF-5: a reading keeps the decimal its line printed (`text`) on the run and in finished.metrics; the next finish judges 100000000000000.000000001 → …002 at tolerance 0 regressed (dev-guardian 3.17's verdict); a recorded reading without a text, with one that is not its value's or one outside the grammar is judged on the values (got " +
      js({ rec, run, threw: r && r.threw, d: v("d"), m: v("m"), x: v("x"), y: v("y") }) + ")", {
      stored: rec === js([{ check: "size", name: "d", value: 100000000000000, text: "100000000000000.000000001", better: "lower", tolerance: { amount: 0, percent: false } }]) &&
        run === js([{ name: "d", value: 100000000000000, text: "100000000000000.000000001", better: "lower", tolerance: { amount: 0, percent: false } }]),
      exact: js(v("d")) === js(["regressed", 1e-9]),
      bothOnly: js(v("m")) === js(["within", 0]),
      notItsValue: js(v("x")) === js(["within", 0]),
      grammar: js(v("y")) === js(["within", 0]),
    });
  }
  {
    // 1.41.0 review 1 R1-MF-1: over MCP a run carries no reading, so a name a Silent Regressions row declares is a doubt there — never "no
    // passing run printed it": metricsUnmeasured (and its warning) only when every passing check's latest run is the CLI's (observed "cli")
    const p = proj("unmeasured-mcp");
    const slug = change(p, "Reported");
    fs.writeFileSync(path.join(p, ".specs", slug, "design.md"), "# Design\n\n## Silent Regressions\n| Metric | Why | Printed by |\n|---|---|---|\n| `bundle-size` | grows | size |\n");
    const unm = (r) => [r.metricsUnmeasured, (r.warnings || []).filter((w) => /Silent Regressions/.test(w)).length];
    const observed = () => Object.keys(CHECKS).map((n) => stateOf(p, slug).finishChecks[n].observed);
    later();
    const overMcp = payload(await rpc("tools/call", { name: "spec_finish", arguments: { projectDir: p, name: slug, evidence: evidenceOf({}).map(({ output, ...e }) => ({ ...e, summary: "METRIC bundle-size=120 kB" })) } }));
    const mcpObs = observed();
    later();
    S.finishFeature(p, slug, { evidence: [evidenceOf({ size: "METRIC other=1\n" })[0]], ranBy: "cli" }); // size through finish --run…
    later();
    const mixed = S.finishFeature(p, slug, { evidence: [{ name: "test", command: CHECKS.test, exitCode: 0, summary: "ok" }] }); // …test over MCP
    const mixedObs = observed();
    for (const c of Object.values(CHECKS)) S.observeRun(p, { command: c, exitCode: 0, event: "PostToolUse", cwd: p }); // the harness saw both runs
    later();
    const seen = S.finishFeature(p, slug, { evidence: evidenceOf({}).map(({ output, ...e }) => e) });
    const seenObs = observed();
    const viaCli = finishWith(p, slug, { size: "METRIC other=1\n" }, { write: false });
    all("1.41.0 review 1 R1-MF-1: a finish whose checks were reported over MCP (spec_finish {evidence}) claims no unmeasured name — nor one with a single check reported so, nor one the observe hook saw; every check run by finish --run still does (got " +
      js({ overMcp: [overMcp.ok, mcpObs, unm(overMcp)], mixed: [mixedObs, unm(mixed)], seen: [seenObs, unm(seen)], viaCli: unm(viaCli) }) + ")", {
      overMcp: overMcp.ok && js(mcpObs) === js([false, false]) && js(unm(overMcp)) === js([null, 0]),
      mixed: js(mixedObs) === js(["cli", false]) && js(unm(mixed)) === js([null, 0]),
      seen: js(seenObs) === js([true, true]) && js(unm(seen)) === js([null, 0]),
      viaCli: js(unm(viaCli)) === js([["bundle-size"], 1]),
    });
  }
  {
    // 1.41.0 review 1 R1-MF-7: a changed unit is not compared — its loosened form never says "judged by", and a warning holding only unit
    // changes never says "got worse past the tolerance"; one with a regressed reading too keeps the general head
    const p = proj("unit-change");
    const a = change(p, "Unit base");
    finishWith(p, a, { size: "METRIC size=120 kB better=lower tolerance=2%\nMETRIC speed=100 ms better=lower tolerance=1%\n" });
    const day = E.dayOf(stateOf(p, a).finished.at);
    const onlyUnit = finishWith(p, change(p, "Unit only"), { size: "METRIC size=0.2 MB better=lower tolerance=2%\nMETRIC speed=100 ms better=lower tolerance=1%\n" }, { write: false });
    const both = finishWith(p, change(p, "Unit and worse"), { size: "METRIC size=0.2 MB better=lower tolerance=2%\nMETRIC speed=150 ms better=lower tolerance=1%\n" }, { write: false });
    const warnOf = (r) => (r.warnings || []).filter((w) => /METRIC/.test(w));
    const unitItem = MT().flagged("size", "size", "120 kB", "0.2 MB", a, day, null, null, "unjudged") + " " + MT().loosened("unit", "kB", "MB");
    const worse = MT().flagged("speed", "size", "100 ms", "150 ms", a, day, "+50", "1", "regressed");
    const langs = ["en", "pt", "es", "pt-BR"];
    all("1.41.0 review 1 R1-MF-7: a unit change reads as not compared — no \"judged by\" in its loosened form (EN / PT / ES), a unit-only warning's own head (never \"got worse past the tolerance\"), the general head once a reading regressed too (got " +
      js({ onlyUnit: warnOf(onlyUnit), both: warnOf(both), line: E.metricItemLines(onlyUnit.metrics, "en")[0] }) + ")", {
      unitOnly: js(warnOf(onlyUnit)) === js([MT().finishWarn(1, unitItem, 0, true)]) && !/worse past the tolerance|judged by/.test(warnOf(onlyUnit)[0]),
      general: js(warnOf(both)) === js([MT().finishWarn(2, unitItem + "; " + worse, 0, false)]) && /got worse past the tolerance/.test(warnOf(both)[0]),
      line: !/judged by/.test(E.metricItemLines(onlyUnit.metrics, "en")[0]),
      langs: langs.every((l) => MT(l).finishWarn(1, "L", 0, true) !== MT(l).finishWarn(1, "L", 0, false) &&
        !MT(l).loosened("unit", "a", "b").includes(MT(l).loosened("tolerance", "a", "b").split(" — ").pop())),
    });
  }
  {
    // 1.41.0 review 1 R1-MF-8: pt-BR derives the metric strings' second person and "beyond" ("para lá de" → "além de")
    const br = MT("pt-BR");
    const texts = [br.finishWarn(2, "L", 1, false), br.finishWarn(1, "L", 0, true), br.dropped("names"), br.loosened("unit", "kB", "MB"), br.verdict.regressed];
    ok(/nunca afrouxe, inverta nem retire/.test(texts[0]) && /além de um limite/.test(texts[2]) && texts.every((t) => !/afrouxes|invertas|retires|para lá d/.test(t)),
      "1.41.0 review 1 R1-MF-8: pt-BR's metric warning says \"nunca afrouxe, inverta nem retire\" and the reader bound \"além de um limite\" (got " + js(texts) + ")");
  }
  {
    // the series bound and its arithmetic, on the block alone: 12 finishes visited out of order → ordered by finished.at, the last 10
    const blk = E.measuredBlock();
    for (let k = 11; k >= 0; k--) blk.visit({ slug: "f" + k }, { finished: { at: new Date(Date.UTC(2026, 0, 1 + k)).toISOString(), metrics: [{ check: "c", name: "n", value: k }] } });
    const r = blk.result()[0];
    ok(r.finishes === 12 && r.series.length === 10 && r.series[0].feature === "f2" && r.series[9].feature === "f11" && r.first.feature === "f0" && r.last.value === 11 &&
      r.change === 11 && r.changePct === null && E.measuredBlock().result() === null,
      "1.41 measured: ordered by finished.at, the series its last 10, first → last over every finish; a change from 0 has no percentage; a block that saw nothing gives no key (got " + js(r) + ")");
  }

  // --- the m / l design: Silent Regressions, no slot; doctor's design-silent-regressions warn (m / l only, the 1.41 stamp) ---
  {
    const p = proj("design");
    const doc = (slug) => (S.specDoctor(p, slug).checks || []).find((c) => c.id === "design-silent-regressions") || null;
    const ml = ["m", "l"].map((size) => S.createFeature(p, "Sized " + size, ["core"], "x", undefined, "en", undefined, { size }));
    const others = [S.createFeature(p, "Sized s", ["core"], "x", undefined, "en", undefined, { size: "s" }), S.createFeature(p, "Unsized", ["core"], "x", undefined, "en"),
      S.createFeature(p, "A bug", ["core"], "x", undefined, "en", "bugfix", { size: "m" })];
    // the design is the current phase (doctor reads it from then on): the earlier artifacts' slots filled, their phases approved
    const fill = (file) => {
      if (!fs.existsSync(file)) return;
      let text = fs.readFileSync(file, "utf8"), n = 0;
      for (let round = 0; round < 4; round++) {
        const ph = S.placeholderReport(text);
        if (!ph.length) break;
        const lines = text.split("\n");
        for (const x of ph) {
          const i = x.line - 1;
          if (x.kind === "todo") { lines[i] = "Decided for this feature: the concrete answer written here."; continue; }
          const k = lines[i].indexOf(x.text);
          if (k >= 0) lines[i] = lines[i].slice(0, k) + "concrete item " + ++n + lines[i].slice(k + x.text.length);
        }
        text = lines.join("\n");
      }
      fs.writeFileSync(file, text);
    };
    for (const f of [...ml, ...others]) {
      for (const a of ["classification.md", "requirements.md", "bug.md"]) fill(path.join(f.dir, a));
      approveBefore(p, f.slug, "design");
    }
    const dm = ml[0];
    const designOf = (f) => fs.readFileSync(path.join(f.dir, "design.md"), "utf8");
    const scaffolded = designOf(dm), scaffolds = ml.map(designOf);
    const sec = scaffolded.slice(scaffolded.indexOf("## Silent Regressions"), scaffolded.indexOf("\n## ", scaffolded.indexOf("## Silent Regressions")));
    const fresh = doc(dm.slug);
    const write = (body) => fs.writeFileSync(path.join(dm.dir, "design.md"), scaffolded.replace(/## Silent Regressions[\s\S]*?(?=\n## )/, "## Silent Regressions\n" + body + "\n"));
    write("None — the feature changes no measured path.");
    const prose = doc(dm.slug);
    write("| Metric | Why | Printed by |\n|---|---|---|\n| `bundle-size` | a new chart library | size |");
    const rows = doc(dm.slug);
    fs.writeFileSync(path.join(dm.dir, "design.md"), scaffolded.replace(/## Silent Regressions[\s\S]*?(?=\n## )/, ""));
    const missing = doc(dm.slug);
    // a design approved before 1.41 (no `silent` stamp): a pass with the note; one approved now carries the stamp
    const st = stateOf(p, dm.slug);
    st.approvals = { ...(st.approvals || {}), design: { at: "2026-11-01T00:00:00.000Z", by: "t", weigh: true, reuse: true, reuseGate: true } };
    writeState(p, dm.slug, st);
    const legacy = doc(dm.slug);
    const up = S.specUpgrade(p, {});
    all("1.41 the m / l design gets ## Silent Regressions with NO slot (an empty table, never a placeholders refusal) and doctor warns design-silent-regressions while it is empty or missing — prose ('None — why') or a row answers it; never at size s, unsized or for a bugfix; a design approved before 1.41 passes with its note; spec_upgrade never counts it (got " +
      js({ fresh, prose, rows, missing, legacy, others: others.map((f) => doc(f.slug)), placeholders: S.placeholderReport(sec) }) + ")", {
      scaffold: scaffolds.every((t) => /\n## Silent Regressions\n<!--[\s\S]*?-->\n\| Metric \| Why it can regress silently \| Printed by \|\n\|---\|---\|---\|\n/.test(t)) && !S.placeholderReport(sec).length,
      warns: fresh && fresh.status === "warn" && fresh.detail === i18n.msg("en").designWeigh["design-silent-regressions"].empty(),
      answered: prose.status === "pass" && rows.status === "pass" && rows.detail === i18n.msg("en").designWeigh["design-silent-regressions"].filled(1),
      missing: missing.status === "warn" && missing.detail === i18n.msg("en").designWeigh["design-silent-regressions"].missing(),
      notOthers: others.every((f) => doc(f.slug) === null) && !/Silent Regressions/.test(designOf(others[0]) + designOf(others[1])),
      legacy: legacy.status === "pass" && legacy.detail === i18n.msg("en").designWeigh.legacyApproval(i18n.msg("en").designWeigh["design-silent-regressions"].missing(), "1.41"),
      upgrade: up.ok && E.DESIGN_WEIGH_IDS.has("design-silent-regressions") && !js((up.features || []).filter((f) => f.name === dm.slug).map((f) => f.attention)).includes("design-silent"),
    });

    // 1.41.0 review 1 R1-MF-3: a project design template without Silent Regressions (templates init's own copy) — an m / l feature
    // scaffolded from it gets the built-in's section at the end, as a track's design block is added to a project template: doctor reads
    // it as it reads the built-in scaffold's (empty until answered — never `missing`); size s and unsized get none; a template that has
    // the section keeps its own, never a second
    const heads = (text) => (text.match(/^## Silent Regressions\s*$/gm) || []).length;
    const pt = path.join(tmp, "m41-design-template");
    S.initProject(pt, ["core"], "en", { checks: CHECKS });
    S.templates(pt, "init", { artifact: "design" });
    const tdoc = (slug) => (S.specDoctor(pt, slug).checks || []).find((c) => c.id === "design-silent-regressions") || null;
    const tml = ["m", "l"].map((size) => S.createFeature(pt, "Tpl " + size, ["core"], "x", undefined, "en", undefined, { size }));
    const tothers = [S.createFeature(pt, "Tpl s", ["core"], "x", undefined, "en", undefined, { size: "s" }), S.createFeature(pt, "Tpl none", ["core"], "x", undefined, "en")];
    for (const f of [...tml, ...tothers]) { for (const a of ["classification.md", "requirements.md"]) fill(path.join(f.dir, a)); approveBefore(pt, f.slug, "design"); }
    const tFresh = tdoc(tml[0].slug);
    const tTexts = tml.map(designOf); // as scaffolded (the first is answered below)
    const tdm = tml[0], tText = tTexts[0];
    fs.writeFileSync(path.join(tdm.dir, "design.md"), tText.replace(/## Silent Regressions[\s\S]*$/, "## Silent Regressions\n| Metric | Why | Printed by |\n|---|---|---|\n| `bundle-size` | a chart | size |\n"));
    const tAnswered = tdoc(tdm.slug);
    const po = path.join(tmp, "m41-design-template-own");
    S.initProject(po, ["core"], "en", { checks: CHECKS });
    S.templates(po, "init", { artifact: "design" });
    const otf = path.join(po, ".specs", "templates", "design.md");
    fs.writeFileSync(otf, fs.readFileSync(otf, "utf8") + "\n## Silent Regressions\nNone — the team's own wording.\n");
    const own = S.createFeature(po, "Own m", ["core"], "x", undefined, "en", undefined, { size: "m" });
    all("1.41.0 review 1 R1-MF-3: an m / l feature scaffolded from a project design template without Silent Regressions gets the built-in's section (doctor: as on a built-in scaffold — empty, answered by a row; never missing), size s and unsized get none, a template's own section is kept alone, the built-in scaffold has one (got " +
      js({ heads: [...tTexts, ...tothers.map(designOf)].map(heads), tFresh, tAnswered, own: heads(designOf(own)), builtIn: scaffolds.map(heads) }) + ")", {
      appended: tTexts.every((t) => heads(t) === 1 && /\n## Silent Regressions\n<!--[\s\S]*?-->\n\| Metric \| Why it can regress silently \| Printed by \|\n\|---\|---\|---\|\n?$/.test(t)),
      doctor: !!tFresh && tFresh.status === fresh.status && tFresh.detail === fresh.detail && tAnswered.status === "pass",
      notOthers: tothers.every((f) => heads(designOf(f)) === 0 && tdoc(f.slug) === null),
      ownKept: heads(designOf(own)) === 1 && designOf(own).includes("None — the team's own wording."),
      builtInOnce: scaffolds.every((t) => heads(t) === 1),
    });
  }
  {
    // the approval stamps `silent` and never refuses on the section (a warn); the templates check warns on a design template
    // without it — never on templates init's own copy (it checks clean)
    const p = proj("stamp");
    const f = S.createFeature(p, "Stamped", ["core"], "x", undefined, "en", undefined, { size: "m" });
    const forced = ["classification", "requirements"].map((ph) => S.approvePhase(p, f.slug, ph, "t", { force: true }));
    const d = S.approvePhase(p, f.slug, "design", "t", { force: true });
    const stamp = stateOf(p, f.slug).approvals.design;
    const failing = d.failing || (stamp.failing || []);
    S.templates(p, "init", { artifact: "design" });
    const pristine = S.templates(p, "check");
    const tf = path.join(p, ".specs", "templates", "design.md");
    fs.writeFileSync(tf, fs.readFileSync(tf, "utf8") + "\n<!-- a team note -->\n");
    const edited = S.templates(p, "check");
    fs.writeFileSync(tf, fs.readFileSync(tf, "utf8") + "\n## Silent Regressions\nNone — nothing measured here.\n");
    const answered = S.templates(p, "check");
    const code = (r) => (r.problems || []).filter((x) => x.code === "silent-missing").length;
    all("1.41 a design approval stamps `silent` (record too) and never lists design-silent-regressions among the failing checks; templates check warns silent-missing on a project design template without the section, never on templates init's pristine copy (got " +
      js({ stamp, failing, pristine: [pristine.verdict, code(pristine)], edited: [edited.verdict, code(edited)], answered: code(answered) }) + ")", {
      stamp: forced.every((r) => r.ok) && d.ok && stamp.silent === true && stateOf(p, f.slug).approvalHistory.some((h) => h.phase === "design" && h.silent === true),
      neverFailing: !failing.includes("design-silent-regressions"),
      pristine: pristine.verdict === "pass" && code(pristine) === 0,
      edited: edited.verdict === "warn" && code(edited) === 1,
      answered: code(answered) === 0,
    });
  }
  {
    // the headings: PT / ES and their unaccented twins, never a modifier
    const st = (h) => E.designWeighChecks("# D\n\n## " + h + "\nNone — no measured path.\n", "en", { gate: "m" }).find((c) => c.id === "design-silent-regressions").state;
    eq(["Silent Regressions", "Regressões Silenciosas", "Regressoes silenciosas", "Regresiones Silenciosas", "Regresion silenciosa", "Métricas de regresión", "Silent regressions & budgets", "Silent regressionsx"].map(st),
      ["filled", "filled", "filled", "filled", "filled", "filled", "filled", "missing"], "1.41 SILENT_SYN: the EN / PT / ES headings (unaccented too) name the section; a modifier makes another");
    ok(E.designWeighChecks("# D\n", "en", {}).length === 3 && E.designWeighChecks("# D\n", "en", { gate: "m" }).length === 4 &&
      st("Decisions, reuse & risks") === "missing",
      "1.41 designWeighChecks runs design-silent-regressions only with the size gate (m / l); the size-S merged section never answers it");
  }

  // --- 1.41.0 review 2 (area MF) ---
  {
    // R2-MF-1: a Silent Regressions name its check DID print — as a line the reader could not read (malformed: `12.5kB`; past a bound: the
    // first of 21 names) — is no proof the line is missing: the warning claims no READABLE line and points at the run's note; a name truly
    // absent reads the same (the claim holds either way)
    const ck = { size: CHECKS.size };
    const p = proj("unmeasured-unread", ck);
    const slug = change(p, "Unread");
    fs.writeFileSync(path.join(p, ".specs", slug, "design.md"), "# Design\n\n## Silent Regressions\n| Metric | Why | Printed by |\n|---|---|---|\n" +
      "| `bundle-size` | grows | size |\n| `p95_ms` | slow | size |\n| `first_name` | x | size |\n");
    const mal = finishWith(p, slug, { size: "METRIC bundle-size=12.5kB better=lower tolerance=2%\n" }, { checks: ck, write: false });
    const bound = finishWith(p, slug, { size: "METRIC first_name=1\n" + Array.from({ length: 20 }, (_, k) => "METRIC n" + k + "=1").join("\n") + "\n" }, { checks: ck, write: false });
    const warnOf = (r) => (r.warnings || []).filter((w) => /Silent Regressions/.test(w));
    const doubt = {
      en: /printed no readable METRIC line of that name \(a malformed line, or one past a reader bound, is not read — the run's note names it\)/,
      pt: /não imprimiram nenhuma linha METRIC legível com esse nome \(uma linha malformada, ou uma para lá de um limite do leitor, não é lida — a nota da execução diz qual\)/,
      es: /no imprimieron ninguna línea METRIC legible con ese nombre \(una línea malformada, o una más allá de un límite del lector, no se lee — la nota de la ejecución dice cuál\)/,
      "pt-BR": /não imprimiram nenhuma linha METRIC legível com esse nome \(uma linha malformada, ou uma além de um limite do leitor, não é lida — a nota da execução diz qual\)/,
    };
    all("1.41.0 review 2 R2-MF-1: a Silent Regressions name printed as a malformed METRIC line, or past a reader bound, is said as no READABLE line (the run's note names the unread one) — never as no line at all; a name truly absent reads the same; EN / PT / ES / pt-BR (got " +
      js({ mal: [mal.metricsUnmeasured, mal.recordedChecks, warnOf(mal)], bound: [bound.metricsUnmeasured, bound.recordedChecks] }) + ")", {
      malformed: js(mal.metricsUnmeasured) === js(["bundle-size", "p95_ms", "first_name"]) && mal.recordedChecks[0].metricsMalformed === 1 &&
        js(warnOf(mal)) === js([MT().unmeasured("`bundle-size`, `p95_ms`, `first_name`", slug)]),
      pastBound: js(bound.metricsUnmeasured) === js(["bundle-size", "p95_ms", "first_name"]) && js(bound.recordedChecks[0].metricsDropped) === js(["names"]),
      words: Object.entries(doubt).every(([l, re]) => re.test(MT(l).unmeasured("`x`", "f"))),
    });
  }
};
