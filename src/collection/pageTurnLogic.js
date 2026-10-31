export function shouldDeferWheelToGrid(cards, deltaY) {
  if (!['auto', 'scroll'].includes(cards.overflowY)) return false;
  const canScroll = cards.scrollHeight > cards.clientHeight + 2;
  return canScroll && ((deltaY > 0 && cards.scrollTop + cards.clientHeight < cards.scrollHeight - 2)
    || (deltaY < 0 && cards.scrollTop > 2));
}

