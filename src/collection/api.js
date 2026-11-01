export async function request(path, body, signal) {
  const response = await fetch(`/api/${path}`, body === undefined ? { signal } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  });
  const data = await response.json().catch(() => ({ error: '本地服务返回了无效响应。' }));
  if (!response.ok) throw new Error(data.error || '操作失败，请重试。');
  return data;
}

export async function saveDeckExport(name, blob) {
  if (!window.pywebview?.api) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { name, destination: 'browser' };
  }

  const response = await fetch(`/api/deck-exports?name=${encodeURIComponent(name)}`, {
    method: 'POST', headers: { 'Content-Type': blob.type }, body: blob,
  });
  const data = await response.json().catch(() => ({ error: '本地导出服务返回了无效响应。' }));
  if (!response.ok) throw new Error(data.error || '无法保存套牌导出文件。');
  return { ...data, destination: 'app' };
}

// Shared request queue bounds network work even when the user changes pages quickly.
const artCache = new Map();
const queue = [];
let active = 0;
function pump() {
  queue.sort((a, b) => a.priority - b.priority || a.order - b.order);
  while (active < 4 && queue.length) {
    const { run: job } = queue.shift();
    active++;
    job().finally(() => { active--; pump(); });
  }
}
let queueOrder = 0;
export function loadArt(id, quality, prefetch = false) {
  const key = `${id}/${quality}`;
  if (artCache.has(key)) {
    const queued = queue.find(job => job.key === key);
    if (queued && !prefetch) { queued.priority = 0; pump(); }
    return artCache.get(key);
  }
  const task = new Promise((resolve, reject) => {
    queue.push({ key, priority: prefetch ? 1 : 0, order: queueOrder++, run: async () => {
      try {
        const response = await fetch(`/api/art/${key}`);
        if (!response.ok) throw new Error('卡面暂不可用');
        const url = URL.createObjectURL(await response.blob());
        resolve({ url, quality: response.headers.get('X-Art-Quality') || quality });
      } catch (error) { artCache.delete(key); reject(error); }
    }});
    pump();
  });
  artCache.set(key, task);
  // Avoid keeping an unlimited number of object URLs during a long collection session.
  if (artCache.size > 160) {
    const oldest = artCache.keys().next().value;
    const value = artCache.get(oldest);
    artCache.delete(oldest);
    value.then(result => setTimeout(() => URL.revokeObjectURL(result.url), 60000)).catch(() => {});
  }
  return task;
}

export function prefetchArt(cards, quality) {
  for (const card of cards) {
    const cardQuality = card.displayQuality || quality;
    if (!cardQuality) continue;
    loadArt(card.id, cardQuality, true).catch(() => {});
  }
}

