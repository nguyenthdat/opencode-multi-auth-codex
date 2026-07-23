# name-snake-case-functions

> Use `snake_case` for functions, methods, variables, and modules (PEP 8)

## Why It Matters

PEP 8 mandates `snake_case` for functions, methods, and variables so that Python code reads consistently across the entire ecosystem — every standard library module, and nearly every third-party package, follows it. Mixing conventions (`camelCase` from another language background) makes code visually jarring and breaks the reader's pattern-matching, since `PascalCase` is reserved for classes. Tools like `ruff` (rule `N802`/`N806`) and `pylint` flag violations automatically, so inconsistency also creates lint noise that trains reviewers to ignore warnings.

## Bad

```python
# camelCase leaking in from Java/JS habits
def calculateTotal(orderItems):
    totalPrice = 0
    for lineItem in orderItems:
        totalPrice += lineItem.unitPrice * lineItem.quantity
    return totalPrice


class OrderProcessor:
    def ProcessOrder(self, orderId):  # PascalCase method - looks like a class
        userAccount = self.fetchAccount(orderId)
        return userAccount
```

## Good

```python
def calculate_total(order_items):
    total_price = 0
    for line_item in order_items:
        total_price += line_item.unit_price * line_item.quantity
    return total_price


class OrderProcessor:
    def process_order(self, order_id):
        user_account = self.fetch_account(order_id)
        return user_account
```

## Exceptions

A few contexts intentionally deviate from `snake_case`:

- **Constants** use `SCREAMING_SNAKE_CASE` (see `name-screaming-constants`).
- **Classes** use `PascalCase` (see `name-pascal-case-classes`).
- **Interop with external APIs**: when subclassing a framework or library that mandates `camelCase` (e.g., some `unittest` legacy methods, or a Qt binding), match the external convention only for the overridden members, not your own code.

```python
# Overriding a legacy unittest hook - keep the required name
class MyTestCase(unittest.TestCase):
    def setUp(self):  # unittest's convention, not ours to change
        self.client = build_client()

    def test_creates_valid_session(self):  # our own tests stay snake_case
        session = self.client.create_session()
        assert session.is_valid
```

## See Also

- [`name-pascal-case-classes`](name-pascal-case-classes.md) - the counterpart convention for class names
- [`name-screaming-constants`](name-screaming-constants.md) - naming for module-level constants
- [`name-verb-functions-noun-classes`](name-verb-functions-noun-classes.md) - semantic naming that pairs with casing rules
- [`lint-ruff-rule-selection`](lint-ruff-rule-selection.md) - enabling `N`-prefixed naming lints
