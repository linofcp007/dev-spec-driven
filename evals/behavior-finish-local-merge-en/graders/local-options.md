---
type: regex
target: last_message
flags: i
pattern: 'git merge|merge[^.\n]{0,40}local|local[^.\n]{0,20}merge|keep (?:the|this|your) (?:feature )?branch'
---
The reply offers the local integration options of /spec-finish: merge into the base branch locally, or keep the
branch as it is.
