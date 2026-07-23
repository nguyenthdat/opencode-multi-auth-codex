# lint-format-on-save

> Auto-format with `ruff format` (or black); never hand-format code

## Why It Matters

Hand-formatted code produces diffs dominated by whitespace churn: one developer wraps a long call differently than another, PR reviews spend time on bracket placement instead of logic, and merge conflicts appear in lines that never changed semantically. An automatic formatter removes the decision entirely — there is exactly one correct layout for any given code, computed deterministically, so `git diff` only ever shows meaningful changes and code review never argues about style.

## Bad

```python
# Every contributor formats slightly differently by hand
def build_request(method,url,headers = None,
                     params=None, timeout = 30):
    return {
        "method": method, "url": url,
       "headers": headers or {},
        "params": params or {}, "timeout": timeout
    }

# The next commit "fixes" the spacing, producing a diff
# that touches every line without changing behavior.
```

## Good

```python
# ruff format output - deterministic, nobody argues about it
def build_request(
    method,
    url,
    headers=None,
    params=None,
    timeout=30,
):
    return {
        "method": method,
        "url": url,
        "headers": headers or {},
        "params": params or {},
        "timeout": timeout,
    }
```

## Editor Integration

```json
// .vscode/settings.json
{
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.ruff": "explicit",
      "source.organizeImports.ruff": "explicit"
    }
  }
}
```

```lua
-- Neovim (conform.nvim)
require("conform").setup({
  formatters_by_ft = {
    python = { "ruff_format" },
  },
  format_on_save = { timeout_ms = 500, lsp_fallback = true },
})
```

Format-on-save is a convenience layer, not the enforcement mechanism — pair it with `ruff format --check` in pre-commit and CI so unformatted code cannot merge even if a contributor's editor isn't configured (see `lint-pre-commit-hooks`).

## See Also

- [`lint-ruff-primary`](lint-ruff-primary.md) - the tool providing `ruff format`
- [`lint-pre-commit-hooks`](lint-pre-commit-hooks.md) - enforcing formatting outside the editor
- [`lint-ci-enforce`](lint-ci-enforce.md) - `ruff format --check` as a CI gate
