import sqlite3
import json
import uuid
import threading
from contextlib import contextmanager

class DeckStore:
    lock = threading.RLock()
    def __init__(self, data_dir):
        self.path = data_dir / 'decks.sqlite3'
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS decks (id TEXT PRIMARY KEY, data TEXT NOT NULL)')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path)
        try:
            with db:
                yield db
        finally:
            db.close()

    def read(self):
        with self.connect() as db:
            return {'decks': [json.loads(row[0]) for row in db.execute('SELECT data FROM decks ORDER BY rowid DESC')]}

    def validate(self, deck):
        if not isinstance(deck, dict) or not isinstance(deck.get('name'), str) or not 1 <= len(deck['name'].strip()) <= 80:
            raise ValueError('请输入 1–80 字的套牌名称。')
        entries = deck.get('entries')
        if not isinstance(entries, list) or len(entries) > 100:
            raise ValueError('卡牌列表无效。')
        seen = set()
        for entry in entries:
            if not isinstance(entry, dict) or type(entry.get('id')) is not int or entry['id'] <= 0 or type(entry.get('count')) is not int or not 1 <= entry['count'] <= 40 or entry['id'] in seen:
                raise ValueError('卡牌 ID 或数量无效。')
            seen.add(entry['id'])
            if 'variants' in entry:
                variants = entry['variants']
                if not isinstance(variants, dict) or any(q not in ('normal', 'golden', 'diamond', 'signature') or type(n) is not int or n <= 0 for q, n in variants.items()) or sum(variants.values()) != entry['count']:
                    raise ValueError('套牌品质数量必须与卡牌数量一致。')
        if sum(e['count'] for e in entries) > 100:
            raise ValueError('套牌最多保存 100 张卡牌。')
        sideboards = deck.get('sideboards', [])
        if not isinstance(sideboards, list) or len(sideboards) > 30:
            raise ValueError('备选牌数据无效。')
        seen_sideboards = set()
        for item in sideboards:
            if not isinstance(item, dict) or type(item.get('id')) is not int or item['id'] <= 0 or type(item.get('ownerId')) is not int or item['ownerId'] <= 0 or type(item.get('count')) is not int or not 1 <= item['count'] <= 40:
                raise ValueError('备选牌数据无效。')
            key = (item['ownerId'], item['id'])
            if key in seen_sideboards or item['ownerId'] not in {entry['id'] for entry in entries}:
                raise ValueError('备选牌必须关联到套牌中的构筑卡，且不能重复。')
            seen_sideboards.add(key)
        identifier = deck.get('id') or str(uuid.uuid4())
        if not isinstance(identifier, str) or len(identifier) > 80:
            raise ValueError('套牌标识无效。')
        if type(deck.get('format')) is not int or deck['format'] not in (1, 2, 3) or type(deck.get('hero')) is not int or deck['hero'] <= 0:
            raise ValueError('职业或模式无效。')
        value = {k: deck[k] for k in ('name', 'entries', 'hero', 'format')}
        if sideboards:
            value['sideboards'] = sideboards
        if 'code' in deck:
            code = deck['code']
            if not isinstance(code, str) or not 4 <= len(code) <= 16000 or any(char not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=' for char in code):
                raise ValueError('卡组代码无效。')
            value['code'] = code
        value.update(id=identifier, name=deck['name'].strip())
        return value

    def save(self, deck):
        value = self.validate(deck)
        with self.lock, self.connect() as db:
            db.execute('INSERT INTO decks VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data', (value['id'], json.dumps(value, ensure_ascii=False)))
        return self.read()

    def import_decks(self, decks):
        if not isinstance(decks, list) or not 1 <= len(decks) <= 100 or any(not isinstance(d, dict) for d in decks):
            raise ValueError('请选择包含 1–100 套套牌的文件。')
        values = [self.validate({**deck, 'id': None}) for deck in decks]
        with self.lock, self.connect() as db:
            backup = sqlite3.connect(self.path.with_name('decks.before-import.sqlite3'))
            try:
                db.backup(backup)
            finally:
                backup.close()
            db.executemany('INSERT INTO decks VALUES (?, ?)', [(d['id'], json.dumps(d, ensure_ascii=False)) for d in values])
        return {**self.read(), 'importedIds': [d['id'] for d in values]}

    def delete(self, identifier):
        with self.lock, self.connect() as db:
            db.execute('DELETE FROM decks WHERE id = ?', (identifier,))
        return self.read()

