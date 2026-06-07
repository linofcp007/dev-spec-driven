#!/usr/bin/env node
"use strict";

/**
 * dev-spec-driven — local hook handler (zero-dependency).
 *
 * Wired from hooks/hooks.json for two events:
 *   - PostToolUse (Write|Edit): when a `.specs/.../requirements.md` is saved, lint EARS;
 *     when a `.specs/.../tasks.md` is saved, run a traceability check. Surfaces gaps in
 *     the moment, with zero CI and zero cost.
 *   - SessionStart: print a one-line status of all features in the project.
 *
 * It NEVER blocks: any error or irrelevant event exits 0 silently. Output is emitted as
 * `hookSpecificOutput.additionalContext` so Claude sees it as context, not as a user message.
 */

const fs = require("fs");
const path = require("path");

let spec;
try {
  spec = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
} catch {
  process.exit(0); // engine not found — stay silent
}

let emitted = false;
function emit(eventName, text) {
  if (emitted) return; // exactly one JSON object per invocation (the hook protocol expects one)
  emitted = true;
  if (!text) process.exit(0);
  // Write then exit only after the buffer is flushed (Windows pipes truncate otherwise).
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: eventName, additionalContext: text } }),
    () => process.exit(0)
  );
}

function findProjectDir(filePath) {
  // Walk up from the file until we find the parent of a `.specs` directory.
  let dir = path.dirname(filePath);
  for (let i = 0; i < 12 && dir; i++) {
    if (path.basename(dir) === ".specs") return path.dirname(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.env.CLAUDE_PROJECT_DIR || process.env.SPEC_PROJECT_DIR || process.cwd();
}

function main(raw) {
  let payload = {};
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    process.exit(0);
  }
  const event = payload.hook_event_name || payload.hookEventName || "";

  if (event === "SessionStart") {
    try {
      const pdir = process.env.CLAUDE_PROJECT_DIR || process.env.SPEC_PROJECT_DIR || payload.cwd || process.cwd();
      const list = spec.listFeatures(pdir);
      if (!list.exists || !list.features.length) process.exit(0);
      const lines = list.features.map(
        (f) => `  • ${f.name} [${f.tracks}] — ${f.phase} (${f.tasksDone}/${f.tasks} tasks)`
      );
      const h = spec.msg(spec.projectLang(pdir)).hook;
      emit("SessionStart", h.sessionHeader + "\n" + lines.join("\n"));
    } catch {
      process.exit(0);
    }
  }

  if (event === "PostToolUse") {
    const ti = payload.tool_input || payload.toolInput || {};
    const filePath = ti.file_path || ti.path || "";
    if (!filePath || !filePath.replace(/\\/g, "/").includes("/.specs/")) process.exit(0);
    const base = path.basename(filePath).toLowerCase();
    const pdir = findProjectDir(filePath);

    const feature = path.basename(path.dirname(filePath));
    const h = spec.msg(spec.featureLang(pdir, feature)).hook; // localized in the feature's language

    // Keep the roadmap current on any hand-edit of a spec file (not the roadmap files themselves).
    let roadmapNote = "";
    if (base !== "roadmap.md" && base !== "roadmap.html") {
      try {
        const w = spec.writeRoadmapMd(pdir);
        if (w.ok) roadmapNote = h.roadmapUpdated(w.overallPercent, w.complete, w.total);
      } catch {
        /* best-effort */
      }
    }

    try {
      if (base === "requirements.md") {
        const text = fs.readFileSync(filePath, "utf8");
        const r = spec.earsValidate(text);
        if (!r.ok) process.exit(0);
        const errs = r.issues.filter((i) => i.severity === "error");
        const warns = r.issues.filter((i) => i.severity === "warn");
        if (!errs.length && !warns.length) {
          emit("PostToolUse", h.earsClean(r.summary.criteriaDetected));
        }
        const top = [...errs, ...warns].slice(0, 6).map((i) => `  L${i.line} [${i.severity}] ${i.msg}`);
        emit("PostToolUse", h.earsIssues(errs.length, warns.length, top.join("\n"), errs.length > 0));
      }

      if (base === "tasks.md") {
        const tr = spec.traceCheck(pdir, feature);
        if (!tr.ok) process.exit(0);
        if (tr.verdict === "pass") {
          emit("PostToolUse", h.traceOk(tr.totalAcs));
        }
        const parts = [];
        if (tr.uncoveredByTasks.length) parts.push(h.traceUncovered(tr.uncoveredByTasks.join(", ")));
        if (tr.phantomAcsInTasks.length) parts.push(h.tracePhantomAc(tr.phantomAcsInTasks.join(", ")));
        if (tr.uncoveredByTests && tr.uncoveredByTests.length) parts.push(h.traceUncoveredTests(tr.uncoveredByTests.join(", ")));
        if (tr.phantomTestsInTasks && tr.phantomTestsInTasks.length) parts.push(h.tracePhantomTests(tr.phantomTestsInTasks.join(", ")));
        emit("PostToolUse", h.traceGaps(feature, parts.join("\n  - ")));
      }
    } catch {
      process.exit(0);
    }
    // Not a requirements.md / tasks.md edit, but a spec file changed → surface the roadmap refresh.
    if (roadmapNote) emit("PostToolUse", roadmapNote);
  }

  process.exit(0);
}

// Read the hook payload from stdin (cross-platform). Guard against no-stdin hangs.
let input = "";
if (process.stdin.isTTY) {
  main("{}");
} else {
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => main(input));
  process.stdin.on("error", () => process.exit(0));
  setTimeout(() => main(input), 2000).unref(); // safety net
}
