"use strict";
// The design-system registry — 1.35.4: the markup files settle too. An .mdx, .vue, .svelte or .astro file renders the
// components its SCRIPT imports (MDX's ESM, a Vue / Svelte <script> block, Astro's front matter) in its MARKUP — never in
// fenced code, a code span, a comment, front matter, a <style>, a Vue block but its template, or an Astro <script>; a Vue
// kebab-case tag is its component; a namespace's part alike in .tsx and .svelte; read after every script, within the same
// bound; and the markup reader gives up in linear time (markupComments' openers looked for once past a place).

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, remeasure }) => {
  const js = (v) => JSON.stringify(v);
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const BT = String.fromCharCode(96), FENCE = BT + BT + BT, BOM = String.fromCharCode(0xfeff);
  const L = (lines) => lines.join("\n") + "\n";
  const deps = (list) => js({ dependencies: Object.fromEntries(list.map((d) => [d, "1.0.0"])) });
  const project = (tag, files) => {
    const p = path.join(tmp, "proj-dsmk-" + tag);
    for (const [rel, text] of Object.entries(files || {})) write(p, rel, text);
    S.initProject(p, ["ui"], "en");
    return p;
  };
  const UI = "src/components/ui/";
  // every name the report finds (each project below holds fewer than its 50 rows)
  const found = (r) => r.missing.map((m) => m.name).sort();

  // --- what each format's script imports and its markup renders settles a component file's names -------------------------------------
  {
    const p = project("settle", { "package.json": deps(["react"]) });
    // candidates (`motion(Box)`: a call that shows nothing — a component only when the project renders it), weak helpers
    // (dropped when only called), a weak context of a factory (dropped when provided)
    const MOTION = ["FadeIn", "Indented", "CardHeader", "AfterFence", "Fenced", "Spanned", "Commented", "Spaced", "Multi", "Mdx1", "Lazy", "Fake", "Rule", "OnlyFenced",
      "Icon2", "Esm", "CapsMdx", "SlideIn", "KebabOne", "OneLine", "DocsOnly", "Button", "Wave", "AfterTopComment", "AfterTplComment", "Styled", "Stray", "Limit", "KebabCaps",
      "Pop", "KebabTwo", "AfterScriptComment", "AfterStyledBox", "AfterStyle", "StoryShown", "Glow", "ClientOnly", "Limit2"];
    write(p, UI + "kit.tsx", L(["import { motion } from \"framer-motion\";", "import { Box } from \"./box\";"].concat(MOTION.map((n) => "export const " + n + " = motion(Box);"),
      ["export function Shimmer() { return null; }", "export function FormatPrice(value) { return value.toFixed(2); }", "export function StoryHelp(value) { return value; }",
        "export const MdxStore = makeStore(() => <i />);"])));
    // .mdx: front matter (no script, no markup), its ESM (a two-line import, a meta's JSX), prose with an apostrophe before a
    // tag, an import below a paragraph line (no ESM), a fence (a blank line inside it, an import in it, a tag in it — both
    // names imported for real or not), an import right after the fence, a code span, `{/* */}` three ways, `<!-- -->`, an
    // indented tag (MDX has no indented code), a tag that closes itself two lines below after a word
    write(p, "docs/kit.mdx", L([
      "---", "description: Use the <Fake /> component", "---",
      "import { FadeIn, Indented, Spanned, Commented, Spaced, Multi, Mdx1, Fake, Icon2, Fenced, Esm } from \"../src/components/ui/kit\";",
      "import { Card,", "  CardHeader } from \"../src/components/ui/kit\";", "export const meta = { icon: <Icon2 /> };", "",
      "Don't wrap it in <FadeIn>a</FadeIn> twice.", "Some text", "import { Lazy } from \"../src/components/ui/kit\";", "", "<Lazy />", "", "Example:",
      FENCE + "tsx", "", "import { OnlyFenced } from \"../src/components/ui/kit\";", "<Fenced />", FENCE,
      "import { AfterFence } from \"../src/components/ui/kit\";", "", "<AfterFence /><OnlyFenced />", "",
      "Use " + BT + "<Spanned />" + BT + " here.", "", "{/* <Commented /> */}", "{ /* <Spaced /> */ }", "{/*", "<Multi />", "*/}", "<!-- <Mdx1 /> -->", "",
      "<Card>", "    <CardHeader />", "</Card>", "", "    <Indented />", "", "exports <Esm", "  a=\"1\"", "/>"]));
    // (a `---` thematic break never closed is no front matter; an upper-case extension; a provider's tag is a context's)
    write(p, "docs/rule.mdx", L(["---", "", "import { Rule } from \"../src/components/ui/kit\";", "", "<Rule />"]));
    write(p, "docs/Caps.MDX", L(["import { CapsMdx } from \"../src/components/ui/kit\";", "", "<CapsMdx />"]));
    write(p, "docs/store.mdx", L(["import { MdxStore } from \"../src/components/ui/kit\";", "", "<MdxStore.Provider value={1}><b /></MdxStore.Provider>"]));
    // .vue: a one-line `<script setup>`, a script that calls a helper and compares (`count <Limit`: a script keeps its
    // guards), a top-level comment naming `<script>`, the template (an apostrophe in an attribute, a nested `<template v-if>`,
    // kebab-case, a native `<button>`, tags after a word closing on a later line, a comment holding `</template>`, a
    // kebab element named like `template-…`), then a comment, a custom block, a style and a stray tag at the top level
    write(p, "src/pages/Home.vue", L([
      "<script setup lang=\"ts\">import { OneLine } from \"@/components/ui/kit\";</script>",
      "<script lang=\"ts\">",
      "import { SlideIn, KebabOne, DocsOnly, Button, Wave, AfterTopComment, AfterTplComment, Styled, Stray, FormatPrice, Limit } from \"@/components/ui/kit\";",
      "export default { name: \"Home\" };", "const price = FormatPrice(3);", "const over = count <Limit ? 1 : 2;", "</script>",
      "<!-- a <script> was here -->",
      "<template>", "  <div title=\"Don't\">", "    <template v-if=\"ok\"><span /></template>", "    <SlideIn />", "    <kebab-one size=\"sm\" />", "    <OneLine />",
      "    <button>native</button>", "    <p>Use <Wave", "      :speed=\"2\"", "    /></p>", "    <p>See <AfterTopComment", "    /></p>", "    <!-- </template> -->", "    <AfterTplComment />",
      "    <template-picker />", "  </div>", "</template>", "<!-- the docs -->", "<docs>", "<DocsOnly />", "</docs>", "<style scoped>", ".a::after { content: \"<Styled />\"; }", "</style>", "<Stray />"]));
    write(p, "src/pages/Caps.Vue", L(["<script setup>import { KebabCaps } from \"@/components/ui/kit\";</script>", "<template>", "  <kebab-caps />", "</template>"]));
    // .svelte: two script blocks (tab-indented, prettier-plugin-svelte's way), a comment naming `<script>`, a custom element
    // in kebab-case, a tag after a word closing below, an element named like `style-…`, a tag after a <style> block
    write(p, "src/routes/+page.svelte", L([
      "<script context=\"module\">", "\texport const prerender = true;", "</script>", "<script lang=\"ts\">",
      "\timport { Pop, KebabTwo, AfterScriptComment, Styled, AfterStyledBox, Shimmer, AfterStyle } from \"../components/ui/kit\";", "</script>", "",
      "<!-- the <script> tag -->", "<p>Press <Pop /> to start</p>", "<kebab-two></kebab-two>", "<p>Then <AfterScriptComment", "  size=\"sm\"", "/></p>",
      "<style-guide />", "<AfterStyledBox />", "<Shimmer />", "<style>", "\t.x::after { content: \"<Styled />\"; }", "</style>", "<AfterStyle />"]));
    // (a story's call is no helper's sign; its render counts)
    write(p, UI + "kit.stories.svelte", L(["<script>", "\timport { StoryHelp, StoryShown } from \"./kit\";", "\tconst v = StoryHelp(1);", "</script>", "<StoryShown />"]));
    // .astro behind a BOM: front matter (a comparison there is code), a tag in an expression, a client <script>'s import
    write(p, "src/pages/index.astro", BOM + L(["---", "import { Glow, Limit2 } from \"@/components/ui/kit\";", "const items = [1, 2];", "const under = count <Limit2 ? 1 : 2;", "---",
      "<html><body>", "  {items.map((i) => <Glow>{i}</Glow>)}", "  <ClientOnly />", "  <script>", "    import { ClientOnly } from \"../components/ui/kit\";", "  </script>", "</body></html>"]));
    // (a helper the project calls, never rendered: dropped — a weak one rendered AND called stays)
    write(p, "src/lib/util.ts", L(["import { Shimmer } from \"../components/ui/kit\";", "export const s = Shimmer();"]));
    const report = S.designSystemReport(p);
    const got = found(report), has = (n) => got.includes(n);
    const MDX = ["Esm", "FadeIn", "Indented", "CardHeader", "AfterFence", "Rule", "Icon2", "CapsMdx"];
    const VUE = ["SlideIn", "KebabOne", "OneLine", "Wave", "AfterTopComment", "AfterTplComment", "KebabCaps"];
    const SVELTE = ["Pop", "AfterScriptComment", "AfterStyledBox", "Shimmer", "AfterStyle", "StoryShown", "StoryHelp"];
    const ASTRO = ["Glow"];
    const NOT_MDX = ["Fenced", "OnlyFenced", "Spanned", "Commented", "Spaced", "Multi", "Mdx1", "Lazy", "Fake", "MdxStore"];
    const NOT_VUE = ["DocsOnly", "Button", "Styled", "Stray", "FormatPrice", "Limit"];
    const NOT_SVELTE = ["KebabTwo"];
    const NOT_ASTRO = ["ClientOnly", "Limit2"];
    all("1.35.4: the markup files settle — an .mdx's ESM (below its front matter, an import over two lines, a meta's `<Icon2 />`, an import right after a fence) and its markup (a tag after a word — `Don't wrap it in <FadeIn>` —, an indented tag, one that closes itself two lines below), an upper-case `.MDX`; a .vue's `<script setup>` on one line and `<script lang=\"ts\">`, its template past a nested `<template v-if>` and a comment holding `</template>`, `<kebab-one>` as KebabOne (`.Vue` too); a .svelte's tab-indented imports, tags after a comment that names `<script>`, after an element named `<style-guide>` and after a <style> block; a story's render; an .astro's front matter behind a BOM and a tag in an expression — and never: front matter, a paragraph's next line, fenced code (its import or its tag), a code span, `{/* */}` (spaced, over lines), `<!-- -->`, a provider's tag (a context's), a Vue custom block, <style> or top-level tag, a native `<button>`, a comparison in a script or in Astro's front matter, a Svelte custom element in kebab-case, an Astro client <script>'s import; a helper a Vue script calls is none, one a story calls stays (got " + js({ got, limits: report.limits }) + ")", {
      mdx: () => MDX.every(has) && !NOT_MDX.some(has),
      vue: () => VUE.every(has) && !NOT_VUE.some(has),
      svelte: () => SVELTE.every(has) && !NOT_SVELTE.some(has),
      astro: () => ASTRO.every(has) && !NOT_ASTRO.some(has),
      exact: () => js(got) === js(["Kit"].concat(MDX, VUE, SVELTE, ASTRO).sort()),
      limits: () => report.limits.length === 0,
    });
  }

  // --- a namespace's part through a barrel: listed alike from a .tsx and a .svelte page (1.35.3's barrel rule, knowingly) -------------
  {
    const tabs = (ext, page) => {
      const p = project("ns-" + ext, { "package.json": deps(["react"]) });
      write(p, "src/components/doc-tabs/index.ts", L(["export { default as Root } from \"./doc-tabs." + ext + "\";", "export { default as List } from \"./doc-tabs-list." + ext + "\";"]));
      write(p, "src/components/doc-tabs/doc-tabs." + ext, ext === "svelte" ? L(["<div><slot /></div>"]) : L(["export default function DocTabs() { return <div />; }"]));
      write(p, "src/components/doc-tabs/doc-tabs-list." + ext, ext === "svelte" ? L(["<ul><slot /></ul>"]) : L(["export default function DocTabsList() { return <ul />; }"]));
      write(p, page[0], L(page[1]));
      return found(S.designSystemReport(p));
    };
    const svelte = tabs("svelte", ["src/routes/+page.svelte", ["<script>import * as DocTabs from \"../components/doc-tabs/index.js\";</script>", "<DocTabs.Root><DocTabs.List /></DocTabs.Root>"]]);
    const tsx = tabs("tsx", ["src/routes/page.tsx", ["import * as DocTabs from \"../components/doc-tabs/index.js\";", "export const P = () => <DocTabs.Root><DocTabs.List /></DocTabs.Root>;"]]);
    all("1.35.4: a markup file's dotted tag through its script's namespace import (`<DocTabs.List>`, `import * as DocTabs from \"…/index.js\"`) settles a barrel's re-export under a name of its own — the rows a .tsx page gives the same tree (1.35.3's barrel rule: `export { default as List }` is listed, knowingly) (got " + js({ svelte, tsx }) + ")", {
      svelte: () => js(svelte) === js(["DocTabs", "DocTabsList", "List", "Root"]),
      alike: () => js(svelte) === js(tsx),
    });
  }

  // --- the bound: the markup files come after every script, in the same count, the shorter path first ---------------------------------
  {
    // 100 pages of scripts and 28 of prose, each past one file's read (256K): the 128 read are the 32 MB; the .mdx that
    // renders the candidate sorts after the prose (a longer path) though the walk meets it first — it is the 129th
    const kit = L(["export const MotionBox = motion(Box);", "export function Kit() { return <div />; }"]);
    const render = L(["import { MotionBox } from \"../../src/components/ui/kit\";", "", "<MotionBox />"]);
    const p = project("bound", { "package.json": deps(["react"]) });
    write(p, UI + "kit.tsx", kit);
    const page = "const x = compute(1, \"value\");\n".repeat(8500), prose = "a plain line of prose\n".repeat(12000);
    for (let i = 0; i < 100; i++) write(p, "src/app/page" + String(i).padStart(3, "0") + ".tsx", page);
    for (let i = 0; i < 28; i++) write(p, "p/p" + String(i).padStart(2, "0") + ".mdx", prose);
    write(p, "a/zzzzzzzz/last.mdx", render);
    // (the same file alone: it settles the candidate)
    const control = project("bound-control", { "package.json": deps(["react"]) });
    write(control, UI + "kit.tsx", kit);
    write(control, "a/zzzzzzzz/last.mdx", render);
    const rb = S.designSystemReport(p), rc = S.designSystemReport(control);
    all("1.35.4: the markup files are read after every script file, within the same 5,000 files and 32 MB — one count — and the shorter path first: an .mdx past the bound is not read, WITHOUT A WORD (100 script pages and 28 of prose fill it; alone, the same file settles its candidate) (got " + js({ bound: [found(rb), rb.limits], control: [found(rc), rc.limits] }) + ")", {
      silent: () => js(found(rb)) === js(["Kit"]) && rb.limits.length === 0,
      control: () => js(found(rc)) === js(["Kit", "MotionBox"]) && rc.limits.length === 0,
    });
  }

  // --- what it costs: the markup reader gives up in linear time ----------------------------------------------------------------------
  {
    // two files of each hostile shape, each in a project of its own, against a soft one: a ratio. markupComments looks for
    // each opener once past a place and keeps "none left" — four conditions, each output-equivalent: `{/**/}` runs with no
    // `<!--` (h !== -1), `<!---->` runs with no `{/*` (x !== -1), each with the other opener at its line's end (h < i, x <
    // i). Each taken out, its shape took 1.3 to 18 s, against ~20 to 100 ms; their soft side is the two openers in turn,
    // `<!---->{/**/}` — the same loop's work, each opener's next a few characters on: none of the four saves it anything. The
    // rest are each format's own openers, a quarter as long (an eighth: fence lines, each ×3 its soft line's cost), against
    // the same files with `<`, `{` and the backtick spelled out of reach (`x`): an unclosed `<!--` in a Vue template,
    // `<template ` and kebab runs, a Svelte file of `<script ></script><style ></style>`, an Astro file of `{/*`, backticks
    const N = 256 * 1024 - 1024; // (a body and its import within one file's read)
    const rep = (unit, chars) => unit.repeat(Math.ceil(chars / unit.length)).slice(0, chars);
    const IMP = "import { MotionBox } from \"@/components/ui/kit\";";
    const head = { mdx: IMP + "\n\n", vue: "<script setup>" + IMP + "</script>\n<template>\n", svelte: "<script>" + IMP + "</script>\n", astro: "---\n" + IMP + "\n---\n" };
    const outOfReach = (s) => s.split("<").join("x").split("{").join("x").split(BT).join("x");
    const side = (name, ext, body) => {
      const d = project("cost-" + name, { "package.json": deps(["react"]) });
      write(d, UI + "kit.tsx", L(["export const MotionBox = motion(Box);"]));
      for (let k = 0; k < 2; k++) write(d, "src/pages/h" + k + "." + ext, head[ext] + body + "\n");
      return d;
    };
    const both = side("comments-soft", "mdx", rep("<!---->{/**/}", N));
    const SHAPES = {
      exprRuns: ["mdx", rep("{/**/}", N), both],
      htmlRuns: ["mdx", rep("<!---->", N), both],
      exprThenHtml: ["mdx", rep("{/**/}", N - 8) + "<!-- -->", both],
      htmlThenExpr: ["mdx", rep("<!---->", N - 8) + "{/* */}", both],
      vueOpen: ["vue", rep("<!--", N / 4)],
      vueTemplates: ["vue", rep("<template ", N / 4)],
      vueKebab: ["vue", rep("<a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p", N / 4)],
      svelteBlocks: ["svelte", rep("<script ></script><style ></style>", N / 4)],
      astroExpr: ["astro", rep("{/*", N / 4)],
      ticks: ["mdx", rep(BT + BT + "x" + BT, N / 4)],
      fences: ["mdx", rep(FENCE + "\n", N / 8)],
    };
    // (each side the least of three runs, the two sides in turn: eleven pairs on a shared machine — a load spike on one
    // run is no sample)
    const timed = (p) => { const t0 = Date.now(); S.designSystemReport(p); return Date.now() - t0; };
    const sample = (hard, soft) => { const s = [Infinity, Infinity]; for (let r = 0; r < 3; r++) { s[0] = Math.min(s[0], timed(hard)); s[1] = Math.min(s[1], timed(soft)); } return s; };
    const ms = {};
    for (const [name, [ext, body, soft]] of Object.entries(SHAPES)) {
      const hard = side(name + "-hard", ext, body);
      const easy = soft || side(name + "-soft", ext, outOfReach(body));
      ms[name] = remeasure(() => sample(hard, easy), (s) => s[0] < 2.5 * s[1] + 150);
    }
    all("1.35.4: the markup reader gives up in linear time — `{/**/}` and `<!---->` runs on one line, each with the other opener at its end (a comment's opener looked for once past a place, none left kept: no slower than the two in turn), an unclosed `<!--` in a Vue template, `<template ` and kebab runs, `<script ></script><style ></style>` in a .svelte, `{/*` in an .astro, backticks and fence lines in an .mdx (no slower than the same files spelled out of reach) (got " + js(ms) + ")",
      Object.fromEntries(Object.keys(SHAPES).map((k) => [k, () => ms[k][0] < 2.5 * ms[k][1] + 150])));
  }
};
