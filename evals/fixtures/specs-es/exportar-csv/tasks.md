# Tareas: exportar-csv

## Restricciones Globales
- Node >= 20 · sin dependencias de runtime · columnas fijas id,date,customer,total

## Historia US-1 (P1 — MVP)
- [ ] 1. [US1] Serializador CSV con entrecomillado RFC 4180
  - _Requirements: US-1.AC-2, EC-1_
  - _Implements: src/csv.js_
  - _Verify: node --test test/csv.test.js_
- [ ] 2. [US1] Flag `--csv` en la CLI
  - _Requirements: US-1.AC-1, NFR-1_
  - _Implements: src/cli.js_
  - _Verify: node --test test/cli.test.js_
**Checkpoint:** US-1 está totalmente funcional y es testeable/lanzable de forma independiente.
