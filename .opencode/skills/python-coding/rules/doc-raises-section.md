# doc-raises-section

> Document exceptions a function can raise in a `Raises:`/`Raises` section

## Why It Matters

Python doesn't have checked exceptions, so the only way a caller learns that a function can raise `ValueError` on bad input or `ConnectionError` on a network failure is by reading the implementation or hitting the exception in production — unless the docstring says so explicitly. A `Raises:` section turns exception behavior into part of the documented contract, letting callers write correct `try`/`except` blocks without spelunking through the call chain. Tools like `darglint` can even cross-check that documented exceptions match what the function body actually raises, keeping the two in sync.

## Bad

```python
def withdraw(account: Account, amount: float) -> None:
    """Withdraw an amount from an account."""
    if amount <= 0:
        raise ValueError("amount must be positive")
    if amount > account.balance:
        raise InsufficientFundsError(account.id, amount)
    account.balance -= amount
```

A caller has no way to know, short of reading the body, which exceptions to catch.

## Good

```python
def withdraw(account: Account, amount: float) -> None:
    """Withdraw an amount from an account.

    Args:
        account: The account to withdraw from.
        amount: Amount to withdraw; must be positive.

    Raises:
        ValueError: If `amount` is not positive.
        InsufficientFundsError: If `amount` exceeds the account balance.
    """
    if amount <= 0:
        raise ValueError("amount must be positive")
    if amount > account.balance:
        raise InsufficientFundsError(account.id, amount)
    account.balance -= amount
```

## Documenting Exceptions That Propagate, Not Just Ones You Raise

If a function calls something that can raise and doesn't catch it, that exception is still part of the contract and worth documenting:

```python
def fetch_and_parse(url: str) -> dict:
    """Fetch a URL and parse its JSON body.

    Args:
        url: The URL to fetch.

    Returns:
        The parsed JSON payload as a dict.

    Raises:
        httpx.HTTPStatusError: If the response has a 4xx/5xx status code.
        httpx.TimeoutException: If the request exceeds the configured timeout.
        json.JSONDecodeError: If the response body is not valid JSON.
    """
    response = httpx.get(url, timeout=5.0)
    response.raise_for_status()
    return response.json()
```

## NumPy-Style Equivalent

```python
def withdraw(account: Account, amount: float) -> None:
    """Withdraw an amount from an account.

    Raises
    ------
    ValueError
        If `amount` is not positive.
    InsufficientFundsError
        If `amount` exceeds the account balance.
    """
    ...
```

## See Also

- [`doc-google-numpy-style`](doc-google-numpy-style.md) - which convention's `Raises` header format to use
- [`err-custom-hierarchy`](err-custom-hierarchy.md) - designing the exception types this section documents
- [`err-specific-except`](err-specific-except.md) - callers rely on this section to write precise `except` clauses
