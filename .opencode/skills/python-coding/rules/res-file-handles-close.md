# res-file-handles-close

> Always close/manage file and network handles explicitly via context managers

## Why It Matters

Operating systems impose hard limits on the number of open file descriptors per process (often 1024 by default on Unix). A program that opens files or sockets without closing them will eventually hit `OSError: [Errno 24] Too many open files` under load, and until then it silently holds buffered writes that may never be flushed to disk. Relying on the garbage collector to close handles "eventually" — via `__del__` — is not a guarantee, especially on non-CPython runtimes or in the presence of reference cycles.

## Bad

```python
def append_log_entries(path: str, entries: list[str]) -> None:
    f = open(path, "a")
    for entry in entries:
        f.write(entry + "\n")
    # no close() — descriptor stays open, buffered writes may not flush

def download_batch(urls: list[str]) -> list[bytes]:
    results = []
    for url in urls:
        conn = urllib.request.urlopen(url)  # never closed — one leaked socket per URL
        results.append(conn.read())
    return results
```

## Good

```python
import urllib.request

def append_log_entries(path: str, entries: list[str]) -> None:
    with open(path, "a") as f:
        for entry in entries:
            f.write(entry + "\n")
    # guaranteed flush + close, even if write() raises partway through

def download_batch(urls: list[str]) -> list[bytes]:
    results = []
    for url in urls:
        with urllib.request.urlopen(url) as conn:
            results.append(conn.read())
    return results
```

## Handles That Outlive a Single Function

When a handle must be held across multiple method calls (e.g. wrapped in a class), give the class its own context-manager protocol so ownership stays explicit:

```python
class LogWriter:
    def __init__(self, path: str) -> None:
        self._path = path
        self._file: object | None = None

    def __enter__(self) -> "LogWriter":
        self._file = open(self._path, "a")
        return self

    def __exit__(self, *exc_info: object) -> None:
        if self._file is not None:
            self._file.close()

    def write(self, line: str) -> None:
        assert self._file is not None, "use within a 'with LogWriter(...)' block"
        self._file.write(line + "\n")

with LogWriter("audit.log") as writer:
    writer.write("startup")
```

This makes it impossible to use `LogWriter` without a `with` block establishing clear open/close boundaries, and mirrors what libraries like `requests.Session` and `sqlite3.Connection` do internally.

## See Also

- [`res-context-manager-with`](res-context-manager-with.md) - the general `with`-statement pattern this rule specializes
- [`res-connection-pooling`](res-connection-pooling.md) - reusing handles instead of opening one per call
- [`res-del-not-guaranteed`](res-del-not-guaranteed.md) - why `__del__` is not a substitute for explicit close
