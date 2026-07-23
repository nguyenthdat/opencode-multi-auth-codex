# name-module-short-lowercase

> Keep module/package names short, lowercase, without underscores when possible (PEP 8)

## Why It Matters

PEP 8 recommends short, all-lowercase module names because they're what appears in every `import` statement, and Python doesn't allow hyphens or arbitrary case in identifiers used with `import module_name`. A verbose or underscore-heavy module name (`user_account_management_utilities.py`) makes every import site noisy (`from user_account_management_utilities import ...`) and is harder to type consistently than a short one (`accounts.py`). Package names in particular become part of the public API surface on PyPI, where the convention is lowercase with no separators (`requests`, `numpy`, `httpx`), so departing from it looks unidiomatic to downstream users.

## Bad

```python
# File: User_Account_Management.py - mixed case, verbose
# File: http_client_for_external_api_calls.py - unwieldy, over-descriptive
# File: DataProcessingUtilities.py - PascalCase, looks like a class

from User_Account_Management import UserAccount
from http_client_for_external_api_calls import Client
```

## Good

```python
# File: accounts.py
# File: httpclient.py  (or http_client.py if a single word reads poorly)
# File: dataproc.py

from accounts import UserAccount
from httpclient import Client
```

## When a Single Underscore Is Still Clearer

PEP 8 says "short" and "lowercase" are the priorities; underscores are permitted if it meaningfully improves readability, and the standard library itself uses them (`os.path`, `xml.etree`, `concurrent.futures`, `unittest.mock`). Prefer no separator only when the merged word stays readable:

```python
# Both fine - underscore used because the merged word is hard to parse
import unittest.mock
import concurrent.futures

# Prefer this over an artificially squeezed name:
import htmlparser  # harder to read
import html_parser  # or just use the stdlib's html.parser
```

## Package Naming for Distribution

For anything published or intended to be `pip install`-able, follow the PyPI convention directly — lowercase, hyphen in the distribution name, underscore (or nothing) in the importable package name:

```toml
# pyproject.toml
[project]
name = "my-awesome-tool"        # hyphenated distribution name (PyPI convention)
```

```
src/
  my_awesome_tool/               # underscore package name (valid Python identifier)
    __init__.py
    core.py
```

## See Also

- [`proj-src-layout`](proj-src-layout.md) - where module and package names live in project structure
- [`proj-namespace-packages`](proj-namespace-packages.md) - naming considerations for namespace packages
- [`name-snake-case-functions`](name-snake-case-functions.md) - the sibling convention for functions and variables
