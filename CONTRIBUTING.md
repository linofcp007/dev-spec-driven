# Contributing to dev-spec-driven

Thanks for helping improve this plugin. A few hard constraints keep it lightweight and free to run —
please respect them in every change:

- **No GitHub Actions / no paid CI / no pull requests.** All automation is local (the bundled hooks +
  MCP server) and changes are merged locally. Never add a `.github/workflows/` directory.
- **Zero runtime dependencies.** The MCP server, CLI and all scripts use only Node core (`fs`, `path`, `os`,
  `readline`, `child_process`, `crypto`, built-in `fetch`). No `npm install`. Keep it that way.
- **Specs always live in `.specs/`.**

## Architecture in one line

`mcp/lib/spec.js` is the single engine's facade — the logic lives in `mcp/lib/engine/`, one module per concern. It's
exposed three ways — the **MCP server** (`mcp/server.js`: tools, plus prompts and resources from
`mcp/lib/prompts-resources.js`), the universal **`dev-spec` CLI** (`cli/dev-spec.js`), and the Claude Code **skill +
commands + hooks**. When you add an operation, add it to the engine module of its concern and to the facade's object in
`spec.js` first, then wire it into all three and add a test. A new command in `commands/` is automatically an MCP prompt too.

Full maintainer notes (conventions, gotchas, the track model, multilingual rules) are in
**[CLAUDE.md](./CLAUDE.md)** — read it before changing the engine.

## Developing

```bash
node mcp/test.js        # MCP server end-to-end (must end `0 failed`)
node cli/test-cli.js    # universal CLI (must end `0 failed`)
# or both:
npm test
npm run test:docker     # optional: both suites in Linux containers (Node 18 / 22 / 24) on your own Docker
```

`npm run test:docker` (`scripts/test-docker.js`) mounts the clone read-only, runs without network (only the first run
pulls the images and builds a small cached image with git) and as an unprivileged user; `--image <name>`, `--suite
mcp|cli`, `--no-git`, `--rebuild` and `--root` adjust it. It exits 0 when every suite passed on every image, 1 on a
failure and 2 when Docker isn't available. Run it before a release — the plugin is developed on Windows, and Linux has
caught real bugs (pipe flushing, `/bin/sh` quoting, case-sensitive paths).

Plugin evals (`claude plugin eval`, optional, cost tokens, local only) come in two suites, selected by tag:

```bash
claude plugin eval . --ablation none --tag triggering negative --trust-plugin --no-publish --max-cost-usd 5   # does the skill fire (and stay silent)?
claude plugin eval . --ablation none --tag behavior --scaffold --allow-real-servers --trust-plugin --no-publish \
  --allow-tools Write Edit "mcp__plugin_dev-spec-driven_spec-driven__*" --max-cost-usd 8 -j 3                 # does the agent respect the workflow?
```

See [evals/README.md](./evals/README.md) for the cases, the fixtures and why each flag is needed.

Add an assertion whenever you add a tool or change behavior. Keep the tests dependency-free.
The exact assertion counts live in two places only — the release's `### Tests` entry in CHANGELOG.md and the
Tests section of CLAUDE.md — so update both when the totals change (`mcp/test.js` checks that they agree and
that README / INSTALL / llms-install / this file state no count that could go stale).
For +ai changes, `node mcp/evals/run-evals.js <feature> --dry-run` validates the eval path offline.

## Before merging

- Keep `SKILL.md` the source of truth for the workflow; commands stay thin wrappers.
- Update `CHANGELOG.md` and bump the version in `package.json`, `.claude-plugin/plugin.json` **and**
  `.claude-plugin/marketplace.json` together (`mcp/test.js` fails if they disagree).
- Validate both manifests and make sure `npm test` is green:
  - `claude plugin validate .claude-plugin/plugin.json` — the plugin (manifest + its components); it passes with
    one expected warning, `CLAUDE.md at the plugin root is not loaded as project context` (CLAUDE.md is these
    maintainer notes, not context meant for users' projects);
  - `claude plugin validate .` — the marketplace (`.claude-plugin/marketplace.json`). Run on the repo
    root, `validate` only checks the marketplace file when one is present, not the plugin itself.
- No machine-specific absolute paths in committed files (use `${CLAUDE_PLUGIN_ROOT}`, `${workspaceFolder}`,
  or a relative path; for global tool configs ship a placeholder + point to `dev-spec mcp-config`).

By contributing you agree your contributions are licensed under the project's [MIT License](./LICENSE).
