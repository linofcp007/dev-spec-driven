---
type: regex
target: trace
match: not_contains
pattern: '"command":"[^"]*\bgh\s+pr\b|"command":"[^"]*\bgit\s+push\b'
---
Never acts on a pull request or a push: no `gh pr …` and no `git push` command is run (only meaningful when a
shell is granted — the finish step never merges or pushes on its own).
