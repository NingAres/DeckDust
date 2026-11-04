import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from data_directory import DataDirectoryRedirected, prepare_data_directory, relaunch_from_desktop


class DataDirectoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        environment = dict(os.environ, LOCALAPPDATA=str(self.root))
        environment.pop('DECK_DUST_DATA_DIR', None)
        self.environment = patch.dict(os.environ, environment, clear=True)
        self.environment.start()

    def tearDown(self):
        self.environment.stop()
        self.temp.cleanup()

    @unittest.skipUnless(os.name == 'nt', 'Windows AppData redirection')
    def test_redirected_default_is_rejected_before_creating_a_database(self):
        with patch('data_directory.physical_file_path', return_value=self.root / 'Packages' / 'probe'):
            with self.assertRaises(DataDirectoryRedirected):
                prepare_data_directory()
        self.assertEqual(list((self.root / 'Deck Dust' / 'Data').iterdir()), [])

    def test_default_location_and_probe_cleanup(self):
        with patch('data_directory.physical_file_path', side_effect=lambda file: Path(file.name).absolute()):
            directory = prepare_data_directory()
        self.assertEqual(directory, self.root / 'Deck Dust' / 'Data')
        self.assertEqual(list(directory.iterdir()), [])

    def test_explicit_test_directory_is_preserved(self):
        with patch('data_directory.physical_file_path', side_effect=AssertionError('Must not probe override')):
            self.assertEqual(prepare_data_directory(self.root / 'isolated'), self.root / 'isolated')
            with patch.dict(os.environ, {'DECK_DUST_DATA_DIR': str(self.root / 'override')}):
                self.assertEqual(prepare_data_directory(), self.root / 'override')

    @unittest.skipUnless(os.name == 'nt', 'Windows Explorer launcher')
    def test_relaunch_uses_explorer_desktop_and_prevents_a_relaunch_loop(self):
        script = self.root / 'folder with spaces' / 'collection_proxy.py'
        with patch('win32com.client.Dispatch') as dispatch:
            relaunch_from_desktop(script, ['--port', '8766'])
        desktop = dispatch.return_value.Windows.return_value.FindWindowSW.return_value
        dispatch.return_value.Windows.return_value.FindWindowSW.assert_called_once_with(0, 0, 8, 0, 1)
        windowless = Path(sys.executable).with_name('pythonw.exe')
        expected_python = str(windowless) if windowless.exists() else sys.executable
        desktop.Document.Application.ShellExecute.assert_called_once_with(
            expected_python,
            subprocess.list2cmdline([str(script.resolve()), '--port', '8766', '--storage-relaunch']),
            str(script.resolve().parent), 'open', 0,
        )

    @unittest.skipUnless(os.name == 'nt', 'Windows single-instance mutex')
    def test_second_desktop_instance_is_rejected_by_mutex(self):
        from desktop_app import _acquire_instance_mutex, _release_instance_mutex
        name = rf'Local\DeckDust.Test.{os.getpid()}.{id(self)}'
        lock = _acquire_instance_mutex(name)
        self.assertIsNotNone(lock)
        try:
            self.assertIsNone(_acquire_instance_mutex(name))
        finally:
            _release_instance_mutex(lock)


if __name__ == '__main__':
    unittest.main()

