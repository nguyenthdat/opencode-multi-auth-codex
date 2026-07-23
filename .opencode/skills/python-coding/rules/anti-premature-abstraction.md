# anti-premature-abstraction

> Don't over-abstract (base classes, plugin systems, config layers) before duplication actually hurts

## Why It Matters

An abstraction built before there are at least two or three real, concrete use cases is a guess about what will vary — and guesses about future requirements are usually wrong, leaving behind a generic base class, a plugin registry, or a configuration layer that has to be worked around (or ripped out) once the real requirements appear. Premature abstraction also has a real ongoing cost even when it's never wrong: every future reader has to trace through an extra layer of indirection to understand code that, for a single concrete case, would have been a plain function.

## Bad

```python
# Written for a single exporter, "in case we need others later"
class BaseExporter(ABC):
    @abstractmethod
    def configure(self, options: ExporterOptions) -> None: ...
    @abstractmethod
    def validate(self) -> bool: ...
    @abstractmethod
    def export(self, data: Any) -> ExportResult: ...

class ExporterFactory:
    _registry: dict[str, type[BaseExporter]] = {}

    @classmethod
    def register(cls, name: str, exporter: type[BaseExporter]) -> None:
        cls._registry[name] = exporter

    @classmethod
    def create(cls, name: str) -> BaseExporter:
        return cls._registry[name]()

class CsvExporter(BaseExporter):
    def configure(self, options): ...
    def validate(self): return True
    def export(self, data): ...

ExporterFactory.register("csv", CsvExporter)
# Three layers of indirection for exactly one exporter that exists today.
```

## Good

```python
def export_to_csv(data: list[dict], path: str) -> None:
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

# When a second exporter (JSON, Parquet) is actually needed,
# extract the shared shape then - informed by two real
# implementations instead of a guess about what varies.
```

## When Abstraction Is Warranted

Introduce a base class, protocol, or plugin registry once you have concrete evidence, not speculation:

- **Duplication has already happened** two or three times with a clear, repeating shape.
- **An external contract requires it** — e.g. a public library API where callers genuinely need to supply their own implementation.
- **A requirement is confirmed**, not hypothetical — a ticket or roadmap item, not "we might need this."

```python
# Second real exporter exists - now the shared shape is evidence-based
class Exporter(Protocol):
    def export(self, data: list[dict], path: str) -> None: ...
```

The heuristic often called "rule of three": write it concretely twice, abstract on the third occurrence, when the actual variation points are known rather than guessed.

## See Also

- [`anti-god-object`](anti-god-object.md) - the opposite failure of under-abstracting into one giant class
- [`api-protocol-over-abc`](api-protocol-over-abc.md) - lightweight structural typing when abstraction is warranted
- [`perf-avoid-premature-optimization`](perf-avoid-premature-optimization.md) - the performance-tuning analogue of this same principle
