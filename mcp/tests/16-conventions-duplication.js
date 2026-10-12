"use strict";
// Conventions — no duplicated code: a run of 8+ normalized code lines found twice in the plugin's sources (mcp/lib, the server, cli/, hooks/, scripts/) fails, naming each place.
// (16-conventions.js holds the area's main tests.)

const fs = require("fs");
const path = require("path");

// The scanner — self-contained, zero dependencies, the measure the 1.27.1 cleanup was taken with: each source becomes its CODE lines —
// comments, blank lines and lines of closing brackets / punctuation alone dropped, whitespace folded, string literals KEPT (two
// builders that differ only in their strings are no duplicate: that is what i18n is for). A window of N consecutive code lines is
// duplicated when the same N lines appear again — in another file, or in the same file at a place that doesn't overlap. A window
// of short lines (under 12 characters a line on average) is noise and never counts. Comments are read line by line, as the
// measure does: a quote opens and closes within its line, a block comment may span lines.
const GUARD_WINDOW = 8; // a duplicated window this long fails the test
const MEASURE_WINDOW = 6; // the window of the reported percentage (the measure's)
const MIN_CHARS_PER_LINE = 12;

function codeLines(src) {
  const out = [];
  let inBlock = false;
  src.split(/\r?\n/).forEach((raw, i) => {
    let l = raw;
    if (inBlock) {
      const e = l.indexOf("*/");
      if (e < 0) return;
      l = l.slice(e + 2);
      inBlock = false;
    }
    let res = "", q = null;
    for (let k = 0; k < l.length; k++) {
      const c = l[k], n = l[k + 1];
      if (q) {
        res += c;
        if (c === "\\") { res += n || ""; k++; } else if (c === q) q = null;
        continue;
      }
      if (c === "\"" || c === "'" || c === "`") { q = c; res += c; continue; }
      if (c === "/" && n === "/") break;
      if (c === "/" && n === "*") {
        const e = l.indexOf("*/", k + 2);
        if (e < 0) { inBlock = true; break; }
        k = e + 1;
        continue;
      }
      res += c;
    }
    const norm = res.trim().replace(/\s+/g, " ");
    if (norm.length < 4 || /^[\])};,]+$/.test(norm)) return; // brackets alone carry no signal
    out.push({ n: i + 1, t: norm });
  });
  return out;
}

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

// files: [{ rel, lines }] → { groups: [{ lines (the window's text), at: [{ fi, i }] }], dupLines, totalLines }
function duplicates(files, win) {
  const windows = new Map();
  files.forEach((f, fi) => {
    for (let i = 0; i + win <= f.lines.length; i++) {
      const key = f.lines.slice(i, i + win).map((x) => x.t).join("\n");
      if (key.length < win * MIN_CHARS_PER_LINE) continue;
      const occ = windows.get(key);
      if (occ) occ.push({ fi, i });
      else windows.set(key, [{ fi, i }]);
    }
  });
  const marked = files.map((f) => new Uint8Array(f.lines.length));
  const groups = [];
  for (const [key, occ] of windows) {
    if (occ.length < 2) continue;
    const at = []; // the places that don't overlap in one file
    for (const o of occ) if (!at.some((k) => k.fi === o.fi && Math.abs(k.i - o.i) < win)) at.push(o);
    if (at.length < 2) continue;
    for (const o of at) marked[o.fi].fill(1, o.i, o.i + win);
    groups.push({ lines: key.split("\n"), at });
  }
  const totalLines = files.reduce((n, f) => n + f.lines.length, 0);
  const dupLines = marked.reduce((n, m) => n + m.reduce((s, x) => s + x, 0), 0);
  return { groups, dupLines, totalLines };
}

// The two duplications kept on purpose, each by its pattern and its reason.
// A line of a module's link lists: `let a, b,` · `c, d,` · `function __link(E) { ({ a, b,` · `y, z } = E); }` · `y, z;`.
const RE_ID_LIST = /^(?:let |function __link\(E\) \{ \(\{ )?[A-Za-z_$][\w$]*(?:, [A-Za-z_$][\w$]*)*(?:,|;| \} = E\); \})?$/;
const ALLOW = [
  { name: "link lists", why: "the module rule: an engine module's bare `let` list and its __link destructure name the same identifiers (architecture.md → The module rule)",
    allowed: (g) => g.lines.every((l) => RE_ID_LIST.test(l)) },
  { name: "template code examples", why: "a code example inside a locale's template text — the PT and ES design templates hold the same TypeScript sample, in strings",
    allowed: (g, files) => g.at.every((o) => /^mcp\/lib\/i18n\/[a-z-]+\.js$/.test(files[o.fi].rel)) && g.lines.some((l) => l.includes("\\`\\`\\`")) },
];

exports.run = async ({ ok, all, root }) => {
  const t0 = Date.now();
  const files = sourceFiles(root).map((f) => ({ rel: path.relative(root, f).split(path.sep).join("/"), lines: codeLines(fs.readFileSync(f, "utf8")) }));
  const guard = duplicates(files, GUARD_WINDOW);
  const measure = duplicates(files, MEASURE_WINDOW);
  const place = (o) => files[o.fi].rel + ":" + files[o.fi].lines[o.i].n;
  // windows sharing their places' files run into one another: one report per run of consecutive windows, its first window's places
  const failing = [], allowedBy = new Map();
  for (const g of guard.groups) {
    const a = ALLOW.find((x) => x.allowed(g, files));
    if (a) allowedBy.set(a.name, (allowedBy.get(a.name) || 0) + 1);
    else failing.push(g);
  }
  const reported = [];
  const rel = (o) => files[o.fi].rel;
  const order = (x, y) => (rel(x.at[0]) < rel(y.at[0]) ? -1 : rel(x.at[0]) > rel(y.at[0]) ? 1 : x.at[0].i - y.at[0].i);
  for (const g of failing.sort(order)) {
    const prev = reported[reported.length - 1];
    const extends_ = prev && prev.at.length === g.at.length && prev.at.every((o, k) => o.fi === g.at[k].fi && g.at[k].i > o.i && g.at[k].i <= o.i + prev.len);
    if (extends_) { prev.len = Math.max(prev.len, g.at[0].i - prev.at[0].i + GUARD_WINDOW); continue; }
    reported.push({ at: g.at, len: GUARD_WINDOW, first: g.lines[0] });
  }
  const took = Date.now() - t0;
  const pct = (100 * measure.dupLines / measure.totalLines).toFixed(1);
  const lines = reported.map((r) => r.len + " lines · " + r.at.map(place).join("  ") + " · " + r.first.slice(0, 80));
  all("1.27.1 duplicated code: no run of " + GUARD_WINDOW + "+ normalized code lines appears twice in mcp/lib, mcp/server.js, cli/, hooks/ or scripts/ (" +
    files.length + " files, " + measure.totalLines + " code lines; duplicated at the measure's window of " + MEASURE_WINDOW + ": " + measure.dupLines + " lines = " + pct + "%; " +
    took + " ms) — the allowed ones: " + ALLOW.map((a) => a.name + " (" + (allowedBy.get(a.name) || 0) + " windows: " + a.why + ")").join("; ") +
    (lines.length ? " — duplicated:\n      " + lines.join("\n      ") : ""), {
    scanned: () => files.length > 50 && measure.totalLines > 30000 && files.some((f) => f.rel === "mcp/lib/engine/state.js") && files.some((f) => f.rel === "hooks/hook-utils.js"),
    "no duplicated window past the allowed ones": () => reported.length === 0,
    "each allowance still matches a window (a stale one goes)": () => ALLOW.every((a) => allowedBy.get(a.name) > 0),
    "the scanner finds a planted copy": () => {
      const body = files.find((f) => f.rel === "mcp/lib/engine/state.js").lines.slice(100, 100 + GUARD_WINDOW).map((x) => x.t).join("\n");
      const planted = [...files, { rel: "planted.js", lines: codeLines("// a copy\n" + body + "\n") }];
      return duplicates(planted, GUARD_WINDOW).groups.some((g) => g.at.some((o) => planted[o.fi].rel === "planted.js") && !ALLOW.some((a) => a.allowed(g, planted)));
    },
    fast: () => took < 5000,
  });
};
