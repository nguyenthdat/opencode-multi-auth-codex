# test-async-pytest

> Use `pytest-asyncio` (or anyio) to test async functions properly

## Why It Matters

An `async def test_...` function under plain pytest doesn't actually run — pytest calls it, gets back a coroutine object, and silently reports the test as passed without ever awaiting it, which means broken async code can hide behind a green test suite indefinitely. `pytest-asyncio` (or the `anyio` pytest plugin) provides the event loop machinery and a marker/fixture that properly awaits the coroutine, surfaces real assertion failures and exceptions, and lets you use async fixtures for setup like opening an async DB connection. Using the right plugin is not optional polish — it's the difference between a test that verifies behavior and one that silently verifies nothing.

## Bad

```python
import pytest


# Without pytest-asyncio configured, this "passes" without ever executing
# the coroutine body - the assert is never actually checked.
async def test_fetch_user():
    user = await fetch_user(user_id=1)
    assert user.email == "alice@example.com"
```

## Good

```python
import pytest


@pytest.mark.asyncio
async def test_fetch_user():
    user = await fetch_user(user_id=1)
    assert user.email == "alice@example.com"
```

```ini
# pytest.ini or pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"   # auto-applies @pytest.mark.asyncio to all async tests
```

## Async Fixtures

```python
import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def db_connection():
    conn = await asyncpg.connect(dsn="postgresql:///test")
    yield conn
    await conn.close()


@pytest.mark.asyncio
async def test_insert_and_query(db_connection):
    await db_connection.execute("INSERT INTO users (email) VALUES ($1)", "bob@example.com")
    row = await db_connection.fetchrow("SELECT email FROM users WHERE email = $1", "bob@example.com")
    assert row["email"] == "bob@example.com"
```

## Testing Timeouts and Cancellation

```python
import asyncio
import pytest


@pytest.mark.asyncio
async def test_operation_times_out():
    with pytest.raises(TimeoutError):
        async with asyncio.timeout(0.01):
            await slow_operation()
```

## `anyio` as a Backend-Agnostic Alternative

For libraries that must support both `asyncio` and `trio`, the `anyio` pytest plugin parametrizes tests across backends automatically:

```python
import pytest

pytestmark = pytest.mark.anyio


async def test_fetch_user_anyio():
    user = await fetch_user(user_id=1)
    assert user.email == "alice@example.com"
```

## See Also

- [`async-timeout`](async-timeout.md) - the timeout patterns these tests verify
- [`async-taskgroup-structured`](async-taskgroup-structured.md) - structured concurrency code under async test coverage
- [`test-mock-boundaries`](test-mock-boundaries.md) - mocking async I/O boundaries correctly with `AsyncMock`
