"use strict";

/**
 * dev-spec-driven engine — release notes and milestones.
 * spec_changelog (from the spec data only) and spec_milestone (roadmap.json meta.milestones).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, acOneLine, activeDesign, day, detectTracks, existingFeature, fcDay, fcIso, featureDirs, forecastData,
  isApprovalRecord, isGeneratedOrAbsent, isObj, isRecord, italic, maybeRefreshRoadmap, placeholderReport, projectLang,
  readContained, readRoadmap, requirementIndex, resolveSupersedes, roadmap, roadmapError, ROOT_CAUSE_SYN,
  sectionFirstParagraph, sha1Hex, slugify, specsRoot, specTitle, stateFromFile, statePath, SUMMARY_SYN,
  supersedesMarkers, timeOf, utcStamp, withRoadmapLock, writeFileAtomic, writeRoadmap;
function __link(E) { ({ acIndex, acOneLine, activeDesign, day, detectTracks, existingFeature, fcDay, fcIso, featureDirs,
  forecastData, isApprovalRecord, isGeneratedOrAbsent, isObj, isRecord, italic, maybeRefreshRoadmap, placeholderReport,
  projectLang, readContained, readRoadmap, requirementIndex, resolveSupersedes, roadmap, roadmapError, ROOT_CAUSE_SYN,
  sectionFirstParagraph, sha1Hex, slugify, specsRoot, specTitle, stateFromFile, statePath, SUMMARY_SYN,
  supersedesMarkers, timeOf, utcStamp, withRoadmapLock, writeFileAtomic, writeRoadmap } = E); }

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
    writeFileAtomic(file, markdown);
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

module.exports = { isoTime, oneLiner, releaseAcs, changelogData, renderReleaseNotes, changelog, MILESTONE_ACTIONS,
  MILESTONE_STATUSES, MILESTONE_MAX, MILESTONE_FEATURES_MAX, RE_MILESTONE_NAME, RE_ISO_DAY, milestoneName, milestoneKey,
  milestoneFileKey, strList, slugList, milestoneStore, milestoneInvalidInfo, findMilestone, milestoneStatuses,
  milestoneAttention, MILESTONE_ICON, milestoneLine, milestonesNow, milestone, milestonesFollow, __link };
