"use strict";

/**
 * dev-spec-driven engine — the project's breakpoints (1.38): the widths the visual review captures, spec_scan {designSystem:
 * true}'s `breakpoints` (the project's report and a feature's alike — never spec_finish's part, never the seed). The first source
 * that gives a width wins:
 *   ui.md   — .specs/steering/ui.md's `- Breakpoints:` line (every +ui stub holds it, under that label in EN / PT / ES): its value
 *             up to the first `·`, a `[…]` slot left unread — the team's standard, fingerprinted into the approvals;
 *   code    — Tailwind 4's `--breakpoint-<name>` in a top-level `@theme` block of a stylesheet the token scan reads, through the
 *             observer that walk carries (never a second walk); `partial` when no `--breakpoint-*: initial` / `--*: initial`
 *             reset them — Tailwind keeps its own then, which the engine never assumes (stale data): the default set joins;
 *   default — 320 · 390 · 768 · 1024 · 1440.
 * Not read (1.39, or never): a Sass map, `@custom-media`, a file named for breakpoints, a JS config (Tailwind 3's `screens`).
 * A width is a min edge in CSS px (rem / em × 16 — a media query's em is the initial font size), 320 first — WCAG 1.4.10's
 * reflow width, 1280 at 400 % —, BP_WIDTHS at most. Bounded, linear in what it reads, read-only.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js. LAZY (the tier): design-system.js
 * calls it.
 */
const path = require("path");
// Owned by other engine modules — used at call time only; engine/index.js links them once the tier has loaded.
let codeBlockLines, commentLines, readIfExists, specsRoot, steeringFrontMatter, toPosix;
function __link(E) { ({ codeBlockLines, commentLines, readIfExists, specsRoot, steeringFrontMatter, toPosix } = E); }

const BP_DEFAULT = [320, 390, 768, 1024, 1440]; // the review's default set
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
const RE_UI_LINE = /^[ \t]*[-*+][ \t]+[*_]{0,2}breakpoints[*_]{0,2}[ \t]*:[*_]{0,2}[ \t]*(.*)$/i;
const RE_UI_SLOT = /\[[^\]]*(?:\]|$)/g; // the stub's `[360 / 768 / 1280 px]` — what a `[` opens, closed or not
// a length: a thousands group (`1.280`, `1,440`, `2 560` with a no-break space — one digit before it: a width is ≤ 3840) or a
// number — then px / rem / em, or none
const RE_UI_LENGTH = /(?:(?<![\d.,])(\d)[.,\u00a0\u202f](\d{3})(?!\d)|(?<![\d.])(\d+(?:\.\d+)?|\.\d+)(?!\d|\.\d))(?:[ \t]*(px|rem|em)(?![a-z]))?/gi;
const RE_CUT_TOKEN = /[\w.,]+$/; // what the bound cut in two: a number's first digits are no number
// a min edge in whole CSS px (767.5px → 768), its float noise rounded away first
const edge = (px) => Math.ceil(Math.round(px * 1000) / 1000);
// The lengths a value writes → [{ px, text }]: a unit written after the number, else the next one written (`360 / 768 / 1280 px`,
// `30 / 48 / 80 rem`), else px; a thousands group before px or no unit is an integer, before rem / em a decimal (`1.250rem`).
function uiLengths(value) {
  const found = [];
  for (const m of value.matchAll(RE_UI_LENGTH)) {
    const unit = m[4] ? m[4].toLowerCase() : null;
    const n = m[1] == null ? parseFloat(m[3]) : unit === "rem" || unit === "em" ? parseFloat(m[1] + "." + m[2]) : Number(m[1] + m[2]);
    found.push({ n, unit, text: m[0].trim() });
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
  if (raw == null || !/breakpoints/i.test(raw)) return null;
  const body = steeringFrontMatter(raw).body.split(/\r?\n/);
  const skip = raw.split(/\r?\n/).length - body.length; // the front matter's lines (and the blank ones after it)
  // (line for line: a comment over lines leaves its lines blank, so a line number is the file's)
  const vis = commentLines(body).map((c) => (c.hidden ? "" : c.vis));
  const code = codeBlockLines(vis);
  for (let i = 0; i < vis.length; i++) {
    const m = code[i] ? null : RE_UI_LINE.exec(vis[i]);
    if (!m) continue;
    const at = toPosix(path.relative(root, file)) + ":" + (skip + i + 1);
    const dot = m[1].indexOf("·"); // (the stub goes on past one: text expansion · RTL · locale formats)
    let value = (dot === -1 ? m[1] : m[1].slice(0, dot)).trimEnd();
    const cut = value.length > BP_LINE;
    if (cut) { const on = /[\w.,]/.test(value[BP_LINE]); value = value.slice(0, BP_LINE); if (on) value = value.replace(RE_CUT_TOKEN, ""); }
    const widths = [], unread = [];
    for (const x of uiLengths(value.replace(RE_UI_SLOT, " "))) {
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
const lengthPx = (v) => { if (v === "0") return 0; const m = RE_BP_LENGTH.exec(v); return m ? edge(parseFloat(m[1]) * (m[2].toLowerCase() === "px" ? 1 : BP_EM)) : null; };
// The observer the token walk carries (design-system.js scanCode — the report's scan alone) → { on(rel, text): one stylesheet's
// observer — none when its text holds no `@theme` (the walk then builds no event) —, found: { files: [{ rel, decls: Map name →
// { value, line } }], reset } }. Read: a top-level `@theme` block's OWN `--breakpoint-<name>` declarations (Tailwind 4 declares
// its theme at the top level: a nested one is not read), the last of a name kept; `--breakpoint-<name>: initial` drops that name, `--breakpoint-*: initial` / `--*:
// initial` every one the file declared above it (and `reset`: Tailwind's own five are gone).
function breakpointWatch() {
  const found = { files: [], reset: false };
  const on = (rel, text) => {
    if (text == null || !text.includes("@theme")) return null;
    const themes = new Set(), decls = new Map();
    found.files.push({ rel, decls });
    return {
      block: (e) => { if (e.parent === 0 && RE_THEME.test(e.prelude)) themes.add(e.id); },
      statement: (e) => {
        if (!themes.has(e.block)) return;
        if (RE_BP_RESET.test(e.text)) { decls.clear(); found.reset = true; return; }
        const m = RE_BP_DECL.exec(e.text);
        if (!m) return;
        decls.delete(m[1]); // (the map's order stays the lines' order: the first declaration is the first kept)
        if (m[2] !== "initial") decls.set(m[1], { value: m[2], line: e.from });
      },
    };
  };
  return { on, found };
}
// What the walk saw → { widths (px, in [BP_FLOOR, BP_CEIL]), unread, at (the first declaration with a length, file:line), partial }
function codeBreakpoints(found) {
  const widths = [], unread = [];
  let at = null;
  for (const f of found ? found.files : []) for (const [name, d] of f.decls) {
    const px = lengthPx(d.value), where = f.rel + ":" + d.line;
    if (px == null || px > BP_CEIL) { unread.push({ name: "--breakpoint-" + name, value: d.value, at: where }); continue; }
    if (at == null) at = where;
    if (px >= BP_FLOOR) widths.push(px);
  }
  return { widths, unread, at, partial: at != null && !found.reset };
}

// spec_scan {designSystem: true}'s `breakpoints` (both shapes) → { widths (ascending, BP_FLOOR first, BP_WIDTHS at most), from:
// "ui.md" | "code" | "default", partial (the code's widths and the default set: Tailwind keeps its own five too), at (the source's
// first place, file:line — null for the default set), unread (the first BP_UNREAD — [{ name, value, at }]: a value that is no
// length, or wider than BP_CEIL — of the sources read: never the code's when ui.md decides), unreadTotal, limits ([{ code, read,
// … }]: breakpoint-widths {count, first} — widths past BP_WIDTHS, the first one left out; breakpoint-line {at} — ui.md's value
// longer than BP_LINE) }. `found`: what the scan's walk saw (breakpointWatch's). Its limits never join the report's (`limits`,
// `truncated`, `inSync`): they bound the widths, not the registry's comparison.
function breakpointsReport(projectDir, found) {
  const ui = uiBreakpoints(path.resolve(projectDir));
  const unread = [], limits = [];
  let from = "default", partial = false, at = null, widths = BP_DEFAULT;
  if (ui) { unread.push(...ui.unread); if (ui.cut) limits.push({ code: "breakpoint-line", read: BP_LINE, at: ui.at }); }
  if (ui && ui.widths.length) { from = "ui.md"; at = ui.at; widths = ui.widths; } else {
    const code = codeBreakpoints(found);
    unread.push(...code.unread);
    if (code.widths.length) { from = "code"; at = code.at; partial = code.partial; widths = partial ? [...code.widths, ...BP_DEFAULT] : code.widths; }
  }
  const all = [...new Set([BP_FLOOR, ...widths])].sort((a, b) => a - b);
  const kept = all.length > BP_WIDTHS ? [...all.slice(0, BP_WIDTHS - 1), all[all.length - 1]] : all;
  if (kept.length < all.length) limits.push({ code: "breakpoint-widths", read: BP_WIDTHS, count: all.length - kept.length, first: all[BP_WIDTHS - 1] });
  return { widths: kept, from, partial, at, unread: unread.slice(0, BP_UNREAD), unreadTotal: unread.length, limits };
}

module.exports = { breakpointWatch, breakpointsReport, __link };
