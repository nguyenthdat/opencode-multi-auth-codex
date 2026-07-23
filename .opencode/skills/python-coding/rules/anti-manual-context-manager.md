# anti-manual-context-manager

> Don't manually call `__enter__`/`__exit__` instead of using `with`

## Why It Matters

Calling `__enter__`/`__exit__` by hand means the cleanup call has to be placed correctly by the author on every exit path, including exceptions — miss the `try/finally` around it, and a raised exception skips the cleanup entirely, leaking a file handle, connection, or lock. The `with` statement is precisely the language feature that guarantees `__exit__` runs regardless of how the block exits, so writing the manual equivalent is strictly more code for a strictly less reliable result.

## Bad

```python
def read_config(path):
    f = open(path)
    f.__enter__()
    data = f.read()
    f.__exit__(None, None, None)   # never runs if f.read() raises
    return data

lock = threading.Lock()
lock.__enter__()
shared_counter.increment()
lock.__exit__(None, None, None)    # leaked forever if increment() raises
```

## Good

```python
def read_config(path: str) -> str:
    with open(path) as f:
        return f.read()

lock = threading.Lock()
with lock:
    shared_counter.increment()
```

## Manual `ExitStack` for Dynamic Cases

The one legitimate case for touching the protocol directly is when the number of context managers is only known at runtime — even then, use `contextlib.ExitStack`, which still guarantees correct unwinding, rather than calling `__enter__`/`__exit__` yourself:

```python
from contextlib import ExitStack

def merge_files(paths: list[str], output_path: str) -> None:
    with ExitStack() as stack:
        files = [stack.enter_context(open(p)) for p in paths]
        out = stack.enter_context(open(output_path, "w"))
        for f in files:
            out.write(f.read())
        # every file, and out, is guaranteed closed here even if one read() raises
```

`ExitStack.enter_context()` still calls `__enter__` internally, but it registers the matching `__exit__` on an internal stack that unwinds correctly on any exception — the guarantee `with` gives you, generalized to a dynamic count of managers.

## Ruff Rule

Ruff's `SIM115` flags files opened without a context manager, a common variant of this same mistake:

```python
f = open("data.txt")   # SIM115: Use a context manager for opening files
data = f.read()
f.close()
```

```toml
[tool.ruff.lint]
select = ["SIM"]
```

## See Also

- [`res-context-manager-with`](res-context-manager-with.md) - the general case for preferring `with` for resource cleanup
- [`res-contextlib-helpers`](res-contextlib-helpers.md) - `ExitStack` and `contextmanager` for building custom managers
- [`err-context-manager-cleanup`](err-context-manager-cleanup.md) - how `__exit__` interacts with exception propagation
