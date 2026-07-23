#!/usr/bin/env python3
"""
Auto-login for opencode-multi-auth-codex plugin.
Automates ChatGPT OAuth via Playwright, including email verification via Outlook Web.

Usage:
    python3 auto_login.py                 # Login all enabled accounts
    python3 auto_login.py --account 0     # Login specific account by index
    python3 auto_login.py --email user@x  # Login specific account by email
    python3 auto_login.py --check         # Check which accounts need login
    python3 auto_login.py --visible       # Run browser in visible mode
    python3 auto_login.py --credentials-file accounts.txt --browser cloak
    python3 auto_login.py --email user@x --auth-url <url>  # Browser-only login for dashboard
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import ssl
import struct
import sys
import time
import threading
import urllib.parse
import urllib.request
from contextlib import contextmanager
from urllib.error import HTTPError, URLError
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone
from pathlib import Path

from dotenv import dotenv_values  # type: ignore[import-not-found]

# ── Constants (matching opencode-multi-auth-codex plugin exactly) ───────────
OPENAI_ISSUER = "https://auth.openai.com"
AUTHORIZE_URL = f"{OPENAI_ISSUER}/oauth/authorize"
TOKEN_URL = f"{OPENAI_ISSUER}/oauth/token"
CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
SCOPES = ["openid", "profile", "email", "offline_access"]
REDIRECT_PORT = 1455

SMSPOOL_API_BASE = "https://api.smspool.net"
SMSPOOL_DEFAULT_COUNTRY = 1
SMSPOOL_OPENAI_SERVICE = 671
SMSPOOL_DEFAULT_TIMEOUT = 60
SMSPOOL_POLL_INTERVAL = 5
SMSPOOL_DEFAULT_MAX_ORDERS = 3

# Store paths (matching the plugin)
STORE_DIR = Path.home() / ".config" / "opencode"
STORE_FILE = STORE_DIR / "opencode-multi-auth-codex-accounts.json"

# Credentials file
SCRIPT_DIR = Path(__file__).resolve().parent
CREDENTIALS_FILE = SCRIPT_DIR / "credentials.json"
ENV_FILE = SCRIPT_DIR.parent / ".env"


def load_environment(env_file=ENV_FILE):
    env_file = Path(env_file)
    if not env_file.exists():
        return False
    if os.name != "nt" and env_file.stat().st_mode & 0o077:
        print(
            f"[WARNING] Environment file is readable by other users: {env_file}. "
            f"Run: chmod 600 {env_file}"
        )
    loaded = False
    for name, value in dotenv_values(env_file).items():
        if name.startswith("SMSPOOL_") and value is not None:
            os.environ.setdefault(name, value)
            loaded = True
    return loaded


load_environment()

# Timing
BETWEEN_ACCOUNTS_DELAY = 5  # seconds between accounts


def find_system_browser():
    override = os.environ.get("OPENCODE_MULTI_AUTH_BROWSER")
    if override and Path(override).is_file():
        return override
    for candidate in (
        "google-chrome-stable",
        "google-chrome",
        "chrome",
        "microsoft-edge-stable",
        "microsoft-edge",
        "msedge",
    ):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    return None


def find_playwright_chromium():
    cache_dir = Path.home() / ".cache" / "ms-playwright"
    patterns = [
        "chromium-*/chrome-linux64/chrome",
        "chromium-*/chrome-linux/chrome",
    ]
    candidates = []
    for pattern in patterns:
        candidates.extend(cache_dir.glob(pattern))
    existing = [path for path in candidates if path.is_file()]
    if not existing:
        return None
    return str(sorted(existing)[-1])


def find_browser_executable():
    return find_system_browser() or find_playwright_chromium()


def has_graphical_session():
    return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))


@contextmanager
def launch_automation_browser(headless=True, browser_engine="auto"):
    if browser_engine not in {"auto", "cloak", "playwright"}:
        raise ValueError(f"Unsupported browser engine: {browser_engine}")

    browser = None
    browser_args = ["--disable-dev-shm-usage"]
    if os.environ.get("OPENCODE_MULTI_AUTH_NO_SANDBOX") == "1":
        browser_args.append("--no-sandbox")
    if browser_engine in {"auto", "cloak"}:
        try:
            from cloakbrowser import launch as launch_cloakbrowser  # type: ignore[import-not-found]
        except ModuleNotFoundError:
            if browser_engine == "cloak":
                raise RuntimeError(
                    "CloakBrowser is not installed. Run `uv pip install -r "
                    "auto-login/requirements.txt` "
                    "or select `--browser playwright`."
                )
        else:
            print("  [0/5] Launching CloakBrowser with the Playwright API...")
            browser = launch_cloakbrowser(
                headless=headless,
                humanize=True,
                human_preset="careful",
                locale="en-US",
                args=browser_args,
            )
            try:
                yield browser, "cloak"
            finally:
                if browser:
                    try:
                        browser.close()
                    except Exception:
                        pass
            return

    from playwright.sync_api import sync_playwright  # type: ignore[import-not-found]

    with sync_playwright() as playwright:
        chromium_path = find_browser_executable()
        browser_name = (
            Path(chromium_path).name if chromium_path else "playwright-chromium"
        )
        effective_headless = headless
        if headless and chromium_path and has_graphical_session():
            lowered_name = browser_name.lower()
            if "chrome" in lowered_name or "edge" in lowered_name:
                effective_headless = False
                print(
                    "  [0/5] Launching headed browser because OpenAI auth blocks headless sessions."
                )
        browser = playwright.chromium.launch(
            headless=effective_headless,
            executable_path=chromium_path,
            args=["--disable-blink-features=AutomationControlled", *browser_args],
        )
        try:
            yield browser, "playwright"
        finally:
            if browser:
                try:
                    browser.close()
                except Exception:
                    pass


# ── PKCE (RFC 7636) ────────────────────────────────────────────────────────
def generate_pkce():
    raw = secrets.token_bytes(32)
    code_verifier = base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return code_verifier, code_challenge


def generate_state():
    return (
        base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode("ascii")
    )


def build_auth_url(code_challenge, state, redirect_uri):
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "audience": "https://api.openai.com/v1",
        "id_token_add_organizations": "true",
        "codex_cli_simplified_flow": "true",
        "state": state,
        "originator": "codex_cli_rs",
    }
    return f"{AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"


# ── JWT helpers ─────────────────────────────────────────────────────────────
def decode_jwt_payload(token):
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload = parts[1].replace("-", "+").replace("_", "/")
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += "=" * padding
        return json.loads(base64.b64decode(payload).decode("utf-8"))
    except Exception:
        return None


def get_email_from_claims(claims):
    if not claims:
        return None
    if isinstance(claims.get("email"), str):
        return claims["email"]
    profile = claims.get("https://api.openai.com/profile")
    if profile and isinstance(profile.get("email"), str):
        return profile["email"]
    return None


def normalize_email(email):
    return email.strip().casefold() if isinstance(email, str) else ""


def get_account_id_from_claims(claims):
    if not claims:
        return None
    auth = claims.get("https://api.openai.com/auth")
    return auth.get("chatgpt_account_id") if auth else None


def get_expiry_from_claims(claims):
    if not claims:
        return None
    exp = claims.get("exp")
    return int(exp * 1000) if isinstance(exp, (int, float)) else None


# ── Token exchange ──────────────────────────────────────────────────────────
def exchange_code_for_tokens(code, redirect_uri, code_verifier):
    data = urllib.parse.urlencode(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": CLIENT_ID,
            "code_verifier": code_verifier,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(
        req, timeout=30, context=ssl._create_unverified_context()
    ) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_userinfo_email(access_token):
    try:
        req = urllib.request.Request(
            f"{OPENAI_ISSUER}/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        with urllib.request.urlopen(
            req, timeout=10, context=ssl._create_unverified_context()
        ) as resp:
            return json.loads(resp.read().decode("utf-8")).get("email")
    except Exception:
        return None


# ── Account store (v2 format compatible with plugin) ───────────────────────
def load_store():
    if not STORE_FILE.exists():
        return {
            "version": 2,
            "accounts": [],
            "activeIndex": -1,
            "rotationIndex": 0,
            "lastRotation": int(time.time() * 1000),
        }
    with open(STORE_FILE, "r") as f:
        return json.load(f)


def save_store(store):
    STORE_DIR.mkdir(parents=True, exist_ok=True)
    if STORE_FILE.exists():
        shutil.copy2(STORE_FILE, STORE_FILE.with_suffix(".json.bak"))
    tmp = STORE_FILE.with_suffix(f".tmp-{os.getpid()}-{int(time.time() * 1000)}")
    with open(tmp, "w") as f:
        json.dump(store, f, indent=2)
    tmp.rename(STORE_FILE)
    os.chmod(STORE_FILE, 0o600)


def add_account_to_store(tokens):
    now = int(time.time() * 1000)
    access_claims = decode_jwt_payload(tokens["access_token"])
    id_claims = (
        decode_jwt_payload(tokens["id_token"]) if tokens.get("id_token") else None
    )

    expires_at = (
        get_expiry_from_claims(access_claims)
        or get_expiry_from_claims(id_claims)
        or now + tokens.get("expires_in", 3600) * 1000
    )
    email = (
        get_email_from_claims(id_claims)
        or get_email_from_claims(access_claims)
        or fetch_userinfo_email(tokens["access_token"])
    )
    account_id = get_account_id_from_claims(id_claims) or get_account_id_from_claims(
        access_claims
    )

    new_account = {
        "accessToken": tokens["access_token"],
        "refreshToken": tokens["refresh_token"],
        "idToken": tokens.get("id_token"),
        "accountId": account_id,
        "expiresAt": expires_at,
        "email": email,
        "lastRefresh": datetime.now(timezone.utc).isoformat(),
        "lastSeenAt": now,
        "addedAt": now,
        "source": "opencode",
        "authInvalid": False,
        "usageCount": 0,
        "enabled": True,
    }

    store = load_store()
    email_key = normalize_email(email)
    if email_key:
        for i, acc in enumerate(store["accounts"]):
            if normalize_email(acc.get("email")) == email_key:
                store["accounts"][i] = {
                    **acc,
                    **new_account,
                    "usageCount": acc.get("usageCount", 0),
                    "addedAt": acc.get("addedAt", now),
                    "rateLimitHistory": acc.get("rateLimitHistory", []),
                }
                save_store(store)
                return email, i, False

    store["accounts"].append(new_account)
    idx = len(store["accounts"]) - 1
    if store["activeIndex"] < 0:
        store["activeIndex"] = idx
    save_store(store)
    return email, idx, True


# ── Credentials ─────────────────────────────────────────────────────────────
def parse_pipe_credentials(raw):
    accounts = []
    for line_number, raw_line in enumerate(raw.splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        line = re.sub(r"^\d+\s*[.)]\s*", "", line)
        if line.startswith("|"):
            line = line[1:]
        if line.endswith("|"):
            line = line[:-1]

        fields = [field.strip() for field in line.split("|")]
        if len(fields) == 4 and fields[0].isdigit():
            fields = fields[1:]
        if [field.lower() for field in fields] == [
            "email",
            "password",
            "2mfa secret key",
        ]:
            continue
        if len(fields) != 3:
            raise ValueError(
                f"Invalid credentials at line {line_number}; expected "
                "|email|password|2mfa secret key|"
            )

        email, password, totp_secret = fields
        if not email or not password:
            raise ValueError(
                f"Invalid credentials at line {line_number}; email and password are required"
            )
        accounts.append(
            {
                "id": f"account-{len(accounts) + 1}",
                "email": email,
                "chatgpt_password": password,
                "totp_secret": totp_secret,
                "enabled": True,
            }
        )

    return accounts


def deduplicate_accounts(accounts):
    unique = []
    seen = set()
    for account in accounts:
        email_key = normalize_email(account.get("email"))
        if email_key and email_key in seen:
            print(
                f"[WARNING] Skipping duplicate credentials for {account.get('email')}"
            )
            continue
        if email_key:
            seen.add(email_key)
        unique.append(account)
    return unique


def load_credentials(credentials_path=None):
    path = Path(credentials_path).expanduser() if credentials_path else CREDENTIALS_FILE
    if not path.exists():
        print(f"[ERROR] Credentials file not found: {path}")
        sys.exit(1)
    if os.name != "nt" and path.stat().st_mode & 0o077:
        print(
            f"[WARNING] Credentials file is readable by other users: {path}. "
            f"Run: chmod 600 {path}"
        )
    raw = path.read_text(encoding="utf-8-sig")
    if path.suffix.lower() == ".json" or raw.lstrip().startswith(("{", "[")):
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return {"defaults": {}, "accounts": parsed}
        return parsed
    return {"defaults": {}, "accounts": parse_pipe_credentials(raw)}


def generate_totp(secret, timestamp=None, digits=6, period=30):
    normalized = re.sub(r"[\s-]+", "", secret or "").upper()
    if not normalized:
        raise ValueError("TOTP secret is empty")
    padding = "=" * ((8 - len(normalized) % 8) % 8)
    try:
        key = base64.b32decode(normalized + padding, casefold=True)
    except Exception as exc:
        raise ValueError("TOTP secret is not valid Base32") from exc

    current = time.time() if timestamp is None else timestamp
    counter = int(current // period)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % (10**digits)).zfill(digits)


def _human_type(element, value, delay_ms=85):
    element.click()
    try:
        element.press("Control+A")
        element.press("Backspace")
    except Exception:
        pass
    element.type(value, delay=delay_ms)


def _encode_multipart(fields):
    boundary = f"----opencode-multi-auth-{secrets.token_hex(12)}"
    chunks = []
    for name, value in fields.items():
        if value is None:
            continue
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("ascii"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(
                    "ascii"
                ),
                str(value).encode("utf-8"),
                b"\r\n",
            ]
        )
    chunks.append(f"--{boundary}--\r\n".encode("ascii"))
    return b"".join(chunks), boundary


def smspool_api_request(
    endpoint, api_key, fields=None, method="POST", timeout: float = 30
):
    if not api_key:
        raise RuntimeError("SMSPOOL_API_KEY is required for phone verification")

    method = method.upper()
    url = f"{SMSPOOL_API_BASE}{endpoint}"
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "opencode-multi-auth-codex/auto-login",
    }
    data = None
    if method == "GET" and fields:
        url = f"{url}?{urllib.parse.urlencode(fields)}"
    elif method == "POST":
        if fields:
            data, boundary = _encode_multipart(fields)
            headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        else:
            data = b""

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            error = json.loads(body)
            message = error.get("message") or error.get("type") or body
        except Exception:
            message = body or str(exc)
        raise RuntimeError(
            f"SMSPool {endpoint} failed with HTTP {exc.code}: {message}"
        ) from exc
    except URLError as exc:
        raise RuntimeError(f"SMSPool {endpoint} request failed: {exc.reason}") from exc

    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"SMSPool {endpoint} returned invalid JSON") from exc


def _smspool_option(config, name, env_name, default=None):
    if config and config.get(name) not in (None, ""):
        return config[name]
    return os.environ.get(env_name, default)


def _normalize_smspool_phone(order):
    number = order.get("number")
    if number in (None, ""):
        number = f"{order.get('cc', '')}{order.get('phonenumber', '')}"
    digits = re.sub(r"\D", "", str(number))
    if not digits:
        raise RuntimeError("SMSPool order did not include a phone number")
    return f"+{digits}"


def purchase_smspool_number(api_key, config=None):
    config = config or {}
    fields = {
        "country": _smspool_option(
            config, "country", "SMSPOOL_COUNTRY", SMSPOOL_DEFAULT_COUNTRY
        ),
        "service": _smspool_option(
            config, "service", "SMSPOOL_SERVICE", SMSPOOL_OPENAI_SERVICE
        ),
        "pricing_option": _smspool_option(
            config, "pricing_option", "SMSPOOL_PRICING_OPTION", 0
        ),
        "quantity": 1,
        "activation_type": "SMS",
    }
    optional = {
        "pool": "SMSPOOL_POOL",
        "max_price": "SMSPOOL_MAX_PRICE",
        "areacode": "SMSPOOL_AREA_CODE",
        "exclude": "SMSPOOL_EXCLUDE",
        "carrier": "SMSPOOL_CARRIER",
    }
    for name, env_name in optional.items():
        value = _smspool_option(config, name, env_name)
        if value not in (None, ""):
            fields[name] = value

    result = smspool_api_request("/purchase/sms", api_key, fields)
    if not isinstance(result, dict) or str(result.get("success", "0")).lower() not in {
        "1",
        "true",
    }:
        if isinstance(result, dict):
            message = result.get("message") or result.get("type") or "unknown error"
        else:
            message = "unexpected response"
        raise RuntimeError(f"SMSPool could not purchase a number: {message}")

    order_id = result.get("order_id")
    if not order_id:
        raise RuntimeError("SMSPool purchase response did not include order_id")
    return {
        "order_id": str(order_id),
        "phone": _normalize_smspool_phone(result),
        "expires_in": result.get("expires_in"),
    }


def _extract_sms_code(payload):
    if not isinstance(payload, dict):
        return None
    for key in ("sms", "code"):
        value = str(payload.get(key, "")).strip()
        if value and value not in {"0", "None", "null"}:
            match = re.search(r"\b([A-Za-z0-9]{4,10})\b", value)
            return match.group(1) if match else value
    for key in ("full_sms", "full_code"):
        value = str(payload.get(key, ""))
        match = re.search(r"\b(\d{4,10})\b", value)
        if match:
            return match.group(1)
    return None


class SmsPoolRetryRequired(RuntimeError):
    pass


class SmsPoolOrderEnded(RuntimeError):
    pass


def wait_for_smspool_sms(
    order_id,
    api_key,
    timeout_seconds=SMSPOOL_DEFAULT_TIMEOUT,
    poll_interval=SMSPOOL_POLL_INTERVAL,
):
    deadline = time.monotonic() + timeout_seconds
    missing_from_active = 0
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        active = smspool_api_request(
            "/request/active", api_key, timeout=max(0.1, min(30, remaining))
        )
        orders = (
            active
            if isinstance(active, list)
            else active.get("orders", [])
            if isinstance(active, dict)
            else []
        )
        order = next(
            (
                item
                for item in orders
                if str(item.get("order_code") or item.get("order_id")) == order_id
            ),
            None,
        )
        if order:
            missing_from_active = 0
            code = _extract_sms_code(order)
            if code:
                return code
            status = str(order.get("status", "")).lower()
            if status in {"cancelled", "canceled", "refunded", "expired"}:
                raise SmsPoolOrderEnded(f"SMSPool order ended with status: {status}")
        else:
            missing_from_active += 1

        if missing_from_active >= 2:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            check = smspool_api_request(
                "/sms/check",
                api_key,
                {"orderid": order_id, "key": api_key},
                timeout=max(0.1, min(30, remaining)),
            )
            code = _extract_sms_code(check)
            if code:
                return code
            status = str(check.get("status")) if isinstance(check, dict) else ""
            terminal = {
                "2": "expired",
                "5": "cancelled",
                "6": "refunded",
            }
            if status in terminal:
                raise SmsPoolOrderEnded(
                    f"SMSPool order was {terminal[status]} before an SMS arrived"
                )

        remaining = deadline - time.monotonic()
        if remaining > 0:
            time.sleep(min(poll_interval, remaining))

    raise TimeoutError(f"Timed out waiting for SMSPool order {order_id}")


def cancel_smspool_order(order_id, api_key, max_attempts=3):
    for attempt in range(max_attempts):
        try:
            result = smspool_api_request(
                "/sms/cancel", api_key, {"orderid": order_id, "key": api_key}
            )
        except RuntimeError as exc:
            if (
                "cannot be cancelled yet" in str(exc).lower()
                and attempt < max_attempts - 1
            ):
                time.sleep(5)
                continue
            raise

        if isinstance(result, dict) and str(result.get("success", "0")) == "1":
            return True
        message = (
            result.get("message", "unknown error")
            if isinstance(result, dict)
            else result
        )
        if (
            "cannot be cancelled yet" in str(message).lower()
            and attempt < max_attempts - 1
        ):
            time.sleep(5)
            continue
        raise RuntimeError(f"SMSPool could not cancel order {order_id}: {message}")
    return False


def _first_visible(page, selectors):
    for selector in selectors:
        try:
            element = page.query_selector(selector)
            if element and element.is_visible():
                return element
        except Exception:
            continue
    return None


def _wait_for_visible(page, selectors, timeout_ms=20000):
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        element = _first_visible(page, selectors)
        if element:
            return element
        page.wait_for_timeout(500)
    return None


def _wait_for_sms_code_or_phone_error(page, timeout_ms=30000):
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        try:
            body = page.inner_text("body").lower()
        except Exception:
            body = ""
        for marker in (
            "phone number is not valid",
            "phone number is invalid",
            "invalid phone number",
            "enter a valid phone number",
            "unsupported phone number",
        ):
            if marker in body:
                return None, marker
        code_input = _first_visible(page, SMS_CODE_SCREEN_SELECTORS)
        if code_input:
            return code_input, None
        page.wait_for_timeout(500)
    return None, None


def _fill_verification_code(page, code):
    digit_inputs = []
    try:
        digit_inputs = [
            element
            for element in page.query_selector_all(
                "input[maxlength='1'], input[data-slot*='otp'], input[data-testid*='digit']"
            )
            if element.is_visible()
        ]
    except Exception:
        pass
    if len(digit_inputs) >= len(code):
        for element, character in zip(digit_inputs, code):
            element.fill(character)
        return

    code_input = _wait_for_visible(
        page,
        [
            "input[name='totp']",
            "input[name='code']",
            "input[autocomplete='one-time-code']",
            "input[inputmode='numeric']",
            "input[placeholder*='code' i]",
        ],
    )
    if not code_input:
        raise RuntimeError("Verification code input was not found")
    _human_type(code_input, code, delay_ms=110)


def _submit_verification_form(page):
    submit = _first_visible(
        page,
        [
            "button[type='submit']",
            "button:has-text('Continue')",
            "button:has-text('Verify')",
            "button:has-text('Submit')",
            "button:has-text('Send code')",
        ],
    )
    if not submit:
        raise RuntimeError("Verification submit button was not found")
    submit.click()


def _is_totp_challenge(page):
    try:
        body = page.inner_text("body").lower()
        current_url = page.url.lower()
    except Exception:
        return False
    return any(
        marker in body
        for marker in (
            "authenticator app",
            "two-factor authentication",
            "two factor authentication",
            "2-step verification",
            "2fa code",
        )
    ) or any(marker in current_url for marker in ("/mfa", "totp", "two-factor"))


def handle_totp_challenge(page, totp_secret, attempted_counters=None):
    if not _is_totp_challenge(page):
        return False
    if not totp_secret:
        raise RuntimeError("This account requires TOTP but no 2FA secret was provided")

    attempted_counters = attempted_counters if attempted_counters is not None else set()
    if len(attempted_counters) >= 3:
        raise RuntimeError("Authenticator code was rejected three times")

    current_time = int(time.time())
    counter = current_time // 30
    remaining = 30 - current_time % 30
    if counter in attempted_counters or remaining < 4:
        page.wait_for_timeout((remaining + 1) * 1000)
        current_time = int(time.time())
        counter = current_time // 30
    attempted_counters.add(counter)

    code = generate_totp(totp_secret)
    print("  [3/5] Entering authenticator code...")
    _fill_verification_code(page, code)
    _submit_verification_form(page)
    page.wait_for_timeout(5000)
    if _is_totp_challenge(page):
        print(
            "  [WARNING] Authenticator code was not accepted; retrying if time allows."
        )
        return False
    return True


PHONE_INPUT_SELECTORS = [
    "input[type='tel']",
    "input[name='phone_number']",
    "input[name='phoneNumber']",
    "input[autocomplete='tel']",
    "input[placeholder*='phone' i]",
]

SMS_CODE_SELECTORS = [
    "input[name='code']",
    "input[autocomplete='one-time-code']",
    "input[inputmode='numeric']",
    "input[placeholder*='code' i]",
]

SMS_CODE_SCREEN_SELECTORS = [
    "input[name='code']",
    "input[autocomplete='one-time-code']",
    "input[placeholder*='code' i]",
]


def handle_smspool_phone_challenge(page, config=None, attempted_numbers=None):
    phone_input = _first_visible(page, PHONE_INPUT_SELECTORS)
    if not phone_input:
        return False

    api_key = os.environ.get("SMSPOOL_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Phone verification is required; set SMSPOOL_API_KEY to use SMSPool"
        )

    config = config or {}
    configured_timeout = int(
        _smspool_option(
            config,
            "timeout_seconds",
            "SMSPOOL_TIMEOUT",
            SMSPOOL_DEFAULT_TIMEOUT,
        )
    )
    timeout = min(max(configured_timeout, 1), SMSPOOL_DEFAULT_TIMEOUT)
    attempted_numbers = attempted_numbers if attempted_numbers is not None else set()

    print("  [4/5] Phone verification required, ordering an SMSPool number...")
    order = purchase_smspool_number(api_key, config)
    phone = order["phone"]
    order_closed = False
    sms_received = False
    try:
        if phone in attempted_numbers:
            order_closed = cancel_smspool_order(order["order_id"], api_key)
            raise SmsPoolRetryRequired(
                f"SMSPool repeated number ending in {phone[-4:]}"
            )
        attempted_numbers.add(phone)

        print(f"  [4/5] Entering SMSPool number ending in {phone[-4:]}...")
        _human_type(phone_input, phone)
        _submit_verification_form(page)
        code_input, validation_error = _wait_for_sms_code_or_phone_error(page)
        if not code_input:
            _save_debug_screenshot_page(page, phone[-4:], "phone_rejected")
            order_closed = cancel_smspool_order(order["order_id"], api_key)
            if order_closed:
                print(
                    f"  [4/5] Phone submission was not accepted; refunded order {order['order_id']}."
                )
            raise SmsPoolRetryRequired(
                f"{validation_error or 'Phone submission did not reach the SMS code screen'}; "
                "restart OAuth with a different number"
            )

        print(
            f"  [4/5] Waiting up to {timeout}s for SMSPool order {order['order_id']}..."
        )
        try:
            code = wait_for_smspool_sms(
                order["order_id"], api_key, timeout_seconds=timeout
            )
        except TimeoutError as exc:
            order_closed = cancel_smspool_order(order["order_id"], api_key)
            if order_closed:
                print(
                    f"  [4/5] No SMS after {timeout}s; refunded order {order['order_id']}."
                )
            raise SmsPoolRetryRequired(
                "SMS timed out; restart OAuth with a different number"
            ) from exc
        except SmsPoolOrderEnded as exc:
            order_closed = True
            raise SmsPoolRetryRequired(
                "SMSPool order ended without a code; restart OAuth with a different number"
            ) from exc

        sms_received = True
        print("  [4/5] Entering SMS verification code...")
        _fill_verification_code(page, code)
        _submit_verification_form(page)
        page.wait_for_timeout(5000)
        if _first_visible(page, SMS_CODE_SCREEN_SELECTORS):
            raise RuntimeError("OpenAI did not accept the SMS verification code")
        return True
    except BaseException:
        if not sms_received and not order_closed:
            try:
                cancel_smspool_order(order["order_id"], api_key)
            except Exception as cancel_error:
                print(f"  [WARNING] Could not refund SMSPool order: {cancel_error}")
        raise


# ── Outlook email verification code retrieval ──────────────────────────────
def _outlook_login(context, outlook_email, outlook_password):
    """Login to Outlook Web and get past all Microsoft interstitials.
    Returns the mail_page with inbox loaded, or None on failure."""
    mail_page = context.new_page()
    try:
        mail_page.goto(
            "https://login.live.com/login.srf?"
            "wa=wsignin1.0&wreply=https://outlook.live.com/mail/",
            wait_until="networkidle",
            timeout=30000,
        )
        time.sleep(2)

        # Enter email
        print("    [outlook] Entering email...")
        email_input = mail_page.wait_for_selector(
            "input[name='loginfmt'], input[type='email'], input#i0116",
            timeout=15000,
        )
        _human_type(email_input, outlook_email)
        time.sleep(0.8)
        mail_page.wait_for_selector(
            "input#idSIButton9, button#idSIButton9, button:has-text('Next')",
            timeout=10000,
        ).click()
        mail_page.wait_for_timeout(3000)

        # Enter password
        print("    [outlook] Entering password...")
        pw_input = mail_page.wait_for_selector(
            "input[name='passwd'], input[type='password'], input#i0118",
            timeout=15000,
        )
        _human_type(pw_input, outlook_password)
        time.sleep(0.8)
        mail_page.wait_for_selector(
            "input#idSIButton9, button#idSIButton9, "
            "button:has-text('Sign in'), button:has-text('Next')",
            timeout=10000,
        ).click()
        mail_page.wait_for_timeout(3000)

        # Handle "Stay signed in?"
        try:
            mail_page.wait_for_selector(
                "input#idSIButton9, button:has-text('Yes')",
                timeout=5000,
            ).click()
            mail_page.wait_for_timeout(2000)
        except Exception:
            pass

        # Handle all Microsoft interstitial prompts
        for _ in range(8):
            mail_page.wait_for_timeout(1500)
            current_url = mail_page.url.lower()

            # Already at inbox?
            if (
                "outlook.live.com/mail" in current_url
                or "outlook.office.com" in current_url
            ):
                break

            try:
                # FIDO / passkey creation page
                if "fido/create" in current_url or "passkey" in current_url:
                    fido_skip = mail_page.query_selector(
                        "button:has-text('Not now'), a:has-text('Not now'), "
                        "button:has-text('Skip for now'), a:has-text('Skip for now'), "
                        "button:has-text('Cancel'), a:has-text('Cancel'), "
                        "button:has-text('Skip'), a:has-text('Skip'), "
                        "#cancelBtn, button[data-testid='cancelBtn'], "
                        "button[data-testid='notNowBtn']"
                    )
                    if fido_skip:
                        print("    [outlook] Skipping FIDO/passkey prompt...")
                        fido_skip.click()
                        mail_page.wait_for_timeout(2000)
                        continue

                # Generic "Skip for now" / "Cancel" / "Not now" on any interstitial
                skip = mail_page.query_selector(
                    "a:has-text('Skip for now'), button:has-text('Skip for now'), "
                    "a[id='iCancel'], #iCancel, "
                    "button:has-text('Not now'), a:has-text('Not now'), "
                    "a:has-text('Skip'), button:has-text('Skip')"
                )
                if skip:
                    print("    [outlook] Skipping security prompt...")
                    skip.click()
                    mail_page.wait_for_timeout(2000)
                    continue

                cancel = mail_page.query_selector(
                    "button:has-text('Cancel'), a:has-text('Cancel'), "
                    "button:has-text('No thanks'), a:has-text('Not now'), "
                    "button:has-text('I don\\'t want to'), a:has-text('I don\\'t want to')"
                )
                if cancel:
                    print(f"    [outlook] Clicking '{cancel.inner_text().strip()}'...")
                    cancel.click()
                    mail_page.wait_for_timeout(2000)
                    continue

            except Exception:
                pass

        # If still not on inbox, force-navigate there
        if "outlook.live.com/mail" not in mail_page.url.lower():
            print(
                f"    [outlook] Not on inbox yet ({mail_page.url[:60]}), navigating..."
            )
            try:
                mail_page.goto(
                    "https://outlook.live.com/mail/0/",
                    wait_until="domcontentloaded",
                    timeout=20000,
                )
                mail_page.wait_for_timeout(5000)
            except Exception as e:
                print(f"    [outlook] Navigation to inbox failed: {e}")

        print(f"    [outlook] Inbox loaded. URL: {mail_page.url[:80]}")
        mail_page.wait_for_timeout(3000)
        return mail_page

    except Exception as e:
        print(f"    [outlook] Login failed: {e}")
        _save_debug_screenshot_page(mail_page, outlook_email, "outlook_login_fail")
        mail_page.close()
        return None


def _outlook_read_latest_code(mail_page, max_attempts=4):
    """Refresh Outlook inbox and extract the verification code from the latest email.
    Returns the 6-digit code or None."""
    for attempt in range(max_attempts):
        if attempt > 0:
            print(f"    [outlook] Attempt {attempt + 1}/{max_attempts}...")

        # Refresh inbox (use "load" - webmail never reaches networkidle)
        try:
            mail_page.reload(wait_until="load", timeout=20000)
        except Exception:
            pass  # reload might timeout but page is still usable
        mail_page.wait_for_timeout(5000)

        # Try to click the first (newest) email
        clicked = False
        selectors = [
            "[role='option']:first-child",
            "[data-convid]:first-child",
            "[role='listbox'] [role='option']:first-child",
            "[role='list'] [role='listitem']:first-child",
        ]
        for sel in selectors:
            try:
                el = mail_page.query_selector(sel)
                if el:
                    el.click()
                    clicked = True
                    break
            except Exception:
                continue

        if not clicked:
            # Fallback: click any mail item
            items = mail_page.query_selector_all("[role='option'], [data-convid]")
            if items:
                items[0].click()
                clicked = True

        if clicked:
            mail_page.wait_for_timeout(2000)

        # Extract code from visible content
        body_text = mail_page.evaluate("() => document.body.innerText")

        # Precise patterns for OpenAI verification emails
        patterns = [
            r"(?:verification\s+code\s*(?:is)?[:\s]+)(\d{6})",
            r"(?:your\s+code\s*(?:is)?[:\s]+)(\d{6})",
            r"(?:enter\s+(?:this\s+)?code[:\s]+)(\d{6})",
            r"(?:code[:\s]+)(\d{6})",
        ]
        for pat in patterns:
            matches = re.findall(pat, body_text, re.IGNORECASE)
            if matches:
                return matches[-1]  # Last match = most recent

        # Fallback: any 6-digit number (skip year-like numbers)
        all_codes = re.findall(r"\b(\d{6})\b", body_text)
        valid = [c for c in all_codes if not c.startswith("20")]
        if valid:
            return valid[-1]
        if all_codes:
            return all_codes[-1]

        if attempt < max_attempts - 1:
            print("    [outlook] Code not found yet, waiting 6s...")
            mail_page.wait_for_timeout(6000)

    return None


def _save_debug_screenshot_page(page, identifier, step):
    safe_name = identifier.split("@")[0]
    path = SCRIPT_DIR / f"debug_{safe_name}_{step}.png"
    try:
        page.screenshot(path=str(path))
        print(f"    [DEBUG] Screenshot: {path}")
    except Exception:
        pass


class CallbackServer(BaseHTTPRequestHandler):
    """HTTP handler that captures the OAuth callback code into a shared list."""

    captured_codes = []  # Class-level shared storage

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        code = query.get("code", [None])[0]
        if code:
            CallbackServer.captured_codes.append(code)
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h1>Login successful!</h1><p>Close this window.</p>")
        else:
            self.send_response(400)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"No code found in URL.")

    def log_message(self, format, *args):
        pass


_active_callback_server = None


def stop_callback_server():
    global _active_callback_server
    server = _active_callback_server
    _active_callback_server = None
    if not server:
        return
    try:
        server.shutdown()
    finally:
        server.server_close()


# ── Main Playwright login flow ─────────────────────────────────────────────
def login_account(
    email,
    chatgpt_password,
    outlook_password=None,
    totp_secret=None,
    smspool_config=None,
    smspool_attempted_numbers=None,
    headless=True,
    browser_engine="auto",
    auth_url_override=None,
    external_callback=False,
):
    """
    Full OAuth login. Strategy:
    1. Navigate to OpenAI auth
    2. Enter email
    3. Try "Log in with a one-time code" (sends code to email → read from Outlook)
    4. Fallback to password and handle TOTP, email, or phone verification
    """
    global _active_callback_server

    code_verifier = None
    redirect_uri = f"http://localhost:{REDIRECT_PORT}/auth/callback"
    auth_url = auth_url_override

    if not auth_url:
        code_verifier, code_challenge = generate_pkce()
        state = generate_state()
        auth_url = build_auth_url(code_challenge, state, redirect_uri)

    with launch_automation_browser(headless, browser_engine) as (browser, engine):
        if engine == "cloak":
            context = browser.new_context()
        else:
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/131.0.0.0 Safari/537.36"
                ),
                locale="en-US",
                viewport={"width": 1280, "height": 800},
            )
            context.add_init_script(
                """
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                window.chrome = window.chrome || { runtime: {} };
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                """
            )

        server = None
        if not external_callback:
            # Start the callback server before navigation
            stop_callback_server()
            CallbackServer.captured_codes = []  # Reset for this run
            server = HTTPServer(("localhost", REDIRECT_PORT), CallbackServer)
            _active_callback_server = server
            server.timeout = 1
            server_thread = threading.Thread(target=server.serve_forever, daemon=True)
            server_thread.start()

        page = context.new_page()

        otp_selector = (
            "button:has-text('one-time code'), a:has-text('one-time code'), "
            "button:has-text('Log in with a one-time code'), "
            "a:has-text('Log in with a one-time code')"
        )

        def _on_local_callback():
            current = page.url.lower()
            return (
                current.startswith("http://localhost:")
                or current.startswith("http://127.0.0.1:")
                or current.startswith("http://[::1]:")
            )

        def _has_callback():
            return (
                _on_local_callback()
                if external_callback
                else bool(CallbackServer.captured_codes)
            )

        def _page_title_lower():
            try:
                return page.title().lower()
            except Exception:
                return ""

        def _body_text_lower():
            try:
                return page.inner_text("body").lower()
            except Exception:
                return ""

        def _is_cloudflare_gate():
            title = _page_title_lower()
            body = _body_text_lower()
            current_url = page.url.lower()
            return (
                "just a moment" in title
                or "security verification" in body
                or "__cf_chl_rt_tk=" in current_url
                or "challenge-platform" in body
            )

        def _is_manual_verification_gate():
            body = _body_text_lower()
            return _is_cloudflare_gate() and (
                "verify you are human" in body
                or "verify that you are human" in body
                or "i am human" in body
                or bool(page.query_selector("input[type='checkbox']"))
            )

        def _is_timeout_screen():
            title = _page_title_lower()
            body = _body_text_lower()
            return (
                "oops, an error occurred" in body
                or "operation timed out" in body
                or "operation timed out" in title
            )

        def _retry_timeout_page():
            retry_button = page.query_selector(
                "button:has-text('Try again'), a:has-text('Try again')"
            )
            if retry_button:
                retry_button.click()
            else:
                page.goto(auth_url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

        def _wait_for_auth_entry(timeout_ms=5 * 60 * 1000):
            deadline = time.time() + (timeout_ms / 1000)
            noted_cloudflare = False
            noted_manual_verification = False
            cloudflare_since = None
            while time.time() < deadline:
                if _has_callback():
                    return
                if page.query_selector(
                    "input[name='email'], input[type='email'], "
                    "input#email, input[name='username']"
                ):
                    return
                if page.query_selector(
                    "input[name='password'], input[type='password']"
                ):
                    return
                if _is_cloudflare_gate():
                    if cloudflare_since is None:
                        cloudflare_since = time.time()
                    if _is_manual_verification_gate():
                        if not noted_manual_verification:
                            print(
                                "  [1/5] Manual Cloudflare verification required. Complete it in the Chrome window."
                            )
                            try:
                                page.bring_to_front()
                            except Exception:
                                pass
                            noted_manual_verification = True
                    elif (
                        not noted_manual_verification
                        and cloudflare_since
                        and time.time() - cloudflare_since >= 12
                    ):
                        print(
                            "  [1/5] Manual Cloudflare verification may be required. Complete it in the Chrome window if prompted."
                        )
                        try:
                            page.bring_to_front()
                        except Exception:
                            pass
                        noted_manual_verification = True
                    elif not noted_cloudflare:
                        print("  [1/5] Waiting for Cloudflare verification...")
                        noted_cloudflare = True
                elif _is_timeout_screen():
                    print(
                        "  [1/5] OpenAI auth timed out before login form, retrying..."
                    )
                    _retry_timeout_page()
                    continue
                else:
                    cloudflare_since = None
                page.wait_for_timeout(1000)
            _save_debug_screenshot_page(page, email, "auth_entry")
            if noted_manual_verification:
                raise RuntimeError(
                    "Auth entry page did not become ready because Cloudflare verification was not completed"
                )
            raise RuntimeError("Auth entry page did not become ready")

        def _wait_for_next_auth_stage(timeout_ms=5 * 60 * 1000):
            deadline = time.time() + (timeout_ms / 1000)
            noted_manual_verification = False
            cloudflare_since = None
            while time.time() < deadline:
                current_url = page.url.lower()
                if _has_callback():
                    return "ready"
                if page.query_selector(otp_selector):
                    return "ready"
                if page.query_selector(
                    "input[name='password'], input[type='password']"
                ):
                    return "ready"
                if "consent" in current_url or "email-verification" in current_url:
                    return "ready"
                if _is_timeout_screen():
                    return "retry-email"
                if _is_cloudflare_gate():
                    if cloudflare_since is None:
                        cloudflare_since = time.time()
                    if _is_manual_verification_gate() or (
                        not noted_manual_verification
                        and cloudflare_since
                        and time.time() - cloudflare_since >= 12
                    ):
                        if not noted_manual_verification:
                            print(
                                "  [2/5] Manual Cloudflare verification required. Complete it in the Chrome window."
                            )
                            try:
                                page.bring_to_front()
                            except Exception:
                                pass
                            noted_manual_verification = True
                else:
                    cloudflare_since = None
                try:
                    heading = page.query_selector("h1, h2, h3")
                    if heading:
                        heading_text = heading.inner_text().lower()
                        if (
                            "check your inbox" in heading_text
                            or "continue" in heading_text
                            or "authorize" in heading_text
                            or "allow" in heading_text
                        ):
                            return "ready"
                except Exception:
                    pass
                page.wait_for_timeout(750)
            return "timeout"

        # ── Step 1: Navigate to OpenAI auth
        print("  [1/5] Navigating to OpenAI auth...")
        page.goto(auth_url, wait_until="domcontentloaded", timeout=30000)
        _wait_for_auth_entry()

        # ── Step 2: Enter email
        email_step_error = None
        for attempt in range(1, 4):
            print(f"  [2/5] Entering email (attempt {attempt}/3)...")
            try:
                _wait_for_auth_entry(timeout_ms=20000)
                email_input = page.wait_for_selector(
                    "input[name='email'], input[type='email'], "
                    "input#email, input[name='username']",
                    timeout=15000,
                )
                _human_type(email_input, email)
                time.sleep(0.8)
                page.wait_for_selector(
                    "button[type='submit'], button:has-text('Continue')",
                    timeout=10000,
                ).click()
                page.wait_for_timeout(3000)
                next_stage = _wait_for_next_auth_stage(timeout_ms=20000)
                if next_stage == "ready":
                    email_step_error = None
                    break
                if next_stage == "retry-email" and attempt < 3:
                    print(
                        "  [2/5] OpenAI returned a timeout page after email submit, retrying..."
                    )
                    _retry_timeout_page()
                    continue
                email_step_error = RuntimeError(
                    f"Email step stalled while waiting for the next auth stage ({next_stage})"
                )
            except Exception as e:
                email_step_error = e
                if attempt < 3:
                    print(f"  [2/5] Email step failed: {e}. Retrying...")
                    try:
                        page.goto(
                            auth_url, wait_until="domcontentloaded", timeout=30000
                        )
                        _wait_for_auth_entry(timeout_ms=20000)
                    except Exception:
                        pass
                    continue
            if email_step_error:
                break

        if email_step_error:
            _save_debug_screenshot_page(page, email, "email_step")
            raise RuntimeError(f"Email step failed: {email_step_error}")

        # ── Step 3: Try "Log in with a one-time code" (preferred method)
        otp_login_done = False
        totp_done = False
        totp_attempted_counters = set()
        phone_verification_done = False
        otp_link = page.query_selector(otp_selector)

        if otp_link and outlook_password:
            print("  [3/5] Using one-time code login (preferred)...")
            try:
                otp_link.click()
                page.wait_for_timeout(3000)

                # Check if we need to enter email again on OTP page
                otp_email_input = page.query_selector(
                    "input[name='email'], input[type='email']"
                )
                if otp_email_input:
                    _human_type(otp_email_input, email)
                    time.sleep(0.6)
                    submit = page.query_selector(
                        "button[type='submit'], button:has-text('Continue')"
                    )
                    if submit:
                        submit.click()
                        page.wait_for_timeout(3000)

                # Now OpenAI should send a one-time code to the email
                # Login to Outlook and read the code
                print("  [3/5] Logging into Outlook to read one-time code...")
                mail_page = _outlook_login(context, email, outlook_password)
                if mail_page:
                    # Wait for the email to arrive
                    print("  [3/5] Waiting 10s for code email to arrive...")
                    page.wait_for_timeout(10000)

                    print("  [3/5] Reading code from Outlook...")
                    otp_code = _outlook_read_latest_code(mail_page)
                    mail_page.close()

                    if otp_code:
                        print("  [3/5] Entering one-time code...")
                        code_input = page.wait_for_selector(
                            "input[name='code'], input[type='text'], "
                            "input[inputmode='numeric'], "
                            "input[placeholder*='ode']",
                            timeout=10000,
                        )
                        _human_type(code_input, otp_code, delay_ms=110)
                        time.sleep(0.8)
                        page.wait_for_selector(
                            "button[type='submit'], button:has-text('Continue')",
                            timeout=10000,
                        ).click()
                        page.wait_for_timeout(5000)
                        otp_login_done = True
                    else:
                        print(
                            "  [3/5] Could not read OTP from Outlook, trying password..."
                        )
                else:
                    print("  [3/5] Outlook login failed, trying password...")
            except Exception as e:
                print(f"  [3/5] OTP login error: {e}, trying password...")

        # ── Fallback: Password login
        if not otp_login_done and not _has_callback():
            # Check if we're still on a page that needs password
            if "password" in page.url or page.query_selector("input[type='password']"):
                print("  [3/5] Entering password (fallback)...")
                try:
                    pw_input = page.wait_for_selector(
                        "input[name='password'], input[type='password']",
                        timeout=10000,
                    )
                    _human_type(pw_input, chatgpt_password)
                    time.sleep(0.8)
                    page.wait_for_selector(
                        "button[type='submit'], button:has-text('Continue'), "
                        "button:has-text('Log in'), button:has-text('Sign in')",
                        timeout=10000,
                    ).click()
                    page.wait_for_timeout(5000)

                    # Check for "Incorrect password" error
                    error_el = page.query_selector("[class*='error'], [role='alert']")
                    if error_el:
                        err_text = error_el.inner_text().strip()
                        if "incorrect" in err_text.lower():
                            print(f"  [WARNING] {err_text}")
                            print("  [3/5] Password rejected. Trying one-time code...")
                            # Try one-time code as last resort
                            otp_link2 = page.query_selector(
                                "button:has-text('one-time code'), a:has-text('one-time code')"
                            )
                            if otp_link2 and outlook_password:
                                otp_link2.click()
                                page.wait_for_timeout(3000)
                                mail_page = _outlook_login(
                                    context, email, outlook_password
                                )
                                if mail_page:
                                    page.wait_for_timeout(10000)
                                    otp_code = _outlook_read_latest_code(mail_page)
                                    mail_page.close()
                                    if otp_code:
                                        print("  [3/5] Entering OTP code...")
                                        ci = page.wait_for_selector(
                                            "input[name='code'], input[type='text']",
                                            timeout=10000,
                                        )
                                        _human_type(ci, otp_code, delay_ms=110)
                                        time.sleep(0.8)
                                        page.wait_for_selector(
                                            "button[type='submit'], button:has-text('Continue')",
                                            timeout=10000,
                                        ).click()
                                        page.wait_for_timeout(5000)
                                        otp_login_done = True

                except Exception as e:
                    _save_debug_screenshot_page(page, email, "password_step")
                    raise RuntimeError(f"Password step failed: {e}")

        if not _has_callback():
            totp_done = handle_totp_challenge(
                page, totp_secret, totp_attempted_counters
            )

        # ── Step 4: Handle email verification (after password login)
        if not _has_callback() and not otp_login_done:
            current_url = page.url
            needs_verification = "email-verification" in current_url
            if not needs_verification:
                try:
                    h = page.query_selector("h1, h2")
                    if h and "check your inbox" in h.inner_text().lower():
                        needs_verification = True
                except Exception:
                    pass

            if needs_verification and outlook_password:
                print(
                    "  [4/5] Email verification required, getting code from Outlook..."
                )
                mail_page = _outlook_login(context, email, outlook_password)
                if mail_page:
                    # Resend for fresh code
                    resend = page.query_selector(
                        "button:has-text('Resend'), a:has-text('Resend')"
                    )
                    if resend:
                        resend.click()
                    page.wait_for_timeout(10000)

                    vcode = _outlook_read_latest_code(mail_page)
                    mail_page.close()
                    if vcode:
                        print("  [4/5] Entering verification code...")
                        ci = page.wait_for_selector(
                            "input[name='code'], input[type='text']",
                            timeout=10000,
                        )
                        _human_type(ci, vcode, delay_ms=110)
                        time.sleep(0.8)
                        page.wait_for_selector(
                            "button[type='submit'], button:has-text('Continue')",
                            timeout=10000,
                        ).click()
                        page.wait_for_timeout(5000)

        if not _has_callback() and not totp_done:
            totp_done = handle_totp_challenge(
                page, totp_secret, totp_attempted_counters
            )
        if not _has_callback():
            phone_verification_done = handle_smspool_phone_challenge(
                page, smspool_config, smspool_attempted_numbers
            )

        # ── Step 5: Wait for OAuth callback
        print("  [5/5] Waiting for OAuth callback...")

        # First, handle consent page if present
        def _try_handle_consent():
            """Check if we're on a consent page and click Continue. Returns True if clicked."""
            try:
                current = page.url
                # Check URL pattern
                on_consent = "consent" in current.lower()
                if not on_consent:
                    # Also check page content
                    heading = page.query_selector("h1, h2, h3")
                    if heading:
                        text = heading.inner_text().lower()
                        if (
                            "authorize" in text
                            or "consent" in text
                            or "allow" in text
                            or "access" in text
                        ):
                            on_consent = True

                if on_consent:
                    btn = page.query_selector(
                        "button:has-text('Continue'), button:has-text('Allow'), "
                        "button:has-text('Authorize'), button[type='submit'], "
                        "input[type='submit']"
                    )
                    if btn:
                        print(
                            f"  [5/5] Consent page detected, clicking '{btn.inner_text().strip()}'..."
                        )
                        btn.click()
                        return True
            except Exception:
                pass
            return False

        # Try consent immediately (common case after OTP)
        page.wait_for_timeout(2000)
        _try_handle_consent()

        # Poll for callback, periodically re-checking for consent/interstitials
        deadline = time.time() + 45
        checks = 0
        while (
            (external_callback and not _on_local_callback())
            or (not external_callback and not CallbackServer.captured_codes)
        ) and time.time() < deadline:
            page.wait_for_timeout(1500)
            checks += 1

            # Every few iterations, re-check for consent or other buttons
            if checks % 3 == 0 and (
                (external_callback and not _on_local_callback())
                or (not external_callback and not CallbackServer.captured_codes)
            ):
                if not totp_done:
                    totp_done = handle_totp_challenge(
                        page, totp_secret, totp_attempted_counters
                    )
                if not phone_verification_done:
                    phone_verification_done = handle_smspool_phone_challenge(
                        page, smspool_config, smspool_attempted_numbers
                    )
                    if phone_verification_done:
                        deadline = time.time() + 45
                _try_handle_consent()
                if _is_timeout_screen():
                    print(
                        "  [5/5] OpenAI auth timed out after login, retrying current page..."
                    )
                    _retry_timeout_page()

            # Also check for any stray "Continue" / "Accept" buttons on unknown pages
            if checks % 5 == 0 and (
                (external_callback and not _on_local_callback())
                or (not external_callback and not CallbackServer.captured_codes)
            ):
                try:
                    stray = page.query_selector(
                        "button:has-text('Continue'), button:has-text('Accept')"
                    )
                    if stray and "consent" not in page.url.lower():
                        # Only click if page is NOT localhost (callback already handled)
                        if "localhost" not in page.url:
                            print(
                                f"  [5/5] Clicking stray button: '{stray.inner_text().strip()}'..."
                            )
                            stray.click()
                except Exception:
                    pass

        if external_callback and _on_local_callback():
            print("  [DONE] Browser flow completed, callback reached local server.")
            return email

        if not external_callback and not CallbackServer.captured_codes:
            _save_debug_screenshot_page(page, email, "no_callback")
            print(f"  [ERROR] No OAuth code. URL: {page.url[:200]}")
            if server:
                stop_callback_server()
            return None

        if external_callback:
            _save_debug_screenshot_page(page, email, "no_callback")
            print(f"  [ERROR] No callback redirect. URL: {page.url[:200]}")
            return None

        captured_code = CallbackServer.captured_codes[0]
        print("  [CALLBACK] OAuth code captured.")
        if server:
            stop_callback_server()

    # ── Exchange code for tokens
    if external_callback:
        return email

    print("  [DONE] Exchanging code for tokens...")
    tokens = exchange_code_for_tokens(captured_code, redirect_uri, code_verifier)

    stored_email, index, is_new = add_account_to_store(tokens)
    action = "Added new" if is_new else "Updated existing"
    print(f"  {action} account #{index}: {stored_email}")
    return stored_email


# ── Commands ────────────────────────────────────────────────────────────────
def cmd_check(accounts):
    store = load_store()
    now = int(time.time() * 1000)

    print(f"\n  Credentials file: {len(accounts)} account(s)")
    print(f"  Plugin store:     {len(store['accounts'])} account(s)\n")

    for i, acc in enumerate(accounts):
        email = acc["email"]
        enabled = acc.get("enabled", True)
        store_acc = next(
            (
                s
                for s in store["accounts"]
                if normalize_email(s.get("email")) == normalize_email(email)
            ),
            None,
        )

        if not store_acc:
            status = "NOT IN STORE"
        elif store_acc.get("authInvalid"):
            status = "AUTH INVALID"
        elif store_acc.get("expiresAt", 0) < now:
            status = "EXPIRED"
        else:
            exp = datetime.fromtimestamp(store_acc["expiresAt"] / 1000, tz=timezone.utc)
            status = f"OK (expires {exp.strftime('%Y-%m-%d %H:%M')} UTC)"

        print(f"  #{i} [{'ON' if enabled else 'OFF'}] {email}")
        print(f"       -> {status}")
    print()


def cmd_login(targets, defaults, headless=True, auth_url=None, browser_engine="auto"):
    if auth_url and len(targets) != 1:
        print("[ERROR] --auth-url mode requires exactly one target account")
        return 0, len(targets)

    print(f"\n{'=' * 55}")
    print(f"  Auto-Login: {len(targets)} account(s)")
    print(f"{'=' * 55}\n")

    success, failed = 0, 0

    for i, acc in enumerate(targets):
        email = acc["email"]
        chatgpt_pw = (
            acc.get("chatgpt_password")
            or acc.get("password")
            or defaults.get("chatgpt_password")
        )
        outlook_pw = acc.get("outlook_password")
        totp_secret = (
            acc.get("totp_secret")
            or acc.get("2fa_secret")
            or acc.get("two_factor_secret")
        )
        smspool_config = {
            **(
                defaults.get("smspool", {})
                if isinstance(defaults.get("smspool"), dict)
                else {}
            ),
            **(acc.get("smspool", {}) if isinstance(acc.get("smspool"), dict) else {}),
        }

        if not chatgpt_pw:
            print(f"[{i + 1}/{len(targets)}] {email}: SKIPPED (no ChatGPT password)")
            failed += 1
            continue

        print(f"[{i + 1}/{len(targets)}] {email}")

        try:
            max_orders = int(
                _smspool_option(
                    smspool_config,
                    "max_orders",
                    "SMSPOOL_MAX_ORDERS",
                    SMSPOOL_DEFAULT_MAX_ORDERS,
                )
            )
            max_orders = min(max(max_orders, 1), 10)
            attempted_numbers = set()
            phone_attempts = 0

            while True:
                try:
                    result = login_account(
                        email,
                        chatgpt_pw,
                        outlook_password=outlook_pw,
                        totp_secret=totp_secret,
                        smspool_config=smspool_config,
                        smspool_attempted_numbers=attempted_numbers,
                        headless=headless,
                        browser_engine=browser_engine,
                        auth_url_override=auth_url,
                        external_callback=bool(auth_url),
                    )
                    break
                except SmsPoolRetryRequired as retry_error:
                    phone_attempts += 1
                    if auth_url:
                        raise RuntimeError(
                            "SMSPool retry requires a fresh OAuth URL; restart login from the dashboard"
                        ) from retry_error
                    if phone_attempts >= max_orders:
                        raise RuntimeError(
                            f"No SMS received after {max_orders} SMSPool order(s)"
                        ) from retry_error
                    print(
                        f"  [4/5] Restarting OAuth for SMSPool order {phone_attempts + 1}/{max_orders}..."
                    )
                    time.sleep(2)
                finally:
                    stop_callback_server()

            if result:
                print("  -> SUCCESS\n")
                success += 1
            else:
                print("  -> FAILED\n")
                failed += 1
        except Exception as e:
            print(f"  -> ERROR: {e}\n")
            failed += 1

        if i < len(targets) - 1:
            print(f"  (waiting {BETWEEN_ACCOUNTS_DELAY}s...)\n")
            time.sleep(BETWEEN_ACCOUNTS_DELAY)

    print(f"{'=' * 55}")
    print(f"  Results: {success} success, {failed} failed")
    print(f"{'=' * 55}\n")
    return success, failed


# ── Main ────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Auto-login for opencode-multi-auth-codex"
    )
    parser.add_argument("--account", type=int, help="Login by credential index")
    parser.add_argument("--email", type=str, help="Login by email")
    parser.add_argument("--check", action="store_true", help="Check account status")
    parser.add_argument("--visible", action="store_true", help="Show browser window")
    parser.add_argument(
        "--browser",
        choices=("auto", "cloak", "playwright"),
        default="auto",
        help="Browser engine (auto prefers CloakBrowser when installed)",
    )
    parser.add_argument(
        "--auth-url",
        type=str,
        help="Use an existing OAuth URL and only complete the browser flow",
    )
    parser.add_argument(
        "--credentials-file",
        type=str,
        help="Override the credentials file path",
    )
    args = parser.parse_args()

    creds = load_credentials(args.credentials_file)
    accounts = deduplicate_accounts(creds.get("accounts", []))
    defaults = creds.get("defaults", {})

    if not accounts:
        print("[ERROR] No accounts in the credentials file")
        sys.exit(1)

    if args.check:
        cmd_check(accounts)
        return

    if args.email:
        targets = [
            a
            for a in accounts
            if normalize_email(a["email"]) == normalize_email(args.email)
        ]
        if not targets:
            print(f"[ERROR] Email '{args.email}' not found")
            sys.exit(1)
    elif args.account is not None:
        if not (0 <= args.account < len(accounts)):
            print(f"[ERROR] Index {args.account} out of range")
            sys.exit(1)
        targets = [accounts[args.account]]
    else:
        targets = [a for a in accounts if a.get("enabled", True)]

    if not targets:
        print("No enabled accounts to login.")
        return

    if args.auth_url and len(targets) != 1:
        print("[ERROR] --auth-url mode requires exactly one selected account")
        sys.exit(1)

    headless = not args.visible
    success, failed = cmd_login(
        targets,
        defaults,
        headless=headless,
        auth_url=args.auth_url,
        browser_engine=args.browser,
    )
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
