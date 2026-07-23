# conc-avoid-shared-mutable-state

> Minimize shared mutable state between concurrent units of work

## Why It Matters

Every piece of state shared between concurrent tasks, threads, or processes is a potential race condition and a lock that must be acquired correctly everywhere the state is touched — miss one call site and the bug appears only intermittently, often just in production under real load. Designing concurrent work to pass immutable data and communicate through explicit channels (queues, return values, message passing) eliminates entire categories of races by construction, instead of relying on programmers to remember every lock.

## Bad

```python
import threading

_cache: dict[str, list[int]] = {}  # shared, mutable, unguarded

def add_reading(sensor_id: str, value: int) -> None:
    # Two threads calling this for the same sensor_id concurrently can
    # both read the "no list yet" state and each create their own list,
    # silently dropping one thread's readings.
    if sensor_id not in _cache:
        _cache[sensor_id] = []
    _cache[sensor_id].append(value)

def run_sensors(sensor_ids: list[str]) -> None:
    threads = [
        threading.Thread(target=lambda sid=sid: add_reading(sid, 42)) for sid in sensor_ids
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
```

## Good

```python
import threading
from collections import defaultdict

def collect_readings(sensor_ids: list[str]) -> dict[str, list[int]]:
    lock = threading.Lock()
    cache: dict[str, list[int]] = defaultdict(list)

    def add_reading(sensor_id: str, value: int) -> None:
        with lock:
            cache[sensor_id].append(value)

    threads = [
        threading.Thread(target=add_reading, args=(sid, 42)) for sid in sensor_ids
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return dict(cache)
```

## Preferring Message Passing Over Shared State

```python
import queue
import threading

def worker(sensor_id: str, results: queue.Queue) -> None:
    # No shared dict at all — each worker just reports its own result
    # back through a thread-safe queue; nothing needs a lock.
    results.put((sensor_id, 42))

def collect_readings(sensor_ids: list[str]) -> dict[str, int]:
    results: queue.Queue[tuple[str, int]] = queue.Queue()
    threads = [threading.Thread(target=worker, args=(sid, results)) for sid in sensor_ids]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    output = {}
    while not results.empty():
        sensor_id, value = results.get()
        output[sensor_id] = value
    return output
```

`queue.Queue` (and `asyncio.Queue` for coroutines) is itself internally
locked and safe to share, so routing results through a queue instead of a
shared dict often removes the need to reason about locking at all —
concurrency becomes "workers produce, one place consumes" rather than
"everyone mutates the same structure."

## See Also

- [`conc-thread-safety-shared-state`](conc-thread-safety-shared-state.md) - how to lock shared state when it can't be avoided
- [`async-queue-backpressure`](async-queue-backpressure.md) - the async-native message-passing equivalent
- [`data-frozen-immutable`](data-frozen-immutable.md) - immutable data as a way to make sharing inherently safe
- [`async-context-vars`](async-context-vars.md) - isolating per-task state instead of sharing it
