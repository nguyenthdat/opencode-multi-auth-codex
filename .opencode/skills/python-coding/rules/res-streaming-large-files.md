# res-streaming-large-files

> Stream large files/data (chunked reads, generators) instead of loading fully into memory

## Why It Matters

Calling `.read()` on a multi-gigabyte file or response body forces the entire payload into memory at once, which can exhaust available RAM, trigger swapping, or crash a container with a fixed memory limit — even though the actual processing only needs to look at one record or chunk at a time. Streaming in fixed-size chunks (or line by line) bounds memory usage to a small, predictable constant regardless of input size, and lets processing start before the full input has even arrived.

## Bad

```python
import requests
import hashlib

def sha256_of_file(path: str) -> str:
    with open(path) as f:
        data = f.read()  # entire file (could be gigabytes) in memory at once
    return hashlib.sha256(data.encode()).hexdigest()

def download_to_disk(url: str, dest: str) -> None:
    response = requests.get(url)  # buffers the full body in memory first
    with open(dest, "wb") as f:
        f.write(response.content)
```

## Good

```python
import requests
import hashlib

def sha256_of_file(path: str) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)  # 1 MiB resident at a time, regardless of file size
    return hasher.hexdigest()

def download_to_disk(url: str, dest: str) -> None:
    with requests.get(url, stream=True) as response, open(dest, "wb") as f:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            f.write(chunk)
```

## Streaming CSV/JSON Records

```python
import csv
from collections.abc import Iterator

def read_large_csv(path: str) -> Iterator[dict[str, str]]:
    with open(path, newline="") as f:
        yield from csv.DictReader(f)  # one row materialized at a time

def sum_amount_column(path: str) -> float:
    return sum(float(row["amount"]) for row in read_large_csv(path))
```

`httpx` and `requests` both support `stream=True` precisely for this reason; ORMs like SQLAlchemy expose `yield_per()`/server-side cursors so large query results don't get pulled into memory as one giant list either. The rule of thumb: if the input size is unbounded or attacker/user-controlled, streaming isn't an optimization — it's a correctness requirement to avoid OOM.

## See Also

- [`res-generator-lazy`](res-generator-lazy.md) - the general lazy-iteration pattern this specializes for I/O
- [`perf-batch-io`](perf-batch-io.md) - balancing chunk size against syscall/network overhead
- [`res-connection-pooling`](res-connection-pooling.md) - reusing the underlying connection across streamed requests
