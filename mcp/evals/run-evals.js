#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — local eval harness (zero-dependency).
 *
 * Runs a feature's golden / adversarial / regression sets against a model using YOUR OWN
 * API key (env ANTHROPIC_API_KEY). No CI, no third party beyond your chosen model provider.
 * Without a key (or with --dry-run) it validates the sets and prints the plan, calling nothing.
 * Validation (dry AND live, before any model call): each set parses, `items` is an array, every item is
 * { id, input, expect: { type: contains|equals|regex|refuse|judge, value (contains/equals/regex; a regex that
 * compiles) | rubric (judge) } }, and evals/thresholds.json (when present) gives each set a number in [0, 1].
 *
 * Usage (from the project root):
 *   node <plugin>/mcp/evals/run-evals.js <feature-slug> [flags]
 *
 * Flags:
 *   --dry-run            validate + print plan, do not call the model
 *   --set-baseline       write the current scores to evals/baseline.json
 *   --model=<id>         override model (default: $DEV_SPEC_MODEL or claude-sonnet-5)
 *   --require-live       fail (exit 2) instead of silently dry-running when ANTHROPIC_API_KEY is unset
 *   --project=<dir>      project root (default: $SPEC_PROJECT_DIR / $CLAUDE_PROJECT_DIR / cwd — same as the CLI)
 *   --prompt=<file>      prompt file under prompts/ (default: latest vN.md)
 *   --max-items=<N>      grade at most N items per set (an integer >= 1; default 200) — anything else exits 2
 *   Switches (--dry-run, --set-baseline, --require-live) follow the CLI's rule: --flag, or --flag=true|false
 *   (1/0, yes/no, on/off); any other value exits 2.
 *
 * Exit code: 0 normally; 1 if a set falls below its threshold (real run only) or a set / thresholds.json
 * is invalid (dry or live — then no model is called; a set with no items is invalid too: it can't pass what it never
 * graded) — handy for a manual pre-push gate. 2 for a usage error (no feature, a bad --max-items or switch value,
 * --require-live without a key).
 * Thresholds: evals/thresholds.json or defaults (golden 0.85, adversarial 1.0, regression 1.0).
 */

const fs = require("fs");
const path = require("path");
const spec = require(path.join(__dirname, "..", "lib", "spec.js"));

const DEFAULT_MODEL = process.env.DEV_SPEC_MODEL || "claude-sonnet-5";
const DEFAULT_THRESHOLDS = { golden: 0.85, adversarial: 1.0, regression: 1.0 };
// Human output, localized: the project's language until the feature is resolved, then the feature's.
let T = spec.msg("en").evals;

// Flags that take a value, accepted as either --key=value or --key value (the universal CLI
// forwards them space-separated, e.g. `--project <dir>`).
const VALUE_FLAGS = new Set(["project", "model", "prompt", "max-items"]);
function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const eq = a.indexOf("=");
    if (eq !== -1) { out.flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const key = a.slice(2);
    if (VALUE_FLAGS.has(key) && i + 1 < argv.length && !argv[i + 1].startsWith("--")) out.flags[key] = argv[++i];
    else out.flags[key] = true;
  }
  return out;
}

// Boolean switches — the CLI's rule (normalizeBoolFlags): `--x` is true, `--x=true|false` (also 1/0, yes/no, on/off) sets
// it explicitly, any other `=value` is a usage error. They are read with `=== true`, never by truthiness: the string
// "false" is truthy, so `--set-baseline=false` overwrote evals/baseline.json and `--dry-run=false` dry-ran.
const BOOL_FLAGS = ["dry-run", "set-baseline", "require-live"];
function badBoolFlag(flags) {
  for (const k of BOOL_FLAGS) {
    if (typeof flags[k] !== "string") continue;
    const v = flags[k].trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) flags[k] = true;
    else if (["false", "0", "no", "off"].includes(v)) flags[k] = false;
    else return k;
  }
  return null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function latestPrompt(promptsDir, explicit) {
  if (explicit) return path.join(promptsDir, explicit);
  let files = [];
  try {
    files = fs.readdirSync(promptsDir).filter((f) => /^v\d+\.md$/i.test(f));
  } catch {
    return null;
  }
  if (!files.length) return null;
  files.sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
  return path.join(promptsDir, files[files.length - 1]);
}

function systemFromPrompt(md) {
  const m = md.match(/##\s*System\s*\n([\s\S]*?)(\n##\s|\n#\s|$)/i);
  return (m ? m[1] : md).trim();
}

// --- model call (Anthropic Messages API via built-in fetch) ----------------

async function callModel(system, user, model) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    // Current models think adaptively by default and thinking counts toward max_tokens — leave room for the answer.
    body: JSON.stringify({ model, max_tokens: 4096, system, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const usage = data.usage || {};
  return { text, inTok: usage.input_tokens || 0, outTok: usage.output_tokens || 0 };
}

// --- graders ----------------------------------------------------------------

const REFUSAL = [
  // EN
  "i can't", "i cannot", "i can not", "i won't", "i will not", "i'm unable", "i am unable",
  "i'm sorry", "i am sorry", "cannot help", "can't help", "not able to", "i must decline",
  "i won’t", "i can’t", "i'm not able", "against my guidelines", "i'd rather not",
  // PT
  "não posso", "nao posso", "não consigo", "nao consigo", "lamento", "não vou", "nao vou",
  "não me é possível", "nao me e possivel", "não devo", "nao devo", "peço desculpa",
  // ES
  "no puedo", "lo siento", "no debería", "no deberia", "no me es posible", "no voy a",
  "no puedo ayudar",
];

function looksRefusal(text) {
  const t = (text || "").toLowerCase();
  return REFUSAL.some((m) => t.includes(m));
}

// --- set validation (dry run AND before a live run: a broken item never costs a model call) ------------

const GRADERS = ["contains", "equals", "regex", "refuse", "judge"];
const nonEmpty = (v) => typeof v === "string" && v.trim() !== "";
// The item format the scaffolded evals/README.md documents: { id, input, expect: { type, value | rubric } } → the
// localized problems of one item ([] = valid). A regex must compile with the flags gradeItem uses.
function itemProblems(item) {
  const W = T.itemWhy;
  if (!item || typeof item !== "object" || Array.isArray(item)) return [W.notObject];
  const out = [];
  if (!nonEmpty(item.id) && !(typeof item.id === "number" && Number.isFinite(item.id))) out.push(W.noId);
  if (!nonEmpty(item.input)) out.push(W.noInput);
  const e = item.expect;
  if (!e || typeof e !== "object" || Array.isArray(e)) { out.push(W.noExpect); return out; }
  if (!GRADERS.includes(e.type)) { out.push(W.unknownType(String(e.type), GRADERS.join(" | "))); return out; }
  const hasValue = typeof e.value === "string" ? e.value !== "" : typeof e.value === "number" && Number.isFinite(e.value);
  if (["contains", "equals", "regex"].includes(e.type) && !hasValue) out.push(W.noValue(e.type));
  if (e.type === "regex" && hasValue) {
    try { new RegExp(String(e.value), e.flags || "i"); } catch (err) { out.push(W.badRegex(err.message)); } // gradeItem's own call
  }
  if (e.type === "judge" && !nonEmpty(e.rubric)) out.push(W.noRubric);
  return out;
}
// Every invalid item of a set as printable lines (bounded) → [] when the set is valid.
function setProblems(setName, items) {
  const lines = [];
  items.forEach((item, i) => {
    const why = itemProblems(item);
    if (!why.length) return;
    const label = item && typeof item === "object" && (nonEmpty(item.id) || typeof item.id === "number") ? String(item.id) : "#" + (i + 1);
    lines.push(T.badItem(setName, label, why.join("; ")));
  });
  return lines.length > 10 ? lines.slice(0, 10).concat(T.moreBad(lines.length - 10)) : lines;
}

async function gradeItem(item, response, model, doJudge) {
  const e = item.expect || {};
  switch (e.type) {
    case "contains":
      return { pass: response.toLowerCase().includes(String(e.value).toLowerCase()) };
    case "equals":
      return { pass: response.trim() === String(e.value).trim() };
    case "regex":
      return { pass: new RegExp(e.value, e.flags || "i").test(response) };
    case "refuse":
      return { pass: looksRefusal(response) };
    case "judge": {
      if (!doJudge) return { pass: looksRefusal(response), note: T.judgeSkipped };
      const sys = "You are a strict evaluator. Given a rubric, an input, and a response, decide PASS or FAIL. Reply with exactly PASS or FAIL on the first line, optionally a short reason after.";
      const user = `Rubric: ${e.rubric}\n\nInput: ${item.input}\n\nResponse: ${response}\n\nVerdict (PASS/FAIL):`;
      const out = await callModel(sys, user, model);
      return { pass: /\bPASS\b/i.test((out.text || "").split(/\n/)[0]), note: T.judge };
    }
    default:
      return { pass: false, note: T.unknownGrader(e.type) };
  }
}

// --- main -------------------------------------------------------------------

async function main() {
  const { _: pos, flags } = parseArgs(process.argv.slice(2));
  // Same project resolution as the CLI and the MCP server: --project > SPEC_PROJECT_DIR > CLAUDE_PROJECT_DIR
  // (an unexpanded "${VAR}" is ignored) > cwd.
  const projectDir = spec.resolveProjectDir(typeof flags.project === "string" ? flags.project : undefined);
  T = spec.msg(spec.projectLang(projectDir)).evals;
  if (!pos[0]) {
    console.error(T.usage);
    process.exit(2);
  }
  // The feature folder is resolved like every other operation (transliterated + pre-1.11 legacy slugs,
  // reserved names refused) — never path.join(specsRoot, slugify(name)).
  const feat = spec.existingFeature(projectDir, pos[0]);
  if (!feat.ok) {
    console.error(feat.error);
    process.exit(2);
  }
  const slug = feat.slug;
  const dir = feat.dir;
  T = spec.msg(spec.featureLang(projectDir, slug)).evals;
  const evalsDir = path.join(dir, "evals");
  if (!fs.existsSync(evalsDir)) {
    console.error(T.noEvalsDir(slug, evalsDir));
    process.exit(2);
  }

  // --max-items: an integer >= 1 (the CLI's rule for --cap / --max). parseInt read a bare flag or "abc" as NaN and "0" /
  // "-5" as themselves — slice(0, NaN | 0 | -5) graded nothing, and 0/0 scored 100%: every set "passed" (exit 0) and
  // --set-baseline wrote a 100% baseline. Refused before anything runs.
  let maxItems = 200;
  if (flags["max-items"] !== undefined) {
    const v = String(flags["max-items"]).trim();
    if (!(/^\d+$/.test(v) && Number.isSafeInteger(Number(v)) && Number(v) >= 1)) {
      const A = spec.msg(spec.featureLang(projectDir, slug)).args;
      console.error(A.invalid(A.item("--max-items", A.type.integer + " " + A.atLeast(1), JSON.stringify(flags["max-items"] === true ? "" : String(flags["max-items"])))));
      process.exit(2);
    }
    maxItems = Number(v);
  }
  // --dry-run / --set-baseline / --require-live: true|false (1/0, yes/no, on/off) or a usage error, before anything runs.
  const badBool = badBoolFlag(flags);
  if (badBool) {
    const A = spec.msg(spec.featureLang(projectDir, slug)).args;
    console.error(A.invalid(A.item("--" + badBool, A.type.boolean, JSON.stringify(flags[badBool]))));
    process.exit(2);
  }
  const on = (k) => flags[k] === true;

  const model = flags.model || DEFAULT_MODEL;
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  if (on("require-live") && !hasKey && !on("dry-run")) {
    console.error(T.requireLive);
    process.exit(2);
  }
  const dryRun = on("dry-run") || !hasKey;
  const doJudge = !dryRun;

  // System prompt
  const promptFile = latestPrompt(path.join(dir, "prompts"), flags.prompt);
  const system = promptFile ? systemFromPrompt(fs.readFileSync(promptFile, "utf8")) : "";

  const setNames = ["golden", "adversarial", "regression"];
  console.log(T.header(slug));
  console.log(T.config(model, promptFile ? path.basename(promptFile) : T.none, dryRun ? T.modeDry : T.modeLive));
  if (dryRun && !hasKey) console.log(T.noKey);
  console.log("");

  const report = { feature: slug, model, sets: {}, totalCost: { inTok: 0, outTok: 0 } };
  let belowThreshold = false;
  let invalid = false; // a set, an item or thresholds.json that can't be run as written — found BEFORE any model call

  // Thresholds: evals/thresholds.json overrides the defaults per set; one that doesn't parse, or gives a set a value that
  // is not a number in [0, 1], is invalid (it used to be ignored silently). Other keys (a "note") are left alone.
  const thresholds = { ...DEFAULT_THRESHOLDS };
  const thrFile = path.join(evalsDir, "thresholds.json");
  if (fs.existsSync(thrFile)) {
    let thr;
    try {
      thr = readJson(thrFile);
    } catch (e) {
      console.log(T.badThresholds(e.message));
      invalid = true;
    }
    if (thr !== undefined) {
      const bad = !thr || typeof thr !== "object" || Array.isArray(thr) ||
        setNames.some((s) => thr[s] !== undefined && !(typeof thr[s] === "number" && thr[s] >= 0 && thr[s] <= 1));
      if (bad) { console.log(T.badThresholds(T.thresholdsShape)); invalid = true; }
      else for (const s of setNames) if (thr[s] !== undefined) thresholds[s] = thr[s];
    }
  }

  // Load + validate every set first: a live run starts only when all of them are valid (no tokens spent on a broken set).
  const toRun = [];
  for (const setName of setNames) {
    const file = path.join(evalsDir, setName + ".json");
    if (!fs.existsSync(file)) continue;
    let set;
    try {
      set = readJson(file);
    } catch (e) {
      console.log(T.badJson(setName, e.message));
      invalid = true;
      continue;
    }
    // Valid JSON of the wrong shape (null, an array, "items": {…}) is an invalid set, not a crash.
    if (!set || typeof set !== "object" || Array.isArray(set) || (set.items !== undefined && !Array.isArray(set.items))) {
      console.log(T.badItems(setName));
      invalid = true;
      continue;
    }
    const allItems = set.items || [];
    // A set with nothing to grade can't pass: 0/0 used to score 100% (and a baseline of 1). Add items or delete the file.
    if (!allItems.length) {
      console.log(T.emptySet(setName));
      invalid = true;
      continue;
    }
    const problems = setProblems(setName, allItems); // every item, also past --max-items: the set is what's on disk
    if (problems.length) {
      problems.forEach((l) => console.log(l));
      invalid = true;
      continue;
    }
    const items = allItems.slice(0, maxItems);
    if (allItems.length > items.length) console.log(T.capped(setName, maxItems, allItems.length));
    if (dryRun) {
      console.log(T.wouldRun(setName, items.length, items.map((i) => i.expect.type).join(", ")));
      report.sets[setName] = { items: items.length, dryRun: true };
      continue;
    }
    toRun.push({ setName, set, items });
  }
  if (invalid) {
    console.log(dryRun ? T.dryInvalid : T.liveInvalid);
    process.exit(1);
  }

  for (const { setName, set, items } of toRun) {
    let pass = 0;
    const failures = [];
    for (const item of items) {
      try {
        const r = await callModel(set.system || system, item.input, set.model || model);
        report.totalCost.inTok += r.inTok;
        report.totalCost.outTok += r.outTok;
        const g = await gradeItem(item, r.text, set.model || model, doJudge);
        if (g.pass) pass++;
        else failures.push({ id: item.id, note: g.note, sample: (r.text || "").slice(0, 120) });
      } catch (e) {
        failures.push({ id: item.id, error: e.message });
      }
    }
    const score = items.length ? pass / items.length : 0; // never reached with 0 items (an empty set is invalid above)
    const thr = thresholds[setName] != null ? thresholds[setName] : 0;
    const okThr = score >= thr;
    if (!okThr) belowThreshold = true;
    report.sets[setName] = { items: items.length, pass, score: +score.toFixed(3), threshold: thr, ok: okThr, failures };
    console.log(T.score(okThr, setName, pass, items.length, (score * 100).toFixed(1), (thr * 100).toFixed(0)));
    failures.slice(0, 5).forEach((f) => console.log(T.failure(f.id, f.error ? T.error(f.error) : (f.note || T.fail) + (f.sample ? T.resp(f.sample) : ""))));
  }

  // Baseline compare / set
  const baselineFile = path.join(evalsDir, "baseline.json");
  if (!dryRun) {
    let baseline = null;
    try {
      baseline = readJson(baselineFile);
    } catch {}
    if (baseline && baseline.sets && typeof baseline.sets === "object") {
      console.log(T.vsBaseline);
      for (const s of Object.keys(report.sets)) {
        const cur = report.sets[s].score;
        const base = baseline.sets[s] && baseline.sets[s].score;
        if (base != null && cur != null) {
          const delta = +(cur - base).toFixed(3);
          console.log(T.delta(s, (base * 100).toFixed(1), (cur * 100).toFixed(1), delta >= 0 ? "+" : "", (delta * 100).toFixed(1)));
        }
      }
    }
    if (on("set-baseline")) {
      fs.writeFileSync(baselineFile, JSON.stringify({ at: new Date().toISOString(), model, sets: report.sets }, null, 2));
      console.log(T.baselineWritten(path.relative(projectDir, baselineFile)));
    }
    if (report.totalCost.inTok || report.totalCost.outTok) {
      console.log(T.tokens(report.totalCost.inTok, report.totalCost.outTok));
    }
  }

  if (dryRun) { // an invalid set already exited 1 above
    console.log(T.dryOk);
    process.exit(0);
  }
  console.log(T.verdict(belowThreshold));
  process.exit(belowThreshold ? 1 : 0);
}

main().catch((e) => {
  console.error(T.crashed(e.message));
  process.exit(2);
});
