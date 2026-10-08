"use strict";
// Brazilian Portuguese (pt-BR) on the CLI — a fourth locale, derived from pt.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, require, __dirname }) => {
  const SD1 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const d1 = path.join(tmp, "pd1-proj");
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  const EU_ONLY = /(?<![\p{L}])(?:utilizador(?:es)?|ficheiros?|ecrãs?|equipas?|registos?|registar|registad[oa]s?|palavras?-passe|telemóve(?:l|is)|secç(?:ão|ões)|planead[oa]s?|artefactos?|tens|podes)(?![\p{L}])|(?<![\p{L}])a correr(?![\p{L}])|por defeito|por omissão/iu;
  const rmD1 = (p) => JSON.parse(fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8"));
  const initBr = run(["init", "tdd", "--lang", "pt_BR", "--project", d1]);
  const aliasBr = run(["init", "--lang", "PTBR", "--project", path.join(tmp, "pd1-alias")]);
  const aliasEu = run(["init", "--lang", "pt-PT", "--project", path.join(tmp, "pd1-eu")]);
  ok(initBr.code === 0 && /^Criado em .*\[pt-BR\]:/m.test(initBr.out) && rmD1(d1).meta.lang === "pt-BR" && aliasBr.code === 0 && rmD1(path.join(tmp, "pd1-alias")).meta.lang === "pt-BR" &&
    aliasEu.code === 0 && rmD1(path.join(tmp, "pd1-eu")).meta.lang === "pt",
    "init --lang pt_BR / PTBR → project language pt-BR (reported in pt-BR); --lang pt-PT stays European pt (got " + initBr.out.trim().split("\n")[0] + ")");
  const bad = run(["create", "Zed", "--lang", "pt-XX", "--project", d1]);
  // (full review Pb7: pt-BR says "tem que ser" — "tem de ser" is the European form)
  ok(bad.code === 1 && /--lang tem que ser um de: en, pt, es, pt-BR \(recebido: "pt-XX"\)/.test(bad.out) && !fs.existsSync(path.join(d1, ".specs", "zed")),
    "--lang pt-XX is refused (the message lists pt-BR, in the project's pt-BR) and nothing is written");
  const cr = run(["create", "Cadastro", "tdd", "--summary", "Cadastro com senha", "--project", d1]);
  const req = fs.readFileSync(path.join(d1, ".specs", "cadastro", "requirements.md"), "utf8");
  ok(cr.code === 0 && /^Feature 'cadastro' \[core \+tdd\] \(pt-BR\)/m.test(cr.out) && /## Histórias de Usuário/.test(req) && /## Fora do Escopo/.test(req) && !EU_ONLY.test(req),
    "create inherits pt-BR: Brazilian requirements (Histórias de Usuário, Fora do Escopo, no European-only word)");
  const doc = run(["doctor", "cadastro", "--project", d1]);
  const docJ = jsonOf(run(["doctor", "cadastro", "--json", "--project", d1]));
  ok(doc.code === 1 && /^Diagnóstico: cadastro {2}\[core \+tdd\] {2}veredicto=FALHA/m.test(doc.out) && /placeholders do template sem preencher na fase atual/.test(doc.out) && !EU_ONLY.test(doc.out) &&
    docJ && JSON.stringify(docJ) === JSON.stringify(SD1.specDoctor(d1, "cadastro")),
    "doctor speaks pt-BR ('Diagnóstico … veredicto=FALHA', 'sem preencher'); --json is spec_doctor's result (CLI = MCP)");
  const st = run(["status", "cadastro", "--project", d1]);
  const na = jsonOf(run(["next-action", "cadastro", "--json", "--project", d1]));
  ok(st.code === 0 && /^Feature: cadastro {2}\[core \+tdd\] {2}fase: requisitos/m.test(st.out) && /^Tarefas: 0\/\d+/m.test(st.out) && na && na.step === "fill" && !EU_ONLY.test(na.recommendation),
    "status / next-action in pt-BR (fase: requisitos, Tarefas); the recommendation carries no European-only word (got " + (na && na.recommendation) + ")");
  const eu = jsonOf(run(["create", "Faturas", "--lang", "pt-PT", "--json", "--project", d1]));
  const br = jsonOf(run(["create", "Relatorios", "core", "--lang", "Pt-Br", "--json", "--project", d1]));
  ok(eu && eu.lang === "pt" && /## Histórias de Utilizador/.test(fs.readFileSync(path.join(d1, ".specs", "faturas", "requirements.md"), "utf8")) && br && br.lang === "pt-BR",
    "a per-feature --lang pt-PT keeps European Portuguese inside a pt-BR project; --lang Pt-Br folds to pt-BR");
  const road = run(["roadmap", "--write", "--project", d1]);
  const md = fs.readFileSync(path.join(d1, ".specs", "ROADMAP.md"), "utf8");
  ok(road.code === 0 && /Legenda: ✅ feito · 🟡 em andamento · ⛔ bloqueada · 📋 planejada · ⬜ não iniciada/.test(md) && !/em curso|planeada|por começar/.test(md),
    "roadmap --write renders ROADMAP.md in pt-BR (em andamento · planejada · não iniciada)");
  const tpl = run(["templates", "init", "requirements", "--lang", "pt-br", "--project", d1]);
  const tplFile = path.join(d1, ".specs", "templates", "pt-BR", "requirements.md");
  ok(tpl.code === 0 && fs.existsSync(tplFile) && /## Histórias de Usuário/.test(fs.readFileSync(tplFile, "utf8")) && /1 template\(s\) de base copiado\(s\)/.test(tpl.out),
    "templates init requirements --lang pt-br → .specs/templates/pt-BR/requirements.md (Brazilian), reported in pt-BR (got " + tpl.out.trim().split("\n")[0] + ")");
  const clsBr = jsonOf(run(["classify", "Cadastro de usuários com senha, sem LLM", "--lang", "pt-BR", "--json"]));
  const clsGuess = jsonOf(run(["classify", "Cadastro do usuário: senha, arquivo e tela, com resumo no LLM", "--json"]));
  ok(clsBr && clsBr.lang === "pt-BR" && clsBr.tracks.join() === "core,tdd" && JSON.stringify(clsBr) === JSON.stringify(SD1.classify("Cadastro de usuários com senha, sem LLM", { lang: "pt-BR" })) &&
    clsGuess && clsGuess.lang === "pt" && clsGuess.tracks.join() === "core,tdd,ai",
    "classify --lang pt-BR answers in pt-BR (= spec_classify); Brazilian words alone guess 'pt' — 'no LLM' is em+o, +ai on");
  // 1.24 r6 H-I4: `classify --json` carries spec_classify's langHint — "pt-BR" for Brazilian wording read as pt; none for European wording
  // or an explicit --lang pt-BR
  const clsEu = jsonOf(run(["classify", "Registo do utilizador com palavra-passe e ficheiro no ecrã", "--json"]));
  ok(clsGuess && clsGuess.langHint === "pt-BR" && clsBr && !("langHint" in clsBr) && clsEu && clsEu.lang === "pt" && !("langHint" in clsEu) &&
    JSON.stringify(clsGuess) === JSON.stringify(SD1.classify("Cadastro do usuário: senha, arquivo e tela, com resumo no LLM")),
    "1.24 r6 H-I4: classify --json says langHint 'pt-BR' for Brazilian wording (lang stays 'pt' — = spec_classify); none for European wording or --lang pt-BR (got " +
    JSON.stringify([clsGuess && clsGuess.langHint, clsBr && clsBr.langHint, clsEu && clsEu.langHint]) + ")");
  // 1.24 r6 (integration): the human output says it too — one line naming --lang pt-BR; none for European wording
  const humanBr = run(["classify", "Cadastro do usuário: senha, arquivo e tela, com resumo no LLM"]);
  const humanEu = run(["classify", "Registo do utilizador com palavra-passe e ficheiro no ecrã"]);
  ok(humanBr.code === 0 && /^Idioma: redação em português do Brasil \(--lang pt-BR no create \/ init\)\.$/m.test(humanBr.out) &&
    humanEu.code === 0 && !/--lang pt-BR/.test(humanEu.out),
    "1.24 r6: classify's human output names --lang pt-BR when langHint says so (got " + JSON.stringify([humanBr.out.slice(-200), humanEu.out.slice(-120)]) + ")");
};
