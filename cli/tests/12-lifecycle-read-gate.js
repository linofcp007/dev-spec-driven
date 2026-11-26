"use strict";
// The read gate on the CLI (1.41.1) — a linked feature folder is `feature-linked` (exit 1, its --json the MCP result), doctor names the links below .specs/, an import's linked folder lists nothing.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, runIn, tmp }) => {
  const MSG = require(path.join(__dirname, "..", "..", "mcp", "lib", "i18n.js")).msg;
  const link = (target, at) => { try { fs.symlinkSync(target, at, "junction"); return true; } catch { return false; } };
  const p = path.join(tmp, "rg-cli"), out = path.join(tmp, "rg-cli-out");
  runIn(["init", "--project", p]);
  runIn(["create", "Plain", "core", "--project", p]);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "requirements.md"), "# Feature: OUTSIDE-CLI\n\n## Summary\nOUTSIDE-CLI-SUMMARY\n");
  fs.writeFileSync(path.join(out, "tasks.md"), "# Tasks\n\n- [ ] 1. OUTSIDE-CLI-TASK\n");
  if (!link(out, path.join(p, ".specs", "lnk"))) { ok(true, "1.41.1 read gate (CLI): links not creatable here — skipped"); return; }
  const st = runIn(["status", "lnk", "--project", p]);
  const sj = runIn(["status", "lnk", "--json", "--project", p]);
  let parsed = null;
  try { parsed = JSON.parse(sj.out.slice(sj.out.indexOf("{"))); } catch { /* not JSON */ }
  const nx = runIn(["next", "lnk", "--project", p]);
  const dr = runIn(["doctor", "plain", "--json", "--project", p]);
  let doc = null;
  try { doc = JSON.parse(dr.out.slice(dr.out.indexOf("{"))); } catch { /* not JSON */ }
  const links = doc && (doc.checks || []).find((c) => c.id === "specs-links");
  const msg = typeof MSG("en").err.featureLinked === "function" ? MSG("en").err.featureLinked(".specs/lnk/") : "(no entry)";
  ok(st.code === 1 && st.out.includes(msg) && !/OUTSIDE-/.test(st.out + nx.out + sj.out) && parsed && parsed.ok === false && parsed.code === "feature-linked" && nx.code === 1 &&
    !!links && links.status === "warn" && links.detail.includes(".specs/lnk") && !/OUTSIDE-/.test(dr.out),
    "1.41.1 read gate (CLI): `status` / `next` of a linked feature folder exit 1 with feature-linked (its --json the MCP result, code feature-linked) and nothing behind the link; `doctor --json` names it in specs-links (got " +
    JSON.stringify([st.code, st.out.slice(0, 120), parsed && parsed.code, nx.code, links]) + ")");

  // fix round 1 (A-7): the engine-free readers keep the engine's reading — a linked _archive/ completes no archived name (restore <Tab>),
  // a linked roadmap.json picks no language (its target's meta.lang); the plain twins as ever
  const COMPLETION = require(path.join(__dirname, "..", "completion.js"));
  const arch = path.join(tmp, "rg-cli-arch"), archOut = path.join(tmp, "rg-cli-arch-out"), archPlain = path.join(tmp, "rg-cli-arch-plain");
  runIn(["init", "--project", arch]);
  runIn(["init", "--project", archPlain]);
  fs.mkdirSync(path.join(archOut, "private-project-alpha"), { recursive: true });
  fs.mkdirSync(path.join(archPlain, ".specs", "_archive", "old-one"), { recursive: true });
  fs.writeFileSync(path.join(archPlain, ".specs", "_archive", "old-one", ".state.json"), "{}");
  const linkedArch = link(archOut, path.join(arch, ".specs", "_archive"));
  // a real process: in this one the engine is loaded already (its projectLang answers) — the light reading runs before it loads
  const bad = (q) => run(["status", "x", "--lang", "zz", "--project", q]).out;
  const en = path.join(tmp, "rg-cli-lang-en"), ptp = path.join(tmp, "rg-cli-lang-pt"), lk = path.join(tmp, "rg-cli-lang-link"), lkOut = path.join(tmp, "rg-cli-lang-out");
  runIn(["init", "--project", en]);
  runIn(["init", "--lang", "pt", "--project", ptp]);
  runIn(["init", "--project", lk]);
  fs.mkdirSync(lkOut, { recursive: true });
  const rmLk = path.join(lk, ".specs", "roadmap.json");
  fs.copyFileSync(path.join(ptp, ".specs", "roadmap.json"), path.join(lkOut, "roadmap.json")); // its target says pt
  fs.rmSync(rmLk);
  let fileLinked = false;
  try { fs.symlinkSync(path.join(lkOut, "roadmap.json"), rmLk, "file"); fileLinked = true; } catch { fs.copyFileSync(path.join(en, ".specs", "roadmap.json"), rmLk); }
  const [oEn, oPt, oLk] = [bad(en), bad(ptp), bad(lk)].map((s) => s.split(en).join("<P>").split(ptp).join("<P>").split(lk).join("<P>"));
  ok(linkedArch && JSON.stringify(COMPLETION.archivedNames(arch)) === "[]" && JSON.stringify(COMPLETION.archivedNames(archPlain)) === JSON.stringify(["old-one"]) &&
    (!fileLinked || (oLk === oEn && oPt !== oEn)),
    "1.41.1 fix round 1 (A-7, CLI): restore's completion lists no archived name behind a linked _archive/ (the engine reads it as absent), a plain _archive/'s as ever; a linked roadmap.json gives the engine-free CLI no language — an argument error is in English, its plain PT twin's in Portuguese (got " +
    JSON.stringify({ linked: COMPLETION.archivedNames(arch), plain: COMPLETION.archivedNames(archPlain), fileLinked, oEn: oEn.slice(0, 80), oPt: oPt.slice(0, 80), oLk: oLk.slice(0, 80) }) + ")");
};
