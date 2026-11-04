from contextlib import closing
import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from pack_service import PackStore, encode, now
from pack_monitor import PackMonitor

CATALOG = [{'id': 'CARD_C', 'dbfId': 1, 'name': '普通卡', 'rarity': 'COMMON', 'set': 'TEST'},
           {'id': 'CARD_R', 'dbfId': 2, 'name': '稀有卡', 'rarity': 'RARE', 'set': 'TEST'},
           {'id': 'CARD_L', 'dbfId': 3, 'name': '传说卡', 'rarity': 'LEGENDARY', 'set': 'TEST'}]


class PackTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.store = PackStore(self.root / 'data', CATALOG)
        self.store.save_expansion({'name': '测试包', 'defaultType': 'normal'})
        self.exp = self.store.read()['expansions'][0]['id']

    def tearDown(self):
        self.temp.cleanup()

    def record(self, count=1, **qualities):
        return {'expansionId': self.exp, 'date': '2026-10-26T20:00:00', 'count': count,
                'qualities': qualities or {'common': count * 5 - 1, 'rare': 1}}

    def test_persistence_validation_revision_and_delete(self):
        self.store.save_record(self.record())
        row = PackStore(self.store.data_dir, CATALOG).read()['records'][0]
        self.assertEqual(row['count'], 1)
        with self.assertRaises(ValueError):
            self.store.save_record(self.record(common=6))
        with self.assertRaises(ValueError):
            self.store.save_record({**row, 'revision': 0})
        updated = self.store.save_record({**row, 'note': '修改'})['records'][0]
        self.assertEqual(updated['revision'], 2)
        with self.assertRaises(ValueError):
            self.store.save_record({'id': updated['id'], 'revision': updated['revision']})
        self.store.delete_record(updated['id'], updated['revision'])
        self.assertEqual(self.store.read()['records'], [])
        self.assertTrue((self.store.data_dir / 'packs.previous.sqlite3').exists())

    def event(self, identifier, cards):
        with self.store.connect() as db:
            db.execute('INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?)', (identifier, identifier, now(), encode(cards), 'pending', None, None, 'log', '{}'))

    def test_confirmation_is_atomic_and_idempotent(self):
        cards = [{'card_id': 1, 'premium': 0}] * 4 + [{'card_id': 3, 'premium': 0}]
        self.event('e1', cards); self.event('e2', cards)
        with self.assertRaises(ValueError):
            self.store.confirm(['e1', 'missing'], self.exp)
        self.assertEqual(len(self.store.read()['pending']), 2)
        self.assertEqual(self.store.read()['records'], [])
        data = self.store.confirm(['e1'], self.exp)
        self.assertEqual(len(data['records'][0]['cardDetails']), 5)
        self.assertEqual(data['records'][0]['cardPacks'][0]['id'], 'e1')
        self.assertEqual(len(data['records'][0]['cardPacks'][0]['cards']), 5)
        self.assertEqual(len(data['recentRecords']), 1)
        with self.assertRaises(ValueError):
            self.store.confirm(['e1'], self.exp)
        self.assertEqual(len(self.store.read()['records']), 1)
        self.store.confirm(['e2'], None, discard=True)
        self.assertEqual(self.store.read()['pending'], [])

    def test_batch_splits_at_every_legendary_in_pack_order(self):
        for positions, expected in [({3}, [3, 2]), ({2, 4}, [2, 2, 1])]:
            with self.subTest(positions=positions):
                ids = []
                for index in range(1, 6):
                    identifier = f'batch-{min(positions)}-{index}'
                    cards = [{'card_id': 1, 'premium': 0}] * 4 + [
                        {'card_id': 3 if index in positions else 2, 'premium': 3 if index in positions else 0}]
                    self.event(identifier, cards)
                    ids.append(identifier)
                data = self.store.confirm(list(reversed(ids)), self.exp)
                records = [r for r in data['records'] if any(p['id'] in ids for p in r.get('cardPacks', []))]
                self.assertEqual([r['count'] for r in reversed(records)], expected)
                self.assertEqual(sum(len(r['cardDetails']) for r in records), 25)

    def test_existing_complete_batch_is_split_once_with_backup_and_event_links(self):
        cards = []
        for index in range(1, 6):
            pack = [{'card_id': 1, 'premium': 0}] * 4 + [{'card_id': 3 if index in (2, 4) else 2, 'premium': 3 if index in (2, 4) else 0}]
            self.event(f'old-{index}', pack)
            cards.extend(pack)
        with self.store.connect() as db:
            record_id = self.store._insert_record(db, self.record(5, **self.store.event_counts(cards)), self.exp, '日志识别')
            db.execute("UPDATE events SET status='confirmed',record_id=?,expansion_id=?", (record_id, self.exp))
        updated = PackStore(self.store.data_dir, CATALOG)
        data = updated.read()
        self.assertEqual([r['count'] for r in reversed(data['records'])], [2, 2, 1])
        self.assertEqual(sum(r['count'] for r in data['statsRecords']), 5)
        self.assertEqual(sum(r['qualities']['signature'] for r in data['records']), 2)
        self.assertEqual(len(data['recentRecords']), 5)
        self.assertEqual(len(list((self.store.data_dir / 'backups').glob('packs-before-batch-split-*.sqlite3'))), 1)
        backup = next((self.store.data_dir / 'backups').glob('packs-before-batch-split-*.sqlite3'))
        with closing(sqlite3.connect(backup)) as db:
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            self.assertEqual(db.execute('SELECT count(*) FROM records').fetchone()[0], 1)
        again = PackStore(self.store.data_dir, CATALOG).read()
        self.assertEqual(again['records'], data['records'])
        self.assertEqual(len(list((self.store.data_dir / 'backups').glob('packs-before-batch-split-*.sqlite3'))), 1)

    def test_move_record_preserves_event_and_updates_group(self):
        self.event('move-event', [{'card_id': 1, 'premium': 0}] * 5)
        row = self.store.confirm(['move-event'], self.exp)['records'][0]
        self.store.save_expansion({'name': '目标包', 'defaultType': 'normal'})
        target = next(item['id'] for item in self.store.read()['expansions'] if item['name'] == '目标包')
        data = self.store.save_record({**row, 'expansionId': target})
        self.assertEqual(data['records'][0]['cardDetails'], row['cardDetails'])
        self.assertEqual(data['recentRecords'][0]['set'], '目标包')
        self.assertEqual(sum(record['count'] for record in data['statsRecords']), 1)

    def test_incremental_log_partial_records_restart_rotation_and_truncation(self):
        logs = self.root / 'Logs'; session = logs / 'Hearthstone_2026_10_26_20_00_00'; session.mkdir(parents=True)
        file = session / 'Net.log'; file.write_text('old log\n', encoding='utf-8')
        self.store.save_settings({'path': str(logs)})
        monitor = PackMonitor(self.store, start_thread=False); monitor.start()
        line = 'Handling card collection modification (collection version 123) AssetCardId: 1 Premium: 0\n'
        with file.open('a') as stream:
            stream.write(line * 4 + line[:-2])
        monitor.scan_once(); self.assertEqual(self.store.read()['pending'], [])
        with file.open('a') as stream:
            stream.write('0\n')
        monitor.scan_once(); self.assertEqual(len(self.store.read()['pending']), 1)
        monitor.scan_once(); self.assertEqual(len(self.store.read()['pending']), 1)
        monitor2 = PackMonitor(PackStore(self.store.data_dir, CATALOG), start_thread=False)
        monitor2.scan_once(); self.assertEqual(len(self.store.read()['pending']), 1)
        file.write_text(line * 5, encoding='utf-8'); monitor2.scan_once()
        self.assertEqual(len(self.store.read()['pending']), 1)
        next_session = logs / 'Hearthstone_2026_10_26_21_00_00'; next_session.mkdir()
        (next_session / 'Net.log').write_text(line * 10, encoding='utf-8')
        monitor2.scan_once(); self.assertEqual(len(self.store.read()['pending']), 3)

    def legacy(self):
        directory = self.root / 'legacy'; directory.mkdir()
        with closing(sqlite3.connect(directory / 'hs_pack.db')) as db, db:
            db.execute('CREATE TABLE expansion(id INTEGER,name TEXT,type TEXT,create_time TEXT,update_time TEXT)')
            db.execute("INSERT INTO expansion VALUES (1,'旧包','normal','2026-01-01','2026-10-25')")
            columns = 'id INTEGER,expansion_id INTEGER,expansion_name TEXT,expansion_type TEXT,pack_count INTEGER,normal INTEGER,gold_normal INTEGER,rare INTEGER,gold_rare INTEGER,epic INTEGER,gold_epic INTEGER,legendary INTEGER,gold_legendary INTEGER,variant_legendary INTEGER,has_legendary INTEGER,open_time TEXT,create_time TEXT'
            for table in ('pack_record', 'pack_record_history'):
                db.execute(f'CREATE TABLE {table}({columns})')
            values = (1, 1, '旧包', 'normal', 1, 4, 0, 1, 0, 0, 0, '', 0, 0, 0, '2026-10-25 20:00:10', '2026-10-25 20:00:10')
            db.execute('INSERT INTO pack_record_history VALUES (' + ','.join('?' * 17) + ')', values)
            aggregate = list(values); aggregate[4] = 3; aggregate[5] = 12; aggregate[7] = 3; aggregate[11] = 0
            db.execute('INSERT INTO pack_record VALUES (' + ','.join('?' * 17) + ')', aggregate)
        cards = [{'card_id': 'CARD_C', 'premium': 0, 'rarity': 'COMMON'}] * 4 + [{'card_id': 'CARD_R', 'premium': 0, 'rarity': 'RARE'}]
        (directory / 'pack_details.json').write_text(encode({'2026-10-25': [{'time': '2026-10-25 20:00:00', 'version': '123_1', 'cards': cards}]}), encoding='utf-8')
        return directory

    def test_lossless_legacy_import_separate_baseline_and_corrected_history(self):
        directory = self.legacy()
        before = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.iterdir()}
        # An empty expansion list is fine; migration does not depend on demo fixtures.
        report = self.store.import_legacy(directory)
        self.assertEqual(report['historyPacks'], 1); self.assertEqual(report['statisticsPacks'], 3)
        self.assertEqual(report['linkedEvents'], 1)
        self.assertEqual(report, self.store.import_legacy(directory))
        after = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.iterdir()}
        self.assertEqual(before, after)
        with self.store.connect() as db:
            raw = json.loads(db.execute("SELECT payload FROM legacy_rows WHERE table_name='pack_record_history'").fetchone()[0])
            self.assertEqual(raw['legendary'], '')
        snapshot = self.store.read(); self.assertEqual(sum(r['count'] for r in snapshot['statsRecords']), 3)
        old = snapshot['records'][0]
        self.store.save_record({**old, 'count': 2, 'qualities': {'common': 9, 'rare': 1}})
        snapshot = self.store.read(); self.assertEqual(sum(r['count'] for r in snapshot['statsRecords']), 4)
        self.assertEqual(len(snapshot['recentRecords']), 1)
        updated = snapshot['records'][0]
        self.store.delete_record(updated['id'], updated['revision'])
        self.assertEqual(sum(r['count'] for r in self.store.read()['statsRecords']), 2)


if __name__ == '__main__':
    unittest.main()

