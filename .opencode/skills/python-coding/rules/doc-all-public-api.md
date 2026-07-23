# doc-all-public-api

> Document every public module, class, function, and method with a docstring

## Why It Matters

Public API without a docstring forces every caller to read the implementation to understand what it does, what it expects, and what it returns — which is slower than reading one or two sentences, and error-prone when the implementation is subtle or the intent isn't obvious from the code alone. Docstrings are also what `help()`, IDEs' hover tooltips, and generated documentation sites (Sphinx, `pdoc`, `mkdocstrings`) surface directly to consumers, so missing docstrings mean a degraded experience for every person and tool that touches the API afterward. Linters like `ruff` (`D` rules) can enforce this automatically so it doesn't rely on reviewer diligence alone.

## Bad

```python
class RateLimiter:
    def __init__(self, max_requests, window_seconds):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._timestamps = []

    def allow(self, now):
        # No docstring - callers must read the implementation to learn:
        # does `now` need a timezone? what does a False return mean?
        cutoff = now - timedelta(seconds=self.window_seconds)
        self._timestamps = [t for t in self._timestamps if t > cutoff]
        if len(self._timestamps) >= self.max_requests:
            return False
        self._timestamps.append(now)
        return True
```

## Good

```python
class RateLimiter:
    """Sliding-window rate limiter based on request timestamps.

    Args:
        max_requests: Maximum number of requests allowed within the window.
        window_seconds: Length of the sliding window, in seconds.
    """

    def __init__(self, max_requests: int, window_seconds: float) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._timestamps: list[datetime] = []

    def allow(self, now: datetime) -> bool:
        """Check whether a request at `now` is allowed under the current limit.

        Args:
            now: Timezone-aware timestamp of the incoming request.

        Returns:
            True if the request is allowed and recorded; False if the
            request would exceed `max_requests` within the window.
        """
        cutoff = now - timedelta(seconds=self.window_seconds)
        self._timestamps = [t for t in self._timestamps if t > cutoff]
        if len(self._timestamps) >= self.max_requests:
            return False
        self._timestamps.append(now)
        return True
```

## What Doesn't Need a Docstring

Private helpers (`_refill`), trivial `__repr__`/`__eq__` overrides, and one-line properties whose name is fully self-explanatory can reasonably skip a docstring — forcing one everywhere produces boilerplate noise (`"""Return the id."""` above `def id(self): return self._id`) without adding information.

```python
def _normalize_key(raw: str) -> str:
    return raw.strip().lower()  # private, obvious, no docstring required
```

## Enforcing Coverage

```toml
[tool.ruff.lint]
select = ["D1"]  # D100-D107: missing docstring in public module/class/function/method
```

## See Also

- [`doc-google-numpy-style`](doc-google-numpy-style.md) - the convention these docstrings should follow
- [`doc-module-docstring`](doc-module-docstring.md) - the module-level counterpart to this rule
- [`doc-all-dunder`](doc-all-dunder.md) - defining what counts as "public" in the first place
