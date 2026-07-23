# async-taskgroup-structured

> Use `asyncio.TaskGroup` for structured concurrency instead of manual task tracking

## Why It Matters

Manually tracking tasks in a list and awaiting them one by one hides failures: if one task raises, the others keep running unsupervised and their exceptions may be silently dropped when the event loop garbage-collects them. `asyncio.TaskGroup` (3.11+) guarantees that if any child task fails, siblings are cancelled and all exceptions are collected and re-raised together, so a partial failure can never masquerade as success.

## Bad

```python
import asyncio

async def fetch_all(urls: list[str]) -> list[str]:
    tasks = [asyncio.create_task(fetch(url)) for url in urls]
    results = []
    for task in tasks:
        # If task[0] raises, we never cancel task[1], task[2]... — they
        # keep running, and their exceptions (if any) are lost forever.
        results.append(await task)
    return results

async def fetch(url: str) -> str:
    await asyncio.sleep(0.1)
    if "bad" in url:
        raise ValueError(f"bad url: {url}")
    return url
```

## Good

```python
import asyncio

async def fetch_all(urls: list[str]) -> list[str]:
    results: list[str] = []
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch(url)) for url in urls]
    # All tasks finished successfully by the time we exit the `async with`
    # block, or an ExceptionGroup was raised and every sibling was cancelled.
    results = [t.result() for t in tasks]
    return results

async def fetch(url: str) -> str:
    await asyncio.sleep(0.1)
    if "bad" in url:
        raise ValueError(f"bad url: {url}")
    return url
```

## Handling the ExceptionGroup

```python
async def fetch_all_safe(urls: list[str]) -> list[str]:
    try:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(fetch(url)) for url in urls]
    except* ValueError as eg:
        for exc in eg.exceptions:
            print(f"skipping bad url: {exc}")
        return []
    return [t.result() for t in tasks]
```

`TaskGroup` raises an `ExceptionGroup` (or `BaseExceptionGroup`) wrapping every
failure, not just the first one. Use `except*` (PEP 654, 3.11+) to handle
specific exception types within the group without losing the others.

## See Also

- [`async-gather-parallel`](async-gather-parallel.md) - simpler alternative when you don't need per-task cancellation semantics
- [`async-cancellation-handling`](async-cancellation-handling.md) - how cancellation propagates to sibling tasks
- [`err-exception-group`](err-exception-group.md) - handling `ExceptionGroup`/`except*` in general
- [`async-timeout`](async-timeout.md) - bounding a whole task group with a deadline
