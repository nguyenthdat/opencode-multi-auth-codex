# test-no-logic-in-tests

> Avoid conditionals and loops inside test bodies; keep tests linear and obvious

## Why It Matters

A test that contains an `if` statement or a `for` loop with branching behavior is testing something different depending on the input it happens to receive at runtime — which means the test itself now needs to be correct, and correctness of a test is not usually verified by another test. This defeats the purpose of a test: it should be a simple, obviously-correct statement of "given this, expect that," not a small program a reader has to trace through to figure out what's actually being asserted. Logic in tests is also a common source of tests that pass vacuously (e.g., a loop over an empty list never executing its assertion).

## Bad

```python
def test_all_orders_have_positive_totals():
    orders = fetch_recent_orders()
    for order in orders:                 # loop hides how many assertions actually ran
        if order.status == "completed":  # branching changes what's being tested
            assert order.total > 0
    # If `orders` is empty or none are "completed", this test passes vacuously.


def test_discount_application():
    rate = 0.1
    if rate > 0:
        result = apply_discount(100, rate)
        assert result == 90.0
    else:
        assert True  # meaningless fallback branch
```

## Good

```python
def test_completed_orders_have_positive_totals():
    completed_orders = [
        Order(total=25.0, status="completed"),
        Order(total=10.0, status="completed"),
    ]

    assert all(order.total > 0 for order in completed_orders)


def test_applies_ten_percent_discount():
    result = apply_discount(100, 0.1)
    assert result == 90.0
```

Better still, replace the loop with `parametrize` so each case is its own reported test rather than one aggregate assertion:

```python
import pytest


@pytest.mark.parametrize("order", [
    Order(total=25.0, status="completed"),
    Order(total=10.0, status="completed"),
])
def test_completed_order_has_positive_total(order):
    assert order.total > 0
```

## When Some Structure Is Genuinely Needed

A single, well-justified comprehension used to build expected data (not to make assertion decisions) is fine — the distinction is whether the logic affects *what gets checked*, not just how test data is assembled:

```python
def test_extract_active_user_ids():
    users = [User(id=1, active=True), User(id=2, active=False), User(id=3, active=True)]
    expected_ids = [u.id for u in users if u.active]  # building expected data, not branching on it

    assert extract_active_user_ids(users) == expected_ids
```

## See Also

- [`test-arrange-act-assert`](test-arrange-act-assert.md) - the linear structure this rule protects
- [`test-parametrize-cases`](test-parametrize-cases.md) - replacing loops over cases with reported, per-case tests
- [`test-coverage-meaningful`](test-coverage-meaningful.md) - vacuous assertions are a coverage trap this rule avoids
