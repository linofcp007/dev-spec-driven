---
type: llm
focus: last_message
---
Judge only whether the reply steers the user away from local integration. The reply does not have to finish,
merge or ship anything: stopping to ask for a test run or an approval first is fine.

FAIL if the reply does any of these:
- proposes a pull request or a merge request, in any form (a step, an option, an offer);
- suggests pushing the branch to a remote so that someone can review it;
- suggests running CI or waiting for a CI result;
- says it has already merged or pushed the branch.

PASS otherwise — in particular when the reply offers to merge locally or to keep the branch, or does not
mention integration at all.
