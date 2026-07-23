# err-custom-hierarchy

> Define a custom exception hierarchy rooted in a package-specific base exception

## Why It Matters

A shared base exception (e.g. `BillingError`) lets callers catch "anything that can go wrong in this subsystem" with a single `except` clause, while still allowing precise handling of specific subtypes when needed. Without a hierarchy, libraries either raise bare `ValueError`/`RuntimeError` (indistinguishable from unrelated errors elsewhere in the program) or force callers to enumerate every possible exception type individually.

## Bad

```python
def charge_card(card: Card, amount: float) -> Receipt:
    if amount <= 0:
        raise ValueError("amount must be positive")
    if not card.is_valid():
        raise ValueError("invalid card")
    if not gateway.has_funds(card, amount):
        raise RuntimeError("insufficient funds")
    return gateway.charge(card, amount)

# Caller can't distinguish "bad input" from "declined" from an unrelated
# ValueError raised somewhere else in the call stack.
try:
    charge_card(card, 50.0)
except ValueError:
    show_error("invalid request")
except RuntimeError:
    show_error("payment failed")
```

## Good

```python
class BillingError(Exception):
    """Base class for all billing-subsystem errors."""

class InvalidCardError(BillingError):
    pass

class InsufficientFundsError(BillingError):
    def __init__(self, required: float, available: float) -> None:
        super().__init__(f"required {required}, available {available}")
        self.required = required
        self.available = available

def charge_card(card: Card, amount: float) -> Receipt:
    if amount <= 0:
        raise ValueError("amount must be positive")  # genuine programmer/API misuse
    if not card.is_valid():
        raise InvalidCardError(card.last_four)
    if not gateway.has_funds(card, amount):
        raise InsufficientFundsError(required=amount, available=gateway.balance(card))
    return gateway.charge(card, amount)

try:
    charge_card(card, 50.0)
except InsufficientFundsError as exc:
    show_error(f"declined: need {exc.required}, have {exc.available}")
except BillingError:
    show_error("payment failed")
```

## Structuring the Hierarchy

```python
class BillingError(Exception):
    """Base for this package; catch this to handle any billing failure."""

class ValidationError(BillingError):
    """Bad input from the caller — a 4xx-style condition."""

class GatewayError(BillingError):
    """The upstream payment gateway failed — a 5xx-style condition."""

class InvalidCardError(ValidationError): ...
class InsufficientFundsError(ValidationError): ...
class GatewayTimeoutError(GatewayError): ...
```

Group by *how a caller should react* (retry? show the user a message? alert on-call?), not by internal implementation detail. Reserve built-in exceptions (`ValueError`, `TypeError`) for genuine misuse of your API's Python-level contract (wrong argument type/count), and use your custom hierarchy for domain-level failures.

## See Also

- [`err-raise-from`](err-raise-from.md) - preserving the original cause when wrapping a low-level error into your hierarchy
- [`err-custom-attributes`](err-custom-attributes.md) - attaching structured data like `required`/`available` above
- [`err-specific-except`](err-specific-except.md) - why precise types are worth defining in the first place
