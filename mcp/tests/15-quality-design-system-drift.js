"use strict";
// The registry's token VALUES against the code's (1.38 — spec_scan {designSystem: true}'s `drift`, `gone`): a registry row whose
// value the code holds otherwise in the SAME notation (a colour exactly there — design-values.js tokenDrift —, a quantity with one
// unit after s → ms); never a name the code declares with two values (a theme, a twin sheet, two sources: scan.multi), never across
// notations, units or references; every row compared, past the reader's 1,000 too; the `_Token sources:_` files that are gone
// (stalePath: every doubt not judged). Neither is part of `inSync` (DECISIONS: what "in sync" compares stays the names).

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const T = require(path.join(__dirname, "lib", "engine", "index.js")).loadLazyTier();
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  // a registry naming its token files, with a row per [name, value]
  const registry = (sources, rows) => "# Design System\n\n_Token sources: " + sources.join(", ") + "_\n\n| Token | Value | Use |\n|---|---|---|\n" + rows.map(([n, v]) => "| " + n + " | " + v + " | x |").join("\n") + "\n";
  let k = 0;
  const project = (files, reg) => {
    const p = path.join(tmp, "proj-drift-" + ++k);
    S.initProject(p, ["ui"], "en");
    for (const [rel, text] of Object.entries(files)) write(p, rel, text);
    if (reg != null) write(p, ".specs/steering/design-system.md", reg);
    return p;
  };
  const drifted = (r) => r.drift.map((d) => d.name + " " + d.registry + " → " + d.code + " (" + d.kind + ", " + d.source + ")");

  { // tokenDrift itself: one notation, one unit; everything else not compared
    const D = T.tokenDrift;
    const got = { notations: D("#3b82f6", "hsl(217 91% 60%)"), cross: D("#18181b", "oklch(0.205 0 0)"), alpha: D("#1d4ed8", "#1d4ed880"),
      same: D("oklch(0.556 0 0)", "oklch(0.552 0.016 285.938)"), spelling: [D("#FFF", "#ffffff"), D("0.5rem", ".5rem"), D("rgb(0 0 255)", "rgb(0, 0, 255)")],
      units: D("16px", "1rem"), ms: [D("150ms", ".2s"), D("200ms", ".2s"), D("1.1s", "1100ms"), D("1.005s", "1005ms")], refs: [D("#00f", "var(--blue)"), D("{color.blue}", "#00f"), D("$blue", "#00f")],
      parts: D("0 1px 2px #000", "0 1px 3px #000"), unitless: D("700", "600"), empty: [D("", "#fff"), D("#fff", "")] };
    all("1.38 drift: tokenDrift — #3b82f6 vs hsl(217 91% 60%) and zinc's #18181b vs oklch(0.205 0 0) not compared (two notations); oklch(0.556 0 0) vs oklch(0.552 0.016 285.938) a colour drift, and so is an alpha; #FFF = #ffffff, 0.5rem = .5rem, rgb() commas = blanks; 16px vs 1rem not compared; 150ms vs .2s a quantity drift, 200ms = .2s, 1.1s = 1100ms, 1.005s = 1005ms (never 1004.9999999999999); a reference, several parts, an empty side not compared; 700 vs 600 a drift (got " + js(got) + ")", {
      notations: () => got.notations === null && got.cross === null,
      same: () => got.same === "color" && got.alpha === "color",
      spelling: () => got.spelling.every((x) => x === null),
      units: () => got.units === null,
      ms: () => js(got.ms) === js(["quantity", null, null, null]),
      refs: () => got.refs.every((x) => x === null) && got.parts === null && got.empty.every((x) => x === null),
      unitless: () => got.unitless === "quantity",
    });
  }

  { // the project report: drift listed with both values and the code's file; a theme's name (`:root` / `.dark`), a name of two
    // token files, a twin global sheet's (review 7's `order`: the second app's main.css, registry written from it) are not compared;
    // a drifted registry otherwise in sync stays in sync
    const ROOTS = ":root {\n  --bg: #fff;\n  --g: oklch(0.552 0.016 285.938);\n  --s: 1rem;\n  --d1: .2s;\n  --b1: hsl(217 91% 60%);\n  --two: #111111;\n  --same: 4px;\n}\n.dark {\n  --bg: #000;\n}\n";
    const files = { "src/styles/tokens.css": ROOTS, "src/theme/theme.css": ":root { --two: #222222; --t9: 9px; --same: 4px; }\n" };
    const rows = [["--bg", "#000"], ["--g", "oklch(0.556 0 0)"], ["--s", "16px"], ["--d1", "150ms"], ["--b1", "#3b82f6"], ["--two", "#222222"], ["--t9", "9px"], ["--same", "8px"]];
    const p = project(files, registry(["src/styles/tokens.css", "src/theme/theme.css"], rows));
    const r = S.designSystemReport(p);
    const PROPS = (m0) => ":root {\n  --m0: " + m0 + ";\n  --m1: 1px;\n  --m2: 2px;\n  --m3: 3px;\n  --m4: 4px;\n}\n";
    const o = project({ "web/main.css": PROPS("111px"), "apps/a/main.css": PROPS("222px") }, registry(["web/main.css"], [["--m0", "222px"], ["--m1", "1px"], ["--m2", "2px"], ["--m3", "3px"], ["--m4", "4px"]]));
    const order = S.designSystemReport(o);
    const got = { drift: drifted(r), total: r.driftTotal, inSync: r.inSync, limits: r.limits, order: [order.found.sources, drifted(order), order.inSync] };
    all("1.38 drift: the project report lists `--g` (colour, same notation), `--d1` (150ms → .2s) and `--same` (two files, ONE value: 8px → 4px) with the code's file; never `--bg` (a theme: :root / .dark), `--two` (two token files, two values), `--s` (px vs rem), `--b1` (two notations); review 7's twin main.css (the registry written from the second app, 222px) is no drift; drift is never part of inSync — the report stays in sync (got " + js(got) + ")", {
      drift: () => js(got.drift) === js(["--g oklch(0.556 0 0) → oklch(0.552 0.016 285.938) (color, src/styles/tokens.css)", "--d1 150ms → .2s (quantity, src/styles/tokens.css)",
        "--same 8px → 4px (quantity, src/styles/tokens.css)"]) && r.driftTotal === 3,
      inSync: () => r.inSync === true && js(r.limits) === js([]),
      twin: () => js(order.found.sources) === js(["web/main.css"]) && js(drifted(order)) === js([]) && order.inSync === true,
    });
  }

  { // every row's value is compared — past the registry reader's 1,000 (the names past it are compared already: tokenNames);
    // 60 drifts → 50 listed, driftTotal 60
    const many = Array.from({ length: 1001 }, (_, i) => ["--t" + i, "1px"]);
    const p = project({ "src/styles/tokens.css": ":root { --t1000: 2px; }\n" }, registry(["src/styles/tokens.css"], many));
    const r = S.designSystemReport(p);
    const sixty = Array.from({ length: 60 }, (_, i) => ["--x" + i, i + 1 + "px"]);
    const q = project({ "src/styles/tokens.css": ":root {\n" + sixty.map(([n, v]) => "  " + n + ": " + (parseInt(v, 10) + 100) + "px;").join("\n") + "\n}\n" }, registry(["src/styles/tokens.css"], sixty));
    const r60 = S.designSystemReport(q);
    const got = { past: drifted(r), limits: r.limits, sixty: [r60.drift.length, r60.driftTotal, r60.drift[0] && r60.drift[0].name] };
    all("1.38 drift: a registry of 1,001 token rows — the 1,001st drifting is listed, no limit said; 60 drifts → 50 listed, driftTotal 60, in the code's order (got " + js(got) + ")", {
      past: () => js(got.past) === js(["--t1000 1px → 2px (quantity, src/styles/tokens.css)"]) && js(r.limits) === js([]),
      sixty: () => js(got.sixty) === js([50, 60, "--x0"]),
    });
  }

  { // gone: a `_Token sources:_` file that is gone — judged as a registry row's path is (stalePath: its first folder must be there,
    // a root-level file and a path out of the project are never judged); never part of inSync
    const p = project({ "src/styles/tokens.css": ":root { --a: 1px; }\n" },
      registry(["src/styles/tokens.css", "src/styles/gone.css", "tokens.json", "node_modules/x/tokens.css", "../elsewhere/tokens.css"], [["--a", "1px"]]));
    const r = S.designSystemReport(p);
    const none = project({ "src/styles/tokens.css": ":root { --a: 1px; }\n" }, registry(["src/styles/tokens.css"], [["--a", "1px"]]));
    const n = S.designSystemReport(none);
    const got = { gone: r.gone, inSync: r.inSync, limits: r.limits, none: n.gone };
    all("1.38 gone: `src/styles/gone.css` (its folder there, the file not) is listed; a root-level `tokens.json`, `node_modules/x/…` and a path out of the project are not judged; the report stays in sync; none gone → [] (got " + js(got) + ")", {
      gone: () => js(r.gone) === js(["src/styles/gone.css"]),
      inSync: () => r.inSync === true && js(r.limits) === js([]),
      none: () => js(n.gone) === js([]),
    });
  }

  { // (1.40.0 review 1, DEP-2) an entry with a blank and a note: the marker reader strips its end backticks BEFORE it cuts the
    // note — "`src/my styles/tokens.css` (generated)" comes to stalePath as "src/my styles/tokens.css`" —, so the whole entry is
    // read with 1.39's strip of its ends' backticks (a blank before the closing one too: "`src/old styles/a.css ` (kept)", the
    // reading trimmed): both gone, as 1.39.0 listed them (no word can name a path with a blank); one that is there never
    const p = project({ "src/my styles/there.css": ":root { --a: 1px; }\n", "src/old styles/b.css": "\n" },
      registry(["`src/my styles/tokens.css` (generated)", "`src/old styles/a.css ` (kept)", "`src/my styles/there.css` (kept)"], [["--a", "1px"]]));
    const r = S.designSystemReport(p);
    all("1.40.0 review 1 gone: a `_Token sources:_` entry with a blank and a note is judged whole, its ends' backticks stripped — `src/my styles/tokens.css` and `src/old styles/a.css ` gone (1.39.0's answer), `src/my styles/there.css` there (got " + js(r.gone) + ")", {
      gone: () => js(r.gone) === js(["src/my styles/tokens.css`", "src/old styles/a.css `"]),
    });
  }

  { // (1.40.0 review 2, R2-DEP-3) 1.39's two trims around that strip are not dead: an entry the marker reader stores with a
    // leading backtick and blank ("` ` w0 … w18 src/theme/old.css" → "` w0 … old.css") — stripped, then the words split from
    // the TRIMMED text: an untrimmed leading blank spends one of DS_PATH_WORDS and the path, the 20th word, goes unread —; a
    // component path cell over DS_CELL_MAX whose cut ends in "` " (a 198-character path with a blank) — the strip after a trim
    const W19 = Array.from({ length: 19 }, (_, i) => "w" + i).join(" ");
    const long = "src/a b/" + "x".repeat(198 - "src/a b/".length - 4) + ".tsx";
    const p = project({ "src/components/Card.tsx": "export function Card() { return <div />; }\n", "src/a b/keep.tsx": "export function K() { return <div />; }\n", "src/theme/keep.css": "\n" },
      "# Design System\n\n_Token sources: ` ` " + W19 + " src/theme/old.css, `src/theme/old2.css`_\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n" +
      "| Card | src/components/Card.tsx |  |  |\n| Long | `" + long + "` and more words after the cut |  |  |\n");
    const r = S.designSystemReport(p);
    all("1.40.0 review 2 gone / stale (R2-DEP-3): 1.39.0's answers — an entry stored with a leading backtick and blank, its path the 20th word, gone; a component path cell cut at DS_CELL_MAX to end in \"` \", its 198-character path gone, stale; `src/theme/old2.css` gone (got " +
      js({ gone: r.gone, stale: r.stale.map((x) => x.name), long: long.length }) + ")", {
      entry: () => js(r.gone) === js(["` " + W19 + " src/theme/old.css", "src/theme/old2.css"]),
      row: () => long.length === 198 && js(r.stale.map((x) => x.name)) === js(["Long"]),
    });
  }

  { // no registry: no drift, nothing gone, no units table — and the 1.37 keys unchanged
    const p = project({ "src/styles/tokens.css": ":root { --a: 1px; }\n" }, null);
    const r = S.designSystemReport(p);
    all("1.38 drift: without a registry — drift [], driftTotal 0, gone [], unitsTable null (got " + js({ drift: r.drift, driftTotal: r.driftTotal, gone: r.gone, unitsTable: r.unitsTable }) + ")", {
      none: () => js(r.drift) === "[]" && r.driftTotal === 0 && js(r.gone) === "[]" && r.unitsTable === null,
    });
  }
};
