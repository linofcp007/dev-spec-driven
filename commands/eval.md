---
description: (+ai) Run a feature's local eval harness with your own API key, record a baseline, or gate a model migration on it.
disable-model-invocation: true
argument-hint: "[feature] [run [--dry-run] | baseline | migrate <target model>]"
---

Args: $ARGUMENTS (default: `run`) — the harness, from the project root:
`node "${CLAUDE_PLUGIN_ROOT}/mcp/evals/run-evals.js" <feature-slug> [--dry-run] [--set-baseline] [--model=<id>] [--max-items=<N>]`

- **run** — with the user's own `ANTHROPIC_API_KEY` (none, or `--dry-run`: the sets are validated and the plan printed,
  no model called; an invalid set exits 1 naming each bad item). Report per set the score, the delta against the
  baseline and whether it met its threshold (golden ≥ 85 %, adversarial 100 %, regression 100 % unless
  `evals/thresholds.json` says otherwise). One run per call: run it as many times as the eval plan's runs per score
  and report the median and the spread — a delta under the plan's decision delta or inside the spread is no change.
- **baseline** — the same run with `--set-baseline`, only after a good run the user accepts: the run closest to the
  median; write the median and the spread in eval-plan.md → Baseline.
- **migrate `<target model>`** — run the current sets through the target (`--model=<id>`) and compare per set. Switch only
  if it matches or beats the current model on every set (or tune the prompt until it does, re-evaluating each time);
  otherwise stay. Compare medians of the same number of runs: a difference inside the spread is a match. Record the
  decision and the numbers in design.md → Model Lifecycle. Never migrate without the comparison.

Patterns: `${CLAUDE_PLUGIN_ROOT}/skills/dev-spec-driven/references/eval-suite-patterns.md`. Respond in the user's language
(EN / PT / ES).
