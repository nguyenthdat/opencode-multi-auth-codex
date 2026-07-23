# test-descriptive-names

> Give tests descriptive, behavior-based names (`test_raises_on_negative_amount`, not `test1`)

## Why It Matters

A test's name is the first thing a reader sees in a failure report and in the test file's table of contents, so a name like `test1` or `test_order` forces them to open the function body just to learn what's actually being verified. A behavior-based name — `test_raises_on_negative_amount`, `test_returns_empty_list_when_no_matches` — turns the test suite into living documentation: reading just the names of a module's tests should tell you most of what the code under test does and doesn't guarantee. This also makes CI failure output actionable at a glance, since `FAILED test_checkout.py::test_rejects_expired_card` is immediately meaningful without further investigation.

## Bad

```python
def test1():
    assert apply_discount(100, 0.1) == 90.0


def test2():
    with pytest.raises(ValueError):
        apply_discount(100, -0.1)


def test_discount():           # vague - which behavior of discount?
    assert apply_discount(100, 1.5) == 0.0
```

## Good

```python
def test_applies_ten_percent_discount_correctly():
    assert apply_discount(100, 0.1) == 90.0


def test_raises_on_negative_discount_rate():
    with pytest.raises(ValueError):
        apply_discount(100, -0.1)


def test_clamps_discount_rate_above_one_to_full_discount():
    assert apply_discount(100, 1.5) == 0.0
```

## A Naming Template

`test_<expected_behavior>_when_<condition>` or `test_<verb>_<condition>` both work well:

```python
def test_returns_empty_list_when_no_matches_found():
    assert search(query="zzz", items=SAMPLE_ITEMS) == []


def test_sends_notification_when_order_ships():
    ...


def test_raises_permission_error_when_user_is_not_admin():
    ...
```

## Naming Parametrized Cases

Give each parametrized case an explicit `id` so failure output stays descriptive instead of showing raw positional values:

```python
import pytest


@pytest.mark.parametrize(
    ("status_code", "expected"),
    [
        pytest.param(200, True, id="success_response"),
        pytest.param(500, False, id="server_error_response"),
    ],
)
def test_is_successful_response(status_code, expected):
    assert is_successful(status_code) is expected
```

## See Also

- [`test-parametrize-cases`](test-parametrize-cases.md) - naming individual cases within a parametrized test
- [`test-arrange-act-assert`](test-arrange-act-assert.md) - a clear name pairs with a clear, single-behavior body
- [`name-verb-functions-noun-classes`](name-verb-functions-noun-classes.md) - the naming principles tests inherit from general code
