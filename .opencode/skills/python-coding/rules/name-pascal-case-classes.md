# name-pascal-case-classes

> Use `PascalCase` for class names (PEP 8)

## Why It Matters

`PascalCase` visually separates types from values at a glance, which matters constantly in Python since classes, instances, and callables all get used as first-class objects. A reviewer scanning `order = Order(items)` instantly knows `Order` is a type being constructed and `order` is the resulting value — that signal disappears if both use the same casing. Type checkers, IDEs, and autocompletion also lean on this convention when disambiguating symbols in hover tooltips and error messages.

## Bad

```python
# snake_case classes - reads like a function call, not a constructor
class order_processor:
    def __init__(self, tax_rate):
        self.tax_rate = tax_rate


class http_client:
    pass


# Inconsistent - class looks like a constant
class HTTP_CLIENT:
    pass
```

## Good

```python
class OrderProcessor:
    def __init__(self, tax_rate):
        self.tax_rate = tax_rate


class HTTPClient:
    pass


class JSONDecoder:
    pass
```

## Acronyms and Exceptions

PEP 8 and common style guides (Google, Django) treat acronyms as regular words in `PascalCase` — capitalize only the first letter unless the acronym is the entire identifier or convention strongly favors all-caps (e.g., `HTTPClient` is idiomatic in the stdlib itself, `http.client.HTTPConnection`).

```python
# Acceptable - stdlib precedent (http.client.HTTPConnection, urllib.error.HTTPError)
class HTTPClient: ...
class URLParser: ...

# Also acceptable, and arguably more consistent for long acronym chains
class HttpClient: ...
class UrlParser: ...

# Exceptions/dataclasses/enums/protocols still follow PascalCase
class ValidationError(Exception): ...

from dataclasses import dataclass


@dataclass(frozen=True)
class Point:
    x: float
    y: float


from enum import Enum


class Status(Enum):
    PENDING = "pending"
    ACTIVE = "active"
```

## See Also

- [`name-snake-case-functions`](name-snake-case-functions.md) - the counterpart convention for functions and variables
- [`name-verb-functions-noun-classes`](name-verb-functions-noun-classes.md) - classes should be nouns, reinforcing PascalCase readability
- [`name-avoid-builtin-shadow`](name-avoid-builtin-shadow.md) - avoid naming classes after builtins like `list` or `dict`
