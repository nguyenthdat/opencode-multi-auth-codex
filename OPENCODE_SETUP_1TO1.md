# OpenCode Setup (Current 1:1 Stack)

This guide installs the current `@nguyenthdat/opencode-multi-auth-codex`
package for OpenCode. It replaces the former `@nguyenthdat`-specific setup, old
package paths, and GPT-5.2-to-5.3 mapping instructions.

For the complete option reference, use `README.md`. Third-party plugins such as
Antigravity or agent harnesses are optional and are not configured or versioned
by this repository.

## What You Get

- Multiple ChatGPT/Codex OAuth accounts with local rotation.
- OpenCode TUI account controls through `/codex`.
- A responsive React 19 dashboard for accounts, quotas, routing, and logs.
- Account enable/disable, targeted re-auth, tags, notes, and Force Mode.
- Rotation strategies: `round-robin`, `least-used`, `random`, and
  `weighted-round-robin`.

## Requirements

- Bun 1.3 or newer.
- OpenCode CLI 1.18.4 or newer.
- ChatGPT/Codex accounts you own or are authorized to operate.

```bash
bun --version
opencode --version
```

## Install the OpenCode Plugin

Install the current npm package into OpenCode:

```bash
opencode plugin @nguyenthdat/opencode-multi-auth-codex@latest --global
```

Restart OpenCode after installation. Run `/codex` or open the command palette
and select **Codex accounts**.

Config-based installation is also supported:

```json
{
  "plugin": ["@nguyenthdat/opencode-multi-auth-codex@latest"]
}
```

Do not use the former `@guard22` filesystem path or the old
`github:guard22/...#v1.0.9` reference.

## Install the Shell Command

The OpenCode plugin installer does not guarantee that the package CLI is on
your shell `PATH`. Install the package globally when you also want the
`opencode-multi-auth` command:

```bash
bun add --global @nguyenthdat/opencode-multi-auth-codex@latest
export PATH="$HOME/.bun/bin:$PATH"
opencode-multi-auth --help
```

## Add and Manage Accounts

Use the TUI:

```text
/codex
```

Or use the CLI:

```bash
opencode-multi-auth add personal
opencode-multi-auth add work
opencode-multi-auth status
```

The default account store is:

```text
~/.config/opencode-multi-auth/accounts.json
```

Treat the store as sensitive. It contains OAuth credentials and is written with
restricted file permissions.

## React Dashboard

Start the dashboard on loopback only:

```bash
opencode-multi-auth web --host 127.0.0.1 --port 3434
```

Open `http://127.0.0.1:3434`.

The dashboard supports:

- live account, store, auth, and sync status
- quota windows, confidence state, history sparklines, search, filters, and sort
- token and limits refresh operations
- account add, remove, enable/disable, targeted re-auth, tags, and notes
- Force Mode and rotation strategy selection
- optional saved-credential auto-login controls
- local runtime logs

Saved credentials default to
`~/.config/opencode-multi-auth/credentials.json`. Override the file with
`OPENCODE_MULTI_AUTH_AUTO_LOGIN_CREDENTIALS_FILE` when using a source-checkout
fixture such as `auto-login/credentials.json`.

The dashboard is a bundled React 19 SPA:

```text
web-ui/main.tsx          React components and state
web-ui/dashboard.css     responsive dark theme
src/web.ts               HTTP shell, static assets, security checks, and APIs
dist/web-ui/             generated dashboard.js, dashboard.css, and source map
```

The package does not load React or fonts from a CDN at runtime.

## Build from Source

```bash
git clone https://github.com/nguyenthdat/opencode-multi-auth-codex.git
cd opencode-multi-auth-codex
bun install --frozen-lockfile
bun run lint
bun run build
bun test
```

Start the locally built dashboard:

```bash
bun dist/cli.js web --host 127.0.0.1 --port 3434
```

Edit backend/plugin code under `src/` and dashboard code under `web-ui/`. Never
hand-edit `dist/`; regenerate it with `bun run build`.

## Current Model Support

The plugin exposes the current GPT-5.6 family when runtime model injection is
enabled:

- `gpt-5.6-sol`
- `gpt-5.6-terra`
- `gpt-5.6-luna`

Reasoning levels are OpenCode variants, not separate model IDs. Current
variants include `none`, `low`, `medium`, `high`, `xhigh`, `max`, and `fast`.

If an OpenCode build rejects a new model before plugin configuration is
applied, select a previously accepted model and explicitly enable latest-model
mapping:

```bash
export OPENCODE_MULTI_AUTH_PREFER_CODEX_LATEST=1
```

Disable runtime model injection only when intentionally required:

```bash
export OPENCODE_MULTI_AUTH_INJECT_MODELS=0
```

## Dashboard Security Boundary

- Binding is restricted to `127.0.0.1`, `::1`, or `localhost`.
- Host and browser Origin headers must match a loopback authority and dashboard
  port.
- The dashboard has no login screen or bearer-token authentication.
- Any local process that can reach the port may call its APIs.
- Do not expose it through a public bind, reverse proxy, or tunnel.
- `/api/state` removes OAuth access, refresh, and ID tokens before responding.

See `SECURITY.md` for the complete local threat model.

## Troubleshooting

### No available accounts

- Open `/codex` or the dashboard and inspect disabled/error accounts.
- Re-authenticate the affected alias.
- Refresh tokens and limits.
- Wait for known cooldown or quota reset windows.

### Dashboard asset is missing

Run a clean source build and confirm the package assets exist:

```bash
bun run build
ls dist/web-ui/dashboard.js dist/web-ui/dashboard.css
```

### Plugin does not load

```bash
opencode debug config --print-logs
```

Confirm the active plugin reference uses
`@nguyenthdat/opencode-multi-auth-codex` and restart OpenCode.
