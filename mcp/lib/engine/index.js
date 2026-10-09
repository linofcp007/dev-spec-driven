"use strict";

/**
 * dev-spec-driven engine — the module loader behind mcp/lib/spec.js (the facade).
 *
 * THE RULE. Each module requires what it needs AT LOAD TIME from the module that owns it (destructured, marked `// load
 * time`) — whatever their order in MODULES (markdown.js loads tracks.js, listed after it; decisions / export / finish load
 * trace.js, listed before them), as long as those requires stay ACYCLIC: a cycle would hand out a half-built module.exports.
 * Everything else it calls lives in a bare `let` it declares and __link(E) assigns once every module has loaded (the `let`
 * list and the __link destructure name the same names): call-time use only, in any direction. Shared mutable state lives
 * in ./ctx.js, one object mutated in place (never re-bound). A new module goes into MODULES below; a new name must not exist
 * in another module (checked here). mcp/test.js ("1.18 module rule") checks the rest.
 */

const MODULES = ["./core.js", "./files.js", "./state.js", "./markdown.js", "./tracks.js", "./classify.js", "./packs.js",
  "./templates.js", "./scaffold.js", "./tasks.js", "./evidence.js", "./trace.js", "./gates.js", "./doctor.js",
  "./quality.js", "./finish.js", "./roadmap-md.js", "./decisions.js", "./export.js", "./guards.js", "./upgrade.js",
  "./scan.js", "./import/common.js", "./import/kiro.js", "./import/speckit.js", "./import/openspec.js", "./import/plan.js",
  "./import/bmad.js", "./import/fluidplan.js", "./import/steering.js", "./import/index.js"];
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
