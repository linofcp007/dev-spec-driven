#!/usr/bin/env node
"use strict";

/**
 * The test totals a release records, read from a RUN — never typed. CLAUDE.md (Tests: "(N assertions, incl." and "`node
 * cli/test-cli.js` adds N") and the current CHANGELOG entry ("`node mcp/test.js` N assertions, `node cli/test-cli.js` N") state
 * the suites' totals; mcp/tests/17-docs.js only held them to EACH OTHER, so two equal typos passed. This runs both suites, reads
 * each one's last line (`N passed, M failed` — scripts/test-runner.js RE_TOTAL) and rewrites those sentences with the real totals.
 *
 *   npm run release:counts [-- --jobs <n>]          run both suites, then write the totals into CLAUDE.md and the CHANGELOG entry
 *   node scripts/release-counts.js --check          run both suites; exit 1 when a sentence says another total (nothing written)
 *   node scripts/release-counts.js --mcp N --cli M  the totals of a full run just made (no run) — with or without --check
 *   --root <dir>                                    another checkout (the script's own by default)
 *
 * A suite with a failure, or without its total line, records nothing (exit 1). A current CHANGELOG entry without its tests line
 * gets the line to paste, `(was …)` read from the previous entry (exit 1). Zero dependencies — Node core only.
 * docs/maintainers/testing.md → Release counts.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { RE_TOTAL } = require("./test-runner.js");

const SUITES = { mcp: "mcp/test.js", cli: "cli/test-cli.js" };
// The count sentences — each { file, suite, re }: `re`'s group 1 is the number. CHANGELOG's are read in its CURRENT entry only
// (the first `## [` heading's section).
const SENTENCES = [
  { file: "CLAUDE.md", suite: "mcp", re: /(\()(\d+)( assertions, incl\.)/ },
  { file: "CLAUDE.md", suite: "cli", re: /(`node cli\/test-cli\.js` adds )(\d+)/ },
  { file: "CHANGELOG.md", suite: "mcp", re: /(`node mcp\/test\.js` )(\d+)( assertions)/ },
  { file: "CHANGELOG.md", suite: "cli", re: /(`node cli\/test-cli\.js` )(\d+)/ },
];

// CHANGELOG.md → { head, current, rest }: the text before the first entry, the first entry (its `## [` heading included), the rest.
function splitChangelog(text) {
  const at = text.search(/^## \[/m);
  if (at < 0) return { head: text, current: "", rest: "" };
  const next = text.slice(at + 1).search(/^## \[/m);
  const end = next < 0 ? text.length : at + 1 + next;
  return { head: text.slice(0, at), current: text.slice(at, end), rest: text.slice(end) };
}
const scopeOf = (s, text) => (s.file === "CHANGELOG.md" ? splitChangelog(text).current : text);

// What the sentences say → [{ file, suite, value (a number, or null: no such sentence) }].
function readCounts(root) {
  return SENTENCES.map((s) => {
    let text = "";
    try { text = fs.readFileSync(path.join(root, s.file), "utf8"); } catch { /* reported as missing */ }
    const m = scopeOf(s, text).match(s.re);
    return { file: s.file, suite: s.suite, value: m ? Number(m[2]) : null };
  });
}

// The line a CHANGELOG entry records the totals in — (was …) from the previous entry when it has one.
function changelogLine(totals, text) {
  const { rest } = splitChangelog(text);
  const prev = (suite) => { const s = SENTENCES.find((x) => x.file === "CHANGELOG.md" && x.suite === suite); const m = rest.match(s.re); return m ? Number(m[2]) : null; };
  const was = (suite) => (prev(suite) === null || prev(suite) === totals[suite] ? "" : ` (was ${prev(suite)})`);
  return `- \`node mcp/test.js\` ${totals.mcp} assertions${was("mcp")}, \`node cli/test-cli.js\` ${totals.cli}${was("cli")}.`;
}

// Rewrite the sentences with `totals` ({mcp, cli}) → { changed: [{file, suite, from, to}], missing: [{file, suite}], files: {name: text} }
// (the new texts; nothing written here).
function rewrite(root, totals) {
  const files = {};
  const changed = [], missing = [];
  for (const s of SENTENCES) {
    if (!(s.file in files)) files[s.file] = fs.readFileSync(path.join(root, s.file), "utf8");
    const text = files[s.file];
    const scope = scopeOf(s, text);
    const m = scope.match(s.re);
    if (!m) { missing.push({ file: s.file, suite: s.suite }); continue; }
    if (Number(m[2]) === totals[s.suite]) continue;
    changed.push({ file: s.file, suite: s.suite, from: Number(m[2]), to: totals[s.suite] });
    const scoped = scope.replace(s.re, (all, a, n, b) => a + totals[s.suite] + (typeof b === "string" ? b : "")); // (a 2-group re's 4th is the offset)
    files[s.file] = s.file === "CHANGELOG.md" ? ((p) => p.head + scoped + p.rest)(splitChangelog(text)) : scoped;
  }
  return { changed, missing, files };
}

// Run one suite in `root` → { total: {passed, failed} | null, out }.
function runSuite(root, suite, jobs) {
  const args = [path.join(root, SUITES[suite]), ...(jobs ? ["--jobs", String(jobs)] : [])];
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  const out = (r.stdout || "") + (r.stderr || "");
  const m = String(r.stdout || "").match(RE_TOTAL);
  return { total: m ? { passed: Number(m[1]), failed: Number(m[2]) } : null, code: r.status, out };
}

const USAGE = `usage: node scripts/release-counts.js [--check] [--jobs <n>] [--mcp <N> --cli <M>] [--root <dir>]

Runs both suites and writes their totals into CLAUDE.md (Tests) and the current CHANGELOG entry.
  --check          write nothing: exit 1 when a sentence states another total than the run
  --jobs <n>       the suites' --jobs (a shared machine: 4)
  --mcp N --cli M  the totals of a full run just made — no run
  --root <dir>     another checkout (default: this one)
Exit: 0 the sentences state the run's totals · 1 a suite failed, a sentence differs (--check) or is missing · 2 a usage error.`;

function parseArgs(argv) {
  const o = { check: false, jobs: 0, mcp: null, cli: null, root: path.resolve(__dirname, "..") };
  const usage = (msg) => { console.error(`release-counts: ${msg}\n\n${USAGE}`); process.exit(2); };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [flag, inline] = a.startsWith("--") && a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, undefined];
    const value = () => { const v = inline !== undefined ? inline : argv[++i]; if (v == null || v === "" || v.startsWith("--")) usage(`${flag} needs a value`); return v; };
    const count = () => { const v = value(); if (!/^\d+$/.test(v)) usage(`${flag} needs a whole number (got '${v}')`); return Number(v); };
    if (flag === "--help" || flag === "-h") { console.log(USAGE); process.exit(0); }
    else if (flag === "--check") o.check = true;
    else if (flag === "--jobs") { o.jobs = count(); if (o.jobs < 1) usage("--jobs needs a whole number >= 1"); }
    else if (flag === "--mcp") o.mcp = count();
    else if (flag === "--cli") o.cli = count();
    else if (flag === "--root") o.root = path.resolve(value());
    else usage(`unknown argument '${a}'`);
  }
  if ((o.mcp === null) !== (o.cli === null)) usage("--mcp and --cli go together (both totals of one run)");
  return o;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  let totals;
  if (o.mcp !== null) totals = { mcp: o.mcp, cli: o.cli };
  else {
    totals = {};
    for (const suite of Object.keys(SUITES)) {
      console.log(`running node ${SUITES[suite]}${o.jobs ? " --jobs " + o.jobs : ""} …`);
      const r = runSuite(o.root, suite, o.jobs);
      if (!r.total || r.total.failed || r.code !== 0) {
        r.out.split(/\r?\n/).filter((l) => /^ {2}FAIL - /.test(l)).slice(0, 20).forEach((l) => console.log("  " + l.slice(0, 300)));
        console.error(`release-counts: ${SUITES[suite]} ${r.total ? `${r.total.passed} passed, ${r.total.failed} failed` : `printed no total (exit ${r.code})`} — the suites must pass before their totals are recorded`);
        process.exitCode = 1;
        return;
      }
      totals[suite] = r.total.passed;
      console.log(`  ${r.total.passed} passed, 0 failed`);
    }
  }
  const { changed, missing, files } = rewrite(o.root, totals);
  for (const c of changed) console.log(`${o.check ? "differs" : "updated"}: ${c.file} (${c.suite}) ${c.from} → ${c.to}`);
  for (const m of missing) {
    console.error(`release-counts: ${m.file} has no ${m.suite} total sentence` + (m.file === "CHANGELOG.md" ? " in its current entry — add this line under its Tests heading:\n" + changelogLine(totals, files["CHANGELOG.md"]) : ""));
  }
  if (!o.check) for (const f of new Set(changed.map((c) => c.file))) fs.writeFileSync(path.join(o.root, f), files[f]);
  if (!changed.length && !missing.length) console.log(`the sentences state the run's totals: mcp ${totals.mcp}, cli ${totals.cli}`);
  process.exitCode = missing.length || (o.check && changed.length) ? 1 : 0;
}

if (require.main === module) main();

module.exports = { SENTENCES, readCounts, rewrite, changelogLine, splitChangelog };
