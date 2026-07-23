# anti-deep-nesting

> Don't nest conditionals/loops beyond 2-3 levels; use early returns/guard clauses instead

## Why It Matters

Each additional level of nesting doubles the number of paths a reader has to hold in their head simultaneously to understand what a block of code does, and it pushes the actual logic further right, shrinking the usable line width. Deeply nested code is also where bugs hide best — an `if` on line 40 that should apply to the whole function but was accidentally placed inside an inner loop is easy to write and hard to spot in review. Guard clauses that return/continue early flatten the structure so each remaining branch reads as "the interesting case," not "yet another level of exception handling."

## Bad

```python
def process_order(order):
    if order is not None:
        if order.status == "pending":
            if order.items:
                if order.customer.is_active:
                    if order.total > 0:
                        # the actual logic, five levels deep
                        charge(order)
                        return "charged"
                    else:
                        return "zero total"
                else:
                    return "inactive customer"
            else:
                return "no items"
        else:
            return "not pending"
    else:
        return "no order"
```

## Good

```python
def process_order(order: Order | None) -> str:
    if order is None:
        return "no order"
    if order.status != "pending":
        return "not pending"
    if not order.items:
        return "no items"
    if not order.customer.is_active:
        return "inactive customer"
    if order.total <= 0:
        return "zero total"

    charge(order)
    return "charged"
```

## Applying the Same Idea to Loops

```python
# Bad: nested loop with a conditional guarding the real work
for order in orders:
    if order.is_valid():
        for item in order.items:
            if item.in_stock:
                reserve(item)

# Good: guard clauses via `continue` flatten the loop body
for order in orders:
    if not order.is_valid():
        continue
    for item in order.items:
        if not item.in_stock:
            continue
        reserve(item)
```

## When Nesting Is Unavoidable

Some algorithms (matrix traversal, recursive tree walks) are inherently nested — the target isn't zero nesting, it's removing *incidental* nesting caused by validation and error-handling that could instead exit early. Two to three levels is a practical ceiling; beyond that, consider extracting an inner block into its own function, which also gives it a name that documents what it does.

## See Also

- [`err-fail-fast-validate`](err-fail-fast-validate.md) - validating and returning early instead of nesting the happy path
- [`api-return-consistent-types`](api-return-consistent-types.md) - keeping early-return functions' return types consistent
- [`anti-god-object`](anti-god-object.md) - extracting nested logic into focused, named collaborators
