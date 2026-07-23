# async-multiprocessing-cpu

> Use multiprocessing for CPU-bound parallelism, not asyncio

## Why It Matters

Asyncio concurrency is cooperative and single-threaded: coroutines interleave only at `await` points, so a CPU-bound function that never awaits (image processing, parsing, number crunching) monopolizes the loop and blocks every other task until it finishes. Because CPython's GIL also prevents true parallel execution of Python bytecode across threads, only separate processes (or a C extension that releases the GIL) can use multiple cores for pure-Python CPU-bound work.

## Bad

```python
import asyncio

def compute_digest(data: bytes) -> int:
    # Pure CPU work: hashing-like loop with no I/O, no await opportunities.
    total = 0
    for byte in data:
        total = (total * 31 + byte) % (2**61 - 1)
    return total

async def process_batch(chunks: list[bytes]) -> list[int]:
    # "Concurrent" in name only — each call runs to completion before the
    # next starts, and it blocks the loop the whole time.
    return [compute_digest(chunk) for chunk in chunks]

async def handle_requests(chunks: list[bytes]) -> list[int]:
    # Any other coroutine scheduled on this loop starves during process_batch.
    return await process_batch(chunks)
```

## Good

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor

def compute_digest(data: bytes) -> int:
    total = 0
    for byte in data:
        total = (total * 31 + byte) % (2**61 - 1)
    return total

async def process_batch(chunks: list[bytes]) -> list[int]:
    loop = asyncio.get_running_loop()
    with ProcessPoolExecutor() as pool:
        futures = [loop.run_in_executor(pool, compute_digest, chunk) for chunk in chunks]
        return await asyncio.gather(*futures)
```

## Choosing Between Approaches

| Workload | Right tool |
|---|---|
| Many concurrent network calls | `asyncio` (I/O-bound, lots of waiting) |
| Legacy blocking SDK call, occasional | `asyncio.to_thread` |
| Heavy pure-Python computation | `ProcessPoolExecutor` / `multiprocessing` |
| Heavy computation in NumPy/C extension | often fine on threads — many release the GIL |

Process pools pay a real cost: input/output must be pickled across the
process boundary, and process startup is slower than thread startup. Batch
work into reasonably sized chunks to amortize that overhead rather than
submitting one item at a time.

## See Also

- [`async-to-thread`](async-to-thread.md) - the right tool for blocking I/O, not CPU-bound work
- [`conc-cpu-bound-multiprocessing`](conc-cpu-bound-multiprocessing.md) - the general concurrency-model guidance this specializes
- [`async-gil-awareness`](async-gil-awareness.md) - why the GIL forces this choice
- [`conc-process-pool-executor`](conc-process-pool-executor.md) - preferring the executor API over raw `multiprocessing.Process`
