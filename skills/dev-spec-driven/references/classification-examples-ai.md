# AI Classification Matrix: Worked Examples

This document calibrates the Fast AI Path vs Rigor AI Path decision with 12 worked
examples across common AI product patterns.

## The Decision Tree

1. **Does the model take autonomous action?** (writes to DB, sends email, commits code,
   charges cards, moves files) → **Rigor AI Path**. No exceptions. An agent that can act
   is an agent that can screw up at scale.

2. **Is the output shown directly to users?** (chatbot replies, generated drafts,
   summaries displayed) → **Rigor AI Path**. Users judge you by output quality, and
   hallucinations become product bugs.

3. **Is this in a regulated domain?** (legal, medical, financial advice; employment;
   housing; credit) → **Rigor AI Path**. "The AI said so" is not a legal defense.

4. **Does user-controlled input flow to the model?** (user question, uploaded document,
   URL content) → **Rigor AI Path**. Prompt injection surface; needs adversarial eval
   set and output validation.

5. **Does user PII reach the model provider?** (emails, names, health data, financial
   records) → **Rigor AI Path**. DPA compliance, data residency, contractual obligations.

6. **High volume or high cost?** (>10K calls/day OR >$500/month in tokens OR
   high-value enterprise customer) → **Rigor AI Path**. Cost regressions here are
   material.

7. **Hard to undo?** (emails actually sent, posts published, code committed, payments
   processed) → **Rigor AI Path**. Even one bad output hurts.

If **none** of the above → Fast AI Path is appropriate. Ask:

8. **Is it internal-only?** (staff tool, admin helper) → Fast AI Path OK.
9. **Is output advisory?** (suggests, doesn't act; human approves) → Fast AI Path OK.
10. **Low volume and low stakes?** (demo, beta, bounded pilot) → Fast AI Path OK.

**Tiebreaker:** when in doubt, Rigor. The cost of building an eval set for what turns out
to be a simple feature is small. The cost of skipping evals for what turns out to be
critical is a public quality incident.

---

## 12 Worked Examples

### 1. Customer-facing support chatbot (answers product questions)
**Path: Rigor AI Path**
- Output shown to users directly (quality matters)
- User input flows to model (injection surface)
- High volume expected
- Hallucinations = wrong answers = support tickets or worse

### 2. Internal CSV-to-SQL helper for data team
**Path: Fast AI Path**
- Internal only
- Output is advisory (analyst reviews SQL before running)
- Low volume
- Errors are caught by humans

### 3. Autonomous agent that triages GitHub issues and assigns labels
**Path: Rigor AI Path**
- Autonomous action (labels affect routing and SLAs)
- Output structured but consequential (wrong label = missed bug)
- Needs eval set for label accuracy
- Needs cost budget (issues per day × cost per call)

### 4. "Suggest reply" draft for sales team (human edits before sending)
**Path: Fast AI Path**
- Advisory, not autonomous (human approves every send)
- Internal-facing (sales rep sees output, not customer directly)
- BUT if volume grows or sales ever copy-paste without review, escalate to Rigor

### 5. Legal document summarization for law firm clients
**Path: Rigor AI Path**
- Regulated domain (legal)
- Customer-facing output
- Hallucinations have liability consequences
- PII in documents
- Requires strict "I don't know" behavior when content isn't supported

### 6. RAG-based search over user's uploaded docs
**Path: Rigor AI Path**
- User input (query) + user documents (context) both flow to model
- Output shown to user
- Hallucination = fabricated citations = trust-destroying
- Retrieval quality + generation quality both need evals

### 7. Tagging uploaded images with AI (for photo organization)
**Path: Fast AI Path IF tags are advisory and user can edit. Rigor IF tags drive
autonomous behavior (e.g., auto-filing into folders)**
- Context-dependent: the same underlying model use case changes path based on autonomy

### 8. Code review assistant that comments on PRs
**Path: Rigor AI Path**
- Output shown to developers (quality matters for adoption)
- If it blocks merges autonomously → clearly Rigor
- If advisory → still Rigor because of developer time cost on bad comments and because
  code can contain secrets that may flow to the model

### 9. Generating marketing email subject lines (human selects best of 5)
**Path: Fast AI Path**
- Advisory (human picks)
- Low volume
- No user PII
- Output not directly customer-facing without human step

### 10. Voice agent that books restaurant reservations on user's behalf
**Path: Rigor AI Path**
- Autonomous action (books real reservation)
- Takes audio input (broader attack surface, harder to eval)
- Real-world consequences (fees, no-shows, awkward explanations)
- Often in regulated scenarios (accessibility compliance)

### 11. Semantic search in docs site (AI-augmented FAQ)
**Path: Rigor AI Path if generative, Fast AI Path if only retrieval**
- Pure retrieval + ranking (embeddings, no generation): Fast AI Path
- Retrieval + LLM-generated answer: Rigor AI Path (hallucination risk re-enters)

### 12. AI-generated weekly report sent to users automatically
**Path: Rigor AI Path**
- Autonomous (sent without review)
- Customer-facing content
- Hard to undo once sent
- Regressions compound over weeks before anyone notices

---

## Edge Cases

### "It's just a prototype for a demo"

If the prototype never goes past the demo — Vibe mode is fine. Skip all artifacts. The
moment it's behind a stable URL with real users, classify properly.

### "Human is always in the loop"

That human-in-the-loop gate must itself be a requirement with an AC and a test. "Human
reviews before send" is fine; "developer intends for humans to review" is not. If the UX
makes it easy to auto-send (one-click "Send all"), it's effectively autonomous — classify
accordingly.

### "Low volume today, but if we launch it might blow up"

Classify for launch, not for today. A feature that works at 10 calls/day but breaks at
10K calls/day is a feature that breaks on launch day. Rigor path during build pays back
when traffic ramps.

### "We're using the model for classification — deterministic labels"

Structured classification (sentiment, intent, topic) is still non-deterministic. You need
an eval set of labeled inputs, you need to measure accuracy, and regressions matter. Fast
AI Path OK only if stakes are low (recommendation tags, not auto-actions).

---

## Output: `classification.md` Template

```markdown
# Classification: [Feature Name]

## Path
**Rigor AI Path**

## AI Criticality Signals
- User-facing generation: outputs shown directly to customers in chat UI
- User input flows to model: user question is part of prompt
- High volume expected: 50K+ queries/day at launch, 500K+ at 12 months
- Quality-sensitive: product value prop IS answer quality

## Autonomy Level
Advisory — user sees answer; no autonomous action. Downstream features (e.g., "book this
restaurant") are separate and classified independently.

## Blast Radius
- Quality regression: every user who asks in the regression window sees bad answers;
  measurable as thumbs-down rate, support tickets, churn
- Cost regression: at 50K calls/day, a 2× cost increase = +$X/day; hard alert required
- Safety regression: hallucinated facts about our pricing, capabilities, or legal terms
  are material business risk

## Volume Projection
- Launch: 50K calls/day, ~$200/day in tokens
- 6 months: 300K calls/day, ~$1200/day
- 2 years: 2M calls/day, ~$8000/day

## Compliance Tags
- GDPR — user queries may contain PII; Anthropic DPA on file
- Not in regulated domain (answering about our own product, not medical/legal/financial
  advice)
```
