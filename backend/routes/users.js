const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { RDC_EMAIL_REGEX } = require('../utils/validation');
const { generateRandomPassword } = require('../utils/password');
const { createResetToken } = require('../utils/resetToken');
const { sendWelcomeEmail } = require('../services/mailer');

const router = express.Router();
router.use(authenticate);

const USER_COLUMNS = 'id, full_name, email, role, can_edit_digitization, is_active, created_at';
const VALID_ROLES = ['admin', 'editor', 'viewer'];

// Generates a temp password, creates the user, sends the welcome email, and returns
// { status: 'created', email_sent } or { status: 'failed', message }. Shared by the
// single-create and bulk-create routes so both go through the exact same account-setup path.
async function provisionUser({ full_name, email, role, canEditDigitization, req }) {
  const [existingRows] = await pool.execute('SELECT id FROM users WHERE email = ? AND is_deleted = 0', [email]);
  if (existingRows[0]) return { status: 'failed', message: 'A user with this email already exists' };

  const tempPassword = generateRandomPassword();
  const hashed = bcrypt.hashSync(tempPassword, 10);
  const [result] = await pool.execute(
    'INSERT INTO users (full_name, email, password, role, can_edit_digitization) VALUES (?, ?, ?, ?, ?)',
    [full_name, email, hashed, role, canEditDigitization ? 1 : 0]
  );

  const rawToken = await createResetToken(result.insertId);
  const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${rawToken}`;
  let emailSent = true;
  try {
    await sendWelcomeEmail({ to: email, fullName: full_name, tempPassword, resetUrl });
  } catch (mailErr) {
    emailSent = false;
    console.error(`Failed to send welcome email to ${email}:`, mailErr.message);
  }

  return { status: 'created', id: result.insertId, email_sent: emailSent };
}

// List users (admin only)
router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ${USER_COLUMNS} FROM users WHERE is_deleted = 0 ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Create user (admin only) — email is the login identifier now, so it's required and
// restricted to the company domain; there's no username field in the app anymore.
// No password field here: a random temp password is generated server-side and emailed
// to the user along with a reset link (see provisionUser above) — the admin never
// chooses or sees another person's password.
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { full_name, email, role, can_edit_digitization } = req.body;
    if (!full_name || !email || !role)
      return res.status(400).json({ message: 'Full name, email, and role are required' });
    if (!RDC_EMAIL_REGEX.test(email))
      return res.status(400).json({ message: 'Email must be a valid @rdc.in address' });
    if (!VALID_ROLES.includes(role))
      return res.status(400).json({ message: 'Invalid role' });

    const outcome = await provisionUser({ full_name, email, role, canEditDigitization: role === 'viewer' && !!can_edit_digitization, req });
    if (outcome.status === 'failed') return res.status(409).json({ message: outcome.message });

    const [rows] = await pool.execute(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [outcome.id]);
    res.status(201).json({ ...rows[0], email_sent: outcome.email_sent });
  } catch (e) { next(e); }
});

// Bulk-create users from an uploaded Excel sheet (admin only). Every row is validated and
// provisioned independently — one bad row doesn't roll back the rest — and each result is
// reported back so the admin can see exactly what happened per row.
router.post('/bulk', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ message: 'No rows provided' });
    if (rows.length > 200)
      return res.status(400).json({ message: 'Maximum 200 users per bulk upload' });

    const results = [];
    const seenEmails = new Set();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // +1 for 1-indexing, +1 for the header row — matches what's visible in Excel
      const full_name = String(rows[i].full_name || '').trim();
      const email = String(rows[i].email || '').trim().toLowerCase();
      const role = String(rows[i].role || '').trim().toLowerCase();

      if (!full_name || !email || !role) {
        results.push({ row: rowNum, email: email || '(blank)', status: 'failed', message: 'Full name, email, and role are all required' });
        continue;
      }
      if (!RDC_EMAIL_REGEX.test(email)) {
        results.push({ row: rowNum, email, status: 'failed', message: 'Must be a valid @rdc.in address' });
        continue;
      }
      if (!VALID_ROLES.includes(role)) {
        results.push({ row: rowNum, email, status: 'failed', message: `Invalid role "${role}" — must be admin, editor, or viewer` });
        continue;
      }
      if (seenEmails.has(email)) {
        results.push({ row: rowNum, email, status: 'failed', message: 'Duplicate email within this upload' });
        continue;
      }
      seenEmails.add(email);

      try {
        const outcome = await provisionUser({ full_name, email, role, req });
        if (outcome.status === 'failed') {
          results.push({ row: rowNum, email, status: 'failed', message: outcome.message });
        } else {
          results.push({
            row: rowNum, email, status: 'created',
            message: outcome.email_sent ? 'Created — welcome email sent' : 'Created, but the welcome email failed to send',
          });
        }
      } catch {
        results.push({ row: rowNum, email, status: 'failed', message: 'Unexpected error creating this user' });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    res.status(201).json({ created, failed: results.length - created, results });
  } catch (e) { next(e); }
});

// Update user (admin only)
router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { full_name, email, role, can_edit_digitization, is_active, password } = req.body;
    const [existingRows] = await pool.execute('SELECT * FROM users WHERE id = ? AND is_deleted = 0', [req.params.id]);
    const user = existingRows[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    const updates = [];
    const params = [];

    if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name); }
    if (email !== undefined) {
      if (!RDC_EMAIL_REGEX.test(email))
        return res.status(400).json({ message: 'Email must be a valid @rdc.in address' });
      const [dupRows] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ? AND is_deleted = 0', [email, req.params.id]);
      if (dupRows[0]) return res.status(409).json({ message: 'A user with this email already exists' });
      updates.push('email = ?'); params.push(email);
    }
    if (role !== undefined) {
      if (!['admin', 'editor', 'viewer'].includes(role))
        return res.status(400).json({ message: 'Invalid role' });
      updates.push('role = ?'); params.push(role);
      // Only meaningful for viewers — promoting away from viewer clears it so a former
      // viewer's leftover flag doesn't silently resurface if they're ever demoted back.
      if (role !== 'viewer') { updates.push('can_edit_digitization = ?'); params.push(0); }
    }
    if (can_edit_digitization !== undefined && (role === 'viewer' || (role === undefined && user.role === 'viewer'))) {
      updates.push('can_edit_digitization = ?'); params.push(can_edit_digitization ? 1 : 0);
    }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
      updates.push('password = ?'); params.push(bcrypt.hashSync(password, 10));
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [updatedRows] = await pool.execute(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [req.params.id]);
    res.json(updatedRows[0]);
  } catch (e) { next(e); }
});

// Deliberately no delete endpoint: email is UNIQUE across all rows regardless of
// is_deleted, so soft-deleting a user permanently blocks that email from ever being used
// again (the account-level UNIQUE constraint doesn't know about soft deletes) — a re-add
// would fail with an opaque duplicate-key error. Deactivating (PUT is_active=false) is the
// supported way to cut off a user's access without that trap.

module.exports = router;
