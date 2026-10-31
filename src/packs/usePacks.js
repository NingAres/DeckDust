import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../collection/api.js';

const EMPTY = { records: [], expansions: [], statsRecords: [], cycles: [], recentRecords: [], pending: [], migration: [], adjustments: [], settings: {}, revision: -1 };
export default function usePacks() {
  const [snapshot, setSnapshot] = useState(EMPTY), [monitor, setMonitor] = useState({ enabled: false, message: '正在读取监控状态' });
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const revision = useRef(-1);
  const refresh = useCallback(async signal => {
    const result = await request('packs', undefined, signal);
    revision.current = result.revision; setSnapshot(result);
    if (result.monitor) setMonitor(result.monitor);
    setError(''); return result;
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let timer;
    async function poll() {
      try {
        const result = await request('packs/status', undefined, controller.signal);
        setMonitor(result.monitor);
        if (result.revision !== revision.current) await refresh(controller.signal);
      } catch (error) { if (error.name !== 'AbortError') setError(error.message); }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
    }
    refresh(controller.signal).catch(error => { if (error.name !== 'AbortError') setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(poll, 2000); } });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [refresh]);
  const mutate = useCallback(async (path, body) => {
    try {
      const result = await request(`packs/${path}`, body);
      await refresh(); return result;
    } catch (error) { setError(error.message); throw error; }
  }, [refresh]);
  return { ...snapshot, monitor, loading, error, refresh, mutate };
}

