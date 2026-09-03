const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');

test('ManageEngine automatic and CSV sync paths cannot insert local SRs', () => {
  const automaticSync = fs.readFileSync(path.join(backendRoot, 'services', 'manageengine-sync.js'), 'utf8');
  const csvFallback = fs.readFileSync(path.join(backendRoot, 'routes', 'manageengine-import.js'), 'utf8');

  assert.doesNotMatch(automaticSync, /INSERT\s+INTO\s+srs/i);
  assert.doesNotMatch(csvFallback, /INSERT\s+INTO\s+srs/i);
});
