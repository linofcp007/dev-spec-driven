"use strict";
// dev-spec upgrade [--apply] (= spec_upgrade) — the audit, the migrations, UPGRADE.md, PT, --json, exit codes.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
  const S17 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const readJ17 = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
  // A legacy project: made by this engine, then stripped of what 1.13 records (meta.specVersion, saved tracks); one feature
  // with a requirements approval whose fingerprint still matches (no history), one task ticked.
  const legacy17 = (dir, lang) => {
    S17.initProject(dir, ["core"], lang);
    S17.createFeature(dir, "Draft", ["core"]);
    const half = S17.createFeature(dir, "Half", ["core"]);
    const rmF = path.join(dir, ".specs", "roadmap.json");
    const rm = readJ17(rmF);
    delete rm.meta.specVersion;
    fs.writeFileSync(rmF, JSON.stringify(rm, null, 2));
    for (const slug of ["draft", "half"]) {
      const p = path.join(dir, ".specs", slug, ".state.json");
      const st = readJ17(p);
      delete st.tracks;
      if (slug === "half") {
        const req = fs.readFileSync(path.join(half.dir, "requirements.md"), "utf8").replace(/\r\n/g, "\n");
        st.approvals = { requirements: { at: "2026-01-01T10:00:00.000Z", by: "old", fingerprint: require("crypto").createHash("sha1").update(req).digest("hex") } };
      }
      fs.writeFileSync(p, JSON.stringify(st, null, 2));
    }
    const tk = path.join(half.dir, "tasks.md");
    fs.writeFileSync(tk, fs.readFileSync(tk, "utf8").replace("- [ ]", "- [x]"));
  };

  const u17 = path.join(tmp, "wp17-legacy");
  legacy17(u17, "en");
  const au17 = run(["upgrade", "--project", u17]);
  let auJ17 = null;
  try { auJ17 = JSON.parse(run(["upgrade", "--json", "--project", u17]).out); } catch { /* invalid JSON */ }
  ok(au17.code === 0 && /^dev-spec upgrade — \.specs\/ from before 1\.13 \(no version stamp\) → dev-spec /m.test(au17.out) && /2 active feature\(s\): /.test(au17.out) &&
    /▸ draft — not started/.test(au17.out) && /▸ half — executing/.test(au17.out) && /Review it with the spec-critic agent/.test(au17.out) && /converge pass/.test(au17.out) &&
    /^Apply would change/m.test(au17.out) && /approval baselines to save to \.history\/ \(the file still matches its approval\): half\/requirements/.test(au17.out) &&
    !fs.existsSync(path.join(u17, ".specs", "UPGRADE.md")) && auJ17 && JSON.stringify(auJ17) === JSON.stringify(S17.specUpgrade(u17)),
    "upgrade (CLI): the audit — header, summary, per-feature status and review, what apply would change — exit 0, nothing written; --json = the engine / MCP result (got " + au17.out.slice(0, 200) + ")");

  const ap17 = run(["upgrade", "--apply", "--project", u17]);
  const st17 = readJ17(path.join(u17, ".specs", "half", ".state.json"));
  const ap17b = run(["upgrade", "--apply", "--project", u17]);
  let ap17j = null;
  try { ap17j = JSON.parse(run(["upgrade", "--apply", "--json", "--project", u17]).out); } catch { /* invalid JSON */ }
  ok(ap17.code === 0 && /^Migrations applied/m.test(ap17.out) && /meta\.specVersion: none → /.test(ap17.out) && /approval baselines saved: half\/\.history\/requirements@1\.md/.test(ap17.out) &&
    /^Report: \.specs\/UPGRADE\.md/m.test(ap17.out) && fs.existsSync(path.join(u17, ".specs", "UPGRADE.md")) && fs.existsSync(path.join(u17, ".specs", "half", ".history", "requirements@1.md")) &&
    Array.isArray(st17.tracks) && S17.readRoadmap(u17).meta.specVersion === S17.engineVersion() &&
    ap17b.code === 0 && /Nothing to migrate — \.specs\/ is already up to date; nothing was changed\./.test(ap17b.out) &&
    ap17j && ap17j.ok === true && ap17j.migrations.changed === false && ap17j.from === S17.engineVersion(),
    "upgrade --apply (CLI): the migrations done and the report path, exit 0; a second --apply says nothing to migrate; --json carries `migrations` (got " + ap17.out.slice(-300) + ")");

  // Switches read strictly; no .specs/ is an error (exit 1); PT output.
  const bad17 = run(["upgrade", "--apply=maybe", "--project", u17]);
  fs.mkdirSync(path.join(tmp, "wp17-nothing"), { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one) — a folder without .specs/
  const none17 = run(["upgrade", "--project", path.join(tmp, "wp17-nothing")]);
  const pt17 = path.join(tmp, "wp17-pt");
  legacy17(pt17, "pt");
  const ptOut17 = run(["upgrade", "--project", pt17]);
  const ptAp17 = run(["upgrade", "--apply", "--project", pt17]);
  ok(bad17.code === 1 && /--apply must be a boolean/.test(bad17.out) && none17.code === 1 && /No \.specs\/ at/.test(none17.out) &&
    ptOut17.code === 0 && /2 feature\(s\) ativa\(s\)/.test(ptOut17.out) && /por começar/.test(ptOut17.out) && /^O apply mudaria/m.test(ptOut17.out) &&
    ptAp17.code === 0 && /^Migrações aplicadas/m.test(ptAp17.out) && /^Relatório: \.specs\/UPGRADE\.md/m.test(ptAp17.out),
    "upgrade: --apply=maybe is refused (exit 1), no .specs/ exits 1; a PT project gets European-Portuguese output");

  // help + the header docblock list the subcommand and its flag.
  const help17 = run(["help"]).out;
  const doc17 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(/upgrade \[--apply\]/.test(help17) && /--apply \(upgrade\)/.test(help17) && /upgrade \[--apply\]/.test(doc17) && /upgrade: --apply/.test(doc17),
    "help and the header docblock list upgrade [--apply]");
};
