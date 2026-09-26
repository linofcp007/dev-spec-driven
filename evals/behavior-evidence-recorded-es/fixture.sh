#!/usr/bin/env bash
# exportar-csv (ES, core): every planning phase approved, task 1 done with evidence, task 2 open with
# `_Verify: node --test test/cli.test.js_` — its code is already in place.
. "$(dirname "${BASH_SOURCE[0]}")/../fixtures/lib.sh"
copy_fixture orders-app
ds init core --lang es
copy_fixture specs-es/steering .specs/steering
ds create "exportar-csv" core --lang es --summary "Exportar la lista de pedidos a CSV desde la línea de comandos."
copy_fixture specs-es/exportar-csv .specs/exportar-csv
for phase in classification requirements design tasks; do ds approve exportar-csv "$phase" --by "Lucía"; done
ds done exportar-csv 1 --evidence "3 tests, 3 pass, 0 fail" --exit 0 --cmd "node --test test/csv.test.js"
git_init_main "feat(exportar-csv): serializador CSV"
