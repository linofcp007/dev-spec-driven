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

// CUES — a built-in keyword whose tier depends on the words around it: SIGNAL_CUES[track](hit, text, cased, lang) → a new
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
// The hit's CLAUSE: the text between the CUE_BOUNDARY characters around it (≤ CUE_SPAN each way) → {from, to} —
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
// public API", "la API pública del BCE")
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
  // right after a notAfter phrase nor right before a notBefore one (an API key; a public API) }.
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
  // all — every rule of `rules` fires (each a rule of any other kind, without on / ifTier / then: the enclosing rule's
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
const SIGNAL_EVERYDAY = signalLookup("everydayAnchors", (list) => new Set(list)); // (see backedBy in classify())

// Words that negate a signal when they appear just before the keyword (EN/PT/ES). The negative conjunctions too —
// "nor" / "neither", PT "nem", ES "ni" ("sem X nem Y", "ni X ni Y": each item they introduce is negated).
const NEGATORS = ["no", "not", "without", "never", "skip", "exclude", "avoid", "omit", "dispensa", "prescinde", "sem", "não", "nao", "sin",
  "nor", "neither", "nem", "ni",
  // PT / ES "never" ("Nunca usaremos Kafka", "Jamás usaremos Kafka"; "jamais" is PT too)
  "nunca", "jamás", "jamas", "jamais",
  // "cannot" reads as "can't" ("Guests cannot use the checkout" = "Guests can't use the checkout")
  "cannot"];

// Words that may sit between a negator and the keyword ("sem uso de IA", "without the use of any LLM").
const NEG_FILLER = new Set(["uso", "use", "usage", "of", "de", "do", "da", "del", "the", "a", "an", "any", "qualquer", "nenhum", "nenhuma", "ningún", "ninguna", "ningun", "el", "la", "o"]);
// The English ones — the only fillers a wide "no" may negate across (see negationOf).
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
// Brazilian Portuguese counts as Portuguese: você / usuário / arquivo / cadastro / senha are PT-only words
// ("usuario" without the accent and "archivo" are Spanish); "tela" (screen — ES: fabric) and "equipe" are weak. The guess
// is still 'pt' — only an explicit lang: "pt-BR" makes the classifier answer in Brazilian Portuguese.
const PT_STRONG = W("n[ãa]o|uma|umas|pelo|pela|pelos|também|tambem|você|voce|vocês|isso|isto|então|entao|ainda|quando|onde|deve|devem|utilizador|utilizadores|usuário|usuários|arquivo|arquivos|cadastro|cadastrar|senha|senhas|sem");
const PT_STRONG_CHARS = /ç[ãa]o|ções|[ãõç]/giu;
const PT_WEAK = W("com|um|por|para|de|da|dos|das|que|na|tela|telas|equipe");
const ES_STRONG = W("una|unos|pero|también|tambien|usted|esto|eso|entonces|todavía|cuando|donde|debe|deben|usuario|usuarios|sin|sólo");
const ES_STRONG_CHARS = /ción|ciones|ñ/giu;
const ES_WEAK = W("con|un|por|para|de|del|el|la|las|que|en|solo");
const EN_WORDS = W("the|and|with|for|of|is|are|to|an|in|on|by|from|that|this|it|should|must|when|without");
// content words of ONE language (none an English word): the built-in signals' PT / ES words and the nouns a short
// feature summary is made of ("Erro no pagamento", "Cupom de desconto no checkout", "Alertas no PagerDuty"). A STRONG marker, and
// only in a text with no English function word (like the clause-start infinitives): such a summary read as English, its "no"
// (PT em + o) as a negator, and +tdd / +obs went off. PTES_WORDS exist in both (they tell PT / ES from English, never PT from ES).
const PT_WORDS = W("pagamentos?|faturas?|faturacao|encomendas?|descontos?|cupom|cupons|cup[ãa]o|erros?|carrinho|lojas?|contas?|produtos?|" +
  "relat[óo]rios?|registos?|ficheiros?|ecr[ãa]|bot[ãa]o|sess[ãa]o|autenticacao|autorizacao|dinheiro|moeda|cobran[çc]a|mensalidades?|" +
  "agendamentos?|desempenho|privacidade|consentimento|monitoramento|monitoriza[çc][ãa]o|rastreio|linhagem|pesquisa|notifica[çc](?:[ãa]o|[õo]es)");
const ES_WORDS = W("pagos?|facturas?|facturaci[óo]n|descuentos?|cup[óo]n|carrito|tiendas?|cuentas?|productos?|informes?|archivos?|pantallas?|" +
  "bot[óo]n|sesi[óo]n|autenticaci[óo]n|autorizaci[óo]n|dinero|moneda|cobros?|mensualidad|rendimiento|privacidad|consentimiento|" +
  "monitoreo|b[úu]squeda|despliegue|reintentos?|formularios?|tablero|seguridad|notificaci[óo]n(?:es)?");
const PTES_WORDS = W("reembolsos?|clientes?|pedidos?|campos?|alertas?|filtros?|envios?|entregas?|p[áa]ginas?|registros?|telemetria|" +
  "inquilinos?|agentes?|modelos?");
// a PT / ES INFINITIVE opening a clause — the form a PT / ES requirement line starts with ("Publicar eventos no
// Kafka.", "Gravar o pedido no Postgres e …"): a short line with no other marker read as English, and "no" (PT em + o) as a
// negator. Only at a clause start (the text's start, after . ! ? ; : or a line break, or a list bullet) and followed by its
// object (a word on the same line — a UI label list "Guardar, Enviar, Cancelar" or "Enviar. Pagar." is no clause), a STRONG
// marker (2) — and only in a text with no English function word ("Spanish labels: …" is English).
// PT_INF / ES_INF hold verbs that exist in ONE language only; a verb both languages have (alterar, excluir, mudar, apagar,
// agregar, cambiar…) is in PTES_INF and counts for both — it tells PT / ES from English, never PT from ES (a tie is PT, or the
// project's language when that is ES). None is an English word ("remover", "registrar", "leer" are left out: an English noun /
// verb). CLAUSE_START is linear: the spaces after a start never cross a line break (`\s*` there re-read a whole run of blank
// lines from each of its line breaks — quadratic).
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
// never precedes an infinitive). A STRONG ES marker ("Adicionar productos al carrito, no usar LLM." read PT).
const ES_NO_INF = new RegExp("(?<![\\p{L}\\p{N}_])no[^\\S\\n]+(" + INF_WORDS.es + "|" + INF_WORDS.both + ")(?![\\p{L}\\p{N}_])", "giu");
// fallback (an imported source): the project's language, used when the text shows no language of its own
// (no PT/ES marker to speak of and fewer than two English function words) — and its variant (pt-BR) when the text is in
// its family. Without it the answer is the plain guess ('en' when nothing says otherwise).
function guessLang(text, fallback) {
  const distinct = (re) => new Set((text.match(re) || []).map((m) => m.toLowerCase())).size;
  const distinctInf = (re) => new Set(Array.from(text.matchAll(re), (m) => m[1].toLowerCase())).size;
  const en = distinct(EN_WORDS);
  // clause-start infinitives only in a text without English function words — one language's content words
  // too
  const inf = (re) => (en ? 0 : distinctInf(re));
  const words = (re) => (en ? 0 : distinct(re));
  const shared = inf(PTES_INF) + words(PTES_WORDS);
  const pt = 2 * (distinct(PT_STRONG) + distinct(PT_STRONG_CHARS) + inf(PT_INF) + words(PT_WORDS) + shared) + distinct(PT_WEAK);
  const es = 2 * (distinct(ES_STRONG) + distinct(ES_STRONG_CHARS) + inf(ES_INF) + words(ES_WORDS) + shared + distinctInf(ES_NO_INF)) + distinct(ES_WEAK);
  const best = Math.max(pt, es);
  const f = fallback ? normalizeLang(fallback) : null;
  // a PT / ES tie (a shared verb, "de", "para"…) is PT — unless the project's language is Spanish
  const tieEs = pt === es && f !== null && i18n.baseLang(f) === "es";
  const g = best < 2 || best <= en ? "en" : pt > es || (pt === es && !tieEs) ? "pt" : "es";
  if (!f) return g;
  if (i18n.baseLang(f) === g) return f;
  return g === "en" && best < 2 && en < 2 ? f : g;
}
// which Portuguese: the guess answers `pt` for both variants (the classifier reads them alike), but a summary in
// Brazilian wording should get Brazilian artifacts. `langHint: "pt-BR"` (the `lang` key stays `pt` — a stable field) when the
// Brazilian markers outweigh the European ones: STRONG (2) — você, usuário, arquivo, cadastro / cadastrar, celular, aplicativo,
// planilha, deletar, gerenciar / gerenciamento, the ê / ô before m / n + a vowel (eletrônico, gênero, acadêmico, prêmio); WEAK (1) —
// tela, equipe, registro, contato, salvar, baixar, "o / do / no time" (the team). European: utilizador, ficheiro, ecrã, telemóvel,
// equipa, palavra-passe, registo, contacto, facto, secção / acção, descarregar, gerir, utente, "está a <infinitive>", the é / ó before
// m / n + a vowel (electrónico, género, prémio). A hint for the agent, never a reading change (pt and pt-BR classify alike).
const PTBR_STRONG = W("você|vocês|voce|voces|usuário|usuários|usuária|usuárias|arquivo|arquivos|cadastro|cadastros|cadastrar|cadastrado|" +
  "cadastrada|celular|celulares|aplicativo|aplicativos|planilha|planilhas|deletar|deletado|gerenciar|gerencia|gerenciamento|gerenciador|" +
  "\\p{L}*[êô][mn][aeiouí]\\p{L}*");
const PTBR_WEAK = W("tela|telas|equipe|equipes|registro|registros|contato|contatos|salvar|baixar|(?:o|do|no|ao|nosso|seu|pelo) time");
const PTPT_STRONG = W("utilizador|utilizadores|utilizadora|ficheiro|ficheiros|ecrã|ecrãs|telemóvel|telemóveis|equipa|equipas|palavra-passe|" +
  "palavras-passe|registo|registos|contacto|contactos|facto|factos|secção|secções|acção|acções|descarregar|gerir|utente|utentes|" +
  "(?:está|estão|estou|estamos|estar) a \\p{L}+r|\\p{L}*[éó][mn][aeiou]\\p{L}*");
function ptVariantHint(text) {
  const n = (re) => new Set((text.match(re) || []).map((m) => m.toLowerCase())).size;
  const br = 2 * n(PTBR_STRONG) + n(PTBR_WEAK);
  const eu = 2 * n(PTPT_STRONG);
  return br >= 2 && br > eu ? "pt-BR" : null;
}
// The language the classifier reads a NEW feature's summary in: the explicit one, else the project's
// configured language (roadmap.json meta.lang, set by spec_init) — the language the feature is written in. Never the 'en'
// fallback: a project without meta.lang keeps the guess. ("Corrigir o cálculo do IVA no checkout" in a PT project read
// 'no' as a negator — the guess said 'en' — and kept +tdd off.)
function configuredLang(projectDir, lang) {
  if (lang) return lang;
  const l = (readRoadmap(projectDir).meta || {}).lang;
  // a brand-new project without meta.lang reads it in the user's DEFAULT_LANG option, the language it is about to get.
  return typeof l === "string" && l.trim() ? normalizeLang(l) : projectDir ? newProjectLang(projectDir) : undefined;
}

// "<keyword> ... not needed/required" shortly after.
function negatedAfter(text, idx, kwLen) {
  const after = text.slice(idx + (kwLen || 0), idx + (kwLen || 0) + 30).toLowerCase();
  return NEG_AFTER.test(after);
}
// A negator BEFORE the match — the negation a coordinated list carries on to its next items (coordinatedNegation):
// the negator that EXCLUDES the match at idx … end (the word, lower-case) — or null. (only a CERTAIN exclusion —
// negationOf; when in doubt the track stays: a track wrongly off loses rigor, an extra one is a one-word removal in Phase 0.)
function negatorBefore(text, idx, lang, cased, end) {
  const n = negationOf(text, idx, end == null ? idx : end, lang, cased);
  return n ? n.word : null;
}
// a negator word, or a contraction ending n't, in a stretch of text (the look-back's precheck — the reach of cueBefore)
const RE_NEG_NEAR = new RegExp("(?<![\\p{L}])(?:" + NEGATORS.join("|") + ")(?![\\p{L}])|n['’]t(?![\\p{L}])", "u");

// COORDINATED NEGATION: a negation reaches every item of the coordinated list it opens, in its clause, for every track
// — "We will not add feature flags or canary releases", "Não vamos usar feature flags nem lançamento canário", "No usaremos
// feature flags ni despliegue canario", "without Kafka, RabbitMQ or SQS". The items are the matched keywords (every track;
// overlapping matches are one item); two items are coordinated when the text between them is a LIST LINK: a conjunction (or /
// nor / ou / nem / ni, ES o / u) with at most one other word ("or any", "nem outro"), or a comma with articles only — a
// comma-joined item counts only once a conjunction closes the list later ("no X, Y or Z"; "Without feature flags, the canary
// release…" is no list). Never across . ! ? ; : or a line break, "and" / "e" / "y" (often a new predicate: "without downtime and
// roll back on errors"), a contrast word ("no X, just Y", "sem X, apenas Y", "not X but Y") or a longer gap; a hazard's negation
// (its requirement: "without downtime") opens no list. A negative conjunction (nor / nem / ni) also negates the item BEFORE it
// when a negator GOVERNS that item ("Não vamos usar X nem Y" — the negator three words back). A list opens only at an
// item its negator governs (negationGoverns — "must not lose payments or refunds" negates the verb: no list); a comma after
// the list's closing conjunction, or one before an article, ends it ("Without an LLM or embeddings, the checkout or …"). Linear:
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
// WHAT A NEGATION NEGATES — a negation EXCLUDES a keyword only when it certainly governs
// it; ANYTHING ELSE keeps the track (when in doubt, keep: a track wrongly off loses rigor, an extra one is a one-word removal the human
// confirms in Phase 0). It certainly governs it when:
//   (a) a NOMINAL negator (no / without / sem / sin / nor / nem / ni, avoid, skip… — NOMINAL_NEGATORS; a contrast "Postgres, not
//       MongoDB" too) has nothing but fillers, articles, quantifiers or modifiers before it — "no X", "sem o X", "without the use of
//       any X", "no new X", one word right before the keyword ("without real-time X"); a plain noun ENDS the negated phrase ("Without
//       payments THE checkout is useless": the checkout stays); or a list it opened carries it on;
//   (b) an ADOPTION verb (GOVERN_ADOPT: use / add / need / include / implement / integrate / deploy / run / offer / provide / ship /
//       create / adopt / enable / install / embed / bundle / expose, "necessary" + PT / ES) or a PLAN / an INTENTION (GOVERN_AUX: will /
//       do / going to, vamos / iremos · GOVERN_WANT: plan / intend / want, pretendemos / planeamos / queremos, tenemos previsto…)
//       governs it, optionally with an article / a quantifier / one modifier — "We will not add an LLM", "We don't use managed Kafka",
//       "Não queremos Kafka", "No es necesario Kafka", "must not use X" (whatever the modal) — and its SUBJECT is the one designing
//       (the first person, the system being built, or none): a role's / a plan's is an access or entitlement rule, the track stays
//       ("Guests can't use the checkout", "The free plan does not include webhooks" — 1.21 verify P1, subjectKeeps()).
// Never an exclusion: an auxiliary or a modal + any other verb ("The report does not show the LLM cost", "Users who do not pay the
// subscription", "must not lose payments", "never overwrites the ledger" — the verb is the requirement), a wished verb ("We don't want to
// lose payments") or a hazard ("don't want duplicate payments", "pagamentos duplicados"), a relative clause ("Users who don't pay…",
// "Utilizadores que não pagam…"), a condition ("If we don't add rate limiting…", "…unless the admin asks"), a nominal negator inside a
// negated predicate ("We won't ship without a canary release": the canary release is required), and a negated verb whose object's head
// is data to protect ("must not embed OAuth client secrets", "must not expose GraphQL introspection", "The email doesn't include personal
// data" — PROTECTED_HEADS, whatever the verb and the subject).
// negationKind() → "exclude" | "require" | "none" (a verb negation or anything unsure); words: lower-case, the negator at j, the item at end.
const GOVERN_MAX = 5;
const GOVERN_BOUNDARY = /[.!?;:,\n]/;
const GOVERN_DEONTIC = new Set(["must", "shall", "should", "can", "could", "may", "might", "cannot", "pode", "podem", "poderá", "poderão", "deve",
  "devem", "deverá", "deverão", "debe", "deben", "deberá", "deberán", "puede", "pueden", "podrá", "podrán",
  // (the 1st person plural and the conditional too — "Não devemos ativar…", "No debemos activar…", "deveria")
  "podemos", "devemos", "debemos", "deveria", "deveríamos", "poderia", "poderíamos", "debería", "deberíamos", "podría", "podríamos"]);
// the stem of a contracted negator: can't → "ca", mustn't → "must", shouldn't, shan't → "sha" (won't / don't / doesn't: a plain auxiliary)
const NT_DEONTIC = new Set(["ca", "can", "must", "should", "could", "might", "may", "sha"]);
const GOVERN_AUX = new Set([
  "will", "would", "do", "does", "did", "be", "is", "are", "was", "were", "been", "going", "intend", "intends", "plan", "plans", "planning",
  "want", "wants", "wish", "vamos", "vai", "vão", "iremos", "irá", "irão", "será", "serão", "é", "são", "ser", "queremos", "quero", "quer",
  "querem", "querer", "pretendemos", "pretendo", "pretende", "pretendem", "pretender", "planeamos", "planeio", "planeia", "planejamos",
  "planeja", "planejam", "tencionamos", "tenciona", "va", "van", "es", "son", "se", "hace", "faz", "quiero", "quiere", "quieren",
  "pensamos", "pienso", "piensa", "piensan", "planeo", "planea", "planean", "tenemos", "previsto",
]);
// The volition / intention verbs of GOVERN_AUX: their object is what is wanted — a noun is excluded ("Não queremos Kafka", "We don't want
// Kafka"), a verb states the wish ("We don't want to lose payments", "Não queremos perder pagamentos" — a requirement).
const GOVERN_WANT = new Set(["intend", "intends", "plan", "plans", "planning", "want", "wants", "wish", "queremos", "quero", "quer", "querem",
  "querer", "pretendemos", "pretendo", "pretende", "pretendem", "pretender", "planeamos", "planeio", "planeia", "planejamos", "planeja",
  "planejam", "tencionamos", "tenciona", "quiero", "quiere", "quieren", "pensamos", "pienso", "piensa", "piensan", "planeo", "planea", "planean"]);
const GOVERN_ADOPT = new Set([
  "need", "needs", "needed", "require", "requires", "required", "use", "uses", "using", "add", "adds", "adding", "build", "builds", "building",
  "include", "includes", "including", "introduce", "introduces", "introducing", "implement", "implements", "implementing", "support",
  "supports", "supporting", "have", "has", "having", "adopt", "adopts", "adopting", "rely", "relying", "depend", "depends", "depending",
  "set", "integrate", "integrates", "integrating", "deploy", "deploys", "deploying", "run", "runs", "running", "offer", "offers",
  "offering", "provide", "provides", "providing", "ship", "ships", "create", "creates", "creating", "necessary", "involve", "involves",
  "involving", "envolve", "envolvem", "implica", "implicam", "involucra", "involucran",
  // enabling, installing, embedding, exposing: "must not enable feature flags", "should not bundle Kafka", "must not
  // expose GraphQL" exclude the technology (never data to protect — PROTECTED_HEADS)
  "enable", "enables", "enabling", "activate", "activates", "activating", "turn", "install", "installs", "installing", "embed", "embeds",
  "embedding", "bundle", "bundles", "bundling", "expose", "exposes", "exposing",
  // PT
  "precisa", "precisam", "precisamos", "precisar", "preciso", "necessita", "necessitam", "necessitamos", "necessitar", "necessário",
  "necessária", "necessários", "necessárias", "necessidade", "falta", "usar", "usa", "usam", "usamos", "usará", "usarão", "usaremos",
  "utilizar", "utiliza", "utilizam", "utilizamos", "utilizará", "utilizaremos", "adicionar", "adiciona", "adicionamos", "adicionaremos",
  "acrescentar", "acrescentamos", "incluir", "inclui", "incluem", "incluímos", "incluiremos", "implementar", "implementamos",
  "implementaremos", "introduzir", "ter", "tem", "têm", "temos", "terá", "teremos", "haver", "há", "haverá", "suportar", "suporta",
  "depender", "depende", "dependemos", "recorrer", "integrar", "integra", "integramos", "integraremos", "adotar", "adota", "adotamos",
  "adotaremos", "implantar", "implanta", "implantamos", "implantaremos", "oferecer", "oferece", "oferecemos", "ofereceremos", "fornecer",
  "fornece", "fornecemos", "forneceremos", "disponibilizar", "disponibilizamos", "criar", "cria", "criamos", "criaremos",
  "ativar", "ativa", "ativamos", "ativaremos", "instalar", "instala", "instalamos", "instalaremos", "incorporar", "incorpora", "incorporamos",
  "incorporaremos", "expor", "expõe", "expomos", "exporemos", "habilitar", "habilita", "habilitamos", "habilitaremos", "introduz",
  "introduzimos",
  // ES
  "necesita", "necesitan", "necesitamos", "necesitará", "necesitar", "necesario", "necesaria", "necesarios", "necesarias", "necesidad",
  "usan", "usará", "utilizan", "añadir", "añade", "añadimos", "añadiremos", "agregar", "agrega", "agregamos", "agregaremos", "incluye",
  "incluimos", "introducir", "tener", "tiene", "tienen", "tendrá", "tendremos", "hay", "habrá", "haber", "requiere", "requieren",
  "requerirá", "recurrir", "soportar", "soporta", "integramos", "adoptar", "adopta", "adoptamos", "adoptaremos", "desplegar", "despliega",
  "desplegamos", "desplegaremos", "ofrecer", "ofrece", "ofrecemos", "ofreceremos", "proporcionar", "proporciona", "proporcionamos",
  "proporcionaremos", "crear", "crea", "creamos", "crearemos", "activar", "activa", "activamos", "activaremos", "instalamos", "instalaremos",
  "incrustar", "incrusta", "incrustamos", "exponer", "expone", "exponemos", "expondremos", "habilitar", "introduce", "introducimos",
  // the 3rd-person future of the verbs above ("La versión 2 no añadirá suscripciones", "O MVP não incluirá X"): ES
  "añadirá", "añadirán", "agregará", "agregarán", "incluirán", "integrará", "integrarán", "implementará", "implementarán", "adoptará",
  "adoptarán", "desplegará", "desplegarán", "ofrecerá", "ofrecerán", "proporcionará", "proporcionarán", "creará", "crearán", "activará",
  "activarán", "instalará", "instalarán", "soportará", "soportarán", "necesitarán", "requerirán", "usarán", "utilizarán", "tendrán",
  "habilitará", "habilitarán", "expondrá", "incorporará", "introducirá", "dependerá",
  // PT ("incluirá" is PT and ES)
  "adicionará", "adicionarão", "incluirá", "incluirão", "integrarão", "implementarão", "adotará", "adotarão", "implantará", "implantarão",
  "oferecerá", "oferecerão", "fornecerá", "fornecerão", "criará", "criarão", "ativará", "ativarão", "instalarão", "suportará", "suportarão",
  "precisará", "precisarão", "necessitará", "necessitarão", "utilizarão", "terão", "disponibilizará", "incorporarão", "introduzirá",
  "exporá", "acrescentará",
]);
// DATA TO PROTECT: a negated verb whose object's head noun is protected (PROTECTED_HEADS — a secret, a key, a token, credentials, a
// password, a card number, personal data, PII, introspection, internals, stack traces + PT / ES) states the requirement, never an
// exclusion — whatever the verb (include / contain / send / show / return / log / store / expose / embed / use…) and the subject: "The
// frontend must not embed OAuth client secrets" keeps +tdd, "The API must not expose GraphQL introspection" keeps +api, "The email doesn't
// include personal data" keeps +privacy, "The URL does not include the session token" keeps +tdd; "We must not expose GraphQL" excludes it
// (generalised in verify P3 — by the phrase's head noun, never by the keyword's track: protectedHead()). The N3 verbs,
// expose / embed (GOVERN_EXPOSE), read any protected word in the phrase as before ("must not expose the secrets manager" keeps +sec).
const GOVERN_EXPOSE = new Set(["expose", "exposes", "exposing", "embed", "embeds", "embedding", "expor", "expõe", "expomos", "exporemos", "exponer",
  "expone", "exponemos", "expondremos", "incrustar", "incrusta", "incrustamos", "incorporar", "incorpora", "incorporamos", "incorporaremos"]);
const PROTECTED_HEADS = /(?<![\p{L}])(?:secrets?|keys?|tokens?|credentials?|passwords?|passphrases?|card numbers?|personal data|pii|introspection|internals|stack traces?|segredos?|chaves?|credenciais|credencial|senhas?|palavras?-passe|n[úu]meros? d[oe] cart[ãa]o|dados pessoais|secretos?|claves?|credenciales|contraseñas?|n[úu]meros? de tarjeta|datos personales|introspe(?:c)?ção|introspecci[óo]n)(?![\p{L}])/iu;
// The negators that negate a noun phrase (EN "no" too; ES "no" negates a verb)
const NOMINAL_NEGATORS = new Set(["without", "sem", "sin", "nor", "neither", "nem", "ni", "skip", "exclude", "avoid", "omit", "dispensa", "prescinde"]);
// A hazard's modifier: the negated phrase is the concern, never an exclusion ("We don't want duplicate payments", "Não queremos pagamentos
// duplicados", "without duplicate charges")
const HAZARD_MODS = new Set(["duplicate", "duplicated", "double", "doubled", "lost", "missing", "stale", "corrupt", "corrupted", "inconsistent",
  "orphan", "orphaned", "partial", "duplicado", "duplicados", "duplicada", "duplicadas", "duplos", "duplas", "dobles", "doble", "perdido", "perdidos",
  "perdida", "perdidas", "corrompido", "corrompidos", "corrompida", "corrompidas", "desatualizado", "desatualizados", "obsoletos", "inconsistentes"]);
// A relative pronoun for PEOPLE right before the negator (or before its auxiliary): the negation describes someone, never excludes ("The
// admin who doesn't have MFA must enable it"). A thing's relative clause ("Página interna que no usa LLM", "a page that doesn't use an
// LLM") still excludes with an adoption verb; with any other verb nothing is excluded anyway ("Users that do not pay the subscription").
const REL_PRONOUNS = new Set(["who", "whom", "whose", "quem", "quien", "quienes"]);
// A condition around the negation: a requirement, never an exclusion ("If we don't add rate limiting…", "Se não adicionarmos…", "Si no
// añadimos…", "…unless the admin asks", "a menos que", "salvo que") — in the condition itself: "IF … THEN THE SYSTEM SHALL NOT retry"
// negates in the consequence (a then / então / entonces after the condition word ends it)
const COND_BEFORE = new Set(["if", "unless", "se", "si", "caso"]);
const COND_THEN = new Set(["then", "então", "entao", "entonces"]);
const RE_COND_AFTER = /(?<![\p{L}])(?:unless|except (?:when|if)|a menos que|salvo (?:que|se|si)|a no ser que|exce(?:p)?to (?:se|si|quando|cuando))(?![\p{L}])/iu;
// the people words that negate a whole predicate ("Nobody should access the admin API without SSO": SSO is required)
const NOBODY_WORDS = new Set(["nobody", "noone", "ninguém", "nadie"]);
// "never" and its PT / ES twins: before a verb that is no adoption verb they state a behaviour — a requirement, like a modal's ("a
// second write never overwrites the ledger"); "Nunca usaremos Kafka", "We will never run Kafka" exclude.
const NEVER_WORDS = new Set(["never", "nunca", "jamás", "jamas", "jamais"]);
// A preposition after another noun makes the match that noun's complement, never the negated object: "We didn't add an LLM TO the
// checkout" negates the LLM, not the checkout.
const GOVERN_PREP = new Set(["to", "for", "on", "in", "into", "at", "from", "with", "para", "com", "em", "con", "en"]);
const GOVERN_NEUTRAL = new Set(["on", "for", "to", "up", "yet", "new", "more", "extra", "additional", "external", "separate", "third-party", "ao",
  "novo", "nova", "novos", "novas", "mais", "adicional", "adicionais", "nuevo", "nueva", "nuevos", "nuevas", "más", "adicionales",
  // "We no longer use X", "The app no longer needs X", "Já não usamos X", "Ya no usamos X"
  "longer", "já", "ya"]);
const isNegatorWord = (w, pt) => (NEGATORS.includes(w) && !(pt && w === "no")) || /n['’]t$/.test(w);
const verbForm = (w, ptes) => (w.length > 4 && /ing$/.test(w)) || (ptes && /(?:[aei]r|ndo)$/.test(w));
const passWord = (w) => NEG_FILLER.has(w) || LIST_FILLER.has(w) || GOVERN_NEUTRAL.has(w);
// the PT / ES words among the negators and the volition verbs: a short PT / ES text the language guess reads as English ("No queremos
// perder pagos.") still has its infinitives read as verb forms
const PTES_GOVERN_WORDS = new Set(["sem", "sin", "não", "nao", "nunca", "jamás", "jamas", "jamais", "nem", "ni", "queremos", "quero", "quer",
  "querem", "querer", "pretendemos", "pretendo", "pretende", "pretendem", "pretender", "planeamos", "planeio", "planeia", "planejamos", "planeja",
  "planejam", "tencionamos", "tenciona", "quiero", "quiere", "quieren", "pensamos", "pienso", "piensa", "piensan", "planeo", "planea", "planean"]);
// opts: contrast (the negator opens its segment after a comma, or EN "not" opens the sentence — "Postgres, not MongoDB": nominal),
// protectedHead (a function of `loose` — an expose / embed verb in the stretch —, called at most once and only for a VERB negation — a
// verbal negator, or an adoption verb after a nominal one: "without exposing secrets", "No need for personal data" —: the object phrase
// has a protected head, so the negation is the requirement: "require"). Linear in end - j.
function negationKind(words, j, end, lang, opts = {}) {
  const base = i18n.baseLang(lang);
  let ptes = base === "pt" || base === "es";
  const w = words[j];
  if (PTES_GOVERN_WORDS.has(w)) ptes = true;
  const nominal = NOMINAL_NEGATORS.has(w) || (w === "no" && base !== "es") || !!opts.contrast;
  let guard;
  const guarded = () => {
    if (guard === undefined) guard = !!(opts.protectedHead && opts.protectedHead(words.slice(j + 1, end).some((x) => GOVERN_EXPOSE.has(x))));
    return guard;
  };
  if (!nominal && guarded()) return "require"; // "The email doesn't include personal data", "O email não inclui…"
  let deontic = false, aux = false;
  if (/n['’]t$/.test(w)) { if (NT_DEONTIC.has(w.replace(/n['’]t$/, ""))) deontic = true; else aux = true; }
  else if (w === "cannot" || NEVER_WORDS.has(w)) deontic = true; // "never" states how the system behaves (NEVER_WORDS)
  else if (j > 0 && GOVERN_DEONTIC.has(words[j - 1])) deontic = true; // "must not", "should never"
  else if (j > 0 && GOVERN_AUX.has(words[j - 1])) aux = true; // "will not", "does not"
  // the negated stretch ends at a negative conjunction ("Não queremos Kafka nem …": Kafka is right before it)
  let stop = end;
  for (let i = j + 1; i < end; i++) if (LIST_NEG.has(words[i])) { stop = i; break; }
  let adopted = false, want = false, prevTo = false, modifier = false;
  for (let i = j + 1; i < stop; i++) {
    const x = words[i];
    if (passWord(x)) { prevTo = x === "to"; continue; }
    if (GOVERN_ADOPT.has(x)) {
      if (guarded()) return "require"; // a verb after a nominal negator: "without exposing secrets", "El correo no incluye datos personales"
      adopted = true; prevTo = false; continue;
    }
    if (!adopted && GOVERN_DEONTIC.has(x)) { deontic = true; prevTo = false; continue; }
    if (!adopted && GOVERN_AUX.has(x)) { aux = true; if (GOVERN_WANT.has(x)) want = true; if (PTES_GOVERN_WORDS.has(x)) ptes = true; prevTo = false; continue; }
    // any other word is a verb or a noun that ends the negated phrase — or ONE modifier right before the keyword after an adoption
    // verb, a wish or a nominal negator ("don't use managed Kafka", "without real-time Kafka", "Não queremos o novo Kafka")
    const verbish = prevTo || verbForm(x, ptes);
    if (i === stop - 1 && !modifier && !verbish && (adopted || want || (nominal && !aux && !deontic))) {
      if (HAZARD_MODS.has(x)) return "require"; // "We don't want duplicate payments", "without duplicate charges"
      modifier = true;
      continue;
    }
    // a verb form, or a VERB after a verbal negator / an auxiliary / a modal, states a requirement; a noun — after a nominal negator ("Without
    // payments the checkout…"), an adoption verb or a wish (its object runs on: "Não vamos usar o sistema X nem Y") — ends the negated
    // phrase: nothing is certain — "none"
    if (verbish) return "require";
    if (adopted || want) return "none";
    return !nominal || deontic || aux ? "require" : "none";
  }
  return "exclude";
}
// the clause's words before `start`, lower-case, a quote's apostrophes dropped ("'not add X or Y'")
const govWords = (text, start, bound) => cueWords(cueBefore(text, start, bound)).map((w) => w.toLowerCase().replace(/^['’]+|['’]+$/g, "")).filter(Boolean);
// the comma-free stretch before `start` → { words, afterComma, sentenceStart }
function govSegment(text, start) {
  const seg = cueBefore(text, start, GOVERN_BOUNDARY);
  const at = start - seg.length - 1;
  return { words: govWords(text, start, GOVERN_BOUNDARY), afterComma: at >= 0 && text[at] === ",", sentenceStart: at < 0 || /[.!?;:\n]/.test(text[at]) };
}
// Is the negation at words[j] blocked — a relative clause, a condition, a nominal negator inside a negated predicate, a hazard modifier
// right after the item — whatever it reads like?
function negationBlocked(text, words, j, end, pt) {
  const w = words[j];
  // a people relative pronoun right before the negator or its auxiliary ("who doesn't have", "who do not pay", "quien no paga")
  let r = j - 1;
  if (r >= 0 && (GOVERN_AUX.has(words[r]) || GOVERN_DEONTIC.has(words[r]))) r--;
  if (r >= 0 && REL_PRONOUNS.has(words[r])) return true;
  // a condition before the negator in its stretch (not ended by a then), or an "unless" after the item in its clause
  let cond = false;
  for (let i = 0; i < j; i++) { if (COND_BEFORE.has(words[i])) cond = true; else if (COND_THEN.has(words[i])) cond = false; }
  const after = cueAfter(text, end, CUE_BOUNDARY);
  if (cond || RE_COND_AFTER.test(after)) return true;
  // a nominal negator inside a negated predicate ("We won't ship without a canary release", "Nobody … without SSO"): a double negation
  // (never a negative conjunction: nor / nem / ni continue a negation — "not MongoDB nor Kafka")
  const verbChain = (x) => !!x && (GOVERN_AUX.has(x) || GOVERN_DEONTIC.has(x) || GOVERN_ADOPT.has(x));
  if (NOMINAL_NEGATORS.has(w) && !LIST_NEG.has(w)) for (let i = 0; i < j; i++) {
    const x = words[i];
    if (NOBODY_WORDS.has(x) || /n['’]t$/.test(x) || x === "not" || x === "cannot" || NEVER_WORDS.has(x) || x === "não" || x === "nao" ||
      // "No user can access the admin API without SSO": EN "no" + a noun + a modal negates the predicate
      (x === "no" && !pt && (verbChain(words[i + 1]) || (i + 2 < j && verbChain(words[i + 2]))))) return true;
  }
  // a hazard's modifier right after the item (PT / ES: "pagamentos duplicados", "pagos duplicados")
  const next = (after.match(/[\p{L}\p{N}'’-]+/u) || [""])[0].toLowerCase();
  return HAZARD_MODS.has(next);
}
// The negated verb's object phrase has a protected HEAD: the item and up to four words after it (to a preposition). A protected word is
// no head when it only modifies another noun (now that any verb reads it): an EN compound's head after it ("token cost",
// "secrets manager", "credential stuffing" — PROTECTED_MODIFIED), a PT / ES head before it, linked by de / do / da ("custo de tokens",
// "gestão de segredos"; "token de acesso", "chave de API", "dados pessoais" are data to protect), and the words that only look like it
// (design tokens, an idempotency key, a primary / foreign key — NOT_PROTECTED). `loose` (an expose / embed verb, N3): any protected word.
const PROTECTED_MODIFIED = new Set(["cost", "costs", "manager", "managers", "management", "stuffing", "usage", "count", "limit", "limits",
  "budget"]);
const NOT_PROTECTED = /(?<![\p{L}])(?:design tokens?|idempotency[- ]keys?|primary keys?|foreign keys?)(?![\p{L}])/giu;
const PROTECTED_HEADS_ALL = new RegExp(PROTECTED_HEADS.source, "giu");
const RE_HEAD_INITIAL = /(?:^|\s)(?:de|do|da|dos|das|del)\s/i;
function protectedHead(text, start, end, loose) {
  const after = (cueAfter(text, end, GOVERN_BOUNDARY).match(/[\p{L}\p{N}'’-]+/gu) || []).slice(0, 4);
  const cut = after.findIndex((x) => GOVERN_PREP.has(x.toLowerCase()));
  const phrase = text.slice(start, end) + " " + (cut < 0 ? after : after.slice(0, cut)).join(" ");
  if (loose) return PROTECTED_HEADS.test(phrase);
  const p = phrase.replace(NOT_PROTECTED, " ");
  for (const m of p.matchAll(PROTECTED_HEADS_ALL)) {
    const next = (p.slice(m.index + m[0].length).match(/[\p{L}\p{N}'’-]+/u) || [""])[0].toLowerCase();
    if (!PROTECTED_MODIFIED.has(next) && !RE_HEAD_INITIAL.test(p.slice(0, m.index))) return true;
  }
  return false;
}
// WHAT FOLLOWS A NOMINAL NEGATION — "no X" / "without X" / "sem X" / "sin X" excludes X only when nothing after it turns
// the phrase into a statement about X:
//   (a) a negative-quantifier SUBJECT with a finite verb: "No personal data is sent to the LLM provider", "Ensure no PII is written to
//       the logs", "No API keys are logged", "No tenant can access another tenant's records", "Make sure no personal data ends up in the
//       logs" — a requirement on X (EN "no" opening its stretch or after ensure / make sure / so / that…; PT / ES nenhum / ningún are no
//       negators at all, so their twins were always kept). An adoption participle keeps the exclusion — "No Kafka is needed", "No LLM is
//       used", "No feature flags will be added", "No auth needed" — unless X is data to protect ("No personal data is used for
//       training": protectedHead, as for a negated verb);
//   (b) data to protect kept out of a PLACE: "No secrets in the repository", "No PII in logs", "Sem dados pessoais nos logs", "Sin datos
//       personales en los registros" — never a scope ("No personal data in this feature / in the MVP", "Sin datos personales en esta
//       versión" still exclude), never the bare phrase ("No personal data.");
//   (c) a NEGATIVE PREDICATE over "without X": a denying verb before it in the clause ("Reject requests without a valid access token",
//       "Block logins without two-factor authentication", "Rejeitar pedidos sem…", "Rechazar peticiones sin…") or a negated / denying
//       predicate after it ("Users without MFA must not access the admin panel", "Requests without a token are rejected", "Os
//       utilizadores sem MFA não podem aceder…", "Los usuarios sin MFA no pueden acceder…") — a double negation, like "We won't ship
//       without a canary release" (negationBlocked).
const WITHOUT_WORDS = new Set(["without", "sem", "sin"]);
// (c) the denying verbs — EN / PT / ES, their usual forms ("reject", "rejects", "rejected"…; never "blockchain", "negotiate")
const RE_DENY_VERB = new RegExp("^(?:reject(?:s|ed|ing)?|refus(?:e|es|ed|ing)|den(?:y|ies|ied|ying)|block(?:s|ed|ing)?|forbid(?:s|den|ding)?|" +
  "prohibit(?:s|ed|ing)?|prevent(?:s|ed|ing)?|disallow(?:s|ed|ing)?|" +
  "rejeit(?:ar|a|am|ad[oa]s?)|recus(?:ar|a|am|ad[oa]s?)|neg(?:ar|a|am|ad[oa]s?)|bloque(?:ar|ia|iam|a|an|ad[oa]s?)|imped(?:ir|e|em|id[oa]s?)|" +
  "pro[ií]b(?:ir|e|em|id[oa]s?)|rechaz(?:ar|a|an|ad[oa]s?)|deneg(?:ar|ad[oa]s?)|denieg(?:a|an)|nieg(?:a|an)|impid(?:e|en)|prohíb(?:e|en))$", "u");
// (c) after the item: the copulas a denying participle follows ("are rejected", "são bloqueados", "son rechazadas")
const DENY_COPULA = new Set(["is", "are", "was", "were", "be", "been", "get", "gets", "got", "é", "são", "será", "serão", "fica", "ficam", "es", "son",
  "será", "serán", "queda", "quedan"]);
// (c) PT / ES "não" / "no" + a modal or an access verb ("não podem", "não têm acesso", "no pueden", "no tienen acceso")
const NEG_MODAL_PTES = new Set(["pode", "podem", "poderá", "poderão", "deve", "devem", "deverá", "deverão", "consegue", "conseguem", "tem", "têm",
  "puede", "pueden", "podrá", "podrán", "debe", "deben", "deberá", "deberán", "tiene", "tienen", "acede", "acedem", "accede", "acceden"]);
const NEG_PRED_WINDOW = 6; // (c) the words after the item a negated predicate may start within ("Admins without two-factor authentication cannot…")
function negativePredicate(text, start, end) {
  // a denying verb anywhere before the item in its clause (the clause, not the comma-free stretch: "Reject, with a 401, any request without…")
  if (govWords(text, start, CUE_BOUNDARY).some((x) => RE_DENY_VERB.test(x))) return true;
  const after = cueWords(cueAfter(text, end, CUE_BOUNDARY)).slice(0, NEG_PRED_WINDOW + 2).map((x) => x.toLowerCase());
  for (let p = 0; p < after.length && p <= NEG_PRED_WINDOW; p++) {
    const x = after[p];
    if (/n['’]t$/.test(x) || x === "cannot" || NEVER_WORDS.has(x)) return true;
    if (x === "not" && p > 0 && (GOVERN_DEONTIC.has(after[p - 1]) || GOVERN_AUX.has(after[p - 1]))) return true;
    if ((x === "não" || x === "nao" || x === "no") && NEG_MODAL_PTES.has(after[p + 1])) return true;
    if (p > 0 && DENY_COPULA.has(after[p - 1]) && RE_DENY_VERB.test(x)) return true;
    if (WITHOUT_WORDS.has(x) || LIST_AND.has(x)) return false; // (another "without" / a new predicate: nothing of this item's)
  }
  return false;
}
// (c) an INSUFFICIENCY predicate over "without X" — X is needed: "Without an LLM summary the ticket view is incomplete", "Sem
// um resumo por LLM a vista fica incompleta", "Sin un resumen con LLM la vista queda incompleta", "… is useless / would be broken / is
// not usable". A copula (≤ 2 adverbs between) then an insufficiency adjective, within INSUFF_WINDOW words of the item's clause.
const INSUFF_COPULA = new Set(["is", "are", "was", "were", "be", "becomes", "become", "stays", "stay", "remains", "remain", "feels", "feel", "looks",
  "look", "seems", "seem", "gets", "get", "é", "são", "fica", "ficam", "ficaria", "está", "estão", "será", "serão", "seria", "torna-se", "es", "son",
  "queda", "quedan", "quedaría", "están", "serán", "sería", "resulta", "resultan"]);
const INSUFF_ADJ = new Set(["incomplete", "useless", "broken", "unusable", "pointless", "worthless", "insufficient", "inadequate", "meaningless",
  "impractical", "unreadable", "half-baked", "crippled", "incompleto", "incompleta", "incompletos", "incompletas", "inútil", "inúteis", "inutilizável",
  "inutilizáveis", "insuficiente", "insuficientes", "inservible", "inservibles", "inútiles"]);
const INSUFF_NOT = new Set(["usable", "useful", "enough", "complete", "sufficient", "viable", "possible"]);
const INSUFF_WINDOW = 10;
const NO_MORE = new Set(["more", "más", "mas", "mais"]); // (negationOf) "no more X" — a replacement, never an exclusion
function insufficientAfter(text, end) {
  const after = cueWords(cueAfter(text, end, CUE_BOUNDARY)).slice(0, INSUFF_WINDOW + 3).map((x) => x.toLowerCase());
  for (let p = 1; p < after.length && p <= INSUFF_WINDOW + 2; p++) {
    const x = after[p];
    if (WITHOUT_WORDS.has(x)) return false; // (another "without": nothing of this item's)
    const adj = INSUFF_ADJ.has(x) || (INSUFF_NOT.has(x) && after[p - 1] === "not");
    if (!adj) continue;
    for (let q = p - 1; q >= Math.max(0, p - 3); q--) if (INSUFF_COPULA.has(after[q])) return true;
  }
  return false;
}
// (a) the finite verbs after a negated subject: auxiliaries and modals (their next verb decides), and the verbs a datum's or a tenant's
// requirement is written with ("leaks", "reaches", "ends up", "leaves", "can access"…)
const SUBJECT_AUX = new Set(["is", "are", "was", "were", "will", "would", "may", "might", "can", "could", "must", "should", "shall", "has", "have",
  "had", "does", "do", "gets", "get", "ever"]);
const SUBJECT_VERBS = new Set(["leaks", "leak", "reaches", "reach", "leaves", "leave", "ends", "end", "goes", "go", "crosses", "cross", "flows",
  "flow", "appears", "appear", "escapes", "escape", "travels", "travel", "passes", "pass", "lands", "land", "enters", "enter", "shows", "show",
  "remains", "remain", "stays", "stay", "persists", "persist", "sees", "see", "accesses", "access", "reads", "read", "touches", "touch", "exceeds",
  "exceed", "receives", "receive", "makes"]);
// (a) the words that may follow the auxiliary before its verb ("will be added", "has been sent", "is ever written", "is never logged")
const SUBJECT_AUX_GAP = new Set(["be", "been", "being", "ever", "never", "not", "get", "got", "also", "still"]);
// (a) an adoption participle (or a "needed" adjective): the subject phrase states what is NOT adopted — "No Kafka is needed", "No LLM is
// used", "No auth needed"
const ADOPT_PARTICIPLES = new Set(["needed", "required", "necessary", "used", "added", "included", "introduced", "implemented", "supported",
  "adopted", "integrated", "deployed", "run", "offered", "provided", "shipped", "created", "built", "involved", "enabled", "activated",
  "installed", "embedded", "bundled", "exposed", "planned", "wanted", "allowed", "permitted", "expected", "considered", "involved"]);
// (a) the words that end the subject phrase before any verb ("No Kafka, just…", "No LLM and the…", "No auth because…")
const SUBJECT_END = new Set(["and", "but", "so", "because", "since", "as", "while", "though", "although", "just", "only", "instead", "unless",
  "if", "when", "then", "yet", "except", "rather"]);
// (a) the words after which an EN "no" opens a subject ("Ensure no PII is…", "Make sure no personal data…", "… so no PII reaches…")
const SUBJECT_INTRO = new Set(["ensure", "ensures", "ensuring", "guarantee", "guarantees", "sure", "that", "so", "where", "and", "but",
  "because", "since", "verify", "check", "assert", "confirm", "then"]);
// (b) the prepositions of a place, and the scope words that make it no place ("in this feature", "in the MVP", "nesta versão")
const PLACE_PREPS = new Set(["in", "into", "on", "to", "within", "inside", "em", "no", "na", "nos", "nas", "num", "numa", "para", "ao", "aos", "à",
  "às", "dentro", "en", "al", "a"]);
const SCOPE_WORDS = new Set(["this", "these", "feature", "features", "mvp", "scope", "release", "version", "v1", "v2", "phase", "iteration",
  "sprint", "project", "prototype", "poc", "pilot", "milestone", "story", "ticket", "spec", "first", "initial", "beta", "launch", "esta", "este",
  "estas", "estes", "isto", "esto", "funcionalidade", "funcionalidades", "funcionalidad", "âmbito", "alcance", "versão", "versión", "fase",
  "projeto", "projecto", "proyecto", "protótipo", "prototipo", "piloto", "iteração", "iteración", "lançamento", "lanzamiento", "primeira",
  "primeiro", "primera", "primero"]);
const PLACE_SKIP = new Set(["the", "a", "an", "our", "its", "their", "any", "o", "os", "as", "um", "uma", "nosso", "nossa", "el", "la", "los",
  "las", "un", "una", "nuestro", "nuestra"]);
function nominalFollowRequires(text, start, end, words, j, lang) {
  const w = words[j];
  const en = w === "no" && i18n.baseLang(lang) !== "es";
  if (!en && !WITHOUT_WORDS.has(w)) return false;
  let prot;
  const protect = () => (prot === undefined ? (prot = protectedHead(text, start, end, false)) : prot);
  const after = cueWords(cueAfter(text, end, GOVERN_BOUNDARY)).slice(0, 10).map((x) => x.toLowerCase());
  // (a) EN "no" opening a subject (never right after a verb: "WHEN the month has no invoices THE SYSTEM SHALL…" is an object)
  if (en && (j === 0 || SUBJECT_INTRO.has(words[j - 1]))) {
    for (let k = 0; k < after.length && k <= 4; k++) {
      const x = after[k];
      if (SUBJECT_AUX.has(x)) {
        let p = k + 1;
        while (p < after.length && p <= k + 3 && SUBJECT_AUX_GAP.has(after[p])) p++;
        return !(ADOPT_PARTICIPLES.has(after[p]) || GOVERN_ADOPT.has(after[p])) || protect();
      }
      if (SUBJECT_VERBS.has(x)) return true;
      if (ADOPT_PARTICIPLES.has(x) || GOVERN_ADOPT.has(x) || SUBJECT_END.has(x)) break;
    }
  }
  // (b) data to protect kept out of a place (≤ 1 more word of its phrase before the preposition)
  if (!protect()) return false;
  const at = PLACE_PREPS.has(after[0]) ? 0 : PLACE_PREPS.has(after[1]) && !GOVERN_ADOPT.has(after[0]) && !ADOPT_PARTICIPLES.has(after[0]) ? 1 : -1;
  if (at < 0 || (after[at] === "a" && i18n.baseLang(lang) === "en")) return false;
  let q = at + 1;
  while (q < after.length && PLACE_SKIP.has(after[q])) q++;
  return q < after.length && !SCOPE_WORDS.has(after[q]) && !SCOPE_WORDS.has(after[at + 1]);
}
// WHOSE ADOPTION IS NEGATED — a verbal negation of an adoption verb excludes only when its SUBJECT is the one
// designing: the first person ("We don't use Kafka", "Não usamos Kafka", "No usaremos ningún LLM"), the system being built ("The
// service must not use Redis", "This feature does not require an LLM", "O sistema não deve usar Redis") or none at all (an imperative, an
// infinitive, "Não é necessário um LLM", "No se necesita un LLM"). Any other subject — a role, a user group, a plan / tier / edition /
// account / tenant — states an access or entitlement rule, and the track stays: "Guests can't use the checkout", "Free users may not use
// the LLM assistant", "The Starter plan doesn't include the LLM assistant", "Os editores não podem adicionar feature flags", "Las
// cuentas de prueba no incluyen el asistente LLM". A subject that can't be read (a noun in neither list) keeps the track too — but a
// component (a singular noun after the / this / our, o / este / o nosso, el / este / nuestro) after a plain negation excludes. The
// subject (subjectOf) is the nearest listed noun back to the clause start (the comma-free stretch), past a prepositional phrase
// ("Tenants ON the free plan", "Um utilizador SEM subscrição") and a relative clause ("Guests WHO open the page"); an EN "no" after an
// adoption verb negates its noun for certain — only a role keeps it ("The free plan has no webhooks"; "The MVP has no LLM" excludes).
// "cannot" reads as "can't" (NEGATORS). Linear in the stretch (one pass back, bounded look-backs; the sentence's earlier words ≤ 24).
const FIRST_PERSON = new Set(["we", "i", "us", "our", "ours", "ourselves", "let's", "lets", "nós", "nossa", "nosso", "nossas", "nossos",
  "eu", "nosotros", "nosotras", "nuestro", "nuestra", "nuestros", "nuestras", "yo"]);
const ROLE_SUBJECTS = new Set([
  "user", "users", "guest", "guests", "visitor", "visitors", "viewer", "viewers", "editor", "editors", "admin", "admins", "administrator",
  "administrators", "member", "members", "customer", "customers", "client", "clients", "tenant", "tenants", "account", "accounts", "plan",
  "plans", "tier", "tiers", "edition", "editions", "subscriber", "subscribers", "subscription", "subscriptions", "license", "licenses",
  "licence", "licences", "seat", "seats", "owner", "owners", "operator", "operators", "staff", "employee", "employees", "manager",
  "managers", "role", "roles", "anyone", "everyone", "nobody", "people", "person", "buyer", "buyers", "seller", "sellers", "merchant",
  "merchants", "vendor", "vendors", "partner", "partners", "reseller", "resellers", "affiliate", "affiliates", "student", "students",
  "teacher", "teachers", "patient", "patients", "doctor", "doctors", "driver", "drivers", "rider", "riders", "author", "authors", "reader",
  "readers", "contributor", "contributors", "moderator", "moderators", "reviewer", "reviewers", "approver", "approvers", "workspace",
  "workspaces", "organization", "organizations", "organisation", "organisations", "org", "orgs", "household", "households", "family",
  "families",
  // PT
  "utilizador", "utilizadores", "usuário", "usuários", "convidado", "convidados", "convidada", "convidadas", "visitante", "visitantes",
  "editores", "administrador", "administradores", "membro", "membros", "cliente", "clientes", "inquilino", "inquilinos", "conta", "contas",
  "plano", "planos", "escalão", "escalões", "nível", "níveis", "edição", "edições", "assinante", "assinantes", "subscritor", "subscritores",
  "assinatura", "assinaturas", "subscrição", "subscrições", "licença", "licenças", "funcionário", "funcionários", "gestor", "gestores",
  "perfil", "perfis", "papel", "papéis", "operador", "operadores", "leitor", "leitores", "autor", "autores", "aluno", "alunos", "professor",
  "professores", "paciente", "pacientes", "doente", "doentes", "médico", "médicos", "motorista", "motoristas", "comprador", "compradores",
  "vendedor", "vendedores", "lojista", "lojistas", "parceiro", "parceiros", "revendedor", "revendedores", "moderador", "moderadores",
  "colaborador", "colaboradores", "pessoa", "pessoas", "ninguém", "organização", "organizações",
  // ES
  "usuario", "usuarios", "usuaria", "usuarias", "invitado", "invitados", "invitada", "invitadas", "miembro", "miembros", "cuenta",
  "cuentas", "planes", "nivel", "niveles", "edición", "ediciones", "suscriptor", "suscriptores", "suscripción", "suscripciones", "licencia",
  "licencias", "empleado", "empleados", "perfiles", "rol", "roles", "lector", "lectores", "alumno", "alumnos", "estudiante", "estudiantes",
  "profesores", "conductor", "conductores", "socio", "socios", "persona", "personas", "nadie", "organización", "organizaciones",
]);
const DESIGN_SUBJECTS = new Set([
  "system", "systems", "service", "services", "app", "apps", "application", "applications", "api", "apis", "backend", "frontend", "server",
  "servers", "platform", "product", "solution", "feature", "features", "module", "modules", "component", "components", "mvp", "version",
  "versions", "release", "releases", "v1", "v2", "v3", "design", "architecture", "implementation", "integration", "job", "jobs", "worker",
  "workers", "pipeline", "pipelines", "bot", "chatbot", "engine", "dashboard", "dashboards", "reports", "page", "pages", "screen",
  "screens", "ui", "website", "site", "portal", "widget", "form", "script", "scripts", "tool", "library", "sdk", "cli", "prototype",
  "project", "code", "codebase", "stack", "infrastructure", "infra", "microservice", "microservices", "function", "functions", "endpoint",
  "endpoints", "handler", "handlers", "database", "cache", "checkout", "cart", "webhook", "webhooks", "logs", "logging", "assistant", "it",
  "this", "phase", "iteration", "milestone", "poc", "pilot", "spec",
  // PT
  "sistema", "sistemas", "serviço", "serviços", "aplicação", "aplicações", "aplicativo", "funcionalidade", "funcionalidades", "módulo",
  "módulos", "componente", "componentes", "versão", "versões", "desenho", "arquitetura", "arquitectura", "implementação", "integração",
  "página", "páginas", "ecrã", "ecrãs", "tela", "telas", "relatório", "relatórios", "painel", "painéis", "plataforma", "produto", "solução",
  "servidor", "projeto", "projecto", "código", "protótipo", "ferramenta", "biblioteca", "motor", "assistente", "formulário", "carrinho",
  "isto", "fase", "iteração",
  // ES
  "servicio", "servicios", "aplicación", "aplicaciones", "función", "funciones", "funcionalidad", "funcionalidades", "versión", "versiones",
  "diseño", "implementación", "integración", "pantalla", "pantallas", "informe", "informes", "reporte", "reportes", "panel", "paneles",
  "producto", "solución", "proyecto", "prototipo", "herramienta", "librería", "formulario", "carrito", "esto", "iteración",
]);
// a noun that is a verb too, or the team (a user group once modified: "the support team") — a design subject only right after an
// article or a possessive ("The export must not use…", "The team / A equipa / El equipo won't use Kafka"; "Users export data…")
const DESIGN_VERBISH = new Set(["export", "exports", "import", "imports", "sync", "report", "search", "login", "signup", "upload",
  "download", "process", "flow", "flows", "log", "team", "equipa", "equipo"]);
// the words that are no subject: articles, determiners, conjunctions, discourse adverbs (and any EN -ly / PT / ES -mente adverb)
const SUBJECT_SKIP = new Set(["the", "a", "an", "these", "those", "any", "all", "some", "each", "every", "both", "only", "also", "still",
  "currently", "really", "simply", "just", "even", "yet", "therefore", "so", "then", "however", "thus", "already", "always", "please",
  "and", "but", "or", "now", "today", "here", "there", "that", "which", "o", "os", "as", "um", "uma", "uns", "umas", "este", "esta",
  "estes", "estas", "esse", "essa", "esses", "essas", "todos", "todas", "cada", "só", "apenas", "também", "ainda", "já", "portanto",
  "então", "e", "mas", "ou", "porém", "contudo", "agora", "hoje", "aqui", "que", "el", "la", "los", "las", "un", "una", "unos", "unas",
  "estos", "ese", "esa", "esos", "esas", "solo", "sólo", "también", "todavía", "aún", "ya", "entonces", "y", "pero", "ahora", "hoy", "aquí",
  "se", "lo"]);
const SUBJECT_ARTICLES = new Set(["the", "a", "an", "this", "these", "those", "o", "os", "as", "um", "uma", "este", "esta", "estes",
  "estas", "el", "la", "los", "las", "un", "una", "estos"]);
// a preposition (or a nominal negator) before a listed noun makes it a complement: the subject is further back
const SUBJECT_PREP = new Set(["of", "on", "in", "for", "with", "without", "from", "at", "by", "under", "de", "do", "da", "dos", "das", "em",
  "na", "nas", "com", "sem", "para", "por", "pelo", "pela", "pelos", "pelas", "del", "en", "con", "sin", "al"]);
// the relative pronouns: a listed noun after one is inside a relative clause ("Guests who open the page") — "that" / "que" only right
// after a listed noun ("Guests that open…"; "ensure that guests…" is a complement clause)
const SUBJECT_REL = new Set(["who", "whom", "whose", "which", "quem", "quien", "quienes", "cuyo", "cuya", "cuyos", "cuyas", "cujo", "cuja"]);
// a PT / ES first-person plural verb ("usamos", "vamos", "decidimos", "incluímos" — in any text: a short one may read as EN) — never
// an adjective or a noun in -mos
const MOS_WORDS = new Set(["últimos", "próximos", "mínimos", "máximos", "íntimos", "ótimos", "óptimos", "legítimos", "extremos", "supremos",
  "ramos", "termos", "demos", "memos", "promos", "primos", "mismos", "mesmos"]);
// the EN first person contracted: we're, we'll, we've, we'd, i'm, i'll, i've, i'd
const RE_FIRST_PERSON_NT = /^(?:we|i)['’](?:re|ll|ve|d|m)$/;
const firstPerson = (x) => FIRST_PERSON.has(x) || RE_FIRST_PERSON_NT.test(x);
const firstPersonVerb = (x) => x.length > 4 && /[aeiíé]mos$/.test(x) && !MOS_WORDS.has(x);
const subjectSkip = (x) => SUBJECT_SKIP.has(x) || GOVERN_AUX.has(x) || GOVERN_DEONTIC.has(x) || GOVERN_ADOPT.has(x) || NEVER_WORDS.has(x) ||
  NEGATORS.includes(x) || /n['’]t$/.test(x) || x === "cannot" || (x.length > 4 && /(?:ly|mente)$/.test(x));
// the listed noun at words[i]: "role" | "design" | null ("plan" / "plans" before "not" / "to" is the verb: "We plan not to use Kafka")
function subjectNoun(words, i) {
  const x = words[i];
  if (DESIGN_SUBJECTS.has(x)) return "design";
  if (DESIGN_VERBISH.has(x)) return i > 0 && (SUBJECT_ARTICLES.has(words[i - 1]) || firstPerson(words[i - 1])) ? "design" : null;
  if (!ROLE_SUBJECTS.has(x)) return null;
  return (x === "plan" || x === "plans") && (words[i + 1] === "not" || words[i + 1] === "to") ? null : "role";
}
// a candidate subject at words[i] is a complement — [prep][modifiers…][noun]; an article disables the preposition test — or inside a
// relative clause (a relative pronoun up to 6 words back, before another listed word): the index to resume before, or -1 (a subject)
function complementAt(words, i) {
  let article = false;
  for (let p = i - 1, n = 0; p >= 0 && n < 6; p--, n++) {
    const y = words[p];
    if (!article && n < 4 && SUBJECT_PREP.has(y)) return p;
    if (SUBJECT_REL.has(y) || ((y === "that" || y === "que") && p > 0 && subjectNoun(words, p - 1))) return p;
    if (firstPerson(y) || (!SUBJECT_ARTICLES.has(y) && subjectNoun(words, p))) return -1;
    if (SUBJECT_ARTICLES.has(y)) article = true;
  }
  return -1;
}
// a COMPONENT of what is being designed: a noun in no list with a singular definite article, demonstrative or possessive
// ≤ 3 modifiers back ("The importer", "The new search", "El programador de tareas", "O agendador"; PT "a" only in a PT text — EN "a" is
// indefinite); an EN noun in -s after the / this / our / its is a plural ("The drivers"), and a bare plural has no determiner at all
const SINGULAR_DETS_EN = new Set(["the", "this", "our", "its"]);
const SINGULAR_DETS = new Set(["o", "este", "esta", "nosso", "nossa", "el", "la", "nuestro", "nuestra"]);
function componentAt(words, i, pt) {
  const x = words[i];
  for (let p = i - 1, n = 0; p >= 0 && n <= 3; p--, n++) {
    const y = words[p];
    if (SINGULAR_DETS_EN.has(y)) return !(x.length > 3 && /[^su]s$/.test(x));
    if (SINGULAR_DETS.has(y) || (pt && y === "a")) return true;
    if (subjectSkip(y) || SUBJECT_PREP.has(y) || SUBJECT_REL.has(y) || firstPerson(y) || subjectNoun(words, p)) return false;
  }
  return false;
}
// → "design" | "role" | "component" | "none" (no subject word) | "unknown" (content words, none listed); words[0 … j) is the stretch
// before the verb. The nearest listed word decides — but a design noun may be an earlier verb's object ("Guests can view the page but
// can't use the checkout"): a role further back still keeps (when in doubt, keep); a noun right before another listed one is its
// modifier ("the admin page"). With no listed word, the nearest other noun that is no complement may be a component (componentAt).
function subjectOf(words, j, pt) {
  let content = false, design = false, head = false, component = false;
  for (let i = j - 1; i >= 0; i--) {
    const x = words[i];
    if (firstPerson(x) || firstPersonVerb(x)) return "design";
    let kind = subjectNoun(words, i);
    if (kind && !SUBJECT_ARTICLES.has(x) && i + 1 < j && subjectNoun(words, i + 1)) kind = null;
    if (!kind) {
      if (subjectSkip(x)) continue;
      content = true;
      if (!head) { // the nearest other noun: past a complement; its determiner read once
        const skip = complementAt(words, i);
        if (skip >= 0) { i = skip; continue; }
        head = true;
        component = componentAt(words, i, pt);
      }
      continue;
    }
    content = true;
    const skip = complementAt(words, i);
    if (skip >= 0) { i = skip; continue; } // the loop's i-- resumes before the preposition / the relative pronoun
    if (kind === "role") return "role";
    design = true;
  }
  return design ? "design" : component ? "component" : content ? "unknown" : "none";
}
// a plain verbal negation — an auxiliary or a present / future verb (does not / won't / will not, não usa / não vai usar / no usará),
// never a modal (can't / cannot / may not / must not, não pode / não deve, no puede / no debe)
function plainNegation(words, j) {
  const w = words[j];
  if (w === "cannot") return false;
  if (/n['’]t$/.test(w)) return !NT_DEONTIC.has(w.replace(/n['’]t$/, ""));
  if (j > 0 && GOVERN_DEONTIC.has(words[j - 1])) return false;
  return !(j + 1 < words.length && GOVERN_DEONTIC.has(words[j + 1]));
}
// Does the subject keep the negated adoption's track (a role, a plan, or an unreadable subject)? words / j as negationOf's, the subject
// before words[from]; after a comma with no subject in its stretch ("Guests, however, can't use the checkout") the sentence's earlier
// words are read — a role there keeps. An EN "no" after the verb (from < j) negates its noun for certain: only a role keeps ("The free
// plan has no webhooks"; "WHEN the month has no invoices" still excludes). A component excludes after a plain verbal
// negation ("The importer does not need Kafka", "El importador no necesita Kafka") and keeps after a modal, like an unread subject.
function subjectKeeps(text, start, words, j, from, pt) {
  for (let i = j + 1; i < words.length; i++) if (firstPersonVerb(words[i])) return false; // "não usamos", "no usaremos"
  const s = subjectOf(words, from, pt || words[j] === "não" || words[j] === "nao");
  if (s === "role" || ((s === "unknown" || (s === "component" && !plainNegation(words, j))) && from === j)) return true;
  if (s !== "none") return false; // design, a component after a plain negation, or an EN "no" after the verb (from < j)
  const seg = cueBefore(text, start, GOVERN_BOUNDARY);
  const at = start - seg.length - 1;
  if (at < 0 || text[at] !== ",") return false;
  const earlier = govWords(text, at, /[.!?;:\n]/);
  return subjectOf(earlier.slice(-24), Math.min(earlier.length, 24), pt) === "role";
}
// Is the negator at words[j] verbal — an adoption verb's negation whose subject decides (not a nominal "no X" / "sem X" / "without X",
// nor a contrast) — or an EN "no" right after an adoption verb ("The free plan has no webhooks": the verb's subject decides)?
function subjectDecides(words, j, lang, contrast) {
  const w = words[j];
  // (a contraction opening its stretch after a comma is still verbal: "Guests, however, can't use the checkout")
  if (contrast && !(/n['’]t$/.test(w) || w === "cannot")) return -1;
  if (w === "no" && i18n.baseLang(lang) !== "es") {
    // a verb right after it: an ES "no" in a short text read as EN ("Los invitados no pueden usar el checkout"), "no longer uses"
    let k = j + 1;
    while (k < words.length && GOVERN_NEUTRAL.has(words[k])) k++;
    const v = words[k];
    if (v && (GOVERN_DEONTIC.has(v) || GOVERN_AUX.has(v) || GOVERN_ADOPT.has(v))) return j;
    return j > 0 && GOVERN_ADOPT.has(words[j - 1]) ? j - 1 : -1;
  }
  return NOMINAL_NEGATORS.has(w) ? -1 : j;
}
// The negation that EXCLUDES the item at start … end — { word, conj } — or null. The nearest negator ≤ GOVERN_MAX words back in the
// item's comma-free stretch (contractions whole): a negative conjunction with only fillers between (a list's own link); any other one
// when it is no relative / condition / double negation / hazard (negationBlocked) and negationKind says "exclude". A PT "no" after a
// participle or before a PT filler is em + o ("aplicado no checkout", "Guia no uso do LLM"). A cheap precheck skips a match with no
// negator in reach.
function negationOf(text, start, end, lang, cased) {
  if (!RE_NEG_NEAR.test(text.slice(Math.max(0, start - CUE_SPAN), start))) return null;
  const pt = i18n.baseLang(lang) === "pt"; // pt and pt-BR alike: "no" is em+o, never a negator
  const tokens = text.slice(Math.max(0, start - 20), start).split(/[^a-zà-ú-]+/).filter(Boolean);
  if (tokens[tokens.length - 1] === "no") {
    const prev = tokens[tokens.length - 2] || "";
    const prevCased = ((cased || "").slice(Math.max(0, start - 20), start).split(/[^\p{L}-]+/u).filter(Boolean).slice(-2)[0]) || "";
    if (/(?:ad|id)[oa]s?$/.test(prev) && (pt || (prev.length >= 6 && prevCased === prevCased.toLowerCase()))) return null;
  }
  const seg = govSegment(text, start);
  const words = seg.words;
  let j = -1;
  for (let i = words.length - 1, n = 0; i >= 0 && n <= GOVERN_MAX; i--, n++) if (isNegatorWord(words[i], pt)) { j = i; break; }
  if (j < 0) return null;
  const w = words[j];
  // "no more X" / "no más X" is a REPLACEMENT — the request does X differently ("No more manual invoices: generate them
  // automatically"), "no more than N" a limit — never an exclusion of X
  if ((w === "no" || w === "não" || w === "nao") && NO_MORE.has(words[j + 1])) return null;
  if (LIST_NEG.has(w)) return words.slice(j + 1).every(passWord) && !negationBlocked(text, words, j, end, pt) ? { word: w, conj: true } : null;
  if (w === "no" && j + 1 < words.length && NEG_FILLER.has(words[j + 1]) && !NEG_FILLER_EN.has(words[j + 1])) return null;
  if (negationBlocked(text, words, j, end, pt)) return null;
  // (1.24 r6 F5 (c)) a negative predicate over "without X" — "Reject requests without a valid access token", "Users without MFA must not…"
  // … or an insufficiency predicate — "Without an LLM summary the ticket view is incomplete": X is needed
  if (WITHOUT_WORDS.has(w) && (negativePredicate(text, start, end) || insufficientAfter(text, end))) return null;
  const contrast = j === 0 && (seg.afterComma || (w === "not" && seg.sentenceStart));
  const k = negationKind(words, j, words.length, lang, { contrast, protectedHead: (loose) => protectedHead(text, start, end, loose) });
  if (k !== "exclude") return null;
  // (1.24 r6 F5 (a) / (b)) what follows the item — "No personal data is sent…", "No secrets in the repository"
  if (nominalFollowRequires(text, start, end, words, j, lang)) return null;
  // a role's / a plan's negated adoption is an access or entitlement rule: the track stays
  const from = subjectDecides(words, j, lang, contrast);
  return from >= 0 && subjectKeeps(text, start, words, j, from, pt) ? null : { word: w, conj: false };
}
function negationGoverns(text, start, end, lang) {
  return negationOf(text, start, end, lang) !== null;
}
// A nor / nem / ni item no list carries keeps its negation (the conjunction right before it is certain) unless its clause's other negator
// negates a VERB (negationKind "require") — the conjunction then continues that requirement: "Não pode perder pagamentos nem
// reembolsos", "must not lose data nor refunds", "sem perder dados nem reembolsos", "does not show X nor Y" un-negate the item; "Não
// queremos Kafka nem RabbitMQ", "We use Postgres, not MongoDB nor Kafka", "Sem integração externa nem X" and the correlative "Nem X nem
// Y" keep it.
function conjExcluded(text, start, end, lang) {
  const pt = i18n.baseLang(lang) === "pt";
  const seg = govSegment(text, start);
  const words = seg.words;
  let j = words.length - 1;
  while (j >= 0 && !((isNegatorWord(words[j], pt) || words[j] === "cannot") && !LIST_NEG.has(words[j]))) j--;
  if (j < 0) return true;
  if (negationBlocked(text, words, j, end, pt)) return false;
  const contrast = j === 0 && (seg.afterComma || (words[j] === "not" && seg.sentenceStart));
  // (a verb negation — "require" — is continued by the conjunction; a noun phrase — "Sem integração externa nem X" — keeps it; a role's
  // or a plan's negated adoption — "Guests can't use the checkout nor the cart" — keeps the track: 1.21 verify P1)
  if (negationKind(words, j, words.length, lang, { contrast, protectedHead: (loose) => protectedHead(text, start, end, loose) }) === "require") return false;
  const from = subjectDecides(words, j, lang, contrast);
  return !(from >= 0 && subjectKeeps(text, start, words, j, from, pt));
}
// The article a new clause's subject starts with: a comma followed by one is no list continuation — "Without an LLM
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
  // whose own look-back now sees a verb form)
  // … and a HAZARD phrase keeps the keywords inside it un-negated: "without duplicate rows" negates neither 'rows' (its negation is the
  // requirement — the farther look-back reached the inner word)
  const hazardItem = (it) => it.hits.some((h) => h.hazard && h.start === it.start);
  for (const it of items) {
    if (hazardItem(it)) { for (const h of it.hits) if (h.neg && h.negBy !== "after") { h.neg = false; h.negBy = null; h.conj = false; } continue; }
    const head = it.hits.find((h) => h.start === it.start && h.negBy === "before" && !h.hazard);
    if (!head) continue;
    // (the keywords INSIDE the phrase — one starting where it starts had the same look-back, and a +sec / +privacy one may have read
    // "must not embed" as its requirement: "must not embed the API key")
    for (const h of it.hits) if (!h.negBy && !h.hazard && h.start > it.start) { h.neg = true; h.negBy = "before"; h.conj = head.conj; }
  }
  // a hazard's negation is its requirement ("without downtime"), never a list's: it opens none — nor does a negator that governs a
  // verb, not the item ("must not lose payments or refunds")
  const opens = (it) => !hazardItem(it) && it.hits.some((h) => h.negBy === "before" && !h.hazard) && negationGoverns(text, it.start, it.end, lang);
  const mark = (it) => { for (const h of it.hits) if (!h.hazard) { h.neg = true; if (!h.negBy) h.negBy = "list"; } };
  // the gap's first word is an article
  const articleFirst = (from, to) => { const w = cueWords(text.slice(from, to))[0]; return !!w && LIST_ARTICLES.has(w.toLowerCase()); };
  // closed: a conjunction has closed the list — a later comma ends it (a list has one closing conjunction).
  // listTracks: the tracks of the list's items so far — a comma + an article still joins an item of one of them ("Without an LLM, a
  // vector database or embeddings", "Without Kafka, the RabbitMQ broker or SQS"), never another track's item: that is a new clause's
  // subject ("No LLM, the checkout or the subscription flow first"); and a predicate after the closing item (an
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
    } else if (it.hits.some((h) => h.conj) && !conjExcluded(text, it.start, it.end, lang)) {
      // a negative conjunction no list carries, in a clause whose negator states a requirement ("Não pode perder
      // pagamentos nem reembolsos", "No puede perder pagos ni reembolsos"), continues that requirement, not a list of exclusions: its
      // item is not negated either
      for (const h of it.hits) if (h.conj) { h.neg = false; h.negBy = null; h.conj = false; }
    }
    if (opens(it)) { open(it); continue; }
    // "Não vamos usar X nem Y": a negative conjunction after an item a negator governs (the negator three words back)
    if (i + 1 < items.length && listLink(text, it.end, items[i + 1].start, es) === "neg" && negationGoverns(text, it.start, it.end, lang)) { mark(it); open(it); }
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
  // +dist: deduplicate / deduplication / deduplicação / deduplicación; desduplicação
  "deduplica", "desduplica"]);
// VERB stems: the stem + one of the listed endings, nothing else — 'cifr' is cifrar / cifrado / cifram…,
// never "cifra" (a figure); 'encript' never "encriptação" (a keyword of its own). The stem is the keyword (its literal and
// its name in notes), so a verb and its noun (encriptar / encriptação) are one signal, as encrypt / encryption are.
// VERB_STEMS and IRREGULAR_FORMS apply to the BUILT-IN signals only: a track pack's keyword is always a literal
// word + the ordinary inflections — a pack keyword "public" matches "public", never only "publicar" (keywordRe(kw, true)).
const VERB_STEMS = new Map([
  ["encript", "(?:ar|a|am|an|amos|ando|ado|ada|ados|adas|ou|aram|em|en)"],
  ["cifr", "(?:ar|am|an|amos|ando|ado|ada|ados|adas|ou|aram|em|en)"],
  ["criptograf", "(?:ar|a|am|amos|ando|ado|ada|ados|adas|ou|aram|em)"],
  // +dist: publicar (PT / ES) — only inside the gap phrases "public … evento" / "… mensagem" / "… mensaje"; a bare
  // English "public" (a public API) never matches it: an ending is required.
  ["public", "(?:ar|a|as|am|an|amos|ando|ado|ada|ados|adas|ou|aram|ó|aron|ará|arão|arán)"],
  // enviar (PT / ES): only inside "envi … mensagem" / "envi … mensaje" ("environment" has no listed ending)
  ["envi", "(?:ar|a|as|am|an|amos|ando|ado|ada|ados|adas|ou|aram|ó|aron|ará|arão|arán)"],
  // treinar / retreinar (PT), entrenar / reentrenar (ES) — only inside "trein … modelo" / "entren … modelo" (+ai)
  ["trein", "(?:ar|a|as|am|amos|ando|ado|ada|ados|adas|ou|aram|e|em|ará|arão)"],
  ["retrein", "(?:ar|a|as|am|amos|ando|ado|ada|ados|adas|ou|aram|e|em|ará|arão)"],
  ["entren", "(?:ar|a|as|an|amos|ando|ado|ada|ados|adas|ó|aron|e|en|ará|arán)"],
  ["reentren", "(?:ar|a|as|an|amos|ando|ado|ada|ados|adas|ó|aron|e|en|ará|arán)"],
]);
// Irregular inflections: a keyword whose forms the suffix rules can't produce — retry → retries / retried. The key is
// the keyword (its name in notes); the value its literal prefix and the alternation of endings. One concept, one signal:
// "retry … retries" is a single +dist hint, not the two weak ones that would turn the track on.
const IRREGULAR_FORMS = new Map([
  ["retry", ["retr", "(?:y|ies|ied|ying)"]],
  ["reintento", ["reintent", "(?:o|os|ar|a|an|ado|ada|ando)"]], // ES reintento(s) / reintentar / reintenta…
  ["duplicate delivery", ["duplicate deliver", "(?:y|ies)"]],
  ["mensagem", ["mensage", "(?:m|ns)"]], // PT mensagem → mensagens (a part of "public … mensagem" / "envi … mensagem")
  // An EXACT form (no inflection at all): "2PC", never "2PCS" (a product listing's "2 pieces"). Upper case: matched
  // case-sensitively like every keyword written with capitals.
  ["2PC", ["2PC", ""]],
  // +api: the noun only — "requests", never "requested" ("the user requested a refund" is no HTTP request)
  ["request", ["request", "(?:s)?"]],
  // +ui: the nouns only — "screening", "formed", "paged the on-call" are no UI
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
// turning it into an identifier ('claude-plugin'). Compliance / certification / grade compounds too — "GDPR-compliant",
// "HIPAA-compliant", "PCI-compliance", "SOC2-certified", "enterprise-grade" name the keyword's concept ('-compliant' used to
// be a rejected '-<letter>' compound: "A GDPR-compliant signup form" classified as core only). Not '-aware': "session-aware
// routing" (sticky sessions) would read as an auth session. '-compatible' — "the OpenAI-compatible endpoint", "an
// S3-compatible store" name the keyword's interface (it was no signal at all).
const ADJ_SUFFIX = "(?:-(?:based|powered|driven|generated|assisted|enabled|native|ready|first|compliant|compliance|certified|grade|compatible))?";

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
// plain: a track pack's keyword — a literal word (no gap, no verb stem, no irregular forms); cached apart from a
// built-in keyword of the same spelling.
const KW_PLAIN = "\u0001";
function keywordLiteral(kw, plain) {
  const key = plain ? KW_PLAIN + kw : kw;
  let lit = KW_LITERAL.get(key);
  if (lit != null) return lit;
  if (KW_LITERAL.size >= KW_CACHE_MAX) KW_LITERAL.clear();
  // a gap keyword: its first part's literal · an irregular one: its stem
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
  if (KW_RE.size >= KW_CACHE_MAX) KW_RE.clear(); // track packs add keywords: a long-lived server's cache stays bounded
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
  const version = !plain && (RE_VERSIONED_KW.test(kw) || VERSIONED_NAMES.has(kw)) && !STEMS.has(kw) && !VERB_STEMS.has(kw) ? VERSION_TAIL : "";
  return body + version + (STEMS.has(kw) ? "\\p{L}*" : !plain && VERB_STEMS.has(kw) ? VERB_STEMS.get(kw) : (kw.length <= 3 ? ACRONYM_INFLECTION : INFLECTION) + ADJ_SUFFIX);
}
// an acronym-sized one-word built-in keyword (2–5 letters: oauth, gpt, tls, llm, saml) or a versioned product name
// takes a version glued to it — "OAuth2", "GPT4", "GPT4o", "TLS1.3", "Claude3", "Gemini1.5" were no signal at all (the right edge
// refuses a digit; "gpt-4" / "OAuth 2.0" always matched). Unambiguous (digits, then dot-digits, then one letter): linear. Never a
// track pack's.
const RE_VERSIONED_KW = /^[a-z]{2,5}$/i;
const VERSIONED_NAMES = new Set(["Claude", "Gemini", "Mistral"]); // (case-sensitive keywords — the table's spelling)
const VERSION_TAIL = "(?:\\d+(?:\\.\\d+)*[a-z]?)?";

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
  // opts.projectDir: that project's track packs are classified too — their signals beside the built-in ones.
  if (opts.projectDir) specsRoot(opts.projectDir);
  const OPT = optionalTracks();
  // An optional feature name is part of the evidence ("LLM chatbot billing" says a lot).
  const raw = [opts.name, description].filter((s) => s != null && String(s).trim()).map(String).join(". ");
  const cased = " " + splitWordPairs(raw) + " ";
  const text = cased.toLowerCase();
  // No explicit lang: the text's own language, the project's configured one (opts.projectDir → meta.lang) only as the fallback
  // when the text is inconclusive — the same rule for spec_classify, create and import.
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
    const nb = negatorBefore(text, start, lang, cased, end);
    const negBy = nb ? "before" : negatedAfter(text, start, end - start) ? "after" : null;
    return { track, tier, kw, start, end, neg: !hazard && !!negBy, negBy, hazard, base: base === undefined ? tier : base, by: by || null, conj: !!nb && LIST_NEG.has(nb) };
  };
  // The project's signal overrides (.specs/classifier.json, learned from Phase 0 corrections or set by hand): a layer over
  // the tables — a word "off" is no signal of that track at all (its place stays free for another keyword), "weak" / "strong"
  // re-tier it, and a word no table has is matched as a literal word (a track pack's rule) at its tier. Only with a projectDir.
  const layer = opts.projectDir ? projectSignalLayer(opts.projectDir, OPT) : null;
  const applied = new Map(); // override key → its record (an override that changed this text's reading)

  for (const track of OPT) {
    const table = trackSignalTable(track);
    const plain = !Object.prototype.hasOwnProperty.call(SIGNALS, track); // a track pack's keywords are literal words
    const hazards = Object.prototype.hasOwnProperty.call(SIGNAL_HAZARDS, track) ? SIGNAL_HAZARDS[track] : null; // (never negated)
    const ov = layer ? layer.byTrack.get(track) : null;
    const consumed = ov ? new Set() : null;
    // (tier `generic` — exists in the built-in +dist table only; see SIGNALS.dist)
    for (const tier of ["strong", "weak", "generic", "context"]) {
      for (const kw of table[tier] || []) {
        // A keyword written with upper-case letters ('STRIDE') is an acronym matched CASE-SENSITIVELY, on the original
        // text: the lower-case word is something else (an array stride). `cased` is `text` before toLowerCase().
        // a built-in keyword mixing lower-case words with an ALL-CAPS acronym ("relatório de BI", "BI dashboard", "CDC
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
  // inside a longer strong phrase of its OWN track it is part of that phrase too — "mensagens" in "fila de
  // mensagens", "outbox" in "transactional outbox", "worker" in "Celery worker" (the name-based de-dupe below misses a plural).
  // Linear (every hit was compared with every hit: 100 KB of "queue …" took 9.6 s): the strong hits sorted by
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
  // A negation reaches every item of the coordinated list it opens (coordinatedNegation): "not add feature flags or
  // canary releases", "sem X nem Y", "ni X ni Y".
  coordinatedNegation(hits.filter((h) => !shadowedHits.has(h)), text, lang);
  // CORROBORATING-only signals (tier `context`, 'permission' for +sec) are weak evidence only beside another
  // (non-negated) signal of their track ("RBAC permissions"); a negated one is noted only when the track has some other
  // signal. Alone they are no evidence at all: no signal, no "possible" note, no "kept off" note ("file permission bits").
  // A GENERIC word backs no context word: "retry the card transaction" is no +dist evidence.
  // CUES (SIGNAL_CUES): a built-in keyword whose tier depends on the words around it ("Stripe's REST API" is
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
  // an anchor its table lists in `everydayAnchors` (+data: a lakehouse, a lineage, ingestion, SCD, duplicate
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
    // One concept, one signal (SIGNAL_CONCEPTS): the first keyword of a concept stays, an anchor (weak) before a
    // generic one — "retry … with exponential backoff" is one anchor, "producers … consumers" one generic hint.
    const cm = Object.prototype.hasOwnProperty.call(SIGNAL_CONCEPTS, t) ? SIGNAL_CONCEPTS[t] : null;
    if (cm) {
      const seen = new Set();
      const once = (arr) => arr.filter((k) => { const c = cm.get(k); if (c == null) return true; if (seen.has(c)) return false; seen.add(c); return true; });
      matched[t].weak = once(matched[t].weak);
      matched[t].generic = once(matched[t].generic);
    }
    // The same for the negated ones: "no distributed transactions" is ONE negated concept, not also a negated
    // corroborating 'transaction' (+dist's context word inside it).
    const neg = negated[t];
    negated[t] = neg.filter((k) => !neg.some((m) => m !== k && (m.startsWith(k) || m.endsWith(k))));
  }

  // Weighting: score = strong*2 + weak (+ generic). A track turns ON at score >= 2 (one strong signal,
  // or two weak ones). A lone weak signal (score 1) is surfaced as "possible" but not enabled.
  // GENERIC signals add to the score but never turn a track on by themselves: at least one strong or weak (anchor)
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
    // two or more app-level words and no anchor: named as such
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

  // The project's overrides are never applied silently: the ones that changed this reading are named (a note + the stable
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
    // Brazilian wording read as `pt` — the agent passes lang "pt-BR" to spec_init / spec_create (absent otherwise)
    ...(lang === "pt" && ptVariantHint(text) ? { langHint: "pt-BR" } : {}),
    reasoning: buildReasoning(tracks, signals, confidence, negated, C, OPT),
  };
  // the suggested size (a deterministic reading — stable `sizeReason`; the localized sentence in `sizeNote`, never in notes)
  const sz = suggestSize(text, tracks);
  const SZ = i18n.msg(lang).sizes;
  Object.assign(res, { suggestedSize: sz.size, sizeReason: sz.reason, sizeNote: (SZ.suggest[sz.reason] || SZ.suggest.default) + " " + SZ.suggestTail });
  if (overrides.length) res.overrides = overrides;
  if (warning) res.overridesWarning = warning;
  // explain (spec_classify {explain} / classify --explain): every keyword match — its table tier, its final one (a cue, an
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

// the size spec_classify suggests (spec_create {size}): a deterministic reading of the request — never the track count
// alone (the 1.20 friction audit: the classifier under-calls tracks). → { size, reason } — reason (stable): trivial-change ·
// small-change · several-tracks · public-api · cross-system · single-unit · default. The human confirms or overrides it in Phase 0; nothing
// applies a size by itself (spec_create without one keeps the 1.20 scaffold).
const B_ = "(?<![\\p{L}\\p{N}])", _B = "(?![\\p{L}\\p{N}])";
const SIZE_TRIVIAL = new RegExp(B_ + "(?:typos?|misspell(?:ing|ed|ings)?|spelling (?:mistake|error)s?|wording|copy (?:change|tweak|edit|fix)|" +
  "(?:change|update|fix|edit|correct) (?:the |a )?(?:text|label|copy|wording|caption|colou?r|footer text|button text)|rename (?:the |a )?(?:label|button|field|variable|file|column)|" +
  "one[- ]line(?:r)? (?:fix|change)|(?:bump|upgrade|update) (?:the |a )?(?:version|dependency)|broken link|(?:update|fix) (?:the )?copyright|" +
  "gralhas?|erros? (?:ortográfico|de digitação|de escrita|tipográfico)s?|(?:corrigir|mudar|alterar|atualizar) (?:o |a )?(?:texto|rótulo|legenda|etiqueta|cor|redação)|" +
  "renomear (?:o |a )?(?:rótulo|botão|campo|ficheiro|arquivo)|(?:numa|uma|em uma) (?:só )?linha|link (?:partido|quebrado)|atualizar (?:a )?versão|" +
  "erratas?|errores? (?:tipográfico|ortográfico|de escritura)s?|faltas? de ortografía|(?:corregir|cambiar|actualizar) (?:el |la )?(?:texto|etiqueta|color|redacción)|" +
  "renombrar (?:el |la )?(?:etiqueta|botón|campo|archivo)|(?:en )?una (?:sola )?línea|enlace roto|actualizar (?:la )?versión)" + _B, "u");
// one SMALL behaviour change (reason small-change, xs): a clearer / friendlier error message, a default / timeout / limit
// changed, one empty / missing input handled — "Return a clearer error message when the orders route gets an empty customer id" was m.
// Bounded (≤ 40 characters between the verb and the empty word): linear.
const SIZE_SMALL = new RegExp(B_ + "(?:(?:clearer|better|friendlier|nicer|proper|meaningful|more (?:helpful|descriptive|specific|useful|informative|actionable|explicit)) " +
  "(?:error|validation|warning) (?:messages?|texts?)|(?:improve|clarify|reword|rephrase|change|update|fix|adjust|tweak) (?:the |an? |its |our )?(?:error|validation|warning) (?:messages?|texts?)|" +
  "(?:change|raise|lower|increase|decrease|reduce|bump|adjust) (?:the )?(?:default (?:value|limit|timeout|page size|sort order)|timeout|time-out|page size|retry count|" +
  "max(?:imum)? (?:length|size|retries)|upload limit|size limit|character limit)|" +
  "(?:handle|reject|refuse|validate|guard against|check for) (?:an? |the )?(?:[\\p{L}-]+ ){0,3}?(?:empty|blank|null|missing|negative)|" +
  "mensage(?:m|ns) de erro (?:mais )?(?:clara|claras|útil|úteis|explícita|explícitas|amigável|amigáveis|melhor|melhores|descritiva|descritivas)|" +
  "(?:melhorar|clarificar|esclarecer|reformular|alterar|mudar|corrigir|atualizar) (?:a |as )?mensage(?:m|ns) de erro|" +
  "(?:aumentar|diminuir|baixar|reduzir|alterar|mudar|ajustar) (?:o |a )?(?:valor (?:por omissão|padrão|predefinido)|timeout|tempo limite|limite de (?:upload|tamanho|caracteres))|" +
  "(?:rejeitar|recusar|validar|tratar) (?:um |uma |o |a )?(?:[\\p{L}-]+ ){0,4}?(?:vazio|vazia|vazios|vazias|em branco|nulo|nula)|" +
  "mensajes? de error (?:más )?(?:claros?|útiles?|explícitos?|amigables?|mejores?|descriptivos?)|" +
  "(?:mejorar|aclarar|reformular|cambiar|corregir|actualizar) (?:el |los )?mensajes? de error|" +
  "(?:aumentar|reducir|bajar|cambiar|ajustar) (?:el |la )?(?:valor (?:por defecto|predeterminado)|timeout|tiempo de espera|límite de (?:subida|tamaño|caracteres))|" +
  "(?:rechazar|validar|manejar|tratar) (?:un |una |el |la )?(?:[\\p{L}-]+ ){0,4}?(?:vacío|vacía|vacíos|vacías|en blanco|nulo|nula))" + _B, "u");
const SIZE_UNIT = new RegExp(B_ + "(?:a|an|one|single|um|uma|un|una|1)\\s+(?:[\\p{L}\\p{N}/-]+\\s+){0,3}?(?:endpoints?|button|screen|page|field|column|form|filter|" +
  "report|export|checkbox|toggle|tab|dialog|modal|query|job|script|command|setting|link|email|notification|route|widget|" +
  "botão|ecrã|tela|página|campo|coluna|formulário|filtro|relatório|exportação|botón|pantalla|columna|formulario|informe|exportación|ruta)" + _B, "u");
const SIZE_CROSS = new RegExp(B_ + "(?:several|multiple|many|across) (?:services|systems|microservices)|(?:vários|varios|múltiplos|múltiples|entre) (?:serviços|sistemas|servicios|microsserviços|microservicios)" + _B, "u");
const SIZE_PUBLIC = new RegExp(B_ + "(?:public|pública|publica|público|publico)" + _B, "u");
function suggestSize(text, tracks) {
  const markers = tracks.filter((t) => t !== "core" && t !== "tdd");
  if (!markers.length && SIZE_TRIVIAL.test(text)) return { size: "xs", reason: "trivial-change" };
  if (!markers.length && SIZE_SMALL.test(text)) return { size: "xs", reason: "small-change" };
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
    } else if (signals && signals[t] && signals[t].length) {
      // off, yet a weak / app-level word matched (the "Possible +t" note names it): never "no signals matched"
      lines.push(C.offWeak(t, [...new Set(signals[t])].slice(0, 6).map((k) => `'${k.trim()}'`).join(", "), neg));
    } else {
      lines.push(C.off(t, neg));
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Project-level signal overrides — .specs/classifier.json, learned from Phase 0 corrections
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

module.exports = { SIGNAL_CONCEPTS, guessLang, configuredLang, classify, learnSignalOverrides, signalLearnNote,
  signalOverrides, __link };
