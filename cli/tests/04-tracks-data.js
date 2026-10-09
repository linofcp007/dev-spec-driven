"use strict";
// The +data track on the CLI (EN / PT / ES) and the example +mobile track pack (tracks check on a copy).

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, runIn, tmp, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const rd = (...p) => fs.readFileSync(path.join(...p), "utf8");
  const help = runIn(["help"]).out;
  const pd = path.join(tmp, "p21-data");
  fs.mkdirSync(pd, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)

  // classify turns +data on in EN and PT; init data --lang es writes the ES data.md; create --tracks tdd,data (PT) → status in PT
  const en = runIn(["classify", "Build an ETL pipeline that loads the orders into BigQuery every night", "--project", pd]);
  const pt = runIn(["classify", "Verificações de qualidade de dados na ingestão para o armazém de dados", "--project", pd]);
  ok(en.code === 0 && /^Tracks: core(?: \+\w+)* \+data\b/.test(en.out) && /\+data: ON/.test(en.out) && /^Tracks: core(?: \+\w+)* \+data\b/.test(pt.out) && /\+data: ATIVO/.test(pt.out),
    "1.21 F4 (CLI): classify turns +data on in EN and PT, with its reasoning (got " + js([en.out.split("\n")[0], pt.out.split("\n")[0]]) + ")");
  const ini = runIn(["init", "data", "--lang", "es", "--project", pd]);
  const cr = runIn(["create", "Pedidos data", "--tracks", "tdd,data", "--lang", "pt", "--project", pd]);
  const st = runIn(["status", "pedidos-data", "--project", pd]).out;
  ok(ini.code === 0 && ini.out.includes("data.md") && /^# Estándares de Pipelines de Datos/.test(rd(pd, ".specs", "steering", "data.md")) && cr.code === 0 &&
    /\[core \+tdd \+data\] \(pt\)/.test(cr.out) && /Secções do pipeline de dados: ◐ Contratos de Dados e Evolução do Esquema \(por preencher\)[^\n]*◐ Retenção e Custo \(por preencher\)/.test(st),
    "1.21 F4 (CLI): init data --lang es writes the ES data.md; create --tracks tdd,data (PT) → status shows the [DATA] sections ◐ unfilled, in Portuguese (got " + js([ini.out, cr.out, st]) + ")");

  // doctor (ES) exits 1 with data-sections failing, approve design is refused naming it; filled, the check passes (--json dataSections)
  const es = runIn(["create", "Orders data", "--tracks", "data", "--lang", "es", "--project", pd]);
  const doc = runIn(["doctor", "orders-data", "--project", pd]);
  runIn(["approve", "orders-data", "classification", "--force", "--project", pd]);
  runIn(["approve", "orders-data", "requirements", "--force", "--project", pd]);
  const appr = runIn(["approve", "orders-data", "design", "--project", pd]);
  const des = path.join(pd, ".specs", "orders-data", "design.md");
  fs.writeFileSync(des, rd(des).split(/\r?\n/).map((l) => (/^\s*>\s*\*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n"));
  const doc2 = runIn(["doctor", "orders-data", "--project", pd]).out;
  const sj = JSON.parse(runIn(["status", "orders-data", "--json", "--project", pd]).out);
  ok(es.code === 0 && doc.code === 1 && /✗ data-sections — Contratos de Datos y Evolución del Esquema:sin rellenar/.test(doc.out) && appr.code === 1 && /data-sections/.test(appr.out) &&
    /✓ data-sections — las 5 rellenadas/.test(doc2) && sj.dataSections.length === 5 && sj.dataSections.every((s) => s.filled) && sj.obsSections === null,
    "1.21 F4 (CLI): doctor exits 1 with data-sections failing (ES) and approve design is refused naming it; once each TODO line is answered the check passes (--json: dataSections) (got " +
    js([doc.out.split("\n").filter((l) => l.includes("data-sections")), doc2.split("\n").filter((l) => l.includes("data-sections"))]) + ")");

  // add-track: a did-you-mean for a typo, +data added and --remove lists its inactive sections; tracks lists data [DATA]; tracks init data / etl
  // is refused (reserved); help and the add-track usage name +data
  runIn(["create", "Plain data", "core", "--lang", "en", "--project", pd]);
  const typo = runIn(["add-track", "plain-data", "dataa", "--project", pd]);
  const add = runIn(["add-track", "plain-data", "+data", "--project", pd]);
  const rm = runIn(["add-track", "plain-data", "data", "--remove", "--project", pd]);
  const trk = runIn(["tracks", "--project", pd]);
  const pk = runIn(["tracks", "init", "data", "--project", pd]), pkEtl = runIn(["tracks", "init", "etl", "--project", pd]);
  const usage = runIn(["add-track", "--project", pd]).out;
  ok(typo.code === 1 && /did you mean 'data'/.test(typo.out) && add.code === 0 && /core \+data/.test(add.out) && rm.code === 0 && rm.out.includes("design.md ([DATA] sections)") &&
    trk.code === 0 && trk.out.split("\n").some((l) => l.startsWith("  · data ") && l.includes("[DATA]  5 secci")) && pk.code === 1 && /reservado/.test(pk.out) && pkEtl.code === 1 &&
    /\+obs\/\+data\b/.test(help) && /\|obs\|data>/.test(usage),
    "1.21 F4 (CLI): add-track 'dataa' gets a did-you-mean, +data is added and --remove lists its inactive [DATA] sections; tracks lists data [DATA] (5 sections, ES project); tracks init data / etl are refused (reserved); help and the add-track usage name +data (got " +
    js([typo.out, rm.out, trk.out.split("\n").slice(0, 14), pk.out, pkEtl.out]) + ")");

  // the example +mobile pack: copied into a project's .specs/tracks/mobile/, `tracks check` passes (exit 0, no warning) and a create uses it
  const mp = path.join(tmp, "p21-mobile");
  runIn(["init", "--project", mp]);
  fs.cpSync(path.join(__dirname, "..", "examples", "track-packs", "mobile"), path.join(mp, ".specs", "tracks", "mobile"), { recursive: true });
  const chk = runIn(["tracks", "check", "--project", mp]);
  const mc = runIn(["create", "Offline orders", "--tracks", "tdd,mobile", "--project", mp]);
  const mdoc = runIn(["doctor", "offline-orders", "--project", mp]);
  ok(chk.code === 0 && /1 valid, 0 error\(s\), 0 warning\(s\)/.test(chk.out) && mc.code === 0 && /\[core \+tdd \+mobile\]/.test(mc.out) && /steering\/mobile\.md/.test(mc.out) &&
    mdoc.code === 1 && /✗ mobile-sections — Offline & Sync:unfilled/.test(mdoc.out),
    "1.21 F4 (CLI): examples/track-packs/mobile copied to .specs/tracks/mobile — tracks check passes (exit 0, no warning); create --tracks tdd,mobile scaffolds it (steering/mobile.md) and doctor fails mobile-sections until filled (got " +
    js([chk.out, mc.out, mdoc.out.split("\n").filter((l) => /mobile/.test(l))]) + ")");
};
