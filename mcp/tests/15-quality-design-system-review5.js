"use strict";
// The design-system registry (1.35) — review 5's findings: a secret used as a JSON KEY (a name is printed too: a JSON file is
// read only when it SHOWS it is a design file), a credential key above a leaf, `components/loading.tsx` and
// `loading.component.ts`, a library-only registry (the gate stands on whether a declared library IS one), the `value` + `type`
// format, what a SCSS variable file is made of, a token source starting with `_`, a <style> named in a comment or left
// alone on its line, withoutComments on a line of both comment kinds, the markers' notes.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, approveBefore, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const rd = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const REG = ".specs/steering/design-system.md";
  const HEAD = "| Component | Path | Variants | Notes |\n|---|---|---|---|\n";
  const COMP = "export default () => null;\n";
  const project = (tag) => { const p = path.join(tmp, "proj-ds5-" + tag); S.initProject(p, ["ui"], "en"); return p; };
  const registry = (p) => E.designSystemRegistry(path.join(p, ".specs"));
  const REQ = "# Feature: Sign Up\n\n## Summary\nA form.\n\n## User Stories\n### US-1 (P1): Sign up\nAs a visitor I want to sign up.\n**Independent Test:** submit the form.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the visitor submits the form THE SYSTEM SHALL create the account.\n" +
    "2. **US-1.AC-2** — IF the e-mail is taken THEN THE SYSTEM SHALL say so beside the field.\n\n## Success Criteria\n- **SC-001** — a visitor signs up in under a minute.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN the network drops THE SYSTEM SHALL keep what was typed.\n\n## Non-Functional Requirements\n- **NFR-1** — the form renders in under 100 ms.\n\n## Out of Scope\n- Social sign-in.\n";
  const design = (usage) => "# Design: Sign Up\n\n## Overview\nA form built from the system.\n\n## Architecture\n```mermaid\ngraph TD\n  F[Form] --> A[api]\n```\n\n" +
    "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n| Reuse | the api client | `src/lib/api.ts` | it posts the form |\n\n" +
    "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n| Fields | The system's | Accessible | A dependency | A rewrite | ✓ |\n| Fields | Our own | Light | States to build | Drift | ✗ |\n\n" +
    "## Data Models\nAccount {email}.\n\n## Error Handling\nSee the IF…THEN criteria.\n\n## Testing Strategy\nComponent tests.\n\n## Risks\n- A slow network — low — the button shows progress.\n\n" +
    "## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
    "## [UI] Design System Usage\n" + usage + "\n\n## [UI] UI States\nLoading: the button spins. Error: beside the field. Reference: design/signup.png.\n\n" +
    "## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n\n## [UI] Responsiveness & i18n\nOne column at 360 px.\n\n## [UI] UI Performance Budget\nNo layout shift.\n";
  const table = (rows) => "Built from the system.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n" + rows.join("\n");
  // a size m feature whose design is ready for its approval; → approve(usage): rewrite the section, try the approval
  const sized = (p) => {
    const f = S.createFeature(p, { name: "Sign Up", tracks: ["ui"], summary: "x", size: "m" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(table(["| Reuse | Placeholder | x |"])));
    approveBefore(p, f.slug, "design");
    const approve = (usage) => { fs.writeFileSync(path.join(f.dir, "design.md"), design(usage)); const a = S.approvePhase(p, f.slug, "design", "t"); return a.ok ? "approved" : "refused:" + (a.failing || []).join(","); };
    return { slug: f.slug, dir: f.dir, approve };
  };
  const feature = (p, name, files) => {
    const f = S.createFeature(p, { name, tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Implements: " + files + "_\n");
    return f;
  };
  const rawOf = (p, slug, dir) => S.designSystemReport(p, { name: slug }).raw.map((x) => x.file.replace(dir, "") + ":" + x.line + " " + x.value);

  // --- HIGH: a secret used as a KEY — a name is printed too -------------------------------------------------------------------------------
  {
    const p = project("keys");
    const K40 = "xhp_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE1234", K40B = "xhp_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE5678";
    const SECRETS = [K40, K40B, "sk-FAKE-live-0004", "FAKE-SESSION-0005", "sk-FAKE-0006", "sk-FAKE-0007", "123456789", "4242", "987654321", "555666", "11223344", "55667788", "99887766"];
    // maps keyed by the secret (a token store, a rate counter, a session store): nothing in them says design
    write(p, "tokens.json", js({ [K40]: 1700000000, [K40B]: 1700000500 }));
    write(p, "server/api.tokens.json", js({ "sk-FAKE-live-0004": { owner: "bob", rate: 100 } }));
    write(p, "config/design-tokens.json", js({ sessions: { "FAKE-SESSION-0005": { created: 1700000000 } } }));
    write(p, "scripts/x.tokens.json", js({ "sk-FAKE-0006": { ttl: "3600s", share: "50%" } }));
    write(p, "scripts/y.tokens.json", js({ "sk-FAKE-0007": { schedule: "rate(5 minutes)" } })); // a function that says nothing of design
    // a real token file: a credential key ABOVE a leaf, in camelCase, in capitals — and a 40-character key beside real tokens
    write(p, "src/x.tokens.json", js({ color: { brand: "#1d4ed8" }, password: { admin: 123456789, root: "none" }, secrets: { pin: 4242 }, api_key: { live: 987654321 },
      db: { password: 555666 }, clientSecret: 11223344, _authToken: 55667788, SECRET_KEY: 99887766, [K40]: { shade: "#000000" } }));
    write(p, "src/components/Button.tsx", COMP);
    const rep = S.designSystemReport(p);
    const seeded = S.scaffoldSteeringFile(p, "design-system.md");
    const out = js(rep) + rd(p, REG) + js(S.designSystemReport(p));
    const leaked = SECRETS.filter((s) => out.includes(s));
    all("1.35 review 5: a secret used as a JSON KEY reaches neither the report nor the seeded registry — a JSON file named for tokens is read only when it SHOWS it is a design file (a design-tokens format, or a colour / length / reference): a map of numbers, counters, a time or a percentage keyed by the secret is none; in a real token file nothing beneath a credential key is listed but a value that says design (a number under `password: {admin}`, `clientSecret`, `_authToken`, `SECRET_KEY`, `secrets: {pin}`), nor anything beneath a key of 40 characters (got " +
      js({ leaked, sources: rep.found.sources, tokens: rep.newTokens.map((t) => t.name + "=" + t.value), seeded: seeded.seeded }) + ")", {
      noLeak: () => js(leaked) === js([]),
      sources: () => js(rep.found.sources) === js(["src/x.tokens.json"]),
      tokens: () => js(rep.newTokens.map((t) => t.name + "=" + t.value)) === js(["color.brand=#1d4ed8"]),
    });
  }

  // --- HIGH: a component named like a framework's special file -------------------------------------------------------------------------------
  {
    const p = project("special");
    for (const n of ["loading", "layout", "not-found", "error", "page", "template", "main", "theme", "button"]) write(p, "src/app/components/" + n + "/" + n + ".component.ts", "export class C {}\n"); // Angular
    for (const n of ["loading-bar", "providers", "site-layout", "error-boundary", "utils", "types", "main", "index"]) write(p, "components/" + n + ".tsx", COMP); // the shadcn / Next naming
    for (const n of ["empty", "app-button"]) write(p, "components/" + n + ".vue", "<template><div /></template>\n"); // Nuxt
    for (const n of ["template", "not-found"]) write(p, "components/" + n + ".tsx", COMP);
    const seeded = S.scaffoldSteeringFile(p, "design-system.md");
    const names = registry(p).components.map((c) => c.name);
    const f = sized(p);
    const verdict = f.approve(table(["| Reuse | Loading | the pending state |", "| Reuse | NotFound | the empty page |", "| Reuse | Providers | the app's wrappers |"]));
    all("1.35 review 5: under a component folder a file named like a framework's special file IS a component — Angular's `loading/loading.component.ts` (any `*.component.ts`), `components/providers.tsx`, `components/not-found.tsx`, `components/template.tsx`; a helper or an entry file is still none (utils, types, main, index) — and a size m design reusing Loading is approved against the seeded registry (got " +
      js({ seeded: seeded.seeded, names, verdict }) + ")", {
      components: () => js(names) === js(["AppButton", "Button", "Empty", "Error", "ErrorBoundary", "Layout", "Loading", "LoadingBar", "Main", "NotFound", "Page", "Providers", "SiteLayout", "Template", "Theme"]),
      approved: () => verdict === "approved",
    });
  }

  // --- a library-only registry is checked like any other — when the library IS one --------------------------------------------------------------
  {
    const scoped = project("lib-scoped");
    write(scoped, REG, "# DS\n\n_Libraries: @mui/material_\n");
    const f = sized(scoped);
    const strict = {
      prose: f.approve("The form is built from Material UI fields, nothing of our own."),
      typo: f.approve(table(["| Reuse | Buton | the submit action |"])),
      wrongName: f.approve(table(["| Reuse | TextField (MUI) | the e-mail field |"])),
      misspelt: f.approve(table(["| Reuse | TextField (@mui/materail) | the e-mail field |"])),
      own: f.approve(table(["| Reuse | Card | a frame of our own |"])),
      mixed: f.approve(table(["| Reuse | TextField (@mui/material) | the e-mail field |", "| Reuse | Card | a frame of our own |"])),
      cited: f.approve(table(["| Reuse | TextField (@mui/material) | the e-mail field |"])),
    };
    // an unscoped name counts by the project's package.json — and only by it
    const dep = project("lib-dependency");
    write(dep, "package.json", js({ dependencies: { antd: "^5.0.0" } }));
    write(dep, REG, "# DS\n\n_Libraries: antd_\n");
    const depVerdict = sized(dep).approve(table(["| Reuse | Buton | the submit action |"]));
    const free = project("lib-free");
    const g = sized(free);
    const loose = ["antd", "Material UI", "not yet", "por definir", "custom components only", "pending"].map((l) => { write(free, REG, "# DS\n\n_Libraries: " + l + "_\n"); return g.approve(table(["| Reuse | Buton | the submit action |"])); });
    all("1.35 review 5: a registry that lists no component and declares a library that IS one — a scoped package by its name, or a dependency of package.json — is library-only on purpose: every row is checked (prose only, a typo, a library it does not declare and a component of our own are refused at size m — alone or beside a correct row), a row citing the library is approved; a `_Libraries:_` line naming no real package (free text in any words, a name no package.json holds) leaves the registry empty: a warning, never the refusal (got " +
      js({ strict, depVerdict, loose }) + ")", {
      strict: () => js(strict) === js({ prose: "refused:ui-design-system", typo: "refused:ui-design-system", wrongName: "refused:ui-design-system", misspelt: "refused:ui-design-system", own: "refused:ui-design-system", mixed: "refused:ui-design-system", cited: "approved" }),
      dependency: () => depVerdict === "refused:ui-design-system",
      freeText: () => js(loose) === js(["approved", "approved", "approved", "approved", "approved", "approved"]),
    });
  }

  // --- the `value` + `type` format; what a token source's line says; the markers' notes -----------------------------------------------------------
  {
    const p = project("studio");
    // a Tokens Studio export: value + type — the free-text ones are tokens too, listed by their name alone
    write(p, "tokens.json", js({ global: {
      colors: { brand: { value: "#1d4ed8", type: "color" } }, fontFamilies: { inter: { value: "Inter", type: "fontFamilies" }, mono: { value: "JetBrains Mono", type: "fontFamilies" } },
      fontWeights: { "inter-0": { value: "Regular", type: "fontWeights" }, "inter-1": { value: "Semi Bold", type: "fontWeights" } },
      fontSize: { 0: { value: "16", type: "fontSizes" }, 1: { value: "{fontSize.0} * 1.25", type: "fontSizes" } },
      spacing: { sm: { value: "8", type: "spacing" }, md: { value: "{spacing.sm} * 2", type: "spacing" } }, textDecoration: { u: { value: "underline", type: "textDecoration" } } } }));
    // a token source whose path starts with `_` (Jekyll's _sass): the seed's own line reads back whole
    write(p, "_sass/_variables.scss", "$brand: #1d4ed8;\n");
    const seeded = S.scaffoldSteeringFile(p, "design-system.md");
    const reg = registry(p);
    const rep = S.designSystemReport(p);
    const tokens = Object.fromEntries(reg.tokens.map((t) => [t.name, t.value]));
    // the markers: a note that is the library's package names it too, a comma inside a note cuts nothing, a parenthesis inside a
    // path is the path's, a JSON token file with a BOM is read
    const q = project("markers");
    write(q, REG, "# DS\n\n_Libraries: Material UI (@mui/material), antd (Ant Design, v5), Chakra (v2)_\n_Token sources: src/styles (legacy)/tokens.css, _sass/_variables.scss (generated)_\n\n" + HEAD + "| Card | x |  |  |\n");
    const marks = registry(q);
    write(q, "src/brand.tokens.json", String.fromCharCode(0xfeff) + js({ color: { brand: { $value: "#1d4ed8" } } }));
    const bom = S.designSystemReport(q);
    // a library is cited as a whole word: `own` is not in "Dropdown"
    write(q, REG, "# DS\n\n_Libraries: own_\n\n" + HEAD + "| Card | x |  |  |\n");
    const word = sized(q).approve(table(["| Reuse | Dropdown | a menu |"]));
    all("1.35 review 5: a Tokens Studio export (`value` beside `type`) lists every token — a font family, a weight, `underline` by their name alone, `{spacing.sm} * 2` with its value; a token source starting with `_` (`_sass/_variables.scss`) reads back whole and the seeded registry is in sync; `Material UI (@mui/material)` names both, a comma inside a note cuts no entry, a version is no name, a parenthesis inside a path stays the path's; a token JSON with a BOM is read; a library is cited as a whole word (got " +
      js({ seeded: seeded.seeded, tokens, sources: reg.sources, inSync: [rep.inSync, rep.newSources], libraries: marks.libraries, markSources: marks.sources, bom: bom.found.sources, word }) + ")", {
      format: () => js(tokens) === js({ "$brand": "#1d4ed8", "global.colors.brand": "#1d4ed8", "global.fontFamilies.inter": "", "global.fontFamilies.mono": "", "global.fontWeights.inter-0": "",
        "global.fontWeights.inter-1": "", "global.fontSize.0": "16", "global.fontSize.1": "{fontSize.0} * 1.25", "global.spacing.sm": "8", "global.spacing.md": "{spacing.sm} * 2", "global.textDecoration.u": "" }),
      underscore: () => js(reg.sources) === js(["_sass/_variables.scss", "tokens.json"]) && rep.inSync === true,
      libraries: () => js(marks.libraries) === js(["Material UI", "@mui/material", "antd", "Chakra"]),
      sources: () => js(marks.sources) === js(["src/styles (legacy)/tokens.css", "_sass/_variables.scss"]),
      bom: () => js(bom.found.sources) === js(["src/brand.tokens.json"]),
      wholeWord: () => word === "refused:ui-design-system",
    });
  }

  // --- the scan: theme.* under a folder that is not the UI's, the files whose values are read first --------------------------------------------
  {
    // (a project of its own: beside 21 other sources the bound would hide a theme.ts wrongly listed)
    const th = project("themes");
    for (const f of ["src/store/modules/theme.ts", "src/types/theme.ts", "src/hooks/theme.ts", "src/context/theme.ts", "e2e/theme.ts", "scripts/theme.js", "src/ui/theme.ts"]) write(th, f, "export default {};\n");
    const themes = S.designSystemReport(th).found.sources;
    const p = project("order");
    for (let i = 0; i < 21; i++) write(p, "apps/a" + String(i).padStart(2, "0") + "/tailwind.config.ts", "export default {};\n"); // listed, their values unread
    write(p, "src/styles/tokens.css", ":root { --brand: #1d4ed8; }\n");
    const rep = S.designSystemReport(p);
    all("1.35 review 5: theme.ts is no token file under a folder that is not the UI's, at any depth (store/modules/, types/, hooks/, context/, e2e/, scripts/) — src/ui/theme.ts is one; the token files whose values ARE read come first — 21 `tailwind.config.ts` (listed, unread) do not take tokens.css's place, and the bound they reach is said (got " +
      js({ themes, first: rep.found.sources[0], n: rep.found.sources.length, tokens: rep.found.tokens, limits: rep.limits }) + ")", {
      themes: () => js(themes) === js(["src/ui/theme.ts"]),
      readFirst: () => rep.found.sources[0] === "src/styles/tokens.css" && rep.found.tokens === 1 && rep.found.sources.length === 20,
      said: () => js(rep.limits) === js([{ code: "token-files", read: 20 }]),
    });
  }

  // --- raw values: a <style> named in a comment, one left alone on its line; a comment at a line's start; linear ---------------------------------
  {
    const p = project("raw");
    write(p, REG, "# DS\n\n| Token | Value | Use |\n|---|---|---|\n| --brand | #1d4ed8 | brand |\n");
    const f = feature(p, "Shop", "src/shop/");
    write(p, "src/shop/Named.tsx", ["// injects a <style> tag into the head", "/** Renders the <style> block of the theme. */", "export const A = () => (", "  <div>", "    {/* the <style> block lives in Head */}",
      "    <b className=\"text-[#654321] p-[13px]\" />", "  </div>", ");", ""].join("\n"));
    write(p, "src/shop/page.html", ["<!-- the <style> below is generated -->", "<p style=\"color: #abcdef\">x</p>", ""].join("\n"));
    write(p, "src/shop/Alone.jsx", ["export const B = () => (", "  <div>", "    <style", "      jsx", "    >{`", "      .a { margin: 13px; }", "    `}</style>", "    <style", "      dangerouslySetInnerHTML={{ __html: css }}", "    />",
      "    <i className=\"text-[#00ff00]\" />", "  </div>", ");", ""].join("\n"));
    write(p, "src/shop/Lead.tsx", ["/* the old brand was \"#111111\" */ export const c = \"#222222\";", "/* a note */ /* another */ export const d = \"#333333\";", ""].join("\n"));
    const got = rawOf(p, f.slug, "src/shop/");
    // a line of both comment kinds, back to back: read once — against its calm twin, the same files with the openers spelled
    // out of reach (`<!-_->/ **/`: no comment opens, each line is read as it stands — more text for the raw values' patterns
    // than the hard side's, which is all comment), read at the same moment: a ratio holds on a loaded machine where a time
    // does not (1.35.4 review 2: the absolute 1 s missed at 1,329 ms in a plain full run)
    const line = Array.from({ length: 180 }, () => "<!---->/**/").join(""); // 1,980 characters
    const calmLine = Array.from({ length: 180 }, () => "<!-_->/ **/").join(""); // as many
    const g = feature(p, "Slow", "src/slow/"), c = feature(p, "Calm", "src/calm/");
    for (let i = 0; i < 13; i++) {
      write(p, "src/slow/f" + i + ".tsx", Array.from({ length: 120 }, () => line).join("\n") + "\n");
      write(p, "src/calm/f" + i + ".tsx", Array.from({ length: 120 }, () => calmLine).join("\n") + "\n");
    }
    const linear = (s) => s.ms < 3 * s.calm + 300;
    const t = remeasure(() => {
      const t0 = Date.now(); const v = S.designSystemReport(p, { name: g.slug }); const t1 = Date.now(); const w = S.designSystemReport(p, { name: c.slug });
      return { ms: t1 - t0, calm: Date.now() - t1, files: v.viewFiles, calmFiles: w.viewFiles };
    }, linear);
    all("1.35 review 5: raw values — a <style> named in a `//` comment, a JSDoc line, a JSX comment or an HTML comment opens no block (the file's next lines are still read); `<style` alone on its line opens one whose tag ends lines below — a block when it ends in `>`, none when it ends in `/>`; a `/* … */` at a line's start is a comment and what follows it is read; a line of 180 `<!---->/**/` is read once (13 files × 120 lines within 3× + 0.3 s of their calm twin read at the same moment — a `/*` right where a comment ended had dropped the cached \"none left\": 22 s) — 1.35.4 review 2: a ratio, the absolute 1 s missed at 1,329 ms under a full run's load (got " +
      js({ got, slow: [t.ms, t.files], calm: [t.calm, t.calmFiles], tries: t.tries }) + ")", {
      named: () => js(got.filter((x) => x.startsWith("Named"))) === js(["Named.tsx:6 #654321", "Named.tsx:6 p-[13px]"]),
      html: () => js(got.filter((x) => x.startsWith("page"))) === js(["page.html:2 #abcdef"]),
      alone: () => js(got.filter((x) => x.startsWith("Alone"))) === js(["Alone.jsx:6 margin: 13px", "Alone.jsx:11 #00ff00"]),
      lead: () => js(got.filter((x) => x.startsWith("Lead"))) === js(["Lead.tsx:1 #222222", "Lead.tsx:2 #333333"]),
      linear: () => linear(t) && t.files === 13 && t.calmFiles === 13,
    });
  }
};
