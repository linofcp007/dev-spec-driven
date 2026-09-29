"use strict";

/**
 * dev-spec-driven engine — the module loader behind mcp/lib/spec.js.
 *
 * THE RULE. Each module requires what it needs AT LOAD TIME from a module below it (destructured, marked `// load time`) —
 * those requires form a DAG, never a cycle. Everything else it calls lives in a `let` it declares and __link(E) assigns once
 * every module has loaded: call-time use only, in any direction. Shared mutable state lives in ./ctx.js, one object mutated
 * in place (never re-bound). A new module goes into MODULES below; a new name must not exist in another module (checked).
 * While the 1.18 split is in progress, spec.js still defines the rest and passes it in with link(extra).
 */

const MODULES = ["./text.js", "./files.js", "./locks.js", "./markdown.js", "./state.js", "./tracks.js", "./classify.js",
  "./packs.js", "./templates.js", "./placeholders.js", "./scaffold.js", "./steering.js", "./globs.js", "./tasks.js",
  "./evidence.js", "./task-edit.js", "./brief.js", "./ears.js", "./trace.js", "./matrix.js", "./approvals.js",
  "./impact.js", "./gates.js", "./doctor.js", "./quality.js", "./finish.js", "./lifecycle.js", "./catalog.js",
  "./metrics.js", "./decisions.js", "./export.js", "./export-formats.js", "./changelog.js", "./roadmap.js",
  "./roadmap-md.js", "./upgrade.js", "./scan.js", "./guards.js", "./approval-guard.js", "./status.js"];
const E = {};
const mods = MODULES.map((f) => require(f));
const add = (m, from) => {
  for (const name of Object.keys(m)) {
    if (name === "__link") continue;
    if (Object.prototype.hasOwnProperty.call(E, name)) throw new Error("engine: " + name + " is defined twice (" + from + ")");
    E[name] = m[name];
  }
};
mods.forEach((m, k) => add(m, MODULES[k]));
function link(extra) {
  add(extra, "spec.js");
  mods.forEach((m) => { if (typeof m.__link === "function") m.__link(E); });
}
module.exports = { E, link };
