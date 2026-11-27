"use strict";
// Evidence — the plugin subagents' cost (1.42 S9, report only): engine/agents.js — recordAgentRun (one dispatch's COUNTS → the git-ignored .specs/.execution/agents.jsonl, shape-checked, through the write gate), agentCosts (spec_metrics' project `agents`: one record per id, the later wins, rolled up per role), the metrics lines; AGENT_ROLES = agents/*.md.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, eq, rpc, payload, skip, S, tmp, root, __dirname }) => {
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const js = JSON.stringify;
  const M = S.msg("en").metrics;
  const logOf = (p) => path.join(p, ".specs", ".execution", "agents.jsonl");
  const lines = (p) => { try { return fs.readFileSync(logOf(p), "utf8").split("\n").filter(Boolean); } catch { return []; } };
  const project = (name) => { const p = path.join(tmp, name); S.initProject(p, ["core"], "en"); return p; };
  // a dispatch as the observe hook hands it over (real-shaped counts: a reviewer's transcript, deduped per message id)
  const run = (over) => Object.assign({ agent: "dev-spec-driven:spec-reviewer", id: "agent-a1b2c3d4e5f6a7b8c", model: "claude-opus-4-5",
    turns: 31, tools: 24, tokens: { in: 1520, out: 18340, cacheRead: 812400, cacheWrite: 64210 }, truncated: false }, over || {});
  const KEYS = ["agent", "id", "model", "turns", "tools", "tokens", "truncated"];

  { // recordAgentRun: one line of counts — the plugin prefix dropped, only the documented keys (a transcript's text, the prompt, its path
    // never stored), the folder ignoring itself; any field of the wrong shape refuses the whole run and writes nothing
    const p = project("proj-ag-record");
    const r = S.recordAgentRun(p, run({ prompt: "Review task 3 of .specs/billing/ — the diff is…", transcript: "C:/Users/x/.claude/projects/a/agent-a1.jsonl", agentType: "spec-reviewer", feature: "billing" }));
    const written = lines(p).map((l) => JSON.parse(l));
    const bad = {
      agent: [undefined, "spec-writer", "general-purpose", "dev-spec-driven:spec-writer", "Spec-Reviewer", "dev-spec-driven:dev-spec-driven:spec-reviewer"],
      id: [undefined, "", "../agent-x", "agent x", "a".repeat(65), 7],
      turns: [-1, 1.5, "31", NaN, Infinity, 2 ** 53],
      tools: [undefined, -2],
      tokens: [undefined, null, { in: 1, out: 2, cacheRead: 3 }, { in: 1, out: -2, cacheRead: 3, cacheWrite: 4 }, { in: 1, out: 2, cacheRead: 3.5, cacheWrite: 4 }],
      model: ["claude opus", "m".repeat(101), 5, "claude-x\nPrompt: review"],
      truncated: [undefined, "no", 0],
    };
    const refused = Object.entries(bad).flatMap(([k, vals]) => vals.map((v) => {
      const x = run();
      if (v === undefined) delete x[k]; else x[k] = v;
      const res = S.recordAgentRun(p, x);
      return { k, v: v === undefined ? "(absent)" : v, ok: res.ok, code: res.code, invalid: res.invalid };
    }));
    const notRefused = refused.filter((x) => !(x.ok === false && x.code === "invalid-run" && js(x.invalid) === js([x.k])));
    const okModels = ["claude-sonnet-4-5[1m]", "anthropic/claude-haiku-4-5", "claude-opus-4-5-20251101"].map((model) => S.recordAgentRun(p, run({ id: "agent-m" + model.length, model })).ok);
    const noModel = run({ id: "agent-nomodel" });
    delete noModel.model;
    const nm = S.recordAgentRun(p, noModel);
    all("1.42 (S9): recordAgentRun writes one line of counts — the plugin prefix dropped, only {agent, id, model, turns, tools, tokens, truncated} (no prompt, path or text), .execution/ ignoring itself; a field of the wrong shape refuses the run (invalid-run, the field named) and writes nothing (got " +
      js({ r, written, notRefused: notRefused.slice(0, 6), okModels, nm }) + ")", {
      "recorded, its keys exactly the documented ones": () => r.ok === true && r.recorded === ".specs/.execution/agents.jsonl" && written.length >= 1 && js(Object.keys(written[0])) === js(KEYS) &&
        js(written[0]) === js({ agent: "spec-reviewer", id: "agent-a1b2c3d4e5f6a7b8c", model: "claude-opus-4-5", turns: 31, tools: 24,
          tokens: { in: 1520, out: 18340, cacheRead: 812400, cacheWrite: 64210 }, truncated: false }),
      "the folder ignores itself": () => fs.readFileSync(path.join(p, ".specs", ".execution", ".gitignore"), "utf8") === "*\n",
      "every wrong shape refused, naming its field": () => refused.length === 32 && notRefused.length === 0,
      "nothing written for them; model ids of every real shape kept, an absent model too": () => lines(p).length === 1 + okModels.length + 1 &&
        okModels.every(Boolean) && nm.ok === true && !("model" in JSON.parse(lines(p).pop())),
    });
  }

  { // the plugin's agents: AGENT_ROLES is the set of agents/*.md stems (a new agent, or one renamed, without its role fails here)
    const stems = fs.readdirSync(path.join(root, "agents")).filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3)).sort();
    eq(E.AGENT_ROLES.slice().sort(), stems, "1.42 (S9): AGENT_ROLES — the roles agents.jsonl takes — are exactly the plugin's agents (agents/*.md stems)");
  }

  { // agentCosts: one record per id — the LATER one in the log wins (a dispatch the stop gate sent back finishes again, its transcript a
    // superset) —, rolled up per role in AGENT_ROLES' order (a prefixed and a copied unprefixed agent are one role); a hand-made line of
    // another shape, another agent or garbage is skipped; a dispatch read only in part is counted in `truncated` and said by its line
    const p = project("proj-ag-costs");
    const tok = (i, o, cr, cw) => ({ in: i, out: o, cacheRead: cr, cacheWrite: cw });
    const runs = [
      run({ id: "agent-r1", turns: 12, tools: 9, tokens: tok(100, 2000, 50000, 4000) }),
      run({ id: "agent-i1", agent: "dev-spec-driven:spec-implementer", model: "claude-sonnet-4-5", turns: 40, tools: 35, tokens: tok(300, 9000, 400000, 20000) }),
      run({ id: "agent-r1", turns: 20, tools: 15, tokens: tok(160, 3100, 90000, 5000) }), // sent back: the same transcript, grown
      run({ id: "agent-i2", agent: "spec-implementer", model: "claude-opus-4-5", turns: 10, tools: 8, tokens: tok(50, 1000, 30000, 2000), truncated: true }),
      run({ id: "agent-c1", agent: "spec-critic", model: "claude-opus-4-5", turns: 3, tools: 2, tokens: tok(20, 900, 10000, 3000) }),
    ];
    const rec = runs.map((x) => S.recordAgentRun(p, x).ok);
    fs.appendFileSync(logOf(p), [js({ agent: "spec-writer", id: "agent-w1", turns: 1, tools: 1, tokens: tok(1, 1, 1, 1), truncated: false }),
      js({ agent: "spec-reviewer", id: "agent-r9", turns: -1, tools: 1, tokens: tok(1, 1, 1, 1), truncated: false }), "{not json", "[1,2]"].join("\n") + "\n");
    const c = S.agentCosts(p);
    const want = { dispatches: 4, roles: {
      "spec-critic": { dispatches: 1, turns: 3, tools: 2, tokens: tok(20, 900, 10000, 3000), truncated: 0, models: ["claude-opus-4-5"] },
      "spec-implementer": { dispatches: 2, turns: 50, tools: 43, tokens: tok(350, 10000, 430000, 22000), truncated: 1, models: ["claude-opus-4-5", "claude-sonnet-4-5"] },
      "spec-reviewer": { dispatches: 1, turns: 20, tools: 15, tokens: tok(160, 3100, 90000, 5000), truncated: 0, models: ["claude-opus-4-5"] } } };
    const m = S.metrics(p), viaMcp = payload(await rpc("tools/call", { name: "spec_metrics", arguments: { projectDir: p } }));
    const f = S.createFeature(p, "Billing", ["core"]);
    const withFeature = S.metrics(p), one = S.metrics(p, f.slug);
    const out = S.metricsLines(withFeature).join("\n"), none = S.metricsLines(m).join("\n");
    const roleLines = [M.agentsHead(4), M.agentsRole("spec-critic", 1, 3, 20, 900, 10000, 0), M.agentsRole("spec-implementer", 2, 50, 350, 10000, 430000, 1),
      M.agentsRole("spec-reviewer", 1, 20, 160, 3100, 90000, 0)];
    all("1.42 (S9): agentCosts — one record per id (the later wins), per role in AGENT_ROLES' order (prefixed and copied names one role), other shapes skipped, a dispatch read in part counted; spec_metrics' project `agents` (MCP the same), never a feature's; the metrics lines print it, with or without an active feature (got " +
      js({ rec, c, mcp: viaMcp.agents, one: "agents" in one }) + ")", {
      "the roll-up": () => rec.every(Boolean) && js(c) === js(want),
      "spec_metrics' project result carries it, the MCP tool the same": () => js(m.agents) === js(want) && js(viaMcp.agents) === js(want) && js(withFeature.agents) === js(want),
      "a feature's metrics carry no `agents`": () => one.ok === true && !("agents" in one),
      "the lines: the head, then one per role (a partial read said)": () => roleLines.every((l) => out.includes(l + "\n") || out.endsWith(l)) && roleLines.every((l) => none.includes(l)) &&
        out.indexOf(roleLines[0]) < out.indexOf(roleLines[1]) && /a lower bound/.test(roleLines[2]) && !/lower bound/.test(roleLines[1]),
    });
  }

  { // no record: `agents` is null (the key there, like friction) and no line is printed; a log of other shapes only is none
    const p = project("proj-ag-none");
    const m0 = S.metrics(p);
    fs.mkdirSync(path.dirname(logOf(p)), { recursive: true });
    fs.writeFileSync(logOf(p), js({ agent: "general-purpose", id: "agent-g1", turns: 1, tools: 0, tokens: { in: 1, out: 1, cacheRead: 0, cacheWrite: 0 }, truncated: false }) + "\n");
    const m1 = S.metrics(p);
    all("1.42 (S9): with no well-shaped record spec_metrics' `agents` is null and the metrics print no subagents line (got " + js([m0.agents, m1.agents]) + ")", {
      "null, the key present": () => "agents" in m0 && m0.agents === null && m1.agents === null && S.agentCosts(p) === null,
      "no line": () => !S.metricsLines(m1).some((l) => l.includes(M.agentsHead(0).split("(")[0].trim())),
    });
  }

  { // bounded: past AGENTS_MAX_BYTES (256 KB) the next append keeps the newest well-shaped lines, up to half of it — a COUNT of bytes
    const p = project("proj-ag-trim");
    fs.mkdirSync(path.dirname(logOf(p)), { recursive: true });
    const hand = Array.from({ length: 1500 }, (_, i) => js({ agent: "spec-implementer", id: "agent-t" + String(i).padStart(5, "0"), model: "claude-opus-4-5", turns: i, tools: 2,
      tokens: { in: 100, out: 2000, cacheRead: 90000, cacheWrite: 8000 }, truncated: false }) + "\n").join("");
    fs.writeFileSync(logOf(p), hand + "{a hand-made, broken line\n");
    const before = fs.statSync(logOf(p)).size;
    const r = S.recordAgentRun(p, run({ id: "agent-newest" }));
    const after = lines(p), size = fs.statSync(logOf(p)).size;
    const ids = after.map((l) => { try { return JSON.parse(l).id; } catch { return null; } });
    all("1.42 (S9): past 256 KB the log keeps its newest well-shaped lines, at most 128 KB (got " + js({ before, size, n: after.length, first: ids[0], last: ids[ids.length - 1] }) + ")", {
      "it was past the bound": () => before > 256 * 1024 && r.ok === true,
      "at most half of the bound, the newest kept": () => size <= 128 * 1024 && size > 100 * 1024 && ids[ids.length - 1] === "agent-newest" && ids.includes("agent-t01499") && !ids.includes("agent-t00000"),
      "every line kept is well shaped": () => ids.every((x) => typeof x === "string"),
    });
  }

  { // the gates: a linked .specs/.execution/ — nothing written through it (the write gate), and a log behind it is none (the read gate)
    const p = project("proj-ag-linked"), outside = path.join(tmp, "proj-ag-linked-elsewhere");
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, "agents.jsonl"), js({ agent: "spec-reviewer", id: "agent-x1", turns: 1, tools: 1, tokens: { in: 1, out: 1, cacheRead: 1, cacheWrite: 1 }, truncated: false }) + "\n");
    let linked = true;
    try { fs.symlinkSync(outside, path.join(p, ".specs", ".execution"), "junction"); } catch { linked = false; }
    if (!linked) skip("1.42 (S9): agents.jsonl behind a linked .specs/.execution/", "links not creatable here");
    else {
      const r = S.recordAgentRun(p, run({ id: "agent-through-link" }));
      const there = fs.readFileSync(path.join(outside, "agents.jsonl"), "utf8").split("\n").filter(Boolean);
      all("1.42 (S9): a linked .specs/.execution/ — recordAgentRun writes nothing through it, agentCosts reads nothing behind it (got " + js({ r, there: there.length, costs: S.agentCosts(p) }) + ")", {
        "nothing written through the link": () => r.ok === true && r.recorded === null && there.length === 1 && !fs.existsSync(path.join(outside, ".gitignore")),
        "nothing read behind it": () => S.agentCosts(p) === null && S.metrics(p).agents === null,
      });
    }
  }
};
