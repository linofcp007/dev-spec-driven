"use strict";
// Cross-area regressions on the CLI — decide's repeated flags, approve --through's forced label, spike --flow.

const path = require("path");

exports.run = ({ ok, run, runIn, tmp }) => {
  const fr = path.join(tmp, "pfr-proj");
  const jsonOf = (r) => { try { return JSON.parse(r.out); } catch { return null; } };
  runIn(["init", "tdd", "--lang", "pt", "--project", fr]);
  runIn(["create", "Alfa", "core", "tdd", "--project", fr]);
  // decide: a repeated --affects / --supersedes adds to the list (= spec_decide's arrays); --kind is honoured.
  const d1 = jsonOf(runIn(["decide", "alfa", "--title", "t1", "--decision", "d1", "--affects", "US-1.AC-1", "--affects", "T-01", "--json", "--project", fr]));
  const d2 = jsonOf(runIn(["decide", "alfa", "--title", "t2", "--decision", "d2", "--kind", "discovery", "--json", "--project", fr]));
  const d3 = jsonOf(runIn(["decide", "alfa", "--title", "t3", "--decision", "d3", "--supersedes", "D-1", "--supersedes", "D-2", "--json", "--project", fr]));
  ok(d1 && d1.affects.join() === "US-1.AC-1,T-01" && d2 && d2.kind === "discovery" && d3 && d3.supersedes.join() === "D-1,D-2",
    "decide: repeated --affects / --supersedes are all kept (the parser kept only the last), --kind discovery is honoured (got " + JSON.stringify([d1 && d1.affects, d2 && d2.kind, d3 && d3.supersedes]) + ")");
  // approve --through: a forced step is labelled in the feature's language.
  const ff = runIn(["approve", "alfa", "--through", "requirements", "--force", "--project", fr]);
  ok(ff.code === 0 && /\(forçada: /.test(ff.out) && !/\(forced: /.test(ff.out), "approve --through --force labels a forced step in PT ('forçada'), never the English '(forced: …)' (got " + ff.out.trim().split("\n").slice(-2).join(" | ") + ")");
  // spike: the shortcut passes --flow through like create --kind spike (its note says the flow is ignored).
  const sp = jsonOf(runIn(["spike", "Cache", "--flow", "design-first", "--json", "--project", fr]));
  ok(sp && sp.ok && sp.kind === "spike" && typeof sp.note === "string" && /fluxo ignorado/.test(sp.note), "spike --flow design-first gets create's 'flow ignored' note (got " + JSON.stringify(sp && [sp.kind, sp.note]) + ")");
};
