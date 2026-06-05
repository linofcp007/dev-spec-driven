# Prompt Engineering Patterns

Patterns for building AI features that work reliably at scale. Pick the right pattern
for your task — don't reach for agents when a structured prompt will do, don't reach for
fine-tuning when prompting works.

## Table of Contents

1. [Structured Output](#structured-output)
2. [Retrieval-Augmented Generation (RAG)](#retrieval-augmented-generation-rag)
3. [Few-Shot Learning](#few-shot-learning)
4. [Chain-of-Thought](#chain-of-thought)
5. [Tool / Function Calling](#tool--function-calling)
6. [Agents and Agent Loops](#agents-and-agent-loops)
7. [Multi-Turn Conversation](#multi-turn-conversation)
8. [Prompt Caching](#prompt-caching)
9. [When to Fine-Tune](#when-to-fine-tune)

---

## Structured Output

Use when you need reliable, machine-parseable responses: classifications, extractions,
JSON API responses.

### Techniques

**JSON mode / structured output mode** (provider-dependent):
- Anthropic: tool use with a `respond_with_structured_output` tool + JSON schema
- OpenAI: `response_format: json_schema`
- Both enforce schema at generation time. Use them.

**Schema validation as fallback:** even with JSON mode, validate with zod/pydantic
after. JSON mode prevents bad JSON but not bad content (field semantics).

**Prompt framing:** give the model the schema in the prompt too, not just in the API
call config. Redundancy helps adherence.

### Example

```typescript
const schema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).max(3),
});

const prompt = `
Classify the sentiment of the text below. Respond with JSON matching this schema:
${zodToJsonSchema(schema)}

Text: "${text}"
`;

const response = await llm.generate(prompt, { response_format: schema });
const result = schema.parse(response); // Enforce at runtime
```

**Don't:** return free-form text and regex it. That's a recipe for production bugs.

---

## Retrieval-Augmented Generation (RAG)

Use when the model needs knowledge that's not in its training data or that changes over
time: your docs, user-uploaded content, recent events, proprietary data.

### Standard Pipeline

1. **Chunk** your documents (500–1500 tokens per chunk, with overlap for context
   continuity)
2. **Embed** each chunk with an embedding model
3. **Index** in a vector DB (pgvector, Pinecone, Weaviate, Qdrant)
4. **At query time:** embed query → similarity search → retrieve top-K chunks
5. **Compose prompt** with retrieved chunks as context
6. **Generate** with the LLM
7. **Cite** sources in the response

### Choices That Matter

- **Chunk size:** too small loses context, too large pollutes the retrieval relevance.
  Start 800 tokens, tune based on eval.
- **Overlap:** 10-20% overlap between chunks preserves context at boundaries
- **Top-K:** 3-10 chunks. More chunks = more context but more noise and more cost.
- **Embedding model:** voyage-3 and text-embedding-3-large are current leaders on
  English. Multilingual needs different choice (voyage-3-multilingual, cohere-embed-v3).
- **Reranking:** for high-stakes retrieval, use a reranker model (cohere-rerank, voyage-rerank)
  on top-50 retrieval to get the best top-5. Expensive per query but significantly
  improves relevance.
- **Hybrid search:** combine vector (semantic) and keyword (BM25) search for best
  recall. Weight them, tune on eval.

### Anti-hallucination Tactics

- In the system prompt: "Answer only using the provided context. If the answer isn't
  there, say 'I don't know.'"
- Require citations in output: "[chunk:ID]" after each claim. Validate that cited chunk
  IDs are in the retrieved set.
- Set relevance threshold: if max similarity score is below threshold, skip generation,
  return "not found".
- Return a confidence level with the answer; low confidence → suggest human review.

---

## Few-Shot Learning

Show the model 2-5 examples of the pattern you want. Often more reliable than elaborate
instructions.

### When to use
- Task has a specific format or style that's hard to describe abstractly
- Task has edge cases that examples clarify
- You have small volume and can't justify fine-tuning

### When not to use
- Examples inflate token cost per call significantly
- Task is simple enough that zero-shot with good instructions works
- You have so many examples it's cheaper to fine-tune

### Best practices
- Diverse examples — don't all be the same pattern
- Include at least one edge case example (what to do when input is ambiguous, empty,
  out of scope)
- Examples go between system prompt and user input, in a clearly-delimited section
- Rotate examples per-query (using retrieval) to surface the most relevant ones, saving
  tokens — this is "dynamic few-shot"

---

## Chain-of-Thought

Ask the model to reason step-by-step before producing a final answer. Improves quality
on complex tasks.

### Techniques

**Explicit:** "Think step by step before answering." or "First, analyze the problem.
Then produce the final answer."

**Structured:** break into explicit phases: `<analysis>...</analysis>
<final_answer>...</final_answer>`. Parse final answer, discard reasoning (saves display
length).

**Model-native:** newer models (Claude, o1, o3) have built-in extended thinking. Enable
it for hard tasks; rely on output without needing to elicit reasoning.

### Costs
- CoT increases output tokens 2-5× (you're paying for the reasoning)
- Often improves quality enough to justify cost on hard tasks
- For easy tasks, CoT is overhead for minimal gain — measure, don't assume

### When to avoid
- Latency-critical user-facing streaming (reasoning delays first token)
- Simple classification or extraction
- Cost-sensitive high-volume tasks

---

## Tool / Function Calling

Give the model access to tools (functions it can call to fetch data, take actions, do
computation).

### Anatomy

1. Define tools: name, description, input schema
2. Pass tools in the API call alongside the prompt
3. Model decides whether to use tools and with what arguments
4. Your code executes the tool, returns the result to the model
5. Model produces final response using tool results

### Good Tool Design

- **Clear, action-oriented names:** `search_products`, `get_order_status`. Not
  `doProductThing`.
- **Rich descriptions:** explain when to use this tool, what it returns, limitations.
  The description is the model's instruction manual.
- **Minimal, validated input schema:** use JSON Schema with descriptions on each field.
  The model fills these in like a user fills a form.
- **Informative errors:** if the tool fails, return an error message the model can
  respond to ("Order not found: check the order ID format").

### Security

- **Never trust tool arguments unconditionally** — validate as if from a user.
- **Whitelist, don't blacklist** — define what tools can do, not what they can't.
- **Rate limit tool calls** per user and per session (prevent runaway loops).
- **Audit log every tool call** with full arguments and result.

---

## Agents and Agent Loops

An agent is a model that uses tools in a loop: think → call tool → observe result →
think → ... → final response.

### When to use
- Multi-step problems where the steps aren't known upfront
- Tasks requiring external state (database queries, API calls)
- Complex routing (decide which tool, call it, handle result, maybe call another)

### When not to use
- Single-shot tasks (use structured output)
- Deterministic workflows (just write the code)
- Anywhere speed is critical (loops are slow)

### Required Guardrails

- **Max iterations:** hard cap on loop count (e.g., 15). Agents get stuck in loops; cap
  them.
- **Cost budget per task:** track cumulative cost; abort if over budget.
- **Timeout:** per-tool and per-task timeouts. An agent waiting on a slow API can burn
  time.
- **Observable reasoning:** log every iteration (model's plan, tool called, tool result).
  Without this, debugging is impossible.
- **Human-in-the-loop for writes:** any tool that takes a consequential action (send
  email, commit to DB, charge card) should require user confirmation in the UX, not just
  model discretion.

### Common Failure Modes

- **Loop death:** model keeps calling the same tool with slight variations, never
  converging. Detect repeated tool-argument pairs and break out.
- **Hallucinated tool use:** model calls a tool that doesn't exist or with wrong schema.
  Validate strictly, return clear error.
- **Cost runaway:** model thinks it's being efficient but actually burning tokens on
  verbose reasoning. Cap output tokens per iteration.
- **Cascading errors:** one tool call fails, model treats stale data as truth. Provide
  tool errors clearly so the model can react.

---

## Multi-Turn Conversation

State management across a conversation: chatbots, iterative refinement, multi-step
assistants.

### Context Management

The model doesn't remember prior turns unless you send them. Strategies:

**Full history:** send all prior messages. Simple. Breaks at long conversations (context
window limits, cost linearly growing).

**Summarization:** when history gets long, summarize older messages into a compact
note, keep recent messages verbatim. "Sliding window with summary" pattern.

**External memory:** store key facts in a database keyed by user/session; retrieve and
inject into prompts. Decouples model context from conversation length.

**Intent detection:** classify each user message; for simple intents (greeting,
clarification), use lightweight handling without full history.

### Trust Boundary

User input from any prior turn can contain injection. Treat older turns with the same
skepticism as the current turn. Don't assume "we already passed safety checks earlier" —
the model sees the full history each turn.

---

## Prompt Caching

Some providers (Anthropic, OpenAI) allow caching parts of the prompt for lower cost on
repeated calls. Huge wins when the system prompt / few-shot examples are stable.

### Anthropic (as of writing)
- Mark stable prefix as `cache_control: ephemeral`
- Cache hit: 90% off on that portion
- Cache TTL: ~5 minutes (refreshes on each hit)
- Minimum cacheable size: 1024 tokens

### Use cases
- Long system prompts (always the same): cache
- Few-shot examples (same per feature): cache
- RAG retrieved context: don't cache (changes per query)
- User-specific context: don't cache

### How to think about it
If your feature's non-user-specific prefix is >1024 tokens and you're doing >10
calls/minute at scale, caching cuts your bill 50-90% with zero quality impact. Easy win.

---

## When to Fine-Tune

Fine-tuning trains a model on your examples. Rarely the right answer for most SaaS.

### When fine-tuning makes sense
- You have **>1000 high-quality labeled examples**
- Specific task where prompting hits a quality ceiling you can't beat
- Consistent output format required at scale
- Cost-sensitive: fine-tuned smaller model can match large model on narrow task

### When it doesn't
- Task still evolving (you'll need to re-train)
- Small volume
- Prompt engineering hasn't been fully explored (do that first)
- Quality needs aren't well-defined yet (no eval set = no way to measure fine-tuning
  success)

### Process
1. Build eval set first
2. Exhaust prompt engineering (structured output, few-shot, CoT) and measure
3. If still below target, then consider fine-tuning
4. Train, eval against same set
5. Compare: fine-tuned vs best prompted — does improvement justify cost and
   operational complexity?

Most AI products never need to fine-tune. Prompt engineering + RAG covers 95% of SaaS
use cases.

---

## Pattern Selection Decision Tree

- Need structured output? → **Structured Output** (JSON mode + schema)
- Need knowledge not in model? → **RAG**
- Need specific style/format hard to describe? → **Few-Shot**
- Need complex reasoning? → **Chain-of-Thought** (or extended thinking model)
- Need to call external systems? → **Tool / Function Calling**
- Need multi-step planning with unknown steps? → **Agents** (with strict guardrails)
- Need conversation history? → **Multi-Turn** with context management
- Stable prompt prefix at scale? → **Prompt Caching**
- Prompt engineering hit a ceiling on narrow task with lots of data? → **Fine-Tuning**

Often the right answer is "combine patterns": RAG + structured output + citation
validation. Or few-shot + chain-of-thought + JSON mode. Stack as needed; don't overbuild.
