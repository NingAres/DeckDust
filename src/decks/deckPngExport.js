import { deckClass, deckLimit, effectiveDeckTotal, encodeDeck, HERO_ART, isDeckCompanion } from './model.js';
import { loadArt } from '../collection/api.js';
import { prepareDeckArtwork } from './artwork.js';
import { CLASSES } from '../collection/model.js';
import { saveDeckExport } from '../collection/api.js';

const NORMAL_DUST = { COMMON: 40, RARE: 100, EPIC: 400, LEGENDARY: 1600 };
const GOLD_DUST = { COMMON: 400, RARE: 800, EPIC: 1600, LEGENDARY: 3200 };
const RARITY_COLORS = {
  FREE: '#b9bdc1', COMMON: '#f4ead6', RARE: '#43bcff', EPIC: '#c47be8', LEGENDARY: '#ff9f3d',
};
const safeName = name => String(name || '套牌').replace(/[<>:"/\\|?*]/g, '_').slice(0, 80);

async function getArt(card, type = 'strip') {
  const ids = [...new Set([card?.id, card?.dbfId].filter(Boolean))];
  for (const id of ids) for (const quality of type === 'tile' ? ['tile', 'strip'] : ['strip', 'tile']) {
    try {
      const result = await loadArt(id, quality);
      const prepared = await prepareDeckArtwork(result.url, result.quality === 'strip' ? {} : { stripType: card.type || 'SPELL' });
      return await imageFromUrl(prepared);
    } catch { /* Try the alternate art key and crop size before giving up. */ }
  }
  return null;
}

async function getPortraitArt(card) {
  const ids = [...new Set([card?.id, card?.dbfId].filter(Boolean))];
  for (const id of ids) {
    try {
      const result = await loadArt(id, 'tile');
      return await imageFromUrl(result.url);
    } catch { /* Fall back to the class emblem if no portrait art is available. */ }
  }
  return null;
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

function inferExportClass(deck, cards) {
  const mapped = deckClass(deck, cards);
  if (mapped) return mapped;
  const byId = new Map(cards.map(card => [card.dbfId, card]));
  const scores = new Map();
  for (const entry of deck.entries) {
    const card = byId.get(entry.id);
    for (const key of card?.classes || [card?.cardClass]) {
      if (key && key !== 'NEUTRAL' && CLASSES.some(([name]) => name === key)) scores.set(key, (scores.get(key) || 0) + entry.count);
    }
  }
  return [...scores].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function loadStaticImage(src) { return imageFromUrl(src).catch(() => null); }

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

function drawRow(ctx, row, image, x, y, width, height) {
  roundedRect(ctx, x, y, width, height, 5);
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#18222d'; ctx.fillRect(x, y, width, height);
  const focusY = row.card?.type === 'MINION' || row.card?.type === 'HERO' ? .24 : .5;
  if (image) {
    const artWidth = Math.round(width * .58);
    const artX = x + width - artWidth;
    ctx.save();
    ctx.filter = 'blur(8px)'; ctx.globalAlpha = .5;
    ctx.drawImage(image, ...coverCrop(image, artX, y, artWidth, height, focusY));
    ctx.restore();
    ctx.drawImage(image, ...coverCrop(image, artX, y, artWidth, height, focusY));
    const blend = ctx.createLinearGradient(artX - 24, 0, artX + 86, 0);
    blend.addColorStop(0, '#18222d'); blend.addColorStop(.22, '#18222d');
    blend.addColorStop(.58, '#18222db8'); blend.addColorStop(1, '#18222d00');
    ctx.fillStyle = blend; ctx.fillRect(x, y, width, height);
  }
  const overlay = ctx.createLinearGradient(x, y, x + width, y);
  overlay.addColorStop(0, '#10182050'); overlay.addColorStop(.5, '#10182030');
  overlay.addColorStop(.8, '#10182008'); overlay.addColorStop(1, '#10182080');
  ctx.fillStyle = overlay; ctx.fillRect(x, y, width, height);
  ctx.restore();
  const rarity = row.card?.rarity || 'FREE';
  const rarityColor = RARITY_COLORS[rarity] || RARITY_COLORS.COMMON;
  ctx.strokeStyle = rarityColor; ctx.lineWidth = 1.5;
  roundedRect(ctx, x + .75, y + .75, width - 1.5, height - 1.5, 5); ctx.stroke();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillStyle = '#9bdcff'; ctx.beginPath(); ctx.arc(x + 19, y + height / 2, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#10202c'; ctx.font = '700 13px system-ui, sans-serif'; ctx.fillText(String(row.card?.cost ?? '?'), x + 19, y + height / 2 + .5);
  ctx.fillStyle = '#fff2d5'; ctx.font = '600 12px system-ui, sans-serif';
  const name = row.card?.name || `未知卡牌 #${row.id}`;
  const nameX = x + 42, countX = x + width - 12;
  ctx.textAlign = 'right'; ctx.font = '700 12px system-ui, sans-serif'; ctx.fillStyle = rarityColor;
  const count = '×1', countWidth = ctx.measureText(count).width;
  ctx.fillText(count, countX, y + height / 2 + .5);
  ctx.textAlign = 'left'; ctx.font = '600 12px system-ui, sans-serif';
  const maxNameWidth = countX - nameX - countWidth - 12;
  let displayName = name;
  let nameLength = name.length;
  while (nameLength > 1 && ctx.measureText(displayName).width > maxNameWidth) {
    nameLength--;
    displayName = `${name.slice(0, nameLength)}…`;
  }
  ctx.fillStyle = '#fff2d5'; ctx.fillText(displayName, nameX, y + height / 2 + .5);
}

export async function exportDeckPng(deck, cards) {
  const rows = deckRows(deck, cards);
  const cls = inferExportClass(deck, cards);
  const hero = cards.find(card => card.dbfId === deck.hero) || cards.find(card => card.id === HERO_ART[cls]);
  const [heroArt, classEmblem, dustIcon] = await Promise.all([
    getPortraitArt(hero),
    loadStaticImage(`/assets/native-ui/class-emblems/${CLASSES.find(([key]) => key === cls)?.[2] || 'Neutral'}.png`),
    loadStaticImage('/assets/pack-icons/dust.png'),
  ]);
  const rowImages = new Map();
  await Promise.all([...new Set(rows.map(row => row.id))].map(async id => {
    const row = rows.find(item => item.id === id);
    rowImages.set(id, await getArt(row.card));
  }));

  const margin = 24, gap = 16, columnWidth = 300, width = margin * 2 + gap + columnWidth * 2;
  const headerHeight = 160, rowHeight = 40, rowGap = 5, rowsPerColumn = Math.ceil(rows.length / 2);
  const deckCode = deck.code || encodeDeck(deck);
  const codeFont = '12px ui-monospace, Consolas, monospace';
  const codeMeasure = document.createElement('canvas').getContext('2d'); codeMeasure.font = codeFont;
  const codeLines = [];
  let remainingCode = deckCode;
  while (remainingCode) {
    let length = remainingCode.length;
    while (length > 1 && codeMeasure.measureText(remainingCode.slice(0, length)).width > width - margin * 2 - 28) length--;
    codeLines.push(remainingCode.slice(0, length)); remainingCode = remainingCode.slice(length);
  }
  const listBottom = margin + headerHeight + rowsPerColumn * rowHeight + Math.max(0, rowsPerColumn - 1) * rowGap;
  const codePanelHeight = 38 + codeLines.length * 17;
  const height = Math.max(330, listBottom + 14 + codePanelHeight + margin);
  const scale = 1, canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); ctx.scale(scale, scale);
  const bg = ctx.createLinearGradient(0, 0, width, height); bg.addColorStop(0, '#283b4e'); bg.addColorStop(1, '#172838'); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#d6b45f'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, width - 20, height - 20);

  const avatarX = margin, avatarY = margin, avatarSize = 120;
  ctx.save(); roundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 8); ctx.clip();
  ctx.fillStyle = '#18222d'; ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  if (heroArt) ctx.drawImage(heroArt, ...coverCrop(heroArt, avatarX, avatarY, avatarSize, avatarSize, .25));
  else if (classEmblem) ctx.drawImage(classEmblem, avatarX + 13, avatarY + 13, avatarSize - 26, avatarSize - 26);
  ctx.restore(); ctx.strokeStyle = '#d9b85e'; ctx.lineWidth = 3; roundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 8); ctx.stroke();
  ctx.fillStyle = '#f2d68f'; ctx.font = '700 24px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(deck.name || '未命名套牌', margin + avatarSize + 18, margin + 28);
  const className = CLASSES.find(([key]) => key === cls)?.[1] || '自定义英雄';
  ctx.fillStyle = '#ddc99e'; ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`${className}  ·  ${deck.format === 1 ? '狂野' : deck.format === 3 ? '经典' : '标准'}  ·  ${effectiveDeckTotal(deck)}/${deckLimit(deck)} 张`, margin + avatarSize + 18, margin + 54);
  const totals = craftingTotals(deck, cards);
  const dustY = margin + 105, dustSize = 23;
  if (dustIcon) ctx.drawImage(dustIcon, margin + avatarSize + 18, dustY - 18, dustSize, dustSize);
  ctx.fillStyle = '#eee0c0'; ctx.font = '700 22px system-ui, sans-serif'; ctx.fillText(totals.normal.toLocaleString(), margin + avatarSize + 48, dustY);
  if (dustIcon) {
    ctx.drawImage(dustIcon, margin + avatarSize + 172, dustY - 18, dustSize, dustSize);
  }
  ctx.fillStyle = '#ffd12d'; ctx.fillText(totals.golden.toLocaleString(), margin + avatarSize + 202, dustY);
  const curve = Array(8).fill(0);
  rows.forEach(row => { curve[Math.min(7, row.card?.cost || 0)] += 1; });
  drawCurve(ctx, curve, width - margin - 180, margin + 14, 180, 100);
  const startY = margin + headerHeight;
  rows.forEach((row, index) => {
    const column = Math.floor(index / rowsPerColumn), line = index % rowsPerColumn;
    const x = margin + column * (columnWidth + gap), y = startY + line * (rowHeight + rowGap);
    drawRow(ctx, row, rowImages.get(row.id), x, y, columnWidth, rowHeight);
  });
  const codeY = listBottom + 14;
  roundedRect(ctx, margin, codeY, width - margin * 2, codePanelHeight, 7);
  ctx.fillStyle = '#142332'; ctx.fill(); ctx.strokeStyle = '#c8a858'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#e7c971'; ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText('卡组代码', margin + 13, codeY + 17);
  ctx.fillStyle = '#e3dbc8'; ctx.font = codeFont;
  codeLines.forEach((line, index) => ctx.fillText(line, margin + 13, codeY + 34 + index * 17));
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('无法生成 PNG 图片。')), 'image/png'));
  return saveDeckExport(`${safeName(deck.name)}.png`, blob);
}
