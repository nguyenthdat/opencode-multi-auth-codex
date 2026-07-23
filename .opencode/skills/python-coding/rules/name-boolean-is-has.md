# name-boolean-is-has

> Prefix boolean-returning names with `is_`, `has_`, `can_`, or `should_`

## Why It Matters

A boolean prefix turns a name into a predicate you can read as a sentence — `if is_valid:` or `if user.has_permission:` — without opening the definition to check what `valid` or `permission` actually mean as a bare noun. Ambiguous boolean names (`status`, `active`, `flag`) force readers to guess whether they hold a boolean, a string, or an enum, and that ambiguity compounds every time the variable is passed around or stored on an object. Consistent predicate naming also makes autocomplete and code review far faster, since `is_`/`has_` immediately narrows the type in the reader's head.

## Bad

```python
class User:
    def __init__(self, email: str, admin: bool, verified: bool) -> None:
        self.email = email
        self.admin = admin        # is this a bool, a role string, an object?
        self.verified = verified

    def active(self) -> bool:     # reads like a noun/property, not a predicate
        return self.verified and not self.suspended


def process(order, ready):        # `ready` - bool? a Ready object? unclear
    if ready:
        ship(order)
```

## Good

```python
class User:
    def __init__(self, email: str, is_admin: bool, is_verified: bool) -> None:
        self.email = email
        self.is_admin = is_admin
        self.is_verified = is_verified

    def is_active(self) -> bool:
        return self.is_verified and not self.is_suspended


def process(order, is_ready: bool) -> None:
    if is_ready:
        ship(order)
```

## Choosing the Right Prefix

| Prefix | Use for | Example |
|---|---|---|
| `is_` | Current state or identity | `is_valid`, `is_empty`, `is_authenticated` |
| `has_` | Possession or existence of something | `has_children`, `has_permission`, `has_expired` |
| `can_` | Capability or permission | `can_edit`, `can_retry` |
| `should_` | A recommendation or decision the caller must act on | `should_retry`, `should_notify` |

```python
@dataclass
class Task:
    attempts: int
    max_attempts: int
    deadline: datetime

    @property
    def has_expired(self) -> bool:
        return datetime.now(tz=timezone.utc) > self.deadline

    @property
    def should_retry(self) -> bool:
        return self.attempts < self.max_attempts and not self.has_expired
```

## See Also

- [`name-snake-case-functions`](name-snake-case-functions.md) - casing rules these predicate names still follow
- [`api-property-computed`](api-property-computed.md) - exposing `is_`/`has_` predicates as properties
- [`type-narrow-guards`](type-narrow-guards.md) - `is_` predicates often double as type-narrowing guards
