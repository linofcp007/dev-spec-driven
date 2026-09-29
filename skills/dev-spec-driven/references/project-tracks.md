# Project-defined tracks (track packs)

Read on demand from `SKILL.md`. Seven tracks are built in — core, +tdd, +saas, +ai, +sec, +privacy, +dist. A team that needs
its own domain rigor (+a11y, +mobile, +dbmigration, +compliance…) defines it as a **track pack**: a folder in
`.specs/tracks/<name>/`. A valid pack behaves like a built-in *marker* track (+sec, +privacy) everywhere — it is
classified, scaffolded, gated, traced, briefed, exported and removed the same way. Manage packs with `/spec-tracks`
(MCP `spec_tracks`, CLI `dev-spec tracks [list|init <name>|check]`).

## The folder

```
.specs/tracks/a11y/
├── track.json          # required — the definition (JSON; // and /* */ comments allowed)
├── requirements.md     # optional — the criteria every +a11y feature starts with
├── tasks.md            # optional — the task block
├── test-plan.md        # optional — the planned test rows (+tdd features)
├── checklist.md        # optional — checklist items
├── steering.md         # optional — the steering file's stub
└── pt/  es/  en/  pt-BR/   # optional — the same fragments in a language (win over the root ones)
```

Only these names are read. A `<lang>/` fragment wins over the root one for features in that language; a pt-BR
feature reads `pt-BR/`, then `pt/`, then the root (the project-template rule). Anything else in the folder is listed
by `check` and ignored. `dev-spec tracks init a11y` scaffolds all of it, commented, never overwriting a file.

## track.json

| Key | Rule |
|---|---|
| `name` | The folder name: `^[a-z][a-z0-9]{1,19}$`. Never a built-in track (core tdd saas ai sec privacy dist), a word people type for one (`security`, `gdpr`, `test`…), one of `none all any track tracks pack packs list init check`, a Windows device name or an `Object.prototype` key. |
| `marker` | `^[A-Z][A-Z0-9]{1,11}$` (`"A11Y"` or `"[A11Y]"`). The stable, **case-sensitive** token of the pack's headings — `[A11Y]`. Never a built-in marker (SaaS / AI / SEC / PRIVACY / DIST), a story / parallel tag (`US1`, `P1`, `SHARED`), a generic slot (`TODO`, `TBD`, `FIXME`…) or an ID prefix (`AC1`, `T2`…); unique across packs — two packs with one marker: the first by name keeps it, the other is refused. |
| `title` | `{ "en": "…", "pt"?: "…", "es"?: "…", "pt-BR"?: "…" }` (a plain string = its English). 2–80 characters, one line, no `[ ] < >` or backtick. Shown in the headings. |
| `description` | Optional, one line, ≤ 300 characters (listed by `list`). |
| `signals` | Optional `{ "strong"?: [...], "weak"?: [...], "context"?: [...] }` — classifier keywords, ≤ 50 per tier, 2–60 characters of letters / digits with inner spaces, `-`, `'`, `.`. |
| `sections` | 1–20 mandatory design sections: `{ "name": "…" or {en, pt?, es?}, "syn"?: [...], "loose"?: [...], "guidance"?: "…" or {en, pt?, es?} }`. Names are unique; `syn` are other headings that count (any language, ≤ 20); `guidance` is one line (≤ 600 characters) written under the `> **TODO**` sentinel — its `{{title}}` / `{{marker}}` / `{{name}}` / `{{slug}}` are filled in. **Every pack section is marker-bound:** a heading counts only when it carries the pack's marker (`## [A11Y] Contrast`) or sits under one that does (`## [A11Y] Visuals` → `### Contrast`) — so a section named like a core design heading (`Architecture`, `Testing Strategy`…) is never satisfied by the core section (`check` warns `section-core-name`). `loose` is accepted for symmetry with the built-in tables; for a pack every synonym already behaves as one. A name's lead — numbering (`2 `, `1.2 `), `Section 3`, an emoji, a dash — is ignored when matching, exactly as in the heading (`check` warns `section-name-lead`); nothing left after it is an error. |
| `steering` | Optional — the steering file the track brings (`a11y.md`: lower-case, digits, `-`, `.md`). |

Unknown keys are warnings (ignored). **A pack with any error is ignored as a whole — never half-applied.**

## Fragments

Plain markdown; HTML comments and fenced code are ignored.

- **requirements.md** — one top-level list item = one criterion, in EARS (a leading `**US-1.AC-3** —` is dropped). The
  engine numbers them after the feature's US-1 criteria (`US-1.AC-5`, `US-1.AC-6`…) under
  `#### [A11Y] Accessibility — Acceptance Criteria (EARS)`, right after the US-1 criteria. None → one generic slot.
- **tasks.md** — one top-level item = one task of the block `## Story US-1 — [A11Y] Accessibility` (numbered after the
  feature's last task); indented lines (`  - _Requirements: {{ac1}}_`, `  - _Verify: …_`) stay with it. A task without
  `_Requirements:_` cites all the pack's criteria.
- **test-plan.md** — table rows with the built-in plan's six cells (`Test ID | Layer | Kind | Description | Covers | File`);
  the Test ID is renumbered after the plan's own, under `## [A11Y] Traceability Matrix`. None → one row per criterion.
- **checklist.md** — items, written as `- [ ] A11Y: …` in the feature's checklist.md (`{{acN}}` resolves there too).
- **steering.md** — the stub of the pack's `steering` file.

Variables: `{{ac1}}`, `{{ac2}}`… = the pack's criteria as the feature numbers them, `{{acs}}` = all of them;
`{{t1}}`… / `{{tests}}` = their planned tests (a line naming none — a feature without +tdd — is left out); `{{title}}`,
`{{marker}}`, and the feature's `{{name}}` / `{{slug}}`. `{{ac3}}` with two criteria is an error (`fragment-ref`) — judged
per language context: a root `tasks.md` read by pt features counts `pt/requirements.md`'s criteria, and the message names
both. `[Bracketed]` slots are template placeholders until a feature fills them (the gates refuse them like any template
text) — also when they hold a variable: `[the {{name}} screens]` still reads as a slot once it became
`[the Login screens]` (a linear wildcard over at least 3 literal characters, the project templates' rule; a slot that is
nothing but a variable is not recognised). A task line with a variable is template text the same way ("Keyboard audit
of {{name}}" matches any "Keyboard audit of …"). The `[A11Y]` marker never is a slot.

## Example — +a11y

`.specs/tracks/a11y/track.json`:

```jsonc
{
  "name": "a11y",
  "marker": "A11Y",
  "title": { "en": "Accessibility", "pt": "Acessibilidade", "es": "Accesibilidad" },
  "signals": {
    "strong": ["accessibility", "screen reader", "wcag 2.1", "acessibilidade", "leitor de ecrã", "accesibilidad"],
    "weak": ["keyboard", "contrast", "aria", "teclado", "contraste"],
    "context": ["focus"]
  },
  "sections": [
    { "name": { "en": "Keyboard Navigation", "pt": "Navegação por Teclado", "es": "Navegación por Teclado" },
      "syn": ["keyboard access"], "guidance": { "en": "Tab order, focus traps, shortcuts, the visible focus ring." } },
    { "name": { "en": "Screen Reader Support", "pt": "Leitor de Ecrã", "es": "Lector de Pantalla" },
      "guidance": "Landmarks, labels, live regions — how each control is announced." },
    { "name": "Contrast", "loose": ["colours"], "guidance": "Text / background pairs and their ratios (WCAG 1.4.3)." }
  ],
  "steering": "accessibility.md"
}
```

`requirements.md`:

```markdown
- WHEN a user navigates with the keyboard only THE SYSTEM SHALL make every control reachable and operable
- THE SYSTEM SHALL keep a text contrast ratio of at least [4.5:1] on every screen
```

`tasks.md`:

```markdown
- [ ] Keyboard walk-through of {{name}}
  - _Requirements: {{ac1}}_
  - _Makes green: {{t1}}_
- [ ] Contrast audit
  - _Requirements: {{ac2}}_
  - _Makes green: {{t2}}_
```

`test-plan.md`:

```markdown
| Test ID | Layer | Kind | Description | Covers | File |
|---|---|---|---|---|---|
| T-00 | e2e | example | keyboard-only walk-through reaches every control | {{ac1}} | `tests/e2e/a11y-keyboard.spec.ts` |
| T-00 | unit | property | every text / background pair keeps its contrast ratio | {{ac2}} | `tests/unit/contrast.test.ts` |
```

`checklist.md`: `- axe-core reports no violation on the feature's pages` · `steering.md`: the team's WCAG level and tools.

A `core +tdd +a11y` feature then gets US-1.AC-5 / AC-6 under `#### [A11Y]`, three `## [A11Y] …` design sections with
their `> **TODO**` line, tasks 7–8 citing US-1.AC-5 / AC-6 and making T-06 / T-07 green, the two rows after the
template's T-01…T-05, `- [ ] A11Y: axe-core …` in checklist.md, and `.specs/steering/accessibility.md`.

## How the engine treats a pack

- **Classification (Phase 0).** `spec_classify` (with the project), `spec_create` without tracks and `spec_import`
  score the pack's signals exactly like the built-in ones: one strong keyword or two weak ones turn +a11y on; a lone
  weak one is "possible"; a `context` keyword only corroborates; negation annotates, never vetoes. Keywords are always
  matched as **literal words** (inflections allowed) — never as a pattern: `wcag 2.1` does not match `wcag 2x1`, and a
  keyword like `(a+)+$` is refused by `check`. A keyword in capitals is an acronym, matched case-sensitively. Confirm
  the track set with the human, as always.
- **Scaffolding.** `spec_create` / `spec_import` write the criteria, the design sections, the task block, the test rows
  (+tdd), the checklist items and the steering file — `spec_import` puts the pack's criteria back after the imported
  US-1 criteria (the import replaces requirements.md), plans them with the pack's rows and appends the task block citing
  them; the criteria go after the last US-1 criterion, before the next REAL heading (a heading inside an HTML comment or
  fenced code never counts); `spec_add_track` on an existing feature adds the design sections,
  the task block (citing the track's criterion slot — write the criteria yourself, as for a built-in track) and the
  steering file. A project template (`.specs/templates/`) still gets the pack's blocks unless it already carries the
  marker. Everything is create-only / append-only.
- **Gates.** doctor fails `<name>-sections` (e.g. `a11y-sections`) while a section is missing, still has its
  `> **TODO**` line or is empty; the design approval is refused on the same check; the pack's slots are placeholders
  for the placeholder gate; next_action names the check. `spec_status` reports `packSections`, the roadmap's
  "needs attention" and the design-save hook name the unfilled `[A11Y]` sections.
- **Trace / brief / export.** trace_check counts the pack's criteria like any other; a task proving one gets the
  pack's design sections in its brief; the stakeholder export and the catalog label the track `+a11y`.
- **Removal.** `spec_add_track {remove: true}` is non-destructive: the `[A11Y]` sections, criteria and task block stay
  on disk, inactive, and count again when the track is re-added.
- **A pack that disappears** (folder deleted, or now invalid): features that saved +a11y keep it in `.state.json`
  (with its marker, `packMarkers`), the track is **inactive** — its sections, criteria and task block are no gate and no
  placeholder — and doctor warns `track-pack-missing`, naming why. Nothing crashes; restoring the pack reactivates it. A
  feature that had turned +a11y OFF before the pack went keeps those parts inactive too (no warning — it no longer uses
  the track), and another track's criteria or task block never absorb them.
- **Saved track lists.** A feature's `.state.json → tracks` names a pack when it is a valid pack now or recorded in its
  `packMarkers`; any other unknown word there (a typo, `security`, `gdpr`) makes the list unreadable and the tracks are
  inferred from the files, as before 1.15 — never a phantom missing pack.
- **A name reserved since (1.17).** 1.17 adds the built-in `+dist` track and reserves `dist` and its words (`kafka`,
  `distributed`, `microservices`, `consistency`, their PT / ES forms) and the marker `DIST`. A pack of one of those names
  from an earlier version is now `name-reserved` (ignored); a feature that used it recorded it in `packMarkers`, so it
  stays that feature's **missing pack** — inactive, never dropped from the list, and a pack named `dist` is never read as
  the built-in `+dist` (whose five `[DIST]` sections that design doesn't have). doctor's `track-pack-missing` and
  `spec_upgrade` (`track-pack-reserved`) say so. The way out: rename `.specs/tracks/<name>/` (and its marker, when that is
  reserved too, and the headings that carry it), `dev-spec add-track <feature> <new-name>`, then
  `dev-spec add-track <feature> <old-name> --remove`; or, for `dist`, adopt the built-in track instead:
  `dev-spec add-track <feature> dist` (the old record goes, the built-in sections are added).

## check — stable codes

Errors (the pack is ignored): `json-missing` · `json-invalid` · `too-big` (track.json / a fragment over 32 KB) ·
`linked-folder` (the pack or `.specs/tracks/` is a symlink / junction, or resolves outside `.specs/`) · `fragment-linked`
(a file that is a link or a folder) · `name-invalid` · `name-reserved` · `name-mismatch` · `field-missing` ·
`field-invalid` · `marker-invalid` · `marker-reserved` · `marker-duplicate` · `signal-invalid` · `too-many` (keywords,
sections, synonyms, fragment items — each bounded) · `section-duplicate` · `steering-invalid` · `fragment-row` ·
`fragment-ref` · `too-many-packs` (over 20). Warnings: `unknown-key` · `unknown-file` · `unknown-variable` ·
`section-name-lead` (a section name's numbering / emoji / dash is ignored when matching) · `section-core-name` (a
section named like a core design heading — only its marked heading counts) ·
`fragment-empty` (the built-in default is used) · `steering-shared` (the file is also a built-in steering file) ·
`ears-no-modal` / `ears-vague` (a fragment criterion EARS would flag). The CLI exits 1 on an error.

## Safety

A pack is **data only**: nothing in it is run or evaluated; its keywords reach the classifier escaped (a literal,
linear match); its name and marker are validated to a closed alphabet before any pattern sees them; only the
allowlisted file names are read, each a regular file (lstat — never a link) in a folder chain checked once per pack
(`.specs/tracks/` is no link, the pack folder's real path is inside `.specs/`, a `<lang>/` folder is no link) — a symlink
or junction out is ignored; every size and count is bounded. No network. `tracks` is a reserved feature
slug — a folder `.specs/tracks/` holding a `.state.json` is a feature created before 1.15: it stays that feature and
is never read as packs (every `spec_tracks` action refuses with `legacyFeature: true`).

## Performance

A project without `.specs/tracks/` pays one existence check per engine call. With packs, each call lists the pack
folders and lstats their files; a pack whose files (size, mtime, inode) are unchanged is served from an in-process cache,
and so is the placeholder corpus built from the packs — an MCP server or a CLI run pays the reading and parsing once,
and an edit is picked up by the very next call. A hook is a fresh process: it reads the packs once (one pack ≈ a few
milliseconds; 20 packs × 4 language folders ≈ 60 ms).

## Limits

- `spec_add_track` does not append the pack's criteria to an existing requirements.md (the built-in tracks don't
  either — requirements may already be approved); `spec_create` does, for a new feature.
- A pack's section names are one string per language; the headings a scaffold writes use the feature's language.
- A feature language without its own fragment folder uses the pack root's fragments.
- Editing a pack under `.specs/tracks/` does not refresh ROADMAP.md by itself (the save hook skips pack files, as it skips
  `.specs/templates/`); the next engine mutation, or `dev-spec roadmap --write`, does.
- A variable in a slot is a wildcard: `[the {{name}} screens]` also recognises `[the checkout screens]` as the slot.
