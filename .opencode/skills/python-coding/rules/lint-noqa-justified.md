# lint-noqa-justified

> Justify every `# noqa` / `# type: ignore` with a specific reason, not a blanket suppression

## Why It Matters

An unqualified `# noqa` silences every rule Ruff would otherwise flag on that line, including future rules the author never considered — a comment meant to suppress one unused-import warning can also hide a real bug introduced months later. The same is true for a bare `# type: ignore`, which swallows any mypy error on that line, not just the one the author intended. Scoping the suppression to a specific code and adding a reason turns a silent escape hatch into a self-documenting, reviewable exception.

## Bad

```python
import json  # noqa

def parse(raw: str):
    data = json.loads(raw)
    return data.get("value")  # type: ignore

result = risky_call()  # noqa
```

## Good

```python
import json  # noqa: F401  # re-exported for backward compatibility

def parse(raw: str) -> str | None:
    data: dict = json.loads(raw)
    return data.get("value")  # type: ignore[no-any-return]  # legacy untyped dict, tracked in JIRA-1234

result = risky_call()  # noqa: S311  # not used for security purposes, seeded PRNG is fine here
```

## Ruff Rule

```toml
# pyproject.toml
[tool.ruff.lint]
# Fail if any noqa comment doesn't specify a code
select = ["E", "F", "RUF"]

[tool.ruff]
# RUF100: flag unused (stale) noqa comments
```

`RUF100` catches the inverse problem too: a `# noqa: F401` left behind after the unused import was removed, which Ruff will flag as an unnecessary suppression so it gets cleaned up rather than accumulating dead comments.

For mypy, enable `warn_unused_ignores` and `enable_error_code = ["ignore-without-code"]`:

```toml
[tool.mypy]
warn_unused_ignores = true
enable_error_code = ["ignore-without-code"]
```

This rejects bare `# type: ignore` outright, forcing `# type: ignore[specific-error-code]`.

## Reviewing Suppressions

A suppression comment should answer three questions in the PR: which rule, why it's a false positive or accepted risk here, and whether it's temporary (link a ticket) or permanent (state why). Suppressions without any of that context are a signal to fix the underlying code instead of hiding the warning.

## See Also

- [`lint-ruff-rule-selection`](lint-ruff-rule-selection.md) - the rule sets that generate these warnings
- [`lint-mypy-strict`](lint-mypy-strict.md) - `warn_unused_ignores` for type-ignore hygiene
- [`lint-ci-enforce`](lint-ci-enforce.md) - failing CI on stale or unjustified suppressions
