# conc-io-bound-asyncio

> Use asyncio for high-concurrency I/O-bound workloads

## Why It Matters

Threads carry real per-unit overhead — OS-level stack allocation, context-switch cost, and a practical ceiling somewhere in the hundreds to low thousands before scheduling overhead dominates. A single-threaded asyncio event loop can juggle tens of thousands of concurrent sockets because each "task" is just a lightweight coroutine object, not an OS thread, making it the natural fit for workloads that are mostly waiting on the network rather than computing.

## Bad

```python
from concurrent.futures import ThreadPoolExecutor
import requests

def check_endpoint(url: str) -> int:
    return requests.get(url, timeout=5).status_code

def health_check_all(urls: list[str]) -> list[int]:
    # Thousands of URLs -> thousands of OS threads (or a small pool serializing
    # them) -> heavy context-switch and memory overhead for what is pure waiting.
    with ThreadPoolExecutor(max_workers=500) as pool:
        return list(pool.map(check_endpoint, urls))
```

## Good

```python
import asyncio
import httpx

async def check_endpoint(client: httpx.AsyncClient, url: str) -> int:
    resp = await client.get(url, timeout=5)
    return resp.status_code

async def health_check_all(urls: list[str]) -> list[int]:
    async with httpx.AsyncClient() as client:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(check_endpoint(client, url)) for url in urls]
    return [t.result() for t in tasks]
```

## Real-World Example: Concurrent Downloads with Bounded Fan-Out

```python
import asyncio
import httpx

async def download(client: httpx.AsyncClient, sem: asyncio.Semaphore, url: str) -> bytes:
    async with sem:
        resp = await client.get(url)
        return resp.content

async def download_all(urls: list[str], max_concurrent: int = 50) -> list[bytes]:
    sem = asyncio.Semaphore(max_concurrent)
    async with httpx.AsyncClient() as client:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(download(client, sem, u)) for u in urls]
    return [t.result() for t in tasks]
```

This is exactly the model behind async web frameworks (Starlette, FastAPI)
and async DB drivers (`asyncpg`) — thousands of concurrent connections
handled on one or a handful of event-loop threads, with a semaphore
providing an explicit cap so downstream services aren't overwhelmed.

## See Also

- [`conc-choose-model`](conc-choose-model.md) - the general decision framework
- [`async-taskgroup-structured`](async-taskgroup-structured.md) - structured concurrency for the fan-out
- [`async-queue-backpressure`](async-queue-backpressure.md) - bounding memory when producers outpace consumers
- [`async-threading-io`](async-threading-io.md) - the threading alternative when no async library exists
