# anti-god-object

> Don't build "God objects" that hold too many responsibilities and too much state

## Why It Matters

A class that owns database access, business rules, HTTP handling, caching, and logging all at once becomes the one file everyone has to touch and understand to make any change, which means merge conflicts concentrate there and every unrelated feature risks breaking every other feature. It's also nearly untestable in isolation — testing "does the discount calculation work" requires spinning up a database connection and an HTTP client because they're all entangled in the same object. Splitting responsibilities lets each piece be tested, reasoned about, and changed independently.

## Bad

```python
class ApplicationManager:
    def __init__(self):
        self.db_connection = connect_to_database()
        self.http_client = HttpClient()
        self.cache = {}
        self.logger = logging.getLogger()
        self.email_queue = []

    def get_user(self, user_id): ...
    def save_user(self, user): ...
    def send_welcome_email(self, user): ...
    def calculate_discount(self, order): ...
    def process_payment(self, order): ...
    def generate_invoice_pdf(self, order): ...
    def sync_to_analytics(self, event): ...
    def validate_shipping_address(self, address): ...
    def log_audit_event(self, event): ...
    # ... 40 more methods spanning six unrelated concerns
```

## Good

```python
class UserRepository:
    def __init__(self, db: Database) -> None:
        self._db = db

    def get(self, user_id: int) -> User: ...
    def save(self, user: User) -> None: ...


class PricingService:
    def calculate_discount(self, order: Order) -> Decimal: ...


class PaymentProcessor:
    def __init__(self, gateway: PaymentGateway) -> None:
        self._gateway = gateway

    def charge(self, order: Order) -> PaymentResult: ...


class NotificationService:
    def __init__(self, mailer: Mailer) -> None:
        self._mailer = mailer

    def send_welcome_email(self, user: User) -> None: ...
```

Each service is constructed with only the dependencies it needs and can be tested with a fake `Database` or `PaymentGateway`, independent of the others.

## Recognizing the Smell

- The class name is vague and all-encompassing: `Manager`, `Handler`, `Processor`, `Utils`, `Service` with no qualifier.
- Its constructor takes five or more unrelated dependencies.
- Methods can be grouped into two or more clusters that never call each other.
- Changing one method's behavior regularly requires re-testing unrelated methods because they share instance state.

The single-responsibility guideline is a heuristic, not dogma — a small script doesn't need four classes to send one email. The rule matters as the codebase and team grow, when uncoupled responsibilities start colliding within one file.

## See Also

- [`api-composition-inheritance`](api-composition-inheritance.md) - composing focused collaborators instead of one large class
- [`anti-global-mutable-state`](anti-global-mutable-state.md) - a related failure mode of centralizing too much shared state
- [`anti-premature-abstraction`](anti-premature-abstraction.md) - the opposite failure of over-engineering too early
