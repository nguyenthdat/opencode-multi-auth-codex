# res-async-context-manager

> Use `async with`/`@asynccontextmanager` for async resource cleanup

## Why It Matters

Async resources — network connections, async database sessions, subprocess pipes — often require an `await` to release cleanly (flushing a write buffer, sending a close frame). A synchronous `with` block can't await inside `__exit__`, so async resources need `__aenter__`/`__aexit__` instead. Skipping this and manually calling `await conn.close()` after the fact suffers the same problem as skipping `with` for sync code: an exception between acquire and close leaks the resource, except now it also risks leaving a coroutine's cleanup unawaited, which asyncio flags with `RuntimeWarning: coroutine was never awaited`.

## Bad

```python
import asyncpg

async def fetch_user(dsn: str, user_id: int) -> dict:
    conn = await asyncpg.connect(dsn)
    row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
    if row is None:
        raise ValueError("user not found")  # conn.close() never awaited — leaked connection
    await conn.close()
    return dict(row)
```

## Good

```python
import asyncpg

async def fetch_user(dsn: str, user_id: int) -> dict:
    async with asyncpg.connect(dsn) as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        if row is None:
            raise ValueError("user not found")  # connection still closed on the way out
        return dict(row)
```

## Building One with `@asynccontextmanager`

```python
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

@asynccontextmanager
async def acquired_lease(client: LeaseClient, key: str) -> AsyncIterator[Lease]:
    lease = await client.acquire(key)
    try:
        yield lease
    finally:
        await client.release(lease)  # awaited cleanup, guaranteed on exception too

async def process(client: LeaseClient) -> None:
    async with acquired_lease(client, "job-42") as lease:
        await do_work(lease)
```

## FastAPI's Lifespan Pattern

`fastapi`/`starlette` use exactly this shape for app startup/shutdown, giving one place to pair resource acquisition with guaranteed release:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.pool = await create_pool()
    try:
        yield
    finally:
        await app.state.pool.close()

app = FastAPI(lifespan=lifespan)
```

## See Also

- [`res-context-manager-with`](res-context-manager-with.md) - the synchronous counterpart to this pattern
- [`res-connection-pooling`](res-connection-pooling.md) - reusing async connections instead of opening one per request
- [`async-with-resource`](async-with-resource.md) - broader guidance on `async with` for async resources
