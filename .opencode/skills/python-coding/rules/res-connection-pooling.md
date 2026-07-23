# res-connection-pooling

> Pool and reuse expensive connections (DB, HTTP) instead of opening per-call

## Why It Matters

Establishing a TCP connection, completing a TLS handshake, and authenticating against a database or HTTP service are all comparatively expensive operations — often tens of milliseconds each. A function that opens a fresh connection on every call pays that cost repeatedly and can exhaust ephemeral ports or a remote service's connection limit under load. A pool amortizes setup cost across many calls by keeping a small number of live connections ready for reuse, which is the difference between a service that scales and one that falls over under moderate traffic.

## Bad

```python
import requests
import psycopg2

def get_user(user_id: int) -> dict:
    conn = psycopg2.connect(dsn=DSN)  # new TCP + auth handshake every call
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            return cur.fetchone()
    finally:
        conn.close()

def fetch_profile(user_id: int) -> dict:
    response = requests.get(f"https://api.example.com/users/{user_id}")  # new connection each time
    return response.json()
```

## Good

```python
import httpx
from psycopg2 import pool

_db_pool = pool.SimpleConnectionPool(minconn=2, maxconn=10, dsn=DSN)
_http_client = httpx.Client(base_url="https://api.example.com", timeout=5.0)

def get_user(user_id: int) -> dict:
    conn = _db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            return cur.fetchone()
    finally:
        _db_pool.putconn(conn)  # returned to the pool, not torn down

def fetch_profile(user_id: int) -> dict:
    response = _http_client.get(f"/users/{user_id}")  # reuses a pooled keep-alive connection
    return response.json()
```

## Scoping the Pool to Application Lifetime

Pools should be created once at startup and closed once at shutdown, not per-request:

```python
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.client = httpx.AsyncClient(base_url="https://api.example.com")
    try:
        yield
    finally:
        await app.state.client.aclose()

app = FastAPI(lifespan=lifespan)
```

`httpx.Client`/`httpx.AsyncClient`, `requests.Session`, and SQLAlchemy's `Engine` all pool connections internally by default — the mistake to avoid is constructing a new `Client`/`Session`/`Engine` per call site instead of sharing one long-lived instance.

## See Also

- [`res-async-context-manager`](res-async-context-manager.md) - releasing pooled async resources correctly
- [`res-file-handles-close`](res-file-handles-close.md) - closing handles that aren't pooled
- [`async-no-blocking-call`](async-no-blocking-call.md) - why blocking connection setup inside async code is doubly costly
