"use strict";
// The +sec / +privacy tracks on the CLI, EN / PT / ES.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, runIn, tmp }) => {
  const a2 = path.join(tmp, "pa2-proj");
  fs.mkdirSync(a2, { recursive: true }); fs.mkdirSync(path.join(tmp, "pa2-steer"), { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
  const cls = runIn(["classify", "Threat model the export and pseudonymize personal data", "--project", a2]);
  const clsEs = runIn(["classify", "Modelo de amenazas y cifrado en reposo de los datos personales", "--project", a2]);
  ok(cls.code === 0 && /Tracks: core \+sec \+privacy/.test(cls.out) && /sec=medium, privacy=high/.test(cls.out) && /\+sec: ON/.test(cls.out) && /\+privacy: ON/.test(cls.out) &&
    /core \+sec \+privacy/.test(clsEs.out) && /sec=alta, privacy=media/.test(clsEs.out) && /\+sec: ACTIVO \[confianza alta\] — señales encontradas: modelo de amenazas, cifrado en reposo/.test(clsEs.out),
    "classify prints the +sec / +privacy confidence and reasoning (EN and ES)");
  const ini = runIn(["init", "sec", "privacy", "--lang", "es", "--project", a2]);
  ok(ini.code === 0 && /security\.md, privacy\.md/.test(ini.out) && /^# Estándares de Seguridad/.test(fs.readFileSync(path.join(a2, ".specs", "steering", "security.md"), "utf8")),
    "init sec privacy --lang es writes the ES security.md / privacy.md steering stubs");
  const cr = runIn(["create", "Exportar", "--tracks", "sec,privacy", "--lang", "pt", "--project", a2]);
  const st = runIn(["status", "exportar", "--project", a2]).out;
  ok(cr.code === 0 && /\[core \+sec \+privacy\] \(pt\)/.test(cr.out) && /Secções de segurança: ◐ Modelo de Ameaças \(por preencher\)/.test(st) &&
    /Secções de privacidade: ◐ Inventário de Dados Pessoais \(por preencher\)[^\n]*◐ AIPD \(por preencher\)/.test(st),
    "create --tracks sec,privacy (PT) → status shows the security and privacy sections ◐ unfilled, in Portuguese");
  const doc = runIn(["doctor", "exportar", "--project", a2]);
  const appr = runIn(["approve", "exportar", "design", "--project", a2]);
  ok(doc.code === 1 && /✗ sec-sections — Modelo de Ameaças:por preencher/.test(doc.out) && /✗ privacy-sections — /.test(doc.out) &&
    appr.code === 1 && /sec-sections, privacy-sections/.test(appr.out),
    "doctor exits 1 with sec-sections / privacy-sections failing; approve design is refused naming them");
  const des = path.join(a2, ".specs", "exportar", "design.md");
  fs.writeFileSync(des, fs.readFileSync(des, "utf8").split(/\r?\n/).map((l) => (/^\s*>\s*\*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n"));
  const doc2 = runIn(["doctor", "exportar", "--project", a2]).out;
  const js = JSON.parse(runIn(["status", "exportar", "--json", "--project", a2]).out);
  ok(/✓ sec-sections — as 5 preenchidas/.test(doc2) && /✓ privacy-sections — as 6 preenchidas/.test(doc2) && /✓ Modelo de Ameaças · ✓ Requisitos de Segurança/.test(runIn(["status", "exportar", "--project", a2]).out) &&
    js.secSections.length === 5 && js.secSections.every((s) => s.filled) && js.privacySections.length === 6 && js.scaleSections === null,
    "once each TODO line is answered doctor passes both section checks and status marks them ✓ (--json: secSections / privacySections)");
  runIn(["create", "Plain", "core", "--lang", "en", "--project", a2]);
  const typo = runIn(["add-track", "plain", "secc", "--project", a2]);
  const add = runIn(["add-track", "plain", "sec", "privacy", "--project", a2]);
  const rm = runIn(["add-track", "plain", "privacy", "--remove", "--project", a2]);
  const stPlain = runIn(["status", "plain", "--project", a2]).out;
  ok(typo.code === 1 && /did you mean 'sec'/.test(typo.out) && add.code === 0 && /core \+sec \+privacy/.test(add.out) &&
    rm.code === 0 && /design\.md \(\[PRIVACY\] sections\)/.test(rm.out) && /Security sections: ◐ Threat Model \(unfilled\)/.test(stPlain) && !/Privacy sections/.test(stPlain),
    "add-track: 'secc' gets a did-you-mean, sec+privacy are added, --remove privacy lists its inactive [PRIVACY] sections and status stops showing them");
  const stSec = runIn(["steering", "security.md", "--lang", "pt", "--project", path.join(tmp, "pa2-steer")]);
  const kiro = path.join(a2, ".kiro", "specs", "accounts");
  fs.mkdirSync(kiro, { recursive: true });
  fs.writeFileSync(path.join(kiro, "requirements.md"), "### Requirement 1\n\n**User Story:** As a user, I want to delete my account.\n\n#### Acceptance Criteria\n\n1. WHEN the user confirms THEN the system SHALL delete the account\n");
  const imp = runIn(["import", "kiro", ".kiro/specs/accounts", "--tracks", "sec,privacy", "--lang", "en", "--project", a2]); // the project default is ES (init above)
  const impDesign = fs.existsSync(path.join(a2, ".specs", "accounts", "design.md")) ? fs.readFileSync(path.join(a2, ".specs", "accounts", "design.md"), "utf8") : "";
  ok(stSec.code === 0 && /^# Padrões de Segurança/.test(fs.readFileSync(path.join(tmp, "pa2-steer", ".specs", "steering", "security.md"), "utf8")) &&
    imp.code === 0 && /## \[SEC\] Threat Model/.test(impDesign) && /## \[PRIVACY\] Data Subject Rights/.test(impDesign),
    "steering security.md (PT template, not a custom file) and import --tracks sec,privacy (the [SEC] / [PRIVACY] design sections)");
  const help = runIn(["help"]).out;
  const usage = runIn(["add-track", "--project", a2]).out;
  ok(/core\/\+tdd\/\+saas\/\+ai\/\+sec\/\+privacy/.test(help) && /\+tdd\/\+saas\/\+ai\/\+sec\/\+privacy\/\+dist(?:\/\+\w+)* \(additive, never overwrites\)/.test(help) && /<tdd\|saas\|ai\|sec\|privacy\|dist[|>]/.test(usage),
    "help and the add-track usage name the +sec / +privacy / +dist tracks");
  // 1.24 r6 F5: a negated subject with a finite verb and a negative predicate over "without X" are requirements on the CLI too (= spec_classify)
  const req = [["privacy", "No personal data is sent to the LLM provider"], ["sec", "Reject requests without a valid access token"],
    ["sec", "Los usuarios sin MFA no pueden acceder al panel de administración"]].map(([tr, t]) => {
    let j = null;
    try { j = JSON.parse(runIn(["classify", t, "--json", "--project", a2]).out); } catch { /* invalid JSON */ }
    return [tr, j && j.tracks];
  });
  ok(req.every(([tr, t]) => Array.isArray(t) && t.includes(tr)),
    "1.24 r6 F5: classify keeps the track of 'No personal data is sent…' (+privacy), 'Reject requests without a valid access token' and ES 'sin MFA no pueden acceder' (+sec) (got " + JSON.stringify(req) + ")");
};
