"use strict";
// No stray .tmp files, the cross-process feature lock.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = ({ ok, run, tmp, CLI }) => {
  const tmpsIn = (d) => { try { return fs.readdirSync(d).filter((x) => /\.tmp$/i.test(x)); } catch { return ["<unreadable>"]; } };
  // roadmap --write where ROADMAP.md can't be replaced (a folder): an error, and no ROADMAP.md.<pid>.<ts>.tmp left behind.
  const t14 = path.join(tmp, "wp14-tmp");
  run(["init", "--project", t14]);
  run(["create", "Alpha", "core", "--project", t14]);
  const specs14 = path.join(t14, ".specs");
  fs.rmSync(path.join(specs14, "ROADMAP.md"), { force: true });
  fs.mkdirSync(path.join(specs14, "ROADMAP.md"));
  const rw14 = run(["roadmap", "--write", "--project", t14]);
  const bl14 = run(["backlog", "add", "Later", "--project", t14]);
  ok(rw14.code === 1 && /dev-spec: /.test(rw14.out) && bl14.code === 0 && tmpsIn(specs14).length === 0,
    "roadmap --write fails cleanly when ROADMAP.md can't be replaced and neither it nor backlog add leaves a .tmp in .specs/ (left: " + tmpsIn(specs14).join(", ") + ")");

  // done while another live process holds the feature's lock: waits DEV_SPEC_LOCK_WAIT_MS, then refuses (exit 1, --json
  // prints the refusal) with nothing ticked or recorded — MCP's spec_complete_task answers the same.
  const k14 = path.join(tmp, "wp14-lock");
  fs.mkdirSync(k14, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
  run(["create", "Race", "core", "--project", k14]);
  const kDir14 = path.join(k14, ".specs", "race");
  fs.writeFileSync(path.join(kDir14, "tasks.md"), "- [ ] 1. a\n- [ ] 2. b\n");
  const lock14 = path.join(kDir14, ".lock");
  fs.writeFileSync(lock14, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString() }));
  const runEnv = (args) => { const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: tmp, DEV_SPEC_LOCK_WAIT_MS: "50" } }); return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status }; };
  const busy14 = runEnv(["done", "race", "1", "--evidence", "ok", "--project", k14]);
  const busyJson14 = runEnv(["done", "race", "1", "--json", "--project", k14]);
  let bj14 = {};
  try { bj14 = JSON.parse(busyJson14.stdout); } catch { /* stays {} */ }
  const untouched14 = /- \[ \] 1\./.test(fs.readFileSync(path.join(kDir14, "tasks.md"), "utf8")) && !(JSON.parse(fs.readFileSync(path.join(kDir14, ".state.json"), "utf8")).evidence || {})["1"];
  fs.rmSync(lock14, { force: true });
  const free14 = run(["done", "race", "1", "--project", k14]);
  ok(busy14.code === 1 && /Another dev-spec process is updating 'race' right now \(\.specs\/race\/\.lock\)/.test(busy14.out) && busyJson14.code === 1 && bj14.ok === false && bj14.busy === true &&
    untouched14 && free14.code === 0 && !fs.existsSync(lock14),
    "done under another process's feature lock: exit 1 with the busy error (--json prints {ok:false, busy:true}), nothing ticked; once released it ticks and leaves no .lock");
  // feature rename / create (existing feature) wait on the same lock; depend / backlog on .specs/.roadmap.lock — like MCP.
  fs.writeFileSync(lock14, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString() }));
  const rlock14 = path.join(k14, ".specs", ".roadmap.lock");
  fs.writeFileSync(rlock14, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString() }));
  const rn14 = runEnv(["feature", "rename", "race", "sprint", "--project", k14]);
  const cr14 = runEnv(["create", "race", "saas", "--project", k14]);
  const bl14r = runEnv(["backlog", "add", "Later", "--project", k14]);
  fs.rmSync(lock14, { force: true });
  fs.rmSync(rlock14, { force: true });
  const kept14 = fs.existsSync(kDir14) && !fs.existsSync(path.join(kDir14, "load-test.md")) && !fs.existsSync(path.join(k14, ".specs", "sprint"));
  const rnFree14 = run(["feature", "rename", "race", "sprint", "--project", k14]);
  ok(rn14.code === 1 && /Another dev-spec process is updating 'race' right now/.test(rn14.out) && cr14.code === 1 && /updating 'race' right now/.test(cr14.out) &&
    bl14r.code === 1 && /updating \.specs\/roadmap\.json right now \(\.specs\/\.roadmap\.lock\)/.test(bl14r.out) && kept14 && rnFree14.code === 0 && !fs.existsSync(path.join(k14, ".specs", "sprint", ".lock")) && !fs.existsSync(kDir14),
    "feature rename / create on a held feature lock and backlog add on a held roadmap lock: exit 1, busy, nothing changed; once free the rename moves the folder and leaves no .lock (got " +
    JSON.stringify([rn14.code, rn14.out.slice(0, 80), cr14.code, cr14.out.slice(0, 80), bl14r.code, bl14r.out.slice(0, 80), rnFree14.code, rnFree14.out.slice(0, 80)]) + ")");
  // A stale lock that can't be removed (a folder named .lock, an hour old): done answers the stuck-lock error at the
  // deadline (exit 1, --json {busy, stuck}) — it spun at 100% CPU forever. The same as spec_complete_task.
  const sLock14 = path.join(k14, ".specs", "sprint", ".lock");
  fs.mkdirSync(path.join(sLock14, "x"), { recursive: true });
  const hourAgo14 = new Date(Date.now() - 3600e3);
  fs.utimesSync(sLock14, hourAgo14, hourAgo14);
  const stuckRun = (args) => { const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", timeout: 15000, env: { ...process.env, SPEC_PROJECT_DIR: tmp, DEV_SPEC_LOCK_WAIT_MS: "200" } }); return { out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", code: r.status }; };
  const stuck14 = stuckRun(["done", "sprint", "2", "--project", k14]);
  const stuckJ14 = stuckRun(["done", "sprint", "2", "--json", "--project", k14]);
  let sj14 = {};
  try { sj14 = JSON.parse(stuckJ14.stdout); } catch { /* stays {} */ }
  ok(stuck14.code === 1 && /A stale dev-spec lock \(\.specs\/sprint\/\.lock\) could not be removed .* Delete \.specs\/sprint\/\.lock by hand/.test(stuck14.out) &&
    stuckJ14.code === 1 && sj14.busy === true && sj14.stuck === true && /- \[ \] 2\./.test(fs.readFileSync(path.join(k14, ".specs", "sprint", "tasks.md"), "utf8")),
    "done on a stale lock that can't be removed (a folder named .lock): exit 1 with the localized 'delete it by hand' error (--json {busy, stuck}) within DEV_SPEC_LOCK_WAIT_MS, nothing ticked (got " +
    JSON.stringify([stuck14.code, stuck14.out.slice(0, 90), stuckJ14.code]) + ")");

  // A command waiting on a feature's lock whose folder is removed meanwhile (remove's tombstone rename) answers not-found:
  // its pre-lock "the feature exists" read was stale, and its write recreated a zombie .specs/<slug>/.
  const lr14 = path.join(tmp, "wp14-lock-race");
  fs.mkdirSync(lr14, { recursive: true }); // 1.23 review: --project names an existing folder (only init creates one)
  run(["create", "Imp", "core", "--project", lr14]);
  const imp14 = path.join(lr14, ".specs", "imp");
  fs.writeFileSync(path.join(imp14, ".lock"), JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), token: "held-by-test" })); // a live holder
  const race14 = path.join(tmp, "wp14-lock-race.js");
  fs.writeFileSync(race14, [
    "const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');",
    "const [cli, proj, dir] = process.argv.slice(2);",
    "const p = spawn(process.execPath, [cli, 'add-track', 'imp', 'saas', '--project', proj], { env: { ...process.env, DEV_SPEC_LOCK_WAIT_MS: '8000' } });",
    "let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));",
    // Windows refuses a folder rename while the waiter has a file open inside it (its lock attempt): retry, like the engine does.
    "const moveAway = (left) => { try { const t = path.join(path.dirname(dir), '.removing-imp-test'); fs.renameSync(dir, t); fs.rmSync(t, { recursive: true, force: true }); }" +
    " catch (e) { if (left > 0 && ['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) setTimeout(() => moveAway(left - 1), 25); else throw e; } };",
    "setTimeout(() => moveAway(200), 1200);",
    "p.on('close', (code) => console.log(JSON.stringify({ code, out, exists: fs.existsSync(dir) })));",
  ].join("\n"));
  const rr14 = spawnSync(process.execPath, [race14, CLI, lr14, imp14], { encoding: "utf8", timeout: 30000 });
  let rj14 = null;
  try { rj14 = JSON.parse(rr14.stdout.trim().split("\n").pop()); } catch { /* stays null */ }
  ok(rj14 && rj14.code !== 0 && rj14.exists === false && /not found/i.test(rj14.out),
    "a command waiting on a feature's lock whose folder is removed meanwhile answers not-found and never recreates .specs/<slug>/ (got " +
    (rj14 ? JSON.stringify(rj14).slice(0, 200) : (rr14.stdout + rr14.stderr).slice(0, 200)) + ")");
};
