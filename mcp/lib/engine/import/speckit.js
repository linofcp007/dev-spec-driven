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
  newImportModel, RE_MD_HR, stripEnd, stripHtmlComments, tidyLines, titleFromStory, unusedLines, planPaths;
function __link(E) { ({ blankFacts, earsFromGwt, isLtUnit, isWsUnit, leftoverExtras, markRange, mdBody, mdHeadings,
  mdListItems, mdRange, newImportModel, RE_MD_HR, stripEnd, stripHtmlComments, tidyLines, titleFromStory, unusedLines, planPaths } = E); }

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
function parseSpecKit(dir, read, W) {
  const spec = read(path.join(dir, "spec.md"));
  const plan = read(path.join(dir, "plan.md"));
  const tasks = read(path.join(dir, "tasks.md"));
  if (spec == null && tasks == null) return null;
  const model = newImportModel();
  model.nameHint = path.basename(dir).replace(/^\d+[-_]/, "") || path.basename(dir);
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
    // the functional requirements travel as prose — never silently: the ones no acceptance scenario covers are named
    const frs = uncoveredFrs((model.extra.find((x) => x.key === "functional") || { lines: [] }).lines, model.stories.flatMap((s) => s.criteria.map((c) => c.raw)));
    if (frs.length) model.warnings.push(W.wUncoveredFr(frs.join(", ")));
  }
  // research.md, data-model.md, contracts/ and quickstart.md are design — each under its own heading after plan.md
  // (they were skipped with a warning: "not imported"). Read through `read` like every source file: inside the project, a file
  // over the import cap refuses the import.
  const docs = specKitDesignDocs(dir, read, W, model);
  if (plan != null || docs) model.design = { text: [plan, docs].filter((x) => x != null).join("\n\n"), file: "plan.md" };
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
function uncoveredFrs(frLines, scenarios) {
  const scen = scenarios.map((t) => ({ text: String(t), words: new Set(frWords(t)) }));
  const out = [];
  for (const l of frLines) {
    const m = /(?<![A-Za-z0-9])(FR-\d+)(?!\d)[*_\s]*:?[*_\s]*(.*)$/.exec(l);
    if (!m || out.includes(m[1])) continue;
    const id = m[1], body = m[2];
    const words = /NEEDS[ _-]CLARIFICATION/i.test(body) ? [] : frWords(body);
    const cited = scen.some((s) => new RegExp("(?<![A-Za-z0-9])" + id + "(?!\\d)").test(s.text));
    if (!cited && !(words.length && scen.some((s) => words.every((w) => s.words.has(w))))) out.push(id);
  }
  return out;
}

// spec-kit's tasks.md says which story a task serves ([US1]) and names the files it touches in its text: the import
// kept both as prose, so trace_check found every criterion uncovered right after an import. Each task line (a checkbox outside fenced
// code and HTML comments) gets the sub-lines it lacks: `_Requirements: US<n>_` for its [USn] tag (importSpec's refs turn US<n> into
// that story's AC IDs, as for a hand-written one) and `_Implements: <paths>_` for the paths its text names (planPaths — the plan
// import's rule: a folder part and an extension, never a URL / absolute / home path / glob). A task that already carries the marker
// (its line or an indented sub-line) keeps it.
const RE_SK_TASK = /^(\s*)[-*+]\s+\[[ xX~\-/]\]\s+(.*)$/;
const RE_SK_STORY_TAG = /\[US-?(\d+)\]/i;
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
    const m = opens ? null : RE_SK_TASK.exec(l);
    if (opens) { inComment = true; continue; }
    if (!m) continue;
    const indent = m[1].length;
    let j = i + 1; // the task's own body: the indented lines below it
    while (j < lines.length && lines[j].trim() && indentOf(lines[j]) > indent) j++;
    const own = lines.slice(i, j).join("\n");
    const sub = " ".repeat(indent + 2) + "- ";
    const tag = RE_SK_STORY_TAG.exec(m[2]);
    if (tag && !/_Requirements:/i.test(own)) out.push(sub + "_Requirements: US" + tag[1] + "_");
    const paths = planPaths(m[2]);
    if (paths.length && !/_Implements:/i.test(own)) out.push(sub + "_Implements: " + paths.join(", ") + "_");
  }
  return out.join(eol);
}
// spec-kit's design documents beside plan.md, in its own order (research → data model → contracts → quickstart),
// as design.md sections: `## <localized title>`, a provenance line, then the document — its first-line title dropped and every
// other heading one level down (outside fenced code), so its sections stay under ours; a contract that is no markdown goes into a
// fenced block (its language from the extension). contracts/ is read two levels deep, sorted, at most SPECKIT_CONTRACTS_MAX files of
// a text kind (SPECKIT_CONTRACT_EXT); the rest are named in model.skipped (the import's "not imported" warning). → the text | null.
const SPECKIT_CONTRACTS_MAX = 30;
const SPECKIT_CONTRACT_EXT = { md: "", markdown: "", yaml: "yaml", yml: "yaml", json: "json", jsonc: "json", graphql: "graphql", gql: "graphql",
  proto: "proto", txt: "", http: "http", rest: "http", xml: "xml", avsc: "json", sql: "sql" };
function specKitDesignDocs(dir, read, W, model) {
  const D = W.skDocs;
  const parts = [];
  // (a document holding nothing but its title carries nothing: no empty section)
  const section = (title, file, body) => { if (body.trim()) parts.push("## " + title + "\n\n" + W.skFrom(file) + "\n\n" + body.trim()); };
  for (const [file, title] of [["research.md", D.research], ["data-model.md", D.dataModel]]) {
    const t = read(path.join(dir, file));
    if (t != null && t.trim()) section(title, file, demoteMd(t));
  }
  const cdir = path.join(dir, "contracts");
  const files = [];
  const walk = (d, rel, depth) => {
    let es;
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (e.name.startsWith(".")) continue;
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) { if (depth < 2) walk(path.join(d, e.name), r, depth + 1); }
      else files.push(r);
    }
  };
  walk(cdir, "", 1);
  const kind = (f) => { const x = (/\.([A-Za-z0-9]+)$/.exec(f) || [])[1]; return x != null && Object.prototype.hasOwnProperty.call(SPECKIT_CONTRACT_EXT, x.toLowerCase()) ? x.toLowerCase() : null; };
  const textual = files.filter((f) => kind(f) != null);
  const skipped = files.filter((f) => kind(f) == null).concat(textual.slice(SPECKIT_CONTRACTS_MAX)).map((f) => "contracts/" + f);
  const contracts = [];
  for (const f of textual.slice(0, SPECKIT_CONTRACTS_MAX)) {
    const t = read(path.join(cdir, ...f.split("/")));
    if (t == null || !t.trim()) continue;
    const x = kind(f);
    const head = "### `contracts/" + f + "`";
    if (x === "md" || x === "markdown") contracts.push(head + "\n\n" + demoteMd(t, 2).trim());
    else {
      const longest = Math.max(2, ...(t.match(/`+/g) || []).map((s) => s.length));
      const fence = "`".repeat(longest + 1);
      contracts.push(head + "\n\n" + fence + SPECKIT_CONTRACT_EXT[x] + "\n" + t.replace(/\s+$/, "") + "\n" + fence);
    }
  }
  if (contracts.length) parts.push("## " + D.contracts + "\n\n" + W.skFrom("contracts/") + "\n\n" + contracts.join("\n\n"));
  const q = read(path.join(dir, "quickstart.md"));
  if (q != null && q.trim()) section(D.quickstart, "quickstart.md", demoteMd(q));
  if (skipped.length) model.skipped.push(...skipped);
  return parts.length ? parts.join("\n\n") : null;
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

module.exports = { parseSpecKit, __link };
