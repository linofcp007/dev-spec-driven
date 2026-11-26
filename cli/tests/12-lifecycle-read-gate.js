"use strict";
// The read gate on the CLI (1.41.1) — a linked feature folder is `feature-linked` (exit 1, its --json the MCP result), doctor names the links below .specs/, an import's linked folder lists nothing.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, runIn, tmp }) => {
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
  const msg = MSG("en").err.featureLinked(".specs/lnk/");
  ok(st.code === 1 && st.out.includes(msg) && !/OUTSIDE-/.test(st.out + nx.out + sj.out) && parsed && parsed.ok === false && parsed.code === "feature-linked" && nx.code === 1 &&
    !!links && links.status === "warn" && links.detail.includes(".specs/lnk") && !/OUTSIDE-/.test(dr.out),
    "1.41.1 read gate (CLI): `status` / `next` of a linked feature folder exit 1 with feature-linked (its --json the MCP result, code feature-linked) and nothing behind the link; `doctor --json` names it in specs-links (got " +
    JSON.stringify([st.code, st.out.slice(0, 120), parsed && parsed.code, nx.code, links]) + ")");
};
