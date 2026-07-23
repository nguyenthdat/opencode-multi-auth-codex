# err-exception-group

> Use `ExceptionGroup`/`except*` (PEP 654, 3.11+) to handle concurrent/multiple failures

## Why It Matters

Concurrent code (an `asyncio.TaskGroup`, a batch of independent validations) can produce more than one failure at once, but traditional `try/except` can only ever represent a single exception in flight. Before PEP 654, developers either dropped all but the first failure or manually collected them into a list, losing Python's native traceback formatting and `except`-based dispatch. `ExceptionGroup` bundles multiple unrelated exceptions together, and `except*` lets you handle each contained type distinctly, in one call to `except*`.

## Bad

```python
import asyncio

async def validate_all(records: list[Record]) -> None:
    errors = []
    for record in records:
        try:
            await validate(record)
        except ValidationError as exc:
            errors.append(exc)  # only the first, or a manually built list
    if errors:
        # loses structured traceback info, and no per-type dispatch downstream
        raise RuntimeError(f"{len(errors)} validation errors: {errors}")
```

## Good

```python
async def validate_all(records: list[Record]) -> None:
    errors: list[Exception] = []
    async with asyncio.TaskGroup() as tg:
        for record in records:
            async def _run(r=record) -> None:
                try:
                    await validate(r)
                except ValidationError as exc:
                    errors.append(exc)
            tg.create_task(_run())
    if errors:
        raise ExceptionGroup("validation failed", errors)

async def main() -> None:
    try:
        await validate_all(records)
    except* ValidationError as eg:
        for exc in eg.exceptions:
            logger.warning("invalid record: %s", exc)
    except* ConnectionError as eg:
        logger.error("network failure during validation: %s", eg.exceptions)
```

## `TaskGroup` Raises `ExceptionGroup` Automatically

```python
async def fetch_all(urls: list[str]) -> list[bytes]:
    results: list[bytes] = []
    try:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(fetch(url)) for url in urls]
    except* TimeoutError as eg:
        raise ServiceUnavailableError(f"{len(eg.exceptions)} requests timed out") from eg
    return [t.result() for t in tasks]
```

If any task inside an `asyncio.TaskGroup` raises, the others are cancelled and all resulting exceptions are collected into a single `ExceptionGroup` — you must use `except*` (not plain `except`) to catch specific exception types nested inside it.

## See Also

- [`async-taskgroup-structured`](async-taskgroup-structured.md) - the structured concurrency primitive that raises `ExceptionGroup`
- [`err-custom-hierarchy`](err-custom-hierarchy.md) - designing exception types that dispatch cleanly under `except*`
- [`async-cancellation-handling`](async-cancellation-handling.md) - how cancellation interacts with grouped task failures
