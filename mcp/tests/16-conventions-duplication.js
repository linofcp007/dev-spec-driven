"use strict";
// Conventions — no duplicated code: a run of 8+ normalized code lines found twice in the plugin's sources (mcp/lib, the server, cli/, hooks/, scripts/) fails, naming each place.
// (16-conventions.js holds the area's main tests.)

const fs = require("fs");
const path = require("path");

// The scanner is the engine's own duplicate-code detector (1.28 — engine/dupes.js, S.duplicateRuns: the one spec_scan
// {duplicates: true} and `dev-spec dupes` run): each source becomes its CODE lines — comments, blank lines, lines of brackets /
// punctuation alone and import lines dropped, whitespace folded, string literals KEPT (two builders that differ only in their
// strings are no duplicate: that is what i18n is for). A window of N consecutive code lines is duplicated when the same N lines
// appear again — in another file, or in the same file at a place that doesn't overlap; a window of short lines (under 12
// characters a line on average) never counts; consecutive duplicated windows are one run. (1.27.1 measured with a scanner of its
// own; one detector since 1.28 — quality.md → Duplicate-code detector.)
const GUARD_WINDOW = 8; // a duplicated run this long fails the test
const MEASURE_WINDOW = 6; // the window of the reported percentage (the 1.27.1 measure's)

// The sources the guard reads: every .js under mcp/lib (the engine, i18n, the facades, probe.js, operations.js… — never a generated
// file or a user-built bundle), mcp/server.js, cli/*.js (not its tests), hooks/*.js and scripts/*.js.
function sourceFiles(root) {
  const out = [];
  const keep = (name) => name.endsWith(".js") && !/\.generated\.|^spec\.bundle\.js$/.test(name);
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (keep(e.name)) out.push(p);
    }
  };
  walk(path.join(root, "mcp", "lib"));
  out.push(path.join(root, "mcp", "server.js"));
  for (const d of ["cli", "hooks", "scripts"]) {
    for (const name of fs.readdirSync(path.join(root, d))) if (keep(name) && fs.statSync(path.join(root, d, name)).isFile()) out.push(path.join(root, d, name));
  }
  return out;
}

// The duplication kept on purpose, by its pattern and its reason — read over a run's normalized lines (`code`). (1.27.1 also allowed
// the PT / ES design templates' TypeScript sample; the detector reads that sample as the string it is — its `// …` line differs
// per language — so it is no duplicate any more, and a stale allowance goes.)
// A line of a module's link lists: `let a, b,` · `c, d,` · `function __link(E) { ({ a, b,` · `y, z } = E); }` · `y, z;`.
const RE_ID_LIST = /^(?:let |function __link\(E\) \{ \(\{ )?[A-Za-z_$][\w$]*(?:, [A-Za-z_$][\w$]*)*(?:,|;| \} = E\); \})?$/;
const places = (d) => [d.file, ...d.also.map((a) => a.file)];
const ALLOW = [
  { name: "link lists", why: "the module rule: an engine module's bare `let` list and its __link destructure name the same identifiers (architecture.md → The module rule)",
    allowed: (d) => d.code.every((l) => RE_ID_LIST.test(l)) },
];

exports.run = async ({ all, S, root }) => {
  const t0 = Date.now();
  const files = sourceFiles(root).map((f) => ({ file: path.relative(root, f).split(path.sep).join("/"), text: fs.readFileSync(f, "utf8") }));
  const guard = S.duplicateRuns(files, { minLines: GUARD_WINDOW, code: true });
  const measure = S.duplicateRuns(files, { minLines: MEASURE_WINDOW });
  // each run once (the detector lists a repeat at its longest place, the others beside it), allowed or failing
  const failing = [], allowedBy = new Map();
  for (const d of guard.duplicates) {
    const a = ALLOW.find((x) => x.allowed(d));
    if (a) allowedBy.set(a.name, (allowedBy.get(a.name) || 0) + 1);
    else failing.push(d);
  }
  const took = Date.now() - t0;
  const pct = (100 * measure.scanned.duplicated / measure.scanned.lines).toFixed(1);
  const at = (x) => x.file + ":" + x.from + "-" + x.to;
  const lines = failing.map((d) => d.lines + " lines · " + at(d) + "  " + d.also.map(at).join("  ") + (d.alsoMore ? " +" + d.alsoMore : "") + " · " + d.code[0].slice(0, 80));
  all("1.27.1 duplicated code: no run of " + GUARD_WINDOW + "+ normalized code lines appears twice in mcp/lib, mcp/server.js, cli/, hooks/ or scripts/ — the engine's detector, S.duplicateRuns (" +
    files.length + " files, " + measure.scanned.lines + " code lines; duplicated at the measure's window of " + MEASURE_WINDOW + ": " + measure.scanned.duplicated + " lines = " + pct + "%; " +
    took + " ms) — the allowed ones: " + ALLOW.map((a) => a.name + " (" + (allowedBy.get(a.name) || 0) + " runs: " + a.why + ")").join("; ") +
    (lines.length ? " — duplicated:\n      " + lines.join("\n      ") : ""), {
    scanned: () => files.length > 50 && guard.scanned.lines > 30000 && files.some((f) => f.file === "mcp/lib/engine/state.js") && files.some((f) => f.file === "hooks/hook-utils.js"),
    "no duplicated run past the allowed ones": () => failing.length === 0,
    "each allowance still matches a run (a stale one goes)": () => ALLOW.every((a) => allowedBy.get(a.name) > 0),
    "the detector finds a planted copy": () => {
      const src = files.find((f) => f.file === "mcp/lib/engine/state.js").text.split("\n");
      const from = src.findIndex((l) => l.startsWith("function existingFeature("));
      const planted = [...files, { file: "planted.js", text: "// a copy\n" + src.slice(from, from + 40).join("\n") + "\n" }];
      return from >= 0 && S.duplicateRuns(planted, { minLines: GUARD_WINDOW, code: true }).duplicates.some((d) => places(d).includes("planted.js") && !ALLOW.some((a) => a.allowed(d)));
    },
    fast: () => took < 5000,
  });
};
