# async-gather-parallel

> Use `asyncio.gather` to run independent awaitables in parallel

## Why It Matters

Awaiting coroutines one after another runs them sequentially even though nothing depends on the previous result, wasting wall-clock time on I/O-bound work that could overlap. `asyncio.gather` schedules all awaitables concurrently and returns their results in the original order, turning an O(n) sum of latencies into roughly O(1) — the slowest single call — for independent operations.

## Bad

```python
import asyncio
import httpx

async def get_user(client: httpx.AsyncClient, user_id: int) -> dict:
    resp = await client.get(f"/users/{user_id}")
    return resp.json()

async def load_dashboard(client: httpx.AsyncClient) -> tuple[dict, dict, dict]:
    # Each request waits for the previous one to fully complete first.
    profile = await get_user(client, 1)
    orders = await get_user(client, 2)
    settings = await get_user(client, 3)
    return profile, orders, settings
```

## Good

```python
import asyncio
import httpx

async def get_user(client: httpx.AsyncClient, user_id: int) -> dict:
    resp = await client.get(f"/users/{user_id}")
    return resp.json()

async def load_dashboard(client: httpx.AsyncClient) -> tuple[dict, dict, dict]:
    profile, orders, settings = await asyncio.gather(
        get_user(client, 1),
        get_user(client, 2),
        get_user(client, 3),
    )
    return profile, orders, settings
```

## Failure Semantics vs TaskGroup

```python
async def load_dashboard_safe(client: httpx.AsyncClient) -> list[dict | BaseException]:
    # return_exceptions=True prevents one failure from cancelling siblings
    # and collects exceptions as regular values instead of raising.
    results = await asyncio.gather(
        get_user(client, 1),
        get_user(client, 2),
        get_user(client, 3),
        return_exceptions=True,
    )
    return results
```

By default `gather` cancels remaining awaitables on the first exception but
still lets already-scheduled callbacks run, which can leak partially-started
work. Prefer `asyncio.TaskGroup` when you need guaranteed all-or-nothing
cancellation semantics; reach for `gather(return_exceptions=True)` when you
explicitly want a batch of independent results, some of which may fail.

## See Also

- [`async-taskgroup-structured`](async-taskgroup-structured.md) - stricter structured-concurrency alternative with cleaner cancellation
- [`async-timeout`](async-timeout.md) - bound a `gather` call with a deadline
- [`async-lock-primitives`](async-lock-primitives.md) - coordinate gathered tasks that share state
