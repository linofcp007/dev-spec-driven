# UI Design Patterns — design systems, states, accessibility, performance

A user interface fails in ways a unit test rarely sees: a list that shows a spinner forever when the request
fails, a form that forgets everything after one invalid field, a button a keyboard user can't reach, a label that
overflows in German, a hero image that loads last. None of these is exotic; each is a decision nobody wrote
down. This reference covers those decisions for any user-facing feature: working through the design system,
the states every view needs, forms, responsiveness and dark mode, accessibility to WCAG 2.2 AA and how to test
it, internationalisation, performance budgets, analytics events and visual tests.

It is the reference for the `+ui` track and for any feature that adds or changes a screen, a component or a
flow — web first, with the principles carrying over to native apps.

See also: [api-design-patterns.md](api-design-patterns.md) (the error bodies a UI turns into field messages,
pagination, long-running operations), [privacy-track.md](privacy-track.md) (analytics, consent, personal data
in the UI), [security-track.md](security-track.md) (never trust the client; secrets never in the bundle),
[observability-patterns.md](observability-patterns.md) (real-user monitoring, front-end errors, feature flags),
[code-reuse-and-quality.md](code-reuse-and-quality.md) (search before you build a component),
[test-patterns.md](test-patterns.md) (test layers; snapshot tests only with review),
[load-testing-patterns.md](load-testing-patterns.md) (the back end behind the screen).

---

## Where the decisions go in a spec

- **requirements.md** — the states and the accessibility rules are behaviour, so they are criteria:

  ```markdown
  1. **US-2.AC-1** — WHEN the order list request fails, THE SYSTEM SHALL show an error message with a Retry
     action and keep any orders already shown.
  2. **US-2.AC-2** — IF a submitted form has invalid fields, THEN THE SYSTEM SHALL keep every value the user
     entered, list the errors in a summary and move focus to it.
  3. **US-2.AC-3** — THE SYSTEM SHALL make every action on the checkout page operable with the keyboard alone,
     with a visible focus indicator.
  ```

- **design.md** — the component inventory (reused, extended, new), a **state matrix** per view, the form rules,
  breakpoints, the accessibility plan, i18n decisions and the performance budget.
- **Steering** — the design-system rules in a scoped `ui-components.md` (`dev-spec steering ui-components.md`,
  `inclusion: fileMatch` on the component folders), and the target level in `tech.md`'s Accessibility line
  (`WCAG 2.2 AA`) — see [steering-templates.md](steering-templates.md).
- **Tasks** — accessibility and visual checks are `_Verify:_` commands like any test; the manual keyboard and
  screen-reader passes are tasks of their own, with their findings in the report.

---

## The design system first

A design system is a contract between design and code: **tokens** (the values) and **components** (the
behaviour). A feature that bypasses it creates a fork every later change has to find.

**Tokens, in layers:**

| Layer | Example | Who uses it |
|---|---|---|
| Primitive | `--blue-600: #1d4ed8`, `--space-4: 16px` | only the semantic layer |
| Semantic | `--color-action-primary: var(--blue-600)`, `--space-inline-md: var(--space-4)` | components and pages |
| Component (optional) | `--button-primary-bg: var(--color-action-primary)` | one component |

- **Never a hard-coded colour, spacing, radius, font size, shadow or duration** in feature code. `#1d4ed8` or
  `margin: 13px` in a diff is a finding. A lint rule that rejects raw hex values and pixel literals outside the
  token files makes this mechanical.
- Pages and components use **semantic** tokens — that is what makes dark mode, theming and a rebrand a token
  change instead of a code search.
- **Components before markup.** Use the system's `Button`, `Dialog`, `TextField`: they carry focus handling, ARIA,
  states and tokens you would otherwise re-implement (and get wrong).

**When is a new component justified?**

| Situation | Do |
|---|---|
| An existing component fits | use it |
| It fits with one new visual option | add a **variant** to it (a documented prop), not a copy |
| It is a combination of existing ones | **compose** them in the feature; don't promote yet |
| No existing component can express it, and a second feature will need it | a **new system component** |
| Only this feature needs it | a **local** component in the feature folder — promote it on the third use (the rule of three, [code-reuse-and-quality.md](code-reuse-and-quality.md)) |

**How a component enters the system:** a short proposal (the need, the API — props, slots, events — and why
existing components can't do it) → review by whoever owns the system → built with tokens only, keyboard and
screen-reader support, every state (below) and both themes → documented with an example of each state (a story or
docs page) → visual and component tests → an owner. A component "detached" from the system and restyled in place
is a fork: flag it in review.

---

## The states every view needs

A view that only designs the happy path shows a blank page, a frozen spinner or a raw error the first time
something is slow or wrong. Design each state and write the matrix in design.md:

| State | When | What the user sees | Common mistake |
|---|---|---|---|
| **Loading** | first fetch | skeleton or indicator (below) | a spinner that never ends when the request fails |
| **Empty** — first use | nothing exists yet | what this is for + the primary action ("Create your first invoice") | a bare "No data" |
| **Empty** — no results | a filter or search matched nothing | what was searched + how to broaden it / clear filters | the same text as first use |
| **Error** — recoverable | a request failed | what happened in plain words + **Retry**; keep what was already shown | a toast that disappears while the list stays empty |
| **Partial** | one region failed, others loaded | the failed region shows its own error; the rest works | the whole page failing for one widget |
| **Offline** | no connection | an offline notice; queued or disabled actions; cached data marked as such | silent failures on submit |
| **Permission denied** | signed in, not allowed (403) | why and what to do (ask an admin) — not a 404 look-alike unless hiding existence is the point | a broken page |
| **Signed out / expired** | 401 | a sign-in prompt that returns the user to where they were, input kept | losing the draft |
| **Success** | an action completed | confirmation proportional to the action; the result visible | no feedback, so users click again |
| **Stale** | data may be out of date (cache, eventual consistency) | a timestamp or "updating…" | showing old data as current |

**Loading — pick by duration and certainty.** The classic response-time limits (Nielsen): about **0.1 s** feels
instant, about **1 s** keeps the user's flow, about **10 s** is the limit of attention.

| Technique | Use when | Trade-off |
|---|---|---|
| Nothing | the result arrives in well under a second | an indicator that flashes for 150 ms is noise — many teams delay any indicator by a few hundred milliseconds and, once shown, keep it long enough not to flicker |
| **Skeleton** | the layout is known (lists, cards, profiles) | feels faster and prevents layout shift; costs a skeleton per layout and lies if the real layout differs |
| **Spinner** | a short wait with an unknown shape (a button action, a small panel) | simple; says nothing about progress; put it where the result will appear, not over the whole page |
| **Progress bar** | long, measurable work (upload, export) — past about 10 s | needs real progress data; show what continues in the background |
| **Optimistic update** | the action almost always succeeds and is reversible (like, rename, reorder) | instant; you must roll back visibly and explain when the server says no |

Optimistic updates are wrong for payments, irreversible deletes and anything with a server-side validation that
often fails.

---

## Forms

- **A visible label for every field** — a placeholder is not a label (it disappears as you type and is often too faint
  to meet contrast). Mark required *or* optional fields, consistently.
- **Validation timing**: validate a field when the user **leaves it** (blur), not on every keystroke; once a field
  shows an error, re-validate it **as the user types** so the error disappears as soon as it's fixed. On submit,
  validate everything.
- **Error messages** say what's wrong and how to fix it ("Enter a date in the future", not "Invalid input"), sit
  next to the field, are text (not colour alone), and are tied to the field (`aria-describedby`,
  `aria-invalid="true"`). On submit with errors, show an **error summary** at the top linking to each field and
  move focus to it.
- **Never lose input.** An error — client-side, server-side, a timeout, an expired session — keeps every value
  entered. Server validation errors map back to their fields: a problem+json `errors[].pointer` (`#/email`)
  names the field ([api-design-patterns.md](api-design-patterns.md) → Error format).
- **Double submit**: disable the submit button (or show it busy) while the request is in flight **and** send an
  Idempotency-Key — the button stops the second click, the key stops the retried request.
- **Help the browser help the user**: the right `type` / `inputmode` (`email`, `tel`, `numeric`), `autocomplete`
  tokens for personal data (`email`, `given-name`, `postal-code`, `one-time-code`) — that is WCAG 1.3.5 — and
  never block paste or password managers (3.3.8 Accessible Authentication).
- Don't ask twice for what the user already gave in the same process (3.3.7 Redundant Entry); for legal,
  financial or data-deleting submissions, let the user review, confirm or undo (3.3.4 Error Prevention).

---

## Responsiveness

- **Mobile first, content-driven breakpoints**: add a breakpoint where the layout breaks, not per device model.
  Container queries let a component respond to its own space instead of the viewport.
- **Reflow**: content works at a width of **320 CSS pixels** without horizontal scrolling (WCAG 1.4.10), except
  content that needs two dimensions (maps, data tables, diagrams).
- **Zoom and text size**: usable at 200% text size (1.4.4) and with increased letter / line / paragraph spacing
  (1.4.12) — no fixed-height boxes around text.
- **Touch targets**: design for **44 × 44** (Apple's Human Interface Guidelines use 44 pt, Material 48 dp, WCAG's
  AAA criterion 2.5.5 44 × 44 CSS px); never go below **24 × 24 CSS px** — WCAG 2.2's AA minimum (2.5.8), which
  also accepts a smaller target with enough spacing around it.
- **No hover-only interactions**: touch has no hover. Anything revealed on hover or focus must be dismissible,
  hoverable and persistent (1.4.13).
- **Dragging has an alternative** — a single-pointer way to do the same (buttons to reorder, a menu to move) (2.5.7).
- Don't lock orientation unless it's essential (1.3.4).

## Dark mode through tokens

- Dark mode is a **second set of semantic token values**, never a second stylesheet of overrides. A component
  that only uses semantic tokens gets dark mode for free.
- Follow the system setting (`prefers-color-scheme`), offer an explicit override, persist the choice, and set the
  CSS `color-scheme` property so form controls and scrollbars match.
- **Check contrast in both themes** — a pair that passes on white often fails on dark grey. Avoid pure black
  backgrounds with pure white body text (glare); express elevation with lighter surfaces rather than shadows.
- Images and illustrations: provide dark variants or transparent backgrounds; charts need their own palette.
- Visual tests run in **both** themes.

---

## Accessibility — WCAG 2.2 AA

Target **WCAG 2.2 Level AA** unless steering says otherwise. The criteria that most often decide a feature:

| Area | Criterion (level) | What it asks |
|---|---|---|
| Structure | 1.3.1 Info and Relationships (A) | headings, lists, tables, labels in the markup, not only in the looks |
| | 2.4.1 Bypass Blocks (A) · 2.4.2 Page Titled (A) · 2.4.6 Headings and Labels (AA) | landmarks / skip link, a unique title per page, descriptive headings |
| | 3.1.1 Language of Page (A) | `<html lang="…">` (and `lang` on passages in another language) |
| Text alternatives | 1.1.1 Non-text Content (A) | `alt` that says what the image means; `alt=""` for decoration |
| Colour and contrast | 1.4.1 Use of Color (A) | never colour alone (errors, required fields, chart series, links in text) |
| | 1.4.3 Contrast (Minimum) (AA) | **4.5:1** for text; **3:1** for large text (at least 18 pt, or 14 pt bold) |
| | 1.4.11 Non-text Contrast (AA) | **3:1** for control boundaries, focus indicators, icons, chart elements |
| Keyboard and focus | 2.1.1 Keyboard (A) · 2.1.2 No Keyboard Trap (A) | everything works with the keyboard; focus can always leave |
| | 2.4.3 Focus Order (A) · 2.4.7 Focus Visible (AA) | a logical order; a visible indicator — never `outline: none` without a replacement |
| | 2.4.11 Focus Not Obscured (Minimum) (AA) — new in 2.2 | a sticky header or cookie banner never hides the focused element entirely |
| Pointer | 2.5.7 Dragging Movements (AA) · 2.5.8 Target Size (Minimum) (AA) — both new in 2.2 | a non-drag alternative; targets at least 24 × 24 CSS px |
| Names | 4.1.2 Name, Role, Value (A) · 2.5.3 Label in Name (A) | every control exposes a name and role; the visible label is part of the accessible name |
| Motion | 2.2.2 Pause, Stop, Hide (A) · 2.3.1 Three Flashes (A) | moving or auto-updating content can be paused; nothing flashes more than three times a second |
| Forms and errors | 3.3.1 Error Identification (A) · 3.3.2 Labels or Instructions (A) · 3.3.3 Error Suggestion (AA) | the Forms section above |
| | 3.3.7 Redundant Entry (A) · 3.3.8 Accessible Authentication (Minimum) (AA) — new in 2.2 | don't re-ask; no cognitive tests to sign in (allow paste and password managers) |
| Status | 4.1.3 Status Messages (AA) | "Saved", "3 results", "Upload failed" are announced without moving focus |
| Help | 3.2.6 Consistent Help (A) — new in 2.2 | help links / contact in the same place on every page |

WCAG 2.2 also removed 4.1.1 Parsing. **2.3.3 Animation from Interactions is AAA**, but honouring
`prefers-reduced-motion` costs little: disable parallax, large transitions and auto-playing motion when the user
asks for reduced motion.

**How to build it:**

- **Semantic HTML first.** A `<button>` is focusable, activates on Enter and Space, and announces itself; a
  `<div onclick>` is none of those. The first rule of ARIA (W3C): if a native element has the semantics and
  behaviour you need, use it. ARIA fixes what HTML can't express (tabs, comboboxes, live regions) — and a wrong
  ARIA role is worse than none.
- **Dialogs**: focus moves into the dialog on open, stays inside while it's modal, Escape closes it, and focus
  returns to the element that opened it.
- **Live regions** for status messages: `role="status"` (polite) for "Saved" and result counts, `role="alert"`
  only for what needs immediate attention. The region must exist in the DOM before the text changes.
- **Headings and landmarks**: one `<h1>`, no skipped levels for styling, `<main>`, `<nav>`, `<header>`,
  `<footer>` — screen-reader users navigate by them.
- **Names for icon buttons**: `<button aria-label="Delete invoice INV-114">` — "Delete" alone is ambiguous in a
  list of fifty.

### Testing accessibility

Automated checks find only part of the problems. In a 2017 test by the UK Government Digital Service, the best of
13 tools found 40% of 142 deliberate barriers; Deque's 2021 study of its own audit data reports its axe rules
covering 57% of issues by volume. Either way, the rest needs a person:

| Pass | How | Catches |
|---|---|---|
| **Automated** | axe-core in component and end-to-end tests; an accessibility lint for your framework | missing names and labels, contrast, invalid ARIA, duplicate IDs, missing `lang` |
| **Keyboard** | unplug the mouse: Tab through the flow, operate every control, open and close every dialog | traps, invisible focus, unreachable controls, illogical order, focus lost after an action |
| **Screen reader** | NVDA with Firefox or Chrome (Windows), VoiceOver with Safari (macOS / iOS), TalkBack (Android) — one per platform you ship | meaningless names, missing announcements, reading order, noisy decoration |
| **Zoom and reflow** | 200% text, 400% zoom at 1280 px (≈ 320 px), increased text spacing | clipped text, overlaps, horizontal scrolling |
| **Contrast and motion** | a contrast checker on each theme; the OS reduced-motion setting | failing pairs in dark mode, motion that ignores the setting |

The automated pass is a `_Verify:_`; the manual passes are tasks with a short scripted checklist, and their
findings go in the task report:

```markdown
- [ ] 7. [US2] Keyboard and screen-reader pass of the checkout flow (NVDA + Firefox, VoiceOver + Safari)
  - _Requirements: US-2.AC-3_
- [ ] 8. [US2] Automated accessibility checks on every checkout state
  - _Requirements: US-2.AC-3_
  - _Verify: npx playwright test tests/a11y/checkout.spec.ts_
```

---

## Internationalisation

- **Externalise every user-visible string** — including `alt`, `aria-label`, page titles, emails and error
  messages. Never build sentences by concatenation (`"You have " + n + " items"`): word order differs between
  languages.
- **Plurals and variants with ICU MessageFormat**:

  ```text
  {count, plural,
    =0    {No items in your cart}
    one   {# item in your cart}
    other {# items in your cart}}
  ```

  Languages have different plural categories (CLDR: `zero`, `one`, `two`, `few`, `many`, `other`): English uses
  `one` / `other`, Russian and Polish `one` / `few` / `many` / `other`, Arabic all six, Japanese only `other`. Use
  `select` for grammatical gender or other variants.
- **Right-to-left** (Arabic, Hebrew, Persian, Urdu): set `dir="rtl"` (or `dir="auto"` for user content), use CSS
  **logical properties** (`margin-inline-start`, `padding-block`, `inset-inline-end`) instead of left / right,
  mirror directional icons (back arrows, progress), not universal ones (a play button, a checkmark).
- **Text expansion**: translations are longer. The W3C's summary of IBM guidance: text over 70 characters grows to
  about 130% of the English length; strings up to 10 characters can reach 200–300%. No fixed widths on text
  containers; let buttons and labels wrap; test with **pseudo-localization** (accented, padded strings such as
  `[Ŝåvé çhåñĝéš ~~~~~]`) to find truncation and hard-coded text before translators do.
- **Locale-aware formatting** through the platform (`Intl.DateTimeFormat`, `Intl.NumberFormat`,
  `Intl.RelativeTimeFormat`, `Intl.ListFormat`, `Intl.Collator` for sorting): dates, numbers, currencies, lists.
  Store instants in UTC and display them in the user's time zone; never format a date by string surgery.
- Don't assume name or address shapes (one given name, a family name, a state, a postcode). Fonts must cover the
  scripts you ship.

---

## Performance budgets

**Core Web Vitals** — measured in the field at the **75th percentile** of page loads, mobile and desktop
separately:

| Metric | Measures | Good | Poor |
|---|---|---|---|
| **LCP** — Largest Contentful Paint | loading: when the main content is visible | ≤ 2.5 s | > 4 s |
| **INP** — Interaction to Next Paint | responsiveness to clicks, taps and key presses (replaced FID in 2024) | ≤ 200 ms | > 500 ms |
| **CLS** — Cumulative Layout Shift | visual stability | ≤ 0.1 | > 0.25 |

Lab tools (a local Lighthouse run, a throttled browser profile) find regressions before release; field data (a
real-user monitoring library reporting these metrics) tells you what users get. Budget both.

**Set budgets per route** and fail the local check when a change exceeds them: JavaScript (compressed bytes),
images, fonts, request count, and the three vitals in a lab run on a throttled mobile profile. The numbers are the
team's — write them in steering and enforce them with a size-check script as a `_Verify:_` or a project check
(`dev-spec init --check bundle-size="npm run size"`).

| To improve | Do |
|---|---|
| **LCP** | render the main content on the server or early; preload / `fetchpriority="high"` the LCP image and **never lazy-load it**; compress and size it; avoid render-blocking scripts and styles |
| **INP** | break long tasks (yield to the main thread), avoid re-rendering large trees on each keystroke, move heavy work off the main thread, give instant visual feedback before the slow part |
| **CLS** | `width` / `height` (or `aspect-ratio`) on images and video; reserve space for banners and late content; font fallbacks with matched metrics; never insert content above what the user is reading |
| **Images** | responsive `srcset` / `sizes`, modern formats (AVIF, WebP) with fallbacks, lazy-load below the fold |
| **Bundle** | split by route, tree-shake, audit every new dependency's size before adding it, don't ship polyfills modern browsers don't need |

## Perceived performance

- **Respond within about 0.1 s** to every interaction — a pressed state, a spinner in the button — even when the
  work takes longer.
- **Keep the old content** on screen while the next page loads, instead of a blank page.
- **Skeletons and progressive rendering** (stream the shell, fill regions as data arrives) beat one late,
  complete page.
- **Prefetch on intent** (hover, focus, a link entering the viewport) for the likely next page — within the
  budget and never for heavy resources on metered connections.
- **Optimistic UI** for reliable, reversible actions (the table above).

---

## Analytics events

- **One naming convention**, written in steering — for example `object_action` in the past tense, snake_case:
  `checkout_started`, `invoice_downloaded`, `plan_upgraded`. Consistent names are what make events queryable a
  year later.
- **An event catalogue** (a file in the repository): name, when it fires, properties with types, owner, the
  question it answers. An event nobody can name a question for shouldn't exist.
- **Events are a contract**: renaming one breaks every dashboard built on it — add a new event and retire the old,
  as with API fields ([api-design-patterns.md](api-design-patterns.md) → Compatibility rules).
- **No personal data in event properties**: no emails, names, free-text input, full URLs with query strings that
  carry tokens or search terms; a pseudonymous user ID only if the purpose needs it. Non-essential tracking needs
  the user's consent where the law requires it — the lawful basis, the consent mechanism and the retention are
  [privacy-track.md](privacy-track.md) decisions, recorded in the spec.
- **Test that events fire** with the right properties (a component or end-to-end test asserting the call), and
  delete events that no longer answer a question.

---

## Visual regression and component tests

- **Component tests query like a user**: by role and accessible name (`getByRole("button", { name: "Pay now" })`),
  not by CSS class or test ID — they break on real regressions and double as a check that names exist.
- **Every state is a fixture**: a story or test case per state of the matrix above (loading, empty, error,
  partial…), so none is only reachable by breaking the network.
- **Visual snapshots** for the system's components and key screens, in both themes, at the key breakpoints and in
  one RTL locale. Render them in a pinned environment (a container image with fixed fonts) — the same screenshot
  differs across operating systems and font versions, and a flaky visual suite gets ignored.
- **A human reviews every snapshot diff**; updating snapshots in bulk to make the run green defeats them
  ([test-patterns.md](test-patterns.md) → anti-patterns).
- Don't snapshot everything: snapshots of whole pages with live data fail on every content change and hide real
  regressions in the noise.

---

## Design checklist

Before the design gate, the design names:

1. **Components** — each one reused, extended (a new variant) or new, and why; a new system component's API and
   owner; tokens only, no hard-coded values.
2. **The state matrix** — loading (and which technique), empty (first use and no results), error, partial,
   offline, permission denied, signed out, success, stale — per view.
3. **Forms** — labels, validation timing, messages, the error summary and focus, input kept on every error,
   server errors mapped to fields, double-submit prevention, `autocomplete` tokens.
4. **Layout** — breakpoints, reflow at 320 CSS px, 200% text, touch targets (44 × 44 designed, never under 24 × 24),
   no hover-only or drag-only interactions.
5. **Themes** — semantic tokens for light and dark, the system setting followed, contrast checked in both.
6. **Accessibility** — WCAG 2.2 AA; native elements first; keyboard order and visible focus; names; contrast
   4.5:1 / 3:1; live regions for status messages; dialogs' focus handling; reduced motion.
7. **Accessibility tests** — the automated `_Verify:_`, plus keyboard, screen-reader, zoom and contrast passes as
   tasks.
8. **i18n** — every string externalised, ICU plurals, RTL with logical properties, room for expansion, a
   pseudo-locale run, locale-aware dates, numbers and currencies.
9. **Performance** — the route's budgets (JS, images, fonts, requests) and the Core Web Vitals targets (LCP ≤ 2.5 s,
   INP ≤ 200 ms, CLS ≤ 0.1 at p75), how they're checked locally, the LCP element and how it loads.
10. **Perceived performance** — feedback within 0.1 s, optimistic updates only where reversible.
11. **Analytics** — the events added (catalogue entries), no personal data, consent (with `+privacy`).
12. **Tests** — component tests by role and name, a fixture per state, visual snapshots (themes, breakpoints, RTL)
    in a pinned environment, reviewed by a person.
