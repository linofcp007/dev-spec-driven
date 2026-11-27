"use strict";

/**
 * dev-spec-driven engine — spec_import spec-kit.
 * A GitHub Spec Kit spec (spec.md / plan.md / tasks.md) → the import model.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let blankFacts, codeBlockLines, commentLines, earsFromGwt, earsThen, isLtUnit, isWsUnit, leftoverExtras, markRange, mdBody, mdHeadings,
  mdListItems, mdRange, newImportModel, RE_MD_HR, restAfterBlanks, stripEnd, stripHtmlComments, tidyLines, titleFromStory, unusedLines,
  planPaths;
function __link(E) { ({ blankFacts, codeBlockLines, commentLines, earsFromGwt, earsThen, isLtUnit, isWsUnit, leftoverExtras, markRange,
  mdBody, mdHeadings, mdListItems, mdRange, newImportModel, RE_MD_HR, restAfterBlanks, stripEnd, stripHtmlComments, tidyLines,
  titleFromStory, unusedLines, planPaths } = E); }

// spec-kit: specs/<nnn-name>/ — spec.md (### User Story N - Title (Priority: P1) + numbered Given/When/Then
// Acceptance Scenarios, Edge Cases, FR-xxx, Key Entities, SC-xxx), plan.md (→ design.md), tasks.md (T001 [P] [US1]).
// Template guidance sections (Execution Flow, Quick Guidelines, checklists) are the tool's own, never imported.
const SPECKIT_GUIDANCE = /^(?:execution flow|quick guidelines|review & acceptance checklist|execution status)\b/i;
// spec-kit's summary — $1 of /^\*\*Input\*\*:\s*(?:User description:\s*)?"?(.+?)"?\s*$/im, by a scan (the lazy text before
// "?\s*$ rescanned a long blank run at each step). The choices in the engine's order; the text runs to the first
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
// scan (its lazy capture rescanned a long blank run at each step). When no title end reads, nothing does.
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
// What the parser reads in a feature folder — every other entry is named as left in place (specKitLeft).
const SPECKIT_KNOWN = ["spec.md", "plan.md", "tasks.md", "research.md", "data-model.md", "quickstart.md", "contracts"];
function parseSpecKit(dir, read, W, src) {
  const got = new Set(); // the SPECKIT_KNOWN names the parser's reads reached (a case twin's on a case-insensitive file system)
  const rd = (name) => { const t = read(path.join(dir, name)); if (t != null) got.add(name); return t; };
  const spec = rd("spec.md");
  const plan = rd("plan.md");
  const tasks = rd("tasks.md");
  if (spec == null && tasks == null) return null;
  const model = newImportModel();
  // the feature's number, once: spec-kit's sequential `001-` or its --timestamp `YYYYMMDD-HHMMSS-` (Spec Kit's own reading of
  // ^[0-9]{8}-[0-9]{6}- — the slug was `101500-photo-albums`)
  model.nameHint = path.basename(dir).replace(/^(?:\d{8}-\d{6}|\d+)[-_]/, "") || path.basename(dir);
  // /\s*\*?\((?:mandatory|optional|include if[^)]*)\)\*?\s*$/i dropped — read after the last ')' but the closing one (the
  // only place it can match), from a blank run's start (?<!\s): each "(include if" and each blank rescanned the rest.
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
      // nothing between them backtracked exponentially.
      const at = body.findIndex((l) => /^\s*(?:\*\*|__)?acceptance scenarios(?:\*\*|__)?\s*(?::\s*)?(?:(?:\*\*|__)\s*)?(?::\s*)?$/i.test(l));
      const off = at === -1 ? 0 : at + 1;
      let scen = mdListItems(body.slice(off), true).filter((it) => at !== -1 || /\bthen\b|\bent[ãa]o\b|\bentonces\b/i.test(it.text));
      // Bulleted scenarios when there are no numbered ones — only under the explicit label, where a bullet can't be a note
      // in the story's prose (kiro.js reads its criteria the same way; they gave 0 criteria).
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
    // the scenarios of the source's own stories: the FR coverage rule reads these (never the FR criteria made below — each holds its
    // FR's own text, and a second FR-003 line would read "covered" by the first one's criterion)
    const scen = frScenarios(model.stories.flatMap((s) => s.criteria.map((c) => c.raw)));
    const fx = model.extra.find((x) => x.key === "functional");
    const frCriteria = fx ? specKitFrCriteria(fx, scen) : [];
    if (fx && !tidyLines(fx.lines).length) model.extra.splice(model.extra.indexOf(fx), 1); // every line of it became a criterion
    // FR-n → the keys of the criteria that hold it (importRun's frRefs: a task citing FR-n covers them): a converted FR its own
    // criterion, a cited one each criterion whose scenario cites it (citesFr's reading)
    model.frKeys = new Map();
    const holds = (fr, key) => { if (!model.frKeys.has(fr)) model.frKeys.set(fr, []); if (!model.frKeys.get(fr).includes(key)) model.frKeys.get(fr).push(key); };
    for (const s of model.stories) for (const c of s.criteria) for (const fr of String(c.raw).match(RE_FR_ID) || []) holds(fr, c.key);
    for (const c of frCriteria) holds(c.key, c.key);
    // one story of its own, last, reachable by no number the source wrote (importRun: storyNo, refs)
    if (frCriteria.length) model.stories.push({ synthetic: true, printed: null, key: "Functional Requirements", title: null, priority: null, prose: [], quote: [], after: [], criteria: frCriteria });
    if (!model.stories.length) model.warnings.push(W.wNoRequirements("spec.md"));
    for (const x of [...model.extra, ...model.carried]) for (const l of x.lines) for (const id of l.match(/(?<![A-Za-z0-9])(?:FR|SC)-\d+(?!\d)/g) || []) model.mapping[id] = id;
    // what still travels as prose — never silently: the FRs no acceptance scenario covers are named (one only mentioned, an FR-1.1,
    // an FR-001a, a second FR-003 line, a definition with no separator)
    const frs = uncoveredFrs(fx ? fx.lines : [], scen);
    if (frs.length) model.warnings.push(W.wUncoveredFr(frs.join(", ")));
  }
  // research.md, data-model.md and contracts/ are design — each under its own heading after plan.md (they were skipped with a
  // warning: "not imported"); quickstart.md is the feature's quickstart.md (model.quickstart). Read through `read` like every
  // source file: inside the project, a file over the import cap refuses the import.
  const docs = specKitDesignDocs(dir, read, rd, W, model, src, got);
  model.skipped.push(...specKitLeft(dir, src, got));
  if (plan != null || docs) model.design = { text: [plan == null ? null : specKitPlanMarkers(plan), docs].filter((x) => x != null).join("\n\n"), file: "plan.md" };
  if (plan == null) model.warnings.push(docs ? W.wNoPlanDocs("plan.md") : W.wNoDesign("plan.md"));
  // a task's [USn] tag → _Requirements:_ (that story's ACs, resolved by importSpec), the paths it names → _Implements:_
  if (tasks != null) model.tasks = { text: specKitTaskMarkers(tasks), file: "tasks.md" };
  else model.warnings.push(W.wNoTasks);
  return model;
}

// spec-kit's FR-xxx lines (the "Functional Requirements" section's) → the IDs NO acceptance scenario covers: a scenario covers
// an FR that it cites, or whose every content word (≥ 4 letters, no modal / "system" / "users" filler, a plural folded) it holds — "FR-001:
// System MUST allow users to create albums" is "they create an album named Trip"; "FR-002: … reorder albums by drag and drop", or an
// FR still [NEEDS CLARIFICATION], is no scenario's. They were carried as prose with no warning, and nothing traced them.
const FR_FILLER = new Set(["system", "systems", "must", "should", "shall", "allow", "allows", "able", "user", "users", "that", "this", "with", "from",
  "into", "their", "they", "them", "when", "then", "also", "each", "every", "have", "will", "which", "provide", "provides", "support", "supports",
  "enable", "enables", "sistema", "deve", "devem", "permitir", "utilizador", "utilizadores", "usuário", "usuários", "debe", "deben", "usuario",
  "usuarios", "para", "como", "cada", "todos", "todas", "pelo", "pela", "por"]);
const frWords = (s) => (String(s).toLowerCase().match(/\p{L}{4,}/gu) || []).filter((w) => !FR_FILLER.has(w)).map((w) => w.replace(/(?<!s)s$/, ""));
// /(?<![A-Za-z0-9])(FR-\d+)(?!\d)[*_\s]*:?[*_\s]*(.*)$/.exec(l) → [id, text] | null, by a scan: its two [*_\s]* runs met at a
// line terminator after the text backtracked quadratically (~34 s at 200,000 blanks and a U+2028). The regex's own reading: the
// FIRST id whose text after its greedy [*_\s]*:?[*_\s]* holds no line terminator (a later id is tried when one's text crosses one).
const RE_FR_ID = /(?<![A-Za-z0-9])FR-\d+(?!\d)/g;
const isFrPad = (c) => c === "*" || c === "_" || isWsUnit(c);
function frLine(l) {
  const s = String(l);
  let lastLt = s.length - 1;
  while (lastLt >= 0 && !isLtUnit(s[lastLt])) lastLt--;
  RE_FR_ID.lastIndex = 0;
  for (let m; (m = RE_FR_ID.exec(s));) {
    let q = RE_FR_ID.lastIndex;
    while (q < s.length && isFrPad(s[q])) q++;
    if (s[q] === ":") { q++; while (q < s.length && isFrPad(s[q])) q++; }
    if (q > lastLt) return [m[0], s.slice(q)];
  }
  return null;
}
// Does text cite the FR id: /(?<![A-Za-z0-9])<id>(?!\d)/ by indexOf — the pattern built from an id of ~50,000 digits threw
// "Regular expression too large" out of the import
function citesFr(text, id) {
  for (let i = text.indexOf(id); i !== -1; i = text.indexOf(id, i + 1)) {
    if ((i === 0 || !/[A-Za-z0-9]/.test(text[i - 1])) && !/[0-9]/.test(text[i + id.length] || "")) return true;
  }
  return false;
}
// THE rule "an acceptance scenario covers this FR" (id, its text): one cites it, or holds every content word of its text — none
// while it is still [NEEDS CLARIFICATION]. scen: frScenarios(the scenarios' raw texts).
const frScenarios = (raws) => raws.map((t) => ({ text: String(t), words: new Set(frWords(t)) }));
function frCovered(id, body, scen) {
  const words = /NEEDS[ _-]CLARIFICATION/i.test(body) ? [] : frWords(body);
  return scen.some((s) => citesFr(s.text, id)) || (words.length > 0 && scen.some((s) => words.every((w) => s.words.has(w))));
}
// The FR definitions no acceptance scenario covers → EARS criteria: the parent's own advice ("turn each into an EARS criterion with
// an AC ID") done for the user, for exactly the FRs it named. ONE reader of a definition — a list item of the Functional
// Requirements section that OPENS with its id, the id ending there (RE_FR_DEF: FR-1.1, FR-001a, FR-002-b define no FR-1 / FR-001 /
// FR-002), then `:` `.` `-` `–` `—` —; the FIRST item of an id only (a second one stays prose), converted when frCovered says no for
// its OWN id and text. The criterion: the text as EARS in English tokens (earsThen "en": a PT / ES modal — DEVE, DEBE — kept as
// written; any other subject takes "THE SYSTEM SHALL ensure that …"), then "(FR-n)"; an empty text, or one crossing a line
// terminator, is no EARS (notEars). The converted items' lines leave fx.lines; the rest stays prose. → [{ key: id, raw, ears }]
const RE_FR_DEF = /^(?:\*\*|__)?(FR-\d+)(?![A-Za-z0-9]|[.-][A-Za-z0-9])(?:\*\*|__)?[ \t]*[:.–—-](?:\*\*|__)?/;
function specKitFrCriteria(fx, scen) {
  const E = i18n.msg("en").importSpec.ears;
  const seen = new Set(), drop = new Set(), out = [];
  for (const it of mdListItems(fx.lines, false)) {
    const m = RE_FR_DEF.exec(it.text);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    let q = m[0].length;
    while (q < it.text.length && isWsUnit(it.text[q])) q++;
    const body = it.text.slice(q);
    if (frCovered(m[1], body, scen)) continue;
    it.at.forEach((r) => drop.add(r));
    let lt = false;
    for (let i = 0; i < body.length && !lt; i++) lt = isLtUnit(body[i]);
    const ears = body && !lt ? earsThen(body, "en", E) : null;
    out.push({ key: m[1], raw: it.text, ears: ears ? ears + " (" + m[1] + ")" : null });
  }
  if (drop.size) fx.lines = fx.lines.filter((_, r) => !drop.has(r));
  return out;
}
function uncoveredFrs(frLines, scen) {
  const out = [];
  for (const l of frLines) {
    const m = frLine(l);
    if (m && !out.includes(m[0]) && !frCovered(m[0], m[1], scen)) out.push(m[0]);
  }
  return out;
}

// spec-kit's tasks.md says which story a task serves ([US1]) and names the files it touches in its text: the import
// kept both as prose, so trace_check found every criterion uncovered right after an import. Each task line (a checkbox outside fenced
// code and HTML comments) gets the sub-lines it lacks: `_Requirements: US<n>_` for its [USn] tag (importSpec's refs turn US<n> into
// that story's AC IDs, as for a hand-written one) and `_Implements: <paths>_` for the paths its text names (planPaths — the plan
// import's rule: a folder part and an extension, never a URL / absolute / home path / glob). A task that already carries the marker
// (its line or an indented sub-line) keeps it.
// /^(\s*)[-*+]\s+\[[ xX~\-/]\]\s+(.*)$/ → [line, indent, text] | null, its text by restAfterBlanks: the greedy \s+(.*)$ rescanned a
// blank run from each blank it gave back when a line terminator followed the text (~34 s at 200,000 blanks and a U+2028)
const RE_SK_TASK_HEAD = /^(\s*)[-*+]\s+\[[ xX~\-/]\]/;
const skTaskLine = (l) => { const h = RE_SK_TASK_HEAD.exec(l); const text = h && restAfterBlanks(l, h[0].length, true); return text == null ? null : [l, h[1], text]; };
const RE_SK_STORY_TAG = /\[US-?(\d+)\]/i;
// Spec Kit's /converge appends `- [ ] T042 <text> per <source-ref> (<gap-type>)`: the requirement the task works toward. Read from
// the text's END, by a scan (a /[ \t]+$/ trim was quadratic on an inner blank run): an optional `(<type>)` after a blank, then the
// last token (`.`, `,`, `;` dropped) right after the word "per", of a requirement's shape — US<n>[/AC<m>] (dashes allowed), FR-<n>,
// SC-<n>; `plan: …`, `Constitution II`, a mid-text "Per US1 rules" read none. The type GRANTS the claim only when it means the task
// works toward the requirement (CONVERGE_COVERS — an inclusion list, so it fails closed: `unrequested` — removing what no
// requirement asked for —, a type Spec Kit adds later, a user's `(optional)` claim nothing). Two refs (`per FR-4, FR-5`) claim
// nothing: the stated limit. → the ref as written | null
const CONVERGE_COVERS = ["missing", "partial", "contradicts"];
const RE_CONVERGE_REF = /^(?:US-?\d+(?:\/AC-?\d+)?|FR-\d+|SC-\d+)$/;
function convergeRef(text) {
  const s = String(text);
  let e = s.length;
  while (e > 0 && isWsUnit(s[e - 1])) e--;
  if (s[e - 1] === ")") {
    const o = s.lastIndexOf("(", e - 2);
    if (o > 0 && isWsUnit(s[o - 1]) && /^[A-Za-z-]{1,20}$/.test(s.slice(o + 1, e - 1))) {
      if (!CONVERGE_COVERS.includes(s.slice(o + 1, e - 1).toLowerCase())) return null;
      e = o;
      while (e > 0 && isWsUnit(s[e - 1])) e--;
    }
  }
  let b = e;
  while (b > 0 && !isWsUnit(s[b - 1])) b--;
  let te = e;
  while (te > b && ".,;".includes(s[te - 1])) te--;
  const ref = s.slice(b, te);
  if (!RE_CONVERGE_REF.test(ref)) return null;
  let pe = b;
  while (pe > 0 && isWsUnit(s[pe - 1])) pe--;
  let pb = pe;
  while (pb > 0 && !isWsUnit(s[pb - 1])) pb--;
  return pe < b && s.slice(pb, pe).toLowerCase() === "per" ? ref : null;
}
const RE_SK_FENCE = /^\s{0,3}(`{3,}|~{3,})/;
// Does line l close the fence opened with `fence` (a run of the same character, at least as long, nothing after it)?
const skClosesFence = (l, fence) => { const f = RE_SK_FENCE.exec(l); return !!f && f[1][0] === fence[0] && f[1].length >= fence.length && !l.slice(f.index + f[0].length).trim(); };
function specKitTaskMarkers(text) {
  const lines = String(text).split(/\r?\n/);
  const eol = /\r\n/.test(String(text)) ? "\r\n" : "\n";
  const out = [];
  let fence = null, inComment = false;
  const indentOf = (l) => l.length - l.trimStart().length;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    out.push(l);
    if (inComment) { if (l.includes("-->")) inComment = false; continue; }
    if (fence) { if (skClosesFence(l, fence)) fence = null; continue; }
    const f = RE_SK_FENCE.exec(l);
    if (f) { fence = f[1]; continue; }
    const opens = l.includes("<!--") && !l.slice(l.lastIndexOf("<!--")).includes("-->");
    const m = opens ? null : skTaskLine(l);
    if (opens) { inComment = true; continue; }
    if (!m) continue;
    const indent = m[1].length;
    let j = i + 1; // the task's own body: the indented lines below it
    while (j < lines.length && lines[j].trim() && indentOf(lines[j]) > indent) j++;
    const own = lines.slice(i, j).join("\n");
    const sub = " ".repeat(indent + 2) + "- ";
    const tag = RE_SK_STORY_TAG.exec(m[2]);
    const reqs = tag ? ["US" + tag[1]] : []; // the source's two claims: its story tag, then a /converge ref
    const cv = convergeRef(m[2]);
    if (cv && !reqs.includes(cv)) reqs.push(cv);
    if (reqs.length && !/_Requirements:/i.test(own)) out.push(sub + "_Requirements: " + reqs.join(", ") + "_");
    const paths = planPaths(m[2]);
    if (paths.length && !/_Implements:/i.test(own)) out.push(sub + "_Implements: " + paths.join(", ") + "_");
  }
  return out.join(eol);
}
// spec-kit's /plan marks an unknown of its Technical Context bare — `**Testing**: NEEDS CLARIFICATION` ("mark unknowns as NEEDS
// CLARIFICATION"; its own gate errors on any left) — and the engine counts only `[NEEDS CLARIFICATION…]` (clarificationMarkers): the
// design gate let them through. A `**Field**:` / `**Field:**` (a list item's too) whose value OPENS with it, then nothing or a
// `:` / `-` / `–` / `—` and a tail, gets `[NEEDS CLARIFICATION: Field]`, the tail kept verbatim after it (inside the brackets a tail
// past the reader's 500 characters was no marker any more). Only on a line that is content as the counter reads it — no fenced
// or indented code (codeBlockLines), no part in a comment (commentLines); prose after it ("NEEDS CLARIFICATION markers are
// resolved …") and the template's `[e.g., … or NEEDS CLARIFICATION]` stay. A field Phase 0 resolved in research.md while plan.md
// still says NEEDS CLARIFICATION reads open: fail closed (one line to edit).
const RE_PLAN_FIELD = /^([ \t]*(?:[-*+][ \t]+)?\*\*([^*\]\n]{1,80}?)(?:\*\*[ \t]*:|:\*\*)[ \t]*)NEEDS[ _-]CLARIFICATION/i;
function specKitPlanMarkers(text) {
  const lines = String(text).split("\n");
  const code = codeBlockLines(lines), cl = commentLines(lines);
  let changed = false;
  const out = lines.map((l, i) => {
    const m = code[i] || cl[i].vis !== l ? null : RE_PLAN_FIELD.exec(l);
    if (!m) return l;
    const rest = l.slice(m[0].length);
    let q = 0;
    while (q < rest.length && isWsUnit(rest[q])) q++;
    if (q < rest.length && !":-–—".includes(rest[q])) return l;
    changed = true;
    return m[1] + "[NEEDS CLARIFICATION: " + m[2].trim() + "]" + rest;
  });
  return changed ? out.join("\n") : text;
}

// spec-kit's design documents beside plan.md, in its own order (research → data model → contracts),
// as design.md sections: `## <localized title>`, a provenance line, then the document — its first-line title dropped and every
// other heading one level down (outside fenced code), so its sections stay under ours; a contract that is no markdown goes into a
// fenced block (its language from the extension). contracts/ is read two levels deep, sorted, at most SPECKIT_CONTRACTS_MAX files of
// a text kind (SPECKIT_CONTRACT_EXT); the rest are named in model.skipped (the import's "not imported" warning) — a folder deeper
// than two levels too (`contracts/v1/schemas/`: dropped silently until 1.42). rd(name): the feature folder's file (got records it),
// read: any path. → the text | null.
const SPECKIT_CONTRACTS_MAX = 30;
const SPECKIT_CONTRACT_EXT = { md: "", markdown: "", yaml: "yaml", yml: "yaml", json: "json", jsonc: "json", graphql: "graphql", gql: "graphql",
  proto: "proto", txt: "", http: "http", rest: "http", xml: "xml", avsc: "json", sql: "sql" };
function specKitDesignDocs(dir, read, rd, W, model, src, got) {
  const D = W.skDocs;
  const parts = [];
  // (a document holding nothing but its title carries nothing: no empty section)
  const section = (title, file, body) => { if (body.trim()) parts.push("## " + title + "\n\n" + W.skFrom(file) + "\n\n" + body.trim()); };
  for (const [file, title] of [["research.md", D.research], ["data-model.md", D.dataModel]]) {
    const t = rd(file);
    if (t != null && t.trim()) section(title, file, demoteMd(t));
  }
  const cdir = path.join(dir, "contracts");
  const files = [], deep = [];
  const walk = (d, rel, depth) => {
    const es = src && src.list ? src.list(d) : null; // importSourceAt's listing (1.41.1): a folder whose real path leaves the project is none
    if (!es) return;
    if (depth === 1) got.add("contracts");
    for (const e of es) {
      if (e.name.startsWith(".")) continue;
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) { if (depth < 2) walk(path.join(d, e.name), r, depth + 1); else deep.push(r + "/"); }
      else files.push(r);
    }
  };
  walk(cdir, "", 1);
  const kind = (f) => { const x = (/\.([A-Za-z0-9]+)$/.exec(f) || [])[1]; return x != null && Object.prototype.hasOwnProperty.call(SPECKIT_CONTRACT_EXT, x.toLowerCase()) ? x.toLowerCase() : null; };
  const textual = files.filter((f) => kind(f) != null);
  const skipped = files.filter((f) => kind(f) == null).concat(textual.slice(SPECKIT_CONTRACTS_MAX), deep).map((f) => "contracts/" + f);
  const contracts = [];
  for (const f of textual.slice(0, SPECKIT_CONTRACTS_MAX)) {
    const t = read(path.join(cdir, ...f.split("/")));
    if (t == null || !t.trim()) continue;
    const x = kind(f);
    const head = "### `contracts/" + f + "`";
    if (x === "md" || x === "markdown") contracts.push(head + "\n\n" + demoteMd(t, 2).trim());
    else {
      // the longest backtick run, by a loop: Math.max(...runs) threw RangeError on a contract of 300,000 runs (an MCP internal
      // error, never a refusal); trimEnd: t.replace(/\s+$/, "") was quadratic on an inner blank run (39 s at 200,000 blanks)
      let longest = 2;
      for (let i = 0, run = 0; i < t.length; i++) { run = t.charCodeAt(i) === 96 ? run + 1 : 0; if (run > longest) longest = run; }
      const fence = "`".repeat(longest + 1);
      contracts.push(head + "\n\n" + fence + SPECKIT_CONTRACT_EXT[x] + "\n" + t.trimEnd() + "\n" + fence);
    }
  }
  if (contracts.length) parts.push("## " + D.contracts + "\n\n" + W.skFrom("contracts/") + "\n\n" + contracts.join("\n\n"));
  // quickstart.md is no design: Spec Kit's ("runnable validation scenarios that prove the feature works end-to-end") IS the
  // feature's quickstart.md, the file trace reads an SC's coverage from — importRun writes it there (its title replaced by ours);
  // one holding only its title ("") leaves the scaffold's
  const q = rd("quickstart.md");
  model.quickstart = q == null ? null : demoteMd(q, 0).trim();
  if (skipped.length) model.skipped.push(...skipped);
  return parts.length ? parts.join("\n\n") : null;
}
// What the import leaves in the feature folder (checklists/, notes, an extra file were dropped silently), named for the "not
// imported" warning: every entry but a hidden one, a name the parser reads (SPECKIT_KNOWN, exactly) and the case twin of one whose
// read reached it (Windows' `Spec.md` that read("spec.md") read — on a case-sensitive file system that read fails and `Spec.md` is
// named: the decision follows the read, never the file system). A folder ends in "/", decided on the ENTRY (a link is named
// without it, live or dangling: the 1.41.1 rule). What the exact-name rule hides: a known name of the wrong kind — a FOLDER named
// plan.md, a FILE named contracts — whose read / listing gives null with no warning.
function specKitLeft(dir, src, got) {
  const es = src && src.list ? src.list(dir) : null;
  if (!es) return [];
  const names = new Set(es.map((e) => e.name));
  return es.filter((e) => {
    if (e.name.startsWith(".") || SPECKIT_KNOWN.includes(e.name)) return false;
    const low = e.name.toLowerCase();
    return !(SPECKIT_KNOWN.includes(low) && !names.has(low) && got.has(low));
  }).map((e) => e.name + (e.isDirectory() ? "/" : ""));
}
// A markdown document as a design.md section's body: its title (a first non-blank `# ` line) dropped and every ATX heading `by`
// levels down (at most ######), outside fenced code — a `#` line in a code block is code.
function demoteMd(text, by = 1) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const first = lines.findIndex((l) => l.trim());
  if (first !== -1 && /^#\s/.test(lines[first])) lines.splice(first, 1);
  let fence = null;
  return lines.map((l) => {
    if (fence) { if (skClosesFence(l, fence)) fence = null; return l; }
    const f = RE_SK_FENCE.exec(l);
    if (f) { fence = f[1]; return l; }
    const h = /^(#{1,6})(\s.*|)$/.exec(l);
    return h ? "#".repeat(Math.min(6, h[1].length + by)) + h[2] : l;
  }).join("\n");
}

module.exports = { parseSpecKit, citesFr, frLine, skTaskLine, __link }; // citesFr · frLine · skTaskLine: the tests' equivalence rows
