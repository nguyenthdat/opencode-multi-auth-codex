# type-narrow-guards

> Use `TypeGuard`/`TypeIs` and narrowing idioms to narrow union types safely

## Why It Matters

Code that branches on a union type (`str | bytes`, `Success | Failure`) needs to prove to the type checker which branch it's in before accessing type-specific members; otherwise every access has to be defensively cast or silenced. Plain `isinstance`/`is None` checks narrow inline automatically, but custom validation helpers extracted into their own function lose that narrowing unless annotated with `TypeGuard` (or `TypeIs` in 3.13+) — without it, callers of the helper get no narrowing benefit at all.

## Bad

```python
def is_valid_response(data: dict | None) -> bool:
    return data is not None and "result" in data

def handle(data: dict | None) -> str:
    if is_valid_response(data):
        return data["result"]  # type error: data could still be None to the checker
    return "no data"
```

## Good

```python
from typing import TypeGuard

def is_valid_response(data: dict | None) -> TypeGuard[dict]:
    return data is not None and "result" in data

def handle(data: dict | None) -> str:
    if is_valid_response(data):
        return data["result"]  # narrowed to dict, no error
    return "no data"
```

## `TypeIs` for Symmetric Narrowing (3.13+)

`TypeGuard` only narrows in the `True` branch; the `else` branch keeps the original union. `TypeIs` narrows in *both* branches when the check is a genuine subtype test:

```python
from typing import TypeIs

def is_str(value: str | int) -> TypeIs[str]:
    return isinstance(value, str)

def describe(value: str | int) -> str:
    if is_str(value):
        return value.upper()      # narrowed to str
    return str(value * 2)         # narrowed to int in the else branch too
```

## Built-in Narrowing Idioms (No Helper Needed)

```python
def describe(value: str | int | None) -> str:
    if value is None:
        return "empty"
    if isinstance(value, str):
        return value.upper()
    return str(value)  # narrowed to int by elimination
```

Prefer plain `isinstance`/`is None` checks inline whenever possible — they narrow automatically with zero extra annotation. Reach for `TypeGuard`/`TypeIs` only when the narrowing logic is complex enough to warrant extraction into its own reusable function.

## See Also

- [`type-avoid-any`](type-avoid-any.md) - narrowing is how you avoid falling back to `Any`
- [`type-union-pipe`](type-union-pipe.md) - the union syntax being narrowed
- [`err-fail-fast-validate`](err-fail-fast-validate.md) - narrowing at a validation boundary rather than deep inside logic
