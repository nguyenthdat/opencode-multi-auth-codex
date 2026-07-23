# anti-isinstance-type-check-abuse

> Don't chain `isinstance`/`type()` checks as a substitute for polymorphism or `match`

## Why It Matters

A long `if isinstance(x, A): ... elif isinstance(x, B): ...` chain duplicates the type-dispatch logic that polymorphism already provides for free, and it has to be found and updated at every call site whenever a new type is added — miss one, and the `else` branch silently mishandles the new case at runtime instead of failing at the one place a virtual method dispatch would have caught it. It also fights the type checker: `mypy`/`pyright` can verify an abstract method is implemented on every subclass, but they can't verify every `isinstance` chain in the codebase was updated to match.

## Bad

```python
def calculate_area(shape):
    if isinstance(shape, Circle):
        return 3.14159 * shape.radius ** 2
    elif isinstance(shape, Rectangle):
        return shape.width * shape.height
    elif isinstance(shape, Triangle):
        return 0.5 * shape.base * shape.height
    else:
        raise TypeError(f"unknown shape: {type(shape)}")

# Adding `Hexagon` means finding every isinstance chain like this
# one across the codebase and remembering to add a branch to each.
```

## Good

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

class Circle(Shape):
    def __init__(self, radius: float) -> None:
        self.radius = radius
    def area(self) -> float:
        return 3.14159 * self.radius ** 2

class Rectangle(Shape):
    def __init__(self, width: float, height: float) -> None:
        self.width, self.height = width, height
    def area(self) -> float:
        return self.width * self.height

def calculate_area(shape: Shape) -> float:
    return shape.area()

# Adding Hexagon means implementing `area()` once - the abstract
# base class forces every subclass to provide it, checked statically.
```

## When isinstance/match Is the Right Tool

Dispatching over types you don't own (stdlib types, third-party classes) or over a genuinely closed, small set of variants is exactly what `match`/`isinstance` is for — that's not abuse, it's the intended use:

```python
def to_json_value(value: str | int | float | bool | None) -> str:
    match value:
        case None:
            return "null"
        case bool():
            return "true" if value else "false"
        case int() | float():
            return str(value)
        case str():
            return f'"{value}"'
```

The distinction: if you *own* the class hierarchy and the set of types will grow, prefer polymorphism (or `@singledispatch`). If the set is closed and external, `match`/`isinstance` is idiomatic.

## See Also

- [`api-protocol-over-abc`](api-protocol-over-abc.md) - structural typing as an alternative to inheritance-based dispatch
- [`type-narrow-guards`](type-narrow-guards.md) - narrowing types safely within a branch
- [`anti-god-object`](anti-god-object.md) - long dispatch chains are often a symptom of a class doing too much
