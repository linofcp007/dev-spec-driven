"use strict";
// Languages — the derived pt-BR locale, localized output, section synonyms, the classifier's language guess.
// EN / PT / ES / pt-BR: toPtBr, scaffolds and messages per language, import and classify in the text's own language.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, rpc, payload, S, tmp, list, require }) => {

  // --- 1.14 D1: Brazilian Portuguese (pt-BR) — a fourth locale, DERIVED from European pt (i18n.js toPtBr) ---
  {
    const I = require("./lib/i18n.js");
    // European-only vocabulary a pt-BR string must never hold (the transform's job) — whole words, case-insensitive.
    // (1.24 r6 H-I5: + revisto / revista(s) / revistos — Brazil says revisado)
    const EU_ONLY = /(?<![\p{L}])(?:utilizador(?:es|as?)?|ficheiros?|ecrãs?|equipas?|registos?|registar|registad[oa]s?|palavras?-passe|telemóve(?:l|is)|secç(?:ão|ões)|factos?|contactos?|planead[oa]s?|planeamento|artefactos?|controlos?|revist[oa]s?|contigo|tens|podes|queres)(?![\p{L}])|(?<![\p{L}])(?:a correr|à espera)(?![\p{L}])|por defeito|por omissão/iu;
    // 1. language codes: aliases fold to pt-BR; pt / pt-PT stay European; the strict reader refuses the unknown
    ok(["pt-BR", "pt_BR", "pt-br", "ptbr", "PT-BR", " pt_br "].every((l) => S.normalizeLang(l) === "pt-BR" && S.canonicalLang(l) === "pt-BR") &&
      ["pt", "pt-PT", "pt_pt", "PT"].every((l) => S.normalizeLang(l) === "pt" && S.canonicalLang(l) === "pt") &&
      S.normalizeLang("es-MX") === "es" && S.normalizeLang("fr") === "en" && S.canonicalLang("fr") === null && S.canonicalLang("br") === null &&
      S.LANGS.join() === "en,pt,es,pt-BR" && I.baseLang("pt-BR") === "pt" && I.baseLang("pt") === "pt",
      "pD1: pt-BR / pt_BR / pt-br / ptbr → pt-BR; pt and pt-PT stay European; unknown: normalizeLang → en, canonicalLang → null");
    const langEnums = list.result.tools.filter((t) => t.inputSchema.properties && t.inputSchema.properties.lang).map((t) => (t.inputSchema.properties.lang.enum || []).join());
    ok(langEnums.length >= 7 && langEnums.every((e) => e === "en,pt,es,pt-BR"), "pD1: every MCP `lang` enum is en, pt, es, pt-BR (" + langEnums.length + " tools)");

    // 2. a pt-BR project end to end over MCP: init → create → Brazilian scaffold → filled → doctor → approve → done → roadmap
    const brDir = path.join(tmp, "proj-ptbr-d1");
    const brInit = payload(await rpc("tools/call", { name: "spec_init", arguments: { tracks: ["tdd"], lang: "pt_BR", projectDir: brDir } }));
    const brRm = () => JSON.parse(fs.readFileSync(path.join(brDir, ".specs", "roadmap.json"), "utf8"));
    const brSteer = fs.readdirSync(path.join(brDir, ".specs", "steering")).map((n) => fs.readFileSync(path.join(brDir, ".specs", "steering", n), "utf8"));
    ok(brInit.lang === "pt-BR" && brRm().meta.lang === "pt-BR" && /# Constituição/.test(brSteer.join("\n")) && /usuário/.test(brSteer.join("\n")) &&
      !brSteer.some((t) => EU_ONLY.test(t)),
      "pD1: spec_init lang 'pt_BR' (an alias the MCP enum folds) stores meta.lang 'pt-BR' and writes Brazilian steering (usuário, no utilizador/ficheiro)");
    const brFeat = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Cadastro de Usuários", tracks: ["tdd"], summary: "Cadastro com e-mail e senha", projectDir: brDir } }));
    const bf = path.join(brDir, ".specs", brFeat.slug);
    const brRead = (n) => fs.readFileSync(path.join(bf, n), "utf8");
    const brScaffold = fs.readdirSync(bf).filter((n) => n.endsWith(".md"));
    const brReq = brRead("requirements.md");
    ok(brFeat.ok && brFeat.lang === "pt-BR" && JSON.parse(brRead(".state.json")).lang === "pt-BR" && brScaffold.length >= 6 &&
      /## Histórias de Usuário/.test(brReq) && /## Fora do Escopo/.test(brReq) && /usuários completam/.test(brReq) &&
      /1\. \*\*US-1\.AC-1\*\* — QUANDO \[gatilho\] O SISTEMA DEVE \[comportamento\]/.test(brReq) && /\[NEEDS CLARIFICATION: que provedor\?\]/.test(brReq) &&
      /\(arquivos diferentes, sem deps\)/.test(brRead("tasks.md")) && /_Requirements: US-1\.AC-1_/.test(brRead("tasks.md")) && /\| T-01 \| unit \| example \|/.test(brRead("test-plan.md")) &&
      !brScaffold.some((n) => EU_ONLY.test(brRead(n))),
      "pD1: spec_create inherits pt-BR — Brazilian headings and vocabulary (Histórias de Usuário, Fora do Escopo, arquivos), stable IDs / EARS / markers, no European-only word in any artifact (" +
      brScaffold.filter((n) => EU_ONLY.test(brRead(n))).join(", ") + ")");
    const keepTag = (m) => /^\[(?:US\d+|P|shared|x| )\]$/.test(m) || /^\[NEEDS/.test(m);
    const fillBr = (t) => t.replace(/> \*\*TODO\*\*[^\n]*\n?/g, "").replace(/\[[^\]\n]*\]/g, (m) => (keepTag(m) ? m : "o usuário envia o formulário de cadastro"));
    for (const n of ["classification.md", "requirements.md", "design.md", "test-plan.md"]) fs.writeFileSync(path.join(bf, n), fillBr(brRead(n)));
    fs.writeFileSync(path.join(bf, "tasks.md"), ["# Tasks: Cadastro de Usuários", "", "## História US-1 (P1 — MVP)",
      "- [ ] 1. [US1] Validar o e-mail e a senha no cadastro", "  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3, US-1.AC-4_", "  - _Makes green: T-01, T-02, T-03, T-04_",
      "  - _Implements: src/cadastro.js_", "**Checkpoint:** o cadastro funciona sozinho.", "", "## História US-2 (P2)",
      "- [ ] 2. [US2] Confirmar o e-mail do usuário", "  - _Requirements: US-2.AC-1_", "  - _Makes green: T-05_", "  - _Implements: src/cadastro.js_", ""].join("\n"));
    fs.mkdirSync(path.join(brDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(brDir, "src", "cadastro.js"), "module.exports = {};\n");
    fs.mkdirSync(path.join(brDir, "tests", "unit"), { recursive: true });
    fs.writeFileSync(path.join(brDir, "tests", "unit", "cadastro.test.js"), ["T-01", "T-02", "T-03", "T-04", "T-05"].map((t) => `test("${t} cadastro", () => {});`).join("\n") + "\n");
    const brDoc = payload(await rpc("tools/call", { name: "spec_doctor", arguments: { name: brFeat.slug, projectDir: brDir } }));
    const brGate = brDoc.checks.find((c) => c.id === "approval-gates");
    ok(brDoc.verdict !== "fail" && brDoc.readyToAdvance === true && !brDoc.checks.some((c) => c.status === "fail") &&
      /^aguardando aprovação humana: .* — execute \/approve antes de avançar$/.test(brGate.detail) && !brDoc.checks.some((c) => EU_ONLY.test(String(c.detail))),
      "pD1: a filled pt-BR spec passes spec_doctor, its details in Brazilian Portuguese (got " + JSON.stringify(brDoc.checks.filter((c) => c.status !== "pass").map((c) => c.id + ": " + c.detail)) + ")");
    const brCl = payload(await rpc("tools/call", { name: "spec_clarify", arguments: { name: brFeat.slug, projectDir: brDir } }));
    ok(brCl.verdict === "clear", "pD1: spec_clarify reads the Brazilian headings (Fora do Escopo, Critérios de Sucesso…) — clear (got " + JSON.stringify(brCl.questions) + ")");
    const brAppr = [];
    for (const ph of ["classification", "requirements", "design", "test-plan", "tests", "tasks"]) brAppr.push(payload(await rpc("tools/call", { name: "spec_approve", arguments: { name: brFeat.slug, phase: ph, by: "ana", projectDir: brDir } })));
    const brDone = [];
    for (const n of [1, 2]) brDone.push(payload(await rpc("tools/call", { name: "spec_complete_task", arguments: { name: brFeat.slug, number: n, evidence: { summary: "verificado à mão no navegador" }, projectDir: brDir } })));
    const brNext = payload(await rpc("tools/call", { name: "spec_next_action", arguments: { name: brFeat.slug, projectDir: brDir } }));
    ok(brAppr.every((a) => a.ok && !a.forced) && brDone.every((d) => d.ok && d.verified) && brNext.step === "finish" &&
      /^Todas as tarefas feitas — feche a feature com \/spec-finish cadastro-de-usuarios/.test(brNext.recommendation),
      "pD1: every phase approves clean, both tasks tick, next_action says (in pt-BR) 'feche a feature' (got " + JSON.stringify([brAppr.map((a) => a.error || a.ok), brNext.recommendation]) + ")");
    const brRoad = payload(await rpc("tools/call", { name: "spec_roadmap", arguments: { write: true, html: true, projectDir: brDir } }));
    const brMd = fs.readFileSync(path.join(brDir, ".specs", "ROADMAP.md"), "utf8"), brHtml = fs.readFileSync(path.join(brDir, ".specs", "ROADMAP.html"), "utf8");
    ok(brRoad.ok !== false && /AUTO-GERADO por dev-spec/.test(brMd) && /Legenda: ✅ feito · 🟡 em andamento · ⛔ bloqueada · 📋 planejada · ⬜ não iniciada/.test(brMd) &&
      /Backlog \(planejadas, ainda sem spec\)/.test(brMd) && /Nada a sinalizar ✓/.test(brMd) && !/em curso|planeada|por começar|assinalar/.test(brMd) && /<html lang="pt-BR">/.test(brHtml),
      "pD1: ROADMAP.md / .html chrome in Brazilian Portuguese (em andamento, planejada, não iniciada; <html lang=\"pt-BR\">)");
    // per-feature override inside the pt-BR project: a European feature stays European; the MCP enum folds 'PT-pt' → pt
    const euFeat = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "Faturas", tracks: ["core"], lang: "PT-pt", projectDir: brDir } }));
    ok(euFeat.ok && euFeat.lang === "pt" && /## Histórias de Utilizador/.test(fs.readFileSync(path.join(brDir, ".specs", euFeat.slug, "requirements.md"), "utf8")),
      "pD1: a per-feature lang 'PT-pt' in a pt-BR project is European Portuguese (Histórias de Utilizador)");
    // every fresh pt-BR artifact (all tracks, and a bugfix) reads 'placeholder' — pt-BR's slots are known to the gates
    const brAll = S.createFeature(brDir, "Tudo Junto", ["tdd", "saas", "ai", "sec", "privacy"]);
    const brBug = S.createFeature(brDir, "Erro de Login", undefined, undefined, undefined, undefined, "bugfix");
    const brStates = [brAll, brBug].flatMap((x) => fs.readdirSync(x.dir).filter((n) => n.endsWith(".md") && n !== "checklist.md").map((n) => [n, S.artifactState(path.join(x.dir, n))]));
    ok(brAll.lang === "pt-BR" && brBug.lang === "pt-BR" && brStates.length >= 12 && brStates.every(([, st]) => st === "placeholder") &&
      /^placeholders do template sem preencher na fase atual/.test(S.specDoctor(brDir, brAll.slug).checks.find((c) => c.id === "placeholders").detail),
      "pD1: every fresh pt-BR scaffold artifact (all tracks + a bugfix) reads 'placeholder' — the gates know pt-BR's own slots (" + JSON.stringify(brStates.filter(([, st]) => st !== "placeholder")) + ")");
    const brTpl = payload(await rpc("tools/call", { name: "spec_templates", arguments: { action: "init", artifact: "requirements", lang: "pt-br", projectDir: brDir } }));
    const brTplFile = path.join(brDir, ".specs", "templates", "pt-BR", "requirements.md");
    ok(brTpl.ok !== false && fs.existsSync(brTplFile) && /## Histórias de Usuário/.test(fs.readFileSync(brTplFile, "utf8")),
      "pD1: spec_templates init --lang pt-br copies Brazilian templates into .specs/templates/pt-BR/");

    // 3. every pt-BR string (messages, brief, steering, evals README, all artifact builders — each function called with
    // probe arguments): no European-only word, English-stable tokens identical to pt's, idempotent, same key tree as pt
    const probes = [["ARGA", "ARGB", "ARGC", "ARGD"], [2, 3, 4, 5], [["ARGA", "ARGB"], ["ARGC"], ["ARGD"], ["ARGE"]], [true, "ARGB", "ARGC", "ARGD"], [false, false, false, false]];
    const brPairs = [];
    const walk = (a, b, where, depth) => {
      if (depth > 8) return;
      if (typeof a === "string") return void brPairs.push([where, a, b]);
      if (Array.isArray(a)) return void a.forEach((x, k) => walk(x, Array.isArray(b) ? b[k] : undefined, where + "[" + k + "]", depth + 1));
      if (typeof a === "function") {
        return void probes.forEach((p, k) => { let ra; try { ra = a(...p); } catch { return; } let rb; try { rb = b(...p); } catch (e) { rb = "THROW " + e.message; } walk(ra, rb, where + "()" + k, depth + 1); });
      }
      if (a && typeof a === "object" && !(a instanceof RegExp)) for (const k of Object.keys(a)) walk(a[k], b ? b[k] : undefined, where + "." + k, depth + 1);
    };
    walk(I.msg("pt"), I.msg("pt-BR"), "MSG", 0);
    walk(I.brief("pt"), I.brief("pt-BR"), "BRIEF", 0);
    for (const n of I.steeringKnownFiles()) brPairs.push(["STEERING." + n, I.steeringStub(n, "pt"), I.steeringStub(n, "pt-BR")]);
    brPairs.push(["EVALS_README", I.evalsReadme("pt"), I.evalsReadme("pt-BR")]);
    // every built-in track (1.25.1 review: the five of 1.14 left +dist / +api / +ui / +obs / +data's builders unlinted), and size s
    const allTr = ["tdd", "saas", "ai", "sec", "privacy", "dist", "api", "ui", "obs", "data"];
    for (const size of [undefined, "s"]) for (const t of [[], ...allTr.map((x) => [x]), allTr]) {
      const a = { name: "ARGN", tracks: ["core", ...t], label: ["core", ...t].join(" +"), slug: "argn", summary: "", size, signals: { tdd: ["tdd"], saas: ["tenant"], ai: ["llm"], sec: ["owasp"], privacy: ["gdpr"] } };
      const at = "/" + t.join("+") + (size ? "/" + size : "");
      for (const b of ["classification", "requirements", "design", "tasks", "checklist"]) brPairs.push(["BUILD." + b + at, I[b](a, "pt"), I[b](a, "pt-BR")]);
      brPairs.push(["BUILD.testPlan" + at, I.testPlan("ARGN", "pt", a.tracks, undefined, size), I.testPlan("ARGN", "pt-BR", a.tracks, undefined, size)]);
    }
    for (const b of ["evalPlan", "loadTest", "quickstart", "integrationPlan", "promptStub", "bugTestPlan", "bugTasks"]) brPairs.push(["BUILD." + b, I[b]("ARGN", "pt"), I[b]("ARGN", "pt-BR")]);
    brPairs.push(["BUILD.bugReport", I.bugReport({ name: "ARGN" }, "pt"), I.bugReport({ name: "ARGN" }, "pt-BR")], ["BUILD.bugRequirements", I.bugRequirements({ name: "ARGN" }, "pt"), I.bugRequirements({ name: "ARGN" }, "pt-BR")]);
    const euLeft = brPairs.filter(([, , b]) => typeof b !== "string" || EU_ONLY.test(b)).map(([w, , b]) => w + ": " + (typeof b === "string" ? (b.match(EU_ONLY) || [])[0] : typeof b));
    ok(brPairs.length > 1500 && euLeft.length === 0,
      "pD1: lint — no pt-BR string holds a European-only word (utilizador, ficheiro, ecrã, equipa, registo, palavra-passe, telemóvel, 'a correr', tens, podes…): " + brPairs.length + " strings (" + euLeft.slice(0, 6).join(" · ") + ")");
    // (1.25.1 review: every track's marker — read from the engine's TRACK_MARKER; the list stopped at [PRIVACY] — and the
    // _Depends:_, decision-log and spike markers)
    const markerAlt = Object.values(S.TRACK_MARKER).map((m) => m.replace(/[[\]]/g, "\\$&")).join("|");
    const STABLE = new RegExp(String.raw`US-\d+\.AC-\d+|SC-\d{3}|T-\d+|EC-\d+|NFR-\d+|` + markerAlt + String.raw`|\[(?:US\d+|P|shared)\]|\[NEEDS CLARIFICATION|> \*\*TODO\*\*|\*\*Checkpoint:\*\*|` +
      String.raw`_(?:Requirements|Makes green|Affects evals|Emits metrics|Implements|Verify|Supersedes|Expect|Size|Depends|Kind|Date|Affects|Outcome):|` +
      "```(?:mermaid|typescript)|## System|## User Template|`[^`\\n]+`|" + String.raw`\/spec-[a-z-]+|\b(?:QUANDO|ENQUANTO|ENTÃO|O SISTEMA(?: NÃO)? DEVE)\b`, "g");
    const stableLost = brPairs.filter(([, a, b]) => typeof b === "string" && (a.match(STABLE) || []).join("\n") !== (b.match(STABLE) || []).join("\n")).map(([w]) => w);
    ok(stableLost.length === 0, "pD1: English-stable tokens survive unchanged in every pt-BR string — IDs, [SaaS]/[AI] tags, [NEEDS CLARIFICATION], > **TODO**, **Checkpoint:**, _Marker:_ tags, code spans, /spec-* commands, EARS keywords (" + stableLost.slice(0, 5).join(", ") + ")");
    const notIdem = brPairs.filter(([, , b]) => typeof b === "string" && I.toPtBr(b) !== b).map(([w]) => w);
    ok(notIdem.length === 0, "pD1: the pt-BR transform is idempotent — a Brazilian string passes through unchanged (" + notIdem.slice(0, 5).join(", ") + ")");
    // (an array compares by its first element's kind: pt-BR's stop-gate pattern lists are pt's plus the Brazilian gerunds)
    const shape = (v, d = 0) => (d > 6 ? "…" : typeof v === "function" ? "fn" : Array.isArray(v) ? "[" + (v.length ? shape(v[0], d + 1) : "") + "]" : v && typeof v === "object" && !(v instanceof RegExp) ? "{" + Object.keys(v).map((k) => k + ":" + shape(v[k], d + 1)).join(",") + "}" : typeof v);
    ok(shape(I.msg("pt")) === shape(I.msg("pt-BR")) && shape(I.brief("pt")) === shape(I.brief("pt-BR")) &&
      I.steeringKnownFiles().every((n) => typeof I.steeringStub(n, "pt-BR") === "string") && I.msg("pt") !== I.msg("pt-BR"),
      "pD1: key parity — pt-BR's message and brief tables have exactly pt's key tree (same keys, same value kinds)");
    // pt (European) is untouched: the derivation never writes back into the source tables
    ok(/## Histórias de Utilizador/.test(I.requirements({ name: "x", tracks: ["core"], label: "core" }, "pt")) && /Fora de Âmbito/.test(I.requirements({ name: "x", tracks: ["core"], label: "core" }, "pt")) &&
      I.msg("pt").addTrackNote("saas", "f") === "+saas adicionado. Preenche as novas secções de design e volta a correr /spec-doctor f." &&
      I.msg("pt-BR").addTrackNote("saas", "f") === "+saas adicionado. Preencha as novas seções de design e volte a executar /spec-doctor f." &&
      I.msg("pt").stopGate.claims.length === I.msg("pt-BR").stopGate.claims.length - 3,
      "pD1: pt stays European Portuguese (Histórias de Utilizador, 'Preenche … volta a correr'), pt-BR is its Brazilian twin ('Preencha … volte a executar')");
    // the caller's own strings (feature names, paths) are never transformed; a track name never masks part of a word
    ok(I.msg("pt-BR").addTrackNote("sec", "registo-de-utilizadores") === "+sec adicionado. Preencha as novas seções de design e volte a executar /spec-doctor registo-de-utilizadores." &&
      I.msg("pt-BR").addTrackNote("ai", "tu").endsWith("/spec-doctor tu.") &&
      I.msg("pt-BR").spike.doctor.timeboxPassed("2026-09-01").startsWith("o timebox terminou em 2026-09-01 e não há decisão registrada — decida com a evidência que você tem") &&
      I.toPtBr("O utilizador guarda o ficheiro `src/ficheiro.js` em .specs/utilizador/ — corre `npm test` e regista o resultado.") ===
      "O usuário guarda o arquivo `src/ficheiro.js` em .specs/utilizador/ — execute `npm test` e registre o resultado.",
      "pD1: arguments, code spans and paths are kept verbatim; mid-sentence 3rd person vs clause-start imperative (corre → execute, regista → registre)");
    // 1.25.1 review — the clause detector skips EVERY track tag before a task's text (the built-in list stopped at [PRIVACY]:
    // "[API] Escreve … corre-os" kept its European imperative) and a track pack's (an upper-case token, engine/packs.js)
    const tagged = (m) => I.toPtBr("- [ ] 3. " + m + " Escreve os testes e corre-os");
    ok([...Object.values(S.TRACK_MARKER), "[KAFKA]"].every((m) => tagged(m) === "- [ ] 3. " + m + " Escreva os testes e execute-os") &&
      I.toPtBr("- [ ] 4. [US1][P] [DATA] Corre a migração") === "- [ ] 4. [US1][P] [DATA] Execute a migração",
      "1.25.1 review: pt-BR turns the imperative after every track tag — [SaaS] … [DATA] (the engine's TRACK_MARKER) and a pack's [KAFKA] (got " + JSON.stringify(tagged("[API]")) + ")");
    // … a 3rd-person description at a clause start stays one ("— começa por _ ou *": the command starts with); European residue
    // (a link is no "ligação", enclisis after a subject, the interrogative "porque") goes through the derivation's tables
    const brM = I.msg("pt-BR"), sv = brM.markerSyntax.suspiciousVerify("x");
    const spikeBr = brM.spike.report({ name: "s" }) + brM.spike.tasks("s") + brM.spike.next.investigate(1, "t", "s");
    ok(sv.includes("— começa por _ ou *") && !sv.includes("comece por") && sv.includes("fica mais legível como $(") &&
      brM.impact.reopenTasks === "reopen se aplica a requirements, design, test-plan e eval-plan — uma alteração no tasks.md é revisada e aprovada de novo; não reabre nada." &&
      brM.sizes.sizeKept("m", "s").endsWith("o tamanho é escolhido uma vez, ao criar a feature.") &&
      /— crie uma de tamanho s \(.*\) e arquive esta alteração \(/.test(brM.sizes.tracksIgnored("+sec", "x")) &&
      /é um link simbólico ou aponta/.test(brM.err.specsLinkedFile("a")) && /apaga só o link — .*remover o link\.$/.test(brM.featureOps.removeNeedsConfirmLink("x")) &&
      !/liga-o|ligue-o/.test(spikeBr) && /coloque o link em Evidência/.test(spikeBr) && /no-go: por que foi abandonado/.test(spikeBr) &&
      /<por que não se aplica>/.test(brM.sizes.extendedComment("[SEC]", "a")) && /, ou responda em uma linha/.test(brM.sizes.extendedComment("[SEC]", "a")) &&
      /nunca tire um que o _Verify:_ tenha.*coloque-a de lado.*depois restaure-a\)\.$/.test(brM.evidenceGate.commandMismatch(1, "f", "x", "y", true)),
      "1.25.1 review: pt-BR — 'começa por' stays a description; a link is 'link' (never 'ligação' / 'liga-o'); enclisis after a subject → proclisis, the passive or " +
      "the você imperative; 'por que' asks why (got " + JSON.stringify([sv.slice(40, 90), brM.impact.reopenTasks]) + ")");
    const EU_RESIDUE = /(?<![\p{L}])(?:ligaç(?:ão|ões)|liga-[oa]s?|ligue-[oa]s?|\p{L}+-se-ia|(?:cria|aplica|aplicam|arquiva|escolhe|revê|regista|registra|escrevem|parecem|comporta|torna|importa|acrescenta|responde)-se|tires|porque foi)(?![\p{L}])/iu;
    const residueLeft = brPairs.filter(([, , b]) => typeof b === "string" && EU_RESIDUE.test(b)).map(([w, , b]) => w + ": " + b.match(EU_RESIDUE)[0]);
    ok(residueLeft.length === 0, "1.25.1 review: lint — no pt-BR string keeps a European 'ligação' / 'liga-o', an enclitic '-se' after its subject or 'porque' asking why (" + residueLeft.slice(0, 6).join(" · ") + ")");
    // 1.25.1 review — template variables ({{…}}) are English-stable: the PT prompt stub wrote {{variáveis}}. Every artifact
    // builder (every track) and steering stub names the same variables, in the same order, in each language.
    const varsOf = (s) => (String(s).match(/\{\{[^{}\n]*\}\}/g) || []).join(" ");
    const varText = (l) => [...["classification", "requirements", "design", "tasks", "checklist"].map((b) => I[b]({ name: "n", tracks: ["core", ...allTr], label: "core", slug: "n", summary: "", signals: {} }, l)),
      ...["evalPlan", "loadTest", "quickstart", "integrationPlan", "promptStub", "bugTestPlan", "bugTasks"].map((b) => I[b]("n", l)), I.testPlan("n", l, ["core", ...allTr]),
      ...I.steeringKnownFiles().map((n) => I.steeringStub(n, l))].map(varsOf);
    const enVars = varText("en");
    ok(enVars.join(" ").includes("{{variables}}") && ["pt", "es", "pt-BR"].every((l) => JSON.stringify(varText(l)) === JSON.stringify(enVars)),
      "1.25.1 review: {{template variables}} are English-stable — every builder and steering stub names the same ones in PT / ES / pt-BR as in EN (got pt " + JSON.stringify(varsOf(I.promptStub("n", "pt"))) + ")");

    // 4. the classifier: Brazilian words still read as Portuguese ('no' = em+o, never a negator); an explicit pt-BR answers in pt-BR
    // (only Brazilian markers here — cadastro, usuário, senha, arquivo, tela: before D1 this read as English and "no LLM" negated +ai)
    const brGuess = S.classify("Cadastro do usuário: senha, arquivo e tela, com resumo no LLM");
    const brExplicit = S.classify("Cadastro de usuários com senha, sem LLM", { lang: "pt-BR" });
    ok(brGuess.lang === "pt" && brGuess.tracks.includes("tdd") && brGuess.tracks.includes("ai") && brExplicit.lang === "pt-BR" && brExplicit.tracks.includes("tdd") && !brExplicit.tracks.includes("ai") &&
      brExplicit.notes.every((n) => !EU_ONLY.test(n)) &&
      S.classify("Isolamento multilocatário com LGPD e relatório para a ANPD").tracks.join() === "core,saas,privacy",
      "pD1: classify — Brazilian text guesses 'pt' (senha → +tdd), explicit lang pt-BR is kept, 'sem LLM' negated; multilocatário → +saas, LGPD / ANPD → +privacy (got " +
      JSON.stringify([brGuess.lang, brGuess.tracks, brExplicit.lang, brExplicit.tracks]) + ")");
    const brEars = S.earsValidate("1. **US-1.AC-1** — QUANDO o usuário envia o cadastro, O SISTEMA DEVE responder de forma confiável e performática.", "pt-BR");
    ok(brEars.verdict === "pass" && brEars.issues.map((i) => i.code).join() === "vague,vague" &&
      brEars.issues.every((i) => /^Termo vago '(?:confiável|performática)' — substitua-o por um valor concreto e testável\.$/.test(i.msg)),
      "pD1: ears_validate in pt-BR — the same EARS keywords pass; Brazilian vague words (confiável, performática) are flagged in a Brazilian message");
    // 5. the stop gate reads Brazilian claims and admissions (pt-BR adds its gerund forms to pt's patterns)
    const sgClaim = S.stopClaims("Pronto: os testes estão passando e tudo funcionando.");
    const sgAdmit = S.stopClaims("Implementei a tarefa 2, mas 3 testes falhando ainda.");
    ok(sgClaim.claim === true && sgAdmit.admitted === true, "pD1: stop gate — 'os testes estão passando' is a claim, '3 testes falhando' an admission (got " + JSON.stringify([sgClaim, sgAdmit]) + ")");
  }

  // 1.14 full review (Pb) — import, classifier, section synonyms, i18n / pt-BR.
  {
    const I = require("./lib/i18n.js");
    const put = (root, rel, text) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
    const rd = (dir, f) => fs.readFileSync(path.join(dir, f), "utf8");
    const secStatus = (pd, slug, id) => (S.specDoctor(pd, slug).checks.find((c) => c.id === id) || {}).status;
    const fillTodo = (text) => text.replace(/^> \*\*TODO\*\*.*$/gm, "Written by the team.");
    // Pb1: a Kiro spec written in Portuguese / Spanish — "### Requisito N", "## Introdução" / "## Introducción" and the
    // QUANDO … ENTÃO / CUANDO … ENTONCES criteria are read like the English ones.
    const kiro = {
      pt: ["# Documento de Requisitos\n\n## Introdução\n\nEsta funcionalidade permite repor a palavra-passe por email.\n\n## Requisitos\n\n### Requisito 1\n\n" +
        "**História de Utilizador:** Como utilizador registado, quero repor a minha palavra-passe, para que possa voltar a aceder à conta.\n\n#### Critérios de Aceitação\n\n" +
        "1. QUANDO o utilizador pede a reposição ENTÃO o sistema DEVE enviar um email com uma ligação única\n2. SE a ligação tiver mais de 30 minutos ENTÃO o sistema DEVE rejeitá-la\n" +
        "3. QUANDO o token expira ENTÃO o sistema rejeita o pedido\n", /## Resumo\nEsta funcionalidade permite repor a palavra-passe por email\./,
      /\*\*US-1\.AC-3\*\* — QUANDO o token expira, O SISTEMA DEVE garantir que o sistema rejeita o pedido/, "Repor a minha palavra-passe"],
      es: ["# Documento de Requisitos\n\n## Introducción\n\nPermite restablecer la contraseña por correo.\n\n## Requisitos\n\n### Requisito 1\n\n" +
        "**Historia de Usuario:** Como usuario, quiero restablecer mi contraseña, para poder acceder de nuevo.\n\n#### Criterios de Aceptación\n\n" +
        "1. CUANDO el usuario solicita el restablecimiento ENTONCES el sistema DEBE enviar un correo con un enlace único\n2. SI el enlace tiene más de 30 minutos ENTONCES el sistema DEBE rechazarlo\n" +
        "3. CUANDO el token caduca ENTONCES el sistema rechaza la solicitud\n", /## Resumen\nPermite restablecer la contraseña por correo\./,
      /\*\*US-1\.AC-3\*\* — CUANDO el token caduca, EL SISTEMA DEBE garantizar que el sistema rechaza la solicitud/, "Restablecer mi contraseña"],
    };
    for (const [lng, [req, summaryRe, rewrittenRe, title]] of Object.entries(kiro)) {
      const kp = path.join(tmp, "proj-full-review-pb1-" + lng);
      S.initProject(kp, ["core"], lng);
      put(kp, ".kiro/specs/reset/requirements.md", req);
      put(kp, ".kiro/specs/reset/tasks.md", "# Plano\n\n- [ ] 1. Criar o modelo de token\n  - _Requirements: 1.1, 1.2, 1.3_\n");
      const k = S.importSpec(kp, "kiro", ".kiro/specs/reset", {});
      const kReq = k.ok ? rd(k.dir, "requirements.md") : "", kTasks = k.ok ? rd(k.dir, "tasks.md") : "";
      const kEars = S.earsValidate(kReq, lng);
      ok(k.ok && k.mapping["Requisito 1"] === "US-1" && k.mapping["1.3"] === "US-1.AC-3" && k.warnings.length === 1 && summaryRe.test(kReq) &&
        kReq.includes("### US-1: " + title) && rewrittenRe.test(kReq) && /_Requirements: US-1\.AC-1, US-1\.AC-2, US-1\.AC-3_/.test(kTasks) && kEars.verdict === "pass",
        "full review Pb1: a " + lng.toUpperCase() + " Kiro spec imports its story (Requisito 1 → US-1, its 3 criteria), the introduction as the summary, a QUANDO/CUANDO … ENTÃO/ENTONCES " +
        "criterion without a modal rewritten in its language, tasks' _Requirements: 1.x_ resolved (got " + JSON.stringify([k.error, k.mapping, k.warnings, kEars.verdict]) + ")");
    }

    // Pb2: spec_create / spec_import classify a new feature in the project's configured language — "no checkout" is PT em+o.
    const p2 = path.join(tmp, "proj-full-review-pb2");
    S.initProject(p2, ["core"], "pt");
    const c2 = payload(await rpc("tools/call", { name: "spec_create", arguments: { name: "IVA", summary: "Corrigir o cálculo do IVA no checkout", projectDir: p2 } }));
    const c2b = S.createFeature(p2, "IVA B", undefined, "Corrigir o cálculo do IVA no checkout");
    put(p2, "plans/iva.md", "# Corrigir o cálculo do IVA no checkout\n\n## Passos\n\n1. Corrigir `src/iva.js`\n");
    const i2 = S.importSpec(p2, "plan", "plans/iva.md", {});
    // an English source in the PT project is still read as English: "no LLM" is a negation there
    put(p2, "plans/export.md", "# Export the report\n\nThe export has no LLM and it writes the report to the file for the user.\n\n## Steps\n\n1. Write the export in `src/export.js`\n");
    const i2en = S.importSpec(p2, "plan", "plans/export.md", {});
    ok(c2.ok && c2.tracks.join() === "core,tdd" && c2b.tracks.join() === "core,tdd" && i2.ok && i2.tracks.includes("tdd") && i2en.ok && !i2en.tracks.includes("ai"),
      "full review Pb2: in a meta.lang pt project spec_create (MCP and engine) and spec_import read 'no checkout' as em+o (+tdd on); an English plan imported there keeps 'no LLM' negated (got " +
      JSON.stringify([c2.tracks, c2b.tracks, i2.tracks, i2en.tracks]) + ")");

    // Pb3: a plan's "## Approach" beside a "## Steps" section is design prose — its "### Files to modify" is no task list.
    const p3 = path.join(tmp, "proj-full-review-pb3");
    S.initProject(p3, ["core"], "en");
    put(p3, "plans/rate-limit.md", "# Add rate limiting to the public API\n\n## Context\n\nOne client took the API down last week.\n\n## Approach\n\n" +
      "Use a token bucket in Redis, keyed by API key.\n\n### Files to modify\n\n- `src/middleware/rateLimit.ts` — new middleware\n- `src/server.ts` — register it\n\n" +
      "## Steps\n\n1. **Create the middleware** in `src/middleware/rateLimit.ts`\n2. **Register** it in `src/server.ts`\n3. **Add tests** in `test/rateLimit.test.ts`\n");
    const i3 = S.importSpec(p3, "plan", "plans/rate-limit.md", {});
    const t3 = i3.ok ? S.parseTasks(rd(i3.dir, "tasks.md")) : [];
    put(p3, "plans/only-approach.md", "# Dark mode\n\n## Approach\n\n1. Add a theme store in `src/theme.ts`\n2. Wire the toggle in `src/header.tsx`\n");
    const i3b = S.importSpec(p3, "plan", "plans/only-approach.md", {});
    ok(i3.ok && t3.length === 3 && /### Files to modify\n\n- `src\/middleware\/rateLimit\.ts` — new middleware/.test(rd(i3.dir, "design.md")) &&
      i3b.ok && S.parseTasks(rd(i3b.dir, "tasks.md")).length === 2,
      "full review Pb3: an Approach section beside Steps stays in design.md (3 tasks from the 3 steps, not 5); a plan with only an Approach still takes its items as tasks (got " +
      JSON.stringify([t3.map((t) => t.text), i3b.ok && S.parseTasks(rd(i3b.dir, "tasks.md")).length]) + ")");

    // Pb4: track-section headings — an inflected name, an emoji before / after the marker, the pt-BR vocabulary.
    const p4 = path.join(tmp, "proj-full-review-pb4");
    S.initProject(p4, ["core"], "en");
    const f4 = S.createFeature(p4, "Vault", ["sec"], "x", undefined, "en");
    const d4 = fillTodo(rd(f4.dir, "design.md"));
    const heads4 = ["## [SEC] Threat Modeling", "## [SEC] Threat Models", "## 🔐 [SEC] Threat Model", "## [SEC] 🛡️ Threat Modelling"].map((h) => {
      fs.writeFileSync(path.join(f4.dir, "design.md"), d4.replace(/^## \[SEC\] Threat Model.*$/m, h));
      return [h, secStatus(p4, f4.slug, "sec-sections")];
    });
    const b4 = path.join(tmp, "proj-full-review-pb4-br");
    S.initProject(b4, ["core"], "pt-BR");
    const g4 = S.createFeature(b4, "Cobranca", ["saas", "sec", "privacy"], "Cobrança por locatário");
    const gd = fillTodo(rd(g4.dir, "design.md"))
      .replace(/^## \[SaaS\] Modelo Multi.*$/m, "## [SaaS] Modelo Multilocatário").replace(/^## \[SEC\] Gest.*Segredos.*$/m, "## [SEC] Gerenciamento de Segredos e Chaves")
      .replace(/^## \[PRIVACY\] (?:Subcontratantes|Operadores).*$/m, "## [PRIVACY] Operadores e Transferências Internacionais")
      .replace(/^## \[PRIVACY\] (?:AIPD|RIPD).*$/m, "## [PRIVACY] RIPD — Relatório de Impacto à Proteção de Dados");
    fs.writeFileSync(path.join(g4.dir, "design.md"), gd);
    const br4 = ["saas-sections", "sec-sections", "privacy-sections"].map((id) => secStatus(b4, g4.slug, id));
    // "operadores" alone is an ordinary word: a core "## Operadores de fila" never stands in for a deleted [PRIVACY] section
    fs.writeFileSync(path.join(g4.dir, "design.md"), gd.replace(/^## \[PRIVACY\] Operadores e Transferências Internacionais$/m, "## Operadores de fila"));
    const loose4 = secStatus(b4, g4.slug, "privacy-sections");
    ok(heads4.every(([, st]) => st === "pass") && br4.every((st) => st === "pass") && loose4 !== "pass",
      "full review Pb4: '[SEC] Threat Modeling / Models / Modelling' and an emoji beside the marker name the Threat Model; pt-BR Multilocatário, Gerenciamento de Segredos, " +
      "Operadores e Transferências Internacionais, RIPD pass doctor; a core 'Operadores de fila' heading does not (got " + JSON.stringify([heads4, br4, loose4]) + ")");

    // Pb5: the encryption verbs in PT / ES and at rest / in transit (corroborating only).
    const sig = (t) => { const c = S.classify(t); return [c.tracks.includes("sec"), c.signals.sec]; };
    const on5 = ["Encriptar os dados dos cartões em repouso", "Encrypt customer PII at rest and in transit", "Os dados são criptografados em repouso e em trânsito", "Los datos se cifran en reposo"].map(sig);
    // one verb is one signal, whatever its forms (as encrypt / encryption): a lone verb is only "possible"
    // (review 5: "contraseña" is a +sec word of its own now — "Cifrar las contraseñas" is two signals, +sec on; the lone verb is "las facturas")
    const weak5 = ["Criptografar os backups", "Cifrar las facturas", "O sistema encripta os backups", "Encriptar os dados e guardar os dados encriptados"].map(sig);
    const none5 = ["As cifras do trimestre sobem", "O paciente fica em repouso", "Packages in transit are tracked"].map(sig);
    ok(on5.every(([on]) => on) && weak5.every(([on, s]) => !on && s.length === 1) && none5.every(([on, s]) => !on && !s.length),
      "full review Pb5: encriptar / criptografar / cifrar are +sec signals, 'at rest' / 'in transit' (EN/PT/ES) corroborate them; 'cifras' (figures), a patient at rest, parcels in transit are none (got " +
      JSON.stringify([on5, weak5, none5]) + ")");

    // Pb6: linear scans — a long run of '[' / ')' / word characters (the old patterns took seconds at 80 000 characters).
    const timed = (f) => { const t0 = Date.now(); f(); return Date.now() - t0; };
    const n6 = 80000;
    const t6 = [timed(() => S.planPaths("[".repeat(n6))), timed(() => S.planPaths(")".repeat(n6) + "a/b.ts")), timed(() => S.planPaths("[](a".repeat(n6 / 4))),
      timed(() => S.markdownToHtml("[".repeat(n6))), timed(() => S.markdownToHtml("![".repeat(n6 / 2))), timed(() => I.toPtBr("a".repeat(n6))), timed(() => I.toPtBr("ab.".repeat(n6 / 3)))];
    ok(t6.every((ms) => ms < 1000) && JSON.stringify(S.planPaths("see [the store](src/theme.ts) and [[x](lib/y.js)")) === '["src/theme.ts","lib/y.js"]' &&
      I.toPtBr("O utilizador guarda o ficheiro tasks.md e src/a.test.js.") === "O usuário guarda o arquivo tasks.md e src/a.test.js." &&
      S.markdownToHtml("[[see](https://x.io)") === '<p>[<a href="https://x.io" rel="noopener noreferrer">see</a></p>',
      "full review Pb6: planPaths / markdownToHtml / toPtBr stay linear on 80 000 '[' / ')' / letters (each < 1 s), links and file names still read (got " + JSON.stringify(t6) + " ms)");

    // Pb7: pt-BR — ter que, proclisis, acessá-lo, the LGPD headings (still matched by the section synonyms); pt unchanged.
    const brM = I.msg("pt-BR"), all5 = { name: "X", tracks: ["core", "tdd", "saas", "ai", "sec", "privacy"], label: "x", summary: "" };
    const brDesign = I.design(all5, "pt-BR"), ptDesign = I.design(all5, "pt");
    const txt7 = [brM.evidence.badExit("x"), brM.appendTasks.badPath(1, "x"), brM.appendTasks.placeholderVerify(1, "x"), I.brief("pt-BR").evalsRule, brDesign].join("\n");
    ok(/tem que ser um inteiro/.test(txt7) && /têm que ser relativos/.test(txt7) && /'x' é lido como um marcador/.test(txt7) && /o golden se mantém ou melhora, o adversarial se mantém/.test(txt7) &&
      /quem pode acessá-lo\./.test(brDesign) && /## \[SaaS\] Modelo Multilocatário/.test(brDesign) && /## \[PRIVACY\] Retenção e Eliminação/.test(brDesign) &&
      /## \[PRIVACY\] Operadores e Transferências Internacionais/.test(brDesign) && /## \[PRIVACY\] RIPD \(quando obrigatório — LGPD art\. 38\)/.test(brDesign) &&
      !/tem de|têm de|lê-se|mantém-se|lhe pode|Subcontratantes|AIPD|Multi-inquilino|Conservação e Eliminação/.test(txt7) &&
      /## \[SaaS\] Modelo Multi-inquilino/.test(ptDesign) && /## \[PRIVACY\] AIPD \(quando obrigatória — art\. 35\.º\)/.test(ptDesign) &&
      /`feat\(módulo\): … — tarefa #N`/.test(I.brief("pt-BR").loopRules.core[2]) &&
      /`feat\(módulo\): … — tarefa #N`/.test(I.brief("pt").loopRules.core[2]),
      "full review Pb7: pt-BR says 'tem que ser', 'é lido como', 'se mantém', 'quem pode acessá-lo', Modelo Multilocatário, Retenção e Eliminação, Operadores, RIPD (LGPD art. 38); " +
      "pt keeps Multi-inquilino / AIPD; the commit example `feat(módulo)` is the same code span in both (got " + JSON.stringify(txt7.match(/.{0,30}(?:tem de|têm de|lê-se|mantém-se|lhe pode|Subcontratantes|AIPD|Multi-inquilino).{0,30}/g)) + ")");
    const b7 = S.createFeature(b4, "Tudo BR", ["saas", "sec", "privacy"], "x");
    fs.writeFileSync(path.join(b7.dir, "design.md"), fillTodo(rd(b7.dir, "design.md")));
    const br7 = ["saas-sections", "sec-sections", "privacy-sections"].map((id) => secStatus(b4, b7.slug, id));
    ok(br7.every((st) => st === "pass"), "full review Pb7: a filled pt-BR scaffold with the Brazilian headings passes doctor's section checks (got " + JSON.stringify(br7) + ")");

    // Pb8: a pt-BR feature falls back to .specs/templates/pt/ (then templates/, then the built-in); pt-BR/ wins over pt/.
    const p8 = path.join(tmp, "proj-full-review-pb8");
    S.initProject(p8, ["core"], "pt-BR");
    put(p8, ".specs/templates/pt/quickstart.md", "# Arranque rápido PT: {{name}}\n\n[passos]\n");
    put(p8, ".specs/templates/quickstart.md", "# Root quickstart: {{name}}\n\n[steps]\n");
    put(p8, ".specs/templates/pt/checklist.md", "# Checklist PT: {{name}}\n\n- [ ] [item]\n");
    put(p8, ".specs/templates/pt-BR/checklist.md", "# Checklist BR: {{name}}\n\n- [ ] [item]\n");
    const f8 = S.createFeature(p8, "Alfa", ["core"], "x");
    const l8 = S.templates(p8, "list", { artifact: "quickstart" });
    const e8 = S.createFeature(p8, "Beta", ["core"], "x", undefined, "en");
    ok(f8.lang === "pt-BR" && /^# Arranque rápido PT: Alfa/.test(rd(f8.dir, "quickstart.md")) && /^# Checklist BR: Alfa/.test(rd(f8.dir, "checklist.md")) &&
      f8.templates && f8.templates["quickstart.md"] === ".specs/templates/pt/quickstart.md" && l8.templates[0].override === ".specs/templates/pt/quickstart.md" &&
      /^# Root quickstart: Beta/.test(rd(e8.dir, "quickstart.md")),
      "full review Pb8: a pt-BR feature reads templates/pt-BR/ → templates/pt/ → templates/ (an English one skips pt/); spec_templates list names the same file (got " +
      JSON.stringify([f8.templates, l8.templates && l8.templates[0].override, e8.templates]) + ")");
  }

  { // 1.21 F3 — a CLI line a message tells someone to run is the RUNNABLE one, `node "<clone>/cli/dev-spec.js" …` (a plugin install
    // has no `dev-spec` on PATH — the 1.19 eval run relayed `dev-spec done csv-export 2 --run` to a user who couldn't run it), in
    // EN / PT / ES and pt-BR (held byte for byte by the derivation). A sweep of every message: a bare `dev-spec <command>` is left
    // only where it names the command (a description) or lands in a committed file (AUTO-GENERATED markers, retro.md, UPGRADE.md,
    // decisions.md, a track pack's track.json, the tracker CSV) — there portableCli() keeps the name, never a machine path.
    const I = require("./lib/i18n.js");
    const cloneCli = path.resolve(__dirname, "..", "..", "cli", "dev-spec.js").replace(/\\/g, "/"); // this file's folder: mcp/tests/
    const run = (l) => [I.msg(l).evidenceGate.manualOnRunnable(2, "csv-export"), I.msg(l).projectChecks.blocker("test", "csv-export"),
      I.msg(l).drift.hookLine("csv-export", 2), I.msg(l).governance.ffHint("csv-export", "design, tasks")];
    const want = ["done csv-export 2 --run", "finish csv-export --run", "drift csv-export", "approve csv-export --through tasks"];
    const perLang = ["en", "pt", "es", "pt-BR"].map((l) => run(l).every((m, k) => m.includes(I.DEV_SPEC + " " + want[k]) && !/(?<![\w/.-])dev-spec (?:done|finish|drift|approve) /.test(m)));
    // 1.21 review A2: the command list is the CLI's own — every `case "<name>":` label of cli/dev-spec.js (a hand-written list went
    // stale: `dev-spec signals …` and `dev-spec merge-state --install` slipped through) — and a message builder is called with
    // several argument shapes (strings, lists, records, numbers), so one that maps a list is swept too, not skipped.
    const cliCommands = [...new Set([...fs.readFileSync(path.join(__dirname, "..", "..", "cli", "dev-spec.js"), "utf8").matchAll(/^\s*case "([a-z][a-z0-9-]*)":/gm)].map((m) => m[1]))];
    const RE_BARE = new RegExp("(?<![\\w/.-])dev-spec (" + cliCommands.join("|") + ")(?![\\w-])(?! —)");
    const ALLOWED = new Set(["observed.on", "metrics.retroText.followUpsNote", "catalog.autogen", "approvalGuard.on.ask", "approvalGuard.on.deny", "upgrade.md.autogen",
      "upgrade.md.intro", "trackPacks.initJson", "stakeholderExport.autogen", "rtm.autogen", "releaseNotes.autogen", "gherkin.autogen", "trackerCsv.autogen",
      "trackerCsv.featureLine", "milestone.notesAutogen", "gitLog.noGit", "decisions.header", "adr.autogen", // 1.25: the ADR files' marker
      "mergeState.conflictHead", "mergeState.parseError"]); // the driver's own stderr lines, named by the product ("dev-spec merge-state: <file>: …")
    const ARG_SHAPES = [["x", "y", "z"], [["x"], ["y"], ["z"]], [[{ word: "w", track: "t", effect: "off", phase: "p" }], "y", "z"], [1, 2, 3], [{ x: 1 }, "y", "z"]];
    const bare = {}, runnable = {};
    let swept = 0;
    for (const l of ["en", "pt", "es", "pt-BR"]) {
      const walk = (o, p, d) => { if (d > 7) return; for (const k of Object.keys(o)) { const v = o[k]; const outs = [];
        if (typeof v === "function") { for (const a of ARG_SHAPES) { try { outs.push(String(v(...a))); } catch { /* another shape */ } } }
        else if (typeof v === "string") outs.push(v); else if (v && typeof v === "object") { walk(v, p + k + ".", d + 1); continue; }
        if (!outs.length) continue;
        swept++;
        if (outs[0].includes(I.DEV_SPEC)) runnable[l] = (runnable[l] || 0) + 1;
        if (outs.some((s) => RE_BARE.test(s)) && !ALLOWED.has(p + k)) (bare[l] = bare[l] || []).push(p + k); } };
      walk(I.msg(l), "", 0);
    }
    const listed = ["signals", "merge-state", "classify", "done", "bundle"].every((c) => cliCommands.includes(c));
    const probe = (l) => [I.msg(l).classify.overridesApplied([{ word: "w", track: "api", effect: "off" }]), I.msg(l).signals.capped(200), I.msg(l).mergeState.teamNote];
    const probed = ["en", "pt", "es", "pt-BR"].every((l) => probe(l).every((s) => s.includes(I.DEV_SPEC + " ") && !RE_BARE.test(s)));
    ok(listed && probed && swept > 4000 && !Object.keys(bare).length,
      "1.21 review A2: the bare-command sweep reads its command list from the CLI's case labels (signals, merge-state … included) and calls each builder with several argument shapes; the signals / classifier-override messages and the merge driver's team note print the runnable line in EN / PT / ES / pt-BR (got " +
      JSON.stringify({ commands: cliCommands.length, listed, probed, swept, bare, sample: probe("en") }) + ")");
    const br = I.toPtBr("Corre: " + I.DEV_SPEC + " done csv-export 2 --run (a equipa regista-o).");
    ok(I.DEV_SPEC === 'node "' + cloneCli + '"' && perLang.every(Boolean) && !Object.keys(bare).length &&
      ["en", "pt", "es", "pt-BR"].every((l) => runnable[l] >= 60 && runnable[l] === runnable.en) && br.includes(I.DEV_SPEC + " done csv-export 2 --run") && /^Execute: /.test(br) && /equipe/.test(br),
      "1.21 F3: every message that says to run the CLI prints `node \"<clone>/cli/dev-spec.js\" …` (this clone's path) in EN / PT / ES / pt-BR — done --run, finish --run, drift, the fast-forward; no bare `dev-spec <command>` outside the descriptions and the committed-file texts; pt-BR keeps the line byte for byte (got " +
      JSON.stringify({ devSpec: I.DEV_SPEC, perLang, bare, runnable, br }) + ")");
  }

  { // 1.24 r6 H6: the ES steering stubs say "funcionalidad" where "función" reads as a code function (structure.md's module
    // boundaries, observability.md's per-feature metrics) — EN says feature there
    const I = require("./lib/i18n.js");
    const st = I.steeringStub("structure.md", "es"), ob = I.steeringStub("observability.md", "es");
    ok(!/cada función expone|no importa ninguna función/.test(st) && /cada funcionalidad expone un único punto de entrada/.test(st) && /lib\/\* no importa ninguna funcionalidad/.test(st) &&
      !/Por función:/.test(ob) && /Por funcionalidad: conteo de solicitudes/.test(ob),
      "1.24 r6 H6: ES structure.md / observability.md stubs — 'cada funcionalidad expone…', 'Por funcionalidad:' (a feature, never a code function)");
  }

  { // 1.24 r6 H8 + H9: pt-BR says "revisado" (never the European "revisto"), "+N mais", and "tela" takes its own (feminine)
    // article and possessive; PT's change-approach question asks why the change touches only that, as EN / ES do
    const I = require("./lib/i18n.js");
    const tr = I.toPtBr;
    const revBr = ["modelo de ameaças revisto.", "documentado, revisto, na biblioteca", "os contratos revistos", "a lista revista", "as regras revistas"].map((s) => tr(s));
    const ecra = tr("O erro aparece no ecrã, num ecrã e no teu ecrã; o ecrã de login, um ecrã de ajuda, os ecrãs do seu ecrã e o leitor de ecrã.");
    const ptA = I.msg("pt").clarify.changeApproach, brA = I.msg("pt-BR").clarify.changeApproach;
    ok(revBr.join(" | ") === "modelo de ameaças revisado. | documentado, revisado, na biblioteca | os contratos revisados | a lista revisada | as regras revisadas" &&
      I.msg("pt").gates.more(3) === "+3 mais" && I.msg("pt-BR").gates.more(3) === "+3 mais" &&
      ecra === "O erro aparece na tela, em uma tela e na sua tela; a tela de login, uma tela de ajuda, as telas da sua tela e o leitor de tela." &&
      tr(ecra) === ecra && ptA === "Escreve a Abordagem no change.md: o que a alteração toca e porque é só isso." &&
      brA === "Escreva a Abordagem no change.md: o que a alteração toca e por que é só isso.",
      "1.24 r6 H8 + H9: pt-BR — revisto/revista(s) → revisado(s)/revisada(s); '+N mais'; ecrã → tela with its article (no/num/o/um/os/do seu/teu → na/em uma/a/uma/as/da sua); PT changeApproach asks why that is all of it (got " +
      JSON.stringify({ revBr, more: I.msg("pt").gates.more(3), ecra, ptA, brA }) + ")");
  }

  { // 1.24 r6 H-I4: spec_classify reads pt and pt-BR alike (lang stays "pt" — a stable field) and says which one the wording is:
    // `langHint: "pt-BR"` when the Brazilian markers outweigh the European ones (você, usuário, arquivo, tela, cadastrar, "o time"…);
    // none for European wording, another language or an explicit lang pt-BR
    const brText = "Permitir que o usuário faça upload de um arquivo na tela de cadastro";
    const br = payload(await rpc("tools/call", { name: "spec_classify", arguments: { description: brText } }));
    const team = S.classify("Você pode exportar a planilha do time de vendas", {});
    const eu = S.classify("Permitir que o utilizador carregue um ficheiro no ecrã de registo", {});
    const es = S.classify("Exportar facturas en PDF para el cliente", {});
    const en = S.classify("Add a CSV export for the time sheet", {});
    const explicitBr = S.classify(brText, { lang: "pt-BR" });
    const explicitPt = S.classify(brText, { lang: "pt" });
    const accents = [S.classify("Relatório eletrônico de vendas", {}), S.classify("Relatório electrónico de vendas", {})];
    ok(br.lang === "pt" && br.langHint === "pt-BR" && team.langHint === "pt-BR" && eu.lang === "pt" && !("langHint" in eu) && !("langHint" in es) &&
      !("langHint" in en) && explicitBr.lang === "pt-BR" && !("langHint" in explicitBr) && explicitPt.langHint === "pt-BR" &&
      accents[0].langHint === "pt-BR" && !("langHint" in accents[1]) && JSON.stringify(br.tracks) === JSON.stringify(S.classify(brText, {}).tracks),
      "1.24 r6 H-I4: Brazilian wording gets langHint 'pt-BR' (lang stays 'pt'; MCP = engine) — você / usuário / arquivo / tela / cadastro, 'o time', eletrônico; European wording, ES, EN and an explicit pt-BR get none (got " +
      JSON.stringify([br.lang, br.langHint, team.langHint, eu.langHint, es.langHint, explicitBr.langHint, explicitPt.langHint, accents.map((r) => r.langHint)]) + ")");
  }
};
