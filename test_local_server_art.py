import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from local_server import CardArtCache

class DeckArtTest(unittest.TestCase):
    def test_banner_uses_browser_user_agent_and_caches_jpeg(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return b'\xff\xd8banner-test'
        def serve(request, **kwargs):
            if isinstance(request, str) or not request.get_header('User-agent'):
                raise HTTPError(str(request), 403, 'Forbidden', {}, None)
            return Response()
        with tempfile.TemporaryDirectory() as tmp, patch('local_server.urllib.request.urlopen', side_effect=serve) as network:
            cache = CardArtCache(Path(tmp))
            image, quality = cache.get('EX1_144', 'tile')
            self.assertIsNotNone(image, 'banner fetch must include User-Agent to avoid CDN 403')
            self.assertEqual(image.read_bytes(), b'\xff\xd8banner-test')
            self.assertEqual(cache.get('EX1_144', 'tile'), (image, quality))
            self.assertEqual(network.call_count, 1)

