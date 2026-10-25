# The visual review — what a task renders, against the design's reference

A +ui task can pass its tests and still look wrong. The visual review compares what the task built with the design's
reference, state by state, through a reviewer that sees only the images — never the code. Adapted from the UI review
gate of Shopify's Helix (shopify.engineering/helix): a model lists every difference it sees with a severity and a place
on screen; pixel diffs don't work across renderers, and specifying every visual detail up front works worse than a
reviewer who sees, locates and reports.

It complements the visual regression snapshots (`references/ui-design-patterns.md` → Visual regression): a snapshot
says the screen didn't change since last time; this review says it matches what the design asked for.

## When

- **Subagent execution:** the brief says `uiReview: true` — a +ui feature at size m / l or no size, for a task that
  proves a `[UI]` criterion, sits in the track's task block or names a view file in `_Implements:_` (markup, a
  component, a stylesheet, a server template, an Android layout). Never at xs / s, on a spike, on a +ai prompt task, on
  a red `_Expect: fail_` task (it renders nothing yet) or on a done task.
- **Inline execution:** the same tasks, before you tick them.
- **Order:** after the task's `_Verify:_` is green (behaviour first — a screen that doesn't work is not worth a look),
  before the code review. A task whose diff changes nothing the user sees (a test-only task, an accessibility check)
  skips it: ledger `Task N: ui review — skipped (nothing rendered changed)`.

## 1. The reference

`design.md` → `[UI] UI States` names the reference of each view: a design export (an image per state where they differ)
or an HTML prototype the user approved — its path. A prototype is captured like the build (step 2). The reference is
part of the approved design: the implementer never edits it, and changing it is a design change, back to the design
with the user (`references/subagent-execution.md` → Where autonomy stops, 2).

**No reference → no review:** ledger `Task N: ui review — skipped (no reference)` and say so at the checkpoint. It is
never "passed". At the next design change, offer to add one — an approved HTML prototype is often the cheapest.

## 2. Capture — the same state, the same settings

Capture the views and states this task built — its criteria and the rows of the state matrix it implements — never
the whole app.
- **With the project's own tooling first:** its end-to-end setup (Playwright, Cypress), the Storybook story of each
  state (`ui-design-patterns.md` asks for a fixture per state), a simulator screenshot on mobile. Otherwise a command
  that writes the PNG to its path: headless Chrome or Edge (`chrome --headless=new --hide-scrollbars
  --window-size=1280,720 --screenshot=<file> <url>`), or `npx playwright screenshot` when the project has Playwright. A
  browser tool that only shows you the screen doesn't do: the reviewer needs the files, and you must not look.
- **Both sides alike:** the same viewport and device scale, theme, locale and data; animations finished, the loading
  over (unless the state IS loading).
- **Every capture takes both sides fresh:** the build from the running app, the reference from the path `design.md`
  names — never an earlier `--ref.png` copy.
- **Files:** `.specs/<feature>/.execution/ui/task-N/<view>--<state>--ref.png` and `--build.png`. No `.execution/` yet?
  Create it with a `.gitignore` holding `*` first.
- Capturing is mechanical — a script, no judgment. Don't open the images yourself: they would fill your context.
- **No way to capture** (no headless browser, no script, no running app): ledger `Task N: ui review — skipped (no
  capture tool)` and say so at the checkpoint. Never "passed".

## 3. Dispatch — the images only

**`dev-spec-driven:spec-ui-reviewer`** (it declares `omitClaudeMd: true`) with: the pairs (paths, view, state,
viewport, theme, locale), the task's scope in one line, the `design.md` path and `.specs/steering/ui.md` when it exists.
Never the code, the diff, the brief or your view of it. Size l: two independent reviewers in one message; a difference
both of them report counts at once, and one that only one of them reports is confirmed first (§4).

## 4. The verdict

- **INVALID** (the two images show different states) → capture both again in the same state; after two failed
  recaptures, ask the user.
- **Blocker** → the task's fix loop (`references/subagent-execution.md` → 7): resume the implementer with the
  differences verbatim and the pair paths — it may open the images. The rounds count toward the task's 5. An
  implementer that disputes a difference: recapture, and a fresh reviewer decides.
- **A Major only one reviewer reported** (at size m or no size, every Major; at size l, any difference only one of the
  two saw) → confirm it first: a fresh reviewer on that pair alone. Confirmed → the fix loop; not confirmed → ledger it
  as a minor. One look at pictures never costs a round on an arguable difference.
- **Minor** → ledger `Task N: ui minor (deferred): <one line>`; the final review triages them.
- **Match**, nothing open → the task goes on to its code review.
- Keep the reviewer's reply in `.specs/<feature>/.execution/task-N-ui-review.md` (the evidence the checkpoint shows).

**The reference stays as approved.** Before every capture and before the tick, run `git diff --stat BASE` (the task's
BASE: what was committed since, and what isn't yet): a file `design.md → [UI] UI States` names in it is refused —
revert it and send the round back. A reference that looks wrong is the user's call (§1), never the implementer's. A
reference outside the repository can't be checked this way: say so at the checkpoint.

## 5. After a fix — run it again

A later fix round of this task — a visual one or a code-review one — whose diff changes what a reviewed view renders:
capture the pairs it changed again and dispatch a fresh reviewer. The task is ticked only with no Blocker or Major
open — after round 5, a visual finding is parked only on a fresh `spec-ui-reviewer`'s verdict, never on your own
(you don't look at the images).

## 6. At the checkpoint

Show, per task: match · differences fixed (how many rounds) · skipped and why. The reviewer is a model looking at
pictures: it misses some differences and invents a few. The user's look at the running screens is the last word — the
fourth gate.

Ledger lines:

```
Task 5: ui review — 3 pairs: 2 match, 1 differences (1 blocker) → fix round 1/5
Task 5: ui review — invalid (orders--empty: the build still loading) → recaptured
Task 6: ui review — skipped (no reference)
```
