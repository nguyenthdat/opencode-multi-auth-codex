# Security Policy

## Supported Version

Security fixes are applied to the latest published release.

## Dashboard Boundary

The dashboard is a local control plane, not a remotely authenticated service.

- The server only binds to `127.0.0.1`, `::1`, or `localhost`.
- The HTTP Host authority must be loopback and use the configured dashboard
  port.
- A browser Origin header, when present, must be loopback HTTP on that port.
- Originless requests from local tools are accepted.
- The dashboard has no login, session cookie, or bearer-token authentication.
- Any local process able to connect to the port can invoke control APIs.
- Public binding, reverse-proxy exposure, and tunneling are unsupported.

Loopback checks reduce remote exposure but do not protect against malware or
other processes running under the same local user account.

## Browser Policy

The React dashboard is bundled and served locally. It does not fetch React or
fonts from a CDN. Responses set a content security policy that:

- permits scripts, connections, fonts, and normal assets from self
- blocks framing, objects, and base URL replacement
- permits inline styles because React uses style attributes for dynamic meters

The production package currently includes and serves `dashboard.js.map`. The
source map exposes open-source frontend source, but it must never contain
credentials, fixture secrets, or local account data.

## Credential and Data Handling

- `/api/state` strips OAuth access, refresh, and ID tokens before responding.
- Local aliases, emails, paths, errors, quota state, and selected logs remain
  visible to callers of the local dashboard API.
- The account store is written with mode `0600` and may be encrypted with
  `CODEX_SOFT_STORE_PASSPHRASE`.
- Auto-login credential files contain plaintext passwords and are separate from
  account-store encryption. Keep files at mode `0600` and parent directories at
  mode `0700`.
- Debug screenshots may contain account or provider information. They are
  excluded from Git but still require local cleanup and access control.
- Never commit `.env`, credentials files, OAuth tokens, cookies, SMS provider
  keys, or screenshots containing private data.

## Automation and TLS

Use browser automation only for accounts you own or are authorized to operate.
The standalone Python helper contains a certificate-verification compatibility
workaround for selected remote token/userinfo requests. Disabling certificate
verification weakens TLS authentication and must not be described as safe.
Prefer fixing the local CA trust chain and avoid the workaround where possible.

## Reporting a Vulnerability

Use GitHub private vulnerability reporting for this repository. Do not open a
public issue for vulnerabilities involving authentication data, tokens, local
account storage, auto-login credentials, or the dashboard.

Include:

- affected version and operating system
- reproduction steps or a proof of concept
- expected impact
- any suggested mitigation

Never include real access tokens, passwords, cookies, email inbox contents, SMS
provider keys, or other private credentials. Coordinated disclosure is
preferred.
