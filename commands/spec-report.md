---
description: "Reports from the specs: the living catalog, drift since finish, metrics and a retro, release notes, stakeholder exports."
disable-model-invocation: true
argument-hint: "[catalog | drift | metrics | changelog | export] [feature] [--write] [--since …] [--milestone …] [--md|--csv|…]"
allowed-tools: mcp__plugin_dev-spec-driven_spec-driven__spec_drift, mcp__plugin_dev-spec-driven_spec-driven__spec_metrics
---

Args: $ARGUMENTS — everything is derived locally from `.specs/`; no model, nothing sent anywhere.

- **catalog `[--write]`** — `spec_export {format: "catalog", write?}`: every feature and every AC with its status
  (superseded ones marked); `write` (re)generates `.specs/SPECS.md`. A criterion that replaces an older feature's carries
  `_Supersedes: <feature>/US-n.AC-m_`.
- **drift `[feature]`** — `spec_drift {name?}`, read-only (CLI `dev-spec drift`: exit 1 on drift or a stale baseline):
  each finished feature's implementing files changed, missing or now present since its finish; `unbaselined`,
  `reopened` and `stale` apart. Decide each drift with the user: the spec is wrong → `/spec-change <feature> impact`;
  the code is wrong → fix it (`/spec-bugfix`); harmless → finish again for a fresh baseline.
- **metrics `[feature] [--write]`** — `spec_metrics {name?, write?}`: lead times, rework, forced and batch approvals,
  change requests, evidence pass rate, velocity. `write` (with a name) creates `retro.md`, never over an existing one; its
  steering amendments are proposals for the user.
- **changelog `[--since <date|last|all>] [--milestone <name>] [--write]`** — `spec_export {format: "changelog", since?,
  milestone?, write?}`: Added, Changed and Fixed from the spec data; `write` → `.specs/RELEASE-NOTES.md` (a milestone's:
  `RELEASE-NOTES.<milestone>.md`).
- **export `[feature] [--md | --csv | --gherkin | --adr | --tracker jira|linear] [--write]`** — `spec_export {name?,
  format?, write?}`: one self-contained document (HTML by default) for people who don't read `.specs/` — or the
  traceability matrix (`csv`), Gherkin features, ADRs, a tracker import; `write` → `.specs/exports/`.

Without `write` each returns a preview: show it and offer to write. A generated file never replaces a hand-written one
(the result is then an error — tell the user). Respond in the user's language (EN / PT / ES).
