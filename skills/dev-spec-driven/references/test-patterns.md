# Test Patterns & Conventions

This reference is specific to `test-spec-first`. It covers how to name tests, how to structure
them, how to choose a layer, and which anti-patterns to refuse.

## The Pyramid — and Why It Matters Here

```
      ▲         E2E          few, slow, high-value journeys
     ▲▲▲     Integration     some, moderate speed, component collaboration
    ▲▲▲▲▲       Unit         many, fast, pure logic
```

When mapping an AC to a test in the test plan, ask: **what is the smallest layer that can
meaningfully assert this AC?** Push it as low as possible without losing the assertion's meaning.

- "Password must be hashed with bcrypt cost 12" → unit test on `hashPassword`
- "POST /auth/register creates a user in the database" → integration test (HTTP + DB)
- "A new user can sign up, verify email, and log in" → one E2E test

An E2E test for a password hashing rule is expensive, slow, and fragile. A unit test for "user
can sign up" misses half the system. Pick the right layer.

---

## AAA: Arrange — Act — Assert

Every test has three visually distinct sections. Blank lines between them.

```ts
it('returns 404 when user not found', async () => {
  // Arrange
  const req = buildRequest({ params: { id: 'non-existent' } });

  // Act
  const res = await getUser(req);

  // Assert
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: { code: 'USER_NOT_FOUND' } });
});
```

Tests with no visible AAA structure become hard to read. Tests with multiple Act phases are
two tests pretending to be one — split them.

---

## Naming

### File naming

Follow `testing-standards.md` from the project's steering files. Defaults if none exist:
- Unit: `src/lib/password.ts` → `src/lib/password.test.ts` (co-located)
- Integration: `tests/integration/register.test.ts`
- E2E: `tests/e2e/auth-flow.spec.ts`

### Describe blocks

Name after the subject under test:
```ts
describe('hashPassword', () => { ... });
describe('POST /auth/register', () => { ... });
describe('Auth flow: register → verify → login', () => { ... });
```

### Test names

`should [expected observable behaviour] when [condition]`.

Good:
- `should return 404 when user does not exist`
- `should lock the account after 5 consecutive failures`
- `should hash passwords with bcrypt cost factor 12`

Bad:
- `test user not found` (vague, no expected behaviour)
- `works correctly` (works how? correctly by what standard?)
- `regression for bug #4123` (future readers don't have the ticket; describe the behaviour)

### Test IDs in test names (traceability into the code)

Put the test plan's T-ID at the start of each test's name. `trace_check {code: true}` (CLI:
`dev-spec trace <feature> --code`) then links every planned test to the files that implement it, and
`spec_doctor` warns (`tests-in-code`) when a done task's `_Makes green:_` test exists in no test file.

| Language / framework | Convention |
|---|---|
| JS / TS (node:test, Jest, Vitest, Mocha) | `test("T-01 should reject an expired token", …)` · `it("T-01 …")` |
| Python (pytest, unittest) | `def test_T01_rejects_expired_token():` |
| Go | `func TestT01RejectsExpiredToken(t *testing.T)` |
| Java / Kotlin (JUnit 5, jqwik) | `@DisplayName("T-01 rejects an expired token")` · `void testT01RejectsExpiredToken()` |
| C# (xUnit, NUnit, FsCheck) | `[Fact(DisplayName = "T-01 rejects an expired token")]` · `public void T01_RejectsExpiredToken()` |

- `T-01` with the hyphen is found anywhere in a test file (a title, a display name, a comment). Without
  the hyphen only the naming forms count, with an **uppercase** `T` and the zero-padded number the
  templates write (two digits or more): `test_T01…`, `testT01…`, `TestT01…` and a method that starts
  with `T01_`. A bare `T1` is ignored — it collides with generic type parameters (`Func<T1, T2>`) — and
  so is `test_t2_is_after_t1` (a pytest name about a time variable, not test T-2).
- IDs compare by number: `T-1`, `T-01` and `test_T01` name the same planned test.
- Only test files are read: files in JS/TS, Python, Go, Rust, Java/Kotlin/Scala/Groovy, C#/F#, Ruby,
  PHP, Swift, C/C++, Vue/Svelte, Elixir or Dart that sit under a `test/`, `tests/`, `__tests__/`,
  `spec/` or `e2e/` folder or are named like a test (`*.test.ts`, `*.spec.js`, `test_*.py`, `*_test.go`,
  `*Test.java`, `*Tests.cs`, `*Tests.fs`, `*Spec.scala`, `*_test.exs` …). `node_modules/`, build
  output and hidden folders are skipped. `.specs/` is skipped
  too, **except** each feature's own `.specs/<feature>/tests/` (the folder `+tdd` scaffolds). The walk
  is bounded (the result says `truncated` when it stopped at its cap).
- T-IDs are per feature — every plan starts at T-01 — so **fill the plan's File column**: when a row
  names a concrete test file or folder (`tests/unit/login.test.ts`, `tests/auth/`, relative to the
  project root or to the feature folder), only that file — or a file under that folder — can satisfy
  the T-ID. While the cell is still a template slot (`[path]`, `tests/unit/...`) the match is by number
  across the project, so another feature's `T-01` test would pass this one. A test under **another**
  feature's `.specs/<feature>/tests/` never counts for this one.
- `inCodeNotInPlan` lists only IDs that appear in **no** feature's test plan. Naming the AC as well
  (`US-1.AC-2`) is welcome: `acsInTests` lists the feature's ACs the test code mentions.

---

## Table-Driven Tests

When the same logic is tested against many inputs, a table makes the test a readable truth-table
instead of a wall of copy-paste.

```ts
describe('validatePassword', () => {
  const cases = [
    { input: 'short',        expected: false, reason: 'too short' },
    { input: 'alllowercase', expected: false, reason: 'no uppercase' },
    { input: 'NoNumbers',    expected: false, reason: 'no digit' },
    { input: 'Valid123!',    expected: true,  reason: 'meets all rules' },
  ];

  it.each(cases)('returns $expected when input is $reason', ({ input, expected }) => {
    expect(validatePassword(input)) .toBe(expected);
  });
});
```

Each row must contribute information — if two rows test the same path, delete one.

---

## Property-Based Tests

An example test checks one chosen input. A property test states an **invariant** and lets a generator
throw hundreds of inputs at it, shrinking any failure to a minimal counter-example. The test plan's
**Kind** column records which one each planned test is: `example` or `property` (the values stay in
English in every language).

| EARS pattern | Usually | Why |
|---|---|---|
| Ubiquitous — `THE SYSTEM SHALL …` (always true) | property | It must hold for every input — a generator says so |
| State-driven — `WHILE <state>, THE SYSTEM SHALL …` | property | An invariant over every input while the state holds |
| Event-driven — `WHEN <trigger> THE SYSTEM SHALL …` | example | One trigger → one observable response |
| Unwanted — `IF <error> THEN THE SYSTEM SHALL …` | example (negative) | A specific failure path; add a property when the error class is wide ("any malformed input") |

Other good candidates: round-trips (`decode(encode(x)) == x`), idempotence (`f(f(x)) == f(x)`),
invariants (totals always balance, tenant A never reads tenant B's rows) and a simple reference
implementation checked against the fast one.

Libraries: **fast-check** (JS/TS), **Hypothesis** (Python), **jqwik** (Java/Kotlin), **gopter** (Go),
**FsCheck** (.NET). The same invariant — "T-04: the codec round-trips every string" (a ubiquitous AC) —
in each family:

```ts
// fast-check
import fc from "fast-check";
test("T-04 decode(encode(s)) returns s for every string", () => {
  fc.assert(fc.property(fc.string(), (s) => decode(encode(s)) === s));
});
```

```python
# Hypothesis
from hypothesis import given, strategies as st

@given(st.text())
def test_T04_round_trip(s):
    assert decode(encode(s)) == s
```

```java
// jqwik
@Property
@Label("T-04 decode(encode(s)) returns s")
void roundTrip(@ForAll String s) {
    assertEquals(s, decode(encode(s)));
}
```

```go
// gopter
func TestT04RoundTrip(t *testing.T) {
	properties := gopter.NewProperties(nil)
	properties.Property("decode(encode(s)) == s", prop.ForAll(
		func(s string) bool { return decode(encode(s)) == s },
		gen.AnyString(),
	))
	properties.TestingRun(t)
}
```

```csharp
// FsCheck (xUnit)
[Property(DisplayName = "T-04 decode(encode(s)) returns s")]
public bool RoundTrip(NonNull<string> s) => Decode(Encode(s.Get)) == s.Get;
```

Rules of thumb:
- Generate only the valid domain the AC talks about (amounts ≥ 0, non-empty names) — a property that
  filters away most generated inputs tests almost nothing.
- Keep runs reproducible: the libraries print the seed of a failing run — re-run with it, and record it.
- Every shrunk counter-example that exposed a real bug becomes a permanent **example** test (a
  regression) with its own T-ID.
- A property test is red for the right reason too: it fails on the missing behaviour, not on a broken
  generator.

---

## Mocking Philosophy

Mock at the **seams** the design defined — typically external services, the clock, randomness,
and I/O. Don't mock internal modules: that couples the test to implementation details.

Rules of thumb:
- **Time:** inject a clock, don't call `Date.now()` directly. Tests pass a fake clock.
- **Randomness / IDs:** inject a generator. Tests pass a deterministic stub.
- **HTTP:** use a tool like MSW that intercepts at the network layer — your code doesn't know
  it's being tested.
- **Database in integration tests:** prefer a real in-memory or containerised DB (SQLite, Testcontainers)
  over mocks. Tests exercise real SQL and real constraints.
- **Database in unit tests:** don't touch the DB at all — those aren't unit tests.

Anti-pattern: mocking the function you're testing, or mocking its direct internal collaborators.
That's testing the mock, not the code.

---

## Fixtures, Factories, Builders

Avoid sprawling fixture files. Prefer **factory functions with defaults + overrides**:

```ts
function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user_' + Math.random().toString(36).slice(2, 8),
    email: `${crypto.randomUUID()}@test.local`,
    name: 'Test User',
    emailVerified: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// Usage:
const user = buildUser({ emailVerified: true });
```

This way:
- Each test declares only what it cares about (`{ emailVerified: true }`)
- Defaults evolve in one place
- Tests don't quietly break when a new required field is added — the factory fills it

---

## Negative Tests Are First-Class

Every `IF ... THEN` EARS requirement corresponds to at least one negative test. Negative tests
are often the most valuable ones in the suite — they prove the system fails safely.

```ts
it('returns 423 and does not authenticate after 5 failed login attempts', async () => {
  const email = 'user@example.com';
  await seedUser({ email, password: 'correct-horse' });

  // 5 wrong attempts
  for (let i = 0; i < 5; i++) {
    await request(app).post('/auth/login').send({ email, password: 'wrong' });
  }

  // 6th attempt, even with correct password, should be locked
  const res = await request(app)
    .post('/auth/login')
    .send({ email, password: 'correct-horse' });

  expect(res.status).toBe(423);
  expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
});
```

---

## "Red for the Right Reason"

Before the Phase 4 approval gate, every test must fail because the feature isn't implemented.
Not because:

- A module can't be imported (fix the import path)
- A type error prevents compilation (add the type stub)
- The test runner isn't configured (fix the config)
- A fixture throws (fix the fixture)

The failure message a reviewer should see is something like:

```
FAIL tests/integration/register.test.ts
  POST /auth/register
    ✗ should create a user with a hashed password (3ms)
      Error: NotImplementedError: register handler not implemented
```

Not:

```
FAIL tests/integration/register.test.ts
  ✗ Cannot find module '../../src/auth/register'
```

The first is a specification. The second is broken infrastructure.

---

## Anti-Patterns to Reject

| Anti-pattern | Why it's bad | Fix |
|---|---|---|
| Testing private methods directly | Couples test to implementation | Test through the public API; if something needs its own tests, extract it |
| Shared mutable state between tests | Flaky, order-dependent | Reset state in `beforeEach`, or use fresh instances |
| `sleep(100)` for async waits | Flaky, slow | Use proper waiters (`waitFor`, `await until(...)`) |
| Snapshot tests for complex objects without review | Rot silently, anyone can update with `-u` | Use for stable, small outputs only; require a human review before merging |
| Multiple unrelated assertions | First failure masks the rest | Split into separate tests |
| Tests that duplicate the implementation | Change with the impl, prove nothing | Test observable behaviour, not the algorithm |
| `expect(something).toBeTruthy()` | Hides the real expectation | Assert the specific value |
| Catch-all `try/catch` in tests | Turns failures into silent passes | Let errors propagate; if you need to assert an error, use `expect(...).toThrow(...)` |

---

## When a test is wrong

During Phase 6 you may discover a test is wrong (tests the wrong thing, over-specifies an
implementation detail, has flaky setup). **Do not silently edit it until it passes.** Follow
this loop instead:

1. Pause the current task.
2. Explain the issue: what does the test assert, what should it assert, and why?
3. Propose a fix. Is this a test-plan mistake (add/remove/reclassify tests) or a test-code
   mistake (same assertion, different setup)?
4. Get approval.
5. Rerun the red → green loop from wherever makes sense.

This preserves the test suite as a specification. A suite that's been quietly edited to pass
is worse than no suite at all — it lies.
