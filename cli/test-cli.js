#!/usr/bin/env node
"use strict";

/**
 * The universal CLI suite: exercises cli/dev-spec.js's subcommands against throwaway temp projects and asserts on their
 * output and exit codes. Run: `node cli/test-cli.js` — the LAST line is `N passed, M failed`, the exit code 1 on any
 * failure (scripts/test-docker.js runs it the same way in Linux containers).
 *
 *   node cli/test-cli.js                       every file, in parallel child processes
 *   node cli/test-cli.js --only gates,09       those files — by name (06-gates-approve), area (gates) or number (09)
 *   node cli/test-cli.js --list                the files and their areas
 *   node cli/test-cli.js --times               … and every file's time at the end
 *
 * The assertions live in cli/tests/NN-<area>-<topic>.js — NN is the area's number, shared with the MCP suite's
 * mcp/tests/; cli/tests/harness.js is the harness they share (ok, run, tmp); scripts/test-runner.js is the runner both
 * suites share. A new test goes into the file of its area — see docs/maintainers/testing.md.
 */

const path = require("path");

require("../scripts/test-runner.js").main({
  suite: "CLI",
  key: "cli", // the times file: <tmp>/dev-spec-test-times-cli.json (the longest files start first)
  root: path.join(__dirname, ".."),
  dir: path.join(__dirname, "tests"),
  entry: __filename,
  tmpPrefix: "cli-test-",
  setup: () => require("./tests/harness.js").setup(),
});
