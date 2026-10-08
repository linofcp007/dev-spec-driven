"use strict";
// 1.23 review 5 — roadmap --write on a broken roadmap.json (exit 1, ROADMAP.md kept), create re-run / archived-twin notes, restore's way out.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp }) => {
  const p = path.join(tmp, "r5-cli");
  run(["init", "--project", p]);
  run(["create", "Alpha", "core", "--project", p]);
  run(["create", "Beta", "core", "--project", p]);
  run(["depend", "beta", "alpha", "--project", p]);
  const md0 = fs.readFileSync(path.join(p, ".specs", "ROADMAP.md"), "utf8");
  const rmf = path.join(p, ".specs", "roadmap.json");
  const good = fs.readFileSync(rmf, "utf8");
  fs.writeFileSync(rmf, "{ \"features\": ");
  const w = run(["roadmap", "--write", "--project", p]);
  const j = run(["roadmap", "--write", "--json", "--project", p]);
  let parsed = null;
  try { parsed = JSON.parse(j.out.slice(j.out.indexOf("{"))); } catch { /* not JSON */ }
  const view = run(["roadmap", "--project", p]);
  ok(w.code === 1 && /ROADMAP\.md was not regenerated/.test(w.out) && fs.readFileSync(path.join(p, ".specs", "ROADMAP.md"), "utf8") === md0 &&
    j.code === 1 && parsed && parsed.ok === false && /was not regenerated/.test(parsed.error) &&
    view.code === 0 && /This view leaves out what it can't read/.test(view.out),
    "1.23 review 5: `roadmap --write` on a broken roadmap.json exits 1 and keeps ROADMAP.md (--json: ok false); the plain view warns (got " + JSON.stringify([w.code, w.out.slice(0, 160), view.code]) + ")");
  fs.writeFileSync(rmf, good);

  const again = run(["create", "Alpha", "--project", p]);
  run(["feature", "archive", "alpha", "--project", p]);
  const twin = run(["create", "Alpha", "core", "--project", p]);
  const rs = run(["feature", "restore", "alpha", "--project", p]);
  ok(again.code === 0 && /already exists — nothing was re-created/.test(again.out) && twin.code === 0 && /An archived feature is named 'alpha' too/.test(twin.out) &&
    rs.code === 1 && /rename it first \(dev-spec feature rename alpha|rename it first \(node .*feature rename alpha/.test(rs.out),
    "1.23 review 5: `create` names a re-run and an archived twin; `feature restore` with an active twin names the rename that unblocks it (got " + JSON.stringify([again.out.slice(-120), rs.out.slice(0, 160)]) + ")");
};
