"use strict";

/**
 * dev-spec-driven engine — markdown readers and template placeholders.
 * The ONE reader of HTML comments (commentLines), fences (closesFence / fenceStep), headings and sections
 * (headingIndex, headingMatches, extractSection), the artifact ID readers built on them (requirementAcIds, planIdText),
 * and what a scaffold still waits for: the template corpus (a lookup, never a guess from the shape), the bracket scan,
 * artifact states and the per-artifact / per-chain placeholder views the gates read.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { CTX } = require("./ctx.js"); // the shared per-call state (mutated in place)
const { MARKER_TRACKS } = require("./tracks.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let atxHeading, backtickRuns, chainArtifacts, codeSpans, detectTracks, engineVersion, existingFeature, extractAcIds,
  featureFlow, flowPhaseIndex, hasOutsideCode, inactiveMarkerLines, inactiveTaskLines, indentOf, isPackMarkerBracket,
  markerTracks, OPTIONAL_TRACKS, packRegistry, parseTasks, projectTemplateHas, readIfExists, replaceCodeSpans,
  stripSupersedes, taskDescription, trackLabel, trackMarker, useTemplateScopeOf, VALID_TRACKS;
function __link(E) { ({ atxHeading, backtickRuns, chainArtifacts, codeSpans, detectTracks, engineVersion, existingFeature,
  extractAcIds, featureFlow, flowPhaseIndex, hasOutsideCode, inactiveMarkerLines, inactiveTaskLines, indentOf,
  isPackMarkerBracket, markerTracks, OPTIONAL_TRACKS, packRegistry, parseTasks, projectTemplateHas, readIfExists,
  replaceCodeSpans, stripSupersedes, taskDescription, trackLabel, trackMarker, useTemplateScopeOf, VALID_TRACKS } = E); }

// The text minus its HTML comments (commentLines' reading: a "<!--" in fenced code or an inline code span is text, one
// that never closes is text). A comment spanning lines takes its line breaks with it, as the old regex did.
function stripHtmlComments(s) {
  const text = String(s || "");
  if (!text.includes("<!--")) return text;
  const lines = text.split("\n");
  const cl = commentLines(lines);
  let out = "";
  cl.forEach((c, i) => {
    if (c.hidden) return;
    out += c.vis;
    if (!c.open && i < lines.length - 1) out += "\n";
  });
  return out;
}
// HTML comments as a markdown reader sees them, line by line — the ONE comment rule of stripHtmlComments, criterionBlocks
// and visibleLines (the tasks scanner, scanTaskLines, adds its own list-item / paragraph reach). Fenced code (fenceStep)
// and inline code spans are code: a "<!--" there is text (1.14 full review Pa3 — an AC saying "contains `<!--`" hid every
// criterion down to the next "-->" from EARS, trace_check and the placeholder scan). A "<!--" outside code opens a
// comment only when a "-->" outside code follows it, on its line or a later one (one that never closes is text); an open
// comment ends at the first "-->", whatever it sits in (inside a comment nothing is code). Linear.
// lines: the text split on "\n" (a trailing "\r" is harmless). → per line { vis, fence, hidden, open }: vis = the line
// minus its comments; fence = fenceStep's verdict ("open" | "code" | null — a fence line keeps vis = the line); hidden =
// the line lies wholly inside a comment; open = a comment is still open at its end.
function commentLines(lines) {
  const n = lines.length;
  let closerAfter = null; // closerAfter[i]: a "-->" outside fenced code and code spans on a line after i
  const later = (i) => {
    if (!closerAfter) {
      const pre = { fence: null };
      const has = lines.map((l) => !fenceStep(pre, l) && l.includes("-->") && hasOutsideCode(l, "-->"));
      closerAfter = new Array(n).fill(false);
      for (let j = n - 2; j >= 0; j--) closerAfter[j] = has[j + 1] || closerAfter[j + 1];
    }
    return closerAfter[i];
  };
  const out = [];
  const st = { fence: null };
  let comment = false;
  for (let i = 0; i < n; i++) {
    const raw = lines[i];
    let k = 0;
    if (comment) {
      const end = raw.indexOf("-->");
      if (end === -1) { out.push({ vis: "", fence: null, hidden: true, open: true }); continue; }
      comment = false;
      k = end + 3;
    } else {
      const fl = fenceStep(st, raw);
      if (fl) { out.push({ vis: raw, fence: fl, hidden: false, open: false }); continue; }
    }
    let lt = raw.indexOf("<!--", k);
    if (lt === -1) { out.push({ vis: k ? raw.slice(k) : raw, fence: null, hidden: false, open: false }); continue; }
    const ticks = backtickRuns(raw);
    let closers = null; // this line's "-->" outside code spans, ascending
    const closesOnLine = (from) => {
      if (!closers) {
        closers = [];
        const t2 = backtickRuns(raw);
        for (let q = 0; q < raw.length;) {
          if (raw[q] === "`") q = t2.spanEnd(q);
          else if (raw.startsWith("-->", q)) { closers.push(q); q += 3; } else q++;
        }
      }
      return closers.length > 0 && closers[closers.length - 1] >= from;
    };
    let vis = "";
    let bt = raw.indexOf("`", k);
    while (k < raw.length) {
      if (comment) {
        const end = raw.indexOf("-->", k);
        if (end === -1) { k = raw.length; break; }
        comment = false;
        k = end + 3;
        continue;
      }
      if (bt !== -1 && bt < k) bt = raw.indexOf("`", k);
      if (lt !== -1 && lt < k) lt = raw.indexOf("<!--", k);
      if (lt === -1) { vis += raw.slice(k); break; }
      if (bt !== -1 && bt < lt) { const e = ticks.spanEnd(bt); vis += raw.slice(k, e); k = e; continue; } // a code span: text
      if (closesOnLine(lt + 4) || later(i)) { vis += raw.slice(k, lt); comment = true; } else vis += raw.slice(k, lt + 4);
      k = lt + 4;
    }
    out.push({ vis, fence: null, hidden: false, open: comment });
  }
  return out;
}
// Fenced code blocks blanked line for line (the fence lines too) — criterionBlocks' fence rule, so an ID in a ``` example
// is never a real one. Lines are kept (as empty ones): line-based rules — a table row, a marker's wrap — read the same.
// An unclosed fence inside a list item ends with the item (fenceStep).
function stripFencedCode(s) {
  const st = { fence: null };
  return String(s || "").split("\n").map((line) => (fenceStep(st, line) ? "" : line)).join("\n");
}
// requirements.md's own AC IDs as the tools read them: outside HTML comments and fenced code, `_Supersedes:_`
// references (another feature's ACs) left out.
function requirementAcIds(reqText) {
  return extractAcIds(stripSupersedes(stripFencedCode(stripHtmlComments(reqText))));
}
// test-plan.md as every reader of its IDs sees it — trace_check's coverage and planned T-IDs, its test-code scan, the
// Phase 4 gate, doctor, finish, the brief and impact: outside HTML comments AND fenced code. A fenced example row
// (`| T-02 | US-1.AC-2 | … |` in a ```md block) is no planned test: it counted as coverage (a false traceability pass for an
// AC with no real row) and as a planned T-ID the tests gate then demanded in the test code.
function planIdText(planText) {
  return stripFencedCode(stripHtmlComments(planText));
}

// Count unresolved [NEEDS CLARIFICATION: ...] markers in real content (not template comments).
function clarificationMarkers(md) {
  const text = stripHtmlComments(md);
  const out = [];
  const re = /\[NEEDS[ _-]CLARIFICATION:?([^\]\n]{0,500})\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) out.push((m[1] || "").trim());
  return out;
}
// The scaffold's own +saas/+ai track tasks (every language): their descriptions are template text until the
// user edits them — "Emit metrics, add dashboard, configure alerts" is not a breakdown yet. Built-in: the pre-generated
// corpus (builtinCorpus) or rendered.
let TEMPLATE_TASKS = null;
function templateTaskSet() {
  if (TEMPLATE_TASKS) return TEMPLATE_TASKS;
  const c = builtinCorpus();
  return (TEMPLATE_TASKS = new Set(c ? c.tasks : renderTemplateTasks()));
}
function renderTemplateTasks() {
  const set = new Set();
  for (const l of i18n.LANGS) {
    for (const t of parseTasks(i18n.tasks({ name: "x", tracks: VALID_TRACKS, label: "", slug: "x" }, l))) set.add(taskDescription(t.text));
  }
  return [...set];
}
// The bugfix steps (every language). They ARE the method — kept verbatim, so never placeholders — but on a
// fresh bugfix they don't mean "broken into tasks" yet: detectPhase counts them once the planning chain is filled.
let BUG_STEPS = null;
const renderBugSteps = () => i18n.LANGS.flatMap((l) => parseTasks(i18n.bugTasks("x", l)).map((t) => taskDescription(t.text)));
function bugStepSet() {
  if (!BUG_STEPS) { const c = builtinCorpus(); BUG_STEPS = new Set(c ? c.bugSteps : renderBugSteps()); }
  return BUG_STEPS;
}
function isBugStep(text) {
  const d = taskDescription(text);
  return bugStepSet().has(d) || projectTemplateHas("bugSteps", d); // + the project's bug-tasks template (1.14)
}
// A scaffold task: its whole description is a [bracketed placeholder] (after the known tags), or it is
// still the verbatim text of a +saas/+ai template task — or of a task of the project's tasks template (1.14).
function isPlaceholderTask(text) {
  const rest = taskDescription(text);
  return /^\[[^\]]*\]$/.test(rest) || templateTaskSet().has(rest) || projectTemplateHas("tasks", rest);
}
// A fence opener as CommonMark reads it: a backtick fence's info string holds no backtick — "```US-1.AC-1``` is how
// an ID looks." is inline code, not a fence that would turn the rest of the file into code (and hide every AC below it).
const RE_FENCE = /^\s*(`{3,}(?![^`]*`)|~{3,})/;
// A fence closer as CommonMark reads it: the opener's character, at least as long, and nothing after it but spaces.
const RE_FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/;
// Does `line` close the fence opened by `fence` (its marker: "```", "~~~~" …)? The ONE closer rule of every fence-aware
// reader: a closer carries no info string, so "```js" inside an open ``` block is code — it used to close the block and
// the rest of the file read inverted (the code below as prose, the prose after the real closer as code).
function closesFence(line, fence) {
  const c = String(line).match(RE_FENCE_CLOSE);
  return !!c && c[1][0] === fence[0] && c[1].length >= fence.length;
}
// One line of a fence-aware reader (stripFencedCode, criterionBlocks, placeholderReport, headingIndex, designSections).
// st.fence: the open fence ({ mark, indent }) or null. → "open" (this line opens a fence) | "code" (a fence line, or a line
// inside one) | null (not code). As in CommonMark — and the tasks scanner (fenceLine) — a fence opened inside a list item
// (indented) ends with that item: a non-blank line LESS indented than its opener (the next "- T-02 …", a heading or a
// table row at the margin) is outside it. One unclosed fence in a test-plan bullet used to blank every row below it —
// their T-IDs planned nothing and covered nothing (trace_check, the Phase 4 gate, the brief) — while a renderer showed them.
function fenceStep(st, line) {
  if (st.fence) {
    if (closesFence(line, st.fence.mark)) { st.fence = null; return "code"; }
    if (!(st.fence.indent > 0 && line.trim() && indentOf(line) < st.fence.indent)) return "code";
    st.fence = null; // the list item ended, and its unclosed fence with it: this line is read as usual
  }
  const m = line.match(RE_FENCE);
  if (m) { st.fence = { mark: m[1], indent: indentOf(line) }; return "open"; }
  return null;
}

// Every test-plan entry that belongs to a T-ID — ALL of them, not testIndex's first row per ID (a T-ID may have a row in
// the matrix and another in a "non-functional checks" table): each table row whose FIRST cell holds a T-ID, with its
// cells and its table's header cells, and each list item that starts with a T-ID, with its continuation lines (sub-bullets
// indented under it, a lazy continuation before any blank line). → [{ ids: [T-ID …], text, cells, header }]
const tableCells = (line) => line.trim().replace(/^\|/, "").replace(/\|\s*$/, "").split(/(?<!\\)\|/).map((c) => c.trim());

// Heading lines outside fenced code (a "# comment" inside a bash block is not a heading).
function headingIndex(lines) {
  const out = [];
  const fst = { fence: null };
  lines.forEach((l, i) => {
    if (fenceStep(fst, l)) return;
    if (/^#{1,6}\s/.test(l)) out.push(i);
  });
  return out;
}

// Does a heading line name one of the synonyms? Never a level-1 title — it carries the feature NAME
// ("# Feature: Weekly summary email", "# Bug: Fix login crash" used to BE the Summary / Fix section). The
// synonym must START the heading text, after an optional [SaaS]/[AI] marker, numbering ("1.", "10)",
// "Section 1:" — the form references/mandatory-ai-design-sections.md uses) and emphasis, and end at a word
// boundary ("fix" ≠ "Fixtures").
// An emoji (with its variation selector / joiner / skin tone) before or after the marker is decoration too:
// "## 🔐 [SEC] Threat Model" (full review Pb4).
const headingLeadSource = (markers) => "^(?:[\\s*_—–:-]+|[\\p{Extended_Pictographic}\\u{1F3FB}-\\u{1F3FF}\\u{FE0E}\\u{FE0F}\\u{200D}\\u{20E3}]+|\\[(?:" + markers.join("|") +
  ")\\]|(?:section|sec[çc][ãa]o|se[çc][ãa]o|secci[óo]n)\\s+\\d+[.:)]?(?=\\s|$)|\\d+(?:\\.\\d+)*[.):]?(?=\\s))";
const RE_HEADING_LEAD = new RegExp(headingLeadSource(MARKER_TRACKS), "u");
// + the project's track packs' markers (1.15), lower-cased as the heading text is: [A-Z0-9] tokens (validated) — regex-safe.
let HEADING_LEAD_PACKS = { key: "", re: RE_HEADING_LEAD };
function headingLeadRe() {
  const packs = packRegistry().packs;
  if (!packs.length) return RE_HEADING_LEAD;
  const key = packs.map((p) => p.token).join("|");
  if (HEADING_LEAD_PACKS.key !== key) HEADING_LEAD_PACKS = { key, re: new RegExp(headingLeadSource(MARKER_TRACKS.concat(packs.map((p) => p.token.toLowerCase()))), "u") };
  return HEADING_LEAD_PACKS.re;
}
// inflect (the marker tracks' sections — full review Pb4): an English inflection of the synonym's last word names the same
// section — "Threat Modeling" / "Threat Modelling" / "Threat Models" are the Threat Model.
const RE_SYN_INFLECTION = /^(?:s|es|ing|ling)(?![\p{L}\p{N}])/u;
function headingMatches(line, syns, inflect) {
  const m = atxHeading(line, 2, 6, "raw"); // /^#{2,6}\s+(.*)$/
  if (!m) return false;
  let t = m.text.toLowerCase();
  const lead = headingLeadRe();
  for (let prev = null; prev !== t;) { prev = t; t = t.replace(lead, ""); }
  return syns.some((s) => t.startsWith(s) && (!/[\p{L}\p{N}]/u.test(t.charAt(s.length)) || (inflect && RE_SYN_INFLECTION.test(t.slice(s.length)))));
}

// marker = "[SaaS]" / "[AI]": a heading carrying the track marker wins, so "[AI] Observability for AI"
// can no longer stand in for "[SaaS] Observability". Unmarked headings are the fallback (hand-written
// designs), but never one that carries the OTHER track's marker. Markers are case-sensitive tokens (C4).
// `loose` (C4): the synonyms of a track section that are ordinary words in a design ("Processors", "Retention",
// "Conservação", "Data inventory", "Avaliação de impacto") — they name the section only on a heading that carries the
// marker, or on an unmarked heading nested under a heading that does (the track's context: `## [PRIVACY] Processing` →
// `### Processors`). Without that, deleting a `[PRIVACY]` heading let a core heading like "## Processors and queues"
// satisfy "Processors & International Transfers" and doctor passed a section nobody wrote. The other synonyms are
// unambiguous and keep the unmarked fallback anywhere (hand-written and PT/ES designs without markers, the reference
// templates' "## Observability" / "## Section 1: Model Strategy").
function extractSection(md, synonyms, marker, loose) {
  const syns = (Array.isArray(synonyms) ? synonyms : [synonyms]).map((s) => s.toLowerCase());
  const looseSet = new Set((loose || []).map((s) => s.toLowerCase()));
  const strict = looseSet.size ? syns.filter((s) => !looseSet.has(s)) : syns;
  const lines = (md || "").split(/\r?\n/);
  const heads = headingIndex(lines);
  const matches = (i, list) => headingMatches(lines[i], list || syns, !!marker); // a track section's heading may inflect its name
  const level = (l) => (lines[l].match(/^(#{1,6})\s/) || ["", "######"])[1].length;
  // The nearest enclosing heading (a lower level, above i) carries the marker: the heading sits in the track's context.
  const inTrackContext = (i) => {
    let lv = level(i);
    for (let k = heads.indexOf(i) - 1; k >= 0 && lv > 1; k--) {
      const h = heads[k];
      if (level(h) >= lv) continue;
      if (lines[h].includes(marker)) return true;
      lv = level(h);
    }
    return false;
  };
  const MARKERS = markerTracks().map((t) => trackMarker(t)); // + the track packs' (1.15)
  let start = -1;
  if (marker) start = heads.find((i) => lines[i].includes(marker) && matches(i));
  if (start == null || start === -1) {
    const other = marker ? MARKERS.filter((m) => m !== marker) : [];
    start = heads.find((i) => (matches(i, strict) || (marker && looseSet.size && matches(i) && inTrackContext(i))) && !other.some((m) => lines[i].includes(m)));
  }
  if (start == null || start === -1) return null;
  const end = heads.find((i) => i > start && level(i) <= level(start));
  return lines.slice(start + 1, end == null ? lines.length : end).join("\n");
}

// The indent is read within its line ([^\S\n\r\u2028\u2029], not \s — a line start of a long blank run rescanned the whole
// run, 1.17 H): the line holding the '>' matches either way, and every reader only asks whether one does.
const RE_TODO_SENTINEL = /^[^\S\n\r\u2028\u2029]*>\s*\*\*TODO\*\*/m;
const ROOT_CAUSE_SYN = ["root cause", "causa raiz", "causa raíz"];
const REPRO_SYN = ["reproduction", "reprodução", "reproducao", "reproducción", "reproduccion"];
function sectionState(design, sections, marker) {
  return sections.map((sec) => {
    const body = extractSection(design, sec.syn, marker, sec.loose);
    if (body == null) return { section: sec.name, status: "missing" };
    // Unfilled = the scaffold sentinel is still there, or nothing real was written (blank is not an answer).
    if (RE_TODO_SENTINEL.test(body) || !stripHtmlComments(body).trim()) return { section: sec.name, status: "unfilled" };
    return { section: sec.name, status: "filled" };
  });
}

// ---------------------------------------------------------------------------
// Template placeholders — what a scaffold still waits for (the gates build on these two)
// ---------------------------------------------------------------------------

// Bracket contents that are never a placeholder: English-stable tags, stable IDs (alone or as a list).
// The list separator is UNAMBIGUOUS — `\s*(?:[,;/]\s*)?`, never `\s*[,;/]?\s*`: with the separator optional
// between two `\s*`, every whitespace gap could split two ways and a failing match (`[US-1 US-2 … and more]`)
// backtracked 2^k — 26 space-separated IDs froze the MCP server and pushed the hooks past their timeout.
const RE_STABLE_BRACKET = /^(?:US\d+|P\d?|shared|SaaS|AI|SEC|PRIVACY|DIST|API|UI|OBS|DATA|x)$|^\s*(?:US-\d+(?:\.AC-\d+)?|AC-\d+|T-\d+|SC-\d+|EC-\d+|NFR-\d+)(?:\s*(?:[,;/]\s*)?(?:US-\d+(?:\.AC-\d+)?|AC-\d+|T-\d+|SC-\d+|EC-\d+|NFR-\d+))*\s*$/i;
const RE_REF_DEFINITION = /^\s{0,3}\[([^\]]+)\]:\s*\S/;
// The core-only Signals answer scaffolds before 1.13 wrote in brackets (`- [none beyond core]`, PT/ES): the tool's own
// final answer, never a slot — the classification.md of every core-only feature created by 1.12 still holds it.
const RE_LEGACY_ANSWER = /^\s*(?:none beyond core|nenhum além de core|ninguno además de core)\s*$/i;
const RE_LIST_CHECKBOX = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\](?=\s|$)/;

// A bracket is a TEMPLATE PLACEHOLDER only when its text is one a scaffold actually writes — a deterministic lookup,
// never a guess from its shape. 1.13 first guessed (bracketed prose = a slot, a written-out one-token enumeration =
// content), and a criterion quoting real values — `[free: 60, pro: 600, enterprise: 6000]`, `[admin, billing-manager,
// read only]`, `[10 MB, 25 MB for pro]` — read as a slot: the approval was refused and finished, upgraded 1.12 specs
// were blocked (doctor FAIL, next_action "fill requirements.md" at 5/5 tasks, finish refused). The set
// (templateSets) holds every bracket text the CURRENT templates render (templateCorpus: every builder, EN/PT/ES,
// every track combination and kind, the track / import task slots, the steering stubs — pt-BR's derived ones in
// templateSetsBr, built on the first miss), every bracket text the 1.12.1
// templates rendered (LEGACY_TEMPLATE_PLACEHOLDERS: a spec scaffolded by 1.12 still holds those), and the generic unfilled
// tokens (isGenericSlot: TODO, TBD, TBC, FIXME, "...", "…"). Anything else in brackets is the user's own content.
// The key ignores case, spacing and "…" vs "...": `[Story title]` is `[story   title]`.
const placeholderKey = (inner) => String(inner).normalize("NFC").replace(/…/g, "...").replace(/\s+/g, " ").trim().toLowerCase();
// TODO / TBD / TBC / FIXME (alone or leading: "[TBD: pricing]"), an ellipsis, "a definir" / "por definir". TODO is
// matched upper-case only: "todo" is a Portuguese / Spanish word.
function isGenericSlot(inner) {
  const t = String(inner).trim();
  return /^TODO(?![\p{L}\p{N}_])/u.test(t) || /^(?:tbd|tbc|fixme)(?![\p{L}\p{N}_])/iu.test(t) || /^(?:\.{3,}|…+)$/u.test(t) || /^(?:a|por) definir$/iu.test(t);
}
// The stub `spec_init` writes for a steering file with no template (the file name is the user's; the slot is fixed).
const unknownSteeringStub = (f) => `# ${f.replace(/\.md$/, "")}\n\n[fill me in]\n`;
// The bracket texts the 1.12.1 templates rendered (and the current ones no longer do) — extracted ONCE from
// `git show main:mcp/lib/i18n.js` (1.12.1) by rendering every builder (classification, requirements, design + the
// track blocks, tasks, test plan, eval plan, load test, quickstart, checklist, integration plan, the bugfix templates,
// the prompt stub, the steering stubs; EN/PT/ES; every track combination; a dummy name) and reading each bracket as
// templateBracketKeys does. A 1.12 spec that still holds one of them is still a template there; the texts the current
// templates share with 1.12.1 come from templateCorpus.
const LEGACY_TEMPLATE_PLACEHOLDERS = [
  "", "0.03", "0.1", "1-2 frases: o que faz e porque importa", "1-2 frases: qué hace y por qué importa",
  "1-2 sentences: what this does and why it matters", "85", "98", "a condição que provoca o bug", "acción específica",
  "aciona uma condição de erro de um ac se...então", "advisory | semi-autonomous | autonomous",
  "algo assumido como verdadeiro que, se for falso, muda a spec",
  "algo asumido como verdadero que, si es falso, cambia la spec", "always-true property",
  "ambiente / dados / contas necessárias", "anything assumed true that, if wrong, changes the spec",
  "auth, validación, riesgos de exposición de datos", "auth, validation, data exposure risks",
  "auth, validação, riscos de exposição de dados", "ação específica", "behavior", "behavior for us-2", "beneficio",
  "benefit", "benefício", "caminho", "caminho → alteração", "capability", "capacidad", "capacidade", "carga, ~$/mes",
  "carga, ~$/mês", "cenário", "clocks, randomness, ids abstracted how", "comando da suite de testes completa",
  "comando de la suite de pruebas completa", "comando que lo demuestra, p. ej.: npm test -- ruta/fichero.test.js",
  "comando que o prova, ex.: npm test -- caminho/ficheiro.test.js",
  "command that proves it, e.g. npm test -- path/to/file.test.js",
  "como desempatar — ex.: 'preferir o aborrecido/comprovado ao engenhoso'.", "como gera receita",
  "como isto se integra com o sistema existente. decisões-chave e fundamentação.", "como testar esta sozinha",
  "componentes/módulos existentes que esta feature toca", "componentes/módulos existentes que esta función toca",
  "comportamento", "comportamento central para us-1", "comportamento correto", "comportamento esperado",
  "comportamento para us-2", "comportamiento", "comportamiento central para us-1", "comportamiento correcto",
  "comportamiento esperado", "comportamiento para us-2", "condición de error", "condição de erro",
  "consultivo | semi-autónomo | autónomo", "core behavior for us-1", "correct behavior",
  "cómo desempatar — p.ej., 'preferir lo aburrido/probado a lo ingenioso'.", "cómo genera ingresos",
  "cómo se integra esto con el sistema existente. decisiones clave y justificación.", "cómo testear esta sola",
  "depois isto", "directory tree", "dispara una condición de error de un ac si...entonces", "disparador", "do this",
  "docs, cleanup, edge-case hardening", "docs, limpeza, robustez de casos limite",
  "docs, limpieza, robustez de casos límite", "dónde inyectar test doubles",
  "e.g. node >= 20 · no new runtime dependencies · api field names in snake_case",
  "e.g., 90% of users complete [task] in under [n] seconds", "e.g., backend service", "e.g., db migrations",
  "e.g., error rate on [flow] stays below [n]%", "e.g., errors fail closed (deny) on the security path.",
  "e.g., every write is idempotent or explicitly justified.",
  "e.g., no breaking api change without a versioned migration path.",
  "e.g., no pii in logs; user ids are pseudonymized.", "e.g., second cache layer", "e.g., wire ui",
  "el comportamiento correcto", "el comportamiento vecino que ya funcionaba", "entorno / datos / cuentas necesarias",
  "entradas cercanas que deben seguir funcionando", "env / data / accounts needed", "error condition", "escenario",
  "estado", "estrategia por modo de fallo a partir de los requisitos",
  "estratégia por modo de falha a partir dos requisitos",
  "ex.: 90% dos utilizadores completam [tarefa] em menos de [n] segundos",
  "ex.: a taxa de erro em [fluxo] mantém-se abaixo de [n]%", "ex.: ligar a ui", "ex.: migrações de bd",
  "ex.: node >= 20 · sem dependências de runtime novas · campos da api em snake_case",
  "ex.: os erros falham fechados (negar) no caminho de segurança.", "ex.: segunda camada de cache",
  "ex.: sem alteração de api com quebra sem um caminho de migração versionado.",
  "ex.: sem pii nos logs; os ids de utilizador são pseudonimizados.", "ex.: serviço de backend",
  "ex.: toda a escrita é idempotente ou explicitamente justificada.",
  "exact values the fix must respect — versions, limits, formats", "existing components/modules this feature touches",
  "expected behavior", "factories, fixtures, seeds", "faz isto", "flow", "flujo", "fluxo", "full test suite command",
  "gatilho", "gdpr | pci | hipaa | soc2 | nenhuma", "gdpr | pci | hipaa | soc2 | ninguna",
  "gdpr | pci | hipaa | soc2 | none", "graceful handling", "hard tech/regulatory constraints that bound all designs.",
  "haz esto", "how it makes money", "how this integrates with the existing system. key decisions and rationale.",
  "how to break ties — e.g., 'prefer boring/proven over clever'.", "how to test this alone",
  "inputs próximos que têm de continuar a funcionar", "la condición que provoca el bug",
  "lo que esta función no incluye", "lo que esto explícitamente no es",
  "lo que ocurre — mensaje de error, salida, líneas de log", "load, ~$/month", "luego esto", "manejo elegante",
  "measurable performance / security / accessibility constraint", "mensagem do utilizador / {{variáveis}}",
  "mensaje del usuario / {{variables}}", "mitigación / rollback", "mitigation / rollback", "mitigação / rollback",
  "modelos, schemas, índices compartidos entre historias", "modelos, schemas, índices partilhados entre histórias",
  "models, schemas, indexes shared across stories", "métrica específica a 6 meses", "n",
  "nearby inputs that must keep working", "nenhuma", "network, fs, time, external services", "ninguna", "none",
  "o comportamento correto", "o comportamento vizinho que já funcionava",
  "o que acontece — mensagem de erro, output, linhas de log", "o que cada um cobre", "o que esta feature não inclui",
  "o que falha se isto estiver errado? quem é afetado? recuperável? em quanto tempo?",
  "o que isto explicitamente não é", "o que muda e porque é que elimina a causa raiz — uma correção, não um pacote.",
  "o que tem de mudar no código existente, e porquê", "observable result tied to a success criterion, e.g. sc-001",
  "onde injetar test doubles", "one line: the bug being fixed", "one line: what is broken, for whom, since when",
  "one sentence: what is this product and who is it for?",
  "p. ej.: node >= 20 · sin dependencias de runtime nuevas · campos de la api en snake_case",
  "p.ej., 90% de los usuarios completan [tarea] en menos de [n] segundos", "p.ej., conectar la ui",
  "p.ej., la tasa de error en [flujo] se mantiene por debajo de [n]%",
  "p.ej., los errores fallan cerrados (denegar) en la ruta de seguridad.", "p.ej., migraciones de bd",
  "p.ej., segunda capa de caché", "p.ej., servicio de backend",
  "p.ej., sin cambio de api con ruptura sin una ruta de migración versionada.",
  "p.ej., sin pii en los logs; los ids de usuario se pseudonimizan.",
  "p.ej., toda escritura es idempotente o explícitamente justificada.", "papel",
  "parallelizable task — different file, no deps", "path", "path → change", "por qué es la porción mínima viable",
  "por qué la opción simple falla", "por qué se aplica", "porque a opção simples falha", "porque se aplica",
  "porque é a fatia mínima viável", "principio 1", "principio 2", "principle 1", "principle 2", "princípio 1",
  "princípio 2", "project/dev setup if needed — deps, scaffolding", "propiedad siempre verdadera",
  "propriedade sempre verdadeira", "quem mais lhe toca?", "quem usa isto diariamente?",
  "qué cambia y por qué elimina la causa raíz — una corrección, no un paquete.", "qué cubre cada uno",
  "qué debe cambiar en el código existente, y por qué", "razão", "razón", "reason", "recovery", "recuperación",
  "recuperação", "red, fs, tiempo, servicios externos", "rede, fs, tempo, serviços externos",
  "relojes, aleatoriedad, ids abstraídos cómo", "relógios, aleatoriedade, ids abstraídos como",
  "restricciones técnicas/regulatorias rígidas que limitan todos los diseños.",
  "restricción medible de rendimiento / seguridad / accesibilidad",
  "restrição mensurável de desempenho / segurança / acessibilidade",
  "restrições técnicas/regulatórias rígidas que limitam todos os designs.",
  "resultado observable vinculado a un criterio de éxito, p.ej. sc-001",
  "resultado observável ligado a um critério de sucesso, ex. sc-001", "riesgo", "risco", "risk", "rol", "role", "ruta",
  "ruta → cambio", "scenario", "setup de projeto/dev se necessário — deps, scaffolding",
  "setup de proyecto/dev si hace falta — deps, scaffolding", "señal", "signal",
  "sim/não — se sim, load-test.md é obrigatório.", "sinal", "specific 6-month metric", "specific action",
  "specific value", "state", "story title", "strategy per failure mode from requirements",
  "sí/no — si sí, load-test.md es obligatorio.", "tarea", "tarea paralelizable — archivo distinto, sin deps", "tarefa",
  "tarefa paralelizável — ficheiro diferente, sem deps", "task", "the condition that triggers the bug",
  "the correct behavior", "the neighbouring behavior that already worked", "then this", "tratamento controlado",
  "trigger", "trigger an error condition from an if...then ac", "título da história", "título de la historia",
  "ubicuo", "ubiquitous", "ubíquo", "uma frase: o que é este produto e para quem é?", "uma linha: o bug a corrigir",
  "uma linha: o que está partido, para quem, desde quando", "una frase: ¿qué es este producto y para quién es?",
  "una línea: el bug a corregir", "una línea: qué está roto, para quién, desde cuándo", "unit/integración",
  "unit/integration", "unit/integração", "user message / {{variables}}", "valor específico",
  "valores exactos que la corrección debe respetar — versiones, límites, formatos",
  "valores exatos que a correção tem de respeitar — versões, limites, formatos",
  "what breaks if this is wrong? who is affected? recoverable? how fast?",
  "what changes and why it removes the root cause — one fix, not a bundle.", "what each covers",
  "what happens — error message, output, log lines", "what must change in existing code, and why",
  "what this feature does not include", "what this is explicitly not", "where test doubles inject",
  "who else touches it?", "who uses this daily?", "why it applies", "why the simple option fails",
  "why this is the minimum viable slice", "yes/no — if yes, load-test.md is required.", "¿quién más lo toca?",
  "¿quién usa esto a diario?", "¿qué se rompe si esto está mal? ¿a quién afecta? ¿recuperable? ¿en cuánto tiempo?",
  "árbol de directorios", "árvore de diretórios"
];
function templateCorpus(langs) {
  const out = [];
  const add = (fn) => { try { const t = fn(); if (typeof t === "string") out.push(t); } catch { /* a builder's trouble never breaks placeholder detection */ } };
  // Every set of at most TWO optional tracks, plus all of them — the builders compose per track, and the only interplay
  // they have is pairwise (+tdd's test IDs / green lines with another track, "+saas or +ai"), so pairs render every text
  // a larger set does (for three tracks this IS the full power set; it grows quadratically, not 2^n, as tracks are added).
  const combos = [[], ...OPTIONAL_TRACKS.map((t) => [t]), ...OPTIONAL_TRACKS.flatMap((t, i) => OPTIONAL_TRACKS.slice(i + 1).map((u) => [t, u])), OPTIONAL_TRACKS]
    .map((x) => ["core", ...x]);
  const signals = { tdd: ["tdd"], saas: ["tenant"], ai: ["llm"], sec: ["owasp"], privacy: ["gdpr"], dist: ["kafka"], api: ["openapi"], ui: ["wcag"], obs: ["slo"], data: ["etl"] };
  for (const l of langs || i18n.BASE_LANGS) { // the authored locales; pt-BR's slots come from pt's lines (templateSetsBr)
    const M = i18n.msg(l);
    for (const tracks of combos) {
      const a = { name: "x", tracks, label: trackLabel(tracks), slug: "x", summary: "" };
      add(() => i18n.classification(a, l));
      add(() => i18n.classification({ ...a, signals }, l));
      add(() => i18n.requirements(a, l));
      add(() => i18n.design(a, l));
      add(() => i18n.tasks(a, l));
      add(() => i18n.testPlan("x", l, tracks));
      add(() => i18n.checklist(a, l));
    }
    add(() => i18n.testPlan("x", l, VALID_TRACKS, ["US-1.AC-1"]));
    add(() => i18n.testPlan("x", l, ["core", "tdd"], [])); // requirements that define no AC yet: one generic row (Pa4)
    for (const tr of VALID_TRACKS) {
      add(() => i18n.trackDesignBlock(tr, l));
      add(() => M.tracks.taskBlock(tr, 1));
      add(() => M.tracks.acPlaceholder(tr));
    }
    for (const fn of [i18n.evalPlan, i18n.loadTest, i18n.quickstart, i18n.integrationPlan, i18n.promptStub, i18n.bugTestPlan, i18n.bugTasks]) add(() => fn("x", l));
    add(() => i18n.bugReport({ name: "x" }, l));
    add(() => i18n.bugRequirements({ name: "x" }, l));
    add(() => i18n.evalsReadme(l));
    for (const f of i18n.steeringKnownFiles()) add(() => i18n.steeringStub(f, l));
    add(() => M.scopedSteering.customStub("X", "src/api/**"));
    add(() => M.importSpec.taskAcPlaceholder + "\n" + M.importSpec.taskTestPlaceholder);
  }
  add(() => unknownSteeringStub("x.md"));
  return out;
}
// Every bracket group a text holds as the gates read it (visible lines, syntax and exempt groups set aside, nested
// groups too) → { brackets: [key], code: [key] } — code: a code span that is exactly one bracket group (`` `[path]` ``).
function templateBracketKeys(text, seen) {
  const brackets = [], code = [];
  const slot = (body) => { const b = body.match(/^\[([^[\]]*)\]$/); return !!b && !!b[1].trim(); };
  for (const [, line, refs] of visibleLines(text)) {
    if (seen && !refs.size) { if (seen.has(line)) continue; seen.add(line); } // the corpus repeats most lines
    for (const m of codeSpans(line)) if (slot(m.body.trim())) code.push(placeholderKey(m.body.trim().slice(1, -1)));
    scanBrackets(line, refs, slot, (inner, raw) => { brackets.push(placeholderKey(raw)); return false; });
  }
  return { brackets, code };
}
let TEMPLATE_SETS = null;
function templateSets() {
  if (TEMPLATE_SETS) return TEMPLATE_SETS;
  const c = builtinCorpus();
  return (TEMPLATE_SETS = c ? { brackets: new Set(c.brackets), code: new Set(c.code) } : renderTemplateSets());
}
function renderTemplateSets() {
  const brackets = new Set(LEGACY_TEMPLATE_PLACEHOLDERS), code = new Set();
  const seen = new Set();
  CTX.BUILTIN_CORPUS_BUILD++; // a process-wide cache: the current call's track packs never shape it (isPackMarkerBracket)
  try {
    for (const t of new Set(templateCorpus())) {
      const k = templateBracketKeys(t, seen);
      k.brackets.forEach((x) => brackets.add(x));
      k.code.forEach((x) => code.add(x));
    }
  } finally { CTX.BUILTIN_CORPUS_BUILD--; }
  return { brackets, code };
}
// pt-BR (1.14 D1) renders every pt template through i18n.toPtBr, whose rules never cross a line: its slots are exactly the
// pt corpus's visible bracket lines transformed one by one (the corpus is not rendered a fourth time). Built on the first
// bracket the EN/PT/ES sets don't know — checking a fresh EN/PT/ES scaffold never pays for it; only pt-BR's own keys are kept.
let TEMPLATE_SETS_BR = null;
function templateSetsBr() {
  if (TEMPLATE_SETS_BR) return TEMPLATE_SETS_BR;
  const c = builtinCorpus();
  return (TEMPLATE_SETS_BR = c ? { brackets: new Set(c.bracketsBr), code: new Set(c.codeBr) } : renderTemplateSetsBr(templateSets()));
}
function renderTemplateSetsBr(base) {
  const brackets = new Set(), code = new Set(), seen = new Set(), done = new Set();
  CTX.BUILTIN_CORPUS_BUILD++;
  try {
    for (const t of new Set(templateCorpus(["pt"]))) for (const [, line] of visibleLines(t)) {
      if (!line.includes("[") || done.has(line)) continue;
      done.add(line);
      const br = i18n.toPtBr(line);
      if (br === line) continue;
      const k = templateBracketKeys(br, seen);
      k.brackets.forEach((x) => { if (!base.brackets.has(x)) brackets.add(x); });
      k.code.forEach((x) => { if (!base.code.has(x)) code.add(x); });
    }
  } finally { CTX.BUILTIN_CORPUS_BUILD--; }
  return { brackets, code };
}

// ---------------------------------------------------------------------------
// The pre-generated built-in corpus (1.20)
// ---------------------------------------------------------------------------
// The built-in part of the corpus — templateSets, templateSetsBr, templateTaskSet, the bug steps — is the same in every
// process of one engine, and rendering it (1,165 texts, their pt-BR twins through toPtBr: ~200 ms) was the biggest slice of
// a hook or CLI call. scripts/build.js (`npm run build`) renders it ONCE with the functions above (renderCorpusData) into
// engine/corpus.generated.json, stamped with the engine version and the hash of CORPUS_SOURCES — every file the render runs
// through (mcp/test.js proves the list with V8 coverage). A process reads that file (one JSON.parse) only while both stamps
// match this engine; otherwise — a hand-edited clone that wasn't rebuilt, a missing or broken file — it renders as before:
// a slower answer, never a wrong one. Inside spec.bundle.js the corpus is the copy the build embedded beside the very sources
// it was rendered from (module.bundle — undefined under Node's own loader). The per-project part (the project's templates,
// its track packs: projectTemplateHas, packCorpusSets) stays computed per call. Only .has() is ever asked of these sets.
const CORPUS_FILE = "corpus.generated.json";
const CORPUS_KEYS = ["brackets", "code", "bracketsBr", "codeBr", "tasks", "bugSteps"];
const CORPUS_SOURCES = ["i18n.js", "i18n/common.js", "i18n/en.js", "i18n/es.js", "i18n/pt-br.js", "i18n/pt.js", "engine/core.js",
  "engine/markdown.js", "engine/packs.js", "engine/tasks.js", "engine/tracks.js"]; // mcp/lib-relative, in hash order
// A source file's text as the stamp reads it: a leading BOM and CRLF line ends are encoding, not code.
function sourceText(buf) {
  if (!buf.includes(13) && !(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)) return buf;
  const s = buf.toString("utf8").replace(/\r\n/g, "\n");
  return Buffer.from(s.charCodeAt(0) === 0xfeff ? s.slice(1) : s, "utf8");
}
// sha1 over CORPUS_SOURCES (each file's path and text) — libDir: the mcp/lib folder (default: this engine's).
function corpusSourcesHash(libDir) {
  const dir = libDir || path.join(__dirname, "..");
  const h = crypto.createHash("sha1");
  for (const rel of CORPUS_SOURCES) h.update(rel + "\0").update(sourceText(fs.readFileSync(path.join(dir, ...rel.split("/"))))).update("\0");
  return h.digest("hex");
}
// The built-in corpus as it renders now → { brackets, code, bracketsBr, codeBr, tasks, bugSteps }: sorted string lists (the
// sets' members — code-unit order, stable across Node versions). What scripts/build.js writes, and what the tests compare.
function renderCorpusData() {
  const sort = (xs) => [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const base = renderTemplateSets(), br = renderTemplateSetsBr(base);
  return { brackets: sort(base.brackets), code: sort(base.code), bracketsBr: sort(br.brackets), codeBr: sort(br.code),
    tasks: sort(renderTemplateTasks()), bugSteps: sort(new Set(renderBugSteps())) };
}
let BUILTIN_CORPUS = undefined; // undefined: not looked for yet · null: none usable (render) · else the data
let BUILTIN_CORPUS_FROM = "render"; // "file" | "bundle" | "render" — where this process's built-in corpus comes from
function builtinCorpus() {
  if (BUILTIN_CORPUS !== undefined) return BUILTIN_CORPUS;
  BUILTIN_CORPUS = null;
  try {
    const b = module.bundle; // set by spec.bundle.js's module registry only
    const data = b ? b.corpus() : JSON.parse(fs.readFileSync(path.join(__dirname, CORPUS_FILE), "utf8"));
    if (data && typeof data === "object" && CORPUS_KEYS.every((k) => Array.isArray(data[k]) && data[k].every((x) => typeof x === "string")) &&
      data.version === engineVersion() && data.sources === (b ? b.corpusSources : corpusSourcesHash())) {
      BUILTIN_CORPUS = data;
      BUILTIN_CORPUS_FROM = b ? "bundle" : "file";
    }
  } catch { /* missing, unreadable or malformed: render */ }
  return BUILTIN_CORPUS;
}
const builtinCorpusSource = () => { builtinCorpus(); return BUILTIN_CORPUS_FROM; };
// …and the slots of the project's own templates (.specs/templates/ — projectTemplateHas, 1.14).
const isTemplatePlaceholder = (inner) => { const k = placeholderKey(inner); return isGenericSlot(inner) || templateSets().brackets.has(k) || templateSetsBr().brackets.has(k) || projectTemplateHas("brackets", k); };
// A code span is opaque — `[Authorize]`, `[dependencies]`, `[aeiou]`, `[]`, `["a"]` are code — except a template's own
// code-span slot (the bugfix test plan's `[path]` / `[caminho]` / `[ruta]`), which is unwrapped and scanned.
const isCodeSlot = (body) => { const b = body.match(/^\[([^[\]]*)\]$/); if (!b) return false; const k = placeholderKey(b[1]); return templateSets().code.has(k) || templateSetsBr().code.has(k) || projectTemplateHas("code", k); };

// [lineNo, content, refs] — the lines a placeholder can sit on: HTML comments, fenced code and reference definitions
// set aside (refs: the reference labels those define, so a bare `[x]` with a `[x]: url` is a link).
function visibleLines(text) {
  const lines = String(text || "").split(/\r?\n/);
  const refs = new Set();
  const visible = [];
  // commentLines: fenced code (an unclosed fence in a list item ends with the item) and comments — a "<!--" that never
  // closes, or that sits in a code span or a fence, is text: it hides no placeholder below it.
  const cl = commentLines(lines);
  lines.forEach((raw, i) => {
    const c = cl[i];
    if (c.hidden || c.fence) return;
    const line = c.vis;
    const def = line.match(RE_REF_DEFINITION);
    if (def) { refs.add(def[1].trim().toLowerCase()); return; }
    visible.push([i + 1, line]);
  });
  return visible.map(([n, l]) => [n, l, refs]);
}

// [{ line, text, kind }] — the template placeholders left in `text` (1-based line, the placeholder as written,
// kind 'bracket' | 'todo'):
//   • a bracket whose text a template writes (isTemplatePlaceholder): `[trigger]`, `[1-2 sentences: what this does and
//     why it matters]`, `[N]`, `$[0.03]`, an empty `[]` / `[ ]` slot, the code-span slots (`` `[path]` ``), and the
//     generic TODO / TBD / FIXME / … tokens — a half-edited template sentence still reports the slot left inside it;
//   • the `> **TODO**` sentinel line.
// NOT placeholders: every other bracket (the user's own values — `[free: 60, pro: 600]`, `[owner, admin]`, `[0, 1]`),
// links/images `[x](y)`, reference links `[x][y]` (and a bare `[x]` whose `[x]: url` is defined), footnotes `[^1]`,
// callouts `> [!NOTE]`, wiki links `[[x]]`, list checkboxes `- [ ]` / `- [x]`, the English-stable tags ([US1] [P]
// [shared] [SaaS] [AI], priorities [P1]), stable IDs ([US-1.AC-1], [T-01]…), indexing glued to a word (`x[0]`), escaped
// `\[`, [NEEDS CLARIFICATION] (clarificationMarkers tracks those), the pre-1.13 core-only answer `[none beyond core]`
// (PT/ES too), every other code span, and anything inside HTML comments or fenced code. Language-agnostic.
function placeholderReport(text) {
  const out = [];
  for (const [ln, line, refs] of visibleLines(text)) {
    if (RE_TODO_SENTINEL.test(line)) { out.push({ line: ln, text: line.trim(), kind: "todo" }); continue; }
    bracketPlaceholders(line, refs).forEach((t) => out.push({ line: ln, text: t, kind: "bracket" }));
  }
  return out;
}

function bracketPlaceholders(line, refs) {
  const found = [];
  scanBrackets(line, refs, isCodeSlot, (inner, raw) => {
    if (!isTemplatePlaceholder(raw)) return false;
    found.push("[" + inner + "]");
    return true;
  });
  return found;
}

// The bracket groups of one line, outermost first: visit(inner, rawInner) → true = a placeholder (its nested groups are
// part of it), false = not (its nested groups are visited in turn — a template sentence half edited keeps its `[N]`).
// Syntax (links, reference links, footnotes, callouts, wiki links, glued indexing, the list checkbox) and the exempt
// contents (stable tags / IDs, NEEDS CLARIFICATION, the legacy core-only answer) are skipped whole, never visited.
// codeSlot(body) says which code spans are unwrapped; every other span is blanked (columns kept). Linear per line.
function scanBrackets(line, refs, codeSlot, visit) {
  const s = replaceCodeSpans(line, (m, tick, body) =>
    codeSlot(body.trim()) ? tick.replace(/`/g, " ") + body + tick.replace(/`/g, " ") : " ".repeat(m.length));
  const box = s.match(RE_LIST_CHECKBOX);
  const groupEnd = (i) => { // index of the "]" closing the "[" at i (nesting-aware), or -1
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "\\") { j++; continue; }
      if (s[j] === "[") depth++;
      else if (s[j] === "]" && --depth === 0) return j;
    }
    return -1;
  };
  const walk = (from, to) => {
    for (let i = from; i < to; i++) {
      if (s[i] === "\\") { i++; continue; }
      if (s[i] !== "[") continue;
      const j = groupEnd(i);
      if (j === -1 || j >= to) return; // unbalanced: nothing reliable after this point
      const inner = s.slice(i + 1, j);
      const before = i > 0 ? s[i - 1] : "";
      const after = s[j + 1] || "";
      let skip = after === "(" || /[\p{L}\p{N}_]/u.test(before) ||
        (inner.startsWith("[") && inner.endsWith("]")) || inner.startsWith("^") || inner.startsWith("!") ||
        refs.has(inner.trim().toLowerCase()) || RE_STABLE_BRACKET.test(inner) || /^NEEDS[ _-]CLARIFICATION/i.test(inner) || RE_LEGACY_ANSWER.test(inner) ||
        isPackMarkerBracket(inner); // a track pack's [MARKER] (1.15) is as stable as [SaaS]
      let end = j;
      if (after === "[") { // reference link [x][y]: both halves are syntax
        const k = groupEnd(j + 1);
        if (k !== -1) { skip = true; end = k; }
      }
      if (!skip && !visit(inner, line.slice(i + 1, j))) walk(i + 1, j); // rawInner: code spans intact (columns kept)
      i = end;
    }
  };
  walk(box ? box[0].length : 0, s.length);
}

// 'missing' | 'placeholder' | 'filled' for an artifact — `input` is { file } or { text }, or a string
// (a single-line string that is absolute or ends in .md/.json is a path, anything else is text). The rule is
// deterministic and language-agnostic:
//   missing      no input, or the file does not exist;
//   placeholder  it exists but (a) holds nothing beyond headings once HTML comments are set aside, (b) still
//                contains a template placeholder (placeholderReport: bracketed prose or the `> **TODO**`
//                sentinel), or (c) equals `opts.template` (a string or a list) ignoring whitespace;
//   filled       anything else.
function artifactState(input, opts = {}) {
  if (input == null) return "missing";
  let text;
  if (typeof input === "object") text = input.file != null ? readIfExists(input.file) : input.text;
  else if (!/[\r\n]/.test(input) && (path.isAbsolute(input) || /\.(md|markdown|json)$/i.test(input))) text = readIfExists(input);
  else text = String(input);
  if (text == null) return "missing";
  const squash = (x) => String(x).replace(/\s+/g, "");
  const templates = opts.template == null ? [] : [].concat(opts.template);
  if (templates.some((tpl) => squash(tpl) === squash(text))) return "placeholder";
  if (headingsOnly(text)) return "placeholder";
  return placeholderReport(text).length ? "placeholder" : "filled";
}
// Nothing beyond headings once HTML comments are set aside (a skeleton, or what's left after inactive sections go).
function headingsOnly(text) {
  return !stripHtmlComments(text).split(/\r?\n/).some((l) => l.trim() && !/^#{1,6}(\s|$)/.test(l.trim()));
}

// `_Verify: [manual: …]_` names a human check (not a runnable command) — not a template placeholder.
const RE_MANUAL_VERIFY = /_Verify:\s*`?\[\s*manual\b/i;
// An artifact as the gates judge it: its ACTIVE part (a removed track's [SaaS]/[AI] sections and task blocks are
// inactive), with each placeholder's real line number. → { file, state: missing | placeholder | filled,
// items: [{ line, text }], empty }. The scaffold's +saas/+ai track tasks left verbatim are NOT placeholders here:
// "Enforce tenant isolation — every query scoped by tenant_id" is a concrete, traced task (the template's T-IDs map
// to them) — counting them made doctor FAIL and next_action say "fill tasks.md" in the middle of execution. Only the
// tasks approval gate asks for one real task beyond them (approvalChecks, isPlaceholderTask — detectPhase's rule).
function artifactReport(dir, file, tracks, preloaded) {
  useTemplateScopeOf(dir); // the project's templates are template text too (1.14)
  const raw = preloaded !== undefined ? preloaded : readIfExists(path.join(dir, file)); // preloaded: null = missing
  if (raw == null) return { file, state: "missing", items: [], empty: false };
  const lines = raw.split(/\r?\n/);
  const drop = file === "tasks.md" ? inactiveTaskLines(raw, tracks)
    : file === "requirements.md" || file === "design.md" ? inactiveMarkerLines(raw, tracks) : new Set();
  let found = placeholderReport(raw).filter((p) => !drop.has(p.line - 1));
  if (file === "bug.md") found = bugPlaceholders(raw, found); // quoted evidence ([object Object], [WARN]) is not a slot
  let items = found.map((p) => ({ line: p.line, text: p.text }));
  if (file === "tasks.md") items = items.filter((p) => !(/^\[\s*manual\b/i.test(p.text) && RE_MANUAL_VERIFY.test(lines[p.line - 1])));
  const empty = headingsOnly(lines.filter((_, i) => !drop.has(i)).join("\n"));
  return { file, state: empty || items.length ? "placeholder" : "filled", items, empty };
}

// artifactReport by feature name (resolver-aware) — for the hooks and the CLI. null when the feature doesn't exist.
// text: the content to judge instead of the file on disk (the pre-commit hook passes the STAGED version).
function featurePlaceholders(projectDir, name, file, text) {
  const f = existingFeature(projectDir, name);
  return f.ok ? artifactReport(f.dir, file, detectTracks(f.dir), typeof text === "string" ? text : undefined) : null;
}

// "requirements.md (17): requirements.md:11 [1-2 sentences…], …, +12 more" — bounded (5 per file) for every surface.
function placeholderSummary(reports, lang) {
  const G = i18n.msg(lang).gates;
  const short = (s) => (s.length > 48 ? s.slice(0, 47) + "…" : s);
  return reports.map((r) => {
    if (!r.items.length) return `${r.file} (${G.empty})`;
    const shown = r.items.slice(0, 5).map((p) => `${r.file}:${p.line} ${short(p.text)}`);
    if (r.items.length > 5) shown.push(G.more(r.items.length - 5));
    return `${r.file} (${r.items.length}): ${shown.join(", ")}`;
  }).join("; ");
}

// Chain artifacts still holding template placeholders, split at the current phase: `blocking` (current and earlier)
// fail the gates, `later` are informational. blockingOnly skips reading the later ones (the roadmap refresh runs on
// every mutation, for every feature — file reads are its cost).
function chainPlaceholders(dir, tracks, kind, phase, blockingOnly, texts) {
  const cur = flowPhaseIndex(phase, featureFlow(dir, kind)); // C3: on the flow's scale (chainArtifacts' idx follows it)
  const all = chainArtifacts(dir, tracks, kind).filter((a) => !blockingOnly || a.idx <= cur)
    .map((a) => ({ ...artifactReport(dir, a.file, tracks, texts ? texts[a.file] : undefined), idx: a.idx })).filter((r) => r.state === "placeholder");
  return { all, blocking: all.filter((r) => r.idx <= cur), later: all.filter((r) => r.idx > cur) };
}
// Some prose once brackets (nested too), HTML comments and the TODO sentinel are set aside: a root cause written as
// nothing but "[the cause, with evidence]" is not written yet — whatever the bracket says.
function hasProseOutsideBrackets(body) {
  let t = stripHtmlComments(body).replace(RE_TODO_SENTINEL_LINE, " ");
  for (let prev = null; prev !== t;) { prev = t; t = t.replace(/\[[^[\]\n]*\]/g, " "); }
  return /[\p{L}\p{N}]/u.test(t);
}
// bug.md is a bug REPORT: its Reproduction, Expected vs Actual and Root Cause quote logs, output and error text, full of
// brackets that are evidence, not slots — `[object Object]`, `[WARN]`, a regex class `[A-Z]`, `[Error: ENOENT …]`,
// `[Invalid Date]`. The generic rule (any bracketed prose is a slot) reported a written root cause as "not filled": the
// design approval, the fix tasks and finish were refused with no word about the bracket. In bug.md a bracket is a
// placeholder only when it IS one of the bug report's own slots (bugTemplateSlots, every language) or when its section
// holds nothing but brackets (no prose written around them). The TODO sentinel always counts.
// → the `items` (placeholderReport(text) entries) that still count.
function bugPlaceholders(text, items) {
  const lines = String(text || "").split(/\r?\n/);
  const heads = headingIndex(lines);
  const slots = bugTemplateSlots();
  const unitCache = new Map();
  // A heading line is judged on its own text; any other line on its section's body (up to the next heading).
  const unitHasProse = (i) => {
    const isHead = heads.includes(i);
    const start = isHead ? i : heads.filter((h) => h < i).pop();
    const key = isHead ? "h" + i : "s" + (start == null ? -1 : start);
    if (!unitCache.has(key)) {
      const from = start == null ? 0 : start + 1;
      const end = heads.find((h) => h > (start == null ? -1 : start));
      const body = isHead ? lines[i].replace(/^#{1,6}\s+/, "") : lines.slice(from, end == null ? lines.length : end).join("\n");
      unitCache.set(key, hasProseOutsideBrackets(body));
    }
    return unitCache.get(key);
  };
  const isSlot = (k) => slots.has(k) || projectTemplateHas("bugSlots", k); // + the slots of the project's bug.md template (1.14)
  return (items || []).filter((p) => p.kind !== "bracket" || isSlot(placeholderKey(String(p.text).slice(1, -1))) || !unitHasProse(p.line - 1));
}
// (hasProseOutsideBrackets: the blank lines above a sentinel line are no longer part of what is blanked — they hold no
// bracket, letter or digit, so its answer is the same; 1.17 H, as RE_TODO_SENTINEL)
const RE_TODO_SENTINEL_LINE = /^[^\S\n\r\u2028\u2029]*>\s*\*\*TODO\*\*.*$/gm;
// Every bracketed slot of the bug report template, in every language (the Summary slot included: built without one).
let BUG_SLOTS = null;
function bugTemplateSlots() {
  if (BUG_SLOTS) return BUG_SLOTS;
  const set = new Set();
  for (const l of i18n.LANGS) {
    let t;
    try { t = i18n.bugReport({ name: "x" }, l); } catch { continue; } // a builder's trouble never breaks the check
    for (const m of String(t || "").matchAll(/\[([^[\]\n]*)\]/g)) set.add(placeholderKey(m[1]));
  }
  return (BUG_SLOTS = set);
}

module.exports = { stripHtmlComments, commentLines, stripFencedCode, requirementAcIds, planIdText, clarificationMarkers,
  templateTaskSet, bugStepSet, isBugStep, isPlaceholderTask, RE_FENCE, RE_FENCE_CLOSE, closesFence, fenceStep, tableCells,
  headingIndex, headingLeadSource, RE_HEADING_LEAD, headingLeadRe, RE_SYN_INFLECTION, headingMatches, extractSection,
  RE_TODO_SENTINEL, ROOT_CAUSE_SYN, REPRO_SYN, sectionState, RE_STABLE_BRACKET, RE_REF_DEFINITION, RE_LEGACY_ANSWER,
  RE_LIST_CHECKBOX, placeholderKey, isGenericSlot, unknownSteeringStub, LEGACY_TEMPLATE_PLACEHOLDERS, templateCorpus,
  templateBracketKeys, templateSets, templateSetsBr, CORPUS_FILE, CORPUS_SOURCES, corpusSourcesHash, renderCorpusData,
  builtinCorpusSource, isTemplatePlaceholder, isCodeSlot, visibleLines, placeholderReport,
  bracketPlaceholders, scanBrackets, artifactState, headingsOnly, RE_MANUAL_VERIFY, artifactReport, featurePlaceholders,
  placeholderSummary, chainPlaceholders, hasProseOutsideBrackets, bugPlaceholders, RE_TODO_SENTINEL_LINE,
  bugTemplateSlots, __link };
