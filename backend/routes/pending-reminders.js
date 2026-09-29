const express = require('express');
const { pool } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { splitPendingWith, isRealPersonName } = require('../utils/pendingWith');
const { sendPendingReminderEmail } = require('../services/mailer');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('admin'));

const RAISED_DATE = `COALESCE(NULLIF(TRIM(s.creation_date), ''), DATE(s.created_at))`;

// Deloitte is tracked separately (the weekly PDF import already covers them) — this feature
// is specifically for reminding the RDC-side and other named people, so any pending_with
// token that names Deloitte in any form ("Deloitte", "Deloitte ERP Support") is left out.
// isRealPersonName (see utils/pendingWith.js) filters out the ManageEngine status placeholder
// on top of this — that one's excluded everywhere, not just here.
function isDeloitte(name) {
  return name.toLowerCase().includes('deloitte');
}

// Builds one group per PERSON currently named in an open SR's Pending With field (excluding
// Deloitte and anyone marked "ignored" in the contacts directory - ignored contacts remain
// valid Pending With names, they're just never sent a reminder). Grouped by resolved email
// (not by name) so two name-variants for the same person ("Aniket" / "Aniket Sawant") that
// share one contact email get merged into a single email rather than two separate ones;
// a name with no email on file yet can't be merged with anything, so it stays its own group
// keyed by name until an email is added. Recomputed fresh from the DB every time this is
// called — never trust a client-supplied SR list for what actually gets emailed.
async function buildReminderGroups() {
  const [rows] = await pool.query(`
    SELECT
      s.sr_number, s.description, s.status, s.pending_with, s.expected_closure_date,
      DATEDIFF(CURDATE(), COALESCE(
        (SELECT MAX(DATE(h.changed_at)) FROM sr_history h WHERE h.sr_id = s.id AND h.field_changed = 'pending_with' AND h.is_deleted = 0),
        ${RAISED_DATE}
      )) as pending_since_days
    FROM srs s
    WHERE s.category = 'SR' AND s.is_deleted = 0 AND s.status != 'Closed'
  `);

  const [contactRows] = await pool.query('SELECT id, name, email, is_ignored FROM contacts WHERE is_deleted = 0');
  const contactByLowerName = new Map(contactRows.map(c => [c.name.toLowerCase(), c]));

  const groups = new Map();
  for (const row of rows) {
    for (const name of splitPendingWith(row.pending_with)) {
      if (!isRealPersonName(name) || isDeloitte(name)) continue;
      const contact = contactByLowerName.get(name.toLowerCase());
      if (contact?.is_ignored) continue;

      const email = contact?.email || null;
      const key = email ? `email:${email.toLowerCase()}` : `name:${name.toLowerCase()}`;
      let group = groups.get(key);
      if (!group) {
        group = { key, name, email, contactId: contact?.id || null, srs: [] };
        groups.set(key, group);
      } else if (!group.name.split(' / ').includes(name)) {
        group.name = `${group.name} / ${name}`;
      }
      if (!group.srs.some(s => s.sr_number === row.sr_number)) {
        group.srs.push({
          sr_number: row.sr_number,
          description: row.description,
          status: row.status,
          expected_closure_date: row.expected_closure_date,
          pending_since_days: row.pending_since_days,
        });
      }
    }
  }

  return [...groups.values()].sort((a, b) => b.srs.length - a.srs.length);
}

router.get('/preview', async (req, res, next) => {
  try {
    const groups = await buildReminderGroups();
    res.json({
      groups: groups.map(g => ({ ...g, srCount: g.srs.length })),
      unresolvedCount: groups.filter(g => !g.email).length,
    });
  } catch (e) { next(e); }
});

router.post('/send', async (req, res, next) => {
  try {
    const requestedKeys = new Set((req.body.keys || []).map(String));
    if (requestedKeys.size === 0) return res.status(400).json({ message: 'Select at least one person to send to' });

    const groups = (await buildReminderGroups()).filter(g => requestedKeys.has(g.key));
    const sent = [];
    const failed = [];

    for (const group of groups) {
      const srNumbers = group.srs.map(s => s.sr_number).join(', ');
      if (!group.email) {
        failed.push({ name: group.name, message: 'No email on file for this contact' });
        await pool.execute(
          'INSERT INTO pending_reminder_log (recipient_name, recipient_email, sr_count, sr_numbers, status, message, sent_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [group.name, null, group.srs.length, srNumbers, 'failed', 'No email on file for this contact', req.user.id]
        );
        continue;
      }
      try {
        await sendPendingReminderEmail({ to: group.email, name: group.name, srs: group.srs });
        sent.push({ name: group.name, email: group.email, srCount: group.srs.length });
        await pool.execute(
          'INSERT INTO pending_reminder_log (recipient_name, recipient_email, sr_count, sr_numbers, status, sent_by) VALUES (?, ?, ?, ?, ?, ?)',
          [group.name, group.email, group.srs.length, srNumbers, 'sent', req.user.id]
        );
      } catch (e) {
        failed.push({ name: group.name, message: e.message });
        await pool.execute(
          'INSERT INTO pending_reminder_log (recipient_name, recipient_email, sr_count, sr_numbers, status, message, sent_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [group.name, group.email, group.srs.length, srNumbers, 'failed', e.message, req.user.id]
        );
      }
    }

    res.json({ sent, failed });
  } catch (e) { next(e); }
});

router.get('/history', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT l.*, u.full_name as sent_by_name
      FROM pending_reminder_log l LEFT JOIN users u ON l.sent_by = u.id
      ORDER BY l.sent_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
