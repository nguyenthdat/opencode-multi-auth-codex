# err-try-else

> Use `try/except/else` to separate risky code from the success-path logic

## Why It Matters

Putting success-path code inside the `try` block means any bug in that code (not just the operation you meant to guard) gets caught by the same `except` clause, potentially masking a real programming error as if it were the expected failure mode. The `else` clause runs only when no exception was raised, so it clearly documents "this is what happens on success" and keeps the `except` handler scoped to the one operation that can actually fail.

## Bad

```python
def process_order(order_id: str) -> None:
    try:
        order = fetch_order(order_id)   # can raise OrderNotFoundError
        total = compute_total(order)    # a bug here gets swallowed too
        send_confirmation(order, total) # so does a bug here
    except OrderNotFoundError:
        logger.warning("order not found: %s", order_id)
```

If `compute_total` has a bug that raises `TypeError`, it's silently absorbed by an `except` clause that was only ever meant to catch "order not found."

## Good

```python
def process_order(order_id: str) -> None:
    try:
        order = fetch_order(order_id)
    except OrderNotFoundError:
        logger.warning("order not found: %s", order_id)
        return
    else:
        total = compute_total(order)
        send_confirmation(order, total)
```

Now a bug in `compute_total` or `send_confirmation` propagates as a genuine, visible exception instead of being mistaken for a missing order.

## With `for`/`while` Loops Too

```python
def find_first_valid(candidates: list[str]) -> str:
    for candidate in candidates:
        try:
            validate(candidate)
        except ValidationError:
            continue
        else:
            return candidate  # runs only if validate() succeeded
    raise NoValidCandidateError(candidates)
```

`else` on `for`/`while` (unrelated to exceptions) runs when the loop completes without `break` — combine it with `try/except` inside the loop body when you need "first success wins" semantics like the example above.

## Combining `try`/`except`/`else`/`finally`

All four clauses can appear together, each with a distinct, well-defined role:

```python
def process_order(order_id: str) -> None:
    connection = acquire_connection()
    try:
        order = fetch_order(connection, order_id)
    except OrderNotFoundError:
        logger.warning("order not found: %s", order_id)
    else:
        # only runs if fetch_order succeeded
        total = compute_total(order)
        send_confirmation(order, total)
    finally:
        # always runs, regardless of success, failure, or return
        connection.release()
```

Reading top to bottom: `try` holds only the risky call, `except` handles its specific failure, `else` holds the success-path logic (also protected from being caught by the `except` above it), and `finally` guarantees the connection is released no matter what happened.

## See Also

- [`err-specific-except`](err-specific-except.md) - keeping the `except` clause itself narrow
- [`err-finally-cleanup`](err-finally-cleanup.md) - what belongs in `finally` versus `else`
- [`err-fail-fast-validate`](err-fail-fast-validate.md) - validating before entering the risky block at all
