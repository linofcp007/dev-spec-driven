"use strict";
// The design-system code readers' shared walks (1.37): `viewLines` — a view / style file's lines as rawValuesOf reads them (cut,
// comments out, the <style> block state), a generator, so the raw-value reader's early exit stays.

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

};
