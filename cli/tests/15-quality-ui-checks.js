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
};
