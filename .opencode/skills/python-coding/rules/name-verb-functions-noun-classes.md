# name-verb-functions-noun-classes

> Name functions/methods as verbs and classes as nouns

## Why It Matters

A function or method performs an action, so a verb phrase (`send_email`, `calculate_total`) tells the caller what happens when they invoke it; a class represents a concept or thing, so a noun (`EmailSender`, `OrderCalculator`) tells the reader what kind of object they're instantiating. When functions get noun names (`email_sender()`) or classes get verb names (`class SendEmail:`), call sites become ambiguous — `send_email(msg)` reads as an action, but `SendEmail(msg)` reads like it might just be constructing a value, not doing anything yet. This distinction becomes critical in larger codebases where reviewers scan hundreds of call sites and rely on the verb/noun split to predict side effects.

## Bad

```python
class SendEmail:              # verb name on a class - looks like a function
    def __init__(self, message):
        self.message = message

    def run(self):
        smtp_client.send(self.message)


def email_sender(message):    # noun name on a function - unclear it acts
    return smtp_client.send(message)


def validation(payload):      # noun, but it's clearly performing an action
    if not payload.get("id"):
        raise ValueError("missing id")
```

## Good

```python
class EmailSender:             # noun - a thing you construct and reuse
    def __init__(self, smtp_client):
        self.smtp_client = smtp_client

    def send(self, message):   # verb method on the noun class
        self.smtp_client.send(message)


def send_email(message):       # verb - a function that performs an action
    smtp_client.send(message)


def validate(payload):         # verb - clearly an action
    if not payload.get("id"):
        raise ValueError("missing id")
```

## Boundary Cases: Factories and Builders

Factory functions are a deliberate exception — they read as verbs (`create_user`, `build_config`) even though they return a noun-like object, because the emphasis is on the act of construction:

```python
def create_user(email: str) -> User:
    return User(email=email)


class UserBuilder:              # noun - the builder itself is a thing
    def with_email(self, email: str) -> "UserBuilder":  # verb method
        self._email = email
        return self

    def build(self) -> User:    # verb method - performs the construction
        return User(email=self._email)
```

## See Also

- [`name-pascal-case-classes`](name-pascal-case-classes.md) - casing convention that pairs with noun class names
- [`name-snake-case-functions`](name-snake-case-functions.md) - casing convention that pairs with verb function names
- [`api-classmethod-factory`](api-classmethod-factory.md) - naming factory methods as verbs on noun classes
