# async-queue-backpressure

> Use `asyncio.Queue` for bounded producer/consumer backpressure

## Why It Matters

An unbounded producer that outpaces its consumer will keep piling work into memory — an in-memory list, an unbounded queue — until the process runs out of RAM and crashes. A bounded `asyncio.Queue` makes `put()` block (await) once it's full, applying natural backpressure that slows the producer down to the consumer's actual processing rate instead of buffering unboundedly.

## Bad

```python
import asyncio

async def producer(buffer: list[str]) -> None:
    for i in range(1_000_000):
        # Nothing here ever slows down if the consumer falls behind —
        # buffer grows without bound.
        buffer.append(f"event-{i}")
        await asyncio.sleep(0)

async def consumer(buffer: list[str]) -> None:
    while True:
        if buffer:
            item = buffer.pop(0)  # O(n) pop from front, and racy without a lock
            await handle(item)
        await asyncio.sleep(0.01)

async def handle(item: str) -> None:
    await asyncio.sleep(0.05)  # consumer is slower than producer
```

## Good

```python
import asyncio

async def producer(queue: asyncio.Queue[str]) -> None:
    for i in range(1_000_000):
        # Blocks here once the queue is full, throttling the producer to
        # match the consumer's real throughput.
        await queue.put(f"event-{i}")
    await queue.put(None)  # sentinel to signal completion

async def consumer(queue: asyncio.Queue[str]) -> None:
    while (item := await queue.get()) is not None:
        await handle(item)
        queue.task_done()

async def handle(item: str) -> None:
    await asyncio.sleep(0.05)

async def run_pipeline() -> None:
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
    async with asyncio.TaskGroup() as tg:
        tg.create_task(producer(queue))
        tg.create_task(consumer(queue))
```

## Multiple Consumers (Worker Pool)

```python
async def run_worker_pool(queue: asyncio.Queue[str], num_workers: int = 4) -> None:
    async def worker() -> None:
        while (item := await queue.get()) is not None:
            await handle(item)
            queue.task_done()

    async with asyncio.TaskGroup() as tg:
        tg.create_task(producer(queue))
        for _ in range(num_workers):
            tg.create_task(worker())
```

Sizing `maxsize` is a deliberate tradeoff: too small and throughput suffers
from producer/consumer ping-pong; too large and you've just moved the
unbounded-memory problem further out. Pick a size based on measured
consumer latency and acceptable memory footprint.

## See Also

- [`async-lock-primitives`](async-lock-primitives.md) - other async coordination primitives alongside queues
- [`async-taskgroup-structured`](async-taskgroup-structured.md) - running producer/consumer tasks with structured concurrency
- [`res-streaming-large-files`](res-streaming-large-files.md) - a related bounded-memory streaming pattern
