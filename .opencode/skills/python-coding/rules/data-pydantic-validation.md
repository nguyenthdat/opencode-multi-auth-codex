# data-pydantic-validation

> Use Pydantic models to validate data at I/O boundaries (APIs, config, files)

## Why It Matters

Data crossing a trust boundary — JSON from an HTTP request, a YAML config file, an environment variable — arrives untyped and unverified; using it directly as a `dict` lets malformed or malicious input propagate deep into business logic before anything fails. Pydantic validates and coerces that data once, at the edge, converting "maybe garbage" into a fully-typed object the rest of the codebase can trust without re-checking.

## Bad

```python
def create_order(payload: dict) -> dict:
    # No validation: wrong types, missing keys, or negative quantities
    # all sail through until something downstream crashes confusingly.
    return {
        "sku": payload["sku"],
        "quantity": payload["quantity"],
        "price_cents": payload["price_cents"],
    }

# payload = {"sku": "ABC", "quantity": -5, "price_cents": "not a number"}
# create_order(payload) raises deep inside, or worse, silently corrupts data
```

## Good

```python
from pydantic import BaseModel, Field, field_validator

class OrderRequest(BaseModel):
    sku: str = Field(min_length=1, max_length=32)
    quantity: int = Field(gt=0)
    price_cents: int = Field(ge=0)

    @field_validator("sku")
    @classmethod
    def sku_uppercase(cls, v: str) -> str:
        return v.upper()

def create_order(payload: dict) -> OrderRequest:
    # Raises a single, structured ValidationError with every problem
    # listed, right at the boundary — nothing invalid gets further in.
    return OrderRequest.model_validate(payload)
```

## Real-World Example: FastAPI Request Bodies

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class CreateUserRequest(BaseModel):
    email: str
    age: int = Field(ge=0, le=150)

@app.post("/users")
async def create_user(request: CreateUserRequest) -> dict:
    # FastAPI validates the request body against CreateUserRequest before
    # this function even runs; invalid payloads get a 422 automatically.
    return {"email": request.email, "age": request.age}
```

This is the standard pattern in FastAPI, and equally applicable to config
loading (`Settings(BaseSettings)`), message queue consumers, and CLI
argument parsing — anywhere untyped data enters the system.

## See Also

- [`data-dataclass-vs-pydantic`](data-dataclass-vs-pydantic.md) - when to reach for a plain dataclass instead
- [`data-post-init-validation`](data-post-init-validation.md) - the dataclass-native alternative for invariant checks
- [`err-fail-fast-validate`](err-fail-fast-validate.md) - the general principle of validating early
- [`data-serialization-explicit`](data-serialization-explicit.md) - centralizing (de)serialization at the same boundary
