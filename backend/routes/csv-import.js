const express = require('express');
const { pool } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('admin', 'editor'));

const VALID_STATUSES = ['Open', 'In Progress', 'Pending', 'On Hold', 'Pending with User', 'Closed'];

function normalizeStatus(v) {
  if (!v) return 'Open';
  const l = v.toLowerCase().trim();
  if (l.includes('progress') || l === 'wip') return 'In Progress';
  // Must come before the generic "pending" substring check below, otherwise "Pending with
  // User" gets collapsed down to plain "Pending" and the distinct status is lost.
  if (l === 'pending with user' || l === 'pending on user') return 'Pending with User';
  if (l.includes('pending')) return 'Pending';
  if (l.includes('hold')) return 'On Hold';
  if (l.includes('clos') || l.includes('done') || l.includes('complet') || l.includes('resolv')) return 'Closed';
  if (VALID_STATUSES.includes(v)) return v;
  return 'Open';
}

function normalizeScope(v) {
  if (!v) return null;
  const l = v.toLowerCase().trim();
  if (l.includes('int')) return 'Internal';
  if (l.includes('ext')) return 'External';
  if (['Internal', 'External'].includes(v)) return v;
  return null;
}

function normalizeDate(v) {
  if (!v || ['', '-', 'n/a', 'na', 'nil', 'none'].includes(v.trim().toLowerCase())) return null;
  const trimmed = v.trim();

  // Purely numeric D-M-Y or D/M/Y (e.g. "05/08/2026") is ambiguous — JS's Date constructor
  // assumes US M-D-Y, but this app's source data is day-first (India). Parse those
  // explicitly as day-first; unambiguous formats (month names, ISO YYYY-MM-DD) still go
  // through the generic parser below, which handles them correctly either way.
  const dmy = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const day = parseInt(dd, 10), month = parseInt(mm, 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  // Use local date parts, not toISOString() (which converts to UTC and can shift
  // a date-only value back a day for timezones ahead of UTC, e.g. India Standard Time).
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// POST /api/csv-import/execute
// Body: { category, rows: [{ sr_number, description, ... }] }
// New SR numbers are created; SR numbers that already exist are UPDATED (overwritten)
// with whatever the latest CSV provides, field by field, so re-uploading a refreshed
// export keeps the app in sync. A blank cell for a field the user didn't map leaves the
// existing value alone — only fields with an actual value in this CSV get overwritten,
// so a partial re-import (e.g. just Status) can't wipe out unrelated data.
router.post('/execute', async (req, res, next) => {
  const { category, rows } = req.body;

  if (!category || !['SR', 'Digitization'].includes(category))
    return res.status(400).json({ message: 'Valid category is required' });
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ message: 'No rows provided' });

  let imported = 0, updated = 0, skipped = 0, errors = [];
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // One batched lookup for every row's sr_number instead of a SELECT per row — an import
    // can easily be 40-100 rows, which was 40-100 extra round trips just to check
    // insert-vs-update before any writes even happened.
    const srNumbers = [...new Set(rows.map(r => (r.sr_number || '').trim()).filter(Boolean))];
    const existingBySrNumber = new Map();
    if (srNumbers.length) {
      const [existingRows] = await conn.query(
        `SELECT * FROM srs WHERE sr_number IN (${srNumbers.map(() => '?').join(',')}) AND category = ? AND is_deleted = 0`,
        [...srNumbers, category]
      );
      for (const row of existingRows) existingBySrNumber.set(row.sr_number, row);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const srNum = (row.sr_number || '').trim();
        if (!srNum) { skipped++; continue; }

        const existing = existingBySrNumber.get(srNum);

        if (!existing) {
          if (category === 'Digitization' && !row.project_name?.trim()) {
            errors.push(`Row ${i + 2}: Project Name is required for new Digitization projects`); skipped++; continue;
          }
          if (category === 'SR' && !row.description?.trim()) {
            errors.push(`Row ${i + 2}: Description is required for new SRs`); skipped++; continue;
          }

          const status = normalizeStatus(row.status);
          const closedDate = status === 'Closed'
            ? (normalizeDate(row.closed_date) || new Date().toISOString().split('T')[0])
            : normalizeDate(row.closed_date);

          await conn.execute(`
            INSERT INTO srs (
              sr_number, category, scope, status, pending_with, assigned_to,
              description, type, creation_date, created_by_name, expected_closure_date,
              project_name, process_owner, target_date,
              closed_date, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            srNum, category, category === 'SR' ? normalizeScope(row.scope) : null, status,
            row.pending_with?.trim() || null,
            row.assigned_to?.trim() || null,
            row.description?.trim() || null,
            row.type?.trim() || null,
            normalizeDate(row.creation_date),
            row.created_by_name?.trim() || null,
            normalizeDate(row.expected_closure_date),
            row.project_name?.trim() || null,
            row.process_owner?.trim() || null,
            normalizeDate(row.target_date),
            closedDate,
            req.user.id, req.user.id
          ]);
          imported++;
          continue;
        }

        // Existing SR — overwrite only the fields this row actually provides a value for.
        const candidates = {
          scope: category === 'SR' ? normalizeScope(row.scope) : null,
          pending_with: row.pending_with?.trim() || null,
          assigned_to: row.assigned_to?.trim() || null,
          description: row.description?.trim() || null,
          type: row.type?.trim() || null,
          creation_date: normalizeDate(row.creation_date),
          created_by_name: row.created_by_name?.trim() || null,
          expected_closure_date: normalizeDate(row.expected_closure_date),
          project_name: row.project_name?.trim() || null,
          process_owner: row.process_owner?.trim() || null,
          target_date: normalizeDate(row.target_date),
        };

        const setClauses = [];
        const params = [];
        const historyEntries = [];

        Object.entries(candidates).forEach(([field, value]) => {
          if (value !== null && String(value) !== String(existing[field] ?? '')) {
            setClauses.push(`${field} = ?`);
            params.push(value);
            historyEntries.push({ field, old: existing[field], new: value });
          }
        });

        if (row.status) {
          const newStatus = normalizeStatus(row.status);
          if (newStatus !== existing.status) {
            setClauses.push('status = ?'); params.push(newStatus);
            historyEntries.push({ field: 'status', old: existing.status, new: newStatus });

            if (newStatus === 'Closed' && existing.status !== 'Closed') {
              const cd = normalizeDate(row.closed_date) || new Date().toISOString().split('T')[0];
              setClauses.push('closed_date = ?'); params.push(cd);
              historyEntries.push({ field: 'closed_date', old: existing.closed_date, new: cd });
            } else if (newStatus !== 'Closed' && existing.status === 'Closed') {
              setClauses.push('closed_date = ?'); params.push(null);
              historyEntries.push({ field: 'closed_date', old: existing.closed_date, new: null });
            }
          }
        }

        // Only count as "updated" if a field actually changed — a re-upload of an unchanged
        // export should report 0 updated, not one per matched row, matching the diffed-update
        // convention used everywhere else in this codebase (e.g. deloitte-import.js).
        if (setClauses.length > 0) {
          setClauses.push('updated_by = ?');
          params.push(req.user.id, existing.id);
          await conn.execute(`UPDATE srs SET ${setClauses.join(', ')} WHERE id = ?`, params);
          for (const h of historyEntries) {
            await conn.execute(
              'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
              [existing.id, h.field, h.old, h.new, req.user.id]
            );
          }
          updated++;
        }
      } catch (e) {
        errors.push(`Row ${i + 2}: ${e.message}`);
      }
    }

    await conn.commit();
    res.json({ imported, updated, skipped, errors: errors.slice(0, 20),
      message: `Done: ${imported} new, ${updated} updated, ${skipped} skipped (missing required fields)` });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

module.exports = router;
