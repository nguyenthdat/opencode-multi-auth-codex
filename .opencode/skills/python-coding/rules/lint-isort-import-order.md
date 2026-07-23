# lint-isort-import-order

> Sort and group imports consistently (stdlib / third-party / local)

## Why It Matters

Unordered imports make it hard to spot at a glance whether a module depends on a heavy third-party package or just the standard library, and they cause needless merge conflicts when two branches add imports in different places. A consistent stdlib/third-party/local grouping, alphabetized within each group, means every file reads the same way and `git blame` on the import block stays meaningful instead of being dominated by reordering commits.

## Bad

```python
from myapp.models import User
import requests
from myapp.db import session
import os
from django.conf import settings
import sys
from myapp.utils import slugify
import json
from myapp.models import Profile

# Stdlib, third-party, and local imports interleaved with
# no alphabetization - every new import gets tacked onto
# the end wherever it's convenient.
```

## Good

```python
import json
import os
import sys

import requests
from django.conf import settings

from myapp.db import session
from myapp.models import Profile, User
from myapp.utils import slugify
```

## Ruff Rule

Ruff's `I` rule set (ported from isort) handles this automatically as part of `ruff check --fix`:

```toml
# pyproject.toml
[tool.ruff.lint]
select = ["I"]

[tool.ruff.lint.isort]
known-first-party = ["myapp"]
combine-as-imports = true
force-sort-within-sections = true
```

```bash
ruff check --select I --fix .
```

## Grouping Rules

1. `__future__` imports first (if any).
2. Standard library (`os`, `sys`, `json`, `pathlib`).
3. Third-party packages (`requests`, `django`, `pydantic`).
4. First-party / local application imports (`myapp.*`), which Ruff identifies via `known-first-party`.
5. A blank line separates each group; imports within a group are alphabetized, with `import x` before `from x import y` optionally combined via `force-sort-within-sections`.

Standalone `isort` still works identically for teams not yet on Ruff, using the same `profile = "black"` compatibility setting to avoid formatter conflicts.

## See Also

- [`lint-ruff-primary`](lint-ruff-primary.md) - Ruff's `I` rule set replaces standalone isort
- [`lint-ruff-rule-selection`](lint-ruff-rule-selection.md) - enabling `I` alongside other rule groups
- [`proj-src-layout`](proj-src-layout.md) - the package layout that `known-first-party` reflects
