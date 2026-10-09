"use strict";
// 1.23 review 5 — roadmap --write on a broken roadmap.json (exit 1, ROADMAP.md kept), create re-run / archived-twin notes, restore's way out.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, runIn, tmp }) => {
  const p = path.join(tmp, "r5-cli");
  runIn(["init", "--project", p]);
  runIn(["create", "Alpha", "core", "--project", p]);
  runIn(["create", "Beta", "core", "--project", p]);
  runIn(["depend", "beta", "alpha", "--project", p]);
  const md0 = fs.readFileSync(path.join(p, ".specs", "ROADMAP.md"), "utf8");
  const rmf = path.join(p, ".specs", "roadmap.json");
  const good = fs.readFileSync(rmf, "utf8");
  fs.writeFileSync(rmf, "{ \"features\": ");
  const w = runIn(["roadmap", "--write", "--project", p]);
  const j = runIn(["roadmap", "--write", "--json", "--project", p]);
  let parsed = null;
  try { parsed = JSON.parse(j.out.slice(j.out.indexOf("{"))); } catch { /* not JSON */ }
  const view = runIn(["roadmap", "--project", p]);
  ok(w.code === 1 && /ROADMAP\.md was not regenerated/.test(w.out) && fs.readFileSync(path.join(p, ".specs", "ROADMAP.md"), "utf8") === md0 &&
    j.code === 1 && parsed && parsed.ok === false && /was not regenerated/.test(parsed.error) &&
    view.code === 0 && /This view leaves out what it can't read/.test(view.out),
    "1.23 review 5: `roadmap --write` on a broken roadmap.json exits 1 and keeps ROADMAP.md (--json: ok false); the plain view warns (got " + JSON.stringify([w.code, w.out.slice(0, 160), view.code]) + ")");
  fs.writeFileSync(rmf, good);

  const again = runIn(["create", "Alpha", "--project", p]);
  runIn(["feature", "archive", "alpha", "--project", p]);
  const twin = runIn(["create", "Alpha", "core", "--project", p]);
  const rs = runIn(["feature", "restore", "alpha", "--project", p]);
  ok(again.code === 0 && /already exists — nothing was re-created/.test(again.out) && twin.code === 0 && /An archived feature is named 'alpha' too/.test(twin.out) &&
    rs.code === 1 && /rename it first \(dev-spec feature rename alpha|rename it first \(node .*feature rename alpha/.test(rs.out),
    "1.23 review 5: `create` names a re-run and an archived twin; `feature restore` with an active twin names the rename that unblocks it (got " + JSON.stringify([again.out.slice(-120), rs.out.slice(0, 160)]) + ")");

  { // 1.24 r6 (integration): `feature remove` without --yes on a feature folder that is a link (a junction / symlink) says only the
    // link goes — the engine's message — never "would delete 0 file(s)"; nothing is deleted (exit 1)
    const pl = path.join(tmp, "r6-cli-link");
    runIn(["init", "--project", pl]);
    runIn(["create", "Linked", "core", "--project", pl]);
    const inside = path.join(pl, ".specs", "linked");
    const outside = path.join(tmp, "r6-cli-link-target");
    fs.renameSync(inside, outside);
    let linked = true;
    try { fs.symlinkSync(outside, inside, process.platform === "win32" ? "junction" : "dir"); } catch { linked = false; }
    if (linked) {
      const pre = runIn(["feature", "remove", "linked", "--project", pl]);
      ok(pre.code === 1 && /is a link \(a symbolic link, a junction\): removing 'linked' deletes only the link/.test(pre.out) && !/0 file\(s\)/.test(pre.out) &&
        fs.existsSync(path.join(outside, "requirements.md")) && fs.lstatSync(inside).isSymbolicLink(),
        "1.24 r6: feature remove's preview on a linked feature folder says only the link goes (no '0 file(s)'), deletes nothing (got " + JSON.stringify(pre.out.slice(0, 260)) + ")");
    }
  }
};
