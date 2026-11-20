# The visual review — what a task renders, against the design's reference

A +ui task can pass its tests and still look wrong. The visual review compares what the task built with the design's
reference, state by state, through a reviewer that sees only the images — never the code; without a reference it checks
the **floor** (§2). Adapted from the UI review gate of Shopify's Helix (shopify.engineering/helix): pixel diffs fail
across renderers; a reviewer who sees, locates and reports doesn't.

## When

- **Subagent execution:** the brief says `uiReview: true` — a +ui feature at size m / l or no size, for a task that
  proves a `[UI]` criterion, sits in the track's task block or names a view file in `_Implements:_`. Never at xs / s, on a
  spike, a +ai prompt task, a red `_Expect: fail_` task or a done task.
- **Inline execution:** the same tasks, before you tick them.
- **Order:** after the task's `_Verify:_` is green, before the code review. A task whose diff changes nothing the user
  sees skips it: ledger `Task N: ui review — skipped (nothing rendered changed)`.

## 1. The reference

`design.md` → `[UI] UI States` names the reference of each view: a design export (an image per state where they differ)
or an HTML prototype the user approved — its path. A prototype is captured like the build. The reference is part of
the approved design: the implementer never edits it; changing it is a design change, back to the user
(`subagent-execution.md` → Where autonomy stops, 2).

**No reference → the floor alone** (§2): ledger `Task N: ui review — floor only (no reference)` and say at the
checkpoint that the look was never compared with a design. It is never "passed". Offer to add one at the next design
change.

## 2. Capture — the same state, the same settings

Capture the views and states this task built, never the whole app.
- **The project's own tooling first** (Playwright, Cypress, a Storybook story per state, a simulator on mobile), else a
  command that writes the PNG: headless Chrome or Edge (`chrome --headless=new --hide-scrollbars
  --window-size=1280,720 --screenshot=<file> <url>`). A browser tool that only shows you the screen doesn't do: the
  reviewer needs the files, and you must not look.
- **Both sides alike:** the same viewport and device scale, theme, locale and data; animations finished, the loading
  over (unless the state IS loading). Both fresh: the reference from the path `design.md` names — never an earlier
  `--ref.png` copy.
- **The worst case** (the state matrix's row of extremes) is a state of its own: `<view>--worst--build.png`, its data
  put in through the boundary the other states use (a story, a mock, a fixture route) — never by editing the markup;
  none: `not captured (no data boundary)`.
- **Files:** `.specs/<feature>/.execution/ui/task-N/<view>--<state>--ref.png`, `--build.png`, `--floor-320.png`… (a new
  `.execution/` gets a `.gitignore` holding `*` first).
- **The kept script:** keep the capture script at `.execution/ui/capture.<ext>` — every round and the verdict pass take
  the same settings with it; before it retakes a capture it renames the old one `<name>.prev.png`. It waits for the
  fonts (`document.fonts.ready`) and the images before each shot; one viewport per image. Don't open the images
  yourself.
- **No way to capture** (no headless browser, no script, no running app): ledger `Task N: ui review — skipped (no
  capture tool)` and say so at the checkpoint. Never "passed".

**The floor** — for every build capture with no reference beside it, three measured captures, taken by a tool that
sets the viewport and records the width it got (Playwright's `viewport`, Puppeteer's `setViewport`) — never the Chrome
command line (it lays a 320-px window out ~489 px wide). Beside each, `<name>.json`: the document's `scrollWidth`,
`clientWidth` and the width got. A measured width other than the one asked makes the capture INVALID.

| Kind | Settings | WCAG 2.2 |
|---|---|---|
| `floor-320` | 320 CSS px wide, device scale 2 | 1.4.10 Reflow |
| `floor-zoom` | 640 × 360 CSS px, scale 2 — a 1280 × 720 window at 200 % | 1.4.4 Resize Text |
| `floor-focus` | the review viewport, Tab pressed until focus is inside the task's region (50 at most) — keys only, never a click or a script's `focus()` | 2.4.7, 2.4.11 |

`floor-spacing` (1.5 line height, 2em paragraphs, .12em letters, .16em words — 1.4.12) only where the script can add a
style. Its state: the worst case if built, else the first loaded one. On mobile: the smallest supported width and the OS
text size closest to 200 % (iOS AX2, Android scale 2.0); Android's pseudo-locales only where the build enables them.
A capture the tool can't take is listed under Not judged and ledgered — never clean.

## 3. Dispatch — the images only

**`dev-spec-driven:spec-ui-reviewer`** (it declares `omitClaudeMd: true`) with: the captures (paths, view, state,
viewport, theme, locale — say when the locale is a pseudo-locale), the task's scope in one line, the `design.md` path
and `.specs/steering/ui.md` when it exists. Never the code, the diff, the brief or your view of it. **Pair or floor is a
property of the files:** a `--build.png` with its `--ref.png` beside it is a pair; every other build capture, and every
`floor-*` one, is judged on the floor. At most 16 images a dispatch, the `.prev.png` counted. Size l: two independent
reviewers in one message; a difference both report counts at once, one only one reports is confirmed first (§4).

## 4. The verdict

- **INVALID** (the two images show different states) → capture both again in the same state; after two failed
  recaptures, ask the user.
- **Blocker** (at size l: one both reviewers report) → the task's fix loop (`references/subagent-execution.md` → 7):
  resume the implementer with the differences verbatim and the capture paths — it may open the images. An
  implementer that disputes one: recapture, and a fresh reviewer decides.
- **A Major at size m or no size, and at size l any difference only one of the two reported** → confirm it first: a
  fresh reviewer on that capture alone. Confirmed → the fix loop; not confirmed → a minor.
- **Minor** → ledger `Task N: ui minor (deferred): <one line>`; the final review triages them.
- **Match** / **Clean**, nothing open → on to the code review. Keep the reply in
  `.execution/task-N-ui-review.md`.

**On the floor**, four findings: **reflow** (from the `.json` only: the page wider than the window; none → not judged),
**lost** (content cut, covered or unreadable), **focus** (none visible, or hidden), **defect** (a value never resolved
or formatted, a broken image). Each is a **Major** by default — confirmed first, as above; only a measured reflow is a
Blocker. Not findings: a data table, a map, a diagram, a toolbar — scrolling inside its own box (WCAG 1.4.10's
exception: a box that scrolls inside the page is not the page scrolling); truncation, unless the design's row says the
field wraps. **Below a minimum width the design or `ui.md` states**: one checkpoint line per feature, never a fix
round, never a stop. A floor finding carried into the ledger or a report is written as an accessibility finding
(`ui-design-patterns.md` → Testing accessibility).

**The reference stays as approved.** Before every capture and before the tick, run `git diff --stat BASE` — BASE as
recorded for the task (inline: the commit the task started from). A reference file (one `design.md → [UI] UI States`
names) in it is refused — revert it and send the round back. A reference that looks wrong is the user's call
(§1). A reference outside the repository or not tracked by git can't be checked this way: say so at the checkpoint.

## 5. After a fix — run it again

A later fix round (visual or code review) whose diff changes what a reviewed view renders: take the captures it
changed again and dispatch a fresh reviewer **in verdict mode** (`Mode: verdict` on the prompt's first
line) with the open findings, numbered `U1…` by you: each is RESOLVED, PARTIAL or OPEN, and a regression counts only in
a region that changed since the last capture — a fix round never opens a new hunt. Its rules:
1. One reviewer, at size l too.
2. A PARTIAL is graded again for what remains, and stays open.
3. A confirmed finding is not reconfirmed.
4. A regression Major goes through the confirmation step (§4); a regression Blocker enters the loop.
5. A finding missed earlier keeps its severity: `Task N: ui deferred (missed earlier, <severity>): …`, shown at the
   checkpoint — never a round of its own.
6. After a code-review round: an empty open list — regressions only.
7. The Breaker (`references/subagent-execution.md` → 7) uses verdict mode.

A **full** review instead when the diff renders a view or state no review saw, the reference changed with the user, or
the user's screenshot contradicts a verdict. Tick only with no Blocker or Major open (one parked with a ruling after
round 5 is not open) — on a fresh reviewer's word, never your own look. The verdict pass follows Impeccable's finish
reviewer (Apache-2.0): after a fix it scores what was found; it doesn't hunt again.

## 6. At the checkpoint

Show, per task: match · differences fixed (how many rounds) · floor only · skipped and why. The user's look at the
running screens is the last word — the fourth gate. A correction there that another view would repeat is a taste:
propose it for `.specs/steering/ui.md` → `## Taste` (`references/review-feedback.md` → A UI taste).

```
Task 5: ui review — 3 pairs: 2 match, 1 differences (1 blocker) → fix round 1/5
Task 5: ui re-review (round 1) — U1 resolved, U2 partial; 0 regressions → fix round 2/5
Task 6: ui review — floor only (no reference): 1 view, 3 captures — 1 major → confirmed → fix round 1/5
Task 6: ui deferred (missed earlier, minor): <one line>
```
