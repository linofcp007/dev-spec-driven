"use strict";
// The +dist track (distributed systems and data consistency) on the CLI, EN / PT / ES.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp }) => {
  const js = (v) => JSON.stringify(v);
  const pd = path.join(tmp, "p17d-proj");
  const rd = (...p) => fs.readFileSync(path.join(...p), "utf8");
  const en = run(["classify", "Create an endpoint that writes a user to Postgres and publishes a UserCreated event to Kafka for other services", "--project", pd]);
  const es = run(["classify", "Crear un endpoint que escribe un usuario en Postgres y publica un evento UserCreated en Kafka para otros servicios", "--project", pd]);
  const plain = run(["classify", "Create an endpoint that writes a user to Postgres and returns it", "--project", pd]);
  // (1.17 D review: 'publish … event' is a generic signal now — listed after the weak 'other services')
  ok(en.code === 0 && /^Tracks: core \+dist /.test(en.out) && /dist=high/.test(en.out) && /\+dist: ON \[high confidence\] — matched signals: kafka, other services, publish … event/.test(en.out) &&
    /^Tracks: core \+dist /.test(es.out) && /\+dist: ACTIVO/.test(es.out) && /^Tracks: core /.test(plain.out) && !/^Tracks: core \+dist/.test(plain.out),
    "1.17 D1 (CLI): classify turns +dist on for the user's example (EN / ES), with its confidence and signals; plain CRUD stays core (got " + js([en.out.split("\n")[0], es.out.split("\n")[0], plain.out.split("\n")[0]]) + ")");
  const ini = run(["init", "dist", "--lang", "pt", "--project", pd]);
  const cr = run(["create", "Publicar eventos", "--tracks", "tdd,dist", "--lang", "es", "--project", pd]);
  const st = run(["status", "publicar-eventos", "--project", pd]).out;
  ok(ini.code === 0 && /distributed\.md/.test(ini.out) && /^# Padrões de Sistemas Distribuídos/.test(rd(pd, ".specs", "steering", "distributed.md")) &&
    cr.code === 0 && /\[core \+tdd \+dist\] \(es\)/.test(cr.out) && /Secciones de consistencia de datos: ◐ Modelo de Consistencia \(sin rellenar\)[^\n]*◐ Modos de Fallo \(sin rellenar\)/.test(st),
    "1.17 D2 (CLI): init dist --lang pt writes the PT distributed.md steering; create --tracks tdd,dist (ES) → status shows the five [DIST] sections ◐ unfilled, in Spanish (got " + js([ini.out, cr.out, st]) + ")");
  const doc = run(["doctor", "publicar-eventos", "--project", pd]);
  run(["approve", "publicar-eventos", "classification", "--force", "--project", pd]);
  run(["approve", "publicar-eventos", "requirements", "--force", "--project", pd]);
  const appr = run(["approve", "publicar-eventos", "design", "--project", pd]);
  const des = path.join(pd, ".specs", "publicar-eventos", "design.md");
  fs.writeFileSync(des, rd(des).split(/\r?\n/).map((l) => (/^\s*>\s*\*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n"));
  const doc2 = run(["doctor", "publicar-eventos", "--project", pd]).out;
  const sj = JSON.parse(run(["status", "publicar-eventos", "--json", "--project", pd]).out);
  ok(doc.code === 1 && /✗ dist-sections — Modelo de Consistencia:sin rellenar/.test(doc.out) && appr.code === 1 && /dist-sections/.test(appr.out) &&
    /✓ dist-sections — las 5 rellenadas/.test(doc2) && sj.distSections.length === 5 && sj.distSections.every((s) => s.filled) && sj.secSections === null,
    "1.17 D3 (CLI): doctor exits 1 with dist-sections failing and approve design is refused naming it; once each TODO line is answered the check passes (--json: distSections) (got " + js([doc.out.split("\n").filter((l) => /dist-sections/.test(l)), appr.out.slice(0, 200)]) + ")");
  run(["create", "Plain", "core", "--lang", "en", "--project", pd]);
  const typo = run(["add-track", "plain", "distt", "--project", pd]);
  const add = run(["add-track", "plain", "+dist", "--project", pd]);
  const stPlain = run(["status", "plain", "--project", pd]).out;
  const rm = run(["add-track", "plain", "dist", "--remove", "--project", pd]);
  const stRm = run(["status", "plain", "--project", pd]).out;
  ok(typo.code === 1 && /did you mean 'dist'/.test(typo.out) && add.code === 0 && /core \+dist/.test(add.out) && /Data consistency sections: ◐ Consistency Model \(unfilled\)/.test(stPlain) &&
    rm.code === 0 && /design\.md \(\[DIST\] sections\)/.test(rm.out) && !/Data consistency sections/.test(stRm),
    "1.17 D4 (CLI): add-track 'distt' gets a did-you-mean, +dist is added (status shows its sections), --remove lists the inactive [DIST] sections and status stops showing them (got " + js([typo.out, rm.out]) + ")");
  const trk = run(["tracks", "--project", pd]);
  const pk = run(["tracks", "init", "dist", "--project", pd]);
  const help = run(["help"]).out;
  const usage = run(["add-track", "--project", pd]).out;
  ok(trk.code === 0 && /^Tracks — 11 incluídos/.test(trk.out) && /  · dist +\[DIST\]  5 secção/.test(trk.out) && pk.code === 1 && /reservado/.test(pk.out) && // the project speaks PT (init --lang pt)
    /core\/\+tdd\/\+saas\/\+ai\/\+sec\/\+privacy\/\+dist/.test(help) && /<tdd\|saas\|ai\|sec\|privacy\|dist[|>]/.test(usage),
    "1.17 D5 (CLI): tracks lists dist [DIST] (5 sections) among the built-in tracks; tracks init dist is refused (reserved); help and the add-track usage name +dist (got " + js([trk.out.split("\n").slice(0, 9), pk.out]) + ")");
  const kiro = path.join(pd, ".kiro", "specs", "signup");
  fs.mkdirSync(kiro, { recursive: true });
  fs.writeFileSync(path.join(kiro, "requirements.md"), "### Requirement 1\n\n**User Story:** As a user, I want to sign up.\n\n#### Acceptance Criteria\n\n1. WHEN the user signs up THEN the system SHALL store the user and publish a UserCreated event to Kafka\n");
  const imp = run(["import", "kiro", ".kiro/specs/signup", "--lang", "en", "--project", pd]);
  const impDesign = fs.existsSync(path.join(pd, ".specs", "signup", "design.md")) ? rd(pd, ".specs", "signup", "design.md") : "";
  ok(imp.code === 0 && /\+dist/.test(imp.out) && /## \[DIST\] Cross-system Writes/.test(impDesign),
    "1.17 D6 (CLI): import kiro auto-classifies a Kafka-publishing spec as +dist and appends the [DIST] design sections (got " + js(imp.out.slice(0, 300)) + ")");

  // 1.17 D review 1 (CLI): a 1.16 track pack named 'kafka' (reserved since) — doctor names it, upgrade flags it, add-track … --remove drops it
  const lp = path.join(tmp, "p17d-legacy");
  run(["init", "--lang", "en", "--project", lp]);
  run(["create", "Orders", "core", "--lang", "en", "--project", lp]);
  fs.mkdirSync(path.join(lp, ".specs", "tracks", "kafka"), { recursive: true });
  fs.writeFileSync(path.join(lp, ".specs", "tracks", "kafka", "track.json"), JSON.stringify({ name: "kafka", marker: "KAFKA", title: { en: "Kafka" }, sections: [{ name: "Topic Catalog" }] }));
  const lsp = path.join(lp, ".specs", "orders", ".state.json");
  const lst = JSON.parse(rd(lsp));
  lst.tracks = ["core", "kafka"];
  lst.packMarkers = { kafka: "[KAFKA]" };
  fs.writeFileSync(lsp, JSON.stringify(lst, null, 2));
  const lDoc = run(["doctor", "orders", "--project", lp]).out;
  const lUp = run(["upgrade", "--project", lp]).out;
  const lRm = run(["add-track", "orders", "kafka", "--remove", "--project", lp]);
  const lDoc2 = run(["doctor", "orders", "--project", lp]).out;
  ok(/track-pack-missing — track pack\(s\) not available: \+kafka \(a track pack from before 1\.17 — 'kafka' is a reserved name now/.test(lDoc) &&
    /Rename its track pack\(s\) from before 1\.17 — \+kafka/.test(lUp) && lRm.code === 0 && !/track-pack-missing/.test(lDoc2) &&
    JSON.parse(rd(lsp)).tracks.join() === "core",
    "1.17 D review 1 (CLI): a 1.16 'kafka' pack — doctor's track-pack-missing names the reserved name, upgrade asks to rename it, add-track orders kafka --remove drops it (got " +
    js([lDoc.split("\n").filter((l) => /track-pack/.test(l)), lRm.out, lRm.code]) + ")");
  // 1.17 D review 2 (CLI): app-level words alone never turn +dist on — the note names them
  const pq = run(["classify", "Print queue: users send documents to the office printer queue and can retry failed prints", "--project", pd]);
  ok(pq.code === 0 && !/^Tracks: core \+dist/.test(pq.out) && /Possible \+dist — only app-level words \('queue', 'retry'\)|Possível \+dist — só palavras comuns de aplicação \('queue', 'retry'\)/.test(pq.out),
    "1.17 D review 2 (CLI): classify keeps a print queue with a retry off +dist and names the app-level words (got " + js(pq.out.split("\n").slice(0, 4)) + ")");
};
