# data-enum-over-constants

> Use `Enum`/`StrEnum` (3.11+) instead of raw string/int constants

## Why It Matters

Raw string or int constants (`STATUS_PENDING = "pending"`) give no static guarantee that a variable holding "a status" only ever contains one of the valid values — any typo'd string type-checks and runs fine until it silently fails a comparison at runtime. `Enum` (and `StrEnum` for string-backed values) makes the valid set closed and explicit: a type checker rejects invalid values, `match` statements can be checked for exhaustiveness, and typos like `"pendign"` become an immediate `AttributeError` instead of a silent bug.

## Bad

```python
STATUS_PENDING = "pending"
STATUS_ACTIVE = "active"
STATUS_CLOSED = "closed"

def transition(status: str) -> str:
    if status == STATUS_PENDING:
        return STATUS_ACTIVE
    elif status == STATUS_ACTIVE:
        return STATUS_CLOSED
    return status  # typo'd or invalid input passes straight through, uncaught

transition("pendign")  # returns "pendign" — no error, silently wrong
```

## Good

```python
from enum import StrEnum, auto

class Status(StrEnum):
    PENDING = auto()
    ACTIVE = auto()
    CLOSED = auto()

def transition(status: Status) -> Status:
    match status:
        case Status.PENDING:
            return Status.ACTIVE
        case Status.ACTIVE:
            return Status.CLOSED
        case Status.CLOSED:
            return Status.CLOSED

# transition("pendign")  # type error: str is not Status
transition(Status.PENDING)  # Status.ACTIVE
```

## StrEnum for JSON/API Boundaries

```python
from enum import StrEnum

class Currency(StrEnum):
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"

import json
payload = json.dumps({"currency": Currency.USD})  # serializes as the plain string "USD"
assert payload == '{"currency": "USD"}'
```

`StrEnum` (3.11+) members compare equal to and serialize as plain strings,
so it's a drop-in replacement for string constants at API/JSON boundaries
without needing a custom encoder. For non-string closed sets (HTTP status
codes, error codes), use `IntEnum` for the same closed-set guarantee with
int compatibility.

## See Also

- [`type-literal-constrain`](type-literal-constrain.md) - a lighter-weight alternative when you only need static checking, not runtime identity
- [`anti-stringly-typed`](anti-stringly-typed.md) - the broader anti-pattern this rule addresses
- [`name-screaming-constants`](name-screaming-constants.md) - naming convention for the constants this rule replaces
