"use strict";

/**
 * dev-spec-driven engine — the Phase 0 classifier.
 * Local and keyword based (no model, no cost): the keyword machinery (word-bounded regexes, inflections, stems, gap keywords),
 * negation, shadowing, the context / generic tiers, concepts and hazards, the generic cue mechanisms (CUE_KINDS) that interpret
 * each track's cue rules, the language guess (guessLang) — over the built-in tracks' SIGNALS (tracks.js: the data — adding or
 * tuning a track's signals never touches this file) and the project's track packs' keywords (packs.js).
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */
const fs = require("fs");
const path = require("path");
const i18n = require("../i18n.js");
const { SIGNALS } = require("./tracks.js"); // load time
// Owned by other engine modules — used at call time only; engine/index.js links them once every module has loaded.
let allTracks, forgetCached, isObj, newProjectLang, normalizeLang, OPTIONAL_TRACKS, optionalTracks, PACK_LIMITS, projectLang,
  RE_PACK_KEYWORD, readIfExists, readRoadmap, roadmapBusyResult, specsRoot, trackLabel, trackSignalTable, withRoadmapLock,
  writeFileAtomic;
function __link(E) { ({ allTracks, forgetCached, isObj, newProjectLang, normalizeLang, OPTIONAL_TRACKS, optionalTracks, PACK_LIMITS,
  projectLang, RE_PACK_KEYWORD, readIfExists, readRoadmap, roadmapBusyResult, specsRoot, trackLabel, trackSignalTable,
  withRoadmapLock, writeFileAtomic } = E); }

// ---------------------------------------------------------------------------
// Heuristic classifier (local, keyword based — no LLM, no cost)
// ---------------------------------------------------------------------------

// CUES (1.19 T review) — a built-in keyword whose tier depends on the words around it: SIGNAL_CUES[track](hit, text, cased, lang) → a new
// tier ("strong" / "weak" / "generic"), "none" (no signal at all) or null (unchanged), built below from the track's cue RULES
// (tracks.js SIGNALS[track].cues — data) by the generic mechanisms of CUE_KINDS. Built-in tracks only (a track pack's keywords are
// its own). Every rule reads a BOUNDED window around the hit (its clause / sentence, ≤ CUE_SPAN characters each way) with linear
// regexes built from its word lists (once, on the rule's first use) — the classifier stays linear in the text.
const CUE_SPAN = 200;
const CUE_BOUNDARY = /[.!?;:\n]/;
const SENTENCE_BOUNDARY = /[.!?\n]/;
// The text before the hit, back to its clause start (. ! ? ; : or a line break — `bound` picks the set), at most CUE_SPAN characters.
function cueBefore(s, start, bound) {
  const from = Math.max(0, start - CUE_SPAN);
  let i = start - 1;
  while (i >= from && !bound.test(s[i])) i--;
  return s.slice(i + 1, start);
}
function cueAfter(s, end, bound) {
  const to = Math.min(s.length, end + CUE_SPAN);
  let i = end;
  while (i < to && !bound.test(s[i])) i++;
  return s.slice(end, i);
}
const cueWords = (s) => s.match(/[\p{L}\p{N}'’-]+/gu) || [];
// The hit's CLAUSE (1.19 verify 1): the text between the CUE_BOUNDARY characters around it (≤ CUE_SPAN each way) → {from, to} —
// except that a colon after a short LABEL (≤ CUE_LABEL_WORDS words: "Profile page: the GET /me handler…", "Sin backend: nueva
// página…") joins the label to the clause it introduces, in either direction (a label is the topic of what follows it).
const CUE_LABEL_WORDS = 4;
function cueClause(s, start, end) {
  const from = Math.max(0, start - CUE_SPAN), to = Math.min(s.length, end + CUE_SPAN);
  let a = start - 1;
  while (a >= from && !CUE_BOUNDARY.test(s[a])) a--;
  let b = end;
  while (b < to && !CUE_BOUNDARY.test(s[b])) b++;
  if (a >= from && s[a] === ":") { // the clause opens after a colon: a short label before it belongs to it
    let p = a - 1;
    while (p >= from && !CUE_BOUNDARY.test(s[p])) p--;
    if (cueWords(s.slice(p + 1, a)).length <= CUE_LABEL_WORDS) a = p;
  }
  if (b < to && s[b] === ":" && cueWords(s.slice(a + 1, b)).length <= CUE_LABEL_WORDS) { // the clause IS a label: what it introduces joins
    let q = b + 1;
    while (q < to && !CUE_BOUNDARY.test(s[q])) q++;
    b = q;
  }
  return { from: a + 1, to: b };
}

// --- the cue rules (tracks.js SIGNALS[track].cues — data) → SIGNAL_CUES[track] ---
// A rule's word / phrase lists: each entry is a regex FRAGMENT (a word, "handlers?", "front-?end", "repositor(?:y|ies)" — never a
// top-level |) or a SEQUENCE of slots — [slot, …], a slot being one fragment, a list of alternatives or { optional: fragment |
// [alternatives] } — matched with one or more spaces (never a line break) between the slots. Edges: "letter" — no letter on
// either side; "word" — no letter, digit or _ on either side.
const CUE_SP = "[^\\S\\n]+";
const CUE_EDGES = { letter: ["(?<![\\p{L}])", "(?![\\p{L}])"], word: ["(?<![\\p{L}\\p{N}_])", "(?![\\p{L}\\p{N}_])"] };
const cueAlt = (a) => (Array.isArray(a) ? (a.length === 1 ? a[0] : "(?:" + a.join("|") + ")") : a);
function cueSequence(slots) {
  return slots.map((s, i) => (s && typeof s === "object" && !Array.isArray(s)
    ? "(?:" + [].concat(s.optional).map((w) => w + CUE_SP).join("|") + ")?"
    : cueAlt(s) + (i < slots.length - 1 ? CUE_SP : ""))).join("");
}
const cuePhrases = (items) => cueAlt(items.map((it) => (Array.isArray(it) ? cueSequence(it) : it)));
// (the ownership kind) a possessive ("Stripe's", "the providers'"), a Titlecase word, an organisation's ALL-CAPS acronym ("the ECB's
// public API", "la API pública del BCE" — 1.19 verify 2)
const RE_POSSESSIVE = /^(.+?)(?:['’]s|s['’])$/u;
const RE_TITLECASE = /^\p{Lu}\p{Ll}/u;
const RE_CUE_ACRONYM = /^\p{Lu}{2,6}$/u;
// The generic mechanisms a rule names (its `kind`): kind(rule) → test(hit, text, cased, lang) → false (did not fire), true (fired:
// the rule's `then`) or an outcome of its own ("strong" / "weak" / "generic" / "none" / "keep").
const CUE_KINDS = {
  // near — words right BEFORE and / or right AFTER the hit. before: { words, chars, edge? } — they end the `chars` characters before
  // the hit (spaces between — none only where no hit can start: keywordRe never matches right after a letter); edge "letter": never
  // the end of a longer word. after: { words, chars, plural? } — they start the `chars` characters after it (spaces between) and end
  // at a non-letter; plural: read from the keyword's own end, its plural ending (s / es) first ("services level").
  near(rule) {
    const b = rule.before, a = rule.after;
    const reB = b ? new RegExp((b.edge ? CUE_EDGES[b.edge][0] : "") + cuePhrases(b.words) + "[^\\S\\n]*$", "u") : null;
    const reA = a ? new RegExp((a.plural ? "^(?:s|es)?[^\\S\\n]+" : "^[^\\S\\n]*") + cuePhrases(a.words) + "(?![\\p{L}])", "u") : null;
    return (h, text) => (!!reB && reB.test(text.slice(Math.max(0, h.start - b.chars), h.start))) ||
      (!!reA && reA.test(a.plural ? text.slice(h.start + h.kw.length, h.end + a.chars) : text.slice(h.end, h.end + a.chars)));
  },
  // sentence — a phrase in the hit's SENTENCE (. ! ? or a line break, ≤ CUE_SPAN characters each way): { phrases, edge }.
  sentence(rule) {
    const re = new RegExp(CUE_EDGES[rule.edge][0] + cuePhrases(rule.phrases) + CUE_EDGES[rule.edge][1], "u");
    return (h, text) => re.test(cueBefore(text, h.start, SENTENCE_BOUNDARY) + text.slice(h.start, h.end) + cueAfter(text, h.end, SENTENCE_BOUNDARY));
  },
  // text — a phrase anywhere in the classified text: { phrases, edge } — tested once per text, not per hit (the classifier stays
  // linear in the text).
  text(rule) {
    const re = new RegExp(CUE_EDGES[rule.edge][0] + cuePhrases(rule.phrases) + CUE_EDGES[rule.edge][1], "u");
    let memoText = null, memo = false;
    return (h, text) => {
      if (text !== memoText) { memoText = text; memo = re.test(text); }
      return memo;
    };
  },
  // clause — a MENTION in the hit's CLAUSE (cueClause) that is neither negated nor consumed: it does not count when a negator
  // governs it (one of `negators` ≤ `negWindow` words before it in the clause, or a word ending n't — PT "no" is em + o, never a
  // negator in a PT text, the classifier's rule) nor when it FOLLOWS the hit with a `consumers` verb between them (the hit consumes
  // it); the hit itself is never its own mention. mention: { words — fragments; requests: { methods, targets } — an HTTP method
  // + a path (/…) or a target word; api: { words, notAfter, notBefore — phrases (fragments or sequences) } — an API word, never
  // right after a notAfter phrase nor right before a notBefore one (an API key; 1.21 F2: a public API) }.
  clause(rule) {
    const m = rule.mention, EDGE = "(?![\\p{L}\\p{N}_])";
    const alts = [];
    if (m.requests) alts.push(cueAlt(m.requests.methods) + CUE_SP + "(?:\\/|" + cueAlt(m.requests.targets) + EDGE + ")");
    if (m.words) alts.push(cueAlt(m.words) + EDGE);
    if (m.api) alts.push("(?<!(?<![\\p{L}])(?:" + cuePhrases(m.api.notAfter) + ")" + CUE_SP + ")" + cueAlt(m.api.words) + EDGE + "(?!" + CUE_SP + "(?:" + cuePhrases(m.api.notBefore) + ")(?![\\p{L}]))");
    const re = new RegExp("(?<![\\p{L}\\p{N}_])(?:" + alts.join("|") + ")", "gu");
    const negators = new Set(rule.negators), consumers = new Set(rule.consumers), win = rule.negWindow;
    return (h, text, cased, lang) => {
      const c = cueClause(text, h.start, h.end);
      const clause = text.slice(c.from, c.to);
      const pt = i18n.baseLang(lang || "en") === "pt";
      // where the first consumer verb after the hit ends (a mention after it is consumed) — one pass over the clause
      let consumedFrom = Infinity;
      const RE_WORD = /[\p{L}\p{N}'’-]+/gu;
      const tail = text.slice(h.end, c.to);
      let w;
      while ((w = RE_WORD.exec(tail)) !== null) if (consumers.has(w[0].toLowerCase())) { consumedFrom = h.end + w.index + w[0].length; break; }
      re.lastIndex = 0;
      let x;
      while ((x = re.exec(clause)) !== null) {
        const at = c.from + x.index;
        if (at < h.end && at + x[0].length > h.start) continue; // (never the hit itself)
        // the words just before it (a bounded look-back: negWindow words fit in 80 characters but for very long words)
        const before = cueWords(text.slice(Math.max(c.from, at - 80), at)).slice(-win).map((y) => y.toLowerCase());
        if (before.some((y) => (negators.has(y) && !(pt && y === "no")) || /n['’]t$/.test(y))) continue;
        if (at >= consumedFrom) continue;
        return true;
      }
      return false;
    };
  },
  // ownership — who owns an API (+api, 1.19 T review; the words and windows are the rule's — see SIGNALS.api.cues in tracks.js). A
  // rule of its own kind, not a table: possessives, a consumer verb governing the phrase, "the <Name> <phrase>", a build verb's
  // direct object and an API-kind name opening its clause are word ORDER, not word lists. → "generic" (someone else's API),
  // "strong" (an ambiguous name that is ours) or "keep".
  ownership(rule) {
    const S = (a) => new Set(a), whole = (a) => new RegExp("^(?:" + a.join("|") + ")$", "u");
    const ambiguous = S(rule.ambiguous), kinds = S(rule.kinds), ownNames = S(rule.ownNames), thirdParty = S(rule.thirdParty),
      ownWords = S(rule.ownWords), articles = S(rule.articles), linkWords = S([...rule.articles, ...rule.linkWords]), notOwner = S(rule.notOwner),
      techAcronyms = S(rule.techAcronyms), determiners = S(rule.determiners), possessives = S(rule.possessives), versionWords = S(rule.versionWords),
      nameArticles = S(rule.nameArticles);
    const ownVerbRe = whole(rule.ownVerbs), buildVerbRe = whole(rule.buildVerbs), consumerVerbRe = whole(rule.consumerVerbs);
    const ownerAfterRe = new RegExp("^\\s+(?:" + rule.ownerAfter.links.join("|") + ")(?:\\s+(?:" + rule.ownerAfter.articles.join("|") +
      "))?\\s+([\\p{L}][\\p{L}\\p{N}-]*)", "u");
    const W = rule.window;
    // an owner: a Titlecase word, a third-party noun or an organisation's acronym — never a technical acronym ("the REST API of the
    // CRM") nor a word that only looks like one ("It's", "the Public REST API", "the New API version")
    const owner = (w) => !notOwner.has(w.toLowerCase()) && (RE_TITLECASE.test(w) || thirdParty.has(w.toLowerCase()) ||
      (RE_CUE_ACRONYM.test(w) && !techAcronyms.has(w.toLowerCase())));
    // a consumer verb governs the phrase: between them nothing but link words, Titlecase names and at most verbGap other words
    // ("Integrate with the Salesforce REST API", "Llamar a la API REST del banco") — never "the order service calls the payment
    // service over gRPC" (the verb's object is the service)
    const consumerGoverns = (before, lower) => {
      let other = 0;
      for (let i = lower.length - 1; i >= 0 && i >= lower.length - W.verbReach; i--) {
        if (consumerVerbRe.test(lower[i])) return true;
        if (linkWords.has(lower[i]) || RE_TITLECASE.test(before[i])) continue;
        if (++other > W.verbGap) return false;
      }
      return false;
    };
    return (h, text, cased) => {
      const before = cueWords(cueBefore(cased, h.start, CUE_BOUNDARY));
      const lower = before.map((w) => w.toLowerCase());
      const near = before.slice(-W.near), nearLower = lower.slice(-W.near);
      // a third party named at the API phrase: "Stripe's REST API", "the provider's OpenAPI spec", "their API", "a API REST do Stripe"
      const possessed = near.some((w) => { const p = RE_POSSESSIVE.exec(w); return !!p && owner(p[1]); }) || nearLower.some((w) => possessives.has(w));
      const post = ownerAfterRe.exec(cased.slice(h.end, Math.min(cased.length, h.end + W.ownerReach)));
      if (possessed || (post && owner(post[1]))) return "generic";
      const n = lower.length;
      // a past participle right after a determiner is an adjective, never an own verb ("Replace the deprecated Google Places API calls")
      const ownVerb = (w, i) => ownVerbRe.test(w) && !(/ed$/.test(w) && i > 0 && determiners.has(lower[i - 1]));
      // a build verb is an own cue only when the API phrase is its direct object ("Build a REST API", "Criar uma API REST pública") —
      // never "Create payment intents via the Stripe REST API"
      const own = nearLower.some((w) => ownWords.has(w)) || lower.some(ownVerb) || (n > 0 && versionWords.has(lower[0])) ||
        (n > 0 && buildVerbRe.test(lower[n - 1])) || (n > 1 && articles.has(lower[n - 1]) && buildVerbRe.test(lower[n - 2]));
      if (!own && !ownNames.has(h.kw)) {
        // a consumer verb governing the API phrase ("Integrate with the Salesforce REST API", "Book the courier through the partner API")
        if (consumerGoverns(before, lower)) return "generic";
        // "the <Name> <API phrase>" — "the Shopify API version", "the Google Maps JSON API"
        let k = before.length;
        while (k > 0 && before.length - k < W.names && RE_TITLECASE.test(before[k - 1]) && !notOwner.has(before[k - 1].toLowerCase())) k--;
        if (k < before.length && k > 0 && nameArticles.has(lower[k - 1])) return "generic";
      }
      if (!ambiguous.has(h.kw)) return "keep";
      if (own) return "strong";
      // an API-kind name with no owner named is ours when it opens its clause or follows a plain determiner, adjectives allowed ("REST
      // API for the mobile app…", "Add rate limiting to the public API", "a versioned REST API", "Uma API pública para os parceiros"):
      // a third party's is named first ("Stripe REST API integration", "the shipping provider REST API" stay weak)
      if (!kinds.has(h.kw)) return "keep";
      let j = n, adj = 0;
      while (j > 0 && adj < W.adjectives && /^\p{Ll}+$/u.test(before[j - 1]) && !linkWords.has(lower[j - 1]) && !thirdParty.has(lower[j - 1])) { j--; adj++; }
      return j === 0 || articles.has(lower[j - 1]) ? "strong" : "keep";
    };
  },
  // all (1.21 F2) — every rule of `rules` fires (each a rule of any other kind, without on / ifTier / then: the enclosing rule's
  // apply): "our API" + a version in the sentence. Each sub-rule reads its own bounded window — still linear.
  all(rule) {
    const tests = rule.rules.map((r) => CUE_KINDS[r.kind](r));
    return (h, text, cased, lang) => tests.every((t) => t(h, text, cased, lang) !== false);
  },
};
// A rule's kind — and every sub-rule's kind (the `all` kind) — must be a CUE_KINDS entry.
function checkCueKinds(r, track) {
  if (!r || !Object.prototype.hasOwnProperty.call(CUE_KINDS, r.kind)) throw new Error("engine: SIGNALS." + track + ".cues — unknown kind " + (r && r.kind));
  if (r.kind === "all") {
    if (!Array.isArray(r.rules) || !r.rules.length) throw new Error("engine: SIGNALS." + track + ".cues — an 'all' rule needs rules");
    r.rules.forEach((x) => checkCueKinds(x, track));
  }
}
// A track's cue rules → its SIGNAL_CUES function: the rules are tried in order (a rule reads the keywords of its `on` — none: every
// keyword — and, with `ifTier`, a hit of that tier only); the first that fires decides — "keep" is null (unchanged). A rule naming
// an unknown kind is an error while the engine loads (a table typo never passes silently); its test — its regexes — is built on
// its first use, never while the engine loads (every hook and CLI call is a fresh process that loads the engine).
function cueRules(rules, track) {
  const compiled = rules.map((r) => {
    checkCueKinds(r, track);
    return { on: r.on ? new Set(r.on) : null, ifTier: r.ifTier || null, rule: r, test: null, then: r.then };
  });
  return function cues(h, text, cased, lang) {
    for (const r of compiled) {
      if ((r.on && !r.on.has(h.kw)) || (r.ifTier && h.tier !== r.ifTier)) continue;
      if (!r.test) r.test = CUE_KINDS[r.rule.kind](r.rule);
      const out = r.test(h, text, cased, lang);
      if (out === false) continue;
      const tier = out === true ? r.then : out;
      return tier === "keep" ? null : tier;
    }
    return null;
  };
}
// The per-track lookups the classifier reads, built once from the tables: SIGNAL_CONCEPTS[track] (keyword → concept),
// SIGNAL_HAZARDS[track] (a Set), SIGNAL_CUES[track](hit, text, cased, lang) — for the built-in tracks that have them.
const conceptMap = (groups) => new Map(Object.entries(groups).flatMap(([c, kws]) => kws.map((k) => [k, c])));
const signalLookup = (key, build) => Object.fromEntries(Object.entries(SIGNALS).filter(([, s]) => s[key]).map(([t, s]) => [t, build(s[key], t)]));
const SIGNAL_CONCEPTS = signalLookup("concepts", conceptMap);
const SIGNAL_HAZARDS = signalLookup("hazards", (list) => new Set(list));
const SIGNAL_CUES = signalLookup("cues", cueRules);
const SIGNAL_EVERYDAY = signalLookup("everydayAnchors", (list) => new Set(list)); // (1.21 verify V3 — see backedBy in classify())

// Words that negate a signal when they appear just before the keyword (EN/PT/ES). 1.21 F2: the negative conjunctions too —
// "nor" / "neither", PT "nem", ES "ni" ("sem X nem Y", "ni X ni Y": each item they introduce is negated).
const NEGATORS = ["no", "not", "without", "never", "skip", "exclude", "avoid", "omit", "dispensa", "prescinde", "sem", "não", "nao", "sin",
  "nor", "neither", "nem", "ni"];

// Words that may sit between a negator and the keyword ("sem uso de IA", "without the use of any LLM").
const NEG_FILLER = new Set(["uso", "use", "usage", "of", "de", "do", "da", "del", "the", "a", "an", "any", "qualquer", "nenhum", "nenhuma", "ningún", "ninguna", "ningun", "el", "la", "o"]);
// The English ones — the only fillers a wide "no" may negate across (see isNegated).
const NEG_FILLER_EN = new Set(["use", "usage", "of", "the", "a", "an", "any"]);

// Phrases that negate a signal shortly AFTER the keyword ("auth is not needed", "auth não é preciso").
const NEG_AFTER = /^\s*(\w+\s+)?(is |are |isn'?t |aren'?t |won'?t |é |são |sao |es |no )?(not (needed|required|necessary|used)|n[ãa]o (é |e )?(preciso|necess[áa]ri[ao]|usad[ao])|no (es )?necesari[ao]|no hace falta)\b/;

// Which language a description is written in, from function words only EN/PT/ES use. Needed for
// "no": a negator in EN ("no LLM") and ES ("no usa LLM"), but in PT it is the contraction em+o —
// "desconto aplicado no checkout" is IN the checkout (PT negates with não/sem).
// Only UNAMBIGUOUS markers: "do", "da", "com", "usa", "los", "del", "con"… also occur in English text
// ("Do the export", "example.com", "USA offices", "Las Vegas") and flipped negation + reasoning language.
// STRONG markers (weight 2) never occur in English; WEAK ones (weight 1) are common PT/ES function words
// that English only uses by accident ("de", "por"). Deliberately absent: "no", "o", "a", "as", "do",
// "usa", "los"… — they appear in ordinary English ("Do the export", "USA offices", "Las Vegas").
const W = (words) => new RegExp("(?<![\\p{L}.])(" + words + ")(?![\\p{L}])", "giu");
// Brazilian Portuguese (1.14 D1) counts as Portuguese: você / usuário / arquivo / cadastro / senha are PT-only words
// ("usuario" without the accent and "archivo" are Spanish); "tela" (screen — ES: fabric) and "equipe" are weak. The guess
// is still 'pt' — only an explicit lang: "pt-BR" makes the classifier answer in Brazilian Portuguese.
const PT_STRONG = W("n[ãa]o|uma|umas|pelo|pela|pelos|também|tambem|você|voce|vocês|isso|isto|então|entao|ainda|quando|onde|deve|devem|utilizador|utilizadores|usuário|usuários|arquivo|arquivos|cadastro|cadastrar|senha|senhas|sem");
const PT_STRONG_CHARS = /ç[ãa]o|ções|[ãõç]/giu;
const PT_WEAK = W("com|um|por|para|de|da|dos|das|que|na|tela|telas|equipe");
const ES_STRONG = W("una|unos|pero|también|tambien|usted|esto|eso|entonces|todavía|cuando|donde|debe|deben|usuario|usuarios|sin|sólo");
const ES_STRONG_CHARS = /ción|ciones|ñ/giu;
const ES_WEAK = W("con|un|por|para|de|del|el|la|las|que|en|solo");
const EN_WORDS = W("the|and|with|for|of|is|are|to|an|in|on|by|from|that|this|it|should|must|when|without");
// 1.17 D review: a PT / ES INFINITIVE opening a clause — the form a PT / ES requirement line starts with ("Publicar eventos no
// Kafka.", "Gravar o pedido no Postgres e …"): a short line with no other marker read as English, and "no" (PT em + o) as a
// negator. Only at a clause start (the text's start, after . ! ? ; : or a line break, or a list bullet) and followed by its
// object (a word on the same line — a UI label list "Guardar, Enviar, Cancelar" or "Enviar. Pagar." is no clause), a STRONG
// marker (2) — and only in a text with no English function word (1.17 verification N1: "Spanish labels: …" is English).
// PT_INF / ES_INF hold verbs that exist in ONE language only; a verb both languages have (alterar, excluir, mudar, apagar,
// agregar, cambiar…) is in PTES_INF and counts for both — it tells PT / ES from English, never PT from ES (a tie is PT, or the
// project's language when that is ES). None is an English word ("remover", "registrar", "leer" are left out: an English noun /
// verb). CLAUSE_START is linear: the spaces after a start never cross a line break (`\s*` there re-read a whole run of blank
// lines from each of its line breaks — quadratic; 1.17 verification N2).
const CLAUSE_START = "(?:^|[.!?;:\\n]|[-*+•]\\s)[^\\S\\n]*";
const INF_WORDS = {
  pt: "atualizar|gerar|escrever|armazenar|receber|manter|processar|reprocessar|obter|corrigir|melhorar|exibir|carregar|descarregar|baixar",
  es: "crear|escribir|actualizar|añadir|generar|almacenar|recibir|mantener|procesar|reprocesar|sustituir|obtener|comprobar|corregir|mejorar|cargar|descargar|reintentar",
  both: "publicar|enviar|guardar|consumir|notificar|validar|eliminar|mostrar|permitir|implementar|integrar|calcular|sincronizar|exportar|importar|listar|editar|bloquear|usar|pagar|cobrar|evitar|configurar|definir|verificar|migrar|filtrar|ordenar|buscar|" +
    "criar|gravar|adicionar|apagar|substituir|excluir|alterar|mudar|testar|agregar|borrar|cambiar",
};
const INF = (words) => new RegExp(CLAUSE_START + "(" + words + ")(?=[^\\S\\n]+[\\p{L}\\p{N}\"'`“«(])", "giu");
const PT_INF = INF(INF_WORDS.pt);
const ES_INF = INF(INF_WORDS.es);
const PTES_INF = INF(INF_WORDS.both);
// "no" + an infinitive is Spanish ("no usar LLM", "No enviar correos"): Portuguese negates with "não" (and its "no" = em + o
// never precedes an infinitive). A STRONG ES marker (1.17 verification N1: "Adicionar productos al carrito, no usar LLM." read PT).
const ES_NO_INF = new RegExp("(?<![\\p{L}\\p{N}_])no[^\\S\\n]+(" + INF_WORDS.es + "|" + INF_WORDS.both + ")(?![\\p{L}\\p{N}_])", "giu");
// fallback (full review Pb2 — an imported source): the project's language, used when the text shows no language of its own
// (no PT/ES marker to speak of and fewer than two English function words) — and its variant (pt-BR) when the text is in
// its family. Without it the answer is the plain guess ('en' when nothing says otherwise).
function guessLang(text, fallback) {
  const distinct = (re) => new Set((text.match(re) || []).map((m) => m.toLowerCase())).size;
  const distinctInf = (re) => new Set(Array.from(text.matchAll(re), (m) => m[1].toLowerCase())).size;
  const en = distinct(EN_WORDS);
  // clause-start infinitives only in a text without English function words (1.17 verification N1)
  const inf = (re) => (en ? 0 : distinctInf(re));
  const shared = inf(PTES_INF);
  const pt = 2 * (distinct(PT_STRONG) + distinct(PT_STRONG_CHARS) + inf(PT_INF) + shared) + distinct(PT_WEAK);
  const es = 2 * (distinct(ES_STRONG) + distinct(ES_STRONG_CHARS) + inf(ES_INF) + shared + distinctInf(ES_NO_INF)) + distinct(ES_WEAK);
  const best = Math.max(pt, es);
  const f = fallback ? normalizeLang(fallback) : null;
  // a PT / ES tie (a shared verb, "de", "para"…) is PT — unless the project's language is Spanish
  const tieEs = pt === es && f !== null && i18n.baseLang(f) === "es";
  const g = best < 2 || best <= en ? "en" : pt > es || (pt === es && !tieEs) ? "pt" : "es";
  if (!f) return g;
  if (i18n.baseLang(f) === g) return f;
  return g === "en" && best < 2 && en < 2 ? f : g;
}
// The language the classifier reads a NEW feature's summary in (full review Pb2): the explicit one, else the project's
// configured language (roadmap.json meta.lang, set by spec_init) — the language the feature is written in. Never the 'en'
// fallback: a project without meta.lang keeps the guess. ("Corrigir o cálculo do IVA no checkout" in a PT project read
// 'no' as a negator — the guess said 'en' — and kept +tdd off.)
function configuredLang(projectDir, lang) {
  if (lang) return lang;
  const l = (readRoadmap(projectDir).meta || {}).lang;
  // 1.16 C2: a brand-new project without meta.lang reads it in the user's DEFAULT_LANG option, the language it is about to get.
  return typeof l === "string" && l.trim() ? normalizeLang(l) : projectDir ? newProjectLang(projectDir) : undefined;
}

function isNegated(text, idx, kwLen, lang, cased) {
  return negatedBefore(text, idx, lang, cased) || negatedAfter(text, idx, kwLen);
}
// "<keyword> ... not needed/required" shortly after.
function negatedAfter(text, idx, kwLen) {
  const after = text.slice(idx + (kwLen || 0), idx + (kwLen || 0) + 30).toLowerCase();
  return NEG_AFTER.test(after);
}
// A negator BEFORE the match — the negation a coordinated list carries on to its next items (coordinatedNegation).
function negatedBefore(text, idx, lang, cased) {
  return negatorBefore(text, idx, lang, cased) !== null;
}
// The negator that negates the match at idx from BEFORE it (the word, lower-case) — or null.
function negatorBefore(text, idx, lang, cased) {
  // Negator token in the 1-2 words immediately before the match.
  const before = text.slice(Math.max(0, idx - 20), idx).toLowerCase();
  const tokens = before.split(/[^a-zà-ú-]+/).filter(Boolean);
  const pt = i18n.baseLang(lang) === "pt"; // pt and pt-BR alike: "no" is em+o, never a negator
  const negators = pt ? NEGATORS.filter((w) => w !== "no") : NEGATORS;
  // "aplicado no checkout" / "guardado na sessão": after a participle, "no"/"na" is PT em+o, even in a
  // phrase too short for guessLang to see Portuguese.
  const prev = tokens[tokens.length - 2] || "";
  const prevCased = ((cased || "").slice(Math.max(0, idx - 20), idx).split(/[^\p{L}-]+/u).filter(Boolean).slice(-2)[0]) || "";
  const contraction = tokens[tokens.length - 1] === "no" && /(?:ad|id)[oa]s?$/.test(prev) &&
    (pt || (prev.length >= 6 && prevCased === prevCased.toLowerCase()));
  const wide = text.slice(Math.max(0, idx - 40), idx).toLowerCase().split(/[^a-zà-ú-]+/).filter(Boolean);
  if (!contraction) {
    const t1 = tokens[tokens.length - 1], t2 = tokens[tokens.length - 2];
    if (t1 && negators.includes(t1)) return t1;
    // 1.21 review B1: a negative conjunction (nor / nem / ni) negates the word right after it only — "nem duplicar faturas",
    // "nor duplicate invoices" negate the verb (a second predicate), never its object. 1.21 verify V5: nor does a negator whose
    // verb is a requirement's (negationKind) — "The system must not lose payments" keeps its payments, as PT "não pode perder
    // pagamentos" always did; "we will not add payments", "do not store card numbers" still exclude.
    if (t2 && negators.includes(t2) && !LIST_NEG.has(t2)) {
      const j = wide.length - 2;
      if (!(j >= 0 && wide[j] === t2 && wide[j + 1] === t1 && negationKind(wide, j, wide.length, lang).kind === "require")) return t2;
    }
  }
  // "sem uso de IA", "sin uso de IA", "no use of AI", "without the use of any AI": a negator a few filler words
  // back still negates — weak signals included (a lone 'ia' used to come back as "Possible +ai").
  let k = wide.length - 1;
  while (k >= 0 && NEG_FILLER.has(wide[k])) k--;
  // Across fillers, "no" negates only before an ENGLISH filler ("no use of AI"): before a PT one it is the
  // contraction em+o — "Guia no uso do LLM" is a guide IN the use of the LLM, even when guessLang says 'en'.
  const noContraction = wide[k] === "no" && !NEG_FILLER_EN.has(wide[k + 1]);
  return k < wide.length - 1 && k >= 0 && negators.includes(wide[k]) && !noContraction ? wide[k] : null; // only across at least one filler word
}

// COORDINATED NEGATION (1.21 F2): a negation reaches every item of the coordinated list it opens, in its clause, for every track
// — "We will not add feature flags or canary releases", "Não vamos usar feature flags nem lançamento canário", "No usaremos
// feature flags ni despliegue canario", "without Kafka, RabbitMQ or SQS". The items are the matched keywords (every track;
// overlapping matches are one item); two items are coordinated when the text between them is a LIST LINK: a conjunction (or /
// nor / ou / nem / ni, ES o / u) with at most one other word ("or any", "nem outro"), or a comma with articles only — a
// comma-joined item counts only once a conjunction closes the list later ("no X, Y or Z"; "Without feature flags, the canary
// release…" is no list). Never across . ! ? ; : or a line break, "and" / "e" / "y" (often a new predicate: "without downtime and
// roll back on errors"), a contrast word ("no X, just Y", "sem X, apenas Y", "not X but Y") or a longer gap; a hazard's negation
// (its requirement: "without downtime") opens no list. A negative conjunction (nor / nem / ni) also negates the item BEFORE it
// when a negator GOVERNS that item ("Não vamos usar X nem Y" — the negator three words back). 1.21 review: a list opens only at an
// item its negator governs (negationGoverns — "must not lose payments or refunds" negates the verb: no list; B1); a comma after
// the list's closing conjunction, or one before an article, ends it (B2: "Without an LLM or embeddings, the checkout or …"). Linear:
// each gap between two consecutive items is read at most twice, and bounded (LIST_GAP_MAX characters).
const LIST_GAP_MAX = 80;
const LIST_OR = new Set(["or", "nor", "ou", "nem", "ni"]);
const LIST_OR_ES = new Set(["o", "u"]); // ES "or" (PT "o" is an article)
const LIST_NEG = new Set(["nor", "nem", "ni"]);
const LIST_AND = new Set(["and", "e", "y"]);
const LIST_FILLER = new Set(["a", "an", "the", "any", "other", "some", "no", "not", "without", "never", "um", "uma", "o", "os", "as", "qualquer",
  "nenhum", "nenhuma", "outro", "outra", "outros", "outras", "sem", "não", "nao", "un", "una", "unos", "unas", "el", "la", "los", "las", "ningún",
  "ninguna", "ningun", "otro", "otra", "otros", "otras", "sin", "neither", "either"]);
const LIST_CONTRAST = new Set(["but", "just", "only", "instead", "rather", "except", "besides", "although", "though", "while", "whereas", "yet",
  "so", "then", "which", "that", "who", "because", "since", "when", "if", "unless", "until", "mas", "porém", "contudo", "apenas", "só",
  "somente", "sim", "exceto", "salvo", "embora", "enquanto", "porque", "que", "quando", "se", "pero", "sino", "sólo", "solo", "solamente",
  "excepto", "aunque", "mientras", "cuando", "si"]);
const LIST_BOUNDARY = /[.!?;:\n]/;
// The link between two consecutive items: "or" (a conjunction), "neg" (a negative one), "and", "comma" — or null (no list link).
function listLink(text, from, to, es) {
  if (to - from > LIST_GAP_MAX) return null;
  const gap = text.slice(from, to);
  if (LIST_BOUNDARY.test(gap)) return null;
  const words = gap.match(/[\p{L}\p{N}'’-]+/gu) || [];
  if (words.length > 4) return null;
  let or = null, other = 0;
  for (const w0 of words) {
    const w = w0.toLowerCase();
    // "and" / "e" / "y" end the list: often a new predicate ("without downtime and roll back on errors", "don't store PII and
    // encrypt the rest") — the negation stops there
    if (LIST_CONTRAST.has(w) || LIST_AND.has(w)) return null;
    if (LIST_OR.has(w) || (es && LIST_OR_ES.has(w))) { if (!or || LIST_NEG.has(w)) or = LIST_NEG.has(w) ? "neg" : "or"; }
    else if (!LIST_FILLER.has(w)) other++;
  }
  if (or) return other <= 1 ? or : null;
  return gap.includes(",") && other === 0 ? "comma" : null;
}
// WHAT A NEGATION NEGATES (1.21 review B1, 1.21 verify V1 / V5) — negationKind(): the words after a negator decide whether it
// EXCLUDES what follows (a noun phrase, an adoption verb's object, the verb of a plan or an intention) or states a REQUIREMENT about
// it (a deontic modal's verb, a verb form after a nominal negator):
//   - "no X", "sem X", "without the use of any X", "no new X", "Postgres, not MongoDB" — a noun phrase: exclude;
//   - an ADOPTION verb (GOVERN_ADOPT: use / add / need / include / implement / integrate / deploy / run / offer / provide / ship /
//     create / adopt, "necessary", + PT / ES) — its object is what is left out, whatever the modal: "will not add X", "must not use
//     X", "Não vamos integrar X", "No es necesario X": exclude;
//   - a DEONTIC modal (GOVERN_DEONTIC: must / shall / should / can / may, cannot / can't / mustn't; pode / deve; puede / debe) before
//     another verb — "must not lose X", "não pode perder X", "no debe perder X", "must never leak X": the requirement about X (like a
//     hazard's negation), never an exclusion of X;
//   - a plain AUXILIARY or a volition / intention verb (GOVERN_AUX: will / do / is, vamos / iremos / queremos / pretendemos /
//     planeamos, vamos / queremos / pensamos / se / hace…) before another verb — a plan: "We will not run X", "Não queremos X",
//     "No pensamos desplegar X": exclude;
//   - no auxiliary at all: a verb FORM (-ing, a PT / ES infinitive or gerund) is a requirement ("without losing X", "sem perder X",
//     "não perder X"), any other word a noun (exclude — the 1.20 reading).
// → { kind: "exclude" | "require", others } — `others`: the words between the negator and the end that are neither fillers, nor
// modifiers, nor auxiliaries, nor adoption verbs. words: lower-case, from the negator (at j) to the item (end, exclusive). Linear.
const GOVERN_MAX = 5;
const GOVERN_BOUNDARY = /[.!?;:,\n]/;
const GOVERN_DEONTIC = new Set(["must", "shall", "should", "can", "could", "may", "might", "cannot", "pode", "podem", "poderá", "poderão", "deve",
  "devem", "deverá", "deverão", "debe", "deben", "deberá", "deberán", "puede", "pueden", "podrá", "podrán"]);
// the stem of a contracted negator: can't → "ca", mustn't → "must", shouldn't, shan't → "sha" (won't / don't / doesn't: a plain auxiliary)
const NT_DEONTIC = new Set(["ca", "can", "must", "should", "could", "might", "may", "sha"]);
const GOVERN_AUX = new Set([
  "will", "would", "do", "does", "did", "be", "is", "are", "was", "were", "been", "going", "intend", "intends", "plan", "plans", "planning",
  "want", "wants", "wish", "vamos", "vai", "vão", "iremos", "irá", "irão", "será", "serão", "é", "são", "ser", "queremos", "quero", "quer",
  "querem", "querer", "pretendemos", "pretendo", "pretende", "pretendem", "pretender", "planeamos", "planeio", "planeia", "planejamos",
  "planeja", "planejam", "tencionamos", "tenciona", "va", "van", "es", "son", "se", "hace", "faz", "quiero", "quiere", "quieren",
  "pensamos", "pienso", "piensa", "piensan", "planeo", "planea", "planean", "tenemos", "previsto",
]);
const GOVERN_ADOPT = new Set([
  "need", "needs", "needed", "require", "requires", "required", "use", "uses", "using", "add", "adds", "adding", "build", "builds", "building",
  "include", "includes", "including", "introduce", "introduces", "introducing", "implement", "implements", "implementing", "support",
  "supports", "supporting", "have", "has", "having", "adopt", "adopts", "adopting", "rely", "relying", "depend", "depends", "depending",
  "set", "integrate", "integrates", "integrating", "deploy", "deploys", "deploying", "run", "runs", "running", "offer", "offers",
  "offering", "provide", "provides", "providing", "ship", "ships", "create", "creates", "creating", "necessary",
  // PT
  "precisa", "precisam", "precisamos", "precisar", "preciso", "necessita", "necessitam", "necessitamos", "necessitar", "necessário",
  "necessária", "necessários", "necessárias", "necessidade", "falta", "usar", "usa", "usam", "usamos", "usará", "usarão", "usaremos",
  "utilizar", "utiliza", "utilizam", "utilizamos", "utilizará", "utilizaremos", "adicionar", "adiciona", "adicionamos", "adicionaremos",
  "acrescentar", "acrescentamos", "incluir", "inclui", "incluem", "incluímos", "incluiremos", "implementar", "implementamos",
  "implementaremos", "introduzir", "ter", "tem", "têm", "temos", "terá", "teremos", "haver", "há", "haverá", "suportar", "suporta",
  "depender", "depende", "dependemos", "recorrer", "integrar", "integra", "integramos", "integraremos", "adotar", "adota", "adotamos",
  "adotaremos", "implantar", "implanta", "implantamos", "implantaremos", "oferecer", "oferece", "oferecemos", "ofereceremos", "fornecer",
  "fornece", "fornecemos", "forneceremos", "disponibilizar", "disponibilizamos", "criar", "cria", "criamos", "criaremos",
  // ES
  "necesita", "necesitan", "necesitamos", "necesitará", "necesitar", "necesario", "necesaria", "necesarios", "necesarias", "necesidad",
  "usan", "usará", "utilizan", "añadir", "añade", "añadimos", "añadiremos", "agregar", "agrega", "agregamos", "agregaremos", "incluye",
  "incluimos", "introducir", "tener", "tiene", "tienen", "tendrá", "tendremos", "hay", "habrá", "haber", "requiere", "requieren",
  "requerirá", "recurrir", "soportar", "soporta", "integramos", "adoptar", "adopta", "adoptamos", "adoptaremos", "desplegar", "despliega",
  "desplegamos", "desplegaremos", "ofrecer", "ofrece", "ofrecemos", "ofreceremos", "proporcionar", "proporciona", "proporcionamos",
  "proporcionaremos", "crear", "crea", "creamos", "crearemos",
]);
const GOVERN_NEUTRAL = new Set(["on", "for", "to", "up", "yet", "new", "more", "extra", "additional", "external", "separate", "third-party", "ao",
  "novo", "nova", "novos", "novas", "mais", "adicional", "adicionais", "nuevo", "nueva", "nuevos", "nuevas", "más", "adicionales"]);
const isNegatorWord = (w, pt) => (NEGATORS.includes(w) && !(pt && w === "no")) || /n['’]t$/.test(w);
const verbForm = (w, ptes) => (w.length > 4 && /ing$/.test(w)) || (ptes && /(?:[aei]r|ndo)$/.test(w));
const passWord = (w) => NEG_FILLER.has(w) || LIST_FILLER.has(w) || GOVERN_NEUTRAL.has(w);
function negationKind(words, j, end, lang) {
  const base = i18n.baseLang(lang), ptes = base === "pt" || base === "es";
  const w = words[j];
  let deontic = false, aux = false;
  if (/n['’]t$/.test(w)) { if (NT_DEONTIC.has(w.replace(/n['’]t$/, ""))) deontic = true; else aux = true; }
  else if (w === "cannot") deontic = true;
  else if (j > 0 && GOVERN_DEONTIC.has(words[j - 1])) deontic = true; // "must not", "should never"
  else if (j > 0 && GOVERN_AUX.has(words[j - 1])) aux = true; // "will not", "does not"
  let kind = null, others = 0;
  for (let i = j + 1; i < end; i++) {
    const x = words[i];
    if (LIST_NEG.has(x)) break;
    if (passWord(x)) continue;
    if (GOVERN_ADOPT.has(x)) { if (!kind) kind = "exclude"; continue; }
    if (!kind && GOVERN_DEONTIC.has(x)) { deontic = true; continue; }
    if (!kind && GOVERN_AUX.has(x)) { aux = true; continue; }
    others++;
    // the first other word decides: a deontic modal's verb, or a bare verb form, is a requirement; anything else is excluded
    if (!kind) kind = deontic || (!aux && verbForm(x, ptes)) ? "require" : "exclude";
  }
  return { kind: kind || "exclude", others };
}
// Does a negator GOVERN the item at `start` — an EXCLUSION of it (negationKind), with at most one other word between them, in the same
// clause and comma-free stretch, ≤ GOVERN_MAX words back? A negative conjunction governs only the phrase right after it (fillers
// between). "No X", "will not add X", "Não queremos X", "No es necesario X", "without real-time X" — yes; "must not lose X", "não pode
// perder X", "without losing X" — no: they open no list.
// the clause's words before `start`, lower-case, a quote's apostrophes dropped ("'not add X or Y'")
const govWords = (text, start, bound) => cueWords(cueBefore(text, start, bound)).map((w) => w.toLowerCase().replace(/^['’]+|['’]+$/g, "")).filter(Boolean);
function negationGoverns(text, start, lang) {
  const pt = i18n.baseLang(lang) === "pt";
  const words = govWords(text, start, GOVERN_BOUNDARY);
  for (let i = words.length - 1, n = 0; i >= 0 && n <= GOVERN_MAX; i--, n++) {
    if (!isNegatorWord(words[i], pt)) continue;
    if (LIST_NEG.has(words[i])) return words.slice(i + 1).every(passWord);
    const k = negationKind(words, i, words.length, lang);
    return k.kind === "exclude" && k.others <= 1;
  }
  return false;
}
// Does the clause's negator (the last one before `start` that is no negative conjunction — "cannot" too) state a REQUIREMENT
// (negationKind) — which a negative conjunction then continues ("Não pode perder pagamentos nem reembolsos", "must not lose data nor
// refunds", "sem perder dados nem reembolsos")? Not an exclusion ("Não queremos Kafka nem RabbitMQ", "We use Postgres, not MongoDB nor
// Kafka"), nor a clause with only the correlative "nem … nem" / "ni … ni".
function negatedVerb(text, start, lang) {
  const pt = i18n.baseLang(lang) === "pt";
  const words = govWords(text, start, CUE_BOUNDARY);
  let j = words.length - 1;
  while (j >= 0 && !((isNegatorWord(words[j], pt) || words[j] === "cannot") && !LIST_NEG.has(words[j]))) j--;
  return j >= 0 && negationKind(words, j, words.length, lang).kind === "require";
}
// The article a new clause's subject starts with (1.21 review B2): a comma followed by one is no list continuation — "Without an LLM
// or embeddings, the checkout or a subscription page is the priority".
const LIST_ARTICLES = new Set(["the", "a", "an", "o", "os", "as", "um", "uma", "el", "la", "los", "las", "un", "una"]);
// hits: the counted (non-shadowed) matches, each with `negBy` ("before" / "after" / null) — marks `neg` on the list items a negation
// reaches (never a hazard: `hazard` stays un-negated, but it still carries the list on).
function coordinatedNegation(hits, text, lang) {
  if (hits.length < 2 && !(hits.length && hits[0].conj)) return;
  const es = i18n.baseLang(lang) === "es";
  const sorted = hits.slice().sort((a, b) => a.start - b.start || b.end - a.end);
  const items = [];
  for (const h of sorted) {
    const last = items[items.length - 1];
    if (last && h.start < last.end) { last.hits.push(h); if (h.end > last.end) last.end = h.end; } else items.push({ start: h.start, end: h.end, hits: [h] });
  }
  // a negator negates the whole phrase it precedes — the keywords inside it too ("nem iniciar sessão", "sem iniciar sessão": 'sessão',
  // whose own look-back now sees a verb form, 1.21 verify V5)
  for (const it of items) {
    const head = it.hits.find((h) => h.start === it.start && h.negBy === "before" && !h.hazard);
    if (!head) continue;
    for (const h of it.hits) if (!h.negBy && !h.hazard) { h.neg = true; h.negBy = "before"; h.conj = head.conj; }
  }
  // a hazard's negation is its requirement ("without downtime"), never a list's: it opens none — nor does a negator that governs a
  // verb, not the item (1.21 review B1: "must not lose payments or refunds")
  const opens = (it) => it.hits.some((h) => h.negBy === "before" && !h.hazard) && negationGoverns(text, it.start, lang);
  const mark = (it) => { for (const h of it.hits) if (!h.hazard) { h.neg = true; if (!h.negBy) h.negBy = "list"; } };
  // the gap's first word is an article (1.21 review B2)
  const articleFirst = (from, to) => { const w = cueWords(text.slice(from, to))[0]; return !!w && LIST_ARTICLES.has(w.toLowerCase()); };
  // closed: a conjunction has closed the list — a later comma ends it (a list has one closing conjunction — 1.21 review B2).
  // listTracks: the tracks of the list's items so far — a comma + an article still joins an item of one of them ("Without an LLM, a
  // vector database or embeddings", "Without Kafka, the RabbitMQ broker or SQS"), never another track's item: that is a new clause's
  // subject ("No LLM, the checkout or the subscription flow first" — 1.21 verify V2); and a predicate after the closing item (an
  // auxiliary or a modal: "… IS the priority") makes the article-led items a subject too (articleAt: where they start in `pending`)
  let active = false, closed = false, pending = [], listTracks = new Set(), articleAt = -1;
  const join = (it) => { for (const h of it.hits) listTracks.add(h.track); };
  const open = (it) => { active = true; closed = false; pending = []; articleAt = -1; listTracks = new Set(); join(it); };
  // an auxiliary or a modal in the clause after the item: a predicate ("is the priority", "são a prioridade", "will handle it")
  const predicateAfter = (end) => cueWords(cueAfter(text, end, CUE_BOUNDARY)).some((w0) => { const w = w0.toLowerCase(); return GOVERN_AUX.has(w) || GOVERN_DEONTIC.has(w); });
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (active) {
      const l = listLink(text, items[i - 1].end, it.start, es);
      if (l === "comma" && !closed) {
        const art = articleFirst(items[i - 1].end, it.start);
        if (!art || it.hits.some((h) => listTracks.has(h.track))) { if (art && articleAt < 0) articleAt = pending.length; pending.push(it); join(it); continue; }
      }
      if (l && l !== "comma") {
        // … unless a predicate follows the closing item: then the article-led items were a new clause's subject ("Without payments, the
        // checkout or a subscription page IS the priority") — the list ended before them
        if (articleAt >= 0 && predicateAfter(it.end)) { pending.slice(0, articleAt).forEach(mark); active = false; closed = false; pending = []; articleAt = -1; continue; }
        pending.forEach(mark); pending = []; mark(it); join(it); closed = true; continue;
      }
      active = false; closed = false; pending = []; articleAt = -1; // the list ended here: this item may open a new one
    } else if (it.hits.some((h) => h.conj) && negatedVerb(text, it.start, lang)) {
      // 1.21 review B1: a negative conjunction no list carries, in a clause whose negator states a requirement ("Não pode perder
      // pagamentos nem reembolsos", "No puede perder pagos ni reembolsos"), continues that requirement, not a list of exclusions: its
      // item is not negated either
      for (const h of it.hits) if (h.conj) { h.neg = false; h.negBy = null; h.conj = false; }
    }
    if (opens(it)) { open(it); continue; }
    // "Não vamos usar X nem Y": a negative conjunction after an item a negator governs (the negator three words back)
    if (i + 1 < items.length && listLink(text, it.end, items[i + 1].start, es) === "neg" && negationGoverns(text, it.start, lang)) { mark(it); open(it); }
  }
}

// Signals are matched as WORDS, never as bare substrings. A plain `indexOf` fired 'claude' inside
// '.claude-plugin', 'rag' inside 'storage', 'sla' inside 'translate' and 'auth' inside 'author' —
// and a phantom STRONG signal auto-enables a track, which in turn hides the negation the classifier
// computed for that same track. Never reintroduce `indexOf` here.

// Keywords deliberately written as STEMS: any letters may follow ('idempoten' → idempotent /
// idempotency / idempotência, 'hallucinat' → hallucinations, 'summariz' → summarization).
const STEMS = new Set(["idempoten", "hallucinat", "summariz", "alucina",
  // +sec / +privacy: vulnerability / vulnerabilities / vulnerabilidade(s) / vulnerabilidad(es); sanitize / sanitização;
  // anonymize / anonymisation / anonimização / anonimización; data minimization / minimisation.
  "vulnerabili", "sanitiz", "anonymiz", "anonymis", "pseudonymiz", "pseudonymis", "data minimi", "anonimiza", "pseudonimiza", "seudonimiza",
  // +dist (1.17 D): deduplicate / deduplication / deduplicação / deduplicación; desduplicação
  "deduplica", "desduplica"]);
// VERB stems (full review Pb5): the stem + one of the listed endings, nothing else — 'cifr' is cifrar / cifrado / cifram…,
// never "cifra" (a figure); 'encript' never "encriptação" (a keyword of its own). The stem is the keyword (its literal and
// its name in notes), so a verb and its noun (encriptar / encriptação) are one signal, as encrypt / encryption are.
// VERB_STEMS and IRREGULAR_FORMS apply to the BUILT-IN signals only (1.17 D review): a track pack's keyword is always a literal
// word + the ordinary inflections — a pack keyword "public" matches "public", never only "publicar" (keywordRe(kw, true)).
const VERB_STEMS = new Map([
  ["encript", "(?:ar|a|am|an|amos|ando|ado|ada|ados|adas|ou|aram|em|en)"],
  ["cifr", "(?:ar|am|an|amos|ando|ado|ada|ados|adas|ou|aram|em|en)"],
  ["criptograf", "(?:ar|a|am|amos|ando|ado|ada|ados|adas|ou|aram|em)"],
  // +dist (1.17 D): publicar (PT / ES) — only inside the gap phrases "public … evento" / "… mensagem" / "… mensaje"; a bare
  // English "public" (a public API) never matches it: an ending is required.
  ["public", "(?:ar|a|as|am|an|amos|ando|ado|ada|ados|adas|ou|aram|ó|aron|ará|arão|arán)"],
  // enviar (PT / ES — 1.17 D review): only inside "envi … mensagem" / "envi … mensaje" ("environment" has no listed ending)
  ["envi", "(?:ar|a|as|am|an|amos|ando|ado|ada|ados|adas|ou|aram|ó|aron|ará|arão|arán)"],
]);
// Irregular inflections (1.17 D): a keyword whose forms the suffix rules can't produce — retry → retries / retried. The key is
// the keyword (its name in notes); the value its literal prefix and the alternation of endings. One concept, one signal:
// "retry … retries" is a single +dist hint, not the two weak ones that would turn the track on.
const IRREGULAR_FORMS = new Map([
  ["retry", ["retr", "(?:y|ies|ied|ying)"]],
  ["reintento", ["reintent", "(?:o|os|ar|a|an|ado|ada|ando)"]], // ES reintento(s) / reintentar / reintenta…
  ["duplicate delivery", ["duplicate deliver", "(?:y|ies)"]], // (1.17 D review)
  ["mensagem", ["mensage", "(?:m|ns)"]], // PT mensagem → mensagens (a part of "public … mensagem" / "envi … mensagem")
  // An EXACT form (no inflection at all — 1.17 D review): "2PC", never "2PCS" (a product listing's "2 pieces"). Upper case: matched
  // case-sensitively like every keyword written with capitals.
  ["2PC", ["2PC", ""]],
  // +api (1.19 T): the noun only — "requests", never "requested" ("the user requested a refund" is no HTTP request)
  ["request", ["request", "(?:s)?"]],
  // +ui (1.19 T): the nouns only — "screening", "formed", "paged the on-call" are no UI
  ["screen", ["screen", "(?:s)?"]], ["page", ["page", "(?:s)?"]], ["form", ["form", "(?:s)?"]],
]);
// A GAP keyword (built-in signals only — a track pack's keywords can't hold "…", RE_PACK_KEYWORD): its words with up to three
// words between them, none crossing sentence punctuation — "publish … event" is "publishes a UserCreated event", "publish
// events", "publicou o evento". Each part is matched as a keyword of its own (inflections, stems, verb stems).
const KW_GAP = " … ";
const KW_GAP_RE = "(?:\\s+[^\\s.!?;:,]+){0,3}?\\s+";
// Inflections accepted on an exact keyword: payment→payments, cache→cached, rate-limit→rate-limiting.
const INFLECTION = "(?:e?s|ed|ing|d)?";
// Short acronyms ('rag', 'sla', 'slo', 'gpt', 'llm', 'ai') pluralize but never conjugate — without
// this, 'rag' + 'ing' would make "raging" a strong +ai signal.
const ACRONYM_INFLECTION = "s?";
// Hyphen compounds that keep the head word a real signal ('AI-powered', 'LLM-based') rather than
// turning it into an identifier ('claude-plugin'). C4: compliance / certification / grade compounds too — "GDPR-compliant",
// "HIPAA-compliant", "PCI-compliance", "SOC2-certified", "enterprise-grade" name the keyword's concept ('-compliant' used to
// be a rejected '-<letter>' compound: "A GDPR-compliant signup form" classified as core only). Not '-aware': "session-aware
// routing" (sticky sessions) would read as an auth session.
const ADJ_SUFFIX = "(?:-(?:based|powered|driven|generated|assisted|enabled|native|ready|first|compliant|compliance|certified|grade))?";

const KW_RE = new Map();
// PT/ES plurals the English inflections can't produce: migração→migrações, sessão→sessões,
// suscripción→suscripciones. A multi-word keyword also pluralizes its FIRST word ("limites de taxa").
function pluralize(body, kw) {
  if (/ç[ãa]o$/.test(kw)) return body.replace(/ç[ãa]o$/, "(?:ção|cão|ções|çoes|coes)");
  if (/cao$/.test(kw)) return body.replace(/cao$/, "(?:cao|coes|ções)");
  if (/[ãa]o$/.test(kw) && /ss[ãa]o$|s[ãa]o$/.test(kw)) return body.replace(/[ãa]o$/, "(?:ão|ao|ões|oes)");
  if (/i[óo]n$/.test(kw)) return body.replace(/i[óo]n$/, "(?:ión|ion|iones)");
  if (/ (de|do|da|del|de la) /.test(kw) || /[^\x00-\x7f]/.test(kw)) return body.replace(/^([\p{L}]+)/u, "$1(?:e?s)?");
  return body;
}

// The part of a keyword its regex (keywordRe) always matches verbatim: pluralize() only rewrites the last 3 characters
// (-ção / -ão / -ión) or inserts a plural right after the FIRST word — so the leading characters up to both are literal.
// A keyword pluralize() leaves alone is matched verbatim WHOLE (only an inflection is appended): the whole keyword is the
// literal — "data retention" no longer compiles a regex for every text that merely says "data".
const KW_LITERAL = new Map();
const KW_CACHE_MAX = 5000; // the built-in signals (~700) + every track pack's (≤ 150 each)
// plain (1.17 D review): a track pack's keyword — a literal word (no gap, no verb stem, no irregular forms); cached apart from a
// built-in keyword of the same spelling.
const KW_PLAIN = "\u0001";
function keywordLiteral(kw, plain) {
  const key = plain ? KW_PLAIN + kw : kw;
  let lit = KW_LITERAL.get(key);
  if (lit != null) return lit;
  if (KW_LITERAL.size >= KW_CACHE_MAX) KW_LITERAL.clear();
  // a gap keyword: its first part's literal · an irregular one: its stem (1.17 D)
  if (!plain && kw.includes(KW_GAP)) { lit = keywordLiteral(kw.slice(0, kw.indexOf(KW_GAP))); KW_LITERAL.set(key, lit); return lit; }
  if (!plain && IRREGULAR_FORMS.has(kw)) { lit = IRREGULAR_FORMS.get(kw)[0]; KW_LITERAL.set(key, lit); return lit; }
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const first = (kw.match(/^[\p{L}\p{N}]+/u) || [""])[0];
  const n = pluralize(escaped, kw) === escaped ? kw.length : Math.min(first.length || kw.length, kw.length > 3 ? kw.length - 3 : kw.length);
  lit = kw.slice(0, Math.max(1, n));
  KW_LITERAL.set(key, lit);
  return lit;
}

function keywordRe(kw, plain) {
  const key = plain ? KW_PLAIN + kw : kw;
  let re = KW_RE.get(key);
  if (re) return re;
  if (KW_RE.size >= KW_CACHE_MAX) KW_RE.clear(); // track packs (1.15) add keywords: a long-lived server's cache stays bounded
  // A gap keyword's parts, each its own keyword pattern, joined by at most three words (KW_GAP_RE: whitespace and non-whitespace
  // runs alternate — linear); the edge guards below wrap the whole phrase.
  const bodyTail = plain ? keywordPattern(kw, true) : kw.includes(KW_GAP) ? kw.split(KW_GAP).map((p) => keywordPattern(p)).join(KW_GAP_RE) : keywordPattern(kw);
  // Left edge: not glued to a word char, and not part of a dotted/slashed/hyphenated identifier
  // ('.claude-plugin', 'src/rag.ts'). Right edge: after the optional inflection/adjective, no word
  // char and no '-<letter>' compound ('claude-plugin') — but '-<digit>' stays legal ('gpt-4').
  re = new RegExp(
    "(?<![\\p{L}\\p{N}_\\-./\\\\])" + bodyTail + "(?![\\p{L}\\p{N}_])(?![-./\\\\][\\p{L}])",
    "gu"
  );
  KW_RE.set(key, re);
  return re;
}
// One keyword (or one part of a gap keyword) → its pattern: the escaped text (pluralized) + its tail — a stem's letters, a verb
// stem's endings, an irregular keyword's forms, else the inflections (+ an adjective compound). plain: a track pack's keyword —
// never a verb stem's or an irregular keyword's forms (STEMS stay as in 1.16).
function keywordPattern(kw, plain) {
  if (!plain && IRREGULAR_FORMS.has(kw)) { const [stem, ends] = IRREGULAR_FORMS.get(kw); return stem + ends; }
  const body = pluralize(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), kw);
  return body + (STEMS.has(kw) ? "\\p{L}*" : !plain && VERB_STEMS.has(kw) ? VERB_STEMS.get(kw) : (kw.length <= 3 ? ACRONYM_INFLECTION : INFLECTION) + ADJ_SUFFIX);
}

// A keyword's ALL-CAPS acronyms when it mixes them with lower-case words and nothing else ("relatório de BI" → ["BI"], "CDC pipeline" →
// ["CDC"]) — else null ("STRIDE", "Snowflake warehouse", "X-RateLimit-Remaining" keep their exact case). Cached per keyword.
const MIXED_ACR = new Map();
function mixedAcronyms(kw) {
  if (MIXED_ACR.has(kw)) return MIXED_ACR.get(kw);
  const toks = kw.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const acr = toks.filter((t) => t.length >= 2 && /\p{Lu}/u.test(t) && t === t.toUpperCase());
  const ok = acr.length && toks.some((t) => /\p{Ll}/u.test(t)) && toks.every((t) => t === t.toLowerCase() || acr.includes(t));
  const out = ok ? acr : null;
  if (MIXED_ACR.size >= KW_CACHE_MAX) MIXED_ACR.clear();
  MIXED_ACR.set(kw, out);
  return out;
}

// Tokens that look like source paths ("src/rag", "lib/auth.ts") must stay opaque to the classifier.
const PATH_HEADS = new Set(["src", "lib", "app", "apps", "api", "pkg", "packages", "internal", "cmd", "bin", "test", "tests", "docs",
  "components", "modules", "services", "server", "client", "scripts", "config", "routes", "handlers", "controllers", "features",
  "web", "frontend", "backend", "pages", "views", "middleware", "utils", "util", "core", "shared", "models", "public", "static",
  "assets", "infra", "deploy", "db", "migrations", "templates", "hooks", "plugins", "store", "stores", "types", "schemas", "jobs",
  "workers", "domain", "adapters", "providers", "resources", "spec", "specs", "e2e", "fixtures"]);
// "login/signup", "payments/refunds", "RAG/embeddings" are prose pairs, not paths: split them so each
// word is matched. A token keeps its slash when it has a dot, a backslash, more than one slash, or a
// directory-like head.
function splitWordPairs(s) {
  return s.split(/(\s+)/).map((tok) => {
    const m = tok.match(/^([(\["']*)([\p{L}\p{N}-]{2,})\/([\p{L}\p{N}-]{2,})([)\]"',;:!?]*)$/u);
    if (!m || PATH_HEADS.has(m[2].toLowerCase())) return tok;
    return m[1] + m[2] + " / " + m[3] + m[4];
  }).join("");
}

function classify(description, opts = {}) {
  // opts.projectDir: that project's track packs (1.15) are classified too — their signals beside the built-in ones.
  if (opts.projectDir) specsRoot(opts.projectDir);
  const OPT = optionalTracks();
  // An optional feature name is part of the evidence ("LLM chatbot billing" says a lot).
  const raw = [opts.name, description].filter((s) => s != null && String(s).trim()).map(String).join(". ");
  const cased = " " + splitWordPairs(raw) + " ";
  const text = cased.toLowerCase();
  // No explicit lang: the text's own language, the project's configured one (opts.projectDir → meta.lang) only as the fallback
  // when the text is inconclusive — the same rule for spec_classify, create and import (full review R4).
  const lang = opts.lang ? normalizeLang(opts.lang) : guessLang(text, opts.fallbackLang || (opts.projectDir ? configuredLang(opts.projectDir) : undefined));
  const C = i18n.msg(lang).classify;
  // Accented/unaccented twins ("sessão"/"sessao") match the same word: one span counts once per track.
  const perTrack = (mk) => Object.fromEntries(OPT.map((t) => [t, mk()]));
  const seenSpan = perTrack(() => new Set());
  const active = new Set(["core"]);
  const matched = perTrack(() => ({ strong: [], weak: [], generic: [] }));
  const negated = perTrack(() => []);
  const hits = []; // every match, in scan order: { track, tier, kw, start, end, neg, negBy, hazard, base, by }
  // A match: negated by a negator BEFORE it (negBy "before" — a coordinated list carries it on), by a phrase after it ("after"),
  // or not; a hazard is never negated (SIGNAL_HAZARDS) but still carries a list's negation on.
  // conj: negated by a negative conjunction right before it (nor / nem / ni) — coordinatedNegation keeps that negation only in a list.
  const newHit = (track, tier, kw, start, end, hazard, base, by) => {
    const nb = negatorBefore(text, start, lang, cased);
    const negBy = nb ? "before" : negatedAfter(text, start, end - start) ? "after" : null;
    return { track, tier, kw, start, end, neg: !hazard && !!negBy, negBy, hazard, base: base === undefined ? tier : base, by: by || null, conj: !!nb && LIST_NEG.has(nb) };
  };
  // The project's signal overrides (1.21 F2 — .specs/classifier.json, learned from Phase 0 corrections or set by hand): a layer over
  // the tables — a word "off" is no signal of that track at all (its place stays free for another keyword), "weak" / "strong"
  // re-tier it, and a word no table has is matched as a literal word (a track pack's rule) at its tier. Only with a projectDir.
  const layer = opts.projectDir ? projectSignalLayer(opts.projectDir, OPT) : null;
  const applied = new Map(); // override key → its record (an override that changed this text's reading)

  for (const track of OPT) {
    const table = trackSignalTable(track);
    const plain = !Object.prototype.hasOwnProperty.call(SIGNALS, track); // a track pack's keywords are literal words (1.17 D review)
    const hazards = Object.prototype.hasOwnProperty.call(SIGNAL_HAZARDS, track) ? SIGNAL_HAZARDS[track] : null; // (never negated)
    const ov = layer ? layer.byTrack.get(track) : null;
    const consumed = ov ? new Set() : null;
    // (tier `generic` — 1.17 D review — exists in the built-in +dist table only; see SIGNALS.dist)
    for (const tier of ["strong", "weak", "generic", "context"]) {
      for (const kw of table[tier] || []) {
        // A keyword written with upper-case letters ('STRIDE') is an acronym matched CASE-SENSITIVELY, on the original
        // text (C4): the lower-case word is something else (an array stride). `cased` is `text` before toLowerCase().
        // 1.21 verify V3: a built-in keyword mixing lower-case words with an ALL-CAPS acronym ("relatório de BI", "BI dashboard", "CDC
        // pipeline") matches its words in any case and only its acronym case-sensitively — "Relatório de BI" opens a sentence, "BI
        // Dashboard" is a title; "o número do bi" is still no BI.
        const acr = plain ? null : mixedAcronyms(kw);
        const kwm = acr ? kw.toLowerCase() : kw;
        const hay = kwm === kwm.toLowerCase() ? text : cased;
        const rec = ov ? ov.get(kw.toLowerCase()) : undefined;
        if (rec) consumed.add(kw.toLowerCase());
        // A text without the keyword's literal prefix can't match its regex — skipping it spares compiling ~300 unicode
        // regexes on every CLI run (a classify used to cost ~250 ms per process).
        if (!hay.includes(keywordLiteral(kwm, plain))) continue;
        const re = keywordRe(kwm, plain);
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(hay)) !== null) {
          if (seenSpan[track].has(m.index)) continue;
          if (acr) { const ws = cueWords(cased.slice(m.index, m.index + m[0].length)); if (!acr.every((a) => ws.includes(a))) continue; }
          if (rec && rec.effect === "off") { applied.set(signalKey(track, rec.word), rec); continue; }
          seenSpan[track].add(m.index);
          const t2 = rec ? rec.effect : tier;
          if (t2 !== tier) applied.set(signalKey(track, rec.word), rec);
          hits.push(newHit(track, t2, kw, m.index, m.index + m[0].length, !!(hazards && hazards.has(kw)), tier, t2 !== tier ? "override" : null));
        }
      }
    }
    // an override word no table keyword of this track has: a literal word at its tier (off: nothing to drop)
    if (ov) {
      for (const [lw, rec] of ov) {
        if (consumed.has(lw) || rec.effect === "off") continue;
        const hay = rec.word === lw ? text : cased;
        if (!hay.includes(keywordLiteral(rec.word, true))) continue;
        const re = keywordRe(rec.word, true);
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(hay)) !== null) {
          if (seenSpan[track].has(m.index)) continue;
          seenSpan[track].add(m.index);
          applied.set(signalKey(track, rec.word), rec);
          hits.push(newHit(track, rec.effect, rec.word, m.index, m.index + m[0].length, false, null, "override"));
        }
      }
    }
  }
  // A WEAK signal inside a longer STRONG signal (of another track — and, 1.17 D review, of its own) is part of that phrase, not evidence of its own:
  // 'model' in "threat model" / "modelo de ameaças" (+sec) is no +ai hint, 'security' in "row-level security" (+saas)
  // no +sec one. The same word in two tracks ('authentication': +tdd strong, +sec weak) is not shadowed — equal spans.
  // 1.17 D review: inside a longer strong phrase of its OWN track it is part of that phrase too — "mensagens" in "fila de
  // mensagens", "outbox" in "transactional outbox", "worker" in "Celery worker" (the name-based de-dupe below misses a plural).
  // Linear (1.17 D review — every hit was compared with every hit: 100 KB of "queue …" took 9.6 s): the strong hits sorted by
  // start; a sweep keeps the furthest end of the strong hits starting BEFORE the hit (one reaching its end contains it
  // strictly) and looks up the strong hits starting AT it (only a longer one shadows).
  const strongHits = hits.filter((h) => h.tier === "strong").sort((a, b) => a.start - b.start);
  const startsAt = new Map();
  for (const s of strongHits) { const l = startsAt.get(s.start); if (l) l.push(s); else startsAt.set(s.start, [s]); }
  let reach = -1; // the furthest end of the strong hits started before the current hit
  const shadowedHits = new Set();
  let si = 0;
  for (const h of hits.filter((x) => x.tier !== "strong").sort((a, b) => a.start - b.start)) {
    for (; si < strongHits.length && strongHits[si].start < h.start; si++) if (strongHits[si].end > reach) reach = strongHits[si].end;
    if (reach >= h.end || (startsAt.get(h.start) || []).some((s) => s.end > h.end)) shadowedHits.add(h);
  }
  // A negation reaches every item of the coordinated list it opens (1.21 F2 — coordinatedNegation): "not add feature flags or
  // canary releases", "sem X nem Y", "ni X ni Y".
  coordinatedNegation(hits.filter((h) => !shadowedHits.has(h)), text, lang);
  // CORROBORATING-only signals (tier `context`, C4 — 'permission' for +sec) are weak evidence only beside another
  // (non-negated) signal of their track ("RBAC permissions"); a negated one is noted only when the track has some other
  // signal. Alone they are no evidence at all: no signal, no "possible" note, no "kept off" note ("file permission bits").
  // A GENERIC word (1.17 D review) backs no context word: "retry the card transaction" is no +dist evidence.
  // CUES (1.19 T review — SIGNAL_CUES): a built-in keyword whose tier depends on the words around it ("Stripe's REST API" is
  // app-level for us, "the settings page backend" is no UI work, "customer service" no technical target).
  const counted = [];
  for (const h of hits) {
    if (shadowedHits.has(h)) { h.final = "shadowed"; continue; }
    const cue = Object.prototype.hasOwnProperty.call(SIGNAL_CUES, h.track) && Object.prototype.hasOwnProperty.call(SIGNALS, h.track) ? SIGNAL_CUES[h.track] : null;
    const tier = cue ? cue(h, text, cased, lang) : null;
    h.cue = !!tier && tier !== h.tier;
    if (tier === "none") { h.final = "none"; continue; }
    h.final = tier || h.tier;
    counted.push(tier && tier !== h.tier ? Object.assign({}, h, { tier, src: h }) : h);
  }
  const own = (pred) => new Set(counted.filter((h) => h.tier !== "context" && pred(h)).map((h) => h.track));
  // (1.21 review B3 / verify V3) an anchor its table lists in `everydayAnchors` (+data: a lakehouse, a lineage, ingestion, SCD, duplicate
  // rows… — words with an everyday sense) backs no context word: a table / a column / a query is on every screen
  const everyday = (h) => h.tier === "weak" && Object.prototype.hasOwnProperty.call(SIGNAL_EVERYDAY, h.track) && SIGNAL_EVERYDAY[h.track].has(h.kw);
  const backedBy = own((h) => !h.neg && h.tier !== "generic" && !everyday(h)), mentionedBy = own(() => true);
  for (const h of counted) {
    if (h.tier === "context" && !(h.neg ? mentionedBy : backedBy).has(h.track)) { (h.src || h).final = "unbacked"; continue; }
    const tier = h.tier === "context" ? "weak" : h.tier;
    if (h.neg) { if (!negated[h.track].includes(h.kw)) negated[h.track].push(h.kw); }
    else if (!matched[h.track][tier].includes(h.kw)) matched[h.track][tier].push(h.kw);
  }

  // De-dupe by containment: a keyword that is a substring of another matched keyword in the same
  // track (e.g. "agent" ⊂ "agente", "model" ⊂ "modelo", "tokens" ⊂ "custo de tokens") is ONE
  // concept, not two signals — otherwise a single PT/ES word would auto-enable a track. The
  // containment must sit at a word edge, or a short keyword vanishes inside an unrelated one
  // ("ai" ⊂ "guardr-ai-l").
  for (const t of OPT) {
    const all = [...matched[t].strong, ...matched[t].weak, ...matched[t].generic];
    const keep = (arr) => arr.filter((k) => !all.some((m) => m !== k && (m.startsWith(k) || m.endsWith(k))));
    matched[t].strong = keep(matched[t].strong);
    matched[t].weak = keep(matched[t].weak);
    matched[t].generic = keep(matched[t].generic);
    // One concept, one signal (1.17 D review — SIGNAL_CONCEPTS): the first keyword of a concept stays, an anchor (weak) before a
    // generic one — "retry … with exponential backoff" is one anchor, "producers … consumers" one generic hint.
    const cm = Object.prototype.hasOwnProperty.call(SIGNAL_CONCEPTS, t) ? SIGNAL_CONCEPTS[t] : null;
    if (cm) {
      const seen = new Set();
      const once = (arr) => arr.filter((k) => { const c = cm.get(k); if (c == null) return true; if (seen.has(c)) return false; seen.add(c); return true; });
      matched[t].weak = once(matched[t].weak);
      matched[t].generic = once(matched[t].generic);
    }
    // The same for the negated ones (1.17 D): "no distributed transactions" is ONE negated concept, not also a negated
    // corroborating 'transaction' (+dist's context word inside it).
    const neg = negated[t];
    negated[t] = neg.filter((k) => !neg.some((m) => m !== k && (m.startsWith(k) || m.endsWith(k))));
  }

  // Weighting: score = strong*2 + weak (+ generic). A track turns ON at score >= 2 (one strong signal,
  // or two weak ones). A lone weak signal (score 1) is surfaced as "possible" but not enabled.
  // GENERIC signals (1.17 D review) add to the score but never turn a track on by themselves: at least one strong or weak (anchor)
  // signal must be there — "a print queue … retry failed prints" stays 'possible'.
  const signals = {};
  const confidence = {};
  const weak = [];
  const possible = [];
  for (const t of OPT) {
    signals[t] = [...matched[t].strong, ...matched[t].weak, ...matched[t].generic];
    const s = matched[t].strong.length;
    const w = matched[t].weak.length;
    const g = matched[t].generic.length;
    const score = s * 2 + w + g;
    if (score >= 2 && s + w > 0) {
      active.add(t);
      confidence[t] = score >= 4 ? "high" : "medium";
      if (s === 0) weak.push(t); // on, but from weak signals only
    } else if (score >= 1) {
      confidence[t] = "none";
      possible.push(Object.assign({ track: t, signal: matched[t].weak[0] || matched[t].generic[0] }, g >= 2 ? { generic: matched[t].generic.slice() } : {}));
    } else {
      confidence[t] = "none";
    }
  }

  const wordCount = raw.trim().split(/\s+/).filter(Boolean).length;
  const notes = [];
  if (active.size === 1 && !possible.length && wordCount > 25) {
    notes.push(C.substantial);
  }
  if (weak.length) {
    notes.push(C.weakOnly(weak.map((t) => "+" + t).join(", ")));
  }
  for (const p of possible) {
    // (1.17 D review) two or more app-level words and no anchor: named as such
    notes.push(p.generic ? C.genericOnly(p.track, p.generic.map((k) => `'${k.trim()}'`).join(", ")) : C.possible(p.track, p.signal.trim()));
  }
  // A negation is never silently dropped. It cannot *veto* a track — "the system shall not
  // hallucinate" negates 'hallucinat' on a feature that is unmistakably +ai — so when the track is
  // on anyway, surface the contradiction for the human who confirms Phase 0.
  for (const t of OPT) {
    if (!negated[t].length) continue;
    const quoted = negated[t].map((k) => `'${k.trim()}'`).join(", ");
    if (!active.has(t)) {
      notes.push(C.keptOff(t, negated[t][0].trim()));
    } else {
      notes.push(C.onAlthough(t, quoted, signals[t].join(", ")));
    }
  }

  // The project's overrides are never applied silently (1.21 F2): the ones that changed this reading are named (a note + the stable
  // `overrides` list), and a classifier.json that can't be read is ignored with a warning — never a crash.
  const overrides = [...applied.values()].map((r) => ({ track: r.track, word: r.word, effect: r.effect }));
  if (overrides.length) notes.push(C.overridesApplied(overrides));
  const warning = layer ? signalFileWarning(layer.rd) : null;
  if (warning) notes.push(C.overridesInvalid(warning.code, warning.entries || 0));

  const tracks = allTracks().filter((t) => active.has(t));
  const res = {
    tracks,
    label: trackLabel(tracks),
    signals,
    negated,
    confidence,
    weak,
    possible,
    note: notes.length ? notes.join(" ") : null,
    notes,
    mode: opts.mode || "spec",
    lang, // the language notes/reasoning were written in (explicit, or guessed from the text)
    reasoning: buildReasoning(tracks, signals, confidence, negated, C, OPT),
  };
  // 1.21 F5: the suggested size (a deterministic reading — stable `sizeReason`; the localized sentence in `sizeNote`, never in notes)
  const sz = suggestSize(text, tracks);
  const SZ = i18n.msg(lang).sizes;
  Object.assign(res, { suggestedSize: sz.size, sizeReason: sz.reason, sizeNote: (SZ.suggest[sz.reason] || SZ.suggest.default) + " " + SZ.suggestTail });
  if (overrides.length) res.overrides = overrides;
  if (warning) res.overridesWarning = warning;
  // explain (1.21 F2 — spec_classify {explain} / classify --explain): every keyword match — its table tier, its final one (a cue, an
  // override, shadowed, unbacked context), its negation — and the project's overrides with their state.
  if (opts.explain) {
    res.explain = {
      matches: hits.slice().sort((a, b) => a.start - b.start || a.track.localeCompare(b.track)).map((h) => ({ track: h.track, keyword: h.kw,
        text: cased.slice(h.start, h.end), base: h.base, tier: h.final || h.tier, cue: !!h.cue, override: h.by === "override" ? h.tier : null,
        negated: h.neg, negation: h.neg ? h.negBy : null })),
      overrides: layer ? layer.rd.records.map((r) => ({ track: r.track, word: r.word, effect: r.effect, count: r.count, origin: r.origin,
        active: signalActive(r), applied: applied.has(signalKey(r.track, r.word)) })) : [],
      min: SIGNAL_OVERRIDE_MIN,
    };
  }
  // The tiers each track matched (after the de-dupe), for the Phase 0 learner (learnSignalOverrides) — not part of the result's JSON.
  Object.defineProperty(res, "tiers", { value: matched, enumerable: false });
  return res;
}

// 1.21 F5 — the size spec_classify suggests (spec_create {size}): a deterministic reading of the request — never the track count
// alone (the 1.20 friction audit: the classifier under-calls tracks). → { size, reason } — reason (stable): trivial-change ·
// several-tracks · public-api · cross-system · single-unit · default. The human confirms or overrides it in Phase 0; nothing
// applies a size by itself (spec_create without one keeps the 1.20 scaffold).
const B_ = "(?<![\\p{L}\\p{N}])", _B = "(?![\\p{L}\\p{N}])";
const SIZE_TRIVIAL = new RegExp(B_ + "(?:typos?|misspell(?:ing|ed|ings)?|spelling (?:mistake|error)s?|wording|copy (?:change|tweak|edit|fix)|" +
  "(?:change|update|fix|edit|correct) (?:the |a )?(?:text|label|copy|wording|caption|colou?r|footer text|button text)|rename (?:the |a )?(?:label|button|field|variable|file|column)|" +
  "one[- ]line(?:r)? (?:fix|change)|(?:bump|upgrade|update) (?:the |a )?(?:version|dependency)|broken link|(?:update|fix) (?:the )?copyright|" +
  "gralhas?|erros? (?:ortográfico|de digitação|de escrita|tipográfico)s?|(?:corrigir|mudar|alterar|atualizar) (?:o |a )?(?:texto|rótulo|legenda|etiqueta|cor|redação)|" +
  "renomear (?:o |a )?(?:rótulo|botão|campo|ficheiro|arquivo)|(?:numa|uma|em uma) (?:só )?linha|link (?:partido|quebrado)|atualizar (?:a )?versão|" +
  "erratas?|errores? (?:tipográfico|ortográfico|de escritura)s?|faltas? de ortografía|(?:corregir|cambiar|actualizar) (?:el |la )?(?:texto|etiqueta|color|redacción)|" +
  "renombrar (?:el |la )?(?:etiqueta|botón|campo|archivo)|(?:en )?una (?:sola )?línea|enlace roto|actualizar (?:la )?versión)" + _B, "u");
const SIZE_UNIT = new RegExp(B_ + "(?:a|an|one|single|um|uma|un|una|1)\\s+(?:[\\p{L}\\p{N}/-]+\\s+){0,3}?(?:endpoints?|button|screen|page|field|column|form|filter|" +
  "report|export|checkbox|toggle|tab|dialog|modal|query|job|script|command|setting|link|email|notification|route|widget|" +
  "botão|ecrã|tela|página|campo|coluna|formulário|filtro|relatório|exportação|botón|pantalla|columna|formulario|informe|exportación|ruta)" + _B, "u");
const SIZE_CROSS = new RegExp(B_ + "(?:several|multiple|many|across) (?:services|systems|microservices)|(?:vários|varios|múltiplos|múltiples|entre) (?:serviços|sistemas|servicios|microsserviços|microservicios)" + _B, "u");
const SIZE_PUBLIC = new RegExp(B_ + "(?:public|pública|publica|público|publico)" + _B, "u");
function suggestSize(text, tracks) {
  const markers = tracks.filter((t) => t !== "core" && t !== "tdd");
  if (!markers.length && SIZE_TRIVIAL.test(text)) return { size: "xs", reason: "trivial-change" };
  if (markers.length >= 3) return { size: "l", reason: "several-tracks" };
  if (markers.includes("api") && SIZE_PUBLIC.test(text)) return { size: "l", reason: "public-api" };
  if ((markers.includes("dist") && markers.length >= 2) || SIZE_CROSS.test(text)) return { size: "l", reason: "cross-system" };
  if (markers.length <= 1 && SIZE_UNIT.test(text)) return { size: "s", reason: "single-unit" };
  return { size: "m", reason: "default" };
}

function buildReasoning(tracks, signals, confidence, negated, C, optional) {
  C = C || i18n.msg("en").classify;
  const lines = [C.core];
  for (const t of optional || OPTIONAL_TRACKS) {
    const neg = negated && negated[t] && negated[t].length ? negated[t].map((k) => `'${k.trim()}'`).join(", ") : null;
    if (tracks.includes(t)) {
      const uniq = [...new Set(signals[t])].slice(0, 6);
      const conf = confidence ? C.conf[confidence[t]] || confidence[t] : "";
      lines.push(C.on(t, conf, uniq.join(", "), neg));
    } else {
      lines.push(C.off(t, neg));
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Project-level signal overrides (1.21 F2) — .specs/classifier.json, learned from Phase 0 corrections
// ---------------------------------------------------------------------------
// When the human confirms Phase 0 with other tracks than the classifier suggested (spec_create {tracks} on a new feature with a
// summary — the suggestion is the summary's classification, the one classification.md records), the words that DROVE the
// suggestion are recorded: a track suggested and left off → its driving words (the strong ones, else the anchors) vote "off"; a
// track added that was not suggested → its lone word votes "strong", two or more app-level words vote "weak" each (one anchor
// is then enough). After SIGNAL_OVERRIDE_MIN consistent corrections a learned override applies in this project (classify with a
// projectDir); an agreement or an opposite correction resets a pending one, a correction that contradicts an applied one drops
// it. A word set by hand (`signals set`) applies at once and is never changed by learning. Never silently: classify names the
// overrides that changed its reading (`overrides` + a note), spec_create names what it learned (`signalOverrides` + a note).
// The file: one record per line, sorted by track and word (two branches learning different words merge cleanly); bounded
// (SIGNAL_OVERRIDE_MAX records, SIGNAL_FILE_MAX_BYTES); words follow the track-pack keyword rule (literal, never a pattern);
// a file that doesn't parse, or holds an invalid entry, is ignored for reading with a warning and never rewritten.
const SIGNAL_FILE = "classifier.json";
const SIGNAL_OVERRIDE_MIN = 2;
const SIGNAL_OVERRIDE_MAX = 200;
const SIGNAL_FILE_MAX_BYTES = 64 * 1024;
const SIGNAL_EFFECTS = Object.freeze(["off", "weak", "strong"]);
const SIGNAL_OPS = Object.freeze(["list", "set", "forget"]);
const RE_SIGNAL_TRACK = /^[a-z][a-z0-9]{1,19}$/;
const RE_LEADING_BOM = new RegExp("^" + String.fromCharCode(0xfeff));
const signalKey = (track, word) => track + "\u0000" + String(word).toLowerCase();
const signalActive = (r) => r.origin === "set" || r.count >= SIGNAL_OVERRIDE_MIN;
// A word: the track-pack keyword rule (letters / digits with inner spaces, hyphens, apostrophes, dots; 2–60 characters) → the
// word (spaces folded) or null.
function signalWord(w) {
  if (typeof w !== "string" || w.length > 4 * PACK_LIMITS.keywordLen) return null;
  const t = w.trim().replace(/\s+/g, " ");
  return t.length <= PACK_LIMITS.keywordLen && RE_PACK_KEYWORD.test(t) ? t : null;
}
function signalRecord(r) {
  if (!isObj(r)) return null;
  const track = typeof r.track === "string" ? r.track.trim().toLowerCase() : "";
  const word = signalWord(r.word);
  const effect = typeof r.effect === "string" ? r.effect.trim().toLowerCase() : "";
  const origin = r.origin == null ? "learned" : r.origin;
  const count = r.count == null ? 1 : r.count;
  if (!RE_SIGNAL_TRACK.test(track) || track === "core" || !word || !SIGNAL_EFFECTS.includes(effect) || (origin !== "learned" && origin !== "set") ||
    !Number.isSafeInteger(count) || count < 1) return null;
  const lastAt = typeof r.lastAt === "string" && r.lastAt.length <= 40 && !Number.isNaN(Date.parse(r.lastAt)) ? r.lastAt : null;
  return { track, word, effect, count, origin, lastAt };
}
// → { file, exists, records (valid, deduplicated, ≤ SIGNAL_OVERRIDE_MAX), problems [{index, code}], error (a code) | null }
function readSignalOverrides(projectDir) {
  const file = path.join(specsRoot(projectDir), SIGNAL_FILE);
  const out = { file, exists: false, records: [], problems: [], error: null };
  let st;
  try { st = fs.lstatSync(file); } catch { return out; }
  out.exists = true;
  if (!st.isFile()) { out.error = "not-a-file"; return out; } // a folder, a link: never followed
  if (st.size > SIGNAL_FILE_MAX_BYTES) { out.error = "too-big"; return out; }
  const raw = readIfExists(file);
  if (raw == null) { out.error = "unreadable"; return out; }
  let j;
  try { j = JSON.parse(raw.replace(RE_LEADING_BOM, "")); } catch { out.error = "invalid-json"; return out; }
  if (!isObj(j) || !Array.isArray(j.signals)) { out.error = "invalid-shape"; return out; }
  const seen = new Set();
  j.signals.forEach((x, index) => {
    if (out.records.length >= SIGNAL_OVERRIDE_MAX) { out.problems.push({ index, code: "too-many" }); return; }
    const rec = signalRecord(x);
    if (!rec) { out.problems.push({ index, code: "invalid-entry" }); return; }
    const k = signalKey(rec.track, rec.word);
    if (seen.has(k)) { out.problems.push({ index, code: "duplicate" }); return; }
    seen.add(k);
    out.records.push(rec);
  });
  return out;
}
const signalFileWarning = (rd) => (rd.error ? { code: rd.error } : rd.problems.length ? { code: "invalid-entries", entries: rd.problems.length } : null);
// The classifier's view: the ACTIVE overrides of the tracks it reads (a missing pack's are kept in the file, unused) → { rd,
// byTrack: Map(track → Map(lower-case word → record)) } — null when the project has no classifier.json (byte-identical results).
function projectSignalLayer(projectDir, OPT) {
  const rd = readSignalOverrides(projectDir);
  if (!rd.exists) return null;
  const byTrack = new Map();
  for (const r of rd.records) {
    if (!signalActive(r) || !OPT.includes(r.track)) continue;
    if (!byTrack.has(r.track)) byTrack.set(r.track, new Map());
    byTrack.get(r.track).set(r.word.toLowerCase(), r);
  }
  return { rd, byTrack };
}
function renderSignalFile(records) {
  const k = (r) => [r.track, r.word.toLowerCase()];
  const sorted = records.slice().sort((a, b) => { const x = k(a), y = k(b); return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0; });
  const line = (r) => JSON.stringify({ track: r.track, word: r.word, effect: r.effect, count: r.count, origin: r.origin, ...(r.lastAt ? { lastAt: r.lastAt } : {}) });
  return "{\n  \"signals\": [" + (sorted.length ? "\n" + sorted.map((r) => "    " + line(r)).join(",\n") + "\n  " : "") + "]\n}\n";
}
// A read-modify-write of classifier.json under the roadmap lock (the project-level lock): re-read from disk, `mutate(records)` →
// { changed, … }; written only when changed. A file that can't be read, or holds an invalid entry, is never rewritten (its
// entries would be lost) → { ok: false, fileError }.
function writeSignalRecords(projectDir, mutate) {
  return withRoadmapLock(projectDir, () => {
    const file = path.join(specsRoot(projectDir), SIGNAL_FILE);
    forgetCached(file);
    const rd = readSignalOverrides(projectDir);
    const w = signalFileWarning(rd);
    if (w) return { ok: false, fileError: w };
    const records = rd.records.map((r) => Object.assign({}, r));
    const out = mutate(records) || {};
    if (out.changed) writeFileAtomic(file, renderSignalFile(records));
    return Object.assign({ ok: true }, out);
  }, (b) => roadmapBusyResult(projectDir, b));
}
// Learn from a Phase 0 correction: `cls` = the suggestion (classify's result for the new feature's name + summary), `confirmed` =
// the tracks the human chose. → null (nothing to learn) | { learned [{track, word, effect, count, active}], forgotten [...], capped? }
// | { error, busy? } (nothing recorded).
function learnSignalOverrides(projectDir, cls, confirmed) {
  if (!cls || !cls.tiers || !cls.signals) return null;
  const S = new Set(cls.tracks), C = new Set(confirmed), appliedOv = cls.overrides || [];
  const votes = [], contradicted = [], agreed = [];
  for (const t of Object.keys(cls.signals)) {
    const m = cls.tiers[t] || { strong: [], weak: [], generic: [] };
    const sug = S.has(t), conf = C.has(t);
    if (sug && !conf) { // suggested, left off: the words that turned it on (a strong one alone does; else the anchors)
      for (const w of m.strong.length ? m.strong : m.weak) votes.push({ track: t, word: w, effect: "off" });
      for (const o of appliedOv) if (o.track === t && o.effect !== "off") contradicted.push(o);
    } else if (!sug && conf) { // added, not suggested: its lone word turns it on; two or more app-level words, each an anchor
      const words = m.weak.concat(m.generic);
      if (words.length === 1) votes.push({ track: t, word: words[0], effect: "strong" });
      else if (!m.weak.length && m.generic.length >= 2) for (const w of m.generic) votes.push({ track: t, word: w, effect: "weak" });
      for (const o of appliedOv) if (o.track === t && o.effect === "off") contradicted.push(o);
    } else if (sug) for (const w of m.strong.concat(m.weak)) agreed.push({ track: t, word: w, off: true }); // agreed: on
    else for (const w of m.weak.concat(m.generic)) agreed.push({ track: t, word: w, off: false }); // agreed: off
  }
  const valid = votes.map((v) => Object.assign({}, v, { word: signalWord(v.word) })).filter((v) => v.word);
  const file = path.join(specsRoot(projectDir), SIGNAL_FILE);
  if (!valid.length && (!fs.existsSync(file) || (!contradicted.length && !agreed.length))) return null;
  const now = new Date().toISOString();
  const r = writeSignalRecords(projectDir, (records) => {
    const idx = new Map(records.map((x) => [signalKey(x.track, x.word), x]));
    const learned = [], forgotten = [];
    let changed = false, capped = 0;
    const drop = (rec) => {
      const i = records.indexOf(rec);
      if (i < 0) return;
      records.splice(i, 1);
      idx.delete(signalKey(rec.track, rec.word));
      forgotten.push({ track: rec.track, word: rec.word, effect: rec.effect });
      changed = true;
    };
    for (const o of contradicted) { const rec = idx.get(signalKey(o.track, o.word)); if (rec && rec.origin === "learned") drop(rec); }
    for (const a of agreed) {
      const rec = idx.get(signalKey(a.track, a.word));
      if (rec && rec.origin === "learned" && rec.count < SIGNAL_OVERRIDE_MIN && a.off === (rec.effect === "off")) drop(rec);
    }
    for (const v of valid) {
      const k = signalKey(v.track, v.word);
      let rec = idx.get(k);
      if (rec && rec.origin === "set") continue; // a word set by hand is the team's explicit choice: learning never changes it
      if (rec && (rec.effect === "off") === (v.effect === "off")) { // one more consistent correction
        rec.count++;
        rec.lastAt = now;
        if (v.effect === "strong") rec.effect = "strong";
      } else {
        if (rec) drop(rec); // an opposite correction starts over
        if (records.length >= SIGNAL_OVERRIDE_MAX) { // full: the oldest pending learned record makes room, never an active one
          const pend = records.filter((x) => x.origin === "learned" && x.count < SIGNAL_OVERRIDE_MIN).sort((a, b) => String(a.lastAt || "").localeCompare(String(b.lastAt || "")))[0];
          if (!pend) { capped++; continue; }
          drop(pend);
        }
        rec = { track: v.track, word: v.word, effect: v.effect, count: 1, origin: "learned", lastAt: now };
        records.push(rec);
        idx.set(k, rec);
      }
      changed = true;
      learned.push({ track: rec.track, word: rec.word, effect: rec.effect, count: rec.count, active: signalActive(rec) });
    }
    return { changed, learned, forgotten, capped };
  });
  if (!r.ok) return { error: r.fileError ? r.fileError.code : "busy", busy: !!r.busy };
  if (!r.learned.length && !r.forgotten.length && !r.capped) return null;
  return Object.assign({ learned: r.learned, forgotten: r.forgotten }, r.capped ? { capped: r.capped } : {});
}
// The localized note spec_create adds for what it learned (null when nothing).
function signalLearnNote(L, lang) {
  if (!L) return null;
  const G = i18n.msg(lang).signals;
  if (L.error) return G.learnFailed(L.error);
  return [...L.learned.map((x) => (x.active ? G.learnedActive(x.track, x.word, x.effect, x.count) : G.learnedPending(x.track, x.word, x.effect, x.count, SIGNAL_OVERRIDE_MIN))),
    ...L.forgotten.map((x) => G.learnedDropped(x.track, x.word, x.effect)), L.capped ? G.capped(SIGNAL_OVERRIDE_MAX) : null].filter(Boolean).join(" ");
}
// spec_tracks {action: "signals", op, track, word, effect} / `dev-spec signals [list | set <track> <word> off|weak|strong | forget
// <track> <word>]` — the project's overrides: list them (active / pending, the file's problems), set one by hand (applies at once),
// forget one.
function signalOverrides(projectDir, op, opts = {}) {
  const pl = projectLang(projectDir);
  let lang = null;
  if (opts.lang != null && String(opts.lang).trim()) {
    lang = i18n.canonicalLang(String(opts.lang));
    if (!lang) { const A = i18n.msg(pl).args; return { ok: false, error: A.invalid(A.item("lang", A.oneOf(i18n.LANGS.join(", ")), JSON.stringify(String(opts.lang)))) }; }
  }
  const lng = lang || pl;
  const G = i18n.msg(lng).signals;
  const act = op == null || !String(op).trim() ? "list" : String(op).trim().toLowerCase();
  if (!SIGNAL_OPS.includes(act)) return { ok: false, error: G.badOp(String(op)) };
  const rel = ".specs/" + SIGNAL_FILE;
  const base = { action: "signals", op: act, file: rel };
  if (act === "list") {
    const rd = readSignalOverrides(projectDir);
    const OPT = optionalTracks();
    const overrides = rd.records.map((r) => Object.assign({}, r, { active: signalActive(r) }, OPT.includes(r.track) ? {} : { unknownTrack: true }));
    const warning = signalFileWarning(rd);
    const lines = [overrides.length ? G.listHead(rel, overrides.length, overrides.filter((o) => o.active).length, SIGNAL_OVERRIDE_MIN) : G.listNone(rel)];
    for (const o of overrides) lines.push(G.listItem(o, SIGNAL_OVERRIDE_MIN));
    if (warning) lines.push(G.fileWarning(rel, warning.code, warning.entries || 0));
    for (const p of rd.problems) lines.push(G.problem(p.index, p.code));
    return Object.assign({ ok: true }, base, { exists: rd.exists, min: SIGNAL_OVERRIDE_MIN, max: SIGNAL_OVERRIDE_MAX, overrides, problems: rd.problems },
      warning ? { warning } : {}, { lines });
  }
  const track = opts.track != null ? String(opts.track).trim().toLowerCase().replace(/^\+/, "") : "";
  if (!track) return { ok: false, error: G.needTrackWord(act) };
  if (track === "core") return { ok: false, error: G.coreTrack };
  const OPT = optionalTracks();
  if (act === "set" ? !OPT.includes(track) : !RE_SIGNAL_TRACK.test(track)) return { ok: false, error: G.badTrack(track, OPT.join(", ")) };
  const word = signalWord(opts.word);
  if (!word) return { ok: false, error: opts.word == null || !String(opts.word).trim() ? G.needTrackWord(act) : G.badWord(String(opts.word).slice(0, 80)) };
  const effect = opts.effect != null ? String(opts.effect).trim().toLowerCase() : "";
  if (act === "set" && !SIGNAL_EFFECTS.includes(effect)) return { ok: false, error: G.badEffect(String(opts.effect == null ? "" : opts.effect)) };
  if (!fs.existsSync(specsRoot(projectDir))) return { ok: false, error: i18n.msg(lng).err.noSpecs(projectDir) };
  const k = signalKey(track, word);
  const r = writeSignalRecords(projectDir, (records) => {
    const i = records.findIndex((x) => signalKey(x.track, x.word) === k);
    const prev = i >= 0 ? records[i] : null;
    if (act === "forget") {
      if (!prev) return { changed: false, removed: null };
      records.splice(i, 1);
      return { changed: true, removed: prev };
    }
    if (!prev && records.length >= SIGNAL_OVERRIDE_MAX) return { changed: false, full: true };
    const rec = { track, word, effect, count: prev ? prev.count : 1, origin: "set", lastAt: new Date().toISOString() };
    if (prev) records[i] = rec; else records.push(rec);
    return { changed: true, override: rec, replaced: prev };
  });
  if (!r.ok) return r.busy ? r : { ok: false, error: G.fileWarning(rel, r.fileError.code, r.fileError.entries || 0), fileWarning: r.fileError };
  if (act === "forget") {
    if (!r.removed) return { ok: false, error: G.notFound(track, word), notFound: true };
    return Object.assign({ ok: true }, base, { removed: r.removed, lines: [G.forgotten(r.removed.track, r.removed.word, r.removed.effect)] });
  }
  if (r.full) return { ok: false, error: G.capped(SIGNAL_OVERRIDE_MAX), full: true };
  return Object.assign({ ok: true }, base, { override: Object.assign({}, r.override, { active: true }), replaced: r.replaced || null,
    lines: [G.setDone(track, word, effect, r.replaced ? r.replaced.effect : null)] });
}

module.exports = { conceptMap, SIGNAL_CONCEPTS, SIGNAL_HAZARDS, SIGNAL_CUES, NEGATORS, NEG_FILLER, NEG_FILLER_EN, NEG_AFTER,
  W, PT_STRONG, PT_STRONG_CHARS, PT_WEAK, ES_STRONG, ES_STRONG_CHARS, ES_WEAK, EN_WORDS, CLAUSE_START, INF_WORDS, INF, PT_INF,
  ES_INF, PTES_INF, ES_NO_INF,
  guessLang, configuredLang, isNegated, negatedBefore, negatedAfter, coordinatedNegation, listLink, STEMS, VERB_STEMS, IRREGULAR_FORMS,
  KW_GAP, KW_GAP_RE, INFLECTION, ACRONYM_INFLECTION, ADJ_SUFFIX, KW_RE, pluralize, KW_LITERAL, KW_CACHE_MAX, KW_PLAIN, keywordLiteral,
  keywordRe, keywordPattern, PATH_HEADS, splitWordPairs, classify, buildReasoning, SIGNAL_FILE, SIGNAL_OVERRIDE_MIN, SIGNAL_OVERRIDE_MAX,
  SIGNAL_EFFECTS, SIGNAL_OPS, readSignalOverrides, learnSignalOverrides, signalLearnNote, signalOverrides, __link };
