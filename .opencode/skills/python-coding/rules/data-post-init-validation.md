# data-post-init-validation

> Use `__post_init__`/validators to enforce invariants at construction time

## Why It Matters

A dataclass with no validation lets any combination of field values be constructed, including ones that violate the type's basic invariants — a negative age, an empty required string, a start date after an end date. Enforcing the invariant in `__post_init__` means an invalid object simply cannot exist; every function that later receives that type can assume the invariant holds instead of re-checking it defensively everywhere it's used.

## Bad

```python
from dataclasses import dataclass
from datetime import date

@dataclass
class DateRange:
    start: date
    end: date

def days_in_range(r: DateRange) -> int:
    # Has to defensively guard against an invariant the type itself
    # should have guaranteed — and every other caller must remember to too.
    if r.end < r.start:
        raise ValueError("invalid range")
    return (r.end - r.start).days

bad_range = DateRange(start=date(2026, 1, 10), end=date(2026, 1, 1))  # constructs fine!
```

## Good

```python
from dataclasses import dataclass
from datetime import date

@dataclass
class DateRange:
    start: date
    end: date

    def __post_init__(self) -> None:
        if self.end < self.start:
            raise ValueError(f"end ({self.end}) must not precede start ({self.start})")

def days_in_range(r: DateRange) -> int:
    # No need to re-check — a DateRange that exists is guaranteed valid.
    return (r.end - r.start).days

# DateRange(start=date(2026, 1, 10), end=date(2026, 1, 1))  # raises ValueError immediately
```

## Normalizing Fields in `__post_init__`

```python
from dataclasses import dataclass, field

@dataclass(frozen=True)
class Email:
    address: str

    def __post_init__(self) -> None:
        normalized = self.address.strip().lower()
        if "@" not in normalized:
            raise ValueError(f"not a valid email: {self.address!r}")
        # frozen dataclasses need object.__setattr__ to modify a field
        # from within __post_init__.
        object.__setattr__(self, "address", normalized)
```

Pydantic models offer the equivalent via `@model_validator(mode="after")`
or `@field_validator`, and are often preferable when the type sits at an
external boundary and needs coercion in addition to validation, not just
invariant checking on already-typed data.

## See Also

- [`data-pydantic-validation`](data-pydantic-validation.md) - the boundary-validation alternative
- [`data-frozen-immutable`](data-frozen-immutable.md) - combining post-init validation with immutability
- [`err-fail-fast-validate`](err-fail-fast-validate.md) - the general fail-fast principle this rule implements
