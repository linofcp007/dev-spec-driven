"use strict";
// The classifier on the CLI (1.21 F2): coordinated negation, classify --explain, the project's signal overrides (dev-spec signals).

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, all, run, runIn, tmp, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const S = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const pd = path.join(tmp, "f2-signals");
  runIn(["init", "--lang", "en", "--project", pd]);

  // coordinated negation and --explain (EN / PT / ES)
  const en = runIn(["classify", "We will not add feature flags or canary releases for this internal script.", "--project", pd]);
  const pt = runIn(["classify", "Não vamos usar feature flags nem lançamento canário neste script interno.", "--project", pd]);
  const ex = runIn(["classify", "We will not add feature flags or canary releases; show a modal instead", "--explain", "--project", pd]);
  const exJson = JSON.parse(runIn(["classify", "We will not add feature flags or canary releases; show a modal instead", "--explain", "--json", "--project", pd]).out);
  ok(en.code === 0 && /^Tracks: core\b(?! \+obs)/.test(en.out) && /\+obs: off — 'feature flag', 'canary release' appeared negated\./.test(en.out) &&
    /\+obs: inativo — 'feature flag', 'lançamento canário' apareceu negado\./.test(pt.out) &&
    /Matched keywords \(track · keyword · table tier → final tier\):/.test(ex.out) && /\+obs 'canary release' \("canary releases"\) · strong → strong · negated \(a negated list\)/.test(ex.out) &&
    /\+ui 'modal' · weak → strong \(a cue\)/.test(ex.out) && /Project signal overrides: none/.test(ex.out) &&
    js(exJson) === js(S.classify("We will not add feature flags or canary releases; show a modal instead", { projectDir: pd, explain: true })),
    "1.21 F2 (CLI): classify negates every item of a coordinated list (EN / PT); --explain prints each match (table tier → final tier, a cue, the negation) and the project's overrides; --json = the engine's result (got " +
    js([en.out.split("\n")[0], ex.out.split("\n").slice(-5)]) + ")");

  // two Phase 0 corrections through `create` learn an override; `signals` lists / sets / forgets them (= spec_tracks {action: "signals"})
  const c1 = runIn(["create", "Coupons admin", "core", "--summary", "Admin panel to manage coupons", "--project", pd]);
  const c2 = runIn(["create", "Sales admin", "core", "--summary", "Admin panel for the sales team", "--project", pd]);
  const after = runIn(["classify", "Admin panel for refunds", "--project", pd]);
  const list = runIn(["signals", "--project", pd]), listJson = JSON.parse(runIn(["signals", "list", "--json", "--project", pd]).out);
  ok(c1.code === 0 && /Phase 0 correction recorded: 'admin panel' suggested \+ui/.test(c1.out) && /Learned from 2 consistent Phase 0 corrections/.test(c2.out) &&
    !/\+ui: ON/.test(after.out) && /signal overrides changed the reading/.test(after.out) &&
    /\.specs\/classifier\.json — 1 signal override\(s\), 1 applying/.test(list.out) && /\+ui 'admin panel' → off · learned, 2 correction\(s\) · applies/.test(list.out) &&
    js(listJson) === js(S.trackPacks(pd, "signals")),
    "1.21 F2 (CLI): create learns from two consistent Phase 0 corrections (a note each), classify then names the override; `signals` lists it — --json = spec_tracks {action: 'signals'} (got " +
    js([c1.out, c2.out, list.out]) + ")");
  const set = runIn(["signals", "set", "ui", "heartbeat grid", "strong", "--project", pd]);
  const setJson = JSON.parse(runIn(["signals", "set", "obs", "error spikes", "weak", "--json", "--project", pd]).out);
  const forget = runIn(["signals", "forget", "ui", "admin panel", "--project", pd]);
  const gone = runIn(["signals", "forget", "ui", "admin panel", "--project", pd]);
  const bad = [runIn(["signals", "set", "core", "x", "off", "--project", pd]), runIn(["signals", "set", "ui", "a|b", "strong", "--project", pd]),
    runIn(["signals", "set", "ui", "grid", "--project", pd]), runIn(["signals", "purge", "--project", pd])];
  const back = runIn(["classify", "Admin panel for refunds", "--project", pd]);
  all("1.21 F2 (CLI): signals set / forget (exit 1 on a refusal: core, a pattern-like word, a missing effect, an unknown op, a missing override); forgetting the override brings the built-in reading back; help names the command (got " +
    js([set.out, setJson.override, gone.out, bad.map((r) => r.out.split("\n")[0])]) + ")", [
    () => set.code === 0, () => /Set: 'heartbeat grid' → strong for \+ui/.test(set.out), () => setJson.ok, () => setJson.override.effect === "weak",
    () => setJson.override.origin === "set", () => forget.code === 0, () => /Forgotten: 'admin panel' → off for \+ui/.test(forget.out),
    () => gone.code === 1, () => /No override 'admin panel'/.test(gone.out), () => bad.every((r) => r.code === 1),
    () => /core is always on/.test(bad[0].out), () => /not a signal word/.test(bad[1].out), () => /Usage|usage/.test(bad[2].out),
    () => /Unknown signals operation 'purge'/.test(bad[3].out), () => /\+ui: ON/.test(back.out),
    () => /signals \[list \| set <track> <word> off\|weak\|strong \| forget <track> <word>\]/.test(runIn(["help"]).out),
  ]);
  const file = path.join(pd, ".specs", "classifier.json");
  fs.writeFileSync(file, "{ nope");
  const inv = runIn(["classify", "Admin panel for refunds", "--project", pd]), invList = runIn(["signals", "--project", pd]), invSet = runIn(["signals", "set", "ui", "grid", "off", "--project", pd]);
  ok(inv.code === 0 && /\+ui: ON/.test(inv.out) && /classifier\.json is ignored \(not valid JSON\)/.test(inv.out) && invList.code === 0 && /never rewritten/.test(invList.out) &&
    invSet.code === 1 && fs.readFileSync(file, "utf8") === "{ nope",
    "1.21 F2 (CLI): an unparseable classifier.json — classify answers with a warning, signals list says why, signals set refuses to rewrite it (got " + js([inv.out.split("\n").slice(-1), invSet.out]) + ")");
};
