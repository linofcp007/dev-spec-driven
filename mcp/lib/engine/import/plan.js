"use strict";

/**
 * dev-spec-driven engine — spec_import plan and execplan.
 * A Claude Code / Cursor plan-mode file and a Codex ExecPlan → the import model (the plan-text helpers bmad and
 * fluidplan reuse live here).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let closesFence, colonLineAnchorAt, earsFromGwt, earsThen, firstParagraph, headRest, indentOf, isObj, isWsUnit,
  mdHeadings, mdRange, newImportModel, RE_FENCE, RE_MD_HR, RE_MODAL, restAfterBlanks, safeReaddir, shortTitle, stripEnd,
  stripHashComment, stripHtmlComments, tidyLines, toPosix, trimClause;
function __link(E) { ({ closesFence, colonLineAnchorAt, earsFromGwt, earsThen, firstParagraph, headRest, indentOf,
  isObj, isWsUnit, mdHeadings, mdRange, newImportModel, RE_FENCE, RE_MD_HR, RE_MODAL, restAfterBlanks, safeReaddir,
  shortTitle, stripEnd, stripHashComment, stripHtmlComments, tidyLines, toPosix, trimClause } = E); }

// ---------------------------------------------------------------------------
// spec_import (1.14 C3) — three more sources, with the same guarantees (a NEW feature, the source only read and inside the project,
// mapping + warnings, the localized "Imported from" note, tracks auto-classified unless given):
//   plan      a Markdown plan: Claude Code plan mode (plansDirectory — default ~/.claude/plans, OUTSIDE the project: copy the
//             plan in, or point plansDirectory inside it) or Cursor (.cursor/plans/*.plan.md — YAML front matter name /
//             overview / todos [{id, content, status}]). Goals and acceptance-like bullets → US-1's criteria (EARS when the bullet
//             already reads like one, else kept with [NEEDS CLARIFICATION]); checklists (or Cursor todos, else the items of a
//             Steps / Implementation section, else its sub-headings) → tasks keeping their state; the file paths a step names →
//             _Implements:_; everything else (context, approach, files, risks, verification commands) → design.md.
//   execplan  a Codex ExecPlan (PLANS.md): Validation and Acceptance → criteria; Progress (state kept) + Concrete Steps → tasks,
//             a step naming a check command (npm test, pytest, curl …) → _Verify:_; Decision Log → design.md "## Decisions"
//             (D-1 …); Purpose → the summary; the living sections (Surprises & Discoveries, Outcomes, Context, Plan of Work …) →
//             design.md verbatim.
//   bmad      BMAD-METHOD docs: the PRD (docs/prd.md, a sharded docs/prd/, v6 _bmad-output/planning-artifacts/) FR / NFR lines →
//             FR-n / NFR-n (dev-spec's IDs), its epic stories and story files (docs/stories/*.md, v6 implementation-artifacts)
//             → US-1…US-n in story order (a story file wins over the PRD's copy), their ACs → US-n.AC-m, Tasks / Subtasks →
//             tasks tagged [USn] (a subtask is a task of its own, as every imported checkbox is), "(AC: 1, 3)" →
//             _Requirements:_; architecture.md + Technical Assumptions / UI Design Goals + each story's Dev Notes → design.md.
// A path naming a folder with several plans is refused (name the file). Nothing is dropped silently: what no mapping takes is
// carried (design.md for a plan / ExecPlan, requirements.md for a PRD) or named in a warning.
// ---------------------------------------------------------------------------
// /^(\s*)[-*+]\s+\[([ xX~\-/])\]\s+(.*)$/ → [line, indent, box, text] | null (restAfterBlanks for the text)
const RE_PLAN_CHECKBOX_HEAD = /^(\s*)[-*+]\s+\[([ xX~\-/])\]/;
function planCheckbox(l) {
  const h = RE_PLAN_CHECKBOX_HEAD.exec(l);
  const rest = h && restAfterBlanks(l, h[0].length, true);
  return rest == null ? null : [l, h[1], h[2], rest];
}
// /^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[([ xX~\-/])\]\s+)?(.*)$/ → [line, indent, box | undefined, text] | null
const RE_PLAN_ITEM_HEAD = /^(\s*)(?:[-*+]|\d+[.)])/;
const RE_PLAN_ITEM_BOX = /\[([ xX~\-/])\](?=\s)/y;
function planItem(l) {
  const h = RE_PLAN_ITEM_HEAD.exec(l);
  if (!h || !isWsUnit(l[h[0].length])) return null;
  let q = h[0].length;
  while (q < l.length && isWsUnit(l[q])) q++;
  RE_PLAN_ITEM_BOX.lastIndex = q;
  const box = RE_PLAN_ITEM_BOX.exec(l);
  const rest = restAfterBlanks(l, box ? q + 3 : h[0].length, true);
  return rest == null ? null : [l, h[1], box ? box[1] : undefined, rest];
}
// A single backticked name reads as a file with one of these extensions (`package.json`); a name with a folder part needs none.
const PLAN_FILE_EXT = new Set(["js", "mjs", "cjs", "jsx", "ts", "tsx", "mts", "cts", "py", "rb", "go", "rs", "java", "kt", "kts", "scala", "cs", "fs", "php",
  "swift", "m", "mm", "c", "h", "cc", "cpp", "hpp", "md", "mdx", "json", "jsonc", "yaml", "yml", "toml", "ini", "cfg", "conf", "css", "scss", "sass", "less",
  "html", "htm", "vue", "svelte", "astro", "sql", "prisma", "graphql", "gql", "proto", "sh", "bash", "zsh", "ps1", "bat", "xml", "gradle", "lock", "txt",
  "csv", "tf", "hcl", "ex", "exs", "erl", "dart", "lua", "ipynb"]);
const PLAN_NOT_FILES = new Set(["node.js", "next.js", "vue.js", "react.js", "nuxt.js", "express.js", "three.js", "d3.js", "chart.js", "nest.js", "ember.js", "backbone.js", "alpine.js", "solid.js"]);
const PLAN_BARE_FILES = /^(?:Dockerfile|Makefile|Procfile|Gemfile|Rakefile|Jenkinsfile|Containerfile|Justfile)$/;
// The file paths a step names → its _Implements:_ list: backticked paths / file names, markdown link targets and bare tokens
// with a folder part and an extension. Never a URL, an absolute or home path, '..', an alias (@/…), a glob or a path a
// marker couldn't read back (spaces, ',' ';'); a trailing :line / #L10 is dropped.
function planPaths(text) {
  const out = [];
  const add = (raw, spanned) => {
    const p0 = String(raw).trim().replace(/^\.\//, "");
    // .replace(/(?::\d+(?:[-:]\d+)*|#L\d+(?:-L?\d+)?)$/, "") — the leftmost of the two anchors, found without rescanning a
    // long run of ":1" from each of its units (1.17 H): a "#L…" one can only start at the last '#'.
    const h = p0.lastIndexOf("#"), c = colonLineAnchorAt(p0);
    const hl = h !== -1 && /^#L\d+(?:-L?\d+)?$/.test(p0.slice(h)) ? h : -1;
    const cut = c === -1 ? hl : hl === -1 ? c : Math.min(c, hl);
    const p = cut === -1 ? p0 : p0.slice(0, cut);
    if (!p || p.length > 200 || /[\s,;<>|"'`*?\\]/.test(p) || /^(?:[a-z][a-z0-9+.-]*:|\/|~|@|\$|%)/i.test(p) || /(?:^|\/)\.\.(?:\/|$)/.test(p)) return;
    if (PLAN_NOT_FILES.has(p.toLowerCase())) return;
    const bare = p.replace(/\/+$/, "");
    const last = bare.split("/").pop();
    const ext = (last.match(/\.([A-Za-z0-9]{1,10})$/) || [])[1];
    if (bare.includes("/")) {
      if (!/^[\w.@+\-/[\]()]+$/.test(p) || (!ext && !spanned)) return;
    } else if (!spanned || !((ext && PLAN_FILE_EXT.has(ext.toLowerCase()) && /^[\w.\-+]+$/.test(p)) || PLAN_BARE_FILES.test(p))) return;
    if (!out.includes(p)) out.push(p);
  };
  const s = String(text || "");
  for (const m of s.matchAll(/`([^`\n]+)`/g)) add(m[1], true);
  // Linear (full review Pb6): a link text holds no '[' (each '[' scans only up to the next bracket — "[" × N was quadratic)
  // and a link target is bounded (add() refuses a path over 200 characters anyway).
  const rest = s.replace(/`[^`\n]*`/g, " ").replace(/\[([^[\]\n]*)\]\(([^)\s]{1,256})\)/g, " $1 $2 ");
  for (const tok of rest.split(/\s+/)) {
    const t = planTokenTrim(tok);
    if (t.includes("/")) add(t, false);
  }
  return out;
}
// A token's wrapping punctuation dropped — a plain scan: the anchored regex (/[)…]+$/) rescanned a long run of ')' from every
// position (full review Pb6).
const PLAN_TOKEN_LEAD = new Set(["(", '"', "'", "[", "{", "<", "*", "_"]);
const PLAN_TOKEN_TRAIL = new Set([")", '"', "'", "]", "}", ">", ".", ",", ";", ":", "!", "?", "*", "_"]);
function planTokenTrim(tok) {
  let a = 0, b = tok.length;
  while (a < b && PLAN_TOKEN_LEAD.has(tok[a])) a++;
  while (b > a && PLAN_TOKEN_TRAIL.has(tok[b - 1])) b--;
  return tok.slice(a, b);
}
// A shell command a step names (a backticked span, or a line of its code block) — the first that reads as a CHECK (a test, lint,
// build or curl run) becomes the task's _Verify:_. A `$ ` prompt and a leading `cd <dir> &&` are dropped; one line only.
const RE_PLAN_RUNNER = /^(?:npm|npx|pnpm|yarn|bun|bunx|node|deno|python3?|py|pytest|uv|poetry|go|cargo|make|mvn|gradle|\.\/gradlew|dotnet|bundle|rake|rspec|rails|php|composer|phpunit|vendor\/bin\/phpunit|swift|xcodebuild|ctest|tox|nox|ruff|mypy|eslint|tsc|jest|vitest|mocha|playwright|cypress|curl|mix|flutter|dart|sbt|zig|just)\b/;
const RE_PLAN_CHECK = /(?<![\w-])(?:test|tests|spec|check|lint|verify|tsc|typecheck|type-check|build|pytest|jest|vitest|mocha|rspec|phpunit|ctest|clippy|vet|curl|e2e)(?![\w-])/i;
function planCommand(candidates) {
  for (const raw of candidates) {
    const c = String(raw).trim().replace(/^\$\s+/, "").replace(/^cd\s+\S+\s*&&\s*/, "");
    if (!c || /[\r\n`]/.test(c) || /_\s/.test(c) || c.length > 300) continue;
    if (RE_PLAN_RUNNER.test(c) && RE_PLAN_CHECK.test(c)) return c;
  }
  return null;
}
// A command-only bullet ("Run `npm test`", "`npm test` passes") is a check to run, not a criterion.
function planCommandOnly(text) {
  const t = String(text).replace(/\*\*|__/g, "").trim();
  // \s*:?\s* → \s*(?::\s*)? and \s*(?:word)?\s* → \s*(?:word\s*)? (the same lines): blank runs meeting around an absent
  // token backtracked quadratically (1.17 H).
  const m = t.match(/^(?:run|execute|corre|correr|executa|executar|ejecuta|ejecutar)?\s*(?::\s*)?`([^`]+)`\s*(?:(?:passes|succeeds|is green|should pass|passa|pasa)\s*)?[.;]?$/i);
  return !!(m && RE_PLAN_RUNNER.test(m[1].trim().replace(/^\$\s+/, "")));
}
// A criterion as written in a plan → EARS when it already reads like one: a modal requirement (kept), Given/When/Then, or a
// WHEN / IF / WHILE clause with its response ("When the toggle is clicked, the theme switches" → WHEN …, THE SYSTEM SHALL ensure
// that …) — EN / PT / ES. Anything else → null (kept with [NEEDS CLARIFICATION]).
const PLAN_COND = [
  ["en", /^(when|whenever|if|while)\s+(.+?),\s*(.+)$/i],
  ["pt", /^(quando|sempre que|se|enquanto)\s+(.+?),\s*(.+)$/i],
  ["es", /^(cuando|siempre que|si|mientras)\s+(.+?),\s*(.+)$/i],
];
function earsFromPlanText(raw) {
  const t = String(raw).replace(/^\[[ xX~\-/]\]\s+/, "").replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (RE_MODAL.test(t)) return t;
  const g = earsFromGwt(t);
  if (g) return g;
  for (const [lng, re] of PLAN_COND) {
    const m = t.match(re);
    if (!m) continue;
    const E = i18n.msg(lng).importSpec.ears;
    const then = earsThen(m[3], lng, E);
    if (!then) return null;
    const kw = m[1].toLowerCase();
    if (kw === "if" || kw === "se" || kw === "si") return `${E.if} ${trimClause(m[2])}, ${E.then} ${then}`;
    return `${kw === "while" || kw === "enquanto" || kw === "mientras" ? E.while : E.when} ${trimClause(m[2])}, ${then}`;
  }
  return null;
}
// Top-level list items of [lo, hi) with their whole body (nested items, paragraphs, code blocks — blank lines inside it): up to the
// next item at (or left of) its indent, a heading, or a line back at its indent after a blank one. code = the body's code lines
// (fenced, or indented 4 past the item's text).
function planBlocks(lines, lo, hi) {
  const items = [];
  let cur = null, fence = null, prevBlank = true;
  for (let i = lo; i < hi; i++) {
    const l = lines[i];
    if (fence) { if (cur) { cur.body.push(i); cur.code.add(i); } if (closesFence(l, fence)) fence = null; prevBlank = false; continue; }
    const f = l.match(RE_FENCE);
    if (f) {
      if (cur && (indentOf(l) > cur.indent || !prevBlank)) { cur.body.push(i); cur.code.add(i); } else cur = null;
      fence = f[1];
      prevBlank = false;
      continue;
    }
    if (/^\s*#{1,6}\s/.test(l)) { cur = null; prevBlank = false; continue; }
    const blank = !l.trim();
    const m = planItem(l);
    const ind = indentOf(l);
    if (m && (!cur || ind <= cur.indent)) {
      cur = { i, indent: ind, content: l.length - l.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").length, box: m[2] != null ? m[2] : null, text: m[3].trim(), body: [], code: new Set() };
      items.push(cur);
      prevBlank = false;
      continue;
    }
    if (!cur) { prevBlank = blank; continue; }
    if (blank) { cur.body.push(i); prevBlank = true; continue; }
    if (ind > cur.indent || !prevBlank) {
      cur.body.push(i);
      if (ind >= cur.content + 4) cur.code.add(i);
      prevBlank = false;
      continue;
    }
    cur = null;
    prevBlank = false;
  }
  for (const it of items) while (it.body.length && !lines[it.body[it.body.length - 1]].trim()) it.body.pop();
  return items;
}
// Every checkbox of [lo, hi) outside fenced code — importTasks' rule: a nested one is a task of its own — with its own body (the
// more-indented lines under it, up to the next checkbox, a heading or a line back at its indent). skip(i): lines not to read.
function checkboxUnits(lines, lo, hi, skip) {
  const units = [];
  let cur = null, fence = null;
  for (let i = lo; i < hi; i++) {
    const l = lines[i];
    if (fence) { if (cur) { cur.body.push(i); cur.code.add(i); } if (closesFence(l, fence)) fence = null; continue; }
    if (skip && skip(i)) { cur = null; continue; }
    const f = l.match(RE_FENCE);
    if (f) { fence = f[1]; if (cur && indentOf(l) > cur.indent) { cur.body.push(i); cur.code.add(i); } else cur = null; continue; }
    const m = planCheckbox(l);
    if (m) {
      cur = { i, indent: m[1].length, content: l.length - l.replace(/^\s*[-*+]\s+/, "").length, box: m[2], text: m[3].trim(), body: [], code: new Set() };
      units.push(cur);
      continue;
    }
    if (/^\s*#{1,6}\s/.test(l)) { cur = null; continue; }
    if (!cur) continue;
    if (!l.trim()) { cur.body.push(i); continue; }
    if (indentOf(l) > cur.indent) { cur.body.push(i); if (indentOf(l) >= cur.content + 4) cur.code.add(i); continue; }
    cur = null;
  }
  for (const u of units) while (u.body.length && !lines[u.body[u.body.length - 1]].trim()) u.body.pop();
  return units;
}
const markUnit = (used, u) => { used.add(u.i); u.body.forEach((b) => used.add(b)); };
// A unit's prose (its text + the body lines that are not code) and its code lines.
const unitProse = (lines, u) => [u.text, ...u.body.filter((b) => !u.code.has(b)).map((b) => lines[b])].join("\n");
const unitCode = (lines, u) => u.body.filter((b) => u.code.has(b) && !RE_FENCE.test(lines[b])).map((b) => lines[b].trim());
// One synthesized task (importTasks renumbers it): `- [x] <tag> text`, its markers, then its own body re-indented under it.
function planTaskLines(lines, u, o) {
  const out = [`- [${o.done ? "x" : " "}] ${o.tag ? o.tag + " " : ""}${o.text != null ? o.text : u.text}`];
  if (o.req && o.req.length) out.push(`  - _Requirements: ${o.req.join(", ")}_`);
  if (o.paths && o.paths.length) out.push(`  - _Implements: ${o.paths.join(", ")}_`);
  if (o.verify) out.push(`  - _Verify: ${o.verify}_`);
  const base = u.content != null ? u.content : u.indent + 2;
  for (const b of u.body || []) {
    const l = lines[b].trimEnd();
    out.push(!l.trim() ? "" : "  " + l.slice(Math.min(indentOf(l), base)));
  }
  return out;
}
const planDone = (box) => box === "x" || box === "X";
// The heading text a section is recognised by: numbering, emoji and emphasis dropped ("## 2. ✅ Verification" → "Verification").
// "### Step 1: Add the store" is a step's own title ("Add the store"), never a Steps section heading of its own.
const planHeadingText = (t) => String(t).replace(/[*_`]/g, "").replace(/^[^\p{L}\p{N}]+/u, "").replace(/^\d+(?:\.\d+)*[.):]?\s+/, "")
  .replace(/^(?:step|phase|passo|paso|fase|etapa)\s+\d+(?:\.\d+)*\s*[:.\-–—]\s*/i, "").trim();
// Each heading's section kind (its own, else its parent's): { kinds: [kind | null per heading], direct(k): [lo, hi) of its own lines }.
function planSections(lines, hs, classify) {
  const kinds = [], own = [], parent = [];
  const stack = [];
  hs.forEach((h, k) => {
    while (stack.length && hs[stack[stack.length - 1]].level >= h.level) stack.pop();
    parent[k] = stack.length ? stack[stack.length - 1] : -1;
    own[k] = classify(planHeadingText(h.text), h) || null;
    kinds[k] = own[k] || (parent[k] !== -1 ? kinds[parent[k]] : null);
    stack.push(k);
  });
  return { kinds, own, parent, direct: (k) => [hs[k].i + 1, k + 1 < hs.length ? hs[k + 1].i : lines.length] };
}
// A sub-heading step ("### Step 1: Create the context" under "## Implementation") → a unit: the heading (its "Step N:" / "N."
// dropped) and everything under it; its own sub-headings become bold lines in the task body, code fences stay code.
function headingUnit(lines, hs, k) {
  const [lo, hi] = mdRange(lines, hs, k);
  const body = [], code = new Set();
  let fence = null;
  for (let i = lo; i < hi; i++) {
    const l = lines[i];
    if (fence) { code.add(i); if (closesFence(l, fence)) fence = null; }
    else if (RE_FENCE.test(l)) { fence = l.match(RE_FENCE)[1]; code.add(i); }
    body.push(i);
  }
  const text = hs[k].text.replace(/^(?:step|passo|paso)\s+\d+\s*[:.\-–—]\s*/i, "").replace(/^\d+(?:\.\d+)*[.)]?\s+/, "");
  return { i: hs[k].i, indent: 0, content: 0, text, body, code };
}
// The unused lines, with only the headings whose section still holds some unused content (a Steps heading whose every item became
// a task goes too) — the design body of a plan / ExecPlan. A level-1 section ("# Appendix") becomes "## …": design.md has its own
// title (and importSpec drops a leading H1 as the source's title).
function unusedMarkdown(lines, hs, used, from = 0) {
  const isHead = new Set(hs.map((h) => h.i));
  const h1s = new Set(hs.filter((h) => h.level === 1).map((h) => h.i));
  const keep = new Set();
  hs.forEach((h, k) => {
    if (used.has(h.i)) return;
    const [lo, hi] = mdRange(lines, hs, k);
    for (let i = lo; i < hi; i++) if (!used.has(i) && !isHead.has(i) && lines[i].trim() && !RE_MD_HR.test(lines[i])) { keep.add(h.i); return; }
  });
  const out = [];
  for (let i = from; i < lines.length; i++) if (!used.has(i) && (!isHead.has(i) || keep.has(i))) out.push(h1s.has(i) ? "#" + lines[i] : lines[i]);
  return tidyLines(out);
}
// A tiny YAML subset for Cursor's plan front matter: top-level `key: value` scalars (quoted or plain; `|` / `>` blocks folded) and
// `todos:` — a list of maps (`- id: …` / `  content: …` / `  status: …`). → { data, end } (end = the line after the closing ---) or null.
function planFrontMatter(lines) {
  if (!lines.length || lines[0].trim() !== "---") return null;
  const end = lines.findIndex((l, i) => i > 0 && /^(?:---|\.\.\.)\s*$/.test(l));
  if (end === -1) return null;
  const unq = (v) => {
    const s = String(v).trim();
    if (/^"(?:[^"\\]|\\.)*"$/.test(s)) return s.slice(1, -1).replace(/\\(["\\/])/g, "$1").replace(/\\n/g, " ").replace(/\\t/g, " ");
    if (/^'(?:[^']|'')*'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
    return stripHashComment(s); // s.replace(/\s+#.*$/, "") (1.17 H)
  };
  const data = Object.create(null); // a key named __proto__ is a plain key
  let list = null, item = null;
  // The key: value / list entry patterns below read their text by headRest — \s*(.*)$ rescanned a long blank run before a
  // line terminator (1.17 H).
  for (let i = 1; i < end; i++) {
    const l = lines[i];
    if (!l.trim() || /^\s*#/.test(l)) continue;
    const top = headRest(l, /^([A-Za-z_][\w-]*):/, false); // /^([A-Za-z_][\w-]*):\s*(.*)$/
    if (top) {
      list = item = null;
      if (/^[|>][-+]?\s*$/.test(top[2])) { // a block scalar: the more-indented lines under it, folded into one line
        const parts = [];
        while (i + 1 < end && (!lines[i + 1].trim() || /^\s/.test(lines[i + 1]))) parts.push(lines[++i].trim());
        data[top[1]] = parts.filter(Boolean).join(" ");
      } else if (!top[2].trim()) data[top[1]] = list = [];
      else data[top[1]] = unq(top[2]);
      continue;
    }
    const entry = list && headRest(l, /^\s*-/, true); // /^\s*-\s+(.*)$/
    if (entry) { // a list entry: a map ("- id: x") or a scalar
      const kv = headRest(entry[1], /^([A-Za-z_][\w-]*):/, false);
      item = kv ? Object.create(null) : null;
      if (kv) item[kv[1]] = unq(kv[2]);
      list.push(item || unq(entry[1]));
      continue;
    }
    const kv = item && headRest(l, /^\s+([A-Za-z_][\w-]*):/, false); // /^\s+([A-Za-z_][\w-]*):\s*(.*)$/
    if (kv) item[kv[1]] = unq(kv[2]); // the entry's next key (null-prototype maps: any key is a plain key)
  }
  return { data, end: end + 1 };
}
// A folder given for a single-document source (a plan, an ExecPlan): its only .md file — several → { several }, none → null.
function singleDoc(dir, src, exclude) {
  if (src.file) return { file: src.file };
  const names = safeReaddir(dir).filter((n) => /\.md$/i.test(n) && !(exclude && exclude.test(n))).sort();
  const files = names.filter((n) => { try { return fs.lstatSync(path.join(dir, n)).isFile(); } catch { return false; } });
  if (files.length > 1) return { several: files };
  return files.length ? { file: path.join(dir, files[0]) } : null;
}
// A single-document model with one story: title → US-1, the criteria given. → the story object.
function planStory(model, title, criteria) {
  const story = { printed: null, key: title, title, priority: null, prose: [], quote: [], after: [], criteria };
  model.stories.push(story);
  return story;
}
// A plan / ExecPlan wrapped whole in one ```md fence (PLANS.md's own examples are) → its inside.
// What /^\s*(`{3,}|~{3,})\s*(?:md|markdown)?\s*\r?\n([\s\S]*?)\r?\n\1\s*$/i took as the inside ($2), by a scan — that pattern
// backtracked quadratically over a long fence run or blank run (1.17 H). The closing fence can only be the text's last
// non-blank run (on a line of its own); the inside starts after the opening line's newline: the last one of the blanks after
// "md" / "markdown" when the word is there, else the last one of the blanks after the fence (the engine's order), as long as
// the inside does not run past the closing fence.
function unwrapDocFence(text) {
  const s = String(text);
  let f0 = 0;
  while (f0 < s.length && isWsUnit(s[f0])) f0++;
  const c = s[f0];
  if (c !== "`" && c !== "~") return text;
  let p1 = f0;
  while (s[p1] === c) p1++;
  const L = p1 - f0, T = stripEnd(s, isWsUnit).length, close = T - L - 1; // the closing fence's newline
  if (L < 3 || close < p1 || s[close] !== "\n" || s.slice(T - L, T) !== c.repeat(L)) return text;
  const bodyStart = (hi, lo) => { for (let x = hi - 1; x >= lo; x--) if (s[x] === "\n" && x + 1 <= close) return x + 1; return -1; };
  let q1 = p1;
  while (q1 < s.length && isWsUnit(s[q1])) q1++;
  let bs = -1;
  const word = /^(?:md|markdown)/i.exec(s.slice(q1, q1 + 8));
  if (word) {
    const w = q1 + word[0].length;
    let q2 = w;
    while (q2 < s.length && isWsUnit(s[q2])) q2++;
    bs = bodyStart(q2, w);
  }
  if (bs === -1) bs = bodyStart(q1, p1);
  if (bs === -1) return text;
  return s.slice(bs, s[close - 1] === "\r" && close - 1 >= bs ? close - 1 : close);
}

const RE_PLAN_CRITERIA = /^(?:goals?|objectives?|acceptance(?:\s+criteria)?|success\s+criteria|requirements|definition\s+of\s+done|done\s+when|expected\s+(?:outcomes?|behaviou?r|results?)|verification|validation|objetivos?|metas?|crit[ée]rios\s+de\s+(?:aceita[çc][ãa]o|sucesso)|requisitos|defini[çc][ãa]o\s+de\s+(?:pronto|conclu[íi]do)|resultados?\s+esperados?|verifica[çc][ãa]o|valida[çc][ãa]o|criterios\s+de\s+(?:aceptaci[óo]n|[ée]xito)|definici[óo]n\s+de\s+(?:hecho|terminado)|verificaci[óo]n|validaci[óo]n)\b/i;
const RE_PLAN_STEPS = /^(?:(?:implementation\s+)?steps?|implementation(?:\s+(?:plan|details|order|steps))?|(?:work\s+)?plan(?:\s+of\s+work)?|tasks?|to-?dos?|work\s+items?|(?:proposed\s+)?changes|phases?|milestones?|passos|etapas|implementa[çc][ãa]o|plano(?:\s+de\s+implementa[çc][ãa]o)?|tarefas|altera[çc][õo]es|fases|pasos|implementaci[óo]n|plan\s+de\s+implementaci[óo]n|tareas|cambios)\b/i;
// An Approach section (PT abordagem, ES enfoque) holds the plan's steps only when the plan has no other steps section (full
// review Pb3): beside a Steps section it is design prose — its "### Files to modify" inventory became tasks duplicating the
// real steps, and left design.md.
const RE_PLAN_APPROACH = /^(?:approach|abordagem|enfoque)\b/i;
const RE_PLAN_SUMMARY = /^(?:summary|overview|goal|objective|context|problem(?:\s+statement)?|purpose|background|tl;?dr|resumo|vis[ãa]o\s+geral|objetivo|contexto|problema|prop[óo]sito|resumen|visi[óo]n\s+general)\b/i;

// plan — Claude Code plan mode / Cursor plans (see the block comment above).
function parsePlan(dir, read, W, src) {
  const P = i18n.msg(src.lang).importPlans;
  const doc = singleDoc(dir, src);
  if (!doc) return null;
  if (doc.several) return { error: P.several(toPosix(path.relative(src.root, dir)) || ".", doc.several.join(", ")) };
  const text = read(doc.file);
  // An empty plan (blank, or only comments) is nothing to import — the other importers answer "nothing found" too.
  if (text == null || !stripHtmlComments(text).replace(/^\uFEFF/, "").trim()) return null;
  const model = newImportModel();
  model.sourceFile = doc.file;
  const lines = stripHtmlComments(text).split(/\r?\n/);
  const used = new Set();
  const fm = planFrontMatter(lines);
  const fmData = fm ? fm.data : {};
  if (fm) for (let i = 0; i < fm.end; i++) used.add(i);
  const hs = mdHeadings(lines).filter((h) => !fm || h.i >= fm.end);
  const h1 = hs[0] && hs[0].level === 1 ? hs[0] : null; // the title: a first heading of level 1 (never a later '# Steps')
  if (h1) used.add(h1.i);
  const cleanTitle = (t) => String(t || "").replace(/^(?:(?:implementation|execution)\s+plan|plan|plano(?:\s+de\s+implementa[çc][ãa]o)?|plan\s+de\s+implementaci[óo]n)\s*(?:[:—–-]\s*|$)/i, "").trim();
  model.title = (typeof fmData.name === "string" && fmData.name.trim()) || cleanTitle(h1 && h1.text) || null;
  const stem = path.basename(doc.file).replace(/\.md$/i, "").replace(/\.plan$/i, "").replace(/[-_][0-9a-f]{6,}$/i, "");
  model.nameHint = model.title || stem;
  // The title is no section ("# Plan: Add dark mode" is not a Plan-of-work heading its sub-sections inherit).
  const stepsHead = (t) => !RE_PLAN_CRITERIA.test(t) && RE_PLAN_STEPS.test(t);
  const approachSteps = !hs.some((h) => h !== h1 && stepsHead(planHeadingText(h.text))); // no Steps section: an Approach is one
  const sec = planSections(lines, hs, (t, h) => (h === h1 ? null : RE_PLAN_CRITERIA.test(t) ? "criteria"
    : RE_PLAN_STEPS.test(t) || (approachSteps && RE_PLAN_APPROACH.test(t)) ? "steps" : RE_PLAN_SUMMARY.test(t) ? "summary" : null));
  // Summary: Cursor's overview, else the first paragraph of a Summary / Goal / Context section, else the one under the title.
  if (typeof fmData.overview === "string" && fmData.overview.trim()) model.summary = fmData.overview.trim();
  else {
    const k = hs.findIndex((h, j) => sec.kinds[j] === "summary" || (sec.kinds[j] === "criteria" && /^(?:goal|objective|objetivo)\b/i.test(planHeadingText(h.text))));
    const [lo, hi] = k !== -1 ? sec.direct(k) : [fm ? fm.end : 0, (hs.find((h) => h.level > 1) || { i: lines.length }).i];
    const at = [];
    model.summary = firstParagraph(lines.slice(lo, hi), at);
    at.forEach((r) => used.add(lo + r));
  }
  // Criteria: the items of every goals / acceptance / verification section (a command-only item stays in the design).
  const criteria = [];
  hs.forEach((h, k) => {
    if (sec.kinds[k] !== "criteria") return;
    const [lo, hi] = sec.direct(k);
    let j = 0;
    for (const it of planBlocks(lines, lo, hi)) {
      if (planCommandOnly(it.text) && !it.body.length) continue;
      const raw = [it.text, ...it.body.filter((b) => !it.code.has(b)).map((b) => lines[b].trim().replace(/^(?:[-*+]|\d+[.)])\s+/, ""))].filter(Boolean).join(" ").replace(/^\[[ xX~\-/]\]\s+/, "");
      criteria.push({ key: `${planHeadingText(h.text)} ${++j}`, raw, ears: earsFromPlanText(raw) });
      markUnit(used, it);
    }
  });
  const inCriteria = new Set();
  hs.forEach((h, k) => { if (sec.kinds[k] === "criteria") { const [lo, hi] = sec.direct(k); for (let i = lo; i < hi; i++) inCriteria.add(i); } });
  // Tasks: Cursor's todos, else every checklist outside the criteria, else a Steps section's items, else its sub-headings.
  const out = [];
  const keys = [];
  const cancelled = [];
  const todos = Array.isArray(fmData.todos) ? fmData.todos.filter((x) => isObj(x) && typeof x.content === "string" && x.content.trim()) : [];
  if (todos.length) {
    todos.forEach((x, n) => {
      const status = String(x.status || "").toLowerCase();
      if (/^cancel/.test(status)) cancelled.push(shortTitle(x.content.trim(), 40));
      out.push(...planTaskLines(lines, { text: x.content.trim(), body: [], indent: 0 }, { done: /^(?:completed?|done)$/.test(status), paths: planPaths(x.content) }));
      keys.push(`todo ${typeof x.id === "string" && x.id ? x.id : n + 1}`);
    });
  } else {
    const boxes = checkboxUnits(lines, fm ? fm.end : 0, lines.length, (i) => inCriteria.has(i));
    if (boxes.length) {
      let head = null;
      let k = -1; // the heading the checkbox sits under (one walk: the boxes come in line order)
      boxes.forEach((u, n) => {
        while (k + 1 < hs.length && hs[k + 1].i < u.i) k++;
        if (k >= 0 && hs[k].i !== head && hs[k] !== h1) { head = hs[k].i; out.push("", "## " + planHeadingText(hs[k].text)); }
        out.push(...planTaskLines(lines, u, { done: planDone(u.box), paths: planPaths(unitProse(lines, u)) }));
        keys.push(`step ${n + 1}`);
        markUnit(used, u);
      });
    } else {
      hs.forEach((h, k) => {
        if (sec.kinds[k] !== "steps") return;
        const [lo, hi] = sec.direct(k);
        for (const it of planBlocks(lines, lo, hi)) {
          out.push(...planTaskLines(lines, it, { done: planDone(it.box), paths: planPaths(unitProse(lines, it)) }));
          keys.push(`step ${keys.length + 1}`);
          markUnit(used, it);
        }
      });
      if (!out.length) { // no items: the sub-headings right under a Steps section ("### Step 1: Create the context")
        hs.forEach((h, k) => {
          const p = sec.parent[k];
          if (p === -1 || sec.own[p] !== "steps" || sec.own[k]) return;
          const u = headingUnit(lines, hs, k);
          const task = planTaskLines(lines, u, { done: false, paths: planPaths(unitProse(lines, u)) });
          const off = task.length - u.body.length; // the body lines come last: a sub-heading there becomes a bold line (never one in code)
          out.push(...task.map((l, r) => (r >= off && !u.code.has(u.body[r - off]) && /^\s*#{1,6}\s/.test(l) ? "  **" + l.replace(/^\s*#+\s*/, "").trim() + "**" : l)));
          keys.push(`step ${keys.length + 1}`);
          markUnit(used, u);
        });
      }
    }
  }
  planStory(model, model.title || model.nameHint || P.planTitle, criteria);
  if (out.length) {
    model.tasks = { text: out.join("\n"), file: path.basename(doc.file) };
    model.taskKeys = keys;
  } else model.warnings.push(P.wNoSteps);
  if (cancelled.length) model.warnings.push(P.wCancelled(cancelled.join(", ")));
  const design = unusedMarkdown(lines, hs, used, fm ? fm.end : 0);
  if (design.length) model.design = { text: design.join("\n"), file: path.basename(doc.file) };
  else model.warnings.push(P.wNoDesignLeft);
  return model;
}

// execplan — a Codex ExecPlan (PLANS.md): see the block comment above.
const RE_EXEC_SECTION = [
  ["purpose", /^purpose\b|^big picture\b|^prop[óo]sito\b/i],
  ["progress", /^progress\b|^progresso\b|^progreso\b/i],
  ["decisions", /^decision log\b|^decisions?\b|^registo de decis|^registro de decis|^decis[õo]es\b|^decisiones\b/i],
  ["steps", /^concrete steps\b|^passos concretos\b|^pasos concretos\b/i],
  ["validation", /^validation(?:\s+and\s+|\s*&\s*)acceptance\b|^validation\b|^acceptance\b|^valida[çc][ãa]o(?:\s+e\s+aceita[çc][ãa]o)?\b|^validaci[óo]n(?:\s+y\s+aceptaci[óo]n)?\b/i],
];
function parseExecPlan(dir, read, W, src) {
  const P = i18n.msg(src.lang).importPlans;
  const doc = singleDoc(dir, src, /^(?:plans|agents|readme)\.md$/i); // PLANS.md itself is the guide, not a plan
  if (!doc) return null;
  if (doc.several) return { error: P.several(toPosix(path.relative(src.root, dir)) || ".", doc.several.join(", ")) };
  const text = read(doc.file);
  if (text == null) return null;
  const model = newImportModel();
  model.sourceFile = doc.file;
  const lines = stripHtmlComments(unwrapDocFence(text)).split(/\r?\n/);
  const hs = mdHeadings(lines);
  const used = new Set();
  const h1 = hs[0] && hs[0].level === 1 ? hs[0] : null; // the title: a first heading of level 1 (never a later '# Steps')
  if (h1) { used.add(h1.i); model.title = h1.text.replace(/^exec\s*plan\s*[:—–-]\s*/i, "").trim() || null; }
  model.nameHint = model.title || path.basename(doc.file).replace(/\.md$/i, "");
  const sec = planSections(lines, hs, (t, h) => (h === h1 ? null : (RE_EXEC_SECTION.find(([, re]) => re.test(t)) || [null])[0]));
  const ranges = (kind) => hs.map((h, k) => (sec.kinds[k] === kind ? sec.direct(k) : null)).filter(Boolean);
  if (!hs.some((h, k) => sec.kinds[k])) model.warnings.push(P.wNotExecPlan);
  // Summary: Purpose / Big Picture's first paragraph (the rest of it is design context).
  const pr = ranges("purpose")[0];
  if (pr) { const at = []; model.summary = firstParagraph(lines.slice(pr[0], pr[1]), at); at.forEach((r) => used.add(pr[0] + r)); }
  // Criteria: Validation and Acceptance — its items, else its paragraphs (code blocks stay design).
  const criteria = [];
  for (const [lo, hi] of ranges("validation")) {
    const items = planBlocks(lines, lo, hi);
    if (items.length) {
      for (const it of items) {
        if (planCommandOnly(it.text) && !it.body.length) continue;
        const raw = [it.text, ...it.body.filter((b) => !it.code.has(b)).map((b) => lines[b].trim())].filter(Boolean).join(" ").replace(/^\[[ xX~\-/]\]\s+/, "");
        criteria.push({ key: `Validation and Acceptance ${criteria.length + 1}`, raw, ears: earsFromPlanText(raw) });
        markUnit(used, it);
      }
    } else {
      let para = [];
      let fence = null;
      const flush = () => { if (para.length) { const raw = para.map((i) => lines[i].trim()).join(" "); if (!planCommandOnly(raw)) { criteria.push({ key: `Validation and Acceptance ${criteria.length + 1}`, raw, ears: earsFromPlanText(raw) }); para.forEach((i) => used.add(i)); } } para = []; };
      for (let i = lo; i < hi; i++) {
        const l = lines[i];
        if (fence) { if (closesFence(l, fence)) fence = null; continue; }
        const f = l.match(RE_FENCE);
        if (f) { flush(); fence = f[1]; continue; }
        if (!l.trim() || /^\s{4,}\S/.test(l) || /^\s*(?:>|\|)/.test(l)) { flush(); continue; }
        para.push(i);
      }
      flush();
    }
  }
  // Tasks: Progress (checkbox state kept) + Concrete Steps (the steps Progress doesn't already list).
  const out = [];
  const keys = [];
  const seen = new Map(); // a Progress item's text → its unit's index (a Concrete Step saying the same maps to that task)
  model.taskAliases = [];
  const norm = (s) => String(s).replace(/^\(\s*\d{4}-\d{2}-\d{2}[^)]*\)\s*/, "").replace(/[`*_]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const addUnit = (u, key, head) => {
    if (head && !out.includes(head)) out.push("", head);
    const verify = planCommand([...[...unitProse(lines, u).matchAll(/`([^`\n]+)`/g)].map((m) => m[1]), ...unitCode(lines, u)]);
    out.push(...planTaskLines(lines, u, { done: planDone(u.box), paths: planPaths(unitProse(lines, u)), verify }));
    keys.push(key);
    if (!seen.has(norm(u.text))) seen.set(norm(u.text), keys.length - 1);
    markUnit(used, u);
  };
  hs.forEach((h, k) => {
    if (sec.kinds[k] !== "progress") return;
    const [lo, hi] = sec.direct(k);
    checkboxUnits(lines, lo, hi).forEach((u, n) => addUnit(u, `Progress ${n + 1}`, "## " + h.text));
  });
  hs.forEach((h, k) => {
    if (sec.kinds[k] !== "steps") return;
    const [lo, hi] = sec.direct(k);
    const hasBoxes = lines.slice(lo, hi).some((l) => !!planCheckbox(l));
    const units = hasBoxes ? checkboxUnits(lines, lo, hi) : planBlocks(lines, lo, hi);
    units.forEach((u, n) => {
      if (!seen.has(norm(u.text))) return addUnit(u, `Concrete Steps ${n + 1}`, "## " + h.text);
      model.taskAliases.push([`Concrete Steps ${n + 1}`, seen.get(norm(u.text))]); // the same step as a Progress item: one task
      markUnit(used, u);
    });
  });
  // Decision Log → the design's "## Decisions" (D-1 …), each entry's Rationale / Date lines under it.
  const decisions = [];
  for (const [lo, hi] of ranges("decisions")) {
    for (const it of planBlocks(lines, lo, hi)) {
      markUnit(used, it);
      const what = it.text.replace(/^(?:\*\*|__)?(?:decision|decis[ãa]o|decisi[óo]n)(?:\*\*|__)?\s*:\s*(?:\*\*|__)?/i, "").trim();
      if (!what || /^\(?(?:none|n\/a|tbd|nenhuma|ninguna)(?:\s+yet)?\)?\.?$/i.test(what)) continue;
      const n = decisions.length + 1;
      model.mapping[`Decision Log ${n}`] = `D-${n}`;
      decisions.push(`- **D-${n}** — ${what}`, ...it.body.map((b) => lines[b].trimEnd()).filter((l) => l.trim()).map((l) => "  " + l.trim()));
    }
  }
  planStory(model, model.title || model.nameHint, criteria);
  if (out.length) {
    model.tasks = { text: out.join("\n"), file: path.basename(doc.file) };
    model.taskKeys = keys;
  } else model.warnings.push(P.wNoSteps);
  const design = unusedMarkdown(lines, hs, used);
  if (decisions.length) design.push(...(design.length ? [""] : []), P.decisionsHeading, "", ...decisions);
  if (design.length) model.design = { text: design.join("\n"), file: path.basename(doc.file) };
  else model.warnings.push(P.wNoDesignLeft);
  return model;
}

module.exports = { RE_PLAN_CHECKBOX_HEAD, planCheckbox, RE_PLAN_ITEM_HEAD, RE_PLAN_ITEM_BOX, planItem, PLAN_FILE_EXT,
  PLAN_NOT_FILES, PLAN_BARE_FILES, planPaths, PLAN_TOKEN_LEAD, PLAN_TOKEN_TRAIL, planTokenTrim, RE_PLAN_RUNNER,
  RE_PLAN_CHECK, planCommand, planCommandOnly, PLAN_COND, earsFromPlanText, planBlocks, checkboxUnits, markUnit,
  unitProse, unitCode, planTaskLines, planDone, planHeadingText, planSections, headingUnit, unusedMarkdown,
  planFrontMatter, singleDoc, planStory, unwrapDocFence, RE_PLAN_CRITERIA, RE_PLAN_STEPS, RE_PLAN_APPROACH,
  RE_PLAN_SUMMARY, parsePlan, RE_EXEC_SECTION, parseExecPlan, __link };
