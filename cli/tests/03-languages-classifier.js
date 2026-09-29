"use strict";
// Languages on the CLI — create classifies in the text's language, import, section synonyms, i18n / pt-BR.

const path = require("path");

// 1.14 full review (Pb) — import, classifier, section synonyms, i18n / pt-BR.
exports.run = ({ ok, run, tmp }) => {
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  // Pb2: `create` classifies a new feature in the project's configured language (= spec_create) — "no checkout" is PT em+o.
  const pb = path.join(tmp, "frpb-proj");
  run(["init", "--lang", "pt", "--project", pb]);
  const c2 = jsonOf(run(["create", "IVA", "--summary", "Corrigir o cálculo do IVA no checkout", "--json", "--project", pb]));
  const c2en = jsonOf(run(["create", "IVA EN", "--summary", "Corrigir o cálculo do IVA no checkout", "--lang", "en", "--json", "--project", pb]));
  ok(c2 && c2.ok && c2.tracks.join() === "core,tdd" && c2en && c2en.ok && c2en.tracks.join() === "core",
    "full review Pb2: create in a meta.lang pt project reads the summary in PT ('no checkout' = em+o → +tdd); an explicit --lang en still reads 'no' as a negator (got " +
    JSON.stringify([c2 && c2.tracks, c2en && c2en.tracks]) + ")");
};
