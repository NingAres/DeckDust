export function metricLeaders(values, lower = false) {
  const valid = values.filter(value => value !== null && Number.isFinite(value));
  if (new Set(valid).size < 2) return [];
  const best = lower ? Math.min(...valid) : Math.max(...valid);
  return values.flatMap((value, index) => value === best ? [index] : []);
}

// Count three independent, per-card/per-pack metrics equally. Pack volume and
// legendary interval (the inverse of legendary rate) must not inflate a score.
export function overallPackLeaders(rows) {
  const scores = rows.map(() => 0);
  for (const metric of ['epicRatio', 'legendaryRatio', 'average']) {
    for (const index of metricLeaders(rows.map(row => Number(row[metric])))) scores[index]++;
  }
  const best = Math.max(0, ...scores);
  return { scores, leaders: best > 0 ? scores.flatMap((score, index) => score === best ? [index] : []) : [] };
}
