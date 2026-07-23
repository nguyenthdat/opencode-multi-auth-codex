# anti-catch-and-ignore

> Don't catch an exception and silently ignore it (`except Exception: pass`)

## Why It Matters

Swallowing an exception without logging it or handling its consequence destroys the evidence needed to debug the eventual failure it causes downstream — by the time a symptom appears (missing data, a stale cache, a user complaint), the original error and stack trace are long gone. It also masks genuine bugs as "working" behavior: a function that silently no-ops on failure looks identical, from the caller's perspective, to one that succeeded, so nobody investigates until the cumulative damage is large enough to notice.

## Bad

```python
def sync_inventory(sku):
    try:
        update_stock_count(sku)
    except Exception:
        pass   # if this fails every time, nobody will ever know

def send_notification(user, message):
    try:
        email_client.send(user.email, message)
    except Exception:
        pass   # user never gets notified, and there's no record of why
```

## Good

```python
import logging

logger = logging.getLogger(__name__)

def sync_inventory(sku: str) -> bool:
    try:
        update_stock_count(sku)
        return True
    except InventoryServiceError:
        logger.exception("failed to sync inventory for sku=%s", sku)
        return False

def send_notification(user: User, message: str) -> None:
    try:
        email_client.send(user.email, message)
    except EmailDeliveryError:
        logger.warning("could not notify user_id=%s, queuing retry", user.id)
        retry_queue.enqueue(user.id, message)
```

## Ruff Rule

`S110` (flake8-bandit, ported into Ruff's `S` set) flags `try/except/pass`:

```toml
[tool.ruff.lint]
select = ["S"]
```

```python
try:
    risky()
except Exception:
    pass   # S110: `try`-`except`-`pass` detected, consider logging the exception
```

## When Silence Is Legitimate

A narrowly-scoped, explicitly-commented ignore is fine when the failure genuinely has no consequence — e.g. best-effort cleanup of a temp file that may already be gone:

```python
try:
    os.remove(temp_path)
except FileNotFoundError:
    pass  # already cleaned up by another process - expected, not an error
```

The difference is specificity (`FileNotFoundError`, not `Exception`) and an inline comment stating *why* ignoring it is safe, rather than a blanket catch-all with no explanation.

## See Also

- [`err-log-dont-swallow`](err-log-dont-swallow.md) - the general principle of logging before discarding an exception
- [`anti-bare-except`](anti-bare-except.md) - the related mistake of catching too broadly in the first place
- [`err-specific-except`](err-specific-except.md) - catching only the exception types you can actually handle
