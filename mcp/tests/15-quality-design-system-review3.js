"use strict";
// The design-system registry (1.35) — review 3's findings, most of them review 2's fixes gone too far: a JSON "token file" that
// holds credentials, a library written by its name, what a stale path is, where a theme / tokens file counts, an index of a
// helper folder, reference attributes under a prefix, styled-jsx, the bounds a report reached (`limits` — never "in sync"
// beside one), path safety (no fs call outside the project), and each linear pattern pinned on its own.

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
  const project = (tag) => { const p = path.join(tmp, "proj-ds3-" + tag); S.initProject(p, ["ui"], "en"); return p; };
  const registry = (p) => E.designSystemRegistry(path.join(p, ".specs"));
  const REQ = "# Feature: Sign Up\n\n## Summary\nA form.\n\n## User Stories\n### US-1 (P1): Sign up\nAs a visitor I want to sign up.\n**Independent Test:** submit the form.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the visitor submits the form THE SYSTEM SHALL create the account.\n" +
    "2. **US-1.AC-2** — IF the e-mail is taken THEN THE SYSTEM SHALL say so beside the field.\n\n## Success Criteria\n- **SC-001** — a visitor signs up in under a minute.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN the network drops THE SYSTEM SHALL keep what was typed.\n\n## Non-Functional Requirements\n- **NFR-1** — the form renders in under 100 ms.\n\n## Out of Scope\n- Social sign-in.\n";
  const design = (rows) => "# Design: Sign Up\n\n## Overview\nA form built from the library.\n\n## Architecture\n```mermaid\ngraph TD\n  F[Form] --> A[api]\n```\n\n" +
    "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n| Reuse | the api client | `src/lib/api.ts` | it posts the form |\n\n" +
    "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n| Fields | The library's | Accessible | A dependency | A rewrite | ✓ |\n| Fields | Our own | Light | States to build | Drift | ✗ |\n\n" +
    "## Data Models\nAccount {email}.\n\n## Error Handling\nSee the IF…THEN criteria.\n\n## Testing Strategy\nComponent tests.\n\n## Risks\n- A slow network — low — the button shows progress.\n\n" +
    "## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
    "## [UI] Design System Usage\nBuilt from the library.\n\n| Kind | Component | Why / notes |\n|---|---|---|\n" + rows.join("\n") + "\n\n## [UI] UI States\nLoading: the button spins. Error: beside the field. Reference: design/signup.png.\n\n" +
    "## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n\n## [UI] Responsiveness & i18n\nOne column at 360 px.\n\n## [UI] UI Performance Budget\nNo layout shift.\n";
  const feature = (p, name, files, text) => {
    const f = S.createFeature(p, { name, tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build it\n  - _Requirements: US-1.AC-1_\n  - _Implements: " + files + "_\n");
    if (text) fs.writeFileSync(path.join(f.dir, "design.md"), text);
    return f;
  };
  const rawOf = (p, slug, dir) => S.designSystemReport(p, { name: slug }).raw.map((x) => x.file.replace(dir, "") + ":" + x.line + " " + x.value);

  // --- HIGH: a JSON file named for tokens that holds CREDENTIALS is no token file — nothing of it is read, listed or written ----------
  {
    const p = project("secrets");
    const SECRETS = ["ya29.FAKE-ACCESS-TOKEN-0000", "1//FAKE-REFRESH-TOKEN-1111", "GOCSPX-FAKE-CLIENT-SECRET-2222", "FAKE-SESSION-3333", "sk-FAKE-API-KEY-4444", "FAKE-ACCOUNT-5555"];
    // Google's OAuth quickstart file, a CLI's saved session, and a name of the design-tokens convention used for credentials
    write(p, "token.json", js({ token: SECRETS[0], refresh_token: SECRETS[1], token_uri: "https://oauth2.example.com/token", client_id: "1234.apps.example.com", client_secret: SECRETS[2], scopes: ["a"], expiry: "2026-01-01T00:00:00Z" }));
    write(p, "tokens.json", js({ access_token: SECRETS[0], refreshToken: SECRETS[1], expires_in: 3599, user: { sessionToken: SECRETS[3] } }));
    // (every value of a credentials file is the file's secret — the account beside the key too: the FILE is left unread)
    write(p, "src/config/auth.tokens.json", js({ apiKey: SECRETS[4], account: SECRETS[5], region: "eu-west-1" }));
    // the real ones: the design-tokens format, a plain file of colours and lengths (a key named like a credential, holding a colour)
    write(p, "src/design/tokens.json", js({ color: { primary: { $value: "#1d4ed8", $type: "color" } } }));
    write(p, "src/styles/tokens.json", js({ space: { sm: "4px" }, input: { password: "#cccccc" }, asset: "aVeryLongOpaqueRunOfMoreThanFortyCharacters0123456789" }));
    write(p, "src/theme/tokens.json", js({ name: "default", version: 3 })); // a plain tokens.json that shows no design value
    write(p, "src/components/Button.tsx", COMP);
    const rep = S.designSystemReport(p);
    const seeded = S.scaffoldSteeringFile(p, "design-system.md");
    const text = rd(p, REG);
    const after = S.designSystemReport(p);
    const leaked = SECRETS.filter((s) => js(rep).includes(s) || text.includes(s) || js(after).includes(s));
    all("1.35 review 3: a JSON file named for tokens that holds credentials (a root token.json / tokens.json of an OAuth client, an auth.tokens.json) is no token file — it is no source and none of its values reaches the report or the seeded registry; a plain tokens.json showing no design value is none either; the real ones are read, a key named like a credential that holds a colour included, an opaque 40-character run left out (got " +
      js({ sources: rep.found.sources, tokens: rep.newTokens, seeded: seeded.seeded, leaked, synced: after.inSync }) + ")", {
      noLeak: () => js(leaked) === js([]),
      sources: () => js(rep.found.sources) === js(["src/design/tokens.json", "src/styles/tokens.json"]),
      tokens: () => js(registry(p).tokens.map((t) => t.name + "=" + t.value)) === js(["color.primary=#1d4ed8", "space.sm=4px", "input.password=#cccccc"]),
      seeded: () => js(seeded.seeded) === js({ components: 1, tokens: 3 }) && after.inSync === true,
    });
  }

  // --- HIGH: a library is named as the designs cite it — a package or its name ---------------------------------------------------------
  {
    const p = project("libs");
    write(p, REG, "# DS\n\n_Libraries: Material UI, @mui/material (v6), Ant Design, none yet_\n_Token sources: no-tokens/base.css, sem/tokens.css, none_\n\n" + HEAD + "| Card | `src/components/Card.tsx` |  |  |\n");
    const f = S.createFeature(p, { name: "Sign Up", tracks: ["ui"], summary: "x", size: "m" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f.dir, "design.md"), design(["| Reuse | TextField (Material UI) | the e-mail field |", "| Reuse | Select (Ant Design) | the country |", "| Reuse | Button (@mui/material) | the submit action |"]));
    approveBefore(p, f.slug, "design");
    const reg = registry(p);
    const approved = S.approvePhase(p, f.slug, "design", "t");
    const none = (line) => { write(p, REG, "# DS\n\n" + line + "\n"); return registry(p).libraries; };
    const nothing = ["_Libraries: none yet_", "_Libraries: nenhuma ainda_", "_Libraries: sin bibliotecas_", "_Libraries: TBD_", "_Libraries: n/a (custom only)_", "_Libraries: —_"].map(none);
    const empty = (S.specDoctor(p, f.slug).checks || []).find((c) => c.id === "ui-design-system");
    all("1.35 review 3: `_Libraries: Material UI, @mui/material (v6), Ant Design, none yet_` declares three libraries — by name or by package, a parenthesis beside one a note — and a size m design citing `TextField (Material UI)` is approved; an entry whose FIRST word says none (none yet · nenhuma ainda · sin bibliotecas · TBD · n/a) names nothing, and a registry holding only that is an empty one (a warning, never the m / l refusal); a token source `no-tokens/base.css` is a path (got " +
      js({ libraries: reg.libraries, sources: reg.sources, approved: [approved.ok, approved.failing], nothing, empty: empty && [empty.status, empty.detail.slice(0, 60)] }) + ")", {
      libraries: () => js(reg.libraries) === js(["Material UI", "@mui/material", "Ant Design"]),
      sources: () => js(reg.sources) === js(["no-tokens/base.css", "sem/tokens.css"]),
      approved: () => approved.ok === true,
      nothing: () => js(nothing) === js([[], [], [], [], [], []]),
      empty: () => empty.status === "warn" && !/a size m design needs it/.test(empty.detail),
    });
  }

  // --- what a stale path is ---------------------------------------------------------------------------------------------------------------
  {
    const p = project("stale");
    write(p, "src/components/Card.tsx", COMP);
    write(p, "src/components/Form Controls/DatePicker.tsx", COMP);
    write(p, "_shared/Badge.tsx", COMP);
    write(p, "README.md", "# x\n");
    const rows = [
      // cells that name no file of the project: never stale
      ["Link", "next/link"], ["Image", "next/image"], ["PButton", "primereact/button"], ["Sh", "shadcn/ui"], ["AButton", "antd/es/button"], ["Alias", "~/components/Button.vue"],
      ["Hash", "#components/Button.vue"], ["Na", "N/A."], ["Na2", "n/a (custom, e.g. inline)"], ["Prose", "Built into the layout."], ["See", "see Storybook."],
      ["Gen", "generated at build time (v2.0)"], ["Site", "storybook.example.com/button.html"], ["Glob", "src/components/*.tsx"], ["NoExt", "src/components/Card"],
      ["Under", "_shared/Badge.tsx"], ["Node", "built with Node.js"],
      // files that are there, whatever stands beside them
      ["Card", "`src/components/Card.tsx` (see docs/Gone.md)"], ["Linked", "[Card docs](src/components/Card.tsx)"], ["Blank", "src/components/Form Controls/DatePicker.tsx"],
      // files that are gone, whatever stands beside them
      ["Gone1", "src/components/Gone.tsx (see README.md)"], ["Gone2", "src/components/Gone.tsx — replaced by src/components/Card.tsx"], ["Gone3", "[Gone](src/components/Gone.tsx)"],
      ["Gone4", "src/components/No Such/Lost.tsx"], ["Gone5", "`src/components/Gone.tsx:12`"],
    ];
    write(p, REG, "# DS\n\n" + HEAD + rows.map((r) => "| " + r[0] + " | " + r[1] + " |  |  |").join("\n") + "\n");
    const rep = S.designSystemReport(p);
    all("1.35 review 3: a registry row is stale only when its cell names a FILE OF THE PROJECT that is gone — a package (next/link, primereact/button), a framework alias (~/components/…), prose, a glob, a path without an extension and a site are never stale; a file that is there stays there beside a note or behind a link; a file that is gone is stale whatever the note beside it names (got " +
      js({ read: registry(p).components.length, stale: rep.stale.map((s) => s.name), total: rep.staleTotal }) + ")", {
      read: () => registry(p).components.length === rows.length,
      stale: () => js(rep.stale.map((s) => s.name)) === js(["Gone1", "Gone2", "Gone3", "Gone4", "Gone5"]) && rep.staleTotal === 5,
    });
  }
  {
    // path safety: a cell is decided on its TEXT — no fs call leaves the project, follows a link out of it or reaches a share
    const p = project("paths");
    const outside = path.join(tmp, "ds3-outside");
    write(outside, "Secret.tsx", COMP);
    write(p, "src/components/Card.tsx", COMP);
    fs.symlinkSync(outside, path.join(p, "linked"), "junction"); // a junction on Windows, a symlink elsewhere
    const up = "../" + path.basename(outside);
    const cells = [up + "/Secret.tsx", up + "/Gone.tsx", "linked/Secret.tsx", "linked/Gone.tsx", "//fileserver/share/Net.tsx", "\\\\fileserver\\share\\Net2.tsx",
      outside.split(path.sep).join("/") + "/Secret.tsx", outside.split(path.sep).join("/") + "/Gone.tsx", "src/../../" + path.basename(outside) + "/Gone.tsx", "src/components/Card.tsx"];
    write(p, REG, "# DS\n\n" + HEAD + cells.map((c, i) => "| P" + i + " | " + c.split("|").join("/") + " |  |  |").join("\n") + "\n");
    S.designSystemReport(p); // (everything the engine loads lazily is loaded before the calls are watched)
    const seen = [];
    const names = ["lstatSync", "statSync", "existsSync", "readFileSync", "readdirSync", "opendirSync", "openSync", "accessSync"];
    const real = {};
    const watch = (orig) => function (f) { if (typeof f === "string" || Buffer.isBuffer(f)) seen.push(String(f)); return orig.apply(this, arguments); };
    for (const n of names) { real[n] = fs[n]; fs[n] = watch(real[n]); }
    real.realpathSync = fs.realpathSync;
    fs.realpathSync = Object.assign(watch(real.realpathSync), { native: watch(real.realpathSync.native) });
    let rep;
    try { rep = S.designSystemReport(p); } finally { Object.assign(fs, real); }
    const low = (s) => path.resolve(s).toLowerCase();
    const inside = (dir, f) => { const a = low(f), d = low(dir); return a === d || a.startsWith(d + path.sep); };
    const link = path.join(p, "linked");
    const bad = seen.filter((f) => /^[\\/]{2}/.test(f) || inside(outside, f) || (inside(link, f) && low(f) !== low(link)) || /fileserver/i.test(f));
    all("1.35 review 3: path safety — a registry cell naming `..` out of the project, an absolute path elsewhere, a path through a link that leaves the project or a network share makes no fs call there (the cell is decided on its text; a link on the way is where the walk stops), and none of them is stale (got " +
      js({ calls: seen.length, bad: bad.slice(0, 6), stale: rep.stale.map((s) => s.name), ok: rep.ok }) + ")", {
      watched: () => seen.length > 0 && seen.some((f) => inside(p, f)),
      noCallOutside: () => js(bad) === js([]),
      neverStale: () => js(rep.stale) === js([]),
    });
  }

  // --- the scan: where a theme / tokens file counts, an index of a helper folder ----------------------------------------------------------
  {
    const p = project("places");
    for (const f of ["apps/web/src/theme.ts", "src/theme.ts", "packages/ui/src/tokens.ts", "src/store/theme.ts", "server/models/theme.js", "apps/web/src/tokens.ts", "src/auth/tokens.ts"]) write(p, f, "export default {};\n");
    write(p, "packages/design-tokens/src/tokens.json", js({ radius: { md: "6px" } }));
    for (const f of ["config", "context", "store", "constants", "i18n"]) write(p, "src/components/" + f + "/index.tsx", COMP); // a helper folder's index
    write(p, "src/components/Theme/index.tsx", COMP); // a component named Theme (the names are matched as written)
    write(p, "src/components/Avatar/index.tsx", COMP);
    write(p, "src/components/Layout.tsx", COMP);
    const rep = S.designSystemReport(p);
    all("1.35 review 3: theme.ts counts at the root, right inside a source folder (src/theme.ts, apps/web/src/theme.ts) or in a telling folder — never `src/store/theme.ts` or `server/models/theme.js`; a plain tokens.* counts in a telling folder, source folders aside (packages/ui/src/tokens.ts, packages/design-tokens/src/tokens.json) — never `apps/web/src/tokens.ts`; the index of a helper folder (config/, context/, store/…) is no component, `Theme/index.tsx` is (got " +
      js({ sources: rep.found.sources, components: rep.missing.map((m) => m.name).concat(rep.pending.map((m) => m.name)) }) + ")", {
      sources: () => js(rep.found.sources) === js(["apps/web/src/theme.ts", "packages/design-tokens/src/tokens.json", "packages/ui/src/tokens.ts", "src/theme.ts"]),
      components: () => js(rep.missing.map((m) => m.name)) === js(["Avatar", "Layout", "Theme"]),
    });
  }

  // --- raw values: a reference attribute under a prefix, styled-jsx, <STYLE> ------------------------------------------------------------------
  {
    const p = project("raw");
    write(p, REG, "# DS\n\n| Token | Value | Use |\n|---|---|---|\n| --brand | #1d4ed8 | brand |\n");
    const f = feature(p, "Shop", "src/shop/");
    write(p, "src/shop/Modal.tsx", ["export const Modal = () => (", "  <div>", "    <button data-bs-toggle=\"modal\" data-bs-target=\"#add\" hx-target=\"#feed\" data-href=\"#cafe\" />",
      "    <use xlinkHref=\"#fade\" xlink:href=\"#dead\" />", "    <Tab dataTarget=\"#beef\" />", "    <Banner gradientTo=\"#1d4ed8\" invalid=\"#dc2626\" />", "  </div>", ");",
      "gsap.to(\"#face\", { x: 1 }); window.scrollTo('#fed'); d3.select(\"#bad\"); $(el).find(\"#dad\");", ""].join("\n"));
    write(p, "src/shop/Legacy.jsx", ["export const Legacy = () => (", "  <div>", "    <style jsx>{`", "      .card { color: #fff; padding: 12px; }", "      p { margin: 13px; }", "    `}</style>",
      "    <i className=\"text-[#00ff00]\" />", "  </div>", ");", ""].join("\n"));
    write(p, "src/shop/page.html", ["<html><head>", "<STYLE TYPE=\"text/css\">", ".x { margin: 9px; }", "</STYLE>", "</head></html>", ""].join("\n"));
    const got = rawOf(p, f.slug, "src/shop/");
    all("1.35 review 3: raw values — a reference attribute under any prefix (data-bs-target, hx-target, data-href, xlink:href, JSX's xlinkHref / dataTarget) and a selection or tween target (gsap.to, scrollTo, d3.select, .find) is no colour while `gradientTo=\"#1d4ed8\"` and `invalid=\"#dc2626\"` are; a styled-jsx <style> block in a .jsx is read as a stylesheet (and the JSX after it as code); <STYLE> in HTML is one in any case (got " + js(got) + ")", {
      refs: () => js(got.filter((x) => x.startsWith("Modal"))) === js(["Modal.tsx:6 #1d4ed8", "Modal.tsx:6 #dc2626"]),
      styledJsx: () => js(got.filter((x) => x.startsWith("Legacy"))) === js(["Legacy.jsx:4 #fff", "Legacy.jsx:4 padding: 12px", "Legacy.jsx:5 margin: 13px", "Legacy.jsx:7 #00ff00"]),
      upperCase: () => js(got.filter((x) => x.startsWith("page"))) === js(["page.html:3 margin: 9px"]),
    });
  }

  // --- the bounds a report reached: said, and never "in sync" beside one -----------------------------------------------------------------------
  {
    const p = project("limits");
    write(p, "src/styles/tokens.css", ":root {\n" + Array.from({ length: 1005 }, (_, i) => "  --t" + i + ": " + i + "px;").join("\n") + "\n}\n");
    write(p, "src/components/Button.tsx", COMP);
    const seeded = S.scaffoldSteeringFile(p, "design-system.md");
    const tokens = S.designSystemReport(p);
    for (let i = 0; i < 22; i++) write(p, "src/styles/tokens.f" + String(i).padStart(2, "0") + ".css", ":root { --f" + i + ": 1px; }\n");
    const files = S.designSystemReport(p);
    const q = project("limits-rows");
    write(q, REG, "# DS\n\n" + HEAD + Array.from({ length: 505 }, (_, i) => "| C" + i + " | `src/components/C" + i + ".tsx` |  |  |").join("\n") + "\n\n| Token | Value | Use |\n|---|---|---|\n" +
      Array.from({ length: 1005 }, (_, i) => "| --t" + i + " | 1px |  |").join("\n") + "\n");
    const rows = S.designSystemReport(q);
    const f = feature(q, "Wall", "src/wall/", design(["| Reuse | C1 | a tile |"]));
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    for (let i = 0; i < 205; i++) write(q, "src/wall/V" + String(i).padStart(3, "0") + ".tsx", "export const c = \"#12345" + (i % 10) + "\";\n");
    const wall = S.designSystemReport(q, { name: f.slug });
    approveBefore(q, f.slug, "design");
    const doc = (S.specDoctor(q, f.slug).checks || []).find((c) => c.id === "ui-design-system");
    // a token table past its cap says nothing about components
    const r2 = project("limits-tokens");
    write(r2, REG, "# DS\n\n" + HEAD + "| C1 | `src/components/C1.tsx` |  |  |\n\n| Token | Value | Use |\n|---|---|---|\n" + Array.from({ length: 1005 }, (_, i) => "| --t" + i + " | 1px |  |").join("\n") + "\n");
    const f2 = S.createFeature(r2, { name: "Wall", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f2.dir, "requirements.md"), REQ);
    fs.writeFileSync(path.join(f2.dir, "design.md"), design(["| Reuse | C1 | a tile |"]));
    approveBefore(r2, f2.slug, "design");
    const doc2 = (S.specDoctor(r2, f2.slug).checks || []).find((c) => c.id === "ui-design-system");
    const codes = ["files", "token-files", "tokens", "registry-rows", "view-files"];
    const strings = ["en", "pt", "pt-BR", "es"].map((l) => codes.map((c) => { const fn = MSG(l).cliOutput.dsLimit[c]; return typeof fn === "function" && fn(7).includes("7"); }));
    all("1.35 review 3: a report says which bound cut what it read (`limits`: tokens past 1,000, token files past 20, registry rows past 500, a feature's view files past 200) and is then never `inSync` — the seed writes what the registry's reader reads; every limit has its CLI line in EN / PT / pt-BR / ES; doctor's \"only the first N are read\" speaks of components, never of a token table past its cap (got " +
      js({ seeded: seeded.seeded, tokens: [tokens.limits, tokens.truncated, tokens.inSync, tokens.newTokensTotal], files: [files.limits, files.found.sources.length, files.inSync],
        rows: [rows.limits, rows.inSync], wall: [wall.limits, wall.viewFiles, wall.truncated], doc: doc && doc.detail.slice(-90), doc2: doc2 && [doc2.status, doc2.detail], strings }) + ")", {
      seeded: () => js(seeded.seeded) === js({ components: 1, tokens: 1000 }),
      tokens: () => js(tokens.limits) === js([{ code: "tokens", read: 1000 }]) && tokens.truncated === true && tokens.inSync === false && tokens.newTokensTotal === 0,
      tokenFiles: () => js(files.limits) === js([{ code: "token-files", read: 20 }, { code: "tokens", read: 1000 }]) && files.found.sources.length === 20 && files.inSync === false,
      registryRows: () => js(rows.limits) === js([{ code: "registry-rows", read: 500 }]) && rows.inSync === false,
      viewFiles: () => js(wall.limits) === js([{ code: "view-files", read: 200 }]) && wall.viewFiles === 200 && wall.truncated === true,
      doctorComponents: () => /the registry holds 505 components — only the first 500 are read/.test(doc.detail),
      doctorTokens: () => doc2.status === "pass" && !/only the first/.test(doc2.detail),
      strings: () => strings.every((l) => l.every(Boolean)),
    });
  }

  // --- linear, each pattern on its own (a bound of 1.5 s where the old pattern took 4 s or more) -----------------------------------------------
  {
    const p = project("linear");
    write(p, REG, "# DS\n\n| Token | Value | Use |\n|---|---|---|\n| --brand | #1d4ed8 | brand |\n");
    const block = (line) => Array.from({ length: 120 }, () => line).join("\n") + "\n";
    const shapes = {
      "decl-line": ["tsx", "a:" + long(" ", 1990) + "b"], // RE_DECL_LINE — a declaration-shaped line of a .tsx: the blank run after the colon
      "size-literal": ["css", "margin: " + long("9", 1980)], // RE_SIZE_LITERAL — a digit run with no unit
      "tw-digits": ["tsx", "<b className=\"p-[" + long("9", 1970) + "\" />"], // RE_TW_SIZE — the number inside the brackets
      "tw-variants": ["tsx", "<b className=\"" + long("a:", 985) + "zz\" />"], // RE_TW_SIZE — variant prefixes that lead to no size utility
    };
    const times = {};
    for (const [name, [ext, line]] of Object.entries(shapes)) {
      const f = feature(p, "Slow " + name, "src/" + name + "/");
      for (let i = 0; i < 13; i++) write(p, "src/" + name + "/f" + i + "." + ext, block(line));
      const t = remeasure(() => { const t0 = Date.now(); const v = S.designSystemReport(p, { name: f.slug }); return { ms: Date.now() - t0, files: v.viewFiles }; }, (s) => s.ms < 1500);
      times[name] = [t.ms, t.files];
    }
    // the registry's marker lines: a value of 3,990 dots, 250 times (a trailing-run replace was quadratic on each)
    write(p, REG, "# DS\n\n" + Array.from({ length: 250 }, () => "_Token sources: " + long(".", 3990) + "x_").join("\n") + "\n\n" + HEAD + "| Button | x |  |  |\n");
    const markers = remeasure(() => { const t0 = Date.now(); const r = registry(p); return { ms: Date.now() - t0, n: r.components.length }; }, (s) => s.ms < 500);
    all("1.35 review 3: each pattern is linear on its own — 13 view files of 120 hostile lines for the declaration-shaped line, the size literal, the Tailwind number and the Tailwind variants are each read in under 1.5 s (each took 4 s or more with the pattern it replaced), and 250 marker lines of 3,990 dots in under 0.5 s (4.6 s) (got " + js({ times, markers }) + ")", {
      declLine: () => times["decl-line"][0] < 1500 && times["decl-line"][1] === 13,
      sizeLiteral: () => times["size-literal"][0] < 1500 && times["size-literal"][1] === 13,
      twDigits: () => times["tw-digits"][0] < 1500 && times["tw-digits"][1] === 13,
      twVariants: () => times["tw-variants"][0] < 1500 && times["tw-variants"][1] === 13,
      markers: () => markers.ms < 500 && markers.n === 1,
    });
  }
};
