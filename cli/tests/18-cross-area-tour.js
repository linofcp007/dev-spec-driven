"use strict";
// Cross-area regressions on the CLI — /spec-tour as a prompt, classify = the engine, a missing [PRIVACY] section, pipes.

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, runIn, tmp, require, __dirname }) => {
  const Sc4 = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  // C4.1 — /spec-tour is served as a prompt like every command.
  const tourC4 = runIn(["prompts", "spec-tour", "--args", "a length check on the signup name"]);
  ok(tourC4.code === 0 && /as a \*\*guided tour\*\*/.test(tourC4.out) && /Change to take through the tour \(optional\): a length check on the signup name/.test(tourC4.out) &&
    /^ {2}spec-tour \[a small change you want to make \(optional\)\]$/m.test(runIn(["prompts"]).out),
    "prompts spec-tour: the guided tour (args in place), listed with its argument hint");

  // C4.2.1–3 — classify on the CLI = the engine.
  const gdC4 = runIn(["classify", "A GDPR-compliant signup form"]);
  const stC4 = runIn(["classify", "array stride and file permission bits"]);
  const esC4 = runIn(["classify", "Cifrado en tránsito para la API de pagos"]);
  const csC4 = runIn(["classify", "Google sign-in with an OAuth consent screen"]);
  ok(gdC4.code === 0 && /^Tracks: core \+privacy {3}/m.test(gdC4.out) && /^Tracks: core {3}/m.test(stC4.out) && !/\+sec: ON|Possible \+sec/.test(stC4.out) &&
    /^Tracks: core \+tdd \+sec {3}/m.test(esC4.out) && /señales encontradas: cifrado en tránsito/.test(esC4.out) &&
    /^Tracks: core \+tdd {3}/m.test(csC4.out) && /Possible \+privacy — weak signal 'consent'/.test(csC4.out),
    "classify: GDPR-compliant → +privacy; array stride + file permission bits → core with no +sec note; cifrado en tránsito → +sec (strong, ES); an OAuth consent screen → only a possible +privacy");

  // C4.2.5 + C4.2.6 on the CLI: doctor names the missing [PRIVACY] section and the pipe wrapped in bash -c; `done --run` hints a pipe
  // whose line merely mentions pipefail.
  const pc4 = path.join(tmp, "pc4-proj");
  Sc4.initProject(pc4, ["core"], "en");
  const fPv = Sc4.createFeature(pc4, "Accounts", ["privacy"], "", undefined, "en");
  const dPv = path.join(fPv.dir, "design.md");
  const filledPv = fs.readFileSync(dPv, "utf8").split(/\r?\n/).map((l) => (/^\s*>\s*\*\*TODO\*\*/.test(l) ? "Decided for this feature: the concrete answer written here." : l)).join("\n")
    .replace(/\[([^\]\n]*)\]/g, (m, x) => (/^(?:PRIVACY|SEC|SaaS|AI|x| )$/.test(x) ? m : "filled"));
  fs.writeFileSync(dPv, filledPv.replace(/## \[PRIVACY\] Processors & International Transfers\n/, "") + "\n## Processors and queues\nBullMQ workers.\n");
  const docPv = runIn(["doctor", fPv.slug, "--project", pc4]);
  const fPp = Sc4.createFeature(pc4, "Pipes", ["core"], "", undefined, "en");
  fs.writeFileSync(path.join(fPp.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Masked, mentions pipefail\n  - _Verify: node -e \"process.exit(0)\" | node -e \"process.exit(0)\" # pipefail later_\n" +
    "- [ ] 2. [US1] Wrapped\n  - _Verify: bash -c \"npm test | tee test.log\"_\n- [ ] 3. [US1] Real pipefail\n  - _Verify: set -o pipefail; npm test | tee test.log_\n");
  const docPp = runIn(["doctor", fPp.slug, "--project", pc4]);
  const donePp = run(["done", fPp.slug, "1", "--run", "--project", pc4]);
  const vpLine = (docPp.out.match(/.*verify-pipes.*/) || [""])[0];
  ok(docPv.code === 1 && /privacy-sections.*Processors & International Transfers:missing/.test(docPv.out) &&
    /#1 .*#2 `bash -c "npm test \| tee test\.log"`/.test(vpLine) && !/#3 /.test(vpLine) &&
    /pipes into another command: the shell reports only the LAST command's exit code/.test(donePp.out),
    "doctor: a deleted [PRIVACY] heading is missing even beside '## Processors and queues'; verify-pipes names the pipe that mentions pipefail and the one inside bash -c, not a real set -o pipefail; done --run hints it (got " +
    JSON.stringify([docPv.code, vpLine.slice(0, 200)]) + ")");
};
