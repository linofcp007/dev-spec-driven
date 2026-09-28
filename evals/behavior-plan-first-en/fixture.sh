#!/usr/bin/env bash
# A small existing Node project (orders CLI), no .specs/ yet.
. "$(dirname "${BASH_SOURCE[0]}")/../fixtures/lib.sh"
copy_fixture orders-app
git_init_main "chore: orders CLI"
