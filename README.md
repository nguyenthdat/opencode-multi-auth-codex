# OpenCode Multi Codex OAuth Manager

Open-source account routing and reliability tooling for OpenCode's Codex OAuth
integration. It provides local session controls, a localhost dashboard,
configurable routing, limit visibility, and failure recovery.

[![npm version](https://img.shields.io/npm/v/@nguyenthdat/opencode-multi-auth-codex)](https://www.npmjs.com/package/@nguyenthdat/opencode-multi-auth-codex)
[![license](https://img.shields.io/github/license/nguyenthdat/opencode-multi-auth-codex)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/nguyenthdat/opencode-multi-auth-codex)](https://github.com/nguyenthdat/opencode-multi-auth-codex/stargazers)

<img width="1440" alt="Codex account control React dashboard" src="https://raw.githubusercontent.com/nguyenthdat/opencode-multi-auth-codex/main/docs/images/react-dashboard.png" />

Screenshot data is illustrative and does not contain live credentials.

The localhost dashboard is built with React 19 and bundled into the package. It
does not load a frontend framework or fonts from a CDN at runtime.

## Documentation map

- `README.md` -> primary operator and developer documentation for current behavior.
- `SECURITY.md` -> current dashboard boundary and credential-handling rules.
- `OPENCODE_SETUP_1TO1.md` -> current OpenCode, TUI, CLI, and React-dashboard setup.
- `SANDBOX_QUICK_REF.md` -> isolated local test environment.
- `TEST_EXECUTION_PLAN.md` -> current automated/manual validation boundaries.
- `codextesting.md` -> live/manual testing runbook.
- `docs/README.md` -> full docs index with authoritative vs historical references.

## What this project does

- Rotates requests across multiple ChatGPT/Codex OAuth accounts.
- Keeps a local account store with migration, validation, and atomic writes.
- Provides OpenCode TUI controls and a responsive React dashboard to manage accounts and limits.
- Supports force mode (pin one alias), account enable/disable, and re-auth.
- Supports settings-driven rotation strategy (`round-robin`, `least-used`, `random`, `weighted-round-robin`).
- Probes limits safely and keeps authoritative data quality rules.
- Gates non-core Antigravity features behind a feature flag.

## Current implementation status

- Core account routing, lifecycle, force, settings, limits, TUI, and React-dashboard features are implemented.
- Validation scripts cover unit, integration, dashboard asset smoke, failure, stress, sandbox, and short soak scaffolding.
- Web hardening fixes are in place:
  - localhost-only bind enforcement
  - loopback Host and Origin validation
  - malformed JSON returns deterministic `400` without process crash
  - bundled React assets use a restrictive content security policy

## Behavior guarantees (latest)

- Rate-limit handling sleeps an alias until reset when reset timing is known (`Retry-After`, rate-limit window reset, or parsed provider reset text), instead of retrying that alias immediately.
- Force mode is strict: when enabled, requests stay pinned to the forced alias and do not silently fall back to other aliases.
- Rotation strategy control is shown next to Force Mode in the dashboard.
- Strategy changes from dashboard settings are applied to runtime selection logic (not just persisted state/UI display).
- Force Mode and strategy interaction is explicit:
  - while Force Mode is ON, normal strategy selection is paused
  - clearing Force Mode restores the strategy captured when it was enabled
- Dashboard controls include visible guidance for Force Mode and rotation strategy behavior.
- Account enable/disable toggle is authoritative for eligibility in rotation.

## Rotation strategy reference

- `round-robin` -> cycle through healthy enabled accounts in order.
- `least-used` -> prefer the healthy enabled account with the lowest usage count.
- `random` -> pick randomly from healthy enabled accounts.
- `weighted-round-robin` -> split traffic by configured account weights (example: `0.70/0.20/0.10` ≈ `70%/20%/10%`).
- Force Mode precedence -> when Force Mode is ON, strategy is paused; clearing force restores the pre-force strategy.

## Repository structure

- `src/` -> TypeScript source
- `web-ui/` -> React dashboard source and styles
- `dist/` -> generated backend and package output
- `dist/web-ui/` -> Bun-bundled React dashboard JS, CSS, and source map
- `tests/unit/` -> unit tests
- `tests/integration/` -> integration tests
- `tests/web-headless/` -> dashboard HTTP/asset smoke tests (not browser E2E)
- `tests/failure/` -> failure-injection tests
- `tests/stress/` -> stress/concurrency tests
- `tests/sandbox/` -> sandbox isolation tests
- `tests/soak/` -> soak scaffolding
- `docs/` -> QA and phase documentation (see `docs/README.md` for canonical/historical split)
- `IMPLEMENTATION_PLAN.md` -> historical phased plan with a current React addendum
- `TEST_EXECUTION_PLAN.md` -> required test order and gates
- `codextesting.md` -> live testing TODO for Codex CLI sessions
- `auto-login/` -> Python OAuth automation helpers for authorized accounts

## Requirements

- Bun 1.3+
- OpenCode CLI 1.18.4+
- ChatGPT/Codex OAuth accounts

## Install and use

### Plugin install (recommended)

Install both the OpenCode server and TUI targets from npm:

```bash
opencode plugin @nguyenthdat/opencode-multi-auth-codex@latest --global
```

Quit and restart OpenCode after installation. In the OpenCode TUI, run `/codex`
or open the command palette and select **Codex accounts** from the
**Suggested** section. The TUI supports:

- listing account status, plan, quota, and health
- adding an account through browser OAuth
- re-authenticating accounts and refreshing OAuth tokens
- checking one account or all accounts
- selecting the account stored in the device Codex `auth.json`
- enabling/disabling an account
- editing account tags and notes
- forcing one account for up to 24 hours or returning to rotation
- removing an account from the local store

If you prefer config-based installation, OpenCode also supports:

```json
{
  "plugin": ["@nguyenthdat/opencode-multi-auth-codex@latest"]
}
```

Package:
- npm: [@nguyenthdat/opencode-multi-auth-codex](https://www.npmjs.com/package/@nguyenthdat/opencode-multi-auth-codex)
- repo: [nguyenthdat/opencode-multi-auth-codex](https://github.com/nguyenthdat/opencode-multi-auth-codex)

### Install the CLI command

`opencode plugin ...` installs the plugin into OpenCode's package cache, but it
does not add the package binary to your shell `PATH`. Install the package globally
when you also want commands such as `opencode-multi-auth add personal`:

```bash
bun add --global @nguyenthdat/opencode-multi-auth-codex@latest
```

If Bun's global binary directory is not already on `PATH`:

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

Verify the command and add an account:

```bash
command -v opencode-multi-auth
opencode-multi-auth --help
opencode-multi-auth add personal
```

npm can be used instead of Bun:

```bash
npm install --global @nguyenthdat/opencode-multi-auth-codex@latest
opencode-multi-auth add personal
```

### GitHub source install (fallback)

Use this if you want the repo head instead of the latest npm release:

```bash
opencode plugin github:nguyenthdat/opencode-multi-auth-codex --global
```

```json
{
  "plugin": ["github:nguyenthdat/opencode-multi-auth-codex"]
}
```

OpenCode support:
- the plugin backfills `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`
- reasoning levels are OpenCode variants on each base model, not separate model IDs
- each GPT-5.6 family model exposes `none`, `low`, `medium`, `high`, `xhigh`, `max`, and `fast`
- `max` maps to OpenAI's strongest supported request effort, `xhigh`
- OpenCode builds that validate model IDs before plugin config is applied may still reject a direct GPT-5.6 family selection
- in that case, keep selecting a previous accepted model such as `openai/gpt-5.5` or `openai/gpt-5.4` and enable latest-model mapping:

```bash
export OPENCODE_MULTI_AUTH_PREFER_CODEX_LATEST=1
```

- `gpt-5.5` and `gpt-5.4` remain available and can be selected or used as rollback targets
- disable runtime model injection only if you explicitly want that behavior off:

```bash
export OPENCODE_MULTI_AUTH_INJECT_MODELS=0
```

Update existing installs:
- package install: rerun `opencode plugin @nguyenthdat/opencode-multi-auth-codex@latest --global`
- GitHub install: rerun `opencode plugin github:nguyenthdat/opencode-multi-auth-codex --global`
- restart OpenCode after updating the plugin
- if your install is pinned to a specific tag/commit, bump it explicitly before testing new models

### From source

```bash
git clone https://github.com/nguyenthdat/opencode-multi-auth-codex.git
cd opencode-multi-auth-codex
bun install --frozen-lockfile
bun run build
```

### Quick start

```bash
# Install the shell command if you have only run `opencode plugin` so far
bun add --global @nguyenthdat/opencode-multi-auth-codex@latest

# Add accounts
opencode-multi-auth add personal
opencode-multi-auth add work

# Check status
opencode-multi-auth status

# Start dashboard
opencode-multi-auth web --host 127.0.0.1 --port 3434
```

Open `http://127.0.0.1:3434`.

Alternatively, restart OpenCode and run `/codex` to manage and check accounts
without leaving the OpenCode TUI.

## Automated Bulk Login (CloakBrowser/Playwright)

The `auto-login/` directory contains a standalone Python script that **automates the OAuth login flow** for accounts you own. It prefers CloakBrowser when installed and falls back to regular Playwright:

- Opens OpenAI auth page
- Enters email/password and a TOTP authenticator code when requested
- Can still read an email one-time code from Outlook Web
- Uses SMSPool only when OpenAI presents a phone verification challenge
- Polls SMSPool's recommended `/request/active` endpoint and retries cancellation of an unused order on failure
- Deduplicates credential rows and stored accounts by normalized email
- Clicks through the consent page
- Completes a dashboard-owned OAuth callback or writes directly to the current TypeScript plugin store

### Prerequisites

- **Python 3.10+**
- An SMSPool API key is needed only if an account receives a phone challenge.

Install the Python dependencies from the bundled requirements file:

```bash
uv venv
uv pip install -r auto-login/requirements.txt
uv run python -m cloakbrowser install
```

The requirements include CloakBrowser, Playwright, and python-dotenv. To use
the regular Playwright fallback, also install its stock Chromium binary:

```bash
uv run playwright install chromium
```

### Setup

1. Create a private JSON credentials file:
   ```bash
   install -m 600 auto-login/credentials.example.json auto-login/credentials.json
   ```

2. Edit `auto-login/credentials.json` with your accounts:
   ```json
   {
     "defaults": {
       "chatgpt_password": "SharedPasswordIfAny",
       "smspool": {
         "country": 1,
         "service": 671,
         "pricing_option": 0,
         "max_price": "0.50",
          "timeout_seconds": 180,
          "max_orders": 3
       }
     },
     "accounts": [
       {
         "id": "acc-1",
         "email": "your-email@outlook.com",
         "outlook_password": "your-outlook-password",
         "chatgpt_password": "your-chatgpt-password",
         "totp_secret": "JBSWY3DPEHPK3PXP",
         "enabled": true
       }
     ]
   }
   ```

   - `defaults.chatgpt_password` is used when an account doesn't specify its own.
   - `outlook_password` is optional and only used to read login codes from Outlook inbox.
   - `totp_secret` is the Base32 authenticator secret, not the current six-digit code.
   - SMSPool service `671` is `OpenAI / ChatGPT` in the official SMSPool collection.
   - Set `enabled: false` to skip an account without removing it.

   The standalone helper reads this file by default. The React dashboard reads
   `~/.config/opencode-multi-auth/credentials.json` unless
   `OPENCODE_MULTI_AUTH_AUTO_LOGIN_CREDENTIALS_FILE` overrides it. To reuse the
   same source-checkout file when launching the dashboard:

   ```bash
   export OPENCODE_MULTI_AUTH_AUTO_LOGIN_CREDENTIALS_FILE="$PWD/auto-login/credentials.json"
   ```

3. Alternatively, create a private pipe-delimited account file:
   ```bash
   install -m 600 auto-login/accounts.example.txt auto-login/accounts.txt
   ```

   Its format is:
   ```text
   |email|password|2mfa secret key|
   |one@example.com|password-one|JBSWY3DPEHPK3PXP|
   |two@example.com|password-two|JBSWY3DPEHPK3PXP|
   ```

   Blank lines, comments beginning with `#`, and optional row numbers such as
   `1. |email|password|secret|` are accepted.

4. Create a private root `.env` file and set the SMSPool key:
   ```bash
   install -m 600 .env.example .env
   ```

   Set `SMSPOOL_API_KEY=...` in `.env`. The script loads only `SMSPOOL_*` keys
   from this file and does not override a value already exported in the shell.
   Optional environment overrides are `SMSPOOL_COUNTRY`, `SMSPOOL_SERVICE`,
   `SMSPOOL_POOL`, `SMSPOOL_MAX_PRICE`, `SMSPOOL_PRICING_OPTION`,
   `SMSPOOL_AREA_CODE`, `SMSPOOL_EXCLUDE`, `SMSPOOL_TIMEOUT`, and
   `SMSPOOL_MAX_ORDERS`. Each order is hard-capped at 180 seconds; the script
   confirms cancellation/refund before trying a different number.

### Usage

```bash
# Check a pipe-delimited account list
uv run python auto-login/auto_login.py \
  --credentials-file auto-login/accounts.txt --check

# Login enabled accounts not already present in accounts.json
uv run python auto-login/auto_login.py \
  --credentials-file auto-login/accounts.txt --browser cloak

# Explicitly refresh accounts whose normalized email already exists
uv run python auto-login/auto_login.py \
  --credentials-file auto-login/accounts.txt --browser cloak --force

# Login a specific account by index
uv run python auto-login/auto_login.py \
  --credentials-file auto-login/accounts.txt --account 0

# Login a specific account by email
uv run python auto-login/auto_login.py \
  --credentials-file auto-login/accounts.txt --email user@example.com

# Run with visible browser (for debugging)
uv run python auto-login/auto_login.py \
  --credentials-file auto-login/accounts.txt --browser cloak --visible

# Force the original Playwright path
uv run python auto-login/auto_login.py \
  --credentials-file auto-login/accounts.txt --browser playwright

# Run the standalone helper unit tests
uv run --with 'python-dotenv>=1.2.1,<2' \
  python -m unittest auto-login/test_auto_login.py
```

Standalone direct-store mode writes the current v2 store at
`~/.config/opencode-multi-auth/accounts.json` and honors
`OPENCODE_MULTI_AUTH_STORE_DIR` / `OPENCODE_MULTI_AUTH_STORE_FILE`. Existing
accounts from the former
`~/.config/opencode/opencode-multi-auth-codex-accounts.json` array store are
merged by normalized email. For an encrypted store, use `/codex`, the plugin
CLI, or dashboard-assisted auto-login instead of direct Python writes.
Before opening OAuth, auto-login compares normalized emails against the current
store and skips matches. Use `--force` only when an existing account's tokens
must be refreshed. Dashboard-assisted callbacks also require the authenticated
identity to match the selected credential email before any store write.

### How it works

```
OpenAI Auth                    Outlook Web                  Local Server
    |                              |                            |
    |  1. Enter email              |                            |
    |  2. Click "one-time code"    |                            |
    |  ----sends OTP email-------> |                            |
    |                              |  3. Login to Outlook       |
    |                              |  4. Read OTP from inbox    |
    |  5. Enter OTP code           |                            |
    |  6. Click Continue (consent) |                            |
    |  ----redirect callback-----> | ----code via HTTP GET----> |
    |                              |                            |  7. Capture code
    |                              |                            |  8. Exchange for tokens
    |                              |                            |  9. Complete dashboard callback or current-store write
```

The script generates a PKCE challenge compatible with the OAuth flow. In
dashboard-assisted mode, TypeScript owns the callback and updates the current
plugin store. In standalone mode, Python starts a local server on port `1455`
and writes the same v2 account-map schema used by the TypeScript plugin. Legacy
array-store accounts are imported idempotently without replacing an existing
email entry. A standalone account without an explicit alias receives the next
available `codex-NN` name.

### Microsoft interstitials

Outlook login often shows interstitial pages after password entry:

| Page | Handled by |
|------|-----------|
| "Stay signed in?" | Auto-clicks "Yes" |
| "Let's protect your account" | Auto-clicks "Skip for now" |
| FIDO/Passkey creation (`/fido/create`) | Auto-clicks "Not now" / "Cancel" |
| Any other blocker | Force-navigates to inbox |

### Troubleshooting

- **`--visible` mode** shows the browser so you can see exactly where the flow gets stuck.
- **Debug screenshots** are saved as `auto-login/debug_<user>_<step>.png` on failure.
- **SMSPool order errors** include the API's HTTP status and message but never print the API key.
- **No phone challenge** means no SMSPool order is purchased.
- **Phone challenge without `SMSPOOL_API_KEY`** stops with an actionable error instead of buying a number implicitly.
- **`--auth-url` phone retry** requires restarting login from the dashboard because a rejected/expired phone order needs a fresh OAuth URL.
- **SSL errors on macOS**: the script currently uses `ssl._create_unverified_context()` for selected remote token/userinfo requests. This compatibility workaround weakens TLS authentication; fixing the local CA trust chain is preferred.
- **Port 1455 in use**: kill any process using that port, or change `REDIRECT_PORT` in the script.
- **Stale OTP codes**: if the inbox has old verification emails, the script may pick up an expired code. Clear the inbox or wait for a fresh email.

## CLI commands

Install the binary first with
`bun add --global @nguyenthdat/opencode-multi-auth-codex@latest` (or the npm
equivalent above). Installing only through `opencode plugin` does not expose the
CLI binary on your shell `PATH`.

- `opencode-multi-auth add <alias>` -> add account via OAuth
- `opencode-multi-auth remove <alias>` -> remove account
- `opencode-multi-auth list` -> list configured accounts
- `opencode-multi-auth status` -> basic account/token status
- `opencode-multi-auth path` -> print store path
- `opencode-multi-auth web --host 127.0.0.1 --port 3434` -> run dashboard
- `opencode-multi-auth service install|disable|status` -> systemd user service helpers

## Dashboard/API endpoints

- `GET /api/state`
- `GET /api/logs`
- `POST /api/sync`
- `POST /api/auth/start`
- `POST /api/auto-login/start`
- `POST /api/auto-login/add`
- `POST /api/switch`
- `POST /api/remove`
- `POST /api/account/meta`
- `POST /api/token/refresh`
- `POST /api/limits/refresh`
- `POST /api/limits/stop`
- `GET /api/accounts`
- `PUT /api/accounts/:alias/enabled`
- `POST /api/accounts/:alias/reauth`
- `GET /api/force`
- `POST /api/force`
- `POST /api/force/clear`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/settings/feature-flags`
- `PUT /api/settings/feature-flags`
- `POST /api/settings/reset`
- `POST /api/settings/preset`
- `POST /api/antigravity/refresh` (feature-flag gated)
- `POST /api/antigravity/refresh-all` (feature-flag gated)

Dashboard auto-login endpoints also skip an email already present in the store
and return `409 AUTO_LOGIN_ACCOUNT_EXISTS`. Send `force: true`, or use the
dashboard's **Force update** button, to refresh that account explicitly.

## Environment variables

### Storage and auth

- `OPENCODE_MULTI_AUTH_STORE_DIR` -> override store directory
- `OPENCODE_MULTI_AUTH_STORE_FILE` -> override store file path
- `OPENCODE_MULTI_AUTH_CODEX_AUTH_FILE` -> override Codex `auth.json`
- `CODEX_SOFT_STORE_PASSPHRASE` -> encrypt account store at rest
- `CODEX_SOFT_LOG_PATH` -> override dashboard log path
- `OPENCODE_MULTI_AUTH_AUTO_LOGIN_SCRIPT` -> override dashboard automation script
- `OPENCODE_MULTI_AUTH_AUTO_LOGIN_CREDENTIALS_FILE` -> override dashboard saved-credential file
- `OPENCODE_MULTI_AUTH_AUTO_LOGIN_PYTHON` -> override Python executable used by the dashboard

### Rotation and limits

- `OPENCODE_MULTI_AUTH_ROTATION_STRATEGY` (settings source override; runtime rotation follows persisted dashboard settings)
- `OPENCODE_MULTI_AUTH_CRITICAL_THRESHOLD`
- `OPENCODE_MULTI_AUTH_LOW_THRESHOLD`
- `OPENCODE_MULTI_AUTH_TOKEN_FAILURE_COOLDOWN_MS`
- `OPENCODE_MULTI_AUTH_PROBE_EFFORT`
- `OPENCODE_MULTI_AUTH_LIMITS_PROBE_MODELS`
- `OPENCODE_MULTI_AUTH_REFRESH_QUEUE_CONCURRENCY`
- `OPENCODE_MULTI_AUTH_USAGE_BASE_URL`
- `CODEX_CLI_BIN`

### Standalone auto-login

- `OPENCODE_MULTI_AUTH_BROWSER` -> choose `auto`, `cloak`, or `playwright`
- `OPENCODE_MULTI_AUTH_NO_SANDBOX=1` -> disable the browser no-sandbox flag where supported
- `SMSPOOL_CARRIER` -> optional SMSPool carrier filter

### Model mapping and runtime behavior

- `OPENCODE_MULTI_AUTH_PREFER_CODEX_LATEST`
- `OPENCODE_MULTI_AUTH_CODEX_LATEST_MODEL`
- `OPENCODE_MULTI_AUTH_INJECT_MODELS`
- `OPENCODE_MULTI_AUTH_TRUNCATION`
- `OPENCODE_MULTI_AUTH_DEBUG`

## Latest Codex Mapping

The plugin can route older Codex selections to the latest Codex backend model when you explicitly opt in.

Default behavior:
- exact model selection is preserved

Environment variables:
- `OPENCODE_MULTI_AUTH_PREFER_CODEX_LATEST=1` enables mapping to the latest backend model
- `OPENCODE_MULTI_AUTH_CODEX_LATEST_MODEL=gpt-5.5` overrides the mapping target, for example to roll back from the default `gpt-5.6-sol`
- `OPENCODE_MULTI_AUTH_DEBUG=1` prints model mapping debug logs
- `OPENCODE_MULTI_AUTH_INJECT_MODELS=0` disables automatic runtime model backfill

## Fast Mode

For OpenCode builds that accept GPT-5.6 family IDs, select a base model such as `openai/gpt-5.6-sol`, then choose its `fast` variant.

- the backend model stays `gpt-5.6-sol`
- the injected `fast` variant sets `serviceTier=priority`
- reasoning variants stay under the same base model

Equivalent OpenCode model configuration:

```json
{
  "provider": {
    "openai": {
      "models": {
        "gpt-5.6-sol": {
          "variants": {
            "max": {
              "reasoningEffort": "xhigh"
            },
            "fast": {
              "reasoningEffort": "medium",
              "serviceTier": "priority"
            }
          }
        }
      }
    }
  }
}
```

For OpenCode builds that still reject GPT-5.6 family IDs, keep selecting `openai/gpt-5.5` or `openai/gpt-5.4` and set `OPENCODE_MULTI_AUTH_PREFER_CODEX_LATEST=1`. The plugin will send `gpt-5.6-sol` to the Codex backend.

See [docs/gpt-5.4-fast-benchmark.md](./docs/gpt-5.4-fast-benchmark.md) for a continued-session benchmark summary.

### Feature flags

- `OPENCODE_MULTI_AUTH_ANTIGRAVITY_ENABLED`

### Notifications

- `OPENCODE_MULTI_AUTH_NOTIFY=1` enables optional completion/retry/error notifications. Notifications are off by default so they cannot delay normal `opencode run` lifecycle.
- `OPENCODE_MULTI_AUTH_NOTIFY_SOUND`
- `OPENCODE_MULTI_AUTH_NOTIFY_MAC_OPEN`
- `OPENCODE_MULTI_AUTH_NOTIFY_NTFY_URL`
- `OPENCODE_MULTI_AUTH_NOTIFY_NTFY_TOKEN`
- `OPENCODE_MULTI_AUTH_NOTIFY_UI_BASE_URL`

## Security rules

- Dashboard host is loopback-only (`127.0.0.1`, `::1`, `localhost`).
- Non-loopback host bind is rejected.
- Host and browser Origin authorities must match loopback and the dashboard port.
- The dashboard has no authentication; any local process able to reach the port can call its APIs.
- Sensitive token patterns are redacted in logs.
- Store file permissions are restricted (`0o600`).
- Antigravity APIs are blocked when feature flag is off.
- See `SECURITY.md` for credential-file, source-map, and local threat-model details.

## Build and test

```bash
bun install --frozen-lockfile
bun run lint
bun run build

bun run test:unit
bun run test:integration
bun run test:web:headless
bun run test:failure
bun run test:stress
bun run test:sandbox
bun run test:soak:48h
uv run --with 'python-dotenv>=1.2.1,<2' python -m unittest auto-login/test_auto_login.py
```

`test:web:headless` is an HTTP/asset smoke test; it does not execute React in a
browser. `test:soak:48h` currently runs a short scaffold with a 120-second test
timeout and is not evidence of a true 48-hour soak. See
`TEST_EXECUTION_PLAN.md` for browser and long-duration gates.

## Live validation runbook

Use `codextesting.md` for the Codex CLI live-testing checklist and copy-paste command flow.

## Troubleshooting

- If dashboard start fails with localhost error, check `--host` and use loopback only.
- If a request returns `INVALID_JSON`, verify payload body is valid JSON.
- If an alias action returns `ACCOUNT_NOT_FOUND`, refresh account list first.
- If re-auth is blocked with `ACCOUNT_DISABLED`, enable the account before re-auth.
- If encrypted store appears locked, export `CODEX_SOFT_STORE_PASSPHRASE` before launching.

## Development notes

- Edit backend/plugin code under `src/*` and React dashboard code under `web-ui/*`.
- Never hand-edit `dist/*`; run `bun run build` after either source tree changes.
- Build before dashboard smoke tests so they inspect the current generated bundle.
- Keep manual/live tests sandboxed (temp HOME/store/auth paths).

## Release flow

- Every shipped update must use a new `package.json` version. Reusing a version leaves users on cached npm installs.
- Prepare and validate the release on `main`:

```bash
bun pm pkg set version=X.Y.Z
bun install --lockfile-only
bun run lint
bun run build
bun test
bun audit
git diff --exit-code -- dist
npm pack --dry-run
```

- Commit and push the version/build changes, then create the matching tag:

```bash
git add package.json bun.lock dist
git commit -m "chore: release vX.Y.Z"
git push origin main
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

The `Release` workflow validates the tag, runs CI and audit checks, packs the npm artifact,
publishes through npm Trusted Publishing with provenance, and creates the GitHub Release
with the package tarball and SHA-256 checksum. Re-run an existing tag with:

```bash
gh workflow run publish-npm.yml -f tag=vX.Y.Z
```

- Users who want a pinned build can install a specific npm version:

```json
{
  "plugin": ["npm:@nguyenthdat/opencode-multi-auth-codex@1.5.1"]
}
```

- Users tracking `latest` should rerun the install command and restart OpenCode after a new package lands.

## License

MIT
