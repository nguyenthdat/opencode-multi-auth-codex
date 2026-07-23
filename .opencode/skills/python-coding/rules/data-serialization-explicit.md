# data-serialization-explicit

> Make (de)serialization explicit and centralized at system boundaries

## Why It Matters

When every module reaches for `json.dumps`/`json.loads` (or ad hoc string formatting) on its own, subtle inconsistencies creep in — one place serializes datetimes as ISO strings, another as Unix timestamps, a third forgets to handle `Decimal` at all and crashes. Centralizing (de)serialization logic in one place per boundary (a single `to_dict`/`from_dict`, a Pydantic model, or a dedicated serializer module) means the encoding format is decided once and consistently, and there's exactly one place to fix it when the schema changes.

## Bad

```python
import json
from datetime import datetime

# Module A serializes dates as ISO strings
def save_event(name: str, when: datetime) -> str:
    return json.dumps({"name": name, "when": when.isoformat()})

# Module B, written by someone else, serializes dates as timestamps
def save_metric(name: str, when: datetime) -> str:
    return json.dumps({"name": name, "when": when.timestamp()})

# Now every consumer of "when" has to guess the format per-endpoint.
```

## Good

```python
from datetime import datetime, UTC
from dataclasses import dataclass, asdict
import json

@dataclass(slots=True, frozen=True)
class Event:
    name: str
    when: datetime

    def to_json(self) -> str:
        return json.dumps({"name": self.name, "when": self.when.isoformat()})

    @classmethod
    def from_json(cls, raw: str) -> "Event":
        data = json.loads(raw)
        return cls(name=data["name"], when=datetime.fromisoformat(data["when"]))

event = Event(name="deploy", when=datetime.now(UTC))
wire_format = event.to_json()
restored = Event.from_json(wire_format)
```

## Real-World Example: Pydantic's Centralized Serialization

```python
from pydantic import BaseModel
from datetime import datetime

class Event(BaseModel):
    name: str
    when: datetime

event = Event(name="deploy", when=datetime.now())
payload = event.model_dump_json()       # one documented, consistent encoding
restored = Event.model_validate_json(payload)  # one documented decoding path
```

Pydantic (and similarly `attrs` with `cattrs`) centralizes the encode/decode
contract on the model itself, so every caller gets identical serialization
behavior for free instead of reimplementing it ad hoc at each call site.

## See Also

- [`data-pydantic-validation`](data-pydantic-validation.md) - validating at the same boundary where serialization happens
- [`data-dataclass-vs-pydantic`](data-dataclass-vs-pydantic.md) - choosing the right model type for the boundary
- [`api-classmethod-factory`](api-classmethod-factory.md) - the `from_json`-style classmethod constructor pattern
