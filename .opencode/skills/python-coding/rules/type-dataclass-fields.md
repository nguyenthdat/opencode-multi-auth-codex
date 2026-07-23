# type-dataclass-fields

> Type every dataclass/attrs field explicitly; never leave a field untyped

## Why It Matters

`@dataclass` generates `__init__`, `__eq__`, and `__repr__` by *introspecting class-level annotations* — an assignment without a type annotation is not treated as a field at all, it's silently ignored by the dataclass machinery. This produces a class that looks correct in the source but is missing constructor parameters, comparison logic, or repr output for the un-annotated attribute, a bug that's easy to miss in review because the code reads as if it should work.

## Bad

```python
from dataclasses import dataclass

@dataclass
class Order:
    order_id: str
    total: float
    status = "pending"  # NOT a field! No annotation means dataclass ignores it.

order = Order("ORD-1", 99.5)
print(order)  # Order(order_id='ORD-1', total=99.5) -- `status` is missing entirely
order2 = Order("ORD-1", 99.5)
order == order2  # True, but `status` was never compared or even constructible per-instance
```

## Good

```python
from dataclasses import dataclass, field

@dataclass
class Order:
    order_id: str
    total: float
    status: str = "pending"  # explicitly typed and defaulted -> a real field

order = Order("ORD-1", 99.5)
print(order)  # Order(order_id='ORD-1', total=99.5, status='pending')
```

## Class Variables Are the One Exception

```python
from dataclasses import dataclass
from typing import ClassVar

@dataclass
class Order:
    order_id: str
    total: float
    # Explicitly excluded from field generation via ClassVar — this is
    # the *correct* way to have a class-level attribute that isn't a field.
    tax_rate: ClassVar[float] = 0.08

Order.tax_rate  # 0.08, shared across all instances, not part of __init__/__eq__/__repr__
```

Use `ClassVar[...]` (not a bare, unannotated assignment) whenever you deliberately want a class-level constant that should *not* become a per-instance field. This keeps the exclusion explicit and visible to both readers and static type checkers, instead of relying on an easy-to-miss missing annotation.

## See Also

- [`data-field-defaults-factory`](data-field-defaults-factory.md) - correctly defaulting mutable fields with `field(default_factory=...)`
- [`data-frozen-immutable`](data-frozen-immutable.md) - making typed dataclass fields immutable
- [`api-no-mutable-default`](api-no-mutable-default.md) - the general mutable-default pitfall this also touches
