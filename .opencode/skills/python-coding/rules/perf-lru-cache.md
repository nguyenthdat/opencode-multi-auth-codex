# perf-lru-cache

> Use `functools.lru_cache`/`functools.cache` to memoize expensive pure functions

## Why It Matters

Recomputing the same result for the same inputs wastes CPU cycles, and hand-rolled memoization dictionaries are easy to get subtly wrong (unbounded growth, forgetting to key on all arguments, not being thread-safe). `functools.lru_cache` gives you a battle-tested, thread-safe memoization decorator with configurable eviction in one line, plus introspection via `.cache_info()` to verify it's actually helping.

## Bad

```python
import time

def fibonacci(n: int) -> int:
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)  # exponential blowup, recomputes constantly

_cache = {}

def get_config(env: str) -> Config:
    if env not in _cache:  # hand-rolled, unbounded, not thread-safe
        _cache[env] = load_config_from_disk(env)
    return _cache[env]
```

## Good

```python
from functools import cache, lru_cache

@cache  # unbounded cache, fine for a small fixed key space (3.9+)
def fibonacci(n: int) -> int:
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

@lru_cache(maxsize=32)  # bounded, evicts least-recently-used entries
def get_config(env: str) -> Config:
    return load_config_from_disk(env)

print(get_config.cache_info())  # CacheInfo(hits=.., misses=.., maxsize=32, currsize=..)
```

## When Not to Use It

`lru_cache` requires all arguments to be hashable, keeps strong references to every cached argument and result (a memory leak risk for long-lived processes with high-cardinality inputs), and is not appropriate for functions with side effects or that depend on mutable/external state that can change between calls:

```python
# Wrong: result depends on wall-clock time, caching would return stale data
@lru_cache  # BAD
def current_exchange_rate(currency: str) -> float:
    return fetch_live_rate(currency)

# Wrong: unhashable argument (list) raises TypeError at call time
@lru_cache  # BAD
def total(values: list[int]) -> int:
    return sum(values)
```

For per-instance caching that should be released when the object is garbage collected, prefer `functools.cached_property` or a `weakref`-based cache over a module-level `lru_cache` keyed on `self`.

## See Also

- [`res-weakref-cache`](res-weakref-cache.md) - caching that doesn't pin objects in memory
- [`perf-avoid-premature-optimization`](perf-avoid-premature-optimization.md) - confirm the function is actually a bottleneck first
- [`async-context-vars`](async-context-vars.md) - state that varies per call context, not safe to memoize globally
