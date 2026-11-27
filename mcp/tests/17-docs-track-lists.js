"use strict";
// Docs — a list of the built-in tracks names every one of them (1.42 UX-05): a property over every text the plugin ships.
// (17-docs.js, 17-docs-flows.js and 17-docs-identifiers.js hold the docs' other guards.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, root, tmp, require }) => {
  const js = JSON.stringify;
  const OPTIONAL = S.OPTIONAL_TRACKS, MARKED = Object.keys(S.TRACK_MARKER);

  // A run is LIST-SHAPED: 9 or more built-in track words (any case, so the markers count — `[SaaS]`, SAAS), each bare,
  // `+`-prefixed, `[ ]`- or backtick-wrapped, one after another, separated by `·` `,` `/` `|`, white space (line breaks too) or
  // and / e / y / or / ou / o. A run that names tdd or core lists the tracks (every optional one is due); any other run lists
  // the marked tracks (every TRACK_MARKER track is due) — 1.41 shipped +port missing from ten such lists, the starter
  // track.json's comment among them.
  // What the bound hides: a list of 8 or fewer track words is read as a deliberate subset and never judged — spec-critic.md's
  // tracks with steering files, example-spec-combined.md's `+sec` … `+port`, i18n.js's markers after [AI]. workflows.md's
  // `+sec / … / +data sections honoured` (a 7-list) was such a miss, fixed by hand; at 7 the fixed one would be a false
  // positive (+saas and +ai are named earlier in its table cell). Only a run is read: a list written as quoted code
  // (`["tdd", "saas", …]` — VALID_TRACKS itself), cut by prose or an ellipsis (`+tdd … +port`) is none.
  const MIN = 9;
  const NAME = "(?:" + S.VALID_TRACKS.join("|") + ")";
  const TOKEN = "[`\\[+]{0,3}" + NAME + "[`\\]]{0,2}";
  const SEP = "(?:\\s*[·,/|]\\s*|\\s+(?:and|e|y|or|ou|o)\\s+|\\s+)";
  const RUN = new RegExp("(?<![A-Za-z0-9_-])" + TOKEN + "(?:" + SEP + TOKEN + "){" + (MIN - 1) + ",}(?![A-Za-z0-9_])", "gi");
  const WORD = new RegExp("(?<![A-Za-z0-9_])" + NAME + "(?![A-Za-z0-9_])", "gi");
  const trackListRuns = (text) => [...text.replace(/\s+/g, " ").matchAll(RUN)].map((m) => {
    const names = new Set((m[0].match(WORD) || []).map((x) => x.toLowerCase()));
    const due = names.has("tdd") || names.has("core") ? OPTIONAL : MARKED;
    return { run: m[0], missing: due.filter((x) => !names.has(x)) };
  });
  const gaps = (text) => trackListRuns(text).map((r) => r.missing);

  { // --- the reader, on real shapes (each the shape of a list a text holds or held) ---
    const rows = [
      // commands/spec-change.md before 1.42: the add-track list without port (a 10-list: the threshold reads it)
      ["a · list with tdd and no port", "`spec_add_track {name, track}` (tdd · saas · ai · sec · privacy · dist · api · ui · obs · data,\nor a project pack)", [["port"]]],
      // tooling-reference.md's spec-hook row before 1.42: the backticked markers
      ["the backticked markers without [PORT]", "sections (`[SaaS]` `[AI]` `[SEC]` `[PRIVACY]` `[DIST]` `[API]` `[UI]` `[OBS]` `[DATA]`, and a track pack's)", [["port"]]],
      // a track list that names core but forgets tdd
      ["core without tdd", "Never a built-in track (core saas ai sec privacy dist api ui obs data port), a word", [["tdd"]]],
      // project-tracks.md's marker list, upper case, over a line break
      ["upper-case markers over a line break", "Never a built-in marker (SAAS / AI / SEC / PRIVACY / DIST / API / UI /\n  OBS / DATA), a story", [["port"]]],
      // tooling-reference.md's add-track row before 1.42: `/` with no spaces
      ["+x/+y with no spaces", "Escalate a feature to +tdd/+saas/+ai/+sec/+privacy/+dist/+api/+ui/+obs/+data (additive", [["port"]]],
      // a list closed by a conjunction, in Portuguese and in Spanish
      ["closed by 'e' (pt)", "os tracks tdd, saas, ai, sec, privacy, dist, api, ui, obs e data", [["port"]]],
      ["closed by 'y' (es)", "los tracks tdd, saas, ai, sec, privacy, dist, api, ui, obs y data", [["port"]]],
      // the engine's marker alternation (markdown.js) and a pack's reserved names (packs.js) — complete
      ["a complete regex alternation", "/\\[(?:SaaS|AI|SEC|PRIVACY|DIST|API|UI|OBS|DATA|PORT)\\]/", [[]]],
      ["the full track list", "(core +tdd +saas +ai +sec +privacy +dist +api +ui +obs +data +port)", [[]]],
      // the stated bound: an 8-list is a deliberate subset (agents/spec-critic.md, example-spec-combined.md)
      ["an 8-list is not read", "+sec / +privacy / +dist / +api / +ui / +obs / +data / +port sections honoured", []],
      // a word that only starts like a track ends the run there: "portability" is no `port`
      ["a word is no track", "tdd saas ai sec privacy dist api ui obs data portability", [["port"]]],
      // prose that uses track words is no run
      ["prose", "the ui reads the api and the data it gets from the core of the obs pipeline, ui first", []],
    ];
    const got = rows.map(([, text]) => gaps(text));
    all("1.42 UX-05: a list-shaped run of 9+ built-in track words names every track of its kind (tdd / core → every optional track; else every marked one), on real shapes; an 8-list and prose are not read (got " + js(got) + ")",
      Object.fromEntries(rows.map(([label, , want], i) => [label, () => js(got[i]) === js(want)])));
  }

  // The texts a repository ships, by property: every .md / .mdc but CHANGELOG*, and every .js. Not read: what its .gitignore
  // ignores (the engine's bundle, node_modules, dist/, tmp/…: never shipped), hidden folders (another tool's or local state —
  // .git, .specs, .claude) but the rule files the plugin ships to other tools (cli/commands.js RULE_FILES), examples/ and evals/
  // (worked projects and eval fixtures: data), the suites' own folders (their fixtures quote partial lists on purpose), and in
  // docs/maintainers each file's History (it quotes the lists as they were).
  const { RULE_FILES } = require(path.join(root, "cli", "commands.js"));
  const shippedTexts = (base) => {
    const ignored = fs.readFileSync(path.join(base, ".gitignore"), "utf8").split(/\r?\n/).map((l) => l.trim())
      .filter((l) => l && !/^[#!]/.test(l) && !/[*?[\\]/.test(l))
      .map((l) => ({ dir: l.endsWith("/"), anchored: /\/./.test(l.replace(/\/$/, "")) || l.startsWith("/"), p: l.replace(/^\/|\/$/g, "") }));
    const isIgnored = (rel, dir) => ignored.some((g) => (!g.dir || dir) && (g.anchored ? rel === g.p : path.posix.basename(rel) === g.p));
    const skipDirs = new Set(["examples", "evals", "mcp/tests", "cli/tests"]);
    const texts = [];
    const add = (rel) => {
      let t = fs.readFileSync(path.join(base, rel), "utf8");
      if (rel.startsWith("docs/maintainers/")) t = t.split(/\n## History\b/)[0];
      texts.push([rel, t]);
    };
    const walk = (dir) => {
      for (const e of fs.readdirSync(path.join(base, dir), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const rel = dir ? dir + "/" + e.name : e.name;
        if (e.name.startsWith(".") || isIgnored(rel, e.isDirectory())) continue;
        if (e.isDirectory()) { if (!skipDirs.has(rel)) walk(rel); }
        else if ((/\.(md|mdc)$/.test(e.name) && !/^CHANGELOG/.test(e.name)) || /\.js$/.test(e.name)) add(rel);
      }
    };
    walk("");
    for (const f of Object.values(RULE_FILES)) if (!texts.some(([rel]) => rel === f) && fs.existsSync(path.join(base, f))) add(f);
    return texts;
  };
  const gapFiles = (texts) => texts.flatMap(([rel, t]) => trackListRuns(t).filter((r) => r.missing.length).map(() => rel)).sort();

  { // --- the file set, on a planted tree: one gap list in every place, read only where the plugin ships text ---
    const GAP = "tdd · saas · ai · sec · privacy · dist · api · ui · obs · data";
    const base = path.join(tmp, "proj-ux05-tree");
    const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true }); fs.writeFileSync(path.join(base, rel), text); };
    put(".gitignore", "# local\nnode_modules/\ndist/\n/.specs/\nmcp/lib/spec.bundle.js\n*.log\n");
    put("README.md", "Tracks: core tdd saas ai sec privacy dist api ui obs data port.\n");
    const read = ["skills/s/a.md", "mcp/lib/engine/x.js", ".cursor/rules/dev-spec-driven.mdc", "docs/maintainers/t.md"];
    put("skills/s/a.md", "(" + GAP + ")\n");
    put("mcp/lib/engine/x.js", "// the tracks (" + GAP + ")\n");
    put(".cursor/rules/dev-spec-driven.mdc", "- " + GAP + "\n");
    put("docs/maintainers/t.md", "# T\n- " + GAP + "\n\n## History\n- **1.41** — the list was " + GAP + ".\n");
    for (const rel of ["dist/old/README.md", "mcp/lib/spec.bundle.js", ".specs/f/design.md", ".claude/worktrees/w/AGENTS.md", "node_modules/p/README.md",
      "examples/demo/README.md", "evals/e/README.md", "mcp/tests/01-x.js", "cli/tests/01-x.js", "CHANGELOG.md", "notes.txt"]) put(rel, "- " + GAP + "\n");
    const got = gapFiles(shippedTexts(base));
    all("1.42 UX-05: the guard's file set is a property — a planted gap list is read in a shipped text (skills/, the engine, a rule file of another tool, the notes before their History) and nowhere else (.gitignore's, hidden folders, examples/, evals/, the suites, CHANGELOG, History, not .md / .js) (got " + js(got) + ")", {
      exact: js(got) === js(read.slice().sort()),
    });
  }

  { // --- every text the plugin ships ---
    const texts = shippedTexts(root);
    const runs = texts.map(([rel, t]) => [rel, trackListRuns(t)]);
    const bad = runs.flatMap(([rel, rs]) => rs.filter((r) => r.missing.length).map((r) => rel + " missing " + r.missing.join(",") + ": " + r.run.slice(0, 90)));
    const read = (re) => runs.filter(([rel, rs]) => re.test(rel) && rs.length).map(([rel]) => rel);
    all("1.42 UX-05: every list of the built-in tracks in a shipped text names every track (" + runs.reduce((n, [, rs]) => n + rs.length, 0) + " runs in " + texts.length + " files; gaps: " + js(bad) + ")", {
      noGaps: bad.length === 0,
      // every kind of source is read: the prose, the rule files of other tools, the localized strings, the engine's code
      prose: read(/^(skills|commands)\//).length > 0 && read(/^docs\/maintainers\//).length > 0,
      ruleFiles: Object.values(RULE_FILES).every((f) => texts.some(([rel]) => rel === f)),
      i18n: read(/^mcp\/lib\/i18n\//).length >= 3,
      engine: read(/^mcp\/lib\/engine\//).length > 0,
      cli: texts.some(([rel]) => rel === "cli/commands.js") && texts.some(([rel]) => rel === "hooks/spec-hook.js") && texts.some(([rel]) => rel === "mcp/server.js"),
      noBundle: !texts.some(([rel]) => /spec\.bundle\.js$/.test(rel)) && !texts.some(([rel]) => /^(examples|evals|\.specs|mcp\/tests|cli\/tests)\//.test(rel)),
      many: texts.length >= 150,
    });
  }
};
