"use strict";
// The design-system registry (1.35) — review 6's findings (no HIGH): a global stylesheet where an app keeps one (review 5 had
// listed the places and lost six), a route folder named like a component folder, `components/layout/main.tsx`, DTCG's
// composite tokens, pin / otp as guard words that never refuse a file, `value` + `type` as a format only with a token type,
// a function guarded by what it holds, a library's one-word note, the project's package.json read as a root manifest, a
// token file of one line, a declaration that goes on below, a bound said at one character past it.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, approveBefore, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const rd = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const long = (ch, n) => Array.from({ length: n + 1 }).join(ch);
  const REG = ".specs/steering/design-system.md";
  const HEAD = "| Component | Path | Variants | Notes |\n|---|---|---|---|\n";
  const COMP = "export default () => null;\n";
  const PROPS = (n, prefix) => ":root {\n" + Array.from({ length: n }, (_, i) => "  --" + (prefix || "c") + i + ": " + i + "px;").join("\n") + "\n}\n";
  const project = (tag) => { const p = path.join(tmp, "proj-ds6-" + tag); S.initProject(p, ["ui"], "en"); return p; };
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

  // --- a global stylesheet, wherever an app keeps one -----------------------------------------------------------------------------------
  {
    const places = ["src/app/(frontend)/globals.css", "src/app/[locale]/globals.css", "polls/static/polls/style.css", "flaskr/static/style.css", "wp-content/themes/acme/style.css",
      "src/routes/styles.css", "packages/ui/src/styles/globals.css", "app/globals.css", "src/index.css", "resources/css/app.css"];
    const read = places.map((rel, i) => { const p = project("global-" + i); write(p, rel, PROPS(6)); const r = S.designSystemReport(p); return r.found.tokens + ":" + r.found.sources.join(","); });
    // …but never a component's, a page's or a feature's OWN sheet (one that lies below such a folder without being right in it)
    const own = ["src/components/Button/index.css", "src/features/cart/styles.scss", "src/pages/home/index.css", "packages/kit/src/widgets/Chart/styles.css", "src/app/_components/Card/index.css"];
    const p = project("global-own");
    for (const rel of own) write(p, rel, PROPS(6));
    const none = S.designSystemReport(p);
    // a monorepo: 101 folders with their own index.css beside the one `styles/globals.css`, at the same depth — the likeliest
    // name is read first, and the search ends at its bound without a word
    const m = project("global-mono");
    for (let i = 0; i < 101; i++) write(m, "packages/kit/src/C" + String(i).padStart(3, "0") + "/index.css", ".c { display: block; }\n");
    write(m, "packages/web/src/styles/globals.css", PROPS(6));
    S.scaffoldSteeringFile(m, "design-system.md");
    const mono = S.designSystemReport(m);
    all("1.35 review 6: a global stylesheet is read wherever an app keeps one — a Next route group or locale segment, Django's and Flask's static folders, a WordPress theme, SvelteKit's routes/, a UI package's styles/ — and never a component's, a page's or a feature's own sheet; 101 `index.css` of a monorepo beside the one `styles/globals.css` leave it read, say no bound and the seeded registry is in sync (got " +
      js({ read, none: [none.found.tokens, none.found.sources], mono: [mono.found.tokens, mono.found.sources, mono.limits, mono.inSync] }) + ")", {
      places: () => js(read) === js(places.map((rel) => "6:" + rel)),
      own: () => none.found.tokens === 0 && js(none.found.sources) === js([]),
      monorepo: () => mono.found.tokens === 6 && js(mono.found.sources) === js(["packages/web/src/styles/globals.css"]) && js(mono.limits) === js([]) && mono.inSync === true,
    });
  }

  // --- components: a route folder named like a component folder; an entry file's name deeper down ------------------------------------------
  {
    const p = project("routes");
    for (const f of ["app/design-system/page.tsx", "app/design-system/layout.tsx", "app/components/page.tsx", "app/components/loading.tsx", "app/components/error.tsx", "app/ui/route.ts", "app/ui/template.tsx"]) write(p, f, COMP);
    for (const f of ["components/ui/button.tsx", "components/loading.tsx", "components/layout/main.tsx", "components/shell/app.tsx", "components/main.tsx", "src/ui/main.tsx", "src/ui/app.tsx"]) write(p, f, COMP);
    for (const f of ["components/tokens/index.tsx", "components/style/index.tsx"]) write(p, f, COMP); // a helper folder's barrel: no component Tokens / Style
    const seeded = S.scaffoldSteeringFile(p, "design-system.md");
    const rows = registry(p).components.map((c) => c.name + " <" + c.path + ">");
    const f = sized(p);
    const verdicts = [f.approve(["| New | Layout | the page frame, built here |", "| Reuse | Main | the content landmark |"]), f.approve(["| Reuse | Error | the failure state |"])];
    const rep = S.designSystemReport(p);
    all("1.35 review 6: a framework's special files in a folder that is a route segment itself (it holds a page.* / route.*) are pages — `app/components/{page,loading,error}.tsx`, `app/design-system/layout.tsx` seed no Page / Loading / Error / Layout — while `components/loading.tsx` is the component; `main` / `app` are entry files only right inside the telling folder: `components/layout/main.tsx` is Main; a size m design declaring `New | Layout` is approved, one reusing an Error that exists nowhere is refused, and nothing is reported missing (got " +
      js({ seeded: seeded.seeded, rows, verdicts, missing: rep.missing.map((x) => x.name) }) + ")", {
      components: () => js(rows) === js(["App <components/shell/app.tsx>", "Button <components/ui/button.tsx>", "Loading <components/loading.tsx>", "Main <components/layout/main.tsx>"]),
      gate: () => js(verdicts) === js(["approved", "refused:ui-design-system"]),
      inSync: () => js(rep.missing) === js([]),
    });
  }

  // --- JSON: composite tokens, guard words, `value` + `type`, a function by what it holds -------------------------------------------------
  {
    const p = project("json");
    // DTCG: a string colour, a shadow (an object), a typography, a font-family list, a cubic-bezier — and the 2025 forms
    write(p, "src/design-tokens.json", js({ color: { brand: { $value: "#1d4ed8", $type: "color" } }, shadow: { card: { $value: { color: "#00000040", offsetX: "0px", offsetY: "1px", blur: "2px" }, $type: "shadow" } },
      type: { body: { $value: { fontFamily: "Inter", fontSize: "16px" }, $type: "typography" } }, font: { sans: { $value: ["Inter", "sans-serif"], $type: "fontFamily" } }, ease: { out: { $value: [0, 0, 0.2, 1], $type: "cubicBezier" } } }));
    write(p, "src/Light.tokens.json", js({ color: { bg: { $type: "color", $value: { colorSpace: "srgb", components: [0.11, 0.3, 0.85], hex: "#1d4ed8" } } }, space: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } } }));
    const dtcg = S.designSystemReport(p);
    // guard words never refuse a file; each guards on its own; a free string beneath a credential PARENT refuses none; a long
    // key with blanks is a token's name
    const g = project("guard");
    const LONG = "background interactive primary hover disabled"; // 45 characters, with blanks
    write(g, "src/design-tokens.json", js({ color: { brand: "#1d4ed8" }, content: { icon: { "map-pin": "'\\f041'" } }, input: { otp: { $value: "Roboto Mono", $type: "fontFamily" } },
      a: { pin: 1111 }, b: { otp: 2222 }, c: { passcode: 3333 }, secrets: { x: 4444 }, passwords: { x: 5555 }, api_keys: { x: 6666 }, credentials: { x: 7777 }, password: { hint: "free text here" },
      api_key: "{AB12CD34-FAKE-11D3-9A0C-0305E82C3301}", build: { id: "{3F2504E0-FAKE-11D3-9A0C-0305E82C3301}" }, [LONG]: "#0f0f0f",
      // a token of a format AT a credential key refuses no file either (free text is what a font family holds) — and is not listed, nor a composite beneath a guard word
      text: { token: { $value: "Inter Display", $type: "fontFamily" } }, e: { pin: { $value: { color: "#00000040", blur: "2px" }, $type: "shadow" } } }));
    const guard = S.designSystemReport(g);
    const leaked = ["1111", "2222", "3333", "4444", "5555", "6666", "7777", "FAKE", "Roboto", "f041", "free text", "Inter Display", "00000040"].filter((x) => js(guard).includes(x));
    // a database dump under a token-file name — `{key: {type, value}}`, the keys secrets — is no design file through its `type`
    const d = project("dump");
    write(d, "tokens.json", js({ "apikey:xk_live_FAKE4eC39HqLyjWDarjtT1zd": { type: "hash", value: { user: "12" } }, "pat:FAKE0123456789abcdef0123456789ab": { type: "string", value: "alice" } }));
    const dump = S.designSystemReport(d);
    all("1.35 review 6: a DTCG token whose `$value` is an object or a list (a shadow, a typography, a font-family list, a cubic-bezier) is listed by its name, the 2025 colour and dimension objects by their `hex` / `value + unit` — a file made of them is a source; pin / otp / passcode guard what lies beneath them and never refuse a file (an icon token `map-pin`, `otp: {$value: \"Roboto Mono\"}`), each credential word guards on its own, a free string beneath a credential parent refuses no file, a braced GUID at a credential key is not listed, a 45-character key WITH blanks is a token's name; `value` beside `type: \"hash\"` is no token format — a dump keyed by secrets is not read (got " +
      js({ dtcg: [dtcg.found.sources, dtcg.newTokens.map((t) => t.name + "=" + t.value)], guard: [guard.found.sources, guard.newTokens.map((t) => t.name + "=" + t.value), leaked], dump: [dump.found.sources, js(dump).includes("FAKE")] }) + ")", {
      composite: () => js(dtcg.newTokens.map((t) => t.name + "=" + t.value)) === js(["color.bg=#1d4ed8", "space.md=16px", "color.brand=#1d4ed8", "shadow.card=", "type.body=", "font.sans=", "ease.out="]) && js(dtcg.found.sources) === js(["src/Light.tokens.json", "src/design-tokens.json"]),
      guard: () => js(guard.found.sources) === js(["src/design-tokens.json"]) && js(guard.newTokens.map((t) => t.name + "=" + t.value)) === js(["color.brand=#1d4ed8", LONG + "=#0f0f0f"]) && js(leaked) === js([]),
      dump: () => js(dump.found.sources) === js([]) && !js(dump).includes("FAKE"),
    });
  }
  {
    // what a function HOLDS decides: a key, a ciphertext, a path in parentheses is no design value — in a stylesheet or in JSON
    const p = project("functions");
    const SECRETS = ["FAKEKEY123abc", "FAKEsecretValue123", "FAKEG6N718UuyPE5bHyWKyuLQSm02auQPUtm", "FAKEquery"];
    const shown = { "--safe": "env(safe-area-inset-top)", "--grad": "linear-gradient(to right, #000 0%, #fff 100%)", "--shade": "rgb(0 0 0 / 50%)", "--steps": "steps(4, end)", "--nest": "calc(100% - (2 * var(--gap)))",
      "--srgb": "color(srgb 1 0 0)", "--p3": "color(display-p3 1 0 0)" };
    const blank = { "--font-url": "url(//cdn.example.com/k/FAKEKEY123abc/font.css)", "--wrapped": "(FAKEsecretValue123)", "--enc": "ENC(FAKEG6N718UuyPE5bHyWKyuLQSm02auQPUtm)", "--query": "fetch(a=b&k=FAKEquery)",
      "--cap": "Hunter 5px", "--sched": "rate(5 minutes)", "--words": "unquote(hello world)", "--clip": "url(#abc)", "--deep": "calc(((((((1px)))))))" };
    write(p, "src/styles/tokens.scss", ":root {\n" + Object.entries(Object.assign({}, shown, blank)).map(([k, v]) => "  " + k + ": " + v + ";").join("\n") + "\n}\n");
    write(p, "src/x.tokens.json", js({ color: { brand: "#1d4ed8" }, endpoint: "url(//api.example.com/v1/FAKEKEY123abc/tiles)", db: { pass: "ENC(FAKEG6N718UuyPE5bHyWKyuLQSm02auQPUtm)" }, note: "hunter 5px",
      grad: "linear-gradient(to right, #000, #fff)", ref: "var(--brand)" }));
    S.scaffoldSteeringFile(p, "design-system.md");
    const read = Object.fromEntries(registry(p).tokens.map((t) => [t.name, t.value]));
    const out = rd(p, REG) + js(S.designSystemReport(p));
    const wrong = Object.keys(shown).filter((k) => read[k] !== shown[k]).concat(Object.keys(blank).filter((k) => read[k] !== ""));
    all("1.35 review 6: a function is guarded by what it holds, never by its name — its arguments are design values in turn: `url(//host/v1/KEY/x)`, `(SecretValue1)`, `ENC(…)`, `fetch(a=b&k=…)`, capitalised words and `rate(5 minutes)` are no values (in a stylesheet the token keeps its name, in JSON the leaf is not listed), while env(), steps(), a gradient's `to right` and nested calc() are; in JSON a var(--x) and a gradient are values, plain words are not (got " +
      js({ wrong: wrong.map((k) => k + "=" + js(read[k])), json: Object.keys(read).filter((k) => !k.startsWith("--")), leaked: SECRETS.filter((s) => out.includes(s)) }) + ")", {
      stylesheet: () => js(wrong) === js([]),
      json: () => js(Object.keys(read).filter((k) => !k.startsWith("--"))) === js(["color.brand", "grad", "ref"]),
      noLeak: () => js(SECRETS.filter((s) => out.includes(s))) === js([]),
    });
  }

  // --- libraries: a one-word note, the project's package.json ------------------------------------------------------------------------------
  {
    const p = project("notes");
    write(p, "package.json", String.fromCharCode(0xfeff) + js({ dependencies: { antd: "^5.0.0" }, devDependencies: { "lucide-react": "^1.0.0" }, peerDependencies: { "@radix-ui/react-dialog": "^1.0.0" } }));
    write(p, REG, "# DS\n\n_Libraries: sonner (required), lucide-react (icons), Material UI (MUI), Ant Design (Antd), Chakra (@chakra-ui/react)_\n");
    const reg = registry(p);
    const f = sized(p);
    const verdicts = [f.approve(["| Reuse | Toast (required) | a message |"]), f.approve(["| Reuse | Icons | the icon set |"]), f.approve(["| Reuse | Table (antd) | the list |", "| Reuse | Card (antdx) | a frame |"]),
      f.approve(["| Reuse | Table (antd) | the list |", "| Reuse | Field (MUI) | the input |"])];
    // each kind of dependency makes a library one; the name's case does not matter; a scope alone counts by its packages
    // (`@radix` is no scope of `@radix-ui/react-dialog`)
    const packaged = ["antd", "Antd", "lucide-react", "@radix-ui", "@radix", "sonner", "Material UI"].map((l) => { write(p, REG, "# DS\n\n_Libraries: " + l + "_\n"); return registry(p).packaged; });
    const msg = f.check();
    // a manifest that is a link out of the project is not read (a file link needs a privilege on Windows: skipped there)
    const q = project("linked-manifest");
    const outside = path.join(tmp, "ds6-outside-package.json");
    fs.writeFileSync(outside, js({ dependencies: { antd: "^5.0.0" } }));
    let linked = null;
    try { fs.symlinkSync(outside, path.join(q, "package.json"), "file"); write(q, REG, "# DS\n\n_Libraries: antd_\n"); linked = registry(q).packaged; } catch { /* no symlink here */ }
    all("1.35 review 6: a library's note names it only when it IS its package or its acronym — `(MUI)`, `(@chakra-ui/react)`, `(Antd)` with antd a dependency — never any one word: `sonner (required)` and `lucide-react (icons)` declare no library called \"required\" / \"icons\", and a size m design citing them is refused; a library is cited as a whole word on both sides (`antdx` is no `antd`); a dependency, a devDependency, a peerDependency and a scope alone (`@radix-ui`, never `@radix`) each make a library one, whatever the case, read from a package.json with a BOM — never through a link that leaves the project; an empty registry that declares libraries says none is a package (got " +
      js({ libraries: reg.libraries, verdicts, packaged, linked, msg: msg && [msg.status, msg.detail.slice(0, 190)] }) + ")", {
      libraries: () => js(reg.libraries) === js(["sonner", "lucide-react", "Material UI", "MUI", "Ant Design", "Antd", "Chakra", "@chakra-ui/react"]),
      gate: () => js(verdicts) === js(["refused:ui-design-system", "refused:ui-design-system", "refused:ui-design-system", "approved"]),
      packaged: () => js(packaged) === js([true, true, true, true, false, false, false]),
      message: () => msg.status === "warn" && /lists no component yet, and no library it declares \(Material UI\) is a package this project depends on/.test(msg.detail),
      linked: () => linked === null || linked === false,
    });
  }

  // --- theme.* : anywhere but under a folder that holds something else by that name ----------------------------------------------------------
  {
    const NOT_UI = ["store", "stores", "state", "redux", "slices", "reducers", "models", "model", "entities", "schemas", "schema", "db", "database", "migrations", "services",
      "controllers", "api", "server", "backend", "fixtures", "mocks", "__mocks__", "tests", "test", "__tests__", "e2e", "types", "hooks", "context", "contexts", "scripts"];
    const UI = ["config", "constants", "docs", "helpers", "lib", "public", "utils"];
    const p = project("theme-dirs");
    for (const d of NOT_UI.concat(UI)) write(p, "src/" + d + "/theme.json", js({ color: { brand: "#1d4ed8" } }));
    write(p, "packages/Store/deep/theme.json", js({ color: { brand: "#1d4ed8" } })); // (any folder above, in any case — a folder of its own: `src/store/` is there already, and a Windows volume folds the case)
    const sources = S.designSystemReport(p).found.sources;
    all("1.35 review 6: a `theme.json` is a token file anywhere but under a folder that holds something else by that name — a store's, a model's, a test's, a script's (each of the " + NOT_UI.length +
      " names, at any depth, in any case) — and IS one under utils/, helpers/, docs/, public/, config/, constants/, lib/: a theme kept beside the helpers is the project's (got " + js(sources) + ")", {
      sources: () => js(sources) === js(UI.map((d) => "src/" + d + "/theme.json")),
    });
  }

  // --- a stylesheet's lines; a bound at one character past it ----------------------------------------------------------------------------------
  {
    const p = project("lines");
    // a minified token file: ONE line of 300 declarations — read whole
    write(p, "src/styles/tokens.min.css", ":root{" + Array.from({ length: 300 }, (_, i) => "--m" + i + ":" + i + "px").join(";") + "}\n");
    // a declaration that goes on below (Prettier's multi-value form, a Sass map): its name, never its first line
    // …while a block's LAST declaration needs no `;` (`--gap: 8px` then `}`), nor a file's last one
    const o = project("lines-open");
    write(o, "src/styles/tokens.css", ":root {\n  --radius: 4px;\n  --shadow-xl:\n    0 1px 2px #0001,\n    0 2px 4px #0002;\n  --shadow-md: 0 1px 2px #0001,\n    0 2px 4px #0002;\n  --pad: 4px\n    8px;\n  --gap: 8px\n\n}\n$breakpoints: (\n  sm: 640px,\n);\n");
    write(o, "src/styles/tokens.eof.scss", "$a: 1px;\n$last: 12px");
    // the indented syntax: a line's end ends a declaration — never one that stops at a `,` or holds no value yet
    write(o, "src/styles/tokens.sass", "$primary: #333\n$stack: 0 1px 2px #0001,\n  0 2px 4px #0002\n:root\n  --space: 8px\n  --none:\n");
    const rep = S.designSystemReport(p);
    const sorted = (x) => js(Object.keys(x).sort().map((k) => k + "=" + x[k]));
    const got = Object.fromEntries(S.designSystemReport(o).newTokens.map((t) => [t.name, t.value]));
    // `<style` at a line's end in a markup file: its attributes follow
    const f = feature(p, "Shop", "src/shop/");
    write(p, "src/shop/page.html", ["<html><head>", "<style", "  type=\"text/css\">", ".x { margin: 9px; }", "</style>", "</head></html>", ""].join("\n"));
    const raw = S.designSystemReport(p, { name: f.slug }).raw.map((x) => x.file.replace("src/shop/", "") + ":" + x.line + " " + x.value);
    // the file-size bound: a token file of exactly a file's read is not "longer"; one character more is — also for a global
    // stylesheet that qualified, and in a feature's report
    const exact = project("size-exact"), over = project("size-over");
    const body = PROPS(6);
    const pad = (n) => body + "/*" + long("x", n - body.length - 4) + "*/";
    write(exact, "src/styles/tokens.css", pad(262144));
    write(over, "src/styles/globals.css", pad(262145));
    const fo = feature(over, "Shop", "src/shop/");
    write(over, "src/shop/Shop.tsx", "export const Shop = () => <b className=\"text-[#123456]\" />;\n");
    const sizes = [S.designSystemReport(exact).limits, S.designSystemReport(over).limits, S.designSystemReport(over, { name: fo.slug }).limits];
    // exactly 20 sources: nothing was cut
    const twenty = project("twenty");
    for (let i = 0; i < 20; i++) write(twenty, "src/styles/tokens.f" + String(i).padStart(2, "0") + ".css", ":root { --f" + i + ": 1px; }\n");
    const t20 = S.designSystemReport(twenty);
    all("1.35 review 6: a minified token file — one line of 300 declarations — is read whole (the line cap left 105); a declaration that goes on below its line (`--shadow-xl:` then its layers, `--pad: 4px` then `8px;`, a Sass map) is listed by its name alone, never by its first line — while a block's last declaration (`--gap: 8px` then `}`), a file's last one and every line of an indented .sass file end without a `;` and keep their value; `<style` ending its line opens a block in a markup file too; `file-size` is said one character past a file's read — not at it —, for a global stylesheet that qualified and in a feature's report; exactly 20 token files say no bound (got " +
      js({ minified: rep.found.tokens, got, raw, sizes, twenty: [t20.found.sources.length, t20.limits] }) + ")", {
      minified: () => rep.found.tokens === 300,
      multiLine: () => sorted(got) === sorted({ "--radius": "4px", "--shadow-xl": "", "--shadow-md": "", "--pad": "", "--gap": "8px", "$breakpoints": "", "$a": "1px", "$last": "12px", "$primary": "#333", "$stack": "", "--space": "8px", "--none": "" }),
      markup: () => js(raw) === js(["page.html:4 margin: 9px"]),
      fileSize: () => js(sizes) === js([[], [{ code: "file-size", read: 262144, file: "src/styles/globals.css" }], [{ code: "file-size", read: 262144, file: "src/styles/globals.css" }]]),
      twenty: () => t20.found.sources.length === 20 && js(t20.limits) === js([]),
    });
  }
};
