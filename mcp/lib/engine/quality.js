"use strict";

/**
 * dev-spec-driven engine — spec quality: cross-feature criteria, glossary, design weigh, clarify.
 * 1.16 Q2 cross-feature acceptance criteria, Q3 the glossary, 1.17 A1 the design's trade-offs and risks, A2 the
 * constraint nudge, and spec_clarify.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { CTX } = require("./ctx.js"); // the shared per-call state (mutated in place)
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let acIndex, acOneLine, activeDesign, artifactReport, atxHeading, bracketPlaceholders, clarificationMarkers,
  criterionBlocks, detectTracks, dirKey, earsValidate, errs, existingFeature, featureDirs, featureLang, ghostMarkers,
  headingIndex, headingLeadRe, inactiveMarkerLines, isGenericSlot, isObj, isRecord, markerTracks, normalizeLang,
  OPTIONAL_TRACKS, packDesignBlock, packOf, packRegistry, packRequirementsBlock, packTracks, placeholderReport,
  projectLang, RE_EDGE_CASES, RE_INDEPENDENT_TEST, RE_LIST_ITEM, RE_NFR, RE_OUT_OF_SCOPE, RE_SUCCESS_CRITERIA,
  RE_TODO_SENTINEL, readCacheKey, readContained, readIfExists, readJson, readTemplateFile, replaceHtmlCommentSpans,
  savedTracks, scanTaskLines, specsRoot, stateFromFile, statePath, steeringFrontMatter, stripEnd, stripEnds,
  stripFencedCode, stripHtmlComments, stripStart, stripSupersedes, supersededByIndex, templateFileList,
  templateOverride, trackLabel, trackMarker, unitIn, VALID_TRACKS;
function __link(E) { ({ acIndex, acOneLine, activeDesign, artifactReport, atxHeading, bracketPlaceholders,
  clarificationMarkers, criterionBlocks, detectTracks, dirKey, earsValidate, errs, existingFeature, featureDirs,
  featureLang, ghostMarkers, headingIndex, headingLeadRe, inactiveMarkerLines, isGenericSlot, isObj, isRecord,
  markerTracks, normalizeLang, OPTIONAL_TRACKS, packDesignBlock, packOf, packRegistry, packRequirementsBlock,
  packTracks, placeholderReport, projectLang, RE_EDGE_CASES, RE_INDEPENDENT_TEST, RE_LIST_ITEM, RE_NFR, RE_OUT_OF_SCOPE,
  RE_SUCCESS_CRITERIA, RE_TODO_SENTINEL, readCacheKey, readContained, readIfExists, readJson, readTemplateFile,
  replaceHtmlCommentSpans, savedTracks, scanTaskLines, specsRoot, stateFromFile, statePath, steeringFrontMatter,
  stripEnd, stripEnds, stripFencedCode, stripHtmlComments, stripStart, stripSupersedes, supersededByIndex,
  templateFileList, templateOverride, trackLabel, trackMarker, unitIn, VALID_TRACKS } = E); }

// ---------------------------------------------------------------------------
// 1.16 Q — spec quality: steering amendments (Q1) · cross-feature acceptance criteria (Q2) · the glossary (Q3)
// ---------------------------------------------------------------------------

// --- Q2: cross-feature acceptance criteria — near-duplicates and likely conflicts ---
// A deterministic heuristic over the ACTIVE plain features' criteria (bugfixes restate the behaviour they restore; spikes have
// none; archived features are out). Each criterion is normalized (acShape): _Supersedes:_ markers and IDs dropped, accents
// folded, lower-cased, EN/PT/ES stop words and EARS keywords out, a light plural fold → its content words, split at the modal
// into the TRIGGER (the words before "THE SYSTEM SHALL" / "O SISTEMA DEVE" / "EL SISTEMA DEBE", else before the first modal)
// and the RESPONSE (the modal on — a NÃO / NO / NUNCA right before it included); each clause keeps its words in document order.
// The polarity is the RESPONSE's (SHALL NOT / NÃO DEVE / NO DEBE / never / cannot …, RE_XAC_NEG on the response only): a
// negative in the trigger ("IF the service cannot be reached", "can't log in", "no puede ser contactado") never flips it. A
// negative in the trigger (not / no — EN / ES — / never / cannot / n't / non- / without, não / nunca / jamais / sem / nenhum,
// nunca / jamás / sin / ningún) marks the next content word ("!verified"): a word negated in one trigger only makes the two
// conditions complementary ("is not verified" / "is verified", "non-admin" / "admin") — such a pair is never reported. The
// numbers apart, each with the word after it (1,000 = 1000; 0,5 = 0.5; "5 attempts" ≠ "5 minutes"; "10%" ≠ "10 EUR").
// A clause's similarity is ORDER-aware: the shared words that keep their relative order (the longest common subsequence) over
// the union — equal to Jaccard when nothing moved, lower when roles or directions swap ("buyer rates seller" / "seller rates
// buyer", "savings to checking" / "checking to savings"). A pair of criteria of two different features (candidates: the whole
// words ≥ XAC_CONFLICT alike, Jaccard) is
//   duplicate (near-duplicate)       — the triggers AND the responses each MORE than XAC_DUPLICATE alike (or both without a
//                                      trigger), same polarity, the same numbers with the same units;
//   conflict  (opposite-modal)       — the triggers ≥ XAC_TRIGGER alike (or both without one), the responses ≥ XAC_RESPONSE,
//                                      one SHALL, the other SHALL NOT;
//   conflict  (different-numbers)    — the same, same polarity, both with numbers and not the same ones.
// Left out: template criteria (a slot left, or the words of a built-in / track-pack / project template criterion whatever its
// numbers — two +sec features share their scaffolded [SEC] criteria, two +ai ones their "at least N% of the golden set"), a pair
// of light edits of the SAME template criterion (both ≥ XAC_DUPLICATE alike to it), criteria with fewer than XAC_MIN_WORDS
// words, criteria retired by a shipped feature's _Supersedes:_, and a pair where one declares _Supersedes:_ of the other
// (shipped or pending). Bounded: candidates
// come from an inverted index over each criterion's rarest words (the all-pairs prefix filter — exact for the similarity
// threshold, never O(n²) over a big catalog), capped at XAC_MAX_CRITERIA criteria, XAC_MAX_COMPARISONS comparisons and
// XAC_MAX_PAIRS pairs (`truncated`). Surfaces: doctor warn cross-feature-acs, spec_catalog `crossAcs` + a SPECS.md section.
const XAC_DUPLICATE = 0.8; // strictly more, per clause: one word of five differing (4/5 = 0.8) is no duplicate
const XAC_CONFLICT = 0.7;
const XAC_TRIGGER = 0.5;
const XAC_RESPONSE = 0.5; // a conflict's responses: the same action, the polarity or the numbers opposed
const XAC_MIN_WORDS = 3;
const XAC_MAX_CRITERIA = 4000;
const XAC_MAX_COMPARISONS = 200000;
const XAC_MAX_PAIRS = 200;
const XAC_STOP = new Set((
  // EN
  "a an the and or nor of to in on at for from by with as is are was were be been being it its this that these those which who whom whose " +
  "when while if then where whenever shall must should will would may might can could not never no any all each every some such than into onto " +
  "over under within without between after before during per via about up down out system systems also only both either neither so do does " +
  "has have had there their them they " +
  // PT (accents folded)
  "o os um uma uns umas de do da dos das em na nos nas num numa por para com sem e ou que se entao quando enquanto onde sistema deve devera " +
  "devem deverao nao nunca ao aos pelo pela pelos pelas seu sua seus suas este esta estes estas esse essa esses essas isso isto qualquer cada " +
  "todo toda todos todas caso sempre ja pode podera puder possa ser sao foi " +
  // ES (accents folded)
  "el la los las un unos unas del al con sin y si entonces cuando mientras donde debe debera deben deberan su sus estos ese esos eso esto " +
  "cualquier lo le les sea es son fue siempre ya puede podra pueda"
).split(/\s+/).filter(Boolean));
const XAC_MODALS = "shall|must|deve|devera|devem|deverao|debe|debera|deben|deberan";
// The response's start: "the system shall" / "o sistema (não) deve" / "el sistema (no) debe" (group 1 = the negator + modal),
// else the first modal with the negator right before it.
const RE_XAC_SYS_MODAL = new RegExp("(?<![\\p{L}\\p{N}])(?:system|sistema)\\s+((?:(?:nao|no|nunca|jamais|jamas)\\s+)?(?:" + XAC_MODALS + ")(?![\\p{L}\\p{N}]))", "u");
const RE_XAC_MODAL = new RegExp("(?<![\\p{L}\\p{N}])(?:(?:nao|no|nunca|jamais|jamas)\\s+)?(?:" + XAC_MODALS + ")(?![\\p{L}\\p{N}])", "u");
// A trigger's negators (accents folded): the next content word is read negated. "no" only in EN / ES (PT "no" is em + o).
const XAC_TRIGGER_NEG = new Set("not never nor without nao nunca jamais jamas sem nenhum nenhuma sin ningun ninguna ninguno".split(" "));
// "can't" / "doesn't" / "isn't", "cannot", "non-admin" → " not " (trigger only: the response's own polarity reads them raw).
const RE_XAC_NT = /(?<![\p{L}\p{N}])(?:can|won|don|doesn|didn|isn|aren|wasn|weren|hasn|haven|hadn|couldn|shouldn|wouldn|mustn|shan|needn|mightn|ain)['’]t(?![\p{L}\p{N}])/gu;
const RE_XAC_CANNOT = /(?<![\p{L}\p{N}])(?:cannot|non-(?=\p{L}))/gu;
const RE_XAC_NEG = new RegExp([
  "(?:shall|must|should|will|may|can)\\s+(?:not|never)",
  "(?:shan't|mustn't|won't|cannot|can't)",
  "(?:nao|nunca|jamais)\\s+(?:deve|devera|devem|deverao|pode|podera)",
  "(?:deve|devera|devem|deverao|debe|debera|deben|deberan)\\s+(?:nunca|jamais|jamas)",
  "(?:no|nunca|jamas)\\s+(?:debe|debera|deben|deberan|puede|podra)",
].map((s) => "(?<![\\p{L}\\p{N}])" + s + "(?![\\p{L}\\p{N}])").join("|"), "u");
const RE_XAC_IDS = /(?<![A-Za-z0-9])(?:US-\d+\.AC-\d+|SC-\d+|EC-\d+|NFR-\d+|FR-\d+|T-\d+)(?!\d)/g;
// "1,000" / "1.000" (thousands) → 1000; "0,5" → 0.5; "15" → 15.
function xacNumber(s) {
  const parts = s.split(/[.,]/);
  if (parts.length > 1 && parts.slice(1).every((p) => p.length === 3)) return String(Number(parts.join("")));
  if (parts.length === 1) return String(Number(s));
  return String(Number(parts.slice(0, -1).join("") + "." + parts[parts.length - 1]));
}
// A light plural fold: EN drops a final "s" (not "ss" / "us" / "is"); PT / ES also "-es" after r, l, n, z, d ("valores" →
// "valor", "notificaciones" → "notificacion").
function xacStem(w, base) {
  if (w.length <= 3) return w;
  if (base !== "en" && w.length > 5 && /[rlnzd]es$/.test(w)) return w.slice(0, -2);
  return /(?:ss|us|is)$/.test(w) || !w.endsWith("s") ? w : w.slice(0, -1);
}
// A clause's content words in document order, each once (its first occurrence). neg: a trigger — its negators mark the next
// content word ("!verified"); "no" counts only outside Portuguese (em + o).
function xacWords(text, base, neg) {
  const out = [], seen = new Set();
  let pending = false;
  for (const t of text.match(/\p{L}+/gu) || []) {
    if (neg && (XAC_TRIGGER_NEG.has(t) || (t === "no" && base !== "pt"))) { pending = true; continue; }
    if (t.length < 2 || XAC_STOP.has(t)) continue;
    const w = (pending ? "!" : "") + xacStem(t, base);
    pending = false;
    if (!seen.has(w)) { seen.add(w); out.push(w); }
  }
  return out;
}
// The numbers, each with the word right after it ("5 attempt", "15 minute", "10 %"; a stop word is no unit) → [key], in order.
const RE_XAC_NUM = /(\p{N}+(?:[.,]\p{N}+)*)(?:\s*(%|\p{L}+))?/gu;
function xacNumbers(low, base) {
  const out = [];
  for (const m of low.matchAll(RE_XAC_NUM)) {
    const u = m[2] && (m[2] === "%" || (m[2].length > 1 && !XAC_STOP.has(m[2]))) ? (m[2] === "%" ? "%" : xacStem(m[2], base)) : "";
    out.push({ n: xacNumber(m[1]), u });
  }
  return out;
}
// One criterion → { words: Set, list: [sorted words], trig: [words in order], resp: [words in order], trigNeg: bool,
// nums: [numbers in document order], numKey: "n unit|…" (sorted), neg: the response's polarity }.
function acShape(text, lang) {
  const base = i18n.baseLang(normalizeLang(lang));
  const low = stripSupersedes(String(text || "")).replace(RE_XAC_IDS, " ").replace(/\[(?:SaaS|AI|SEC|PRIVACY|DIST|API|UI)\]/g, " ")
    .normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
  const sys = low.match(RE_XAC_SYS_MODAL);
  const m = sys ? null : low.match(RE_XAC_MODAL);
  const at = sys ? sys.index + sys[0].length - sys[1].length : m ? m.index : 0;
  const resp = low.slice(at);
  const trig = xacWords(low.slice(0, at).replace(RE_XAC_NT, " not ").replace(RE_XAC_CANNOT, " not "), base, true);
  const respWords = xacWords(resp, base, false);
  const words = new Set([...trig, ...respWords]);
  const nums = xacNumbers(low, base);
  return { words, list: [...words].sort(), trig, resp: respWords, nums: nums.map((x) => x.n),
    numKey: nums.map((x) => x.n + (x.u ? " " + x.u : "")).sort().join("|"), neg: RE_XAC_NEG.test(resp) };
}
// Two clauses' ORDER-aware similarity: the shared words kept in the same relative order (the longest common subsequence — of
// two orderings of one set, the longest increasing run of positions: O(k log k)) over the union. Both empty → 1, one → 0.
function xacClauseSim(a, b) {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const inB = new Map(b.map((w, i) => [w, i]));
  const tails = [];
  let shared = 0;
  for (const w of a) {
    const x = inB.get(w);
    if (x === undefined) continue;
    shared++;
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < x) lo = mid + 1; else hi = mid; }
    tails[lo] = x;
  }
  return tails.length / (a.length + b.length - shared);
}
// Complementary conditions: a word one trigger negates and the other does not ("!verified" / "verified").
function xacOpposed(a, b) {
  const has = (s, w) => s.includes(w);
  return a.some((w) => (w[0] === "!" ? has(b, w.slice(1)) : has(b, "!" + w)));
}
// A criterion's skeleton: its words and polarity, the numbers aside — a template criterion with its [85] / $[0.03] slots filled
// in ("at least 90% of the golden eval set") is still that template's boilerplate, in every feature that has the track.
const acSkeleton = (s) => s.list.join(" ") + "|" + (s.neg ? 1 : 0);
// A template-criteria table → { skel: Set, shapes: [shape] } (shapes: one per skeleton).
function templateShapeTable(texts) {
  const skel = new Set(), shapes = [];
  for (const [text, l] of texts) {
    for (const e of acIndex(text || "").values()) {
      if (e.text.includes("{{")) continue; // a {{variable}} differs per feature
      const s = acShape(e.text, l);
      const k = acSkeleton(s);
      if (!s.list.length || skel.has(k)) continue;
      skel.add(k);
      shapes.push(s);
    }
  }
  return { skel, shapes };
}
// Every built-in template criterion (EN / PT / pt-BR / ES, every built-in track, the bugfix requirements) — process-wide.
let XAC_TEMPLATES = null;
function builtinTemplateAcs() {
  if (XAC_TEMPLATES) return XAC_TEMPLATES;
  const texts = [];
  for (const l of i18n.LANGS) {
    for (const fn of [() => i18n.requirements({ name: "x", tracks: VALID_TRACKS.slice(), summary: "" }, l), () => i18n.bugRequirements({ name: "x" }, l)]) {
      try { texts.push([fn(), l]); } catch { /* a builder's trouble never breaks the check */ }
    }
  }
  return (XAC_TEMPLATES = templateShapeTable(texts));
}
// …and the project's own (this call's): its track packs' criteria and its requirements templates (.specs/templates/).
function projectTemplateAcs(projectDir) {
  const texts = [];
  for (const tr of packTracks()) {
    const pack = packOf(tr);
    if (pack) for (const l of i18n.LANGS) { try { texts.push([packRequirementsBlock(pack, l, "", {}), l]); } catch { /* ignore */ } }
  }
  for (const key of ["requirements", "bug-requirements"]) for (const l of i18n.LANGS) {
    try { const o = templateOverride(projectDir, key, l); if (o) texts.push([o.text, l]); } catch { /* ignore */ }
  }
  return templateShapeTable(texts);
}
const jaccard = (a, b) => {
  if (!a.size && !b.size) return 1;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / (a.size + b.size - n);
};
// The criteria crossFeatureAcs compares, with the prefix-filter index over them → { crit, index, truncated }. Built once per
// engine call (the read-cache scope: doctor runs once per feature in spec_upgrade — rebuilding it every time cost seconds on
// 50 features); any engine write in the call drops it (forgetCached / invalidateReadCache). ACROSS calls (every doctor /
// next_action runs it): each feature's kind / language / tracks are cached by its .state.json file signature (lstat: size,
// times, inode) and the project's context (track packs, templates, project language), its compared criteria by its
// requirements.md signature too — XAC_FEATURE_CACHE, the PACK_CACHE pattern, bounded — and the whole table (index included,
// and the pairs computed from it: table.results) is reused while no signature changed and no feature declares _Supersedes:_
// (XAC_TABLE_CACHE). A feature whose tracks are inferred from its files (no saved list, pre-1.13) or that recorded track-pack
// markers (ghost markers are per call) is never cached; the other features' rows and the table are keyed by the call's
// ghost-marker set too (1.16 verify NEW-2). Cached rows were built after readContained's containment check; the
// signature carries the inode.
const XAC_FEATURE_CACHE = new Map(); // readCacheKey(feature dir) → { stateSig, ctx, kind, lang, tracks, reqSig, ghosts, rows, hasSup } | { archived, reqSig, hasSup }
const XAC_FEATURE_CACHE_MAX = 5000;
let XAC_TABLE_CACHE = null; // { key, table }
// A file modified in the last XAC_RACY_MS is "racily clean" (git's rule): a same-size rewrite within the file system's time
// resolution would keep its signature — such a file gets a signature that never matches (recomputed until it settles).
const XAC_RACY_MS = 2000;
let xacRacy = 0;
const xacStatSig = (file) => {
  try {
    const st = fs.lstatSync(file);
    if (Math.abs(Date.now() - st.mtimeMs) < XAC_RACY_MS) return "racy:" + ++xacRacy;
    return [st.isSymbolicLink() ? "l" : st.isFile() ? "f" : "o", st.dev, st.ino, st.size, st.mtimeMs, st.ctimeMs].join(":");
  } catch { return "-"; }
};
// The project context a feature's rows depend on: its valid track packs (their scan signatures) and its template files.
function xacContextSig(projectDir) {
  const reg = packRegistry();
  return reg.packs.map((p) => p.name + "|" + p.token + "|" + (p.sig || "")).join(",") + "\n" +
    templateFileList(projectDir).map((f) => f.rel + "=" + xacStatSig(f.abs)).join(",");
}
// One feature's compared criteria (template criteria, slots, short ones left out) → { rows: [{ id, key, text, shape, near }],
// hasSup }. tmplOf() gives the template criteria (built on first use).
function xacFeatureRows(projectDir, s, state, tracks, tmplOf) {
  const raw = readContained(projectDir, path.join(s.dir, "requirements.md"));
  if (!raw) return { rows: [], hasSup: false };
  const lng = typeof state.lang === "string" ? state.lang : projectLang(projectDir);
  const rows = [];
  for (const e of acIndex(activeDesign(raw, tracks)).values()) {
    // a slot left: nothing written to compare (a placeholder is a bracket or the TODO sentinel — none, nothing to look up)
    if ((e.text.includes("[") || e.text.includes("TODO")) && placeholderReport(e.text).length) continue;
    const shape = acShape(e.text, lng);
    if (shape.list.length < XAC_MIN_WORDS) continue;
    const tmpl = tmplOf();
    if (tmpl.skel.has(acSkeleton(shape))) continue; // a template criterion (its number slots filled in or not)
    // The template criteria it is a light edit of: two criteria near the SAME one are that template's boilerplate, not a pair.
    const n = shape.words.size;
    const near = [];
    tmpl.shapes.forEach((t, ti) => {
      if (t.neg === shape.neg && t.words.size >= n * XAC_DUPLICATE && t.words.size * XAC_DUPLICATE <= n && jaccard(t.words, shape.words) >= XAC_DUPLICATE) near.push(ti);
    });
    rows.push({ id: e.id, key: dirKey(s.dir) + "\n" + e.id, raw: e.text, shape, near }); // its one line: only when paired (xacText)
  }
  return { rows, hasSup: /_Supersedes:/i.test(raw) };
}
function xacTable(projectDir) {
  const root = dirKey(specsRoot(projectDir));
  if (CTX.READ_CACHE && CTX.XAC_MEMO && CTX.XAC_MEMO.root === root) return CTX.XAC_MEMO.table;
  let tmpl = null; // the template criteria (built-in + this project's), read on the first criterion
  const tmplOf = () => {
    if (!tmpl) { const b = builtinTemplateAcs(), p = projectTemplateAcs(projectDir); tmpl = { skel: new Set([...b.skel, ...p.skel]), shapes: b.shapes.concat(p.shapes) }; }
    return tmpl;
  };
  const ctx = xacContextSig(projectDir) + "\n" + normalizeLang(projectLang(projectDir));
  const putCache = (ck, e) => { if (XAC_FEATURE_CACHE.size >= XAC_FEATURE_CACHE_MAX) XAC_FEATURE_CACHE.clear(); XAC_FEATURE_CACHE.set(ck, e); };
  // Pass 1: the active plain features — kind, language and tracks from the cache while .state.json is unchanged, else read
  // (detectTracks also notes the ghost markers of missing packs; a feature that recorded packMarkers is never cached).
  const feats = [];
  let anySup = false;
  for (const s of featureDirs(projectDir)) {
    const reqFile = path.join(s.dir, "requirements.md"), ck = readCacheKey(s.dir);
    const reqSig = xacStatSig(reqFile), hit = XAC_FEATURE_CACHE.get(ck);
    if (s.archived) { // an archived feature only matters for its _Supersedes:_ (supersededByIndex)
      let hasSup;
      if (hit && hit.archived && hit.reqSig === reqSig) hasSup = hit.hasSup;
      else {
        const raw = readContained(projectDir, reqFile);
        hasSup = !!raw && /_Supersedes:/i.test(raw);
        putCache(ck, { archived: true, reqSig, hasSup });
      }
      anySup = anySup || hasSup;
      continue;
    }
    const stateSig = xacStatSig(statePath(s.dir));
    if (hit && !hit.archived && hit.stateSig === stateSig && hit.ctx === ctx) {
      if (hit.kind !== "feature") continue;
      feats.push({ s, ck, reqSig, stateSig, hit, lang: hit.lang, tracks: hit.tracks, cacheable: true });
      continue;
    }
    const state = stateFromFile(projectDir, statePath(s.dir));
    const kind = state.kind || "feature";
    const cacheable = !!savedTracks(state) && !(isObj(state.packMarkers) && Object.keys(state.packMarkers).length) && !state.invalid;
    const tracks = kind === "feature" ? detectTracks(s.dir) : null;
    const lang = typeof state.lang === "string" ? state.lang : null;
    if (cacheable) putCache(ck, { stateSig, ctx, kind, lang, tracks, reqSig: null, rows: null, hasSup: false });
    if (kind === "feature") feats.push({ s, ck, reqSig, stateSig, hit: cacheable ? XAC_FEATURE_CACHE.get(ck) : null, lang, tracks, cacheable });
  }
  // The ghost markers of this call (missing packs a feature's packMarkers still name — noted by detectTracks in pass 1, per call):
  // they make a heading inactive in EVERY feature's requirements.md, so a feature's cached rows and the cached table hold only
  // for the same set (1.16 verify NEW-2: a removed feature took the last ghost of a deleted pack with it, and a long-lived
  // process kept the rows computed with its [MARKER] sections dropped — a fresh process reported the conflict).
  const ghosts = ghostMarkers().map(([n, m]) => n + "=" + m).sort().join(",");
  // Pass 2: each feature's rows — from the cache while its requirements.md and the ghost markers are unchanged too.
  const perFeature = feats.map((f) => {
    if (f.hit && f.hit.rows && f.hit.reqSig === f.reqSig && f.hit.ghosts === ghosts) { anySup = anySup || f.hit.hasSup; return { f, rows: f.hit.rows }; }
    const r = xacFeatureRows(projectDir, f.s, { lang: f.lang }, f.tracks, tmplOf);
    if (f.hit) Object.assign(f.hit, { reqSig: f.reqSig, ghosts, rows: r.rows, hasSup: r.hasSup });
    anySup = anySup || r.hasSup;
    return { f, rows: r.rows };
  });
  // The whole table from the last call, while nothing changed (no _Supersedes:_ anywhere — its retirements read other states).
  const tableKey = anySup || feats.some((f) => !f.cacheable) ? null : root + "\n" + ctx + "\nghosts:" + ghosts + "\n" + feats.map((f) => f.ck + "|" + f.reqSig + "|" + f.stateSig).join("\n");
  if (tableKey && XAC_TABLE_CACHE && XAC_TABLE_CACHE.key === tableKey) {
    if (CTX.READ_CACHE) CTX.XAC_MEMO = { root, table: XAC_TABLE_CACHE.table };
    return XAC_TABLE_CACHE.table;
  }
  const sup = anySup ? supersededByIndex(projectDir) : null;
  const crit = [];
  let truncated = false;
  outerFeat: for (const { f, rows } of perFeature) {
    for (const r of rows) {
      if (sup && sup.live.has(r.key)) continue; // retired by a shipped feature: not what the system does today
      if (crit.length >= XAC_MAX_CRITERIA) { truncated = true; break outerFeat; }
      crit.push({ feature: f.s.slug, id: r.id, row: r, shape: r.shape, near: r.near, declared: (sup && sup.get(r.key)) || [] });
    }
  }
  // The prefix filter: words ordered rarest first (document frequency, then the word); a criterion is indexed by its first
  // |w| - ⌈t·|w|⌉ + 1 words — two criteria at least t alike always share one of them (exact, never a missed pair).
  const df = new Map();
  for (const c of crit) for (const w of c.shape.list) df.set(w, (df.get(w) || 0) + 1);
  const rank = (a, b) => df.get(a) - df.get(b) || (a < b ? -1 : a > b ? 1 : 0);
  const index = new Map();
  crit.forEach((c, i) => {
    const toks = c.shape.list.slice().sort(rank);
    c.prefix = toks.slice(0, toks.length - Math.ceil(XAC_CONFLICT * toks.length) + 1);
    for (const w of c.prefix) { const post = index.get(w); if (post) post.push(i); else index.set(w, [i]); }
  });
  const table = { crit, index, truncated };
  if (CTX.READ_CACHE) CTX.XAC_MEMO = { root, table };
  XAC_TABLE_CACHE = tableKey ? { key: tableKey, table } : null;
  return table;
}
// spec_catalog's / doctor's pairs. opts.only (a slug): only the pairs involving that feature. → { pairs: [{ kind, reason,
// similarity, a: { feature, id, text }, b, numbers? }] (a = the criterion listed first: feature folder order, then its
// criteria in order), criteria, comparisons, truncated }
function crossFeatureAcs(projectDir, opts = {}) {
  const table = xacTable(projectDir);
  // The pairs depend on the table alone: a table reused across calls (nothing changed) answers from its own memo.
  const mk = opts.only ? "only:" + opts.only : "*";
  if (!table.results) table.results = new Map();
  const memo = table.results.get(mk);
  if (memo) return { ...memo, pairs: memo.pairs.slice() };
  const res = crossFeatureAcsOf(table, opts);
  if (table.results.size >= 256) table.results.clear();
  table.results.set(mk, res);
  return { ...res, pairs: res.pairs.slice() };
}
function crossFeatureAcsOf(table, opts) {
  const { crit, index, truncated: cut } = table;
  let truncated = cut;
  // A declared replacement (either way) is never a duplicate or a conflict: "<slug>/<AC>" (or "<slug>" — a marker outside a criterion).
  const declares = (x, y) => y.declared.includes(x.feature + "/" + x.id) || y.declared.includes(x.feature);
  const pairs = [];
  let comparisons = 0;
  outer: for (let i = 0; i < crit.length; i++) {
    const c = crit[i];
    if (opts.only && c.feature !== opts.only) continue; // only that feature's criteria look up their candidates
    const seen = new Set();
    for (const w of c.prefix) {
      for (const j of index.get(w)) {
        // every unordered pair once: without `only` from its later criterion; with it, from the feature's side
        if (seen.has(j) || (!opts.only && j >= i)) continue;
        seen.add(j);
        const d = crit[j];
        if (d.feature === c.feature) continue;
        if (++comparisons > XAC_MAX_COMPARISONS) { truncated = true; break outer; }
        const p = j < i ? comparePair(d, c, declares) : comparePair(c, d, declares);
        if (!p) continue;
        pairs.push(p);
        if (pairs.length >= XAC_MAX_PAIRS) { truncated = true; break outer; }
      }
    }
  }
  return { pairs, criteria: crit.length, comparisons: Math.min(comparisons, XAC_MAX_COMPARISONS), truncated };
}
function comparePair(a, b, declares) {
  const A = a.shape, B = b.shape;
  const sim = jaccard(A.words, B.words);
  if (sim < XAC_CONFLICT || declares(a, b) || declares(b, a) || a.near.some((t) => b.near.includes(t))) return null;
  // Complementary conditions ("is not verified" / "is verified", "non-admin" / "admin"): each covers the other's case — never
  // a duplicate, never a conflict.
  if (xacOpposed(A.trig, B.trig)) return null;
  const side = (x) => ({ feature: x.feature, id: x.id, text: x.row.text || (x.row.text = acOneLine(x.row.raw, x.id)) });
  const base = { similarity: Math.round(sim * 100) / 100, a: side(a), b: side(b) };
  const trigSim = xacClauseSim(A.trig, B.trig), respSim = xacClauseSim(A.resp, B.resp);
  const alike = trigSim >= XAC_TRIGGER && respSim >= XAC_RESPONSE;
  const numsDiffer = A.nums.length > 0 && B.nums.length > 0 && A.numKey !== B.numKey;
  if (A.neg !== B.neg && alike) return { kind: "conflict", reason: "opposite-modal", ...base };
  if (A.neg === B.neg && numsDiffer && alike) return { kind: "conflict", reason: "different-numbers", ...base, numbers: { a: A.nums, b: B.nums } };
  if (trigSim > XAC_DUPLICATE && respSim > XAC_DUPLICATE && A.neg === B.neg && A.numKey === B.numKey) return { kind: "duplicate", reason: "near-duplicate", ...base };
  return null;
}
// One pair as a line, from `slug`'s side when given ("US-1.AC-2 ↔ billing/US-1.AC-3 (near-duplicate: 86% alike)"), else both qualified.
function crossAcItem(p, slug, lng) {
  const Q = i18n.msg(lng).quality;
  const flip = slug != null && p.a.feature !== slug;
  const [me, other] = flip ? [p.b, p.a] : [p.a, p.b];
  const nums = p.numbers ? (flip ? [p.numbers.b, p.numbers.a] : [p.numbers.a, p.numbers.b]).map((x) => x.join("/")).join(" ↔ ") : "";
  return Q.xacItem(slug != null ? me.id : me.feature + "/" + me.id, other.feature + "/" + other.id, Q.xacKind[p.kind] || p.kind, Q.xacWhy(p.reason, Math.round(p.similarity * 100), nums));
}
// spec_doctor's cross-feature-acs detail for `slug` (its pairs only; at most 6 shown).
function crossAcDoctorDetail(pairs, slug, lng) {
  const Q = i18n.msg(lng).quality;
  const items = pairs.slice(0, 6).map((p) => crossAcItem(p, slug, lng));
  if (pairs.length > 6) items.push(Q.xacMore(pairs.length - 6));
  return Q.xacDoctor(pairs.length, items.join("; "));
}
// SPECS.md's section (only when there is a pair): one line per pair, both sides qualified.
function renderCrossAcsMd(x, lang) {
  if (!x || !x.pairs.length) return "";
  const Q = i18n.msg(lang).quality;
  const icon = { duplicate: "≈", conflict: "⚡" };
  let md = `\n## ⚠ ${Q.xacHeading}\n\n> ${Q.xacIntro}${x.truncated ? " " + Q.xacTruncated : ""}\n\n`;
  for (const p of x.pairs) md += `- ${icon[p.kind] || "•"} ${crossAcItem(p, null, lang)}\n`;
  return md;
}

// --- Q3: the glossary (.specs/steering/glossary.md) ---
// One entry per list item: `- **Customer** — a person or company with a signed contract. _Avoid: client, user_` (a sub-line of
// the item may carry the `_Avoid:_` marker — English-stable in every language). HTML comments and fenced code never hold an
// entry; a [placeholder] term (the stub) is no entry. spec_clarify asks about every avoided word found in the feature's
// requirements.md / design.md (word-matched, case-insensitive, a plural "s" / "es" allowed, outside code spans, fenced code,
// comments and _Marker:_ tags; the glossary's own terms masked first, so "End user" never reads as "user"), doctor warns
// `glossary` with the count, spec_task_brief quotes the entries its task's text and criteria use (bounded). No glossary →
// nothing changes.
const GLOSSARY_FILE = "glossary.md";
const GLOSSARY_MAX_ENTRIES = 300;
const GLOSSARY_MAX_AVOID = 20;
const GLOSSARY_MAX_HITS = 200; // locations recorded per call
const GLOSSARY_BRIEF_MAX = 8;
const GLOSSARY_BRIEF_CHARS = 1500;
const RE_GLOSSARY_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s+(?:\*\*|__)([^*_\n]{1,120}?)(?:\*\*|__)(.*)$/;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const foldTerm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
// → { file, entries: [{ term, definition, avoid: [words] }], total, truncated } | null (no glossary.md). total: the entries the
// file holds; past GLOSSARY_MAX_ENTRIES only the first ones are read (truncated — doctor and clarify say so).
function glossaryEntries(root) {
  const file = path.join(root, "steering", GLOSSARY_FILE);
  const raw = readIfExists(file);
  if (raw == null) return null;
  const entries = [];
  let cur = null, total = 0;
  const flush = () => {
    if (cur) { const e = glossaryEntry(cur); if (e) { total++; if (entries.length < GLOSSARY_MAX_ENTRIES) entries.push(e); } }
    cur = null;
  };
  for (const l of scanTaskLines(steeringFrontMatter(raw).body)) {
    if (l.code) { flush(); continue; }
    const vis = l.vis.slice(0, 2000);
    const m = vis.match(RE_GLOSSARY_ITEM);
    if (m) { flush(); cur = { indent: m[1].length, term: m[2], rest: [m[3]], blank: false }; continue; }
    if (!cur) continue;
    if (!vis.trim()) { cur.blank = true; continue; } // a loose list: an indented paragraph after the blank line still belongs to the item
    if (/^\s*#/.test(vis)) { flush(); continue; }
    const indent = vis.match(/^\s*/)[0].length;
    if (cur.blank && indent <= cur.indent) { flush(); continue; } // after a blank line, only an indented paragraph continues it
    // a sub-line (its own bullet dropped) or a lazy continuation of the item
    if (indent > cur.indent || !RE_LIST_ITEM.test(vis)) cur.rest.push(vis.trim().replace(RE_LIST_ITEM, ""));
    else flush();
  }
  flush();
  return { file, entries, total, truncated: total > entries.length };
}
function glossaryEntry(cur) {
  const term = cur.term.trim().replace(/[:：]\s*$/, "").trim();
  if (!term || /^\[.*\]$/.test(term) || isGenericSlot(term)) return null;
  const avoid = [];
  const seen = new Set([foldTerm(term)]);
  // /_Avoid:[ \t]*([^_]*)_/ read as _Avoid:([^_]*)_ minus the leading blanks: the same matches, without the quadratic
  // rescan of a long blank run (1.17 H).
  const rest = cur.rest.join(" ").replace(/_Avoid:([^_]*)_/gi, (m, list0) => {
    const list = stripStart(list0, unitIn(" \t"));
    for (const w0 of list.split(/[,;]/)) {
      const w = stripEnds(w0.trim(), unitIn("`'\"*“”‘’"), unitIn("`'\"*“”‘’.")).trim(); // /^[`'"*“”‘’]+|[`'"*“”‘’.]+$/g
      if (!w || w.length > 60 || /^\[.*\]$/.test(w) || !/\p{L}/u.test(w) || seen.has(foldTerm(w)) || avoid.length >= GLOSSARY_MAX_AVOID) continue;
      seen.add(foldTerm(w));
      avoid.push(w);
    }
    return " ";
  });
  const def = rest.replace(/^\s*[—–:-]+\s*/, "").replace(/\s+/g, " ").trim().replace(/[.;,]\s*$/, "");
  return { term, definition: !def || /^\[[^\]]*\]$/.test(def) ? "" : def, avoid };
}
const RE_WORD_BEFORE = "(?<![\\p{L}\\p{N}_])", RE_WORD_AFTER = "(?![\\p{L}\\p{N}_])";
// One case-insensitive regex for a word list (longest first; a plural "s" / "es" allowed; spaces match any whitespace).
const wordListRe = (words, capture) => new RegExp(RE_WORD_BEFORE + (capture ? "(" : "(?:") + words.slice().sort((a, b) => b.length - a.length)
  .map((w) => escRe(w).replace(/\s+/g, "\\s+")).join("|") + ")(?:e?s)?" + RE_WORD_AFTER, "giu");
// --- the template text a glossary check never reads (1.16 Q review) ---
// A fresh scaffold is the tool's words, not the user's: "## User Stories", "As a [role]…", the tracks' template criteria ("a
// user of tenant A…"), a slot's own example ("[e.g., 90% of users…]"). Every visible line the templates write — the built-in
// ones (templateCorpus, in the feature's language; pt-BR through toPtBr), the project's (.specs/templates/) and its track packs'
// requirements / design blocks — becomes a line PATTERN: its key (whitespace folded, lower-cased, every number "#") with each
// top-level [bracket] group and {{variable}} a wildcard. A feature's line that IS a pattern is template text; only what fills
// its wildcards is the user's (a slot filled in, "[Title]" → "Client uploads a file"). A template heading also matches
// without its parenthetical ("## User Stories"). Lookup: exact keys in a Set; wildcard patterns by their first / last 8
// literal characters (a pattern with fewer than 4 literal characters hides nothing and is dropped); the match is linear.
const GLOSS_TEMPLATE_LINES = new Map(); // lang → { exact, head, tail, loose } — built-in, process-wide
const glossLineKey = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase().replace(/\p{N}+(?:[.,]\p{N}+)*/gu, "#");
// A key → { segs: its literal segments around the wildcards (one segment = no wildcard), slots: each wildcard's own template
// text (an untouched slot is no user text) }, or null (unbalanced brackets: exact only).
function glossPatternSegs(key) {
  const segs = [], slots = [];
  let cur = "", depth = 0, wild = false;
  const openWild = () => { if (wild && cur === "") return; segs.push(cur); cur = ""; slots.push(""); wild = true; };
  for (let i = 0; i < key.length; i++) {
    const c = key[i];
    if (c === "[") { if (depth === 0) openWild(); depth++; slots[slots.length - 1] += c; continue; }
    if (depth > 0) { if (c === "]") depth--; slots[slots.length - 1] += c; continue; }
    if (c === "{" && key[i + 1] === "{") {
      const j = key.indexOf("}}", i + 2);
      if (j !== -1) { openWild(); slots[slots.length - 1] += key.slice(i, j + 2); i = j + 1; continue; }
    }
    cur += c;
    wild = false;
  }
  if (depth > 0) return null;
  segs.push(cur);
  return { segs, slots };
}
// The visible lines of a template text (comments and fenced code are never a feature's visible text either).
const glossVisibleLines = (text) => scanTaskLines(String(text || "")).filter((l) => !l.code).map((l) => l.vis);
function glossAddLines(set, text) {
  for (const vis of Array.isArray(text) ? text : glossVisibleLines(text)) {
    const key = glossLineKey(vis);
    if (!key) continue;
    const add = (pt, k) => {
      if (!pt || pt.segs.length === 1) { set.exact.add(k); return; }
      const sg = pt.segs;
      const lit = sg.join("").length;
      const id = sg.join("\u0000") + "\u0001" + pt.slots.join("\u0000");
      if (lit < 4 || set.seen.has(id)) return; // the corpus repeats most lines
      set.seen.add(id);
      const p = { segs: sg, slots: pt.slots, lit };
      const put = (m, x) => { const a = m.get(x); if (a) a.push(p); else m.set(x, [p]); };
      if (sg[0].length >= 8) put(set.head, sg[0].slice(0, 8));
      else if (sg[sg.length - 1].length >= 8) put(set.tail, sg[sg.length - 1].slice(-8));
      else set.loose.push(p);
    };
    add(glossPatternSegs(key), key);
    const paren = key.startsWith("#") ? key.indexOf(" (") : -1; // "## user stories (prioritized — …)" → "## user stories"
    if (paren > 1) add(glossPatternSegs(key.slice(0, paren)), key.slice(0, paren));
  }
}
const glossNewSet = () => ({ exact: new Set(), head: new Map(), tail: new Map(), loose: [], seen: new Set() });
function glossBuiltinLines(lang) {
  const l = normalizeLang(lang);
  if (GLOSS_TEMPLATE_LINES.has(l)) return GLOSS_TEMPLATE_LINES.get(l);
  const set = glossNewSet();
  const base = i18n.baseLang(l);
  // The texts a requirements.md / design.md is scaffolded from: every track combination (templateCorpus' set), the track
  // blocks spec_add_track appends, the bugfix's requirements and bug report.
  const texts = [];
  const put = (fn) => { try { const t = fn(); if (typeof t === "string") texts.push(t); } catch { /* a builder's trouble never breaks the check */ } };
  const combos = [[], ...OPTIONAL_TRACKS.map((t) => [t]), ...OPTIONAL_TRACKS.flatMap((t, i) => OPTIONAL_TRACKS.slice(i + 1).map((u) => [t, u])), OPTIONAL_TRACKS].map((x) => ["core", ...x]);
  for (const tracks of combos) {
    const a = { name: "x", tracks, label: trackLabel(tracks), slug: "x", summary: "" };
    put(() => i18n.requirements(a, base));
    put(() => i18n.design(a, base));
  }
  for (const tr of VALID_TRACKS) put(() => i18n.trackDesignBlock(tr, base));
  put(() => i18n.bugRequirements({ name: "x" }, base));
  put(() => i18n.bugReport({ name: "x" }, base));
  const lines = new Set();
  for (const t of new Set(texts)) for (const v of glossVisibleLines(t)) lines.add(v);
  glossAddLines(set, l === base ? [...lines] : [...lines].map((x) => i18n.toPtBr(x))); // pt-BR: the pt lines, each once
  GLOSS_TEMPLATE_LINES.set(l, set);
  return set;
}
// The project's own: its templates (.specs/templates/) and its track packs' requirements / design blocks (this call's).
function glossProjectLines(projectDir, lang) {
  const set = glossNewSet();
  let any = false;
  for (const f of templateFileList(projectDir)) {
    if (!f.key) continue;
    const text = readTemplateFile(f.abs, projectDir);
    if (text != null) { glossAddLines(set, text); any = true; }
  }
  for (const tr of packTracks()) {
    const pack = packOf(tr);
    if (!pack) continue;
    try { glossAddLines(set, packRequirementsBlock(pack, lang, "", {})); glossAddLines(set, packDesignBlock(pack, lang, {})); any = true; } catch { /* ignore */ }
  }
  return any ? set : null;
}
// A wildcard pattern against a line key → the texts its wildcards cover (a wildcard may be empty), or null. Linear.
function glossSpans(segs, s) {
  const first = segs[0], last = segs[segs.length - 1];
  if (s.length < first.length + last.length || !s.startsWith(first) || !s.endsWith(last)) return null;
  const end = s.length - last.length;
  let pos = first.length;
  const spans = [];
  for (let i = 1; i < segs.length - 1; i++) {
    const at = s.indexOf(segs[i], pos);
    if (at === -1 || at + segs[i].length > end) return null;
    spans.push(s.slice(pos, at));
    pos = at + segs[i].length;
  }
  if (pos > end) return null;
  spans.push(s.slice(pos, end));
  return spans;
}
// A line → the parts the user wrote: [line] (no template line), [] (a template line untouched), or its filled wildcards.
function glossUserParts(line, sets) {
  const key = glossLineKey(line);
  if (!key) return [];
  let best = null;
  for (const set of sets) {
    if (set.exact.has(key)) return [];
    const cands = [].concat(set.head.get(key.slice(0, 8)) || [], set.tail.get(key.slice(-8)) || [], set.loose);
    for (const p of cands) {
      if (best && p.lit <= best.lit) continue;
      const spans = glossSpans(p.segs, key);
      if (spans) best = { lit: p.lit, spans: spans.filter((x, k) => x !== p.slots[k]) }; // an untouched slot: the template's words
    }
  }
  return best ? best.spans.filter((x) => /\p{L}/u.test(x)) : [line];
}
// The avoided words the feature's requirements.md / design.md use → [{ word, term, definition, avoid, count, locations:
// ["requirements.md:12", …] (≤ 5 each) }] in first-seen order. Template text is never read (glossUserParts), nor a template
// slot, a code span, a _Marker:_ tag or a glossary term; `_client_` (underscore emphasis) is the word client (snake_case isn't).
// opts: { projectDir, lang } (the template lines of that language and project; without them, the built-in EN ones).
function glossaryHits(dir, gl, opts = {}) {
  const withAvoid = gl ? gl.entries.filter((e) => e.avoid.length) : [];
  if (!withAvoid.length) return [];
  const byWord = new Map();
  for (const e of withAvoid) for (const w of e.avoid) if (!byWord.has(foldTerm(w))) byWord.set(foldTerm(w), { word: w, entry: e });
  const reAvoid = wordListRe([...byWord.values()].map((x) => x.word), true);
  const reTerm = wordListRe(gl.entries.map((e) => e.term), false);
  const blank = (m) => " ".repeat(m.length);
  const lang = normalizeLang(opts.lang || "en");
  let sets = null; // built on the first line that holds an avoided word (most lines hold none)
  const setsOf = () => sets || (sets = [glossBuiltinLines(lang), opts.projectDir ? glossProjectLines(opts.projectDir, lang) : null].filter(Boolean));
  // A part's own template slots blanked ("[e.g., 90% of users…]" is the template's example, not the user's words).
  const slotless = (s) => (s.includes("[") ? bracketPlaceholders(s, new Set()).reduce((a, p) => a.split(p).join(" ".repeat(p.length)), s) : s);
  const hits = new Map();
  let total = 0;
  for (const file of ["requirements.md", "design.md"]) {
    const text = readIfExists(path.join(dir, file));
    if (text == null) continue;
    scanTaskLines(text).forEach((l, i) => {
      if (l.code || total >= GLOSSARY_MAX_HITS) return;
      const line = l.vis.slice(0, 4000);
      reAvoid.lastIndex = 0;
      const any = reAvoid.test(line.replace(/_/g, " ")); // an avoided word on the line at all (underscores as spaces: `_client_` too)
      reAvoid.lastIndex = 0; // matchAll below copies lastIndex
      if (!any) return;
      for (const part of glossUserParts(line, setsOf())) {
        // A template line's filled slot comes lower-cased (its key): a _marker:_ tag is then matched in any case.
        const v = slotless(part).replace(/`[^`\n]*`/g, blank).replace(part === line ? /_[A-Z][A-Za-z ]{1,30}:[^_\n]*_/g : /_[A-Za-z][A-Za-z ]{1,30}:[^_\n]*_/g, blank)
          .replace(/(?<![\p{L}\p{N}_])_{1,2}(?=[\p{L}\p{N}])/gu, " ").replace(/(?<=[\p{L}\p{N}])_{1,2}(?![\p{L}\p{N}_])/gu, " ") // _client_ → client
          .replace(reTerm, blank);
        for (const m of v.matchAll(reAvoid)) {
          const x = byWord.get(foldTerm(m[1]));
          if (!x) continue;
          const k = foldTerm(x.word);
          const h = hits.get(k) || { word: x.word, term: x.entry.term, definition: x.entry.definition, avoid: x.entry.avoid, count: 0, locations: [] };
          h.count++;
          total++;
          const loc = `${file}:${i + 1}`;
          if (h.locations.length < 5 && !h.locations.includes(loc)) h.locations.push(loc);
          hits.set(k, h);
        }
      }
    });
  }
  return [...hits.values()];
}
// The glossary entries a text uses (a term or an avoided word, word-matched) — the task brief's, bounded by count and size.
function briefGlossary(root, text) {
  const gl = glossaryEntries(root);
  if (!gl || !gl.entries.length) return { items: [], omitted: [] };
  const items = [], omitted = [];
  let budget = GLOSSARY_BRIEF_CHARS;
  for (const e of gl.entries) {
    if (!wordListRe([e.term, ...e.avoid], false).test(text)) continue;
    const size = e.term.length + e.definition.length + e.avoid.join(", ").length + 20;
    if (items.length < GLOSSARY_BRIEF_MAX && size <= budget) { items.push(e); budget -= size; } else omitted.push(e.term);
  }
  return { items, omitted };
}

// 1.17 A1 — every design weighs its choices: the core "Alternatives & Trade-offs" and "Risks" sections, found by weighSection()
// (a synonym that NAMES the heading — see below), so hand-written and PT/ES designs are recognized. Doctor only WARNS
// (design-tradeoffs / design-risks) — never an approval check — and only on a design not approved yet or approved by 1.17+
// (`weigh: true` on the approval, A review 3): a design approved before 1.17 is never flagged. A fresh scaffold's sections are
// template slots, which the placeholder gate already refuses at the design approval like every other template section.
// A plain "Decisions" heading is NOT a trade-offs section (A review 6): the execplan / fluidplan imports write `## Decisions` — a
// decision LOG (what was chosen, D-1…), not the options weighed; reading its entries as options would pass one-entry logs as
// "few" and multi-entry logs as weighed. "Key decisions" / "Design decisions" (an ADR / MADR habit) are.
const TRADEOFFS_SYN = ["alternatives", "alternatives considered", "considered alternatives", "analysis of alternatives", "trade-offs", "trade-off",
  "tradeoffs", "tradeoff", "trade offs", "trade off", "trade-off analysis", "tradeoff analysis", "trade off analysis", "options", "options considered",
  "considered options", "design alternatives", "design options", "key decisions", "key design decisions", "design decisions",
  "alternativas", "alternativas consideradas", "análise de alternativas", "analise de alternativas", "compromissos", "opções", "opcoes",
  "opções consideradas", "opcoes consideradas", "decisões e alternativas", "decisoes e alternativas", "decisões-chave", "decisoes-chave",
  "decisões chave", "decisoes chave", "decisões principais", "decisoes principais", "decisões de design", "decisoes de design",
  "compensaciones", "concesiones", "compromisos", "opciones", "opciones consideradas", "análisis de alternativas", "analisis de alternativas",
  "decisiones y alternativas", "decisiones clave", "decisiones principales", "decisiones de diseño", "decisiones de diseno"];
const RISKS_SYN = ["risks", "risk", "known risks", "key risks", "main risks", "open risks", "risk register", "risk assessment", "risk analysis",
  "risk matrix", "risk log", "riscos", "risco", "riscos conhecidos", "principais riscos", "análise de riscos", "analise de riscos",
  "avaliação de riscos", "avaliacao de riscos", "matriz de riscos", "registo de riscos", "registro de riscos",
  "riesgos", "riesgo", "riesgos conocidos", "principales riesgos", "análisis de riesgos", "analisis de riesgos", "evaluación de riesgos",
  "evaluacion de riesgos", "matriz de riesgos", "registro de riesgos"];
// [id, synonyms, the fewest entries that count as weighed]: a decision needs at least two options; one honest line about the
// risks (a table row, a bullet, or "no material risk, because X") is enough.
const DESIGN_WEIGH = [["design-tradeoffs", TRADEOFFS_SYN, 2], ["design-risks", RISKS_SYN, 0]];
const DESIGN_WEIGH_IDS = new Set(DESIGN_WEIGH.map(([id]) => id));
// A weigh heading NAMES its section (A review 6): after the heading lead (numbering, an emoji, a marker) the synonym is the whole
// heading, or it is followed by a separator ( : , ; ( [ / & + | — – . or a spaced hyphen) or a connector word (and / or / vs / for /
// of … e / ou / de … y / o / en …) — never a modifier: "## Risk-based rate limiting", "## Options parser", "## Riskiest
// assumptions" are other sections. Trailing emphasis, emoji or closing #s are fine (no letter or digit after the synonym).
const RE_WEIGH_HEADING_REST = /^(?:[^\p{L}\p{N}]*$|\s*[:,;(\[/&+|—–.]|\s+-(?=\s|$)|\s+(?:and|or|vs|versus|for|of|to|in|on|per|with|e|ou|de|do|da|dos|das|para|por|em|no|na|com|y|o|u|del|en|con)(?![\p{L}\p{N}]))/u;
function weighHeadingMatches(line, syns) {
  const m = atxHeading(line, 2, 6, "raw"); // /^#{2,6}\s+(.*)$/ — never the H1 title (it carries the feature name)
  if (!m) return false;
  let t = m.text.toLowerCase();
  const lead = headingLeadRe();
  for (let prev = null; prev !== t;) { prev = t; t = t.replace(lead, ""); }
  return syns.some((s) => t.startsWith(s) && RE_WEIGH_HEADING_REST.test(t.slice(s.length)));
}
// A weigh section's body (up to the next heading of its level or above) or null. An unmarked heading wins over one carrying a
// track marker ("## [DIST] Risks" is a track's section, the core one is the design's own); fenced code never holds a heading.
function weighSection(md, syns) {
  const lines = String(md || "").split(/\r?\n/);
  const heads = headingIndex(lines).filter((i) => weighHeadingMatches(lines[i], syns));
  if (!heads.length) return null;
  const MARKERS = markerTracks().map((t) => trackMarker(t));
  const start = heads.find((i) => !MARKERS.some((mk) => lines[i].includes(mk))) ?? heads[0];
  const level = (i) => (lines[i].match(/^(#{1,6})\s/) || ["", "######"])[1].length;
  const end = headingIndex(lines).find((i) => i > start && level(i) <= level(start));
  return lines.slice(start + 1, end == null ? lines.length : end).join("\n");
}
// A unit's text is a generic slot word (TODO, TBD, TBC, FIXME, "…", "a definir" — isGenericSlot), trailing punctuation aside.
const genericUnit = (s) => isGenericSlot(stripEnd(String(s).replace(/[*_`]+/g, "").trim(), unitIn(".:;!?"))); // /[.:;!?]+$/
// What a design section holds (A review 6): `entries` = table data rows (a table's header and separator rows skipped) + list items
// at the section's outermost list level (indented up to 3 spaces; deeper ones are that item's pros / cons) — or, when that is
// more, its sub-headings / bold-led paragraphs (one "### Option A" or "**Option A — …**" per option); `proseWords` = the words
// of its other lines (a paragraph); `generic` = units holding only a generic slot word (a bare TODO / TBD), never counted.
// Comments and fenced code never count. Linear.
function designBody(body) {
  let rows = 0, heads = 0, proseWords = 0, generic = 0, inTable = false;
  const items = [];
  for (const l of stripFencedCode(stripHtmlComments(body || "")).split(/\r?\n/)) {
    if (!l.trim()) { inTable = false; continue; }
    if (/^\s*\|/.test(l)) {
      if (!inTable) { inTable = true; continue; } // the header row
      if (/^[\s|:-]+$/.test(l)) continue; // the separator row
      const cells = l.split("|").map((c) => c.trim()).filter((c) => /[\p{L}\p{N}]/u.test(c));
      if (!cells.length) continue; // an empty row
      if (cells.every(genericUnit)) generic++; else rows++;
      continue;
    }
    inTable = false;
    const li = l.match(/^( *)(?:[-*+]|\d+[.)])\s+(\S.*)$/);
    if (li) { if (genericUnit(li[2])) generic++; else items.push(li[1].length); continue; }
    // (?=[^*\n]*\p{L}): the bold run's letter found by one look ahead — [^*\n]*\p{L}[^*\n]* backtracked quadratically (1.17 H)
    if (/^#{3,6}\s+\S/.test(l) || /^ {0,3}\*\*(?=[^*\n]*\p{L})[^*\n]*\*\*/u.test(l)) { heads++; continue; }
    if (genericUnit(l)) { generic++; continue; }
    proseWords += (l.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length;
  }
  const top = items.reduce((a, n) => Math.min(a, n), Infinity);
  const listed = top <= 3 ? items.filter((n) => n < top + 2).length : 0;
  return { entries: Math.max(rows + listed, heads), proseWords, generic };
}
const designEntries = (body) => designBody(body).entries;
// A trade-offs section with no option list passes on a written paragraph of at least this many words: the options weighed in
// prose, or the honest "No key decision here: the feature only reads existing data" (A review 6 — the escape Risks has).
const WEIGH_PROSE_WORDS = 3;
// One section's state: missing · template (a slot or the TODO sentinel left, or nothing but a generic TODO / TBD) · empty (blank,
// or a table's header and separator alone) · few (fewer entries than `min`) · filled. Trade-offs: ≥ 2 entries, or no entry and a
// written paragraph (prose); risks: any entry or any prose.
function designWeighState(design, syn, min) {
  const body = weighSection(design || "", syn);
  if (body == null) return { status: "missing", entries: 0 };
  if (RE_TODO_SENTINEL.test(body) || placeholderReport(body).length) return { status: "template", entries: 0 };
  const b = designBody(body);
  if (!b.entries && !b.proseWords) return { status: b.generic ? "template" : "empty", entries: 0 };
  if (b.entries >= Math.max(min, 1)) return { status: "filled", entries: b.entries };
  if (!b.entries && b.proseWords >= (min ? WEIGH_PROSE_WORDS : 1)) return { status: "filled", entries: 0, prose: true };
  return { status: "few", entries: b.entries };
}
// The two doctor checks over an (active) design → [{ id, status: pass | warn, detail, state, entries }]. opts.legacy (A review 3):
// the design was approved before 1.17 (its approval carries no `weigh`) — what would warn passes, with a note: the sections are
// asked of a design from its next approval on, never of one already signed off (a finished feature following the advice would
// re-open its re-review, changed-since-approval, stale finish and execution sign-off).
function designWeighChecks(design, lang, opts = {}) {
  const W = i18n.msg(lang).designWeigh;
  return DESIGN_WEIGH.map(([id, syn, min]) => {
    const st = designWeighState(design, syn, min);
    const detail = W[id][st.status](st.entries, min);
    if (st.status !== "filled" && opts.legacy) return { id, status: "pass", detail: W.legacyApproval(detail), state: st.status, entries: st.entries, legacy: true };
    return { id, status: st.status === "filled" ? "pass" : "warn", detail, state: st.status, entries: st.entries };
  });
}
// A design approval made before 1.17 (A review 3): an approval record without the `weigh` stamp approvePhase adds since 1.17.
const designApprovedBeforeWeigh = (approvals) => isRecord(approvals && approvals.design) && approvals.design.weigh !== true;

// ---------------------------------------------------------------------------
// Clarify — surface ambiguities/gaps in requirements before designing
// ---------------------------------------------------------------------------

// Rate limits in natural wording (EN/PT/ES), not just the literal "rate limit".
const RE_RATE_LIMIT = /rate[\s-]?limit|throttl|limites? de (?:pedidos|taxa|solicita[çc][õo]es)|limita[çc](?:[ãa]o|[õo]es) de taxa|l[íi]mites? de (?:peticiones|solicitudes|tasa)|limitaci[óo]n(?:es)? de tasa/i;
// +sec: a criterion for the caller who is NOT allowed (unauthenticated / unauthorized → denied), EN/PT/ES.
const RE_ACCESS_DENIED = /unauth(?:enticated|ori[sz]ed)|forbidden|(?<!\d)40[13](?!\d)|\bden(?:y|ies|ied)\b|\breject|n[ãa]o (?:autenticad|autorizad)|no (?:autenticad|autorizad)|\brecus|\brejeit|\bdeneg|\brechaz/i;
// +privacy: a data subject right written as a criterion (erasure / export / portability), EN/PT/ES.
const RE_SUBJECT_RIGHTS = /erasure|delet|export|portab|apag|elimin|supres|borrar|borrad/i;
// 1.17 A2 — the constraint nudge: the words that make consistency a design question, by concept (a queue, events, async work,
// concurrency, transactions, retries) plus STRONG phrases that can only mean it (a message queue, an event bus, publishing an
// event, a background job, concurrent writes, a race condition, a distributed transaction, a webhook, Kafka…). A weak word alone
// is often something else — "click event", "Retry button", "Images load async", a statement listing "transactions" — so the
// nudge needs two DISTINCT concepts or one strong phrase (A review 7). Whole words; English ones in every spec, the feature
// language's own besides ("fila" is a queue in PT but a table row in ES, "cola" the reverse).
const CONSTRAINT_KINDS = ["strong", "queue", "event", "async", "concurrency", "transaction", "retry"];
const CONSTRAINT_SIGNALS = {
  en: {
    strong: "message[\\s-]+(?:queues?|brokers?|bus)|(?:job|task|work|delayed|dead[\\s-]+letter|retry)[\\s-]+queues?|event[\\s-]+(?:bus|buses|streams?|sourcing|stores?|brokers?)|event-driven" +
      "|(?:domain|integration)[\\s-]+events?|publish(?:es|ed|ing)?\\s+(?:[^\\s.;:!?]+\\s+){0,3}?events?|background[\\s-]+(?:jobs?|workers?|tasks?|processing|process(?:es)?)" +
      "|(?:queue|job)[\\s-]+workers?|(?:concurrent|simultaneous|parallel)[\\s-]+(?:writes?|updates?|edits?|modifications?|writers?|transactions?)|race[\\s-]+conditions?|lost[\\s-]+updates?" +
      "|double[\\s-]+(?:bookings?|spend(?:ing)?|charg(?:e|es|ed|ing))|distributed[\\s-]+(?:transactions?|locks?)|two[\\s-]+phase[\\s-]+commit|webhooks?|pub/sub|kafka|rabbitmq|sqs|sagas?",
    queue: "queue|queues|queued|enqueue|enqueues|enqueued|dequeue|dequeues|dequeued",
    event: "event|events",
    async: "async|asynchronous|asynchronously",
    concurrency: "concurrent|concurrently|concurrency|simultaneous|simultaneously",
    transaction: "transaction|transactions|transactional",
    retry: "retry|retries|retried|redeliver|redelivery|redelivered",
  },
  pt: {
    strong: "filas?\\s+de\\s+(?:mensagens|tarefas|trabalhos|jobs|eventos|processamento)|barramentos?\\s+de\\s+eventos|orientad[oa]s?\\s+a\\s+eventos|eventos?\\s+de\\s+dom[íi]nio" +
      "|publica(?:r|m|do|da|dos|das)?\\s+(?:[^\\s.;:!?]+\\s+){0,3}?eventos?|(?:tarefas?|trabalhos?|jobs?|processamentos?|processos?)\\s+em\\s+segundo\\s+plano" +
      "|(?:escritas|atualiza[çc][õo]es|edi[çc][õo]es|altera[çc][õo]es|grava[çc][õo]es)\\s+(?:concorrentes|simult[âa]neas|em\\s+paralelo)|condi[çc](?:[ãa]o|[õo]es)\\s+de\\s+corrida" +
      "|transa[çc](?:[ãa]o|[õo]es)\\s+distribu[íi]das?|commit\\s+em\\s+duas\\s+fases|(?:reserva|cobran[çc]a)\\s+dupla|duplo\\s+(?:d[ée]bito|pagamento)",
    queue: "fila|filas|enfileirad[oa]s?|enfileirar",
    event: "evento|eventos",
    async: "ass[íi]ncron[oa]s?|assincronamente",
    concurrency: "concorrente|concorrentes|concorr[êe]ncia|simult[âa]ne[oa]s?|simultaneamente",
    transaction: "transa[çc](?:[ãa]o|[õo]es)|transacional|transacionais",
    retry: "reenvio|reenvios|reenviad[oa]s?|nova\\s+tentativa|novas\\s+tentativas|retentativas?",
  },
  es: {
    strong: "colas?\\s+de\\s+(?:mensajes|tareas|trabajos|eventos|procesamiento)|bus(?:es)?\\s+de\\s+eventos|orientad[oa]s?\\s+a\\s+eventos|eventos?\\s+de\\s+dominio" +
      "|publica(?:r|n|do|da|dos|das)?\\s+(?:[^\\s.;:!?]+\\s+){0,3}?eventos?|(?:tareas?|trabajos?|jobs?|procesamientos?|procesos?)\\s+en\\s+segundo\\s+plano" +
      "|(?:escrituras|actualizaciones|ediciones|modificaciones)\\s+(?:concurrentes|simult[áa]neas|en\\s+paralelo)|condici(?:[óo]n|ones)\\s+de\\s+carrera" +
      "|transacci(?:[óo]n|ones)\\s+distribuidas?|confirmaci[óo]n\\s+en\\s+dos\\s+fases|doble\\s+(?:reserva|cobro|cargo|pago)",
    queue: "cola|colas|encolad[oa]s?|encolar",
    event: "evento|eventos",
    async: "as[íi]ncron[oa]s?|as[íi]ncronamente",
    concurrency: "concurrente|concurrentes|concurrencia|simult[áa]ne[oa]s?|simult[áa]neamente",
    transaction: "transacci[óo]n|transacciones|transaccional|transaccionales",
    retry: "reintento|reintentos|reintentar|reintentad[oa]s?",
  },
};
// One regex per language, a capture group per kind (strong first: "event bus" is one strong phrase, never the weak "event").
const CONSTRAINT_RE = new Map();
function constraintSignalRe(lang) {
  const l = lang === "pt" || lang === "es" ? lang : "en";
  if (!CONSTRAINT_RE.has(l)) {
    const alt = (k) => CONSTRAINT_SIGNALS.en[k] + (l === "en" ? "" : "|" + CONSTRAINT_SIGNALS[l][k]);
    CONSTRAINT_RE.set(l, new RegExp("(?<![\\p{L}\\p{N}_/-])(?:" + CONSTRAINT_KINDS.map((k) => "(" + alt(k) + ")").join("|") + ")(?![\\p{L}\\p{N}_/-])", "giu"));
  }
  return CONSTRAINT_RE.get(l);
}
// The answer (A review 7): multi-word phrases that state a consistency model, a delivery guarantee, idempotency or a locking
// strategy — EN / PT / ES, in any spec. Never a bare "consistent" / "eventually" / "atomic" / "isolation" ("consistent UI styling",
// "we will eventually add caching", "atomic design", "tenant isolation" answer nothing). ACID is matched upper-case only.
const RE_CONSISTENCY_ANSWER = new RegExp("(?<![\\p{L}\\p{N}_])(?:" + [
  "eventual(?:ly)?[\\s-]+consisten(?:t|cy)", "strong(?:ly)?[\\s-]+consisten(?:t|cy)", "consistency[\\s-]+(?:models?|levels?|guarantees?)",
  "read[\\s-]+your[\\s-]+(?:own[\\s-]+)?writes", "idempoten\\p{L}*", "at[\\s-]+(?:least|most)[\\s-]+once", "exactly[\\s-]+once", "isolation[\\s-]+levels?",
  "(?:serializable|snapshot)[\\s-]+isolation", "read[\\s-]+committed", "repeatable[\\s-]+read",
  "(?:optimistic|pessimistic)[\\s-]+(?:locking|locks?|concurrency)", "outbox(?:es)?", "dedup\\p{L}*", "atomicity", "atomically", "two[\\s-]+phase[\\s-]+commit",
  "compare[\\s-]+and[\\s-]+(?:swap|set)",
  "consist[êe]ncia[\\s-]+(?:eventual|forte|fraca)", "(?:eventualmente|fortemente)[\\s-]+consistentes?", "modelo[\\s-]+de[\\s-]+consist[êe]ncia",
  "pelo[\\s-]+menos[\\s-]+uma[\\s-]+vez", "no[\\s-]+m[áa]ximo[\\s-]+uma[\\s-]+vez", "exatamente[\\s-]+uma[\\s-]+vez", "n[íi]vel[\\s-]+de[\\s-]+isolamento",
  "bloqueio[\\s-]+(?:otimista|pessimista)", "concorr[êe]ncia[\\s-]+(?:otimista|pessimista)", "atomicidade", "atomicamente", "commit[\\s-]+em[\\s-]+duas[\\s-]+fases",
  "consistencia[\\s-]+(?:eventual|fuerte|d[ée]bil)", "(?:eventualmente|fuertemente)[\\s-]+consistentes?", "modelo[\\s-]+de[\\s-]+consistencia",
  "al[\\s-]+menos[\\s-]+una[\\s-]+vez", "(?:como[\\s-]+m[áa]ximo|a[\\s-]+lo[\\s-]+sumo)[\\s-]+una[\\s-]+vez", "exactamente[\\s-]+una[\\s-]+vez",
  "nivel[\\s-]+de[\\s-]+aislamiento", "bloqueo[\\s-]+(?:optimista|pesimista)", "concurrencia[\\s-]+(?:optimista|pesimista)", "atomicidad", "at[óo]micamente",
  "confirmaci[óo]n[\\s-]+en[\\s-]+dos[\\s-]+fases",
].join("|") + ")(?![\\p{L}\\p{N}_])", "iu");
const RE_ACID = /(?<![\p{L}\p{N}_])ACID(?![\p{L}\p{N}_])/u;
const CONSTRAINT_MAX_WORDS = 3;
// The user's own text of a spec file (A review 1) — never the tool's: its visible lines (scanTaskLines: comments and fenced code
// out, inactive track sections dropped), minus every line that IS template text (glossUserParts over the line patterns the
// glossary check builds — the built-in templates of every track combination in the feature's language, the track blocks, the
// project's templates and track packs; a filled slot is the user's), minus a section still holding its `> **TODO**` sentinel
// (a track section nobody wrote yet), with template [slots] and code spans blanked. → the parts, newline-joined.
function userSpecText(text, tracks, sets) {
  const rows = scanTaskLines(activeDesign(String(text || ""), tracks));
  const skip = new Uint8Array(rows.length);
  let start = 0, todo = false;
  const close = (end) => { if (todo) for (let i = start; i < end; i++) skip[i] = 1; };
  rows.forEach((r, i) => {
    if (r.code) return;
    if (/^#{1,6}\s/.test(r.vis)) { close(i); start = i; todo = false; } else if (RE_TODO_SENTINEL.test(r.vis)) todo = true;
  });
  close(rows.length);
  const out = [];
  let size = 0;
  for (let i = 0; i < rows.length && size < 200000; i++) {
    if (rows[i].code || skip[i] || !rows[i].vis.trim()) continue;
    for (const part of glossUserParts(rows[i].vis.slice(0, 4000), sets)) {
      const slots = part.includes("[") ? bracketPlaceholders(part, new Set()) : [];
      const v = slots.reduce((a, p) => a.split(p).join(" "), part).replace(/`[^`\n]*`/g, " ");
      out.push(v);
      size += v.length;
    }
  }
  return out.join("\n");
}
// → { code: "consistency-unstated", signals: [≤ 3 words, in order of appearance — one per concept, each strong phrase] } | null.
// Reads the user's text of requirements.md and design.md (userSpecText — a pristine scaffold of any track, in any language, never
// fires it, nor does a template criterion the spec keeps as written). Answered (A review 2) anywhere in that text — /clarify folds
// the answer into requirements.md, and /grill asks in Phase 1 while design.md is still a template. Only for a plain feature (a
// bugfix restores behaviour; a spike has no design) and not with +dist (its Consistency Model / Delivery & Idempotency sections
// ask the same, 1.17 D).
function constraintNudge(projectDir, dir, reqs, tracks, kind, lang) {
  if (kind !== "feature" || tracks.includes("dist")) return null;
  const lng = normalizeLang(lang || "en");
  const sets = [glossBuiltinLines(lng), glossProjectLines(projectDir, lng)].filter(Boolean);
  const text = userSpecText(reqs, tracks, sets) + "\n" + userSpecText(readIfExists(path.join(dir, "design.md")) || "", tracks, sets);
  const signals = [];
  const seen = new Set();
  let strong = false;
  for (const m of text.matchAll(constraintSignalRe(i18n.baseLang(lng)))) {
    const k = CONSTRAINT_KINDS[m.slice(1).findIndex((g) => g !== undefined)];
    const w = m[0].toLowerCase().replace(/\s+/g, " ");
    const key = k === "strong" ? "strong:" + w.replace(/s$/, "") : k; // "webhook" and "webhooks" are one signal
    if (k === "strong") strong = true;
    if (!seen.has(key)) { seen.add(key); if (signals.length < CONSTRAINT_MAX_WORDS) signals.push(w); }
    if (signals.length >= CONSTRAINT_MAX_WORDS && (strong || seen.size >= 2)) break;
  }
  if (!strong && seen.size < 2) return null;
  if (RE_CONSISTENCY_ANSWER.test(text) || RE_ACID.test(text)) return null;
  return { code: "consistency-unstated", signals };
}
// +dist (1.17 D): a criterion about duplicated / redelivered messages, and one about a dependency being down, EN/PT/ES.
// (1.17 D review: + "arrives twice" / "duas vezes" / "dos veces", a redelivery; + "goes down", "unreachable", ES "está caído" — the
// ES template's own word —, pt-BR "fora do ar", PT "em baixo" / "inacessível". Literal alternations: linear.)
const RE_DIST_DELIVERY = /idempot|duplicat|duplica|dedup|exactly[ -]once|at[ -]least[ -]once|exatamente uma vez|pelo menos uma vez|exactamente una vez|al menos una vez|more than once|mais de uma vez|más de una vez|twice|duas vezes|dos veces|re-?deliver|reentreg/i;
const RE_DIST_FAILURE = /unavailable|is down|goes down|went down|unreachable|timeout|timed out|times out|indispon[íi]ve|n[ãa]o est[áa] dispon[íi]vel|fora do ar|(?:est[áa]|estiver|fica|ficar) em baixo|inacess[íi]vel|no est[áa] disponible|est[áa] ca[íi]d[oa]|se cae|inalcanzable|tempo limite|tiempo de espera|partition|parti[çc][ãa]o|partici[óo]n/i;
function clarify(projectDir, name) {
  const f = existingFeature(projectDir, name);
  if (!f.ok) return { ok: false, error: f.error };
  const dir = f.dir;
  const reqs = readIfExists(path.join(dir, "requirements.md"));
  if (reqs == null) return { ok: false, error: errs(projectDir, f.slug).requirementsMissing(f.slug) };
  const tracks = detectTracks(dir);
  const fm = i18n.msg(featureLang(projectDir, name));
  const q = fm.clarify; // localized clarification questions
  const questions = [];
  const add = (s) => { if (!questions.includes(s)) questions.push(s); };

  // Author-marked ambiguities take priority — resolve every [NEEDS CLARIFICATION] first.
  const markers = clarificationMarkers(reqs);
  markers.forEach((mk) => add(q.resolveMarker(mk)));

  // Spec-Kit-style structure checks (headings matched EN/PT/ES)
  if (!RE_SUCCESS_CRITERIA.test(reqs)) add(q.addSuccessCriteria);
  else if (!/\bSC-\d+/.test(reqs)) add(q.idSuccessCriteria);
  if (!/\bP1\b/.test(reqs)) add(q.prioritize);
  if (!RE_INDEPENDENT_TEST.test(reqs)) add(q.independentTest);

  // EARS-derived: vague terms + missing IDs
  const e = earsValidate(reqs);
  for (const i of e.issues || []) {
    if (i.code === "vague") add(q.quantifyVague(i.line, i.text.slice(0, 80)));
  }
  // Leftover template placeholders (placeholderReport: bracketed prose, the TODO sentinel — never tags, IDs, links,
  // checkboxes or code) plus TBDs, as ONE question naming file:line and the text (it used to be one "Resolve
  // placeholder/TBD on line N" per line). A removed track's [SaaS]/[AI] criteria are inactive, not asked about.
  const active = artifactReport(dir, "requirements.md", tracks);
  const drop = inactiveMarkerLines(reqs, tracks);
  const tbd = [];
  // Comments are blanked, not deleted: their newlines stay, so `i` is the real line — the same index `drop` and
  // artifactReport's items use (stripping a multi-line comment shifted every TBD below it). The comments: /<!--[\s\S]*?-->/g
  // by replaceHtmlCommentSpans (1.17 H).
  replaceHtmlCommentSpans(reqs, (m) => m.replace(/[^\r\n]/g, " ")).split(/\r?\n/).forEach((l, i) => { if (!drop.has(i) && /(?<![\p{L}])TBD(?![\p{L}])/u.test(l.slice(0, 2000))) tbd.push({ line: i + 1, text: "TBD" }); });
  const slots = [...active.items, ...tbd].sort((a, b) => a.line - b.line);
  if (slots.length) {
    const shown = slots.slice(0, 8).map((p) => `requirements.md:${p.line} ${p.text.length > 40 ? p.text.slice(0, 39) + "…" : p.text}`);
    if (slots.length > 8) shown.push(fm.gates.more(slots.length - 8));
    add(fm.gates.clarifyPlaceholders("requirements.md", slots.length, shown.join(", ")));
  }
  // missing structural sections (matched EN/PT/ES)
  if (!RE_EDGE_CASES.test(reqs)) add(q.edgeCases);
  if (!RE_OUT_OF_SCOPE.test(reqs)) add(q.outOfScope);
  // A bugfix's requirements (EN/PT/ES template) have no NFR section by design — the fix restores behaviour that already
  // existed — so asking for one kept every filled bugfix at needs-clarification forever. A feature is still asked.
  const bugfix = (readJson(statePath(dir)).data || {}).kind === "bugfix";
  if (!bugfix && !RE_NFR.test(reqs)) add(q.nfr);
  // Unwanted-behaviour criteria: IF…THEN / SE…ENTÃO / SI…ENTONCES (CUANDO is WHEN, not IF) — per CRITERION, so an
  // IF on one line and its THEN on the next (wrapped EARS) count.
  const RE_IF_THEN = /(?<![\p{L}\p{N}_])(IF|SE|SI)(?![\p{L}\p{N}_]).{0,400}?(?<![\p{L}\p{N}_])(THEN|ENTÃO|ENTAO|ENTONCES)(?![\p{L}\p{N}_])/iu;
  if (!criterionBlocks(reqs).blocks.some((b) => RE_IF_THEN.test(b.text))) add(q.unwanted);
  // track-specific
  if (tracks.includes("saas") && !/tenant|inquilino/i.test(reqs)) add(q.tenant);
  if (tracks.includes("saas") && !RE_RATE_LIMIT.test(reqs)) add(q.rateLimit);
  if (tracks.includes("ai") && !/quality|qualidade|calidad|golden|refus/i.test(reqs)) add(q.aiQuality);
  if (tracks.includes("ai") && !/cost|cust[aoe]|custar|coste|token/i.test(reqs)) add(q.aiCost);
  const QP = fm.secPrivacy.clarify;
  if (tracks.includes("sec") && !RE_ACCESS_DENIED.test(reqs)) add(QP.secAccess);
  if (tracks.includes("sec") && !/secret|segredo|secreto|credential|credencia|token/i.test(reqs)) add(QP.secSecrets);
  if (tracks.includes("privacy") && !RE_SUBJECT_RIGHTS.test(reqs)) add(QP.privacyRights);
  if (tracks.includes("privacy") && !/retention|reten[çc][ãa]o|retenci[óo]n|conserva[çc][ãa]o|conservaci[óo]n/i.test(reqs)) add(QP.privacyRetention);
  // 1.17 A2 — the constraint nudge (one question, bounded): the user's text of the spec names queues / events / concurrency /
  // transactions (two concepts, or one strong phrase), and neither requirements.md nor design.md states a consistency model,
  // a delivery guarantee or idempotency (A review 1 / 2 / 7).
  const nudge = constraintNudge(projectDir, dir, reqs, tracks, (readJson(statePath(dir)).data || {}).kind || "feature", featureLang(projectDir, name));
  if (nudge) add(fm.designWeigh.clarifyConsistency(nudge.signals.map((w) => `'${w}'`).join(", ")));
  if (tracks.includes("dist") && !RE_DIST_DELIVERY.test(reqs)) add(QP.distDelivery); // 1.17 D
  if (tracks.includes("dist") && !RE_DIST_FAILURE.test(reqs)) add(QP.distFailure);
  // 1.16 Q3 — the glossary: every word it says to avoid that requirements.md / design.md use (at most 10 questions, then one
  // pointing at doctor). No glossary → nothing asked.
  const gl = glossaryEntries(f.root);
  const gh = glossaryHits(dir, gl, { projectDir, lang: featureLang(projectDir, name) });
  const Q = fm.quality;
  gh.slice(0, 10).forEach((h) => add(Q.glossaryQuestion(h.locations.join(", "), h.word, h.term, h.definition)));
  if (gh.length > 10) add(Q.glossaryMore(gh.length - 10));

  const res = { ok: true, feature: f.slug, tracks: trackLabel(tracks), gapCount: questions.length, questions, verdict: questions.length ? "needs-clarification" : "clear" };
  if (gh.length) res.glossary = gh.map((h) => ({ word: h.word, term: h.term, count: h.count, locations: h.locations })); // 1.16 Q3 (stable)
  if (nudge) res.nudges = [nudge]; // 1.17 A2 (stable): [{ code: "consistency-unstated", signals }]
  // Past GLOSSARY_MAX_ENTRIES entries the rest is never read: said (stable counts + the localized note), never silent.
  if (gl && gl.truncated) Object.assign(res, { glossaryTruncated: { read: gl.entries.length, total: gl.total }, glossaryNote: Q.glossaryTruncated(gl.entries.length, gl.total) });
  return res;
}

module.exports = { XAC_DUPLICATE, XAC_CONFLICT, XAC_TRIGGER, XAC_RESPONSE, XAC_MIN_WORDS, XAC_MAX_CRITERIA,
  XAC_MAX_COMPARISONS, XAC_MAX_PAIRS, XAC_STOP, XAC_MODALS, RE_XAC_SYS_MODAL, RE_XAC_MODAL, XAC_TRIGGER_NEG, RE_XAC_NT,
  RE_XAC_CANNOT, RE_XAC_NEG, RE_XAC_IDS, xacNumber, xacStem, xacWords, RE_XAC_NUM, xacNumbers, acShape, xacClauseSim,
  xacOpposed, acSkeleton, templateShapeTable, builtinTemplateAcs, projectTemplateAcs, jaccard, XAC_FEATURE_CACHE,
  XAC_FEATURE_CACHE_MAX, XAC_RACY_MS, xacStatSig, xacContextSig, xacFeatureRows, xacTable, crossFeatureAcs,
  crossFeatureAcsOf, comparePair, crossAcItem, crossAcDoctorDetail, renderCrossAcsMd, GLOSSARY_FILE,
  GLOSSARY_MAX_ENTRIES, GLOSSARY_MAX_AVOID, GLOSSARY_MAX_HITS, GLOSSARY_BRIEF_MAX, GLOSSARY_BRIEF_CHARS,
  RE_GLOSSARY_ITEM, escRe, foldTerm, glossaryEntries, glossaryEntry, RE_WORD_BEFORE, RE_WORD_AFTER, wordListRe,
  GLOSS_TEMPLATE_LINES, glossLineKey, glossPatternSegs, glossVisibleLines, glossAddLines, glossNewSet,
  glossBuiltinLines, glossProjectLines, glossSpans, glossUserParts, glossaryHits, briefGlossary, TRADEOFFS_SYN,
  RISKS_SYN, DESIGN_WEIGH, DESIGN_WEIGH_IDS, RE_WEIGH_HEADING_REST, weighHeadingMatches, weighSection, genericUnit,
  designBody, designEntries, WEIGH_PROSE_WORDS, designWeighState, designWeighChecks, designApprovedBeforeWeigh,
  RE_RATE_LIMIT, RE_ACCESS_DENIED, RE_SUBJECT_RIGHTS, CONSTRAINT_KINDS, CONSTRAINT_SIGNALS, CONSTRAINT_RE,
  constraintSignalRe, RE_CONSISTENCY_ANSWER, RE_ACID, CONSTRAINT_MAX_WORDS, userSpecText, constraintNudge,
  RE_DIST_DELIVERY, RE_DIST_FAILURE, clarify, __link };
