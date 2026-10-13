"use strict";
// The duplicate-code detector on the CLI (1.28) — `dupes [feature] [--min-lines N] [--tests]`: the human report, --json, the bounds.

const fs = require("fs");
const path = require("path");
const MSG = require(path.join(__dirname, "..", "..", "mcp", "lib", "i18n.js")).msg; // a message checked against its i18n entry, not a pinned sentence (1.30)

exports.run = ({ ok, all, runIn, tmp, require, __dirname }) => {
  const SR = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = (v) => JSON.stringify(v);
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return {}; } };
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const HELPER = [
    "function formatPrice(cents, currency, locale) {",
    "  const amount = Math.round(Number(cents)) / 100;",
    "  if (!Number.isFinite(amount)) throw new Error(\"not a price: \" + cents);",
    "  const opts = { style: \"currency\", currency: currency || \"EUR\" };",
    "  const text = new Intl.NumberFormat(locale || \"en\", opts).format(amount);",
    "  const sign = amount < 0 ? \"-\" : \"\";",
    "  const parts = text.replace(\"-\", \"\").split(\" \").filter(Boolean);",
    "  const joined = parts.map((p) => p.trim()).join(\" \");",
    "  return sign + joined;",
    "}",
  ];
  const project = (lang) => {
    const p = path.join(tmp, "p128-dupes-" + lang);
    SR.initProject(p, ["core"], lang);
    const f = SR.createFeature(p, "Checkout", ["core"], "x");
    write(p, "src/lib/money.js", "\"use strict\";\n// Money helpers.\n\n" + HELPER.join("\n") + "\n\nmodule.exports = { formatPrice };\n");
    write(p, "src/checkout/total.js", "// the order's total\nconst TAX_RATE = 0.23;\n\n" + HELPER.join("\n") + "\nmodule.exports = { formatPrice };\n");
    write(p, "tests/money.test.js", HELPER.join("\n") + "\n");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Totals\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/checkout/total.js_\n");
    return p;
  };
  const p = project("en");
  const human = runIn(["dupes", "checkout", "--project", p]);
  const asJson = runIn(["dupes", "checkout", "--project", p, "--json"]);
  const whole = runIn(["dupes", "--project", p]);
  const withTests = jsonOf(runIn(["dupes", "checkout", "--tests", "--min-lines", "4", "--project", p, "--json"]));
  all("1.28 dupes (CLI): the feature's report — its head, each run as file:from-to with the places it repeats (⚠ existing, reuse or extend it), exit 0; --json IS spec_scan {duplicates: true, name}'s result; no feature: the project's repeated blocks; --tests / --min-lines reach the engine (got " +
    js([human.code, human.out, whole.out.split("\n")[0], withTests.minLines, withTests.counts]) + ")", {
    head: () => human.code === 0 && /^Duplicates — checkout: 1 place repeats existing code · 0 repeated within the feature  \(windows of 6 code lines; 2 files, \d+ code lines read\)$/m.test(human.out),
    line: () => human.out.includes("  ⚠ src/checkout/total.js:4-14 (10 lines) repeats src/lib/money.js:4-15 — reuse or extend the existing code"),
    json: () => asJson.code === 0 && js(jsonOf(asJson)) === js(SR.duplicationReport(p, { name: "checkout" })),
    project: () => whole.code === 0 && /^Duplicates — the project: 1 repeated block  /.test(whole.out) && /  · src\/checkout\/total\.js:4-14 \(10 lines\) also at src\/lib\/money\.js:4-15/.test(whole.out),
    tests: () => withTests.minLines === 4 && withTests.duplicates[0].also.some((a) => a.file === "tests/money.test.js"),
  });

  // the bounds (4–100, the MCP schema's), an unknown feature, a feature without code, PT
  const low = runIn(["dupes", "checkout", "--min-lines", "3", "--project", p, "--json"]);
  const high = runIn(["dupes", "--min-lines", "101", "--project", p]);
  const nope = runIn(["dupes", "nope", "--project", p]);
  SR.createFeature(p, "Empty", ["core"], "x");
  const empty = runIn(["dupes", "empty", "--project", p]);
  const pt = runIn(["dupes", "checkout", "--project", project("pt")]);
  const help = runIn(["dupes", "--help"]);
  all("1.28 dupes (CLI): --min-lines below 4 or above 100 is refused (exit 1, invalid-arguments — the MCP schema's bounds); an unknown feature exits 1; a feature whose _Implements:_ name no file says so; the feature's language (PT); help shows the command (got " +
    js([low.code, low.out, high.code, high.out, nope.code, empty.out, pt.out.split("\n").slice(0, 2), help.out.split("\n").slice(0, 3)]) + ")", {
    low: () => low.code === 1 && /"code": "invalid-arguments"/.test(low.out) && /--min-lines must be an integer ≥ 4, at most 100/.test(low.out),
    high: () => high.code === 1,
    nope: () => nope.code === 1,
    empty: () => empty.code === 0 && String(empty.out).includes(MSG("en").cliOutput.dupesNoCode),
    pt: () => /^Duplicados — checkout: 1 sítio repete código existente/m.test(pt.out) && /repete src\/lib\/money\.js:4-15 — reutilizar ou estender o código existente/.test(pt.out),
    help: () => /dupes \[feature\] \[--min-lines N\] \[--tests\]/.test(help.out),
  });

  // 1.30 review 8 (ds-prose 14): the head counts in words — "1 file", "1 ficheiro", "1 fichero", never "1 files" or "place(s)"; the
  // byte budget's `partial` line (ds-security 9) in each language
  {
    const heads = {};
    for (const lang of ["en", "pt", "es"]) {
      const q = path.join(tmp, "p130-dupes-one-" + lang);
      SR.initProject(q, ["core"], lang);
      write(q, "src/only.js", "module.exports = function only(a, b) { return a + b; };\n"); // one code line
      heads[lang] = runIn(["dupes", "--project", q]).out.split("\n")[0];
    }
    const partial = Object.fromEntries(["en", "pt", "es"].map((l) => [l, [SR.msg(l).cliOutput.dupesPartial(1, 32), SR.msg(l).cliOutput.dupesPartial(4, 32)]]));
    all("1.30 review 8: dupes' head says 1 file / 1 ficheiro / 1 fichero and 0 repeated blocks (no '(s)'); the byte budget's partial line in EN / PT / ES, singular and plural (got " + js([heads, partial]) + ")", {
      en: () => heads.en === "Duplicates — the project: 0 repeated blocks  (windows of 6 code lines; 1 file, 1 code line read)",
      pt: () => heads.pt === "Duplicados — o projeto: 0 blocos repetidos  (janelas de 6 linhas de código; 1 ficheiro, 1 linha de código lida)",
      es: () => heads.es === "Duplicados — el proyecto: 0 bloques repetidos  (ventanas de 6 líneas de código; 1 fichero, 1 línea de código leída)",
      partialEn: () => partial.en[0] === "  (the byte budget — 32 MB of source — was reached: 1 more source file was not read, a repeat in them is not seen)" &&
        /: 4 more source files were not read,/.test(partial.en[1]),
      partialPt: () => /: mais 1 ficheiro de código ficou por ler,/.test(partial.pt[0]) && /: mais 4 ficheiros de código ficaram por ler,/.test(partial.pt[1]),
      partialEs: () => /: 1 fichero de código más quedó sin leer,/.test(partial.es[0]) && /: 4 ficheros de código más quedaron sin leer,/.test(partial.es[1]),
      noParens: () => !Object.values(heads).some((h) => /\(s\)|\(es\)|\(ões\)/.test(h)),
    });
  }
};
