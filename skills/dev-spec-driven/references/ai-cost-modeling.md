# AI Cost Modeling

Token costs for LLM features are volatile, compound with scale, and move inversely with
quality pressure (longer prompts, more retries, more reasoning). Modeling cost at design
time — not at invoice time — is the difference between a profitable feature and one
that eats your margin.

## The Three Numbers You Must Know

For every AI feature, before writing code:

1. **Cost per call** (input cost + output cost at provider pricing)
2. **Cost per user action** (may be multiple calls: embedding + retrieval + generation)
3. **Cost per 1000 users per month** at projected usage patterns

If you don't know these, you don't understand the feature's economics.

## Token Counting Primer

### Text
Roughly 1 token ≈ 4 English characters or ~0.75 words. Languages with Latin scripts are
similar. CJK languages pack more info per token but providers handle them differently —
always measure empirically.

Use the provider's tokenizer to count exactly:
- Anthropic: `@anthropic-ai/tokenizer` or the `messages.count_tokens` endpoint
- OpenAI: `tiktoken` library

Never estimate from character count when costs matter at scale. A 20% estimation error
on 1M calls/month is real money.

### Images
- Anthropic Claude: images are ~85 tokens at low-detail, variable at high-detail based on
  dimensions. A 1024×1024 image is ~1568 tokens.
- OpenAI GPT-4: similar ballpark; check docs for current rates.

### Audio (for multimodal)
Prices per minute of audio, not per token directly. Compare models on $/minute.

### Structured output / tool use
Tool definitions and JSON schemas count as input tokens. A rich schema (10 tools × 200
tokens each) adds 2K tokens to every call.

## Provider Pricing Snapshot (verify current prices — they change)

For current, accurate pricing, check each provider's pricing page. Memorize the rough
order of magnitude:

- **Cheapest tier** (Haiku-class, GPT-4o mini, Gemini Flash): $0.25 – $1 per million
  input tokens; $1 – $5 per million output tokens
- **Mid tier** (Sonnet-class, GPT-4o, Gemini Pro): $3 – $5 per million input; $15 per
  million output
- **Top tier** (Opus-class, o1/o3, Gemini Ultra): $15 per million input; $75 per million
  output

Output tokens are typically 3-5× more expensive than input. Short system prompts with
long contexts are cheaper than long system prompts with short contexts.

## Anatomy of Cost per Call

```
cost_per_call = (input_tokens * input_price) + (output_tokens * output_price)
```

Where:
```
input_tokens = system_prompt
             + prior_turns (if multi-turn)
             + few_shot_examples
             + retrieved_context (RAG)
             + tool_definitions (function calling)
             + user_message
```

Every category is a lever:
- System prompt creep: "let me add one more instruction" → 200 tokens → *N calls/day =
  real cost
- Context pollution: pulling 10 chunks instead of 5 doubles retrieval cost
- Tool bloat: 20 tools when 5 would do → thousands of tokens wasted per call

## Worked Example: RAG Answer Bot at Scale

**Feature:** users ask product questions; system retrieves 5 doc chunks, generates
answer.

**Per call:**
- System prompt: 600 tokens (cacheable — cache at 90% off after first call)
- Retrieved context: 5 chunks × 800 tokens = 4000 tokens
- User query: 50 tokens
- Output: 300 tokens average, 700 tokens P95
- Model: Sonnet-class at $3/M input, $15/M output

**Cost math:**
- Input: (600 + 4000 + 50) / 1M × $3 = $0.01395
- Output: 300 / 1M × $15 = $0.0045
- **Total per call: ~$0.018** (with cached system prompt: ~$0.015)

**At scale:**
- 10K calls/day × $0.018 = $180/day = ~$5,400/month
- 100K calls/day × $0.018 = $1,800/day = ~$54,000/month
- 1M calls/day × $0.018 = $18,000/day = ~$540,000/month

This is why "token costs scale linearly" hides a problem: linear growth in cost lands on
a P&L that may not grow linearly with users. If each paying user costs $X in LLM tokens
and they pay $Y/month, unit economics are fragile when $X creeps up.

## Cost Regression Scenarios (watch for these)

### Prompt Creep
- System prompt grows 100 tokens → permanent cost increase per call forever
- Solution: prompts in versioned files, diffs tracked, eval + cost impact on every PR

### Context Window Expansion
- Better retrieval brings top-10 instead of top-5 → 2× input cost
- Solution: measure retrieval recall at lower K first; more context rarely helps beyond
  K=5-7 for most tasks

### Output Length Drift
- New prompt version encourages verbose output → average output tokens jump
- Solution: include max output length in prompt, enforce with max_tokens parameter, track
  average output length as a metric

### Model Upgrade
- "Let's try Opus for quality" → 5× cost overnight
- Solution: eval-gated migrations, run cost analysis alongside quality analysis

### Adversarial Traffic
- Users crafting inputs designed to elicit long outputs
- Solution: cost circuit breakers, per-user cost caps, output length caps

### Agent Loops
- Agent gets stuck iterating, each iteration is a full model call with growing context
- Solution: max iterations, per-task cost cap, observability on loop length

## Cost Optimization Levers (order: biggest impact first)

### 1. Right-size the model
Route simple queries to the cheapest model that meets quality bar. Classification models
that route to "simple → Haiku, complex → Sonnet, very hard → Opus" can cut cost 60%
while maintaining quality.

### 2. Prompt caching
If your non-user-specific prefix is >1024 tokens, cache it. 50-90% cost reduction on
that portion. Zero quality impact.

### 3. Trim the prompt
Every token in every call forever. Edit mercilessly. Test that eval scores don't regress.
Typical savings: 20-40% with disciplined trimming.

### 4. Retrieve less context
Lower K. Check eval: does K=3 score the same as K=5? If yes, use K=3. Input tokens cut
40%.

### 5. Shorter output
Instruct for brevity in the prompt. Use max_tokens cap as safety net. Typically 20-30%
savings on output cost.

### 6. Batch requests when possible
Provider batch APIs (Anthropic, OpenAI) give 50% discounts on non-latency-sensitive
workloads (nightly jobs, background enrichment).

### 7. Cache common queries
Same question asked 100 times → generate once, serve from cache. Especially useful for
FAQ-style tasks.

### 8. Fine-tune
For very narrow, very high-volume tasks. Last resort; don't go here first.

## Budget Alerts — Configuration

### Tenant-level cost cap
Per-tier cap on hourly/daily token spend per tenant. Enforced by cost circuit breaker:
when hit, return friendly message asking to try again later or upgrade.

### Feature-level cost cap
Per feature, per day. Alerts at 50% (slack), 80% (page), 100% (throttle).

### System-level cost anomaly
Rolling 7-day baseline. Alert when current daily cost exceeds 150% of baseline.
Investigate before it gets to 300%.

### Per-user abuse detection
Track cost per user. Users in the top 0.1% of cost consumption should be reviewed.
Either they're high-value power users (good) or abusers (cut them off).

## Cost Envelope in `design.md`

For every AI feature's design doc:

```markdown
## Token Economics

### Per call
- Input tokens: 5800 (system 600 cached + context 4900 + query 50 + overhead 250)
- Output tokens: 400 avg, 800 P95
- Cost per call: $0.018 cached, $0.023 uncached
- Cache hit rate expected: 85% at steady state → effective $0.0188 per call

### Per user action
One call per user query. Average user asks 3.2 questions per session.
- Cost per session: $0.060

### Per 1000 users per month
Assuming 8 sessions/user/month:
- 1000 × 8 × $0.060 = $480 / 1000 users / month
- At 10K MAU: $4,800/month
- At 100K MAU: $48,000/month

### Cost regression threshold
- Per-call cost > $0.025 at P95 → investigate (likely context bloat)
- Daily total cost > 150% of 7-day baseline → P1 alert

### Optimization options available if budget pressure:
- Prompt caching if not already enabled (est. save 20%)
- Route 30% of "how do I" simple queries to Haiku (est. save 25%)
- Cap output at 400 tokens instead of 800 (est. save 15% on output)

### Break-even analysis
At ARPU of $X/user/month, feature is profitable when cost/user/month < 0.4 × ARPU.
Current: $Y/user/month. Margin: Z%.
```

## The Compounding Problem

Costs compound in ways that aren't obvious until the bill hits:

- **User growth:** linear
- **Adoption of AI feature:** you hope linear, but often superlinear (users love it, use
  it more)
- **Prompt complexity:** ratchets only upward (new edge cases → new instructions)
- **Context size:** creeps upward (better retrieval, more context, more tools)
- **Retry rates:** go up with scale (more provider hiccups)

Budget with margin. A feature that costs $0.02/call today might cost $0.03/call in 6
months at 10× traffic. Build the cost monitoring and alerting before the surprise, not
after.

## Quick Sanity Check

Before you code:
- Back-of-envelope cost per call: $_______
- Expected calls/day at launch: _______
- Expected calls/day at 12 months: _______
- Cost at launch: $_______
- Cost at 12 months: $_______
- ARPU: $_______
- Margin at 12 months: ____%

If margin is negative or razor-thin, the feature's economics are broken. Redesign before
building.
