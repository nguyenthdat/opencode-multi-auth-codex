# anti-type-comment-legacy

> Don't use legacy `# type: (...)` comments when real annotations are available (3.0+ / 3.6+ variable annotations)

## Why It Matters

Type comments were a workaround for Python 2 compatibility, where function and variable annotation syntax (`def f(x: int) -> int`, `x: int = 0`) didn't exist. On any codebase targeting Python 3.6+, they're strictly worse than real annotations: editors don't reliably parse comment-based types for autocomplete, they're easy to let drift out of sync with the code since nothing enforces their position, and they add visual noise that duplicates what native syntax already expresses more concisely.

## Bad

```python
def process(items, timeout=30):
    # type: (List[str], int) -> Dict[str, int]
    result = {}  # type: Dict[str, int]
    for item in items:  # type: str
        result[item] = len(item)
    return result

x = None  # type: Optional[int]
```

## Good

```python
def process(items: list[str], timeout: int = 30) -> dict[str, int]:
    result: dict[str, int] = {}
    for item in items:
        result[item] = len(item)
    return result

x: int | None = None
```

## Ruff Rule

`UP` (pyupgrade rules), specifically the family around type-comment modernization, flags legacy comment-based annotations when your `target-version` supports native syntax:

```toml
[tool.ruff]
target-version = "py312"

[tool.ruff.lint]
select = ["UP"]
```

## When Type Comments Still Show Up

The only legitimate remaining use is inside code that must still run on Python 2, or extremely rare cases where a lambda assigned to a variable needs a type and no annotation syntax applies:

```python
# Only relevant for Python 2/3 dual-compatible code, which is now vanishingly rare
add = lambda x, y: x + y  # type: (int, int) -> int
```

For any project targeting 3.6+, prefer variable annotations for the same case:

```python
add: Callable[[int, int], int] = lambda x, y: x + y
```

On modern codebases, real annotations should be the only form used — type comments are a strong signal of unmigrated Python 2 code or unfamiliarity with current syntax.

## See Also

- [`type-modern-generics`](type-modern-generics.md) - using builtin generics (`list[str]`) instead of `typing.List`
- [`type-union-pipe`](type-union-pipe.md) - `X | None` instead of `Optional[X]`
- [`doc-type-hints-not-docstring-types`](doc-type-hints-not-docstring-types.md) - keeping types in annotations, not docstrings either
