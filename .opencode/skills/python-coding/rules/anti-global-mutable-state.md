# anti-global-mutable-state

> Don't rely on mutable module-level global state for application logic

## Why It Matters

Module-level mutable state is implicitly shared by every caller in the process, so any function that reads or writes it has a hidden dependency invisible in its signature — tests become order-dependent (one test's leftover state leaks into the next), concurrent requests in a web server can corrupt each other's data, and reasoning about "what changed this variable" requires searching the entire codebase instead of just the call site. Passing state explicitly, or scoping it to an instance or a request, makes dependencies visible and testable.

## Bad

```python
# cache.py
_cache = {}          # module-level mutable global
_request_count = 0

def get_cached(key):
    return _cache.get(key)

def set_cached(key, value):
    _cache[key] = value

def track_request():
    global _request_count
    _request_count += 1   # shared across every concurrent request in the process

# Tests must reset `_cache` manually or they bleed into each other;
# two requests handled by different threads race on `_request_count`.
```

## Good

```python
from dataclasses import dataclass, field

@dataclass
class RequestCache:
    _store: dict[str, object] = field(default_factory=dict)
    request_count: int = 0

    def get(self, key: str) -> object | None:
        return self._store.get(key)

    def set(self, key: str, value: object) -> None:
        self._store[key] = value

    def track_request(self) -> None:
        self.request_count += 1

# Each request/test gets its own instance - no shared mutable state,
# no cross-test pollution, no data race between concurrent requests.
def handle_request(cache: RequestCache) -> None:
    cache.track_request()
```

## When Module-Level State Is Acceptable

- Truly immutable constants (`MAX_RETRIES = 3`, an `Enum`, a frozen `dataclass`) are fine — they're global but never mutated.
- A process-wide singleton with a narrow, well-understood lifecycle (a connection pool, a logging configuration) is acceptable when explicitly designed as a singleton and documented, not something that accreted implicitly.
- `contextvars.ContextVar` is the correct tool for state that's "global" within a single request/task but must not leak across concurrent asyncio tasks or threads — see `async-context-vars`.

```python
import contextvars

request_id: contextvars.ContextVar[str] = contextvars.ContextVar("request_id")
```

## See Also

- [`async-context-vars`](async-context-vars.md) - the correct primitive for per-task "global" state
- [`anti-god-object`](anti-god-object.md) - centralizing state in one object instead of scattering it globally
- [`test-fixtures-setup`](test-fixtures-setup.md) - dependency injection via fixtures instead of globals in tests
