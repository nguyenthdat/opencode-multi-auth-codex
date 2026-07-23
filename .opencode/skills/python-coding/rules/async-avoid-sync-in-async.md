# async-avoid-sync-in-async

> Never mix `time.sleep()` with async code; use `asyncio.sleep()`

## Why It Matters

`time.sleep()` blocks the OS thread, and an asyncio event loop runs on a single thread by default, so a `time.sleep()` call inside any coroutine stalls every other task, timer, and I/O callback scheduled on that loop for the full duration of the sleep. `asyncio.sleep()` instead suspends only the calling coroutine and returns control to the loop, which is the entire point of writing async code in the first place.

## Bad

```python
import time
import asyncio

async def poll_until_ready(check) -> None:
    while not check():
        time.sleep(0.5)  # freezes the entire event loop for 0.5s each time

async def retry_with_backoff(fn, attempts: int = 3):
    for attempt in range(attempts):
        try:
            return await fn()
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt)  # blocks every other coroutine too
```

## Good

```python
import asyncio

async def poll_until_ready(check) -> None:
    while not check():
        await asyncio.sleep(0.5)  # yields control back to the loop

async def retry_with_backoff(fn, attempts: int = 3):
    for attempt in range(attempts):
        try:
            return await fn()
        except Exception:
            if attempt == attempts - 1:
                raise
            await asyncio.sleep(2 ** attempt)
```

## Spotting the Mistake in Review

| Symptom | Likely cause |
|---|---|
| Event loop "hangs" periodically at fixed intervals | `time.sleep()` in a coroutine |
| One slow request delays unrelated requests | blocking call not offloaded with `to_thread` |
| `asyncio` debug mode warns "Executing took X seconds" | a synchronous call is running inside a coroutine |

Enable `asyncio.run(main(), debug=True)` (or `PYTHONASYNCIODEBUG=1`) during
development — it logs a warning whenever a callback or task takes too long,
which is often the first sign that a blocking call snuck into async code.

## See Also

- [`async-no-blocking-call`](async-no-blocking-call.md) - the general principle this rule specializes
- [`async-to-thread`](async-to-thread.md) - how to run genuinely blocking code from within async safely
- [`async-timeout`](async-timeout.md) - bounding awaits instead of polling with sleeps where possible
