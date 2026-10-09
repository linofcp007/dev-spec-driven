"use strict";
// Docs — 1.25.1 review prose guards: the maintainer notes cite live identifiers, the Node core list is what the code requires,
// README's engine count is the engine's, and the model-facing prose (commands, SKILL.md) matches what the model can do.
// (17-docs.js, 17-docs-review5.js and 17-docs-review6.js hold the docs' earlier guards.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, root, require }) => {
  const js = JSON.stringify;
  const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");
  const ws = (t) => t.replace(/\s+/g, " ");
  const codeFiles = (dirs, re) => {
    const out = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if ([".git", "node_modules", "tmp", ".specs"].includes(e.name)) continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (re.test(e.name) && !/spec\.bundle\.js$/.test(e.name)) out.push(p);
      }
    };
    for (const d of dirs) if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
    return out;
  };

  { // 1. Every code identifier the maintainer notes cite (backticked CONST_CASE, camelCase, a name() call, PascalCase — 5+
    // characters) is a word of some code file: tracks.md named API_AMBIGUOUS, RE_API_ACRONYM, API_TECH_ACRONYMS, RE_UI_BACKEND,
    // UI_CONSUMER_VERBS and RE_UI_FRONTEND_ONLY after the 1.20 cue rules replaced them, markdown-and-trace.md templateDiagrams().
    // An identifier from outside this code base is allowed by name, with why.
    const OUTSIDE = new Set([
      "subagentStatusLine", // a Claude Code plugin `settings` key (claude-code-integration.md: why a plugin can't ship a status line)
    ]);
    const words = new Set();
    for (const f of codeFiles(["mcp", "cli", "hooks", "scripts", "evals"], /\.(?:js|mjs|cjs|json|sh|ps1|bash|zsh|fish)$/)) {
      if (path.basename(f) === "17-docs-review7.js") continue; // this file names the allowlisted ones itself
      for (const m of fs.readFileSync(f, "utf8").matchAll(/[A-Za-z_$][\w$]*/g)) words.add(m[0]);
    }
    const RE_ID = /(?<![\w.$\/-])([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+|[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+|[a-z][a-zA-Z0-9]*(?=\(\))|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+)(?![\w$-])/g;
    const notes = ["CLAUDE.md", ...fs.readdirSync(path.join(root, "docs", "maintainers")).filter((f) => f.endsWith(".md")).sort().map((f) => "docs/maintainers/" + f)];
    const dead = [];
    let cited = 0;
    for (const n of notes) {
      rd(n).split("\n").forEach((line, i) => {
        for (const span of line.matchAll(/`([^`\n]+)`/g)) {
          for (const id of span[1].matchAll(RE_ID)) {
            if (id[1].length < 5) continue;
            cited++;
            if (!words.has(id[1]) && !OUTSIDE.has(id[1])) dead.push(n + ":" + (i + 1) + " " + id[1]);
          }
        }
      });
    }
    ok(cited > 1000 && words.size > 5000 && !dead.length && [...OUTSIDE].every((x) => !words.has(x)),
      "1.25.1 review: every code identifier CLAUDE.md and docs/maintainers/*.md cite is a word of the code (" + cited + " cited; dead: " + dead.slice(0, 8).join(" · ") +
      ") — the allowlist holds only names the code doesn't");
  }

  { // 2. The Node core modules CLAUDE.md and CONTRIBUTING.md list are exactly the ones the runtime code requires (+ built-in
    // fetch): `readline` was listed although nothing requires it — and mcp/server.js says "never readline".
    const coreList = (t) => (((ws(t).match(/use only Node core \(([^)]*)\)/) || [])[1] || "").match(/`[a-z_]+`/g) || []).map((x) => x.slice(1, -1));
    const listed = coreList(rd("CLAUDE.md")), contrib = coreList(rd("CONTRIBUTING.md"));
    const builtin = new Set(require("module").builtinModules);
    const required = new Set();
    const runtime = codeFiles(["mcp/lib", "cli", "hooks", "scripts", "mcp/evals"], /\.(?:js|mjs|cjs)$/).concat([path.join(root, "mcp", "server.js")])
      .filter((f) => !/[\\/](?:tests)[\\/]|test-cli\.js$/.test(f));
    for (const f of runtime) for (const m of fs.readFileSync(f, "utf8").matchAll(/require\(\s*["'](?:node:)?([a-z_\/]+)["']\s*\)/g)) if (builtin.has(m[1])) required.add(m[1]);
    const asListed = listed.filter((m) => m !== "fetch").sort();
    ok(listed.includes("fetch") && js(asListed) === js([...required].sort()) && js(contrib) === js(listed) && !listed.includes("readline"),
      "1.25.1 review: CLAUDE.md / CONTRIBUTING.md list exactly the Node core modules the runtime code requires, plus fetch — no readline (listed " + js(listed) + ", required " + js([...required].sort()) + ")");
  }

  { // 3. README's tree states the engine's module count (the 1.18 note's "20 modules" was that release's — said so now).
    const src = rd("mcp", "lib", "engine", "index.js");
    const mods = (((src.match(/const MODULES = \[([\s\S]*?)\];/) || [])[1] || "").match(/"\.\/[^"]+\.js"/g) || []);
    const own = mods.filter((m) => !m.startsWith('"./import/')).length, importers = mods.length - own;
    const readme = rd("README.md");
    const tree = (readme.match(/^│ {3}├── lib\/engine\/ .*$/m) || [""])[0];
    const stated = +((tree.match(/(\d+) modules, one per concern/) || [])[1] || 0);
    const notes118 = [/\(20 modules by concept at the time —/, /\(20 módulos por conceito na\s+altura —/, /\(20 módulos por concepto en\s+ese momento —/];
    ok(own >= 20 && importers >= 5 && stated === own && /one importer per source tool \(import\/\)/.test(tree) && !/\blint\b|\bimpact\b/.test(tree) &&
      notes118.every((re) => re.test(readme)),
      "1.25.1 review: README's tree says the engine's own module count (" + own + ", + " + importers + " in import/), and the 1.18 notes (EN / PT / ES) say their 20 was that release's (got " + js(tree.slice(0, 120)) + ")");
  }

  { // 4. Model-facing prose. /approve and /spec-ff are user-only commands since 1.24 (disable-model-invocation): the model records an
    // approval with spec_approve after the user's yes — never "record it with /approve". /grill needs no other skill and hands off to
    // /design (the user is already in Phase 1). /spec-tracks lists every reserved pack marker; /spec-templates every template.
    const skill = ws(rd("skills", "dev-spec-driven", "SKILL.md"));
    // (1.26: /grill is /clarify --grill, /spec-tracks and /spec-templates are /spec-setup tracks | templates, /spec-ff is
    // /approve --through; every command but /spec and /spec-bugfix is user-only)
    const bug = ws(rd("commands", "spec-bugfix.md")), clarify = ws(rd("commands", "clarify.md")), grill = clarify;
    const fm = (n) => (rd("commands", n).split(/^---$/m)[1] || "");
    const userOnly = fs.readdirSync(path.join(root, "commands")).filter((n) => /^disable-model-invocation: true$/m.test(fm(n))).map((n) => "/" + n.slice(0, -3));
    // a model instruction that RUNS a user-only command: "record it with /approve", "`/approve` requirements", "approve it … (`/spec-ff`)"
    const runsUserOnly = (t) => userOnly.some((c) => new RegExp("(?:record it with |then |phase \\(|in one call \\(|at once with |On the user's yes, )`" + c.replace(/[-/]/g, "\\$&") + "[` ]").test(t));
    const cmdTexts = fs.readdirSync(path.join(root, "commands")).filter((n) => n.endsWith(".md") && !/^disable-model-invocation: true$/m.test(fm(n))).map((n) => [n, ws(rd("commands", n))]);
    const offenders = [["SKILL.md", skill], ...cmdTexts].filter(([, t]) => runsUserOnly(t)).map(([n]) => n);
    ok(userOnly.includes("/approve") && userOnly.length >= 20 && !offenders.length &&
      /record it with `spec_approve \{name, phase\}`/.test(skill) && /`\/approve` is the user's own command/.test(skill) &&
      /On the user's yes, record it with `spec_approve`/.test(bug) && /`spec_approve \{through: "tasks"\}` once they said so/.test(bug) && !/On the user's yes, `\/approve`/.test(bug),
      "1.25.1 review: SKILL.md and the model-run commands record an approval with spec_approve on the user's yes — never by running the user-only /approve or /spec-ff (" + js(offenders) + ")");
    const reserved = require("./lib/engine/index.js").RE_PACK_MARKER_RESERVED;
    const tracksCmd = ws(rd("commands", "spec-setup.md"));
    const markerRule = ((tracksCmd.split("`marker` (")[1] || "").split("`title`")[0].split(" never ")[1] || "").replace(/an ID's shape/, "");
    const plainAlts = reserved.source.replace(/^\^\(\?:|\)\$$/g, "").split("|").filter((a) => /^[A-Z]+$/.test(a));
    const listedWords = markerRule.match(/\b[A-Z][A-Z0-9]*\b/g) || [];
    ok(plainAlts.length >= 15 && plainAlts.every((a) => listedWords.includes(a)) && listedWords.every((w) => reserved.test(w)) &&
      ["US1", "P1", "AC1", "SC1", "EC1", "NFR1", "T1"].every((w) => listedWords.includes(w) && reserved.test(w)),
      "1.25.1 review: /spec-setup tracks names every reserved pack marker of RE_PACK_MARKER_RESERVED (the nine built-in markers, the reserved words, the ID shapes) and nothing it doesn't reserve (missing " +
      js(plainAlts.filter((a) => !listedWords.includes(a))) + ")");
    const S = require("./lib/spec.js");
    const tplLine = ws(rd("commands", "spec-setup.md")).split("Artifacts:")[1] || "";
    const tplNames = Object.keys(S.TEMPLATE_ARTIFACTS || require("./lib/engine/index.js").TEMPLATE_ARTIFACTS);
    ok(tplNames.length >= 17 && tplNames.every((a) => new RegExp("(?<![\\w-])" + a + "(?![\\w-])").test(tplLine.split("(incl.")[0])),
      "1.25.1 review: /spec-setup templates lists every template artifact (change included) (missing " + js(tplNames.filter((a) => !new RegExp("(?<![\\w-])" + a + "(?![\\w-])").test(tplLine.split("(incl.")[0]))) + ")");
    ok(!/dev-grill/.test(grill + clarify) && /\*\*One question at a time\*\*/.test(grill) && /\*\*Recommend an answer\*\*/.test(grill) && /\*\*Walk the decision tree\*\*/.test(grill) &&
      /fold them into `requirements\.md`/.test(grill) && /hand off to `\/spec <feature> design` \(Phase 2\)/.test(grill) && !/hand off to `\/design` or `\/createSpec`/.test(grill) &&
      /record the requirements approval with `spec_approve`/.test(grill),
      "1.25.1 review: /clarify --grill is self-contained (one question at a time, a recommended answer, the decision tree, folded into requirements.md), names no dev-grill skill and hands off to /spec's design phase");
    // argument hints: none empty (a command without arguments has no hint), none past 130 characters (autocomplete cuts it)
    const hints = fs.readdirSync(path.join(root, "commands")).filter((n) => n.endsWith(".md")).map((n) => [n, (fm(n).match(/^argument-hint: "(.*)"$/m) || [])[1]]);
    const badHints = hints.filter(([, h]) => h !== undefined && (!h.trim() || h.length > 130)).map(([n, h]) => n + " (" + h.length + ")");
    ok(hints.length === 22 && !badHints.length && hints.find(([n]) => n === "spec-setup.md")[1].length <= 130,
      "1.25.1 review: no command has an empty argument-hint (a command taking none has no hint) or one past 130 characters (spec-init's was 264; the umbrella /spec-setup's ≤ 130) (" + js(badHints) + ")");
    // version archaeology in model instructions: a behaviour, never "before 1.16" / "an upgraded 1.12 one"
    const versioned = [["SKILL.md", skill], ...fs.readdirSync(path.join(root, "commands")).filter((n) => n.endsWith(".md")).map((n) => [n, ws(rd("commands", n))])]
      .flatMap(([n, t]) => (t.match(/(?:before|≤|pre-|upgraded|— |\()1\.\d{1,2}\b[^.;)]{0,30}/g) || []).map((m) => n + ": " + m));
    ok(!versioned.length, "1.25.1 review: SKILL.md and the commands state the behaviour, not the release that introduced it (" + versioned.slice(0, 5).join(" · ") + ")");
  }
};
