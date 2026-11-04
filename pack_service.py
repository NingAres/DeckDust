"""Transactional pack ledger. Legacy data is archived verbatim, never rewritten."""
from __future__ import annotations

import hashlib
import json
import math
import re
import sqlite3
import threading
import uuid
from contextlib import contextmanager, closing
from datetime import datetime
from pathlib import Path

QUALITY_MAP = {'normal': 'common', 'rare': 'rare', 'epic': 'epic', 'legendary': 'legendary',
               'gold_normal': 'goldCommon', 'gold_rare': 'goldRare', 'gold_epic': 'goldEpic',
               'gold_legendary': 'goldLegendary', 'variant_legendary': 'signature'}
QUALITIES = tuple(QUALITY_MAP.values())
TYPES = {'normal', 'gold', 'variant_gold'}
LEGENDARIES = ('legendary', 'goldLegendary', 'signature')


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def now():
    return datetime.now().isoformat(timespec='seconds')


def uid(prefix):
    return prefix + uuid.uuid4().hex


def number(value):
    # Legacy SQLite accepted empty strings and numeric strings; raw values stay archived.
    try:
        result = float(value)
        return int(result) if math.isfinite(result) and result.is_integer() else result if math.isfinite(result) else 0
    except (ValueError, TypeError):
        return 0


def legacy_record(row):
    return {'count': row['pack_count'], 'date': row['open_time'].replace(' ', 'T'),
            'qualities': {new: number(row.get(old, 0)) for old, new in QUALITY_MAP.items()}}


def legendary(record):
    return any(record['qualities'].get(key, 0) > 0 for key in LEGENDARIES)


def event_order(event):
    version = tuple((0, int(part)) if part.isdigit() else (1, part) for part in re.split(r'(\d+)', event['version']))
    return event['date'], version, event['id']


def record_order(record):
    packs = record.get('cardPacks')
    return event_order(packs[0] if packs else {**record, 'version': ''})


def counts_equal(a, b):
    return (isinstance(a, dict) and isinstance(b, dict)
            and isinstance(a.get('qualities'), dict) and isinstance(b.get('qualities'), dict)
            and a.get('count') == b.get('count')
            and all(a['qualities'].get(k, 0) == b['qualities'].get(k, 0) for k in QUALITIES))


def validate_record(raw, preserve_legacy=False):
    if not isinstance(raw, dict):
        raise ValueError('开包记录格式无效。')
    count = raw.get('count')
    if type(count) is not int or not 1 <= count <= 99999:
        raise ValueError('卡包数必须为 1 至 99999 的整数。')
    qualities = raw.get('qualities')
    if not isinstance(qualities, dict) or set(qualities) - set(QUALITIES):
        raise ValueError('卡牌品质字段无效。')
    values = {key: qualities.get(key, 0) for key in QUALITIES}
    if any(type(value) is not int or value < 0 for value in values.values()) or (not preserve_legacy and sum(values.values()) != count * 5):
        raise ValueError('各品质必须为非负整数，且合计等于卡包数 × 5。')
    try:
        date = datetime.fromisoformat(raw.get('date', '')).isoformat(timespec='seconds')
    except (ValueError, TypeError):
        raise ValueError('请选择有效的开包时间。') from None
    return {'count': count, 'qualities': values, 'date': date, 'note': str(raw.get('note', ''))[:500]}


class PackStore:
    def __init__(self, data_dir: Path, catalog=()):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.data_dir / 'packs.sqlite3'
        self.lock = threading.RLock()
        self.catalog = list(catalog)
        self.by_id = {str(card['id']): card for card in self.catalog}
        self.by_dbf = {str(card['dbfId']): card for card in self.catalog if card.get('dbfId')}
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS expansions (
                    id TEXT PRIMARY KEY,name TEXT NOT NULL,type TEXT NOT NULL,created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,legacy_id INTEGER,raw_json TEXT);
                CREATE TABLE IF NOT EXISTS records (
                    id TEXT PRIMARY KEY,expansion_id TEXT NOT NULL REFERENCES expansions(id),
                    payload TEXT NOT NULL,baseline TEXT,legacy_id INTEGER,revision INTEGER NOT NULL DEFAULT 1,
                    deleted INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS legacy_cycles (
                    id TEXT PRIMARY KEY,expansion_id TEXT NOT NULL REFERENCES expansions(id),payload TEXT NOT NULL,
                    closed INTEGER NOT NULL,legacy_id INTEGER NOT NULL,raw_json TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,version TEXT NOT NULL,date TEXT NOT NULL,cards TEXT NOT NULL,
                    status TEXT NOT NULL,record_id TEXT REFERENCES records(id),expansion_id TEXT REFERENCES expansions(id),
                    origin TEXT NOT NULL,raw_json TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS log_cursors (id TEXT PRIMARY KEY,value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY,source_path TEXT UNIQUE NOT NULL,report TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS legacy_rows (import_id TEXT,table_name TEXT,row_key TEXT,payload TEXT NOT NULL,
                    PRIMARY KEY(import_id,table_name,row_key));
                CREATE TABLE IF NOT EXISTS legacy_files (import_id TEXT,name TEXT,sha256 TEXT NOT NULL,content BLOB NOT NULL,
                    PRIMARY KEY(import_id,name));
                CREATE TABLE IF NOT EXISTS edits (id INTEGER PRIMARY KEY,record_id TEXT,date TEXT,before_json TEXT,after_json TEXT);
                CREATE TABLE IF NOT EXISTS state_version (id INTEGER PRIMARY KEY,revision INTEGER NOT NULL);
                INSERT OR IGNORE INTO state_version VALUES (1,0);
            ''')
            for table in ('expansions', 'records', 'events', 'imports', 'settings'):
                for action in ('INSERT', 'UPDATE', 'DELETE'):
                    db.execute(f'CREATE TRIGGER IF NOT EXISTS version_{table}_{action} AFTER {action} ON {table} BEGIN UPDATE state_version SET revision=revision+1 WHERE id=1; END')
        self._split_confirmed_batches()

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.db_path, timeout=20)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        try:
            with db:
                yield db
        finally:
            db.close()

    def backup(self, destination=None):
        with closing(sqlite3.connect(self.db_path)) as source, closing(sqlite3.connect(destination or self.data_dir / 'packs.previous.sqlite3')) as target:
            source.backup(target)

    def _event_groups(self, selected_events):
        groups, current = [], []
        for event in sorted(selected_events, key=lambda item: event_order(item[0])):
            current.append(event)
            if legendary({'qualities': self.event_counts(event[1])}):
                groups.append(current)
                current = []
        if current:
            groups.append(current)
        return groups

    def _save_event_groups(self, db, groups, expansion_id, original=None):
        old = json.loads(original['payload']) if original else {}
        for index, group in enumerate(groups):
            cards = [card for _, pack_cards, _ in group for card in pack_cards]
            payload = {**old, 'count': len(group), 'date': group[0][0]['date'], 'qualities': self.event_counts(cards)}
            if original and index == 0:
                record_id = original['id']
                payload = {**validate_record(payload), 'source': old.get('source', '日志识别')}
                db.execute('UPDATE records SET payload=?,revision=revision+1 WHERE id=?', (encode(payload), record_id))
                db.execute('INSERT INTO edits(record_id,date,before_json,after_json) VALUES (?,?,?,?)', (record_id, now(), original['payload'], encode(payload)))
            else:
                record_id = self._insert_record(db, payload, expansion_id, old.get('source', '日志识别'))
            db.executemany("UPDATE events SET status='confirmed',record_id=?,expansion_id=? WHERE id=?", [(record_id, expansion_id, event['id']) for event, _, _ in group])

    def _split_confirmed_batches(self):
        # Only reconstruct complete modern log records. Legacy aggregates and
        # manually corrected quantities remain available in their original form.
        with self.lock, self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            changes = []
            for row in db.execute('SELECT * FROM records WHERE deleted=0 AND baseline IS NULL AND legacy_id IS NULL').fetchall():
                payload = json.loads(row['payload'])
                if payload['count'] < 2:
                    continue
                events = [(event, json.loads(event['cards']), {}) for event in db.execute("SELECT * FROM events WHERE record_id=? AND status='confirmed' AND origin='log'", (row['id'],))]
                if len(events) != payload['count'] or any(len(cards) != 5 for _, cards, _ in events):
                    continue
                try:
                    values = self.event_counts([card for _, cards, _ in events for card in cards])
                    if not counts_equal(payload, {'count': len(events), 'qualities': values}):
                        continue
                    groups = self._event_groups(events)
                except ValueError:
                    continue
                if len(groups) > 1:
                    changes.append((row, groups))
            if changes:
                directory = self.data_dir / 'backups'
                directory.mkdir(parents=True, exist_ok=True)
                self.backup(directory / (uid('packs-before-batch-split-') + '.sqlite3'))
                for row, groups in changes:
                    self._save_event_groups(db, groups, row['expansion_id'], row)

    def settings(self):
        with self.connect() as db:
            row = db.execute("SELECT value FROM settings WHERE key='log'").fetchone()
        return json.loads(row[0]) if row else {'path': '', 'confirm': True, 'autostart': False}

    def save_settings(self, settings):
        path = str(settings.get('path', '')).strip()
        if not path or not Path(path).is_dir():
            raise ValueError('日志目录不存在，请选择炉石 Logs 文件夹。')
        value = {'path': str(Path(path).resolve()), 'confirm': True, 'autostart': settings.get('autostart') is True}
        with self.lock, self.connect() as db:
            db.execute("INSERT OR REPLACE INTO settings VALUES ('log',?)", (encode(value),))
        return value

    def card_entry(self, raw):
        identifier = str(raw.get('card_id', raw.get('dbfId', '')))
        known = self.by_id.get(identifier) or self.by_dbf.get(identifier)
        card = {key: value for key, value in (known or {'id': identifier, 'name': raw.get('name') or f'未知卡牌 {identifier}', 'rarity': raw.get('rarity', 'UNKNOWN')}).items() if key in ('id', 'dbfId', 'name', 'rarity', 'set', 'cost')}
        premium = number(raw.get('premium', 0))
        rarity = str(card.get('rarity') or raw.get('rarity', '')).upper()
        base = {'COMMON': 'common', 'RARE': 'rare', 'EPIC': 'epic', 'LEGENDARY': 'legendary'}.get(rarity)
        key = 'signature' if premium in (2, 3) and base == 'legendary' else ('gold' + base[0].upper() + base[1:] if premium == 1 and base else base)
        return {'card': card, 'qualityKey': key, 'quality': 'signature' if key == 'signature' else 'golden' if premium == 1 else 'normal', 'premiumRaw': raw.get('premium', 0)}

    def event_counts(self, cards):
        values = {key: 0 for key in QUALITIES}
        for raw in cards:
            entry = self.card_entry(raw)
            if entry['qualityKey'] not in values or not re_card_id(entry['card']['id']):
                raise ValueError('存在未识别的卡牌或品质，请更新卡牌资料后再确认。')
            values[entry['qualityKey']] += 1
        return values

    def save_expansion(self, raw):
        name, kind = str(raw.get('name', '')).strip(), raw.get('defaultType', raw.get('type'))
        if not name or len(name) > 80 or kind not in TYPES:
            raise ValueError('请填写扩展包名称与合法的卡包类型。')
        with self.lock:
            self.backup()
            with self.connect() as db:
                identifier = raw.get('id')
                old = db.execute('SELECT * FROM expansions WHERE id=?', (identifier,)).fetchone() if identifier else None
                if identifier and not old:
                    raise ValueError('扩展包已不存在，请刷新。')
                duplicate = db.execute('SELECT id FROM expansions WHERE name=? AND type=? AND id!=?', (name, kind, identifier or '')).fetchone()
                if duplicate:
                    raise ValueError('该名称和卡包类型的组合已存在。')
                if old and kind != old['type'] and (db.execute('SELECT 1 FROM records WHERE expansion_id=? LIMIT 1', (identifier,)).fetchone() or db.execute('SELECT 1 FROM legacy_cycles WHERE expansion_id=? LIMIT 1', (identifier,)).fetchone()):
                    raise ValueError('已有记录的卡包类型不能直接修改，请新增对应类型，避免混合不同保底。')
                if old:
                    db.execute('UPDATE expansions SET name=?,type=?,updated_at=? WHERE id=?', (name, kind, now(), identifier))
                else:
                    identifier = uid('e-')
                    db.execute('INSERT INTO expansions VALUES (?,?,?,?,?,?,?)', (identifier, name, kind, now(), now(), None, None))
        return self.read()

    def _insert_record(self, db, raw, expansion_id, source='手动录入'):
        record = validate_record(raw)
        if not db.execute('SELECT 1 FROM expansions WHERE id=?', (expansion_id,)).fetchone():
            raise ValueError('请先添加并选择扩展包。')
        record.update(source=source)
        identifier = uid('r-')
        db.execute('INSERT INTO records(id,expansion_id,payload,created_at) VALUES (?,?,?,?)', (identifier, expansion_id, encode(record), now()))
        db.execute('UPDATE expansions SET updated_at=? WHERE id=?', (now(), expansion_id))
        return identifier

    def save_record(self, raw):
        if not isinstance(raw, dict):
            raise ValueError('开包记录格式无效。')
        with self.lock:
            self.backup()
            with self.connect() as db:
                identifier = raw.get('id')
                if identifier:
                    row = db.execute('SELECT * FROM records WHERE id=? AND deleted=0', (identifier,)).fetchone()
                    if not row:
                        raise ValueError('记录已不存在，请刷新。')
                    if raw.get('revision') != row['revision']:
                        raise ValueError('记录已在其他窗口更新，请刷新后再编辑。')
                    old = json.loads(row['payload'])
                    valid = validate_record(raw, preserve_legacy=bool(row['baseline']) and counts_equal(old, raw))
                    expansion_id = raw.get('expansionId', row['expansion_id'])
                    expansion = db.execute('SELECT * FROM expansions WHERE id=?', (expansion_id,)).fetchone()
                    if not expansion:
                        raise ValueError('请选择已创建的扩展包与类型。')
                    if expansion['type'] != 'normal' and any(valid['qualities'][key] for key in ('common', 'rare', 'epic', 'legendary')):
                        raise ValueError('记录包含普通品质卡，不能改为金色卡包。')
                    if row['baseline'] and expansion_id != row['expansion_id']:
                        baseline = json.loads(row['baseline'])
                        baseline.setdefault('expansionId', row['expansion_id'])
                        db.execute('UPDATE records SET baseline=? WHERE id=?', (encode(baseline), identifier))
                    valid['source'] = old.get('source', '手动录入')
                    if not counts_equal(old, valid):
                        # Keep original cards in the real-pack archive, never fabricate corrected pictures.
                        db.execute('UPDATE events SET record_id=NULL WHERE record_id=?', (identifier,))
                        valid['source'] = '手动修订'
                    db.execute('UPDATE records SET payload=?,expansion_id=?,revision=revision+1 WHERE id=?', (encode(valid), expansion_id, identifier))
                    db.execute('UPDATE events SET expansion_id=? WHERE record_id=?', (expansion_id, identifier))
                    db.execute('INSERT INTO edits(record_id,date,before_json,after_json) VALUES (?,?,?,?)', (identifier, now(), row['payload'], encode(valid)))
                    db.execute('UPDATE expansions SET updated_at=? WHERE id=?', (now(), expansion_id))
                else:
                    valid = validate_record(raw)
                    self._insert_record(db, valid, raw.get('expansionId'))
        return self.read()

    def delete_record(self, identifier, revision):
        with self.lock:
            self.backup()
            with self.connect() as db:
                row = db.execute('SELECT * FROM records WHERE id=? AND deleted=0', (identifier,)).fetchone()
                if not row or row['revision'] != revision:
                    raise ValueError('记录已改变，请刷新后重试。')
                db.execute('UPDATE records SET deleted=1,revision=revision+1 WHERE id=?', (identifier,))
                db.execute('INSERT INTO edits(record_id,date,before_json,after_json) VALUES (?,?,?,?)', (identifier, now(), row['payload'], 'null'))
                db.execute('UPDATE expansions SET updated_at=? WHERE id=?', (now(), row['expansion_id']))
        return self.read()

    def confirm(self, ids, expansion_id, discard=False):
        if not isinstance(ids, list) or not ids or len(ids) != len(set(ids)):
            raise ValueError('请选择待处理卡包。')
        with self.lock:
            self.backup()
            with self.connect() as db:
                expansion = db.execute('SELECT * FROM expansions WHERE id=?', (expansion_id,)).fetchone()
                if not discard and not expansion:
                    raise ValueError('请选择卡包所属的扩展包与类型。')
                selected_events = []
                for identifier in ids:
                    event = db.execute('SELECT * FROM events WHERE id=?', (identifier,)).fetchone()
                    if not event or event['status'] != 'pending':
                        raise ValueError('部分卡包已处理，请刷新队列，避免重复记录。')
                    selected_events.append((event, json.loads(event['cards']), json.loads(event['raw_json'] or '{}')))
                if discard:
                    db.executemany("UPDATE events SET status='discarded' WHERE id=?", [(event['id'],) for event, _, _ in selected_events])
                else:
                    for event, cards, _ in selected_events:
                        if len(cards) != 5:
                            raise ValueError('待确认卡包必须为五张卡。')
                    cards = [card for _, pack_cards, _ in selected_events for card in pack_cards]
                    values = self.event_counts(cards)
                    if expansion['type'] != 'normal' and any(values[k] for k in ('common', 'rare', 'epic', 'legendary')):
                        raise ValueError('所选卡包包含普通品质卡，不能记为金色卡包。')
                    self._save_event_groups(db, self._event_groups(selected_events), expansion_id)
        return self.read()

    def _view_record(self, row, expansions):
        result = json.loads(row['payload'])
        expansion = expansions[row['expansion_id']]
        result.update(id=row['id'], expansionId=row['expansion_id'], set=expansion['name'], type=expansion['type'])
        if 'revision' in row.keys():
            result.update(revision=row['revision'], legacyId=row['legacy_id'])
        return result

    def read(self):
        with self.lock, self.connect() as db:
            expansions = {row['id']: dict(row) for row in db.execute('SELECT * FROM expansions ORDER BY updated_at DESC,id')}
            all_rows = list(db.execute('SELECT * FROM records ORDER BY created_at,id'))
            events = list(db.execute("SELECT * FROM events WHERE status IN ('archived','confirmed','pending') ORDER BY date DESC,id DESC"))
            records = [self._view_record(row, expansions) for row in all_rows if not row['deleted']]
            by_id = {record['id']: record for record in records}
            recent = []
            pending = []
            for event in events:
                cards = [self.card_entry(card) for card in json.loads(event['cards'])]
                if event['status'] == 'pending':
                    pending.append({'id': event['id'], 'date': event['date'], 'version': event['version'], 'cards': cards})
                    continue
                if event['record_id'] and event['record_id'] not in by_id:
                    continue
                expansion = expansions.get(event['expansion_id'])
                if event['record_id'] in by_id:
                    record = by_id[event['record_id']]
                    record['source'] = '日志识别' if event['origin'] == 'log' else '旧日志记录'
                    record.setdefault('cardDetails', []).extend(cards)
                    record.setdefault('cardPacks', []).append({'id': event['id'], 'date': event['date'], 'version': event['version'], 'cards': cards})
                entry = {'id': event['id'], 'count': 1, 'date': event['date'], 'version': event['version'],
                         'set': expansion['name'] if expansion else '未关联旧实包', 'type': expansion['type'] if expansion else '',
                         'source': '旧日志记录' if event['origin'] == 'legacy' else '日志识别', 'cardDetails': cards}
                recent.append(entry)
            for record in records:
                if record.get('cardPacks'):
                    record['cardPacks'].sort(key=event_order)
                    record['cardDetails'] = [card for pack in record['cardPacks'] for card in pack['cards']]
            baseline = []
            cycles = []
            for row in db.execute('SELECT * FROM legacy_cycles ORDER BY legacy_id'):
                record = self._view_record(row, expansions)
                baseline.append(record)
                cycles.append({**record, 'start': record['date'], 'closed': bool(row['closed']), 'records': [], 'legacy': True})
            adjustments = []
            for row in all_rows:
                if row['baseline']:
                    before = json.loads(row['baseline'])
                    after = self._view_record(row, expansions)
                    if before.get('expansionId', row['expansion_id']) != row['expansion_id']:
                        original = expansions[before['expansionId']]
                        adjustments.append({**after, 'id': 'delta-from-' + row['id'], 'expansionId': original['id'], 'set': original['name'], 'type': original['type'], 'count': -before['count'], 'qualities': {key: -before['qualities'].get(key, 0) for key in QUALITIES}, 'source': '旧历史归属修订'})
                        if not row['deleted']:
                            adjustments.append({**after, 'id': 'delta-to-' + row['id'], 'source': '旧历史归属修订'})
                        continue
                    delta = {key: (0 if row['deleted'] else after['qualities'].get(key, 0)) - before['qualities'].get(key, 0) for key in QUALITIES}
                    count = (0 if row['deleted'] else after['count']) - before['count']
                    if count or any(delta.values()):
                        adjustments.append({**after, 'id': 'delta-' + row['id'], 'count': count, 'qualities': delta, 'source': '旧历史修订差额'})
            modern = [record for record in records if record.get('legacyId') is None]
            opened = {}
            for record in sorted(modern, key=record_order):
                key = record['expansionId']
                if key not in opened:
                    previous = [cycle for cycle in cycles if cycle['expansionId'] == key]
                    latest = max(previous, key=lambda item: item['date'], default=None)
                    if latest and not latest['closed'] and latest['date'] <= record['date']:
                        opened[key] = latest
                    else:
                        opened[key] = {**record, 'id': 'cycle-' + record['id'], 'count': 0, 'qualities': {k: 0 for k in QUALITIES}, 'start': record['date'], 'records': [], 'closed': False}
                        cycles.append(opened[key])
                cycle = opened[key]
                cycle['count'] += record['count']
                cycle['qualities'] = {k: cycle['qualities'].get(k, 0) + record['qualities'].get(k, 0) for k in QUALITIES}
                cycle['date'] = record['date']; cycle['records'].append(record)
                if legendary(record):
                    cycle['closed'] = True; del opened[key]
            reports = [json.loads(row[0]) for row in db.execute('SELECT report FROM imports')]
            revision = db.execute('SELECT revision FROM state_version WHERE id=1').fetchone()[0]
        # Baseline objects must remain independent of merged cycles.
        stats = [self._view_record(row, expansions) for row in self._baseline_rows()] + modern + adjustments
        return {'records': sorted(records, key=record_order, reverse=True),
                'expansions': [{'id': value['id'], 'name': value['name'], 'defaultType': value['type']} for value in expansions.values()],
                'statsRecords': stats, 'cycles': sorted(cycles, key=lambda item: item['date'], reverse=True),
                'recentRecords': recent, 'pending': pending, 'migration': reports,
                'settings': self.settings(), 'adjustments': adjustments, 'revision': revision}

    def revision(self):
        with self.connect() as db:
            return db.execute('SELECT revision FROM state_version WHERE id=1').fetchone()[0]

    def _baseline_rows(self):
        with self.connect() as db:
            return list(db.execute('SELECT * FROM legacy_cycles'))

    def import_legacy(self, directory):
        directory = Path(directory).resolve()
        source = directory / 'hs_pack.db'
        if not source.is_file():
            raise ValueError('所选目录中没有 hs_pack.db。')
        with self.lock:
            with self.connect() as db:
                previous = db.execute('SELECT report FROM imports WHERE source_path=?', (str(directory),)).fetchone()
                if previous:
                    return json.loads(previous[0])
                if db.execute('SELECT 1 FROM records LIMIT 1').fetchone() or db.execute('SELECT 1 FROM legacy_cycles LIMIT 1').fetchone():
                    raise ValueError('已有开包数据，不能重复合并旧库。请先备份并使用空数据库迁移。')
            # Reading a SQLite backup avoids partial copies when the old app is open.
            before_hash = hashlib.sha256(source.read_bytes()).hexdigest()
            imported_id = uid('import-')
            backup_dir = self.data_dir / 'pack-migration' / imported_id
            backup_dir.mkdir(parents=True)
            snapshot = backup_dir / 'hs_pack.db'
            with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as read_only, closing(sqlite3.connect(snapshot)) as target:
                read_only.execute('PRAGMA query_only=ON')
                read_only.backup(target)
            with closing(sqlite3.connect(snapshot)) as read_only:
                read_only.row_factory = sqlite3.Row
                tables = {row[0] for row in read_only.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                if not {'expansion', 'pack_record', 'pack_record_history'} <= tables:
                    raise ValueError('旧数据库结构不兼容，未导入任何数据。')
                raw_tables = {table: [dict(row) for row in read_only.execute('SELECT * FROM "' + table.replace('"', '""') + '"')] for table in sorted(tables)}
            detail_path = directory / 'pack_details.json'
            detail_bytes = detail_path.read_bytes() if detail_path.exists() else b'{}'
            details = json.loads(detail_bytes.decode('utf-8-sig'))
            if not isinstance(details, dict) or any(not isinstance(items, list) for items in details.values()):
                raise ValueError('旧卡牌详情 JSON 格式无效，未导入任何数据。')
            (backup_dir / 'pack_details.json').write_bytes(detail_bytes)
            report = {'id': imported_id, 'source': str(directory), 'importedAt': now(), 'tables': {key: len(value) for key, value in raw_tables.items()},
                      'historyPacks': sum(number(row['pack_count']) for row in raw_tables['pack_record_history']),
                      'statisticsPacks': sum(number(row['pack_count']) for row in raw_tables['pack_record']),
                      'sourceSha256Before': before_hash, 'sourceSha256After': hashlib.sha256(source.read_bytes()).hexdigest(),
                      'detailsSha256': hashlib.sha256(detail_bytes).hexdigest(), 'anomalies': [], 'orphanExpansions': [], 'linkedEvents': 0, 'unlinkedEvents': 0}
            self.backup()
            with self.connect() as db:
                for table, rows in raw_tables.items():
                    for index, row in enumerate(rows):
                        db.execute('INSERT INTO legacy_rows VALUES (?,?,?,?)', (imported_id, table, str(row.get('id', index)), encode(row)))
                for name, content in [('hs_pack.db', snapshot.read_bytes()), ('pack_details.json', detail_bytes)]:
                    db.execute('INSERT INTO legacy_files VALUES (?,?,?,?)', (imported_id, name, hashlib.sha256(content).hexdigest(), content))
                expansion_ids = {}
                for row in raw_tables['expansion']:
                    identifier = 'legacy-e-' + str(row['id']); expansion_ids[row['id']] = identifier
                    db.execute('INSERT INTO expansions VALUES (?,?,?,?,?,?,?)', (identifier, row['name'], row['type'], row.get('create_time') or now(), row.get('update_time') or row.get('create_time') or now(), row['id'], encode(row)))
                for table in ('pack_record', 'pack_record_history'):
                    for row in raw_tables[table]:
                        if row['expansion_id'] not in expansion_ids:
                            identifier = 'legacy-e-' + str(row['expansion_id']); expansion_ids[row['expansion_id']] = identifier
                            db.execute('INSERT INTO expansions VALUES (?,?,?,?,?,?,?)', (identifier, row['expansion_name'], row['expansion_type'], row.get('create_time') or now(), row['open_time'], row['expansion_id'], encode(row)))
                            report['orphanExpansions'].append(row['expansion_id'])
                        payload = legacy_record(row)
                        if sum(payload['qualities'].values()) != payload['count'] * 5 or any(type(row.get(key)) not in (int, float) for key in QUALITY_MAP):
                            report['anomalies'].append({'table': table, 'id': row['id'], 'rawQualities': {key: row.get(key) for key in QUALITY_MAP}})
                        if table == 'pack_record_history':
                            payload.update(source='旧历史记录', note='')
                            db.execute('INSERT INTO records VALUES (?,?,?,?,?,?,?,?)', ('legacy-r-' + str(row['id']), expansion_ids[row['expansion_id']], encode(payload), encode(payload), row['id'], 1, 0, row.get('create_time') or now()))
                        else:
                            db.execute('INSERT INTO legacy_cycles VALUES (?,?,?,?,?,?)', ('legacy-c-' + str(row['id']), expansion_ids[row['expansion_id']], encode(payload), int(bool(row['has_legendary'])), row['id'], encode(row)))
                clusters = {}
                for date, items in details.items():
                    for index, event in enumerate(items):
                        if not isinstance(event, dict) or not isinstance(event.get('cards'), list):
                            raise ValueError('卡牌详情中存在无效事件，迁移已回滚。')
                        time = str(event.get('time') or date + ' 00:00:00').replace(' ', 'T')
                        identifier = f'legacy-event-{date}-{index}'
                        db.execute('INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?)', (identifier, str(event.get('version', '')), time, encode(event['cards']), 'archived', None, None, 'legacy', encode(event)))
                        clusters.setdefault(time, []).append((identifier, event))
                used = set()
                for date, events in clusters.items():
                    cards = [card for _, event in events for card in event['cards']]
                    try:
                        candidate = {'count': len(events), 'qualities': self.event_counts(cards)}
                        candidates = []
                        for row in raw_tables['pack_record_history']:
                            if row['id'] in used or not counts_equal(legacy_record(row), candidate):
                                continue
                            delta = (datetime.fromisoformat(row['open_time']) - datetime.fromisoformat(date)).total_seconds()
                            if 0 <= delta <= 120:
                                candidates.append(row)
                        if len(candidates) == 1:
                            row = candidates[0]; used.add(row['id'])
                            for identifier, _ in events:
                                db.execute('UPDATE events SET record_id=?,expansion_id=? WHERE id=?', ('legacy-r-' + str(row['id']), expansion_ids[row['expansion_id']], identifier))
                                report['linkedEvents'] += 1
                    except (ValueError, TypeError):
                        pass
                report['eventCount'] = sum(len(items) for items in details.values())
                report['cardCount'] = sum(len(event.get('cards', [])) for items in details.values() for event in items)
                report['unlinkedEvents'] = report['eventCount'] - report['linkedEvents']
                report['detailDates'] = len(details)
                db.execute('INSERT INTO imports VALUES (?,?,?)', (imported_id, str(directory), encode(report)))
            (backup_dir / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
            return report


def re_card_id(identifier):
    import re
    return bool(re.fullmatch(r'[A-Za-z0-9_]{1,90}', identifier))


