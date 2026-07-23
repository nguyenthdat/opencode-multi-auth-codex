# anti-stringly-typed

> Don't use raw strings for structured/enum-like data that should be typed

## Why It Matters

A raw string accepts any value, so a fixed set of valid options — order statuses, HTTP methods, currency codes — loses all compile-time and IDE-level protection: typos like `"complted"` pass silently until they hit a runtime `if/elif` chain that doesn't match anything, arguments can be swapped without error, and there is no single place to see the full list of valid values. An `Enum` or `Literal` makes the valid set explicit, lets static type checkers catch typos and swapped arguments, and gives IDEs autocomplete.

## Bad

```python
def process_order(status: str, priority: str) -> None:
    # What are valid statuses? "pending"? "Pending"? "PENDING"?
    if status == "pending":
        ...
    elif status == "completed":
        ...
    else:
        raise ValueError(f"unknown status: {status}")  # only caught at runtime

process_order("complted", "high")   # typo - no error until this line executes
process_order("high", "pending")    # swapped arguments - type checker can't help, both are `str`
```

## Good

```python
from enum import Enum

class OrderStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

def process_order(status: OrderStatus, priority: Priority) -> None:
    match status:
        case OrderStatus.PENDING:
            ...
        case OrderStatus.COMPLETED:
            ...
        case _:
            ...

process_order(OrderStatus.COMPLETED, Priority.HIGH)  # mypy catches a typo'd or swapped call
```

## Parsing at the Boundary

External input (JSON, CLI args, env vars) legitimately arrives as strings — parse it into the enum once at the boundary, then use the typed value everywhere internally:

```python
def handle_webhook(payload: dict) -> None:
    status = OrderStatus(payload["status"])  # raises ValueError with a clear message if invalid
    process_order(status, Priority.MEDIUM)
```

`Literal["pending", "processing", "completed"]` is a lighter-weight alternative to `Enum` when you only need type-checker validation without needing a real class or iteration over members.

## See Also

- [`data-enum-over-constants`](data-enum-over-constants.md) - preferring `Enum` over scattered string/int constants
- [`type-literal-constrain`](type-literal-constrain.md) - `Literal` types as a lighter alternative to `Enum`
- [`data-pydantic-validation`](data-pydantic-validation.md) - validating external string input into typed models
