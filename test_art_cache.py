import io
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

from local_server import CardArtCache


class StripArtCacheTests(unittest.TestCase):
    def test_horizontal_art_is_cached_separately_from_original_art(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = CardArtCache(Path(directory))
            webp = b'RIFF\x08\x00\x00\x00WEBPtest'
            with patch('local_server.urllib.request.urlopen', return_value=io.BytesIO(webp)) as fetch:
                file, quality = cache.get('TIME_875t', 'strip')
                self.assertEqual(quality, 'strip')
                self.assertEqual(file.read_bytes(), webp)
                self.assertTrue(fetch.call_args.args[0].full_url.endswith('/tiles/TIME_875t.webp'))
            with patch('local_server.urllib.request.urlopen') as fetch:
                self.assertEqual(cache.get('TIME_875t', 'strip'), (file, 'strip'))
                fetch.assert_not_called()

    def test_cached_original_art_serves_strip_without_network(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = CardArtCache(Path(directory))
            original = cache.root / 'TEST_tile.jpg'
            original.write_bytes(b'original art fixture')
            error = urllib.error.HTTPError('https://example.invalid', 404, 'Not Found', {}, None)
            with patch('local_server.urllib.request.urlopen', side_effect=error) as fetch:
                self.assertEqual(cache.get('TEST', 'strip'), (original, 'tile'))
                self.assertEqual(cache.get('TEST', 'strip'), (original, 'tile'))
                self.assertEqual(fetch.call_count, 0)

    def test_disk_probe_never_downloads_and_validates_identifiers(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = CardArtCache(Path(directory))
            with patch('local_server.urllib.request.urlopen') as fetch:
                self.assertEqual(cache.cached('TEST', 'normal'), (None, 'normal'))
                with self.assertRaises(ValueError):
                    cache.cached('../TEST', 'normal')
                fetch.assert_not_called()


if __name__ == '__main__':
    unittest.main()

