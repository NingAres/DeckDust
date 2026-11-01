import { deckClass, deckLimit, effectiveDeckTotal, HERO_ART, isDeckCompanion } from './model.js';
import { loadArt } from '../collection/api.js';
import { prepareDeckArtwork } from './artwork.js';
import { CLASSES } from '../collection/model.js';

const NORMAL_DUST = { COMMON: 40, RARE: 100, EPIC: 400, LEGENDARY: 1600 };
const GOLD_DUST = { COMMON: 400, RARE: 800, EPIC: 1600, LEGENDARY: 3200 };
const QUALITY_COLORS = { normal: '#c8b991', golden: '#f0c94c', diamond: '#8eeaff', signature: '#4bd2b1' };
const safeName = name => String(name || '套牌').replace(/[<>:"/\\|?*]/g, '_').slice(0, 80);

async function getArt(card, type = 'strip') {
  if (!card?.id) return null;
  try {
    const first = await loadArt(card.id, type);
    const prepared = await prepareDeckArtwork(first.url, first.quality === 'strip' ? {} : { stripType: card.type || 'SPELL' });
    return await imageFromUrl(prepared);
  } catch {
    if (type === 'tile') return null;
    try {
      const fallback = await loadArt(card.id, 'tile');
      return await imageFromUrl(await prepareDeckArtwork(fallback.url, { stripType: card.type || 'SPELL' }));
    } catch { return null; }
  }
}

function imageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function coverCrop(image, x, y, width, height, focusY = .25) {
  const scale = Math.max(width / image.width, height / image.height);
  const sw = width / scale, sh = height / scale;
  const sx = (image.width - sw) / 2;
  const sy = Math.max(0, Math.min(image.height - sh, image.height * focusY - sh / 2));
  return [sx, sy, sw, sh, x, y, width, height];
}

function deckRows(deck, cards) {
  const byId = new Map(cards.map(card => [card.dbfId, card]));
  return deck.entries.flatMap(entry => {
    const card = byId.get(entry.id);
    const qualities = Object.entries(entry.variants || {}).filter(([, count]) => count > 0);
    const copies = qualities.length ? qualities.flatMap(([quality, count]) => Array.from({ length: Math.min(count, 80) }, () => ({ quality, card })))
      : Array.from({ length: Math.min(entry.count || 0, 80) }, () => ({ quality: 'normal', card }));
    return copies.map(row => ({ ...row, id: entry.id, companion: isDeckCompanion(entry.id) }));
  }).sort((a, b) => (a.card?.cost ?? 99) - (b.card?.cost ?? 99)
    || (a.card?.name || '').localeCompare(b.card?.name || '', 'zh-CN') || a.id - b.id);
}

function craftingTotals(deck, cards) {
  const byId = new Map(cards.map(card => [card.dbfId, card]));
  let normal = 0, golden = 0;
  for (const entry of deck.entries) {
    if (isDeckCompanion(entry.id)) continue;
    const card = byId.get(entry.id);
    if (!card || card.set === 'CORE') continue;
    normal += (NORMAL_DUST[card.rarity] || 0) * entry.count;
    golden += (GOLD_DUST[card.rarity] || 0) * entry.count;
  }
  return { normal, golden };
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
}

function drawCurve(ctx, curve, x, y, width, height) {
  const max = Math.max(1, ...curve), gap = 5, itemWidth = (width - gap * 7) / 8;
  ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center';
  curve.forEach((count, index) => {
    const barHeight = Math.max(count ? 4 : 1, (height - 24) * count / max);
    const left = x + index * (itemWidth + gap);
    ctx.fillStyle = '#e4ba57'; ctx.fillRect(left, y + height - 21 - barHeight, itemWidth, barHeight);
    ctx.fillStyle = '#f4e6c9'; ctx.fillText(String(count), left + itemWidth / 2, y + height - 25 - barHeight);
    ctx.fillStyle = '#d7c7a7'; ctx.fillText(index === 7 ? '7+' : String(index), left + itemWidth / 2, y + height - 4);
  });
}

function drawRow(ctx, row, image, x, y, width, height, mode) {
  roundedRect(ctx, x, y, width, height, 5);
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#18222d'; ctx.fillRect(x, y, width, height);
  if (image && mode === 'layered') {
    ctx.save(); ctx.filter = 'blur(9px) saturate(.85)';
    ctx.drawImage(image, ...coverCrop(image, x - 8, y - 8, width + 16, height + 16, row.card?.type === 'MINION' ? .25 : .5)); ctx.restore();
    const artWidth = width * .72;
    const layer = document.createElement('canvas'); layer.width = Math.ceil(artWidth); layer.height = height;
    const layerCtx = layer.getContext('2d');
    layerCtx.drawImage(image, ...coverCrop(image, 0, 0, artWidth, height, row.card?.type === 'MINION' ? .25 : .5));
    const mask = layerCtx.createLinearGradient(0, 0, artWidth, 0);
    mask.addColorStop(0, 'rgba(0,0,0,0)'); mask.addColorStop(.2, 'rgba(0,0,0,.2)'); mask.addColorStop(.62, '#000'); mask.addColorStop(1, '#000');
    layerCtx.globalCompositeOperation = 'destination-in'; layerCtx.fillStyle = mask; layerCtx.fillRect(0, 0, artWidth, height);
    ctx.drawImage(layer, x + width - artWidth, y);
  } else if (image) {
    ctx.drawImage(image, ...coverCrop(image, x + width * .22, y, width * .78, height, row.card?.type === 'MINION' ? .25 : .5));
  }
  const overlay = ctx.createLinearGradient(x, y, x + width, y);
  overlay.addColorStop(0, '#101820f2'); overlay.addColorStop(.52, '#101820b8'); overlay.addColorStop(1, '#10182025');
  ctx.fillStyle = overlay; ctx.fillRect(x, y, width, height);
  ctx.restore();
  ctx.strokeStyle = QUALITY_COLORS[row.quality] || QUALITY_COLORS.normal; ctx.lineWidth = 1.5;
  roundedRect(ctx, x + .75, y + .75, width - 1.5, height - 1.5, 5); ctx.stroke();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillStyle = '#9bdcff'; ctx.beginPath(); ctx.arc(x + 19, y + height / 2, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#10202c'; ctx.font = '700 14px system-ui, sans-serif'; ctx.fillText(String(row.card?.cost ?? '?'), x + 19, y + height / 2 + 1);
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff2d5'; ctx.font = '600 14px system-ui, sans-serif';
  const name = row.card?.name || `未知卡牌 #${row.id}`;
  const maxNameWidth = width - 100;
  let displayName = name; while (displayName.length > 1 && ctx.measureText(displayName).width > maxNameWidth) displayName = `${displayName.slice(0, -2)}…`;
  ctx.fillText(displayName, x + 39, y + height / 2 + 1);
  ctx.textAlign = 'right'; ctx.fillStyle = QUALITY_COLORS[row.quality] || '#fff0c8'; ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText('×1', x + width - 11, y + height / 2 + 1);
}

export async function exportDeckPng(deck, cards, artMode = 'cover') {
  const rows = deckRows(deck, cards);
  const cls = deckClass(deck, cards);
  const hero = cards.find(card => card.dbfId === deck.hero) || cards.find(card => card.id === HERO_ART[cls]);
  const heroArt = await getArt(hero, 'tile');
  const rowImages = new Map();
  await Promise.all([...new Set(rows.map(row => row.id))].map(async id => {
    const row = rows.find(item => item.id === id);
    rowImages.set(id, await getArt(row.card));
  }));

  const width = 1200, margin = 28, gap = 18, columnWidth = (width - margin * 2 - gap) / 2;
  const headerHeight = 178, rowHeight = 35, rowGap = 5, rowsPerColumn = Math.ceil(rows.length / 2);
  const height = Math.max(330, margin * 2 + headerHeight + rowsPerColumn * rowHeight + Math.max(0, rowsPerColumn - 1) * rowGap);
  const scale = 2, canvas = document.createElement('canvas'); canvas.width = width * scale; canvas.height = height * scale;
  const ctx = canvas.getContext('2d'); ctx.scale(scale, scale);
  const bg = ctx.createLinearGradient(0, 0, width, height); bg.addColorStop(0, '#283b4e'); bg.addColorStop(1, '#172838'); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#d6b45f'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, width - 20, height - 20);

  const avatarX = margin, avatarY = margin, avatarSize = 92;
  ctx.save(); roundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 8); ctx.clip();
  ctx.fillStyle = '#18222d'; ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  if (heroArt) ctx.drawImage(heroArt, ...coverCrop(heroArt, avatarX, avatarY, avatarSize, avatarSize, .25));
  ctx.restore(); ctx.strokeStyle = '#d9b85e'; ctx.lineWidth = 3; roundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 8); ctx.stroke();
  ctx.fillStyle = '#f2d68f'; ctx.font = '700 24px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(deck.name || '未命名套牌', margin + avatarSize + 18, margin + 28);
  const className = CLASSES.find(([key]) => key === cls)?.[1] || '自定义英雄';
  ctx.fillStyle = '#ddc99e'; ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`${className}  ·  ${deck.format === 1 ? '狂野' : deck.format === 3 ? '经典' : '标准'}  ·  ${effectiveDeckTotal(deck)}/${deckLimit(deck)} 张`, margin + avatarSize + 18, margin + 54);
  const totals = craftingTotals(deck, cards);
  ctx.font = '700 21px system-ui, sans-serif'; ctx.fillStyle = '#eee0c0';
  ctx.fillText(`普通合成  ${totals.normal.toLocaleString()} 尘`, margin + avatarSize + 18, margin + 91);
  ctx.fillStyle = '#ffd12d'; ctx.fillText(`金卡制作  ${totals.golden.toLocaleString()} 尘`, margin + avatarSize + 18, margin + 123);
  const curve = Array(8).fill(0);
  rows.forEach(row => { curve[Math.min(7, row.card?.cost || 0)] += 1; });
  drawCurve(ctx, curve, width - margin - 260, margin + 18, 260, 110);
  ctx.fillStyle = '#e9d59f'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(`${rows.length} 张 · Deck Dust`, width - margin, margin + 149);

  const startY = margin + headerHeight;
  rows.forEach((row, index) => {
    const column = Math.floor(index / rowsPerColumn), line = index % rowsPerColumn;
    const x = margin + column * (columnWidth + gap), y = startY + line * (rowHeight + rowGap);
    drawRow(ctx, row, rowImages.get(row.id), x, y, columnWidth, rowHeight, artMode);
  });
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('无法生成 PNG 图片。')), 'image/png'));
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${safeName(deck.name)}.png`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
