"use strict";

/**
 * dev-spec-driven engine — spec_import spec-kit.
 * A GitHub Spec Kit spec (spec.md / plan.md / tasks.md) → the import model.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let blankFacts, earsFromGwt, isLtUnit, isWsUnit, leftoverExtras, markRange, mdBody, mdHeadings, mdListItems, mdRange,
  newImportModel, RE_MD_HR, stripEnd, stripHtmlComments, tidyLines, titleFromStory, unusedLines;
function __link(E) { ({ blankFacts, earsFromGwt, isLtUnit, isWsUnit, leftoverExtras, markRange, mdBody, mdHeadings,
  mdListItems, mdRange, newImportModel, RE_MD_HR, stripEnd, stripHtmlComments, tidyLines, titleFromStory, unusedLines } = E); }

// spec-kit: specs/<nnn-name>/ — spec.md (### User Story N - Title (Priority: P1) + numbered Given/When/Then
// Acceptance Scenarios, Edge Cases, FR-xxx, Key Entities, SC-xxx), plan.md (→ design.md), tasks.md (T001 [P] [US1]).
// Template guidance sections (Execution Flow, Quick Guidelines, checklists) are the tool's own, never imported.
const SPECKIT_GUIDANCE = /^(?:execution flow|quick guidelines|review & acceptance checklist|execution status)\b/i;
// spec-kit's summary — $1 of /^\*\*Input\*\*:\s*(?:User description:\s*)?"?(.+?)"?\s*$/im, by a scan (the lazy text before
// "?\s*$ rescanned a long blank run at each step — 1.17 H). The choices in the engine's order; the text runs to the first
// place where `"?`, blanks and a line end follow.
function specKitInput(spec) {
  const F = blankFacts(spec), n = F.n;
  const nextTail = new Int32Array(n + 1); // the first e ≥ p where "?\s*$ reads
  nextTail[n] = n;
  for (let p = n - 1; p >= 0; p--) nextTail[p] = (spec[p] === '"' && F.tws(p + 1)) || F.tws(p) ? p : nextTail[p + 1];
  const text = (d) => (d < n && !isLtUnit(spec[d]) ? spec.slice(d, nextTail[d + 1]) : null); // it never needs a line terminator
  const head = /^\*\*Input\*\*:/gim;
  for (let h; (h = head.exec(spec));) {
    const a = head.lastIndex, b = F.nnw[a];
    let r = null;
    if (/^User description:/i.test(spec.slice(b, b + 17))) {
      const c0 = b + 17;
      for (let c = F.nnw[c0]; c >= c0 && r == null; c--) r = (spec[c] === '"' ? text(c + 1) : null) ?? text(c);
    }
    if (r == null) r = (spec[b] === '"' ? text(b + 1) : null) ?? text(b);
    for (let x = b - 1; x >= a && r == null; x--) r = text(x);
    if (r != null) return r;
  }
  return null;
}
// A spec-kit story heading → [text, number, title, priority] | null — what
// /^user story\s+(\d+)\s*[-–—:.]?\s*(.*?)\s*(?:\((?:priority\s*:\s*)?(P\d)\))?\s*(?:🎯.*)?$/iu matched, the title read by a
// scan (its lazy capture rescanned a long blank run at each step — 1.17 H). When no title end reads, nothing does.
const RE_SPECKIT_PRIORITY = /\((?:priority\s*:\s*)?(P\d)\)/iuy;
function specKitStoryHeading(text) {
  const h = /^user story\s+(\d+)/iu.exec(text);
  if (!h) return null;
  const F = blankFacts(text), n = F.n;
  let ts = F.nnw[h[0].length];
  if (ts < n && "-–—:.".includes(text[ts])) ts = F.nnw[ts + 1];
  const target = "\u{1F3AF}";
  const tail = (e) => { // \s*(?:\((?:priority\s*:\s*)?(P\d)\))?\s*(?:🎯.*)?$ at e → { prio } | null
    const ends = (p) => p === n || (text.startsWith(target, p) && F.nlt[p + 2] === n);
    const p1 = F.nnw[e];
    RE_SPECKIT_PRIORITY.lastIndex = p1;
    const pm = RE_SPECKIT_PRIORITY.exec(text);
    if (pm && ends(F.nnw[p1 + pm[0].length])) return { prio: pm[1] };
    return ends(p1) ? { prio: undefined } : null;
  };
  for (let e = ts, lt = F.nlt[ts]; e <= lt;) {
    const r = tail(e);
    if (r) return [text, h[1], text.slice(ts, e), r.prio];
    if (e === n) break;
    e = isWsUnit(text[e]) ? Math.max(F.nnw[e], e + 1) : e + 1; // a blank run ends the same way from each of its units
  }
  return null;
}
function parseSpecKit(dir, read, W) {
  const spec = read(path.join(dir, "spec.md"));
  const plan = read(path.join(dir, "plan.md"));
  const tasks = read(path.join(dir, "tasks.md"));
  if (spec == null && tasks == null) return null;
  const model = newImportModel();
  model.nameHint = path.basename(dir).replace(/^\d+[-_]/, "") || path.basename(dir);
  // /\s*\*?\((?:mandatory|optional|include if[^)]*)\)\*?\s*$/i dropped — read after the last ')' but the closing one (the
  // only place it can match), from a blank run's start (?<!\s): each "(include if" and each blank rescanned the rest (1.17 H).
  const norm = (t) => {
    let e = stripEnd(t, isWsUnit).length;
    if (t[e - 1] === "*") e--;
    if (t[e - 1] !== ")") return t.trim();
    const from = e >= 2 ? t.lastIndexOf(")", e - 2) + 1 : 0;
    return (t.slice(0, from) + t.slice(from).replace(/(?<!\s)\s*\*?\((?:mandatory|optional|include if[^)]*)\)\*?\s*$/i, "")).trim();
  };
  if (spec != null) {
    const lines = stripHtmlComments(spec).split(/\r?\n/);
    const hs = mdHeadings(lines);
    const used = new Set();
    const h1 = hs.find((h) => h.level === 1);
    if (h1) { used.add(h1.i); model.title = h1.text.replace(/^feature specification:\s*/i, "").trim() || null; }
    const input = specKitInput(spec);
    model.summary = input != null && input.trim() && !/\$ARGUMENTS/.test(input) ? input.trim() : null;
    // spec-kit's own metadata (branch, date, status; Input is the summary) describes its workflow, not the feature.
    lines.forEach((l, i) => { if (/^\s*\*\*(?:feature branch|created|status|input)\*\*\s*:/i.test(l)) used.add(i); });
    // body: the story's lines (all written into it: prose, scenarios, then whatever follows the scenarios).
    const storyFrom = (body, printed, title, priority) => {
      // \s*:?\s*(?:\*\*|__)?\s*:?\s*$ → \s*(?::\s*)?(?:(?:\*\*|__)\s*)?(?::\s*)?$ (the same lines): blank runs meeting with
      // nothing between them backtracked exponentially (1.17 H).
      const at = body.findIndex((l) => /^\s*(?:\*\*|__)?acceptance scenarios(?:\*\*|__)?\s*(?::\s*)?(?:(?:\*\*|__)\s*)?(?::\s*)?$/i.test(l));
      const off = at === -1 ? 0 : at + 1;
      let scen = mdListItems(body.slice(off), true).filter((it) => at !== -1 || /\bthen\b|\bent[ãa]o\b|\bentonces\b/i.test(it.text));
      // Bulleted scenarios when there are no numbered ones — only under the explicit label, where a bullet can't be a note
      // in the story's prose (kiro.js reads its criteria the same way; 1.22 review: they gave 0 criteria).
      if (!scen.length && at !== -1) scen = mdListItems(body.slice(off), false);
      const inScen = new Set(scen.flatMap((it) => it.at.map((r) => r + off)));
      const keep = (l, r) => !inScen.has(r) && !RE_MD_HR.test(l);
      const prose = tidyLines(body.slice(0, at === -1 ? body.length : at).filter(keep));
      const after = at === -1 ? [] : tidyLines(body.slice(off).filter((l, r) => keep(l, r + off)));
      model.stories.push({
        printed, key: `User Story ${printed}`, title, priority, prose, quote: [], after,
        criteria: scen.map((it, j) => ({ key: `User Story ${printed} / Scenario ${j + 1}`, raw: it.text, ears: earsFromGwt(it.text) })),
      });
    };
    hs.forEach((h, k) => {
      const m = specKitStoryHeading(h.text);
      if (!m) return;
      const [lo, hi] = mdRange(lines, hs, k);
      markRange(used, h.i, hi);
      storyFrom(lines.slice(lo, hi), +m[1], m[2].trim() || `User Story ${m[1]}`, m[3] ? m[3].toUpperCase() : null);
    });
    if (!model.stories.length) { // older template: one "Primary User Story" + "Acceptance Scenarios"
      const pk = hs.findIndex((h) => /^primary user story/i.test(h.text));
      const ak = hs.findIndex((h) => /^acceptance scenarios/i.test(h.text));
      if (ak !== -1) {
        const prose = pk !== -1 ? mdBody(lines, hs, pk) : [];
        for (const k of pk !== -1 ? [pk, ak] : [ak]) { used.add(hs[k].i); markRange(used, ...mdRange(lines, hs, k)); }
        storyFrom([...prose, "**Acceptance Scenarios**:", ...mdBody(lines, hs, ak)], 1, titleFromStory(prose) || model.title || "User Story 1", null);
      }
    }
    if (!model.stories.length) model.warnings.push(W.wNoRequirements("spec.md"));
    const section = (re, key) => {
      const k = hs.findIndex((h) => h.level > 1 && !used.has(h.i) && re.test(norm(h.text)));
      if (k === -1) return;
      const [lo, hi] = mdRange(lines, hs, k);
      const rest = unusedLines(lines, used, lo, hi);
      markRange(used, hs[k].i, hi);
      model.extra.push({ key, lines: rest.filter((l) => !/^\s*#{1,6}\s+measurable outcomes/i.test(l)) });
    };
    section(/^functional requirements$/i, "functional");
    section(/^key entities$/i, "entities");
    section(/^success criteria$/i, "success");
    section(/^edge cases$/i, "edge");
    hs.forEach((h, k) => {
      if (h.level !== 2 || used.has(h.i)) return;
      const t = norm(h.text);
      const [lo, hi] = mdRange(lines, hs, k);
      if (SPECKIT_GUIDANCE.test(t.replace(/^[^\p{L}\p{N}]+/u, ""))) { markRange(used, h.i, hi); return; } // "## ⚡ Quick Guidelines"
      if (/^(?:user scenarios|requirements$)/i.test(t)) { used.add(h.i); return; } // their sub-sections are read above; the rest is carried
      const rest = unusedLines(lines, used, lo, hi); // "## User Stories" wrapping the stories read above
      markRange(used, h.i, hi);
      if (tidyLines(rest).length) model.extra.push({ heading: "## " + t, lines: rest });
    });
    model.carried.push(...leftoverExtras(lines, hs, used)); // e.g. ### Non-Functional Requirements (NFR-001)
    for (const x of [...model.extra, ...model.carried]) for (const l of x.lines) for (const id of l.match(/(?<![A-Za-z0-9])(?:FR|SC)-\d+(?!\d)/g) || []) model.mapping[id] = id;
  }
  if (plan != null) model.design = { text: plan, file: "plan.md" };
  else model.warnings.push(W.wNoDesign("plan.md"));
  if (tasks != null) model.tasks = { text: tasks, file: "tasks.md" };
  else model.warnings.push(W.wNoTasks);
  model.skipped = ["research.md", "data-model.md", "quickstart.md", "contracts"].filter((x) => fs.existsSync(path.join(dir, x)));
  return model;
}

module.exports = { SPECKIT_GUIDANCE, specKitInput, RE_SPECKIT_PRIORITY, specKitStoryHeading, parseSpecKit, __link };
