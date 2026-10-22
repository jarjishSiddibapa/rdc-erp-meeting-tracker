const { pool } = require('../db/pool');
const { minutesBetween, percentile, DAY_MINUTES, parseFilters: parseRangeFilters } = require('./resolution-insights');

// Pending With Insights: how long each person has had (or had) an SR sitting with them.
//
// The source is the SR change log. Every time someone edits Pending With the log records who it moved from
// and to and when, so the period an SR spent with a person is the gap between the change that gave it to them
// and the change that took it away (or the SR being closed). The SR's own "Pending Since" date is used for the
// hold that is still running, because that is the date people see and maintain on the SR.
//
// Limits, all surfaced to the UI instead of being hidden:
//  - the log only goes back to when Pending With was first tracked, so an SR's first recorded holder has no
//    known start: that hold counts as "SRs held" but not towards durations (`start_known: false`);
//  - an SR whose Pending With never changed and has no Pending Since date is timed from the day it was raised,
//    flagged `estimated`;
//  - a handover is stamped when it was recorded here, which can lag the real handover.

// Upper bounds (exclusive, minutes) for hold durations; the same bands as the turnaround chart.
const HOLD_BUCKETS = [
  { key: 'lt1d', label: 'Under 1 day', max: DAY_MINUTES },
  { key: '1to3d', label: '1 - 3 days', max: 3 * DAY_MINUTES },
  { key: '3to7d', label: '3 - 7 days', max: 7 * DAY_MINUTES },
  { key: '1to2w', label: '1 - 2 weeks', max: 14 * DAY_MINUTES },
  { key: '2to4w', label: '2 - 4 weeks', max: 28 * DAY_MINUTES },
  { key: 'gt4w', label: 'Over 4 weeks', max: Infinity },
];

const norm = value => String(value || '').trim().replace(/\s+/g, ' ');
const dateOnly = value => (value ? String(value).slice(0, 10) : null);

// "Pending With" is typed by hand, so one person shows up as "jarjish", "Jarjish Siddibapa", "Suresh Kumar" and
// "Suresh Kumar S". A name that is a whole-word prefix of exactly one longer name is the same person.
function buildNameResolver(names) {
  const unique = new Map();
  for (const name of names.map(norm).filter(Boolean)) {
    const key = name.toLowerCase();
    if (!unique.has(key)) unique.set(key, name);
  }
  const resolved = new Map();
  const resolve = name => {
    const key = norm(name).toLowerCase();
    if (!key) return '';
    if (resolved.has(key)) return resolved.get(key);
    const longer = [...unique.keys()].filter(other => other.startsWith(`${key} `));
    const target = longer.length === 1 ? resolve(unique.get(longer[0])) : unique.get(key) || norm(name);
    resolved.set(key, target);
    return target;
  };
  return resolve;
}

// A single field can name several people ("Deloitte ERP Support,Suresh Kumar"); each of them holds the SR.
function splitHolders(value, resolve) {
  const seen = new Set();
  return String(value || '').split(',').map(part => resolve(part)).filter(name => {
    if (!name || seen.has(name.toLowerCase())) return false;
    seen.add(name.toLowerCase());
    return true;
  });
}

const hold0Known = running => running.some(hold => hold.start_known);

// Walks one SR's change log and returns the periods each person held it.
// `sr` is the SR row, `events` its Pending With / status changes in order, `resolve` the name resolver.
function buildHolds(sr, events, now, resolve) {
  const holds = [];
  const isClosedNow = sr.status === 'Closed';
  const firstPending = events.find(e => e.field === 'pending_with');
  const firstStatus = events.find(e => e.field === 'status');

  let holders = splitHolders(firstPending ? firstPending.old_value : sr.pending_with, resolve);
  let closed = firstStatus ? firstStatus.old_value === 'Closed' : isClosedNow;
  let start = null; // unknown until a change in the log tells us
  let previous = null;

  const open = () => holders.map(name => ({ name, start, start_known: start !== null }));
  let running = !closed ? open() : [];

  const finish = (end, endedBy, nextHolders) => {
    for (const hold of running) {
      const minutes = hold.start_known ? Math.max(0, minutesBetween(hold.start, end)) : null;
      // Sync rewrites made in the same instant (renames, status flips) leave zero-length periods: noise.
      if (minutes === 0) continue;
      holds.push({
        holder: hold.name, start: hold.start, end, minutes, start_known: hold.start_known, ongoing: false,
        ended_by: endedBy, handed_to: endedBy === 'handover' ? nextHolders.join(', ') : null,
        handed_from: hold.handed_from || null,
      });
    }
    running = [];
  };

  for (const event of events) {
    if (event.field === 'pending_with') {
      const next = splitHolders(event.new_value, resolve);
      const same = next.length === holders.length && next.every(name => holders.includes(name));
      if (same) continue; // a rename or case fix - still the same person
      previous = holders.join(', ') || null;
      if (running.length) finish(event.at, next.length ? 'handover' : 'cleared', next);
      holders = next;
      start = event.at;
      running = closed ? [] : open().map(hold => ({ ...hold, handed_from: previous }));
    } else if (event.field === 'status') {
      if (event.new_value === 'Closed' && !closed) {
        if (running.length) finish(event.at, 'closed', []);
        closed = true;
      } else if (event.old_value === 'Closed' && event.new_value !== 'Closed' && closed) {
        closed = false;
        start = event.at;
        running = open();
      }
    }
  }

  // Still with the current holder: measured from the SR's own Pending Since date when it has one.
  if (running.length && !isClosedNow && holders.length) {
    const since = sr.pending_since_date ? `${dateOnly(sr.pending_since_date)} 00:00:00` : null;
    const sinceUsable = since && minutesBetween(since, now) !== null && minutesBetween(since, now) >= 0;
    // An SR whose Pending With was never changed has been with that person since it was raised - an estimate,
    // because the SR may have been raised in ManageEngine before anyone assigned it here.
    const raised = !firstPending && !sinceUsable && !hold0Known(running) && sr.creation_date ? `${dateOnly(sr.creation_date)} 00:00:00` : null;
    for (const hold of running) {
      const from = sinceUsable ? since : hold.start || raised;
      holds.push({
        holder: hold.name, start: from, end: null, minutes: from ? Math.max(0, minutesBetween(from, now)) : null,
        start_known: !!from, estimated: !sinceUsable && !hold.start && !!raised, ongoing: true, ended_by: null, handed_to: null,
        handed_from: hold.handed_from || null,
      });
    }
  }
  return holds;
}

function decorate(hold, sr, now) {
  const ecd = dateOnly(sr.expected_closure_date);
  return {
    ...hold,
    sr_id: sr.id,
    sr_number: sr.sr_number,
    description: sr.description || null,
    type: sr.type || null,
    status: sr.status,
    expected_closure_date: ecd,
    overdue: hold.ongoing && !!ecd && ecd < dateOnly(now),
  };
}

async function loadHolds() {
  const [[clock]] = await pool.query("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS now");
  const [srs] = await pool.query(`
    SELECT id, sr_number, description, type, status, pending_with, pending_since_date, creation_date, expected_closure_date
    FROM srs WHERE category = 'SR' AND is_deleted = 0
  `);
  const [rows] = await pool.query(`
    SELECT h.sr_id, h.field_changed AS field, h.old_value, h.new_value, h.changed_at AS at
    FROM sr_history h JOIN srs s ON s.id = h.sr_id
    WHERE s.category = 'SR' AND s.is_deleted = 0 AND h.is_deleted = 0 AND h.field_changed IN ('pending_with', 'status')
    ORDER BY h.sr_id, h.changed_at, h.id
  `);

  const bySR = new Map();
  for (const row of rows) {
    if (!bySR.has(row.sr_id)) bySR.set(row.sr_id, []);
    bySR.get(row.sr_id).push(row);
  }
  const names = [...srs.map(s => s.pending_with), ...rows.filter(r => r.field === 'pending_with').flatMap(r => [r.old_value, r.new_value])]
    .flatMap(value => String(value || '').split(','));
  const resolve = buildNameResolver(names);

  const holds = [];
  for (const sr of srs) {
    for (const hold of buildHolds(sr, bySR.get(sr.id) || [], clock.now, resolve)) holds.push(decorate(hold, sr, clock.now));
  }
  return { now: clock.now, holds };
}

function parseFilters(query = {}) {
  const base = parseRangeFilters(query);
  return { from: base.from, to: base.to, people: base.technicians };
}

// The date range narrows holds that have finished (by when they ended). Holds still running are a live snapshot.
function applyFilters(holds, filters) {
  const people = new Set(filters.people.map(p => p.toLowerCase()));
  return holds.filter(h => {
    if (people.size && !people.has(h.holder.toLowerCase())) return false;
    if (!h.ongoing) {
      const endDay = dateOnly(h.end);
      if (filters.from && endDay < filters.from) return false;
      if (filters.to && endDay > filters.to) return false;
    }
    return true;
  });
}

const round = value => (value === null || value === undefined ? null : Math.round(value));
const mean = values => (values.length ? round(values.reduce((sum, v) => sum + v, 0) / values.length) : null);

function distribution(minutesList) {
  const buckets = HOLD_BUCKETS.map((b, i) => ({
    key: b.key, label: b.label, count: 0,
    from_minutes: i ? HOLD_BUCKETS[i - 1].max : 0, to_minutes: Number.isFinite(b.max) ? b.max : null,
  }));
  for (const minutes of minutesList) buckets[HOLD_BUCKETS.findIndex(b => minutes < b.max)].count++;
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  return buckets.map(b => ({ ...b, pct: total ? Math.round((b.count / total) * 1000) / 10 : null }));
}

function summarize(holds) {
  const now = holds.filter(h => h.ongoing);
  const done = holds.filter(h => !h.ongoing);
  const timedNow = now.filter(h => h.minutes !== null).map(h => h.minutes);
  const timedDone = done.filter(h => h.minutes !== null).map(h => h.minutes).sort((a, b) => a - b);
  const oldest = now.reduce((best, h) => (h.minutes !== null && (!best || h.minutes > best.minutes) ? h : best), null);
  return {
    srs_held: new Set(holds.map(h => h.sr_id)).size,
    holding_now: new Set(now.map(h => h.sr_id)).size,
    overdue_now: new Set(now.filter(h => h.overdue).map(h => h.sr_id)).size,
    avg_age_minutes: mean(timedNow),
    oldest_minutes: timedNow.length ? Math.max(...timedNow) : null,
    oldest_sr: oldest ? oldest.sr_number : null,
    oldest_holder: oldest ? oldest.holder : null,
    completed: done.length,
    timed: timedDone.length,
    avg_minutes: mean(timedDone),
    median_minutes: round(percentile(timedDone, 0.5)),
    max_minutes: timedDone.length ? timedDone[timedDone.length - 1] : null,
    unknown_start: done.filter(h => !h.start_known).length,
  };
}

// Finished holds grouped by the month they ended, with how long they lasted on average.
function byMonth(holds) {
  const groups = new Map();
  for (const hold of holds) {
    if (hold.ongoing || hold.minutes === null) continue;
    const key = String(hold.end).slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(hold.minutes);
  }
  return [...groups].map(([key, minutes]) => {
    const sorted = minutes.sort((a, b) => a - b);
    return { key, count: sorted.length, avg_minutes: mean(sorted), median_minutes: round(percentile(sorted, 0.5)) };
  }).sort((a, b) => a.key.localeCompare(b.key));
}

function byPerson(holds) {
  const groups = new Map();
  for (const hold of holds) {
    if (!groups.has(hold.holder)) groups.set(hold.holder, []);
    groups.get(hold.holder).push(hold);
  }
  return [...groups].map(([key, members]) => ({ key, ...summarize(members) }))
    .sort((a, b) => b.holding_now - a.holding_now || b.srs_held - a.srs_held || a.key.localeCompare(b.key));
}

async function buildPendingOverview(filters) {
  const { now, holds: all } = await loadHolds();
  const holds = applyFilters(all, filters);
  return {
    generated_at: now,
    summary: summarize(holds),
    people: byPerson(holds),
    trend: byMonth(holds),
    // How long finished holds lasted / how long running holds have lasted so far.
    completed_distribution: distribution(holds.filter(h => !h.ongoing && h.minutes !== null).map(h => h.minutes)),
    current_distribution: distribution(holds.filter(h => h.ongoing && h.minutes !== null).map(h => h.minutes)),
    holds: holds.sort((a, b) => String(b.end || b.start || '9999').localeCompare(String(a.end || a.start || '9999'))),
    facets: { people: [...new Set(all.map(h => h.holder))].sort((a, b) => a.localeCompare(b)) },
  };
}

module.exports = {
  HOLD_BUCKETS,
  applyFilters,
  buildHolds,
  buildNameResolver,
  buildPendingOverview,
  byMonth,
  byPerson,
  distribution,
  parseFilters,
  summarize,
};
