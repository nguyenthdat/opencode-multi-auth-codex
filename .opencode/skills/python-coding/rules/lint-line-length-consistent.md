# lint-line-length-consistent

> Pick one line-length limit and enforce it via tooling, not convention alone

## Why It Matters

"Try to keep lines under 100 characters" without tooling means the limit is whatever each contributor's monitor width and habits happen to produce — some lines at 80, some at 140, wrapped inconsistently. That inconsistency defeats the purpose of a limit (readability in side-by-side diffs, split terminals, and code review tools) and generates pointless nitpick comments in review. A single limit enforced by the formatter removes the debate: the number is picked once, in one config file, and every line respects it automatically.

## Bad

```python
# No enforced limit - line length is whatever felt right to whoever wrote it
def create_notification(user_id, message, channel, priority=None, scheduled_for=None, metadata=None):
    ...

# A reviewer leaves a comment: "can you wrap this line?"
# on one PR but not another - the limit exists only as folklore.
```

## Good

```toml
# pyproject.toml
[tool.ruff]
line-length = 100

[tool.ruff.format]
# ruff format wraps to line-length automatically wherever it can
```

```python
def create_notification(
    user_id: int,
    message: str,
    channel: str,
    priority: str | None = None,
    scheduled_for: datetime | None = None,
    metadata: dict[str, str] | None = None,
) -> None:
    ...
```

## Choosing a Number

| Limit | Rationale |
|---|---|
| 79 (PEP 8 default) | Matches old terminal widths; rarely used by teams with modern tooling |
| 88 (Black default) | Black's compromise between density and readability |
| 100 | Common in teams doing side-by-side diffs on wide monitors |
| 120 | Common in enterprises migrating from Java/C# conventions |

There is no objectively correct number — what matters is that it's set once in `[tool.ruff]` (or `pyproject.toml`'s `[tool.black]` for teams still on Black) and that `E501` is enforced by the linter/formatter rather than left to human judgment. Long strings, URLs, and `# noqa: E501`-tagged lines are the only sanctioned exceptions, and even those should be rare enough to stand out in review.

## Keeping Formatter and Linter in Sync

Set the same number in both the linter and the formatter — a mismatch means the formatter wraps to 88 while the linter still flags anything over 100, which is confusing and self-contradictory:

```toml
[tool.ruff]
line-length = 100   # used by both `ruff check` (E501) and `ruff format`
```

If the team still runs Black alongside Ruff during a migration, mirror the value explicitly:

```toml
[tool.black]
line-length = 100
```

## See Also

- [`lint-ruff-primary`](lint-ruff-primary.md) - the tool that enforces the configured limit
- [`lint-format-on-save`](lint-format-on-save.md) - automatic wrapping at the configured limit
- [`lint-noqa-justified`](lint-noqa-justified.md) - justifying the rare `# noqa: E501` exception
