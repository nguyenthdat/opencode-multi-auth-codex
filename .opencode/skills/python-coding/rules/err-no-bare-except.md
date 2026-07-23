# err-no-bare-except

> Never use a bare `except:` clause

## Why It Matters

A bare `except:` (with no exception type at all) catches literally everything, including `KeyboardInterrupt`, `SystemExit`, and `MemoryError` — exceptions that represent the user trying to stop the program or the interpreter shutting down, not application-level failures. Catching these prevents Ctrl-C from working, breaks graceful shutdown, and can leave a process in a zombie state that's unresponsive to termination signals.

## Bad

```python
def process_all(items: list[Item]) -> None:
    for item in items:
        try:
            process(item)
        except:  # catches KeyboardInterrupt, SystemExit, everything
            print(f"failed to process {item.id}")
            continue

# Ctrl-C during process_all() gets swallowed by the bare except and
# printed as a generic failure — the process cannot be interrupted.
```

## Good

```python
def process_all(items: list[Item]) -> None:
    for item in items:
        try:
            process(item)
        except Exception:  # KeyboardInterrupt/SystemExit propagate normally
            logger.exception("failed to process %s", item.id)
            continue
```

## If You Truly Need To Catch Everything

```python
import sys

def run_and_report(task: Callable[[], None]) -> int:
    try:
        task()
        return 0
    except BaseException:
        # Explicit BaseException, not a bare `except:` — this documents
        # intent clearly and is still linted/greppable, unlike a bare clause.
        logger.exception("unhandled failure")
        return 1
```

Even when you deliberately want to catch `BaseException` (e.g., a top-level runner reporting a nonzero exit code before the process ends), spell it out as `except BaseException:` rather than a bare `except:` — it's equally broad but greppable, lintable, and makes the breadth an explicit, reviewable choice rather an easy-to-miss omission.

## Lint Enforcement

Ruff's `E722` rule flags bare `except:` clauses automatically:

```toml
# pyproject.toml
[tool.ruff.lint]
select = ["E722"]  # bare except not allowed
```

```
$ ruff check .
example.py:16:9: E722 Do not use bare `except`
```

Treat any `E722` finding as a required fix, not a style nit — it's one of the few lint rules where the "wrong" version has a genuine, demonstrable behavioral difference (breaking `Ctrl-C`) rather than just being a matter of taste.

## See Also

- [`err-specific-except`](err-specific-except.md) - why catching `Exception` broadly is already too wide in most cases
- [`err-log-dont-swallow`](err-log-dont-swallow.md) - what to do once caught, regardless of how broad the clause is
- [`anti-bare-except`](anti-bare-except.md) - this anti-pattern catalogued alongside other common mistakes
