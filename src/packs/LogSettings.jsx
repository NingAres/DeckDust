import { useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { request } from '../collection/api.js';

const KEY = 'deck-dust-pack-log-settings-v1';
function readSettings() {
  try { const value = JSON.parse(localStorage.getItem(KEY) || '{}'); return { path: typeof value.path === 'string' ? value.path : '', confirm: value.confirm !== false, autostart: value.autostart === true }; }
  catch { return { path: '', confirm: true, autostart: false }; }
}
export default function LogSettings({ settings: saved, onSave, onClose, onNotice, embedded = false }) {
  const [settings, setSettings] = useState(() => saved && 'autostart' in saved && 'path' in saved ? saved : readSettings());
  const [savedPath] = useState(saved?.path || '');
  const [manual, setManual] = useState(!!settings.path);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const input = useRef(null);
  async function detect() {
    setPhase('searching'); setError('');
    try {
      const result = await request('packs/detect', {});
      if (result.found) { setSettings(previous => ({ ...previous, path: result.path })); setPhase('found'); }
      else { setPhase('unavailable'); setError(result.message); }
      setManual(true);
    } catch (error) { setError(error.message); setPhase('unavailable'); setManual(true); }
  }
  async function save(event) {
    event.preventDefault(); setError('');
    const next = { ...settings, path: settings.path.trim(), confirm: true };
    if (!next.path) { setError('请先自动获取或手动填写日志目录。'); return; }
    setPhase('saving');
    try { await onSave(next); onNotice('日志目录与启动选项已保存，下次启动无需重新设置。'); if (!embedded) onClose(); }
    catch (error) { setError(error.message); setPhase('idle'); }
  }
  function cancel() {
    if (!embedded) { onClose(); return; }
    const next = saved && 'autostart' in saved && 'path' in saved ? saved : readSettings();
    setSettings(next); setManual(!!next.path); setError(''); setPhase('idle');
  }
  const form = <form onSubmit={save}>
    <p className="pack-muted">优先自动定位炉石日志目录；未找到时，再手动填写。</p>
    <div className="pack-log-label"><label htmlFor="pack-log-directory">炉石日志目录</label><span className="pack-help-wrap"><button type="button" className="pack-help-icon" aria-label="如何找到炉石日志目录" aria-describedby="pack-log-help">!</button><span className="pack-help-tooltip" role="tooltip" id="pack-log-help">在战网客户端选择炉石传说，通过游戏设置旁的齿轮菜单找到“在资源管理器中显示”，打开游戏安装目录中的 Logs 文件夹。请选择 Logs 根目录，不要选择单个 Net.log 或日期子文件夹。若没有 Logs，需先开启炉石日志并运行一次游戏。</span></span>{settings.path ? <span className="pack-path-saved">{settings.path.trim() === savedPath ? '已记住此路径' : '已填入 · 保存后记住'}</span> : null}</div>
    <div className="pack-path-controls"><input id="pack-log-directory" ref={input} value={settings.path} readOnly={!manual} placeholder="先自动获取；未找到时手动设置" onChange={event => setSettings(previous => ({ ...previous, path: event.target.value }))} /><button type="button" className="gold-button pack-detect-button" disabled={['searching', 'saving'].includes(phase)} onClick={detect}><Icon name="search" />{['searching', 'saving'].includes(phase) ? '正在查找…' : settings.path ? '重新获取' : '自动获取'}</button></div>
    <div className={`pack-detect-status ${phase}`} role="status">{['searching', 'saving'].includes(phase) ? '正在检查系统安装信息和常用目录…' : phase === 'unavailable' ? '未自动找到日志目录，请手动填写实际 Logs 路径。' : settings.path ? '此路径会保存在本机，下次无需重复设置。' : '自动读取系统安装信息，检测成功后回填路径。'}</div>
    <button type="button" className="pack-link pack-manual-path" disabled={['searching', 'saving'].includes(phase)} onClick={() => { setManual(true); requestAnimationFrame(() => input.current?.focus()); }}>未找到目录？手动填写</button>
    <label className="pack-settings-check"><input type="checkbox" checked disabled />识别后先加入待确认队列</label><label className="pack-settings-check"><input type="checkbox" checked={settings.autostart} onChange={event => setSettings(previous => ({ ...previous, autostart: event.target.checked }))} />应用启动时开启监控</label>
    <div className="pack-settings-note">目录必须真实存在；游戏未运行或尚未生成 Net.log 时，监控会等待。所有识别卡包都需确认，不会直接修改收藏。</div>
    {error ? <p className="error-message" role="alert">{error}</p> : null}<div className="dialog-actions"><button type="button" className="simple-button" onClick={cancel}>取消</button><button className="gold-button" disabled={['searching', 'saving'].includes(phase)}>保存设置</button></div>
  </form>;
  return embedded ? <div className="pack-log-settings embedded">{form}</div> : <Modal title="日志识别设置" className="pack-dialog pack-log-settings" onClose={onClose}>{form}</Modal>;
}

