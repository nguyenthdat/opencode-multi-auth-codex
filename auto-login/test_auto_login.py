import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


MODULE_PATH = Path(__file__).with_name("auto_login.py")
SPEC = importlib.util.spec_from_file_location("auto_login", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Could not load {MODULE_PATH}")
auto_login = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(auto_login)


class PipeCredentialsTests(unittest.TestCase):
    def test_parses_header_plain_and_numbered_rows(self):
        parsed = auto_login.parse_pipe_credentials(
            """
            |email|password|2mfa secret key|
            |one@example.com|pass-one|JBSWY3DPEHPK3PXP|
            2. |two@example.com|pass-two|GEZDGNBVGY3TQOJQ|
            3|three@example.com|pass-three||
            """
        )

        self.assertEqual(
            [account["email"] for account in parsed],
            [
                "one@example.com",
                "two@example.com",
                "three@example.com",
            ],
        )
        self.assertEqual(parsed[1]["chatgpt_password"], "pass-two")
        self.assertEqual(parsed[2]["totp_secret"], "")

    def test_rejects_malformed_rows(self):
        with self.assertRaisesRegex(ValueError, "line 1"):
            auto_login.parse_pipe_credentials("one@example.com|password")

    def test_deduplicates_accounts_by_normalized_email(self):
        accounts = [
            {"email": " One@Example.com ", "password": "first"},
            {"email": "one@example.COM", "password": "second"},
            {"email": "two@example.com", "password": "third"},
        ]
        with patch("builtins.print"):
            unique = auto_login.deduplicate_accounts(accounts)
        self.assertEqual([account["password"] for account in unique], ["first", "third"])


class EnvironmentTests(unittest.TestCase):
    def test_dotenv_loads_key_without_overriding_exported_value(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env"
            env_file.write_text(
                "SMSPOOL_API_KEY=from-file\n"
                "OPENCODE_MULTI_AUTH_PROXY=socks5://proxy.example.com:1080\n"
                "OPENCODE_MULTI_AUTH_PROXY_USERNAME=proxy-user\n"
                "OPENCODE_MULTI_AUTH_PROXY_PASSWORD=proxy-password\n"
                "OPENCODE_MULTI_AUTH_DEACTIVATED_FILE=/private/deactivated.json\n"
                "PROXY=must-not-load\n"
                "GITHUB_TOKEN=must-not-load\n",
                encoding="utf-8",
            )
            env_file.chmod(0o600)

            with patch.dict(os.environ, {"SMSPOOL_API_KEY": "from-shell"}, clear=True):
                self.assertTrue(auto_login.load_environment(env_file))
                self.assertEqual(os.environ["SMSPOOL_API_KEY"], "from-shell")

            with patch.dict(os.environ, {}, clear=True):
                self.assertTrue(auto_login.load_environment(env_file))
                self.assertEqual(os.environ["SMSPOOL_API_KEY"], "from-file")
                self.assertEqual(
                    os.environ["OPENCODE_MULTI_AUTH_PROXY"],
                    "socks5://proxy.example.com:1080",
                )
                self.assertEqual(
                    os.environ["OPENCODE_MULTI_AUTH_DEACTIVATED_FILE"],
                    "/private/deactivated.json",
                )
                self.assertNotIn("PROXY", os.environ)
                self.assertNotIn("GITHUB_TOKEN", os.environ)


class ProxyConfigTests(unittest.TestCase):
    def test_builds_authenticated_http_proxy_and_enforces_local_bypass(self):
        with patch.dict(
            os.environ,
            {
                "OPENCODE_MULTI_AUTH_PROXY": "http://proxy.example.com:3128",
                "OPENCODE_MULTI_AUTH_PROXY_USERNAME": "proxy-user",
                "OPENCODE_MULTI_AUTH_PROXY_PASSWORD": "proxy-password",
                "OPENCODE_MULTI_AUTH_PROXY_BYPASS": "internal.example",
            },
            clear=True,
        ):
            config = auto_login.build_proxy_config()

        self.assertEqual(config["server"], "http://proxy.example.com:3128")
        self.assertEqual(config["username"], "proxy-user")
        self.assertEqual(config["password"], "proxy-password")
        self.assertEqual(
            config["bypass"],
            "internal.example,localhost,127.0.0.1,::1",
        )

    def test_cli_values_override_proxy_environment(self):
        with patch.dict(
            os.environ,
            {
                "OPENCODE_MULTI_AUTH_PROXY": "http://environment.example:3128",
                "OPENCODE_MULTI_AUTH_PROXY_USERNAME": "proxy-user",
                "OPENCODE_MULTI_AUTH_PROXY_PASSWORD": "proxy-password",
            },
            clear=True,
        ):
            config = auto_login.build_proxy_config(
                server="http://override.example:8080",
                bypass="localhost",
            )

        self.assertEqual(config["server"], "http://override.example:8080")
        self.assertEqual(config["bypass"], "localhost,127.0.0.1,::1")

    def test_rejects_credentials_embedded_in_proxy_url(self):
        with self.assertRaisesRegex(ValueError, "dedicated username/password"):
            auto_login.build_proxy_config(
                server="socks5://user:password@proxy.example.com:1080",
                username="user",
                password="password",
            )

    def test_requires_proxy_username_and_password_together(self):
        with self.assertRaisesRegex(ValueError, "configured together"):
            auto_login.build_proxy_config(
                server="socks5://proxy.example.com:1080",
                username="proxy-user",
                password="",
            )

    def test_rejects_authenticated_socks5_proxy_for_chromium(self):
        with self.assertRaisesRegex(ValueError, "authenticated HTTP proxy"):
            auto_login.build_proxy_config(
                server="socks5://proxy.example.com:1080",
                username="proxy-user",
                password="proxy-password",
            )

    def test_allows_unauthenticated_socks5_proxy(self):
        with patch.dict(os.environ, {}, clear=True):
            config = auto_login.build_proxy_config(server="socks5://proxy.example.com:1080")

        self.assertEqual(config["server"], "socks5://proxy.example.com:1080")
        self.assertNotIn("username", config)
        self.assertNotIn("password", config)

    def test_rejects_unsupported_proxy_scheme(self):
        with self.assertRaisesRegex(ValueError, "Unsupported proxy scheme"):
            auto_login.build_proxy_config(server="ftp://proxy.example.com:21")


class StoreTests(unittest.TestCase):
    def test_writes_current_store_schema_and_requires_force_to_update(self):
        with tempfile.TemporaryDirectory() as directory:
            store_file = Path(directory) / "store" / "accounts.json"
            legacy_file = Path(directory) / "legacy.json"
            tokens = {
                "access_token": "access-one",
                "refresh_token": "refresh-one",
                "id_token": "id-one",
                "expires_in": 3600,
            }
            claims = [
                {"exp": 2_000_000_000},
                {
                    "email": "New.User@example.com",
                    "https://api.openai.com/auth": {"chatgpt_account_id": "account-id"},
                },
            ]

            with (
                patch.object(auto_login, "STORE_FILE", store_file),
                patch.object(auto_login, "LEGACY_STORE_FILE", legacy_file),
                patch.object(auto_login, "decode_jwt_payload", side_effect=claims),
            ):
                email, alias, is_new = auto_login.add_account_to_store(tokens, "Team Primary")

            saved = json.loads(store_file.read_text(encoding="utf-8"))
            self.assertEqual((email, alias, is_new), ("New.User@example.com", "team-primary", True))
            self.assertEqual(saved["version"], 2)
            self.assertEqual(saved["activeAlias"], "team-primary")
            self.assertIsInstance(saved["accounts"], dict)
            self.assertEqual(saved["accounts"]["team-primary"]["refreshToken"], "refresh-one")

            saved["accounts"]["team-primary"].update(
                {
                    "usageCount": 7,
                    "enabled": False,
                    "tags": ["work"],
                    "notes": "Keep me",
                    "rateLimitHistory": [{"at": 1}],
                }
            )
            store_file.write_text(json.dumps(saved), encoding="utf-8")
            updated_tokens = {**tokens, "access_token": "access-two"}
            with (
                patch.object(auto_login, "STORE_FILE", store_file),
                patch.object(auto_login, "LEGACY_STORE_FILE", legacy_file),
                patch.object(auto_login, "decode_jwt_payload", side_effect=claims),
            ):
                _, skipped_alias, skipped_is_new = auto_login.add_account_to_store(
                    updated_tokens, "ignored-new-alias"
                )

            skipped = json.loads(store_file.read_text(encoding="utf-8"))["accounts"]["team-primary"]
            self.assertEqual((skipped_alias, skipped_is_new), ("team-primary", False))
            self.assertEqual(skipped["accessToken"], "access-one")

            with (
                patch.object(auto_login, "STORE_FILE", store_file),
                patch.object(auto_login, "LEGACY_STORE_FILE", legacy_file),
                patch.object(auto_login, "decode_jwt_payload", side_effect=claims),
            ):
                _, updated_alias, updated_is_new = auto_login.add_account_to_store(
                    updated_tokens, "ignored-new-alias", force=True
                )

            updated = json.loads(store_file.read_text(encoding="utf-8"))["accounts"]["team-primary"]
            self.assertEqual((updated_alias, updated_is_new), ("team-primary", False))
            self.assertEqual(updated["accessToken"], "access-two")
            self.assertEqual(updated["usageCount"], 7)
            self.assertFalse(updated["enabled"])
            self.assertEqual(updated["tags"], ["work"])
            self.assertEqual(updated["notes"], "Keep me")
            self.assertEqual(updated["rateLimitHistory"], [{"at": 1}])

    def test_migrates_legacy_array_store_idempotently(self):
        with tempfile.TemporaryDirectory() as directory:
            store_file = Path(directory) / "current" / "accounts.json"
            legacy_file = Path(directory) / "legacy.json"
            store_file.parent.mkdir(parents=True)
            store_file.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "accounts": {
                            "primary": {
                                "alias": "primary",
                                "email": "primary@example.com",
                                "accessToken": "current-access",
                                "refreshToken": "current-refresh",
                                "expiresAt": 2_000_000_000_000,
                                "usageCount": 9,
                            }
                        },
                        "activeAlias": "primary",
                        "rotationIndex": 0,
                        "lastRotation": 1,
                    }
                ),
                encoding="utf-8",
            )
            legacy_file.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "accounts": [
                            {
                                "email": "new.account@example.com",
                                "accessToken": "legacy-access",
                                "refreshToken": "legacy-refresh",
                                "expiresAt": 2_000_000_000_000,
                                "usageCount": 0,
                            }
                        ],
                        "activeIndex": 0,
                    }
                ),
                encoding="utf-8",
            )

            with (
                patch.object(auto_login, "STORE_FILE", store_file),
                patch.object(auto_login, "LEGACY_STORE_FILE", legacy_file),
                patch("builtins.print"),
            ):
                first = auto_login.load_store()
                second = auto_login.load_store()

            self.assertEqual(set(first["accounts"]), {"primary", "codex-01"})
            self.assertEqual(set(second["accounts"]), {"primary", "codex-01"})
            self.assertEqual(second["activeAlias"], "primary")
            self.assertEqual(second["accounts"]["primary"]["usageCount"], 9)

    def test_rejects_encrypted_store_without_mutating_it(self):
        with tempfile.TemporaryDirectory() as directory:
            store_file = Path(directory) / "accounts.json"
            legacy_file = Path(directory) / "legacy.json"
            encrypted = {"encrypted": True, "version": 2, "data": "ciphertext"}
            store_file.write_text(json.dumps(encrypted), encoding="utf-8")

            with (
                patch.object(auto_login, "STORE_FILE", store_file),
                patch.object(auto_login, "LEGACY_STORE_FILE", legacy_file),
            ):
                with self.assertRaisesRegex(RuntimeError, "store is encrypted"):
                    auto_login.load_store()

            self.assertEqual(json.loads(store_file.read_text(encoding="utf-8")), encrypted)


class DeactivatedAccountTests(unittest.TestCase):
    def test_detects_account_deactivated_error_page(self):
        page = Mock()
        page.url = "https://auth.openai.com/error"
        page.inner_text.return_value = (
            "Authentication Error\n"
            "You do not have an account because it has been deleted or deactivated.\n"
            "error_code: account_deactivated"
        )

        self.assertTrue(auto_login._is_account_deactivated(page))

    def test_quarantine_removes_pipe_credential_and_plaintext_store_account(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            credentials_file = root / "accounts.txt"
            deactivated_file = root / "deactivated.json"
            store_file = root / "store" / "accounts.json"
            legacy_file = root / "legacy.json"
            credentials_file.write_text(
                "|email|password|2mfa secret key|\n"
                "|deactivated@example.com|sensitive-password|SENSITIVE-TOTP|\n"
                "|active@example.com|active-password|ACTIVE-TOTP|\n",
                encoding="utf-8",
            )
            store_file.parent.mkdir(parents=True)
            store_file.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "accounts": {
                            "deactivated": {
                                "alias": "deactivated",
                                "email": "deactivated@example.com",
                                "accessToken": "access",
                                "refreshToken": "refresh",
                                "expiresAt": 2_000_000_000_000,
                                "usageCount": 0,
                            },
                            "active": {
                                "alias": "active",
                                "email": "active@example.com",
                                "accessToken": "active-access",
                                "refreshToken": "active-refresh",
                                "expiresAt": 2_000_000_000_000,
                                "usageCount": 0,
                            },
                        },
                        "activeAlias": "deactivated",
                        "rotationIndex": 0,
                        "lastRotation": 1,
                    }
                ),
                encoding="utf-8",
            )
            legacy_file.write_text(
                json.dumps(
                    {
                        "version": 2,
                        "accounts": [
                            {
                                "email": "deactivated@example.com",
                                "accessToken": "legacy-access",
                                "refreshToken": "legacy-refresh",
                                "expiresAt": 2_000_000_000_000,
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            with (
                patch.object(auto_login, "STORE_FILE", store_file),
                patch.object(auto_login, "LEGACY_STORE_FILE", legacy_file),
            ):
                result = auto_login.quarantine_deactivated_account(
                    "DEACTIVATED@example.com",
                    credentials_path=credentials_file,
                    deactivated_path=deactivated_file,
                )

            quarantine_text = deactivated_file.read_text(encoding="utf-8")
            remaining_credentials = credentials_file.read_text(encoding="utf-8")
            saved_store = json.loads(store_file.read_text(encoding="utf-8"))
            saved_legacy = json.loads(legacy_file.read_text(encoding="utf-8"))
            self.assertTrue(result["credentialRemoved"])
            self.assertEqual(result["storeAlias"], "deactivated")
            self.assertIn("deactivated@example.com", quarantine_text.lower())
            self.assertNotIn("sensitive-password", quarantine_text)
            self.assertNotIn("SENSITIVE-TOTP", quarantine_text)
            self.assertNotIn("deactivated@example.com", remaining_credentials)
            self.assertIn("active@example.com", remaining_credentials)
            self.assertNotIn("deactivated", saved_store["accounts"])
            self.assertEqual(saved_store["activeAlias"], "active")
            self.assertEqual(saved_legacy["accounts"], [])
            saved_backup = json.loads(
                store_file.with_suffix(".json.bak").read_text(encoding="utf-8")
            )
            self.assertNotIn("deactivated", saved_backup["accounts"])
            self.assertIn("active", saved_backup["accounts"])
            if os.name != "nt":
                self.assertEqual(deactivated_file.stat().st_mode & 0o077, 0)
                self.assertEqual(credentials_file.stat().st_mode & 0o077, 0)

    def test_quarantine_removes_json_credential_and_updates_record_idempotently(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            credentials_file = root / "credentials.json"
            deactivated_file = root / "deactivated.json"
            credentials_file.write_text(
                json.dumps(
                    {
                        "defaults": {"chatgpt_password": "shared-password"},
                        "accounts": [
                            {
                                "email": "deactivated@example.com",
                                "chatgpt_password": "account-password",
                            },
                            {"email": "active@example.com"},
                        ],
                    }
                ),
                encoding="utf-8",
            )

            first = auto_login.record_deactivated_account(
                "deactivated@example.com", deactivated_file
            )
            second = auto_login.record_deactivated_account(
                "DEACTIVATED@example.com", deactivated_file
            )
            removed = auto_login.remove_credential_by_email(
                credentials_file, "deactivated@example.com"
            )

            record = json.loads(deactivated_file.read_text(encoding="utf-8"))
            credentials = json.loads(credentials_file.read_text(encoding="utf-8"))
            self.assertEqual(first, second)
            self.assertTrue(removed)
            self.assertEqual(len(record["accounts"]), 1)
            self.assertEqual(record["accounts"][0]["detections"], 2)
            self.assertEqual(
                [account["email"] for account in credentials["accounts"]],
                ["active@example.com"],
            )
            self.assertEqual(credentials["defaults"]["chatgpt_password"], "shared-password")

    def test_pending_cleanup_is_not_skipped_and_retries_later(self):
        with tempfile.TemporaryDirectory() as directory:
            deactivated_file = Path(directory) / "deactivated.json"
            auto_login.record_deactivated_account("pending@example.com", deactivated_file)

            with (
                patch.object(auto_login, "remove_credential_by_email", return_value=True),
                patch.object(
                    auto_login,
                    "remove_store_account_by_email",
                    side_effect=RuntimeError("store locked"),
                ),
            ):
                failures = auto_login.retry_pending_deactivated_cleanup(
                    deactivated_path=deactivated_file
                )

            self.assertEqual(len(failures), 1)
            self.assertEqual(
                auto_login.load_deactivated_emails(deactivated_file),
                {"pending@example.com"},
            )

            with (
                patch.object(auto_login, "remove_credential_by_email", return_value=False),
                patch.object(auto_login, "remove_store_account_by_email", return_value=None),
            ):
                failures = auto_login.retry_pending_deactivated_cleanup(
                    deactivated_path=deactivated_file
                )

            self.assertEqual(failures, [])
            self.assertEqual(
                auto_login.load_deactivated_emails(deactivated_file),
                {"pending@example.com"},
            )

    def test_record_sanitizes_existing_quarantine_content(self):
        with tempfile.TemporaryDirectory() as directory:
            deactivated_file = Path(directory) / "deactivated.json"
            deactivated_file.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "privateConfig": "must-be-removed",
                        "accounts": [
                            {
                                "email": "deactivated@example.com",
                                "password": "must-be-removed",
                                "accessToken": "must-be-removed",
                                "detections": "invalid",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            auto_login.record_deactivated_account("deactivated@example.com", deactivated_file)

            serialized = deactivated_file.read_text(encoding="utf-8")
            record = json.loads(serialized)
            self.assertNotIn("must-be-removed", serialized)
            self.assertNotIn("privateConfig", record)
            self.assertEqual(set(record), {"version", "accounts"})
            self.assertEqual(record["accounts"][0]["detections"], 2)

    def test_rejects_deactivated_file_that_collides_with_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            credentials_file = Path(directory) / "credentials.json"
            original = json.dumps(
                {
                    "accounts": [
                        {
                            "email": "deactivated@example.com",
                            "chatgpt_password": "must-be-preserved",
                        }
                    ]
                }
            )
            credentials_file.write_text(original, encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "must be separate"):
                auto_login.quarantine_deactivated_account(
                    "deactivated@example.com",
                    credentials_path=credentials_file,
                    deactivated_path=credentials_file,
                )

            self.assertEqual(credentials_file.read_text(encoding="utf-8"), original)

    def test_rejects_hard_link_alias_of_credentials_as_deactivated_file(self):
        if os.name == "nt":
            self.skipTest("hard-link path collision assertion")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            credentials_file = root / "credentials.json"
            deactivated_file = root / "deactivated-hard-link.json"
            original = json.dumps(
                {
                    "accounts": [
                        {
                            "email": "deactivated@example.com",
                            "chatgpt_password": "must-be-preserved",
                        }
                    ]
                }
            )
            credentials_file.write_text(original, encoding="utf-8")
            os.link(credentials_file, deactivated_file)

            with self.assertRaisesRegex(ValueError, "must be separate"):
                auto_login.quarantine_deactivated_account(
                    "deactivated@example.com",
                    credentials_path=credentials_file,
                    deactivated_path=deactivated_file,
                )

            self.assertEqual(credentials_file.read_text(encoding="utf-8"), original)

    def test_encrypted_store_does_not_block_credential_quarantine(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            credentials_file = root / "credentials.json"
            deactivated_file = root / "deactivated.json"
            store_file = root / "store.json"
            credentials_file.write_text(
                json.dumps(
                    {
                        "accounts": [
                            {
                                "email": "deactivated@example.com",
                                "chatgpt_password": "must-be-removed",
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            store_file.write_text(
                json.dumps({"version": 3, "encrypted": True, "payload": "ciphertext"}),
                encoding="utf-8",
            )
            store_file.with_suffix(".json.bak").write_text(
                json.dumps(
                    {
                        "version": 2,
                        "accounts": {
                            "deactivated": {
                                "email": "deactivated@example.com",
                                "accessToken": "must-be-removed",
                            },
                            "active": {
                                "email": "active@example.com",
                                "accessToken": "must-be-preserved",
                            },
                        },
                        "activeAlias": "deactivated",
                    }
                ),
                encoding="utf-8",
            )

            with (
                patch.object(auto_login, "STORE_FILE", store_file),
                patch.object(auto_login, "LEGACY_STORE_FILE", root / "legacy.json"),
            ):
                auto_login.quarantine_deactivated_account(
                    "deactivated@example.com",
                    credentials_path=credentials_file,
                    deactivated_path=deactivated_file,
                )

            self.assertNotIn(
                "deactivated@example.com", credentials_file.read_text(encoding="utf-8")
            )
            self.assertEqual(
                auto_login.load_deactivated_emails(deactivated_file),
                {"deactivated@example.com"},
            )
            backup = json.loads(store_file.with_suffix(".json.bak").read_text(encoding="utf-8"))
            self.assertNotIn("deactivated", backup["accounts"])
            self.assertIn("active", backup["accounts"])

    def test_credential_removal_preserves_existing_parent_directory_mode(self):
        if os.name == "nt":
            self.skipTest("POSIX permission assertion")
        with tempfile.TemporaryDirectory() as directory:
            credentials_dir = Path(directory) / "shared"
            credentials_dir.mkdir(mode=0o755)
            credentials_file = credentials_dir / "accounts.txt"
            credentials_file.write_text(
                "|email|password|2mfa secret key|\n|deactivated@example.com|password|SECRET|\n",
                encoding="utf-8",
            )
            os.chmod(credentials_dir, 0o755)

            self.assertTrue(
                auto_login.remove_credential_by_email(credentials_file, "deactivated@example.com")
            )

            self.assertEqual(credentials_dir.stat().st_mode & 0o777, 0o755)

    def test_cmd_login_skips_email_already_in_deactivated_record(self):
        account = {
            "email": "deactivated@example.com",
            "chatgpt_password": "password",
        }
        with tempfile.TemporaryDirectory() as directory:
            deactivated_file = Path(directory) / "deactivated.json"
            auto_login.record_deactivated_account(account["email"], deactivated_file)
            with (
                patch.object(auto_login, "load_store", return_value={"accounts": {}}),
                patch.object(auto_login, "login_account") as login,
                patch("builtins.print"),
            ):
                result = auto_login.cmd_login(
                    [account],
                    {},
                    deactivated_path=deactivated_file,
                )

        self.assertEqual(result, (0, 0))
        login.assert_not_called()


class CommandLoginTests(unittest.TestCase):
    def test_skips_existing_email_before_browser_login(self):
        account = {
            "email": "Existing@Example.com",
            "chatgpt_password": "password",
        }
        store = {
            "accounts": {
                "codex-01": {
                    "alias": "codex-01",
                    "email": "existing@example.com",
                }
            }
        }

        with (
            patch.object(auto_login, "load_store", return_value=store),
            patch.object(auto_login, "login_account") as login,
            patch("builtins.print"),
        ):
            result = auto_login.cmd_login([account], {})

        self.assertEqual(result, (0, 0))
        login.assert_not_called()

    def test_force_logs_in_existing_email(self):
        account = {
            "email": "existing@example.com",
            "chatgpt_password": "password",
        }

        with (
            patch.object(auto_login, "load_store") as load_store,
            patch.object(auto_login, "login_account", return_value=account["email"]) as login,
            patch("builtins.print"),
        ):
            result = auto_login.cmd_login([account], {}, force=True)

        self.assertEqual(result, (1, 0))
        load_store.assert_not_called()
        self.assertTrue(login.call_args.kwargs["force"])

    def test_dashboard_auth_url_does_not_read_python_store(self):
        account = {
            "email": "existing@example.com",
            "chatgpt_password": "password",
        }

        with (
            patch.object(auto_login, "load_store") as load_store,
            patch.object(auto_login, "login_account", return_value=account["email"]) as login,
            patch("builtins.print"),
        ):
            result = auto_login.cmd_login(
                [account], {}, auth_url="http://localhost:1455/auth/callback"
            )

        self.assertEqual(result, (1, 0))
        load_store.assert_not_called()
        self.assertTrue(login.call_args.kwargs["external_callback"])


class BrowserElementTests(unittest.TestCase):
    class FakeInput:
        def __init__(self, *, type_persists=True, fill_persists=True, evaluate_persists=True):
            self.value = ""
            self.type_persists = type_persists
            self.fill_persists = fill_persists
            self.evaluate_persists = evaluate_persists
            self.fill_calls = []
            self.evaluate_calls = []

        def click(self):
            pass

        def press(self, _key):
            pass

        def type(self, value, *, delay):
            if self.type_persists:
                self.value = value

        def fill(self, value):
            self.fill_calls.append(value)
            if self.fill_persists:
                self.value = value

        def input_value(self):
            return self.value

        def evaluate(self, expression, value=None):
            self.evaluate_calls.append((expression, value))
            if value is not None and self.evaluate_persists:
                self.value = value
            return self.value

    def test_human_type_keeps_keyboard_input_when_it_persists(self):
        element = self.FakeInput()

        auto_login._human_type(element, "secret")

        self.assertEqual(element.value, "secret")
        self.assertEqual(element.fill_calls, [""])
        self.assertEqual(element.evaluate_calls, [])

    def test_human_type_falls_back_to_fill_when_keyboard_input_is_lost(self):
        element = self.FakeInput(type_persists=False)

        auto_login._human_type(element, "secret")

        self.assertEqual(element.value, "secret")
        self.assertEqual(element.fill_calls, ["", "secret"])
        self.assertEqual(element.evaluate_calls, [])

    def test_human_type_uses_native_setter_when_fill_is_not_retained(self):
        element = self.FakeInput(type_persists=False, fill_persists=False)

        auto_login._human_type(element, "secret")

        self.assertEqual(element.value, "secret")
        self.assertEqual(len(element.evaluate_calls), 1)

    def test_human_type_fails_without_exposing_value_when_input_cannot_persist(self):
        element = self.FakeInput(
            type_persists=False,
            fill_persists=False,
            evaluate_persists=False,
        )

        with self.assertRaisesRegex(RuntimeError, "did not persist") as error:
            auto_login._human_type(element, "sensitive-secret")

        self.assertNotIn("sensitive-secret", str(error.exception))

    def test_human_type_accepts_browser_formatted_phone_value(self):
        class FormattedPhoneInput(self.FakeInput):
            def type(self, value, *, delay):
                self.value = "(555) 000-6961"

        element = FormattedPhoneInput()

        auto_login._human_type(
            element,
            "+15550006961",
            verification="phone",
        )

        self.assertEqual(element.fill_calls, [""])

    def test_phone_verification_rejects_unrelated_number(self):
        self.assertFalse(
            auto_login._input_value_matches(
                "(646) 555-1234",
                "+12125551234",
                "phone",
            )
        )

    def test_wait_and_click_requires_an_element(self):
        page = Mock()
        page.wait_for_selector.return_value = None

        with self.assertRaisesRegex(RuntimeError, "Element did not appear"):
            auto_login._wait_and_click(page, "button")

    def test_wait_and_click_clicks_the_resolved_element(self):
        page = Mock()
        element = Mock()
        page.wait_for_selector.return_value = element

        returned = auto_login._wait_and_click(page, "button", timeout=123)

        page.wait_for_selector.assert_called_once_with("button", timeout=123)
        element.click.assert_called_once_with()
        self.assertIs(returned, element)

    def test_first_visible_skips_hidden_duplicate_matches(self):
        page = Mock()
        hidden = Mock()
        visible = Mock()
        hidden.is_visible.return_value = False
        visible.is_visible.return_value = True
        page.query_selector_all.return_value = [hidden, visible]

        self.assertIs(auto_login._first_visible(page, ["input[name='code']"]), visible)
        page.query_selector.assert_not_called()


class TotpTests(unittest.TestCase):
    def test_matches_rfc_6238_sha1_vector(self):
        secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"  # gitleaks:allow - RFC 6238 test vector
        self.assertEqual(auto_login.generate_totp(secret, timestamp=59), "287082")

    def test_accepts_grouped_base32_secret(self):
        compact = auto_login.generate_totp("JBSWY3DPEHPK3PXP", timestamp=1234567890)
        grouped = auto_login.generate_totp("JBSW Y3DP-EHPK 3PXP", timestamp=1234567890)
        self.assertEqual(grouped, compact)

    def test_generic_mfa_url_without_authenticator_ui_is_not_a_totp_challenge(self):
        page = Mock()
        page.url = "https://auth.openai.com/mfa"
        page.inner_text.return_value = "Verify your identity"
        page.query_selector.return_value = None

        self.assertFalse(auto_login._is_totp_challenge(page))

    def test_visible_authenticator_method_is_a_totp_challenge(self):
        page = Mock()
        page.url = "https://auth.openai.com/mfa"
        page.inner_text.return_value = "Choose a verification method"
        method = Mock()
        method.is_visible.return_value = True
        page.query_selector.side_effect = lambda selector: (
            method if "Authenticator app" in selector else None
        )

        self.assertTrue(auto_login._is_totp_challenge(page))

    def test_existing_code_widget_on_totp_mfa_url_is_a_totp_challenge(self):
        page = Mock()
        page.url = "https://auth.openai.com/mfa/totp"
        page.inner_text.return_value = "Enter your verification code"
        code_input = Mock()
        code_input.is_visible.return_value = True
        page.query_selector_all.side_effect = lambda selector: (
            [code_input] if "autocomplete='one-time-code'" in selector else []
        )
        page.query_selector.return_value = None

        self.assertTrue(auto_login._is_totp_challenge(page))

    def test_email_code_widget_on_mfa_url_is_not_a_totp_challenge(self):
        page = Mock()
        page.url = "https://auth.openai.com/mfa"
        page.inner_text.return_value = "We sent to your email. Check your inbox."
        code_input = Mock()
        code_input.is_visible.return_value = True
        page.query_selector_all.side_effect = lambda selector: (
            [code_input] if "autocomplete='one-time-code'" in selector else []
        )
        page.query_selector.return_value = None

        self.assertFalse(auto_login._is_totp_challenge(page))

    def test_selects_authenticator_after_try_another_method(self):
        page = Mock()
        other_method = Mock()
        authenticator_method = Mock()
        code_input = Mock()
        with (
            patch.object(
                auto_login,
                "_first_visible",
                side_effect=[None, other_method],
            ),
            patch.object(
                auto_login,
                "_wait_for_visible",
                return_value=authenticator_method,
            ),
            patch.object(
                auto_login,
                "_wait_for_totp_code_input",
                side_effect=[None, code_input],
            ),
        ):
            self.assertTrue(auto_login._select_totp_method(page))

        other_method.click.assert_called_once_with()
        authenticator_method.click.assert_called_once_with()

    def test_authenticator_method_wins_over_existing_email_code_input(self):
        page = Mock()
        authenticator_method = Mock()
        code_input = Mock()
        with (
            patch.object(auto_login, "_first_visible", return_value=authenticator_method),
            patch.object(auto_login, "_wait_for_totp_code_input", return_value=code_input),
        ):
            self.assertTrue(auto_login._select_totp_method(page))

        authenticator_method.click.assert_called_once_with()

    def test_totp_allows_code_widget_to_auto_submit(self):
        page = Mock()
        attempted = set()
        with (
            patch.object(auto_login, "_is_totp_challenge", side_effect=[True, False]),
            patch.object(auto_login, "_select_totp_method", return_value=True),
            patch.object(auto_login, "_fill_verification_code"),
            patch.object(auto_login, "_submit_verification_form", return_value=False),
            patch.object(auto_login.time, "time", return_value=100),
            patch("builtins.print"),
        ):
            self.assertTrue(auto_login.handle_totp_challenge(page, "JBSWY3DPEHPK3PXP", attempted))

        page.wait_for_timeout.assert_called_once_with(5000)

    def test_rejected_auto_submit_totp_returns_false_for_retry(self):
        page = Mock()
        attempted = set()
        with (
            patch.object(auto_login, "_is_totp_challenge", return_value=True),
            patch.object(auto_login, "_select_totp_method", return_value=True),
            patch.object(auto_login, "_fill_verification_code"),
            patch.object(auto_login, "_submit_verification_form", return_value=False),
            patch.object(auto_login.time, "time", return_value=100),
            patch("builtins.print"),
        ):
            self.assertFalse(auto_login.handle_totp_challenge(page, "JBSWY3DPEHPK3PXP", attempted))

    def test_rejected_totp_waits_for_a_distinct_counter_before_retry(self):
        class FakePage:
            def wait_for_timeout(self, _milliseconds):
                pass

        attempted = set()
        with (
            patch.object(auto_login, "_is_totp_challenge", return_value=True),
            patch.object(auto_login, "_select_totp_method", return_value=True),
            patch.object(auto_login, "_fill_verification_code"),
            patch.object(auto_login, "_submit_verification_form"),
            patch.object(auto_login.time, "time", side_effect=[100, 100, 100, 121, 121]),
            patch("builtins.print"),
        ):
            self.assertFalse(
                auto_login.handle_totp_challenge(FakePage(), "JBSWY3DPEHPK3PXP", attempted)
            )
            self.assertFalse(
                auto_login.handle_totp_challenge(FakePage(), "JBSWY3DPEHPK3PXP", attempted)
            )

        self.assertEqual(attempted, {3, 4})


class SmsPoolTests(unittest.TestCase):
    def test_does_not_purchase_number_without_phone_challenge(self):
        with (
            patch.object(auto_login, "_first_visible", return_value=None),
            patch.object(auto_login, "purchase_smspool_number") as purchase,
        ):
            self.assertFalse(auto_login.handle_smspool_phone_challenge(object()))
        purchase.assert_not_called()

    def test_phone_validation_error_wins_over_numeric_input_match(self):
        class FakePage:
            def inner_text(self, _selector):
                return "Phone number is not valid."

            def wait_for_timeout(self, _milliseconds):
                pass

        with patch.object(auto_login, "_first_visible", return_value=object()):
            code_input, error = auto_login._wait_for_sms_code_or_phone_error(
                FakePage(), timeout_ms=1
            )
        self.assertIsNone(code_input)
        self.assertEqual(error, "phone number is not valid")

    def test_deactivation_after_phone_submission_is_terminal_and_refunds_order(self):
        class FakePage:
            url = "https://auth.openai.com/error"

            def inner_text(self, _selector):
                return "error_code: account_deactivated"

            def wait_for_timeout(self, _milliseconds):
                pass

        with (
            patch.dict(os.environ, {"SMSPOOL_API_KEY": "api-key"}),
            patch.object(auto_login, "_first_visible", return_value=object()),
            patch.object(auto_login, "_human_type"),
            patch.object(auto_login, "_submit_verification_form"),
            patch.object(
                auto_login,
                "purchase_smspool_number",
                return_value={"order_id": "ORDER001", "phone": "+15550000001"},
            ),
            patch.object(auto_login, "cancel_smspool_order", return_value=True) as cancel,
        ):
            with self.assertRaises(auto_login.AccountDeactivatedError):
                auto_login.handle_smspool_phone_challenge(
                    FakePage(), email="deactivated@example.com"
                )

        cancel.assert_called_once_with("ORDER001", "api-key")

    def test_normalizes_purchase_number(self):
        self.assertEqual(
            auto_login._normalize_smspool_phone({"cc": "1", "phonenumber": "234567890"}),
            "+1234567890",
        )

    def test_purchase_uses_openai_service_defaults(self):
        response = {
            "success": 1,
            "number": 1234567890,
            "order_id": "ABCDEFGH",
            "expires_in": 1200,
        }
        with patch.object(auto_login, "smspool_api_request", return_value=response) as request:
            order = auto_login.purchase_smspool_number("api-key")

        self.assertEqual(order["order_id"], "ABCDEFGH")
        fields = request.call_args.args[2]
        self.assertEqual(fields["service"], 671)
        self.assertEqual(fields["quantity"], 1)
        self.assertEqual(fields["activation_type"], "SMS")

    def test_polling_reads_code_from_active_orders(self):
        responses = [
            [{"order_code": "ABCDEFGH", "code": "0", "status": "pending"}],
            [{"order_code": "ABCDEFGH", "code": "123456", "status": "complete"}],
        ]
        with (
            patch.object(auto_login, "smspool_api_request", side_effect=responses),
            patch.object(auto_login.time, "sleep"),
        ):
            code = auto_login.wait_for_smspool_sms(
                "ABCDEFGH", "api-key", timeout_seconds=10, poll_interval=0
            )
        self.assertEqual(code, "123456")

    def test_polling_stops_on_cancelled_order(self):
        responses = [[], [], {"status": 5}]
        with (
            patch.object(auto_login, "smspool_api_request", side_effect=responses),
            patch.object(auto_login.time, "sleep"),
        ):
            with self.assertRaisesRegex(RuntimeError, "cancelled"):
                auto_login.wait_for_smspool_sms(
                    "ABCDEFGH", "api-key", timeout_seconds=10, poll_interval=0
                )

    def test_cancel_retries_when_smspool_temporarily_rejects_it(self):
        responses = [
            RuntimeError("Your order cannot be cancelled yet, please try again later."),
            {"success": 1},
        ]
        with (
            patch.object(auto_login, "smspool_api_request", side_effect=responses) as request,
            patch.object(auto_login.time, "sleep"),
        ):
            self.assertTrue(auto_login.cancel_smspool_order("ABCDEFGH", "api-key"))
        self.assertEqual(request.call_count, 2)

    def test_phone_challenge_refunds_after_timeout_and_requests_restart(self):
        class FakePage:
            def wait_for_timeout(self, _milliseconds):
                pass

        first_input = object()
        attempted_numbers = set()
        with (
            patch.dict(os.environ, {"SMSPOOL_API_KEY": "api-key"}),
            patch.object(auto_login, "_first_visible", return_value=first_input),
            patch.object(auto_login, "_human_type"),
            patch.object(auto_login, "_submit_verification_form"),
            patch.object(
                auto_login,
                "_wait_for_sms_code_or_phone_error",
                return_value=(object(), None),
            ),
            patch.object(
                auto_login,
                "purchase_smspool_number",
                return_value={"order_id": "ORDER001", "phone": "+15550000001"},
            ),
            patch.object(
                auto_login,
                "wait_for_smspool_sms",
                side_effect=TimeoutError("timed out"),
            ) as wait_for_sms,
            patch.object(auto_login, "cancel_smspool_order", return_value=True) as cancel,
        ):
            with self.assertRaises(auto_login.SmsPoolRetryRequired):
                auto_login.handle_smspool_phone_challenge(
                    FakePage(),
                    {"timeout_seconds": 300},
                    attempted_numbers,
                )

        self.assertEqual(cancel.call_args.args[0], "ORDER001")
        self.assertEqual(attempted_numbers, {"+15550000001"})
        self.assertEqual(
            wait_for_sms.call_args.kwargs["timeout_seconds"],
            auto_login.SMSPOOL_DEFAULT_TIMEOUT,
        )

    def test_login_restarts_oauth_and_keeps_attempted_phone_numbers(self):
        calls = 0

        def fake_login(*args, **kwargs):
            nonlocal calls
            calls += 1
            attempted = kwargs["smspool_attempted_numbers"]
            if calls == 1:
                attempted.add("+15550000001")
                raise auto_login.SmsPoolRetryRequired("retry")
            self.assertIn("+15550000001", attempted)
            return args[0]

        account = {
            "email": "one@example.com",
            "chatgpt_password": "password",
        }
        with (
            patch.object(auto_login, "login_account", side_effect=fake_login),
            patch.object(auto_login, "load_store", return_value={"accounts": {}}),
            patch.object(auto_login.time, "sleep"),
        ):
            success, failed = auto_login.cmd_login([account], {})

        self.assertEqual((success, failed), (1, 0))
        self.assertEqual(calls, 2)

    def test_invalid_phone_is_refunded_without_waiting_for_sms(self):
        class FakePage:
            pass

        with (
            patch.dict(os.environ, {"SMSPOOL_API_KEY": "api-key"}),
            patch.object(auto_login, "_first_visible", return_value=object()),
            patch.object(auto_login, "_human_type"),
            patch.object(auto_login, "_submit_verification_form"),
            patch.object(
                auto_login,
                "_wait_for_sms_code_or_phone_error",
                return_value=(None, "phone number is not valid"),
            ),
            patch.object(
                auto_login,
                "purchase_smspool_number",
                return_value={"order_id": "ORDER001", "phone": "+15550000001"},
            ),
            patch.object(auto_login, "cancel_smspool_order", return_value=True) as cancel,
            patch.object(auto_login, "wait_for_smspool_sms") as wait_for_sms,
            patch.object(auto_login, "_save_debug_screenshot_page"),
        ):
            with self.assertRaisesRegex(
                auto_login.SmsPoolRetryRequired, "phone number is not valid"
            ):
                auto_login.handle_smspool_phone_challenge(FakePage())

        cancel.assert_called_once_with("ORDER001", "api-key")
        wait_for_sms.assert_not_called()

    def test_browser_error_after_purchase_still_refunds_order(self):
        with (
            patch.dict(os.environ, {"SMSPOOL_API_KEY": "api-key"}),
            patch.object(auto_login, "_first_visible", return_value=object()),
            patch.object(
                auto_login,
                "purchase_smspool_number",
                return_value={"order_id": "ORDER001", "phone": "+15550000001"},
            ),
            patch.object(auto_login, "_human_type", side_effect=RuntimeError("detached")),
            patch.object(auto_login, "cancel_smspool_order", return_value=True) as cancel,
        ):
            with self.assertRaisesRegex(RuntimeError, "detached"):
                auto_login.handle_smspool_phone_challenge(object())
        cancel.assert_called_once_with("ORDER001", "api-key")

    def test_terminal_order_restarts_without_cancelling_twice(self):
        class FakePage:
            pass

        with (
            patch.dict(os.environ, {"SMSPOOL_API_KEY": "api-key"}),
            patch.object(auto_login, "_first_visible", return_value=object()),
            patch.object(auto_login, "_human_type"),
            patch.object(auto_login, "_submit_verification_form"),
            patch.object(
                auto_login,
                "_wait_for_sms_code_or_phone_error",
                return_value=(object(), None),
            ),
            patch.object(
                auto_login,
                "purchase_smspool_number",
                return_value={"order_id": "ORDER001", "phone": "+15550000001"},
            ),
            patch.object(
                auto_login,
                "wait_for_smspool_sms",
                side_effect=auto_login.SmsPoolOrderEnded("refunded"),
            ),
            patch.object(auto_login, "cancel_smspool_order") as cancel,
        ):
            with self.assertRaises(auto_login.SmsPoolRetryRequired):
                auto_login.handle_smspool_phone_challenge(FakePage())
        cancel.assert_not_called()


if __name__ == "__main__":
    unittest.main()
