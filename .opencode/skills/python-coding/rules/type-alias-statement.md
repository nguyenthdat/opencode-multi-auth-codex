# type-alias-statement

> Use the `type` statement (PEP 695, 3.12+) or `TypeAlias` for named type aliases

## Why It Matters

Repeating a long or complex annotation (`dict[str, list[tuple[int, str]]]`) across a codebase is error-prone and makes signatures hard to scan. A named alias documents intent ("this is a `UserId`, not just any `int`... well, semantically") and gives you one place to change the underlying type. Without `TypeAlias`/`type`, a plain assignment like `Vector = list[float]` can be ambiguous to type checkers about whether it's a type alias or a regular variable holding a type object.

## Bad

```python
# Ambiguous: is this an alias, or a runtime variable that happens to hold a type?
Vector = list[float]

def scale(v: Vector, factor: float) -> Vector:
    return [x * factor for x in v]

# Repeating a complex shape everywhere — easy to typo, hard to refactor
def merge_records(
    records: dict[str, list[tuple[int, str]]],
) -> dict[str, list[tuple[int, str]]]:
    ...
```

## Good

```python
# Python 3.12+ PEP 695 syntax — clearly a type alias, lazily evaluated
type Vector = list[float]

def scale(v: Vector, factor: float) -> Vector:
    return [x * factor for x in v]

type RecordsByOwner = dict[str, list[tuple[int, str]]]

def merge_records(records: RecordsByOwner) -> RecordsByOwner:
    ...
```

## Pre-3.12 Compatible Syntax

```python
from typing import TypeAlias

Vector: TypeAlias = list[float]
RecordsByOwner: TypeAlias = dict[str, list[tuple[int, str]]]

# Generic aliases with PEP 695 (3.12+)
type Pair[T] = tuple[T, T]

def swap[T](pair: Pair[T]) -> Pair[T]:
    a, b = pair
    return (b, a)
```

The `type` statement creates a lazily evaluated alias (forward references inside it "just work" without quoting), and it's clearly distinguished from a runtime assignment. Use `TypeAlias` when supporting Python versions below 3.12.

## See Also

- [`type-modern-generics`](type-modern-generics.md) - the container syntax typically aliased
- [`type-union-pipe`](type-union-pipe.md) - aliasing a recurring union shape
- [`type-typevar-generic`](type-typevar-generic.md) - the PEP 695 generic syntax shared with `type` aliases
