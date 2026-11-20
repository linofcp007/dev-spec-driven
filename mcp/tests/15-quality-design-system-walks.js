"use strict";
// The design-system code readers' shared walks (1.37): `viewLines` — a view / style file's lines as rawValuesOf reads them (cut,
// comments out, the <style> block state), a generator, so the raw-value reader's early exit stays; styleTokens' block walker
// and its events (a block, a statement, a close) for a reader of a sheet's structure — the tokens unchanged.

const path = require("path");

exports.run = async ({ all, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const T = require(path.join(__dirname, "lib", "engine", "index.js")).loadLazyTier();

  { // 1.37 F0b: the head of rawValuesOf's loop is `viewLines`, ONE walk the raw values and the UI checks read — each line { n, src,
    // l, css }: 1-based, cut at DS_LINE_MAX, its comments out with their state carried over lines, and whether it is a
    // stylesheet's (a .css file, a <style> block — its opening and closing lines too; a self-closing <style … /> holds none)
    const vue = ["<template>", "  <!-- the <style> below -->", "  <div class=\"card\" style=\"color: #123456\">{{ msg }}</div>", "</template>",
      "<script setup>", "const msg = 1;", "</script>", "<style scoped lang=\"scss\">", "/* a comment", "   over two lines: color: #ff0000; */",
      ".card { padding: 13px; }", "</style>", "<p>after</p>"].join("\n");
    const jsx = ["export const A = () => (", "  <style dangerouslySetInnerHTML={{ __html: css }} />", "  <div className=\"p-[13px]\" />", ");"].join("\n");
    const rows = (text, rel) => [...T.viewLines(text, rel)].map((v) => [v.n, v.css ? 1 : 0, v.l.trim()]);
    const vueRows = rows(vue, "src/Card.vue");
    const long = [...T.viewLines(".a { color: red; }\r\n" + "x".repeat(3000) + "\n", "a.css")];
    const lazy = T.viewLines(Array.from({ length: 5 }, () => ".a { margin: 3px; }").join("\n"), "a.css");
    const first = typeof lazy.next === "function" ? lazy.next() : null; // (a list is no generator: the `lazy` condition says so)
    all("1.37 F0b: viewLines yields each line once — n (1-based), src cut at DS_LINE_MAX, l without its comments (a block comment over two lines, an HTML one), css on a stylesheet's line (a .vue <style> block from its opening line to its closing one; a JSX self-closing <style … /> holds none) — lazily (a generator); rawValuesOf over it reads the block's size and the markup's colour, never the comment's (got " +
      js({ vueRows, jsx: rows(jsx, "src/A.tsx"), long: long.map((v) => [v.n, v.src.length, v.css]), raw: T.rawValuesOf(vue, "src/Card.vue") }) + ")", {
      lines: () => js(vueRows.map((r) => r[0])) === js([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
      css: () => js(vueRows.map((r) => r[1])) === js([0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0]),
      comments: () => vueRows[1][2] === "" && vueRows[8][2] === "" && vueRows[9][2] === "" && vueRows[10][2] === ".card { padding: 13px; }",
      selfClosing: () => js(rows(jsx, "src/A.tsx").map((r) => r[1])) === js([0, 0, 0, 0]),
      cut: () => js(long.map((v) => [v.n, v.src.length, v.css])) === js([[1, 18, true], [2, 2000, true], [3, 0, true]]),
      lazy: () => first != null && first.done === false && first.value.n === 1,
      raw: () => js(T.rawValuesOf(vue, "src/Card.vue")) === js([{ line: 3, kind: "color", value: "#123456" }, { line: 11, kind: "size", value: "padding: 13px" }]),
    });
  }

  { // 1.37 F0b: the early exit stays — rawValuesOf stops at DS_RAW_PER_FILE values and viewLines, a generator, reads no further
    // line: on a 20,000-line sheet with a value on every line it costs about one split of the text (ten calls of each, measured
    // at the same moment). Over a materialized list — or a generator that reads every line first — each line had its comments
    // taken out, which a quoted `/*` beside a comment makes costly: 25–80 × the split here (CRIT_1, on plain lines: 1.1 → 6.4 ms)
    const N = 20000;
    const valued = Array.from({ length: N }, (_, i) => ".c" + i + " { content: \"a /* b */ c\"; color: #" + (i % 4096).toString(16).padStart(3, "0") + "aaa; padding: " +
      (i % 50 + 2) + "px; } /* " + "note ".repeat(20) + "*/").join("\n");
    const time = (f) => { const t0 = process.hrtime.bigint(); let r; for (let k = 0; k < 10; k++) r = f(); return [Number(process.hrtime.bigint() - t0) / 1e6, r]; };
    T.rawValuesOf(valued, "x.css"); valued.split(/\r?\n/); // warm
    const s = remeasure(() => { const [a, ra] = time(() => T.rawValuesOf(valued, "x.css")); const [b] = time(() => valued.split(/\r?\n/)); return [a, b, ra.length, ra[ra.length - 1].line]; },
      (x) => x[0] < 10 * x[1]);
    all("1.37 F0b: rawValuesOf keeps its early exit over viewLines — a 20,000-line sheet with a value on every line is read up to its 200th value (line 100), in under 10× a bare split of the text (got [10 reads ms, 10 splits ms, values, last line] " + js(s) + ")", {
      early: () => s[0] < 10 * s[1],
      cap: () => s[2] === 200 && s[3] === 100,
    });
  }

  { // 1.37 F0c: styleTokens' walker — the ONE CSS block walker — hands its structure to an observer: a block opening (its prelude
    // over lines, its parent, pageWide's `global`), a statement read to its end (a `;` outside parentheses or a `}`; its lines
    // joined), a block closing; the tokens are the same with or without one, and nothing a handler does reaches them
    const sheet = ["// a reset { a brace in a comment", ":root { --ring: #2563eb; }", "", "*:focus { outline: 0 }", "a:focus,", "button:focus {", "  outline: none;", "}",
      ".#{$p}-btn:focus-visible { outline: 2px solid var(--ring);; }", ".card {", "  --gap: 4px;", "  transition:", "    opacity .2s,", "    transform .3s cubic-bezier(.2, 0, 0, 1);",
      "  content: \"}\";", "  .x { color: red }", "}", "@media (prefers-reduced-motion: reduce) {", "  .card { transition: none; }", "}", ".m { .button-variant(@color; @bg); }", "}"].join("\n");
    const seen = { block: [], statement: [], close: [] };
    const record = { block: (e) => seen.block.push(e), statement: (e) => seen.statement.push(e), close: (e) => seen.close.push(e) };
    const safe = (f) => { try { return f(); } catch (e) { return "threw: " + e.message; } };
    const plainTokens = safe(() => T.styleTokens(sheet, "src/styles/reset.scss"));
    const observed = safe(() => T.styleTokens(sheet, "src/styles/reset.scss", record));
    // a handler that writes into what it is given (a block made page-wide, a statement's block moved) changes no token
    const steered = safe(() => T.styleTokens(sheet, "src/styles/reset.scss", { block: (e) => { e.global = true; e.id = 1; }, statement: (e) => { e.block = 1; } }));
    const onlyClose = safe(() => T.styleTokens(sheet, "src/styles/reset.scss", { close: () => {} }));
    const B = seen.block.map((e) => [e.id, e.parent, e.prelude, e.line, e.global]);
    const St = seen.statement.map((e) => [e.text.replace(/\s+/g, " "), e.block, e.line]);
    const C = seen.close.map((e) => [e.id, e.line]);
    all("1.37 F0c: styleTokens(text, rel, on) — block events (id, parent, the prelude over lines with `#{…}` as written, line, global), statement events (a `;` outside parentheses or a `}` ends one; its lines joined; a Less mixin's `;` ends none; `;;` none; a quoted `}` none; a prelude never one) and close events (a stray `}` none), lines counted over blank and comment lines; the tokens identical with or without an observer, whatever it does (got " +
      js({ B, St, C, plainTokens }) + ")", {
      blocks: () => js(B) === js([[1, 0, ":root", 2, true], [2, 0, "*:focus", 4, false], [3, 0, "a:focus, button:focus", 6, false], [4, 0, ".#{$p}-btn:focus-visible", 9, false],
        [5, 0, ".card", 10, false], [6, 5, ".x", 16, false], [7, 0, "@media (prefers-reduced-motion: reduce)", 18, false], [8, 7, ".card", 19, false], [9, 0, ".m", 21, false]]),
      interp: () => seen.block[3].prelude === ".#{$p}-btn:focus-visible",
      parent: () => js(B.map((b) => b[1])) === js([0, 0, 0, 0, 0, 5, 0, 7, 0]),
      lines: () => js(B.map((b) => b[3])) === js([2, 4, 6, 9, 10, 16, 18, 19, 21]) && js(St.map((x) => x[2])) === js([2, 4, 7, 9, 11, 14, 15, 16, 19, 21]),
      global: () => js(B.map((b) => b[4])) === js([true, false, false, false, false, false, false, false, false]),
      statements: () => js(St) === js([["--ring: #2563eb", 1, 2], ["outline: 0", 2, 4], ["outline: none", 3, 7], ["outline: 2px solid var(--ring)", 4, 9], ["--gap: 4px", 5, 11],
        ["transition: opacity .2s, transform .3s cubic-bezier(.2, 0, 0, 1)", 5, 14], ["content: \"}\"", 5, 15], ["color: red", 6, 16], ["transition: none", 8, 19], ["@bg)", 9, 21]]),
      multiLine: () => /^transition: opacity \.2s, transform \.3s cubic-bezier\(\.2, 0, 0, 1\)$/.test((St.find((x) => x[2] === 14) || [""])[0]),
      blockOf: () => (St.find((x) => x[0] === "color: red") || [])[1] === 6 && (St.find((x) => x[0] === "transition: none") || [])[1] === 8,
      lessParams: () => St.filter((x) => x[1] === 9).length === 1 && !St.some((x) => /@color/.test(x[0])),
      blank: () => St.every((x) => x[0].trim() !== "") && St.filter((x) => x[1] === 4).length === 1,
      noPrelude: () => St.length === 10 && !St.some((x) => seen.block.some((b) => b.prelude === x[0])),
      close: () => js(C) === js([[1, 2], [2, 4], [3, 8], [4, 9], [6, 16], [5, 17], [8, 19], [7, 20], [9, 21]]),
      same: () => js(plainTokens) === js([{ name: "--ring", value: "#2563eb", global: true, block: 1 }, { name: "--gap", value: "4px", global: false, block: 5 }]) &&
        js(observed) === js(plainTokens) && js(onlyClose) === js(plainTokens),
      steer: () => Array.isArray(steered) && plainTokens.length === 2 && js(steered) === js(plainTokens),
    });
  }
};
