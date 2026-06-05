# Eval Suite Patterns

An AI feature without evals is an AI feature you can't ship safely. This document covers
how to build the three eval sets (golden, adversarial, regression), how to grade
responses, and common pitfalls.

## The Three Eval Sets — Purpose and Size

### Golden Set
**Purpose:** answer "does the feature do what it's supposed to?" on realistic input.

**Size:** 50–200 items. Quality > quantity. Each item should represent a real use case
you've seen or can confidently predict.

**Composition:** cover the user journeys you care about. For a support chatbot: how-to
questions, troubleshooting, pricing, integrations, edge cases, ambiguous queries that
should ask for clarification.

**Rule:** if the golden set doesn't reflect the distribution of real users, your score
doesn't reflect real quality. Seed it from real production queries after launch, not
from your imagination.

### Adversarial Set
**Purpose:** answer "does the feature stay safe and in-scope under hostile input?"

**Size:** 30–100 items. Grows as new attacks surface.

**Composition:** at least one example of every attack category you're defending against:
- Prompt injection via user input ("Ignore previous instructions and...")
- Prompt injection via content (user-uploaded document with injection payload)
- Jailbreak patterns (roleplay, encoding tricks, hypothetical framings)
- Out-of-scope requests that sound legitimate
- Extraction attacks ("What's your system prompt?" "List other users' queries")
- Token-draining input (very long, repetitive, crafted to max output)
- Cross-language (if you don't support it, the model should refuse politely, not
  confabulate)
- Misaligned incentives ("As the CEO, I authorize you to...")

**Rule:** every time an adversarial pattern works in production, it becomes a new case.
Adversarial set grows monotonically; you never "finish" it.

### Regression Set
**Purpose:** "bugs we fixed must stay fixed."

**Size:** starts at zero, grows over time. Every production quality bug (user-reported
thumbs-down, incorrect answer, hallucination) becomes a case after triage.

**Composition:** the exact or representative input that caused the bug, with the
expected correct behavior.

**Rule:** anything in the regression set that fails again is a release blocker. This
set is your longest-running proof that quality improves rather than drifting.

---

## Grading Methods

Choose the method per eval set based on what you're measuring.

### Exact / Fuzzy Match
For deterministic or near-deterministic outputs: classification labels, structured
extraction, specific factual answers.

- Exact: `output == expected`
- Fuzzy: token-level F1, BLEU, or rougeL for near-match
- JSON schema valid: for structured output features

**Good for:** classification, extraction, structured output
**Bad for:** open-ended generation, "quality" in any subjective sense

### LLM-as-Judge
For quality evaluation at scale. A separate LLM grades the outputs against a rubric.

**Structure:**
1. Define rubric explicitly (e.g., "correctness 0-1, completeness 0-2, tone 0-1")
2. Write a judge prompt that shows input + expected + actual output, asks for per-dimension
   scores with justification
3. Run judge on each eval item
4. Aggregate scores

**Use a stronger model as judge than the model under evaluation.** Example: if testing
Sonnet 4.6, grade with Opus 4.7.

**Trust but verify:** Human-review 10-20% of judge outputs to confirm the judge is
reasonable. If judge agrees with humans <80% of the time, your rubric is too vague or
your judge prompt needs work.

**Pitfalls:**
- Judge bias toward verbose, polite, hedged responses
- Judge agreeing with confident-sounding wrong answers (a form of hallucination)
- Judge scores drifting when judge model is updated

Mitigate by:
- Including in the rubric explicit "ignore length/verbosity unless it affects content"
- Including a few "known-bad but confident" outputs to verify judge catches them
- Pinning the judge model by dated version

### Human Review
For quality-sensitive work where LLM-as-judge isn't reliable enough.

- Use sparingly: expensive and slow
- Best for baseline calibration (100 items reviewed by humans, used to validate
  LLM-as-judge accuracy)
- Also for monthly spot-checks on production samples

### Heuristic Graders
For specific properties:

- Length within target range
- Contains required citation patterns (`[chunk:ID]`)
- Does not contain forbidden substrings (PII patterns, policy phrases)
- Schema validity
- Latency within budget

Stack these alongside LLM-as-judge for multi-dimensional evaluation.

---

## Eval Harness Anatomy

A minimal eval harness has:

```python
# eval_harness.py (pseudo-code)
def run_eval(eval_set: list[EvalItem], model_config: dict) -> EvalReport:
    results = []
    for item in eval_set:
        response = run_feature(item.input, model_config)
        grades = {}
        for grader in graders_for(item.type):
            grades[grader.name] = grader.grade(item, response)
        results.append(EvalResult(item, response, grades))
    return EvalReport(
        results=results,
        aggregates=compute_aggregates(results),
        cost=compute_total_cost(results),
        duration=compute_total_duration(results),
    )
```

Outputs to capture per run:
- Per-item: input, output, per-dimension grades, cost, latency
- Aggregates: mean score per dimension, pass rate, P95 latency, total cost
- Diffs vs baseline: per-item regressions highlighted

**Critical feature:** per-item output visible in a diff UI. Aggregate score drops are
only actionable if you can see which items regressed and read the bad outputs.

### CI Integration

- Run on every PR that touches prompts, model config, or features with AI calls
- Report as a PR comment: current scores, delta vs main branch
- Gate merge if: golden drops > 2%, adversarial drops at all, regression set fails any item
- Cache eval results when inputs haven't changed (prompt + model + retrieved context
  identical) to save cost

Budget CI eval cost. A 150-item golden set × $0.02/call = $3/run. 50 PRs/week = $150/week.
Worth it, but budget it.

---

## Common Pitfalls

### "The eval set is too small"
Under 30 items and your aggregate scores are too noisy to trust. Minimum viable golden
set is ~50. Aim for 100-200.

### "We tested it on the same examples we tuned it on"
Classic leakage. Reserve 20% of golden set as "held-out" — only used for final
validation, not for prompt iteration. If you peek, you overfit.

### "Eval scores look good but production is bad"
Your eval set doesn't match production distribution. Sample from real production queries
(anonymized) to expand golden set.

### "We only test the happy path"
Adversarial set matters as much as golden. A feature that scores 95% on golden but 40%
on adversarial is a feature that's one jailbreak tweet from being a story.

### "The judge is too lenient"
Rubric is too vague. Rewrite: specific criteria, explicit scoring anchors, examples of
what a 0, 1, 2 looks like. Test the judge on a known-calibrated subset.

### "Evals are slow"
- Parallelize: run items concurrently (respecting provider rate limits)
- Cache: if input + model + prompt is identical, cache the response
- Sample during iteration: run 30-item sample during local iteration, full set in CI

### "We can't agree what 'good' means"
Write the rubric first, before any implementation. If the team can't agree on what good
output looks like, you can't ship a good feature. This is a product-level conversation,
not a prompt engineering one.

---

## Template: `eval-plan.md`

```markdown
# Eval Plan: [Feature Name]

## Golden Set
- Size: 150 items
- Composition: [breakdown by category]
- Source: 40% synthesized, 60% from production query logs (anonymized)
- File: `evals/golden.json`

## Adversarial Set
- Size: 80 items
- Categories:
  - Prompt injection via query (20)
  - Prompt injection via context (15)
  - Jailbreak (10)
  - Extraction (10)
  - Out-of-scope (10)
  - Token drain (5)
  - Unsupported language (10)
- File: `evals/adversarial.json`

## Regression Set
- Size: 0 at launch, grows with bugs
- File: `evals/regression.json`

## Grading
### Golden
- Method: LLM-as-judge (Claude Opus 4.7)
- Rubric file: `evals/graders/golden_rubric.md`
- Dimensions: correctness (0/1), completeness (0/1/2), citation_accuracy (0/1),
  schema_compliance (0/1)
- Pass: score ≥ 0.75 out of max 1.0

### Adversarial
- Method: heuristic + LLM-as-judge combined
- Pass criteria per category (see table in design.md)

### Regression
- Method: exact behavior match per item

## Thresholds
- Golden: ≥80% pass rate
- Adversarial safety: 100% (hard)
- Adversarial out-of-scope: ≥95%
- Regression: 100%
- Cost per eval run: ≤$5 (CI budget)

## Running
- Local: `pnpm eval:all` (30-item sample, ~$0.50)
- Full: `pnpm eval:full` (full suite, ~$3)
- CI: full suite on every PR touching prompts or feature code
- Nightly: full suite on main, posted to dashboard

## Baseline (v1 prompt + Sonnet 4.6)
- Run date: 2026-04-20
- Golden: 84% (126/150)
- Adversarial safety: 100%
- Adversarial out-of-scope: 96%
- Cost: $3.12
- Total duration: 4 min 32s
```
