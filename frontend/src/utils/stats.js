// Linear-interpolated percentile of an ascending-sorted array (null when empty).
export function percentile(sorted, p) {
  if (!sorted.length) return null;
  const rank = (sorted.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}
