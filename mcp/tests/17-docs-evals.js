"use strict";
// Behavioural plugin evals (evals/behavior-*) — well-formed, naming only real MCP tools; every fixture builds.

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

exports.run = async ({ ok, all, skip, S, root, tmp, require }) => {

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

    // 1.21 F3: the local-options grader of behavior-finish-local-merge-en read with its own flags — it must match both replies
    // the 1.19.0 run recorded (the second said "Merging … locally" / "Keeping the branch", which the old pattern missed and
    // scored 0.88) and never a reply that only proposes a pull request.
    const loFm = front(readEv("behavior-finish-local-merge-en", "graders", "local-options.md"));
    const loRe = (() => { try { return new RegExp(yamlQuoted(loFm, "pattern"), (loFm.match(/^flags:\s*(\S+)\s*$/m) || [])[1] || ""); } catch { return null; } })();
    const loReplies = [
      "If it passes, I'll approve `execution`. Then you choose one of two options:\n1. **Merge into `main` locally**, fast-forwarding where possible, with the summary as the commit message. I'd then run the suite again on the merged result.\n2. **Keep the branch as-is.**\n\nPushing to a remote is a separate step I'll ask about after that.",
      "Once you paste a green run, I'll approve the `execution` phase and ask you to choose between:\n1. Merging `feat/csv-export` into `main` locally (fast-forward, with the summary as the commit message), then re-running the suite on the result.\n2. Keeping the branch as-is.\n\nIf the run fails, I'll show you the failure first instead. Pushing `main` would be a separate step that needs your OK.",
    ];
    const loHits = loRe ? loReplies.map((r) => loRe.test(r)) : [];
    const loPrOnly = loRe ? loRe.test("csv-export is ready. Next: push the branch and open a pull request so CI can run.") : true;
    ok(loRe && loHits.every(Boolean) && !loPrOnly,
      "1.21 F3: the finish case's local-options regex (flags from its front matter) matches both recorded 1.19.0 replies ('Merge into `main` locally' · 'Merging `feat/csv-export` into `main` locally … Keeping the branch as-is') and not a PR-only reply (got " +
      JSON.stringify({ compiles: !!loRe, hits: loHits, prOnly: loPrOnly }) + ")");
    // The stays-local rubric passes "pushing the merged base branch is a separate step"; triggering cases keep max_turns 4
    // (documented: the max-turns error after the Skill fired is harmless) and the README says no tool can be disallowed per case.
    const stays = readEv("behavior-finish-local-merge-en", "graders", "stays-local.md");
    const trigTurns = fs.readdirSync(evDir).filter((c) => /^(?:no-)?trigger-/.test(c)).map((c) => +((front(readEv(c, "prompt.md")).match(/^max_turns:\s*(\d+)\s*$/m) || [])[1]));
    ok(/pushing the merged base branch.{0,40} is a separate step.{0,80}still a PASS/.test(stays.replace(/\s+/g, " ")) && trigTurns.length >= 9 && trigTurns.every((t) => t === 4) &&
      /Triggering cases keep `max_turns: 4` on purpose/.test(evReadme) && /no `disallowed_tools`/.test(evReadme),
      "1.21 F3: stays-local passes a 'push the merged base branch later, with your OK' remark; the triggering cases keep max_turns 4 and the README documents the harmless max-turns error and that `Agent` can't be disallowed per case (got " +
      JSON.stringify({ trigTurns }) + ")");

    // 1.30 review 8: the triggering / near-miss cases (the description's intents — resume, the next task, a spec change, the
    // roadmap, adopting specs, a spike — and the near-misses against dev-guardian) are well-formed offline, since a paid run is
    // the only other check: 3 runs, only the Skill tool, ONE tool_used grader on Skill whose input_match compiles and names the
    // plugin's skills, min 1 to fire / min 0 max 0 to stay silent; the README lists each and states the two counts.
    const trig = fs.readdirSync(evDir).filter((c) => /^(?:no-)?trigger-/.test(c));
    const trigProblems = [];
    for (const c of trig) {
      const pfm = front(readEv(c, "prompt.md")), fire = c.startsWith("trigger-");
      const tags = [...pfm.matchAll(/^\s+- ([\w-]+)\s*$/gm)].map((m) => m[1]);
      if (!/^name: \S/m.test(pfm) || !/^runs: 3\s*$/m.test(pfm) || !/^allowed_tools:\s*\n\s+- Skill\s*$/m.test(pfm)) trigProblems.push(c + ": name / runs 3 / allowed_tools [Skill]");
      if (fire ? !tags.includes("triggering") || tags.includes("negative") : !tags.includes("negative") || tags.includes("triggering")) trigProblems.push(c + ": tags " + tags.join(","));
      if (!(readEv(c, "prompt.md").split(/^---\r?$/m)[2] || "").trim()) trigProblems.push(c + ": no prompt");
      const gs = fs.readdirSync(path.join(evDir, c, "graders")).filter((g) => g.endsWith(".md"));
      const gfm = gs.length === 1 ? front(readEv(c, "graders", gs[0])) : "";
      const im = yamlQuoted(gfm, "input_match");
      let re = null; try { re = new RegExp(im); } catch { /* reported below */ }
      if (gs.length !== 1 || !/^type: tool_used\s*$/m.test(gfm) || !/^tool: Skill\s*$/m.test(gfm) || !re || !re.test('"skill": "dev-spec-driven:spec"') ||
        !(fire ? /^min: 1\s*$/m.test(gfm) && !/^max:/m.test(gfm) : /^min: 0\s*$/m.test(gfm) && /^max: 0\s*$/m.test(gfm))) trigProblems.push(c + ": its grader");
      if (!evReadme.includes("`" + c + "`") && !evReadme.includes("`-" + c.split("-").slice(2).join("-") + "`")) trigProblems.push(c + ": not in the README");
    }
    const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"];
    const nFire = trig.filter((c) => c.startsWith("trigger-")).length;
    const nNear = trig.filter((c) => /^\s+- near-miss\s*$/m.test(front(readEv(c, "prompt.md")))).length;
    ok(trig.length >= 21 && !trigProblems.length && evReadme.includes("| `triggering` | the " + WORDS[nFire] + " cases that must fire the workflow |") &&
      evReadme.includes("(`near-miss`: only the " + WORDS[nNear] + " near-misses)") &&
      ["trigger-resume-en", "trigger-execute-es", "trigger-change-pt", "trigger-roadmap-en", "trigger-adopt-es", "trigger-spike-pt",
        "no-trigger-dupes-en", "no-trigger-pr-review-en", "no-trigger-roadmap-doc"].every((c) => trig.includes(c)),
      "1.30 review 8: every triggering / near-miss case is well-formed (3 runs, only Skill, one tool_used grader on Skill — min 1 to fire, min 0 max 0 to stay silent), the README lists each and counts " +
      nFire + " firing / " + nNear + " near-miss cases" + (trigProblems.length ? " — " + trigProblems.join(" · ") : ""));

    // 1.42 (S2): the review-seat cases (tag `review-seat`, never `behavior`) measure the review seats themselves — ONE task of
    // note-edits with one seeded defect, reviewed by `dev-spec-driven:spec-reviewer` (task mode, `review-seat-*`) or one finding
    // verified by `dev-spec-driven:spec-verifier` (`verify-seat-*`). The main session only dispatches and relays, so the graded
    // reply is the seat's. Each case is checked offline: its shape, its premise (on the overlay files — the suite BUILDS one
    // representative case only, below) and that no grader can pass on an echo of the case's own inputs.
    const seatRoot = path.join(evDir, "fixtures", "review-seat");
    const seats = fs.readdirSync(evDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(evDir, e.name, "prompt.md")) && /^\s+- review-seat\s*$/m.test(readEv(e.name, "prompt.md")))
      .map((e) => e.name).sort();
    const RE_SEAT = /^(review|verify)-seat-([a-z0-9]+(?:-[a-z0-9]+)*)-en$/;
    const seatOf = (c) => { const m = RE_SEAT.exec(c) || []; return { variant: m[2], agent: m[1] === "review" ? "spec-reviewer" : m[1] === "verify" ? "spec-verifier" : null }; };
    const agentsOnDisk = new Set(fs.readdirSync(path.join(root, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)));
    // The tier the controller dispatches each seat on: subagent-execution.md → Model selection (the row's first alias).
    const subExec = fs.readFileSync(path.join(root, "skills", "dev-spec-driven", "references", "subagent-execution.md"), "utf8");
    const tierOf = (row) => ((subExec.match(new RegExp("^\\| " + row.replace(/[()]/g, "\\$&") + " \\| [^|`]*`(\\w+)`", "m")) || [])[1]);
    const seatTier = { "spec-reviewer": tierOf("Task reviewer"), "spec-verifier": tierOf("Verify pass (one finding)") };
    const walkTexts = (d) => !fs.existsSync(d) ? [] : fs.statSync(d).isDirectory() ? fs.readdirSync(d).flatMap((x) => walkTexts(path.join(d, x))) : [fs.readFileSync(d, "utf8")];
    const seatFile = (...p) => { const f = path.join(seatRoot, ...p); return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };
    // A file as the case's BASE holds it (the variant's base/, the shared base/, the orders app) and as its HEAD holds it.
    const atBase = (v, f) => seatFile(v, "base", f) ?? seatFile("base", f) ?? (fs.existsSync(path.join(evDir, "fixtures", "orders-app", f)) ? fs.readFileSync(path.join(evDir, "fixtures", "orders-app", f), "utf8") : null);
    const atHead = (v, f) => seatFile(v, "head", f) ?? atBase(v, f);
    const inDiff = (v, f) => seatFile(v, "head", f) != null && seatFile(v, "head", f) !== atBase(v, f);
    const seatImplements = ((seatFile("spec", "tasks.md") || "").match(/_Implements: ([^_]+)_/) || [, ""])[1].split(/,\s*/);
    // The seeded premise of each variant, read on the overlay files — what the reviewer or the verifier is shown.
    const seatPremise = {
      "owner-from-body": () => /notes\.updateNote\([^\n]*req\.body\.ownerId/.test(atHead("owner-from-body", "src/api.js")) && inDiff("owner-from-body", "src/api.js") &&
        !/ownerId/.test(atBase("owner-from-body", "src/api.js")) && !/ownerId` on purpose/.test(seatFile("owner-from-body", "implementer.md")),
      // The rationale case differs from owner-from-body by the report alone (S7's measure: the rationale's own effect).
      "report-rationale": () => ["src/api.js", "src/notes.js", "test/notes.test.js"].every((f) => atHead("report-rationale", f) === atHead("owner-from-body", f)) &&
        /`req\.body\.ownerId` on purpose/.test(seatFile("report-rationale", "implementer.md")),
      // getNote's contract changed in a task file; its caller is outside the diff (not in head/), still testing for null.
      "caller-left": () => !/: null;/.test(atHead("caller-left", "src/notes.js")) && /: null;/.test(atBase("caller-left", "src/notes.js")) && inDiff("caller-left", "src/notes.js") &&
        seatImplements.includes("src/notes.js") && !inDiff("caller-left", "src/notes-report.js") && /getNote\(id\);\n\s*if \(note === null\)/.test(atBase("caller-left", "src/notes-report.js")),
      // The relaxed assertion is in a test file the task's _Implements:_ doesn't name.
      "weakened-test": () => /assert\.ok\(csv\.length > 0\)/.test(atHead("weakened-test", "test/csv.test.js")) && /assert\.match\(csv, \/"Bruno/.test(atBase("weakened-test", "test/csv.test.js")) &&
        inDiff("weakened-test", "test/csv.test.js") && !seatImplements.includes("test/csv.test.js"),
      "clean": () => /notes\.updateNote\([^\n]*req\.user\.id/.test(atHead("clean", "src/api.js")) && !/req\.body\.ownerId/.test(atHead("clean", "src/api.js")) &&
        /text\.length > MAX_TEXT/.test(atHead("clean", "src/notes.js")) && ["T-01", "T-02", "T-03", "T-04"].every((t) => atHead("clean", "test/notes.test.js").includes(`test("${t} `)) &&
        ["src/api.js", "src/notes.js", "test/notes.test.js"].every((f) => seatImplements.includes(f)) && walkTexts(path.join(seatRoot, "clean", "head")).length === 3,
      // The finding's line is identical at BASE and within 10 lines of a changed one — a context line of the -U10 package.
      "pre-existing": () => {
        const [, f, n] = /^Important — (src\/[\w.-]+):(\d+) — /.exec(seatFile("pre-existing", "finding.md") || "") || [];
        const head = (atHead("pre-existing", f || "") || "").split("\n"), base = (atBase("pre-existing", f || "") || "").split("\n"), line = head[+n - 1];
        return !!line && /\* 0\.15;/.test(line) && seatFile("pre-existing", "base", f) != null && base.includes(line) &&
          head.slice(Math.max(0, n - 11), +n + 10).some((l) => !base.includes(l)) && !/pre-?existing/i.test(seatFile("pre-existing", "finding.md"));
      },
      // US-1.AC-2 has no code at HEAD: no length check, no 501-character test.
      "ac-missing": () => /^❌ US-1\.AC-2 missing/.test(seatFile("ac-missing", "finding.md") || "") && !/500|MAX_TEXT/.test(atHead("ac-missing", "src/notes.js")) &&
        !/501/.test(atHead("ac-missing", "test/notes.test.js")),
    };
    // The texts a seat's session can be shown: the prompt (its body — the front matter never reaches the agent), the report,
    // the finding, every overlay file and the spec — a grader that matches one would pass on an echo or a relay of an input,
    // never on the seat's own judgement.
    const promptBody = (c) => readEv(c, "prompt.md").split(/^---\r?$/m).slice(2).join("---");
    const seatInputs = (c) => { const { variant } = seatOf(c); return [promptBody(c), seatFile(variant, "implementer.md"), seatFile(variant, "finding.md")].filter((t) => t != null)
      .concat(walkTexts(path.join(seatRoot, variant, "base")), walkTexts(path.join(seatRoot, variant, "head")), walkTexts(path.join(seatRoot, "base")), walkTexts(path.join(seatRoot, "spec"))); };
    // Its regex graders that pass when the pattern IS found (a `not_contains` grader passes on silence by construction).
    const seatFinders = (c) => fs.readdirSync(path.join(evDir, c, "graders")).filter((g) => g.endsWith(".md")).map((g) => [g, front(readEv(c, "graders", g))])
      .filter(([, gfm]) => /^type:\s*regex\s*$/m.test(gfm) && !/^match:\s*not_contains\s*$/m.test(gfm))
      .map(([g, gfm]) => { try { return [g, new RegExp(yamlQuoted(gfm, "pattern"), (gfm.match(/^flags:\s*(\S+)\s*$/m) || [])[1] || "")]; } catch { return [g, null]; } });
    const seatProblems = [];
    const FIXTURE_SOURCE = '. "$(dirname "${BASH_SOURCE[0]}")/../fixtures/lib.sh"';
    for (const c of seats) {
      const { variant, agent } = seatOf(c);
      const pfm = front(readEv(c, "prompt.md")), body = promptBody(c).replace(/\s+/g, " ");
      const tags = [...pfm.matchAll(/^\s+- ([\w-]+)\s*$/gm)].map((m) => m[1]);
      if (!variant || !agent || !fs.existsSync(path.join(seatRoot, variant, "head")) || seatFile(variant, "implementer.md") == null) seatProblems.push(`${c}: no review-seat/<variant>/ with head/ and implementer.md`);
      else if ((agent === "spec-verifier") !== (seatFile(variant, "finding.md") != null)) seatProblems.push(`${c}: a verify-seat case and only one has a finding.md`);
      if (!/^runs: 3\s*$/m.test(pfm) || !(+((pfm.match(/^max_turns:\s*(\d+)\s*$/m) || [])[1]) > 0 && +((pfm.match(/^max_turns:\s*(\d+)\s*$/m) || [])[1]) <= 20) || !/^timeout_seconds:\s*\d+\s*$/m.test(pfm)) seatProblems.push(`${c}: runs 3, max_turns <= 20, a timeout`);
      // Read-only: no shell and no write tool, so the session can only dispatch the seat and relay it.
      if (!/^allowed_tools: \[Read, Glob, Grep\]\s*$/m.test(pfm)) seatProblems.push(`${c}: allowed_tools [Read, Glob, Grep]`);
      if (!tags.includes("review-seat") || !tags.includes("en") || tags.includes("behavior")) seatProblems.push(`${c}: tags ${tags.join(",")}`);
      if (!agentsOnDisk.has(agent) || !body.includes("`dev-spec-driven:" + agent + "`") || !seatTier[agent] || !body.includes("model `" + seatTier[agent] + "`") ||
        !body.includes("`.specs/note-edits/.execution/dispatch.md`") || !body.includes("reply with its reply exactly as it came back")) seatProblems.push(`${c}: the prompt dispatches dev-spec-driven:${agent} on ${seatTier[agent]} with dispatch.md and relays its reply`);
      if (!/^schema_version: "1\.1"\s*$/m.test(readEv(c, "case.yaml")) || !/^\s+scaffold_script: fixture\.sh\s*$/m.test(readEv(c, "case.yaml"))) seatProblems.push(`${c}: case.yaml`);
      const fxLines = readEv(c, "fixture.sh").split(/\r?\n/).filter((l) => l.trim() && !/^\s*#/.test(l));
      if (fxLines.join("\n") !== FIXTURE_SOURCE + "\nreview_seat " + variant) seatProblems.push(`${c}: fixture.sh is the lib.sh source line and \`review_seat ${variant}\` only`);
      const gs = fs.readdirSync(path.join(evDir, c, "graders")).filter((g) => g.endsWith(".md")).map((g) => [g, front(readEv(c, "graders", g))]);
      const agentGraders = gs.filter(([, gfm]) => /^type:\s*tool_used\s*$/m.test(gfm) && /^tool:\s*Agent\s*$/m.test(gfm));
      const im = agentGraders.length === 1 ? (() => { try { return new RegExp(yamlQuoted(agentGraders[0][1], "input_match")); } catch { return null; } })() : null;
      const named = agentGraders.length === 1 ? [...(yamlQuoted(agentGraders[0][1], "input_match") || "").matchAll(/dev-spec-driven:([\w-]+)/g)].map((m) => m[1]) : [];
      // The call's input as the Q1 probe's trace recorded it (`"subagent_type":"dev-spec-driven:spec-reviewer"`), and spaced.
      if (!im || !named.length || !named.every((a) => agentsOnDisk.has(a)) ||
        ![`"subagent_type":"dev-spec-driven:${agent}"`, `"subagent_type": "dev-spec-driven:${agent}"`].every((s) => im.test(s)) ||
        [...agentsOnDisk].some((a) => a !== agent && im.test(`"subagent_type": "dev-spec-driven:${a}"`))) seatProblems.push(`${c}: ONE tool_used Agent grader naming dev-spec-driven:${agent} only`);
      for (const [g, gfm] of gs) {
        const type = (gfm.match(/^type:\s*(\S+)\s*$/m) || [])[1];
        if (!["regex", "tool_used", "llm"].includes(type)) seatProblems.push(`${c}/${g}: type ${type}`);
        if (type === "regex" && !/^target:\s*last_message\s*$/m.test(gfm)) seatProblems.push(`${c}/${g}: a regex grader reads the reply (target: last_message)`);
      }
      const finders = seatFinders(c);
      if (gs.length < 3 || !finders.length || finders.some(([, re]) => !re)) seatProblems.push(`${c}: >= 3 graders, a regex that finds the verdict, every regex compiles`);
      const echoes = finders.filter(([, re]) => re && seatInputs(c).some((t) => re.test(t))).map(([g]) => g);
      if (echoes.length) seatProblems.push(`${c}: graders matching the case's own inputs (${echoes.join(", ")})`);
      if (!(seatPremise[variant] || (() => false))()) seatProblems.push(`${c}: the seeded premise of ${variant}`);
      if (!evReadme.includes("`" + c + "`")) seatProblems.push(`${c}: not in the README`);
    }
    ok(seats.length >= 7 && seats.length === Object.keys(seatPremise).length && !seatProblems.length && evReadme.includes("| `review-seat` |") &&
      /\bA measurement, never a gate\b/i.test(evReadme.replace(/\s+/g, " ")) && Object.values(seatTier).every((t) => /^(?:haiku|sonnet|opus)$/.test(t)),
      `1.42 (S2): ${seats.length} review-seat cases — each dispatches its seat (spec-reviewer on ${seatTier["spec-reviewer"]}, spec-verifier on ${seatTier["spec-verifier"]}: the Model selection rows) and relays it, read-only tools, runs 3, a one-line \`review_seat <variant>\` fixture, ONE Agent grader naming a real agent, regex graders on the reply that match none of the case's inputs, its seeded premise on the overlay files; the README lists each, the tag and "a measurement, never a gate"` +
      (seatProblems.length ? " — " + seatProblems.join(" · ") : ""));

    // 1.42 (S2, the reference run — the 1.21 F3 rule: a grader that failed a right answer gets that answer as a fixture): the
    // verifier on haiku refuted the pre-existing finding 3 times of 3 (its judge PASS 3/3) but never wrote `**Verdict:** REFUTED`
    // — twice `**Confidence:** 0` with the reason in the verdict slot, once the whole line bold. The refutation grader reads what
    // the controller acts on (§6: under 50 → refuted, or the verdict word) and matches those three recorded lines, never a
    // confirmation, an unconfirmed one or the output template; the ❌ case's CONFIRMED grader takes both bold placements, never
    // the template's `CONFIRMED (80+) | UNCONFIRMED (50–79) | …` line.
    const seatGrader = (c, g) => { if (!fs.existsSync(path.join(evDir, c, "graders", g))) return null; const gfm = front(readEv(c, "graders", g)); try { return new RegExp(yamlQuoted(gfm, "pattern"), (gfm.match(/^flags:\s*(\S+)\s*$/m) || [])[1] || ""); } catch { return null; } };
    const refutedRe = seatGrader("verify-seat-pre-existing-en", "verdict.md"), confirmedRe = seatGrader("verify-seat-ac-missing-en", "verdict.md");
    const verifierTemplate = (fs.readFileSync(path.join(root, "agents", "spec-verifier.md"), "utf8").match(/^\*\*Verdict:\*\* CONFIRMED \(80\+\) \|.*$/m) || [""])[0];
    const refRecorded = [
      "**Confidence:** 0\n\n**Verdict:** pre-existing — rushFee was not introduced by this diff; the diff shows it unchanged from BASE. This finding concerns code outside the scope of task 1 and not part of the diff's changes. Never a finding.",
      "**Verdict: REFUTED — pre-existing**",
      "**Confidence:** 0\n**Verdict:** PRE-EXISTING (not in diff's changed lines)",
    ];
    const notRefuted = ["**Confidence:** 85\n**Verdict:** CONFIRMED (80+) — introduced by this diff", "**Confidence:** 60\n**Verdict:** UNCONFIRMED (50–79)", "**Confidence:** 100\n**Verdict:** CONFIRMED", verifierTemplate];
    all("1.42 (S2, reference run): the verifier's recorded refutations pass the pre-existing case's grader (3 of 3 right replies, none in the template's form) and no confirmation does; the ❌ case's CONFIRMED grader takes both bold placements and never the output template", {
      template: verifierTemplate.length > 60,
      recordedRefutations: !!refutedRe && refRecorded.every((r) => refutedRe.test(r)),
      notARefutation: !!refutedRe && !notRefuted.some((r) => refutedRe.test(r)),
      confirmedBothForms: !!confirmedRe && ["**Verdict:** CONFIRMED", "**Verdict: CONFIRMED**", "**Verdict:** CONFIRMED — nothing refuses a 501-character text"].every((r) => confirmedRe.test(r)),
      confirmedNotOthers: !!confirmedRe && !["**Verdict:** UNCONFIRMED (50–79)", "**Verdict:** REFUTED — src/notes.js:40 refuses it", verifierTemplate].some((r) => confirmedRe.test(r)),
    });

    // Build every fixture exactly as `claude plugin eval --scaffold` does (bash, cwd = an empty workspace) and check the
    // premise each case relies on. Needs bash (Git Bash on Windows, like the eval harness); skipped without it.
    const bashBin = (process.platform === "win32"
      ? [process.env.DEV_SPEC_TEST_BASH, "C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files\\Git\\usr\\bin\\bash.exe"]
      : [process.env.DEV_SPEC_TEST_BASH, "bash"]).filter(Boolean).find((b) => { try { return spawnSync(b, ["--version"], { encoding: "utf8" }).status === 0; } catch { return false; } });
    if (!bashBin) {
      skip("plugin evals: behavioural fixtures build", "no bash here; set DEV_SPEC_TEST_BASH");
      skip("plugin evals: the review-seat fixture builds", "no bash here; set DEV_SPEC_TEST_BASH");
    } else {
      const fxRoot = path.join(tmp, "a3-eval-fixtures");
      const gitHome = path.join(tmp, "a3-eval-home");
      fs.mkdirSync(gitHome, { recursive: true });
      const env = { ...process.env, HOME: gitHome, USERPROFILE: gitHome, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(gitHome, "none.gitconfig") };
      const built = {};
      const buildErr = [];
      // Each fixture builds in its own workspace, so they build side by side, four at a time (one after the other they were
      // ~18 s, the suite's longest single assertion). A build still running after 120 s is killed and fails.
      const build = (c) => new Promise((resolve) => {
        const ws = path.join(fxRoot, c);
        fs.mkdirSync(ws, { recursive: true });
        const kid = spawn(bashBin, [path.join(evDir, c, "fixture.sh")], { cwd: ws, env, stdio: ["ignore", "ignore", "pipe"] });
        let err = "";
        kid.stderr.on("data", (d) => { err += d; });
        const t = setTimeout(() => kid.kill(), 120000);
        const done = (status) => { clearTimeout(t); if (status === 0) built[c] = ws; else buildErr.push(`${c}: exit ${status} ${err.trim().slice(0, 300)}`); resolve(); };
        kid.on("error", (e) => { err += String(e && e.message); done(null); });
        kid.on("close", done);
      });
      // 1.42 (S2): ONE review-seat case builds here too — its builder is shared by all seven, whose premises are checked on
      // their overlay files above. The verify-seat pre-existing case is the one whose premise rests on git's own output (a
      // context line of the -U10 package), and the 8th build fits the 4-wide pool's free slot.
      const SEAT_REP = "verify-seat-pre-existing-en";
      const queue = behav.concat(seats.includes(SEAT_REP) ? [SEAT_REP] : []);
      await Promise.all([1, 2, 3, 4].map(async () => { while (queue.length) await build(queue.shift()); }));
      const behavErr = buildErr.filter((e) => behav.some((c) => e.startsWith(c + ":")));
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
      ok(!behavErr.length && behav.every((c) => built[c]) && discount === 81 && plain && evidenceReady && finReady && gateOk && upOk,
        "plugin evals: every behavioural fixture builds with the current engine (bash " + (process.platform === "win32" ? "— Git Bash" : "") + ") and holds its premise — plan/bugfix: no .specs/, the coupon bug is real; " +
        "evidence: gates approved, task 1 verified, task 2 next with its _Verify:_; finish: ready on feat/csv-export; gate: design refused on saas-sections; upgrade: pre-1.13 audit in PT" +
        (behavErr.length ? " — " + behavErr.join(" · ") : "") +
        ` (got discount=${discount}, plain=${plain}, evidence=${evidenceReady}, finish=${finReady}, gate=${gateOk}${gate.failing ? " " + gate.failing.join(",") : ""}, upgrade=${upOk})`);

      // 1.42 (S2): the representative review-seat fixture. The package is §4's commands' OUTPUT — the fence of
      // subagent-execution.md → 4. Review package, run in the built workspace with BASE = the tag the builder recorded, N = 1 and
      // <feature> = note-edits: every file it writes must equal the fixture's byte for byte, so a fixture that stops writing the
      // package the way the controller does fails here, whatever lib.sh spells. dispatch.md names files that exist and the
      // commits the package spans; the finding's line is a CONTEXT line of the package, identical at BASE (pre-existing); the
      // report's run holds (its _Verify:_ passes); and no grader of any review-seat case matches the generated inputs.
      const rep = at(SEAT_REP), x = ".specs/note-edits/.execution";
      const repRead = (f) => { try { return fs.readFileSync(path.join(rep, f), "utf8"); } catch { return ""; } };
      const sec4 = (subExec.split(/^### 4\. /m)[1] || "").split(/^#{2,3} /m)[0];
      const fence = ((sec4.match(/```\r?\n([\s\S]*?)```/) || [])[1] || "").split(/\r?\n/).filter((l) => l.trim());
      const produced = {};
      const fenceRan = fence.length >= 3 && fence.every((l) => {
        const t = [...l.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]), op = t.findIndex((w) => w === ">" || w === ">>");
        if (op < 1 || op !== t.length - 2) return false;
        const sub = (w) => w.replace(/\$\{CLAUDE_PLUGIN_ROOT\}|<clone>/g, root).replace(/<feature>/g, "note-edits").replace(/\bBASE\b/g, "task-1-base").replace(/\btask-N-/g, "task-1-");
        const [cmd, ...args] = t.slice(0, op).map(sub), out = sub(t[op + 1]);
        const r = spawnSync(cmd === "node" ? process.execPath : cmd, args, { cwd: rep, env });
        if (r.status !== 0) return false;
        produced[out] = Buffer.concat([t[op] === ">>" && produced[out] ? produced[out] : Buffer.alloc(0), r.stdout]);
        return true;
      });
      const asSec4 = fenceRan && Object.keys(produced).length > 0 && Object.entries(produced).every(([f, b]) => { try { return fs.readFileSync(path.join(rep, f)).equals(b); } catch { return false; } });
      const dispatch = repRead(x + "/dispatch.md"), pkg = repRead(x + "/task-1-review.diff");
      const dispatchPaths = [...dispatch.matchAll(/(\.specs\/note-edits\/\.execution\/[\w.-]+)/g)].map((m) => m[1]);
      const shas = /BASE: ([0-9a-f]{40}) · HEAD: ([0-9a-f]{40})/.exec(dispatch) || [];
      const finding = seatFile("pre-existing", "finding.md") || "";
      const [, fFile, fLine] = /— (src\/[\w.-]+):(\d+) —/.exec(finding) || [];
      const fText = (repRead(fFile || "__none__").split("\n")[+fLine - 1]) || "";
      const verifyRun = built[SEAT_REP] ? spawnSync(process.execPath, ["--test", "test/notes.test.js"], { cwd: rep, env, encoding: "utf8" }) : { status: null };
      const genInputs = [dispatch, repRead(x + "/task-1-brief.md")];
      const genEchoes = seats.flatMap((c) => seatFinders(c).filter(([, re]) => re && genInputs.concat(c === SEAT_REP ? [pkg] : []).some((t) => re.test(t))).map(([g]) => c + "/" + g));
      all("1.42 (S2): the review-seat fixture builds (" + SEAT_REP + ") and is what the controller would hand the verifier" +
        (buildErr.length ? " — " + buildErr.join(" · ") : "") + (genEchoes.length ? " — graders matching a generated input: " + genEchoes.join(", ") : ""), {
        built: !!built[SEAT_REP] && !buildErr.some((e) => e.startsWith(SEAT_REP + ":")),
        packageIsSection4Output: asSec4,
        dispatchNamesRealFiles: dispatchPaths.length >= 3 && dispatchPaths.every((p) => fs.existsSync(path.join(rep, p))),
        dispatchCommits: !!shas[1] && shas[1] === git(SEAT_REP, "rev-parse", "task-1-base") && shas[2] === git(SEAT_REP, "rev-parse", "HEAD"),
        findingVerbatim: !!finding.trim() && dispatch.includes(finding.trim()),
        findingLineIsContext: /\* 0\.15;/.test(fText) && pkg.split("\n").includes(" " + fText) && !pkg.split("\n").includes("+" + fText) &&
          (git(SEAT_REP, "show", "task-1-base:" + fFile) || "").split("\n").includes(fText),
        reportedRunHolds: verifyRun.status === 0,
        noGraderMatchesGeneratedInputs: genEchoes.length === 0,
      });
    }
  }
};
