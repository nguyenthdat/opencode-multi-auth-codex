# lint-ruff-rule-selection

> Curate Ruff's rule selection deliberately instead of accepting only the default set

## Why It Matters

Ruff ships with only `E4`, `E7`, `E9`, and `F` enabled by default — a conservative subset chosen for zero-config compatibility with Flake8. That default misses entire categories of bugs Ruff is capable of catching: mutable default arguments (`B006`), bare excepts (`E722`), unused imports beyond the basics, import sorting (`I`), and modernization opportunities (`UP`). A team that runs `ruff check .` and assumes they're "using Ruff" without ever touching `[tool.ruff.lint]` is leaving most of the tool's value on the table.

## Bad

```toml
# pyproject.toml
[tool.ruff]
line-length = 100

# No [tool.ruff.lint] section at all - only E4/E7/E9/F run.
# bugbear (B), simplify (SIM), pyupgrade (UP), and import
# sorting (I) are silently absent, even though the team
# believes "we run Ruff" covers those categories.
```

## Good

```toml
# pyproject.toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "F",    # pyflakes
    "I",    # isort
    "UP",   # pyupgrade - modernize syntax for target-version
    "B",    # flake8-bugbear - common bug patterns
    "SIM",  # flake8-simplify
    "C4",   # flake8-comprehensions
    "PTH",  # flake8-use-pathlib
    "RUF",  # Ruff-specific rules
]
ignore = [
    "E501",  # line length handled by formatter, not the linter
]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101"]  # allow assert in tests
```

## Choosing a Starting Set

| Rule set | Prefix | Catches |
|---|---|---|
| pyflakes | `F` | unused imports/variables, undefined names |
| pycodestyle | `E`, `W` | PEP 8 style issues |
| bugbear | `B` | mutable defaults, bad exception patterns |
| pyupgrade | `UP` | outdated syntax for your `target-version` |
| simplify | `SIM` | needlessly complex boolean/control-flow logic |
| bandit-lite | `S` | security smells (see `lint-bandit-security`) |
| comprehensions | `C4` | inefficient list/dict/set comprehensions |

Start with `E`, `F`, `I`, `UP`, `B` on any codebase — they have low false-positive rates. Add `SIM`, `C4`, `RUF`, and `S` once the baseline is clean, and use `extend-select` in follow-up PRs so each new category can be reviewed and `noqa`'d independently rather than dumped in one massive diff.

## See Also

- [`lint-ruff-primary`](lint-ruff-primary.md) - the tool this rule selection configures
- [`lint-noqa-justified`](lint-noqa-justified.md) - handling exceptions once rules are enabled
- [`lint-bandit-security`](lint-bandit-security.md) - the `S` rule set for security linting
