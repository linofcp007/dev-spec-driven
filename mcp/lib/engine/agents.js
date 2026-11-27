"use strict";

/**
 * dev-spec-driven engine — the plugin subagents' cost (1.42 S9): per role, how many dispatches, assistant turns, tool calls and
 * tokens the plugin's own agents (agents/*.md — spec-critic … spec-verifier) used. Report only — never a gate, a warning, a doctor
 * entry or a blocker; project-level (no feature attribution: a dispatch prompt's text names a feature by a name, never an anchor the
 * engine records), and no time (a transcript's first-to-last span is wait time for a resumed agent).
 *   - The log: a git-ignored, bounded `.specs/.execution/agents.jsonl`, one line per finished dispatch — {agent, id, model?, turns,
 *     tools, tokens: {in, out, cacheRead, cacheWrite}, truncated}: COUNTS only, never a transcript's text. Written by recordAgentRun
 *     through evidence.js's one appender (the write gate), from Claude Code's SubagentStop (the observe hook reads the agent's OWN
 *     transcript — never the parent session's — and hands the counts over; the engine never reads a path outside the project).
 *     Past AGENTS_MAX_BYTES the log keeps its newest lines, up to half of that.
 *   - The record's shape is checked when written AND when read (agentRecord): an agent among AGENT_ROLES (a `dev-spec-driven:`
 *     prefix dropped — a copied agent of the same name is the same role, as the stop gate reads it), an id `^[\w-]{1,64}$` (the
 *     transcript's basename), counts finite integers ≥ 0, a model id ≤ 100 characters, `truncated` a boolean (the reader stopped
 *     at its bound: the counts are a lower bound). Anything else is never stored.
 *   - The reading (agentCosts): one record per id — the LATER one in the log wins (a dispatch the stop gate sent back finishes
 *     again; its transcript is a superset of the earlier one) — rolled up per role: spec_metrics' project `agents`.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const path = require("path");
const i18n = require("../i18n.js");
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let appendLog, isRecord, readLogTail, specsRoot, specsStat, toPosix, writeFileAtomic;
function __link(E) { ({ appendLog, isRecord, readLogTail, specsRoot, specsStat, toPosix, writeFileAtomic } = E); }

// The plugin's agents — the stems of agents/*.md (09-evidence-agents.js pins the list equal to the folder, a property).
const AGENT_ROLES = ["spec-critic", "spec-implementer", "spec-reviewer", "spec-simplifier", "spec-ui-reviewer", "spec-verifier"];
const AGENTS_LOG = "agents.jsonl";
const AGENTS_MAX_BYTES = 256 * 1024; // past this the log keeps its newest lines, up to half of it (read: 2 × this at most)
const PLUGIN_PREFIX = "dev-spec-driven:";
const TOKEN_KEYS = ["in", "out", "cacheRead", "cacheWrite"];
const RE_AGENT_ID = /^[\w-]{1,64}$/;
const RE_AGENT_MODEL = /^[\w.:@\/[\]-]{1,100}$/; // a model id (claude-…, claude-…[1m], a provider's org/name) — never a sentence

const agentsFile = (projectDir) => path.join(specsRoot(projectDir), ".execution", AGENTS_LOG);
const count = (v) => Number.isSafeInteger(v) && v >= 0;
// The role an agent name stands for → its AGENT_ROLES stem, or null (another agent: a user's spec-writer, general-purpose…).
function agentRole(agent) {
  if (typeof agent !== "string") return null;
  const a = agent.startsWith(PLUGIN_PREFIX) ? agent.slice(PLUGIN_PREFIX.length) : agent;
  return AGENT_ROLES.includes(a) ? a : null;
}
// A run (the hook's counts) or a log line → { record } — built from the checked fields alone, in one key order — | { invalid: [field] }.
function agentRecord(run) {
  const r = isRecord(run) ? run : {};
  const t = isRecord(r.tokens) ? r.tokens : null;
  const agent = agentRole(r.agent);
  const invalid = [];
  if (!agent) invalid.push("agent");
  if (typeof r.id !== "string" || !RE_AGENT_ID.test(r.id)) invalid.push("id");
  if (r.model != null && !(typeof r.model === "string" && RE_AGENT_MODEL.test(r.model))) invalid.push("model");
  for (const k of ["turns", "tools"]) if (!count(r[k])) invalid.push(k);
  if (!t || !TOKEN_KEYS.every((k) => count(t[k]))) invalid.push("tokens");
  if (typeof r.truncated !== "boolean") invalid.push("truncated");
  if (invalid.length) return { invalid };
  return { record: Object.assign({ agent, id: r.id }, r.model != null ? { model: r.model } : {},
    { turns: r.turns, tools: r.tools, tokens: Object.fromEntries(TOKEN_KEYS.map((k) => [k, t[k]])), truncated: r.truncated }) };
}

// The observe hook's SubagentStop (Claude Code): one finished dispatch's counts → its line in .specs/.execution/agents.jsonl.
// → { ok: true, recorded: the log's project-relative path | null (not written: no .specs/, a link on the way — the gate) } |
// { ok: false, code: "invalid-run", invalid: [field] } (nothing written). Never throws (appendLog catches).
function recordAgentRun(projectDir, run) {
  const x = agentRecord(run);
  if (x.invalid) return { ok: false, code: "invalid-run", invalid: x.invalid };
  const file = appendLog(path.join(specsRoot(projectDir), ".execution"), AGENTS_LOG, x.record, trimAgentsLog);
  return { ok: true, recorded: file ? toPosix(path.relative(path.resolve(projectDir), file)) : null };
}
// Past AGENTS_MAX_BYTES: the newest well-shaped lines, up to half of it (replaced atomically). An append while another hook trims can
// lose one line (one dispatch fewer in the counts). (Called by appendLog, which catches.)
function trimAgentsLog(file) {
  const st = specsStat(file); // through the read gate: a linked log is never trimmed
  if (!st || st.size <= AGENTS_MAX_BYTES) return;
  const lines = readLogTail(file, 2 * AGENTS_MAX_BYTES).records.filter((e) => !agentRecord(e).invalid).map((e) => JSON.stringify(e) + "\n");
  let from = lines.length, bytes = 0;
  while (from > 0 && bytes + Buffer.byteLength(lines[from - 1]) <= AGENTS_MAX_BYTES / 2) bytes += Buffer.byteLength(lines[--from]);
  writeFileAtomic(file, lines.slice(from).join(""));
}

// spec_metrics' project `agents` → null (no well-shaped record) | { dispatches, roles: { <agent>: { dispatches, turns, tools,
// tokens: {in, out, cacheRead, cacheWrite}, truncated (the dispatches read only in part: their counts a lower bound), models
// [the model ids, sorted] } } (AGENT_ROLES' order, a role with a dispatch only) }. The log's newest 2 × AGENTS_MAX_BYTES at most,
// through the read gate (a linked log is none); a wrong-shaped line is skipped; one record per id, the later in the log.
function agentCosts(projectDir) {
  const latest = new Map();
  for (const e of readLogTail(agentsFile(projectDir), 2 * AGENTS_MAX_BYTES).records) {
    const x = agentRecord(e);
    if (x.invalid) continue;
    latest.delete(x.record.id);
    latest.set(x.record.id, x.record);
  }
  if (!latest.size) return null;
  const runs = [...latest.values()], roles = {};
  for (const role of AGENT_ROLES) {
    const mine = runs.filter((r) => r.agent === role);
    if (!mine.length) continue;
    const sum = (f) => mine.reduce((s, r) => s + f(r), 0);
    roles[role] = { dispatches: mine.length, turns: sum((r) => r.turns), tools: sum((r) => r.tools),
      tokens: Object.fromEntries(TOKEN_KEYS.map((k) => [k, sum((r) => r.tokens[k])])), truncated: mine.filter((r) => r.truncated).length,
      models: [...new Set(mine.map((r) => r.model).filter(Boolean))].sort() };
  }
  return { dispatches: runs.length, roles };
}
// The CLI's spec_metrics lines for it (finish.js metricsLines, the project view) → [lines].
function agentLines(a, lng) {
  if (!a) return [];
  const M = i18n.msg(lng).metrics;
  return [M.agentsHead(a.dispatches), ...Object.entries(a.roles).map(([role, x]) =>
    M.agentsRole(role, x.dispatches, x.turns, x.tokens.in, x.tokens.out, x.tokens.cacheRead, x.truncated))];
}

module.exports = { AGENT_ROLES, recordAgentRun, agentCosts, agentLines, __link };
