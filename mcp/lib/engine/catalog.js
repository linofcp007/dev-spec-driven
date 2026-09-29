"use strict";

/**
 * dev-spec-driven engine — the living catalog and _Supersedes:_.
 * _Supersedes:_ markers and their resolution, and the generated .specs/SPECS.md.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { TRACE_INFO_FIELDS } = require("./trace.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, activeDesign, activeTasks, catalogDecisions, changedSinceApproval, criterionBlocks, crossFeatureAcs,
  detectPhase, detectTracks, extractAcIds, featureDirs, featureShipped, FOLD_CASE, isBacktickUnit, isGeneratedOrAbsent,
  isObj, locateFeatures, pendingGateList, placeholderReport, projectLang, RE_DEFINES_AC, readContained, readIfExists,
  renderCrossAcsMd, shippedSupersedeKeys, slugify, specsRoot, spikeInfo, staleFinish, stateFromFile, statePath,
  stripEnds, trackLabel, verificationStatus, writeFileAtomic;
function __link(E) { ({ acIndex, activeDesign, activeTasks, catalogDecisions, changedSinceApproval, criterionBlocks,
  crossFeatureAcs, detectPhase, detectTracks, extractAcIds, featureDirs, featureShipped, FOLD_CASE, isBacktickUnit,
  isGeneratedOrAbsent, isObj, locateFeatures, pendingGateList, placeholderReport, projectLang, RE_DEFINES_AC,
  readContained, readIfExists, renderCrossAcsMd, shippedSupersedeKeys, slugify, specsRoot, spikeInfo, staleFinish,
  stateFromFile, statePath, stripEnds, trackLabel, verificationStatus, writeFileAtomic } = E); }

// ---------------------------------------------------------------------------
// Living catalog (.specs/SPECS.md) · _Supersedes:_ · restore · drift since finish
// ---------------------------------------------------------------------------

// `_Supersedes: <feature>/US-n.AC-m[, …]_` — English-stable, on a criterion of requirements.md (its line or a sub-line):
// that criterion replaces an AC of an earlier feature, active or archived. Read like the task markers: HTML comments
// and fenced code never count, the value runs to the first underscore followed by whitespace, punctuation or the end
// (requirements are prose: `…_.`, `(…_)`, `**…_**`, `…_|`) and is kept whole (then split on , / ;). The referenced ID
// is ANOTHER feature's — stripped before this feature's own AC IDs are read.
// A long list wraps like any criterion: a newline continues the value unless the next line is blank or opens a new
// list item / block (heading, quote, table row, rule, fence) — criterionBlocks' boundaries, so traceCheck (whole
// text), acIndex and supersedesMarkers (one criterion at a time, lines joined by "\n") all read the same marker.
const SUP_NL = "\\r?\\n(?![ \\t]*(?:\\r?\\n|$|(?:[-*+]|\\d+[.)])[ \\t]|#{1,6}[ \\t]|[>|]|```|~~~|(?:-{3,}|={3,}|\\*{3,})[ \\t]*(?:\\r?\\n|$)))";
// The value never runs into a second marker (an unclosed one before it stays unclosed).
// The blanks after the colon: all of them (the value starts at its first other unit) — or, only when that finds no closing
// "_", all but the last one when the next unit is that "_" (`_Supersedes: _`: a one-blank value). That is what
// `_Supersedes:[ \t]*(…+?)_` read, without rescanning the value from each of a long blank run's units (1.17 H).
const RE_SUPERSEDES_SRC = "_Supersedes:(?:[ \\t]*(?=[^ \\t])|[ \\t]*?(?=[ \\t]_))((?:(?!_Supersedes:)[^\\r\\n]|" + SUP_NL + ")+?)_(?=[\\s.,;:!?)\\]*`|'\"]|$)";
// Safety net: a marker never closed runs to the end of its criterion — its foreign ID must never become one of this
// feature's ACs; supersedesMarkers reports it (reason `unterminated`).
const RE_SUPERSEDES_OPEN_SRC = "_Supersedes:[ \\t]*((?:[^\\r\\n]|" + SUP_NL + ")*)";
function stripSupersedes(text) {
  return String(text || "").replace(new RegExp(RE_SUPERSEDES_SRC, "gi"), "").replace(new RegExp(RE_SUPERSEDES_OPEN_SRC, "gi"), "");
}
// A criterion block's lines joined by "\n" (criterionBlocks joins them with spaces, which would erase the line starts
// the wrap rule above reads). `byLine` = line number → its cleaned text; every cleaned line in the range is a part.
function blockLines(byLine, b) {
  const out = [];
  for (let l = b.line; l <= b.endLine; l++) if (byLine.has(l)) out.push({ line: l, text: byLine.get(l) });
  return out;
}
function lineMap(cleaned) {
  return new Map(cleaned.map((c) => [c.line, c.text]));
}
// The AC a criterion block defines (its leading ID, else the first own ID it names), or null.
function criterionAc(text) {
  const m = String(text || "").match(RE_DEFINES_AC);
  return m ? m[1] : [...extractAcIds(stripSupersedes(text))][0] || null;
}
// → [{ ref, feature, ac, by, line[, unterminated] }] — `by` = the AC of the criterion carrying the marker (null outside
// one); `line` = where the marker starts. Read per criterion, so a marker wrapped onto its next line is ONE marker.
// A table row is a block break for criterionBlocks, yet acIndex reads table-row ACs: there the row itself is it (and
// any other line outside a criterion is its own unit).
function supersedesMarkers(reqText) {
  const { cleaned, blocks } = criterionBlocks(reqText || "");
  const byLine = lineMap(cleaned);
  const inBlock = new Set();
  const units = blocks.map((b) => {
    const ls = blockLines(byLine, b);
    ls.forEach((l) => inBlock.add(l.line));
    return { ls, block: true };
  });
  for (const c of cleaned) if (!inBlock.has(c.line)) units.push({ ls: [c], block: false });
  const out = [];
  const fold = (s) => s.replace(/\s+/g, " ").trim();
  for (const u of units) {
    const text = u.ls.map((l) => l.text).join("\n");
    if (!/_Supersedes:/i.test(text)) continue;
    const by = u.block ? criterionAc(text) : text.startsWith("|") ? criterionAc(text) : null;
    const lineAt = (i) => u.ls[(text.slice(0, i).match(/\n/g) || []).length].line;
    const re = new RegExp(RE_SUPERSEDES_SRC, "gi");
    let m;
    while ((m = re.exec(text)) !== null) {
      for (const ref of m[1].split(/[,;]/).map((s) => stripEnds(fold(s), isBacktickUnit).trim()).filter(Boolean)) {
        const mm = ref.match(/^(.+?)\s*\/\s*(US-\d+\.AC-\d+)$/);
        out.push({ ref, feature: mm ? mm[1].trim() : null, ac: mm ? mm[2] : null, by, line: lineAt(m.index) });
      }
    }
    // Whatever opens and never closes, once the closed markers are blanked out (same length, so positions hold).
    const rest = text.replace(new RegExp(RE_SUPERSEDES_SRC, "gi"), (s) => s.replace(/[^\n]/g, " "));
    const reOpen = new RegExp(RE_SUPERSEDES_OPEN_SRC, "gi");
    while ((m = reOpen.exec(rest)) !== null) {
      out.push({ ref: fold(m[1]), feature: null, ac: null, by, line: lineAt(m.index), unterminated: true });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}
// Folder identity for keys and comparisons: on a case-insensitive file system `.specs/Billing` IS `.specs/billing`.
const dirKey = (d) => (FOLD_CASE ? path.resolve(d).toLowerCase() : path.resolve(d));
// Markers → { valid: [{…, feature (slug), ac, archived, dir}], phantom: [{…, reason}] }. Reasons (English-stable):
// bad-ref (not <feature>/US-n.AC-m) · unterminated (no closing `_`) · unknown-feature (no active or archived folder) ·
// unknown-ac · self. `cache` (dir → acIndex) is shared across features by the catalog.
function resolveSupersedes(projectDir, fromDir, markers, cache) {
  const acsOf = (t) => {
    if (!cache.has(t.dir)) cache.set(t.dir, acIndex(readIfExists(path.join(t.dir, "requirements.md")) || ""));
    return cache.get(t.dir);
  };
  const valid = [];
  const phantom = [];
  for (const mk of markers) {
    const base = { ref: mk.ref, by: mk.by, line: mk.line };
    if (mk.unterminated) { phantom.push({ ...base, reason: "unterminated" }); continue; }
    if (!mk.feature || !mk.ac) { phantom.push({ ...base, reason: "bad-ref" }); continue; }
    const targets = locateFeatures(projectDir, mk.feature);
    if (!targets.length) { phantom.push({ ...base, feature: slugify(mk.feature), ac: mk.ac, reason: "unknown-feature" }); continue; }
    const others = targets.filter((t) => dirKey(t.dir) !== dirKey(fromDir));
    if (!others.length) { phantom.push({ ...base, feature: targets[0].slug, ac: mk.ac, reason: "self" }); continue; }
    const hit = others.find((t) => acsOf(t).has(mk.ac));
    if (!hit) { phantom.push({ ...base, feature: others[0].slug, ac: mk.ac, reason: "unknown-ac" }); continue; }
    valid.push({ ...base, feature: hit.slug, ac: mk.ac, archived: hit.archived, dir: hit.dir });
  }
  return { valid, phantom };
}
// trace_check's part: the declared replacements and the ones that resolve to nothing — warnings, never an AC gap.
function supersedesTrace(projectDir, dir, reqsRaw) {
  const r = resolveSupersedes(projectDir, dir, supersedesMarkers(reqsRaw), new Map());
  return { supersedes: r.valid.map(({ dir: _d, ...v }) => v), phantomSupersedes: r.phantom };
}
TRACE_INFO_FIELDS.add("supersedes").add("phantomSupersedes"); // informational, so traceGaps never lists them as gaps
// Localized "⚠" lines for a trace_check result's phantom _Supersedes:_ references (CLI).
function supersedesWarnings(tr, lang) {
  const W = i18n.msg(lang).supersedes;
  return (tr && Array.isArray(tr.phantomSupersedes) ? tr.phantomSupersedes : []).map((p) => W.phantom(p.ref, W.reason[p.reason] || p.reason, p.by));
}

// --- catalog ---

const day = (iso) => String(iso || "").slice(0, 10);
// One line of an AC for the catalog: whitespace folded, its own leading ID and the _Supersedes:_ marker dropped.
function acOneLine(text, id, max = 200) { // max: the length cap (spec_export shows the whole criterion: Infinity)
  // A sub-list bullet that only carried the marker ("… owner - _Supersedes: x/US-1.AC-3_") goes with it, and so do the
  // emphasis around it ("**_Supersedes: …_**"), the parentheses around it and the space before the punctuation after
  // it ("… days (_Supersedes: …_)." → "… days.").
  let s = String(text || "").replace(new RegExp("(?:(?:^|\\s)[-*+]\\s+)?(?:" + RE_SUPERSEDES_SRC + "|" + RE_SUPERSEDES_OPEN_SRC + ")", "gi"), "\u0000")
    .replace(/(\*\*|__|\*|~~)\s*\u0000\s*\1/g, "\u0000")
    .replace(/(?<!\s)\s*\(\s*\u0000\s*\)/g, "").replace(/(?<!\s)\s*\u0000\s*(?=[.,;:!?]|$)/g, "").replace(/\u0000/g, " ").replace(/\s+/g, " ").trim(); // (?<!\s): a blank run read from its start only (1.17 H)
  if (s.startsWith("|")) s = s.split("|").map((c) => c.trim()).filter((c) => c && c.replace(/[*_`]/g, "") !== id).join(" — ");
  const esc = id.replace(/\./g, "\\.");
  s = s.replace(new RegExp("^(?:\\*\\*|__|\\*|_)?" + esc + "(?:\\*\\*|__|\\*|_)?\\s*(?:[—–:-]\\s*)?"), "").replace(new RegExp("\\s*\\(" + esc + "\\)"), "");
  if (s.length > max) s = s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  return s || id;
}
function catalogData(projectDir) {
  const lang = projectLang(projectDir);
  const cache = new Map();
  const srcs = featureDirs(projectDir).map((s) => {
    const tracks = detectTracks(s.dir);
    const reqRaw = readContained(projectDir, path.join(s.dir, "requirements.md")) || "";
    return { ...s, tracks, phase: detectPhase(s.dir, tracks), reqRaw, state: stateFromFile(projectDir, statePath(s.dir)) };
  });
  // Superseded ACs, keyed by the target folder (dirKey: case-folded where the file system is) + ID → the
  // "<feature>/<AC>" that replaces them. 1.15: only a SHIPPED declaring feature (featureShipped) retires the AC; one still in
  // flight marks it "to be superseded" (supersedePending) — the catalog says what the system does today; one archived
  // without ever shipping (abandoned) declares nothing.
  const supBy = new Map(); // key → every declarer (drafts included)
  const supLiveBy = new Map(); // key → the SHIPPED declarers — a declaration added after the ship waits (shippedSupersedeKeys)
  const push = (m, k, who) => { if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(who)) m.get(k).push(who); };
  for (const s of srcs) {
    s.sup = resolveSupersedes(projectDir, s.dir, supersedesMarkers(s.reqRaw), cache).valid;
    s.shipped = featureShipped(s.state);
    if (s.archived && !s.shipped) continue;
    const shippedKeys = s.shipped ? shippedSupersedeKeys(projectDir, s.dir, s.state, s.reqRaw, cache) : null;
    for (const v of s.sup) {
      const k = dirKey(v.dir) + "\n" + v.ac;
      const who = s.slug + (v.by ? "/" + v.by : "");
      push(supBy, k, who);
      if (s.shipped && (!shippedKeys || shippedKeys.has(k))) push(supLiveBy, k, who);
    }
  }
  const features = srcs.map((s) => {
    // A removed track's [SaaS]/[AI] criteria are inactive — not what the system does.
    const acs = [...acIndex(activeDesign(s.reqRaw, s.tracks)).values()].sort((a, b) => a.line - b.line).map((e) => {
      const o = { id: e.id, text: acOneLine(e.text, e.id) };
      if (placeholderReport(e.text).length) o.template = true;
      const key = dirKey(s.dir) + "\n" + e.id;
      if (supLiveBy.has(key)) o.supersededBy = supLiveBy.get(key); // retired: named by the shipped declarers only
      else if (supBy.has(key)) { o.supersededBy = supBy.get(key); o.supersedePending = true; } // a draft's plan
      const mine = s.sup.filter((v) => v.by === e.id).map((v) => v.feature + "/" + v.ac);
      if (mine.length) o.supersedes = mine;
      return o;
    });
    let fin = isObj(s.state.finished) && typeof s.state.finished.at === "string" ? s.state.finished.at : null;
    const arch = isObj(s.state.archived) && typeof s.state.archived.at === "string" ? s.state.archived.at : null;
    // Finished = complete with a CURRENT finish baseline, its artifacts as approved and every tick verified — what
    // next_action and spec_finish call finished, so SPECS.md never says ✅ while they say "finish it again" / "re-review".
    // It reads as complete until it is finished (verified, re-approved) again when: an artifact changed after its own
    // approval (changedSinceApproval, by CONTENT — a pre-1.11 approval judged by file date is no evidence, as in finish; an
    // unapproved criterion edit is not "what the system does today"), a ticked task's latest run failed / its _Verify:_
    // never ran (verificationStatus), or it changed since the finish (staleFinish: a change request or re-approval, then —
    // the cheap checks first, only for a feature still finished — an _Implements:_ file the baseline never recorded, the
    // bounded walk next_action and drift do). 1.16 U review 3: nor while a gate is pending (pendingGateList — a revoked approval,
    // a phase that became due after the finish: next_action asks for the approval, spec_finish refuses) — existence checks only.
    if (fin && !s.archived && s.phase === "complete") {
      const appr = isObj(s.state.approvals) ? s.state.approvals : {};
      const cs = changedSinceApproval(s.dir, appr, s.tracks, s.state.kind, { detail: true });
      if (pendingGateList(s.dir, s.tracks, s.state.kind || "feature", appr).length ||
        cs.changed.some((x) => !cs.byDate.includes(x)) || verificationStatus(projectDir, s.slug, s.dir).unverified.length ||
        staleFinish(projectDir, s.state, "", { newFiles: false }) ||
        staleFinish(projectDir, s.state, activeTasks(readIfExists(path.join(s.dir, "tasks.md")) || "", s.tracks))) fin = null;
    }
    const status = s.archived ? "archived" : s.phase === "complete" ? (fin ? "finished" : "complete") : "active";
    const kind = s.state.kind === "bugfix" || s.state.kind === "spike" ? s.state.kind : "feature";
    const f = { feature: s.slug, kind, status, phase: s.phase, tracks: trackLabel(s.tracks), archived: s.archived, acs };
    if (fin) f.finishedAt = fin;
    if (arch && s.archived) f.archivedAt = arch;
    f.decisions = catalogDecisions(s.dir); // 1.14 C2: decisions.md — { count, items: [{ id, title, kind, supersededBy? }] }
    if (kind === "spike") { const si = spikeInfo(s.dir); f.spike = { question: si.question, outcome: si.outcome }; } // 1.14 C2
    return f;
  });
  const all = features.flatMap((f) => f.acs);
  const retired = (a) => a.supersededBy && !a.supersedePending;
  const superseded = all.filter(retired).length;
  // Current = what the system does today: neither retired by a shipped feature nor a criterion of an abandoned feature
  // (archived without ever shipping). A shipped feature archived to declutter still does what its criteria say. `pending`
  // (to be superseded) is a subset of current — the totals line reads "N current (P to be superseded), S superseded".
  const abandoned = new Set(srcs.filter((s) => s.archived && !s.shipped).map((s) => s.slug));
  const currentAcs = features.filter((f) => !abandoned.has(f.feature)).flatMap((f) => f.acs).filter((a) => !retired(a));
  const pending = currentAcs.filter((a) => a.supersedePending).length;
  const totals = { features: features.length, acs: all.length, current: currentAcs.length, superseded, pending };
  const data = { lang, features, totals };
  const xac = crossFeatureAcs(projectDir); // 1.16 Q2: near-duplicate / conflicting criteria across the active features
  data.crossAcs = { pairs: xac.pairs, truncated: xac.truncated };
  data.markdown = renderCatalogMd(data, lang, path.basename(path.resolve(projectDir)));
  return data;
}
function renderCatalogMd(data, lang, proj) {
  const C = i18n.msg(lang).catalog;
  const P = i18n.msg(lang).phaseNames || {};
  const icon = { finished: "✅", complete: "☑", active: "🟡", archived: "🗄" };
  const code = (s) => "`" + s + "`";
  const t = data.totals;
  let md = `# ${C.title(proj)}\n\n<!-- ${C.autogen} -->\n\n> ${C.intro}\n\n${C.totals(t.features, t.acs, t.current, t.superseded, t.pending)}\n`;
  if (!data.features.length) md += `\n_${C.noFeatures}_\n`;
  for (const f of data.features) {
    const SP = i18n.msg(lang).spike; // 1.14 C2: a spike reads apart (its question + decision instead of ACs)
    md += `\n## ${icon[f.status]} ${f.feature} — ${C.status[f.status]}${f.status === "active" ? ` (${P[f.phase] || f.phase})` : ""}${f.kind === "spike" ? " · 🔬 " + SP.kind : ""}\n\n`;
    const meta = [f.tracks, f.finishedAt ? C.finishedOn(day(f.finishedAt)) : null, f.archivedAt ? C.archivedOn(day(f.archivedAt)) : null].filter(Boolean);
    md += `_${meta.join(" · ")}_\n\n`;
    const pre = [];
    if (f.spike) pre.push(`- ${SP.catalogQuestion(f.spike.question || "—")}`, `- ${f.spike.outcome ? SP.catalogOutcome(f.spike.outcome) : SP.catalogPending}`);
    if (f.decisions && f.decisions.count) {
      const D = i18n.msg(lang).decisions;
      pre.push(`- 📝 ${D.catalogLine(f.decisions.count, f.decisions.items.map((d) => (d.supersededBy ? `~~${d.id} ${d.title}~~` : `${d.id} ${d.title}`)).join(" · "))}`);
    }
    if (pre.length) md += pre.join("\n") + "\n" + (f.acs.length || !f.spike ? "\n" : "");
    if (!f.acs.length && !f.spike) md += `_${C.noAcs}_\n`;
    for (const a of f.acs) {
      const body = `**${a.id}** — ${a.text}`;
      let line = a.supersedePending ? `- ${body} — ${C.toBeSupersededBy(a.supersededBy.map(code).join(", "))}` // a draft's plan
        : a.supersededBy ? `- ~~${body}~~ — ${C.supersededBy(a.supersededBy.map(code).join(", "))}` : `- ${body}`;
      if (a.supersedes) line += ` _(${C.supersedes(a.supersedes.map(code).join(", "))})_`;
      if (a.template) line += ` _(${C.template})_`;
      md += line + "\n";
    }
  }
  return md + renderCrossAcsMd(data.crossAcs, lang); // 1.16 Q2 (only when there is a pair)
}
// spec_catalog {write} / `dev-spec catalog [--write]`: the structure (+ markdown unless writing). Writing never
// replaces a same-named file dev-spec didn't generate (the roadmap's guard) — the result is then an error.
function catalog(projectDir, opts = {}) {
  const root = specsRoot(projectDir);
  const file = path.join(root, "SPECS.md");
  const data = catalogData(projectDir);
  const res = { ok: true, file, lang: data.lang, totals: data.totals, features: data.features, crossAcs: data.crossAcs, wrote: false };
  if (opts.write) {
    const E = i18n.msg(data.lang).err;
    if (!fs.existsSync(root)) return { ...res, ok: false, error: E.noSpecs(root) };
    if (!isGeneratedOrAbsent(file)) return { ...res, ok: false, skipped: true, error: E.notGenerated("SPECS.md") };
    writeFileAtomic(file, data.markdown);
    res.wrote = true;
  } else res.markdown = data.markdown;
  return res;
}
// Keep SPECS.md current after a mutation — only once it exists and carries the marker. Best-effort.
// → true when it rewrote the file (unchanged content is not rewritten: the hook runs this on every spec save).
function maybeRefreshCatalog(projectDir) {
  try {
    const file = path.join(specsRoot(projectDir), "SPECS.md");
    const cur = readIfExists(file);
    if (cur == null || !isGeneratedOrAbsent(file)) return false;
    const md = catalogData(projectDir).markdown;
    if (md === cur) return false;
    writeFileAtomic(file, md);
    return true;
  } catch {
    return false; // best-effort
  }
}

module.exports = { SUP_NL, RE_SUPERSEDES_SRC, RE_SUPERSEDES_OPEN_SRC, stripSupersedes, blockLines, lineMap, criterionAc,
  supersedesMarkers, dirKey, resolveSupersedes, supersedesTrace, supersedesWarnings, day, acOneLine, catalogData,
  renderCatalogMd, catalog, maybeRefreshCatalog, __link };
