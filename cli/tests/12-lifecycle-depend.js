"use strict";
// depend = spec_depend (replace / --add / --rm / --clear), one default approver, own-key lookups.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, runIn, tmp, CLI }) => {
  const dp = path.join(tmp, "wp3-dep");
  fs.mkdirSync(dp, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
  ["a", "b", "c"].forEach((n) => runIn(["create", n, "core", "--project", dp]));
  const depsOfA = () => { try { return JSON.parse(fs.readFileSync(path.join(dp, ".specs", "roadmap.json"), "utf8")).features.a.dependsOn.join(); } catch { return null; } };
  ok(runIn(["depend", "a", "b", "c", "--project", dp]).code === 0 && depsOfA() === "b,c", "depend a b c replaces the list");
  const show = runIn(["depend", "a", "--project", dp]);
  ok(show.code === 0 && /depends on: b, c/.test(show.out) && depsOfA() === "b,c", "a bare `depend <f>` shows the deps and no longer clears them");
  ok(runIn(["depend", "a", "--rm", "b", "--project", dp]).code === 0 && depsOfA() === "c", "depend --rm removes one dependency");
  ok(runIn(["depend", "a", "--add", "b", "--project", dp]).code === 0 && depsOfA() === "c,b", "depend --add appends one");
  const unk = runIn(["depend", "a", "--add", "nope,steering", "--project", dp]);
  ok(unk.code === 1 && /not found: nope, steering/.test(unk.out) && depsOfA() === "c,b", "depend with unknown/reserved features exits 1, names them and stores nothing");
  ok(runIn(["depend", "a", "--order", "x", "--project", dp]).code === 1 && runIn(["depend", "a", "--project", dp, "--add"]).code === 1,
    "depend --order x (not an integer) and --add without a value exit 1");
  // 1.22 review: --order is a SAFE integer, like spec_depend's (MCP refuses 1e20): "99999999999999999999" matched the digits and was
  // stored as 1e20 (exit 0). Refused in the MCP validator's words, nothing written; MAX_SAFE_INTEGER and a negative are stored.
  const orderOf = () => { try { return JSON.parse(fs.readFileSync(path.join(dp, ".specs", "roadmap.json"), "utf8")).features.a.order; } catch { return "unreadable"; } };
  const ord0 = orderOf();
  const big22 = [runIn(["depend", "a", "--order", "99999999999999999999", "--project", dp]), runIn(["depend", "a", "--order=9007199254740992", "--project", dp])];
  const bigOrd22 = orderOf();
  const safe22 = runIn(["depend", "a", "--order", "9007199254740991", "--project", dp]);
  const safeOrd22 = orderOf();
  const neg22 = runIn(["depend", "a", "--order", "-2", "--project", dp]);
  ok(big22.every((r) => r.code === 1 && /order must be an integer \(got "(?:99999999999999999999|9007199254740992)"\)/.test(r.out)) && bigOrd22 === ord0 &&
    safe22.code === 0 && safeOrd22 === 9007199254740991 && neg22.code === 0 && orderOf() === -2,
    "1.22 review: depend --order 99999999999999999999 / 2^53 exit 1 (an integer past the safe range, refused as over MCP) and store nothing; MAX_SAFE_INTEGER and -2 are stored (got " +
    JSON.stringify([big22.map((r) => [r.code, r.out.trim()]), bigOrd22, safeOrd22, orderOf()]) + ")");
  ok(runIn(["depend", "a", "--clear", "--project", dp]).code === 0 && depsOfA() === "", "depend --clear empties the list explicitly");
  // A repeated flag used to keep only its last value (`--add b --add c` added c alone, exit 0).
  const rep = runIn(["depend", "a", "--add", "b", "--add=c", "--project", dp]);
  ok(rep.code === 0 && /depends on: b, c/.test(rep.out) && depsOfA() === "b,c", "depend --add b --add=c adds both (every occurrence counts)");
  runIn(["depend", "a", "b", "c", "--project", dp]);
  ok(depsOfA() === "b,c" && runIn(["depend", "a", "--rm", "b", "--rm", "c", "--project", dp]).code === 0 && depsOfA() === "", "depend --rm b --rm c removes both");
  ok(runIn(["depend", "a", "--add", "b", "--project", dp, "--add"]).code === 1 && depsOfA() === "", "a repeated --add with a missing value exits 1 and changes nothing");
  ok(/--add x,y/.test(runIn(["help"]).out), "help documents depend --add/--rm/--clear");
  const ap = spawnSync(process.execPath, [CLI, "approve", "a", "requirements", "--force", "--project", dp], { encoding: "utf8", env: { ...process.env, USER: "wp3-tester", USERNAME: "wp3-tester" } }); // templates: 1.13 gate
  runIn(["approve", "a", "design", "--by", "carol", "--force", "--project", dp]);
  const appr = JSON.parse(fs.readFileSync(path.join(dp, ".specs", "a", ".state.json"), "utf8")).approvals;
  ok(ap.status === 0 && appr.requirements.by === "wp3-tester" && appr.design.by === "carol", "approve without --by records the engine default ($USER/$USERNAME, same as MCP); --by still wins");
  const st = runIn(["steering", "constructor", "--project", dp]);
  const mc = runIn(["mcp-config", "constructor"]);
  ok(st.code === 1 && /Unknown steering file/.test(st.out) && !/TypeError|ERR_INVALID/.test(st.out) && mc.code === 1 && /unknown client/.test(mc.out),
    "steering constructor / mcp-config constructor → the normal 'unknown' errors (own-key lookups)");
};
