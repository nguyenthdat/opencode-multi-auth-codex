# err-specific-except

> Catch specific exception types; never catch bare `Exception` unless re-raising

## Why It Matters

Catching `Exception` broadly hides bugs: a `TypeError` from a typo, a `KeyError` from missing config, and a genuine `ConnectionError` all get treated identically, and the handler often can't do the right thing for all of them. It also silently swallows exceptions the author never anticipated — including ones that indicate real programming errors that should crash loudly in development, not get "handled" the same way as an expected network timeout.

## Bad

```python
import requests

def fetch_user(user_id: int) -> dict | None:
    try:
        response = requests.get(f"https://api.example.com/users/{user_id}")
        return response.json()
    except Exception:
        # Catches network errors, JSON decode errors, AND typos/bugs in this
        # function itself (e.g. a NameError), all treated the same way.
        return None
```

## Good

```python
import requests
from requests.exceptions import RequestException
from json import JSONDecodeError

def fetch_user(user_id: int) -> dict | None:
    try:
        response = requests.get(f"https://api.example.com/users/{user_id}", timeout=5)
        response.raise_for_status()
        return response.json()
    except RequestException as exc:
        logger.warning("failed to fetch user %s: %s", user_id, exc)
        return None
    except JSONDecodeError as exc:
        logger.error("malformed response for user %s: %s", user_id, exc)
        return None
```

## When Broad Catches Are Acceptable

```python
def run_task(task: Callable[[], None]) -> None:
    try:
        task()
    except Exception:
        # Acceptable: a top-level worker loop that must never crash the
        # process, and it logs + re-raises context rather than swallowing.
        logger.exception("task failed")
        raise
```

Broad `except Exception` is defensible at true process boundaries (a task runner, a plugin dispatcher, a request handler's outermost layer) where the goal is "log everything and keep the process alive," provided it logs with full traceback and doesn't silently continue as if nothing happened. Never catch bare `BaseException` — that also swallows `KeyboardInterrupt` and `SystemExit`.

## See Also

- [`err-no-bare-except`](err-no-bare-except.md) - the even worse anti-pattern of catching everything, unnamed
- [`err-custom-hierarchy`](err-custom-hierarchy.md) - designing exception types precise enough to catch selectively
- [`err-log-dont-swallow`](err-log-dont-swallow.md) - what to do once you've caught something
