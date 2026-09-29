// pending_with can hold multiple people on one SR. Stored as a plain comma-separated list
// with NO space after the comma (e.g. "Atish Kshirsagar,Nagesh Tiwari") specifically so
// MySQL's FIND_IN_SET() can match a single name inside it directly — FIND_IN_SET splits its
// haystack on literal commas only, so a space before a name would make every name after the
// first silently fail to match. Always write through normalizePendingWith(); always read
// multiple names back out through splitPendingWith().

// De-duped case-insensitively (first-seen casing wins) — without this, the same name typed
// or selected twice for one SR would double-count that SR everywhere fan-out happens
// (dashboard totals, reminder emails listing it twice for the same person).
function splitPendingWith(raw) {
  const names = Array.isArray(raw)
    ? raw.map(s => String(s).trim()).filter(Boolean)
    : String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
  const seen = new Set();
  const deduped = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(name);
  }
  return deduped;
}

function normalizePendingWith(raw) {
  if (raw === undefined || raw === null) return null;
  const names = splitPendingWith(raw);
  return names.length ? names.join(',') : null;
}

// Builds a WHERE fragment matching any row whose pending_with contains at least one of the
// names in filterValue (a comma-joined list of selected filter checkboxes from the frontend,
// e.g. "Atish Kshirsagar,Nagesh Tiwari"). "(Unassigned)" matches a blank/null field, same
// meaning it's had everywhere else in this app (see stats.js's pendingByPerson).
function buildPendingWithClause(column, filterValue) {
  if (!filterValue) return null;
  const values = String(filterValue).split(',').filter(Boolean);
  if (!values.length) return null;

  const names = values.filter(v => v !== '(Unassigned)');
  const parts = [];
  const params = [];
  if (values.includes('(Unassigned)')) parts.push(`(${column} IS NULL OR TRIM(${column}) = '')`);
  if (names.length) {
    parts.push(`(${names.map(() => `FIND_IN_SET(?, ${column})`).join(' OR ')})`);
    params.push(...names);
  }
  return parts.length ? { sql: `(${parts.join(' OR ')})`, params } : null;
}

// "Pending with User" is a status placeholder the ManageEngine sync writes into pending_with
// when a ticket is waiting on the requester to respond (see services/manageengine-sync.js) —
// it echoes the SR's own status, it does not name anyone. Unlike Deloitte (a real entity that
// just happens to be out of scope for the reminder feature specifically, see
// routes/pending-reminders.js), this should never become a Contacts entry or a Pending With
// picker suggestion at all — there's no "person" here to ever put an email against.
function isRealPersonName(name) {
  return name.toLowerCase() !== 'pending with user';
}

module.exports = { splitPendingWith, normalizePendingWith, buildPendingWithClause, isRealPersonName };
