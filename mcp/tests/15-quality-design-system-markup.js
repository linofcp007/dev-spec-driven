"use strict";
// The design-system registry — 1.35.4: the markup files settle too. An .mdx, .vue, .svelte or .astro file renders the
// components its SCRIPT imports (MDX's ESM, a Vue / Svelte <script> block, Astro's front matter) in its MARKUP — never in
// fenced code, a code span, a comment, front matter, a <style>, a Vue block but its template, or an Astro <script>; a Vue
// kebab-case tag is its component; a namespace's part alike in .tsx and .svelte; read after every script, within the same
// bound; and the markup reader gives up in linear time (markupComments' openers looked for once past a place). Review 1 of
// 1.35.4: a tag that closes itself opens nothing (`<template #trailing />`, `<script src="…" />`); a barrel's candidate it
// also exports under another name is none of its own (shadcn-svelte's `Root as Card` through a synced `$lib`); an opening
// tag's end is looked for once a line where it is known. Review 2: a `/>` in an attribute's quotes ends no tag
// (`text.split('<br/>')`); of one binding's names rendered, the one given with `as`; a binding's names, one group. Review 3:
// an opening tag's end is its first `>` outside quotes and `{…}`, the quotes followed from the tag itself (`Don't` before it,
// `v-if="n > 0"`, `set:html={n > 0 ? a : b}`); a candidate given under more than one name is no row of its own when the
// binding comes from a component file of the scan, whoever won the name (a second install, a `$lib` import, an app's own
// `Table.svelte`) — another component of the name (a sibling file, a folder below, elsewhere) is none of it (shadcn-svelte's
// `Pane as ResizablePane` beside another Pane); the `as` preference is one binding's: across files, the results order.
// Review 4: a component file that lost its own name to another is no row — its binding's `as` names stand for it where
// their name is free (`popover/root.tsx` beside `dialog/root.tsx`); a component folder's index is a component file.

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
  // a Svelte 5 part as shadcn-svelte writes one: its props spread on one element
  const part = (cls) => L(["<script lang=\"ts\">", "  let { children, ...rest } = $props();", "</script>", "", "<div class=\"" + cls + "\" {...rest}>{@render children?.()}</div>"]);

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

  // --- review 1 of 1.35.4: a tag that closes itself opens nothing ---------------------------------------------------------------------
  {
    // a .vue with its template first (element-plus and vuetify write most so) holding an empty slot closed on itself — what
    // eslint-plugin-vue's html-self-closing writes of `<template #trailing></template>` —, then its `<script setup>`, then a
    // <style> naming a tag: the script is read (its candidate settles), the style is not (its tag renders nothing). The
    // script-first twin: the template closes, the <style> after it stays unread. And a self-closed `<script src="…" />` at the
    // top level, before the file's real <script> on one line: it waits for no `</script>`
    const p = project("selfclose", { "package.json": deps(["vue"]) });
    write(p, UI + "kit.tsx", L(["import { motion } from \"framer-motion\";", "import { Box } from \"./box\";"].concat(
      ["SlotFirst", "StyledFirst", "SlotSecond", "StyledSecond", "AfterSrc"].map((n) => "export const " + n + " = motion(Box);"))));
    write(p, "src/pages/Home.vue", L(["<template>", "  <UCard>", "    <template #trailing />", "    <SlotFirst />", "  </UCard>", "</template>", "",
      "<script setup lang=\"ts\">", "import { SlotFirst, StyledFirst } from \"@/components/ui/kit\";", "</script>", "",
      "<style scoped>", ".a::after { content: \"<StyledFirst />\"; }", "</style>"]));
    write(p, "src/pages/Second.vue", L(["<script setup lang=\"ts\">", "import { SlotSecond, StyledSecond } from \"@/components/ui/kit\";", "</script>", "",
      "<template>", "  <UCard>", "    <template #trailing />", "    <SlotSecond />", "  </UCard>", "</template>", "",
      "<style scoped>", ".a::after { content: \"<StyledSecond />\"; }", "</style>"]));
    write(p, "src/pages/Src.vue", L(["<script src=\"./setup.js\" />", "<script setup>import { AfterSrc } from \"@/components/ui/kit\";</script>", "<template>", "  <AfterSrc />", "</template>"]));
    const report = S.designSystemReport(p);
    const got = found(report), has = (n) => got.includes(n);
    all("1.35.4 review 1: a tag that closes itself opens nothing — a template-first .vue's `<template #trailing />` leaves its template's depth as it was: the `<script setup>` after it is read (SlotFirst settles), the <style> after that is not (StyledFirst renders nothing); the script-first twin's <style> stays unread too (no StyledSecond); a top-level `<script src=\"./setup.js\" />` waits for no `</script>`: the one-line <script> after it is read (AfterSrc settles) (got " + js({ got, limits: report.limits }) + ")", {
      templateFirst: () => has("SlotFirst") && !has("StyledFirst"),
      scriptFirst: () => has("SlotSecond") && !has("StyledSecond"),
      srcScript: () => has("AfterSrc"),
      exact: () => js(got) === js(["AfterSrc", "Kit", "SlotFirst", "SlotSecond"]),
      limits: () => report.limits.length === 0,
    });
  }

  // --- review 2 of 1.35.4: a `/>` inside an attribute's quotes ends no tag (review 3: the quotes followed from the tag's name) ---
  {
    // a template-first .vue whose nested <template>'s attribute holds a `/>` — `text.split('<br/>')`, `split(/<br\/>/)`: a
    // quoted `>` with a `/` before it, the first after the tag's name — closes nothing: the nested template opens, its `</template>`
    // closes it (not the root), and the tag rendered after it in the root template counts (BrShown, RxShown settle, as
    // CtlShown does beside `'<br>'`; the <style> after the script stays unread: StyleOnly renders nothing). A tag whose
    // attributes hold paired quotes of both kinds still closes itself: `<template v-if="mode === 'a'" #trailing />` in a
    // template-first .vue (its `<script setup>` read: QuotedShown settles), `<script src='./setup.js' lang="ts" />` at the
    // top level (the one-line <script> after it read: SrcShown settles)
    const p = project("selfclose-quotes", { "package.json": deps(["vue"]) });
    const SHOWN = ["BrShown", "RxShown", "SqShown", "CtlShown", "QuotedShown", "SrcShown", "LoneShown", "AstroLone"];
    write(p, UI + "kit.tsx", L(["import { motion } from \"framer-motion\";", "import { Box } from \"./box\";"].concat(SHOWN.concat(["StyleOnly"]).map((n) => "export const " + n + " = motion(Box);"))));
    const nested = (name, attrs) => L(["<template>", "  <UCard>", "    <template " + attrs + ">", "      <p>{{ line }}</p>", "    </template>", "    <" + name + " />", "  </UCard>", "</template>", "",
      "<script setup lang=\"ts\">", "import { " + name + ", StyleOnly } from \"@/components/ui/kit\";", "</script>", "", "<style scoped>", ".a::after { content: \"<StyleOnly />\"; }", "</style>"]);
    write(p, "src/pages/Br.vue", nested("BrShown", "v-for=\"(line, i) in text.split('<br/>')\" :key=\"i\""));
    write(p, "src/pages/Rx.vue", nested("RxShown", "v-for=\"(line, i) in text.split(/<br\\/>/)\" :key=\"i\""));
    // (the value in single quotes, after a double-quoted one: the `/>` inside the single quotes, the double ones closed before)
    write(p, "src/pages/Sq.vue", nested("SqShown", ":key=\"i\" v-for='(line, i) in text.split(/<br\\/>/)'"));
    write(p, "src/pages/Ctl.vue", nested("CtlShown", "v-for=\"(line, i) in text.split('<br>')\" :key=\"i\""));
    write(p, "src/pages/Quoted.vue", L(["<template>", "  <UCard>", "    <template v-if=\"mode === 'a'\" #trailing />", "    <QuotedShown />", "  </UCard>", "</template>", "",
      "<script setup lang=\"ts\">", "import { QuotedShown } from \"@/components/ui/kit\";", "</script>"]));
    write(p, "src/pages/Src.vue", L(["<script src='./setup.js' lang=\"ts\" />", "<script setup>import { SrcShown } from \"@/components/ui/kit\";</script>", "<template>", "  <SrcShown />", "</template>"]));
    // (a quote is closed by its own mark alone: one of the other kind inside — `it's` in a double-quoted value, `"it's"` in
    // an Astro expression's template — opens nothing; counted apart, each mark's count was odd: held open, review 2)
    write(p, "src/pages/Lone.vue", L(["<template>", "  <UCard>", "    <template v-if=\"note !== `it's`\" #trailing />", "    <LoneShown />", "  </UCard>", "</template>", "",
      "<script setup lang=\"ts\">", "import { LoneShown } from \"@/components/ui/kit\";", "</script>"]));
    write(p, "src/pages/lone.astro", L(["---", "import { AstroLone } from \"@/components/ui/kit\";", "---", "<script is:inline set:html={`console.log(\"it's\")`} />", "<AstroLone />"]));
    const report = S.designSystemReport(p);
    const got = found(report), has = (n) => got.includes(n);
    all("1.35.4 review 2: a `/>` inside an attribute's quotes ends no tag — the tag's end is its first `>` outside the quotes followed from the tag's name — a template-first .vue's nested `<template v-for=\"(line, i) in text.split('<br/>')\" :key=\"i\">` (and `split(/<br\\/>/)`, double- or single-quoted) opens, its `</template>` closes it and not the root: the tag rendered after it in the root template settles (BrShown, RxShown, SqShown — CtlShown beside `'<br>'`), the <style> after the script stays unread (no StyleOnly) —; a tag whose quotes are paired still closes itself: `<template v-if=\"mode === 'a'\" #trailing />` (QuotedShown, its script read) and a top-level `<script src='./setup.js' lang=\"ts\" />` (SrcShown) (got " + js({ got, limits: report.limits }) + ")", {
      splitBr: () => has("BrShown"),
      regexBr: () => has("RxShown"),
      singleQuoted: () => has("SqShown"),
      control: () => has("CtlShown"),
      styleUnread: () => !has("StyleOnly"),
      quotedSelfClose: () => has("QuotedShown"),
      quotedSrc: () => has("SrcShown"),
      loneQuote: () => has("LoneShown") && has("AstroLone"),
      exact: () => js(got) === js(["AstroLone", "BrShown", "CtlShown", "Kit", "LoneShown", "QuotedShown", "RxShown", "SqShown", "SrcShown"]),
      limits: () => report.limits.length === 0,
    });
  }

  // --- review 3 of 1.35.4: an opening tag's end is its first `>` outside quotes and `{…}`, the quotes followed from the tag --
  {
    // (review 2 followed the quotes from the line's start — an apostrophe in the text before a self-closing tag, `Don't`, a
    // comment's `it's`, a quote a line above opened, kept it open: the template held to the file's end, its `<script setup>`
    // read as markup — and took the first `>` after the tag's name, quoted or not: `v-if="items.length > 0"`, an Astro
    // `set:html={n > 0 ? a : b}` opened their tag. Each page renders its candidate after the line, its script importing it:
    // listed only when the tag closes; the <style> after the script names a tag that stays unread. A .vue tag's text is
    // passed once read: an attribute's `'</template>'` closes nothing, in a tag that closes itself or one that opens)
    const p = project("tag-end", { "package.json": deps(["vue", "astro"]) });
    const VUE = {
      AposText: "<span>Don't</span> <template #trailing />",
      CommentApos: "<!-- it's a slot --><template #trailing />",
      MultiAttr: "<div :class=\"{\n      on: active }\"><template #trailing /></div>",
      GtQuoted: "<template v-if=\"items.length > 0\" #trailing />",
      QuotedSlash: "<template v-if=\"text.includes('<br/>')\" #trailing />",
      ClosingInAttr: "<template v-if=\"tag !== '</template>'\" #trailing />",
      ClosingInAttrOpen: "<template v-if=\"tag !== '</template>'\">\n      <p>{{ tag }}</p>\n    </template>",
    };
    const ASTRO = { AstroExpr: "<script is:inline set:html={n > 0 ? a : b} />", AstroApos: "<head><title>Bob's blog</title><script is:inline src=\"/x.js\" /></head>" };
    const SHOWN = Object.keys(VUE).concat(Object.keys(ASTRO)).map((n) => n + "Shown");
    write(p, UI + "kit.tsx", L(["import { motion } from \"framer-motion\";", "import { Box } from \"./box\";"].concat(SHOWN.concat(["TagStyle"]).map((n) => "export const " + n + " = motion(Box);"))));
    for (const [shape, line] of Object.entries(VUE)) {
      write(p, "src/pages/" + shape + ".vue", L(["<template>", "  <UCard>", "    " + line, "    <" + shape + "Shown />", "  </UCard>", "</template>", "",
        "<script setup lang=\"ts\">", "import { " + shape + "Shown, TagStyle } from \"@/components/ui/kit\";", "</script>", "", "<style scoped>", ".a::after { content: \"<TagStyle />\"; }", "</style>"]));
    }
    for (const [shape, line] of Object.entries(ASTRO)) {
      write(p, "src/pages/" + shape.toLowerCase() + ".astro", L(["---", "import { " + shape + "Shown } from \"@/components/ui/kit\";", "---", "<html>", line, "<body>", "  <" + shape + "Shown />", "</body></html>"]));
    }
    const report = S.designSystemReport(p);
    const got = found(report), has = (n) => got.includes(n);
    all("1.35.4 review 3: an opening tag's end is its first `>` outside quotes and `{…}`, the quotes followed from the tag itself — in a template-first .vue, `<span>Don't</span> <template #trailing />` on one line closes the template (its `<script setup>` read: AposTextShown settles), after `<!-- it's a slot -->` and after a quote a line above opened (`:class=\"{` … `}\"`) alike; `<template v-if=\"items.length > 0\" #trailing />` and `v-if=\"text.includes('<br/>')\"` close; an attribute's `'</template>'` closes nothing (a tag that closes itself, one that opens); an .astro `<script is:inline set:html={n > 0 ? a : b} />` closes, and `<script is:inline src=\"/x.js\" />` after `<title>Bob's blog</title>` (the markup after each read); the <style> after each script stays unread (no TagStyle) (got " + js({ got, limits: report.limits }) + ")",
      Object.assign(Object.fromEntries(SHOWN.map((n) => [n.slice(0, -5), () => has(n)])), {
        styleUnread: () => !has("TagStyle"),
        exact: () => js(got) === js(["Kit"].concat(SHOWN).sort()),
        limits: () => report.limits.length === 0,
      }));
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

  // --- review 1 of 1.35.4: a barrel's candidate it also exports under another name is no row of its own (its part's file is) --------
  {
    // shadcn-svelte's convention: card/index.ts imports each part's file and exports it twice, `Root` and `Root as Card`;
    // a page renders `<Card.Root>` through `$lib` — followed on a developer's checkout, where `svelte-kit sync` (dev, build,
    // `prepare`) has written .svelte-kit/tsconfig.json; never on a fresh clone. Card and CardContent are rows (the .svelte
    // files'), Root and Content the same bindings under other names: none, synced or not. A barrel name given once —
    // `export { default as Toaster } from "./Sonner.vue"`, the Laravel Vue starter's — stays a row beside Sonner.vue's own
    const kit = (synced) => project("barrel-alias-" + (synced ? "synced" : "clone"), Object.assign({
      "package.json": deps(["@sveltejs/kit", "svelte"]),
      "tsconfig.json": js({ extends: "./.svelte-kit/tsconfig.json", compilerOptions: { strict: true } }),
      "src/lib/components/ui/card/card.svelte": part("card"),
      "src/lib/components/ui/card/card-content.svelte": part("card-content"),
      "src/lib/components/ui/card/index.ts": L(["import Root from \"./card.svelte\";", "import Content from \"./card-content.svelte\";", "",
        "export {", "\tRoot,", "\tContent,", "\t//", "\tRoot as Card,", "\tContent as CardContent,", "};"]),
      "src/routes/+page.svelte": L(["<script lang=\"ts\">", "\timport * as Card from \"$lib/components/ui/card/index.js\";", "</script>", "",
        "<Card.Root>", "\t<Card.Content />", "</Card.Root>"]),
    }, synced ? { ".svelte-kit/tsconfig.json": js({ compilerOptions: { paths: { $lib: ["../src/lib"], "$lib/*": ["../src/lib/*"] } } }) } : {}));
    const rs = S.designSystemReport(kit(true)), rc = S.designSystemReport(kit(false));
    const rows = (r) => r.missing.map((m) => m.name + " " + m.path).sort();
    const toaster = project("barrel-once", { "package.json": deps(["vue"]) });
    write(toaster, UI + "sonner/index.ts", L(["export { default as Toaster } from \"./Sonner.vue\";"]));
    write(toaster, UI + "sonner/Sonner.vue", L(["<script setup lang=\"ts\">", "import { Toaster as Sonner } from \"vue-sonner\";", "</script>", "", "<template>", "  <Sonner class=\"toaster\" />", "</template>"]));
    write(toaster, "src/layouts/AppLayout.vue", L(["<script setup lang=\"ts\">", "import { Toaster } from \"@/components/ui/sonner\";", "</script>", "", "<template>", "  <main><slot /></main>", "  <Toaster />", "</template>"]));
    const rt = S.designSystemReport(toaster);
    const CARD = ["Card src/lib/components/ui/card/card.svelte", "CardContent src/lib/components/ui/card/card-content.svelte"];
    all("1.35.4 review 1: a barrel's candidate it also exports under another name is no row of its own when the binding comes from a component file of the scan (review 3's rule: that file is the row) — shadcn-svelte's card/index.ts (`export { Root, Content, Root as Card, Content as CardContent }`) rendered as `<Card.Root><Card.Content />` through a synced SvelteKit `$lib` (.svelte-kit/tsconfig.json as `svelte-kit sync` writes it) lists Card and CardContent, never Root or Content — the rows of a fresh clone; a barrel name given once (`export { default as Toaster } from \"./Sonner.vue\"`, rendered as `<Toaster />`) is still listed (got " + js({ synced: [rows(rs), rs.limits], clone: [rows(rc), rc.limits], once: [rows(rt), rt.limits] }) + ")", {
      synced: () => js(rows(rs)) === js(CARD) && rs.limits.length === 0,
      noBareParts: () => !rows(rs).some((r) => /^(?:Root|Content) /.test(r)),
      clone: () => js(rows(rc)) === js(CARD),
      once: () => rows(rt).includes("Toaster " + UI + "sonner/index.ts") && rt.limits.length === 0,
    });
  }

  // --- review 2 of 1.35.4: another component named like a barrel's other name for a binding is none of that binding's (review
  // 3: the binding's own file alone is, a component file of the scan); of one binding's names rendered, the one given with `as` --
  {
    // every row the report lists, `name path` — and its limits, when it says any
    const listed = (p) => { const r = S.designSystemReport(p); return r.missing.map((m) => m.name + " " + m.path).sort().concat(r.limits.length ? ["limits " + js(r.limits)] : []); };
    // shadcn-svelte's resizable barrel, verbatim (its registry's ui/resizable/index.ts): paneforge's Pane and the parts' files,
    // each exported bare and then under the kit's name — `Pane as ResizablePane` is no file's name —, on a developer's
    // checkout (.svelte-kit/tsconfig.json as `svelte-kit sync` writes it)
    const RZ = "src/lib/components/ui/resizable/";
    const SVK = {
      "package.json": deps(["@sveltejs/kit", "svelte", "paneforge"]),
      "tsconfig.json": js({ extends: "./.svelte-kit/tsconfig.json", compilerOptions: { strict: true } }),
      ".svelte-kit/tsconfig.json": js({ compilerOptions: { paths: { $lib: ["../src/lib"], "$lib/*": ["../src/lib/*"] } } }),
      [RZ + "index.ts"]: L(["import { Pane } from \"paneforge\";", "import Handle from \"./resizable-handle.svelte\";", "import PaneGroup from \"./resizable-pane-group.svelte\";", "",
        "export {", "\tPaneGroup,", "\tPane,", "\tHandle,", "\t//", "\tPaneGroup as ResizablePaneGroup,", "\tPane as ResizablePane,", "\tHandle as ResizableHandle,", "};"]),
      [RZ + "resizable-handle.svelte"]: part("handle"),
      [RZ + "resizable-pane-group.svelte"]: part("pane-group"),
    };
    const NAMED = L(["<script lang=\"ts\">", "\timport { ResizablePaneGroup, ResizablePane, ResizableHandle } from \"$lib/components/ui/resizable/index.js\";", "</script>", "",
      "<ResizablePaneGroup direction=\"horizontal\">", "\t<ResizablePane>One</ResizablePane>", "\t<ResizableHandle />", "\t<ResizablePane>Two</ResizablePane>", "</ResizablePaneGroup>"]);
    const DOCS = L(["<script lang=\"ts\">", "\timport * as Resizable from \"$lib/components/ui/resizable/index.js\";", "</script>", "",
      "<Resizable.PaneGroup direction=\"horizontal\">", "\t<Resizable.Pane>One</Resizable.Pane>", "\t<Resizable.Handle />", "</Resizable.PaneGroup>"]);
    const svk = (tag, files) => listed(project("follow-" + tag, Object.assign({}, SVK, files)));
    // the same shape in a Next.js app: react-resizable-panels' Panel and PanelGroup, bare and then the kit's names
    const NEXT = { "package.json": deps(["react", "next", "react-resizable-panels", "@radix-ui/react-dialog", "picker-kit"]), "tsconfig.json": js({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }) };
    const PANELS = L(["import { Panel, PanelGroup } from \"react-resizable-panels\";", "export { Panel, PanelGroup, Panel as ResizablePanel, PanelGroup as ResizablePanelGroup };"]);
    const next = (tag, files) => listed(project("follow-" + tag, Object.assign({}, NEXT, files)));
    const got = {
      // (a) another component named Pane elsewhere in the project — none of this binding's; the same app without it
      foreign: svk("foreign", { "src/lib/components/Pane.svelte": part("pane"), "src/routes/+page.svelte": NAMED }),
      control: svk("control", { "src/routes/+page.svelte": NAMED }),
      foreignPanel: next("foreign-panel", { [UI + "resizable/index.ts"]: PANELS, "src/components/panel.tsx": L(["export function Panel({ children }) { return <section>{children}</section>; }"]),
        "src/app/page.tsx": L(["import { ResizablePanel, ResizablePanelGroup } from \"@/components/ui/resizable\";", "import { Panel } from \"@/components/panel\";",
          "export default function P() { return <ResizablePanelGroup><ResizablePanel /><Panel /></ResizablePanelGroup>; }"]) }),
      // (b) both names of a binding rendered, neither a file's, the bare one listed first: the kit's by name, the bare one
      // through the docs' namespace; radix's parts re-exported `export { Root, …, Root as Dialog, … } from`
      both: svk("both", { "src/routes/+page.svelte": NAMED, "src/routes/docs/+page.svelte": DOCS }),
      dialog: next("dialog", { [UI + "dialog/index.ts"]: L(["export { Root, Trigger, Root as Dialog, Trigger as DialogTrigger } from \"@radix-ui/react-dialog\";"]),
        "src/app/page.tsx": L(["import { Dialog, DialogTrigger } from \"@/components/ui/dialog\";", "import * as D from \"@/components/ui/dialog\";",
          "export default function P() { return <><Dialog><DialogTrigger /></Dialog><D.Root><D.Trigger /></D.Root></>; }"]) }),
      // (d) a barrel at the kit's root and another Panel in a folder BELOW it: none of the binding's either — a component of
      // the name is the binding's only when the binding comes from its file (review 2: the folder's subfolders were taken for
      // the binding's, and ResizablePanel was lost)
      subPanel: next("sub-panel", { [UI + "index.ts"]: L(["import { Panel } from \"react-resizable-panels\";", "export { Panel, Panel as ResizablePanel };"]),
        [UI + "sidebar/panel.tsx"]: L(["export function Panel({ children }) { return <section>{children}</section>; }"]),
        "src/app/page.tsx": L(["import { ResizablePanel } from \"@/components/ui\";", "export default function P() { return <ResizablePanel />; }"]) }),
      // (e) …nor in a sibling FILE of the barrel's own folder (review 3: the rule is the binding's, not the folder's — a
      // folder rule, review 2's first answer, dropped ResizablePanel here, as a row anywhere did before it)
      sibling: next("sibling", { [UI + "resizable/index.ts"]: PANELS, [UI + "resizable/panel.tsx"]: L(["export function Panel({ children }) { return <section>{children}</section>; }"]),
        "src/app/page.tsx": L(["import { ResizablePanel, ResizablePanelGroup } from \"@/components/ui/resizable\";", "export default function P() { return <ResizablePanelGroup><ResizablePanel /></ResizablePanelGroup>; }"]) }),
    };
    // (c) another folder's barrel, whose Panel the page renders through a namespace — exported bare, or given with `as` —,
    // in a folder whose path sorts before resizable/'s (`pick/`: read first) or after it (`pickerpanels/`)
    const PICKERS = { bare: L(["import { Panel } from \"picker-kit\";", "export { Panel };"]), as: L(["import { PickerPanel } from \"picker-kit\";", "export { PickerPanel as Panel };"]) };
    for (const [kind, barrel] of Object.entries(PICKERS)) for (const dir of ["pick", "pickerpanels"]) {
      got[kind + "-" + dir] = next("order-" + kind + "-" + dir, { [UI + "resizable/index.ts"]: PANELS, [UI + dir + "/index.ts"]: barrel,
        "src/app/page.tsx": L(["import { ResizablePanel, ResizablePanelGroup } from \"@/components/ui/resizable\";", "import * as Picker from \"@/components/ui/" + dir + "\";",
          "export default function P() { return <ResizablePanelGroup><ResizablePanel /><Picker.Panel /></ResizablePanelGroup>; }"]) });
    }
    const RESIZABLE = ["ResizableHandle " + RZ + "resizable-handle.svelte", "ResizablePane " + RZ + "index.ts", "ResizablePaneGroup " + RZ + "resizable-pane-group.svelte"];
    const RP = ["ResizablePanel " + UI + "resizable/index.ts", "ResizablePanelGroup " + UI + "resizable/index.ts"];
    const order = (kind) => ["pick", "pickerpanels"].every((dir) => js(got[kind + "-" + dir]) === js(["Panel " + UI + dir + "/index.ts"].concat(RP)));
    all("1.35.4 review 2: another component named like a barrel's other name for a binding is none of that binding's — only the binding's own file, a component file of the scan, is (review 3's rule) —, and of one binding's names rendered, the one given with `as` is taken — shadcn-svelte's resizable barrel verbatim (`import { Pane } from \"paneforge\"; export { PaneGroup, Pane, Handle, PaneGroup as ResizablePaneGroup, Pane as ResizablePane, Handle as ResizableHandle }`) rendered as `<ResizablePane>` lists ResizablePane beside another component named Pane elsewhere (src/lib/components/Pane.svelte: the rows of the app without it, and its own) — ResizablePanel beside an app's own panel.tsx alike, beside a Panel in a folder below the barrel's and in a sibling file of the barrel's own folder (resizable/panel.tsx) —; both names of a binding rendered, the bare one listed first (`<Resizable.Pane>` and `<ResizablePane>`; radix's `Root` / `Root as Dialog` re-exported `from`): the `as` name is listed, the bare one not; another folder's barrel whose Panel is rendered (bare or given with `as`) changes nothing whether its path sorts before resizable/ (`pick/`) or after it (`pickerpanels/`) (got " + js(got) + ")", {
      foreign: () => js(got.foreign) === js(["Pane src/lib/components/Pane.svelte"].concat(RESIZABLE)),
      control: () => js(got.control) === js(RESIZABLE),
      foreignPanel: () => js(got.foreignPanel) === js(["Panel src/components/panel.tsx"].concat(RP)),
      both: () => js(got.both) === js(RESIZABLE),
      dialog: () => js(got.dialog) === js(["Dialog " + UI + "dialog/index.ts", "DialogTrigger " + UI + "dialog/index.ts"]),
      subPanel: () => js(got.subPanel) === js(["Panel " + UI + "sidebar/panel.tsx", "ResizablePanel " + UI + "index.ts"]),
      sibling: () => js(got.sibling) === js(["Panel " + UI + "resizable/panel.tsx"].concat(RP)),
      orderBare: () => order("bare"),
      orderAs: () => order("as"),
    });
  }

  // --- review 3 of 1.35.4: a candidate given under more than one name is no row of its own when the binding comes from a
  // component file of the scan, whoever won the name; the `as` preference is one binding's alone ------------------------------
  {
    const listed = (p) => { const r = S.designSystemReport(p); return r.missing.map((m) => m.name + " " + m.path).sort().concat(r.limits.length ? ["limits " + js(r.limits)] : []); };
    // shadcn-svelte's card/ and table/ barrels verbatim (its registry's ui/card/index.ts, ui/table/index.ts), each part a
    // file, on a developer's checkout (.svelte-kit/tsconfig.json as `svelte-kit sync` writes it), every part rendered the
    // docs' way (`<Card.Root>`, `<Table.Row>`)
    const BARRELS = {
      card: ["import Action from \"./card-action.svelte\";", "import Content from \"./card-content.svelte\";", "import Description from \"./card-description.svelte\";",
        "import Footer from \"./card-footer.svelte\";", "import Header from \"./card-header.svelte\";", "import Title from \"./card-title.svelte\";", "import Root from \"./card.svelte\";", "",
        "export {", "\tRoot,", "\tContent,", "\tDescription,", "\tFooter,", "\tHeader,", "\tTitle,", "\tAction,", "\t//", "\tRoot as Card,", "\tContent as CardContent,",
        "\tDescription as CardDescription,", "\tFooter as CardFooter,", "\tHeader as CardHeader,", "\tTitle as CardTitle,", "\tAction as CardAction,", "};"],
      table: ["import Body from \"./table-body.svelte\";", "import Caption from \"./table-caption.svelte\";", "import Cell from \"./table-cell.svelte\";", "import Footer from \"./table-footer.svelte\";",
        "import Head from \"./table-head.svelte\";", "import Header from \"./table-header.svelte\";", "import Row from \"./table-row.svelte\";", "import Root from \"./table.svelte\";", "",
        "export {", "\tRoot,", "\tBody,", "\tCaption,", "\tCell,", "\tFooter,", "\tHead,", "\tHeader,", "\tRow,", "\t//", "\tRoot as Table,", "\tBody as TableBody,", "\tCaption as TableCaption,",
        "\tCell as TableCell,", "\tFooter as TableFooter,", "\tHead as TableHead,", "\tHeader as TableHeader,", "\tRow as TableRow,", "};"],
    };
    const PARTS = { card: ["card", "card-action", "card-content", "card-description", "card-footer", "card-header", "card-title"],
      table: ["table", "table-body", "table-caption", "table-cell", "table-footer", "table-head", "table-header", "table-row"] };
    const BARE = ["Action", "Body", "Caption", "Cell", "Content", "Description", "Footer", "Head", "Header", "Root", "Row", "Title"];
    const page = (at) => L(["<script lang=\"ts\">", "\timport * as Card from \"" + at + "card/index.js\";", "\timport * as Table from \"" + at + "table/index.js\";", "</script>", "",
      "<Card.Root>", "\t<Card.Header><Card.Title>Invoices</Card.Title><Card.Description>Recent</Card.Description><Card.Action>x</Card.Action></Card.Header>",
      "\t<Card.Content>", "\t\t<Table.Root>", "\t\t\t<Table.Caption>A list</Table.Caption>", "\t\t\t<Table.Header><Table.Row><Table.Head>No.</Table.Head></Table.Row></Table.Header>",
      "\t\t\t<Table.Body><Table.Row><Table.Cell>INV001</Table.Cell></Table.Row></Table.Body>", "\t\t\t<Table.Footer><Table.Row><Table.Cell>Total</Table.Cell></Table.Row></Table.Footer>",
      "\t\t</Table.Root>", "\t</Card.Content>", "\t<Card.Footer>f</Card.Footer>", "</Card.Root>"]);
    // (an app at `prefix`: its barrels' `./x.svelte` imports through `spec`, its page's through `at`)
    const app = (files, prefix, opts = {}) => {
      const spec = opts.spec || ((kit, line) => line), at = opts.at || "$lib/components/ui/";
      files[prefix + "package.json"] = deps(["@sveltejs/kit", "svelte"]);
      files[prefix + "tsconfig.json"] = js({ extends: "./.svelte-kit/tsconfig.json", compilerOptions: { strict: true } });
      files[prefix + ".svelte-kit/tsconfig.json"] = js({ compilerOptions: { paths: { $lib: ["../src/lib"], "$lib/*": ["../src/lib/*"] } } });
      for (const kit of Object.keys(BARRELS)) {
        files[prefix + "src/lib/components/ui/" + kit + "/index.ts"] = L(BARRELS[kit].map((line) => spec(kit, line)));
        for (const f of PARTS[kit]) files[prefix + "src/lib/components/ui/" + kit + "/" + f + ".svelte"] = part(f);
      }
      files[prefix + "src/routes/+page.svelte"] = page(at);
      return files;
    };
    const viaLib = (kit, line) => line.split("from \"./").join("from \"$lib/components/ui/" + kit + "/");
    const comp = (tag, files) => listed(project("comp-" + tag, files));
    const got = {
      single: comp("single", app({}, "")),
      // (a) a two-app monorepo, each app with its own install: web's files win the names (a shorter path) — admin's barrels'
      // bindings come from admin's own part files, rows of the scan
      mono: comp("mono", app(app({ "package.json": js({ name: "mono", private: true, workspaces: ["apps/*"] }) }, "apps/web/"), "apps/admin/")),
      // (b) the barrels import their parts through `$lib/components/ui/card/card.svelte` (an absolute-imports lint's
      // autofix) — the page through `$lib`, or through a relative path
      lib: comp("lib", app({}, "", { spec: viaLib })),
      libRelPage: comp("lib-rel-page", app({}, "", { spec: viaLib, at: "../lib/components/ui/" })),
      // (c) the app's own Table.svelte (Card.svelte) beside shadcn's table/ (card/): a shorter path, it wins the name
      ownTable: comp("own-table", Object.assign(app({}, ""), { "src/lib/components/Table.svelte": part("own-table") })),
      ownCard: comp("own-card", Object.assign(app({}, ""), { "src/lib/components/Card.svelte": part("own-card") })),
    };
    const pascal = (kebab) => kebab.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
    const ROWS = (prefix) => Object.keys(PARTS).flatMap((kit) => PARTS[kit].map((f) => pascal(f) + " " + prefix + "src/lib/components/ui/" + kit + "/" + f + ".svelte")).sort();
    const own = (name) => ROWS("").map((r) => r.startsWith(name + " ") ? name + " src/lib/components/" + name + ".svelte" : r).sort();
    all("1.35.4 review 3: a candidate given under more than one name is no row of its own when the binding comes from a component file of the scan, whoever won the name elsewhere — shadcn-svelte's card/ and table/ barrels verbatim, every part rendered as `<Card.Root>` / `<Table.Row>`: (a) in a two-app monorepo (apps/web and apps/admin, each with its own install) the rows are web's 15 part files, no bare part (Root, Content, Row…) — admin's bindings come from admin's own files —; (b) barrels importing their parts through `$lib/components/ui/card/card.svelte` (a synced SvelteKit config; the page through `$lib` or a relative path) list the 15 files alone; (c) an app's own src/lib/components/Table.svelte (Card.svelte) beside shadcn's table/ (card/): its Table row, and no bare Root (got " + js(got) + ")", {
      control: () => js(got.single) === js(ROWS("")),
      mono: () => js(got.mono) === js(ROWS("apps/web/")),
      lib: () => js(got.lib) === js(ROWS("")),
      libRelPage: () => js(got.libRelPage) === js(ROWS("")),
      ownTable: () => js(got.ownTable) === js(own("Table")),
      ownCard: () => js(got.ownCard) === js(own("Card")),
      noBareParts: () => Object.values(got).every((rows) => !rows.some((r) => BARE.includes(r.slice(0, r.indexOf(" "))))),
    });

    // the `as` preference is one binding's: across files, the first file in the results order keeps the row — chakra-ui/ark's
    // shape (its website's primitives/field.tsx declares `export const ErrorText = withContext(…)`; its Solid package's
    // fieldset.tsx re-exports other bindings under those names), a component folder's barrel beside a component file, and
    // shadcn-svelte's docs (picker/'s `import Content …; export { Content }`, doc-tabs/'s `export { default as Content } from`):
    // review 2's two passes gave every file's `as` names first, and the rows moved to the re-exports
    const FIELDSET = "packages/solid/src/components/fieldset/";
    const binding = {
      ark: listed(project("binding-ark", {
        "package.json": deps(["react", "solid-js", "@ark-ui/react"]),
        "website/src/components/ui/primitives/field.tsx": L(["import { Field } from \"@ark-ui/react/field\";", "import { createStyleContext } from \"styled-system/jsx\";",
          "const { withProvider, withContext } = createStyleContext(field);", "export const Root = withProvider(Field.Root, \"root\");",
          "export const ErrorText = withContext(Field.ErrorText, \"errorText\");", "export const HelperText = withContext(Field.HelperText, \"helperText\");"]),
        [FIELDSET + "fieldset.tsx"]: L(["export { FieldsetErrorText as ErrorText } from './fieldset-error-text.tsx'", "export { FieldsetHelperText as HelperText } from './fieldset-helper-text.tsx'",
          "export { FieldsetRoot as Root } from './fieldset-root.tsx'"]),
        [FIELDSET + "fieldset-error-text.tsx"]: L(["export const FieldsetErrorText = (props) => <div {...props} />;"]),
        [FIELDSET + "fieldset-helper-text.tsx"]: L(["export const FieldsetHelperText = (props) => <div {...props} />;"]),
        [FIELDSET + "fieldset-root.tsx"]: L(["export const FieldsetRoot = (props) => <fieldset {...props} />;"]),
        "website/src/app/page.tsx": L(["import * as Field from \"../components/ui/primitives/field\";", "import * as Fieldset from \"../../../" + FIELDSET + "fieldset.tsx\";",
          "export default function P() { return <><Field.Root><Field.ErrorText /><Field.HelperText /></Field.Root><Fieldset.Root><Fieldset.ErrorText /><Fieldset.HelperText /></Fieldset.Root></>; }"]),
      })),
      folder: listed(project("binding-folder", {
        "package.json": deps(["react", "@ark-ui/react"]),
        "src/components/card.tsx": L(["import { ark } from \"@ark-ui/react\";", "export const Root = withProvider(ark.div, \"root\");"]),
        "src/components/fieldset/index.ts": L(["export { FieldsetRoot as Root } from \"./fieldset-root\";"]),
        "src/components/fieldset/fieldset-root.tsx": L(["export const FieldsetRoot = (props) => <fieldset {...props} />;"]),
        "src/App.tsx": L(["import * as Card from \"./components/card\";", "import * as Fieldset from \"./components/fieldset\";", "export const App = () => <><Card.Root /><Fieldset.Root /></>;"]),
      })),
      docs: listed(project("binding-docs", {
        "package.json": deps(["@sveltejs/kit", "svelte"]),
        "tsconfig.json": js({ extends: "./.svelte-kit/tsconfig.json" }),
        ".svelte-kit/tsconfig.json": js({ compilerOptions: { paths: { $lib: ["../src/lib"], "$lib/*": ["../src/lib/*"] } } }),
        "src/lib/components/picker/index.ts": L(["import Content from \"./picker-content.svelte\";", "export { Content };"]),
        "src/lib/components/picker/picker-content.svelte": part("picker-content"),
        "src/lib/components/doc-tabs/index.ts": L(["export { default as Content } from \"./doc-tabs-content.svelte\";"]),
        "src/lib/components/doc-tabs/doc-tabs-content.svelte": part("doc-tabs-content"),
        "src/routes/+page.svelte": L(["<script lang=\"ts\">", "\timport * as Picker from \"$lib/components/picker/index.js\";", "\timport * as DocTabs from \"$lib/components/doc-tabs/index.js\";", "</script>", "",
          "<Picker.Content>a</Picker.Content>", "<DocTabs.Content>b</DocTabs.Content>"]),
      })),
    };
    const FIELD = "website/src/components/ui/primitives/field.tsx";
    all("1.35.4 review 3: the `as` preference is one binding's alone — across files the first in the results order keeps the row, whatever is given with `as`: chakra-ui/ark's website primitives/field.tsx declaring `export const ErrorText = withContext(…)` (HelperText, Root alike) and its Solid fieldset.tsx re-exporting `export { FieldsetErrorText as ErrorText } from './fieldset-error-text.tsx'`, both rendered: ErrorText, HelperText and Root stay on field.tsx; card.tsx's `Root = withProvider(…)` beside a component folder's barrel `export { FieldsetRoot as Root } from`: Root on card.tsx; shadcn-svelte's docs: picker/'s `export { Content }` keeps Content beside doc-tabs/'s `export { default as Content } from` (both names of ONE binding rendered: the `as` one, review 2's above) (got " + js(binding) + ")", {
      ark: () => js(binding.ark) === js(["ErrorText " + FIELD, "Field " + FIELD, "Fieldset " + FIELDSET + "fieldset.tsx", "FieldsetErrorText " + FIELDSET + "fieldset-error-text.tsx",
        "FieldsetHelperText " + FIELDSET + "fieldset-helper-text.tsx", "FieldsetRoot " + FIELDSET + "fieldset-root.tsx", "HelperText " + FIELD, "Root " + FIELD]),
      folder: () => js(binding.folder) === js(["Card src/components/card.tsx", "FieldsetRoot src/components/fieldset/fieldset-root.tsx", "Root src/components/card.tsx"]),
      docs: () => js(binding.docs) === js(["Content src/lib/components/picker/index.ts", "DocTabsContent src/lib/components/doc-tabs/doc-tabs-content.svelte",
        "PickerContent src/lib/components/picker/picker-content.svelte"]),
    });
  }

  // --- review 4 of 1.35.4: a component file that lost its own name to another is no row — its binding's `as` names the page
  // renders stand for it where their name is free; a component FOLDER's index is a component file too ------------------------
  {
    const listed = (p) => { const r = S.designSystemReport(p); return r.missing.map((m) => m.name + " " + m.path).sort().concat(r.limits.length ? ["limits " + js(r.limits)] : []); };
    const fn = (n) => L(["export default function " + n + "({ children }) { return <div>{children}</div>; }"]);
    const REACT = { "package.json": deps(["react", "next"]), "tsconfig.json": js({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }) };
    // kits whose part files are named generically (`dialog/root.tsx`, `popover/root.tsx`): only the shortest path keeps the
    // `root` and `content` names — the other kits' barrels give theirs under the kit's name with `as` (shadcn-svelte's shape)
    const kitTsx = (k, K) => ({ [UI + k + "/root.tsx"]: fn("Root"), [UI + k + "/content.tsx"]: fn("Content"),
      [UI + k + "/index.ts"]: L(["import Root from \"./root\";", "import Content from \"./content\";", "export { Root, Content, Root as " + K + ", Content as " + K + "Content };"]) });
    const SVK = "src/lib/components/ui/";
    const kitSvelte = (k, K) => ({ [SVK + k + "/root.svelte"]: part(k + "-root"), [SVK + k + "/content.svelte"]: part(k + "-content"),
      [SVK + k + "/index.ts"]: L(["import Root from \"./root.svelte\";", "import Content from \"./content.svelte\";", "export { Root, Content, Root as " + K + ", Content as " + K + "Content };"]) });
    // a two-name barrel over component FOLDERS (`card/index.tsx`), imported relatively or through `@/…`
    const folders = (spec) => Object.assign({}, REACT, {
      [UI + "kit/card/index.tsx"]: fn("Card"), [UI + "kit/card-content/index.tsx"]: fn("CardContent"),
      [UI + "kit/index.ts"]: L(["import Root from \"" + spec("card") + "\";", "import Content from \"" + spec("card-content") + "\";", "export { Root, Content, Root as Card, Content as CardContent };"]),
      "src/app/page.tsx": L(["import * as Kit from \"@/components/ui/kit\";", "export default function P() { return <Kit.Root><Kit.Content /></Kit.Root>; }"]) });
    const got = {
      react: listed(project("r4-generic-react", Object.assign({}, REACT, kitTsx("dialog", "Dialog"), kitTsx("popover", "Popover"), kitTsx("tooltip", "Tooltip"), {
        "src/app/page.tsx": L(["import { Dialog, DialogContent } from \"@/components/ui/dialog\";", "import { Popover, PopoverContent } from \"@/components/ui/popover\";",
          "import { Tooltip, TooltipContent } from \"@/components/ui/tooltip\";",
          "export default function P() { return <><Dialog><DialogContent /></Dialog><Popover><PopoverContent /></Popover><Tooltip><TooltipContent /></Tooltip></>; }"]) }))),
      svelte: listed(project("r4-generic-svelte", Object.assign({ "package.json": deps(["@sveltejs/kit", "svelte"]), "tsconfig.json": js({ extends: "./.svelte-kit/tsconfig.json" }),
        ".svelte-kit/tsconfig.json": js({ compilerOptions: { paths: { $lib: ["../src/lib"], "$lib/*": ["../src/lib/*"] } } }) }, kitSvelte("dialog", "Dialog"), kitSvelte("popover", "Popover"), {
        "src/routes/+page.svelte": L(["<script lang=\"ts\">", "\timport { Dialog, DialogContent } from \"$lib/components/ui/dialog/index.js\";",
          "\timport { Popover, PopoverContent } from \"$lib/components/ui/popover/index.js\";", "</script>", "", "<Dialog><DialogContent>a</DialogContent></Dialog>", "<Popover><PopoverContent>b</PopoverContent></Popover>"]) }))),
      folderRel: listed(project("r4-folder-rel", folders((f) => "./" + f))),
      folderAlias: listed(project("r4-folder-alias", folders((f) => "@/components/ui/kit/" + f))),
    };
    const FOLDERS = ["Card " + UI + "kit/card/index.tsx", "CardContent " + UI + "kit/card-content/index.tsx"];
    all("1.35.4 review 4: a component file that lost its own name to another is no row — of its binding's names, those given with `as` that the page renders stand for it where their name is free: kits of generically named part files (`dialog/root.tsx`, `popover/root.tsx`, `tooltip/root.tsx`, each barrel `export { Root, Content, Root as Popover, Content as PopoverContent }`) list dialog's Root and Content (the shortest paths) and Popover, PopoverContent, Tooltip, TooltipContent (dialog's own names stay its files' rows), in .tsx and in .svelte; a two-name barrel over component FOLDERS (`import Root from \"./card\"` → card/index.tsx), relative or through `@/…`, lists the folders' Card and CardContent, no bare part (got " + js(got) + ")", {
      react: () => js(got.react) === js(["Content " + UI + "dialog/content.tsx", "Popover " + UI + "popover/index.ts", "PopoverContent " + UI + "popover/index.ts", "Root " + UI + "dialog/root.tsx",
        "Tooltip " + UI + "tooltip/index.ts", "TooltipContent " + UI + "tooltip/index.ts"]),
      svelte: () => js(got.svelte) === js(["Content " + SVK + "dialog/content.svelte", "Popover " + SVK + "popover/index.ts", "PopoverContent " + SVK + "popover/index.ts", "Root " + SVK + "dialog/root.svelte"]),
      folderRel: () => js(got.folderRel) === js(FOLDERS),
      folderAlias: () => js(got.folderAlias) === js(FOLDERS),
    });
  }

  // --- what it costs: a binding's names are one group, never a copy once a candidate ------------------------------------------
  {
    // (review 2 of 1.35.4: each candidate's other names were the binding's whole list filtered, 500 candidates × N names a
    // file — 8 component files and 8 component folders' barrels, each exporting one imported binding under ~13,000 names
    // (`RRRRRR as NF000000, …`, lines of 100 to 252K, a new `export {` every 150 lines), took ×4.4 to ×5.7 the same bytes
    // with a binding per name (`R00000 as NF000000`), whose groups are of one: the soft side copies nothing. The group shared:
    // ×0.8 to ×0.9. Nothing is rendered: both sides list the 8 files' own rows)
    const pad = (i) => String(i).padStart(5, "0");
    const lists = (hostile, tag) => {
      const out = ["import R from \"./r\";"];
      for (let i = 0, len = 0; len < 252 * 1024;) {
        const list = ["export {"];
        for (let l = 0; l < 150 && len < 252 * 1024; l++) {
          const row = [];
          for (let j = 0; j < 100; j++, i++) row.push((hostile ? "RRRRRR" : "R" + pad(i)) + " as N" + tag + pad(i));
          const line = "  " + row.join(", ") + ",";
          list.push(line);
          len += line.length + 1;
        }
        list.push("};");
        out.push(list.join("\n"));
      }
      return out.join("\n") + "\n";
    };
    const side = (hostile) => {
      const d = project("cost-group-" + (hostile ? "hard" : "soft"), { "package.json": deps(["react"]) });
      for (let k = 0; k < 8; k++) { write(d, UI + "kit" + k + ".tsx", lists(hostile, "F" + k)); write(d, UI + "bar" + k + "/index.ts", lists(hostile, "B" + k)); }
      return d;
    };
    const hard = side(true), soft = side(false);
    // (a sample: each side's least of three runs, the two in turn, and the rows each listed)
    const timedRows = (p) => { const t0 = Date.now(), r = S.designSystemReport(p); return [Date.now() - t0, found(r)]; };
    const sample = () => {
      const s = { ms: [Infinity, Infinity], rows: null };
      for (let r = 0; r < 3; r++) { const h = timedRows(hard), e = timedRows(soft); s.ms = [Math.min(s.ms[0], h[0]), Math.min(s.ms[1], e[0])]; s.rows = [h[1], e[1]]; }
      return s;
    };
    const g = remeasure(sample, (s) => s.ms[0] < 2 * s.ms[1] + 150);
    const KITS = Array.from({ length: 8 }, (_, k) => "Kit" + k);
    all("1.35.4 review 2: a binding's names are one group a file, never copied once a candidate — 8 component files and 8 barrels each exporting one imported binding under ~13,000 names (`RRRRRR as NF000000, …`, 252K) cost no more than twice the same bytes with a binding per name (×4.4 to ×5.7 when each of the 500 candidates filtered the whole list), and both list the 8 files' own rows (got " + js(g) + ")", {
      time: () => g.ms[0] < 2 * g.ms[1] + 150,
      rows: () => js(g.rows[0]) === js(KITS) && js(g.rows[1]) === js(KITS),
    });
    // (…and when its names are RENDERED: each rendered candidate asked its whole group for a row — one binding under
    // 12,000 lower-case names and 500 rendered ones took ×31 the same names a binding each; past DS_ALIAS_NAMES a group
    // asks none, review 2. Review 3's rule walks each rendered candidate's group once — ×5 uncapped on one file, under
    // this check's 150 ms of slack: eight such files, review 4)
    const RK = 8;
    const rbody = (hostile, k) => {
      const names = [];
      for (let i = 0; i < 12000; i++) names.push((hostile ? "RRRRRR" : "R" + pad(i)) + " as a" + k + pad(i));
      for (let i = 0; i < 500; i++) names.push((hostile ? "RRRRRR" : "R" + pad(12000 + i)) + " as N" + k + pad(i));
      const out = ["import R from \"./r\";"];
      for (let s = 0; s < names.length; s += 15000) {
        const chunk = names.slice(s, s + 15000), lines = ["export {"];
        for (let l = 0; l < chunk.length; l += 100) lines.push("  " + chunk.slice(l, l + 100).join(", ") + ",");
        lines.push("};");
        out.push(lines.join("\n"));
      }
      return out.join("\n") + "\n";
    };
    const rside = (hostile) => {
      const d = project("cost-group-rendered-" + (hostile ? "hard" : "soft"), { "package.json": deps(["react"]) });
      for (let k = 0; k < RK; k++) {
        write(d, UI + "kit" + k + ".tsx", rbody(hostile, k));
        const ns = Array.from({ length: 500 }, (_, i) => "N" + k + pad(i)), rows = [];
        for (let s = 0; s < 500; s += 50) rows.push(ns.slice(s, s + 50));
        write(d, "src/app/p" + k + ".tsx", rows.map((q) => "import { " + q.join(", ") + " } from \"../components/ui/kit" + k + "\";").join("\n") + "\nexport const P = () => <>\n" + rows.map((q) => q.map((n) => "<" + n + " />").join("")).join("\n") + "\n</>;\n");
      }
      return d;
    };
    const rhard = rside(true), rsoft = rside(false);
    const rtimed = (p) => { const t0 = Date.now(), r = S.designSystemReport(p); return [Date.now() - t0, r.missingTotal]; };
    const rsample = () => {
      const s = { ms: [Infinity, Infinity], totals: null };
      for (let r = 0; r < 3; r++) { const h = rtimed(rhard), e = rtimed(rsoft); s.ms = [Math.min(s.ms[0], h[0]), Math.min(s.ms[1], e[0])]; s.totals = [h[1], e[1]]; }
      return s;
    };
    const rg = remeasure(rsample, (s) => s.ms[0] < 2 * s.ms[1] + 150);
    all("1.35.4 review 2: …and when the names are rendered — eight files each giving one binding under 12,000 lower-case names and 500 rendered ones cost no more than twice the same names a binding each (a rendered candidate's group walked past DS_ALIAS_NAMES names: ×31 a file when each asked the whole group for a row, ×5 once a candidate — review 4), and both list the 4,000 (got " + js(rg) + ")", {
      time: () => rg.ms[0] < 2 * rg.ms[1] + 150,
      rows: () => rg.totals[0] === rg.totals[1] && rg.totals[0] >= 500 * RK,
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

    // (review 1 of 1.35.4: a line of block openers with no `>` after them — each opener's tag end was looked for to the
    // line's end again, quadratic: 40 files of one 256K line, ×44 to ×200 the same files spelled out of reach. Its end is
    // looked for once a line where it is known; each opener's own work stays — ×3 to ×8 its soft line's cost, a line of
    // none —, so the bound is ×15. A .svelte's `<script </script `, an .astro's `<style </style `, a .vue's top-level
    // `<a </a `; each file imports the candidate before the line and renders it after: both sides list it)
    const wrap = { svelte: ["<script>" + IMP + "</script>\n", "\n<MotionBox />\n"], astro: ["---\n" + IMP + "\n---\n", "\n<MotionBox />\n"],
      vue: ["<script setup>" + IMP + "</script>\n", "\n<template><MotionBox /></template>\n"] };
    const wide = (name, ext, body) => {
      const d = project("cost-" + name, { "package.json": deps(["react"]) });
      write(d, UI + "kit.tsx", L(["export const MotionBox = motion(Box);"]));
      for (let k = 0; k < 40; k++) write(d, "src/pages/w" + String(k).padStart(2, "0") + "." + ext, wrap[ext][0] + body + wrap[ext][1]);
      return d;
    };
    const OPENERS = { svelteScripts: ["svelte", rep("<script </script ", N)], astroStyles: ["astro", rep("<style </style ", N)], vueTop: ["vue", rep("<a </a ", N)] };
    // (a sample: each side's least of three runs, the two in turn, and the rows each listed)
    const listedIn = (p) => { const t0 = Date.now(), r = S.designSystemReport(p); return [Date.now() - t0, found(r)]; };
    const wideSample = (hard, soft) => {
      const s = { ms: [Infinity, Infinity], rows: null };
      for (let r = 0; r < 3; r++) { const h = listedIn(hard), e = listedIn(soft); s.ms = [Math.min(s.ms[0], h[0]), Math.min(s.ms[1], e[0])]; s.rows = [h[1], e[1]]; }
      return s;
    };
    const wideMs = {};
    for (const [name, [ext, body]] of Object.entries(OPENERS)) {
      const hard = wide(name + "-hard", ext, body), easy = wide(name + "-soft", ext, outOfReach(body));
      wideMs[name] = remeasure(() => wideSample(hard, easy), (s) => s.ms[0] < 15 * s.ms[1] + 300);
    }
    all("1.35.4 review 1: an opening tag's end is looked for once a line where it is known — 40 files of one 256K line of `<script </script ` (.svelte), `<style </style ` (.astro) and `<a </a ` at a .vue's top level, no slower than ×15 the same files spelled out of reach (each opener's own work, ×3 to ×8; quadratic was ×44 to ×200), and both sides list the candidate rendered after the line (got " + js(wideMs) + ")",
      Object.assign(Object.fromEntries(Object.keys(OPENERS).map((k) => [k, () => wideMs[k].ms[0] < 15 * wideMs[k].ms[1] + 300])),
        Object.fromEntries(Object.keys(OPENERS).map((k) => [k + "Rows", () => js(wideMs[k].rows[0]) === js(["Kit", "MotionBox"]) && js(wideMs[k].rows[1]) === js(wideMs[k].rows[0])]))));
  }
};
