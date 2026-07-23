# name-leading-underscore-private

> Use a single leading underscore (`_name`) to mark internal, non-public API

## Why It Matters

Python has no enforced access modifiers, so the single leading underscore is the entire contract communicating "this is implementation detail, don't depend on it" to callers, tooling, and `from module import *`. Without it, every attribute and function looks equally public, so consumers start relying on internals, and then any refactor becomes a breaking change. Documentation generators (Sphinx, `pdoc`) and linters also use the underscore convention to decide what belongs in public API docs.

## Bad

```python
class ConnectionPool:
    def __init__(self, size: int) -> None:
        self.size = size
        self.available = []       # implementation detail, but looks public
        self.lock = threading.Lock()

    def acquire(self):
        with self.lock:
            return self.available.pop()

    def refill(self):  # internal helper, but nothing marks it as such
        ...


# Nothing stops external code from doing this and coupling to internals:
pool = ConnectionPool(10)
pool.available.append(fake_connection)
pool.refill()
```

## Good

```python
class ConnectionPool:
    def __init__(self, size: int) -> None:
        self.size = size
        self._available = []
        self._lock = threading.Lock()

    def acquire(self):
        with self._lock:
            return self._available.pop()

    def _refill(self) -> None:
        """Internal: replenish the pool. Not part of the public API."""
        ...
```

## Module-Level Privacy

The same convention applies at module scope, and `from module import *` respects it automatically (unless overridden by `__all__`):

```python
# _internal_utils.py naming a whole module as internal
def _validate_schema(payload: dict) -> None: ...


def public_entry_point(payload: dict) -> dict:
    _validate_schema(payload)
    return payload
```

## Single vs. Double Underscore

A single underscore is a convention only (still accessible: `obj._available`). It communicates intent without enforcing anything, which is the Python idiom — "we're all consenting adults." Reserve double leading underscores for the rarer case of avoiding name collisions in subclasses (see `name-dunder-name-mangling`); don't reach for double underscores just to feel "more private."

## See Also

- [`name-dunder-name-mangling`](name-dunder-name-mangling.md) - the stronger, rarer double-underscore mechanism
- [`api-init-public-surface`](api-init-public-surface.md) - designing what belongs in `__init__` vs. stays private
- [`doc-all-dunder`](doc-all-dunder.md) - `__all__` as the explicit, enforceable public surface
