"use strict";

/**
 * dev-spec-driven engine — project templates (.specs/templates/).
 * A team's own scaffolds over the built-in i18n ones: resolution, variables, the track-block rule, the project
 * templates' placeholder corpus, and spec_templates (list / init / check).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { CTX } = require("./ctx.js"); // the shared per-call state (mutated in place)
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acDuplicates, artifactState, bugSectionFilled, customSteeringStub, earsValidate, existsCached, extractAcIds,
  extractSection, extractTestIds, headingHasMarker, inactiveMarkerLines, insertPackRequirements, isInsideDir, isObj,
  isPackTrack, markerTracks, normalizeLang, normalizeTracks, own, packChecklistBlock, packCorpusSets, packOf,
  packRequirementsBlock, packTaskBlock, packTestRowsBlock, packTracks, parseTasks, planIdText, projectLang, PROTO_KEYS,
  RE_ACTIVE_TRACKS, RE_CONSTITUTION_CHECK, RE_CUSTOM_STEERING, RE_TESTABILITY, RE_TODO_SENTINEL, RE_WIN_RESERVED,
  readCacheKey, readDirCached, readIfExists, REPRO_SYN, requirementAcIds, REUSE_SYN, RISKS_SYN, ROOT_CAUSE_SYN, slugify,
  specsDirOf, specsRoot, statePath, steeringFrontMatter, stripHtmlComments, taskDescription, taskMarkerValues,
  tasksProseText, templateBracketKeys, TRACK_MARKER, trackAcIds, trackDesignBlock, trackLabel, trackMarker,
  trackSectionTable, trackTaskBlock, trackTaskHeading, trackTemplateAcs, TRADEOFFS_SYN, weighSection, writeIfAbsent;
function __link(E) { ({ acDuplicates, artifactState, bugSectionFilled, customSteeringStub, earsValidate, existsCached,
  extractAcIds, extractSection, extractTestIds, headingHasMarker, inactiveMarkerLines, insertPackRequirements,
  isInsideDir, isObj, isPackTrack, markerTracks, normalizeLang, normalizeTracks, own, packChecklistBlock,
  packCorpusSets, packOf, packRequirementsBlock, packTaskBlock, packTestRowsBlock, packTracks, parseTasks, planIdText,
  projectLang, PROTO_KEYS, RE_ACTIVE_TRACKS, RE_CONSTITUTION_CHECK, RE_CUSTOM_STEERING, RE_TESTABILITY,
  RE_TODO_SENTINEL, RE_WIN_RESERVED, readCacheKey, readDirCached, readIfExists, REPRO_SYN, requirementAcIds, REUSE_SYN, RISKS_SYN,
  ROOT_CAUSE_SYN, slugify, specsDirOf, specsRoot, statePath, steeringFrontMatter, stripHtmlComments, taskDescription,
  taskMarkerValues, tasksProseText, templateBracketKeys, TRACK_MARKER, trackAcIds, trackDesignBlock, trackLabel,
  trackMarker, trackSectionTable, trackTaskBlock, trackTaskHeading, trackTemplateAcs, TRADEOFFS_SYN, weighSection,
  writeIfAbsent } = E); }

// ---------------------------------------------------------------------------
// Project templates — .specs/templates/ (1.14): a team's own scaffolds over the built-in i18n ones
// ---------------------------------------------------------------------------
//
// `.specs/templates/<artifact>.md` replaces the built-in template of that artifact (TEMPLATE_ARTIFACTS);
// `.specs/templates/<lang>/<artifact>.md` (en | pt | es) replaces it for features in that language and wins over the shared
// one; `steering/<file>.md` (also under <lang>/) replaces a steering stub. Only those names are ever read — every path is
// built from the allowlist and LANGS, never from a caller's string; a linked folder under templates/ is never entered and a
// file whose real path is outside the project is ignored. A .specs/templates/ holding a .state.json is a FEATURE created
// before 1.14 (reservedSlug): it stays that feature and is never read as templates.
// Scaffolding stays create-only (writeIfAbsent): createFeature (spec_import through it), applyTracks (spec_add_track),
// initProject and scaffoldSteeringFile use an override when present. Variables (case-insensitive, spaces allowed inside
// the braces): {{name}} {{slug}} {{summary}} {{tracks}} {{lang}} {{date}}; an unknown {{x}} is left as is; a feature
// without a summary gets the language's generic slot ([TBD] / [a definir] / [por definir]), so it still reads 'placeholder'.
// Steering overrides: {{name}} / {{slug}} are the project folder's name, {{tracks}} the tracks init was given (core for a
// single steering file). A template is read BOM-stripped with LF line ends; a whitespace-only file is ignored.
// Track blocks — the ONE rule for an overridden design.md / requirements.md / tasks.md / test-plan.md: every active track
// still gets what the built-in template would hold for it, appended at the end as spec_add_track appends it — design:
// +tdd's Testability Notes and the [SaaS] / [AI] / [SEC] / [PRIVACY] sections (trackDesignBlock); requirements: the marker
// track's "#### [SaaS] Acceptance Criteria (EARS)" block of the built-in requirements (trackRequirementsBlock — renumbered
// after the template's own US-1 ACs when an ID would collide); tasks: the track's task block (trackTaskBlock) and test plan: its
// rows of the built-in plan under "## [SaaS] <matrix heading>" (trackTestRowsBlock, T-IDs after the template's), both citing
// the IDs requirements.md defines for the track (trackIdMap) — UNLESS the template already carries that track (the marker on
// a real heading, the localized Testability Notes, the track's task-block heading; for the test plan: it cites the track's
// criteria). The bugfix variants and every other artifact are written as the template says (a bugfix's extra tracks come
// through applyTracks, as for the built-in ones).
// Placeholders: the bracket texts, code-span slots and task lines of the project's templates join the template corpus
// (projectTemplateSets(), for the .specs/ folder the current engine call works in — TEMPLATE_SCOPE_ROOT, set by specsRoot()),
// so an untouched custom scaffold reads 'placeholder' for doctor / approve / next_action; bug.md's own slots join
// bugTemplateSlots' role. A slot holding a variable (`[Describe {{name}}]`) matches whatever the variable became — a linear
// wildcard match (templateWildcard), never a regex built from the template. Memoized per engine call (dropped when the engine
// writes under .specs/templates/ — forgetCached); each file's parse is cached across calls by its content.
const TEMPLATES_DIR = "templates";
// key → the file it scaffolds. The bugfix flow has its own templates (its requirements / test plan / tasks differ).
const TEMPLATE_ARTIFACTS = Object.freeze({
  classification: "classification.md", requirements: "requirements.md", design: "design.md", tasks: "tasks.md",
  "test-plan": "test-plan.md", "eval-plan": "eval-plan.md", "load-test": "load-test.md", quickstart: "quickstart.md",
  checklist: "checklist.md", "integration-plan": "integration-plan.md",
  bug: "bug.md", "bug-requirements": "requirements.md", "bug-test-plan": "test-plan.md", "bug-tasks": "tasks.md",
  spike: "spike.md", "spike-tasks": "tasks.md", // 1.14 C2 — the spike kind's scaffolds
  change: "change.md", // 1.21 F5 — a change's one file (kind change, size xs)
});
// The chain artifacts a gate reads — a template of theirs with no slot at all scaffolds an approvable file (check warns).
const TEMPLATE_CHAIN = new Set(["requirements", "design", "test-plan", "eval-plan", "tasks", "bug", "bug-requirements", "bug-test-plan", "bug-tasks", "change"]);
const TEMPLATE_VARS = ["name", "slug", "summary", "tracks", "lang", "date"];
const RE_TEMPLATE_VAR = /\{\{\s*([A-Za-z_][\w-]*)\s*\}\}/g;
const RE_TEMPLATE_KNOWN_VAR = new RegExp("\\{\\{\\s*(?:" + TEMPLATE_VARS.join("|") + ")\\s*\\}\\}", "i");
const RE_TEMPLATE_KNOWN_VAR_G = new RegExp(RE_TEMPLATE_KNOWN_VAR.source, "gi");

const templateRel = (key) => (key.startsWith("steering/") ? key : key + ".md");
// A steering file name a template may carry: a known stub, or a custom scoped file name (steering_scaffold's rule).
function steeringTemplateName(f) {
  if (i18n.steeringKnownFiles().includes(f)) return true;
  if (!RE_CUSTOM_STEERING.test(f)) return false;
  const stem = f.slice(0, -3);
  return !RE_WIN_RESERVED.test(stem) && !PROTO_KEYS.has(stem);
}
// A template name as given — "requirements", "Requirements.md", "steering/tech", "steering\\tech.md" — → its key, or null.
function templateKey(input) {
  if (typeof input !== "string") return null;
  let s = input.trim().replace(/\\/g, "/").toLowerCase();
  if (s.startsWith("steering/")) {
    let f = s.slice("steering/".length);
    if (!f.endsWith(".md")) f += ".md";
    return steeringTemplateName(f) ? "steering/" + f : null;
  }
  if (s.endsWith(".md")) s = s.slice(0, -3);
  return s && own(TEMPLATE_ARTIFACTS, s) ? s : null;
}
const templateKeyList = () => Object.keys(TEMPLATE_ARTIFACTS).join(", ");

// One template file's text — BOM stripped, LF line ends; raw: also a whitespace-only one ("" — check reports it). null when
// absent, not a regular file, or its real path is outside the project (a link, or a linked .specs/ / templates/ folder).
function readTemplateFile(abs, projectDir, raw) {
  if (!existsCached(abs)) return null;
  try {
    const real = fs.realpathSync.native(abs);
    if (!isInsideDir(fs.realpathSync.native(projectDir), real) || !fs.statSync(real).isFile()) return null;
  } catch { return null; }
  const text = readIfExists(abs);
  if (text == null) return null;
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  return raw || clean.trim() ? clean : null;
}

// Every file under .specs/templates/ as the engine reads it: [{ rel, abs, key, lang }] — key null for a file that is not a
// template name (listed as ignored, never read). Three levels at most: <file>, steering/<file>, <lang>/[steering/]<file>.
function templateFileList(projectDir) {
  const tdir = path.join(specsRoot(projectDir), TEMPLATES_DIR);
  const out = [];
  const entries = (d) => (readDirCached(d) || []).filter((e) => !e.name.startsWith(".")); // .gitkeep, .DS_Store: not listed
  const isDir = (d, e) => e.isDirectory() && !e.isSymbolicLink();
  const walkSteering = (d, relBase, lang) => {
    for (const e of entries(d)) {
      const rel = relBase + "steering/" + e.name;
      const ok = !isDir(d, e) && steeringTemplateName(e.name);
      out.push({ rel, abs: path.join(d, e.name), key: ok ? "steering/" + e.name : null, lang });
    }
  };
  const walk = (d, relBase, lang) => {
    for (const e of entries(d)) {
      const abs = path.join(d, e.name);
      if (isDir(d, e)) {
        if (e.name === "steering") walkSteering(abs, relBase, lang);
        else if (!lang && i18n.LANGS.includes(e.name)) walk(abs, e.name + "/", e.name);
        else out.push({ rel: relBase + e.name + "/", abs, key: null, lang });
        continue;
      }
      const stem = /\.md$/.test(e.name) ? e.name.slice(0, -3) : null;
      out.push({ rel: relBase + e.name, abs, key: stem && own(TEMPLATE_ARTIFACTS, stem) ? stem : null, lang });
    }
  };
  if (existsCached(tdir) && !existsCached(statePath(tdir))) walk(tdir, "", null); // a pre-1.14 feature named templates: no templates (reservedSlug)
  return out.map((x) => ({ ...x, rel: ".specs/" + TEMPLATES_DIR + "/" + x.rel }));
}

// → { key, text, rel } of the project's template for `key` in language `lang` (its <lang>/ file first), or null. Only the
// files templateFileList knows (exact names, no linked folder) — the list, the corpus and the scaffolds read the same ones.
// A regional variant falls back to its family's folder before the shared one (full review Pb8): a pt-BR feature reads
// templates/pt-BR/<a>.md, then templates/pt/<a>.md, then templates/<a>.md, then the built-in.
function templateLangChain(lang) {
  const l = normalizeLang(lang);
  const b = i18n.baseLang(l);
  return b !== l ? [l, b] : [l];
}
function templateOverride(projectDir, key, lang) {
  const files = templateFileList(projectDir).filter((f) => f.key === key);
  for (const f of [...templateLangChain(lang).map((l) => files.find((x) => x.lang === l)), files.find((x) => x.lang == null)]) {
    const text = f ? readTemplateFile(f.abs, projectDir) : null;
    if (text != null) return { key, text, rel: f.rel };
  }
  return null;
}

// The values the variables take for one scaffold. v: { name, slug, summary, tracks }.
function templateVars(v, lang) {
  const summary = v.summary != null && String(v.summary).trim() ? String(v.summary) : i18n.msg(lang).templates.noSummary;
  return {
    name: String(v.name == null ? "" : v.name),
    slug: String(v.slug == null ? "" : v.slug),
    summary,
    tracks: trackLabel(normalizeTracks(v.tracks || ["core"])),
    lang: normalizeLang(lang),
    date: new Date().toISOString().slice(0, 10),
  };
}
function renderTemplate(text, vars) {
  return String(text).replace(RE_TEMPLATE_VAR, (m, k) => { const key = k.toLowerCase(); return own(vars, key) ? vars[key] : m; });
}

// A marker track's criteria block of the built-in requirements (its "#### [SaaS] Acceptance Criteria (EARS)" section), in
// `lang` — what an overridden requirements.md gets for an active track it has no heading for. "" for core / tdd. Its IDs
// (US-1.AC-5…) are kept unless `existing` (the text it is appended to) already defines one of them: then the whole block is
// renumbered after the highest US-1 AC there — a team template with its own US-1.AC-5 must never get a duplicate ID.
function trackRequirementsBlock(tr, lang, existing) {
  if (!TRACK_MARKER[tr]) return "";
  const full = i18n.requirements({ name: "x", tracks: ["core", tr], summary: "" }, lang);
  const drop = inactiveMarkerLines(full, ["core"]); // exactly that track's section
  const block = full.split(/\r?\n/).filter((_, i) => drop.has(i)).join("\n").trim();
  const have = requirementAcIds(existing || "");
  const ids = [...extractAcIds(block)];
  if (!ids.some((id) => have.has(id))) return block;
  let n = Math.max(0, ...[...have].filter((id) => id.startsWith("US-1.AC-")).map((id) => parseInt(id.slice(8), 10)));
  const map = {};
  ids.forEach((id) => { map[id] = ++n; });
  return block.replace(/^(\d+)\.(\s+\*\*)(US-\d+\.AC-\d+)(?!\d)/gm, (m, num, mid, id) => (own(map, id) ? map[id] + "." + mid + "US-1.AC-" + map[id] : m));
}
// A marker track's template AC IDs → the IDs requirements.md defines AS that track's criteria (trackAcIds, in order), or
// null when it doesn't define exactly as many (the template's IDs where nothing was renumbered).
function trackIdMap(reqText, tr) {
  const tmpl = trackTemplateAcs(tr);
  const actual = [...trackAcIds(reqText || "", tr)];
  if (!tmpl.length || actual.length !== tmpl.length) return null;
  const map = {};
  tmpl.forEach((id, i) => { map[id] = actual[i]; });
  return map;
}
// A marker track's rows of the built-in test plan pointed at the feature's IDs for them (map), under the built-in's
// traceability heading marked with the track and its table header — what an overridden test-plan.md gets for an active
// track whose criteria requirements.md defines and the template plans nothing for. Each row keeps the T-ID the built-in plan
// gives it for this track set (the one the built-in tasks' _Makes green:_ cite) while the plan doesn't use that number, else
// the next free one (`used`: the T numbers in use — updated). null: nothing to add.
function trackTestRowsBlock(tr, lang, used, map, tracks) {
  const acs = trackTemplateAcs(tr);
  const lines = i18n.testPlan("x", lang, ["core", "tdd", tr]).split("\n");
  const isRow = (l) => /^\|\s*T-\d+\s*\|/.test(l);
  const first = lines.findIndex(isRow);
  if (!acs.length || first < 2) return null;
  const heading = (lines.slice(0, first).reverse().find((l) => /^##\s/.test(l)) || "").replace(/^##\s+/, "");
  const order = i18n.templateAcIds(tracks);
  const pick = (ac) => {
    const i = order.indexOf(ac);
    const n = i >= 0 && !used.has(i + 1) ? i + 1 : Math.max(0, ...used) + 1;
    used.add(n);
    return "| T-" + String(n).padStart(2, "0");
  };
  const rows = lines.filter((l) => isRow(l) && [...extractAcIds(l)].some((a) => acs.includes(a)))
    .map((l) => l.replace(/^\|\s*T-\d+/, () => pick([...extractAcIds(l)].find((a) => acs.includes(a))))
      .replace(/(?<![A-Za-z0-9])US-\d+\.AC-\d+(?!\d)/g, (id) => (map && own(map, id) ? map[id] : id)));
  if (!rows.length) return null;
  return "\n## " + TRACK_MARKER[tr] + " " + heading + "\n\n" + lines[first - 2] + "\n" + lines[first - 1] + "\n" + rows.join("\n") + "\n";
}
// An overridden design.md / requirements.md / tasks.md / test-plan.md + the active tracks' blocks it doesn't carry (the
// rule above). reqText: () => the feature's requirements.md (tasks and test rows follow the IDs it defines for a track).
// opts (1.15): only — the tracks to add blocks for (a built-in scaffold: its track packs; the i18n builders wrote the rest);
// planText: () => the feature's test-plan.md (a track pack's tasks make its planned tests green); vars: { name, slug } for a pack
// fragment's {{name}} / {{slug}}. A track pack's criteria go right after the US-1 criteria (insertPackRequirements) and its
// checklist items at the end of checklist.md.
function withTrackBlocks(key, text, tracks, lang, reqText, opts = {}) {
  const want = (tr) => tracks.includes(tr) && (!opts.only || opts.only.includes(tr));
  const vars = opts.vars;
  let out = text;
  if (key === "design") {
    for (const tr of ["tdd", ...markerTracks()]) {
      if (!want(tr)) continue;
      const present = tr === "tdd" ? RE_TESTABILITY.test(stripHtmlComments(out)) : headingHasMarker(out, trackMarker(tr));
      if (!present) out = out.trimEnd() + "\n" + trackDesignBlock(tr, lang, vars);
    }
  } else if (key === "requirements") {
    for (const tr of markerTracks()) {
      if (!want(tr) || headingHasMarker(out, trackMarker(tr))) continue;
      if (isPackTrack(tr)) { out = insertPackRequirements(out, packRequirementsBlock(packOf(tr), lang, out, vars)); continue; }
      const block = trackRequirementsBlock(tr, lang, out);
      if (block) out = out.trimEnd() + "\n\n" + block + "\n";
    }
  } else if (key === "tasks") {
    const req = (reqText && reqText()) || "";
    const plan = isObj(opts) && opts.planText ? opts.planText() || "" : "";
    for (const tr of markerTracks()) {
      if (!want(tr)) continue;
      const block = isPackTrack(tr) ? packTaskBlock(packOf(tr), out, req, plan, lang, vars) : trackTaskBlock(tr, out, req, lang, trackIdMap(req, tr));
      if (block) out = out.trimEnd() + "\n" + block;
    }
  } else if (key === "test-plan") {
    const req = (reqText && reqText()) || "";
    for (const tr of markerTracks()) {
      if (!want(tr)) continue;
      if (isPackTrack(tr)) {
        const block = packTestRowsBlock(packOf(tr), lang, out, req, vars);
        if (block) out = out.trimEnd() + "\n" + block;
        continue;
      }
      const map = trackIdMap(req, tr);
      if (!map) continue; // requirements.md doesn't define the track's criteria (testPlanTracks' rule): no row for them
      const plan = planIdText(out);
      const cited = extractAcIds(plan);
      if (Object.values(map).some((id) => cited.has(id))) continue; // the template plans them already
      const used = new Set([...extractTestIds(plan)].map((id) => parseInt(id.slice(2), 10)));
      const block = trackTestRowsBlock(tr, lang, used, map, tracks);
      if (block) out = out.trimEnd() + "\n" + block;
    }
  } else if (key === "checklist") {
    for (const tr of packTracks()) { // the built-in tracks' items are the i18n builder's (a team's checklist template keeps its own)
      if (!want(tr)) continue;
      const block = packChecklistBlock(packOf(tr), lang, out, vars, (reqText && reqText()) || "");
      if (block) out = out.trimEnd() + "\n" + block + "\n";
    }
  }
  return out.endsWith("\n") ? out : out + "\n";
}
// The scaffold of one artifact → { text, template } — the project's template (variables substituted; opts.tracks: the track
// blocks it lacks) when there is one (template = its .specs/templates/… path), else builtIn() (template null) + the blocks of the
// active track packs (1.15) — the built-in builders only know the built-in tracks.
function scaffoldText(projectDir, key, lang, vars, builtIn, opts = {}) {
  const o = templateOverride(projectDir, key, lang);
  const packVars = { name: vars && vars.name != null ? String(vars.name) : undefined, slug: vars && vars.slug != null ? String(vars.slug) : undefined };
  if (!o) {
    const text = builtIn();
    const tracks = opts.tracks ? normalizeTracks(opts.tracks) : [];
    const packs = tracks.filter(isPackTrack);
    if (!packs.length || typeof text !== "string") return { text, template: null };
    return { text: withTrackBlocks(key, text, tracks, lang, opts.reqText, { only: packs, planText: opts.planText, vars: packVars }), template: null };
  }
  let text = renderTemplate(o.text, templateVars(vars, lang));
  if (opts.tracks) text = withTrackBlocks(key, text, normalizeTracks(opts.tracks), lang, opts.reqText, { planText: opts.planText, vars: packVars });
  return { text: text.endsWith("\n") ? text : text + "\n", template: o.rel };
}
// A steering stub: the project's template for that file when there is one, else the built-in (or custom) stub.
function steeringScaffold(projectDir, file, lang, tracks, builtIn) {
  const base = path.basename(path.resolve(projectDir));
  return scaffoldText(projectDir, "steering/" + file, lang, { name: base, slug: slugify(base), tracks }, builtIn);
}

// --- the project's templates as template corpus (placeholder detection) ---
const TEMPLATE_PARSE_CACHE = new Map(); // abs key → { text, parsed } across calls (bounded)
// "describe {{name}} here" → ["describe ", " here"] (null without a known variable, or with under 3 literal characters —
// `[{{name}}]` alone would match every bracket).
function templateWildcard(key) {
  if (!RE_TEMPLATE_KNOWN_VAR.test(key)) return null;
  const segs = key.split(RE_TEMPLATE_KNOWN_VAR_G);
  return segs.join("").replace(/\s+/g, "").length >= 3 ? segs : null;
}
// Linear wildcard match: each variable stands for at least one character; literals leftmost-first (optimal for `*` runs).
function wildcardMatch(segs, s) {
  const first = segs[0], last = segs[segs.length - 1];
  if (s.length < first.length + last.length + segs.length - 1 || !s.startsWith(first) || !s.endsWith(last)) return false;
  const end = s.length - last.length;
  let pos = first.length;
  for (let i = 1; i < segs.length - 1; i++) {
    const at = s.indexOf(segs[i], pos + 1);
    if (at === -1 || at + segs[i].length > end - 1) return false;
    pos = at + segs[i].length;
  }
  return pos < end;
}
const setOrWildcard = (entry, key) => entry.set.has(key) || entry.wild.some((w) => wildcardMatch(w, key));
function parseTemplateText(key, text) {
  const k = templateBracketKeys(text);
  const put = (entry, x) => { const w = templateWildcard(x); if (w) entry.wild.push(w); else entry.set.add(x); };
  const brackets = { set: new Set(), wild: [] }, tasks = { set: new Set(), wild: [] };
  k.brackets.forEach((x) => put(brackets, x));
  if (key === "tasks" || key === "bug-tasks" || key === "change") parseTasks(text).forEach((t) => put(tasks, taskDescription(t.text)));
  return { brackets, code: new Set(k.code), tasks };
}
function buildProjectTemplateSets(root) {
  const pdir = path.dirname(root);
  const files = templateFileList(pdir).filter((f) => f.key);
  if (!files.length) return null;
  const sets = { brackets: { set: new Set(), wild: [] }, code: new Set(), tasks: { set: new Set(), wild: [] }, bugSteps: { set: new Set(), wild: [] }, bugSlots: { set: new Set(), wild: [] } };
  const merge = (to, from) => { from.set.forEach((x) => to.set.add(x)); to.wild.push(...from.wild); };
  for (const f of files) {
    const text = readTemplateFile(f.abs, pdir);
    if (text == null) continue;
    const ck = readCacheKey(f.abs);
    let hit = TEMPLATE_PARSE_CACHE.get(ck);
    if (!hit || hit.text !== text) {
      if (TEMPLATE_PARSE_CACHE.size >= 512) TEMPLATE_PARSE_CACHE.clear();
      hit = { text, parsed: parseTemplateText(f.key, text) };
      TEMPLATE_PARSE_CACHE.set(ck, hit);
    }
    const p = hit.parsed;
    merge(sets.brackets, p.brackets);
    p.code.forEach((x) => sets.code.add(x));
    if (f.key === "tasks" || f.key === "change") merge(sets.tasks, p.tasks); // 1.21 F5: change.md holds the change's tasks
    if (f.key === "bug-tasks") merge(sets.bugSteps, p.tasks);
    if (f.key === "bug") merge(sets.bugSlots, p.brackets);
  }
  return sets;
}
// The current call's project template sets, or null (no project known, or no template in it).
function projectTemplateSets() {
  const root = CTX.TEMPLATE_SCOPE_ROOT;
  if (!root) return null;
  if (CTX.TEMPLATE_MEMO && CTX.TEMPLATE_MEMO.root === root) return CTX.TEMPLATE_MEMO.sets;
  const sets = buildProjectTemplateSets(root);
  if (CTX.READ_CACHE) CTX.TEMPLATE_MEMO = { root, tdirKey: readCacheKey(path.join(root, TEMPLATES_DIR)), sets };
  return sets;
}
// Is this placeholder key (placeholderKey) / task description / bug-report slot one of the project's templates'?
function projectTemplateHas(kind, key) {
  const ps = projectTemplateSets();
  if (ps && (kind === "code" ? ps.code.has(key) : setOrWildcard(ps[kind], key))) return true;
  // + the track packs' blocks (1.15): their slots, code-span slots and task lines are template text too
  if (kind !== "brackets" && kind !== "code" && kind !== "tasks") return false;
  const pk = packCorpusSets();
  return !!pk && (kind === "code" ? pk.code.has(key) : setOrWildcard(pk[kind], key));
}
// A feature dir's .specs/ as the scope's project when none is known yet (a direct detectPhase / artifactReport call).
function useTemplateScopeOf(dir) {
  if (CTX.TEMPLATE_SCOPE_ROOT || !CTX.READ_CACHE || !dir) return;
  const s = specsDirOf(dir);
  if (s) CTX.TEMPLATE_SCOPE_ROOT = s;
}

// --- spec_templates {action: list | init | check, artifact?, lang?} — `dev-spec templates [list|init|check] [artifact]` ---

// The built-in template of `key` in `lang`, as `init` copies it: the variables in place of the feature's values, core track
// only (the engine appends the active tracks' blocks — the rule above).
// tracks: the built-in as a feature with these tracks would get it (check compares a +tdd scaffold's _Makes green:_ T-IDs).
function builtInTemplate(key, lang, tracks) {
  if (key.startsWith("steering/")) {
    const f = key.slice("steering/".length);
    return i18n.steeringStub(f, lang) || customSteeringStub(f, lang);
  }
  const core = tracks || ["core"];
  const a = { name: "{{name}}", tracks: core, label: "{{tracks}}", slug: "{{slug}}", summary: "{{summary}}" };
  switch (key) {
    case "classification": return i18n.classification({ ...a, summary: "" }, lang); // the built-in has no Summary without one
    case "requirements": return i18n.requirements(a, lang);
    case "design": return i18n.design(a, lang);
    case "tasks": return i18n.tasks(a, lang);
    case "test-plan": return i18n.testPlan(a.name, lang, core);
    case "eval-plan": return i18n.evalPlan(a.name, lang);
    case "load-test": return i18n.loadTest(a.name, lang);
    case "quickstart": return i18n.quickstart(a.name, lang);
    case "checklist": return i18n.checklist(a, lang);
    case "integration-plan": return i18n.integrationPlan(a.name, lang);
    case "bug": return i18n.bugReport({ name: a.name, summary: a.summary }, lang);
    case "bug-requirements": return i18n.bugRequirements({ name: a.name, summary: a.summary }, lang);
    case "bug-test-plan": return i18n.bugTestPlan(a.name, lang);
    case "bug-tasks": return i18n.bugTasks(a.name, lang);
    case "spike": return i18n.msg(lang).spike.report({ name: a.name, question: a.summary }); // 1.14 C2: {{summary}} = the spike's question
    case "spike-tasks": return i18n.msg(lang).spike.tasks(a.name);
    case "change": return i18n.change({ name: a.name, summary: a.summary }, lang); // 1.21 F5: a change's one file
    default: return null;
  }
}
const allTemplateKeys = () => [...Object.keys(TEMPLATE_ARTIFACTS), ...i18n.steeringKnownFiles().map((f) => "steering/" + f)];

function templates(projectDir, action, opts = {}) {
  const pl = projectLang(projectDir);
  let lang = null;
  if (opts.lang != null && String(opts.lang).trim()) {
    lang = i18n.canonicalLang(String(opts.lang)); // pt-BR / pt_br / PTBR → pt-BR (its folder is .specs/templates/pt-BR/)
    if (!lang) {
      const A = i18n.msg(pl).args;
      return { ok: false, error: A.invalid(A.item("lang", A.oneOf(i18n.LANGS.join(", ")), JSON.stringify(String(opts.lang)))) };
    }
  }
  const lng = lang || pl;
  const T = i18n.msg(lng).templates;
  const act = action == null || !String(action).trim() ? "list" : String(action).trim().toLowerCase();
  if (!["list", "init", "check"].includes(act)) return { ok: false, error: T.badAction(String(action)) };
  let key = null;
  if (opts.artifact != null && String(opts.artifact).trim()) {
    key = templateKey(String(opts.artifact));
    if (!key) return { ok: false, error: T.unknownArtifact(String(opts.artifact), templateKeyList()) };
  }
  // .specs/templates/ of a feature created before 1.14 stays that feature: nothing is read from it, nothing written into it.
  if (existsCached(statePath(path.join(specsRoot(projectDir), TEMPLATES_DIR)))) return { ok: false, legacyFeature: true, error: T.legacyFeature };
  if (act === "init") return initTemplates(projectDir, key, lang, lng);
  if (act === "check") return checkTemplates(projectDir, key, lang, lng);
  return listTemplates(projectDir, key, lng);
}

function listTemplates(projectDir, key, lng) {
  const T = i18n.msg(lng).templates;
  const files = templateFileList(projectDir);
  const custom = [...new Set(files.filter((f) => f.key && f.key.startsWith("steering/") && !allTemplateKeys().includes(f.key)).map((f) => f.key))].sort();
  const keys = key ? [key] : [...allTemplateKeys(), ...custom];
  const readable = (f) => readTemplateFile(f.abs, projectDir) != null;
  const entries = keys.map((k) => {
    const overrides = files.filter((f) => f.key === k && readable(f)).map((f) => ({ lang: f.lang, path: f.rel }));
    const eff = templateLangChain(lng).map((l) => overrides.find((o) => o.lang === l)).find(Boolean) || overrides.find((o) => o.lang == null) || null;
    return { artifact: k, file: k.startsWith("steering/") ? k : TEMPLATE_ARTIFACTS[k], source: eff ? "override" : "built-in", override: eff ? eff.path : null, overrides };
  });
  const ignored = files.filter((f) => !f.key).map((f) => f.rel);
  const n = entries.filter((e) => e.source === "override").length;
  const width = Math.max(...entries.map((e) => e.artifact.length));
  const lines = [T.listHead(lng, n), ...entries.map((e) => "  " + (e.source === "override" ? "✎ " : "· ") + e.artifact.padEnd(width) + "  " +
    (e.source === "override" ? T.override + "  " + e.override : T.builtIn))];
  if (ignored.length) lines.push(T.ignored(ignored.join(", ")));
  return { ok: true, action: "list", dir: path.join(specsRoot(projectDir), TEMPLATES_DIR), lang: lng, templates: entries, ignored, lines };
}

function initTemplates(projectDir, key, lang, lng) {
  const T = i18n.msg(lng).templates;
  const tdir = path.join(specsRoot(projectDir), TEMPLATES_DIR);
  const sub = lang ? [lang] : [];
  const created = [], kept = [];
  // Writes stay inside the project: a .specs/ or templates/ folder (or a <lang>/ / steering/ one) that is a link to a folder
  // elsewhere is refused — the nearest existing folder above each target must really be inside the project.
  const inside = (abs) => {
    let real;
    try { real = fs.realpathSync.native(projectDir); } catch { return true; } // no project folder yet: nothing in it is a link
    let d = path.dirname(abs);
    while (!fs.existsSync(d) && path.dirname(d) !== d) d = path.dirname(d);
    try { return isInsideDir(real, fs.realpathSync.native(d)); } catch { return false; }
  };
  for (const k of key ? [key] : allTemplateKeys()) {
    const text = builtInTemplate(k, lng);
    if (text == null) continue;
    const parts = [...sub, ...templateRel(k).split("/")];
    const rel = ".specs/" + TEMPLATES_DIR + "/" + parts.join("/");
    const abs = path.join(tdir, ...parts);
    if (!inside(abs)) return { ok: false, error: T.writeOutside(rel), created, kept };
    try {
      if (writeIfAbsent(abs, text)) created.push(rel);
      else kept.push(rel);
    } catch (e) {
      return { ok: false, error: T.writeFailed(rel, e.code || e.message), created, kept };
    }
  }
  const lines = created.length ? [T.initDone(created.length), ...created.map((c) => "  + " + c)] : [T.initNothing];
  if (created.length && kept.length) lines.push(T.initKept(kept.join(", ")));
  return { ok: true, action: "init", dir: tdir, lang: lng, created, kept, lines };
}

// The checks of one template text (raw: with its variables; the checks read it rendered with sample values).
function checkTemplateText(k, raw, rendered, fileLang, lng, add) {
  const P = i18n.msg(lng).templates.problems;
  raw.split("\n").forEach((l, i) => {
    for (const m of l.matchAll(RE_TEMPLATE_VAR)) if (!TEMPLATE_VARS.includes(m[1].toLowerCase())) add("warn", "unknown-variable", P["unknown-variable"](m[1]), i + 1);
  });
  if (TEMPLATE_CHAIN.has(k) && artifactState({ text: rendered }) === "filled") add("warn", "no-placeholders", P["no-placeholders"]);
  if (k === "requirements" || k === "bug-requirements") {
    const e = earsValidate(rendered, lng);
    if (e.ok) {
      for (const i of e.issues) {
        if (i.code === "no-modal") add("error", "ears-no-modal", i.msg, i.line);
        else if (i.code === "no-id" || i.code === "vague") add("warn", "ears-" + i.code, i.msg, i.line);
      }
      if (!e.summary.criteriaDetected) add("warn", "no-criteria", P["no-criteria"]);
    }
    const dups = acDuplicates(rendered);
    if (dups.length) add("error", "ac-duplicate", P["ac-duplicate"](dups.join(", ")));
  }
  if (k === "design") {
    if (!RE_CONSTITUTION_CHECK.test(rendered)) add("warn", "constitution-missing", P["constitution-missing"]);
    // 1.17 A1: no Alternatives & Trade-offs / Risks heading — doctor would warn on every feature scaffolded from it.
    if (weighSection(rendered, TRADEOFFS_SYN) == null) add("warn", "tradeoffs-missing", P["tradeoffs-missing"]);
    if (weighSection(rendered, RISKS_SYN) == null) add("warn", "risks-missing", P["risks-missing"]);
    // 1.19 R1: no Reuse & Integration heading — doctor would warn (design-reuse) on every feature scaffolded from it.
    if (weighSection(rendered, REUSE_SYN) == null) add("warn", "reuse-missing", P["reuse-missing"]);
    for (const tr of markerTracks()) { // + the track packs (1.15)
      const marker = trackMarker(tr);
      if (!headingHasMarker(raw, marker)) continue; // no heading of the track: the engine appends its whole block
      for (const sec of trackSectionTable(tr)) {
        const body = extractSection(raw, sec.syn, marker, sec.loose);
        const name = (i18n.msg(fileLang || lng).sectionNames || {})[sec.name] || sec.name;
        if (body == null) add("error", "missing-section", P["missing-section"](marker, name));
        else if (!RE_TODO_SENTINEL.test(body) && stripHtmlComments(body).trim()) add("warn", "no-sentinel", P["no-sentinel"](marker, name));
      }
    }
  }
  if (k === "bug") {
    for (const [syn, missing, filled, sev] of [[ROOT_CAUSE_SYN, "root-cause-missing", "root-cause-filled", "error"], [REPRO_SYN, "repro-missing", "repro-filled", "warn"]]) {
      if (extractSection(rendered, syn) == null) add(sev, missing, P[missing]);
      else if (bugSectionFilled(rendered, syn)) add(sev, filled, P[filled]);
    }
  }
  if ((k === "tasks" || k === "bug-tasks") && !parseTasks(rendered).length) add("warn", "no-tasks", P["no-tasks"]);
  if (k === "classification" && !rendered.split("\n").some((l) => RE_ACTIVE_TRACKS.test(l.trim()))) add("warn", "no-active-tracks", P["no-active-tracks"]);
  if (k.startsWith("steering/")) {
    const fm = steeringFrontMatter(rendered);
    if (fm.frontMatter && fm.inclusion === "fileMatch" && !fm.patterns.length) add("warn", "filematch-no-pattern", P["filematch-no-pattern"]);
  }
}

function checkTemplates(projectDir, key, lang, lng) {
  const T = i18n.msg(lng).templates;
  const P = T.problems;
  const inLang = templateFileList(projectDir).filter((f) => !lang || f.lang == null || templateLangChain(lang).includes(f.lang));
  const all = inLang.filter((f) => !key || f.key === key); // the files checked (and reported on)
  const problems = [];
  const add = (f, severity, code, message, line) => {
    if (key && f.key !== key) return; // a cross-check lands on a file outside `artifact`: not this check's report
    if (problems.some((p) => p.file === f.rel && p.code === code && p.message === message && p.line === line)) return;
    const p = { file: f.rel, artifact: f.key, lang: f.lang, severity, code, message };
    if (line) p.line = line;
    problems.push(p);
  };
  const checked = [];
  const sample = () => ({ name: "Example", slug: "example", summary: "", tracks: ["core"] });
  const texts = new Map(); // rel → { raw, rendered } of every readable template
  for (const f of all) {
    if (!f.key) { add(f, "warn", "unknown-file", P["unknown-file"]); continue; }
    const raw = readTemplateFile(f.abs, projectDir, true);
    if (raw == null) continue;
    const entry = { file: f.rel, artifact: f.key, lang: f.lang };
    checked.push(entry);
    if (!raw.trim()) { add(f, "warn", "empty", P.empty); continue; }
    const fileLang = f.lang || lng;
    const rendered = renderTemplate(raw, templateVars(sample(), fileLang));
    texts.set(f.rel, { f, raw, rendered });
    checkTemplateText(f.key, raw, rendered, f.lang, lng, (sev, code, msg, line) => add(f, sev, code, msg, line));
    // What the engine will append on its own (a track with no heading in the template) — informational.
    const appends = f.key === "design" ? ["tdd", ...markerTracks()].filter((tr) => (tr === "tdd" ? !RE_TESTABILITY.test(stripHtmlComments(raw)) : !headingHasMarker(raw, trackMarker(tr))))
      : f.key === "requirements" ? markerTracks().filter((tr) => !headingHasMarker(raw, trackMarker(tr)))
      : f.key === "tasks" ? markerTracks().filter((tr) => !trackTaskHeading(tr, raw)) : null;
    if (appends) entry.appends = appends;
  }
  // The cross-checks read every template of the language(s), even with `artifact` (a tasks template is judged against the
  // project's requirements template, not the built-in one) — they only report on the checked files (add).
  for (const f of inLang) {
    if (!f.key || texts.has(f.rel)) continue;
    const raw = readTemplateFile(f.abs, projectDir);
    if (raw != null) texts.set(f.rel, { f, raw, rendered: renderTemplate(raw, templateVars(sample(), f.lang || lng)) });
  }
  // AC IDs across the trio of one language context: a tasks / test-plan template citing IDs the requirements template
  // (the project's, else the built-in) doesn't define — and a requirements template the built-in tasks / test plan don't fit.
  const effective = (k, l, tracks) => {
    const hit = templateLangChain(l).map((c) => [...texts.values()].find((x) => x.f.key === k && x.f.lang === c)).find(Boolean) ||
      [...texts.values()].find((x) => x.f.key === k && x.f.lang == null);
    return hit ? { rendered: hit.rendered, f: hit.f } : { rendered: renderTemplate(builtInTemplate(k, l, tracks), templateVars(sample(), l)), f: null };
  };
  const contexts = [...new Set([lang || lng, ...[...texts.values()].map((x) => x.f.lang).filter(Boolean)])].filter((l) => !lang || l === lang);
  const citedIds = (k, text) => (k.endsWith("tasks") ? extractAcIds(tasksProseText(text)) : extractAcIds(planIdText(text)));
  for (const l of contexts) {
    for (const [reqK, others] of [["requirements", ["tasks", "test-plan"]], ["bug-requirements", ["bug-tasks", "bug-test-plan"]]]) {
      const req = effective(reqK, l);
      const defined = requirementAcIds(req.rendered);
      for (const ok of others) {
        const o = effective(ok, l);
        if (!o.f && !req.f) continue; // both built-in: consistent by construction
        const phantom = [...citedIds(ok, o.rendered)].filter((id) => !defined.has(id));
        if (!phantom.length) continue;
        if (o.f) add(o.f, "warn", "phantom-ac", P["phantom-ac"](phantom.join(", "), req.f ? req.f.rel : TEMPLATE_ARTIFACTS[reqK]));
        else add(req.f, "warn", "builtin-phantom", P["builtin-phantom"](TEMPLATE_ARTIFACTS[ok], phantom.join(", ")));
      }
    }
    // T-IDs: the tasks' _Makes green:_ against the test plan's rows, as a +tdd feature scaffolds them (the built-in tasks cite
    // the built-in plan's T-01…) — a test-plan template with its own IDs beside the built-in tasks is "unknown tests" in trace.
    for (const [tasksK, planK] of [["tasks", "test-plan"], ["bug-tasks", "bug-test-plan"]]) {
      const tk = effective(tasksK, l, ["core", "tdd"]), pk = effective(planK, l, ["core", "tdd"]);
      if (!tk.f && !pk.f) continue;
      const planned = new Set([...extractTestIds(planIdText(pk.rendered))].map((id) => parseInt(id.slice(2), 10)));
      const green = taskMarkerValues(tasksProseText(tk.rendered), "makes green").flatMap((v) => [...extractTestIds(v)]);
      const phantom = [...new Set(green.filter((id) => !planned.has(parseInt(id.slice(2), 10))))];
      if (!phantom.length) continue;
      if (tk.f) add(tk.f, "warn", "phantom-test", P["phantom-test"](phantom.join(", "), pk.f ? pk.f.rel : TEMPLATE_ARTIFACTS[planK]));
      else add(pk.f, "warn", "builtin-phantom-test", P["builtin-phantom-test"](TEMPLATE_ARTIFACTS[tasksK], phantom.join(", ")));
    }
  }
  const errors = problems.filter((p) => p.severity === "error").length;
  const warnings = problems.length - errors;
  const lines = [];
  if (!checked.length && !problems.length) lines.push(T.checkNone);
  else {
    lines.push(T.checkHead(checked.length, errors, warnings));
    problems.forEach((p) => lines.push("  " + (p.severity === "error" ? "✗ " : "▲ ") + p.file + (p.line ? ":" + p.line : "") + " — " + p.message));
    checked.filter((c) => c.appends && c.appends.length).forEach((c) => lines.push("  · " + T.appends(c.file, c.appends.map((t) => "+" + t).join(", "))));
  }
  return { ok: true, action: "check", lang: lng, checked, problems, errors, warnings, verdict: errors ? "fail" : warnings ? "warn" : "pass", lines };
}

module.exports = { TEMPLATES_DIR, TEMPLATE_ARTIFACTS, TEMPLATE_CHAIN, TEMPLATE_VARS, RE_TEMPLATE_VAR,
  RE_TEMPLATE_KNOWN_VAR, RE_TEMPLATE_KNOWN_VAR_G, templateRel, steeringTemplateName, templateKey, templateKeyList,
  readTemplateFile, templateFileList, templateLangChain, templateOverride, templateVars, renderTemplate,
  trackRequirementsBlock, trackIdMap, trackTestRowsBlock, withTrackBlocks, scaffoldText, steeringScaffold,
  TEMPLATE_PARSE_CACHE, templateWildcard, wildcardMatch, setOrWildcard, parseTemplateText, buildProjectTemplateSets,
  projectTemplateSets, projectTemplateHas, useTemplateScopeOf, builtInTemplate, allTemplateKeys, templates,
  listTemplates, initTemplates, checkTemplateText, checkTemplates, __link };
