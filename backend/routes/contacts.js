const express = require('express');
const { pool } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { EMAIL_REGEX } = require('../utils/validation');
const { splitPendingWith, normalizePendingWith } = require('../utils/pendingWith');

const router = express.Router();
router.use(authenticate);

// Every SR page + the SR form need this list (to populate the Pending With picker), so any
// logged-in user can read it — only admin can change it, same split as backup settings.
router.get('/', async (req, res, next) => {
  try {
    // The Pending-With Contacts admin screen needs to see inactive (soft-deleted) and ignored
    // entries too, to organize them into their own tabs and allow restoring/un-ignoring - every
    // other caller (the SR form's picker, etc.) only wants the normal active set.
    const includeAll = req.query.all === 'true' && req.user.role === 'admin';
    const [rows] = await pool.query(
      includeAll
        ? 'SELECT * FROM contacts ORDER BY name'
        : 'SELECT * FROM contacts WHERE is_deleted = 0 ORDER BY name'
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.use(requireRole('admin'));

function trimOrNull(v) {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

// Contacts is the name-to-email directory the SR form's Pending With picker draws from — but
// pending_with/assigned_to/created_by_name on every SR are their own plain-text columns, not a
// foreign key to contacts. Renaming a contact here (e.g. standardizing "Rohit" to "Rohit Negi")
// would otherwise only affect new SRs going forward, silently leaving every existing SR still
// showing the old spelling. Cascade the rename into every currently-active SR that used the old
// name so a rename here really does apply everywhere, the same as a manual SR edit would, with
// a normal (non-NULL) changed_by since this is a deliberate admin action, not a background sync.
async function cascadeContactRename(oldName, newName, changedBy) {
  if (!oldName || !newName || oldName.toLowerCase() === newName.toLowerCase()) return 0;
  let count = 0;

  const [pwRows] = await pool.query(
    'SELECT id, pending_with FROM srs WHERE is_deleted = 0 AND FIND_IN_SET(?, pending_with)', [oldName]
  );
  for (const row of pwRows) {
    const names = splitPendingWith(row.pending_with)
      .map(n => n.toLowerCase() === oldName.toLowerCase() ? newName : n);
    const newValue = normalizePendingWith(names.join(','));
    if (newValue === row.pending_with) continue;
    await pool.execute('UPDATE srs SET pending_with = ? WHERE id = ?', [newValue, row.id]);
    await pool.execute(
      'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
      [row.id, 'pending_with', row.pending_with, newValue, changedBy]
    );
    count++;
  }

  for (const field of ['assigned_to', 'created_by_name']) {
    const [rows] = await pool.query(
      `SELECT id, ${field} as val FROM srs WHERE is_deleted = 0 AND LOWER(${field}) = LOWER(?)`, [oldName]
    );
    for (const row of rows) {
      await pool.execute(`UPDATE srs SET ${field} = ? WHERE id = ?`, [newName, row.id]);
      await pool.execute(
        'INSERT INTO sr_history (sr_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
        [row.id, field, row.val, newName, changedBy]
      );
      count++;
    }
  }

  return count;
}

router.post('/', async (req, res, next) => {
  try {
    const name = trimOrNull(req.body.name);
    const email = trimOrNull(req.body.email);
    const isIgnored = req.body.is_ignored ? 1 : 0;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (email && !EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Not a valid email address' });

    // name has a case-sensitive UNIQUE index regardless of is_deleted, so a name that was
    // previously merged/removed (soft-deleted) would otherwise hit ER_DUP_ENTRY here even
    // though no active contact by that name is visible anywhere - revive that row instead of
    // trying to insert a second one under the same name.
    const [existing] = await pool.query('SELECT id, is_deleted FROM contacts WHERE name = ?', [name]);
    if (existing[0] && !existing[0].is_deleted) {
      return res.status(409).json({ message: `A contact named "${name}" already exists` });
    }

    if (existing[0]) {
      await pool.execute(
        'UPDATE contacts SET email = ?, is_ignored = ?, is_deleted = 0, updated_by = ? WHERE id = ?',
        [email, isIgnored, req.user.id, existing[0].id]
      );
      const [rows] = await pool.execute('SELECT * FROM contacts WHERE id = ?', [existing[0].id]);
      return res.status(201).json(rows[0]);
    }

    const [result] = await pool.execute(
      'INSERT INTO contacts (name, email, is_ignored, updated_by) VALUES (?, ?, ?, ?)',
      [name, email, isIgnored, req.user.id]
    );
    const [rows] = await pool.execute('SELECT * FROM contacts WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A contact with this name already exists' });
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    // No is_deleted guard here (unlike before) - restoring a contact out of the Inactive tab
    // goes through this same route with { is_deleted: false }, so it must be able to find it.
    const [rows] = await pool.execute('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Contact not found' });

    const name = req.body.name !== undefined ? trimOrNull(req.body.name) : rows[0].name;
    const email = req.body.email !== undefined ? trimOrNull(req.body.email) : rows[0].email;
    const isIgnored = req.body.is_ignored !== undefined ? (req.body.is_ignored ? 1 : 0) : rows[0].is_ignored;
    const isDeleted = req.body.is_deleted !== undefined ? (req.body.is_deleted ? 1 : 0) : rows[0].is_deleted;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (email && !EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Not a valid email address' });

    await pool.execute(
      'UPDATE contacts SET name = ?, email = ?, is_ignored = ?, is_deleted = ?, updated_by = ? WHERE id = ?',
      [name, email, isIgnored, isDeleted, req.user.id, req.params.id]
    );

    let srsUpdated = 0;
    if (rows[0].name !== name) {
      srsUpdated = await cascadeContactRename(rows[0].name, name, req.user.id);
    }

    const [updated] = await pool.execute('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
    res.json({ ...updated[0], srsUpdated });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A contact with this name already exists' });
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT id FROM contacts WHERE id = ? AND is_deleted = 0', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Contact not found' });
    await pool.execute('UPDATE contacts SET is_deleted = 1, updated_by = ? WHERE id = ?', [req.user.id, req.params.id]);
    res.json({ message: 'Contact removed' });
  } catch (e) { next(e); }
});

module.exports = router;
