# test-pytest-plain-asserts

> Use pytest with plain `assert` statements instead of `unittest`'s `self.assertEqual` style

## Why It Matters

pytest rewrites plain `assert` statements at import time to produce detailed failure diffs — showing exactly which values differed and how — without needing a memorized API of `assertEqual`, `assertIn`, `assertIsNone`, and dozens of other methods. This lowers the barrier for writing tests (any Python expression works) and removes the friction of picking the "right" assertion method, which in `unittest` style often gets chosen incorrectly (e.g., `assertTrue(a == b)` loses the diff that `assertEqual(a, b)` would have given). Plain asserts are also more portable: they work identically whether the test is a bare function or a class method, with no base class required.

## Bad

```python
import unittest


class TestOrderTotal(unittest.TestCase):
    def test_calculates_total_with_tax(self):
        order = Order(items=[Item(price=10.0, qty=2)], tax_rate=0.1)
        self.assertEqual(order.total(), 22.0)
        self.assertTrue(order.total() > 0)          # loses the diff on failure
        self.assertIsNotNone(order.total())
        self.assertIn("tax", order.breakdown())
```

## Good

```python
def test_calculates_total_with_tax():
    order = Order(items=[Item(price=10.0, qty=2)], tax_rate=0.1)

    total = order.total()

    assert total == 22.0
    assert total > 0
    assert "tax" in order.breakdown()
```

On failure, pytest shows a rich assertion rewrite:

```
    assert total == 22.0
E   assert 20.0 == 22.0
E    +  where 20.0 = order.total()
```

## Comparing Collections and Floats

```python
def test_returns_sorted_unique_ids():
    result = dedupe_and_sort([3, 1, 2, 1, 3])
    assert result == [1, 2, 3]           # pytest diffs lists element-by-element


def test_float_total_within_tolerance():
    import pytest
    assert order.total() == pytest.approx(22.0, rel=1e-6)  # avoid exact float equality
```

## When `unittest.TestCase` Still Shows Up

Plain `assert` works fine even inside a `unittest.TestCase` subclass under pytest — you don't have to migrate a whole class to gain readable diffs. It's most useful to keep `TestCase` when you're maintaining legacy suites or need its `setUp`/`tearDown` lifecycle without adopting fixtures yet, but new code should default to plain functions and fixtures.

## See Also

- [`test-fixtures-setup`](test-fixtures-setup.md) - replacing `setUp`/`tearDown` with fixtures
- [`test-arrange-act-assert`](test-arrange-act-assert.md) - structuring the body around a single assert block
- [`test-descriptive-names`](test-descriptive-names.md) - naming tests that plain asserts make easy to keep small
