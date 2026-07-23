# lint-bandit-security

> Run a security linter (Bandit or Ruff's `S` rule set) in CI to catch common vulnerabilities

## Why It Matters

Common Python security mistakes — `eval` on request data, `subprocess.run(shell=True)` with unsanitized input, hardcoded credentials, weak hashes like MD5 for passwords — compile and run without complaint, so nothing short of a dedicated security linter catches them before a human reviewer happens to notice. Bandit (or Ruff's `S` rules, ported from Bandit) statically flags these patterns automatically on every push, catching vulnerabilities at the cheapest possible point to fix them: before merge, not after a penetration test or an incident.

## Bad

```python
import subprocess

def run_backup(hostname):
    # S602: shell=True with untrusted input - shell injection
    subprocess.run(f"backup.sh {hostname}", shell=True)

API_KEY = "hardcoded-example-key"  # S105: hardcoded secret

def hash_password(password):
    import hashlib
    return hashlib.md5(password.encode()).hexdigest()  # S324: weak hash

def load_config(path):
    import yaml
    return yaml.load(open(path))  # S506: unsafe loader, allows arbitrary code exec
```

## Good

```python
import subprocess
import hashlib
import os
import yaml

def run_backup(hostname: str) -> None:
    subprocess.run(["backup.sh", hostname], shell=False, check=True)

API_KEY = os.environ["BACKUP_API_KEY"]

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()  # or bcrypt/argon2 for real password storage

def load_config(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)
```

## Ruff Rule

```toml
# pyproject.toml
[tool.ruff.lint]
select = ["S"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "S105", "S106"]  # asserts and test fixtures aren't production secrets
```

Or standalone Bandit for teams wanting its richer severity/confidence reporting:

```bash
pip install bandit
bandit -r src/ -ll -c pyproject.toml
```

```toml
[tool.bandit]
exclude_dirs = ["tests", ".venv"]
skips = ["B101"]  # assert_used, acceptable outside prod code paths
```

| Code | Catches |
|---|---|
| `S101`/`B101` | `assert` used for security control (strips under `-O`) |
| `S105`-`S107` | hardcoded passwords/tokens |
| `S324` | weak hash (MD5/SHA1) for security purposes |
| `S506` | unsafe YAML/pickle deserialization |
| `S602`-`S609` | shell injection via `subprocess`/`os.system` |

## See Also

- [`lint-ruff-rule-selection`](lint-ruff-rule-selection.md) - enabling `S` alongside other rule categories
- [`anti-eval-exec-untrusted`](anti-eval-exec-untrusted.md) - the `eval`/`exec` pattern Bandit's `S307` flags
- [`lint-ci-enforce`](lint-ci-enforce.md) - making security lint failures block merges
