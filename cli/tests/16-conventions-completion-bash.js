"use strict";
// Shell completion at work in bash (Git Bash on Windows) — the generated script sourced, COMPREPLY asked: commands, flags, values, feature names, the plugin cache.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { fixture, helpers: { fwd, cleanEnv, probe } } = require("./16-conventions-completion.js");

// 1.30 (review 8, ds-maint 2): 16-conventions-completion.js ran bash and PowerShell too, one process — the CLI suite's critical path (~60 s).
exports.run = async ({ ok, runIn, tmp, CLI }) => {
  const { S, cliFwd, scripts, p, staleCli, withCli } = fixture({ runIn, tmp, CLI }, ["bash"]);

  // 1.25 completion: bash (Git Bash on Windows) — the script sourced, COMP_WORDS / COMP_CWORD set, the function called: commands,
  // flags, values (also "--lang=" split at "=" and "tdd,s" lists), positionals by position and by sub-command, feature names of the
  // working folder or of --project, `dev-spec` defined as a function that runs this CLI; in a plugin cache, the newest version.
  {
    const bash = probe(process.platform === "win32" ? [process.env.DEV_SPEC_TEST_BASH, "C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files\\Git\\usr\\bin\\bash.exe"] : [process.env.DEV_SPEC_TEST_BASH, "bash"]);
    if (!bash) ok(true, "1.25 completion: bash at work — skipped (no bash here; set DEV_SPEC_TEST_BASH)");
    else {
      const file = path.join(tmp, "c125-c.bash"), stale = path.join(tmp, "c125-stale.bash");
      fs.writeFileSync(file, scripts.bash.stdout);
      fs.writeFileSync(stale, withCli(scripts.bash.stdout, staleCli));
      const drive = path.join(tmp, "c125-drive.sh");
      fs.writeFileSync(drive, [
        "S=$1; shift",
        "t() { bash -c '. \"$1\"; shift; COMP_WORDS=(\"$@\"); COMP_CWORD=$(( $# - 1 )); __dev_spec_complete; printf \"%s \" \"${COMPREPLY[@]}\"' _ \"$S\" \"$@\"; echo; }",
        "while IFS='|' read -r -a w; do t \"${w[@]}\"; done",
      ].join("\n") + "\n");
      const lines = [["dev-spec", "st"], ["dev-spec", "status", "lo"], ["dev-spec", "create", "--fl"], ["dev-spec", "create", "x", "--flow", "d"], ["dev-spec", "init", "--lang", "=", "p"],
        ["dev-spec", "init", "--lang", "="], ["dev-spec", "approve", "login", ""], ["dev-spec", "feature", "restore", ""], ["dev-spec", "add-track", "login", "s"],
        ["dev-spec", "help", "ap"], ["dev-spec", "--project", fwd(p), "status", "re"], ["dev-spec", "create", "x", "--tracks", "tdd,s"], ["dev-spec", "-"], ["dev-spec", "na", "lo"]];
      const go = (script, cwd) => spawnSync(bash, [fwd(drive), fwd(script)], { encoding: "utf8", cwd, env: cleanEnv(), input: lines.map((l) => l.join("|") + "|").join("\n") + "\n" }); // a trailing | keeps an empty last word
      const r = go(file, p);
      const got = r.stdout.split("\n").map((s) => s.trim());
      const fromOut = go(file, path.join(tmp, "c125-outside")).stdout.split("\n").map((s) => s.trim());
      const fn = spawnSync(bash, ["-c", ". \"$1\"; type -t dev-spec; dev-spec version --json", "_", fwd(file)], { encoding: "utf8", cwd: p, env: cleanEnv() });
      const st = go(stale, p).stdout.split("\n").map((s) => s.trim());
      const want = ["status statusline steering stop-check", "login logout", "--flow", "design-first", "pt pt-BR", "=en =pt =es =pt-BR",
        S.PHASES.join(" "), "billing old-thing", "saas sec", "append-tasks approve", "reports", "tdd,saas tdd,sec", "--json --project --help --version", "login logout"];
      const fnJ = (() => { try { return JSON.parse(fn.stdout.slice(fn.stdout.indexOf("{"))); } catch { return null; } })();
      ok(want.every((w, i) => got[i] === w) && fromOut[10] === "reports" && fromOut[1] === "" && /^function/.test(fn.stdout) && fnJ && fnJ.ok === true && fnJ.cli === cliFwd &&
        st[7] === "from-1-10-0", "1.25 completion: bash — commands, flags, values (--lang = p, --lang =, tdd,s), approve's phases, archived names for feature restore, the aliases, " +
        "feature names of the working folder or of --project, `dev-spec` as a function running this CLI; a CLI path gone in a plugin cache follows the newest version (1.10.0 over 1.9.0 and 1.2.0-rc1) (got " +
        JSON.stringify({ got, fromOut: fromOut.slice(0, 2).concat(fromOut[10]), fn: fn.stdout.slice(0, 80), stale: st[7], err: r.stderr.slice(0, 300) }) + ")");
    }
  }
};
