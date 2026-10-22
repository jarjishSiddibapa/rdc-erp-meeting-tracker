const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyRequestUpdate,
  matchTrackedRequests,
  mapStatus,
  normalizeRequest,
  isManualCloseHeld,
  pendingPartyFor,
  serviceDeskApiDomainFor,
} = require('../services/manageengine-sync');

const config = {
  externalTechnician: 'Deloitte ERP Support',
  timeZone: 'Asia/Kolkata',
};

test('uses unreplied_count as the pending-side source of truth', () => {
  assert.equal(pendingPartyFor({ status: { name: 'Open' }, unreplied_count: '2' }), 'Technician');
  assert.equal(pendingPartyFor({ status: { name: 'Open' }, unreplied_count: '0' }), 'User');
  assert.equal(pendingPartyFor({ status: { name: 'Closed' }, unreplied_count: '4' }), null);
  assert.equal(pendingPartyFor({ status: { name: 'Open' } }), null);
});

test('an explicit pending status takes precedence over the reply count', () => {
  assert.equal(pendingPartyFor({ status: { name: 'Pending with User' }, unreplied_count: '3' }), 'User');
  assert.equal(pendingPartyFor({ status: { name: 'Pending with Technician' }, unreplied_count: '0' }), 'Technician');
});

test('normalizes ManageEngine status names conservatively', () => {
  assert.equal(mapStatus('Resolved'), 'Closed');
  assert.equal(mapStatus('Work in Progress'), 'In Progress');
  assert.equal(mapStatus('On Hold'), 'On Hold');
  assert.equal(mapStatus('Custom active workflow'), 'Open');
});

test('maps Zoho account regions to ServiceDesk product API domains', () => {
  assert.equal(serviceDeskApiDomainFor('https://accounts.zoho.com'), 'https://sdpondemand.manageengine.com');
  assert.equal(serviceDeskApiDomainFor('https://accounts.zoho.in/'), 'https://sdpondemand.manageengine.in');
  assert.equal(serviceDeskApiDomainFor('https://accounts.zohocloud.ca'), 'https://servicedeskplus.ca');
});

test('maps a Deloitte ticket to External and preserves full timestamps', () => {
  const request = normalizeRequest({
    display_id: '12345',
    status: { name: 'Open' },
    unreplied_count: '1',
    technician: { name: 'Deloitte ERP Support' },
    requester: { name: 'RDC Requester' },
    created_by: { name: 'Original Sender' },
    category: { name: 'ERP Support' },
    created_time: { value: '1725082200000' },
    completed_time: null,
    description: '<p>must never be imported</p>',
  }, config);

  assert.equal(request.scope, 'External');
  assert.equal(request.status, 'Pending');
  assert.equal(Object.hasOwn(request, 'pending_with'), false);
  assert.equal(request.manageengine_pending_party, 'Technician');
  // requester is who actually raised the ticket; created_by is often just ManageEngine's own
  // email-ingestion actor ("System") and only used as a fallback when requester is absent.
  assert.equal(request.created_by_name, 'RDC Requester');
  assert.equal(request.type, 'ERP Support');
  assert.match(request.manageengine_created_at, /^2024-08-31 \d{2}:\d{2}:\d{2}$/);
  assert.equal(Object.hasOwn(request, 'description'), false);
});

test('maps a technician response to the requester without inventing closure time', () => {
  const request = normalizeRequest({
    display_id: '9',
    status: { name: 'In Progress' },
    unreplied_count: 0,
    technician: { name: 'RDC IT' },
    requester: { name: 'Business User' },
    category: { name: 'Access' },
  }, config);

  assert.equal(request.scope, 'Internal');
  assert.equal(request.status, 'Pending with User');
  assert.equal(request.manageengine_pending_party, 'User');
  assert.equal(request.manageengine_closed_at, null);
  assert.equal(request.closed_date, null);
});

test('Technician vs User is decided purely by unreplied_count', () => {
  const request = normalizeRequest({
    display_id: '234957',
    status: { name: 'Open' },
    unreplied_count: 2,
    technician: { name: 'Nagesh Tiwari' },
    requester: { name: 'Anesh Gaikwad' },
    category: { name: 'Oracle ERP' },
    created_time: { value: '1725082200000' },
  }, config);

  assert.equal(request.status, 'Pending');
  assert.equal(request.manageengine_pending_party, 'Technician');
});

test('the sync never produces a pending_since_date (it is maintained manually)', () => {
  const request = normalizeRequest({
    display_id: '234958',
    status: { name: 'Open' },
    unreplied_count: 2,
    technician: { name: 'Nagesh Tiwari' },
    created_time: { value: '1725082200000' },
  }, config);

  assert.equal('pending_since_date' in request, false);
});

test('the sync never produces a pending_with value (it is maintained manually)', () => {
  for (const unreplied of [0, 3]) {
    const request = normalizeRequest({
      display_id: '1',
      status: { name: 'Open' },
      unreplied_count: unreplied,
      technician: { name: 'Nagesh Tiwari' },
      requester: { name: 'Anesh Gaikwad' },
    }, config, null);
    assert.equal(Object.hasOwn(request, 'pending_with'), false);
  }
});

test('strips ManageEngine\'s own department suffix from created_by_name on every sync, not just once', () => {
  // This must live in normalizeRequest itself (not a one-off migration script) — otherwise the
  // very next sync overwrites a manually-cleaned name with the raw suffixed one again, since
  // ManageEngine's own requester.name field carries the suffix at the source.
  const request = normalizeRequest({
    display_id: '221466',
    status: { name: 'Open' },
    unreplied_count: 0,
    technician: { name: 'Nagesh Tiwari' },
    requester: { name: 'Aniket Sawant - Credit Control' },
    category: { name: 'Oracle ERP' },
  }, config);
  assert.equal(request.created_by_name, 'Aniket Sawant');
});

test('renames the created_by_name typo\' d "Suresh Kumar S" on every sync', () => {
  const request = normalizeRequest({
    display_id: '1',
    status: { name: 'Open' },
    unreplied_count: 0,
    technician: { name: 'Nagesh Tiwari' },
    requester: { name: 'Suresh Kumar S' },
    category: { name: 'Oracle ERP' },
  }, config);
  assert.equal(request.created_by_name, 'Suresh Kumar');
});

test('strips the technician\'s own department suffix out of assigned_to', () => {
  // The suffix/typo fix must apply to every field a ManageEngine person name can flow into, not
  // just created_by_name — technician.name feeds assigned_to directly (see normalizeRequest).
  const request = normalizeRequest({
    display_id: '235146',
    status: { name: 'Open' },
    unreplied_count: 2,
    technician: { name: 'Mohd. Haseeb Khan - Technical' },
    requester: { name: 'RDC Requester' },
    category: { name: 'Oracle ERP' },
  }, config);
  assert.equal(request.assigned_to, 'Mohd. Haseeb Khan');
});

test('renames the typo\'d "Suresh Kumar S" when it is the assigned technician, not just the requester', () => {
  const request = normalizeRequest({
    display_id: '222861',
    status: { name: 'Open' },
    unreplied_count: 3,
    technician: { name: 'Suresh Kumar S' },
    requester: { name: 'RDC Requester' },
    category: { name: 'Oracle ERP' },
  }, config);
  assert.equal(request.assigned_to, 'Suresh Kumar');
});

test('preserves authoritative Closed and On Hold statuses', () => {
  assert.equal(normalizeRequest({
    status: { name: 'On Hold' },
    unreplied_count: 0,
    technician: { name: 'RDC IT' },
  }, config).status, 'On Hold');
  assert.equal(normalizeRequest({
    status: { name: 'Closed' },
    unreplied_count: 3,
    technician: { name: 'RDC IT' },
  }, config).status, 'Closed');
});

test('external-technician matching is trim-aware and case-insensitive', () => {
  const request = {
    id: '20002',
    status: { name: 'Open' },
    technician: { name: 'deloitte erp support' },
  };
  assert.equal(normalizeRequest(request, config).scope, 'External');
  assert.equal(normalizeRequest(request, config).assigned_to, 'deloitte erp support');
});

test('matches only request IDs already tracked locally', () => {
  const tracked = { display_id: '20001', category: { name: 'Oracle ERP' } };
  const untracked = { display_id: '20002', category: { name: 'Oracle ERP' } };
  const matches = matchTrackedRequests([tracked, untracked], new Set(['20001']));

  assert.deepEqual([...matches.keys()], ['20001']);
  assert.equal(matches.get('20001'), tracked);
  assert.equal(matches.has('20002'), false);
});

// An SR closed here while ManageEngine still shows it open stays closed for the hold window.
function fakeConnection() {
  const calls = [];
  return { calls, execute: async (sql, params) => { calls.push({ sql, params }); } };
}

const openInManageEngine = {
  display_id: '500', status: { name: 'Open' }, unreplied_count: '1',
  technician: { name: 'Atish Kshirsagar' }, category: { name: 'Reports' },
  created_time: { value: String(Date.UTC(2026, 9, 1, 4, 30)) },
};

function localClosed(overrides = {}) {
  return {
    id: 7, sr_number: '500', status: 'Closed', scope: 'Internal', assigned_to: 'Atish Kshirsagar', type: 'Reports',
    creation_date: '2026-10-01', created_by_name: null, closed_date: '2026-10-16', manageengine_status: 'Open',
    manageengine_pending_party: 'Technician', manageengine_created_at: '2026-10-01 10:00:00', manageengine_closed_at: null,
    manual_close_hold: 1, ...overrides,
  };
}

const updatedSql = conn => conn.calls.filter(c => c.sql.startsWith('UPDATE srs SET') && c.sql.includes('status ='));

test('a manual close is kept while the hold is active even though ManageEngine still says open', async () => {
  const conn = fakeConnection();
  const result = await applyRequestUpdate(conn, localClosed(), openInManageEngine, config);
  assert.equal(result.held, true);
  assert.equal(updatedSql(conn).length, 0, 'status must not be rewritten');
  assert.ok(!conn.calls.some(c => c.params?.includes?.('closed_date')), 'no closed_date history');
});

test('other fields still refresh from ManageEngine while a manual close is held', async () => {
  const conn = fakeConnection();
  const result = await applyRequestUpdate(conn, localClosed({ assigned_to: 'Someone Else' }), openInManageEngine, config);
  assert.equal(result.held, true);
  assert.equal(result.changed, 1);
  assert.match(conn.calls[0].sql, /assigned_to = \?/);
  assert.doesNotMatch(conn.calls[0].sql, /status = |closed_date/);
});

test('once the hold lapses the sync reopens an SR that ManageEngine still shows open', async () => {
  const conn = fakeConnection();
  const result = await applyRequestUpdate(conn, localClosed({ manual_close_hold: 0 }), openInManageEngine, config);
  assert.equal(result.held, false);
  assert.match(conn.calls[0].sql, /status = /);
  assert.ok(conn.calls[0].params.includes('Pending'));
  assert.ok(conn.calls[0].params.includes(null), 'closed_date is cleared');
});

test('when ManageEngine agrees the SR is closed the hold does not matter', async () => {
  const conn = fakeConnection();
  const closedRemote = { ...openInManageEngine, status: { name: 'Closed' }, completed_time: { value: String(Date.UTC(2026, 9, 16, 5, 0)) } };
  const result = await applyRequestUpdate(conn, localClosed(), closedRemote, config);
  assert.equal(result.held, false);
  assert.ok(conn.calls.some(c => c.params.includes('2026-10-16 10:30:00')), 'ManageEngine closed time is recorded');
});

test('an SR that is not closed locally is never held', () => {
  assert.equal(isManualCloseHeld(localClosed({ status: 'Open' }), { status: 'Pending' }), false);
});
