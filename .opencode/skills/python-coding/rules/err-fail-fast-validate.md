# err-fail-fast-validate

> Validate inputs at the boundary and fail fast with a clear, specific error

## Why It Matters

When invalid input is allowed to flow deep into a system before failing, the resulting error is raised far from its root cause — often as a cryptic `TypeError` or `KeyError` several function calls removed from where the bad value entered. Validating at the boundary (API handler, CLI parser, public function signature) turns a confusing downstream crash into an immediate, specific error that names exactly what was wrong and where.

## Bad

```python
def create_shipment(weight_kg: float, destination: str) -> Shipment:
    rate = _lookup_rate(destination)       # KeyError deep inside if destination is bad
    cost = weight_kg * rate                # silently computes garbage if weight_kg is negative
    return Shipment(weight_kg=weight_kg, destination=destination, cost=cost)

# Caller passes a typo'd country code; the failure surfaces as an opaque
# KeyError inside _lookup_rate, far from create_shipment's own contract.
create_shipment(-5.0, "USA ")  # negative weight AND trailing space both slip through
```

## Good

```python
_VALID_DESTINATIONS = frozenset({"US", "CA", "MX", "UK", "DE"})

def create_shipment(weight_kg: float, destination: str) -> Shipment:
    if weight_kg <= 0:
        raise ValueError(f"weight_kg must be positive, got {weight_kg}")
    if destination not in _VALID_DESTINATIONS:
        raise ValueError(
            f"unknown destination {destination!r}; expected one of {sorted(_VALID_DESTINATIONS)}"
        )
    rate = _lookup_rate(destination)
    return Shipment(weight_kg=weight_kg, destination=destination, cost=weight_kg * rate)

create_shipment(-5.0, "USA ")  # ValueError: weight_kg must be positive, got -5.0 -- immediate, precise
```

## Validating With Pydantic at API Boundaries

```python
from pydantic import BaseModel, Field, field_validator

class ShipmentRequest(BaseModel):
    weight_kg: float = Field(gt=0)
    destination: str

    @field_validator("destination")
    @classmethod
    def destination_must_be_known(cls, v: str) -> str:
        if v not in _VALID_DESTINATIONS:
            raise ValueError(f"unknown destination: {v!r}")
        return v

# FastAPI/Pydantic reject invalid payloads with a structured 422 before
# any application code runs, rather than deep inside business logic.
```

Validate once, at the entry point, with the most specific error message you can produce (what value, what was expected). Internal helper functions can then trust their inputs and skip re-validating the same invariant repeatedly.

## See Also

- [`err-custom-hierarchy`](err-custom-hierarchy.md) - raising a domain-specific error instead of a generic `ValueError`
- [`data-pydantic-validation`](data-pydantic-validation.md) - structured validation at API/data boundaries
- [`type-narrow-guards`](type-narrow-guards.md) - narrowing types as part of the same validation step
