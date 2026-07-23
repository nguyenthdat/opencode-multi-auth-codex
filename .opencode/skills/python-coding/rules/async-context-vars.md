# async-context-vars

> Use `contextvars.ContextVar` for async-safe request-scoped state

## Why It Matters

Module-level globals or thread-locals don't work for per-request state in async servers, because many concurrent requests share the same thread and interleave arbitrarily between `await` points — a global mutated by one request can leak into another's logic. `contextvars.ContextVar` gives each task its own isolated copy of the value that is automatically inherited by child tasks/coroutines but never bleeds across sibling tasks, which is exactly the isolation request-scoped data (request IDs, current user, trace context) needs.

## Bad

```python
import asyncio

_current_request_id: str | None = None  # shared across every concurrent task

async def handle_request(request_id: str) -> str:
    global _current_request_id
    _current_request_id = request_id
    await asyncio.sleep(0.1)  # another request's handler may run in between
    return log_and_respond()

def log_and_respond() -> str:
    # By the time this runs, _current_request_id may belong to a
    # different, concurrently-handled request.
    return f"handled {_current_request_id}"

async def main() -> None:
    async with asyncio.TaskGroup() as tg:
        tg.create_task(handle_request("req-1"))
        tg.create_task(handle_request("req-2"))
```

## Good

```python
import asyncio
from contextvars import ContextVar

_current_request_id: ContextVar[str] = ContextVar("current_request_id")

async def handle_request(request_id: str) -> str:
    token = _current_request_id.set(request_id)
    try:
        await asyncio.sleep(0.1)
        return log_and_respond()
    finally:
        _current_request_id.reset(token)

def log_and_respond() -> str:
    # Each task sees only the value it set — isolated per logical task.
    return f"handled {_current_request_id.get()}"

async def main() -> None:
    async with asyncio.TaskGroup() as tg:
        tg.create_task(handle_request("req-1"))
        tg.create_task(handle_request("req-2"))
```

## Real-World Example: Structured Logging Context

```python
from contextvars import ContextVar
import logging

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True

# Frameworks like Starlette/FastAPI set a ContextVar per request in
# middleware, so every log line and downstream call within that request
# automatically carries the right request ID without passing it explicitly
# through every function signature.
```

## See Also

- [`async-taskgroup-structured`](async-taskgroup-structured.md) - how child tasks inherit the current context
- [`conc-avoid-shared-mutable-state`](conc-avoid-shared-mutable-state.md) - the broader principle of isolating per-task state
- [`anti-global-mutable-state`](anti-global-mutable-state.md) - why plain globals are the wrong tool here
