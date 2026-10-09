# Test Patterns & Conventions

This reference is specific to the **+tdd** track. It covers how to name tests, how to structure
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
`spec_doctor` warns (`tests-in-code`) when a done task's `_Makes green:_` test exists in no test file. The same
T-IDs tie the evidence together: the task that writes a test cites it with its red run (`_Expect: fail_`, below), the
task that makes it green with `_Makes green:_`, and `dev-spec log` finds commits that say "Makes T-01 green".

| Language / framework | Convention |
|---|---|
| JS / TS (node:test, Jest, Vitest, Mocha) | `test("T-01 should reject an expired token", …)` · `it("T-01 …")` |
| Python (pytest, unittest) | `def test_T01_rejects_expired_token():` |
| Go | `func TestT01RejectsExpiredToken(t *testing.T)` |
| Java / Kotlin (JUnit 5, jqwik) | `@DisplayName("T-01 rejects an expired token")` · `void testT01RejectsExpiredToken()` |
| C# (xUnit, NUnit, FsCheck) | `[Fact(DisplayName = "T-01 rejects an expired token")]` · `public void T01_RejectsExpiredToken()` |
| PowerShell (Pester, `*.Tests.ps1`) | `It 'T-01 rejects an expired token' { … }` |
| Shell (Bats, `*.bats`) | `@test "T-01 rejects an expired token" { … }` |
| C / C++ (GoogleTest, Catch2) | `TEST(Token, T01_RejectsExpired)` · `TEST_CASE("T-01 rejects an expired token")` |
| Lua (busted) · R (testthat) | `it("T-01 rejects an expired token", function() … end)` · `test_that("T-01 rejects an expired token", { … })` |
| Elixir · Erlang · Haskell · Clojure · Perl | `test "T-01 …"` · `%% T-01 …` · `it "T-01 …"` · `(testing "T-01 …" …)` · `ok($ok, 'T-01 …')` |

- `T-01` with the hyphen is found anywhere in a test file (a title, a display name, a comment). Without
  the hyphen only the naming forms count, with an **uppercase** `T` and the zero-padded number the
  templates write (two digits or more): `test_T01…`, `testT01…`, `TestT01…` and a method that starts
  with `T01_`. A bare `T1` is ignored — it collides with generic type parameters (`Func<T1, T2>`) — and
  so is `test_t2_is_after_t1` (a pytest name about a time variable, not test T-2).
- IDs compare by number: `T-1`, `T-01` and `test_T01` name the same planned test.
- Only test files are read: source files in a broad list of languages — the one guard mode, `spec_scan` and
  `spec_scan {coverage: true}` count as code (JS/TS, Python, Go, Rust, Java/Kotlin/Scala/Groovy, C#/F#/VB, Ruby, PHP, Swift,
  Objective-C, C/C++, Vue/Svelte, PowerShell, shell, SQL, Lua, R, Perl, Elixir/Erlang, Haskell, Clojure, Dart, Julia,
  Nim, OCaml …), plus a Bats suite (`*.bats`) and Perl's `t/*.t` — that sit under a `test/`, `tests/`, `__tests__/`,
  `spec/` or `e2e/` folder or are named like a test in their language (`*.test.ts`, `*.spec.js`, `test_*.py`,
  `*_test.go`, `*Test.java`, `*Tests.cs`, `*Tests.fs`, `*Spec.scala`, `*_test.exs`, Pester's `*.Tests.ps1` (beside the
  code too), `*_test.sh`, `*_test.cc` / `*_unittest.cc`, `*_spec.lua`, `test-*.R`, `*_SUITE.erl` / `*_tests.erl`,
  `*_test.clj`, `*Tests.m` …). A shell / C / C++ `test_*` file and an hspec `*Spec.hs` count in a test folder only, and a
  name that merely ends in "test" or "spec" (`latest.sh`, `inspect.lua`, `DevSpec.hs`) or starts with it outside one
  (`scripts/test_data.sh`, `src/test_utils.c`) is code. Data in a test folder is no test: a `.sql` / `.ipynb` there is
  read only when NAMED like a test (pgTAP's `test_*.sql` / `*_test.sql`) or claimed by a test plan's File column — the
  file itself (`test/sql/users.sql`) or the folder that directly holds it (`tests/` claims `tests/001_users.sql`, not
  `tests/fixtures/seed.sql`), and then it counts only for the rows that name it. An unclaimed `tests/fixtures/seed.sql`
  is a fixture.
  `node_modules/`, build output and hidden folders are skipped. `.specs/` is skipped
  too, **except** each feature's own `.specs/<feature>/tests/` (the folder `+tdd` scaffolds). The walk
  is bounded: each file is read up to 200,000 characters, at most 1,500 files — past that, the files named like a test first (the
  result says `truncated` when it stopped at its cap).
- T-IDs are per feature — every plan starts at T-01 — so **fill the plan's File column**: when a row
  names a concrete test file or folder (`tests/unit/login.test.ts`, `tests/auth/`), only that file — or a
  file under that folder — can satisfy the T-ID. Write the path from the project root, from the feature
  folder, from a monorepo package (`tests/unit/login.test.ts` matches
  `packages/api/tests/unit/login.test.ts`) or as a bare file name (`login.test.ts`); it matches whole
  path segments, so `tests/beta.test.js` never matches `tests/alpha.test.js`. While the cell is still a
  template slot (`[path]`, `tests/unit/...`) or names a code file outside a test folder (`load/invoice.k6.js`),
  the match is by number across the project, so another feature's `T-01` test would pass this one. A test
  under **another** feature's `.specs/<feature>/tests/` never counts for this one, and neither does a test file
  **another feature's plan** (active or archived) names in its File column while this plan doesn't — that file is the
  other feature's. A folder in the cell (`test/`) scopes this plan's rows but claims no file for it.
- A row whose File column names **only non-code artifacts** — `load-test.md`, `evals/golden.json`, a Gherkin
  `.feature`, a JMeter `.jmx` — is a check run outside test code (a load run, the eval harness, a manual pass):
  its T-ID is listed in `plannedOutsideCode`, never in `plannedNotInCode`, so neither doctor, `finish` nor the
  Phase 4 gate expects it in a test file (the scaffold's own load and eval rows are such rows). Its evidence is
  the task's `_Verify:_` run. To have the scan check it after all, name a test file in the cell instead. While
  that artifact is still the scaffold (`load-test.md` with its template text, the sample eval set) once the test is
  due, doctor warns `outside-code-artifacts` and `/spec-finish` repeats it.
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

### Recording the red run — `_Expect: fail_`

A test that never failed proves nothing, so the engine lets a task record its red run as evidence. Mark the task
that writes a test before its code — a bugfix's regression test, a red phase — with `_Expect: fail_` next to the
`_Verify:_` command that runs that test, and name the T-IDs it writes in the task (its text or `_Makes green:_`):

```markdown
- [ ] 3. [US1] Write T-04 and T-05 (expired and revoked keys) and watch them fail for the right reason
  - _Requirements: US-1.AC-3, US-1.AC-4_
  - _Verify: npm test -- tests/unit/verify.test.ts_
  - _Expect: fail_
- [ ] 4. [US1] Reject expired and revoked keys in verify()
  - _Requirements: US-1.AC-3, US-1.AC-4_
  - _Makes green: T-04, T-05_
  - _Verify: npm test -- tests/unit/verify.test.ts_
```

- `dev-spec done <feature> 3 --run` while the tests fail records the **red run** as task 3's proof (exit ≠ 0,
  `expected: "fail"`); a passing run is refused (`unexpected-pass` — the test doesn't fail yet). Exit 126 / 127 / 9009
  (the command could not run) is no red run.
- Task 4 then turns them green with a normal must-pass `_Verify:_`.
- `spec_doctor` warns **`red-green`** (+tdd) for every T-ID a done task makes green with no recorded red run of an
  `_Expect: fail_` task citing it. When Phase 4 wrote all the failing tests up front, one Setup task "confirm the
  failing tests T-01, T-02, T-03, T-04, T-05, T-06, T-07 are red" marked `_Expect: fail_`, ticked before any
  implementation task, records that red run for all of them — it must name each T-ID (a range such as "T-01…T-07"
  names only its two ends). A guard test that passes before the change by design (a bugfix's T-02) goes in no
  `_Makes green:_`, so the check never asks for its red run; a bugfix scaffolded before 1.14 still lists T-02 in task
  4's `_Makes green:_` — remove it from there rather than making the test fail artificially.

Details: `verification.md` (Red → green).

---

## The micro-cycle inside a task

Adapted from the `test-driven-development` skill of [obra/superpowers](https://github.com/obra/superpowers) (MIT),
fitted to this plugin's spec-level rules. The spec sets the frame: Phase 3 plans the tests (T-IDs mapped to ACs),
Phase 4 writes them failing, an `_Expect: fail_` task records their red run, and each task's `_Makes green:_` names
the T-IDs it turns green. **Inside** a +tdd task you still work in the smallest loop — red-green-refactor, one
behaviour at a time:

1. **One behaviour.** Pick the next single thing a target test (T-xx) asserts — or the next step toward it. Not the
   whole task at once.
2. **The test first.** The planned test already exists (Phase 4) — or, for a step it doesn't pin down, write the small
   unit test that drives it. A planned test keeps its T-ID in its name; a helper test inside the task is fine and adds
   no T-ID to the plan.
3. **Watch it fail — for the right reason.** Run it. The failure must be an assertion or "not implemented" — never a
   typo, a missing import or a runner that didn't start ("Red for the Right Reason", above). If you can't say why it
   failed, you don't have a test yet.
4. **Minimal code.** Write only what makes that test pass — nothing it doesn't demand, no "while I'm here".
5. **Watch it pass.** Run it, then the task's target tests. Nothing that was green may turn red.
6. **Refactor only on green.** Names, duplication, structure — rerun after each change; behaviour stays the same.
7. **Repeat** with the next behaviour until every T-ID in `_Makes green:_` is green; then run the full suite and
   record the task's `_Verify:_` run (`spec_complete_task {evidence}` / `dev-spec done <f> <n> --run`).

**Code written before its test is deleted and redone** — the code of a NEW behaviour: test first, then the code
again, driven by the test. Not kept "as a reference", not "adapted": code already written shapes the test to fit it,
and the test then proves the code does what it does, not what the AC asks. Code that already existed before the task
— what a characterization or guard test pins — is not "written before its test": it is what that test describes.

The micro-cycle never changes the plan: it adds no T-ID to `test-plan.md` on its own (a behaviour the plan misses is
a spec gap — `/spec-converge`, `spec_append_tasks`), never edits a planned test's assertion to get green ("When a
test is wrong", below), and the task's evidence is still its `_Verify:_` run.

### Rationalizations → answers

| The thought | The answer |
|---|---|
| "Too simple to test." | Simple code breaks too, and its test takes a minute. If the code is that simple, so is the test. |
| "I'll test after." | A test written after the code passes on its first run — it proves the code does what it does, not what was asked. |
| "Just this once." | Every skipped cycle says so. The exceptions are how the discipline erodes. |
| "I'll keep the code as a reference while I write the test." | Delete it. You would bend the test to fit it. Rewrite it from the test. |
| "Manual testing is enough." | A manual check isn't repeatable, doesn't guard the next change, and isn't evidence the engine records. |
| "TDD slows me down." | Debugging untested code is slower: a cycle takes minutes, a regression found in production takes days. |
| "This is hard to test." | Hard to test is hard to use — the design is telling you something: simplify the interface. |
| "It's only a refactor." | Then the existing tests stay green before and after — run them. A behaviour change needs a new failing test. |
| "I already know it works." | Then watching the test fail and pass costs seconds. Knowing is not evidence. |

### Red flags — stop and restart the cycle

For the test of a NEW behaviour — the one this step is about to add:

- **The test passed on its first run.** It tests nothing new (or the code was already there): make it fail first —
  by testing the behaviour that is still missing, never by breaking the code or bending the assertion.
- **You can't explain why it failed.** The failure isn't the missing behaviour — fix the test until it fails for the
  right reason.
- **The test was written after the code.** Delete that new code, keep the test, watch it fail, write the code again.
- Several behaviours in one step, a refactor while red, a test edited until it passes.

**Green on its first run is expected — not a red flag — for:**

- a **guard test**: behaviour that already works and must keep working — a bugfix's guard test (T-02) passes before
  the fix too; never make it fail artificially and never list it under `_Makes green:_` ([bugfix.md](bugfix.md));
- a **characterization test** of existing code: it pins what the code does today, before a refactor moves it —
  characterization tests → refactor → still green ([improvement-specs.md](improvement-specs.md)); nothing is deleted;
- a **planned T-ID an earlier task already turned green**: run it to confirm it stays green — its red run belongs to
  the task that made it green.

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
