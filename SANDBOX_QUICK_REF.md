# Sandbox Quick Reference

Use this runbook to test the CLI and React dashboard without touching the live
OpenCode account store or Codex `auth.json`.

## 1. Prepare the Current Clone

Run from the repository you intend to test. No hardcoded user directory is
required.

```bash
git rev-parse --show-toplevel
bun install --frozen-lockfile
bun run lint
bun run build
```

`bun run build` is required after changes under either `src/` or `web-ui/`; it
regenerates the server output and `dist/web-ui` React assets.

## 2. Create an Isolated Environment

```bash
export OMA_SANDBOX_ROOT="${TMPDIR:-/tmp}/oma-sandbox"
export HOME="$OMA_SANDBOX_ROOT/home"
export OPENCODE_MULTI_AUTH_STORE_DIR="$OMA_SANDBOX_ROOT/store"
export OPENCODE_MULTI_AUTH_STORE_FILE="$OMA_SANDBOX_ROOT/store/accounts.json"
export OPENCODE_MULTI_AUTH_CODEX_AUTH_FILE="$OMA_SANDBOX_ROOT/home/.codex/auth.json"

mkdir -p "$HOME/.codex" "$OPENCODE_MULTI_AUTH_STORE_DIR"
printf '%s\n' '{"OPENAI_API_KEY":null,"tokens":{}}' > "$OPENCODE_MULTI_AUTH_CODEX_AUTH_FILE"
```

Never point these variables at the live `~/.config/opencode-multi-auth` or
`~/.codex` directories during destructive tests.

## 3. Confirm Sandbox Paths

```bash
bun dist/cli.js path
printf 'HOME=%s\nSTORE_DIR=%s\nSTORE_FILE=%s\nAUTH_FILE=%s\n' \
  "$HOME" \
  "$OPENCODE_MULTI_AUTH_STORE_DIR" \
  "$OPENCODE_MULTI_AUTH_STORE_FILE" \
  "$OPENCODE_MULTI_AUTH_CODEX_AUTH_FILE"
```

Expected paths are all below `$OMA_SANDBOX_ROOT`. The CLI `path` command
confirms the resolved store path; the remaining lines confirm the environment
passed to the process.

## 4. Start the React Dashboard

```bash
bun dist/cli.js web --host 127.0.0.1 --port 4343
```

Open `http://127.0.0.1:4343`.

In another shell with the same environment, verify the current generated
assets and state API:

```bash
curl -fsS http://127.0.0.1:4343/dashboard.js -o /dev/null
curl -fsS http://127.0.0.1:4343/dashboard.css -o /dev/null
curl -fsS http://127.0.0.1:4343/api/state
```

Browser checks:

- React mounts without a blank loading screen.
- Browser console contains no runtime errors.
- `/api/state` polling succeeds.
- Layout has no horizontal overflow at desktop and mobile widths.
- Add-account dialog opens, focuses the email field, closes with Escape, and
  does not expose credentials in logs.

## 5. Security Checks

Non-loopback binding must fail with `LOCALHOST_ONLY`:

```bash
bun dist/cli.js web --host 0.0.0.0 --port 4343
```

Host and browser Origin validation must reject hostile authorities:

```bash
curl -i -H 'Host: attacker.example:4343' http://127.0.0.1:4343/
curl -i -H 'Origin: https://attacker.example' http://127.0.0.1:4343/api/state
```

Expected: `403` with `FORBIDDEN_ORIGIN`.

## 6. Feature Checks

Limits confidence:

- Successful limits refresh reports `fresh` data.
- A failed probe reports `error` while preserving the prior authoritative
  quota values.
- An account without authoritative data displays `unknown`, not synthetic 0%.

Account lifecycle:

- The account `Enabled` switch is the only disable control.
- A disabled account is excluded from rotation.
- The last enabled account cannot be disabled.
- Targeted re-auth updates only the selected alias.

Force Mode:

- Turn Force Mode on, select an enabled alias, and verify requests stay pinned.
- Turn Force Mode off and verify the saved rotation strategy becomes active.
- Keep Force Mode visually and behaviorally separate from account availability.

React filters:

- Search by alias or email.
- Filter by comma-separated tags.
- Sort by recommendation, quota, expiry, refresh, and alias.

## 7. Reset Only the Sandbox

Stop the dashboard before deleting its files:

```bash
rm -rf "$OMA_SANDBOX_ROOT"
mkdir -p "$HOME/.codex" "$OPENCODE_MULTI_AUTH_STORE_DIR"
printf '%s\n' '{"OPENAI_API_KEY":null,"tokens":{}}' > "$OPENCODE_MULTI_AUTH_CODEX_AUTH_FILE"
```

## 8. Troubleshooting

`EADDRINUSE`:

```bash
bun dist/cli.js web --host 127.0.0.1 --port 4344
```

`spawn codex ENOENT` during limits refresh means the `codex` executable is not
on `PATH` in the sandbox shell. Fix `PATH` or skip live probe checks.

Use `TEST_EXECUTION_PLAN.md` for automated gates and `codextesting.md` for the
manual React/OpenCode validation flow.
