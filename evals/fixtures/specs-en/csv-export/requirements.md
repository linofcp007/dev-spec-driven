# Feature: csv-export

## Summary
Export the orders list as CSV from the command line, so it opens cleanly in a spreadsheet.

## User Stories (prioritized — each independently testable)

### US-1 (P1 — MVP): Export the orders as CSV
**As a** shop manager, **I want** to export the orders list as CSV, **so that** the accountant can open it in a spreadsheet.
**Why P1:** the export is the whole feature.
**Independent Test:** Can be fully tested by running `node src/cli.js --csv` and opening the output in a spreadsheet.

#### Acceptance Criteria (EARS)
1. **US-1.AC-1** — WHEN the user runs the CLI with `--csv` THE SYSTEM SHALL print the header line `id,date,customer,total` followed by one line per order.
2. **US-1.AC-2** — IF a field contains a comma or a double quote THEN THE SYSTEM SHALL wrap the field in double quotes and double every inner double quote.

## Success Criteria (measurable, technology-agnostic)
- **SC-001** — An export of every order opens in a spreadsheet with one row per order plus the header, and no shifted columns.

## Edge Cases & Error Handling
- **EC-1** — No orders: only the header line is printed.

## Non-Functional Requirements
- **NFR-1** — Exporting 10,000 orders takes under one second on a laptop.

## Out of Scope
- Excel files and any column selection.

## Assumptions
- Every order fits in memory.
