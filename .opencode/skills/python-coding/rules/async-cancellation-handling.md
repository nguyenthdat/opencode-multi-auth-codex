# async-cancellation-handling

> Handle `asyncio.CancelledError` correctly; never swallow it silently

## Why It Matters

`CancelledError` is how asyncio tells a coroutine "stop now" — for timeouts, task-group failures, or an explicit `.cancel()` call. Catching it with a bare `except Exception` (or worse, `except:`) and continuing normally breaks cancellation propagation: the task looks alive to its parent, timeouts stop working, and `TaskGroup`/`asyncio.timeout()` can hang waiting for a task that will never actually finish being cancelled.

## Bad

```python
import asyncio

async def process_item(item: str) -> str:
    try:
        await asyncio.sleep(10)  # simulate slow work
        return item.upper()
    except Exception:
        # Also catches CancelledError on Python < 3.8 behavior assumptions,
        # and even where it doesn't, this pattern invites the mistake.
        print(f"failed to process {item}")
        return item  # swallows cancellation — caller thinks we finished cleanly

async def run_with_timeout() -> str:
    task = asyncio.create_task(process_item("hello"))
    await asyncio.sleep(0.1)
    task.cancel()
    return await task  # never raises, because the except above ate it
```

## Good

```python
import asyncio

async def process_item(item: str) -> str:
    try:
        await asyncio.sleep(10)
        return item.upper()
    except asyncio.CancelledError:
        print(f"process_item({item!r}) cancelled, cleaning up")
        raise  # always re-raise CancelledError so cancellation propagates
    except ValueError as exc:
        print(f"failed to process {item}: {exc}")
        return item

async def run_with_timeout() -> str:
    task = asyncio.create_task(process_item("hello"))
    await asyncio.sleep(0.1)
    task.cancel()
    try:
        return await task
    except asyncio.CancelledError:
        return "<cancelled>"
```

## Cleanup on Cancellation

```python
async def worker(queue: asyncio.Queue[str]) -> None:
    try:
        while True:
            item = await queue.get()
            await handle(item)
            queue.task_done()
    except asyncio.CancelledError:
        # Do fast, synchronous-ish cleanup here; avoid new long awaits —
        # the task is already being torn down.
        print("worker shutting down")
        raise

async def handle(item: str) -> None: ...
```

Since `BaseException` (which `CancelledError` derives from in 3.8+) is not
caught by `except Exception`, a bare `except Exception` alone is actually
safe — the real bug is code that explicitly catches `CancelledError` (or a
bare `except:`) and fails to re-raise it.

## See Also

- [`async-timeout`](async-timeout.md) - the most common source of cancellation
- [`async-taskgroup-structured`](async-taskgroup-structured.md) - how sibling cancellation depends on this being handled correctly
- [`err-no-bare-except`](err-no-bare-except.md) - the general anti-pattern this rule is a special case of
- [`err-reraise-preserve`](err-reraise-preserve.md) - re-raising exceptions without losing context
