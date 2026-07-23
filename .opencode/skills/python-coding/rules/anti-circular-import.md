# anti-circular-import

> Don't create circular imports through poor module boundaries

## Why It Matters

When module `a` imports from `b` and `b` imports from `a`, Python's import system has to execute both modules partially before either finishes, which means whichever module runs second sees an incomplete version of the other — attributes, classes, or functions defined later in the file simply aren't there yet, producing an `ImportError: cannot import name` that depends on which module happens to be imported first at runtime. Circular imports are almost always a symptom of an actual design problem: two modules that each need pieces of the other probably shouldn't be split the way they are.

## Bad

```python
# models.py
from services import notify_user   # imports services

class Order:
    def complete(self):
        notify_user(self.customer)

# services.py
from models import Order   # imports models - circular!

def notify_user(customer):
    print(f"Notifying {customer}")

def get_pending_orders() -> list["Order"]:
    ...

# ImportError: cannot import name 'Order' from partially initialized
# module 'models' (most likely due to a circular import)
```

## Good

```python
# models.py - no dependency on services
class Order:
    def complete(self, notifier: "Notifier") -> None:
        notifier.notify(self.customer)

# services.py - depends on models, not the reverse
from models import Order

class Notifier:
    def notify(self, customer) -> None:
        print(f"Notifying {customer}")

def get_pending_orders() -> list[Order]:
    ...
```

Breaking the cycle here means `Order` doesn't call `notify_user` directly — it accepts a `Notifier` collaborator, so the dependency only flows one way: `services` depends on `models`, never the reverse.

## Other Fixes When Restructuring Isn't Immediate

```python
# Local (deferred) import - breaks the cycle at import time,
# at the cost of hiding the dependency until the function runs
def complete_order(order):
    from services import notify_user   # imported lazily, inside the function
    notify_user(order.customer)
```

```python
# TYPE_CHECKING-only import - for type hints that would otherwise
# create a cycle, with zero runtime cost or circularity
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from services import Notifier

def complete(self, notifier: "Notifier") -> None: ...
```

Both are pragmatic escape hatches, not a fix for the underlying design — a codebase with several of these is a signal that module boundaries need to be redrawn, typically by extracting the shared pieces both modules need into a third, lower-level module that neither depends on the other for.

## See Also

- [`proj-package-by-feature`](proj-package-by-feature.md) - structuring modules to avoid these cycles in the first place
- [`anti-wildcard-import`](anti-wildcard-import.md) - another import-hygiene issue that compounds circularity problems
- [`api-composition-inheritance`](api-composition-inheritance.md) - dependency-inversion via composition to break cycles
