# conc-process-pool-executor

> Use `ProcessPoolExecutor`/`ThreadPoolExecutor` over managing raw threads/processes

## Why It Matters

Manually creating `threading.Thread` or `multiprocessing.Process` objects means manually tracking their lifecycle: starting them, joining them, propagating exceptions raised inside them, and bounding how many run concurrently. `concurrent.futures.ThreadPoolExecutor`/`ProcessPoolExecutor` handle all of that — worker reuse, a bounded pool size, and `Future` objects that surface exceptions through `.result()` — with a uniform API that works the same whether the workers are threads or processes.

## Bad

```python
import threading

results: dict[int, int] = {}
errors: list[Exception] = []

def worker(i: int) -> None:
    try:
        results[i] = i * i
        if i == 3:
            raise ValueError("boom")
    except Exception as exc:
        # Exceptions raised in a raw Thread are swallowed by default —
        # they print a traceback to stderr but never reach the caller.
        errors.append(exc)

def run(n: int) -> dict[int, int]:
    threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()  # no way to cap concurrency; all n threads start immediately
    return results
```

## Good

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def worker(i: int) -> int:
    if i == 3:
        raise ValueError("boom")
    return i * i

def run(n: int, max_workers: int = 4) -> dict[int, int]:
    results: dict[int, int] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(worker, i): i for i in range(n)}
        for future in as_completed(futures):
            i = futures[future]
            try:
                results[i] = future.result()  # exceptions surface here, not silently
            except ValueError as exc:
                print(f"worker {i} failed: {exc}")
    return results
```

## Swapping Threads for Processes Transparently

```python
from concurrent.futures import ProcessPoolExecutor

def cpu_heavy(n: int) -> int:
    return sum(i * i for i in range(n))

def run_cpu_bound(inputs: list[int]) -> list[int]:
    # Same Executor interface, same submit()/map()/as_completed() API —
    # only the import changes when the bottleneck shifts from I/O to CPU.
    with ProcessPoolExecutor() as pool:
        return list(pool.map(cpu_heavy, inputs))
```

Both executors also support a bounded `max_workers`, giving you the same
throttling behavior you'd otherwise hand-roll with a semaphore around raw
threads/processes.

## See Also

- [`conc-choose-model`](conc-choose-model.md) - deciding whether the pool should use threads or processes
- [`conc-cpu-bound-multiprocessing`](conc-cpu-bound-multiprocessing.md) - the CPU-bound case for `ProcessPoolExecutor`
- [`async-threading-io`](async-threading-io.md) - the I/O-bound case for `ThreadPoolExecutor`
- [`err-reraise-preserve`](err-reraise-preserve.md) - handling exceptions surfaced through `Future.result()`
