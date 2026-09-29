"use strict";

/**
 * dev-spec-driven engine — the shared mutable state.
 *
 * ONE object, mutated in place and never re-bound: every module reads and writes CTX.NAME at call time (a destructured copy
 * would go stale). It holds what lives as long as ONE engine call — the read-cache scope that withReadCache (files.js) opens
 * and closes, resetting every field below but BUILTIN_CORPUS_BUILD — and nothing else: a module's own lazy caches stay
 * private `let`s in that module. A new field shared by two modules goes here, with its reset in withReadCache when it is
 * per call.
 */
const CTX = {
  // withReadCache (files.js) — one read per file per engine call; the engine's writers keep it true (forgetCached /
  // invalidateReadCache).
  READ_CACHE: null, // Map(key → text | null | boolean | Dirent[]), only while a withReadCache scope runs
  GLOB_CACHE: null, // Map(key → { base, allowDir, result }) — globFiles results, same scope
  XAC_MEMO: null, // 1.16 Q2: { root, table } — crossFeatureAcs' criteria table, same scope (dropped by any engine write)
  // templates.js — the project's templates as template corpus (placeholder detection)
  TEMPLATE_SCOPE_ROOT: null, // the .specs/ folder of the current engine call (specsRoot), reset per read-cache scope
  TEMPLATE_MEMO: null, // { root, tdirKey, sets } — this call's parsed project templates
  // packs.js — the project's track packs
  PACK_MEMO: null, // { root, dirKey, reg } — the current call's track packs (withReadCache scope)
  GHOST_MARKERS: null, // Map(name → "[TOKEN]") — the missing packs' markers noteGhostPacks records (packs.js), same scope
  // markdown.js — > 0 while templateSets / templateSetsBr build the process-wide built-in corpus: isPackMarkerBracket
  // (packs.js) then never reads a pack marker as stable (not per call: the corpus is built once per process)
  BUILTIN_CORPUS_BUILD: 0,
};

module.exports = { CTX };
