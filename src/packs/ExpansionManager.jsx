import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import PackArt from './PackArt.jsx';
import { PACK_TYPES } from './demo.js';

export default function ExpansionManager({ expansions, records, onSave, onClose }) {
  const [editing, setEditing] = useState(expansions[0]?.name || '');
  const [previousType, setPreviousType] = useState(expansions[0]?.defaultType || 'normal');
  const [name, setName] = useState(expansions[0]?.name || '');
  const [type, setType] = useState(expansions[0]?.defaultType || 'normal');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function select(expansion) {
    setEditing(expansion?.name || ''); setName(expansion?.name || '');
    setPreviousType(expansion?.defaultType || 'normal');
    setType(expansion?.defaultType || 'normal'); setError('');
  }
  async function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('请输入扩展包名称。'); return; }
    if (expansions.some(item => item.name === trimmed && item.defaultType === type && !(item.name === editing && item.defaultType === previousType))) { setError('这个扩展包与卡包类型的组合已存在。'); return; }
    setBusy(true);
    try { await onSave({ previous: editing, previousType, name: trimmed, defaultType: type }); setEditing(trimmed); setPreviousType(type); setName(trimmed); setError(''); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  return <Modal title="扩展包管理" className="pack-dialog expansion-manager" onClose={onClose}>
    <p className="pack-muted">新增或编辑扩展包，设置保存到本机数据库。</p>
    <div className="expansion-manager-layout"><section className="expansion-library" aria-label="扩展包列表"><button className="simple-button expansion-create" onClick={() => select(null)}>＋ 新增扩展包</button>
      {expansions.map(expansion => <button key={`${expansion.name}-${expansion.defaultType}`} className="expansion-list-item" aria-pressed={editing === expansion.name && previousType === expansion.defaultType} onClick={() => select(expansion)}><PackArt set={expansion.name} type={expansion.defaultType} assetName={expansion.artName} /><span><strong>{expansion.name}</strong><small>{records.filter(record => record.set === expansion.name && record.type === expansion.defaultType).reduce((sum, record) => sum + record.count, 0)} 包 · {PACK_TYPES[expansion.defaultType]}</small></span><Icon name="right" /></button>)}
    </section><form className="expansion-editor" onSubmit={submit}><h3>{editing ? '编辑扩展包' : '新增扩展包'}</h3><label className="pack-form-label">扩展包名称<input value={name} maxLength={40} required placeholder="例如：安戈洛龟途" onChange={event => { setName(event.target.value); setError(''); }} /></label><label className="pack-form-label">卡包类型<select value={type} onChange={event => setType(event.target.value)}>{Object.entries(PACK_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <p className="pack-footnote">同名系列可分别添加普通、金色与异画金色卡包。名称修改会同步到这个组合的历史记录；不同类型的记录不会合并。</p>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      <div className="dialog-actions"><button className="gold-button" type="submit" disabled={busy}>{editing ? '保存扩展包' : '添加扩展包'}</button></div>
    </form></div><div className="dialog-actions"><button className="simple-button" onClick={onClose}>完成</button></div>
  </Modal>;
}

