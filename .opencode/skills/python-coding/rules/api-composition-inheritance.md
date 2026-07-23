# api-composition-inheritance

> Prefer composition over deep inheritance hierarchies

## Why It Matters

Deep inheritance chains couple subclasses tightly to the exact implementation details of every ancestor, so a change several levels up the hierarchy can silently break behavior far below it (the "fragile base class" problem). They also force a rigid single-axis taxonomy onto problems that are naturally multi-dimensional — a `FlyingSwimmingRobot` doesn't fit cleanly into a `Bird`/`Fish` hierarchy. Composition — giving an object other objects as collaborators instead of ancestors — keeps each piece independently testable and lets you combine behaviors freely at runtime.

## Bad

```python
class Animal:
    def make_sound(self) -> str:
        raise NotImplementedError

class FlyingAnimal(Animal):
    def fly(self) -> str:
        return "flying"

class SwimmingAnimal(Animal):
    def swim(self) -> str:
        return "swimming"

# A duck both flies and swims — which base class wins? Multiple inheritance
# here quickly produces MRO headaches as more behaviors are added
class Duck(FlyingAnimal, SwimmingAnimal):
    def make_sound(self) -> str:
        return "quack"
```

## Good

```python
from typing import Protocol

class FlightBehavior(Protocol):
    def fly(self) -> str: ...

class SwimBehavior(Protocol):
    def swim(self) -> str: ...

class WingFlight:
    def fly(self) -> str:
        return "flying with wings"

class PaddleSwim:
    def swim(self) -> str:
        return "swimming with webbed feet"

class Duck:
    def __init__(self, flight: FlightBehavior, swim: SwimBehavior) -> None:
        self._flight = flight
        self._swim = swim

    def make_sound(self) -> str:
        return "quack"

    def fly(self) -> str:
        return self._flight.fly()

    def swim(self) -> str:
        return self._swim.swim()

duck = Duck(flight=WingFlight(), swim=PaddleSwim())
```

## When Inheritance Is Still Appropriate

Shallow, single-level inheritance for genuine "is-a" relationships with shared, non-overridden behavior is fine — `Exception` subclasses, ORM model base classes, or a single abstract interface with one level of concrete implementations:

```python
class RetryableError(Exception):
    """Base for errors that a retry policy should catch."""

class RateLimitedError(RetryableError):
    def __init__(self, retry_after: float) -> None:
        super().__init__(f"rate limited, retry after {retry_after}s")
        self.retry_after = retry_after
```

The warning sign is inheritance used purely for code reuse three or more levels deep, or a subclass that overrides half its parent's methods to "turn off" inherited behavior — both indicate composition would model the problem better.

## See Also

- [`api-protocol-over-abc`](api-protocol-over-abc.md) - defining the collaborator interfaces composition depends on
- [`anti-god-object`](anti-god-object.md) - a related failure mode of overloaded, monolithic classes
- [`api-classmethod-factory`](api-classmethod-factory.md) - constructing composed objects cleanly
