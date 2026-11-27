"use strict";
// The legitimate shell commands the guards keep answering as they did — ONE copy, required by every file that drives them:
// 10-guards-shell-writes.js (LEGIT_REVIEW: the 1.25.1 r7 review's 33 commands and more ordinary work on and beside .specs/ — the
// approval guard allows them), 10-guards-hooks-cost.js (legitMonorepo(): the 19 monorepo / CI / PowerShell commands, with ed680c92's
// four approval decisions and the edit guard's targets) and 10-guards-hooks.js (1.42 perf-1: the edit guard's per-project fold over
// all of them, beside the controller's own writes — controllerWrites()). Data only: no assertion lives here.

const BS = String.fromCharCode(92);

const LEGIT_REVIEW = [["Bash", "cat .specs/roadmap.json"], ["Bash", "grep -rn approve .specs/"], ["Bash", "git add .specs && git commit -m \"approve tasks of login-flow\""],
  ["Bash", "git diff .specs/roadmap.json"], ["Bash", "git log -p .specs/roadmap.json"], ["Bash", "node cli/dev-spec.js status login-flow"], ["Bash", "node cli/dev-spec.js done login-flow 3 --run"],
  ["Bash", "node cli/dev-spec.js approve --help"], ["Bash", "node cli/dev-spec.js init --approval-guard deny"], ["Bash", "node cli/dev-spec.js init --guard scope"],
  ["Bash", "node cli/dev-spec.js init --check test=\"npm test\""], ["Bash", "node cli/dev-spec.js init --evidence observed"], ["Bash", "node cli/dev-spec.js feature archive login-flow"],
  ["Bash", "node cli/dev-spec.js merge-state --check"], ["Bash", "cp .specs/roadmap.json /tmp/backup.json"], ["Bash", "rm -rf .specs/login-flow/.execution"],
  ["Bash", "npm test 2>&1 | tee .specs/login-flow/.execution/task-3-report.md"], ["Bash", "echo \"remove the old approve button\" > notes.txt"], ["Bash", "ls .specs/*/tasks.md"],
  ["Bash", "sed -n 1,40p .specs/login-flow/tasks.md"], ["Bash", "sed -i 's/- " + BS + "[ " + BS + "] 3/- [x] 3/' .specs/login-flow/tasks.md"], ["Bash", "jq . .specs/roadmap.json"],
  ["Bash", "node -e \"console.log(require('./.specs/roadmap.json').meta)\""], ["Bash", "python -m json.tool .specs/roadmap.json"],
  ["PowerShell", "Get-Content .specs" + BS + "roadmap.json | ConvertFrom-Json"], ["PowerShell", "Select-String -Path .specs" + BS + "*" + BS + "tasks.md -Pattern approve"],
  ["PowerShell", "Copy-Item .specs" + BS + "roadmap.json $env:TEMP" + BS + "r.json"], ["Bash", "git checkout main"], ["Bash", "git stash"], ["Bash", "npm run lint -- --fix src/"],
  ["Bash", "rg -n \"dev-spec approve\" docs/"], ["Bash", "find .specs -name '*.md' -newer .specs/roadmap.json"], ["Bash", "wc -l .specs/*/tasks.md && echo approve"],
  // and more ordinary work on and beside .specs/
  ["Bash", "jq . < .specs/roadmap.json"], ["Bash", "cp notes.md .specs/alpha/"], ["Bash", "rm -f *.log && node cli/dev-spec.js status"], ["Bash", "cp -r .specs /tmp/specs-backup"],
  ["Bash", "tar -czf /tmp/specs.tgz .specs"], ["Bash", "zip -r /tmp/specs.zip .specs"], ["Bash", "rm .specs/.roadmap.lock"], ["Bash", "rm .specs/alpha/notes.md"],
  ["Bash", "find .specs -name '*.md' | xargs grep -l approve"], ["Bash", "for f in .specs/*/tasks.md; do wc -l $f; done"], ["Bash", "[[ -f .specs/roadmap.json ]] && echo yes"],
  ["PowerShell", "[IO.File]::ReadAllText('.specs/roadmap.json')"], ["PowerShell", "Get-ChildItem .specs | Format-Table"], ["Bash", "git stash push -m wip -- src/"]];

// [tool, command, the four decisions (deny / ask × win32 / POSIX), targets, their sha1] — ed680c92's answers
function legitMonorepo() {
  const pkg = (i, w = 2) => "pkg-" + String(i).padStart(w, "0");
  const times = (n, f, sep) => Array.from({ length: n }, (_, i) => f(i)).join(sep);
  const CI = ["set -euo pipefail", "export NODE_ENV=production CI=true FORCE_COLOR=0", "export ARTIFACTS=\"$PWD/artifacts\"", "mkdir -p \"$ARTIFACTS\" dist logs",
    "npm ci --no-audit --prefer-offline > logs/install.log 2>&1",
    times(40, (i) => "( cd packages/" + pkg(i) + " && npm run lint > ../../logs/lint-" + pkg(i) + ".log && npm test -- --ci --reporters=default > ../../logs/test-" + pkg(i) + ".log )", "\n"),
    times(40, (i) => "cp -r packages/" + pkg(i) + "/dist \"$ARTIFACTS/" + pkg(i) + "\"", "\n"), "tar -czf dist/artifacts.tgz -C \"$ARTIFACTS\" .",
    "find logs -name '*.log' -size +1M -exec gzip {} \\;", "node cli/dev-spec.js doctor --json > logs/doctor.json"].join("\n");
  const ALLOW = ["allow|", "allow|", "allow|", "allow|"];
  const LEGIT = {
    "append FLAGS ×300 then tsc": ["Bash", "FLAGS=\"\"; " + times(300, (i) => "FLAGS=\"$FLAGS --include=src/module" + i + "\"", "; ") + "; tsc $FLAGS > build.log; node cli/dev-spec.js status", ALLOW, 1, "6bed715518e0"],
    "append FLAGS ×500 then tsc": ["Bash", "FLAGS=\"\"; " + times(500, (i) => "FLAGS=\"$FLAGS --include=src/m" + i + "\"", "; ") + "; tsc $FLAGS > build.log; node cli/dev-spec.js status", ALLOW, 1, "6bed715518e0"],
    "cd ../next && build ×150": ["Bash", "cd packages/" + pkg(0) + " && " + times(150, (i) => "npm run build > build.log && cd ../" + pkg(i + 1), " && ") + " && node ../../cli/dev-spec.js status", ALLOW, 33, "40eb0179c0cf"],
    "cd pkg && rm -rf dist && cd .. ×300": ["Bash", "cd packages && " + times(300, (i) => "cd " + pkg(i, 3) + " && rm -rf dist && cd ..", " && ") + " && node ../cli/dev-spec.js status", ALLOW, 33, "e548c8ac3f16"],
    "a 70-character cd, then rm -f of 1,000 files": ["Bash", "cd services/billing-api-gateway/internal/handlers/v2/generated/protobuf && rm -f " + times(1000, (i) => "f" + String(i).padStart(4, "0") + ".pb.go", " ") +
      " && node ../../../../../../../cli/dev-spec.js status", ALLOW, 64, "9dbec889f913"],
    "ROOT=<60>; cp $ROOT/src/fN $ROOT/out/fN ×700": ["Bash", "ROOT=/home/ci/workspace/monorepo/packages/frontend-dashboard; " + times(700, (i) => "cp $ROOT/src/f" + i + ".ts $ROOT/out/f" + i + ".ts", "; ") + "; node cli/dev-spec.js status", ALLOW, 64, "cf6057296854"],
    "export PATH=\"$PATH:…\" ×200": ["Bash", times(200, (i) => "export PATH=\"$PATH:/opt/tools/bin" + i + "\"", "; ") + "; node cli/dev-spec.js doctor", ALLOW, 0, "da39a3ee5e6b"],
    "CFLAGS=\"$CFLAGS -I$INC/pkgN\" ×150 then make": ["Bash", "INC=/usr/local/include; CFLAGS=\"\"; " + times(150, (i) => "CFLAGS=\"$CFLAGS -I$INC/" + pkg(i) + "\"", "; ") + "; make CFLAGS=\"$CFLAGS\" > make.log; node cli/dev-spec.js status", ALLOW, 1, "006d8d8d5e2c"],
    "pushd pkg && build && popd ×200": ["Bash", times(200, (i) => "pushd packages/" + pkg(i, 3) + " && npm run build && popd", " && ") + " && node cli/dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
    "cd /repo && git status && cd sub && … && cd .. ×150": ["Bash", times(150, (i) => "cd /repo && git status && cd sub-" + i + " && git status && cd ..", " && ") + " && node cli/dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
    "a CI script of ~8 K": ["Bash", CI, ALLOW, 64, "7da8baf62a26"],
    "a PowerShell build script": ["PowerShell", "$root = 'C:" + BS + "repo'; Set-Location $root; $out = ''; " + times(200, (i) => "$out = \"$out;$root" + BS + "packages" + BS + pkg(i, 3) + BS + "dist\"", "; ") + "; " +
      times(50, (i) => "Set-Location \"$root" + BS + "packages" + BS + pkg(i, 3) + "\"; npm run build; Set-Location $root", "; ") + "; node cli" + BS + "dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
    "sh -c 'cd \"$1\" && npm test' _ pkg ×50": ["Bash", times(50, (i) => "sh -c 'cd \"$1\" && npm test' _ packages/" + pkg(i), " && ") + " && node cli/dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
    "cd pkg && … && cd .. ×200, then an approve": ["Bash", "cd packages && " + times(200, (i) => "cd " + pkg(i, 3) + " && rm -rf dist && cd ..", " && ") + " && node ../cli/dev-spec.js approve feat requirements",
      ["deny|approve:requirements", "deny|approve:requirements", "ask|approve:requirements", "ask|approve:requirements"], 33, "e548c8ac3f16"],
    "F=\"$F -Iinclude/pkg\" ×100, then a test write": ["Bash", "F=x; " + times(100, (i) => "F=\"$F -Iinclude/" + pkg(i, 3) + "\"", "; ") + "; D=tests; echo hi > $D/protected.test.js; node cli/dev-spec.js status", ALLOW, 1, "590079460ad3"],
    "git commit with a 3 K heredoc message": ["Bash", "git add -A && git commit -m \"$(cat <<'EOF'\nfeat: the monorepo build\n\n" + times(60, (i) => "- " + pkg(i) + ": the build script, the lint config and the test runner moved to the shared preset", "\n") +
      "\nEOF\n)\" && node cli/dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
    "cp dist files ×400": ["Bash", times(400, (i) => "cp packages/" + pkg(i, 3) + "/dist/index.js dist/" + pkg(i, 3) + ".js", " && ") + " && node cli/dev-spec.js status", ALLOW, 64, "43c976b4ac72"],
    "cd ../../ chains (two up, one down) ×100": ["Bash", "cd apps/web/src && " + times(100, (i) => "cd ../../" + pkg(i) + "/src && npm run build", " && ") + " && node ../../../cli/dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
    "a cd into .specs/ and out, reading": ["Bash", "cd .specs && cat roadmap.json && cd .. && " + times(100, (i) => "cat packages/" + pkg(i) + "/package.json", " && ") + " && node cli/dev-spec.js status", ALLOW, 0, "da39a3ee5e6b"],
  };
  return LEGIT;
}

// (1.42 [INT-3]) The controller's own writes during subagent-driven execution, into .specs/<feature>/.execution/ — the review package
// (references/subagent-execution.md §4: three git commands into task-N-review.diff) and the duplicate detector's result before the
// task review (S4: `dupes <feature> --json` into task-N-dupes.json), as a POSIX and a Windows clone path print the runnable CLI line,
// in Bash and in PowerShell. The edit guard allows them at every level.
function controllerWrites(feature, n) {
  const ex = ".specs/" + feature + "/.execution/task-" + n;
  const exPs = ".specs" + BS + feature + BS + ".execution" + BS + "task-" + n;
  const cli = ["/home/dev/.claude/plugins/cache/dev-spec-driven-marketplace/dev-spec-driven/1.42.0/cli/dev-spec.js",
    "C:/Users/dev/.claude/plugins/cache/dev-spec-driven-marketplace/dev-spec-driven/1.42.0/cli/dev-spec.js"];
  return [
    ["Bash", "git log --oneline 3f2a9c1..HEAD  >  " + ex + "-review.diff"],
    ["Bash", "git diff --stat   3f2a9c1..HEAD  >> " + ex + "-review.diff"],
    ["Bash", "git diff -U10     3f2a9c1..HEAD  >> " + ex + "-review.diff"],
    ["PowerShell", "git diff -U10 3f2a9c1..HEAD >> " + exPs + "-review.diff"],
    ["Bash", "node \"" + cli[0] + "\" dupes " + feature + " --json > " + ex + "-dupes.json"],
    ["Bash", "node \"" + cli[1] + "\" dupes " + feature + " --json > " + ex + "-dupes.json"],
    ["PowerShell", "node \"" + cli[1] + "\" dupes " + feature + " --json > " + exPs + "-dupes.json"],
  ];
}

module.exports = { LEGIT_REVIEW, legitMonorepo, controllerWrites };
