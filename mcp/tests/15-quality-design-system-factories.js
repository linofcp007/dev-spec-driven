"use strict";
// The design-system registry — 1.35.4: a call that renders a name is a render (createElement / h / createVNode / jsx).
// What a tag compiles to settles a name as the tag does — React's `createElement(X, …)`, Preact's and Vue's `h(X)`, Vue's
// `createVNode(X)`, the `/jsx-runtime` / `/jsx-dev-runtime` `jsx` / `jsxs` / `jsxDEV` — when the function is the library's
// own (imported under any name, a namespace or default import's member, a require); its first argument the type as written,
// any case, type arguments aside, on the first line below with text when the call breaks after its `(`; a provider's
// (`X.Provider`) as `<X.Provider>` is. Not a render: a function of the same name from elsewhere, cloneElement / memo /
// forwardRef, a first argument that is no name. A `.ts` file is still read only when a weak name is asked (a said limit);
// a markup file's script is read whatever is asked. What it costs: the pass is gated, its heads and look-below linear.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const BT = String.fromCharCode(96);
  const L = (lines) => lines.join("\n") + "\n";
  const deps = (list) => js({ dependencies: Object.fromEntries(list.map((d) => [d, "1.0.0"])) });
  const project = (tag, files) => {
    const p = path.join(tmp, "proj-dsf-" + tag);
    for (const [rel, text] of Object.entries(files || {})) write(p, rel, text);
    S.initProject(p, ["ui"], "en");
    return p;
  };
  const UI = "src/components/ui/";
  const KIT = "\"@/components/ui/kit\"";
  // every name the scan finds (the seed: all of them)
  const seeded = (p) => { S.scaffoldSteeringFile(p, "design-system.md"); return E.designSystemRegistry(path.join(p, ".specs")).components.map((c) => c.name).sort(); };
  const candidates = (names) => names.map((n) => "export const " + n + " = createComponent(config);");
  const named = (names, from) => "import { " + names.join(", ") + " } from " + (from || KIT) + ";";

  // --- a factory call renders its first argument; a function of the same name from elsewhere, or no name first, does not ------
  {
    const p = project("renders", { "package.json": deps(["react", "vue", "preact"]) });
    const POS = ["ViaNs", "ViaDefault", "ViaNamed", "ViaAlias", "ViaJsx", "ViaJsxs", "ViaJsxDev", "ViaPreact", "ViaCompat", "ViaVue", "ViaVNode", "ViaRequire",
      "Below", "BelowLone", "BelowComment", "BelowBlock", "BelowString", "ViaMember", "Typed", "TypedArg", "Early", "ViaRtNs", "InTest", "AfterTpl"];
    const NEG = ["LocalH", "Vue2H", "OtherMod", "DomCall", "MemberH", "BoundH", "Cloned", "Cloned2", "Memoed", "Memoed2", "Forwarded", "Emotion", "InCall",
      "InTernary", "TernaryElse", "TernaryBroken", "InText", "Shorthand", "NotReact", "NotVue", "Compiled", "FromAntd", "NotRtNs", "NotBaseJsx"];
    write(p, UI + "kit.tsx", L(candidates(POS).concat(candidates(NEG), [
      // weak: rendered by a factory and called (stays), called alone (none), called in a page and rendered only in a `.ts`
      // file (a weak name is asked: the `.ts` file is read), provided through a factory (a context), given to useContext
      // and rendered by a factory (a context)
      "export const Both = observer(() => <div />);", "export const CalledOnly = observer(() => <div />);", "export const TsOnly = observer(() => <div />);",
      "export const Store = makeStore(() => <i />);", "export const CtxBoth = makeCtx(() => <i />);",
      // its own file renders a candidate through a factory
      "import { createElement } from \"react\";", "export const Own = createComponent(config);", "export function UsesOwn() { return createElement(Own, null); }",
    ])));
    // (a default export given to a factory under a lower-case local: a value — JSX's capital rule is JSX's own)
    write(p, UI + "tiles.tsx", L(["const Tile = createComponent(config);", "export default Tile;"]));
    // the namespace import (shadcn's style), its call broken after `(` over a comment line, after a `(` and a line's comment
    // or a block's (its blank before kept: the rest is blank, not empty), the line below read as code (a string's `>` in a
    // type argument ends none); type arguments on the callee; a provider's type
    write(p, "src/app/a.tsx", L(["import * as React from \"react\";", named(["ViaNs", "Below", "BelowComment", "BelowBlock", "BelowString", "Typed", "Store"]),
      "export const P = () => React.createElement(ViaNs, null);",
      "export const Q = () => React.createElement(", "  // the dialog", "  Below,", "  {},", ");",
      "export const Q2 = () => React.createElement( // why", "  BelowComment,", "  null", ");",
      "export const Q3 = () => React.createElement( /* the dialog */", "  BelowBlock,", "  null", ");",
      "export const Q4 = () => React.createElement(", "  BelowString<\"a>b\">,", "  null", ");",
      "export const R = () => React.createElement<Props>(Typed, {});",
      "export const S2 = () => React.createElement(Store.Provider, { value: 1 });"]));
    write(p, "src/app/b.jsx", L(["import React from \"react\";", named(["ViaDefault"]), "export const P = () => React.createElement(ViaDefault, { a: 1 });"]));
    write(p, "src/app/c.tsx", L(["import { createElement, createElement as e } from \"react\";", named(["ViaNamed", "ViaAlias"]), "createElement(ViaNamed); e(ViaAlias, {});"]));
    // the automatic runtime's names, aliased (a compiler's output) and bare, a lone argument with no comma below its call
    write(p, "src/app/d.mjs", L(["import { jsx, jsx as _jsx, jsxs as _jsxs } from \"react/jsx-runtime\";", "import { jsxDEV } from \"react/jsx-dev-runtime\";",
      named(["ViaJsx", "ViaJsxs", "ViaJsxDev", "BelowLone"], "\"../components/ui/kit.js\""),
      "export const X = _jsx(ViaJsx, {});", "export const Y = _jsxs(ViaJsxs, {});", "export const W = jsxDEV(ViaJsxDev, {});", "export const Z = jsx(", "  BelowLone", ");"]));
    write(p, "src/app/e.js", L(["import { h } from \"preact\";", "import { createElement as ce } from \"preact/compat\";", named(["ViaPreact", "ViaCompat"], "\"../components/ui/kit\""), "h(ViaPreact);", "ce(ViaCompat);"]));
    // a call ABOVE its import (ESM hoists it); a namespace's member first; type arguments after the first argument
    write(p, "src/app/f.tsx", L(["h(Early);", "import { h, createVNode as _cv } from \"vue\";", named(["Early", "ViaVue", "ViaVNode", "TypedArg"]), "import * as UI from " + KIT + ";",
      "h(ViaVue, {}, () => \"x\");", "_cv(ViaVNode, null);", "h(UI.ViaMember);", "h(TypedArg<boolean>, {});"]));
    write(p, "src/app/g.js", L(["const React = require(\"react\");", "const { ViaRequire } = require(\"../components/ui/kit\");", "module.exports = () => React.createElement(ViaRequire);"]));
    // a lower-case default import; a weak one rendered and called, called alone, called here and rendered in a `.ts` file
    write(p, "src/app/h.tsx", L(["import tile from \"@/components/ui/tiles\";", "import { createElement } from \"react\";", "import * as React from \"react\";", named(["Both", "CalledOnly", "TsOnly"]),
      "createElement(tile);", "export const x = Both(1), y = CalledOnly(2), z = TsOnly(3);", "export const R = () => React.createElement(Both);"]));
    write(p, "src/lib/mount.ts", L(["import { createElement } from \"react\";", named(["TsOnly"]), "export const m = createElement(TsOnly);"]));
    // a runtime's namespace: its own names alone (`jsx`), never the base's; the base's namespace never the runtime's
    write(p, "src/app/rt.tsx", L(["import * as runtime from \"react/jsx-runtime\";", "import * as React from \"react\";", named(["ViaRtNs", "NotRtNs", "NotBaseJsx"]),
      "export const A = runtime.jsx(ViaRtNs, {});", "export const B = runtime.createElement(NotRtNs);", "export const C = React.jsx(NotBaseJsx, {});"]));
    // a test's render counts, as a tag in a test does
    write(p, "src/app/render.test.tsx", L(["import { h } from \"vue\";", named(["InTest"]), "export const t = () => h(InTest);"]));
    // the line a template closes on holds code: read
    write(p, "src/app/tpl.tsx", L(["import { h } from \"vue\";", named(["AfterTpl"]), "const css = " + BT, "  color: red;", BT + "; export const T = () => h(AfterTpl);"]));
    // a context given to useContext and rendered by a factory: a context, as with a tag
    write(p, "src/app/ctx.tsx", L(["import { useContext } from \"react\";", "import * as React from \"react\";", named(["CtxBoth"]),
      "export function C() { const v = useContext(CtxBoth); return React.createElement(CtxBoth, { v }); }"]));
    // negatives — a local `h`, Vue 2's `render(h)` parameter
    write(p, "src/app/n1.tsx", L([named(["LocalH", "Vue2H"]), "const h = (x) => x;", "h(LocalH);", "export default { render(hh) { return hh(Vue2H); } };"]));
    // …a member of something else, a factory's own member, cloneElement / memo through the namespace, a call / a ternary
    // first, a string first and an object's shorthand below, a string, a comment and a template's line
    write(p, "src/app/n2.tsx", L(["import { createElement } from \"react\";", "import { h } from \"vue\";", "import * as React from \"react\";",
      named(["DomCall", "MemberH", "BoundH", "Cloned2", "Memoed2", "InCall", "InTernary", "TernaryElse", "TernaryBroken", "Shorthand", "InText"]),
      "document.createElement(DomCall); obj.h(MemberH); createElement.bind(BoundH); React.cloneElement(Cloned2, {}); React.memo(Memoed2);",
      "React.createElement(getComp(InCall)); React.createElement(cond ? InTernary : TernaryElse);",
      // (a ternary's condition broken after its name: the line below goes on with a `?`, not a `,` or a `)`)
      "export const T2 = React.createElement(", "  TernaryBroken", "    ? DialogBox", "    : SheetBox,", "  null", ");",
      "React.createElement(\"div\", {", "  Shorthand,", "});",
      "const s = \"React.createElement(InText)\"; // React.createElement(InText)", "const t = " + BT, "React.createElement(InText)", BT + ";"]));
    // …another library's `createElement` / `jsx`, React's cloneElement / memo / forwardRef imported
    write(p, "src/app/n3.tsx", L(["import { createElement } from \"lucide\";", "import { cloneElement, memo, forwardRef } from \"react\";", "import { jsx } from \"@emotion/react\";",
      named(["OtherMod", "Cloned", "Memoed", "Forwarded", "Emotion"]),
      "createElement(OtherMod); cloneElement(Cloned, {}); export const M = memo(Memoed); export const F = forwardRef(Forwarded); jsx(Emotion, {});"]));
    // …a module named like a runtime
    write(p, "src/app/n4.tsx", L(["import { createElement } from \"@acme/not-react\";", "import { h } from \"vue-hash\";", named(["NotReact", "NotVue"]), "createElement(NotReact);", "h(NotVue);"]));
    // …compiled CommonJS; another package's name of the same spelling
    write(p, "src/app/n5.tsx", L(["const _jsxRuntime = require(\"react/jsx-runtime\");", "const { Compiled } = require(\"../components/ui/kit\");", "(0, _jsxRuntime.jsx)(Compiled, {});",
      "import { FromAntd } from \"antd\";", "import { createElement } from \"react\";", "createElement(FromAntd);"]));
    const got = seeded(p);
    const lost = POS.concat(["Own", "Tile", "Both", "TsOnly"]).filter((n) => !got.includes(n));
    const listed = NEG.concat(["CalledOnly", "Store", "CtxBoth"]).filter((n) => got.includes(n));
    all("1.35.4: a call that renders a name is a render — React's `createElement` (a namespace import, a default import, named, aliased, a `require`; type arguments on it), the `/jsx-runtime` / `/jsx-dev-runtime` `jsx` / `jsxs` / `jsxDEV` (aliased, bare, a runtime's namespace), Preact's `h` and `preact/compat`'s `createElement`, Vue's `h` and `createVNode`; its first argument any case (a lower-case default import), a namespace's member (`h(UI.ViaMember)`), with type arguments (`h(TypedArg<boolean>, …)`), on the first line below with text when the call breaks after its `(` (a comment line between, a line's or a block's comment after the `(`, a lone argument with no comma, a string's `>` in its type argument), on a line a template closes on, in a call written above its import, in a test, in the component file itself; a weak name rendered so and called stays, one called here and rendered only in a `.ts` file stays (a weak name is asked: the `.ts` file is read) (got " + js({ lost, got }) + ")", {
      renders: () => lost.length === 0,
    });
    all("1.35.4: …and not a render — a local `h`, Vue 2's `render(hh)`, another library's `createElement` / `h` / `jsx` (`lucide`, `@emotion/react`, `@acme/not-react`, `vue-hash`), a member of anything else (`document.createElement`, `obj.h`), a factory's own member (`createElement.bind`), cloneElement / memo / forwardRef (imported or through the namespace), a base module's `jsx` or a runtime's `createElement`, a first argument that is a call, a ternary (its condition broken after its name too: the line below goes on with a `?`) or a string (an object's shorthand below it), a string, a comment, a template's line, compiled CommonJS, another package's name; a weak name called alone, provided through a factory (`createElement(Store.Provider, …)`: a context, as `<Store.Provider>`) or given to useContext is none (got " + js({ listed }) + ")", {
      notRenders: () => listed.length === 0,
    });
  }

  // --- what is read: a `.ts` file only when a weak name is asked (a said limit, pinned); a markup file's script always -----------
  {
    const p = project("ts-gate", { "package.json": deps(["react", "vue"]) });
    // (candidates alone: no weak name is asked)
    write(p, UI + "kit.tsx", L(candidates(["InTs", "InTsx", "InVue"])));
    write(p, "src/lib/mount.ts", L(["import { createElement } from \"react\";", named(["InTs"]), "export const m = createElement(InTs);"]));
    write(p, "src/app/page.tsx", L(["import { createElement } from \"react\";", named(["InTsx"]), "export const m = createElement(InTsx);"]));
    // (a .vue file's `<script>` goes through the same reader — 1.35.4's markup files)
    write(p, "src/app/Mount.vue", L(["<script setup>", "import { h } from \"vue\";", named(["InVue"]), "const r = () => h(InVue);", "</script>", "<template><div /></template>"]));
    const got = seeded(p);
    all("1.35.4: with no weak name asked a `.ts` file is never read — a candidate it alone renders through a factory call (`createElement(InTs)` in src/lib/mount.ts) is not listed, a said limit (reading them cost a Vue and a Svelte kit's reports ×6 for no row) —, the same call in a `.tsx` file is a render, and so is one in a `.vue` file's `<script>` (a markup file is read whatever is asked) (got " + js(got) + ")", {
      tsx: () => got.includes("InTsx"),
      vue: () => got.includes("InVue"),
      ts: () => !got.includes("InTs"),
    });
  }

  // --- with the other 1.35.4 readings: a config's `paths`, what a barrel passes on — the binding stays the import's own --------
  {
    const p = project("interplay", { "package.json": deps(["react"]), "tsconfig.json": js({ compilerOptions: { paths: { "@kit/*": ["src/components/ui/*"] } } }) });
    write(p, UI + "kit.tsx", L(candidates(["ViaPaths", "ViaBarrel", "ViaShim"])));
    write(p, "src/lib/index.ts", L(["export { ViaBarrel } from \"../components/ui/kit\";"]));
    write(p, "src/lib/react-shim.ts", L(["export { createElement } from \"react\";"]));
    write(p, "src/app/page.tsx", L(["import { createElement } from \"react\";", "import { createElement as shimmed } from \"../lib/react-shim\";",
      named(["ViaPaths"], "\"@kit/kit\""), named(["ViaBarrel"], "\"../lib\""), named(["ViaShim"], "\"../components/ui/kit\""),
      "export const A = () => createElement(ViaPaths, null);", "export const B = () => createElement(ViaBarrel, null);", "export const C = () => shimmed(ViaShim, null);"]));
    const got = seeded(p);
    all("1.35.4: a factory's first argument resolves as a tag's does — through the config's `paths` (`@kit/kit`) and through what a barrel passes on (`export { ViaBarrel } from …`) —, and the factory is the library's own import alone: a project's module that passes React's `createElement` on binds none (a row by hand) (got " + js(got) + ")", {
      paths: () => got.includes("ViaPaths"),
      barrel: () => got.includes("ViaBarrel"),
      shim: () => !got.includes("ViaShim"),
    });
  }

  // --- what it costs: each against the same pages with the trigger out of reach, a ratio ------------------------------------------
  {
    const pages = (tag, count, head, body, deps1) => {
      const d = project("cost-" + tag, { "package.json": deps(deps1 || ["react"]) });
      write(d, UI + "kit.tsx", L(["export const Moving = motion(Box);"]));
      for (let i = 0; i < count; i++) write(d, "src/app/p" + i + ".tsx", "import { Moving } from \"@/components/ui/kit\";\n" + head + body);
      return d;
    };
    const lines = (line, n) => (line + "\n").repeat(n);
    // (a sample: each side's best of two runs, interleaved — a burst on a shared machine lands on one run of a side)
    const pair = (hard, soft) => {
      const t = (p) => { const t0 = Date.now(); S.designSystemReport(p); return Date.now() - t0; };
      t(hard); t(soft);
      return () => { const h1 = t(hard), s1 = t(soft), h2 = t(hard), s2 = t(soft); return [Math.min(h1, h2), Math.min(s1, s2)]; };
    };
    //   the gate: a file that binds no factory is read once — 40 pages of 120 lines of `a(`×1,000 against `ax`×1,000 (×5
    //   ungated; the soft side's own cost the same either way)
    const gh = pages("gate-hard", 40, "", lines("a(".repeat(1000), 120)), gs = pages("gate-soft", 40, "", lines("ax".repeat(1000), 120));
    const gms = remeasure(pair(gh, gs), (s) => s[0] < 2 * s[1] + 100);
    //   the head's look-behind: a name is tried at its start alone — 120 lines of one 1,990-letter name in pages that bind
    //   `h`, against 120 lines of 995 one-letter names (no letter inside a name to try: ×90 without it, the soft side alike)
    const lh = pages("lookbehind-hard", 8, "import { h } from \"vue\";\n", lines("a".repeat(1990), 120), ["react", "vue"]);
    const ls = pages("lookbehind-soft", 8, "import { h } from \"vue\";\n", lines("a ".repeat(995), 120), ["react", "vue"]);
    const lms = remeasure(pair(lh, ls), (s) => s[0] < 2.5 * s[1] + 150);
    //   the look-below and runs of heads: 1,000 calls broken after `(` above 50 blank lines each, 60 lines of `h(`×995 — each
    //   run of blank lines read once (×7 without its `break`) — against the same lines of `hx(` (heads that are no factory:
    //   never a look-below)
    const below = (head) => (head + "\n" + "\n".repeat(50)).repeat(1000) + lines(head.repeat(995), 60);
    const bh = pages("below-hard", 8, "import { h } from \"vue\";\n", below("h("), ["react", "vue"]);
    const bs = pages("below-soft", 8, "import { h } from \"vue\";\n", below("hx("), ["react", "vue"]);
    const bms = remeasure(pair(bh, bs), (s) => s[0] < 2.5 * s[1] + 150);
    all("1.35.4: a call that renders a name costs a file that binds no factory nothing (40 pages of 120 lines of `a(`×1,000: no slower than the same lines of `ax`), and in one that binds one its heads and its look-below stay linear — 120 lines of one 1,990-letter name (each name tried at its start alone: no slower than 995 one-letter names), 1,000 calls broken after their `(` above 50 blank lines and 60 lines of `h(`×995 (each run of blank lines read once) — no slower than the same pages with the trigger out of reach (got " + js({ gms, lms, bms }) + ")", {
      gate: () => gms[0] < 2 * gms[1] + 100,
      lookBehind: () => lms[0] < 2.5 * lms[1] + 150,
      lookBelow: () => bms[0] < 2.5 * bms[1] + 150,
    });
  }
};
