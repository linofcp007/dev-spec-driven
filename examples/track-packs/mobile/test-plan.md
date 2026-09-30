<!-- The planned test rows of a +mobile feature (a +tdd feature only) — the built-in plan's six cells; each Test ID is
     renumbered after the plan's own, under "## [MOBILE] Traceability Matrix". -->
| Test ID | Layer | Kind | Description | Covers | File |
|---|---|---|---|---|---|
| T-00 | e2e | example | airplane mode: the core actions stay available and the queued changes sync on reconnect | {{ac1}} | `tests/e2e/offline.spec.ts` |
| T-00 | integration | property | two devices edit the same record offline: the sync applies the conflict rule and loses nothing | {{ac2}} | `tests/integration/sync-conflicts.test.ts` |
| T-00 | e2e | example | an app below the minimum version is blocked with the update prompt | {{ac3}} | `tests/e2e/min-version.spec.ts` |
| T-00 | e2e | example | each permission denied, then revoked: the feature explains it and keeps working | {{ac4}} | `tests/e2e/permissions.spec.ts` |
| T-00 | integration | example | the push payload opens the target screen and holds no personal data | {{ac5}} | `tests/integration/push.test.ts` |
