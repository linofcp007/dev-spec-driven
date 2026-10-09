"use strict";
// import — 1.25: another tool's steering (import kiro-steering | cursor-rules [path]) and --dry-run on every import.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, require, __dirname }) => {
  const S = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const js = JSON.stringify;
  const put = (root, rel, s) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
  const json = (args) => { const r = run(args); try { return { code: r.code, j: JSON.parse(r.out) }; } catch { return { code: r.code, j: null, out: r.out }; } };
  // A folder's entries — path, kind, bytes, mtime: what --dry-run must leave as it found it.
  const snap = (dir) => {
    const out = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        const p = path.join(d, e.name);
        const st = fs.statSync(p);
        if (e.isDirectory()) { out.push("D " + path.relative(dir, p) + " " + st.mtimeMs); walk(p); }
        else out.push("F " + path.relative(dir, p) + " " + st.mtimeMs + " " + fs.readFileSync(p).toString("base64"));
      }
    };
    walk(dir);
    return out.join("\n");
  };
  const steering = (p) => {
    put(p, ".kiro/steering/api.md", "---\ninclusion: fileMatch\nfileMatchPattern: \"src/api/**\"\n---\n# API\n\n- Validate every input.\n");
    put(p, ".kiro/steering/voice.md", "# Voice\n\nShort sentences.\n");
    put(p, ".cursor/rules/ts.mdc", "---\ndescription: TypeScript\nglobs: *.ts\nalwaysApply: false\n---\nUse strict mode.\n");
    put(p, ".cursorrules", "Answer tersely.\n");
  };
  const project = (n) => { const p = path.join(tmp, "imp125-" + n); run(["init", "core", "--project", p]); steering(p); return p; };

  // 1.25 import kiro-steering (no path: .kiro/steering/) — the human lines name each file and its mode; --json is the engine's answer
  // (spec_import's), compared on a twin project; a second run skips every file (exit 0, nothing written).
  {
    const p = project("kiro");
    const twin = project("kiro-twin");
    const h = run(["import", "kiro-steering", "--project", p]);
    const j = json(["import", "kiro-steering", "--json", "--project", twin]);
    const engine = (() => { const e = path.join(tmp, "imp125-kiro-engine"); fs.mkdirSync(e, { recursive: true }); S.initProject(e, ["core"]); steering(e); return S.importSpec(e, "kiro-steering"); })();
    const pick = (r) => js(r && { ok: r.ok, kind: r.kind, sources: r.sources, imported: r.imported, skipped: r.skipped, warnings: r.warnings });
    const st0 = snap(path.join(p, ".specs"));
    const again = run(["import", "kiro-steering", ".kiro/steering", "--project", p]);
    ok(h.code === 0 && /Imported Kiro steering → 2 steering file\(s\) in \.specs\/steering\//.test(h.out) &&
      /  api\.md ← \.kiro\/steering\/api\.md \(fileMatch: src\/api\/\*\*\)/.test(h.out) && /  voice\.md ← \.kiro\/steering\/voice\.md \(always\)/.test(h.out) &&
      j.code === 0 && j.j && pick(j.j) === pick(engine) && fs.existsSync(path.join(p, ".specs", "steering", "api.md")) &&
      again.code === 0 && /→ 0 steering file\(s\) in \.specs\/steering\/, 2 skipped/.test(again.out) && /already exists \(never overwritten/.test(again.out) && snap(path.join(p, ".specs")) === st0,
      "1.25 import kiro-steering: each file named with its mode; --json = spec_import's answer; a second run skips both (exit 0, nothing written) (got " + h.out.slice(0, 300) + " | " + again.out.slice(0, 300) + ")");
  }

  // 1.25 import cursor-rules --dry-run [--json]: nothing written (the tree byte- and stamp-identical), the would-be files previewed;
  // without --dry-run the same files are written.
  {
    const p = project("cursor");
    const t0 = snap(p);
    const d = json(["import", "cursor-rules", "--dry-run", "--json", "--project", p]);
    const h = run(["import", "cursor-rules", "--dry-run", "--project", p]);
    const unchanged = snap(p) === t0;
    const real = json(["import", "cursor-rules", "--json", "--project", p]);
    const prev = d.j && d.j.preview ? d.j.preview : [];
    ok(d.code === 0 && d.j && d.j.dryRun === true && js(d.j.imported.map((x) => x.file)) === js(["ts.md", "cursorrules.md"]) && unchanged &&
      prev.length === 2 && prev.every((x) => fs.readFileSync(path.join(p, ".specs", "steering", x.file), "utf8") === x.content) &&
      h.code === 0 && /^Dry run — nothing was written\.\nWould import Cursor rules → 2 steering file\(s\) in \.specs\/steering\//.test(h.out) &&
      /  ts\.md ← \.cursor\/rules\/ts\.mdc \(fileMatch: \*\*\/\*\.ts\)/.test(h.out) && /--json prints each file's content/.test(h.out) &&
      real.code === 0 && js(real.j.imported) === js(d.j.imported),
      "1.25 import cursor-rules --dry-run: nothing written; --json previews each file (equal to what the real run then writes); the human lines say it is a dry run (got " + h.out.slice(0, 400) + ")");
  }

  // 1.25 import <feature tool> --dry-run: Kiro and a plan's --text — no feature folder, the would-be files with their sizes, the counts,
  // the mapping; --json = the engine's dry run; a refusal is a refusal (exit 1) with dryRun in its JSON.
  {
    const p = project("feature");
    put(p, ".kiro/specs/login/requirements.md", "# Requirements Document\n\n## Introduction\n\nUsers log in.\n\n## Requirements\n\n### Requirement 1: Login\n\n#### Acceptance Criteria\n\n1. WHEN the user submits valid credentials THEN the system SHALL open the dashboard\n2. IF the password is wrong THEN the system SHALL show an error\n");
    put(p, ".kiro/specs/login/tasks.md", "# Implementation Plan\n\n- [ ] 1. Build the form\n  - _Requirements: 1.1_\n- [x] 2. Validate\n  - _Requirements: 1.2_\n");
    const t0 = snap(p);
    const h = run(["import", "kiro", ".kiro/specs/login", "--dry-run", "--project", p]);
    const d = json(["import", "kiro", ".kiro/specs/login", "--dry-run", "--json", "--project", p]);
    const t = json(["import", "plan", "--text", "# Plan: Dark mode\n\n## Goals\n- When the user clicks the toggle, the theme switches\n", "--dry-run", "--json", "--project", p]);
    const engine = S.importSpec(p, "kiro", ".kiro/specs/login", { dryRun: true }); // the same project: a dry run writes nothing
    const unchanged = snap(p) === t0;
    S.createFeature(p, "Login", ["core"]);
    const exists = json(["import", "kiro", ".kiro/specs/login", "--dry-run", "--json", "--project", p]);
    ok(h.code === 0 && /^Dry run — nothing was written\.\nWould import Kiro \.kiro\/specs\/login → feature 'login' \[/.test(h.out) &&
      /  requirements\.md — \d+ characters/.test(h.out) && /  1 story\(ies\), 2 criterion\(a\), 2 task\(s\), 0 decision\(s\)/.test(h.out) && /mapping: \d+ ID\(s\)/.test(h.out) &&
      d.code === 0 && d.j.dryRun === true && d.j.feature === "login" && js(d.j.counts) === js({ stories: 1, criteria: 2, tasks: 2, decisions: 0 }) && js(d.j) === js(engine) &&
      d.j.preview.some((x) => x.file === "requirements.md" && /\*\*US-1\.AC-1\*\*/.test(x.content)) &&
      t.code === 0 && t.j.dryRun === true && t.j.inline === true && t.j.feature === "dark-mode" && unchanged &&
      exists.code === 1 && exists.j && exists.j.ok === false && exists.j.dryRun === true && /already exists/.test(exists.j.error),
      "1.25 import kiro / plan --text --dry-run: no feature folder, the files with their sizes, the counts and the mapping; --json previews the content (= spec_import {dryRun}'s answer); a refusal still exits 1, its JSON says dryRun (got " + h.out.slice(0, 400) + ")");
  }

  // 1.25 the CLI's guards: a steering import with a feature's options (--name / --tracks), a path outside the project, --dry-run on
  // another command — each exits 1 with nothing written; a feature tool still needs its path.
  {
    const p = project("guards");
    const st0 = snap(path.join(p, ".specs"));
    const named = run(["import", "cursor-rules", "--name", "x", "--project", p]);
    const tracked = run(["import", "kiro-steering", "--tracks", "tdd", "--project", p]);
    const outside = run(["import", "kiro-steering", "../elsewhere", "--project", p]);
    const other = run(["status", "--dry-run", "--project", p]);
    const noPath = run(["import", "kiro", "--project", p]);
    ok(named.code === 1 && /name: a Cursor rules import writes \.specs\/steering\/ files, not a feature/.test(named.out) &&
      tracked.code === 1 && /tracks: a Kiro steering import/.test(tracked.out) && outside.code === 1 && /outside the project/.test(outside.out) &&
      other.code === 1 && /--dry-run is not an option of 'status'/.test(other.out) && noPath.code === 1 && /import <kiro-steering\|cursor-rules> \[<path>\] \[--dry-run\]/.test(noPath.out) &&
      snap(path.join(p, ".specs")) === st0,
      "1.25 import guards (exit 1, nothing written): --name / --tracks on a steering import, a path outside the project, --dry-run on another command, a feature tool without its path (got " +
      js([named.out, tracked.out, outside.out, other.out, noPath.out].map((x) => x.slice(0, 120))) + ")");
  }
};
