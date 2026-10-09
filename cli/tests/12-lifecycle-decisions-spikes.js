"use strict";
// dev-spec decide (= spec_decide) and dev-spec spike / create --kind spike, EN / PT.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, all, spawnIn, tmp, CLI, require, __dirname }) => {
// C2 — `dev-spec decide` (= spec_decide) and `dev-spec spike` / `create --kind spike` (= spec_create {kind: "spike"}), EN / PT.
const Sc2 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
const jsonC2 = (s) => { try { return JSON.parse(s); } catch { return null; } };
const rc2 = (args) => { // in-process (1.27), but a --run — it waits for its commands: spawned
  const o = { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp } };
  const r = args.includes("--run") ? spawnSync(process.execPath, [CLI, ...args], o) : spawnIn(args, o);
  return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status };
};

// decide: an entry appended (✎ line, _Affects:_ canonical), --json = the MCP result, --discovery / --supersedes, unknown refs refused.
const pd = path.join(tmp, "c2-decide");
Sc2.initProject(pd, ["tdd"], "en");
const fd = Sc2.createFeature(pd, "Auth", ["tdd"], "", undefined, "en");
const dc1 = rc2(["decide", "auth", "--title", "JWT sessions", "--decision", "Use JWT.", "--context", "Stateless API", "--affects", "us-1.ac-2,T-02,architecture", "--project", pd]);
const dc2 = rc2(["decide", "auth", "--title", "Skew", "--decision", "30 s of skew.", "--discovery", "--supersedes", "D-1", "--json", "--project", pd]);
const dc2j = jsonC2(dc2.stdout);
const before = fs.readFileSync(path.join(fd.dir, "decisions.md"), "utf8");
const dcBad = rc2(["decide", "auth", "--title", "x", "--decision", "y", "--affects", "US-9.AC-9,Ghost", "--project", pd]);
const dcBadJ = rc2(["decide", "auth", "--title", "x", "--decision", "y", "--affects", "T-99", "--json", "--project", pd]);
const dcNoTitle = rc2(["decide", "auth", "--decision", "y", "--project", pd]);
const dcUsage = rc2(["decide", "--project", pd]);
all("decide = spec_decide: appends D-1 (✎ line, canonical _Affects:_), --discovery + --supersedes, --json = the MCP result; unknown _Affects:_ / no --title → exit 1, nothing written (got " +
  JSON.stringify([dc1.out, dcBad.out.slice(0, 120)]) + ")", [
  () => dc1.code === 0, () => /^✎ D-1 — JWT sessions  \(\.specs\/auth\/decisions\.md\)\n  _Affects: US-1\.AC-2, T-02, Architecture_\n$/.test(dc1.out),
  () => dc2.code === 0, () => dc2j, () => dc2j.ok === true, () => dc2j.id === "D-2", () => dc2j.kind === "discovery",
  () => JSON.stringify(dc2j.supersedes) === '["D-1"]',
  () => /\n## D-2 — Skew\n\n- _Kind: discovery_\n- _Date: [^_]+_\n- _Supersedes: D-1_\n\n\*\*Discovery:\*\* 30 s of skew\.\n$/.test(before),
  () => dcBad.code === 1, () => /unknown _Affects:_ reference\(s\): US-9\.AC-9, Ghost — /.test(dcBad.out), () => dcBadJ.code === 1,
  () => jsonC2(dcBadJ.stdout), () => jsonC2(dcBadJ.stdout).unknownAffects[0] === "T-99", () => dcNoTitle.code === 1,
  () => /needs a title/.test(dcNoTitle.out), () => dcUsage.code === 1, () => /dev-spec decide <feature>/.test(dcUsage.out),
  () => fs.readFileSync(path.join(fd.dir, "decisions.md"), "utf8") === before,
]);

// 1.22 review — `--affects "Decisions, reuse & risks"` (the size-S scaffold's own heading, typed unquoted): rejoined, written `quoted`.
const fS22 = Sc2.createFeature(pd, "Small", ["core"], "", undefined, "en", "feature", { size: "s" });
const dcS22 = rc2(["decide", "small", "--title", "Cache", "--decision", "In memory.", "--affects", "Decisions, reuse & risks", "--affects", "US-1.AC-1", "--project", pd]);
ok(dcS22.code === 0 && /\n  _Affects: Decisions, reuse & risks, US-1\.AC-1_\n$/.test(dcS22.out) &&
  /^- _Affects: `Decisions, reuse & risks`, US-1\.AC-1_$/m.test(fs.readFileSync(path.join(fS22.dir, "decisions.md"), "utf8")),
  "1.22 review: decide --affects names a heading holding a comma, unquoted — exit 0, the entry writes it `quoted` (got " + JSON.stringify(dcS22.out) + ")");

// trace prints the phantom _Affects:_ warnings (exit code unchanged); brief shows the decisions citing the task.
fs.appendFileSync(path.join(fd.dir, "decisions.md"), "\n## D-3 — Old\n\n- _Kind: decision_\n- _Date: 2026-01-01_\n- _Affects: US-7.AC-7_\n\n**Decision:** x\n");
const trc = rc2(["trace", "auth", "--project", pd]);
const trcJ = jsonC2(rc2(["trace", "auth", "--json", "--project", pd]).stdout);
const brc = rc2(["brief", "auth", "3", "--project", pd]);
ok(/  ⚠ D-3 _Affects:_ US-7\.AC-7 — names nothing in this feature/.test(trc.out) && trcJ && trcJ.phantomAffects.length === 1 && trcJ.phantomAffects[0].decision === "D-3" &&
  brc.code === 0 && /^# /.test(brc.out) && !/## Decisions/.test(brc.out),
  "trace lists _Affects:_ references that name nothing (⚠, a warning — --json phantomAffects); a superseded entry (D-1) is not in the brief of the task citing it");

// spike: the shortcut and create --kind spike; question / timebox printed; doctor exit 1 until decided; next-action; finish.
const ps = path.join(tmp, "c2-spike");
Sc2.initProject(ps, ["core"], "en");
const sk = rc2(["spike", "Cache spike", "--question", "Can Redis hold sessions?", "--timebox", "2099-01-31", "--project", ps]);
const sk2 = rc2(["create", "Queue spike", "--kind", "spike", "--summary", "Kafka or RabbitMQ?", "--json", "--project", ps]);
const sk2j = jsonC2(sk2.stdout);
const skBad = rc2(["spike", "Late", "--timebox", "tomorrow", "--project", ps]);
const skQ = rc2(["create", "Plain", "core", "--question", "why", "--project", ps]);
ok(sk.code === 0 && /^Feature 'cache-spike' \[core\] \(en\)\n  spike\.md, tasks\.md\n  question: Can Redis hold sessions\?\n  timebox: until 2099-01-31\n$/.test(sk.out) &&
  sk2.code === 0 && sk2j && sk2j.kind === "spike" && JSON.stringify(sk2j.created) === '["spike.md","tasks.md"]' &&
  /## Question\nKafka or RabbitMQ\?\n/.test(fs.readFileSync(path.join(ps, ".specs", "queue-spike", "spike.md"), "utf8")) &&
  skBad.code === 1 && /timebox must be an end date/.test(skBad.out) && !fs.existsSync(path.join(ps, ".specs", "late")) &&
  skQ.code === 1 && /question only applies to a spike/.test(skQ.out),
  "spike \"<name>\" --question --timebox = spec_create {kind: 'spike'} (question + timebox printed); create --kind spike --summary seeds the question; a bad timebox or a question on a feature → exit 1 (got " +
  JSON.stringify([sk.out, skBad.out.slice(0, 100)]) + ")");
const docS = rc2(["doctor", "cache-spike", "--project", ps]);
const apS = rc2(["approve", "cache-spike", "design", "--project", ps]);
const atS = rc2(["add-track", "cache-spike", "tdd", "--project", ps]);
for (const n of ["1", "2", "3", "4"]) rc2(["done", "cache-spike", n, "--project", ps]);
const naS = rc2(["na", "cache-spike", "--project", ps]);
const spf = path.join(ps, ".specs", "cache-spike", "spike.md");
fs.writeFileSync(spf, fs.readFileSync(spf, "utf8").replace(/> \*\*TODO\*\* — go \/ no-go \/ pivot[^\n]*/, "Latency 2 ms p95 — measured.").replace(/^_Outcome: [^\n]*_$/m, "_Outcome: no-go_"));
const docS2 = rc2(["doctor", "cache-spike", "--project", ps]);
const naS2 = rc2(["next-action", "cache-spike", "--json", "--project", ps]);
const finS = rc2(["finish", "cache-spike", "--write", "--project", ps]);
const rmS = rc2(["roadmap", "--write", "--project", ps]);
all("spike on the CLI: doctor exits 1 until the decision is written; approve / add-track refuse a spike; next-action goes decide → archive (no-go); finish is ready once decided; ROADMAP.md labels it (got " +
  JSON.stringify([docS.out.slice(0, 200), naS.out.slice(0, 160)]) + ")", [
  () => docS.code === 1, () => /✗ decision — spike\.md → Decision is not written yet/.test(docS.out),
  () => /✓ timebox — timebox until 2099-01-31/.test(docS.out), () => apS.code === 1, () => /is a spike: it has no design gate/.test(apS.out),
  () => atS.code === 1, () => /is a spike — it has no tracks/.test(atS.out), () => /Record the decision in spike\.md → Decision/.test(naS.out),
  () => docS2.code === 0, () => /✓ decision — decision recorded \(_Outcome: no-go_\)/.test(docS2.out), () => jsonC2(naS2.stdout),
  () => jsonC2(naS2.stdout).step === "archive", () => jsonC2(naS2.stdout).outcome === "no-go", () => finS.code === 0,
  () => /spike 'cache-spike' is ready to finish/.test(finS.out),
  () => fs.existsSync(path.join(ps, ".specs", "cache-spike", ".execution", "merge-summary.md")), () => rmS.code === 0,
  () => /\[cache-spike\]\(\.\/cache-spike\/spike\.md\) 🔬 spike/.test(fs.readFileSync(path.join(ps, ".specs", "ROADMAP.md"), "utf8")),
]);

// PT: the spike and the decision log in the feature's language.
const pp = path.join(tmp, "c2-pt");
Sc2.initProject(pp, ["core"], "pt");
const skPt = rc2(["spike", "Pesquisa cache", "--question", "Redis ou Memcached?", "--timebox", "3d", "--project", pp]);
const dcPt = rc2(["decide", "pesquisa-cache", "--title", "Redis", "--decision", "Usar Redis.", "--affects", "Evidência", "--project", pp]);
const docPt = rc2(["doctor", "pesquisa-cache", "--project", pp]);
ok(skPt.code === 0 && /  pergunta: Redis ou Memcached\?\n  timebox: até \d{4}-\d\d-\d\d\n$/.test(skPt.out) &&
  /## Pergunta\nRedis ou Memcached\?/.test(fs.readFileSync(path.join(pp, ".specs", "pesquisa-cache", "spike.md"), "utf8")) &&
  dcPt.code === 0 && /^✎ D-1 — Redis/.test(dcPt.out) && /^# Decisões: Pesquisa cache\n/.test(fs.readFileSync(path.join(pp, ".specs", "pesquisa-cache", "decisions.md"), "utf8")) &&
  docPt.code === 1 && /✗ decision — spike\.md → Decisão ainda não está escrita/.test(docPt.out),
  "PT: spike prints pergunta / timebox até; decide writes '# Decisões:' (a spike section as _Affects:_); doctor speaks Portuguese (got " + JSON.stringify([skPt.out, docPt.out.slice(0, 200)]) + ")");

// help and the command table document spike and decide.
const hC2 = rc2(["help"]).out;
const docC2 = require(path.join(path.dirname(CLI), "commands.js")).helpText();
ok(['spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d]', 'decide <feature> --title "…" --decision "…"', "--kind feature|bugfix|spike"].every((w) => hC2.includes(w)) &&
  ['spike "<name>" [--question "…"] [--timebox YYYY-MM-DD|3d]', 'decide <feature> --title "…" --decision "…"'].every((w) => docC2.includes(w)),
  "help and the command table document spike, decide and --kind spike");
};
