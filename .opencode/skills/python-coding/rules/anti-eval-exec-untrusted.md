# anti-eval-exec-untrusted

> Don't use `eval`/`exec` on untrusted or user-controlled input

## Why It Matters

`eval` and `exec` run arbitrary Python with the full privileges of the calling process — if any part of the string they execute is influenced by user input, an attacker can run arbitrary code, read environment variables and secrets, open network connections, or delete files, not just manipulate the intended computation. There is no sandboxing in standard `eval`/`exec`; even "restricting" globals is a well-documented, frequently-bypassed technique, not a real security boundary. Nearly every use case that reaches for `eval` (parsing expressions, dynamic configuration, computed formulas) has a safer, purpose-built alternative.

## Bad

```python
def calculate(expression: str) -> float:
    return eval(expression)     # user input directly executed as Python

# A request with expression = "__import__('os').system('rm -rf /')"
# runs that shell command with the server process's full privileges.

def load_user_config(config_str: str):
    exec(config_str)            # arbitrary code execution from a config file
```

## Good

```python
import ast
import operator

_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
}

def calculate(expression: str) -> float:
    """Safely evaluate a restricted arithmetic expression."""
    tree = ast.parse(expression, mode="eval")
    return _eval_node(tree.body)

def _eval_node(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval_node(node.left), _eval_node(node.right))
    raise ValueError(f"unsupported expression: {ast.dump(node)}")

def load_user_config(config_str: str) -> dict:
    import json
    return json.loads(config_str)   # data, not code
```

## Ruff Rule

`S307` and `S102` (flake8-bandit, ported as Ruff's `S` set) flag `eval`/`exec`:

```toml
[tool.ruff.lint]
select = ["S"]
```

```python
eval(user_input)   # S307: Use of possibly insecure function; consider using `ast.literal_eval`
exec(user_input)   # S102: Use of `exec` detected
```

## When It's (Narrowly) Acceptable

`ast.literal_eval` safely parses Python literals (numbers, strings, tuples, lists, dicts) without executing arbitrary code, and is the correct tool when you need "parse a Python-literal-looking string," not full expression evaluation:

```python
import ast
value = ast.literal_eval("[1, 2, 3]")  # safe: only literals, never function calls
```

Real `eval`/`exec` on fully trusted, developer-authored strings (e.g. a REPL, a plugin system that only loads code from the project's own trusted source tree) is the only defensible use — never on input that originates from a request body, a file upload, a URL parameter, or any other externally-controlled source.

## See Also

- [`lint-bandit-security`](lint-bandit-security.md) - the security linter that flags this pattern via the `S` rules
- [`anti-stringly-typed`](anti-stringly-typed.md) - preferring typed data over strings that get interpreted as code
- [`data-serialization-explicit`](data-serialization-explicit.md) - explicit, safe serialization instead of `eval`-based parsing
