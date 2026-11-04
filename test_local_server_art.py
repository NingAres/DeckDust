import tempfile
import threading
import unittest
import urllib.request
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.error import HTTPError
from local_server import AppHandler, CardArtCache

class DeckArtTest(unittest.TestCase):
    def test_cached_http_route_does_not_enter_downloader(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            cache = CardArtCache(root)
            image = cache.root / 'CACHED.png'
            image.write_bytes(b'\x89PNG\r\n\x1a\nfixture')
            handler = partial(AppHandler, store=SimpleNamespace(root=root, data_dir=root), art=cache,
                              auth=None, packs=None, monitor=None, cloud_backup=None, export_dir=root)
            server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with patch.object(cache, 'get', side_effect=AssertionError('Cached requests must never download')):
                    with urllib.request.urlopen(f'http://127.0.0.1:{server.server_port}/api/art/CACHED/normal?cached=1') as response:
                        self.assertEqual(response.read(), image.read_bytes())
                        self.assertEqual(response.headers['X-Art-Quality'], 'normal')
                    with self.assertRaises(HTTPError) as missing:
                        urllib.request.urlopen(f'http://127.0.0.1:{server.server_port}/api/art/MISSING/normal?cached=1')
                    self.assertEqual(missing.exception.code, 404)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()

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

