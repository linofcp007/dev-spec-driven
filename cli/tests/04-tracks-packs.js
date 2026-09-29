"use strict";
// Project-defined tracks — `dev-spec tracks [list|init <name>|check]` and a pack in classify / create / status / doctor.

const fs = require("fs");
const path = require("path");

// 1.15 feature (F4) — project-defined tracks: `dev-spec tracks [list|init <name>|check]` and a pack used by classify / create /
// status / doctor / add-track, as spec_tracks and the MCP tools do.
exports.run = ({ ok, run, tmp, CLI }) => {
  const f4 = path.join(tmp, "f4-tracks");
  const js = (x) => JSON.stringify(x);
  const r = (args) => run([...args, "--project", f4]);
  run(["init", "--lang", "en", "--project", f4]);
  const i1 = r(["tracks", "init", "a11y"]);
  const i2 = r(["tracks", "init", "a11y"]);
  const iBad = r(["tracks", "init", "sec"]);
  const iNo = r(["tracks", "init"]);
  const pdir = path.join(f4, ".specs", "tracks", "a11y");
  ok(i1.code === 0 && /Track pack \+a11y scaffolded \(6 file\(s\)\)/.test(i1.out) && /\+ \.specs\/tracks\/a11y\/track\.json/.test(i1.out) && fs.existsSync(path.join(pdir, "steering.md")) &&
    i2.code === 0 && /Nothing written — every file of the \+a11y pack is already there/.test(i2.out) && iBad.code === 1 && /'sec' is reserved/.test(iBad.out) &&
    iNo.code === 1 && /tracks init needs a name/.test(iNo.out),
    "feature F4: tracks init scaffolds the pack's 6 files (never overwrites; a reserved or missing name exits 1) (got " + js(i1.out.slice(0, 200)) + ")");
  // The team's real pack: signals, sections, fragments.
  fs.writeFileSync(path.join(pdir, "track.json"), JSON.stringify({ name: "a11y", marker: "A11Y", title: { en: "Accessibility", pt: "Acessibilidade" },
    signals: { strong: ["screen reader", "accessibility"], weak: ["keyboard"] }, sections: [{ name: "Keyboard Navigation" }, { name: "Screen Reader Support", guidance: "Landmarks and labels." }],
    steering: "a11y.md" }, null, 2));
  fs.writeFileSync(path.join(pdir, "requirements.md"), "- WHEN a user tabs through the page THE SYSTEM SHALL show a visible focus ring on every control\n");
  fs.writeFileSync(path.join(pdir, "tasks.md"), "- [ ] Focus ring on every control\n  - _Requirements: {{ac1}}_\n");
  fs.rmSync(path.join(pdir, "test-plan.md")); // the example's rows cite {{ac2}} — with one criterion left, check would refuse the pack
  const ls = r(["tracks"]);
  const ck = r(["tracks", "check"]);
  let ckJ = {};
  try { ckJ = JSON.parse(r(["tracks", "check", "--json"]).out); } catch { /* stays {} */ }
  ok(ls.code === 0 && /^Tracks — 10 built-in, 1 project pack\(s\) in \.specs\/tracks\/ \(1 valid\):/.test(ls.out) && /  ✎ a11y +\[A11Y\]  Accessibility — 2 section\(s\) · 3 signal\(s\) · steering\/a11y\.md/.test(ls.out) &&
    /  · sec +\[SEC\]  5 section\(s\)/.test(ls.out) && ck.code === 0 && /1 track pack\(s\) checked — 1 valid, 0 error\(s\), 0 warning\(s\)\./.test(ck.out) && ckJ.ok === true && ckJ.verdict === "pass",
    "feature F4: tracks (list) shows the built-in tracks and the pack; tracks check passes (exit 0; --json = spec_tracks' result) (got " + js(ls.out.slice(0, 400)) + ")");
  // classify / create / status / doctor with the pack.
  const cl = r(["classify", "A settings page that works with a screen reader"]);
  const cr = r(["create", "Settings", "a11y", "--summary", "Settings page"]);
  const st = r(["status", "settings"]);
  const dr = r(["doctor", "settings"]);
  const reqf = path.join(f4, ".specs", "settings", "requirements.md");
  const req = fs.existsSync(reqf) ? fs.readFileSync(reqf, "utf8") : "";
  ok(/core \+ui \+a11y/.test(cl.out) && /a11y=medium/.test(cl.out) && /\+a11y: ON/.test(cl.out) && cr.code === 0 && /#### \[A11Y\] Accessibility — Acceptance Criteria \(EARS\)\n5\. \*\*US-1\.AC-5\*\* — WHEN a user tabs through the page/.test(req) &&
    /\[A11Y\] sections: ◐ Keyboard Navigation \(unfilled\) · ◐ Screen Reader Support \(unfilled\)/.test(st.out) && dr.code === 1 && /a11y-sections/.test(dr.out) &&
    fs.existsSync(path.join(f4, ".specs", "steering", "a11y.md")),
    "feature F4: classify picks +a11y from the pack's signals; create a11y scaffolds its criteria and steering; status shows the [A11Y] sections; doctor fails a11y-sections (exit 1) (got " + js(cl.out.slice(0, 200)) + " / " + js(st.out.slice(0, 300)) + ")");
  // add-track / --remove on another feature; a bad pack → check exits 1 and the pack is ignored (an unknown track).
  r(["create", "Profile", "core", "--summary", "Profile"]);
  const at = r(["add-track", "profile", "a11y"]);
  const rm = r(["add-track", "profile", "a11y", "--remove"]);
  fs.mkdirSync(path.join(f4, ".specs", "tracks", "broken"), { recursive: true });
  fs.writeFileSync(path.join(f4, ".specs", "tracks", "broken", "track.json"), JSON.stringify({ name: "broken", marker: "PRIVACY", title: { en: "Broken" }, sections: [{ name: "Scope" }] }));
  const ck2 = r(["tracks", "check"]);
  const cr2 = r(["create", "Other", "broken"]);
  ok(at.code === 0 && /\+a11y/.test(at.out) && /design\.md \(\+sections\)/.test(at.out) && rm.code === 0 && /\[A11Y\]/.test(rm.out) &&
    ck2.code === 1 && /✗ \.specs\/tracks\/broken\/track\.json — marker \[PRIVACY\] is taken by dev-spec/.test(ck2.out) && cr2.code === 1 && /Unknown track/.test(cr2.out),
    "feature F4: add-track a11y / --remove; a pack with a built-in marker → tracks check exits 1 naming it, and the pack is no track (got " + js(ck2.out.slice(0, 300)) + ")");
  // A deleted pack: status names it, doctor warns track-pack-missing — never a crash.
  fs.rmSync(pdir, { recursive: true, force: true });
  const st2 = r(["status", "settings"]);
  const dr2 = r(["doctor", "settings", "--json"]);
  let d2 = null;
  try { d2 = JSON.parse(dr2.out); } catch { /* stays null */ }
  ok(st2.code === 0 && /track pack\(s\) not available: \+a11y/.test(st2.out) && d2 && d2.checks.some((c) => c.id === "track-pack-missing" && c.status === "warn") && !d2.checks.some((c) => c.id === "a11y-sections"),
    "feature F4: a deleted pack — status names it, doctor warns track-pack-missing and requires none of its sections");
  // Localized: tracks init --lang pt writes Portuguese comments and speaks Portuguese; the help documents the command.
  const ip = r(["tracks", "init", "mobile", "--lang", "pt"]);
  const help = run(["help"]).out;
  const doc = fs.readFileSync(CLI, "utf8").split("*/")[0];
  const mj = path.join(f4, ".specs", "tracks", "mobile", "track.json");
  ok(ip.code === 0 && /Track pack \+mobile criado/.test(ip.out) && fs.existsSync(mj) && /um track definido pelo projeto/.test(fs.readFileSync(mj, "utf8")) &&
    /tracks \[list\|init <name>\|check\]/.test(help) && /tracks \[list\|init <name>\|check\]/.test(doc) && r(["tracks", "bogus"]).code === 1,
    "feature F4: tracks init --lang pt (Portuguese files and messages); help and the docblock document `tracks`; an unknown action exits 1");
};
