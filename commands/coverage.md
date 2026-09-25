---
description: Brownfield — measure how much of the existing code is covered by specs (files named in _Implements:_), and list the gaps. PT - cobertura de specs. ES - cobertura de specs.
argument-hint: ""
---

Use the **dev-spec-driven** skill brownfield coverage check.

Args: $ARGUMENTS

Run the `spec_coverage` MCP tool (CLI `dev-spec coverage`). Coverage is measured through the **`_Implements:_`**
markers of every feature's tasks (active or archived): a code file counts as covered when some marker names it —
the file itself, a folder containing it, or a glob. It reports `coveragePercent` (covered code files / code
files; test files are counted apart), a per-top-level-folder breakdown (`byFolder`), the folders with no covered
file (`undocumented`), per-feature counts, the markers that name nothing on disk (`unmatchedImplements` — typos
or deleted files, fix them) and those naming a test or non-code file (`nonCodeImplements`, informational).

Present the percentage, the weakest folders and the unmatched markers. Prioritize documenting the
highest-risk uncovered folders next (`/reverse`), and add `_Implements: path_` to the tasks of existing
features where it's missing — coverage only sees what the tasks declare. Respond in the user's language
(EN/PT/ES).
