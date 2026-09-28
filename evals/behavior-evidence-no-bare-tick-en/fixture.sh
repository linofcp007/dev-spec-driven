#!/usr/bin/env bash
# csv-export (EN, core): every planning phase approved, task 1 done with evidence, task 2 open with
# `_Verify: node --test test/cli.test.js_` — its code is already in place.
. "$(dirname "${BASH_SOURCE[0]}")/../fixtures/lib.sh"
copy_fixture orders-app
ds init core --lang en
copy_fixture specs-en/steering .specs/steering
ds create "csv-export" core --lang en --summary "Export the orders list as CSV from the command line."
copy_fixture specs-en/csv-export .specs/csv-export
for phase in classification requirements design tasks; do ds approve csv-export "$phase" --by "Sam"; done
ds done csv-export 1 --evidence "3 tests, 3 pass, 0 fail" --exit 0 --cmd "node --test test/csv.test.js"
git_init_main "feat(csv-export): CSV serializer"
