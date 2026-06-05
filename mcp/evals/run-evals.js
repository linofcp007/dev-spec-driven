#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — local eval harness (zero-dependency).
 *
 * Runs a feature's golden / adversarial / regression sets against a model using YOUR OWN
 * API key (env ANTHROPIC_API_KEY). No CI, no third party beyond your chosen model provider.
 * Without a key (or with --dry-run) it validates the sets and prints the plan, calling nothing.
 *
 * Usage (from the project root):
 *   node <plugin>/mcp/evals/run-evals.js <feature-slug> [flags]
 *
 * Flags:
 *   --dry-run            validate + print plan, do not call the model
 *   --set-baseline       write the current scores to evals/baseline.json
 *   --model=<id>         override model (default: $DEV_SPEC_MODEL or claude-sonnet-4-6)
 *   --project=<dir>      project root (default: $CLAUDE_PROJECT_DIR or cwd)
 *   --prompt=<file>      prompt file under prompts/ (default: latest vN.md)
 *
 * Exit code: 0 normally; 1 if a set falls below its threshold (real run only) — handy for a
 * manual pre-push gate. Thresholds: evals/thresholds.json or defaults
 * (golden 0.85, adversarial 1.0, regression 1.0).
 */

const fs = require("fs");
const path = require("path");
const spec = require(path.join(__dirname, "..", "lib", "spec.js"));

const DEFAULT_MODEL = process.env.DEV_SPEC_MODEL || "claude-sonnet-4-6";
const DEFAULT_THRESHOLDS = { golden: 0.85, adversarial: 1.0, regression: 1.0 };

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
    body: JSON.stringify({ model, max_tokens: 1024, system, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(30000),
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
      if (!doJudge) return { pass: looksRefusal(response), note: "judge skipped (heuristic used)" };
      const sys = "You are a strict evaluator. Given a rubric, an input, and a response, decide PASS or FAIL. Reply with exactly PASS or FAIL on the first line, optionally a short reason after.";
      const user = `Rubric: ${e.rubric}\n\nInput: ${item.input}\n\nResponse: ${response}\n\nVerdict (PASS/FAIL):`;
      const out = await callModel(sys, user, model);
      return { pass: /\bPASS\b/i.test((out.text || "").split(/\n/)[0]), note: "judge" };
    }
    default:
      return { pass: false, note: `unknown grader '${e.type}'` };
  }
}

// --- main -------------------------------------------------------------------

async function main() {
  const { _: pos, flags } = parseArgs(process.argv.slice(2));
  const slug = pos[0];
  if (!slug) {
    console.error("Usage: node run-evals.js <feature-slug> [--dry-run] [--set-baseline] [--model=ID]");
    process.exit(2);
  }
  const projectDir = path.resolve(flags.project || process.env.CLAUDE_PROJECT_DIR || process.env.SPEC_PROJECT_DIR || process.cwd());
  const dir = path.join(spec.specsRoot(projectDir), spec.slugify(slug));
  const evalsDir = path.join(dir, "evals");
  if (!fs.existsSync(evalsDir)) {
    console.error(`No evals/ dir for '${spec.slugify(slug)}' at ${evalsDir}`);
    process.exit(2);
  }

  const model = flags.model || DEFAULT_MODEL;
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const dryRun = !!flags["dry-run"] || !hasKey;
  const doJudge = !dryRun;

  // System prompt
  const promptFile = latestPrompt(path.join(dir, "prompts"), flags.prompt);
  const system = promptFile ? systemFromPrompt(fs.readFileSync(promptFile, "utf8")) : "";

  // Thresholds
  let thresholds = { ...DEFAULT_THRESHOLDS };
  try {
    Object.assign(thresholds, readJson(path.join(evalsDir, "thresholds.json")));
  } catch {}

  const setNames = ["golden", "adversarial", "regression"];
  console.log(`dev-spec-driven evals — feature '${spec.slugify(slug)}'`);
  console.log(`  model: ${model}   prompt: ${promptFile ? path.basename(promptFile) : "(none)"}   mode: ${dryRun ? "DRY-RUN (no model calls)" : "LIVE"}`);
  if (dryRun && !hasKey) console.log("  (no ANTHROPIC_API_KEY set — running dry. Set it to do a live run.)");
  console.log("");

  const report = { feature: spec.slugify(slug), model, sets: {}, totalCost: { inTok: 0, outTok: 0 } };
  let belowThreshold = false;

  for (const setName of setNames) {
    const file = path.join(evalsDir, setName + ".json");
    if (!fs.existsSync(file)) continue;
    let set;
    try {
      set = readJson(file);
    } catch (e) {
      console.log(`  ✗ ${setName}.json — invalid JSON: ${e.message}`);
      belowThreshold = true;
      continue;
    }
    const allItems = set.items || [];
    const maxItems = flags["max-items"] ? parseInt(flags["max-items"], 10) : 200;
    const items = allItems.slice(0, maxItems);
    if (allItems.length > items.length) console.log(`  ⚠ ${setName}: capped at ${maxItems}/${allItems.length} items (raise with --max-items=N)`);
    if (dryRun) {
      console.log(`  • ${setName}: ${items.length} item(s) — would run ${items.map((i) => i.expect && i.expect.type).join(", ")}`);
      report.sets[setName] = { items: items.length, dryRun: true };
      continue;
    }

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
    const score = items.length ? pass / items.length : 1;
    const thr = thresholds[setName] != null ? thresholds[setName] : 0;
    const okThr = score >= thr;
    if (!okThr) belowThreshold = true;
    report.sets[setName] = { items: items.length, pass, score: +score.toFixed(3), threshold: thr, ok: okThr, failures };
    console.log(`  ${okThr ? "✓" : "✗"} ${setName}: ${pass}/${items.length} = ${(score * 100).toFixed(1)}% (threshold ${(thr * 100).toFixed(0)}%)`);
    failures.slice(0, 5).forEach((f) => console.log(`      - ${f.id}: ${f.error ? "ERROR " + f.error : (f.note || "fail") + (f.sample ? " | resp: " + f.sample : "")}`));
  }

  // Baseline compare / set
  const baselineFile = path.join(evalsDir, "baseline.json");
  if (!dryRun) {
    let baseline = null;
    try {
      baseline = readJson(baselineFile);
    } catch {}
    if (baseline && baseline.sets) {
      console.log("\n  vs baseline:");
      for (const s of Object.keys(report.sets)) {
        const cur = report.sets[s].score;
        const base = baseline.sets[s] && baseline.sets[s].score;
        if (base != null && cur != null) {
          const delta = +(cur - base).toFixed(3);
          console.log(`    ${s}: ${(base * 100).toFixed(1)}% → ${(cur * 100).toFixed(1)}% (${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}pp)`);
        }
      }
    }
    if (flags["set-baseline"]) {
      fs.writeFileSync(baselineFile, JSON.stringify({ at: new Date().toISOString(), model, sets: report.sets }, null, 2));
      console.log(`\n  baseline written → ${path.relative(projectDir, baselineFile)}`);
    }
    if (report.totalCost.inTok || report.totalCost.outTok) {
      console.log(`\n  tokens: ${report.totalCost.inTok} in / ${report.totalCost.outTok} out`);
    }
  }

  if (dryRun) {
    console.log("\nDry run complete — sets are valid. Set ANTHROPIC_API_KEY and re-run for live scores.");
    process.exit(0);
  }
  console.log(`\nVerdict: ${belowThreshold ? "BELOW THRESHOLD ✗" : "all sets pass ✓"}`);
  process.exit(belowThreshold ? 1 : 0);
}

main().catch((e) => {
  console.error("eval harness error:", e.message);
  process.exit(2);
});
