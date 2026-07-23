# res-context-manager-with

> Use `with` for anything that acquires a resource (files, locks, sockets, DB connections)

## Why It Matters

Resources like file descriptors, sockets, and locks are finite and must be released deterministically, not "eventually" when the garbage collector gets around to it. Manual acquire/release pairs are easy to get wrong under exceptions — a single early `return` or raised exception between `open()` and `close()` leaks the handle. The `with` statement guarantees `__exit__` runs even when the body raises, which is the only reliable way to tie a resource's lifetime to a scope.

## Bad

```python
import socket

def read_config(path: str) -> str:
    f = open(path)
    data = f.read()
    if not data:
        raise ValueError("empty config")  # f.close() never runs — leaked handle
    f.close()
    return data

def send_request(host: str, port: int, payload: bytes) -> bytes:
    sock = socket.create_connection((host, port))
    sock.sendall(payload)
    response = sock.recv(4096)  # if this raises, sock is never closed
    sock.close()
    return response
```

## Good

```python
import socket

def read_config(path: str) -> str:
    with open(path) as f:
        data = f.read()
        if not data:
            raise ValueError("empty config")  # file still closed on the way out
        return data

def send_request(host: str, port: int, payload: bytes) -> bytes:
    with socket.create_connection((host, port)) as sock:
        sock.sendall(payload)
        return sock.recv(4096)
```

## Multiple Resources in One Statement

Python allows combining several context managers in a single `with`, avoiding deep nesting:

```python
def copy_filtered(src_path: str, dst_path: str) -> None:
    with open(src_path) as src, open(dst_path, "w") as dst:
        for line in src:
            if not line.startswith("#"):
                dst.write(line)
```

This also applies to locks, database cursors, and `tempfile` objects — anything implementing `__enter__`/`__exit__`. When you find yourself writing `try/finally` around a single acquire/release pair, that is almost always a sign the object should be used as a context manager instead (or wrapped with `contextlib.contextmanager`).

## See Also

- [`res-contextlib-helpers`](res-contextlib-helpers.md) - build custom context managers for objects that don't ship with one
- [`res-file-handles-close`](res-file-handles-close.md) - the specific case of file and socket handles
- [`res-async-context-manager`](res-async-context-manager.md) - the `async with` equivalent for async resources
- [`err-context-manager-cleanup`](err-context-manager-cleanup.md) - using context managers for error-safe cleanup generally
