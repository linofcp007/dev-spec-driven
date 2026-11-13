"use strict";
// The design-system registry (1.35) — review 7's findings: a route segment is one only under an app router's root (review
// 6 took any folder with a page.* for one), a global stylesheet by what it DECLARES (never by its folder), a whole line read
// in linear time, a NAME that is printed has the shape of words, a library's note derived from its entry, a `/*` inside a
// quoted string, Less variables, parameters inside parentheses, names that read back.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, approveBefore, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const rd = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const REG = ".specs/steering/design-system.md";
  const COMP = "export default () => null;\n";
  // n custom properties of one block: `:root { --c0: 0px; … }` (sel: another selector, or an at-rule's prelude)
  const PROPS = (n, prefix, sel) => (sel || ":root") + " {\n" + Array.from({ length: n }, (_, i) => "  --" + (prefix || "c") + i + ": " + i + "px;").join("\n") + "\n}\n";
  const project = (tag) => { const p = path.join(tmp, "proj-ds7-" + tag); S.initProject(p, ["ui"], "en"); return p; };
  const registry = (p) => E.designSystemRegistry(path.join(p, ".specs"));
  const names = (p) => registry(p).components.map((c) => c.name + " <" + c.path + ">");
  const REQ = "# Feature: Sign Up\n\n## Summary\nA form.\n\n## User Stories\n### US-1 (P1): Sign up\nAs a visitor I want to sign up.\n**Independent Test:** submit the form.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the visitor submits the form THE SYSTEM SHALL create the account.\n" +
    "2. **US-1.AC-2** — IF the e-mail is taken THEN THE SYSTEM SHALL say so beside the field.\n\n## Success Criteria\n- **SC-001** — a visitor signs up in under a minute.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN the network drops THE SYSTEM SHALL keep what was typed.\n\n## Non-Functional Requirements\n- **NFR-1** — the form renders in under 100 ms.\n\n## Out of Scope\n- Social sign-in.\n";
  const design = (rows) => "# Design: Sign Up\n\n## Overview\nA form built from the system.\n\n## Architecture\n```mermaid\ngraph TD\n  F[Form] --> A[api]\n```\n\n" +
    "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n| Reuse | the api client | `src/lib/api.ts` | it posts the form |\n\n" +
    "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n| Fields | The system's | Accessible | A dependency | A rewrite | ✓ |\n| Fields | Our own | Light | States to build | Drift | ✗ |\n\n" +
    "## Data Models\nAccount {email}.\n\n## Error Handling\nSee the IF…THEN criteria.\n\n## Testing Strategy\nComponent tests.\n\n## Risks\n- A slow network — low — the button shows progress.\n\n" +
    "## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
    "## [UI] Design System Usage\nBuilt from the system.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n" + rows.join("\n") + "\n\n## [UI] UI States\nLoading: the button spins. Error: beside the field. Reference: design/signup.png.\n\n" +
    "## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n\n## [UI] Responsiveness & i18n\nOne column at 360 px.\n\n## [UI] UI Performance Budget\nNo layout shift.\n";
  // a size m feature whose design is ready for its approval; → approve(rows): rewrite the table, try the approval
  const sized = (p) => {
    const f = S.createFeature(p, { name: "Sign Up", tracks: ["ui"], summary: "x", size: "m" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(["| Reuse | Placeholder | x |"]));
    approveBefore(p, f.slug, "design");
    const approve = (rows) => { fs.writeFileSync(path.join(f.dir, "design.md"), design(rows)); const a = S.approvePhase(p, f.slug, "design", "t"); return a.ok ? "approved" : "refused:" + (a.failing || []).join(","); };
    const check = () => (S.specDoctor(p, f.slug).checks || []).find((c) => c.id === "ui-design-system");
    return { slug: f.slug, dir: f.dir, approve, check };
  };
  const feature = (p, name, files) => {
    const f = S.createFeature(p, { name, tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Implements: " + files + "_\n");
    return f;
  };
  const tokensOf = (p) => Object.fromEntries(S.designSystemReport(p).newTokens.map((t) => [t.name, t.value]));

  // --- a route segment: under an app router's root, down to a page -------------------------------------------------------------------
  {
    // no router: a component folder that holds its own page.* / route.* keeps its components
    const a = project("no-router");
    for (const f of ["page", "loading", "error", "layout", "button"]) write(a, "src/components/" + f + ".tsx", COMP);
    S.scaffoldSteeringFile(a, "design-system.md");
    const fa = sized(a);
    const plain = { rows: registry(a).components.map((c) => c.name), verdicts: [fa.approve(["| Reuse | Loading | the pending state |"]), fa.approve(["| New | Loading | no listed component shows progress |"])], inSync: S.designSystemReport(a).inSync };
    const remix = project("remix");
    for (const f of ["app/root.tsx", "app/routes/_index.tsx", "app/components/page.tsx", "app/components/layout.tsx", "app/components/error.tsx"]) write(remix, f, COMP);
    const vue = project("vue");
    write(vue, "src/components/route.ts", "export const route = 1;\n");
    for (const f of ["error.vue", "loading.vue"]) write(vue, "src/components/" + f, "<template><p /></template>\n");
    S.scaffoldSteeringFile(remix, "design-system.md");
    S.scaffoldSteeringFile(vue, "design-system.md");
    // an app router: every folder from its root (an `app/` with a root layout) down to a page.* / route.* is a segment
    const n = project("next");
    write(n, "package.json", js({ dependencies: { next: "15.0.0" } }));
    for (const f of ["app/layout.tsx", "app/page.tsx",
      "app/components/page.jsx", "app/components/loading.tsx", "app/components/error.tsx", "app/components/not-found.tsx", "app/components/default.tsx", "app/components/global-error.tsx",
      "app/components/template.tsx", "app/components/layout.tsx", // its own page
      "app/ui/route.js", "app/ui/template.tsx", // a route handler
      "app/design-system/[name]/page.mdx", "app/design-system/layout.tsx", "app/design-system/loading.tsx", // a page in a child segment
      "app/_components/page.tsx", "app/_components/loading.tsx", // a private folder: out of routing
      "app/widgets/feedback/error.tsx", // no page at or below it: a folder of components
      "apps/web/src/app/layout.js", "apps/web/src/app/ui/page.js", "apps/web/src/app/ui/template.tsx", // a second router, under src/
      "components/ui/button.tsx"]) write(n, f, COMP);
    S.scaffoldSteeringFile(n, "design-system.md");
    const fn = sized(n);
    const next = { rows: names(n), verdicts: [fn.approve(["| New | Layout | the page frame, built here |"]), fn.approve(["| Reuse | Template | the frame |"])] };
    // an entry file is one right inside the telling folder — `src/` looked through
    const e = project("entries");
    for (const f of ["apps/ui/src/main.tsx", "packages/design-system/src/main.tsx", "packages/ui/src/app.tsx", "packages/ui/src/Button.tsx", "components/layout/main.tsx", "src/ui/source/app.tsx"]) write(e, f, COMP);
    S.scaffoldSteeringFile(e, "design-system.md");
    all("1.35 review 7: a route segment exists only under an app router's root — an `app/` holding a root layout, in a project that depends on next — and is every folder from it down to a page.* / route.*: a component folder with its own `page.tsx` (`src/components/`, Remix's `app/components/`, a `route.ts` beside `error.vue`) keeps Loading / Error / Layout / Page — a size m design reusing Loading is approved, one declaring it New refused —, while under a router the special files of a segment are pages, with its page in the folder (.jsx), in a child segment (.mdx) or a route.js beside them, never in a private `_components/` nor a folder with no page below; `main` / `app` are entry files right inside the telling folder, `src/` looked through (got " +
      js({ plain, remix: names(remix), vue: names(vue), next, entries: names(e) }) + ")", {
      noRouter: () => js(plain.rows) === js(["Button", "Error", "Layout", "Loading", "Page"]) && js(plain.verdicts) === js(["approved", "refused:ui-design-system"]) && plain.inSync === true,
      remix: () => js(names(remix)) === js(["Error <app/components/error.tsx>", "Layout <app/components/layout.tsx>", "Page <app/components/page.tsx>"]),
      vue: () => js(names(vue)) === js(["Error <src/components/error.vue>", "Loading <src/components/loading.vue>"]),
      router: () => js(next.rows) === js(["Button <components/ui/button.tsx>", "Error <app/widgets/feedback/error.tsx>", "Loading <app/_components/loading.tsx>", "Page <app/_components/page.tsx>"]),
      gate: () => js(next.verdicts) === js(["approved", "refused:ui-design-system"]),
      entries: () => js(names(e)) === js(["Button <packages/ui/src/Button.tsx>", "Main <components/layout/main.tsx>"]),
    });
  }

  // --- a global stylesheet: its name when it can only be the page's, else what it declares for the whole page ---------------------------
  // (review 8 on review 7: every stylesheet had become a candidate and `:host` a page-wide selector — a candidate is one by its
  // NAME again, wherever it lies, and a name a component's own sheet has too is judged by what it declares)
  {
    const places = ["modules/web/src/styles/globals.css", "features/web/app/globals.css", "src/views/assets/css/main.css", "web/modules/custom/acme_theme/css/style.css",
      "components/web/src/styles/globals.css", "src/screens/app/styles/main.scss", "widgets/dashboard/src/index.css", "src/ui/theme/index.css", "app/tailwind.css",
      "app/assets/stylesheets/application.css", "wwwroot/css/site.css", "src/css/custom.css", "src/input.css", "src/styles/global.css", "resources/css/app.css", "src/styles/root.css", "src/styles/base.scss"];
    const read = places.map((rel, i) => { const p = project("place-" + i); write(p, rel, PROPS(6)); const r = S.designSystemReport(p); return r.found.tokens + ":" + r.found.sources.join(","); });
    // the blocks that declare for the whole page — five properties each, a `main.css` of its own
    const global = { html: "html", body: "body", list: ":root, .light", hostlist: ":root, :host", attr: ":root[data-theme=dark]", where: ":where(:root)", is: ":is(:root, .theme)", theme: "@theme", inline: "@theme inline",
      plugin: "@plugin \"daisyui/theme\"" };
    const g = project("selectors");
    const at = (k) => "src/s/" + k + "/main.css";
    for (const [k, sel] of Object.entries(global)) write(g, at(k), PROPS(5, k, sel));
    write(g, at("layer"), "@layer base {\n" + PROPS(5, "layer") + "}\n");
    write(g, at("media"), "@media (prefers-color-scheme: dark) { " + PROPS(5, "media").replace(/\n/g, " ") + " }\n");
    write(g, at("cssnest"), ":root {\n  @media (min-width: 1px) {\n" + Array.from({ length: 5 }, (_, i) => "    --cn" + i + ": 1px;").join("\n") + "\n  }\n}\n");
    write(g, at("minified"), ":root{" + Array.from({ length: 5 }, (_, i) => "--min" + i + ":" + i + "px").join(";") + "}\n");
    write(g, at("over-lines"), ":root,\n[data-theme=\"light\"]\n{\n" + Array.from({ length: 5 }, (_, i) => "  --ol" + i + ": " + i + "px;").join("\n") + "\n}\n");
    write(g, at("long-list"), ":root,\n" + Array.from({ length: 100 }, (_, i) => ".x" + i).join(",\n") + " {\n" + Array.from({ length: 5 }, (_, i) => "  --ll" + i + ": 1px;").join("\n") + "\n}\n");
    write(g, at("nested").replace(".css", ".scss"), ":root {\n  --ne0: 1px;\n  &.dark {\n" + Array.from({ length: 4 }, (_, i) => "    --nd" + i + ": 1px;").join("\n") + "\n  }\n}\n");
    // a block that overrides a page-wide token is a theme of the page: what else it declares counts (shadcn's dark-only names)
    write(g, at("override"), ":root { --ov0: 1px; --ov1: 1px; --ov2: 1px; --ov3: 1px; }\n.dark {\n  --ov0: 2px; --ov1: 2px; --ov2: 2px; --ov3: 2px;\n  --od0: 1px;\n}\n");
    write(g, at("mixin").replace(".css", ".scss"), "@mixin light-theme {\n" + Array.from({ length: 5 }, (_, i) => "  --mx" + i + ": 1px;").join("\n") + "\n}\n:root { @include light-theme; }\n");
    const selRep = S.designSystemReport(g);
    const sel = selRep.found.sources.map((x) => x.split("/")[2]).sort();
    // …and the ones that do not: a component's own (under ui/, design-system/, primitives/ too), a web component's `:host`, a
    // descendant, a class alone, a nested rule, a keyframe, `*`, an at-rule that is no rule, four of them, Sass variables, a
    // mixin nothing page-wide includes, a CSS module — and a sheet under a name that says nothing
    const o = project("own");
    const own = { "src/ui/Card/index.css": ".card", "src/design-system/Tabs/index.css": ".tabs", "src/primitives/Box/styles.css": ".box", "src/o/host/main.css": ":host", "src/o/descendant/main.css": "body .card",
      "src/o/child/main.css": ":root > .x", "src/o/dark/main.css": ".dark", "src/o/star/main.css": "*, ::before, ::after", "src/o/htmlish/main.css": "html-element", "src/o/theme.module.css": ":root",
      "src/o/themes/styles.css": "@themes", "src/styles/brand.css": ":root", "src/app/card/card.component.scss": ":root" };
    for (const [rel, s0] of Object.entries(own)) write(o, rel, PROPS(6, "o", s0));
    write(o, "src/o/nested/main.scss", ":root {\n  .x {\n" + Array.from({ length: 6 }, (_, i) => "    --n" + i + ": 1px;").join("\n") + "\n  }\n}\n");
    write(o, "src/o/frames/main.css", "@keyframes k { from { --k0: 1px; --k1: 1px; --k2: 1px; --k3: 1px; --k4: 1px; } }\n");
    write(o, "src/o/four/main.css", PROPS(4, "four"));
    write(o, "src/o/repoint/main.css", ":root { --rp0: 1px; --rp1: 1px; --rp2: 1px; --rp3: 1px; }\n.btn-outline {\n  --rp0: 0;\n" + Array.from({ length: 6 }, (_, i) => "  --bo" + i + ": 1px;").join("\n") + "\n}\n");
    write(o, "src/o/amp/main.scss", ":root {\n  --am0: 1px;\n  & .card {\n" + Array.from({ length: 6 }, (_, i) => "    --ac" + i + ": 1px;").join("\n") + "\n  }\n}\n");
    write(o, "src/o/at-rule/main.css", ":root { --r0: 1px; }\n" + PROPS(6, "page", "@page")); // (the block before it is closed: no selector of its own)
    write(o, "src/o/sass-vars/main.scss", ":root {\n  $a: 1px; $b: 1px; $c: 1px; $d: 1px; $e: 1px;\n  --only: 1px; --two: 2px;\n}\n");
    write(o, "src/o/mixin/main.scss", "@mixin card-vars {\n" + Array.from({ length: 6 }, (_, i) => "  --cv" + i + ": 1px;").join("\n") + "\n}\n.card { @include card-vars; }\n");
    write(o, "src/ui/Card/Card.tsx", COMP);
    write(o, "src/ui/Card/index.css", PROPS(6, "card", ".card") + ".card { color: #123456; padding: 13px; }\n");
    write(o, "src/styles/tokens.css", ":root { --brand: #1d4ed8; }\n");
    S.scaffoldSteeringFile(o, "design-system.md");
    const fo = feature(o, "Card", "src/ui/Card/");
    const none = S.designSystemReport(o);
    const raw = S.designSystemReport(o, { name: fo.slug }).raw.map((x) => x.value);
    // a `globals.css` is the page's by its very name: a theme declared on an attribute or on classes alone counts
    const named = ["[data-theme=\"light\"]", ".light", ".theme-acme"].map((s0, i) => { const p = project("named-" + i); write(p, "src/app/globals.css", PROPS(6, "t", s0)); return S.designSystemReport(p).found.tokens; });
    // 25 components' own sheets beside the one global: no source of theirs, no bound, in sync
    const m = project("many");
    for (let i = 0; i < 25; i++) write(m, "packages/ui/src/C" + i + "/index.css", PROPS(6, "c" + i + "-", ".c" + i));
    write(m, "packages/ui/src/styles/globals.css", PROPS(6));
    S.scaffoldSteeringFile(m, "design-system.md");
    const many = S.designSystemReport(m);
    // the likeliest name first, then root-most: 120 `sections/<Name>/styles.css` never stand before a deeper globals.css; of
    // two `main.css` the root-most gives a name its value — and the other, which brings no name of its own, takes no place
    const d = project("order");
    for (let i = 0; i < 120; i++) write(d, "src/sections/S" + String(i).padStart(3, "0") + "/styles.css", ".s { display: block; }\n");
    write(d, "src/app/[locale]/(site)/globals.css", PROPS(6, "deep"));
    write(d, "apps/a/main.css", PROPS(5, "m").replace("--m0: 0px", "--m0: 222px"));
    write(d, "web/main.css", PROPS(5, "m").replace("--m0: 0px", "--m0: 111px"));
    S.scaffoldSteeringFile(d, "design-system.md");
    const order = S.designSystemReport(d);
    const m0 = (registry(d).tokens.find((t) => t.name === "--m0") || {}).value;
    all("1.35 review 7 / 8: a global stylesheet is a candidate by its NAME, wherever it lies (modules/, features/, views/, a Drupal module, `ui/theme/`; globals / global, main, style, index, tailwind, application, site, custom, input), and a source by five custom properties of the whole page: on :root, html, body (alone, in a list — `:root, :host` —, qualified, in :where() / :is(), under @layer / @media, CSS nesting, minified, the first of a list of 100 selectors over lines), in Tailwind's @theme and a theme plugin's @plugin, in a `&` rule of a page-wide block, in a block that overrides the page-wide tokens (at least half of what it declares — a rule that re-points one of them beside six of its own is a component's), in a mixin a page-wide block includes; a component's own sheet declares on its own selector and is none — nor `:host` alone, a descendant, a class, a nested rule, a keyframe, `*`, `@page`, four properties, Sass variables, a component's mixin, a CSS module, a sheet under another name (brand.css, card.component.scss) —, and its raw values are read for the feature; a `globals.css` is the page's by its name, whatever its selectors; 25 component sheets beside the one globals.css say no bound and the seed is in sync; 120 `sections/*/styles.css` do not stand before a deeper globals.css, and the root-most of two main.css gives a name its value — the other brings no name and takes no place (got " +
      js({ read, sel, limits: selRep.limits, none: none.found.sources, raw, named, many: [many.found.sources, many.limits, many.inSync], order: [order.found.sources, order.limits, order.inSync, m0] }) + ")", {
      places: () => js(read) === js(places.map((rel) => "6:" + rel)),
      selectors: () => js(sel) === js(Object.keys(global).concat(["layer", "media", "cssnest", "minified", "over-lines", "long-list", "nested", "override", "mixin"]).sort()) && js(selRep.limits) === js([]),
      own: () => js(none.found.sources) === js(["src/styles/tokens.css"]) && none.found.tokens === 1,
      raw: () => js(raw) === js(["#123456", "padding: 13px"]),
      named: () => js(named) === js([6, 6, 6]),
      many: () => js(many.found.sources) === js(["packages/ui/src/styles/globals.css"]) && js(many.limits) === js([]) && many.inSync === true,
      order: () => js(order.found.sources) === js(["src/app/[locale]/(site)/globals.css", "web/main.css"]) && js(order.limits) === js([]) && order.inSync === true && m0 === "111px",
    });
  }

  // --- a stylesheet's lines: linear, strings, Less, parentheses --------------------------------------------------------------------------
  {
    // one line of 240K characters whose tail a `.` cannot cross (U+2028, U+2029, a stray CR): the value is never matched
    const hostile = (sep) => "--a:" + " ".repeat(120000) + "x".repeat(120000) + sep + "z";
    const cases = { "tokens.css": hostile(String.fromCharCode(0x2028)), "_variables.scss": "$a:" + hostile(String.fromCharCode(0x2029)).slice(4), "globals.css": ":root{" + hostile("\r") + "}" };
    const timed = Object.entries(cases).map(([name, text], i) => {
      const p = project("linear-" + i);
      write(p, "src/styles/" + name, text + "\n--b: 2px;\n");
      const t = remeasure(() => { const t0 = Date.now(); const r = S.designSystemReport(p); return { ms: Date.now() - t0, limits: r.limits.length }; }, (s) => s.ms < 1500);
      return t.ms < 1500 && t.limits === 0;
    });
    // a `/*` inside a quoted string opens no comment
    const q = project("quoted");
    write(q, "src/app/globals.css", "@import \"tailwindcss\";\n@source \"../components/*.tsx\";\n@source '../lib/*.ts';\n" + PROPS(6, "tw") + "/* a real one: --hidden: 1px; */\n:root { --after: 2px; }\n");
    write(q, "src/styles/_variables.scss", "@import \"mixins/*\";\n$brand: #1d4ed8;\n$sep: \"/*\";\n$gap: 8px; /* don't */ $pad: 4px; /* x */ $more: 1px;\n");
    const quoted = tokensOf(q);
    // Less variables; a parameter or a map's key inside the parentheses a statement opened is no declaration
    const l = project("less");
    write(l, "src/styles/variables.less", "@import (reference) \"mixins\";\n@primary-color: #1890ff;\n@font: \"Helvetica\", sans-serif;\n@link-color: @primary-color;\n@media (min-width: 1px) { .a { color: red; } }\n");
    write(l, "src/styles/_variables.scss", ["@use \"sass:math\";", "$a: 1px;", "$map: (", "  sm: 576px,", "  $key: 1px", ");", "@mixin button-variant(", "  $background,", "  $border: $background,",
      "  $hover-background: darken($background, 7.5%)", ") {", "  color: red;", "}", "$border: 1px solid #ccc;", "$hover-background: #eee;", ".btn {", "  @include button-variant(", "    $background: $a,",
      "    $border: #333", "  );", "  $local: 4px;", "  --note: \"(\";", "  --btn-pad: 4px 8px", "}", "$z: 10 // no semicolon, then a comment", ";", "$quoted: \"FAKEquotedLast\"", "}", "$last: \"FAKEfileLast\""].join("\n"));
    const forms = tokensOf(l);
    const leaked = ["FAKEquotedLast", "FAKEfileLast"].filter((x) => js(S.designSystemReport(l)).includes(x));
    // a stylesheet's identifiers are its author's: listed as written
    const w = project("names");
    write(w, "src/styles/tokens.css", ":root {\n  --a1b2c3d4e5: 4px;\n  --mdc-outlined-text-field-disabled-outline-color: 4px;\n  --gray-900: #111;\n  --space-2xl: 4rem;\n}\n");
    all("1.35 review 7: a token file's line is read whole in linear time — 240K characters whose tail a `.` cannot cross (U+2028, U+2029, a stray CR) took 56 s through `\\s*:\\s*(.*)$` —, with no bound said; a `/*` inside a quoted string opens no comment (Tailwind 4's `@source \"../components/*.tsx\"`, sass-glob's `@import \"mixins/*\"`), a real comment still hides its text; a .less file's `@name:` is a token; a `name:` inside the parentheses a statement opened is a parameter or a map's key, so a mixin's `$border: $background,` no longer shadows `$border: 1px solid #ccc` — an unmatched `(` in a string costs one statement; a lone `;` on the next line ends a declaration; a quoted string as a block's or a file's last declaration is shown blank; a stylesheet's own identifiers are listed as written, a hashed `--a1b2c3d4e5` and a 47-character name alike — review 8: only a JSON key is asked to be words (got " +
      js({ timed, quoted, forms, leaked, names: tokensOf(w) }) + ")", {
      linear: () => js(timed) === js([true, true, true]),
      quoted: () => js(quoted) === js({ "$brand": "#1d4ed8", "$sep": "", "$gap": "8px", "$pad": "4px", "$more": "1px", "--tw0": "0px", "--tw1": "1px", "--tw2": "2px", "--tw3": "3px", "--tw4": "4px", "--tw5": "5px", "--after": "2px" }),
      less: () => forms["@primary-color"] === "#1890ff" && forms["@font"] === "" && forms["@link-color"] === "@primary-color" && !("@media" in forms) && !("@import" in forms),
      parentheses: () => js(Object.keys(forms).filter((k) => k[0] !== "@")) === js(["$a", "$map", "$border", "$hover-background", "$local", "--note", "--btn-pad", "$z", "$quoted", "$last"]) &&
        forms.$border === "1px solid #ccc" && forms["$hover-background"] === "#eee" && forms.$map === "" && forms["--btn-pad"] === "4px 8px" && forms.$local === "4px" && forms.$z === "10",
      settle: () => forms.$quoted === "" && forms.$last === "" && js(leaked) === js([]),
      names: () => js(tokensOf(w)) === js({ "--a1b2c3d4e5": "4px", "--mdc-outlined-text-field-disabled-outline-color": "4px", "--gray-900": "#111", "--space-2xl": "4rem" }),
    });
  }

  // --- JSON: a key that is printed is words; what says a file is a design file -------------------------------------------------------------
  {
    const GUID = "3f2504e0-FAKE-11d3-9a0c-0305e82c3301", JWT = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9FAKEFAKEFAKEFAKE";
    const notDesign = {
      "json.net": { $type: "System.Collections.Generic.Dictionary`2[[System.String],[App.Entry, App]], mscorlib", [GUID]: { $type: "App.Entry, App", Expires: 1700000000, Uses: 3 } },
      "a discriminator": { $type: "App.Settings, App", fakeretries: 3, faketimeout: 30 },
      "byte[]": { fakekey: { $type: "System.Byte[], mscorlib", $value: "RkFLRWJ5dGVz" } },
      "generic type": { fakemetric: { type: "time", value: 1700000000 }, fakesize: { type: "size", value: 12 }, fakecount: { type: "number", value: 3 } },
      "a channel": { fakechannel: "#feed", n: 1 }, "a placeholder": { fakegreeting: "{name}", n: 1 }, "a quarter": { fakeperiod: "1Q", n: 2 },
    };
    const refused = Object.entries(notDesign).map(([k, doc], i) => { const p = project("not-design-" + i); write(p, "tokens.json", js(doc)); const r = S.designSystemReport(p); return k + ":" + r.found.sources.length + ":" + /fake|FAKE/.test(js(r)); });
    // a file that IS one (a colour): its keys that are no words are left out with what they hold
    const p = project("keys");
    write(p, "src/design-tokens.json", js({ color: { brand: "#1d4ed8", gray900: "#111", "2xl": "4rem", a11y: "#000", "8dp": "8px", "a11y-2xl": "3px" }, fontSize: { 0: "12px" },
      cache: { [JWT]: { exp: 1 } }, sessions: { [GUID]: { ttl: "60px" } }, keys: { xk_live_FAKE4eC39HqLyjWDarjtT1zd: "5px", ["FAKE".repeat(11)]: "2px", "5f4dcc3bFAKE5aa765d61d8327deb882cf99": "1px" },
      blob: { $type: "System.Byte[], mscorlib", $value: "RkFLRWJ5dGVz" }, font: { value: "Inter Display", type: "FontFamilies" }, glow: { $value: { hex: "FAKEhexSecret" }, $type: "color" },
      flag: "--FAKEflag", call: "FAKEsecretValue123()", guid: "{AB12CD34-FAKE-11D3}", single: "{brand}" }));
    const keys = S.designSystemReport(p);
    const listed = keys.newTokens.map((t) => t.name + "=" + t.value);
    const leaked = ["FAKE", "eyJ", "Inter Display"].filter((x) => js(keys).includes(x));
    // beneath a credential key: a literal that says design or a {reference.path} — never a wrapped identifier; each design
    // function says design by its name
    const FUNCTIONS = ["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color", "color-mix", "light-dark", "calc", "clamp", "cubic-bezier", "linear-gradient", "repeating-linear-gradient",
      "radial-gradient", "repeating-radial-gradient", "conic-gradient", "repeating-conic-gradient", "darken", "lighten", "tint", "shade", "mix"];
    const gp = project("guarded");
    write(gp, "src/design-tokens.json", js({ color: { brand: "#1d4ed8" }, github_token: "var(--FAKEwrapped)", db: { password: { ring: "{color.brand}", wrapped: "var(--FAKEprop)", word: "rem(16px)", single: "{FAKEsingle}", num: 42 } },
      secret: Object.fromEntries(FUNCTIONS.map((f, i) => ["f" + i, f + "(1 2 3)"])) }));
    const guarded = S.designSystemReport(gp);
    const under = guarded.newTokens.map((t) => t.name + "=" + t.value).filter((x) => !x.startsWith("secret."));
    const byName = guarded.newTokens.filter((t) => t.name.startsWith("secret.")).map((t) => t.value);
    all("1.35 review 7: a KEY that is printed is words — letters, digits, or the two with at most two switches between them (gray900, 2xl, a11y, 8dp), no word of 40 characters: a GUID, an API key, a hash and `Bearer <jwt>` (a blank exempted any length) are left out with what they hold, in a file that is a design file; and a file is one through no `$type` alone nor a `$value` beside a `$type` that is no token type (Json.NET's), no `value` beside a type any data holds (time, size, number), no 4-digit hex (`#feed`), no `{placeholder}` without a path, no `1Q`; a font of a `FontFamilies` type is listed by its name, a composite's `hex` only when it is a colour, `--x` alone / a named function with no argument / a braced GUID (a reference that is no words) are no values; beneath a credential key only a literal that says design or a {reference.path} is listed — never `var(--…)`, a function of the author's, a number —, and each design function says design by its name (got " +
      js({ refused, listed, leaked, sources: guarded.found.sources, under, byName: byName.length }) + ")", {
      notDesign: () => js(refused) === js(Object.keys(notDesign).map((k) => k + ":0:false")),
      keys: () => js(listed) === js(["color.brand=#1d4ed8", "color.gray900=#111", "color.2xl=4rem", "color.a11y=#000", "color.8dp=8px", "color.a11y-2xl=3px", "fontSize.0=12px", "font=", "glow=", "single={brand}"]),
      noLeak: () => js(leaked) === js([]),
      guarded: () => js(guarded.found.sources) === js(["src/design-tokens.json"]) && js(under) === js(["color.brand=#1d4ed8", "db.password.ring={color.brand}"]) && !/FAKE/.test(js(guarded)),
      functions: () => js(byName) === js(FUNCTIONS.map((f) => f + "(1 2 3)")),
    });
  }

  // --- values in a stylesheet ------------------------------------------------------------------------------------------------------------
  {
    const CSS_FUNCTIONS = ["env", "min", "max", "minmax", "repeat", "fit-content", "steps", "theme", "translate", "translateX", "translateY", "translateZ", "translate3d", "scale", "scaleX", "scaleY", "scaleZ", "scale3d",
      "rotate", "rotateX", "rotateY", "rotateZ", "rotate3d", "skewX", "skewY", "blur", "brightness", "contrast", "saturate", "drop-shadow"];
    const shown = Object.assign({ "$radius": "var(--#{$prefix}border-radius)", "$width": "theme(spacing.16)", "$header": "calc(theme(spacing.16) + 1px)", "$move": "opacity calc(1 + 2)", "$alpha": "#1d4ed880",
      "$long": "var(--mdc-outlined-text-field-disabled-outline-color)" }, Object.fromEntries(CSS_FUNCTIONS.map((f, i) => ["$css" + i, f + "(auto-fit)"])));
    const blank = { "$slash": "/", "$url": "URL(#abc)", "$call": "FAKEsecretValue123()", "$path": "fetch(api.example.com)",
      "$upper": "theme(Spacing.16)", "$words": "unquote(spacing.16)" };
    const p = project("values");
    write(p, "src/styles/_variables.scss", Object.entries(Object.assign({}, shown, blank)).map(([k, v]) => k + ": " + v + ";").join("\n") + "\n");
    const before = Object.fromEntries(S.designSystemReport(p).newTokens.map((t) => [t.name, t.value]));
    S.scaffoldSteeringFile(p, "design-system.md");
    const read = Object.fromEntries(registry(p).tokens.map((t) => [t.name, t.value]));
    const wrong = Object.keys(shown).filter((k) => read[k] !== shown[k]).concat(Object.keys(blank).filter((k) => read[k] !== ""));
    all("1.35 review 7: in a stylesheet a custom property's name may hold an interpolation (Bootstrap's `var(--#{$prefix}border-radius)`), a dotted path is an argument of a function CSS or Tailwind knows (`theme(spacing.16)`), a function anchors the words beside it, each function CSS knows may hold a word alone, an identifier may be long when it is words; `/` alone, `URL(…)` in any case, a named function with no argument, a dotted path in a function of the author's are no values (got " +
      js({ wrong: wrong.map((k) => k + "=" + js(read[k])), leaked: /FAKE/.test(rd(p, REG).replace(/\$\w+/g, "")) }) + ")", {
      values: () => js(wrong) === js([]) && before.$slash === "" && before.$radius === shown.$radius,
      noLeak: () => !/FAKE/.test(rd(p, REG).replace(/\$\w+/g, "")),
    });
  }

  // --- libraries: a note that names its library — surely, or only where a row cites one; an entry as it is named -------------------------
  // (review 8 on review 7: "derived from the entry" was asked of EVERY note, and a scoped package in one named nothing; a `-`
  // beside a name stopped citing it)
  {
    const p = project("libraries");
    write(p, "package.json", js({ dependencies: { antd: "^5.0.0", react: "^19.0.0", PrimeReact: "^10.0.0", "acme-ui": "^1.0.0", "@radix-ui/react-dialog": "^1.0.0" } }));
    write(p, REG, "# DS\n\n_Libraries: antd (PRO), lucide-react (SVG), Headless UI (react), Material UI (MUI), Material UI (INTERNAL), Material UI (M), Material UI (UI), Material UI (MX), Base UI (@acme/ui-kit), Ant Design (antd), Chakra (@chakra-ui/react), Prime (PrimeReact), Lightning Design System (SLDS), Design System (acme-ui), Radix UI (Radix), Radix UI (@radix-ui), Material 3 (M3), antd (deprecated), antd (V5), antd (@jane)_\n");
    const reg = registry(p);
    const f = sized(p);
    const refused = ["Pro Table", "Svg Sprite", "React Select", "UI Kit", "MX Grid", "Table (xantd)", "SLDS Button", "Card (deprecated)", "Buton (V5)", "Buton (@jane)", "Button (SLDS"];
    const approved = ["Button (PRO)", "Select (react)", "Button (SLDS)", "Button [SLDS]", "Button — SLDS", "SLDS: Button", "Button (acme-ui)", "acme-ui Button", "Dialog (Radix)", "Radix Dialog", "Field (MUI)", "MUI DataGrid", "Field (@mui/material)", "Dialog (@acme/ui-kit)", "Dialog (@radix-ui/react-dialog)",
      "Table (antd/es/table)", "Table (antd@5)", "Table (antd-style)", "Button (M3)"];
    const verdicts = refused.concat(approved).map((r) => f.approve(["| Reuse | " + r + " | the list |"]));
    // an entry as it is NAMED: a link's text — unwrapped before its note —, no version WRITTEN as one; a bare number stays, and
    // the name without it is cited only in a parenthesis
    const entries = ["antd v5", "antd@5", "antd@^5.2.0", "antd v5+", "[antd](https://ant.design)", "[Material UI (MUI)](https://mui.com)", "[MUI](https://mui.com) (@mui/material)", "Material UI 6", "Material 3", "primereact"]
      .map((l) => { write(p, REG, "# DS\n\n_Libraries: " + l + "_\n"); const r = registry(p); return r.libraries.join("+") + ":" + r.packaged; });
    write(p, REG, "# DS\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Card | `src/ui/Card.tsx` |  |  |\n\n_Libraries: Material 3, Carbon 11, Radix, Bootstrap, MUI_\n");
    const worded = ["Material Picker", "Raw Material Table", "Button (Material)", "Button (Carbon)", "Dialog (radix-ui)", "Modal (react-bootstrap)", "DataGrid (MUI-X)", "MUI-based table"].map((r) => f.approve(["| Reuse | " + r + " | the list |"]));
    write(p, REG, "# DS\n\n_Libraries: Alpha Kit, Beta Kit, Gamma Kit, Delta Kit_\n");
    const msg = f.check();
    // a library-only registry whose library is named by a scoped package in a NOTE is checked like any other
    write(p, REG, "# DS\n\n_Libraries: Internal kit (@acme/ui)_\n");
    const only = [registry(p).packaged, f.approve(["| Reuse | Buton | a typo |"]), f.approve(["| Reuse | Button (@acme/ui) | the action |"])];
    // a manifest longer than its read is none: its dependencies lie past the bound
    const big = project("manifest");
    write(big, "package.json", js({ description: "x".repeat(300000), dependencies: { antd: "^5.0.0" } }));
    write(big, REG, "# DS\n\n_Libraries: antd_\n");
    all("1.35 review 7 / 8: a library's note names it too — SURELY when it is a scoped package or a scope (`Base UI (@acme/ui-kit)`, `Radix UI (@radix-ui)`: never a remark, whatever the entry is called), its acronym in order from its first letter (`Material UI (MUI)`, `Material 3 (M3)`) or a dependency that holds one of its words (`Ant Design (antd)`, `Prime (PrimeReact)`); a short name made of its own words (`Radix UI (Radix)`) or a dependency that is no framework (`Design System (acme-ui)`); only where a row CITES one — in a parenthesis or brackets, after a dash, before a colon — for any other acronym and for a framework (`antd (PRO)`, `Lightning Design System (SLDS)`, `Headless UI (react)`) — `Button (SLDS)`, `Button [SLDS]`, `Button — SLDS`, `SLDS: Button` and `Button (PRO)` cite, `Pro Table`, `React Select`, `UI Kit` and `SLDS Button` do not —; never a remark (`(deprecated)`, 8 capitals, one letter, a version `(V5)`, a scope no dependency lives under `(@jane)`). A library is cited as a whole word, a `-` / `/` / `@` beside it being a word's end: `antd/es/table`, `antd@5`, `antd-style`, `@mui/material` for MUI, `radix-ui`, `react-bootstrap`, `MUI-X` — never `xantd`. An entry is named without a version written as one (`antd v5`, `antd@^5.2.0`, `v5+`) or its link, unwrapped before its note; a bare number stays (`Material 3` never makes \"Material Picker\" a library's) and the name without it is cited in a parenthesis (`Button (Carbon)`); a dependency in any case; the empty-registry warning names the first three libraries it did not recognise; a library-only registry named by a scoped note is checked; a package.json longer than its read gives no dependency (got " +
      js({ libraries: reg.libraries, weak: [...reg.weakLibraries], verdicts, entries, worded, only, msg: msg && msg.detail.slice(0, 200), big: registry(big).packaged }) + ")", {
      libraries: () => js(reg.libraries) === js(["antd", "PRO", "lucide-react", "SVG", "Headless UI", "react", "Material UI", "MUI", "UI", "MX", "Base UI", "@acme/ui-kit", "Ant Design", "Chakra", "@chakra-ui/react", "Prime", "PrimeReact",
        "Lightning Design System", "SLDS", "Design System", "acme-ui", "Radix UI", "Radix", "@radix-ui", "Material 3", "Material", "M3"]),
      weak: () => js([...reg.weakLibraries].sort()) === js(["material", "mx", "pro", "react", "slds", "svg", "ui"]),
      gate: () => js(verdicts) === js(refused.map(() => "refused:ui-design-system").concat(approved.map(() => "approved"))),
      entries: () => js(entries) === js(["antd:true", "antd:true", "antd:true", "antd:true", "antd:true", "Material UI+MUI:false", "MUI+@mui/material:true", "Material UI 6+Material UI:false", "Material 3+Material:false", "primereact:true"]),
      worded: () => js(worded) === js(["refused:ui-design-system", "refused:ui-design-system", "approved", "approved", "approved", "approved", "approved", "approved"]),
      message: () => msg.status === "warn" && msg.detail.includes("(Alpha Kit, Beta Kit, Gamma Kit)") && !msg.detail.includes("Delta"),
      only: () => js(only) === js([true, "refused:ui-design-system", "approved"]),
      manifest: () => registry(big).packaged === false,
    });
  }

  // --- names that read back: the seed is in sync with itself -----------------------------------------------------------------------------
  {
    const p = project("round-trip");
    write(p, "src/design-tokens.json", js({ color: { brand: "#1d4ed8" }, _palette: { red: "#f00" }, tbd: "#111", "a*": "#222", "<e>": "#333", "a|b": "#444", "`tick`": "#555" }));
    write(p, "src/a,b/tokens.css", ":root { --comma: 1px; }\n");
    write(p, "src/styles/tokens.css", ":root { --_private: 2px; }\n");
    const seeded = S.scaffoldSteeringFile(p, "design-system.md");
    const rep = S.designSystemReport(p);
    const reg = registry(p);
    all("1.35 review 7: what the seed writes reads back — a token whose name the registry's reader cleans (`_palette.red`, `a*`, `<e>`, a backtick) is compared as the reader gives it, one it gives back as nothing (`tbd`) is no row, a `|` escaped in a row is the name's own again, a token file whose path holds a comma is left out of `_Token sources:_` and never asked for: the seeded registry is in sync (got " +
      js({ seeded: seeded.seeded, inSync: rep.inSync, newTokens: rep.newTokens, newSources: rep.newSources, sources: reg.sources, names: reg.tokens.map((t) => t.name) }) + ")", {
      inSync: () => rep.inSync === true && js(rep.newTokens) === js([]) && js(rep.newSources) === js([]),
      names: () => reg.tokens.some((t) => t.name === "a|b") && !reg.tokens.some((t) => /tbd/i.test(t.name)) && reg.tokens.some((t) => t.name === "--comma"),
      sources: () => js(reg.sources) === js(["src/design-tokens.json", "src/styles/tokens.css"]),
    });
  }
};
