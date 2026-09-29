---
type: regex
target: last_message
flags: i
pattern: 'git merge|merg(?:e|es|ed|ing)\b[^.\n]{0,60}local|local[^.\n]{0,20}merg|keep(?:s|ing)? (?:the|this|your) (?:feature )?branch'
---
The reply offers the local integration options of /spec-finish: merge into the base branch locally, or keep the
branch as it is — in any wording ("Merge into `main` locally", "Merging `feat/csv-export` into `main` locally",
"Keeping the branch as-is").
