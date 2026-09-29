# Code Reuse & Quality — search before you write

Most duplication in a growing codebase is not copy-paste; it is **reinvention**: a second date formatter, a third
HTTP client wrapper, another `Button` that is almost the design system's. Each one is reasonable in its own diff,
and none of them shows up in a review that reads only the diff. A year later there are four ways to retry a
request, each with its own bug. This reference is the habit that prevents it, at three points of the workflow:
**design** names what is reused, the **implementer** searches before writing and says what it found, the
**reviewer** compares new code with the codebase, not only with itself.

It applies to **every feature, whatever its tracks** — core included. It also covers the code smells worth acting
on (and the refactoring that answers each), naming, error handling, comments, and how to keep a refactor out of a
feature task without losing it.

See also: [improvement-specs.md](improvement-specs.md) (a refactor is its own spec, with characterization tests
and a metric), [test-patterns.md](test-patterns.md) (refactor only on green; characterization tests),
[brownfield.md](brownfield.md) (`spec_scan`, `spec_coverage`), [steering-templates.md](steering-templates.md)
(`structure.md`, the constitution, `glossary.md`), [subagent-execution.md](subagent-execution.md) (the task report
and the review), [red-flags.md](red-flags.md) ("while I'm here I'll also refactor X"),
[ui-design-patterns.md](ui-design-patterns.md) (the design system: reuse for components),
[api-design-patterns.md](api-design-patterns.md), [observability-patterns.md](observability-patterns.md).

---

## Where reuse enters the workflow

| Phase | What to do |
|---|---|
| Steering | `structure.md` says where shared code lives and the dependency rules; the constitution states the principle ("search before adding a helper; shared code lives in `src/lib/`") |
| Design | the **Reuse & Integration** section every plain feature's `design.md` is scaffolded with: the existing modules, components and helpers this feature uses or extends (with their paths), what is new and why nothing existing fits, and where the new code lives — `spec_doctor` warns `design-reuse` while it is missing, empty or still the template (a brownfield feature's filled `integration-plan.md` → Integration Points counts; a design approved before 1.19 is never flagged) |
| Tasks | `_Implements:_` names the existing files a task extends, not only the new ones — the task brief's **Reuse** section quotes the design's entries for those files (or the task's criteria) and lists the existing source files next to them |
| Implementation | search first; reuse or extend; report what was reused, extended or created, and why (below) |
| Review | new code compared with the **existing codebase**: a new helper that duplicates one is a finding (below) |
| Afterwards | smells outside the task go to the refactor-candidate backlog, never into the task |

---

## Search before you write

Budget a few minutes of searching before writing any helper, component, client, validator or formatter —
typically five to fifteen. It is cheaper than the duplicate it prevents, and the result goes in the report either
way.

**1. Read the map.** `structure.md` (steering) tells you where shared code is supposed to live
(`src/lib/`, `packages/shared/`, `components/`). In an unfamiliar codebase, `spec_scan` (`dev-spec scan`) gives the
inventory: stack and frameworks, top-level folders, files by extension, routes with `file:line`, entrypoints, test
frameworks — a map, not the territory ([brownfield.md](brownfield.md)).

**2. Check the specs.** `.specs/SPECS.md` (the catalog, `dev-spec catalog --write`) lists every feature's
criteria — an earlier feature may already do what you're about to build; doctor warns `cross-feature-acs` when a
criterion reads like another active feature's. Tasks name the files they touched in `_Implements:_`, so
`rg -l "src/lib/money.ts" .specs/` finds the spec that explains a module before you extend it.

**3. Search for the concept, not the name you'd give it** — three synonyms, and the library it would wrap:

```text
# a helper, by concept and synonyms
rg -n -i "slugif|kebab|url_?safe"
rg -n -i "retry|backoff|with_?retries"

# exported functions of a kind (JS/TS, then Python)
rg -n "export (async )?function \w*(format|parse)\w*"
rg -n "^def (format|parse)_" -t py

# who already wraps the library you were about to wrap
rg -l "from 'date-fns'"
rg -l "axios\.create"

# the shared folders, and the components
rg --files | rg -i "(^|/)(lib|shared|common|utils?|helpers?)/"
rg --files -g "*.tsx" | rg -i "button|modal|dialog"

# how the codebase already does it: the tests describe it
rg -n -i "describe\(.*(retry|pagination)" -g "*test*"

# where a symbol came from, and why (commits that added or removed it)
git log -S "withRetry" --oneline
git log --oneline -- src/lib/http/
```

`git grep -n -i -E "retry|backoff"` works the same way where ripgrep isn't installed.

**4. Decide and write it down** — reuse, extend or create (next section) — in the report, with what you searched
for. "Searched `retry`, `backoff`, `withRetries`; found `src/lib/http/retry.ts`, reused it" is a one-line proof of
diligence; "created `retryRequest()`" with no search line is a review finding waiting to happen.

---

## Reuse, extend or create

| What you found | Do | Watch for |
|---|---|---|
| An existing unit that does exactly this | **reuse** it | nothing — the cheapest line of code is the one you don't write |
| One that does almost this; the difference is a natural parameter of the same concept | **extend** it — a parameter with a default that keeps current callers unchanged; its tests extended | run its existing tests; check every caller still gets the old behaviour |
| One that does almost this, but the difference is a *different concept* | **create** a separate unit (possibly sharing a lower-level piece) | a boolean or mode parameter that makes one function do two jobs |
| Two existing units that together do it | **compose** them in the feature | promoting the composition to shared code before a second use |
| Nothing | **create** it — local to the feature first | putting it in `shared/` on first use |
| Something similar inside another bounded context | usually **don't share** — see "acceptable duplication" | coupling two parts that should change independently |

**The rule of three** (attributed to Don Roberts, popularised by Fowler's *Refactoring*): the first time, write
it; the second time, notice the duplication and tolerate it; the third time, extract the abstraction. Two cases
are rarely enough to see what actually varies.

**The wrong abstraction is worse than duplication.** Sandi Metz: "duplication is far cheaper than the wrong
abstraction". The signs that a shared unit is the wrong abstraction:

- it grows boolean or mode parameters (`format(date, { legacy: true, skipTz: false })`);
- callers pass flags to switch parts of it off;
- it branches on who is calling (`if (type === "invoice") …`);
- every change to it needs a check of every caller.

The remedy is to **inline it back** into the callers, delete what each doesn't use, and re-extract only what is
genuinely common — as its own refactor, not inside a feature task.

**Don't reuse by copy-paste.** A copied block forks the knowledge: the bug fixed in one copy lives on in the other.
If you duplicate on purpose (see "Duplication" below), say so in the report and why.

**Extending a unit outside the task's files.** A task changes the files its `_Implements:_` names — the plan puts an
existing unit to extend there (the Tasks row above), and a preparatory change stays in those files. When the unit to
extend lies **outside** them, it is never edited silently:

- in subagent execution the implementer reports **NEEDS_CONTEXT** naming the unit and the change; the controller adds a
  converge task for it (`spec_append_tasks` with that file in `_Implements:_` — a changed plan, approved again like any
  other) or tells the implementer to go ahead; working inline, you do the same through `/spec-converge`;
- when the task can be done without it (create locally — the rule of three), do that and name the extension in the
  report's **Reuse** block, so it is filed as a refactor candidate.

The scope guard enforces it: with `meta.guard: "scope"`, an edit to a code file no open approved task names asks the
user for permission — a subagent that hits the prompt mid-task stalls the loop until someone answers.

---

## Module boundaries

- **Cohesion**: what changes together lives together. A feature folder with its handlers, logic, queries and tests
  changes as one; a `utils.ts` of unrelated functions changes for every reason at once.
- **Dependency direction**: dependencies point toward what is more stable and more abstract. Feature code
  imports shared code — **never the reverse**; domain logic doesn't import the web framework or the database
  driver; no cycles between modules (the Acyclic Dependencies Principle). A cycle means two modules are one module
  or a missing third.
- **A public surface**: each module exposes a small, deliberate interface (an `index` file, explicit exports, a
  package's public API); its internals are not imported from outside. Everything exported is something someone
  will depend on.
- **Enforce it mechanically**: a dependency-rule tool (for example dependency-cruiser for JS/TS, import-linter
  for Python, ArchUnit for the JVM) run locally as a `_Verify:_` or a project check turns "features must not import
  each other" from a convention into a failing check.
- **Where shared code lives** — one convention, stated in `structure.md` and the constitution:

  ```text
  src/
  ├── features/<feature>/   # everything specific to one feature; imports lib/, never another feature
  ├── lib/                  # shared, feature-agnostic code: http client, logger, money, dates, validation
  └── components/           # the design system's components (or a separate package)
  ```

  **Promotion into `lib/`** needs: a second (better: third) real use, no knowledge of any one feature, its own
  tests, and a name that says what it is. `lib/` is not a drawer for code that doesn't fit elsewhere.

---

## Duplication — which kind, and when it's fine

- **Verbatim duplication** (the same lines twice) is found by copy-paste detectors — jscpd, PMD's CPD — run
  locally over the changed files.
- **Semantic duplication** (the same knowledge, written differently: two email validators, two ways to compute a
  tax) is found only by searching for the concept. DRY, as *The Pragmatic Programmer* defines it, is about
  **knowledge** — "every piece of knowledge must have a single, unambiguous, authoritative representation" — not
  about lines that look alike.

**Acceptable duplication:**

| Case | Why it's fine |
|---|---|
| **Tests** | a test should read top to bottom on its own; clear setup repeated beats a maze of shared helpers (keep data builders — [test-patterns.md](test-patterns.md) → Fixtures) |
| **Deliberately decoupled contexts** | billing's `Customer` and support's `Customer` look alike today and must be free to diverge; sharing them couples two teams' release cycles |
| **Coincidental similarity** | two pieces that look the same but change for different reasons are different knowledge |
| **Generated code** | the generator is the single source |
| **Across a service or package boundary** | a small copy can be cheaper than a shared library every service must upgrade in lockstep |

When you duplicate on purpose, leave a one-line comment naming the twin and why they are separate.

---

## Code smells worth acting on

Smell and refactoring names follow Martin Fowler's *Refactoring* catalogue (2nd edition) where it names them;
"deep nesting", "dead code" and "what-comments" are common labels for the rest.

| Smell | Symptom | Refactoring that answers it |
|---|---|---|
| **Long Function** | you scroll; you need comments to find the parts | Extract Function; Decompose Conditional; Split Phase |
| **Long Parameter List** | four or more parameters; call sites full of `null, null, true` | Introduce Parameter Object; Preserve Whole Object; Remove Flag Argument |
| **Feature Envy** | a function uses another module's data more than its own | Move Function |
| **Shotgun Surgery** | one change means small edits in many files | Move Function / Move Field to gather it; Combine Functions into Class |
| **Divergent Change** | one module changes for several unrelated reasons | Split Phase; Extract Class |
| **Primitive Obsession** | money as a float, IDs as bare strings, a status as magic strings | Replace Primitive with Object (a `Money`, an `OrderId`, an enum) |
| **Data Clumps** | the same three values travel together everywhere | Introduce Parameter Object; Extract Class |
| **Repeated Switches** | the same `switch` on a type in several places | Replace Conditional with Polymorphism — or a lookup table (table-driven methods, McConnell's *Code Complete*) |
| **Deep nesting** | `if` inside `if` inside a loop | Replace Nested Conditional with Guard Clauses; Extract Function |
| **Dead code** | unused functions, branches, flags, parameters | Remove Dead Code (git keeps it; prove it unreachable first — [improvement-specs.md](improvement-specs.md)) |
| **Speculative Generality** | hooks, parameters and abstract classes "for later" | Collapse Hierarchy; Inline Function; Inline Class; Change Function Declaration (drop the unused parameter) |
| **Mysterious Name** | you must read the body to know what it does | Rename (Change Function Declaration, Rename Variable, Rename Field) |
| **Comments that say *what*** | a comment restating the next lines | Extract Function / Rename so the code says it; keep the comments that say *why* |

Two of them in code:

```ts
// Before — primitive obsession + a long parameter list
function charge(amount: number, currency: string, customerId: string, retry: boolean, idempotencyKey: string) { … }

// After — Replace Primitive with Object, Introduce Parameter Object, Remove Flag Argument
function charge(req: ChargeRequest) { … }          // ChargeRequest { amount: Money; customer: CustomerId; idempotencyKey }
function chargeWithRetry(req: ChargeRequest) { … } // the flag became two intention-revealing functions
```

```python
# Before — deep nesting
def ship(order):
    if order is not None:
        if order.paid:
            if order.items:
                return dispatch(order)
    return None

# After — guard clauses
def ship(order):
    if order is None or not order.paid or not order.items:
        return None
    return dispatch(order)
```

**When to act on a smell during a feature:** only in code the task already touches, only **on green** (the tests
pass before and after — [test-patterns.md](test-patterns.md) → the micro-cycle), in small behaviour-preserving
steps, and in a **separate commit** from the behaviour change (Kent Beck's advice in *Tidy First?*: keep structure
changes and behaviour changes apart). Everything else goes to the backlog.

---

## Naming

- **Say what it does or holds**, in the domain's words: `overdueInvoices`, not `list2`; `calculateLateFee`, not
  `process`. The terms come from `glossary.md` (steering) when the project has one — including the words it tells
  you to avoid (`_Avoid:_`).
- **One word per concept**: if it's a `customer` in the spec, it's not a `client` in one module and a `user` in
  another. Different concepts get different words.
- **Functions are verbs, booleans are predicates** (`isExpired`, `hasAccess`, `canRefund`), collections are
  plurals.
- **Units in the name** when the type doesn't carry them: `timeoutMs`, `sizeBytes`, `priceMinor`.
- **Length follows scope**: `i` in a three-line loop, `pendingRefundsByCustomer` for a module-level value.
- **Meaningless suffixes** — `Manager`, `Helper`, `Util`, `Data`, `Info`, `Processor` — usually hide a missing
  concept; name the concept.
- **Symmetric pairs**: `open` / `close`, `start` / `stop`, `acquire` / `release` — never `open` / `end`.

---

## Error handling

- **No swallowed errors.** An empty `catch`, a `.catch(() => {})`, `except: pass`, or "log and continue" where the
  caller then believes it succeeded — each hides a failure until it becomes data corruption. Handle it, or let it
  propagate. (The reviewer treats a swallowed error as Important.)
- **Fail fast at the boundaries.** Validate and convert raw input once, at the edge (an HTTP handler, a message
  consumer, a CLI argument), into typed values the rest of the code can trust — "parse, don't validate". Inner
  code then doesn't re-check, and invalid states can't reach it.
- **Handle an error where something can be done about it** — retry, fall back, ask the user; everywhere else,
  propagate with context.
- **Add context, not secrets**: what was being done and to which ID (`charging order ord_8f3 failed`), never the
  token, password or personal data ([observability-patterns.md](observability-patterns.md) → Structured logs).
- **Translate at each boundary**: a driver error becomes a domain error, which the API layer maps to a
  problem+json response ([api-design-patterns.md](api-design-patterns.md) → Error format) — the database's error
  text never reaches a client.
- **Exceptions (or error results) for failures, not for control flow**; one style per codebase.
- **Clean up on every path**: `finally`, `using`, `with`, `defer` — a connection or lock leaked on the error path is
  an outage later.
- **Retries live in one layer** ([distributed-data-patterns.md](distributed-data-patterns.md) → Retries), and an
  error is **logged once**, where it is handled.

## Comments

- **Comments say why, the code says what.** Worth writing: intent the code can't show, a constraint ("the
  provider rejects batches over 100"), a non-obvious decision and its reference (`US-1.AC-3`, `D-4` in
  `decisions.md`), a warning ("order matters: the audit row must be written first").
- **Not worth keeping**: a comment that restates the next line, commented-out code (delete it — git has it),
  change journals ("2024-03 changed by …"), a comment that no longer matches the code (worse than none).
- **A TODO has an owner and a home** — a backlog entry or a task — or it's a wish nobody will read.
- **Public interfaces get doc comments**: what it does, parameters and units, errors, an example when the usage
  isn't obvious.

---

## Keeping a refactor out of a feature task

The red flag is familiar: "while I'm here I'll also refactor X" ([red-flags.md](red-flags.md)). A refactor folded
into a feature task makes the diff larger, the review harder, a regression unattributable, and the task's evidence
ambiguous (did the feature break the test, or the refactor?).

What a task **may** include: the small **preparatory** refactor the task itself needs, in the files its
`_Implements:_` already names, behaviour-preserving, on green, in its own commit — Kent Beck's "make the change
easy, then make the easy change". A preparatory change to a file outside them is a plan change (above: "Extending a
unit outside the task's files").

Everything else is **filed, not done**:

```text
dev-spec backlog add "refactor-pricing-rules" "refactor: Repeated Switches — price type switched on in 4 files (pricing.ts, invoice.ts, quote.ts, cart.ts); add Replace Conditional with Polymorphism; found in feature checkout-v2 task 5"
```

A backlog entry later becomes an **improvement spec** ([improvement-specs.md](improvement-specs.md)): its own
feature, characterization tests first (they pin today's behaviour), a re-measurable metric as the acceptance
criterion, and the refactor on green. If the feature task **can't** be done without a larger refactor, stop and
report it (BLOCKED or NEEDS_CONTEXT in subagent execution): the plan needs a preparatory task, which goes through
`/spec-converge` and the human's approval — not into the current diff.

---

## How the implementer reports reuse

Add a short **Reuse** block to the task report ([subagent-execution.md](subagent-execution.md) → the implementer's
report) — also when nothing was reused, because the search itself is the evidence:

```markdown
### Reuse
- Reused: `src/lib/http/retry.ts` (`withRetry`) for the provider call — same backoff policy as the rest of the codebase.
- Extended: `src/lib/money.ts` — added `Money.allocate(parts)` (+3 tests); existing callers unchanged (suite green).
- Created: `src/features/checkout/tax-rounding.ts` because no rounding helper handles per-line rounding
  (searched: "round", "rounding", "banker", "toFixed" in src/; nearest: `lib/money.ts#round` — whole-amount only).
- Duplicated on purpose: none.
- Refactor candidates: Repeated Switches — the price type switched on in 4 files (pricing.ts, invoice.ts, quote.ts, cart.ts).
```

The controller and the reviewer read it before the diff: it says where to look for a duplicate the implementer
may have missed. The controller files each refactor candidate in the backlog (`spec_backlog add`, a `refactor:` note —
below) and ledgers it; the implementer never does the refactor in the task.

## What the reviewer checks

The reviewer compares new code with the **codebase**, not only with the rest of the diff:

1. **List what the diff adds** — every new exported function, class, component, module, client or config key.
2. **Search for an existing equivalent of each** (the same searches as above, by concept and synonym), and read the
   report's Reuse block.
3. **Classify** with the reviewer's calibration ([subagent-execution.md](subagent-execution.md)):

| Finding | Severity |
|---|---|
| a new helper, component or client that duplicates an existing one | **Important** |
| verbatim copy of existing logic | **Important** |
| a swallowed error | **Important** |
| a dependency against the rules (shared code importing a feature, a feature importing another, a new cycle) | **Important** |
| a new shared abstraction with a single user (speculative generality) that adds public surface | **Important** if exported from shared code, otherwise **Minor** |
| a smell introduced in new code (a long function, a long parameter list, a mysterious name) | **Minor**, unless it hides a defect |
| a refactor idea outside the diff | out of scope — one line, deferred, and a backlog entry |

A duplicate found in review is fixed in the fix loop (reuse the existing unit, delete the new one) — it doesn't
ship with a "we'll consolidate later".

---

## The refactor-candidate backlog

- **One entry per candidate**, in the roadmap backlog (`dev-spec backlog add "refactor-<topic>" "refactor: <note>"`,
  `spec_backlog {action: "add", name, note}`): the smell, the files, the evidence (a count, a metric, the feature that
  tripped over it), and the refactoring you'd apply. The `refactor:` prefix tells a refactor candidate from a planned
  feature in ROADMAP.md. Give each candidate its **own name** (`refactor-pricing-switches`, `refactor-pricing-rounding`
  — the topic, not the area): an `add` with a name already in the backlog keeps that entry and appends the new note to
  its note (`exists: true`, `appended` — one line, at most 2,000 characters; past it the add is refused), so the same
  candidate found twice gathers its evidence in one entry, while two different candidates under one name would read as
  one.
- **Prioritise by pain, not by ugliness**: code that changes often and hurts every time comes first. Change
  frequency is cheap to measure:

  ```text
  git log --since="6 months ago" --format= --name-only | grep -v '^$' | sort | uniq -c | sort -rn | head -20
  ```

  A file that is both complex and among the most changed is a hotspot; an ugly file nobody touches can wait.
- **Promote** a candidate to an improvement spec when it blocks a feature, keeps causing bugs, or its metric
  crosses the project's budget ([improvement-specs.md](improvement-specs.md)).
- **Prune** entries that no longer apply — a backlog nobody reads is the same as none.

---

## Checklist

**Design**

1. The design names what it **reuses** and **extends**, and anything it adds to shared code, with the reason.
2. New shared code meets the promotion bar (a second real use, feature-agnostic, tested, well named) — otherwise it
   stays in the feature.
3. Dependencies follow `structure.md`: features → shared, never the reverse, no cycles.

**Implementation**

4. Searched before writing each helper, component, client or formatter — by concept and synonyms, the shared
   folders, the catalog; the searches are in the report.
5. Reuse first, then extend, then create; an extension keeps existing callers unchanged and its tests green.
6. No copy-paste reuse; deliberate duplication is named and justified.
7. Names from the domain and the glossary; one word per concept; units in names.
8. No swallowed errors; input validated once at the boundary; errors carry context, not secrets; cleanup on every
   path.
9. Comments say why; no commented-out code; every TODO has an owner and a home.
10. Refactoring only preparatory, in the task's files, on green, in its own commit; everything else filed in the
    backlog.
11. The report's Reuse block: reused, extended, created (with the search), duplicated on purpose, candidates filed.

**Review**

12. Every new unit in the diff searched against the codebase; duplicates of existing code, swallowed errors and
    dependency violations raised as Important.
13. Out-of-scope refactor ideas deferred to the backlog, not added to the fix loop.
