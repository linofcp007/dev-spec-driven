# Quickstart: csv-export

## Preconditions
- Node 20 installed.

## Steps (happy path — US-1 / P1)
1. Run `node src/cli.js --csv > orders.csv`.
2. Open orders.csv in a spreadsheet.
3. **Expect:** one row per order under the header, the customer "Bruno, Lda" in a single cell (SC-001).

## Negative path
1. Empty the order list and run the export again.
2. **Expect:** only the header line.

## Done when
- [x] The happy path produces the expected result.
- [x] The negative path is handled gracefully.
- [x] Success Criteria (SC-001) are observably met.
