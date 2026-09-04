const test = require('node:test');
const assert = require('node:assert/strict');

const {
  consolidateParsedRows,
  findLastEta,
  isIsoDate,
  parseEtaDate,
  parseWipRow,
} = require('../routes/deloitte-import')._test;

test('parses Deloitte ETA dates deterministically without swapping day and month', () => {
  assert.equal(parseEtaDate('03', 'Aug', '26'), '2026-08-03');
  assert.equal(findLastEta('Work in Progress ETA | 03-Aug-26').eta, '2026-08-03');
  assert.equal(parseWipRow('231590 Request for Customer Refund Process O2C Work in Progress ETA | 03-Aug-26').eta, '2026-08-03');
  assert.equal(parseEtaDate('31', 'Apr', '26'), null);
  assert.equal(isIsoDate('2026-08-03'), true);
  assert.equal(isIsoDate('2026-02-30'), false);
});

test('collapses identical repeated PDF rows into one safe operation', () => {
  const row = {
    requestId: '231590',
    subject: 'Request for Customer Refund Process',
    comment: 'Work in Progress',
    eta: '2026-08-03',
    trackFound: true,
    sourcePage: 1,
  };
  const result = consolidateParsedRows([row, { ...row, sourcePage: 2 }], []);

  assert.equal(result.wip.length, 1);
  assert.equal(result.wip[0].duplicateCount, 2);
  assert.equal(result.wip[0].duplicateConflict, false);
  assert.equal(result.wip[0].canApply, true);
  assert.deepEqual(result.wip[0].sourcePages, [1, 2]);
  assert.deepEqual(result.duplicateSummary.duplicateIds, ['231590']);
});

test('blocks conflicting duplicate ETAs instead of guessing or inserting twice', () => {
  const result = consolidateParsedRows([
    {
      requestId: '231590', subject: 'Request for Customer Refund Process',
      comment: 'Work in Progress', eta: '2026-08-03', sourcePage: 1,
    },
    {
      requestId: '231590', subject: 'Request for Customer Refund Process',
      comment: 'Analysis in Progress', eta: '2026-09-02', sourcePage: 2,
    },
  ], []);

  assert.equal(result.wip.length, 1);
  assert.equal(result.wip[0].duplicateConflict, true);
  assert.equal(result.wip[0].canApply, false);
  assert.equal(result.wip[0].conflictVariants.length, 2);
  assert.deepEqual(result.duplicateSummary.conflictingIds, ['231590']);
});

test('blocks one request appearing in both actionable Deloitte tables', () => {
  const result = consolidateParsedRows(
    [{ requestId: '230519', subject: 'Attachment issue', comment: 'Analysis', eta: '2026-09-01' }],
    [{ requestId: '230519', subject: 'Attachment issue' }]
  );

  assert.equal(result.wip.length, 1);
  assert.equal(result.pendingWithUser.length, 0);
  assert.equal(result.wip[0].canApply, false);
});
