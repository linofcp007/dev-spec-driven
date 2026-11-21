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
    const LIST = lines("export const List = () => (", "  <ul>", ...rows, "    <li className=\"transition-all\">last</li>", "    <img src=\"/x.png\" />", "  </ul>", ");");
    const alone = inv(project("past", { "src/a/List.tsx": LIST }));
    const listed = inv(project("past-listed", { "src/a/List.tsx": LIST, "src/z/Hero.tsx": IMG }));
    all("1.38 project UI checks: findings past a file's 200 are counted (201 transition-all, the <img> after them); a rule only past a file's cap is placed at its file with no line; a listed place elsewhere wins (got " + js({ alone, listed: listed.rules }) + ")", {
      past: () => alone.byRule["transition-all"] === 201 && alone.byRule["img-no-alt"] === 1 && alone.total === 202,
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
    const p = project("limits", { "src/landing/big.html": big, "src/landing/exact.html": exact, "src/landing/index.html": page, "src/landing/A.tsx": tag });
    const r = S.designSystemReport(p, { uiPass: true }), u = r.uiChecks;
    all("1.38 project UI checks: the inventory names its read bounds — view-size (count, the first file; a file of exactly 256K is read whole: its <img> counted), line-length (the <img> below the cut line counted), tag-length — and none reaches the report's limits / truncated (got " + js({ u, limits: r.limits, truncated: r.truncated }) + ")", {
      limits: () => js(u.limits) === js([{ code: "view-size", read: 262144, count: 1, file: "src/landing/big.html" }, { code: "line-length", read: 2000, count: 1, file: "src/landing/index.html" },
        { code: "tag-length", read: 30, count: 1, file: "src/landing/A.tsx" }]),
      cut: () => u.byRule["img-no-alt"] === 3 && u.rules["img-no-alt"].files === 3 && u.read === 4, // (A.tsx's after the failed tag read, exact's, index's — never big's)
      top: () => js(r.limits) === js([]) && r.truncated === false,
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
    // (a focus style read before the cut excuses the removal: no count on the limit — the same 5,001 sheets)
    write(p, "a/f.css", ":focus-visible { outline: 2px solid; }\n");
    const f = inv(p);
    all("1.38 project UI checks: the pass stops at 5,000 files read or 32 MB of their characters — `ui-files` names it, with the removals it left unjudged (count, the first file:line) when no focus style was read; a focus style read before the cut still excuses (got " +
      js({ files: u.limits, chars: c.limits, focus: [f.total, f.limits] }) + ")", {
      files: () => js(u.limits) === js([{ code: "ui-files", read: 5000, count: 1, file: "a/r.css", line: 3 }]) && u.total === 0,
      chars: () => js(c.limits.filter((l) => l.code === "ui-files")) === js([{ code: "ui-files", read: 129, count: 1, file: "a/r.css", line: 3 }]),
      focus: () => f.total === 0 && js(f.limits) === js([{ code: "ui-files", read: 5000 }]),
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
    S.designSystemReport(p); S.designSystemReport(p, { uiPass: true }); bare(); parse(); // (warm)
    const sample = remeasure(() => {
      const xs = { plain: [], pass: [], bare: [], parse: [] };
      for (let k = 0; k < 5; k++) {
        xs.plain.push(ms(() => S.designSystemReport(p)));
        xs.pass.push(ms(() => S.designSystemReport(p, { uiPass: true })));
        xs.bare.push(ms(bare));
        xs.parse.push(ms(parse));
      }
      const m = Object.fromEntries(Object.entries(xs).map(([k, v]) => [k, Math.round(med(v) * 10) / 10]));
      return Object.assign(m, { ratio: Math.round((m.pass - m.plain) / (m.bare + m.parse) * 100) / 100 });
    }, (s) => s.ratio <= 1.5);
    all("1.38 project UI checks (G1′): the pass — the report with it less the report without — costs at most 1.5× a bare read of its 400 files plus uiChecksOf of the same texts in memory, a Sass-heavy share (" +
      Math.round(sass / all1 * 100) + " % of the characters) among them, measured interleaved at the same moment (got " + js(sample) + ")", {
      ratio: () => sample.ratio <= 1.5,
      sassShare: () => sass * 3 >= all1,
    });
  }
};
