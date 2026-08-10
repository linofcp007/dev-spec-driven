# Contributing to dev-spec-driven

Thanks for helping improve this plugin. A few hard constraints keep it lightweight and free to run —
please respect them in every change:

- **No GitHub Actions / no paid CI.** All automation is local (the bundled hooks + MCP server).
  Never add a `.github/workflows/` directory.
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
node mcp/test.js        # MCP server end-to-end (55 assertions)
node cli/test-cli.js    # universal CLI (34 assertions)
# or both:
npm test
```

Add an assertion whenever you add a tool or change behavior. Keep the tests dependency-free.
For +ai changes, `node mcp/evals/run-evals.js <feature> --dry-run` validates the eval path offline.

## Pull requests

- Keep `SKILL.md` the source of truth for the workflow; commands stay thin wrappers.
- Update `CHANGELOG.md` and bump the version in `package.json` **and** `.claude-plugin/plugin.json`
  together.
- Run `claude plugin validate .` and make sure `npm test` is green.
- No machine-specific absolute paths in committed files (use `${CLAUDE_PLUGIN_ROOT}`, `${workspaceFolder}`,
  or a relative path; for global tool configs ship a placeholder + point to `dev-spec mcp-config`).

By contributing you agree your contributions are licensed under the project's [MIT License](./LICENSE).
