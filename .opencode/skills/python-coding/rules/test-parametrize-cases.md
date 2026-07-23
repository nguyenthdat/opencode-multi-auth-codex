# test-parametrize-cases

> Use `@pytest.mark.parametrize` to cover multiple cases without duplicating test bodies

## Why It Matters

Copy-pasted test functions that differ only in their input and expected output drift apart over time — a fix applied to one copy doesn't propagate to the others, and reviewers have to diff near-identical blocks to spot what actually changed. `parametrize` collapses that duplication into one test body and a table of cases, so pytest reports each case as its own test ID (`test_discount[negative_amount]`), which pinpoints exactly which input failed without extra debugging. It also makes adding a new edge case a one-line change instead of a copy-paste-and-modify cycle.

## Bad

```python
def test_discount_ten_percent():
    assert apply_discount(100, 0.10) == 90.0


def test_discount_zero_percent():
    assert apply_discount(100, 0.0) == 100.0


def test_discount_full_percent():
    assert apply_discount(100, 1.0) == 0.0


def test_discount_negative_raises():
    with pytest.raises(ValueError):
        apply_discount(100, -0.1)
```

## Good

```python
import pytest


@pytest.mark.parametrize(
    ("amount", "rate", "expected"),
    [
        (100, 0.10, 90.0),
        (100, 0.0, 100.0),
        (100, 1.0, 0.0),
    ],
)
def test_apply_discount(amount, rate, expected):
    assert apply_discount(amount, rate) == expected


@pytest.mark.parametrize("invalid_rate", [-0.1, 1.5, float("nan")])
def test_apply_discount_rejects_invalid_rate(invalid_rate):
    with pytest.raises(ValueError):
        apply_discount(100, invalid_rate)
```

## Named IDs for Readability

```python
@pytest.mark.parametrize(
    ("status_code", "expected_retry"),
    [
        pytest.param(429, True, id="rate_limited"),
        pytest.param(500, True, id="server_error"),
        pytest.param(404, False, id="not_found"),
    ],
)
def test_should_retry_on_status(status_code, expected_retry):
    assert should_retry(status_code) is expected_retry
```

## Stacking Parametrize for Combinations

```python
@pytest.mark.parametrize("currency", ["USD", "EUR", "GBP"])
@pytest.mark.parametrize("amount", [0, 100, 999999])
def test_format_money_across_currencies(amount, currency):
    formatted = format_money(amount, currency)
    assert currency in formatted
```

## See Also

- [`test-fixtures-setup`](test-fixtures-setup.md) - parametrized fixtures via `@pytest.fixture(params=...)`
- [`test-descriptive-names`](test-descriptive-names.md) - naming parametrized cases with `pytest.param(..., id=...)`
- [`test-hypothesis-property`](test-hypothesis-property.md) - generating cases automatically instead of enumerating them
