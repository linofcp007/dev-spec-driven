"use strict";
// The project's UI checks (1.38) — spec_scan {designSystem: true}'s `uiChecks` without a feature: the operation's opt-in pass
// over the project's view files (the engine's default reads none), its inventory (per rule: count, files, first place — never a
// list), the 1.37 excuse rule at project scope, its bounds and limits, the cost against a bare read + the checks in memory.
// Every fixture below was written from a mutation of the rule it names (the list came first): each must fail without it.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, rpc, payload, remeasure, S, tmp, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const T = require(path.join(__dirname, "lib", "engine", "index.js")).loadLazyTier();
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const lines = (...l) => l.join("\n") + "\n";
  const project = (tag, files) => {
    const p = path.join(tmp, "proj-uip-" + tag);
    S.initProject(p, ["ui"], "en");
    for (const [rel, text] of Object.entries(files || {})) write(p, rel, text);
    return p;
  };
  const inv = (p) => S.designSystemReport(p, { uiPass: true }).uiChecks;
  // a +ui feature whose tasks name `files` in _Implements: (the feature report over the same files)
  const feature = (p, files) => {
    const f = S.createFeature(p, { name: "Checkout", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the checkout\n  - _Requirements: US-1.AC-1_\n  - _Implements: " + files.join(", ") + "_\n  - _Verify: npm test_\n");
    return f.slug;
  };
  const IMG = "export const Hero = () => <img src=\"/hero.png\" />;\n";
  const RESET = lines("/* the team's reset */", "*:focus {", "  outline: none;", "}");

  { // the opt-in (CRIT_X D4): the operation passes {uiPass: true}, the engine's default reads no view file — the 204 direct calls
    // keep their result and their timings; the key is the only difference; a feature report never runs the pass
    const p = project("opt", { "src/components/Button.tsx": "export const Button = () => <button className=\"transition-all\">ok</button>;\n", "src/app/Hero.tsx": IMG,
      ".specs/steering/design-system.md": "# Design System\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Button | `src/components/Button.tsx` |  |  |\n| Hero | `src/app/Hero.tsx` |  |  |\n" });
    const slug = feature(p, ["src/app/Hero.tsx"]);
    const plain = S.designSystemReport(p), opted = S.designSystemReport(p, { uiPass: true });
    const viaMcp = payload(await rpc("tools/call", { name: "spec_scan", arguments: { projectDir: p, designSystem: true } }));
    const fPlain = S.designSystemReport(p, { name: slug }), fOpted = S.designSystemReport(p, { name: slug, uiPass: true });
    const rest = Object.assign({}, opted);
    delete rest.uiChecks;
    all("1.38 project UI checks: the engine's default runs no pass (no `uiChecks`), {uiPass: true} adds the key and nothing else (the registry part, `limits`, `truncated`, `inSync` byte-identical — a finding moves none of them); spec_scan {designSystem: true} opts in; a feature report never runs it (got " +
      js({ plain: Object.keys(plain), opted: opted.uiChecks, mcp: viaMcp.uiChecks, inSync: [plain.inSync, opted.inSync] }) + ")", {
      default: () => plain.ok === true && !("uiChecks" in plain),
      opted: () => opted.uiChecks && opted.uiChecks.total === 2 && js(rest) === js(plain) && opted.inSync === true && js(opted.limits) === js([]),
      mcp: () => js(viaMcp.uiChecks) === js(opted.uiChecks),
      feature: () => js(fOpted) === js(fPlain) && fPlain.uiChecks.read === undefined,
    });
  }

  { // what the pass reads: the view files that pass uiViewFile (the feature report's predicate) — never a test, a story, a mock
    // or fixture by name, a type declaration; each file once (`read`)
    const p = project("views", { "src/App.tsx": IMG, "src/__tests__/Img.tsx": IMG, "src/Button.stories.tsx": IMG, "src/Img.test.tsx": IMG, "src/Img.mock.tsx": IMG,
      // (1.38, isTestFile: a manual mock, a fixture, a Cypress component spec — cal.com's components/__mocks__/, a cy.mount(<div onClick>))
      "src/components/__mocks__/DatePicker.tsx": IMG, "src/__fixtures__/Card.tsx": IMG, "src/Button.cy.tsx": "it(\"mounts\", () => cy.mount(<div onClick={go}>x</div>));\n",
      "src/styles/app.css": ".a { color: red; }\n", "src/types.d.ts": "export type A = 1;\n", "src/util.ts": "export const u = '<img src=x>';\n" });
    const u = inv(p);
    all("1.38 project UI checks: the pass reads the view files the feature report would — a test folder's, a story's, a test's, a mock's are not read (their <img> uncounted); a .d.ts and a plain .ts are no view file; each file is read once (got " + js(u) + ")", {
      views: () => u.total === 1 && js(u.rules["img-no-alt"]) === js({ level: "warn", files: 1, file: "src/App.tsx", line: 1 }),
      read: () => u.read === 2,
    });
  }

  { // the counts: per rule its count, the FILES holding one (never the findings), its level; an inline-silenced one is counted
    // silenced, never in total; byRule / rules in UI_RULES' order (warn first)
    const A = lines("export const A = () => (", "  <div className=\"transition-all\">", "    <img src=\"/a.png\" />", "    <img src=\"/b.png\" />", "    {/* ui-check-off: img-no-alt */}", "    <img src=\"/c.png\" />", "  </div>", ");");
    const p = project("counts", { "src/A.tsx": A, "src/B.tsx": IMG });
    const u = inv(p);
    all("1.38 project UI checks: an inventory — per rule its count and the files holding one (3 findings in 2 files: files 2), its level (warn / report), the first place; an inline-silenced finding counted in `silenced` alone; the rules in UI_RULES' order, warn first; no `findings` key (got " + js(u) + ")", {
      counts: () => u.total === 4 && js(u.byRule) === js({ "img-no-alt": 3, "transition-all": 1 }),
      files: () => u.rules["img-no-alt"].files === 2 && u.rules["transition-all"].files === 1,
      level: () => u.rules["img-no-alt"].level === "warn" && u.rules["transition-all"].level === "report",
      silenced: () => u.silenced === 1,
      order: () => js(Object.keys(u.byRule)) === js(["img-no-alt", "transition-all"]) && js(Object.keys(u.rules)) === js(["img-no-alt", "transition-all"]),
      noList: () => !("findings" in u),
    });
  }

  { // the first place: by file, then line — never the reading order (the stylesheets are read first) nor the order found in a
    // file (a markup file's <style> is judged after its template)
    const p = project("first", { "zz/legacy.css": ".a { transition: all .2s; }\n", "src/A.tsx": lines("export const A = () => (", "  <p>", "    <b className=\"transition-all\">a</b>", "  </p>", ");"),
      "src/Panel.vue": lines("<style>", ".p { transition: all .3s; }", "</style>", "<template>", "  <div class=\"transition-all\">x</div>", "</template>") });
    const u = inv(p);
    all("1.38 project UI checks: a rule's first place is the smallest path, then line — a sheet read first never wins over a smaller path, and a markup file's <style> finding (judged after its template) is its first line (got " + js(u.rules) + ")", {
      first: () => js(u.rules["transition-all"]) === js({ level: "report", files: 3, file: "src/A.tsx", line: 3 }),
      inFile: () => { const v = inv(project("first-vue", { "src/Panel.vue": lines("<style>", ".p { transition: all .3s; }", "</style>", "<template>", "  <div class=\"transition-all\">x</div>", "</template>") })); return js(v.rules["transition-all"]) === js({ level: "report", files: 1, file: "src/Panel.vue", line: 2 }) && v.byRule["transition-all"] === 2; },
    });
  }

  { // past a file's 200 kept findings each is still COUNTED (CRIT_1 must-fix 7); a rule found only past a file's cap is placed
    // at its file, no line — and a listed place elsewhere wins over it whatever the paths
    const rows = Array.from({ length: 200 }, (_, i) => "    <li className=\"transition-all\">Row " + i + "</li>");
    const LIST = lines("export const List = () => (", "  <ul>", ...rows, "    <li className=\"transition-all\">last</li>", "    <img src=\"/x.png\" />", "    {/* ui-check-off: img-no-alt */}", "    <img src=\"/y.png\" />", "  </ul>", ");");
    const alone = inv(project("past", { "src/a/List.tsx": LIST }));
    const listed = inv(project("past-listed", { "src/a/List.tsx": LIST, "src/z/Hero.tsx": IMG }));
    all("1.38 project UI checks: findings past a file's 200 are counted (201 transition-all, the <img> after them; a silenced one there: silenced); a rule only past a file's cap is placed at its file with no line; a listed place elsewhere wins (got " + js({ alone, listed: listed.rules }) + ")", {
      past: () => alone.byRule["transition-all"] === 201 && alone.byRule["img-no-alt"] === 1 && alone.total === 202 && alone.silenced === 1,
      noLine: () => js(alone.rules["img-no-alt"]) === js({ level: "warn", files: 1, file: "src/a/List.tsx" }),
      listed: () => js(listed.rules["img-no-alt"]) === js({ level: "warn", files: 2, file: "src/z/Hero.tsx", line: 1 }),
    });
  }

  { // outline-removed under the 1.37 excuse rule at project scope (CRIT_1 must-fix 2): ANY focus style in any file read excuses
    // every candidate — a class-list focus in another view file too; parity: the feature report over the same files says the same
    const BUTTON = "export const Button = () => <button className=\"rounded focus-visible:ring-2\">ok</button>;\n";
    const p = project("excuse", { "src/styles/reset.css": RESET, "src/components/Button.tsx": BUTTON });
    const slug = feature(p, ["src/styles/reset.css", "src/components/Button.tsx"]);
    const u = inv(p), fr = S.designSystemReport(p, { name: slug }).uiChecks;
    const q = project("excuse-none", { "src/styles/reset.css": RESET, "src/components/Button.tsx": "export const Button = () => <button className=\"rounded\">ok</button>;\n" });
    const qslug = feature(q, ["src/styles/reset.css", "src/components/Button.tsx"]);
    const un = inv(q), qr = S.designSystemReport(q, { name: qslug }).uiChecks;
    all("1.38 project UI checks: an outline removal is excused by any focus style in any file read (a reset.css `*:focus { outline: none }` beside a Button's `focus-visible:ring-2`) — the feature report over the same files agrees; with none it stands in both (got " + js({ u, fr, un: un.rules, qr: qr.byRule }) + ")", {
      excused: () => u.total === 0 && !("outline-removed" in u.byRule) && fr.total === 0,
      stands: () => js(un.rules["outline-removed"]) === js({ level: "warn", files: 1, file: "src/styles/reset.css", line: 3 }) && qr.byRule["outline-removed"] === 1,
    });
    // 1.42 (B141-01): the removals the excuse deleted were counted nowhere (≈ 50–60 in 94 files of one real project) — kept as
    // `excused`, the rule entry as it was (count, files, first place), never in total / byRule / rules; no key where nothing was
    // excused (the removal stands), nor where the project switched the rule off (its findings never reach the rule entry: `off`
    // counts them) — a focus style there too
    const o = project("excuse-off", { "src/styles/reset.css": RESET, "src/components/Button.tsx": BUTTON,
      ".specs/steering/design-system.md": "# Design System\n\n_UI checks off: outline-removed (the kit resets it)_\n" });
    const uo = inv(o);
    all("1.42 (B141-01): the project inventory counts the outline removals a focus style excused — `excused` {outline-removed: count, files, file, line}, never in total / byRule / rules; none when nothing was excused or the rule is off (got " +
      js({ excused: u.excused, none: "excused" in un, off: [uo.excused, uo.off] }) + ")", {
      "the excused removal, counted as the rule entry was": () => js(u.excused) === js({ "outline-removed": { count: 1, files: 1, file: "src/styles/reset.css", line: 3 } }) &&
        u.total === 0 && js(u.byRule) === "{}" && js(u.rules) === "{}",
      "no key when the removal stands": () => !("excused" in un) && un.total === 1,
      "no key when the rule is off (a focus style read too): `off` counts it": () => !("excused" in uo) && uo.total === 0 &&
        js(uo.off) === js([{ rule: "outline-removed", reason: "the kit resets it", count: 1 }]),
    });
  }

  { // past the feature report's 48 project sheets the inventory judges: 60 sheets, a focus style in a late one → excused (the
    // feature report: focus-sheets, unjudged); none → it stands
    const sheets = (n, focusAt) => Object.fromEntries(Array.from({ length: n }, (_, i) => ["src/sheets/s" + String(i).padStart(3, "0") + ".css", i === focusAt ? ":focus-visible { outline: 2px solid; }\n" : ".s" + i + " { color: red; }\n"]));
    const p = project("past48", Object.assign({ "src/checkout/reset.css": RESET }, sheets(60, 55)));
    const slug = feature(p, ["src/checkout/reset.css"]);
    const u = inv(p), fr = S.designSystemReport(p, { name: slug }).uiChecks;
    const none = inv(project("past48-none", Object.assign({ "src/checkout/reset.css": RESET }, sheets(60, -1))));
    all("1.38 project UI checks: past the feature report's 48 project sheets the inventory judges — a focus style in the 56th excuses the removal (the feature report leaves it unjudged: focus-sheets); with none in 60 sheets it stands (got " + js({ u: [u.total, u.limits], fr: fr.limits, none: none.byRule }) + ")", {
      judged: () => u.total === 0 && js(u.limits) === js([]) && fr.limits.some((l) => l.code === "focus-sheets" && l.count === 1),
      stands: () => none.byRule["outline-removed"] === 1 && js(none.limits) === js([]),
    });
  }

  { // the read bounds named in the inventory's own limits (CRIT_1 must-fix 7): view-size (a file past 256K — its <img> past the
    // cut uncounted; one of exactly 256K is read whole), line-length, tag-length; none reaches the report's `limits` /
    // `truncated` / `inSync`
    const big = "<!doctype html>\n<!--\n" + ("y".repeat(99) + "\n").repeat(2800) + "-->\n<img src=\"/late.jpg\">\n";
    const exact = (() => { const head = "<!doctype html>\n<!--\n", tail = "\n-->\n<img src=\"/x.jpg\">", pad = 256 * 1024 - head.length - tail.length; return head + ("y".repeat(99) + "\n").repeat(Math.floor(pad / 100)) + "y".repeat(pad % 100) + tail; })();
    const page = lines("<!doctype html>", "<header><img src=\"data:image/png;base64," + "A".repeat(2600) + "\" alt=\"Acme\"></header>", "<img src=\"/team.jpg\">");
    const tag = lines("export const A = () => (", "  <div onClick={() => go(", ...Array.from({ length: 40 }, (_, i) => "      a" + i + ","), "  <img src=\"after.png\" />", ");");
    // (one character past the read: the `>` that would close its <img> — the pass reads what the feature report reads, the
    // first 256K, never the one more character asked for to know the file is longer)
    const over1 = (() => { const head = "<!doctype html>\n<!--\n", img = "\n-->\n<img src=\"/y.jpg\">", pad = 256 * 1024 + 1 - head.length - img.length; return head + ("y".repeat(99) + "\n").repeat(Math.floor(pad / 100)) + "y".repeat(pad % 100) + img; })();
    // (a sheet's long line, read first — the stylesheets are — and the smaller path: the first file by path, never the last read)
    const p = project("limits", { "src/landing/big.html": big, "src/landing/exact.html": exact, "src/landing/index.html": page, "src/landing/A.tsx": tag, "src/landing/over1.html": over1,
      "a/min.css": ".a{color:red}".repeat(200) + "\n" });
    const r = S.designSystemReport(p, { uiPass: true }), u = r.uiChecks;
    all("1.38 project UI checks: the inventory names its read bounds — view-size (count, the first file; a file of exactly 256K is read whole: its <img> counted; one 256K + 1 long is read to 256K: its last `>` unread), line-length (the <img> below the cut line counted; the first file by path), tag-length — and none reaches the report's limits / truncated (got " + js({ u, limits: r.limits, truncated: r.truncated }) + ")", {
      limits: () => js(u.limits) === js([{ code: "view-size", read: 262144, count: 2, file: "src/landing/big.html" }, { code: "line-length", read: 2000, count: 2, file: "a/min.css" },
        { code: "tag-length", read: 30, count: 1, file: "src/landing/A.tsx" }]),
      cut: () => u.byRule["img-no-alt"] === 3 && u.rules["img-no-alt"].files === 3 && u.read === 6, // (A.tsx's after the failed tag read, exact's, index's — never big's nor over1's)
      top: () => js(r.limits) === js([]) && r.truncated === false,
    });
  }

  { // 1.38.0 review 1 (UP-4): a view file longer than the read is read only in part — its bare `text-[…vw]` in the part read, a
    // variant `text-` utility past it: a doubt, as in the feature report (view-size names the file); the same file's head alone,
    // read whole, warns
    const HEAD = "export const C = () => <p className=\"text-[5vw]\">404</p>;\n";
    let big = HEAD;
    for (let i = 0; big.length < 260 * 1024; i++) big += "export const R" + i + " = () => <p className=\"p-4\">row " + i + "</p>;\n";
    big += "export const D = () => <p className=\"md:text-6xl\">x</p>;\n";
    const u = inv(project("part-tsx", { "src/Big.tsx": big })), w = inv(project("part-tsx-whole", { "src/Big.tsx": HEAD }));
    all("1.38.0 review 1: the inventory judges no bare text-[…vw] of a file read in part (view-size names it); read whole it warns (got " + js({ u, w: w.byRule }) + ")", {
      part: () => u.total === 0 && js(u.limits) === js([{ code: "view-size", read: 262144, count: 1, file: "src/Big.tsx" }]),
      whole: () => js(w.byRule) === js({ "font-size-viewport": 1 }),
    });
  }

  { // review 1 of 1.38 (UP-1): the inventory does not PARSE a stylesheet longer than the read — a compiled bundle (Bulma's 13
    // were most of its pass) —: view-size counts and names it, `read` counts it; a sheet of exactly 256K is parsed, a view
    // file past the read (an HTML page) is still parsed to 256K; a feature report and finish keep 1.37's read of its first 256K
    const HEAD = lines(".a { transition: all .2s; }", "*:focus { outline: none; }");
    const sized = (head, n, open, close) => { const pad = n - head.length - open.length - close.length; return head + open + ("y".repeat(99) + "\n").repeat(Math.floor(pad / 100)) + "y".repeat(pad % 100) + close; };
    const p = project("sheet-size", { "assets/kit.css": sized(HEAD, 256 * 1024 + 1, "/*\n", "*/\n"), "styles/exact.css": sized(HEAD, 256 * 1024, "/*\n", "*/\n"),
      "src/big.html": sized("<img src=\"/early.png\">\n", 256 * 1024 + 1, "<!--\n", "-->\n") });
    const u = inv(p);
    const slug = feature(p, ["assets/kit.css"]);
    const fr = S.designSystemReport(p, { name: slug }).uiChecks, fin = T.designSystemFinish(p, slug).uiChecks;
    const at = (x) => x.rule + "@" + x.file + ":" + x.line;
    all("1.38 review 1 project UI checks: a stylesheet longer than the read is not parsed by the inventory — counted and named in view-size (the first file by path), counted in `read`, none of its findings counted —; a sheet of exactly 256K is parsed (its transition-all and outline removal counted), an HTML page past the read is parsed to 256K (its early <img> counted); the feature report and finish over that sheet still read its first 256K (got " +
      js({ u, fr: { findings: fr.findings.map(at), limits: fr.limits }, fin: fin.top.map(at) }) + ")", {
      skipped: () => js(u.limits) === js([{ code: "view-size", read: 262144, count: 2, file: "assets/kit.css" }]) && u.read === 3,
      exact: () => js(u.byRule) === js({ "img-no-alt": 1, "outline-removed": 1, "transition-all": 1 }) && u.rules["outline-removed"].file === "styles/exact.css" && u.rules["transition-all"].files === 1,
      page: () => u.rules["img-no-alt"].file === "src/big.html" && u.rules["img-no-alt"].line === 1,
      feature: () => js(fr.findings.map(at)) === js(["outline-removed@assets/kit.css:2", "transition-all@assets/kit.css:1"]) && fr.limits.some((l) => l.code === "view-size" && l.file === "assets/kit.css"),
      finish: () => js(fin.top.map(at)) === js(["outline-removed@assets/kit.css:2"]),
    });
  }

  { // the pass's own bound: DS_UI_FILES (5,000) files read — the stylesheets first, then the shorter path — and DS_UI_CHARS (32 MB)
    // characters; past either `ui-files` says it, and a cut pass that read no focus style judges no removal: the limit names them
    const tiny = {};
    for (let i = 0; i < 5001; i++) tiny["src/sheets/d" + String(i % 50).padStart(2, "0") + "/s" + String(i).padStart(4, "0") + ".css"] = ".s { color: red; }\n";
    const p = project("bound-files", Object.assign({ "a/r.css": RESET }, tiny));
    const u = inv(p);
    // (the characters: 129 view files of 256K — the read cuts each there — after the candidate; cheap to parse: one comment)
    const body = "<!--\n" + ("y".repeat(99) + "\n").repeat(2700) + "-->\n";
    const heavy = { "a/r.css": RESET };
    for (let i = 0; i < 129; i++) heavy["src/p/p" + String(i).padStart(3, "0") + ".html"] = body;
    const q = project("bound-chars", heavy);
    const c = inv(q);
    // (the stylesheets are read first: a focus sheet whose path is longer than every page's is read before the cut — the same
    // 129 pages)
    write(q, "zzz/styles/focus-ring.css", ":focus-visible { outline: 2px solid; }\n");
    const cf = inv(q);
    // (a focus style read before the cut excuses the removal: no count on the limit — the same 5,001 sheets; the shorter path
    // first — a short one that sorts last by name is read)
    write(p, "z/f.css", ":focus-visible { outline: 2px solid; }\n");
    const f = inv(p);
    all("1.38 project UI checks: the pass stops at 5,000 files read or 32 MB of their characters — `ui-files` names it, with the removals it left unjudged (count, the first file:line) when no focus style was read; a focus style read before the cut still excuses — the stylesheets first, then the shorter path (got " +
      js({ files: u.limits, chars: c.limits, sheetsFirst: [cf.total, cf.limits.filter((l) => l.code === "ui-files")], focus: [f.total, f.limits] }) + ")", {
      files: () => js(u.limits) === js([{ code: "ui-files", read: 5000, count: 1, file: "a/r.css", line: 3 }]) && u.total === 0,
      chars: () => js(c.limits.filter((l) => l.code === "ui-files")) === js([{ code: "ui-files", read: 129, count: 1, file: "a/r.css", line: 3 }]),
      sheetsFirst: () => cf.total === 0 && js(cf.limits.filter((l) => l.code === "ui-files")) === js([{ code: "ui-files", read: 130 }]),
      focus: () => f.total === 0 && js(f.limits) === js([{ code: "ui-files", read: 5000 }]),
      // (1.42 B141-01: a cut pass with no focus style excuses nothing — its removals are the limit's count, never `excused`; one
      // that read a focus style before the cut counts them as excused)
      "1.42: excused only where a focus style excused": () => !("excused" in u) && !("excused" in c) &&
        js(f.excused) === js({ "outline-removed": { count: 1, files: 1, file: "a/r.css", line: 3 } }),
    });
  }

  { // the FACT no-reduced-motion (UI_FACTS): the files read declare motion and none of the texts read mentions reduced motion —
    // tested on each WHOLE text as read (never its cut lines); (1.39, D6) the project's other scripts are read for a mention
    // too; never in a feature report
    const DIALOG = "export const O = () => <div className=\"data-[state=open]:animate-in fixed inset-0\" />;\n";
    const POP = lines("<template>", "  <p class=\"pop\">hi</p>", "</template>", "<style scoped>", "@keyframes pop {", "  from { transform: scale(.9) }", "}", "</style>");
    // (a stylesheet is read first: its keyframes never take the first place from a smaller path)
    const base = { "src/components/ui/dialog.tsx": DIALOG, "src/b/Pop.vue": POP, "zz/anim.css": "@keyframes spin { to { transform: rotate(1turn) } }\n" };
    const fact = (tag, extra) => inv(project("fact-" + tag, Object.assign({}, base, extra))).facts;
    const said = fact("said", {});
    const mentions = {
      variant: fact("variant", { "src/Toggle.tsx": "export const T = () => <i className=\"motion-reduce:transition-none\" />;\n" }),
      media: fact("media", { "src/styles/app.scss": "@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }\n" }),
      hook: fact("hook", { "src/Hero.tsx": "export const Hero = () => { const r = useReducedMotion(); return <h1>{r}</h1>; };\n" }),
      safe: fact("safe", { "src/Spin.tsx": "export const S = () => <i className=\"motion-safe:animate-spin\" />;\n" }),
      native: fact("native", { "src/Spin.tsx": "export const S = () => { AccessibilityInfo.isReduceMotionEnabled().then(set); return <b>s</b>; };\n" }),
      // (a minified sheet: its media query past the 2,000 characters a line is read to — the WHOLE text is tested)
      minified: fact("minified", { "src/styles/vendor.min.css": ".a{color:red}".repeat(3900) + "@media (prefers-reduced-motion:reduce){*{animation:none}}\n" }),
    };
    // (1.39, D6: a mention in a .ts hook alone takes the fact back — 1.38 said it, the hook unread)
    const script = fact("script", { "src/hooks/use-motion.ts": "export const useMotion = () => matchMedia(\"(prefers-reduced-motion: reduce)\");\n" });
    const still = inv(project("fact-none", { "src/Ok.tsx": "export const Ok = () => <i className=\"transition-opacity\" />;\n" })).facts;
    const p = project("fact-feature", base);
    const slug = feature(p, ["src/components/ui/dialog.tsx", "src/b/Pop.vue"]);
    const fr = S.designSystemReport(p, { name: slug }).uiChecks;
    all("1.38 project UI checks: no-reduced-motion — motion declared (a shadcn dialog's animate-in, a Vue keyframes) and no text read mentioning reduced motion: the fact, its count of lines and its first place by file then line; a mention anywhere read (a motion-reduce: / motion-safe: variant, a media query, useReducedMotion, past a minified line's 2,000 characters) or no motion: none; (1.39) a .ts hook's mention takes it back; never in a feature report (got " +
      js({ said, mentions, script, still, fr: Object.keys(fr) }) + ")", {
      said: () => js(said) === js([{ code: "no-reduced-motion", count: 3, file: "src/b/Pop.vue", line: 5 }]),
      mentions: () => Object.values(mentions).every((f) => js(f) === "[]"),
      script: () => js(script) === "[]",
      noMotion: () => js(still) === "[]",
      feature: () => !("facts" in fr),
    });
  }

  { // the fact is said only when no read was cut (CRIT_1 must-fix 6): a file read to its 256K (view-size), the pass's bound
    // (ui-files), a walk the file cap cut (scan.truncated — 20,001 view files: here a scan of the same files marked so)
    const MOTION = { "src/a.css": "@keyframes pop { to { opacity: 1 } }\n" };
    const big = { "src/z/big.html": "<!doctype html>\n<!--\n" + ("y".repeat(99) + "\n").repeat(2800) + "-->\n" };
    const control = inv(project("cut-control", Object.assign({}, MOTION, { "src/z/small.html": "<p>hi</p>\n" })));
    const size = inv(project("cut-size", Object.assign({}, MOTION, big)));
    // (129 pages of exactly 256K — each read whole, no view-size —: the 32 MB bound alone cuts the pass)
    const heavy = Object.assign({}, MOTION);
    for (let i = 0; i < 129; i++) heavy["src/p/p" + String(i).padStart(3, "0") + ".html"] = "<!--\n" + ("y".repeat(99) + "\n").repeat(2621) + "y".repeat(35) + "-->\n";
    const files = inv(project("cut-files", heavy));
    const q = project("cut-walk", MOTION);
    const views = [{ rel: "src/a.css", full: path.join(q, "src/a.css") }];
    const walk = { open: T.uiProject({ views, scripts: [], truncated: false }).facts, cut: T.uiProject({ views, scripts: [], truncated: true }).facts };
    all("1.38 project UI checks: the fact is never said when a read was cut — a file past its 256K, the pass's bound, a truncated walk — a mention may sit in what was not read (got " + js({ control: control.facts, size: [size.facts, size.limits], files: files.limits, walk }) + ")", {
      control: () => control.facts.length === 1 && walk.open.length === 1,
      size: () => js(size.facts) === "[]" && size.limits.some((l) => l.code === "view-size"),
      files: () => js(files.facts) === "[]" && js(files.limits.map((l) => l.code)) === js(["ui-files"]),
      walk: () => js(walk.cut) === "[]",
    });
  }

  { // 1.39 (D6): the reduced-motion script search — run where the fact would be said, over the project's OTHER scripts (no
    // view file, test, story, mock or declaration), the shorter path first, each to its 256K: a mention takes the fact back
    // (outline's: the reset sits in a styled-components `globals.ts` — 1.38's fact there was false), never adds one; a script
    // read only in part keeps the fact and `motion-scripts` names it ({read, count, file: the first by path}); a test setup's
    // mention counts (`jest.setup.js` is no test by name: said less, never wrongly); never the report's limits / truncated
    const COLLAPSIBLE = lines("import styled from \"styled-components\";", "export function Collapsible({ label, children }) {", "  return (", "    <RadixCollapsible.Root>",
      "      <StyledTrigger>", "        <StyledExpandedIcon aria-hidden=\"true\" />", "        {label}", "      </StyledTrigger>", "      <CollapsibleContent>{children}</CollapsibleContent>", "    </RadixCollapsible.Root>", "  );", "}",
      "const StyledExpandedIcon = styled(ExpandedIcon)`", "  flex-shrink: 0;", "  transition: transform 150ms ease-out;", "  margin-left: -4px;", "`;");
    const GLOBALS = lines("import { createGlobalStyle } from \"styled-components\";", "export default createGlobalStyle`", "  @media (prefers-reduced-motion: reduce) {",
      "    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }", "  }", "`;");
    const MENTION = "export const reduce = () => matchMedia(\"(prefers-reduced-motion: reduce)\").matches;\n";
    const base = { "app/components/Collapsible.tsx": COLLAPSIBLE, "shared/styles/index.ts": "export const s = (k) => (p) => p.theme[k];\n" };
    const run = (tag, extra, marker) => {
      const p = project("motion-" + tag, Object.assign({}, base, extra, marker ? { ".specs/steering/design-system.md": "# Design System\n\n" + marker + "\n" } : {}));
      const r = S.designSystemReport(p, { uiPass: true });
      return { facts: r.uiChecks.facts, limits: r.uiChecks.limits, off: r.uiChecks.off, top: [r.limits, r.truncated] };
    };
    const FACT = [{ code: "no-reduced-motion", count: 1, file: "app/components/Collapsible.tsx", line: 15 }];
    const big = (tail) => "export const customers = [\n" + ("  { id: 1000, name: \"James Butt\", country: { name: \"Algeria\", code: \"dz\" } },\n").repeat(3800) + "];\n" + tail;
    const R = {
      outline: run("outline", { "shared/styles/globals.ts": GLOBALS }),
      control: run("control", {}),
      e2e: run("e2e", { "e2e/helpers.ts": MENTION }),
      story: run("story", { "src/Button.stories.ts": MENTION }),
      test: run("test", { "src/motion.test.ts": MENTION }),
      mock: run("mock", { "src/api.mock.ts": MENTION }),
      setup: run("setup", { "jest.setup.js": "window.matchMedia = (q) => ({ matches: q === \"(prefers-reduced-motion: reduce)\" });\n" }),
      part: run("part", { "src/service/CustomerService.js": big("export const reduced = matchMedia(\"(prefers-reduced-motion: reduce)\");\n") }),
      two: run("two", { "zz/a.js": big(""), "aaa/bb.js": big("") }),
      offMention: run("off-mention", { "shared/styles/globals.ts": GLOBALS }, "_UI checks off: no-reduced-motion (our own setting)_"),
      offPart: run("off-part", { "zz/a.js": big("") }, "_UI checks off: no-reduced-motion (our own setting)_"),
    };
    all("1.39 project UI checks (D6): the script search — outline's reset in `shared/styles/globals.ts` takes the fact back (1.38: said); an e2e/ helper, a story, a test, a mock are never read (the fact stands); a test setup's mention counts; a script read only in part keeps the fact and `motion-scripts` names it (count, the first by path — not the first read); a search that read everything says no limit; an off fact is searched too (its off count 0 after a mention, 1 with its limit); never the report's limits / truncated (got " + js(R) + ")", {
      outline: () => js(R.outline.facts) === "[]" && js(R.outline.limits) === "[]",
      control: () => js(R.control.facts) === js(FACT) && js(R.control.limits) === "[]",
      filters: () => ["e2e", "story", "test", "mock"].every((k) => js(R[k].facts) === js(FACT) && js(R[k].limits) === "[]"),
      setup: () => js(R.setup.facts) === "[]",
      part: () => js(R.part.facts) === js(FACT) && js(R.part.limits) === js([{ code: "motion-scripts", read: 2, count: 1, file: "src/service/CustomerService.js" }]),
      two: () => js(R.two.limits) === js([{ code: "motion-scripts", read: 3, count: 2, file: "aaa/bb.js" }]),
      off: () => js(R.offMention.off) === js([{ rule: "no-reduced-motion", reason: "our own setting", count: 0 }]) && js(R.offMention.limits) === "[]"
        && js(R.offPart.off) === js([{ rule: "no-reduced-motion", reason: "our own setting", count: 1 }]) && js(R.offPart.limits) === js([{ code: "motion-scripts", read: 2, count: 1, file: "zz/a.js" }]),
      top: () => Object.values(R).every((x) => js(x.top) === js([[], false])),
    });
  }

  { // 1.39 (D6): the search's bounds and order, on scans built here (uiProject over a scan's lists — the files real, their
    // paths the list's): DS_MOTION_SCRIPTS (2,000) files, DS_MOTION_CHARS (8 MB) characters — the next past either is not
    // read, the fact stays and `motion-scripts` says which bound (`bound`); the shorter path first, then by path; never run
    // where the fact would not be said (a view's mention, no motion, a truncated walk, a view read in part, a view pass its
    // bound cut) and never over a
    // view file, a test or a story (a spy on each entry's `full`)
    const d = project("motion-bounds", { "src/a.css": "@keyframes pop { to { opacity: 1 } }\n", "src/m.css": "@media (prefers-reduced-motion: reduce) { * { animation: none; } }\n", "src/plain.css": ".a { color: red; }\n",
      "src/big.html": "<!--\n" + ("y".repeat(99) + "\n").repeat(2700) + "-->\n", "lib/p.ts": "export const p = 1;\n", "lib/m.ts": "export const r = matchMedia(\"(prefers-reduced-motion: reduce)\");\n",
      "lib/b.ts": "y".repeat(256 * 1024), "src/p.html": "<!--\n" + "y".repeat(256 * 1024 - 9) + "-->\n" });
    const F = (rel) => path.join(d, rel), P = F("lib/p.ts"), M = F("lib/m.ts"), B = F("lib/b.ts");
    const view = (rel) => ({ rel, full: F(rel) });
    const motion = [view("src/a.css")];
    const sc = (scripts, views = motion, truncated = false) => { const u = T.uiProject({ views, scripts, truncated }, null); return { facts: u.facts.length, limits: u.limits }; };
    const pad = (i) => String(i).padStart(4, "0");
    const plain = (n, dir = "s/f") => Array.from({ length: n }, (_, i) => ({ rel: dir + pad(i) + ".ts", full: P }));
    const S1 = {
      last2000: sc(plain(1999).concat([{ rel: "s/f1999.ts", full: M }])),
      past2000: sc(plain(2000).concat([{ rel: "s/f2000.ts", full: M }])),
      shorter: sc(plain(2000).concat([{ rel: "z/m.ts", full: M }])),
      byPath: sc(plain(2000).concat([{ rel: "a/f0000.ts", full: M }])),
      chars: sc(Array.from({ length: 32 }, (_, i) => ({ rel: "c/b" + pad(i) + ".ts", full: B })).concat([{ rel: "c/b0032.ts", full: M }])),
      charsIn: sc(Array.from({ length: 31 }, (_, i) => ({ rel: "c/b" + pad(i) + ".ts", full: B })).concat([{ rel: "c/b0031.ts", full: M }])),
    };
    const F1 = [{ code: "motion-scripts", read: 2000, bound: "files" }], F2 = [{ code: "motion-scripts", read: 32, bound: "chars" }];
    // (the spy: an entry whose `full` is asked for is one the search reads)
    const asked = [];
    const spy = (rel) => ({ rel, get full() { asked.push(rel); return P; } });
    const spies = () => ["src/App.tsx", "src/components/Card.js", "e2e/helpers.ts", "src/a.test.ts", "src/b.stories.ts", "src/c.mock.ts", "src/hooks/use-motion.ts"].map(spy);
    const runs = {};
    // (a view pass its 32 MB bound cut: the keyframes sheet, then 129 pages of exactly 256K — the 129th unread)
    const pages = [view("src/a.css")].concat(Array.from({ length: 129 }, (_, i) => ({ rel: "src/p/p" + String(i).padStart(3, "0") + ".html", full: F("src/p.html") })));
    for (const [k, views, truncated] of [["mention", [view("src/a.css"), view("src/m.css")], false], ["still", [view("src/plain.css")], false], ["truncated", motion, true],
      ["part", [view("src/a.css"), view("src/big.html")], false], ["cut", pages, false], ["open", motion, false]]) {
      asked.length = 0;
      sc(spies(), views, truncated);
      runs[k] = asked.slice();
    }
    all("1.39 project UI checks (D6): the search ends at 2,000 scripts (the 2,000th read, the 2,001st not: the fact stays, `bound: files`) or 8 MB (32 of 256K read, the 33rd not: `bound: chars`; 31 then the mention: read); the shorter path first, then by path; never run where the fact would not be said, never over a view file, a test, a story or a mock (got " + js({ S1, runs }) + ")", {
      files: () => S1.last2000.facts === 0 && S1.past2000.facts === 1 && js(S1.past2000.limits) === js(F1),
      order: () => S1.shorter.facts === 0 && S1.byPath.facts === 0,
      chars: () => S1.chars.facts === 1 && js(S1.chars.limits) === js(F2) && S1.charsIn.facts === 0,
      notRun: () => ["mention", "still", "truncated", "part", "cut"].every((k) => js(runs[k]) === "[]"),
      onlyScripts: () => js(runs.open) === js(["src/hooks/use-motion.ts"]),
    });
    // (a cost guard — the search ends at the first mention: 400 scripts whose first mentions cost at most half the same 400 with
    // none; measured at the same moment)
    const first = [{ rel: "s/a.ts", full: M }].concat(plain(399)), none = plain(400);
    const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const ms = (f) => { const t0 = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t0) / 1e6; };
    sc(first); sc(none); // (warm)
    const sample = remeasure(() => {
      const xs = { first: [], none: [] };
      for (let k = 0; k < 5; k++) { xs.first.push(ms(() => sc(first))); xs.none.push(ms(() => sc(none))); }
      const m = { first: Math.round(med(xs.first) * 10) / 10, none: Math.round(med(xs.none) * 10) / 10 };
      return Object.assign(m, { ratio: Math.round(m.first / m.none * 100) / 100 });
    }, (s) => s.ratio <= 0.5);
    all("1.39 project UI checks (D6): the search stops at the first mention — 400 scripts whose first mentions cost at most 0.5× the same 400 with none (got " + js(sample) + ")", {
      ratio: () => sample.ratio <= 0.5,
    });
  }

  { // the marker `_UI checks off: <rule-id> (reason)_` in design-system.md: ids validated against UI_RULES ∪ UI_FACTS (F0c's
    // font-size-viewport taken), any case; the reason what the outer parentheses hold, commas too; an entry with no reason, an
    // unknown id or another shape is NOT applied and said (why); a marker in a comment or a fence applies nothing; an applied
    // rule (or the fact) is hidden from the inventory — counted in `off`, never in total / byRule / facts
    const MARKER = lines("# Design System", "", "_UI checks off: Outline-Removed (what-input: mouse, touch only), img-no-alt, img-no-alt (), click-no-keyboard ( ), outline-remove (typo), transition-all: kit code, no-reduced-motion (a motion setting of our own), font-size-viewport (the full-bleed hero), outline-removed (a second time)_",
      "", "<!-- _UI checks off: zoom-disabled (commented)_ -->", "", "```", "_UI checks off: paste-blocked (fenced)_", "```");
    // (what-input's demo: a modality scope over `*:focus` — no syntax tells it from a page scope, the marker switches it off)
    const files = { ".specs/steering/design-system.md": MARKER, "src/demo.css": "[data-whatintent='mouse'], [data-whatintent='touch'] {\n  *:focus {\n    outline: none;\n  }\n}\n",
      "src/Hero.tsx": lines("export const Hero = () => (", "  <main>", "    <meta name=\"viewport\" content=\"width=device-width, user-scalable=no\" />", "    <img src=\"/a.png\" />", "    <div onClick={go}>open</div>",
        "    <p className=\"text-[5vw] animate-in\">404</p>", "    <input onPaste={(e) => e.preventDefault()} />", "  </main>", ");") };
    const p = project("marker", files);
    const reg = S.designSystemReport(p).registry, u = inv(p);
    const control = inv(project("marker-control", Object.assign({}, files, { ".specs/steering/design-system.md": "# Design System\n" })));
    all("1.38 project UI checks: `_UI checks off:_` — Outline-Removed (any case) and the fact applied with their reasons (a comma inside the parentheses kept), F0c's font-size-viewport taken; a bare id, `()`, `( )`, an unknown id, `id: text` not applied and said; the first of an id twice; a commented or fenced marker applies nothing; each off rule counted, never in total / byRule / facts (got " +
      js({ u, control: [control.byRule, control.facts.length] }) + ")", {
      off: () => js(u.off) === js([{ rule: "outline-removed", reason: "what-input: mouse, touch only", count: 1 }, { rule: "no-reduced-motion", reason: "a motion setting of our own", count: 1 },
        { rule: "font-size-viewport", reason: "the full-bleed hero", count: 1 }]),
      ignored: () => js(u.offIgnored) === js([{ entry: "img-no-alt", why: "no-reason" }, { entry: "img-no-alt", why: "no-reason" }, { entry: "click-no-keyboard", why: "no-reason" },
        { entry: "outline-remove", why: "unknown-rule" }, { entry: "transition-all: kit code", why: "unreadable" }]),
      hidden: () => js(u.byRule) === js({ "zoom-disabled": 1, "img-no-alt": 1, "click-no-keyboard": 1, "paste-blocked": 1 }) && u.total === 4 && js(u.facts) === "[]",
      control: () => js(control.byRule) === js({ "zoom-disabled": 1, "img-no-alt": 1, "outline-removed": 1, "click-no-keyboard": 1, "paste-blocked": 1, "font-size-viewport": 1 }) && control.facts.length === 1,
      noMarker: () => !("off" in control) && !("offIgnored" in control) && reg.exists === true,
    });
  }

  { // 1.39 (UP-7): an id in ONE balanced code span is applied — the docs write ids so —, its reason the parentheses'; a code
    // span around a name that is no rule is unknown-rule; a lone backtick (either side) or a doubled pair is another shape
    const MARKER = "# Design System\n\n_UI checks off: `img-no-alt` (decorative art), `foo` (x), `click-no-keyboard (x), paste-blocked` (x), ``zoom-disabled`` (x), transition-all (kit code)_\n";
    const u = inv(project("marker-code", { ".specs/steering/design-system.md": MARKER, "src/A.tsx": "export const A = () => <div className=\"transition-all\"><img src=\"/a.png\" /></div>;\n" }));
    all("1.39 project UI checks: `_UI checks off:_` — an id in one code span applied with its reason (as a bare one), a code span naming no rule unknown-rule, a lone or a doubled backtick unreadable (got " + js({ off: u.off, ignored: u.offIgnored }) + ")", {
      off: () => js(u.off) === js([{ rule: "img-no-alt", reason: "decorative art", count: 1 }, { rule: "transition-all", reason: "kit code", count: 1 }]) && u.total === 0,
      ignored: () => js(u.offIgnored) === js([{ entry: "foo", why: "unknown-rule" }, { entry: "`click-no-keyboard (x)", why: "unreadable" }, { entry: "paste-blocked` (x)", why: "unreadable" },
        { entry: "``zoom-disabled`` (x)", why: "unreadable" }]),
    });
  }

  { // the marker's bounds: DS_MARKER_ENTRIES (50) entries read — the 51st said `past-bound` (with the bound) and not applied —, a
    // reason cut at DS_CELL_MAX (200); an entry the reason of which is only past the bound is never applied silently
    const entries = Array.from({ length: 50 }, (_, i) => "img-no-alt (reason " + i + ")").concat(["click-no-keyboard (the 51st)"]);
    const p = project("marker-bounds", { ".specs/steering/design-system.md": "# Design System\n\n_UI checks off: " + entries.join(", ") + "_\n\n_UI checks off: zoom-disabled (a later line)_\n",
      "src/A.tsx": "export const A = () => <div onClick={go}>open <img src=\"/a.png\" /></div>;\n" });
    const u = inv(p);
    const long = inv(project("marker-long", { ".specs/steering/design-system.md": "_UI checks off: img-no-alt (" + "x".repeat(300) + ")_\n", "src/A.tsx": IMG }));
    // (an off rule's findings past a file's cap are hidden too)
    const rows = Array.from({ length: 201 }, (_, i) => "    <li className=\"transition-all\">Row " + i + "</li>");
    const past = inv(project("marker-past", { ".specs/steering/design-system.md": "_UI checks off: transition-all (kit code)_\n", "src/L.tsx": lines("export const L = () => (", "  <ul>", ...rows, "  </ul>", ");") }));
    all("1.38 project UI checks: the marker reads 50 entries — the 51st and every later one not applied, said once with the bound; a reason is cut at 200 characters; an off rule's findings past a file's cap are hidden too (got " + js({ off: u.off, ignored: u.offIgnored, byRule: u.byRule, long: long.off.map((o) => o.reason.length), past: [past.byRule, past.off] }) + ")", {
      bound: () => js(u.off) === js([{ rule: "img-no-alt", reason: "reason 0", count: 1 }]) && js(u.offIgnored) === js([{ entry: "click-no-keyboard (the 51st)", why: "past-bound", read: 50 }]),
      later: () => js(u.byRule) === js({ "click-no-keyboard": 1 }),
      cut: () => js(long.off.map((o) => o.reason.length)) === js([200]) && long.total === 0,
      past: () => js(past.byRule) === "{}" && js(past.off) === js([{ rule: "transition-all", reason: "kit code", count: 201 }]),
    });
  }

  { // G1′ (CRIT_X D4, the decisions): the pass costs at most 1.5× a bare read of its files plus uiChecksOf of the same texts in
    // memory — measured at the same moment, interleaved, on a real-shaped tree with a Sass-heavy share (Bootstrap-like partials:
    // parsing unminified CSS is most of a Sass tree's pass — CRIT_1, 5.5× a bare read there): what the pass adds is its own
    // bookkeeping, never a second read or a second walk
    const BUTTON = lines("import * as React from \"react\"", "import { Slot } from \"@radix-ui/react-slot\"", "import { cva } from \"class-variance-authority\"", "import { cn } from \"@/lib/utils\"",
      "const buttonVariants = cva(", "  \"inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all disabled:opacity-50 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]\",",
      "  { variants: { variant: { default: \"bg-primary text-primary-foreground hover:bg-primary/90\", link: \"text-primary underline-offset-4 hover:underline\" } } }", ")",
      "function Button({ className, variant, asChild = false, ...props }) {", "  const Comp = asChild ? Slot : \"button\"", "  return <Comp data-slot=\"button\" className={cn(buttonVariants({ variant, className }))} {...props} />", "}",
      "function DialogOverlay({ className, ...props }) {", "  return <DialogPrimitive.Overlay data-slot=\"dialog-overlay\" className={cn(\"data-[state=open]:animate-in data-[state=closed]:fade-out-0 fixed inset-0 z-50 bg-black/50\", className)} {...props} />", "}",
      "export const Card = ({ items, go }) => (", "  <div className=\"grid gap-4 p-4\">", "    {items.map((i) => (", "      <a key={i.id} href={i.href} onClick={go} className=\"rounded-lg border p-4 hover:bg-accent\">", "        <img src={i.src} alt={i.alt} />", "        <h3 className=\"text-lg font-semibold\">{i.title}</h3>",
      "      </a>", "    ))}", "  </div>", ");", "export { Button, buttonVariants }");
    const VUE = lines("<template>", "  <div class=\"card\" @click=\"open = true\">", "    <img :src=\"cover\" :alt=\"title\" />", "    <p>{{ title }}</p>", "  </div>", "</template>", "<script setup>", "defineProps({ title: String, cover: String })", "</script>",
      "<style scoped>", ".card { padding: 13px; color: #123456; transition: opacity .2s; }", ".card:focus-visible { outline: 2px solid; }", "@keyframes pop { from { transform: scale(.9) } to { transform: none } }", "</style>");
    const MODULE = lines(".root { display: grid; gap: var(--gap); padding: 1rem; }", ".root:hover { color: var(--fg); }", ".title { font-size: 1.25rem; font-weight: 600; }", ".icon { width: 1rem; height: 1rem; transition: transform .2s ease; }");
    const HTML = lines("<!doctype html>", "<html lang=\"en\">", "<head>", "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">", "<title>Docs</title>", "</head>", "<body>",
      "<nav class=\"navbar\"><a class=\"brand\" href=\"/\">Docs</a><button class=\"toggler\" type=\"button\">Menu</button></nav>", "<main><h1>Getting started</h1><p>Install the package.</p><img src=\"/shot.png\" alt=\"A screenshot\"></main>", "</body>", "</html>");
    const partial = (k) => Array.from({ length: 24 }, (_, i) => lines("$card-" + k + "-" + i + "-tokens: defaults((", "  --card-spacer-y: var(--spacer-6),", "  --card-border-width: var(--border-width),", "  --card-inner-border-radius: calc(var(--card-border-radius) - var(--border-width)),", "), $card-tokens);",
      "@layer components {", "  .card-" + k + "-" + i + " {", "    @include tokens($card-tokens);", "    position: relative;", "    display: flex;", "    border: var(--card-border-width) solid var(--theme-bg, var(--card-border-color));", "    @include border-radius(var(--card-border-radius));",
      "    > :is(.card-img-top, .card-body) { + :is(.card-body, .list-group) { border-block-start: var(--card-border-width) solid; } }", "    &:hover { color: var(--card-hover-color); }", "    &:focus-visible { outline: 0; box-shadow: var(--focus-ring); }",
      "    .btn-check:checked + & { background-color: var(--card-active-bg); transition: background-color .15s ease-in-out, border-color .15s ease-in-out; }", "  }", "}",
      "@media (prefers-reduced-motion: reduce) { .card-" + k + "-" + i + " { transition: none; } }")).join("");
    const files = {};
    for (let i = 0; i < 240; i++) files["src/components/ui/c" + String(i).padStart(3, "0") + ".tsx"] = BUTTON;
    for (let i = 0; i < 40; i++) files["src/views/V" + String(i).padStart(2, "0") + ".vue"] = VUE;
    for (let i = 0; i < 60; i++) files["src/styles/m" + String(i).padStart(2, "0") + ".module.css"] = MODULE;
    for (let i = 0; i < 20; i++) files["site/p" + String(i).padStart(2, "0") + ".html"] = HTML;
    for (let i = 0; i < 40; i++) files["scss/_part" + String(i).padStart(2, "0") + ".scss"] = partial(i);
    const p = project("cost", files);
    const list = Object.keys(files).map((rel) => ({ rel, full: path.join(p, rel) }));
    const sass = Object.entries(files).filter(([rel]) => rel.endsWith(".scss")).reduce((n, [, t]) => n + t.length, 0), all1 = Object.values(files).reduce((n, t) => n + t.length, 0);
    const bare = () => { const h = T.readFileHeads(list.map((x) => x.full), 256 * 1024 + 1); let n = 0; try { for (const x of list) { const t = h.next(); if (t != null) n += t.length; } } finally { h.stop(); } return n; };
    const texts = list.map((x) => [x.rel, files[x.rel]]);
    const parse = () => { let n = 0; for (const [rel, t] of texts) n += T.uiChecksOf(T.viewLines(t, rel), rel).findings.length; return n; };
    const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const ms = (f) => { const t0 = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t0) / 1e6; };
    // (the pass itself — uiProject over the walk's files, as the report runs it — never a difference of two reports: the scan's
    // own time would be the noise; the report runs it: the opted-in report holds the same inventory)
    const scan = { views: list, scripts: [], truncated: false };
    const pass = () => T.uiProject(scan, null);
    const same = js(pass()) === js(S.designSystemReport(p, { uiPass: true }).uiChecks);
    bare(); parse(); // (warm)
    const sample = remeasure(() => {
      const xs = { pass: [], bare: [], parse: [] };
      for (let k = 0; k < 5; k++) {
        xs.pass.push(ms(pass));
        xs.bare.push(ms(bare));
        xs.parse.push(ms(parse));
      }
      const m = Object.fromEntries(Object.entries(xs).map(([k, v]) => [k, Math.round(med(v) * 10) / 10]));
      return Object.assign(m, { ratio: Math.round(m.pass / (m.bare + m.parse) * 100) / 100 });
    }, (s) => s.ratio <= 1.5);
    all("1.38 project UI checks (G1′): the pass costs at most 1.5× a bare read of its 400 files plus uiChecksOf of the same texts in memory, a Sass-heavy share (" +
      Math.round(sass / all1 * 100) + " % of the characters) among them, measured interleaved at the same moment (got " + js(sample) + ")", {
      ratio: () => sample.ratio <= 1.5,
      same: () => same,
      sassShare: () => sass * 3 >= all1,
    });
  }
};
