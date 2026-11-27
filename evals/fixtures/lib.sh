#!/usr/bin/env bash
# Shared helpers for the behavioural eval cases' scaffold scripts (claude plugin eval --scaffold).
# A case's fixture.sh runs in the run's empty workspace (the cwd), as you, outside the agent's sandbox:
#   . "$(dirname "${BASH_SOURCE[0]}")/../fixtures/lib.sh"
# The plugin under test is two levels above the case directory, so the fixtures are built with the plugin's
# own CLI — approvals, fingerprints and evidence always match the engine being evaluated, never a stale copy.
set -euo pipefail

FIXTURES="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$FIXTURES/../.." && pwd)"

# dev-spec CLI against the workspace; quiet unless it fails (a refused approval fails the scaffold).
ds() {
  local out
  if ! out="$(node "$PLUGIN_ROOT/cli/dev-spec.js" "$@" --project . 2>&1)"; then
    echo "fixture: dev-spec $* failed:" >&2
    echo "$out" >&2
    return 1
  fi
}

# Copy a fixture tree (its contents, dotfiles included) into the workspace or a subfolder of it.
copy_fixture() {
  local src="$FIXTURES/$1" dest="${2:-.}"
  mkdir -p "$dest"
  cp -R "$src/." "$dest/"
}

# git with a fixed identity and no line-ending rewriting. The agent under test never runs git (no shell is
# granted), but a real repository keeps "which branch / merge locally" answers honest.
g() {
  git -c user.name="eval" -c user.email="eval@example.invalid" -c core.autocrlf=false "$@"
}

git_init_main() {
  g init -q -b main
  git_commit "$1"
}

git_commit() {
  g add -A
  g commit -q -m "$1"
}

# The review-seat cases (tag review-seat): ONE task of note-edits, done on a branch the way the per-task loop leaves it
# (references/subagent-execution.md), then reviewed (spec-reviewer, task mode) or one finding verified (spec-verifier).
# review-seat/<variant>/: head/ (the task's files at HEAD), implementer.md (its report), base/ (optional: files the
# variant needs at BASE), finding.md (a verifier case's finding). The package is written with §4's commands, and
# .execution/dispatch.md holds the dispatch §5 (reviewer) or §6 (verifier) lists — the prompt the controller sends.
review_seat() {
  local v="$1" rs="$FIXTURES/review-seat/$1" x=".specs/note-edits/.execution" refs base head
  [ -d "$rs/head" ] && [ -f "$rs/implementer.md" ] || { echo "fixture: no review-seat variant $v" >&2; return 1; }
  copy_fixture orders-app
  copy_fixture review-seat/base
  if [ -d "$rs/base" ]; then copy_fixture "review-seat/$v/base"; fi
  ds init core --lang en
  copy_fixture specs-en/steering .specs/steering
  ds create "note-edits" core --lang en --summary "Let users edit their own notes on an order; long notes are refused."
  copy_fixture review-seat/spec .specs/note-edits
  for phase in classification requirements design tasks; do ds approve note-edits "$phase" --by "Sam"; done
  git_init_main "chore: orders CLI with order notes"
  g tag task-1-base
  copy_fixture "review-seat/$v/head"
  git_commit "feat(note-edits): task 1"
  ds brief note-edits 1 --write
  cp "$rs/implementer.md" "$x/task-1-report.md"
  g log --oneline task-1-base..HEAD  >  "$x/task-1-review.diff"
  g diff --stat   task-1-base..HEAD  >> "$x/task-1-review.diff"
  g diff -U10     task-1-base..HEAD  >> "$x/task-1-review.diff"
  base="$(g rev-parse task-1-base)"; head="$(g rev-parse HEAD)"
  refs="$(cd "$PLUGIN_ROOT/skills/dev-spec-driven/references" && { pwd -W 2>/dev/null || pwd; })/"
  if [ -f "$rs/finding.md" ]; then
    {
      echo "Verify ONE finding of the task 1 review of note-edits (the project root is the current directory)."
      echo
      echo "- The finding, verbatim: $(cat "$rs/finding.md")"
      echo "- Review package: $x/task-1-review.diff"
      echo "- BASE: $base · HEAD: $head"
      echo "- Brief: $x/task-1-brief.md"
      echo "- Implementer's report: $x/task-1-report.md"
    } > "$x/dispatch.md"
  else
    {
      echo "Task mode — review task 1 of note-edits (the project root is the current directory)."
      echo
      echo "- Brief: $x/task-1-brief.md"
      echo "- Implementer's report: $x/task-1-report.md"
      echo "- Review package (commit list + stat + full diff): $x/task-1-review.diff"
      echo "- BASE: $base · HEAD: $head"
      echo "- Active tracks: core"
      echo "- References folder: $refs"
    } > "$x/dispatch.md"
  fi
}
