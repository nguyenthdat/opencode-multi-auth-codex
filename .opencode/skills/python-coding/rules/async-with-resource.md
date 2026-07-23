# async-with-resource

> Use `async with`/`async for` for async resources and async iterators

## Why It Matters

Async resources — database connection pools, HTTP clients, websocket sessions — often need to run coroutines during setup and teardown (flushing buffers, closing sockets gracefully), which a plain `with` statement cannot do since `__exit__` is synchronous. Using `async with` (and `async for` for async generators/streams) ensures `__aexit__`/cleanup coroutines actually get awaited, instead of being skipped or run in a way that silently drops errors.

## Bad

```python
import httpx

async def fetch_report(url: str) -> bytes:
    client = httpx.AsyncClient()
    resp = await client.get(url)
    # If the code above raises, client.aclose() never runs — the underlying
    # connection pool and its sockets are leaked.
    await client.aclose()
    return resp.content

async def stream_lines(client: httpx.AsyncClient, url: str) -> list[str]:
    lines = []
    async with client.stream("GET", url) as resp:
        iterator = resp.aiter_lines()
        while True:
            try:
                line = await iterator.__anext__()  # reinventing async for
            except StopAsyncIteration:
                break
            lines.append(line)
    return lines
```

## Good

```python
import httpx

async def fetch_report(url: str) -> bytes:
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        return resp.content
    # client.aclose() is awaited automatically on the way out, even on error.

async def stream_lines(client: httpx.AsyncClient, url: str) -> list[str]:
    lines = []
    async with client.stream("GET", url) as resp:
        async for line in resp.aiter_lines():
            lines.append(line)
    return lines
```

## Writing Your Own Async Context Manager

```python
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

@asynccontextmanager
async def acquire_connection(pool) -> AsyncIterator["Connection"]:
    conn = await pool.acquire()
    try:
        yield conn
    finally:
        await pool.release(conn)  # runs even if the body raises

async def run_query(pool, sql: str) -> list[dict]:
    async with acquire_connection(pool) as conn:
        return await conn.fetch(sql)
```

`contextlib.asynccontextmanager` lets you write async setup/teardown with
plain `try/finally` syntax instead of a full `__aenter__`/`__aexit__` class,
mirroring the sync `@contextmanager` decorator.

## See Also

- [`res-async-context-manager`](res-async-context-manager.md) - the resource-management principle this rule applies
- [`async-with-resource`](async-with-resource.md) - (this rule)
- [`res-connection-pooling`](res-connection-pooling.md) - pooled connections as a common async resource
- [`async-cancellation-handling`](async-cancellation-handling.md) - ensuring `__aexit__` still runs on cancellation
