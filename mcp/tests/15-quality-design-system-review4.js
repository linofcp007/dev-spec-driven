"use strict";
// The design-system registry (1.35) — review 4's findings. THE one that matters: a value is read out of a token file only
// when it IS a design value by its shape (designValue) — no list of credential key names is complete, so nothing is shown by
// exclusion. Then: real design-token files that the content rule had thinned or refused, a folder `layout/` under
// components/, a `_Libraries:_` line saying "not yet" in any words, where theme.* counts, a self-closing <style />, the
// bounds that are said only when something was cut, withoutComments linear on a line of comments.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, approveBefore, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const MSG = require(path.join(__dirname, "lib", "i18n.js")).msg;
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const rd = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const long = (ch, n) => Array.from({ length: n + 1 }).join(ch);
  const REG = ".specs/steering/design-system.md";
  const HEAD = "| Component | Path | Variants | Notes |\n|---|---|---|---|\n";
  const COMP = "export default () => null;\n";
  const project = (tag) => { const p = path.join(tmp, "proj-ds4-" + tag); S.initProject(p, ["ui"], "en"); return p; };
  const registry = (p) => E.designSystemRegistry(path.join(p, ".specs"));
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
  // a size m feature whose design is written and ready for its approval
  const sized = (p, rows) => {
    const f = S.createFeature(p, { name: "Sign Up", tracks: ["ui"], summary: "x", size: "m" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(rows));
    approveBefore(p, f.slug, "design");
    return f;
  };
  const dsCheck = (p, slug) => (S.specDoctor(p, slug).checks || []).find((c) => c.id === "ui-design-system") || null;
  const feature = (p, name, files) => {
    const f = S.createFeature(p, { name, tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Implements: " + files + "_\n");
    return f;
  };
  const rawOf = (p, slug, dir) => S.designSystemReport(p, { name: slug }).raw.map((x) => x.file.replace(dir, "") + ":" + x.line + " " + x.value);

  // --- HIGH: only a value that IS a design value is read out of a token file ------------------------------------------------------------
  {
    const p = project("gate");
    const S40 = "ghp_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE1234"; // 40 characters: the length of a classic token
    const SECRETS = [S40, "wJalrFAKEnFEMI/K7MDENG/bPxRfiCYFAKEKEY00", "FAKE-hunter2", "FAKE-OAUTH1-SECRET", "FAKE-KEY-0001", "FAKE-PAT-0002", "Bearer FAKE-0003", "eyJFAKE.0004.sig",
      "FAKE-GH-0005", "FAKE-NESTED-0006", "FAKE-PARENT-0007", "FAKE-VALUE-0008", "FAKE-FONT-0009", "123456789", "987654321", "$uperFAKE0010", "@dminFAKE0011", "FAKE-LATE-0012",
      "FAKE-DEEP-0014", "pk.FAKE-MAPBOX-0015", "FAKEBAREWORD0016"];
    // credentials under names the scan reads — keys no list of credential names holds, a credential key as the PARENT, a plain
    // tokens.json with one design-looking value beside its secret
    write(p, "scripts/deploy.tokens.json", js({ github: S40, aws_secret_access_key: SECRETS[1], db_password: SECRETS[2], oauth_token_secret: SECRETS[3] }));
    write(p, "config/design-tokens.json", js({ key: SECRETS[4], pat: SECRETS[5], authorization: SECRETS[6], jwt: SECRETS[7] }));
    write(p, "tokens.json", js({ github_token: SECRETS[8], ttl: "3600s" }));
    write(p, "theme.json", js({ tokens: { github: SECRETS[9] }, password: { admin: SECRETS[10] } }));
    // files that ARE token files, each holding something that is none: a free string under `value`, a font stack under
    // `$value` (listed by its name alone), numbers under credential keys, a `$word` / `@word` (a variable's name only in a
    // stylesheet), a credential key past the first 1,000 leaves, one below the depth read
    write(p, "src/a.tokens.json", js({ service: { value: SECRETS[11] }, color: { brand: "#1d4ed8" } }));
    write(p, "src/b.tokens.json", js({ font: { sans: { $value: SECRETS[12] + " Sans, sans-serif" } }, space: { x: { $value: "4px" } } }));
    write(p, "src/c.tokens.json", js({ password: 123456789, api_key: 987654321, radius: "4px" }));
    write(p, "src/d.tokens.json", js({ note: SECRETS[15], at: SECRETS[16], gap: "8px" }));
    write(p, "src/e.tokens.json", js(Object.assign(Object.fromEntries(Array.from({ length: 1001 }, (_, i) => ["t" + i, i + "px"])), { zz_token: SECRETS[17] })));
    let deep = { deep_secret: SECRETS[18] };
    for (let i = 0; i < 10; i++) deep = { n: deep };
    write(p, "src/f.tokens.json", js({ n: deep, color: "#ffffff" }));
    write(p, "src/styles/_variables.scss", "$mapbox-token: \"" + SECRETS[19] + "\";\n$api-key: " + SECRETS[20] + ";\n$brand: #1d4ed8;\n$accent: $brand;\n");
    write(p, "src/components/Button.tsx", COMP);
    const rep = S.designSystemReport(p);
    const seeded = S.scaffoldSteeringFile(p, "design-system.md");
    const text = rd(p, REG);
    const after = S.designSystemReport(p);
    const out = js(rep) + text + js(after);
    const leaked = SECRETS.filter((s) => out.includes(s));
    const tokens = registry(p).tokens.map((t) => t.name + "=" + t.value);
    all("1.35 review 4: a value is read out of a token file only when it IS a design value — 21 fake secrets under token-file names (keys no credential list holds: github, pat, key, jwt; a 40-character run; a credential key as the parent; a free string under `value`; a number under `password`; a `$word`; a key past 1,000 leaves, one below the depth read; a Sass `$mapbox-token`) reach neither the report nor the seeded registry; a file with a credential key holding one is no source at all, a real token file beside its stray string still is; a `$value` of free text and a Sass variable are listed by their name alone (got " +
      js({ leaked, sources: rep.found.sources, tokens: tokens.filter((t) => !/^t\d+=/.test(t)), seeded: seeded.seeded, limits: rep.limits }) + ")", {
      noLeak: () => js(leaked) === js([]),
      sources: () => js(rep.found.sources) === js(["src/a.tokens.json", "src/b.tokens.json", "src/c.tokens.json", "src/d.tokens.json", "src/f.tokens.json", "src/styles/_variables.scss"]),
      tokens: () => js(tokens) === js(["color.brand=#1d4ed8", "font.sans=", "space.x=4px", "radius=4px", "gap=8px", "color=#ffffff", "$mapbox-token=", "$api-key=", "$brand=#1d4ed8", "$accent=$brand"]),
      synced: () => after.inSync === true && js(rep.limits) === js([]),
    });
  }
  {
    // what a design value is, through a stylesheet's declarations: shown, or listed by its name alone
    const p = project("values");
    const shown = { "--c1": "#fff", "--c2": "#1D4ED8cc", "--s1": "16px", "--s2": "-0.5rem", "--n1": "600", "--n2": "1.5", "--sh": "0 1px 2px rgba(0,0,0,.2), 0 0 0 1px #0001",
      "--b": "1px solid var(--line)", "--r": "calc(var(--radius) - 2px)", "--e": "cubic-bezier(.4,0,.2,1)", "--hsl": "222.2 84% 4.9%", "--t": "all .2s ease-in-out",
      "--a": "hsl(var(--h) 80% 50% / .5)", "--g": "linear-gradient(to right, #000 0%, #fff 100%)", "--k": "none", "--ref": "$brand", "--f": "clamp(1rem, 2vw + 1rem, 3rem)",
      // review 5: what a SCSS variable file is made of — arithmetic, an interpolation, any function, a property beside its time, newer units
      "--ar": "$spacer * .5", "--neg": "-$gutter", "--int": "calc(100vh - #{$header})", "--ip": "#{$prefix}", "--m": "map-get($spacers, 3)", "--md": "math.div($a, 2)",
      "--grid": "repeat(2, minmax(0, 1fr))", "--tr": "opacity .15s linear", "--bd": "1px solid tomato", "--dvh": "100dvh", "--cq": "50cqw", "--grp": "($a + $b) / 2" };
    const blank = { "--font": "\"Inter\", system-ui, sans-serif", "--img": "url(\"/img/x.png\")", "--arrow": "\"→\"", "--key": "pk.FAKE.abc123", "--x": "theme('colors.blue.500')", "--y": "var(--a)FAKEsecret", "--odd": "x\"y(1px)", "--z": "hunter two",
      "--z2": "wait please 5",
      "--u": "rgb(0, 0, 0", "--u2": "1px solid rgb(0, 0", "--q": "var(--x, \"secret\")", "--w": "anything goes here", "--l": long("9", 200) + "px", "--p": "rgb(0 0 0))" };
    write(p, "src/styles/tokens.scss", ":root {\n" + Object.entries(Object.assign({}, shown, blank)).map(([k, v]) => "  " + k + ": " + v + ";").join("\n") + "\n  --flag: 8px !important;\n}\n$flagged: 2px !default;\n");
    const rep = S.designSystemReport(p);
    S.scaffoldSteeringFile(p, "design-system.md");
    const read = Object.fromEntries(registry(p).tokens.map((t) => [t.name, t.value]));
    const wrong = Object.keys(shown).filter((k) => read[k] !== shown[k]).concat(Object.keys(blank).filter((k) => read[k] !== ""));
    if (read["--flag"] !== "8px" || read.$flagged !== "2px") wrong.push("--flag / $flagged"); // a Sass flag is no part of the value
    all("1.35 review 4 / 5: a design value is a colour, a number with or without a unit, a keyword, a variable, a function by its arguments — alone or as a list (a shadow, a border, an HSL triplet, a gradient), Sass arithmetic, an interpolation, a property beside its time; a font stack, a url(), a quoted string or argument, free words, text after a function's `)`, unbalanced parentheses and a 200-digit run are none: the token is listed by its name with no value (got " +
      js({ found: rep.found.tokens, wrong: wrong.map((k) => k + "=" + js(read[k])) }) + ")", {
      all: () => rep.found.tokens === Object.keys(shown).length + Object.keys(blank).length + 2,
      values: () => js(wrong) === js([]),
    });
  }
  {
    // real design-token JSON that review 3's content rule thinned or refused
    const p = project("real");
    const alias = "{semantic.color.background.interactive.primary.hover}"; // 53 characters
    write(p, "tokens.json", js({ global: { blue: { value: "#1d4ed8", type: "color" } }, button: { bg: { value: alias, type: "color" }, fg: { value: "{global.blue}", type: "color" } } }));
    write(p, "src/design/design-tokens.json", js({ color: { primary: { value: "#1d4ed8" } }, input: { password: { value: "{color.primary}" } }, primary: { token: "$color-primary", hex: "#1d4ed8" } }));
    write(p, "src/styles/tokens.json", js({ spacing: { sm: 4, md: 8 } })); // numbers only
    write(p, "src/theme/tokens.json", js({ background: "222.2 84% 4.9%", foreground: "210 40% 98%" })); // shadcn's bare HSL triplets
    write(p, "src/tokens/tokens.json", js({ space: { sm: { value: "8", type: "spacing" }, md: { value: "16", type: "spacing" } } })); // unitless strings
    const rep = S.designSystemReport(p);
    const got = rep.newTokens.map((t) => t.name + "=" + t.value);
    all("1.35 review 4: real token files are read whole — an alias past 40 characters (Tokens Studio), a `password` leaf holding a reference, a docs-style `token: \"$color-primary\"` beside its hex (the file is no credentials file), unitless strings in the `value` + `type` format; a JSON file of bare numbers or of percentages only shows nothing that says design and is not read — review 5, the price of never printing a secret used as a KEY (got " + js({ sources: rep.found.sources, got }) + ")", {
      sources: () => js(rep.found.sources) === js(["src/design/design-tokens.json", "src/tokens/tokens.json", "tokens.json"]),
      tokens: () => js(got) === js(["color.primary=#1d4ed8", "input.password={color.primary}", "primary.hex=#1d4ed8", "space.sm=8", "space.md=16", "global.blue=#1d4ed8", "button.bg=" + alias,
        "button.fg={global.blue}"]),
    });
  }

  // --- a folder under components/ named like a framework's special file holds the component of that name ----------------------------------
  {
    const p = project("index");
    for (const f of ["button", "layout", "loading", "error", "data-table", "modal", "theme", "page", "template"]) write(p, "src/components/" + f + "/index.tsx", COMP);
    for (const f of ["config", "utils", "hooks"]) write(p, "src/components/" + f + "/index.tsx", COMP); // a helper's, a barrel's: none
    const seeded = S.scaffoldSteeringFile(p, "design-system.md");
    const names = registry(p).components.map((c) => c.name);
    const f = sized(p, ["| Reuse | Layout | the page frame |", "| Reuse | Button | the submit action |"]);
    const approved = S.approvePhase(p, f.slug, "design", "t");
    all("1.35 review 4: `components/layout/index.tsx`, `loading/`, `error/`, `theme/`, `page/` and `template/` are the components Layout, Loading, Error, Theme, Page and Template (only a helper's or a barrel's index is none) — a size m design reusing Layout is approved against the seeded registry (got " +
      js({ seeded: seeded.seeded, names, approved: [approved.ok, approved.failing] }) + ")", {
      components: () => js(names) === js(["Button", "DataTable", "Error", "Layout", "Loading", "Modal", "Page", "Template", "Theme"]),
      approved: () => approved.ok === true,
    });
  }

  // --- a `_Libraries:_` line alone makes no row unknown ----------------------------------------------------------------------------------------
  {
    const p = project("empty");
    const f = sized(p, ["| Reuse | Button | the submit action |"]);
    const lines = ["_Libraries: not yet_", "_Libraries: não aplicável_", "_Libraries: custom components only_", "_Libraries: to be decided_", "_Libraries: por definir_", "_Libraries: Material UI_"];
    const states = lines.map((l) => { write(p, REG, "# DS\n\n" + l + "\n"); const c = dsCheck(p, f.slug); return c.status + (/lists no component yet/.test(c.detail) ? ":empty" : ""); });
    const approved = S.approvePhase(p, f.slug, "design", "t");
    // …while a design that DOES build on a declared library is checked row by row
    const q = project("library-only");
    write(q, REG, "# DS\n\n_Libraries: @mui/material_\n");
    const g = sized(q, ["| Reuse | TextField (@mui/material) | the e-mail field |", "| Reuse | Buton | the submit action |"]);
    const strict = dsCheck(q, g.slug);
    const refused = S.approvePhase(q, g.slug, "design", "t");
    fs.writeFileSync(path.join(g.dir, "design.md"), design(["| Reuse | TextField (@mui/material) | the e-mail field |"]));
    const ok = S.approvePhase(q, g.slug, "design", "t");
    // the markers' own edges: the label alone italic, a note beside a source, a source named like a none-word
    write(p, REG, "# DS\n\n_Libraries:_ Material UI, MUI (v6)\n_Token sources: todo.css, no.css, No Name/tokens.css, src/shop/colors.scss (generated from Figma), none yet_\n");
    const reg = registry(p);
    all("1.35 review 4: a registry that lists no component has nothing to agree with unless the design cites a library it declares — `_Libraries: not yet_`, `não aplicável`, `custom components only`, `to be decided`, `por definir`, or a real library the design does not use, leave a size m design with the empty-registry warning (approved); a design citing the declared library is checked row by row (an unknown row beside it is refused). Markers: `_Libraries:_ Material UI` (the label alone italic) names it, a parenthesis beside a source is a note, `todo.css` and `No Name/tokens.css` are files, `none yet` is none (got " +
      js({ states, approved: [approved.ok, approved.failing], strict: [strict.status, strict.detail.slice(0, 110)], refused: [refused.ok, refused.failing], ok: ok.ok, libraries: reg.libraries, sources: reg.sources }) + ")", {
      empty: () => js(states) === js(["warn:empty", "warn:empty", "warn:empty", "warn:empty", "warn:empty", "warn:empty"]) && approved.ok === true,
      strict: () => strict.status === "fail" && /'Buton' is not in the registry/.test(strict.detail) && !/TextField/.test(strict.detail) && refused.ok === false && ok.ok === true,
      libraries: () => js(reg.libraries) === js(["Material UI", "MUI"]),
      sources: () => js(reg.sources) === js(["todo.css", "no.css", "No Name/tokens.css", "src/shop/colors.scss"]),
    });
  }

  // --- where theme.* counts -----------------------------------------------------------------------------------------------------------------
  {
    const p = project("theme");
    write(p, "wp-content/themes/acme/theme.json", js({ version: 3, settings: { layout: { contentSize: "650px", wideSize: "1200px" }, spacing: { blockGap: "1.5rem" } } }));
    for (const f of ["constants/theme.ts", "src/constants/theme.ts", "src/config/theme.ts", "apps/web/theme.ts", "frontend/theme.js", "src/shared/theme.ts"]) write(p, f, "export default {};\n");
    for (const f of ["src/store/theme.ts", "server/models/theme.js", "src/redux/slices/theme.ts", "ui/lib/tokens.ts", "apps/web/src/tokens.ts"]) write(p, f, "export default {};\n");
    const rep = S.designSystemReport(p);
    all("1.35 review 4: theme.* counts anywhere but in a folder that holds something else by that name — a WordPress theme inside a site (wp-content/themes/acme/theme.json: its values read), Expo's constants/theme.ts, src/config/theme.ts, apps/web/theme.ts; never src/store/theme.ts, server/models/theme.js, a redux slice; a plain tokens.ts stays narrow (never ui/lib/tokens.ts, apps/web/src/tokens.ts) (got " +
      js({ sources: rep.found.sources, tokens: rep.newTokens.map((t) => t.name + "=" + t.value) }) + ")", {
      sources: () => js(rep.found.sources) === js(["wp-content/themes/acme/theme.json", "apps/web/theme.ts", "constants/theme.ts", "frontend/theme.js", "src/config/theme.ts", "src/constants/theme.ts", "src/shared/theme.ts"]),
      values: () => js(rep.newTokens.map((t) => t.name + "=" + t.value)) === js(["version=3", "settings.layout.contentSize=650px", "settings.layout.wideSize=1200px", "settings.spacing.blockGap=1.5rem"]),
    });
  }

  // --- raw values: a self-closing <style />, a "<style>" string, an arrow in the opening tag; props that merely end in -to -------------------
  {
    const p = project("raw");
    write(p, REG, "# DS\n\n_Token sources: src/shop/colors.scss (generated from Figma)_\n\n| Token | Value | Use |\n|---|---|---|\n| --brand | #1d4ed8 | brand |\n");
    const f = feature(p, "Shop", "src/shop/");
    write(p, "src/shop/SelfClosing.tsx", ["export const Head = () => (", "  <head>", "    <style dangerouslySetInnerHTML={{ __html: css }} />", "    <style", "      dangerouslySetInnerHTML={{ __html: more }}", "    />",
      "  </head>", ");", "export const Body = () => <body className=\"bg-[#123456] p-[13px]\"><Banner tone=\"#abcdef\" /></body>;", ""].join("\n"));
    // (an arrow before the `/>`: the tag's end is not the arrow's `>`)
    write(p, "src/shop/ArrowClosed.tsx", ["export const H = () => <style onLoad={() => go()} />;", "export const B = () => <b className=\"text-[#654321]\" />;", ""].join("\n"));
    write(p, "src/shop/Strings.tsx", ["const BAD = [\"<script>\", \"<style>\"];", "export const X = () => <b className=\"text-[#333333]\" />;", ""].join("\n"));
    write(p, "src/shop/Arrow.jsx", ["export const A = () => (", "  <div>", "    <style onLoad={() => go()} jsx>{`", "      .a { margin: 13px; }", "    `}</style>", "    <i className=\"text-[#00ff00]\" />", "  </div>", ");", ""].join("\n"));
    write(p, "src/shop/Props.vue", ["<template>", "  <Gradient gradient-from=\"#000000\" gradient-to=\"#9333ea\" :to=\"'#add'\" />", "</template>", "<script setup>",
      "picker.select(\"#1d4ed8\"); palette.find(\"#ffffff\"); tween.to(\"#00ffaa\", 300); d3.select(\"#fade\");", "</script>", ""].join("\n"));
    write(p, "src/shop/colors.scss", "$brand: #1d4ed8;\n.x { color: #1d4ed8; }\n"); // a token source declared with a note: its own values are no raw values
    const got = rawOf(p, f.slug, "src/shop/");
    all("1.35 review 4: raw values — a self-closing `<style … />` (on one line or over three) holds no block, a \"<style>\" string opens none and an arrow in the opening tag does not end it: the rest of each file is still read; `gradient-to=\"#9333ea\"` is a colour like `gradient-from` (only data- / aria- / hx- prefixes and namespaces make a reference), and so is a 6-digit hex passed to .select() / .find() / .to() — a 3 / 4-digit one there is a selector; a token source declared with a note is no view file (got " + js(got) + ")", {
      selfClosing: () => js(got.filter((x) => x.startsWith("SelfClosing"))) === js(["SelfClosing.tsx:9 #123456", "SelfClosing.tsx:9 #abcdef", "SelfClosing.tsx:9 p-[13px]"]),
      string: () => js(got.filter((x) => x.startsWith("Strings"))) === js(["Strings.tsx:2 #333333"]),
      arrow: () => js(got.filter((x) => x.startsWith("Arrow"))) === js(["Arrow.jsx:4 margin: 13px", "Arrow.jsx:6 #00ff00", "ArrowClosed.tsx:2 #654321"]),
      props: () => js(got.filter((x) => x.startsWith("Props"))) === js(["Props.vue:2 #000000", "Props.vue:2 #9333ea", "Props.vue:5 #1d4ed8", "Props.vue:5 #ffffff", "Props.vue:5 #00ffaa"]),
      source: () => !got.some((x) => x.startsWith("colors")),
    });
  }

  // --- a bound is said when something was cut — and only then ----------------------------------------------------------------------------------
  {
    const PROPS = (n, prefix) => ":root {\n" + Array.from({ length: n }, (_, i) => "  --" + (prefix || "c") + i + ": " + i + "px;").join("\n") + "\n}\n";
    // candidates that turn out to be no token file take no source's place: 24 app stylesheets with no custom property are read
    // before the one that holds the tokens (it lies deeper)
    const p = project("bounds");
    for (let i = 0; i < 24; i++) write(p, "apps/a" + String(i).padStart(2, "0") + "/src/index.css", ".w { display: block; }\n");
    write(p, "packages/web/src/styles/globals.css", PROPS(8));
    const globals = S.designSystemReport(p);
    // a component's own stylesheet is no candidate at all (review 5: 120 of them made "only the first 20 token files are read"
    // of a project with ONE, never in sync) — nor does a built stylesheet past a file's read, holding no custom property, say a bound
    const c = project("bounds-components");
    for (let i = 0; i < 120; i++) { const d = "src/components/Comp" + String(i).padStart(3, "0"); write(c, d + "/index.tsx", COMP); write(c, d + "/styles.scss", ".c { display: block; }\n"); }
    write(c, "src/styles/tokens.css", PROPS(3));
    write(c, "src/assets/css/main.css", ".x { color: red }\n" + long("a", 330000) + "\n");
    S.scaffoldSteeringFile(c, "design-system.md");
    const comps = S.designSystemReport(c);
    const q = project("bounds-exact");
    write(q, "src/x.tokens.json", js(Object.assign(Object.fromEntries(Array.from({ length: 1000 }, (_, i) => ["t" + i, i + "px"])), { flag: true })));
    const exact = S.designSystemReport(q);
    write(q, "src/x.tokens.json", js(Object.fromEntries(Array.from({ length: 1001 }, (_, i) => ["t" + i, i + "px"]))));
    const over = S.designSystemReport(q);
    const r = project("bounds-size");
    write(r, "src/big.tokens.json", js(Object.fromEntries(Array.from({ length: 9000 }, (_, i) => ["colour-number-" + i, { $value: "#" + String(100000 + i), $type: "color" }]))));
    write(r, "src/styles/tokens.css", ":root {\n" + Array.from({ length: 9000 }, (_, i) => "  --a-long-custom-property-name-" + i + ": #" + String(100000 + i) + ";").join("\n") + "\n}\n");
    write(r, REG, "# DS\n\n_Token sources: src/big.tokens.json, src/styles/tokens.css_\n");
    const big = S.designSystemReport(r);
    // the candidates READ have their own bound: 105 files named like a token file that are none, before the real one
    const many = project("bounds-reads");
    for (let i = 0; i < 105; i++) write(many, "src/data/a" + String(i).padStart(3, "0") + ".tokens.json", js({ n: i }));
    write(many, "src/z.tokens.json", js({ color: { brand: "#1d4ed8" } }));
    const reads = S.designSystemReport(many);
    // …and the SOURCES theirs: 22 global stylesheets that all hold tokens — the root-most is read first
    const full = project("bounds-sources");
    for (let i = 0; i < 21; i++) write(full, "packages/p" + String(i).padStart(2, "0") + "/src/index.css", PROPS(5, "p" + i + "-"));
    write(full, "styles.css", PROPS(5, "root-"));
    const sources = S.designSystemReport(full);
    // a feature's report says the token-file bound too: a stylesheet left out of the sources is read for raw values
    const t = project("bounds-feature");
    for (let i = 0; i < 21; i++) write(t, "src/styles/tokens.f" + String(i).padStart(2, "0") + ".css", ":root { --f" + i + ": 1px; }\n");
    const f = feature(t, "Shop", "src/zz/");
    write(t, "src/zz/Shop.tsx", "export const Shop = () => <b className=\"text-[#123456]\" />;\n");
    const feat = S.designSystemReport(t, { name: f.slug });
    const strings = ["en", "pt", "pt-BR", "es"].map((l) => { const L = MSG(l).cliOutput.dsLimit; return typeof L["token-candidates"] === "function" && L["token-candidates"](7).includes("7") && /7.*a\.css|a\.css.*7/.test(L["file-size"](7, "a.css")); });
    all("1.35 review 4 / 5: a bound is said when something was cut, and only then — 24 app stylesheets that hold no token keep neither the one that does unread nor a limit in the report; 120 components' own `styles.scss` and a 330K stylesheet with no custom property are no token files and say no bound (in sync after the seed); exactly 1,000 tokens are no limit, 1,001 are; a token file longer than a file's read says `file-size` with its path (a cut JSON file is no source) and the report is never in sync; 105 files named like a token file that are none: `token-candidates`, its own code; 22 stylesheets that all hold tokens: `token-files`, the root-most read first; a feature's report carries the token-file bound; EN / PT / pt-BR / ES have the lines (got " +
      js({ globals: [globals.found.tokens, globals.found.sources, globals.limits], comps: [comps.found.sources, comps.limits, comps.inSync], exact: [exact.found.tokens, exact.limits], over: [over.found.tokens, over.limits],
        big: [big.found.sources, big.limits, big.inSync], reads: [reads.limits, reads.found.tokens], sources: [sources.limits, sources.found.sources.length, sources.found.sources[0]], feat: [feat.limits, feat.truncated], strings }) + ")", {
      globals: () => globals.found.tokens === 8 && js(globals.found.sources) === js(["packages/web/src/styles/globals.css"]) && js(globals.limits) === js([]),
      components: () => js(comps.found.sources) === js(["src/styles/tokens.css"]) && js(comps.limits) === js([]) && comps.inSync === true,
      exact: () => exact.found.tokens === 1000 && js(exact.limits) === js([]),
      over: () => over.found.tokens === 1000 && js(over.limits) === js([{ code: "tokens", read: 1000 }]),
      fileSize: () => js(big.found.sources) === js(["src/styles/tokens.css"]) && js(big.limits) === js([{ code: "file-size", read: 262144, file: "src/big.tokens.json" }, { code: "tokens", read: 1000 }]) && big.inSync === false,
      reads: () => js(reads.limits) === js([{ code: "token-candidates", read: 100 }]) && reads.found.tokens === 0,
      sources: () => js(sources.limits) === js([{ code: "token-files", read: 20 }]) && sources.found.sources.length === 20 && sources.found.sources[0] === "styles.css",
      feature: () => js(feat.limits) === js([{ code: "token-files", read: 20 }]) && feat.truncated === true,
      strings: () => strings.every(Boolean),
    });
  }

  // --- linear: a line of comments; the seed's component bound ------------------------------------------------------------------------------------
  {
    const p = project("comments");
    write(p, REG, "# DS\n\n| Token | Value | Use |\n|---|---|---|\n| --brand | #1d4ed8 | brand |\n");
    const line = Array.from({ length: 142 }, () => "<!---->").join("") + Array.from({ length: 333 }, () => "a/*").join(""); // 1,993 characters
    const block = Array.from({ length: 120 }, () => line).join("\n") + "\n";
    const times = {};
    for (const ext of ["tsx", "vue"]) {
      const f = feature(p, "Slow " + ext, "src/" + ext + "/");
      for (let i = 0; i < 13; i++) write(p, "src/" + ext + "/f" + i + "." + ext, block);
      const t = remeasure(() => { const t0 = Date.now(); const v = S.designSystemReport(p, { name: f.slug }); return { ms: Date.now() - t0, files: v.viewFiles }; }, (s) => s.ms < 1500);
      times[ext] = [t.ms, t.files];
    }
    const q = project("seed-cap");
    for (let i = 0; i < 505; i++) write(q, "src/components/C" + String(i).padStart(3, "0") + ".tsx", COMP);
    const seeded = S.scaffoldSteeringFile(q, "design-system.md");
    const reg = registry(q);
    all("1.35 review 4: withoutComments is linear on a line of 142 `<!---->` and 333 `a/*` (a `/*` that opens nothing was skipped again after every comment: 13 files × 120 lines took 3.4 s) — under 1.5 s in a .tsx and in a .vue; the seed writes the 500 components the registry's reader reads with their details, never more (got " +
      js({ times, seeded: seeded.seeded, read: [reg.components.length, reg.total.components] }) + ")", {
      tsx: () => times.tsx[0] < 1500 && times.tsx[1] === 13,
      vue: () => times.vue[0] < 1500 && times.vue[1] === 13,
      seedCap: () => seeded.seeded.components === 500 && reg.components.length === 500 && reg.total.components === 500,
    });
  }
};
