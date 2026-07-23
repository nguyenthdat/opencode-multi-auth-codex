# err-context-manager-cleanup

> Use context managers for guaranteed cleanup instead of manual try/finally boilerplate

## Why It Matters

Manual `try/finally` cleanup is repeated at every call site, easy to forget, and easy to get subtly wrong (e.g., cleanup that itself can raise, masking the original exception). A context manager centralizes the acquire/release logic once, in the one place that understands the resource, so every caller gets correct cleanup for free just by using `with` — and `contextlib` makes writing one nearly as simple as writing a function.

## Bad

```python
import sqlite3

def run_query(db_path: str, query: str) -> list[tuple]:
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(query)
        return cursor.fetchall()
    finally:
        conn.close()

# Every caller that needs this pattern has to remember to repeat the
# try/finally correctly, including transaction rollback on error.
def run_query_with_lock(db_path: str, query: str, lock) -> list[tuple]:
    lock.acquire()
    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.cursor()
            cursor.execute(query)
            return cursor.fetchall()
        finally:
            conn.close()
    finally:
        lock.release()
```

## Good

```python
import sqlite3
from contextlib import contextmanager
from collections.abc import Iterator

@contextmanager
def db_connection(db_path: str) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(db_path)
    try:
        yield conn
    finally:
        conn.close()

def run_query(db_path: str, query: str) -> list[tuple]:
    with db_connection(db_path) as conn:
        return conn.execute(query).fetchall()

def run_query_with_lock(db_path: str, query: str, lock) -> list[tuple]:
    with lock, db_connection(db_path) as conn:  # `with` composes cleanly
        return conn.execute(query).fetchall()
```

## Class-Based Context Manager (When State Is Needed)

```python
class ManagedTransaction:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def __enter__(self) -> sqlite3.Connection:
        self._conn.execute("BEGIN")
        return self._conn

    def __exit__(self, exc_type, exc, tb) -> None:
        if exc_type is None:
            self._conn.commit()
        else:
            self._conn.rollback()
        # returning None (falsy) lets any exception propagate normally
```

Reach for `@contextmanager` (generator-based) for simple acquire/yield/release logic — it's far less boilerplate than a full `__enter__`/`__exit__` class. Write a class-based manager only when you need to inspect the exception type/value in `__exit__` (e.g., to decide commit vs. rollback) or need multiple entry points.

## See Also

- [`res-context-manager-with`](res-context-manager-with.md) - the resource-management side of this same pattern
- [`res-contextlib-helpers`](res-contextlib-helpers.md) - more `contextlib` utilities (`suppress`, `ExitStack`)
- [`err-finally-cleanup`](err-finally-cleanup.md) - the narrower rule about what `finally` itself should and shouldn't do
