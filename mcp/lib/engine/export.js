"use strict";

/**
 * dev-spec-driven engine — the stakeholder export.
 * spec_export's documents (offline HTML or markdown): a zero-dep markdown renderer that escapes every text run, and
 * the feature / project document model.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, acOneLine, activeDesign, atxHeading, backtickRuns, buildTraceMatrix, catalogData, changedSinceApproval,
  clarificationMarkers, cleanTaskText, closesFence, day, designSections, detectPhase, detectTracks, existingFeature,
  extractSection, featureDirs, featureLang, featurePercent, fenceStep, flatText, flowOfState, gherkinBase,
  gherkinFeature, headingIndex, headRest, htmlEsc, indentOf, isGeneratedOrAbsent, isRecord, listFeatures, matrixCsv,
  normalizeLang, own, pendingGateList, PHASE_FILE, phaseActive, phaseFile, PHASES, placeholderReport, projectLang,
  RE_FENCE, RE_LIST_ITEM, readContained, replaceCodeSpans, roadmap, rtmMarkdown, rtmProjectMarkdown, slugify, specsRoot,
  SPIKE_FILE, spikeInfo, stateFromFile, statePath, statusFeature, storyContext, stripHtmlComments, supersededByIndex,
  timeOf, trackerCsv, trackerRecords, TRACKERS, trackLabel, verificationStatus, writeFileAtomic;
function __link(E) { ({ acIndex, acOneLine, activeDesign, atxHeading, backtickRuns, buildTraceMatrix, catalogData,
  changedSinceApproval, clarificationMarkers, cleanTaskText, closesFence, day, designSections, detectPhase,
  detectTracks, existingFeature, extractSection, featureDirs, featureLang, featurePercent, fenceStep, flatText,
  flowOfState, gherkinBase, gherkinFeature, headingIndex, headRest, htmlEsc, indentOf, isGeneratedOrAbsent, isRecord,
  listFeatures, matrixCsv, normalizeLang, own, pendingGateList, PHASE_FILE, phaseActive, phaseFile, PHASES,
  placeholderReport, projectLang, RE_FENCE, RE_LIST_ITEM, readContained, replaceCodeSpans, roadmap, rtmMarkdown,
  rtmProjectMarkdown, slugify, specsRoot, SPIKE_FILE, spikeInfo, stateFromFile, statePath, statusFeature, storyContext,
  stripHtmlComments, supersededByIndex, timeOf, trackerCsv, trackerRecords, TRACKERS, trackLabel, verificationStatus,
  writeFileAtomic } = E); }

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
  writeFileAtomic(file, content);
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
  for (const d of docs) writeFileAtomic(d.file, d.content);
  const bytes = (d) => Buffer.byteLength(d.content, "utf8");
  if (res.scope === "feature") return { ...res, wrote: true, bytes: bytes(docs[0]) };
  return { ...res, wrote: docs.length > 0, files: docs.map((d) => d.file),
    documents: docs.map(({ feature, lang: l, file, scenarios, skipped, unsplit }, i) => ({ feature, lang: l, file, scenarios, skipped, unsplit, bytes: bytes(docs[i]) })) };
}

module.exports = { EXPORT_DIR, EXPORT_FORMATS, SUMMARY_SYN, SUCCESS_SYN, expItem, RE_EXP_RULE, RE_EXP_BLOCK, RE_EXP_SEP,
  expInline, RE_MD_ESCAPE, MD_ENTITIES, mdPlainText, nextPlainStop, expFence, expCells, expTable, expList, expBlocks,
  markdownToHtml, shiftHeadings, squeezeBlankLines, artifactBody, sectionText, specTitle, titledSlug, mdCell, utcStamp,
  italic, exportAcLine, exportStories, requirementSections, exportFeatureDoc, exportProjectDoc, exportMd, EXPORT_CSS,
  EXPORT_JS, exportHtml, exportSpecs, exportGherkin, __link };
