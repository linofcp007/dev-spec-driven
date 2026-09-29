"use strict";

/**
 * dev-spec-driven engine — exports: the stakeholder document, Gherkin, tracker CSV, release notes, milestones.
 * spec_export's documents (offline HTML or markdown: a zero-dep renderer that escapes every text run, the feature /
 * project document model), EARS criteria as Gherkin scenarios, tasks as tracker CSV rows (jira | linear),
 * spec_changelog (from the spec data only) and spec_milestone (roadmap.json meta.milestones).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { B, E } = require("./trace.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, acOneLine, activeDesign, activeTasks, atxHeading, backtickRuns, BOM_CHAR, buildTraceMatrix, catalogData,
  changedSinceApproval, clarificationMarkers, cleanTaskText, closesFence, csvRecord, day, designSections, detectPhase,
  detectTracks, dirKey, existingFeature, extractAcIds, extractSection, fcDay, fcIso, featureDirs, featureLang,
  featurePercent, fenceStep, flatText, flowOfState, forecastData, headingIndex, headRest, htmlEsc, indentOf,
  isApprovalRecord, isGeneratedOrAbsent, isObj, isRecord, listFeatures, markerTracks, matrixCsv, maybeRefreshRoadmap,
  normalizeLang, own, pendingGateList, PHASE_FILE, phaseActive, phaseFile, PHASES, placeholderReport, projectLang,
  RE_FENCE, RE_LIST_ITEM, readContained, readRoadmap, replaceCodeSpans, requirementIndex, resolveSupersedes, roadmap,
  roadmapError, ROOT_CAUSE_SYN, rtmMarkdown, rtmProjectMarkdown, sectionFirstParagraph, sha1Hex, SIZE_POINTS, slugify,
  specsRoot, SPIKE_FILE, spikeInfo, stateFromFile, statePath, statusFeature, storyContext, stripEnd, stripEnds,
  stripHtmlComments, supersededByIndex, supersedesMarkers, taskBlocks, taskProse, taskSize, timeOf, trackAcIds,
  trackLabel, trackMarker, verificationStatus, withoutTaskMarkers, withRoadmapLock, writeFileAtomic, writeRoadmap,
  wsOrUnitIn;
function __link(E) { ({ acIndex, acOneLine, activeDesign, activeTasks, atxHeading, backtickRuns, BOM_CHAR,
  buildTraceMatrix, catalogData, changedSinceApproval, clarificationMarkers, cleanTaskText, closesFence, csvRecord, day,
  designSections, detectPhase, detectTracks, dirKey, existingFeature, extractAcIds, extractSection, fcDay, fcIso,
  featureDirs, featureLang, featurePercent, fenceStep, flatText, flowOfState, forecastData, headingIndex, headRest,
  htmlEsc, indentOf, isApprovalRecord, isGeneratedOrAbsent, isObj, isRecord, listFeatures, markerTracks, matrixCsv,
  maybeRefreshRoadmap, normalizeLang, own, pendingGateList, PHASE_FILE, phaseActive, phaseFile, PHASES,
  placeholderReport, projectLang, RE_FENCE, RE_LIST_ITEM, readContained, readRoadmap, replaceCodeSpans,
  requirementIndex, resolveSupersedes, roadmap, roadmapError, ROOT_CAUSE_SYN, rtmMarkdown, rtmProjectMarkdown,
  sectionFirstParagraph, sha1Hex, SIZE_POINTS, slugify, specsRoot, SPIKE_FILE, spikeInfo, stateFromFile, statePath,
  statusFeature, storyContext, stripEnd, stripEnds, stripHtmlComments, supersededByIndex, supersedesMarkers, taskBlocks,
  taskProse, taskSize, timeOf, trackAcIds, trackLabel, trackMarker, verificationStatus, withoutTaskMarkers,
  withRoadmapLock, writeFileAtomic, writeRoadmap, wsOrUnitIn } = E); }

// ---------------------------------------------------------------------------
// 1.14 B2 — stakeholder export (spec_export) · release notes from the specs (spec_changelog)
// ---------------------------------------------------------------------------

// .specs/exports/ holds spec_export's documents: a reserved name (RESERVED_SLUGS), never a feature folder.
const EXPORT_DIR = "exports";
const EXPORT_FORMATS = ["html", "md", "csv", "gherkin", "jira", "linear"]; // csv (1.14 F5): the requirements traceability matrix; 1.16 E1 gherkin, E2 jira / linear
const SUMMARY_SYN = ["summary", "resumo", "resumen"];
const SUCCESS_SYN = ["success criteria", "critérios de sucesso", "criterios de sucesso", "criterios de éxito", "criterios de exito"];

// --- markdown → HTML (zero-dep) for the subset the artifacts use ---
// Headings, paragraphs, lists (nested by indentation, task checkboxes), pipe tables, fenced code, block quotes, rules,
// inline code, **strong** / _em_ / ~~del~~ and links. EVERY text run is escaped (htmlEsc): raw HTML in a spec (a <script> in
// a criterion) is shown as text, never run. A link keeps an http(s) / mailto target only — javascript:, data:, a relative
// path keep just their text — and an image becomes its alt text: an exported document never loads anything.
// A list item → [line, indent, marker, text] | null: /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/ with its text read by headRest (1.17 H).
const expItem = (line) => headRest(line, /^(\s*)([-*+]|\d{1,9}[.)])/, true);
const RE_EXP_RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const RE_EXP_BLOCK = /^(?:#{1,6}\s|\s*\||\s{0,3}>)/; // a heading, table row or quote: ends a list at the margin
// A table's header separator row. \s*\|?\s* → \s*(?:\|\s*)? (same rows): two blank runs meeting with no pipe between them
// backtracked quadratically (1.17 H).
const RE_EXP_SEP = /^\s*(?:\|\s*)?:?-+:?\s*(?:\|\s*:?-+:?\s*)*(?:\|\s*)?$/;
function expInline(text) {
  const slots = [];
  const put = (html) => "\u0001" + (slots.push(html) - 1) + "\u0002";
  let s = String(text == null ? "" : text).replace(/[\u0001\u0002]/g, "");
  // Spans are bounded (4000 / 2000 chars): an unclosed `, * or ~~ used to rescan the rest of the paragraph from every opener.
  s = replaceCodeSpans(s, (m, tick, body) => put("<code>" + htmlEsc(body.trim()) + "</code>"), 4002); // /(`+)([^`]|[^`][\s\S]{0,4000}?[^`])\1(?!`)/g
  const target = "(<[^<>\\s]*>|[^()\\s]*(?:\\([^()\\s]*\\)[^()\\s]*)*)(?:\\s+\"[^\"]*\")?";
  // A label holds no '[' (full review Pb6): "[" × N rescanned the rest of the paragraph from every '[' — quadratic. A nested
  // "[a [b] c](url)" never matched as a whole either (its first ']' is no "](").
  s = s.replace(new RegExp("!\\[([^\\[\\]]*)\\]\\(" + target + "\\)", "g"), (m, alt) => alt);
  s = s.replace(new RegExp("\\[([^\\[\\]]+)\\]\\(" + target + "\\)", "g"), (m, label, url) => {
    const u = /^<.*>$/.test(url) ? url.slice(1, -1) : url; // only the <…> form loses its brackets (a trailing '>' is the URL's)
    return /^(?:https?:\/\/|mailto:)/i.test(u) ? put(`<a href="${htmlEsc(u)}" rel="noopener noreferrer">`) + label + put("</a>") : label;
  });
  // An entity reference is text in markdown (`&lt;!--` — how spec_decide stores a comment opener — reads "<!--"): kept as
  // is, never escaped again into a literal "&lt;". It can only ever render as a character, never as markup. After an odd run
  // of backslashes its '&' is escaped: `\&lt;` is the text "&lt;" (1.17 verification N3).
  s = s.replace(/(?<!(?:^|[^\\])(?:\\\\)*\\)&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/g, (m) => put(m));
  // Any ASCII punctuation escaped with a backslash is that character (CommonMark) — not only markup characters: an import
  // writes `US-3\.AC-1`, `T\-800`, `_Verify\:` to keep IDs and markers inert, and the export showed the backslashes (1.17
  // verification N3). After htmlEsc, an escaped `<` `>` `&` `"` reads `\&lt;` … — the backslash goes, the entity stays.
  s = htmlEsc(s)
    .replace(/\*\*(?=\S)([\s\S]{0,2000}?\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<![\p{L}\p{N}_\\])__(?=\S)([\s\S]{0,2000}?\S)__(?![\p{L}\p{N}_])/gu, "<strong>$1</strong>")
    .replace(/~~(?=\S)([\s\S]{0,2000}?\S)~~/g, "<del>$1</del>")
    .replace(/(?<![*\p{L}\p{N}\\])\*(?=[^\s*])([\s\S]{0,2000}?[^\s*\\])\*(?![*\p{L}\p{N}])/gu, "<em>$1</em>")
    .replace(/(?<![\p{L}\p{N}_\\])_(?=[^\s_])([\s\S]{0,2000}?[^\s_\\])_(?![\p{L}\p{N}_])/gu, "<em>$1</em>")
    .replace(RE_MD_ESCAPE, "$1");
  return s.replace(/\u0001(\d+)\u0002/g, (m, k) => slots[+k]);
}
// A backslash escape: `\` + one ASCII punctuation character (CommonMark's set).
const RE_MD_ESCAPE = /\\([!-/:-@[-`{-~])/g;
const MD_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: String.fromCharCode(0xa0) };
// Markdown inline text → the plain text a reader sees, for the exports that are no markdown (Gherkin, the CSV files, a page
// <title>): outside inline code spans (backtickRuns — the engine's pairing, line by line), a backslash escape is its character
// and an entity reference (&lt; &gt; &amp; &quot; &apos; &nbsp;, &#n; &#xh;) its character — an unknown name, and a numeric one
// naming a control character or a line separator (the outputs are line-based), stay as written.
// A code span is kept whole, backticks included (nothing is decoded inside one). Markup (emphasis, links) is left as it is.
// Linear: one pass per line, each code span skipped once (1.17 verification N3 — the Gherkin export printed `NFR\-2`,
// `US-3\.AC-1` and `&lt;!--` that the importer writes to keep IDs and comment openers inert).
function mdPlainText(s) {
  const text = String(s == null ? "" : s);
  if (!text.includes("\\") && !text.includes("&")) return text;
  return text.split("\n").map((line) => {
    const ticks = line.includes("`") ? backtickRuns(line) : null;
    let out = "";
    let k = 0;
    while (k < line.length) {
      const c = line[k];
      if (c === "`" && ticks) { const e = ticks.spanEnd(k); out += line.slice(k, e); k = e; continue; }
      if (c === "\\" && k + 1 < line.length && /[!-/:-@[-`{-~]/.test(line[k + 1])) { out += line[k + 1]; k += 2; continue; }
      if (c === "&") {
        const m = /^&(?:#([0-9]{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,31}));/.exec(line.slice(k, k + 40));
        const cp = m ? (m[1] != null ? parseInt(m[1], 10) : m[2] != null ? parseInt(m[2], 16) : null) : null;
        // a numeric reference to a control character or a line / paragraph separator stays as written: the output is line-based
        const ch = !m ? null : cp != null ? (cp >= 0x20 && cp <= 0x10ffff && !(cp >= 0x7f && cp <= 0x9f) && cp !== 0x2028 && cp !== 0x2029 && (cp < 0xd800 || cp > 0xdfff) ? String.fromCodePoint(cp) : null)
          : own(MD_ENTITIES, m[3]) ? MD_ENTITIES[m[3]] : null;
        if (ch != null) { out += ch; k += m[0].length; continue; }
      }
      const j = nextPlainStop(line, k + 1);
      out += line.slice(k, j);
      k = j;
    }
    return out;
  }).join("\n");
}
// The next index at or after `from` holding a character mdPlainText acts on (` \ &), else the line's length.
function nextPlainStop(line, from) {
  for (let i = from; i < line.length; i++) { const c = line[i]; if (c === "`" || c === "\\" || c === "&") return i; }
  return line.length;
}
// A fenced block from its opener at lines[i] → { html, next }. As fenceStep reads it: a fence opened inside a list item
// (indented) ends with that item — a non-blank line less indented than its opener.
function expFence(lines, i) {
  const mark = lines[i].match(RE_FENCE)[1];
  const ind = indentOf(lines[i]);
  const info = (lines[i].trim().slice(mark.length).trim().split(/\s+/)[0] || "").replace(/[^\w+-]/g, "");
  const body = [];
  let j = i + 1;
  let closed = false;
  for (; j < lines.length; j++) {
    if (closesFence(lines[j], mark)) { closed = true; break; }
    if (ind > 0 && lines[j].trim() && indentOf(lines[j]) < ind) break;
    body.push(ind ? lines[j].replace(new RegExp("^ {0," + ind + "}"), "") : lines[j]);
  }
  return { html: `<pre${info ? ` class="lang-${info}"` : ""}><code>${htmlEsc(body.join("\n"))}</code></pre>`, next: closed ? j + 1 : j };
}
// A table row's cells: outer pipes dropped, `\|` kept (expInline unescapes it), a `|` inside inline code is no separator.
function expCells(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  let code = false;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === "\\" && s[k + 1] === "|") { cur += "\\|"; k++; continue; }
    if (c === "`") code = !code;
    if (c === "|" && !code) { cells.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}
function expTable(rows) {
  const sep = rows.length > 1 && rows[1].includes("|") && RE_EXP_SEP.test(rows[1]);
  const head = sep ? expCells(rows[0]) : null;
  const body = (sep ? rows.slice(2) : rows).map(expCells);
  const width = Math.max(head ? head.length : 0, ...body.map((r) => r.length));
  const tr = (cells, tag) => "<tr>" + Array.from({ length: width }, (_, k) => `<${tag}>${expInline(cells[k] || "")}</${tag}>`).join("") + "</tr>";
  return `<div class="tw"><table>${head ? "<thead>" + tr(head, "th") + "</thead>" : ""}<tbody>${body.map((r) => tr(r, "td")).join("")}</tbody></table></div>`;
}
// A list from its first item at lines[i] → { html, next }: nested by indentation; a continuation line (indented, or lazy
// right after an item) joins its item; a blank line then text at the margin — or a heading / table / quote / rule / fence
// at the margin — ends it.
function expList(lines, i) {
  const items = [];
  let cur = null;
  let blank = false;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { blank = true; continue; }
    const m = expItem(line);
    if (m && !RE_EXP_RULE.test(line)) {
      cur = { indent: indentOf(m[1]), ordered: /\d/.test(m[2]), start: parseInt(m[2], 10), text: [m[3]], extra: [] };
      items.push(cur);
      blank = false;
      continue;
    }
    const ind = indentOf(line);
    if (ind < 2 && (blank || RE_EXP_BLOCK.test(line) || RE_EXP_RULE.test(line) || RE_FENCE.test(line))) break;
    if (RE_FENCE.test(line)) { const f = expFence(lines, i); cur.extra.push(f.html); i = f.next - 1; blank = false; continue; }
    cur.text.push(line.trim());
    blank = false;
  }
  let html = "";
  const stack = [];
  for (const it of items) {
    while (stack.length && it.indent < stack[stack.length - 1].indent) html += "</li></" + stack.pop().tag + ">";
    const top = stack[stack.length - 1];
    const tag = it.ordered ? "ol" : "ul";
    const open = `<${tag}${it.ordered && it.start !== 1 ? ` start="${it.start}"` : ""}>`;
    if (!top || it.indent > top.indent) { html += open; stack.push({ indent: it.indent, tag }); }
    else if (top.tag !== tag) { html += "</li></" + stack.pop().tag + ">" + open; stack.push({ indent: it.indent, tag }); }
    else html += "</li>";
    const text = it.text.join(" ");
    const cb = text.match(/^\[([ xX])\](?:\s+|$)/);
    html += cb ? `<li class="task"><span class="cb">${cb[1] === " " ? "☐" : "☑"}</span> ${expInline(text.slice(cb[0].length))}` : `<li>${expInline(text)}`;
    html += it.extra.join("");
  }
  while (stack.length) html += "</li></" + stack.pop().tag + ">";
  return { html, next: i };
}
function expBlocks(lines) {
  const out = [];
  let para = [];
  // A soft line break stays a space — except after a hard break (two trailing spaces, a backslash) and before a line that
  // opens with a bold label: spec prose writes "**As a** …" / "**Why P1:** …" / "**Independent Test:** …" one per line.
  const flush = () => {
    if (!para.length) return;
    let joined = "";
    para.forEach((l, k) => {
      if (k) joined += para[k - 1].endsWith("  ") || para[k - 1].endsWith("\\") || /^\s*(?:\*\*|__)/.test(l) ? "\u0003" : " "; // / {2,}$|\\$/ rescanned a blank run
      joined += l.trim().replace(/\\$/, "");
    });
    out.push("<p>" + expInline(joined).replace(/\u0003/g, "<br>") + "</p>");
    para = [];
  };
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { flush(); i++; continue; }
    if (RE_FENCE.test(line)) { flush(); const f = expFence(lines, i); out.push(f.html); i = f.next; continue; }
    const h = atxHeading(line, 1, 6, "closing"); // /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/
    if (h) { flush(); out.push(`<h${h.level}>${expInline(h.text)}</h${h.level}>`); i++; continue; }
    if (RE_EXP_RULE.test(line)) { flush(); out.push("<hr>"); i++; continue; }
    if (/^\s*\|/.test(line)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      out.push(expTable(rows));
      continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      flush();
      const inner = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) inner.push(lines[i++].replace(/^\s{0,3}>\s?/, ""));
      out.push("<blockquote>" + expBlocks(inner) + "</blockquote>");
      continue;
    }
    if (expItem(line)) { flush(); const l = expList(lines, i); out.push(l.html); i = l.next; continue; }
    para.push(line);
    i++;
  }
  flush();
  return out.join("\n");
}
// markdown → escaped HTML (HTML comments — template guidance — dropped, like every reader of the artifacts).
function markdownToHtml(md) {
  let text = String(md == null ? "" : md);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return expBlocks(stripHtmlComments(text.replace(/\u0003/g, "")).replace(/\r\n?/g, "\n").split("\n"));
}

// --- the document model: { lang, scope, title, kicker, lead, autogen, meta: [[label, value]], blocks: [{ id?, cls?, h, md, children? }] } ---

// A markdown fragment with its headings moved so the top one sits at level `top` (fenced code untouched): an artifact's own
// `## Section` nested under the export's headings.
function shiftHeadings(md, top) {
  const lines = String(md == null ? "" : md).split("\n");
  const st = { fence: null };
  const heads = [];
  lines.forEach((l, i) => { if (!fenceStep(st, l) && /^#{1,6}\s/.test(l)) heads.push(i); });
  if (!heads.length) return lines.join("\n");
  const lvl = (i) => lines[i].match(/^#+/)[0].length;
  const d = top - Math.min(...heads.map(lvl));
  for (const i of heads) { const n = lvl(i); lines[i] = "#".repeat(Math.max(1, Math.min(6, n + d))) + lines[i].slice(n); }
  return lines.join("\n");
}
// A run of blank lines (a removed HTML comment leaves one) folded to one — never inside fenced code.
function squeezeBlankLines(text) {
  const st = { fence: null };
  const out = [];
  for (const l of String(text == null ? "" : text).split("\n")) {
    if (!fenceStep(st, l) && !l.trim() && out.length && !out[out.length - 1].trim()) continue;
    out.push(l);
  }
  return out.join("\n");
}
// An artifact's body for the document: BOM, HTML comments and its own `# Title` line dropped.
function artifactBody(text) {
  let t = String(text == null ? "" : text);
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const lines = stripHtmlComments(t).replace(/\r\n?/g, "\n").split("\n");
  const first = lines.findIndex((l) => l.trim());
  if (first >= 0 && /^#\s/.test(lines[first])) lines.splice(first, 1);
  return squeezeBlankLines(lines.join("\n")).trim();
}
// A section's text (comments dropped), or null when it is missing, empty or still one [bracketed placeholder].
function sectionText(md, synonyms) {
  const body = extractSection(md || "", synonyms);
  if (body == null) return null;
  const t = stripHtmlComments(body).trim();
  return t && !/^\[[^\]]*\]$/.test(t) ? t : null;
}
// The name an artifact's `# Feature: <name>` / `# Bugfix: <name>` title gives, else the slug.
function specTitle(text, slug) {
  const lines = stripHtmlComments(text || "").split(/\r?\n/);
  const i = headingIndex(lines).find((k) => /^#\s/.test(lines[k]));
  if (i == null) return slug;
  const t = lines[i].replace(/^#\s+/, "").trim();
  const c = t.indexOf(": ");
  const name = (c >= 0 ? t.slice(c + 2) : t).trim();
  return name && !/^\[[^\]]*\]$/.test(name) ? name : slug;
}
// "Title" when the title slugs to the folder name, else "Title (slug)".
const titledSlug = (title, slug) => (slugify(title) === slug ? title : `${title} (${slug})`);
const mdCell = (s) => String(s == null ? "" : s).replace(/(?<!\\)\|/g, "\\|").replace(/(?<!\s)\s*\r?\n\s*/g, " "); // (?<!\s): 1.17 H
const utcStamp = (v) => { const t = timeOf(v); return t == null ? "—" : new Date(t).toISOString().slice(0, 16).replace("T", " ") + " UTC"; };
const italic = (s) => `_${s}_`;

// One acceptance criterion as a list line: its whole EARS text (the ID and a _Supersedes:_ marker dropped from the text),
// struck through when a later feature supersedes it, and flagged while it is still template text.
function exportAcLine(a, mark, X) {
  const code = (s) => "`" + s + "`";
  const body = `**${a.id}** — ${acOneLine(a.text, a.id, Infinity)}`;
  let line = mark && mark.supersedePending ? `- ${body} — ${X.toBeSupersededBy(mark.supersededBy.map(code).join(", "))}` // not shipped yet
    : mark && mark.supersededBy ? `- ~~${body}~~ — ${X.supersededBy(mark.supersededBy.map(code).join(", "))}` : `- ${body}`;
  if (mark && mark.supersedes) line += ` _(${X.supersedes(mark.supersedes.map(code).join(", "))})_`;
  if (placeholderReport(a.text).length) line += ` _(${X.template})_`;
  return line;
}
// The user stories in document order (a `### US-n` heading, else the first AC of US-n), each with its intro paragraphs
// (As a … / Why P1 / Independent Test — up to its first list item) and its ACs → blocks.
function exportStories(reqs, X, marks) {
  const acs = [...acIndex(reqs).values()].sort((a, b) => a.line - b.line);
  const order = [];
  const seen = new Set();
  const lines = stripHtmlComments(reqs).split(/\r?\n/);
  for (const k of headingIndex(lines)) {
    const m = lines[k].match(/^#{1,6}\s+US-(\d+)(?!\d)/);
    if (m && !seen.has(m[1])) { seen.add(m[1]); order.push(m[1]); }
  }
  for (const a of acs) { const n = a.id.match(/^US-(\d+)/)[1]; if (!seen.has(n)) { seen.add(n); order.push(n); } }
  return order.map((n) => {
    const ctx = storyContext(reqs, n);
    const intro = [];
    for (const l of ctx ? ctx.slice(1) : []) { if (RE_LIST_ITEM.test(l) || /^\|/.test(l)) break; intro.push(l); }
    const list = acs.filter((a) => a.id.startsWith(`US-${n}.`)).map((a) => exportAcLine(a, marks.get(a.id), X));
    return { h: ctx ? ctx[0] : `US-${n}`, md: [intro.join("\n\n"), list.join("\n")].filter(Boolean).join("\n\n") || italic(X.none) };
  });
}
// requirements.md's other `##` sections (success criteria, edge cases, NFRs, out of scope, assumptions …) — not the
// summary nor the user stories, which the document shows its own way.
function requirementSections(reqs) {
  return designSections(reqs).filter((s) => {
    const t = s.title.toLowerCase();
    if (SUMMARY_SYN.some((x) => t.startsWith(x))) return false;
    // the stories: their wrapper section, or a story written as a `## US-n` section itself
    if (/^#{2,6}\s+US-\d/m.test(s.body) || /^(?:user stor|hist[óo]rias?(?![\p{L}])|us-\d)/iu.test(t)) return false;
    return !!s.body.trim();
  });
}

function exportFeatureDoc(projectDir, f, lang, cat) {
  const M = i18n.msg(lang);
  const X = M.stakeholderExport;
  const P = M.phaseNames || {};
  const { slug, dir } = f;
  const read = (n) => readContained(projectDir, path.join(dir, n)); // a linked artifact is skipped, never copied out
  const tracks = detectTracks(dir);
  const st = stateFromFile(projectDir, statePath(dir));
  const kind = st.kind === "bugfix" || st.kind === "spike" ? st.kind : "feature"; // 1.14 C2: + spike
  const SP = M.spike;
  const reqRaw = read("requirements.md") || "";
  const reqs = activeDesign(reqRaw, tracks); // a removed track's [SaaS]/[AI]/… criteria are inactive — not part of the spec
  const status = statusFeature(projectDir, slug);
  const tasks = status.ok ? status.tasks.list : [];
  const done = tasks.filter((t) => t.done).length;
  const phase = status.ok ? status.phase : detectPhase(dir, tracks);
  const catF = cat.features.find((x) => x.feature === slug && !x.archived);
  const marks = new Map((catF ? catF.acs : []).map((a) => [a.id, a]));
  const meta = [[X.meta.id, "`" + slug + "`"], [X.meta.kind, X.kind[kind] || SP.kind], [X.meta.tracks, trackLabel(tracks)], [X.meta.phase, P[phase] || phase],
    [X.meta.progress, X.progress(done, tasks.length, featurePercent(phase, done, tasks.length, flowOfState(st)))]]; // + the flow (C3); a spike's kind label (C2)
  if (catF) meta.push([X.meta.status, M.catalog.status[catF.status] + (catF.finishedAt ? " · " + day(catF.finishedAt) : "")]);
  meta.push([X.meta.lang, lang]);

  const blocks = [];
  const bugText = kind === "bugfix" ? read("bug.md") : null;
  const spikeText = kind === "spike" ? read(SPIKE_FILE) : null; // 1.14 C2: a spike — its question is the summary, spike.md its body
  const summary = sectionText(reqs, SUMMARY_SYN) || (bugText != null ? sectionText(bugText, SUMMARY_SYN) : null) || (kind === "spike" ? spikeInfo(dir).question : null);
  blocks.push({ id: "summary", h: X.sections.summary, md: summary || italic(X.noSummary) });
  if (kind !== "spike") {
    const stories = exportStories(reqs, X, marks);
    blocks.push({ id: "stories", h: X.sections.stories, md: stories.length ? "" : italic(X.noStories), children: stories });
  }
  requirementSections(reqs).forEach((s, k) => blocks.push({ id: "req-" + (k + 1), h: s.title, md: s.body }));
  if (spikeText != null) {
    const secs = designSections(spikeText);
    blocks.push({ id: "spike", h: SP.exportSection, md: secs.length ? "" : italic(X.none), children: secs.map((s) => ({ h: s.title, md: s.body || italic(X.none) })) });
  }
  if (bugText != null) { // a bugfix's design: bug.md (reproduction · expected vs actual · root cause · fix · regression test)
    const secs = designSections(bugText).filter((s) => !(summary && SUMMARY_SYN.some((x) => s.title.toLowerCase().startsWith(x))));
    blocks.push({ id: "bug", h: X.sections.bug, md: secs.length ? "" : italic(X.none), children: secs.map((s) => ({ h: s.title, md: s.body || italic(X.none) })) });
  }
  const design = read("design.md");
  const dsecs = design == null ? [] : designSections(activeDesign(design, tracks));
  if (kind === "feature" || dsecs.length) {
    blocks.push({ id: "design", h: X.sections.design, md: dsecs.length ? "" : italic(X.noDesign), children: dsecs.map((s) => ({ h: s.title, md: s.body || italic(X.none) })) });
  }
  const plan = phaseActive("test-plan", tracks) ? read("test-plan.md") : null;
  if (plan != null) blocks.push({ id: "test-plan", h: X.sections.testPlan, md: artifactBody(plan) || italic(X.none) });

  // Tasks — done / open, and the verification verdict doctor and spec_finish give (with the localized reason).
  const vs = verificationStatus(projectDir, slug, dir);
  const why = new Map(vs.unverifiedDetail.map((d) => [d.number, d.specChanged ? M.impact.staleSpec : d.unticked ? M.undo.label : M.evidenceGate.reason[d.reason] || d.reason]));
  const taskRows = tasks.map((t) => {
    const v = !t.done ? X.verification.open : why.has(t.number) ? X.verification.unverified(why.get(t.number)) : t.nothingToVerify ? X.verification.nothing : X.verification.verified;
    return `| ${t.number} | ${mdCell(cleanTaskText(t.text))} | ${t.done ? X.taskStatus.done : X.taskStatus.open} | ${mdCell(v)} |`;
  });
  const head = (cols) => `| ${cols.join(" | ")} |\n|${cols.map(() => "---").join("|")}|\n`;
  blocks.push({ id: "tasks", h: X.sections.tasks, md: taskRows.length ? head(X.cols.task) + taskRows.join("\n") : italic(X.noTasks) });
  // 1.14 F5 — the requirements traceability matrix: one row per AC / EC / NFR / SC (a spike has no requirements).
  if (kind !== "spike") blocks.push({ id: "rtm", h: M.rtm.title, md: rtmMarkdown(buildTraceMatrix(projectDir, f), lang) });
  const dec = read("decisions.md");
  if (dec != null) blocks.push({ id: "decisions", h: X.sections.decisions, md: artifactBody(dec) || italic(X.none) });

  // Approvals — who / when per phase, forced ones, those whose artifact changed since, and the phases still awaiting one.
  const approvals = isRecord(st.approvals) ? st.approvals : {};
  // Changed by CONTENT only, as spec_finish reads it: a pre-1.11 approval judged by file date is no evidence (a clone resets it).
  const cs = changedSinceApproval(dir, approvals, tracks, kind, { detail: true });
  const changed = cs.changed.filter((x) => !cs.byDate.includes(x));
  const pending = new Set(pendingGateList(dir, tracks, kind, approvals));
  const aRows = [];
  for (const p of PHASES) {
    const a = approvals[p];
    if (isRecord(a)) {
      const notes = [];
      if (a.forced === true) notes.push(X.forced((Array.isArray(a.failing) ? a.failing.join(", ") : "") || "—"));
      if (PHASE_FILE[p] && (changed.includes(phaseFile(p, kind)) || (p === "design" && changed.includes("design.md")))) notes.push(X.changedSince);
      aRows.push(`| ${X.phases[p]} | ${mdCell(a.by == null ? "—" : String(a.by))} | ${utcStamp(a.at)} | ${mdCell(notes.join("; ") || "—")} |`);
    } else if (pending.has(p)) aRows.push(`| ${X.phases[p]} | — | — | ${X.pending} |`);
  }
  blocks.push({ id: "approvals", h: X.sections.approvals, md: aRows.length ? head(X.cols.approval) + aRows.join("\n") : italic(X.noApprovals) });

  // Open clarifications — every [NEEDS CLARIFICATION] still in the spec (outside HTML comments), with its file.
  const clar = [];
  for (const file of ["requirements.md", "bug.md", "design.md"]) {
    const t = file === "requirements.md" ? reqs : read(file);
    if (t == null) continue;
    for (const q of clarificationMarkers(file === "design.md" ? activeDesign(t, tracks) : t)) clar.push(`- \`${file}\` — ${q || "[NEEDS CLARIFICATION]"}`);
  }
  blocks.push({ id: "clarifications", h: X.sections.clarifications, md: clar.length ? clar.join("\n") : italic(X.noClarifications) });
  return { lang, scope: "feature", feature: slug, title: specTitle(reqRaw || spikeText || "", slug), kicker: X.kicker[kind] || SP.kicker, lead: X.generated(day(new Date().toISOString())), autogen: X.autogen, meta, blocks };
}

function exportProjectDoc(projectDir, lang, cat) {
  const M = i18n.msg(lang);
  const X = M.stakeholderExport;
  const P = M.phaseNames || {};
  const root = specsRoot(projectDir);
  const rmv = roadmap(projectDir);
  const listed = new Map(listFeatures(projectDir).features.map((x) => [x.name, x]));
  let done = 0;
  let total = 0;
  for (const x of listed.values()) { done += x.tasksDone; total += x.tasks; }
  const counts = (name) => listed.get(name) || { tasksDone: 0, tasks: 0 };
  const head = (cols) => `| ${cols.join(" | ")} |\n|${cols.map(() => "---").join("|")}|\n`;
  const rows = rmv.features.map((f) => {
    const deps = f.dependsOn.length ? f.dependsOn.map((d) => d + (f.unmetDeps.includes(d) ? " ✗" : " ✓")).join(", ") : "—";
    return `| ${f.name} | ${f.tracks} | ${P[f.phase] || f.phase} | ${f.percent}% | ${counts(f.name).tasksDone}/${counts(f.name).tasks} | ${mdCell(deps)} |`;
  });
  const blocks = [{ id: "roadmap", h: X.sections.roadmap, md: rows.length ? head(X.cols.roadmap) + rows.join("\n") : italic(X.noFeatures),
    children: rmv.backlog.length ? [{ h: X.sections.backlog, md: rmv.backlog.map((b) => `- **${flatText(b.name)}**${b.note ? " — " + flatText(b.note) : ""}`).join("\n") }] : [] }];
  // 1.14 F5 — traceability at a glance: each active feature's requirement count by matrix status.
  blocks.push({ id: "rtm", h: M.rtm.projectTitle, md: rtmProjectMarkdown(projectDir, lang, rmv.features.map((f) => ({ slug: f.name, dir: path.join(root, f.name) }))) });
  // Every active feature's requirements digest — summary, stories with their ACs, success criteria — on its own page.
  for (const f of rmv.features) {
    const dir = path.join(root, f.name);
    const tracks = detectTracks(dir);
    const kind = f.kind === "bugfix" || f.kind === "spike" ? f.kind : "feature"; // 1.14 C2: + spike (its question is the summary)
    const reqRaw = readContained(projectDir, path.join(dir, "requirements.md")) || "";
    const reqs = activeDesign(reqRaw, tracks);
    const c = counts(f.name);
    const catF = cat.features.find((x) => x.feature === f.name && !x.archived);
    const summary = sectionText(reqs, SUMMARY_SYN) || (kind === "bugfix" ? sectionText(readContained(projectDir, path.join(dir, "bug.md")), SUMMARY_SYN) : null) ||
      (kind === "spike" ? spikeInfo(dir).question : null);
    const line = [X.kind[kind] || M.spike.kind, f.tracks, P[f.phase] || f.phase, X.progress(c.tasksDone, c.tasks, f.percent)].concat(f.blocked ? [X.blocked(f.unmetDeps.join(", "))] : []).join(" · ");
    const stories = exportStories(reqs, X, new Map((catF ? catF.acs : []).map((a) => [a.id, a])));
    const sc = sectionText(reqs, SUCCESS_SYN);
    blocks.push({ id: "f-" + f.name, cls: "feature", h: titledSlug(specTitle(reqRaw, f.name), f.name), md: italic(line) + "\n\n" + (summary || italic(X.noSummary)),
      children: (kind === "spike" ? [] : [{ h: X.sections.stories, md: stories.length ? "" : italic(X.noStories), children: stories }]).concat(sc ? [{ h: X.sections.successCriteria, md: sc }] : []) });
  }
  // The living catalog, once the project keeps one (.specs/SPECS.md) — rendered fresh, archived features and superseded ACs included.
  if (fs.existsSync(path.join(root, "SPECS.md"))) blocks.push({ id: "catalog", cls: "feature", h: X.sections.catalog, md: artifactBody(cat.markdown) });
  const meta = [[X.meta.overall, X.overall(rmv.overallPercent, rmv.complete, rmv.total, done, total)], [X.meta.lang, lang]];
  return { lang, scope: "project", features: rmv.features.map((f) => f.name), title: X.projectTitle(path.basename(path.resolve(projectDir))), kicker: X.kicker.project,
    lead: X.generated(day(new Date().toISOString())), autogen: X.autogen, meta, blocks };
}

function exportMd(doc) {
  let md = `# ${doc.title}\n\n<!-- ${doc.autogen} -->\n\n_${doc.kicker} · ${doc.lead}_\n\n` + doc.meta.map(([k, v]) => `- **${k}:** ${v}`).join("\n") + "\n";
  const walk = (b, level) => {
    md += `\n${"#".repeat(Math.min(6, level))} ${b.h}\n`;
    if (b.md && b.md.trim()) md += "\n" + squeezeBlankLines(shiftHeadings(b.md.trim(), level + 1)) + "\n";
    (b.children || []).forEach((c) => walk(c, level + 1));
  };
  doc.blocks.forEach((b) => walk(b, 2));
  return md;
}

// The brand palette and light/dark of ROADMAP.html (system default + a toggle), plus print rules: light on paper, no
// buttons, a page break before every feature. Nothing external — no font, script or stylesheet URL.
const EXPORT_CSS = `:root{ --brand:#11689B; --accent:#00AAFF; --accent2:#4A90E2;
  --bg:#040405; --bg2:#0A0A0C; --bg3:#121216; --text:#FFFFFF; --muted:#8A91A5; --border:rgba(74,144,226,.18); }
:root[data-theme="light"]{ --bg:#F8F9FA; --bg2:#FFFFFF; --bg3:#E9ECEF; --text:#1A1D20; --muted:#6C757D; --border:rgba(17,104,155,.18); }
@media (prefers-color-scheme: light){ :root:not([data-theme]){ --bg:#F8F9FA; --bg2:#FFFFFF; --bg3:#E9ECEF; --text:#1A1D20; --muted:#6C757D; --border:rgba(17,104,155,.18); } }
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:'Outfit',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55}
.wrap{max-width:980px;margin:0 auto;padding:28px 20px 64px}
header{border-bottom:2px solid var(--brand);padding-bottom:14px}
.top{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap} .spacer{flex:1}
.kicker{color:var(--accent);font-size:.76rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
h1{font-size:1.7rem;margin:4px 0 2px;line-height:1.25} .lead{color:var(--muted);font-size:.88rem}
.btn{cursor:pointer;border:1px solid var(--border);background:var(--bg2);color:var(--text);border-radius:999px;padding:7px 14px;font:inherit;font-size:.85rem}
.btn:hover{border-color:var(--brand)}
dl.meta{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin:18px 0}
dl.meta div{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:8px 12px}
dt{color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.05em} dd{margin:2px 0 0;font-weight:600}
nav.toc{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:10px 16px;margin:14px 0}
nav.toc ol{margin:6px 0 0;padding-left:22px} nav.toc a{color:var(--accent);text-decoration:none}
h2{font-size:1.25rem;color:var(--accent);border-bottom:1px solid var(--border);padding-bottom:6px;margin:32px 0 10px}
h3{font-size:1.05rem;margin:22px 0 8px} h4,h5,h6{font-size:.95rem;margin:16px 0 6px;color:var(--accent2)}
p{margin:8px 0} ul,ol{padding-left:24px;margin:8px 0} li{margin:3px 0} li.task{list-style:none;margin-left:-20px} .cb{display:inline-block;width:1.3em}
blockquote{margin:10px 0;padding:6px 14px;border-left:3px solid var(--brand);background:var(--bg3);border-radius:0 8px 8px 0}
code{font-family:ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;font-size:.86em;background:var(--bg3);padding:1px 5px;border-radius:5px}
pre{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;overflow:auto} pre code{background:none;padding:0}
.tw{overflow-x:auto;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:.88rem;background:var(--bg2);border:1px solid var(--border)}
th,td{text-align:left;vertical-align:top;padding:7px 10px;border-bottom:1px solid var(--border)}
th{color:var(--muted);font-size:.74rem;text-transform:uppercase;letter-spacing:.04em}
del{opacity:.7} a{color:var(--accent)} hr{border:none;border-top:1px solid var(--border);margin:18px 0}
footer{margin-top:40px;color:var(--muted);font-size:.78rem;border-top:1px solid var(--border);padding-top:12px}
@media print{
  :root,:root[data-theme]{ --bg:#FFFFFF; --bg2:#FFFFFF; --bg3:#F1F3F5; --text:#111111; --muted:#555555; --border:#D0D7DE; --accent:#11689B; --accent2:#11689B; }
  body{background:#FFFFFF;color:#111111;font-size:10.5pt}
  .wrap{max-width:none;padding:0}
  .no-print{display:none !important}
  section.feature{break-before:page;page-break-before:always}
  h1,h2,h3,h4{break-after:avoid;page-break-after:avoid}
  tr,pre,blockquote,li,dl.meta div{break-inside:avoid;page-break-inside:avoid}
  .tw{overflow:visible} pre{white-space:pre-wrap;word-break:break-word}
  a{color:inherit;text-decoration:none}
  @page{margin:16mm}
}`;
const EXPORT_JS = `(function(){
  var k="dev-spec-theme", r=document.documentElement, t=document.getElementById("tg"), p=document.getElementById("pr");
  try { var s=localStorage.getItem(k); if (s==="light"||s==="dark") r.setAttribute("data-theme", s); } catch (e) {}
  if (t) t.addEventListener("click", function(){
    var cur=r.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    var nx=cur==="light" ? "dark" : "light";
    r.setAttribute("data-theme", nx);
    try { localStorage.setItem(k, nx); } catch (e) {}
  });
  if (p) p.addEventListener("click", function(){ window.print(); });
})();`;
function exportHtml(doc) {
  const X = i18n.msg(doc.lang).stakeholderExport;
  const blocks = doc.blocks.map((b, k) => ({ ...b, id: "s-" + (b.id || String(k + 1)) }));
  const section = (b, level) => {
    const n = Math.min(6, level);
    const body = b.md && b.md.trim() ? markdownToHtml(shiftHeadings(b.md.trim(), level + 1)) : "";
    const kids = (b.children || []).map((c) => section(c, level + 1)).join("\n");
    return `<section${b.cls ? ` class="${b.cls}"` : ""}${b.id ? ` id="${htmlEsc(b.id)}"` : ""}>\n<h${n}>${expInline(b.h)}</h${n}>\n${body}${kids ? "\n" + kids : ""}\n</section>`;
  };
  return `<!doctype html>
<!-- ${htmlEsc(doc.autogen)} -->
<html lang="${normalizeLang(doc.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="dev-spec">
<title>${htmlEsc(mdPlainText(doc.title))} — ${htmlEsc(doc.kicker)}</title>
<style>
${EXPORT_CSS}
</style>
</head>
<body><div class="wrap">
<header><div class="top">
<div><div class="kicker">${htmlEsc(doc.kicker)}</div><h1>${expInline(doc.title)}</h1><div class="lead">${htmlEsc(doc.lead)}</div></div>
<span class="spacer"></span>
<div class="no-print"><button class="btn" id="tg" type="button" aria-label="${htmlEsc(X.theme)}">◐ ${htmlEsc(X.theme)}</button> <button class="btn" id="pr" type="button">⎙ ${htmlEsc(X.print)}</button></div>
</div></header>
<dl class="meta">
${doc.meta.map(([k, v]) => `<div><dt>${htmlEsc(k)}</dt><dd>${expInline(v)}</dd></div>`).join("\n")}
</dl>
<nav class="toc"><b>${htmlEsc(X.sections.contents)}</b><ol>
${blocks.map((b) => `<li><a href="#${htmlEsc(b.id)}">${expInline(b.h)}</a></li>`).join("\n")}
</ol></nav>
<main>
${blocks.map((b) => section(b, 2)).join("\n")}
</main>
<footer>${htmlEsc(doc.autogen)}</footer>
</div>
<script>
${EXPORT_JS}
</script>
</body>
</html>
`;
}

// spec_export {name?, format?, write?} / `dev-spec export [feature] [--md] [--write]`: one self-contained document for
// stakeholders — a feature (in its language) or the whole project (in the project language). Without write the content
// comes back; write puts it in .specs/exports/<slug>.<format> (project.<format>; a feature slugged 'project':
// project.feature.<format> — a dot never appears in a slug, so no feature lands on another's file) with the AUTO-GENERATED
// marker, never over a same-named file dev-spec did not generate. 1.14 F5 — format 'csv': the requirements traceability
// matrix of the feature (the project: of every active feature) as .specs/exports/<slug>.rtm.csv (project.rtm.csv;
// project.feature.rtm.csv) — matrixCsv's document form: UTF-8 BOM, the marker as its last record.
function exportSpecs(projectDir, opts = {}) {
  const pl = projectLang(projectDir);
  const fmt = opts.format == null || String(opts.format).trim() === "" ? "html" : String(opts.format).trim().toLowerCase();
  if (!EXPORT_FORMATS.includes(fmt)) {
    const A = i18n.msg(pl).args;
    return { ok: false, error: A.invalid(A.item("format", A.oneOf(EXPORT_FORMATS.join(", ")), JSON.stringify(String(opts.format)))) };
  }
  const root = specsRoot(projectDir);
  if (fmt === "gherkin") return exportGherkin(projectDir, opts, pl);
  let doc;
  let base;
  const tracker = TRACKERS.includes(fmt); // 1.16 E2 — one CSV for the tool's importer
  if (opts.name != null && String(opts.name).trim() !== "") {
    const f = existingFeature(projectDir, opts.name);
    if (!f.ok) return { ok: false, error: f.error };
    const fl = featureLang(projectDir, f.slug);
    doc = fmt === "csv" ? { lang: fl, scope: "feature", feature: f.slug, content: matrixCsv([buildTraceMatrix(projectDir, f)], fl, { document: true }) }
      : tracker ? { lang: fl, scope: "feature", feature: f.slug, records: trackerRecords(projectDir, f, fl) }
        : exportFeatureDoc(projectDir, f, fl, catalogData(projectDir));
    base = f.slug === "project" ? "project.feature" : f.slug;
  } else {
    if (!fs.existsSync(root)) return { ok: false, error: i18n.msg(pl).err.noSpecs(root) };
    if (fmt === "csv" || tracker) {
      const active = featureDirs(projectDir).filter((x) => !x.archived);
      const supBy = supersededByIndex(projectDir);
      doc = { lang: pl, scope: "project", features: active.map((x) => x.slug) };
      if (tracker) doc.records = active.flatMap((x) => trackerRecords(projectDir, x, pl, supBy));
      else doc.content = matrixCsv(active.map((x) => buildTraceMatrix(projectDir, x, { supBy })), pl, { document: true });
    } else doc = exportProjectDoc(projectDir, pl, catalogData(projectDir));
    base = "project";
  }
  if (tracker) doc.content = trackerCsv(doc.records, fmt, doc.lang);
  const content = fmt === "csv" || tracker ? doc.content : fmt === "html" ? exportHtml(doc) : exportMd(doc);
  const ext = fmt === "csv" ? "rtm.csv" : tracker ? fmt + ".csv" : fmt;
  const file = path.join(root, EXPORT_DIR, base + "." + ext);
  const res = { ok: true, scope: doc.scope, format: fmt, lang: doc.lang, file, wrote: false };
  if (doc.scope === "feature") res.feature = doc.feature; else res.features = doc.features;
  if (tracker) res.records = doc.records.length; // work items: features + stories + tasks
  if (!opts.write) { res.content = content; return res; }
  const exDir = path.dirname(file);
  // A feature folder named 'exports' from before the name was reserved: never drop documents into someone's spec.
  if (["requirements.md", ".state.json"].some((n) => fs.existsSync(path.join(exDir, n)))) return { ...res, ok: false, error: i18n.msg(doc.lang).stakeholderExport.exportsIsFeature(".specs/" + EXPORT_DIR + "/") };
  if (!isGeneratedOrAbsent(file)) return { ...res, ok: false, skipped: true, error: i18n.msg(doc.lang).err.notGenerated(".specs/" + EXPORT_DIR + "/" + base + "." + ext) };
  writeFileAtomic(file, i18n.portableCli(content)); // committed: `dev-spec`, never a machine path (1.21 F3)
  return { ...res, wrote: true, bytes: Buffer.byteLength(content, "utf8") };
}
// spec_export {format: "gherkin"} (1.16 E1): a feature → .specs/exports/<slug>.feature ({content | wrote, file, bytes,
// scenarios, skipped, unsplit}); no name → one .feature per active feature (spikes skipped) as `documents` [{feature, lang,
// file, scenarios, skipped, unsplit, content | bytes}] — Gherkin holds one Feature per file. A write is all-or-nothing: a
// same-named file dev-spec did not generate refuses the whole export (named), nothing written.
function exportGherkin(projectDir, opts, pl) {
  const root = specsRoot(projectDir);
  const one = (f, supBy) => {
    const g = gherkinFeature(projectDir, f, { supBy });
    if (g.error) return g;
    return { feature: f.slug, lang: g.lang, file: path.join(root, EXPORT_DIR, gherkinBase(f.slug)), scenarios: g.scenarios, skipped: g.skipped, unsplit: g.unsplit, content: g.content };
  };
  let docs;
  let res;
  if (opts.name != null && String(opts.name).trim() !== "") {
    const f = existingFeature(projectDir, opts.name);
    if (!f.ok) return { ok: false, error: f.error };
    const d = one(f);
    if (d.error) return { ok: false, error: d.error, spike: true, feature: f.slug };
    docs = [d];
    res = { ok: true, scope: "feature", format: "gherkin", lang: d.lang, file: d.file, wrote: false, feature: d.feature, scenarios: d.scenarios, skipped: d.skipped, unsplit: d.unsplit };
  } else {
    if (!fs.existsSync(root)) return { ok: false, error: i18n.msg(pl).err.noSpecs(root) };
    const supBy = supersededByIndex(projectDir);
    docs = featureDirs(projectDir).filter((x) => !x.archived).map((x) => one(x, supBy)).filter((d) => !d.error);
    res = { ok: true, scope: "project", format: "gherkin", lang: pl, wrote: false, features: docs.map((d) => d.feature), scenarios: docs.reduce((s, d) => s + d.scenarios, 0) };
  }
  const lang = res.lang;
  if (!opts.write) {
    if (res.scope === "feature") res.content = docs[0].content;
    else res.documents = docs.map(({ feature, lang: l, file, scenarios, skipped, unsplit, content }) => ({ feature, lang: l, file, scenarios, skipped, unsplit, content }));
    return res;
  }
  const exDir = path.join(root, EXPORT_DIR);
  if (["requirements.md", ".state.json"].some((n) => fs.existsSync(path.join(exDir, n)))) return { ...res, ok: false, error: i18n.msg(lang).stakeholderExport.exportsIsFeature(".specs/" + EXPORT_DIR + "/") };
  const hand = docs.find((d) => !isGeneratedOrAbsent(d.file));
  if (hand) return { ...res, ok: false, skipped: true, error: i18n.msg(lang).err.notGenerated(".specs/" + EXPORT_DIR + "/" + path.basename(hand.file)) };
  for (const d of docs) writeFileAtomic(d.file, i18n.portableCli(d.content));
  const bytes = (d) => Buffer.byteLength(d.content, "utf8");
  if (res.scope === "feature") return { ...res, wrote: true, bytes: bytes(docs[0]) };
  return { ...res, wrote: docs.length > 0, files: docs.map((d) => d.file),
    documents: docs.map(({ feature, lang: l, file, scenarios, skipped, unsplit }, i) => ({ feature, lang: l, file, scenarios, skipped, unsplit, bytes: bytes(docs[i]) })) };
}

// ---------------------------------------------------------------------------
// 1.16 E1 — Gherkin export: spec_export {format: "gherkin"} · `dev-spec export [f] --gherkin` → .specs/exports/<slug>.feature
// ---------------------------------------------------------------------------
//
// One `Feature:` per feature (its title; the summary as the description; the active tracks as tags — a track's marker, else
// its name: @SaaS @AI @SEC @PRIVACY @tdd …), one `Scenario:` per CURRENT acceptance criterion in document order, tagged
// with its AC ID, the T-IDs the test plan plans for it (the matrix's reading) and the marker of the track that defines it.
// Left out, each with a comment saying so: a template criterion (not written yet) and one a SHIPPED feature superseded
// (1.15's rule — it no longer describes the system); one a draft plans to supersede is kept, with a comment. The steps
// ARE the EARS clauses, never invented behaviour: WHILE / WHERE / IF (ENQUANTO / ONDE / SE · MIENTRAS / DONDE / SI) →
// Given, WHEN (QUANDO / CUANDO) → When, the response (its subject + SHALL / DEVE / DEBE …) → Then, verbatim; text before the
// response with no EARS keyword (a ubiquitous criterion's context) → Given. A criterion whose clauses can't be split
// cleanly (no modal, text before the first keyword, a condition after THEN, an empty clause, no subject before the modal)
// becomes ONE Then step with its whole text (listed in `unsplit`) — never a lost word. Quoted and code spans are opaque to
// the split (a comma or a keyword inside "…" / `…` never cuts a clause). A PT / ES feature (pt-BR too) is written in
// Gherkin's own dialect: `# language: pt` / `# language: es` + its keywords (GHERKIN_DIALECT — Gherkin's tokens, not
// dev-spec prose). A spike (no acceptance criteria) has no Gherkin: named, it is refused; the project export skips it.
// `keywords`: EVERY keyword of the dialect, as Gherkin's gherkin-languages.json lists them for en / pt / es (compared with
// cucumber/gherkin main — 1.16 E review m6; step keywords without their trailing space, the "*" step aside) — the words
// the description guard checks (a summary line starting with one of them gets the summary label in front); the other
// fields are the ones the export writes.
const GHERKIN_DIALECT = {
  en: { feature: "Feature", scenario: "Scenario", given: "Given", when: "When", then: "Then", and: "And",
    keywords: { feature: ["Feature", "Business Need", "Ability"], background: ["Background"], rule: ["Rule"], scenario: ["Example", "Scenario"],
      scenarioOutline: ["Scenario Outline", "Scenario Template"], examples: ["Examples", "Scenarios"],
      given: ["Given"], when: ["When"], then: ["Then"], and: ["And"], but: ["But"] } },
  pt: { feature: "Funcionalidade", scenario: "Cenário", given: "Dado", when: "Quando", then: "Então", and: "E",
    keywords: { feature: ["Funcionalidade", "Característica", "Caracteristica"], background: ["Contexto", "Cenário de Fundo", "Cenario de Fundo", "Fundo"], rule: ["Regra"],
      scenario: ["Exemplo", "Cenário", "Cenario"], scenarioOutline: ["Esquema do Cenário", "Esquema do Cenario", "Delineação do Cenário", "Delineacao do Cenario"],
      examples: ["Exemplos", "Cenários", "Cenarios"], given: ["Dado", "Dada", "Dados", "Dadas"], when: ["Quando"], then: ["Então", "Entao"], and: ["E"], but: ["Mas"] } },
  es: { feature: "Característica", scenario: "Escenario", given: "Dado", when: "Cuando", then: "Entonces", and: "Y",
    keywords: { feature: ["Característica", "Necesidad del negocio", "Requisito"], background: ["Antecedentes"], rule: ["Regla", "Regla de negocio"],
      scenario: ["Ejemplo", "Escenario"], scenarioOutline: ["Esquema del escenario"], examples: ["Ejemplos"],
      given: ["Dado", "Dada", "Dados", "Dadas"], when: ["Cuando"], then: ["Entonces"], and: ["Y", "E"], but: ["Pero"] } },
};
const GHERKIN_BLOCK_KINDS = ["feature", "background", "rule", "scenario", "scenarioOutline", "examples"]; // "<keyword>:" lines
const GHERKIN_STEP_KINDS = ["given", "when", "then", "and", "but"]; // "<keyword> " lines
// Would this description line read as a Gherkin token in the dialect `D` (or English)? A tag, a comment, a table row, a doc
// string, a "*" step, a block keyword + ':' or a step keyword + a space (any case — the guard errs on the safe side).
function ghRiskyLine(s, D) {
  if (/^[@#|*]|^"""|^```/.test(s)) return true;
  const low = s.toLowerCase();
  const ks = (kinds) => [D, GHERKIN_DIALECT.en].flatMap((d) => kinds.flatMap((k) => d.keywords[k]));
  return ks(GHERKIN_BLOCK_KINDS).some((b) => low.startsWith(b.toLowerCase()) && /^\s*:/.test(s.slice(b.length))) ||
    ks(GHERKIN_STEP_KINDS).some((w) => low.startsWith(w.toLowerCase()) && /^\s/.test(s.slice(w.length)));
}
// The EARS condition keywords (upper-case spelling) → the step they become; THEN / ENTÃO / ENTONCES only mark the response.
const GHERKIN_COND = { WHEN: "when", QUANDO: "when", CUANDO: "when", WHILE: "given", ENQUANTO: "given", MIENTRAS: "given",
  IF: "given", SE: "given", SI: "given", WHERE: "given", ONDE: "given", DONDE: "given" };
const GHERKIN_THEN = new Set(["THEN", "ENTÃO", "ENTAO", "ENTONCES"]);
const RE_GH_KEYWORD = new RegExp(B + "(when|while|if|where|then|quando|enquanto|se|onde|então|entao|cuando|mientras|si|donde|entonces)" + E, "giu");
const RE_GH_MODAL = new RegExp(B + "(shall|dever[áa]|deve|devem|dever[ãa]o|deber[áa]|debe|deben|deber[áa]n)" + E, "iu");
const RE_GH_DET = new RegExp(B + "(the|o|a|os|as|el|la|los|las)\\s", "giu");
// Quoted ("…" “…” «…») and code (`…`) spans masked out (same length) — what the split reads; the text itself is kept.
function ghMask(s) {
  const close = { '"': '"', "“": "”", "«": "»", "`": "`" };
  let out = "";
  for (let i = 0; i < s.length;) {
    const c = close[s[i]];
    const j = c ? s.indexOf(c, i + 1) : -1;
    if (j > i) { out += s[i] + "\u0001".repeat(j - i - 1) + c; i = j + 1; continue; }
    out += s[i++];
  }
  return out;
}
// Markdown emphasis MARKUP out of a criterion (1.16 E review m5): a run of * or _ counts only when it pairs with a run of the
// same character — an opener (followed by a non-space, not preceded by a letter or digit) before a closer (preceded by a
// non-space, not followed by a letter or digit), CommonMark's flanking rules otherwise — and only its paired characters go
// (** with ** first, then * with *; a pair never crosses another). Code spans (`…`, any backtick run up to the next run of
// the same length) are opaque. Everything else is kept as written: `2**n`, `a_b_c`, `x * y`, `2*3*4`, an unpaired `**`.
// One pass over the runs, each opener popped at most once — linear.
function ghStripEmphasis(s) {
  const n = s.length;
  // code spans: each backtick run → the next run of the same length (computed right to left — linear)
  const ticks = [];
  for (let i = 0; i < n;) { if (s[i] !== "`") { i++; continue; } let j = i; while (s[j] === "`") j++; ticks.push({ at: i, end: j, len: j - i }); i = j; }
  const codeEnd = new Map(); // a span's opening index → the index after its closing run
  const nextSame = new Map();
  const partner = new Array(ticks.length).fill(-1);
  for (let k = ticks.length - 1; k >= 0; k--) { const p = nextSame.get(ticks[k].len); if (p != null) partner[k] = p; nextSame.set(ticks[k].len, k); }
  for (let k = 0; k < ticks.length;) { if (partner[k] >= 0) { codeEnd.set(ticks[k].at, ticks[partner[k]].end); const p = partner[k]; while (k < ticks.length && ticks[k].at < ticks[p].end) k++; } else k++; }
  const ws = (c) => c === undefined || /\s/u.test(c);
  const punct = (c) => c !== undefined && /[\p{P}\p{S}]/u.test(c);
  const word = (c) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
  const drop = new Uint8Array(n);
  const stacks = { "*": [], _: [] };
  for (let i = 0; i < n;) {
    if (codeEnd.has(i)) { i = codeEnd.get(i); continue; }
    const c = s[i];
    // a backslash escape (`\*`, `\_`) is a literal character, never a delimiter (1.17 verification N3 — mdPlainText drops the
    // backslash afterwards; a paired `\*x\*` was markup, and left `\x\`)
    if (c === "\\" && i + 1 < n && s[i + 1] !== "`" && /[!-/:-@[-`{-~]/.test(s[i + 1])) { i += 2; continue; }
    if (c !== "*" && c !== "_") { i++; continue; }
    let j = i;
    while (s[j] === c) j++;
    const before = s[i - 1], after = s[j];
    const left = !ws(after) && (!punct(after) || ws(before) || punct(before));
    const right = !ws(before) && (!punct(before) || ws(after) || punct(after));
    const run = { at: i, lo: i, hi: j, len: j - i };
    if (right && !word(after)) { // a closer: pair with the nearest opener of its character
      const st = stacks[c];
      while (run.len > 0 && st.length) {
        const o = st[st.length - 1];
        const use = o.len >= 2 && run.len >= 2 ? 2 : 1;
        for (let k = o.hi - use; k < o.hi; k++) drop[k] = 1;
        for (let k = run.lo; k < run.lo + use; k++) drop[k] = 1;
        o.hi -= use; o.len -= use; run.lo += use; run.len -= use;
        if (!o.len) st.pop();
        const other = stacks[c === "*" ? "_" : "*"]; // no pair crosses this one
        while (other.length && other[other.length - 1].at > o.at) other.pop();
      }
    }
    if (run.len > 0 && left && !word(before)) stacks[c].push(run);
    i = j;
  }
  let out = "";
  for (let i = 0; i < n; i++) if (!drop[i]) out += s[i];
  return out;
}
// The EARS keywords a feature's language reads: English ones in any feature, plus its own language's (an English criterion's
// "SI units" or "SE region" is no condition).
const GHERKIN_LANG_KEYWORDS = { pt: ["QUANDO", "ENQUANTO", "SE", "ONDE", "ENTÃO", "ENTAO"], es: ["CUANDO", "MIENTRAS", "SI", "DONDE", "ENTONCES"] };
// One criterion's text (acOneLine, whole) → { steps: [{ kind: "given" | "when" | "then", text }], split }. lang (optional):
// the feature's language — only English keywords and its own are read (every language's without it). Paired emphasis
// markup is dropped first (ghStripEmphasis); every other character reaches a step — the EARS keywords the Gherkin ones
// replace and the separators (spaces, commas) between clauses aside; characters before the first keyword ("(", "*") lead
// its step.
function earsSteps(raw, lang) {
  const text = ghStripEmphasis(String(raw == null ? "" : raw).replace(/\s+/g, " ").trim()).replace(/\s+/g, " ").trim();
  const whole = { steps: [{ kind: "then", text }], split: false };
  if (!text) return whole;
  const m = ghMask(text);
  const mod = m.match(RE_GH_MODAL);
  if (!mod) return whole;
  const modalAt = mod.index;
  const allowed = lang ? new Set(["WHEN", "WHILE", "IF", "WHERE", "THEN"].concat(GHERKIN_LANG_KEYWORDS[i18n.baseLang(lang)] || [])) : null;
  // The EARS keywords before the modal: any case at the very start or right after a comma (se / si only in capitals there —
  // ordinary PT / ES words), anywhere in capitals.
  const kws = [];
  const lead0 = m.search(/[^\s([{*_~]/);
  RE_GH_KEYWORD.lastIndex = 0;
  for (let k; (k = RE_GH_KEYWORD.exec(m)) && k.index < modalAt;) {
    const w = k[1];
    const up = w.toUpperCase();
    if (allowed && !allowed.has(up)) continue;
    const atStart = k.index === lead0;
    const afterComma = /,\s*$/.test(m.slice(Math.max(0, k.index - 64), k.index));
    if (w === up || atStart || (afterComma && !/^(se|si)$/i.test(w))) kws.push({ at: k.index, end: k.index + w.length, word: up, then: GHERKIN_THEN.has(up) });
  }
  const thenKw = kws.filter((k) => k.then).pop();
  const conds = kws.filter((k) => !k.then);
  if (thenKw && conds.some((c) => c.at > thenKw.at)) return whole; // a condition after THEN: no clean reading
  const from = conds.length ? conds[conds.length - 1].end : 0;
  let subj = -1;
  if (thenKw) subj = thenKw.end;
  else {
    const region = m.slice(from, modalAt);
    const comma = region.lastIndexOf(",");
    if (comma >= 0) subj = from + comma + 1;
    else if (!conds.length) subj = 0; // a ubiquitous criterion: its context is a lead set off by a comma, else there is none
    else {
      // The subject: the upper-case run right before an upper-case modal ("THE SYSTEM SHALL") — its first determiner —,
      // else the last determiner before the modal ("the system shall", "o sistema deve"); neither → no clean split.
      let runStart = modalAt;
      if (mod[1] === mod[1].toUpperCase()) {
        const trimmed = region.trimEnd(); // /\s+$/ rescanned a blank run from each of its units (1.17 H)
        const words = trimmed.split(" ");
        let end = trimmed.length;
        for (let w = words.length - 1; w >= 0 && words[w] && words[w] === words[w].toUpperCase() && /\p{Lu}/u.test(words[w]); w--) {
          runStart = from + end - words[w].length;
          end -= words[w].length + 1;
        }
      }
      const dets = [...region.matchAll(RE_GH_DET)].map((d) => from + d.index);
      const inRun = dets.find((d) => d >= runStart);
      subj = inRun != null ? inRun : dets.length ? dets[dets.length - 1] : -1;
    }
  }
  if (subj < 0) return whole;
  const steps = [];
  // Characters before the first keyword — only brackets / emphasis leftovers may stand there — lead that keyword's step:
  // "(WHEN the user pays) …" → When "(the user pays)" (they were dropped).
  let lead = "";
  const withLead = (t) => (!lead ? t : /\s$/.test(lead) ? lead.trim() + " " + t : lead.trim() + t);
  let resp = text.slice(subj).replace(/^[\s,]+/, "").trim();
  if (!conds.length && !thenKw) {
    const ctx = stripEnd(text.slice(0, subj), wsOrUnitIn(",")).trim(); // /[\s,]+$/
    if (ctx) steps.push({ kind: "given", text: ctx });
  } else {
    lead = text.slice(0, conds.length ? conds[0].at : thenKw.at);
    if (ghMask(lead).replace(/[\s([{*_~]/g, "")) return whole; // text before the first keyword
    for (let i = 0; i < conds.length; i++) {
      const stop = i + 1 < conds.length ? conds[i + 1].at : thenKw ? thenKw.at : subj;
      const t = stripEnds(text.slice(conds[i].end, stop), wsOrUnitIn(",")); // /^[\s,]+|[\s,]+$/g
      if (!t) return whole;
      steps.push({ kind: GHERKIN_COND[conds[i].word] || "given", text: i ? t : withLead(t) });
    }
    if (!conds.length && resp) resp = withLead(resp); // "(THEN THE SYSTEM SHALL …"
  }
  // The response must start with its subject (1.16 E review m4): "WHEN a payment fails, the cart, including discounts,
  // SHALL be kept" has none after its last comma — cut there it read When "a payment fails, the cart, including
  // discounts" + Then "SHALL be kept" — so the criterion stays one Then with its whole text.
  const rmask = ghMask(resp);
  const modalIn = rmask.search(RE_GH_MODAL);
  if (!resp || modalIn < 0 || !/[\p{L}\p{N}]/u.test(resp.slice(0, modalIn))) return whole;
  const order = { given: 0, when: 1 }; // Given before When (Gherkin's order); each kind keeps the criterion's order
  steps.sort((a, b) => order[a.kind] - order[b.kind]);
  steps.push({ kind: "then", text: resp });
  return { steps, split: true };
}
// A Gherkin comment / free-text line: one line, whatever the spec wrote.
const ghLine = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
// A track as a tag: its marker without the brackets ([SaaS] → @SaaS), else its name (@tdd).
const ghTag = (tr) => "@" + String(trackMarker(tr) || tr).replace(/^\[|\]$/g, "");
// The Feature's tags: each active optional track (+ @bugfix for a bugfix).
function gherkinFeatureTags(tracks, kind) {
  const tags = tracks.filter((t) => t !== "core").map((t) => ghTag(t));
  if (kind === "bugfix") tags.push("@bugfix");
  return tags;
}
// One feature ({ slug, dir }) → { content, scenarios, skipped: { template, superseded }, unsplit, lang } — a spike →
// { error, spike: true }. opts.supBy: a supersededByIndex() to reuse (the project export).
function gherkinFeature(projectDir, f, opts = {}) {
  const { slug, dir } = f;
  const lang = featureLang(projectDir, slug);
  const G = i18n.msg(lang).gherkin;
  const X = i18n.msg(lang).stakeholderExport;
  const state = stateFromFile(projectDir, statePath(dir));
  if (state.kind === "spike") return { error: G.spike(slug), spike: true, lang };
  const D = GHERKIN_DIALECT[i18n.baseLang(lang)] || GHERKIN_DIALECT.en;
  const tracks = detectTracks(dir);
  const reqRaw = readContained(projectDir, path.join(dir, "requirements.md")) || "";
  const reqs = activeDesign(reqRaw, tracks);
  const idx = requirementIndex(reqs);
  const mx = buildTraceMatrix(projectDir, f, { supBy: opts.supBy });
  const byTrack = markerTracks().filter((tr) => tracks.includes(tr)).map((tr) => ({ tag: ghTag(tr), acs: trackAcIds(reqs, tr) }));
  const lines = [`# language: ${i18n.baseLang(lang)}`, `# ${G.autogen}`, `# ${G.source(".specs/" + slug + "/requirements.md")}`];
  const ftags = gherkinFeatureTags(tracks, state.kind);
  if (ftags.length) lines.push(ftags.join(" "));
  // Gherkin is plain text: markdown escapes and entities are written as the characters a reader sees (mdPlainText — 1.17
  // verification N3: `NFR\-2`, `US-3\.AC-1`, `&lt;!--` from an import reached the steps as written).
  lines.push(`${D.feature}: ${ghLine(mdPlainText(titledSlug(specTitle(reqRaw, slug), slug)))}`);
  const summary = sectionText(reqs, SUMMARY_SYN) || (state.kind === "bugfix" ? sectionText(readContained(projectDir, path.join(dir, "bug.md")) || "", SUMMARY_SYN) : null);
  if (summary) {
    // A description line that reads like a Gherkin token (a tag, a comment, a table row, a doc string, any keyword of the
    // dialect or English — ghRiskyLine) would change the file's structure: it gets the summary label in front — the words stay.
    const s = ghLine(mdPlainText(summary));
    lines.push("  " + (ghRiskyLine(s, D) ? G.summaryLabel + ": " : "") + s);
  }
  const skipped = { template: [], superseded: [] };
  const unsplit = [];
  let scenarios = 0;
  let story = null;
  for (const r of mx.rows) {
    if (r.kind !== "ac") continue;
    const n = r.id.match(/^US-(\d+)/)[1];
    if (n !== story) {
      story = n;
      const ctx = storyContext(reqs, n);
      lines.push("", `  # ${ghLine(mdPlainText(ctx ? ctx[0] : "US-" + n))}`);
    }
    if (r.template) { skipped.template.push(r.id); lines.push("", `  # ${G.template(r.id)}`); continue; }
    if (r.supersededBy.length && !r.supersedePending) { skipped.superseded.push(r.id); lines.push("", `  # ${G.superseded(r.id, r.supersededBy.join(", "))}`); continue; }
    const e = idx.get(r.id);
    const full = acOneLine(e ? e.text : r.text, r.id, Infinity);
    const sp = earsSteps(full, lang);
    if (!sp.split) unsplit.push(r.id);
    const steps = sp.steps.map((st) => ({ kind: st.kind, text: mdPlainText(st.text) })); // split first: an escape never cuts a clause
    lines.push("");
    if (r.supersedePending) lines.push(`  # ${X.toBeSupersededBy(r.supersededBy.join(", "))}`);
    if (!sp.split) lines.push(`  # ${G.unsplit}`);
    const tags = ["@" + r.id, ...r.tests.map((t) => "@" + t.id), ...byTrack.filter((t) => t.acs.has(r.id)).map((t) => t.tag)];
    lines.push("  " + [...new Set(tags)].join(" "));
    lines.push(`  ${D.scenario}: ${r.id} — ${ghLine(oneLiner(steps[steps.length - 1].text, 100) || mdPlainText(full))}`);
    let prev = null;
    for (const st of steps) {
      lines.push(`    ${st.kind === prev ? D.and : D[st.kind]} ${st.text}`);
      prev = st.kind;
    }
    scenarios++;
  }
  if (!scenarios) lines.push("", `  # ${G.noScenarios}`);
  return { content: lines.join("\n") + "\n", scenarios, skipped, unsplit, lang };
}
// .specs/exports/<slug>.feature — the same name in the feature and the project export (a feature slugged 'project':
// project.feature.feature, as the other formats keep a feature off the project's file).
const gherkinBase = (slug) => (slug === "project" ? "project.feature" : slug) + ".feature";

// ---------------------------------------------------------------------------
// 1.16 E2 — tracker CSV: spec_export {format: "jira" | "linear"} · `dev-spec export [f] --tracker jira|linear` →
// .specs/exports/<slug>.<tracker>.csv (the project: project.<tracker>.csv — every active feature). Nothing is sent anywhere:
// the file is for the tool's own CSV importer. One record per feature (the parent), per user story (a child of its
// feature) and per task (a child of its story through its [USn] tag, else of the feature) — parents before their children.
// Column names are the importers' documented ones:
//   jira    Work item ID · Work type · Summary · Description · Status · Parent · Labels (repeated, one label per column)
//           — Jira Cloud "Import data from a CSV file": Summary is the only required field; the hierarchy is "Work item
//           ID" + "Work type" + "Parent" (the parent's Work item ID, parents first); several labels = several Labels columns.
//           Work types Epic (the feature) · Story · Sub-task (a story's task) · Task (a feature-level task); Status To Do ·
//           In Progress · Done (existing workflow statuses).
//   linear  ID · Title · Description · Status · Estimate · Labels · Parent issue — Linear's CSV (its export / CLI importer:
//           Title, Description, Status, Estimate, Labels comma-separated; ID and Parent issue carry the hierarchy as local
//           keys <slug>, <slug>/US-n, <slug>/#n). Status Todo · In Progress · Done; Estimate = a task's _Size:_ points
//           (1/2/3/5/8 — Linear's scale), empty when unsized.
// Labels: the feature slug, its active optional tracks, its kind when not a plain feature (bugfix / spike), and the AC IDs
// (a story's own criteria, a task's cited ones). The F5 CSV rules: csvCell (RFC 4180 quoting, the formula guard), CRLF,
// a UTF-8 BOM; the AUTO-GENERATED marker is the LAST header cell (its column stays empty) — never a trailing record,
// which an importer would turn into a work item.
const TRACKERS = ["jira", "linear"];
const TRACKER_LABELS_MAX = 30; // labels per record (a story citing more ACs keeps the first ones)
const TRACKER_SUMMARY_MAX = 250; // Jira's Summary holds at most 255 characters
const TRACKER_STATUS = { jira: { open: "To Do", doing: "In Progress", done: "Done" }, linear: { open: "Todo", doing: "In Progress", done: "Done" } };
// One feature → its records { key, parent, type, summary, description, status, labels, estimate? } (parents first).
function trackerRecords(projectDir, f, lang, supBy) {
  const { slug, dir } = f;
  const T = i18n.msg(lang).trackerCsv;
  const X = i18n.msg(lang).stakeholderExport;
  const tracks = detectTracks(dir);
  const state = stateFromFile(projectDir, statePath(dir));
  const kind = state.kind === "bugfix" || state.kind === "spike" ? state.kind : "feature";
  const reqRaw = readContained(projectDir, path.join(dir, "requirements.md")) || "";
  const reqs = activeDesign(reqRaw, tracks);
  const blocks = taskBlocks(activeTasks(readContained(projectDir, path.join(dir, "tasks.md")) || "", tracks) || "");
  const base = [slug, ...tracks.filter((t) => t !== "core")].concat(kind === "feature" ? [] : [kind]);
  const cap = (list) => [...new Set(list)].slice(0, TRACKER_LABELS_MAX);
  const status = (done, total) => (total && done === total ? "done" : done ? "doing" : "open");
  const done = blocks.filter((b) => b.done).length;
  const phase = detectPhase(dir, tracks);
  const summary = sectionText(reqs, SUMMARY_SYN) || (kind === "bugfix" ? sectionText(readContained(projectDir, path.join(dir, "bug.md")) || "", SUMMARY_SYN) : null) ||
    (kind === "spike" ? spikeInfo(dir).question : null);
  const title = specTitle(reqRaw || (kind === "spike" ? readContained(projectDir, path.join(dir, SPIKE_FILE)) || "" : ""), slug);
  const feature = { key: slug, parent: null, type: "feature", summary: mdPlainText(titledSlug(title, slug)),
    description: [summary, T.featureLine(".specs/" + slug + "/", trackLabel(tracks), (i18n.msg(lang).phaseNames || {})[phase] || phase, done, blocks.length)].filter(Boolean).join("\n\n"),
    status: phase === "complete" ? "done" : status(done, blocks.length), labels: cap(base) };
  // The stories: heading order, then first-AC order (the export's); each with its intro and its criteria, whole.
  const marks = supBy || supersededByIndex(projectDir);
  const acs = [...acIndex(reqs).values()].sort((a, b) => a.line - b.line);
  const order = [];
  const lines = stripHtmlComments(reqs).split(/\r?\n/);
  for (const k of headingIndex(lines)) { const m = lines[k].match(/^#{1,6}\s+US-(\d+)(?!\d)/); if (m && !order.includes(m[1])) order.push(m[1]); }
  for (const a of acs) { const n = a.id.match(/^US-(\d+)/)[1]; if (!order.includes(n)) order.push(n); }
  const stories = [];
  for (const n of kind === "spike" ? [] : order) {
    const ctx = storyContext(reqs, n);
    const intro = [];
    for (const l of ctx ? ctx.slice(1) : []) { if (RE_LIST_ITEM.test(l) || /^\|/.test(l)) break; intro.push(l); }
    const own = acs.filter((a) => a.id.startsWith(`US-${n}.`));
    const acLines = own.map((a) => {
      const k = dirKey(dir) + "\n" + a.id;
      const by = marks.get(k);
      const note = !by ? "" : " — " + (marks.live && !marks.live.has(k) ? X.toBeSupersededBy(by.join(", ")) : X.supersededBy(((marks.liveBy && marks.liveBy.get(k)) || by).join(", ")));
      // the criterion as a reader sees it (mdPlainText — an import's `NFR\-2` / `&lt;!--` read as written; 1.17 verification N3)
      return `- ${a.id} — ${mdPlainText(acOneLine(a.text, a.id, Infinity))}${note}${placeholderReport(a.text).length ? ` (${X.template})` : ""}`;
    });
    const st = blocks.filter((b) => b.story && b.story.toUpperCase() === "US" + n);
    stories.push({ n, rec: { key: `${slug}/US-${n}`, parent: slug, type: "story", summary: ghLine(mdPlainText(ctx ? ctx[0] : `US-${n}`)),
      description: [intro.join("\n"), acLines.length ? T.acceptance + "\n" + acLines.join("\n") : ""].filter(Boolean).join("\n\n"),
      status: status(st.filter((b) => b.done).length, st.length), labels: cap(base.concat(own.map((a) => a.id))) } });
  }
  const storyKey = new Map(stories.map((s) => [s.n, s.rec.key]));
  // Each record's key is unique (1.16 E review m3): a task number used twice (doctor's duplicate-tasks) keeps it for its
  // first task, the next ones get an occurrence suffix — `<slug>/#3`, `<slug>/#3 (2)` — never two work items with one ID.
  const seen = new Map();
  const tasks = blocks.map((b) => {
    const n = b.story && /^US\d+$/i.test(b.story) ? b.story.replace(/\D/g, "") : null;
    const parent = n && storyKey.has(n) ? storyKey.get(n) : slug;
    const prose = taskProse(b);
    const size = taskSize(b);
    const occ = (seen.get(String(b.number)) || 0) + 1;
    seen.set(String(b.number), occ);
    return { key: `${slug}/#${b.number}${occ > 1 ? ` (${occ})` : ""}`, parent, type: parent === slug ? "task" : "subtask", summary: `#${b.number} ${ghLine(mdPlainText(withoutTaskMarkers(cleanTaskText(b.text)))) || ghLine(b.text)}`,
      description: prose.map((l) => l.trim()).filter(Boolean).join("\n") + "\n\n" + T.taskLine(".specs/" + slug + "/tasks.md", b.number),
      status: b.done ? "done" : "open", labels: cap(base.concat([...extractAcIds(prose.join("\n"))])), estimate: size ? SIZE_POINTS[size] : null };
  });
  // Each story's tasks right after it, then the feature-level ones — parents always before their children.
  const out = [feature];
  for (const s of stories) out.push(s.rec, ...tasks.filter((t) => t.parent === s.rec.key));
  out.push(...tasks.filter((t) => t.parent === slug));
  return out;
}
// records (every feature's, in order) → the CSV document text for `tracker` (a BOM first; the marker the last header cell).
function trackerCsv(records, tracker, lang) {
  const T = i18n.msg(lang).trackerCsv;
  const S = TRACKER_STATUS[tracker];
  const marker = "# " + T.autogen;
  const cut = (s) => oneLiner(s, TRACKER_SUMMARY_MAX) || "";
  let out = BOM_CHAR;
  if (tracker === "jira") {
    // Work item ID = the record's row number (unique whatever its key); a Parent names the FIRST record with that key.
    const ids = new Map();
    records.forEach((r, i) => { if (!ids.has(r.key)) ids.set(r.key, String(i + 1)); });
    const type = { feature: "Epic", story: "Story", subtask: "Sub-task", task: "Task" };
    const nLabels = Math.max(1, ...records.map((r) => r.labels.length));
    out += csvRecord(["Work item ID", "Work type", "Summary", "Description", "Status", "Parent", ...Array(nLabels).fill("Labels"), marker]);
    for (const [i, r] of records.entries()) {
      out += csvRecord([String(i + 1), type[r.type], cut(r.summary), r.description, S[r.status], r.parent ? ids.get(r.parent) || "" : "",
        ...Array.from({ length: nLabels }, (_, k) => r.labels[k] || ""), ""]);
    }
    return out;
  }
  out += csvRecord(["ID", "Title", "Description", "Status", "Estimate", "Labels", "Parent issue", marker]);
  for (const r of records) out += csvRecord([r.key, cut(r.summary), r.description, S[r.status], r.estimate == null ? "" : r.estimate, r.labels.join(", "), r.parent || "", ""]);
  return out;
}

// --- release notes (spec_changelog) ---

// An ISO date (YYYY-MM-DD = that day, 00:00 UTC) or timestamp → ms, or null. A day that doesn't exist (2026-02-30) is
// refused, never rolled over into the next month as Date.parse would.
function isoTime(s) {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/i);
  if (!m) return null;
  const probe = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (probe.getUTCFullYear() !== +m[1] || probe.getUTCMonth() !== +m[2] - 1 || probe.getUTCDate() !== +m[3]) return null;
  if (m[4] != null && (+m[4] > 23 || +m[5] > 59 || (m[6] != null && +m[6] > 59))) return null;
  // A timestamp without a zone is UTC, like a bare date — Date.parse would read it in the machine's local time.
  const iso = m[4] == null ? `${m[1]}-${m[2]}-${m[3]}T00:00:00Z` : String(s).trim().replace(" ", "T").toUpperCase().replace(/([+-]\d{2})(\d{2})$/, "$1:$2") + (m[7] ? "" : "Z");
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}
// One line of prose: whitespace folded, the first sentence when the whole doesn't fit, cut at a word near `max`.
function oneLiner(s, max = 200) {
  if (s == null) return null;
  let t = String(s).replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length > max) {
    const first = t.split(/(?<=[.!?])\s+(?=\p{Lu})/u)[0];
    t = first.length <= max ? first : t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  }
  return t;
}
// The user-visible criteria of a shipped feature: every active user-story AC (US-n.AC-m), template ones left out, one line each.
function releaseAcs(reqs) {
  return [...acIndex(reqs).values()].filter((e) => !placeholderReport(e.text).length).sort((a, b) => a.line - b.line)
    .map((e) => ({ id: e.id, text: acOneLine(e.text, e.id) }));
}
// What shipped since `since` (ms, or null = everything). A feature ships when spec_finish {write} records its baseline or its
// execution sign-off is approved; one that already shipped before `since` (a finish, a sign-off or an execution approval in
// its history at or before it) is not new — its change requests speak for it instead.
// only (1.16 E3): a Set of feature slugs — a milestone's (its features and the ones archived since) — the notes are scoped to.
function changelogData(projectDir, since, only) {
  const inWin = (t) => t != null && (since == null || t > since);
  const cache = new Map();
  const added = [];
  const fixed = [];
  const superseded = [];
  const changeRequests = [];
  const shipped = new Set();
  const srcs = featureDirs(projectDir).filter((s) => !only || only.has(s.slug)).map((s) => ({ ...s, st: stateFromFile(projectDir, statePath(s.dir)) }));
  for (const s of srcs) {
    const st = s.st;
    if (st.kind === "spike") continue; // 1.14 C2: a spike ships nothing (its decision is not a release note)
    const fin = isObj(st.finished) ? timeOf(st.finished.at) : null;
    const exe = isRecord(st.approvals) && isRecord(st.approvals.execution) ? timeOf(st.approvals.execution.at) : null;
    const events = [fin, exe].filter(inWin);
    if (!events.length) continue;
    const hist = Array.isArray(st.approvalHistory) ? st.approvalHistory : [];
    const firstFin = isObj(st.finished) ? timeOf(st.finished.firstAt) : null; // a re-finished feature shipped at its first finish
    const before = since != null && ([fin, firstFin, exe].some((t) => t != null && t <= since) ||
      // a role's partial sign-off approves nothing (the phase waits for every role) — only a completed one shipped it
      hist.some((h) => isApprovalRecord(h) && h.phase === "execution" && timeOf(h.at) != null && timeOf(h.at) <= since)); // a revocation (1.16) shipped nothing either
    if (before) continue;
    shipped.add(s.dir);
    const at = Math.max(...events);
    const tracks = detectTracks(s.dir);
    const reqRaw = readContained(projectDir, path.join(s.dir, "requirements.md")) || "";
    const reqs = activeDesign(reqRaw, tracks);
    const entry = { feature: s.slug, title: specTitle(reqRaw, s.slug), kind: st.kind === "bugfix" ? "bugfix" : "feature", at: new Date(at).toISOString(), event: at === fin ? "finished" : "execution-approved" };
    if (s.archived) entry.archived = true;
    if (entry.kind === "bugfix") {
      const bug = readContained(projectDir, path.join(s.dir, "bug.md")) || "";
      entry.summary = sectionFirstParagraph(reqs, SUMMARY_SYN) || sectionFirstParagraph(bug, SUMMARY_SYN);
      entry.rootCause = oneLiner(sectionFirstParagraph(bug, ROOT_CAUSE_SYN));
      fixed.push(entry);
    } else {
      entry.summary = sectionFirstParagraph(reqs, SUMMARY_SYN);
      entry.acs = releaseAcs(reqs);
      added.push(entry);
    }
    // The earlier criteria this shipped feature replaces (_Supersedes:_), each with the criterion that replaces it.
    const own = acIndex(reqs);
    for (const v of resolveSupersedes(projectDir, s.dir, supersedesMarkers(reqRaw), cache).valid) {
      const by = v.by && own.has(v.by) ? own.get(v.by) : null;
      superseded.push({ ac: v.feature + "/" + v.ac, by: s.slug + (v.by ? "/" + v.by : ""), text: by ? acOneLine(by.text, by.id) : null, at: entry.at });
    }
  }
  // Change requests (spec_impact reopen) since then — except those of a feature new in these notes (its final state is it).
  for (const s of srcs) {
    if (shipped.has(s.dir)) continue;
    (Array.isArray(s.st.changes) ? s.st.changes : []).forEach((c, i) => {
      if (!isRecord(c) || !inWin(timeOf(c.at))) return;
      const ids = (k) => (Array.isArray(c[k]) ? c[k].filter((x) => typeof x === "string" || typeof x === "number").map(String) : []);
      const cr = { feature: s.slug, n: i + 1, at: new Date(timeOf(c.at)).toISOString(), phase: typeof c.phase === "string" ? c.phase : "requirements",
        added: ids("added"), modified: ids("modified"), removed: ids("removed"), reopened: Array.isArray(c.reopened) ? c.reopened.filter((n) => Number.isSafeInteger(n)) : [] };
      if (cr.phase === "requirements") { // the current text of the requirement IDs it added or modified
        const idx = requirementIndex(readContained(projectDir, path.join(s.dir, "requirements.md")) || "");
        cr.acs = [...cr.added, ...cr.modified].filter((id) => idx.has(id)).map((id) => ({ id, text: acOneLine(idx.get(id).text, id) }));
      }
      if (s.archived) cr.archived = true;
      changeRequests.push(cr);
    });
  }
  const byAt = (a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
  return { added: added.sort(byAt), fixed: fixed.sort(byAt), changed: { superseded: superseded.sort(byAt), changeRequests: changeRequests.sort(byAt) } };
}
function renderReleaseNotes(d, lang, proj, scope, now, ms) {
  const M = i18n.msg(lang);
  const N = M.releaseNotes;
  const code = (s) => "`" + s + "`";
  const name = (e) => (slugify(e.title) === e.feature ? e.title : `${e.title} (${code(e.feature)})`);
  const title = ms ? M.milestone.notesTitle(N.title(proj), ms.name) : N.title(proj); // 1.16 E3: a milestone's notes
  const scopeLine = ms ? M.milestone.notesScope(ms.name, ms.date, ms.features.concat(ms.archived || []).join(", ")) + " · " + scope : scope;
  let md = `# ${title}\n\n<!-- ${ms ? M.milestone.notesAutogen : N.autogen} -->\n\n_${scopeLine} · ${N.generated(day(now))}_\n\n## ${N.added}\n\n`;
  if (!d.added.length) md += italic(N.none) + "\n\n";
  for (const a of d.added) {
    md += `### ${name(a)}\n\n` + (a.summary ? a.summary + "\n\n" : "");
    if (a.acs.length) md += a.acs.map((x) => `- **${x.id}** — ${x.text}`).join("\n") + "\n\n";
  }
  const lines = d.changed.superseded.map((x) => `- ~~${code(x.ac)}~~ — ${M.catalog.supersededBy(code(x.by))}${x.text ? ": " + x.text : ""}`);
  for (const c of d.changed.changeRequests) {
    const parts = ["added", "modified", "removed"].filter((k) => c[k].length).map((k) => N.crParts[k](c[k].join(", ")));
    if (c.reopened.length) parts.push(N.crParts.reopened(c.reopened.map((n) => "#" + n).join(", ")));
    lines.push(`- **${c.feature}** — ${N.changeRequest(c.n, M.stakeholderExport.phases[c.phase] || c.phase, day(c.at))}${parts.length ? ": " + parts.join("; ") : ""}`);
    for (const x of c.acs || []) lines.push(`  - **${x.id}** — ${x.text}`);
  }
  md += `## ${N.changed}\n\n` + (lines.length ? lines.join("\n") : italic(N.none)) + "\n\n## " + N.fixed + "\n\n";
  md += d.fixed.length ? d.fixed.map((x) => `- **${name(x)}**${x.summary ? " — " + x.summary : ""} — ${x.rootCause ? N.rootCause(x.rootCause) : italic(N.noRootCause)}`).join("\n") + "\n" : italic(N.none) + "\n";
  return md;
}
// spec_changelog {since?, write?} / `dev-spec changelog [--since <ISO date|last|all>] [--write]`: release notes from the spec
// data, in the project language. since: an ISO date / timestamp, 'last' (the default: roadmap.json meta.changelogAt, stamped by
// the last written notes — everything while unset) or 'all'. write: .specs/RELEASE-NOTES.md (AUTO-GENERATED, never over a
// hand-written one) + meta.changelogAt, both under the roadmap lock; with nothing to report nothing is written or stamped.
// 1.16 E3 — milestone: the notes of that milestone's features only (its features + the ones archived since it was set);
// `since` then defaults to 'all' (the milestone's whole history — 'last' / a date still narrow it), and write goes to
// .specs/RELEASE-NOTES.<milestoneFileKey>.md (the slug, + a short hash when it loses part of the name; AUTO-GENERATED, never
// over a hand-written one) WITHOUT stamping meta.changelogAt (the project's own notes keep their 'last').
function changelog(projectDir, opts = {}) {
  const lang = projectLang(projectDir);
  const M = i18n.msg(lang);
  const N = M.releaseNotes;
  const root = specsRoot(projectDir);
  let ms = null;
  let msFile = null;
  if (opts.milestone != null && String(opts.milestone).trim() !== "") {
    const found = findMilestone(projectDir, opts.milestone);
    if (!found.ok) return found;
    ms = found.milestone;
    msFile = milestoneFileKey(ms.name, found.list);
  }
  const fileName = ms ? `RELEASE-NOTES.${msFile}.md` : "RELEASE-NOTES.md";
  const file = path.join(root, fileName);
  const raw = opts.since == null ? "" : String(opts.since).trim();
  const key = raw.toLowerCase() || (ms ? "all" : "");
  let since = null;
  let sinceSource = "all";
  let note = null;
  if (key === "" || key === "last") {
    const bad = roadmapError(projectDir); // the last release notes' stamp lives there — a broken file is never read as "none yet"
    if (bad) return { ok: false, error: bad };
    const last = timeOf((readRoadmap(projectDir).meta || {}).changelogAt);
    if (last != null) { since = last; sinceSource = "last"; }
    else if (key === "last") note = N.noLast;
  } else if (key !== "all") {
    since = isoTime(raw);
    if (since == null) return { ok: false, error: N.badSince(raw) };
    sinceSource = "date";
  }
  const now = new Date().toISOString();
  const d = changelogData(projectDir, since, ms ? new Set(ms.features.concat(ms.archived || [])) : null);
  const sinceIso = since == null ? null : new Date(since).toISOString();
  const scope = sinceSource === "last" ? N.sinceLast(utcStamp(sinceIso)) : sinceSource === "date" ? N.sinceDate(utcStamp(sinceIso)) : N.all;
  const markdown = renderReleaseNotes(d, lang, path.basename(path.resolve(projectDir)), scope, now, ms);
  const counts = { added: d.added.length, changed: d.changed.superseded.length + d.changed.changeRequests.length, fixed: d.fixed.length };
  const res = { ok: true, lang, since: sinceIso, sinceSource, generatedAt: now, added: d.added, changed: d.changed, fixed: d.fixed, counts, file, wrote: false };
  if (ms) res.milestone = { name: ms.name, date: ms.date, features: ms.features.slice(), ...(ms.archived ? { archived: ms.archived.slice() } : {}) };
  if (note) res.note = note;
  if (!opts.write) return { ...res, markdown };
  if (!fs.existsSync(root)) return { ...res, ok: false, error: M.err.noSpecs(root) };
  if (!counts.added && !counts.changed && !counts.fixed) return { ...res, note: (ms ? M.milestone.nothingToWrite : N.nothingToWrite)(".specs/" + fileName) };
  const w = withRoadmapLock(projectDir, () => {
    const bad = roadmapError(projectDir);
    if (bad) return { ok: false, error: bad };
    if (!isGeneratedOrAbsent(file)) return { ok: false, skipped: true, error: M.err.notGenerated(fileName) };
    writeFileAtomic(file, i18n.portableCli(markdown));
    if (ms) return { ok: true }; // a milestone's notes leave the project's meta.changelogAt alone
    const rm = readRoadmap(projectDir);
    rm.meta = rm.meta || {};
    rm.meta.changelogAt = now;
    writeRoadmap(projectDir, rm);
    return { ok: true };
  });
  if (!w.ok) return { ...res, ...w };
  return { ...res, wrote: true, ...(ms ? {} : { changelogAt: now }) };
}

// ---------------------------------------------------------------------------
// 1.16 E3 — milestones: spec_milestone {action: add | rm | list} · `dev-spec milestone [add <name> <YYYY-MM-DD> <features…> |
// rm <name> | list]`, stored in roadmap.json → meta.milestones [{name, date, features, archived?}] (under the roadmap lock).
// A name: letters (any script, with their marks), digits, spaces and . _ : # ( ) + - (≤ 60 characters, starting with a
// letter or a digit), unique by its identity (milestoneKey — Unicode kept: "Sprint α" ≠ "Sprint β"); its release notes'
// file name is milestoneFileKey's (the slug, + a short hash when the slug loses part of the name); a date: a real YYYY-MM-DD
// day; features: ≥ 1, each an existing ACTIVE feature (resolved like dependsOn — a list's items split on commas only),
// ≤ MILESTONE_FEATURES_MAX; ≤ MILESTONE_MAX milestones. `add` of an existing name updates it (date and features replaced,
// the archived ones kept — `updated: true`). A stored meta.milestones of the wrong shape (or an entry add would refuse: a bad
// name or date, a duplicate) is refused by the mutators (never "repaired") and read as its valid entries by everyone else.
// A feature's lifecycle follows (pruneRoadmapRefsLocked, like dependsOn): rename → the new slug; remove → dropped; archive →
// moved to the milestone's `archived` list (restore moves it back) — the milestone's release notes still cover it, its
// status no longer counts it.
// Status (stable codes; milestoneStatuses — over roadmap()'s features and their forecasts, "today" = opts.now's UTC day):
//   done      every active feature at 100% (or only archived ones left)
//   late      the date has passed (today > date) and a feature is not done
//   at-risk   reason eta-after-date — the latest ETA of its open features is after the date; eta-unknown — an open
//             feature has no ETA (not enough data, no tasks yet, a dependency …); no-features — nothing active or archived
//   on-track  every open feature has an ETA on or before the date
// ROADMAP.md / .html show a Milestones table when any exists, and "Needs attention" lists the at-risk / late ones.
// ---------------------------------------------------------------------------
const MILESTONE_ACTIONS = ["add", "rm", "remove", "list"]; // = the spec_milestone enum (server.js reads it from here)
const MILESTONE_STATUSES = ["on-track", "at-risk", "late", "done"];
const MILESTONE_MAX = 50;
const MILESTONE_FEATURES_MAX = 200;
const RE_MILESTONE_NAME = /^[\p{L}\p{N}][\p{L}\p{N}\p{M} ._:#()+-]{0,59}$/u;
const RE_ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
// A milestone's name as stored and validated: one line, whitespace runs folded, NFC (a decomposed "é" is the composed one).
const milestoneName = (name) => (name == null ? "" : String(name)).normalize("NFC").replace(/\s+/g, " ").trim();
// A milestone's IDENTITY (1.16 E review M1): its name, Unicode kept — NFKC, lower-case, the accents of LATIN letters folded
// (Lançamento = lancamento, as the 1.16.0 slug key had it), runs of separators (whitespace _ - . : # ( )) as one '-'. Every
// other letter, digit, mark and '+' counts: "Sprint α" ≠ "Sprint β", "Релиз 2026" ≠ "Бета 2026", "C" ≠ "C++" (the slug
// key made each pair one milestone — adding the second silently replaced the first).
function milestoneKey(name) {
  return (name == null ? "" : String(name)).normalize("NFKC").toLowerCase().normalize("NFD")
    .replace(/(?<=[a-z])\p{M}+/gu, "").normalize("NFC")
    .replace(/[^\p{L}\p{N}\p{M}+\s_.:#()-]/gu, "").replace(/[\s_.:#()-]+/g, "-").replace(/^-+|-+$/g, "");
}
// The release notes' file name part of a milestone (RELEASE-NOTES.<it>.md) — derived apart from its identity: its slug when
// the slug says everything the key says (Latin letters, digits, separators — "Beta launch" → beta-launch, 1.16.0's file),
// else the slug (or "milestone") + 8 hex characters of the key's sha1 ("Sprint α" → sprint-1a2b3c4d, "C++" → c-…); and when
// another milestone of `list` would still share that file name, the hashed form.
function milestoneFileKey(name, list) {
  const key = milestoneKey(name);
  const base = (n) => {
    const k = milestoneKey(n);
    const s = slugify(String(n).normalize("NFKC"));
    return s && s === k ? s : `${s || "milestone"}-${sha1Hex(k).slice(0, 8)}`;
  };
  const mine = base(name);
  const clash = (list || []).some((m) => milestoneKey(m.name) !== key && base(m.name) === mine);
  return clash ? `${slugify(String(name).normalize("NFKC")) || "milestone"}-${sha1Hex(key).slice(0, 8)}` : mine;
}
const strList = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
const slugList = (v) => strList(v) && v.every((x) => x !== "" && slugify(x) === x); // feature slugs, as add stores them
// roadmap.json → meta.milestones → { list: [{ name, date, features, archived? }], invalid } (invalid: the stored value is
// not a list of such entries — its valid ones are still listed). An entry is valid only as `add` writes it (1.16 E review
// M2 — a hand-edited roadmap.json reaches ROADMAP.md / .html): a name RE_MILESTONE_NAME accepts, a date that is a real
// YYYY-MM-DD day, lists of feature slugs; a second entry with the same identity (milestoneKey) is invalid too.
// Also → `valid` (per stored entry: true | false — milestonesFollow edits the valid ones in place) and `bad` (null, or
// { count, names, notList? } — milestoneInvalidInfo: what ROADMAP.md's "Needs attention" and the lifecycle results report).
function milestoneStore(rm) {
  const raw = rm && isObj(rm.meta) ? rm.meta.milestones : undefined;
  if (raw === undefined) return { list: [], invalid: false, valid: [], bad: null };
  if (!Array.isArray(raw)) return { list: [], invalid: true, valid: [], bad: { count: 1, names: [], notList: true } };
  const list = [], valid = [], names = [];
  const keys = new Set();
  raw.forEach((m, i) => {
    if (!isObj(m) || typeof m.name !== "string" || !RE_MILESTONE_NAME.test(m.name) || typeof m.date !== "string" || !RE_ISO_DAY.test(m.date) || isoTime(m.date) == null ||
      !slugList(m.features) || (m.archived !== undefined && !slugList(m.archived)) || keys.has(milestoneKey(m.name))) {
      valid.push(false);
      // shown by its name when the name itself is one add accepts (a date typo), else by its position in the list
      names.push(isObj(m) && typeof m.name === "string" && RE_MILESTONE_NAME.test(m.name) ? m.name : "#" + (i + 1));
      return;
    }
    keys.add(milestoneKey(m.name));
    valid.push(true);
    list.push({ name: m.name, date: m.date, features: m.features.slice(), ...(m.archived && m.archived.length ? { archived: m.archived.slice() } : {}) });
  });
  return { list, invalid: names.length > 0, valid, bad: names.length ? { count: names.length, names } : null };
}
// The invalid part of meta.milestones → null | { count, names, notList? } (1.16 verify NEW-1): spec_roadmap's
// `milestonesInvalid`, a "Needs attention" line of ROADMAP.md / .html and the CLI roadmap, and the lifecycle results.
function milestoneInvalidInfo(rm) {
  const b = milestoneStore(rm).bad;
  return b ? { ...b, names: b.names.slice() } : null;
}
// A milestone by name (its identity, milestoneKey) → { ok, milestone, list } or a localized error naming the ones there; a
// roadmap.json that doesn't parse is that error (never "no milestone").
function findMilestone(projectDir, name) {
  const bad = roadmapError(projectDir);
  if (bad) return { ok: false, error: bad };
  const MS = i18n.msg(projectLang(projectDir)).milestone;
  const { list } = milestoneStore(readRoadmap(projectDir));
  const k = milestoneKey(name);
  const m = list.find((x) => milestoneKey(x.name) === k);
  return m ? { ok: true, milestone: m, list } : { ok: false, error: MS.notFound(String(name).trim(), list.map((x) => x.name).join(", ") || "—") };
}
// The stored milestones with their status against the roadmap's features (roadmap() entries carrying `forecast`) → [{ name,
// date, features, archived?, missing?, status, reason?, done, total, open, eta, unknownEta? }].
function milestoneStatuses(projectDir, feats, now) {
  const { list } = milestoneStore(readRoadmap(projectDir));
  const today = fcIso(fcDay(now));
  const by = new Map(feats.map((f) => [f.name, f]));
  return list.map((m) => {
    const active = m.features.filter((s) => by.has(s));
    const open = active.filter((s) => by.get(s).percent < 100);
    const eta = (s) => (by.get(s).forecast && by.get(s).forecast.eta) || null;
    const unknown = open.filter((s) => !eta(s));
    const latest = open.length && !unknown.length ? open.map(eta).sort().pop() : null;
    const o = { name: m.name, date: m.date, features: m.features.slice() };
    if (m.archived) o.archived = m.archived.slice();
    const missing = m.features.filter((s) => !by.has(s));
    if (missing.length) o.missing = missing; // a hand-edited entry naming no active feature
    if (!active.length && !(m.archived || []).length) Object.assign(o, { status: "at-risk", reason: "no-features" });
    else if (!open.length) o.status = "done";
    else if (m.date < today) o.status = "late";
    else if (unknown.length) Object.assign(o, { status: "at-risk", reason: "eta-unknown" });
    else if (latest > m.date) Object.assign(o, { status: "at-risk", reason: "eta-after-date" });
    else o.status = "on-track";
    Object.assign(o, { done: active.length - open.length, total: active.length, open, eta: latest });
    if (unknown.length) o.unknownEta = unknown;
    return o;
  });
}
// The milestone lines of "Needs attention" (ROADMAP.md / .html): the late and at-risk ones, then the invalid stored entries
// (invalid: milestoneInvalidInfo — they have no status, and a feature's rename / archive / remove / restore skips them).
function milestoneAttention(milestones, lang, invalid) {
  const MS = i18n.msg(lang).milestone;
  const out = (milestones || []).filter((m) => m.status === "late" || m.status === "at-risk").map((m) => ({ name: "🏁 " + m.name,
    msg: m.status === "late" ? MS.attention.late(m.date, m.done, m.total, m.eta) : MS.attention[m.reason](m.date, m.eta, (m.unknownEta || []).join(", ")) }));
  if (invalid) out.push({ name: "🏁 meta.milestones", msg: invalid.notList ? MS.attention.notList(".specs/roadmap.json") : MS.attention.invalid(invalid.count, invalid.names.join(", "), ".specs/roadmap.json") });
  return out;
}
const MILESTONE_ICON = { "on-track": "🟢", "at-risk": "⚠", late: "⛔", done: "✅" };
// One milestone as a line (CLI `milestone list` / `roadmap`).
function milestoneLine(m, lang) {
  const MS = i18n.msg(lang).milestone;
  return `${MILESTONE_ICON[m.status] || ""} ${MS.line(m.name, m.date, m.done, m.total, m.eta, MS.status[m.status] || m.status, m.features.join(", "), (m.archived || []).join(", "))}`.trim();
}
// The data behind every milestone surface: roadmap() + its forecasts (opts.now: "today").
function milestonesNow(projectDir, opts = {}) {
  const now = (opts.now != null && timeOf(opts.now)) || Date.now();
  const rmv = roadmap(projectDir);
  const fc = forecastData(projectDir, rmv.features, { now, cycle: rmv.cycle });
  for (const f of rmv.features) f.forecast = fc.byFeature[f.name];
  return { today: fcIso(fcDay(now)), milestones: milestoneStatuses(projectDir, rmv.features, now) };
}
// spec_milestone {action?, name?, date?, features?} (opts.now: "today", tests).
function milestone(projectDir, action, opts = {}) {
  const lang = projectLang(projectDir);
  const MS = i18n.msg(lang).milestone;
  const A = i18n.msg(lang).args;
  const a = String(action == null ? "" : action).trim().toLowerCase() || "list";
  if (!MILESTONE_ACTIONS.includes(a)) return { ok: false, error: A.invalid(A.item("action", A.oneOf(MILESTONE_ACTIONS.join(", ")), JSON.stringify(String(action)))) };
  const root = specsRoot(projectDir);
  const report = (res) => {
    const d = milestonesNow(projectDir, opts);
    const out = { ...res, today: d.today, milestones: d.milestones };
    const store = milestoneStore(readRoadmap(projectDir));
    if (store.invalid) out.warning = MS.badStored(".specs/roadmap.json");
    out.lines = [...(res.message ? [res.message] : []), ...(d.milestones.length ? [MS.head(d.milestones.length, d.today), ...d.milestones.map((m) => "  " + milestoneLine(m, lang))] : [MS.none]),
      ...(out.warning ? ["⚠ " + out.warning] : [])];
    return out;
  };
  if (a === "list") {
    const bad = roadmapError(projectDir); // a roadmap.json that doesn't parse is an error, never "no milestones yet"
    if (bad) return { ok: false, error: bad };
    return report({ ok: true, action: "list" });
  }
  if (!fs.existsSync(root)) return { ok: false, error: i18n.msg(lang).err.noSpecs(root) };
  const name = milestoneName(opts.name);
  if (!name) return { ok: false, error: MS.nameRequired };
  const mutate = (fn) => {
    const r = withRoadmapLock(projectDir, () => {
      const bad = roadmapError(projectDir);
      if (bad) return { ok: false, error: bad };
      const rm = readRoadmap(projectDir);
      const store = milestoneStore(rm);
      if (store.invalid) return { ok: false, error: MS.badStored(".specs/roadmap.json") };
      const r2 = fn(store.list);
      if (!r2.ok) return r2;
      rm.meta = rm.meta || {};
      if (store.list.length) rm.meta.milestones = store.list; else delete rm.meta.milestones;
      writeRoadmap(projectDir, rm);
      return r2;
    });
    if (!r.ok) return r;
    maybeRefreshRoadmap(projectDir); // outside the lock: the lock covers roadmap.json only
    return report(r);
  };
  if (a === "add") {
    if (!RE_MILESTONE_NAME.test(name)) return { ok: false, error: MS.badName(name) };
    const date = opts.date == null ? "" : String(opts.date).trim();
    if (!RE_ISO_DAY.test(date) || isoTime(date) == null) return { ok: false, error: MS.badDate(date) };
    // A list's items are names (a feature called "User Login" is one) split on commas only; a single string — the engine's
    // shorthand — on whitespace and commas too, as spec_depend reads it (1.16 E review m2).
    const asked = (opts.features == null ? [] : Array.isArray(opts.features) ? opts.features.flatMap((x) => String(x == null ? "" : x).split(",")) : String(opts.features).split(/[\s,]+/))
      .map((x) => x.trim()).filter(Boolean);
    if (!asked.length) return { ok: false, error: MS.noFeatures };
    const features = [];
    const unknown = [];
    for (const x of asked) {
      const f = existingFeature(projectDir, x);
      if (!f.ok) unknown.push(x);
      else if (!features.includes(f.slug)) features.push(f.slug);
    }
    if (unknown.length) return { ok: false, error: MS.unknownFeatures(unknown.join(", ")) };
    if (features.length > MILESTONE_FEATURES_MAX) return { ok: false, error: MS.tooManyFeatures(MILESTONE_FEATURES_MAX) };
    return mutate((list) => {
      const i = list.findIndex((x) => milestoneKey(x.name) === milestoneKey(name));
      if (i < 0 && list.length >= MILESTONE_MAX) return { ok: false, error: MS.tooMany(MILESTONE_MAX) };
      // An update keeps the features archived since the milestone was set (its release notes still cover them — 1.16 E
      // review m1), minus any now listed as active again.
      const archived = i >= 0 && list[i].archived ? list[i].archived.filter((s) => !features.includes(s)) : [];
      const entry = { name, date, features, ...(archived.length ? { archived } : {}) };
      if (i >= 0) list[i] = entry; else list.push(entry);
      return { ok: true, action: "add", updated: i >= 0, milestone: { ...entry, features: features.slice(), ...(archived.length ? { archived: archived.slice() } : {}) },
        message: (i >= 0 ? MS.updated : MS.added)(name, date, features.join(", ")) };
    });
  }
  return mutate((list) => { // rm / remove
    const i = list.findIndex((x) => milestoneKey(x.name) === milestoneKey(name));
    if (i < 0) return { ok: false, error: MS.notFound(name, list.map((x) => x.name).join(", ") || "—") };
    const [gone] = list.splice(i, 1);
    return { ok: true, action: "rm", removed: gone.name, message: MS.removed(gone.name) };
  });
}
// A feature's lifecycle in meta.milestones (pruneRoadmapRefsLocked / restore, under the roadmap lock): rename → the new slug
// (active lists only), archive → moved to `archived`, remove → dropped, restore → back from `archived`. Every VALID stored
// entry is edited in place; an invalid one (a hand-edit typo — 1.16 verify NEW-1: one bad date used to stop every entry from
// following) is left exactly as it is, and so is a meta.milestones that is no list. → { changed: the names of the milestones
// changed, invalid: milestoneInvalidInfo | null }.
function milestonesFollow(rm, slug, how, to) {
  const store = milestoneStore(rm);
  const changed = [];
  const raw = store.valid.length ? rm.meta.milestones : [];
  raw.forEach((m, i) => {
    if (!store.valid[i]) return;
    const arch = m.archived || [];
    let hit = false;
    if (how === "restore") {
      if (arch.includes(slug)) { hit = true; m.archived = arch.filter((s) => s !== slug); if (!m.features.includes(slug)) m.features = m.features.concat(slug); }
    } else if (m.features.includes(slug)) {
      hit = true;
      if (how === "rename") m.features = [...new Set(m.features.map((s) => (s === slug ? to : s)))];
      else {
        m.features = m.features.filter((s) => s !== slug);
        if (how === "archive" && !arch.includes(slug)) m.archived = arch.concat(slug);
      }
    }
    if (hit && m.archived && !m.archived.length) delete m.archived;
    if (hit) changed.push(m.name);
  });
  return { changed, invalid: store.bad ? { ...store.bad, names: store.bad.names.slice() } : null };
}

module.exports = { EXPORT_DIR, EXPORT_FORMATS, SUMMARY_SYN, SUCCESS_SYN, expItem, RE_EXP_RULE, RE_EXP_BLOCK, RE_EXP_SEP,
  expInline, RE_MD_ESCAPE, MD_ENTITIES, mdPlainText, nextPlainStop, expFence, expCells, expTable, expList, expBlocks,
  markdownToHtml, shiftHeadings, squeezeBlankLines, artifactBody, sectionText, specTitle, titledSlug, mdCell, utcStamp,
  italic, exportAcLine, exportStories, requirementSections, exportFeatureDoc, exportProjectDoc, exportMd, EXPORT_CSS,
  EXPORT_JS, exportHtml, exportSpecs, exportGherkin, GHERKIN_DIALECT, GHERKIN_BLOCK_KINDS, GHERKIN_STEP_KINDS,
  ghRiskyLine, GHERKIN_COND, GHERKIN_THEN, RE_GH_KEYWORD, RE_GH_MODAL, RE_GH_DET, ghMask, ghStripEmphasis,
  GHERKIN_LANG_KEYWORDS, earsSteps, ghLine, ghTag, gherkinFeatureTags, gherkinFeature, gherkinBase, TRACKERS,
  TRACKER_LABELS_MAX, TRACKER_SUMMARY_MAX, TRACKER_STATUS, trackerRecords, trackerCsv, isoTime, oneLiner, releaseAcs,
  changelogData, renderReleaseNotes, changelog, MILESTONE_ACTIONS, MILESTONE_STATUSES, MILESTONE_MAX,
  MILESTONE_FEATURES_MAX, RE_MILESTONE_NAME, RE_ISO_DAY, milestoneName, milestoneKey, milestoneFileKey, strList,
  slugList, milestoneStore, milestoneInvalidInfo, findMilestone, milestoneStatuses, milestoneAttention, MILESTONE_ICON,
  milestoneLine, milestonesNow, milestone, milestonesFollow, __link };
