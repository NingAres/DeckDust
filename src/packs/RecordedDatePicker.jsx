import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';

const dateKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
export default function RecordedDatePicker({ value, onChange, events }) {
  const available = [...new Set(events.map(event => event.date.slice(0, 10)))].sort();
  const months = [...new Set(available.map(date => date.slice(0, 7)))];
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7) || months.at(-1) || '2026-10');
  const root = useRef(null), trigger = useRef(null);
  const [year, monthNumber] = month.split('-').map(Number);
  const firstWeekday = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, monthNumber, 0).getDate();
  const counts = new Map();
  for (const event of events) { const date = event.date.slice(0, 10); counts.set(date, (counts.get(date) || 0) + 1); }
  useEffect(() => {
    if (!open) return;
    function outside(event) { if (!root.current?.contains(event.target)) setOpen(false); }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function choose(date) { onChange(date); setOpen(false); trigger.current?.focus(); }
  function step(direction) { const date = new Date(year, monthNumber - 1 + direction, 1); setMonth(dateKey(date.getFullYear(), date.getMonth(), 1).slice(0, 7)); }
  return <div className="pack-recorded-date-picker" ref={root} onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" className={`pack-date-trigger ${value ? 'has-date' : ''}`} aria-label={value ? `日期筛选：${value}` : '日期筛选：全部日期'} title={value ? `筛选日期：${value}` : '按日期筛选'} aria-expanded={open} aria-haspopup="dialog" disabled={!available.length} onClick={() => { setMonth(value.slice(0, 7) || months.at(-1) || '2026-10'); setOpen(previous => !previous); }}><Icon name="calendar" /></button>
    {open ? <div className="pack-date-calendar" role="dialog" aria-label="有实包记录的日期"><header><button type="button" className="icon-button" aria-label="上个月" disabled={month <= months[0]} onClick={() => step(-1)}><Icon name="left" /></button><select aria-label="跳转有记录的月份" value={month} onChange={event => setMonth(event.target.value)}>{months.includes(month) ? null : <option value={month}>{month.replace('-', ' 年 ')} 月</option>}{months.map(key => <option key={key} value={key}>{key.replace('-', ' 年 ')} 月</option>)}</select><button type="button" className="icon-button" aria-label="下个月" disabled={month >= months.at(-1)} onClick={() => step(1)}><Icon name="right" /></button></header>
      <div className="pack-calendar-weekdays">{['一', '二', '三', '四', '五', '六', '日'].map(day => <span key={day}>{day}</span>)}</div><div className="pack-calendar-days">{Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: days }, (_, index) => { const day = index + 1, key = dateKey(year, monthNumber - 1, day), count = counts.get(key) || 0; return <button type="button" key={key} disabled={!count} aria-label={`${key}${count ? `，${count}包记录` : '，无实包记录'}`} aria-pressed={value === key} title={count ? `${count} 包记录` : '没有实包记录'} onClick={() => choose(key)}><span>{day}</span>{count ? <i /> : null}</button>; })}</div><footer><span>有圆点的日期可选 · 无记录日期已禁用</span><button type="button" className="pack-date-reset" onClick={() => choose('')}>全部日期</button></footer>
    </div> : null}
  </div>;
}

