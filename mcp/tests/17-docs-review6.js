"use strict";
// Docs — 1.24 review 6 prose guards: the documented flows work (pt-BR, the sizes, the user's approvals), no stale counts.
// The docs' own lists agree with the code (CLI commands, doctor check ids, Node core modules) and their snippets run.
// (17-docs.js and 17-docs-review5.js hold the docs' earlier guards.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, S, root, tmp, list }) => {
  const js = JSON.stringify;
  const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
  const ws = (t) => t.replace(/\s+/g, " ");
  const skillRaw = rd("skills", "dev-spec-driven", "SKILL.md"), skill = ws(skillRaw);
  // 1.26: one README per language (README.md · README.pt.md · README.es.md, the same sections) — each was a "## <language>"
  // block of README.md until then
  const LANG_HEADS = ["README.md", "README.pt.md", "README.es.md"];
  const langSec = (f) => rd(f);
  // a "## <heading>" section of a README (the heading matched by a regex), up to the next "## " heading outside a code fence
  // (the quick start shows a change.md, whose own "## Tasks" sits in a fence)
  const subsec = (text, headRe) => {
    const m = text.match(new RegExp("\\n## " + headRe.source + "[^\\n]*\\n")); if (!m) return "";
    let fenced = false; const out = [];
    for (const l of text.slice(m.index + m[0].length).split("\n")) { if (/^```/.test(l)) fenced = !fenced; else if (!fenced && /^## /.test(l)) break; out.push(l); }
    return out.join("\n");
  };
  const RULE_FILES = [[path.join(".cursor", "rules", "dev-spec-driven.mdc"), "cursor"], [path.join(".windsurf", "rules", "dev-spec-driven.md"), "windsurf"],
    [path.join(".github", "copilot-instructions.md"), "copilot"], ["GEMINI.md", "gemini"]];

  { // 1.24 r6 H1: pt-BR is reachable through the documented flow — SKILL.md names the four codes (spec_classify's lang never
    // says pt-BR: the agent picks it from the user's wording), /spec-setup init (/spec-init until 1.26) and /roadmap offer --lang en|pt|pt-BR|es
    const langSkill = (skill.split("## Language")[1] || "").split("## Core Principles")[0];
    const init = rd("commands", "spec-setup.md"), roadmap = rd("commands", "roadmap.md");
    const hint = (t) => (t.match(/^argument-hint: .*$/m) || [""])[0];
    ok(["`en`", "`pt`", "`pt-BR`", "`es`"].every((c) => langSkill.includes(c)) && /Brazilian/.test(langSkill) && /pick `pt-BR` from the user's wording/.test(langSkill) &&
      /--lang en\|pt\|pt-BR\|es/.test(hint(init)) && /dev-spec init [^`]*--lang en\|pt\|pt-BR\|es/.test(ws(init)) && !/--lang pt\]/.test(init) &&
      /--lang en\|pt\|pt-BR\|es/.test(hint(roadmap)) && !/--lang pt\|es\|en/.test(roadmap),
      "1.24 r6 H1: SKILL.md's Language section names en / pt / pt-BR / es (Brazilian picked from the user's wording); /spec-setup's hint and init CLI line and /roadmap's offer --lang en|pt|pt-BR|es (got " +
      js(langSkill.slice(0, 160)) + ")");
  }

  { // 1.24 r6 H2: Phase 0 passes the size the user confirmed; only m / l (or no size) seed classification.md — s / xs have no
    // classification gate (the documented "approve classification" failed on them: nothing to approve). 1.26: /classify is /spec's
    // Phase 0.
    const cls = ws(rd("commands", "spec.md")), agents = ws(rd("AGENTS.md"));
    const step4 = (skill.split("4. **After Phase 0 approval:**")[1] || "").split("Worked examples:")[0];
    const step0 = (agents.split("0. **Classify**")[1] || "").split("1. **Requirements**")[0];
    const p = path.join(tmp, "proj-r6-h2");
    S.initProject(p, ["core"], "en");
    const sized = ["xs", "s", "m"].map((size) => {
      const c = S.createFeature(p, "Sized " + size, ["core"], "x", undefined, "en", undefined, { size });
      return [size, c.ok === true, c.ok && fs.existsSync(path.join(c.dir, "classification.md")), c.ok && S.approvePhase(p, c.slug, "classification", "t").ok === true];
    });
    const docs = [["spec.md", cls], ["SKILL.md step 4", step4], ["AGENTS.md step 0", step0]];
    const bad = docs.filter(([, t]) => !(/\bm \/ l\b/.test(t) && /\bs\b[^.]*\bxs\b|\bs \/ xs\b|\bs or xs\b/.test(t) && /no `?classification\.md`?/.test(t) &&
      /(?:requirements\.md|`requirements\.md`)[^.]*(?:change\.md|`change\.md`)/.test(t))).map(([f]) => f);
    ok(!bad.length && /spec_create \{name, tracks, summary, size, lang\}/.test(cls) && /spec_create \{name, tracks, size, lang\}/.test(step4) &&
      /dev-spec create "<name>" <tracks> --size <xs\|s\|m\|l> --lang <xx>/.test(step0) &&
      sized.every(([, created]) => created) && sized[0][2] === false && sized[1][2] === false && sized[2][2] === true && sized[0][3] === false && sized[1][3] === false,
      "1.24 r6 H2: /spec's Phase 0, SKILL.md step 4 and AGENTS.md step 0 pass the size to spec_create / create; classification.md (and its approval) only at m / l — s / xs record Phase 0 in requirements.md's / change.md's Summary — as the engine scaffolds (bad: " +
      js(bad) + ", engine " + js(sized) + ")");
  }

  { // 1.24 r6 H3: approvals are the user's in every short rule file — approve is never a "mechanical step", --force only when the
    // user explicitly accepts the failing checks (AGENTS.md said so; the four files `rules <tool>` prints did not)
    const LINE = "Approvals are the user's: run `dev-spec approve <feature> <phase>` only after their explicit yes for that phase — it refuses while the phase's checks fail; `--force` only when the user explicitly accepts the failing checks (it stays flagged).";
    const bad = RULE_FILES.filter(([f]) => { const t = ws(rd(f)); return !t.includes(LINE) || /\|approve\|/.test(t) || /`--force` records a flagged/.test(t) ||
      !/the user approving each phase|user approval at each phase gate/.test(t); }).map(([, tool]) => tool);
    const agents = ws(rd("AGENTS.md"));
    ok(!bad.length && /use it only when the user explicitly accepts the gap/.test(agents) && /Record the user's sign-off \(their explicit yes for that phase\) with `dev-spec approve <feature> <phase>`/.test(agents),
      "1.24 r6 H3: Cursor / Windsurf / Copilot / Gemini rule files — approvals only after the user's explicit yes for that phase, --force only when the user accepts the failing checks, approve not listed among the mechanical steps; AGENTS.md records the user's sign-off (bad: " + js(bad) + ")");
  }

  { // 1.24 r6 H4 + H-I2: INSTALL.md finds a marketplace install's folder (it changes on every update) in PowerShell 5.1 and bash —
    // the SAME node expression, run here against a fake home — and the pre-commit recipe says to re-install after an update
    const inst = rd("INSTALL.md");
    const sec = (inst.split("\n## Your plugin folder")[1] || "").split("\n## ")[0];
    const ps = (sec.match(/```powershell\n([\s\S]*?)```/) || [])[1] || "", sh = (sec.match(/```bash\n([\s\S]*?)```/) || [])[1] || "";
    const expr = (t) => (t.match(/node -p "([^"\n]+)"/) || [])[1];
    const home = path.join(tmp, "r6-h4-home"), installPath = path.join(home, ".claude", "plugins", "cache", "dev-spec-driven-marketplace", "dev-spec-driven", "9.9.9");
    fs.mkdirSync(path.join(home, ".claude", "plugins"), { recursive: true });
    fs.writeFileSync(path.join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({ version: 2, plugins: {
      "other@x": [{ scope: "user", installPath: "elsewhere" }], "dev-spec-driven@dev-spec-driven-marketplace": [{ scope: "user", installPath, version: "9.9.9" }] } }));
    const r = expr(sh) ? spawnSync(process.execPath, ["-p", expr(sh)], { encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home } }) : { stdout: "", status: -1 };
    const pre = ws((inst.split("**Git pre-commit validator**")[1] || "").split("**Eval harness**")[0]);
    ok(expr(ps) && expr(ps) === expr(sh) && /^\$plugin = node -p "/m.test(ps) && /^plugin=\$\(node -p "/m.test(sh) && r.status === 0 && r.stdout.trim() === installPath &&
      /changes on every (?:plugin )?update/.test(ws(sec)) && /CLAUDE_CONFIG_DIR/.test(sec) &&
      /after (?:each|every) plugin update/.test(pre) && /silently/.test(pre) && /re-install this hook/.test(pre),
      "1.24 r6 H4 + H-I2: INSTALL.md → Your plugin folder — one node expression (PowerShell and bash) reads installed_plugins.json and prints the install path (a fake home here: " +
      js([r.status, r.stdout && r.stdout.trim()]) + "), noting it changes on every update; the pre-commit recipe warns instead of going silent and says to re-install after each plugin update");
  }

  { // 1.24 r6 H5 + H-I3: no stale count of tools / commands / agents in any user-facing doc (INTEGRATIONS.md said 51 prompts,
    // integrations/README.md 34 tools) — every count is the live one; nothing is "unreleased"
    const nTools = list.result.tools.length;
    const nCmds = fs.readdirSync(path.join(root, "commands")).filter((f) => f.endsWith(".md")).length;
    const nAgents = fs.readdirSync(path.join(root, "agents")).filter((f) => f.endsWith(".md")).length;
    const COUNTS = [[/\b(\d+)\*{0,2} (?:MCP )?(?:tools|ferramentas|herramientas)\b/g, nTools, "tools"], [/\((\d+) of them\)/g, nTools, "tools"],
      [/\b(\d+) (?:slash )?(?:commands|comandos)\b/g, nCmds, "commands"], [/\b(?:Commands|Comandos) \((\d+)\)/g, nCmds, "commands"],
      [/\b(\d+)(?: of them)?, read from `commands\/\*\.md`/g, nCmds, "prompts"], [/\b(\d+) (?:plugin )?(?:agents|agentes)\b/g, nAgents, "agents"]];
    const DOCS = ["README.md", "README.pt.md", "README.es.md", "INSTALL.md", "llms-install.md", "INTEGRATIONS.md", path.join("integrations", "README.md"), "AGENTS.md", "CONTRIBUTING.md"];
    const found = [], stale = [];
    for (const f of DOCS) {
      const t = ws(rd(f));
      for (const [re, want, what] of COUNTS) for (const m of t.matchAll(re)) { found.push(f + ":" + what); if (Number(m[1]) !== want) stale.push(f + ": " + m[0] + " (live " + want + ")"); }
    }
    const per = (f) => found.filter((x) => x.startsWith(f + ":")).length;
    ok(found.length >= 18 && !stale.length && ["README.md", "README.pt.md", "README.es.md", "INSTALL.md", "llms-install.md", "INTEGRATIONS.md", path.join("integrations", "README.md"), "AGENTS.md"].every((f) => per(f) > 0) &&
      found.includes("INTEGRATIONS.md:prompts") && !/unreleased/i.test(rd("INTEGRATIONS.md")),
      "1.24 r6 H5 + H-I3: README (.md / .pt.md / .es.md) / INSTALL / llms-install / INTEGRATIONS / integrations/README / AGENTS / CONTRIBUTING state the live counts — " + nTools + " tools, " + nCmds +
      " commands (= prompts), " + nAgents + " agents (" + found.length + " counts read; stale: " + js(stale) + "); INTEGRATIONS calls nothing unreleased");
  }

  { // 1.24 r6 H10: languages.md → Adding a language names the identifiers the code has (LOCALE_FILES, BASE_LANGS, the derived LANG_ENUM)
    const lm = ws(rd("docs", "maintainers", "languages.md"));
    const add = (lm.split("**Adding a language:**")[1] || "").split("## ")[0];
    ok(/`LOCALE_FILES`/.test(add) && /`BASE_LANGS`/.test(add) && /`LANG_ENUM`/.test(add) && !/`LOCALES`|to `LANGS`/.test(add) &&
      /const LOCALE_FILES = /.test(rd("mcp", "lib", "i18n.js")) && /const BASE_LANGS = /.test(rd("mcp", "lib", "i18n", "common.js")) && /const LANG_ENUM = spec\.LANGS/.test(rd("mcp", "server.js")),
      "1.24 r6 H10: languages.md's Adding a language names LOCALE_FILES (i18n.js), BASE_LANGS (i18n/common.js) and the MCP lang enum derived from it (server.js LANG_ENUM) — no LOCALES, no hand-edited enums");
  }

  { // 1.24 r6 H11: README's CLI summary (EN / PT / ES) names every command the CLI has (tracks and bundle were missing)
    const cmds = [...rd("cli", "dev-spec.js").matchAll(/^ {4}case "([a-z][a-z-]*)":/gm)].map((m) => m[1]).filter((c) => !["help", "na", "milestones"].includes(c));
    const missing = LANG_HEADS.map((h) => {
      const block = (subsec(langSec(h), /(?:The `dev-spec` CLI|A CLI `dev-spec`|La CLI `dev-spec`)/).match(/```text\n([\s\S]*?)```/) || [])[1] || "";
      return [h, block.length, cmds.filter((c) => !new RegExp("(?:^|[\\s·])" + c + "(?=[\\s\\[<]|$)", "m").test(block))];
    });
    ok(cmds.length >= 45 && missing.every(([, len, miss]) => len > 300 && !miss.length) && ["tracks", "bundle"].every((c) => cmds.includes(c)),
      "1.24 r6 H11: the CLI summary of README.md / .pt.md / .es.md lists all " + cmds.length + " CLI commands (got missing: " + js(missing.map(([h, , m]) => [h, m])) + ")");
  }

  { // 1.24 r6 H12: tooling-reference.md's spec_doctor list names every check id the engine emits (track-pack-missing, spike were not)
    const eng = (f) => rd("mcp", "lib", "engine", f);
    const ids = new Set([...[...eng("doctor.js").matchAll(/\badd\("([a-z][a-z-]*)"/g)].map((m) => m[1]),
      ...[...eng("decisions.js").matchAll(/\badd\("([a-z][a-z-]*)", (?:"(?:fail|warn|pass)"|[a-z])/g)].map((m) => m[1]),
      ...fs.readdirSync(path.join(root, "mcp", "lib", "engine")).filter((f) => f.endsWith(".js")).flatMap((f) => [...eng(f).matchAll(/\bid: "([a-z][a-z-]*)", status/g)].map((m) => m[1]))]);
    const sec = (rd("skills", "dev-spec-driven", "references", "tooling-reference.md").split("### `spec_doctor` checks (stable ids)")[1] || "").split("\n## ")[0];
    const listed = new Set([...sec.matchAll(/`([a-z][a-z-]*)`/g)].map((m) => m[1]));
    const missing = [...ids].filter((id) => !listed.has(id));
    ok(ids.size >= 40 && ids.has("track-pack-missing") && ids.has("spike") && !missing.length && /`track-pack-missing` \(/.test(sec.split("- **Warn:**")[1] || ""),
      "1.24 r6 H12: tooling-reference's spec_doctor checks list every id the engine emits (" + ids.size + "; missing: " + js(missing) + ") — track-pack-missing among the warns");
  }

  { // 1.24 r6 H13: the docs say what the demo is — the root README's tree names no older shape than examples/README.md, and
    // examples/README.md says its design has no Reuse & Integration (approved before 1.19: doctor notes it, never warns) for
    // as long as that is true (the demo doubles as the pre-1.19 approval fixture of 15-quality's design-reuse tests)
    const demo = path.join(tmp, "r6-h13", "demo-project");
    fs.cpSync(path.join(root, "examples", "demo-project"), demo, { recursive: true });
    const reuse = (S.specDoctor(demo, "api-keys").checks.find((c) => c.id === "design-reuse") || {});
    const hasReuse = /^## Reuse & Integration$/m.test(rd("examples", "demo-project", ".specs", "api-keys", "design.md"));
    // 1.26: each README (EN / PT / ES) has the tree, its comments in its language — "current shape" / "formato atual" / "formato actual"
    const trees = LANG_HEADS.map((f) => (rd(f).match(/^├── examples\/demo-project\/ .*$/m) || [""])[0]);
    const intro = ws(rd("examples", "README.md").split("## Verify it yourself")[0]);
    ok(reuse.status === "pass" && (hasReuse ? !/approved before/.test(reuse.detail || "")
      : /^design approved before 1\.19/.test(reuse.detail || "") && /missing on purpose: \*\*Reuse & Integration\*\*/.test(intro) && /approved before 1\.19/.test(intro)) &&
      trees.every((tree, i) => tree && !/\d+\.\d+ shape|formato (?:da|de la) \d/.test(tree) && [/current shape/, /formato atual/, /formato actual/][i].test(tree)),
      "1.24 r6 H13: examples/README.md says the demo design has no Reuse & Integration (approved before 1.19 — doctor's design-reuse: " + js(reuse.detail) +
      "); the README trees (EN / PT / ES) say the current shape, as examples/README.md does — never the 1.14 shape (got " + js(trees) + ")");
  }

  { // 1.24 r6 H14: small prose fixes — spec_add_track's MCP form is remove: true; CONTRIBUTING's Node core list is CLAUDE.md's; the
    // observed-evidence hook runs on Bash AND PowerShell; SKILL.md is English, not "trilingual". 1.26: its description lists no
    // PT / ES trigger phrases any more ("Works in English, Portuguese and Spanish") — so the README trees (EN / PT / ES) say it is
    // written in English and works in EN / PT / ES, never "PT / ES triggers"
    const coreList = (t) => ((ws(t).match(/use only Node core \(([^)]*)\)/) || [])[1] || "").match(/`[a-z_]+`/g) || [];
    const claude = coreList(rd("CLAUDE.md")), contrib = coreList(rd("CONTRIBUTING.md"));
    const obsRow = (rd("INTEGRATIONS.md").match(/^\| Observed evidence.*$/m) || [""])[0];
    const hooksJson = rd("hooks", "hooks.json");
    const skillTrees = LANG_HEADS.map((f) => (rd(f).match(/^│ {3}├── SKILL\.md .*$/m) || [""])[0]);
    ok(/`spec_add_track`[^.]*`remove: true`/.test(skill) && !/`--remove` to drop one/.test(skill) &&
      claude.length >= 8 && js(contrib) === js(claude) && ["`string_decoder`", "`module`"].every((m) => contrib.includes(m)) &&
      /hook on Bash and PowerShell/.test(obsRow) && /\^\(Bash\|PowerShell\)\$/.test(hooksJson) && /Works in English, Portuguese and Spanish/.test(skill) &&
      skillTrees.every((t, i) => t && !/trilingual|triggers|gatilhos|disparadores|activadores/i.test(t) && /EN \/ PT \/ ES/.test(t) &&
        [/written in English/, /escrito em inglês/, /escrito en inglés/][i].test(t)),
      "1.24 r6 H14: SKILL.md says spec_add_track {remove: true}; CONTRIBUTING lists CLAUDE.md's Node core modules (" + js(contrib) + " vs " + js(claude) +
      "); INTEGRATIONS' observed-evidence row names Bash and PowerShell; the README trees call SKILL.md written in English, working in EN / PT / ES (got " + js(skillTrees) + ")");
  }

  { // 1.24 r6 H14 + H-I6: AGENTS.md says what `dev-spec <command>` stands for (`rules agents` makes the path absolute), and its Execute
    // step is sub-bullets — it was one ~2,700-character line
    const agents = rd("AGENTS.md");
    const step6 = (agents.split("\n6. **Execute**")[1] || "").split(/\n(?:\d+\. \*\*|\n)/)[0];
    const lines = step6.split("\n");
    ok(/Below, `dev-spec <command>` stands for `node cli\/dev-spec\.js <command>`/.test(ws(agents)) &&
      lines.length >= 7 && lines.slice(1).every((l) => /^ {3}- \*\*/.test(l)) && Math.max(...lines.map((l) => l.length)) <= 600 &&
      /for a task whose `_Verify:_` names a runnable command, a text note alone/.test(ws(step6)),
      "1.24 r6 H-I6: AGENTS.md spells out `dev-spec <command>` = `node cli/dev-spec.js <command>`; step 6 (Execute) is a list of sub-bullets, none over 600 characters (got " +
      lines.length + " lines, longest " + Math.max(...lines.map((l) => l.length)) + ")");
  }

  { // 1.24 r6 H-I7: the Quick start (EN / PT / ES) offers the guided tour
    const bad = LANG_HEADS.filter((h) => !/\/dev-spec-driven:spec-tour/.test(subsec(langSec(h), /(?:Quick start|Começar em|Inicio rápido)/)));
    ok(!bad.length, "1.24 r6 H-I7: the Quick start of README.md / .pt.md / .es.md mentions /dev-spec-driven:spec-tour (missing: " + js(bad) + ")");
  }
};
