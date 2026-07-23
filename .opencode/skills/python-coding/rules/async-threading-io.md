# async-threading-io

> Use threads for blocking I/O-bound concurrency when async isn't available

## Why It Matters

Not every codebase or library is async-friendly — many synchronous ORMs, legacy SDKs, and CLI-wrapping tools have no `async`/`await` API at all. Because CPython releases the GIL during blocking I/O syscalls (file reads, socket recv, subprocess wait), threads let multiple I/O-bound operations actually overlap even without an event loop, which is a far better fit than trying to force synchronous code into asyncio via constant `to_thread` calls.

## Bad

```python
import time
import requests

def fetch_page(url: str) -> int:
    resp = requests.get(url)
    return resp.status_code

def fetch_all(urls: list[str]) -> list[int]:
    # Each request waits for the previous one — pure serial I/O wait time
    # even though nothing here is CPU-bound.
    return [fetch_page(url) for url in urls]
```

## Good

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

def fetch_page(url: str) -> int:
    resp = requests.get(url)
    return resp.status_code

def fetch_all(urls: list[str], max_workers: int = 8) -> list[int]:
    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(fetch_page, url): url for url in urls}
        for future in as_completed(futures):
            results.append(future.result())
    return results
```

## Threads vs Async for I/O-Bound Work

```python
from concurrent.futures import ThreadPoolExecutor
import sqlite3

def query_user(db_path: str, user_id: int) -> dict | None:
    # sqlite3's stdlib driver is synchronous — no async equivalent exists
    # in the standard library, so threads are the natural fit here.
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

def query_many(db_path: str, ids: list[int]) -> list[dict | None]:
    with ThreadPoolExecutor(max_workers=4) as pool:
        return list(pool.map(lambda uid: query_user(db_path, uid), ids))
```

Threads scale well into the dozens or low hundreds for I/O-bound work, but
each thread carries real memory and OS scheduling overhead — asyncio scales
to thousands of concurrent operations far more cheaply when a native async
library is available. Prefer async-native libraries first; fall back to
threads for blocking dependencies you don't control.

## See Also

- [`conc-io-bound-asyncio`](conc-io-bound-asyncio.md) - the async-first alternative when a native library exists
- [`conc-process-pool-executor`](conc-process-pool-executor.md) - the executor API used here
- [`async-to-thread`](async-to-thread.md) - calling one blocking function from inside an async application
- [`conc-thread-safety-shared-state`](conc-thread-safety-shared-state.md) - guarding shared state across these worker threads
