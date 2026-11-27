"use strict";
// Docs — properties of every text the plugin ships: a list of the built-in tracks names every track (1.42 UX-05); doctor's
// next gate, never readyToAdvance, is what an approval waits on (1.42 UX-01). (17-docs*.js hold the docs' other guards.)

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

  { // --- 1.42 UX-01: what an approval waits on is doctor's next gate, never readyToAdvance ---
    // readyToAdvance is "no fail anywhere" — a later phase's fail included (a +sec feature's design sections fail at
    // classification) —, so six texts that said "advance only on readyToAdvance" held approvals for a later phase's work.
    // nextGate is the next approval's own checks, a forecast: the approval call adds phase-order (an earlier phase changed
    // since its approval — nextGate ready, the approve refused), so no text may promise it: never "approve on nextGate",
    // "the next approval would pass" or "ready to approve" (in any language) — "fix what it refuses" is what holds. Nor "what the
    // next approval would refuse" (review 1, R1-SURF-09: spec_doctor's description, read by skill-less clients — nextGate is the
    // next gate's own checks; the approval adds phase order and roles).
    const texts = shippedTexts(root);
    const RE_HOLD = [/(?:advanc\w*|proceed)\W+(?:only\s+)?on\s+`?readyToAdvance/i, /one `readyToAdvance` verdict/i];
    const RE_PROMISE = [/approve\s+on\s+(?:its\s+)?`?nextGate/i, /next approval (?:would |will )?(?:pass|refuse)/i, /ready to approve|pronto para aprovar|listo para aprobar/i];
    const hits = texts.flatMap(([rel, t]) => RE_HOLD.concat(RE_PROMISE).filter((re) => re.test(t.replace(/\s+/g, " "))).map((re) => rel + " " + re.source));
    // The texts that SEND an agent to doctor before an approval / before advancing, by PROPERTY (review 1, R1-SURF-01: a list of
    // seven missed GEMINI.md's and the Copilot rule's "Run `dev-spec doctor` before advancing" — `rules gemini` / `rules copilot`
    // print them): every shipped .md / .mdc (the rule files of other tools included) is cut into sentences (a paragraph, a list
    // item or a table cell, split at ". " / "; "), and a sentence that orders doctor at an approval — "run … doctor … before
    // advancing / an approval", "at each phase boundary run … doctor", "`spec_doctor` before a phase advances" / "… first",
    // "`spec_doctor`, then the user's approval" — names the next gate (`nextGate` / "next gate") in that same sentence.
    // What the shapes hide: an order to doctor in another wording (another language, "check with doctor", a code block), and the
    // engine's .js strings. Mutations listed before the fixtures: N1 GEMINI.md's clause dropped · N2 the Copilot rule's · N3
    // commands/spec.md's · N4 the "run … before" shape dropped · N5 the next gate read in the whole file, not the sentence.
    const units = (t) => t.replace(/\r\n/g, "\n").split(/\n\s*\n|\n(?=\s*(?:[-*]|\d+\.)\s)|\|/).flatMap((p) => p.replace(/\s+/g, " ").split(/(?<=[.;])\s+(?=[A-Z0-9`*(_[-])/));
    const D = "(?:spec_doctor|/spec-doctor|\\bdoctor)\\b", SS = "(?:(?!\\.\\s).)"; // doctor on any surface · a character of the same sentence
    const MOMENT = "(?:advanc\\w*|a phase advances|approving|(?:an?|each|the next|the|its) approval)\\b";
    const SENDS = new RegExp([
      "\\b(?:run|use|call)\\b" + SS + "{0,100}" + D + SS + "{0,100}\\bbefore\\s+" + MOMENT,
      "\\b(?:each|every) phase boundary\\b" + SS + "{0,60}\\b(?:run|use|call)\\b" + SS + "{0,60}" + D,
      D + "[^`\\s]*`?(?:\\s*\\{[^}]*\\}`?)?,?\\s+(?:before\\s+" + MOMENT + "|first\\b)",
      D + SS + "{0,80}\\bthen\\s+(?:the user's approval|ask (?:the user\\s+)?for (?:its\\s+|their\\s+)?approval)\\b",
    ].join("|"), "i");
    const NAMED = /`nextGate`|next gate/i;
    const sends = (t) => units(t).filter((s) => SENDS.test(s)).map((s) => ({ s: s.trim(), named: NAMED.test(s) }));
    const shapes = [ // [label, text, sentences sent, named]
      ["the parent's GEMINI.md", "  Mandatory design sections must be filled. Run `dev-spec doctor <feature>` before advancing.\n- Approvals are the user's: run", 1, 0],
      ["the parent's Copilot rule over a line break", "Every task carries `_Verify: <command>_`. Run `dev-spec doctor`\n  before advancing a phase.\n- Approvals", 1, 0],
      ["the cursor rule (a path's dot is no sentence end)", "Run `node cli/dev-spec.js doctor <feature>` before advancing a phase; fix what its next gate refuses (a later phase's fail waits).", 1, 1],
      ["AGENTS.md's phase boundary", "At each phase boundary run `dev-spec doctor <feature>` and fix what its next gate refuses.", 1, 1],
      ["SKILL.md's gate line", "`spec_doctor` before a phase advances: fix what its `nextGate` refuses.", 1, 1],
      ["/approve's first step", "1. `spec_doctor {name}` first — show the verdict and its `nextGate`. No phase given?", 1, 1],
      ["/spec's phases, unnamed", "**The phases** (each one: fill the artifact, `spec_doctor`, then the user's approval):", 1, 0],
      ["the next gate in ANOTHER sentence is not this one's (N5)", "Run `dev-spec doctor` before advancing a phase. The next gate is in the result.", 1, 0],
      ["doctor that warns is no order", "a content hash each — past them doctor warns; a `feature protect` run before the approval doesn't replace it", 0, 0],
      ["a README cell", "| `/spec-doctor [--deep]` | Ready to advance? `--deep` adds fresh reviewers |", 0, 0],
    ];
    const shapeGot = shapes.map(([, t]) => { const r = sends(t); return [r.length, r.filter((x) => x.named).length]; });
    all("1.42 review 1 (R1-SURF-01): the reader of 'a sentence that sends an agent to doctor before an approval', on real shapes — the run / boundary / first / then orders read, the next gate read in that sentence only; a doctor that warns and a README cell are none (got " + js(shapeGot) + ")",
      Object.fromEntries(shapes.map(([label, , n, k], i) => [label, () => js(shapeGot[i]) === js([n, k])])));
    const docTexts = texts.filter(([rel]) => /\.(md|mdc)$/.test(rel));
    const sent = docTexts.flatMap(([rel, t]) => sends(t).map((x) => ({ rel, ...x })));
    const unnamed = sent.filter((x) => !x.named).map((x) => x.rel + " :: " + x.s.slice(0, 120));
    all("1.42 UX-01: no shipped text holds an approval on readyToAdvance or promises one on nextGate; every shipped sentence of the four shapes read (run … doctor … before advancing / an approval, each phase boundary … doctor, doctor first / before a phase advances, doctor then the user's approval) names its next gate (hits: " + js(hits) + "; " + sent.length + " sentences in " +
      new Set(sent.map((x) => x.rel)).size + " texts; unnamed: " + js(unnamed) + ")", {
      noHold: hits.length === 0,
      named: unnamed.length === 0,
      // the property reads every kind of text that sends one: a rule file of another tool, the skill, a command
      read: sent.some((x) => Object.values(RULE_FILES).includes(x.rel)) && sent.some((x) => x.rel.startsWith("skills/")) && sent.some((x) => x.rel.startsWith("commands/")) && sent.length >= 5,
    });
    // Review 2 (R2-TASKS-01): the shapes are not the property — eight shipped sentences of other wordings (a pipeline, "doctor,
    // and — on the user's yes — approve", a code block's loop) sent an agent to doctor before an approval and named no next gate;
    // four of them are MCP prompts a skill-less client gets. Each now carries the clause, pinned here one by one; the reader does
    // NOT read them (the narrowed claim of the row above and of gates-and-approvals.md — a new sentence of another wording is
    // not caught). Mutations listed before the fixtures: Q1 … Q8 each sentence's clause dropped.
    const byRel = Object.fromEntries(docTexts.map(([rel, t]) => [rel, t.replace(/\s+/g, " ")]));
    const pinned = [
      ["commands/clarify.md", "Then `spec_clarify` and `ears_validate` again, `spec_doctor` (fix what its next gate refuses), and — on the user's explicit yes — record the requirements approval with `spec_approve`"],
      ["commands/spec-change.md", "Then update what the change reaches, `spec_doctor` (fix what its next gate refuses), and — on the user's yes — re-approve each changed phase with `spec_approve`."],
      ["commands/spec-tour.md", "5. **Approve** — `spec_doctor` (fix what its next gate refuses), show the plan, and record it with `spec_approve {name, through: \"tasks\"}`"],
      ["commands/spec-bugfix.md", "run `spec_doctor` and fix what its next gate refuses, then present the reproduction, the root cause with its evidence and the fix you propose — and wait."],
      ["skills/dev-spec-driven/references/bugfix.md", "run `spec_doctor` (fix what its next gate refuses), and present the reproduction, the root cause and its evidence for the approvals"],
      ["AGENTS.md", "Each phase: fill the scaffold, `dev-spec doctor` (fix what its next gate refuses), present it, and record the user's yes."],
      ["skills/dev-spec-driven/SKILL.md", "→ fill → `spec_doctor` (fix what its next gate refuses) → present → the user's yes → `spec_approve`."],
      ["skills/dev-spec-driven/references/change-management.md", "→ spec_doctor (fix what its next gate refuses), then re-approve each changed phase (a new snapshot)"],
    ];
    all("1.42 review 2 (R2-TASKS-01): the eight sentences of other wordings that send an agent to doctor before an approval name its next gate — pinned one by one, none of them read by the four shapes (the documented limit)",
      Object.fromEntries(pinned.map(([rel, s]) => [rel, () => (byRel[rel] || "").includes(s) && sends(s).length === 0])));
  }
};
