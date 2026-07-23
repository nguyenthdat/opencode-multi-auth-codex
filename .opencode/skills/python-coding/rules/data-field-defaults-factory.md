# data-field-defaults-factory

> Use `field(default_factory=...)` for mutable default values on dataclasses

## Why It Matters

A mutable object used as a default value is created exactly once, at class-definition time, and then shared by every instance that doesn't explicitly override it — appending to one instance's "empty" list silently appends to every other instance's list too. `dataclasses` refuses this outright for known mutable types and raises `ValueError` at class-definition time, but `field(default_factory=...)` calls a fresh constructor for every new instance, giving each object its own independent container.

## Bad

```python
from dataclasses import dataclass

@dataclass
class ShoppingCart:
    items: list[str] = []  # dataclasses raises ValueError here immediately:
    # "mutable default <class 'list'> for field items is not allowed"
```

## Good

```python
from dataclasses import dataclass, field

@dataclass
class ShoppingCart:
    items: list[str] = field(default_factory=list)
    metadata: dict[str, str] = field(default_factory=dict)

cart_a = ShoppingCart()
cart_b = ShoppingCart()
cart_a.items.append("widget")
print(cart_b.items)  # [] — each instance got its own independent list
```

## Factories for Non-Trivial Defaults

```python
from dataclasses import dataclass, field
from datetime import datetime, UTC

def _utc_now() -> datetime:
    return datetime.now(UTC)

@dataclass
class AuditLog:
    created_at: datetime = field(default_factory=_utc_now)
    tags: set[str] = field(default_factory=set)
    # default_factory also works for constructing a nested dataclass:
    counters: dict[str, int] = field(default_factory=lambda: {"errors": 0, "warnings": 0})
```

`default_factory` accepts any zero-argument callable — a class, a function,
or a `lambda` — so it composes cleanly with nested dataclasses, `Counter`,
or any custom builder. This is the dataclass-world analog of the classic
"never use a mutable default argument" rule for plain functions.

## See Also

- [`anti-mutable-default-arg`](anti-mutable-default-arg.md) - the same bug in plain function signatures
- [`data-post-init-validation`](data-post-init-validation.md) - validating factory-produced defaults after construction
- [`data-slots-dataclass`](data-slots-dataclass.md) - combining factories with `slots=True` dataclasses
