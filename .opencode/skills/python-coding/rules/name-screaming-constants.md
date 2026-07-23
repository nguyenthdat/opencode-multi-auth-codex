# name-screaming-constants

> Use `SCREAMING_SNAKE_CASE` for module-level constants

## Why It Matters

`SCREAMING_SNAKE_CASE` signals "this value is fixed at import time and should never be reassigned," which helps reviewers immediately spot accidental mutation of shared state. Without this convention, a reader can't tell `timeout = 30` (a local variable someone might reassign) from `TIMEOUT = 30` (a module-wide constant every caller depends on) until they trace all its usages. Linters (`ruff` rule `N816`, `pylint`) and IDEs use the casing to warn when code reassigns something that looks like a constant.

## Bad

```python
# config.py
max_retries = 3          # looks like a mutable local, but it's a shared constant
default_timeout = 30.0
api_base_url = "https://api.example.com/v1"


def fetch(path, timeout=default_timeout):
    # nothing stops a caller from doing `config.default_timeout = 5` elsewhere
    ...
```

## Good

```python
# config.py
MAX_RETRIES = 3
DEFAULT_TIMEOUT = 30.0
API_BASE_URL = "https://api.example.com/v1"


def fetch(path, timeout=DEFAULT_TIMEOUT):
    ...
```

## Typed Constants and `Final`

Pair `SCREAMING_SNAKE_CASE` with `typing.Final` to get static enforcement, not just a naming convention:

```python
from typing import Final

MAX_CONNECTIONS: Final[int] = 100
RETRYABLE_STATUS_CODES: Final[frozenset[int]] = frozenset({408, 429, 500, 502, 503, 504})

# mypy/pyright will flag this as an error, not just a style violation:
# MAX_CONNECTIONS = 200  # error: Cannot assign to final name "MAX_CONNECTIONS"
```

## Class-Level Constants

```python
class RetryPolicy:
    DEFAULT_MAX_ATTEMPTS = 3
    DEFAULT_BACKOFF_SECONDS = 1.5

    def __init__(self, max_attempts: int = DEFAULT_MAX_ATTEMPTS) -> None:
        self.max_attempts = max_attempts
```

## Enum Members Instead of Loose Constants

When constants form a closed set of related values, prefer `enum.Enum` over separate module constants — it groups them under a namespace and prevents invalid values entirely (see `data-enum-over-constants`).

```python
from enum import Enum


class LogLevel(Enum):
    DEBUG = 10
    INFO = 20
    WARNING = 30
    ERROR = 40
```

## See Also

- [`name-snake-case-functions`](name-snake-case-functions.md) - casing for the mutable counterpart, variables
- [`data-enum-over-constants`](data-enum-over-constants.md) - grouping related constants into an `Enum`
- [`data-frozen-immutable`](data-frozen-immutable.md) - making compound constant values truly immutable
- [`api-no-mutable-default`](api-no-mutable-default.md) - a related pitfall when constants are mutable containers
