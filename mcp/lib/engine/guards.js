"use strict";

/**
 * dev-spec-driven engine — the edit guard and the end-of-turn evidence gate.
 * Guard mode (meta.guard: on | scope — hooks/guard-hook.js) and the stop gate (hooks/stop-hook.js: a "done" claim
 * with unverified recent ticks is sent back).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let activeTasks, detectTracks, evidenceRecords, existingFeature, expectsFail, featureDirs, featureLang,
  fingerprintMatches, FOLD_CASE, globMatcher, GUARD_CODE_EXT, guessLang, implementsRel, insideDirAlias, isDevSpecDir,
  isDirSafe, isFeatureFolder, isImplementsGlob, isObj, isRecord, isTestFile, loadRoadmap, parseTasks, projectLang,
  readIfExists, readJson, readRoadmap, readState, replaceHtmlCommentSpans, resolveTask, safeReaddir, specsRoot,
  spikeInfo, statePath, suiteLabel, suiteStatus, taskBlocks, taskMarkers, taskSchedule, toPosix, userDefaults,
  verificationStatus, withRoadmapLock, writeRoadmap;
function __link(E) { ({ activeTasks, detectTracks, evidenceRecords, existingFeature, expectsFail, featureDirs,
  featureLang, fingerprintMatches, FOLD_CASE, globMatcher, GUARD_CODE_EXT, guessLang, implementsRel, insideDirAlias,
  isDevSpecDir, isDirSafe, isFeatureFolder, isImplementsGlob, isObj, isRecord, isTestFile, loadRoadmap, parseTasks,
  projectLang, readIfExists, readJson, readRoadmap, readState, replaceHtmlCommentSpans, resolveTask, safeReaddir,
  specsRoot, spikeInfo, statePath, suiteLabel, suiteStatus, taskBlocks, taskMarkers, taskSchedule, toPosix,
  userDefaults, verificationStatus, withRoadmapLock, writeRoadmap } = E); }

// roadmap.json meta.guard — the opt-in guard mode read by hooks/guard-hook.js (PreToolUse): true, or "scope" (1.14 C1 — the
// stricter level, guardLevel()).
function guardEnabled(projectDir) {
  return guardLevel(projectDir) !== false;
}

// The guard's decision for ONE code edit (hooks/guard-hook.js). Cheap by design — it runs before every Write/Edit
// while the guard is on: roadmap.json plus each feature's .state.json and tasks.md, never a repo walk.
//   allow: guard off · the file is outside the project · inside .specs/ · not code (GUARD_CODE_EXT: the scanner's CODE_EXT
//          plus the source languages it doesn't inventory — C++ .cc/.hpp, .mts/.cts, Scala, Dart, Elixir, shell and
//          Windows batch, SQL, Kotlin script, CUDA, Fortran, shaders, code-bearing templates…;
//          notebooks count as code — NotebookEdit only edits them. Docs, config, markup and styles are not code) ·
//          some non-archived feature has an approved tasks phase and open
//          tasks (a FORCED approval still counts, with a `note` saying so) · an active spike — undecided or with open tasks, its
//          timebox not passed; never at the scope level once tasks are approved —
//          (why "spike": its prototype work; a spike has no tasks gate, so it is never "awaiting approval") · a TEST file while
//          a feature has an approved test plan and is unfinished (why "tests-phase": Phase 4 writes the failing tests before
//          the tasks can be approved);
//   ask:   otherwise, with a localized `reason` (project language).
// An approval covers only the tasks.md it signed off: when it carries a fingerprint and tasks.md no longer matches
// it (tasks appended or edited after approval — ticking boxes is not an edit), the feature is `stale`, not covering:
// "an approved spec that changed is not approved". An approval without a fingerprint (older state) still counts.
// meta.guard "scope" (1.14 C1): once tasks are approved, a code file must also be in the plan — scopeGuardDecision.
function guardCheck(projectDir, filePath, cwd) {
  const pdir = path.resolve(projectDir);
  const level = guardLevel(pdir);
  if (!level) return { guard: false, decision: "allow", why: "off" };
  const G = i18n.msg(projectLang(pdir)).guardMode;
  const allow = (why, extra) => Object.assign({ guard: true, decision: "allow", why }, extra);
  if (typeof filePath !== "string" || !filePath.trim()) return allow("no-file");
  // Inside the project as text or through an alias of it (8.3 short name, junction, symlink — they were "outside" and
  // allowed), spelled under pdir from here on.
  const abs = insideDirAlias(pdir, path.resolve(cwd ? path.resolve(pdir, cwd) : pdir, filePath));
  if (!abs) return allow("outside");
  // Case-folded where the filesystem folds case: `.SPECS/x.ts` IS the spec folder on Windows/macOS.
  if (toPosix(path.relative(pdir, abs)).split("/").some((s) => (FOLD_CASE ? s.toLowerCase() : s) === ".specs")) return allow("specs");
  const ext = path.extname(abs).toLowerCase();
  if (!GUARD_CODE_EXT.has(ext)) return allow("not-code");
  const root = specsRoot(pdir);
  const covering = [], forced = [], pending = [], stale = [], spikes = [], testing = [];
  const texts = new Map(); // feature → tasks.md (the scope level reads its open tasks' _Implements:_)
  for (const name of safeReaddir(root).sort()) {
    if (!isFeatureFolder(name, root)) continue; // _archive, steering, dot folders are not features
    const dir = path.join(root, name);
    const st = readJson(statePath(dir)).data;
    const approvals = isObj(st) && isObj(st.approvals) ? st.approvals : {};
    const tasksText = readIfExists(path.join(dir, "tasks.md"));
    const tasks = tasksText == null ? [] : parseTasks(activeTasks(tasksText, detectTracks(dir)));
    const unfinished = !tasks.length || tasks.some((t) => !t.done);
    // A spike has no tasks gate (question → investigate → decide): while it is undecided or has open investigation tasks its
    // prototype work is covered — never listed as "awaiting approval" (approve refuses a spike's tasks phase).
    // Not once its timebox has passed undecided: an abandoned spike must not switch the guard off for the whole project.
    if (isObj(st) && st.kind === "spike") {
      const si = spikeInfo(dir);
      if ((tasks.some((t) => !t.done) || !si.decisionFilled) && !si.timeboxPassed) spikes.push(name);
      continue;
    }
    // Phase 4 (+tdd): an approved test plan, the feature not finished — the failing tests are written BEFORE the tasks can be
    // approved (next_action refuses the tasks approval until the tests gate passes), so test files are covered then.
    if (approvals["test-plan"] && unfinished) testing.push(name);
    if (tasksText == null || !tasks.some((t) => !t.done)) continue; // complete (or no tasks)
    texts.set(name, tasksText);
    const ap = approvals.tasks || null;
    if (!ap) pending.push(name);
    else if (isObj(ap) && typeof ap.fingerprint === "string" && ap.fingerprint && !fingerprintMatches(tasksText, "tasks", ap.fingerprint)) stale.push(name);
    else if (isObj(ap) && ap.forced) forced.push(name);
    else covering.push(name);
  }
  // scope: the plan is every approved feature's open tasks (a forced approval's too — noted when it is the only cover, as below).
  if (level === "scope" && (covering.length || forced.length)) {
    // A spike never overrides the approved features' plan here: scope's point is that code outside it asks.
    return scopeGuardDecision(pdir, abs, covering.concat(forced), texts, allow, covering.length ? {} : { forced, note: G.forced(forced.join(", ")) });
  }
  if (covering.length) return allow("approved", { covering });
  if (forced.length) return allow("forced", { covering: forced, forced, note: G.forced(forced.join(", ")) });
  if (spikes.length) return allow("spike", { covering: spikes, spikes });
  if (testing.length && isTestFile(toPosix(path.relative(pdir, abs)))) return allow("tests-phase", { covering: testing });
  const list = (xs) => xs.slice(0, 3).join(", ") + (xs.length > 3 ? ", …" : "");
  return { guard: true, decision: "ask", why: "no-approved-tasks", pending, stale, reason: G.ask(list(pending), list(stale)) };
}

// roadmap.json meta.guard ← on (spec_init {guard} / `dev-spec init --guard on|off`). No write when unchanged.
function setGuard(projectDir, on) {
  return withRoadmapLock(projectDir, () => {
    const rm = readRoadmap(projectDir);
    if (isObj(rm.meta) && rm.meta.guard === on) return { ok: true };
    rm.meta = isObj(rm.meta) ? rm.meta : {};
    rm.meta.guard = on;
    writeRoadmap(projectDir, rm);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// 1.14 C1 — "evidence before claims" at the END OF A TURN (hooks/stop-hook.js on Stop / SubagentStop; `dev-spec stop-check`)
// and the scope guard (roadmap.json meta.guard = "scope": a code edit no open task plans in _Implements:_ asks).
// ---------------------------------------------------------------------------

const STOP_RECENT_HOURS = 4; // "recently active": a task ticked, evidence recorded or tasks.md edited within these hours
const STOP_MESSAGE_MAX = 20000; // the message's LAST characters are read (the claim sits in the closing lines)
const STOP_MAX_FEATURES = 50; // feature folders looked at, at most (bounded: the hook runs at the end of every turn)
const STOP_TASKS_SHOWN = 8; // task numbers listed per feature in the reason
const STOP_REPORT_MAX = 256 * 1024; // bytes of an implementer's report read
const STOP_WINDOW = 3; // words before a claim, in its sentence, looked at for a negator / condition

// roadmap.json meta.guard → false | true | "scope" (anything else: off); unset → the user's GUARD_DEFAULT (1.16 C2), else off.
// The user's default applies to a dev-spec project only (isDevSpecDir): roadmap.json without meta.guard, or no roadmap.json in a
// .specs/ dev-spec owns (steering/ or a feature folder with its .state.json — a project made before roadmap.json) — never a folder
// without one, nor another tool's .specs/. A roadmap.json that exists but doesn't parse: off (the guard never acts on a file it
// can't read). hooks/guard-hook.js reads the same values raw, with the same rule.
function guardLevel(projectDir) {
  const l = loadRoadmap(projectDir);
  if (l.parseError) return false;
  const g = isObj(l.rm.meta) ? l.rm.meta.guard : undefined;
  if (g === undefined) {
    const d = userDefaults().guard;
    return (d === true || d === "scope") && isDevSpecDir(path.resolve(projectDir)) ? d : false;
  }
  return g === true ? true : g === "scope" ? "scope" : false;
}
// spec_init {guard} / `init --guard`: true | "on" → true, false | "off" → false, "scope" → "scope" (strings case-insensitive);
// anything else → undefined (unchanged).
function guardInput(v) {
  if (v === true || v === false) return v;
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s === "on" ? true : s === "off" ? false : s === "scope" ? "scope" : undefined;
}
// roadmap.json meta.stopCheck — the evidence gate is ON unless it is exactly false (spec_init {stopCheck} / `init --stop-check`);
// not a boolean (unset) → the user's STOP_CHECK option (1.16 C2), else on. An unreadable roadmap.json: the user's option too, else
// on (the gate itself never blocks on a file it can't read) — DEV_SPEC_STOP_CHECK=off was ignored while the file didn't parse.
function stopCheckEnabled(projectDir) {
  const l = loadRoadmap(projectDir);
  if (l.parseError) return userDefaults().stopCheck !== false;
  const v = isObj(l.rm.meta) ? l.rm.meta.stopCheck : undefined;
  if (typeof v === "boolean") return v;
  return userDefaults().stopCheck !== false;
}
// Inside initProject's roadmap lock. ON is the default (absent = on): no write when the effective value doesn't change — with or
// without the user's STOP_CHECK option (an explicit on / off where that option decides pins it for the project).
function setStopCheck(projectDir, on) {
  const rm = readRoadmap(projectDir);
  rm.meta = isObj(rm.meta) ? rm.meta : {};
  if (rm.meta.stopCheck === on) return;
  if (rm.meta.stopCheck === undefined && on === true && userDefaults().stopCheck !== false) return;
  rm.meta.stopCheck = on;
  writeRoadmap(projectDir, rm);
}

// The claim patterns of every language (i18n stopGate.claims / negators / admissions / fixed), compiled once: whole words
// (unicode boundaries — JS \b never matched "concluído"), case-insensitive, ^/$ per line. Each claim pattern keeps the base
// languages that list it (pt-BR is pt): the two negators the languages disagree on are read by language (stopNegates).
let STOP_PATTERNS = null;
function stopPatterns() {
  if (STOP_PATTERNS) return STOP_PATTERNS;
  const word = (src) => new RegExp("(?<![\\p{L}\\p{N}_])(?:" + src + ")(?![\\p{L}\\p{N}_])", "gimu");
  const all = (k) => [...new Set(i18n.LANGS.flatMap((l) => (i18n.msg(l).stopGate || {})[k] || []))]; // pt-BR repeats pt's patterns
  const langsOf = new Map();
  for (const l of i18n.LANGS) for (const src of (i18n.msg(l).stopGate || {}).claims || []) {
    if (!langsOf.has(src)) langsOf.set(src, new Set());
    langsOf.get(src).add(i18n.baseLang(l));
  }
  STOP_PATTERNS = {
    claims: [...langsOf].map(([src, langs]) => ({ re: word(src), langs })),
    admissions: all("admissions").map(word),
    negators: new Set(all("negators").map((w) => w.toLowerCase())),
    fixed: new Set(all("fixed").map((w) => w.toLowerCase())),
  };
  return STOP_PATTERNS;
}
// Where the clause holding position `i` starts: after the last line / sentence break, or a colon or a dash ("No problem — task
// 2 is done": the "no" belongs to another clause). → the index of the break (−1: the text's start)
// Only the few words before i matter (STOP_WINDOW / 4): the look-back is bounded, so every hit costs O(1) — slicing the whole
// text before each hit made a long message of admissions quadratic (20 KB of "was 2 failing": half a second).
const STOP_CLAUSE_SPAN = 400;
function stopClauseStart(text, i) {
  const lo = Math.max(0, i - STOP_CLAUSE_SPAN);
  const before = text.slice(lo, i);
  const k = Math.max(...["\n", ".", "!", "?", ";", ":", "—", "–", " - "].map((c) => before.lastIndexOf(c)));
  return k < 0 ? lo - 1 : lo + k;
}
// ES "no" before a verb, a clitic or "todo" is a negation ("no está terminado", "no se ha completado", "no todo está hecho");
// PT "no" (em + o) comes before a noun ("a correção no módulo").
const RE_ES_NO_NEXT = /^(?:est[áa]n?|estaba|estaban|es|son|era|eran|fue|fueron|ha|han|he|hemos|has|había|habían|hay|se|lo|la|los|las|le|les|me|te|nos|queda|quedan|quedó|quedaron|funciona|funcionan|pasa|pasan|puede|pueden|tiene|tienen|debe|deben|todo|todos|todas|del|todavía|aún)$/u;
// ES reflexive "se" before an auxiliary or a preterite ("se ha completado", "se han implementado", "se completó") — PT "se" (if)
// is never followed by those (PT writes "há", with the accent).
const RE_ES_SE_NEXT = /^(?:ha|han|has|he|hemos|había|habían|hubo|fue|fueron|queda|quedan|quedó|quedaron|\p{L}{3,}ó|\p{L}{3,}(?:aron|ieron))$/u;
// Is words[i] a negator for a claim that reads as `langs` (its pattern's languages and those of any other pattern matching at the
// same place — "está terminado" is PT and ES) in a message guessed as `lang`? Pooled across languages, except the two words they
// disagree on: "no" (EN / ES: not; PT: em + o) and "se" (PT: if; ES: the reflexive pronoun).
function stopNegates(words, i, langs, lang) {
  const w = words[i];
  if (/n['’]t$/.test(w) || /['’]ll$/.test(w)) return true;
  if (!stopPatterns().negators.has(w)) return false;
  const next = words[i + 1] || "";
  if (w === "no") return lang !== "pt" && (langs.has("en") || (langs.has("es") && (i === words.length - 2 || RE_ES_NO_NEXT.test(next))));
  if (w === "se") return lang !== "es" && langs.has("pt") && !RE_ES_SE_NEXT.test(next);
  return true;
}
// Does a failure the message names (an admission at [start, end)) describe what was already FIXED — "I fixed the 2 failing
// tests", "Previously 4 tests failed", "the 3 failures from yesterday are fixed"? A fixed-word (i18n stopGate.fixed: fixing
// verbs and "previously" — never an auxiliary like "was" / "had", which any honest "2 tests failed and I was unable to fix
// them" holds) among the 4 words before it in its clause, or the 4 words after it before the clause ends — and no negator
// anywhere in that window ("I haven't fixed the 2 failing tests", "the 3 failing tests were not fixed").
function stopPastFailure(text, start, end, wordsOf) {
  const P = stopPatterns();
  const neg = (w) => P.negators.has(w) || /n['’]t$/.test(w);
  const before = wordsOf(text.slice(stopClauseStart(text, start) + 1, start)).slice(-4).map((w) => w.toLowerCase());
  const after = wordsOf((text.slice(end, end + STOP_CLAUSE_SPAN).match(/^[^\n.!?;:,—–]*/) || [""])[0]).slice(0, 4).map((w) => w.toLowerCase());
  const fixedIn = (ws) => ws.some((w) => P.fixed.has(w)) && !ws.some(neg);
  return fixedIn(before) || fixedIn(after);
}
// The message as prose: its last STOP_MESSAGE_MAX characters without fenced code, inline code, HTML comments and quoted
// lines (> …) — a pasted command output or a quoted instruction claims nothing.
function stopProse(message) {
  const s = String(message == null ? "" : message).replace(/\r\n?/g, "\n");
  // (?=(…))\2: the fence opener taken whole, never backtracked (a line of 20,000 backticks was quadratic — 1.17 H); the
  // comments by replaceHtmlCommentSpans (/<!--[\s\S]*?-->/g rescanned the rest from each unclosed "<!--").
  const unfenced = s.slice(-STOP_MESSAGE_MAX).replace(/(^|\n)[ \t]*(?=(`{3,}|~{3,}))\2[^\n]*\n[\s\S]*?(?:\n[ \t]*\2[^\n]*(?=\n|$)|$)/g, "$1");
  return replaceHtmlCommentSpans(unfenced, () => " ")
    .replace(/`[^`\n]*`/g, " ")
    .split("\n").filter((l) => !/^[ \t]*>/.test(l)).join("\n");
}
// Does the message claim the work is done / verified? → { claim, admitted, claims: [matched text] }. A match does not count
// when a negator or condition sits up to STOP_WINDOW words before it in the same clause ("not done", "once the tests
// pass", "I'll verify"; words ending in n't / 'll too; a colon or a dash starts a new clause; "no" / "se" read by language —
// stopNegates), nor when its sentence is a question. `admitted`: the message says plainly that something is NOT verified or
// fails ("task 3 is not verified", "2 failing") — the honest answer is never sent back — unless that failure is one already
// fixed ("I fixed the 2 failing tests", stopPastFailure).
function stopClaims(message) {
  const P = stopPatterns();
  const text = stopProse(message);
  const lang = guessLang(text); // decides "no" (a PT text: em + o) and "se" (an ES text: reflexive) — see stopNegates
  const found = [];
  const wordsOf = (s) => s.split(/[^\p{L}\p{N}_'’]+/u).filter(Boolean);
  const hits = [];
  for (const c of P.claims) {
    c.re.lastIndex = 0;
    let m;
    while ((m = c.re.exec(text)) !== null) {
      if (m[0] === "") { c.re.lastIndex++; continue; }
      hits.push({ start: m.index, end: m.index + m[0].length, text: m[0], langs: c.langs });
    }
  }
  const langsAt = new Map(); // the languages every claim starting at an index reads as
  for (const h of hits) { const s = langsAt.get(h.start) || new Set(); h.langs.forEach((l) => s.add(l)); langsAt.set(h.start, s); }
  for (const h of hits) {
    // The words before it in its clause, and the claim's own first word ("Nothing is done", "None of the tests pass" match
    // from their subject on).
    const words = wordsOf(text.slice(stopClauseStart(text, h.start) + 1, h.start)).slice(-STOP_WINDOW).concat(wordsOf(h.text).slice(0, 1)).map((w) => w.toLowerCase());
    if (words.some((w, i) => stopNegates(words, i, langsAt.get(h.start), lang))) continue;
    const tail = text.slice(h.end, h.end + 2000).match(/^[^\n.!?]*([.!?]?)/); // bounded: a sentence ends well before that
    if (tail && tail[1] === "?") continue; // a question claims nothing
    if (found.length < 10) found.push(h.text.trim());
  }
  // An admission counts unless it names a failure already fixed ("I fixed the 2 failing tests", "Previously 4 tests failed").
  const admitted = P.admissions.some((re) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0] === "") { re.lastIndex++; continue; }
      if (!stopPastFailure(text, m.index, m.index + m[0].length, wordsOf)) return true;
    }
    return false;
  });
  return { claim: found.length > 0, admitted, claims: [...new Set(found)] };
}
// The feature's last activity (ms, or null): lastTickAt, every ticks[n], every evidence record's run / note time (history and
// the records kept aside under `others` included) — only what the engine RECORDED. Never a file date: a fresh clone stamps
// every tasks.md "now", and a repo someone else wrote then made the gate fire on unrelated work and hand the agent that repo's
// _Verify:_ commands. A stamp in the future (a committed .state.json can hold any date) is ignored.
function stopActivity(state) {
  let best = null;
  const horizon = Date.now() + 5 * 60 * 1000; // clock skew tolerated
  const see = (v) => { const t = typeof v === "string" ? Date.parse(v) : NaN; if (Number.isFinite(t) && t <= horizon && (best == null || t > best)) best = t; };
  see(state.lastTickAt);
  if (isRecord(state.ticks)) Object.values(state.ticks).forEach(see);
  for (const slot of Object.values(isRecord(state.evidence) ? state.evidence : {})) {
    for (const r of evidenceRecords(slot)) {
      see(r.at);
      see(r.noteAt);
      (Array.isArray(r.history) ? r.history : []).forEach((h) => { if (isRecord(h)) see(h.at); });
    }
  }
  return best;
}
// One unverified task as the reason lists it: "#3 (latest run failed)".
function stopTaskLabel(d, lng) {
  const M = i18n.msg(lng);
  const why = d.specChanged ? M.impact.staleSpec : d.unticked ? M.undo.label : M.evidenceGate.reason[d.reason] || d.reason;
  return "#" + d.number + ` (${why})`;
}
// The evidence gate at the end of a turn — hooks/stop-hook.js (Stop / SubagentStop) and `dev-spec stop-check`. It sends the
// turn back ({block: true, reason}) ONLY when (a) the message claims the work is done or verified (stopClaims — conservative;
// never when it says plainly what is not verified) AND (b) a feature active in the last STOP_RECENT_HOURS has ticked tasks
// verificationStatus reports unverified (a failed run, a note on a runnable _Verify:_, stale evidence, an unexpected pass,
// no evidence for a runnable _Verify:_…) or, every active task done, project checks without a passing run since the last
// task activity (suiteStatus). opts: { message, agent (the subagent type — a spec-implementer is checked on its REPORT: it
// never ticks tasks), stopHookActive (the hook already sent this stop back once: never twice in a row) }. The reason is in
// the project language (an implementer's: its feature's). Read-only and bounded; a feature whose .state.json is unreadable
// is skipped — the gate never blocks on its own trouble.
// → { ok, block, why, lang, claims, features: [{feature, unverified: [{number, reason}], suite: [{name, status}]}], reason? }
function stopCheck(projectDir, opts = {}) {
  const pdir = path.resolve(projectDir);
  const lng = projectLang(pdir);
  const res = (block, why, extra) => Object.assign({ ok: true, block, why, lang: lng, claims: [], features: [] }, extra);
  if (opts.stopHookActive === true) return res(false, "stop-hook-active");
  const root = specsRoot(pdir);
  if (!isDirSafe(root)) return res(false, "no-specs");
  if (!stopCheckEnabled(pdir)) return res(false, "off");
  const cl = stopClaims(opts.message);
  const agent = typeof opts.agent === "string" ? opts.agent.trim() : "";
  if (agent && /(?:^|:)spec-implementer$/i.test(agent)) return implementerStopCheck(pdir, String(opts.message == null ? "" : opts.message), cl, res);
  if (!cl.claim) return res(false, "no-claim");
  if (cl.admitted) return res(false, "admitted", { claims: cl.claims });
  const since = Date.now() - STOP_RECENT_HOURS * 3600 * 1000;
  const features = [];
  const clean = [];
  for (const f of featureDirs(pdir).filter((x) => !x.archived).slice(0, STOP_MAX_FEATURES)) {
    const tasksFile = path.join(f.dir, "tasks.md");
    const state = readState(pdir, f.slug);
    if (state.invalid) continue; // unreadable state: never block on it (doctor reports it)
    const last = stopActivity(state);
    if (last == null || last < since) continue;
    const tracks = detectTracks(f.dir);
    const blocks = taskBlocks(activeTasks(readIfExists(tasksFile) || "", tracks) || "");
    const vs = verificationStatus(pdir, f.slug, f.dir);
    // A spike has no project-check gate anywhere (spec_finish, doctor and next_action close it on its decision): never here either.
    const suite = state.kind !== "spike" && blocks.length && blocks.every((b) => b.done) ? suiteStatus(pdir, state, f.dir).missing : [];
    if (!vs.unverifiedDetail.length && !suite.length) { clean.push(f.slug); continue; }
    features.push({ feature: f.slug, unverified: vs.unverifiedDetail, suite });
  }
  if (!features.length) return res(false, clean.length ? "verified" : "no-recent", { claims: cl.claims, verifiedFeatures: clean });
  const S = i18n.msg(lng).stopGate;
  // The head says what is missing: ticked tasks without evidence, or — when only project checks are listed — the checks' runs.
  const lines = [features.some((f) => f.unverified.length) ? S.head : S.headSuite];
  for (const f of features) {
    if (f.unverified.length) {
      const shown = f.unverified.slice(0, STOP_TASKS_SHOWN).map((d) => stopTaskLabel(d, lng));
      lines.push(S.taskLine(f.feature, shown.join(", ") + (f.unverified.length > shown.length ? ", " + S.more(f.unverified.length - shown.length) : "")));
    }
    if (f.suite.length) lines.push(S.suiteLine(f.feature, suiteLabel(f.suite, lng)));
  }
  const firstTasks = features.find((f) => f.unverified.length);
  if (firstTasks) lines.push(S.todoTasks(firstTasks.feature, firstTasks.unverified[0].number));
  const firstSuite = features.find((f) => f.suite.length);
  if (firstSuite) lines.push(S.todoSuite(firstSuite.feature));
  lines.push(S.plainly);
  return res(true, "unverified", {
    claims: cl.claims,
    features: features.map((f) => ({ feature: f.feature, unverified: f.unverified.map((d) => ({ number: d.number, reason: d.reason, ...(d.specChanged ? { specChanged: true } : {}), ...(d.unticked ? { unticked: true } : {}) })),
      suite: f.suite.map((s) => ({ name: s.name, status: s.status })) })),
    reason: lines.join("\n"),
  });
}
// A spec-implementer's stop (SubagentStop): it never ticks tasks (the controller does, after review), so its gate is its
// REPORT — reporting DONE (or DONE_WITH_CONCERNS) for a task whose _Verify:_ holds a runnable command needs the report file
// (.specs/<feature>/.execution/task-N-report.md, named in the reply as the protocol asks) to carry each command and an exit
// code. BLOCKED / NEEDS_CONTEXT, no report path in the reply, or no runnable _Verify:_ → allowed.
function implementerStopCheck(pdir, message, cl, res) {
  if (/(?<![\p{L}_])status\W{0,8}(?:blocked|needs_context)(?![\p{L}_])/iu.test(stopProse(message))) return res(false, "not-done");
  if (!cl.claim) return res(false, "no-claim");
  const m = message.slice(-STOP_MESSAGE_MAX).match(/\.specs[\\/]+([^\\/\s`'"()<>]+)[\\/]+\.execution[\\/]+task-(\d+)-(?:report|brief)\.md/i);
  if (!m) return res(false, "no-task", { claims: cl.claims });
  const f = existingFeature(pdir, m[1]);
  if (!f.ok) return res(false, "no-task", { claims: cl.claims });
  const lng = featureLang(pdir, f.slug);
  const n = parseInt(m[2], 10);
  const task = resolveTask(taskBlocks(readIfExists(path.join(f.dir, "tasks.md")) || ""), n);
  const verify = task ? taskMarkers(task).verify : [];
  const info = { claims: cl.claims, lang: lng, feature: f.slug, task: n };
  if (!verify.length) return res(false, "nothing-to-verify", info);
  const file = path.join(f.dir, ".execution", `task-${n}-report.md`);
  const rel = toPosix(path.relative(pdir, file));
  let report = null;
  try {
    const fd = fs.openSync(file, "r");
    try {
      const buf = Buffer.alloc(Math.min(STOP_REPORT_MAX, fs.fstatSync(fd).size));
      report = buf.toString("utf8", 0, fs.readSync(fd, buf, 0, buf.length, 0));
    } finally { fs.closeSync(fd); }
  } catch { report = null; }
  const X = i18n.msg(lng).stopGate.implementer;
  const flat = (s) => s.replace(/`/g, "").replace(/\s+/g, " ").trim();
  let problem = null;
  if (report == null) problem = X.noReport(rel);
  else {
    const body = flat(report);
    // "exit 0", "exit code: 1", "exitCode 0", "exited with code 0", "exit status 2", PT "código de saída 0", ES "código de salida 0"
    const codes = [...body.matchAll(/(?<![\p{L}_])(?:exit(?:ed)?(?:\s+with)?(?:[\s_-]*(?:code|status))?|c[óo]digo\s+de\s+(?:sa[íi]da|salida))\W{0,4}(-?\d+)/giu)].map((x) => parseInt(x[1], 10));
    const missing = verify.filter((c) => !body.includes(flat(c)));
    const cmds = (missing.length ? missing : verify).map((c) => "`" + c + "`").join(", ");
    if (missing.length || !codes.length) problem = X.noRun(rel, cmds);
    // full review Ga5: the exit code must be the one the task needs — a must-pass _Verify:_ an exit 0 ("Status: DONE … exit
    // code: 1" was allowed), an _Expect: fail_ one a non-zero exit (its red run). A +tdd report may show the red run and then
    // the green one: any matching code counts.
    else if (expectsFail(task) ? !codes.some((c) => c !== 0) : !codes.includes(0)) problem = (expectsFail(task) ? X.notFailing : X.notPassing)(rel, cmds);
  }
  if (!problem) return res(false, "report-ok", info);
  return res(true, "implementer-evidence", { ...info, report: rel, reason: [X.head(n, f.slug) + " " + problem, X.todo].join("\n") });
}

// The scope guard's decision for a code file once some feature has approved, unfinished tasks (guardCheck, level "scope"):
// allowed when an OPEN task of one of those features names it in _Implements:_ — the file itself (implementsKey: anchors,
// backticks, ./ and case where the file system folds it dropped), a folder above it, or a glob matching it — and for a test
// file (tests are planned by T-ID in test-plan.md, not in _Implements:_); otherwise "ask", naming the likely task: one that
// plans a file in the same folder, else the nearest folder, else the next open task. Text reads only.
function scopeGuardDecision(pdir, abs, features, texts, allow, extra) {
  const rel = toPosix(path.relative(pdir, abs));
  const fold = (s) => (FOLD_CASE ? s.toLowerCase() : s);
  const key = fold(rel);
  if (isTestFile(rel)) return allow("test-file", { level: "scope", covering: features, ...extra });
  const usable = (k) => !!k && k !== "." && !/^\[.*\]$/.test(k) && !/^(?:tbd|todo|n\/?a|none|-+|…|\.{3})$/i.test(k) && !k.split("/").includes("..");
  const open = [];
  let scheduled = null; // 1.14 F3: the first feature's next task by next_task's rule (_Depends:_ all done)
  for (const name of features) {
    const dir = path.join(specsRoot(pdir), name);
    const blocks = taskBlocks(activeTasks(texts.get(name) || "", detectTracks(dir)) || "");
    const sn = scheduled ? null : taskSchedule(blocks).next;
    if (sn) scheduled = { feature: name, number: sn.number };
    for (const b of blocks) {
      if (b.done) continue;
      const refs = [];
      for (const ref of taskMarkers(b).implements) {
        let r = implementsRel(ref);
        if (path.isAbsolute(r)) { const a = insideDirAlias(pdir, path.resolve(r)); r = a ? toPosix(path.relative(pdir, a)) : ""; } // an alias of the project counts
        if (usable(r)) refs.push({ rel: r, key: fold(r), glob: isImplementsGlob(r) });
      }
      open.push({ feature: name, number: b.number, refs });
    }
  }
  const covers = (r) => (r.glob ? globMatcher(r.key)(key) : r.key === key || key.startsWith(r.key + "/"));
  const hit = open.find((t) => t.refs.some(covers));
  if (hit) return allow("in-scope", { level: "scope", covering: features, task: { feature: hit.feature, number: hit.number }, ...extra });
  // The likely task: a planned file (or a glob's literal folders) in the same folder, else the longest shared folder prefix.
  const globBase = (k) => { const parts = k.split("/"), lit = []; for (let i = 0; i < parts.length - 1 && !/[*?{]/.test(parts[i]); i++) lit.push(parts[i]); return lit.join("/") || "."; };
  const folderOf = (r) => (r.glob ? globBase(r.key) : path.posix.dirname(r.key));
  const fileDir = path.posix.dirname(key);
  const shared = (a) => { const x = a === "." ? [] : a.split("/"), y = fileDir === "." ? [] : fileDir.split("/"); let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i; };
  let likely = null;
  for (const t of open) {
    for (const r of t.refs) {
      const d = folderOf(r);
      const score = d === fileDir ? Infinity : shared(d);
      if (score > 0 && (!likely || score > likely.score)) likely = { t, r, score };
    }
  }
  const S = i18n.msg(projectLang(pdir)).scopeGuard;
  const next = (scheduled && open.find((t) => t.feature === scheduled.feature && t.number === scheduled.number)) || open[0] || null;
  const hint = likely ? S.hint[likely.score === Infinity ? "same-folder" : "nearby"](likely.t.number, likely.t.feature, likely.r.rel)
    : next ? S.hint.next(next.number, next.feature) : "";
  const pick = likely ? likely.t : next;
  const list = (xs) => xs.slice(0, 3).join(", ") + (xs.length > 3 ? ", …" : "");
  return { guard: true, level: "scope", decision: "ask", why: "out-of-scope", file: rel, covering: features,
    ...(pick ? { likely: { feature: pick.feature, number: pick.number, via: likely ? (likely.score === Infinity ? "same-folder" : "nearby") : "next" } } : {}),
    ...(extra.forced ? { forced: extra.forced } : {}),
    reason: S.ask(rel, list(features), hint).replace(/ {2,}/g, " ") + (extra.note ? " " + extra.note : "") };
}

module.exports = { guardEnabled, guardCheck, setGuard, STOP_RECENT_HOURS, STOP_MESSAGE_MAX, STOP_MAX_FEATURES,
  STOP_TASKS_SHOWN, STOP_REPORT_MAX, STOP_WINDOW, guardLevel, guardInput, stopCheckEnabled, setStopCheck, stopPatterns,
  STOP_CLAUSE_SPAN, stopClauseStart, RE_ES_NO_NEXT, RE_ES_SE_NEXT, stopNegates, stopPastFailure, stopProse, stopClaims,
  stopActivity, stopTaskLabel, stopCheck, implementerStopCheck, scopeGuardDecision, __link };
