"use strict";

/**
 * dev-spec-driven i18n — pt-BR, Brazilian Portuguese as a DERIVED locale (toPtBr over the pt strings, built lazily per
 * table group by defineDerivedLocale). mcp/lib/i18n.js derives every table's pt-BR twin with it, and loads this file only
 * on the first pt-BR read (a table's pt-BR entry, toPtBr, derivePtBr).
 */
// ===========================================================================
// pt-BR — Brazilian Portuguese as a DERIVED locale (1.14 D1). `pt` stays European Portuguese (the default for pt /
// pt-PT); every pt-BR string is toPtBr(the pt string), so a pt template or message edit reaches pt-BR with nothing else
// to change. toPtBr, in order:
//   0. protect what is never prose — code spans, `_Marker: …_` tokens, URLs, CLI flags, paths / file names, {json}
//      snippets — and, for a derived FUNCTION, the caller's own argument strings (feature names, paths, user text); then
//      PTBR_OVERRIDES: European sentences the rules get wrong, replaced by a hand-written Brazilian one (never re-read);
//   1. the European progressive "está a correr" → "está rodando" (PTBR_GERUND: a + infinitive after a noun, estar,
//      ficar, continuar — never after voltar a / passar a / começar a / nada a / para a);
//   2. PTBR_PHRASES — multi-word vocabulary ("por defeito" → "por padrão", "em curso" → "em andamento", "base de dados"
//      → "banco de dados") and the "põe X a verde" → "faz X passar" family;
//   3. the second person: tu verbs → você ("tens" → "você tem", "se não souberes" → "se você não souber"), "não
//      alteres" → "não altere", "o teu" → "seu", "contigo" → "com você" (PTBR_YOU, PTBR_YOU_SUBJ);
//   4. PTBR_IMPERATIVES — the tu imperative → the você imperative ("corre" → "execute", "revê" → "revise"), ONLY where a
//      clause starts (a line / list item, after . : ; — → ( [ , after "e" / "ou" / "," chained to an imperative, after a
//      "Se …," intro) — the same form mid-sentence is the 3rd person ("o hook corre" → "o hook roda", word map);
//   5. PTBR_WORDS — single words: vocabulary (utilizador → usuário, ficheiro → arquivo, ecrã → tela, equipa → equipe,
//      registo → registro…) and spelling (secção → seção, facto → fato, deteção → detecção, autónomo → autônomo…).
// Whole words only (unicode boundaries — never inside an identifier, a path or a compound's second half), case kept
// (Utilizador → Usuário, UTILIZADOR → USUÁRIO). No rule's output is another rule's key, so toPtBr is idempotent and a
// Brazilian string passes through unchanged. English-stable tokens (IDs, [SaaS]/[AI] markers, [NEEDS CLARIFICATION],
// `> **TODO**`, **Checkpoint:**, _Marker:_ tags, EARS keywords, commands, paths) hold no Portuguese key: they come out
// byte-identical (mcp/test.js lints every pt-BR string for both). Known limits: GDPR vocabulary stays GDPR (no LGPD
// mapping — the +privacy track cites GDPR articles), "pedido" (request) is kept, and the imperative rule can only see a
// clause start — an imperative in the middle of a sentence is left as the European form.
// WHEN YOU ADD OR EDIT A pt STRING, read its Brazilian twin once: node -e "console.log(require('./mcp/lib/i18n.js').toPtBr('…'))".
// A clause-start 3rd person read as an order ("— liberta o nome" → "libere") goes into RE_PTBR_NOT_IMPERATIVE; a word the
// maps miss into PTBR_WORDS / PTBR_PHRASES; anything else into PTBR_OVERRIDES. mcp/test.js (pD1) lints every string.
// ===========================================================================
const { DEV_SPEC } = require("./common.js"); // load time \u2014 the runnable CLI line (1.21 F3), protected whole in stage 0
const PTBR_KEEP = "\uE000", PTBR_END = "\uE001"; // private-use sentinels around a protected segment's index
const PTBR_W = "\\p{L}\\p{N}_"; // word characters

// 0. Exact European fragments the rules would get wrong → Brazilian (case-sensitive, applied first, then protected).
const PTBR_OVERRIDES = [
  // +dist (1.17 D): a race condition is a "condição de corrida" in Brazil too — never the "corrida" (a run) → "executada" rule
  ["Condições de corrida", "Condições de corrida"], ["condições de corrida", "condições de corrida"], ["condição de corrida", "condição de corrida"],
  ["caminho/ficheiro.test.js", "caminho/arquivo.test.js"], // an example path inside a _Verify:_ placeholder
  ["<ficheiro>", "<arquivo>"], ["<artefacto>", "<artefato>"], // placeholders inside a path / URI
  ["Põe-no a falhar", "Faça-o falhar"],
  [") e regista essa execução", ") e registre essa execução"],
  ["e regista a execução a falhar antes da correção", "e registre a execução falhando antes da correção"],
  ["Trabalha-o com", "Trabalhe nele com"],
  ["Muda-lhe o nome", "Renomeie-a"],
  ["antes de o arquivo registar a sua entrada", "antes de o arquivamento registrar sua entrada"],
  ["registos de arquivo", "registros de arquivamento"],
  ["registo de arquivo", "registro de arquivamento"],
  ["de casos de abuso a verde", "de casos de abuso passando"],
  ["O que correu bem", "O que deu certo"],
  ["decidas o que decidires, volta", "decida o que decidir, volte"],
  ["decidas o que decidires", "decida o que decidir"],
  // full review Pb7 — the LGPD's name for the DPIA (a masculine report) and its article; the heading stays matched by the
  // DPIA section's synonyms ("ripd").
  ["AIPD (quando obrigatória — art. 35.º)", "RIPD (quando obrigatório — LGPD art. 38)"],
  ["o controlador pára para revisão", "o controlador faz uma pausa para revisão"],
  ["— lê de outra forma", "— lê de outra forma"], // cmd.exe "reads it differently": a 3rd person after a parenthetical dash
  ["; aceita uma lista", "; aceita uma lista"], // a glob syntax note: "accepts a list"
  // +obs (1.19 T review): in Brazil a "ligação" is a phone call — the runbook gets a link, the on-call person is "de plantão"
  ["dispara e chama com a ligação ao runbook", "dispara e aciona o plantão com o link para o runbook"],
  // review 5 — a symlink is a "link" in Brazil (the phrase table misses this one: its "symlink / junction" reads as a path)
  ["uma ligação (symlink / junction)", "um link (symlink / junction)"],
];

// 1. The European progressive a + infinitive → the Brazilian gerund. correr = a process running → rodando.
const PTBR_GERUND = { correr: "rodando", ser: "sendo", ler: "lendo", ter: "tendo", ir: "indo", pôr: "pondo" };
const PTBR_GERUND_VERBS = new Set(["correr", "ser", "ler", "aguardar", "falhar", "explicar", "atualizar", "precisar", "funcionar", "dizer",
  "mostrar", "trabalhar", "usar", "processar", "executar", "gerar", "esperar", "crescer", "carregar", "escrever", "passar", "tentar",
  "pedir", "criar", "analisar", "bloquear", "responder", "rodar"]);
// "a" + infinitive after these is not a progressive: voltar a / passar a / começar a (aspect), nada a / mais a (to be
// done), para a / de a / sem a (a = the pronoun "it": "para a apagar").
const PTBR_GERUND_BLOCK = new Set(["volta", "voltam", "voltar", "volte", "voltem", "voltou", "voltaram", "voltares", "voltarem", "voltasse",
  "passa", "passam", "passar", "passe", "passou", "começa", "começam", "começar", "comece", "começou", "começaram", "torna", "tornam",
  "tornar", "nada", "mais", "para", "até", "de", "sem", "por", "após", "ajuda", "ajudam", "ajudar", "tende", "tendem", "chega", "chegam",
  "chegar", "obriga", "obrigam", "leva", "levam", "vai", "vão", "ir", "vá", "disposto", "disposta", "prestes", "pronto", "pronta",
  "prontos", "prontas", "igual", "pôr", "põe", "põem", "pondo", "ponha", "aprende", "aprender", "ensina", "custa", "custou", "que"]);

// 2. Multi-word vocabulary (whitespace-tolerant, case kept from the first letter).
const PTBR_PHRASES = {
  "por defeito": "por padrão", "por omissão": "por padrão", "shell por omissão": "shell padrão",
  "a shell por omissão": "o shell padrão", "da shell por omissão": "do shell padrão", "a shell": "o shell", "da shell": "do shell",
  "na shell": "no shell", "uma shell": "um shell", "pela shell": "pelo shell", "à shell": "ao shell", "numa shell": "em um shell",
  "base de dados": "banco de dados", "bases de dados": "bancos de dados", "a base de dados": "o banco de dados",
  "da base de dados": "do banco de dados", "na base de dados": "no banco de dados", "à base de dados": "ao banco de dados",
  "uma base de dados": "um banco de dados", "numa base de dados": "em um banco de dados", "pela base de dados": "pelo banco de dados",
  "cópias de segurança": "backups", "cópia de segurança": "backup",
  "em curso": "em andamento", "em falta": "faltando",
  // "por + infinitive" (not done yet): a state → "sem …" (unfilled, unresolved); a to-do → "a …"
  "por preencher": "sem preencher", "por resolver": "sem resolver", "por fechar": "sem fechar", "por correr": "sem executar",
  "por concluir": "sem concluir", "por verificar": "sem verificar", "por testar": "sem testar", "por validar": "sem validar",
  "por terminar": "sem terminar", "por escrever": "sem escrever", "por fazer": "a fazer", "por aprovar": "a aprovar",
  "por rever": "a revisar", "por marcar": "a marcar", "por começar": "a começar", "por tratar": "a tratar",
  "por implementar": "a implementar", "por decidir": "a decidir", "por responder": "a responder", "por migrar": "a migrar",
  "por cobrir": "a cobrir", "por confirmar": "a confirmar",
  "até ao": "até o", "até à": "até a", "até aos": "até os", "até às": "até as",
  "de seguida": "em seguida", "se calhar": "talvez", "à procura de": "procurando",
  "sistema operativo": "sistema operacional", "sistemas operativos": "sistemas operacionais", "correio eletrónico": "e-mail",
  "fora de âmbito": "fora do escopo", "fora do âmbito": "fora do escopo", "em âmbito": "no escopo",
  "é aceite": "é aceito", "for aceite": "for aceito", "foi aceite": "foi aceito", "seja aceite": "seja aceito", "ser aceite": "ser aceito",
  "correu bem": "deu certo", "correu mal": "deu errado", "corre bem": "dá certo", "corre mal": "dá errado",
  "pôr a passar": "fazer passar", "di-lo": "diga isso", "fá-lo": "faça isso",
  "efeitos secundários": "efeitos colaterais", "batem sempre certo": "sempre fecham", "porque se aplica": "por que se aplica",
  "porque importa": "por que importa", "porque é preciso": "por que é preciso", // the interrogative "why" is two words in Brazil
  "porque é só isso": "por que é só isso",
  // review 6 (H8) — "tela" is feminine where "ecrã" is masculine: the article, contraction or possessive before it changes along
  // (the bare word is PTBR_WORDS'; "leitor de ecrã" → "leitor de tela" needs no article)
  "o ecrã": "a tela", "os ecrãs": "as telas", "do ecrã": "da tela", "dos ecrãs": "das telas", "no ecrã": "na tela", "nos ecrãs": "nas telas",
  "ao ecrã": "à tela", "aos ecrãs": "às telas", "pelo ecrã": "pela tela", "pelos ecrãs": "pelas telas", "um ecrã": "uma tela", "uns ecrãs": "umas telas",
  "num ecrã": "em uma tela", "dum ecrã": "de uma tela", "seu ecrã": "sua tela", "seus ecrãs": "suas telas", "teu ecrã": "sua tela", "teus ecrãs": "suas telas",
  "o seu ecrã": "a sua tela", "o teu ecrã": "a sua tela", "os seus ecrãs": "as suas telas", "os teus ecrãs": "as suas telas",
  "do seu ecrã": "da sua tela", "do teu ecrã": "da sua tela", "no seu ecrã": "na sua tela", "no teu ecrã": "na sua tela",
  "este ecrã": "esta tela", "esse ecrã": "essa tela", "neste ecrã": "nesta tela", "nesse ecrã": "nessa tela", "deste ecrã": "desta tela",
  "desse ecrã": "dessa tela", "outro ecrã": "outra tela", "mesmo ecrã": "mesma tela", "novo ecrã": "nova tela",
  // a word whose Brazilian twin changes gender takes its article along
  "a faturação": "o faturamento", "da faturação": "do faturamento", "na faturação": "no faturamento", "à faturação": "ao faturamento",
  "pela faturação": "pelo faturamento", "uma faturação": "um faturamento", "a monitorização": "o monitoramento",
  "da monitorização": "do monitoramento", "na monitorização": "no monitoramento", "à monitorização": "ao monitoramento",
  "pela monitorização": "pelo monitoramento", "uma monitorização": "um monitoramento", "o arranque": "a inicialização",
  "do arranque": "da inicialização", "no arranque": "na inicialização", "ao arranque": "à inicialização", "um arranque": "uma inicialização",
  "uma gralha": "um erro de digitação", "a gralha": "o erro de digitação", "as gralhas": "os erros de digitação",
  // full review Pb7 — "ter de" + infinitive is "ter que" in Brazil; enclisis after a verb reads European (mantém-se → se mantém,
  // lê-se como → é lido como); acessar takes a direct object (never "lhe pode acessar").
  "tem de": "tem que", "têm de": "têm que", "temos de": "temos que", "tenho de": "tenho que", "tens de": "tens que",
  "terá de": "terá que", "terão de": "terão que", "teria de": "teria que", "teriam de": "teriam que", "ter de": "ter que",
  "tinha de": "tinha que", "tenha de": "tenha que", "tenham de": "tenham que", "tiver de": "tiver que",
  "mantém-se": "se mantém", "mantêm-se": "se mantêm", "lê-se como": "é lido como", "quem lhe pode aceder": "quem pode acessá-lo",
  // LGPD vocabulary (full review Pb7): the processor is the "operador", the DPIA the RIPD (a masculine report) — the
  // section synonyms (spec.js PRIVACY_SECTIONS) read the Brazilian headings
  "subcontratantes ulteriores": "suboperadores", "conservação e eliminação": "retenção e eliminação",
  "a aipd": "o RIPD", "da aipd": "do RIPD", "na aipd": "no RIPD", "à aipd": "ao RIPD", "pela aipd": "pelo RIPD", "uma aipd": "um RIPD",
  // +obs (1.19 T review): the on-call person is "de plantão", and a runbook gets a link (a "ligação" is a phone call in Brazil)
  "pessoa de serviço": "pessoa de plantão", "uma ligação para o runbook": "um link para o runbook", "a ligação ao runbook": "o link para o runbook",
  "os rápidos chamam": "os rápidos acionam o plantão",
  // (1.19 verify 4) the [OBS] Alerting guidance and the observability.md heading: whoever is paged is "acionado", each alert points
  // to its runbook ("ligar" / "chamada" read as a phone call in Brazil)
  "quem é chamado": "quem é acionado", "cada chamada liga a um runbook": "cada alerta aponta para um runbook",
  "o que é um ticket e não uma chamada": "o que vira um ticket e não aciona o plantão",
  "a que os alertas ligam": "para os quais os alertas apontam", "cada um liga a um runbook": "cada um com um link para o runbook",
  // review 5 — "à espera (de)" is European; Brazil says "aguardando" (the article stays with its noun)
  "à espera de": "aguardando", "à espera do": "aguardando o", "à espera da": "aguardando a", "à espera dos": "aguardando os",
  "à espera das": "aguardando as", "à espera": "aguardando",
  // review 5 — a symlink is a "link" in Brazil (a "ligação" is a phone call); a connection to the harness, an integration
  "é uma ligação simbólica": "é um link simbólico", "uma ligação (simbólica, ou uma junction)": "um link (simbólico ou junction)",
  "uma ligação (link simbólico, junction)": "um link (simbólico ou junction)",
  "é uma ligação ou uma pasta": "é um link ou uma pasta", "uma ligação para fora do projeto": "um link simbólico para fora do projeto",
  "repõe a ligação": "restaura o vínculo", "ligação ao harness": "integração com o harness",
};
// "põe X a verde" (make X pass) → "faz X passar"; "postos a verde" → "deixados verdes"; a leftover "a verde" → "verde(s)".
const PTBR_GREEN_VERB = { põe: ["faz", "passar"], põem: ["fazem", "passar"], pôr: ["fazer", "passar"], pondo: ["fazendo", "passar"],
  ponha: ["faça", "passar"], posto: ["deixado", "verde"], posta: ["deixada", "verde"], postos: ["deixados", "verdes"], postas: ["deixadas", "verdes"] };

// 3. The second person. PTBR_YOU: the tu form → "você" + this form (preterite, future subjunctive, personal infinitive
// included); PTBR_YOU_SUBJ: the tu present subjunctive ("não alteres") → the você one, no pronoun.
const PTBR_YOU = {
  tens: "tem", queres: "quer", podes: "pode", estás: "está", és: "é", precisas: "precisa", sabes: "sabe", vês: "vê", fazes: "faz",
  deves: "deve", vais: "vai", consegues: "consegue", avanças: "avança", reportas: "reporta", usas: "usa", escreves: "escreve",
  corres: "executa", fizeste: "fez", pediste: "pediu", disseste: "disse", viste: "viu", quiseste: "quis", tiveste: "teve",
  criaste: "criou", correste: "executou", marcaste: "marcou", aprovaste: "aprovou", quiseres: "quiser", tiveres: "tiver",
  souberes: "souber", usares: "usar", voltares: "voltar", aceitares: "aceitar", decidires: "decidir", especificares: "especificar",
  puderes: "puder", fizeres: "fizer", precisares: "precisar", estiveres: "estiver", fores: "for", correres: "executar",
  escreveres: "escrever", escolheres: "escolher", preferires: "preferir", adicionares: "adicionar", mudares: "mudar",
  marcares: "marcar", aprovares: "aprovar", terminares: "terminar", abrires: "abrir", quererás: "quererá", validas: "valida",
};
const PTBR_YOU_SUBJ = {
  alteres: "altere", mudes: "mude", ponhas: "ponha", quebres: "quebre", refaças: "refaça", construas: "construa", decidas: "decida",
  delegues: "delegue", corras: "execute", apagues: "apague", edites: "edite", esqueças: "esqueça", marques: "marque", saltes: "pule",
  assumas: "assuma", escrevas: "escreva", faças: "faça", digas: "diga", tentes: "tente", deixes: "deixe", inventes: "invente",
  confies: "confie", adiciones: "adicione", aproves: "aprove", removas: "remova", voltes: "volte", precises: "precise",
  tenhas: "tenha", possas: "possa", queiras: "queira", sejas: "seja", estejas: "esteja", vás: "vá", ignores: "ignore",
  mexas: "mexa", toques: "toque", reescrevas: "reescreva", apresentes: "apresente", declares: "declare", afirmes: "afirme",
};
const PTBR_POSSESSIVE = { teu: "seu", tua: "sua", teus: "seus", tuas: "suas" };

// 4. The tu imperative → the você imperative (a clause start only; see ptbrImperatives).
const PTBR_IMPERATIVES = {
  volta: "volte", corre: "execute", revê: "revise", mantém: "mantenha", aprova: "aprove", marca: "marque", põe: "coloque",
  regista: "registre", passa: "passe", confirma: "confirme", especifica: "especifique", escreve: "escreva", indica: "indique",
  tira: "tire", usa: "use", corrige: "corrija", escolhe: "escolha", tenta: "tente", quantifica: "quantifique", apaga: "apague",
  aponta: "aponte", declara: "declare", acrescenta: "acrescente", liga: "ligue", desliga: "desligue", arquiva: "arquive",
  restaura: "restaure", dá: "dê", substitui: "substitua", lê: "leia", verifica: "verifique", justifica: "justifique",
  recorre: "recorra", respeita: "respeite", preenche: "preencha", decide: "decida", faz: "faça", ordena: "ordene", segue: "siga",
  evita: "evite", divide: "divida", atualiza: "atualize", vê: "veja", valida: "valide", liberta: "libere", responde: "responda",
  implementa: "implemente", aceita: "aceite", lista: "liste", trabalha: "trabalhe", arranca: "inicie", planeia: "planeje", começa: "comece", cria: "crie", remove: "remova",
  resolve: "resolva", encontra: "encontre", refaz: "refaça", cita: "cite", retoma: "retome", investiga: "investigue", muda: "mude",
  fecha: "feche", adiciona: "adicione", renumera: "renumere", abre: "abra", define: "defina", copia: "copie", renomeia: "renomeie",
  edita: "edite", move: "mova", pede: "peça", nomeia: "nomeie", avisa: "avise", prolonga: "prolongue", age: "aja",
  considera: "considere", termina: "termine", experimenta: "experimente", refatora: "refatore", mostra: "mostre", melhora: "melhore",
  otimiza: "otimize", sinaliza: "sinalize", cobre: "cubra", recusa: "recuse", cola: "cole", imprime: "imprima", diz: "diga",
  guarda: "salve", sê: "seja", pára: "pare", inclui: "inclua", exporta: "exporte", importa: "importe", prioriza: "priorize",
  separa: "separe", junta: "junte", mapeia: "mapeie", agrupa: "agrupe", testa: "teste", reproduz: "reproduza", descreve: "descreva",
  anota: "anote", documenta: "documente", reabre: "reabra", desmarca: "desmarque", deixa: "deixe", espera: "espere", chama: "chame",
  repõe: "restaure", recolhe: "colete", partilha: "compartilhe", instala: "instale", configura: "configure", gera: "gere",
  migra: "migre", ignora: "ignore", trata: "trate", mede: "meça", envia: "envie", integra: "integre", isola: "isole", injeta: "injete",
  fixa: "fixe", avalia: "avalie", afina: "ajuste", analisa: "analise", compara: "compare", emite: "emita", torna: "torne",
  garante: "garanta", assegura: "assegure", assinala: "sinalize", lembra: "lembre", procura: "procure", repete: "repita", encurta: "encurte",
  traz: "traga", pensa: "pense", prepara: "prepare", publica: "publique", reverte: "reverta", desfaz: "desfaça", avança: "avance",
  inicia: "inicie", conclui: "conclua", preserva: "preserve", protege: "proteja", retira: "retire", redige: "redija",
  elimina: "elimine", exclui: "exclua", reporta: "reporte", anexa: "anexe", clica: "clique", reaprova: "reaprove", prefere: "prefira",
  aplica: "aplique", acaba: "acabe", regenera: "regenere", corta: "corte", limita: "limite", reduz: "reduza", explica: "explique",
  comenta: "comente", pega: "pegue", confia: "confie", assume: "assuma", delega: "delegue", estima: "estime", calcula: "calcule",
  obtém: "obtenha", ouve: "ouça", cumpre: "cumpra",
};
// After these at a clause start, the next word starts the clause too ("depois corre", "(ou usa …)").
const RE_PTBR_LEADIN = /^(?:(?:e|ou|mas|depois|primeiro|então|agora|senão|finalmente|antes|em seguida|a seguir|por fim|por favor|no fim|no final|por isso|assim|de novo)(?![\p{L}\p{N}_])[ \t]*,?|(?:se não|caso contrário)[ \t]*,)[ \t]+/iu;
// A subordinate intro: the main clause (often an imperative) starts after its comma ("Se o teste falhar, corrige-o").
const RE_PTBR_INTRO = /^(?:se|quando|para|antes de|depois de|enquanto|caso|assim que|logo que|sem|até|após|ao|uma vez que|sempre que)(?![\p{L}\p{N}_])/iu;
// Where the chain of coordinated imperatives stops: a relative / subordinate word ("corre X, que verifica …").
const PTBR_CHAIN_STOP = new Set(["que", "onde", "quando", "porque", "pois", "como", "enquanto", "cujo", "cuja", "cujos", "cujas", "se", "quem"]);
// A clause-start verb read as the 3rd person after all (a description, not an instruction): never an imperative here.
const RE_PTBR_NOT_IMPERATIVE = [
  /^passam?[ \t]+a[ \t]+\p{L}+(?:ar|er|ir|ôr)(?![\p{L}])/iu, // "— passa a contar como…" (starts to): aspect, 3rd person
  /^[\p{L}]+[ \t]*\|/iu, // a literal value list: "remove | archive | rename"
  /^cita IDs de AC/iu, // a template check: "(the template) cites AC IDs…"
  /^faz passar IDs de teste/iu, // "(the template) makes test IDs green…"
  /^liberta o nome/iu, // "(archiving) frees the name"
  /^reproduz o bug(?![\p{L}])/iu, // a test's description: "T-01 — reproduces the bug: …"
  /^cumpre[ \t]*(?:\n|$)/iu, // the Constitution Check's status: "[Principle 1] — complies"
  /^lista[ \t]+(?:de|dos|das|do|da)(?![\p{L}])/iu, // the noun: "Lista de recursos…"
  /^planeia (?:os mesmos|ficheiros|\uE000)/iu, // a doctor overlap line: "(this feature) plans the same files as …"
];
// Where a clause starts: a line (after its list marker / checkbox / number / [tags] / bold), after . ! ? : ; — – → ( “ «.
const RE_PTBR_CLAUSE = /(?:^|\n)[ \t]*(?:>[ \t]*)*(?:(?:[-*+•]|\d+[.)])[ \t]+)?(?:\[[ xX]\][ \t]+)?(?:\d+[.)][ \t]+)?(?:\[(?:US\d+|P|shared|SaaS|AI|SEC|PRIVACY)\][ \t]*)*(?:\*\*|__)?[ \t]*|[.!?…][ \t]+(?:\*\*|__)?|[:;][ \t]+|[—–→⇒][ \t]*|[([][ \t]*|[“«][ \t]*/g;

// 5. Single words (a key may carry a hyphen: palavra-passe). Verb forms not listed keep their spelling (it is shared).
const PTBR_WORDS = {
  atómico: "atômico", atómica: "atômica", atómicos: "atômicos", atómicas: "atômicas", // +dist (1.17 D)
  utilizador: "usuário", utilizadores: "usuários", utilizadora: "usuária", utilizadoras: "usuárias", utente: "usuário", utentes: "usuários",
  ficheiro: "arquivo", ficheiros: "arquivos", ecrã: "tela", ecrãs: "telas", equipa: "equipe", equipas: "equipes",
  "palavra-passe": "senha", "palavras-passe": "senhas", telemóvel: "celular", telemóveis: "celulares",
  registo: "registro", registos: "registros", registar: "registrar", regista: "registra", registam: "registram", registou: "registrou",
  registaram: "registraram", registado: "registrado", registada: "registrada", registados: "registrados", registadas: "registradas",
  registe: "registre", registem: "registrem", registando: "registrando", registará: "registrará", registaria: "registraria",
  "registá-lo": "registrá-lo", "registá-la": "registrá-la", "registá-los": "registrá-los", "registá-las": "registrá-las",
  facto: "fato", factos: "fatos", contacto: "contato", contactos: "contatos", contactar: "contatar", contacte: "contate",
  secção: "seção", secções: "seções", receção: "recepção", receções: "recepções", perceção: "percepção", perceções: "percepções",
  conceção: "concepção", conceções: "concepções", deteção: "detecção", deteções: "detecções", detetar: "detectar", deteta: "detecta",
  detetam: "detectam", detetamos: "detectamos", detetado: "detectado", detetada: "detectada", detetados: "detectados", detetadas: "detectadas", detetou: "detectou",
  detete: "detecte", detetável: "detectável", artefacto: "artefato", artefactos: "artefatos", controlo: "controle", controlos: "controles",
  respetivo: "respectivo", respetiva: "respectiva", respetivos: "respectivos", respetivas: "respectivas", retrospetiva: "retrospectiva",
  retrospetivas: "retrospectivas", perspetiva: "perspectiva", perspetivas: "perspectivas", aspeto: "aspecto", aspetos: "aspectos",
  espetro: "espectro", fiável: "confiável", fiáveis: "confiáveis", fiabilidade: "confiabilidade", gralha: "erro de digitação",
  gralhas: "erros de digitação", plicas: "aspas simples", planear: "planejar", planeado: "planejado", planeada: "planejada",
  planeados: "planejados", planeadas: "planejadas", planeamento: "planejamento", planeia: "planeja", planeiam: "planejam",
  planeie: "planeje", planeiem: "planejem", planeou: "planejou", cifragem: "criptografia", monitorização: "monitoramento",
  faturação: "faturamento", rastreio: "rastreamento", rastreios: "rastreamentos", aceder: "acessar", acede: "acessa", acedem: "acessam",
  acedido: "acessado", acedida: "acessada", partilhar: "compartilhar", partilha: "compartilha", partilham: "compartilham",
  partilhado: "compartilhado", partilhada: "compartilhada", partilhados: "compartilhados", partilhadas: "compartilhadas",
  recolher: "coletar", recolha: "coleta", recolhe: "coleta", recolhido: "coletado", recolhida: "coletada", recolhidos: "coletados",
  recolhidas: "coletadas", arrancar: "iniciar", arranca: "inicia", arranque: "inicialização", libertar: "liberar", liberta: "libera",
  libertado: "liberado", libertada: "liberada", assinalar: "sinalizar", assinala: "sinaliza", assinalam: "sinalizam",
  assinalado: "sinalizado", assinalada: "sinalizada", assinalados: "sinalizados", assinaladas: "sinalizadas", assinale: "sinalize",
  descodificar: "decodificar", descodifica: "decodifica", descodificado: "decodificado", guardar: "salvar", guardou: "salvou",
  guardado: "armazenado", guardada: "armazenada", guardados: "armazenados", guardadas: "armazenadas", "guarda-o": "armazena-o",
  "guarda-a": "armazena-a", "guarda-os": "armazena-os", "guarda-as": "armazena-as", fornecedor: "provedor", fornecedores: "provedores",
  gerir: "gerenciar", gerido: "gerenciado", gerida: "gerenciada", geridos: "gerenciados", geridas: "gerenciadas",
  pormenor: "detalhe", pormenores: "detalhes", pormenorizado: "detalhado", pormenorizada: "detalhada", percentagem: "porcentagem",
  percentagens: "porcentagens", descarregar: "baixar", descarregado: "baixado", subscrição: "assinatura", subscrições: "assinaturas",
  correr: "executar", corre: "roda", correm: "rodam", correu: "rodou", correram: "rodaram", corrido: "executado", corrida: "executada",
  corridos: "executados", corridas: "executadas", correria: "executaria", correriam: "executariam", "corrê-lo": "executá-lo",
  "corrê-la": "executá-la", "corrê-los": "executá-los", "corrê-las": "executá-las", pára: "para", sítio: "lugar", aceites: "aceitos",
  demasiado: "demais", "semi-autónomo": "semiautônomo", autónomo: "autônomo", autónoma: "autônoma", autónomos: "autônomos",
  autónomas: "autônomas", anónimo: "anônimo", anónima: "anônima", anónimos: "anônimos", anónimas: "anônimas", económico: "econômico",
  económica: "econômica", económicos: "econômicos", económicas: "econômicas", fenómeno: "fenômeno", fenómenos: "fenômenos",
  sinónimo: "sinônimo", sinónimos: "sinônimos", polémico: "polêmico", polémica: "polêmica", académico: "acadêmico", académica: "acadêmica",
  género: "gênero", géneros: "gêneros", prémio: "prêmio", prémios: "prêmios", ónus: "ônus", efémero: "efêmero", efémera: "efêmera",
  eletrónico: "eletrônico", eletrónica: "eletrônica", eletrónicos: "eletrônicos", eletrónicas: "eletrônicas", bebé: "bebê",
  treino: "treinamento", treinos: "treinamentos", afinar: "ajustar", afinado: "ajustado", afinada: "ajustada", guião: "roteiro",
  guiões: "roteiros", stock: "estoque", âmbito: "escopo", contigo: "com você", tu: "você",
  num: "em um", numa: "em uma", nuns: "em uns", numas: "em umas", noutro: "em outro", noutra: "em outra", noutros: "em outros",
  noutras: "em outras", nalgum: "em algum", nalguma: "em alguma", nalguns: "em alguns", nalgumas: "em algumas", dum: "de um",
  duma: "de uma", duns: "de uns", dumas: "de umas", doutro: "de outro", doutra: "de outra", doutros: "de outros", doutras: "de outras",
  // full review Pb7 — LGPD / Brazilian SaaS vocabulary (the section synonyms in spec.js read these headings)
  "multi-inquilino": "multilocatário", subcontratante: "operador", subcontratantes: "operadores", aipd: "RIPD",
  // review 6 (H8): the participle of rever is "revisado" in Brazil ("revisto" reads European)
  revisto: "revisado", revista: "revisada", revistos: "revisados", revistas: "revisadas",
};

function ptbrEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// Case of the source kept on the replacement: ALL CAPS, Capitalized or as written.
function ptbrCase(src, out) {
  const upper = (x) => x.length > 1 && x === x.toUpperCase() && x !== x.toLowerCase();
  const letters = src.replace(/[^\p{L}]/gu, "");
  if (upper(letters)) return out.toUpperCase();
  const first = (src.match(/^[\p{L}]+/u) || [""])[0];
  if (upper(first)) return out.replace(/^[\p{L}]+/u, (w) => w.toUpperCase()); // "FORA de âmbito" → "FORA do escopo"
  const cap = (w) => w.charAt(0) !== w.charAt(0).toLowerCase();
  const big = (src.match(/[\p{L}]+/gu) || []).filter((w) => w.length > 3);
  if (big.length > 1 && big.every(cap)) return out.replace(/[\p{L}]+/gu, (w) => (w.length > 3 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).replace(/^./u, (c) => c.toUpperCase()); // "Base de Dados" → "Banco de Dados"
  const c0 = src.charAt(0);
  return c0 !== c0.toLowerCase() ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}
// A whole-word alternation over `keys` (longest first; a space in a key matches any run of blanks). Never inside an
// identifier, a path, a flag or a compound's second half; a following hyphen is allowed (utilizadores-alvo, regista-o).
function ptbrWordRe(keys) {
  const alt = [...keys].sort((a, b) => b.length - a.length).map((k) => ptbrEscape(k).replace(/ /g, "[ \\t\\u00a0]+")).join("|");
  return new RegExp(`(?<![${PTBR_W}\\-.\\\\@#$])(?:${alt})(?![${PTBR_W}])`, "giu"); // "auth/faturação/dados" is prose; paths are protected
}
const ptbrKey = (m) => m.toLowerCase().replace(/[ \t\u00a0]+/g, " ");
let PTBR_RE = null; // compiled once, on the first pt-BR string
function ptbrRes() {
  if (PTBR_RE) return PTBR_RE;
  return (PTBR_RE = {
    phrases: ptbrWordRe(Object.keys(PTBR_PHRASES)),
    words: ptbrWordRe(Object.keys(PTBR_WORDS)),
    you: new RegExp(`(?<![${PTBR_W}\\-])((?:(?:tu|não|nunca|já|ainda|também|só|sempre|mesmo|o|a|os|as|lhe|lhes|me|nos)[ \\t]+){0,3})(${Object.keys(PTBR_YOU).map(ptbrEscape).join("|")})(?![${PTBR_W}\\-])`, "giu"),
    subj: ptbrWordRe(Object.keys(PTBR_YOU_SUBJ)),
    poss: new RegExp(`(?<![${PTBR_W}\\-])(?:(o|a|os|as)[ \\t]+)?(teu|tua|teus|tuas)(?![${PTBR_W}\\-])`, "giu"),
    gerund: new RegExp(`(?<![${PTBR_W}\\-])(a)[ \\t]+(${[...PTBR_GERUND_VERBS].map(ptbrEscape).join("|")})(?![${PTBR_W}\\-])`, "giu"),
    green: new RegExp(`(?<![${PTBR_W}\\-])(${Object.keys(PTBR_GREEN_VERB).join("|")})[ \\t]+((?:[^\\s.,;:!?—]+[ \\t]+){0,4}?)a[ \\t]+verde(?![${PTBR_W}])`, "giu"),
    greenLeft: new RegExp(`(?<![${PTBR_W}\\-])(?:([\\p{L}-]*[sS])[ \\t]+)?a[ \\t]+(verde|vermelho)(?![${PTBR_W}])`, "gu"),
    onDate: new RegExp(`(?<![${PTBR_W}\\-])(fechad[oa]s?|criad[oa]s?|gerad[oa]s?|arquivad[oa]s?|terminou|terminad[oa]|pelo dev-spec)[ \\t]+a[ \\t]+(?=${PTBR_KEEP}|\\d{4}-\\d{2}-\\d{2})`, "giu"), // a masked arg or an ISO date
    tooMuch: new RegExp(`(?<![${PTBR_W}\\-])demasiad(o|a|os|as)[ \\t]+([\\p{L}]+)(?![${PTBR_W}\\-])`, "giu"),
    why: new RegExp(`(?<![${PTBR_W}\\-])(o[ \\t]+)?(porquê)(?![${PTBR_W}])([ \\t]*)(?=([\\p{L}\\[]?))`, "giu"),
  });
}

// Every whole-word occurrence of an argument string replaced by hold(m) — a boundary only where its edge is a word
// character. A plain indexOf walk: one regex per argument would be compiled on every call.
const RE_PTBR_WORDCHAR = /[\p{L}\p{N}_]/u;
function ptbrMaskAll(s, m, hold) {
  const edgeL = RE_PTBR_WORDCHAR.test(m[0]), edgeR = RE_PTBR_WORDCHAR.test(m[m.length - 1]);
  let out = "", from = 0, i, token = null;
  while ((i = s.indexOf(m, from)) >= 0) {
    const okL = !edgeL || i === 0 || !RE_PTBR_WORDCHAR.test(s[i - 1]);
    const okR = !edgeR || i + m.length >= s.length || !RE_PTBR_WORDCHAR.test(s[i + m.length]);
    if (okL && okR) { out += s.slice(from, i) + (token || (token = hold(m))); from = i + m.length; } else { out += s.slice(from, i + 1); from = i + 1; }
  }
  return token ? out + s.slice(from) : s;
}
// Stage 0 — protect what is never prose, and the caller's argument strings, behind sentinels (restored at the end).
function ptbrProtect(text, masks, store) {
  const hold = (seg) => PTBR_KEEP + (store.push(seg) - 1) + PTBR_END;
  let s = text;
  // The clone's CLI line (`node "<clone>/cli/dev-spec.js"`): a machine path — a folder may be named with a word the rules
  // map (…/equipa/…) — held whole, byte-identical in every pt-BR message.
  if (s.includes(DEV_SPEC)) s = s.split(DEV_SPEC).join(hold(DEV_SPEC));
  for (const m of masks) if (s.includes(m)) s = ptbrMaskAll(s, m, hold); // whole words: a track 'sec' never masks "secção"
  for (const [eu, br] of PTBR_OVERRIDES) if (s.includes(eu)) s = s.split(eu).join(hold(br));
  return s
    .replace(/``[^\n]*?``|`[^`\n]+`/g, hold) // code spans
    .replace(/_[A-Z][A-Za-z]*(?: [a-z]+)?:[^_\n]*_/g, hold) // _Requirements: …_ · _Makes green: …_ · _Verify:_
    .replace(/https?:\/\/[^\s)>\]]+/g, hold)
    .replace(/(?<![\p{L}\p{N}_])(?:confirm|write|apply|force|remove|reopen|html|guard|stopCheck|includeBrief|code|deep|run): (?:true|false|null)(?![\p{L}\p{N}_])/gu, hold) // confirm: true
    .replace(/\{[^{}\n]*(?:\{[^{}\n]*\}[^{}\n]*)*\}/g, hold) // {json} / {{var}}
    .replace(/(?<![\p{L}\p{N}_-])--?[A-Za-z][\w-]*(?:=[^\s,;)]*)?/gu, hold) // --flags
    .replace(/(?<![\p{L}\p{N}_.\/-])(?:\.{0,2}\/|~\/|\.(?=[\w-]+\/))[^\s,;)'"`\]]*/gu, hold) // /commands, ./paths, .specs/…
    .replace(/[\w.\/<>*-]+/g, (run) => { // file names: a run up to its LAST "<name>.<ext>" (tasks.md, src/a.test.js)
      const end = ptbrFileEnd(run);
      return end ? hold(run.slice(0, end)) + run.slice(end) : run;
    });
}
// Where a run of path characters stops being a file name: the end of its last "x.<ext>" not followed by a word character, or 0.
// One overlapping scan of the run — the pattern /[\w.\/<>*-]*[\w>*-]\.(?:md|…)/ it replaces backtracked over the whole run from
// every start: quadratic ("a" × 40 000 took a second — full review Pb6). Same matches: a run holds at most one, from its start.
const RE_PTBR_FILE_EXT = /[\w>*-]\.(?:md|json|jsonl|js|mjs|cjs|ts|tsx|jsx|py|sh|ps1|cmd|bat|html|yml|yaml|toml|txt|lock|exe|gitignore)(?![\w])/g;
function ptbrFileEnd(run) {
  let end = 0, m;
  RE_PTBR_FILE_EXT.lastIndex = 0;
  while ((m = RE_PTBR_FILE_EXT.exec(run))) { end = m.index + m[0].length; RE_PTBR_FILE_EXT.lastIndex = m.index + 1; }
  return end;
}
function ptbrRestore(s, store) {
  let out = s, prev;
  // Nested holds (a masked arg inside a code span\u2026) take a few passes; never more than the stages that can nest.
  let pass = 0;
  do { prev = out; out = out.replace(/\uE000(\d+)\uE001/g, (m, i) => (+i < store.length ? store[+i] : m)); } while (out !== prev && out.includes(PTBR_KEEP) && ++pass < 12);
  return out;
}
// The word before offset `i` (lower-case), or "".
function ptbrPrevWord(s, i) {
  const m = s.slice(Math.max(0, i - 60), i).match(/([\p{L}]+)[ \t]*$/u);
  return m ? m[1].toLowerCase() : "";
}

// Stage 4 — imperatives at clause starts (and the coordinated ones chained to them).
function ptbrImperatives(s) {
  const hits = new Map(); // offset → [length, replacement]
  const wordAt = (p) => {
    const m = s.slice(p).match(/^([\p{L}]+)(-(?:o|a|os|as|no|na|nos|nas|lhe|lhes|me))?(?![\p{L}\p{N}_-])/u);
    return m ? { word: m[1], clitic: m[2] || "", len: m[0].length } : null;
  };
  const take = (p) => {
    const w = wordAt(p);
    if (!w) return null;
    const key = w.word.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(PTBR_IMPERATIVES, key)) return null;
    const rest = s.slice(p);
    if (RE_PTBR_NOT_IMPERATIVE.some((re) => re.test(rest))) return null;
    // A clitic after a nasal ending (põe-no, mantém-nos) is -o/-a in the Brazilian form (coloque-o, mantenha-os).
    const clitic = /[ãõ]e$|[ée]m$/u.test(key) ? w.clitic.replace(/^-n/, "-") : w.clitic;
    hits.set(p, [w.len, ptbrCase(w.word, PTBR_IMPERATIVES[key]) + clitic]);
    return p + w.len;
  };
  const sentenceEnd = (p) => {
    const m = s.slice(p).search(/[.!?;\n]|[—–→][ \t]/);
    return m < 0 ? s.length : p + m;
  };
  // The coordinated imperatives of one sentence: after "," / "e" / "ou" (/ "e depois"), up to the sentence's end (. ! ? ; :
  // a line, a top-level dash). A parenthesis is skipped whole; a relative / subordinate word ("que", "onde", "se"…) holds
  // the chain until the next comma — "o que" ("what") and "aquilo que" never do ("vê o que mudou e volta a aprovar").
  const chain = (from) => {
    const re = /[\p{L}]+(?:-(?:o|a|os|as|no|na|nos|nas|lhe|lhes|me))?|[()]|[.!?;:\n]|[—–→]|,/gu;
    re.lastIndex = from;
    let m, depth = 0, held = false, joined = false, prev = "";
    while ((m = re.exec(s))) {
      const t = m[0];
      if (t === "(") { depth++; continue; }
      if (t === ")") { if (depth) depth--; continue; }
      if (depth) continue;
      if (/^[.!?;:\n—–→]$/u.test(t)) return;
      if (t === ",") { held = false; joined = true; continue; }
      const w = t.toLowerCase();
      if (w === "e" || w === "ou" || (w === "depois" && joined)) { joined = true; prev = w; continue; }
      if (PTBR_CHAIN_STOP.has(w) && !(w === "que" && (prev === "o" || prev === "aquilo"))) { held = true; joined = false; prev = w; continue; }
      if (joined && !held) {
        const after = take(m.index);
        if (after != null) { re.lastIndex = after; joined = false; prev = w; continue; }
      }
      joined = false;
      prev = w;
    }
  };
  const visit = (p, depth) => {
    while (p < s.length && /[ \t]/.test(s[p])) p++;
    if (depth > 3 || p >= s.length) return;
    const rest = s.slice(p, p + 200);
    if (RE_PTBR_INTRO.test(rest)) { // before the lead-ins: "Depois de aprovar, corre" is an intro, "Depois corre" a lead-in
      const end = sentenceEnd(p);
      const comma = s.slice(p, end).indexOf(",");
      if (comma >= 0) visit(p + comma + 1, depth + 1);
      return;
    }
    const lead = rest.match(RE_PTBR_LEADIN);
    if (lead) return visit(p + lead[0].length, depth + 1);
    const after = take(p);
    if (after != null) chain(after);
  };
  RE_PTBR_CLAUSE.lastIndex = 0;
  let m;
  while ((m = RE_PTBR_CLAUSE.exec(s))) {
    visit(m.index + m[0].length, 0);
    if (m[0].length === 0) RE_PTBR_CLAUSE.lastIndex++;
  }
  if (!hits.size) return s;
  let out = "", last = 0;
  for (const p of [...hits.keys()].sort((a, b) => a - b)) {
    if (p < last) continue;
    const [len, rep] = hits.get(p);
    out += s.slice(last, p) + rep;
    last = p + len;
  }
  return out + s.slice(last);
}

// European Portuguese → Brazilian Portuguese. masks: strings to leave exactly as they are (a derived function's args).
function toPtBr(text, masks) {
  if (typeof text !== "string" || !text) return text;
  // The private-use sentinels are the transform's own: a text that already holds one (a planted "0" in a task
  // line or a path) is left as it is — restoring it expanded the string twice per pass until the heap ran out.
  if (text.includes(PTBR_KEEP) || text.includes(PTBR_END)) return text;
  const R = ptbrRes();
  const store = [];
  let s = ptbrProtect(text, masks || [], store);
  // 1. progressive
  s = s.replace(R.gerund, (m, a, verb, off) => {
    if (PTBR_GERUND_BLOCK.has(ptbrPrevWord(s, off))) return m;
    const v = verb.toLowerCase();
    const g = PTBR_GERUND[v] || v.replace(/ar$/, "ando").replace(/er$/, "endo").replace(/ir$/, "indo");
    return a === "A" ? g.charAt(0).toUpperCase() + g.slice(1) : g;
  });
  // 2. phrases
  s = s.replace(R.green, (m, verb, mid) => { const [v, tail] = PTBR_GREEN_VERB[verb.toLowerCase()]; return ptbrCase(verb, v) + " " + mid + tail; });
  s = s.replace(R.greenLeft, (m, plural, color) => (plural ? plural + " " + color + "s" : color));
  s = s.replace(R.tooMuch, (m, end, next) => next + " demais");
  s = s.replace(R.onDate, "$1 em "); // "fechada a <date>" → "fechada em <date>"
  s = s.replace(R.phrases, (m) => ptbrCase(m, PTBR_PHRASES[ptbrKey(m)]));
  // 3. second person
  s = s.replace(R.you, (m, pre, verb) => {
    const words = pre.trim() ? pre.trim().split(/[ \t]+/).filter((w) => w.toLowerCase() !== "tu") : [];
    const out = ["você", ...words, PTBR_YOU[verb.toLowerCase()]].join(" ");
    return ptbrCase(m, out);
  });
  s = s.replace(R.subj, (m) => ptbrCase(m, PTBR_YOU_SUBJ[m.toLowerCase()]));
  s = s.replace(R.poss, (m, art, p) => ptbrCase(art || p, PTBR_POSSESSIVE[p.toLowerCase()])); // "o teu" → "seu" (the article goes)
  // 4. imperatives, 5. words
  s = ptbrImperatives(s);
  s = s.replace(R.words, (m) => ptbrCase(m, PTBR_WORDS[ptbrKey(m)]));
  s = s.replace(R.why, (m, art, why, sp, next) => (art ? m : ptbrCase(why, next && sp ? "por que" : "por quê") + sp));
  return ptbrRestore(s, store);
}

// The caller's own strings inside a derived function's arguments (feature names, paths, user text): kept verbatim.
function ptbrArgStrings(args) {
  const out = new Set();
  const walk = (v, depth) => {
    if (out.size > 400 || depth > 4) return;
    // two letters and up (masking is whole-word: a feature slug 'tu' stays 'tu'; a lone "a" / "o" would block the grammar rules)
    if (typeof v === "string") { if (v.length >= 2 && /\p{L}/u.test(v)) out.add(v); return; }
    if (Array.isArray(v)) { for (const x of v.slice(0, 400)) walk(x, depth + 1); return; }
    if (v && typeof v === "object" && !(v instanceof RegExp)) for (const k of Object.keys(v).slice(0, 200)) walk(v[k], depth + 1);
  };
  walk(args, 0);
  return [...out].sort((a, b) => b.length - a.length);
}
const ptbrPlain = (v) => v != null && typeof v === "object" && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
// A pt value → its pt-BR twin: strings transformed, arrays / plain objects mapped, functions wrapped (their result is
// transformed with their arguments protected). `raw` (a key → true | nested raw) keeps a value exactly as pt has it.
function derivePtBr(v, raw, masks, self) {
  if (typeof v === "string") return toPtBr(v, masks);
  if (typeof v === "function") {
    const fn = v;
    return function ptBr(...args) {
      const own = ptbrArgStrings(args);
      return derivePtBr(fn.apply(self, args), null, masks && masks.length ? [...new Set([...own, ...masks])].sort((a, b) => b.length - a.length) : own);
    };
  }
  if (Array.isArray(v)) return v.map((x) => derivePtBr(x, null, masks, v));
  if (!ptbrPlain(v)) return v;
  const out = {};
  for (const k of Object.keys(v)) {
    const r = raw && raw[k];
    out[k] = r === true ? v[k] : derivePtBr(v[k], r || null, masks, v);
  }
  return out;
}
// table["pt-BR"], derived from table.pt on first use — and each top-level key only when it is read (a hook reads two or
// three of MSG's sixty groups; a process that never meets pt-BR pays nothing). patch[k](derived, pt) adjusts one group; a
// group with raw entries (raw[k] an object) and patch[k] an object of (derived, pt) => value per entry is derived entry by
// entry, each when it is read — the stop gate reads only stopGate's raw patterns, never a string toPtBr would transform.
function defineDerivedLocale(table, raw, patch) {
  let cache = null;
  const lazy = (obj, key, derive) => Object.defineProperty(obj, key, { enumerable: true, configurable: true, get() {
    const v = derive();
    Object.defineProperty(obj, key, { value: v, enumerable: true, configurable: true, writable: true });
    return v;
  } });
  const build = () => {
    const src = table.pt, out = {};
    if (!ptbrPlain(src)) return derivePtBr(src, raw, null, src);
    for (const k of Object.keys(src)) {
      const r = raw && raw[k], p = patch && patch[k];
      if (r && r !== true && typeof p !== "function" && ptbrPlain(src[k])) {
        lazy(out, k, () => {
          const g = src[k], group = {};
          for (const e of Object.keys(g)) lazy(group, e, () => {
            const v = r[e] === true ? g[e] : derivePtBr(g[e], r[e] || null, null, g);
            return p && p[e] ? p[e](v, g[e]) : v;
          });
          return group;
        });
        continue;
      }
      lazy(out, k, () => {
        let v = derivePtBr(src[k], r && r !== true ? r : null, null, src);
        if (r === true) v = src[k];
        if (p) v = p(v, src[k]);
        return v;
      });
    }
    return out;
  };
  Object.defineProperty(table, "pt-BR", { enumerable: true, configurable: true, get: () => cache || (cache = build()) });
}
// The stop gate's claim / admission patterns are REGEX sources: kept as pt has them, plus the Brazilian gerund forms.
const PTBR_STOP_EXTRA = {
  claims: [
    String.raw`tudo\s+(?:funcionando|passando|rodando)`,
    String.raw`(?:todos\s+os\s+(?:\d+\s+)?|os\s+)?testes?\s+(?:(?:já|agora|todos)\s+)*(?:est[ãa]o\s+)?passando`,
    String.raw`(?:isso|já)\s+funciona`,
  ],
  admissions: [
    String.raw`(?:não|nunca)\s+(?:(?:foi|foram|está|estão|ficou|ainda|totalmente|chegou|ser)\s+){0,2}(?:executad[oa]s?|rodad[oa]s?)`,
    String.raw`sem\s+verificar|falta\s+verificar`,
    String.raw`[1-9]\d*\s+(?:testes?\s+)?falhando`,
    String.raw`testes?\s+(?:(?:ainda|estão)\s+)*falhando`,
  ],
  passNow: [String.raw`agora\s+(?:est[ãa]o|est[áa])\s+passando`], // 1.22 review: "os 2 testes falhando agora estão passando"
};


module.exports = { PTBR_KEEP, PTBR_END, PTBR_W, PTBR_OVERRIDES, PTBR_GERUND, PTBR_GERUND_VERBS, PTBR_GERUND_BLOCK,
  PTBR_PHRASES, PTBR_GREEN_VERB, PTBR_YOU, PTBR_YOU_SUBJ, PTBR_POSSESSIVE, PTBR_IMPERATIVES, RE_PTBR_LEADIN,
  RE_PTBR_INTRO, PTBR_CHAIN_STOP, RE_PTBR_NOT_IMPERATIVE, RE_PTBR_CLAUSE, PTBR_WORDS, ptbrEscape, ptbrCase, ptbrWordRe,
  ptbrKey, ptbrRes, RE_PTBR_WORDCHAR, ptbrMaskAll, ptbrProtect, RE_PTBR_FILE_EXT, ptbrFileEnd, ptbrRestore,
  ptbrPrevWord, ptbrImperatives, toPtBr, ptbrArgStrings, ptbrPlain, derivePtBr, defineDerivedLocale, PTBR_STOP_EXTRA };
