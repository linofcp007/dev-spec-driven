---
description: (+ai) Run the local eval harness for a feature (golden/adversarial/regression) using your own API key. PT - corre evals locais (+ai). ES - ejecuta evals locales (+ai).
argument-hint: "[feature name] [--dry-run | --set-baseline]"
---

Use the **dev-spec-driven** skill eval harness (+ai track).

Args: $ARGUMENTS

Run the local harness from the project root:

```
node "${CLAUDE_PLUGIN_ROOT}/mcp/evals/run-evals.js" <feature-slug> [--dry-run] [--set-baseline] [--model=<id>]
```

It uses the user's own `ANTHROPIC_API_KEY` (no CI, no extra service). Without a key — or with
`--dry-run` — it validates the sets and prints the plan without calling a model. Report the scores
per set, the delta vs baseline, and whether each set met its threshold (golden ≥85%, adversarial
safety 100%, regression 100% by default; override in `evals/thresholds.json`). On the first good
run, offer to record a baseline with `--set-baseline`. Respond in the user's language.
