# api-property-computed

> Use `@property` for computed/derived attributes instead of getter methods

## Why It Matters

Java- or C++-style `get_x()`/`set_x()` methods are unnecessary ceremony in Python: `@property` lets a computed value be accessed with plain attribute syntax (`obj.area`) while still running code on access, so you get encapsulation without forcing every caller to write parentheses. It also means you can start with a plain attribute and later turn it into a computed value without changing the public API or breaking any call sites — something a bare attribute-vs-method choice up front can't offer.

## Bad

```python
class Rectangle:
    def __init__(self, width: float, height: float) -> None:
        self.width = width
        self.height = height

    def get_area(self) -> float:
        return self.width * self.height

    def get_perimeter(self) -> float:
        return 2 * (self.width + self.height)

r = Rectangle(3, 4)
print(r.get_area())  # reads like a method call for something that's really just a value
```

## Good

```python
class Rectangle:
    def __init__(self, width: float, height: float) -> None:
        self.width = width
        self.height = height

    @property
    def area(self) -> float:
        return self.width * self.height

    @property
    def perimeter(self) -> float:
        return 2 * (self.width + self.height)

r = Rectangle(3, 4)
print(r.area)  # reads as a plain attribute; computed on access, always in sync
```

## Validating on Assignment with a Setter

```python
class Temperature:
    def __init__(self, celsius: float) -> None:
        self._celsius = celsius

    @property
    def celsius(self) -> float:
        return self._celsius

    @celsius.setter
    def celsius(self, value: float) -> None:
        if value < -273.15:
            raise ValueError("temperature below absolute zero")
        self._celsius = value

    @property
    def fahrenheit(self) -> float:
        return self._celsius * 9 / 5 + 32  # read-only derived value, no setter defined

t = Temperature(20.0)
t.celsius = 25.0        # validated on assignment
print(t.fahrenheit)      # 77.0, always derived from the current celsius value
```

Avoid `@property` for anything with real cost or side effects (network calls, disk I/O, O(n) recomputation on every access) — a property implies "cheap and side-effect-free," and violating that expectation surprises callers who assume attribute access is free.

## See Also

- [`api-dunder-methods`](api-dunder-methods.md) - other protocol methods that make objects feel native
- [`api-immutable-value-objects`](api-immutable-value-objects.md) - read-only properties paired with frozen state
- [`data-post-init-validation`](data-post-init-validation.md) - validating dataclass fields at construction time instead
