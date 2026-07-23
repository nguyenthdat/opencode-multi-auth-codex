# async-to-thread

> Use `asyncio.to_thread` to offload blocking/CPU calls from async code

## Why It Matters

Not every blocking operation can be rewritten as native async — legacy SDKs, `hashlib`, file compression, and many C-extension libraries have no async API. Calling them directly freezes the event loop, but wrapping them in `asyncio.to_thread` runs them on a worker thread from a shared executor, letting the loop keep servicing other coroutines while the blocking call completes in the background.

## Bad

```python
import hashlib
import asyncio

def compute_checksum(data: bytes) -> str:
    # CPU-bound and takes real wall-clock time for large payloads.
    return hashlib.sha256(data).hexdigest()

async def handle_upload(data: bytes) -> str:
    # Blocks the event loop for the full duration of the hash computation —
    # no other request can be served on this loop meanwhile.
    return compute_checksum(data)
```

## Good

```python
import hashlib
import asyncio

def compute_checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

async def handle_upload(data: bytes) -> str:
    # Runs compute_checksum in a worker thread; the loop stays responsive.
    return await asyncio.to_thread(compute_checksum, data)
```

## Passing Keyword Arguments and Running Many at Once

```python
import asyncio
from pathlib import Path

def read_and_parse(path: Path, *, encoding: str = "utf-8") -> dict:
    text = path.read_text(encoding=encoding)  # blocking disk I/O
    return {"path": str(path), "lines": text.count("\n")}

async def process_files(paths: list[Path]) -> list[dict]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(asyncio.to_thread(read_and_parse, p)) for p in paths]
    return [t.result() for t in tasks]
```

`to_thread` uses the default `ThreadPoolExecutor`, so it's a good fit for
I/O-bound blocking calls. For genuinely CPU-bound work (heavy number
crunching), threads still contend for the GIL — reach for
`multiprocessing`/`ProcessPoolExecutor` instead so the work runs on separate
interpreters/cores.

## See Also

- [`async-no-blocking-call`](async-no-blocking-call.md) - the problem this rule solves
- [`async-multiprocessing-cpu`](async-multiprocessing-cpu.md) - when threads aren't enough because the work is CPU-bound
- [`async-gil-awareness`](async-gil-awareness.md) - why `to_thread` helps I/O-bound but not CPU-bound work
- [`conc-process-pool-executor`](conc-process-pool-executor.md) - the executor-based analog for process pools
