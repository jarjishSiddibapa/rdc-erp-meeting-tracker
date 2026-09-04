const test = require('node:test');
const assert = require('node:assert/strict');

const {
  collectEtaCandidates,
  consolidateParsedRows,
  findLastEta,
  findReportPeriod,
  isIsoDate,
  parseEtaDate,
  parseNumericEtaDate,
  parseWipRow,
  splitRows,
} = require('../routes/deloitte-import')._test;

test('parses Deloitte ETA dates deterministically without swapping day and month', () => {
  assert.equal(parseEtaDate('03', 'Aug', '26'), '2026-08-03');
  assert.equal(findLastEta('Work in Progress ETA | 03-Aug-26').eta, '2026-08-03');
  assert.equal(parseWipRow('231590 Request for Customer Refund Process O2C Work in Progress ETA | 03-Aug-26').eta, '2026-08-03');
  assert.equal(parseEtaDate('31', 'Apr', '26'), null);
  assert.equal(isIsoDate('2026-08-03'), true);
  assert.equal(isIsoDate('2026-02-30'), false);
});

test('accepts explicit Deloitte ETA variants without locale-dependent Date parsing', () => {
  assert.equal(parseNumericEtaDate('3', '9', '2026'), '2026-09-03');
  assert.equal(findLastEta('Dev ETA: 03/09/2026').eta, '2026-09-03');
  assert.equal(findLastEta('Revised ETA - 2026-09-03').eta, '2026-09-03');
  assert.equal(findLastEta('ETA 3rd September 2026').eta, '2026-09-03');
  assert.equal(collectEtaCandidates('The comment mentions 03-Sep-26 without an ETA label').length, 0);
});

test('flags malformed and conflicting ETA text instead of silently accepting it', () => {
  const invalid = findLastEta('ETA | 31-Apr-26');
  assert.equal(invalid.eta, null);
  assert.equal(invalid.mentionedUnparsed, true);

  const conflicting = findLastEta('Accounting ETA | 02-Sep-26; Revised ETA | 04-Sep-26');
  assert.equal(conflicting.eta, '2026-09-04');
  assert.equal(conflicting.multipleDistinct, true);
  assert.deepEqual(conflicting.candidates, ['2026-09-02', '2026-09-04']);
});

test('separates the complete Expected Closure cell from the PDF Comments column', () => {
  const dev = parseWipRow('229295 Example subject O2C Enhancement | Fix in progress. Dev ETA | 04-Sep-26');
  assert.equal(dev.comment, 'Enhancement | Fix in progress.');
  assert.equal(dev.eta, '2026-09-04');
  assert.equal(dev.etaSource, 'Dev ETA | 04-Sep-26');

  const qualified = parseWipRow('211595 Example subject O2C Waiting on Oracle ETA | 03-Sep-26 | Dependent on SR');
  assert.equal(qualified.comment, 'Waiting on Oracle');
  assert.equal(qualified.etaSource, 'ETA | 03-Sep-26 | Dependent on SR');

  const punctuatedTrack = parseWipRow('223431 Example subject P2P’ Dev in Progress ETA | 08-Sep-26');
  assert.equal(punctuatedTrack.comment, 'Dev in Progress');
});

test('reads the report period independently from Expected Closure dates', () => {
  const pages = [{ text: 'RDC Concrete AMS\nWeekly Status Report: 22-Aug-2026 – 28-Aug-2026' }];
  assert.deepEqual(findReportPeriod(pages), { start: '2026-08-22', end: '2026-08-28' });
});

test('does not append the PDF copyright footer to a final row with no ETA', () => {
  const rows = splitRows('Header\n230257 Example Finance Still investigating\n© 2026. For information, contact Deloitte Touche Tohmatsu Limited.');
  const parsed = parseWipRow(rows[0]);
  assert.equal(parsed.comment, 'Still investigating');
  assert.equal(parsed.eta, null);
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

test('keeps the uniquely highest ETA when the same Request ID has different dates', () => {
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
  assert.equal(result.wip[0].eta, '2026-09-02');
  assert.equal(result.wip[0].comment, 'Analysis in Progress');
  assert.equal(result.wip[0].duplicateConflict, false);
  assert.equal(result.wip[0].canApply, true);
  assert.equal(result.wip[0].duplicateResolution, 'latest_eta');
  assert.equal(result.wip[0].discardedVariants[0].eta, '2026-08-03');
  assert.deepEqual(result.duplicateSummary.resolvedByLatestEtaIds, ['231590']);
  assert.deepEqual(result.duplicateSummary.conflictingIds, []);
});

test('uses the dated row when one request appears in both actionable Deloitte tables', () => {
  const result = consolidateParsedRows(
    [{ requestId: '230519', subject: 'Attachment issue', comment: 'Analysis', eta: '2026-09-01' }],
    [{ requestId: '230519', subject: 'Attachment issue' }]
  );

  assert.equal(result.wip.length, 1);
  assert.equal(result.pendingWithUser.length, 0);
  assert.equal(result.wip[0].canApply, true);
  assert.equal(result.wip[0].duplicateResolution, 'latest_eta');
});

test('blocks conflicting duplicate rows when the highest ETA is tied', () => {
  const result = consolidateParsedRows([
    { requestId: '231590', subject: 'Refund', comment: 'Analysis', eta: '2026-09-02' },
    { requestId: '231590', subject: 'Refund', comment: 'Testing', eta: '2026-09-02' },
  ], []);

  assert.equal(result.wip.length, 1);
  assert.equal(result.wip[0].canApply, false);
  assert.equal(result.wip[0].duplicateConflict, true);
  assert.deepEqual(result.duplicateSummary.conflictingIds, ['231590']);
});
