# Checklist: API Keys

Tracks: core +tdd +saas. Tick before calling the feature done.

- [ ] Requirements: every AC is testable, has a stable ID, no vague terms (run `ears`).
- [ ] Design: respects the project constitution (no principle violated).
- [ ] Design: at least one Mermaid diagram; security + error handling covered.
- [ ] Traceability: every AC maps to a task (run `trace`).
- [ ] TDD: all planned tests written and red for the right reason before code.
- [ ] TDD: test commits land before implementation commits.
- [ ] SaaS: 5 mandatory design sections filled (no TODO).
- [ ] SaaS: tenant isolation enforced (`WHERE tenant_id = ?`).
- [ ] SaaS: metrics/logs/alerts emitted; load test meets budget (hot path).
- [ ] Doctor: `doctor` reports readyToAdvance before each gate.
- [ ] All phase gates approved (`approve`).
