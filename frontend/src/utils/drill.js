import dayjs from 'dayjs';

// Predicates for "show me the SRs behind this bar / row / cell". They run on the shaped records the
// Resolution API returns, using the same grouping rules the backend uses to build the figures.

const mondayOf = text => {
  const d = dayjs(text);
  return d.subtract((d.day() + 6) % 7, 'day').format('YYYY-MM-DD');
};

export function byDimension(dimension, key) {
  switch (dimension) {
    case 'technician': return r => r.technician === key;
    case 'type': return r => (r.type || '(No type)') === key;
    case 'scope': return r => (r.scope || '(Not set)') === key;
    case 'month': return r => r.resolved && r.closed_at.slice(0, 7) === key;
    case 'week': return r => r.resolved && mondayOf(r.closed_at) === key;
    default: return () => true;
  }
}

// A turnaround bucket from the distribution chart ({ from_minutes, to_minutes }, upper bound exclusive).
export const byBucket = bucket => r => r.resolved && r.tat_minutes >= bucket.from_minutes
  && (bucket.to_minutes === null || bucket.to_minutes === undefined || r.tat_minutes < bucket.to_minutes);

export const allOf = (...predicates) => r => predicates.every(p => p(r));
