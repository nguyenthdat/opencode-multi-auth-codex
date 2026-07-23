# anti-print-debugging

> Don't leave `print()` debugging statements in production code; use logging

## Why It Matters

`print()` output goes straight to stdout with no severity level, no timestamp, no module context, and no way to redirect, filter, or turn it off without editing source code — in a production service, that means debug noise mixed indistinguishably with real output (or swallowed entirely if stdout isn't captured), and no way to selectively enable verbose output for one module while suppressing it elsewhere. The `logging` module solves all of this: structured levels, per-module loggers, configurable handlers and formatters, and the ability to leave diagnostic statements in code permanently without them appearing in normal operation.

## Bad

```python
def process_payment(order):
    print(f"Processing order {order.id}")          # no timestamp, no level, always on
    print(f"amount: {order.total}")                  # can't be turned off in prod
    result = gateway.charge(order)
    print(f"result: {result}")                        # mixed into stdout with real app output
    if not result.success:
        print("PAYMENT FAILED!!!", result.error)      # no stack trace, no severity
    return result
```

## Good

```python
import logging

logger = logging.getLogger(__name__)

def process_payment(order: Order) -> PaymentResult:
    logger.info("processing order %s, amount=%s", order.id, order.total)
    result = gateway.charge(order)
    if not result.success:
        logger.error("payment failed for order %s: %s", order.id, result.error)
    else:
        logger.debug("payment result: %s", result)
    return result
```

## Ruff Rule

`T201` (flake8-print) flags `print()` calls:

```toml
[tool.ruff.lint]
select = ["T20"]

[tool.ruff.lint.per-file-ignores]
"scripts/**" = ["T201"]  # print is fine in one-off CLI scripts
```

```python
print("debug value:", x)  # T201: `print` found
```

## Where `print()` Is Legitimate

CLI tools whose entire purpose is producing user-facing stdout output (`click` commands, one-off scripts, `__main__` entry points that report a result) legitimately use `print()` as their actual output mechanism — that's not debugging residue, it's the program's interface. The rule targets `print()` used as an ad-hoc diagnostic left over from development, not deliberate user-facing output.

```python
@click.command()
def cli(path: str) -> None:
    result = run_migration(path)
    print(f"Migrated {result.count} rows")  # legitimate CLI output, not debug noise
```

## See Also

- [`doc-inline-comments-why`](doc-inline-comments-why.md) - leaving useful context in code without leftover debug noise
- [`err-log-dont-swallow`](err-log-dont-swallow.md) - logging exceptions instead of printing or discarding them
- [`lint-ruff-rule-selection`](lint-ruff-rule-selection.md) - enabling `T20` alongside other rule categories
