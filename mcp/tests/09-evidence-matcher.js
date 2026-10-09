"use strict";
// Evidence — the run matcher's readings (review 5): quotes, operator spacing, `./`, npm's aliases, cmd.exe / PowerShell folders, the observed pre-filter; cmd.exe's PT / ES wording.

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, remeasure, S, tmp, __dirname, require }) => {
  const js = JSON.stringify;
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const PV = (cmd, verify, root) => S.runProvesVerify({ command: cmd, exitCode: 0, cmdRule: 1 }, Array.isArray(verify) ? verify : [verify], root);

  // Review 5 (L9 + improvements) — spellings that run the same command read as one: a quoted word whose content holds none of
  // $ ` \ ! " ' in either quotes; `&&` / `||` / `;` / `|` however spaced; a leading `./` on a path below the folder; npm's own
  // aliases of `npm test`; cmd.exe's chdir / pushd / popd and PowerShell's Set-Location / sl / Push-Location / Pop-Location
  // (-Path / -LiteralPath) like cd. What runs something else stays apart: `./gradlew` (this folder's program), Go's `./...`, a
  // quote holding $ or a backslash, `npm run test:unit`, a run that leaves the folder.
  {
    const R = "C:/proj";
    const same = [
      ["node -e 'process.exit(0)'", 'node -e "process.exit(0)"'], ['node -e "process.exit(0)"', "node -e 'process.exit(0)'"],
      ["npm run build&&npm test", "npm run build && npm test"], ["npm run build  &&npm test", ["npm run build", "npm test"]],
      ["npm test||true", "npm test || true"], ["npm test|tee log", "npm test | tee log"], ["npm test ;", "npm test;"],
      ["node --test ./tests/x.test.js", "node --test tests/x.test.js"], ["./scripts/test.sh", "scripts/test.sh"], ["node --test 'tests/x y.test.js'", 'node --test "tests/x y.test.js"'],
      ["npm run test", "npm test"], ["npm run-script test -- -x", "npm test -- -x"], ["npm t", "npm tst"],
      ["chdir packages/web && npm test", "cd packages/web && npm test"], ["Set-Location -Path C:/proj/packages/web; npm test", "cd packages/web && npm test"],
      ["sl packages/web; npm test", "cd packages/web && npm test"], ["Push-Location packages/web; npm test", "cd packages/web && npm test"], ["pushd packages/web && npm test && popd", "cd packages/web && npm test"],
      ["pushd packages/web && npm test && popd && npm run lint", ["cd packages/web && npm test", "npm run lint"]], ["cd /d C:\\proj\\packages\\web && npm test", "cd packages/web && npm test"],
    ];
    const apart = [
      ["./gradlew test", "gradlew test"], ["go test ...", "go test ./..."], ["npm run test:unit", "npm test"], ["node -e 'console.log(\"$HOME\")'", "node -e \"console.log('$HOME')\""],
      ["pushd packages/web && npm test", "npm test"], ["pushd packages/web && popd && popd && npm test", "npm test"], ["npm test || true", "npm test"], ["npm test;echo ok", "npm test"], ["Push-Location packages/web; npm test; Pop-Location", "cd packages/web && npm test"],
      ["Set-Location ../other; npm test", "npm test"], ["npm test | tee log", "npm test"], ["pnpm run test", "npm test"],
    ];
    const wrong = same.filter(([r, v]) => !PV(r, v, R)).map(([r, v]) => "refused: " + r + " vs " + js(v))
      .concat(apart.filter(([r, v]) => PV(r, v, R)).map(([r, v]) => "accepted: " + r + " vs " + js(v)));
    ok(!wrong.length, "review 5 (L9): runProvesVerify reads single / double quotes, operator spacing, a leading ./ on a path, npm's aliases of npm test and cmd.exe / PowerShell folder moves (pushd / popd kept as a stack) as the same command — and keeps ./gradlew, ./..., a quote holding $, npm run test:unit and another folder apart (wrong: " + js(wrong) + ")");

    // linear on hostile input: 64 KB costs ~4× 16 KB (a quadratic reading ~16×) — measured as a ratio
    const hostile = (n) => ["&&".repeat(n / 2), "./".repeat(n / 2), ";".repeat(n), "'x' ".repeat(n / 4), "pushd a && ".repeat(n / 11) + "popd", "||".repeat(n / 2),
      "| ".repeat(n / 2), "Set-Location -Path ".repeat(n / 19), ". /".repeat(n / 3), "npm run test ".repeat(n / 13)];
    const timeAll = (n) => { const t = Date.now(); for (const h of hostile(n)) { PV(h, "npm test", R); PV("npm test", h, R); E.observedBodies(h); E.observedNorm(h); } return Date.now() - t; };
    timeAll(4096); // warm up
    // 1.26: both sizes measured once more on a timing-only miss (a load spike in one of them broke the ratio); quadratic misses both
    const { ms16, ms64 } = remeasure(() => ({ ms16: Math.max(timeAll(16 * 1024), 5), ms64: timeAll(64 * 1000) }), (x) => x.ms64 / x.ms16 < 12 && x.ms64 < 15000);
    ok(ms64 / ms16 < 12 && ms64 < 15000, "review 5 (L9): the new readings stay linear on hostile commands (operators, ./ runs, quotes, pushd chains) — 64 KB costs < 12× 16 KB (got " + ms16 + " → " + ms64 + " ms)");
  }

  // …and observed mode sees them: the observe hook's pre-filter (observedNorm / observedBodies — and its copy in hooks/observe-hook.js,
  // which mcp/tests/09-evidence.js holds equal) is still a superset of the matcher, and a run in those spellings is logged and found.
  {
    const pairs = [["npm run build&&npm test", "npm run build && npm test"], ["node --test ./tests/x.test.js", "node --test tests/x.test.js"], ["npm run test", "npm test"],
      ["Set-Location -Path packages/web; npm test", "cd packages/web && npm test"], ["pushd packages/web && npm test && popd", "cd packages/web && npm test"],
      ["node -e 'process.exit(0)'", 'node -e "process.exit(0)"'], ["npm test|tee log", "set -o pipefail; npm test | tee log"], ["npm test||true", "npm test || true"]];
    const notSuperset = pairs.filter(([run, v]) => !E.observedBodies(run).every((b) => E.observedNorm(v).includes(b)));
    const po = path.join(tmp, "proj-r5-observed");
    S.initProject(po, ["core"], "en");
    const fo = S.createFeature(po, "Seen", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fo.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] a\n  - _Verify: npm run build && npm test_\n- [ ] 2. [US1] b\n  - _Verify: node --test tests/x.test.js_\n");
    const logged = ["npm run build&&npm test", "node --test ./tests/x.test.js", "npm run lint"].map((command) => S.observeRun(po, { command, exitCode: 0 }).recorded.length);
    S.initProject(po, ["core"], "en", { evidence: "observed" });
    const c1 = S.completeTask(po, "seen", 1, { command: "npm run build && npm test", exitCode: 0 });
    const c2 = S.completeTask(po, "seen", 2, { command: "node --test ./tests/x.test.js", exitCode: 0 });
    const strip = [S.stripCdPrefix("Set-Location -Path " + po + "; npm test", [po], po), S.stripCdPrefix("cd /d " + po + " && npm test", [po], po)];
    ok(!notSuperset.length && js(logged) === "[1,1,0]" && c1.verified && c1.observed === true && c2.verified && c2.observed === true && js(strip) === js(["npm test", "npm test"]),
      "review 5 (L9): observed mode — the hook's pre-filter stays a superset of the matcher's new readings; `npm run build&&npm test` and `node --test ./tests/x.test.js` are logged and verify observed; Set-Location / cd /d into the project are stripped like cd (got " +
      js([notSuperset, logged, [c1.verified, c1.observed, c2.verified, c2.observed], strip]) + ")");
  }

  // Review 5 (L10) — cmd.exe's "The filename, directory name, or volume label syntax is incorrect" on a PT-PT, PT-BR and ES Windows
  // (also read through the OEM code page: an accent as U+FFFD) is cmd.exe's own failure — never a red run; a test's output is not.
  {
    const FFFD = String.fromCharCode(0xfffd);
    const shell = ["A sintaxe do nome de ficheiro, nome de diretório ou etiqueta de volume está incorreta.", "A sintaxe do nome de ficheiro, nome de directório ou etiqueta de volume está incorrecta.",
      "A sintaxe do nome do arquivo, do nome do diretório ou do rótulo do volume está incorreta.", "A sintaxe do nome do arquivo, do nome do diret" + FFFD + "rio ou do r" + FFFD + "tulo do volume est" + FFFD + " incorreta.",
      "La sintaxis del nombre de archivo, del nombre de directorio o de la etiqueta del volumen no es correcta.", "La sintaxis del nombre del archivo, del directorio o del volumen no es correcta.",
      // the other word order — Spanish Windows prints this one (seen verbatim in user reports) — and its PT twins, é / estão / são
      "El nombre de archivo, el nombre de directorio o la sintaxis de la etiqueta del volumen no son correctos.",
      "O nome de ficheiro, o nome de directório ou a sintaxe da etiqueta de volume estão incorrectos.", "A sintaxe do nome de ficheiro, nome de directório ou etiqueta de volume é incorrecta.",
      "O nome do arquivo, o nome do diretório ou a sintaxe do rótulo do volume está incorreta.", "O nome do arquivo, o nome do diret" + FFFD + "rio ou a sintaxe do r" + FFFD + "tulo do volume s" + FFFD + "o incorretos."];
    const notShell = ["not ok 1 - the volume label is incorrect", "A sintaxe do teste falhou: esperado 2, recebido 3", "1 failing"];
    const wrong = shell.filter((s) => !S.windowsShellFailure(s, 1)).map((s) => "missed: " + s).concat(notShell.filter((s) => S.windowsShellFailure(s, 1)).map((s) => "flagged: " + s));
    const ms = remeasure(() => {
      const t = Date.now();
      S.windowsShellFailure("A sintaxe do nome de ficheiro " + "x".repeat(199000), 1);
      S.windowsShellFailure(("la sintaxis del nombre de archivo " + " ".repeat(150)).repeat(1000), 1);
      return Date.now() - t;
    }, (x) => x < 500); // 1.26: measured once more on a miss
    ok(!wrong.length && ms < 500, "review 5 (L10): windowsShellFailure knows cmd.exe's invalid-name message in PT-PT (old and new spelling), PT-BR (U+FFFD accents too) and ES, never a test's output; linear on 200 KB (wrong: " + js(wrong) + ", " + ms + " ms)");
  }
};
