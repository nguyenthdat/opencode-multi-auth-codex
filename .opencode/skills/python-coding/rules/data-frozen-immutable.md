# data-frozen-immutable

> Freeze dataclasses/models (`frozen=True`) that represent immutable facts

## Why It Matters

A mutable object that represents a fact — a currency amount, a coordinate, a completed timestamp — invites bugs where one part of the code changes it and another part is still relying on the original value, especially once the object is shared, cached, or used as a dict key. Freezing it with `frozen=True` makes accidental mutation a hard `FrozenInstanceError` at the exact line that attempted it, and makes the object hashable so it can safely live in sets and dict keys.

## Bad

```python
from dataclasses import dataclass

@dataclass
class Money:
    amount: int  # cents
    currency: str

def apply_discount(price: Money, percent: int) -> Money:
    # Mutates the caller's object in place — anyone else holding a
    # reference to `price` now silently sees the discounted value too.
    price.amount = price.amount * (100 - percent) // 100
    return price

original = Money(amount=1000, currency="USD")
discounted = apply_discount(original, 10)
print(original.amount)  # 900 — the "original" was mutated, surprise!
```

## Good

```python
from dataclasses import dataclass, replace

@dataclass(frozen=True, slots=True)
class Money:
    amount: int
    currency: str

def apply_discount(price: Money, percent: int) -> Money:
    # Returns a new instance; the original is untouched and guaranteed
    # immutable — nothing else can silently change it later either.
    return replace(price, amount=price.amount * (100 - percent) // 100)

original = Money(amount=1000, currency="USD")
discounted = apply_discount(original, 10)
print(original.amount)  # 1000 — unchanged, as expected
# original.amount = 500  # raises dataclasses.FrozenInstanceError
```

## Using Frozen Objects as Dict Keys / Set Members

```python
@dataclass(frozen=True, slots=True)
class Coordinate:
    x: int
    y: int

visited: set[Coordinate] = set()
visited.add(Coordinate(1, 2))
visited.add(Coordinate(1, 2))  # deduplicates correctly — frozen dataclasses hash by field values
assert len(visited) == 1
```

Frozen dataclasses auto-generate `__hash__` based on field values (as long
as all fields are themselves hashable), which plain mutable dataclasses do
not get by default. Pydantic models offer the same guarantee via
`model_config = ConfigDict(frozen=True)`.

## See Also

- [`data-dataclass-vs-pydantic`](data-dataclass-vs-pydantic.md) - choosing dataclass vs Pydantic for the frozen object
- [`api-immutable-value-objects`](api-immutable-value-objects.md) - the broader API design principle
- [`data-slots-dataclass`](data-slots-dataclass.md) - combining `frozen` with `slots` for memory efficiency
