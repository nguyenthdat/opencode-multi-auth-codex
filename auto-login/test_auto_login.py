import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


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
        self.assertEqual(
            [account["password"] for account in unique], ["first", "third"]
        )


class EnvironmentTests(unittest.TestCase):
    def test_dotenv_loads_key_without_overriding_exported_value(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env"
            env_file.write_text(
                "SMSPOOL_API_KEY=from-file\nGITHUB_TOKEN=must-not-load\n",
                encoding="utf-8",
            )
            env_file.chmod(0o600)

            with patch.dict(os.environ, {"SMSPOOL_API_KEY": "from-shell"}, clear=True):
                self.assertTrue(auto_login.load_environment(env_file))
                self.assertEqual(os.environ["SMSPOOL_API_KEY"], "from-shell")

            with patch.dict(os.environ, {}, clear=True):
                self.assertTrue(auto_login.load_environment(env_file))
                self.assertEqual(os.environ["SMSPOOL_API_KEY"], "from-file")
                self.assertNotIn("GITHUB_TOKEN", os.environ)


class TotpTests(unittest.TestCase):
    def test_matches_rfc_6238_sha1_vector(self):
        secret = (
            "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"  # gitleaks:allow - RFC 6238 test vector
        )
        self.assertEqual(auto_login.generate_totp(secret, timestamp=59), "287082")

    def test_accepts_grouped_base32_secret(self):
        compact = auto_login.generate_totp("JBSWY3DPEHPK3PXP", timestamp=1234567890)
        grouped = auto_login.generate_totp("JBSW Y3DP-EHPK 3PXP", timestamp=1234567890)
        self.assertEqual(grouped, compact)

    def test_rejected_totp_waits_for_a_distinct_counter_before_retry(self):
        class FakePage:
            def wait_for_timeout(self, _milliseconds):
                pass

        attempted = set()
        with (
            patch.object(auto_login, "_is_totp_challenge", return_value=True),
            patch.object(auto_login, "_fill_verification_code"),
            patch.object(auto_login, "_submit_verification_form"),
            patch.object(
                auto_login.time, "time", side_effect=[100, 100, 100, 121, 121]
            ),
            patch("builtins.print"),
        ):
            self.assertFalse(
                auto_login.handle_totp_challenge(
                    FakePage(), "JBSWY3DPEHPK3PXP", attempted
                )
            )
            self.assertFalse(
                auto_login.handle_totp_challenge(
                    FakePage(), "JBSWY3DPEHPK3PXP", attempted
                )
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

    def test_normalizes_purchase_number(self):
        self.assertEqual(
            auto_login._normalize_smspool_phone(
                {"cc": "1", "phonenumber": "234567890"}
            ),
            "+1234567890",
        )

    def test_purchase_uses_openai_service_defaults(self):
        response = {
            "success": 1,
            "number": 1234567890,
            "order_id": "ABCDEFGH",
            "expires_in": 1200,
        }
        with patch.object(
            auto_login, "smspool_api_request", return_value=response
        ) as request:
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
            patch.object(
                auto_login, "smspool_api_request", side_effect=responses
            ) as request,
            patch.object(auto_login.time, "sleep"),
        ):
            self.assertTrue(auto_login.cancel_smspool_order("ABCDEFGH", "api-key"))
        self.assertEqual(request.call_count, 2)

    def test_phone_challenge_refunds_after_sixty_seconds_and_requests_restart(self):
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
            patch.object(
                auto_login, "cancel_smspool_order", return_value=True
            ) as cancel,
        ):
            with self.assertRaises(auto_login.SmsPoolRetryRequired):
                auto_login.handle_smspool_phone_challenge(
                    FakePage(),
                    {"timeout_seconds": 300},
                    attempted_numbers,
                )

        self.assertEqual(cancel.call_args.args[0], "ORDER001")
        self.assertEqual(attempted_numbers, {"+15550000001"})
        self.assertEqual(wait_for_sms.call_args.kwargs["timeout_seconds"], 60)

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
            patch.object(
                auto_login, "cancel_smspool_order", return_value=True
            ) as cancel,
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
            patch.object(
                auto_login, "_human_type", side_effect=RuntimeError("detached")
            ),
            patch.object(
                auto_login, "cancel_smspool_order", return_value=True
            ) as cancel,
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
