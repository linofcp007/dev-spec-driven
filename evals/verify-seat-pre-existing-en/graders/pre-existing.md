---
type: regex
target: last_message
flags: i
pattern: '(?:\*\*Verdict:|Introduced by this diff:)[^\n|]*pre-?existing'
---
The reason names the line as pre-existing — on the verdict line or the "Introduced by this diff:" line, never the output
template's `pre-existing | not in the diff | …` list (the verifier's own prompt holds it; a pasted template never passes).
