# type-check-tool

> Enforce mypy or pyright in CI as a hard gate, not an optional suggestion

## Why It Matters

Type hints that are never checked are just comments — they drift out of sync with the code silently, and nobody notices until a production bug reveals the annotation was wrong for months. Running a type checker locally but not in CI means a single contributor who skips it (or whose editor doesn't surface errors) can merge type errors straight into `main`. Making the checker a required CI status check is the only way type hints stay trustworthy at scale.

## Bad

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    steps:
      - run: pip install -e ".[dev]"
      - run: pytest
      # mypy is only run manually, developers "should remember" to run it locally
```

```toml
# pyproject.toml — type checker configured but nothing invokes it in CI
[tool.mypy]
python_version = "3.12"
```

## Good

```yaml
# .github/workflows/ci.yml
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -e ".[dev]"
      - run: mypy src/          # non-zero exit fails the job
  test:
    needs: typecheck
    steps:
      - run: pytest
```

```toml
[tool.mypy]
python_version = "3.12"
strict = true
warn_unused_ignores = true
disallow_untyped_defs = true
```

Then mark `typecheck` as a required status check in the repository's branch protection rules so PRs cannot merge while it fails.

## Choosing mypy vs pyright

| Tool | Strength |
|------|----------|
| `mypy` | Mature plugin ecosystem (Pydantic, Django, SQLAlchemy stubs), configurable strictness levels, widely used in CI |
| `pyright` | Faster, better inference in some cases, powers VS Code's Pylance — good for fast local feedback |

Many teams run both: `pyright` for fast local/editor feedback, `mypy --strict` as the CI gate for consistency across contributors regardless of editor.

## See Also

- [`type-avoid-any`](type-avoid-any.md) - a rule that only has teeth once the checker runs in CI
- [`lint-mypy-strict`](lint-mypy-strict.md) - configuring mypy's strict mode in detail
- [`lint-ci-enforce`](lint-ci-enforce.md) - the general principle of making lint/type checks required CI gates
