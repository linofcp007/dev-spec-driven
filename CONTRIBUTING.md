# Contributing to dev-spec-driven

Thanks for helping improve this plugin. A few hard constraints keep it lightweight and free to run —
please respect them in every change:

- **No GitHub Actions / no paid CI / no pull requests.** All automation is local (the bundled hooks +
  MCP server) and changes are merged locally. Never add a `.github/workflows/` directory.
- **Zero runtime dependencies.** The MCP server, CLI and all scripts use only Node core (`fs`, `path`,
  `readline`, `child_process`, built-in `fetch`). No `npm install`. Keep it that way.
- **Specs always live in `.specs/`.**

## Architecture in one line

`mcp/lib/spec.js` is the single engine. It's exposed three ways — the **MCP server** (`mcp/server.js`),
the universal **`dev-spec` CLI** (`cli/dev-spec.js`), and the Claude Code **skill + commands + hooks**.
When you add an operation, add it to `spec.js` first, then wire it into all three and add a test.

Full maintainer notes (conventions, gotchas, the track model, multilingual rules) are in
**[CLAUDE.md](./CLAUDE.md)** — read it before changing the engine.

## Developing

```bash
node mcp/test.js        # MCP server end-to-end (must end `0 failed`)
node cli/test-cli.js    # universal CLI (must end `0 failed`)
claude plugin eval . --ablation none --trust-plugin --no-publish --max-cost-usd 5   # optional: plugin behaviour evals (costs tokens; see evals/README.md)
# or both:
npm test
```

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
  - `claude plugin validate .claude-plugin/plugin.json` — the plugin (manifest + its components);
  - `claude plugin validate .` — the marketplace (`.claude-plugin/marketplace.json`). Run on the repo
    root, `validate` only checks the marketplace file when one is present, not the plugin itself.
- No machine-specific absolute paths in committed files (use `${CLAUDE_PLUGIN_ROOT}`, `${workspaceFolder}`,
  or a relative path; for global tool configs ship a placeholder + point to `dev-spec mcp-config`).

By contributing you agree your contributions are licensed under the project's [MIT License](./LICENSE).
