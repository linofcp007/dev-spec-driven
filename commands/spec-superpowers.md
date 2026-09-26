---
description: Give dev-spec-driven precedence over the superpowers plugin for feature work — writes a marked precedence block into CLAUDE.md after you confirm (or removes it). PT - dá precedência ao dev-spec-driven sobre o superpowers. ES - da prioridad a dev-spec-driven sobre superpowers.
argument-hint: "[--project|--user] [--remove]"
---

Use the **dev-spec-driven** skill.

Args: $ARGUMENTS

**Why.** The superpowers plugin injects "use these skills whenever they might apply" at every session start, and
several of its skills overlap this plugin: planning, TDD, debugging, subagent execution, verification, review and
finishing a branch. Its own `using-superpowers` skill says that **user instructions in CLAUDE.md take precedence
over skills** — so a precedence block in CLAUDE.md is the supported way to route that work here while superpowers
keeps everything this plugin doesn't cover. Its branch-finishing flow also suggests pull requests; the block sends
that step to `/spec-finish` (local merge).

**Steps**
1. Target: `--project` (default) → the project's `CLAUDE.md` at the repo root; `--user` → `~/.claude/CLAUDE.md`
   (every project on this machine). Say which file and show the block below before writing anything.
2. Write only after the user confirms. If the file already holds a block between the two markers, replace just that
   block (an update); otherwise append the block at the end, creating the file if it doesn't exist. Never change
   anything outside the markers.
3. `--remove`: delete the block, markers included, and nothing else. If the file is then empty, say so — delete the
   file only if the user asks.
4. Never disable or uninstall superpowers yourself. If the user would rather switch it off, explain the options:
   for one project, `.claude/settings.json` → `"enabledPlugins": { "<superpowers plugin id>": false }` (the exact id
   is in `/plugin`, e.g. `superpowers@claude-plugins-official`); everywhere, `/plugin disable <id>`. Both also drop
   the superpowers skills this plugin doesn't replace (worktrees, parallel agents, writing skills).
5. Tell the user it applies from the next session (CLAUDE.md is read when a session starts).

**The block** — write it verbatim, in English (it is an instruction for the agent, whatever language the user speaks):

```markdown
<!-- dev-spec-driven:precedence:start -->
## Feature work: dev-spec-driven takes precedence over superpowers

With the dev-spec-driven plugin installed, use it instead of these superpowers skills for feature work:

| Instead of (superpowers) | Use (dev-spec-driven) |
|---|---|
| brainstorming, writing-plans | the dev-spec-driven skill: Phase 0 classification → EARS requirements → design → tasks (`/spec`, `/clarify`, `/grill`) |
| executing-plans, subagent-driven-development | `/executeTask` (`--subagents` for the implementer + reviewer loop) |
| test-driven-development | the `+tdd` track (`/testPlan`, `/writeTests`) |
| systematic-debugging | `/spec-bugfix` (reproduction → root cause → failing regression test → fix) |
| verification-before-completion | the evidence gate: run each task's `_Verify:_` command and record it (`spec_complete_task`, `dev-spec done --run`) |
| requesting-code-review, receiving-code-review | `/prReview` (local review) and `/spec-review-feedback` |
| finishing-a-development-branch | `/spec-finish` — merge locally or keep the branch; no pull requests, no CI |

Keep using superpowers for what dev-spec-driven doesn't cover (using-git-worktrees, dispatching-parallel-agents,
writing-skills). This is a user instruction: it takes precedence over any skill's own "always use me" guidance.
<!-- dev-spec-driven:precedence:end -->
```

Respond in the user's language (EN/PT/ES).
