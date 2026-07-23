# OpenCode and React Dashboard Live Testing

Use this checklist after backing up your live OpenCode, Codex, and plugin state.
Run destructive checks only with accounts you own and preferably in the sandbox
defined by `SANDBOX_QUICK_REF.md`.

## 1. Preflight

- [ ] Record package version, commit SHA, Bun version, OpenCode version, OS, and
  browser version.
- [ ] Back up current `~/.config/opencode`, `~/.config/opencode-multi-auth`, and
  `~/.codex` state.
- [ ] Build current backend and React assets before tests:

```bash
bun run lint
bun run build
bun test
uv run --with 'python-dotenv>=1.2.1,<2' python -m unittest auto-login/test_auto_login.py
bun audit
npm pack --dry-run
```

- [ ] Confirm the package manifest includes `dist/web-ui/dashboard.js` and
  `dist/web-ui/dashboard.css`.
- [ ] Treat `test:web:headless` as HTTP/asset smoke, not browser E2E.
- [ ] Treat `test:soak:48h` as the short soak scaffold, not a completed 48-hour
  run.

## 2. Start the Dashboard

```bash
bun dist/cli.js web --host 127.0.0.1 --port 3434
```

- [ ] Open `http://127.0.0.1:3434`.
- [ ] Confirm React replaces the loading state.
- [ ] Confirm the browser console has no runtime errors.
- [ ] Confirm network requests for `/dashboard.js`, `/dashboard.css`,
  `/api/state`, and `/api/logs` succeed.
- [ ] Confirm state and static assets from the shell:

```bash
curl -fsS http://127.0.0.1:3434/dashboard.js -o /dev/null
curl -fsS http://127.0.0.1:3434/dashboard.css -o /dev/null
curl -fsS http://127.0.0.1:3434/api/state
```

## 3. Network and Crash Safety

- [ ] Non-loopback bind fails with `LOCALHOST_ONLY`:

```bash
bun dist/cli.js web --host 0.0.0.0 --port 3434
```

- [ ] Hostile Host and Origin return `403 FORBIDDEN_ORIGIN`:

```bash
curl -i -H 'Host: attacker.example:3434' http://127.0.0.1:3434/
curl -i -H 'Origin: https://attacker.example' http://127.0.0.1:3434/api/state
```

- [ ] Malformed JSON returns `400 INVALID_JSON` and the server stays alive:

```bash
curl -i -X POST http://127.0.0.1:3434/api/switch \
  -H 'Content-Type: application/json' --data '{bad json'
curl -i -X POST http://127.0.0.1:3434/api/switch \
  -H 'Content-Type: application/json' --data '{}'
```

- [ ] HTML response CSP contains self-only script/connect/font rules and blocks
  framing.

## 4. React Dashboard Behavior

- [ ] Overview shows account count, active alias, recommendation, store status,
  sync state, and auto-login status.
- [ ] Search matches alias, email, tags, and notes.
- [ ] Tag filter and all sort modes update the visible account list.
- [ ] Empty store and no-filter-match messages are distinct.
- [ ] Quota cards show correct confidence, progress, reset/update time, and
  history sparkline state.
- [ ] Connection failure remains visible after an initially successful load and
  Retry recovers.
- [ ] Desktop and 390 px mobile layouts have no horizontal overflow.

## 5. Account Lifecycle

- [ ] Add at least two authorized test accounts.

```bash
bun dist/cli.js add test1
bun dist/cli.js add test2
bun dist/cli.js status
curl -fsS http://127.0.0.1:3434/api/accounts
```

- [ ] Disable and re-enable one account from the React switch.
- [ ] Last-enabled-account disable is blocked with `409 LAST_ACCOUNT`.
- [ ] Unknown alias returns `404 ACCOUNT_NOT_FOUND`.
- [ ] Metadata editor closes only after a successful save.
- [ ] Remove action requires confirmation.
- [ ] Targeted re-auth opens OAuth and only updates the selected alias.
- [ ] Disabled-account re-auth is blocked with `409 ACCOUNT_DISABLED`.

## 6. Add-Account Dialog

- [ ] Add account opens a native modal dialog.
- [ ] Initial focus lands on Login/email.
- [ ] Tab navigation stays within the open modal.
- [ ] Escape and Cancel close it and return focus to Add account.
- [ ] Submit remains disabled until email and password are present.
- [ ] Passwords are cleared from React state after successful submission.
- [ ] No password appears in logs, API state, screenshots, or console output.

## 7. Force Mode and Settings

- [ ] Turn Force Mode on and select an enabled alias.
- [ ] Confirm requests remain pinned while force is active.
- [ ] Clear force and confirm the strategy captured before force becomes active.
- [ ] Confirm the rotation strategy selector persists changes.
- [ ] Exercise full threshold, weight, and preset behavior through the API; the
  React dashboard currently exposes strategy selection, not the full settings
  editor.

```bash
curl -fsS http://127.0.0.1:3434/api/force
curl -fsS http://127.0.0.1:3434/api/settings
```

## 8. Limits and Optional Antigravity

- [ ] Refresh all limits and observe queue state transitions.
- [ ] Stop an active queue and confirm the UI updates.
- [ ] Fresh/stale/error/unknown states reflect authoritative data.
- [ ] Failed probes preserve prior quota values.
- [ ] With Antigravity disabled, refresh endpoints return
  `403 FEATURE_DISABLED`.
- [ ] Enable the feature only when intentionally testing those local files and
  provider requests.

## 9. Live OpenCode Flow

- [ ] Restart OpenCode with the current package reference.
- [ ] Open `/codex` and verify the same account state shown by the dashboard.
- [ ] Send representative requests and confirm rotation, disabled state, force,
  cooldown, and model selection behavior.
- [ ] Monitor redacted logs:

```bash
tail -f ~/.config/opencode-multi-auth/logs/codex-soft.log
```

## 10. Exit Criteria

- [ ] Automated build, tests, audit, and package checks pass.
- [ ] React manual checks are recorded separately from automation.
- [ ] No browser console errors, missing assets, or responsive overflow.
- [ ] Account, force, strategy, and limits behavior matches current contracts.
- [ ] No credentials or private account data appear in artifacts.
- [ ] Any skipped external-provider or long-soak check is explicitly recorded.

## Issue Log Template

```text
Issue ID:
When:
Version / commit:
Browser / OS:
Command / API / UI action:
Expected:
Actual:
HTTP/code:
Console/logs:
Reproduction:
Fix path/commit:
Retest:
```
