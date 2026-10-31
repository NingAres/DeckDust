"""Data protection and import compatibility checks; all writes use temporary directories."""
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch, Mock

from collection_service import CollectionStore, normalize_collection
from local_server import AppHandler


class CollectionImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.store = CollectionStore(self.root, self.root / 'user-data')
        self.first = {'collection': {'7': [1, 2, 0, 1, 9, 0, 0, 0]}, 'dust': 1200, 'lastModified': '2026-06-12T12:00:00Z'}

    def tearDown(self):
        self.temp.cleanup()

    def test_import_preserves_all_export_slots_and_survives_restart(self):
        self.store.replace(self.first, 'first.json')
        reopened = CollectionStore(self.root, self.root / 'user-data').read()
        self.assertEqual(reopened['collection']['7'], self.first['collection']['7'])
        self.assertEqual(reopened['meta']['dust'], 1200)
        self.assertEqual(reopened['meta']['source'], 'first.json')

    def test_invalid_import_cannot_change_collection_or_its_backup(self):
        self.store.replace(self.first, 'first.json')
        self.store.replace({'collection': {'8': [2, 0, 0, 0]}}, 'second.json')
        previous = self.store.read()
        invalid = [{}, {'collection': {}}, {'collection': {'7': [0, 0, 0, 0]}},
                   {'collection': {'wrong': [1]}}, {'collection': {'7': [-1]}},
                   {'collection': {'7': [1.5]}}, {'collection': {'7': ['2']}},
                   {'collection': {'7': [True]}}, {'collection': {'7': None}}]
        for raw in invalid:
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    self.store.replace(raw, 'bad.json')
                self.assertEqual(self.store.read(), previous)
        restored = self.store.restore()
        self.assertEqual(restored['collection'], self.first['collection'])
        self.assertEqual(restored['meta']['source'], 'first.json')

    def test_short_arrays_are_padded_without_merging_quality_slots(self):
        self.assertEqual(normalize_collection({'collection': {'7': [0, 2]}})['7'], [0, 2, 0, 0])

    def test_closed_browser_request_does_not_raise_a_storage_error(self):
        handler = AppHandler.__new__(AppHandler)
        handler.send_response = Mock()
        handler.send_header = Mock()
        handler.end_headers = Mock()
        handler.wfile = Mock()
        handler.wfile.write.side_effect = ConnectionAbortedError('browser closed')
        handler.send_json({'collection': {}})
        handler.send_response.assert_called_once_with(200)

    def test_failed_remote_auth_preserves_existing_collection(self):
        self.store.replace(self.first, 'first.json')
        previous = self.store.read()
        with patch('urllib.request.urlopen', side_effect=urllib.error.HTTPError('test', 403, 'Forbidden', {}, None)):
            with self.assertRaisesRegex(ValueError, '登录已失效'):
                self.store.sync_hsreplay('12345', 5, 'sessionid=example')
        self.assertEqual(self.store.read(), previous)

    def test_catalog_does_not_count_cosmetics_or_classic_copies(self):
        raw = [dict(id='CARD_1', dbfId=7, collectible=True, set='CORE', type='MINION', rarity='COMMON'),
               dict(id='SKIN', dbfId=8, collectible=True, set='HERO_SKINS', type='HERO', rarity='COMMON'),
               dict(id='CLASSIC', dbfId=9, collectible=True, set='VANILLA', type='MINION', rarity='COMMON'),
               dict(id='TOKEN', dbfId=10, set='CORE', type='MINION', rarity='COMMON'),
               dict(id='HIDDEN', dbfId=11, collectible=True, set='CORE_HIDDEN', type='MINION', rarity='COMMON')]
        (self.root / 'hearthstone_cards_cache.json').write_text(json.dumps(raw), encoding='utf-8')
        self.assertEqual([card['dbfId'] for card in self.store.catalog], [7])

    def test_noncollectible_linked_cards_are_available_for_deck_code_names(self):
        raw = [dict(id='TIME_875t', dbfId=119815, name='莱恩国王', collectible=False,
                    set='TIME_TRAVEL', type='MINION', cardClass='ROGUE', cost=3)]
        (self.root / 'hearthstone_cards_cache.json').write_text(json.dumps(raw, ensure_ascii=False), encoding='utf-8')
        self.assertEqual(self.store.catalog, [])
        self.assertEqual(self.store.lookup_cards([119815]), [{'id':'TIME_875t','dbfId':119815,'name':'莱恩国王',
                         'cost':3,'cardClass':'ROGUE','set':'TIME_TRAVEL','type':'MINION'}])

    def test_new_public_catalogue_is_preferred_without_overwriting_original_cache(self):
        old = dict(id='OLD', dbfId=7, collectible=True, set='TGT', type='MINION', rarity='COMMON')
        new = dict(id='BE_001', dbfId=123, collectible=True, set='BE', type='MINION', rarity='COMMON')
        (self.root / 'hearthstone_cards_cache.json').write_text(json.dumps([old]), encoding='utf-8')
        (self.root / 'hearthstone_cards_latest.json').write_text(json.dumps([new]), encoding='utf-8')
        self.assertEqual([card['set'] for card in self.store.catalog], ['BE'])
        self.assertEqual(json.loads((self.root / 'hearthstone_cards_cache.json').read_text()), [old])


if __name__ == '__main__':
    unittest.main()

