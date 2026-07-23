# type-literal-constrain

> Use `Literal` to constrain a parameter to a fixed set of values

## Why It Matters

When a parameter only accepts a small, known set of strings or ints (a "mode" flag, an HTTP method, a log level), typing it as plain `str` accepts any string and defers the mistake to runtime — often as a hard-to-trace `KeyError` deep inside the function. `Literal` makes the valid set part of the type signature, so a typo'd value (`"desc"` instead of `"desc"` misspelled as `"decs"`) is caught immediately by the type checker and shows up as autocomplete in editors.

## Bad

```python
def sort_records(records: list[dict], direction: str = "asc") -> list[dict]:
    reverse = direction == "desc"
    return sorted(records, key=lambda r: r["created_at"], reverse=reverse)

sort_records(records, direction="decs")  # typo — silently sorts ascending, no error
```

## Good

```python
from typing import Literal

SortDirection = Literal["asc", "desc"]

def sort_records(records: list[dict], direction: SortDirection = "asc") -> list[dict]:
    reverse = direction == "desc"
    return sorted(records, key=lambda r: r["created_at"], reverse=reverse)

sort_records(records, direction="decs")  # type error: not a valid SortDirection
```

## Combining With `match` for Exhaustiveness

```python
from typing import Literal, assert_never

LogLevel = Literal["debug", "info", "warning", "error"]

def log_prefix(level: LogLevel) -> str:
    match level:
        case "debug":
            return "[DEBUG]"
        case "info":
            return "[INFO]"
        case "warning":
            return "[WARN]"
        case "error":
            return "[ERROR]"
        case _:
            assert_never(level)  # type checker flags this if a new Literal value is added
```

`assert_never` makes the `match` exhaustive: if `LogLevel` gains a new value later, mypy/pyright will flag the missing `case` at the call to `assert_never`, rather than letting it fall through silently at runtime.

## See Also

- [`type-alias-statement`](type-alias-statement.md) - naming a `Literal` union like `SortDirection` above
- [`data-enum-over-constants`](data-enum-over-constants.md) - when the fixed set needs behavior or is used across many modules, prefer `Enum`
- [`type-overload-signatures`](type-overload-signatures.md) - using `Literal` values to discriminate overloads
