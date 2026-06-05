# Model Provider Guide

A practical guide to choosing and integrating model providers. This document avoids
specific model names and prices (they change quarterly) — instead it gives you the
framework for choosing, evaluating, and migrating across providers.

Always verify current pricing, rate limits, and model capabilities on the provider's
official documentation before committing to a choice.

## The Providers (as of writing)

### Anthropic (Claude)
- **Strengths:** instruction following, honest refusal, long context reliability, prompt
  caching discount, strong safety training
- **Weaknesses:** fewer multimodal inputs than competitors, smaller ecosystem
- **Best for:** chatbots, writing assistants, code generation, RAG applications,
  anything requiring nuanced instruction adherence
- **DPA:** enterprise-friendly, commercial terms exclude training on your data
- **API:** `/v1/messages` endpoint, streaming, tool use, prompt caching, vision

### OpenAI (GPT)
- **Strengths:** largest ecosystem, broadest multimodal (text + image + audio), many
  model tiers including reasoning models
- **Weaknesses:** behavior shifts between model versions more than competitors, safety
  training sometimes over-refuses
- **Best for:** multi-modal features, voice interfaces, reasoning-heavy tasks (o-series),
  feature velocity (usually first to market with new capabilities)
- **DPA:** enterprise tier required for no-training guarantees; default consumer API has
  different terms
- **API:** `/v1/chat/completions`, function calling, assistants, batch API, streaming

### Google (Gemini)
- **Strengths:** massive context windows (1M+), competitive pricing, strong multimodal,
  integration with Google Cloud services
- **Weaknesses:** inconsistent instruction following in some tasks, less mature ecosystem
- **Best for:** long-context tasks (analyze an entire codebase, a full book), multimodal
  (video input), GCP-native applications
- **DPA:** Google Cloud Vertex offers enterprise DPAs; consumer API different
- **API:** `generativelanguage.googleapis.com` and Vertex AI endpoints

### Open Source (Llama, Mistral, Qwen, DeepSeek, etc.)
- **Strengths:** self-hostable (full data sovereignty), no per-token vendor cost (only
  infra), customizable via fine-tuning
- **Weaknesses:** operational burden, quality gap with top closed models, lag on newest
  capabilities
- **Best for:** data-sensitive use cases (healthcare, legal, government), high-volume
  narrow tasks where cost dominates, when you need fine-tuning on your data
- **Hosting options:**
  - Fully self-hosted on your GPUs (most control, most work)
  - Fireworks / Together / Groq / Replicate (API-like, pay per token)
  - AWS Bedrock / Azure AI Studio (managed, integrated with cloud account)

### Specialty Providers
- **Voyage AI** — embeddings, particularly strong on multilingual and specialized domains
- **Cohere** — embeddings, reranking, and models with strong RAG integration
- **Mistral** — strong European provider with GDPR-friendly infrastructure
- **Perplexity / Exa** — search-augmented APIs for RAG-like features

---

## Choosing a Provider for a Feature

### Step 1: Eliminate by Hard Constraint

If any of these apply, it filters your options:

- **Data residency required** (EU-only, country-specific) → eliminate providers without
  that region
- **No-training-on-data contractual requirement** → enterprise tier of major providers,
  or self-hosted
- **Specific modality required** (native video understanding, real-time voice) →
  eliminate providers who don't offer it
- **Extreme context window need** (entire codebase, full book) → Gemini or Claude
  long-context, or specialized solutions
- **On-premises requirement** (government, defense, health) → self-hosted open source

### Step 2: Run the Eval

Once constraints narrow the list, run your eval set (from your feature's `eval-plan.md`)
against each candidate. Compare:
- Quality scores (golden, adversarial, regression)
- Latency (P50, P95)
- Cost per call
- Stability (same input, multiple times — how consistent?)

The best-on-paper model may not be the best for your specific task. Measure, don't
assume.

### Step 3: Pick Primary and Fallback

- **Primary:** wins on quality at acceptable cost and latency
- **Fallback:** different provider or cheaper model for degradation (handles primary
  outage, rate limits, cost overruns)
- **Test the fallback** — run a smaller eval to verify fallback quality is acceptable

### Step 4: Document the Decision

In `design.md` Model Strategy section:
- Which model, why
- Alternatives considered, why rejected
- When we'd reconsider (new model release, cost change, requirement change)

---

## Pin Policy

Two schools:

### Pin to Dated Version (recommended for production)
- Model ID includes dated version (e.g., `claude-sonnet-4-6-20250929`)
- Reproducible results; eval scores stay valid
- Requires explicit migration when version deprecates
- **Use for:** production features with eval coverage, contractual SLAs, regulated
  workloads

### Track Latest
- Model alias without dated version (e.g., `claude-sonnet-latest`)
- Automatic access to improvements
- Risk: behavior changes silently, breaks your tests, affects production quality
- **Use for:** prototypes, internal tools, features where "slightly better over time" is
  more valuable than reproducibility

---

## Model Migration Process

When migrating between versions or providers:

1. **Run current eval suite** against new model with the *same* prompt. Record scores.
2. **Iterate on prompt if needed** — newer or different models may need prompt
   adjustments. Track changes alongside eval deltas.
3. **Compare costs** — new model may be cheaper or more expensive per token; factor in
   any token count changes (different tokenizers).
4. **Compare latency** — newer model may be slower (larger) or faster (optimized).
5. **Run load test** on new model if feature is on hot path.
6. **Phased rollout** — 5% of traffic → 25% → 50% → 100% with eval monitoring at each
   step. Abort if quality drops in production.
7. **Document** in an appendix to `design.md` Model Lifecycle section.

Never migrate blind. Every migration is an eval-gated change.

---

## Rate Limits and Capacity Planning

Every provider has rate limits per API key or per organization. Know yours.

### Common Tiers
- **Free / trial tier** — very low limits, unsuitable for production
- **Build tier** — low-moderate, suitable for dev and small production
- **Scale tier** — high, suitable for mid-size production
- **Enterprise** — negotiated, typically what you want for >100K calls/day

### Scaling Strategy
- **Request higher limits proactively** — providers need notice before doubling your
  quota. Don't wait until you're hitting limits.
- **Multi-key / multi-project** — spread load across API keys to work around per-key
  limits (check provider ToS that this is allowed)
- **Multi-provider** — for maximum resilience, route some traffic to a secondary
  provider so you have capacity when primary is overloaded

### Rate Limit Behavior
When you hit a provider's rate limit:
- Respect `Retry-After` headers
- Exponential backoff with jitter
- Fall back to secondary model/provider if sustained
- Return user-friendly error if no fallback works: "AI search is busy, please try again"
  — don't just 5xx

---

## Cost Controls per Provider

### Anthropic
- **Prompt caching** — mark stable prefixes for 90% discount on that portion after first
  call (5-min TTL)
- **Batch API** — discount for non-latency-sensitive workloads, 24h turnaround
- **Spend limits** on the account level

### OpenAI
- **Batch API** — 50% off for async workloads
- **Usage tiers** — reach higher tiers for priority capacity
- **Spend caps** per key

### Google Vertex
- **Batch prediction** — cheaper async
- **Committed use discounts** — negotiate for sustained usage

### Open Source (self-hosted)
- **GPU reservation vs on-demand** — reserved instances much cheaper
- **Quantization** — smaller model weights, faster inference, quality tradeoff
- **Spot instances** — acceptable for non-latency-critical batch workloads

---

## Observability Across Providers

Abstract your LLM client so switching providers doesn't require rewiring your
observability. Every call should produce:
- `provider` (anthropic/openai/google/self_hosted)
- `model_id` (specific version)
- `input_tokens`, `output_tokens`, `cost_usd`
- `latency_ms`, `ttft_ms` (streaming)
- `request_id` (provider's — for support cases)
- `prompt_version` (yours — for internal tracking)
- `status` (success/error/timeout/fallback)

With this, switching providers is a config change; your dashboards keep working.

---

## Provider Dependency Risk

You're betting on another company's uptime, pricing, and roadmap. Mitigate:

1. **Abstract the client** — your code uses `LLMClient.generate()`, not
   `anthropic.messages.create()` directly. Enables quick provider swap.
2. **Keep your eval set current** — you can evaluate any provider in minutes.
3. **Watch provider roadmap announcements** — deprecations, capacity issues, pricing
   changes.
4. **Have a fallback provider configured** — even if you don't actively use it, having
   secondary API keys and tested integration means "switch providers" is a 1-day task,
   not 1-month.
5. **Monitor the status pages** — Anthropic, OpenAI, Google all publish real-time
   status. Automate alerts when dependencies degrade.

No provider is permanent. Build as if you'll migrate eventually — because you probably
will.
