"use strict";
// Track packs — 1.23 review 5 (L30): a track.json problem reads in the project's language. The rule a field breaks and why track.json
// is no JSON are codes the locale renders (trackPacks.rule / jsonWhy) — they were English text inside the PT / ES sentence. And 1.24
// review 6 (F7): two sections that can answer one heading are an error (section-overlap). (04-tracks.js holds the packs' earlier tests.)

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, S, tmp, require, __dirname }) => {
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const js = JSON.stringify;
  const writePack = (proj, n, json) => {
    const d = path.join(proj, ".specs", "tracks", n);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, "track.json"), typeof json === "string" ? json : JSON.stringify(json, null, 2));
  };
  const base = (n, over = {}) => ({ name: n, marker: n.toUpperCase(), title: { en: n }, sections: [{ name: "Scope" }], ...over });
  // Every rule / reason the loader can give, once: unclosed comment, a syntax error (on line 3), not an object, a missing name and marker,
  // a bad title / description / signals / keyword list / sections / section / guidance / synonym list, a name that is only numbering.
  const bad = (p) => {
    writePack(p, "opencomment", "{ /* never closed\n \"name\": \"opencomment\" }");
    writePack(p, "syntax", "{\n  \"name\": \"syntax\",\n  \"marker\": \"SYNTAX\" \"title\": 1\n}");
    writePack(p, "array", "[1, 2]");
    writePack(p, "noname", { marker: "NONAME", title: { en: "x" }, sections: [{ name: "Scope" }] });
    writePack(p, "nomarker", { name: "nomarker", title: { en: "x" }, sections: [{ name: "Scope" }] });
    writePack(p, "badtitle", base("badtitle", { title: { en: "x" } }));
    writePack(p, "baddesc", base("baddesc", { description: "a\nb" }));
    writePack(p, "badsig", base("badsig", { signals: [] }));
    writePack(p, "badkw", base("badkw", { signals: { strong: "kafka" } }));
    writePack(p, "nosect", base("nosect", { sections: [] }));
    writePack(p, "badsect", base("badsect", { sections: [7] }));
    writePack(p, "badguide", base("badguide", { sections: [{ name: "Scope", guidance: "<!-- x -->" }] }));
    writePack(p, "badsyn", base("badsyn", { sections: [{ name: "Scope", syn: "x" }] }));
    writePack(p, "badlead", base("badlead", { sections: [{ name: "2. A" }] }));
  };
  // The English rule / reason texts — none may appear in a PT, pt-BR or ES message.
  const ENGLISH = /the folder name|at least one|not a JSON object|characters|one line|is never closed|syntax error|a name after|\[keyword,|\[text,/;
  const msgs = {};
  for (const lang of ["en", "pt", "pt-BR", "es"]) {
    const p = path.join(tmp, "proj-r5-packlang-" + lang.toLowerCase());
    S.initProject(p, ["core"], lang);
    bad(p);
    msgs[lang] = S.trackPacks(p, "check").problems.filter((x) => x.severity === "error");
  }
  const by = (lang, pack) => msgs[lang].filter((x) => x.pack === pack).map((x) => x.message).join(" | ");
  const packs = ["opencomment", "syntax", "array", "noname", "nomarker", "badtitle", "baddesc", "badsig", "badkw", "nosect", "badsect", "badguide", "badsyn", "badlead"];
  ok(packs.every((n) => by("en", n) && by("pt", n) && by("pt-BR", n) && by("es", n)),
    "1.23 review 5 (L30): each malformed pack gives an error in every language (missing: " + js(packs.filter((n) => !(by("en", n) && by("pt", n) && by("es", n)))) + ")");
  const leaks = ["pt", "pt-BR", "es"].flatMap((l) => msgs[l].filter((x) => ENGLISH.test(x.message)).map((x) => l + ": " + x.message));
  ok(leaks.length === 0, "1.23 review 5 (L30): no English rule / reason text inside a PT, pt-BR or ES pack problem (got " + js(leaks.slice(0, 3)) + ")");
  // The English wording is unchanged, and a syntax error names its line (the parser's position mapped through the comment stripper).
  const syn = msgs.en.find((x) => x.pack === "syntax") || {};
  ok(/is missing \(= the folder name\)/.test(by("en", "noname")) && /\(a \/\* comment is never closed\)/.test(by("en", "opencomment")) &&
    /\(not a JSON object\)/.test(by("en", "array")) && /\(a syntax error on line 3\)/.test(syn.message) && syn.line === 3 &&
    /2–\d+ characters, one line/.test(by("en", "badtitle")) && /falta "name" \(= o nome da pasta\)/.test(by("pt", "noname")) &&
    /um erro de sintaxe na linha 3/.test(by("pt", "syntax")) && /un error de sintaxis en la línea 3/.test(by("es", "syntax")) &&
    /no es un objeto JSON/.test(by("es", "array")) && /al menos una/.test(by("es", "nosect")),
    "1.23 review 5 (L30): the rules read in each language; a syntax error names line 3 (got " + js([syn.message, syn.line, by("pt", "noname")]) + ")");

  // 1.24 r6 F7: two sections of a pack that can answer the SAME heading — a name / synonym that is a word-prefix of another's ("Offline" and
  // "Offline Sync"), or an English inflection of it ("Model" and "Modeling Notes") — are an error, section-overlap: "## [MOB] Offline Sync"
  // answered both, so deleting the "Offline" section left doctor's mob-sections passing. The built-in tracks' tables keep the invariant.
  {
    const p = path.join(tmp, "proj-r6-overlap");
    S.initProject(p, ["core"], "en");
    writePack(p, "mob", base("mob", { sections: [{ name: "Offline", syn: ["offline mode"] }, { name: "Offline Sync" }, { name: "Push", syn: ["push notifications"] }] }));
    writePack(p, "mod", base("mod", { sections: [{ name: "Model" }, { name: "Training", syn: ["modeling notes"] }] }));
    writePack(p, "syncs", base("syncs", { sections: [{ name: "Offline Sync" }, { name: "Online" }, { name: "Sync Conflicts", syn: ["offline-first notes"] }] }));
    const probs = S.trackPacks(p, "check").problems;
    const codes = (n) => probs.filter((x) => x.pack === n).map((x) => x.code);
    const over = probs.filter((x) => x.code === "section-overlap");
    const builtin = E.markerTracks().filter((t) => !E.isPackTrack(t)).flatMap((t) => E.sectionOverlaps(E.trackSectionTable(t)).map((o) => t + ": " + o.join(" / ")));
    const msgs = ["pt", "es"].map((l) => {
      const q = path.join(tmp, "proj-r6-overlap-" + l);
      S.initProject(q, ["core"], l);
      writePack(q, "mob", base("mob", { sections: [{ name: "Offline" }, { name: "Offline Sync" }] }));
      return (S.trackPacks(q, "check").problems.find((x) => x.code === "section-overlap") || {}).message || "";
    });
    ok(codes("mob").includes("section-overlap") && codes("mod").includes("section-overlap") && !codes("syncs").includes("section-overlap") &&
      over.every((x) => x.severity === "error") && /Offline/.test((over.find((x) => x.pack === "mob") || {}).message || "") && !builtin.length &&
      msgs.every((m) => m && /Offline Sync/.test(m) && !/answer the same heading/.test(m)),
      "1.24 r6 F7: tracks check refuses a pack whose sections can answer the same heading (a word-prefix or an inflection of another's name / synonym) — section-overlap, localized; the built-in tables never overlap (got " +
      js([codes("mob"), codes("mod"), codes("syncs"), builtin, msgs]) + ")");
  }
};
