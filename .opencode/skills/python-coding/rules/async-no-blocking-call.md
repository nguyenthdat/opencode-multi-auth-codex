# async-no-blocking-call

> Never call blocking I/O (`requests.get`, `time.sleep`, sync DB drivers) directly inside async functions

## Why It Matters

An `async def` function only yields control to the event loop at `await` points; a blocking call inside one freezes the entire loop, stalling every other coroutine, timer, and incoming connection until it returns. In a server handling thousands of concurrent requests, one accidental `requests.get()` in a hot path can turn a responsive service into one that serially processes requests like a single-threaded synchronous app.

## Bad

```python
import time
import requests
import asyncio

async def fetch_price(symbol: str) -> float:
    # Blocks the entire event loop for the duration of the HTTP round trip —
    # every other coroutine scheduled on this loop stalls too.
    resp = requests.get(f"https://api.example.com/price/{symbol}")
    return resp.json()["price"]

async def poll_prices(symbols: list[str]) -> dict[str, float]:
    prices = {}
    for symbol in symbols:
        prices[symbol] = await fetch_price(symbol)
        time.sleep(1)  # also blocks the loop — should be asyncio.sleep
    return prices
```

## Good

```python
import asyncio
import httpx

async def fetch_price(client: httpx.AsyncClient, symbol: str) -> float:
    resp = await client.get(f"https://api.example.com/price/{symbol}")
    return resp.json()["price"]

async def poll_prices(symbols: list[str]) -> dict[str, float]:
    async with httpx.AsyncClient() as client:
        prices = {}
        for symbol in symbols:
            prices[symbol] = await fetch_price(client, symbol)
            await asyncio.sleep(1)  # yields control back to the loop
        return prices
```

## When You Can't Avoid a Blocking Library

```python
import asyncio

def legacy_blocking_lookup(symbol: str) -> float:
    ...  # third-party sync SDK with no async equivalent

async def fetch_price_legacy(symbol: str) -> float:
    # Offload to a worker thread so the event loop stays responsive.
    return await asyncio.to_thread(legacy_blocking_lookup, symbol)
```

Some libraries (legacy DB drivers, certain SDKs) have no async equivalent.
In that case wrap the call with `asyncio.to_thread` or run it in an executor
rather than calling it inline — never call it directly from an `async def`.

## See Also

- [`async-to-thread`](async-to-thread.md) - the mechanism for safely calling blocking code from async
- [`async-avoid-sync-in-async`](async-avoid-sync-in-async.md) - the specific `time.sleep` vs `asyncio.sleep` case
- [`async-threading-io`](async-threading-io.md) - alternative model when async isn't available at all
- [`async-gil-awareness`](async-gil-awareness.md) - why blocking calls stall a single-threaded event loop
