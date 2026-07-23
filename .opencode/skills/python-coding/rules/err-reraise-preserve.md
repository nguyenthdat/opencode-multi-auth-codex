# err-reraise-preserve

> Use a bare `raise` inside `except` to re-raise without losing the original traceback

## Why It Matters

`raise exc` (naming the caught variable) resets the traceback to start at that `raise` line, discarding the frames showing where the exception actually originated — making debugging much harder, since the stack trace no longer points at the real failure site. A bare `raise` (with no argument) inside an `except` block re-raises the *exact* exception object with its original traceback fully intact, which is almost always what you want when re-raising after logging or partial handling.

## Bad

```python
def process_batch(items: list[Item]) -> None:
    for item in items:
        try:
            process(item)
        except ProcessingError as exc:
            logger.error("failed to process %s", item.id)
            raise exc  # resets the traceback to this line, hiding where it really failed
```

## Good

```python
def process_batch(items: list[Item]) -> None:
    for item in items:
        try:
            process(item)
        except ProcessingError:
            logger.error("failed to process %s", item.id)
            raise  # re-raises with the full original traceback intact
```

## Re-Raising After Partial Cleanup

```python
def transfer_funds(src: Account, dst: Account, amount: float) -> None:
    src.debit(amount)
    try:
        dst.credit(amount)
    except AccountFrozenError:
        src.credit(amount)  # roll back the debit
        logger.warning("transfer failed, rolled back debit from %s", src.id)
        raise  # let the original AccountFrozenError propagate, traceback intact
```

The only time to `raise exc` explicitly (instead of a bare `raise`) is when you're deliberately raising a *different* exception object — and even then, prefer `raise NewError(...) from exc` so the chain is explicit rather than accidentally truncated.

## Bare `raise` Outside an `except` Block

```python
def guard(condition: bool) -> None:
    if not condition:
        raise  # RuntimeError: No active exception to re-raise
```

A bare `raise` only has meaning while an exception is currently being handled — calling it outside of an `except` block (or after the handler has finished) raises its own `RuntimeError`. This is a useful signal that the code's control flow assumption was wrong: bare `raise` should only ever appear as the last statement of an `except` clause (possibly after logging or cleanup), never as a general-purpose "propagate an error" mechanism elsewhere.

## See Also

- [`err-raise-from`](err-raise-from.md) - the correct way to raise a *different* exception while preserving cause
- [`err-log-dont-swallow`](err-log-dont-swallow.md) - logging before re-raising, as shown above
- [`err-finally-cleanup`](err-finally-cleanup.md) - avoiding accidental re-raise suppression inside `finally`
