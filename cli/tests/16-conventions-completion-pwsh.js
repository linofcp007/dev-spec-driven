"use strict";
// Shell completion at work in Windows PowerShell 5.1 and pwsh — the generated script dot-sourced, TabExpansion2 asked; skipped where no PowerShell runs.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { fixture, helpers: { fwd, cleanEnv, probe } } = require("./16-conventions-completion.js");

// 1.30 (review 8, ds-maint 2): 16-conventions-completion.js ran bash and PowerShell too, one process — the CLI suite's critical path (~60 s).
exports.run = async ({ ok, runIn, tmp, CLI }) => {
  const { S, scripts, p, cache, staleCli, withCli } = fixture({ runIn, tmp, CLI }, ["powershell"]);

  // 1.25 completion: Windows PowerShell 5.1 (and pwsh when installed) — the script dot-sourced, TabExpansion2 asked: the same answers,
  // the cursor inside a line, `dev-spec` a function that runs this CLI (piped input too) and passes `--tracks tdd,saas` as ONE word and
  // `--timebox 3d` as "3d"; in a plugin cache, the newest version. Skipped where no PowerShell runs (the Linux images).
  // 1.30: ONE PowerShell process per shell runs the three scripts in turn (this one, a gone CLI path, an older one) — each start of
  // Windows PowerShell costs ~2–4 s, and there were four per shell (a probe, then a process per script); a shell that isn't there is
  // the spawn's ENOENT.
  {
    const file = path.join(tmp, "c125-c.ps1"), stale = path.join(tmp, "c125-stale.ps1"), stub = path.join(tmp, "c125-stub.ps1");
    fs.writeFileSync(file, scripts.powershell.stdout);
    fs.writeFileSync(stale, withCli(scripts.powershell.stdout, staleCli));
    fs.writeFileSync(stub, withCli(scripts.powershell.stdout, fwd(path.join(cache, "1.9.0", "cli", "dev-spec.js"))));
    const drive = path.join(tmp, "c125-drive.ps1");
    fs.writeFileSync(drive, [
      "param([string]$Scripts, [string]$Project)",
      "$lines = [Console]::In.ReadToEnd().Split([char]10)",
      "foreach ($Script in $Scripts.Split('|')) {",
      "  . $Script",
      "  Set-Location -LiteralPath $Project",
      "  foreach ($l in $lines) {",
      "    if (-not $l) { continue }",
      "    $col = $l.Length; if ($l.Contains('^')) { $col = $l.IndexOf('^'); $l = $l.Replace('^', '') }",
      "    $r = TabExpansion2 -inputScript $l -cursorColumn $col",
      "    Write-Output ('@ ' + (@($r.CompletionMatches | ForEach-Object { $_.CompletionText }) -join ' '))",
      "  }",
      "  Write-Output ('@ ' + (Get-Command dev-spec).CommandType)",
      "  Write-Output ('@ ' + ((dev-spec version --json | Out-String) -match '\"ok\": true'))",
      "  Write-Output ('@ ' + (('x' | dev-spec ears - --json | Out-String) -match '\"verdict\"'))",
      "  Write-Output ('@ ' + (dev-spec x --tracks tdd,saas --timebox 3d | Out-String).Trim())",
      "  Write-Output '@@'",
      "}",
    ].join("\r\n") + "\r\n");
    const lines = ["dev-spec st", "dev-spec status lo", "dev-spec create --fl", "dev-spec create x --flow d", "dev-spec init --lang=p", "dev-spec approve login ",
      "dev-spec feature restore ", "dev-spec add-track login s", "dev-spec help ap", "dev-spec --project \"" + fwd(p) + "\" status re", "dev-spec create x --tracks tdd,s",
      "dev-spec na lo", "dev-spec status lo^ --json"];
    const go = (psh) => spawnSync(psh, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", drive, "-Scripts", [file, stale, stub].join("|"), "-Project", p],
      { encoding: "utf8", env: cleanEnv(), input: lines.join("\n") + "\n", timeout: 180000 });
    // → the "@ " lines of each script's turn, in order
    const turns = (out) => out.split(/\r?\n/).reduce((acc, l) => { if (l === "@@") acc.push([]); else if (l.startsWith("@ ")) acc[acc.length - 1].push(l.slice(2).trim()); return acc; }, [[]]);
    const ran = [process.platform === "win32" ? "powershell.exe" : null, "pwsh"].filter(Boolean).map((psh) => [psh, go(psh)])
      .filter(([, r]) => !(r.error && r.error.code === "ENOENT"));
    if (!ran.length) ok(true, "1.25 completion: PowerShell at work — skipped (no PowerShell here)");
    for (const [psh, r] of ran) {
      const [got = [], st = [], sb = []] = turns(r.stdout || "");
      const want = ["status statusline steering stop-check", "login logout", "--flow", "design-first", "--lang=pt --lang=pt-BR", S.PHASES.join(" "), "billing old-thing",
        "saas sec", "append-tasks approve", "reports", "saas sec", "login logout", "login logout", "Function", "True", "True"];
      ok(want.every((w, i) => got[i] === w) && st[6] === "from-1-10-0" && sb[6] === "from-1-10-0" && sb[16] === JSON.stringify(["x", "--tracks", "tdd,saas", "--timebox", "3d"]),
        "1.25 completion: " + psh + " — TabExpansion2 completes commands, flags, values (--lang=p), phases, archived names, track names after 'tdd,', feature names (also of --project, " +
        "and with the cursor inside the line); `dev-spec` is a function running this CLI (piped input too) that passes --tracks tdd,saas as one word and --timebox 3d as \"3d\"; a CLI path " +
        "in a plugin cache — gone or older — follows the newest version (got " + JSON.stringify({ got, stale: st[6], stub: [sb[6], sb[16]], err: String(r.stderr || "").slice(0, 400) }) + ")");
    }
  }
};
