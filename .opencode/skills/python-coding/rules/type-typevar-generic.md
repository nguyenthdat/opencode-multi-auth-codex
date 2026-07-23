# type-typevar-generic

> Use `TypeVar` or PEP 695 generic syntax for reusable generic classes and functions

## Why It Matters

Without generics, a reusable container or utility function either loses type information (falls back to `Any`) or requires a separate near-duplicate implementation per type. `TypeVar` (classic) and the PEP 695 `class Foo[T]` / `def foo[T](...)` syntax (3.12+) let one implementation serve many types while the type checker still tracks exactly which type flows in and out, catching mismatches at call sites.

## Bad

```python
from typing import Any

class Stack:
    def __init__(self) -> None:
        self._items: list[Any] = []

    def push(self, item: Any) -> None:
        self._items.append(item)

    def pop(self) -> Any:
        return self._items.pop()

stack = Stack()
stack.push(1)
stack.push("oops")       # no error, even though this stack should hold only ints
value: int = stack.pop()  # type checker can't catch that this might be a str
```

## Good

```python
# Python 3.12+ PEP 695 syntax
class Stack[T]:
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

int_stack: Stack[int] = Stack()
int_stack.push(1)
int_stack.push("oops")   # type error: expected int, got str
value: int = int_stack.pop()
```

## Classic `TypeVar` Syntax (pre-3.12 or library-compatible code)

```python
from typing import TypeVar, Generic

T = TypeVar("T")

class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

# Bounded / constrained TypeVars
from typing import TypeVar

Comparable = TypeVar("Comparable", bound="SupportsLessThan")

def smallest[T: "SupportsLessThan"](items: list[T]) -> T:  # PEP 695 bound
    return min(items)
```

Use `TypeVar(..., bound=X)` (or `[T: X]`) when the type must support specific operations; use `TypeVar(..., contravariant=True/covariant=True)` for variance-sensitive container APIs. Prefer the PEP 695 syntax in new 3.12+ code — it's terser and scopes the type parameter to the class/function automatically.

## See Also

- [`type-self-return`](type-self-return.md) - a specialized generic pattern for fluent/factory methods
- [`type-protocol-structural`](type-protocol-structural.md) - bounding a TypeVar by a Protocol instead of a concrete type
- [`type-alias-statement`](type-alias-statement.md) - generic type aliases with the PEP 695 `type` statement
