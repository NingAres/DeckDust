import tempfile
import unittest
import sqlite3
from pathlib import Path
from deck_service import DeckStore

class DeckStoreTest(unittest.TestCase):
    def test_saved_deck_code_persists_and_invalid_code_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = DeckStore(Path(tmp))
            saved = store.save({'name':'含代码套牌','hero':637,'format':1,'entries':[], 'code':'AAECAf0EAA=='})['decks'][0]
            self.assertEqual(DeckStore(Path(tmp)).read()['decks'][0]['code'], 'AAECAf0EAA==')
            with self.assertRaises(ValueError):
                store.save({**saved, 'code':'not a valid deck code'})

    def test_sideboards_survive_save_and_reload(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = DeckStore(Path(tmp))
            deck = store.save({'name':'ETC备选牌','hero':637,'format':1,'entries':[{'id':90749,'count':1}],
                               'sideboards':[{'id':581,'count':1,'ownerId':90749},{'id':46589,'count':1,'ownerId':90749}]})['decks'][0]
            saved = next(item for item in DeckStore(Path(tmp)).read()['decks'] if item['id'] == deck['id'])
            self.assertEqual(saved['sideboards'], deck['sideboards'])

    def test_quality_counts_survive_save_reload_and_invalid_update_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = DeckStore(Path(tmp))
            original = store.save({'name':'混合品质','hero':637,'format':1,'entries':[{'id':1,'count':2,'variants':{'normal':1,'golden':1}}]})['decks'][0]
            self.assertEqual(DeckStore(Path(tmp)).read()['decks'], [original])
            for variants in ({'golden':2,'normal':1}, {'fake':2}, {'normal':True}, []):
                with self.assertRaises(ValueError):
                    store.save({**original,'entries':[{'id':1,'count':2,'variants':variants}]})
            self.assertEqual(store.read()['decks'], [original])

    def test_save_reopen_update_delete_and_invalid_preserves_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = DeckStore(Path(tmp))
            deck = {'name':'测试法师','hero':637,'format':1,'entries':[{'id':100,'count':2}]}
            saved = store.save(deck)['decks'][0]
            self.assertEqual(DeckStore(Path(tmp)).read()['decks'][0], saved)
            with self.assertRaises(ValueError):
                store.save({**saved,'entries':[{'id':100,'count':-1}]})
            self.assertEqual(store.read()['decks'], [saved])
            saved['name'] = '重命名'
            self.assertEqual(store.save(saved)['decks'][0]['name'], '重命名')
            self.assertEqual(len(store.read()['decks']), 1)
            self.assertEqual(store.delete(saved['id'])['decks'], [])

    def test_batch_import_is_additive_validates_all_first_and_backs_up(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = DeckStore(Path(tmp))
            original = store.save({'name':'原套牌','hero':637,'format':1,'entries':[]})['decks'][0]
            imported = {**original, 'name':'导入套牌'}
            with self.assertRaises(ValueError):
                store.import_decks([imported, {**imported, 'entries':[{'id':1,'count':-1}]}])
            self.assertEqual(store.read()['decks'], [original])
            result = store.import_decks([imported, imported])
            self.assertEqual(len(result['decks']), 3)
            self.assertEqual(len(set(result['importedIds'])), 2)
            self.assertNotIn(original['id'], result['importedIds'])
            backup = sqlite3.connect(Path(tmp) / 'decks.before-import.sqlite3')
            try:
                self.assertEqual(backup.execute('SELECT COUNT(*) FROM decks').fetchone()[0], 1)
            finally:
                backup.close()

