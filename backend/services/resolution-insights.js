const { pool } = require('../db/pool');
const { getConfig, isClosedFamily } = require('./manageengine-sync');

// Resolution Insights: how long technicians (ManageEngine's "technician" == srs.assigned_to) take to
// close the SRs assigned to them. Everything here is derived from fields the ManageEngine sync
// already stores - the request's creation time, its completion time, its technician, category
// (type) and scope - so there is nothing to enter by hand. pending_with / pending_since_date are
// deliberately not used: they are manual fields and say nothing about who did the work.
//
// Turnaround time (TAT) = ManageEngine completed_time - created_time, in calendar minutes. SRs that
// the sync never touched (no ManageEngine timestamps) fall back to their creation/closed *dates*
// (day precision) and are flagged `exact: false`, so the UI can say how much of a figure is precise.

const MINUTE_MS = 60 * 1000;
const DAY_MINUTES = 24 * 60;

// Upper bounds (exclusive, in minutes) of the TAT distribution buckets.
const TAT_BUCKETS = [
  { key: 'lt1d', label: 'Under 1 day', max: DAY_MINUTES },
  { key: '1to3d', label: '1 - 3 days', max: 3 * DAY_MINUTES },
  { key: '3to7d', label: '3 - 7 days', max: 7 * DAY_MINUTES },
  { key: '1to2w', label: '1 - 2 weeks', max: 14 * DAY_MINUTES },
  { key: '2to4w', label: '2 - 4 weeks', max: 28 * DAY_MINUTES },
  { key: 'gt4w', label: 'Over 4 weeks', max: Infinity },
];

const GROUP_DIMENSIONS = ['technician', 'month', 'week', 'type', 'scope'];
// Open SRs have no "closed month", so period dimensions describe closed work only.
const PERIOD_DIMENSIONS = new Set(['month', 'week']);

// Stored values are IST wall-clock strings ("YYYY-MM-DD HH:MM:SS" or a bare "YYYY-MM-DD"). Reading
// both as UTC keeps differences between them independent of the server's own timezone.
function wallClockMs(value) {
  if (!value) return null;
  const text = String(value).trim().replace(' ', 'T');
  const ms = Date.parse(text.length === 10 ? `${text}T00:00:00Z` : `${text}Z`);
  return Number.isNaN(ms) ? null : ms;
}

function minutesBetween(startValue, endValue) {
  const start = wallClockMs(startValue);
  const end = wallClockMs(endValue);
  if (start === null || end === null) return null;
  return Math.round((end - start) / MINUTE_MS);
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : null;
}

// Monday of the week containing the given YYYY-MM-DD date.
function weekStart(dateText) {
  const ms = wallClockMs(dateText);
  if (ms === null) return null;
  const date = new Date(ms);
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  return new Date(ms - sinceMonday * DAY_MINUTES * MINUTE_MS).toISOString().slice(0, 10);
}

// The weekly Deloitte PDF import writes a bare "Deloitte" into assigned_to, while ManageEngine's own
// technician is "Deloitte ERP Support". They are the same party (the Deloitte report matches both),
// so counting them as two technicians would split one team's figures in half.
function canonicalTechnician(name) {
  const trimmed = String(name || '').trim();
  return trimmed.toLowerCase().includes('deloitte') ? getConfig().externalTechnician : trimmed;
}

// Turns one srs row (dateStrings: true, so all dates arrive as strings) into the record every
// metric below works from. `now` is a wall-clock string in the same frame as the stored values.
function shapeRecord(row, now) {
  const closedStatus = row.status === 'Closed';
  // Closed here, but ManageEngine still shows the request open (an admin closed it ahead of the technician).
  // ManageEngine has no completed time yet, so the moment it was closed here counts as the finish time.
  const unconfirmed = closedStatus && !!row.manageengine_status && !isClosedFamily(row.manageengine_status);
  const closedHereAt = unconfirmed && !row.manageengine_closed_at ? row.closed_here_at || null : null;
  const exact = !!row.manageengine_created_at && (!closedStatus || !!row.manageengine_closed_at || !!closedHereAt);
  const createdAt = exact
    ? row.manageengine_created_at
    : (row.creation_date ? `${dateOnly(row.creation_date)} 00:00:00` : row.manageengine_created_at || null);
  const closedAt = !closedStatus
    ? null
    : exact
      ? row.manageengine_closed_at || closedHereAt
      : (row.closed_date ? `${dateOnly(row.closed_date)} 00:00:00` : null);

  const tat = closedStatus && createdAt && closedAt ? minutesBetween(createdAt, closedAt) : null;
  const resolved = tat !== null && tat >= 0;
  const ecd = dateOnly(row.expected_closure_date);

  return {
    id: row.id,
    sr_number: row.sr_number,
    description: row.description || null,
    technician: canonicalTechnician(row.assigned_to),
    scope: row.scope || null,
    type: row.type || null,
    status: row.status,
    created_by_name: row.created_by_name || null,
    created_at: createdAt,
    closed_at: resolved ? closedAt : null,
    resolved,
    tat_minutes: resolved ? tat : null,
    age_minutes: !closedStatus && createdAt ? Math.max(0, minutesBetween(createdAt, now) ?? 0) : null,
    expected_closure_date: ecd,
    overdue: !closedStatus && !!ecd && ecd < dateOnly(now),
    exact,
    unconfirmed,
  };
}

async function loadRecords() {
  const [[clock]] = await pool.query("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS now");
  const [rows] = await pool.query(`
    SELECT id, sr_number, description, assigned_to, scope, type, status, created_by_name,
           creation_date, closed_date, expected_closure_date,
           manageengine_created_at, manageengine_closed_at, manageengine_status,
           (SELECT MAX(h.changed_at) FROM sr_history h
             WHERE h.sr_id = srs.id AND h.field_changed = 'status' AND h.new_value = 'Closed' AND h.is_deleted = 0) AS closed_here_at
    FROM srs
    WHERE category = 'SR' AND is_deleted = 0 AND TRIM(COALESCE(assigned_to, '')) <> ''
  `);
  return { now: clock.now, records: rows.map(row => shapeRecord(row, clock.now)) };
}

function toList(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null;
}

function parseFilters(query = {}) {
  return {
    from: validDate(query.from),
    to: validDate(query.to),
    scope: ['Internal', 'External'].includes(query.scope) ? query.scope : null,
    types: toList(query.type),
    technicians: toList(query.technician),
    search: String(query.search || '').trim().toLowerCase() || null,
    // 'all' | 'closed' | 'open' - only the raw record list uses this; metrics always use both.
    state: ['closed', 'open'].includes(query.state) ? query.state : 'all',
  };
}

// The date range narrows *closed* work (by when it was closed). Open SRs are a live snapshot, so a
// historical range never hides what is still outstanding.
function applyFilters(records, filters) {
  const technicians = new Set(filters.technicians.map(t => t.toLowerCase()));
  const types = new Set(filters.types.map(t => t.toLowerCase()));
  return records.filter(r => {
    if (technicians.size && !technicians.has(r.technician.toLowerCase())) return false;
    if (filters.scope && r.scope !== filters.scope) return false;
    if (types.size && !types.has(String(r.type || '').toLowerCase())) return false;
    if (filters.search) {
      const haystack = `${r.sr_number} ${r.description || ''} ${r.type || ''} ${r.technician}`.toLowerCase();
      if (!haystack.includes(filters.search)) return false;
    }
    if (r.status === 'Closed') {
      if (!r.resolved) return false;
      const closedDay = dateOnly(r.closed_at);
      if (filters.from && closedDay < filters.from) return false;
      if (filters.to && closedDay > filters.to) return false;
    }
    return true;
  });
}

// Linear-interpolated percentile of an ascending-sorted array.
function percentile(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = (sorted.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

const round = value => (value === null || value === undefined ? null : Math.round(value));

function share(count, total) {
  return total ? Math.round((count / total) * 1000) / 10 : null;
}

// Closed-work and open-work figures for one set of records. `includeOpen: false` is for period
// groupings, where "open" has no meaning.
function summarize(records, { includeOpen = true } = {}) {
  const closed = records.filter(r => r.resolved);
  const tats = closed.map(r => r.tat_minutes).sort((a, b) => a - b);
  const total = tats.reduce((sum, v) => sum + v, 0);
  const fastest = closed.reduce((best, r) => (!best || r.tat_minutes < best.tat_minutes ? r : best), null);
  const slowest = closed.reduce((worst, r) => (!worst || r.tat_minutes > worst.tat_minutes ? r : worst), null);

  const summary = {
    closed: closed.length,
    avg_minutes: tats.length ? round(total / tats.length) : null,
    median_minutes: round(percentile(tats, 0.5)),
    p90_minutes: round(percentile(tats, 0.9)),
    min_minutes: tats.length ? tats[0] : null,
    max_minutes: tats.length ? tats[tats.length - 1] : null,
    fastest_sr: fastest ? fastest.sr_number : null,
    slowest_sr: slowest ? slowest.sr_number : null,
    within_1d_pct: share(tats.filter(v => v <= DAY_MINUTES).length, tats.length),
    within_3d_pct: share(tats.filter(v => v <= 3 * DAY_MINUTES).length, tats.length),
    within_7d_pct: share(tats.filter(v => v <= 7 * DAY_MINUTES).length, tats.length),
    exact_count: closed.filter(r => r.exact).length,
    unconfirmed_count: closed.filter(r => r.unconfirmed).length,
    open: null,
    open_avg_age_minutes: null,
    open_oldest_minutes: null,
    overdue: null,
    on_hold: null,
    waiting_on_user: null,
    assigned: null,
  };

  if (includeOpen) {
    const open = records.filter(r => r.status !== 'Closed');
    const ages = open.map(r => r.age_minutes).filter(v => v !== null);
    summary.open = open.length;
    summary.open_avg_age_minutes = ages.length ? round(ages.reduce((s, v) => s + v, 0) / ages.length) : null;
    summary.open_oldest_minutes = ages.length ? Math.max(...ages) : null;
    summary.overdue = open.filter(r => r.overdue).length;
    summary.on_hold = open.filter(r => r.status === 'On Hold').length;
    summary.waiting_on_user = open.filter(r => r.status === 'Pending with User').length;
    summary.assigned = closed.length + open.length;
  }
  return summary;
}

function distribution(records) {
  const counts = TAT_BUCKETS.map((b, i) => ({
    key: b.key, label: b.label, count: 0,
    from_minutes: i ? TAT_BUCKETS[i - 1].max : 0,
    to_minutes: Number.isFinite(b.max) ? b.max : null,
  }));
  for (const r of records) {
    if (!r.resolved) continue;
    const index = TAT_BUCKETS.findIndex(b => r.tat_minutes < b.max);
    counts[index].count++;
  }
  const total = counts.reduce((sum, b) => sum + b.count, 0);
  return counts.map(b => ({ ...b, pct: share(b.count, total) }));
}

// Group key for one record under a dimension, or null when the record has no value for it
// (e.g. an open SR under a period dimension).
function dimensionKey(record, dimension) {
  switch (dimension) {
    case 'technician': return record.technician;
    case 'type': return record.type || '(No type)';
    case 'scope': return record.scope || '(Not set)';
    case 'month': return record.resolved ? record.closed_at.slice(0, 7) : null;
    case 'week': return record.resolved ? weekStart(record.closed_at) : null;
    default: return null;
  }
}

function groupRecords(records, dimension) {
  const groups = new Map();
  for (const record of records) {
    const key = dimensionKey(record, dimension);
    if (key === null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return groups;
}

function sortGroups(rows, dimension) {
  if (PERIOD_DIMENSIONS.has(dimension)) return rows.sort((a, b) => a.key.localeCompare(b.key));
  return rows.sort((a, b) => (b.closed + (b.open || 0)) - (a.closed + (a.open || 0)) || a.key.localeCompare(b.key));
}

// One row per group of `dimension`, each with its own summary. With `thenBy`, every row also
// carries `cells`: the same summary for each value of the second dimension (a cross-tab), plus the
// ordered list of column keys so the client can lay the matrix out.
function explore(records, dimension, thenBy = null) {
  const includeOpen = !PERIOD_DIMENSIONS.has(dimension);
  const columns = thenBy
    ? [...groupRecords(records, thenBy).keys()].sort((a, b) => a.localeCompare(b))
    : [];

  const rows = [...groupRecords(records, dimension)].map(([key, members]) => {
    const row = { key, ...summarize(members, { includeOpen }) };
    if (thenBy) {
      const sub = groupRecords(members, thenBy);
      row.cells = {};
      for (const [columnKey, columnMembers] of sub) {
        row.cells[columnKey] = summarize(columnMembers, { includeOpen: includeOpen && !PERIOD_DIMENSIONS.has(thenBy) });
      }
    }
    return row;
  });

  return { dimension, thenBy, columns, rows: sortGroups(rows, dimension) };
}

function facets(records) {
  const technicians = new Map();
  for (const r of records) {
    const entry = technicians.get(r.technician) || { name: r.technician, scope: r.scope };
    technicians.set(r.technician, entry);
  }
  const closedDays = records.filter(r => r.resolved).map(r => dateOnly(r.closed_at)).sort();
  return {
    technicians: [...technicians.values()].sort((a, b) => a.name.localeCompare(b.name)),
    types: [...new Set(records.map(r => r.type).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    first_closed: closedDays[0] || null,
    last_closed: closedDays[closedDays.length - 1] || null,
  };
}

async function buildOverview(filters) {
  const { now, records: all } = await loadRecords();
  const records = applyFilters(all, filters);
  return {
    generated_at: now,
    summary: summarize(records),
    technicians: explore(records, 'technician').rows,
    trend: explore(records, 'month').rows,
    types: explore(records, 'type').rows,
    scopes: explore(records, 'scope').rows,
    distribution: distribution(records),
    facets: facets(all),
  };
}

async function buildExplore(filters, dimension, thenBy) {
  const { now, records: all } = await loadRecords();
  const records = applyFilters(all, filters);
  return {
    generated_at: now,
    summary: summarize(records),
    distribution: distribution(records),
    // Always the fixed month view, whatever the pivot is grouped by.
    trend: explore(records, 'month').rows,
    ...explore(records, dimension, thenBy),
    facets: facets(all),
  };
}

async function buildRecords(filters, limit = 5000) {
  const { now, records: all } = await loadRecords();
  const records = applyFilters(all, filters)
    .filter(r => filters.state === 'all' || (filters.state === 'closed' ? r.status === 'Closed' : r.status !== 'Closed'))
    .sort((a, b) => String(b.closed_at || b.created_at || '').localeCompare(String(a.closed_at || a.created_at || '')));
  return { generated_at: now, total: records.length, records: records.slice(0, limit) };
}

module.exports = {
  DAY_MINUTES,
  GROUP_DIMENSIONS,
  TAT_BUCKETS,
  applyFilters,
  buildExplore,
  buildOverview,
  buildRecords,
  distribution,
  explore,
  loadRecords,
  minutesBetween,
  parseFilters,
  percentile,
  shapeRecord,
  summarize,
  weekStart,
};
