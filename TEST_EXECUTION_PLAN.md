# Test Execution Plan

This runbook describes current automated coverage and the additional manual
validation required for the React dashboard and live OAuth behavior.

## 1. Goals

- Validate rotation, store safety, limits handling, force rules, and account
  lifecycle behavior.
- Build and test the same React assets that are shipped in `dist/web-ui`.
- Keep automated asset smoke coverage distinct from real browser interaction.
- Avoid claiming long-duration reliability from short scaffolding tests.

## 2. Current Test Surfaces

- `Unit`: rotation, store, settings, force mode, limits, models, and TUI logic.
- `Integration`: HTTP/API hardening and server lifecycle behavior.
- `Dashboard asset smoke`: HTML shell, CSP, compiled JS/CSS delivery, and bundle
  marker checks. This suite does not execute React in a browser.
- `Failure injection`: selected malformed payload, missing path, and server
  failure behavior.
- `Stress`: bounded concurrent store mutation checks.
- `Sandbox`: environment and path isolation.
- `Soak scaffold`: a short update loop that defaults to two seconds.
- `Manual browser`: React mounting, interactions, accessibility, and responsive
  layout.
- `Live OAuth/OpenCode`: external provider login, token refresh, and request
  routing with authorized accounts.

## 3. Commands

```bash
bun run lint
bun run build
bun run test:unit
bun run test:integration
bun run test:web:headless
bun run test:failure
bun run test:stress
bun run test:sandbox
bun run test:soak:48h
bun run test:auto-login
bun audit
npm pack --dry-run
```

Despite its compatibility name, `test:soak:48h` currently runs the short soak
scaffold in `tests/soak/soak-scaffold.test.ts`. It is not evidence of a 48-hour
run. The test itself has a 120-second timeout.

## 4. Required Order

1. Install with `bun install --frozen-lockfile` or `bun ci`.
2. Run backend and frontend typechecks with `bun run lint`.
3. Run `bun run build` so `dist/` and `dist/web-ui/` match current source.
4. Run unit and integration tests.
5. Run the dashboard asset smoke against the freshly generated bundle.
6. Run failure, stress, sandbox, and short soak suites.
7. Run `bun run test:auto-login` when Python automation files change.
8. Run `bun audit`.
9. Run `npm pack --dry-run` and confirm dashboard JS/CSS are included.
10. Review generated `dist/` changes; never hand-edit them.
11. Complete manual browser and optional live-provider validation.

Restart at step 2 after changes to `src/`, `web-ui/`, build configuration, or
shared API contracts.

## 5. Current Automated Coverage

### Account lifecycle and rotation

- Unit tests cover rotation strategy behavior and disabled-account eligibility.
- TUI tests cover blocking disablement of the last enabled account.
- Failure tests cover unknown-alias enable/disable and disabled-account re-auth.
- Store tests cover persisted account metadata and state updates.

### Force and rotation

- Force unit tests cover activation, clear, expiry, TTL reuse, and restoration of
  the pre-force strategy.
- Rotation/settings tests cover strategy validation and runtime selection.

### Limits integrity

- Limits tests cover parsing, confidence calculation, queue behavior, usage API
  handling, and probe helper behavior.
- Model and rate-limit tests cover reset/cooldown selection behavior.

### Store safety

- Store tests cover normal load/save/update behavior and selected recovery paths.
- Stress tests assert parseable output after bounded concurrent mutation.
- Sandbox tests assert that configured store/auth paths remain isolated.

### Dashboard HTTP boundary

- Non-loopback bind attempts are rejected.
- Hostile Host and Origin headers are rejected.
- Invalid JSON returns deterministic errors without crashing the server.
- `/`, `/dashboard.js`, and `/dashboard.css` are served with expected content.
- The HTML response includes the restrictive dashboard CSP.
- The generated bundle contains the current React dashboard markers.

### Auto-login helpers

- `bun run test:auto-login` runs the Python `unittest` suite for credential
  parsing, environment loading, TOTP, SMS polling, cancellation/refund, and
  retry behavior.

### Known automated gaps

The following contracts are implemented but do not yet have direct complete
automation and must remain in manual or follow-up coverage:

- encoded/malformed alias path handling across all account routes
- unknown-alias re-auth
- routed-request proof that Force Mode never falls back
- failed/incomplete probe preservation of an existing authoritative snapshot
- full malformed-store and v1-to-v2 migration matrix
- browser-executed React interactions and accessibility

## 6. Manual React Browser Gates

The repository does not currently contain a browser-executed React E2E suite.
Validate these separately and record the browser/version used:

- React mounts and `/api/state` polling succeeds without console errors.
- Account search, tag filtering, sorting, and empty states behave correctly.
- Enabled switch rolls back after an API failure and blocks repeat mutation.
- Metadata editor closes only after a successful save.
- Re-auth status, OAuth fallback link, and timeout state are understandable.
- Force Mode arming, activation, clear, and strategy selection work.
- Add-account dialog traps focus, focuses email, closes with Escape, and returns
  focus to the launcher.
- Connection failure remains visible after an initially successful load.
- Desktop and 390 px mobile layouts have no horizontal overflow.
- Reduced-motion preference removes nonessential transitions.

Until these are automated, do not describe `test:web:headless` as browser E2E.

## 7. Package Gate

`npm pack --dry-run` must list at least:

```text
dist/web-ui/dashboard.js
dist/web-ui/dashboard.css
dist/web.js
dist/cli.js
```

The npm package ships generated `dist/` output, not `web-ui/` source. Source and
GitHub installs therefore require committed generated assets to remain current.

## 8. Long-Duration Reliability

A true 48-hour soak requires an external runner without the Bun test's
120-second timeout. Record:

- start/end timestamps and commit SHA
- Bun, OpenCode, Codex CLI, OS, and hardware versions
- request count, success rate, and latency summary
- force and rotation lifecycle events
- store integrity checks and retained logs

Do not infer a 48-hour pass by only setting `OPENCODE_MULTI_AUTH_SOAK_MS` on the
current scaffold.

## 9. Evidence

For release validation, create a dated record instead of rewriting historical
phase reports. Include:

- package version and commit
- exact commands and exit status
- automated test counts
- browser/manual checks separated from automated checks
- package manifest confirmation
- known omissions or deferred live-provider checks

`docs/PHASE_H_VALIDATION.md` is a historical pre-React report and is not current
evidence for `web-ui/` or `dist/web-ui/`.
