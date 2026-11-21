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
