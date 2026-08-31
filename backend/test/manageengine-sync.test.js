const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAutoRequest,
  isAutoCreateCandidate,
  mapStatus,
  normalizeRequest,
  pendingPartyFor,
} = require('../services/manageengine-sync');

const config = {
  autoCreateCategory: 'Oracle ERP',
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
  assert.equal(request.pending_with, 'Deloitte ERP Support');
  assert.equal(request.manageengine_pending_party, 'Technician');
  assert.equal(request.created_by_name, 'Original Sender');
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
  assert.equal(request.manageengine_pending_party, 'User');
  assert.equal(request.pending_with, 'Business User');
  assert.equal(request.manageengine_closed_at, null);
  assert.equal(request.closed_date, null);
});

test('auto-creates only active Oracle ERP requests with a usable request ID', () => {
  const request = {
    display_id: '20001',
    status: { name: 'In Progress' },
    category: { name: 'Oracle ERP' },
  };
  assert.equal(isAutoCreateCandidate(request, config), true);
  assert.equal(isAutoCreateCandidate({ ...request, status: { name: 'On Hold' } }, config), true);
  assert.equal(isAutoCreateCandidate({ ...request, status: { name: 'Resolved' } }, config), false);
  assert.equal(isAutoCreateCandidate({ ...request, category: { name: 'Network' } }, config), false);
  assert.equal(isAutoCreateCandidate({ ...request, display_id: '', id: '' }, config), false);
});

test('Oracle ERP and external-technician matching is trim-aware and case-insensitive', () => {
  const request = {
    id: '20002',
    status: { name: 'Open' },
    category: { name: ' oracle erp ' },
    technician: { name: 'deloitte erp support' },
  };
  assert.equal(isAutoCreateCandidate(request, config), true);
  assert.equal(normalizeRequest(request, config).scope, 'External');
  assert.equal(normalizeRequest(request, config).assigned_to, 'deloitte erp support');
});

test('creates a new Oracle ERP SR with an empty description and exact technician name', async () => {
  let insert;
  const conn = {
    query: async sql => {
      assert.match(sql, /category = 'SR'/);
      assert.doesNotMatch(sql, /is_deleted = 0/);
      return [[]];
    },
    execute: async (sql, values) => {
      insert = { sql, values };
      return [{ affectedRows: 1 }];
    },
  };
  const created = await createAutoRequest(conn, {
    display_id: '20003',
    status: { name: 'Open' },
    unreplied_count: 1,
    category: { name: 'Oracle ERP' },
    technician: { name: 'Deloitte ERP Support - L2' },
    requester: { name: 'Business User' },
    created_by: { name: 'Original Sender' },
  }, config);

  assert.equal(created, true);
  assert.match(insert.sql, /VALUES \(\?, 'SR', \?, \?, \?, \?, '',/);
  assert.deepEqual(insert.values.slice(0, 6), [
    '20003', 'Internal', 'Open', 'Deloitte ERP Support - L2',
    'Deloitte ERP Support - L2', 'Oracle ERP',
  ]);
  assert.equal(insert.values[7], 'Original Sender');
});

test('does not recreate an Oracle ERP request that already exists, even if soft-deleted', async () => {
  const conn = {
    query: async () => [[{ id: 99 }]],
    execute: async () => { throw new Error('insert must not run'); },
  };
  const created = await createAutoRequest(conn, {
    display_id: '20004',
    status: { name: 'Open' },
    category: { name: 'Oracle ERP' },
  }, config);
  assert.equal(created, false);
});
