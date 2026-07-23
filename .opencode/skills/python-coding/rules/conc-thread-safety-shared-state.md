# conc-thread-safety-shared-state

> Guard shared mutable state with locks when using threads

## Why It Matters

Even though the GIL serializes bytecode execution, compound operations like `counter += 1` are not atomic — they decompose into separate load, modify, and store bytecodes, and the GIL can switch threads between any of them. Two threads incrementing the same counter can genuinely lose updates, and any thread reading a partially-updated shared structure can observe an inconsistent state; a `threading.Lock` around the critical section is the only reliable fix.

## Bad

```python
import threading

class RequestCounter:
    def __init__(self) -> None:
        self.count = 0

    def increment(self) -> None:
        # count += 1 is read-modify-write, not atomic — the GIL can switch
        # threads between the read and the write, losing increments.
        self.count += 1

def run_workers(counter: RequestCounter, n_threads: int = 8, per_thread: int = 100_000) -> None:
    threads = [
        threading.Thread(target=lambda: [counter.increment() for _ in range(per_thread)])
        for _ in range(n_threads)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    print(counter.count)  # reliably less than n_threads * per_thread
```

## Good

```python
import threading

class RequestCounter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.count = 0

    def increment(self) -> None:
        with self._lock:
            self.count += 1

def run_workers(counter: RequestCounter, n_threads: int = 8, per_thread: int = 100_000) -> None:
    threads = [
        threading.Thread(target=lambda: [counter.increment() for _ in range(per_thread)])
        for _ in range(n_threads)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    print(counter.count)  # exactly n_threads * per_thread, every time
```

## Preferring Immutability and Thread-Local State

```python
import threading

_local = threading.local()

def get_connection() -> "Connection":
    if not hasattr(_local, "conn"):
        _local.conn = create_connection()  # one connection per thread, no sharing at all
    return _local.conn

def create_connection() -> "Connection": ...
class Connection: ...
```

The cheapest fix for a data race is often to avoid sharing the state at
all — `threading.local()` gives each thread its own instance, and
immutable/frozen objects can be shared freely without any lock because
nothing can mutate them concurrently in the first place.

## See Also

- [`conc-avoid-shared-mutable-state`](conc-avoid-shared-mutable-state.md) - the broader principle of minimizing what needs a lock at all
- [`async-lock-primitives`](async-lock-primitives.md) - the async-native equivalent locking primitives
- [`data-frozen-immutable`](data-frozen-immutable.md) - immutability as a way to sidestep locking entirely
