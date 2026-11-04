"""Sign-in boundary checks. No live accounts or third-party login requests are used."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from types import SimpleNamespace
from http.cookies import SimpleCookie

from hsreplay_auth import SessionVault, HSReplayAuth, collection_identity, process_alive


class IdentityTests(unittest.TestCase):
    def test_identity_is_only_captured_from_the_official_constructed_api(self):
        url = 'https://hsreplay.net/api/v1/collection/?region=5&account_lo=12345&type=CONSTRUCTED'
        self.assertEqual(collection_identity(url), {'account': '12345', 'region': 5})
        self.assertIsNone(collection_identity(url.replace('hsreplay.net', 'hsreplay.net.attacker.example')))
        self.assertIsNone(collection_identity(url.replace('https:', 'http:')))
        self.assertIsNone(collection_identity(url.replace('CONSTRUCTED', 'MERCENARIES')))
        self.assertIsNone(collection_identity(url.replace('12345', 'invalid')))


@unittest.skipUnless(os.name == 'nt', 'Windows DPAPI is used for this Windows application')
class SessionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)
        self.vault = SessionVault(self.path)
        self.session = {'account': '12345', 'region': 5, 'cookie': 'sessionid=private-test-token', 'userAgent': 'test-browser'}
        self.store = Mock(data_dir=self.path)
        self.store.load_hsreplay_snapshot.return_value = None
        self.auth = HSReplayAuth(self.store)

    def tearDown(self):
        self.temp.cleanup()

    def test_session_is_encrypted_and_can_be_reused_after_restart(self):
        self.vault.save(self.session)
        self.assertNotIn(b'private-test-token', self.vault.path.read_bytes())
        self.assertEqual(SessionVault(self.path).load(), self.session)
        self.assertNotIn('cookie', self.auth.status())
        self.assertNotIn('account', self.auth.status())

    def test_sync_uses_saved_identity_without_frontend_credentials(self):
        self.vault.save(self.session)
        snapshot = {'collection': {'7': [2, 0, 0, 0]}, 'meta': {'importedAt': '2026-10-26T08:00:00Z'}}
        self.store.sync_hsreplay.return_value = snapshot
        self.assertEqual(self.auth.sync(), snapshot)
        self.store.sync_hsreplay.assert_called_once_with('12345', 5, 'sessionid=private-test-token', 'test-browser')
        self.assertEqual(self.auth.status()['lastSyncedAt'], snapshot['meta']['importedAt'])

    def test_expired_auth_prompts_login_and_does_not_report_new_sync_time(self):
        self.vault.save(self.session)
        self.store.sync_hsreplay.side_effect = ValueError('HSReplay 登录已失效，请重新登录。')
        with self.assertRaises(ValueError):
            self.auth.sync()
        self.assertEqual(self.auth.status()['phase'], 'expired')
        self.assertNotIn('lastSyncedAt', self.auth.status())

    def test_login_launch_only_contains_the_profile_directory(self):
        with patch('hsreplay_auth.subprocess.Popen') as launch:
            launch.return_value.poll.return_value = None
            self.auth.begin()
            args = launch.call_args.args[0]
            self.assertIn('--data-dir', args)
            self.assertIn(str(self.path), args)
            self.assertNotIn('private-test-token', ' '.join(args))

    def test_disconnect_removes_saved_credentials_and_resets_next_browser_session(self):
        self.vault.save(self.session)
        self.auth.disconnect()
        self.assertFalse(self.vault.path.exists())
        self.assertTrue((self.path / 'hsreplay-logout.pending').exists())
        self.assertEqual(self.auth.status()['phase'], 'disconnected')

    def test_another_live_login_window_is_not_cancelled_by_a_second_server(self):
        self.vault.write_status('waiting', 'login in progress')
        self.assertTrue(process_alive(os.getpid()))
        self.assertEqual(self.auth.status()['phase'], 'waiting')

    def test_official_window_capture_saves_session_without_syncing_collection(self):
        import webview
        from hsreplay_login import run_login
        class Event:
            def __init__(self): self.handlers = []
            def __iadd__(self, handler): self.handlers.append(handler); return self
            def fire(self, *args):
                for handler in self.handlers: handler(*args)
        window = Mock()
        window.events = SimpleNamespace(request_sent=Event(), loaded=Event(), closed=Event())
        window.get_current_url.return_value = 'https://hsreplay.net/collection/mine/'
        cookies = SimpleCookie('sessionid=private-test-token; csrftoken=test-csrf')
        for morsel in cookies.values(): morsel['domain'] = '.hsreplay.net'
        window.get_cookies.return_value = [cookies]
        window.evaluate_js.return_value = 'test-browser'
        window.destroy.side_effect = lambda: window.events.closed.fire()
        def start(worker, **options):
            self.assertFalse(options['private_mode'])
            window.events.loaded.fire()
            window.events.request_sent.fire(SimpleNamespace(
                url='https://hsreplay.net/api/v1/collection/?region=5&account_lo=12345&type=CONSTRUCTED',
                headers={'User-Agent': 'test-browser'}))
            worker()
        with patch('webview.create_window', return_value=window), patch('webview.start', side_effect=start), patch('webview.settings', {'OPEN_EXTERNAL_LINKS_IN_BROWSER': True}):
            run_login(self.path)
        self.store.replace.assert_not_called()
        self.assertEqual(self.vault.load()['cookie'], 'sessionid=private-test-token; csrftoken=test-csrf')
        self.assertEqual(self.vault.status()['phase'], 'connected')
        window.destroy.assert_called_once()


if __name__ == '__main__':
    unittest.main()

