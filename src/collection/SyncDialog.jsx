import { useEffect, useRef, useState } from 'react';
import packageInfo from '../../package.json';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { request } from './api.js';
import { validateImport } from './model.js';
import LogSettings from '../packs/LogSettings.jsx';

export default function SyncDialog({ snapshot, onClose, onUpdated, syncPreferences, onSyncPreferencesChange, deckArtMode, onDeckArtModeChange, onNotice }) {
  const [section, setSection] = useState('sync');
  const [tab, setTab] = useState('hsreplay');
  const [candidate, setCandidate] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [auth, setAuth] = useState({ phase: 'loading' });
  const [packSettings, setPackSettings] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const fileSequence = useRef(0);
  const expiresAt = auth.expiresAt ? new Date(auth.expiresAt) : null;
  const validExpiry = expiresAt && !Number.isNaN(expiresAt.getTime());
  const expiryLabel = validExpiry
    ? expiresAt.toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : '未设置固定期限';
  const statusTitle = {
    connected: 'HSReplay 已连接', wrong_region: '账号地区不匹配', loading: '正在检查连接',
    opening: '正在打开登录窗口', importing: '正在确认国服账号', error: '连接尚未完成',
    cancelled: '登录窗口已关闭', waiting: '等待 HSReplay 登录', expired: 'HSReplay 会话已过期',
  }[auth.phase] || '尚未连接 HSReplay';
  const statusBadge = {
    connected: '连接正常', wrong_region: '地区不匹配', loading: '检查中', opening: '打开中',
    importing: '账号确认中', error: '需检查', cancelled: '已关闭', waiting: '等待登录', expired: '需重新登录',
  }[auth.phase] || '未连接';
  const statusIcon = auth.phase === 'connected' ? 'check'
    : auth.phase === 'expired' || auth.phase === 'error' || auth.phase === 'wrong_region' ? 'alert'
      : auth.phase === 'loading' || auth.phase === 'opening' || auth.phase === 'importing' ? 'sync' : 'globe';
  useEffect(() => {
    let active = true;
    request('hsreplay/status').then(state => {
      if (active) setAuth(state);
    }).catch(error => {
      if (active) { setAuth({ phase: 'error' }); setError(error.message); }
    });
    request('packs').then(result => {
      if (active) setPackSettings(result.settings || {});
    }).catch(error => {
      if (active) setError(error.message);
    });
    return () => { active = false; };
  }, []);
  async function login() {
    if (busy) return;
    setBusy('login'); setError('');
    try { setAuth(await request('hsreplay/login', {})); }
    catch (error) { setError(error.message); }
    finally { setBusy(''); }
  }
  async function refreshAuth() {
    if (busy) return;
    setBusy('status'); setError('');
    try { setAuth(await request('hsreplay/status')); }
    catch (error) { setError(error.message); }
    finally { setBusy(''); }
  }
  async function savePackSettings(settings) {
    const saved = await request('packs/settings', settings);
    setPackSettings(saved);
    return saved;
  }
  async function disconnect() {
    setBusy('disconnect'); setError('');
    try { setAuth(await request('hsreplay/disconnect', {})); }
    catch (error) { setError(error.message); }
    finally { setBusy(''); }
  }
  async function chooseFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const sequence = ++fileSequence.current;
    setError(''); setCandidate(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('文件超过 20 MB，请选择 HDT 导出的收藏 JSON。');
      const raw = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      const stats = validateImport(raw);
      if (sequence === fileSequence.current) setCandidate({ raw, stats, name: file.name });
    } catch (error) { if (sequence === fileSequence.current) setError(error instanceof SyntaxError ? '无法解析 JSON，请检查文件是否是有效的收藏导出文件。' : error.message); }
    event.target.value = '';
  }
  async function run(action, body, message) {
    if (busy) return;
    setBusy(action); setError('');
    try {
      const result = await request(`collection/${action}`, body);
      onUpdated(result, message);
      onClose();
    } catch (error) {
      setError(error.message);
      if (action === 'sync') {
        try { setAuth(await request('hsreplay/status')); } catch { /* Keep the original sync error visible. */ }
      }
    }
    finally { setBusy(''); }
  }
  async function exportCollection() {
    setError('');
    try {
      const data = await request('collection/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `deck-dust-collection-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error.message); }
  }
  return <Modal title={<span className="settings-modal-title">应用设置 <small>v{packageInfo.version}</small></span>} onClose={onClose} className="sync-modal settings-modal"
    headerActions={<>
      <a className="settings-header-icon" href="https://github.com/NingAres/DeckDust" target="_blank" rel="noopener noreferrer"
        aria-label="在 GitHub 上打开 Deck Dust 开源项目" data-tooltip="GitHub 开源项目"><Icon name="github" /></a>
      <span className="settings-header-icon is-static settings-about-trigger" role="img" tabIndex={0}
        aria-label={`Deck Dust 项目信息：炉石传说收藏管理、套牌构筑与开包记录工具。作者：柠。版本：${packageInfo.version}`}>
        <Icon name="infoCircle" />
        <span className="settings-about-tooltip" role="tooltip" aria-hidden="true">
          <strong>Deck Dust <small>v{packageInfo.version}</small></strong>
          <span>炉石传说收藏、套牌构筑和开包记录工具 · 作者：柠</span>
        </span>
      </span>
      <span className="settings-header-icon is-static settings-mail-trigger" role="img" tabIndex={0}
        aria-label="如需联系作者，请发送邮件至邮箱：ning_1004@126.com">
        <Icon name="mail" />
        <span className="settings-mail-tooltip" role="tooltip" aria-hidden="true">
          <span>如需联系作者，请发送邮件至邮箱：</span>
          <strong>ning_1004@126.com</strong>
        </span>
      </span>
    </>}>
    <div className="settings-sections" role="tablist" aria-label="设置类别">
      <button type="button" role="tab" aria-selected={section === 'sync'} aria-controls="settings-panel-sync" id="settings-tab-sync" tabIndex={section === 'sync' ? 0 : -1} onClick={() => setSection('sync')}>收藏同步</button>
      <button type="button" role="tab" aria-selected={section === 'packs'} aria-controls="settings-panel-packs" id="settings-tab-packs" tabIndex={section === 'packs' ? 0 : -1} onClick={() => setSection('packs')}>日志监控</button>
      <button type="button" role="tab" aria-selected={section === 'art'} aria-controls="settings-panel-art" id="settings-tab-art" tabIndex={section === 'art' ? 0 : -1} onClick={() => setSection('art')}>卡组插画</button>
    </div>
    {section === 'sync' ? <div key="sync" role="tabpanel" id="settings-panel-sync" aria-labelledby="settings-tab-sync" className="settings-tab-panel">
    <section className="sync-quick-settings" aria-label="快速同步设置">
      <fieldset className="sync-default-method"><legend>主界面「同步收藏」按钮</legend>
        <label className={syncPreferences.defaultMethod === 'hsreplay' ? 'selected' : ''}>
          <input type="radio" name="default-sync-method" value="hsreplay" checked={syncPreferences.defaultMethod === 'hsreplay'} disabled={!!busy} onChange={() => onSyncPreferencesChange({ ...syncPreferences, defaultMethod: 'hsreplay' })} />
          <span><strong>HSReplay 国服</strong><small>读取已连接账号的最新收藏</small></span>
        </label>
        <label className={syncPreferences.defaultMethod === 'file' ? 'selected' : ''}>
          <input type="radio" name="default-sync-method" value="file" checked={syncPreferences.defaultMethod === 'file'} disabled={!!busy} onChange={() => onSyncPreferencesChange({ ...syncPreferences, defaultMethod: 'file' })} />
          <span><strong>收藏 JSON 文件</strong><small>点击后选择本地导出文件</small></span>
        </label>
      </fieldset>
      <label className="sync-startup-option"><input type="checkbox" role="switch" aria-checked={syncPreferences.autoSyncOnLaunch} checked={syncPreferences.autoSyncOnLaunch} disabled={!!busy} onChange={event => onSyncPreferencesChange({ ...syncPreferences, autoSyncOnLaunch: event.target.checked })} /><span><strong>启动时自动同步</strong><small>仅从已连接的国服账号同步一次，不会后台轮询。</small></span></label>
    </section>
    <div className="dialog-tabs" role="tablist" aria-label="收藏数据来源" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || busy) return;
      const keys = ['hsreplay', 'file', 'backup'];
      const next = keys[(keys.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : 2)) % 3];
      event.preventDefault(); setTab(next); setError(''); document.getElementById(`sync-tab-${next}`)?.focus();
    }}>{[['hsreplay', 'HSReplay 同步'], ['file', '导入文件'], ['backup', '导出与恢复']].map(([key, name]) =>
      <button type="button" role="tab" aria-selected={tab === key} aria-controls={`sync-panel-${key}`} id={`sync-tab-${key}`} key={key} disabled={!!busy}
        tabIndex={tab === key ? 0 : -1}
        onClick={() => { setTab(key); setError(''); }}>{name}</button>)}
    </div>
    <div key={tab} role="tabpanel" id={`sync-panel-${tab}`} aria-labelledby={`sync-tab-${tab}`} className="sync-panel settings-tab-panel">
      {tab === 'file' ? <>
        <p>选择从 HDT / HSReplay 导出的收藏 JSON，预览后更新你的收藏。</p>
        <label className="file-picker"><span>选择收藏 JSON 文件</span><input type="file" accept=".json,application/json" aria-label="选择收藏 JSON 文件" disabled={!!busy} onChange={chooseFile} /></label>
        {candidate ? <div className="import-preview"><strong>{candidate.name}</strong>
          <dl><div><dt>有效记录</dt><dd>{candidate.stats.types.toLocaleString()} 种</dd></div><div><dt>已拥有记录</dt><dd>{candidate.stats.ownedTypes.toLocaleString()} 种</dd></div><div><dt>合计持有</dt><dd>{candidate.stats.copies.toLocaleString()} 张</dd></div></dl>
          <small>以上为导出文件全部记录；收藏页面只统计可构筑卡牌。</small>
        </div> : <p className="help-text">支持普通、金色、钻石、异画四种品质。导入前自动备份，空数据和错误数据不会替换现有收藏。</p>}
        <div className="dialog-actions"><button className="gold-button" disabled={!candidate || !!busy}
          onClick={() => run('import', { data: candidate.raw, source: candidate.name }, '收藏导入成功，进度已更新。')}>{busy === 'import' ? '正在保存…' : '导入并更新收藏'}</button></div>
      </> : null}
      {tab === 'hsreplay' ? <div className="hsreplay-connect">
        <p>登录时请选择炉石中国服务器账号。收藏会在应用启动时自动同步，也可以手动点击同步；其他地区不会保存或覆盖收藏。</p>
        <div className={`connection-status-card status-${auth.phase}`} role="status" aria-live="polite">
          <div className="connection-status-main">
            <span className="connection-status-icon"><Icon name={statusIcon} /></span>
            <div className="connection-status-copy">
              <div className="connection-status-heading">
                <strong>{statusTitle}</strong>
                <span className="connection-status-badges">
                  <span className="connection-state-badge">{statusBadge}</span>
                  {auth.region === 5 ? <span className="connection-region-badge">中国区</span> : null}
                </span>
              </div>
              <p>{auth.message || (auth.phase === 'connected' ? '登录状态保存在本机，可随时同步最新收藏。' : '登录 HSReplay 并打开“我的收藏”后，程序会自动获取数据。')}</p>
            </div>
          </div>
          {auth.phase === 'connected' || auth.phase === 'expired' ? <dl className="connection-details">
            <div className="connection-detail">
              <dt><Icon name="user" />账号昵称</dt>
              <dd>{auth.accountName || '暂未读取'}</dd>
            </div>
            <div className="connection-detail">
              <dt><Icon name="clock" />会话有效期</dt>
              <dd>{expiryLabel}</dd>
              {!validExpiry ? <small>由 HSReplay 管理；失效后同步时会提示重新登录。</small> : null}
            </div>
          </dl> : null}
        </div>
        <p className="help-text">登录窗口会停留在 HSReplay 的登录选择页，不会自动打开 Battle.net。请将地区选为 China（中国），再使用页面提供的微信、Google 或邮箱方式登录。收藏同步要求当前 HSReplay 账号已由 HDT 上传国服收藏；程序只接收中国区数据。登录会话由 Windows 加密保存在本机。</p>
        <div className="dialog-actions">
          {auth.phase === 'connected' ? <><button className="simple-button" disabled={!!busy} onClick={disconnect}>解除连接</button><button className="simple-button" disabled={!!busy} onClick={login}>重新登录</button><button className="gold-button" disabled={!!busy} onClick={() => run('sync', {}, 'HSReplay 收藏已同步。')}>{busy === 'sync' ? '正在同步…' : '立即同步收藏'}</button></> :
            auth.phase === 'expired' ? <><button className="simple-button" disabled={!!busy} onClick={disconnect}>解除连接</button><button className="gold-button" disabled={!!busy} onClick={login}>{busy === 'login' ? '正在打开…' : '重新登录 HSReplay'}</button></> :
            auth.phase === 'wrong_region' ? <><button className="simple-button" disabled={!!busy} onClick={disconnect}>解除外服连接</button><button className="gold-button" disabled={!!busy} onClick={login}>在登录窗口选择国服</button></> :
              <>{['opening', 'waiting', 'importing'].includes(auth.phase) ? <button className="simple-button" disabled={!!busy} onClick={refreshAuth}>{busy === 'status' ? '正在检查…' : '我已完成登录，检查状态'}</button> : null}
                <button className="gold-button" disabled={!!busy || auth.phase === 'loading' || ['opening', 'waiting', 'importing'].includes(auth.phase)} onClick={login}>{busy === 'login' ? '正在打开…' : ['opening', 'waiting', 'importing'].includes(auth.phase) ? '请在登录窗口继续…' : '登录 HSReplay 国服账号'}</button></>}
        </div>
    </div> : null}
      {tab === 'backup' ? <>
        <p>导出文件保留全部卡牌记录与品质数量，可重新导入。恢复功能会回到上次成功导入之前的收藏。</p>
        <div className="backup-actions"><button className="simple-button" onClick={exportCollection} disabled={!!busy || !Object.keys(snapshot.collection).length}>导出收藏 JSON</button>
          <button className="simple-button" disabled={!snapshot.hasBackup || !!busy} onClick={() => setConfirmRestore(true)}>恢复上次收藏</button></div>
        {confirmRestore ? <div className="restore-confirm"><p>将用上次导入前的备份替换当前收藏。</p><button className="gold-button" disabled={!!busy} onClick={() => run('restore', {}, '已恢复上次导入前的收藏。')}>{busy === 'restore' ? '正在恢复…' : '确认恢复备份'}</button></div> : null}
        {!snapshot.hasBackup ? <p className="help-text">首次导入后，再次更新收藏时会生成可恢复备份。</p> : null}
      </> : null}
    </div>
      <p className="source-note">{snapshot.meta.source ? `当前来源：${snapshot.meta.source}` : '尚未导入收藏'}{snapshot.meta.importedAt ? ` · ${new Date(snapshot.meta.importedAt).toLocaleString('zh-CN')}` : ''}</p>
    </div> : section === 'art' ? <div key="art" role="tabpanel" id="settings-panel-art" aria-labelledby="settings-tab-art" className="deck-art-preferences settings-tab-panel">
      <fieldset>
        <legend>卡组列表图片显示方式</legend>
        <label className={deckArtMode === 'cover' ? 'selected' : ''}>
          <input type="radio" name="deck-art-mode" value="cover" checked={deckArtMode === 'cover'} onChange={() => onDeckArtModeChange('cover')} />
          <span><strong>等比例铺满 · 主体靠上</strong><small>保持原图比例填满卡条；人形卡优先显示头部，其他卡按插画主体取景。</small></span>
        </label>
        <label className={deckArtMode === 'layered' ? 'selected' : ''}>
          <input type="radio" name="deck-art-mode" value="layered" checked={deckArtMode === 'layered'} onChange={() => onDeckArtModeChange('layered')} />
          <span><strong>清晰主体 · 柔化背景</strong><small>右侧显示清晰主体，左侧用同一插画的模糊背景铺满。</small></span>
        </label>
      </fieldset>
      <p className="help-text">此选择会立即应用并保存在本机，不影响已保存的套牌。</p>
    </div> : <div key="packs" role="tabpanel" id="settings-panel-packs" aria-labelledby="settings-tab-packs" className="settings-pack-panel settings-tab-panel">
      {packSettings ? <LogSettings embedded settings={packSettings} onSave={savePackSettings} onClose={() => {}} onNotice={onNotice} /> : <p className="help-text">正在读取开包监控设置…</p>}
    </div>}
    {error ? <div className="error-message" role="alert">{error}</div> : null}
  </Modal>;
}

