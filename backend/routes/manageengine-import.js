const express = require('express');
const multer = require('multer');
const { pool } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { getSyncStatus, runManageEngineSync } = require('../services/manageengine-sync');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('admin'));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// The API sync only updates SRs that already exist locally. These endpoints let an admin
// see the scheduler's most recent outcome and trigger the exact same guarded job on demand.
router.get('/sync-status', async (_req, res, next) => {
  try { res.json(await getSyncStatus()); } catch (error) { next(error); }
});

router.post('/sync-now', async (_req, res, next) => {
  try { res.json(await runManageEngineSync('manual')); } catch (error) { next(error); }
});

// Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas, and doubled
// double-quotes ("" -> ") inside a quoted field — good enough for a ManageEngine export,
// same approach already trusted elsewhere in this app for structured text extraction.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function loadRows(buffer) {
  const rows = parseCSV(buffer.toString('utf8'));
  const header = rows[0] || [];
  const idx = {};
  header.forEach((h, i) => idx[h.trim()] = i);
  const required = ['Request ID', 'Technician.Name', 'Status.Name'];
  const missing = required.filter(h => idx[h] === undefined);
  if (missing.length) throw new Error(`CSV is missing expected column(s): ${missing.join(', ')}`);
  return rows.slice(1).map(r => ({
    request_id: (r[idx['Request ID']] || '').trim(),
    technician: (r[idx['Technician.Name']] || '').trim(),
    status: (r[idx['Status.Name']] || '').trim(),
  })).filter(r => r.request_id);
}

// ManageEngine ServiceDesk's closed-family statuses — anything else (Open, On Hold, In
// Progress, Pending, ...) is treated as still-open. Deliberately conservative: only
// well-known "this ticket is done" labels count as closed-family, so an unrecognized status
// from a future ManageEngine export falls on the safe side (kept open) rather than the risky
// side (silently treated as done).
const CLOSED_STATUSES = new Set(['closed', 'resolved', 'cancelled', 'canceled', 'rejected']);
function isClosedFamily(status) { return CLOSED_STATUSES.has((status || '').toLowerCase().trim()); }

// assigned_to (not pending_with) is the match key — confirmed against live data that
// assigned_to is the stable "who owns this ticket" field mirroring ManageEngine's
// Technician.Name (it stays constant even after a ticket closes), while pending_with tracks
// a different, more dynamic "who needs to act next" concept ManageEngine doesn't export here.
async function crossReference(rows, assignedTo) {
  const openRows = rows.filter(r => !isClosedFamily(r.status));
  const closedRows = rows.filter(r => isClosedFamily(r.status));
  const csvRequestIds = new Set(rows.map(r => r.request_id));

  const [dbRows] = await pool.query(
    "SELECT id, sr_number, status, description FROM srs WHERE category='SR' AND is_deleted=0 AND TRIM(assigned_to) = ?",
    [assignedTo]
  );
  const dbBySrNumber = new Map(dbRows.map(r => [r.sr_number, r]));

  const untrackedOpenCount = openRows.filter(r => !dbBySrNumber.has(r.request_id)).length;

  const toClose = closedRows
    .filter(r => dbBySrNumber.has(r.request_id) && dbBySrNumber.get(r.request_id).status !== 'Closed')
    .map(r => {
      const sr = dbBySrNumber.get(r.request_id);
      return { sr_id: sr.id, sr_number: sr.sr_number, description: sr.description, current_status: sr.status, manageengine_status: r.status };
    });

  const alreadyOpenBothCount = openRows.filter(r => dbBySrNumber.has(r.request_id) && dbBySrNumber.get(r.request_id).status !== 'Closed').length;
  const closedNeverTrackedCount = closedRows.filter(r => !dbBySrNumber.has(r.request_id)).length;

  // Tracked as open in our portal, assigned to this technician, but absent from the export
  // entirely (neither open- nor closed-family) — most likely reassigned to someone else in
  // ManageEngine. Flagged for a human to check, never auto-closed on an absence guess alone.
  const ambiguous = dbRows
    .filter(r => r.status !== 'Closed' && !csvRequestIds.has(r.sr_number))
    .map(r => ({ sr_id: r.id, sr_number: r.sr_number, description: r.description }));

  // A light sanity check that the uploaded file actually belongs to the selected technician
  // — catches "wrong file picked from the dropdown" before it creates 40 misattributed SRs.
  const technicianCounts = {};
  for (const r of rows) technicianCounts[r.technician] = (technicianCounts[r.technician] || 0) + 1;
  const dominantTechnician = Object.entries(technicianCounts).sort((a, b) => b[1] - a[1])[0];
  const technicianMismatch = dominantTechnician && dominantTechnician[0] !== assignedTo && rows.length > 0
    ? { csvTechnician: dominantTechnician[0], csvTechnicianCount: dominantTechnician[1], totalRows: rows.length }
    : null;

  return { toClose, untrackedOpenCount, alreadyOpenBothCount, closedNeverTrackedCount, ambiguous, technicianMismatch, totalRows: rows.length };
}

// POST /api/manageengine-import/parse — multipart, field "csv", body field "assignedTo".
// Read-only: matches CSV rows against live SRs but writes nothing.
router.post('/parse', upload.single('csv'), async (req, res, next) => {
  try {
    const assignedTo = (req.body.assignedTo || '').trim();
    if (!assignedTo) return res.status(400).json({ message: 'assignedTo is required' });
    if (!req.file) return res.status(400).json({ message: 'No CSV file uploaded' });

    const rows = loadRows(req.file.buffer);
    const result = await crossReference(rows, assignedTo);
    res.json(result);
  } catch (e) {
    if (e.message.startsWith('CSV is missing')) return res.status(400).json({ message: e.message });
    next(e);
  }
});

// POST /api/manageengine-import/apply — body: { assignedTo, toClose: [...] }
// ManageEngine reconciliation is update-only: untracked rows from the uploaded export are
// never accepted here, even if an older client submits a toCreate payload.
router.post('/apply', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const assignedTo = (req.body.assignedTo || '').trim();
    const toClose = Array.isArray(req.body.toClose) ? req.body.toClose : [];
    if (!assignedTo) return res.status(400).json({ message: 'assignedTo is required' });

    let closed = 0;
    await conn.beginTransaction();

    const cd = new Date().toISOString().split('T')[0];
    for (const row of toClose) {
      await conn.execute(`UPDATE srs SET status = 'Closed', closed_date = ?, updated_by = ? WHERE id = ?`, [cd, req.user.id, row.sr_id]);
      await conn.execute(
        'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
        [row.sr_id, 'status', row.current_status, 'Closed', req.user.id]
      );
      closed++;
    }

    await conn.commit();
    res.json({ closed });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

module.exports = router;
