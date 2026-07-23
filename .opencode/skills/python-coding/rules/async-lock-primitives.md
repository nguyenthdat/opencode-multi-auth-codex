# async-lock-primitives

> Use `asyncio.Lock`/`Semaphore`/`Event` for async-safe coordination

## Why It Matters

`threading.Lock` blocks the OS thread it's acquired on, which — used inside a coroutine — would freeze the entire event loop rather than just the calling task, defeating the purpose of async concurrency. `asyncio`'s own `Lock`, `Semaphore`, and `Event` are designed to `await` cooperatively: they suspend only the current task, letting the loop keep running everything else while a task waits its turn.

## Bad

```python
import asyncio
import threading

_counter_lock = threading.Lock()
_counter = 0

async def increment() -> int:
    global _counter
    # Blocks the whole event loop while held, even though this is meant
    # to protect a tiny, fast in-memory counter used from async code.
    with _counter_lock:
        _counter += 1
        return _counter

async def rate_limited_call(sem_count: int, urls: list[str]) -> None:
    # No limiting mechanism at all — fires every request at once.
    await asyncio.gather(*(fetch(url) for url in urls))

async def fetch(url: str) -> None: ...
```

## Good

```python
import asyncio

_counter_lock = asyncio.Lock()
_counter = 0

async def increment() -> int:
    global _counter
    async with _counter_lock:
        _counter += 1
        return _counter

async def rate_limited_call(max_concurrent: int, urls: list[str]) -> None:
    semaphore = asyncio.Semaphore(max_concurrent)

    async def bounded_fetch(url: str) -> None:
        async with semaphore:
            await fetch(url)

    async with asyncio.TaskGroup() as tg:
        for url in urls:
            tg.create_task(bounded_fetch(url))

async def fetch(url: str) -> None: ...
```

## Signaling Readiness with `Event`

```python
async def wait_for_startup(ready: asyncio.Event) -> None:
    await ready.wait()  # suspends this task only, until set() is called
    print("dependency is ready, proceeding")

async def initialize(ready: asyncio.Event) -> None:
    await asyncio.sleep(1)  # simulate slow startup work
    ready.set()

async def main() -> None:
    ready = asyncio.Event()
    async with asyncio.TaskGroup() as tg:
        tg.create_task(initialize(ready))
        tg.create_task(wait_for_startup(ready))
```

`asyncio.Lock`, `Semaphore`, `Event`, and `Condition` are not thread-safe and
must only be used from coroutines running on the same event loop — never
share them across threads or processes.

## See Also

- [`async-queue-backpressure`](async-queue-backpressure.md) - a higher-level coordination primitive built on similar principles
- [`async-avoid-sync-in-async`](async-avoid-sync-in-async.md) - the broader mistake of mixing sync primitives into async code
- [`conc-thread-safety-shared-state`](conc-thread-safety-shared-state.md) - the thread-based analog of this problem
