# async-gil-awareness

> Understand the GIL (and free-threaded 3.13 build) when choosing a concurrency model

## Why It Matters

The Global Interpreter Lock means only one thread executes Python bytecode at a time in the standard CPython build, so threads help with I/O-bound work (the GIL is released during blocking syscalls) but do nothing for CPU-bound pure-Python work, which needs separate processes to use multiple cores. Picking the wrong model — threads for CPU-bound math, or asyncio for something that never awaits — produces code that looks concurrent but runs no faster (or even slower, from added overhead) than a single-threaded version.

## Bad

```python
from concurrent.futures import ThreadPoolExecutor

def is_prime(n: int) -> bool:
    if n < 2:
        return False
    return all(n % i for i in range(2, int(n**0.5) + 1))

def count_primes(numbers: list[int]) -> int:
    # Pure CPU-bound work on threads: the GIL serializes bytecode execution,
    # so this gains nothing over a plain for-loop and adds thread overhead.
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = pool.map(is_prime, numbers)
    return sum(results)
```

## Good

```python
from concurrent.futures import ProcessPoolExecutor

def is_prime(n: int) -> bool:
    if n < 2:
        return False
    return all(n % i for i in range(2, int(n**0.5) + 1))

def count_primes(numbers: list[int]) -> int:
    # Separate processes -> separate GILs -> actual multi-core parallelism.
    with ProcessPoolExecutor() as pool:
        results = pool.map(is_prime, numbers)
    return sum(results)
```

## Decision Table

| Workload | GIL impact | Right tool |
|---|---|---|
| Network calls, disk I/O | GIL released during the blocking syscall | `asyncio` or threads |
| Pure-Python loops, parsing, hashing | GIL held the whole time | `multiprocessing` / `ProcessPoolExecutor` |
| NumPy/pandas vectorized ops | GIL often released in C code | threads can help |
| Free-threaded build (3.13, `--disable-gil`) | no GIL at all | true multi-core threading, but check library thread-safety |

Python 3.13 introduced an experimental free-threaded build (PEP 703) that
removes the GIL entirely. It changes the calculus for CPU-bound threading,
but most third-party C extensions are not yet guaranteed thread-safe under
it — treat it as forward-looking, not yet a default assumption for
production code in 2025/2026.

## See Also

- [`async-multiprocessing-cpu`](async-multiprocessing-cpu.md) - the practical consequence of GIL-bound CPU work
- [`async-threading-io`](async-threading-io.md) - where threads remain the right tool despite the GIL
- [`conc-choose-model`](conc-choose-model.md) - the general decision framework this informs
- [`async-to-thread`](async-to-thread.md) - offloading blocking calls without fighting the GIL
