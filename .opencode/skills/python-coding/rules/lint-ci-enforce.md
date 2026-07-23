# lint-ci-enforce

> Enforce lint and type-check as a CI gate that fails the build, not an optional report

## Why It Matters

A lint job that runs in CI but doesn't fail the build (or worse, an `allow_failure: true` step) is functionally decoration — violations accumulate because nobody is required to look at the report, let alone fix it before merging. Once a codebase has hundreds of pre-existing warnings, new ones become invisible in the noise. Making lint and type-check a required, blocking status check is what actually keeps a codebase clean, because it's the only mechanism that stops a regression from merging in the first place.

## Bad

```yaml
# .github/workflows/ci.yml
jobs:
  lint:
    runs-on: ubuntu-latest
    continue-on-error: true   # failures are reported but never block merge
    steps:
      - run: ruff check .
      - run: mypy src/
# Branch protection doesn't require this job to pass,
# so red X's on lint are routinely ignored.
```

## Good

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --all-extras
      - run: uv run ruff check --output-format=github .
      - run: uv run ruff format --check .
      - run: uv run mypy src/

  test:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --all-extras
      - run: uv run pytest --cov
```

Then, in the repository's branch protection rules, mark `lint` and `test` as **required status checks** so GitHub blocks merging until both are green.

## Failing Fast and Failing Clearly

```bash
# Locally reproduce exactly what CI runs before pushing
uv run ruff check . && uv run ruff format --check . && uv run mypy src/
```

Use `--output-format=github` (or the GitLab/junit equivalent) so lint failures show up as inline PR annotations on the offending line, not just a wall of text in a job log — this is what makes a blocking gate fast to fix rather than resented.

## See Also

- [`lint-pre-commit-hooks`](lint-pre-commit-hooks.md) - catching the same issues before they reach CI
- [`lint-ruff-primary`](lint-ruff-primary.md) - the linter/formatter being enforced
- [`lint-mypy-strict`](lint-mypy-strict.md) - the type-check step in the gate
