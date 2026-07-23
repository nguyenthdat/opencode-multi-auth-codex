# perf-batch-io

> Batch I/O operations (bulk DB inserts, batched HTTP requests) instead of many small calls

## Why It Matters

Every network round trip or disk syscall carries fixed overhead — connection handshake time, TCP latency, database transaction bookkeeping — that dwarfs the cost of the actual data transferred for small payloads. Issuing one call per item turns an operation that should take milliseconds into one that takes seconds or minutes as the item count grows, because you're paying that fixed latency N times instead of once. Batching amortizes the fixed cost across many items in a single call.

## Bad

```python
def save_events(conn, events: list[Event]) -> None:
    for event in events:
        conn.execute(
            "INSERT INTO events (id, payload) VALUES (?, ?)",
            (event.id, event.payload),
        )  # one round trip per event — 10,000 events = 10,000 round trips
    conn.commit()

async def fetch_all_prices(client: httpx.AsyncClient, symbols: list[str]) -> dict[str, float]:
    prices = {}
    for symbol in symbols:
        resp = await client.get(f"/price/{symbol}")  # sequential, one request per symbol
        prices[symbol] = resp.json()["price"]
    return prices
```

## Good

```python
def save_events(conn, events: list[Event]) -> None:
    conn.executemany(
        "INSERT INTO events (id, payload) VALUES (?, ?)",
        [(e.id, e.payload) for e in events],
    )  # single batched round trip
    conn.commit()

async def fetch_all_prices(client: httpx.AsyncClient, symbols: list[str]) -> dict[str, float]:
    resp = await client.post("/prices/batch", json={"symbols": symbols})  # one request
    return resp.json()
```

## Batching Concurrent Requests When No Bulk Endpoint Exists

If the API doesn't support a batch endpoint, batching still helps by running requests concurrently in bounded groups instead of sequentially:

```python
import asyncio

async def fetch_all_prices(client: httpx.AsyncClient, symbols: list[str]) -> dict[str, float]:
    sem = asyncio.Semaphore(10)  # cap concurrency to avoid overwhelming the server

    async def fetch_one(symbol: str) -> tuple[str, float]:
        async with sem:
            resp = await client.get(f"/price/{symbol}")
            return symbol, resp.json()["price"]

    results = await asyncio.gather(*(fetch_one(s) for s in symbols))
    return dict(results)
```

Most database drivers (`psycopg`, `asyncpg`) and ORMs (SQLAlchemy's `bulk_insert_mappings`, Django's `bulk_create`) expose an explicit batch/bulk API for exactly this reason — reach for it before hand-rolling a loop of single-row calls.

## See Also

- [`res-connection-pooling`](res-connection-pooling.md) - reusing connections across the batched calls
- [`async-gather-parallel`](async-gather-parallel.md) - the concurrency primitive used to parallelize independent I/O
- [`res-streaming-large-files`](res-streaming-large-files.md) - the complementary pattern for large sequential I/O
