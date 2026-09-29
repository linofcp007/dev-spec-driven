#!/usr/bin/env node
"use strict";

/**
 * The MCP server suite: spawns mcp/server.js, drives the MCP handshake over stdio and exercises every tool, prompt and
 * resource against throwaway temp projects. Run: `node mcp/test.js` — the LAST line is `N passed, M failed`, the exit code
 * 1 on any failure (scripts/test-docker.js runs it the same way in Linux containers).
 *
 *   node mcp/test.js                         every file, independent ones in parallel child processes
 *   node mcp/test.js --only gates,09         those files — by name (06-gates), area (gates) or number (09) — plus the
 *                                            files they need
 *   node mcp/test.js --list                  the files, their areas and what each needs
 *   node mcp/test.js --times                 … and every file's time at the end
 *
 * The assertions live in mcp/tests/NN-<area>[-<topic>].js, one file per area (NN is the area's number, shared with the
 * CLI suite's cli/tests/); mcp/tests/harness.js is the harness they share (the server under test, ok, rpc, payload, the
 * helpers); scripts/test-runner.js is the runner both suites share (--only, --list, the parallel chains, the total).
 * A new test goes into the file of its area — see docs/maintainers/testing.md.
 */

const path = require("path");

require("../scripts/test-runner.js").main({
  suite: "MCP server",
  key: "mcp", // the times file: <tmp>/dev-spec-test-times-mcp.json (the longest files start first)
  root: path.join(__dirname, ".."),
  dir: path.join(__dirname, "tests"),
  entry: __filename,
  tmpPrefix: "spec-test-",
  setup: (chain) => require("./tests/harness.js").setup(chain),
});
