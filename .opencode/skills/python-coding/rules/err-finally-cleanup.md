# err-finally-cleanup

> Use `finally` only for cleanup side effects, never for control flow or return values

## Why It Matters

A `return`, `break`, or `continue` inside `finally` unconditionally overrides any exception or return value from the `try`/`except` blocks — silently discarding the real outcome, including exceptions that were about to propagate. This produces one of the most surprising behaviors in Python: code that looks like it's just "cleaning up" actually swallows errors and replaces return values without any visible indication at the call site.

## Bad

```python
def get_value(d: dict, key: str) -> int:
    try:
        return d[key]
    except KeyError:
        raise ValueError(f"missing key: {key}")
    finally:
        return -1  # BUG: this discards the ValueError AND the successful return!

get_value({"a": 1}, "a")   # returns -1, not 1
get_value({}, "missing")   # returns -1, the ValueError is silently swallowed
```

## Good

```python
def get_value(d: dict, key: str) -> int:
    try:
        return d[key]
    except KeyError:
        raise ValueError(f"missing key: {key}")
    finally:
        logger.debug("get_value lookup attempted for key=%s", key)  # side effect only

get_value({"a": 1}, "a")   # returns 1
get_value({}, "missing")   # raises ValueError, as expected
```

## Correct Uses of `finally`

```python
def process_file(path: str) -> list[str]:
    f = open(path)
    try:
        return f.readlines()
    finally:
        f.close()  # always runs: on success, on exception, even on early return

def with_timing(fn: Callable[[], None]) -> None:
    start = time.monotonic()
    try:
        fn()
    finally:
        elapsed = time.monotonic() - start
        metrics.record("duration_seconds", elapsed)  # always record, regardless of outcome
```

`finally` should only ever contain side effects that must happen unconditionally — closing a handle, releasing a lock, recording a metric, decrementing a counter. Never place `return`, `break`, `continue`, or a bare (re-)`raise` that changes the outcome inside `finally`; if a linter (ruff's `B012`) flags it, that's a real bug, not a style nitpick.

## See Also

- [`err-context-manager-cleanup`](err-context-manager-cleanup.md) - preferring a context manager over manual `try/finally`
- [`err-try-else`](err-try-else.md) - keeping success-path logic out of `try` and `finally` alike
- [`err-reraise-preserve`](err-reraise-preserve.md) - correctly re-raising without accidentally overriding it in `finally`
