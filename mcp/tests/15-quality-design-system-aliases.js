"use strict";
// The design-system registry — 1.35.4: what an import names: the governing tsconfig / jsconfig `paths` and `baseUrl`.
// The nearest tsconfig.json, else jsconfig.json, above the file, read through `extends` as TypeScript reads it — and what
// this scan cannot read so tells nothing; the reading's bounds (100 configs read, 32 links, 100 patterns, 10 targets, 1,024
// characters a path), its cost; a default import's places, each with its own base.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const L = (lines) => lines.join("\n") + "\n";
  const BS = String.fromCharCode(92);
  const REACT = js({ private: true, dependencies: { react: "1" } });
  // (a file's text, or an object written as JSON)
  const project = (tag, files) => {
    const p = path.join(tmp, "proj-dsa-" + tag);
    for (const [rel, text] of Object.entries(files)) write(p, rel, typeof text === "string" ? text : js(text));
    S.initProject(p, ["ui"], "en");
    return p;
  };
  // every name the scan keeps (the seed writes them all)
  const seeded = (p) => { S.scaffoldSteeringFile(p, "design-system.md"); return E.designSystemRegistry(path.join(p, ".specs")).components.map((c) => c.name).sort(); };
  const G = (name) => "export const " + name + " = motion(Base);\n"; // (a candidate: a component only when the project renders it)
  // a page that renders every name it imports: [[names, spec], …]
  const page = (imports) => imports.map(([names, spec]) => "import { " + names.join(", ") + " } from \"" + spec + "\";").join("\n") +
    "\nexport const P = () => <>" + imports.flatMap(([names]) => names).map((n) => "<" + n + " />").join("") + "</>;\n";
  // a folder `c/<id>/` of its own: its tsconfig.json, its kits ([path, name] — from the folder, or from the project's root
  // with a leading `/`), other files, and a page rendering what it imports (all the kits' names from one spec by default)
  const kase = (files, id, cfg, kits, imports, more) => {
    const at = (rel) => (rel[0] === "/" ? rel.slice(1) : "c/" + id + "/" + rel);
    files[at("tsconfig.json")] = cfg;
    for (const [rel, name] of kits) files[at(rel)] = G(name);
    for (const [rel, text] of Object.entries(more || {})) files[at(rel)] = text;
    files[at("p.tsx")] = page(typeof imports === "string" ? [[kits.map(([, n]) => n), imports]] : imports);
  };
  // { "<name> seeded": …, "<name> not seeded": … } for all()
  const verdicts = (got, ins, outs) => {
    const o = {};
    for (const n of ins) o[n + " seeded"] = got.includes(n);
    for (const n of outs) o[n + " not seeded"] = !got.includes(n);
    return o;
  };
  const among = (got, names) => got.filter((n) => names.includes(n));
  // a timed pair for remeasure(): both scans, the hard one first → [hard ms, soft ms, hard settles Moving, soft settles Moving]
  const pair = (hard, soft) => () => {
    const t0 = Date.now(); const h = S.designSystemReport(hard); const t1 = Date.now(); const s = S.designSystemReport(soft);
    return [t1 - t0, Date.now() - t1, h.missing.some((m) => m.name === "Moving"), s.missing.some((m) => m.name === "Moving")];
  };

  // --- real-world configs: what each settles, and what it must not -----------------------------------------------------------
  {
    // Laravel's starter kits: tsc --init's JSONC (block and line comments, a commented-out baseUrl, `/**/` inside a string,
    // trailing commas), `@/*` → `./resources/js/*`, no baseUrl — a render settles a candidate, a call drops a weak name; the
    // guess still stands beside the config's key (`src/`)
    const lara = seeded(project("laravel", {
      "package.json": REACT,
      "tsconfig.json": L(["{", "  \"compilerOptions\": {", "    /* Visit https://aka.ms/tsconfig to read more about this file */", "    // \"baseUrl\": \"./\",", "    \"paths\": {",
        "      \"@/*\": [\"./resources/js/*\"]", "    }, /* Specify a set of entries that re-map imports. */", "    \"jsx\": \"react-jsx\",", "  },", "  \"include\": [\"resources/js/**/*.tsx\",],", "}"]),
      "resources/js/components/ui/motion-kit.tsx": G("LaraGlow"),
      "resources/js/components/ui/money.tsx": "export function FormatMoney(v) { return v.toFixed(2); }\n",
      "src/components/ui/guess-kit.tsx": G("GuessGlow"),
      "resources/js/pages/welcome.tsx": L(["import { LaraGlow } from \"@/components/ui/motion-kit\";", "import { FormatMoney } from \"@/components/ui/money\";", "import { GuessGlow } from \"@/components/ui/guess-kit\";",
        "export default function W() { const m = FormatMoney(3); return <><LaraGlow /><GuessGlow /></>; }"]),
    }));
    // inertia-rails' starter: a solution tsconfig.json (`files: []`, references) that writes the paths too
    const rails = seeded(project("inertia", {
      "package.json": REACT,
      "tsconfig.json": { files: [], references: [{ path: "./tsconfig.app.json" }, { path: "./tsconfig.node.json" }], compilerOptions: { paths: { "@/*": ["./app/javascript/*"] } } },
      "tsconfig.app.json": { compilerOptions: { paths: { "@/*": ["./app/javascript/*"] } } },
      "app/javascript/components/ui/rails-kit.tsx": G("RailsGlow"),
      "app/javascript/pages/home.tsx": page([[["RailsGlow"], "@/components/ui/rails-kit"]]),
    }));
    // an alias spelled like a scope; the longest prefix wins — never the first written, nor both
    const scope = seeded(project("scope", {
      "package.json": REACT,
      "tsconfig.json": { compilerOptions: { baseUrl: ".", paths: { "@components/*": ["src/components/*"], "@kit/*": ["./kits/a/*"], "@kit/ui/*": ["./kits/b/components/*"] } } },
      "src/components/ui/at-kit.tsx": G("AtGlow"),
      "kits/a/ui/x.tsx": G("WrongGlow"),
      "kits/b/components/x.tsx": G("RightGlow"),
      "src/app/page.tsx": page([[["AtGlow"], "@components/ui/at-kit"], [["RightGlow", "WrongGlow"], "@kit/ui/x"]]),
    }));
    // Nx: tsconfig.base.json's exact keys to a library's entry (an entry stands for its library's folder — its `export *`
    // names no file here, so the folder alone settles NxGlow), each app's tsconfig.json extends it; a default import's
    // base name from EVERY key (the second target's `logo`); a relative `…/mark/index` names its folder's base
    const nx = seeded(project("nx", {
      "package.json": REACT,
      "tsconfig.base.json": { compilerOptions: { baseUrl: ".", paths: { "@acme/ui": ["libs/ui/src/index.ts"], "@acme/brand": ["libs/brand/src/gone/index.tsx", "libs/brand/src/components/logo/index.tsx"] } } },
      "apps/shop/tsconfig.json": { extends: "../../tsconfig.base.json", files: [], references: [{ path: "./tsconfig.app.json" }] },
      "libs/ui/src/index.ts": "export * from \"./lib/glow\";\n",
      "libs/ui/src/lib/components/glow.tsx": G("NxGlow"),
      "libs/brand/src/components/logo/index.tsx": L(["const LogoMark = makeLogo(config);", "export default LogoMark;"]),
      "libs/brand/src/components/mark/index.tsx": L(["const MarkTwo = makeMark(config);", "export default MarkTwo;"]),
      "apps/shop/src/app/page.tsx": L(["import { NxGlow } from \"@acme/ui\";", "import Brand from \"@acme/brand\";", "import Mark from \"../../../../libs/brand/src/components/mark/index\";",
        "export default function P() { return <><NxGlow /><Brand /><Mark /></>; }"]),
    }));
    // SvelteKit 2: the generated config in a hidden folder, reached by `extends` (`$lib` → `../src/lib`: a `..` target) —
    // from a script, and from a `.svelte` page's script block (markup files are read: 1.35.4)
    const svk = seeded(project("sveltekit", {
      "package.json": REACT,
      "tsconfig.json": { extends: "./.svelte-kit/tsconfig.json" },
      ".svelte-kit/tsconfig.json": { compilerOptions: { paths: { $lib: ["../src/lib"], "$lib/*": ["../src/lib/*"] } } },
      "src/lib/components/ui/svk.tsx": G("SvkGlow"),
      "src/lib/components/ui/svk2.tsx": G("SvkGlow2"),
      "src/routes/page.tsx": page([[["SvkGlow"], "$lib/components/ui/svk"]]),
      "src/routes/+page.svelte": L(["<script lang=\"ts\">", "  import { SvkGlow2 } from \"$lib/components/ui/svk2\";", "</script>", "", "<SvkGlow2 />"]),
    }));
    // shadcn's monorepo: a package's config extended (it writes nothing of the project's), a `..` target into a folder no
    // manifest names; one that leaves the project is dropped (`outside/` IN the project is what clamping would reach)
    const mono = seeded(project("monorepo", {
      "package.json": { private: true, workspaces: ["apps/*", "packages/*"] },
      "apps/web/package.json": REACT,
      "apps/web/tsconfig.json": { extends: "@workspace/typescript-config/nextjs.json", compilerOptions: { paths: { "@/*": ["./*"], "@shared/*": ["../../shared/src/*"], "@out/*": ["../../../outside/*"] } } },
      "shared/src/components/sh.tsx": G("SharedGlow"),
      "outside/components/far.tsx": G("FarGlow"),
      "apps/web/app/page.tsx": page([[["SharedGlow"], "@shared/components/sh"], [["FarGlow"], "@out/components/far"]]),
    }));
    // the nearest config governs (a package.json alone between them does not); a sibling's never applies; a child's paths
    // REPLACE its parent's; inherited ones resolve against the folder of the config that wrote them; `${configDir}` is the
    // governing config's folder; an extends without `.json` gets it
    const gov = seeded(project("govern", {
      "package.json": REACT,
      "tsconfig.json": { compilerOptions: { paths: { "@ui/*": ["./shared/ui/*"] } } },
      "shared/ui/ckit.tsx": G("RootCGlow"),
      "apps/c/tsconfig.json": { compilerOptions: { paths: { "@ui/*": ["./src/ui/*"] } } },
      "apps/c/src/ui/ckit.tsx": G("CGlow"),
      "apps/c/src/page.tsx": page([[["CGlow", "RootCGlow"], "@ui/ckit"]]),
      "apps/c2/package.json": { name: "c2", private: true },
      "shared/ui/c2kit.tsx": G("RootGovernsGlow"),
      "apps/c2/src/page.tsx": page([[["RootGovernsGlow"], "@ui/c2kit"]]),
      "apps/a/tsconfig.json": { compilerOptions: { paths: { "@sib/*": ["./src/ui/*"] } } },
      "apps/a/src/ui/akit.tsx": G("SibGlow"),
      "apps/b/tsconfig.json": "{}\n",
      "apps/b/src/page.tsx": page([[["SibGlow"], "@sib/akit"]]),
      "config/tsconfig.base.json": { compilerOptions: { paths: { "@p/*": ["../parent/ui/*"], "@cd/*": ["${configDir}/src/ui/*"] } } },
      "parent/ui/pkit.tsx": G("PGlow"),
      "apps/inherit/tsconfig.json": { extends: "../../config/tsconfig.base.json" },
      "apps/inherit/src/ui/cdkit.tsx": G("CdGlow"),
      "apps/inherit/parent/ui/pkit.tsx": G("WrongPGlow"),
      "apps/inherit/src/page.tsx": page([[["PGlow", "WrongPGlow"], "@p/pkit"], [["CdGlow"], "@cd/cdkit"]]),
      "apps/replace/tsconfig.json": { extends: "../../config/tsconfig.base", compilerOptions: { paths: { "@q/*": ["./src/ui/*"] } } },
      "parent/ui/pkit2.tsx": G("PGlow2"),
      "apps/replace/src/page.tsx": page([[["PGlow2"], "@p/pkit2"]]),
      "apps/noext/tsconfig.json": { extends: "../../config/tsconfig.base" },
      "parent/ui/pkit3.tsx": G("PGlow3"),
      "apps/noext/src/page.tsx": page([[["PGlow3"], "@p/pkit3"]]),
    }));
    // a `*` catch-all never hides a workspace package; a jsconfig.json alone governs (its baseUrl); a tsconfig.json beside
    // one wins
    const catchall = seeded(project("catchall", {
      "package.json": { private: true, workspaces: ["packages/*"], dependencies: { react: "1" } },
      "tsconfig.json": { compilerOptions: { baseUrl: ".", paths: { "*": ["./src/types/*"] } } },
      "packages/kit/package.json": { name: "@acme/kit" },
      "packages/kit/src/components/fx.tsx": G("CatchGlow"),
      "src/app/page.tsx": page([[["CatchGlow"], "@acme/kit/components/fx"]]),
      "apps/js/jsconfig.json": { compilerOptions: { baseUrl: "client" } },
      "apps/js/client/components/ui/jkit.tsx": G("JsBaseGlow"),
      "apps/js/client/pages/p.tsx": page([[["JsBaseGlow"], "components/ui/jkit"]]),
      "apps/both/tsconfig.json": { compilerOptions: { baseUrl: "ts" } },
      "apps/both/jsconfig.json": { compilerOptions: { baseUrl: "js" } },
      "apps/both/ts/components/ui/tkit.tsx": G("TsWins"),
      "apps/both/js/components/ui/tkit.tsx": G("JsLoses"),
      "apps/both/pages/p.tsx": page([[["TsWins", "JsLoses"], "components/ui/tkit"]]),
    }));
    const got = { lara: among(lara, ["LaraGlow", "GuessGlow", "FormatMoney"]), rails: among(rails, ["RailsGlow"]), scope: among(scope, ["AtGlow", "RightGlow", "WrongGlow"]),
      nx: among(nx, ["NxGlow", "LogoMark", "MarkTwo"]), svk: among(svk, ["SvkGlow", "SvkGlow2"]), mono: among(mono, ["SharedGlow", "FarGlow"]),
      gov: among(gov, ["CGlow", "RootCGlow", "RootGovernsGlow", "SibGlow", "PGlow", "WrongPGlow", "CdGlow", "PGlow2", "PGlow3"]), catchall: among(catchall, ["CatchGlow", "JsBaseGlow", "TsWins", "JsLoses"]) };
    all("1.35.4: an import is followed through the config that governs its file — Laravel's JSONC `@/*` → `./resources/js/*` (a render settles LaraGlow, a call drops FormatMoney; the guess's `src/` stands beside it), inertia-rails' solution tsconfig.json, an alias spelled like a scope and the longest prefix, Nx's entry for its library and a default import's base from every key, SvelteKit's `$lib` through a hidden folder's config (a `.svelte` page too), a package's extends and a `..` target (one above the project dropped), the nearest config (a package.json alone between is none; a sibling's never), a child's paths replacing its parent's, inherited ones from their writer's folder, `${configDir}`, an extends without `.json`, a `*` catch-all beside a workspace package, a jsconfig.json alone, a tsconfig.json over the jsconfig.json beside it (got " + js(got) + ")", Object.assign(
      verdicts(lara, ["LaraGlow", "GuessGlow"], ["FormatMoney"]), verdicts(rails, ["RailsGlow"], []), verdicts(scope, ["AtGlow", "RightGlow"], ["WrongGlow"]),
      verdicts(nx, ["NxGlow", "LogoMark", "MarkTwo"], []), verdicts(svk, ["SvkGlow", "SvkGlow2"], []), verdicts(mono, ["SharedGlow"], ["FarGlow"]),
      verdicts(gov, ["CGlow", "RootGovernsGlow", "CdGlow", "PGlow", "PGlow3"], ["RootCGlow", "SibGlow", "WrongPGlow", "PGlow2"]),
      verdicts(catchall, ["CatchGlow", "JsBaseGlow", "TsWins"], ["JsLoses"])));
  }

  // --- a pattern and its targets, as TypeScript reads them ----------------------------------------------------------------------
  {
    const f = { "package.json": REACT };
    // a rooted target names no file of the project (`/etc/*`, `C:/../x/*` — rooted however its `..` would fold)
    kase(f, "t-rooted", { compilerOptions: { paths: { "@ra/*": ["/etc/*"], "@rb/*": ["C:/../x/*"] } } }, [["etc/components/k.tsx", "RootedNeg"], ["x/components/k.tsx", "DriveNeg"]],
      [[["RootedNeg"], "@ra/components/k"], [["DriveNeg"], "@rb/components/k"]]);
    // a target above the project is dropped — never clamped to its root (either slash)
    kase(f, "t-up", { compilerOptions: { paths: { "@up/*": ["../../../away/*"], "@bk/*": [["..", "..", "..", "away2", "*"].join(BS)] } } }, [["/away/components/k.tsx", "UpNeg"], ["/away2/components/k.tsx", "UpBackNeg"]],
      [[["UpNeg"], "@up/components/k"], [["UpBackNeg"], "@bk/components/k"]]);
    // a backslash is a slash
    kase(f, "t-back", { compilerOptions: { paths: { "@bs/*": [["..", "t-back-to", "*"].join(BS)] } } }, [["/c/t-back-to/components/k.tsx", "BackslashPos"]], "@bs/components/k");
    // another `${…}`, or `${configDir}` in another case, names no file (TypeScript replaces `${configDir}` alone, as written)
    kase(f, "t-tpl", { compilerOptions: { paths: { "@tp/*": ["${other}/x/*"], "@tc/*": ["${CONFIGDIR}/y/*"] } } }, [["${other}/x/components/k.tsx", "TplNeg"], ["${CONFIGDIR}/y/components/k.tsx", "TplCaseNeg"]],
      [[["TplNeg"], "@tp/components/k"], [["TplCaseNeg"], "@tc/components/k"]]);
    // a target's second `*` is no star: the path holds a `*` and names no file
    kase(f, "t-star2", { compilerOptions: { paths: { "@s2/*": ["./components/*/two/*"] } } }, [["components/k/two/k.tsx", "StarTwoNeg"]], "@s2/k");
    // a target that is no string is passed (the string after it is read); a key's value that is no list has no target
    kase(f, "t-list", { compilerOptions: { paths: { "@n/*": [5, null, "./n/*"], "@o": "./components/ok" } } }, [["n/components/k.tsx", "NonStringPos"], ["components/ok.tsx", "StringNeg"]],
      [[["NonStringPos"], "@n/components/k"], [["StringNeg"], "@o"]]);
    // ten targets of a key are read, the eleventh is not
    kase(f, "t-eleven", { compilerOptions: { paths: { "@t/*": Array.from({ length: 11 }, (_, i) => "./t" + i + "/*") } } }, [["t9/components/k.tsx", "TenthPos"], ["t10/components/k.tsx", "EleventhNeg"]], "@t/components/k");
    // every target is taken, in order (TypeScript stops at the first that exists: a later one that also exists over-matches)
    kase(f, "t-order", { compilerOptions: { paths: { "@g/*": ["./one/*", "./two/*"] } } }, [["one/components/k.tsx", "FirstTargetPos"], ["two/components/k.tsx", "SecondTargetPos"]], "@g/components/k");
    // an exact key before any pattern
    kase(f, "t-exact", { compilerOptions: { paths: { "@lib": ["./exact/components/kit"], "@*": ["./star/components/*"] } } }, [["exact/components/kit.tsx", "ExactPos"], ["star/components/lib.tsx", "StarNeg"]], "@lib");
    // keys are matched case-sensitively (as written, never lower-cased)
    kase(f, "t-case", { compilerOptions: { paths: { "@lib": ["./components/lk"], "@Kit/*": ["./cap/*"] } } }, [["components/lk.tsx", "CaseNeg"], ["cap/components/k.tsx", "CapPos"]],
      [[["CaseNeg"], "@LIB"], [["CapPos"], "@Kit/components/k"]]);
    // two prefixes of one length: the first written wins (a suffix makes no key longer)
    kase(f, "t-tie", { compilerOptions: { paths: { "@t/*": ["./first/*"], "@t/*.svg": ["./second/*"] } } }, [["first/components/a.svg.tsx", "TieFirstPos"], ["second/components/a.tsx", "TieSecondNeg"]], "@t/components/a.svg");
    // a prefix and a suffix that overlap the name match nothing; a suffix the name lacks matches nothing
    kase(f, "t-overlap", { compilerOptions: { paths: { "#x*x": ["./components/fixed"] } } }, [["components/fixed.tsx", "OverlapNeg"]], "#x");
    kase(f, "t-suffix", { compilerOptions: { paths: { "#svg/*.svg": ["./components/*.svg"] } } }, [["components/home.svg.tsx", "SuffixNeg"]], "#svg/home.png");
    // the longest prefix wins even with no target: it shadows the shorter key, and stops the baseUrl fallback
    kase(f, "t-shadow", { compilerOptions: { baseUrl: "./lib", paths: { "@e/*": ["./short/*"], "@e/deep/*": [] } } }, [["lib/short/deep/components/k.tsx", "ShortNeg"], ["lib/@e/deep/components/k.tsx", "FallbackNeg"]], "@e/deep/components/k");
    // a key of two `*` matches nothing and shadows nothing
    kase(f, "t-two", { compilerOptions: { paths: { "@x/**": ["./never/*"], "@x/*": ["./x/*"] } } }, [["x/components/k.tsx", "TwoStarPos"], ["never/components/k.tsx", "NeverNeg"]], "@x/components/k");
    // a `..` in what the star stands for is resolved
    kase(f, "t-norm", { compilerOptions: { paths: { "@/*": ["./lib/*"] } } }, [["lib/components/k.tsx", "NormPos"]], "@/components/x/../k");
    // 100 patterns are read, 101 tell nothing
    const stars = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => ["@s" + i + "/*", ["./s" + i + "/*"]]));
    kase(f, "t-stars100", { compilerOptions: { paths: stars(100) } }, [["s0/components/k.tsx", "Stars100Pos"]], "@s0/components/k");
    kase(f, "t-stars101", { compilerOptions: { paths: stars(101) } }, [["s0/components/k.tsx", "Stars101Neg"]], "@s0/components/k");
    const got = seeded(project("targets", f));
    const IN = ["BackslashPos", "NonStringPos", "TenthPos", "FirstTargetPos", "SecondTargetPos", "ExactPos", "CapPos", "TieFirstPos", "TwoStarPos", "NormPos", "Stars100Pos"];
    const OUT = ["RootedNeg", "DriveNeg", "UpNeg", "UpBackNeg", "TplNeg", "TplCaseNeg", "StarTwoNeg", "StringNeg", "EleventhNeg", "StarNeg", "CaseNeg", "TieSecondNeg", "OverlapNeg", "SuffixNeg", "ShortNeg", "FallbackNeg", "NeverNeg", "Stars101Neg"];
    all("1.35.4: a pattern's targets as TypeScript reads them — a rooted target (`/etc/*`, `C:/../x/*`), one above the project (either slash: never clamped), another `${…}` or a `${CONFIGDIR}`, a second `*`, an eleventh target name no file; a backslash is a slash, a target that is no string is passed, every target is taken in order; an exact key before a pattern, keys case-sensitive, the longest prefix (a tie: the first written; a key with no target still shadows the shorter one and stops the baseUrl fallback), a prefix and suffix that overlap or a suffix the name lacks match nothing, a key of two `*` matches nothing, a `..` in the star resolved; 100 patterns read, 101 tell nothing (got " + js(among(got, IN.concat(OUT))) + ")", verdicts(got, IN, OUT));
  }

  // --- `extends` and `baseUrl`, as TypeScript reads them; what this scan cannot read tells nothing --------------------------
  {
    const f = { "package.json": REACT,
      "config/base.json": { compilerOptions: { baseUrl: "..", paths: { "@p/*": ["shared/*"] } } },
      "config/cd.json": { compilerOptions: { paths: { "@cd/*": ["${configDir}/src/*"] }, baseUrl: "${configDir}/lib" } } };
    // targets below baseUrl; with a key matched, no baseUrl key beside it
    kase(f, "b-lib", { compilerOptions: { baseUrl: "./lib", paths: { "@/*": ["*"] } } }, [["lib/components/bk.tsx", "LibPos"], ["lib/@/components/bk.tsx", "AtNeg"]], "@/components/bk");
    // baseUrl alone: a name of two segments or more — never one segment (a package's), never a rooted name
    kase(f, "b-one", { compilerOptions: { baseUrl: "./lib/components" } }, [["lib/components/kitone.tsx", "OneSegNeg"]], "kitone");
    kase(f, "b-root", { compilerOptions: { baseUrl: "./lib" } }, [["lib/components/kr.tsx", "RootedSpecNeg"], ["lib/components/kb.tsx", "BaseOnlyPos"]], [[["RootedSpecNeg"], "/components/kr"], [["BaseOnlyPos"], "components/kb"]]);
    // a rooted baseUrl, or one above the project: the folder's config tells nothing
    kase(f, "b-abs", { compilerOptions: { baseUrl: "/abs/src", paths: { "@r/*": ["./r/*"] } } }, [["abs/src/r/components/k.tsx", "AbsBaseNeg"]], "@r/components/k");
    kase(f, "b-up", { compilerOptions: { baseUrl: "../../..", paths: { "@r/*": ["./r/*"] } } }, [["r/components/k.tsx", "UpBaseNeg"]], "@r/components/k");
    // a list extends, the later winning: `${configDir}` in a shared config is the governing config's folder (paths and baseUrl)
    kase(f, "b-cdir", { extends: ["../../config/base.json", "../../config/cd"] }, [["src/components/k.tsx", "CdTargetPos"], ["lib/components/ui/bk.tsx", "CdBasePos"], ["/shared/components/pk.tsx", "FirstWinsNeg"]],
      [[["CdTargetPos"], "@cd/components/k"], [["CdBasePos"], "components/ui/bk"], [["FirstWinsNeg"], "@p/components/pk"]]);
    // `paths: null` unsets the parent's; `baseUrl: null` unsets the parent's (its paths then from their writer's folder)
    kase(f, "b-np", { extends: "../../config/base.json", compilerOptions: { paths: null } }, [["/shared/components/np.tsx", "NullPathsNeg"]], "@p/components/np");
    kase(f, "b-nb", { extends: "../../config/base.json", compilerOptions: { baseUrl: null } }, [["/config/shared/components/nb.tsx", "NullBasePos"], ["/shared/components/nb.tsx", "NullBaseNeg"]], "@p/components/nb");
    // a child's paths replace the parent's, below the parent's baseUrl (its folder's, `..` of config/)
    kase(f, "b-rp", { extends: "../../config/base", compilerOptions: { paths: { "@q/*": ["./q/*"] } } }, [["/q/components/qk.tsx", "InheritBasePos"], ["q/components/qk.tsx", "InheritBaseNeg"], ["/shared/components/rp.tsx", "ReplacedNeg"]],
      [[["InheritBasePos", "InheritBaseNeg"], "@q/components/qk"], [["ReplacedNeg"], "@p/components/rp"]]);
    // a package's config writes nothing of the project's — and neither does `.cfg/base.json` (neither `./` nor `../`: a package's)
    kase(f, "b-pkg", { extends: "@tsconfig/strictest/tsconfig.json", compilerOptions: { paths: { "@d/*": ["./d/*"] } } }, [["d/components/k.tsx", "PkgPos"]], "@d/components/k");
    kase(f, "b-dot", { extends: ".cfg/base.json" }, [["s/components/k.tsx", "DotNeg"]], "@s/components/k", { ".cfg/base.json": js({ compilerOptions: { paths: { "@s/*": ["../s/*"] } } }) });
    // a rooted extends (either form) or one above the project: unknown — nothing, unless the child writes paths AND baseUrl
    kase(f, "b-rx", { extends: "/etc/base.json", compilerOptions: { paths: { "@r/*": ["./r/*"] } } }, [["r/components/k.tsx", "RootedExtNeg"]], "@r/components/k");
    kase(f, "b-rxd", { extends: "C:/etc/base.json", compilerOptions: { paths: { "@r/*": ["./r/*"] } } }, [["r/components/k.tsx", "DriveExtNeg"]], "@r/components/k");
    kase(f, "b-ux", { extends: "../../../outside.json", compilerOptions: { paths: { "@r/*": ["./r/*"] } } }, [["r/components/k.tsx", "UpExtNeg"]], "@r/components/k");
    kase(f, "b-ux2", { extends: "../../../outside.json", compilerOptions: { baseUrl: ".", paths: { "@r/*": ["./r/*"] } } }, [["r/components/k.tsx", "UpExtBothPos"]], "@r/components/k");
    // an unparsable link (TypeScript's lenient parser may read it): the same
    kase(f, "b-br", { extends: "./broken.json", compilerOptions: { paths: { "@e/*": ["./e/*"] } } }, [["e/components/k.tsx", "BrokenNeg"]], "@e/components/k", { "broken.json": "{ not json\n" });
    kase(f, "b-br2", { extends: "./broken.json", compilerOptions: { baseUrl: ".", paths: { "@e/*": ["./e/*"] } } }, [["e/components/k.tsx", "BrokenBothPos"]], "@e/components/k", { "broken.json": "{ not json\n" });
    // a missing link applies nothing; a circle applies the config met again nothing; a diamond applies the shared config
    // again, last (its paths win)
    kase(f, "b-ms", { extends: "./missing.json", compilerOptions: { paths: { "@m/*": ["./m/*"] } } }, [["m/components/k.tsx", "MissingPos"]], "@m/components/k");
    kase(f, "b-ci", { extends: "./i2.json" }, [["i/components/k.tsx", "CirclePos"]], "@i/components/k", { "i2.json": js({ extends: "./tsconfig.json", compilerOptions: { paths: { "@i/*": ["./i/*"] } } }) });
    kase(f, "b-di", { extends: ["./b.json", "./d.json"] }, [["from-d/components/k.tsx", "DiamondPos"], ["from-b/components/k.tsx", "DiamondNeg"]], "@r/components/k",
      { "b.json": js({ extends: "./d.json", compilerOptions: { paths: { "@r/*": ["./from-b/*"] } } }), "d.json": js({ compilerOptions: { paths: { "@r/*": ["./from-d/*"] } } }) });
    // a config of `null`, a list extends with an entry that is no string, a BOM and trailing commas: read without a crash
    kase(f, "b-nu", "null\n", [["s/components/k.tsx", "NullCfgNeg"]], "@s/components/k");
    kase(f, "b-ns", { extends: [5, "./b.json"] }, [["s/components/k.tsx", "NonStrExtPos"]], "@s/components/k", { "b.json": js({ compilerOptions: { paths: { "@s/*": ["./s/*"] } } }) });
    kase(f, "b-bom", String.fromCharCode(0xfeff) + "{ \"compilerOptions\": { \"paths\": { \"@b/*\": [\"./bom/*\"], }, }, }\n", [["bom/components/k.tsx", "BomPos"]], "@b/components/k");
    const got = seeded(project("chains", f));
    // 32 links are followed, the 33rd tells nothing (in width and in depth), unless the child writes paths AND baseUrl
    const lk = { "package.json": REACT };
    for (let i = 0; i < 33; i++) lk["cfg/c" + i + ".json"] = { compilerOptions: { strict: true } };
    const ext = (n) => Array.from({ length: n }, (_, i) => "../cfg/c" + i + ".json");
    for (const [dir, n, base, name] of [["a32", 32, false, "Links32Pos"], ["a33", 33, false, "Links33Neg"], ["a33b", 33, true, "Links33BothPos"]]) {
      lk[dir + "/tsconfig.json"] = { extends: ext(n), compilerOptions: Object.assign(base ? { baseUrl: "." } : {}, { paths: { "@z/*": ["./z/*"] } }) };
      lk[dir + "/z/components/k.tsx"] = G(name);
      lk[dir + "/p.tsx"] = page([[[name], "@z/components/k"]]);
    }
    lk["d/tsconfig.json"] = { extends: "./x0.json", compilerOptions: { paths: { "@z/*": ["./z/*"] } } };
    for (let i = 0; i < 33; i++) lk["d/x" + i + ".json"] = i < 32 ? { extends: "./x" + (i + 1) + ".json" } : { compilerOptions: { strict: true } };
    lk["d/z/components/k.tsx"] = G("DeepNeg");
    lk["d/p.tsx"] = page([[["DeepNeg"], "@z/components/k"]]);
    const links = seeded(project("links", lk));
    // a config reached through a link out of the project is never read: unknown (the same shape inside is read)
    write(tmp, "proj-dsa-outside/base.json", js({ compilerOptions: { strict: true } }));
    const jp = project("junction", { "package.json": REACT, "real/base.json": { compilerOptions: { strict: true } },
      "app/tsconfig.json": { extends: "../linked/base.json", compilerOptions: { paths: { "@m/*": ["./m/*"] } } }, "app/m/components/k.tsx": G("LinkedNeg"), "app/p.tsx": page([[["LinkedNeg"], "@m/components/k"]]),
      "ctl/tsconfig.json": { extends: "../real/base.json", compilerOptions: { paths: { "@m/*": ["./m/*"] } } }, "ctl/m/components/k.tsx": G("LinkCtlPos"), "ctl/p.tsx": page([[["LinkCtlPos"], "@m/components/k"]]) });
    let linked = true;
    try { fs.symlinkSync(path.join(tmp, "proj-dsa-outside"), path.join(jp, "linked"), "junction"); } catch { linked = false; } // (a junction on Windows, a symlink elsewhere)
    const junction = seeded(jp);
    const IN = ["LibPos", "BaseOnlyPos", "CdTargetPos", "CdBasePos", "NullBasePos", "InheritBasePos", "PkgPos", "UpExtBothPos", "BrokenBothPos", "MissingPos", "CirclePos", "DiamondPos", "NonStrExtPos", "BomPos"];
    const OUT = ["AtNeg", "OneSegNeg", "RootedSpecNeg", "AbsBaseNeg", "UpBaseNeg", "FirstWinsNeg", "NullPathsNeg", "NullBaseNeg", "InheritBaseNeg", "ReplacedNeg", "DotNeg", "RootedExtNeg", "DriveExtNeg", "UpExtNeg", "BrokenNeg", "DiamondNeg", "NullCfgNeg"];
    all("1.35.4: `extends` and `baseUrl` as TypeScript reads them — targets below baseUrl (no baseUrl key beside a matched one; baseUrl alone for two segments or more, never one nor a rooted name), a list extends with the later winning and `${configDir}` the governing config's folder, `paths: null` / `baseUrl: null` unsetting the parent's, a child's paths below the parent's baseUrl, a package's config (and `.cfg/…`) writing nothing, a missing link nothing, a circle and a diamond as TypeScript applies them, a `null` config, a list's entry that is no string, a BOM and trailing commas; what this scan cannot read as TypeScript would tells nothing — a rooted or above-the-project baseUrl, a rooted (either form) or above-the-project extends, an unparsable link (unless the child writes paths AND baseUrl), a 33rd link in width or depth, a config through a link out of the project" + (linked ? "" : " (no link here: that check skipped)") + " (got " + js({ chains: among(got, IN.concat(OUT)), links: among(links, ["Links32Pos", "Links33BothPos", "Links33Neg", "DeepNeg"]), junction: among(junction, ["LinkedNeg", "LinkCtlPos"]), linked }) + ")",
      Object.assign(verdicts(got, IN, OUT), verdicts(links, ["Links32Pos", "Links33BothPos"], ["Links33Neg", "DeepNeg"]), verdicts(junction, ["LinkCtlPos"], linked ? ["LinkedNeg"] : [])));
  }

  // --- the bounds: 100 configs read in a scan (each once), recorded past the 2,000 roots ----------------------------------------
  {
    // 101 apps, each its own config: the 101st asked (a100) is past the reads
    const a = { "package.json": REACT };
    for (let i = 0; i < 101; i++) {
      const d = "apps/a" + String(i).padStart(3, "0") + "/", g = "Glow" + String(i).padStart(3, "0");
      a[d + "tsconfig.json"] = { compilerOptions: { paths: { "@k/*": ["./kit/*"] } } };
      a[d + "kit/components/x.tsx"] = G(g);
      a[d + "page.tsx"] = page([[[g], "@k/components/x"]]);
    }
    const reads = seeded(project("bound-reads", a)).filter((n) => /^Glow\d+$/.test(n));
    // a config met after the 2,000 roots the guess keeps still governs its folder
    const b = { "package.json": REACT };
    for (let i = 0; i < 2000; i++) b["examples/e" + String(i).padStart(4, "0") + "/package.json"] = { name: "ex-" + i };
    Object.assign(b, { "zapp/tsconfig.json": { compilerOptions: { paths: { "@z/*": ["./lib/*"] } } }, "zapp/lib/components/z.tsx": G("ZGlow"), "zapp/page.tsx": page([[["ZGlow"], "@z/components/z"]]) });
    const roots = seeded(project("bound-roots", b));
    // 99 apps extending one base: the base is read once — 100 reads, every app's alias read
    const c = { "package.json": REACT, "tsconfig.base.json": { compilerOptions: { paths: { "@k/*": ["./kits/*"] } } } };
    for (let i = 0; i < 99; i++) {
      const d = "apps/b" + String(i).padStart(3, "0") + "/", g = "Shared" + String(i).padStart(3, "0");
      c[d + "tsconfig.json"] = { extends: "../../tsconfig.base.json" };
      c["kits/components/k" + i + ".tsx"] = G(g);
      c[d + "page.tsx"] = page([[[g], "@k/components/k" + i]]);
    }
    const shared = seeded(project("bound-shared", c)).filter((n) => /^Shared\d+$/.test(n));
    all("1.35.4: the reading's bounds — 100 config files read in a scan (101 apps: the first 100 asked settle, the 101st tells nothing), each read once (99 apps sharing one base: all 99 settle in 100 reads), a config past the 2,000 roots still governs its folder (got " + js({ reads: reads.length, first: reads[0], last: reads[reads.length - 1], zglow: roots.includes("ZGlow"), shared: shared.length }) + ")", {
      reads: reads.length === 100 && reads.includes("Glow000") && reads.includes("Glow099") && !reads.includes("Glow100"),
      roots: roots.includes("ZGlow"),
      shared: shared.length === 99,
    });
  }

  // --- a path no file system holds: a key, a target or a baseUrl longer than DS_PATH_CHARS (1,024) tells nothing -----------------
  {
    // (a string of n characters: `head`, `step` over and over — `a/`, or `a/../`, a step that folds back —, `/` to the length, `tail`)
    const sized = (head, n, tail, step = "a/") => { const room = n - head.length - tail.length; return head + step.repeat(Math.floor(room / step.length)) + "/".repeat(room % step.length) + tail; };
    const f = { "package.json": REACT }, lengths = [];
    for (const [n, tag] of [[1024, "Pos"], [1025, "Neg"]]) {
      const target = sized("./", n, "*"), key = sized("@", n, "/*"), base = sized("./", n, "", "a/../");
      lengths.push(target.length, key.length, base.length);
      // one long target on a key of its own: the kit the config's OTHER, short, key reaches
      kase(f, "l-target" + n, { compilerOptions: { paths: { "@long/*": [target], "@sh/*": ["./sh/*"] } } }, [["sh/components/k.tsx", "LongTarget" + n + tag]], "@sh/components/k");
      // a long key beside the short one; a long baseUrl that folds back to its own folder (the short key's target below it)
      kase(f, "l-key" + n, { compilerOptions: { paths: { [key]: ["./a/*"], "@sh/*": ["./sh/*"] } } }, [["sh/components/k.tsx", "LongKey" + n + tag]], "@sh/components/k");
      kase(f, "l-base" + n, { compilerOptions: { baseUrl: base, paths: { "@sh/*": ["./sh/*"] } } }, [["sh/components/k.tsx", "LongBase" + n + tag]], "@sh/components/k");
    }
    const got = seeded(project("long-paths", f));
    const IN = ["LongTarget1024Pos", "LongKey1024Pos", "LongBase1024Pos"], OUT = ["LongTarget1025Neg", "LongKey1025Neg", "LongBase1025Neg"];
    all("1.35.4 review 1: a key, a target or a baseUrl longer than DS_PATH_CHARS (1,024 characters: no file system holds such a path, and each import resolved it again) makes the config tell nothing — one target of 1,025 characters on a key of its own and the kit the config's other, short, key reaches is not settled through it; a long key, a long baseUrl the same —, one of 1,024 is read (got " + js({ got: among(got, IN.concat(OUT)), lengths }) + ")",
      Object.assign(verdicts(got, IN, OUT), { lengths: js(lengths) === js([1024, 1024, 1024, 1025, 1025, 1025]) }));
  }

  // --- a default import: each place the module may be with its own base ----------------------------------------------------------
  {
    // an exact key sends `@/components/brand` to identity/logo/index.tsx — the one file TypeScript resolves it to —, and the
    // guess's folder for the same spec, src/components/brand/, holds a logo/index.tsx too: the target's base (`logo`) under
    // the guess's folder is no place the module is; the guess's own key still settles its folder's index (`@/components/mark`).
    // (the page renders a candidate too — DefGlow, as Nx's renders NxGlow: a file that writes no name asked is never viewed)
    const def = seeded(project("default-pairs", {
      "package.json": REACT,
      "tsconfig.json": { compilerOptions: { paths: { "@/components/brand": ["./src/components/identity/logo/index.tsx"], "@/*": ["./src/*"] } } },
      "src/components/identity/logo/index.tsx": L(["const BrandLogo = makeLogo(config);", "export default BrandLogo;"]),
      "src/components/brand/logo/index.tsx": L(["const OldLogo = makeLogo(other);", "export default OldLogo;"]),
      "src/components/mark/index.tsx": L(["const MarkLogo = makeMark(config);", "export default MarkLogo;"]),
      "src/components/ui/glow.tsx": G("DefGlow"),
      "src/app/page.tsx": L(["import Brand from \"@/components/brand\";", "import Mark from \"@/components/mark\";", "import { DefGlow } from \"@/components/ui/glow\";",
        "export default function P() { return <><Brand /><Mark /><DefGlow /></>; }"]),
    }));
    all("1.35.4 review 1: a default import pairs each place the module may be with its own base — an exact key to identity/logo/index.tsx settles BrandLogo, the guess's src/components/brand/logo/index.tsx (the target's base under another key's folder) is no place TypeScript resolves to: OldLogo is not seeded; the guess's own folder's index still settles MarkLogo (got " + js(among(def, ["BrandLogo", "OldLogo", "MarkLogo"])) + ")",
      verdicts(def, ["BrandLogo", "MarkLogo"], ["OldLogo"]));
  }

  // --- what it costs: a config's table is built once a governing folder ---------------------------------------------------------
  {
    // hard: a tsconfig.json over 31 links with 100 patterns, 1,000 page folders each asking it 31 names (31,000 asks); soft:
    // the same pages and no config at all (the reader never asked) — the table's memo keeps hard within a bound of soft
    const cost = (tag, hostile) => {
      const files = { "package.json": REACT, "src/components/ui/kit.tsx": "export const Moving = motion(Box);\n" };
      if (hostile) {
        const ext = [], paths = { "@/*": ["./src/*"] };
        for (let i = 0; i < 31; i++) { files["cfg/c" + i + ".json"] = { compilerOptions: { strict: true } }; ext.push("./cfg/c" + i + ".json"); }
        for (let i = 0; i < 99; i++) paths["@s" + i + "/*"] = ["./s" + i + "/*"];
        files["tsconfig.json"] = { extends: ext, compilerOptions: { paths } };
      }
      const text = page([[["Moving"], "@/components/ui/kit"]].concat(Array.from({ length: 30 }, (_, k) => [["A" + k], "@k/c" + k])));
      for (let d = 0; d < 1000; d++) files["src/pages/p" + d + "/page.tsx"] = text;
      return project("cost-" + tag, files);
    };
    const ms = remeasure(pair(cost("hard", true), cost("soft", false)), (s) => s[0] < 2 * s[1] + 150);
    all("1.35.4: a governing config's table is built once a folder — 31 links and 100 patterns asked 31,000 times cost within twice the same pages with no config (got " + js(ms) + ")", {
      bounded: ms[0] < 2 * ms[1] + 150,
      settled: ms[2] && ms[3],
    });
  }

  // --- what it costs: an import's keys once a governing folder and a spec; a config's table once a file -----------------------
  {
    // hard: 500 page folders each asking 20 bare specs (`lib<k>`, one segment: no guess beside the key) through a `*` key of
    // 10 targets of 1,000 characters (within DS_PATH_CHARS); soft: the same pages, targets of one segment — the keys' memo
    // keeps hard within a bound of soft (each import resolved the ten targets again: 240 KB of them took 500 pages 114 s)
    const long = (tag, segs) => {
      const files = { "package.json": REACT, "src/components/ui/kit.tsx": "export const Moving = motion(Box);\n" };
      files["tsconfig.json"] = { compilerOptions: { paths: { "*": Array.from({ length: 10 }, (_, i) => "./t" + i + "/" + "a/".repeat(segs) + "*") } } };
      const text = page([[["Moving"], "../../components/ui/kit"]].concat(Array.from({ length: 20 }, (_, k) => [["A" + k], "lib" + k])));
      for (let d = 0; d < 500; d++) files["src/pages/p" + d + "/page.tsx"] = text;
      return project("cost-long-" + tag, files);
    };
    const lk = remeasure(pair(long("hard", 497), long("soft", 0)), (s) => s[0] < 2 * s[1] + 150);
    all("1.35.4 review 1: an import's keys are built once a governing folder and a spec — 500 page folders asking 20 bare specs through a `*` key of 10 targets of 1,000 characters cost within twice the same pages with targets of one segment (got " + js(lk) + ")", {
      bounded: lk[0] < 2 * lk[1] + 150,
      settled: lk[2] && lk[3],
    });
    // hard: 60 folders, each with a tsconfig.json extending the end of one chain of 31 configs that write 2,000 exact keys
    // each; soft: the same with one key each — a config's table is built once a file (each folder rebuilt the table of every
    // config of its chain: 68 folders over 31 configs of 12,000 keys took 52 s)
    const chain = (tag, keys) => {
      const files = { "package.json": REACT, "src/components/ui/kit.tsx": "export const Moving = motion(Box);\n" };
      for (let c = 0; c < 31; c++) {
        const paths = {};
        for (let k = 0; k < keys; k++) paths["@k" + c + "_" + k] = ["./a"];
        files["cfg/c" + c + ".json"] = Object.assign(c ? { extends: "./c" + (c - 1) + ".json" } : {}, { compilerOptions: { paths } });
      }
      for (let l = 0; l < 60; l++) {
        files["l" + l + "/tsconfig.json"] = { extends: "../cfg/c30.json" };
        files["l" + l + "/page.tsx"] = page([[["Moving"], "../src/components/ui/kit"], [["X"], "lib/x"]]);
      }
      return project("cost-chain-" + tag, files);
    };
    // (hard reads 1.2 MB of configs that soft does not, once: a wider bound than the keys' — measured ×1.2 to ×2.7 with the
    // memo, ×9 to ×27 without it, six runs at once)
    const ch = remeasure(pair(chain("hard", 2000), chain("soft", 1)), (s) => s[0] < 4 * s[1] + 300);
    all("1.35.4 review 1: a config's table is built once a file, not once a governing folder — 60 folders extending one chain of 31 configs of 2,000 exact keys each cost within four times the same with one key each (got " + js(ch) + ")", {
      bounded: ch[0] < 4 * ch[1] + 300,
      settled: ch[2] && ch[3],
    });
  }
};
