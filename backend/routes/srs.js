const express = require('express');
const { pool } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { splitPendingWith, normalizePendingWith, buildPendingWithClause } = require('../utils/pendingWith');

const router = express.Router();
router.use(authenticate);

const VALID_STATUSES = ['Open', 'In Progress', 'Pending', 'On Hold', 'Closed'];

// admin/editor can write either category, as before. A viewer normally can't write at all,
// except one narrow carve-out: an admin can flag a specific viewer (users.can_edit_digitization)
// to edit Digitization Projects specifically — Service Requests stay off-limits to them either
// way. Category isn't known until the request body (POST) or the fetched row (PUT) is in hand,
// so this can't be a simple router-level requireRole() the way close/reopen/delete still are.
function canWriteCategory(user, category) {
  if (user.role === 'admin' || user.role === 'editor') return true;
  return user.role === 'viewer' && !!user.can_edit_digitization && category === 'Digitization';
}

// csv-import.js already trims every free-text field on write; the manual Add/Edit form's
// backend path didn't, which let a stray leading/trailing space (e.g. pasted from Excel) into
// a field like pending_with — invisible in the UI but enough to make that value silently stop
// matching the same, trimmed value used elsewhere (Dashboard tiles, distinct-value dropdowns,
// Deloitte-import matching). Applied to every genuinely free-typed text field below.
function trimOrNull(v) {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

// pending_with gets its own transform (normalizePendingWith) rather than a plain trim — it
// can hold multiple comma-separated names now, and needs the comma-no-space normalization
// FIND_IN_SET-based filtering (see utils/pendingWith.js) depends on.
const FIELD_TRANSFORMS = {
  description: trimOrNull, type: trimOrNull, created_by_name: trimOrNull,
  pending_with: normalizePendingWith, assigned_to: trimOrNull,
  project_name: trimOrNull, process_owner: trimOrNull,
};

// Columns that may be sorted on, mapped to their SQL expression (whitelisted to prevent injection)
const SORTABLE_FIELDS = {
  sr_number: 's.sr_number',
  description: 's.description',
  scope: 's.scope',
  type: 's.type',
  creation_date: 's.creation_date',
  status: 's.status',
  created_by_name: 's.created_by_name',
  pending_with: 's.pending_with',
  assigned_to: 's.assigned_to',
  expected_closure_date: 's.expected_closure_date',
  project_name: 's.project_name',
  process_owner: 's.process_owner',
  target_date: 's.target_date',
  pending_since_days: 'pending_since_days',
  days_since_raised: 'days_since_raised',
  last_comment_at: 'last_comment_at',
};

const insertHistory = (sr_id, field, oldVal, newVal, changedBy) =>
  pool.execute(
    'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
    [sr_id, field, oldVal, newVal, changedBy]
  );

// List SRs with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { category, status, scope, type, pendingWith, assignedTo, search, excludeClosed, overdue, sortField, sortOrder, page = 1, limit = 50 } = req.query;
    let where = 'WHERE s.is_deleted = 0';
    const params = [];
    // Digitization tracks its due date as target_date, not expected_closure_date.
    const dueDateField = category === 'Digitization' ? 's.target_date' : 's.expected_closure_date';

    function addInFilter(column, value) {
      if (!value) return;
      const values = value.split(',').filter(Boolean);
      if (!values.length) return;
      where += ` AND ${column} IN (${values.map(() => '?').join(',')})`;
      params.push(...values);
    }

    // pending_with can hold multiple people — matching needs FIND_IN_SET, not a plain IN(),
    // so a filter/click on one name still finds an SR that's shared with someone else too.
    // "(Unassigned)" is a display-only label the Dashboard's Pending With breakdown uses for
    // a blank/null field (see stats.js's pendingByPerson) — it's never actually stored, so
    // clicking through to it needs to match "blank" rather than the literal string.
    function addPendingWithFilter(column, value) {
      const clause = buildPendingWithClause(column, value);
      if (!clause) return;
      where += ` AND ${clause.sql}`;
      params.push(...clause.params);
    }

    if (category) { where += ' AND s.category = ?'; params.push(category); }
    if (status) { addInFilter('s.status', status); }
    else if (excludeClosed === 'true') { where += " AND s.status != 'Closed'"; }
    if (overdue === 'true') { where += ` AND s.status != 'Closed' AND ${dueDateField} < CURDATE()`; }
    addInFilter('s.scope', scope);
    addInFilter('s.type', type);
    addPendingWithFilter('s.pending_with', pendingWith);
    addInFilter('s.assigned_to', assignedTo);
    if (search) {
      where += ' AND (s.sr_number LIKE ? OR s.description LIKE ? OR s.project_name LIKE ? OR s.pending_with LIKE ? OR s.created_by_name LIKE ? OR s.assigned_to LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }

    let orderClause = category === 'Digitization'
      ? "ORDER BY (s.status = 'Closed') ASC, CAST(s.sr_number AS SIGNED) ASC, s.sr_number ASC"
      : "ORDER BY (s.status = 'Closed') ASC, pending_since_days DESC";
    if (sortField && SORTABLE_FIELDS[sortField]) {
      const dir = sortOrder === 'ascend' ? 'ASC' : 'DESC';
      orderClause = `ORDER BY ${SORTABLE_FIELDS[sortField]} ${dir}`;
    }

    const lim = parseInt(limit);
    const offset = (parseInt(page) - 1) * lim;

    // Count and data don't depend on each other — run them concurrently instead of back to
    // back. The three separate correlated subqueries this used to run per row for the last
    // comment (comment text, timestamp, commenter name) are now a single one, via a JOIN
    // whose ON condition looks up just the latest sr_comments.id per SR (still uses
    // idx_comments_sr) — one lookup per row instead of three, same result.
    const [[totalRows], [rows]] = await Promise.all([
      pool.query(`SELECT COUNT(*) as n FROM srs s ${where}`, params),
      pool.query(`
        SELECT s.*,
          u1.full_name as added_by_name,
          u2.full_name as updated_by_name,
          lc.comment as last_comment,
          lc.commented_at as last_comment_at,
          cu.full_name as last_comment_by,
          DATEDIFF(CURDATE(), CASE WHEN s.creation_date IS NOT NULL THEN s.creation_date ELSE DATE(s.created_at) END) as days_since_raised,
          -- Days since Pending With was last set to whoever it's CURRENTLY with — not the SR's
          -- total age. s.pending_since_date is set directly from the real ManageEngine message
          -- timestamp (see manageengine-sync.js's resolvePendingSince) or, on a manual edit,
          -- the edit date — either way the actual date the ball changed hands, not whenever a
          -- 30-minute sync happened to notice. Falls back to the older sr_history-diff-based
          -- date (pre-dates this column) and finally the raise date if it has never changed hands.
          DATEDIFF(CURDATE(), COALESCE(
            s.pending_since_date,
            (SELECT MAX(DATE(h.changed_at)) FROM sr_history h WHERE h.sr_id = s.id AND h.field_changed = 'pending_with' AND h.is_deleted = 0),
            CASE WHEN s.creation_date IS NOT NULL THEN s.creation_date ELSE DATE(s.created_at) END
          )) as pending_since_days
        FROM srs s
        LEFT JOIN users u1 ON s.created_by = u1.id
        LEFT JOIN users u2 ON s.updated_by = u2.id
        LEFT JOIN sr_comments lc ON lc.id = (
          SELECT c.id FROM sr_comments c WHERE c.sr_id = s.id AND c.is_deleted = 0 ORDER BY c.commented_at DESC LIMIT 1
        )
        LEFT JOIN users cu ON lc.commented_by = cu.id
        ${where} ${orderClause} LIMIT ? OFFSET ?
      `, [...params, lim, offset]),
    ]);
    const total = totalRows[0].n;

    res.json({ data: rows, total, page: parseInt(page), limit: lim });
  } catch (e) { next(e); }
});

// Get single SR
router.get('/:id', async (req, res, next) => {
  try {
    // None of these three depend on each other's result — only on req.params.id — so they
    // don't need to be awaited one after another.
    const [[srRows], [comments], [history]] = await Promise.all([
      pool.execute(`
        SELECT s.*, u1.full_name as added_by_name, u2.full_name as updated_by_name,
          -- Same anchor as the list view's pending_since_days (see GET / above) — the detail
          -- modal needs this too so "Pending Since" isn't only visible from the table column.
          DATEDIFF(CURDATE(), COALESCE(
            s.pending_since_date,
            (SELECT MAX(DATE(h.changed_at)) FROM sr_history h WHERE h.sr_id = s.id AND h.field_changed = 'pending_with' AND h.is_deleted = 0),
            CASE WHEN s.creation_date IS NOT NULL THEN s.creation_date ELSE DATE(s.created_at) END
          )) as pending_since_days
        FROM srs s LEFT JOIN users u1 ON s.created_by = u1.id LEFT JOIN users u2 ON s.updated_by = u2.id
        WHERE s.id = ? AND s.is_deleted = 0
      `, [req.params.id]),
      pool.execute(`
        SELECT c.*, u.full_name as commenter_name
        FROM sr_comments c LEFT JOIN users u ON c.commented_by = u.id
        WHERE c.sr_id = ? AND c.is_deleted = 0 ORDER BY c.commented_at DESC
      `, [req.params.id]),
      pool.execute(`
        SELECT h.*, u.full_name as changed_by_name
        FROM sr_history h LEFT JOIN users u ON h.changed_by = u.id
        WHERE h.sr_id = ? AND h.is_deleted = 0 ORDER BY h.changed_at DESC
      `, [req.params.id]),
    ]);
    const sr = srRows[0];
    if (!sr) return res.status(404).json({ message: 'SR not found' });

    res.json({ ...sr, comments, history });
  } catch (e) { next(e); }
});

// Create SR — admin/editor for either category; a viewer flagged can_edit_digitization may
// create Digitization Projects only.
router.post('/', async (req, res, next) => {
  try {
    const { category } = req.body;
    const sr_number = (req.body.sr_number || '').trim();
    if (!sr_number || !category) return res.status(400).json({ message: 'SR Number and Category are required' });
    if (!['SR', 'Digitization'].includes(category))
      return res.status(400).json({ message: 'Invalid category' });
    if (!canWriteCategory(req.user, category))
      return res.status(403).json({ message: 'Insufficient permissions' });

    const [existingRows] = await pool.execute(
      'SELECT id FROM srs WHERE sr_number = ? AND category = ? AND is_deleted = 0', [sr_number, category]
    );
    if (existingRows[0]) return res.status(409).json({ message: `SR ${sr_number} already exists` });

    if (category === 'Digitization' && !req.body.project_name)
      return res.status(400).json({ message: 'Project Name is required for Digitization' });
    if (category === 'SR') {
      if (!req.body.description) return res.status(400).json({ message: 'Description is required' });
      if (!['Internal', 'External'].includes(req.body.scope))
        return res.status(400).json({ message: 'Internal/External is required' });
    }

    const {
      creation_date, expected_closure_date, status, target_date, scope
    } = req.body;
    const description = trimOrNull(req.body.description);
    const type = trimOrNull(req.body.type);
    const created_by_name = trimOrNull(req.body.created_by_name);
    const pending_with = normalizePendingWith(req.body.pending_with);
    const assigned_to = trimOrNull(req.body.assigned_to);
    const project_name = trimOrNull(req.body.project_name);
    const process_owner = trimOrNull(req.body.process_owner);

    const [result] = await pool.execute(`
      INSERT INTO srs (
        sr_number, category, scope, status, pending_with, assigned_to,
        description, type, creation_date, created_by_name, expected_closure_date,
        project_name, process_owner, target_date,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sr_number, category, category === 'SR' ? scope : null, status || 'Open', pending_with, assigned_to,
      description, type, creation_date || null, created_by_name, expected_closure_date || null,
      project_name, process_owner, target_date || null,
      req.user.id, req.user.id
    ]);

    const [rows] = await pool.execute('SELECT * FROM srs WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An active record with this SR Number already exists' });
    }
    next(e);
  }
});

// Update SR — category-aware, see canWriteCategory above
router.put('/:id', async (req, res, next) => {
  try {
    const [srRows] = await pool.execute('SELECT * FROM srs WHERE id = ? AND is_deleted = 0', [req.params.id]);
    const sr = srRows[0];
    if (!sr) return res.status(404).json({ message: 'SR not found' });
    if (!canWriteCategory(req.user, sr.category))
      return res.status(403).json({ message: 'Insufficient permissions' });

    if (req.body.status === 'Closed' && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Only admin can close an SR' });
    // Reopening (status leaving Closed) is admin-only too, same as the dedicated
    // POST /:id/reopen route — without this, a plain PUT with status set to anything else
    // silently bypasses that gate for a non-admin editor.
    if (sr.status === 'Closed' && req.body.status !== undefined && req.body.status !== 'Closed' && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Only admin can reopen an SR' });

    const editableFields = [
      'description', 'type', 'creation_date', 'created_by_name', 'pending_with', 'assigned_to',
      'expected_closure_date', 'status', 'project_name', 'process_owner', 'target_date', 'scope'
    ];

    const updates = [];
    const params = [];
    const historyEntries = [];

    editableFields.forEach(f => {
      if (req.body[f] === undefined) return;
      // Trim/normalize free-text fields before comparing/storing (see FIELD_TRANSFORMS above)
      // — also means a re-save that only added/removed whitespace correctly logs as a no-op
      // instead of a spurious history entry. Log the SAME coerced value that's actually
      // written, not the raw request body, so the audit trail matches real DB state.
      const value = FIELD_TRANSFORMS[f] ? FIELD_TRANSFORMS[f](req.body[f]) : (req.body[f] || null);
      if (String(value ?? '') !== String(sr[f] ?? '')) {
        updates.push(`${f} = ?`);
        params.push(value);
        historyEntries.push({ field: f, old: sr[f], new: value });
        // A human changing who it's pending with right now IS the hand-off event — record
        // today as pending_since_date directly, same as the ManageEngine sync does from the
        // real message timestamp, so "pending since" doesn't fall back to a stale sr_history
        // diff date.
        if (f === 'pending_with') {
          const today = new Date().toISOString().split('T')[0];
          updates.push('pending_since_date = ?');
          params.push(today);
        }
      }
    });

    if (req.body.status === 'Closed' && sr.status !== 'Closed') {
      const cd = new Date().toISOString().split('T')[0];
      updates.push('closed_date = ?'); params.push(cd);
      historyEntries.push({ field: 'closed_date', old: null, new: cd });
    } else if (req.body.status && req.body.status !== 'Closed' && sr.status === 'Closed') {
      updates.push('closed_date = ?'); params.push(null);
    }

    if (updates.length === 0) return res.json(sr);

    updates.push('updated_by = ?');
    params.push(req.user.id, req.params.id);

    await pool.execute(`UPDATE srs SET ${updates.join(', ')} WHERE id = ?`, params);

    for (const h of historyEntries) {
      await insertHistory(req.params.id, h.field, h.old, h.new, req.user.id);
    }

    const [updatedRows] = await pool.execute(`
      SELECT s.*, u1.full_name as added_by_name, u2.full_name as updated_by_name
      FROM srs s LEFT JOIN users u1 ON s.created_by = u1.id LEFT JOIN users u2 ON s.updated_by = u2.id
      WHERE s.id = ?
    `, [req.params.id]);
    res.json(updatedRows[0]);
  } catch (e) { next(e); }
});

// Close SR — admin only
router.post('/:id/close', requireRole('admin'), async (req, res, next) => {
  try {
    const [srRows] = await pool.execute('SELECT * FROM srs WHERE id = ? AND is_deleted = 0', [req.params.id]);
    const sr = srRows[0];
    if (!sr) return res.status(404).json({ message: 'SR not found' });
    if (sr.status === 'Closed') return res.status(400).json({ message: 'SR is already closed' });

    const cd = new Date().toISOString().split('T')[0];
    await pool.execute(
      `UPDATE srs SET status = 'Closed', closed_date = ?, updated_by = ? WHERE id = ?`,
      [cd, req.user.id, req.params.id]
    );
    await insertHistory(req.params.id, 'status', sr.status, 'Closed', req.user.id);

    res.json({ message: 'SR closed successfully' });
  } catch (e) { next(e); }
});

// Reopen SR — admin only (in case it was closed by mistake)
router.post('/:id/reopen', requireRole('admin'), async (req, res, next) => {
  try {
    const [srRows] = await pool.execute('SELECT * FROM srs WHERE id = ? AND is_deleted = 0', [req.params.id]);
    const sr = srRows[0];
    if (!sr) return res.status(404).json({ message: 'SR not found' });
    if (sr.status !== 'Closed') return res.status(400).json({ message: 'SR is not closed' });

    await pool.execute(
      `UPDATE srs SET status = 'Open', closed_date = NULL, updated_by = ? WHERE id = ?`,
      [req.user.id, req.params.id]
    );
    await insertHistory(req.params.id, 'status', 'Closed', 'Open', req.user.id);

    res.json({ message: 'SR reopened successfully' });
  } catch (e) { next(e); }
});

// Delete SR — admin only (soft delete)
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT id FROM srs WHERE id = ? AND is_deleted = 0', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'SR not found' });
    await pool.execute('UPDATE srs SET is_deleted = 1, updated_by = ? WHERE id = ?', [req.user.id, req.params.id]);
    await insertHistory(req.params.id, 'is_deleted', '0', '1', req.user.id);
    res.json({ message: 'SR deleted' });
  } catch (e) { next(e); }
});

// Add comment — category-aware, see canWriteCategory above
router.post('/:id/comments', async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment || !comment.trim()) return res.status(400).json({ message: 'Comment cannot be empty' });

    const [srRows] = await pool.execute('SELECT id, category FROM srs WHERE id = ? AND is_deleted = 0', [req.params.id]);
    if (!srRows[0]) return res.status(404).json({ message: 'SR not found' });
    if (!canWriteCategory(req.user, srRows[0].category))
      return res.status(403).json({ message: 'Insufficient permissions' });

    const [result] = await pool.execute(
      'INSERT INTO sr_comments (sr_id, comment, commented_by) VALUES (?, ?, ?)',
      [req.params.id, comment.trim(), req.user.id]
    );

    await pool.execute('UPDATE srs SET updated_by = ? WHERE id = ?', [req.user.id, req.params.id]);

    const [newCommentRows] = await pool.execute(`
      SELECT c.*, u.full_name as commenter_name
      FROM sr_comments c LEFT JOIN users u ON c.commented_by = u.id
      WHERE c.id = ?
    `, [result.insertId]);

    res.status(201).json(newCommentRows[0]);
  } catch (e) { next(e); }
});

// Distinct values actually present in the data, for filter dropdowns whose options can't
// be a fixed list — free-form fields like Type and Pending With are often imported from
// Excel with inconsistent historical values, so the dropdown needs to reflect real data
// rather than a fixed set of options offered on the Add form.
const DISTINCT_FIELDS = {
  type: 'type',
  pendingWith: 'pending_with',
  assignedTo: 'assigned_to',
  createdByName: 'created_by_name',
  processOwner: 'process_owner',
};

// The SR screen needs three filter lists at once. Returning them from one small query avoids
// three HTTP round trips and three separate DISTINCT scans every time a user opens the page.
router.get('/meta/options', async (req, res, next) => {
  try {
    const category = req.query.category || 'SR';
    const [rows] = await pool.execute(`
      SELECT type, pending_with, assigned_to
      FROM srs
      WHERE category = ? AND is_deleted = 0
    `, [category]);
    // pending_with can hold multiple people — offer each one as its own option, not the raw
    // "Atish Kshirsagar,Nagesh Tiwari" combined string.
    const unique = field => [...new Set(rows
      .flatMap(row => field === 'pending_with' ? splitPendingWith(row[field]) : [String(row[field] || '').trim()])
      .filter(Boolean))].sort((a, b) => a.localeCompare(b));
    res.json({
      types: category === 'Digitization' ? [] : unique('type'),
      pendingWith: unique('pending_with'),
      assignedTo: category === 'Digitization' ? [] : unique('assigned_to'),
    });
  } catch (e) { next(e); }
});

router.get('/meta/distinct', async (req, res, next) => {
  try {
    const { category, field } = req.query;
    const column = DISTINCT_FIELDS[field];
    if (!column) return res.status(400).json({ message: 'Invalid field' });

    // pending_with can hold multiple names in one field, so a plain SQL DISTINCT would return
    // combined strings like "Atish Kshirsagar,Nagesh Tiwari" as one option instead of two —
    // fan it out in JS instead.
    if (column === 'pending_with') {
      const [rows] = await pool.execute(
        "SELECT pending_with FROM srs WHERE category = ? AND is_deleted = 0 AND pending_with IS NOT NULL AND pending_with != ''",
        [category || 'SR']
      );
      const names = new Set();
      rows.forEach(r => splitPendingWith(r.pending_with).forEach(n => names.add(n)));
      return res.json([...names].sort((a, b) => a.localeCompare(b)));
    }

    const [rows] = await pool.execute(`
      SELECT DISTINCT ${column} as v FROM srs
      WHERE category = ? AND is_deleted = 0 AND ${column} IS NOT NULL AND TRIM(${column}) != ''
      ORDER BY ${column}
    `, [category || 'SR']);
    res.json(rows.map(r => r.v));
  } catch (e) { next(e); }
});

// Stats — when a category is given, the breakdown reflects the current search/scope/type
// selection (so the SR page's top tiles match whatever the table is currently narrowed
// to), but never the status filter itself, since the tiles are what set that filter.
router.get('/stats/summary', async (req, res, next) => {
  try {
    const { category, search, scope, type, pendingWith, assignedTo } = req.query;

    if (!category) {
      // Digitization tracks its due date as target_date, not expected_closure_date — this
      // grouped (all-categories) query needs a per-row CASE since it can't take a single
      // fixed field name the way the category-specific query below can.
      // COALESCE each SUM to 0: SQL's SUM() returns NULL (not 0) over zero matching rows,
      // while COUNT(*) correctly returns 0 — without this, a category/filter combo with zero
      // hits renders every tile but Total as the literal string "null" on the frontend.
      const [stats] = await pool.query(`
        SELECT category,
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END), 0) as open,
          COALESCE(SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END), 0) as in_progress,
          COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) as pending,
          COALESCE(SUM(CASE WHEN status = 'On Hold' THEN 1 ELSE 0 END), 0) as on_hold,
          COALESCE(SUM(CASE WHEN status = 'Pending with User' THEN 1 ELSE 0 END), 0) as pending_with_user,
          COALESCE(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END), 0) as closed,
          COALESCE(SUM(CASE WHEN status != 'Closed' AND
            (CASE WHEN category = 'Digitization' THEN target_date ELSE expected_closure_date END) < CURDATE()
            THEN 1 ELSE 0 END), 0) as overdue
        FROM srs WHERE is_deleted = 0 GROUP BY category
      `);
      return res.json(stats);
    }

    let where = 'WHERE category = ? AND is_deleted = 0';
    const params = [category];
    const dueDateField = category === 'Digitization' ? 'target_date' : 'expected_closure_date';

    function addInFilter(column, value) {
      if (!value) return;
      const values = value.split(',').filter(Boolean);
      if (!values.length) return;
      where += ` AND ${column} IN (${values.map(() => '?').join(',')})`;
      params.push(...values);
    }
    function addPendingWithFilter(column, value) {
      const clause = buildPendingWithClause(column, value);
      if (!clause) return;
      where += ` AND ${clause.sql}`;
      params.push(...clause.params);
    }
    addInFilter('scope', scope);
    addInFilter('type', type);
    addPendingWithFilter('pending_with', pendingWith);
    addInFilter('assigned_to', assignedTo);
    if (search) {
      where += ' AND (sr_number LIKE ? OR description LIKE ? OR project_name LIKE ? OR pending_with LIKE ? OR created_by_name LIKE ? OR assigned_to LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }

    const [rows] = await pool.query(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END), 0) as open,
        COALESCE(SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END), 0) as in_progress,
        COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN status = 'On Hold' THEN 1 ELSE 0 END), 0) as on_hold,
        COALESCE(SUM(CASE WHEN status = 'Pending with User' THEN 1 ELSE 0 END), 0) as pending_with_user,
        COALESCE(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END), 0) as closed,
        COALESCE(SUM(CASE WHEN status != 'Closed' AND ${dueDateField} < CURDATE() THEN 1 ELSE 0 END), 0) as overdue
      FROM srs ${where}
    `, params);

    res.json({ category, ...rows[0] });
  } catch (e) { next(e); }
});

module.exports = router;
