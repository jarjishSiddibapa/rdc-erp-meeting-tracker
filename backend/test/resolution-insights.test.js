const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyFilters, distribution, explore, minutesBetween, parseFilters, percentile, shapeRecord, summarize, weekStart,
} = require('../services/resolution-insights');
const { groupWorkload } = require('../services/workload-reminders');

const NOW = '2026-10-17 12:00:00';

function row(overrides = {}) {
  return {
    id: 1, sr_number: '100', description: 'Fix report', assigned_to: 'Atish Kshirsagar', scope: 'Internal',
    type: 'Reports', status: 'Closed', created_by_name: 'Someone',
    creation_date: '2026-10-01', closed_date: '2026-10-03', expected_closure_date: null,
    manageengine_created_at: '2026-10-01 10:00:00', manageengine_closed_at: '2026-10-03 16:30:00',
    ...overrides,
  };
}

const rec = (overrides) => shapeRecord(row(overrides), NOW);

test('TAT is ManageEngine completed time minus created time, in calendar minutes', () => {
  const r = rec();
  assert.equal(r.resolved, true);
  assert.equal(r.exact, true);
  assert.equal(r.tat_minutes, 2 * 24 * 60 + 6 * 60 + 30);
  assert.equal(r.closed_at, '2026-10-03 16:30:00');
});

test('an SR the sync never touched falls back to date-only precision and is flagged inexact', () => {
  const r = rec({ manageengine_created_at: null, manageengine_closed_at: null });
  assert.equal(r.exact, false);
  assert.equal(r.tat_minutes, 2 * 24 * 60);
});

test('a closed SR whose end precedes its start is not counted as resolved', () => {
  const r = rec({ manageengine_closed_at: '2026-09-30 10:00:00' });
  assert.equal(r.resolved, false);
  assert.equal(r.tat_minutes, null);
});

test('open SRs get an age and overdue flag from the expected closure date', () => {
  const open = rec({ status: 'Pending', manageengine_closed_at: null, closed_date: null, expected_closure_date: '2026-10-10' });
  assert.equal(open.resolved, false);
  assert.equal(open.closed_at, null);
  assert.equal(open.age_minutes, minutesBetween('2026-10-01 10:00:00', NOW));
  assert.equal(open.overdue, true);
  const notYet = rec({ status: 'Pending', manageengine_closed_at: null, expected_closure_date: '2026-10-17' });
  assert.equal(notYet.overdue, false);
});

test('a bare "Deloitte" assignee from the PDF import is the same technician as Deloitte ERP Support', () => {
  assert.equal(rec({ assigned_to: 'Deloitte' }).technician, 'Deloitte ERP Support');
  assert.equal(rec({ assigned_to: 'Deloitte ERP Support' }).technician, 'Deloitte ERP Support');
  assert.equal(rec({ assigned_to: ' Atish Kshirsagar ' }).technician, 'Atish Kshirsagar');
});

test('percentile interpolates between ranks', () => {
  assert.equal(percentile([], 0.5), null);
  assert.equal(percentile([7], 0.9), 7);
  assert.equal(percentile([10, 20, 30, 40], 0.5), 25);
  assert.equal(percentile([10, 20, 30, 40, 50], 0.5), 30);
});

test('summarize reports closed-work and open-work figures separately', () => {
  const records = [
    rec({ id: 1, sr_number: '1', manageengine_created_at: '2026-10-01 00:00:00', manageengine_closed_at: '2026-10-02 00:00:00' }),
    rec({ id: 2, sr_number: '2', manageengine_created_at: '2026-10-01 00:00:00', manageengine_closed_at: '2026-10-04 00:00:00' }),
    rec({ id: 3, sr_number: '3', manageengine_created_at: '2026-10-01 00:00:00', manageengine_closed_at: '2026-10-11 00:00:00' }),
    rec({ id: 4, sr_number: '4', status: 'Pending', manageengine_closed_at: null, expected_closure_date: '2026-10-05', manageengine_created_at: '2026-10-07 12:00:00' }),
    rec({ id: 5, sr_number: '5', status: 'Pending with User', manageengine_closed_at: null, manageengine_created_at: '2026-10-12 12:00:00' }),
    rec({ id: 6, sr_number: '6', status: 'On Hold', manageengine_closed_at: null, manageengine_created_at: '2026-10-16 12:00:00' }),
  ];
  const s = summarize(records);
  assert.equal(s.closed, 3);
  assert.equal(s.avg_minutes, Math.round(((1 + 3 + 10) / 3) * 1440));
  assert.equal(s.median_minutes, 3 * 1440);
  assert.equal(s.min_minutes, 1440);
  assert.equal(s.max_minutes, 10 * 1440);
  assert.equal(s.fastest_sr, '1');
  assert.equal(s.slowest_sr, '3');
  assert.equal(s.within_1d_pct, 33.3);
  assert.equal(s.within_7d_pct, 66.7);
  assert.equal(s.open, 3);
  assert.equal(s.overdue, 1);
  assert.equal(s.on_hold, 1);
  assert.equal(s.waiting_on_user, 1);
  assert.equal(s.assigned, 6);
  assert.equal(s.open_oldest_minutes, minutesBetween('2026-10-07 12:00:00', NOW));
});

test('a group with no closed work has null averages, not zero', () => {
  const s = summarize([rec({ status: 'Pending', manageengine_closed_at: null })]);
  assert.equal(s.closed, 0);
  assert.equal(s.avg_minutes, null);
  assert.equal(s.median_minutes, null);
});

test('the date range narrows closed work by closed date but never hides open SRs', () => {
  const records = [
    rec({ id: 1, manageengine_closed_at: '2026-09-15 10:00:00' }),
    rec({ id: 2, manageengine_closed_at: '2026-10-05 10:00:00' }),
    rec({ id: 3, status: 'Pending', manageengine_closed_at: null }),
  ];
  const filtered = applyFilters(records, parseFilters({ from: '2026-10-01', to: '2026-10-31' }));
  assert.deepEqual(filtered.map(r => r.id).sort(), [2, 3]);
});

test('technician, scope, type and search filters combine', () => {
  const records = [
    rec({ id: 1, assigned_to: 'Atish Kshirsagar', scope: 'Internal', type: 'Reports' }),
    rec({ id: 2, assigned_to: 'Nagesh Tiwari', scope: 'Internal', type: 'Reports' }),
    rec({ id: 3, assigned_to: 'Nagesh Tiwari', scope: 'External', type: 'Access', description: 'Reset login' }),
  ];
  assert.deepEqual(applyFilters(records, parseFilters({ technician: 'nagesh tiwari' })).map(r => r.id), [2, 3]);
  assert.deepEqual(applyFilters(records, parseFilters({ technician: 'Nagesh Tiwari', scope: 'External' })).map(r => r.id), [3]);
  assert.deepEqual(applyFilters(records, parseFilters({ type: 'Reports,Access' })).map(r => r.id), [1, 2, 3]);
  assert.deepEqual(applyFilters(records, parseFilters({ search: 'login' })).map(r => r.id), [3]);
});

test('distribution buckets closed SRs by turnaround', () => {
  const records = [
    rec({ id: 1, manageengine_created_at: '2026-10-01 00:00:00', manageengine_closed_at: '2026-10-01 05:00:00' }),
    rec({ id: 2, manageengine_created_at: '2026-10-01 00:00:00', manageengine_closed_at: '2026-10-03 00:00:00' }),
    rec({ id: 3, manageengine_created_at: '2026-10-01 00:00:00', manageengine_closed_at: '2026-10-20 00:00:00' }),
    rec({ id: 4, manageengine_created_at: '2026-09-01 00:00:00', manageengine_closed_at: '2026-10-20 00:00:00' }),
  ];
  const byKey = Object.fromEntries(distribution(records).map(b => [b.key, b.count]));
  assert.equal(byKey.lt1d, 1);
  assert.equal(byKey['1to3d'], 1);
  assert.equal(byKey['2to4w'], 1);
  assert.equal(byKey.gt4w, 1);
});

test('explore groups by dimension and cross-tabs by a second one', () => {
  const records = [
    rec({ id: 1, assigned_to: 'A', type: 'X', manageengine_closed_at: '2026-10-03 10:00:00' }),
    rec({ id: 2, assigned_to: 'A', type: 'Y', manageengine_closed_at: '2026-11-03 10:00:00' }),
    rec({ id: 3, assigned_to: 'B', type: 'X', manageengine_closed_at: '2026-11-04 10:00:00' }),
    rec({ id: 4, assigned_to: 'B', type: 'X', status: 'Pending', manageengine_closed_at: null }),
  ];

  const byTech = explore(records, 'technician');
  assert.deepEqual(byTech.rows.map(r => [r.key, r.closed, r.open]), [['A', 2, 0], ['B', 1, 1]]);

  const byMonth = explore(records, 'month');
  assert.deepEqual(byMonth.rows.map(r => [r.key, r.closed]), [['2026-10', 1], ['2026-11', 2]]);
  assert.equal(byMonth.rows[0].open, null, 'open SRs have no closed month');

  const matrix = explore(records, 'technician', 'month');
  assert.deepEqual(matrix.columns, ['2026-10', '2026-11']);
  assert.equal(matrix.rows.find(r => r.key === 'A').cells['2026-11'].closed, 1);
  assert.equal(matrix.rows.find(r => r.key === 'B').cells['2026-10'], undefined);
});

test('weekStart returns the Monday of the week', () => {
  assert.equal(weekStart('2026-10-17'), '2026-10-12'); // Saturday
  assert.equal(weekStart('2026-10-12'), '2026-10-12'); // Monday
  assert.equal(weekStart('2026-10-18'), '2026-10-12'); // Sunday
});

test('workload reminders group open SRs per technician, oldest first, and merge shared emails', () => {
  const records = [
    rec({ id: 1, sr_number: '10', assigned_to: 'Atish', status: 'Pending', manageengine_closed_at: null, manageengine_created_at: '2026-10-15 09:00:00' }),
    rec({ id: 2, sr_number: '11', assigned_to: 'Atish Kshirsagar', status: 'Pending with User', manageengine_closed_at: null, manageengine_created_at: '2026-10-01 09:00:00', expected_closure_date: '2026-10-05' }),
    rec({ id: 3, sr_number: '12', assigned_to: 'Nagesh Tiwari', status: 'Pending', manageengine_closed_at: null }),
    rec({ id: 4, sr_number: '13', assigned_to: 'Deloitte ERP Support', status: 'Pending', manageengine_closed_at: null }),
    rec({ id: 5, sr_number: '14', assigned_to: 'Ritika Mhatre', status: 'Pending', manageengine_closed_at: null }),
    rec({ id: 6, sr_number: '15', assigned_to: 'Gitesh', status: 'Closed' }),
  ];
  const contacts = [
    { id: 1, name: 'Atish', email: 'atish@rdc.in', is_ignored: 0 },
    { id: 2, name: 'Atish Kshirsagar', email: 'Atish@rdc.in', is_ignored: 0 },
    { id: 3, name: 'Nagesh Tiwari', email: null, is_ignored: 0 },
    { id: 4, name: 'Ritika Mhatre', email: 'ritika@rdc.in', is_ignored: 1 },
  ];

  const groups = groupWorkload(records, contacts);
  assert.deepEqual(groups.map(g => g.name), ['Atish / Atish Kshirsagar', 'Nagesh Tiwari']);

  const atish = groups[0];
  assert.equal(atish.email, 'atish@rdc.in');
  assert.deepEqual(atish.srs.map(s => s.sr_number), ['11', '10'], 'oldest first');
  assert.equal(atish.overdueCount, 1);
  assert.equal(groups[1].email, null, 'no email on file stays visible so it can be fixed');
});

test('an SR closed here while ManageEngine still shows it open is counted from the moment it was closed here', () => {
  const r = rec({ manageengine_closed_at: null, manageengine_status: 'On Hold', closed_here_at: '2026-10-03 11:00:00' });
  assert.equal(r.unconfirmed, true);
  assert.equal(r.exact, true);
  assert.equal(r.resolved, true);
  assert.equal(r.closed_at, '2026-10-03 11:00:00');
  assert.equal(r.tat_minutes, 2 * 24 * 60 + 60, 'ManageEngine raised time to the time it was closed here');
  assert.equal(rec({ manageengine_status: 'Closed' }).unconfirmed, false);
  assert.equal(summarize([r, rec({ id: 2 })]).unconfirmed_count, 1);
  // With no close time on record it still counts, by date.
  const byDate = rec({ manageengine_closed_at: null, manageengine_status: 'On Hold', closed_here_at: null });
  assert.equal(byDate.exact, false);
  assert.equal(byDate.tat_minutes, 2 * 24 * 60);
});
