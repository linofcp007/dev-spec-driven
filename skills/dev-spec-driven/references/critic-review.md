# The deep review before a gate — the critic, the cold read, the triage

`spec_doctor` checks an artifact's structure; the deep review checks its meaning, with reviewers that start fresh. It
runs on `/spec-doctor <feature> --deep`, and SKILL.md → Gates has you offer it at size m / l or no size, before the
requirements approval (a bugfix: its requirements approval, with bug.md; a design-first feature: the design's) —
never at the classification gate, which it has no checklist for.
Adapted from google/elephant-goldfish-model (Apache-2.0): the *elephant* — you, the session that wrote the spec and
remembers why — drafts and resolves; the *goldfish* — subagents with no history — review. A review written by the
context that wrote the artifact validates its own assumptions; a fresh one finds what the text leaves out.

## 1. Who reviews, by size

The size is `spec_doctor`'s `size` (no key: no size).

| Size | Reviewers — one message, in parallel |
|---|---|
| xs (a change) | none by default — doctor is enough; the gate critic when the user asks |
| s | the critic (gate) |
| m, or no size | the critic (gate) + a cold read (naive) |
| l | two independent critics (gate, A and B) + a cold read (naive) |

The cold read is only for the artifacts a newcomer must understand — `requirements.md`, `design.md`, `bug.md`; at the
other gates (test plan, eval plan, tasks, a spike's decision) the critics alone review. At the plan gate the critic's
Readiness category judges `tasks.md`; each task's brief gets its own pre-flight during subagent execution
(`references/subagent-execution.md` → Pre-flight the brief). Two critics at size l buy recall: two fresh reviews miss
different things.

## 2. Dispatch — keep them goldfish

- `dev-spec-driven:spec-critic`, its mode on the dispatch prompt's first line (`Mode: gate` / `Mode: naive` — a line
  of the prompt, never a tool parameter). **gate:** the feature folder, the artifact's path, the active tracks, the
  latest `spec_doctor` result. **naive:** the artifact's path and the feature folder — nothing else.
- Never in a dispatch: your reasoning, the conversation, why the artifact is right, the answer you expect, another
  reviewer's findings. A second look is a fresh dispatch, never a resumed reviewer.
- The agent declares `omitClaudeMd: true` (Claude Code 2.1.271 or later): it starts without the CLAUDE.md files. A rule
  the review needs belongs in the steering, which the critic reads; until it is there, quote it in the dispatch.
- **No subagent tool** (Cursor, Windsurf, Copilot, Gemini, claude.ai): run the gate checklist (the plugin's
  `agents/spec-critic.md`) yourself, and say that the cold read and the second critic were skipped — a review in the
  context that wrote the artifact is not a cold one.

## 3. Triage — before the user sees it

Merge first: the same artifact, ID and problem from two reviewers is one finding (note both). A finding only one
reviewer raised still counts. Then classify every Blocking and Important finding — you hold the context the reviewers
lack:

| Call | When | What you add |
|---|---|---|
| **Fix** | the finding is real | the exact edit: the artifact, the ID or heading, the new text |
| **Contest** | it is wrong | the evidence — the AC, design section, `decisions.md` entry, steering line or `file:line` that settles it; a contest without evidence is a fix |
| **Ask** | only the user can settle it (scope, a product choice, a number) | the question |

Minors: list them without a call unless the fix is one line. Read the code you cite as evidence; never quote it from
memory. Never contest a finding to make the review pass.

## 4. Present — one report, the user decides

Lead with the cold read's **Understood as**: when the restatement isn't what the user means, the artifact is ambiguous
whatever the findings say. Then the verdicts and one table — # · reviewer · severity · finding · your call · the edit
or the evidence. Past about ten rows, write the table to `.specs/<feature>/.execution/review-<artifact>.md` and give its
path with the counts — no `.execution/` yet? Create it with a `.gitignore` holding `*` first, so the review is never
committed.

Then ONE question:
- **Apply the fixes** — every Fix, the contested findings left as they are;
- **One by one** — each finding in turn: accept, skip or discuss; nothing is edited until every one is decided;
- **Leave it** — no change; the artifact goes to its gate as it is;
- or the user's own instruction.

The **Ask** findings come after it, one question at a time.

## 5. Apply, re-audit once, then the gate

- Apply the accepted edits, then `spec_doctor` again (`ears_validate` too on `requirements.md`).
- **One re-audit:** a fresh dispatch of each reviewer whose Blocking findings you fixed, over the edited artifact.
  Never a second one. What is still open after it goes to the user as it is: fixed by hand, accepted (a decision →
  `spec_decide`; an accepted risk → `design.md → Risks`) or ruled out of scope.
- Then the gate as always: present, the user's yes, `spec_approve`. The review never approves and never blocks: going
  ahead on a Revise verdict is the user's call (`force` stays for doctor's fails only).

`spec_upgrade`'s `review: "critic"` runs the critic in gate mode over each of its `reviewArtifacts`, the same triage
after it.
