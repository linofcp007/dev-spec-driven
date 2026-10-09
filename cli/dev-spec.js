#!/usr/bin/env node
"use strict";

/**
 * dev-spec — universal CLI over the spec-driven engine (zero-dependency).
 *
 * Makes the whole methodology usable from ANY tool or terminal — Claude Code, Cursor, Windsurf, Copilot, Gemini CLI, Codex CLI, plain
 * shell, CI-free — even where MCP isn't available. It is the same engine the MCP server exposes (mcp/lib/spec.js, the facade).
 *
 * Usage:
 *   node cli/dev-spec.js <command> [args]   (or `dev-spec <command>` if on PATH)
 *   node cli/dev-spec.js help               every command, its arguments and flags · help <command> / <command> --help: one
 *
 * This file is the entry point (package.json `bin`, every printed `node "<clone>/cli/dev-spec.js" …` line, git's merge driver, the
 * status line command): it starts one call and exits once its output has flushed. The rest:
 *   cli/commands.js    the commands — ONE table: each entry's options, arguments, help, completion and handler; the help, the
 *                      flag lists and the completion scripts' model are derived from it
 *   cli/main.js        main(argv, io): the command line, the checks every command shares, the dispatch — no process.exit, so the
 *                      CLI suite runs it in-process (cli/tests/harness.js runIn)
 *   cli/run.js         done --run / finish --run: the user's commands, their process tree, what a run proves
 *   cli/git.js         every git call (one environment)
 *   cli/completion.js  `completion <shell>`'s scripts and the hidden `__complete` (feature names on Tab, without the engine)
 */

const path = require("path");
// 1.25 — `dev-spec __complete features|archived [--project <dir>]`: the completion scripts' hidden call on Tab (feature names),
// answered BEFORE anything else loads — cli/completion.js reads .specs/ itself — since it runs on every Tab (≈ node's own startup).
if (process.argv[2] === "__complete") return require(path.join(__dirname, "completion.js")).complete(process.argv.slice(3));

const { main } = require(path.join(__dirname, "main.js"));

main(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
  get stdin() { return process.stdin; }, // created only when a command reads it
  env: process.env,
  cwd: process.cwd(),
  exit: (code) => process.exit(code), // a closed stdout (EPIPE), a signal during --run: at once
}).then((code) => {
  // Exit once stdout and stderr have flushed (on a pipe the writes may still be queued) — and even when something still holds the
  // event loop: the status line's caller may never close stdin.
  process.exitCode = code;
  process.stdout.write("", () => process.stderr.write("", () => process.exit(code)));
});
