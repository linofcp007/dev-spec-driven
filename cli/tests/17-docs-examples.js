"use strict";
// examples/README.md's "Verify it yourself" outputs are what the CLI prints on a fresh copy.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, runIn, tmp, __dirname }) => {
  // A copy resets every file date, like a clone: the demo's approvals must hold by content fingerprint (an approval
  // without one fell back to mtime and flagged every approved file as changed after any checkout).
  const repo15 = path.join(__dirname, "..");
  const demo15 = path.join(tmp, "wp15", "examples", "demo-project");
  fs.cpSync(path.join(repo15, "examples", "demo-project"), demo15, { recursive: true });
  const readme15 = fs.readFileSync(path.join(repo15, "examples", "README.md"), "utf8").replace(/\r\n/g, "\n");
  const block15 = (heading) => { const at = readme15.indexOf("### `" + heading + "`"); const m = at < 0 ? null : readme15.slice(at).match(/\n```\n([\s\S]*?)\n```/); return m ? m[1] : "<no block for " + heading + ">"; };
  const cmds15 = [["doctor api-keys", ["doctor", "api-keys"]], ["trace api-keys --code", ["trace", "api-keys", "--code"]], ["roadmap", ["roadmap"]], ["clarify api-keys", ["clarify", "api-keys"]]];
  const diff15 = [];
  for (const [heading, args] of cmds15) {
    const r = runIn([...args, "--project", demo15]);
    const got = r.out.replace(/\r\n/g, "\n").replace(/\s+$/, ""), want = block15(heading);
    if (r.code !== 0 || got !== want) diff15.push(heading + " (exit " + r.code + "): " + JSON.stringify(got.slice(0, 300)));
  }
  ok(diff15.length === 0 && /verdict=PASS/.test(block15("doctor api-keys")) && !/[▲✗]/.test(block15("doctor api-keys")),
    "examples/README.md: doctor (PASS, no warnings) / trace --code / roadmap / clarify print exactly the pasted outputs on a fresh copy of the demo (differs: " + diff15.join(" | ") + ")");
  // The committed ROADMAP.md is what `roadmap --write` generates now (it said 70% while the engine said 19%).
  runIn(["roadmap", "--write", "--html", "--project", demo15]);
  const rm15 = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  ok(rm15(path.join(demo15, ".specs", "ROADMAP.md")) === rm15(path.join(repo15, "examples", "demo-project", ".specs", "ROADMAP.md")),
    "the demo's committed .specs/ROADMAP.md matches what roadmap --write generates");
  // … and so does its ROADMAP.html (1.23.1: it had missed the 1.16 milestone styles — no test held it)
  ok(rm15(path.join(demo15, ".specs", "ROADMAP.html")) === rm15(path.join(repo15, "examples", "demo-project", ".specs", "ROADMAP.html")),
    "the demo's committed .specs/ROADMAP.html matches what roadmap --write --html generates");
};
