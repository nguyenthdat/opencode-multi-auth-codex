# async-timeout

> Use `asyncio.timeout()` to bound awaits with a deadline

## Why It Matters

An `await` with no deadline can hang forever if a peer stops responding, a lock never gets released, or a downstream service silently drops the connection — turning a single stuck request into a resource leak that starves the whole application. `asyncio.timeout()` (3.11+) wraps a block of async code with a single, composable deadline that cancels cleanly and raises `TimeoutError`, replacing ad hoc, error-prone combinations of `wait_for` and manual timers.

## Bad

```python
import asyncio
import httpx

async def fetch_status(client: httpx.AsyncClient, url: str) -> int:
    # No deadline: if the server hangs, this coroutine — and whatever
    # is awaiting it — blocks indefinitely.
    resp = await client.get(url)
    return resp.status_code

async def fetch_with_manual_timeout(client: httpx.AsyncClient, url: str) -> int:
    task = asyncio.ensure_future(client.get(url))
    await asyncio.sleep(5)
    if not task.done():
        task.cancel()  # racy, and doesn't actually bound the await above
    resp = await task
    return resp.status_code
```

## Good

```python
import asyncio
import httpx

async def fetch_status(client: httpx.AsyncClient, url: str) -> int:
    async with asyncio.timeout(5):
        resp = await client.get(url)
    return resp.status_code

async def fetch_status_safe(client: httpx.AsyncClient, url: str) -> int | None:
    try:
        async with asyncio.timeout(5):
            resp = await client.get(url)
            return resp.status_code
    except TimeoutError:
        return None
```

## Nesting and Adjusting Deadlines

```python
async def fetch_with_retry_budget(client: httpx.AsyncClient, url: str) -> int:
    # An outer deadline bounds the whole operation; inner attempts share it.
    async with asyncio.timeout(10) as outer:
        for attempt in range(3):
            try:
                async with asyncio.timeout(3):
                    resp = await client.get(url)
                    return resp.status_code
            except TimeoutError:
                if attempt == 2:
                    raise
                continue
    raise AssertionError("unreachable")
```

`asyncio.timeout()` contexts nest correctly and can be rescheduled at runtime
via `.reschedule()`, unlike `asyncio.wait_for`, which wraps a single
awaitable and is awkward to compose. Prefer `timeout()` in new 3.11+ code;
keep `wait_for` only for compatibility with older Python.

## See Also

- [`async-cancellation-handling`](async-cancellation-handling.md) - how the `TimeoutError`/cancellation interacts with cleanup code
- [`async-taskgroup-structured`](async-taskgroup-structured.md) - combining deadlines with structured concurrency
- [`err-context-manager-cleanup`](err-context-manager-cleanup.md) - ensuring resources close when a timeout fires
