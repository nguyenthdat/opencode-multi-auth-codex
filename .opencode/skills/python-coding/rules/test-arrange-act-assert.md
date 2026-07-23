# test-arrange-act-assert

> Structure tests as arrange/act/assert (or given/when/then)

## Why It Matters

A test that interleaves setup, the action under test, and assertions makes it hard to tell what is actually being verified versus what is incidental scaffolding — reviewers have to mentally untangle the flow every time. The arrange/act/assert structure gives every test the same predictable shape: build the world, do one thing, check the outcome, which makes tests fast to read, easy to spot-check for a single responsibility, and quick to debug when they fail (you know exactly which section broke). It also naturally discourages testing more than one behavior per test, since a second "act" step is a visual signal the test has grown too broad.

## Bad

```python
def test_order_processing():
    order = Order(customer_id=1)
    order.add_item(Item(sku="ABC", price=10.0, qty=2))
    assert len(order.items) == 1              # assertion mixed into arrange
    order.apply_discount(0.1)
    result = order.checkout()
    assert result.total == 18.0
    order.add_item(Item(sku="XYZ", price=5.0, qty=1))  # more "act" after assert
    result2 = order.checkout()
    assert result2.total == 22.5
```

## Good

```python
def test_checkout_applies_discount_to_total():
    # Arrange
    order = Order(customer_id=1)
    order.add_item(Item(sku="ABC", price=10.0, qty=2))
    order.apply_discount(0.1)

    # Act
    result = order.checkout()

    # Assert
    assert result.total == 18.0


def test_checkout_reflects_added_items():
    # Arrange
    order = Order(customer_id=1)
    order.add_item(Item(sku="ABC", price=10.0, qty=2))
    order.add_item(Item(sku="XYZ", price=5.0, qty=1))

    # Act
    result = order.checkout()

    # Assert
    assert result.total == 25.0
```

## Given/When/Then for Behavior-Driven Style

The same structure, phrased for behavior-focused teams (common with `pytest-bdd` or spec-style naming):

```python
def test_expired_token_is_rejected():
    # Given an expired token
    token = issue_token(ttl_seconds=-1)

    # When it's used to authenticate
    result = authenticate(token)

    # Then authentication fails
    assert result.is_authenticated is False
    assert result.reason == "token_expired"
```

## Keeping "Act" to One Line

If "act" needs more than one statement, that's usually a sign the function under test should expose a single entry point, or that the test is covering more than one behavior and should be split.

## See Also

- [`test-descriptive-names`](test-descriptive-names.md) - names should describe the single behavior each AAA test covers
- [`test-no-logic-in-tests`](test-no-logic-in-tests.md) - keeping each section straight-line, no branching
- [`test-fixtures-setup`](test-fixtures-setup.md) - moving repeated "arrange" code into fixtures
