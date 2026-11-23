# Responsive design — breakpoints, reflow, zoom and touch

Read it when a +ui design writes `[UI] Responsiveness & i18n`. The rest of a view's design — the design system, the
states, forms, accessibility — is in [ui-design-patterns.md](ui-design-patterns.md).

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

## The project's breakpoints

The design says, per view, what changes at each of the project's breakpoints — columns, navigation, what moves or
hides. The visual review captures each view's worst case at the same widths ([ui-review.md](ui-review.md) → 2). They come
from the first of these that gives a width of 320 px or more:

1. `.specs/steering/ui.md`'s first `- Breakpoints:` line outside code and comments — the lengths before its first ` · `
   that no length follows (`320 · 390 · 768 px`, as `dev-spec design-system` prints them, is one list; ` · text
   expansion` ends it — a note after the widths starts with a word, ` · max width 1200 px`, and a name before a width
   ends the list: write `640 (sm) · 768 (md)`, not `sm 640 · md 768` (640 alone); px, or rem / em at 16 px; a bare
   number takes the unit written after it, `360 / 768 / 1280 px`; `1,440` is one width), its first 200 characters;
   the stub's own `[…]` slot is never read, so an untouched stub falls through — your widths written inside its
   brackets are, and any other bracket is an aside, never a width (`480 / 960 px [1200 in print]` is 480 and 960);
2. a top-level Tailwind 4 `@theme` block's `--breakpoint-*` in a stylesheet the code scan reads (unless the sheets reset
   them — `--breakpoint-*: initial` or `--*: initial` —, Tailwind keeps its own five too, which are not read: the default
   set fills the places the theme's widths leave — list them all in ui.md to choose), and a top-level Sass map whose
   name ends in `breakpoints` (`$grid-breakpoints`, `$breakpoints`, an override in `@use … with (…)`) in a .scss sheet
   the scan reads — a plain assignment over a `!default` one;
3. the default set: 320 · 390 · 768 · 1024 · 1440 px.

At most six widths, 320 first (the reflow width) — past six, the narrowest five and the widest, the rest said; where
the default set fills a theme's places, it comes in the order 768, 1024, 1440, 390, and only where room is left — list
the widths in ui.md's line to choose them.
`dev-spec design-system <feature>` prints them and where they came from (without a feature too, and
`spec_scan {designSystem: true}` in both shapes), and lists a value it could not read (`calc()`, `var()`, wider than
3840 px, `map-merge(…)`) with its place — write the widths in ui.md's line then. A map of maps (Bulma's
`"mobile": ("until": $tablet)`, a hand-written `'small': (min-width: 767px)`) is neither read nor listed: paste its
widths into ui.md's line. Two `!default` maps of one name (a library copy beside your own) both count: list the widths
in ui.md's line to choose them. A framework's own defaults (in its package), Tailwind 3's `screens` (a JS config) and a
map in a file the scan does not open by name (`_config.scss`, `_settings.scss`) are never read: paste the line into
ui.md instead, keeping the rest of it (`- Breakpoints: 640 / 768 / … px · text expansion …`):
- Tailwind's defaults: `- Breakpoints: 640 / 768 / 1024 / 1280 / 1536 px`
- Bootstrap 5: `- Breakpoints: 576 / 768 / 992 / 1200 / 1400 px`

ui.md is the steering a +ui design is approved under: editing the line makes doctor warn
`steering-changed-since-approval` on approved designs — on purpose, since each says what its views change at those widths.

## Layouts that need fewer breakpoints

- **Container queries** — a component answers to its own width, not the window's: `container-type: inline-size` on
  the wrapper, `@container (min-width: 30rem)` in the component; the same card then fits a sidebar and a main column.
- **Intrinsic grids** — `grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr))` holds as many columns
  as fit, one at 320 px, with no media query; the `min(100%, …)` keeps a column from overflowing a narrower box.
- **Wrapping rows** — `flex-wrap: wrap` and a `flex-basis` for toolbars, tags and button groups.

A breakpoint is then left for what really changes: the navigation, a side panel, the number of panes.

## Fluid type and space

- A fluid size is a **token** with a rem term: `--text-3xl: clamp(1.75rem, 1.2rem + 2vw, 2.5rem)`. The rem part grows
  when the user zooms or sets a larger font; viewport units alone don't — WCAG 1.4.4, failure F94, the UI check
  `font-size-viewport` ([ui-code-scan.md](ui-code-scan.md)).
- Keep the largest size at most **2.5 ×** the smallest: the browser's zoom can then still double the text at any window
  width (Maxwell Barvian, Smashing Magazine, 2023).
- Space can scale the same way; borders and hairlines stay in px.

## Which unit for what

| For | Unit | Why |
|---|---|---|
| Text, and the space that grows with it | `rem` (`em` inside a component) | follows the user's font size and zoom |
| Layout widths, columns, the gaps between panes | `%`, `fr`, `min()` / `max()` / `clamp()` | follows the container |
| A full-screen section | `dvh` / `svh` (below) | follows the viewport |
| Borders, hairlines, shadows | `px` | stays crisp |

A convention, not a WCAG rule: px-only text still zooms in every current browser — it only ignores the user's default
font size. Write the team's choice in `design-system.md`'s units table, which the code scan compares the code with
([ui-code-scan.md](ui-code-scan.md)).

## Viewport units

- **`100vw` counts the classic scrollbar** (Windows, most Linux desktops, macOS set to always show scrollbars): an
  in-flow box at `width: 100vw` is a scrollbar wider than the page — a sideways scroll. Use `100%` there. A fixed overlay
  (`position: fixed; inset: 0`) or a decoration its parent clips is fine, so no check flags `100vw` — and the visual
  review's captures hide scrollbars (`--hide-scrollbars`, Playwright's headless default), so nothing measures it: check an
  in-flow `100vw` box yourself at a desktop size, scrollbars shown. Chrome 145 subtracts the scrollbar from `vw` only
  where the root reserves its room (`scrollbar-gutter: stable`, `overflow-y: scroll`) — Bramus Van Damme, bram.us, 2026.
- **`100vh` on a phone is the tallest viewport**, its toolbars hidden: a `height: 100vh` box's bottom sits under them
  while they show. `svh` is the smallest viewport, `dvh` follows the toolbars (relaid out as they move), `lvh` the
  largest. A full-height app shell: `height: 100vh; height: 100dvh;` (the second line where it is understood); a hero
  whose bottom must show: `svh`. `min-height: 100vh` only lets a box grow — harmless unless something is pinned to its
  bottom.

## Touch targets and pointers

- 2.5.8 (AA) accepts a target under 24 × 24 CSS px when a 24-px circle centred on it touches no other target and no
  other small target's circle — and exempts a control whose function another one on the page offers at full size, a
  link inside a sentence, a size the browser sets and a size that is essential.
- `@media (pointer: coarse)` — a finger is the main pointer: larger targets and gaps. `@media (hover: hover)` — hover
  effects only where the main pointer hovers; `any-pointer` / `any-hover` when any input can (a laptop with a
  touchscreen). Never an action that only hover reaches.

## Safe areas

On a phone with a notch or a home indicator, `viewport-fit=cover` in the viewport meta draws the page edge to edge; then
pad fixed bars and full-bleed edges with `env(safe-area-inset-*)`, never under the usual padding:
`padding-bottom: max(1rem, env(safe-area-inset-bottom))`. Never `maximum-scale=1` or `user-scalable=no` in that meta:
they block zoom (1.4.4 — the UI check `zoom-disabled`).

## Images and media

`srcset` with the widths you have and `sizes` that says the layout (`sizes="(min-width: 64rem) 33vw, 100vw"`),
`<picture>` where a layout wants another crop, `width` / `height` or `aspect-ratio` so nothing shifts as it loads, and
`max-width: 100%` to keep an image inside its column; video and embeds take `aspect-ratio` too.

## Tables at small widths

A data table may scroll sideways inside its own box — 1.4.10 excepts content that needs two dimensions, not what is
around it: the heading, the search and the pagination still reflow. Make the box reachable:
`<div role="region" aria-labelledby="orders-title" tabindex="0">` with `overflow-x: auto`, so a keyboard user can scroll
it. Or stack the rows — each a card with its column names — when users read one record at a time. Never hide a column
silently at a width: say it is hidden and how to show it.

## Orientation

Never lock the page to portrait or landscape (1.3.4, AA — failure F97), and never ask the user to rotate the device
(F100), unless one orientation is essential (W3C's examples: a bank check, a piano application, slides for a
projector). The locks to look for: a web app manifest's `orientation`, `screen.orientation.lock()`.

## Zoom and text size

400 % zoom of a 1280-px window lays the page out at 320 CSS px: the reflow width is what a desktop user who zooms gets,
not only a phone (1.4.10's note). Text at 200 % (1.4.4) comes through zoom or the browser's font size — rem / em follow
both. Text spacing raised to a 1.5 line height, paragraphs 2 × the font size apart, letters 0.12em and words 0.16em
(1.4.12) clips nothing: no fixed height on a box that holds text.

## Inputs on a touch screen

The right `type` (`email`, `tel`, `url`; `number` only for quantities) and `inputmode` (`numeric`, `decimal`) bring the
right keyboard, `autocomplete` fills the field (1.3.5) and `enterkeyhint` (`search`, `send`, `next`) names the Enter key.
Inputs take a font of at least 16 px: iOS Safari zooms into a smaller one on focus — never cured with `maximum-scale=1`.

## Checking it

The visual review captures each view's worst case at every width above, measured, and its other states at one
([ui-review.md](ui-review.md) → 2). On mobile: the smallest supported width and the OS text size closest to 200 % (iOS AX2,
Android scale 2.0); Android's pseudo-locales only where the build enables them.

After Vercel's Web Interface Guidelines (MIT) for the 16-px inputs, the safe areas and the target sizes.
