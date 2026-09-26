#!/usr/bin/env node
"use strict";

/**
 * Runs BOTH test suites (mcp/test.js and cli/test-cli.js) inside Linux containers — locally, with your own Docker.
 * The plugin is developed on Windows; this is how a Linux / case-sensitive file system / POSIX-shell / Node-18 run
 * happens before a release, with no hosted CI (the owner's cost rule).
 *
 *   npm run test:docker
 *   node scripts/test-docker.js [--image <name>]... [--suite mcp|cli] [--no-git] [--rebuild] [--root] [--help]
 *
 * Default images: node:18-alpine (the engines floor, musl), node:22-bookworm-slim (glibc/Debian), node:24-alpine
 * (the current LTS). `--image` (repeatable) replaces the list.
 *
 * How each suite runs: `docker run --rm --network none --user 1000:1000 -v <repo>:/repo:ro -w /repo <image> node <suite>`.
 * The repo is mounted READ-ONLY (a test can't write into it — the suites work under os.tmpdir()), the container has
 * NO network (the engine never needs one) and runs as an unprivileged user (root ignores file permissions; --root
 * runs as root instead). Nothing is installed on this machine and nothing is written into the repo.
 *
 * Network: only the FIRST run needs it — to pull an image that isn't local yet and (unless --no-git) to build a
 * small derived image `dev-spec-test:<image>` that adds git, so the git-dependent tests (the pre-commit hook on
 * accented/space paths, the lock files' .gitignore) run instead of skipping. Both are cached by Docker; later runs are
 * fully offline. When that build can't run (offline), the bare image is used and those tests report "skip".
 * --rebuild rebuilds the derived images (e.g. after pulling a newer base).
 *
 * Exit code: 0 every suite passed on every image · 1 a suite failed (or an image could not be prepared) ·
 * 2 Docker is not available (not installed, daemon not running, or in Windows-containers mode) — or a usage error.
 * Full logs: <os.tmpdir()>/dev-spec-docker/<image>-<suite>.log (the path is printed for a failing suite).
 * Zero dependencies — Node core only, like the rest of the plugin.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_IMAGES = ["node:18-alpine", "node:22-bookworm-slim", "node:24-alpine"];
const SUITES = { mcp: "mcp/test.js", cli: "cli/test-cli.js" };
const SUITE_TIMEOUT_MS = 20 * 60 * 1000;
const LOG_DIR = path.join(os.tmpdir(), "dev-spec-docker");

const USAGE = `usage: node scripts/test-docker.js [--image <name>]... [--suite mcp|cli] [--no-git] [--rebuild] [--root]

Runs mcp/test.js and cli/test-cli.js inside Linux containers (repo mounted read-only, --network none).
  --image <name>  a Docker image with Node >= 18 (repeatable; replaces the defaults: ${DEFAULT_IMAGES.join(", ")})
  --suite <name>  only one suite: mcp | cli (default: both)
  --no-git        use the images as they are (no derived image with git; the git-dependent tests skip)
  --rebuild       rebuild the cached derived images (dev-spec-test:<image>)
  --root          run the suites as root (default: an unprivileged user, uid 1000)
The first run needs network to pull the images (and apk/apt to add git); later runs are offline.
Exit: 0 all passed · 1 a suite failed · 2 Docker is not available (or a usage error).`;

function parseArgs(argv) {
  const o = { images: [], suites: Object.keys(SUITES), git: true, rebuild: false, root: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[++i];
      if (v == null || v === "" || v.startsWith("--")) usageError(`${a.split("=")[0]} needs a value`);
      return v;
    };
    if (a === "--help" || a === "-h") { console.log(USAGE); process.exit(0); }
    else if (a === "--image" || a.startsWith("--image=")) o.images.push(val());
    else if (a === "--suite" || a.startsWith("--suite=")) {
      const s = val().toLowerCase();
      if (!SUITES[s]) usageError(`unknown suite '${s}' (mcp | cli)`);
      o.suites = [s];
    } else if (a === "--no-git") o.git = false;
    else if (a === "--rebuild") o.rebuild = true;
    else if (a === "--root") o.root = true;
    else usageError(`unknown argument '${a}'`);
  }
  if (!o.images.length) o.images = DEFAULT_IMAGES.slice();
  return o;
}
function usageError(msg) {
  console.error(`test-docker: ${msg}\n\n${USAGE}`);
  process.exit(2);
}

function docker(args, opts = {}) {
  return spawnSync("docker", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, windowsHide: true, ...opts });
}
const firstLine = (s) => String(s || "").trim().split(/\r?\n/)[0] || "";
const secs = (ms) => (ms / 1000).toFixed(1) + "s";

// Docker must answer, and run LINUX containers (Docker Desktop can be switched to Windows containers).
function checkDocker() {
  const v = docker(["version", "--format", "{{.Server.Version}}|{{.Server.Os}}|{{.Server.Arch}}"]);
  if (v.error) {
    return { ok: false, why: v.error.code === "ENOENT" ? "the docker command was not found (install Docker, or put it on PATH)" : v.error.message };
  }
  if (v.status !== 0) return { ok: false, why: `the Docker daemon did not answer (is Docker running?) — ${firstLine(v.stderr) || "docker version exited " + v.status}` };
  const [version, osType, arch] = String(v.stdout).trim().split("|");
  if (osType !== "linux") return { ok: false, why: `Docker runs ${osType || "unknown"} containers — switch it to Linux containers` };
  return { ok: true, version, arch };
}

const hasImage = (ref) => docker(["image", "inspect", "--format", "{{.Id}}", ref]).status === 0;

// The derived image adds git on top of the base (alpine: apk, debian: apt) — built once, cached by Docker.
function derivedTag(image) {
  const t = image.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[.-]+/, "").slice(0, 120);
  return "dev-spec-test:" + (t || "image");
}
function buildDerived(image, tag) {
  const dockerfile = [
    `FROM ${image}`,
    "RUN command -v git >/dev/null 2>&1 || (command -v apk >/dev/null 2>&1 && apk add --no-cache git) || " +
      "(command -v apt-get >/dev/null 2>&1 && apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*)",
    `LABEL dev-spec-test.base="${image.replace(/"/g, "")}"`,
    "",
  ].join("\n");
  // No build context (the Dockerfile comes on stdin): nothing from the repo is sent to the daemon. Quiet — the build log
  // is shown only when it fails.
  const b = docker(["build", "-q", "-t", tag, "-"], { input: dockerfile });
  if (b.status !== 0) String((b.stderr || "") + (b.stdout || "")).trim().split(/\r?\n/).slice(-6).forEach((l) => console.log("    " + l));
  return b.status === 0;
}

// Pull (first run only) + the derived image. → { ref, note } or { error }.
function prepare(image, o) {
  if (!hasImage(image)) {
    console.log(`  pulling ${image} (first run only — needs network)…`);
    if (docker(["pull", image], { stdio: ["ignore", "inherit", "inherit"] }).status !== 0) return { error: `could not pull ${image} (offline, or no such image?)` };
  }
  if (!o.git) return { ref: image, note: "as is (--no-git)" };
  const tag = derivedTag(image);
  if (o.rebuild || !hasImage(tag)) {
    console.log(`  building ${tag} = ${image} + git (once, cached — apk/apt need network)…`);
    if (!buildDerived(image, tag)) return { ref: image, note: "the git layer could not be built (offline?) — the bare image is used; git-dependent tests will skip" };
  }
  return { ref: tag, note: "" };
}

let runs = 0;
function runInImage(ref, args, o) {
  const user = o.root ? [] : ["--user", "1000:1000", "-e", "HOME=/tmp"];
  // --init: a real PID 1 forwards Ctrl-C (node as PID 1 ignores SIGINT). Named, so a timed-out run can be removed —
  // killing the docker client alone leaves the container running.
  const name = `dev-spec-test-${process.pid}-${++runs}`;
  // -v "<abs path>:/repo:ro": the Windows form (C:\…) is accepted by Docker Desktop; spawnSync passes it untouched.
  const r = docker(["run", "--rm", "--init", "--name", name, "--network", "none", ...user, "-v", `${ROOT}:/repo:ro`, "-w", "/repo", ref, ...args], { timeout: SUITE_TIMEOUT_MS });
  if (r.error) docker(["rm", "-f", name]);
  return r;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  const d = checkDocker();
  if (!d.ok) {
    console.error(`test-docker: Docker is not available: ${d.why.replace(/[.\s]+$/, "")}.\nThe suites still run natively: npm test`);
    process.exit(2);
  }
  fs.mkdirSync(LOG_DIR, { recursive: true });
  console.log(`dev-spec-driven — test suites in Linux containers (Docker ${d.version}, linux/${d.arch})`);
  console.log(`repo ${ROOT} → /repo (read-only) · --network none · ${o.root ? "as root" : "as uid 1000"} · suites: ${o.suites.join(", ")}\n`);

  const rows = [];
  for (const image of o.images) {
    console.log(`▸ ${image}`);
    const p = prepare(image, o);
    if (p.error) {
      console.log(`  ✗ ${p.error}\n`);
      rows.push({ image, error: p.error });
      continue;
    }
    const probe = runInImage(p.ref, ["sh", "-c", "node --version; git --version 2>/dev/null || echo 'no git'"], o);
    const [nodeV, gitV] = String(probe.stdout || "").trim().split(/\r?\n/);
    console.log(`  ${p.ref} · node ${nodeV || "?"} · ${gitV || "?"}${p.note ? " · " + p.note : ""}`);
    const row = { image, ref: p.ref, node: nodeV || "?", results: [] };
    for (const suite of o.suites) {
      const t0 = Date.now();
      const r = runInImage(p.ref, ["node", SUITES[suite]], o);
      const ms = Date.now() - t0;
      const out = (r.stdout || "") + (r.stderr || "");
      const log = path.join(LOG_DIR, `${derivedTag(image).split(":")[1]}-${suite}.log`);
      fs.writeFileSync(log, out);
      // The suite's own total is its LAST line — missing means it died, timed out or its output was cut short.
      const m = out.match(/\n(\d+) passed, (\d+) failed\s*$/);
      const skipped = (out.match(/^ {2}skip - /gm) || []).length;
      const res = { suite, ms, log, code: r.status, passed: m ? +m[1] : null, failed: m ? +m[2] : null, skipped };
      res.ok = !!m && res.failed === 0 && r.status === 0;
      row.results.push(res);
      const why = r.error ? ` (${r.error.code === "ETIMEDOUT" ? "timed out" : r.error.message})` : "";
      console.log(`  ${res.ok ? "✓" : "✗"} ${suite.padEnd(3)}  ${m ? `${m[1]} passed, ${m[2]} failed` : `no total line — exit ${r.status}${why}`}` +
        `${skipped ? `, ${skipped} skipped` : ""}  (${secs(ms)})`);
      if (!res.ok) {
        const fails = out.split(/\r?\n/).filter((l) => /^ {2}FAIL - /.test(l));
        (fails.length ? fails : out.trim().split(/\r?\n/).slice(-8)).slice(0, 40).forEach((l) => console.log("      " + l.slice(0, 400)));
        console.log(`      full log: ${log}`);
      }
    }
    rows.push(row);
    console.log("");
  }

  console.log("Summary");
  let bad = 0;
  for (const row of rows) {
    if (row.error) { bad++; console.log(`  ✗ ${row.image.padEnd(24)} ${row.error}`); continue; }
    const cells = row.results.map((r) => `${r.suite} ${r.ok ? "✓" : "✗"} ${r.passed == null ? "?" : r.passed}/${r.passed == null ? "?" : r.passed + r.failed}`);
    if (row.results.some((r) => !r.ok)) bad++;
    console.log(`  ${row.results.every((r) => r.ok) ? "✓" : "✗"} ${row.image.padEnd(24)} node ${row.node.padEnd(9)} ${cells.join("   ")}`);
  }
  console.log(bad ? `\n${bad} of ${rows.length} image(s) failed.` : `\nAll suites passed on ${rows.length} image(s).`);
  process.exitCode = bad ? 1 : 0;
}

main();
