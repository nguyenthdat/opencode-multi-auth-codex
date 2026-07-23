# Contributing

Thanks for helping improve opencode-multi-auth-codex.

## Before Opening an Issue

- Search existing issues and pull requests.
- Include OpenCode, Bun, operating system, and package versions.
- State the install method: npm plugin, GitHub plugin, or source checkout.
- Remove account names, emails, tokens, cookies, and sensitive screenshots.
- Provide the smallest reproducible example.

## Source Layout

- `src/`: plugin, CLI, HTTP server, APIs, store, auth, and routing logic.
- `web-ui/`: React 19 dashboard components and CSS.
- `tests/`: automated unit, integration, asset-smoke, failure, stress, sandbox,
  and soak-scaffold tests.
- `dist/`: generated backend and dashboard package output.
- `docs/images/react-dashboard.png`: illustrative README screenshot.

Never hand-edit `dist/`. Run `bun run build` after changes under `src/` or
`web-ui/` and include the intended generated changes.

## Development

```bash
bun install --frozen-lockfile
bun run lint
bun run build
bun test
uv run --with 'python-dotenv>=1.2.1,<2' python -m unittest auto-login/test_auto_login.py
bun audit
npm pack --dry-run
```

Build before dashboard smoke tests so the test reads the current React bundle,
not a stale committed asset. Confirm the package manifest contains
`dist/web-ui/dashboard.js` and `dist/web-ui/dashboard.css`.

## Pull Requests

Keep pull requests focused. A strong pull request includes:

- a concise problem statement and intended behavior
- tests for behavior changes
- documentation updates for user-visible or architectural changes
- current generated `dist/` output
- manual desktop/mobile evidence when React behavior changes and no automated
  browser test covers it
- no credentials or private account data

Start with an issue before proposing a large feature or architectural change.

## Responsible Use

Contributions must not add credential theft, unauthorized account sharing,
disposable account provisioning, provider enforcement evasion, or secret
collection. Use only accounts you own or are authorized to operate and follow
the terms of every connected service.
