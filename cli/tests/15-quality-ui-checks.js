"use strict";
// The UI checks on the CLI (1.37) — `design-system <feature>`: the UI block after the raw values (each finding, the report-only
// tag, what each rule means, the silenced count, a bound of the checks' own said once), --json; `finish` without a registry.

const fs = require("fs");
const path = require("path");
const MSG = require(path.join(__dirname, "..", "..", "mcp", "lib", "i18n.js")).msg; // a message checked against its i18n entry, not a pinned sentence (1.30)

exports.run = ({ all, runIn, tmp, require, __dirname }) => {
  const SR = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return {}; } };
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const feature = (tag, lang, files) => {
    const p = path.join(tmp, "p137-uic-" + tag);
    SR.initProject(p, ["ui"], lang);
    const f = SR.createFeature(p, { name: "Checkout", tracks: ["ui"], summary: "x", lang });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build\n  - _Requirements: US-1.AC-1_\n  - _Implements: " + files.join(", ") + "_\n  - _Verify: npm test_\n");
    return { p, slug: f.slug };
  };
  const CHECKOUT = ["export const Checkout = ({ items, go }) => (", "  <div className=\"grid transition-all\" onClick={go}>", "    {/* ui-check-off: img-no-alt */}",
    "    <img src=\"/spacer.gif\" />", "    {items.map((i) => <img key={i.id} src={i.src} />)}", "  </div>", ");", ""].join("\n");

  { // the human block, --json, Portuguese
    const g = feature("en", "en", ["src/checkout/Checkout.tsx"]);
    write(g.p, "src/checkout/Checkout.tsx", CHECKOUT);
    const r = runIn(["design-system", g.slug, "--project", g.p]), j = runIn(["design-system", g.slug, "--project", g.p, "--json"]);
    const T = MSG("en").cliOutput;
    const clean = feature("clean", "en", ["src/checkout/Ok.tsx"]);
    write(clean.p, "src/checkout/Ok.tsx", "export const Ok = () => <button type=\"button\">ok</button>;\n");
    const rc = runIn(["design-system", clean.slug, "--project", clean.p]);
    const pt = feature("pt", "pt", ["src/checkout/Checkout.tsx"]);
    write(pt.p, "src/checkout/Checkout.tsx", CHECKOUT);
    const rp = runIn(["design-system", pt.slug, "--project", pt.p]);
    const P = MSG("pt").cliOutput;
    // (review 1 of 1.37: a feature without +ui — finish reads none of its checks — gets the plain head, in its language)
    const plainP = path.join(tmp, "p137-uic-plain");
    SR.initProject(plainP, ["core"], "es");
    const plain = SR.createFeature(plainP, { name: "Reports", tracks: ["core"], summary: "x", lang: "es" });
    fs.writeFileSync(path.join(plain.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build\n  - _Implements: src/reports/Chart.tsx_\n  - _Verify: npm test_\n");
    write(plainP, "src/reports/Chart.tsx", "export const Chart = () => <img src=\"/chart.png\" />;\n");
    const rn = runIn(["design-system", plain.slug, "--project", plainP]);
    const E = MSG("es").cliOutput;
    all("1.37 design-system <feature> (CLI): the UI checks after the raw values — the head, each finding as `file:line  rule  value` (a report-level one tagged), what each rule that appears means, the silenced count; none: one line; --json IS spec_scan {designSystem: true, name}'s result; a Portuguese feature in Portuguese; exit 0 (got " +
      js([r.code, r.out, rc.out, rp.out]) + ")", {
      head: () => r.code === 0 && r.out.includes(T.uiHead(3)) && r.out.indexOf(T.uiHead(3)) > r.out.indexOf(T.dsRawNone(1)),
      lines: () => r.out.includes("    src/checkout/Checkout.tsx:2  click-no-keyboard  <div onClick>\n") && r.out.includes("    src/checkout/Checkout.tsx:5  img-no-alt  <img>\n") &&
        r.out.includes("    src/checkout/Checkout.tsx:2  transition-all  transition-all  " + T.uiReportTag + "\n"),
      legend: () => r.out.includes(T.uiLegend + "\n    click-no-keyboard — " + T.uiRule["click-no-keyboard"] + "\n    img-no-alt — " + T.uiRule["img-no-alt"] + "\n    transition-all — " + T.uiRule["transition-all"]) &&
        !r.out.includes("paste-blocked — "),
      silenced: () => r.out.includes(T.uiSilenced(1)),
      none: () => rc.code === 0 && rc.out.includes(T.uiNone(1)) && !rc.out.includes(T.uiLegend),
      json: () => j.code === 0 && js(jsonOf(j).uiChecks) === js(SR.designSystemReport(g.p, { name: g.slug }).uiChecks),
      pt: () => rp.code === 0 && rp.out.includes(P.uiHead(3)) && rp.out.includes("click-no-keyboard — " + P.uiRule["click-no-keyboard"]) && rp.out.includes(P.uiSilenced(1)),
      plainHead: () => rn.code === 0 && rn.out.includes(E.uiHeadPlain(1) + "\n") && !rn.out.includes(E.uiHead(1)) && !r.out.includes(T.uiHeadPlain(3)),
    });
  }

  { // a bound of the checks' own is said once: 200 view files and a token file — the token file unread for the checks
    // (uiChecks.limits: view-files, the report's own limits none) → the line once; 201 view files → both say it → still once
    const mk = (tag, n) => {
      const g = feature(tag, "en", ["src/views/", "src/app/globals.css"]);
      for (let i = 0; i < n; i++) write(g.p, "src/views/V" + String(i).padStart(3, "0") + ".tsx", "export const V = () => <b>v</b>;\n");
      write(g.p, "src/app/globals.css", ":root {\n  --a: #ffffff;\n  --b: #000000;\n  --c: #1d4ed8;\n  --d: 4px;\n  --e: 8px;\n}\n* { transition: all .2s; }\n");
      return g;
    };
    const a = mk("cap200", 200), b = mk("cap201", 201);
    const ra = runIn(["design-system", a.slug, "--project", a.p]), rb = runIn(["design-system", b.slug, "--project", b.p]);
    const line = MSG("en").cliOutput.dsLimit["view-files"](200);
    const count = (out) => out.split(line).length - 1;
    all("1.37 design-system <feature> (CLI): a bound that cut what the UI checks read is printed — once, whether the report's own limits say it too or not (got " + js([count(ra.out), count(rb.out)]) + ")", {
      own: () => ra.code === 0 && count(ra.out) === 1,
      shared: () => rb.code === 0 && count(rb.out) === 1,
    });
  }

  { // a bound of the checks' own with a count (review 1 of 1.37): a line cut at 2,000 — said once, with how many and the first
    // file; each such bound has its line in EN / PT / pt-BR / ES, naming the count and the file
    const g = feature("line", "en", ["src/landing/index.html"]);
    write(g.p, "src/landing/index.html", "<header><img src=\"data:image/png;base64," + "A".repeat(2600) + "\" alt=\"Acme\"></header>\n<img src=\"/team.jpg\">\n");
    const r = runIn(["design-system", g.slug, "--project", g.p]);
    const line = MSG("en").cliOutput.dsLimit["line-length"](2000, "src/landing/index.html", 1);
    const said = ["en", "pt", "pt-BR", "es"].map((l) => ["view-size", "line-length", "tag-length", "file-findings"].every((c) => { const fn = MSG(l).cliOutput.dsLimit[c]; return typeof fn === "function" && /7/.test(fn(3, "a/b.tsx", 7)) && fn(3, "a/b.tsx", 7).includes("a/b.tsx"); }));
    all("1.37 design-system <feature> (CLI): a cut line is said once, with its count and its file; the checks' counted bounds have their line in every language (got " + js([r.code, r.out.split(line).length - 1, said]) + ")", {
      once: () => r.code === 0 && r.out.split(line).length - 1 === 1 && !r.out.includes("undefined"),
      strings: () => said.every(Boolean),
    });
  }

  { // review 2 of 1.37 (R2-E1): the removals a focus search left unjudged at its bound — the report names them (never "nothing"),
    // finish prints its warning; each language says the count, the first file:line and focus-chars' sheet
    const g = feature("unjudged", "en", ["src/checkout/reset.css"]);
    write(g.p, "src/checkout/reset.css", "*:focus {\n  outline: 0;\n}\n");
    for (let i = 0; i < 49; i++) write(g.p, "src/sheets/s" + String(i).padStart(3, "0") + ".css", ".s" + i + " { color: red; }\n");
    const r = runIn(["design-system", g.slug, "--project", g.p]), f = runIn(["finish", g.slug, "--project", g.p]);
    // (review 3 of 1.37: the characters bound — one sheet alone longer than 384K: the report's line and finish say the bound and that)
    const h = feature("unjudged-chars", "en", ["src/checkout/reset.css"]);
    write(h.p, "src/checkout/reset.css", "*:focus {\n  outline: 0;\n}\n");
    write(h.p, "styles/app.css", ".b { color: red; }\n".repeat(21000));
    const rh = runIn(["design-system", h.slug, "--project", h.p]), fh = runIn(["finish", h.slug, "--project", h.p]);
    const T = MSG("en").cliOutput;
    // (each language: the bound named; "alone" — the word each language says it with — in the alone lines only, the report's
    // and finish's)
    const ALONE = { en: "alone", pt: "sozinha", "pt-BR": "sozinha", es: "por sí sola" };
    const said = ["en", "pt", "pt-BR", "es"].map((l) => { const D = MSG(l).cliOutput.dsLimit, s = D["focus-sheets"](48, "a/b.css:3", 7), c = D["focus-chars"](2, "a/b.css:3", 7, "big/c.css", 393216, false), w = MSG(l).finish.uiUnjudged(7, "a/b.css:3", 48);
      const ca = D["focus-chars"](2, "a/b.css:3", 7, "big/c.css", 393216, true), wc = MSG(l).finish.uiUnjudged(7, "a/b.css:3", 0, "big/c.css", 393216, false), wa = MSG(l).finish.uiUnjudged(7, "a/b.css:3", 0, "big/c.css", 393216, true);
      return [s, c, w, ca, wc, wa].every((x) => /7/.test(x) && x.includes("a/b.css:3")) && [c, ca, wc, wa].every((x) => x.includes("big/c.css") && x.includes("384K")) &&
        [ca, wa].every((x) => x.includes(ALONE[l])) && ![c, wc].some((x) => x.includes(ALONE[l])); });
    // (review 3 of 1.37: European "para lá de" is never a pt line of the UI checks — pt-BR derives from it; Spanish "hasta que" takes
    // the subjunctive)
    const ptLines = ["pt", "pt-BR"].flatMap((l) => { const D = MSG(l).cliOutput.dsLimit; return [...["view-size", "line-length", "tag-length", "file-findings"].map((c) => D[c](30, "a/b.tsx", 2)),
      D["focus-sheets"](48, "a/b.css:3", 2), D["focus-chars"](2, "a/b.css:3", 2, "big/c.css", 393216, false), D["focus-chars"](0, "a/b.css:3", 2, "big/c.css", 393216, true),
      MSG(l).finish.uiUnjudged(2, "a/b.css:3", 48), MSG(l).finish.uiUnjudged(2, "a/b.css:3", 0, "big/c.css", 393216, false), MSG(l).finish.uiUnjudged(2, "a/b.css:3", 0, "big/c.css", 393216, true)]; });
    const esChars = MSG("es").cliOutput.dsLimit["focus-chars"](2, "a/b.css:3", 2, "big/c.css", 393216, false);
    all("1.37 design-system / finish (CLI): an outline removal the focus search left unjudged at its bound is named — the report's limit line (the count, the first file:line) and no \"nothing\" line; finish prints its warning; every language says the count, the place and focus-chars' sheet, its bound and whether that sheet alone passes it (got " + js([r.out, f.out.slice(0, 600), rh.out, fh.out.slice(0, 600), said, ptLines.filter((x) => /para lá/.test(x)), esChars]) + ")", {
      report: () => r.code === 0 && r.out.includes(T.dsLimit["focus-sheets"](48, "src/checkout/reset.css:2", 1)) && !r.out.includes(T.uiNone(1)),
      finish: () => f.out.includes("  ▲ " + MSG("en").finish.uiUnjudged(1, "src/checkout/reset.css:2", 48)),
      chars: () => rh.code === 0 && rh.out.includes(T.dsLimit["focus-chars"](0, "src/checkout/reset.css:2", 1, "styles/app.css", 393216, true)) && !rh.out.includes(T.uiNone(1)) &&
        fh.out.includes("  ▲ " + MSG("en").finish.uiUnjudged(1, "src/checkout/reset.css:2", 0, "styles/app.css", 393216, true)),
      strings: () => said.every(Boolean),
      prose: () => !ptLines.some((x) => /para lá/.test(x)) && /hasta que big\/c\.css hubiera llevado/.test(esChars),
    });
  }

  { // past the first 50 findings: how many more (the list is spec_scan's first 50)
    const g = feature("more", "en", ["src/rows/"]);
    for (let i = 0; i < 30; i++) write(g.p, "src/rows/Row" + String(i).padStart(2, "0") + ".tsx", "export const R = () => (\n  <li onClick={go}>\n    <img src=\"x.png\" /> Row\n  </li>\n);\n");
    const r = runIn(["design-system", g.slug, "--project", g.p]);
    const T = MSG("en").cliOutput;
    all("1.37 design-system <feature> (CLI): 60 UI findings — 50 lines, then how many more, before what each means (got " + js(r.out.slice(-900)) + ")", {
      more: () => r.code === 0 && r.out.includes(T.uiHead(60)) && r.out.includes(T.dsMore(10) + "\n" + T.uiLegend) && (r.out.match(/\.tsx:\d+ {2}(?:click-no-keyboard|img-no-alt) {2}/g) || []).length === 50,
    });
  }

  { // finish without a registry: the UI warning (▲), the result's designSystem without `raw` — and the CLI reads it without throwing
    const g = feature("finish", "en", ["src/checkout/Checkout.tsx"]);
    write(g.p, "src/checkout/Checkout.tsx", CHECKOUT);
    const r = runIn(["finish", g.slug, "--project", g.p]), j = runIn(["finish", g.slug, "--project", g.p, "--json"]);
    const fin = jsonOf(j);
    const warn = MSG("en").finish.uiChecks(2, "src/checkout/Checkout.tsx:2 click-no-keyboard; src/checkout/Checkout.tsx:5 img-no-alt", g.slug);
    all("1.37 finish (CLI) without a registry: the UI checks' warning is printed (▲), the run ends as any not-ready finish does (exit 1, nothing thrown), --json's designSystem holds uiChecks and empty registered / unregistered, no raw (got " +
      js([r.code, r.out.slice(0, 400), fin.designSystem]) + ")", {
      printed: () => r.code === 1 && r.out.includes("  ▲ " + warn) && !/TypeError|Cannot read/.test(r.out),
      json: () => fin.designSystem && fin.designSystem.raw === undefined && fin.designSystem.uiChecks.total === 2 && js(fin.designSystem.registered) === js([]) && js(fin.designSystem.unregistered) === js([]),
    });
  }

  { // 1.38.0 F0c: font-size-viewport on the CLI — a lone `text-[5vw]` and an inline `fontSize: "5vw"`: their lines, what the rule
    // means (EN / PT / ES), and finish's warning counts them (a warn rule)
    const HERO = ["export const NotFound = () => (", "  <main>", "    <p className=\"text-[30vw] font-bold\">404</p>", "    <h1 style={{ fontSize: \"5vw\" }}>Lost</h1>", "  </main>", ");", ""].join("\n");
    const runs = ["en", "pt", "es"].map((lang) => { const g = feature("vw-" + lang, lang, ["src/errors/NotFound.tsx"]); write(g.p, "src/errors/NotFound.tsx", HERO); return [lang, g, runIn(["design-system", g.slug, "--project", g.p])]; });
    const [, ge, re] = runs[0];
    const f = runIn(["finish", ge.slug, "--project", ge.p]);
    all("1.38.0 design-system <feature> / finish (CLI): font-size-viewport — each finding's line, what the rule means in the feature's language, and finish's UI warning names both (got " +
      js(runs.map(([, , r]) => [r.code, r.out.slice(-700)]).concat([f.out.slice(0, 600)])) + ")", {
      lines: () => re.code === 0 && re.out.includes("    src/errors/NotFound.tsx:3  font-size-viewport  text-[30vw]\n") && re.out.includes("    src/errors/NotFound.tsx:4  font-size-viewport  <h1 style> fontSize: 5vw\n"),
      legend: () => runs.every(([lang, , r]) => r.out.includes("    font-size-viewport — " + MSG(lang).cliOutput.uiRule["font-size-viewport"])),
      // (the mutation pass: a PT / ES key renamed fell back to EN's text unseen — each language says it in its own words)
      translated: () => ["pt", "pt-BR", "es"].every((l) => /\(WCAG 1\.4\.4, (?:falha|fallo) F94\)$/.test(MSG(l).cliOutput.uiRule["font-size-viewport"] || "")),
      finish: () => f.out.includes("  ▲ " + MSG("en").finish.uiChecks(2, "src/errors/NotFound.tsx:3 font-size-viewport; src/errors/NotFound.tsx:4 font-size-viewport", ge.slug)),
    });
  }

  { // 1.38: the project's UI checks — `design-system` without a feature (the operation opts in): after the registry part, the
    // inventory's head, a line per rule (count, files, the first place; a report-level one tagged; warn first), the silenced
    // count, its limits; nothing found: one line; a cut pass that left a removal unjudged: its limit line, never "nothing"
    const proj = (tag, lang, files) => { const p = path.join(tmp, "p138-uip-" + tag); SR.initProject(p, ["ui"], lang); for (const [rel, text] of Object.entries(files)) write(p, rel, text); return p; };
    const IMG = "export const Hero = () => <img src=\"/hero.png\" />;\n";
    const A = ["export const A = () => (", "  <div className=\"transition-all\">", "    <img src=\"/a.png\" />", "    <img src=\"/b.png\" />", "    {/* ui-check-off: img-no-alt */}", "    <img src=\"/c.png\" />", "  </div>", ");", ""].join("\n");
    const p = proj("en", "en", { "src/A.tsx": A, "src/B.tsx": IMG });
    const r = runIn(["design-system", "--project", p]);
    const clean = runIn(["design-system", "--project", proj("clean", "en", { "src/Ok.tsx": "export const Ok = () => <button type=\"button\">ok</button>;\n" })]);
    const pt = runIn(["design-system", "--project", proj("pt", "pt", { "src/A.tsx": A, "src/B.tsx": IMG })]);
    // (a cut pass: 129 view files of 256K after a reset — 32 MB read —, no focus style read: the removal unjudged)
    const big = { "a/r.css": "*:focus {\n  outline: none;\n}\n" }, body = "<!--\n" + ("y".repeat(99) + "\n").repeat(2700) + "-->\n";
    for (let i = 0; i < 129; i++) big["src/p/p" + String(i).padStart(3, "0") + ".html"] = body;
    const cut = runIn(["design-system", "--project", proj("cut", "en", big)]);
    const T = MSG("en").cliOutput, P = MSG("pt").cliOutput;
    const lineOf = (out, s) => out.split("\n").indexOf(s);
    all("1.38 design-system (CLI): the project's UI checks — after the registry part the inventory's head, a line per rule (its count, its files, the first place; report-level tagged), the silenced count; nothing found: one line; a cut pass leaving a removal unjudged prints its limit, never \"nothing\"; Portuguese in Portuguese (got " +
      js([r.code, r.out, clean.out, cut.out.slice(-700), pt.out.slice(-500)]) + ")", {
      head: () => r.code === 0 && lineOf(r.out, T.uiProjectHead(4, 2)) > lineOf(r.out, T.dsCreate) && lineOf(r.out, T.dsCreate) > 0,
      rules: () => lineOf(r.out, T.uiProjectRule("img-no-alt", 3, 2, "src/A.tsx:3", "")) === lineOf(r.out, T.uiProjectHead(4, 2)) + 1 &&
        lineOf(r.out, T.uiProjectRule("transition-all", 1, 1, "src/A.tsx:2", T.uiReportTag)) === lineOf(r.out, T.uiProjectHead(4, 2)) + 2,
      silenced: () => lineOf(r.out, T.uiSilenced(1)) === lineOf(r.out, T.uiProjectHead(4, 2)) + 3,
      none: () => clean.code === 0 && clean.out.includes(T.uiProjectNone(1) + "\n") && !clean.out.includes(T.uiProjectHead(0, 1)),
      cut: () => cut.code === 0 && cut.out.includes(T.dsLimit["ui-files"](129, "a/r.css:2", 1)) && !cut.out.includes(T.uiProjectNone(129)),
      pt: () => pt.code === 0 && pt.out.includes(P.uiProjectHead(4, 2)) && pt.out.includes(P.uiProjectRule("transition-all", 1, 1, "src/A.tsx:2", P.uiReportTag)),
    });
    // (each language: the inventory's lines and its bound name what they say; the unjudged clauses of the feature report and
    // finish point to the project's checks — P4)
    const said = ["en", "pt", "pt-BR", "es"].map((l) => {
      const C = MSG(l).cliOutput, D = C.dsLimit, u = D["ui-files"](5000, "a/r.css:3", 7), plain = D["ui-files"](5000);
      const point = [D["focus-sheets"](48, "a/b.css:3", 7), D["focus-chars"](2, "a/b.css:3", 7, "big/c.css", 393216, true), MSG(l).finish.uiUnjudged(7, "a/b.css:3", 48)];
      return [/7/.test(u) && u.includes("a/r.css:3") && u.includes("5000"), plain.includes("5000") && !/undefined|7/.test(plain), point.every((x) => x.includes("design-system")),
        C.uiProjectRule("img-no-alt", 3, 2, "src/A.tsx:3", "").includes("src/A.tsx:3"), !/undefined/.test(C.uiProjectHead(4, 2) + C.uiProjectNone(1))];
    });
    all("1.38 design-system (CLI): every language says the inventory's bound (its count and first place when it left removals unjudged, none of it else) and the rule line, and the unjudged clauses point to the project's UI checks (got " + js(said) + ")", {
      strings: () => said.every((x) => x.every(Boolean)),
    });
  }
};
