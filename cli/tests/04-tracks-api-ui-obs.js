"use strict";
// The +api, +ui and +obs tracks on the CLI, EN / PT / ES.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp }) => {
  const js = (v) => JSON.stringify(v);
  const rd = (...p) => fs.readFileSync(path.join(...p), "utf8");
  const help = run(["help"]).out;
  const C19 = [
    { tr: "api", marker: "[API]", classify: ["Version the public REST API and return problem+json errors with stable codes", "Versionar a API pública, sem alterações incompatíveis, e devolver os erros em problem+json"],
      steering: "api.md", steeringEs: /^# Estándares de API/, statusPt: /Secções do contrato da API: ◐ Contrato da API \(por preencher\)[^\n]*◐ Limites de Taxa e Quotas \(por preencher\)/,
      docEs: /✗ api-sections — Contrato de la API:sin rellenar/, filledEs: /✓ api-sections — las 5 rellenadas/, typo: "apii", statusKey: "apiSections" },
    { tr: "ui", marker: "[UI]", classify: ["Build the settings page with the design system and WCAG 2.2 AA", "Criar a página de definições com o sistema de design e acessibilidade"],
      steering: "ui.md", steeringEs: /^# Estándares de Interfaz/, statusPt: /Secções da interface: ◐ Uso do Design System \(por preencher\)[^\n]*◐ Orçamento de Desempenho da Interface \(por preencher\)/,
      docEs: /✗ ui-sections — Uso del Design System:sin rellenar/, filledEs: /✓ ui-sections — las 5 rellenadas/, typo: "uii", statusKey: "uiSections" },
    { tr: "obs", marker: "[OBS]", classify: ["Define an SLO for the checkout and page the on-call engineer with a runbook", "Definir um SLO e alertas de observabilidade para o serviço de faturação"],
      steering: "observability.md", steeringEs: /^# Estándares de Observabilidad[\s\S]*## SLOs y Presupuestos de Error/, statusPt: /Secções de operabilidade: ◐ SLIs e SLOs \(por preencher\)[^\n]*◐ Saúde e Capacidade \(por preencher\)/,
      docEs: /✗ obs-sections — SLIs y SLOs:sin rellenar/, filledEs: /✓ obs-sections — las 5 rellenadas/, typo: "obss", statusKey: "obsSections" },
  ];
  for (const X of C19) {
    const n0 = X.tr;
    const pd = path.join(tmp, "p19t-" + n0);
    fs.mkdirSync(pd, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
    const en = run(["classify", X.classify[0], "--project", pd]), pt = run(["classify", X.classify[1], "--project", pd]);
    ok(en.code === 0 && new RegExp("^Tracks: core(?: \\+\\w+)* \\+" + n0 + "\\b").test(en.out) && new RegExp("\\+" + n0 + ": ON").test(en.out) &&
      new RegExp("^Tracks: core(?: \\+\\w+)* \\+" + n0 + "\\b").test(pt.out) && new RegExp("\\+" + n0 + ": ATIVO").test(pt.out),
      `1.19 T1 (CLI): classify turns +${n0} on in EN and PT, with its reasoning (got ` + js([en.out.split("\n")[0], pt.out.split("\n")[0]]) + ")");
    const ini = run(["init", n0, "--lang", "es", "--project", pd]);
    const cr = run(["create", "Pedidos " + n0, "--tracks", "tdd," + n0, "--lang", "pt", "--project", pd]);
    const slug = "pedidos-" + n0;
    const st = run(["status", slug, "--project", pd]).out;
    ok(ini.code === 0 && ini.out.includes(X.steering) && X.steeringEs.test(rd(pd, ".specs", "steering", X.steering)) &&
      cr.code === 0 && new RegExp("\\[core \\+tdd \\+" + n0 + "\\] \\(pt\\)").test(cr.out) && X.statusPt.test(st),
      `1.19 T2 (CLI): init ${n0} --lang es writes the ES ${X.steering}; create --tracks tdd,${n0} (PT) → status shows the ${X.marker} sections ◐ unfilled, in Portuguese (got ` + js([ini.out, cr.out, st]) + ")");
    const es = run(["create", "Orders " + n0, "--tracks", n0, "--lang", "es", "--project", pd]);
    const eslug = "orders-" + n0;
    const doc = run(["doctor", eslug, "--project", pd]);
    run(["approve", eslug, "classification", "--force", "--project", pd]);
    run(["approve", eslug, "requirements", "--force", "--project", pd]);
    const appr = run(["approve", eslug, "design", "--project", pd]);
    const des = path.join(pd, ".specs", eslug, "design.md");
    fs.writeFileSync(des, rd(des).split(/\r?\n/).map((l) => (/^\s*>\s*\*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n"));
    const doc2 = run(["doctor", eslug, "--project", pd]).out;
    const sj = JSON.parse(run(["status", eslug, "--json", "--project", pd]).out);
    ok(es.code === 0 && doc.code === 1 && X.docEs.test(doc.out) && appr.code === 1 && new RegExp(n0 + "-sections").test(appr.out) &&
      X.filledEs.test(doc2) && sj[X.statusKey].length === 5 && sj[X.statusKey].every((s) => s.filled) && sj.distSections === null,
      `1.19 T3 (CLI): doctor exits 1 with ${n0}-sections failing (ES) and approve design is refused naming it; once each TODO line is answered the check passes (--json: ${X.statusKey}) (got ` +
      js([doc.out.split("\n").filter((l) => l.includes(n0 + "-sections")), doc2.split("\n").filter((l) => l.includes(n0 + "-sections"))]) + ")");
    run(["create", "Plain " + n0, "core", "--lang", "en", "--project", pd]);
    const pslug = "plain-" + n0;
    const typo = run(["add-track", pslug, X.typo, "--project", pd]);
    const add = run(["add-track", pslug, "+" + n0, "--project", pd]);
    const rm = run(["add-track", pslug, n0, "--remove", "--project", pd]);
    const trk = run(["tracks", "--project", pd]);
    const pk = run(["tracks", "init", n0, "--project", pd]);
    const usage = run(["add-track", "--project", pd]).out;
    ok(typo.code === 1 && new RegExp("did you mean '" + n0 + "'").test(typo.out) && add.code === 0 && new RegExp("core \\+" + n0).test(add.out) &&
      rm.code === 0 && rm.out.includes("design.md (" + X.marker + " sections)") && trk.code === 0 && trk.out.split("\n").some((l) => l.startsWith("  · " + n0 + " ") && l.includes(X.marker + "  5 secci")) &&
      pk.code === 1 && /reservado/.test(pk.out) && new RegExp("\\+dist(?:/\\+\\w+)*/\\+" + n0 + "\\b").test(help) && new RegExp("\\|" + n0 + "[|>]").test(usage),
      `1.19 T4 (CLI): add-track '${X.typo}' gets a did-you-mean, +${n0} is added and --remove lists its inactive ${X.marker} sections; tracks lists ${n0} ${X.marker} (5 sections, ES project); tracks init ${n0} is refused (reserved); help and the add-track usage name +${n0} (got ` +
      js([typo.out, rm.out, trk.out.split("\n").slice(0, 12), pk.out]) + ")");
  }
};
