# doc-examples-doctest

> Include runnable usage examples in docstrings and verify them with doctest

## Why It Matters

A prose description of a function can go stale silently, but a runnable example embedded as a doctest is checked by the `doctest` module (or by pytest's `--doctest-modules`) on every test run, so it fails loudly the moment the documented behavior and the real behavior diverge. Examples are also simply the fastest way for a reader to understand a function — seeing `normalize("  Hello WORLD  ")` next to its output `'hello world'` communicates more, faster, than a paragraph of description. This is standard practice throughout the standard library itself (`itertools`, `textwrap`, `decimal` all use doctest-style examples in their docs).

## Bad

```python
def normalize_username(raw: str) -> str:
    """Normalize a username by trimming whitespace and lowercasing it."""
    return raw.strip().lower()
```

The prose is fine, but there's no example to confirm the behavior actually matches, and no automated check that it stays that way.

## Good

```python
def normalize_username(raw: str) -> str:
    """Normalize a username by trimming whitespace and lowercasing it.

    Examples:
        >>> normalize_username("  Alice ")
        'alice'
        >>> normalize_username("BOB")
        'bob'
        >>> normalize_username("")
        ''
    """
    return raw.strip().lower()
```

## Running Doctests

```bash
python -m doctest myapp/users.py -v
pytest --doctest-modules myapp/
```

```toml
# pyproject.toml
[tool.pytest.ini_options]
addopts = "--doctest-modules"
```

## Examples with Exceptions

```python
def parse_port(value: str) -> int:
    """Parse a TCP port number from a string.

    Examples:
        >>> parse_port("8080")
        8080
        >>> parse_port("70000")
        Traceback (most recent call last):
            ...
        ValueError: port must be between 1 and 65535
    """
    port = int(value)
    if not (1 <= port <= 65535):
        raise ValueError("port must be between 1 and 65535")
    return port
```

## When to Skip Doctest

For examples involving randomness, real I/O, or large output, prefer a regular pytest test over a doctest, or mark the doctest to be skipped explicitly:

```python
def fetch_latest_price(symbol: str) -> float:
    """Fetch the latest market price for a symbol.

    Examples:
        >>> fetch_latest_price("AAPL")  # doctest: +SKIP
        193.42
    """
    ...
```

## See Also

- [`doc-google-numpy-style`](doc-google-numpy-style.md) - the section header (`Examples:`) this convention uses
- [`doc-all-public-api`](doc-all-public-api.md) - examples are one part of complete public API docs
- [`test-coverage-meaningful`](test-coverage-meaningful.md) - doctests contribute to but don't replace behavioral test coverage
