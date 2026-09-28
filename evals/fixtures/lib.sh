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
