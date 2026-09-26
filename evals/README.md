# Plugin evals (maintainers)

Behaviour tests for the plugin itself, run with Claude Code's `claude plugin eval` — the "test the
skill under pressure" idea from obra/superpowers' *writing-skills*. They check that the workflow
**triggers** on planning and bug-fix requests in English, Portuguese and Spanish, and **stays silent** on
an unrelated question and on near-misses that only share a keyword (`requirements.txt`, `eval()`, one LLM
call). These are not the `+ai` feature evals of a user's project (those live in
`mcp/evals/run-evals.js`).

| Case | Expects |
|---|---|
| `trigger-spec-en` / `-pt` / `-es` | a `dev-spec-driven:*` skill or command fires on "spec this before coding" |
| `trigger-bugfix-en` | it fires on a defect report asking for a proper fix |
| `trigger-upgrade-pt` | it fires on "I updated the plugin — update this project's specs and review what isn't implemented" (PT) |
| `no-trigger-unrelated` | nothing from the plugin fires on a general-knowledge question |
| `no-trigger-requirements-txt` / `-eval-call` / `-llm-call` | near-misses (tag `near-miss`): pinning a package in `requirements.txt`, replacing an `eval()` call, adding one LLM API call — trivial edits the description excludes |

## Run (local only — no CI, by design)

```bash
claude plugin eval . --ablation none --trust-plugin --no-publish --max-cost-usd 5
claude plugin eval . --ablation none --tag pt --trust-plugin --no-publish        # one language
claude plugin eval . --ablation none --json results.json --trust-plugin --no-publish
```

The notice *"`plugin:dev-spec-driven:spec-driven` has no mock and is NOT started"* is expected: these
cases only check that the workflow fires (the `Skill` tool), not the MCP tools, so no mock and no
`--allow-real-servers` are needed.

**`--ablation none` matters here.** By default the harness adds a no-plugin baseline arm, and under it
`tool_used: Skill` graders become a "plugin fired" *indicator* instead of part of the score. Every case in
this suite is a triggering check, so without the flag nothing would be scored.

Each case runs 3 times in a throwaway sandbox with only the plugin under test (the target path) loaded;
it uses your own Claude credentials and costs tokens (`--max-cost-usd` caps it). Reference run
(2026-09-24, CLI 2.1.282, default model, `-j 3`, before the near-miss cases were added): **5/5 cases at
1.0 (15 runs), $1.71**. Exit code 0 = every case
at the threshold (default: all runs pass). Results land in `evals/results/` (git-ignored).

Case layout — `<case>/prompt.md` (YAML frontmatter + the prompt) and `<case>/graders/*.md` — matches what
`claude plugin eval init --bare <name>` generates (CLI 2.1.282). No `plugins:` field: the plugin comes from
the target (`.`), so a separately installed copy is never mixed in.

**`claude` not found / crashing on Windows?** A standalone CLI in `%USERPROFILE%\.local\bin` that crashes
on `claude --version` (exit `-1073741819`) is a broken install: reinstall it
(`irm https://claude.ai/install.ps1 | iex`) and restart the terminal (restart VS Code for its integrated
terminal). Still "not recognized" although `%USERPROFILE%\.local\bin` is in your user PATH? A user PATH
longer than ~2047 characters (often duplicated entries) is silently ignored by Windows — deduplicate it.
Meanwhile, the copy bundled with the VS Code extension works:

```powershell
$claude = (Get-ChildItem "$env:USERPROFILE\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe" |
  Sort-Object LastWriteTime | Select-Object -Last 1).FullName
& $claude plugin eval . --ablation none --trust-plugin --no-publish --max-cost-usd 5
```

When you change the skill's `description`, add a case for any new trigger phrase before relying on it.
