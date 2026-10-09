"use strict";
// Conventions — the build (1.20): the committed corpus and stop-claim filter (npm run build), the bundle built on demand, the race of
// sources updated under a running process, the all-language sets an English process never renders (1.24 r6 I-I2).
// (Split from 16-conventions.js — the MCP suite's critical path — by review 6, I-I8: it runs in its own process, beside it.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, all, S, root, tmp, libSources, require, __dirname }) => {
  // 1.20 build (scripts/build.js, `npm run build`): the committed, pre-generated placeholder corpus
  // (mcp/lib/engine/corpus.generated.json) and the single-file engine bundle built on demand (`--bundle`, `dev-spec bundle` —
  // never committed; built into tmp here). The child processes below run serialized functions (Function.prototype.toString)
  // written to tmp — no escaped source in strings.
  {
    const B = require("../scripts/build.js");
    const E = require("./lib/engine/index.js"); // this process's engine: the modules the facade loaded
    const I = require("./lib/i18n.js");
    const libDir = path.join(__dirname, "lib");
    const js = JSON.stringify;
    const sorted = (xs) => [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const spawnJson = (args, env) => {
      const r = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 300000, env });
      try { return JSON.parse(r.stdout); } catch { return { stdout: r.stdout, stderr: String(r.stderr).slice(0, 300) }; }
    };
    const script = (name, fn, args) => { const f = path.join(tmp, name); fs.writeFileSync(f, "\"use strict\";\n(" + fn.toString() + ")(" + args + ");\n"); return f; };

    // The committed corpus is what a fresh build of these sources writes: a change to a file of CORPUS_SOURCES (a template, a
    // track, a string, the readers the render runs through) without a rebuild fails here — package.json's version is no input (1.26).
    const staleFiles = B.stale(E);
    const buildJs = path.join(root, "scripts", "build.js");
    const check = spawnSync(process.execPath, [buildJs, "--check"], { encoding: "utf8", timeout: 120000 });
    const usage = [["--nope"], ["--check", "--bundle"], ["--bundle", "--out", "x.txt"]].map((a) => spawnSync(process.execPath, [buildJs, ...a], { encoding: "utf8", timeout: 60000 }).status);
    ok(staleFiles.length === 0 && check.status === 0 && /corpus is up to date/.test(check.stdout) && usage.every((s) => s === 2),
      "1.20 build: the committed corpus (mcp/lib/engine/corpus.generated.json) equals a fresh build of these sources — run npm run build; `build.js --check` says so (exit 0); an unknown argument, --check with --bundle, a --bundle --out that is no .js file exit 2 (stale: " +
      js(staleFiles) + ", check " + check.status + " " + js(String(check.stdout).trim()) + ", usage " + js(usage) + ")");
    const buildReq = [...fs.readFileSync(buildJs, "utf8").matchAll(/\brequire\(\s*(["'])([^"']+)\1\s*\)/g)].map((m) => m[2]);
    const pkgScripts = require(path.join(root, "package.json")).scripts;
    const ignored = fs.readFileSync(path.join(root, ".gitignore"), "utf8").split(/\r?\n/).includes("mcp/lib/spec.bundle.js");
    ok(buildReq.length && buildReq.every((m) => ["fs", "path"].includes(m)) && pkgScripts.build === "node scripts/build.js" && pkgScripts["build:bundle"] === "node scripts/build.js --bundle" &&
      ignored && !libSources().some((f) => path.basename(f) === "spec.bundle.js") && libSources().length >= 38,
      "1.20 build: scripts/build.js is Node core only, wired as npm run build (the corpus) and npm run build:bundle; mcp/lib/spec.bundle.js is git-ignored (built on demand, never committed) and the source guards never read a bundle — they read the sources and scripts/build.js (got " +
      js({ buildReq, ignored }) + ")");

    // 1.26 — the generated files carry no version: what they hold is a function of their sources alone (the corpus: CORPUS_SOURCES,
    // proved below by V8 coverage; the stop-claim filter: STOP_FILTER_SOURCES), so a release that changes no source leaves them
    // byte-identical — they were rewritten by every release. `npm run check` is the --check; .gitattributes marks both generated
    // (linguist), and they stay LF.
    {
      const attrs = fs.readFileSync(path.join(root, ".gitattributes"), "utf8").split(/\r?\n/).map((l) => l.trim());
      const read = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
      const corpusFile = read(B.CORPUS_PATH), stopFile = read(B.STOP_CLAIMS_PATH);
      all("1.26: the committed corpus and stop-claim filter carry no version (a release that changes no source rewrites neither); npm run check = build.js --check; .gitattributes marks both linguist-generated and keeps them LF", {
        "npm run check is node scripts/build.js --check": pkgScripts.check === "node scripts/build.js --check",
        "corpus.generated.json has a sources stamp and no version": !!corpusFile && typeof corpusFile.sources === "string" && !("version" in corpusFile),
        "stop-claims.generated.json has its sizes and no version": !!stopFile && Object.keys(stopFile.sources || {}).length === E.STOP_FILTER_SOURCES.length && !("version" in stopFile),
        "a fresh build of either has no version": !("version" in JSON.parse(B.buildCorpus(E))) && !("version" in JSON.parse(B.buildStopClaims(E))),
        ".gitattributes marks the corpus generated": attrs.includes("mcp/lib/engine/corpus.generated.json linguist-generated=true"),
        ".gitattributes marks the stop-claim filter generated": attrs.includes("hooks/stop-claims.generated.json linguist-generated=true"),
        "*.json stays LF": attrs.some((l) => /^\*\.json\s+text eol=lf$/.test(l)),
      });
    }

    // This process reads the committed corpus (its sources stamp matches) and its sets are exactly the rendered ones.
    const fresh = E.renderCorpusData();
    const setsNow = E.templateSets(), brNow = E.templateSetsBr();
    const pairs = [[setsNow.brackets, fresh.brackets], [setsNow.code, fresh.code], [brNow.brackets, fresh.bracketsBr], [brNow.code, fresh.codeBr],
      [E.templateTaskSet(), fresh.tasks], [E.bugStepSet(), fresh.bugSteps]];
    ok(E.builtinCorpusSource() === "file" && pairs.every(([s, l]) => js(sorted(s)) === js(l)) && fresh.brackets.length > 400 && fresh.tasks.length > 50 && fresh.bugSteps.length > 5,
      "1.20 build: this process reads the committed corpus (source 'file' — its sources stamp matches this engine) and every built-in set is exactly the rendered one: templateSets, templateSetsBr, templateTaskSet, the bug steps (got " +
      js({ source: E.builtinCorpusSource(), sizes: pairs.map(([s, l]) => [s.size, l.length]) }) + ")");

    // 1.22 review: the built-in tracks' template task headings (trackTaskHeadings — which tasks.md block belongs to a track that
    // is off) come from the corpus: rendered, they loaded pt.js, es.js and the derived pt-BR into every English process that
    // lists features (50–65 ms). They are exactly the live i18n's, track × language; an English `list` loads no other language.
    const fileCorpus = JSON.parse(fs.readFileSync(path.join(libDir, "engine", E.CORPUS_FILE), "utf8"));
    const headLive = (t, l) => { const m = I.msg(l).tracks.taskBlock(t, 1).match(/^#{1,6}\s.*$/m); return m ? E.normTaskHeading(m[0]) : null; };
    const headDiff = [];
    for (const t of E.VALID_TRACKS) {
      const got = E.trackTaskHeadings(t), live = sorted(new Set(I.LANGS.map((l) => headLive(t, l)).filter(Boolean)));
      for (const l of I.LANGS) if (headLive(t, l) !== null && !got.has(headLive(t, l))) headDiff.push([t, l]);
      if (js(sorted(got)) !== js(live) || js((fileCorpus.taskHeadings || {})[t]) !== js(live) || js(fresh.taskHeadings[t]) !== js(live)) headDiff.push([t, "set"]);
    }
    const proj22 = path.join(tmp, "p22-list-en");
    S.initProject(proj22, ["core"], "en");
    ["core", "saas", "ai", "data"].forEach((t, i) => S.createFeature(proj22, "Feature " + i, [t], "", undefined, "en"));
    const offTrack = S.removeTrack(proj22, "feature-1", "saas"); // its [SaaS] task block stays on disk, inactive
    const listChild = function (lib, proj) {
      const path = require("path");
      const S = require(path.join(lib, "spec.js")), E = require(path.join(lib, "engine", "index.js"));
      const r = S.listFeatures(proj);
      const loaded = Object.keys(require.cache).map((f) => f.split(path.sep).join("/")).filter((f) => f.includes("/lib/i18n/")).map((f) => path.posix.basename(f)).sort();
      process.stdout.write(JSON.stringify({ features: r.features.map((f) => [f.name, f.phase, f.tasksDone, f.tasks]), loaded, source: E.builtinCorpusSource() }));
    };
    const listed = spawnJson([script("p22-list.js", listChild, "process.argv[2], process.argv[3]"), libDir, proj22], process.env);
    const here22 = S.listFeatures(proj22).features.map((f) => [f.name, f.phase, f.tasksDone, f.tasks]);
    ok(headDiff.length === 0 && E.MARKER_TRACKS.every((t) => E.trackTaskHeadings(t).size >= 3) && offTrack.ok &&
      Array.isArray(listed.loaded) && listed.loaded.includes("common.js") && !listed.loaded.some((f) => ["pt.js", "es.js", "pt-br.js"].includes(f)) &&
      listed.source === "file" && js(listed.features) === js(here22) && here22.length === 4,
      "1.22 review: every built-in track's task headings (corpus, file and rendered) are exactly the live i18n's for each language; listing the features of an English project (a turned-off [SaaS] block included) loads no pt.js, es.js or pt-br.js and lists exactly what this process does (got " +
      js({ headDiff, loaded: listed.loaded, source: listed.source, features: listed.features, here22 }) + ")");

    // 1.24 r6 I-I2 (finding I1): the all-language template sets the gates ask about — the steering stubs (doctor's steering check),
    // the scaffold's Mermaid diagrams (doctor's mermaid), the track design blocks' lines (a section's own lines), the bug report's
    // slots, the built-in template criteria (cross-feature ACs) — come from the corpus too: rendered, they loaded pt.js, es.js and
    // the derived pt-BR into every English doctor / next_action / done / finish / catalog (~78 ms). Each is exactly the rendered one,
    // and an English session of those calls loads no other language and answers as this process does.
    {
      const renderedSets = { steeringStubs: E.renderSteeringStubs(), diagrams: E.renderTemplateDiagrams(), sectionLines: E.renderSectionLines("base"),
        sectionLinesBr: E.renderSectionLines("pt-BR"), bugSlots: E.renderBugSlots(), templateReqs: E.renderTemplateReqs() };
      const same = Object.keys(renderedSets).filter((k) => js(fresh[k]) !== js(renderedSets[k]) || js(fileCorpus[k]) !== js(renderedSets[k]));
      const live = { diagrams: js(sorted(E.templateDiagramSet())) === js(fresh.diagrams), bugSlots: js(sorted(E.bugTemplateSlots())) === js(fresh.bugSlots),
        templateReqs: js(E.builtinTemplateReqs()) === js(I.LANGS.flatMap((l) => (fresh.templateReqs[l] || []).map((t) => [t, l]))),
        sectionLines: E.sectionOwnLines(I.trackDesignBlock("saas", "pt") + "\n" + I.trackDesignBlock("api", "es"), "en").length === 0 &&
          E.sectionOwnLines(I.trackDesignBlock("saas", "pt-BR"), "pt-BR").length === 0 && fresh.sectionLinesBr.length > 0 && fresh.sectionLinesBr.every((k) => !fresh.sectionLines.includes(k)),
        steering: I.steeringKnownFiles().every((f) => I.LANGS.every((l) => E.isSteeringStub(f, I.steeringStub(f, l) + "\n\n"))) && !E.isSteeringStub("product.md", "# Product\n\nOurs.\n") };
      const p24 = path.join(tmp, "p24-ii2-en");
      S.initProject(p24, ["core"], "en");
      const fa = S.createFeature(p24, "Feature A", ["core", "saas"], "", undefined, "en");
      S.createFeature(p24, "Feature B", ["core", "tdd"], "", undefined, "en");
      S.createFeature(p24, "Crash On Save", ["core"], "crash on save", undefined, "en", "bugfix");
      fs.writeFileSync(path.join(fa.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. Build it\n  - _Requirements: US-1.AC-1_\n  - _Verify: `node -e \"process.exit(0)\"`_\n- [ ] 2. Ship it\n  - _Requirements: US-1.AC-1_\n");
      const enChild = function (lib, proj) {
        const path = require("path");
        const S = require(path.join(lib, "spec.js")), E = require(path.join(lib, "engine", "index.js"));
        const out = {};
        for (const f of ["feature-a", "feature-b", "crash-on-save"]) {
          const d = S.specDoctor(proj, f), n = S.nextAction(proj, f);
          out[f] = { doctor: d.verdict, checks: d.checks.map((c) => c.id + ":" + c.status).join(","), next: n.step };
        }
        out.done = S.completeTask(proj, "feature-a", 1, { command: "node -e \"process.exit(0)\"", exitCode: 0, summary: "ok" }).ok;
        out.finish = S.finishFeature(proj, "feature-a", {}).readyToFinish;
        out.catalog = S.catalog(proj).ok;
        out.loaded = Object.keys(require.cache).map((f) => f.split(path.sep).join("/")).filter((f) => f.includes("/lib/i18n/")).map((f) => path.posix.basename(f)).sort();
        out.source = E.builtinCorpusSource();
        process.stdout.write(JSON.stringify(out));
      };
      const en = spawnJson([script("p24-en.js", enChild, "process.argv[2], process.argv[3]"), libDir, p24], process.env);
      const hereEn = {};
      for (const f of ["feature-a", "feature-b", "crash-on-save"]) {
        const d = S.specDoctor(p24, f), n = S.nextAction(p24, f);
        hereEn[f] = { doctor: d.verdict, checks: d.checks.map((c) => c.id + ":" + c.status).join(","), next: n.step };
      }
      const other = Array.isArray(en.loaded) ? en.loaded.filter((f) => ["pt.js", "es.js", "pt-br.js"].includes(f)) : null;
      ok(!same.length && Object.values(live).every(Boolean) && fresh.diagrams.length >= 3 && fresh.sectionLines.length > 100 && fresh.bugSlots.length > 5 &&
        Object.keys(fresh.templateReqs).length === I.LANGS.length && Array.isArray(other) && !other.length && en.loaded.includes("en.js") && en.source === "file" &&
        ["feature-a", "feature-b", "crash-on-save"].every((f) => js(en[f]) === js(hereEn[f])) && en.done === true && en.catalog === true,
        "1.24 r6 I-I2: the steering stubs, the template diagrams, the track design lines (EN / PT / ES and pt-BR), the bug report's slots and the requirement templates (their criteria read live) come from the corpus — each exactly the rendered set; an English doctor / next_action / done / finish / catalog loads no pt.js, es.js or pt-br.js and answers as this process does (got " +
        js({ same, live, other, loaded: en.loaded, source: en.source, en: ["feature-a", "feature-b", "crash-on-save"].map((f) => [en[f], hereEn[f]]), done: en.done }) + ")");
    }

    // CORPUS_SOURCES — what the sources stamp hashes — lists every mcp/lib file whose functions run while the corpus renders (V8
    // coverage of renderCorpusData, the counters reset once every language has loaded): a render that came to depend on another
    // module would otherwise keep a stale corpus after an edit there.
    const covChild = function (lib) {
      const fs = require("fs"), path = require("path"), url = require("url"), v8 = require("v8");
      const E = require(path.join(lib, "engine", "index.js")), I = require(path.join(lib, "i18n.js"));
      for (const l of I.LANGS) I.msg(l); // every language's file loaded: load time is not the render
      I.toPtBr("x");
      v8.takeCoverage(); // written, and the counters reset
      E.renderCorpusData();
      v8.takeCoverage();
      const dir = process.env.NODE_V8_COVERAGE;
      const num = (f) => (f.match(/-(\d+)-(\d+)\.json$/) || ["", "0", "0"]).slice(1).map(Number);
      const last = fs.readdirSync(dir).filter((f) => f.startsWith("coverage-")).sort((a, b) => num(a)[0] - num(b)[0] || num(a)[1] - num(b)[1]).pop();
      const ran = new Set();
      for (const s of JSON.parse(fs.readFileSync(path.join(dir, last), "utf8")).result) {
        if (!s.url.startsWith("file:")) continue;
        const rel = path.relative(lib, url.fileURLToPath(s.url));
        if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
        if (s.functions.some((fn) => fn.ranges[0].startOffset > 0 && fn.ranges[0].count > 0)) ran.add(rel.split(path.sep).join("/"));
      }
      process.stdout.write(JSON.stringify([...ran].sort()));
    };
    const covDir = path.join(tmp, "p20-coverage");
    fs.mkdirSync(covDir, { recursive: true });
    const ran = spawnJson([script("p20-coverage.js", covChild, "process.argv[2]"), libDir], { ...process.env, NODE_V8_COVERAGE: covDir });
    const unlisted = Array.isArray(ran) ? ran.filter((f) => !E.CORPUS_SOURCES.includes(f)) : null;
    ok(Array.isArray(ran) && ran.length >= 8 && unlisted.length === 0 && E.CORPUS_SOURCES.every((f) => fs.existsSync(path.join(libDir, ...f.split("/")))),
      "1.20 build: CORPUS_SOURCES (what the corpus's sources stamp hashes) lists every mcp/lib file whose functions run while the corpus renders — V8 coverage of renderCorpusData (got " +
      js({ ran, unlisted }) + ")");

    // A clone whose corpus can't be trusted renders it — never a wrong answer. A faithful copy elsewhere reads the file (the stamp
    // is the sources, not their path — with another package.json version too, 1.26); a hand-edited template that wasn't rebuilt,
    // a broken or a missing file → 'render'. Rendered, the corpus decides every fresh scaffold text (47 track sets × 4 languages × the feature, bugfix and
    // steering builders) exactly as the committed one does.
    const decideChild = function (lib, mode) {
      const crypto = require("crypto"), path = require("path");
      const S = require(path.join(lib, "spec.js")), I = require(path.join(lib, "i18n.js")), E = require(path.join(lib, "engine", "index.js"));
      const out = { source: E.builtinCorpusSource() };
      if (mode !== "source") out.probe = S.placeholderReport(I.requirements({ name: "x", tracks: ["core"], label: "core", slug: "x", summary: "" }, "en")).map((p) => p.text);
      if (mode === "decide") {
        const OPT = S.OPTIONAL_TRACKS;
        const combos = [[], ...OPT.map((t) => [t]), ...OPT.flatMap((t, i) => OPT.slice(i + 1).map((u) => [t, u])), OPT].map((x) => ["core", ...x]);
        const texts = [];
        for (const l of I.LANGS) {
          for (const tracks of combos) {
            const a = { name: "Feature X", tracks, label: tracks.join(" +"), slug: "feature-x", summary: "" };
            for (const b of ["classification", "requirements", "design", "tasks", "checklist"]) texts.push(I[b](a, l));
            texts.push(I.testPlan("Feature X", l, tracks));
          }
          for (const b of ["evalPlan", "loadTest", "quickstart", "integrationPlan", "promptStub", "bugTestPlan", "bugTasks"]) texts.push(I[b]("Feature X", l));
          texts.push(I.bugReport({ name: "Feature X" }, l), I.bugRequirements({ name: "Feature X" }, l));
          for (const f of I.steeringKnownFiles()) texts.push(I.steeringStub(f, l));
        }
        const uniq = [...new Set(texts)];
        const dec = uniq.map((x) => [S.placeholderReport(x), S.artifactState({ text: x }), S.parseTasks(x).map((k) => [S.isPlaceholderTask(k.text), E.isBugStep(k.text)])]);
        Object.assign(out, { texts: uniq.length, placeholders: dec.reduce((n, d) => n + d[0].length, 0), hash: crypto.createHash("sha1").update(JSON.stringify(dec)).digest("hex") });
      }
      process.stdout.write(JSON.stringify(out));
    };
    const decideJs = script("p20-decide.js", decideChild, "process.argv[2], process.argv[3]");
    const decide = (lib, mode) => spawnJson([decideJs, lib, mode], process.env);
    const clone = path.join(tmp, "p20-clone"), cloneLib = path.join(clone, "mcp", "lib");
    fs.mkdirSync(path.join(clone, "mcp"), { recursive: true });
    fs.cpSync(libDir, cloneLib, { recursive: true, filter: (src) => path.basename(src) !== "spec.bundle.js" }); // (never a bundle built here)
    const pkgPath = path.join(clone, "package.json"), pkgText = fs.readFileSync(path.join(root, "package.json"), "utf8");
    const otherPkg = pkgText.replace(/"version":\s*"[^"]+"/, "\"version\": \"0.0.1\"");
    fs.writeFileSync(pkgPath, pkgText);
    const here = decide(libDir, "decide"), faithful = decide(cloneLib, "source");
    fs.writeFileSync(pkgPath, otherPkg);
    const otherVersion = decide(cloneLib, "source");
    fs.writeFileSync(pkgPath, pkgText);
    const enPath = path.join(cloneLib, "i18n", "en.js"), enText = fs.readFileSync(enPath, "utf8");
    fs.writeFileSync(enPath, enText.replace("[why this is the minimum viable slice]", "[why this slice ships first]"));
    const edited = decide(cloneLib, "probe");
    fs.writeFileSync(enPath, enText);
    const corpusPath = path.join(cloneLib, "engine", E.CORPUS_FILE);
    fs.writeFileSync(corpusPath, "{");
    const broken = decide(cloneLib, "source");
    fs.rmSync(corpusPath);
    const missing = decide(cloneLib, "decide");
    ok(here.source === "file" && faithful.source === "file" && otherVersion.source === "file" && broken.source === "render",
      "1.20 build: a copy of the clone elsewhere reads the committed corpus (the stamp is the sources, not their path) — under another package.json version too (1.26: no version in the stamp, the corpus is the sources'); a broken corpus file → rendered (got " +
      js([here.source, faithful.source, otherVersion.source, broken.source]) + ")");
    ok(edited.source === "render" && Array.isArray(edited.probe) && edited.probe.includes("[why this slice ships first]") && !E.templateSets().brackets.has("why this slice ships first") &&
      Array.isArray(here.probe) && here.probe.includes("[why this is the minimum viable slice]"),
      "1.20 build: a template hand-edited in a clone that wasn't rebuilt changes the sources stamp — the corpus renders, and the new slot [why this slice ships first] reads as a placeholder (the committed corpus lacks it: trusted, a stale file would have called it the user's text) (got " +
      js(edited) + ")");
    ok(missing.source === "render" && here.texts > 1000 && missing.texts === here.texts && here.placeholders > 10000 && missing.placeholders === here.placeholders && missing.hash === here.hash,
      "1.20 build: without its corpus file a clone renders the corpus and decides every fresh scaffold text — " + here.texts + " texts (47 track sets × 4 languages, the feature, bugfix and steering builders): placeholderReport, artifactState, isPlaceholderTask, isBugStep — exactly as the committed corpus does (" +
      here.placeholders + " placeholders) (got " + js([here.source, here.hash, missing.source, missing.hash, missing.placeholders]) + ")");

    // 1.20 review — the stamp is checked against the code the process LOADED, never the files as they are at its first
    // placeholder question. A long-lived process (the MCP server) loads the engine; then the clone is updated under it — a slot
    // reworded AND the corpus rebuilt, as a `git pull` of both would do. That process renders (its own code), and its answers
    // are the old engine's; a process started after the update reads the new corpus. The same for a language file that loads
    // on demand AFTER the corpus was trusted (pt.js here). package.json's version is no input (1.26): another version and a
    // rebuild rewrite neither generated file, and both the running process and a later one keep reading the corpus.
    const raceChild = function (clone, mode) {
      const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
      const lib = path.join(clone, "mcp", "lib");
      const S = require(path.join(lib, "spec.js")), I = require(path.join(lib, "i18n.js")), E = require(path.join(lib, "engine", "index.js"));
      // A core design.md: its Reuse & Integration slots are no 1.12 text (LEGACY_TEMPLATE_PLACEHOLDERS would keep an old one).
      const design = (l) => I.design({ name: "x", tracks: ["core"], label: "core", slug: "x", summary: "" }, l);
      const slots = (text) => S.placeholderReport(text).map((p) => p.text);
      const edit = (rel, from, to) => { const p = path.join(clone, ...rel.split("/")); fs.writeFileSync(p, fs.readFileSync(p, "utf8").split(from).join(to)); };
      const rebuild = () => spawnSync(process.execPath, [path.join(clone, "scripts", "build.js")], { encoding: "utf8" }).status;
      const out = { mode };
      if (mode === "en") { // its English scaffold written (en.js loaded), no placeholder question asked yet
        const text = design("en");
        edit("mcp/lib/i18n/en.js", "[what it already does for this feature]", "[what it does today for this feature]");
        out.build = rebuild();
        Object.assign(out, { source: E.builtinCorpusSource(), probe: slots(text), state: S.artifactState({ text }) });
      } else if (mode === "locale") { // the corpus trusted first; then pt.js reworded + rebuilt; then Portuguese loads
        out.first = slots(design("en")).length > 0 && E.builtinCorpusSource();
        edit("mcp/lib/i18n/pt.js", "[o que já faz por esta feature]", "[o que faz hoje por esta feature]");
        out.build = rebuild();
        const pt = design("pt"); // the NEW pt.js — the code this process runs from now on
        Object.assign(out, { source: E.builtinCorpusSource(), fresh: pt.includes("[o que faz hoje por esta feature]"), probe: slots(pt) });
      } else if (mode === "version") { // nothing asked yet — package.json gets another version, then the build runs again
        const p = path.join(clone, "package.json");
        const gen = [path.join(lib, "engine", "corpus.generated.json"), path.join(clone, "hooks", "stop-claims.generated.json")];
        const before = gen.map((g) => fs.readFileSync(g, "utf8"));
        fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/"version":\s*"[^"]+"/, "\"version\": \"0.0.2\""));
        const r = spawnSync(process.execPath, [path.join(clone, "scripts", "build.js")], { encoding: "utf8" });
        out.build = r.status;
        out.unchanged = /^unchanged mcp\/lib\/engine\/corpus\.generated\.json$/m.test(r.stdout) && /^unchanged hooks\/stop-claims\.generated\.json$/m.test(r.stdout) &&
          gen.every((g, i) => fs.readFileSync(g, "utf8") === before[i]);
        Object.assign(out, { version: E.engineVersion(), source: E.builtinCorpusSource() });
      } else Object.assign(out, { version: E.engineVersion(), source: E.builtinCorpusSource(), probe: slots(design(mode.slice(6))) }); // "later-<lang>": a later process
      process.stdout.write(JSON.stringify(out));
    };
    const raceJs = script("p20-race.js", raceChild, "process.argv[2], process.argv[3]");
    const raceClone = (name) => {
      const c = path.join(tmp, name);
      fs.mkdirSync(path.join(c, "scripts"), { recursive: true });
      fs.cpSync(libDir, path.join(c, "mcp", "lib"), { recursive: true, filter: (src) => path.basename(src) !== "spec.bundle.js" });
      fs.copyFileSync(path.join(root, "package.json"), path.join(c, "package.json"));
      fs.copyFileSync(buildJs, path.join(c, "scripts", "build.js"));
      return c;
    };
    const raceDirs = { en: raceClone("p20-race-en"), pt: raceClone("p20-race-pt"), version: raceClone("p20-race-version") };
    fs.mkdirSync(path.join(raceDirs.version, "hooks"), { recursive: true }); // …with its stop-claim filter, which the build rewrites too
    fs.copyFileSync(B.STOP_CLAIMS_PATH, path.join(raceDirs.version, "hooks", "stop-claims.generated.json"));
    const race = (dir, mode) => spawnJson([raceJs, dir, mode], process.env);
    const rEn = race(raceDirs.en, "en"), rLoc = race(raceDirs.pt, "locale"), rVer = race(raceDirs.version, "version");
    const later = { en: race(raceDirs.en, "later-en"), pt: race(raceDirs.pt, "later-pt"), version: race(raceDirs.version, "later-en") }; // started after each update
    const version = require(path.join(root, "package.json")).version;
    const expected = S.placeholderReport(I.design({ name: "x", tracks: ["core"], label: "core", slug: "x", summary: "" }, "en")).map((p) => p.text); // this engine's answer
    ok(rEn.build === 0 && rEn.source === "render" && Array.isArray(rEn.probe) && expected.includes("[what it already does for this feature]") && js(rEn.probe) === js(expected) &&
      rEn.state === "placeholder" && rVer.build === 0 && rVer.unchanged === true && rVer.version === version && rVer.source === "file" &&
      later.en.source === "file" && Array.isArray(later.en.probe) && later.en.probe.includes("[what it does today for this feature]") && later.version.version === "0.0.2" &&
      later.version.source === "file",
      "1.20 review: sources and corpus updated under a running process (a slot reworded + npm run build) before its first placeholder question → it renders from the code it LOADED (source 'render'): its own fresh scaffold reads exactly as this engine reads it — [what it already does for this feature] still a placeholder; a process started after the update reads the new corpus. 1.26: another package.json version + rebuild rewrites neither generated file (both 'unchanged', byte-identical) — the running process (engineVersion() still the one it loaded) and a later one (0.0.2) both read the corpus (got " +
      js({ rEn, rVer, later: [later.en.source, later.version], expected }) + ")");
    ok(rLoc.build === 0 && rLoc.first === "file" && rLoc.fresh === true && rLoc.source === "render" && Array.isArray(rLoc.probe) && rLoc.probe.includes("[o que faz hoje por esta feature]") &&
      later.pt.source === "file" && Array.isArray(later.pt.probe) && js(later.pt.probe) === js(rLoc.probe),
      "1.20 review: a language file loaded on demand AFTER the corpus was trusted and changed since the engine loaded (pt.js reworded + rebuilt) drops the corpus — rendered from the code the process now runs: the new slot of its fresh Portuguese scaffold is a placeholder, as a process started after the update says from the new corpus (got " +
      js({ rLoc, later: later.pt }) + ")");

    // The bundle (built on demand — here into tmp, for this clone's mcp/lib): the same modules in one file — the modules'
    // namespace, the corpus it embeds (source 'bundle'), their own paths (engineVersion's package.json, the approval guard's
    // CLI path) — every module stamped with its size and mtime.
    const bundleFile = path.join(tmp, "p20-bundle", "spec.bundle.js");
    const built = B.writeBundle(bundleFile, { E });
    const Bn = require(bundleFile);
    const req2 = Bn.load(libDir);
    const E2 = req2("./engine/index.js"), I2 = req2("./i18n.js");
    const apPayload = { hook_event_name: "PreToolUse", tool_name: "mcp__spec-driven__spec_approve", tool_input: { name: "billing", phase: "design" } };
    const apCmd = (X) => (X.approvalGuardDecision(apPayload, "deny", { lang: "en" }) || {}).command;
    const stampsTrue = Bn.stamp.files.every(([rel, size, mtimeMs]) => { const st = fs.statSync(path.join(libDir, ...rel.split("/"))); return st.size === size && st.mtimeMs === mtimeMs; });
    ok(built.modules === B.bundledFiles().length && js(Bn.stamp.files.map((f) => f[0])) === js(B.bundledFiles()) && stampsTrue && Bn.stamp.version === E.engineVersion() &&
      E2 !== E && js(Object.keys(E2).sort()) === js(Object.keys(E).sort()) && E2.builtinCorpusSource() === "bundle" && js(sorted(E2.templateSets().brackets)) === js(fresh.brackets) &&
      E2.engineVersion() === E.engineVersion() && typeof apCmd(E) === "string" && /dev-spec\.js/.test(apCmd(E)) && apCmd(E2) === apCmd(E) &&
      I2.msg("pt").hook.sessionHeader === I.msg("pt").hook.sessionHeader,
      "1.20 bundle: a bundle built on demand (scripts/build.js --bundle, into tmp) holds every engine and i18n module (" + built.modules + "), each stamped with its size and mtime — the modules' namespace, the corpus it embeds (source 'bundle'), and their own paths wherever the bundle file lives: engineVersion reads package.json, the approval guard names cli/dev-spec.js as on the modules (got " +
      js({ modules: built.modules, version: Bn.stamp.version, stampsTrue, source: E2.builtinCorpusSource(), cmd: [apCmd(E), apCmd(E2)] }) + ")");

    // The facade takes a bundle only with DEV_SPEC_BUNDLE=1 and only while it is current. On the clone (no bundle of its own):
    // none → the modules; one built for it → the bundle (no engine module file loaded); unset or 0 → the modules; an invalid
    // DEV_SPEC_BUNDLE_PATH (relative, not a .js file) is ignored (the default place), a valid one is taken; a module touched
    // since the build (mtime), or edited to another size under the same mtime, another package.json version, a broken bundle
    // → the modules, silently (nothing on stdout or stderr).
    const facadeChild = function (lib) {
      const S = require(require("path").join(lib, "spec.js"));
      const keys = Object.keys(require.cache);
      process.stdout.write(JSON.stringify({ bundles: keys.filter((k) => /bundle[^\\/]*\.js$/.test(k)).length, modules: keys.filter((k) => /[\\/]engine[\\/]/.test(k)).length,
        brackets: S.templateSets().brackets.size, version: S.engineVersion() }));
    };
    const facadeJs = script("p20-facade.js", facadeChild, "process.argv[2]");
    const facade = (v, bpath) => {
      const env = { ...process.env };
      if (v == null) delete env.DEV_SPEC_BUNDLE; else env.DEV_SPEC_BUNDLE = v;
      if (bpath == null) delete env.DEV_SPEC_BUNDLE_PATH; else env.DEV_SPEC_BUNDLE_PATH = bpath;
      const r = spawnSync(process.execPath, [facadeJs, cloneLib], { encoding: "utf8", timeout: 300000, env });
      let o;
      try { o = JSON.parse(r.stdout); } catch { o = { stdout: r.stdout }; }
      o.use = o.modules === 0 && o.bundles === 1 ? "bundle" : o.modules > 20 ? "modules" : "?";
      if (r.stderr) o.stderr = String(r.stderr).slice(0, 200);
      return o;
    };
    const none = facade("1");
    // one module's mtime set to a whole second BEFORE the build, so the test can put it back exactly (a Date carries whole ms only)
    const scanPath = path.join(cloneLib, "engine", "scan.js"), scanText = fs.readFileSync(scanPath), t0 = Math.floor(Date.now() / 1000) - 60;
    fs.utimesSync(scanPath, t0, t0);
    B.writeBundle(path.join(cloneLib, "spec.bundle.js"), { lib: cloneLib, E });
    const elsewhere = path.join(tmp, "p20-bundle-clone", "engine.bundle.js");
    B.writeBundle(elsewhere, { lib: cloneLib, E });
    const on = facade("1"), off = facade(null), zero = facade("0"), relPath = facade("1", "spec.bundle.js"), txtPath = facade("1", path.join(tmp, "x.txt"));
    const atPath = facade("1", elsewhere);
    fs.utimesSync(scanPath, t0, t0 + 5); // touched (a plugin update, an edit) since the build
    const touched = facade("1");
    fs.writeFileSync(scanPath, Buffer.concat([scanText, Buffer.from(" ")]));
    fs.utimesSync(scanPath, t0, t0); // another size under the very mtime the bundle stamped
    const resized = facade("1");
    fs.writeFileSync(scanPath, scanText);
    fs.utimesSync(scanPath, t0, t0);
    const restored = facade("1");
    fs.writeFileSync(pkgPath, otherPkg);
    const otherVer = facade("1");
    fs.writeFileSync(pkgPath, pkgText);
    fs.writeFileSync(path.join(cloneLib, "spec.bundle.js"), fs.readFileSync(path.join(cloneLib, "spec.bundle.js"), "utf8").slice(0, 5000)); // cut short
    const brokenB = facade("1");
    const got = { none, on, off, zero, relPath, txtPath, atPath, touched, resized, restored, otherVer, brokenB };
    const uses = Object.fromEntries(Object.entries(got).map(([k, v]) => [k, v.use]));
    const want = { none: "modules", on: "bundle", off: "modules", zero: "modules", relPath: "bundle", txtPath: "bundle", atPath: "bundle", touched: "modules",
      resized: "modules", restored: "bundle", otherVer: "modules", brokenB: "modules" };
    ok(js(uses) === js(want) && Object.values(got).every((v) => !v.stderr && v.brackets === on.brackets) && otherVer.version === "0.0.1",
      "1.20 bundle: the facade loads the engine from a bundle only with DEV_SPEC_BUNDLE=1 and while it is current — its version is package.json's and every module it holds keeps the size and mtime it was built from (one stat each); DEV_SPEC_BUNDLE_PATH is taken only as an absolute .js path; a missing, stale, other-version or broken bundle → the modules, silently (got " +
      js({ uses, stderr: Object.entries(got).filter(([, v]) => v.stderr).map(([k, v]) => k + ": " + v.stderr) }) + ")");

    // The MCP server on the bundle answers what it answers on the modules: the handshake, tools / prompts / resources, and
    // read-only tool calls over one project (a PT feature and a bugfix among them).
    const mp = path.join(tmp, "proj-p20-mcp");
    S.initProject(mp, ["tdd"], "en");
    S.createFeature(mp, "Billing", ["tdd", "saas"], "tenant billing");
    S.createFeature(mp, "Relatórios", ["privacy"], "relatórios", undefined, "pt");
    S.createFeature(mp, "Crash", ["core"], "it crashes", undefined, "en", "bugfix");
    const reqs = [{ method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } } },
      { method: "tools/list" }, { method: "prompts/list" }, { method: "resources/list" },
      ...[["spec_list", {}], ["spec_status", { name: "billing" }], ["spec_doctor", { name: "relatorios" }], ["spec_doctor", { name: "crash" }],
        ["spec_next_action", { name: "billing" }], ["trace_check", { name: "billing", matrix: true }], ["ears_validate", { name: "billing" }],
        ["spec_classify", { description: "an llm assistant with tenant billing" }], ["spec_task_brief", { name: "billing" }], ["spec_catalog", {}]]
        .map(([name, args]) => ({ method: "tools/call", params: { name, arguments: { projectDir: mp, ...args } } }))]
      .map((r, i) => js({ jsonrpc: "2.0", id: i + 1, ...r })).join("\n") + "\n";
    const serve = (bundle) => {
      const env = { ...process.env, SPEC_PROJECT_DIR: mp };
      if (bundle) Object.assign(env, { DEV_SPEC_BUNDLE: "1", DEV_SPEC_BUNDLE_PATH: bundleFile }); else delete env.DEV_SPEC_BUNDLE;
      const r = spawnSync(process.execPath, [path.join(__dirname, "server.js")], { input: reqs, encoding: "utf8", env, timeout: 120000 });
      return String(r.stdout || "").split(/\r?\n/).filter(Boolean);
    };
    const srvM = serve(false), srvB = serve(true);
    const srvErr = srvM.filter((l) => /"isError":true|"error":\{/.test(l)).length;
    ok(srvM.length === 14 && srvB.length === 14 && srvM.every((l, i) => l === srvB[i]) && srvErr === 0,
      "1.20 bundle: the MCP server on the bundle (DEV_SPEC_BUNDLE=1, DEV_SPEC_BUNDLE_PATH) answers the handshake, tools / prompts / resources lists and ten read-only tool calls byte for byte as on the modules (got " +
      js({ modules: srvM.length, bundle: srvB.length, errors: srvErr, differ: srvM.map((l, i) => (l === srvB[i] ? null : i + 1)).filter(Boolean) }) + ")");
  }
};
