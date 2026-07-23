# data-avoid-dict-any

> Avoid passing loosely typed `dict[str, Any]` between layers; model the shape

## Why It Matters

`dict[str, Any]` is a type checker's blind spot: every key access, every value type, and every typo is invisible to static analysis, so bugs that a real model would catch at review time instead surface as `KeyError`/`TypeError` in production. Once a `dict[str, Any]` is threaded through three or four function calls, nobody can tell what it actually contains without reading every call site that populates it.

## Bad

```python
from typing import Any

def build_report(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "total": sum(item["amount"] for item in raw["items"]),  # what shape is "items"?
        "customer": raw["customer"]["name"],  # nested dict, also untyped
    }

def render(report: dict[str, Any]) -> str:
    # Nothing stops a typo like report["totl"] from type-checking cleanly.
    return f"Total: {report['total']} for {report['customer']}"
```

## Good

```python
from dataclasses import dataclass

@dataclass(slots=True, frozen=True)
class LineItem:
    amount: float
    description: str

@dataclass(slots=True, frozen=True)
class Customer:
    name: str
    email: str

@dataclass(slots=True, frozen=True)
class OrderData:
    items: list[LineItem]
    customer: Customer

@dataclass(slots=True, frozen=True)
class Report:
    total: float
    customer_name: str

def build_report(order: OrderData) -> Report:
    total = sum(item.amount for item in order.items)
    return Report(total=total, customer_name=order.customer.name)

def render(report: Report) -> str:
    return f"Total: {report.total} for {report.customer_name}"
    # report.totl would be a static AttributeError, caught before runtime
```

## When a Dict Is Actually Fine

```python
# Genuinely dynamic, homogeneous mappings are fine as dicts:
feature_flags: dict[str, bool] = {"new_checkout": True, "dark_mode": False}
word_counts: dict[str, int] = {"the": 42, "a": 17}
```

`dict[str, T]` for a single concrete `T` is a legitimate, well-typed
mapping. The anti-pattern is specifically `dict[str, Any]` used to represent
a fixed, heterogeneous *shape* — that's a struct in disguise and should be
modeled as one (`TypedDict`, dataclass, or Pydantic model, depending on
whether it's an internal or external boundary).

## See Also

- [`type-typeddict-shape`](type-typeddict-shape.md) - the lightweight typed-dict alternative for JSON-shaped data
- [`data-pydantic-validation`](data-pydantic-validation.md) - modeling the shape when it also needs runtime validation
- [`type-avoid-any`](type-avoid-any.md) - the broader principle `Any` erodes type safety
