# Project Structure

## Layout
```
src/<feature>/        one folder per feature (src/api-keys/service.js)
tests/unit/           fast, no I/O
tests/integration/    real Postgres + Redis
migrations/           ordered SQL migrations
```

## Naming
- Files / components / API routes / DB tables / metrics: kebab-case files; `/v1/<resource>` routes; snake_case plural tables (`api_keys`); metrics `<feature>_<what>_<unit>` (`apikey_verify_duration_seconds`).

## Commits
Conventional commits: `type(scope): description`. Types: feat|fix|refactor|test|docs|chore|style|perf

## Branches & Reviews
- main + feature/<name>; reviews required for merges to main.
