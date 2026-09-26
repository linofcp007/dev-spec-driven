#!/usr/bin/env bash
# csv-export (EN, core) READY to finish on branch feat/csv-export: every phase approved, both tasks done with
# passing evidence. `main` holds the app before the feature.
. "$(dirname "${BASH_SOURCE[0]}")/../fixtures/lib.sh"
copy_fixture orders-app
g init -q -b main
g add package.json src/orders.js src/discount.js test/discount.test.js
g commit -q -m "chore: orders CLI"
g checkout -q -b feat/csv-export
ds init core --lang en
copy_fixture specs-en/steering .specs/steering
ds create "csv-export" core --lang en --summary "Export the orders list as CSV from the command line."
copy_fixture specs-en/csv-export .specs/csv-export
for phase in classification requirements design tasks; do ds approve csv-export "$phase" --by "Sam"; done
ds done csv-export 1 --evidence "3 tests, 3 pass, 0 fail" --exit 0 --cmd "node --test test/csv.test.js"
ds done csv-export 2 --evidence "1 test, 1 pass, 0 fail" --exit 0 --cmd "node --test test/cli.test.js"
git_commit "feat(csv-export): export the orders list as CSV"
