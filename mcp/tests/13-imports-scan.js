"use strict";
// Imports (scan) — the brownfield scan and coverage since the 1.22 review 2: the root .gitignore's negations, docs / examples manifests.
// (The scan's earlier assertions live in 13-imports.js — at its split threshold.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, tmp, require }) => {
  { // 1.22 review 2 — the brownfield scan / coverage (each finding reproduced at 7cf3843, guarded here)
    const js = (v) => JSON.stringify(v);
    const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const E = require("./lib/engine/index.js");
    const names = (text) => E.gitignoreDirPatterns(text).map((p) => p.names.map((u) => u.map((x) => (typeof x === "string" ? x : "[" + [...x].sort().join("") + "]")).join("")).join("/"));

    // F1. A negation re-includes what a pattern left out, and Git tracks it: the Python template's `lib/` with `!frontend/src/lib/`
    // (a SvelteKit app's code) hid frontend/src/lib/*.ts — coverage counted 2 code files of 4 and called `_Implements:
    // frontend/src/lib/api.ts_` non-code. A pattern a negation could re-include (its last name) is not applied; the others are.
    const ng = path.join(tmp, "proj-122r2-negation");
    put(ng, ".gitignore", "__pycache__/\nlib/\nlib64/\n!frontend/src/lib/\n");
    put(ng, "pyproject.toml", "[project]\nname = \"x\"\ndependencies = [\"fastapi\"]\n");
    put(ng, "app/main.py", "from fastapi import FastAPI\napp = FastAPI()\n@app.get('/a')\ndef a(): ...\n");
    put(ng, "frontend/package.json", js({ name: "web", devDependencies: { "@sveltejs/kit": "1" } }));
    put(ng, "frontend/src/lib/api.ts", "export const get = () => fetch('/a');\n");
    put(ng, "frontend/src/lib/store.ts", "export const s = 1;\n");
    put(ng, "frontend/src/routes/+page.svelte", "<script>import { s } from '$lib/store';</script>\n");
    put(ng, "lib64/gen.py", "x = 1\n"); // lib64/ — no negation names it: still left out
    const ngScan = S.scanCodebase(ng);
    S.initProject(ng, ["core"], "en");
    const fe = S.createFeature(ng, "Front", ["core"], "x", undefined, "en");
    fs.writeFileSync(path.join(fe.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. The API client\n  - _Requirements: US-1.AC-1_\n  - _Implements: frontend/src/lib/api.ts_\n");
    const ngCov = S.coverage(ng);
    ok(ngScan.ok && (ngScan.byExtension || []).includes(".ts:2") && !ngScan.topLevelDirs.includes("lib64") &&
      ngCov.codeFiles === 4 && ngCov.coveredFiles === 1 && js(ngCov.nonCodeImplements) === "[]" && !ngCov.uncoveredSample.includes("lib64/gen.py"),
      "1.22 review 2: `lib/` + `!frontend/src/lib/` — the scan and coverage read frontend/src/lib/*.ts (4 code files, api.ts covered, never 'non-code'); lib64/ is still left out (got " +
      js([ngScan.byExtension, ngScan.topLevelDirs, ngCov.codeFiles, ngCov.coveredFiles, ngCov.nonCodeImplements, ngCov.uncoveredSample]) + ")");
    // the rule: a negation's LAST name against a pattern's last name — the same name, a wildcard or a class that could match it;
    // Visual Studio's negations (`!**/[Pp]ackages/build/`, `!?*.[Cc]ache/`, `!.vscode/settings.json`) re-include no bin / obj
    const vs = names("[Bb]in/\n[Oo]bj/\n!**/[Pp]ackages/build/\n!?*.[Cc]ache/\n!.vscode/settings.json\n");
    ok(js(names("lib/\nlib64/\n!frontend/src/lib/\n")) === '["lib64"]' && vs.length === 2 && js(names("bin/\nobj/\n!b*/\n")) === '["obj"]' &&
      // (review 4: `!bin/**` re-includes every name below bin/ — read as any name, so no pattern applies; it was read as `bin`)
      js(names("bin/\nobj/\n!*\n")) === "[]" && js(names("bin/\nobj/\n!bin/**\n")) === "[]" && js(names("bin/\nobj/\n!lib/keep.txt\n")) === '["bin","obj"]' &&
      E.gitignoreNegationReincludes(E.gitignoreNegationTokens("l?b"), ["l", "i", "b"]) && !E.gitignoreNegationReincludes(E.gitignoreNegationTokens("*.d.ts"), ["l", "i", "b"]),
      "1.22 review 2: gitignoreDirPatterns drops a pattern a negation could re-include (same last name, `!b*/`, `!*`; `!bin/**`: any name) and keeps the others (`!lib/keep.txt`, Visual Studio's negations keep [Bb]in/ [Oo]bj/) (got " +
      js([names("lib/\nlib64/\n!frontend/src/lib/\n"), vs, names("bin/\nobj/\n!b*/\n")]) + ")");
    // bounded: a hostile file (1,000 patterns, 150 wildcard negations) spends a fixed budget, then applies none of its patterns
    const hostile = Array.from({ length: 1000 }, (_, i) => "a".repeat(40) + i + "/").join("\n") + "\n" + Array.from({ length: 150 }, () => "!" + "*a".repeat(120)).join("\n");
    const t0 = process.hrtime.bigint();
    const hp = E.gitignoreDirPatterns(hostile);
    const secs = Number(process.hrtime.bigint() - t0) / 1e9;
    ok(hp.length === 0 && secs < 5, "1.22 review 2: a hostile .gitignore (1,000 patterns × 150 wildcard negations) ends within its budget and applies none of its patterns (got " + js([hp.length, +secs.toFixed(3)]) + " s)");

    // F4. Nested manifests in docs / examples / samples folders are not the project's stack: a Node app's docs/requirements.txt
    // (Sphinx), docs/Gemfile (Jekyll) and examples/flask-client/requirements.txt made it "python (flask)" and "ruby".
    const nd = path.join(tmp, "proj-122r2-docs-manifests");
    put(nd, "package.json", js({ name: "srv", main: "src/index.js", dependencies: { express: "4" } }));
    put(nd, "src/index.js", "const express = require('express');\nconst app = express();\napp.get('/x', h);\n");
    put(nd, "docs/requirements.txt", "sphinx==7.2\nsphinx-rtd-theme\n");
    put(nd, "docs/Gemfile", "source 'https://rubygems.org'\ngem 'github-pages', group: :jekyll_plugins\n");
    put(nd, "examples/flask-client/requirements.txt", "flask\n");
    put(nd, "samples/go-client/go.mod", "module client\n\ngo 1.22\n");
    put(nd, "Doc/sample/Cargo.toml", "[package]\nname = \"x\"\n");
    put(nd, "services/billing/go.mod", "module billing\n\ngo 1.22\n"); // a real package of the monorepo still counts
    const ndScan = S.scanCodebase(nd);
    ok(ndScan.ok && js(ndScan.stack) === '["node (express)","go"]' && !ndScan.frameworks.includes("flask") &&
      ["docs", "doc", "examples", "example", "samples", "sample"].every((x) => E.MANIFEST_FIXTURE_DIRS.has(x)),
      "1.22 review 2: a manifest under docs/ / doc/ / examples/ / samples/ (Sphinx requirements.txt, Jekyll Gemfile, an example's flask, a sample's go.mod / Cargo.toml) never joins the stack; services/billing/go.mod does (got " +
      js([ndScan.stack, ndScan.frameworks]) + ")");
  }

  { // 1.22 review 3 — a NESTED .gitignore's negation: root `lib/` + frontend/.gitignore `!src/lib/` — Git tracks frontend/src/lib/api.ts
    const js = (v) => JSON.stringify(v);
    const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const E = require("./lib/engine/index.js");
    const nn = path.join(tmp, "proj-122r3-nested-negation");
    put(nn, ".gitignore", "lib/\n__pycache__/\n");
    put(nn, "frontend/.gitignore", "!src/lib/\n");
    put(nn, "frontend/package.json", js({ name: "fe", dependencies: { "@sveltejs/kit": "1" } }));
    put(nn, "frontend/src/lib/api.ts", "export const get = () => fetch('/api');\n");
    put(nn, "frontend/src/routes/+page.svelte", "<script>import { get } from '$lib/api';</script>\n");
    put(nn, "backend/app.py", "from flask import Flask\napp = Flask(__name__)\n");
    put(nn, "backend/lib/gen.py", "x = 1\n"); // no negation above it: still left out
    put(nn, "pyproject.toml", "[project]\nname = 'x'\n");
    S.initProject(nn, ["core"], "en");
    const fe = S.createFeature(nn, "Front", ["core"], "x", undefined, "en");
    fs.writeFileSync(path.join(fe.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. The API client\n  - _Requirements: US-1.AC-1_\n  - _Implements: frontend/src/lib/api.ts_\n");
    const cov = S.coverage(nn);
    const scan = S.scanCodebase(nn);
    // bounded: 300 nested .gitignore files with hostile negations under a root of 1,000 patterns — every subtree past the cap keeps its code
    const hb = path.join(tmp, "proj-122r3-nested-hostile");
    put(hb, ".gitignore", Array.from({ length: 1000 }, (_, i) => "a".repeat(40) + i + "/").join("\n") + "\nlib/\n");
    for (let i = 0; i < 300; i++) put(hb, "m" + i + "/.gitignore", Array.from({ length: 150 }, () => "!" + "*a".repeat(120)).join("\n") + "\n");
    put(hb, "m299/lib/x.ts", "export const x = 1;\n");
    const t0 = process.hrtime.bigint();
    const covH = S.coverage(hb);
    const secs = Number(process.hrtime.bigint() - t0) / 1e9;
    ok(cov.codeFiles === 3 && cov.coveredFiles === 1 && js(cov.nonCodeImplements) === "[]" && !cov.uncoveredSample.includes("backend/lib/gen.py") &&
      (scan.byExtension || []).includes(".ts:1") && covH.codeFiles === 1 && secs < 10 && E.GITIGNORE_NESTED_MAX === 200,
      "1.22 review 3 (7): root `lib/` + frontend/.gitignore `!src/lib/` — the scan and coverage read frontend/src/lib/api.ts (3 code files, api.ts covered); backend/lib/ is still left out; 300 hostile nested negation files stay bounded and keep their code (got " +
      js([cov.codeFiles, cov.coveredFiles, cov.nonCodeImplements, cov.uncoveredSample, scan.byExtension, covH.codeFiles, +secs.toFixed(3)]) + ")");
  }

  { // 1.22 review 4 — a .gitignore read as Git reads it (each case checked against `git ls-files --others --exclude-standard`)
    const js = (v) => JSON.stringify(v);
    const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const E = require("./lib/engine/index.js");
    const BOM = String.fromCharCode(0xfeff);
    const utf16 = (s) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, "utf16le")]);
    let n = 0;
    const seen = (files) => { // files: { rel: content } → the files the scan / coverage walk reads (no .gitignore)
      const root = path.join(tmp, "proj-122r4-gitignore-" + n++);
      for (const [rel, s] of Object.entries(files)) put(root, rel, s);
      const out = [];
      E.walkProject(root, 1e6, (rel) => { if (!/(^|\/)\.gitignore$/.test(rel)) out.push(rel); }, { gitignore: E.gitignoreRules(root) });
      return out.sort();
    };
    const got = [
      seen({ ".gitignore": "lib/\n!frontend/src/**\n", "frontend/src/lib/api.ts": "x", "lib/gen.ts": "x" }),
      seen({ ".gitignore": "lib/\n", "frontend/.gitignore": "!src/**\n", "frontend/src/lib/api.ts": "x", "backend/lib/gen.py": "x" }),
      seen({ ".gitignore": "lib/\n", "frontend/.gitignore": BOM + "!src/lib/\r\n", "frontend/src/lib/api.ts": "x" }),
      seen({ ".gitignore": utf16("lib/\r\n"), "lib/a.ts": "x", "gen/.gitignore": utf16("*"), "gen/b.ts": "x" }),
      seen({ ".gitignore": "  lib/\nobj/   \n", "lib/a.ts": "x", "obj/b.cs": "x", "gen/.gitignore": " *\n", "gen/c.ts": "x" }),
      seen({ "gen/.gitignore": "*\n" + "# x\n".repeat(1100) + "!keep.ts\n", "gen/keep.ts": "x", "tmp/.gitignore": "*\n!.gitignore\n", "tmp/d.ts": "x" }),
      seen({ ".gitignore": "#" + "x".repeat(99996) + "\nsrcgen/\n", "src/a.ts": "x", "srcgen/b.ts": "x" }),
    ];
    ok(js(got) === js([["frontend/src/lib/api.ts", "lib/gen.ts"], ["frontend/src/lib/api.ts"], ["frontend/src/lib/api.ts"], ["gen/b.ts", "lib/a.ts"], ["gen/c.ts", "lib/a.ts"],
      ["gen/keep.ts"], ["src/a.ts", "srcgen/b.ts"]]),
      "1.22 review 4: a negation ending in /** re-includes every name below it (root — conservatively the whole pattern, lib/gen.ts too — and nested), a BOM before a nested file's first negation, a UTF-16 .gitignore (raw bytes to Git: no pattern), leading blanks kept / trailing ones dropped (` *` is no ignore-all), an ignore-all read from the whole file, a root file past its cap applying no pattern — each as Git reads it (got " + js(got) + ")");
  }
};
