"use strict";

/**
 * dev-spec-driven engine — the module loader behind mcp/lib/spec.js (the facade).
 *
 * THE RULE. Each module requires what it needs AT LOAD TIME from a module below it (destructured, marked `// load time`) —
 * those requires form a DAG, never a cycle. Everything else it calls lives in a `let` it declares and __link(E) assigns once
 * every module has loaded: call-time use only, in any direction. Shared mutable state lives in ./ctx.js, one object mutated
 * in place (never re-bound). A new module goes into MODULES below; a new name must not exist in another module (checked).
 */

const MODULES = ["./core.js", "./files.js", "./state.js", "./markdown.js", "./tracks.js", "./templates.js",
  "./scaffold.js", "./tasks.js", "./evidence.js", "./trace.js", "./gates.js", "./doctor.js", "./quality.js",
  "./finish.js", "./roadmap-md.js", "./decisions.js", "./export.js", "./guards.js", "./upgrade.js", "./scan.js",
  "./import/common.js", "./import/kiro.js", "./import/speckit.js", "./import/openspec.js", "./import/plan.js",
  "./import/bmad.js", "./import/fluidplan.js", "./import/index.js"];
const E = {};
const mods = MODULES.map((f) => require(f));
mods.forEach((m, k) => {
  for (const name of Object.keys(m)) {
    if (name === "__link") continue;
    if (Object.prototype.hasOwnProperty.call(E, name)) throw new Error("engine: " + name + " is defined twice (" + MODULES[k] + ")");
    E[name] = m[name];
  }
});
mods.forEach((m) => { if (typeof m.__link === "function") m.__link(E); });
module.exports = E;
