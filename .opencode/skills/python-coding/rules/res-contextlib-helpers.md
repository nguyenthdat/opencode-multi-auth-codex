# res-contextlib-helpers

> Use `contextlib.contextmanager`/`ExitStack` to build custom resource managers

## Why It Matters

Writing a full class with `__enter__`/`__exit__` for every resource wrapper is verbose and easy to get subtly wrong (forgetting to suppress/re-raise exceptions correctly in `__exit__`). `contextlib.contextmanager` turns a generator function into a context manager with a fraction of the code, and `ExitStack` lets you manage a variable number of resources — or resources decided at runtime — without deeply nested `with` blocks.

## Bad

```python
class TimerContext:
    def __init__(self, label: str) -> None:
        self.label = label

    def __enter__(self) -> "TimerContext":
        import time
        self._start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        import time
        elapsed = time.perf_counter() - self._start
        print(f"{self.label}: {elapsed:.3f}s")
        return False  # boilerplate just to propagate exceptions

# Opening a variable number of files requires manual bookkeeping
def merge_files(paths: list[str]) -> str:
    handles = []
    try:
        for p in paths:
            handles.append(open(p))
        return "".join(h.read() for h in handles)
    finally:
        for h in handles:
            h.close()
```

## Good

```python
import time
from contextlib import contextmanager, ExitStack
from collections.abc import Iterator

@contextmanager
def timer(label: str) -> Iterator[None]:
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        print(f"{label}: {elapsed:.3f}s")

with timer("batch-import"):
    do_import()

def merge_files(paths: list[str]) -> str:
    with ExitStack() as stack:
        handles = [stack.enter_context(open(p)) for p in paths]
        return "".join(h.read() for h in handles)
```

## Handling Exceptions Inside a `@contextmanager`

The generator can catch and suppress exceptions raised in the `with` body:

```python
@contextmanager
def suppress_and_log(*exc_types: type[BaseException]) -> Iterator[None]:
    try:
        yield
    except exc_types as exc:
        print(f"suppressed {exc!r}")
```

## `ExitStack` for Conditional Cleanup

`ExitStack` shines when the set of resources isn't known until runtime, or when you need to transfer ownership of already-acquired resources to a longer-lived object via `pop_all()`:

```python
def open_all(paths: list[str]) -> ExitStack:
    with ExitStack() as stack:
        for p in paths:
            stack.enter_context(open(p))
        return stack.pop_all()  # caller now owns cleanup
```

## See Also

- [`res-context-manager-with`](res-context-manager-with.md) - the `with` statement these helpers plug into
- [`res-async-context-manager`](res-async-context-manager.md) - `asynccontextmanager` for the async equivalent
- [`err-context-manager-cleanup`](err-context-manager-cleanup.md) - cleanup semantics on exception paths
