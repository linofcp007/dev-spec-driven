"use strict";
// Behavioural plugin evals (evals/behavior-*) — well-formed, naming only real MCP tools; every fixture builds.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, S, root, tmp, require }) => {

  { // Behavioural plugin evals (evals/behavior-*, tag `behavior`): well-formed, cheap, naming only REAL MCP tools, and
    // their scaffold fixtures still build against THIS engine — a refused approval in a fixture or a renamed tool would
    // otherwise only show up as a mysterious 0 in a paid `claude plugin eval` run.
    const evDir = path.join(root, "evals");
    const readEv = (...p) => fs.readFileSync(path.join(evDir, ...p), "utf8");
    const front = (t) => t.split(/^---\r?$/m)[1] || "";
    const behav = fs.readdirSync(evDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(evDir, e.name, "prompt.md")) && /^\s+- behavior\s*$/m.test(readEv(e.name, "prompt.md")))
      .map((e) => e.name);
    const serverSrc = fs.readFileSync(path.join(root, "mcp", "server.js"), "utf8");
    const toolNames = new Set([...serverSrc.matchAll(/^\s+name: "([a-z_]+)",\s*$/gm)].map((m) => m[1]));
    const pluginName = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin", "plugin.json"), "utf8")).name;
    const serverName = Object.keys(JSON.parse(fs.readFileSync(path.join(root, "mcp", "servers.json"), "utf8")).mcpServers)[0];
    const prefix = `mcp__plugin_${pluginName}_${serverName}__`;
    const yamlQuoted = (fm, k) => { const m = fm.match(new RegExp("^" + k + ":\\s*'((?:[^']|'')*)'\\s*$", "m")); return m ? m[1].replace(/''/g, "'") : null; };
    // mcp__plugin_<p>_<s>__spec_finish · …__spec_(?:classify|create) → [prefix, [tool names]]
    const mcpRefs = (t) => [...t.matchAll(/(mcp__[\w-]+?__)([a-z_]*)(?:\(\?:([a-z_|]+)\))?/g)].map((m) => [m[1], m[3] ? m[3].split("|").map((a) => m[2] + a) : [m[2]]]);
    const problems = [];
    for (const c of behav) {
      const pfm = front(readEv(c, "prompt.md"));
      const runs = +((pfm.match(/^runs:\s*(\d+)\s*$/m) || [])[1]), turns = +((pfm.match(/^max_turns:\s*(\d+)\s*$/m) || [])[1]);
      if (!(runs >= 2 && runs <= 3 && turns > 0 && turns <= 20)) problems.push(`${c}: runs 2-3 and max_turns <= 20 (got ${runs} / ${turns})`);
      const cy = fs.existsSync(path.join(evDir, c, "case.yaml")) ? readEv(c, "case.yaml") : "";
      if (!/^schema_version: "1\.1"\s*$/m.test(cy) || !/^\s+scaffold_script: fixture\.sh\s*$/m.test(cy)) problems.push(`${c}: case.yaml (schema 1.1 + scaffold_script: fixture.sh)`);
      const fx = fs.existsSync(path.join(evDir, c, "fixture.sh")) ? readEv(c, "fixture.sh") : "";
      if (!fx.includes('. "$(dirname "${BASH_SOURCE[0]}")/../fixtures/lib.sh"')) problems.push(`${c}: fixture.sh must source ../fixtures/lib.sh`);
      const graders = fs.readdirSync(path.join(evDir, c, "graders")).filter((g) => g.endsWith(".md"));
      const types = graders.map((g) => {
        const gfm = front(readEv(c, "graders", g));
        const type = (gfm.match(/^type:\s*(\S+)\s*$/m) || [])[1];
        if (!["regex", "tool_used", "tool_order", "file_exists", "llm"].includes(type)) problems.push(`${c}/${g}: unknown type ${type}`);
        const flags = (gfm.match(/^flags:\s*(\S+)\s*$/m) || [])[1] || "";
        const refs = mcpRefs((gfm.match(/^tool:\s*(\S+)\s*$/m) || [])[1] || "");
        for (const k of ["pattern", "input_match"]) {
          const re = yamlQuoted(gfm, k);
          if (re == null) continue;
          try { new RegExp(re, flags); } catch (e) { problems.push(`${c}/${g}: ${k} does not compile (${e.message})`); }
          refs.push(...mcpRefs(re));
        }
        if ((type === "regex" && yamlQuoted(gfm, "pattern") == null) || (type === "tool_used" && !/^tool:\s*\S+/m.test(gfm))) problems.push(`${c}/${g}: ${type} without its pattern / tool`);
        for (const [pre, names] of refs) {
          if (pre !== prefix) problems.push(`${c}/${g}: MCP prefix ${pre} is not ${prefix}`);
          names.filter((n) => !toolNames.has(n)).forEach((n) => problems.push(`${c}/${g}: no MCP tool named ${n}`));
        }
        return type;
      });
      if (graders.length < 3 || !types.some((t) => t !== "llm")) problems.push(`${c}: at least 3 graders, one of them deterministic`);
    }
    const langs = ["en", "pt", "es"].filter((l) => behav.some((c) => new RegExp(`^\\s+- ${l}\\s*$`, "m").test(readEv(c, "prompt.md"))));
    const evReadme = readEv("README.md");
    ok(behav.length >= 5 && langs.length === 3 && !problems.length && behav.every((c) => evReadme.includes("`" + c + "`")) &&
      /--scaffold/.test(evReadme) && /--allow-real-servers/.test(evReadme) && evReadme.includes(prefix + "*"),
      `plugin evals: ${behav.length} behavioural cases (EN/PT/ES) — 2-3 runs, <= 20 turns, a scaffold fixture, >= 3 graders incl. a deterministic one, every regex compiles, every MCP tool they name exists (${prefix}…); the README lists each and how to run them` +
      (problems.length ? " — " + problems.join(" · ") : ""));

    // Build every fixture exactly as `claude plugin eval --scaffold` does (bash, cwd = an empty workspace) and check the
    // premise each case relies on. Needs bash (Git Bash on Windows, like the eval harness); skipped without it.
    const bashBin = (process.platform === "win32"
      ? [process.env.DEV_SPEC_TEST_BASH, "C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files\\Git\\usr\\bin\\bash.exe"]
      : [process.env.DEV_SPEC_TEST_BASH, "bash"]).filter(Boolean).find((b) => { try { return spawnSync(b, ["--version"], { encoding: "utf8" }).status === 0; } catch { return false; } });
    if (!bashBin) ok(true, "plugin evals: behavioural fixtures build — skipped (no bash here; set DEV_SPEC_TEST_BASH)");
    else {
      const fxRoot = path.join(tmp, "a3-eval-fixtures");
      const gitHome = path.join(tmp, "a3-eval-home");
      fs.mkdirSync(gitHome, { recursive: true });
      const env = { ...process.env, HOME: gitHome, USERPROFILE: gitHome, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(gitHome, "none.gitconfig") };
      const built = {};
      const buildErr = [];
      for (const c of behav) {
        const ws = path.join(fxRoot, c);
        fs.mkdirSync(ws, { recursive: true });
        const r = spawnSync(bashBin, [path.join(evDir, c, "fixture.sh")], { cwd: ws, env, encoding: "utf8", timeout: 120000 });
        if (r.status === 0) built[c] = ws; else buildErr.push(`${c}: exit ${r.status} ${(r.stderr || "").trim().slice(0, 300)}`);
      }
      const at = (c) => built[c] || path.join(fxRoot, "__missing__");
      const git = (c, ...a) => { const r = spawnSync("git", a, { cwd: at(c), env, encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() : null; };
      const safeA3 = (f) => { try { return f(); } catch (e) { return { error: String(e && e.message || e) }; } };
      // Plan-first + bugfix: a plain project with no .specs/, and the coupon defect is real (PROMO10 twice → 81, not 90).
      const discount = safeA3(() => { const m = require(path.join(at("behavior-bugfix-root-cause-pt"), "src", "discount.js")); return m.applyCoupon(m.applyCoupon(m.newCart(100), "PROMO10"), "PROMO10").total; });
      const plain = ["behavior-plan-first-en", "behavior-bugfix-root-cause-pt"].every((c) => built[c] && !fs.existsSync(path.join(at(c), ".specs")) && git(c, "log", "--oneline") !== null);
      // Evidence cases: every planning phase approved, task 1 verified, task 2 (with a runnable _Verify:_) is next.
      const evidenceReady = [["behavior-evidence-recorded-es", "exportar-csv"], ["behavior-evidence-no-bare-tick-en", "csv-export"]].every(([c, f]) => {
        const n = safeA3(() => S.nextTask(at(c), f)), d = safeA3(() => S.specDoctor(at(c), f));
        const v = safeA3(() => S.verificationStatus(at(c), f, path.join(at(c), ".specs", f)));
        return n.ok && n.next && n.next.number === 2 && d.ok && d.gatesOk === true && Array.isArray(v.unverified) && !v.unverified.length &&
          /_Verify: node --test test\/cli\.test\.js_/.test(fs.readFileSync(path.join(at(c), ".specs", f, "tasks.md"), "utf8"));
      });
      // Finish: READY on its feature branch, main holds the app before the feature.
      const fin = safeA3(() => S.finishFeature(at("behavior-finish-local-merge-en"), "csv-export"));
      const finReady = fin.ok && fin.readyToFinish === true && git("behavior-finish-local-merge-en", "rev-parse", "--abbrev-ref", "HEAD") === "feat/csv-export" &&
        git("behavior-finish-local-merge-en", "rev-parse", "--verify", "-q", "main") !== null;
      // Gate: requirements approved, the design gate refuses on the unfilled [SaaS] sections (nothing recorded).
      const gate = safeA3(() => S.approvePhase(at("behavior-gate-refused-es"), "limite-peticiones", "design", "a3-test"));
      const gateState = safeA3(() => S.readState(at("behavior-gate-refused-es"), "limite-peticiones"));
      const gateOk = gate.ok === false && (gate.failing || []).includes("saas-sections") && gateState && gateState.approvals &&
        gateState.approvals.requirements && !gateState.approvals.design;
      // Upgrade: an older .specs/ — no specVersion, tracks to save for both features, legacy approvals without a baseline.
      const up = safeA3(() => S.specUpgrade(at("behavior-upgrade-audit-pt")));
      const upOk = up.ok && up.needsUpgrade === true && up.from == null && up.plan && up.plan.tracks.length === 2 &&
        up.plan.history.skip.some((x) => x.reason === "no-fingerprint") && up.lang === "pt";
      ok(!buildErr.length && behav.every((c) => built[c]) && discount === 81 && plain && evidenceReady && finReady && gateOk && upOk,
        "plugin evals: every behavioural fixture builds with the current engine (bash " + (process.platform === "win32" ? "— Git Bash" : "") + ") and holds its premise — plan/bugfix: no .specs/, the coupon bug is real; " +
        "evidence: gates approved, task 1 verified, task 2 next with its _Verify:_; finish: ready on feat/csv-export; gate: design refused on saas-sections; upgrade: pre-1.13 audit in PT" +
        (buildErr.length ? " — " + buildErr.join(" · ") : "") +
        ` (got discount=${discount}, plain=${plain}, evidence=${evidenceReady}, finish=${finReady}, gate=${gateOk}${gate.failing ? " " + gate.failing.join(",") : ""}, upgrade=${upOk})`);
    }
  }
};
