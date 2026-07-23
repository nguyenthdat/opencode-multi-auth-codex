# res-del-not-guaranteed

> Don't rely on `__del__` for critical cleanup; CPython timing isn't guaranteed everywhere

## Why It Matters

`__del__` runs when an object's reference count hits zero in CPython, but that is an implementation detail, not a language guarantee — PyPy and other runtimes may delay finalization arbitrarily, reference cycles can defer collection until the cyclic GC runs (or never, if `gc` is disabled), and at interpreter shutdown the order of finalization is undefined, so globals your `__del__` depends on may already be `None`. Code that depends on `__del__` to release locks, flush buffers, or close connections can leak resources or crash with cryptic `AttributeError`s during shutdown.

## Bad

```python
class DatabaseConnection:
    def __init__(self, dsn: str) -> None:
        self._conn = _low_level_connect(dsn)

    def __del__(self) -> None:
        # Not guaranteed to run promptly, or at all before process exit.
        # At interpreter shutdown, `_low_level_connect`'s module globals
        # may already be torn down, raising inside __del__ (silently swallowed).
        self._conn.close()

def run_query(dsn: str, sql: str) -> list[tuple]:
    conn = DatabaseConnection(dsn)
    return conn._conn.execute(sql).fetchall()
    # relies on __del__ eventually closing conn — timing is unpredictable
```

## Good

```python
from types import TracebackType

class DatabaseConnection:
    def __init__(self, dsn: str) -> None:
        self._conn = _low_level_connect(dsn)

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "DatabaseConnection":
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self.close()

def run_query(dsn: str, sql: str) -> list[tuple]:
    with DatabaseConnection(dsn) as conn:
        return conn._conn.execute(sql).fetchall()  # deterministic close on scope exit
```

## When `__del__` Is Still Appropriate

`__del__` can be a *safety net* that logs a warning if a resource was never explicitly closed — a backstop, not the primary cleanup path:

```python
import warnings

class DatabaseConnection:
    def __init__(self, dsn: str) -> None:
        self._conn = _low_level_connect(dsn)
        self._closed = False

    def close(self) -> None:
        if not self._closed:
            self._conn.close()
            self._closed = True

    def __del__(self) -> None:
        if not self._closed:
            warnings.warn(
                f"{self!r} was never closed explicitly", ResourceWarning, stacklevel=2
            )
```

This mirrors what `io.IOBase` and `asyncio` transports do: emit a `ResourceWarning` on the finalizer path, but never treat it as the mechanism callers should depend on.

## See Also

- [`res-context-manager-with`](res-context-manager-with.md) - the deterministic alternative to `__del__`
- [`res-file-handles-close`](res-file-handles-close.md) - the specific case of files and sockets
- [`res-gc-cycles`](res-gc-cycles.md) - how reference cycles delay or block collection entirely
