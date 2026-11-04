import { useEffect, useState } from 'react';
import { request } from '../collection/api.js';
import { addDeckCard, addSideboardCard, allocateDeckVariants, deckClass, deckEntryVariants, effectiveDeckTotal, encodeDeck, HEROES, removeDeckCard, removeSideboardCard } from './model.js';

function sameDeckContents(left, right) {
  if (!left || !right || left.name !== right.name || left.hero !== right.hero || left.format !== right.format) return false;
  const entries = deck => deck.entries.map(({ id, count, variants }) => [id, count, variants || null]).sort((a, b) => a[0] - b[0]);
  return JSON.stringify(entries(left)) === JSON.stringify(entries(right))
    && JSON.stringify(left.sideboards || []) === JSON.stringify(right.sideboards || []);
}

export default function useDecks({ cards, cardReferences = [], onBegin, onNotice }) {
  const [decks, setDecks] = useState([]), [draft, setDraft] = useState(null);
  const [heroReferences, setHeroReferences] = useState([]);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(''), [dialog, setDialog] = useState(null);
  const [deckOnly, setDeckOnly] = useState(false), [deckOnlyRetainedIds, setDeckOnlyRetainedIds] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    request('decks', undefined, controller.signal).then(data => { setDecks(data.decks); setReady(true); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!decks.length || !cards.length) return;
    const baseHeroes = new Set(Object.values(HEROES));
    const ids = [...new Set(decks.map(deck => deck.hero).filter(id => !baseHeroes.has(id)
      && !cards.some(card => card.dbfId === id) && !cardReferences.some(card => card.dbfId === id)))];
    if (!ids.length) { setHeroReferences([]); return; }
    const controller = new AbortController();
    request(`cards/lookup?ids=${ids.slice(0, 100).join(',')}`, undefined, controller.signal)
      .then(data => setHeroReferences(data.cards)).catch(error => { if (error.name !== 'AbortError') setHeroReferences([]); });
    return () => controller.abort();
  }, [decks, cards, cardReferences]);
  useEffect(() => {
    if (!cards.length) return;
    setDraft(current => {
      if (!current) return current;
      const synchronized = allocateDeckVariants(current, cards);
      const qualityAssignmentsUnchanged = current.entries.every((entry, index) =>
        JSON.stringify(entry.variants || {}) === JSON.stringify(synchronized.entries[index].variants || {}));
      return qualityAssignmentsUnchanged ? current : synchronized;
    });
  }, [cards]);
  const allReferences = [...cardReferences, ...heroReferences];
  const heroClass = deckClass(draft, [...cards, ...allReferences]);
  const dirty = !!draft && !sameDeckContents(draft, decks.find(d => d.id === draft.id));
  useEffect(() => {
    function warn(event) { if (dirty) { event.preventDefault(); event.returnValue = ''; } }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function activate(next) {
    const loaded = allocateDeckVariants(next, cards);
    const only = !!loaded.id && effectiveDeckTotal(loaded) >= 30;
    setDeckOnlyRetainedIds(loaded.entries.map(entry => entry.id));
    setDraft(loaded); setDeckOnly(only); setDialog(null); setError(''); onBegin(deckClass(loaded, [...cards, ...allReferences]), only);
  }
  function start(next) {
    if (dirty && !sameDeckContents(next, draft)) setDialog({ type: 'switch', next });
    else activate(next);
  }
  async function mutate(path, body, done) {
    setBusy(true); setError('');
    try { const data = await request(path, body); setDecks(data.decks); done(data); return data; }
    catch (e) { setError(e.message); onNotice(e.message); return null; }
    finally { setBusy(false); }
  }
  async function refreshDecks() {
    if (busy || refreshing) return;
    setRefreshing(true); setError('');
    try {
      const data = await request('decks');
      setDecks(data.decks);
      setReady(true);
      // Refresh a clean active deck too, while never overwriting local edits.
      setDraft(current => {
        if (!current || !sameDeckContents(current, decks.find(deck => deck.id === current.id))) return current;
        const latest = data.decks.find(deck => deck.id === current.id);
        return latest ? allocateDeckVariants(latest, cards) : current;
      });
      onNotice('已刷新本机套牌列表。');
    } catch (e) {
      setError(e.message); onNotice(`刷新失败：${e.message}`);
    } finally { setRefreshing(false); }
  }
  return {
    decks, draft, setDraft, ready, busy, refreshing, refreshDecks, error, dialog, setDialog, dirty, heroClass, start, activate, deckOnly, setDeckOnly, deckOnlyRetainedIds, cardReferences: allReferences,
    addCard(card) {
      if (!draft || busy) return;
      try {
        const next = addDeckCard(draft, card, heroClass);
        setDeckOnlyRetainedIds(current => [...new Set([...current, ...next.entries.map(item => item.id)])]);
        const entry = next.entries.find(item => item.id === card.dbfId);
        const selected = deckEntryVariants(entry, card).find(row => row.quality === (card.displayQuality || 'normal'));
        setDraft(next);
        if (selected?.missing) {
          const qualityName = { normal: '普通', golden: '金色', diamond: '钻石', signature: '异画' }[card.displayQuality] || '普通';
          onNotice(`${card.name}的${qualityName}品质收藏不足 ${selected.missing} 张，已在套牌中标出缺口。`);
        } else onNotice(`${card.name}已加入套牌。`);
      } catch (e) { onNotice(e.message); }
    },
    addSideboard(ownerId, card) {
      if (!draft || busy) return;
      try { setDraft(current => addSideboardCard(current, ownerId, card)); onNotice(`${card.name}已加入备选牌。`); }
      catch (e) { onNotice(e.message); }
    },
    removeSideboard(id, ownerId) { setDraft(current => removeSideboardCard(current, id, ownerId)); },
    removeCard(id, quality) {
      setDraft(d => removeDeckCard(d, id, quality, cards.find(c => c.dbfId === id)));
    },
    save() {
      const deck = { ...draft, code: encodeDeck(draft) };
      return mutate('decks/save', { deck }, data => {
        setDraft(data.decks.find(d => d.id === draft.id) || data.decks[0]); onNotice('套牌已保存到本机。');
      });
    },
    saveCode(deck, code) {
      return mutate('decks/save', { deck: { ...deck, code } }, () => {});
    },
    importDecks(values) {
      return mutate('decks/import', { decks: values.map(deck => ({ ...deck, code: encodeDeck(deck) })) }, data => {
        setDialog(null);
        onNotice(`已导入 ${values.length} 套套牌，原有套牌已保留。`);
      });
    },
    deleteDeck(deck) {
      return mutate('decks/delete', { id: deck.id }, () => {
        if (draft?.id === deck.id) setDraft(null); setDialog(null); onNotice('套牌已删除。');
      });
    },
  };
}

