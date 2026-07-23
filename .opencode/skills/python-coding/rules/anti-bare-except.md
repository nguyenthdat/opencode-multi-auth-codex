# anti-bare-except

> Don't use a bare `except:` clause that catches everything including `SystemExit`/`KeyboardInterrupt`

## Why It Matters

A bare `except:` catches every `BaseException`, not just application errors — including `KeyboardInterrupt` (so Ctrl-C stops working), `SystemExit` (so `sys.exit()` silently gets swallowed), and `GeneratorExit`. It also hides programming errors like `NameError` or `AttributeError` from typos, turning what should be a crash-and-fix-it bug into silent, confusing misbehavior deep in production. The fix costs nothing: catch `Exception` (or a specific subclass) instead, which excludes those control-flow signals by design.

## Bad

```python
def load_config(path):
    try:
        with open(path) as f:
            return json.load(f)
    except:                      # catches KeyboardInterrupt, SystemExit, typos, everything
        return {}

# A user hits Ctrl-C while this runs - the except clause
# swallows the KeyboardInterrupt and the process keeps going,
# appearing to "hang" instead of exiting.
```

## Good

```python
def load_config(path: str) -> dict:
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("failed to load config from %s: %s", path, exc)
        return {}
```

## Ruff Rule

`E722` (pycodestyle) flags bare `except:` clauses:

```toml
[tool.ruff.lint]
select = ["E"]
```

```python
try:
    risky()
except:          # E722: Do not use bare `except`
    pass
```

If you truly need to catch "anything the application could reasonably raise" (e.g. a top-level request handler that must never crash the server), use `except Exception:` explicitly — it still lets `KeyboardInterrupt` and `SystemExit` propagate, which is almost always the correct behavior:

```python
def handle_request(req):
    try:
        return process(req)
    except Exception:
        logger.exception("unhandled error processing request")
        return error_response(500)
```

## See Also

- [`err-no-bare-except`](err-no-bare-except.md) - the error-handling framing of this same rule
- [`err-specific-except`](err-specific-except.md) - catching the narrowest exception type that applies
- [`anti-catch-and-ignore`](anti-catch-and-ignore.md) - the related mistake of catching and doing nothing
