const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyFilters, buildHolds, buildNameResolver, byMonth, byPerson, distribution, summarize,
} = require('../services/pending-insights');

const NOW = '2026-10-17 12:00:00';
const resolve = buildNameResolver(['Atish Kshirsagar', 'Kanhaiya Jha', 'jarjish', 'Jarjish Siddibapa', 'Suresh Kumar', 'Suresh Kumar S']);

const sr = (overrides = {}) => ({
  id: 1, sr_number: '100', status: 'Pending', pending_with: 'Kanhaiya Jha', pending_since_date: null, expected_closure_date: null, ...overrides,
});
const moved = (at, from, to) => ({ field: 'pending_with', old_value: from, new_value: to, at });
const status = (at, from, to) => ({ field: 'status', old_value: from, new_value: to, at });

test('name resolver merges a name that is a whole-word prefix of exactly one longer name', () => {
  assert.equal(resolve('jarjish'), 'Jarjish Siddibapa');
  assert.equal(resolve('Suresh Kumar'), 'Suresh Kumar S');
  assert.equal(resolve('Atish Kshirsagar'), 'Atish Kshirsagar');
  const ambiguous = buildNameResolver(['Raj', 'Raj Kumar', 'Raj Singh']);
  assert.equal(ambiguous('Raj'), 'Raj', 'two longer candidates: do not guess');
});

test('time with a person runs from the change that gave it to them to the change that took it away', () => {
  const holds = buildHolds(
    sr({ pending_with: 'Atish Kshirsagar' }),
    [moved('2026-10-01 10:00:00', null, 'Kanhaiya Jha'), moved('2026-10-04 10:00:00', 'Kanhaiya Jha', 'Atish Kshirsagar')],
    NOW, resolve,
  );
  const kanhaiya = holds.find(h => h.holder === 'Kanhaiya Jha');
  assert.equal(kanhaiya.minutes, 3 * 24 * 60);
  assert.equal(kanhaiya.ended_by, 'handover');
  assert.equal(kanhaiya.handed_to, 'Atish Kshirsagar');
  const atish = holds.find(h => h.holder === 'Atish Kshirsagar');
  assert.equal(atish.ongoing, true);
  assert.equal(atish.minutes, (13 * 24 + 2) * 60, 'running hold is measured to now');
});

test('the first recorded holder has no known start, so it adds no duration', () => {
  const holds = buildHolds(sr({ pending_with: 'Atish Kshirsagar' }), [moved('2026-10-04 10:00:00', 'Kanhaiya Jha', 'Atish Kshirsagar')], NOW, resolve);
  const first = holds.find(h => h.holder === 'Kanhaiya Jha');
  assert.equal(first.start_known, false);
  assert.equal(first.minutes, null);
});

test('a running hold starts from the SR\'s Pending Since date when it has one', () => {
  const holds = buildHolds(
    sr({ pending_with: 'Atish Kshirsagar', pending_since_date: '2026-10-10' }),
    [moved('2026-10-12 09:00:00', 'Kanhaiya Jha', 'Atish Kshirsagar')],
    NOW, resolve,
  );
  const running = holds.find(h => h.ongoing);
  assert.equal(running.start, '2026-10-10 00:00:00');
  assert.equal(running.minutes, (7 * 24 + 12) * 60);
});

test('with no history and no Pending Since date, a running hold is estimated from the day the SR was raised', () => {
  const [hold] = buildHolds(sr({ creation_date: '2026-10-10' }), [], NOW, resolve);
  assert.equal(hold.estimated, true);
  assert.equal(hold.start, '2026-10-10 00:00:00');
  assert.equal(hold.minutes, (7 * 24 + 12) * 60);
  const [dated] = buildHolds(sr({ creation_date: '2026-10-10', pending_since_date: '2026-10-14' }), [], NOW, resolve);
  assert.equal(dated.estimated, false, 'a Pending Since date is not an estimate');
});

test('time while the SR is closed is not counted, and reopening starts a new period', () => {
  const holds = buildHolds(
    sr(),
    [status('2026-10-02 10:00:00', 'Pending', 'Closed'), status('2026-10-09 10:00:00', 'Closed', 'Pending')],
    NOW, resolve,
  );
  const [reopened, beforeClose] = holds.sort((a, b) => Number(a.ongoing === false) - Number(b.ongoing === false));
  assert.equal(beforeClose.ended_by, 'closed');
  assert.equal(beforeClose.start_known, false);
  assert.equal(reopened.ongoing, true);
  assert.equal(reopened.start, '2026-10-09 10:00:00');
});

test('a closed SR has no running hold', () => {
  const holds = buildHolds(sr({ status: 'Closed' }), [status('2026-10-02 10:00:00', 'Pending', 'Closed')], NOW, resolve);
  assert.equal(holds.filter(h => h.ongoing).length, 0);
});

test('renames and case fixes are not handovers; same-instant rewrites leave no zero-length hold', () => {
  const holds = buildHolds(
    sr({ pending_with: 'Jarjish Siddibapa' }),
    [moved('2026-10-01 10:00:00', null, 'Atish Kshirsagar'), moved('2026-10-02 10:00:00', 'Atish Kshirsagar', 'jarjish'), moved('2026-10-02 10:00:00', 'jarjish', 'Jarjish Siddibapa')],
    NOW, resolve,
  );
  assert.deepEqual(holds.map(h => h.holder).sort(), ['Atish Kshirsagar', 'Jarjish Siddibapa']);
  assert.equal(holds.find(h => h.holder === 'Atish Kshirsagar').minutes, 24 * 60);
});

test('an SR with several people in Pending With counts for each of them', () => {
  const holds = buildHolds(sr({ pending_with: 'Atish Kshirsagar,Kanhaiya Jha', pending_since_date: '2026-10-16' }), [], NOW, resolve);
  assert.deepEqual(holds.map(h => h.holder).sort(), ['Atish Kshirsagar', 'Kanhaiya Jha']);
});

test('summary and per-person figures separate running holds from finished ones', () => {
  const holds = [
    { sr_id: 1, sr_number: '1', holder: 'A', ongoing: true, minutes: 3000, start_known: true, overdue: true },
    { sr_id: 2, sr_number: '2', holder: 'A', ongoing: false, minutes: 1000, start_known: true },
    { sr_id: 3, sr_number: '3', holder: 'A', ongoing: false, minutes: 3000, start_known: true },
    { sr_id: 4, sr_number: '4', holder: 'A', ongoing: false, minutes: null, start_known: false },
    { sr_id: 5, sr_number: '5', holder: 'B', ongoing: true, minutes: 9000, start_known: true, overdue: false },
  ];
  const all = summarize(holds);
  assert.equal(all.holding_now, 2);
  assert.equal(all.overdue_now, 1);
  assert.equal(all.oldest_minutes, 9000);
  assert.equal(all.oldest_sr, '5');
  assert.equal(all.completed, 3);
  assert.equal(all.timed, 2);
  assert.equal(all.avg_minutes, 2000);
  assert.equal(all.unknown_start, 1);
  const [a, b] = byPerson(holds);
  assert.equal(a.key, 'A');
  assert.equal(a.srs_held, 4);
  assert.equal(b.key, 'B');
  assert.equal(b.completed, 0);
  assert.equal(b.avg_minutes, null);
});

test('the date range narrows finished holds by when they ended; running holds always stay', () => {
  const holds = [
    { holder: 'A', ongoing: true, end: null },
    { holder: 'A', ongoing: false, end: '2026-08-01 10:00:00' },
    { holder: 'A', ongoing: false, end: '2026-10-10 10:00:00' },
    { holder: 'B', ongoing: false, end: '2026-10-10 10:00:00' },
  ];
  assert.equal(applyFilters(holds, { from: '2026-10-01', to: null, people: [] }).length, 3);
  assert.equal(applyFilters(holds, { from: '2026-10-01', to: null, people: ['a'] }).length, 2);
});

test('monthly trend groups finished, timed holds by the month they ended', () => {
  const rows = byMonth([
    { ongoing: false, minutes: 1000, end: '2026-09-10 10:00:00' },
    { ongoing: false, minutes: 3000, end: '2026-09-20 10:00:00' },
    { ongoing: false, minutes: 500, end: '2026-10-02 10:00:00' },
    { ongoing: false, minutes: null, end: '2026-10-03 10:00:00' },
    { ongoing: true, minutes: 9000, end: null },
  ]);
  assert.deepEqual(rows.map(r => [r.key, r.count, r.avg_minutes]), [['2026-09', 2, 2000], ['2026-10', 1, 500]]);
});

test('hold distribution places durations in the right bands', () => {
  const day = 24 * 60;
  const buckets = distribution([60, 2 * day, 5 * day, 30 * day]);
  assert.deepEqual(buckets.map(b => b.count), [1, 1, 1, 0, 0, 1]);
  assert.equal(buckets[1].from_minutes, day);
  assert.equal(buckets[5].to_minutes, null);
});
