"use strict";

/**
 * dev-spec-driven engine — the module loader behind mcp/lib/spec.js (the facade).
 *
 * THE RULE. Each module requires what it needs AT LOAD TIME from the module that owns it (destructured, marked `// load
 * time`) — whatever their order in MODULES (markdown.js loads tracks.js, listed after it; decisions / export / finish load
 * trace.js, listed before them), as long as those requires stay ACYCLIC: a cycle would hand out a half-built module.exports.
 * Everything else it calls lives in a bare `let` it declares and __link(E) assigns once every module has loaded (the `let`
 * list and the __link destructure name the same names): call-time use only, in any direction. Shared mutable state lives
 * in ./ctx.js, one object mutated in place (never re-bound). A module exports only the names something outside it uses
 * (another module, the facade, a surface, a test) and links only the names it uses. A new module goes into MODULES
 * below; a new name must not exist in another module (checked here). mcp/test.js ("1.18 module rule", "1.27 module
 * boundaries", "1.30.1 lazy tier") checks the rest.
 *
 * THE LAZY TIER (1.30.1). LAZY lists modules no hook and no frequent call needs — the importers, the duplicate-code detector:
 * ~15 ms of every engine load until then. They load on the first call of one of LAZY_ENTRIES, the tier's functions the rest
 * of the engine links and the facade takes: until then E holds a stub of each, which loads the tier and calls the real one.
 * The tier's modules follow the rule above among themselves and toward the eager modules (they require eager modules at load
 * time and link their names), and link in their own namespace — E's names, every tier export, the real entries. An eager
 * module never requires a tier module, links only an entry of it, and a constant the eager world reads (a tool list) lives in
 * an eager module. E's keys never change: a tier name other than an entry is reached through E.loadLazyTier() (the tests).
 */

const MODULES = ["./core.js", "./files.js", "./state.js", "./markdown.js", "./tracks.js", "./classify.js", "./packs.js",
  "./templates.js", "./scaffold.js", "./tasks.js", "./evidence.js", "./guardian.js", "./trace.js", "./gates.js", "./doctor.js",
  "./quality.js", "./finish.js", "./roadmap-md.js", "./decisions.js", "./export.js", "./guards.js", "./upgrade.js",
  "./scan.js"];
const LAZY = ["./dupes.js", "./import/common.js", "./import/kiro.js", "./import/speckit.js", "./import/openspec.js",
  "./import/plan.js", "./import/bmad.js", "./import/fluidplan.js", "./import/steering.js", "./import/index.js"];
const LAZY_ENTRIES = ["duplicateRuns", "duplicationReport", "importSpec", "planPaths"];

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function merge(into, m, file, stubs) {
  for (const name of Object.keys(m)) {
    if (name === "__link") continue;
    if (own(into, name) && !(stubs && own(stubs, name) && into[name] === stubs[name])) throw new Error("engine: " + name + " is defined twice (" + file + ")");
    into[name] = m[name];
  }
}

const E = {};
const mods = MODULES.map((f) => require(f));
mods.forEach((m, k) => merge(E, m, MODULES[k]));

// The tier, loaded once: its namespace is E's names (the stubs replaced by the real entries) and every tier export.
let TIER = null;
const STUBS = {};
function loadLazyTier() {
  if (TIER) return TIER;
  const T = Object.assign({}, E);
  const tmods = LAZY.map((f) => require(f));
  tmods.forEach((m, k) => merge(T, m, LAZY[k], STUBS));
  const notEntries = LAZY_ENTRIES.filter((name) => T[name] === STUBS[name] || typeof T[name] !== "function");
  if (notEntries.length) throw new Error("engine: no function of the lazy tier: " + notEntries.join(", "));
  tmods.forEach((m) => { if (typeof m.__link === "function") m.__link(T); });
  TIER = T;
  return T;
}
for (const name of LAZY_ENTRIES) {
  if (own(E, name)) throw new Error("engine: " + name + " is defined twice (LAZY_ENTRIES)");
  const stub = function () { return (TIER || loadLazyTier())[name].apply(this, arguments); };
  Object.defineProperty(stub, "name", { value: name });
  E[name] = STUBS[name] = stub;
}

mods.forEach((m) => { if (typeof m.__link === "function") m.__link(E); });
Object.defineProperty(E, "loadLazyTier", { value: loadLazyTier }); // not a name of the namespace: Object.keys(E) never lists it
module.exports = E;
