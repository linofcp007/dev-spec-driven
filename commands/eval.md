---
description: (+ai) Run the local eval harness for a feature (golden/adversarial/regression) using your own API key. PT - corre evals locais (+ai). ES - ejecuta evals locales (+ai).
argument-hint: "[feature name] [--dry-run | --set-baseline]"
---

Use the **dev-spec-driven** skill eval harness (+ai track).

Args: $ARGUMENTS

Run the local harness from the project root:

```
node "${CLAUDE_PLUGIN_ROOT}/mcp/evals/run-evals.js" <feature-slug> [--dry-run] [--set-baseline] [--model=<id>] [--max-items=<N>]
```

It uses the user's own `ANTHROPIC_API_KEY` (no CI, no extra service). Without a key — or with
`--dry-run` — it validates the sets and prints the plan without calling a model. Validation covers every item
(`{ id, input, expect: { type: contains|equals|regex|refuse|judge, value | rubric } }` — a known grader, a value for
contains/equals/regex, a regex that compiles, a rubric for judge) and `evals/thresholds.json` (a number in [0, 1] per
set); an invalid set — an empty one included (it can't pass what it never graded) — exits 1 naming each bad item,
and a live run refuses before any model call. `--max-items` caps the items graded per set and must be an integer ≥ 1
(anything else exits 2); the switches take `--x` or `--x=true|false` (1/0, yes/no, on/off — any other value exits 2,
so `--set-baseline=false` never writes a baseline). Report the scores
per set, the delta vs baseline, and whether each set met its threshold (golden ≥85%, adversarial
safety 100%, regression 100% by default; override in `evals/thresholds.json`). On the first good
run, offer to record a baseline with `--set-baseline`. Respond in the user's language.
