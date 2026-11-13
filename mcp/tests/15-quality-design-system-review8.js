"use strict";
// The design-system registry (1.35) — review 8's findings, most of them made by review 7's fixes: the router is Next's and
// its root may lie under a group or a dynamic segment; a twin or a vendored sheet is no source of its own; a block's scope is
// decided once (nested at-rules were quadratic); a stylesheet's own identifiers are its author's (hex-named variables were
// dropped); a `$type` of one word is a token tool's; `@use … with (…)`, Less mixins, braces in a quoted string; a component
// called Pending. (The library notes and the global-sheet rules of review 8 are in -review7.js, beside what they corrected.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, approveBefore, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const COMP = "export default () => null;\n";
  const NEXT = js({ dependencies: { next: "15.0.0" } });
  const PROPS = (n, prefix, sel) => (sel || ":root") + " {\n" + Array.from({ length: n }, (_, i) => "  --" + (prefix || "c") + i + ": " + i + "px;").join("\n") + "\n}\n";
  const project = (tag) => { const p = path.join(tmp, "proj-ds8-" + tag); S.initProject(p, ["ui"], "en"); return p; };
  const registry = (p) => E.designSystemRegistry(path.join(p, ".specs"));
  const tokensOf = (p) => Object.fromEntries(S.designSystemReport(p).newTokens.map((t) => [t.name, t.value]));
  // a project of files (a package.json: its text; any other: a component) → the components the seed lists
  let seq = 0;
  const seeded = (files) => {
    const p = project("routes-" + seq++);
    for (const [rel, text] of Object.entries(files)) write(p, rel, text == null ? COMP : text);
    S.scaffoldSteeringFile(p, "design-system.md");
    const reg = registry(p);
    return reg ? reg.components.map((c) => c.name + " <" + c.path + ">") : [];
  };
  const files = (list, pkg) => Object.fromEntries(list.map((f) => [f, f.endsWith("package.json") ? (pkg || NEXT) : null]));
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
  const sized = (p) => {
    const f = S.createFeature(p, { name: "Sign Up", tracks: ["ui"], summary: "x", size: "m" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(["| Reuse | Placeholder | x |"]));
    approveBefore(p, f.slug, "design");
    return (rows) => { fs.writeFileSync(path.join(f.dir, "design.md"), design(rows)); const a = S.approvePhase(p, f.slug, "design", "t"); return a.ok ? "approved" : "refused:" + (a.failing || []).join(","); };
  };
  const feature = (p, name, where) => {
    const f = S.createFeature(p, { name, tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Implements: " + where + "_\n");
    return f;
  };

  // --- the router: Next's, its root under a group or a dynamic segment, its slots ------------------------------------------------------
  {
    const got = {
      group: seeded(files(["package.json", "app/(app)/layout.tsx", "app/(app)/page.tsx", "app/(app)/components/page.tsx", "app/(app)/components/loading.tsx", "app/(app)/components/error.tsx", "components/ui/button.tsx"])),
      intl: seeded(files(["package.json", "src/app/[locale]/layout.ts", "src/app/[locale]/page.tsx", "src/app/[locale]/components/page.tsx", "src/app/[locale]/components/loading.tsx", "components/ui/button.tsx"])),
      slots: seeded(files(["package.json", "app/layout.jsx", "app/ui/layout.tsx", "app/ui/page.tsx", "app/ui/@modal/default.tsx", "app/ui/@side/default.tsx", "app/ui/@side/(x)/[id]/loading.tsx", "components/card.tsx"])),
      noNext: seeded(files(["package.json", "app/layout.tsx", "app/ui/layout.tsx", "app/ui/page.tsx", "app/ui/@side/default.tsx", "components/card.tsx"], js({ dependencies: { react: "19.0.0" } }))),
      spa: seeded(files(["package.json", "src/app/layout.tsx", "src/app/components/page.tsx", "src/app/components/loading.tsx", "src/app/components/sidebar.tsx"], js({ devDependencies: { vite: "6.0.0" } }))),
      workspace: seeded(files(["apps/web/package.json", "apps/web/app/layout.tsx", "apps/web/app/components/page.tsx", "apps/web/app/components/loading.tsx", "packages/ui/src/components/loading.tsx"])),
      under: seeded(files(["package.json", "src/ui/app/layout.tsx", "src/ui/app/page.tsx", "src/ui/app/loading.tsx", "src/ui/Button.tsx"])),
      webapp: seeded(files(["package.json", "webapp/layout.tsx", "webapp/components/page.tsx", "webapp/components/loading.tsx"])),
      private: seeded(files(["package.json", "app/layout.tsx", "app/page.tsx", "app/_lib/components/x/page.tsx", "app/_lib/components/x/loading.tsx"])),
      plain: seeded(files(["package.json", "app/layout.tsx", "app/page.tsx", "app/kit/widgets/loading.tsx", "app/kit/widgets/@x/error.tsx"])),
    };
    all("1.35 review 8: an app router is Next's — a root counts when a package.json at or above it, inside the project, depends on next (a monorepo's apps/web/package.json; never a single-page app that keeps `src/app/layout.tsx` beside `src/app/components/{page,loading}.tsx`, nor the same files without next) —, and its root is the `app/` holding the top-most layout.* (.tsx / .jsx / .ts) through route groups and dynamic segments (`app/(app)/layout.tsx`, next-intl's `src/app/[locale]/layout.ts`; `webapp/` is no `app/`); under a segment a parallel slot, a group or a dynamic folder is routing with no page of its own (`app/ui/@modal/default.tsx`), a folder with none above it is not; a private `_lib/` cuts routing for all it holds; a router under a component folder still makes its files pages (got " + js(got) + ")", {
      group: () => js(got.group) === js(["Button <components/ui/button.tsx>"]),
      intl: () => js(got.intl) === js(["Button <components/ui/button.tsx>"]),
      slots: () => js(got.slots) === js(["Card <components/card.tsx>"]),
      noNext: () => js(got.noNext) === js(["Card <components/card.tsx>", "Default <app/ui/@side/default.tsx>", "Layout <app/ui/layout.tsx>", "Page <app/ui/page.tsx>"]),
      spa: () => js(got.spa) === js(["Loading <src/app/components/loading.tsx>", "Page <src/app/components/page.tsx>", "Sidebar <src/app/components/sidebar.tsx>"]),
      workspace: () => js(got.workspace) === js(["Loading <packages/ui/src/components/loading.tsx>"]),
      under: () => js(got.under) === js(["Button <src/ui/Button.tsx>"]),
      webapp: () => js(got.webapp) === js(["Loading <webapp/components/loading.tsx>", "Page <webapp/components/page.tsx>"]),
      private: () => js(got.private) === js(["Loading <app/_lib/components/x/loading.tsx>", "Page <app/_lib/components/x/page.tsx>"]),
      plain: () => js(got.plain) === js(["Error <app/kit/widgets/@x/error.tsx>", "Loading <app/kit/widgets/loading.tsx>"]),
    });
  }

  // --- a source brings a name of its own: twins, vendored and per-theme sheets, a component's `:host` ------------------------------------
  {
    const p = project("twins");
    write(p, "css/main.css", PROPS(6, "m"));
    write(p, "css/main.min.css", ":root{" + Array.from({ length: 6 }, (_, i) => "--m" + i + ":" + i + "px").join(";") + "}\n");
    for (const f of ["bootstrap.css", "bootstrap.min.css", "bootstrap.rtl.css", "bootstrap-grid.css", "bootstrap-utilities.css"]) write(p, "static/bootstrap/css/" + f, PROPS(8, "bs-"));
    for (let i = 0; i < 25; i++) write(p, "src/themes/t" + i + ".css", PROPS(6, "th", ":root[data-theme=\"t" + i + "\"]"));
    write(p, "src/styles/base.css", PROPS(5, "base"));
    S.scaffoldSteeringFile(p, "design-system.md");
    const twins = S.designSystemReport(p);
    // an Angular app: its components declare on `:host`, in sheets named for them
    const a = project("angular");
    write(a, "src/styles.scss", PROPS(6, "app"));
    for (let i = 0; i < 24; i++) write(a, "src/app/c" + i + "/c" + i + ".component.scss", ":host {\n  --card-padding: 16px; --card-radius: 8px; --card-bg: #ffffff; --card-fg: #111111; --card-gap: 4px; --card-line: 1px;\n  display: block;\n}\n.title { font-size: 19px; color: #3f51b5; }\n");
    write(a, "src/app/c0/c0.component.ts", "export class C0Component {}\n");
    S.scaffoldSteeringFile(a, "design-system.md");
    const ng = S.designSystemReport(a);
    const raw = S.designSystemReport(a, { name: feature(a, "Card", "src/app/c0/").slug }).total;
    all("1.35 review 8: a global stylesheet is a source only when it brings a token NAME no earlier source holds — a built `main.min.css` beside `main.css` takes no place —, and a candidate by its name: a vendored Bootstrap's dist files, 25 per-theme sheets and an Angular app's 24 `x.component.scss` (each `:host { six custom properties }`) are none — the 20 sources are not filled, no bound is said, the seed is in sync, and the feature's raw values in a component's sheet are read (got " +
      js({ twins: [twins.found.sources, twins.limits, twins.inSync], ng: [ng.found.sources, ng.found.tokens, ng.limits, ng.inSync], raw }) + ")", {
      twins: () => js(twins.found.sources) === js(["css/main.css", "src/styles/base.css"]) && js(twins.limits) === js([]) && twins.inSync === true,
      angular: () => js(ng.found.sources) === js(["src/styles.scss"]) && ng.found.tokens === 6 && js(ng.limits) === js([]) && ng.inSync === true,
      raw: () => raw === 4,
    });
  }

  // --- a block's scope is decided once: nested at-rules, linear ---------------------------------------------------------------------------
  {
    const body = (open) => open.repeat(20000) + "--a:1px;--b:1px;--c:1px;--d:1px;--e:1px;".repeat(3000);
    const cases = { "src/styles/globals.css": body("@m{"), "src/styles/_variables.scss": body("@m{"), "src/styles/variables.less": body("@m{"), "src/styles/main.css": ":root{" + body("@media x{") };
    const timed = Object.entries(cases).map(([rel, text], i) => {
      const p = project("nested-" + i);
      write(p, rel, text);
      const t = remeasure(() => { const t0 = Date.now(); const r = S.designSystemReport(p); return { ms: Date.now() - t0, tokens: r.found.tokens }; }, (s) => s.ms < 1500);
      return t.ms < 1500 && t.tokens === 5;
    });
    // …and it is the block's own answer a declaration reads: a property right inside an at-rule inside :root is page-wide,
    // one inside an at-rule at the top is not
    const q = project("at-rule-scope");
    write(q, "src/a/main.css", ":root {\n  @supports (color: red) {\n" + Array.from({ length: 5 }, (_, i) => "    --in" + i + ": 1px;").join("\n") + "\n  }\n}\n");
    write(q, "src/b/main.css", "@supports (color: red) {\n" + Array.from({ length: 5 }, (_, i) => "  --out" + i + ": 1px;").join("\n") + "\n}\n");
    const scope = S.designSystemReport(q).found.sources;
    all("1.35 review 8: whether a block declares for the whole page is decided ONCE, when it opens — 20,000 nested at-rules before 15,000 declarations took 16 s when every declaration walked the open blocks outward (a globals.css, a _variables.scss, a variables.less, a main.css under :root) —, an at-rule taking its parent's answer: a property right inside `@supports` inside :root is page-wide, one inside `@supports` at the top is not (got " + js({ timed, scope }) + ")", {
      linear: () => js(timed) === js([true, true, true, true]),
      scope: () => js(scope) === js(["src/a/main.css"]),
    });
  }

  // --- names: a stylesheet's are its author's; a JSON key is words, or a colour's own hex -------------------------------------------------
  {
    const p = project("hex-names");
    write(p, "src/styles/_variables.scss", ["$color-f5f5f5: #f5f5f5;", "$bg: $color-f5f5f5;", "$grey-e8e8e8: #e8e8e8;", "$border: 1px solid $grey-e8e8e8;", "$c-1d4ed8: #1d4ed8;", "$ok: darken($c-1d4ed8, 10%);",
      "$w: pxToRem2x4y(16px);", ":root { --h1h2-gap: 2px; --w1280h720: 4px; --v1beta2-pad: var(--h1h2-gap); --grey10Alpha90: #1a1a1ae6; }"].join("\n") + "\n");
    write(p, "src/design-tokens.json", js({ color: { base: { "0d6efd": "#0d6efd", E5E5E5: "#e5e5e5", fff: "#ffffff", red: "{color.base.0d6efd}" }, w1280h720: "1px", grey10Alpha90: "#1a1a1ae6", "1a2b3c4d": "2px", ab12cd34ef: "3px", "1x2y3z": "4px" } }));
    const got = tokensOf(p);
    all("1.35 review 8: a stylesheet's own identifiers are its author's and are listed as written — `$color-f5f5f5`, `$grey-e8e8e8`, `--w1280h720`, `--grey10Alpha90` and every value that references one (`$bg: $color-f5f5f5`, `darken($c-1d4ed8, 10%)`, `var(--h1h2-gap)`, a function of the author's) —: review 7 asked them to be words and dropped half of a hex-named palette; a JSON key is asked to be, with a colour's own hex of 3 or 6 digits being a name (`0d6efd`, `E5E5E5`) and a reference to one a value — a key that switches letters and digits three times is still left out (`w1280h720`, `grey10Alpha90`, an 8- or 10-digit run, six characters that are no hex) (got " + js(got) + ")", {
      sheet: () => js(Object.keys(got).filter((k) => /^[$-]/.test(k)).map((k) => k + "=" + got[k])) === js(["$color-f5f5f5=#f5f5f5", "$bg=$color-f5f5f5", "$grey-e8e8e8=#e8e8e8", "$border=1px solid $grey-e8e8e8", "$c-1d4ed8=#1d4ed8",
        "$ok=darken($c-1d4ed8, 10%)", "$w=pxToRem2x4y(16px)", "--h1h2-gap=2px", "--w1280h720=4px", "--v1beta2-pad=var(--h1h2-gap)", "--grey10Alpha90=#1a1a1ae6"]),
      json: () => js(Object.keys(got).filter((k) => !/^[$-]/.test(k)).map((k) => k + "=" + got[k])) === js(["color.base.0d6efd=#0d6efd", "color.base.E5E5E5=#e5e5e5", "color.base.fff=#ffffff", "color.base.red={color.base.0d6efd}"]),
    });
  }

  // --- JSON: a `$type` of one word is a token tool's; `$`-keys are never walked -----------------------------------------------------------
  {
    const p = project("types");
    write(p, "src/a.tokens.json", js({ spacing: { xs: { $value: 4, $type: "float" }, note: { $value: "Body text", $type: "text" }, misc: { $value: "8", $type: "other" } } }));
    write(p, "src/b.tokens.json", js({ color: { brand: { $value: "#1d4ed8", $type: "color", $extensions: { "com.tool": { fakeinner: "#111111" } } } }, $extensions: { fakemeta: { shade: "#222222" } },
      blob: { $type: "System.Byte[], mscorlib", $value: "RkFLRWJ5dGVz" }, long: { $type: "x".repeat(40), $value: "#333333" } }));
    const generic = ["space", "asset", "duration", "size", "number", "time"].map((t, i) => { const g = project("generic-" + i); write(g, "tokens.json", js({ fakea: { type: t, value: 12 }, fakeb: { type: t, value: 3 } })); return S.designSystemReport(g).found.sources.length; });
    const rep = S.designSystemReport(p);
    const got = rep.newTokens.map((t) => t.name + "=" + t.value);
    all("1.35 review 8: a `$value` beside a `$type` of ONE word is a token of some tool, whichever word it is — Tokens Studio's `other` / `text`, a `float` export (review 7 asked for a type of its list: `spacing.xs = 4` was dropped and a float-only file no source) —, never beside a qualified name (`System.Byte[], mscorlib`) nor a 40-character one; a `$extensions` subtree is never walked; `value` beside a type any data holds — space, asset, duration, size, number, time — says nothing of what a file is (got " + js({ sources: rep.found.sources, got, generic }) + ")", {
      word: () => js(rep.found.sources) === js(["src/a.tokens.json", "src/b.tokens.json"]) && js(got) === js(["spacing.xs=4", "spacing.note=", "spacing.misc=8", "color.brand=#1d4ed8"]),
      noExtensions: () => !/fake/.test(js(rep)),
      generic: () => js(generic) === js([0, 0, 0, 0, 0, 0]),
    });
  }

  // --- a stylesheet's statements: `@use … with (…)`, Less, a quoted string, a stray parenthesis ---------------------------------------------
  {
    const p = project("statements");
    write(p, "src/styles/_variables.scss", ["@use \"sass:map\";", "@use \"bootstrap/scss/bootstrap\" with (", "  $primary: #7952b3,", "  $font-size-base: .9375rem,", "  $enable-shadows: true", ");",
      "@forward \"src/list\" with ($black: #222 !default, $radius: 4px);", "$after: 1px;", ".x { width: calc(", "    1px + 2px", "  ) }", "$closed: 2px;", "@forward \"src/more\" with (", "  $fwd: 1px", ");", ".z { width: calc(1px } $sameline: 7px;", ".w { width: fn(1px; .v { $inblock: 8px; } }",
      "$w: 1px) + fn(", "  $strayparam: 1px", ");", "$typo: fn(1px;", "$aftertypo: 2px;", "@use \"lib\"", "  with (", "  $split: 1px", ");"].join("\n") + "\n");
    write(p, "src/styles/variables.less", [".m(@a: 1px; @b: 2px; @c: 3px) {", "  width: @a;", "}", "@b: 9px;", ".btn {", "  .button-variant(", "    @color: #fff;", "    @background: #1890ff", "  );", "}",
      "@background: #eee;", "@icon-url: \"@{base}/icons\";", "@w: ~\"calc(100% - @{gutter})\";", "@page :first", "{", "  margin: 1in;", "}", "@end: 4px;"].join("\n") + "\n");
    write(p, "src/styles/tokens.css", [":root {", "  --q: \"{\";", "  --r: \"}\";", "  --s: \"a;b\";", "  --esc: \"a\\\"/*\";", "  // spacing (in px", "  --gap: 8px;", "  --pad: 4px;", "  /* first", "     it's here */ --late: 6px; /* x */ --later: 7px;", "}"].join("\n") + "\n");
    write(p, "src/styles/tokens.sass", "$map: (\n  sm: 576px,\n  $key: 1px\n$after-map: 3px\n$open: fn(\n$next: 5px\n$later: 6px\n");
    const got = tokensOf(p);
    const pick = (re) => Object.keys(got).filter((k) => re.test(k)).map((k) => k + "=" + got[k]);
    // …and a `globals.css` with a brace in a quoted string is still a source
    const g = project("quoted-brace");
    write(g, "src/app/main.css", ":root {\n  --q: \"\\\"}\";\n  --sq: '}';\n" + Array.from({ length: 5 }, (_, i) => "  --g" + i + ": 1px;").join("\n") + "\n}\n.card { --not: 1px; }\n");
    const brace = S.designSystemReport(g);
    all("1.35 review 8: the overrides of `@use … with (…)` / `@forward … with (…)` are listed by their names (review 7's \"inside parentheses\" dropped them), a declaration after a statement's closing `)` is read, and a `{` / `}` closes the count within a line; in Less a mixin's `;`-separated parameters never shadow the variable below (`.m(@a: 1px; @b: 2px)` then `@b: 9px`), over lines too, an `@{interpolation}` keeps its declaration whole and `@page :first` is an at-rule; a `{` `}` `;` or `/*` inside a quoted string is no delimiter, and a comment that begins on the line above may hold a quote; a stray `(` inside a line costs that line, never the next declaration, and one that ends a line costs the line it runs into — in an indented file too, where a map's keys over lines are no variables (got" + js({ got, brace: [brace.found.sources, brace.found.tokens] }) + ")", {
      config: () => js(pick(/^\$(?:primary|font-size-base|enable-shadows|black|radius|after|closed|fwd|sameline|inblock|strayparam|aftertypo|split)$/)) === js(["$primary=", "$font-size-base=", "$enable-shadows=", "$after=1px", "$closed=2px", "$fwd=", "$sameline=7px", "$inblock=8px", "$aftertypo=2px", "$split="]),
      less: () => js(pick(/^@/)) === js(["@b=9px", "@background=#eee", "@icon-url=", "@w=", "@end=4px"]),
      quoted: () => js(pick(/^--/)) === js(["--q=", "--r=", "--s=", "--esc=", "--gap=8px", "--pad=4px", "--late=6px", "--later=7px"]),
      sass: () => js(pick(/^\$(?:map|key|after-map|open|next|later)$/)) === js(["$map=", "$after-map=3px", "$open=", "$later=6px"]),
      brace: () => js(brace.found.sources) === js(["src/app/main.css"]) && brace.found.tokens === 7,
    });
  }

  // --- a component called Pending ---------------------------------------------------------------------------------------------------------
  {
    const p = project("pending");
    for (const f of ["Pending", "Button"]) write(p, "src/components/" + f + ".tsx", COMP);
    write(p, "src/components/todo.tsx", COMP);
    S.scaffoldSteeringFile(p, "design-system.md");
    const rep = S.designSystemReport(p);
    const approve = sized(p);
    const verdicts = [approve(["| Reuse | Pending | the waiting state |"]), approve(["| Reuse | TBD | to decide |", "| Reuse | Button | the action |"])];
    all("1.35 review 8: a NAME cell that only says \"pending\" is a name — a component called Pending is seeded, read back (the report is in sync) and a size m design reusing it is approved —, while a slot word (`TBD`, `[component]`) is still no row (got " + js({ names: registry(p).components.map((c) => c.name), inSync: rep.inSync, missing: rep.missing, verdicts }) + ")", {
      listed: () => registry(p).components.some((c) => c.name === "Pending") && rep.inSync === true && js(rep.missing) === js([]),
      gate: () => js(verdicts) === js(["approved", "approved"]),
    });
  }
};
