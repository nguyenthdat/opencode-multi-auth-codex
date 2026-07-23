# lint-ruff-primary

> Use Ruff as the primary linter and formatter for Python projects

## Why It Matters

Ruff reimplements the checks from Flake8, isort, pyupgrade, pydocstyle, and dozens of other plugins in a single Rust binary that runs 10-100x faster than the tools it replaces. Slow linters get skipped in practice — developers disable pre-commit hooks or stop running `make lint` locally when a check takes 30 seconds, and CI feedback loops stretch out. Consolidating on one tool also means one config file, one dependency to pin, and one set of rule codes to reason about instead of reconciling Flake8, isort, and pyupgrade configs that can silently contradict each other.

## Bad

```python
# pyproject.toml equivalent: a scattered toolchain
# [tool.flake8]
# max-line-length = 100
# extend-ignore = E203
#
# [tool.isort]
# profile = "black"
#
# [tool.pyupgrade]
# py38-plus = true
#
# Three tools, three config sections, three subprocess invocations in CI,
# and no shared understanding of "line too long" between flake8 and black.
```

## Good

```toml
# pyproject.toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.ruff.format]
quote-style = "double"
```

```bash
# One tool for linting, import sorting, and formatting
ruff check .        # replaces flake8 + isort --check + pyupgrade
ruff format .        # replaces black
```

## Migrating From Legacy Tooling

| Old tool | Ruff equivalent |
|---|---|
| Flake8 + plugins | `ruff check` (rule codes `E`, `F`, `W`, `B`, `C4`, ...) |
| isort | `ruff check --select I` or `ruff format` combined with `I` |
| pyupgrade | `ruff check --select UP` |
| black | `ruff format` (near drop-in, same formatting philosophy) |
| pydocstyle | `ruff check --select D` |

Projects that still need mypy or pyright for type checking keep that tool separate — Ruff does not replace a type checker, only the lint/format/import-sort layer.

## See Also

- [`lint-ruff-rule-selection`](lint-ruff-rule-selection.md) - choosing which Ruff rule sets to enable
- [`lint-format-on-save`](lint-format-on-save.md) - pairing Ruff's formatter with editor integration
- [`lint-mypy-strict`](lint-mypy-strict.md) - the type-checking layer Ruff does not cover
- [`lint-ci-enforce`](lint-ci-enforce.md) - making Ruff a CI gate, not just a local convenience
