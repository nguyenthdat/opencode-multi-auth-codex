# api-dataclass-value-object

> Use `@dataclass` for value objects instead of hand-written `__init__`/`__eq__`

## Why It Matters

A value object's entire job is to hold a fixed set of fields and compare equal when those fields match. Hand-writing `__init__`, `__eq__`, `__repr__`, and `__hash__` for every such class is repetitive boilerplate that is easy to get subtly wrong — a forgotten field in `__eq__` silently breaks comparisons, and a missing `__repr__` makes debugging output useless. `@dataclass` generates all of this correctly from the field declarations, keeping the class definition down to exactly the information that's unique to it: the field names and types.

## Bad

```python
class Point:
    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Point):
            return NotImplemented
        return self.x == other.x and self.y == other.y

    def __repr__(self) -> str:
        return f"Point(x={self.x!r}, y={self.y!r})"

    def __hash__(self) -> int:
        return hash((self.x, self.y))
    # 15+ lines before Point does anything domain-specific,
    # and adding a `z` field means updating 4 methods in sync
```

## Good

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float

p1 = Point(1.0, 2.0)
p2 = Point(1.0, 2.0)
assert p1 == p2                 # __eq__ generated correctly from fields
assert repr(p1) == "Point(x=1.0, y=2.0)"  # __repr__ generated too
assert hash(p1) == hash(p2)     # frozen=True also gives a correct __hash__
```

## Adding Behavior Without Losing the Benefit

Dataclasses aren't just for pure data — you can still add methods, validation, and computed properties:

```python
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True)
class Money:
    amount: int  # cents, to avoid float rounding
    currency: str = "USD"

    def __post_init__(self) -> None:
        if self.amount < 0:
            raise ValueError("Money.amount cannot be negative")

    def formatted(self) -> str:
        return f"{self.amount / 100:.2f} {self.currency}"

    def __add__(self, other: "Money") -> "Money":
        if other.currency != self.currency:
            raise ValueError("cannot add different currencies")
        return Money(self.amount + other.amount, self.currency)
```

Reach for a plain class instead of `@dataclass` only when the object has significant internal invariants, mutable state machine behavior, or an identity that matters more than its field values.

## See Also

- [`data-dataclass-vs-pydantic`](data-dataclass-vs-pydantic.md) - choosing between `dataclass` and `pydantic.BaseModel`
- [`api-immutable-value-objects`](api-immutable-value-objects.md) - the `frozen=True` case in more depth
- [`api-dunder-methods`](api-dunder-methods.md) - dunder methods dataclasses generate automatically
