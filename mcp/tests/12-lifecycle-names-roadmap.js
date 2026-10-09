"use strict";
// Lifecycle — names and the generated roadmap: one-line names, re-runs and slug cuts, active + archived twins, appends after an open code fence, linked folders, ROADMAP.md (Mermaid, stale deps, emoji cuts, a broken roadmap.json).
// (12-lifecycle.js holds the area's main tests.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, rpc, payload, S, tmp, __dirname }) => {
  const js = JSON.stringify;
  const CLI = path.join(__dirname, "..", "cli", "dev-spec.js");
  const fresh = (n) => { const p = path.join(tmp, "proj-r5-" + n); S.initProject(p, ["core"]); return p; };
  const rd = (...a) => fs.readFileSync(path.join(...a), "utf8");
  const link = (target, at) => { try { fs.symlinkSync(target, at, "junction"); return true; } catch { return false; } };
  const fileLink = (target, at) => { try { fs.symlinkSync(target, at, "file"); return true; } catch { return false; } };

  // M3 — spec_add_track appended its mandatory sections after a design.md that ends inside an open code fence (a pasted snippet): the
  // sections were code to every reader, doctor read them 'missing' right after add_track said it added them, and a second add wrote
  // them twice. The fence is closed first (appendSpecText — decide's rule, now every spec writer's); tasks.md the same; CRLF kept.
  {
    const p = fresh("fence");
    const c = S.createFeature(p, "Fenced", ["core"]);
    fs.appendFileSync(path.join(c.dir, "design.md"), "\n## Notes\n\n```js\nconst x = 1;\n");
    fs.appendFileSync(path.join(c.dir, "tasks.md"), "\n```\nnpm test\n");
    const a1 = S.addTrack(p, c.slug, "sec");
    const sec = S.specDoctor(p, c.slug).checks.find((x) => x.id === "sec-sections");
    S.removeTrack(p, c.slug, "sec");
    const a2 = S.addTrack(p, c.slug, "sec");
    const design = rd(c.dir, "design.md");
    const heads = (design.match(/^## \[SEC\]/gm) || []).length;
    ok(a1.ok && a1.added.includes("design.md (+sections)") && sec && !/:missing/.test(sec.detail) && /:unfilled/.test(sec.detail) &&
      /const x = 1;\n```\n\n## \[SEC\]/.test(design) && heads === S.trackSections("sec").length && a2.ok && !a2.added.includes("design.md (+sections)") &&
      /npm test\n```\n/.test(rd(c.dir, "tasks.md")),
      "1.23 review 5 (M3): add_track closes a code block design.md / tasks.md leave open before appending — doctor reads the sections (unfilled, never missing) and a re-add writes nothing (got " +
      js([a1.added, sec && sec.detail.slice(0, 80), heads, a2.added]) + ")");
    // CRLF design.md: the appended block keeps the file's line ends (it used to add LF lines to a CRLF file)
    const c2 = S.createFeature(p, "Crlf design", ["core"]);
    fs.writeFileSync(path.join(c2.dir, "design.md"), rd(c2.dir, "design.md").replace(/\r?\n/g, "\r\n") + "```\r\nopen\r\n");
    const a3 = S.addTrack(p, c2.slug, "sec");
    const raw = rd(c2.dir, "design.md");
    ok(a3.ok && /\[SEC\]/.test(raw) && !/[^\r]\n/.test(raw) && /open\r\n```\r\n/.test(raw),
      "1.23 review 5 (M3): add_track on a CRLF design.md writes its sections in CRLF, after closing the open fence (got " + js([a3.ok, (raw.match(/[^\r]\n/g) || []).length]) + ")");
    // the covered sections a track removal restores (sized feature) go through the same append
    const m = S.createFeature(p, "Obs", ["core", "saas", "obs"], "", undefined, "en", undefined, { size: "m" });
    fs.appendFileSync(path.join(m.dir, "design.md"), "\n```mermaid\ngraph TD\n");
    const r = S.addTrack(p, m.slug, "obs", { remove: true });
    const saas = S.specDoctor(p, m.slug).checks.find((x) => x.id === "saas-sections");
    ok(r.ok && r.restoredSections && r.restoredSections.length === 2 && saas && !/:missing/.test(saas.detail),
      "1.23 review 5 (M3): the [SaaS] sections a removed +obs covered are restored after the open fence is closed — doctor reads them (got " + js([r.restoredSections, saas && saas.detail.slice(0, 90)]) + ")");
  }

  // L2 — a feature name with a line break opened a heading in every scaffold ("Login\n## US-9 …" put a real criterion into
  // requirements.md): the name is ONE line wherever it is written (flatText), the folder unchanged.
  {
    const p = fresh("names");
    const r = S.createFeature(p, "Login\n## Injected\n- [ ] 99. injected task\n1. WHEN x THE SYSTEM SHALL y", ["core"]);
    const plain = S.createFeature(p, "Plain login", ["core"]);
    const files = ["requirements.md", "design.md", "tasks.md", "classification.md"];
    const heads = files.map((f) => rd(r.dir, f).split("\n")[0]);
    const count = (dir, f, re) => (rd(dir, f).match(re) || []).length;
    ok(r.ok && heads.every((h) => /: Login ## Injected - \[ \] 99\. injected task 1\. WHEN x THE SYSTEM SHALL y$/.test(h)) &&
      files.every((f) => count(r.dir, f, /^#{1,6} /gm) === count(plain.dir, f, /^#{1,6} /gm)) && !/^## Injected/m.test(rd(r.dir, "requirements.md")) &&
      S.statusFeature(p, r.slug).tasks.total === S.statusFeature(p, plain.slug).tasks.total,
      "1.23 review 5 (L2): a name holding line breaks is written on one line in every title — no injected heading, task or criterion line (got " + js(heads) + ")");
  }

  // L3 — a re-run says so (existed + a localized note; the summary it was given is not written), and two names that differ only
  // past the slug's 64-character cut no longer merge silently: the second is refused (nothing changed) — by its slug it is reachable.
  {
    const p = fresh("trunc");
    const a = "Customer account management dashboard with role based access control for admins";
    const b = "Customer account management dashboard with role based access control for auditors";
    const r1 = S.createFeature(p, a, ["core"], "Admins manage accounts.");
    const before = rd(r1.dir, "requirements.md");
    const r2 = S.createFeature(p, b, ["core"], "Auditors read accounts.");
    const r3 = S.createFeature(p, a, ["core"], "Another summary.");
    const r4 = S.createFeature(p, r1.slug, ["core"]);
    const s1 = S.createFeature(p, "Login", ["core"]);
    const s2 = S.createFeature(p, "login", ["core"]);
    const pt = S.createFeature(p, "Pagamentos", ["core"], undefined, undefined, "pt");
    const pt2 = S.createFeature(p, "Pagamentos", ["core"], "Outro resumo.");
    ok(!r2.ok && r2.slugTaken === true && r2.feature === r1.slug && /reaches the folder \.specs\/customer-account-management-dashboard-with-role-based-access-con\//.test(r2.error) &&
      /name it 'customer-account-management-dashboard-with-role-based-access-con'/.test(r2.error) && rd(r1.dir, "requirements.md") === before && !/Auditors/.test(before),
      "1.23 review 5 (L3): a long name that reaches an existing feature holding ANOTHER long name (they differ past the 64-character cut) is refused, nothing changed (got " + js([r2.ok, r2.error]) + ")");
    ok(r3.ok && r3.existed === true && /already exists — nothing was re-created/.test(r3.note) && /summary given was not written/.test(r3.note) && r4.ok && r4.existed === true &&
      !s1.existed && s2.ok && s2.existed === true && !/summary/.test(s2.note) && pt2.existed === true && /já existe — nada foi recriado/.test(pt2.note) && /O resumo indicado não foi escrito/.test(pt2.note),
      "1.23 review 5 (L3): a re-run (the same name, its slug, another spelling) answers existed: true with a localized note, naming a summary it did not write (EN / PT) (got " + js([r3.note, s2.note, pt2.note, pt.ok]) + ")");
    const cli = spawnSync(process.execPath, [CLI, "create", "Login", "--project", p], { encoding: "utf8" });
    ok(cli.status === 0 && /already exists — nothing was re-created/.test(cli.stdout),
      "1.23 review 5 (L3): `dev-spec create` on an existing feature prints the note (got " + js(cli.stdout.slice(-200)) + ")");
  }

  // L4 — one slug active AND archived: archive and restore each named a way out the other refused ("archive it" / "Remove it there
  // first"). Now: both say rename (the runnable command); create notes an archived twin; rename onto an archived slug is refused.
  {
    const p = fresh("twin");
    S.createFeature(p, "Alpha", ["core"]);
    S.archiveFeature(p, "alpha");
    const c = S.createFeature(p, "Alpha", ["core"]);
    const ar = S.archiveFeature(p, "alpha");
    const rs = S.restoreFeature(p, "alpha");
    ok(c.ok && c.archivedTwin === true && /An archived feature is named 'alpha' too/.test(c.note) &&
      !ar.ok && /rename this feature first \(.*feature rename alpha "<new name>"\), then archive it/.test(ar.error) && !/Remove it there/.test(ar.error) &&
      !rs.ok && /rename it first \(.*feature rename alpha "<new name>"\), then restore the archived one/.test(rs.error) && !/or archive/.test(rs.error),
      "1.23 review 5 (L4): an active + archived twin — create notes it, archive and restore both name the rename that unblocks them (got " + js([c.note, ar.error, rs.error]) + ")");
    S.createFeature(p, "Beta", ["core"]);
    const rn = S.renameFeature(p, "beta", "alpha-two");
    S.archiveFeature(p, "alpha-two");
    const onto = S.renameFeature(p, "alpha", "alpha-two");
    const out = S.renameFeature(p, "alpha", "alpha-new");
    const back = S.restoreFeature(p, "alpha");
    ok(rn.ok && !onto.ok && onto.archivedName === true && /'alpha-two' is the name of an archived feature/.test(onto.error) && fs.existsSync(path.join(p, ".specs", "alpha")) &&
      out.ok && back.ok && fs.existsSync(path.join(p, ".specs", "alpha", ".state.json")) && fs.existsSync(path.join(p, ".specs", "alpha-new")),
      "1.23 review 5 (L4): rename onto an archived feature's slug is refused (nothing moved); renaming the active twin away lets the archived one be restored (got " + js([onto.error, out.ok, back.ok]) + ")");
    const pe = path.join(tmp, "proj-r5-twin-es");
    S.initProject(pe, ["core"], "es");
    S.createFeature(pe, "Alfa", ["core"]);
    const pa = S.archiveFeature(pe, "alfa");
    S.createFeature(pe, "Alfa", ["core"]);
    const es = S.archiveFeature(pe, "alfa");
    const esr = S.restoreFeature(pe, "alfa");
    ok(pa.ok && !es.ok && /ya está archivada .* renombra primero esta función/.test(es.error) && /renómbrala primero .* y luego restaura la archivada/.test(esr.error),
      "1.23 review 5 (L4): the archive / restore refusals in ES (got " + js([es.error, esr.error]) + ")");
  }

  // L5 — display truncations never cut a surrogate pair (cutText): the next-task cell (42 units in ROADMAP.md, 60 in the .html) wrote
  // U+FFFD into the committed file.
  {
    const p = fresh("emoji");
    const c = S.createFeature(p, "Emoji", ["core"]);
    const e = String.fromCodePoint(0x1f389);
    fs.writeFileSync(path.join(c.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. " + "A".repeat(41) + e + " and " + "B".repeat(13) + e + " done\n  - _Requirements: US-1.AC-1_\n");
    S.approvePhase(p, c.slug, "tasks", "t", { force: true });
    S.writeRoadmapMd(p);
    S.writeRoadmapHtml(p);
    const md = rd(p, ".specs", "ROADMAP.md");
    const html = rd(p, ".specs", "ROADMAP.html");
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    ok(!md.includes("\uFFFD") && !html.includes("\uFFFD") && !lone.test(md) && !lone.test(html) && md.includes("#1 " + "A".repeat(41) + " |"),
      "1.23 review 5 (L5): ROADMAP.md / .html cut the next task's text before an emoji, never inside it (no U+FFFD, no lone surrogate)");
  }

  // L6 — the Mermaid graph drew every dependsOn string as written: a hand-edited entry forged edges and labels, and a feature slugged
  // `end` (a flowchart keyword) broke the graph. Now: edges between existing features only, ids prefixed (f_), labels without a raw
  // quote; a stale entry is listed under Needs attention with the command that sets the list again.
  {
    const p = fresh("mermaid");
    S.createFeature(p, "End", ["core"]);
    S.createFeature(p, "Other", ["core"]);
    S.setDependency(p, "other", ["end"]);
    const rmf = path.join(p, ".specs", "roadmap.json");
    const rm = JSON.parse(rd(rmf));
    rm.features.other.dependsOn.push("ghost\"] --> x[\"<img src=x>");
    fs.writeFileSync(rmf, JSON.stringify(rm, null, 2));
    S.writeRoadmapMd(p);
    S.writeRoadmapHtml(p);
    const md = rd(p, ".specs", "ROADMAP.md");
    const graph = (md.match(/```mermaid\n([\s\S]*?)```/) || ["", ""])[1];
    const att = md.split("\n").filter((l) => /which is no feature/.test(l));
    const html = rd(p, ".specs", "ROADMAP.html");
    ok(graph === "graph LR\n  f_end[\"end\"] --> f_other[\"other\"]\n" && !/^\s*end\[/m.test(graph) && att.length === 1 && /dev-spec depend other end$/.test(att[0]) &&
      !/<img/.test(md) && !/<img/.test(html) && /which is no feature/.test(html),
      "1.23 review 5 (L6): the Mermaid graph holds edges between existing features only (prefixed ids — `end` is safe); a stale dependsOn is a Needs-attention line with `depend other end` (got " +
      js([graph, att]) + ")");
  }

  // CLI review — `roadmap --write` on a broken roadmap.json regenerated ROADMAP.md from the sanitized copy (deps, backlog, milestones
  // gone) and exited 0. Now ROADMAP.md is kept, the write is an error (CLI exit 1, MCP isError), the read-only view warns, and the
  // refresh after a mutation leaves ROADMAP.md alone.
  {
    const p = fresh("broken");
    S.createFeature(p, "A one", ["core"]);
    S.createFeature(p, "B two", ["core"]);
    S.setDependency(p, "b-two", ["a-one"]);
    const md0 = rd(p, ".specs", "ROADMAP.md");
    fs.writeFileSync(path.join(p, ".specs", "roadmap.json"), "{ \"features\": ");
    const w = S.roadmapReport(p, { write: true, html: true });
    const v = S.roadmapReport(p, {});
    S.createFeature(p, "C three", ["core"]);
    const cli = spawnSync(process.execPath, [CLI, "roadmap", "--write", "--project", p], { encoding: "utf8" });
    const mcp = await rpc("tools/call", { name: "spec_roadmap", arguments: { write: true, projectDir: p } });
    ok(w.ok === false && /not valid JSON/.test(w.error) && /ROADMAP\.md was not regenerated/.test(w.error) && !(w.warnings || []).length && !fs.existsSync(path.join(p, ".specs", "ROADMAP.html")) &&
      v.ok !== false && /This view leaves out what it can't read/.test((v.warnings || [])[0]) && rd(p, ".specs", "ROADMAP.md") === md0 &&
      cli.status === 1 && /was not regenerated/.test(cli.stderr) && mcp.result.isError === true && /was not regenerated/.test(js(payload(mcp))),
      "1.23 review 5 (CLI review): a broken roadmap.json never regenerates ROADMAP.md (write → error on MCP and the CLI, exit 1; view → a warning; a mutation's refresh skips it) (got " +
      js([w.error, v.warnings, cli.status]) + ")");
  }

  // L1 — linked folders: spec_init / steering_scaffold wrote steering stubs into the folder a .specs/steering link points at, spec_create
  // and add_track wrote a whole feature through a linked .specs/<feature>/ (spec_export and templates init already refused). Refused now,
  // nothing written; ROADMAP.md never copies the next task out of a tasks.md linked outside .specs/.
  {
    const p = path.join(tmp, "proj-r5-linked");
    const out = path.join(tmp, "r5-outside-steering");
    fs.mkdirSync(path.join(p, ".specs"), { recursive: true });
    fs.mkdirSync(out, { recursive: true });
    if (link(out, path.join(p, ".specs", "steering"))) {
      const r = S.initProject(p, ["core", "saas"]);
      const s = S.scaffoldSteeringFile(p, "api-conventions.md");
      ok(r.ok === false && r.linked === true && /Refused to write into \.specs\/steering\/: that folder is a link/.test(r.error) && s.ok === false && fs.readdirSync(out).length === 0,
        "1.23 review 5 (L1): spec_init and steering_scaffold refuse a linked .specs/steering/ — nothing written where it points (got " + js([r.error, s.error, fs.readdirSync(out)]) + ")");
      fs.rmSync(path.join(p, ".specs", "steering"), { recursive: false, force: true });
      try { fs.unlinkSync(path.join(p, ".specs", "steering")); } catch { /* gone */ }
    }
    S.initProject(p, ["core"]);
    const out2 = path.join(tmp, "r5-outside-feature");
    fs.mkdirSync(out2, { recursive: true });
    fs.writeFileSync(path.join(out2, "keep.txt"), "x");
    if (link(out2, path.join(p, ".specs", "lnk"))) {
      const c = S.createFeature(p, "lnk", ["core"]);
      const a = S.addTrack(p, "lnk", "sec");
      ok(c.ok === false && c.linked === true && /\.specs\/lnk\//.test(c.error) && a.ok === false && js(fs.readdirSync(out2)) === js(["keep.txt"]),
        "1.23 review 5 (L1): spec_create / add_track refuse a linked feature folder — nothing written through it (got " + js([c.error, a.error, fs.readdirSync(out2)]) + ")");
    }
    const f = S.createFeature(p, "Leaky", ["core"]);
    const secret = path.join(tmp, "r5-secret-tasks.md");
    fs.writeFileSync(secret, "# Tasks\n\n- [ ] 1. SECRET-TASK-333\n");
    fs.rmSync(path.join(f.dir, "tasks.md"));
    if (fileLink(secret, path.join(f.dir, "tasks.md"))) {
      S.approvePhase(p, f.slug, "tasks", "t", { force: true });
      S.writeRoadmapMd(p);
      ok(!/SECRET/.test(rd(p, ".specs", "ROADMAP.md")), "1.23 review 5 (L1): ROADMAP.md never copies a task out of a tasks.md linked outside .specs/");
    }
  }

  // Improvement 5 — spec_import refreshes ROADMAP.md once (createFeature's own refresh is skipped: { refresh: false }); the roadmap is
  // still current after the import.
  {
    const p = fresh("refresh");
    fs.rmSync(path.join(p, ".specs", "ROADMAP.md"), { force: true });
    const c = S.createFeature(p, "Quiet", ["core"], undefined, undefined, undefined, undefined, { refresh: false });
    const quiet = !fs.existsSync(path.join(p, ".specs", "ROADMAP.md"));
    const imp = S.importSpec(p, "plan", null, { text: "# Imported plan\n\n## Steps\n\n- [ ] Do one thing\n" });
    ok(c.ok && quiet && imp.ok && /\[imported-plan\]/.test(rd(p, ".specs", "ROADMAP.md")) && /\[quiet\]/.test(rd(p, ".specs", "ROADMAP.md")),
      "1.23 review 5 (improvement 5): createFeature { refresh: false } leaves ROADMAP.md alone; an import refreshes it once, after its files");
  }
};
