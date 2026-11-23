"use strict";

/**
 * dev-spec-driven engine — the project's breakpoints (1.38): the widths the visual review captures, spec_scan {designSystem:
 * true}'s `breakpoints` (the project's report and a feature's alike — never spec_finish's part, never the seed). The first source
 * that gives a width wins:
 *   ui.md   — .specs/steering/ui.md's `- Breakpoints:` line (every +ui stub holds it, under that label in EN / PT / ES): its value
 *             up to the first `·` no length follows, a `[…]` slot left unread (1.39, BS-6: but a closed one opening the value whose
 *             text is no template's) — the team's standard, fingerprinted into the approvals;
 *   code    — Tailwind 4's `--breakpoint-<name>` in a top-level `@theme` block of a stylesheet the token scan reads, through the
 *             observer that walk carries (never a second walk); `partial` when no `--breakpoint-*: initial` / `--*: initial`
 *             reset them — Tailwind keeps its own then, which the engine never assumes (stale data): the default set fills
 *             the places the theme's widths leave (1.39, BS-2: 768 · 1024 · 1440 · 390); and (1.39) a top-level Sass map
 *             whose name's last word is `breakpoints` in a .scss sheet that walk reads (`$grid-breakpoints`, `$breakpoints`, a
 *             `@use … with (…)` override) — a map is whole, never `partial`; and (1.40) ONLY when those give no width, the
 *             width edges of a top-level `@custom-media` rule in such a sheet — an alias list, never the set: `partial`
 *             (CRIT_5 must-fix 1: never beside a theme or a map, whose shapes stay 1.39's);
 *   default — 320 · 390 · 768 · 1024 · 1440.
 * Not read (or never): a file named for breakpoints, a JS config (Tailwind 3's `screens`), `map-merge` (unread).
 * A width is a min edge in CSS px (rem / em × 16 — a media query's em is the initial font size), 320 first — WCAG 1.4.10's
 * reflow width, 1280 at 400 % —, BP_WIDTHS at most. Bounded, linear in what it reads, read-only.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js. LAZY (the tier): design-system.js
 * calls it.
 */
const path = require("path");
// Owned by other engine modules — used at call time only; engine/index.js links them once the tier has loaded.
let codeBlockLines, commentLines, DS_PRELUDE, isTemplatePlaceholder, readIfExists, specsRoot, steeringFrontMatter, toPosix;
function __link(E) { ({ codeBlockLines, commentLines, DS_PRELUDE, isTemplatePlaceholder, readIfExists, specsRoot, steeringFrontMatter, toPosix } = E); }

const BP_DEFAULT = [320, 390, 768, 1024, 1440]; // the review's default set
// (1.39, BS-2) under `partial`, the default set fills the places the theme's own widths leave, in this order: tablet, laptop,
// desktop, then the phone — under any Tailwind theme 390 is the floor's layout (its narrowest is 640): on 308 real partial themes
// it never captured one more layout, so it goes last, where it keeps an uncapped theme's widths 1.38's
const BP_FILL = [768, 1024, 1440, 390];
const BP_FLOOR = 320; // a width below it is the floor's (captured anyway) — the floor is always the first width
const BP_CEIL = 3840; // a width above it is not read (`unread`)
const BP_WIDTHS = 6; // widths the review captures (ui-review.md: one dispatch of images per view) — past them the narrowest
// BP_WIDTHS - 1 and the widest, said
const BP_UNREAD = 5; // unread breakpoints listed (`unreadTotal` counts them all)
const BP_LINE = 200; // characters of ui.md's Breakpoints value read — past them, said
const BP_EM = 16; // px per rem / em in a media query (the initial font size, whatever the page sets)
const UI_FILE = "ui.md"; // (the +ui steering file — TRACK_STEERING.ui)

// --- ui.md's line ----------------------------------------------------------------------------------------------------------------
// `- Breakpoints: …` — a list item (`-`, `*`, `+`), the label in any case, emphasis marks around it (`- **Breakpoints:** …`)
const RE_UI_LINE = /^[ \t]*[-*+][ \t]+[*_]{0,2}breakpoints[*_]{0,2}[ \t]*:(.*)$/i;
// the value's end: the first `·` no length follows (blanks skipped — a no-break space too, U+00A0 / U+202F, the ones a thousands
// group takes: 1.39, R2-BS-3) — `320 · 390 · 768 px`, as the CLI prints the widths, is a list; the stub's ` · text expansion …`
// (RTL · locale formats) ends it
const RE_UI_END = /·(?![ \t\u00a0\u202f]*\.?\d)/;
const RE_UI_SLOT = /\[[^\]]*(?:\]|$)/g; // the stub's `[360 / 768 / 1280 px]` — what a `[` opens, closed or not
// (1.39, BS-6) the slot's own place: a CLOSED `[…]` that opens the value — after the label's closing emphasis marks and blanks —
// whose text is no template's (isTemplatePlaceholder, the placeholder gate's own predicate: the stub's `[360 / 768 / 1280 px]` is
// one, in every language) is the team's filled value, its lengths read; every other `[…]` stays the slot, closed or not (an aside,
// `480 / 960 px [1200 in print]`, is never a width)
const RE_UI_FILLED = /^[*_]{0,2}[ \t]*\[([^\]]*)\]/;
// a length: a thousands group (`1.280`, `1,440`, `2 560` with a no-break space — one digit before it, a width being ≤ 3840, three
// after; never a plain blank: `360 768 1280` is a list) or a number — then px / rem / em, or none
const RE_UI_LENGTH = /(?:(\d)[.,\u00a0\u202f](\d{3})(?!\d)|(\d+(?:\.\d+)?|\.\d+))(?:[ \t]*(px|rem|em))?/gi;
const RE_CUT_TOKEN = /[\w.,]+$/; // what the bound cut in two: a number's first digits are no number
const edge = Math.ceil; // a min edge in whole CSS px (767.5px → 768; a rem / em × 16 that is a whole number is exact)
// The lengths a value writes → [{ px, text }]: a unit written after the number, else the next one written (`360 / 768 / 1280 px`,
// `30 / 48 / 80 rem`), else px; a thousands group before px or no unit is an integer, before rem / em a decimal (`1.250rem`).
function uiLengths(value) {
  const found = [];
  for (const m of value.matchAll(RE_UI_LENGTH)) {
    const unit = m[4] ? m[4].toLowerCase() : null;
    const n = m[1] == null ? parseFloat(m[3]) : unit === "rem" || unit === "em" ? parseFloat(m[1] + "." + m[2]) : Number(m[1] + m[2]);
    found.push({ n, unit, text: m[0] });
  }
  let next = "px";
  for (let i = found.length - 1; i >= 0; i--) { if (found[i].unit) next = found[i].unit; else found[i].unit = next; }
  return found.map((x) => ({ px: edge(x.n * (x.unit === "px" ? 1 : BP_EM)), text: x.text }));
}
// .specs/steering/ui.md's FIRST `- Breakpoints:` line, outside its front matter, fenced / indented code and HTML comments →
// null (no file, no line) | { widths (px, in [BP_FLOOR, BP_CEIL]), unread ([{ name, value, at }]: wider than BP_CEIL), at (file:line,
// the file's own line number), cut (its value was longer than BP_LINE) }
function uiBreakpoints(root) {
  const file = path.join(specsRoot(root), "steering", UI_FILE);
  const raw = readIfExists(file);
  if (raw == null) return null;
  const body = steeringFrontMatter(raw).body.split(/\r?\n/);
  const skip = raw.split(/\r?\n/).length - body.length; // the front matter's lines (and the blank ones after it)
  // (line for line: a comment over lines leaves its lines blank, so a line number is the file's)
  const vis = commentLines(body).map((c) => (c.hidden ? "" : c.vis));
  const code = codeBlockLines(vis);
  for (let i = 0; i < vis.length; i++) {
    const m = code[i] ? null : RE_UI_LINE.exec(vis[i]);
    if (!m) continue;
    const at = toPosix(path.relative(root, file)) + ":" + (skip + i + 1);
    const dot = m[1].search(RE_UI_END);
    let value = (dot === -1 ? m[1] : m[1].slice(0, dot)).trimEnd();
    const cut = value.length > BP_LINE;
    if (cut) { const on = /[\w.,]/.test(value[BP_LINE]); value = value.slice(0, BP_LINE); if (on) value = value.replace(RE_CUT_TOKEN, ""); }
    const widths = [], unread = [];
    const filled = RE_UI_FILLED.exec(value);
    const read = filled && !isTemplatePlaceholder(filled[1]) ? filled[1] + " " + value.slice(filled[0].length).replace(RE_UI_SLOT, " ") : value.replace(RE_UI_SLOT, " ");
    for (const x of uiLengths(read)) {
      if (x.px > BP_CEIL) unread.push({ name: "Breakpoints", value: x.text, at });
      else if (x.px >= BP_FLOOR) widths.push(x.px);
    }
    return { widths, unread, at, cut };
  }
  return null;
}

// --- Tailwind 4's @theme, through the token walk -------------------------------------------------------------------------------
const RE_THEME = /^@theme(?:\s+[a-z]+)*$/; // a block's whole prelude: `@theme` and its options (inline, static, reference, default)
const RE_BP_DECL = /^--breakpoint-([A-Za-z0-9_-]+)\s*:\s*(.*)$/; // (a statement's text: its lines joined by a blank, trimmed)
const RE_BP_RESET = /^--(?:breakpoint-)?\*\s*:\s*initial$/; // the namespace's reset, or the whole theme's
const RE_BP_LENGTH = /^(\d+(?:\.\d+)?|\.\d+)(px|rem|em)$/i;
// a length → CSS px, unrounded (`0`, px, rem / em × 16) | null — and its min edge (lengthPx)
const lengthOf = (v) => { if (v === "0") return 0; const m = RE_BP_LENGTH.exec(v); return m ? parseFloat(m[1]) * (m[2].toLowerCase() === "px" ? 1 : BP_EM) : null; };
const lengthPx = (v) => { const L = lengthOf(v); return L == null ? null : edge(L); };
// --- a Sass map named …breakpoints, through the same walk (1.39) -----------------------------------------------------------------
// A TOP-LEVEL assignment, in a .scss sheet the walk reads, of a variable whose LAST `-` / `_` word is `breakpoints` (Bootstrap 5's
// `$grid-breakpoints`, Bootstrap 6's and sass-mq's `$breakpoints` — never `$spacers`, a 0-led map of lengths too, nor
// `$grid-breakpoints-custom`): plain, `!default`, or an override of `@use … with (…)` / `@forward … with (…)`. A record per
// assignment → { name, line, def (a `!default` one), px (its entries' min edges: `0`, a px / rem / em length ≤ BP_CEIL), bad
// (its first BP_UNREAD unread, [{ name, value }]), badTotal (all of them — 1.39.0 review 1, BU-1: a hostile line holds hundreds,
// and no entry past a record's first BP_UNREAD can be among the report's first) }:
//   a literal map — `(xs: 0, sm: 576px, …)`, keys quoted or not, to its own `)` — its entries; an entry that is no such length
//     (`md: $tablet`, a unitless `750`, `5000px`) unread as `$name.key`; an entry that opens a map (Bulma's `"mobile": ("until":
//     $tablet)`) makes the whole map no breakpoints (nothing, nothing unread);
//   a list — `(mobile, tablet)` (no key), `"a" "b"` — nothing;
//   anything else — a variable, a function (`map-merge(…)`, `map.merge(…)`) — one unread, as the Tailwind reader's;
//   a declaration over lines (the walk's `open` event, then the rest of it): completed ONLY by the very next event when that is
//     a statement at the top level — any other event first (another open, a block, a nested statement, the file's end) means the
//     walk dropped the rest (each `with` override is a declaration of its own: Dashticz's map then `$container-max-widths` never
//     reaches the map's statement, and the container's 540 / 720 must never be read as breakpoints) → one unread (CRIT_3
//     must-fix 1). A text of DS_PRELUDE characters is one the walk may have cut → one unread, never misread (a one-line map that
//     long loses its NAME to the cut: silent, said in the notes).
// Precedence, per name (codeBreakpoints): a plain or `with` assignment sets aside the `!default` ones, read or not; otherwise
// all count; names unite. A map is whole: `partial` stays Tailwind's alone.
const RE_SASS_FILE = /\.scss$/i;
const RE_SASS_NAME = /^\$(?:[\w-]*[-_])?breakpoints$/;
const RE_SASS_ASSIGN = /^(\$[\w-]+)\s*:([\s\S]*)$/; // a variable assigned: its name, its value (the rest)
const RE_SASS_USE = /^@(?:use|forward)(?![\w-])/, RE_SASS_WITH = /\swith\s*\(/;
const RE_SASS_DEFAULT = /!default(?![\w-])/;
const RE_SASS_EXPR = /[$(]/; // a value that is no literal list: a variable, a function
const RE_QUOTED = /^(["'])(.*)\1$/;
// The parenthesised group opening `s` at `i` → its parts at its own depth (cut at its commas) | null (it never closes in `s`).
// Linear: one pass, quotes skipped.
function parenGroup(s, i) {
  const parts = [];
  let depth = 0, from = i + 1, quote = "";
  for (let k = i; k < s.length; k++) {
    const ch = s[k];
    if (quote) { if (ch === quote) quote = ""; continue; }
    if (ch === "\"" || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") { if (--depth === 0) { parts.push(s.slice(from, k)); return parts; } }
    else if (ch === "," && depth === 1) { parts.push(s.slice(from, k)); from = k + 1; }
  }
  return null;
}
// One assignment's value as written → its record (above)
function sassValue(name, value, line) {
  const rec = { name, line, def: RE_SASS_DEFAULT.test(value), px: [], bad: [], badTotal: 0 };
  const v = value.trim();
  if (v[0] !== "(") { if (RE_SASS_EXPR.test(v)) { rec.bad.push({ name, value: v }); rec.badTotal = 1; } return rec; }
  const group = parenGroup(v, 0);
  if (!group) { rec.bad.push({ name, value: v }); rec.badTotal = 1; return rec; }
  let map = null; // (asked of the first entry: a key makes it a map, none a list)
  for (const part of group) {
    const p = part.trim();
    if (!p) continue;
    const c = p.indexOf(":");
    if (map == null) map = c >= 0;
    if (!map) return rec; // a list: no width
    const val = c < 0 ? "" : p.slice(c + 1).trim();
    if (val[0] === "(") return { name, line, def: rec.def, px: [], bad: [], badTotal: 0 }; // a nested map: no breakpoint widths
    const px = lengthPx(val);
    if (px != null && px <= BP_CEIL) rec.px.push(px);
    else if (rec.badTotal++ < BP_UNREAD) rec.bad.push({ name: name + "." + (c < 0 ? p : p.slice(0, c)).trim().replace(RE_QUOTED, "$2"), value: val });
  }
  return rec;
}
// what the walk did not deliver whole (voided, or cut at DS_PRELUDE) → one unread
const sassUnread = (name, value, line) => ({ name, line, def: RE_SASS_DEFAULT.test(value), px: [], bad: [{ name, value: (value.trim() + " …").trim() }], badTotal: 1 });
const sassVoid = (file) => { const p = file.open; if (p) { file.open = null; file.maps.push(sassUnread(p.name, p.value, p.line)); } };
function sassOpen(file, e) {
  sassVoid(file);
  if (e.block !== 0 || !RE_SASS_NAME.test(e.name)) return;
  const v = e.value.trim();
  // its value now when its line closes the map (an override's `(…),`: whole within what the walk delivered), else pending
  if (v[0] === "(" && parenGroup(v, 0)) file.maps.push(sassValue(e.name, v, e.line));
  else file.open = { name: e.name, value: e.value, line: e.line };
}
// (the statement completing a pending open is the very next event: one after a top-level open at a block's depth follows that
// block's event, which voided it — as a close does)
function sassStatement(file, e) {
  if (file.open) {
    const p = file.open;
    if (p.value.length >= DS_PRELUDE || e.text.length >= DS_PRELUDE) { sassVoid(file); return; } // (a part the walk may have cut)
    file.open = null;
    file.maps.push(sassValue(p.name, p.value + " " + e.text, p.line));
    return;
  }
  if (e.block !== 0) return;
  const a = RE_SASS_ASSIGN.exec(e.text);
  if (a) { if (RE_SASS_NAME.test(a[1])) file.maps.push(e.text.length >= DS_PRELUDE ? sassUnread(a[1], a[2], e.from) : sassValue(a[1], a[2], e.from)); return; }
  if (e.text.length >= DS_PRELUDE || !RE_SASS_USE.test(e.text)) return;
  const w = e.text.search(RE_SASS_WITH), group = w < 0 ? null : parenGroup(e.text, e.text.indexOf("(", w));
  for (const part of group || []) { const o = RE_SASS_ASSIGN.exec(part.trim()); if (o && RE_SASS_NAME.test(o[1])) file.maps.push(sassValue(o[1], o[2], e.from)); }
}

// --- @custom-media, through the same walk (1.40) — read only when no theme and no map gives a width --------------------------------
// A TOP-LEVEL `@custom-media --name <query>;` (Media Queries 5 — PostCSS / Lightning CSS), in a sheet the walk reads, → the width
// EDGES its query names: the first whole CSS px where its answer changes. A lower bound — `min-width: L`, `L <= width`,
// `width >= L`, and a strict upper one, `width < L` — changes at ceil(L); an upper bound — `max-width: L`, `width <= L`, and a
// strict lower one, `width > L` — at floor(L) + 1 (`max-width: 767px` and `767.98px` both change at 768). An alias list, never
// the set (a team names what it reuses; the rest sit in plain @media rules): its widths are partial, the default set fills.
// Every definition counts — no per-name map (1 of 160 sampled files restates a name, its em set in rem).
const RE_CM = /^@custom-media\s+(--[\w-]+)\s+([\s\S]+)$/;
const RE_MQ_OP = /<=|>=|<|>|=/g;
const upEdge = (L) => Math.floor(L) + 1; // an upper bound's edge: the first whole px past it
// A group's own text (each group nested in it one `§`) → its edges pushed to `out`; true when a width feature's value is no
// length (`30ch`, `calc(…)` — `calc§` —, `var(…)`, a unitless number). Another feature (height, orientation, `prefers-*`,
// `min-device-width`, an alias `(--x)`) or an exact width (`width: 600px`, `width = 600px`): no edge, nothing unread.
function mqGroup(t, out) {
  const c = t.indexOf(":");
  if (c >= 0) {
    const f = t.slice(0, c).trim().toLowerCase();
    if (f !== "min-width" && f !== "max-width") return false;
    const L = lengthOf(t.slice(c + 1).trim());
    if (L == null) return true;
    out.push(f === "min-width" ? edge(L) : upEdge(L));
    return false;
  }
  // a range: `L op width`, `width op L`, `L op width op L` (more parts: no range)
  const parts = t.split(RE_MQ_OP), at = parts.findIndex((p) => p.trim().toLowerCase() === "width");
  if (at < 0 || parts.length > 3) return false;
  const ops = t.match(RE_MQ_OP);
  if (ops.includes("=")) return false;
  for (let k = 0; k < parts.length; k++) {
    if (k === at) continue;
    const L = lengthOf(parts[k].trim());
    if (L == null) return true;
    const op = k < at ? ops[k] : ops[k - 1];
    const lower = k < at ? op[0] === "<" : op[0] === ">"; // (L < width, width > L: the width's lower bound)
    out.push(lower === (op.length === 1) ? upEdge(L) : edge(L)); // (a strict lower or a non-strict upper bound: past L)
  }
  return false;
}
// A query → { px: its edges, bad: a width feature it could not read }; parentheses that do not pair (an unclosed group, a stray
// `)`): bad, no edge. Linear: each character joins the own text of one open group, a nested group as one `§`.
function mediaEdges(q) {
  const px = [], open = []; // the own text so far of each open group, innermost last
  let bad = false, from = 0;
  for (let i = 0; i < q.length; i++) {
    const ch = q[i];
    if (ch === "(") { if (open.length) open[open.length - 1] += q.slice(from, i) + "§"; open.push(""); from = i + 1; }
    else if (ch === ")") {
      if (!open.length) return { px: [], bad: true };
      if (mqGroup(open.pop() + q.slice(from, i), px)) bad = true;
      from = i + 1;
    }
  }
  return open.length ? { px: [], bad: true } : { px, bad };
}
// One top-level statement → the sheet's record { widths (a Set: the edges in [BP_FLOOR, BP_CEIL] — ≤ 3,521), first (the line of
// the first rule with an edge ≤ BP_CEIL), bad (its first BP_UNREAD unread, [{ name, value: the query, line }]), badTotal }: a rule
// with a width it could not read, an edge past BP_CEIL or unpaired parentheses is one unread (its other edges read); a text of
// DS_PRELUDE characters — one the walk may have cut, keeping its end — one unread, nothing read (a longer rule arrives without
// its head: silent, as a Sass one-line map)
function mediaStatement(rec, e) {
  const m = RE_CM.exec(e.text);
  if (!m) return;
  const miss = (value) => { if (rec.badTotal++ < BP_UNREAD) rec.bad.push({ name: m[1], value, line: e.from }); };
  if (e.text.length >= DS_PRELUDE) { miss(m[2] + " …"); return; }
  const q = mediaEdges(m[2]);
  let bad = q.bad;
  for (const px of q.px) {
    if (px > BP_CEIL) { bad = true; continue; }
    if (rec.first == null) rec.first = e.from;
    if (px >= BP_FLOOR) rec.widths.add(px);
  }
  if (bad) miss(m[2]);
}

// The observer the token walk carries (design-system.js scanCode — the report's scan alone) → { on(rel, text): one stylesheet's
// observer — none when its text holds no `@theme`, no `@custom-media` and it is no .scss holding `breakpoints` (the walk then
// builds no event) —, found: { files: [{ rel, decls: Map name → { value, line }, maps: [Sass records], open, media: the
// custom-media record | null }], reset } }. Read: a top-level `@theme` block's OWN `--breakpoint-<name>` declarations (Tailwind 4
// declares its theme at the top level: a nested one is not read), the last of a name kept; `--breakpoint-<name>: initial` drops
// that name, `--breakpoint-*: initial` / `--*: initial` every one the file declared above it (and `reset`: Tailwind's own five
// are gone); (1.39) the Sass maps above; (1.40) the top-level `@custom-media` rules (lower case, as every sampled file writes it).
function breakpointWatch() {
  const found = { files: [], reset: false };
  const on = (rel, text) => {
    // (pre-tests: the walk builds an event per statement for an observer)
    const theme = text.includes("@theme"), sass = RE_SASS_FILE.test(rel) && text.includes("breakpoints"), cm = text.includes("@custom-media");
    if (!theme && !sass && !cm) return null;
    const themes = new Set(), decls = new Map(), file = { rel, decls, maps: [], open: null, media: cm ? { widths: new Set(), first: null, bad: [], badTotal: 0 } : null };
    found.files.push(file);
    const observer = {
      block: (e) => { if (sass) sassVoid(file); if (e.parent === 0 && RE_THEME.test(e.prelude)) themes.add(e.id); },
      statement: (e) => {
        if (sass) sassStatement(file, e);
        if (cm && e.block === 0) mediaStatement(file.media, e);
        if (!themes.has(e.block)) return;
        if (RE_BP_RESET.test(e.text)) { decls.clear(); found.reset = true; return; }
        const m = RE_BP_DECL.exec(e.text);
        if (!m) return;
        decls.delete(m[1]); // (the map's order stays the lines' order: the first declaration is the first kept)
        if (m[2] !== "initial") decls.set(m[1], { value: m[2], line: e.from });
      },
    };
    if (sass) observer.open = (e) => sassOpen(file, e); // (no close handler: see sassStatement)
    return observer;
  };
  return { on, found };
}
// What the walk saw → { widths (px, in [BP_FLOOR, BP_CEIL]), unread (the first BP_UNREAD), unreadTotal (all of them), at (the first
// declaration KEPT with a length, file:line — the files in the walk's order, a file's Tailwind declarations before its Sass maps:
// no sheet holds both), partial (a Tailwind width read and no reset anywhere — never a Sass map's) }. (1.39.0 review 1, BU-1: the
// unread are counted, never all kept — a hostile sheet holds ~10^5 of them, and spreading them threw.) (1.40) When no theme and
// no map gave a width, the custom-media records decide — their edges united, their unread after the theme's and the maps', `at`
// the first rule with an edge (the files in the walk's order), `partial` (an alias list); beside a width they are never asked
// (CRIT_5 must-fix 1: every 1.39 shape whole — a reset theme, a map, its `at` and its unread).
function codeBreakpoints(found) {
  const widths = [], unread = [];
  let unreadTotal = 0;
  const miss = (name, value, at) => { if (unreadTotal++ < BP_UNREAD) unread.push({ name, value, at }); };
  const files = found ? found.files : [];
  // (an open the file's end left pending is voided — the walk delivered no rest)
  const mapsOf = (f) => (f.open ? [...f.maps, sassUnread(f.open.name, f.open.value, f.open.line)] : f.maps);
  const plain = new Set(); // per name, a plain or `with` assignment sets aside the `!default` ones, read or not (CRIT_3 must-fix 2)
  for (const f of files) for (const m of mapsOf(f)) if (!m.def) plain.add(m.name);
  let at = null, tailwind = false;
  for (const f of files) {
    for (const [name, d] of f.decls) {
      const px = lengthPx(d.value), where = f.rel + ":" + d.line;
      if (px == null || px > BP_CEIL) { miss("--breakpoint-" + name, d.value, where); continue; }
      if (at == null) at = where;
      if (px >= BP_FLOOR) { widths.push(px); tailwind = true; }
    }
    for (const m of mapsOf(f)) {
      if (m.def && plain.has(m.name)) continue;
      const where = f.rel + ":" + m.line;
      for (const b of m.bad) miss(b.name, b.value, where);
      unreadTotal += m.badTotal - m.bad.length; // (the record's past its first BP_UNREAD: counted — the list is full by then)
      if (m.px.length && at == null) at = where;
      for (const px of m.px) if (px >= BP_FLOOR) widths.push(px);
    }
  }
  let partial = tailwind && !found.reset; // (asked only when a width was read)
  if (!widths.length) {
    let first = null;
    for (const f of files) {
      const r = f.media;
      if (!r) continue;
      for (const b of r.bad) miss(b.name, b.value, f.rel + ":" + b.line);
      unreadTotal += r.badTotal - r.bad.length;
      if (first == null && r.first != null) first = f.rel + ":" + r.first;
      for (const px of r.widths) widths.push(px);
    }
    if (widths.length) { at = first; partial = true; }
  }
  return { widths, unread, unreadTotal, at, partial };
}

// spec_scan {designSystem: true}'s `breakpoints` (both shapes) → { widths (ascending, BP_FLOOR first, BP_WIDTHS at most), from:
// "ui.md" | "code" | "default", partial (the code's widths, then the default set where room is left: Tailwind keeps its own five
// too; 1.40, an alias list is never the set), at (the source's first place, file:line — null for the default set), unread (the first BP_UNREAD — [{ name, value, at }]:
// a value that is no length, or wider than BP_CEIL — of the sources read: never the code's when ui.md decides), unreadTotal,
// limits ([{ code, read, … }]: breakpoint-widths {count, first} — the source's own widths past BP_WIDTHS, the first one left out
// (never a default one the fill had no room for); breakpoint-line {at} — ui.md's value longer than BP_LINE) }. `found`: what the
// scan's walk saw (breakpointWatch's). Its limits never join the report's (`limits`, `truncated`, `inSync`): they bound the
// widths, not the registry's comparison.
function breakpointsReport(projectDir, found) {
  const ui = uiBreakpoints(path.resolve(projectDir));
  const unread = [], limits = [];
  let from = "default", partial = false, at = null, widths = BP_DEFAULT, unreadTotal = 0;
  // a source's unread joined one by one — never a spread, whose arguments a large list overflows (1.39.0 review 1, BU-1) —, its
  // first ones while BP_UNREAD leaves room, all counted
  const join = (list, total) => { for (const u of list) { if (unread.length >= BP_UNREAD) break; unread.push(u); } unreadTotal += total; };
  if (ui) { join(ui.unread, ui.unread.length); if (ui.cut) limits.push({ code: "breakpoint-line", read: BP_LINE, at: ui.at }); }
  if (ui && ui.widths.length) { from = "ui.md"; at = ui.at; widths = ui.widths; } else {
    const code = codeBreakpoints(found);
    join(code.unread, code.unreadTotal);
    if (code.widths.length) { from = "code"; at = code.at; partial = code.partial; widths = code.widths; }
  }
  // the source's own widths first — past BP_WIDTHS the narrowest BP_WIDTHS - 1 and the widest, the rest said —, then under
  // `partial` the default set in BP_FILL's order, where room is left (1.39, BS-2: a theme's declared width is never one left out
  // for a default one)
  const asc = (a, b) => a - b;
  const all = [...new Set([BP_FLOOR, ...widths])].sort(asc);
  const kept = all.length > BP_WIDTHS ? [...all.slice(0, BP_WIDTHS - 1), all[all.length - 1]] : all;
  if (kept.length < all.length) limits.push({ code: "breakpoint-widths", read: BP_WIDTHS, count: all.length - kept.length, first: all[BP_WIDTHS - 1] });
  if (partial) { for (const w of BP_FILL) if (kept.length < BP_WIDTHS && !kept.includes(w)) kept.push(w); kept.sort(asc); }
  return { widths: kept, from, partial, at, unread, unreadTotal, limits };
}

// (codeBreakpoints: its bound's own fixture, BP-crash; mediaEdges: its table's, BP-media-edges)
module.exports = { breakpointWatch, breakpointsReport, codeBreakpoints, mediaEdges, __link };
