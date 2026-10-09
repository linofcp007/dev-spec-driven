"use strict";

/**
 * dev-spec-driven engine — spec_import openspec.
 * An OpenSpec change (proposal.md, specs/ deltas, tasks.md) → the import model.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let blankFacts, earsFromClauses, earsFromGwt, firstParagraph, headPlus, isLtUnit, isWsUnit, leftoverExtras, markRange,
  mdBody, mdHeadings, mdRange, newImportModel, RE_LINE_TERMINATOR, safeReaddir, stripHtmlComments, tidyLines, toPosix,
  trimClause, unusedLines;
function __link(E) { ({ blankFacts, earsFromClauses, earsFromGwt, firstParagraph, headPlus, isLtUnit, isWsUnit,
  leftoverExtras, markRange, mdBody, mdHeadings, mdRange, newImportModel, RE_LINE_TERMINATOR, safeReaddir,
  stripHtmlComments, tidyLines, toPosix, trimClause, unusedLines } = E); }

// $1 of each match of /FROM:\s*`?(?:#+\s*)?Requirement:\s*([^`\n]+?)`?\s*$/gim (head: its part up to the colon, global) — by
// a scan: the lazy name before `?\s*$ rescanned a long blank run at each step (1.17 H).
function renamedRequirementNames(s, head) {
  const F = blankFacts(s), n = F.n;
  const nextTws = new Int32Array(n + 1), nextStop = new Int32Array(n + 1), lastLt = new Int32Array(n + 1);
  nextTws[n] = n; nextStop[n] = n;
  for (let p = n - 1; p >= 0; p--) {
    nextTws[p] = F.tws(p) ? p : nextTws[p + 1];
    nextStop[p] = s[p] === "`" || s[p] === "\n" ? p : nextStop[p + 1];
  }
  for (let i = 0, l = -1; i <= n; i++) { lastLt[i] = l; if (isLtUnit(s[i])) l = i; }
  const endAt = (p) => (F.nnw[p] === n ? n : lastLt[F.nnw[p]]); // where \s*$ stops: the end, or before the run's last line terminator
  const name = (cs) => { // (.+?)`?\s*$ from cs → { e, end } | null
    if (cs >= n || s[cs] === "`" || s[cs] === "\n") return null;
    const B = nextStop[cs], e = nextTws[cs + 1];
    if (e < B) return { e, end: endAt(e) };
    if (B === n || s[B] === "\n") return { e: B, end: endAt(B) };
    return F.tws(B + 1) ? { e: B, end: endAt(B + 1) } : null; // a closing backtick
  };
  const out = [];
  head.lastIndex = 0;
  for (let h; (h = head.exec(s));) {
    const a = head.lastIndex;
    let r = null, cs = F.nnw[a];
    for (; cs >= a && !r; cs--) r = name(cs);
    if (r) { out.push(s.slice(cs + 1, r.e)); head.lastIndex = r.end; }
  }
  return out;
}

// OpenSpec: a capability (openspec/specs/<capability>/spec.md) or a change (openspec/changes/<id>/ — proposal.md,
// tasks.md, design.md, specs/<capability>/spec.md with ADDED/MODIFIED/REMOVED/RENAMED Requirements).
// A scenario clause "- **WHEN** …" → [line, keyword, text] | null — /^\s*[-*+]\s+(?:\*\*|__)?(GIVEN|WHEN|THEN|AND|BUT)(?:\*\*|__)?\s*:?\s*(.*)$/i
// with the text read by a scan (\s*:?\s*(.*)$ backtracked quadratically before a line break — 1.17 H).
const RE_OS_CLAUSE_HEAD = /^\s*[-*+]\s+(?:\*\*|__)?(GIVEN|WHEN|THEN|AND|BUT)(?:\*\*|__)?/i;
function openSpecClause(line) {
  const h = RE_OS_CLAUSE_HEAD.exec(line);
  if (!h) return null;
  let i = h[0].length;
  while (i < line.length && isWsUnit(line[i])) i++;
  if (line[i] === ":") { i++; while (i < line.length && isWsUnit(line[i])) i++; }
  const text = line.slice(i);
  return RE_LINE_TERMINATOR.test(text) ? null : [line, h[1], text];
}
function parseOpenSpec(dir, read, W) {
  const walkSpecs = (d, depth, out) => {
    if (depth > 4) return out;
    for (const n of safeReaddir(d).sort()) {
      const p = path.join(d, n);
      let st;
      try { st = fs.lstatSync(p); } catch { continue; }
      if (st.isDirectory()) walkSpecs(p, depth + 1, out);
      else if (n === "spec.md" && st.isFile()) out.push(p);
    }
    return out;
  };
  const model = newImportModel();
  model.nameHint = path.basename(dir);
  let specFiles;
  let tasks = null;
  let proposal = null;
  if (fs.existsSync(path.join(dir, "spec.md"))) specFiles = [path.join(dir, "spec.md")];
  else if (fs.existsSync(path.join(dir, "proposal.md")) || fs.existsSync(path.join(dir, "specs")) || fs.existsSync(path.join(dir, "tasks.md"))) {
    specFiles = walkSpecs(path.join(dir, "specs"), 0, []);
    tasks = read(path.join(dir, "tasks.md"));
    proposal = read(path.join(dir, "proposal.md"));
  } else specFiles = walkSpecs(dir, 0, []); // a folder of capabilities
  const texts = specFiles.map((f) => ({ file: f, cap: path.basename(path.dirname(f)), text: read(f) })).filter((x) => x.text != null);
  if (!texts.length && tasks == null && proposal == null) return null;
  if (proposal != null) {
    const lines = stripHtmlComments(proposal).split(/\r?\n/);
    const hs = mdHeadings(lines);
    const used = new Set();
    hs.filter((h) => h.level === 1).forEach((h) => used.add(h.i));
    const why = hs.findIndex((h) => /^why\b/i.test(h.text));
    const [sLo, sHi] = why !== -1 ? mdRange(lines, hs, why) : [0, lines.length];
    if (why !== -1) used.add(hs[why].i);
    const sAt = [];
    model.summary = firstParagraph(lines.slice(sLo, sHi), sAt);
    sAt.forEach((r) => used.add(sLo + r));
    hs.forEach((h, k) => {
      if (h.level !== 2 || k === why) return;
      const [lo, hi] = mdRange(lines, hs, k);
      const rest = unusedLines(lines, used, lo, hi); // without a ## Why, the summary paragraph may sit in here
      markRange(used, h.i, hi);
      if (tidyLines(rest).length) model.extra.push({ heading: "## " + h.text, lines: rest });
    });
    model.carried.push(...leftoverExtras(lines, hs, used));
  }
  for (const { cap, text } of texts) {
    const lines = stripHtmlComments(text).split(/\r?\n/);
    const hs = mdHeadings(lines);
    const used = new Set();
    const h1 = hs.find((h) => h.level === 1);
    if (h1) used.add(h1.i);
    if (!model.title && h1) { // h1.text.replace(/\s+specification$/i, ""), without rescanning a blank run from each unit (1.17 H)
      const sp = h1.text.search(/specification$/i);
      let w0 = sp;
      while (w0 > 0 && isWsUnit(h1.text[w0 - 1])) w0--;
      model.title = (sp > 0 && w0 < sp ? h1.text.slice(0, w0) : h1.text).trim() || null;
    }
    const purpose = hs.findIndex((h) => /^purpose\b/i.test(h.text));
    if (!model.summary && purpose !== -1) { // the rest of Purpose (and every other capability's Purpose) is carried
      const [lo, hi] = mdRange(lines, hs, purpose);
      const at = [];
      model.summary = firstParagraph(lines.slice(lo, hi), at);
      used.add(hs[purpose].i);
      at.forEach((r) => used.add(lo + r));
    }
    let section = "";
    hs.forEach((h, k) => {
      if (h.level <= 2) section = h.text;
      if (h.level <= 2 && /^(?:(?:added|modified|removed|renamed)\s+)?requirements\b/i.test(h.text)) used.add(h.i);
      if (/^renamed\b/i.test(section) && h.level <= 2) {
        const [lo, hi] = mdRange(lines, hs, k);
        markRange(used, lo, hi);
        const body = lines.slice(lo, hi).join("\n");
        const froms = renamedRequirementNames(body, /FROM:\s*`?(?:#+\s*)?Requirement:/gi).map((x) => x.trim());
        const tos = renamedRequirementNames(body, /TO:\s*`?(?:#+\s*)?Requirement:/gi).map((x) => x.trim());
        froms.forEach((f, i) => model.warnings.push(W.wRenamed(f, tos[i] || "?")));
      }
      const m = headPlus(h.text, /^requirement:/i); // /^requirement:\s*(.+)$/i (headPlus: 1.17 H)
      if (!m) return;
      const name = m[1].trim();
      const [lo, hi] = mdRange(lines, hs, k);
      markRange(used, h.i, hi);
      if (/^removed\b/i.test(section)) { model.warnings.push(W.wRemoved(name)); return; }
      const body = lines.slice(lo, hi);
      const sub = mdHeadings(body);
      const firstScenario = sub.find((s) => /^scenario:/i.test(s.text));
      const statement = body.slice(0, firstScenario ? firstScenario.i : body.length).filter((l) => l.trim() && !/^\s*#/.test(l)).map((l) => l.trim());
      const criteria = [];
      const after = [];
      // Only the sub-headings at the scenarios' level: a deeper one is inside a scenario's body. A non-scenario
      // sub-section after the scenarios (#### Notes) follows the criteria verbatim.
      const top = firstScenario ? sub.filter((s) => s.i >= firstScenario.i && s.level <= firstScenario.level) : [];
      top.forEach((s) => {
        const sb = mdBody(body, sub, sub.indexOf(s));
        const sm = headPlus(s.text, /^scenario:/i); // /^scenario:\s*(.+)$/i
        if (!sm) { after.push("", body[s.i], ...sb); return; }
        const cl = { given: "", when: "", then: "" };
        let last = null;
        let open = false; // a clause bullet's wrapped (indented or lazy) continuation extends that clause
        const rawParts = [];
        const other = [];
        for (const l of sb) {
          const b = openSpecClause(l);
          if (b) {
            open = true;
            rawParts.push(b[1].toUpperCase() + " " + b[2].trim());
            const kw = b[1].toLowerCase();
            if (kw === "and" || kw === "but") { if (last) cl[last] += " and " + trimClause(b[2]); continue; }
            cl[kw] = cl[kw] ? cl[kw] + " and " + trimClause(b[2]) : trimClause(b[2]);
            last = kw;
            continue;
          }
          if (!l.trim()) { open = false; if (other.length) other.push(""); continue; }
          if (open && last && !/^\s*(?:[-*+]\s|#|>|\|)/.test(l)) {
            cl[last] = trimClause(cl[last] + " " + l.trim());
            rawParts[rawParts.length - 1] += " " + l.trim();
            continue;
          }
          open = false;
          other.push(l.trimEnd());
        }
        const prose = tidyLines(other);
        // A prose-only scenario becomes its criterion's text; prose beside clauses follows the criteria.
        const raw = rawParts.join(" ") || [sm[1].trim(), prose.join(" ").trim()].filter(Boolean).join(" — ");
        criteria.push({ key: `${cap}: ${name} / Scenario: ${sm[1].trim()}`, raw, ears: rawParts.length ? earsFromClauses(cl, "en") : prose.length ? earsFromGwt(prose.join(" ")) : null });
        if (rawParts.length && prose.length) after.push("", ...prose);
      });
      model.stories.push({ printed: null, key: `${cap}: Requirement: ${name}`, title: name + (/^modified\b/i.test(section) ? " " + W.modified : ""), priority: null, prose: [], quote: statement, after: tidyLines(after), criteria });
    });
    model.carried.push(...leftoverExtras(lines, hs, used, texts.length > 1 ? cap + ": " : "")); // ## Constraints, Purpose's other paragraphs…
  }
  if (!model.stories.length && texts.length) model.warnings.push(W.wNoRequirements(texts.map((x) => toPosix(path.relative(dir, x.file))).join(", ")));
  const des = read(path.join(dir, "design.md"));
  if (des != null) model.design = { text: des, file: "design.md" };
  if (tasks != null) model.tasks = { text: tasks, file: "tasks.md" };
  else model.warnings.push(W.wNoTasks);
  return model;
}

module.exports = { parseOpenSpec, __link };
