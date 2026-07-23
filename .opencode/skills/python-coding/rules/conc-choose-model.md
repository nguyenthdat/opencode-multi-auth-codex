# conc-choose-model

> Choose asyncio vs threading vs multiprocessing deliberately based on the workload's bottleneck

## Why It Matters

Python offers three different concurrency models with very different performance characteristics and failure modes, and picking the wrong one produces code that looks concurrent but delivers none of the expected speedup — or worse, introduces subtle races. The right choice depends entirely on where the workload actually spends its time: waiting on network/disk (asyncio or threads), waiting on a blocking legacy API (threads), or burning CPU cycles in pure Python (multiprocessing).

## Bad

```python
import asyncio
import hashlib

def sha256_file(path: str) -> str:
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()

async def hash_all(paths: list[str]) -> list[str]:
    # asyncio picked reflexively for "concurrency" even though this is
    # CPU-bound work with no I/O overlap opportunity — it runs serially
    # and blocks the loop, gaining nothing over a plain for-loop.
    return [sha256_file(p) for p in paths]
```

## Good

```python
import hashlib
from concurrent.futures import ProcessPoolExecutor

def sha256_file(path: str) -> str:
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()

def hash_all(paths: list[str]) -> list[str]:
    # CPU-bound hashing across many files -> multiple processes, real
    # parallelism across cores instead of fighting the GIL.
    with ProcessPoolExecutor() as pool:
        return list(pool.map(sha256_file, paths))
```

## Decision Framework

| Bottleneck | Model | Why |
|---|---|---|
| Thousands of concurrent sockets/HTTP calls | `asyncio` | cheapest concurrency unit, scales to high fan-out |
| Blocking legacy library, moderate fan-out | `threading`/`ThreadPoolExecutor` | GIL releases during I/O syscalls |
| Pure-Python CPU-heavy work | `multiprocessing`/`ProcessPoolExecutor` | separate GILs, real multi-core parallelism |
| NumPy/pandas/C-extension heavy work | threads often fine | many release the GIL during computation |
| Mixed: async server calling into CPU-heavy work | `asyncio` + `to_thread`/`ProcessPoolExecutor` | combine models per sub-task |

Ask "what is this code waiting on?" before reaching for a concurrency
primitive. Waiting on the network is not the same problem as waiting on the
CPU, and the two require different tools.

## See Also

- [`conc-io-bound-asyncio`](conc-io-bound-asyncio.md) - detail on the I/O-bound case
- [`conc-cpu-bound-multiprocessing`](conc-cpu-bound-multiprocessing.md) - detail on the CPU-bound case
- [`async-gil-awareness`](async-gil-awareness.md) - the underlying constraint driving this decision
