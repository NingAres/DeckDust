// Trim only uniform near-white/transparent edge bands, not bright details in art.
export function artworkContentBounds({ data, width, height }, stripFrame = false) {
  const blank = (x, y) => {
    const offset = (y * width + x) * 4;
    return data[offset + 3] < 8 || (Math.min(data[offset], data[offset + 1], data[offset + 2]) >= 235
      && Math.max(data[offset], data[offset + 1], data[offset + 2]) - Math.min(data[offset], data[offset + 1], data[offset + 2]) <= 20);
  };
  const edgeBlank = (x, y) => {
    const offset = (y * width + x) * 4;
    const min = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    const max = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    return data[offset + 3] < 8 || (min >= 218 && max - min <= 34);
  };
  const blankColumn = x => { for (let y = 0; y < height; y++) if (!blank(x, y)) return false; return true; };
  const blankRow = y => { for (let x = 0; x < width; x++) if (!blank(x, y)) return false; return true; };
  const maxX = Math.max(1, Math.floor(width * .45)), maxY = Math.max(1, Math.floor(height * .45));
  let left = 0, right = width, top = 0, bottom = height;
  while (left < maxX && blankColumn(left)) left++;
  while (width - right < maxX && blankColumn(right - 1)) right--;
  while (top < maxY && blankRow(top)) top++;
  while (height - bottom < maxY && blankRow(bottom - 1)) bottom--;
  // A large bright region may be intentional scenery; leave that edge alone.
  if (left === maxX) left = 0;
  if (width - right === maxX) right = width;
  if (top === maxY) top = 0;
  if (height - bottom === maxY) bottom = height;
  // JPEG/WebP fringes and card art exports can leave a few colored pixels
  // inside an otherwise white border. Tolerate those only in a narrow band.
  const mostlyBlankColumn = x => { let count = 0; for (let y = 0; y < height; y++) count += Number(edgeBlank(x, y)); return count / height >= .92; };
  const mostlyBlankRow = y => { let count = 0; for (let x = 0; x < width; x++) count += Number(edgeBlank(x, y)); return count / width >= .92; };
  const softMaxX = Math.max(2, Math.floor(width * .04)), softMaxY = Math.max(2, Math.floor(height * .04));
  while (left + 1 < softMaxX && mostlyBlankColumn(left) && mostlyBlankColumn(left + 1)) left++;
  while (width - right + 1 < softMaxX && mostlyBlankColumn(right - 1) && mostlyBlankColumn(right - 2)) right--;
  while (top + 1 < softMaxY && mostlyBlankRow(top) && mostlyBlankRow(top + 1)) top++;
  while (height - bottom + 1 < softMaxY && mostlyBlankRow(bottom - 1) && mostlyBlankRow(bottom - 2)) bottom--;
  if (stripFrame) {
    // Some strip sources have a colored outer fringe followed by a white mat.
    // Find that mat inside the edge zone rather than requiring a white first pixel.
    const frameEnd = (start, step, limit, isBlank) => {
      for (let offset = 0; offset < limit - 1; offset++) {
        let position = start + offset * step;
        if (!isBlank(position) || !isBlank(position + step)) continue;
        while (offset < limit && isBlank(position)) {
          position += step;
          offset++;
        }
        return offset < limit ? position : start;
      }
      return start;
    };
    if (left === 0) left = frameEnd(left, 1, Math.floor(width * .22), mostlyBlankColumn);
    if (right === width) right = frameEnd(right - 1, -1, Math.floor(width * .22), mostlyBlankColumn) + 1;
    if (top === 0) top = frameEnd(top, 1, Math.floor(height * .12), mostlyBlankRow);
    if (bottom === height) bottom = frameEnd(bottom - 1, -1, Math.floor(height * .12), mostlyBlankRow) + 1;
  }
  return { left, top, width: right - left, height: bottom - top };
}

const preparedArt = new Map();
export function stripArtworkBounds(width, height, type) {
  if (width / height >= 3) return { left: 0, top: 0, width, height };
  const cropHeight = Math.max(1, Math.min(height, Math.round(width / 4.3)));
  const focusY = type === 'MINION' || type === 'HERO' ? .25 : .5;
  return { left: 0, top: Math.max(0, Math.min(height - cropHeight, Math.round(height * focusY - cropHeight / 2))), width, height: cropHeight };
}
export function prepareDeckArtwork(url, { stripType } = {}) {
  const key = `${url}:${stripType || 'full'}`;
  if (preparedArt.has(key)) return preparedArt.get(key);
  const promise = new Promise(resolve => {
    const image = new Image();
    image.onerror = () => resolve(url);
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        let bounds = artworkContentBounds(context.getImageData(0, 0, canvas.width, canvas.height), !!stripType);
        if (stripType) {
          const focus = stripArtworkBounds(bounds.width, bounds.height, stripType);
          bounds = { left: bounds.left + focus.left, top: bounds.top + focus.top, width: focus.width, height: focus.height };
        }
        if (!bounds.left && !bounds.top && bounds.width === canvas.width && bounds.height === canvas.height) return resolve(url);
        canvas.width = bounds.width; canvas.height = bounds.height;
        context.drawImage(image, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
        resolve(canvas.toDataURL('image/png'));
      } catch { resolve(url); }
    };
    image.src = url;
  });
  if (preparedArt.size >= 32) preparedArt.delete(preparedArt.keys().next().value);
  preparedArt.set(key, promise);
  return promise;
}

