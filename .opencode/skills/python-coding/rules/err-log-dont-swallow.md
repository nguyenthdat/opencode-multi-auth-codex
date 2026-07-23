# err-log-dont-swallow

> Log or re-raise every caught exception; never silently swallow it

## Why It Matters

An exception that's caught and discarded with no logging and no re-raise erases all evidence that something went wrong — the operation appears to have "succeeded" from every caller's perspective, while data may be missing, partially written, or inconsistent. These silent failures are among the hardest bugs to diagnose because there is no error, no log line, and no stack trace pointing at the cause; they only surface later as a downstream symptom disconnected from the actual root cause.

## Bad

```python
def sync_inventory(warehouse_id: str) -> None:
    try:
        items = fetch_remote_inventory(warehouse_id)
        update_local_db(items)
    except Exception:
        pass  # silently does nothing -- inventory just stays stale forever

def send_notification(user_id: str, message: str) -> None:
    try:
        notification_service.send(user_id, message)
    except Exception:
        return  # caller thinks the notification was sent; it wasn't
```

## Good

```python
import logging

logger = logging.getLogger(__name__)

def sync_inventory(warehouse_id: str) -> None:
    try:
        items = fetch_remote_inventory(warehouse_id)
        update_local_db(items)
    except RemoteServiceError:
        logger.exception("inventory sync failed for warehouse %s", warehouse_id)
        raise  # caller needs to know sync did not happen

def send_notification(user_id: str, message: str) -> bool:
    try:
        notification_service.send(user_id, message)
        return True
    except NotificationError:
        logger.warning("notification failed for user %s", user_id, exc_info=True)
        return False  # explicit signal to the caller, not a silent no-op
```

## `logger.exception` vs `logger.warning`

```python
try:
    risky_operation()
except ExpectedCondition as exc:
    # Expected, recoverable: warning level, still visible, includes traceback if useful
    logger.warning("expected failure: %s", exc)
except Exception:
    # Unexpected: exception level always includes full traceback automatically
    logger.exception("unexpected failure in risky_operation")
    raise
```

`logger.exception(...)` must be called from inside an `except` block — it automatically attaches the current traceback at ERROR level. If you truly intend to suppress an exception (e.g., "best-effort cleanup, failure is fine"), use `contextlib.suppress` so the intent is explicit and greppable rather than an empty `except: pass`.

## See Also

- [`err-specific-except`](err-specific-except.md) - catching the right type before deciding how to log it
- [`err-context-manager-cleanup`](err-context-manager-cleanup.md) - `contextlib.suppress` for deliberate, explicit suppression
- [`anti-catch-and-ignore`](anti-catch-and-ignore.md) - the broader anti-pattern this rule targets
